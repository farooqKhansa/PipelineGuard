import type { Fix } from '@/lib/types';

/**
 * Generated fixes.
 *
 * Note what is absent: there is no fix for inv_2a5d10. The refusal scenario
 * deliberately produces no artefact. A drafted-but-withheld fix (the flagged
 * case) and no fix at all (the refusal) are different outcomes, and the
 * product must not blur them.
 */

const pinActions: Fix = {
  id: 'fix_8f21a4',
  investigationId: 'inv_8f21a4',
  title: {
    en: 'Pin both third-party actions to the commit SHA currently behind their tag',
    ur: 'دونوں تھرڈ پارٹی ایکشنز کو اُس کمِٹ SHA پر پن کریں جو اِس وقت اُن کے ٹیگ کے پیچھے ہے',
  },
  filePath: '.github/workflows/ci.yml',
  prevents: {
    en: 'Prevents an upstream maintainer silently repointing a tag to different code that then runs inside your build with access to artifacts consumed by a job holding packages: write.',
    ur: 'یہ روکتا ہے کہ کوئی اپ اسٹریم مینٹینر خاموشی سے ٹیگ کو مختلف کوڈ پر منتقل کر دے، جو پھر آپ کے بلڈ کے اندر ایسے آرٹیفیکٹس تک رسائی کے ساتھ چلے جنہیں packages: write رکھنے والی جاب استعمال کرتی ہے۔',
  },
  rationale: {
    en: 'SHA pinning is chosen over a version-range or a vendored copy because it is the only option that is both exact and reversible in one commit. The SHA selected is the one that ran in the last three green builds, so behaviour is observed rather than assumed. Renovate-style comments are added so the pins stay upgradable.',
    ur: 'SHA پننگ کو ورژن رینج یا ونڈرڈ کاپی پر ترجیح دی گئی کیونکہ یہی واحد طریقہ ہے جو بالکل درست بھی ہے اور ایک کمِٹ سے واپس بھی لیا جا سکتا ہے۔ منتخب SHA وہی ہے جو گزشتہ تین کامیاب بلڈز میں چلا، اس لیے رویّہ فرض نہیں کیا گیا بلکہ دیکھا گیا ہے۔ پنز کو قابلِ اپ گریڈ رکھنے کے لیے Renovate طرز کے تبصرے شامل کیے گئے ہیں۔',
  },
  status: 'applied',
  hunks: [
    {
      header: '@@ -31,8 +31,9 @@ jobs:',
      lines: [
        { type: 'context', oldLine: 31, newLine: 31, content: '  test:' },
        { type: 'context', oldLine: 32, newLine: 32, content: '    runs-on: ubuntu-latest' },
        { type: 'context', oldLine: 33, newLine: 33, content: '    steps:' },
        { type: 'remove', oldLine: 34, newLine: null, content: '      - uses: actions/cache@v3' },
        { type: 'add', oldLine: null, newLine: 34, content: '      # renovate: datasource=github-tags depName=actions/cache' },
        { type: 'add', oldLine: null, newLine: 35, content: '      - uses: actions/cache@1bd1e32a3bdc45362d1e726936510720a7c30a57 # v3.9.1' },
        { type: 'context', oldLine: 35, newLine: 36, content: '        with:' },
        { type: 'context', oldLine: 36, newLine: 37, content: '          path: ~/.npm' },
        { type: 'context', oldLine: 37, newLine: 38, content: "          key: npm-${{ hashFiles('**/package-lock.json') }}" },
      ],
    },
    {
      header: '@@ -44,7 +45,8 @@ jobs:',
      lines: [
        { type: 'context', oldLine: 44, newLine: 45, content: '      - name: Detect changed files' },
        { type: 'context', oldLine: 45, newLine: 46, content: '        id: changed' },
        { type: 'remove', oldLine: 46, newLine: null, content: '        uses: tj-actions/changed-files@v41' },
        { type: 'add', oldLine: null, newLine: 47, content: '        # renovate: datasource=github-tags depName=tj-actions/changed-files' },
        { type: 'add', oldLine: null, newLine: 48, content: '        uses: tj-actions/changed-files@dcc7a0cba800f454d79fff4b993e8c3555bcc0a8 # v41.0.1' },
        { type: 'context', oldLine: 47, newLine: 49, content: '        with:' },
        { type: 'context', oldLine: 48, newLine: 50, content: '          files: src/**' },
      ],
    },
  ],
  validation: {
    verified: true,
    method: {
      en: 'The patched workflow was executed on an ephemeral branch before the pull request was opened. The job was compared against run #1204 for step-level output equality.',
      ur: 'پُل ریکویسٹ کھولنے سے پہلے ترمیم شدہ ورک فلو ایک عارضی برانچ پر چلایا گیا۔ جاب کا موازنہ رن #1204 سے کیا گیا تاکہ ہر سٹیپ کا نتیجہ یکساں ثابت ہو۔',
    },
    checks: [
      {
        name: 'Resolved SHA matches tag at time of scan',
        status: 'passed',
        detail: {
          en: 'Both SHAs verified against the upstream Git ref API; tags resolved to the pinned commits.',
          ur: 'دونوں SHA اپ اسٹریم Git ref API سے تصدیق شدہ؛ ٹیگز پن کیے گئے کمِٹس پر ہی حل ہوئے۔',
        },
        durationMs: 420,
      },
      {
        name: 'Workflow syntax valid',
        status: 'passed',
        detail: {
          en: 'actionlint reported 0 errors and 0 warnings on the patched file.',
          ur: 'ترمیم شدہ فائل پر actionlint نے ۰ خرابیاں اور ۰ انتباہات رپورٹ کیے۔',
        },
        durationMs: 310,
      },
      {
        name: 'Job test completes',
        status: 'passed',
        detail: {
          en: 'Job finished in 2m 41s against a baseline of 2m 38s — a 1.9% difference, within normal run variance.',
          ur: 'جاب ۲ منٹ ۴۱ سیکنڈ میں مکمل ہوئی جبکہ بنیادی وقت ۲ منٹ ۳۸ سیکنڈ تھا — ۱.۹٪ فرق، جو معمول کے اتار چڑھاؤ میں شامل ہے۔',
        },
        durationMs: 161000,
      },
      {
        name: 'Step outputs identical to baseline',
        status: 'passed',
        detail: {
          en: 'Cache hit key and changed-files output byte-identical to run #1204.',
          ur: 'کیش ہٹ کی اور changed-files کا نتیجہ رن #1204 سے بالکل یکساں۔',
        },
        durationMs: 1200,
      },
      {
        name: 'Downstream job build unaffected',
        status: 'passed',
        detail: {
          en: 'Artifact coverage-report produced with the same digest, so build consumed identical input.',
          ur: 'آرٹیفیکٹ coverage-report اسی ڈائجسٹ کے ساتھ بنا، لہٰذا build کو بالکل یکساں ان پٹ ملا۔',
        },
        durationMs: 2400,
      },
    ],
  },
  pullRequest: {
    number: 486,
    title: 'security: pin actions/cache and tj-actions/changed-files to SHA',
    branch: 'pipelineguard/pin-actions-4b91c07',
    baseBranch: 'main',
    state: 'merged',
    additions: 4,
    deletions: 2,
    filesChanged: 1,
    reviewers: ['khansa.f'],
    body: {
      en: 'PipelineGuard pinned two third-party actions to the commit SHA their tag currently points at.\n\nWhy: a tag is mutable. Across this organisation, 3 of 3 previously tag-pinned actions resolved to different code within 90 days without any commit here, and runs #1184 and #1191 executed a 2-line-different entrypoint under the same v41 tag. No build failed, so nothing surfaced it.\n\nWhat this prevents: an upstream tag repoint running unreviewed code inside job test, which produces the artifact consumed by job build (packages: write).\n\nValidated: patched workflow ran on an ephemeral branch; job test completed in 2m41s vs 2m38s baseline with byte-identical step outputs and an identical artifact digest.\n\nTo revert: git revert this commit. Behaviour returns to tag tracking immediately.',
      ur: 'PipelineGuard نے دو تھرڈ پارٹی ایکشنز کو اُس کمِٹ SHA پر پن کر دیا ہے جس کی طرف اُن کا ٹیگ اِس وقت اشارہ کرتا ہے۔\n\nوجہ: ٹیگ تبدیل ہو سکتا ہے۔ اس تنظیم میں پہلے سے ٹیگ شدہ ۳ میں سے ۳ ایکشنز ۹۰ دن کے اندر مختلف کوڈ پر منتقل ہو گئے، حالانکہ یہاں کوئی کمِٹ نہیں ہوا تھا؛ اور رن #1184 اور #1191 نے ایک ہی v41 ٹیگ کے تحت ۲ لائن مختلف انٹری پوائنٹ چلایا۔ کوئی بلڈ ناکام نہیں ہوا، اس لیے کسی کو پتہ نہ چلا۔\n\nیہ کیا روکتا ہے: ٹیگ کی منتقلی سے غیر جانچا شدہ کوڈ جاب test کے اندر چلنا، جو وہ آرٹیفیکٹ بناتی ہے جسے جاب build (packages: write) استعمال کرتی ہے۔\n\nتصدیق: ترمیم شدہ ورک فلو عارضی برانچ پر چلایا گیا؛ جاب test ۲ منٹ ۴۱ سیکنڈ میں مکمل ہوئی (بنیاد: ۲ منٹ ۳۸ سیکنڈ)، ہر سٹیپ کا نتیجہ اور آرٹیفیکٹ ڈائجسٹ بالکل یکساں رہا۔\n\nواپسی کا طریقہ: اس کمِٹ پر git revert کریں۔ رویّہ فوراً ٹیگ ٹریکنگ پر واپس آ جائے گا۔',
    },
  },
};

const leastPrivilege: Fix = {
  id: 'fix_c73e9b',
  investigationId: 'inv_c73e9b',
  title: {
    en: 'Restore an explicit least-privilege permissions block, scoped per job',
    ur: 'ہر جاب کے لیے کم سے کم اجازت والا واضح بلاک بحال کریں',
  },
  filePath: '.github/workflows/deploy-prod.yml',
  prevents: {
    en: 'Prevents a compromised step in any of the five jobs from writing to production secrets and overwriting already-released container images — the exact failure mode of incident INC-2291.',
    ur: 'یہ روکتا ہے کہ پانچوں جابز میں سے کسی ایک کا متاثرہ سٹیپ پروڈکشن سیکرٹس پر لکھ سکے یا پہلے سے جاری شدہ کنٹینر امیجز کو اوور رائٹ کر دے — یعنی بالکل وہی ناکامی جو واقعہ INC-2291 میں پیش آئی تھی۔',
  },
  rationale: {
    en: 'Root-level write-all is replaced by the narrowest set each job demonstrably uses, derived from the scopes observed across the last 30 successful runs. Jobs notify and smoke-test are pinned to permissions: {} because 30 of 30 runs show they call no authenticated API. The one scope the agent could not derive statically — whether the release-notes step needs issues: write — is left as an explicit question in the PR body rather than guessed at.',
    ur: 'جڑ کی سطح پر write-all کی جگہ ہر جاب کے لیے وہ کم سے کم اجازتیں دی گئی ہیں جو وہ ثابت شدہ طور پر استعمال کرتی ہے، اور یہ گزشتہ ۳۰ کامیاب رنز میں دیکھے گئے دائروں سے اخذ کی گئی ہیں۔ جابز notify اور smoke-test کو permissions: {} دیا گیا کیونکہ ۳۰ میں سے ۳۰ رنز ظاہر کرتے ہیں کہ وہ کوئی مستند API کال نہیں کرتیں۔ جو ایک دائرہ ایجنٹ جامد تجزیے سے طے نہ کر سکا — کہ ریلیز نوٹس سٹیپ کو issues: write چاہیے یا نہیں — اسے اندازے سے بھرنے کے بجائے PR میں واضح سوال کے طور پر چھوڑا گیا ہے۔',
  },
  status: 'awaiting_review',
  hunks: [
    {
      header: '@@ -10,7 +10,5 @@ on:',
      lines: [
        { type: 'context', oldLine: 10, newLine: 10, content: 'concurrency: deploy-production' },
        { type: 'context', oldLine: 11, newLine: 11, content: '' },
        { type: 'remove', oldLine: 12, newLine: null, content: 'permissions: write-all' },
        { type: 'add', oldLine: null, newLine: 12, content: '# Least privilege at root; each job narrows further below.' },
        { type: 'add', oldLine: null, newLine: 13, content: 'permissions:' },
        { type: 'add', oldLine: null, newLine: 14, content: '  contents: read' },
        { type: 'context', oldLine: 13, newLine: 15, content: '' },
        { type: 'context', oldLine: 14, newLine: 16, content: 'jobs:' },
      ],
    },
    {
      header: '@@ -16,6 +18,9 @@ jobs:',
      lines: [
        { type: 'context', oldLine: 16, newLine: 18, content: '  build:' },
        { type: 'context', oldLine: 17, newLine: 19, content: '    runs-on: ubuntu-latest' },
        { type: 'add', oldLine: null, newLine: 20, content: '    permissions:' },
        { type: 'add', oldLine: null, newLine: 21, content: '      contents: read' },
        { type: 'add', oldLine: null, newLine: 22, content: '      packages: read' },
        { type: 'context', oldLine: 18, newLine: 23, content: '    steps:' },
        { type: 'context', oldLine: 19, newLine: 24, content: '      - uses: actions/checkout@v4' },
      ],
    },
    {
      header: '@@ -38,6 +43,11 @@ jobs:',
      lines: [
        { type: 'context', oldLine: 38, newLine: 43, content: '  deploy:' },
        { type: 'context', oldLine: 39, newLine: 44, content: '    needs: [build, smoke-test]' },
        { type: 'context', oldLine: 40, newLine: 45, content: '    environment: production' },
        { type: 'add', oldLine: null, newLine: 46, content: '    permissions:' },
        { type: 'add', oldLine: null, newLine: 47, content: '      contents: read' },
        { type: 'add', oldLine: null, newLine: 48, content: '      id-token: write      # OIDC exchange for the AWS role' },
        { type: 'add', oldLine: null, newLine: 49, content: '      deployments: write   # records the deployment status' },
        { type: 'add', oldLine: null, newLine: 50, content: '      packages: write      # pushes the release image' },
        { type: 'context', oldLine: 41, newLine: 51, content: '    steps:' },
        { type: 'context', oldLine: 42, newLine: 52, content: '      - uses: actions/checkout@v4' },
      ],
    },
    {
      header: '@@ -60,6 +70,8 @@ jobs:',
      lines: [
        { type: 'context', oldLine: 60, newLine: 70, content: '  notify:' },
        { type: 'context', oldLine: 61, newLine: 71, content: '    needs: [deploy]' },
        { type: 'add', oldLine: null, newLine: 72, content: '    # 30/30 recent runs make no authenticated API call from this job.' },
        { type: 'add', oldLine: null, newLine: 73, content: '    permissions: {}' },
        { type: 'context', oldLine: 62, newLine: 74, content: '    steps:' },
        { type: 'context', oldLine: 63, newLine: 75, content: '      - name: Post to Slack' },
      ],
    },
  ],
  validation: {
    verified: false,
    method: {
      en: 'Partially validated. The patched workflow was replayed against the last 30 successful runs in dry-run mode to confirm no observed API call falls outside the narrowed scopes. It was NOT executed against production, because doing so is exactly the risk under review.',
      ur: 'جزوی تصدیق۔ ترمیم شدہ ورک فلو کو گزشتہ ۳۰ کامیاب رنز کے خلاف ڈرائی رن موڈ میں دہرایا گیا تاکہ تصدیق ہو کہ کوئی مشاہدہ شدہ API کال محدود دائروں سے باہر نہیں۔ اسے پروڈکشن پر نہیں چلایا گیا، کیونکہ یہی وہ خطرہ ہے جو زیرِ غور ہے۔',
    },
    checks: [
      {
        name: 'Workflow syntax valid',
        status: 'passed',
        detail: {
          en: 'actionlint reported 0 errors on the patched file.',
          ur: 'ترمیم شدہ فائل پر actionlint نے ۰ خرابیاں رپورٹ کیں۔',
        },
        durationMs: 340,
      },
      {
        name: 'Observed API calls fit narrowed scopes',
        status: 'passed',
        detail: {
          en: '30 of 30 recent runs replayed: every authenticated call in build, smoke-test and notify is covered by the proposed block.',
          ur: 'گزشتہ ۳۰ میں سے ۳۰ رنز دہرائے گئے: build، smoke-test اور notify کی ہر مستند کال تجویز کردہ بلاک میں شامل ہے۔',
        },
        durationMs: 8400,
      },
      {
        name: 'Release-notes step scope derivable',
        status: 'failed',
        detail: {
          en: 'Could not determine required scope. The gh api subcommand is assembled at runtime from ${{ env.RELEASE_MODE }}; if that can be "announce", issues: write is needed and this fix would break the step.',
          ur: 'مطلوبہ دائرہ طے نہ ہو سکا۔ gh api کا سب کمانڈ رن ٹائم پر ${{ env.RELEASE_MODE }} سے بنتا ہے؛ اگر اس کی قدر "announce" ہو سکتی ہے تو issues: write درکار ہوگا اور یہ حل اُس سٹیپ کو توڑ دے گا۔',
        },
        durationMs: 2100,
      },
      {
        name: 'Production dry run',
        status: 'skipped',
        detail: {
          en: 'Not attempted. Policy PG-DEP-002 forbids the agent exercising a production deploy pipeline.',
          ur: 'کوشش نہیں کی گئی۔ پالیسی PG-DEP-002، ایجنٹ کو پروڈکشن ڈیپلائے پائپ لائن چلانے سے منع کرتی ہے۔',
        },
        durationMs: 0,
      },
      {
        name: 'Rollback path confirmed',
        status: 'passed',
        detail: {
          en: 'Single-commit revert restores the previous root block with no state migration.',
          ur: 'ایک کمِٹ کے revert سے سابقہ جڑ بلاک بحال ہو جاتا ہے، کوئی سٹیٹ منتقلی درکار نہیں۔',
        },
        durationMs: 180,
      },
    ],
  },
  pullRequest: {
    number: 487,
    title: 'security: restore least-privilege permissions on deploy-prod',
    branch: 'pipelineguard/least-privilege-e17d3f0',
    baseBranch: 'main',
    state: 'draft',
    additions: 17,
    deletions: 1,
    filesChanged: 1,
    reviewers: ['hamna.m', 'sara.a'],
    body: {
      en: 'DRAFT — PipelineGuard will not merge this. A human owner must decide.\n\nCommit e17d3f0 replaced an explicit 4-scope permissions block with permissions: write-all at workflow root, which applies to all 5 jobs — including notify and smoke-test, which previously held none.\n\nWhat this prevents: a compromised step in any of the 5 jobs writing to production secrets and overwriting released container images. This is the precondition that caused INC-2291 on 14 March.\n\nWhy this is a draft and not an applied fix: I cannot statically prove the narrowed set is sufficient. The step "Publish release notes" builds a gh api subcommand at runtime from ${{ env.RELEASE_MODE }}. If that variable can take the value "announce", the step needs issues: write, which this patch does not grant — and applying it would break production deploys.\n\nONE QUESTION unblocks this: what values can RELEASE_MODE take? If "announce" is not one of them, this patch is safe to merge as-is. If it is, add issues: write to the deploy job and it is equally safe.\n\nEvidence: 30 of 30 recent runs replayed in dry-run; every other authenticated call fits the proposed scopes. Rollback is a single-commit revert.',
      ur: 'ڈرافٹ — PipelineGuard اسے خود مرج نہیں کرے گا۔ فیصلہ کسی انسانی مالک کو کرنا ہوگا۔\n\nکمِٹ e17d3f0 نے ۴ مخصوص اجازتوں والے بلاک کی جگہ ورک فلو کی جڑ پر permissions: write-all رکھ دیا، جو پانچوں جابز پر لاگو ہوتا ہے — بشمول notify اور smoke-test، جن کے پاس پہلے کوئی اجازت نہیں تھی۔\n\nیہ کیا روکتا ہے: پانچوں جابز میں سے کسی متاثرہ سٹیپ کا پروڈکشن سیکرٹس پر لکھنا اور جاری شدہ کنٹینر امیجز کو اوور رائٹ کرنا۔ یہی وہ پیشگی شرط ہے جس سے ۱۴ مارچ کو INC-2291 پیش آیا۔\n\nیہ ڈرافٹ کیوں ہے، لاگو شدہ حل کیوں نہیں: میں جامد تجزیے سے ثابت نہیں کر سکتا کہ محدود اجازتیں کافی ہیں۔ سٹیپ "Publish release notes"، رن ٹائم پر ${{ env.RELEASE_MODE }} سے gh api کا سب کمانڈ بناتا ہے۔ اگر اس ویری ایبل کی قدر "announce" ہو سکتی ہے تو اُسے issues: write چاہیے، جو یہ پیچ نہیں دیتا — اور اسے لاگو کرنے سے پروڈکشن ڈیپلائے ٹوٹ جائیں گے۔\n\nایک سوال اسے کھول دے گا: RELEASE_MODE کی ممکنہ اقدار کیا ہیں؟ اگر "announce" ان میں شامل نہیں تو یہ پیچ جوں کا توں مرج کرنا محفوظ ہے۔ اگر شامل ہے تو deploy جاب میں issues: write شامل کر دیں، تب بھی اتنا ہی محفوظ ہے۔\n\nشواہد: گزشتہ ۳۰ میں سے ۳۰ رنز ڈرائی رن میں دہرائے گئے؛ باقی ہر مستند کال تجویز کردہ دائروں میں آتی ہے۔ واپسی ایک کمِٹ کے revert سے ممکن ہے۔',
    },
  },
};

export const fixes: Fix[] = [pinActions, leastPrivilege];

export const fixById = (id: string) => fixes.find((f) => f.id === id) ?? null;
export const fixByInvestigation = (investigationId: string) =>
  fixes.find((f) => f.investigationId === investigationId) ?? null;
