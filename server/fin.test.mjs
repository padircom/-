import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIN_FORMULA_VERSION,
  abcAnalysis,
  agingBucket,
  bidScore,
  cbsRollup,
  ccc,
  commitmentView,
  compareSnapshots,
  computeEvm,
  createEvmSnapshot,
  distributeBudget,
  dpo,
  dso,
  earnedSchedule,
  eoq,
  escalate,
  finEws,
  irr,
  isAnomaly,
  materialNeedDate,
  movingAverage,
  mrpRun,
  needsAutoCr,
  npv,
  payback,
  paymentSchedule,
  prBudgetCheck,
  progressInvoice,
  reorderPoint,
  reserveDraw,
  safetyStock,
  stockoutRisk,
  threeWayMatch,
  toBase,
  varianceSeverity,
  vendorScore,
  verifySnapshot,
} from "./finLogic.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

/* ── چندارزی ── */
test("چندارزی: تبدیل به ارز پایه و خطای نرخ ناموجود", () => {
  near(toBase({ amount: 100, currency: "USD" }, { USD: 500000 }), 50000000);
  near(toBase({ amount: 7, currency: "IRR" }, {}), 7);
  assert.throws(() => toBase({ amount: 1, currency: "EUR" }, { USD: 1 }));
});

test("تعدیل با شاخص", () => near(escalate(1000, 100, 125), 1250));

/* ── CBS و PMB ── */
test("CBS: جمع چندسطحی", () => {
  const r = cbsRollup([
    { code: "1", nameFa: "پروژه", kind: "direct", category: "labor", budget: 0 },
    { code: "1.1", parent: "1", nameFa: "الف", kind: "direct", category: "labor", budget: 100 },
    { code: "1.1.1", parent: "1.1", nameFa: "الف-۱", kind: "direct", category: "material", budget: 40 },
    { code: "1.2", parent: "1", nameFa: "ب", kind: "indirect", category: "overhead", budget: 60 },
  ]);
  assert.equal(r["1.1"], 140);
  assert.equal(r["1"], 200);
});

test("PMB: هر منحنی مجموعش برابر کل بودجه است", () => {
  for (const c of ["linear", "bell", "front", "back", "scurve"]) {
    const d = distributeBudget(1000, 8, c);
    assert.equal(d.length, 8);
    near(d.reduce((a, b) => a + b, 0), 1000, 1e-9);
  }
  near(distributeBudget(100, 4, "custom", [1, 1, 3, 5]).at(-1), 50);
});

/* ── EVM ── */
test("EVM: شاخص‌های پایه و پنج EAC", () => {
  const r = computeEvm({ bac: 1000, pv: 500, ev: 450, ac: 500, reserveRemaining: 50 });
  assert.equal(r.sv, -50);
  assert.equal(r.cv, -50);
  near(r.spi, 0.9);
  near(r.cpi, 0.9);
  near(r.eac.ate, 1050);
  near(r.eac.cpi, 1111.111111, 1e-4);
  near(r.eac.cpiSpi, 500 + 550 / 0.81, 1e-4);
  near(r.eac.weighted, 500 + 550 / 0.9, 1e-4);
  near(r.eac.riskAdj, r.eac.cpiSpi + 50, 1e-4);
  near(r.vac, 1000 - r.eac.cpi, 1e-4);
  near(r.tcpiBac, 550 / 500);
  assert.equal(r.formulaVersion, FIN_FORMULA_VERSION);
});

test("EVM: حالت Schedule-Only وقتی AC نداریم", () => {
  const r = computeEvm({ bac: 1000, pv: 400, ev: 380 });
  assert.equal(r.scheduleOnly, true);
  assert.equal(r.cv, null);
  assert.equal(r.cpi, null);
  assert.equal(r.eac.ate, null);
  near(r.spi, 0.95);
});

test("Earned Schedule و SPI(t)", () => {
  const curve = [100, 100, 100, 100];
  assert.equal(earnedSchedule(200, curve), 2);
  near(earnedSchedule(250, curve), 2.5);
  assert.equal(earnedSchedule(0, curve), 0);
  assert.equal(earnedSchedule(999, curve), 4);
  const r = computeEvm({ bac: 400, pv: 300, ev: 250, ac: 260, pvCurve: curve, period: 3 });
  near(r.spiT, 2.5 / 3, 1e-9);
});

/* ── انحراف و روند ── */
test("شدت انحراف و CR خودکار", () => {
  assert.equal(varianceSeverity(3), "minor");
  assert.equal(varianceSeverity(-12), "major");
  assert.equal(varianceSeverity(25), "critical");
  assert.equal(needsAutoCr(varianceSeverity(-12)), true);
  assert.equal(needsAutoCr(varianceSeverity(4)), false);
});

test("میانگین متحرک و ناهنجاری", () => {
  near(movingAverage([1, 2, 3, 4], 2), 3.5);
  assert.equal(movingAverage([]), null);
  assert.equal(isAnomaly([10, 10, 10, 11, 9], 40), true);
  assert.equal(isAnomaly([10, 10, 10], 10), false);
});

/* ── نقدینگی ── */
test("سطل سنی مطالبات", () => {
  assert.equal(agingBucket(10), "0-30");
  assert.equal(agingBucket(61), "61-90");
  assert.equal(agingBucket(120), "90+");
});

test("DSO/DPO/CCC و NPV/IRR/Payback", () => {
  near(dso(100, 365, 365), 100);
  near(dpo(50, 365, 365), 50);
  near(ccc(60, 30, 45), 45);
  near(npv(0, [-100, 50, 70]), 20);
  const r = irr([-100, 60, 60]);
  assert.ok(r > 0.12 && r < 0.14, String(r));
  assert.equal(irr([1, 2, 3]), null);
  near(payback([-100, 50, 50]), 2, 1e-9);
  assert.equal(payback([-100, 10]), null);
});

/* ── تعهد و تطابق سه‌جانبه ── */
test("زنجیره تعهد: Committed/Accrued/Actual", () => {
  const v = commitmentView({ poValue: 1000, grnValue: 600, invoicedValue: 400, paidValue: 250 }, 900);
  assert.equal(v.committed, 600);
  assert.equal(v.accrued, 200);
  assert.equal(v.actual, 400);
  assert.equal(v.outstandingPayment, 150);
  assert.equal(v.overCommitted, false);
  assert.equal(commitmentView({ poValue: 1000, grnValue: 0, invoicedValue: 0, paidValue: 0 }, 500).overCommitted, true);
});

test("3-Way Match: تطابق، انحراف قیمت و فاکتور بیش از رسید", () => {
  assert.equal(threeWayMatch({ qty: 100, price: 10 }, { qty: 100 }, { qty: 100, price: 10 }).ok, true);
  assert.equal(threeWayMatch({ qty: 100, price: 10 }, { qty: 100 }, { qty: 100, price: 10.3 }).ok, true);
  const bad = threeWayMatch({ qty: 100, price: 10 }, { qty: 100 }, { qty: 100, price: 12 });
  assert.equal(bad.ok, false);
  assert.ok(bad.reasons.includes("price_mismatch"));
  assert.ok(threeWayMatch({ qty: 100, price: 10 }, { qty: 80 }, { qty: 100, price: 10 }).reasons.includes("invoiced_more_than_received"));
});

/* ── PR و MRP ── */
test("تاریخ نیاز کالا = شروع فعالیت − لیدتایم − بافر", () => {
  assert.equal(materialNeedDate("2026-06-01", 30, 5), "2026-04-27");
  assert.equal(materialNeedDate("2026-03-10", 0, 0), "2026-03-10");
});

test("MRP: فقط کسری واقعی PR می‌سازد", () => {
  const s = mrpRun([
    { materialCode: "CEM", requiredQty: 100, onHand: 20, onOrder: 10, safetyStock: 15, leadTimeDays: 20, activityStart: "2026-05-20" },
    { materialCode: "STL", requiredQty: 50, onHand: 60, onOrder: 0, safetyStock: 5, leadTimeDays: 40, activityStart: "2026-07-01" },
  ]);
  assert.equal(s.length, 1);
  assert.equal(s[0].materialCode, "CEM");
  assert.equal(s[0].orderQty, 85);
  assert.equal(s[0].needDate, "2026-05-20");
  assert.equal(s[0].releaseDate, "2026-04-27");
});

test("PR بدون بودجه رد می‌شود مگر با مجوز", () => {
  assert.equal(prBudgetCheck(100, 200).ok, true);
  assert.equal(prBudgetCheck(300, 200).ok, false);
  assert.equal(prBudgetCheck(300, 200).reason, "over_budget");
  assert.equal(prBudgetCheck(300, 200, true).ok, true);
});

/* ── انبار ── */
test("ذخیره ایمنی، ROP و EOQ", () => {
  const ss = safetyStock(10, 16, 5);
  near(ss, 30);
  near(reorderPoint(10, 5, ss), 80);
  near(eoq(10000, 50, 2), 707.10678, 1e-4);
  assert.equal(eoq(1000, 10, 0), 0);
});

test("ABC و ریسک کسری", () => {
  const abc = abcAnalysis([
    { code: "A1", annualValue: 700 },
    { code: "B1", annualValue: 200 },
    { code: "C1", annualValue: 60 },
    { code: "C2", annualValue: 40 },
  ]);
  assert.equal(abc.A1, "A");
  assert.equal(abc.B1, "B");
  assert.equal(abc.C2, "C");
  assert.equal(stockoutRisk(50, 10, 8), true);
  assert.equal(stockoutRisk(200, 10, 8), false);
});

/* ── Snapshot ── */
test("Snapshot: تغییرناپذیر، هش‌دار و نسخه‌دار", () => {
  const snap = createEvmSnapshot("c1-p1", "2026-09-08", { bac: 1000, pv: 500, ev: 450, ac: 500 }, "2026-09-08T10:00:00Z");
  assert.equal(snap.frozen, true);
  assert.equal(snap.formulaVersion, FIN_FORMULA_VERSION);
  assert.equal(verifySnapshot(snap).valid, true);
  assert.throws(() => {
    "use strict";
    snap.result.cpi = 2;
  });
  const tampered = { ...snap, result: { ...snap.result, cpi: 1.5 } };
  assert.equal(verifySnapshot(tampered).valid, false);
  assert.equal(verifySnapshot({ ...snap, formulaVersion: "fin-v0" }).valid, false);
});

test("مقایسه Snapshot با نسخه فرمول متفاوت ممنوع است", () => {
  const a = createEvmSnapshot("p", "2026-08-08", { bac: 1000, pv: 400, ev: 380, ac: 400 });
  const b = createEvmSnapshot("p", "2026-09-08", { bac: 1000, pv: 500, ev: 450, ac: 500 });
  const cmp = compareSnapshots(a, b);
  assert.equal(cmp.comparable, true);
  assert.ok(cmp.deltaCpi < 0);
  assert.equal(compareSnapshots(a, { ...b, formulaVersion: "fin-v2" }).comparable, false);
});

/* ── تأمین‌کننده و پرداخت ── */
test("امتیاز تأمین‌کننده و لیست سیاه", () => {
  const good = vendorScore({ onTimePct: 95, qualityPct: 90, pricePct: 80, responsePct: 85, hsePct: 90 });
  assert.equal(good.grade, "A");
  assert.equal(good.blacklisted, false);
  assert.equal(vendorScore({ onTimePct: 30, qualityPct: 30, pricePct: 40, responsePct: 50, hsePct: 40 }).blacklisted, true);
});

test("امتیاز مناقصه: قیمت پایین‌تر امتیاز بیشتر", () => {
  const a = bidScore(90, 100, 100);
  const b = bidScore(90, 125, 100);
  assert.ok(a > b);
});

test("زمان‌بندی پرداخت و صورت‌وضعیت", () => {
  const sch = paymentSchedule("2026-01-01", 1000, [
    { label: "پیش‌پرداخت", pct: 20, offsetDays: 0 },
    { label: "تسویه", pct: 80, offsetDays: 60 },
  ]);
  assert.equal(sch[0].amount, 200);
  assert.equal(sch[1].dueDate, "2026-03-02");
  const inv = progressInvoice(1000, 10, 20, 5);
  assert.equal(inv.retention, 100);
  assert.equal(inv.netPayable, 650);
});

test("برداشت از ذخیره فقط با مجوز DoA", () => {
  assert.equal(reserveDraw(100, 50).ok, false);
  assert.equal(reserveDraw(100, 500, "sponsor").reason, "insufficient_reserve");
  const r = reserveDraw(100, 40, "sponsor");
  assert.equal(r.ok, true);
  assert.equal(r.remaining, 60);
});

/* ── EWS ── */
test("EWS مالی/تأمین هشدارهای بحرانی را می‌سازد", () => {
  const alerts = finEws({ cpi: 0.8, spi: 0.8, vacPct: -15, arOverdueDays: 120, poDelayDays: 10, vendorScore: 50, emergencyPrRatio: 20, reorderReached: true, stockout: true, wastagePct: 7 });
  assert.equal(alerts.length, 10);
  assert.ok(alerts.every((a) => a.code.startsWith("EWS-")));
  assert.equal(finEws({ cpi: 1.05, spi: 1.02 }).length, 0);
});
