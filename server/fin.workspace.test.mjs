/**
 * LIVE-1 — مدل نمایش میز کار d5 (src/services/finWorkspace.ts).
 * هدف: هیچ عدد کلیدی ساختگی نماند و هر عدد بی‌داده «null» باشد نه صفر.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  FIN_SAMPLE,
  buildFinView,
  committedForAccount,
  cumulativeMatch,
  defaultFinSettings,
  evmModel,
  prApprover,
  resolveSettings,
  safeBase,
} from "./finWsLogic.js";
import { cbsAvailable } from "./finLogic.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

const emptyWs = (over = {}) => ({
  projectId: "t", settings: defaultFinSettings("2026-09-08"), accounts: [], transactions: [], prs: [], pos: [],
  stock: [], receivables: [], snapshots: [], transfers: [], ...over,
});

/** نمونه با Actual/Committed مثل پس از بارگذاری سرور. */
function sampleWs() {
  const rates = resolveSettings(FIN_SAMPLE.settings).Rates;
  const accounts = FIN_SAMPLE.accounts.map((a) => ({ ...a, Committed: committedForAccount(a.Code, FIN_SAMPLE.pos, rates), Actual: 0 }));
  const transactions = FIN_SAMPLE.transactions.map((t) => ({ ...t, BaseAmount: safeBase(t.Amount, t.Currency, rates) }));
  for (const t of transactions) accounts.find((a) => a.Code === t.CostAccountCode).Actual += t.BaseAmount;
  return emptyWs({ settings: FIN_SAMPLE.settings, accounts, transactions, prs: FIN_SAMPLE.prs, pos: FIN_SAMPLE.pos, stock: FIN_SAMPLE.stock, receivables: FIN_SAMPLE.receivables });
}

test("پروژهٔ خالی: empty=true و شاخص‌های بی‌داده null (نه صفر جعلی)", () => {
  const v = buildFinView(emptyWs());
  assert.equal(v.empty, true);
  assert.equal(v.bac, 0);
  assert.equal(v.evKnown, false);
  assert.equal(v.dso, null);
  assert.equal(v.dpo, null);
  assert.equal(v.dio, null);
  assert.equal(v.ccc, null);
  assert.equal(v.emergencyPct, null);
  assert.deepEqual(v.alerts, []);
});

test("EV = Σ(بودجهٔ حساب × پیشرفت فیزیکی) — نه PV×0.92", () => {
  const ws = sampleWs();
  const em = evmModel(ws);
  const expected = ws.accounts.filter((a) => a.Kind !== "reserve").reduce((s, a) => s + (a.Budget * (a.ProgressPct ?? 0)) / 100, 0);
  near(em.ev, expected);
  assert.notEqual(Math.round(em.ev), Math.round(em.pvCum * 0.92));
  assert.equal(em.bac, 358_000_000_000);
  assert.equal(em.reserve, 18_000_000_000);
  near(em.pmb.reduce((a, b) => a + b, 0), 340_000_000_000);
});

test("بدون پیشرفت ثبت‌شده، CPI/SPI در هشدار دخالت نمی‌کند", () => {
  const ws = sampleWs();
  ws.accounts = ws.accounts.map((a) => ({ ...a, ProgressPct: null }));
  const v = buildFinView(ws);
  assert.equal(v.evKnown, false);
  assert.ok(!v.alerts.some((a) => a.code === "EWS-FIN-01" || a.code === "EWS-FIN-02"));
});

test("بودجهٔ در دسترس PR = Σبودجه − تعهد − واقعی در زیردرخت (نه بودجه − AC×0.2)", () => {
  const nodes = [
    { code: "1", parent: null, budget: 0, committed: 0, actual: 0 },
    { code: "1.2", parent: "1", budget: 0, committed: 0, actual: 0 },
    { code: "1.2.1", parent: "1.2", budget: 100, committed: 30, actual: 20 },
    { code: "1.2.2", parent: "1.2", budget: 50, committed: 0, actual: 60 },
  ];
  assert.equal(cbsAvailable(nodes, "1.2.1"), 50);
  assert.equal(cbsAvailable(nodes, "1.2"), 40);
  assert.equal(cbsAvailable(nodes, "9"), null);
  /* حلقهٔ داده نباید قفل کند */
  assert.equal(cbsAvailable([{ code: "a", parent: "b", budget: 1, committed: 0, actual: 0 }, { code: "b", parent: "a", budget: 2, committed: 0, actual: 0 }], "a"), 3);
});

test("تطابق سه‌جانبهٔ تجمعی: تحویل جزئی مسدود نیست؛ فاکتور بیش از رسید یا انحراف قیمت مسدود است", () => {
  const base = { PoNo: "P", VendorName: "v", TitleFa: "t", Status: "issued", Quantity: 100, UnitPrice: 10 };
  assert.equal(cumulativeMatch({ ...base, InvoicedQty: 0 }), null);
  assert.equal(cumulativeMatch({ ...base, ReceivedQty: 40, InvoicedQty: 30 }).ok, true);
  assert.deepEqual(cumulativeMatch({ ...base, ReceivedQty: 40, InvoicedQty: 60 }).reasons, ["qty_mismatch_grn_invoice"]);
  assert.deepEqual(cumulativeMatch({ ...base, ReceivedQty: 40, InvoicedQty: 40, InvoiceUnitPrice: 11 }).reasons, ["price_mismatch"]);
  assert.equal(cumulativeMatch({ ...base, ReceivedQty: 40, InvoicedQty: 40, InvoiceUnitPrice: 10.4 }).ok, true, "در تلورانس ۵٪");
});

test("تعهد حساب = Σ(ارزش − فاکتورشده) فقط برای POهای متعهد، به ارز پایه", () => {
  const rates = { IRR: 1, USD: 600_000 };
  const pos = [
    { PoNo: "A", VendorName: "", TitleFa: "", Status: "issued", CostAccountCode: "x", Quantity: 10, UnitPrice: 100, Amount: 1000, InvoicedQty: 4, Currency: "IRR" },
    { PoNo: "B", VendorName: "", TitleFa: "", Status: "cancelled", CostAccountCode: "x", Quantity: 1, UnitPrice: 9999, Amount: 9999 },
    { PoNo: "C", VendorName: "", TitleFa: "", Status: "issued", CostAccountCode: "x", Quantity: 1, UnitPrice: 2, Amount: 2, Currency: "USD" },
    { PoNo: "D", VendorName: "", TitleFa: "", Status: "draft", CostAccountCode: "x", Quantity: 1, UnitPrice: 5, Amount: 5 },
  ];
  assert.equal(committedForAccount("x", pos, rates), 600 + 1_200_000);
});

test("نقدینگی: ورودی با تأخیر وصول و حاشیهٔ صریح؛ خروجی گذشته از هزینهٔ ثبت‌شده", () => {
  const ws = sampleWs();
  const v = buildFinView(ws);
  const st = v.settings;
  assert.equal(v.cash.inflow[0], 0);
  assert.equal(v.cash.inflow[1], 0);
  near(v.cash.inflow[2], v.pmb[0] * (1 + st.BillingMarkupPct / 100));
  const p7 = ws.transactions.filter((t) => t.PeriodNo === 7).reduce((s, t) => s + t.BaseAmount, 0);
  near(v.cash.outflow[6], p7);
  near(v.cash.outflow[11], v.pmb[11], 1e-9);
  near(v.cash.netCum[11], v.cash.netFlow.reduce((a, b) => a + b, 0));
});

test("مطالبات: روز تأخیر از سررسید تا تاریخ داده حساب می‌شود (نه عدد ثابت)", () => {
  const v = buildFinView(sampleWs());
  assert.deepEqual(v.ar.map((x) => x.overdue), [22, 74, 128]);
  assert.ok(v.alerts.some((a) => a.code === "EWS-FIN-05"));
});

test("تأخیر PO و امتیاز فروشنده از داده؛ DIO از ارزش موجودی و مصرف", () => {
  const v = buildFinView(sampleWs());
  const c58 = v.commitments.find((c) => c.row.PoNo === "PO-2026-058");
  assert.equal(c58.delay, 13);
  assert.equal(c58.delayOpen, false);
  const c63 = v.commitments.find((c) => c.row.PoNo === "PO-2026-063");
  assert.equal(c63.delay, null, "هنوز به موعد نرسیده");
  assert.equal(c63.match.ok, false);
  const invValue = FIN_SAMPLE.stock.reduce((s, x) => s + x.OnHand * x.UnitCost, 0);
  const daily = FIN_SAMPLE.stock.reduce((s, x) => s + x.AvgDailyUse * x.UnitCost, 0);
  near(v.dio, invValue / daily);
  assert.ok(v.alerts.some((a) => a.code === "EWS-SUPP-02"), "تأخیر ۱۳ روزه > ۷");
});

test("مرجع تأیید DoA بر پایهٔ دلار؛ بدون نرخ دلار null", () => {
  assert.equal(prApprover(5_000 * 620_000, { USD: 620_000 }), "Manager");
  assert.equal(prApprover(50_000 * 620_000, { USD: 620_000 }), "Dept Head");
  assert.equal(prApprover(600_000 * 620_000, { USD: 620_000 }), "Sponsor");
  assert.equal(prApprover(1, { IRR: 1 }), null);
});

test("تنظیمات: پیش‌فرض برای ستون خالی و IRR همیشه ۱", () => {
  const s = resolveSettings({ DataDate: "2026-01-01", CurrentPeriod: 3, PeriodCount: 12, Rates: { USD: 1 } });
  assert.equal(s.Rates.IRR, 1);
  assert.equal(s.Curve, "scurve");
  assert.equal(s.MrpHorizonDays, 60);
  assert.equal(safeBase(10, "XYZ", s.Rates), null);
});
