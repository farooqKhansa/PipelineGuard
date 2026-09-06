/**
 * THE INTEGRATION CONTRACT
 * =======================
 *
 * These are the shapes produced by the other three workstreams. They are the
 * boundary between their work and this dashboard, and they are deliberately
 * kept separate from the UI model in `src/lib/types.ts`.
 *
 * Why two models rather than one:
 *   - Their shape will change as the Detection Core and Agentic Layer evolve.
 *     When it does, only `adapt.ts` changes. No screen does.
 *   - Their shape is flat and machine-oriented (risk_score, model_breakdown).
 *     The UI needs an argument with ordered steps and confidence movement.
 *     Adapting is a real transformation, not a rename, so it deserves a home.
 *
 * EVERY FIELD BELOW IS OPTIONAL except the two the whole product depends on
 * (`risk_score` and `action`). That is intentional: the adapter must not crash
 * the demo because a teammate has not shipped `model_breakdown` yet. Missing
 * data degrades the UI gracefully and is reported, never faked.
 *
 * TO CONFIRM WITH TEAMMATES — marked ❓ inline below.
 */

// ---------------------------------------------------------------------------
// 1. Detection Core (ML) output
// ---------------------------------------------------------------------------

export interface RiskReason {
  /** Human-readable claim, e.g. "workflow-level permissions widened to write-all". */
  message?: string;
  /** Some models emit `reason` instead of `message`. Both are accepted. */
  reason?: string;
  /** Rule or feature id, if the model attributes one. */
  code?: string;
  /** Per-reason contribution to the score, 0-1 or 0-100. Either is handled. */
  weight?: number;
  severity?: string;
  /** File/line anchor if the model produces one. */
  file?: string;
  line?: number;
}

export interface RiskScorePayload {
  /** 0-100. The only genuinely required field. */
  risk_score: number;
  /** 0-1 or 0-100 — the adapter normalises either. */
  confidence?: number;
  /** Ordered strongest-first. Strings are accepted as a shorthand. */
  reasons?: Array<RiskReason | string>;
  /** Job ids the finding touches. */
  affected_jobs?: string[];
  /**
   * Path through the dependency graph, e.g. ["test","artifact","build"].
   * ❓ Confirm: is this a node-id list, or a list of {from,to} edges?
   * The adapter currently handles BOTH.
   */
  graph_path?: Array<string | { from: string; to: string; kind?: string }>;
  /** Per-model contributions, e.g. { gbm: 0.72, rules: 0.9, anomaly: 0.4 }. */
  model_breakdown?: Record<string, number>;

  // Context fields — present in some payloads, absent in others.
  run_id?: string;
  repo?: string;
  workflow?: string;
  commit?: string;
  author?: string;
  branch?: string;
  file?: string;
  line?: number;
  detected_at?: string;
}

// ---------------------------------------------------------------------------
// 2. Agentic Layer output
// ---------------------------------------------------------------------------

/**
 * The three decision paths.
 *
 * Synonyms are tolerated because three teams naming one enum independently is
 * how integrations break at 2am. See `normaliseAction` in adapt.ts.
 */
export type AgentAction =
  | 'auto_fix' | 'auto_fixed' | 'autofix'
  | 'propose_with_caution' | 'propose' | 'flag' | 'flagged'
  | 'escalate' | 'escalate_to_human' | 'refuse' | 'refused';

export interface AgentVerification {
  /** Did the agent actually exercise the fix, or only propose it? */
  passed?: boolean;
  /** Named checks the agent ran. */
  checks?: Array<{
    name?: string;
    status?: 'passed' | 'failed' | 'skipped' | string;
    detail?: string;
    duration_ms?: number;
  }>;
  /** Free-text description of how the fix was validated. */
  method?: string;
  tests_run?: number;
  tests_passed?: number;
}

export interface AgentOutputPayload {
  /** The only genuinely required field. */
  action: AgentAction;
  /** 0-1 or 0-100. */
  confidence?: number;
  /** Unified diff text. Parsed into hunks by the adapter. */
  fix_diff?: string | null;
  verification?: AgentVerification | null;
  /** Bilingual explanation. This is what the EN/UR toggle renders. */
  explanation_en?: string;
  explanation_ur?: string;
  /** Populated when action is escalate — why the agent would not decide. */
  escalation_reason?: string | null;
  pr_url?: string | null;

  /** ❓ Confirm: does the agent emit a one-line consequence? The dashboard
   *  leads with this, so if it is absent the adapter derives a fallback. */
  prevents?: string;
  prevents_ur?: string;
  /** ❓ Confirm: per-step trace. If the Agentic Layer can emit this, the
   *  reasoning view uses it verbatim instead of synthesising steps. */
  reasoning_log?: ReasoningLogEntry[];
  file_path?: string;
  title?: string;
}

/**
 * Optional richer trace. If the Agentic Layer emits this, the reasoning view
 * renders the agent's real steps rather than steps derived from the risk
 * payload — which is strictly better, so ask for it if it is cheap to add.
 */
export interface ReasoningLogEntry {
  /** detect | historical | dependency | impact | confidence | decision */
  stage?: string;
  claim?: string;
  claim_ur?: string;
  evidence?: string[];
  evidence_ur?: string[];
  /** Running confidence after this step, 0-1 or 0-100. */
  confidence_after?: number;
  duration_ms?: number;
  citations?: Array<{ label?: string; href?: string; kind?: string }>;
}

// ---------------------------------------------------------------------------
// 3. What the gateway returns per analysed run
// ---------------------------------------------------------------------------

/**
 * ❓ Confirm with Platform/Infra: does the FastAPI gateway return these two
 * objects together per run (as below), or must the dashboard fetch and join
 * them separately? The dashboard currently assumes joined, which is one fewer
 * round trip during a live demo.
 */
export interface PipelineRunAnalysis {
  run_id: string;
  repo: string;
  workflow: string;
  commit?: string;
  commit_message?: string;
  author?: string;
  branch?: string;
  started_at?: string;
  status?: 'queued' | 'analyzing' | 'deciding' | 'complete' | 'failed' | string;
  risk: RiskScorePayload;
  agent: AgentOutputPayload | null;
}

export interface RunFeedResponse {
  runs: PipelineRunAnalysis[];
  gateway_version?: string;
}
