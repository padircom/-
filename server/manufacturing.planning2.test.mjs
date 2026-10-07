/**
 * آزمون موتور فاز ۵ — بخش دوم: کد سطح پایین، Lead Time Offset، Pegging،
 * سفارش برنامه‌ریزی‌شده، CRP و نسخهٔ تولید (زیربخش‌های ۱۱.۳، ۱۱.۵، ۱۱.۶، ۱۱.۷، ۱۱.۹).
 *
 * همهٔ آزمون‌ها مستقیماً `./mfgPlanLogic.js` را وارد می‌کنند، یعنی همان باندلی که
 * `server/manufacturingApi.js` در زمان اجرا مصرف می‌کند — نه سورس TypeScript.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTimeBuckets,
  buildPegging,
  computeCapacityRequirements,
  computeLeadTimeOffsets,
  computeLowLevelCodes,
  computePlannedOrders,
  isoDateShift,
  resolveProductionVersion,
} from "./mfgPlanLogic.js";

/* ═══════════════════════ ۱۱.۵ — کد سطح پایین ═══════════════════════ */

test("۱۱.۵: کد سطح پایین، قطعهٔ چندمسیره را در عمیق‌ترین سطح می‌گذارد", () => {
  /* FG → A → B و FG → B (مستقیم). B هم در سطح ۱ هست و هم در سطح ۲؛
   * LLC باید ۲ باشد وگرنه نیاز B پیش از اعلام نیاز A حساب می‌شود. */
  const codes = computeLowLevelCodes({
    partIds: ["FG", "A", "B"],
    edges: [
      { parentPartId: "FG", componentPartId: "A", quantityPer: 1 },
      { parentPartId: "A", componentPartId: "B", quantityPer: 2 },
      { parentPartId: "FG", componentPartId: "B", quantityPer: 1 },
    ],
  });
  assert.equal(codes.get("FG"), 0);
  assert.equal(codes.get("A"), 1);
  assert.equal(codes.get("B"), 2, "B در عمیق‌ترین مسیر سطح ۲ است");
});

test("۱۱.۵: چرخه در BOM به‌جای حلقهٔ بی‌پایان خطا می‌دهد", () => {
  assert.throws(
    () => computeLowLevelCodes({
      partIds: ["X", "Y"],
      edges: [
        { parentPartId: "X", componentPartId: "Y", quantityPer: 1 },
        { parentPartId: "Y", componentPartId: "X", quantityPer: 1 },
      ],
    }),
    (err) => err.code === "MFG_BOM_CYCLE" || err.code === "MFG_BOM_DEPTH_LIMIT",
  );
});

test("۱۱.۵: Lead Time تجمیعی و offset هر سطح", () => {
  /* FG own=7، A own=12، B own=5.
   * تجمیعی: B=5، A=12+5=17، FG=7+17=24.
   * دسترس‌پذیری نسبت به سررسید FG: FG=0، A=0+7=7، B=7+12=19.
   * آزادسازی = دسترس‌پذیری + تجمیعی → هر سه ۲۴ (بدون slack در یک مسیر خطی). */
  const res = computeLeadTimeOffsets({
    rootPartIds: ["FG"],
    leadTimeDaysByPartId: { FG: 7, A: 12, B: 5 },
    edges: [
      { parentPartId: "FG", componentPartId: "A", quantityPer: 1 },
      { parentPartId: "A", componentPartId: "B", quantityPer: 2 },
    ],
  });
  const by = Object.fromEntries(res.parts.map((row) => [row.partId, row]));
  assert.equal(res.finishedGoodsLeadTimeDays, 24);
  assert.equal(by.B.cumulativeLeadTimeDays, 5);
  assert.equal(by.A.cumulativeLeadTimeDays, 17);
  assert.equal(by.FG.cumulativeLeadTimeDays, 24);
  assert.equal(by.FG.availabilityOffsetDays, 0);
  assert.equal(by.A.availabilityOffsetDays, 7);
  assert.equal(by.B.availabilityOffsetDays, 19);
  assert.equal(by.A.releaseOffsetDays, 24);
  assert.equal(by.B.releaseOffsetDays, 24);
  assert.deepEqual(res.levelOffsets.map((row) => [row.level, row.releaseOffsetDays]), [[0, 24], [1, 24], [2, 24]]);
  assert.equal(res.maxLowLevelCode, 2);
});

test("۱۱.۵: وقتی قطعه‌ای چند والد دارد زودترین نیاز حاکم است", () => {
  /* P زیر دو والد است: SLOW (own=20) و FAST (own=2). P باید برای SLOW
   * زودتر آماده باشد، پس availability آن ۲۰ است نه ۲. */
  const res = computeLeadTimeOffsets({
    rootPartIds: ["SLOW", "FAST"],
    leadTimeDaysByPartId: { SLOW: 20, FAST: 2, P: 3 },
    edges: [
      { parentPartId: "SLOW", componentPartId: "P", quantityPer: 1 },
      { parentPartId: "FAST", componentPartId: "P", quantityPer: 1 },
    ],
  });
  const p = res.parts.find((row) => row.partId === "P");
  assert.equal(p.availabilityOffsetDays, 20);
  assert.equal(p.cumulativeLeadTimeDays, 3);
  assert.equal(p.releaseOffsetDays, 23);
});

test("۱۱.۵: isoDateShift تاریخ را بدون اثر منطقهٔ زمانی جابه‌جا می‌کند", () => {
  assert.equal(isoDateShift("2026-10-05", -7), "2026-09-28");
  assert.equal(isoDateShift("2026-10-05", 0), "2026-10-05");
  assert.equal(isoDateShift("2026-03-01", -1), "2026-02-28");
});

/* ═══════════════════════ ۱۱.۶ — Pegging ═══════════════════════ */

const pegSupplies = [
  { partId: "RAW", supplyRef: "PO-RAW-1", quantity: 500, supplyType: "purchase" },
  { partId: "SUB", supplyRef: "PL-SUB-1", quantity: 100, supplyType: "planned" },
  { partId: "FG", supplyRef: "MO-FG-1", quantity: 50, supplyType: "production" },
];
const pegLinks = [
  { parentSupplyRef: "PL-SUB-1", componentSupplyRef: "PO-RAW-1", quantityPer: 5 },
  { parentSupplyRef: "MO-FG-1", componentSupplyRef: "PL-SUB-1", quantityPer: 2 },
];

test("۱۱.۶: pegging تک‌سطحی فقط والد مستقیم را نشان می‌دهد", () => {
  const res = buildPegging({ supplies: pegSupplies, links: pegLinks });
  assert.deepEqual(res.singleLevel["PO-RAW-1"].map((path) => path.chain[0].supplyRef), ["PL-SUB-1"]);
  assert.deepEqual(res.singleLevel["PL-SUB-1"].map((path) => path.chain[0].supplyRef), ["MO-FG-1"]);
  assert.deepEqual(res.singleLevel["MO-FG-1"], [], "ریشه والدی ندارد");
});

test("۱۱.۶: pegging چندسطحی تا محصول نهایی ردیابی می‌کند", () => {
  const res = buildPegging({ supplies: pegSupplies, links: pegLinks });
  const rawPaths = res.multiLevel["PO-RAW-1"];
  assert.equal(rawPaths.length, 1);
  assert.deepEqual(rawPaths[0].chain.map((step) => step.supplyRef), ["PO-RAW-1", "PL-SUB-1", "MO-FG-1"]);
  assert.deepEqual(rawPaths[0].chain.map((step) => step.partId), ["RAW", "SUB", "FG"]);
  assert.equal(rawPaths[0].chain[1].quantityPer, 5, "ضریب مصرف در زنجیره دیده می‌شود");
  assert.deepEqual(res.rootSupplyRefs, ["MO-FG-1"]);
});

test("۱۱.۶: pegging با دو ریشه، هر دو مسیر را گزارش می‌کند", () => {
  const res = buildPegging({
    supplies: [...pegSupplies, { partId: "FG2", supplyRef: "MO-FG-2", quantity: 10 }],
    links: [...pegLinks, { parentSupplyRef: "MO-FG-2", componentSupplyRef: "PL-SUB-1", quantityPer: 3 }],
  });
  const roots = res.multiLevel["PO-RAW-1"].map((path) => path.chain.at(-1).supplyRef).sort();
  assert.deepEqual(roots, ["MO-FG-1", "MO-FG-2"]);
});

/* ═══════════════════ ۱۱.۳ — سفارش برنامه‌ریزی‌شده ═══════════════════ */

const buckets = buildTimeBuckets({ horizonStart: "2026-10-05", bucketUnit: "week", bucketCount: 4 });

test("۱۱.۳: نیاز خالص با قاعدهٔ L4L به سفارش برنامه‌ریزی‌شده تبدیل می‌شود", () => {
  const orders = computePlannedOrders({
    partId: "P-1", partNo: "P-1", uom: "ea", buckets,
    netRequirementByBucket: [0, 30, 0, 45],
    policy: { rule: "L4L" },
    cumulativeLeadTimeDays: 7,
  });
  assert.equal(orders.length, 2);
  assert.deepEqual(orders.map((order) => [order.bucketIndex, order.quantity]), [[1, 30], [3, 45]]);
  assert.equal(orders[0].dueAt, "2026-10-12");
  assert.equal(orders[0].releaseAt, "2026-10-05", "آزادسازی به اندازهٔ زمان تحویل عقب‌تر می‌رود");
  assert.equal(orders[0].source, "mrp");
});

test("۱۱.۳: قاعدهٔ FOQ مقدار ثابت را حتی برای نیاز کوچک صادر می‌کند", () => {
  const orders = computePlannedOrders({
    partId: "P-1", buckets,
    netRequirementByBucket: [5, 0, 0, 0],
    policy: { rule: "FOQ", fixedLotQty: 100 },
  });
  assert.equal(orders.length, 1);
  assert.equal(orders[0].quantity, 100);
});

test("۱۱.۳: قاعدهٔ POQ نیاز چند سطل را در یک سفارش تجمیع می‌کند", () => {
  const orders = computePlannedOrders({
    partId: "P-1", buckets,
    netRequirementByBucket: [10, 20, 30, 40],
    policy: { rule: "POQ", periodOrderQuantity: 2 },
  });
  assert.deepEqual(orders.map((order) => [order.bucketIndex, order.quantity]), [[0, 30], [2, 70]]);
});

test("۱۱.۳: حصار تقاضا از صدور سفارش در سطل‌های نخست جلوگیری می‌کند", () => {
  const orders = computePlannedOrders({
    partId: "P-1", buckets,
    netRequirementByBucket: [10, 20, 30, 40],
    policy: { rule: "L4L" },
    demandTimeFenceBuckets: 2,
  });
  assert.deepEqual(orders.map((order) => order.bucketIndex), [2, 3]);
});

test("۱۱.۳: pegging سفارش برنامه‌ریزی‌شده به منابع نیازش وصل می‌شود", () => {
  const orders = computePlannedOrders({
    partId: "P-1", buckets,
    netRequirementByBucket: [0, 20, 0, 0],
    policy: { rule: "L4L" },
    peggedSupplyRefsByBucket: { 1: ["MO-FG-1", "MO-FG-2"] },
  });
  assert.deepEqual(orders[0].peggedSupplyRefs, ["MO-FG-1", "MO-FG-2"]);
});

/* ═══════════════════════ ۱۱.۷ — CRP ═══════════════════════ */

test("۱۱.۷: بار در برابر ظرفیت و شناسایی پربار/کم‌بار", () => {
  const res = computeCapacityRequirements({
    buckets,
    overloadThresholdPct: 100,
    underloadThresholdPct: 60,
    workCenters: [{ workCenterId: "wc-1", code: "WC-1", availableMinutesByBucket: [100, 100, 100, 100] }],
    operations: [
      { operationId: "op-1", workCenterId: "wc-1", capacityMinutes: 150, plannedStartAt: "2026-10-05", plannedEndAt: "2026-10-05" },
      { operationId: "op-2", workCenterId: "wc-1", capacityMinutes: 20, plannedStartAt: "2026-10-26", plannedEndAt: "2026-10-26" },
    ],
  });
  const center = res.workCenters[0];
  assert.deepEqual(center.buckets.map((row) => row.loadMinutes), [150, 0, 0, 20]);
  assert.deepEqual(center.buckets.map((row) => row.status), ["overload", "underload", "underload", "underload"]);
  assert.equal(center.buckets[0].utilizationPct, 150);
  assert.equal(center.buckets[0].surplusMinutes, -50);
  assert.equal(center.overloadBucketCount, 1);
  assert.equal(res.totals.loadMinutes, 170);
  assert.equal(res.totals.capacityMinutes, 400);
});

test("۱۱.۷: عملیات چندسطلی بارش بین سطل‌ها تقسیم می‌شود", () => {
  const res = computeCapacityRequirements({
    buckets,
    workCenters: [{ workCenterId: "wc-1", code: "WC-1", availableMinutesByBucket: [1000, 1000, 1000, 1000] }],
    operations: [
      { operationId: "op-1", workCenterId: "wc-1", capacityMinutes: 400, plannedStartAt: "2026-10-05", plannedEndAt: "2026-10-26" },
    ],
  });
  assert.deepEqual(res.workCenters[0].buckets.map((row) => row.loadMinutes), [100, 100, 100, 100]);
});

test("۱۱.۷: پیشنهاد تسطیح بار از سطل پربار به نزدیک‌ترین سطل کم‌بار", () => {
  const res = computeCapacityRequirements({
    buckets,
    overloadThresholdPct: 100,
    underloadThresholdPct: 60,
    levelingWindowBuckets: 4,
    workCenters: [{ workCenterId: "wc-1", code: "WC-1", availableMinutesByBucket: [100, 100, 100, 100] }],
    operations: [
      { operationId: "op-1", workCenterId: "wc-1", capacityMinutes: 150, plannedStartAt: "2026-10-05", plannedEndAt: "2026-10-05" },
    ],
  });
  assert.ok(res.levelingSuggestions.length >= 1, "دست‌کم یک پیشنهاد تسطیح");
  const suggestion = res.levelingSuggestions[0];
  assert.equal(suggestion.fromBucketIndex, 0);
  assert.equal(suggestion.toBucketIndex, 1, "نزدیک‌ترین سطل کم‌بار");
  assert.equal(suggestion.movableMinutes, 50);
  assert.ok(suggestion.suggestedMinutes > 0 && suggestion.suggestedMinutes <= 50);
});

test("۱۱.۷: مرکز کاری بدون ظرفیت و بدون بار idle است نه کم‌بار", () => {
  const res = computeCapacityRequirements({
    buckets,
    workCenters: [{ workCenterId: "wc-9", code: "WC-9", availableMinutesByBucket: [0, 0, 0, 0] }],
    operations: [],
  });
  assert.deepEqual(res.workCenters[0].buckets.map((row) => row.status), ["idle", "idle", "idle", "idle"]);
  assert.equal(res.totals.idleBucketCount, 4);
});

/* ═══════════════════ ۱۱.۹ — نسخهٔ تولید ═══════════════════ */

const versions = [
  { versionId: "v-1", partId: "P-1", versionCode: "V1-LINE-A", bomRevision: "A", routingRevision: "A", workCenterId: "wc-a", isActive: true, isDefault: true, priority: 1 },
  { versionId: "v-2", partId: "P-1", versionCode: "V2-LINE-B", bomRevision: "B", routingRevision: "B", workCenterId: "wc-b", isActive: true, priority: 2 },
  { versionId: "v-3", partId: "P-1", versionCode: "V3-OLD", bomRevision: "C", routingRevision: "C", workCenterId: null, isActive: false, priority: 0 },
  { versionId: "v-4", partId: "P-2", versionCode: "V1-OTHER", bomRevision: "A", routingRevision: "A", workCenterId: null, isActive: true },
];

test("۱۱.۹: نسخهٔ صریحاً خواسته‌شده بدون توجه به پیش‌فرض انتخاب می‌شود", () => {
  assert.equal(resolveProductionVersion({ versions, partId: "P-1", versionId: "v-2" }).versionId, "v-2");
});

test("۱۱.۹: نسخهٔ غیرفعال هرگز انتخاب نمی‌شود", () => {
  assert.equal(resolveProductionVersion({ versions, partId: "P-1", versionId: "v-3" }), null);
  assert.equal(resolveProductionVersion({ versions, partId: "P-1" }).versionId, "v-1", "پیش‌فرض فعال");
});

test("۱۱.۹: فیلتر خط تولید، نسخهٔ همان مرکز کاری را برمی‌گرداند", () => {
  assert.equal(resolveProductionVersion({ versions, partId: "P-1", workCenterId: "wc-b" }).versionId, "v-2");
});

test("۱۱.۹: بازهٔ اثر و اولویت دستی رعایت می‌شود", () => {
  const windowed = [
    { versionId: "w-1", partId: "P-3", versionCode: "W1", bomRevision: "A", routingRevision: "A", isActive: true, effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30", priority: 1 },
    { versionId: "w-2", partId: "P-3", versionCode: "W2", bomRevision: "B", routingRevision: "B", isActive: true, effectiveFrom: "2026-07-01", effectiveTo: null, priority: 9 },
  ];
  assert.equal(resolveProductionVersion({ versions: windowed, partId: "P-3", effectiveAt: "2026-03-15" }).versionId, "w-1");
  assert.equal(resolveProductionVersion({ versions: windowed, partId: "P-3", effectiveAt: "2026-10-05" }).versionId, "w-2", "اولیت پایین‌تر اما در بازه");
});

test("۱۱.۹: قطعهٔ دیگر هیچ نسخه‌ای از این قطعه نمی‌گیرد", () => {
  assert.equal(resolveProductionVersion({ versions, partId: "P-9" }), null);
  assert.equal(resolveProductionVersion({ versions, partId: "P-2" }).versionId, "v-4");
});
