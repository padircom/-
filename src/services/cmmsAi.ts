/**
 * لایهٔ هوش مصنوعی CMMS — پنج موتور تحلیلی.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * یک تصمیم معماری که باید صریح گفته شود:
 *
 * این پنج موتور «قطعی» (deterministic) پیاده شده‌اند، نه فراخوانی مدل زبانی.
 * یعنی برای ورودی یکسان، همیشه خروجی یکسان و قابل بازتولید می‌دهند و هر
 * پیشنهاد با «دلیل» و «شواهد» همراه است.
 *
 * چرا؟ سه دلیل عملی:
 *   ۱) تصمیم نت یک تصمیم ایمنی/مالی است. پیشنهادی که نتوان دلیلش را در
 *      ممیزی ISO 55001 دفاع کرد، ارزش عملیاتی ندارد.
 *   ۲) آزمون‌پذیری: موتور قطعی را می‌توان با آزمون واحد پوشش داد؛ خروجی
 *      مدل زبانی را نمی‌توان در CI ثابت نگه داشت.
 *   ۳) تأخیر و هزینهٔ صفر در لبه — اپراتور پای خط منتظر API بیرونی نمی‌ماند.
 *
 * هر پنج موتور طوری طراحی شده‌اند که در فاز ۵ بتوان یک برآوردگر آماری/ML
 * واقعی را جایگزین بخش «امتیازدهی» کرد بدون اینکه امضای توابع یا جدول
 * CmmsAiRecommendation عوض شود.
 * ─────────────────────────────────────────────────────────────────────────
 */
import {
  computeWorkOrderPriorityScore,
  optimizePmInterval,
  sortByPriority,
  type PmOptimizationResult,
} from "./cmmsDomain";

export const CMMS_AI_VERSION = "cmms-ai-v1";

export const CMMS_AI_ENGINES = [
  "failure-analysis", "pm-optimization", "repair-guidance", "tree-generator", "smart-scheduler",
] as const;
export type CmmsAiEngine = (typeof CMMS_AI_ENGINES)[number];

export type AiEvidence = { kind: string; reference: string; detailFa: string; weight: number };
export type AiSuggestion = {
  type: "root-cause" | "pm-interval" | "repair-action" | "spare-needed" | "tree-node" | "schedule-slot";
  titleFa: string;
  explanationFa: string;
  confidence: number;
  priority: 1 | 2 | 3 | 4 | 5;
  evidence: AiEvidence[];
  suggestedValue: Record<string, unknown>;
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** اطمینان را به بازهٔ [۰,۱] می‌برد و از تقسیم بر صفر محافظت می‌کند. */
function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return round4(Math.min(1, Math.max(0, value)));
}

/** نرمال‌سازی متن ورودی برای تطبیق کلیدواژه — فارسی/انگلیسی، بدون علامت. */
export function normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\u200c\u200f]/g, " ")   /* نیم‌فاصله و RLM */
    .replace(/[يی]/g, "ی")
    .replace(/[كک]/g, "ک")
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** استخراج کلیدواژه‌های معنادار (حذف واژه‌های بسیار کوتاه و عمومی). */
export function extractKeywords(value: string, minLength = 3): string[] {
  const stopwords = new Set(["and", "the", "for", "with", "that", "this", "است", "در", "از", "با", "به", "که", "و", "یک", "the"]);
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= minLength && !stopwords.has(token));
}

/* ═══════════════════════ ۱. AI Failure Analysis ═══════════════════════ */

export type FailureHistoryRecord = {
  id: string;
  assetId?: string;
  failureMode: string;
  failureMechanism: string;
  symptoms: string[];
  rootCauseFa: string;
  /** ۱ یعنی اقدام انجام‌شده مشکل را واقعاً حل کرد. */
  resolved: boolean;
};

/**
 * تحلیل هوشمند ریشهٔ خرابی.
 *
 * روش: امتیازدهی بیزی ساده روی تاریخچهٔ خرابی‌ها.
 *   احتمال پسین ∝ احتمال پیشین (فراوانی حالت خرابی) × درستی مشاهدهٔ علامت‌ها
 *
 * «درستی» با نسبت هم‌پوشانی کلیدواژه‌ها اندازه گرفته می‌شود و با ضریب
 * هموارسازی (k=1) از صفر شدن کامل احتمال برای حالت‌های کم‌سابقه جلوگیری
 * می‌شود — همان مشکل کلاسیک صفر-فراوانی در بیز ساده.
 *
 * خروجی: علل ریشه‌ای رتبه‌بندی‌شده با اطمینان، به‌همراه شواهد (کدام رکوردهای
 * تاریخی این رتبه را ساخته‌اند) و آزمون‌های پیشنهادی برای تأیید.
 */
export function analyzeFailure(input: {
  symptoms: string[];
  history: FailureHistoryRecord[];
  /** اگر تجهیز مشخص باشد، سابقهٔ همان تجهیز وزن بیشتری می‌گیرد. */
  assetId?: string | null;
  /** وزن اضافه برای سابقهٔ همان تجهیز. */
  sameAssetBoost?: number;
  topN?: number;
}): { suggestions: AiSuggestion[]; analyzedSymptoms: string[]; historySize: number; warnings: string[] } {
  const warnings: string[] = [];
  const history = input.history ?? [];
  const symptoms = (input.symptoms ?? []).map(normalizeText).filter(Boolean);
  if (symptoms.length === 0) warnings.push("هیچ علامتی داده نشد؛ رتبه‌بندی فقط بر پایهٔ فراوانی تاریخی انجام شد.");
  if (history.length === 0) warnings.push("تاریخچهٔ خرابی خالی است — امکان استنتاج وجود ندارد و پیشنهادی تولید نشد.");

  const symptomKeywords = symptoms.flatMap((symptom) => extractKeywords(symptom));
  const sameAssetBoost = input.sameAssetBoost ?? 1.5;

  type Bucket = {
    key: string;
    failureMode: string;
    failureMechanism: string;
    rootCauseFa: string;
    count: number;
    resolvedCount: number;
    score: number;
    records: string[];
    matchedSymptoms: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const record of history) {
    const key = `${record.failureMode}|${record.failureMechanism}|${normalizeText(record.rootCauseFa)}`;
    const bucket: Bucket = buckets.get(key) ?? {
      key, failureMode: record.failureMode, failureMechanism: record.failureMechanism,
      rootCauseFa: record.rootCauseFa, count: 0, resolvedCount: 0, score: 0,
      records: [], matchedSymptoms: new Set<string>(),
    };

    const recordKeywords = record.symptoms.flatMap((symptom) => extractKeywords(symptom));
    const matched = symptomKeywords.filter((keyword) => recordKeywords.includes(keyword));
    for (const keyword of matched) bucket.matchedSymptoms.add(keyword);

    /* هم‌پوشانی علامت‌ها: نسبت کلیدواژه‌های مشترک به کلیدواژه‌های علامت ورودی. */
    const overlap = symptomKeywords.length ? matched.length / new Set(symptomKeywords).size : 0;
    const assetWeight = input.assetId && record.assetId === input.assetId ? sameAssetBoost : 1;
    const resolutionWeight = record.resolved ? 1 : 0.4;

    bucket.count += 1;
    if (record.resolved) bucket.resolvedCount += 1;
    bucket.score += (0.35 + 0.65 * overlap) * assetWeight * resolutionWeight;
    bucket.records.push(record.id);
    buckets.set(key, bucket);
  }

  const totalScore = [...buckets.values()].reduce((sum, bucket) => sum + bucket.score, 0);
  const suggestions: AiSuggestion[] = [...buckets.values()]
    .map((bucket) => {
      const confidence = totalScore > 0 ? bucket.score / totalScore : 0;
      const successRate = bucket.count > 0 ? bucket.resolvedCount / bucket.count : 0;
      const matchedList = [...bucket.matchedSymptoms];
      return {
        type: "root-cause" as const,
        titleFa: `${bucket.rootCauseFa || `حالت خرابی ${bucket.failureMode}`} (${bucket.failureMode}/${bucket.failureMechanism})`,
        explanationFa: [
          `${bucket.count} سابقهٔ تاریخی با همین ترکیب حالت و مکانیزم خرابی.`,
          matchedList.length ? `علامت‌های مشترک: ${matchedList.join("، ")}.` : "هیچ علامت مشترکی یافت نشد؛ رتبه فقط از فراوانی تاریخی می‌آید.",
          `نرخ موفقیت اقدام‌های گذشته: ${round2(successRate * 100)}٪.`,
          input.assetId ? "سابقهٔ همین تجهیز وزن بیشتری در امتیاز داشت." : "سابقهٔ کل ناوگان در نظر گرفته شد.",
        ].join(" "),
        confidence: clampConfidence(confidence),
        priority: confidence >= 0.5 ? 1 : confidence >= 0.25 ? 2 : 3,
        evidence: bucket.records.slice(0, 8).map((reference) => ({
          kind: "historical-failure", reference,
          detailFa: `سابقهٔ خرابی ${reference} با همین حالت و مکانیزم`,
          weight: round4(bucket.score),
        })),
        suggestedValue: {
          failureMode: bucket.failureMode,
          failureMechanism: bucket.failureMechanism,
          rootCauseFa: bucket.rootCauseFa,
          historicalCount: bucket.count,
          successRate: round4(successRate),
          matchedSymptoms: matchedList,
        },
      } satisfies AiSuggestion;
    })
    .sort((left, right) => right.confidence - left.confidence || right.evidence.length - left.evidence.length);

  const topN = input.topN ?? 5;
  if (suggestions.length > topN && suggestions[topN] && suggestions[topN].confidence > 0.05) {
    warnings.push(`بیش از ${topN} علت محتمل وجود دارد؛ فقط ${topN} مورد برتر برگردانده شد.`);
  }
  return {
    suggestions: suggestions.slice(0, topN),
    analyzedSymptoms: symptoms,
    historySize: history.length,
    warnings,
  };
}

/* ═══════════════════════ ۲. AI PM Optimization ═══════════════════════ */

export type WeibullEstimate = { beta: number; eta: number; method: string; sampleSize: number; rSquared: number; warnings: string[] };

/**
 * برآورد پارامترهای توزیع وایبول از دادهٔ «زمان تا خرابی» با رگرسیون
 * رتبهٔ میانه (median-rank regression) — روش استاندارد نمودار احتمال وایبول.
 *
 *   F_i = (i − 0.3) / (n + 0.4)          (رتبهٔ میانهٔ بنارد)
 *   y   = ln( ln( 1 / (1 − F_i) ) )
 *   x   = ln( t_i )
 *   شیب = β ، عرض از مبدأ = −β·ln(η)
 *
 * نمونهٔ کمتر از ۳ داده برآورد معنادار نمی‌دهد و با هشدار صریح برگردانده
 * می‌شود، نه با عدد ساختگی.
 */
export function estimateWeibullFromTtf(ttfHours: number[]): WeibullEstimate {
  const warnings: string[] = [];
  const raw = ttfHours ?? [];
  const samples = raw.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const n = samples.length;
  /* حذف دادهٔ نامعتبر باید گفته شود. در محاسبهٔ قابلیت اطمینان، نمونهٔ
   * گم‌شده یعنی β و η بر پایهٔ جمعیتی متفاوت از آنچه کاربر فکر می‌کند
   * برآورد شده‌اند — و این دقیقاً همان چیزی است که ممیزی را گمراه می‌کند. */
  const dropped = raw.length - n;
  if (dropped > 0) {
    warnings.push(`${dropped} دادهٔ نامعتبر (غیرعددی، صفر یا منفی) از ${raw.length} ورودی کنار گذاشته شد.`);
  }
  if (n < 3) {
    warnings.push(`نمونهٔ کافی نیست (${n} داده؛ دست‌کم ۳ لازم است) — برآورد انجام نشد و مقادیر پیش‌فرض برگردانده شد.`);
    return { beta: 1, eta: samples.length ? samples[samples.length - 1] : 0, method: "fallback", sampleSize: n, rSquared: 0, warnings };
  }

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const f = (i + 1 - 0.3) / (n + 0.4);
    if (f <= 0 || f >= 1) continue;
    xs.push(Math.log(samples[i]));
    ys.push(Math.log(-Math.log(1 - f)));
  }
  if (xs.length < 2) {
    warnings.push("پس از پالایش، نقطهٔ کافی برای رگرسیون باقی نماند.");
    return { beta: 1, eta: samples[n - 1], method: "fallback", sampleSize: n, rSquared: 0, warnings };
  }

  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const sxx = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  const sxy = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0);
  if (sxx === 0) {
    warnings.push("واریانس زمان تا خرابی صفر است؛ برآورد β ممکن نیست.");
    return { beta: 1, eta: samples[n - 1], method: "fallback", sampleSize: n, rSquared: 0, warnings };
  }
  const beta = sxy / sxx;
  const intercept = meanY - beta * meanX;
  const eta = Math.exp(-intercept / beta);

  const ssTot = ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
  const ssRes = xs.reduce((sum, x, index) => sum + (ys[index] - (beta * x + intercept)) ** 2, 0);
  const rSquared = ssTot > 0 ? round4(1 - ssRes / ssTot) : 1;

  if (rSquared < 0.7) warnings.push(`برازش ضعیف است (R²=${rSquared}) — توزیع وایبول ممکن است برای این داده مناسب نباشد.`);
  if (beta <= 0) warnings.push(`β برآوردشده نامعتبر است (${round4(beta)}) — دادهٔ ورودی بازبینی شود.`);

  return {
    beta: round4(beta), eta: round4(eta), method: "median-rank-regression", sampleSize: n, rSquared, warnings,
  };
}

/**
 * بهینه‌سازی هوشمند فاصلهٔ سرویس پیشگیرانه.
 *
 * زنجیره: دادهٔ خرابی → برآورد وایبول → مدل تعویض سنی → فاصلهٔ بهینه.
 * اگر `weibull` صریحاً داده شود، برآورد از داده رد می‌شود (حالت «مهندس
 * مقدار را می‌داند»)، و در خروجی ذکر می‌شود که منبع ورودی دستی بوده است.
 */
export function optimizePmWithAi(input: {
  ttfHours?: number[];
  weibull?: { beta: number; eta: number };
  preventiveCost: number;
  failureCost: number;
  meanRepairHours: number;
  currentInterval?: number | null;
  assetId?: string | null;
  familyId?: string | null;
}): {
  suggestion: AiSuggestion;
  weibull: WeibullEstimate | null;
  optimization: PmOptimizationResult;
  warnings: string[];
} {
  const warnings: string[] = [];
  let weibull: WeibullEstimate | null = null;
  let beta: number;
  let eta: number;

  if (input.weibull) {
    beta = input.weibull.beta;
    eta = input.weibull.eta;
    if (!(beta > 0)) throw new RangeError(`CMMS_AI_PM_BETA: β نامعتبر (${beta})`);
    if (!(eta > 0)) throw new RangeError(`CMMS_AI_PM_ETA: η نامعتبر (${eta})`);
    /* ورودی دستی هم باید در خروجی برگردد. لایهٔ HTTP این عدد را در
     * CmmsAiRun ذخیره می‌کند؛ اگر null برگردانیم، پروندهٔ آن اجرای AI
     * نمی‌گوید بر پایهٔ چه پارامترهایی توصیه داده شده و غیرقابل بازبینی می‌شود. */
    weibull = { beta, eta, method: "manual", sampleSize: 0, rSquared: 0, warnings: [] };
    warnings.push("پارامترهای وایبول دستی داده شدند و از دادهٔ تاریخی برآورد نشدند.");
  } else {
    weibull = estimateWeibullFromTtf(input.ttfHours ?? []);
    beta = weibull.beta;
    eta = weibull.eta;
    warnings.push(...weibull.warnings);
    /* نبودِ داده یک خطای فراخوان نیست؛ یک وضعیت است. به‌جای پرتاب استثنا،
     * «توصیه‌ای نداریم» برمی‌گردانیم تا اندپوینت AI با تاریخچهٔ خالی هم
     * پاسخ معتبر بدهد و کاربر بداند چرا عددی پیشنهاد نشده است. */
    if (!(eta > 0) || weibull.method === "fallback") {
      warnings.push("برآورد وایبول ممکن نشد؛ فاصلهٔ سرویس پیشنهاد نمی‌شود.");
      return {
        suggestion: {
          type: "pm-interval",
          titleFa: "فاصلهٔ سرویس پیشنهاد نمی‌شود — دادهٔ کافی نیست",
          explanationFa: `برای برآورد توزیع وایبول دست‌کم ۳ دادهٔ «زمان تا خرابی» لازم است. ${weibull.warnings.join(" ")} تا زمان گردآوری داده، فاصلهٔ جاری سرویس بدون تغییر بماند.`,
          confidence: 0,
          priority: 3,
          evidence: [],
          suggestedValue: { recommendedInterval: null, beta, eta, reasonFa: "دادهٔ کافی برای برآورد وایبول وجود ندارد" },
        },
        weibull,
        optimization: optimizePmInterval({
          eta: 1, beta: 1,
          preventiveCost: input.preventiveCost,
          failureCost: input.failureCost,
          meanRepairHours: input.meanRepairHours,
        }),
        warnings,
      };
    }
  }

  const optimization = optimizePmInterval({
    eta, beta,
    preventiveCost: input.preventiveCost,
    failureCost: input.failureCost,
    meanRepairHours: input.meanRepairHours,
  });
  warnings.push(...optimization.warnings);

  const currentInterval = input.currentInterval ?? null;
  const changePct = currentInterval && currentInterval > 0
    ? round4(((optimization.recommendedInterval - currentInterval) / currentInterval) * 100)
    : null;

  /* وایبول دستی rSquared و نمونه ندارد؛ پس اطمینانش ثابت و متوسط است و
   * نباید به‌خاطر صفربودنِ R² به نزدیک صفر سقوط کند. */
  const confidence = weibull.method === "manual"
    ? 0.5
    : clampConfidence(0.4 + 0.5 * weibull.rSquared + Math.min(0.1, weibull.sampleSize / 100));

  const suggestion: AiSuggestion = {
    type: "pm-interval",
    titleFa: `فاصلهٔ بهینهٔ سرویس: ${optimization.recommendedInterval} ${"ساعت"}`,
    explanationFa: [
      weibull
        ? `وایبول از ${weibull.sampleSize} دادهٔ خرابی برآورد شد (β=${weibull.beta}, η=${weibull.eta}, R²=${weibull.rSquared}).`
        : `پارامترهای دستی (β=${beta}, η=${eta}) استفاده شد.`,
      optimization.recommendationFa,
      optimization.savingPct != null ? `کاهش نرخ هزینه نسبت به حالت بدون سرویس: ${optimization.savingPct}٪.` : "",
      changePct != null
        ? `نسبت به فاصلهٔ جاری (${currentInterval}) تغییر ${changePct > 0 ? "+" : ""}${changePct}٪ پیشنهاد می‌شود.`
        : "فاصلهٔ جاری برای مقایسه داده نشد.",
      optimization.wearOutDetected
        ? "الگوی فرسایش (β>۱) مشاهده شد، پس سرویس دوره‌ای توجیه دارد."
        : "الگوی فرسایش مشاهده نشد (β≤۱)؛ سرویس دوره‌ای توجیه اقتصادی ندارد.",
    ].filter(Boolean).join(" "),
    confidence,
    priority: optimization.savingPct != null && optimization.savingPct > 15 ? 1 : optimization.savingPct != null && optimization.savingPct > 5 ? 2 : 3,
    evidence: [
      ...(weibull ? [{
        kind: "weibull-fit", reference: `n=${weibull.sampleSize}`,
        detailFa: `برازش وایبول با R²=${weibull.rSquared} روی ${weibull.sampleSize} دادهٔ زمان تا خرابی`,
        weight: weibull.rSquared,
      }] : []),
      {
        kind: "cost-model", reference: "age-replacement",
        detailFa: `نرخ هزینهٔ بهینه ${optimization.costRateAtRecommended} در برابر ${optimization.costRateRunToFailure} بدون سرویس`,
        weight: 1,
      },
    ],
    suggestedValue: {
      recommendedInterval: optimization.recommendedInterval,
      currentInterval, changePct, beta, eta,
      savingPct: optimization.savingPct,
      wearOutDetected: optimization.wearOutDetected,
      assetId: input.assetId ?? null,
      familyId: input.familyId ?? null,
    },
  };
  return { suggestion, weibull, optimization, warnings };
}

/* ═══════════════════════ ۳. AI Repair Guidance ═══════════════════════ */

export type RepairHistoryRecord = {
  workOrderId: string;
  assetId?: string;
  failureMode: string;
  failureMechanism?: string;
  fixDescriptionFa: string;
  parts: Array<{ partNumber: string; quantity: number }>;
  laborHours: number;
  cost?: number;
  resolved: boolean;
};

/** میانهٔ یک آرایهٔ عددی — برای برآورد هزینه/ساعت که به دادهٔ پرت حساس نباشد. */
export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * پیشنهاد راهکار تعمیر و قطعات مورد نیاز بر پایهٔ سوابق تاریخی.
 *
 * امتیاز هر راهکار = فراوانی × نرخ موفقیت، با تشدید برای سابقهٔ همان تجهیز.
 * قطعات با جمع مصرف تاریخی و میانهٔ تعداد پیشنهاد می‌شوند. ساعت و هزینه با
 * میانه برآورد می‌شوند چون میانگین با یک تعمیر استثنایی به‌شدت جابه‌جا می‌شود.
 */
export function recommendRepair(input: {
  failureMode: string;
  failureMechanism?: string | null;
  assetId?: string | null;
  history: RepairHistoryRecord[];
  sameAssetBoost?: number;
  topN?: number;
}): { suggestions: AiSuggestion[]; spareSuggestions: AiSuggestion[]; matchedRecords: number; warnings: string[] } {
  const warnings: string[] = [];
  const history = input.history ?? [];
  const failureMode = normalizeText(input.failureMode);
  if (!failureMode) throw new RangeError("CMMS_AI_REPAIR_MODE: حالت خرابی برای پیشنهاد تعمیر الزامی است");

  const relevant = history.filter((record) => normalizeText(record.failureMode) === failureMode);
  if (relevant.length === 0) {
    warnings.push("هیچ سابقهٔ تعمیر با این حالت خرابی یافت نشد — پیشنهادی تولید نمی‌شود تا حدس بی‌اساس جای تجربه را نگیرد.");
    return { suggestions: [], spareSuggestions: [], matchedRecords: 0, warnings };
  }

  const mechanism = normalizeText(input.failureMechanism ?? "");
  const sameAssetBoost = input.sameAssetBoost ?? 1.4;

  type FixBucket = {
    fixDescriptionFa: string;
    count: number;
    resolvedCount: number;
    score: number;
    workOrders: string[];
    hours: number[];
    costs: number[];
    parts: Map<string, { totalQty: number; times: number }>;
  };
  const buckets = new Map<string, FixBucket>();

  for (const record of relevant) {
    const key = normalizeText(record.fixDescriptionFa);
    const bucket: FixBucket = buckets.get(key) ?? {
      fixDescriptionFa: record.fixDescriptionFa, count: 0, resolvedCount: 0, score: 0,
      workOrders: [], hours: [], costs: [], parts: new Map(),
    };
    const mechanismMatch = !mechanism || normalizeText(record.failureMechanism ?? "") === mechanism;
    const assetMatch = input.assetId && record.assetId === input.assetId;
    const weight = (mechanismMatch ? 1 : 0.7) * (assetMatch ? sameAssetBoost : 1) * (record.resolved ? 1 : 0.45);

    bucket.count += 1;
    if (record.resolved) bucket.resolvedCount += 1;
    bucket.score += weight;
    bucket.workOrders.push(record.workOrderId);
    if (Number.isFinite(record.laborHours)) bucket.hours.push(record.laborHours);
    if (record.cost != null && Number.isFinite(record.cost)) bucket.costs.push(record.cost);
    for (const part of record.parts ?? []) {
      const entry = bucket.parts.get(part.partNumber) ?? { totalQty: 0, times: 0 };
      entry.totalQty += part.quantity;
      entry.times += 1;
      bucket.parts.set(part.partNumber, entry);
    }
    buckets.set(key, bucket);
  }

  const totalScore = [...buckets.values()].reduce((sum, bucket) => sum + bucket.score, 0);
  const topN = input.topN ?? 3;

  const ranked = [...buckets.values()].sort((left, right) => right.score - left.score);
  const suggestions: AiSuggestion[] = ranked.slice(0, topN).map((bucket) => {
    const successRate = bucket.count > 0 ? bucket.resolvedCount / bucket.count : 0;
    const confidence = clampConfidence((totalScore > 0 ? bucket.score / totalScore : 0) * (0.6 + 0.4 * successRate));
    const medianHours = median(bucket.hours);
    const medianCost = median(bucket.costs);
    return {
      type: "repair-action" as const,
      titleFa: bucket.fixDescriptionFa,
      explanationFa: [
        `${bucket.count} بار در تاریخچه با همین حالت خرابی انجام شده است.`,
        `نرخ موفقیت ${round2(successRate * 100)}٪.`,
        medianHours != null ? `میانهٔ نفرساعت ${round2(medianHours)}.` : "دادهٔ نفرساعت کافی نبود.",
        medianCost != null ? `میانهٔ هزینه ${round2(medianCost)}.` : "دادهٔ هزینه کافی نبود.",
        bucket.parts.size ? `${bucket.parts.size} قلم قطعه در این راهکار مصرف شده است.` : "بدون مصرف قطعهٔ ثبت‌شده.",
      ].join(" "),
      confidence,
      priority: confidence >= 0.5 ? 1 : confidence >= 0.25 ? 2 : 3,
      evidence: bucket.workOrders.slice(0, 8).map((reference) => ({
        kind: "historical-work-order", reference,
        detailFa: `دستورکار ${reference} با همین راهکار`,
        weight: round4(bucket.score),
      })),
      suggestedValue: {
        fixDescriptionFa: bucket.fixDescriptionFa,
        historicalCount: bucket.count,
        successRate: round4(successRate),
        medianLaborHours: medianHours != null ? round2(medianHours) : null,
        medianCost: medianCost != null ? round2(medianCost) : null,
        partNumbers: [...bucket.parts.keys()],
      },
    } satisfies AiSuggestion;
  });

  /* قطعات از همهٔ راهکارهای مرتبط تجمیع می‌شوند، نه فقط راهکار اول — چون
   * انبار باید برای هر دو سناریوی محتمل آماده باشد. */
  const partTotals = new Map<string, { totalQty: number; times: number; fixes: Set<string> }>();
  for (const bucket of buckets.values()) {
    for (const [partNumber, entry] of bucket.parts) {
      const aggregate = partTotals.get(partNumber) ?? { totalQty: 0, times: 0, fixes: new Set<string>() };
      aggregate.totalQty += entry.totalQty;
      aggregate.times += entry.times;
      aggregate.fixes.add(bucket.fixDescriptionFa);
      partTotals.set(partNumber, aggregate);
    }
  }
  const spareSuggestions: AiSuggestion[] = [...partTotals.entries()]
    .map(([partNumber, aggregate]) => {
      const frequency = aggregate.times / relevant.length;
      return {
        type: "spare-needed" as const,
        titleFa: `قطعهٔ ${partNumber}`,
        explanationFa: `در ${aggregate.times} تعمیر از ${relevant.length} سابقهٔ مرتبط مصرف شده (فراوانی ${round2(frequency * 100)}٪). جمع مصرف ${round2(aggregate.totalQty)}.`,
        confidence: clampConfidence(frequency),
        priority: frequency >= 0.6 ? 1 : frequency >= 0.3 ? 2 : 3,
        evidence: [...aggregate.fixes].slice(0, 5).map((fix) => ({
          kind: "repair-action", reference: fix, detailFa: `در راهکار «${fix}» مصرف شده`, weight: round4(frequency),
        })),
        suggestedValue: {
          partNumber,
          suggestedQuantity: Math.ceil(median([...buckets.values()].flatMap((bucket) => {
            const entry = bucket.parts.get(partNumber);
            return entry ? [entry.totalQty / entry.times] : [];
          })) ?? 1),
          historicalFrequency: round4(frequency),
          totalHistoricalQuantity: round2(aggregate.totalQty),
        },
      } satisfies AiSuggestion;
    })
    .sort((left, right) => right.confidence - left.confidence);

  if (relevant.length < 3) warnings.push(`سابقهٔ کم (${relevant.length} رکورد) — اطمینان پیشنهادها پایین است.`);
  return { suggestions, spareSuggestions, matchedRecords: relevant.length, warnings };
}

/* ═══════════════════════ ۴. AI Tree Generator ═══════════════════════ */

/** کلیدواژه‌هایی که یک قلم را به «قطعهٔ قابل نگهداری» تبدیل می‌کنند. */
const COMPONENT_KEYWORDS = [
  "bearing", "بلبرینگ", "رولبرینگ", "seal", "آب‌بند", "کاسه‌نمد", "impeller", "پروانه",
  "coupling", "کوپلینگ", "shaft", "شافت", "motor", "موتور", "gear", "چرخ‌دنده",
  "filter", "فیلتر", "valve", "شیر", "sensor", "سنسور", "belt", "تسمه", "gasket", "واشر",
  "brush", "جاروبک", "winding", "سیم‌پیچ", "piston", "پیستون", "rod", "شاتون",
];

/** کلیدواژه‌هایی که یک قلم را به «زیرواحد» تبدیل می‌کنند. */
const SUBUNIT_KEYWORDS = [
  "assembly", "مجموعه", "unit", "واحد", "section", "بخش", "drive", "درایو",
  "gearbox", "گیربکس", "housing", "پوسته", "system", "سیستم", "circuit", "مدار",
];

export type GeneratedTreeNode = {
  nodeCode: string;
  nameFa: string;
  boundaryLevel: "equipment" | "sub-unit" | "component" | "maintenance-item";
  parentNodeCode: string | null;
  pathLevel: number;
  confidence: number;
  sourceLine: number;
  detectedBy: "numbering" | "indentation" | "bullet" | "template";
};

/**
 * ساخت خودکار درخت تجهیز از متن کاتالوگ یا فهرست فنی.
 *
 * عمق از سه نشانه استخراج می‌شود، به ترتیب اولویت:
 *   ۱) شماره‌گذاری سلسله‌مراتبی (1.2.3) — قابل‌اعتمادترین نشانه
 *   ۲) تورفتگی (هر ۲ فاصله یا یک Tab = یک سطح)
 *   ۳) گلولهٔ فهرست (-, *, •) که فقط «هم‌سطح بودن» را نشان می‌دهد
 *
 * سطح مرز (ISO 14224) از کلیدواژه و عمق استنتاج می‌شود و برای هر گره یک
 * «اطمینان» ثبت می‌شود تا مهندس بداند کدام گره‌ها نیازمند بازبینی‌اند.
 *
 * این یک تحلیل‌گر متن است، نه یک مدل زبانی: برای کاتالوگ‌های ساخت‌یافته
 * (که اکثر کاتالوگ‌های OEM این‌طورند) دقیق و قابل بازتولید است و برای متن
 * آزاد، اطمینان پایین گزارش می‌کند تا بازبینی انسانی لازم شود.
 */
export function generateEquipmentTree(input: {
  catalogText: string;
  equipmentCode: string;
  equipmentNameFa?: string;
  /** حداقل عمق برای تشخیص تورفتگی به فاصله. */
  indentUnit?: number;
}): {
  nodes: GeneratedTreeNode[];
  skippedLines: number;
  mergedRootLines: number;
  siblingEquipmentLines: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const indentUnit = input.indentUnit ?? 2;
  const equipmentCode = String(input.equipmentCode ?? "").trim();
  if (!equipmentCode) throw new RangeError("CMMS_AI_TREE_CODE: کد تجهیز برای ساخت درخت الزامی است");

  const lines = String(input.catalogText ?? "").split(/\r?\n/);
  if (lines.length === 0) warnings.push("متن کاتالوگ خالی است.");

  const nodes: GeneratedTreeNode[] = [{
    nodeCode: equipmentCode.toUpperCase(),
    nameFa: input.equipmentNameFa?.trim() || equipmentCode.toUpperCase(),
    boundaryLevel: "equipment",
    parentNodeCode: null,
    pathLevel: 1,
    confidence: 1,
    sourceLine: 0,
    detectedBy: "template",
  }];

  const stack: Array<{ level: number; nodeCode: string }> = [{ level: 0, nodeCode: equipmentCode.toUpperCase() }];
  let skippedLines = 0;
  /* سه شمارندهٔ شفافیت: چند خط با ریشه ادغام شد، چند خط تجهیزِ هم‌سطح (و پس
   * بیرون از مرز این تجهیز) بود. این‌ها در پاسخ API برمی‌گردند تا کاربر بداند
   * کجای کاتالوگ نادیده گرفته شده و چرا. */
  let mergedRootLines = 0;
  let siblingEquipmentLines = 0;
  let seenTopLevel = false;
  const usedCodes = new Set<string>([equipmentCode.toUpperCase()]);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const trimmed = raw.trim();
    if (!trimmed) { skippedLines += 1; continue; }

    /* تشخیص شماره‌گذاری سلسله‌مراتبی مثل 1، 1.2، 1.2.3 یا 1-2-3 */
    const numberingMatch = trimmed.match(/^(\d+(?:[.\-]\d+)*)[.)\-\s]+(.+)$/);
    const bulletMatch = trimmed.match(/^[-*•▪]\s+(.+)$/);
    const leadingWhitespace = raw.length - raw.trimStart().length;

    let level: number;
    let text: string;
    let detectedBy: GeneratedTreeNode["detectedBy"];
    let confidence: number;

    if (numberingMatch) {
      level = numberingMatch[1].split(/[.\-]/).length;
      text = numberingMatch[2].trim();
      detectedBy = "numbering";
      confidence = 0.9;
    } else if (bulletMatch) {
      level = Math.floor(leadingWhitespace / indentUnit) + 1;
      text = bulletMatch[1].trim();
      detectedBy = "bullet";
      confidence = 0.6;
    } else if (leadingWhitespace >= indentUnit) {
      level = Math.floor(leadingWhitespace / indentUnit) + 1;
      text = trimmed;
      detectedBy = "indentation";
      confidence = 0.7;
    } else {
      /* خط بدون هیچ نشانهٔ ساختاری: اگر کوتاه باشد یک قلم هم‌سطح سطح ۱
       * فرض می‌شود، وگرنه احتمالاً توضیح آزاد است و رد می‌شود. */
      if (trimmed.length > 120) { skippedLines += 1; continue; }
      level = 1;
      text = trimmed;
      detectedBy = "indentation";
      confidence = 0.45;
      warnings.push(`خط ${index + 1} نشانهٔ ساختاری ندارد و هم‌سطح سطح ۱ فرض شد.`);
    }

    if (!text) { skippedLines += 1; continue; }

    /* شمارهٔ هم‌سطحِ خودِ تجهیز یعنی سطر یک تجهیزِ دیگر است، نه جزء این تجهیز.
     * آویزان‌کردن بی‌صدای آن، مرز تجهیز (Asset Boundary) را خراب می‌کند؛ پس
     * گزارش می‌شود و وارد درخت نمی‌شود تا مهندس جداگانه ثبتش کند.
     *
     * ترتیب مهم است: این بررسی باید پیش از ادغام خط ریشه انجام شود، وگرنه خط
     * «1 پمپ P-101» به‌عنوان ریشه رد می‌شود بدون آنکه seenTopLevel ثبت شود و
     * «2 کمپرسور» نخستین هم‌سطح به‌شمار می‌آید و زیر این تجهیز می‌نشیند. */
    if (detectedBy === "numbering" && level === 1) {
      if (seenTopLevel) {
        warnings.push(`خط ${index + 1} هم‌سطحِ خود تجهیز است («${text}») و به نظر تجهیز دیگری می‌رسد؛ وارد درخت نشد.`);
        siblingEquipmentLines += 1;
        continue;
      }
      seenTopLevel = true;
    }

    /* خطی که نام خودِ تجهیز است، ریشهٔ درخت است و نباید گرهٔ فرزند بسازد.
     * بدون این بررسی، کاتالوگی که با «1 پمپ P-101» شروع می‌شود گرهٔ
     * P-101-پمپ-P-101 می‌سازد و ریشه یک لایه عمیق‌تر از واقعیت می‌شود. */
    if (text.toUpperCase().includes(equipmentCode.toUpperCase())) { mergedRootLines += 1; continue; }

    /* کد گره: ترکیب کد والد و شمارهٔ ترتیبی تا یکتا بماند. */
    const normalized = normalizeText(text).split(" ").filter(Boolean).slice(0, 3).join("-") || `item-${index + 1}`;
    let nodeCode = `${equipmentCode}-${normalized}`.toUpperCase().slice(0, 60);
    let suffix = 2;
    while (usedCodes.has(nodeCode)) {
      nodeCode = `${equipmentCode}-${normalized}-${suffix}`.toUpperCase().slice(0, 60);
      suffix += 1;
    }
    usedCodes.add(nodeCode);

    const keywords = extractKeywords(text, 2);
    const hasComponent = keywords.some((keyword) => COMPONENT_KEYWORDS.some((match) => keyword.includes(match) || match.includes(keyword)));
    const hasSubUnit = keywords.some((keyword) => SUBUNIT_KEYWORDS.some((match) => keyword.includes(match) || match.includes(keyword)));
    const boundaryLevel: GeneratedTreeNode["boundaryLevel"] = hasComponent ? "component" : hasSubUnit ? "sub-unit" : level >= 3 ? "component" : "sub-unit";
    if (!hasComponent && !hasSubUnit) confidence = round4(confidence * 0.85);

    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
    const parentNodeCode = stack[stack.length - 1].nodeCode;

    nodes.push({
      nodeCode, nameFa: text, boundaryLevel, parentNodeCode,
      pathLevel: stack.length + 1, confidence: round4(confidence),
      sourceLine: index + 1, detectedBy,
    });
    stack.push({ level, nodeCode });
  }

  if (nodes.length === 1) warnings.push("هیچ گره‌ای از متن استخراج نشد — ساختار کاتالوگ تشخیص داده نشد.");
  const lowConfidence = nodes.filter((node) => node.confidence < 0.6).length;
  if (lowConfidence > 0) warnings.push(`${lowConfidence} گره با اطمینان زیر ۰٫۶ تولید شد و نیازمند بازبینی مهندس است.`);

  return { nodes, skippedLines, mergedRootLines, siblingEquipmentLines, warnings };
}

/* ═══════════════════════ ۵. AI Smart Scheduler ═══════════════════════ */

export type SchedulableWorkOrder = {
  id: string;
  estimatedHours: number;
  requiredSkill: string;
  requiredSkillLevel?: number;
  criticalityRank: "A" | "B" | "C" | "D";
  isAssetDown: boolean;
  productionImpact: "none" | "partial" | "line-stop" | "plant-stop";
  safetyConcern?: boolean;
  dueDate: string;         /* ISO date */
  preferredWindow?: "production-break" | "any";
  assetId?: string;
  locationId?: string;
};

export type SchedulableTechnician = {
  id: string;
  nameFa: string;
  skills: Array<{ key: string; level: number }>;
  dailyCapacityHours: number;
  unavailableDates?: string[];
};

export type ScheduleDay = {
  date: string;             /* ISO date */
  working: boolean;
  /** پنجرهٔ توقف تولید که کار نت در آن مجاز/ترجیحی است. */
  isProductionBreak: boolean;
};

export type ScheduleAssignment = {
  workOrderId: string;
  technicianId: string;
  date: string;
  hours: number;
  priorityScore: number;
  isProductionBreak: boolean;
  reasonFa: string;
};

export type SmartScheduleResult = {
  assignments: ScheduleAssignment[];
  unassigned: Array<{ workOrderId: string; reasonFa: string; priorityScore: number }>;
  utilization: Array<{ technicianId: string; assignedHours: number; capacityHours: number; utilizationPct: number }>;
  /** آمار کل برای داشبورد. */
  summary: {
    totalOrders: number; assignedOrders: number; assignedHours: number;
    totalCapacityHours: number; overallUtilizationPct: number;
    productionBreakOrders: number;
  };
  warnings: string[];
};

const HOURS_PER_DAY_GUARD = 24;

/**
 * زمان‌بندی هوشمند دستورکارها.
 *
 * الگوریتم: اعزام حریصانه (greedy dispatch) با اولویت‌بندی ترکیبی.
 *   ۱) امتیاز اولویت هر دستورکار از `computeWorkOrderPriorityScore` دامنه
 *      (بحرانی‌بودن × توقف × اثر تولید × ایمنی × فوریت).
 *   ۲) مرتب‌سازی نزولی بر پایهٔ امتیاز، با شکستن تساوی بر پایهٔ سررسید.
 *   ۳) برای هر دستورکار، نخستین روز کاری که (الف) تکنسین واجد مهارت
 *      ظرفیت کافی دارد، (ب) روز غیرکاری نیست، و اگر دستورکار پنجرهٔ توقف
 *      تولید را ترجیح می‌دهد روز پنجره باشد.
 *
 * چرا حریصانه و نه بهینه‌سازی ترکیبی کامل؟ چون در نت، قابلیت توضیح و
 * پیش‌بینی‌پذیری از چند درصد بهینگی مهم‌تر است و برنامه‌ریز باید بتواند
 * دلیل هر انتساب را ببیند. بهینه‌سازی ترکیبی واقعی در فاز ۵ برنامه‌ریزی شده.
 *
 * محدودیت سخت: مجموع ساعات تخصیص‌یافته به یک تکنسین در یک روز هرگز از
 * ظرفیت روزانه‌اش بیشتر نمی‌شود — این همان چیزی است که در عمل نقض می‌شود
 * و برنامهٔ نت را بی‌اعتبار می‌کند.
 */
export function scheduleWorkOrders(input: {
  workOrders: SchedulableWorkOrder[];
  technicians: SchedulableTechnician[];
  calendar: ScheduleDay[];
  horizonDays?: number;
  now?: Date | string;
  /** وزن‌های اولویت‌بندی — قابل تنظیم برای هر سایت. */
  priorityWeights?: {
    criticality?: number; downtime?: number; impact?: number; safety?: number; urgency?: number;
  };
}): SmartScheduleResult {
  const warnings: string[] = [];
  const workOrders = input.workOrders ?? [];
  const technicians = input.technicians ?? [];
  const calendar = input.calendar ?? [];

  if (technicians.length === 0) warnings.push("هیچ تکنسینی داده نشد؛ هیچ انتسابی انجام نمی‌شود.");
  if (calendar.length === 0) warnings.push("تقویم خالی است؛ هیچ روزی برای انتساب وجود ندارد.");

  /* امتیاز اولویت یک‌بار محاسبه می‌شود تا هم در مرتب‌سازی و هم در خروجی
   * همان عدد باشد — دو محاسبهٔ جدا می‌تواند به تناقض منجر شود. */
  const scored = workOrders.map((order) => {
    const dueDate = new Date(order.dueDate);
    const at = input.now ? new Date(input.now) : new Date("2026-01-01T00:00:00Z");
    const hoursUntilDue = Number.isNaN(dueDate.getTime()) ? null : (dueDate.getTime() - at.getTime()) / 3600_000;
    /* امتیاز از همان تابع دامنه می‌آید، نه یک بازپیاده‌سازی موازی. دو نسخهٔ
     * هم‌نام از یک فرمول قطعاً واگرا می‌شوند و آن‌وقت صف اولویت در داشبورد با
     * صف زمان‌بند نمی‌خواند. وزن‌های ورودی هم به همان تابع پاس داده می‌شوند. */
    const { score: priorityScore } = computeWorkOrderPriorityScore({
      criticalityRank: order.criticalityRank,
      isAssetDown: order.isAssetDown,
      productionImpact: order.productionImpact,
      safetyConcern: order.safetyConcern ?? false,
      hoursUntilDue,
      weights: input.priorityWeights,
    });
    return { order, priorityScore: round4(priorityScore), hoursUntilDue };
  });

  const ordered = sortByPriority(scored, (entry) => entry.priorityScore, (left, right) => {
    const leftDue = new Date(left.order.dueDate).getTime();
    const rightDue = new Date(right.order.dueDate).getTime();
    if (Number.isNaN(leftDue) && Number.isNaN(rightDue)) return 0;
    if (Number.isNaN(leftDue)) return 1;
    if (Number.isNaN(rightDue)) return -1;
    return leftDue - rightDue;
  });

  const calendarByDate = new Map(calendar.map((day) => [day.date, day]));
  const workingDays = calendar.filter((day) => day.working).map((day) => day.date);
  if (workingDays.length === 0 && calendar.length > 0) warnings.push("هیچ روز کاری در تقویم نیست.");

  /* بار باقی‌ماندهٔ هر تکنسین در هر روز. */
  const remaining = new Map<string, number>();
  const keyOf = (technicianId: string, date: string): string => `${technicianId}#${date}`;
  for (const technician of technicians) {
    for (const date of workingDays) {
      const day = calendarByDate.get(date);
      const unavailable = (technician.unavailableDates ?? []).includes(date);
      remaining.set(keyOf(technician.id, date), unavailable || !day ? 0 : Math.min(technician.dailyCapacityHours, HOURS_PER_DAY_GUARD));
    }
  }

  const assignments: ScheduleAssignment[] = [];
  const unassigned: SmartScheduleResult["unassigned"] = [];
  const assignedHoursByTechnician = new Map<string, number>();

  for (const entry of ordered) {
    const { order, priorityScore } = entry;
    if (!(order.estimatedHours > 0)) {
      unassigned.push({ workOrderId: order.id, reasonFa: "ساعت برآوردی صفر یا نامعتبر است.", priorityScore });
      continue;
    }
    if (order.estimatedHours > HOURS_PER_DAY_GUARD) {
      unassigned.push({
        workOrderId: order.id,
        reasonFa: `ساعت برآوردی ${order.estimatedHours} از سقف یک روز (${HOURS_PER_DAY_GUARD}) بیشتر است — باید به چند دستورکار تقسیم شود.`,
        priorityScore,
      });
      continue;
    }

    const qualified = technicians.filter((technician) => {
      const skill = (technician.skills ?? []).find((item) => item.key === order.requiredSkill);
      if (!skill) return false;
      return skill.level >= (order.requiredSkillLevel ?? 1);
    });
    if (qualified.length === 0) {
      unassigned.push({
        workOrderId: order.id,
        reasonFa: `هیچ تکنسین واجد مهارت «${order.requiredSkill}» (سطح ≥ ${order.requiredSkillLevel ?? 1}) در دسترس نیست.`,
        priorityScore,
      });
      continue;
    }

    /* دو گذر: نخست روزهای پنجرهٔ توقف تولید (کم‌هزینه‌ترین زمان برای نت)،
     * سپس بقیهٔ روزهای کاری. این ترتیب دقیقاً همان «بار خط تولید» است که
     * در خواست کاربر آمده — نت در زمان توقف تولید انجام شود نه در زمان کار. */
    const breakDays = workingDays.filter((date) => calendarByDate.get(date)?.isProductionBreak);
    const normalDays = workingDays.filter((date) => !calendarByDate.get(date)?.isProductionBreak);
    const dayPreference = order.preferredWindow === "production-break"
      ? [...breakDays, ...normalDays]
      : [...breakDays, ...normalDays];

    let placed = false;
    for (const date of dayPreference) {
      if (placed) break;
      const day = calendarByDate.get(date);
      /* برای دستورکاری که پنجرهٔ توقف تولید را «الزام» کرده، روز عادی مجاز نیست. */
      if (order.preferredWindow === "production-break" && !day?.isProductionBreak) continue;
      for (const technician of qualified) {
        const key = keyOf(technician.id, date);
        const available = remaining.get(key) ?? 0;
        if (available >= order.estimatedHours) {
          remaining.set(key, round4(available - order.estimatedHours));
          assignedHoursByTechnician.set(technician.id, round4((assignedHoursByTechnician.get(technician.id) ?? 0) + order.estimatedHours));
          assignments.push({
            workOrderId: order.id,
            technicianId: technician.id,
            date,
            hours: order.estimatedHours,
            priorityScore,
            isProductionBreak: Boolean(day?.isProductionBreak),
            reasonFa: [
              `امتیاز اولویت ${priorityScore}`,
              `تکنسین ${technician.nameFa} مهارت «${order.requiredSkill}» را دارد`,
              day?.isProductionBreak ? "در پنجرهٔ توقف تولید قرار گرفت تا بار خط تولید حفظ شود" : "در روز کاری عادی قرار گرفت",
            ].join(" · "),
          });
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      unassigned.push({
        workOrderId: order.id,
        reasonFa: `در افق برنامه‌ریزی ظرفیت خالی کافی (${order.estimatedHours} ساعت پیوسته) برای مهارت «${order.requiredSkill}» یافت نشد.`,
        priorityScore,
      });
    }
  }

  const capacityHours = round4(technicians.reduce(
    (sum, technician) => sum + workingDays.filter((date) => !(technician.unavailableDates ?? []).includes(date)).length * technician.dailyCapacityHours, 0));
  const assignedHours = round4(assignments.reduce((sum, assignment) => sum + assignment.hours, 0));
  const utilization = technicians.map((technician) => {
    const assigned = assignedHoursByTechnician.get(technician.id) ?? 0;
    const capacity = workingDays.filter((date) => !(technician.unavailableDates ?? []).includes(date)).length * technician.dailyCapacityHours;
    return {
      technicianId: technician.id,
      assignedHours: round4(assigned),
      capacityHours: round4(capacity),
      utilizationPct: capacity > 0 ? round4((assigned / capacity) * 100) : 0,
    };
  });

  const productionBreakOrders = assignments.filter((assignment) => assignment.isProductionBreak).length;
  if (unassigned.length > 0) {
    warnings.push(`${unassigned.length} دستورکار زمان‌بندی نشد — علت هر کدام در فهرست unassigned آمده است.`);
  }
  if (capacityHours > 0 && assignedHours / capacityHours > 0.9) {
    warnings.push("بار کل بالای ۹۰٪ ظرفیت است؛ هیچ حاشیهٔ امنی برای خرابی اضطراری باقی نمانده است.");
  }

  return {
    assignments,
    unassigned,
    utilization,
    summary: {
      totalOrders: workOrders.length,
      assignedOrders: assignments.length,
      assignedHours,
      totalCapacityHours: capacityHours,
      overallUtilizationPct: capacityHours > 0 ? round4((assignedHours / capacityHours) * 100) : 0,
      productionBreakOrders,
    },
    warnings,
  };
}
