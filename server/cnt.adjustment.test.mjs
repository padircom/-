/* آزمون موتور تعدیل و مابه‌التفاوت (D5).
 *
 * تمرکز بر سه چیزی که در ممیزی صورت‌وضعیت واقعاً برگشت می‌خورد: مبنای
 * تعدیل (دوره‌ای نه تجمعی)، اعتبار رسمی شاخص، و تفکیک تعدیل شاخص از
 * مابه‌التفاوت مصالح تا یک افزایش قیمت دو بار پرداخت نشود. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustmentBatch,
  cumulativeAdjustment,
  findIndex,
  materialDiff,
  priceAdjustment,
} from "./cntLogic.js";

const CATALOG = [
  { IndexPeriod: "1404-Q1", ChapterCode: "03", IndexValue: 100, Status: "published" },
  { IndexPeriod: "1405-Q1", ChapterCode: "03", IndexValue: 130, Status: "published" },
  { IndexPeriod: "1405-Q1", ChapterCode: "04", IndexValue: 90, Status: "published" },
  { IndexPeriod: "1404-Q1", ChapterCode: "04", IndexValue: 100, Status: "published" },
  { IndexPeriod: "1405-Q2", ChapterCode: "03", IndexValue: 150, Status: "draft" },
  { IndexPeriod: "1405-Q3", ChapterCode: "03", IndexValue: 160, Status: "superseded" },
];

/* ───────────────────────── محاسبهٔ پایه ───────────────────────── */

test("تعدیل صعودی: ضریب و مبلغ درست حساب می‌شود", () => {
  const r = priceAdjustment({ chapterCode: "03", workAmount: 1_000_000, baseIndex: 100, periodIndex: 130 });
  assert.equal(r.adjustmentFactor, 1.3);
  assert.equal(r.adjustmentAmount, 300_000);
  assert.equal(r.direction, "up");
  assert.equal(r.appliedRatePct, 100);
});

test("ضریب اعمال قراردادی مبلغ را کاهش می‌دهد", () => {
  const r = priceAdjustment({ chapterCode: "03", workAmount: 1_000_000, baseIndex: 100, periodIndex: 130, appliedRatePct: 95 });
  assert.equal(r.adjustmentAmount, 285_000);
  assert.match(r.calcNoteFa, /ضریب اعمال ۹۵|95/);
});

test("تعدیل نزولی منفی می‌ماند و به صفر بریده نمی‌شود", () => {
  /* وقتی شاخص پایین می‌آید مابه‌التفاوت به نفع کارفرماست. */
  const r = priceAdjustment({ chapterCode: "04", workAmount: 1_000_000, baseIndex: 100, periodIndex: 90 });
  assert.equal(r.adjustmentAmount, -100_000);
  assert.equal(r.direction, "down");
});

test("شاخص بدون تغییر، تعدیل صفر می‌دهد", () => {
  const r = priceAdjustment({ chapterCode: "03", workAmount: 500_000, baseIndex: 120, periodIndex: 120 });
  assert.equal(r.adjustmentAmount, 0);
  assert.equal(r.direction, "flat");
});

test("شاخص مبنای صفر محاسبه را بی‌نهایت نمی‌کند", () => {
  const r = priceAdjustment({ chapterCode: "03", workAmount: 1_000_000, baseIndex: 0, periodIndex: 130 });
  assert.equal(r.adjustmentFactor, 1);
  assert.equal(r.adjustmentAmount, 0);
  assert.ok(Number.isFinite(r.adjustmentAmount));
  assert.match(r.calcNoteFa, /شاخص مبنا ثبت نشده/);
});

/* ───────────────────────── اعتبار شاخص (G-04) ───────────────────────── */

test("شاخص منتشرشده قابل استفاده است", () => {
  const r = findIndex(CATALOG, "1405-Q1", "03");
  assert.equal(r.usable, true);
  assert.equal(r.index.IndexValue, 130);
});

test("شاخص پیش‌نویس مبنای محاسبهٔ مصوب نیست", () => {
  const r = findIndex(CATALOG, "1405-Q2", "03");
  assert.equal(r.found, true);
  assert.equal(r.usable, false);
  assert.equal(r.code, "E-CNT-INDEX-NOT-PUBLISHED");
});

test("شاخص بازنگری‌شده هم رد می‌شود", () => {
  const r = findIndex(CATALOG, "1405-Q3", "03");
  assert.equal(r.usable, false);
  assert.equal(r.code, "E-CNT-INDEX-NOT-PUBLISHED");
});

test("شاخص ناموجود با کد مشخص برمی‌گردد", () => {
  const r = findIndex(CATALOG, "1499-Q9", "03");
  assert.equal(r.found, false);
  assert.equal(r.code, "E-CNT-NO-INDEX");
});

test("اگر هم پیش‌نویس و هم منتشرشده باشد، منتشرشده انتخاب می‌شود", () => {
  const cat = [
    { IndexPeriod: "1405-Q4", ChapterCode: "07", IndexValue: 200, Status: "draft" },
    { IndexPeriod: "1405-Q4", ChapterCode: "07", IndexValue: 190, Status: "published" },
  ];
  const r = findIndex(cat, "1405-Q4", "07");
  assert.equal(r.usable, true);
  assert.equal(r.index.IndexValue, 190);
});

/* ───────────────────────── دستهٔ چندفصلی ───────────────────────── */

test("تعدیل چند فصل با هم جمع می‌شود", () => {
  const r = adjustmentBatch({
    chapters: [
      { chapterCode: "03", workAmount: 1_000_000 },
      { chapterCode: "04", workAmount: 500_000 },
    ],
    catalog: CATALOG,
    indexPeriod: "1405-Q1",
    baseIndexPeriod: "1404-Q1",
  });
  /* فصل ۰۳: +۳۰۰٬۰۰۰ · فصل ۰۴: −۵۰٬۰۰۰ */
  assert.equal(r.totalAdjustment, 250_000);
  assert.equal(r.totalWork, 1_500_000);
  assert.equal(r.usable, true);
  assert.equal(r.blocked.length, 0);
});

test("فصل با شاخص منتشرنشده کل دسته را غیرقابل استفاده می‌کند", () => {
  const r = adjustmentBatch({
    chapters: [
      { chapterCode: "03", workAmount: 1_000_000 },
      { chapterCode: "99", workAmount: 500_000 },
    ],
    catalog: CATALOG,
    indexPeriod: "1405-Q1",
    baseIndexPeriod: "1404-Q1",
  });
  assert.equal(r.usable, false, "دستهٔ ناقص نباید قابل تأیید باشد");
  assert.equal(r.blocked.length, 1);
  assert.equal(r.blocked[0].chapterCode, "99");
  /* فصل سالم همچنان محاسبه شده تا کاربر ببیند چقدر از کار انجام شده. */
  assert.equal(r.rows.length, 1);
});

test("درصد مؤثر تعدیل نسبت به کارکرد گزارش می‌شود", () => {
  const r = adjustmentBatch({
    chapters: [{ chapterCode: "03", workAmount: 1_000_000 }],
    catalog: CATALOG,
    indexPeriod: "1405-Q1",
    baseIndexPeriod: "1404-Q1",
  });
  assert.equal(r.effectivePct, 30);
});

test("دستهٔ خالی قابل استفاده نیست", () => {
  const r = adjustmentBatch({ chapters: [], catalog: CATALOG, indexPeriod: "1405-Q1", baseIndexPeriod: "1404-Q1" });
  assert.equal(r.usable, false);
  assert.equal(r.totalAdjustment, 0);
});

/* ───────────────────────── تجمعی ───────────────────────── */

test("تعدیل تجمعی جمع دوره‌هاست و مصوب از معلق جدا می‌شود", () => {
  const r = cumulativeAdjustment([
    { AdjustmentAmount: 100_000, Status: "approved" },
    { AdjustmentAmount: 50_000, Status: "approved" },
    { AdjustmentAmount: 30_000, Status: "draft" },
  ]);
  assert.equal(r.total, 180_000);
  assert.equal(r.approvedTotal, 150_000);
  assert.equal(r.pendingTotal, 30_000);
});

test("تعدیل منفی دوره در تجمعی درست کسر می‌شود", () => {
  const r = cumulativeAdjustment([
    { AdjustmentAmount: 100_000, Status: "approved" },
    { AdjustmentAmount: -40_000, Status: "approved" },
  ]);
  assert.equal(r.approvedTotal, 60_000);
});

/* ───────────────────────── مابه‌التفاوت مصالح ───────────────────────── */

test("مابه‌التفاوت مصالح از تفاوت نرخ ضرب در مقدار می‌آید", () => {
  const r = materialDiff({
    materialCode: "STL-A3",
    materialNameFa: "میلگرد آجدار",
    quantity: 120,
    baseRate: 300_000,
    periodRate: 380_000,
  });
  assert.equal(r.rateDelta, 80_000);
  assert.equal(r.diffAmount, 9_600_000);
  assert.equal(r.direction, "up");
});

test("کاهش نرخ مصالح مابه‌التفاوت منفی می‌دهد", () => {
  const r = materialDiff({
    materialCode: "CEM", materialNameFa: "سیمان",
    quantity: 100, baseRate: 200_000, periodRate: 180_000,
  });
  assert.equal(r.diffAmount, -2_000_000);
  assert.equal(r.direction, "down");
});
