/**
 * آزمون وزن توافقی لامپ‌سام.
 *
 * مبلغ آزمون‌ها ۱۶۷٬۰۰۰ (میلیون دلار) است — همان عددی که کاربر داد —
 * چون خطاهای گرد کردن و نشت درصد فقط در مقیاس واقعی خودشان را نشان
 * می‌دهند. با مبلغ ۱۰۰ هیچ‌کدام از این آزمون‌ها معنا نداشت.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  LUMPSUM_VERSION,
  EPC_PHASES,
  EPCC_PHASES,
  phasesFor,
  roundMoney,
  roundPct,
  WEIGHT_SUM_TOLERANCE,
  checkWeightSum,
  computeAbsoluteWeights,
  allocateCost,
  computeEarned,
  seedTypicalWeights,
  normalizeToHundred,
} from "./lswLogic.js";

/** مبلغ قرارداد واقعی پروژه. */
const AMOUNT = 167000;

test("lsw: نسخهٔ موتور اعلام شده است", () => {
  assert.equal(LUMPSUM_VERSION, "lsw-v1");
});

/* ══════════════════ فازها ══════════════════ */

test("lsw: EPC سه فاز دارد و EPCC چهار فاز", () => {
  assert.equal(EPC_PHASES.length, 3);
  assert.equal(EPCC_PHASES.length, 4);
});

test("lsw: تفاوت EPCC افزودن راه‌اندازی است", () => {
  const epc = new Set(EPC_PHASES.map((p) => p.code));
  const epcc = new Set(EPCC_PHASES.map((p) => p.code));
  assert.equal(epc.has("CM"), false);
  assert.equal(epcc.has("CM"), true);
});

test("lsw: جمع درصد پیشنهادی هر دو نوع دقیقاً ۱۰۰ است", () => {
  /* اگر جدول پیشنهادی خودش ۱۰۰ نشود، کاربر از یک فرم نامعتبر شروع
   * می‌کند و اولین چیزی که می‌بیند خطاست. */
  for (const type of ["EPC", "EPCC"]) {
    const sum = phasesFor(type).reduce((s, p) => s + p.typicalPct, 0);
    assert.equal(sum, 100, `${type} جمعش ${sum} است`);
  }
});

test("lsw: نوع ناشناخته به EPC می‌افتد", () => {
  assert.equal(phasesFor("XYZ").length, 3);
});

/* ══════════════════ گیت جمع وزن ══════════════════ */

test("lsw: جمع دقیقاً ۱۰۰ پذیرفته می‌شود", () => {
  const r = checkWeightSum([{ weightPct: 12 }, { weightPct: 48 }, { weightPct: 40 }], AMOUNT);
  assert.equal(r.ok, true);
  assert.equal(r.sum, 100);
});

test("lsw: کسری دو درصد رد می‌شود و مبلغ گم‌شده را می‌گوید", () => {
  /* ۲٪ از ۱۶۷۰۰۰ برابر ۳۳۴۰ است — عددی که بدون این گیت بی‌صدا گم
   * می‌شد. */
  const r = checkWeightSum([{ weightPct: 12 }, { weightPct: 48 }, { weightPct: 38 }], AMOUNT);
  assert.equal(r.ok, false);
  assert.equal(r.sum, 98);
  assert.equal(r.deltaAmount, -3340);
  assert.ok(r.messageFa.includes("کمتر از"));
});

test("lsw: بیش‌برآورد هم رد می‌شود", () => {
  const r = checkWeightSum([{ weightPct: 60 }, { weightPct: 45 }], AMOUNT);
  assert.equal(r.ok, false);
  assert.ok(r.deltaAmount > 0);
  assert.ok(r.messageFa.includes("بیش از"));
});

test("lsw: وزن تعیین‌نشده با صفر یکی نیست", () => {
  /* صفر ادعاست، null اعتراف. اگر null صفر فرض شود، بسته‌ای که هنوز
   * توافق نشده به‌عنوان «بدون ارزش» وارد محاسبه می‌شود. */
  const r = checkWeightSum([{ weightPct: 60 }, { weightPct: 40 }, { weightPct: null }], AMOUNT);
  assert.equal(r.ok, false);
  assert.equal(r.missingCount, 1);
  assert.ok(r.messageFa.includes("درصد توافقی ندارد"));
});

test("lsw: فهرست خالی معتبر نیست", () => {
  const r = checkWeightSum([], AMOUNT);
  assert.equal(r.ok, false);
  assert.ok(r.messageFa.includes("هیچ بسته"));
});

test("lsw: خطای گرد کردن در آستانه پذیرفته می‌شود", () => {
  const third = roundPct(100 / 3);
  const r = checkWeightSum([{ weightPct: third }, { weightPct: third }, { weightPct: third }], AMOUNT);
  assert.ok(Math.abs(r.deltaPct) <= WEIGHT_SUM_TOLERANCE);
  assert.equal(r.ok, true);
});

test("lsw: آستانه تنگ است چون هر صدم درصد میلیون‌ها دلار است", () => {
  /* ۰٫۱٪ از ۱۶۷۰۰۰ برابر ۱۶۷ است — رقمی که نباید نادیده گرفته شود. */
  const r = checkWeightSum([{ weightPct: 50 }, { weightPct: 49.9 }], AMOUNT);
  assert.equal(r.ok, false);
});

/* ══════════════════ وزن مطلق ══════════════════ */

const TREE = [
  { code: "E", parentCode: null, titleFa: "مهندسی", weightPct: 10, basis: "agreed" },
  { code: "P", parentCode: null, titleFa: "تدارکات", weightPct: 50, basis: "agreed" },
  { code: "C", parentCode: null, titleFa: "اجرا", weightPct: 40, basis: "agreed" },
  { code: "C.1", parentCode: "C", titleFa: "خاکی", weightPct: 25, basis: "agreed" },
  { code: "C.2", parentCode: "C", titleFa: "بتنی", weightPct: 75, basis: "agreed" },
];

test("lsw: وزن مطلق حاصل‌ضرب زنجیرهٔ نیاکان است", () => {
  const w = computeAbsoluteWeights(TREE);
  const byCode = Object.fromEntries(w.map((x) => [x.code, x]));
  assert.equal(byCode["C"].weightValue, 40);
  /* ۷۵٪ از ۴۰٪ یعنی ۳۰٪ کل پروژه. */
  assert.equal(byCode["C.2"].weightValue, 30);
  assert.equal(byCode["C.1"].weightValue, 10);
});

test("lsw: عمق از زنجیرهٔ والد درمی‌آید", () => {
  const w = computeAbsoluteWeights(TREE);
  assert.equal(w.find((x) => x.code === "E").depth, 1);
  assert.equal(w.find((x) => x.code === "C.2").depth, 2);
});

test("lsw: جمع وزن مطلق برگ‌ها ۱۰۰ می‌شود", () => {
  const w = computeAbsoluteWeights(TREE);
  const leaves = ["E", "P", "C.1", "C.2"];
  const sum = roundPct(w.filter((x) => leaves.includes(x.code)).reduce((s, x) => s + x.weightValue, 0));
  assert.equal(sum, 100);
});

test("lsw: حلقهٔ والد برنامه را قفل نمی‌کند", () => {
  /* A والد B و B والد A. بدون نگهبان، بازگشت بی‌پایان می‌شود و برگه
   * بدون هیچ پیامی می‌ماسد. */
  const loop = [
    { code: "A", parentCode: "B", titleFa: "الف", weightPct: 50, basis: "agreed" },
    { code: "B", parentCode: "A", titleFa: "ب", weightPct: 50, basis: "agreed" },
  ];
  const w = computeAbsoluteWeights(loop);
  assert.equal(w.length, 2);
});

test("lsw: والد ناموجود گره را صفر می‌کند نه اینکه بشکند", () => {
  const orphan = [{ code: "X", parentCode: "GHOST", titleFa: "یتیم", weightPct: 100, basis: "agreed" }];
  const w = computeAbsoluteWeights(orphan);
  assert.equal(w[0].weightValue, 0);
});

/* ══════════════════ درصد به پول ══════════════════ */

test("lsw: مبلغ هر بسته از درصد مطلق درمی‌آید", () => {
  const alloc = allocateCost(
    [{ code: "E", weightValue: 10 }, { code: "P", weightValue: 50 }, { code: "C", weightValue: 40 }],
    AMOUNT,
  );
  const byCode = Object.fromEntries(alloc.rows.map((r) => [r.code, r.amount]));
  assert.equal(byCode["E"], 16700);
  assert.equal(byCode["P"], 83500);
  assert.equal(byCode["C"], 66800);
});

test("lsw: جمع مبالغ دقیقاً برابر مبلغ قرارداد است", () => {
  const alloc = allocateCost(
    [{ code: "E", weightValue: 10 }, { code: "P", weightValue: 50 }, { code: "C", weightValue: 40 }],
    AMOUNT,
  );
  assert.equal(alloc.allocated, AMOUNT);
});

test("lsw: باقی‌ماندهٔ گرد کردن جبران می‌شود", () => {
  /* تقسیم بر سه، سه عدد اعشاری می‌دهد که جمعشان با اصل نمی‌خواند. */
  const third = roundPct(100 / 3);
  const alloc = allocateCost(
    [{ code: "A", weightValue: third }, { code: "B", weightValue: third }, { code: "C", weightValue: third }],
    AMOUNT,
  );
  assert.equal(alloc.allocated, AMOUNT);
});

test("lsw: جبران به بزرگ‌ترین بسته می‌رود", () => {
  /* اثر نسبی خطا آنجا کمترین است؛ پخش کردنش خطا را همه‌جا می‌نشاند.
   *
   * این سه وزن روی مبلغ ۱۶۷۰۰۰ واقعاً یک سنت اضافه تولید می‌کنند:
   *   18555.54 + 74222.15 + 74222.32 = 167000.01
   * بدون جبران، جمع صورت‌وضعیت یک سنت از قرارداد بیشتر می‌شد. */
  const alloc = allocateCost(
    [
      { code: "small", weightValue: 11.1111 },
      { code: "mid", weightValue: 44.4444 },
      { code: "big", weightValue: 44.4445 },
    ],
    AMOUNT,
  );
  assert.equal(alloc.allocated, AMOUNT);
  assert.notEqual(alloc.roundingFixApplied, 0);

  /* بزرگ‌ترین ردیف تفاوت را جذب کرده است. */
  const big = alloc.rows.reduce((a, b) => (b.amount > a.amount ? b : a));
  assert.equal(big.code, "big");

  /* ردیف‌های دیگر دست‌نخورده مانده‌اند. */
  const small = alloc.rows.find((r) => r.code === "small");
  assert.equal(small.amount, roundMoney((11.1111 / 100) * AMOUNT));
});

test("lsw: مبلغ صفر خطای صریح می‌دهد", () => {
  const alloc = allocateCost([{ code: "A", weightValue: 100 }], 0);
  assert.equal(alloc.rows.length, 0);
  assert.ok(alloc.warningsFa.some((w) => w.includes("مبلغ قرارداد")));
});

test("lsw: شمردن والد و فرزند با هم هشدار می‌دهد", () => {
  /* اگر هر دو تخصیص بگیرند، مبلغ دو بار حساب می‌شود. */
  const alloc = allocateCost(
    [{ code: "C", weightValue: 40 }, { code: "C.1", weightValue: 10 }, { code: "C.2", weightValue: 30 }, { code: "E", weightValue: 10 }, { code: "P", weightValue: 50 }],
    AMOUNT,
  );
  assert.ok(alloc.warningsFa.some((w) => w.includes("گره‌های میانی")));
});

test("lsw: وزن غلط، جبران گرد کردن را فعال نمی‌کند", () => {
  /* پنهان کردن اختلاف واقعی، خطا را می‌پوشاند. */
  const alloc = allocateCost([{ code: "A", weightValue: 90 }], AMOUNT);
  assert.equal(alloc.roundingFixApplied, 0);
  assert.notEqual(alloc.allocated, AMOUNT);
});

/* ══════════════════ پیشرفت و ارزش کسب‌شده ══════════════════ */

test("lsw: پیشرفت کل از وزن مطلق حساب می‌شود", () => {
  const weights = [{ code: "E", weightValue: 10 }, { code: "P", weightValue: 50 }, { code: "C", weightValue: 40 }];
  const r = computeEarned(weights, [
    { code: "E", physicalPct: 100 },
    { code: "P", physicalPct: 50 },
    { code: "C", physicalPct: 0 },
  ], AMOUNT);
  /* ۱۰ + ۲۵ = ۳۵ درصد */
  assert.equal(r.overallPct, 35);
  assert.equal(r.earnedAmount, roundMoney(0.35 * AMOUNT));
});

test("lsw: پیشرفت بدون وزن گزارش می‌شود نه اینکه گم شود", () => {
  /* سکوت یعنی پروژه جلوتر از عددی است که گزارش می‌شود. */
  const r = computeEarned(
    [{ code: "E", weightValue: 100 }],
    [{ code: "E", physicalPct: 50 }, { code: "GHOST", physicalPct: 80 }],
    AMOUNT,
  );
  assert.deepEqual(r.unweightedCodes, ["GHOST"]);
  assert.equal(r.overallPct, 50);
});

test("lsw: پیشرفت بیش از صد مهار می‌شود", () => {
  const r = computeEarned([{ code: "A", weightValue: 100 }], [{ code: "A", physicalPct: 150 }], AMOUNT);
  assert.equal(r.overallPct, 100);
  assert.equal(r.earnedAmount, AMOUNT);
});

test("lsw: پیشرفت منفی صفر حساب می‌شود", () => {
  const r = computeEarned([{ code: "A", weightValue: 100 }], [{ code: "A", physicalPct: -20 }], AMOUNT);
  assert.equal(r.overallPct, 0);
});

test("lsw: بسته بدون گزارش پیشرفت، صفر است نه حذف", () => {
  const r = computeEarned(
    [{ code: "A", weightValue: 50 }, { code: "B", weightValue: 50 }],
    [{ code: "A", physicalPct: 100 }],
    AMOUNT,
  );
  assert.equal(r.overallPct, 50);
});

/* ══════════════════ توزیع پیشنهادی ══════════════════ */

test("lsw: وزن پیشنهادی برچسب typical می‌گیرد", () => {
  /* وزن پیشنهادی که به‌جای توافقی جا بزند، مبنای صورت‌وضعیتی می‌شود
   * که هیچ‌کس امضایش نکرده. */
  const seeded = seedTypicalWeights("EPCC");
  assert.equal(seeded.length, 4);
  for (const n of seeded) assert.equal(n.basis, "typical");
});

test("lsw: وزن پیشنهادی جمعش ۱۰۰ است", () => {
  const r = checkWeightSum(seedTypicalWeights("EPC"), AMOUNT);
  assert.equal(r.ok, true);
});

test("lsw: نرمال‌سازی نسبت‌ها را حفظ می‌کند", () => {
  const nodes = [
    { code: "A", parentCode: null, titleFa: "الف", weightPct: 30, basis: "agreed" },
    { code: "B", parentCode: null, titleFa: "ب", weightPct: 60, basis: "agreed" },
  ];
  const out = normalizeToHundred(nodes);
  const sum = out.reduce((s, n) => s + n.weightPct, 0);
  assert.ok(Math.abs(sum - 100) < 0.01);
  /* نسبت ۱ به ۲ باید بماند. */
  assert.ok(Math.abs(out[1].weightPct / out[0].weightPct - 2) < 0.001);
});

test("lsw: نرمال‌سازی برچسب را از توافقی به مشتق تغییر می‌دهد", () => {
  /* عددی که کاربر توافق کرده دیگر همان نیست. */
  const nodes = [
    { code: "A", parentCode: null, titleFa: "الف", weightPct: 30, basis: "agreed" },
    { code: "B", parentCode: null, titleFa: "ب", weightPct: 60, basis: "agreed" },
  ];
  const out = normalizeToHundred(nodes);
  for (const n of out) assert.equal(n.basis, "derived");
});

test("lsw: وزن درست از پیش، دست‌نخورده و توافقی می‌ماند", () => {
  const nodes = [
    { code: "A", parentCode: null, titleFa: "الف", weightPct: 40, basis: "agreed" },
    { code: "B", parentCode: null, titleFa: "ب", weightPct: 60, basis: "agreed" },
  ];
  const out = normalizeToHundred(nodes);
  for (const n of out) assert.equal(n.basis, "agreed");
});

test("lsw: نرمال‌سازی روی جمع صفر چیزی را خراب نمی‌کند", () => {
  const nodes = [{ code: "A", parentCode: null, titleFa: "الف", weightPct: 0, basis: "agreed" }];
  const out = normalizeToHundred(nodes);
  assert.equal(out[0].weightPct, 0);
});

/* ══════════════════ زنجیرهٔ کامل ══════════════════ */

test("lsw: مسیر کامل از درصد توافقی تا هزینه", () => {
  /* سناریوی واقعی: EPCC با مبلغ ۱۶۷۰۰۰، اجرا به دو زیربسته شکسته. */
  const tree = [
    { code: "E", parentCode: null, titleFa: "مهندسی", weightPct: 11, basis: "agreed" },
    { code: "P", parentCode: null, titleFa: "تدارکات", weightPct: 45, basis: "agreed" },
    { code: "C", parentCode: null, titleFa: "اجرا", weightPct: 36, basis: "agreed" },
    { code: "CM", parentCode: null, titleFa: "راه‌اندازی", weightPct: 8, basis: "agreed" },
    { code: "C.1", parentCode: "C", titleFa: "خاکی", weightPct: 30, basis: "agreed" },
    { code: "C.2", parentCode: "C", titleFa: "بتنی", weightPct: 70, basis: "agreed" },
  ];

  const gate = checkWeightSum(tree.filter((n) => !n.parentCode), AMOUNT);
  assert.equal(gate.ok, true);

  const abs = computeAbsoluteWeights(tree);
  const leaves = ["E", "P", "CM", "C.1", "C.2"];
  const leafWeights = abs.filter((a) => leaves.includes(a.code));
  assert.equal(roundPct(leafWeights.reduce((s, w) => s + w.weightValue, 0)), 100);

  const alloc = allocateCost(leafWeights, AMOUNT);
  assert.equal(alloc.allocated, AMOUNT);
  assert.equal(alloc.warningsFa.length, 0);

  const earned = computeEarned(leafWeights, [
    { code: "E", physicalPct: 100 },
    { code: "P", physicalPct: 60 },
    { code: "C.1", physicalPct: 40 },
  ], AMOUNT);
  /* ۱۱ + ۲۷ + ۴٫۳۲ = ۴۲٫۳۲ */
  assert.equal(earned.overallPct, 42.32);
  assert.equal(earned.unweightedCodes.length, 0);
});
