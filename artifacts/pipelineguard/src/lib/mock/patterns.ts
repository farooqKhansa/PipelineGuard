import type { Bilingual } from '@/lib/types';

/**
 * Learned patterns.
 *
 * These are the generalisations the agent extracted from pipeline history, and
 * they are what the "historical evidence" step of a reasoning chain cites. Each
 * one carries the sample it was learned from and how often it has held, so a
 * reviewer can judge whether the pattern is worth anything rather than taking
 * "learns from history" on faith.
 */
export interface LearnedPattern {
  id: string;
  name: Bilingual;
  statement: Bilingual;
  /** How many historical changes matched the antecedent. */
  observations: number;
  /** Of those, how many had the predicted outcome. */
  confirmations: number;
  /** Days of history the pattern was learned from. */
  windowDays: number;
  firstSeen: string;
  lastMatched: string;
  category: 'permissions' | 'supply_chain' | 'secrets' | 'integrity' | 'policy';
  /** Investigations that cited this pattern. */
  citedBy: string[];
}

export interface HistoricalIncident {
  id: string;
  title: Bilingual;
  date: string;
  repo: string;
  rootCause: Bilingual;
  recoveryHours: number;
  /** The pattern learned from this incident, if any. */
  patternId: string | null;
}

export const patterns: LearnedPattern[] = [
  {
    id: 'LP-02',
    name: { en: 'Permission widening precedes incidents', ur: 'اجازتوں میں توسیع، واقعات سے پہلے ہوتی ہے' },
    statement: {
      en: 'When a permissions block is widened in the same commit that fixes a failing step, the widening is almost never necessary once the underlying failure is diagnosed.',
      ur: 'جب اجازتی بلاک اُسی کمِٹ میں بڑھایا جائے جو کسی ناکام سٹیپ کو ٹھیک کرتا ہے، تو بنیادی خرابی کی تشخیص کے بعد وہ توسیع تقریباً کبھی ضروری ثابت نہیں ہوتی۔',
    },
    observations: 4,
    confirmations: 4,
    windowDays: 365,
    firstSeen: '2025-09-14T00:00:00Z',
    lastMatched: '2026-08-28T11:02:47Z',
    category: 'permissions',
    citedBy: ['inv_c73e9b'],
  },
  {
    id: 'LP-07',
    name: { en: 'Tag-pinned actions drift silently', ur: 'ٹیگ شدہ ایکشنز خاموشی سے بدل جاتے ہیں' },
    statement: {
      en: 'Third-party actions referenced by tag resolve to different code within 90 days, and because no build fails as a result, nothing surfaces the change to a developer.',
      ur: 'ٹیگ سے منسلک تھرڈ پارٹی ایکشنز ۹۰ دن کے اندر مختلف کوڈ پر منتقل ہو جاتے ہیں، اور چونکہ اس سے کوئی بلڈ ناکام نہیں ہوتا، کسی ڈویلپر کو اس تبدیلی کی خبر نہیں ہوتی۔',
    },
    observations: 3,
    confirmations: 3,
    windowDays: 180,
    firstSeen: '2026-03-02T00:00:00Z',
    lastMatched: '2026-08-28T09:14:22Z',
    category: 'supply_chain',
    citedBy: ['inv_8f21a4'],
  },
  {
    id: 'LP-11',
    name: { en: 'Unused write scopes persist indefinitely', ur: 'غیر استعمال شدہ write اجازتیں مستقل رہتی ہیں' },
    statement: {
      en: 'A write scope granted to a job is almost never removed later, even when no run ever exercises it. Median age of an unused scope is 74 days.',
      ur: 'کسی جاب کو دی گئی write اجازت بعد میں تقریباً کبھی نہیں ہٹائی جاتی، چاہے کوئی رن اسے استعمال ہی نہ کرے۔ غیر استعمال شدہ اجازت کی درمیانی عمر ۷۴ دن ہے۔',
    },
    observations: 9,
    confirmations: 8,
    windowDays: 365,
    firstSeen: '2025-11-20T00:00:00Z',
    lastMatched: '2026-08-24T09:00:00Z',
    category: 'permissions',
    citedBy: [],
  },
  {
    id: 'LP-14',
    name: { en: 'Cross-job artifacts are rarely checksummed', ur: 'جابز کے درمیان آرٹیفیکٹس کا چیک سم کم ہی ہوتا ہے' },
    statement: {
      en: 'Artifacts passed between jobs are verified in fewer than one in five pipelines, which turns any earlier job into a write path for later ones.',
      ur: 'جابز کے درمیان منتقل ہونے والے آرٹیفیکٹس پانچ میں سے ایک سے بھی کم پائپ لائنز میں تصدیق ہوتے ہیں، جس سے ہر پہلی جاب بعد والی جابز کے لیے لکھنے کا راستہ بن جاتی ہے۔',
    },
    observations: 11,
    confirmations: 9,
    windowDays: 180,
    firstSeen: '2026-04-11T00:00:00Z',
    lastMatched: '2026-08-26T10:00:00Z',
    category: 'integrity',
    citedBy: ['inv_8f21a4'],
  },
  {
    id: 'LP-19',
    name: { en: 'First-occurrence patterns are not evidence of intent', ur: 'پہلی بار ظاہر ہونے والا پیٹرن نیت کا ثبوت نہیں' },
    statement: {
      en: 'When a configuration pattern has no precedent, outcomes split roughly evenly between benign new integrations and genuine risk. Absence of precedent must lower confidence, not raise suspicion.',
      ur: 'جب کسی کنفیگریشن پیٹرن کی کوئی نظیر نہ ہو، تو نتائج تقریباً برابر تقسیم ہوتے ہیں: بے ضرر نئے انضمام اور حقیقی خطرہ۔ نظیر کا نہ ہونا اعتماد کم کرے، شک نہیں بڑھائے۔',
    },
    observations: 12,
    confirmations: 12,
    windowDays: 365,
    firstSeen: '2025-10-05T00:00:00Z',
    lastMatched: '2026-08-28T13:41:09Z',
    category: 'policy',
    citedBy: ['inv_2a5d10'],
  },
];

export const incidents: HistoricalIncident[] = [
  {
    id: 'INC-2291',
    title: { en: 'Released container image overwritten in the registry', ur: 'رجسٹری میں جاری شدہ کنٹینر امیج اوور رائٹ ہو گئی' },
    date: '2026-03-14T00:00:00Z',
    repo: 'northwind/checkout-service',
    rootCause: {
      en: 'A job held packages: write that it did not need. A compromised build step reused the tag of an already-released image.',
      ur: 'ایک جاب کے پاس packages: write تھا جس کی اسے ضرورت نہیں تھی۔ ایک متاثرہ بلڈ سٹیپ نے پہلے سے جاری شدہ امیج کا ٹیگ دوبارہ استعمال کر لیا۔',
    },
    recoveryHours: 6.5,
    patternId: 'LP-02',
  },
  {
    id: 'INC-2154',
    title: { en: 'Production migration applied without review', ur: 'پروڈکشن مائیگریشن بغیر جائزے کے لاگو ہوئی' },
    date: '2026-01-22T00:00:00Z',
    repo: 'northwind/ledger-worker',
    rootCause: {
      en: 'The production environment had no required reviewers, so a merge to main applied an irreversible schema change directly.',
      ur: 'پروڈکشن ماحول کے لیے کوئی لازمی جائزہ کار مقرر نہیں تھا، چنانچہ main میں ایک مرج نے براہِ راست ناقابلِ واپسی سکیما تبدیلی لاگو کر دی۔',
    },
    recoveryHours: 11,
    patternId: null,
  },
  {
    id: 'INC-1998',
    title: { en: 'Role ARN disclosed in public run logs', ur: 'عوامی رن لاگز میں رول ARN ظاہر ہو گیا' },
    date: '2025-11-08T00:00:00Z',
    repo: 'northwind/edge-router',
    rootCause: {
      en: 'A debug step printed the full environment while a role reference was set as a step-level variable.',
      ur: 'ایک ڈیبگ سٹیپ نے پورا ماحول پرنٹ کر دیا جبکہ رول کا حوالہ سٹیپ کی سطح کے ویری ایبل میں رکھا گیا تھا۔',
    },
    recoveryHours: 3,
    patternId: null,
  },
];
