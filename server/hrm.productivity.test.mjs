/**
 * آزمون موتور بهره‌وری و ریشه‌یابی — HRM D5.
 *
 * جهت‌گیری: هر آزمون یک قاعدهٔ کسب‌وکار را می‌بندد، نه یک خط کد را.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CALIBRATION_MIN_PERIODS,
  METRIC_CODES,
  METRIC_FA,
  PI_THRESHOLD,
  RCA_BY_CODE,
  RCA_CATALOG,
  RCA_CATEGORIES,
  RCA_CATEGORY_FA,
  buildMetricSnapshots,
  calibrateStdRate,
  canFinalizeProductivity,
  canOverwriteSnapshot,
  canRaiseClaim,
  computeProductivity,
  inputHash,
  piStatus,
  productivityByTrade,
  productivitySummary,
  rcaRollup,
  stableStringify,
  validateRca,
} from "./hrmLogic.js";
import { MIGRATIONS, SCHEMA, tableDef } from "./sqlLogic.js";

/** `TABLE_BY_NAME` صادر نشده است؛ `tableDef` همان کار را می‌کند. */
const TABLE_BY_NAME = { get: (n) => tableDef(n) };

/* ══════════ ۱. کاتالوگ علت ══════════ */

test("کاتالوگ علت: شانزده علت، کد یکتا و دستهٔ معتبر", () => {
  assert.equal(RCA_CATALOG.length, 16);
  assert.equal(new Set(RCA_CATALOG.map((r) => r.code)).size, 16);
  for (const r of RCA_CATALOG) {
    assert.ok(RCA_CATEGORIES.includes(r.category), `دستهٔ ناشناخته: ${r.category}`);
    assert.ok(r.fa.trim().length > 3, `عنوان فارسی کوتاه: ${r.code}`);
    assert.ok(r.en.trim().length > 3, `عنوان انگلیسی کوتاه: ${r.code}`);
    assert.match(r.ownerDomain, /^d\d+$/, `دامنهٔ مالک بدقالب: ${r.code}`);
    assert.match(r.code, /^RCA-[A-Z]{3}-\d{2}$/, `قالب کد: ${r.code}`);
  }
});

test("هر ده دستهٔ علت دست‌کم یک نماینده در کاتالوگ دارد", () => {
  for (const c of RCA_CATEGORIES) {
    assert.ok(RCA_CATALOG.some((r) => r.category === c), `دستهٔ بی‌نماینده: ${c}`);
    assert.ok(RCA_CATEGORY_FA[c], `ترجمهٔ نبود برای ${c}`);
  }
});

test("علت‌های درون‌کنترل پیمانکار ادعاپذیر نیستند", () => {
  /* این آزمون یک تصمیم قراردادی را قفل می‌کند، نه یک محاسبه: اگر
   * روزی کسی «دوباره‌کاری» را ادعاپذیر کند، پروندهٔ ادعا نزد کارفرما
   * بی‌اعتبار می‌شود. */
  for (const code of ["RCA-RWK-01", "RCA-SKL-01", "RCA-SKL-02", "RCA-EQP-01", "RCA-EQP-02", "RCA-HSE-01", "RCA-PRM-01"]) {
    assert.equal(RCA_BY_CODE[code].isClaimable, false, `${code} نباید ادعاپذیر باشد`);
  }
  for (const code of ["RCA-DWG-01", "RCA-CLD-01", "RCA-CLD-02", "RCA-ACC-01", "RCA-MAT-01"]) {
    assert.equal(RCA_BY_CODE[code].isClaimable, true, `${code} باید ادعاپذیر باشد`);
  }
});

/* ══════════ ۲. هش ورودی ══════════ */

test("hash: ترتیب کلیدها روی نتیجه اثر ندارد", () => {
  assert.equal(inputHash({ a: 1, b: 2 }), inputHash({ b: 2, a: 1 }));
  assert.equal(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("hash: تغییر کوچک عدد، هش را عوض می‌کند", () => {
  assert.notEqual(inputHash({ h: 10 }), inputHash({ h: 10.5 }));
  assert.equal(inputHash({ h: 10 }), inputHash({ h: 10.0 }));
});

test("hash: طول ثابت ۱۶ نویسهٔ هگز", () => {
  for (const v of [null, 0, "x", { a: [1, 2, { b: 3 }] }, [1, "2"]]) {
    assert.match(inputHash(v), /^[0-9a-f]{16}$/);
  }
});

test("hash: آرایه و شیء با محتوای یکسان یکی نیستند", () => {
  assert.notEqual(inputHash([1, 2]), inputHash({ 0: 1, 1: 2 }));
});

/* ══════════ ۳. آستانه و وضعیت ══════════ */

test("piStatus: مرزها دقیقاً روی آستانه", () => {
  assert.equal(piStatus(0.849), "red");
  assert.equal(piStatus(0.85), "amber");
  assert.equal(piStatus(0.999), "amber");
  assert.equal(piStatus(1), "green");
  assert.equal(piStatus(1.4), "green");
  assert.equal(PI_THRESHOLD.red, 0.85);
  assert.equal(PI_THRESHOLD.amber, 1);
});

test("piStatus: نبود داده «نامشخص» است نه «قرمز»", () => {
  /* رنگ قرمز یعنی «بد»؛ نبود داده یعنی «نمی‌دانیم». قاطی کردنشان
   * باعث می‌شود مدیر پروژه دنبال مشکلی بگردد که وجود ندارد. */
  assert.equal(piStatus(0), "na");
  assert.equal(piStatus(1.2, false), "na");
});

/* ══════════ ۴. موتور بهره‌وری ══════════ */

const ACTS = [
  { activityId: "A-1", budgetMh: 1000, approvedProgressPct: 50, tradeCode: "CIV-FRM", cbsId: "CBS-1" },
  { activityId: "A-2", budgetMh: 500, approvedProgressPct: 100, tradeCode: "STR-FIT", cbsId: "CBS-2" },
];

const ENTRIES = [
  { activityId: "A-1", tradeCode: "CIV-FRM", cbsId: "CBS-1", hoursRaw: 400, isProductive: true, qtyDone: 320, qtyUom: "m²" },
  { activityId: "A-1", tradeCode: "CIV-FRM", cbsId: "CBS-1", hoursRaw: 100, isProductive: false },
  { activityId: "A-2", tradeCode: "STR-FIT", cbsId: "CBS-2", hoursRaw: 400, isProductive: true },
];

test("PI از پیشرفت تأییدشده ساخته می‌شود، نه از پیشرفت اعلامی", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  const a1 = rows.find((r) => r.activityId === "A-1");
  assert.equal(a1.earnedMh, 500);        // 1000 × 50٪
  assert.equal(a1.actualMh, 500);        // 400 + 100
  assert.equal(a1.pi, 1);
  assert.equal(a1.status, "green");
});

test("ساعت غیرمولد در actual می‌ماند ولی جدا هم شمرده می‌شود", () => {
  /* اگر ساعت بی‌کاری از مخرج بیرون برود، PI کاذب بالا می‌رود و
   * مسئلهٔ واقعی (۱۰۰ ساعت معطلی) از گزارش ناپدید می‌شود. */
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  const a1 = rows.find((r) => r.activityId === "A-1");
  assert.equal(a1.lostMh, 100);
  assert.equal(a1.actualMh, 500);
  assert.notEqual(a1.actualMh, 400);
});

test("PI کمتر از یک، فعالیت را قرمز می‌کند", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  const a2 = rows.find((r) => r.activityId === "A-2");
  assert.equal(a2.earnedMh, 500);
  assert.equal(a2.actualMh, 400);
  assert.equal(a2.pi, 1.25);
  assert.equal(a2.status, "green");
});

test("فعالیت بدون ساعت واقعی، PI صفر و وضعیت نامشخص می‌گیرد", () => {
  const rows = computeProductivity([{ activityId: "A-9", budgetMh: 100, approvedProgressPct: 30 }], [], "2026-09");
  assert.equal(rows[0].actualMh, 0);
  assert.equal(rows[0].pi, 0);
  assert.equal(rows[0].status, "na");
  assert.equal(rows[0].earnedMh, 30);
});

test("پیشرفت بیرون بازهٔ ۰ تا ۱۰۰ بریده می‌شود", () => {
  const rows = computeProductivity(
    [{ activityId: "A-1", budgetMh: 100, approvedProgressPct: 150 }, { activityId: "A-2", budgetMh: 100, approvedProgressPct: -20 }],
    [{ activityId: "A-1", hoursRaw: 50, isProductive: true }, { activityId: "A-2", hoursRaw: 50, isProductive: true }],
    "2026-09"
  );
  assert.equal(rows[0].earnedMh, 100);
  assert.equal(rows[0].approvedProgressPct, 100);
  assert.equal(rows[1].earnedMh, 0);
  assert.equal(rows[1].approvedProgressPct, 0);
});

test("نرخ اجرا و انحراف از نرخ استاندارد رسته", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  const a1 = rows.find((r) => r.activityId === "A-1");
  assert.equal(a1.qtyDone, 320);
  assert.equal(a1.unitRate, 0.64);   // 320 / 500
  assert.equal(a1.stdRate, 0.8);
  assert.equal(a1.variancePct, -20); // ۲۰٪ کندتر از استاندارد
});

test("نرخ استاندارد قابل جایگزینی با نرخ کالیبره‌شده است", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09", { stdRates: { "CIV-FRM": 0.64 } });
  const a1 = rows.find((r) => r.activityId === "A-1");
  assert.equal(a1.stdRate, 0.64);
  assert.equal(a1.variancePct, 0);
});

test("بدون مقدار انجام‌شده، نرخ اجرا محاسبه نمی‌شود", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  const a2 = rows.find((r) => r.activityId === "A-2");
  assert.equal(a2.qtyDone, undefined);
  assert.equal(a2.unitRate, undefined);
  assert.equal(a2.variancePct, undefined);
});

test("روند از PI دورهٔ قبل مشتق می‌شود", () => {
  const base = computeProductivity(ACTS, ENTRIES, "2026-09");
  assert.equal(base[0].trend, "stable", "بدون دورهٔ قبل باید پایدار باشد");

  const up = computeProductivity(ACTS, ENTRIES, "2026-09", { priorPi: { "A-1": 0.5 } });
  assert.equal(up.find((r) => r.activityId === "A-1").trend, "improving");

  const down = computeProductivity(ACTS, ENTRIES, "2026-09", { priorPi: { "A-1": 2 } });
  assert.equal(down.find((r) => r.activityId === "A-1").trend, "declining");
});

test("نوسان کمتر از ۵ درصد «پایدار» است نه روند", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09", { priorPi: { "A-1": 0.98 } });
  assert.equal(rows.find((r) => r.activityId === "A-1").trend, "stable");
});

test("برچسب کالیبراسیون فقط برای رستهٔ اعلام‌شده روشن است", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09", { calibratedTrades: ["CIV-FRM"] });
  assert.equal(rows.find((r) => r.activityId === "A-1").isCalibrated, true);
  assert.equal(rows.find((r) => r.activityId === "A-2").isCalibrated, false);
});

test("ردیف‌های بدون شناسهٔ فعالیت نادیده گرفته می‌شوند", () => {
  const rows = computeProductivity(ACTS, [...ENTRIES, { activityId: "", hoursRaw: 999, isProductive: true }], "2026-09");
  assert.equal(rows.reduce((s, r) => s + r.actualMh, 0), 900);
});

test("ساعت صفر یا منفی وارد جمع نمی‌شود", () => {
  const rows = computeProductivity(
    [{ activityId: "A-1", budgetMh: 100, approvedProgressPct: 100 }],
    [{ activityId: "A-1", hoursRaw: 0, isProductive: true }, { activityId: "A-1", hoursRaw: -5, isProductive: true }, { activityId: "A-1", hoursRaw: 10, isProductive: true }],
    "2026-09"
  );
  assert.equal(rows[0].actualMh, 10);
});

test("خروجی بر اساس شناسهٔ فعالیت مرتب است", () => {
  const rows = computeProductivity(
    [{ activityId: "Z-1", budgetMh: 1, approvedProgressPct: 1 }, { activityId: "A-1", budgetMh: 1, approvedProgressPct: 1 }],
    [], "2026-09"
  );
  assert.deepEqual(rows.map((r) => r.activityId), ["A-1", "Z-1"]);
});

test("محاسبهٔ دوباره با دادهٔ یکسان، هش یکسان می‌دهد", () => {
  const a = computeProductivity(ACTS, ENTRIES, "2026-09");
  const b = computeProductivity(ACTS, [...ENTRIES].reverse(), "2026-09");
  assert.deepEqual(a.map((r) => r.inputHash), b.map((r) => r.inputHash));
});

test("تغییر ساعت، هش را عوض می‌کند", () => {
  const a = computeProductivity(ACTS, ENTRIES, "2026-09");
  const b = computeProductivity(ACTS, [{ ...ENTRIES[0], hoursRaw: 401 }, ...ENTRIES.slice(1)], "2026-09");
  assert.notEqual(a[0].inputHash, b[0].inputHash);
});

test("ضریب عملکرد عکس شاخص بهره‌وری است", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  for (const r of rows) {
    if (r.pi > 0) assert.ok(Math.abs(r.pf - 1 / r.pi) < 0.01, `pf ناسازگار در ${r.activityId}`);
    else assert.equal(r.pf, 0);
  }
});

/* ══════════ ۵. تجمیع دوره ══════════ */

test("PI کل میانگین وزنی است نه میانگین ساده", () => {
  /* یک فعالیت ۱۰ ساعته با PI=۰٫۲ نباید همان وزن فعالیت ۱۰۰۰ ساعته
   * با PI=۱٫۱ را داشته باشد؛ میانگین ساده ۰٫۶۵ می‌داد و کل پروژه را
   * بی‌دلیل قرمز نشان می‌داد. */
  const rows = computeProductivity(
    [{ activityId: "SMALL", budgetMh: 2, approvedProgressPct: 100 }, { activityId: "BIG", budgetMh: 1100, approvedProgressPct: 100 }],
    [{ activityId: "SMALL", hoursRaw: 10, isProductive: true }, { activityId: "BIG", hoursRaw: 1000, isProductive: true }],
    "2026-09"
  );
  const s = productivitySummary(rows);
  assert.equal(s.earnedMh, 1102);
  assert.equal(s.actualMh, 1010);
  assert.equal(s.pi, 1.091);
  const naive = (rows[0].pi + rows[1].pi) / 2;
  assert.ok(Math.abs(s.pi - naive) > 0.3, "میانگین وزنی باید با میانگین ساده تفاوت معنادار داشته باشد");
});

test("جمع دوره: شمارش رنگ‌ها و بدترین فعالیت", () => {
  const rows = computeProductivity(
    [
      { activityId: "R", budgetMh: 100, approvedProgressPct: 50 },
      { activityId: "A", budgetMh: 100, approvedProgressPct: 90 },
      { activityId: "G", budgetMh: 100, approvedProgressPct: 100 },
    ],
    [
      { activityId: "R", hoursRaw: 100, isProductive: true },
      { activityId: "A", hoursRaw: 100, isProductive: true },
      { activityId: "G", hoursRaw: 90, isProductive: true },
    ],
    "2026-09"
  );
  const s = productivitySummary(rows);
  assert.equal(s.redCount, 1);
  assert.equal(s.amberCount, 1);
  assert.equal(s.greenCount, 1);
  assert.equal(s.worstActivityId, "R");
  assert.equal(s.worstPi, 0.5);
  assert.equal(s.activityCount, 3);
});

test("پوشش ریشه‌یابی: قرمز بی‌علت شناسایی و شمرده می‌شود", () => {
  const rows = computeProductivity(
    [{ activityId: "R1", budgetMh: 100, approvedProgressPct: 40 }, { activityId: "R2", budgetMh: 100, approvedProgressPct: 40 }],
    [{ activityId: "R1", hoursRaw: 100, isProductive: true }, { activityId: "R2", hoursRaw: 100, isProductive: true }],
    "2026-09"
  );
  const none = productivitySummary(rows);
  assert.equal(none.rcaCoveragePct, 0);
  assert.deepEqual(none.unexplainedRed, ["R1", "R2"]);

  const half = productivitySummary(rows, ["R1"]);
  assert.equal(half.rcaCoveragePct, 50);
  assert.deepEqual(half.unexplainedRed, ["R2"]);

  const full = productivitySummary(rows, ["R1", "R2"]);
  assert.equal(full.rcaCoveragePct, 100);
  assert.deepEqual(full.unexplainedRed, []);
});

test("دورهٔ بدون فعالیت قرمز، پوشش ریشه‌یابی «بی‌معنا» می‌دهد نه صفر", () => {
  /* صفر یعنی «هیچ‌کدام توضیح داده نشده»؛ اینجا اصلاً چیزی برای
   * توضیح نیست و باید null باشد وگرنه داشبورد قرمز کاذب می‌شود. */
  const rows = computeProductivity(
    [{ activityId: "G", budgetMh: 100, approvedProgressPct: 100 }],
    [{ activityId: "G", hoursRaw: 80, isProductive: true }], "2026-09"
  );
  assert.equal(productivitySummary(rows).rcaCoveragePct, null);
});

test("سهم زمان تلف‌شده در جمع دوره", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  const s = productivitySummary(rows);
  assert.equal(s.lostMh, 100);
  assert.equal(s.actualMh, 900);
  assert.equal(s.lostPct, 11.11);
});

test("جمع دورهٔ خالی امن است", () => {
  const s = productivitySummary([]);
  assert.equal(s.activityCount, 0);
  assert.equal(s.pi, 0);
  assert.equal(s.lostPct, null);
  assert.equal(s.worstPi, null);
  assert.equal(s.rcaCoveragePct, null);
});

test("تجمیع بر حسب رسته، بدترین رسته را اول می‌آورد", () => {
  const rows = computeProductivity(
    [
      { activityId: "A-1", budgetMh: 100, approvedProgressPct: 100, tradeCode: "CIV-FRM" },
      { activityId: "A-2", budgetMh: 100, approvedProgressPct: 40, tradeCode: "STR-FIT" },
    ],
    [
      { activityId: "A-1", hoursRaw: 80, isProductive: true },
      { activityId: "A-2", hoursRaw: 100, isProductive: true },
    ],
    "2026-09"
  );
  const g = productivityByTrade(rows);
  assert.equal(g.length, 2);
  assert.equal(g[0].tradeCode, "STR-FIT");
  assert.equal(g[0].pi, 0.4);
  assert.equal(g[0].status, "red");
  assert.equal(g[1].tradeCode, "CIV-FRM");
  assert.equal(g[1].status, "green");
  assert.ok(g[0].tradeFa.length > 0);
});

test("فعالیت بی‌رسته زیر کلید «—» جمع می‌شود و گم نمی‌شود", () => {
  const rows = computeProductivity(
    [{ activityId: "A-1", budgetMh: 100, approvedProgressPct: 100 }],
    [{ activityId: "A-1", hoursRaw: 80, isProductive: true }], "2026-09"
  );
  const g = productivityByTrade(rows);
  assert.equal(g[0].tradeCode, "—");
  assert.equal(g[0].actualMh, 80);
});

/* ══════════ ۶. اعتبارسنجی ریشه‌یابی ══════════ */

const OK_RCA = { activityId: "A-1", periodCode: "2026-09", reasonCode: "RCA-MAT-01", sharePct: 60, lostMh: 40, noteFa: "میلگرد از انبار مرکزی نرسید" };

test("ریشه‌یابی معتبر ایرادی ندارد", () => {
  assert.deepEqual(validateRca(OK_RCA), []);
});

test("کد علت خارج از کاتالوگ رد می‌شود", () => {
  const i = validateRca({ ...OK_RCA, reasonCode: "RCA-XXX-99" });
  assert.ok(i.some((x) => x.code === "E-HRM-140"));
});

test("سهم علت خارج از بازهٔ ۱ تا ۱۰۰ رد می‌شود", () => {
  assert.ok(validateRca({ ...OK_RCA, sharePct: 0 }).some((x) => x.code === "E-HRM-141"));
  assert.ok(validateRca({ ...OK_RCA, sharePct: 101 }).some((x) => x.code === "E-HRM-141"));
  assert.ok(validateRca({ ...OK_RCA, sharePct: -5 }).some((x) => x.code === "E-HRM-141"));
});

test("جمع سهم علت‌ها از صد درصد بیشتر نمی‌شود", () => {
  const i = validateRca({ ...OK_RCA, sharePct: 50 }, 60);
  assert.ok(i.some((x) => x.code === "E-HRM-142"));
  assert.deepEqual(validateRca({ ...OK_RCA, sharePct: 40 }, 60), []);
});

test("سهم پیش‌فرض صد درصد است", () => {
  const { sharePct, ...noShare } = OK_RCA;
  assert.deepEqual(validateRca(noShare), []);
  assert.ok(validateRca(noShare, 10).some((x) => x.code === "E-HRM-142"));
});

test("شرح کوتاه‌تر از ده نویسه رد می‌شود", () => {
  assert.ok(validateRca({ ...OK_RCA, noteFa: "دیر شد" }).some((x) => x.code === "E-HRM-143"));
  assert.ok(validateRca({ ...OK_RCA, noteFa: "         " }).some((x) => x.code === "E-HRM-143"));
});

test("ساعت تلف‌شدهٔ منفی رد می‌شود", () => {
  assert.ok(validateRca({ ...OK_RCA, lostMh: -1 }).some((x) => x.code === "E-HRM-144"));
});

test("فعالیت و دورهٔ خالی رد می‌شوند", () => {
  assert.ok(validateRca({ ...OK_RCA, activityId: "" }).some((x) => x.code === "E-HRM-145"));
  assert.ok(validateRca({ ...OK_RCA, periodCode: "  " }).some((x) => x.code === "E-HRM-146"));
});

test("ایرادهای همزمان همه گزارش می‌شوند نه فقط اولی", () => {
  const i = validateRca({ activityId: "", periodCode: "", reasonCode: "X", sharePct: 500, noteFa: "" });
  assert.ok(i.length >= 5, `انتظار ≥۵ ایراد، دریافت ${i.length}`);
});

/* ══════════ ۷. پل به ادعا ══════════ */

test("ادعا فقط از علت ادعاپذیر ساخته می‌شود", () => {
  assert.equal(canRaiseClaim({ ReasonCode: "RCA-DWG-01", LostMh: 40 }).ok, true);
  const no = canRaiseClaim({ ReasonCode: "RCA-SKL-01", LostMh: 40 });
  assert.equal(no.ok, false);
  assert.equal(no.code, "E-HRM-147");
});

test("ادعا بدون ساعت تلف‌شده مبنای کمّی ندارد", () => {
  const r = canRaiseClaim({ ReasonCode: "RCA-DWG-01", LostMh: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-148");
});

test("ادعای دوباره روی یک رویداد بسته است", () => {
  const r = canRaiseClaim({ ReasonCode: "RCA-DWG-01", LostMh: 40, ClaimRef: "CLM-7" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-149");
  assert.match(r.messageFa, /CLM-7/);
});

test("کد علت ناشناخته پیش از هر چیز رد می‌شود", () => {
  assert.equal(canRaiseClaim({ ReasonCode: "", LostMh: 10 }).code, "E-HRM-140");
});

test("تجمیع ریشه‌یابی: بیشترین ساعت باخته‌شده اول", () => {
  const roll = rcaRollup([
    { ReasonCode: "RCA-MAT-01", LostMh: 40 },
    { ReasonCode: "RCA-MAT-02", LostMh: 10 },
    { ReasonCode: "RCA-SKL-01", LostMh: 80 },
    { ReasonCode: "RCA-DWG-01", LostMh: 30, ClaimRef: "CLM-1" },
  ]);
  assert.equal(roll[0].category, "manpower_skill");
  assert.equal(roll[0].lostMh, 80);
  assert.equal(roll[0].claimableMh, 0, "مهارت ناکافی ادعاپذیر نیست");
  const mat = roll.find((r) => r.category === "material");
  assert.equal(mat.lostMh, 50);
  assert.equal(mat.count, 2);
  assert.equal(mat.claimableMh, 50);
  const dwg = roll.find((r) => r.category === "drawing");
  assert.equal(dwg.claimedMh, 30);
});

test("تجمیع ریشه‌یابی، علت ناشناخته را بی‌صدا نادیده می‌گیرد نه اینکه بشکند", () => {
  const roll = rcaRollup([{ ReasonCode: "GARBAGE", LostMh: 999 }, { ReasonCode: "RCA-MAT-01", LostMh: 5 }]);
  assert.equal(roll.length, 1);
  assert.equal(roll[0].lostMh, 5);
});

/* ══════════ ۸. کالیبراسیون نرخ ══════════ */

test("نرخ کالیبره نمی‌شود مگر سه دورهٔ کامل داشته باشیم", () => {
  assert.equal(CALIBRATION_MIN_PERIODS, 3);
  const two = calibrateStdRate([
    { tradeCode: "CIV-FRM", periodCode: "2026-07", qty: 100, hours: 200 },
    { tradeCode: "CIV-FRM", periodCode: "2026-08", qty: 100, hours: 200 },
  ]);
  assert.equal(two[0].isCalibrated, false);
  assert.equal(two[0].effectiveRate, 0.8, "تا کالیبره نشدن، نرخ کاتالوگ می‌ماند");
  assert.equal(two[0].observedRate, 0.5);
  assert.equal(two[0].driftPct, undefined);
});

test("سه دوره نرخ را کالیبره و انحراف را گزارش می‌کند", () => {
  const three = calibrateStdRate([
    { tradeCode: "CIV-FRM", periodCode: "2026-07", qty: 100, hours: 250 },
    { tradeCode: "CIV-FRM", periodCode: "2026-08", qty: 100, hours: 250 },
    { tradeCode: "CIV-FRM", periodCode: "2026-09", qty: 100, hours: 250 },
  ]);
  assert.equal(three[0].isCalibrated, true);
  assert.equal(three[0].observedRate, 0.4);
  assert.equal(three[0].effectiveRate, 0.4);
  assert.equal(three[0].catalogRate, 0.8);
  assert.equal(three[0].driftPct, -50);
});

test("سه مشاهده در یک دوره کالیبراسیون نمی‌سازد", () => {
  /* شمارش دوره است نه شمارش ردیف؛ سه برگه در یک هفته، سه دورهٔ
   * مستقل نیست و نمی‌تواند نرخ مرجع را جابه‌جا کند. */
  const same = calibrateStdRate([
    { tradeCode: "CIV-FRM", periodCode: "2026-09", qty: 10, hours: 20 },
    { tradeCode: "CIV-FRM", periodCode: "2026-09", qty: 10, hours: 20 },
    { tradeCode: "CIV-FRM", periodCode: "2026-09", qty: 10, hours: 20 },
  ]);
  assert.equal(same[0].periodCount, 1);
  assert.equal(same[0].isCalibrated, false);
});

test("مشاهدهٔ بدون ساعت نادیده گرفته می‌شود", () => {
  const r = calibrateStdRate([
    { tradeCode: "CIV-FRM", periodCode: "2026-07", qty: 50, hours: 0 },
    { tradeCode: "CIV-FRM", periodCode: "2026-08", qty: 50, hours: 100 },
  ]);
  assert.equal(r[0].periodCount, 1);
});

test("رستهٔ بدون نرخ کاتالوگ، پیش از کالیبراسیون نرخ مؤثر ندارد", () => {
  const r = calibrateStdRate([{ tradeCode: "UNKNOWN-X", periodCode: "2026-09", qty: 10, hours: 10 }]);
  assert.equal(r[0].catalogRate, undefined);
  assert.equal(r[0].effectiveRate, undefined);
  assert.equal(r[0].isCalibrated, false);
});

/* ══════════ ۹. عکس متریک ══════════ */

test("عکس متریک برای پروژه و هر رسته ساخته می‌شود", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  const s = productivitySummary(rows, ["A-1", "A-2"]);
  const snaps = buildMetricSnapshots(s, productivityByTrade(rows), { otPct: 12 });

  const pi = snaps.find((x) => x.metricCode === "PI" && x.dimension === "project");
  assert.ok(pi);
  assert.equal(pi.target, 1);
  assert.equal(pi.dimensionId, null);

  const ot = snaps.find((x) => x.metricCode === "OT_PCT");
  assert.equal(ot.value, 12);
  assert.equal(ot.status, "green");

  const tradePis = snaps.filter((x) => x.dimension === "trade");
  assert.equal(tradePis.length, 2);
  for (const t of tradePis) assert.equal(t.metricCode, "PI");
});

test("همهٔ کدهای متریک شناخته‌شده و ترجمه‌دارند", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  const snaps = buildMetricSnapshots(productivitySummary(rows, ["A-1"]), productivityByTrade(rows), { otPct: 30 });
  for (const s of snaps) {
    assert.ok(METRIC_CODES.includes(s.metricCode), `متریک ناشناخته: ${s.metricCode}`);
    assert.ok(METRIC_FA[s.metricCode], `ترجمهٔ نبود برای ${s.metricCode}`);
    assert.match(s.inputHash, /^[0-9a-f]{16}$/);
  }
});

test("اضافه‌کاری بالای ۲۵ درصد قرمز است", () => {
  const rows = computeProductivity(ACTS, ENTRIES, "2026-09");
  const s = productivitySummary(rows);
  assert.equal(buildMetricSnapshots(s, [], { otPct: 30 }).find((x) => x.metricCode === "OT_PCT").status, "red");
  assert.equal(buildMetricSnapshots(s, [], { otPct: 20 }).find((x) => x.metricCode === "OT_PCT").status, "amber");
  assert.equal(buildMetricSnapshots(s, [], { otPct: 5 }).find((x) => x.metricCode === "OT_PCT").status, "green");
});

test("متریک نبودِ داده اصلاً ساخته نمی‌شود", () => {
  /* بهتر است متریک غایب باشد تا اینکه صفر نشان داده شود؛ صفر یعنی
   * «اندازه گرفتیم و صفر بود». */
  const s = productivitySummary([]);
  const snaps = buildMetricSnapshots(s, []);
  assert.equal(snaps.find((x) => x.metricCode === "OT_PCT"), undefined);
  assert.equal(snaps.find((x) => x.metricCode === "LOST_PCT"), undefined);
  assert.equal(snaps.find((x) => x.metricCode === "RCA_COVERAGE"), undefined);
});

test("عکس نهایی‌شده بازنویسی نمی‌شود", () => {
  assert.equal(canOverwriteSnapshot({ IsFinal: false }), true);
  assert.equal(canOverwriteSnapshot({}), true);
  assert.equal(canOverwriteSnapshot({ IsFinal: true }), false);
  assert.equal(canOverwriteSnapshot({ IsFinal: 1 }), false, "درایور JSON بولین را ۰/۱ ذخیره می‌کند");
});

/* ══════════ ۱۰. دروازهٔ نهایی‌سازی ══════════ */

const GREEN_ROWS = computeProductivity(
  [{ activityId: "G", budgetMh: 100, approvedProgressPct: 100 }],
  [{ activityId: "G", hoursRaw: 80, isProductive: true }], "2026-09"
);

test("دورهٔ سالم نهایی می‌شود", () => {
  const r = canFinalizeProductivity({ rows: GREEN_ROWS, summary: productivitySummary(GREEN_ROWS), timesheetPending: 0 });
  assert.equal(r.ok, true);
});

test("دورهٔ قبلاً نهایی‌شده دوباره نهایی نمی‌شود", () => {
  const r = canFinalizeProductivity({ rows: GREEN_ROWS, summary: productivitySummary(GREEN_ROWS), alreadyFinal: true });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-150");
});

test("دورهٔ بدون فعالیت نهایی نمی‌شود", () => {
  const r = canFinalizeProductivity({ rows: [], summary: productivitySummary([]) });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-151");
});

test("قرمز بی‌ریشه‌یابی جلوی نهایی شدن را می‌گیرد", () => {
  const rows = computeProductivity(
    [{ activityId: "R", budgetMh: 100, approvedProgressPct: 40 }],
    [{ activityId: "R", hoursRaw: 100, isProductive: true }], "2026-09"
  );
  const r = canFinalizeProductivity({ rows, summary: productivitySummary(rows) });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-HRM-152");
  assert.ok(r.detailsFa.some((d) => d.includes("ریشه‌یابی")));
});

test("برگهٔ کارکرد تأییدنشده جلوی نهایی شدن را می‌گیرد", () => {
  const r = canFinalizeProductivity({ rows: GREEN_ROWS, summary: productivitySummary(GREEN_ROWS), timesheetPending: 3 });
  assert.equal(r.ok, false);
  assert.ok(r.detailsFa.some((d) => d.includes("۳") || d.includes("3")));
});

test("همهٔ دلایل مسدودی همزمان گزارش می‌شوند", () => {
  const rows = computeProductivity(
    [{ activityId: "R", budgetMh: 100, approvedProgressPct: 40 }],
    [{ activityId: "R", hoursRaw: 100, isProductive: true }], "2026-09"
  );
  const r = canFinalizeProductivity({ rows, summary: productivitySummary(rows), timesheetPending: 2 });
  assert.ok(r.detailsFa.length >= 2, "کاربر باید همهٔ کارهای مانده را یکجا ببیند");
});

test("فهرست قرمزهای بی‌علت در پیام حداکثر پنج مورد نشان می‌دهد", () => {
  const acts = Array.from({ length: 9 }, (_, i) => ({ activityId: `R-${i}`, budgetMh: 100, approvedProgressPct: 10 }));
  const ent = acts.map((a) => ({ activityId: a.activityId, hoursRaw: 100, isProductive: true }));
  const rows = computeProductivity(acts, ent, "2026-09");
  const r = canFinalizeProductivity({ rows, summary: productivitySummary(rows) });
  const line = r.detailsFa.find((d) => d.includes("ریشه‌یابی"));
  assert.equal(line.split("، ").length, 5);
  assert.ok(line.includes("9"));
});

/* ══════════ ۱۱. اسکیما و مهاجرت ══════════ */

test("چهار جدول بهره‌وری در اسکیما هستند و به d10 تعلق دارند", () => {
  for (const n of ["HrmProductivityLog", "HrmRcaReason", "HrmRcaEntry", "HrmMetricSnapshot"]) {
    const t = TABLE_BY_NAME.get(n);
    assert.ok(t, `جدول ${n} نیست`);
    assert.equal(t.module, "d10");
    assert.equal(t.pk, "Id");
    assert.ok(t.title.fa && t.title.en, `عنوان دوزبانه ندارد: ${n}`);
  }
});

test("مهاجرت 0024 بهره‌وری است و مهاجرت‌های پیشین حفظ شده‌اند", () => {
  const v = MIGRATIONS.map((m) => m.version);
  assert.ok(v.includes("0023"), "مهاجرت تایم‌شیت نباید حذف شود");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
  /* «آخرین» نه — «خودش»: D6 مهاجرت 0025 را افزود و ادعای آخر بودن
   * می‌شکست بی‌آنکه دربارهٔ بهره‌وری چیزی بگوید. */
  assert.equal(MIGRATIONS.find((m) => m.version === "0024").name, "hrm_productivity");
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
});

test("مهاجرت 0024 هر چهار جدول و شاخص‌هایشان را می‌سازد", () => {
  const m = MIGRATIONS.find((x) => x.version === "0024");
  const sql = m.statements.join("\n");
  for (const n of ["HrmProductivityLog", "HrmRcaReason", "HrmRcaEntry", "HrmMetricSnapshot"]) {
    assert.ok(sql.includes(n), `${n} در مهاجرت نیست`);
  }
  assert.ok(sql.includes("UX_HrmProdLog"), "کلید یکتای فعالیت-دوره نیست");
  assert.ok(sql.includes("UX_HrmMetricSnap"), "کلید یکتای عکس متریک نیست");
});

test("کلید یکتا از ثبت دوبارهٔ یک فعالیت در یک دوره جلوگیری می‌کند", () => {
  const t = TABLE_BY_NAME.get("HrmProductivityLog");
  const ux = t.indexes.find((i) => i.unique);
  assert.deepEqual(ux.columns, ["ProjectId", "ActivityId", "PeriodCode"]);
});

test("جدول‌های پیش از بهره‌وری حذف نشده‌اند", () => {
  assert.ok(SCHEMA.length >= 122, "جدولی از اسکیما حذف شده است");
});

test("ستون‌های حساس بهره‌وری اجباری‌اند", () => {
  const t = TABLE_BY_NAME.get("HrmProductivityLog");
  const byName = Object.fromEntries(t.columns.map((c) => [c.name, c]));
  for (const n of ["ProjectId", "ActivityId", "PeriodCode", "EarnedMh", "ActualMh", "Pi", "InputHash", "IsFinal"]) {
    assert.equal(byName[n].nullable, false, `${n} نباید nullable باشد`);
  }
  assert.equal(byName.CreatedAt, undefined, "ستون CreatedAt خودکار افزوده می‌شود");
});
