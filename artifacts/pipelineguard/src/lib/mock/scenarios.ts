import type { Investigation } from '@/lib/types';

/**
 * The three agent outcomes, as fully-worked investigations.
 *
 * These are the demo spine. They are ordered deliberately: a confident fix,
 * then a confident *refusal to act unilaterally*, then an honest "I don't
 * know". A tool that only ever produces the first is a tool nobody should
 * give write access to.
 *
 * Every confidence number below is the running aggregate after that step, and
 * every step carries its own signed delta -- including negative ones. Step 3
 * of the refusal scenario lowers confidence, which is the entire point.
 */

// ---------------------------------------------------------------------------
// 1. AUTO-FIXED -- low blast radius, deterministic remedy, high confidence
// ---------------------------------------------------------------------------

const autoFixed: Investigation = {
  id: 'inv_8f21a4',
  findingId: 'PG-1042',
  title: {
    en: 'Third-party actions pinned to mutable tags',
    ur: 'تھرڈ پارٹی ایکشنز قابلِ تبدیل ٹیگ سے منسلک ہیں',
  },
  repo: 'northwind/checkout-service',
  pipeline: 'CI',
  pipelineId: 'pl_ci_checkout',
  runId: 'run_1207',
  commit: '4b91c07',
  commitMessage: 'chore: speed up test job with cache',
  author: 'khansa.f',
  branch: 'feat/test-cache',
  filePath: '.github/workflows/ci.yml',
  severity: 'medium',
  decision: 'auto_fixed',
  confidence: 96,
  startedAt: '2026-08-28T09:14:22Z',
  durationMs: 7420,
  thresholds: { autoFixFloor: 90, recommendFloor: 45 },
  steps: [
    {
      id: 's1',
      kind: 'detect',
      title: {
        en: 'Detected mutable action references',
        ur: 'قابلِ تبدیل ایکشن حوالہ جات کی نشاندہی',
      },
      claim: {
        en: 'Two third-party actions are referenced by tag rather than by commit SHA.',
        ur: 'دو تھرڈ پارٹی ایکشنز کمِٹ SHA کے بجائے ٹیگ کے ذریعے استعمال ہو رہے ہیں۔',
      },
      because: [
        {
          en: 'ci.yml line 34 uses actions/cache@v3 — v3 is a branch-like tag the upstream owner can repoint at any time.',
          ur: 'ci.yml کی لائن 34 میں actions/cache@v3 استعمال ہوا ہے — v3 ایک ایسا ٹیگ ہے جسے اپ اسٹریم مالک کسی بھی وقت کسی اور کمِٹ پر منتقل کر سکتا ہے۔',
        },
        {
          en: 'ci.yml line 47 uses tj-actions/changed-files@v41, from a publisher with a prior tag-hijack advisory.',
          ur: 'ci.yml کی لائن 47 میں tj-actions/changed-files@v41 ہے، جس کے ناشر کے خلاف پہلے ٹیگ ہائی جیک کی ایڈوائزری جاری ہو چکی ہے۔',
        },
        {
          en: 'The repository has no pinning policy exemption on record for either publisher.',
          ur: 'ان میں سے کسی بھی ناشر کے لیے ریپوزٹری میں پننگ پالیسی کی کوئی استثنا درج نہیں ہے۔',
        },
      ],
      citations: [
        { label: '.github/workflows/ci.yml:34', href: '/pipelines/pl_ci_checkout/config', kind: 'file' },
        { label: '.github/workflows/ci.yml:47', href: '/pipelines/pl_ci_checkout/config', kind: 'file' },
        { label: 'policy PG-SUP-001', href: '/policies/pol_sup_001', kind: 'policy' },
      ],
      confidenceAfter: 62,
      confidenceDelta: 62,
      durationMs: 640,
    },
    {
      id: 's2',
      kind: 'historical',
      title: {
        en: 'Checked 180 days of pipeline history',
        ur: '۱۸۰ دن کی پائپ لائن ہسٹری کا جائزہ',
      },
      claim: {
        en: 'Tag-pinned actions in this organisation have drifted before, and drift has been silent.',
        ur: 'اس تنظیم میں ٹیگ سے منسلک ایکشنز پہلے بھی تبدیل ہو چکے ہیں، اور یہ تبدیلی خاموشی سے ہوئی۔',
      },
      because: [
        {
          en: 'Across 4 repositories, 3 of 3 previously tag-pinned actions resolved to a different SHA within 90 days without any commit in this org.',
          ur: '۴ ریپوزٹریز میں، پہلے سے ٹیگ شدہ ۳ میں سے ۳ ایکشنز ۹۰ دن کے اندر مختلف SHA پر منتقل ہو گئے، جبکہ اس تنظیم میں کوئی کمِٹ نہیں ہوا تھا۔',
        },
        {
          en: 'Run #1184 and run #1191 executed different upstream code under the same v41 tag — a 2-line difference in the action entrypoint.',
          ur: 'رن #1184 اور رن #1191 نے ایک ہی v41 ٹیگ کے تحت مختلف اپ اسٹریم کوڈ چلایا — ایکشن انٹری پوائنٹ میں ۲ لائنوں کا فرق تھا۔',
        },
        {
          en: 'No prior run failed as a result, so no existing signal would have surfaced this to a developer.',
          ur: 'اس کے نتیجے میں پہلے کوئی رن ناکام نہیں ہوا، یعنی موجودہ نظام میں کوئی ایسا اشارہ نہیں تھا جو ڈویلپر کو خبردار کرتا۔',
        },
      ],
      citations: [
        { label: 'run #1184', href: '/pipelines/pl_ci_checkout/runs/run_1184', kind: 'run' },
        { label: 'run #1191', href: '/pipelines/pl_ci_checkout/runs/run_1191', kind: 'run' },
        { label: 'pattern LP-07', href: '/history/patterns', kind: 'incident' },
      ],
      confidenceAfter: 78,
      confidenceDelta: 16,
      durationMs: 1880,
    },
    {
      id: 's3',
      kind: 'dependency',
      title: {
        en: 'Traced the job graph',
        ur: 'جاب گراف کا سراغ',
      },
      claim: {
        en: 'The affected job cannot reach production, but it can reach the package registry indirectly.',
        ur: 'متاثرہ جاب پروڈکشن تک نہیں پہنچ سکتی، البتہ بالواسطہ طور پر پیکج رجسٹری تک رسائی رکھتی ہے۔',
      },
      because: [
        {
          en: 'Both steps run in job `test`, whose effective token permissions are contents: read only.',
          ur: 'دونوں سٹیپس جاب `test` میں چلتے ہیں، جس کی مؤثر ٹوکن اجازت صرف contents: read ہے۔',
        },
        {
          en: 'Job `test` reads no secrets and is not bound to any environment.',
          ur: 'جاب `test` کوئی سیکرٹ نہیں پڑھتی اور کسی ماحول (environment) سے منسلک نہیں ہے۔',
        },
        {
          en: 'However `test` uploads artifact `coverage-report`, which job `build` consumes — and `build` holds packages: write.',
          ur: 'تاہم `test` آرٹیفیکٹ `coverage-report` اپ لوڈ کرتی ہے، جسے جاب `build` استعمال کرتی ہے — اور `build` کے پاس packages: write کی اجازت ہے۔',
        },
      ],
      citations: [
        { label: 'job test', href: '/pipelines/pl_ci_checkout/graph', kind: 'job' },
        { label: 'job build', href: '/pipelines/pl_ci_checkout/graph', kind: 'job' },
        { label: 'dependency graph', href: '/pipelines/pl_ci_checkout/graph', kind: 'job' },
      ],
      confidenceAfter: 84,
      confidenceDelta: 6,
      durationMs: 1240,
    },
    {
      id: 's4',
      kind: 'impact',
      title: {
        en: 'Bounded the blast radius',
        ur: 'اثر کے دائرے کا تعین',
      },
      claim: {
        en: 'Worst case is registry publication of a tampered artifact. Production secrets are out of reach.',
        ur: 'بدترین صورت میں ایک تبدیل شدہ آرٹیفیکٹ رجسٹری پر شائع ہو سکتا ہے۔ پروڈکشن سیکرٹس تک رسائی ممکن نہیں۔',
      },
      because: [
        {
          en: 'Compromised action code in `test` could alter coverage-report before `build` consumes it — the artifact is not checksummed between jobs.',
          ur: '`test` میں متاثرہ ایکشن کوڈ، coverage-report کو `build` کے استعمال سے پہلے تبدیل کر سکتا ہے — دونوں جابز کے درمیان آرٹیفیکٹ کا چیک سم نہیں ہوتا۔',
        },
        {
          en: 'No path exists from `test` to environment `production`; the deploy pipeline is a separate workflow with its own trigger.',
          ur: '`test` سے ماحول `production` تک کوئی راستہ موجود نہیں؛ ڈیپلائے پائپ لائن ایک الگ ورک فلو ہے جس کا ٹرگر بھی الگ ہے۔',
        },
        {
          en: '2 downstream consumers depend on packages published by this repository.',
          ur: 'اس ریپوزٹری سے شائع ہونے والے پیکجز پر ۲ ڈاؤن اسٹریم صارفین انحصار کرتے ہیں۔',
        },
      ],
      citations: [
        { label: 'blast radius', href: '/graph/blast-radius', kind: 'job' },
        { label: 'CWE-1357', href: null, kind: 'policy' },
      ],
      confidenceAfter: 88,
      confidenceDelta: 4,
      durationMs: 980,
    },
    {
      id: 's5',
      kind: 'confidence',
      title: {
        en: 'Aggregated confidence',
        ur: 'مجموعی اعتماد کا حساب',
      },
      claim: {
        en: 'Confidence 96%. The remedy is mechanical, behaviour-preserving and reversible in one commit.',
        ur: 'اعتماد ۹۶٪۔ حل مکینیکل ہے، رویّہ تبدیل نہیں کرتا، اور ایک کمِٹ سے واپس لیا جا سکتا ہے۔',
      },
      because: [
        {
          en: 'Resolving a tag to the SHA it currently points at is a lookup, not a judgement — there is no interpretation step that could be wrong.',
          ur: 'ٹیگ کو اُس SHA پر حل کرنا جس کی طرف وہ اِس وقت اشارہ کرتا ہے، ایک سادہ لُک اپ ہے، کوئی فیصلہ نہیں — یہاں غلط ہونے والا کوئی تشریحی مرحلہ نہیں۔',
        },
        {
          en: 'The pinned SHA is the exact code that ran in the last 3 green runs, so behaviour is already observed, not predicted.',
          ur: 'منتخب کردہ SHA بالکل وہی کوڈ ہے جو گزشتہ ۳ کامیاب رنز میں چلا، لہٰذا رویّہ پیش گوئی نہیں بلکہ مشاہدہ شدہ ہے۔',
        },
        {
          en: 'Remaining 4% covers the possibility that a maintainer intends to track v3 for automatic patches.',
          ur: 'باقی ۴٪ اس امکان کے لیے ہے کہ کوئی مینٹینر خودکار پیچز کے لیے جان بوجھ کر v3 کو ٹریک کرنا چاہتا ہو۔',
        },
      ],
      citations: [{ label: 'run #1204', href: '/pipelines/pl_ci_checkout/runs/run_1204', kind: 'run' }],
      confidenceAfter: 96,
      confidenceDelta: 8,
      durationMs: 1420,
    },
    {
      id: 's6',
      kind: 'decision',
      title: {
        en: 'Decision: auto-fix',
        ur: 'فیصلہ: خودکار درستگی',
      },
      claim: {
        en: 'Applied the fix autonomously and opened PR #486 for the record.',
        ur: 'درستگی خودکار طور پر لاگو کی گئی اور ریکارڈ کے لیے PR #486 کھولا گیا۔',
      },
      because: [
        {
          en: 'Confidence 96% clears the auto-fix floor of 90%.',
          ur: '۹۶٪ اعتماد، خودکار درستگی کی ۹۰٪ کی حد سے زیادہ ہے۔',
        },
        {
          en: 'Blast radius excludes production and excludes all secrets — policy PG-AF-001 permits autonomous action here.',
          ur: 'اثر کا دائرہ نہ پروڈکشن کو چھوتا ہے نہ کسی سیکرٹ کو — پالیسی PG-AF-001 یہاں خودکار کارروائی کی اجازت دیتی ہے۔',
        },
        {
          en: 'The change is behaviour-preserving and was validated by re-running the affected job before the PR was opened.',
          ur: 'تبدیلی رویّہ برقرار رکھتی ہے اور PR کھولنے سے پہلے متاثرہ جاب دوبارہ چلا کر اس کی تصدیق کی گئی۔',
        },
      ],
      citations: [
        { label: 'PR #486', href: '/fixes/fix_8f21a4', kind: 'commit' },
        { label: 'policy PG-AF-001', href: '/policies/pol_af_001', kind: 'policy' },
      ],
      confidenceAfter: 96,
      confidenceDelta: 0,
      durationMs: 1260,
    },
  ],
  gaps: [],
  hypotheses: [],
  similarChanges: [
    {
      id: 'sc1',
      repo: 'northwind/payments-api',
      commit: 'a02f9d1',
      summary: {
        en: 'Same action pinned to SHA after upstream tag moved',
        ur: 'اپ اسٹریم ٹیگ منتقل ہونے کے بعد وہی ایکشن SHA پر پن کیا گیا',
      },
      daysAgo: 41,
      outcome: 'clean',
      similarity: 0.94,
    },
    {
      id: 'sc2',
      repo: 'northwind/edge-router',
      commit: '7cc1b83',
      summary: {
        en: 'Tag-pinned action silently changed entrypoint between runs',
        ur: 'ٹیگ شدہ ایکشن کا انٹری پوائنٹ رنز کے درمیان خاموشی سے تبدیل ہوا',
      },
      daysAgo: 68,
      outcome: 'failed_build',
      similarity: 0.81,
    },
  ],
  fix: null, // wired up in mock/data.ts to avoid a circular import
};

// ---------------------------------------------------------------------------
// 2. FLAGGED -- the agent has a fix, and declines to apply it anyway
// ---------------------------------------------------------------------------

const flagged: Investigation = {
  id: 'inv_c73e9b',
  findingId: 'PG-1043',
  title: {
    en: 'permissions: write-all introduced on a production deploy workflow',
    ur: 'پروڈکشن ڈیپلائے ورک فلو پر permissions: write-all شامل کیا گیا',
  },
  repo: 'northwind/checkout-service',
  pipeline: 'Deploy (production)',
  pipelineId: 'pl_deploy_prod',
  runId: 'run_1208',
  commit: 'e17d3f0',
  commitMessage: 'fix: deploy failing on release notes step',
  author: 'hamna.m',
  branch: 'hotfix/deploy-perms',
  filePath: '.github/workflows/deploy-prod.yml',
  severity: 'critical',
  decision: 'flagged',
  confidence: 71,
  startedAt: '2026-08-28T11:02:47Z',
  durationMs: 11380,
  thresholds: { autoFixFloor: 90, recommendFloor: 45 },
  steps: [
    {
      id: 's1',
      kind: 'detect',
      title: {
        en: 'Detected a permission widening',
        ur: 'اجازتوں میں توسیع کی نشاندہی',
      },
      claim: {
        en: 'An explicit 4-scope permissions block was replaced with write-all at workflow root.',
        ur: 'ورک فلو کی جڑ میں ۴ مخصوص اجازتوں کے بلاک کو write-all سے بدل دیا گیا۔',
      },
      because: [
        {
          en: 'deploy-prod.yml line 12 changed from a block granting contents: read, id-token: write, deployments: write, packages: read to the single token permissions: write-all.',
          ur: 'deploy-prod.yml کی لائن ۱۲ میں contents: read، id-token: write، deployments: write اور packages: read دینے والا بلاک ہٹا کر صرف permissions: write-all لکھ دیا گیا۔',
        },
        {
          en: 'write-all at workflow root overrides the absent job-level blocks, so it applies to all 5 jobs.',
          ur: 'ورک فلو کی جڑ پر write-all، جاب کی سطح کے غیر موجود بلاکس پر حاوی ہو جاتا ہے، اس لیے یہ پانچوں جابز پر لاگو ہوتا ہے۔',
        },
        {
          en: 'The commit message says the intent was to fix a failing release-notes step, which suggests a scope was widened to unblock, not by design.',
          ur: 'کمِٹ پیغام کے مطابق مقصد ریلیز نوٹس کے ناکام سٹیپ کو ٹھیک کرنا تھا، یعنی اجازت رکاوٹ دور کرنے کے لیے بڑھائی گئی، سوچے سمجھے ڈیزائن کے تحت نہیں۔',
        },
      ],
      citations: [
        { label: 'deploy-prod.yml:12', href: '/pipelines/pl_deploy_prod/config', kind: 'file' },
        { label: 'commit e17d3f0', href: '/pipelines/pl_deploy_prod/runs/run_1208', kind: 'commit' },
      ],
      confidenceAfter: 58,
      confidenceDelta: 58,
      durationMs: 720,
    },
    {
      id: 's2',
      kind: 'historical',
      title: {
        en: 'Matched against prior permission changes',
        ur: 'سابقہ اجازتی تبدیلیوں سے موازنہ',
      },
      claim: {
        en: 'Every previous widening in this organisation was either reverted or preceded an incident.',
        ur: 'اس تنظیم میں ہر سابقہ توسیع یا تو واپس لی گئی یا کسی واقعے سے پہلے ہوئی۔',
      },
      because: [
        {
          en: '4 permission-widening changes in the last 12 months: 3 reverted within 9 days, 1 preceded incident INC-2291.',
          ur: 'گزشتہ ۱۲ مہینوں میں اجازت بڑھانے کی ۴ تبدیلیاں: ۳ نو دن کے اندر واپس لے لی گئیں، ۱ واقعہ INC-2291 سے پہلے ہوئی۔',
        },
        {
          en: 'INC-2291 was a registry image overwrite on 14 March, root-caused to a job holding packages: write it did not need.',
          ur: 'INC-2291، ۱۴ مارچ کو رجسٹری امیج اوور رائٹ کا واقعہ تھا، جس کی بنیادی وجہ ایک جاب کے پاس packages: write کا ہونا تھا جس کی اسے ضرورت نہیں تھی۔',
        },
        {
          en: '0 of 4 were later found to be necessary once the underlying failure was diagnosed.',
          ur: 'بنیادی خرابی کی تشخیص کے بعد ان ۴ میں سے ایک بھی ضروری ثابت نہیں ہوئی۔',
        },
      ],
      citations: [
        { label: 'INC-2291', href: '/history/incidents', kind: 'incident' },
        { label: 'pattern LP-02', href: '/history/patterns', kind: 'incident' },
      ],
      confidenceAfter: 74,
      confidenceDelta: 16,
      durationMs: 2640,
    },
    {
      id: 's3',
      kind: 'dependency',
      title: {
        en: 'Expanded the permission across the job graph',
        ur: 'جاب گراف پر اجازت کے پھیلاؤ کا تجزیہ',
      },
      claim: {
        en: 'The widening reaches two jobs that previously held no token permissions at all.',
        ur: 'یہ توسیع اُن دو جابز تک پہنچتی ہے جن کے پاس پہلے کوئی ٹوکن اجازت نہیں تھی۔',
      },
      because: [
        {
          en: 'Jobs `notify` and `smoke-test` had no permissions block, which under the previous root meant an explicit read-only set; they now inherit write-all.',
          ur: 'جابز `notify` اور `smoke-test` کے پاس کوئی اجازتی بلاک نہیں تھا، جس کا سابقہ جڑ کے تحت مطلب صرف پڑھنے کی اجازت تھا؛ اب انہیں write-all وراثت میں ملتا ہے۔',
        },
        {
          en: 'Job `deploy` reads PROD_DEPLOY_KEY and AWS_ROLE_ARN and binds to environment `production`.',
          ur: 'جاب `deploy`، PROD_DEPLOY_KEY اور AWS_ROLE_ARN پڑھتی ہے اور ماحول `production` سے منسلک ہے۔',
        },
        {
          en: 'Environment `production` fronts 3 downstream services: payments-api, edge-router, ledger-worker.',
          ur: 'ماحول `production` کے پیچھے ۳ ڈاؤن اسٹریم سروسز ہیں: payments-api، edge-router، ledger-worker۔',
        },
      ],
      citations: [
        { label: 'job notify', href: '/pipelines/pl_deploy_prod/graph', kind: 'job' },
        { label: 'job deploy', href: '/pipelines/pl_deploy_prod/graph', kind: 'job' },
        { label: 'env production', href: '/graph/blast-radius', kind: 'job' },
      ],
      confidenceAfter: 83,
      confidenceDelta: 9,
      durationMs: 1960,
    },
    {
      id: 's4',
      kind: 'impact',
      title: {
        en: 'Computed blast radius',
        ur: 'اثر کے دائرے کا حساب',
      },
      claim: {
        en: '5 jobs gain write access to production secrets, the container registry, and 3 downstream services.',
        ur: '۵ جابز کو پروڈکشن سیکرٹس، کنٹینر رجسٹری اور ۳ ڈاؤن اسٹریم سروسز پر لکھنے کی رسائی مل جاتی ہے۔',
      },
      because: [
        {
          en: 'Any compromised step in any of the 5 jobs can now mint tokens with write scope on the whole repository.',
          ur: 'ان ۵ جابز میں سے کسی بھی متاثرہ سٹیپ سے اب پوری ریپوزٹری پر write دائرے کے ٹوکن بنائے جا سکتے ہیں۔',
        },
        {
          en: 'Registry overwrite is the exact failure mode of INC-2291, and this configuration reproduces its precondition.',
          ur: 'رجسٹری اوور رائٹ بالکل وہی ناکامی ہے جو INC-2291 میں ہوئی، اور یہ کنفیگریشن اُسی کی پیشگی شرط دہراتی ہے۔',
        },
        {
          en: 'Mean recovery time for the comparable prior incident was 6.5 hours.',
          ur: 'اسی طرح کے سابقہ واقعے میں اوسط بحالی کا وقت ۶.۵ گھنٹے تھا۔',
        },
      ],
      citations: [
        { label: 'blast radius', href: '/graph/blast-radius', kind: 'job' },
        { label: 'CWE-266', href: null, kind: 'policy' },
      ],
      confidenceAfter: 88,
      confidenceDelta: 5,
      durationMs: 1580,
    },
    {
      id: 's5',
      kind: 'confidence',
      title: {
        en: 'Confidence reduced by an unverifiable step',
        ur: 'ایک ناقابلِ تصدیق سٹیپ کے باعث اعتماد میں کمی',
      },
      claim: {
        en: 'Confidence falls to 71%: the agent cannot prove the narrowed permission set is sufficient.',
        ur: 'اعتماد گر کر ۷۱٪ رہ گیا: ایجنٹ ثابت نہیں کر سکتا کہ محدود کردہ اجازتیں کافی ہوں گی۔',
      },
      because: [
        {
          en: 'Step "Publish release notes" invokes gh api with a subcommand assembled at runtime from ${{ env.RELEASE_MODE }}, so the required scope cannot be determined statically.',
          ur: 'سٹیپ "Publish release notes"، gh api کو ایسے سب کمانڈ کے ساتھ چلاتا ہے جو رن ٹائم پر ${{ env.RELEASE_MODE }} سے بنتا ہے، لہٰذا مطلوبہ دائرہ جامد تجزیے سے معلوم نہیں ہو سکتا۔',
        },
        {
          en: 'If RELEASE_MODE can take the value "announce", the step needs issues: write — a scope the proposed fix does not grant.',
          ur: 'اگر RELEASE_MODE کی قدر "announce" ہو سکتی ہے تو اس سٹیپ کو issues: write درکار ہوگا — جو تجویز کردہ حل نہیں دیتا۔',
        },
        {
          en: 'Applying the narrowed block could therefore break production deploys, which is a worse outcome than the risk it removes.',
          ur: 'اس لیے محدود بلاک لاگو کرنے سے پروڈکشن ڈیپلائے ٹوٹ سکتے ہیں، جو اُس خطرے سے بھی بدتر نتیجہ ہے جسے یہ ختم کرتا ہے۔',
        },
      ],
      citations: [
        { label: 'deploy-prod.yml:88', href: '/pipelines/pl_deploy_prod/config', kind: 'file' },
        { label: 'job deploy', href: '/pipelines/pl_deploy_prod/graph', kind: 'job' },
      ],
      confidenceAfter: 71,
      confidenceDelta: -17,
      durationMs: 2820,
    },
    {
      id: 's6',
      kind: 'decision',
      title: {
        en: 'Decision: flag for human review',
        ur: 'فیصلہ: انسانی جائزے کے لیے نشان زد',
      },
      claim: {
        en: 'Fix drafted and held. PR #487 opened as a draft; it will not be merged by the agent.',
        ur: 'حل تیار کر کے روک لیا گیا۔ PR #487 ڈرافٹ کے طور پر کھولا گیا؛ ایجنٹ اسے خود مرج نہیں کرے گا۔',
      },
      because: [
        {
          en: 'Confidence 71% is above the recommendation floor of 45% but below the auto-fix floor of 90%.',
          ur: '۷۱٪ اعتماد، ۴۵٪ کی سفارشی حد سے اوپر مگر ۹۰٪ کی خودکار حد سے نیچے ہے۔',
        },
        {
          en: 'Policy PG-DEP-002 forbids autonomous permission changes on any pipeline bound to a production environment, at any confidence.',
          ur: 'پالیسی PG-DEP-002، پروڈکشن ماحول سے منسلک کسی بھی پائپ لائن پر خودکار اجازتی تبدیلی سے منع کرتی ہے، اعتماد چاہے کتنا ہی ہو۔',
        },
        {
          en: 'The unresolved question is a one-line answer for the code owner: what values can RELEASE_MODE take?',
          ur: 'حل طلب سوال کوڈ مالک کے لیے ایک سطر کا جواب ہے: RELEASE_MODE کی ممکنہ اقدار کیا ہیں؟',
        },
      ],
      citations: [
        { label: 'PR #487 (draft)', href: '/fixes/fix_c73e9b', kind: 'commit' },
        { label: 'policy PG-DEP-002', href: '/policies/pol_dep_002', kind: 'policy' },
        { label: 'review queue', href: '/reviews', kind: 'policy' },
      ],
      confidenceAfter: 71,
      confidenceDelta: 0,
      durationMs: 1660,
    },
  ],
  gaps: [
    {
      missing: {
        en: 'The set of values ${{ env.RELEASE_MODE }} can take at runtime.',
        ur: 'رن ٹائم پر ${{ env.RELEASE_MODE }} کی ممکنہ اقدار کا مجموعہ۔',
      },
      wouldResolve: {
        en: 'A code owner confirming the enum, or one production run with RELEASE_MODE logged.',
        ur: 'کوڈ مالک کی جانب سے اقدار کی تصدیق، یا ایک ایسا پروڈکشن رن جس میں RELEASE_MODE لاگ ہوا ہو۔',
      },
      obtainableByAgent: false,
    },
    {
      missing: {
        en: 'Whether the release-notes failure that prompted this commit is actually a permissions failure.',
        ur: 'آیا ریلیز نوٹس کی وہ ناکامی جس کے باعث یہ کمِٹ ہوا، واقعی اجازتوں کا مسئلہ ہے۔',
      },
      wouldResolve: {
        en: 'The failing run log from before commit e17d3f0. PipelineGuard can fetch this once log-read scope is granted.',
        ur: 'کمِٹ e17d3f0 سے پہلے کے ناکام رن کا لاگ۔ لاگ پڑھنے کی اجازت ملنے پر PipelineGuard خود یہ حاصل کر سکتا ہے۔',
      },
      obtainableByAgent: true,
    },
  ],
  hypotheses: [],
  similarChanges: [
    {
      id: 'sc3',
      repo: 'northwind/payments-api',
      commit: '3d90ba2',
      summary: {
        en: 'write-all added to unblock a deploy, reverted 6 days later',
        ur: 'ڈیپلائے چلانے کے لیے write-all شامل کیا گیا، ۶ دن بعد واپس لے لیا گیا',
      },
      daysAgo: 87,
      outcome: 'reverted',
      similarity: 0.91,
    },
    {
      id: 'sc4',
      repo: 'northwind/ledger-worker',
      commit: 'ff2a018',
      summary: {
        en: 'packages: write granted to a job that did not need it',
        ur: 'ایک ایسی جاب کو packages: write دیا گیا جسے اس کی ضرورت نہیں تھی',
      },
      daysAgo: 167,
      outcome: 'incident',
      similarity: 0.77,
    },
  ],
  fix: null,
};

// ---------------------------------------------------------------------------
// 3. REFUSED -- two readings, not separable, so no action and no guess
// ---------------------------------------------------------------------------

const refused: Investigation = {
  id: 'inv_2a5d10',
  findingId: 'PG-1044',
  title: {
    en: 'Outbound POST of full event payload to an unresolvable destination',
    ur: 'مکمل ایونٹ پے لوڈ کی ایسی منزل کی طرف ترسیل جس کا تعین ممکن نہیں',
  },
  repo: 'northwind/checkout-service',
  pipeline: 'Release',
  pipelineId: 'pl_release',
  runId: 'run_1209',
  commit: '9ac4e22',
  commitMessage: 'feat: notify downstream on release',
  author: 'hamna.m',
  branch: 'feat/release-webhook',
  filePath: '.github/workflows/release.yml',
  severity: 'high',
  decision: 'refused',
  confidence: 38,
  startedAt: '2026-08-28T13:41:09Z',
  durationMs: 9640,
  thresholds: { autoFixFloor: 90, recommendFloor: 45 },
  steps: [
    {
      id: 's1',
      kind: 'detect',
      title: {
        en: 'Detected an outbound payload transmission',
        ur: 'باہر جانے والی پے لوڈ ترسیل کی نشاندہی',
      },
      claim: {
        en: 'A new job posts the entire GitHub event object to a URL held in an organisation variable.',
        ur: 'ایک نئی جاب مکمل GitHub ایونٹ آبجیکٹ کو ایسے URL پر بھیجتی ہے جو تنظیمی ویری ایبل میں محفوظ ہے۔',
      },
      because: [
        {
          en: 'release.yml line 61 runs curl -X POST "${{ vars.WEBHOOK_URL }}" -d "${{ toJSON(github.event) }}".',
          ur: 'release.yml کی لائن ۶۱ پر curl -X POST "${{ vars.WEBHOOK_URL }}" -d "${{ toJSON(github.event) }}" چلتا ہے۔',
        },
        {
          en: 'toJSON(github.event) on a release trigger includes repository metadata, tag name, and the committer email of every commit in the release.',
          ur: 'ریلیز ٹرگر پر toJSON(github.event) میں ریپوزٹری میٹا ڈیٹا، ٹیگ کا نام، اور ریلیز کے ہر کمِٹ کے کمِٹر کا ای میل شامل ہوتا ہے۔',
        },
        {
          en: 'No allowlist, no response check, and no TLS pinning on the destination.',
          ur: 'منزل کے لیے نہ کوئی اجازتی فہرست ہے، نہ جواب کی جانچ، اور نہ TLS پننگ۔',
        },
      ],
      citations: [
        { label: 'release.yml:61', href: '/pipelines/pl_release/config', kind: 'file' },
        { label: 'commit 9ac4e22', href: '/pipelines/pl_release/runs/run_1209', kind: 'commit' },
      ],
      confidenceAfter: 55,
      confidenceDelta: 55,
      durationMs: 810,
    },
    {
      id: 's2',
      kind: 'historical',
      title: {
        en: 'Searched history for precedent',
        ur: 'ماضی میں نظیر کی تلاش',
      },
      claim: {
        en: 'There is no precedent. This is the first occurrence of this pattern anywhere in the organisation.',
        ur: 'کوئی نظیر موجود نہیں۔ یہ پیٹرن پوری تنظیم میں پہلی بار ظاہر ہوا ہے۔',
      },
      because: [
        {
          en: '0 matching patterns in 180 days of history across all 12 monitored repositories.',
          ur: 'زیرِ نگرانی ۱۲ ریپوزٹریز کی ۱۸۰ دن کی ہسٹری میں ۰ مماثل پیٹرن۔',
        },
        {
          en: 'The job was introduced in this commit, so there is no prior successful run to compare against.',
          ur: 'یہ جاب اسی کمِٹ میں شامل ہوئی، اس لیے موازنے کے لیے کوئی سابقہ کامیاب رن موجود نہیں۔',
        },
        {
          en: 'Absence of precedent is not evidence of malice — most legitimate integrations also start with no precedent.',
          ur: 'نظیر کا نہ ہونا بدنیتی کا ثبوت نہیں — زیادہ تر جائز انضمام بھی بغیر نظیر کے ہی شروع ہوتے ہیں۔',
        },
      ],
      citations: [{ label: 'pattern search', href: '/history/patterns', kind: 'incident' }],
      confidenceAfter: 55,
      confidenceDelta: 0,
      durationMs: 2240,
    },
    {
      id: 's3',
      kind: 'dependency',
      title: {
        en: 'Could not resolve the destination',
        ur: 'منزل کا تعین نہ ہو سکا',
      },
      claim: {
        en: 'The destination host is unknowable with the access PipelineGuard currently holds.',
        ur: 'PipelineGuard کی موجودہ رسائی کے ساتھ منزل کے میزبان کا تعین ناممکن ہے۔',
      },
      because: [
        {
          en: 'vars.WEBHOOK_URL is an organisation-level variable; this installation was not granted organization_variables: read.',
          ur: 'vars.WEBHOOK_URL تنظیمی سطح کا ویری ایبل ہے؛ اس تنصیب کو organization_variables: read کی اجازت نہیں دی گئی۔',
        },
        {
          en: 'The value is not present in any run log, because the job has never run.',
          ur: 'یہ قدر کسی رن لاگ میں موجود نہیں، کیونکہ یہ جاب کبھی چلی ہی نہیں۔',
        },
        {
          en: 'Whether this finding is critical or routine depends entirely on that one unresolved string.',
          ur: 'یہ مسئلہ سنگین ہے یا معمولی، اس کا مکمل انحصار اسی ایک غیر حل شدہ سٹرنگ پر ہے۔',
        },
      ],
      citations: [
        { label: 'vars.WEBHOOK_URL', href: '/pipelines/pl_release/secrets', kind: 'file' },
        { label: 'agent permissions', href: '/agent/permissions', kind: 'policy' },
      ],
      confidenceAfter: 41,
      confidenceDelta: -14,
      durationMs: 2180,
    },
    {
      id: 's4',
      kind: 'impact',
      title: {
        en: 'Impact is bimodal, not a range',
        ur: 'اثر دو انتہاؤں پر ہے، کوئی درمیانی حد نہیں',
      },
      claim: {
        en: 'The two readings do not differ by degree. One is routine, the other is continuous disclosure.',
        ur: 'دونوں تعبیرات میں درجے کا فرق نہیں۔ ایک معمول کی بات ہے، دوسری مسلسل معلوماتی افشا ہے۔',
      },
      because: [
        {
          en: 'If the host is internal, this is an ordinary release notification and the correct action is none.',
          ur: 'اگر میزبان داخلی ہے تو یہ ایک عام ریلیز اطلاع ہے اور درست کارروائی یہ ہے کہ کچھ نہ کیا جائے۔',
        },
        {
          en: 'If the host is external and attacker-controlled, every release leaks committer emails and repository topology indefinitely.',
          ur: 'اگر میزبان بیرونی اور حملہ آور کے قابو میں ہے تو ہر ریلیز کمِٹرز کے ای میل اور ریپوزٹری کا ڈھانچہ مسلسل افشا کرے گی۔',
        },
        {
          en: 'Averaging these two into a single risk score would produce a number that describes neither.',
          ur: 'ان دونوں کو اوسط کر کے ایک رِسک سکور بنانا ایسا عدد دے گا جو کسی ایک کی بھی درست عکاسی نہیں کرتا۔',
        },
      ],
      citations: [{ label: 'CWE-200', href: null, kind: 'policy' }],
      confidenceAfter: 41,
      confidenceDelta: 0,
      durationMs: 1420,
    },
    {
      id: 's5',
      kind: 'confidence',
      title: {
        en: 'Hypotheses remain inseparable',
        ur: 'دونوں مفروضے الگ نہیں کیے جا سکے',
      },
      claim: {
        en: 'Confidence 38%. The leading and competing hypotheses are 11 points apart, inside the 15-point ambiguity band.',
        ur: 'اعتماد ۳۸٪۔ سرِفہرست اور مدِمقابل مفروضوں کے درمیان ۱۱ پوائنٹ کا فرق ہے، جو ۱۵ پوائنٹ کی مبہم حد کے اندر ہے۔',
      },
      because: [
        {
          en: 'Legitimate integration sits at 0.52; unreviewed exfiltration path at 0.41.',
          ur: 'جائز انضمام ۰.۵۲ پر ہے؛ غیر جانچا شدہ اخراجی راستہ ۰.۴۱ پر۔',
        },
        {
          en: 'The commit message and branch name support the benign reading; the absent allowlist and full-payload body support the risky one.',
          ur: 'کمِٹ پیغام اور برانچ کا نام بے ضرر تعبیر کی تائید کرتے ہیں؛ اجازتی فہرست کی غیر موجودگی اور مکمل پے لوڈ خطرناک تعبیر کی۔',
        },
        {
          en: 'No available evidence discriminates between them, so more analysis of the same data cannot help.',
          ur: 'دستیاب شواہد میں کوئی ایسی چیز نہیں جو ان میں فرق کر سکے، لہٰذا اسی ڈیٹا کے مزید تجزیے سے کوئی فائدہ نہیں۔',
        },
      ],
      citations: [],
      confidenceAfter: 38,
      confidenceDelta: -3,
      durationMs: 1490,
    },
    {
      id: 's6',
      kind: 'decision',
      title: {
        en: 'Decision: refuse to act',
        ur: 'فیصلہ: کارروائی سے انکار',
      },
      claim: {
        en: 'No fix drafted, no risk score published. Escalated as a question, not a verdict.',
        ur: 'نہ کوئی حل تیار کیا گیا، نہ رِسک سکور جاری کیا گیا۔ اسے فیصلے کے بجائے سوال کے طور پر آگے بھیجا گیا۔',
      },
      because: [
        {
          en: 'Confidence 38% is below the recommendation floor of 45%, so even a suggestion would overstate what is known.',
          ur: '۳۸٪ اعتماد، ۴۵٪ کی سفارشی حد سے کم ہے، لہٰذا محض تجویز دینا بھی معلوم حقائق سے زیادہ دعویٰ ہوگا۔',
        },
        {
          en: 'Drafting a fix would require assuming intent, and a wrong assumption here breaks a working release pipeline.',
          ur: 'حل تیار کرنے کے لیے نیت کے بارے میں مفروضہ باندھنا پڑے گا، اور یہاں غلط مفروضہ ایک چلتی ہوئی ریلیز پائپ لائن توڑ دے گا۔',
        },
        {
          en: 'One specific answer resolves this: the host that vars.WEBHOOK_URL points to. That question is routed to the code owner.',
          ur: 'صرف ایک مخصوص جواب اسے حل کر دے گا: vars.WEBHOOK_URL کس میزبان کی طرف اشارہ کرتا ہے۔ یہ سوال کوڈ مالک کو بھیج دیا گیا ہے۔',
        },
      ],
      citations: [
        { label: 'escalation', href: '/reviews', kind: 'policy' },
        { label: 'policy PG-AF-004', href: '/policies/pol_af_004', kind: 'policy' },
      ],
      confidenceAfter: 38,
      confidenceDelta: 0,
      durationMs: 1500,
    },
  ],
  gaps: [
    {
      missing: {
        en: 'The host that vars.WEBHOOK_URL resolves to.',
        ur: 'وہ میزبان جس کی طرف vars.WEBHOOK_URL اشارہ کرتا ہے۔',
      },
      wouldResolve: {
        en: 'Granting organization_variables: read, or a code owner stating the destination in one line.',
        ur: 'organization_variables: read کی اجازت دینا، یا کوڈ مالک کا ایک سطر میں منزل بتا دینا۔',
      },
      obtainableByAgent: true,
    },
    {
      missing: {
        en: 'Whether an egress allowlist exists at the runner network layer.',
        ur: 'آیا رنر نیٹ ورک کی سطح پر کوئی اخراجی اجازتی فہرست موجود ہے۔',
      },
      wouldResolve: {
        en: 'Runner network policy from the infrastructure team. PipelineGuard has no visibility below the workflow layer.',
        ur: 'انفراسٹرکچر ٹیم سے رنر کی نیٹ ورک پالیسی۔ ورک فلو کی سطح سے نیچے PipelineGuard کو کچھ نظر نہیں آتا۔',
      },
      obtainableByAgent: false,
    },
  ],
  hypotheses: [
    {
      label: {
        en: 'Legitimate internal release notification',
        ur: 'جائز داخلی ریلیز اطلاع',
      },
      probability: 0.52,
      supports: [
        { en: 'Branch name and commit message both describe a downstream notify feature.', ur: 'برانچ کا نام اور کمِٹ پیغام دونوں ڈاؤن اسٹریم اطلاع کی خصوصیت بیان کرتے ہیں۔' },
        { en: 'The URL is stored as an organisation variable, which is how internal endpoints are normally shared here.', ur: 'URL کو تنظیمی ویری ایبل میں رکھا گیا ہے، یہاں داخلی اینڈ پوائنٹس عموماً اسی طرح شیئر کیے جاتے ہیں۔' },
        { en: 'The author has 43 prior commits to this repository with no policy violations.', ur: 'مصنف کے اس ریپوزٹری میں ۴۳ سابقہ کمِٹس ہیں اور کوئی پالیسی خلاف ورزی نہیں۔' },
      ],
      contradicts: [
        { en: 'A purely internal notification would not normally need the full event payload.', ur: 'خالص داخلی اطلاع کو عموماً مکمل ایونٹ پے لوڈ کی ضرورت نہیں ہوتی۔' },
      ],
    },
    {
      label: {
        en: 'Unreviewed data egress path',
        ur: 'غیر جانچا شدہ ڈیٹا اخراجی راستہ',
      },
      probability: 0.41,
      supports: [
        { en: 'Full toJSON(github.event) is sent rather than selected fields.', ur: 'منتخب فیلڈز کے بجائے مکمل toJSON(github.event) بھیجا جا رہا ہے۔' },
        { en: 'No allowlist, no response validation, and failures are silently swallowed with || true.', ur: 'نہ اجازتی فہرست، نہ جواب کی توثیق، اور ناکامیاں || true کے ذریعے خاموشی سے نگل لی جاتی ہیں۔' },
        { en: 'An organisation variable can be changed by any org admin without a repository commit.', ur: 'تنظیمی ویری ایبل کو کوئی بھی آرگ ایڈمن بغیر ریپوزٹری کمِٹ کے تبدیل کر سکتا ہے۔' },
      ],
      contradicts: [
        { en: 'An intentional exfiltration path would more likely obfuscate the destination rather than store it in a named variable.', ur: 'جان بوجھ کر بنایا گیا اخراجی راستہ منزل کو نام والے ویری ایبل میں رکھنے کے بجائے چھپانے کی کوشش کرتا۔' },
      ],
    },
  ],
  similarChanges: [],
  fix: null,
};

export const investigations: Investigation[] = [autoFixed, flagged, refused];

/** The order the live demo walks through. Confident action, then restraint,
 *  then honest uncertainty. */
export const demoSequence = ['inv_8f21a4', 'inv_c73e9b', 'inv_2a5d10'] as const;
