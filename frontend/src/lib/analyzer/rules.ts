import type { Bilingual, Severity } from '@/lib/types';
import { isFirstParty, isMutableRef, findVars, type ParsedJob, type ParsedWorkflow } from './parse';

/**
 * Detection rules.
 *
 * Each rule returns raw observations, not verdicts. Confidence and the
 * act/flag/refuse decision are computed later in reason.ts, so the evidence and
 * the judgement stay separable — a reviewer can disagree with the decision
 * without disputing the observation.
 */

export interface Observation {
  ruleId: string;
  severity: Severity;
  category: 'permissions' | 'secrets' | 'supply_chain' | 'integrity' | 'policy' | 'exposure';
  cwe: string | null;
  title: Bilingual;
  detail: Bilingual;
  /** Support for the claim, rendered as "because" bullets. */
  because: Bilingual[];
  workflowPath: string;
  line: number;
  jobId: string | null;
  /** Machine facts the reasoning stage uses to compute confidence. */
  facts: {
    deterministicRemedy: boolean;
    touchesProduction: boolean;
    touchesSecrets: boolean;
    /** Something the agent could not resolve — forces low confidence. */
    unresolvable?: string;
    actionRef?: string;
    writeScopes?: string[];
    affectedJobs?: string[];
  };
}

const b = (en: string, ur: string): Bilingual => ({ en, ur });

/** A job that binds an environment is treated as production-reaching unless it
 *  is obviously a preview or staging target. */
export function isProductionJob(job: ParsedJob): boolean {
  if (!job.environment) return false;
  return !/^(staging|dev|development|preview|test|qa)$/i.test(job.environment);
}

export function workflowTouchesProduction(wf: ParsedWorkflow): boolean {
  return wf.jobs.some(isProductionJob);
}

function writeScopesOf(job: ParsedJob): string[] {
  return Object.entries(job.permissions)
    .filter(([, v]) => v === 'write')
    .map(([k]) => k);
}

// ---------------------------------------------------------------------------

function ruleWriteAll(wf: ParsedWorkflow): Observation[] {
  if (wf.rootPermissions !== 'write-all') return [];
  const jobIds = wf.jobs.map((j) => j.id);
  const prod = wf.jobs.some(isProductionJob);
  const secretJobs = wf.jobs.filter((j) => j.secrets.length > 0);

  return [{
    ruleId: 'PERM.WRITE_ALL_ROOT',
    severity: prod ? 'critical' : 'high',
    category: 'permissions',
    cwe: 'CWE-266',
    title: b(
      'permissions: write-all declared at workflow root',
      'ورک فلو کی جڑ پر permissions: write-all موجود ہے',
    ),
    detail: b(
      `write-all at workflow root grants every token scope to all ${jobIds.length} job(s) in this workflow.`,
      `ورک فلو کی جڑ پر write-all، اس ورک فلو کی تمام ${jobIds.length} جابز کو ہر ٹوکن دائرہ دے دیتا ہے۔`,
    ),
    because: [
      b(`${wf.path} line ${wf.rootPermissionsLine} sets permissions: write-all.`,
        `${wf.path} کی لائن ${wf.rootPermissionsLine} پر permissions: write-all لکھا ہے۔`),
      b(`It applies to ${jobIds.length} job(s): ${jobIds.join(', ')}.`,
        `یہ ${jobIds.length} جابز پر لاگو ہوتا ہے: ${jobIds.join('، ')}۔`),
      secretJobs.length > 0
        ? b(`${secretJobs.length} of those job(s) read secrets: ${secretJobs.map((j) => j.id).join(', ')}.`,
            `ان میں سے ${secretJobs.length} جابز سیکرٹس پڑھتی ہیں: ${secretJobs.map((j) => j.id).join('، ')}۔`)
        : b('No job in this workflow reads a secret, which limits the immediate impact.',
            'اس ورک فلو کی کوئی جاب سیکرٹ نہیں پڑھتی، جس سے فوری اثر محدود ہو جاتا ہے۔'),
    ],
    workflowPath: wf.path,
    line: wf.rootPermissionsLine ?? 1,
    jobId: null,
    facts: {
      deterministicRemedy: false,
      touchesProduction: prod,
      touchesSecrets: secretJobs.length > 0,
      affectedJobs: jobIds,
      writeScopes: ['all'],
    },
  }];
}

function ruleBroadWrite(wf: ParsedWorkflow): Observation[] {
  if (wf.rootPermissions === 'write-all') return []; // already reported, do not double-count
  const out: Observation[] = [];
  for (const job of wf.jobs) {
    const writes = writeScopesOf(job);
    if (writes.length < 3) continue;
    const prod = isProductionJob(job);
    out.push({
      ruleId: 'PERM.BROAD_WRITE',
      severity: prod ? 'high' : 'medium',
      category: 'permissions',
      cwe: 'CWE-272',
      title: b(
        `Job ${job.id} holds ${writes.length} write scopes`,
        `جاب ${job.id} کے پاس ${writes.length} write دائرے ہیں`,
      ),
      detail: b(
        `Every write scope on a job is a capability that any compromised step in that job inherits.`,
        `کسی جاب کا ہر write دائرہ ایک ایسی صلاحیت ہے جو اُس جاب کے کسی بھی متاثرہ سٹیپ کو وراثت میں مل جاتی ہے۔`,
      ),
      because: [
        b(`Effective write scopes: ${writes.join(', ')}.`,
          `مؤثر write دائرے: ${writes.join('، ')}۔`),
        job.inheritsRootPermissions
          ? b('The job declares no permissions block, so it inherits the workflow root.',
              'جاب کا اپنا کوئی اجازتی بلاک نہیں، اس لیے اسے ورک فلو کی جڑ سے وراثت ملتی ہے۔')
          : b('The job declares these scopes explicitly.',
              'جاب نے یہ دائرے خود واضح طور پر بیان کیے ہیں۔'),
        prod
          ? b(`The job deploys to environment "${job.environment}".`,
              `یہ جاب ماحول "${job.environment}" پر ڈیپلائے کرتی ہے۔`)
          : b('The job is not bound to any environment.',
              'یہ جاب کسی ماحول سے منسلک نہیں۔'),
      ],
      workflowPath: wf.path,
      line: job.line,
      jobId: job.id,
      facts: {
        deterministicRemedy: false,
        touchesProduction: prod,
        touchesSecrets: job.secrets.length > 0,
        writeScopes: writes,
        affectedJobs: [job.id],
      },
    });
  }
  return out;
}

function ruleMutableAction(wf: ParsedWorkflow): Observation[] {
  const out: Observation[] = [];
  for (const job of wf.jobs) {
    for (const step of job.steps) {
      if (!step.uses || !isMutableRef(step.uses)) continue;
      const firstParty = isFirstParty(step.uses);
      const ref = step.uses.split('@').pop() ?? '';
      out.push({
        ruleId: 'SUP.ACTION_MUTABLE_REF',
        severity: firstParty ? 'low' : 'medium',
        category: 'supply_chain',
        cwe: 'CWE-1357',
        title: b(
          `${step.uses} is pinned to a mutable ref`,
          `${step.uses} ایک قابلِ تبدیل حوالے سے منسلک ہے`,
        ),
        detail: b(
          `The tag "${ref}" can be repointed by the upstream owner at any time, with no commit in this repository.`,
          `ٹیگ "${ref}" کو اپ اسٹریم مالک کسی بھی وقت کسی اور کمِٹ پر منتقل کر سکتا ہے، اور اس ریپوزٹری میں کوئی کمِٹ نہیں ہوگا۔`,
        ),
        because: [
          b(`${wf.path} line ${step.line} uses ${step.uses}.`,
            `${wf.path} کی لائن ${step.line} پر ${step.uses} استعمال ہوا ہے۔`),
          firstParty
            ? b('The publisher is GitHub itself, which lowers but does not remove the risk.',
                'ناشر خود GitHub ہے، جس سے خطرہ کم ہوتا ہے مگر ختم نہیں ہوتا۔')
            : b('The publisher is a third party, so the code that runs is outside your control.',
                'ناشر ایک تھرڈ پارٹی ہے، اس لیے چلنے والا کوڈ آپ کے اختیار سے باہر ہے۔'),
          job.secrets.length > 0
            ? b(`Job ${job.id} reads ${job.secrets.length} secret(s), which this action would run alongside.`,
                `جاب ${job.id} ${job.secrets.length} سیکرٹ پڑھتی ہے، جن کے ساتھ یہ ایکشن چلے گا۔`)
            : b(`Job ${job.id} reads no secrets.`,
                `جاب ${job.id} کوئی سیکرٹ نہیں پڑھتی۔`),
        ],
        workflowPath: wf.path,
        line: step.line,
        jobId: job.id,
        facts: {
          // Tag -> SHA is a lookup, not a judgement. This is what makes the
          // remedy safe to apply autonomously.
          deterministicRemedy: true,
          touchesProduction: isProductionJob(job),
          touchesSecrets: job.secrets.length > 0,
          actionRef: step.uses,
          affectedJobs: [job.id],
        },
      });
    }
  }
  return out;
}

function ruleSecretInLoggedEnv(wf: ParsedWorkflow): Observation[] {
  const out: Observation[] = [];
  const DUMPS = /(^|\s)(env|printenv|set\s+-x|export\s*$)/m;

  for (const job of wf.jobs) {
    const dumping = job.steps.filter((s) => s.run && DUMPS.test(s.run));
    if (dumping.length === 0) continue;

    const secretEnvSteps = job.steps.filter(
      (s) => Object.values(s.env).some((v) => v.includes('secrets.')),
    );
    if (secretEnvSteps.length === 0) continue;

    const names = secretEnvSteps.flatMap((s) =>
      Object.entries(s.env).filter(([, v]) => v.includes('secrets.')).map(([k]) => k));

    out.push({
      ruleId: 'SEC.SECRET_IN_LOGGED_ENV',
      severity: 'high',
      category: 'secrets',
      cwe: 'CWE-532',
      title: b(
        `Secret in environment alongside a step that prints the environment`,
        `ایسے ماحول میں سیکرٹ جہاں ایک سٹیپ پورا ماحول پرنٹ کرتا ہے`,
      ),
      detail: b(
        `Job ${job.id} places ${names.join(', ')} in the environment and also runs a step that dumps it.`,
        `جاب ${job.id}، ${names.join('، ')} کو ماحول میں رکھتی ہے اور ایک ایسا سٹیپ بھی چلاتی ہے جو اسے ظاہر کر دیتا ہے۔`,
      ),
      because: [
        b(`Secret-bearing env vars: ${names.join(', ')}.`,
          `سیکرٹ رکھنے والے env متغیرات: ${names.join('، ')}۔`),
        b(`Line ${dumping[0].line} runs a command that prints the environment.`,
          `لائن ${dumping[0].line} پر ایسی کمانڈ چلتی ہے جو ماحول پرنٹ کرتی ہے۔`),
        b('Run logs are readable by anyone with read access to the repository.',
          'رن لاگز اُس ہر شخص کے لیے قابلِ مطالعہ ہیں جسے ریپوزٹری تک پڑھنے کی رسائی ہو۔'),
      ],
      workflowPath: wf.path,
      line: dumping[0].line || job.line,
      jobId: job.id,
      facts: {
        deterministicRemedy: false,
        touchesProduction: isProductionJob(job),
        touchesSecrets: true,
        affectedJobs: [job.id],
      },
    });
  }
  return out;
}

function ruleUnresolvedEgress(wf: ParsedWorkflow): Observation[] {
  const out: Observation[] = [];
  const NET = /\b(curl|wget|Invoke-WebRequest|nc)\b/;
  const PAYLOAD = /toJSON\(\s*github\.event\s*\)|github\.event\b/;

  for (const job of wf.jobs) {
    for (const step of job.steps) {
      if (!step.run || !NET.test(step.run)) continue;
      const vars = findVars(step.run);
      const sendsPayload = PAYLOAD.test(step.run);
      if (vars.length === 0 && !sendsPayload) continue;

      const swallowed = /\|\|\s*true/.test(step.run);
      out.push({
        ruleId: 'EXP.UNRESOLVED_EGRESS',
        severity: 'high',
        category: 'exposure',
        cwe: 'CWE-200',
        title: b(
          `Outbound request to a destination the agent cannot resolve`,
          `ایسی منزل کی طرف باہر جانے والی درخواست جس کا تعین ایجنٹ نہیں کر سکتا`,
        ),
        detail: b(
          vars.length > 0
            ? `The destination is held in variable(s) ${vars.join(', ')}, which this installation cannot read.`
            : 'The request carries event payload data to an external host.',
          vars.length > 0
            ? `منزل ویری ایبل ${vars.join('، ')} میں محفوظ ہے، جسے یہ تنصیب پڑھ نہیں سکتی۔`
            : 'یہ درخواست ایونٹ پے لوڈ کا ڈیٹا کسی بیرونی میزبان کو بھیجتی ہے۔',
        ),
        because: [
          b(`${wf.path} line ${step.line} makes an outbound network call.`,
            `${wf.path} کی لائن ${step.line} پر باہر جانے والی نیٹ ورک کال ہوتی ہے۔`),
          sendsPayload
            ? b('The request body includes GitHub event data, which contains repository metadata and committer emails.',
                'درخواست کے مواد میں GitHub ایونٹ ڈیٹا شامل ہے، جس میں ریپوزٹری میٹا ڈیٹا اور کمِٹرز کے ای میل ہوتے ہیں۔')
            : b('The request body could not be fully determined.',
                'درخواست کے مواد کا مکمل تعین نہ ہو سکا۔'),
          swallowed
            ? b('Failures are silently discarded with || true, so a broken or hostile endpoint would not surface.',
                'ناکامیاں || true کے ذریعے خاموشی سے نظر انداز ہو جاتی ہیں، اس لیے خراب یا مخالفانہ اینڈ پوائنٹ کا پتہ نہیں چلے گا۔')
            : b('Failures are not suppressed.',
                'ناکامیاں دبائی نہیں جاتیں۔'),
        ],
        workflowPath: wf.path,
        line: step.line || job.line,
        jobId: job.id,
        facts: {
          deterministicRemedy: false,
          touchesProduction: isProductionJob(job),
          touchesSecrets: job.secrets.length > 0,
          // This is what drives the refusal: intent cannot be established.
          unresolvable: vars.length > 0
            ? `vars.${vars[0]} cannot be read with the scopes this installation holds`
            : 'the destination host could not be determined statically',
          affectedJobs: [job.id],
        },
      });
    }
  }
  return out;
}

function rulePrTargetCheckout(wf: ParsedWorkflow): Observation[] {
  if (!wf.triggers.includes('pull_request_target')) return [];
  const out: Observation[] = [];
  for (const job of wf.jobs) {
    for (const step of job.steps) {
      if (!step.uses?.startsWith('actions/checkout')) continue;
      out.push({
        ruleId: 'POL.PR_TARGET_CHECKOUT',
        severity: 'critical',
        category: 'policy',
        cwe: 'CWE-829',
        title: b(
          'pull_request_target checks out untrusted pull request code',
          'pull_request_target غیر معتبر پُل ریکویسٹ کوڈ چیک آؤٹ کرتا ہے',
        ),
        detail: b(
          'pull_request_target runs with repository secrets and write permissions in the context of the base branch. Checking out the pull request head executes attacker-controlled code with that access.',
          'pull_request_target ریپوزٹری کے سیکرٹس اور لکھنے کی اجازتوں کے ساتھ بیس برانچ کے تناظر میں چلتا ہے۔ پُل ریکویسٹ کا ہیڈ چیک آؤٹ کرنے سے حملہ آور کا کوڈ اُسی رسائی کے ساتھ چل جاتا ہے۔',
        ),
        because: [
          b(`The workflow triggers on pull_request_target.`,
            `یہ ورک فلو pull_request_target پر چلتا ہے۔`),
          b(`Line ${step.line} performs a checkout inside job ${job.id}.`,
            `لائن ${step.line} پر جاب ${job.id} کے اندر چیک آؤٹ ہوتا ہے۔`),
          b('This combination is the documented privilege-escalation pattern for GitHub Actions.',
            'یہ امتزاج GitHub Actions میں اختیارات بڑھانے کا معروف اور دستاویزی طریقہ ہے۔'),
        ],
        workflowPath: wf.path,
        line: step.line || job.line,
        jobId: job.id,
        facts: {
          deterministicRemedy: false,
          touchesProduction: isProductionJob(job),
          touchesSecrets: true,
          affectedJobs: [job.id],
        },
      });
    }
  }
  return out;
}

function ruleArtifactIntegrity(wf: ParsedWorkflow): Observation[] {
  const producers = wf.jobs.filter((j) =>
    j.steps.some((s) => s.uses?.startsWith('actions/upload-artifact')));
  const consumers = wf.jobs.filter((j) =>
    j.steps.some((s) => s.uses?.startsWith('actions/download-artifact')));
  if (producers.length === 0 || consumers.length === 0) return [];

  const out: Observation[] = [];
  for (const consumer of consumers) {
    const verifies = consumer.steps.some(
      (s) => s.run && /(sha256sum|shasum|cosign|checksum)/i.test(s.run));
    if (verifies) continue;
    const writes = writeScopesOf(consumer);

    out.push({
      ruleId: 'INT.ARTIFACT_NO_CHECKSUM',
      severity: writes.length > 0 ? 'medium' : 'low',
      category: 'integrity',
      cwe: 'CWE-353',
      title: b(
        `Job ${consumer.id} consumes an artifact without verifying it`,
        `جاب ${consumer.id} آرٹیفیکٹ کی تصدیق کیے بغیر اسے استعمال کرتی ہے`,
      ),
      detail: b(
        `An artifact produced by ${producers.map((p) => p.id).join(', ')} is downloaded and used with no integrity check.`,
        `${producers.map((p) => p.id).join('، ')} کا بنایا ہوا آرٹیفیکٹ بغیر کسی سالمیت جانچ کے ڈاؤن لوڈ اور استعمال ہوتا ہے۔`,
      ),
      because: [
        b(`Producer job(s): ${producers.map((p) => p.id).join(', ')}.`,
          `بنانے والی جابز: ${producers.map((p) => p.id).join('، ')}۔`),
        b('No sha256sum, shasum or cosign step was found in the consuming job.',
          'استعمال کرنے والی جاب میں کوئی sha256sum، shasum یا cosign سٹیپ نہیں ملا۔'),
        writes.length > 0
          ? b(`The consuming job holds write scopes: ${writes.join(', ')}.`,
              `استعمال کرنے والی جاب کے پاس write دائرے ہیں: ${writes.join('، ')}۔`)
          : b('The consuming job holds no write scopes, which bounds the impact.',
              'استعمال کرنے والی جاب کے پاس کوئی write دائرہ نہیں، جس سے اثر محدود رہتا ہے۔'),
      ],
      workflowPath: wf.path,
      line: consumer.line,
      jobId: consumer.id,
      facts: {
        deterministicRemedy: false,
        touchesProduction: isProductionJob(consumer),
        touchesSecrets: consumer.secrets.length > 0,
        affectedJobs: [consumer.id],
      },
    });
  }
  return out;
}

function ruleCurlPipeShell(wf: ParsedWorkflow): Observation[] {
  const out: Observation[] = [];
  const PIPE = /(curl|wget)[^\n|]*\|\s*(sudo\s+)?(ba)?sh/;
  for (const job of wf.jobs) {
    for (const step of job.steps) {
      if (!step.run || !PIPE.test(step.run)) continue;
      out.push({
        ruleId: 'SUP.CURL_PIPE_SHELL',
        severity: 'high',
        category: 'supply_chain',
        cwe: 'CWE-494',
        title: b(
          'Remote script piped directly into a shell',
          'ریموٹ سکرپٹ براہِ راست شیل میں بھیجی جا رہی ہے',
        ),
        detail: b(
          'Whatever the remote host serves at that moment executes with the permissions of this job.',
          'ریموٹ میزبان اُس لمحے جو کچھ بھی بھیجے، وہ اس جاب کی اجازتوں کے ساتھ چل جاتا ہے۔',
        ),
        because: [
          b(`${wf.path} line ${step.line} pipes a download into a shell.`,
            `${wf.path} کی لائن ${step.line} پر ڈاؤن لوڈ کو شیل میں بھیجا جا رہا ہے۔`),
          b('The content is not pinned, checksummed or reviewed.',
            'مواد نہ پن کیا گیا ہے، نہ اس کا چیک سم ہے، نہ جائزہ لیا گیا ہے۔'),
          job.secrets.length > 0
            ? b(`Job ${job.id} reads secrets, so a hostile script would reach them.`,
                `جاب ${job.id} سیکرٹس پڑھتی ہے، لہٰذا مخالفانہ سکرپٹ اُن تک پہنچ جائے گی۔`)
            : b(`Job ${job.id} reads no secrets.`,
                `جاب ${job.id} کوئی سیکرٹ نہیں پڑھتی۔`),
        ],
        workflowPath: wf.path,
        line: step.line || job.line,
        jobId: job.id,
        facts: {
          deterministicRemedy: false,
          touchesProduction: isProductionJob(job),
          touchesSecrets: job.secrets.length > 0,
          affectedJobs: [job.id],
        },
      });
    }
  }
  return out;
}

const RULES = [
  ruleWriteAll,
  ruleBroadWrite,
  ruleMutableAction,
  ruleSecretInLoggedEnv,
  ruleUnresolvedEgress,
  rulePrTargetCheckout,
  ruleArtifactIntegrity,
  ruleCurlPipeShell,
];

export function runRules(wf: ParsedWorkflow): Observation[] {
  if (wf.error) return [];
  return RULES.flatMap((r) => {
    try {
      return r(wf);
    } catch {
      return []; // one broken rule must not fail the whole scan
    }
  });
}

export const RULE_COUNT = RULES.length;
