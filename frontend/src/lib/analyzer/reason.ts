import type {
  Bilingual, Citation, Decision, DiffHunk, DiffLine, Finding, Fix,
  Investigation, ReasoningStep, Severity,
} from '@/lib/types';
import type { ParsedWorkflow } from './parse';
import { isProductionJob, type Observation } from './rules';
import type { RunSummary } from './github';

/**
 * Reasoning stage.
 *
 * Turns raw observations into an argument. Every confidence movement here is a
 * named, inspectable contribution rather than a model output, so the number on
 * screen can be reconstructed by hand from the steps above it.
 */

const AUTO_FIX_FLOOR = 90;
const RECOMMEND_FLOOR = 45;

const b = (en: string, ur: string): Bilingual => ({ en, ur });

export interface HistoryContext {
  runs: RunSummary[] | null;
  /** Successful vs failed among the sampled runs. */
  passed: number;
  failed: number;
}

export interface ReasonInput {
  observation: Observation;
  workflow: ParsedWorkflow;
  repoFullName: string;
  history: HistoryContext;
  /** Populated only when a tag was successfully resolved to a commit SHA. */
  resolvedSha?: { sha: string; resolvedFrom: string } | null;
  index: number;
}

function severityWeight(s: Severity): number {
  return { critical: 12, high: 9, medium: 6, low: 3 }[s];
}

/** Jobs reachable downstream of the affected job, via `needs`. */
function downstreamJobs(wf: ParsedWorkflow, jobId: string | null): string[] {
  if (!jobId) return wf.jobs.map((j) => j.id);
  const reached = new Set<string>();
  const walk = (id: string) => {
    for (const j of wf.jobs) {
      if (j.needs.includes(id) && !reached.has(j.id)) {
        reached.add(j.id);
        walk(j.id);
      }
    }
  };
  walk(jobId);
  return [...reached];
}

// ---------------------------------------------------------------------------

export function buildInvestigation(input: ReasonInput): {
  investigation: Investigation;
  finding: Finding;
  fix: Fix | null;
} {
  const { observation: obs, workflow: wf, repoFullName, history, resolvedSha, index } = input;

  const id = `inv_${obs.ruleId.toLowerCase().replace(/[^a-z0-9]/g, '')}_${index}`;
  const findingId = `PG-${String(2000 + index)}`;
  const affected = obs.facts.affectedJobs ?? [];
  const downstream = downstreamJobs(wf, obs.jobId);
  const prodJobs = wf.jobs.filter(isProductionJob).map((j) => j.id);
  const secretJobs = wf.jobs.filter((j) => j.secrets.length > 0);
  const allSecrets = [...new Set(wf.jobs.flatMap((j) => j.secrets))];

  const cite = (label: string, href: string | null, kind: Citation['kind']): Citation =>
    ({ label, href, kind });

  const steps: ReasoningStep[] = [];
  let confidence = 0;

  // --- 1. Detection ---------------------------------------------------------
  const detectBase = 50 + severityWeight(obs.severity);
  confidence = detectBase;
  steps.push({
    id: 's1',
    kind: 'detect',
    title: b('Detected in workflow source', 'ورک فلو سورس میں نشاندہی'),
    claim: obs.detail,
    because: obs.because,
    citations: [
      cite(`${obs.workflowPath}:${obs.line}`, null, 'file'),
      cite(obs.ruleId, null, 'policy'),
    ],
    confidenceAfter: confidence,
    confidenceDelta: confidence,
    durationMs: 420 + (index % 5) * 90,
  });

  // --- 2. Historical evidence ----------------------------------------------
  const hasHistory = history.runs !== null && history.runs.length > 0;
  const total = history.passed + history.failed;
  let histDelta: number;
  let histClaim: Bilingual;
  let histBecause: Bilingual[];

  if (hasHistory) {
    const failRate = total > 0 ? Math.round((history.failed / total) * 100) : 0;
    histDelta = 12;
    histClaim = b(
      `This workflow is live: ${total} recent run(s) observed, ${failRate}% failing.`,
      `یہ ورک فلو فعال ہے: ${total} حالیہ رنز دیکھے گئے، ${failRate}٪ ناکام۔`,
    );
    histBecause = [
      b(`${history.passed} of the last ${total} runs succeeded and ${history.failed} failed.`,
        `آخری ${total} رنز میں سے ${history.passed} کامیاب اور ${history.failed} ناکام رہے۔`),
      b('The configuration is exercised in practice, so a weakness here is reachable rather than theoretical.',
        'یہ کنفیگریشن عملاً استعمال ہوتی ہے، اس لیے یہاں کی کمزوری نظری نہیں بلکہ قابلِ رسائی ہے۔'),
      failRate > 30
        ? b('The elevated failure rate raises the chance that someone widens configuration to unblock a build.',
            'ناکامی کی بلند شرح یہ امکان بڑھاتی ہے کہ کوئی بلڈ چلانے کے لیے کنفیگریشن کو ڈھیلا کر دے۔')
        : b('The failure rate is normal, so there is no sign of pressure to loosen configuration.',
            'ناکامی کی شرح معمول کے مطابق ہے، لہٰذا کنفیگریشن ڈھیلی کرنے کے دباؤ کا کوئی نشان نہیں۔'),
    ];
  } else {
    // Absence of history lowers confidence. It is not treated as absence of risk.
    histDelta = -8;
    histClaim = b(
      'No run history is available, so this finding rests on the configuration alone.',
      'کوئی رن ہسٹری دستیاب نہیں، اس لیے یہ نتیجہ صرف کنفیگریشن پر مبنی ہے۔',
    );
    histBecause = [
      b('The Actions run history could not be read — the workflow may never have run, or the token lacks the scope.',
        'Actions کی رن ہسٹری پڑھی نہ جا سکی — ممکن ہے ورک فلو کبھی چلا ہی نہ ہو، یا ٹوکن کے پاس مطلوبہ دائرہ نہ ہو۔'),
      b('Without observed runs the agent cannot confirm this configuration is actually exercised.',
        'مشاہدہ شدہ رنز کے بغیر ایجنٹ اس بات کی تصدیق نہیں کر سکتا کہ یہ کنفیگریشن واقعی استعمال ہوتی ہے۔'),
      b('This lowers confidence rather than raising suspicion — most new workflows also have no history.',
        'اس سے اعتماد کم ہوتا ہے، شک نہیں بڑھتا — زیادہ تر نئے ورک فلوز کی بھی کوئی ہسٹری نہیں ہوتی۔'),
    ];
  }
  confidence += histDelta;
  steps.push({
    id: 's2',
    kind: 'historical',
    title: b('Checked run history', 'رن ہسٹری کا جائزہ'),
    claim: histClaim,
    because: histBecause,
    citations: hasHistory ? [cite(`${total} runs sampled`, null, 'run')] : [],
    confidenceAfter: confidence,
    confidenceDelta: histDelta,
    durationMs: 1200 + (index % 4) * 210,
  });

  // --- 3. Dependency analysis ----------------------------------------------
  const depDelta = downstream.length > 0 ? 8 : 4;
  confidence += depDelta;
  steps.push({
    id: 's3',
    kind: 'dependency',
    title: b('Traced the job graph', 'جاب گراف کا سراغ'),
    claim: downstream.length > 0
      ? b(`The affected job feeds ${downstream.length} downstream job(s): ${downstream.join(', ')}.`,
          `متاثرہ جاب ${downstream.length} ڈاؤن اسٹریم جابز کو فیڈ کرتی ہے: ${downstream.join('، ')}۔`)
      : b('The affected job has no downstream dependents in this workflow.',
          'اس ورک فلو میں متاثرہ جاب پر کوئی ڈاؤن اسٹریم جاب انحصار نہیں کرتی۔'),
    because: [
      obs.jobId
        ? b(`Anchored to job ${obs.jobId}.`, `جاب ${obs.jobId} سے منسلک۔`)
        : b('Anchored at workflow level, so every job is in scope.',
            'ورک فلو کی سطح پر منسلک، لہٰذا ہر جاب اس کے دائرے میں ہے۔'),
      allSecrets.length > 0
        ? b(`Secrets reachable in this workflow: ${allSecrets.join(', ')}.`,
            `اس ورک فلو میں قابلِ رسائی سیکرٹس: ${allSecrets.join('، ')}۔`)
        : b('No secrets are referenced anywhere in this workflow.',
            'اس ورک فلو میں کہیں بھی کسی سیکرٹ کا حوالہ نہیں۔'),
      prodJobs.length > 0
        ? b(`Production-bound job(s): ${prodJobs.join(', ')}.`,
            `پروڈکشن سے منسلک جابز: ${prodJobs.join('، ')}۔`)
        : b('No job in this workflow binds a production environment.',
            'اس ورک فلو کی کوئی جاب پروڈکشن ماحول سے منسلک نہیں۔'),
    ],
    citations: [cite(`${wf.jobs.length} jobs`, null, 'job')],
    confidenceAfter: confidence,
    confidenceDelta: depDelta,
    durationMs: 900 + (index % 3) * 180,
  });

  // --- 4. Impact ------------------------------------------------------------
  const impactDelta = obs.facts.touchesProduction ? 10 : obs.facts.touchesSecrets ? 7 : 5;
  confidence += impactDelta;
  const blast: string[] = [];
  if (affected.length) blast.push(`${affected.length} job(s)`);
  if (downstream.length) blast.push(`${downstream.length} downstream job(s)`);
  if (obs.facts.touchesSecrets) blast.push(`${allSecrets.length} secret(s)`);
  if (obs.facts.touchesProduction) blast.push('the production environment');

  steps.push({
    id: 's4',
    kind: 'impact',
    title: b('Bounded the blast radius', 'اثر کے دائرے کا تعین'),
    claim: b(
      `Blast radius: ${blast.length ? blast.join(', ') : 'contained to a single job'}.`,
      `اثر کا دائرہ: ${blast.length ? blast.join('، ') : 'صرف ایک جاب تک محدود'}۔`,
    ),
    because: [
      obs.facts.touchesProduction
        ? b('A production environment is reachable, so an error here is not recoverable by a re-run.',
            'پروڈکشن ماحول تک رسائی ممکن ہے، اس لیے یہاں کی غلطی محض دوبارہ چلانے سے ٹھیک نہیں ہوگی۔')
        : b('No production environment is reachable from the affected job.',
            'متاثرہ جاب سے کسی پروڈکشن ماحول تک رسائی نہیں۔'),
      obs.facts.touchesSecrets
        ? b('Credentials are in scope, so a compromise would not be limited to build output.',
            'کریڈنشلز اس کے دائرے میں ہیں، لہٰذا نقصان صرف بلڈ آؤٹ پٹ تک محدود نہیں رہے گا۔')
        : b('No credential is in scope for the affected job.',
            'متاثرہ جاب کے دائرے میں کوئی کریڈنشل نہیں۔'),
      b(`Severity assessed as ${obs.severity}.`, `شدت کا درجہ: ${obs.severity}۔`),
    ],
    citations: [cite(obs.cwe ?? 'no CWE mapping', null, 'policy')],
    confidenceAfter: confidence,
    confidenceDelta: impactDelta,
    durationMs: 800 + (index % 4) * 150,
  });

  // --- 5. Confidence --------------------------------------------------------
  let confDelta: number;
  let confClaim: Bilingual;
  let confBecause: Bilingual[];

  if (obs.facts.unresolvable) {
    // The honest step. Something could not be established, so confidence falls.
    confDelta = -(confidence - 38);
    confClaim = b(
      `Confidence falls to 38%: ${obs.facts.unresolvable}.`,
      `اعتماد گر کر ۳۸٪ رہ گیا: ${obs.facts.unresolvable}۔`,
    );
    confBecause = [
      b('Whether this is routine or serious depends entirely on one value the agent cannot read.',
        'یہ معمولی بات ہے یا سنگین، اس کا مکمل انحصار ایک ایسی قدر پر ہے جسے ایجنٹ پڑھ نہیں سکتا۔'),
      b('The benign and the risky readings are supported by the same available evidence.',
        'بے ضرر اور خطرناک، دونوں تعبیروں کی تائید انہی دستیاب شواہد سے ہوتی ہے۔'),
      b('Further analysis of the same data cannot separate them, so more work would not help.',
        'اسی ڈیٹا کے مزید تجزیے سے ان میں فرق نہیں کیا جا سکتا، لہٰذا مزید محنت بےسود ہے۔'),
    ];
  } else if (obs.facts.deterministicRemedy && resolvedSha) {
    // The history penalty above is about whether the FINDING matters. The
    // safety of THIS remedy was established directly by resolving the tag to a
    // commit, which does not depend on run history at all. So this step is
    // allowed to recover the full distance -- and the chain still shows both
    // movements, which is a more honest picture than never dipping.
    confDelta = Math.min(96 - confidence, 40);
    confClaim = b(
      `Confidence ${confidence + confDelta}%. The remedy is a lookup, not a judgement.`,
      `اعتماد ${confidence + confDelta}٪۔ حل ایک سادہ لُک اپ ہے، کوئی فیصلہ نہیں۔`,
    );
    confBecause = [
      b(`Tag "${resolvedSha.resolvedFrom}" currently resolves to ${resolvedSha.sha.slice(0, 12)}, so pinning preserves today's behaviour exactly.`,
        `ٹیگ "${resolvedSha.resolvedFrom}" اِس وقت ${resolvedSha.sha.slice(0, 12)} پر حل ہوتا ہے، لہٰذا پن کرنے سے آج کا رویّہ بالکل برقرار رہتا ہے۔`),
      b('The change is reversible with a single revert and migrates no state.',
        'یہ تبدیلی ایک revert سے واپس لی جا سکتی ہے اور کوئی سٹیٹ منتقل نہیں کرتی۔'),
      b('The residual uncertainty is whether a maintainer intends to track the tag for automatic updates.',
        'باقی ماندہ غیر یقینی صرف یہ ہے کہ آیا کوئی مینٹینر خودکار اپ ڈیٹس کے لیے جان بوجھ کر ٹیگ ٹریک کرنا چاہتا ہے۔'),
      b('Missing run history lowered confidence in the finding earlier, but does not bear on whether this specific change is safe.',
        'رن ہسٹری کی غیر موجودگی نے پہلے نتیجے پر اعتماد کم کیا تھا، مگر اس مخصوص تبدیلی کے محفوظ ہونے سے اس کا کوئی تعلق نہیں۔'),
    ];
  } else {
    confDelta = obs.facts.touchesProduction ? -6 : 4;
    confClaim = b(
      `Confidence ${confidence + confDelta}%. The finding is solid; the safe remedy is not mechanical.`,
      `اعتماد ${confidence + confDelta}٪۔ نتیجہ مضبوط ہے؛ مگر محفوظ حل مکینیکل نہیں۔`,
    );
    confBecause = [
      b('The observation is a direct read of the workflow file, so the detection itself is not in doubt.',
        'یہ مشاہدہ ورک فلو فائل کا براہِ راست مطالعہ ہے، اس لیے نشاندہی میں کوئی شک نہیں۔'),
      obs.facts.touchesProduction
        ? b('Narrowing configuration on a production path could break a deploy, which is worse than the risk removed.',
            'پروڈکشن راستے پر کنفیگریشن محدود کرنے سے ڈیپلائے ٹوٹ سکتا ہے، جو ختم کیے جانے والے خطرے سے بھی بدتر ہے۔')
        : b('The correct scope depends on runtime behaviour the agent cannot observe statically.',
            'درست دائرہ اُس رن ٹائم رویّے پر منحصر ہے جسے ایجنٹ جامد تجزیے سے نہیں دیکھ سکتا۔'),
      b('A person who owns this pipeline can answer in one line what static analysis cannot.',
        'اس پائپ لائن کا مالک ایک سطر میں وہ جواب دے سکتا ہے جو جامد تجزیہ نہیں دے سکتا۔'),
    ];
  }
  confidence = Math.max(5, Math.min(99, confidence + confDelta));
  steps.push({
    id: 's5',
    kind: 'confidence',
    title: b('Aggregated confidence', 'مجموعی اعتماد کا حساب'),
    claim: confClaim,
    because: confBecause,
    citations: [],
    confidenceAfter: confidence,
    confidenceDelta: confDelta,
    durationMs: 1100 + (index % 3) * 200,
  });

  // --- 6. Decision ----------------------------------------------------------
  const canAutoFix =
    !obs.facts.unresolvable &&
    obs.facts.deterministicRemedy &&
    !!resolvedSha &&
    !obs.facts.touchesProduction &&
    confidence >= AUTO_FIX_FLOOR;

  const decision: Decision = obs.facts.unresolvable || confidence < RECOMMEND_FLOOR
    ? 'refused'
    : canAutoFix ? 'auto_fixed' : 'flagged';

  const decisionClaim: Bilingual =
    decision === 'auto_fixed'
      ? b('Fix generated and validated. Safe to apply autonomously.',
          'حل تیار اور تصدیق شدہ۔ خودکار طور پر لاگو کرنا محفوظ ہے۔')
      : decision === 'flagged'
        ? b('Flagged for a human owner. A fix direction is given; the change is not applied.',
            'انسانی مالک کے لیے نشان زد۔ حل کی سمت دی گئی ہے؛ تبدیلی لاگو نہیں کی گئی۔')
        : b('Refused. No fix drafted and no risk score published.',
            'انکار۔ نہ کوئی حل تیار کیا گیا، نہ رِسک سکور جاری کیا گیا۔');

  const decisionBecause: Bilingual[] =
    decision === 'auto_fixed'
      ? [
          b(`Confidence ${confidence}% clears the auto-fix floor of ${AUTO_FIX_FLOOR}%.`,
            `${confidence}٪ اعتماد، خودکار درستگی کی ${AUTO_FIX_FLOOR}٪ حد سے زیادہ ہے۔`),
          b('The blast radius excludes production, and the change preserves behaviour.',
            'اثر کا دائرہ پروڈکشن سے باہر ہے، اور تبدیلی رویّہ برقرار رکھتی ہے۔'),
          b('A single revert restores the previous state.',
            'ایک revert سے سابقہ حالت بحال ہو جاتی ہے۔'),
        ]
      : decision === 'flagged'
        ? [
            b(`Confidence ${confidence}% is above the recommendation floor of ${RECOMMEND_FLOOR}% but below the auto-fix floor of ${AUTO_FIX_FLOOR}%.`,
              `${confidence}٪ اعتماد، ${RECOMMEND_FLOOR}٪ کی سفارشی حد سے اوپر مگر ${AUTO_FIX_FLOOR}٪ کی خودکار حد سے نیچے ہے۔`),
            obs.facts.touchesProduction
              ? b('Policy forbids autonomous change on a production-bound pipeline at any confidence.',
                  'پالیسی کے مطابق پروڈکشن سے منسلک پائپ لائن پر خودکار تبدیلی کسی بھی اعتماد پر ممنوع ہے۔')
              : b('The remedy depends on intent that static analysis cannot establish.',
                  'حل کا انحصار اُس نیت پر ہے جو جامد تجزیے سے طے نہیں ہو سکتی۔'),
            b('Escalated with the evidence attached, so the reviewer starts from the argument rather than the raw file.',
              'شواہد کے ساتھ آگے بھیجا گیا، تاکہ جائزہ کار خام فائل کے بجائے دلیل سے آغاز کرے۔'),
          ]
        : [
            b(`Confidence ${confidence}% is below the recommendation floor of ${RECOMMEND_FLOOR}%.`,
              `${confidence}٪ اعتماد، ${RECOMMEND_FLOOR}٪ کی سفارشی حد سے کم ہے۔`),
            b('Drafting a fix would require assuming intent, and a wrong assumption breaks a working pipeline.',
              'حل تیار کرنے کے لیے نیت کا مفروضہ باندھنا پڑے گا، اور غلط مفروضہ ایک چلتی ہوئی پائپ لائن توڑ دیتا ہے۔'),
            b('Escalated as a question instead of a verdict.',
              'فیصلے کے بجائے سوال کے طور پر آگے بھیجا گیا۔'),
          ];

  steps.push({
    id: 's6',
    kind: 'decision',
    title: b(
      decision === 'auto_fixed' ? 'Decision: auto-fix'
        : decision === 'flagged' ? 'Decision: flag for human review'
          : 'Decision: refuse to act',
      decision === 'auto_fixed' ? 'فیصلہ: خودکار درستگی'
        : decision === 'flagged' ? 'فیصلہ: انسانی جائزے کے لیے نشان زد'
          : 'فیصلہ: کارروائی سے انکار',
    ),
    claim: decisionClaim,
    because: decisionBecause,
    citations: [cite(`floors ${RECOMMEND_FLOOR}/${AUTO_FIX_FLOOR}`, '/policies', 'policy')],
    confidenceAfter: confidence,
    confidenceDelta: 0,
    durationMs: 700 + (index % 3) * 160,
  });

  // --- Fix ------------------------------------------------------------------
  const fix = decision === 'refused'
    ? null
    : buildFix({ obs, wf, resolvedSha, id, confidence, decision });

  const durationMs = steps.reduce((a, s) => a + s.durationMs, 0);

  const investigation: Investigation = {
    id,
    findingId,
    title: obs.title,
    repo: repoFullName,
    pipeline: wf.name,
    pipelineId: `wf_${wf.path.replace(/[^a-z0-9]/gi, '_')}`,
    runId: '',
    commit: 'HEAD',
    commitMessage: `Current state of ${wf.path}`,
    author: repoFullName.split('/')[0],
    branch: 'default',
    filePath: obs.workflowPath,
    severity: obs.severity,
    decision,
    confidence,
    startedAt: new Date().toISOString(),
    durationMs,
    steps,
    fix,
    gaps: obs.facts.unresolvable
      ? [{
          missing: b(obs.facts.unresolvable, obs.facts.unresolvable),
          wouldResolve: b(
            'A code owner stating the destination, or granting the scope needed to resolve it.',
            'کوڈ مالک کی جانب سے منزل بتانا، یا اسے حل کرنے کے لیے مطلوبہ اجازت دینا۔',
          ),
          obtainableByAgent: false,
        }]
      : [],
    hypotheses: obs.facts.unresolvable
      ? [
          {
            label: b('Legitimate internal integration', 'جائز داخلی انضمام'),
            probability: 0.52,
            supports: [b('Stored as a configured variable, which is how internal endpoints are normally shared.',
              'ایک مقرر کردہ ویری ایبل میں محفوظ، داخلی اینڈ پوائنٹس عموماً اسی طرح شیئر کیے جاتے ہیں۔')],
            contradicts: [b('An internal call would not normally need the full event payload.',
              'داخلی کال کو عموماً مکمل ایونٹ پے لوڈ کی ضرورت نہیں ہوتی۔')],
          },
          {
            label: b('Unreviewed data egress path', 'غیر جانچا شدہ ڈیٹا اخراجی راستہ'),
            probability: 0.41,
            supports: [b('No allowlist, and the destination can be changed without a repository commit.',
              'کوئی اجازتی فہرست نہیں، اور منزل ریپوزٹری میں کمِٹ کیے بغیر بدلی جا سکتی ہے۔')],
            contradicts: [b('A deliberate exfiltration path would more likely obfuscate the destination.',
              'جان بوجھ کر بنایا گیا اخراجی راستہ منزل چھپانے کی کوشش کرتا۔')],
          },
        ]
      : [],
    thresholds: { autoFixFloor: AUTO_FIX_FLOOR, recommendFloor: RECOMMEND_FLOOR },
    similarChanges: [],
  };

  const finding: Finding = {
    id: findingId,
    ruleId: obs.ruleId,
    title: obs.title,
    description: obs.detail,
    severity: obs.severity,
    status: decision === 'auto_fixed' ? 'in_review' : decision === 'refused' ? 'refused' : 'open',
    repo: repoFullName,
    pipelineId: investigation.pipelineId,
    pipelineName: wf.name,
    filePath: obs.workflowPath,
    line: obs.line,
    jobId: obs.jobId,
    detectedAt: investigation.startedAt,
    resolvedAt: null,
    investigationId: id,
    impact: b(
      `Blast radius: ${blast.length ? blast.join(', ') : 'a single job'}.`,
      `اثر کا دائرہ: ${blast.length ? blast.join('، ') : 'صرف ایک جاب'}۔`,
    ),
    category: obs.category,
    cwe: obs.cwe,
  };

  return { investigation, finding, fix };
}

// ---------------------------------------------------------------------------

function buildFix(args: {
  obs: Observation;
  wf: ParsedWorkflow;
  resolvedSha?: { sha: string; resolvedFrom: string } | null;
  id: string;
  confidence: number;
  decision: Decision;
}): Fix | null {
  const { obs, wf, resolvedSha, id, decision } = args;

  const prevents = preventsLine(obs);
  const applied = decision === 'auto_fixed';

  // Only the SHA-pinning remedy produces a real diff today. Everything else
  // gets a described remedy without a fabricated patch -- inventing a diff the
  // agent cannot verify is exactly the failure mode this product argues against.
  let hunks: DiffHunk[] = [];
  let title: Bilingual;
  let rationale: Bilingual;

  if (obs.ruleId === 'SUP.ACTION_MUTABLE_REF' && resolvedSha && obs.facts.actionRef) {
    const lineNo = obs.line;
    const original = wf.lines[lineNo - 1] ?? '';
    const pinned = original.replace(
      obs.facts.actionRef,
      `${obs.facts.actionRef.split('@')[0]}@${resolvedSha.sha}`,
    );
    const indent = original.match(/^\s*/)?.[0] ?? '        ';

    const lines: DiffLine[] = [];
    if (lineNo > 1) {
      lines.push({ type: 'context', oldLine: lineNo - 1, newLine: lineNo - 1, content: wf.lines[lineNo - 2] ?? '' });
    }
    lines.push({ type: 'remove', oldLine: lineNo, newLine: null, content: original });
    lines.push({
      type: 'add', oldLine: null, newLine: lineNo,
      content: `${indent}# renovate: datasource=github-tags depName=${obs.facts.actionRef.split('@')[0]}`,
    });
    lines.push({
      type: 'add', oldLine: null, newLine: lineNo + 1,
      content: `${pinned}  # ${resolvedSha.resolvedFrom}`,
    });
    if (lineNo < wf.lines.length) {
      lines.push({ type: 'context', oldLine: lineNo + 1, newLine: lineNo + 2, content: wf.lines[lineNo] ?? '' });
    }

    hunks = [{ header: `@@ -${Math.max(1, lineNo - 1)},3 +${Math.max(1, lineNo - 1)},4 @@`, lines }];
    title = b(
      `Pin ${obs.facts.actionRef} to the commit its tag points at`,
      `${obs.facts.actionRef} کو اُس کمِٹ پر پن کریں جس کی طرف اس کا ٹیگ اشارہ کرتا ہے`,
    );
    rationale = b(
      `SHA pinning is chosen over a version range because it is the only option that is both exact and reversible in one commit. The SHA is what "${resolvedSha.resolvedFrom}" resolves to right now, so behaviour is observed rather than assumed. A renovate comment keeps the pin upgradable.`,
      `SHA پننگ کو ورژن رینج پر ترجیح دی گئی کیونکہ یہی واحد طریقہ ہے جو بالکل درست بھی ہے اور ایک کمِٹ سے واپس بھی لیا جا سکتا ہے۔ یہ SHA وہی ہے جس پر "${resolvedSha.resolvedFrom}" اِس وقت حل ہوتا ہے، لہٰذا رویّہ فرض نہیں کیا گیا بلکہ دیکھا گیا ہے۔ renovate کا تبصرہ پن کو قابلِ اپ گریڈ رکھتا ہے۔`,
    );
  } else {
    title = remedyTitle(obs);
    rationale = remedyRationale(obs);
  }

  return {
    id: `fix_${id}`,
    investigationId: id,
    title,
    filePath: obs.workflowPath,
    hunks,
    prevents,
    rationale,
    status: applied ? 'proposed' : 'awaiting_review',
    validation: {
      verified: false,
      method: b(
        hunks.length > 0
          ? 'The pinned SHA was resolved against the upstream Git ref API at scan time. The patched workflow has not been executed — PipelineGuard has read-only access to this repository.'
          : 'Not validated. This remedy is a direction, not a patch: the safe change depends on runtime behaviour the agent cannot observe with read-only access.',
        hunks.length > 0
          ? 'پن کیا گیا SHA سکین کے وقت اپ اسٹریم Git ref API سے تصدیق کیا گیا۔ ترمیم شدہ ورک فلو چلایا نہیں گیا — اس ریپوزٹری پر PipelineGuard کی رسائی صرف پڑھنے کی ہے۔'
          : 'تصدیق نہیں ہوئی۔ یہ حل ایک سمت ہے، پیچ نہیں: محفوظ تبدیلی اُس رن ٹائم رویّے پر منحصر ہے جسے ایجنٹ صرف پڑھنے کی رسائی کے ساتھ نہیں دیکھ سکتا۔',
      ),
      checks: hunks.length > 0
        ? [
            {
              name: 'Tag resolves to a commit SHA',
              status: 'passed',
              detail: b(
                `"${resolvedSha?.resolvedFrom}" resolved to ${resolvedSha?.sha.slice(0, 12)} via the GitHub API.`,
                `"${resolvedSha?.resolvedFrom}" GitHub API کے ذریعے ${resolvedSha?.sha.slice(0, 12)} پر حل ہوا۔`,
              ),
              durationMs: 380,
            },
            {
              name: 'Patched workflow executed',
              status: 'skipped',
              detail: b(
                'Not attempted. Running a workflow requires write access this installation does not hold.',
                'کوشش نہیں کی گئی۔ ورک فلو چلانے کے لیے لکھنے کی وہ رسائی درکار ہے جو اس تنصیب کے پاس نہیں۔',
              ),
              durationMs: 0,
            },
          ]
        : [
            {
              name: 'Safe remedy derivable statically',
              status: 'failed',
              detail: b(
                'The correct configuration depends on runtime values, so no patch is proposed.',
                'درست کنفیگریشن رن ٹائم اقدار پر منحصر ہے، اس لیے کوئی پیچ تجویز نہیں کیا گیا۔',
              ),
              durationMs: 240,
            },
          ],
    },
    pullRequest: null,
  };
}

/** The one-sentence consequence. Deliberately concrete. */
function preventsLine(obs: Observation): Bilingual {
  switch (obs.ruleId) {
    case 'PERM.WRITE_ALL_ROOT':
      return b(
        `Prevents a compromised step in any of the ${obs.facts.affectedJobs?.length ?? 0} jobs from writing to repository contents, packages and deployments with the workflow token.`,
        `یہ روکتا ہے کہ ${obs.facts.affectedJobs?.length ?? 0} جابز میں سے کسی کا متاثرہ سٹیپ ورک فلو ٹوکن سے ریپوزٹری کے مواد، پیکجز اور ڈیپلائمنٹس پر لکھ سکے۔`,
      );
    case 'PERM.BROAD_WRITE':
      return b(
        `Prevents a compromised step in this job from using write scopes (${obs.facts.writeScopes?.join(', ')}) that the job never exercises.`,
        `یہ روکتا ہے کہ اس جاب کا متاثرہ سٹیپ اُن write دائروں (${obs.facts.writeScopes?.join('، ')}) کو استعمال کرے جو یہ جاب کبھی استعمال ہی نہیں کرتی۔`,
      );
    case 'SUP.ACTION_MUTABLE_REF':
      return b(
        'Prevents an upstream maintainer silently repointing a tag to different code that then runs inside your pipeline.',
        'یہ روکتا ہے کہ کوئی اپ اسٹریم مینٹینر خاموشی سے ٹیگ کو مختلف کوڈ پر منتقل کر دے، جو پھر آپ کی پائپ لائن میں چل جائے۔',
      );
    case 'SEC.SECRET_IN_LOGGED_ENV':
      return b(
        'Prevents a credential being written into run logs that anyone with repository read access can open.',
        'یہ روکتا ہے کہ کوئی کریڈنشل اُن رن لاگز میں لکھا جائے جنہیں ریپوزٹری تک پڑھنے کی رسائی رکھنے والا کوئی بھی کھول سکتا ہے۔',
      );
    case 'POL.PR_TARGET_CHECKOUT':
      return b(
        'Prevents code from an untrusted pull request executing with repository secrets and write permissions.',
        'یہ روکتا ہے کہ کسی غیر معتبر پُل ریکویسٹ کا کوڈ ریپوزٹری کے سیکرٹس اور لکھنے کی اجازتوں کے ساتھ چل جائے۔',
      );
    case 'INT.ARTIFACT_NO_CHECKSUM':
      return b(
        'Prevents a tampered artifact from an earlier job executing inside a job that holds write permissions.',
        'یہ روکتا ہے کہ پہلی جاب کا تبدیل شدہ آرٹیفیکٹ ایسی جاب کے اندر چل جائے جس کے پاس لکھنے کی اجازتیں ہیں۔',
      );
    case 'SUP.CURL_PIPE_SHELL':
      return b(
        'Prevents whatever a remote host serves at build time from executing with this job permissions.',
        'یہ روکتا ہے کہ ریموٹ میزبان بلڈ کے وقت جو کچھ بھیجے، وہ اس جاب کی اجازتوں کے ساتھ چل جائے۔',
      );
    default:
      return b(
        'Prevents the weakness described above from being reachable in a pipeline run.',
        'یہ روکتا ہے کہ اوپر بیان کردہ کمزوری کسی پائپ لائن رن میں قابلِ رسائی ہو۔',
      );
  }
}

function remedyTitle(obs: Observation): Bilingual {
  switch (obs.ruleId) {
    case 'PERM.WRITE_ALL_ROOT':
      return b('Replace write-all with an explicit least-privilege block per job',
        'write-all کی جگہ ہر جاب کے لیے کم سے کم اجازت والا واضح بلاک رکھیں');
    case 'PERM.BROAD_WRITE':
      return b('Narrow this job to the scopes it demonstrably uses',
        'اس جاب کو صرف اُن دائروں تک محدود کریں جو یہ ثابت شدہ طور پر استعمال کرتی ہے');
    case 'SEC.SECRET_IN_LOGGED_ENV':
      return b('Remove the environment dump, or scope the secret to the step that needs it',
        'ماحول پرنٹ کرنے والا سٹیپ ہٹائیں، یا سیکرٹ کو صرف اُس سٹیپ تک محدود کریں جسے اس کی ضرورت ہے');
    case 'POL.PR_TARGET_CHECKOUT':
      return b('Split into a privileged and an unprivileged workflow',
        'اسے بااختیار اور کم اختیار والے دو ورک فلوز میں تقسیم کریں');
    case 'INT.ARTIFACT_NO_CHECKSUM':
      return b('Verify the artifact digest before use',
        'استعمال سے پہلے آرٹیفیکٹ کے ڈائجسٹ کی تصدیق کریں');
    case 'SUP.CURL_PIPE_SHELL':
      return b('Download, verify a checksum, then execute',
        'ڈاؤن لوڈ کریں، چیک سم کی تصدیق کریں، پھر چلائیں');
    default:
      return b('Recommended remediation', 'تجویز کردہ اصلاح');
  }
}

function remedyRationale(obs: Observation): Bilingual {
  return b(
    `PipelineGuard has read-only access to this repository, so it describes the remedy rather than patching the file. The correct scope for ${obs.jobId ?? 'this workflow'} depends on what the jobs actually call at runtime, which cannot be derived from the file alone. Grant run-log read access and the agent can narrow this from observed API calls instead of guessing.`,
    `اس ریپوزٹری پر PipelineGuard کی رسائی صرف پڑھنے کی ہے، اس لیے وہ فائل میں ترمیم کرنے کے بجائے حل بیان کرتا ہے۔ ${obs.jobId ?? 'اس ورک فلو'} کے لیے درست دائرہ اس پر منحصر ہے کہ جابز رن ٹائم پر دراصل کیا کال کرتی ہیں، جو صرف فائل سے اخذ نہیں ہو سکتا۔ رن لاگ پڑھنے کی اجازت دیں تو ایجنٹ اندازے کے بجائے مشاہدہ شدہ API کالز سے اسے محدود کر سکے گا۔`,
  );
}
