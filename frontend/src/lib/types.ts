/**
 * PipelineGuard domain model.
 *
 * This file is the contract between the UI and the gateway. When Workstream 3
 * confirms the FastAPI response shape, this is the only file that needs to
 * change -- the mock server in src/lib/mock and the real gateway both satisfy
 * these types, so the UI cannot tell them apart.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * The three outcomes the agent is allowed to reach. There is no fourth.
 * `refused` is a first-class result, not an error state -- an agent that
 * cannot refuse is an agent that cannot be trusted to act.
 */
export type Decision = 'auto_fixed' | 'flagged' | 'refused';

export type RunStatus = 'passed' | 'failed' | 'running' | 'cancelled';

/** Every user-facing narrative string is bilingual. Urdu is a product
 *  requirement, not a localisation afterthought: the point is that a junior
 *  engineer reads the *reasoning*, not a red error code. */
export interface Bilingual {
  en: string;
  ur: string;
}

export type Locale = 'en' | 'ur';

// ---------------------------------------------------------------------------
// Reasoning
// ---------------------------------------------------------------------------

/**
 * The kinds of step in a reasoning chain, in the order the agent performs
 * them. The UI renders them as a vertical rail so the chain reads as one
 * argument rather than six disconnected cards.
 */
export type StepKind =
  | 'detect'      // what was observed, syntactically
  | 'historical'  // what past runs say about changes like this
  | 'dependency'  // what the graph says this touches
  | 'impact'      // what breaks if the observation is real
  | 'confidence'  // how the evidence aggregates, and what is still missing
  | 'decision';   // act / flag / refuse, and why

export interface Citation {
  /** Short label rendered as a chip, e.g. "run #1184" or ".github/workflows/deploy-prod.yml:24". */
  label: string;
  /** Where the chip navigates. Null for evidence with no drill-down. */
  href: string | null;
  kind: 'run' | 'file' | 'commit' | 'job' | 'policy' | 'incident';
}

export interface ReasoningStep {
  id: string;
  kind: StepKind;
  /** One-line heading, e.g. "Cross-referenced job graph". */
  title: Bilingual;
  /** The claim this step establishes. */
  claim: Bilingual;
  /**
   * The support for the claim. Rendered as "because ..." bullets. A step
   * with an empty `because` array is a red flag and the UI says so.
   */
  because: Bilingual[];
  /** Evidence chips, each linking to the underlying artefact. */
  citations: Citation[];
  /** Running confidence after this step, 0-100. Drives the confidence spark. */
  confidenceAfter: number;
  /** Signed change contributed by this step. Negative steps are the honest ones. */
  confidenceDelta: number;
  /** Wall-clock cost of this step, used for replay timing fidelity. */
  durationMs: number;
}

/** What the agent still does not know. Shown on refusals and on low-confidence
 *  flags -- naming the gap is what separates judgement from guessing. */
export interface EvidenceGap {
  missing: Bilingual;
  /** The specific observation that would resolve it. */
  wouldResolve: Bilingual;
  /** Can PipelineGuard obtain this itself, or does it need a human? */
  obtainableByAgent: boolean;
}

export interface Hypothesis {
  label: Bilingual;
  /** Posterior probability, 0-1. Competing hypotheses within ~15 points are
   *  what trigger a refusal. */
  probability: number;
  supports: Bilingual[];
  contradicts: Bilingual[];
}

export interface Investigation {
  id: string;
  findingId: string;
  title: Bilingual;
  repo: string;
  pipeline: string;
  pipelineId: string;
  runId: string;
  commit: string;
  commitMessage: string;
  author: string;
  branch: string;
  filePath: string;
  severity: Severity;
  decision: Decision;
  /** Final confidence, 0-100. */
  confidence: number;
  startedAt: string;
  durationMs: number;
  steps: ReasoningStep[];
  /** Populated for auto_fixed and flagged. Null on refusal -- the agent does
   *  not draft a fix for a problem it cannot characterise. */
  fix: Fix | null;
  /** Populated for flagged and refused. */
  gaps: EvidenceGap[];
  /** Populated for refused: the competing readings it could not separate. */
  hypotheses: Hypothesis[];
  /** Thresholds in force for this investigation, so the decision is auditable. */
  thresholds: { autoFixFloor: number; recommendFloor: number };
  /** Prior changes the agent matched against. */
  similarChanges: SimilarChange[];
}

export interface SimilarChange {
  id: string;
  repo: string;
  commit: string;
  summary: Bilingual;
  daysAgo: number;
  /** What happened to the pipeline after that change shipped. */
  outcome: 'incident' | 'failed_build' | 'clean' | 'reverted';
  similarity: number; // 0-1
}

// ---------------------------------------------------------------------------
// Fixes
// ---------------------------------------------------------------------------

export interface Fix {
  id: string;
  investigationId: string;
  title: Bilingual;
  filePath: string;
  /** Unified-diff hunks, pre-parsed so the viewer does no parsing at runtime. */
  hunks: DiffHunk[];
  /**
   * The single most important string in the product. One sentence, concrete,
   * in the consequence domain -- not "improves security posture" but
   * "prevents unauthenticated write access to production secrets".
   */
  prevents: Bilingual;
  /** Why this fix and not a different one. */
  rationale: Bilingual;
  validation: FixValidation;
  status: 'proposed' | 'applied' | 'awaiting_review' | 'rejected' | 'reverted';
  pullRequest: PullRequestPreview | null;
  /** Set only when status is 'reverted'. */
  revertReason?: Bilingual;
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  /** Line number in the original file. Null for added lines. */
  oldLine: number | null;
  /** Line number in the patched file. Null for removed lines. */
  newLine: number | null;
  content: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FixValidation {
  /** Did the agent verify the fix, or only propose it? */
  verified: boolean;
  checks: ValidationCheck[];
  /** How the fix was exercised, in plain language. */
  method: Bilingual;
}

export interface ValidationCheck {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'not_applicable';
  detail: Bilingual;
  durationMs: number;
}

export interface PullRequestPreview {
  number: number;
  title: string;
  branch: string;
  baseBranch: string;
  body: Bilingual;
  reviewers: string[];
  state: 'draft' | 'open' | 'merged' | 'closed';
  additions: number;
  deletions: number;
  filesChanged: number;
}

// ---------------------------------------------------------------------------
// Pipelines, repos, runs
// ---------------------------------------------------------------------------

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  defaultBranch: string;
  private: boolean;
  language: string;
  pipelineCount: number;
  openFindings: number;
  criticalFindings: number;
  /** 0-100. Composite of finding density, fix latency, and run pass rate. */
  healthScore: number;
  lastActivity: string;
  monitored: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  repo: string;
  provider: 'github_actions' | 'gitlab_ci' | 'jenkins' | 'azure_devops';
  filePath: string;
  /** Does this pipeline reach a production environment? Drives blast radius. */
  touchesProduction: boolean;
  jobs: PipelineJob[];
  environments: string[];
  secretsUsed: string[];
  openFindings: number;
  passRate: number;
  lastRun: string;
  healthScore: number;
}

export interface PipelineJob {
  id: string;
  name: string;
  /** Job ids this job needs, i.e. graph edges. */
  needs: string[];
  /** Effective GITHUB_TOKEN permissions after workflow+job merge. */
  permissions: Record<string, 'read' | 'write' | 'none'>;
  secrets: string[];
  environment: string | null;
  steps: number;
  avgDurationMs: number;
  /** Findings anchored to this job. */
  findingIds: string[];
}

export interface PipelineRun {
  id: string;
  number: number;
  pipelineId: string;
  pipelineName: string;
  repo: string;
  status: RunStatus;
  branch: string;
  commit: string;
  commitMessage: string;
  author: string;
  startedAt: string;
  durationMs: number;
  /** 0-100, agent-assessed risk of the *configuration*, not the code. */
  riskScore: number;
  findingIds: string[];
  /** Agent decisions produced during this run. */
  decisions: Decision[];
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export type FindingStatus = 'open' | 'fixed' | 'accepted_risk' | 'in_review' | 'refused';

export interface Finding {
  id: string;
  ruleId: string;
  title: Bilingual;
  description: Bilingual;
  severity: Severity;
  status: FindingStatus;
  repo: string;
  pipelineId: string;
  pipelineName: string;
  filePath: string;
  line: number;
  jobId: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  investigationId: string | null;
  /** Blast radius summary, one line. */
  impact: Bilingual;
  category: 'permissions' | 'secrets' | 'supply_chain' | 'integrity' | 'policy' | 'exposure';
  cwe: string | null;
}

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  label: string;
  kind: 'job' | 'secret' | 'environment' | 'artifact' | 'registry' | 'external';
  /** Does a compromise here reach production? */
  production: boolean;
  /** Findings anchored here. */
  findingIds: string[];
  /** Layout column, computed server-side so the client does no graph layout. */
  column: number;
  row: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: 'needs' | 'reads_secret' | 'deploys_to' | 'publishes' | 'consumes' | 'calls';
  /** Highlighted when tracing blast radius. */
  tainted: boolean;
}

export interface DependencyGraph {
  pipelineId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export interface TrendPoint {
  date: string;
  /** ISO day label for the axis, e.g. "12 Aug". */
  label: string;
  passed: number;
  failed: number;
  /** Mean configuration risk across runs that day, 0-100. Should fall. */
  riskScore: number;
  findingsOpened: number;
  findingsResolved: number;
  autoFixed: number;
  flagged: number;
  refused: number;
  /** Mean time to resolution in hours. Should fall. */
  mttrHours: number;
  /** Marker for a narrative annotation on the chart. */
  annotation: Bilingual | null;
}

// ---------------------------------------------------------------------------
// Alerts, reviews, audit, policy, team
// ---------------------------------------------------------------------------

export interface Alert {
  id: string;
  title: Bilingual;
  severity: Severity;
  kind: 'pipeline' | 'permission' | 'security' | 'agent';
  repo: string;
  createdAt: string;
  read: boolean;
  investigationId: string | null;
  findingId: string | null;
  body: Bilingual;
}

export interface ReviewItem {
  id: string;
  fixId: string;
  investigationId: string;
  title: Bilingual;
  repo: string;
  severity: Severity;
  requestedAt: string;
  /** Why a human is in the loop for this one. */
  reason: Bilingual;
  requiredApprovals: number;
  approvals: string[];
  status: 'pending' | 'approved' | 'rejected' | 'info_requested';
  slaHoursRemaining: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actorKind: 'agent' | 'user' | 'system';
  action: string;
  target: string;
  detail: Bilingual;
  outcome: 'success' | 'failure' | 'refused';
}

export interface Policy {
  id: string;
  name: Bilingual;
  category: 'permissions' | 'secrets' | 'supply_chain' | 'deployment' | 'auto_fix' | 'review';
  enabled: boolean;
  /** Human-readable rule, and the machine form the agent evaluates. */
  statement: Bilingual;
  expression: string;
  enforcement: 'block' | 'warn' | 'audit';
  violations: number;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'security' | 'engineer' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  lastActive: string;
  reviewsCompleted: number;
}

export interface Integration {
  id: string;
  name: string;
  category: 'scm' | 'ci' | 'cloud' | 'notify';
  connected: boolean;
  detail: string;
  scopes: string[];
  connectedAt: string | null;
}

// ---------------------------------------------------------------------------
// Agent telemetry
// ---------------------------------------------------------------------------

export interface AgentStats {
  /** Decisions in the reporting window. */
  totalDecisions: number;
  autoFixed: number;
  flagged: number;
  refused: number;
  /** Of applied fixes, how many survived without revert. */
  fixSuccessRate: number;
  /** Of flagged items, how many humans agreed with the flag. */
  flagAgreementRate: number;
  /** Of refusals, how many a human later confirmed as genuinely ambiguous.
   *  This is the honesty metric: a high number means restraint was correct. */
  refusalVindicationRate: number;
  meanConfidence: number;
  meanInvestigationMs: number;
  reverts: number;
  /** Wrongly auto-fixed. The number the team is most accountable for. */
  falseAutoFixes: number;
}

export interface AgentActivity {
  id: string;
  at: string;
  decision: Decision;
  title: Bilingual;
  repo: string;
  confidence: number;
  investigationId: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export type SourceMode = 'live' | 'replay';

export interface RecordedRun {
  id: string;
  name: string;
  recordedAt: string;
  /** Total wall-clock of the original run, replayed at fidelity. */
  durationMs: number;
  investigationIds: string[];
  /** Number of cached gateway responses in this cassette. */
  responseCount: number;
  gatewayVersion: string;
  /** SHA of the cassette, so a demo can prove it was not edited mid-event. */
  checksum: string;
}
