import type {
  DependencyGraph, Finding, Fix, GraphEdge, GraphNode, Investigation, Pipeline, PipelineJob,
} from '@/lib/types';
import {
  getRecentRuns, getRepo, getWorkflows, resolveActionSha, type RepoRef, type RepoMeta,
} from './github';
import { parseWorkflow, type ParsedWorkflow } from './parse';
import { isProductionJob, runRules, RULE_COUNT, type Observation } from './rules';
import { buildInvestigation, type HistoryContext } from './reason';

export interface AnalysisResult {
  repo: {
    fullName: string;
    private: boolean;
    language: string | null;
    defaultBranch: string;
    url: string;
  };
  scannedAt: string;
  durationMs: number;
  workflowsFound: number;
  rulesEvaluated: number;
  jobsAnalysed: number;
  historyAvailable: boolean;
  runsSampled: number;
  investigations: Investigation[];
  findings: Finding[];
  fixes: Fix[];
  pipelines: Pipeline[];
  graphs: Record<string, DependencyGraph>;
  summary: {
    autoFixed: number;
    flagged: number;
    refused: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    /** 0-100. Mean configuration risk across findings; 0 when clean. */
    riskScore: number;
  };
  /** Non-fatal problems worth surfacing rather than hiding. */
  notes: string[];
}

const pipelineIdFor = (wf: ParsedWorkflow) => `wf_${wf.path.replace(/[^a-z0-9]/gi, '_')}`;

function toPipeline(wf: ParsedWorkflow, repoFullName: string, findings: Finding[]): Pipeline {
  const jobs: PipelineJob[] = wf.jobs.map((j) => ({
    id: j.id,
    name: j.name,
    needs: j.needs,
    permissions: Object.fromEntries(
      Object.entries(j.permissions).map(([k, v]) => [k, v as 'read' | 'write' | 'none']),
    ),
    secrets: j.secrets,
    environment: j.environment,
    steps: j.steps.length,
    avgDurationMs: 0,
    findingIds: findings.filter((f) => f.jobId === j.id).map((f) => f.id),
  }));

  return {
    id: pipelineIdFor(wf),
    name: wf.name,
    repo: repoFullName,
    provider: 'github_actions',
    filePath: wf.path,
    touchesProduction: wf.jobs.some(isProductionJob),
    jobs,
    environments: [...new Set(wf.jobs.map((j) => j.environment).filter(Boolean))] as string[],
    secretsUsed: [...new Set(wf.jobs.flatMap((j) => j.secrets))],
    openFindings: findings.filter((f) => f.pipelineId === pipelineIdFor(wf)).length,
    passRate: 0,
    lastRun: '',
    healthScore: 0,
  };
}

/**
 * Lay the workflow out as a graph. Columns come from dependency depth, so the
 * result is stable across scans — the same workflow always draws the same way.
 */
function toGraph(wf: ParsedWorkflow, findings: Finding[]): DependencyGraph {
  const depth = new Map<string, number>();
  const resolve = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0; // cycle guard
    seen.add(id);
    const job = wf.jobs.find((j) => j.id === id);
    const d = !job || job.needs.length === 0
      ? 0
      : Math.max(...job.needs.map((n) => resolve(n, seen))) + 1;
    depth.set(id, d);
    return d;
  };
  wf.jobs.forEach((j) => resolve(j.id));

  const rowByCol = new Map<number, number>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const job of wf.jobs) {
    const col = depth.get(job.id) ?? 0;
    const row = rowByCol.get(col) ?? 0;
    rowByCol.set(col, row + 1);
    const prod = isProductionJob(job);
    nodes.push({
      id: job.id,
      label: job.name,
      kind: 'job',
      production: prod,
      findingIds: findings.filter((f) => f.jobId === job.id).map((f) => f.id),
      column: col,
      row,
    });
    for (const need of job.needs) {
      edges.push({ from: need, to: job.id, kind: 'needs', tainted: true });
    }
  }

  const maxCol = Math.max(0, ...nodes.map((n) => n.column));
  let secretRow = Math.max(0, ...nodes.map((n) => n.row)) + 1;

  for (const secret of [...new Set(wf.jobs.flatMap((j) => j.secrets))]) {
    const id = `secret_${secret}`;
    nodes.push({
      id, label: secret, kind: 'secret',
      production: wf.jobs.some((j) => j.secrets.includes(secret) && isProductionJob(j)),
      findingIds: [], column: 0, row: secretRow++,
    });
    for (const job of wf.jobs.filter((j) => j.secrets.includes(secret))) {
      edges.push({ from: id, to: job.id, kind: 'reads_secret', tainted: false });
    }
  }

  let envRow = 0;
  for (const env of [...new Set(wf.jobs.map((j) => j.environment).filter(Boolean))] as string[]) {
    const id = `env_${env}`;
    nodes.push({
      id, label: env, kind: 'environment',
      production: !/^(staging|dev|development|preview|test|qa)$/i.test(env),
      findingIds: [], column: maxCol + 1, row: envRow++,
    });
    for (const job of wf.jobs.filter((j) => j.environment === env)) {
      edges.push({ from: job.id, to: id, kind: 'deploys_to', tainted: true });
    }
  }

  return { pipelineId: pipelineIdFor(wf), nodes, edges };
}

// ---------------------------------------------------------------------------

export async function analyzeRepository(
  ref: RepoRef,
  token?: string,
): Promise<AnalysisResult> {
  const started = Date.now();
  const notes: string[] = [];

  const meta: RepoMeta = await getRepo(ref, token);
  const files = await getWorkflows(ref, token);

  if (files.length === 0) {
    notes.push('No workflow files were found under .github/workflows.');
  }

  const workflows = files.map((f) => parseWorkflow(f.content, f.path));
  for (const wf of workflows) {
    if (wf.error) notes.push(`${wf.path} could not be parsed: ${wf.error}`);
  }

  const runs = await getRecentRuns(ref, token);
  if (runs === null) {
    notes.push('Run history was unavailable, so historical evidence lowered confidence on every finding.');
  }
  const history: HistoryContext = {
    runs,
    passed: (runs ?? []).filter((r) => r.conclusion === 'success').length,
    failed: (runs ?? []).filter((r) => r.conclusion === 'failure').length,
  };

  // Observations, ordered worst-first so the UI leads with what matters.
  const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const observations: Array<{ obs: Observation; wf: ParsedWorkflow }> = workflows
    .flatMap((wf) => runRules(wf).map((obs) => ({ obs, wf })))
    .sort((a, b) => rank[a.obs.severity] - rank[b.obs.severity]);

  // Resolve action SHAs concurrently; a failure downgrades the remedy but is
  // never fatal.
  const shaCache = new Map<string, { sha: string; resolvedFrom: string } | null>();
  await Promise.all(
    [...new Set(
      observations
        .filter(({ obs }) => obs.facts.actionRef)
        .map(({ obs }) => obs.facts.actionRef!),
    )].map(async (actionRef) => {
      try {
        shaCache.set(actionRef, await resolveActionSha(actionRef, token));
      } catch {
        shaCache.set(actionRef, null);
      }
    }),
  );

  const investigations: Investigation[] = [];
  const findings: Finding[] = [];
  const fixes: Fix[] = [];

  observations.forEach(({ obs, wf }, index) => {
    const built = buildInvestigation({
      observation: obs,
      workflow: wf,
      repoFullName: meta.full_name,
      history,
      resolvedSha: obs.facts.actionRef ? shaCache.get(obs.facts.actionRef) ?? null : null,
      index,
    });
    investigations.push(built.investigation);
    findings.push(built.finding);
    if (built.fix) fixes.push(built.fix);
  });

  const pipelines = workflows.map((wf) => toPipeline(wf, meta.full_name, findings));
  const graphs: Record<string, DependencyGraph> = {};
  for (const wf of workflows) graphs[pipelineIdFor(wf)] = toGraph(wf, findings);

  const count = (s: string) => findings.filter((f) => f.severity === s).length;
  const weight = { critical: 30, high: 18, medium: 9, low: 3 } as const;
  const rawRisk = findings.reduce((a, f) => a + weight[f.severity], 0);

  return {
    repo: {
      fullName: meta.full_name,
      private: meta.private,
      language: meta.language,
      defaultBranch: meta.default_branch,
      url: meta.html_url,
    },
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    workflowsFound: workflows.length,
    rulesEvaluated: RULE_COUNT,
    jobsAnalysed: workflows.reduce((a, w) => a + w.jobs.length, 0),
    historyAvailable: (runs?.length ?? 0) > 0,
    runsSampled: runs?.length ?? 0,
    investigations,
    findings,
    fixes,
    pipelines,
    graphs,
    summary: {
      autoFixed: investigations.filter((i) => i.decision === 'auto_fixed').length,
      flagged: investigations.filter((i) => i.decision === 'flagged').length,
      refused: investigations.filter((i) => i.decision === 'refused').length,
      critical: count('critical'),
      high: count('high'),
      medium: count('medium'),
      low: count('low'),
      riskScore: Math.min(100, rawRisk),
    },
    notes,
  };
}
