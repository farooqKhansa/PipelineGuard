import type {
  Alert, AgentActivity, AgentStats, AuditEntry, DependencyGraph, Finding,
  Integration, Investigation, Pipeline, PipelineRun, Policy, RecordedRun,
  Repository, ReviewItem, TeamMember, TrendPoint,
} from '@/lib/types';
import { investigations } from './scenarios';
import { fixByInvestigation, fixes } from './fixes';

/** Wire fixes onto their investigations here, so scenarios.ts and fixes.ts
 *  stay free of circular imports. */
export const allInvestigations: Investigation[] = investigations.map((inv) => ({
  ...inv,
  fix: fixByInvestigation(inv.id),
}));

export const investigationById = (id: string) =>
  allInvestigations.find((i) => i.id === id) ?? null;

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export const repositories: Repository[] = [
  { id: 'repo_checkout', name: 'checkout-service', fullName: 'northwind/checkout-service', provider: 'github', defaultBranch: 'main', private: true, language: 'TypeScript', pipelineCount: 4, openFindings: 7, criticalFindings: 1, healthScore: 71, lastActivity: '2026-08-28T13:41:09Z', monitored: true },
  { id: 'repo_payments', name: 'payments-api', fullName: 'northwind/payments-api', provider: 'github', defaultBranch: 'main', private: true, language: 'Go', pipelineCount: 3, openFindings: 3, criticalFindings: 0, healthScore: 88, lastActivity: '2026-08-28T08:12:00Z', monitored: true },
  { id: 'repo_edge', name: 'edge-router', fullName: 'northwind/edge-router', provider: 'github', defaultBranch: 'main', private: true, language: 'Rust', pipelineCount: 2, openFindings: 2, criticalFindings: 0, healthScore: 92, lastActivity: '2026-08-27T16:30:00Z', monitored: true },
  { id: 'repo_ledger', name: 'ledger-worker', fullName: 'northwind/ledger-worker', provider: 'github', defaultBranch: 'main', private: true, language: 'Python', pipelineCount: 3, openFindings: 5, criticalFindings: 1, healthScore: 64, lastActivity: '2026-08-28T10:05:00Z', monitored: true },
  { id: 'repo_web', name: 'storefront-web', fullName: 'northwind/storefront-web', provider: 'github', defaultBranch: 'main', private: false, language: 'TypeScript', pipelineCount: 2, openFindings: 1, criticalFindings: 0, healthScore: 95, lastActivity: '2026-08-26T11:20:00Z', monitored: true },
  { id: 'repo_infra', name: 'infra-terraform', fullName: 'northwind/infra-terraform', provider: 'github', defaultBranch: 'main', private: true, language: 'HCL', pipelineCount: 2, openFindings: 4, criticalFindings: 0, healthScore: 78, lastActivity: '2026-08-25T09:40:00Z', monitored: false },
];

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

export const pipelines: Pipeline[] = [
  {
    id: 'pl_ci_checkout', name: 'CI', repo: 'northwind/checkout-service', provider: 'github_actions',
    filePath: '.github/workflows/ci.yml', touchesProduction: false,
    environments: [], secretsUsed: ['NPM_TOKEN'], openFindings: 2, passRate: 94,
    lastRun: '2026-08-28T09:14:22Z', healthScore: 82,
    jobs: [
      { id: 'lint', name: 'lint', needs: [], permissions: { contents: 'read' }, secrets: [], environment: null, steps: 4, avgDurationMs: 48000, findingIds: [] },
      { id: 'test', name: 'test', needs: [], permissions: { contents: 'read' }, secrets: [], environment: null, steps: 7, avgDurationMs: 158000, findingIds: ['PG-1042'] },
      { id: 'build', name: 'build', needs: ['lint', 'test'], permissions: { contents: 'read', packages: 'write' }, secrets: ['NPM_TOKEN'], environment: null, steps: 6, avgDurationMs: 121000, findingIds: ['PG-1051'] },
    ],
  },
  {
    id: 'pl_deploy_prod', name: 'Deploy (production)', repo: 'northwind/checkout-service', provider: 'github_actions',
    filePath: '.github/workflows/deploy-prod.yml', touchesProduction: true,
    environments: ['production'], secretsUsed: ['PROD_DEPLOY_KEY', 'AWS_ROLE_ARN', 'SLACK_WEBHOOK'],
    openFindings: 3, passRate: 88, lastRun: '2026-08-28T11:02:47Z', healthScore: 54,
    jobs: [
      { id: 'build', name: 'build', needs: [], permissions: { contents: 'write', packages: 'write', 'id-token': 'write', issues: 'write', deployments: 'write' }, secrets: [], environment: null, steps: 6, avgDurationMs: 143000, findingIds: ['PG-1043'] },
      { id: 'smoke-test', name: 'smoke-test', needs: ['build'], permissions: { contents: 'write', packages: 'write', 'id-token': 'write', issues: 'write', deployments: 'write' }, secrets: [], environment: null, steps: 3, avgDurationMs: 62000, findingIds: ['PG-1043'] },
      { id: 'deploy', name: 'deploy', needs: ['build', 'smoke-test'], permissions: { contents: 'write', packages: 'write', 'id-token': 'write', issues: 'write', deployments: 'write' }, secrets: ['PROD_DEPLOY_KEY', 'AWS_ROLE_ARN'], environment: 'production', steps: 9, avgDurationMs: 214000, findingIds: ['PG-1043', 'PG-1047'] },
      { id: 'notify', name: 'notify', needs: ['deploy'], permissions: { contents: 'write', packages: 'write', 'id-token': 'write', issues: 'write', deployments: 'write' }, secrets: ['SLACK_WEBHOOK'], environment: null, steps: 2, avgDurationMs: 8000, findingIds: ['PG-1043'] },
      { id: 'rollback-guard', name: 'rollback-guard', needs: ['deploy'], permissions: { contents: 'write', packages: 'write', 'id-token': 'write', issues: 'write', deployments: 'write' }, secrets: [], environment: null, steps: 3, avgDurationMs: 24000, findingIds: ['PG-1043'] },
    ],
  },
  {
    id: 'pl_release', name: 'Release', repo: 'northwind/checkout-service', provider: 'github_actions',
    filePath: '.github/workflows/release.yml', touchesProduction: false,
    environments: [], secretsUsed: ['GITHUB_TOKEN'], openFindings: 2, passRate: 91,
    lastRun: '2026-08-28T13:41:09Z', healthScore: 68,
    jobs: [
      { id: 'tag', name: 'tag', needs: [], permissions: { contents: 'write' }, secrets: [], environment: null, steps: 3, avgDurationMs: 18000, findingIds: [] },
      { id: 'notify', name: 'notify', needs: ['tag'], permissions: { contents: 'read' }, secrets: [], environment: null, steps: 2, avgDurationMs: 6000, findingIds: ['PG-1044'] },
    ],
  },
  {
    id: 'pl_ci_payments', name: 'CI', repo: 'northwind/payments-api', provider: 'github_actions',
    filePath: '.github/workflows/ci.yml', touchesProduction: false,
    environments: [], secretsUsed: [], openFindings: 1, passRate: 97,
    lastRun: '2026-08-28T08:12:00Z', healthScore: 90,
    jobs: [
      { id: 'test', name: 'test', needs: [], permissions: { contents: 'read' }, secrets: [], environment: null, steps: 5, avgDurationMs: 92000, findingIds: [] },
      { id: 'build', name: 'build', needs: ['test'], permissions: { contents: 'read', packages: 'write' }, secrets: [], environment: null, steps: 4, avgDurationMs: 78000, findingIds: ['PG-1049'] },
    ],
  },
  {
    id: 'pl_ci_ledger', name: 'CI + Deploy', repo: 'northwind/ledger-worker', provider: 'gitlab_ci',
    filePath: '.gitlab-ci.yml', touchesProduction: true,
    environments: ['staging', 'production'], secretsUsed: ['DB_MIGRATION_KEY'],
    openFindings: 4, passRate: 82, lastRun: '2026-08-28T10:05:00Z', healthScore: 61,
    jobs: [
      { id: 'test', name: 'test', needs: [], permissions: { contents: 'read' }, secrets: [], environment: null, steps: 4, avgDurationMs: 110000, findingIds: [] },
      { id: 'migrate', name: 'migrate', needs: ['test'], permissions: { contents: 'read' }, secrets: ['DB_MIGRATION_KEY'], environment: 'production', steps: 3, avgDurationMs: 44000, findingIds: ['PG-1052', 'PG-1053'] },
    ],
  },
];

export const pipelineById = (id: string) => pipelines.find((p) => p.id === id) ?? null;

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export const findings: Finding[] = [
  {
    id: 'PG-1042', ruleId: 'SUP.ACTION_MUTABLE_REF',
    title: { en: 'Third-party actions pinned to mutable tags', ur: 'تھرڈ پارٹی ایکشنز قابلِ تبدیل ٹیگ سے منسلک' },
    description: { en: 'Two actions are referenced by tag rather than commit SHA, allowing upstream code to change without any commit in this repository.', ur: 'دو ایکشنز کمِٹ SHA کے بجائے ٹیگ سے منسلک ہیں، جس سے اپ اسٹریم کوڈ اس ریپوزٹری میں کوئی کمِٹ کیے بغیر تبدیل ہو سکتا ہے۔' },
    severity: 'medium', status: 'fixed', repo: 'northwind/checkout-service',
    pipelineId: 'pl_ci_checkout', pipelineName: 'CI', filePath: '.github/workflows/ci.yml', line: 34,
    jobId: 'test', detectedAt: '2026-08-28T09:14:22Z', resolvedAt: '2026-08-28T09:14:29Z',
    investigationId: 'inv_8f21a4', category: 'supply_chain', cwe: 'CWE-1357',
    impact: { en: 'Upstream code change reaches the artifact consumed by a job holding packages: write.', ur: 'اپ اسٹریم کوڈ کی تبدیلی اُس آرٹیفیکٹ تک پہنچتی ہے جسے packages: write والی جاب استعمال کرتی ہے۔' },
  },
  {
    id: 'PG-1043', ruleId: 'PERM.WRITE_ALL_ROOT',
    title: { en: 'permissions: write-all on a production deploy workflow', ur: 'پروڈکشن ڈیپلائے ورک فلو پر permissions: write-all' },
    description: { en: 'An explicit four-scope permissions block was replaced with write-all at workflow root, applying to all five jobs.', ur: 'چار مخصوص اجازتوں کے بلاک کو ورک فلو کی جڑ پر write-all سے بدل دیا گیا، جو پانچوں جابز پر لاگو ہوتا ہے۔' },
    severity: 'critical', status: 'in_review', repo: 'northwind/checkout-service',
    pipelineId: 'pl_deploy_prod', pipelineName: 'Deploy (production)', filePath: '.github/workflows/deploy-prod.yml', line: 12,
    jobId: null, detectedAt: '2026-08-28T11:02:47Z', resolvedAt: null,
    investigationId: 'inv_c73e9b', category: 'permissions', cwe: 'CWE-266',
    impact: { en: 'Five jobs gain write access to production secrets, the container registry and three downstream services.', ur: 'پانچ جابز کو پروڈکشن سیکرٹس، کنٹینر رجسٹری اور تین ڈاؤن اسٹریم سروسز پر لکھنے کی رسائی ملتی ہے۔' },
  },
  {
    id: 'PG-1044', ruleId: 'EXP.UNRESOLVED_EGRESS',
    title: { en: 'Outbound POST of full event payload to an unresolvable host', ur: 'مکمل ایونٹ پے لوڈ کی ناقابلِ تعین میزبان کو ترسیل' },
    description: { en: 'A new job posts toJSON(github.event) to a URL held in an organisation variable the agent cannot read.', ur: 'ایک نئی جاب toJSON(github.event) کو ایسے URL پر بھیجتی ہے جو ایجنٹ کی پہنچ سے باہر تنظیمی ویری ایبل میں ہے۔' },
    severity: 'high', status: 'refused', repo: 'northwind/checkout-service',
    pipelineId: 'pl_release', pipelineName: 'Release', filePath: '.github/workflows/release.yml', line: 61,
    jobId: 'notify', detectedAt: '2026-08-28T13:41:09Z', resolvedAt: null,
    investigationId: 'inv_2a5d10', category: 'exposure', cwe: 'CWE-200',
    impact: { en: 'Impact is bimodal: routine notification, or continuous disclosure of committer emails and repository topology.', ur: 'اثر دو انتہاؤں پر ہے: معمول کی اطلاع، یا کمِٹرز کے ای میل اور ریپوزٹری ڈھانچے کا مسلسل افشا۔' },
  },
  {
    id: 'PG-1047', ruleId: 'SEC.SECRET_IN_LOGGED_ENV',
    title: { en: 'Secret exposed via env in a step that echoes environment', ur: 'ایسے سٹیپ میں سیکرٹ جو ماحول کو echo کرتا ہے' },
    description: { en: 'AWS_ROLE_ARN is set as a step-level env var in a job whose debug step prints the full environment when RUNNER_DEBUG is set.', ur: 'AWS_ROLE_ARN کو ایسی جاب میں سٹیپ کی سطح پر env کے طور پر رکھا گیا ہے جس کا ڈیبگ سٹیپ RUNNER_DEBUG آن ہونے پر پورا ماحول پرنٹ کرتا ہے۔' },
    severity: 'high', status: 'open', repo: 'northwind/checkout-service',
    pipelineId: 'pl_deploy_prod', pipelineName: 'Deploy (production)', filePath: '.github/workflows/deploy-prod.yml', line: 57,
    jobId: 'deploy', detectedAt: '2026-08-27T14:22:00Z', resolvedAt: null,
    investigationId: null, category: 'secrets', cwe: 'CWE-532',
    impact: { en: 'Role ARN disclosed in run logs readable by anyone with repository read access.', ur: 'رول ARN رن لاگز میں ظاہر ہوتا ہے جو ریپوزٹری تک پڑھنے کی رسائی رکھنے والا کوئی بھی دیکھ سکتا ہے۔' },
  },
  {
    id: 'PG-1049', ruleId: 'INT.ARTIFACT_NO_CHECKSUM',
    title: { en: 'Artifact consumed across jobs without integrity check', ur: 'جابز کے درمیان آرٹیفیکٹ بغیر سالمیت جانچ کے استعمال' },
    description: { en: 'Job build downloads an artifact produced by test and executes it without verifying a digest.', ur: 'جاب build وہ آرٹیفیکٹ ڈاؤن لوڈ کر کے چلاتی ہے جو test نے بنایا، بغیر ڈائجسٹ کی تصدیق کے۔' },
    severity: 'medium', status: 'open', repo: 'northwind/payments-api',
    pipelineId: 'pl_ci_payments', pipelineName: 'CI', filePath: '.github/workflows/ci.yml', line: 71,
    jobId: 'build', detectedAt: '2026-08-26T10:00:00Z', resolvedAt: null,
    investigationId: null, category: 'integrity', cwe: 'CWE-353',
    impact: { en: 'A tampered artifact from an earlier job executes inside a job holding packages: write.', ur: 'پہلی جاب کا تبدیل شدہ آرٹیفیکٹ ایسی جاب میں چلتا ہے جس کے پاس packages: write ہے۔' },
  },
  {
    id: 'PG-1051', ruleId: 'PERM.UNUSED_SCOPE',
    title: { en: 'Job holds packages: write but publishes nothing', ur: 'جاب کے پاس packages: write ہے مگر وہ کچھ شائع نہیں کرتی' },
    description: { en: 'Job build has held packages: write for 60 days without a single publish call in any run.', ur: 'جاب build ۶۰ دن سے packages: write رکھتی ہے مگر کسی رن میں ایک بار بھی publish کال نہیں ہوئی۔' },
    severity: 'low', status: 'open', repo: 'northwind/checkout-service',
    pipelineId: 'pl_ci_checkout', pipelineName: 'CI', filePath: '.github/workflows/ci.yml', line: 58,
    jobId: 'build', detectedAt: '2026-08-24T09:00:00Z', resolvedAt: null,
    investigationId: null, category: 'permissions', cwe: 'CWE-272',
    impact: { en: 'Unnecessary standing write access to the package registry.', ur: 'پیکج رجسٹری پر غیر ضروری مستقل لکھنے کی رسائی۔' },
  },
  {
    id: 'PG-1052', ruleId: 'POL.MISSING_APPROVAL_GATE',
    title: { en: 'Production migration runs without an approval gate', ur: 'پروڈکشن مائیگریشن بغیر منظوری گیٹ کے چلتی ہے' },
    description: { en: 'Job migrate targets environment production but the environment has no required reviewers configured.', ur: 'جاب migrate کا ہدف پروڈکشن ماحول ہے مگر اس ماحول کے لیے کوئی لازمی جائزہ کار مقرر نہیں۔' },
    severity: 'high', status: 'open', repo: 'northwind/ledger-worker',
    pipelineId: 'pl_ci_ledger', pipelineName: 'CI + Deploy', filePath: '.gitlab-ci.yml', line: 88,
    jobId: 'migrate', detectedAt: '2026-08-25T12:00:00Z', resolvedAt: null,
    investigationId: null, category: 'policy', cwe: null,
    impact: { en: 'Any merge to main can apply an irreversible schema change to production with no human gate.', ur: 'main میں کوئی بھی مرج، بغیر انسانی گیٹ کے، پروڈکشن پر ناقابلِ واپسی سکیما تبدیلی لاگو کر سکتا ہے۔' },
  },
  {
    id: 'PG-1053', ruleId: 'SEC.LONG_LIVED_CREDENTIAL',
    title: { en: 'Long-lived static credential where OIDC is available', ur: 'جہاں OIDC دستیاب ہے وہاں طویل المدت جامد کریڈنشل' },
    description: { en: 'DB_MIGRATION_KEY is a static secret rotated 214 days ago; the provider supports short-lived OIDC federation.', ur: 'DB_MIGRATION_KEY ایک جامد سیکرٹ ہے جو ۲۱۴ دن پہلے تبدیل ہوا؛ فراہم کنندہ قلیل المدت OIDC فیڈریشن کی سہولت دیتا ہے۔' },
    severity: 'medium', status: 'accepted_risk', repo: 'northwind/ledger-worker',
    pipelineId: 'pl_ci_ledger', pipelineName: 'CI + Deploy', filePath: '.gitlab-ci.yml', line: 94,
    jobId: 'migrate', detectedAt: '2026-08-20T09:00:00Z', resolvedAt: null,
    investigationId: null, category: 'secrets', cwe: 'CWE-798',
    impact: { en: 'A leaked key grants production database write access until manually rotated.', ur: 'کلید لیک ہونے پر دستی تبدیلی تک پروڈکشن ڈیٹابیس پر لکھنے کی رسائی رہتی ہے۔' },
  },
];

export const findingById = (id: string) => findings.find((f) => f.id === id) ?? null;

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

const runSeed: Array<[number, string, string, string, string, PipelineRun['status'], number, string[], PipelineRun['decisions']]> = [
  [1209, 'pl_release', 'Release', '9ac4e22', 'feat: notify downstream on release', 'passed', 61, ['PG-1044'], ['refused']],
  [1208, 'pl_deploy_prod', 'Deploy (production)', 'e17d3f0', 'fix: deploy failing on release notes step', 'failed', 88, ['PG-1043'], ['flagged']],
  [1207, 'pl_ci_checkout', 'CI', '4b91c07', 'chore: speed up test job with cache', 'passed', 34, ['PG-1042'], ['auto_fixed']],
  [1206, 'pl_ci_checkout', 'CI', 'd3a8710', 'refactor: extract cart totals', 'passed', 18, [], []],
  [1205, 'pl_ci_payments', 'CI', '1f0cc42', 'feat: idempotency keys on capture', 'passed', 22, [], []],
  [1204, 'pl_ci_checkout', 'CI', 'bb70e19', 'test: cover discount edge cases', 'passed', 19, [], []],
  [1203, 'pl_ci_ledger', 'CI + Deploy', '05ad9c3', 'fix: retry on transient lock', 'failed', 57, ['PG-1052'], ['flagged']],
  [1202, 'pl_ci_checkout', 'CI', 'c410f88', 'chore: bump node to 20', 'passed', 21, [], []],
  [1201, 'pl_deploy_prod', 'Deploy (production)', '77b2ea5', 'release: v4.11.0', 'passed', 41, [], []],
  [1200, 'pl_ci_payments', 'CI', '9de1004', 'perf: batch ledger writes', 'passed', 24, [], []],
  [1199, 'pl_ci_checkout', 'CI', '2ba7f31', 'fix: null guard on promo code', 'passed', 20, [], []],
  [1198, 'pl_ci_ledger', 'CI + Deploy', 'e8c0a17', 'chore: pin base image', 'passed', 29, [], ['auto_fixed']],
  [1191, 'pl_ci_checkout', 'CI', '55d3c09', 'chore: update changed-files usage', 'passed', 37, [], []],
  [1184, 'pl_ci_checkout', 'CI', 'af61b22', 'ci: add coverage upload', 'passed', 33, [], []],
];

export const runs: PipelineRun[] = runSeed.map(([number, pipelineId, pipelineName, commit, msg, status, risk, findingIds, decisions], i) => ({
  id: `run_${number}`,
  number,
  pipelineId,
  pipelineName,
  repo: pipelines.find((p) => p.id === pipelineId)?.repo ?? 'northwind/checkout-service',
  status,
  branch: i < 3 ? ['feat/release-webhook', 'hotfix/deploy-perms', 'feat/test-cache'][i] : 'main',
  commit,
  commitMessage: msg,
  author: ['hamna.m', 'hamna.m', 'khansa.f', 'sara.a', 'faiza.m', 'khansa.f', 'sara.a', 'khansa.f', 'hamna.m', 'faiza.m', 'khansa.f', 'sara.a', 'khansa.f', 'faiza.m'][i],
  startedAt: new Date(Date.parse('2026-08-28T13:41:09Z') - i * 5_400_000).toISOString(),
  durationMs: 180_000 + ((i * 37_000) % 220_000),
  riskScore: risk,
  findingIds,
  decisions,
}));

export const runById = (id: string) => runs.find((r) => r.id === id) ?? null;

// ---------------------------------------------------------------------------
// Trends — a 14-day story, not a snapshot.
//
// The shape is deliberate: risk starts high and falls, resolved overtakes
// opened around day 6, and MTTR collapses once auto-fix is enabled on day 4.
// Annotated points carry the narrative so the chart argues rather than decorates.
// ---------------------------------------------------------------------------

const trendSeed: Array<[string, number, number, number, number, number, number, number, number, number, [string, string] | null]> = [
  // label, passed, failed, risk, opened, resolved, autoFixed, flagged, refused, mttr, annotation
  ['15 Aug', 9, 5, 78, 6, 1, 0, 0, 0, 46, ['PipelineGuard connected — observation only, no actions taken', 'PipelineGuard منسلک — صرف مشاہدہ، کوئی کارروائی نہیں']],
  ['16 Aug', 11, 4, 76, 5, 2, 0, 0, 0, 44, null],
  ['17 Aug', 10, 5, 74, 7, 2, 0, 1, 0, 43, null],
  ['18 Aug', 12, 3, 71, 4, 3, 0, 2, 1, 41, ['Baseline learned from 180 days of history', '۱۸۰ دن کی ہسٹری سے بنیادی معیار سیکھا گیا']],
  ['19 Aug', 13, 3, 66, 5, 6, 2, 2, 0, 33, ['Auto-fix enabled for non-production pipelines', 'غیر پروڈکشن پائپ لائنز کے لیے خودکار درستگی فعال']],
  ['20 Aug', 14, 2, 61, 4, 7, 4, 1, 1, 27, null],
  ['21 Aug', 15, 2, 57, 3, 6, 4, 2, 0, 22, null],
  ['22 Aug', 13, 3, 54, 5, 5, 3, 1, 1, 20, null],
  ['23 Aug', 16, 1, 49, 2, 6, 5, 1, 0, 17, ['Resolved overtakes opened for the first time', 'پہلی بار حل شدہ مسائل، نئے مسائل سے زیادہ']],
  ['24 Aug', 17, 1, 45, 3, 5, 4, 1, 0, 15, null],
  ['25 Aug', 16, 2, 42, 4, 6, 4, 1, 1, 14, null],
  ['26 Aug', 18, 1, 38, 2, 5, 4, 1, 0, 12, null],
  ['27 Aug', 18, 1, 35, 3, 4, 3, 1, 0, 11, null],
  ['28 Aug', 19, 2, 31, 3, 5, 3, 1, 1, 9, ['Three-outcome demo window — all agent paths exercised', 'تین نتائج کا مظاہرہ — ایجنٹ کے تینوں راستے آزمائے گئے']],
];

export const trends: TrendPoint[] = trendSeed.map(([label, passed, failed, riskScore, findingsOpened, findingsResolved, autoFixed, flagged, refused, mttrHours, annotation], i) => ({
  date: new Date(Date.parse('2026-08-15T00:00:00Z') + i * 86_400_000).toISOString(),
  label, passed, failed, riskScore, findingsOpened, findingsResolved, autoFixed, flagged, refused, mttrHours,
  annotation: annotation ? { en: annotation[0], ur: annotation[1] } : null,
}));

// ---------------------------------------------------------------------------
// Dependency graph — laid out server-side (column/row), so the client renders
// SVG without running a layout algorithm.
// ---------------------------------------------------------------------------

export const graphs: Record<string, DependencyGraph> = {
  pl_deploy_prod: {
    pipelineId: 'pl_deploy_prod',
    nodes: [
      { id: 'build', label: 'build', kind: 'job', production: false, findingIds: ['PG-1043'], column: 0, row: 1 },
      { id: 'smoke-test', label: 'smoke-test', kind: 'job', production: false, findingIds: ['PG-1043'], column: 1, row: 1 },
      { id: 'deploy', label: 'deploy', kind: 'job', production: true, findingIds: ['PG-1043', 'PG-1047'], column: 2, row: 1 },
      { id: 'notify', label: 'notify', kind: 'job', production: false, findingIds: ['PG-1043'], column: 3, row: 0 },
      { id: 'rollback-guard', label: 'rollback-guard', kind: 'job', production: false, findingIds: ['PG-1043'], column: 3, row: 2 },
      { id: 'sec_prod_key', label: 'PROD_DEPLOY_KEY', kind: 'secret', production: true, findingIds: [], column: 1, row: 3 },
      { id: 'sec_aws', label: 'AWS_ROLE_ARN', kind: 'secret', production: true, findingIds: ['PG-1047'], column: 1, row: 4 },
      { id: 'sec_slack', label: 'SLACK_WEBHOOK', kind: 'secret', production: false, findingIds: [], column: 2, row: 4 },
      { id: 'env_prod', label: 'production', kind: 'environment', production: true, findingIds: [], column: 3, row: 3 },
      { id: 'reg_ghcr', label: 'ghcr.io/northwind', kind: 'registry', production: true, findingIds: [], column: 4, row: 2 },
      { id: 'svc_payments', label: 'payments-api', kind: 'external', production: true, findingIds: [], column: 4, row: 3 },
      { id: 'svc_edge', label: 'edge-router', kind: 'external', production: true, findingIds: [], column: 4, row: 4 },
      { id: 'svc_ledger', label: 'ledger-worker', kind: 'external', production: true, findingIds: [], column: 4, row: 5 },
    ],
    edges: [
      { from: 'build', to: 'smoke-test', kind: 'needs', tainted: true },
      { from: 'smoke-test', to: 'deploy', kind: 'needs', tainted: true },
      { from: 'build', to: 'deploy', kind: 'needs', tainted: true },
      { from: 'deploy', to: 'notify', kind: 'needs', tainted: true },
      { from: 'deploy', to: 'rollback-guard', kind: 'needs', tainted: true },
      { from: 'sec_prod_key', to: 'deploy', kind: 'reads_secret', tainted: true },
      { from: 'sec_aws', to: 'deploy', kind: 'reads_secret', tainted: true },
      { from: 'sec_slack', to: 'notify', kind: 'reads_secret', tainted: false },
      { from: 'deploy', to: 'env_prod', kind: 'deploys_to', tainted: true },
      { from: 'deploy', to: 'reg_ghcr', kind: 'publishes', tainted: true },
      { from: 'env_prod', to: 'svc_payments', kind: 'calls', tainted: true },
      { from: 'env_prod', to: 'svc_edge', kind: 'calls', tainted: true },
      { from: 'env_prod', to: 'svc_ledger', kind: 'calls', tainted: true },
    ],
  },
  pl_ci_checkout: {
    pipelineId: 'pl_ci_checkout',
    nodes: [
      { id: 'lint', label: 'lint', kind: 'job', production: false, findingIds: [], column: 0, row: 0 },
      { id: 'test', label: 'test', kind: 'job', production: false, findingIds: ['PG-1042'], column: 0, row: 2 },
      { id: 'art_cov', label: 'coverage-report', kind: 'artifact', production: false, findingIds: [], column: 1, row: 2 },
      { id: 'build', label: 'build', kind: 'job', production: false, findingIds: ['PG-1051'], column: 2, row: 1 },
      { id: 'sec_npm', label: 'NPM_TOKEN', kind: 'secret', production: false, findingIds: [], column: 1, row: 0 },
      { id: 'reg_npm', label: 'npm registry', kind: 'registry', production: false, findingIds: [], column: 3, row: 1 },
    ],
    edges: [
      { from: 'lint', to: 'build', kind: 'needs', tainted: false },
      { from: 'test', to: 'art_cov', kind: 'publishes', tainted: true },
      { from: 'art_cov', to: 'build', kind: 'consumes', tainted: true },
      { from: 'test', to: 'build', kind: 'needs', tainted: true },
      { from: 'sec_npm', to: 'build', kind: 'reads_secret', tainted: false },
      { from: 'build', to: 'reg_npm', kind: 'publishes', tainted: true },
    ],
  },
};

// ---------------------------------------------------------------------------
// Alerts, reviews, audit, policies, team, integrations, agent stats
// ---------------------------------------------------------------------------

export const alerts: Alert[] = [
  { id: 'al_1', title: { en: 'Critical: write-all permissions on production deploy', ur: 'شدید: پروڈکشن ڈیپلائے پر write-all اجازتیں' }, severity: 'critical', kind: 'permission', repo: 'northwind/checkout-service', createdAt: '2026-08-28T11:02:47Z', read: false, investigationId: 'inv_c73e9b', findingId: 'PG-1043', body: { en: 'A fix is drafted but held for review. Blast radius includes production secrets and three downstream services.', ur: 'حل تیار ہے مگر جائزے کے لیے روکا گیا ہے۔ اثر کے دائرے میں پروڈکشن سیکرٹس اور تین ڈاؤن اسٹریم سروسز شامل ہیں۔' } },
  { id: 'al_2', title: { en: 'Agent refused to act on an ambiguous change', ur: 'ایجنٹ نے مبہم تبدیلی پر کارروائی سے انکار کیا' }, severity: 'high', kind: 'agent', repo: 'northwind/checkout-service', createdAt: '2026-08-28T13:41:09Z', read: false, investigationId: 'inv_2a5d10', findingId: 'PG-1044', body: { en: 'Confidence 38%, below the recommendation floor. One question resolves it: what host does vars.WEBHOOK_URL point to?', ur: 'اعتماد ۳۸٪، سفارشی حد سے کم۔ ایک سوال اسے حل کر دے گا: vars.WEBHOOK_URL کس میزبان کی طرف اشارہ کرتا ہے؟' } },
  { id: 'al_3', title: { en: 'Auto-fix applied and merged', ur: 'خودکار درستگی لاگو اور مرج ہو گئی' }, severity: 'low', kind: 'agent', repo: 'northwind/checkout-service', createdAt: '2026-08-28T09:14:29Z', read: true, investigationId: 'inv_8f21a4', findingId: 'PG-1042', body: { en: 'Two actions pinned to SHA. Validated against run #1204 with byte-identical step outputs.', ur: 'دو ایکشنز SHA پر پن کیے گئے۔ رن #1204 کے مقابلے میں ہر سٹیپ کا نتیجہ بالکل یکساں رہا۔' } },
  { id: 'al_4', title: { en: 'Production migration has no approval gate', ur: 'پروڈکشن مائیگریشن کے لیے کوئی منظوری گیٹ نہیں' }, severity: 'high', kind: 'security', repo: 'northwind/ledger-worker', createdAt: '2026-08-25T12:00:00Z', read: true, investigationId: null, findingId: 'PG-1052', body: { en: 'Environment production has no required reviewers configured on the migrate job.', ur: 'migrate جاب پر پروڈکشن ماحول کے لیے کوئی لازمی جائزہ کار مقرر نہیں۔' } },
  { id: 'al_5', title: { en: 'Pipeline pass rate fell below 85% on ledger-worker', ur: 'ledger-worker پر پائپ لائن کامیابی کی شرح ۸۵٪ سے نیچے' }, severity: 'medium', kind: 'pipeline', repo: 'northwind/ledger-worker', createdAt: '2026-08-24T18:00:00Z', read: true, investigationId: null, findingId: null, body: { en: 'Pass rate 82% over the last 30 runs, driven by transient lock failures in the migrate job.', ur: 'گزشتہ ۳۰ رنز میں کامیابی کی شرح ۸۲٪، جس کی وجہ migrate جاب میں عارضی لاک ناکامیاں ہیں۔' } },
];

export const reviews: ReviewItem[] = [
  { id: 'rv_1', fixId: 'fix_c73e9b', investigationId: 'inv_c73e9b', title: { en: 'Restore least-privilege permissions on deploy-prod', ur: 'deploy-prod پر کم سے کم اجازتیں بحال کریں' }, repo: 'northwind/checkout-service', severity: 'critical', requestedAt: '2026-08-28T11:03:12Z', reason: { en: 'Policy PG-DEP-002 requires a human owner for any permission change on a production pipeline. One open question: what values can RELEASE_MODE take?', ur: 'پالیسی PG-DEP-002 کے تحت پروڈکشن پائپ لائن پر ہر اجازتی تبدیلی کے لیے انسانی مالک لازم ہے۔ ایک کھلا سوال: RELEASE_MODE کی ممکنہ اقدار کیا ہیں؟' }, requiredApprovals: 2, approvals: ['sara.a'], status: 'pending', slaHoursRemaining: 19 },
  { id: 'rv_2', fixId: '', investigationId: 'inv_2a5d10', title: { en: 'Answer needed: destination of vars.WEBHOOK_URL', ur: 'جواب درکار: vars.WEBHOOK_URL کی منزل' }, repo: 'northwind/checkout-service', severity: 'high', requestedAt: '2026-08-28T13:41:40Z', reason: { en: 'The agent refused to act and escalated a question rather than a verdict. No fix is attached by design.', ur: 'ایجنٹ نے کارروائی سے انکار کیا اور فیصلے کے بجائے سوال آگے بھیجا۔ جان بوجھ کر کوئی حل منسلک نہیں۔' }, requiredApprovals: 1, approvals: [], status: 'info_requested', slaHoursRemaining: 41 },
  { id: 'rv_3', fixId: '', investigationId: '', title: { en: 'Add approval gate to ledger-worker production migration', ur: 'ledger-worker پروڈکشن مائیگریشن میں منظوری گیٹ شامل کریں' }, repo: 'northwind/ledger-worker', severity: 'high', requestedAt: '2026-08-25T12:04:00Z', reason: { en: 'Environment-level change outside the agent write scope; requires an org admin.', ur: 'ماحول کی سطح کی تبدیلی ایجنٹ کے لکھنے کے دائرے سے باہر ہے؛ آرگ ایڈمن درکار۔' }, requiredApprovals: 1, approvals: [], status: 'pending', slaHoursRemaining: 4 },
];

export const auditLog: AuditEntry[] = [
  { id: 'au_1', at: '2026-08-28T13:41:40Z', actor: 'pipelineguard-agent', actorKind: 'agent', action: 'decision.refused', target: 'PG-1044', outcome: 'refused', detail: { en: 'Declined to act. Confidence 38% below recommendation floor 45%. Competing hypotheses 0.52 / 0.41.', ur: 'کارروائی سے انکار۔ اعتماد ۳۸٪، سفارشی حد ۴۵٪ سے کم۔ مدِمقابل مفروضے ۰.۵۲ / ۰.۴۱۔' } },
  { id: 'au_2', at: '2026-08-28T11:03:12Z', actor: 'pipelineguard-agent', actorKind: 'agent', action: 'fix.drafted', target: 'PG-1043', outcome: 'success', detail: { en: 'Drafted PR #487 and held it for review under policy PG-DEP-002.', ur: 'PR #487 تیار کیا اور پالیسی PG-DEP-002 کے تحت جائزے کے لیے روک لیا۔' } },
  { id: 'au_3', at: '2026-08-28T09:14:29Z', actor: 'pipelineguard-agent', actorKind: 'agent', action: 'fix.applied', target: 'PG-1042', outcome: 'success', detail: { en: 'Applied SHA pinning and merged PR #486 after validating against run #1204.', ur: 'SHA پننگ لاگو کی اور رن #1204 سے تصدیق کے بعد PR #486 مرج کیا۔' } },
  { id: 'au_4', at: '2026-08-28T09:14:22Z', actor: 'pipelineguard-agent', actorKind: 'agent', action: 'investigation.started', target: 'run_1207', outcome: 'success', detail: { en: 'Investigation inv_8f21a4 opened on commit 4b91c07.', ur: 'کمِٹ 4b91c07 پر تحقیقات inv_8f21a4 شروع کی گئی۔' } },
  { id: 'au_5', at: '2026-08-28T08:30:00Z', actor: 'sara.a', actorKind: 'user', action: 'review.approved', target: 'rv_0', outcome: 'success', detail: { en: 'Approved auto-fix policy change for non-production pipelines.', ur: 'غیر پروڈکشن پائپ لائنز کے لیے خودکار درستگی کی پالیسی تبدیلی منظور کی۔' } },
  { id: 'au_6', at: '2026-08-27T14:22:00Z', actor: 'pipelineguard-agent', actorKind: 'agent', action: 'finding.opened', target: 'PG-1047', outcome: 'success', detail: { en: 'Secret exposure detected in deploy job debug step.', ur: 'ڈیپلائے جاب کے ڈیبگ سٹیپ میں سیکرٹ کے افشا کی نشاندہی۔' } },
  { id: 'au_7', at: '2026-08-26T09:00:00Z', actor: 'system', actorKind: 'system', action: 'integration.connected', target: 'github', outcome: 'success', detail: { en: 'GitHub App installed on 6 repositories with contents:read and actions:read.', ur: 'GitHub ایپ ۶ ریپوزٹریز پر contents:read اور actions:read کے ساتھ نصب۔' } },
];

export const policies: Policy[] = [
  { id: 'pol_af_001', name: { en: 'Autonomous fixes on non-production pipelines', ur: 'غیر پروڈکشن پائپ لائنز پر خودکار درستگی' }, category: 'auto_fix', enabled: true, statement: { en: 'The agent may apply a fix without human approval when confidence is at or above 90%, the blast radius excludes production and all secrets, and the change is behaviour-preserving.', ur: 'ایجنٹ بغیر انسانی منظوری کے حل لاگو کر سکتا ہے جب اعتماد ۹۰٪ یا اس سے زیادہ ہو، اثر کا دائرہ پروڈکشن اور تمام سیکرٹس سے باہر ہو، اور تبدیلی رویّہ برقرار رکھے۔' }, expression: 'confidence >= 90 AND NOT blast_radius.production AND NOT blast_radius.secrets AND change.behaviour_preserving', enforcement: 'audit', violations: 0, updatedAt: '2026-08-19T10:00:00Z' },
  { id: 'pol_dep_002', name: { en: 'No autonomous permission changes on production', ur: 'پروڈکشن پر خودکار اجازتی تبدیلی ممنوع' }, category: 'deployment', enabled: true, statement: { en: 'The agent must never modify token permissions on a pipeline bound to a production environment, regardless of confidence. It may draft a fix and hold it for review.', ur: 'ایجنٹ پروڈکشن ماحول سے منسلک پائپ لائن پر ٹوکن اجازتیں کبھی تبدیل نہ کرے، اعتماد چاہے کتنا ہی ہو۔ وہ حل تیار کر کے جائزے کے لیے روک سکتا ہے۔' }, expression: 'pipeline.touches_production AND change.kind == "permissions" -> require_human_review', enforcement: 'block', violations: 1, updatedAt: '2026-08-19T10:00:00Z' },
  { id: 'pol_af_004', name: { en: 'Refuse below the recommendation floor', ur: 'سفارشی حد سے نیچے انکار' }, category: 'auto_fix', enabled: true, statement: { en: 'Below 45% confidence, or when the top two hypotheses are within 15 points, the agent must refuse: no fix, no risk score, escalate as a question.', ur: '۴۵٪ سے کم اعتماد پر، یا جب سرِفہرست دو مفروضوں میں ۱۵ پوائنٹ سے کم فرق ہو، ایجنٹ کو انکار کرنا ہوگا: نہ حل، نہ رِسک سکور، سوال کے طور پر آگے بھیجے۔' }, expression: 'confidence < 45 OR hypothesis_separation < 15 -> refuse', enforcement: 'block', violations: 0, updatedAt: '2026-08-18T09:00:00Z' },
  { id: 'pol_sup_001', name: { en: 'Third-party actions must be SHA-pinned', ur: 'تھرڈ پارٹی ایکشنز کا SHA پن ہونا لازم' }, category: 'supply_chain', enabled: true, statement: { en: 'Every third-party action reference must resolve to a commit SHA, not a tag or branch.', ur: 'ہر تھرڈ پارٹی ایکشن کا حوالہ کمِٹ SHA پر ہونا چاہیے، ٹیگ یا برانچ پر نہیں۔' }, expression: 'action.ref matches /^[0-9a-f]{40}$/', enforcement: 'warn', violations: 3, updatedAt: '2026-08-15T09:00:00Z' },
  { id: 'pol_perm_003', name: { en: 'No write-all token permissions', ur: 'write-all ٹوکن اجازتیں ممنوع' }, category: 'permissions', enabled: true, statement: { en: 'permissions: write-all is forbidden at workflow or job level in every monitored repository.', ur: 'ہر زیرِ نگرانی ریپوزٹری میں ورک فلو یا جاب کی سطح پر permissions: write-all ممنوع ہے۔' }, expression: 'permissions != "write-all"', enforcement: 'block', violations: 1, updatedAt: '2026-08-15T09:00:00Z' },
  { id: 'pol_sec_005', name: { en: 'Production secrets require OIDC where supported', ur: 'جہاں ممکن ہو، پروڈکشن سیکرٹس کے لیے OIDC لازم' }, category: 'secrets', enabled: false, statement: { en: 'Static long-lived credentials must be replaced by short-lived OIDC federation when the provider supports it.', ur: 'جہاں فراہم کنندہ سہولت دے، وہاں جامد طویل المدت کریڈنشلز کی جگہ قلیل المدت OIDC فیڈریشن لازم ہے۔' }, expression: 'secret.static AND provider.supports_oidc -> warn', enforcement: 'warn', violations: 2, updatedAt: '2026-08-22T14:00:00Z' },
];

export const policyById = (id: string) => policies.find((p) => p.id === id) ?? null;

export const team: TeamMember[] = [
  { id: 'u1', name: 'Sara Amin', email: 'saraamingul143@gmail.com', role: 'owner', status: 'active', lastActive: '2026-08-28T13:10:00Z', reviewsCompleted: 34 },
  { id: 'u2', name: 'Hamna Mushtaq', email: 'hamnamushtaq322@gmail.com', role: 'security', status: 'active', lastActive: '2026-08-28T13:41:00Z', reviewsCompleted: 41 },
  { id: 'u3', name: 'Khansa Farooq', email: 'khansa00608@gmail.com', role: 'engineer', status: 'active', lastActive: '2026-08-28T09:20:00Z', reviewsCompleted: 19 },
  { id: 'u4', name: 'Faiza Malik', email: 'faiza.malikfm1411@gmail.com', role: 'engineer', status: 'active', lastActive: '2026-08-27T17:00:00Z', reviewsCompleted: 12 },
];

export const integrations: Integration[] = [
  { id: 'int_github', name: 'GitHub', category: 'scm', connected: true, detail: '6 repositories, 1 organisation', scopes: ['contents:read', 'actions:read', 'pull_requests:write', 'checks:write'], connectedAt: '2026-08-15T09:00:00Z' },
  { id: 'int_gha', name: 'GitHub Actions', category: 'ci', connected: true, detail: '11 workflows monitored', scopes: ['workflows:read', 'runs:read'], connectedAt: '2026-08-15T09:00:00Z' },
  { id: 'int_gitlab', name: 'GitLab CI', category: 'ci', connected: true, detail: '1 project (ledger-worker)', scopes: ['read_api', 'read_repository'], connectedAt: '2026-08-20T11:00:00Z' },
  { id: 'int_alibaba', name: 'Alibaba Cloud', category: 'cloud', connected: true, detail: 'RAM role assumption, ap-southeast-1', scopes: ['ram:GetRole', 'actiontrail:LookupEvents'], connectedAt: '2026-08-21T08:00:00Z' },
  { id: 'int_slack', name: 'Slack', category: 'notify', connected: true, detail: '#security-alerts', scopes: ['chat:write'], connectedAt: '2026-08-16T10:00:00Z' },
  { id: 'int_jenkins', name: 'Jenkins', category: 'ci', connected: false, detail: 'Not connected', scopes: [], connectedAt: null },
  { id: 'int_azure', name: 'Azure DevOps', category: 'ci', connected: false, detail: 'Not connected', scopes: [], connectedAt: null },
  { id: 'int_bitbucket', name: 'Bitbucket', category: 'scm', connected: false, detail: 'Not connected', scopes: [], connectedAt: null },
];

export const agentStats: AgentStats = {
  totalDecisions: 47,
  autoFixed: 29,
  flagged: 13,
  refused: 5,
  fixSuccessRate: 96.6,
  flagAgreementRate: 84.6,
  refusalVindicationRate: 80.0,
  meanConfidence: 78.4,
  meanInvestigationMs: 9480,
  reverts: 1,
  falseAutoFixes: 1,
};

export const agentActivity: AgentActivity[] = [
  { id: 'aa_1', at: '2026-08-28T13:41:09Z', decision: 'refused', title: { en: 'Unresolvable outbound POST in release notify', ur: 'ریلیز نوٹیفائی میں ناقابلِ تعین باہر جانے والی POST' }, repo: 'northwind/checkout-service', confidence: 38, investigationId: 'inv_2a5d10', durationMs: 9640 },
  { id: 'aa_2', at: '2026-08-28T11:02:47Z', decision: 'flagged', title: { en: 'write-all permissions on production deploy', ur: 'پروڈکشن ڈیپلائے پر write-all اجازتیں' }, repo: 'northwind/checkout-service', confidence: 71, investigationId: 'inv_c73e9b', durationMs: 11380 },
  { id: 'aa_3', at: '2026-08-28T09:14:22Z', decision: 'auto_fixed', title: { en: 'Actions pinned to mutable tags', ur: 'ایکشنز قابلِ تبدیل ٹیگ سے منسلک' }, repo: 'northwind/checkout-service', confidence: 96, investigationId: 'inv_8f21a4', durationMs: 7420 },
  { id: 'aa_4', at: '2026-08-27T16:12:00Z', decision: 'auto_fixed', title: { en: 'Base image pinned to digest', ur: 'بیس امیج ڈائجسٹ پر پن کی گئی' }, repo: 'northwind/ledger-worker', confidence: 93, investigationId: 'inv_8f21a4', durationMs: 6210 },
  { id: 'aa_5', at: '2026-08-27T11:40:00Z', decision: 'flagged', title: { en: 'Missing approval gate on production migration', ur: 'پروڈکشن مائیگریشن پر منظوری گیٹ غائب' }, repo: 'northwind/ledger-worker', confidence: 74, investigationId: 'inv_c73e9b', durationMs: 8890 },
  { id: 'aa_6', at: '2026-08-26T15:05:00Z', decision: 'auto_fixed', title: { en: 'Removed unused packages: write scope', ur: 'غیر استعمال شدہ packages: write دائرہ ہٹایا گیا' }, repo: 'northwind/storefront-web', confidence: 91, investigationId: 'inv_8f21a4', durationMs: 5980 },
];

// ---------------------------------------------------------------------------
// Replay cassettes
// ---------------------------------------------------------------------------

export const recordedRuns: RecordedRun[] = [
  {
    id: 'cassette_three_outcome',
    name: 'Three-outcome demo — full clean run',
    recordedAt: '2026-08-28T14:02:00Z',
    durationMs: 28440,
    investigationIds: ['inv_8f21a4', 'inv_c73e9b', 'inv_2a5d10'],
    responseCount: 34,
    gatewayVersion: 'gw-0.4.2',
    checksum: 'sha256:9f2c41ab7d0e5583c1b6e2a4f7d90c118e4a5b3d2c6f8091a7b4e3d5c2f10986',
  },
  {
    id: 'cassette_overview',
    name: 'Dashboard cold load — 14-day window',
    recordedAt: '2026-08-28T14:00:12Z',
    durationMs: 4120,
    investigationIds: [],
    responseCount: 11,
    gatewayVersion: 'gw-0.4.2',
    checksum: 'sha256:3ac81d09f4b27e6650a9c3d81b7f2e04a6c95d13f8e027b4a1c6d9e3f5b08472',
  },
];

export { fixes };
