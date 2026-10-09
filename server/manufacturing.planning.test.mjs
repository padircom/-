import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeLeadTimeOverlap,
  analyzeOverlap,
  applyLotConstraints,
  buildTimeBuckets,
  bucketIndexOf,
  checkAtpPromise,
  computeAvailableToPromise,
  computeEconomicOrderQuantity,
  computeMasterSchedule,
  computeOpeningAvailableQty,
  computeSplitLots,
  isoWeekStart,
  LOT_SIZING_RULES,
  MANUFACTURING_PLANNING_MODEL_VERSION,
  ManufacturingPlanningError,
  resolvePeriodOrderQuantity,
  resolveTransferBatchQty,
  sizeLot,
  validateLotSizingPolicy,
} from "./mfgPlanLogic.js";

const HORIZON = "2026-10-05"; /* دوشنبه — شروع سطل هفتگی بدون جابه‌جایی */
const weeks = (count) => buildTimeBuckets({ horizonStart: HORIZON, bucketUnit: "week", bucketCount: count });
const L4L = { rule: "L4L" };

/* ═══════════════════════ سطل زمانی ═══════════════════════ */

test("mfgplan: سطل هفتگی از دوشنبهٔ ISO شروع می‌شود و پایان آن اختصاصی است", () => {
  assert.equal(isoWeekStart("2026-10-04"), "2026-09-28");
  const buckets = weeks(4);
  assert.deepEqual(buckets.map((bucket) => [bucket.start, bucket.end, bucket.days]), [
    ["2026-10-05", "2026-10-12", 7],
    ["2026-10-12", "2026-10-19", 7],
    ["2026-10-19", "2026-10-26", 7],
    ["2026-10-26", "2026-11-02", 7],
  ]);
  assert.equal(bucketIndexOf(buckets, "2026-10-12"), 1, "روز پایان سطل به سطل بعدی تعلق دارد");
  assert.equal(bucketIndexOf(buckets, "2026-11-02"), null, "تاریخ بیرون افق سطل ندارد");
  assert.equal(bucketIndexOf(buckets, "bad-date"), null);
});

test("mfgplan: سطل ماه روی مرز واقعی تقویم می‌نشیند و روزهایش متغیر است", () => {
  const buckets = buildTimeBuckets({ horizonStart: "2026-10-05", bucketUnit: "month", bucketCount: 3 });
  assert.deepEqual(buckets.map((bucket) => [bucket.start, bucket.days]), [
    ["2026-10-01", 31], ["2026-11-01", 30], ["2026-12-01", 31],
  ]);
});

test("mfgplan: تعداد سطل نامعتبر خطای دامنه می‌دهد نه جدول خالی", () => {
  assert.throws(() => buildTimeBuckets({ horizonStart: HORIZON, bucketUnit: "week", bucketCount: 0 }), ManufacturingPlanningError);
  assert.throws(() => buildTimeBuckets({ horizonStart: HORIZON, bucketUnit: "fortnight", bucketCount: 4 }), ManufacturingPlanningError);
});

/* ═══════════════════════ اندازه‌گذاری لات ═══════════════════════ */

test("mfgplan: EOQ از رابطهٔ √(2DS/H) می‌آید و هزینهٔ سالانه را تفکیک می‌کند", () => {
  const result = computeEconomicOrderQuantity({
    rule: "EOQ",
    annualDemandQty: 12000,
    orderingCost: 500000,
    holdingCostPerUnitPerYear: 25000,
    periodDays: 30,
  });
  assert.equal(result.rawEoq, 692.82);
  assert.equal(result.eoq, 693);
  assert.equal(result.ordersPerYear, 17.316);
  assert.equal(result.annualOrderingCost, 8658000);
  assert.equal(result.annualHoldingCost, 8662500);
  assert.equal(result.totalAnnualCost, 17320500);
  assert.equal(result.periodsCovered, 1);
  assert.deepEqual(result.notes, []);
});

test("mfgplan: EOQ بدون دادهٔ کافی عدد ساختگی نمی‌دهد و دلیلش را می‌گوید", () => {
  const result = computeEconomicOrderQuantity({ rule: "EOQ", annualDemandQty: 12000 });
  assert.equal(result.eoq, null);
  assert.equal(result.rawEoq, null);
  assert.equal(result.notes.length, 2, "نبود OrderingCost و HoldingCost هر دو گزارش می‌شوند");
  const issues = validateLotSizingPolicy({ rule: "EOQ", annualDemandQty: 12000 });
  assert.ok(issues.some((issue) => issue.includes("OrderingCost")));
});

test("mfgplan: قاعدهٔ L4L دقیقاً برابر نیاز خالص سفارش می‌دهد", () => {
  assert.equal(sizeLot(37.5, L4L).quantity, 37.5);
  assert.equal(sizeLot(0, L4L).quantity, 0);
  assert.equal(sizeLot(-5, L4L).quantity, 0);
});

test("mfgplan: قاعدهٔ FOQ لات ثابت را کف مقدار می‌گذارد", () => {
  assert.equal(sizeLot(30, { rule: "FOQ", fixedLotQty: 100 }).quantity, 100);
  assert.equal(sizeLot(150, { rule: "FOQ", fixedLotQty: 100 }).quantity, 150);
  assert.throws(() => sizeLot(30, { rule: "FOQ" }), ManufacturingPlanningError);
});

test("mfgplan: قاعدهٔ EOQ کمترین مقدار را از EOQ می‌گیرد", () => {
  const policy = { rule: "EOQ", annualDemandQty: 12000, orderingCost: 500000, holdingCostPerUnitPerYear: 25000 };
  assert.equal(sizeLot(100, policy).quantity, 693);
  assert.equal(sizeLot(900, policy).quantity, 900);
});

test("mfgplan: مضرب سفارش و حداقل/حداکثر لات روی مقدار اثر می‌گذارند", () => {
  assert.equal(applyLotConstraints(30, { orderMultiple: 25 }).quantity, 50);
  assert.equal(applyLotConstraints(50, { orderMultiple: 25 }).quantity, 50, "مقدار روی مضرب گرد نمی‌شود");
  assert.equal(applyLotConstraints(30, { minOrderQty: 200 }).quantity, 200);
  /* سقف لات عمداً رو‌به‌بالا گرد نمی‌شود؛ وگرنه از سقف سیاست عبور می‌کرد. */
  assert.equal(applyLotConstraints(100, { maxOrderQty: 40 }).quantity, 40);
  assert.equal(applyLotConstraints(100, { maxOrderQty: 40, orderMultiple: 15 }).quantity, 30);
  const sized = sizeLot(30, { rule: "L4L", orderMultiple: 25 });
  assert.deepEqual(sized.appliedConstraints, ["OrderMultiple=25"]);
});

test("mfgplan: POQ تعداد دورهٔ پوشش را از EOQ یا مقدار صریح می‌گیرد", () => {
  assert.equal(resolvePeriodOrderQuantity({ rule: "POQ", periodOrderQuantity: 3 }), 3);
  const derived = resolvePeriodOrderQuantity({
    rule: "POQ", annualDemandQty: 12000, orderingCost: 500000, holdingCostPerUnitPerYear: 25000, periodDays: 30,
  });
  assert.equal(derived, 1);
  assert.ok(LOT_SIZING_RULES.includes("POQ"));
  assert.equal(validateLotSizingPolicy({ rule: "UNKNOWN" }).length > 0, true);
});

/* ═══════════════════════ برنامهٔ اصلی تولید ═══════════════════════ */

const mpsDemand = [
  { requiredAt: "2026-10-06", quantity: 50, type: "sales-order", demandRef: "SO-1" },
  { requiredAt: "2026-10-14", quantity: 60, type: "sales-order", demandRef: "SO-2" },
  { requiredAt: "2026-10-21", quantity: 70, type: "contract", demandRef: "CT-1" },
  { requiredAt: "2026-10-28", quantity: 80, type: "sales-order", demandRef: "SO-3" },
];

test("mfgplan: جدول زمان‌مند MPS موجودی، نیاز خالص و آزادسازی را درست تصویر می‌کند", () => {
  const result = computeMasterSchedule({
    partId: "P1",
    uom: "ea",
    buckets: weeks(4),
    demand: mpsDemand,
    policy: L4L,
    onHandQty: 100,
    safetyStockQty: 20,
    leadTimeDays: 7,
  });
  assert.equal(result.modelVersion, MANUFACTURING_PLANNING_MODEL_VERSION);
  assert.equal(result.leadTimeBuckets, 1);
  assert.equal(result.openingAvailableQty, 100);
  assert.deepEqual(result.lines.map((line) => [
    line.grossRequirementQty, line.projectedOnHandBefore, line.netRequirementQty,
    line.plannedOrderReceiptQty, line.projectedOnHandAfter, line.plannedOrderReleaseAt,
  ]), [
    [50, 100, 0, 0, 50, null],
    [60, 50, 30, 30, 20, "2026-10-05"],
    [70, 20, 70, 70, 20, "2026-10-12"],
    [80, 20, 80, 80, 20, "2026-10-19"],
  ]);
  assert.equal(result.totals.grossRequirementQty, 260);
  assert.equal(result.totals.netRequirementQty, 180);
  assert.equal(result.totals.plannedOrderReceiptQty, 180);
  assert.equal(result.totals.firstShortageBucketStart, null);
  assert.deepEqual(result.lines[1].demandRefs, ["SO-2"]);
});

test("mfgplan: حصار تقاضا جلوی سفارش تازه را می‌گیرد و کمبود را گزارش می‌کند", () => {
  const result = computeMasterSchedule({
    partId: "P1",
    buckets: weeks(4),
    demand: mpsDemand,
    policy: L4L,
    onHandQty: 100,
    safetyStockQty: 20,
    demandTimeFenceBuckets: 2,
  });
  assert.deepEqual(result.lines.map((line) => [line.insideDemandTimeFence, line.plannedOrderReceiptQty, line.projectedOnHandAfter]), [
    [true, 0, 50],
    [true, 0, -10],
    [false, 100, 20],
    [false, 80, 20],
  ]);
  /* نیاز خالص سطل دوم ۳۰ بود ولی درون حصار تقاضا سفارشی ساخته نشد؛
   * سطل بعد همان ۳۰ را با نیاز خودش جمع می‌کند (۱۰۰). */
  assert.equal(result.lines[2].netRequirementQty, 100);
  assert.equal(result.totals.firstShortageBucketStart, "2026-10-12");
  assert.equal(result.totals.shortageQty, 30);
});

test("mfgplan: حصار برنامهٔ قطعی ردیف‌های درون حصار را Firm می‌کند", () => {
  const result = computeMasterSchedule({
    partId: "P1",
    buckets: weeks(4),
    demand: mpsDemand,
    policy: L4L,
    onHandQty: 100,
    safetyStockQty: 20,
    firmPlannedTimeFenceBuckets: 2,
  });
  assert.deepEqual(result.lines.map((line) => line.isFirm), [false, true, false, false]);
  assert.equal(result.firmPlannedTimeFenceBuckets, 2);
  /* حصار قطعی نمی‌تواند از حصار تقاضا کوتاه‌تر شود. */
  const both = computeMasterSchedule({
    partId: "P1", buckets: weeks(4), demand: mpsDemand, policy: L4L,
    demandTimeFenceBuckets: 3, firmPlannedTimeFenceBuckets: 1,
  });
  assert.equal(both.firmPlannedTimeFenceBuckets, 3);
});

test("mfgplan: مصرف پیش‌بینی با سفارش فروش در همان سطل، تقاضا را دوباره نمی‌شمارد", () => {
  const demand = [
    { requiredAt: "2026-10-06", quantity: 100, type: "forecast", demandRef: "FC-1" },
    { requiredAt: "2026-10-07", quantity: 40, type: "sales-order", demandRef: "SO-1" },
  ];
  const consumed = computeMasterSchedule({ partId: "P1", buckets: weeks(2), demand, policy: L4L, onHandQty: 0 });
  assert.equal(consumed.lines[0].consumedForecastQty, 40);
  assert.equal(consumed.lines[0].grossRequirementQty, 100);
  const notConsumed = computeMasterSchedule({
    partId: "P1", buckets: weeks(2), demand, policy: L4L, onHandQty: 0, consumeForecastWithSalesOrders: false,
  });
  assert.equal(notConsumed.lines[0].consumedForecastQty, 0);
  assert.equal(notConsumed.lines[0].grossRequirementQty, 140);
});

test("mfgplan: رسیدهای برنامه‌ریزی‌شده از نیاز خالص کسر می‌شوند", () => {
  const result = computeMasterSchedule({
    partId: "P1",
    buckets: weeks(2),
    demand: [{ requiredAt: "2026-10-06", quantity: 100, type: "sales-order" }],
    scheduledReceipts: [{ plannedAt: "2026-10-05", quantity: 60, sourceRef: "MO-1" }],
    policy: L4L,
    onHandQty: 0,
  });
  assert.equal(result.lines[0].scheduledReceiptQty, 60);
  assert.equal(result.lines[0].netRequirementQty, 40);
  assert.equal(result.lines[0].plannedOrderReceiptQty, 40);
  assert.equal(result.totals.scheduledReceiptQty, 60);
});

test("mfgplan: POQ نیاز چند سطل را در یک سفارش تجمیع می‌کند", () => {
  const result = computeMasterSchedule({
    partId: "P1",
    buckets: weeks(4),
    demand: mpsDemand,
    policy: { rule: "POQ", periodOrderQuantity: 2 },
    onHandQty: 0,
  });
  assert.equal(result.periodOrderQuantity, 2);
  /* سطل ۰ نیاز ۵۰ دارد و سطل ۱ هم ۶۰ → یک سفارش ۱۱۰؛ سطل ۱ دیگر سفارش ندارد.
   * سطل ۲ به همین ترتیب نیاز خودش و سطل ۳ را در یک سفارش ۱۵۰ جمع می‌کند. */
  assert.deepEqual(result.lines.map((line) => line.plannedOrderReceiptQty), [110, 0, 150, 0]);
  assert.equal(result.totals.plannedOrderReceiptQty, 260);
  assert.deepEqual(result.lines.map((line) => line.projectedOnHandAfter), [60, 0, 80, 0]);
});

test("mfgplan: سیاست لات نامعتبر پیش از محاسبه رد می‌شود", () => {
  assert.throws(
    () => computeMasterSchedule({ partId: "P1", buckets: weeks(2), demand: [], policy: { rule: "FOQ" }, onHandQty: 0 }),
    (error) => error instanceof ManufacturingPlanningError && error.code === "MFG_LOT_POLICY_INVALID",
  );
});

/* ═══════════════════════ ATP ═══════════════════════ */

const atpBuckets = [
  { bucketStart: "2026-10-05", bucketEnd: "2026-10-12", demandQty: 30, supplyQty: 0 },
  { bucketStart: "2026-10-12", bucketEnd: "2026-10-19", demandQty: 20, supplyQty: 50 },
  { bucketStart: "2026-10-19", bucketEnd: "2026-10-26", demandQty: 40, supplyQty: 0 },
  { bucketStart: "2026-10-26", bucketEnd: "2026-11-02", demandQty: 10, supplyQty: 60 },
];
const atpInput = { onHandQty: 100, reservedQty: 10, blockedQty: 5, safetyStockQty: 20, buckets: atpBuckets };

test("mfgplan: موجودی قابل تعهد آغازین رزرو، مسدود و ذخیرهٔ احتیاطی را کسر می‌کند", () => {
  assert.equal(computeOpeningAvailableQty(atpInput), 65);
  assert.equal(computeOpeningAvailableQty({ ...atpInput, includeSafetyStock: false }), 85);
  assert.equal(computeOpeningAvailableQty({ onHandQty: 10, reservedQty: 40 }), 0, "موجودی منفی گزارش نمی‌شود");
});

test("mfgplan: ATP تجمعی جمع جاری رسید منهای تقاضاست", () => {
  const atp = computeAvailableToPromise({ ...atpInput, mode: "cumulative" });
  assert.equal(atp.mode, "cumulative");
  assert.equal(atp.openingAvailableQty, 65);
  assert.deepEqual(atp.buckets.map((bucket) => [bucket.projectedOnHand, bucket.cumulativeAtp]), [
    [35, 35], [65, 65], [25, 25], [75, 75],
  ]);
  assert.equal(atp.totals.demandQty, 100);
  assert.equal(atp.totals.supplyQty, 110);
  assert.equal(atp.totals.firstNegativeBucketStart, null);
});

test("mfgplan: ATP گسسته فقط سطل دارای رسید را قابل تعهد می‌داند", () => {
  const atp = computeAvailableToPromise({ ...atpInput, mode: "discrete" });
  assert.deepEqual(atp.buckets.map((bucket) => bucket.availableToPromise), [35, 0, 0, 50]);
  /* سطل ۱ رسید ۵۰ دارد ولی تا رسید بعدی ۶۰ تقاضا مصرف می‌شود → صفر. */
  assert.equal(atp.totals.availableToPromiseQty, 85);
});

test("mfgplan: موجودی منفی در ATP اولین سطل بحرانی را علامت می‌زند", () => {
  const atp = computeAvailableToPromise({
    onHandQty: 10, safetyStockQty: 0, mode: "cumulative",
    buckets: [
      { bucketStart: "2026-10-05", bucketEnd: "2026-10-12", demandQty: 40, supplyQty: 0 },
      { bucketStart: "2026-10-12", bucketEnd: "2026-10-19", demandQty: 0, supplyQty: 100 },
    ],
  });
  assert.equal(atp.totals.firstNegativeBucketStart, "2026-10-05");
  assert.deepEqual(atp.buckets.map((bucket) => bucket.cumulativeAtp), [0, 70]);
});

test("mfgplan: بررسی تعهد سه حالت available/delayed/unavailable را تفکیک می‌کند", () => {
  const cumulative = computeAvailableToPromise({ ...atpInput, mode: "cumulative" });
  const onTime = checkAtpPromise({ atp: cumulative, requestedQty: 50, requestedAt: "2026-10-14" });
  assert.equal(onTime.status, "available");
  assert.equal(onTime.promisedAt, "2026-10-14");
  assert.equal(onTime.delayBuckets, 0);

  const delayed = checkAtpPromise({ atp: cumulative, requestedQty: 70, requestedAt: "2026-10-06", leadTimeDays: 2 });
  assert.equal(delayed.status, "delayed");
  assert.equal(delayed.sourceBucketStart, "2026-10-26");
  assert.equal(delayed.promisedAt, "2026-10-28", "تاریخ قابل تعهد با LeadTime جلو می‌رود");

  const impossible = checkAtpPromise({ atp: cumulative, requestedQty: 500, requestedAt: "2026-10-06" });
  assert.equal(impossible.status, "unavailable");
  assert.equal(impossible.promisedAt, null);
  assert.equal(impossible.promisedQty, 75, "بیشترین مقدار قابل تعهد در افق پیشنهاد می‌شود");
  assert.equal(impossible.shortageQty, 425);
});

test("mfgplan: بررسی ATP با مقدار نامعتبر خطای دامنه می‌دهد", () => {
  const atp = computeAvailableToPromise(atpInput);
  assert.throws(() => checkAtpPromise({ atp, requestedQty: 0, requestedAt: "2026-10-06" }), ManufacturingPlanningError);
  assert.throws(() => checkAtpPromise({ atp, requestedQty: 5, requestedAt: "not-a-date" }), ManufacturingPlanningError);
});

/* ═══════════════════════ تقسیم لات و هم‌پوشانی ═══════════════════════ */

test("mfgplan: تقسیم لات مقدار را بدون کسری پخش می‌کند", () => {
  const even = computeSplitLots({ orderQuantity: 100, splitLotCount: 4 });
  assert.deepEqual(even.lots.map((lot) => lot.quantity), [25, 25, 25, 25]);
  assert.equal(even.lots[3].cumulativeQuantity, 100);
  const uneven = computeSplitLots({ orderQuantity: 10, splitLotCount: 3 });
  assert.deepEqual(uneven.lots.map((lot) => lot.quantity), [3.333, 3.333, 3.334]);
  assert.equal(uneven.lots[2].cumulativeQuantity, 10);
});

test("mfgplan: لات انتقال به عنوان لات اول ثبت می‌شود و بقیه پخش می‌شوند", () => {
  const plan = computeSplitLots({ orderQuantity: 100, splitLotCount: 2, transferBatchQty: 20 });
  assert.deepEqual(plan.lots.map((lot) => lot.quantity), [20, 80]);
  assert.equal(plan.transferBatchQty, 20);
  const three = computeSplitLots({ orderQuantity: 100, splitLotCount: 3, transferBatchQty: 20 });
  assert.deepEqual(three.lots.map((lot) => lot.quantity), [20, 40, 40]);
  /* بدون تعیین لات انتقال هم دو لات لازم است تا هم‌پوشانی معنا داشته باشد. */
  const implied = computeSplitLots({ orderQuantity: 100, splitLotCount: 1, transferBatchQty: 20 });
  assert.equal(implied.effectiveSplitCount, 2);
  assert.ok(implied.notes.some((note) => note.includes("حداقل دو لات")));
});

test("mfgplan: حداقل اندازهٔ لات تعداد لات‌ها را کم می‌کند", () => {
  const plan = computeSplitLots({ orderQuantity: 100, splitLotCount: 5, minLotQty: 40 });
  assert.equal(plan.requestedSplitCount, 5);
  assert.equal(plan.effectiveSplitCount, 2);
  assert.deepEqual(plan.lots.map((lot) => lot.quantity), [50, 50]);
  assert.ok(plan.notes.some((note) => note.includes("کاهش داد")));
});

test("mfgplan: لات انتقال بزرگ‌تر از مقدار سفارش هم‌پوشانی نمی‌سازد", () => {
  const plan = computeSplitLots({ orderQuantity: 20, splitLotCount: 2, transferBatchQty: 50 });
  assert.ok(plan.notes.some((note) => note.includes("اثری ندارد")));
  assert.deepEqual(plan.lots.map((lot) => lot.quantity), [10, 10]);
  assert.throws(() => computeSplitLots({ orderQuantity: 0, splitLotCount: 2 }), ManufacturingPlanningError);
});

test("mfgplan: درصد هم‌پوشانی به لات انتقال تبدیل می‌شود", () => {
  const byQty = resolveTransferBatchQty({ quantity: 100, overlapAllowed: true, transferBatchQty: 20 });
  assert.equal(byQty, 20);
  const byPct = resolveTransferBatchQty({ quantity: 100, overlapAllowed: true, overlapPct: 80 });
  assert.equal(byPct, 20, "۸۰٪ هم‌پوشانی یعنی ۲۰٪ لات پیش از پایان منتقل شود");
  assert.equal(resolveTransferBatchQty({ quantity: 100, overlapAllowed: false, transferBatchQty: 20 }), null);
  assert.equal(resolveTransferBatchQty({ quantity: 100, overlapAllowed: true, overlapPct: 100 }), null);
});

test("mfgplan: تحلیل هم‌پوشانی زمان آماده‌شدن لات و دنبالهٔ هم‌پوشان را می‌دهد", () => {
  const analysis = analyzeOverlap({
    operationId: "OP-1", operationCode: "OP-10", sequenceNo: 10,
    quantity: 100, setupMinutes: 30, runMinutesPerUnit: 2, transferBatchQty: 60, overlapAllowed: true,
  });
  assert.equal(analysis.capacityMinutes, 230);
  assert.equal(analysis.transferReadyMinutes, 150, "Setup + 60 × 2 دقیقه");
  assert.equal(analysis.overlapTailMinutes, 80);
  const noOverlap = analyzeOverlap({ operationId: "OP-2", sequenceNo: 20, quantity: 100, setupMinutes: 30, runMinutesPerUnit: 2 });
  assert.equal(noOverlap.transferReadyMinutes, null);
  assert.equal(noOverlap.overlapTailMinutes, null);
});

test("mfgplan: LeadTime هم‌پوشان از دنبالهٔ عملیات قبلی صرفه‌جویی می‌کند", () => {
  const analysis = analyzeLeadTimeOverlap({
    operations: [
      { operationId: "OP-1", sequenceNo: 10, quantity: 100, setupMinutes: 30, runMinutesPerUnit: 2, queueMinutes: 10, moveMinutes: 5, transferBatchQty: 60, overlapAllowed: true },
      { operationId: "OP-2", sequenceNo: 20, quantity: 100, setupMinutes: 20, runMinutesPerUnit: 1, queueMinutes: 10, moveMinutes: 5 },
      { operationId: "OP-3", sequenceNo: 30, quantity: 100, setupMinutes: 10, runMinutesPerUnit: 1.5 },
    ],
    splitLotCountByOperation: { "OP-1": 2 },
  });
  assert.equal(analysis.baselineCapacityMinutes, 510);
  assert.equal(analysis.overlappedCapacityMinutes, 430);
  assert.equal(analysis.savedMinutes, 80);
  assert.equal(analysis.savedPct, 15.686);
  assert.equal(analysis.baselineLeadTimeMinutes, 540);
  assert.equal(analysis.overlappedLeadTimeMinutes, 460);
  assert.equal(analysis.leadTimeSavedMinutes, 80);
  assert.equal(analysis.leadTimeSavedPct, 14.815);
  assert.equal(analysis.scheduledSpanMinutes, null);
  assert.equal(analysis.operations[0].splitLotCount, 2);
  assert.equal(analysis.operations[1].splitLotCount, 1);
  assert.equal(analysis.operations[1].transferBatchQty, null);
});

test("mfgplan: بازهٔ واقعی برنامهٔ زمان‌بندی‌شده در تحلیل LeadTime گزارش می‌شود", () => {
  const analysis = analyzeLeadTimeOverlap({
    operations: [
      { operationId: "OP-1", sequenceNo: 10, quantity: 100, setupMinutes: 30, runMinutesPerUnit: 2 },
      { operationId: "OP-2", sequenceNo: 20, quantity: 100, setupMinutes: 20, runMinutesPerUnit: 1 },
    ],
    scheduledWindows: [
      { operationId: "OP-1", startAt: "2026-10-05T06:00:00.000Z", endAt: "2026-10-05T10:00:00.000Z" },
      { operationId: "OP-2", startAt: "2026-10-05T10:00:00.000Z", endAt: "2026-10-05T12:00:00.000Z" },
    ],
  });
  assert.equal(analysis.scheduledSpanMinutes, 360);
});
