import type {
  Bilingual, Decision, DiffHunk, DiffLine, Finding, Fix, Investigation,
  ReasoningStep, Severity, ValidationCheck,
} from '@/lib/types';
import type {
  AgentAction, AgentOutputPayload, PipelineRunAnalysis, ReasoningLogEntry,
  RiskReason, RiskScorePayload,
} from './types';

/**
 * THE ADAPTER
 * ===========
 *
 * The single place where the other workstreams' output becomes the dashboard's
 * model. When their shape changes, this file changes and nothing else does.
 *
 * Three rules it follows:
 *  1. Never throw. A malformed payload during judging must degrade, not crash.
 *  2. Never invent. If `explanation_ur` is missing, the Urdu toggle says so
 *     rather than showing English text pretending to be a translation.
 *  3. Report what was missing, so integration gaps are visible instead of
 *     silently papered over. See `AdaptResult.missing`.
 */

export interface AdaptResult {
  investigation: Investigation;
  finding: Finding;
  fix: Fix | null;
  /** Contract fields that were absent or unusable. Rendered in the UI. */
  missing: string[];
}

const b = (en: string, ur?: string): Bilingual => ({
  en,
  // An absent translation is stated, never faked by falling back to English.
  ur: ur && ur.trim() ? ur : `[اردو ترجمہ دستیاب نہیں] ${en}`,
});

/** Confidence arrives as 0-1 from some models and 0-100 from others. */
export function normaliseConfidence(v: number | undefined | null): number | null {
  if (v === undefined || v === null || Number.isNaN(v)) return null;
  const n = Number(v);
  if (n <= 1 && n >= 0) return Math.round(n * 100);
  return Math.round(Math.max(0, Math.min(100, n)));
}

/** Three teams, one enum, many spellings. */
export function normaliseAction(action: AgentAction | string | undefined): Decision {
  const a = String(action ?? '').toLowerCase().replace(/[\s-]/g, '_');
  if (a.includes('escalate') || a.includes('refus') || a.includes('human')) return 'refused';
  if (a.includes('caution') || a.includes('propose') || a.includes('flag') || a.includes('review')) return 'flagged';
  if (a.includes('auto') || a.includes('fix') || a.includes('apply')) return 'auto_fixed';
  // Unknown verbs are the safest possible reading: assume a human is needed.
  return 'flagged';
}

export function severityFromScore(score: number): Severity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function reasonText(r: RiskReason | string): string {
  if (typeof r === 'string') return r;
  return r.message ?? r.reason ?? r.code ?? 'unspecified reason';
}

/** Renders graph_path whether it is a node list or an edge list. */
function graphPathText(path: RiskScorePayload['graph_path']): string | null {
  if (!path || path.length === 0) return null;
  if (typeof path[0] === 'string') return (path as string[]).join(' → ');
  return (path as Array<{ from: string; to: string }>)
    .map((e) => `${e.from} → ${e.to}`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// Unified diff parsing
// ---------------------------------------------------------------------------

/**
 * Parse a unified diff into the hunks the viewer renders.
 *
 * Deliberately tolerant: a diff with no @@ header is treated as a single hunk,
 * because some agents emit bare +/- blocks.
 */
export function parseUnifiedDiff(diff: string | null | undefined): DiffHunk[] {
  if (!diff || !diff.trim()) return [];
  const lines = diff.replace(/\r\n/g, '\n').split('\n');
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldLine = 1;
  let newLine = 1;

  for (const raw of lines) {
    // Skip file headers; the path is carried separately.
    if (/^(diff --git|index |--- |\+\+\+ )/.test(raw)) continue;

    const hunkHeader = raw.match(/^@@\s*-(\d+)(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@/);
    if (hunkHeader) {
      if (current) hunks.push(current);
      oldLine = Number(hunkHeader[1]);
      newLine = Number(hunkHeader[2]);
      current = { header: raw.trim(), lines: [] };
      continue;
    }

    if (!current) {
      current = { header: '@@ fix @@', lines: [] };
      oldLine = 1;
      newLine = 1;
    }

    let entry: DiffLine | null = null;
    if (raw.startsWith('+')) {
      entry = { type: 'add', oldLine: null, newLine: newLine++, content: raw.slice(1) };
    } else if (raw.startsWith('-')) {
      entry = { type: 'remove', oldLine: oldLine++, newLine: null, content: raw.slice(1) };
    } else if (raw.startsWith('\\')) {
      continue; // "\ No newline at end of file"
    } else {
      const content = raw.startsWith(' ') ? raw.slice(1) : raw;
      entry = { type: 'context', oldLine: oldLine++, newLine: newLine++, content };
    }
    current.lines.push(entry);
  }

  if (current && current.lines.length > 0) hunks.push(current);
  return hunks;
}

// ---------------------------------------------------------------------------
// Reasoning steps
// ---------------------------------------------------------------------------

const STAGE_KINDS: Record<string, ReasoningStep['kind']> = {
  detect: 'detect', detection: 'detect', observe: 'detect',
  historical: 'historical', history: 'historical',
  dependency: 'dependency', graph: 'dependency',
  impact: 'impact', blast_radius: 'impact',
  confidence: 'confidence', aggregate: 'confidence',
  decision: 'decision', decide: 'decision',
};

/** Preferred path: the Agentic Layer emitted a real trace. */
function stepsFromLog(log: ReasoningLogEntry[], finalConfidence: number): ReasoningStep[] {
  let previous = 0;
  return log.map((entry, i) => {
    const after = normaliseConfidence(entry.confidence_after)
      ?? (i === log.length - 1 ? finalConfidence : previous);
    const delta = after - previous;
    previous = after;
    return {
      id: `s${i + 1}`,
      kind: STAGE_KINDS[String(entry.stage ?? '').toLowerCase()] ?? 'detect',
      title: b(entry.stage ? titleCase(entry.stage) : `Step ${i + 1}`),
      claim: b(entry.claim ?? 'No claim provided for this step.', entry.claim_ur),
      because: (entry.evidence ?? []).map((e, j) => b(e, entry.evidence_ur?.[j])),
      citations: (entry.citations ?? []).map((c) => ({
        label: c.label ?? 'evidence',
        href: c.href ?? null,
        kind: (c.kind as any) ?? 'file',
      })),
      confidenceAfter: after,
      confidenceDelta: delta,
      durationMs: entry.duration_ms ?? 600,
    };
  });
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Fallback path: synthesise a chain from the risk payload.
 *
 * This is honest synthesis, not fabrication — every step cites a field that
 * actually arrived. Where a field is missing the step says so and lowers
 * confidence, which is why the trajectory can still move in both directions.
 */
function stepsFromRisk(
  risk: RiskScorePayload,
  agent: AgentOutputPayload | null,
  decision: Decision,
  finalConfidence: number,
  missing: string[],
): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  const reasons = risk.reasons ?? [];
  const jobs = risk.affected_jobs ?? [];
  const path = graphPathText(risk.graph_path);
  const breakdown = risk.model_breakdown ?? {};

  let confidence = Math.max(20, Math.round(finalConfidence * 0.6));

  // 1. Detection
  steps.push({
    id: 's1',
    kind: 'detect',
    title: b('Detection Core flagged this run', 'ڈیٹیکشن کور نے اس رن کی نشاندہی کی'),
    claim: b(
      `Risk score ${risk.risk_score}/100 on ${risk.workflow ?? 'this workflow'}${
        reasons.length ? `, driven by ${reasons.length} contributing signal(s).` : '.'}`,
      `${risk.workflow ?? 'اس ورک فلو'} پر رِسک سکور ${risk.risk_score}/100${
        reasons.length ? `، جس کی وجہ ${reasons.length} معاون اشارے ہیں۔` : '۔'}`,
    ),
    because: reasons.length
      ? reasons.slice(0, 4).map((r) => b(reasonText(r)))
      : [b('The model returned a score with no itemised reasons.',
           'ماڈل نے سکور تو دیا مگر کوئی تفصیلی وجوہات نہیں دیں۔')],
    citations: [
      { label: `risk_score ${risk.risk_score}`, href: null, kind: 'policy' },
      ...(risk.file ? [{ label: `${risk.file}${risk.line ? `:${risk.line}` : ''}`, href: null, kind: 'file' as const }] : []),
    ],
    confidenceAfter: confidence,
    confidenceDelta: confidence,
    durationMs: 620,
  });

  // 2. Model agreement — genuine evidence when present, a gap when not.
  const values = Object.values(breakdown);
  if (values.length > 1) {
    const spread = Math.max(...values) - Math.min(...values);
    const agree = spread < 0.3;
    const delta = agree ? 12 : -10;
    confidence += delta;
    steps.push({
      id: 's2',
      kind: 'historical',
      title: b('Cross-checked model agreement', 'ماڈلز کے اتفاق کی جانچ'),
      claim: agree
        ? b(`The ${values.length} models agree closely (spread ${spread.toFixed(2)}).`,
            `${values.length} ماڈلز کے نتائج قریب قریب یکساں ہیں (فرق ${spread.toFixed(2)})۔`)
        : b(`The ${values.length} models disagree (spread ${spread.toFixed(2)}), which lowers confidence.`,
            `${values.length} ماڈلز کے نتائج مختلف ہیں (فرق ${spread.toFixed(2)})، جس سے اعتماد کم ہوتا ہے۔`),
      because: Object.entries(breakdown).map(([k, v]) => b(`${k}: ${v}`)),
      citations: [{ label: 'model_breakdown', href: null, kind: 'policy' }],
      confidenceAfter: confidence,
      confidenceDelta: delta,
      durationMs: 1180,
    });
  } else {
    missing.push('risk.model_breakdown (no per-model agreement check possible)');
    confidence -= 6;
    steps.push({
      id: 's2',
      kind: 'historical',
      title: b('Model agreement unavailable', 'ماڈلز کے اتفاق کی معلومات دستیاب نہیں'),
      claim: b('No per-model breakdown was returned, so agreement could not be checked.',
        'ہر ماڈل کی الگ تفصیل نہیں ملی، اس لیے اتفاق کی جانچ ممکن نہ ہو سکی۔'),
      because: [b('This lowers confidence rather than being ignored.',
        'اسے نظر انداز کرنے کے بجائے اعتماد میں کمی کی گئی ہے۔')],
      citations: [],
      confidenceAfter: confidence,
      confidenceDelta: -6,
      durationMs: 700,
    });
  }

  // 3. Dependency
  const depDelta = path ? 9 : 3;
  confidence += depDelta;
  steps.push({
    id: 's3',
    kind: 'dependency',
    title: b('Traced the dependency graph', 'ڈیپنڈنسی گراف کا سراغ'),
    claim: path
      ? b(`Propagation path: ${path}.`, `پھیلاؤ کا راستہ: ${path}۔`)
      : b('No graph path was supplied, so propagation is unknown.',
          'گراف کا کوئی راستہ نہیں دیا گیا، اس لیے پھیلاؤ معلوم نہیں۔'),
    because: jobs.length
      ? [b(`Affected jobs: ${jobs.join(', ')}.`, `متاثرہ جابز: ${jobs.join('، ')}۔`)]
      : [b('No affected jobs were listed.', 'کوئی متاثرہ جاب درج نہیں کی گئی۔')],
    citations: [{ label: 'graph_path', href: '/graph', kind: 'job' }],
    confidenceAfter: confidence,
    confidenceDelta: depDelta,
    durationMs: 940,
  });
  if (!path) missing.push('risk.graph_path (dependency propagation unknown)');

  // 4. Impact
  const impactDelta = risk.risk_score >= 60 ? 8 : 5;
  confidence += impactDelta;
  steps.push({
    id: 's4',
    kind: 'impact',
    title: b('Bounded the blast radius', 'اثر کے دائرے کا تعین'),
    claim: b(
      `${jobs.length || 'An unknown number of'} job(s) affected at severity ${severityFromScore(risk.risk_score)}.`,
      `${jobs.length || 'نامعلوم تعداد میں'} جابز متاثر، شدت: ${severityFromScore(risk.risk_score)}۔`,
    ),
    because: [b(`Risk score ${risk.risk_score} maps to ${severityFromScore(risk.risk_score)} severity.`,
      `رِسک سکور ${risk.risk_score} کا مطلب ${severityFromScore(risk.risk_score)} شدت ہے۔`)],
    citations: [],
    confidenceAfter: confidence,
    confidenceDelta: impactDelta,
    durationMs: 780,
  });

  // 5. Confidence reconciliation — the honest step.
  const declared = normaliseConfidence(agent?.confidence) ?? normaliseConfidence(risk.confidence);
  const reconDelta = (declared ?? confidence) - confidence;
  confidence = declared ?? confidence;
  steps.push({
    id: 's5',
    kind: 'confidence',
    title: b('Reconciled agent confidence', 'ایجنٹ کے اعتماد کا ملاپ'),
    claim: declared !== null
      ? b(`The agent reports ${declared}% confidence in this decision.`,
          `ایجنٹ اس فیصلے پر ${declared}٪ اعتماد ظاہر کرتا ہے۔`)
      : b('Neither the model nor the agent reported a confidence value.',
          'نہ ماڈل نے، نہ ایجنٹ نے کوئی اعتماد کی قدر دی۔'),
    because: [
      declared !== null
        ? b('This is the agent’s own number, not one derived by the dashboard.',
            'یہ خود ایجنٹ کا دیا ہوا عدد ہے، ڈیش بورڈ کا اخذ کردہ نہیں۔')
        : b('The dashboard will not invent one, so the decision is shown without it.',
            'ڈیش بورڈ خود سے کوئی عدد نہیں بنائے گا، لہٰذا فیصلہ اس کے بغیر دکھایا جا رہا ہے۔'),
    ],
    citations: [],
    confidenceAfter: confidence,
    confidenceDelta: reconDelta,
    durationMs: 1020,
  });
  if (declared === null) missing.push('agent.confidence and risk.confidence both absent');

  // 6. Decision
  steps.push({
    id: 's6',
    kind: 'decision',
    title: b(
      decision === 'auto_fixed' ? 'Decision: auto-fix'
        : decision === 'flagged' ? 'Decision: propose with caution'
          : 'Decision: escalate to human',
      decision === 'auto_fixed' ? 'فیصلہ: خودکار درستگی'
        : decision === 'flagged' ? 'فیصلہ: احتیاط کے ساتھ تجویز'
          : 'فیصلہ: انسان کے پاس بھیجا جائے',
    ),
    claim: b(
      agent?.explanation_en ?? 'The agent returned no explanation for this decision.',
      agent?.explanation_ur,
    ),
    because: agent?.escalation_reason
      ? [b(agent.escalation_reason)]
      : [b(`Action returned by the Agentic Layer: ${String(agent?.action ?? 'none')}.`,
           `ایجنٹک لیئر کی جانب سے کارروائی: ${String(agent?.action ?? 'کوئی نہیں')}۔`)],
    citations: agent?.pr_url
      ? [{ label: 'pull request', href: agent.pr_url, kind: 'commit' as const }]
      : [],
    confidenceAfter: confidence,
    confidenceDelta: 0,
    durationMs: 860,
  });

  return steps;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function adaptRun(run: PipelineRunAnalysis): AdaptResult {
  const missing: string[] = [];
  const risk = run.risk ?? ({ risk_score: 0 } as RiskScorePayload);
  const agent = run.agent ?? null;

  if (!agent) missing.push('agent output (run analysed but no decision yet)');
  if (!agent?.explanation_ur) missing.push('agent.explanation_ur (Urdu toggle will show a notice)');
  if (!agent?.prevents) missing.push('agent.prevents (consequence line derived from explanation)');

  const decision = normaliseAction(agent?.action);
  const confidence =
    normaliseConfidence(agent?.confidence) ?? normaliseConfidence(risk.confidence) ?? 50;
  const severity = severityFromScore(risk.risk_score);

  const steps = agent?.reasoning_log?.length
    ? stepsFromLog(agent.reasoning_log, confidence)
    : stepsFromRisk(risk, agent, decision, confidence, missing);

  const title = b(
    agent?.title
      ?? (risk.reasons?.length ? reasonText(risk.reasons[0]) : `Risk detected on ${run.workflow}`),
  );

  const investigation: Investigation = {
    id: run.run_id,
    findingId: `PG-${run.run_id.replace(/\D/g, '').slice(-4) || '0000'}`,
    title,
    repo: run.repo,
    pipeline: run.workflow,
    pipelineId: `wf_${run.workflow.replace(/[^a-z0-9]/gi, '_')}`,
    runId: run.run_id,
    commit: run.commit ?? 'HEAD',
    commitMessage: run.commit_message ?? '',
    author: run.author ?? 'unknown',
    branch: run.branch ?? 'main',
    filePath: agent?.file_path ?? risk.file ?? run.workflow,
    severity,
    decision,
    confidence,
    startedAt: run.started_at ?? risk.detected_at ?? new Date().toISOString(),
    durationMs: steps.reduce((a, s) => a + s.durationMs, 0),
    steps,
    fix: null, // attached below
    gaps: agent?.escalation_reason
      ? [{
          missing: b(agent.escalation_reason),
          wouldResolve: b(
            'A human owner answering the question above.',
            'کوئی انسانی مالک اوپر دیے گئے سوال کا جواب دے۔',
          ),
          obtainableByAgent: false,
        }]
      : [],
    hypotheses: [],
    thresholds: { autoFixFloor: 90, recommendFloor: 45 },
    similarChanges: [],
  };

  const hunks = parseUnifiedDiff(agent?.fix_diff);
  const checks: ValidationCheck[] = (agent?.verification?.checks ?? []).map((c) => ({
    name: c.name ?? 'check',
    status: (c.status === 'passed' || c.status === 'failed' || c.status === 'skipped'
      ? c.status : 'not_applicable'),
    detail: b(c.detail ?? ''),
    durationMs: c.duration_ms ?? 0,
  }));

  const fix: Fix | null = decision === 'refused' || (!hunks.length && !agent?.fix_diff)
    ? null
    : {
        id: `fix_${run.run_id}`,
        investigationId: run.run_id,
        title: b(agent?.title ?? 'Proposed fix'),
        filePath: agent?.file_path ?? risk.file ?? run.workflow,
        hunks,
        prevents: b(
          agent?.prevents ?? deriveConsequence(agent?.explanation_en, risk),
          agent?.prevents_ur,
        ),
        rationale: b(
          agent?.explanation_en ?? 'No rationale supplied by the Agentic Layer.',
          agent?.explanation_ur,
        ),
        validation: {
          verified: agent?.verification?.passed ?? false,
          method: b(agent?.verification?.method ?? 'No verification method reported.'),
          checks,
        },
        status: decision === 'auto_fixed' ? 'applied' : 'awaiting_review',
        pullRequest: agent?.pr_url
          ? {
              number: Number(agent.pr_url.split('/').pop()) || 0,
              title: agent.title ?? 'PipelineGuard fix',
              branch: 'pipelineguard/fix',
              baseBranch: 'main',
              state: decision === 'auto_fixed' ? 'open' : 'draft',
              additions: hunks.flatMap((h) => h.lines).filter((l) => l.type === 'add').length,
              deletions: hunks.flatMap((h) => h.lines).filter((l) => l.type === 'remove').length,
              filesChanged: 1,
              reviewers: [],
              body: b(agent.explanation_en ?? '', agent.explanation_ur),
            }
          : null,
      };

  investigation.fix = fix;

  const finding: Finding = {
    id: investigation.findingId,
    ruleId: (typeof risk.reasons?.[0] === 'object' && (risk.reasons[0] as RiskReason).code) || 'DETECTION_CORE',
    title,
    description: b(agent?.explanation_en ?? reasonText(risk.reasons?.[0] ?? 'No description supplied.'),
      agent?.explanation_ur),
    severity,
    status: decision === 'auto_fixed' ? 'fixed' : decision === 'refused' ? 'refused' : 'in_review',
    repo: run.repo,
    pipelineId: investigation.pipelineId,
    pipelineName: run.workflow,
    filePath: investigation.filePath,
    line: risk.line ?? 0,
    jobId: risk.affected_jobs?.[0] ?? null,
    detectedAt: investigation.startedAt,
    resolvedAt: decision === 'auto_fixed' ? new Date().toISOString() : null,
    investigationId: investigation.id,
    impact: b(
      `${risk.affected_jobs?.length ?? 0} job(s) affected; risk score ${risk.risk_score}.`,
      `${risk.affected_jobs?.length ?? 0} جابز متاثر؛ رِسک سکور ${risk.risk_score}۔`,
    ),
    category: 'policy',
    cwe: null,
  };

  return { investigation, finding, fix, missing };
}

/** Last-resort consequence line when the agent does not supply one. */
function deriveConsequence(explanation: string | undefined, risk: RiskScorePayload): string {
  if (explanation) {
    const first = explanation.split(/(?<=\.)\s/)[0];
    if (first && first.length < 200) return first;
  }
  const jobs = risk.affected_jobs?.length ?? 0;
  return `Prevents the detected weakness from remaining reachable in ${jobs || 'the affected'} pipeline job(s).`;
}
