/**
 * LIVE-1 — میز کار هزینه و تأمین d5 روی سرور واقعی (درایور JSON).
 *
 * سؤال محوری: دادهٔ صفحهٔ d5 واقعاً ذخیره می‌شود و پس از راه‌اندازی دوباره
 * می‌ماند؟ دفتر هزینه درست به‌روز می‌شود (تعهد → واقعی)؟ و کنترل‌های
 * سمت سرور (مجوز، تفکیک وظیفه، کنترل بودجه، دروازهٔ پرداخت، DoA ذخیره،
 * Snapshot تغییرناپذیر) واقعاً اجرا می‌شوند؟
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4743;
const BASE = `http://localhost:${PORT}`;
const PID = "lv1";
const USD = 620_000;

let child = null;
let dataDir = null;

async function startServer() {
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (r.status < 500 || r.status === 503) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون بالا نیامد");
}

async function stopServer() {
  if (!child) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await exited;
  child = null;
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "finws-data-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function call(method, p, { user, body } = {}) {
  const res = await fetch(`${BASE}/api/fin/${PID}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const ws = async () => (await call("GET", "/workspace", { user: "u-cost" })).body.data;
const acc = (w, c) => w.accounts.find((a) => a.Code === c);
const near = (a, b, eps = 0.5) => assert.ok(Math.abs(Number(a) - b) <= eps, `${a} ≠ ${b}`);

test("مجوز: بدون کاربر ۴۰۱، مدیر سامانه (تفکیک وظیفه) ۴۰۳، کنترل هزینه ۲۰۰ و پروژهٔ خالی", async () => {
  assert.equal((await call("GET", "/workspace")).status, 401);
  assert.equal((await call("GET", "/workspace", { user: "u-admin" })).status, 403);
  const r = await call("GET", "/workspace", { user: "u-cost" });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.accounts.length, 0);
  assert.equal(r.body.data.settingsSaved, false);
  const bad = await fetch(`${BASE}/api/fin/bad%20id/workspace`, { headers: { "x-user-id": "u-cost" } });
  assert.equal(bad.status, 400);
});

test("دادهٔ نمونه: فقط با درخواست صریح، فقط روی پروژهٔ خالی، و دفتر هزینه درست ساخته می‌شود", async () => {
  assert.equal((await call("POST", "/seed", { user: "u-pm" })).status, 403);
  assert.equal((await call("POST", "/seed", { user: "u-cost" })).status, 201);
  assert.equal((await call("POST", "/seed", { user: "u-cost" })).status, 409);
  const w = await ws();
  assert.equal(w.accounts.length, 8);
  assert.equal(w.pos.length, 3);
  assert.equal(w.settingsSaved, true);
  near(acc(w, "1.1").Actual, 14_200_000_000);
  /* 1.2.1: پیش‌پرداخت دلاری + فاکتور PO-058 (۶×۸ میلیارد) + فاکتور دلاری PO-061 */
  near(acc(w, "1.2.1").Actual, 78_000 * USD + 48_000_000_000 + 145_000 * USD);
  /* تعهد = ارزش PO − فاکتورشده */
  near(acc(w, "1.2.1").Committed, 96_000_000_000 - 48_000_000_000);
  near(acc(w, "1.2.2").Committed, 34_020_000_000 - 160 * 43_500_000);
  const auto = w.transactions.filter((t) => t.SourceType === "po_invoice");
  assert.equal(auto.length, 3);
});

test("هزینهٔ واقعی: ثبت و برگشت دقیق، ورودی بد رد، سند سیستمی حذف‌نشدنی", async () => {
  const before = Number(acc(await ws(), "1.4").Actual);
  const r = await call("POST", "/transactions", { user: "u-cost", body: { CostAccountCode: "1.4", DescriptionFa: "اجاره کانکس", Amount: 1_000_000_000, Currency: "IRR" } });
  assert.equal(r.status, 201);
  near(acc(await ws(), "1.4").Actual, before + 1_000_000_000);
  assert.equal((await call("DELETE", `/transactions/${r.body.data.Code}`, { user: "u-cost" })).status, 200);
  near(acc(await ws(), "1.4").Actual, before);

  const noRate = await call("POST", "/transactions", { user: "u-cost", body: { CostAccountCode: "1.4", DescriptionFa: "x", Amount: 5, Currency: "XYZ" } });
  assert.equal(noRate.status, 400);
  assert.equal(noRate.body.error.code, "E-FIN-NO-RATE");
  assert.equal((await call("POST", "/transactions", { user: "u-cost", body: { CostAccountCode: "9.9", DescriptionFa: "x", Amount: 5 } })).status, 400);
  assert.equal((await call("POST", "/transactions", { user: "u-cost", body: { CostAccountCode: "1.4", DescriptionFa: "x", Amount: -5 } })).status, 400);
  assert.equal((await call("POST", "/transactions", { user: "u-cost", body: { CostAccountCode: "1.4", DescriptionFa: "x", Amount: 5, PeriodNo: 99 } })).status, 400);
  const sys = (await ws()).transactions.find((t) => t.SourceType === "po_invoice");
  const del = await call("DELETE", `/transactions/${sys.Code}`, { user: "u-cost" });
  assert.equal(del.status, 409);
  assert.equal(del.body.error.code, "E-FIN-SYSTEM-POSTING");
});

test("درخواست خرید: گردش وضعیت، مجوز تأیید، تفکیک وظیفه و کنترل بودجهٔ واقعی", async () => {
  const c = await call("POST", "/prs", { user: "u-cost", body: { TitleFa: "فلنج", Quantity: 10, Unit: "عدد", EstimatedAmount: 5_000_000_000, CostAccountCode: "1.2.2", NeedByDate: "2026-12-01" } });
  assert.equal(c.status, 201);
  const code = c.body.data.Code;
  assert.equal(c.body.data.Status, "draft");
  assert.equal((await call("POST", `/prs/${code}/approve`, { user: "u-pm" })).status, 409, "draft مستقیم تأیید نمی‌شود");
  assert.equal((await call("POST", `/prs/${code}/submit`, { user: "u-cost" })).status, 200);
  assert.equal((await call("POST", `/prs/${code}/approve`, { user: "u-cost" })).status, 403, "کنترل هزینه مجوز تأیید ندارد");
  const ap = await call("POST", `/prs/${code}/approve`, { user: "u-pm" });
  assert.equal(ap.status, 200);
  assert.equal(ap.body.data.Status, "approved");
  assert.equal(ap.body.data.BudgetStatus, "ok");
  assert.equal(ap.body.data.ApprovedBy, "u-pm");

  /* فراتر از بودجه: بدون override رد، با override و دلیل تأیید با برچسب */
  const big = await call("POST", "/prs", { user: "u-cost", body: { TitleFa: "کابل اضافه", Quantity: 1, EstimatedAmount: 500_000_000_000, CostAccountCode: "1.2.2" } });
  await call("POST", `/prs/${big.body.data.Code}/submit`, { user: "u-cost" });
  const over = await call("POST", `/prs/${big.body.data.Code}/approve`, { user: "u-pm" });
  assert.equal(over.status, 409);
  assert.equal(over.body.error.code, "E-FIN-OVER-BUDGET");
  assert.equal((await call("POST", `/prs/${big.body.data.Code}/approve`, { user: "u-pm", body: { override: true } })).status, 409, "override بدون دلیل پذیرفته نیست");
  const forced = await call("POST", `/prs/${big.body.data.Code}/approve`, { user: "u-pm", body: { override: true, reasonFa: "تصمیم کمیته" } });
  assert.equal(forced.status, 200);
  assert.equal(forced.body.data.BudgetStatus, "over_budget");

  /* تفکیک وظیفه: کاربر دو‌نقشی درخواست خودش را تأیید نمی‌کند */
  const own = await call("POST", "/prs", { user: "u-over", body: { TitleFa: "پیچ", Quantity: 1, EstimatedAmount: 1_000, CostAccountCode: "1.2.2" } });
  await call("POST", `/prs/${own.body.data.Code}/submit`, { user: "u-over" });
  const sod = await call("POST", `/prs/${own.body.data.Code}/approve`, { user: "u-over" });
  assert.equal(sod.status, 403);
  assert.equal(sod.body.error.code, "E-FIN-SOD");
});

test("سفارش خرید: صدور از PR تأییدشده، تعهد، فاکتور → هزینهٔ واقعی خودکار، دروازهٔ پرداخت", async () => {
  const w0 = await ws();
  const approved = w0.prs.find((p) => p.Status === "approved" && p.BudgetStatus === "ok");
  const draft = w0.prs.find((p) => p.Status === "draft");
  assert.equal((await call("POST", "/pos", { user: "u-cost", body: { PrCode: draft.Code, VendorName: "x", UnitPrice: 1, PromisedDate: "2026-12-01" } })).status, 409);

  const c0 = Number(acc(w0, "1.2.2").Committed);
  const a0 = Number(acc(w0, "1.2.2").Actual);
  const po = await call("POST", "/pos", { user: "u-cost", body: { PrCode: approved.Code, VendorName: "فلنج‌سازی تهران", UnitPrice: 500_000_000, PromisedDate: "2026-12-01" } });
  assert.equal(po.status, 201);
  const poNo = po.body.data.PoNo;
  near(po.body.data.Amount, 5_000_000_000);
  let w = await ws();
  assert.equal(w.prs.find((p) => p.Code === approved.Code).Status, "converted");
  near(acc(w, "1.2.2").Committed, c0 + 5_000_000_000);

  const inv = await call("PATCH", `/pos/${poNo}`, { user: "u-cost", body: { ReceivedQty: 10, InvoicedQty: 10, DeliveredDate: "2026-11-28" } });
  assert.equal(inv.status, 200);
  assert.equal(inv.body.data.Status, "received");
  w = await ws();
  near(acc(w, "1.2.2").Committed, c0);
  near(acc(w, "1.2.2").Actual, a0 + 5_000_000_000);
  assert.ok(w.transactions.some((t) => t.SourceRef === poNo && t.SourceType === "po_invoice"));

  assert.equal((await call("PATCH", `/pos/${poNo}`, { user: "u-cost", body: { InvoicedQty: 5 } })).body.error.code, "E-FIN-INVOICE-DECREASE");
  assert.equal((await call("PATCH", `/pos/${poNo}`, { user: "u-cost", body: { PaidAmount: 6_000_000_000 } })).body.error.code, "E-FIN-PAY-EXCEEDS-INVOICE");
  assert.equal((await call("PATCH", `/pos/${poNo}`, { user: "u-cost", body: { PaidAmount: 5_000_000_000 } })).status, 200);
  assert.equal((await call("POST", `/pos/${poNo}/cancel`, { user: "u-cost" })).body.error.code, "E-FIN-PO-IN-PROGRESS");

  /* انحراف قیمت فاکتور > ۵٪ → پرداخت مسدود */
  const p2 = await call("POST", "/pos", { user: "u-cost", body: { VendorName: "لوله‌سازی", TitleFa: "لوله", Quantity: 10, UnitPrice: 100_000_000, CostAccountCode: "1.2.2", PromisedDate: "2026-12-10" } });
  const p2No = p2.body.data.PoNo;
  assert.equal((await call("PATCH", `/pos/${p2No}`, { user: "u-cost", body: { InvoiceUnitPrice: 120_000_000, ReceivedQty: 5, InvoicedQty: 5 } })).status, 200);
  const blocked = await call("PATCH", `/pos/${p2No}`, { user: "u-cost", body: { PaidAmount: 100_000_000 } });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, "E-FIN-PAYMENT-BLOCKED");
  assert.ok(blocked.body.error.reasons.includes("price_mismatch"));

  /* لغو سفارش بی‌رسید: تعهد آزاد می‌شود */
  const p3 = await call("POST", "/pos", { user: "u-cost", body: { VendorName: "ب", TitleFa: "ب", Quantity: 1, UnitPrice: 7_000_000, CostAccountCode: "1.4", PromisedDate: "2026-12-10" } });
  near(acc(await ws(), "1.4").Committed, 7_000_000);
  assert.equal((await call("POST", `/pos/${p3.body.data.PoNo}/cancel`, { user: "u-cost" })).status, 200);
  near(acc(await ws(), "1.4").Committed, 0);
});

test("ذخیرهٔ احتیاطی: فقط با اختیار DoA، با دلیل، و جابه‌جایی بودجه ثبت می‌شود", async () => {
  assert.equal((await call("POST", "/reserve-draw", { user: "u-cost", body: { amount: 1, toCode: "1.3", reasonFa: "x" } })).status, 403);
  assert.equal((await call("POST", "/reserve-draw", { user: "u-pm", body: { amount: 4_000_000_000, toCode: "1.3" } })).status, 400);
  assert.equal((await call("POST", "/reserve-draw", { user: "u-pm", body: { amount: 4_000_000_000, toCode: "1.5", reasonFa: "x" } })).status, 400);
  const ok = await call("POST", "/reserve-draw", { user: "u-pm", body: { amount: 4_000_000_000, toCode: "1.3", reasonFa: "ریسک خاک‌برداری محقق شد" } });
  assert.equal(ok.status, 201);
  near(ok.body.data.reserveRemaining, 14_000_000_000);
  const w = await ws();
  near(acc(w, "1.5").Budget, 14_000_000_000);
  near(acc(w, "1.3").Budget, 125_000_000_000);
  assert.equal(w.transfers.length, 1);
  assert.equal(w.transfers[0].ApprovedBy, "u-pm");
  const tooMuch = await call("POST", "/reserve-draw", { user: "u-pm", body: { amount: 100_000_000_000, toCode: "1.3", reasonFa: "x" } });
  assert.equal(tooMuch.status, 409);
});

test("CBS: مجوز ویرایش بودجه، جلوگیری از حلقه و حذف حساب در حال استفاده", async () => {
  assert.equal((await call("POST", "/accounts", { user: "u-cost", body: { Code: "1.6", TitleFa: "جدید", Budget: 1 } })).status, 403);
  const c = await call("POST", "/accounts", { user: "u-ceo", body: { Code: "1.6", ParentCode: "1", TitleFa: "راه‌اندازی", Budget: 5_000_000_000, Kind: "direct", Category: "labor" } });
  assert.equal(c.status, 201);
  assert.equal((await call("PATCH", "/accounts/1", { user: "u-ceo", body: { ParentCode: "1.6" } })).body.error.code, "E-FIN-CBS-CYCLE");
  assert.equal((await call("DELETE", "/accounts/1.2.2", { user: "u-ceo" })).body.error.code, "E-FIN-ACCOUNT-IN-USE");
  assert.equal((await call("DELETE", "/accounts/1.6", { user: "u-ceo" })).status, 200);
  const prog = await call("PUT", "/accounts/1.3/progress", { user: "u-cost", body: { ProgressPct: 40 } });
  assert.equal(prog.status, 200);
  assert.equal(Number(prog.body.data.ProgressPct), 40);
  assert.equal((await call("PUT", "/accounts/1.3/progress", { user: "u-cost", body: { ProgressPct: 140 } })).status, 400);
});

test("تنظیمات، انبار و مطالبات: اعتبارسنجی و گردش", async () => {
  const w = await ws();
  const s = { ...w.settings };
  assert.equal((await call("PUT", "/settings", { user: "u-cost", body: { ...s, CurrentPeriod: 20 } })).status, 400);
  const put = await call("PUT", "/settings", { user: "u-cost", body: { ...s, CurrentPeriod: 10, Rates: { ...s.Rates, USD: 640_000 } } });
  assert.equal(put.status, 200);
  assert.equal(put.body.data.CurrentPeriod, 10);
  assert.equal(put.body.data.Rates.USD, 640_000);

  const st = await call("POST", "/stock", { user: "u-cost", body: { Code: "FLG-8", NameFa: "فلنج ۸ اینچ", OnHand: 20, AvgDailyUse: 2, MaxDailyUse: 1, LeadTimeDays: 10, UnitCost: 9_000_000 } });
  assert.equal(st.status, 400, "حداکثر مصرف کمتر از میانگین");
  assert.equal((await call("POST", "/stock", { user: "u-cost", body: { Code: "FLG-8", NameFa: "فلنج ۸ اینچ", OnHand: 20, AvgDailyUse: 2, MaxDailyUse: 3, LeadTimeDays: 10, UnitCost: 9_000_000 } })).status, 201);
  assert.equal((await call("DELETE", "/stock/FLG-8", { user: "u-cost" })).status, 409);
  assert.equal((await call("PATCH", "/stock/FLG-8", { user: "u-cost", body: { OnHand: 0 } })).status, 200);
  assert.equal((await call("DELETE", "/stock/FLG-8", { user: "u-cost" })).status, 200);

  const ar = await call("POST", "/receivables", { user: "u-cost", body: { PartyFa: "کارفرما — صورت‌وضعیت ۵", Amount: 10_000_000_000, DueDate: "2026-10-01" } });
  assert.equal(ar.status, 201);
  assert.equal((await call("POST", `/receivables/${ar.body.data.Code}/collect`, { user: "u-cost" })).status, 200);
  assert.equal((await call("POST", `/receivables/${ar.body.data.Code}/collect`, { user: "u-cost" })).status, 409);
  assert.equal((await call("DELETE", `/receivables/${ar.body.data.Code}`, { user: "u-cost" })).status, 409);
});

test("Snapshot EVM: سرور از دادهٔ ذخیره‌شده می‌سازد، تکرار ممنوع، دستکاری کشف می‌شود", async () => {
  const r = await call("POST", "/snapshots", { user: "u-cost" });
  assert.equal(r.status, 201);
  assert.match(r.body.data.Hash, /^[0-9a-f]+$/i);
  assert.equal((await call("POST", "/snapshots", { user: "u-cost" })).body.error.code, "E-FIN-SNAPSHOT-EXISTS");
  let w = await ws();
  assert.equal(w.snapshots.length, 1);
  assert.equal(w.snapshots[0].valid, true);

  /* دستکاری مستقیم فایل داده (EV بزرگ‌تر) باید با هش کشف شود. */
  await stopServer();
  const file = path.join(dataDir, "EvmSnapshot.json");
  const rows = JSON.parse(await readFile(file, "utf8"));
  const mine = rows.find((x) => x.ProjectId === PID);
  const inputs = typeof mine.Inputs === "string" ? JSON.parse(mine.Inputs) : mine.Inputs;
  inputs.ev = inputs.ev * 1.2;
  mine.Inputs = typeof mine.Inputs === "string" ? JSON.stringify(inputs) : inputs;
  await writeFile(file, JSON.stringify(rows, null, 2));
  await startServer();
  w = await ws();
  assert.equal(w.snapshots[0].valid, false);
  assert.equal(w.snapshots[0].reason, "hash_mismatch");
});

test("ماندگاری: پس از راه‌اندازی دوبارهٔ سرور همهٔ داده‌ها سر جایشان است", async () => {
  const before = await ws();
  await stopServer();
  await startServer();
  const afterW = await ws();
  for (const k of ["accounts", "transactions", "prs", "pos", "stock", "receivables", "transfers"]) {
    assert.equal(afterW[k].length, before[k].length, k);
  }
  near(acc(afterW, "1.2.2").Actual, Number(acc(before, "1.2.2").Actual));
  assert.equal(afterW.settings.CurrentPeriod, 10);
});
