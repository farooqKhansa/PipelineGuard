import type { PipelineRunAnalysis } from '@/lib/contract/types';

/**
 * Fixtures in the OTHER WORKSTREAMS' shape.
 *
 * Not in the dashboard's shape — deliberately. These are what the FastAPI
 * gateway is expected to return, so the adapter is exercised end to end on
 * every load. If a teammate changes a field name, these break loudly here
 * rather than quietly on stage.
 *
 * Three runs, one per decision path.
 */

const autoFixDiff = `diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -31,7 +31,8 @@ jobs:
   test:
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/cache@v3
+      # renovate: datasource=github-tags depName=actions/cache
+      - uses: actions/cache@1bd1e32a3bdc45362d1e726936510720a7c30a57 # v3.9.1
         with:
           path: ~/.npm
           key: npm-\${{ hashFiles('**/package-lock.json') }}`;

const cautionDiff = `diff --git a/.github/workflows/deploy-prod.yml b/.github/workflows/deploy-prod.yml
--- a/.github/workflows/deploy-prod.yml
+++ b/.github/workflows/deploy-prod.yml
@@ -10,7 +10,9 @@ on:
 concurrency: deploy-production

-permissions: write-all
+permissions:
+  contents: read
+  id-token: write

 jobs:
   build:`;

export const contractRuns: PipelineRunAnalysis[] = [
  // -------------------------------------------------------------------------
  // 1. AUTO-FIX
  // -------------------------------------------------------------------------
  {
    run_id: 'run_4471',
    repo: 'northwind/checkout-service',
    workflow: 'CI',
    commit: '4b91c07',
    commit_message: 'chore: speed up test job with cache',
    author: 'khansa.f',
    branch: 'feat/test-cache',
    started_at: '2026-08-28T09:14:22Z',
    status: 'complete',
    risk: {
      risk_score: 34,
      confidence: 0.96,
      reasons: [
        { message: 'Third-party action actions/cache referenced by mutable tag v3 rather than a commit SHA', code: 'SUP.ACTION_MUTABLE_REF', weight: 0.62, severity: 'medium', file: '.github/workflows/ci.yml', line: 34 },
        { message: 'Tag resolved to a different SHA between run #1184 and run #1191', code: 'SUP.TAG_DRIFT_OBSERVED', weight: 0.28 },
        { message: 'Job test uploads an artifact consumed by a job holding packages: write', code: 'INT.ARTIFACT_CROSS_JOB', weight: 0.10 },
      ],
      affected_jobs: ['test', 'build'],
      graph_path: ['test', 'coverage-report', 'build', 'npm-registry'],
      model_breakdown: { gradient_boost: 0.91, rule_engine: 0.97, anomaly_detector: 0.88 },
      run_id: 'run_4471',
      file: '.github/workflows/ci.yml',
      line: 34,
      detected_at: '2026-08-28T09:14:22Z',
    },
    agent: {
      action: 'auto_fix',
      confidence: 0.96,
      title: 'Pin actions/cache to the commit its tag points at',
      file_path: '.github/workflows/ci.yml',
      fix_diff: autoFixDiff,
      prevents: 'Prevents an upstream maintainer silently repointing the v3 tag to different code that then runs inside your build with access to artifacts a packages:write job consumes.',
      prevents_ur: 'یہ روکتا ہے کہ کوئی اپ اسٹریم مینٹینر خاموشی سے v3 ٹیگ کو مختلف کوڈ پر منتقل کر دے، جو پھر آپ کے بلڈ کے اندر ایسے آرٹیفیکٹس تک رسائی کے ساتھ چلے جنہیں packages:write والی جاب استعمال کرتی ہے۔',
      verification: {
        passed: true,
        method: 'Patched workflow executed on an ephemeral branch and compared against run #1204 for step-level output equality.',
        tests_run: 5,
        tests_passed: 5,
        checks: [
          { name: 'Resolved SHA matches tag at scan time', status: 'passed', detail: 'Verified against the upstream Git ref API.', duration_ms: 420 },
          { name: 'Workflow syntax valid', status: 'passed', detail: 'actionlint reported 0 errors.', duration_ms: 310 },
          { name: 'Job test completes', status: 'passed', detail: '2m41s against a 2m38s baseline — 1.9%, within normal variance.', duration_ms: 161000 },
          { name: 'Step outputs identical to baseline', status: 'passed', detail: 'Cache key and artifact digest byte-identical to run #1204.', duration_ms: 1200 },
          { name: 'Downstream job build unaffected', status: 'passed', detail: 'build consumed an identical artifact digest.', duration_ms: 2400 },
        ],
      },
      explanation_en: 'A tag is mutable, so the code that runs today may not be the code that runs tomorrow. I resolved v3 to the commit it currently points at and pinned it there. Because that SHA is exactly what ran in the last three green builds, this change preserves behaviour rather than altering it — which is why I applied it without asking. It reverts with a single commit.',
      explanation_ur: 'ٹیگ تبدیل ہو سکتا ہے، یعنی جو کوڈ آج چل رہا ہے ضروری نہیں کل بھی وہی چلے۔ میں نے v3 کو اُس کمِٹ پر حل کیا جس کی طرف وہ اِس وقت اشارہ کرتا ہے اور اسے وہیں پن کر دیا۔ چونکہ یہ SHA بالکل وہی ہے جو گزشتہ تین کامیاب بلڈز میں چلا، اس لیے یہ تبدیلی رویّہ بدلتی نہیں بلکہ برقرار رکھتی ہے — یہی وجہ ہے کہ میں نے اسے بغیر پوچھے لاگو کر دیا۔ ایک کمِٹ سے یہ واپس بھی لی جا سکتی ہے۔',
      escalation_reason: null,
      pr_url: 'https://github.com/northwind/checkout-service/pull/486',
    },
  },

  // -------------------------------------------------------------------------
  // 2. PROPOSE WITH CAUTION
  // -------------------------------------------------------------------------
  {
    run_id: 'run_4472',
    repo: 'northwind/checkout-service',
    workflow: 'Deploy (production)',
    commit: 'e17d3f0',
    commit_message: 'fix: deploy failing on release notes step',
    author: 'hamna.m',
    branch: 'hotfix/deploy-perms',
    started_at: '2026-08-28T11:02:47Z',
    status: 'complete',
    risk: {
      risk_score: 88,
      confidence: 0.71,
      reasons: [
        { message: 'permissions: write-all introduced at workflow root, replacing an explicit four-scope block', code: 'PERM.WRITE_ALL_ROOT', weight: 0.55, severity: 'critical', file: '.github/workflows/deploy-prod.yml', line: 12 },
        { message: 'Applies to all 5 jobs, including notify and smoke-test which previously held none', code: 'PERM.SCOPE_INHERITANCE', weight: 0.25 },
        { message: 'Job deploy reads PROD_DEPLOY_KEY and binds environment production', code: 'SEC.PROD_SECRET_REACH', weight: 0.20 },
      ],
      affected_jobs: ['build', 'smoke-test', 'deploy', 'notify', 'rollback-guard'],
      graph_path: [
        { from: 'build', to: 'deploy', kind: 'needs' },
        { from: 'deploy', to: 'production', kind: 'deploys_to' },
        { from: 'production', to: 'payments-api', kind: 'calls' },
      ],
      model_breakdown: { gradient_boost: 0.84, rule_engine: 0.95, anomaly_detector: 0.61 },
      run_id: 'run_4472',
      file: '.github/workflows/deploy-prod.yml',
      line: 12,
      detected_at: '2026-08-28T11:02:47Z',
    },
    agent: {
      action: 'propose_with_caution',
      confidence: 0.71,
      title: 'Restore an explicit least-privilege permissions block',
      file_path: '.github/workflows/deploy-prod.yml',
      fix_diff: cautionDiff,
      prevents: 'Prevents a compromised step in any of the five jobs from writing to production secrets and overwriting already-released container images — the exact failure mode of incident INC-2291.',
      prevents_ur: 'یہ روکتا ہے کہ پانچوں جابز میں سے کسی ایک کا متاثرہ سٹیپ پروڈکشن سیکرٹس پر لکھ سکے یا پہلے سے جاری شدہ کنٹینر امیجز کو اوور رائٹ کر دے — یعنی بالکل وہی ناکامی جو واقعہ INC-2291 میں پیش آئی تھی۔',
      verification: {
        passed: false,
        method: 'Replayed against the last 30 successful runs in dry-run mode. NOT executed against production, because doing so is the risk under review.',
        tests_run: 5,
        tests_passed: 3,
        checks: [
          { name: 'Workflow syntax valid', status: 'passed', detail: 'actionlint reported 0 errors.', duration_ms: 340 },
          { name: 'Observed API calls fit narrowed scopes', status: 'passed', detail: '30 of 30 replayed runs covered by the proposed block.', duration_ms: 8400 },
          { name: 'Release-notes step scope derivable', status: 'failed', detail: 'The gh api subcommand is assembled at runtime from env.RELEASE_MODE. If that can be "announce", issues: write is required and this patch breaks the step.', duration_ms: 2100 },
          { name: 'Production dry run', status: 'skipped', detail: 'Policy forbids the agent exercising a production deploy pipeline.', duration_ms: 0 },
          { name: 'Rollback path confirmed', status: 'passed', detail: 'Single-commit revert restores the previous block.', duration_ms: 180 },
        ],
      },
      explanation_en: 'I wrote this fix and then deliberately did not apply it. The narrowed permission block is correct for every call I can observe across 30 replayed runs — but one step builds a gh api subcommand at runtime from an environment variable I cannot read statically. If that variable can take the value "announce", the step needs issues: write and my patch would break your production deploy. Breaking a working deploy is a worse outcome than the risk I am removing, so this needs one answer from a code owner: what values can RELEASE_MODE take?',
      explanation_ur: 'میں نے یہ حل تیار کیا اور پھر جان بوجھ کر لاگو نہیں کیا۔ محدود کردہ اجازتی بلاک اُن تمام کالز کے لیے درست ہے جو میں ۳۰ دہرائے گئے رنز میں دیکھ سکا — مگر ایک سٹیپ رن ٹائم پر ایک ایسے ماحولیاتی متغیر سے gh api کا سب کمانڈ بناتا ہے جسے میں جامد تجزیے سے پڑھ نہیں سکتا۔ اگر اُس متغیر کی قدر "announce" ہو سکتی ہے تو اُس سٹیپ کو issues: write درکار ہوگا اور میرا پیچ آپ کا پروڈکشن ڈیپلائے توڑ دے گا۔ ایک چلتے ہوئے ڈیپلائے کو توڑنا اُس خطرے سے بھی بدتر ہے جو میں ختم کر رہا ہوں، لہٰذا اس کے لیے کوڈ مالک سے ایک جواب درکار ہے: RELEASE_MODE کی ممکنہ اقدار کیا ہیں؟',
      escalation_reason: 'Cannot statically prove the narrowed permission set is sufficient for the release-notes step.',
      pr_url: 'https://github.com/northwind/checkout-service/pull/487',
    },
  },

  // -------------------------------------------------------------------------
  // 3. ESCALATE TO HUMAN
  // -------------------------------------------------------------------------
  {
    run_id: 'run_4473',
    repo: 'northwind/checkout-service',
    workflow: 'Release',
    commit: '9ac4e22',
    commit_message: 'feat: notify downstream on release',
    author: 'hamna.m',
    branch: 'feat/release-webhook',
    started_at: '2026-08-28T13:41:09Z',
    status: 'complete',
    risk: {
      risk_score: 61,
      confidence: 0.38,
      reasons: [
        { message: 'Job notify posts toJSON(github.event) to a URL held in an organisation variable', code: 'EXP.UNRESOLVED_EGRESS', weight: 0.48, severity: 'high', file: '.github/workflows/release.yml', line: 61 },
        { message: 'Destination host cannot be resolved with the granted scopes', code: 'EXP.DESTINATION_UNKNOWN', weight: 0.34 },
        { message: 'No prior occurrence of this pattern in 180 days across 12 repositories', code: 'HIST.NO_PRECEDENT', weight: 0.18 },
      ],
      affected_jobs: ['notify'],
      graph_path: ['tag', 'notify', 'external'],
      // Models disagree sharply here. That disagreement is the finding.
      model_breakdown: { gradient_boost: 0.44, rule_engine: 0.81, anomaly_detector: 0.29 },
      run_id: 'run_4473',
      file: '.github/workflows/release.yml',
      line: 61,
      detected_at: '2026-08-28T13:41:09Z',
    },
    agent: {
      action: 'escalate',
      confidence: 0.38,
      title: 'Outbound POST of full event payload to an unresolvable destination',
      file_path: '.github/workflows/release.yml',
      fix_diff: null,
      prevents: null as unknown as undefined,
      verification: null,
      explanation_en: 'I am not going to guess at this one. The job posts the entire GitHub event object — which includes repository metadata and the committer email of every commit in the release — to a URL stored in an organisation variable that I have not been granted permission to read. If that host is internal, this is a routine release notification and the correct action is to do nothing. If it is external and attacker-controlled, every release leaks committer identities indefinitely. Those two readings are supported by exactly the same evidence I can see, and averaging them into a single risk score would produce a number that describes neither. One answer settles it: what host does vars.WEBHOOK_URL point to?',
      explanation_ur: 'میں اس معاملے میں اندازہ نہیں لگاؤں گا۔ یہ جاب مکمل GitHub ایونٹ آبجیکٹ — جس میں ریپوزٹری میٹا ڈیٹا اور ریلیز کے ہر کمِٹ کے کمِٹر کا ای میل شامل ہے — ایک ایسے URL پر بھیجتی ہے جو تنظیمی ویری ایبل میں محفوظ ہے اور جسے پڑھنے کی اجازت مجھے نہیں دی گئی۔ اگر وہ میزبان داخلی ہے تو یہ ایک معمول کی ریلیز اطلاع ہے اور درست کارروائی یہ ہے کہ کچھ نہ کیا جائے۔ اگر وہ بیرونی اور حملہ آور کے قابو میں ہے تو ہر ریلیز کمِٹرز کی شناخت مسلسل افشا کرے گی۔ ان دونوں تعبیروں کی تائید بالکل انہی شواہد سے ہوتی ہے جو مجھے نظر آتے ہیں، اور انہیں اوسط کر کے ایک رِسک سکور بنانا ایسا عدد دے گا جو کسی ایک کی بھی درست عکاسی نہیں کرتا۔ ایک جواب اسے حل کر دے گا: vars.WEBHOOK_URL کس میزبان کی طرف اشارہ کرتا ہے؟',
      escalation_reason: 'vars.WEBHOOK_URL cannot be read with the scopes this installation holds, and the benign and malicious readings are supported by identical evidence.',
      pr_url: null,
    },
  },
];

export const contractRunById = (id: string) =>
  contractRuns.find((r) => r.run_id === id) ?? null;
