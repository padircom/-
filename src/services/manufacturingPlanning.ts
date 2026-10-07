/**
 * موتور برنامه‌ریزی پیشرفتهٔ تولید — فاز ۵ (APICS / ISA-95).
 *
 * چهار مفهوم استاندارد در این فایل پیاده شده‌اند:
 *  1. برنامهٔ اصلی تولید (MPS) با زمان‌بندی دوره‌ای (Time-Phased) و دو حصار زمانی
 *     «حصار تقاضا» (DTF) و «حصار برنامهٔ قطعی» (FPTF).
 *  2. قواعد اندازه‌گذاری لات: L4L، FOQ، EOQ و POQ با قیدهای حداقل/حداکثر و مضرب سفارش.
 *  3. بررسی قابلیت تعهد تحویل (ATP) در دو حالت گسسته (Discrete) و تجمعی (Cumulative).
 *  4. تقسیم لات و هم‌پوشانی عملیات (Splitting & Overlapping).
 *
 * این فایل عمداً pure logic است: هیچ I/O، تاریخ «امروز» پنهان یا وابستگی به HTTP/SQL
 * ندارد تا همان منطق هم در کلاینت و هم (از طریق bundle) در سرور اجرا شود.
 */

export const MANUFACTURING_PLANNING_MODEL_VERSION = "mfg-planning-v1" as const;

/** سقف دوره‌های یک افق برنامه‌ریزی؛ بیشتر از این عملاً جدول زمانی بی‌معنا می‌شود. */
export const MAX_PLANNING_BUCKETS = 260;
export const MAX_SPLIT_LOTS = 50;

const DAY_MS = 86_400_000;
const EPSILON = 1e-9;

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function finite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positive(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class ManufacturingPlanningError extends Error {
  code: string;
  details: Record<string, unknown>;
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ManufacturingPlanningError";
    this.code = code;
    this.details = details;
  }
}

/* ════════════════════════ ۱. سطل زمانی (Time Bucket) ════════════════════════ */

export type TimeBucketUnit = "day" | "week" | "month";

export interface TimeBucket {
  /** شمارهٔ سطل از صفر. */
  index: number;
  /** روز شروع سطل به شکل `YYYY-MM-DD`. */
  start: string;
  /** روز پایان سطل (اختصاصی) به شکل `YYYY-MM-DD`. */
  end: string;
  /** طول سطل بر حسب روز؛ برای سطل ماه از تقویم واقعی می‌آید. */
  days: number;
}

function dateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

function formatDate(parts: { year: number; month: number; day: number }): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addDays(value: string, amount: number): string {
  const parts = dateParts(value);
  if (!parts) throw new ManufacturingPlanningError("MFG_PLAN_DATE_INVALID", `تاریخ نامعتبر: ${value}`, { value });
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return shifted.toISOString().slice(0, 10);
}

function addMonths(value: string, amount: number): string {
  const parts = dateParts(value);
  if (!parts) throw new ManufacturingPlanningError("MFG_PLAN_DATE_INVALID", `تاریخ نامعتبر: ${value}`, { value });
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1 + amount, 1));
  return formatDate({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: 1 });
}

function daysBetween(from: string, to: string): number {
  const left = dateParts(from);
  const right = dateParts(to);
  if (!left || !right) throw new ManufacturingPlanningError("MFG_PLAN_DATE_INVALID", "بازهٔ تاریخ نامعتبر است", { from, to });
  return Math.round((Date.UTC(right.year, right.month - 1, right.day) - Date.UTC(left.year, left.month - 1, left.day)) / DAY_MS);
}

/** روز اول هفتهٔ ISO (دوشنبه) برای سطل‌بندی هفتگی. */
export function isoWeekStart(value: string): string {
  const parts = dateParts(value);
  if (!parts) throw new ManufacturingPlanningError("MFG_PLAN_DATE_INVALID", `تاریخ نامعتبر: ${value}`, { value });
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return addDays(value, 1 - weekday);
}

export function monthStart(value: string): string {
  const parts = dateParts(value);
  if (!parts) throw new ManufacturingPlanningError("MFG_PLAN_DATE_INVALID", `تاریخ نامعتبر: ${value}`, { value });
  return formatDate({ year: parts.year, month: parts.month, day: 1 });
}

/**
 * ساخت افق سطل‌بندی‌شده.
 * سطل هفته از دوشنبهٔ هفتهٔ `horizonStart` و سطل ماه از اول ماه شروع می‌شود تا
 * مرز سطل‌ها همیشه روی تقویم واقعی بنشیند.
 */
export function buildTimeBuckets(input: {
  horizonStart: string;
  bucketUnit: TimeBucketUnit;
  bucketCount: number;
}): TimeBucket[] {
  const unit = input.bucketUnit;
  if (!["day", "week", "month"].includes(unit)) {
    throw new ManufacturingPlanningError("MFG_PLAN_BUCKET_UNIT_INVALID", "واحد سطل باید day/week/month باشد", { bucketUnit: unit });
  }
  const count = Math.trunc(finite(input.bucketCount, 0));
  if (count < 1 || count > MAX_PLANNING_BUCKETS) {
    throw new ManufacturingPlanningError(
      "MFG_PLAN_BUCKET_COUNT_INVALID",
      `تعداد سطل باید بین ۱ و ${MAX_PLANNING_BUCKETS} باشد`,
      { bucketCount: input.bucketCount },
    );
  }
  const anchor = unit === "week" ? isoWeekStart(input.horizonStart) : unit === "month" ? monthStart(input.horizonStart) : input.horizonStart;
  if (!dateParts(anchor)) {
    throw new ManufacturingPlanningError("MFG_PLAN_DATE_INVALID", "horizonStart باید تاریخ YYYY-MM-DD معتبر باشد", { horizonStart: input.horizonStart });
  }

  const buckets: TimeBucket[] = [];
  let cursor = anchor;
  for (let index = 0; index < count; index++) {
    const next = unit === "month" ? addMonths(cursor, 1) : addDays(cursor, unit === "week" ? 7 : 1);
    buckets.push({ index, start: cursor, end: next, days: daysBetween(cursor, next) });
    cursor = next;
  }
  return buckets;
}

/** شمارهٔ سطلی که یک تاریخ در آن می‌افتد؛ تاریخ بیرون افق `null` می‌گیرد. */
export function bucketIndexOf(buckets: TimeBucket[], value: string): number | null {
  const day = typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : null;
  if (!day || !dateParts(day)) return null;
  for (const bucket of buckets) {
    if (day >= bucket.start && day < bucket.end) return bucket.index;
  }
  return null;
}

/* ════════════════════════ ۲. اندازه‌گذاری لات (Lot Sizing) ════════════════════════ */

export type LotSizingRule = "L4L" | "FOQ" | "EOQ" | "POQ";

export const LOT_SIZING_RULES: readonly LotSizingRule[] = ["L4L", "FOQ", "EOQ", "POQ"] as const;

export interface LotSizingPolicyInput {
  rule: LotSizingRule;
  /** مقدار ثابت لات برای قاعدهٔ FOQ. */
  fixedLotQty?: number | null;
  /** مضرب سفارش؛ مقدار پیشنهادی همیشه به این مضرب گرد می‌شود. */
  orderMultiple?: number | null;
  minOrderQty?: number | null;
  maxOrderQty?: number | null;
  /** هزینهٔ هر سفارش (S) برای EOQ. */
  orderingCost?: number | null;
  /** هزینهٔ نگهداری هر واحد در سال (H) برای EOQ. */
  holdingCostPerUnitPerYear?: number | null;
  /** تقاضای سالانه (D) برای EOQ/POQ. */
  annualDemandQty?: number | null;
  /** طول دوره بر حسب روز؛ مبنای تبدیل EOQ به تعداد دوره برای POQ. */
  periodDays?: number | null;
  /** تعداد دوره‌های پوشش برای POQ؛ اگر داده شود جای مقدار محاسبه‌شده را می‌گیرد. */
  periodOrderQuantity?: number | null;
}

export interface EconomicOrderQuantityResult {
  /** EOQ خام بدون گرد کردن به مضرب. */
  rawEoq: number | null;
  /** EOQ گردشده به مضرب سفارش؛ بدون دادهٔ کافی `null` است. */
  eoq: number | null;
  ordersPerYear: number | null;
  annualOrderingCost: number | null;
  annualHoldingCost: number | null;
  /** جمع هزینهٔ سفارش‌دهی و نگهداری (Total Annual Cost). */
  totalAnnualCost: number | null;
  /** تعداد دوره‌های پوشش معادل EOQ؛ مبنای POQ. */
  periodsCovered: number | null;
  /** دلیل‌های خوانا برای اینکه چرا EOQ قابل محاسبه نیست یا چرا مقدار تعدیل شد. */
  notes: string[];
}

/**
 * محاسبهٔ مقدار اقتصادی سفارش: `EOQ = √(2·D·S / H)`.
 * نبود هر یک از سه ورودی، نتیجه را `null` می‌کند و دلیل آن در `notes` می‌آید؛
 * موتور هرگز با دادهٔ ناقص عدد ساختگی برنمی‌گرداند.
 */
export function computeEconomicOrderQuantity(policy: LotSizingPolicyInput): EconomicOrderQuantityResult {
  const notes: string[] = [];
  const demand = finite(policy.annualDemandQty, 0);
  const orderingCost = finite(policy.orderingCost, 0);
  const holdingCost = finite(policy.holdingCostPerUnitPerYear, 0);
  if (demand <= 0) notes.push("تقاضای سالانه (AnnualDemandQty) برای EOQ الزامی و مثبت است");
  if (orderingCost <= 0) notes.push("هزینهٔ هر سفارش (OrderingCost) برای EOQ الزامی و مثبت است");
  if (holdingCost <= 0) notes.push("هزینهٔ نگهداری هر واحد در سال (HoldingCostPerUnitPerYear) برای EOQ الزامی و مثبت است");
  if (notes.length > 0) {
    return { rawEoq: null, eoq: null, ordersPerYear: null, annualOrderingCost: null, annualHoldingCost: null, totalAnnualCost: null, periodsCovered: null, notes };
  }

  const rawEoq = Math.sqrt((2 * demand * orderingCost) / holdingCost);
  const multiple = positive(policy.orderMultiple, 1);
  const eoq = Math.max(multiple, round3(Math.ceil((rawEoq - EPSILON) / multiple) * multiple));
  const ordersPerYear = round3(demand / eoq);
  const annualOrderingCost = round3(ordersPerYear * orderingCost);
  const annualHoldingCost = round3((eoq / 2) * holdingCost);

  const periodDays = finite(policy.periodDays, 0);
  let periodsCovered: number | null = null;
  if (periodDays > 0) {
    const demandPerPeriod = (demand * periodDays) / 365;
    periodsCovered = demandPerPeriod > 0 ? Math.max(1, Math.round(eoq / demandPerPeriod)) : null;
    if (periodsCovered === null) notes.push("تقاضای هر دوره صفر است؛ POQ از مقدار صریح PeriodOrderQuantity استفاده می‌کند");
  } else {
    notes.push("PeriodDays تعیین نشده؛ تعداد دورهٔ POQ از PeriodOrderQuantity خوانده می‌شود");
  }

  return {
    rawEoq: round3(rawEoq),
    eoq,
    ordersPerYear,
    annualOrderingCost,
    annualHoldingCost,
    totalAnnualCost: round3(annualOrderingCost + annualHoldingCost),
    periodsCovered,
    notes,
  };
}

/** تعداد دوره‌های پوشش POQ؛ اولویت با مقدار صریح سیاست است. */
export function resolvePeriodOrderQuantity(policy: LotSizingPolicyInput): number {
  const explicit = Math.trunc(finite(policy.periodOrderQuantity, 0));
  if (explicit >= 1) return Math.min(explicit, MAX_PLANNING_BUCKETS);
  const computed = computeEconomicOrderQuantity(policy).periodsCovered;
  return computed !== null && computed >= 1 ? Math.min(computed, MAX_PLANNING_BUCKETS) : 1;
}

export interface SizedLot {
  /** مقدار سفارش نهایی پس از اعمال قاعده و قیدها. */
  quantity: number;
  /** مقدار خالص موردنیاز پیش از اندازه‌گذاری. */
  netRequirement: number;
  rule: LotSizingRule;
  /** قیدهایی که واقعاً مقدار را تغییر دادند؛ برای شفافیت در UI و گزارش. */
  appliedConstraints: string[];
}

/**
 * اعمال قیدهای لات (حداقل، حداکثر، مضرب سفارش) روی مقدار خام.
 * حداکثر لات هرگز باعث گرد‌کردن رو‌به‌بالا نمی‌شود؛ اگر خودِ نیاز از سقف بیشتر
 * باشد همان نیاز بازگردانده می‌شود تا برنامهٔ تولید عمداً کمتر از تقاضا نشود.
 */
export function applyLotConstraints(rawQty: number, policy: LotSizingPolicyInput): { quantity: number; appliedConstraints: string[] } {
  const applied: string[] = [];
  const multiple = positive(policy.orderMultiple, 1);
  const minQty = finite(policy.minOrderQty, 0);
  const maxQty = finite(policy.maxOrderQty, 0);
  let quantity = rawQty;

  if (multiple !== 1) {
    const rounded = round3(Math.ceil((quantity - EPSILON) / multiple) * multiple);
    if (Math.abs(rounded - quantity) > EPSILON) {
      applied.push(`OrderMultiple=${multiple}`);
      quantity = rounded;
    }
  }
  if (minQty > 0 && quantity < minQty - EPSILON) {
    const raised = round3(Math.ceil((minQty - EPSILON) / multiple) * multiple);
    applied.push(`MinOrderQty=${minQty}`);
    quantity = raised;
  }
  if (maxQty > 0 && quantity > maxQty + EPSILON) {
    const lowered = round3(Math.floor((maxQty + EPSILON) / multiple) * multiple);
    applied.push(`MaxOrderQty=${maxQty}`);
    quantity = lowered > 0 ? lowered : round3(maxQty);
  }
  return { quantity: round3(quantity), appliedConstraints: applied };
}

/**
 * اندازه‌گذاری یک نیاز خالص برای سطل جاری.
 * قاعدهٔ POQ در این تابع «نیاز تجمعی» می‌گیرد؛ تجمیع چند سطل در
 * `computeMasterSchedule` انجام می‌شود چون به تصویر موجودی نیاز دارد.
 */
export function sizeLot(aggregateRequirement: number, policy: LotSizingPolicyInput): SizedLot {
  const netRequirement = round3(Math.max(0, finite(aggregateRequirement, 0)));
  if (netRequirement <= 0) {
    return { quantity: 0, netRequirement: 0, rule: policy.rule, appliedConstraints: [] };
  }
  let raw = netRequirement;
  switch (policy.rule) {
    case "L4L":
      raw = netRequirement;
      break;
    case "FOQ": {
      const fixed = finite(policy.fixedLotQty, 0);
      if (fixed <= 0) {
        throw new ManufacturingPlanningError("MFG_LOT_POLICY_INVALID", "قاعدهٔ FOQ به FixedLotQty مثبت نیاز دارد", { rule: policy.rule });
      }
      raw = Math.max(netRequirement, fixed);
      break;
    }
    case "EOQ": {
      const eoq = computeEconomicOrderQuantity(policy).eoq;
      if (eoq === null) {
        throw new ManufacturingPlanningError("MFG_LOT_POLICY_INVALID", "قاعدهٔ EOQ به AnnualDemandQty، OrderingCost و HoldingCostPerUnitPerYear مثبت نیاز دارد", { rule: policy.rule });
      }
      raw = Math.max(netRequirement, eoq);
      break;
    }
    case "POQ":
      /* مقدار ورودی همین‌جا تجمیع چند سطل است؛ قاعدهٔ POQ آن را تغییر نمی‌دهد. */
      raw = netRequirement;
      break;
    default:
      throw new ManufacturingPlanningError("MFG_LOT_RULE_UNKNOWN", `قاعدهٔ اندازه‌گذاری ناشناخته: ${String(policy.rule)}`, { rule: policy.rule });
  }
  const constrained = applyLotConstraints(raw, policy);
  const appliedConstraints = [...constrained.appliedConstraints];
  if (Math.abs(raw - netRequirement) > EPSILON) appliedConstraints.unshift(`rule=${policy.rule}`);
  return { quantity: constrained.quantity, netRequirement, rule: policy.rule, appliedConstraints };
}

/** اعتبارسنجی سیاست لات برای ثبت در مستر دیتا. */
export function validateLotSizingPolicy(policy: LotSizingPolicyInput): string[] {
  const issues: string[] = [];
  if (!LOT_SIZING_RULES.includes(policy.rule)) issues.push(`قاعدهٔ ${String(policy.rule)} پشتیبانی نمی‌شود`);
  /* `positive` و نه `finite`: مضرب سفارشِ تعیین‌نشده (null) یعنی ۱، نه صفر. */
  const multiple = positive(policy.orderMultiple, 1);
  if (multiple < 1) issues.push("OrderMultiple باید بزرگ‌تر یا مساوی ۱ باشد");
  const minQty = finite(policy.minOrderQty, 0);
  const maxQty = finite(policy.maxOrderQty, 0);
  if (minQty < 0) issues.push("MinOrderQty نمی‌تواند منفی باشد");
  if (maxQty > 0 && minQty > maxQty) issues.push("MinOrderQty از MaxOrderQty بزرگ‌تر است");
  if (policy.rule === "FOQ" && finite(policy.fixedLotQty, 0) <= 0) issues.push("قاعدهٔ FOQ به FixedLotQty مثبت نیاز دارد");
  if (policy.rule === "EOQ") {
    const eoq = computeEconomicOrderQuantity(policy);
    if (eoq.eoq === null) issues.push(...eoq.notes);
  }
  if (policy.rule === "POQ" && resolvePeriodOrderQuantity(policy) < 1) issues.push("POQ به PeriodOrderQuantity یا PeriodDays همراه با تقاضای سالانه نیاز دارد");
  return issues;
}

/* ════════════════════════ ۳. برنامهٔ اصلی تولید (MPS) ════════════════════════ */

export type DemandLineType = "sales-order" | "forecast" | "contract" | "manual";

export const DEMAND_LINE_TYPES: readonly DemandLineType[] = ["sales-order", "forecast", "contract", "manual"] as const;

export interface MasterScheduleDemandLine {
  /** تاریخ موردنیاز `YYYY-MM-DD`. */
  requiredAt: string;
  quantity: number;
  type: DemandLineType;
  /** مرجع تقاضا (شمارهٔ سفارش فروش/پیش‌بینی) برای Pegging. */
  demandRef?: string | null;
  customerRef?: string | null;
}

export interface ScheduledReceiptLine {
  /** تاریخ رسید برنامه‌ریزی‌شده `YYYY-MM-DD`. */
  plannedAt: string;
  quantity: number;
  /** مرجع سفارش باز تولید/خرید. */
  sourceRef?: string | null;
}

export interface MasterScheduleInput {
  partId: string;
  partNo?: string | null;
  uom?: string | null;
  buckets: TimeBucket[];
  demand: MasterScheduleDemandLine[];
  scheduledReceipts?: ScheduledReceiptLine[];
  policy: LotSizingPolicyInput;
  onHandQty: number;
  reservedQty?: number;
  blockedQty?: number;
  safetyStockQty?: number;
  leadTimeDays?: number;
  /** حصار تقاضا (DTF) بر حسب تعداد سطل؛ درون آن سفارش برنامه‌ریزی‌شدهٔ تازه ساخته نمی‌شود. */
  demandTimeFenceBuckets?: number;
  /** حصار برنامهٔ قطعی (FPTF) بر حسب تعداد سطل؛ درون آن ردیف‌ها قطعی (Firm) ثبت می‌شوند. */
  firmPlannedTimeFenceBuckets?: number;
  /** مصرف پیش‌بینی با سفارش واقعی فروش در همان سطل (رفتار استاندارد APICS). */
  consumeForecastWithSalesOrders?: boolean;
}

export interface MasterScheduleLine {
  partId: string;
  bucketIndex: number;
  bucketStart: string;
  bucketEnd: string;
  forecastQty: number;
  salesOrderQty: number;
  contractQty: number;
  manualQty: number;
  /** تقاضای مصرف‌نشدهٔ پیش‌بینی پس از کسر سفارش فروش. */
  consumedForecastQty: number;
  grossRequirementQty: number;
  scheduledReceiptQty: number;
  projectedOnHandBefore: number;
  netRequirementQty: number;
  plannedOrderReceiptQty: number;
  plannedOrderReleaseQty: number;
  /** تاریخ آزادسازی سفارش = رسید منهای LeadTime. */
  plannedOrderReleaseAt: string | null;
  projectedOnHandAfter: number;
  insideDemandTimeFence: boolean;
  isFirm: boolean;
  lotSizingRule: LotSizingRule;
  appliedConstraints: string[];
  /** مرجع‌های تقاضای همین سطل برای Pegging. */
  demandRefs: string[];
}

export interface MasterScheduleResult {
  modelVersion: string;
  partId: string;
  uom: string | null;
  bucketUnit: TimeBucketUnit;
  bucketCount: number;
  openingAvailableQty: number;
  safetyStockQty: number;
  leadTimeDays: number;
  leadTimeBuckets: number;
  demandTimeFenceBuckets: number;
  firmPlannedTimeFenceBuckets: number;
  lotSizingRule: LotSizingRule;
  eoq: number | null;
  periodOrderQuantity: number | null;
  lines: MasterScheduleLine[];
  totals: {
    grossRequirementQty: number;
    scheduledReceiptQty: number;
    netRequirementQty: number;
    plannedOrderReceiptQty: number;
    /** اولین سطلی که موجودی تصویرشده زیر ذخیرهٔ احتیاطی می‌رود. */
    firstShortageBucketStart: string | null;
    shortageQty: number;
  };
}

function bucketUnitOf(buckets: TimeBucket[]): TimeBucketUnit {
  const days = buckets[0]?.days ?? 1;
  if (days >= 28) return "month";
  if (days >= 7) return "week";
  return "day";
}

/**
 * ساخت جدول زمان‌مند MPS.
 *
 * برای هر سطل:
 *   موجودی پیش‌بینی‌شدهٔ قبل = موجودی سطل قبل + رسیدهای برنامه‌ریزی‌شده
 *   نیاز خالص = بیشینه(۰, نیاز ناخالص + ذخیرهٔ احتیاطی − موجودی قبل)
 *   رسید سفارش برنامه‌ریزی‌شده = اندازه‌گذاری لات روی نیاز خالص (با تجمیع POQ)
 *   موجودی پس‌از = موجودی قبل + رسید برنامه‌ریزی‌شده − نیاز ناخالص
 * آزادسازی سفارش به اندازهٔ LeadTime (بر حسب سطل) عقب‌تر از رسید ثبت می‌شود.
 */
export function computeMasterSchedule(input: MasterScheduleInput): MasterScheduleResult {
  const buckets = input.buckets;
  if (!Array.isArray(buckets) || buckets.length === 0) {
    throw new ManufacturingPlanningError("MFG_PLAN_BUCKET_EMPTY", "حداقل یک سطل زمانی برای MPS لازم است");
  }
  const bucketUnit = bucketUnitOf(buckets);
  const issues = validateLotSizingPolicy(input.policy);
  if (issues.length > 0) {
    throw new ManufacturingPlanningError("MFG_LOT_POLICY_INVALID", `سیاست اندازه‌گذاری لات نامعتبر است: ${issues.join("؛ ")}`, { issues });
  }

  const safetyStockQty = round3(Math.max(0, finite(input.safetyStockQty, 0)));
  const onHandQty = round3(finite(input.onHandQty, 0));
  const reservedQty = round3(Math.max(0, finite(input.reservedQty, 0)));
  const blockedQty = round3(Math.max(0, finite(input.blockedQty, 0)));
  const openingAvailableQty = round3(Math.max(0, onHandQty - reservedQty - blockedQty));
  const leadTimeDays = Math.max(0, Math.trunc(finite(input.leadTimeDays, 0)));
  const dtf = Math.max(0, Math.min(buckets.length, Math.trunc(finite(input.demandTimeFenceBuckets, 0))));
  const fptf = Math.max(dtf, Math.min(buckets.length, Math.trunc(finite(input.firmPlannedTimeFenceBuckets, 0))));
  const consumeForecast = input.consumeForecastWithSalesOrders !== false;
  const leadTimeBuckets = Math.min(buckets.length, Math.max(0, Math.round(leadTimeDays / Math.max(1, buckets[0].days))));

  const demandByBucket = buckets.map(() => ({
    "sales-order": 0,
    forecast: 0,
    contract: 0,
    manual: 0,
    refs: [] as string[],
  }));
  let demandOutsideHorizon = 0;
  for (const line of input.demand ?? []) {
    const quantity = round3(finite(line.quantity, 0));
    if (quantity <= 0) continue;
    const index = bucketIndexOf(buckets, line.requiredAt);
    if (index === null) {
      demandOutsideHorizon = round3(demandOutsideHorizon + quantity);
      continue;
    }
    const type = DEMAND_LINE_TYPES.includes(line.type) ? line.type : "manual";
    demandByBucket[index][type] = round3(demandByBucket[index][type] + quantity);
    if (line.demandRef) demandByBucket[index].refs.push(String(line.demandRef));
  }

  const receiptsByBucket = buckets.map(() => ({ qty: 0, refs: [] as string[] }));
  for (const line of input.scheduledReceipts ?? []) {
    const quantity = round3(finite(line.quantity, 0));
    if (quantity <= 0) continue;
    const index = bucketIndexOf(buckets, line.plannedAt);
    if (index === null) continue;
    receiptsByBucket[index].qty = round3(receiptsByBucket[index].qty + quantity);
    if (line.sourceRef) receiptsByBucket[index].refs.push(String(line.sourceRef));
  }

  const grossByBucket = demandByBucket.map((row) => {
    const consumedForecast = consumeForecast ? round3(Math.min(row.forecast, row["sales-order"])) : 0;
    const forecastLeft = round3(row.forecast - consumedForecast);
    return {
      forecastQty: row.forecast,
      salesOrderQty: row["sales-order"],
      contractQty: row.contract,
      manualQty: row.manual,
      consumedForecastQty: consumedForecast,
      gross: round3(forecastLeft + row["sales-order"] + row.contract + row.manual),
      refs: row.refs,
    };
  });

  const poqPeriods = input.policy.rule === "POQ" ? resolvePeriodOrderQuantity(input.policy) : 1;
  const eoq = computeEconomicOrderQuantity(input.policy).eoq;

  const lines: MasterScheduleLine[] = [];
  const plannedReceipts: number[] = buckets.map(() => 0);
  let projectedBefore = openingAvailableQty;
  let firstShortageBucketStart: string | null = null;
  let shortageQty = 0;

  for (let index = 0; index < buckets.length; index++) {
    const bucket = buckets[index];
    const gross = grossByBucket[index];
    const scheduledReceiptQty = receiptsByBucket[index].qty;
    const beforeQty = round3(projectedBefore + scheduledReceiptQty);

    const netRequirementQty = round3(Math.max(0, gross.gross + safetyStockQty - beforeQty));
    const insideDemandTimeFence = index < dtf;

    let plannedOrderReceiptQty = 0;
    let appliedConstraints: string[] = [];
    if (netRequirementQty > 0 && !insideDemandTimeFence) {
      let aggregate = netRequirementQty;
      if (input.policy.rule === "POQ") {
        /* POQ نیاز سطل‌های پوشش بعدی را هم در همین سفارش جمع می‌کند؛ رسیدهای
         * برنامه‌ریزی‌شدهٔ آن سطل‌ها از تجمیع کسر می‌شوند تا دوباره‌شماری نشود. */
        const horizon = Math.min(buckets.length, index + poqPeriods);
        for (let next = index + 1; next < horizon; next++) {
          aggregate = round3(aggregate + Math.max(0, grossByBucket[next].gross - receiptsByBucket[next].qty));
        }
      }
      const sized = sizeLot(aggregate, input.policy);
      plannedOrderReceiptQty = sized.quantity;
      appliedConstraints = sized.appliedConstraints;
    }
    plannedReceipts[index] = plannedOrderReceiptQty;

    const projectedAfter = round3(beforeQty + plannedOrderReceiptQty - gross.gross);
    if (projectedAfter < safetyStockQty - EPSILON) {
      const gap = round3(safetyStockQty - projectedAfter);
      if (firstShortageBucketStart === null) firstShortageBucketStart = bucket.start;
      shortageQty = round3(shortageQty + gap);
    }

    const releaseIndex = index - leadTimeBuckets;
    const plannedOrderReleaseAt = plannedOrderReceiptQty > 0 && releaseIndex >= 0 ? buckets[releaseIndex].start : null;

    lines.push({
      partId: input.partId,
      bucketIndex: index,
      bucketStart: bucket.start,
      bucketEnd: bucket.end,
      forecastQty: gross.forecastQty,
      salesOrderQty: gross.salesOrderQty,
      contractQty: gross.contractQty,
      manualQty: gross.manualQty,
      consumedForecastQty: gross.consumedForecastQty,
      grossRequirementQty: gross.gross,
      scheduledReceiptQty,
      projectedOnHandBefore: beforeQty,
      netRequirementQty,
      plannedOrderReceiptQty,
      plannedOrderReleaseQty: plannedOrderReceiptQty > 0 && releaseIndex >= 0 ? plannedOrderReceiptQty : 0,
      plannedOrderReleaseAt,
      projectedOnHandAfter: projectedAfter,
      insideDemandTimeFence,
      isFirm: plannedOrderReceiptQty > 0 && index < fptf,
      lotSizingRule: input.policy.rule,
      appliedConstraints,
      demandRefs: [...new Set(gross.refs)],
    });

    projectedBefore = projectedAfter;
  }

  return {
    modelVersion: MANUFACTURING_PLANNING_MODEL_VERSION,
    partId: input.partId,
    uom: input.uom ?? null,
    bucketUnit,
    bucketCount: buckets.length,
    openingAvailableQty,
    safetyStockQty,
    leadTimeDays,
    leadTimeBuckets,
    demandTimeFenceBuckets: dtf,
    firmPlannedTimeFenceBuckets: fptf,
    lotSizingRule: input.policy.rule,
    eoq,
    periodOrderQuantity: input.policy.rule === "POQ" ? poqPeriods : null,
    lines,
    totals: {
      grossRequirementQty: round3(lines.reduce((sum, line) => sum + line.grossRequirementQty, 0)),
      scheduledReceiptQty: round3(lines.reduce((sum, line) => sum + line.scheduledReceiptQty, 0)),
      netRequirementQty: round3(lines.reduce((sum, line) => sum + line.netRequirementQty, 0)),
      plannedOrderReceiptQty: round3(lines.reduce((sum, line) => sum + line.plannedOrderReceiptQty, 0)),
      firstShortageBucketStart,
      shortageQty,
    },
  };
}

/* ════════════════════════ ۴. قابلیت تعهد تحویل (ATP) ════════════════════════ */

export type AtpMode = "discrete" | "cumulative";
export type AtpPromiseStatus = "available" | "delayed" | "unavailable";

export interface AtpBucketInput {
  bucketStart: string;
  bucketEnd: string;
  /** تقاضای متعهدشده (سفارش فروش/قرارداد) در این سطل. */
  demandQty: number;
  /** رسیدهای برنامه‌ریزی‌شده (سفارش باز + سفارش برنامه‌ریزی‌شدهٔ MPS). */
  supplyQty: number;
}

export interface AtpBucketResult extends AtpBucketInput {
  projectedOnHand: number;
  availableToPromise: number;
  cumulativeAtp: number;
}

export interface AtpResult {
  modelVersion: string;
  mode: AtpMode;
  onHandQty: number;
  reservedQty: number;
  blockedQty: number;
  safetyStockQty: number;
  includeSafetyStock: boolean;
  openingAvailableQty: number;
  buckets: AtpBucketResult[];
  totals: {
    demandQty: number;
    supplyQty: number;
    availableToPromiseQty: number;
    firstNegativeBucketStart: string | null;
  };
}

/** موجودی قابل تعهد آغازین = موجودی − رزرو − مسدود − (ذخیرهٔ احتیاطی در صورت انتخاب). */
export function computeOpeningAvailableQty(input: {
  onHandQty: number;
  reservedQty?: number;
  blockedQty?: number;
  safetyStockQty?: number;
  includeSafetyStock?: boolean;
}): number {
  const onHand = round3(finite(input.onHandQty, 0));
  const reserved = round3(Math.max(0, finite(input.reservedQty, 0)));
  const blocked = round3(Math.max(0, finite(input.blockedQty, 0)));
  const safety = input.includeSafetyStock === false ? 0 : round3(Math.max(0, finite(input.safetyStockQty, 0)));
  return round3(Math.max(0, onHand - reserved - blocked - safety));
}

/**
 * محاسبهٔ ATP در دو حالت استاندارد APICS:
 *  - `discrete`: فقط سطل دارای رسید، ATP دارد و برابر است با رسید منهای تقاضای
 *    بازهٔ تا رسید بعدی. جمع این مقدارها «قابل تعهد» واقعی است.
 *  - `cumulative`: مجموع جاری (رسید − تقاضا) که برای پرسش «تا این تاریخ چقدر
 *    می‌توانیم تعهد دهیم» استفاده می‌شود.
 */
export function computeAvailableToPromise(input: {
  onHandQty: number;
  reservedQty?: number;
  blockedQty?: number;
  safetyStockQty?: number;
  includeSafetyStock?: boolean;
  mode?: AtpMode;
  buckets: AtpBucketInput[];
}): AtpResult {
  const mode: AtpMode = input.mode === "cumulative" ? "cumulative" : "discrete";
  const buckets = [...(input.buckets ?? [])].sort((left, right) => String(left.bucketStart).localeCompare(String(right.bucketStart)));
  const openingAvailableQty = computeOpeningAvailableQty(input);

  const results: AtpBucketResult[] = buckets.map((bucket) => ({
    ...bucket,
    demandQty: round3(Math.max(0, finite(bucket.demandQty, 0))),
    supplyQty: round3(Math.max(0, finite(bucket.supplyQty, 0))),
    projectedOnHand: 0,
    availableToPromise: 0,
    cumulativeAtp: 0,
  }));

  let projected = openingAvailableQty;
  let firstNegativeBucketStart: string | null = null;
  for (const row of results) {
    projected = round3(projected + row.supplyQty - row.demandQty);
    row.projectedOnHand = projected;
    if (projected < -EPSILON && firstNegativeBucketStart === null) firstNegativeBucketStart = row.bucketStart;
  }

  if (mode === "cumulative") {
    let running = openingAvailableQty;
    for (const row of results) {
      running = round3(running + row.supplyQty - row.demandQty);
      row.cumulativeAtp = round3(Math.max(0, running));
      row.availableToPromise = row.cumulativeAtp;
    }
  } else {
    const supplyIndexes = results.map((row, index) => (row.supplyQty > 0 ? index : -1)).filter((index) => index >= 0);
    for (let segment = 0; segment <= supplyIndexes.length; segment++) {
      const anchorIndex = segment === 0 ? 0 : supplyIndexes[segment - 1];
      const endIndex = segment < supplyIndexes.length ? supplyIndexes[segment] : results.length;
      if (anchorIndex >= results.length) continue;
      const baseSupply = segment === 0 ? openingAvailableQty : results[anchorIndex].supplyQty;
      let demandSum = 0;
      for (let index = anchorIndex; index < endIndex; index++) demandSum = round3(demandSum + results[index].demandQty);
      const atp = round3(Math.max(0, baseSupply - demandSum));
      results[anchorIndex].availableToPromise = atp;
      results[anchorIndex].cumulativeAtp = atp;
    }
  }

  return {
    modelVersion: MANUFACTURING_PLANNING_MODEL_VERSION,
    mode,
    onHandQty: round3(finite(input.onHandQty, 0)),
    reservedQty: round3(Math.max(0, finite(input.reservedQty, 0))),
    blockedQty: round3(Math.max(0, finite(input.blockedQty, 0))),
    safetyStockQty: round3(Math.max(0, finite(input.safetyStockQty, 0))),
    includeSafetyStock: input.includeSafetyStock !== false,
    openingAvailableQty,
    buckets: results,
    totals: {
      demandQty: round3(results.reduce((sum, row) => sum + row.demandQty, 0)),
      supplyQty: round3(results.reduce((sum, row) => sum + row.supplyQty, 0)),
      availableToPromiseQty: round3(results.reduce((sum, row) => sum + row.availableToPromise, 0)),
      firstNegativeBucketStart,
    },
  };
}

export interface AtpPromiseCheck {
  status: AtpPromiseStatus;
  requestedQty: number;
  /** مقداری که واقعاً قابل تعهد است. */
  promisedQty: number;
  /** کمبود در افق محاسبه‌شده. */
  shortageQty: number;
  requestedAt: string;
  /** تاریخ قابل تعهد؛ برای `available` همان تاریخ درخواست است. */
  promisedAt: string | null;
  /** تعداد سطل‌های تأخیر نسبت به درخواست. */
  delayBuckets: number;
  /** سطلی که تعهد از آن تأمین می‌شود. */
  sourceBucketStart: string | null;
  message: string;
}

/**
 * بررسی تعهد تحویل برای یک مقدار و تاریخ مشخص.
 * در حالت تجمعی، ATP تجمعی آخرین سطلِ «تا تاریخ درخواست» ملاک است؛ در حالت گسسته
 * اولین سطل دارای رسیدِ کافی از تاریخ درخواست به بعد انتخاب می‌شود.
 */
export function checkAtpPromise(input: {
  atp: AtpResult;
  requestedQty: number;
  requestedAt: string;
  leadTimeDays?: number;
}): AtpPromiseCheck {
  const requestedQty = round3(finite(input.requestedQty, 0));
  if (requestedQty <= 0) {
    throw new ManufacturingPlanningError("MFG_ATP_QTY_INVALID", "مقدار درخواستی ATP باید مثبت باشد", { requestedQty: input.requestedQty });
  }
  const requestedDay = String(input.requestedAt ?? "").slice(0, 10);
  if (!dateParts(requestedDay)) {
    throw new ManufacturingPlanningError("MFG_PLAN_DATE_INVALID", "requestedAt باید تاریخ معتبر باشد", { requestedAt: input.requestedAt });
  }
  const leadTimeDays = Math.max(0, Math.trunc(finite(input.leadTimeDays, 0)));
  const buckets = input.atp.buckets;
  const eligible = buckets.filter((bucket) => bucket.bucketStart <= requestedDay);
  const cumulative = input.atp.mode === "cumulative";

  const findFirstCapable = (candidates: AtpBucketResult[]): AtpBucketResult | null => {
    for (const bucket of candidates) {
      const value = cumulative ? bucket.cumulativeAtp : bucket.availableToPromise;
      if (value >= requestedQty - EPSILON) return bucket;
    }
    return null;
  };

  const onTime = findFirstCapable(eligible);
  if (onTime) {
    return {
      status: "available",
      requestedQty,
      promisedQty: requestedQty,
      shortageQty: 0,
      requestedAt: requestedDay,
      promisedAt: requestedDay,
      delayBuckets: 0,
      sourceBucketStart: onTime.bucketStart,
      message: `تحویل ${requestedQty} تا ${requestedDay} قابل تعهد است`,
    };
  }

  const later = findFirstCapable(buckets.filter((bucket) => bucket.bucketStart > requestedDay));
  if (later) {
    const promisedAt = addDays(later.bucketStart, leadTimeDays);
    /* تأخیر بر حسب سطل: فاصلهٔ سطل قابل تعهد تا آخرین سطلی که هنوز در/پیش از
     * تاریخ درخواست است. اگر درخواست پیش از افق باشد، از اولین سطل شمرده می‌شود. */
    const laterIndex = buckets.findIndex((bucket) => bucket.bucketStart === later.bucketStart);
    let requestedIndex = -1;
    buckets.forEach((bucket, index) => {
      if (bucket.bucketStart <= requestedDay) requestedIndex = index;
    });
    const delayBuckets = laterIndex - Math.max(0, requestedIndex);
    return {
      status: "delayed",
      requestedQty,
      promisedQty: requestedQty,
      shortageQty: 0,
      requestedAt: requestedDay,
      promisedAt,
      delayBuckets: Math.max(0, delayBuckets),
      sourceBucketStart: later.bucketStart,
      message: `تحویل در تاریخ درخواست ممکن نیست؛ اولین تاریخ قابل تعهد ${promisedAt} است`,
    };
  }

  /* سقف تعهد از سطل‌هایِ «تاریخ درخواست به بعد» گرفته می‌شود، نه از موجودی
   * آغازین؛ موجودی آغازین پیش از تقاضای متعهدشدهٔ همان سطل وجود دارد و
   * شمردنش تعهد را بیش از واقع بزرگ نشان می‌دهد. */
  const candidates = buckets.filter((bucket) => bucket.bucketStart >= requestedDay);
  const searchSpace = candidates.length > 0 ? candidates : buckets;
  const bestAvailable = searchSpace.reduce((best, bucket) => {
    const value = cumulative ? bucket.cumulativeAtp : bucket.availableToPromise;
    return value > best ? value : best;
  }, 0);
  const promisedQty = round3(Math.min(requestedQty, Math.max(0, bestAvailable)));
  const shortageQty = round3(requestedQty - promisedQty);
  return {
    status: "unavailable",
    requestedQty,
    promisedQty,
    shortageQty,
    requestedAt: requestedDay,
    promisedAt: null,
    delayBuckets: 0,
    sourceBucketStart: null,
    message: `در افق محاسبه‌شده فقط ${promisedQty} قابل تعهد است؛ کمبود ${shortageQty}`,
  };
}

/* ════════════════════════ ۵. تقسیم لات و هم‌پوشانی عملیات ════════════════════════ */

export interface SplitLot {
  splitNo: number;
  quantity: number;
  cumulativeQuantity: number;
}

export interface SplitLotPlan {
  orderQuantity: number;
  requestedSplitCount: number;
  /** تعداد لات‌های واقعاً ساخته‌شده پس از اعمال حداقل اندازهٔ لات. */
  effectiveSplitCount: number;
  transferBatchQty: number | null;
  minLotQty: number;
  lots: SplitLot[];
  /** تعدیل‌های خوانا (مثلاً کاهش تعداد لات به خاطر حداقل اندازه). */
  notes: string[];
}

/**
 * تقسیم لات سفارش به زیرلات‌ها.
 * اگر `transferBatchQty` داده شود، لات اول همان اندازهٔ انتقال است و بقیهٔ مقدار
 * بین لات‌های باقی‌مانده توزیع می‌شود؛ این لات اول مبنای شروع عملیات بعدی
 * (هم‌پوشانی) است. `minLotQty` تعداد لات‌ها را تا حد لازم کم می‌کند.
 */
export function computeSplitLots(input: {
  orderQuantity: number;
  splitLotCount?: number | null;
  transferBatchQty?: number | null;
  minLotQty?: number | null;
}): SplitLotPlan {
  const notes: string[] = [];
  const orderQuantity = round3(finite(input.orderQuantity, 0));
  if (orderQuantity <= 0) {
    throw new ManufacturingPlanningError("MFG_SPLIT_QTY_INVALID", "مقدار سفارش برای تقسیم باید مثبت باشد", { orderQuantity: input.orderQuantity });
  }
  const requestedSplitCount = Math.max(1, Math.min(MAX_SPLIT_LOTS, Math.trunc(finite(input.splitLotCount, 1))));
  const transferBatchQty = finite(input.transferBatchQty, 0) > 0 ? round3(finite(input.transferBatchQty, 0)) : null;
  const minLotQty = round3(Math.max(0, finite(input.minLotQty, 0)));

  if (transferBatchQty !== null && transferBatchQty >= orderQuantity - EPSILON) {
    notes.push("TransferBatchQty از مقدار سفارش کوچک‌تر نیست؛ هم‌پوشانی اثری ندارد");
  }

  let splitCount = requestedSplitCount;
  if (transferBatchQty !== null && transferBatchQty < orderQuantity - EPSILON && splitCount < 2) {
    splitCount = 2;
    notes.push("با تعیین TransferBatchQty حداقل دو لات لازم است");
  }
  if (minLotQty > 0) {
    const maxByMinLot = Math.max(1, Math.floor((orderQuantity + EPSILON) / minLotQty));
    if (maxByMinLot < splitCount) {
      notes.push(`حداقل اندازهٔ لات (${minLotQty}) تعداد لات‌ها را از ${splitCount} به ${maxByMinLot} کاهش داد`);
      splitCount = maxByMinLot;
    }
  }

  const quantities: number[] = [];
  if (transferBatchQty !== null && transferBatchQty < orderQuantity - EPSILON) {
    quantities.push(transferBatchQty);
    const remaining = round3(orderQuantity - transferBatchQty);
    const restLots = Math.max(1, splitCount - 1);
    const base = Math.floor((remaining / restLots) * 1000) / 1000;
    let assigned = 0;
    for (let index = 0; index < restLots; index++) {
      const isLast = index === restLots - 1;
      const value = isLast ? round3(remaining - assigned) : base;
      quantities.push(value);
      assigned = round3(assigned + value);
    }
  } else {
    const base = Math.floor((orderQuantity / splitCount) * 1000) / 1000;
    let assigned = 0;
    for (let index = 0; index < splitCount; index++) {
      const isLast = index === splitCount - 1;
      const value = isLast ? round3(orderQuantity - assigned) : base;
      quantities.push(value);
      assigned = round3(assigned + value);
    }
  }

  const lots: SplitLot[] = [];
  let cumulative = 0;
  quantities.forEach((quantity, index) => {
    cumulative = round3(cumulative + quantity);
    lots.push({ splitNo: index + 1, quantity, cumulativeQuantity: cumulative });
  });

  return {
    orderQuantity,
    requestedSplitCount,
    effectiveSplitCount: lots.length,
    transferBatchQty,
    minLotQty,
    lots,
    notes,
  };
}

export interface OverlapOperationInput {
  operationId: string;
  operationCode?: string | null;
  sequenceNo: number;
  quantity: number;
  setupMinutes: number;
  runMinutesPerUnit: number;
  queueMinutes?: number;
  moveMinutes?: number;
  overlapAllowed?: boolean;
  transferBatchQty?: number | null;
  /** درصد هم‌پوشانی؛ فقط زمانی خوانده می‌شود که TransferBatchQty تعیین نشده باشد. */
  overlapPct?: number | null;
}

export interface OverlapAnalysis {
  operationId: string;
  operationCode: string | null;
  sequenceNo: number;
  quantity: number;
  capacityMinutes: number;
  /** دقایق لازم برای آماده‌شدن لات انتقال (Setup + Run × TransferBatchQty). */
  transferReadyMinutes: number | null;
  /** دقایق انتهایی عملیات که با عملیات بعدی هم‌پوشانی دارد. */
  overlapTailMinutes: number | null;
  transferBatchQty: number | null;
  effectiveTransferBatchQty: number | null;
  overlapAllowed: boolean;
}

/** مقدار مؤثر لات انتقال؛ اگر درصد هم‌پوشانی داده شده باشد از مقدار لات مشتق می‌شود. */
export function resolveTransferBatchQty(operation: OverlapOperationInput): number | null {
  if (operation.overlapAllowed !== true) return null;
  const quantity = round3(finite(operation.quantity, 0));
  if (quantity <= 0) return null;
  const explicit = finite(operation.transferBatchQty, 0);
  if (explicit > 0) return round3(Math.min(explicit, quantity));
  const overlapPct = finite(operation.overlapPct, 0);
  if (overlapPct > 0 && overlapPct < 100) {
    /* درصد هم‌پوشانی یعنی چه بخشی از لات قبل از پایان عملیات قبلی منتقل شود. */
    return round3(Math.max(1, (quantity * (100 - overlapPct)) / 100));
  }
  return null;
}

/**
 * تحلیل هم‌پوشانی یک عملیات: چقدر از زمان آن با عملیات بعدی هم‌پوشانی دارد.
 * `transferReadyMinutes` از شروع عملیات اندازه گرفته می‌شود (Setup سپس Run لات انتقال).
 */
export function analyzeOverlap(operation: OverlapOperationInput): OverlapAnalysis {
  const quantity = round3(finite(operation.quantity, 0));
  const setupMinutes = round3(Math.max(0, finite(operation.setupMinutes, 0)));
  const runMinutesPerUnit = round3(Math.max(0, finite(operation.runMinutesPerUnit, 0)));
  const capacityMinutes = round3(setupMinutes + runMinutesPerUnit * quantity);
  const effectiveTransferBatchQty = resolveTransferBatchQty(operation);

  let transferReadyMinutes: number | null = null;
  let overlapTailMinutes: number | null = null;
  if (effectiveTransferBatchQty !== null && effectiveTransferBatchQty < quantity - EPSILON) {
    transferReadyMinutes = round3(setupMinutes + runMinutesPerUnit * effectiveTransferBatchQty);
    overlapTailMinutes = round3(Math.max(0, capacityMinutes - transferReadyMinutes));
  }

  return {
    operationId: operation.operationId,
    operationCode: operation.operationCode ?? null,
    sequenceNo: finite(operation.sequenceNo, 0),
    quantity,
    capacityMinutes,
    transferReadyMinutes,
    overlapTailMinutes,
    transferBatchQty: finite(operation.transferBatchQty, 0) > 0 ? round3(finite(operation.transferBatchQty, 0)) : null,
    effectiveTransferBatchQty,
    overlapAllowed: operation.overlapAllowed === true,
  };
}

export interface LeadTimeAnalysis {
  modelVersion: string;
  /** مجموع زمان ظرفیت همهٔ عملیات‌ها بدون هیچ هم‌پوشانی (مبنای مقایسه). */
  baselineCapacityMinutes: number;
  /** زمان ظرفیت با احتساب هم‌پوشانی لات انتقال. */
  overlappedCapacityMinutes: number;
  savedMinutes: number;
  savedPct: number;
  /** زمان LeadTime کل شامل Queue/Move در دو حالت. */
  baselineLeadTimeMinutes: number;
  overlappedLeadTimeMinutes: number;
  leadTimeSavedMinutes: number;
  leadTimeSavedPct: number;
  /** بازهٔ واقعی برنامهٔ زمان‌بندی‌شده (در صورت وجود). */
  scheduledSpanMinutes: number | null;
  operations: Array<{
    operationId: string;
    operationCode: string | null;
    sequenceNo: number;
    quantity: number;
    capacityMinutes: number;
    queueMinutes: number;
    moveMinutes: number;
    transferBatchQty: number | null;
    transferReadyMinutes: number | null;
    overlapTailMinutes: number | null;
    /** تعداد لات‌های تقسیم‌شدهٔ این عملیات. */
    splitLotCount: number;
  }>;
}

/**
 * مقایسهٔ LeadTime بدون هم‌پوشانی با LeadTime واقعیِ هم‌پوشان.
 *
 * مبنای محاسبه: در زنجیرهٔ عملیات، عملیات بعدی به‌جای پایان کامل عملیات قبلی
 * می‌تواند از «آماده‌شدن لات انتقال» شروع شود؛ بنابراین از هر عملیات هم‌پوشان
 * به اندازهٔ `overlapTailMinutes` صرفه‌جویی می‌شود.
 */
export function analyzeLeadTimeOverlap(input: {
  operations: OverlapOperationInput[];
  scheduledWindows?: Array<{ operationId: string; startAt: string; endAt: string }> | null;
  splitLotCountByOperation?: Record<string, number> | null;
}): LeadTimeAnalysis {
  const ordered = [...(input.operations ?? [])].sort((left, right) => finite(left.sequenceNo, 0) - finite(right.sequenceNo, 0));
  const analyses = ordered.map((operation) => analyzeOverlap(operation));

  let baselineCapacity = 0;
  let overlappedCapacity = 0;
  let baselineLeadTime = 0;
  let overlappedLeadTime = 0;
  analyses.forEach((analysis, index) => {
    const operation = ordered[index];
    const queueMinutes = round3(Math.max(0, finite(operation.queueMinutes, 0)));
    const moveMinutes = round3(Math.max(0, finite(operation.moveMinutes, 0)));
    baselineCapacity = round3(baselineCapacity + analysis.capacityMinutes);
    baselineLeadTime = round3(baselineLeadTime + analysis.capacityMinutes + queueMinutes + moveMinutes);
    const tail = index > 0 ? analyses[index - 1].overlapTailMinutes : null;
    const saved = tail === null ? 0 : tail;
    overlappedCapacity = round3(overlappedCapacity + Math.max(0, analysis.capacityMinutes - saved));
    overlappedLeadTime = round3(overlappedLeadTime + Math.max(0, analysis.capacityMinutes - saved) + queueMinutes + moveMinutes);
  });

  let scheduledSpanMinutes: number | null = null;
  const windows = (input.scheduledWindows ?? []).map((window) => ({
    start: Date.parse(window.startAt),
    end: Date.parse(window.endAt),
  })).filter((window) => Number.isFinite(window.start) && Number.isFinite(window.end) && window.end > window.start);
  if (windows.length > 0) {
    const earliest = Math.min(...windows.map((window) => window.start));
    const latest = Math.max(...windows.map((window) => window.end));
    scheduledSpanMinutes = Math.round(((latest - earliest) / 60_000) * 1000) / 1000;
  }

  const savedMinutes = round3(Math.max(0, baselineCapacity - overlappedCapacity));
  const leadTimeSavedMinutes = round3(Math.max(0, baselineLeadTime - overlappedLeadTime));
  const splitCounts = input.splitLotCountByOperation ?? {};

  return {
    modelVersion: MANUFACTURING_PLANNING_MODEL_VERSION,
    baselineCapacityMinutes: baselineCapacity,
    overlappedCapacityMinutes: overlappedCapacity,
    savedMinutes,
    savedPct: baselineCapacity > 0 ? round3((savedMinutes / baselineCapacity) * 100) : 0,
    baselineLeadTimeMinutes: baselineLeadTime,
    overlappedLeadTimeMinutes: overlappedLeadTime,
    leadTimeSavedMinutes,
    leadTimeSavedPct: baselineLeadTime > 0 ? round3((leadTimeSavedMinutes / baselineLeadTime) * 100) : 0,
    scheduledSpanMinutes,
    operations: analyses.map((analysis, index) => ({
      operationId: analysis.operationId,
      operationCode: analysis.operationCode,
      sequenceNo: analysis.sequenceNo,
      quantity: analysis.quantity,
      capacityMinutes: analysis.capacityMinutes,
      queueMinutes: round3(Math.max(0, finite(ordered[index].queueMinutes, 0))),
      moveMinutes: round3(Math.max(0, finite(ordered[index].moveMinutes, 0))),
      transferBatchQty: analysis.effectiveTransferBatchQty,
      transferReadyMinutes: analysis.transferReadyMinutes,
      overlapTailMinutes: analysis.overlapTailMinutes,
      splitLotCount: Math.max(1, Math.trunc(finite(splitCounts[analysis.operationId], 1))),
    })),
  };
}

/* ══════════════════ ۵. کد سطح پایین و Lead Time Offset (۱۱.۵) ══════════════════ */

/** یال گراف BOM: والد → جزء. */
export interface BomEdge {
  parentPartId: string;
  componentPartId: string;
  quantityPer: number;
}

/**
 * کد سطح پایین (Low-Level Code) هر قطعه.
 *
 * در MRP II هر قطعه باید در **پایین‌ترین** سطحی که در کل BOM در آن ظاهر می‌شود
 * محاسبه شود. اگر قطعه‌ای هم در سطح ۱ و هم در سطح ۳ بیاید و ما در سطح ۱ نیاز
 * خالصش را حساب کنیم، نیاز سطح ۳ بعداً اضافه می‌شود و یک سفارش اضافه تولید
 * شده است. LLC یعنی بیشترین عمقی که قطعه در هر مسیر BOM دارد.
 */
export function computeLowLevelCodes(input: {
  edges: BomEdge[];
  partIds?: string[];
  maxLevels?: number;
}): Map<string, number> {
  const maxLevels = Math.max(1, Math.trunc(finite(input.maxLevels, 32)));
  const codes = new Map<string, number>();
  for (const partId of input.partIds ?? []) codes.set(partId, 0);
  for (const edge of input.edges) {
    if (!codes.has(edge.parentPartId)) codes.set(edge.parentPartId, 0);
    if (!codes.has(edge.componentPartId)) codes.set(edge.componentPartId, 0);
  }

  /* ریلکسیشن تکراری: هر یال سطح جزء را دست‌کم یکی زیر والد می‌برد. همگرایی
   * یعنی هیچ یالی دیگر چیزی را جابه‌جا نمی‌کند؛ واگرایی یعنی چرخه در BOM. */
  for (let pass = 0; pass <= maxLevels; pass += 1) {
    let changed = false;
    for (const edge of input.edges) {
      const parentLevel = codes.get(edge.parentPartId) ?? 0;
      const next = parentLevel + 1;
      if (next > maxLevels) {
        throw new ManufacturingPlanningError("MFG_BOM_DEPTH_LIMIT", `عمق BOM از سقف ${maxLevels} سطح بیشتر است`, {
          parentPartId: edge.parentPartId,
          componentPartId: edge.componentPartId,
        });
      }
      if ((codes.get(edge.componentPartId) ?? 0) < next) {
        codes.set(edge.componentPartId, next);
        changed = true;
      }
    }
    if (!changed) return codes;
  }
  throw new ManufacturingPlanningError("MFG_BOM_CYCLE", "چرخه در گراف BOM تشخیص داده شد؛ کد سطح پایین همگرا نمی‌شود", {
    maxLevels,
  });
}

export interface LeadTimeOffsetRow {
  partId: string;
  lowLevelCode: number;
  ownLeadTimeDays: number;
  /** own + بیشترین زمان تجمیعی زیرمجموعه؛ همان Cumulative Lead Time استاندارد APICS. */
  cumulativeLeadTimeDays: number;
  /** چند روز پیش از سررسید محصول نهایی این قطعه باید موجود باشد. */
  availabilityOffsetDays: number;
  /** چند روز پیش از سررسید محصول نهایی سفارش این قطعه باید آزاد شود. */
  releaseOffsetDays: number;
}

export interface LeadTimeOffsetResult {
  parts: LeadTimeOffsetRow[];
  /** بیشترین offset آزادسازی به ازای هر سطح BOM. */
  levelOffsets: { level: number; releaseOffsetDays: number; partCount: number }[];
  /** زمان تحویل تجمیعی محصول نهایی — همان عددی که در گزارش MRP نشان داده می‌شود. */
  finishedGoodsLeadTimeDays: number;
  maxLowLevelCode: number;
}

/**
 * زمان تحویل تجمیعی و offset زمانی هر سطح.
 *
 * دو عدد جدا گزارش می‌شود چون دو سؤال متفاوت‌اند:
 *  - `cumulativeLeadTimeDays` (پایین‌به‌بالا): ساخت این قطعه با همهٔ زیرمجموعه‌اش
 *    چقدر طول می‌کشد.
 *  - `availabilityOffsetDays` (بالا‌به‌پایین): این قطعه چند روز پیش از سررسید
 *    محصول نهایی باید دم دست باشد.
 * جمع این دو برای همهٔ قطعات یک مسیر برابر `releaseOffsetDays` همان مسیر است.
 */
export function computeLeadTimeOffsets(input: {
  edges: BomEdge[];
  leadTimeDaysByPartId: Record<string, number | null | undefined>;
  rootPartIds: string[];
  maxLevels?: number;
}): LeadTimeOffsetResult {
  const lowLevelCodes = computeLowLevelCodes({ edges: input.edges, maxLevels: input.maxLevels });
  const ownOf = (partId: string) => Math.max(0, finite(input.leadTimeDaysByPartId?.[partId], 0));

  const childrenByParent = new Map<string, string[]>();
  const parentsByChild = new Map<string, string[]>();
  for (const edge of input.edges) {
    const kids = childrenByParent.get(edge.parentPartId) ?? [];
    kids.push(edge.componentPartId);
    childrenByParent.set(edge.parentPartId, kids);
    const parents = parentsByChild.get(edge.componentPartId) ?? [];
    parents.push(edge.parentPartId);
    parentsByChild.set(edge.componentPartId, parents);
  }

  /* پایین‌به‌بالا: از برگ‌ها (بی‌فرزند) شروع می‌کنیم و به سمت ریشه جمع می‌زنیم. */
  const cumulative = new Map<string, number>();
  const ordered = [...lowLevelCodes.keys()].sort(
    (left, right) => (lowLevelCodes.get(right) ?? 0) - (lowLevelCodes.get(left) ?? 0),
  );
  for (const partId of ordered) {
    const kids = childrenByParent.get(partId) ?? [];
    const deepest = kids.reduce((max, kid) => Math.max(max, cumulative.get(kid) ?? 0), 0);
    cumulative.set(partId, round3(ownOf(partId) + deepest));
  }

  /* بالا‌به‌پایین: ریشه offset صفر دارد (همان روز سررسید است) و هر جزء به اندازهٔ
   * زمان ساخت والدش عقب‌تر می‌رود. وقتی قطعه‌ای چند والد دارد، زودترین نیاز
   * (بزرگ‌ترین offset) حاکم است تا هیچ مسیری دیر نرسد. */
  const availability = new Map<string, number>();
  for (const partId of [...ordered].reverse()) {
    const parents = parentsByChild.get(partId) ?? [];
    const worst = parents.reduce(
      (max, parent) => Math.max(max, (availability.get(parent) ?? 0) + ownOf(parent)),
      0,
    );
    availability.set(partId, round3(worst));
  }

  const parts: LeadTimeOffsetRow[] = ordered.map((partId) => {
    const cum = cumulative.get(partId) ?? 0;
    const avail = availability.get(partId) ?? 0;
    return {
      partId,
      lowLevelCode: lowLevelCodes.get(partId) ?? 0,
      ownLeadTimeDays: ownOf(partId),
      cumulativeLeadTimeDays: cum,
      availabilityOffsetDays: avail,
      releaseOffsetDays: round3(avail + cum),
    };
  });

  const byLevel = new Map<number, { releaseOffsetDays: number; partCount: number }>();
  for (const row of parts) {
    const bucket = byLevel.get(row.lowLevelCode) ?? { releaseOffsetDays: 0, partCount: 0 };
    bucket.releaseOffsetDays = Math.max(bucket.releaseOffsetDays, row.releaseOffsetDays);
    bucket.partCount += 1;
    byLevel.set(row.lowLevelCode, bucket);
  }

  const finished = Math.max(0, ...input.rootPartIds.map((partId) => cumulative.get(partId) ?? 0));
  return {
    parts: parts.sort((left, right) => left.lowLevelCode - right.lowLevelCode || left.partId.localeCompare(right.partId)),
    levelOffsets: [...byLevel.entries()]
      .map(([level, value]) => ({ level, ...value }))
      .sort((left, right) => left.level - right.level),
    finishedGoodsLeadTimeDays: round3(finished),
    maxLowLevelCode: parts.reduce((max, row) => Math.max(max, row.lowLevelCode), 0),
  };
}

/* ══════════════════════════ ۶. Pegging (۱۱.۶) ══════════════════════════ */

/** یک منبع تأمین (سفارش برنامه‌ریزی‌شده، سفارش تولید یا موجودی). */
export interface PeggingSupply {
  partId: string;
  supplyRef: string;
  quantity: number;
  supplyType?: string;
}

/** پیوند مصرف: کدام تأمینِ والد، کدام تأمینِ جزء را مصرف می‌کند. */
export interface PeggingLink {
  parentSupplyRef: string;
  componentSupplyRef: string;
  quantityPer: number;
}

export interface PeggingPath {
  /** از جزء به سمت محصول نهایی؛ آخرین عضو همان ریشه است. */
  chain: { partId: string; supplyRef: string; quantityPer: number }[];
  depth: number;
}

export interface PeggingResult {
  /** تک‌سطحی: فقط والد مستقیم هر جزء. */
  singleLevel: Record<string, PeggingPath[]>;
  /** چندسطحی: ردیابی کامل از مادهٔ خام تا محصول نهایی. */
  multiLevel: Record<string, PeggingPath[]>;
  rootSupplyRefs: string[];
}

/**
 * Pegging تک‌سطحی و چندسطحی.
 *
 * تک‌سطحی پاسخ «این نیاز مواد به کدام سفارش تولید تعلق دارد» است و چندسطحی
 * پاسخ «این مادهٔ خام در نهایت به کدام محصول نهایی و کدام سفارش مشتری می‌رسد».
 * مسیرها از جزء به سمت ریشه چیده می‌شوند تا در گزارش MRP از پایین به بالا خوانده شوند.
 */
export function buildPegging(input: {
  supplies: PeggingSupply[];
  links: PeggingLink[];
  rootSupplyRefs?: string[];
  maxDepth?: number;
}): PeggingResult {
  const maxDepth = Math.max(1, Math.trunc(finite(input.maxDepth, 32)));
  const supplyByRef = new Map(input.supplies.map((supply) => [supply.supplyRef, supply]));
  const parentsByComponent = new Map<string, PeggingLink[]>();
  for (const link of input.links) {
    const list = parentsByComponent.get(link.componentSupplyRef) ?? [];
    list.push(link);
    parentsByComponent.set(link.componentSupplyRef, list);
  }

  const declaredRoots = new Set(input.rootSupplyRefs ?? []);
  const rootSupplyRefs = declaredRoots.size > 0
    ? [...declaredRoots]
    : input.supplies
      .filter((supply) => (parentsByComponent.get(supply.supplyRef) ?? []).length === 0)
      .map((supply) => supply.supplyRef);

  const singleLevel: Record<string, PeggingPath[]> = {};
  const multiLevel: Record<string, PeggingPath[]> = {};

  /* `originRef` همان تأمینی است که پیمایش از آن آغاز شده؛ مسیرها باید زیر کلید
   * مبدأ ثبت شوند تا گزارش بگوید «این مادهٔ خام به کجا می‌رسد»، نه اینکه همهٔ
   * مسیرها زیر کلید ریشه جمع شوند. */
  const walk = (originRef: string, supplyRef: string, trail: PeggingPath["chain"], visited: Set<string>, depth: number) => {
    if (depth > maxDepth) {
      throw new ManufacturingPlanningError("MFG_PEGGING_DEPTH_LIMIT", `عمق pegging از سقف ${maxDepth} بیشتر است`, { supplyRef, originRef });
    }
    const links = parentsByComponent.get(supplyRef) ?? [];
    if (links.length === 0 || declaredRoots.has(supplyRef)) {
      multiLevel[originRef] = multiLevel[originRef] ?? [];
      multiLevel[originRef].push({ chain: [...trail], depth: trail.length - 1 });
      return;
    }
    let walked = false;
    for (const link of links) {
      if (visited.has(link.parentSupplyRef)) continue; // محافظ چرخه
      const parent = supplyByRef.get(link.parentSupplyRef);
      if (!parent) continue;
      walked = true;
      const nextVisited = new Set(visited);
      nextVisited.add(link.parentSupplyRef);
      walk(
        originRef,
        link.parentSupplyRef,
        [...trail, { partId: parent.partId, supplyRef: parent.supplyRef, quantityPer: round3(link.quantityPer) }],
        nextVisited,
        depth + 1,
      );
    }
    /* والدی وجود داشت اما همه در چرخه بودند؛ مسیر تا همین‌جا معتبر است. */
    if (!walked) {
      multiLevel[originRef] = multiLevel[originRef] ?? [];
      multiLevel[originRef].push({ chain: [...trail], depth: trail.length - 1 });
    }
  };

  for (const supply of input.supplies) {
    const parents = (parentsByComponent.get(supply.supplyRef) ?? [])
      .map((link) => supplyByRef.get(link.parentSupplyRef))
      .filter((parent): parent is PeggingSupply => Boolean(parent));
    singleLevel[supply.supplyRef] = parents.map((parent) => ({
      chain: [{ partId: parent.partId, supplyRef: parent.supplyRef, quantityPer: round3(parent.quantity) }],
      depth: 1,
    }));
    multiLevel[supply.supplyRef] = multiLevel[supply.supplyRef] ?? [];
    walk(supply.supplyRef, supply.supplyRef, [{ partId: supply.partId, supplyRef: supply.supplyRef, quantityPer: 1 }], new Set([supply.supplyRef]), 0);
  }

  return { singleLevel, multiLevel, rootSupplyRefs };
}

/* ══════════════════ ۷. سفارش برنامه‌ریزی‌شده (Planned Order — ۱۱.۳) ══════════════════ */

export type PlannedOrderSource = "mps" | "mrp";

export interface PlannedOrderDraft {
  partId: string;
  partNo: string;
  uom: string;
  /** مقدار پس از اعمال قاعدهٔ لات و قیدها. */
  quantity: number;
  bucketIndex: number;
  dueAt: string;
  /** آزادسازی به اندازهٔ زمان تحویل (و نه فقط سطل) عقب‌تر می‌رود. */
  releaseAt: string;
  lotSizingRule: LotSizingRule;
  source: PlannedOrderSource;
  lowLevelCode: number;
  cumulativeLeadTimeDays: number;
  peggedSupplyRefs: string[];
}

export interface PlannedOrderInput {
  partId: string;
  partNo?: string;
  uom?: string;
  buckets: TimeBucket[];
  netRequirementByBucket: number[];
  policy: LotSizingPolicyInput;
  /** روز؛ برای offset آزادسازی استفاده می‌شود. */
  cumulativeLeadTimeDays?: number;
  lowLevelCode?: number;
  source?: PlannedOrderSource;
  peggedSupplyRefsByBucket?: Record<number, string[]>;
  /** پیش‌تر از این سطل سفارش برنامه‌ریزی‌شده صادر نمی‌شود (حصار تقاضا). */
  demandTimeFenceBuckets?: number;
}

/**
 * تبدیل نیاز خالص زمان‌بندی‌شده به سفارش برنامه‌ریزی‌شده.
 *
 * تفاوت کلیدی با MPS: خروجی اینجا **پیشنهاد** است، نه تعهد. برنامه‌ریز باید
 * بازبینی/ویرایش و سپس تأیید کند تا به سفارش تولید تبدیل شود. به همین دلیل
 * این تابع هیچ وضعیت «قطعی» تولید نمی‌کند.
 */
export function computePlannedOrders(input: PlannedOrderInput): PlannedOrderDraft[] {
  const buckets = input.buckets;
  if (!Array.isArray(buckets) || buckets.length === 0) {
    throw new ManufacturingPlanningError("MFG_PLANNING_BUCKET_EMPTY", "دست‌کم یک سطل زمانی لازم است");
  }
  const rule = LOT_SIZING_RULES.includes(input.policy.rule) ? input.policy.rule : "L4L";
  const dtf = Math.max(0, Math.trunc(finite(input.demandTimeFenceBuckets, 0)));
  const orders: PlannedOrderDraft[] = [];
  const leadTimeDays = Math.max(0, finite(input.cumulativeLeadTimeDays, 0));

  if (rule === "POQ") {
    const periods = Math.max(1, Math.trunc(resolvePeriodOrderQuantity(input.policy)));
    for (let index = 0; index < buckets.length; index += 1) {
      if (index < dtf) continue;
      const window = buckets.slice(index, index + periods);
      const gross = window.reduce((sum, _bucket, offset) => sum + Math.max(0, finite(input.netRequirementByBucket[index + offset], 0)), 0);
      if (gross <= EPSILON) continue;
      const sized = sizeLot(gross, input.policy);
      orders.push({
        partId: input.partId,
        partNo: input.partNo ?? input.partId,
        uom: input.uom ?? "ea",
        quantity: sized.quantity,
        bucketIndex: index,
        dueAt: buckets[index].start,
        releaseAt: isoDateShift(buckets[index].start, -leadTimeDays),
        lotSizingRule: rule,
        source: input.source ?? "mrp",
        lowLevelCode: Math.max(0, Math.trunc(finite(input.lowLevelCode, 0))),
        cumulativeLeadTimeDays: leadTimeDays,
        peggedSupplyRefs: peggedRefs(input.peggedSupplyRefsByBucket, index, index + periods - 1),
      });
      index += periods - 1;
    }
    return orders;
  }

  for (let index = 0; index < buckets.length; index += 1) {
    if (index < dtf) continue;
    const net = Math.max(0, finite(input.netRequirementByBucket[index], 0));
    if (net <= EPSILON) continue;
    const sized = sizeLot(net, input.policy);
    orders.push({
      partId: input.partId,
      partNo: input.partNo ?? input.partId,
      uom: input.uom ?? "ea",
      quantity: sized.quantity,
      bucketIndex: index,
      dueAt: buckets[index].start,
      releaseAt: isoDateShift(buckets[index].start, -leadTimeDays),
      lotSizingRule: rule,
      source: input.source ?? "mrp",
      lowLevelCode: Math.max(0, Math.trunc(finite(input.lowLevelCode, 0))),
      cumulativeLeadTimeDays: leadTimeDays,
      peggedSupplyRefs: peggedRefs(input.peggedSupplyRefsByBucket, index, index),
    });
  }
  return orders;
}

function peggedRefs(map: Record<number, string[]> | undefined, from: number, to: number): string[] {
  if (!map) return [];
  const out = new Set<string>();
  for (let index = from; index <= to; index += 1) {
    for (const ref of map[index] ?? []) out.add(ref);
  }
  return [...out].sort();
}

/** جابه‌جایی تاریخ ISO به تعداد روز (بدون وابستگی به منطقهٔ زمانی). */
export function isoDateShift(isoDate: string, days: number): string {
  const parsed = Date.parse(`${String(isoDate).slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return String(isoDate).slice(0, 10);
  return new Date(parsed + Math.trunc(finite(days, 0)) * DAY_MS).toISOString().slice(0, 10);
}

/* ══════════════ ۸. برنامه‌ریزی نیاز ظرفیت (CRP — ۱۱.۷) ══════════════ */

export type CrpBucketStatus = "overload" | "balanced" | "underload" | "idle";

export interface CrpOperationInput {
  operationId: string;
  workCenterId: string;
  /** دقیقهٔ ظرفیت کل عملیات (setup + run × qty). */
  capacityMinutes: number;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  quantity?: number;
  productionOrderId?: string;
}

export interface CrpWorkCenterInput {
  workCenterId: string;
  code: string;
  /** دقیقهٔ ظرفیت در دسترس در هر سطل. */
  availableMinutesByBucket: number[];
}

export interface CrpBucket {
  bucketIndex: number;
  bucketStart: string;
  bucketEnd: string;
  loadMinutes: number;
  capacityMinutes: number;
  utilizationPct: number;
  surplusMinutes: number;
  status: CrpBucketStatus;
  operationCount: number;
}

export interface CrpWorkCenterResult {
  workCenterId: string;
  code: string;
  buckets: CrpBucket[];
  totalLoadMinutes: number;
  totalCapacityMinutes: number;
  utilizationPct: number;
  peakUtilizationPct: number;
  overloadBucketCount: number;
  underloadBucketCount: number;
}

export interface CrpLevelingSuggestion {
  workCenterId: string;
  code: string;
  fromBucketIndex: number;
  toBucketIndex: number;
  movableMinutes: number;
  /** دقیقه‌ای که با این جابه‌جایی از سطل پربار کم می‌شود. */
  suggestedMinutes: number;
  reason: string;
}

export interface CrpResult {
  buckets: { bucketIndex: number; bucketStart: string; bucketEnd: string }[];
  workCenters: CrpWorkCenterResult[];
  totals: {
    loadMinutes: number;
    capacityMinutes: number;
    utilizationPct: number;
    overloadBucketCount: number;
    underloadBucketCount: number;
    idleBucketCount: number;
  };
  levelingSuggestions: CrpLevelingSuggestion[];
}

/**
 * برنامه‌ریزی نیاز ظرفیت (CRP).
 *
 * CRP **پس از** MRP اجرا می‌شود: ورودی‌اش سفارش‌های (برنامه‌ریزی‌شده یا آزاد)
 * همراه با زمان‌بندی‌شان است و خروجی‌اش بار در برابر ظرفیت هر مرکز کاری در هر
 * سطل، به‌همراه دوره‌های پربار/کم‌بار و پیشنهاد تسطیح بار.
 */
export function computeCapacityRequirements(input: {
  buckets: TimeBucket[];
  operations: CrpOperationInput[];
  workCenters: CrpWorkCenterInput[];
  /** درصد؛ بالاتر از این پربار و پایین‌تر از مکملش کم‌بار شمرده می‌شود. */
  overloadThresholdPct?: number;
  underloadThresholdPct?: number;
  /** سقف فاصلهٔ سطلی که جابه‌جایی بار در آن منطقی است. */
  levelingWindowBuckets?: number;
}): CrpResult {
  const buckets = input.buckets;
  if (!Array.isArray(buckets) || buckets.length === 0) {
    throw new ManufacturingPlanningError("MFG_PLANNING_BUCKET_EMPTY", "دست‌کم یک سطل زمانی لازم است");
  }
  const overPct = positive(input.overloadThresholdPct, 100);
  const underPct = positive(input.underloadThresholdPct, 60);
  const window = Math.max(1, Math.trunc(finite(input.levelingWindowBuckets, 4)));

  const opsByCenter = new Map<string, CrpOperationInput[]>();
  for (const op of input.operations) {
    const list = opsByCenter.get(op.workCenterId) ?? [];
    list.push(op);
    opsByCenter.set(op.workCenterId, list);
  }

  const workCenters: CrpWorkCenterResult[] = input.workCenters.map((center) => {
    const ops = opsByCenter.get(center.workCenterId) ?? [];
    const bucketRows: CrpBucket[] = buckets.map((bucket, index) => ({
      bucketIndex: index,
      bucketStart: bucket.start,
      bucketEnd: bucket.end,
      loadMinutes: 0,
      capacityMinutes: round3(Math.max(0, finite(center.availableMinutesByBucket?.[index], 0))),
      utilizationPct: 0,
      surplusMinutes: 0,
      status: "idle" as CrpBucketStatus,
      operationCount: 0,
    }));

    for (const op of ops) {
      const minutes = Math.max(0, finite(op.capacityMinutes, 0));
      if (minutes <= 0) continue;
      const start = Date.parse(String(op.plannedStartAt ?? ""));
      const end = Date.parse(String(op.plannedEndAt ?? ""));
      /* عملیات زمان‌بندی‌نشده در سطل صفر شمرده می‌شود تا از گزارش گم نشود؛
       * پنهان‌کردنش باعث می‌شود مرکز کاری کم‌بارتر از واقع به نظر برسد. */
      const startIndex = Number.isFinite(start) ? bucketIndexOf(buckets, new Date(start).toISOString().slice(0, 10)) : 0;
      const endIndex = Number.isFinite(end) ? bucketIndexOf(buckets, new Date(end).toISOString().slice(0, 10)) : startIndex;
      const from = Math.max(0, startIndex ?? 0);
      const to = Math.min(bucketRows.length - 1, Math.max(from, endIndex ?? from));
      const span = to - from + 1;
      const perBucket = round3(minutes / span);
      for (let index = from; index <= to; index += 1) {
        bucketRows[index].loadMinutes = round3(bucketRows[index].loadMinutes + perBucket);
        bucketRows[index].operationCount += 1;
      }
    }

    for (const row of bucketRows) {
      row.utilizationPct = row.capacityMinutes > 0 ? round3((row.loadMinutes / row.capacityMinutes) * 100) : row.loadMinutes > 0 ? 999 : 0;
      row.surplusMinutes = round3(row.capacityMinutes - row.loadMinutes);
      row.status = row.capacityMinutes <= 0 && row.loadMinutes <= 0
        ? "idle"
        : row.utilizationPct > overPct
          ? "overload"
          : row.utilizationPct < underPct
            ? "underload"
            : "balanced";
    }

    const totalLoad = round3(bucketRows.reduce((sum, row) => sum + row.loadMinutes, 0));
    const totalCapacity = round3(bucketRows.reduce((sum, row) => sum + row.capacityMinutes, 0));
    return {
      workCenterId: center.workCenterId,
      code: center.code,
      buckets: bucketRows,
      totalLoadMinutes: totalLoad,
      totalCapacityMinutes: totalCapacity,
      utilizationPct: totalCapacity > 0 ? round3((totalLoad / totalCapacity) * 100) : 0,
      peakUtilizationPct: bucketRows.reduce((max, row) => Math.max(max, row.utilizationPct), 0),
      overloadBucketCount: bucketRows.filter((row) => row.status === "overload").length,
      underloadBucketCount: bucketRows.filter((row) => row.status === "underload").length,
    };
  });

  /* تسطیح بار: برای هر سطل پربار، نزدیک‌ترین سطل کم‌بار درون پنجره پیدا می‌شود
   * و به اندازهٔ «نصف فاصله تا تعادل» بار جابه‌جا می‌شود — نه کل اضافه، چون
   * جابه‌جایی کامل معمولاً سطل مقصد را پربار می‌کند. */
  const levelingSuggestions: CrpLevelingSuggestion[] = [];
  for (const center of workCenters) {
    for (const row of center.buckets) {
      if (row.status !== "overload") continue;
      const candidates = center.buckets.filter(
        (other) => other.status === "underload"
          && other.bucketIndex !== row.bucketIndex
          && Math.abs(other.bucketIndex - row.bucketIndex) <= window,
      );
      if (candidates.length === 0) continue;
      const target = candidates.sort(
        (left, right) => Math.abs(left.bucketIndex - row.bucketIndex) - Math.abs(right.bucketIndex - row.bucketIndex)
          || left.utilizationPct - right.utilizationPct,
      )[0];
      const excess = Math.max(0, round3(row.loadMinutes - (row.capacityMinutes * overPct) / 100));
      const room = Math.max(0, round3((target.capacityMinutes * overPct) / 100 - target.loadMinutes));
      const movable = round3(Math.min(excess, room, Math.max(excess, room) / 2 || excess));
      if (movable <= 0) continue;
      levelingSuggestions.push({
        workCenterId: center.workCenterId,
        code: center.code,
        fromBucketIndex: row.bucketIndex,
        toBucketIndex: target.bucketIndex,
        movableMinutes: round3(excess),
        suggestedMinutes: round3(movable / 2),
        reason: `سطل ${row.bucketStart} با ${row.utilizationPct}٪ پربار است و سطل ${target.bucketStart} با ${target.utilizationPct}٪ ظرفیت خالی دارد`,
      });
    }
  }

  const totals = workCenters.reduce(
    (acc, center) => {
      acc.loadMinutes = round3(acc.loadMinutes + center.totalLoadMinutes);
      acc.capacityMinutes = round3(acc.capacityMinutes + center.totalCapacityMinutes);
      acc.overloadBucketCount += center.overloadBucketCount;
      acc.underloadBucketCount += center.underloadBucketCount;
      acc.idleBucketCount += center.buckets.filter((row) => row.status === "idle").length;
      return acc;
    },
    { loadMinutes: 0, capacityMinutes: 0, utilizationPct: 0, overloadBucketCount: 0, underloadBucketCount: 0, idleBucketCount: 0 },
  );
  totals.utilizationPct = totals.capacityMinutes > 0 ? round3((totals.loadMinutes / totals.capacityMinutes) * 100) : 0;

  return {
    buckets: buckets.map((bucket, index) => ({ bucketIndex: index, bucketStart: bucket.start, bucketEnd: bucket.end })),
    workCenters,
    totals,
    levelingSuggestions: levelingSuggestions.sort(
      (left, right) => right.suggestedMinutes - left.suggestedMinutes || left.workCenterId.localeCompare(right.workCenterId),
    ),
  };
}

/* ══════════════════ ۹. نسخهٔ تولید (Production Version — ۱۱.۹) ══════════════════ */

export interface ProductionVersionInput {
  versionId: string;
  partId: string;
  versionCode: string;
  bomRevision: string | null;
  routingRevision: string | null;
  workCenterId?: string | null;
  isActive: boolean;
  isDefault?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  /** اولویت دستی؛ کوچک‌تر یعنی اولویت بالاتر. */
  priority?: number;
}

/**
 * انتخاب نسخهٔ تولید.
 *
 * یک محصول می‌تواند چند مسیر ساخت و چند BOM داشته باشد (مثلاً خط A با نسخهٔ ۱
 * و خط B با نسخهٔ ۲). ترتیب انتخاب: نسخهٔ صریحاً خواسته‌شده → فیلتر خط/مرکز
 * کاری → بازهٔ اثر → نسخهٔ پیش‌فرض → اولویت. نسخهٔ غیرفعال یا خارج از بازه
 * هرگز انتخاب نمی‌شود.
 */
export function resolveProductionVersion(input: {
  versions: ProductionVersionInput[];
  partId: string;
  versionId?: string | null;
  workCenterId?: string | null;
  effectiveAt?: string | null;
}): ProductionVersionInput | null {
  const at = input.effectiveAt ? String(input.effectiveAt).slice(0, 10) : null;
  const candidates = input.versions.filter((version) => version.partId === input.partId && version.isActive !== false);
  if (candidates.length === 0) return null;

  if (input.versionId) {
    return candidates.find((version) => version.versionId === input.versionId) ?? null;
  }

  const inWindow = (version: ProductionVersionInput) => {
    if (!at) return true;
    const from = version.effectiveFrom ? String(version.effectiveFrom).slice(0, 10) : null;
    const to = version.effectiveTo ? String(version.effectiveTo).slice(0, 10) : null;
    if (from && at < from) return false;
    if (to && at > to) return false;
    return true;
  };

  const scoped = candidates.filter((version) => inWindow(version));
  if (scoped.length === 0) return null;

  const byLine = input.workCenterId
    ? scoped.filter((version) => !version.workCenterId || version.workCenterId === input.workCenterId)
    : scoped;
  const pool = byLine.length > 0 ? byLine : scoped;

  const preferred = pool.filter((version) => version.isDefault === true);
  const ranked = (preferred.length > 0 ? preferred : pool).slice().sort(
    (left, right) => (finite(left.priority, 999) - finite(right.priority, 999))
      || String(left.versionCode).localeCompare(String(right.versionCode)),
  );
  return ranked[0] ?? null;
}
