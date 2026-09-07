/**
 * Adapter for the Archive A FastAPI response.
 *
 * This file is deliberately separate from the richer demo/replay adapter.
 * Live responses can be minimal or incomplete, so every optional value stays
 * nullable and every score conversion requires an explicit source scale.
 */

export type BackendAction =
  | 'AUTO_FIX'
  | 'PROPOSE_WITH_CAUTION'
  | 'ESCALATE_TO_HUMAN';

export interface BackendReason {
  message?: string;
  reason?: string;
  code?: string;
  severity?: string;
  weight?: number;
  file?: string;
  line?: number;
}

export interface BackendVerification {
  passed?: boolean;
  status?: string;
  method?: string;
  checks?: Array<{
    name?: string;
    status?: string;
    detail?: string;
    duration_ms?: number;
  }>;
  tests_run?: number;
  tests_passed?: number;
}

export interface BackendAnalyzeResponse {
  repo?: string | null;
  risk?: {
    status?: string;
    risk_score?: number;
    confidence?: number | null;
    reasons?: Array<BackendReason | string> | null;
    affected_jobs?: string[] | null;
    graph_path?: unknown[] | null;
    model_breakdown?: Record<string, unknown> | null;
    [key: string]: unknown;
  } | null;
  detection_status?: string | null;
  agentic_evidence_status?: string | null;
  detection_metadata?: {
    available_evidence?: string[];
    missing_evidence?: string[];
    risk_score_scale?: string;
    validation_errors?: unknown[];
    source?: string;
    contract_version?: string;
  } | null;
  source?: string | null;
  run_id?: string | null;
  agentic_result?: Record<string, unknown> | null;
  agent?: {
    action?: string | null;
    deterministic_action?: string | null;
    confidence?: number | null;
    decision_reason?: string | null;
    fix_diff?: string | null;
    verification?: BackendVerification | null;
    explanation_en?: string | null;
    explanation_ur?: string | null;
    review_items?: unknown[] | null;
    human_review_required?: boolean | null;
    warnings?: unknown[] | null;
    error?: string | null;
    pr_url?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface BackendAssessmentView {
  repo: string | null;
  runId: string | null;
  source: string | null;
  detection: {
    status: string | null;
    riskScore: number | null;
    riskScoreScale: string | null;
    displayRiskScore: number | null;
    confidence: number | null;
    reasons: Array<BackendReason | string> | null;
    affectedJobs: string[] | null;
    graphPath: unknown[] | null;
    modelBreakdown: Record<string, unknown> | null;
    availableEvidence: string[];
    missingEvidence: string[];
    validationErrors: unknown[];
    error: string | null;
    succeeded: boolean;
  };
  agentic: {
    evidenceStatus: string | null;
    action: BackendAction | null;
    deterministicAction: BackendAction | null;
    confidence: number | null;
    decisionReason: string | null;
    fixDiff: string | null;
    verification: BackendVerification | null;
    explanationEn: string | null;
    explanationUr: string | null;
    reviewItems: unknown[] | null;
    humanReviewRequired: boolean | null;
    warnings: unknown[] | null;
    error: string | null;
    prUrl: string | null;
  };
}

const ACTIONS = new Set<BackendAction>([
  'AUTO_FIX',
  'PROPOSE_WITH_CAUTION',
  'ESCALATE_TO_HUMAN',
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function action(value: unknown): BackendAction | null {
  return typeof value === 'string' && ACTIONS.has(value as BackendAction)
    ? value as BackendAction
    : null;
}

function displayScore(score: number | null, scale: string | null): number | null {
  if (score === null) return null;
  if (scale === '0-1') return Math.round(score * 100);
  if (scale === '0-100') return Math.round(score);
  return null;
}

/**
 * Convert the response without adding defaults for missing evidence.
 * Unknown input is accepted so a malformed gateway response can be shown as
 * an invalid/incomplete state instead of crashing the page.
 */
export function adaptBackendAnalysis(input: unknown): BackendAssessmentView {
  const payload = record(input);
  const risk = record(payload.risk);
  const agent = record(payload.agent);
  const metadata = record(payload.detection_metadata);
  const scale = stringOrNull(
    metadata.risk_score_scale ?? risk.risk_score_scale,
  );
  const riskScore = finiteNumber(risk.risk_score);
  const detectionStatus = stringOrNull(
    payload.detection_status ?? risk.detection_status ?? risk.status,
  );
  const availableEvidence = stringList(
    metadata.available_evidence ?? risk.available_evidence,
  );
  const missingEvidence = stringList(
    metadata.missing_evidence ?? risk.missing_evidence,
  );
  const status = stringOrNull(risk.status);

  return {
    repo: stringOrNull(payload.repo),
    runId: stringOrNull(payload.run_id),
    source: stringOrNull(payload.source),
    detection: {
      status,
      riskScore,
      riskScoreScale: scale,
      displayRiskScore: displayScore(riskScore, scale),
      confidence: finiteNumber(risk.confidence),
      reasons: Array.isArray(risk.reasons) ? risk.reasons as Array<BackendReason | string> : null,
      affectedJobs: Array.isArray(risk.affected_jobs) ? risk.affected_jobs.filter(
        (item): item is string => typeof item === 'string',
      ) : null,
      graphPath: Array.isArray(risk.graph_path) ? risk.graph_path : null,
      modelBreakdown: risk.model_breakdown && typeof risk.model_breakdown === 'object'
        && !Array.isArray(risk.model_breakdown)
        ? risk.model_breakdown as Record<string, unknown>
        : null,
      availableEvidence,
      missingEvidence,
      validationErrors: Array.isArray(metadata.validation_errors)
        ? metadata.validation_errors
        : Array.isArray(risk.validation_errors) ? risk.validation_errors : [],
      error: stringOrNull(payload.error ?? risk.error),
      succeeded: status === 'clean' || status === 'suspicious' || status === 'malicious',
    },
    agentic: {
      evidenceStatus: stringOrNull(payload.agentic_evidence_status),
      action: action(agent.action),
      deterministicAction: action(agent.deterministic_action),
      confidence: finiteNumber(agent.confidence),
      decisionReason: stringOrNull(agent.decision_reason),
      fixDiff: stringOrNull(agent.fix_diff),
      verification: agent.verification && typeof agent.verification === 'object'
        ? agent.verification as BackendVerification
        : null,
      explanationEn: stringOrNull(agent.explanation_en),
      explanationUr: stringOrNull(agent.explanation_ur),
      reviewItems: Array.isArray(agent.review_items) ? agent.review_items : null,
      humanReviewRequired: typeof agent.human_review_required === 'boolean'
        ? agent.human_review_required
        : null,
      warnings: Array.isArray(agent.warnings) ? agent.warnings : null,
      error: stringOrNull(agent.error),
      prUrl: stringOrNull(agent.pr_url),
    },
  };
}