/* آزمون موتور صورت‌وضعیت (D4).
 *
 * تمرکز بر جاهایی است که واقعاً پول اشتباه حساب می‌شود: ترتیب آبشار
 * کسورات، سقف بازیافت پیش‌پرداخت، ارزش افزودهٔ افزوده‌شونده، و ماشین
 * حالتی که نباید اجازه دهد طرف اشتباه مدرک را تأیید کند. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDeductions,
  computeIpc,
  computeIpcLines,
  ipcNextActions,
  ipcTransition,
  isIpcLocked,
  nextIpcSerial,
} from "./cntLogic.js";

/* ───────────────────────── ماشین حالت گردش کار ───────────────────────── */

test("پیمانکار صورت‌وضعیت پیش‌نویس را ارسال می‌کند", () => {
  const r = ipcTransition("draft", "submit", "contractor");
  assert.equal(r.ok, true);
  assert.equal(r.to, "contractor_submitted");
});

test("مشاور نمی‌تواند صورت‌وضعیتی را که هنوز ارسال نشده تأیید کند", () => {
  const r = ipcTransition("draft", "approve", "consultant");
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-CNT-BAD-TRANSITION");
});

test("کارفرما نمی‌تواند جای مشاور تأیید اول را انجام دهد", () => {
  const r = ipcTransition("contractor_submitted", "approve", "employer");
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-CNT-WRONG-ACTOR");
  assert.match(r.messageFa, /مشاور/);
});

test("زنجیرهٔ کامل تأیید تا پرداخت", () => {
  let state = "draft";
  for (const [action, actor, expected] of [
    ["submit", "contractor", "contractor_submitted"],
    ["approve", "consultant", "consultant_approved"],
    ["approve", "employer", "approved"],
    ["pay", "employer", "paid"],
  ]) {
    const r = ipcTransition(state, action, actor);
    assert.equal(r.ok, true, `${state} → ${action}`);
    assert.equal(r.to, expected);
    state = r.to;
  }
});

test("بازگشت برای اصلاح، مدرک را به پیش‌نویس می‌برد نه به گام قبل", () => {
  /* اگر به گام قبل برگردد، پیمانکار می‌تواند پس از تأیید مشاور مبلغ را
   * عوض کند بدون اینکه مشاور دوباره ببیند. */
  const r = ipcTransition("consultant_approved", "return_for_correction", "employer");
  assert.equal(r.ok, true);
  assert.equal(r.to, "draft");
});

test("صورت‌وضعیت مصوب و پرداخت‌شده قفل است", () => {
  assert.equal(isIpcLocked("approved"), true);
  assert.equal(isIpcLocked("paid"), true);
  assert.equal(isIpcLocked("rejected"), true);
  assert.equal(isIpcLocked("draft"), false);
  assert.equal(isIpcLocked("contractor_submitted"), false);
});

test("اقدام‌های مجاز بعدی بر اساس نقش فیلتر می‌شود", () => {
  const all = ipcNextActions("contractor_submitted");
  assert.deepEqual(all.sort(), ["approve", "reject", "return_for_correction"]);
  assert.deepEqual(ipcNextActions("contractor_submitted", "contractor"), []);
  assert.deepEqual(ipcNextActions("paid"), []);
});

/* ───────────────────────── آبشار کسورات ───────────────────────── */

test("همهٔ درصدها روی مبنا اعمال می‌شوند نه زنجیره‌ای", () => {
  const rows = computeDeductions(1_000_000, {
    insurancePct: 5,
    taxPct: 3,
    retainagePct: 10,
  });
  const by = Object.fromEntries(rows.map((r) => [r.DeductionType, r]));
  assert.equal(by.insurance.Amount, 50_000);
  assert.equal(by.withholding_tax.Amount, 30_000);
  assert.equal(by.retainage.Amount, 100_000);
  /* همه باید مبنای یکسان داشته باشند — نشانهٔ زنجیره‌ای نبودن. */
  assert.ok(rows.every((r) => r.BaseAmount === 1_000_000));
});

test("بازیافت پیش‌پرداخت از ماندهٔ واقعی بیشتر نمی‌شود", () => {
  const rows = computeDeductions(1_000_000, {
    advanceRecoveryPct: 20,
    advanceOutstanding: 50_000,
  });
  const adv = rows.find((r) => r.DeductionType === "advance_recovery");
  /* ۲۰٪ یعنی ۲۰۰٬۰۰۰ ولی فقط ۵۰٬۰۰۰ مانده. */
  assert.equal(adv.Amount, 50_000);
  assert.match(adv.NoteFa, /محدود به مانده/);
});

test("پیش‌پرداخت تسویه‌شده اصلاً ردیف کسور نمی‌سازد", () => {
  const rows = computeDeductions(1_000_000, {
    advanceRecoveryPct: 20,
    advanceOutstanding: 0,
  });
  assert.equal(rows.some((r) => r.DeductionType === "advance_recovery"), false);
});

test("بیمه و مالیات قانونی علامت می‌خورند و سپرده نمی‌خورد", () => {
  const rows = computeDeductions(1_000_000, { insurancePct: 5, taxPct: 3, retainagePct: 10 });
  const by = Object.fromEntries(rows.map((r) => [r.DeductionType, r]));
  assert.equal(by.insurance.IsStatutory, true);
  assert.equal(by.withholding_tax.IsStatutory, true);
  assert.equal(by.retainage.IsStatutory, false);
});

test("درصد صفر یا منفی ردیف کسور نمی‌سازد", () => {
  const rows = computeDeductions(1_000_000, { insurancePct: 0, taxPct: null, retainagePct: -5 });
  assert.deepEqual(rows, []);
});

test("نرخ بیمهٔ ۱٫۶ درصدی هم درست حساب می‌شود", () => {
  const rows = computeDeductions(1_000_000, { insurancePct: 1.6 });
  assert.equal(rows[0].Amount, 16_000);
});

/* ───────────────────────── تجمیع ردیف‌ها ───────────────────────── */

test("ردیف با عدم انطباق باز از جمع کنار می‌رود ولی ناپدید نمی‌شود", () => {
  const r = computeIpcLines([
    { BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 100, prevQty: 0, cumQty: 10, QualityGateStatus: "passed" },
    { BoqItemId: "b2", PricingBasis: "unit_price", UnitRate: 100, prevQty: 0, cumQty: 10, QualityGateStatus: "open_ncr" },
  ]);
  assert.equal(r.grossCurrent, 1000);
  assert.equal(r.excludedCount, 1);
  assert.equal(r.lines.length, 2, "ردیف مردود باید در خروجی بماند");
  const blocked = r.lines.find((l) => l.BoqItemId === "b2");
  assert.equal(blocked.included, false);
  assert.match(blocked.excludeReasonFa, /عدم انطباق/);
});

test("ردیف دورزده‌شده با مجوز، در جمع می‌آید", () => {
  const r = computeIpcLines([
    { BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 100, prevQty: 0, cumQty: 5, QualityGateStatus: "overridden" },
  ]);
  assert.equal(r.grossCurrent, 500);
  assert.equal(r.excludedCount, 0);
});

test("ردیف مقطوع و فهرست‌بهایی در یک صورت‌وضعیت با هم جمع می‌شوند", () => {
  const r = computeIpcLines([
    { BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 200, prevQty: 10, cumQty: 15, QualityGateStatus: "passed" },
    { BoqItemId: "m1", PricingBasis: "lump_sum", LumpSumAmount: 400_000, prevPct: 25, cumPct: 40, QualityGateStatus: "passed" },
  ]);
  /* ۵ واحد × ۲۰۰ = ۱۰۰۰ · ۱۵٪ از ۴۰۰٬۰۰۰ = ۶۰٬۰۰۰ */
  assert.equal(r.grossCurrent, 61_000);
});

test("اصلاح کاهشی مقدار تجمعی، کارکرد جاری منفی می‌دهد", () => {
  /* متره اضافی دوره قبل که این دوره برگشت می‌خورد. */
  const r = computeIpcLines([
    { BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 100, prevQty: 20, cumQty: 15, QualityGateStatus: "passed" },
  ]);
  assert.equal(r.grossCurrent, -500);
});

/* ───────────────────────── محاسبهٔ کامل ───────────────────────── */

test("ارزش افزوده افزوده می‌شود نه کسر", () => {
  const r = computeIpc({
    lines: [{ BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 1000, prevQty: 0, cumQty: 1000, QualityGateStatus: "passed" }],
    deductions: { vatPct: 10 },
  });
  assert.equal(r.subtotal, 1_000_000);
  assert.equal(r.vatAmount, 100_000);
  assert.equal(r.totalDeductions, 0);
  assert.equal(r.netPayable, 1_100_000, "ارزش افزوده باید به خالص اضافه شود");
});

test("خالص پرداختنی = مبنا − کسورات + ارزش افزوده", () => {
  const r = computeIpc({
    lines: [{ BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 1000, prevQty: 0, cumQty: 1000, QualityGateStatus: "passed" }],
    deductions: { insurancePct: 5, taxPct: 3, retainagePct: 10, vatPct: 9 },
  });
  assert.equal(r.subtotal, 1_000_000);
  assert.equal(r.totalDeductions, 180_000); // ۵۰ + ۳۰ + ۱۰۰ هزار
  assert.equal(r.vatAmount, 90_000);
  assert.equal(r.netPayable, 910_000);
});

test("تعدیل و مابه‌التفاوت پیش از کسورات وارد مبنا می‌شوند", () => {
  const r = computeIpc({
    lines: [{ BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 1000, prevQty: 0, cumQty: 1000, QualityGateStatus: "passed" }],
    adjustmentAmount: 200_000,
    materialDiffAmount: 50_000,
    deductions: { retainagePct: 10 },
  });
  assert.equal(r.subtotal, 1_250_000);
  /* سپرده باید روی مبنای شامل تعدیل باشد، نه فقط کارکرد خام. */
  assert.equal(r.totalDeductions, 125_000);
  assert.equal(r.netPayable, 1_125_000);
});

test("صورت‌وضعیت بدون هیچ ردیف قابل قبول، خالص صفر می‌دهد", () => {
  const r = computeIpc({
    lines: [{ BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 100, prevQty: 0, cumQty: 10, QualityGateStatus: "no_ir" }],
    deductions: { insurancePct: 5, vatPct: 9 },
  });
  assert.equal(r.grossCurrent, 0);
  assert.equal(r.netPayable, 0);
  assert.equal(r.excludedCount, 1);
});

test("محاسبه با ورودی خالی نمی‌شکند", () => {
  const r = computeIpc({ lines: [] });
  assert.equal(r.netPayable, 0);
  assert.deepEqual(r.deductions, []);
});

/* ───────────────────────── سریال ───────────────────────── */

test("سریال بعدی از بیشینهٔ موجود یک واحد جلوتر است", () => {
  assert.equal(nextIpcSerial([]), 1);
  assert.equal(nextIpcSerial([{ SerialNo: 1 }, { SerialNo: 2 }]), 3);
  /* حتی اگر شماره‌ها پیوسته نباشند — صورت‌وضعیت باطل‌شده جا می‌گذارد. */
  assert.equal(nextIpcSerial([{ SerialNo: 1 }, { SerialNo: 5 }]), 6);
});
