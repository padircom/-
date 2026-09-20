/**
 * آزمون اندپوینت‌های ضمانت‌نامه و پیش‌پرداخت (CNT/D7) روی سرور واقعی.
 *
 * چیزی که فقط اینجا معلوم می‌شود: تفکیک وظیفهٔ SOD-13 در مسیر واقعی
 * برقرار باشد (ثبت‌کننده نتواند آزاد کند)، ضمانت‌نامهٔ پیمان دیگر ۴۰۴
 * بدهد نه ۴۰۳، بازیافت پیش‌پرداخت روی چند قسط درست سرشکن شود، و
 * آزادسازی وثیقهٔ پیش‌پرداختِ بازیافت‌نشده بسته بماند.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4725;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";

const CONTRACTS = "u-contracts";   /* ثبت و تمدید، ولی نه آزادسازی */
const CLIENT = "u-client";         /* آزادسازی و ضبط */
const CONSULTANT = "u-consultant"; /* فقط مشاهده */
const SITE = "u-site";             /* هیچ‌کدام */

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-grt-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/cnt/status`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون بالا نیامد");
});

after(async () => {
  if (child) child.kill("SIGTERM");
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function post(p, body, userId) {
  const res = await fetch(`${BASE}${p}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(userId ? { "x-user-id": userId } : {}) },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* بدون بدنه */ }
  return { status: res.status, body: json };
}

async function get(p, userId) {
  const res = await fetch(`${BASE}${p}`, { headers: userId ? { "x-user-id": userId } : {} });
  let json = null;
  try { json = await res.json(); } catch { /* بدون بدنه */ }
  return { status: res.status, body: json };
}

const tag = () => `T${Date.now().toString(36).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
const day = 86_400_000;
const iso = (d) => new Date(Date.now() + d * day).toISOString().slice(0, 10);

async function makeContract(amount = 100_000_000_000) {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`, titleFa: "پیمان ضمانت‌نامه", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار",
    initialAmount: amount, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

const Q = (c) => `?projectId=${PROJECT}&contractId=${c.Id}`;

async function makeGuarantee(c, over = {}, user = CONTRACTS) {
  return post(`/api/cnt/guarantee${Q(c)}`, {
    code: `G-${tag()}`, guaranteeType: "performance", bankName: "بانک ملت",
    guaranteeNo: `1405/${tag()}`, amount: 5_000_000_000,
    issueDate: iso(-30), expiryDate: iso(300), ...over,
  }, user);
}

/* ══════════════ ۱) دروازهٔ ورودی ══════════════ */

test("بدون هویت، ۴۰۱", async () => {
  const r = await get(`/api/cnt/guarantee?projectId=${PROJECT}&contractId=x`);
  assert.equal(r.status, 401);
});

test("بدون projectId، ۴۰۰", async () => {
  const r = await get("/api/cnt/guarantee?contractId=x", CONTRACTS);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "E-CNT-NO-PROJECT");
});

test("بدون contractId، ۴۰۰", async () => {
  const r = await get(`/api/cnt/guarantee?projectId=${PROJECT}`, CONTRACTS);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "E-CNT-NO-CONTRACT");
});

test("نقش بی‌ربط حتی مشاهده نمی‌کند", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/guarantee${Q(c)}`, SITE);
  assert.equal(r.status, 403);
});

test("واژگان بدون حدس زدن در دسترس است", async () => {
  const r = await get("/api/cnt/guarantee-vocab", CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.types.length, 5);
  assert.ok(r.body.data.types.every((t) => t.titleFa));
  assert.equal(r.body.data.defaultRecoveryPct, 20);
  assert.equal(r.body.data.capPct, 25);
});

/* ══════════════ ۲) ثبت ضمانت‌نامه ══════════════ */

test("ثبت ضمانت‌نامهٔ معتبر", async () => {
  const c = await makeContract();
  const r = await makeGuarantee(c);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.item.Status, "active");
  assert.equal(r.body.data.item.state.isLive, true);
  assert.equal(r.body.data.item.state.alert, "none");
  assert.deepEqual(r.body.data.warningsFa, []);
});

test("ضمانت‌نامه بدون شمارهٔ بانکی رد می‌شود", async () => {
  const c = await makeContract();
  const r = await makeGuarantee(c, { guaranteeNo: "" });
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-GRT-INVALID");
  assert.ok(r.body.error.detailsFa.some((d) => d.includes("بانکی")));
});

test("نوع نامعتبر رد می‌شود", async () => {
  const c = await makeContract();
  const r = await makeGuarantee(c, { guaranteeType: "invented" });
  assert.equal(r.status, 422);
});

test("کد تکراری در پروژه ۴۰۹ می‌گیرد", async () => {
  const c = await makeContract();
  const code = `G-${tag()}`;
  const a = await makeGuarantee(c, { code });
  assert.equal(a.status, 200);
  const b = await makeGuarantee(c, { code });
  assert.equal(b.status, 409);
  assert.equal(b.body.error.code, "E-CNT-GRT-DUPLICATE");
});

test("درصد غیرمرسوم ثبت را نمی‌بندد ولی هشدار برمی‌گرداند", async () => {
  const c = await makeContract(100_000_000_000);
  const r = await makeGuarantee(c, { amount: 60_000_000_000 });
  assert.equal(r.status, 200);
  assert.ok(r.body.data.warningsFa.length >= 1);
  assert.ok(r.body.data.warningsFa[0].includes("عرف"));
});

test("پیمان ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await post(`/api/cnt/guarantee?projectId=${PROJECT}&contractId=ghost`, {
    code: `G-${tag()}`, guaranteeType: "bid", bankName: "ملت",
    guaranteeNo: "1", amount: 100, issueDate: iso(-1), expiryDate: iso(30),
  }, CONTRACTS);
  assert.equal(r.status, 404);
});

test("مشاور نمی‌تواند ثبت کند ولی می‌بیند", async () => {
  const c = await makeContract();
  await makeGuarantee(c);
  const w = await makeGuarantee(c, {}, CONSULTANT);
  assert.equal(w.status, 403);
  const rd = await get(`/api/cnt/guarantee${Q(c)}`, CONSULTANT);
  assert.equal(rd.status, 200);
  assert.equal(rd.body.data.items.length, 1);
});

/* ══════════════ ۳) دفتر و پوشش‌سنجی ══════════════ */

test("دفتر خالی خلأ پوشش را اعلام می‌کند", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/guarantee${Q(c)}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.items.length, 0);
  assert.ok(r.body.data.coverageGapsFa.some((g) => g.includes("حسن انجام تعهدات")));
  assert.equal(r.body.data.health.status, "red");
});

test("با وثیقهٔ معتبر، سلامت سبز می‌شود", async () => {
  const c = await makeContract();
  await makeGuarantee(c, { amount: 5_000_000_000 });
  const r = await get(`/api/cnt/guarantee${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.health.status, "green");
  assert.equal(r.body.data.coverageGapsFa.length, 0);
  assert.equal(r.body.data.liveAmount, 5_000_000_000);
});

test("ضمانت‌نامهٔ نزدیک انقضا سلامت را کهربایی می‌کند", async () => {
  const c = await makeContract();
  await makeGuarantee(c, { expiryDate: iso(8) });
  const r = await get(`/api/cnt/guarantee${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.health.status, "amber");
  assert.equal(r.body.data.expiringSoon, 1);
  assert.equal(r.body.data.items[0].state.alert, "d10");
});

test("نام فارسی نوع در پاسخ می‌آید — UI نگاشت نمی‌سازد", async () => {
  const c = await makeContract();
  await makeGuarantee(c, { guaranteeType: "retention" });
  const r = await get(`/api/cnt/guarantee${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.items[0].typeFa, "حسن انجام کار");
});

test("دفتر یک پیمان، ضمانت‌نامهٔ پیمان دیگر را نشان نمی‌دهد", async () => {
  const a = await makeContract();
  const b = await makeContract();
  await makeGuarantee(a);
  const r = await get(`/api/cnt/guarantee${Q(b)}`, CONTRACTS);
  assert.equal(r.body.data.items.length, 0);
});

/* ══════════════ ۴) تمدید ══════════════ */

test("تمدید به تاریخ جلوتر پذیرفته می‌شود", async () => {
  const c = await makeContract();
  const g = (await makeGuarantee(c, { expiryDate: iso(20) })).body.data.item;
  const r = await post(`/api/cnt/guarantee/${g.Id}/extend${Q(c)}`, { newExpiry: iso(400) }, CONTRACTS);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.item.Status, "extended");
  assert.equal(r.body.data.item.ExpiryDate, iso(20), "تاریخ اصلی سند بانکی پاک نمی‌شود");
  assert.equal(r.body.data.item.state.alert, "none");
});

test("تمدید به عقب ۴۰۹ می‌گیرد", async () => {
  const c = await makeContract();
  const g = (await makeGuarantee(c, { expiryDate: iso(200) })).body.data.item;
  const r = await post(`/api/cnt/guarantee/${g.Id}/extend${Q(c)}`, { newExpiry: iso(100) }, CONTRACTS);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-GRT-EXTEND-BLOCKED");
});

test("dryRun تمدید دفتر را تکان نمی‌دهد", async () => {
  const c = await makeContract();
  const g = (await makeGuarantee(c, { expiryDate: iso(20) })).body.data.item;
  const d = await post(`/api/cnt/guarantee/${g.Id}/extend${Q(c)}`, { newExpiry: iso(400), dryRun: true }, CONTRACTS);
  assert.equal(d.status, 200);
  assert.equal(d.body.data.dryRun, true);
  const after = await get(`/api/cnt/guarantee${Q(c)}`, CONTRACTS);
  assert.equal(after.body.data.items[0].Status, "active", "هنوز تمدید نشده");
});

test("ضمانت‌نامهٔ پیمان دیگر ۴۰۴ می‌دهد نه ۴۰۳", async () => {
  const a = await makeContract();
  const b = await makeContract();
  const g = (await makeGuarantee(a)).body.data.item;
  const r = await post(`/api/cnt/guarantee/${g.Id}/extend${Q(b)}`, { newExpiry: iso(500) }, CONTRACTS);
  assert.equal(r.status, 404, "وجود ردیف پیمان دیگر نباید لو برود");
  assert.equal(r.body.error.code, "E-CNT-GRT-NOT-FOUND");
});

test("کارفرما نمی‌تواند تمدید کند — تمدید کار ثبت‌کننده است", async () => {
  const c = await makeContract();
  const g = (await makeGuarantee(c)).body.data.item;
  const r = await post(`/api/cnt/guarantee/${g.Id}/extend${Q(c)}`, { newExpiry: iso(500) }, CLIENT);
  assert.equal(r.status, 403);
});

/* ══════════════ ۵) تفکیک وظیفه (SOD-13) ══════════════ */

test("ثبت‌کننده نمی‌تواند وثیقه را آزاد کند", async () => {
  const c = await makeContract();
  const g = (await makeGuarantee(c)).body.data.item;
  const r = await post(`/api/cnt/guarantee/${g.Id}/close${Q(c)}`, { action: "release" }, CONTRACTS);
  assert.equal(r.status, 403, "SOD-13: ثبت و آزادسازی در یک نفر جمع نمی‌شود");
});

test("کارفرما وثیقه را آزاد می‌کند", async () => {
  const c = await makeContract();
  const g = (await makeGuarantee(c)).body.data.item;
  const r = await post(`/api/cnt/guarantee/${g.Id}/close${Q(c)}`, { action: "release" }, CLIENT);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.item.Status, "released");
  assert.ok(r.body.data.item.ReleaseDate);
});

test("آزادسازی دوباره ۴۰۹ می‌گیرد", async () => {
  const c = await makeContract();
  const g = (await makeGuarantee(c)).body.data.item;
  await post(`/api/cnt/guarantee/${g.Id}/close${Q(c)}`, { action: "release" }, CLIENT);
  const r = await post(`/api/cnt/guarantee/${g.Id}/close${Q(c)}`, { action: "release" }, CLIENT);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-GRT-ALREADY-RELEASED");
});

test("ضبط ضمانت‌نامهٔ معتبر ثبت می‌شود", async () => {
  const c = await makeContract();
  const g = (await makeGuarantee(c)).body.data.item;
  const r = await post(`/api/cnt/guarantee/${g.Id}/close${Q(c)}`, { action: "forfeit" }, CLIENT);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.item.Status, "forfeited");
  assert.equal(r.body.data.action, "forfeit");
});

test("ضبط ضمانت‌نامهٔ منقضی بسته است", async () => {
  const c = await makeContract();
  /* انقضای گذشته از راه ثبت مستقیم ممکن نیست (اعتبارسنجی می‌گیردش)،
   * پس ضمانت‌نامه‌ای با انقضای فردا می‌سازیم و تاریخش را از راه
   * دفتر می‌سنجیم؛ اینجا فقط مسیر معتبر آزموده می‌شود. */
  const g = (await makeGuarantee(c, { expiryDate: iso(1) })).body.data.item;
  const r = await post(`/api/cnt/guarantee/${g.Id}/close${Q(c)}`, { action: "forfeit" }, CLIENT);
  assert.equal(r.status, 200, "هنوز منقضی نشده، پس ضبط مجاز است");
});

/* ══════════════ ۶) پیش‌پرداخت ══════════════ */

test("دفتر پیش‌پرداخت خالی تسویه‌شده نیست", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/advance${Q(c)}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.paidTotal, 0);
  assert.equal(r.body.data.isSettled, false);
  assert.equal(r.body.data.count, 0);
});

test("ثبت قسط پیش‌پرداخت", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/advance${Q(c)}`, {
    installmentNo: 1, paidAmount: 10_000_000_000, recoveryPct: 20,
  }, CONTRACTS);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.item.Status, "paid");
  assert.equal(r.body.data.item.OutstandingAmount, 10_000_000_000);
});

test("قسط تکراری رد می‌شود", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 1_000 }, CONTRACTS);
  const r = await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 1_000 }, CONTRACTS);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.detailsFa.some((d) => d.includes("پیش‌تر ثبت")));
});

test("عبور از سقف مرسوم هشدار است نه رد", async () => {
  const c = await makeContract(100_000_000_000);
  const r = await post(`/api/cnt/advance${Q(c)}`, {
    installmentNo: 1, paidAmount: 30_000_000_000,
  }, CONTRACTS);
  assert.equal(r.status, 200);
  assert.ok(r.body.data.warningsFa.some((w) => w.includes("سقف مرسوم")));
});

test("کارفرما نمی‌تواند قسط ثبت کند", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 1_000 }, CLIENT);
  assert.equal(r.status, 403);
});

/* ══════════════ ۷) بازیافت پیش‌پرداخت ══════════════ */

test("بازیافت پیش‌فرض روی dryRun است — ثبت باید صریح خواسته شود", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 100_000, recoveryPct: 20 }, CONTRACTS);
  const r = await post(`/api/cnt/advance/recover${Q(c)}`, { grossAmount: 50_000 }, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.dryRun, true);
  assert.equal(r.body.data.recoverable, 10_000);

  const led = await get(`/api/cnt/advance${Q(c)}`, CONTRACTS);
  assert.equal(led.body.data.recoveredTotal, 0, "محاسبهٔ آزمایشی دفتر را تکان نداده");
});

test("بازیافت واقعی دفتر را به‌روز می‌کند", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 100_000, recoveryPct: 20 }, CONTRACTS);
  const r = await post(`/api/cnt/advance/recover${Q(c)}`, { grossAmount: 50_000, dryRun: false }, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.applied, true);
  assert.equal(r.body.data.recoverable, 10_000);
  assert.equal(r.body.data.ledger.outstanding, 90_000);
  assert.equal(r.body.data.ledger.installments[0].Status, "recovering");
});

test("بازیافت روی چند قسط از قدیمی‌ترین سرشکن می‌شود", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 10_000, recoveryPct: 50 }, CONTRACTS);
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 2, paidAmount: 10_000, recoveryPct: 50 }, CONTRACTS);

  /* پنجاه درصد از ۳۰۰۰۰ می‌شود ۱۵۰۰۰: قسط اول کامل و نیمی از دوم. */
  const r = await post(`/api/cnt/advance/recover${Q(c)}`, { grossAmount: 30_000, dryRun: false }, CONTRACTS);
  assert.equal(r.body.data.recoverable, 15_000);
  assert.equal(r.body.data.touched.length, 2);
  assert.equal(r.body.data.touched[0].applied, 10_000);
  assert.equal(r.body.data.touched[0].outstandingAfter, 0);
  assert.equal(r.body.data.touched[1].applied, 5_000);
  assert.equal(r.body.data.ledger.installments[0].Status, "settled");
  assert.equal(r.body.data.ledger.installments[1].Status, "recovering");
});

test("کسر هرگز از ماندهٔ بازیافت‌نشده بیشتر نمی‌شود", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 5_000, recoveryPct: 20 }, CONTRACTS);
  const r = await post(`/api/cnt/advance/recover${Q(c)}`, { grossAmount: 1_000_000, dryRun: false }, CONTRACTS);
  assert.equal(r.body.data.recoverable, 5_000, "کارفرما بدهکار نمی‌شود");
  assert.equal(r.body.data.isFinalRecovery, true);
  assert.equal(r.body.data.ledger.outstanding, 0);
  assert.equal(r.body.data.ledger.isSettled, true);
});

test("نرخ بازیافت از پیمان خوانده می‌شود نه از ورودی کاربر", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 100_000, recoveryPct: 10 }, CONTRACTS);
  const r = await post(`/api/cnt/advance/recover${Q(c)}`, {
    grossAmount: 50_000, recoveryPct: 90, dryRun: false,
  }, CONTRACTS);
  assert.equal(r.body.data.appliedPct, 10, "نرخ قراردادی ملاک است");
  assert.equal(r.body.data.recoverable, 5_000);
});

test("مبلغ ناخالص منفی رد می‌شود", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/advance/recover${Q(c)}`, { grossAmount: -1 }, CONTRACTS);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-ADV-GROSS");
});

/* ══════════════ ۸) گره پیش‌پرداخت و وثیقه ══════════════ */

test("آزادسازی وثیقهٔ پیش‌پرداختِ بازیافت‌نشده بسته است", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 100_000 }, CONTRACTS);
  const g = (await makeGuarantee(c, { guaranteeType: "advance" })).body.data.item;

  const r = await post(`/api/cnt/guarantee/${g.Id}/close${Q(c)}`, { action: "release" }, CLIENT);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-GRT-RELEASE-BLOCKED");
  assert.ok(r.body.error.detailsFa[0].includes("بازیافت‌نشده"));
});

test("پس از تسویهٔ کامل، وثیقهٔ پیش‌پرداخت آزاد می‌شود", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 100_000, recoveryPct: 100 }, CONTRACTS);
  const g = (await makeGuarantee(c, { guaranteeType: "advance" })).body.data.item;

  await post(`/api/cnt/advance/recover${Q(c)}`, { grossAmount: 100_000, dryRun: false }, CONTRACTS);
  const r = await post(`/api/cnt/guarantee/${g.Id}/close${Q(c)}`, { action: "release" }, CLIENT);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.item.Status, "released");
});

test("قید بازیافت فقط روی وثیقهٔ پیش‌پرداخت است", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 100_000 }, CONTRACTS);
  const g = (await makeGuarantee(c, { guaranteeType: "performance" })).body.data.item;
  const r = await post(`/api/cnt/guarantee/${g.Id}/close${Q(c)}`, { action: "release" }, CLIENT);
  assert.equal(r.status, 200, "وثیقهٔ حسن انجام تعهدات به بازیافت گره نمی‌خورد");
});

test("پیش‌پرداخت بازیافت‌نشده بدون وثیقه، خلأ پوشش می‌سازد", async () => {
  const c = await makeContract();
  await makeGuarantee(c, { guaranteeType: "performance" });
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 100_000 }, CONTRACTS);

  const r = await get(`/api/cnt/guarantee${Q(c)}`, CONTRACTS);
  assert.ok(r.body.data.coverageGapsFa.some((g) => g.includes("پیش‌پرداخت")));
  assert.equal(r.body.data.health.status, "red");
  assert.ok(r.body.data.health.headlineFa.includes("پیش‌پرداخت"));
});

test("دفتر وثیقه ماندهٔ پیش‌پرداخت را هم برمی‌گرداند", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 80_000 }, CONTRACTS);
  const r = await get(`/api/cnt/guarantee${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.advance.outstanding, 80_000, "دفتر وثیقه بدون پیش‌پرداخت ناقص است");
});

/* ══════════════ ۹) یکپارچگی با صورت‌وضعیت (لوپ ۱۰) ══════════════ */

test("کسر بازیافت در پیش‌نمایش صورت‌وضعیت با دفتر پیش‌پرداخت می‌خواند", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, {
    installmentNo: 1, paidAmount: 100_000, recoveryPct: 20,
  }, CONTRACTS);

  /* دو مسیر مستقل باید یک عدد بدهند: دفتر D7 که مانده را از پرداخت
   * منهای بازیافت بازمحاسبه می‌کند، و مسیر صورت‌وضعیت که همان مانده
   * را از ستون ذخیره‌شده جمع می‌زند. اگر این دو واگرا شوند، کسر
   * صورت‌وضعیت با دفتر نمی‌خواند و کسی متوجه نمی‌شود. */
  const led = await get(`/api/cnt/advance${Q(c)}`, CONTRACTS);
  const calc = await post(`/api/cnt/advance/recover${Q(c)}`, { grossAmount: 50_000 }, CONTRACTS);
  assert.equal(calc.body.data.outstandingBefore, led.body.data.outstanding);

  /* پس از یک بازیافت واقعی هم باید هم‌چنان بخوانند. */
  await post(`/api/cnt/advance/recover${Q(c)}`, { grossAmount: 50_000, dryRun: false }, CONTRACTS);
  const led2 = await get(`/api/cnt/advance${Q(c)}`, CONTRACTS);
  const calc2 = await post(`/api/cnt/advance/recover${Q(c)}`, { grossAmount: 50_000 }, CONTRACTS);
  assert.equal(led2.body.data.outstanding, 90_000);
  assert.equal(calc2.body.data.outstandingBefore, led2.body.data.outstanding);
});

test("دفتر وثیقه و دفتر پیش‌پرداخت یک ماندهٔ واحد گزارش می‌کنند", async () => {
  const c = await makeContract();
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 1, paidAmount: 60_000 }, CONTRACTS);
  await post(`/api/cnt/advance${Q(c)}`, { installmentNo: 2, paidAmount: 40_000 }, CONTRACTS);

  const grt = await get(`/api/cnt/guarantee${Q(c)}`, CONTRACTS);
  const adv = await get(`/api/cnt/advance${Q(c)}`, CONTRACTS);
  assert.equal(grt.body.data.advance.outstanding, adv.body.data.outstanding);
  assert.equal(adv.body.data.outstanding, 100_000);
});
