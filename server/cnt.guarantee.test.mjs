/**
 * آزمون موتور ضمانت‌نامه و بازیافت پیش‌پرداخت — CNT/D7.
 *
 * تمرکز آزمون روی حالت‌هایی است که در عمل پول از دست می‌دهند:
 * ضمانت‌نامه‌ای که بی‌سروصدا منقضی شده، آزادسازی وثیقهٔ پیش‌پرداختِ
 * بازیافت‌نشده، و کسر بیش از بدهی در آخرین صورت‌وضعیت.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  GUARANTEE_TYPES, GUARANTEE_STATUSES, GUARANTEE_ALERT_DAYS, GUARANTEE_CUSTOMARY_PCT,
  ADVANCE_STATUSES, ADVANCE_DEFAULT_RECOVERY_PCT, ADVANCE_CUSTOMARY_CAP_PCT,
  guaranteeEffectiveExpiry, guaranteeState, validateGuaranteeInput, canActOnGuarantee,
  guaranteeRegister, advanceLedger, advanceRecovery, validateAdvanceInput, guaranteeHealth,
} from "./cntLogic.js";

const NOW = new Date("2026-09-10T09:00:00.000Z");
const day = 86_400_000;
const iso = (offsetDays) => new Date(NOW.getTime() + offsetDays * day).toISOString().slice(0, 10);

const grt = (over = {}) => ({
  Code: "G-1", GuaranteeType: "performance", BankName: "بانک ملت",
  GuaranteeNo: "1402/55/7788", Amount: 5_000_000_000,
  IssueDate: iso(-200), ExpiryDate: iso(120), Status: "active", ...over,
});

/* ══════════════ ۱) واژگان ══════════════ */

test("واژگان ضمانت‌نامه کامل و بدون تکرار است", () => {
  assert.deepEqual(GUARANTEE_TYPES, ["advance", "performance", "bid", "retention", "warranty"]);
  assert.deepEqual(GUARANTEE_STATUSES, ["active", "extended", "released", "forfeited", "expired"]);
  assert.equal(new Set(GUARANTEE_TYPES).size, GUARANTEE_TYPES.length);
  assert.deepEqual(ADVANCE_STATUSES, ["pending", "paid", "recovering", "settled"]);
});

test("آستانه‌های هشدار نزولی‌اند", () => {
  assert.ok(GUARANTEE_ALERT_DAYS.d30 > GUARANTEE_ALERT_DAYS.d10);
  assert.ok(GUARANTEE_ALERT_DAYS.d10 > GUARANTEE_ALERT_DAYS.d3);
  assert.ok(GUARANTEE_ALERT_DAYS.d3 > 0);
});

test("درصد مرسوم برای هر نوع تعریف شده است", () => {
  for (const t of GUARANTEE_TYPES) {
    assert.equal(typeof GUARANTEE_CUSTOMARY_PCT[t], "number", `${t} درصد مرسوم ندارد`);
  }
  assert.equal(ADVANCE_DEFAULT_RECOVERY_PCT, 20);
  assert.equal(ADVANCE_CUSTOMARY_CAP_PCT, 25);
});

/* ══════════════ ۲) تاریخ مؤثر انقضا ══════════════ */

test("بدون تمدید، تاریخ اصلی ملاک است", () => {
  assert.equal(guaranteeEffectiveExpiry({ ExpiryDate: "2026-12-01" }), "2026-12-01");
});

test("تمدید جلوتر، تاریخ مؤثر را می‌برد جلو", () => {
  assert.equal(
    guaranteeEffectiveExpiry({ ExpiryDate: "2026-12-01", ExtendedToDate: "2027-03-01" }),
    "2027-03-01",
  );
});

test("تمدید به عقب نادیده گرفته می‌شود — سند بانکی تاریخ دیرتر را دارد", () => {
  assert.equal(
    guaranteeEffectiveExpiry({ ExpiryDate: "2026-12-01", ExtendedToDate: "2026-06-01" }),
    "2026-12-01",
  );
});

test("تاریخ انقضای نامعتبر به تمدید سقوط نمی‌کند مگر خودش معتبر باشد", () => {
  assert.equal(guaranteeEffectiveExpiry({ ExpiryDate: null, ExtendedToDate: "2027-01-01" }), "2027-01-01");
  assert.equal(guaranteeEffectiveExpiry({}), null);
});

/* ══════════════ ۳) وضعیت و هشدار زودهنگام ══════════════ */

test("ضمانت‌نامهٔ دور از انقضا هشدار ندارد", () => {
  const s = guaranteeState(grt({ ExpiryDate: iso(120) }), NOW);
  assert.equal(s.alert, "none");
  assert.equal(s.isLive, true);
  assert.equal(s.daysToExpiry, 120);
});

test("سی روز مانده، هشدار d30 می‌دهد", () => {
  assert.equal(guaranteeState(grt({ ExpiryDate: iso(30) }), NOW).alert, "d30");
  assert.equal(guaranteeState(grt({ ExpiryDate: iso(29) }), NOW).alert, "d30");
});

test("هشدارها به ترتیب تشدید می‌شوند", () => {
  assert.equal(guaranteeState(grt({ ExpiryDate: iso(10) }), NOW).alert, "d10");
  assert.equal(guaranteeState(grt({ ExpiryDate: iso(3) }), NOW).alert, "d3");
  assert.equal(guaranteeState(grt({ ExpiryDate: iso(0) }), NOW).alert, "d3");
});

test("مرز دقیق است — ۳۱ روز هنوز d30 نیست", () => {
  assert.equal(guaranteeState(grt({ ExpiryDate: iso(31) }), NOW).alert, "none");
  assert.equal(guaranteeState(grt({ ExpiryDate: iso(11) }), NOW).alert, "d30");
  assert.equal(guaranteeState(grt({ ExpiryDate: iso(4) }), NOW).alert, "d10");
});

test("ساعت روز، مرز هشدار را جابه‌جا نمی‌کند", () => {
  const early = new Date("2026-09-10T00:05:00.000Z");
  const late = new Date("2026-09-10T23:55:00.000Z");
  const row = grt({ ExpiryDate: "2026-10-10" });
  assert.equal(guaranteeState(row, early).daysToExpiry, guaranteeState(row, late).daysToExpiry);
});

test("ضمانت‌نامهٔ گذشته‌تاریخ که هنوز معتبر ثبت شده، سکوت خطرناک است", () => {
  const s = guaranteeState(grt({ ExpiryDate: iso(-5), Status: "active" }), NOW);
  assert.equal(s.status, "expired");
  assert.equal(s.alert, "overdue");
  assert.equal(s.isExpiredSilently, true);
  assert.equal(s.isLive, false);
  assert.ok(s.warningsFa.some((w) => w.includes("معتبر ثبت شده")));
});

test("ضمانت‌نامهٔ تمدیدشدهٔ گذشته‌تاریخ هم سکوت خطرناک است", () => {
  const s = guaranteeState(grt({ ExpiryDate: iso(-40), ExtendedToDate: iso(-2), Status: "extended" }), NOW);
  assert.equal(s.isExpiredSilently, true);
  assert.equal(s.status, "expired");
});

test("تمدید معتبر، ضمانت‌نامهٔ گذشته‌تاریخ را زنده نگه می‌دارد", () => {
  const s = guaranteeState(grt({ ExpiryDate: iso(-5), ExtendedToDate: iso(90), Status: "extended" }), NOW);
  assert.equal(s.isExpiredSilently, false);
  assert.equal(s.isLive, true);
  assert.equal(s.alert, "none");
});

test("ضمانت‌نامهٔ آزادشده منقضی نمی‌شود — حالت پایانی است", () => {
  const s = guaranteeState(grt({ ExpiryDate: iso(-100), Status: "released" }), NOW);
  assert.equal(s.status, "released");
  assert.equal(s.alert, "none");
  assert.equal(s.isExpiredSilently, false);
});

test("ضمانت‌نامهٔ ضبط‌شده هم دست‌نخورده می‌ماند", () => {
  const s = guaranteeState(grt({ ExpiryDate: iso(-100), Status: "forfeited" }), NOW);
  assert.equal(s.status, "forfeited");
  assert.equal(s.alert, "none");
});

test("نبود تاریخ انقضا هشدار می‌دهد نه سکوت", () => {
  const s = guaranteeState(grt({ ExpiryDate: null }), NOW);
  assert.equal(s.daysToExpiry, null);
  assert.equal(s.alert, "none");
  assert.ok(s.warningsFa.some((w) => w.includes("هشدار زودهنگام کار نمی‌کند")));
});

test("تمدید بی‌اثر (عقب‌تر از انقضا) هشدار می‌گیرد", () => {
  const s = guaranteeState(grt({ ExpiryDate: iso(100), ExtendedToDate: iso(50) }), NOW);
  assert.ok(s.warningsFa.some((w) => w.includes("اثری ندارد")));
});

/* ══════════════ ۴) اعتبارسنجی ورودی ══════════════ */

test("ضمانت‌نامهٔ کامل پذیرفته می‌شود", () => {
  const v = validateGuaranteeInput({
    code: "G-1", guaranteeType: "performance", bankName: "بانک ملت",
    guaranteeNo: "1402/55", amount: 5_000_000_000,
    issueDate: iso(-10), expiryDate: iso(300), contractAmount: 100_000_000_000,
  });
  assert.equal(v.ok, true);
  assert.deepEqual(v.issues, []);
});

test("شمارهٔ سند بانکی الزامی است — بدون آن استعلام ممکن نیست", () => {
  const v = validateGuaranteeInput({
    code: "G-1", guaranteeType: "performance", bankName: "ملت",
    guaranteeNo: "  ", amount: 100, issueDate: iso(-1), expiryDate: iso(10),
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.code === "E-CNT-GRT-NO"));
});

test("نوع نامعتبر رد می‌شود", () => {
  const v = validateGuaranteeInput({
    code: "G", guaranteeType: "invented", bankName: "ملت",
    guaranteeNo: "1", amount: 1, issueDate: iso(-1), expiryDate: iso(1),
  });
  assert.ok(v.issues.some((i) => i.code === "E-CNT-GRT-TYPE"));
});

test("انقضای پیش از صدور رد می‌شود", () => {
  const v = validateGuaranteeInput({
    code: "G", guaranteeType: "bid", bankName: "ملت", guaranteeNo: "1",
    amount: 1000, issueDate: iso(10), expiryDate: iso(5),
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.code === "E-CNT-GRT-DATE-ORDER"));
});

test("مبلغ صفر یا منفی رد می‌شود", () => {
  for (const amount of [0, -5]) {
    const v = validateGuaranteeInput({
      code: "G", guaranteeType: "bid", bankName: "ملت", guaranteeNo: "1",
      amount, issueDate: iso(-1), expiryDate: iso(5),
    });
    assert.ok(v.issues.some((i) => i.code === "E-CNT-GRT-AMOUNT"), `مبلغ ${amount}`);
  }
});

test("درصد غیرمرسوم هشدار است نه خطا — پیمان می‌تواند توافق دیگری داشته باشد", () => {
  const v = validateGuaranteeInput({
    code: "G", guaranteeType: "performance", bankName: "ملت", guaranteeNo: "1",
    amount: 50_000_000_000, issueDate: iso(-1), expiryDate: iso(100),
    contractAmount: 100_000_000_000,
  });
  assert.equal(v.ok, true, "هشدار نباید ثبت را ببندد");
  assert.ok(v.issues.some((i) => i.code === "W-CNT-GRT-PCT" && i.severity === "warning"));
});

test("درصد داخل بازهٔ تحمل هشدار نمی‌گیرد", () => {
  const v = validateGuaranteeInput({
    code: "G", guaranteeType: "performance", bankName: "ملت", guaranteeNo: "1",
    amount: 8_000_000_000, issueDate: iso(-1), expiryDate: iso(100),
    contractAmount: 100_000_000_000,
  });
  assert.equal(v.issues.filter((i) => i.code === "W-CNT-GRT-PCT").length, 0);
});

test("ضمانت‌نامهٔ پیش‌پرداخت از قاعدهٔ درصد معاف است", () => {
  const v = validateGuaranteeInput({
    code: "G", guaranteeType: "advance", bankName: "ملت", guaranteeNo: "1",
    amount: 20_000_000_000, issueDate: iso(-1), expiryDate: iso(100),
    contractAmount: 100_000_000_000,
  });
  assert.equal(v.issues.filter((i) => i.code === "W-CNT-GRT-PCT").length, 0);
});

/* ══════════════ ۵) دروازهٔ عملیات ══════════════ */

test("تمدید به تاریخ جلوتر مجاز است", () => {
  const r = canActOnGuarantee({ row: grt(), action: "extend", newExpiry: iso(400), now: NOW });
  assert.equal(r.ok, true);
});

test("تمدید به عقب رد می‌شود", () => {
  const r = canActOnGuarantee({ row: grt({ ExpiryDate: iso(120) }), action: "extend", newExpiry: iso(60), now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-CNT-GRT-EXTEND-BLOCKED");
  assert.ok(r.blockersFa.some((b) => b.includes("جلوتر")));
});

test("تمدید بدون تاریخ رد می‌شود", () => {
  const r = canActOnGuarantee({ row: grt(), action: "extend", now: NOW });
  assert.equal(r.ok, false);
});

test("تمدید پس از انقضا ممکن است ولی فاصلهٔ بی‌پوشش را اعلام می‌کند", () => {
  const r = canActOnGuarantee({
    row: grt({ ExpiryDate: iso(-12) }), action: "extend", newExpiry: iso(180), now: NOW,
  });
  assert.equal(r.ok, true);
  assert.ok(r.warningsFa.some((w) => w.includes("12 روز منقضی")));
});

test("آزادسازی ضمانت‌نامهٔ پیش‌پرداختِ بازیافت‌نشده بسته است", () => {
  const r = canActOnGuarantee({
    row: grt({ GuaranteeType: "advance" }), action: "release",
    advanceOutstanding: 3_000_000_000, now: NOW,
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-CNT-GRT-RELEASE-BLOCKED");
  assert.ok(r.blockersFa[0].includes("بازیافت‌نشده"));
});

test("پس از تسویهٔ پیش‌پرداخت، آزادسازی باز می‌شود", () => {
  const r = canActOnGuarantee({
    row: grt({ GuaranteeType: "advance" }), action: "release",
    advanceOutstanding: 0, now: NOW,
  });
  assert.equal(r.ok, true);
});

test("قید بازیافت فقط روی ضمانت‌نامهٔ پیش‌پرداخت است", () => {
  const r = canActOnGuarantee({
    row: grt({ GuaranteeType: "performance" }), action: "release",
    advanceOutstanding: 9_000_000_000, now: NOW,
  });
  assert.equal(r.ok, true, "وثیقهٔ حسن انجام تعهدات به بازیافت پیش‌پرداخت گره نمی‌خورد");
});

test("ضبط ضمانت‌نامهٔ منقضی بسته است — سند نزد بانک اعتبار ندارد", () => {
  const r = canActOnGuarantee({ row: grt({ ExpiryDate: iso(-3) }), action: "forfeit", now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-CNT-GRT-FORFEIT-BLOCKED");
});

test("ضبط ضمانت‌نامهٔ معتبر مجاز است", () => {
  const r = canActOnGuarantee({ row: grt(), action: "forfeit", now: NOW });
  assert.equal(r.ok, true);
});

test("هر عملی روی ضمانت‌نامهٔ آزادشده بسته است", () => {
  for (const action of ["extend", "release", "forfeit"]) {
    const r = canActOnGuarantee({
      row: grt({ Status: "released" }), action, newExpiry: iso(400), now: NOW,
    });
    assert.equal(r.ok, false, action);
    assert.equal(r.code, "E-CNT-GRT-ALREADY-RELEASED");
  }
});

test("هر عملی روی ضمانت‌نامهٔ ضبط‌شده بسته است", () => {
  const r = canActOnGuarantee({ row: grt({ Status: "forfeited" }), action: "release", now: NOW });
  assert.equal(r.code, "E-CNT-GRT-ALREADY-FORFEITED");
});

/* ══════════════ ۶) دفتر کل و پوشش‌سنجی ══════════════ */

test("دفتر خالی، نبودِ وثیقهٔ حسن انجام تعهدات را اعلام می‌کند", () => {
  const reg = guaranteeRegister({ rows: [], now: NOW });
  assert.equal(reg.totalAmount, 0);
  assert.ok(reg.coverageGapsFa.some((g) => g.includes("حسن انجام تعهدات")));
});

test("خلأ پوشش از نبودِ سطر پیدا می‌شود، نه از ردیف‌های موجود", () => {
  const reg = guaranteeRegister({
    rows: [grt({ GuaranteeType: "bid", Code: "B-1" })], now: NOW,
  });
  assert.equal(reg.items.length, 1);
  assert.ok(reg.coverageGapsFa.some((g) => g.includes("حسن انجام تعهدات")));
});

test("ضمانت‌نامهٔ منقضی پوشش نمی‌سازد", () => {
  const reg = guaranteeRegister({
    rows: [grt({ GuaranteeType: "performance", ExpiryDate: iso(-1) })], now: NOW,
  });
  assert.ok(reg.coverageGapsFa.some((g) => g.includes("حسن انجام تعهدات")));
  assert.equal(reg.expiredSilently, 1);
  assert.equal(reg.liveAmount, 0);
  assert.equal(reg.totalAmount, 5_000_000_000);
});

test("پیش‌پرداخت بازیافت‌نشده بدون وثیقه، خلأ است", () => {
  const reg = guaranteeRegister({
    rows: [grt()], advanceOutstanding: 4_000_000_000, now: NOW,
  });
  assert.ok(reg.coverageGapsFa.some((g) => g.includes("پیش‌پرداخت")));
});

test("با وثیقهٔ پیش‌پرداخت معتبر، خلأ برطرف می‌شود", () => {
  const reg = guaranteeRegister({
    rows: [grt(), grt({ Code: "G-2", GuaranteeType: "advance" })],
    advanceOutstanding: 4_000_000_000, now: NOW,
  });
  assert.equal(reg.coverageGapsFa.length, 0);
});

test("تجمیع به تفکیک نوع درست است", () => {
  const reg = guaranteeRegister({
    rows: [
      grt({ Code: "A", GuaranteeType: "performance", Amount: 1000 }),
      grt({ Code: "B", GuaranteeType: "performance", Amount: 2000 }),
      grt({ Code: "C", GuaranteeType: "advance", Amount: 500 }),
    ],
    now: NOW,
  });
  assert.equal(reg.byType.performance.count, 2);
  assert.equal(reg.byType.performance.amount, 3000);
  assert.equal(reg.byType.advance.amount, 500);
  assert.equal(reg.totalAmount, 3500);
});

test("شمار نزدیک‌به‌انقضا فقط زنده‌ها را می‌شمارد", () => {
  const reg = guaranteeRegister({
    rows: [
      grt({ Code: "A", ExpiryDate: iso(5) }),
      grt({ Code: "B", ExpiryDate: iso(5), Status: "released" }),
      grt({ Code: "C", ExpiryDate: iso(200) }),
    ],
    now: NOW,
  });
  assert.equal(reg.expiringSoon, 1);
});

test("پوشش کمتر از عرف هشدار می‌گیرد", () => {
  const reg = guaranteeRegister({
    rows: [grt({ Amount: 1_000_000_000 })],
    contractAmount: 100_000_000_000, now: NOW,
  });
  assert.ok(reg.warningsFa.some((w) => w.includes("از عرف کمتر")));
});

/* ══════════════ ۷) دفتر پیش‌پرداخت ══════════════ */

test("دفتر خالی تسویه‌شده نیست — هنوز شروع نشده", () => {
  const l = advanceLedger([]);
  assert.equal(l.paidTotal, 0);
  assert.equal(l.isSettled, false);
  assert.equal(l.recoveredPct, null);
});

test("جمع پرداخت و بازیافت درست است", () => {
  const l = advanceLedger([
    { InstallmentNo: 1, PaidAmount: 10_000, RecoveredToDate: 4_000, OutstandingAmount: 6_000 },
    { InstallmentNo: 2, PaidAmount: 5_000, RecoveredToDate: 1_000, OutstandingAmount: 4_000 },
  ]);
  assert.equal(l.paidTotal, 15_000);
  assert.equal(l.recoveredTotal, 5_000);
  assert.equal(l.outstanding, 10_000);
  assert.ok(Math.abs(l.recoveredPct - 33.33) < 0.02);
  assert.equal(l.isSettled, false);
  assert.deepEqual(l.warningsFa, []);
});

test("تسویهٔ کامل شناسایی می‌شود", () => {
  const l = advanceLedger([
    { InstallmentNo: 1, PaidAmount: 10_000, RecoveredToDate: 10_000, OutstandingAmount: 0 },
  ]);
  assert.equal(l.outstanding, 0);
  assert.equal(l.isSettled, true);
  assert.equal(l.recoveredPct, 100);
});

test("ناسازگاری ماندهٔ ثبت‌شده با محاسبه‌شده دیده می‌شود", () => {
  const l = advanceLedger([
    { InstallmentNo: 1, PaidAmount: 10_000, RecoveredToDate: 4_000, OutstandingAmount: 9_000 },
  ]);
  assert.ok(l.warningsFa.some((w) => w.includes("نمی‌خواند")));
  assert.equal(l.installments[0].outstanding, 6_000, "محاسبه ملاک است نه ستون ذخیره‌شده");
});

test("بازیافت بیش از پرداخت هشدار می‌گیرد", () => {
  const l = advanceLedger([
    { InstallmentNo: 1, PaidAmount: 1_000, RecoveredToDate: 1_500, OutstandingAmount: -500 },
  ]);
  assert.ok(l.warningsFa.some((w) => w.includes("بیشتر است")));
});

/* ══════════════ ۸) محاسبهٔ بازیافت از صورت‌وضعیت ══════════════ */

test("درصد قراردادی اعمال می‌شود", () => {
  const r = advanceRecovery({ grossAmount: 100_000, outstanding: 50_000, recoveryPct: 20 });
  assert.equal(r.recoverable, 20_000);
  assert.equal(r.outstandingAfter, 30_000);
  assert.equal(r.isFinalRecovery, false);
  assert.deepEqual(r.warningsFa, []);
});

test("سقف ماندهٔ بازیافت‌نشده رعایت می‌شود — کارفرما بدهکار نمی‌شود", () => {
  const r = advanceRecovery({ grossAmount: 100_000, outstanding: 5_000, recoveryPct: 20 });
  assert.equal(r.recoverable, 5_000, "بیش از بدهی کسر نمی‌شود");
  assert.equal(r.outstandingAfter, 0);
  assert.equal(r.isFinalRecovery, true);
  assert.ok(r.warningsFa.some((w) => w.includes("محدود شد")));
});

test("نرخ ثبت‌نشده به پیش‌فرض می‌افتد و اعلام می‌کند", () => {
  const r = advanceRecovery({ grossAmount: 100_000, outstanding: 90_000 });
  assert.equal(r.appliedPct, ADVANCE_DEFAULT_RECOVERY_PCT);
  assert.equal(r.recoverable, 20_000);
  assert.ok(r.warningsFa.some((w) => w.includes("پیش‌فرض")));
});

test("نرخ بیش از صد درصد به صد محدود می‌شود", () => {
  const r = advanceRecovery({ grossAmount: 1_000, outstanding: 10_000, recoveryPct: 150 });
  assert.equal(r.appliedPct, 100);
  assert.equal(r.recoverable, 1_000);
});

test("پیش‌پرداخت تسویه‌شده کسری ندارد", () => {
  const r = advanceRecovery({ grossAmount: 100_000, outstanding: 0, recoveryPct: 20 });
  assert.equal(r.recoverable, 0);
  assert.ok(r.messageFa.includes("تسویه"));
});

test("صورت‌وضعیت صفر بازیافتی نمی‌سازد", () => {
  const r = advanceRecovery({ grossAmount: 0, outstanding: 50_000, recoveryPct: 20 });
  assert.equal(r.recoverable, 0);
  assert.equal(r.outstandingAfter, 50_000);
});

test("ماندهٔ منفی مثل صفر رفتار می‌کند", () => {
  const r = advanceRecovery({ grossAmount: 100_000, outstanding: -500, recoveryPct: 20 });
  assert.equal(r.recoverable, 0);
  assert.equal(r.outstandingBefore, 0);
});

test("زنجیرهٔ چند صورت‌وضعیت به تسویهٔ دقیق می‌رسد", () => {
  let outstanding = 100_000;
  const gross = 150_000;
  let total = 0;
  for (let i = 0; i < 10 && outstanding > 0; i += 1) {
    const r = advanceRecovery({ grossAmount: gross, outstanding, recoveryPct: 20 });
    total += r.recoverable;
    outstanding = r.outstandingAfter;
  }
  assert.equal(outstanding, 0);
  assert.equal(total, 100_000, "مجموع کسرها دقیقاً برابر پیش‌پرداخت است");
});

/* ══════════════ ۹) اعتبارسنجی قسط ══════════════ */

test("قسط معتبر پذیرفته می‌شود", () => {
  const v = validateAdvanceInput({
    installmentNo: 1, paidAmount: 10_000_000_000, recoveryPct: 20,
    contractAmount: 100_000_000_000, alreadyPaid: 0, existingNos: [],
  });
  assert.equal(v.ok, true);
  assert.deepEqual(v.issues, []);
});

test("شمارهٔ قسط تکراری رد می‌شود", () => {
  const v = validateAdvanceInput({
    installmentNo: 2, paidAmount: 1000, existingNos: [1, 2],
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.code === "E-CNT-ADV-DUPLICATE"));
});

test("شمارهٔ قسط غیرصحیح رد می‌شود", () => {
  for (const no of [0, -1, 1.5]) {
    const v = validateAdvanceInput({ installmentNo: no, paidAmount: 1000 });
    assert.ok(v.issues.some((i) => i.code === "E-CNT-ADV-NO"), `شماره ${no}`);
  }
});

test("نرخ بازیافت بیرون بازه رد می‌شود", () => {
  const v = validateAdvanceInput({ installmentNo: 1, paidAmount: 1000, recoveryPct: 120 });
  assert.ok(v.issues.some((i) => i.code === "E-CNT-ADV-PCT"));
});

test("عبور از سقف مرسوم هشدار است نه خطا", () => {
  const v = validateAdvanceInput({
    installmentNo: 2, paidAmount: 20_000_000_000,
    contractAmount: 100_000_000_000, alreadyPaid: 15_000_000_000,
  });
  assert.equal(v.ok, true);
  assert.ok(v.issues.some((i) => i.code === "W-CNT-ADV-CAP" && i.severity === "warning"));
});

test("سقف روی مجموع سنجیده می‌شود نه تک قسط", () => {
  const v = validateAdvanceInput({
    installmentNo: 3, paidAmount: 1_000_000_000,
    contractAmount: 100_000_000_000, alreadyPaid: 5_000_000_000,
  });
  assert.equal(v.issues.filter((i) => i.code === "W-CNT-ADV-CAP").length, 0);
});

/* ══════════════ ۱۰) سلامت وثیقه‌ای ══════════════ */

test("پوشش کامل سبز است", () => {
  const register = guaranteeRegister({
    rows: [grt({ ExpiryDate: iso(200) })], now: NOW,
  });
  const h = guaranteeHealth({ register });
  assert.equal(h.status, "green");
  assert.equal(h.gapCount, 0);
  assert.ok(h.headlineFa.includes("کامل"));
});

test("نزدیک انقضا کهربایی است", () => {
  const register = guaranteeRegister({ rows: [grt({ ExpiryDate: iso(9) })], now: NOW });
  const h = guaranteeHealth({ register });
  assert.equal(h.status, "amber");
  assert.equal(h.expiringSoon, 1);
});

test("خلأ پوشش قرمز است، حتی بدون انقضای نزدیک", () => {
  const register = guaranteeRegister({ rows: [], now: NOW });
  assert.equal(guaranteeHealth({ register }).status, "red");
});

test("انقضای سکوت‌کرده قرمز است", () => {
  const register = guaranteeRegister({
    rows: [grt({ ExpiryDate: iso(200) }), grt({ Code: "X", GuaranteeType: "bid", ExpiryDate: iso(-1) })],
    now: NOW,
  });
  const h = guaranteeHealth({ register });
  assert.equal(h.status, "red");
  assert.equal(h.expiredSilently, 1);
});

test("پیش‌پرداخت بازیافت‌نشده در سرخط می‌آید", () => {
  const register = guaranteeRegister({
    rows: [grt({ ExpiryDate: iso(200) }), grt({ Code: "A", GuaranteeType: "advance", ExpiryDate: iso(200) })],
    advanceOutstanding: 7_500,
    now: NOW,
  });
  const advance = advanceLedger([
    { InstallmentNo: 1, PaidAmount: 10_000, RecoveredToDate: 2_500, OutstandingAmount: 7_500 },
  ]);
  const h = guaranteeHealth({ register, advance });
  assert.ok(h.headlineFa.includes("7500") || h.headlineFa.includes("پیش‌پرداخت"));
});
