import YAML from 'yaml';

/**
 * Workflow parser.
 *
 * Produces a normalised model plus line numbers, because a finding that cannot
 * point at a line is not actionable. Structure comes from the YAML parser;
 * line numbers come from a separate scan, which is more robust than walking
 * the CST for the handful of tokens we actually anchor findings to.
 */

export interface ParsedStep {
  index: number;
  name: string | null;
  uses: string | null;
  run: string | null;
  env: Record<string, string>;
  withKeys: string[];
  if: string | null;
  line: number;
}

export interface ParsedJob {
  id: string;
  name: string;
  needs: string[];
  /** Effective permissions after merging the workflow root with the job block. */
  permissions: Record<string, string>;
  /** True when the job declares no block and inherits the root. */
  inheritsRootPermissions: boolean;
  environment: string | null;
  steps: ParsedStep[];
  /** Secret references found anywhere in the job. */
  secrets: string[];
  line: number;
}

export interface ParsedWorkflow {
  path: string;
  name: string;
  triggers: string[];
  rootPermissions: Record<string, string> | 'write-all' | 'read-all' | null;
  rootPermissionsLine: number | null;
  jobs: ParsedJob[];
  lines: string[];
  /** Set when the file could not be parsed at all. */
  error: string | null;
}

const SECRET_RE = /\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g;
const VARS_RE = /\$\{\{\s*vars\.([A-Za-z0-9_]+)\s*\}\}/g;

export function findSecrets(text: string): string[] {
  return [...text.matchAll(SECRET_RE)].map((m) => m[1]);
}

export function findVars(text: string): string[] {
  return [...text.matchAll(VARS_RE)].map((m) => m[1]);
}

/** First line whose content matches, 1-indexed. 0 when not found. */
function lineOf(lines: string[], test: (l: string) => boolean, from = 0): number {
  for (let i = from; i < lines.length; i++) if (test(lines[i])) return i + 1;
  return 0;
}

function normalisePermissions(
  raw: unknown,
): Record<string, string> | 'write-all' | 'read-all' | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    if (raw === 'write-all' || raw === 'read-all') return raw;
    return null;
  }
  if (typeof raw === 'object') {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = String(v);
    }
    return out;
  }
  return null;
}

function expandPermissions(
  p: Record<string, string> | 'write-all' | 'read-all' | null,
): Record<string, string> {
  const SCOPES = [
    'actions', 'checks', 'contents', 'deployments', 'id-token', 'issues',
    'packages', 'pages', 'pull-requests', 'security-events', 'statuses',
  ];
  if (p === 'write-all') return Object.fromEntries(SCOPES.map((s) => [s, 'write']));
  if (p === 'read-all') return Object.fromEntries(SCOPES.map((s) => [s, 'read']));
  return p ?? {};
}

export function parseWorkflow(content: string, path: string): ParsedWorkflow {
  const lines = content.split('\n');
  const base: ParsedWorkflow = {
    path,
    name: path.split('/').pop() ?? path,
    triggers: [],
    rootPermissions: null,
    rootPermissionsLine: null,
    jobs: [],
    lines,
    error: null,
  };

  let doc: any;
  try {
    doc = YAML.parse(content, { uniqueKeys: false, strict: false });
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : 'YAML parse failed' };
  }
  if (!doc || typeof doc !== 'object') {
    return { ...base, error: 'Workflow did not parse to an object' };
  }

  const name = typeof doc.name === 'string' ? doc.name : base.name;

  // `on` is a YAML 1.1 boolean; some parsers hand it back as `true`.
  const onNode = doc.on ?? doc.true ?? doc.True;
  const triggers = Array.isArray(onNode)
    ? onNode.map(String)
    : onNode && typeof onNode === 'object'
      ? Object.keys(onNode)
      : onNode
        ? [String(onNode)]
        : [];

  const rootPermissions = normalisePermissions(doc.permissions);
  const rootPermissionsLine = doc.permissions !== undefined
    ? lineOf(lines, (l) => /^permissions\s*:/.test(l))
    : null;

  const jobsNode = (doc.jobs ?? {}) as Record<string, any>;
  const jobs: ParsedJob[] = Object.entries(jobsNode).map(([id, j]) => {
    const jobLine = lineOf(lines, (l) => new RegExp(`^\\s{2}${id}\\s*:`).test(l));

    const ownPermissions = normalisePermissions(j?.permissions);
    const inherits = j?.permissions === undefined;
    const effective = inherits
      ? expandPermissions(rootPermissions)
      : expandPermissions(ownPermissions);

    const needs = j?.needs === undefined
      ? []
      : Array.isArray(j.needs) ? j.needs.map(String) : [String(j.needs)];

    const environment = j?.environment === undefined
      ? null
      : typeof j.environment === 'string'
        ? j.environment
        : (j.environment?.name ?? null);

    const rawSteps: any[] = Array.isArray(j?.steps) ? j.steps : [];
    let cursor = jobLine;
    const steps: ParsedStep[] = rawSteps.map((s, index) => {
      const uses = typeof s?.uses === 'string' ? s.uses : null;
      const run = typeof s?.run === 'string' ? s.run : null;
      const stepName = typeof s?.name === 'string' ? s.name : null;

      // Anchor on the most distinctive token available for this step.
      let line = 0;
      if (uses) line = lineOf(lines, (l) => l.includes(`uses:`) && l.includes(uses), cursor);
      if (!line && stepName) {
        line = lineOf(lines, (l) => l.includes('name:') && l.includes(stepName), cursor);
      }
      if (!line && run) {
        const first = run.split('\n')[0].trim().slice(0, 24);
        if (first) line = lineOf(lines, (l) => l.includes(first), cursor);
      }
      if (line) cursor = line;

      const env: Record<string, string> = {};
      if (s?.env && typeof s.env === 'object') {
        for (const [k, v] of Object.entries(s.env)) env[k] = String(v);
      }

      return {
        index,
        name: stepName,
        uses,
        run,
        env,
        withKeys: s?.with && typeof s.with === 'object' ? Object.keys(s.with) : [],
        if: typeof s?.if === 'string' ? s.if : null,
        line,
      };
    });

    const jobText = JSON.stringify(j ?? {});
    const secrets = [...new Set(findSecrets(jobText))];

    return {
      id,
      name: typeof j?.name === 'string' ? j.name : id,
      needs,
      permissions: effective,
      inheritsRootPermissions: inherits,
      environment,
      steps,
      secrets,
      line: jobLine,
    };
  });

  return { ...base, name, triggers, rootPermissions, rootPermissionsLine, jobs };
}

/** A third-party action pinned by tag or branch rather than a commit SHA. */
export function isMutableRef(uses: string): boolean {
  if (!uses.includes('@')) return false;
  if (uses.startsWith('./') || uses.startsWith('docker://')) return false;
  const ref = uses.split('@').pop() ?? '';
  return !/^[0-9a-f]{40}$/i.test(ref);
}

/** Actions published by GitHub itself carry materially lower supply-chain risk
 *  than a third-party publisher, and the analyser says so rather than treating
 *  every unpinned action identically. */
export function isFirstParty(uses: string): boolean {
  return /^(actions|github)\//.test(uses);
}
