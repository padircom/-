/**
 * موتور دامنهٔ پایش میدانی و تله‌متری حفاری (iiot-v1)
 * ═══════════════════════════════════════════════════════════════════════
 * این فایل کاملاً **خالص** است: نه I/O دارد، نه ساعت سیستم را می‌خواند، نه به
 * پایگاه‌داده یا شبکه دست می‌زند. هر چیزی که «الان» لازم دارد، به‌صورت ورودی
 * می‌گیرد (`nowIso`). به همین دلیل کل منطق تشخیص ناهنجاری در Node قابل آزمون
 * است، بدون InfluxDB و بدون دکل واقعی.
 *
 * چهار مسئلهٔ اصلی که این موتور حل می‌کند:
 *
 * ۱) **حذف نویز** — سیگنال حفاری پر از نوسان طبیعی لایه‌های زمین است. فیلتر
 *    پنجره‌ای (SMA/EMA/میانه) با دورهٔ گرم‌شدن (warm-up) و ناحیهٔ مرده
 *    (deadband) مقدار «قابل اتکا» را می‌سازد.
 *
 * ۲) **ضد هشدار کاذب** — هیچ آستانه‌ای با یک نمونهٔ گذرا اعلام نمی‌شود.
 *    سه دروازه وجود دارد: حداقل نمونه (`minSamples`)، پایداری زمانی
 *    (`durationSeconds`) و دورهٔ سکوت (`cooldownSeconds`)؛ به‌علاوهٔ هیسترزیس
 *    برای بازگشت به وضعیت عادی.
 *
 * ۳) **تشخیص پدیده، نه فقط عدد** — Stick-Slip مته از «پراکندگی گشتاور +
 *    نوسان دورانی» تشخیص داده می‌شود، افت فشار پمپ گل از «افت پایدار نسبت به
 *    خط مبنا»، و سیگنال یخ‌زده از «ثابت‌ماندن غیرطبیعی». هیچ‌کدام با یک
 *    آستانهٔ ساده قابل تشخیص نیستند.
 *
 * ۴) **Store-and-Forward** — وقتی لینک ماهواره‌ای دکل قطع است، نمونه‌ها در
 *    دسته‌های دارای چک‌سام بافر می‌شوند؛ ارسال دوباره، دادهٔ دوباره نمی‌سازد و
 *    دستهٔ خراب پس از n تلاش به «نامهٔ مرده» می‌رود نه اینکه بی‌صدا گم شود.
 *
 * مرجع‌ها: WITSML 2.0 (کانال/نرخ نمونه)، IADC NPT (دسته‌بندی زمان نامولّد)،
 * ISO 10816 (مناطق ارتعاش)، API RP 7G (محدودهٔ عملیاتی).
 */

export const IIOT_DOMAIN_VERSION = "iiot-v1";

/* ═══════════════════════ ۱. انواع پایه ═══════════════════════ */

export type SignalType =
  | "wob" | "rpm" | "torque" | "mud-pump-pressure" | "flow-rate" | "temperature"
  | "vibration" | "rop" | "depth" | "standpipe-pressure" | "hookload" | "gas";

export const SIGNAL_TYPES: SignalType[] = [
  "wob", "rpm", "torque", "mud-pump-pressure", "flow-rate", "temperature",
  "vibration", "rop", "depth", "standpipe-pressure", "hookload", "gas",
];

/** عنوان دوزبانهٔ کمیت‌ها — داشبورد از همین می‌خواند، نه از رشتهٔ hard-code. */
export const SIGNAL_LABELS: Record<SignalType, { fa: string; en: string; unit: string }> = {
  wob: { fa: "وزن روی مته (WOB)", en: "Weight on Bit", unit: "klbf" },
  rpm: { fa: "دور مته (RPM)", en: "Rotary Speed", unit: "rpm" },
  torque: { fa: "گشتاور رشته حفاری", en: "String Torque", unit: "kft·lbf" },
  "mud-pump-pressure": { fa: "فشار پمپ گل", en: "Mud Pump Pressure", unit: "psi" },
  "flow-rate": { fa: "دبی گل", en: "Flow Rate", unit: "gpm" },
  temperature: { fa: "دما", en: "Temperature", unit: "°C" },
  vibration: { fa: "ارتعاش", en: "Vibration RMS", unit: "mm/s" },
  rop: { fa: "نرخ نفوذ (ROP)", en: "Rate of Penetration", unit: "ft/hr" },
  depth: { fa: "عمق چاه", en: "Hole Depth", unit: "m" },
  "standpipe-pressure": { fa: "فشار لوله قائم (SPP)", en: "Standpipe Pressure", unit: "psi" },
  hookload: { fa: "بار هوک", en: "Hookload", unit: "klbf" },
  gas: { fa: "گاز کل", en: "Total Gas", unit: "%" },
};

export type FilterMethod = "none" | "sma" | "ema" | "median";
export const FILTER_METHODS: FilterMethod[] = ["none", "sma", "ema", "median"];

export type ThresholdLevel = "warning" | "critical";
export type DetectionKind = "threshold" | "rate-of-change" | "stick-slip" | "pump-drop" | "flatline" | "spike";
export const DETECTION_KINDS: DetectionKind[] = ["threshold", "rate-of-change", "stick-slip", "pump-drop", "flatline", "spike"];

export type Comparison = "gt" | "gte" | "lt" | "lte" | "band-out" | "rate";
export type SampleQuality = "good" | "suspect" | "bad" | "stale";
/** رنگ وضعیت برای داشبورد: سبز/زرد/قرمز — پرسنل شیفت با رنگ تصمیم می‌گیرند. */
export type StatusColor = "normal" | "warning" | "critical";

export interface TelemetryPoint {
  /** زمان نمونه‌برداری — ISO 8601 */
  at: string;
  value: number;
  quality?: SampleQuality;
  seqNo?: number;
}

export interface FilterConfig {
  method?: FilterMethod;
  /** پنجرهٔ زمانی فیلتر بر حسب ثانیه — برای SMA/میانه */
  windowSeconds?: number;
  /** ضریب هموارسازی برای EMA (۰ تا ۱) */
  alpha?: number;
  /** حداقل نمونه برای «آماده» بودن فیلتر */
  minSamples?: number;
  /** ناحیهٔ مرده بر حسب درصد — تغییر زیر این حد، تغییر حساب نمی‌شود */
  deadbandPct?: number;
  /** نرخ نمونه‌برداری کانال؛ برای تبدیل ثانیه به تعداد نمونه */
  sampleRateHz?: number;
}

export interface ThresholdRuleInput {
  level: ThresholdLevel;
  detectKind?: DetectionKind;
  comparison?: Comparison;
  thresholdValue?: number | null;
  secondaryValue?: number | null;
  /** پایداری لازم بر حسب ثانیه — دروازهٔ اصلی ضد هشدار کاذب */
  durationSeconds?: number;
  minSamples?: number;
  hysteresisPct?: number | null;
  cooldownSeconds?: number;
  torqueCvThreshold?: number | null;
  rpmSwingPctThreshold?: number | null;
  pressureDropPctThreshold?: number | null;
}

/* ═══════════════════════ ۲. ابزار عددی ═══════════════════════ */

/**
 * تبدیل امن به عدد.
 *
 * `null`/`undefined`/رشتهٔ خالی **باید** `null` بدهند، نه صفر. این نکته در این
 * ماژول حیاتی است: آستانهٔ تنظیم‌نشده (`ThresholdValue = NULL`) اگر صفر خوانده
 * شود، هر مقدار مثبتی از آن می‌گذرد و داشبورد را قرمز می‌کند؛ و نمونهٔ `null`
 * در سری فشار، «افت فشار پمپ» جعلی می‌سازد.
 */
const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** گردکردن پایدار — تا آزمون‌ها روی اعشار شناور نشکنند. */
export function round(value: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** فقط اعداد معتبر؛ `NaN`/`Infinity`/رشتهٔ بی‌معنی دور ریخته می‌شوند. */
export function numbersOf(values: unknown[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    const n = toNum(v);
    if (n !== null) out.push(n);
  }
  return out;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** انحراف معیار نمونه‌ای (n−1)؛ با یک نمونه، تعریف‌نشده است. */
export function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values) as number;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function minOf(values: number[]): number | null {
  return values.length ? Math.min(...values) : null;
}

export function maxOf(values: number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

/** ضریب تغییرات — شاخص اصلی تشخیص Stick-Slip. */
export function coefficientOfVariation(values: number[]): number | null {
  const m = mean(values);
  const sd = stddev(values);
  if (m === null || sd === null || m === 0) return null;
  return (sd / Math.abs(m)) * 100;
}

export function zScore(value: number, values: number[]): number | null {
  const m = mean(values);
  const sd = stddev(values);
  if (m === null || sd === null || sd === 0) return null;
  return (value - m) / sd;
}

export function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

/** مدت بین دو زمان ISO بر حسب ثانیه؛ ورودی نامعتبر → null (نه NaN). */
export function secondsBetween(fromIso: string, toIso: string): number | null {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / 1000;
}

export function minutesBetween(fromIso: string, toIso: string): number | null {
  const s = secondsBetween(fromIso, toIso);
  return s === null ? null : round(s / 60, 3);
}

/** برچسب زمانی سطل: کفِ زمان روی مرز سطل. */
export function bucketStartOf(atIso: string, bucketSeconds: number): string {
  const t = Date.parse(atIso);
  if (Number.isNaN(t) || !(bucketSeconds > 0)) throw new RangeError("bucketStartOf: زمان یا اندازهٔ سطل نامعتبر است");
  const ms = bucketSeconds * 1000;
  return new Date(Math.floor(t / ms) * ms).toISOString();
}

/* ═══════════════════════ ۳. فیلترینگ سیگنال ═══════════════════════ */

/** اندازهٔ پنجره بر حسب تعداد نمونه — ثانیه × نرخ نمونه‌برداری، حداقل ۱. */
export function windowSizeOf(config: FilterConfig, fallbackRateHz = 1): number {
  const rate = config.sampleRateHz && config.sampleRateHz > 0 ? config.sampleRateHz : fallbackRateHz;
  const seconds = config.windowSeconds && config.windowSeconds > 0 ? config.windowSeconds : 1;
  return Math.max(1, Math.round(seconds * rate));
}

/** میانگین متحرک سادهٔ کل پنجره؛ پنجرهٔ خالی → null. */
export function movingAverage(values: number[], windowSize?: number): number | null {
  if (values.length === 0) return null;
  const w = windowSize && windowSize > 0 ? Math.min(windowSize, values.length) : values.length;
  const slice = values.slice(-w);
  return mean(slice);
}

/**
 * سری میانگین متحرک. تا پرشدن پنجره، `null` برمی‌گرداند — این عمداست:
 * عددِ نصفه‌نیمه در ابتدای جریان، خودش منبع هشدار کاذب است.
 */
export function smaSeries(values: number[], windowSize: number): Array<number | null> {
  if (!(windowSize > 0)) throw new RangeError("smaSeries: اندازهٔ پنجره باید بزرگ‌تر از صفر باشد");
  const out: Array<number | null> = [];
  for (let i = 0; i < values.length; i++) {
    out.push(i + 1 < windowSize ? null : mean(values.slice(i + 1 - windowSize, i + 1)));
  }
  return out;
}

/** هموارسازی نمایی؛ آلفای نامعتبر خطا می‌دهد چون خروجی بی‌صدا غلط می‌شود. */
export function emaSeries(values: number[], alpha: number): Array<number | null> {
  if (!(alpha > 0 && alpha <= 1)) throw new RangeError("emaSeries: آلفا باید در بازهٔ (۰,۱] باشد");
  const out: Array<number | null> = [];
  let prev: number | null = null;
  for (const v of values) {
    prev = prev === null ? v : alpha * v + (1 - alpha) * prev;
    out.push(prev);
  }
  return out;
}

/** فیلتر میانه — در برابر تک‌نمونهٔ پرت (اسپایک) مقاوم است. */
export function medianFilter(values: number[], windowSize: number): Array<number | null> {
  if (!(windowSize > 0)) throw new RangeError("medianFilter: اندازهٔ پنجره باید بزرگ‌تر از صفر باشد");
  const out: Array<number | null> = [];
  for (let i = 0; i < values.length; i++) {
    out.push(i + 1 < windowSize ? null : median(values.slice(i + 1 - windowSize, i + 1)));
  }
  return out;
}

/**
 * فیلتر حالت‌دار برای جریان زنده. هر `push` یک نمونه می‌گیرد و مقدار
 * فیلترشدهٔ همان لحظه را می‌دهد؛ پنجره را نگه می‌دارد، پس هزینه‌اش با طول
 * جریان ثابت است (نه O(n) برای هر نمونه).
 */
export class SignalFilter {
  readonly method: FilterMethod;
  readonly windowSize: number;
  readonly alpha: number;
  readonly minSamples: number;
  readonly deadbandPct: number;
  private readonly buffer: number[] = [];
  private emaState: number | null = null;
  private lastReported: number | null = null;
  private count = 0;

  constructor(config: FilterConfig = {}, fallbackRateHz = 1) {
    this.method = FILTER_METHODS.includes(config.method ?? "sma") ? (config.method as FilterMethod) : "sma";
    this.windowSize = this.method === "ema" ? Math.max(2, windowSizeOf(config, fallbackRateHz)) : windowSizeOf(config, fallbackRateHz);
    this.alpha = config.alpha && config.alpha > 0 && config.alpha <= 1 ? config.alpha : 2 / (this.windowSize + 1);
    this.minSamples = config.minSamples && config.minSamples > 0 ? config.minSamples : Math.min(this.windowSize, 3);
    this.deadbandPct = config.deadbandPct && config.deadbandPct > 0 ? config.deadbandPct : 0;
  }

  get samples(): number { return this.count; }
  get isReady(): boolean { return this.count >= this.minSamples; }

  push(value: number): { value: number; filtered: number | null; ready: boolean; changed: boolean } {
    const v = toNum(value);
    if (v === null) return { value: NaN, filtered: null, ready: false, changed: false };
    this.count += 1;
    this.buffer.push(v);
    if (this.buffer.length > this.windowSize) this.buffer.shift();

    let filtered: number | null;
    if (!this.isReady) filtered = null;
    else if (this.method === "none") filtered = v;
    else if (this.method === "ema") {
      this.emaState = this.emaState === null ? v : this.alpha * v + (1 - this.alpha) * this.emaState;
      filtered = this.emaState;
    } else if (this.method === "median") filtered = median(this.buffer);
    else filtered = mean(this.buffer);

    /* ناحیهٔ مرده: تغییر کوچک‌تر از آستانه، «تغییر» حساب نمی‌شود. این همان
     * چیزی است که لرزش رقم آخر سنسور را به رویداد تبدیل نمی‌کند. */
    let changed = true;
    if (filtered !== null && this.lastReported !== null && this.deadbandPct > 0) {
      const delta = pctChange(this.lastReported, filtered);
      changed = delta === null || Math.abs(delta) >= this.deadbandPct;
    }
    if (filtered !== null && (changed || this.lastReported === null)) this.lastReported = filtered;
    return { value: v, filtered, ready: this.isReady, changed };
  }

  /** آخرین مقدار فیلترشده — بدون افزودن نمونه. */
  current(): number | null {
    if (!this.isReady) return null;
    if (this.method === "none") return this.buffer.length ? this.buffer[this.buffer.length - 1] : null;
    if (this.method === "ema") return this.emaState;
    if (this.method === "median") return median(this.buffer);
    return mean(this.buffer);
  }
}

/**
 * اعمال فیلتر روی یک سری کامل — همان مسیری که `POST /telemetry` برای
 * ارزیابی آستانه‌ها طی می‌کند. خروجی هم‌طول ورودی است و تا آماده‌شدن فیلتر
 * `null` دارد.
 */
export function filterSeries(values: number[], config: FilterConfig = {}, fallbackRateHz = 1): Array<number | null> {
  const method = FILTER_METHODS.includes(config.method ?? "sma") ? (config.method as FilterMethod) : "sma";
  const minSamples = config.minSamples && config.minSamples > 0 ? config.minSamples : 0;
  const raw = method === "none"
    ? values.map((v) => v)
    : method === "ema"
      ? emaSeries(values, config.alpha && config.alpha > 0 && config.alpha <= 1 ? config.alpha : 2 / (windowSizeOf(config, fallbackRateHz) + 1))
      : method === "median"
        ? medianFilter(values, windowSizeOf(config, fallbackRateHz))
        : smaSeries(values, windowSizeOf(config, fallbackRateHz));
  if (minSamples <= 0) return raw;
  return raw.map((v, i) => (i + 1 < minSamples ? null : v));
}

/* ═══════════════════════ ۴. کیفیت سیگنال و ناهنجاری‌های شکلی ═══════════════════════ */

export interface SignalQualityReport {
  total: number;
  good: number;
  suspect: number;
  bad: number;
  stale: number;
  qualityPct: number;
  frozen: boolean;
  frozenSeconds: number | null;
  spikeCount: number;
  spikes: Array<{ index: number; value: number; z: number | null }>;
}

/**
 * گزارش کیفیت سری. سه چیز را جدا می‌کند:
 *   • کیفیت اعلامی نمونه‌ها (good/suspect/bad/stale)،
 *   • سیگنال یخ‌زده (flatline) — سنسور مرده معمولاً عدد ثابت می‌فرستد،
 *   • اسپایک — تک‌نمونهٔ پرت که باید فیلتر شود نه اینکه آلارم بسازد.
 */
export function signalQualityReport(
  samples: Array<{ value: number; quality?: SampleQuality; at?: string }>,
  options: { flatlineSeconds?: number; spikeZThreshold?: number; sampleRateHz?: number } = {},
): SignalQualityReport {
  const flatlineSeconds = options.flatlineSeconds && options.flatlineSeconds > 0 ? options.flatlineSeconds : 60;
  const spikeZ = options.spikeZThreshold && options.spikeZThreshold > 0 ? options.spikeZThreshold : 4;
  const rate = options.sampleRateHz && options.sampleRateHz > 0 ? options.sampleRateHz : 1;

  const counts = { good: 0, suspect: 0, bad: 0, stale: 0 };
  const values: number[] = [];
  for (const s of samples) {
    const q: SampleQuality = s.quality && ["good", "suspect", "bad", "stale"].includes(s.quality) ? s.quality : "good";
    counts[q] += 1;
    const v = toNum(s.value);
    if (v !== null) values.push(v);
  }
  const total = samples.length;
  const qualityPct = total === 0 ? 0 : round((counts.good / total) * 100, 2);

  /* یخ‌زدگی: همهٔ مقادیر یکسان در پنجره‌ای که از نظر زمانی هم به‌اندازهٔ کافی بلند است. */
  const needSamples = Math.max(3, Math.round(flatlineSeconds * rate));
  const tail = values.slice(-needSamples);
  const allEqual = tail.length >= needSamples && tail.every((v) => v === tail[0]);
  let frozenSeconds: number | null = null;
  if (allEqual && samples.length >= needSamples) {
    const last = samples.slice(-needSamples);
    const firstAt = last[0]?.at;
    const lastAt = last[last.length - 1]?.at;
    frozenSeconds = firstAt && lastAt ? secondsBetween(firstAt, lastAt) : null;
    if (frozenSeconds === null) frozenSeconds = round((needSamples - 1) / rate, 3);
  }

  const spikes: Array<{ index: number; value: number; z: number | null }> = [];
  if (values.length >= 5) {
    values.forEach((v, index) => {
      const z = zScore(v, values);
      if (z !== null && Math.abs(z) >= spikeZ) spikes.push({ index, value: v, z: round(z, 3) });
    });
  }

  return {
    total, ...counts, qualityPct,
    frozen: allEqual, frozenSeconds: frozenSeconds === null ? null : round(frozenSeconds, 3),
    spikeCount: spikes.length, spikes,
  };
}

/* ═══════════════════════ ۵. آستانه‌های چندسطحی ═══════════════════════ */

function compareHits(comparison: Comparison, value: number, threshold: number, secondary: number | null): boolean {
  switch (comparison) {
    case "gt": return value > threshold;
    case "gte": return value >= threshold;
    case "lt": return value < threshold;
    case "lte": return value <= threshold;
    case "band-out":
      return secondary === null ? false : value < Math.min(threshold, secondary) || value > Math.max(threshold, secondary);
    case "rate": return false;
    default: return false;
  }
}

export interface ThresholdVerdict {
  breach: boolean;
  level: ThresholdLevel;
  detectKind: DetectionKind;
  comparison: Comparison;
  /** تعداد نمونه‌های متوالی نقض در انتهای سری */
  breachSamples: number;
  /** پایداری نقض بر حسب ثانیه */
  breachSeconds: number;
  triggerValue: number | null;
  filteredValue: number | null;
  baselineValue: number | null;
  deviationPct: number | null;
  /** آیا دروازه‌های ضد هشدار کاذب پاس شده‌اند */
  sustained: boolean;
  reasons: string[];
  metrics: Record<string, number | null>;
}

/**
 * ارزیابی یک قاعدهٔ آستانه روی سری فیلترشده.
 *
 * قرارداد مهم: ورودی، **سری فیلترشده** است (نه خام). نمونه‌های `null`
 * (دورهٔ گرم‌شدن فیلتر) در شمارش نقض شرکت نمی‌کنند.
 *
 * «پایداری» از دو راه سنجیده می‌شود و هر دو باید پاس شوند: تعداد نمونهٔ متوالی
 * نقض (`minSamples`) و طول بازهٔ زمانی آن‌ها (`durationSeconds`). بدون این،
 * یک تک‌نمونهٔ نویز روی کانال گشتاور، کل دکل را متوقف می‌کرد.
 */
export function evaluateThreshold(
  series: Array<{ at: string; value: number | null }>,
  rule: ThresholdRuleInput,
  options: { nowIso?: string; staleAfterSeconds?: number } = {},
): ThresholdVerdict {
  const level: ThresholdLevel = rule.level === "critical" ? "critical" : "warning";
  const detectKind: DetectionKind = DETECTION_KINDS.includes(rule.detectKind ?? "threshold") ? (rule.detectKind as DetectionKind) : "threshold";
  const comparison: Comparison = (["gt", "gte", "lt", "lte", "band-out", "rate"] as Comparison[]).includes(rule.comparison ?? "gt")
    ? (rule.comparison as Comparison) : "gt";
  const minSamples = rule.minSamples && rule.minSamples > 0 ? rule.minSamples : 1;
  const durationSeconds = rule.durationSeconds && rule.durationSeconds > 0 ? rule.durationSeconds : 0;
  const threshold = toNum(rule.thresholdValue);
  const secondary = toNum(rule.secondaryValue);

  const base: ThresholdVerdict = {
    breach: false, level, detectKind, comparison, breachSamples: 0, breachSeconds: 0,
    triggerValue: null, filteredValue: null, baselineValue: null, deviationPct: null,
    sustained: false, reasons: [], metrics: {},
  };

  const clean = series.filter((p) => p.value !== null && Number.isFinite(p.value as number));
  if (clean.length === 0) {
    base.reasons.push("E-IIOT-NO-DATA");
    return base;
  }

  /* دادهٔ کهنه آلارم نمی‌سازد. اگر آخرین نمونه از افق تازگی قدیمی‌تر باشد،
   * نتیجه «دادهٔ کهنه» است نه «نقض آستانه» — وگرنه آخرین عددِ یک سنسور مرده
   * تا ابد هشدار تولید می‌کرد. */
  if (options.nowIso && options.staleAfterSeconds && options.staleAfterSeconds > 0) {
    const age = secondsBetween(clean[clean.length - 1].at, options.nowIso);
    if (age !== null && age > options.staleAfterSeconds) {
      base.reasons.push("E-IIOT-STALE-DATA");
      base.metrics = { dataAgeSeconds: round(age, 3) };
      return base;
    }
  }

  if (detectKind === "rate-of-change" || comparison === "rate") {
    /* نرخ تغییر بر واحد زمان — برای افت/خیز سریع که خودِ مقدار در محدوده است. */
    if (clean.length < 2) { base.reasons.push("E-IIOT-NEED-2-SAMPLES"); return base; }
    const first = clean[0];
    const last = clean[clean.length - 1];
    const span = secondsBetween(first.at, last.at);
    if (span === null || span <= 0) { base.reasons.push("E-IIOT-ZERO-SPAN"); return base; }
    const ratePerSec = ((last.value as number) - (first.value as number)) / span;
    const limit = threshold ?? 0;
    const exceeded = Math.abs(ratePerSec) > Math.abs(limit);
    base.metrics = { ratePerSecond: round(ratePerSec, 6), limit, spanSeconds: round(span, 3) };
    base.triggerValue = round(ratePerSec, 6);
    base.filteredValue = last.value;
    base.baselineValue = first.value;
    base.deviationPct = pctChange(first.value as number, last.value as number) === null ? null : round(pctChange(first.value as number, last.value as number) as number, 3);
    base.breachSamples = exceeded ? clean.length : 0;
    base.breachSeconds = exceeded ? round(span, 3) : 0;
    base.breach = exceeded;
    base.sustained = exceeded && clean.length >= minSamples && base.breachSeconds >= durationSeconds;
    if (exceeded && !base.sustained) base.reasons.push("E-IIOT-NOT-SUSTAINED");
    return base;
  }

  if (threshold === null) { base.reasons.push("E-IIOT-NO-THRESHOLD"); return base; }

  /* شمارش نقض متوالی از انتهای سری به عقب. */
  let breachSamples = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    if (compareHits(comparison, clean[i].value as number, threshold, secondary)) breachSamples += 1;
    else break;
  }
  const breachPoints = clean.slice(clean.length - breachSamples);
  let breachSeconds = 0;
  if (breachPoints.length >= 2) {
    const s = secondsBetween(breachPoints[0].at, breachPoints[breachPoints.length - 1].at);
    breachSeconds = s === null ? 0 : Math.max(0, s);
  }

  const lastPoint = clean[clean.length - 1];
  /* خط مبنا = میانگین نیمهٔ نخست سری؛ مبنای «چقدر منحرف شده‌ایم». */
  const baselineValues = clean.slice(0, Math.max(1, Math.floor(clean.length / 2))).map((p) => p.value as number);
  const baseline = mean(baselineValues);

  base.breachSamples = breachSamples;
  base.breachSeconds = round(breachSeconds, 3);
  base.breach = breachSamples > 0;
  base.triggerValue = lastPoint.value as number;
  base.filteredValue = lastPoint.value as number;
  base.baselineValue = baseline === null ? null : round(baseline, 4);
  base.deviationPct = baseline === null ? null : (round(pctChange(baseline, lastPoint.value as number) ?? 0, 3));
  base.sustained = breachSamples >= minSamples && breachSeconds >= durationSeconds;
  if (breachSamples > 0 && breachSamples < minSamples) base.reasons.push("E-IIOT-BELOW-MIN-SAMPLES");
  if (breachSamples >= minSamples && breachSeconds < durationSeconds) base.reasons.push("E-IIOT-NOT-SUSTAINED");
  return base;
}

/**
 * بازگشت به وضعیت عادی با هیسترزیس.
 * بدون هیسترزیس، سیگنالی که دور آستانه نوسان می‌کند هر ثانیه یک هشدار
 * تازه/بسته می‌سازد — همان «هشدار کاذب» که این ماژول برای حذفش ساخته شده.
 */
export function recoveredBelowHysteresis(
  value: number,
  rule: ThresholdRuleInput,
): boolean {
  const threshold = toNum(rule.thresholdValue);
  if (threshold === null) return true;
  const comparison: Comparison = (["gt", "gte", "lt", "lte", "band-out", "rate"] as Comparison[]).includes(rule.comparison ?? "gt")
    ? (rule.comparison as Comparison) : "gt";
  const hysteresisPct = rule.hysteresisPct && rule.hysteresisPct > 0 ? rule.hysteresisPct : 0;
  const band = Math.abs(threshold) * (hysteresisPct / 100);
  if (comparison === "lt" || comparison === "lte") return value >= threshold + band;
  return value <= threshold - band;
}

/**
 * آیا پس از آخرین هشدار، دورهٔ سکوت گذشته است؟ اگر نه، هشدار تازه ساخته
 * نمی‌شود (جلوگیری از طوفان هشدار روی یک ناهنجاری ادامه‌دار).
 */
export function inCooldown(lastAlertAtIso: string | null | undefined, nowIso: string, cooldownSeconds: number): boolean {
  if (!lastAlertAtIso) return false;
  if (!(cooldownSeconds > 0)) return false;
  const gap = secondsBetween(lastAlertAtIso, nowIso);
  return gap !== null && gap < cooldownSeconds;
}

/**
 * رنگ وضعیت یک کانال برای داشبورد. آستانهٔ critical بر warning غالب است.
 * ورودی، مقادیر فیلترشده است تا رنگ صفحه با نویز لحظه‌ای نپرد.
 */
export function statusColorFor(
  filteredValue: number | null,
  thresholds: Array<{ level: ThresholdLevel; comparison: Comparison; thresholdValue: number | null; secondaryValue?: number | null }>,
): StatusColor {
  if (filteredValue === null || !Number.isFinite(filteredValue)) return "normal";
  const order: ThresholdLevel[] = ["critical", "warning"];
  for (const level of order) {
    for (const t of thresholds.filter((x) => x.level === level)) {
      const threshold = toNum(t.thresholdValue);
      if (threshold === null) continue;
      const comparison = t.comparison ?? "gt";
      const hit = comparison === "band-out"
        ? (toNum(t.secondaryValue) !== null && (filteredValue < Math.min(threshold, toNum(t.secondaryValue) as number) || filteredValue > Math.max(threshold, toNum(t.secondaryValue) as number)))
        : compareHits(comparison, filteredValue, threshold, null);
      if (hit) return level;
    }
  }
  return "normal";
}

/* ═══════════════════════ ۶. تشخیص پدیده: Stick-Slip و افت فشار ═══════════════════════ */

export interface StickSlipConfig {
  /** آستانهٔ ضریب تغییرات گشتاور (٪) */
  torqueCvThreshold?: number;
  /** آستانهٔ نوسان دورانی (٪) */
  rpmSwingPctThreshold?: number;
  minSamples?: number;
  sampleRateHz?: number;
  windowSeconds?: number;
}

export interface StickSlipResult {
  detected: boolean;
  severity: "none" | "mild" | "moderate" | "severe";
  torqueMean: number | null;
  torqueStdDev: number | null;
  torqueCv: number | null;
  rpmMean: number | null;
  rpmMin: number | null;
  rpmMax: number | null;
  rpmSwingPct: number | null;
  sampleCount: number;
  windowSeconds: number;
  reasons: string[];
}

/**
 * تشخیص Stick-Slip (چسبیدن-لغزیدن مته).
 *
 * امضای این پدیده دو بخشی است و **هر دو** لازم‌اند:
 *   ۱) گشتاور رشته نوسان شدید دارد (ضریب تغییرات بالا) — انرژی ذخیره‌شده،
 *   ۲) دور چرخش نامنظم می‌شود (اختلاف بیشینه/کمینهٔ RPM نسبت به میانگین).
 *
 * اگر فقط یکی باشد، پدیده چیز دیگری است: گشتاور بالا با RPM ثابت یعنی
 * تشکیل خاک (pack-off)، و RPM متغیر با گشتاور آرام یعنی تغییر دور توسط
 * اپراتور. همین تفکیک، منبع اصلی کاهش هشدار کاذب در حفاری است.
 */
export function detectStickSlip(
  input: { torque: number[]; rpm: number[]; sampleRateHz?: number; windowSeconds?: number },
  config: StickSlipConfig = {},
): StickSlipResult {
  const torque = numbersOf(input.torque);
  const rpm = numbersOf(input.rpm);
  const rate = input.sampleRateHz && input.sampleRateHz > 0 ? input.sampleRateHz : 1;
  /* پنجره از ورودی خوانده می‌شود (مسیر API آن را همین‌جا می‌فرستد) و در
   * صورت نبودش از پیکربندی. اگر هیچ‌کدام نباشد، کل تاریخچه بررسی می‌شود. */
  const windowRequest = input.windowSeconds ?? config.windowSeconds;
  const windowSeconds = windowRequest && windowRequest > 0 ? windowRequest : 0;
  const minSamples = config.minSamples && config.minSamples > 0 ? config.minSamples : 10;

  const out: StickSlipResult = {
    detected: false, severity: "none",
    torqueMean: null, torqueStdDev: null, torqueCv: null,
    rpmMean: null, rpmMin: null, rpmMax: null, rpmSwingPct: null,
    sampleCount: 0, windowSeconds: 0, reasons: [],
  };

  /* پنجرهٔ تحلیل: اگر `windowSeconds` داده شده باشد، فقط همان مقدار اخیر
   * بررسی می‌شود — Stick-Slip یک پدیدهٔ لحظه‌ای است و میانگین‌گیری روی کل
   * تاریخچهٔ شیفت، امضایش را محو می‌کند. */
  const maxSamples = windowSeconds > 0 ? Math.max(minSamples, Math.round(windowSeconds * rate)) : Number.POSITIVE_INFINITY;
  const n = Math.min(torque.length, rpm.length, maxSamples);
  out.sampleCount = n;
  out.windowSeconds = n > 1 ? round((n - 1) / rate, 3) : 0;
  if (n < minSamples) { out.reasons.push("E-IIOT-BELOW-MIN-SAMPLES"); return out; }

  const t = torque.slice(-n);
  const r = rpm.slice(-n);
  const torqueMean = mean(t);
  const torqueStdDev = stddev(t);
  const torqueCv = coefficientOfVariation(t);
  const rpmMean = mean(r);
  const rpmMin = minOf(r);
  const rpmMax = maxOf(r);
  const rpmSwingPct = rpmMean === null || rpmMean === 0 || rpmMin === null || rpmMax === null
    ? null
    : ((rpmMax - rpmMin) / Math.abs(rpmMean)) * 100;

  out.torqueMean = torqueMean === null ? null : round(torqueMean, 4);
  out.torqueStdDev = torqueStdDev === null ? null : round(torqueStdDev, 4);
  out.torqueCv = torqueCv === null ? null : round(torqueCv, 4);
  out.rpmMean = rpmMean === null ? null : round(rpmMean, 4);
  out.rpmMin = rpmMin;
  out.rpmMax = rpmMax;
  out.rpmSwingPct = rpmSwingPct === null ? null : round(rpmSwingPct, 4);

  const cvLimit = config.torqueCvThreshold && config.torqueCvThreshold > 0 ? config.torqueCvThreshold : 10;
  const swingLimit = config.rpmSwingPctThreshold && config.rpmSwingPctThreshold > 0 ? config.rpmSwingPctThreshold : 15;

  const torqueOscillating = torqueCv !== null && torqueCv >= cvLimit;
  const rpmIrregular = rpmSwingPct !== null && rpmSwingPct >= swingLimit;

  if (!torqueOscillating) out.reasons.push("E-IIOT-TORQUE-CV-LOW");
  if (!rpmIrregular) out.reasons.push("E-IIOT-RPM-SWING-LOW");
  out.detected = torqueOscillating && rpmIrregular;

  if (out.detected && torqueCv !== null) {
    const ratio = torqueCv / cvLimit;
    out.severity = ratio >= 3 ? "severe" : ratio >= 2 ? "moderate" : "mild";
  }
  return out;
}

export interface PumpDropConfig {
  /** آستانهٔ افت درصدی نسبت به خط مبنا */
  dropPctThreshold?: number;
  minSamples?: number;
  /** چند درصد آخرین مقادیر سری «مبنای پیش از افت» باشند */
  baselineRatio?: number;
  /** آستانهٔ مطلق فشار (اختیاری) — زیر این عدد، افت بدون نسبت هم بحرانی است */
  absoluteFloor?: number | null;
}

export interface PumpDropResult {
  detected: boolean;
  baseline: number | null;
  current: number | null;
  dropPct: number | null;
  absoluteFloorBreached: boolean;
  sampleCount: number;
  reasons: string[];
}

/**
 * افت فشار پمپ گل. نشانهٔ کلاسیک آن «شکست ناگهانی نسبت به خط مبنای پایدار»
 * است، نه یک عدد ثابت؛ پمپ‌ها در شروع و پایان گردش، فشار پایینِ مشروع دارند.
 * پس خط مبنا از بخش پایدار ابتدای سری ساخته می‌شود و افت نسبت به آن سنجیده
 * می‌شود.
 */
export function detectPumpPressureDrop(pressure: number[], config: PumpDropConfig = {}): PumpDropResult {
  const values = numbersOf(pressure);
  const minSamples = config.minSamples && config.minSamples > 0 ? config.minSamples : 10;
  const dropLimit = config.dropPctThreshold && config.dropPctThreshold > 0 ? config.dropPctThreshold : 15;
  const baselineRatio = config.baselineRatio && config.baselineRatio > 0 && config.baselineRatio < 1 ? config.baselineRatio : 0.5;
  const floor = toNum(config.absoluteFloor ?? null);

  const out: PumpDropResult = { detected: false, baseline: null, current: null, dropPct: null, absoluteFloorBreached: false, sampleCount: values.length, reasons: [] };
  if (values.length < minSamples) { out.reasons.push("E-IIOT-BELOW-MIN-SAMPLES"); return out; }

  const baselineCount = Math.max(1, Math.floor(values.length * baselineRatio));
  const baseline = mean(values.slice(0, baselineCount));
  const current = mean(values.slice(-Math.max(1, Math.floor(values.length * 0.2))));
  out.baseline = baseline === null ? null : round(baseline, 4);
  out.current = current === null ? null : round(current, 4);
  out.dropPct = baseline === null || current === null ? null : round(-(pctChange(baseline, current) ?? 0), 4);
  out.absoluteFloorBreached = floor !== null && current !== null && current < floor;

  const dropDetected = out.dropPct !== null && out.dropPct >= dropLimit;
  if (!dropDetected && !out.absoluteFloorBreached) out.reasons.push("E-IIOT-NO-DROP");
  out.detected = dropDetected || out.absoluteFloorBreached;
  return out;
}

/**
 * ارزیابی یک سری چندکاناله با یک قاعده — مسیری که API واقعاً طی می‌کند.
 * قاعده‌های `stick-slip` و `pump-drop` به کانال همسایه نیاز دارند، پس
 * سری‌ها در یک نقشهٔ `signalType → سری` داده می‌شوند.
 */
export function evaluateDetectRule(
  rule: ThresholdRuleInput,
  seriesBySignal: Partial<Record<SignalType, Array<{ at: string; value: number | null }>>>,
  primarySignal: SignalType,
  options: { sampleRateHz?: number; windowSeconds?: number; pumpFloor?: number | null } = {},
): { verdict: ThresholdVerdict; stickSlip?: StickSlipResult; pumpDrop?: PumpDropResult } {
  const kind: DetectionKind = DETECTION_KINDS.includes(rule.detectKind ?? "threshold") ? (rule.detectKind as DetectionKind) : "threshold";

  if (kind === "stick-slip") {
    const torque = (seriesBySignal.torque ?? []).map((p) => p.value).filter((v): v is number => v !== null);
    const rpm = (seriesBySignal.rpm ?? []).map((p) => p.value).filter((v): v is number => v !== null);
    const result = detectStickSlip(
      { torque, rpm, sampleRateHz: options.sampleRateHz, windowSeconds: options.windowSeconds },
      { torqueCvThreshold: toNum(rule.torqueCvThreshold ?? undefined) ?? undefined, rpmSwingPctThreshold: toNum(rule.rpmSwingPctThreshold ?? undefined) ?? undefined, minSamples: rule.minSamples },
    );
    const verdict: ThresholdVerdict = {
      breach: result.detected, level: rule.level === "critical" ? "critical" : "warning",
      detectKind: "stick-slip", comparison: "gt",
      breachSamples: result.detected ? result.sampleCount : 0,
      breachSeconds: result.detected ? result.windowSeconds : 0,
      triggerValue: result.torqueCv, filteredValue: result.rpmSwingPct,
      baselineValue: result.torqueMean,
      deviationPct: result.torqueCv === null ? null : round(result.torqueCv, 3),
      sustained: result.detected, reasons: result.reasons,
      metrics: {
        torqueCv: result.torqueCv, torqueMean: result.torqueMean, torqueStdDev: result.torqueStdDev,
        rpmSwingPct: result.rpmSwingPct, rpmMean: result.rpmMean, rpmMin: result.rpmMin, rpmMax: result.rpmMax,
        sampleCount: result.sampleCount,
      },
    };
    return { verdict, stickSlip: result };
  }

  if (kind === "pump-drop") {
    const pressure = (seriesBySignal["mud-pump-pressure"] ?? seriesBySignal[primarySignal] ?? []).map((p) => p.value).filter((v): v is number => v !== null);
    const result = detectPumpPressureDrop(pressure, {
      dropPctThreshold: toNum(rule.pressureDropPctThreshold ?? undefined) ?? undefined,
      minSamples: rule.minSamples,
      absoluteFloor: options.pumpFloor ?? toNum(rule.thresholdValue ?? null),
    });
    const verdict: ThresholdVerdict = {
      breach: result.detected, level: rule.level === "critical" ? "critical" : "warning",
      detectKind: "pump-drop", comparison: "lt",
      breachSamples: result.detected ? result.sampleCount : 0,
      breachSeconds: 0,
      triggerValue: result.current, filteredValue: result.current, baselineValue: result.baseline,
      deviationPct: result.dropPct === null ? null : round(-result.dropPct, 3),
      sustained: result.detected, reasons: result.reasons,
      metrics: { dropPct: result.dropPct, baseline: result.baseline, current: result.current, sampleCount: result.sampleCount },
    };
    return { verdict, pumpDrop: result };
  }

  const series = seriesBySignal[primarySignal] ?? [];
  if (kind === "flatline") {
    const points = series.filter((p) => p.value !== null);
    const values = points.map((p) => p.value as number);
    const rate = options.sampleRateHz && options.sampleRateHz > 0 ? options.sampleRateHz : 1;
    const need = Math.max(3, Math.round((options.windowSeconds && options.windowSeconds > 0 ? options.windowSeconds : 60) * rate));
    const tail = values.slice(-need);
    const frozen = tail.length >= need && tail.every((v) => v === tail[0]);
    const verdict: ThresholdVerdict = {
      breach: frozen, level: rule.level === "critical" ? "critical" : "warning",
      detectKind: "flatline", comparison: "gt",
      breachSamples: frozen ? tail.length : 0,
      breachSeconds: frozen && points.length >= 2 ? round(Math.max(0, secondsBetween(points[points.length - tail.length].at, points[points.length - 1].at) ?? 0), 3) : 0,
      triggerValue: frozen ? tail[0] : null, filteredValue: frozen ? tail[0] : null,
      baselineValue: null, deviationPct: null,
      sustained: frozen && tail.length >= (rule.minSamples ?? 1),
      reasons: frozen ? [] : ["E-IIOT-NOT-FROZEN"],
      metrics: { windowSamples: tail.length, requiredSamples: need },
    };
    return { verdict };
  }

  if (kind === "spike") {
    const points = series.filter((p) => p.value !== null);
    const values = points.map((p) => p.value as number);
    const limit = toNum(rule.thresholdValue) ?? 4;
    const last = values.length ? values[values.length - 1] : null;
    const z = last === null ? null : zScore(last, values);
    const hit = z !== null && Math.abs(z) >= limit;
    const verdict: ThresholdVerdict = {
      breach: hit, level: rule.level === "critical" ? "critical" : "warning",
      detectKind: "spike", comparison: "gt",
      breachSamples: hit ? 1 : 0, breachSeconds: 0,
      triggerValue: last, filteredValue: last, baselineValue: round(mean(values) ?? 0, 4),
      deviationPct: z === null ? null : round(Math.abs(z) * 100, 3),
      /* اسپایک ماهیتاً تک‌نمونه است؛ پایداری برایش معنا ندارد. این تنها
       * DetectionKind است که دروازهٔ duration روی آن اعمال نمی‌شود. */
      sustained: hit,
      reasons: hit ? [] : ["E-IIOT-NO-SPIKE"],
      metrics: { zScore: z === null ? null : round(z, 4), zLimit: limit },
    };
    return { verdict };
  }

  return { verdict: evaluateThreshold(series, rule) };
}

/* ═══════════════════════ ۷. تجمیع و کوچک‌سازی نمودار ═══════════════════════ */

export interface RollupBucket {
  bucketStart: string;
  bucketSeconds: number;
  sampleCount: number;
  badCount: number;
  minValue: number | null;
  maxValue: number | null;
  avgValue: number | null;
  stdDev: number | null;
  firstValue: number | null;
  lastValue: number | null;
  qualityPct: number;
}

/** تجمیع نمونه‌ها در سطل‌های زمانی ثابت — مبنای نمودار و گزارش NPT. */
export function rollupSamples(
  samples: Array<{ at: string; value: number; quality?: SampleQuality }>,
  bucketSeconds: number,
): RollupBucket[] {
  if (!(bucketSeconds > 0)) throw new RangeError("rollupSamples: اندازهٔ سطل باید بزرگ‌تر از صفر باشد");
  const byBucket = new Map<string, Array<{ value: number; quality: SampleQuality }>>();
  for (const s of samples) {
    const v = toNum(s.value);
    if (v === null) continue;
    const key = bucketStartOf(s.at, bucketSeconds);
    if (!byBucket.has(key)) byBucket.set(key, []);
    (byBucket.get(key) as Array<{ value: number; quality: SampleQuality }>).push({
      value: v,
      quality: s.quality && ["good", "suspect", "bad", "stale"].includes(s.quality) ? s.quality : "good",
    });
  }
  const out: RollupBucket[] = [];
  for (const [bucketStart, rows] of [...byBucket.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const values = rows.map((r) => r.value);
    const bad = rows.filter((r) => r.quality === "bad" || r.quality === "stale").length;
    out.push({
      bucketStart, bucketSeconds,
      sampleCount: rows.length, badCount: bad,
      minValue: round(minOf(values) as number, 6),
      maxValue: round(maxOf(values) as number, 6),
      avgValue: round(mean(values) as number, 6),
      stdDev: stddev(values) === null ? null : round(stddev(values) as number, 6),
      firstValue: round(values[0], 6),
      lastValue: round(values[values.length - 1], 6),
      qualityPct: rows.length === 0 ? 0 : round(((rows.length - bad) / rows.length) * 100, 2),
    });
  }
  return out;
}

/**
 * کوچک‌سازی برای نمودار: هر نقطهٔ خروجی یک جفت min/max از یک پیمانه است،
 * پس شکل سیگنال (اسپایک‌ها) در کوچک‌سازی گم نمی‌شود — چیزی که
 * نمونه‌برداری ساده از دست می‌دهد.
 */
export function downsampleForChart(
  samples: Array<{ at: string; value: number }>,
  maxPoints = 120,
): Array<{ at: string; min: number; max: number; avg: number; count: number }> {
  const points = samples.filter((s) => Number.isFinite(s.value));
  if (!(maxPoints > 0)) throw new RangeError("downsampleForChart: maxPoints باید بزرگ‌تر از صفر باشد");
  if (points.length <= maxPoints) {
    return points.map((p) => ({ at: p.at, min: p.value, max: p.value, avg: p.value, count: 1 }));
  }
  const stride = Math.ceil(points.length / maxPoints);
  const out: Array<{ at: string; min: number; max: number; avg: number; count: number }> = [];
  for (let i = 0; i < points.length; i += stride) {
    const chunk = points.slice(i, i + stride);
    const values = chunk.map((c) => c.value);
    out.push({
      at: chunk[0].at,
      min: round(minOf(values) as number, 6),
      max: round(maxOf(values) as number, 6),
      avg: round(mean(values) as number, 6),
      count: chunk.length,
    });
  }
  return out;
}

/* ═══════════════════════ ۸. Store-and-Forward (بافر لبه) ═══════════════════════ */

export type BufferStatus = "buffered" | "sending" | "sent" | "failed" | "dead-letter";
export const BUFFER_STATUSES: BufferStatus[] = ["buffered", "sending", "sent", "failed", "dead-letter"];

/**
 * چک‌سام FNV-1a روی JSON کانونی‌شده.
 * عمداً رمزنگاری نیست — کارش تشخیص «این دسته همان دسته است» در همگام‌سازی
 * دوباره است، نه اثبات اصالت (آن کار امضای گیت‌وی است).
 */
export function checksumOf(value: unknown): string {
  const text = canonicalJson(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a-${h.toString(16).padStart(8, "0")}`;
}

/** JSON با کلیدهای مرتب — تا ترتیب فیلدها چک‌سام را عوض نکند. */
export function canonicalJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const src = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(src).sort()) out[key] = walk(src[key]);
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

export interface StoreForwardSample {
  channelCode: string;
  at: string;
  value: number;
  quality?: SampleQuality;
  seqNo?: number;
}

export interface StoreForwardBatch {
  batchNo: string;
  gatewayCode: string;
  rigId: string;
  capturedAt: string;
  fromAt: string;
  toAt: string;
  sampleCount: number;
  checksum: string;
  payload: { rigId: string; gatewayCode: string; samples: StoreForwardSample[] };
}

/**
 * ساخت دستهٔ بافر. نمونه‌ها بر پایهٔ زمان مرتب می‌شوند و `batchNo` از
 * شناسهٔ گیت‌وی + زمان گرفتن ساخته می‌شود تا deterministic باشد — یعنی
 * دو بار بافرکردنِ همان داده، همان دسته را می‌دهد و همگام‌سازی دوباره
 * رکورد تکراری نمی‌سازد.
 */
export function buildStoreForwardBatch(input: {
  rigId: string;
  gatewayCode: string;
  capturedAt: string;
  samples: StoreForwardSample[];
}): StoreForwardBatch {
  const samples = [...input.samples].sort((a, b) => a.at.localeCompare(b.at) || a.channelCode.localeCompare(b.channelCode));
  const times = samples.map((s) => s.at).filter((t) => !Number.isNaN(Date.parse(t))).sort();
  const payload = { rigId: input.rigId, gatewayCode: input.gatewayCode, samples };
  const capturedAt = !Number.isNaN(Date.parse(input.capturedAt)) ? new Date(Date.parse(input.capturedAt)).toISOString() : new Date(0).toISOString();
  return {
    batchNo: `BUF-${input.gatewayCode}-${capturedAt.replace(/[:.]/g, "-")}`,
    gatewayCode: input.gatewayCode,
    rigId: input.rigId,
    capturedAt,
    fromAt: times[0] ?? capturedAt,
    toAt: times[times.length - 1] ?? capturedAt,
    sampleCount: samples.length,
    checksum: checksumOf(payload),
    payload,
  };
}

/** راستی‌آزمایی دسته پیش از پذیرش — چک‌سام و ساختار با هم. */
export function verifyBatch(batch: { checksum?: string; payload?: unknown; sampleCount?: number }): { ok: boolean; code: string | null } {
  if (!batch || typeof batch !== "object") return { ok: false, code: "E-IIOT-BATCH-MALFORMED" };
  if (typeof batch.payload !== "object" || batch.payload === null) return { ok: false, code: "E-IIOT-BATCH-NO-PAYLOAD" };
  const payload = batch.payload as { samples?: unknown };
  if (!Array.isArray(payload.samples)) return { ok: false, code: "E-IIOT-BATCH-NO-SAMPLES" };
  if (typeof batch.sampleCount === "number" && batch.sampleCount !== payload.samples.length) return { ok: false, code: "E-IIOT-BATCH-COUNT-MISMATCH" };
  if (typeof batch.checksum === "string" && batch.checksum && batch.checksum !== checksumOf(batch.payload)) {
    return { ok: false, code: "E-IIOT-BATCH-CHECKSUM" };
  }
  return { ok: true, code: null };
}

/**
 * گذار وضعیت بافر.
 * قاعدهٔ کلیدی: پس از `maxAttempts` تلاش ناموفق، دسته به `dead-letter` می‌رود
 * — نه حذف، نه «موفق». دادهٔ دکل هیچ‌وقت بی‌صدا دور ریخته نمی‌شود.
 */
export function nextBufferStatus(input: {
  status: BufferStatus;
  attempts: number;
  maxAttempts: number;
  delivered: boolean;
}): { status: BufferStatus; attempts: number; code: string | null } {
  const attempts = Math.max(0, input.attempts | 0);
  const maxAttempts = input.maxAttempts > 0 ? input.maxAttempts : 5;
  if (input.status === "sent" || input.status === "dead-letter") {
    return { status: input.status, attempts, code: input.status === "sent" ? "E-IIOT-ALREADY-SENT" : "E-IIOT-DEAD-LETTER" };
  }
  if (input.delivered) return { status: "sent", attempts: attempts + 1, code: null };
  const next = attempts + 1;
  if (next >= maxAttempts) return { status: "dead-letter", attempts: next, code: "E-IIOT-MAX-ATTEMPTS" };
  return { status: next >= maxAttempts ? "dead-letter" : "failed", attempts: next, code: "E-IIOT-DELIVERY-FAILED" };
}

/**
 * انتخاب دسته‌های آمادهٔ همگام‌سازی: FIFO بر پایهٔ زمان گرفتن، و فقط
 * آن‌هایی که در وضعیت قابل ارسال‌اند. وقتی لینک قطع است، خروجی خالی است —
 * یعنی «صبر کن»، نه «خطا».
 */
export function selectBufferedForSync<T extends { status: string; capturedAt: string }>(
  buffer: T[],
  options: { connectivityOnline: boolean; limit?: number } = { connectivityOnline: true },
): T[] {
  if (!options.connectivityOnline) return [];
  const limit = options.limit && options.limit > 0 ? options.limit : Infinity;
  return buffer
    .filter((b) => b.status === "buffered" || b.status === "failed")
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .slice(0, limit);
}

/** درصد پرشدن بافر — برای هشدار «بافر لبه در آستانهٔ سرریز». */
export function bufferFillPct(used: number, capacity: number): number {
  if (!(capacity > 0)) return 0;
  return round(Math.min(100, (Math.max(0, used) / capacity) * 100), 2);
}

/* ═══════════════════════ ۹. توقف دکل و NPT ═══════════════════════ */

export type DowntimeCategory =
  | "equipment" | "mud" | "directional" | "wellbore" | "weather"
  | "power" | "logistics" | "cementing" | "waiting-on-decision" | "other";

export const DOWNTIME_CATEGORIES: DowntimeCategory[] = [
  "equipment", "mud", "directional", "wellbore", "weather",
  "power", "logistics", "cementing", "waiting-on-decision", "other",
];

export type DowntimeType = "productive" | "non-productive" | "planned";

/** نگاشت دستهٔ توقف به کد IADC NPT و مسئولیت پیش‌فرض. */
export const NPT_CATEGORY_MAP: Record<DowntimeCategory, { nptCode: string; fa: string; responsibilityFa: string; isNpt: boolean }> = {
  equipment: { nptCode: "NPT-1.1", fa: "خرابی تجهیزات مکانیکی/برقی", responsibilityFa: "پیمانکار", isNpt: true },
  mud: { nptCode: "NPT-2.3", fa: "مشکل سیستم گل و سیال حفاری", responsibilityFa: "پیمانکار", isNpt: true },
  directional: { nptCode: "NPT-3.2", fa: "اصلاح مسیر و مشکل جهت‌دهی", responsibilityFa: "پیمانکار", isNpt: true },
  wellbore: { nptCode: "NPT-4.1", fa: "مشکل چاه (گیرکردن/هرزروی/فوران)", responsibilityFa: "کارفرما", isNpt: true },
  weather: { nptCode: "NPT-5.1", fa: "شرایط جوی و فورس‌ماژور", responsibilityFa: "فورس‌ماژور", isNpt: true },
  power: { nptCode: "NPT-1.4", fa: "قطعی برق و مولد", responsibilityFa: "پیمانکار", isNpt: true },
  logistics: { nptCode: "NPT-6.2", fa: "تأخیر لجستیک و تأمین", responsibilityFa: "کارفرما", isNpt: true },
  cementing: { nptCode: "NPT-7.1", fa: "عملیات سیمان‌کاری", responsibilityFa: "پیمانکار", isNpt: false },
  "waiting-on-decision": { nptCode: "NPT-8.1", fa: "انتظار برای تصمیم کارفرما", responsibilityFa: "کارفرما", isNpt: true },
  other: { nptCode: "NPT-9.9", fa: "سایر علل", responsibilityFa: "مشخص‌نشده", isNpt: true },
};

export interface DowntimeClassification {
  category: DowntimeCategory;
  nptCode: string;
  isNpt: boolean;
  downtimeType: DowntimeType;
  responsibilityFa: string;
  causeFa: string;
}

/** دسته‌بندی توقف: کد NPT، نوع و مسئولیت پیش‌فرض را یکجا برمی‌گرداند. */
export function classifyDowntime(category: string, overrides: { isNpt?: boolean; downtimeType?: DowntimeType; nptCode?: string } = {}): DowntimeClassification {
  const key: DowntimeCategory = DOWNTIME_CATEGORIES.includes(category as DowntimeCategory) ? (category as DowntimeCategory) : "other";
  const map = NPT_CATEGORY_MAP[key];
  const isNpt = overrides.isNpt === undefined ? map.isNpt : overrides.isNpt;
  const downtimeType: DowntimeType = overrides.downtimeType ?? (isNpt ? "non-productive" : key === "cementing" ? "planned" : "productive");
  /* قید اسکیما: IsNpt=1 فقط با DowntimeType='non-productive' سازگار است. */
  return {
    category: key,
    nptCode: overrides.nptCode ?? map.nptCode,
    isNpt: isNpt && downtimeType === "non-productive",
    downtimeType,
    responsibilityFa: map.responsibilityFa,
    causeFa: map.fa,
  };
}

export interface DowntimeRow {
  startedAt: string;
  endedAt?: string | null;
  durationMinutes?: number | null;
  isNpt?: boolean;
  category?: string;
  responsibilityFa?: string;
}

/** مدت توقف بر حسب دقیقه؛ اگر بسته نشده باشد، با `nowIso` باز محاسبه می‌شود. */
export function downtimeMinutesOf(row: DowntimeRow, nowIso: string): number | null {
  if (row.endedAt) {
    const m = minutesBetween(row.startedAt, row.endedAt);
    return m === null ? null : Math.max(0, m);
  }
  const m = minutesBetween(row.startedAt, nowIso);
  return m === null ? null : Math.max(0, m);
}

export interface NptSummary {
  totalMinutes: number;
  productiveMinutes: number;
  nptMinutes: number;
  plannedMinutes: number;
  nptPct: number;
  byCategory: Array<{ category: string; nptCode: string; minutes: number; count: number; responsibilityFa: string }>;
  openCount: number;
  modelVersion: string;
}

/** جمع‌بندی NPT — همان عددی که به گزارش پیشرفت پمیس و لایهٔ ادعا می‌رود. */
export function nptSummary(rows: DowntimeRow[], nowIso: string): NptSummary {
  const byCategory = new Map<string, { category: string; nptCode: string; minutes: number; count: number; responsibilityFa: string }>();
  let total = 0;
  let npt = 0;
  let planned = 0;
  let productive = 0;
  let openCount = 0;

  for (const row of rows) {
    const minutes = downtimeMinutesOf(row, nowIso) ?? 0;
    total += minutes;
    if (!row.endedAt) openCount += 1;
    const info = NPT_CATEGORY_MAP[(row.category ?? "other") as DowntimeCategory] ?? NPT_CATEGORY_MAP.other;
    if (row.isNpt) npt += minutes;
    else if (info.nptCode.startsWith("NPT-7")) planned += minutes;
    else productive += minutes;

    const key = row.category ?? "other";
    const bucket = byCategory.get(key) ?? { category: key, nptCode: info.nptCode, minutes: 0, count: 0, responsibilityFa: info.responsibilityFa };
    bucket.minutes = round(bucket.minutes + minutes, 3);
    bucket.count += 1;
    byCategory.set(key, bucket);
  }

  return {
    totalMinutes: round(total, 3),
    productiveMinutes: round(productive, 3),
    nptMinutes: round(npt, 3),
    plannedMinutes: round(planned, 3),
    nptPct: total > 0 ? round((npt / total) * 100, 2) : 0,
    byCategory: [...byCategory.values()].sort((a, b) => b.minutes - a.minutes),
    openCount,
    modelVersion: IIOT_DOMAIN_VERSION,
  };
}

/**
 * آیا این توقف به‌اندازهٔ کافی بزرگ است که ادعا (Claim) بسازد؟
 * آستانه از پیکربندی می‌آید، نه hard-code: شرط قراردادی هر پروژه فرق دارد.
 */
export function claimWorthy(input: { minutes: number; responsibilityFa?: string; thresholdMinutes: number }): boolean {
  if (!(input.thresholdMinutes > 0)) return false;
  if (input.minutes < input.thresholdMinutes) return false;
  /* توقفی که مسئولیتش با پیمانکار است، مبنای ادعای پیمانکار به کارفرما نیست. */
  return input.responsibilityFa !== "پیمانکار";
}

/* ═══════════════════════ ۱۰. تصمیم ارسال بین‌بخشی ═══════════════════════ */

export type DispatchTarget = "cmms" | "mes" | "pmis";
export const DISPATCH_TARGETS: DispatchTarget[] = ["cmms", "mes", "pmis"];

/** تجزیهٔ فهرست مقصدها؛ مقصد ناشناخته دور ریخته می‌شود (نه خطا). */
export function parseDispatchTargets(raw: string | null | undefined): DispatchTarget[] {
  if (!raw) return [];
  const out = new Set<DispatchTarget>();
  for (const part of String(raw).split(",")) {
    const key = part.trim().toLowerCase();
    if (DISPATCH_TARGETS.includes(key as DispatchTarget)) out.add(key as DispatchTarget);
  }
  return [...out];
}

export interface DispatchDecision {
  dispatch: boolean;
  targets: DispatchTarget[];
  reasons: string[];
}

/**
 * تصمیم ارسال. سه شرط:
 *   ۱) قاعده `AutoDispatch` داشته باشد،
 *   ۲) سطح هشدار `critical` باشد (هشدار warning فقط اطلاع‌رسانی است، نه
 *      دستورکار خودکار — وگرنه صف نت با کارهای بی‌مورد پر می‌شود)،
 *   ۳) مقصد مشخص و پیکربندی‌شده باشد.
 */
export function shouldDispatch(input: {
  level: ThresholdLevel;
  autoDispatch: boolean;
  targets: string | null | undefined;
  allowWarning?: boolean;
}): DispatchDecision {
  const reasons: string[] = [];
  const targets = parseDispatchTargets(input.targets);
  if (!input.autoDispatch) reasons.push("E-IIOT-AUTO-DISPATCH-OFF");
  if (!targets.length) reasons.push("E-IIOT-NO-TARGET");
  if (input.level !== "critical" && !input.allowWarning) reasons.push("E-IIOT-NOT-CRITICAL");
  return { dispatch: input.autoDispatch && targets.length > 0 && (input.level === "critical" || input.allowWarning === true), targets, reasons };
}

/**
 * کلید ضدتکرار رویداد. از **داده** ساخته می‌شود نه از زمان، پس تولید دوبارهٔ
 * همان رویداد، کلید تازه نمی‌سازد و سامانهٔ مقصد رکورد دوباره ثبت نمی‌کند.
 */
export function idempotencyKeyOf(eventType: string, target: DispatchTarget, sourceTable: string, sourceId: string, discriminator?: string): string {
  const parts = [eventType, target, sourceTable, sourceId, discriminator ?? ""].map((p) => String(p ?? "").trim());
  return `iiot:${parts.join(":")}`.slice(0, 160);
}

/** قرارداد هر مقصد — همان چیزی که پل یکپارچگی در سرور پیاده می‌کند. */
export const IIOT_INTEGRATION_CONTRACTS: Record<DispatchTarget, string> = {
  cmms: "iiot-cmms-v1",
  mes: "iiot-mes-v1",
  pmis: "iiot-pmis-v1",
};

/** نوع رویداد هر مقصد. */
export function eventTypeFor(target: DispatchTarget, kind: "alert" | "alert-resolved" | "downtime" | "downtime-closed" | "condition"): string {
  if (kind === "alert") return "alert.critical";
  if (kind === "alert-resolved") return "alert.resolved";
  if (kind === "downtime") return "downtime.npt";
  if (kind === "downtime-closed") return "downtime.closed";
  return target === "cmms" ? "condition.reading" : "condition.reading";
}

/* ═══════════════════════ ۱۱. عنوان‌های قابل‌خواندن ═══════════════════════ */

/** عنوان فارسی هشدار — از داده ساخته می‌شود تا UI رشته نسازد. */
export function alertTitleFa(input: {
  detectKind: DetectionKind;
  signal: SignalType;
  channelNameFa?: string;
  value?: number | null;
  unit?: string;
  threshold?: number | null;
  level: ThresholdLevel;
}): string {
  const label = SIGNAL_LABELS[input.signal]?.fa ?? input.signal;
  const name = input.channelNameFa || label;
  const levelFa = input.level === "critical" ? "بحرانی" : "هشدار";
  const value = input.value === null || input.value === undefined ? null : round(input.value, 2);
  switch (input.detectKind) {
    case "stick-slip": return `${levelFa}: تشخیص پدیدهٔ Stick-Slip روی ${name}`;
    case "pump-drop": return `${levelFa}: افت فشار پمپ گل روی ${name}${value !== null ? ` (اکنون ${value})` : ""}`;
    case "flatline": return `${levelFa}: سیگنال یخ‌زده روی ${name} — احتمال خرابی سنسور`;
    case "spike": return `${levelFa}: جهش ناگهانی روی ${name}${value !== null ? ` (${value})` : ""}`;
    case "rate-of-change": return `${levelFa}: نرخ تغییر غیرمجاز روی ${name}`;
    default:
      /* نام کانال، نه برچسب کمیت: دکلی با سه سنسور دما، با «دما از آستانه
       * گذشت» به اپراتور نمی‌گوید کدام سنسور — همان چیزی که تصمیم را عقب
       * می‌اندازد. */
      return `${levelFa}: ${name} از آستانه گذشت${value !== null ? ` (${value}${input.unit ? ` ${input.unit}` : ""})` : ""}${input.threshold !== null && input.threshold !== undefined ? ` — آستانه ${round(input.threshold, 2)}` : ""}`;
  }
}

/** پیام تشریحی هشدار با شاخص‌های تشخیص — همان چیزی که تکنسین باید ببیند. */
export function alertMessageFa(input: {
  detectKind: DetectionKind;
  metrics: Record<string, number | null>;
  sampleCount: number;
  durationSeconds: number;
  filteredValue?: number | null;
  triggerValue?: number | null;
}): string {
  const parts: string[] = [];
  parts.push(`نمونه‌های بررسی‌شده: ${input.sampleCount}`);
  if (input.durationSeconds > 0) parts.push(`پایداری: ${round(input.durationSeconds, 1)} ثانیه`);
  if (input.triggerValue !== null && input.triggerValue !== undefined) parts.push(`مقدار محرک: ${round(input.triggerValue, 3)}`);
  if (input.filteredValue !== null && input.filteredValue !== undefined) parts.push(`مقدار فیلترشده: ${round(input.filteredValue, 3)}`);
  const m = input.metrics ?? {};
  if (m.torqueCv !== null && m.torqueCv !== undefined) parts.push(`CV گشتاور: ${m.torqueCv}%`);
  if (m.rpmSwingPct !== null && m.rpmSwingPct !== undefined) parts.push(`نوسان RPM: ${m.rpmSwingPct}%`);
  if (m.dropPct !== null && m.dropPct !== undefined) parts.push(`افت فشار: ${m.dropPct}%`);
  if (m.zScore !== null && m.zScore !== undefined) parts.push(`امتیاز Z: ${m.zScore}`);
  return parts.join(" · ");
}
