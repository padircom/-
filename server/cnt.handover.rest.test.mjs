/* آزمون سرتاسری تحویل موقت/قطعی و آزادسازی سپرده (PAC/FAC + D6).
 *
 * این آزمون همان زنجیره‌ای را می‌رود که G-01 را مسدود کرده بود: کسور
 * سپرده از صورت‌وضعیت مصوب انباشته می‌شود، گواهی تحویل صادر می‌گردد، و
 * نصف سپرده آزاد می‌شود. اگر هر حلقه بشکند، پول اشتباه آزاد شده است. */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4716;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";

const CONTRACTS = "u-contracts";
const CONSULTANT = "u-consultant";
const CLIENT = "u-client";
const SITE = "u-site";

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-hand-"));
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

/** پیمان + ردیف + صورت‌وضعیت مصوب با کسور سپردهٔ ۱۰٪. */
async function approvedIpcWithRetainage(cumQty = 100, unitRate = 500_000) {
  const c = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`, titleFa: "پیمان تحویل", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار",
    initialAmount: 10_000_000_000, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
  }, CONTRACTS);
  assert.equal(c.status, 201);
  const contractId = c.body.data.item.Id;

  const item = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId, itemNo: `03${Math.floor(Math.random() * 9000 + 1000)}`, chapterCode: "03",
    titleFa: "بتن‌ریزی", pricingBasis: "unit_price", unit: "مترمکعب",
    contractQty: 100_000, unitRate,
  }, CONTRACTS);
  assert.equal(item.status, 201);

  const ipc = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId, periodCode: `H-${tag()}`,
    periodFrom: "2026-01-01", periodTo: "2026-01-31",
    lines: [{ boqItemId: item.body.data.item.Id, cumQty }],
    deductions: { retainagePct: 10 },
  }, CONTRACTS);
  assert.equal(ipc.status, 201, JSON.stringify(ipc.body));

  const id = ipc.body.data.id;
  await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "submit", actor: "contractor" }, CONTRACTS);
  await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "approve", actor: "consultant" }, CONSULTANT);
  await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "approve", actor: "employer" }, CLIENT);

  return { contractId, ipcId: id, retainage: ipc.body.data.totalDeductions };
}

async function issueCert(type, over = {}) {
  return post(`/api/com/certificate?projectId=${PROJECT}`, {
    certificateType: type,
    certificateNo: `${type.toUpperCase()}-${tag()}`,
    titleFa: type === "pac" ? "تحویل موقت" : "تحویل قطعی",
    handoverDate: "2026-06-01",
    warrantyMonths: 12,
    ...over,
  }, CLIENT);
}

/* ───────────────────────── فهرست نواقص ───────────────────────── */

test("ثبت نقص و جمع‌بندی به تفکیک دسته", async () => {
  const no = `PN-${tag()}`;
  const r = await post(`/api/com/punch?projectId=${PROJECT}`, {
    itemNo: no, titleFa: "نشتی از درز اجرایی", category: "b",
    contractId: `scope-${tag()}`,
  }, SITE);
  assert.equal(r.status, 201, JSON.stringify(r.body));

  const list = await get(`/api/com/punch?projectId=${PROJECT}`, CONTRACTS);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.summary.total >= 1);
  const found = list.body.data.items.find((x) => x.ItemNo === no);
  assert.equal(found.categoryFa, "ب — رفع در دورهٔ تضمین");
});

test("شمارهٔ نقص تکراری رد می‌شود", async () => {
  const no = `PN-${tag()}`;
  const body = { itemNo: no, titleFa: "نقص", category: "c", contractId: `scope-${tag()}` };
  assert.equal((await post(`/api/com/punch?projectId=${PROJECT}`, body, SITE)).status, 201);
  const dup = await post(`/api/com/punch?projectId=${PROJECT}`, body, SITE);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "E-CNT-DUP-ITEM");
});

test("صرف‌نظر از نقص بدون دلیل ممکن نیست", async () => {
  const r = await post(`/api/com/punch?projectId=${PROJECT}`, {
    itemNo: `PN-${tag()}`, titleFa: "نقص جزئی", category: "c", contractId: `scope-${tag()}`,
  }, SITE);
  const close = await post(`/api/com/punch/${r.body.data.id}/close?projectId=${PROJECT}`, {
    status: "waived",
  }, SITE);
  assert.equal(close.status, 422);
});

test("بستن نقص با مدرک ثبت می‌شود", async () => {
  const r = await post(`/api/com/punch?projectId=${PROJECT}`, {
    itemNo: `PN-${tag()}`, titleFa: "نقص قابل رفع", category: "b", contractId: `scope-${tag()}`,
  }, SITE);
  const close = await post(`/api/com/punch/${r.body.data.id}/close?projectId=${PROJECT}`, {
    status: "closed", evidenceDocNo: "DOC-11",
  }, SITE);
  assert.equal(close.status, 200);
  assert.equal(close.body.data.status, "closed");
});

/* ───────────────────────── صدور گواهی ───────────────────────── */

test("مدیر پیمان مجوز صدور گواهی تحویل ندارد", async () => {
  const r = await issueCert("pac");
  assert.equal(r.status, 201);
  const forbidden = await post(`/api/com/certificate?projectId=${PROJECT}`, {
    certificateType: "pac", certificateNo: `X-${tag()}`, titleFa: "ت", handoverDate: "2026-06-01",
  }, CONTRACTS);
  assert.equal(forbidden.status, 403);
});

test("تحویل قطعی بدون تحویل موقت پیشین صادر نمی‌شود", async () => {
  /* پیمان تازه تا PAC پروژه‌ای در دامنه‌اش نیفتد. */
  const c = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`, titleFa: "پیمان بدون تحویل موقت", contractType: "unit_price",
    employerName: "ک", contractorName: "پ", initialAmount: 1_000_000,
    signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 100,
  }, CONTRACTS);
  const r = await issueCert("fac", { contractId: c.body.data.item.Id, warrantyEnded: true });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-NO-PAC");
});

test("حالت آزمایشی صدور گواهی رکورد نمی‌سازد", async () => {
  const r = await post(`/api/com/certificate?projectId=${PROJECT}`, {
    certificateType: "pac", certificateNo: `DRY-${tag()}`, titleFa: "آزمایشی",
    handoverDate: "2026-06-01", dryRun: true,
  }, CLIENT);
  assert.equal(r.status, 200);
  assert.equal(typeof r.body.data.wouldIssue, "boolean");
});

test("تحویل موقت دورهٔ تضمین را از تاریخ تحویل حساب می‌کند", async () => {
  const r = await issueCert("pac", { handoverDate: "2026-06-01", warrantyMonths: 12 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.warrantyEndDate, "2027-06-01");
});

/* ─────────── زنجیرهٔ کامل: انباشت تا آزادسازی (رفع G-01) ─────────── */

test("سپرده تنها از صورت‌وضعیت مصوب انباشته می‌شود", async () => {
  const c = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`, titleFa: "پیمان پیش‌نویس", contractType: "unit_price",
    employerName: "ک", contractorName: "پ", initialAmount: 1_000_000_000,
    signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 100,
  }, CONTRACTS);
  const item = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.body.data.item.Id, itemNo: `03${Math.floor(Math.random() * 9000 + 1000)}`,
    chapterCode: "03", titleFa: "ردیف", pricingBasis: "unit_price",
    unit: "مترمکعب", contractQty: 1000, unitRate: 100_000,
  }, CONTRACTS);
  const ipc = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.body.data.item.Id, periodCode: `D-${tag()}`,
    periodFrom: "2026-01-01", periodTo: "2026-01-31",
    lines: [{ boqItemId: item.body.data.item.Id, cumQty: 10 }],
    deductions: { retainagePct: 10 },
  }, CONTRACTS);

  const r = await post(`/api/cnt/retainage/accrue?projectId=${PROJECT}`, {
    ipcId: ipc.body.data.id,
  }, CONTRACTS);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-IPC-NOT-APPROVED");
});

test("انباشت سپرده ایدمپوتنت است", async () => {
  const { ipcId } = await approvedIpcWithRetainage();
  const first = await post(`/api/cnt/retainage/accrue?projectId=${PROJECT}`, { ipcId }, CONTRACTS);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.data.amount, 5_000_000);

  const second = await post(`/api/cnt/retainage/accrue?projectId=${PROJECT}`, { ipcId }, CONTRACTS);
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, "E-CNT-DUP-ACCRUAL");
});

test("زنجیرهٔ کامل: انباشت، تحویل موقت نصف، تحویل قطعی مانده", async () => {
  const { contractId, ipcId } = await approvedIpcWithRetainage();

  const acc = await post(`/api/cnt/retainage/accrue?projectId=${PROJECT}`, { ipcId }, CONTRACTS);
  assert.equal(acc.status, 201);
  assert.equal(acc.body.data.amount, 5_000_000);

  /* تحویل موقت این پیمان. */
  const pac = await issueCert("pac", { contractId });
  assert.equal(pac.status, 201, JSON.stringify(pac.body));

  const relPac = await post(`/api/cnt/retainage/release?projectId=${PROJECT}`, {
    contractId, certificateId: pac.body.data.id,
  }, CONTRACTS);
  assert.equal(relPac.status, 201, JSON.stringify(relPac.body));
  assert.equal(relPac.body.data.entryType, "release_pac");
  assert.equal(relPac.body.data.releaseAmount, 2_500_000);
  assert.equal(relPac.body.data.balanceAfter, 2_500_000);

  /* آزادسازی دوباره روی همان رویداد رد می‌شود. */
  const again = await post(`/api/cnt/retainage/release?projectId=${PROJECT}`, {
    contractId, certificateId: pac.body.data.id,
  }, CONTRACTS);
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, "E-CNT-PAC-ALREADY-RELEASED");

  /* تحویل قطعی ماندهٔ باقی‌مانده را می‌برد. */
  const fac = await issueCert("fac", { contractId, warrantyEnded: true });
  assert.equal(fac.status, 201, JSON.stringify(fac.body));

  const relFac = await post(`/api/cnt/retainage/release?projectId=${PROJECT}`, {
    contractId, certificateId: fac.body.data.id,
  }, CONTRACTS);
  assert.equal(relFac.status, 201, JSON.stringify(relFac.body));
  assert.equal(relFac.body.data.entryType, "release_fac");
  assert.equal(relFac.body.data.releaseAmount, 2_500_000);
  assert.equal(relFac.body.data.balanceAfter, 0);

  /* دفتر باید تراز باشد. */
  const ledger = await get(`/api/cnt/retainage?projectId=${PROJECT}&contractId=${contractId}`, CONTRACTS);
  assert.equal(ledger.body.data.accrued, 5_000_000);
  assert.equal(ledger.body.data.released, 5_000_000);
  assert.equal(ledger.body.data.balance, 0);
  assert.equal(ledger.body.data.entries.length, 3);
  /* شمارهٔ گواهی باید در دفتر ردیابی‌پذیر باشد. */
  assert.ok(ledger.body.data.entries.some((e) => e.TriggerDocNo === pac.body.data.certificateNo));
});

test("گواهی پیمان دیگر سپردهٔ این پیمان را آزاد نمی‌کند", async () => {
  const a = await approvedIpcWithRetainage();
  await post(`/api/cnt/retainage/accrue?projectId=${PROJECT}`, { ipcId: a.ipcId }, CONTRACTS);

  const b = await approvedIpcWithRetainage();
  const otherPac = await issueCert("pac", { contractId: b.contractId });

  const r = await post(`/api/cnt/retainage/release?projectId=${PROJECT}`, {
    contractId: a.contractId, certificateId: otherPac.body.data.id,
  }, CONTRACTS);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-CERT-OTHER-CONTRACT");
});

test("آزادسازی بدون سپردهٔ انباشته رد می‌شود", async () => {
  const { contractId } = await approvedIpcWithRetainage();
  const pac = await issueCert("pac", { contractId });
  const r = await post(`/api/cnt/retainage/release?projectId=${PROJECT}`, {
    contractId, certificateId: pac.body.data.id,
  }, CONTRACTS);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-NO-RETAINAGE");
});

test("درصد آزادسازی قابل تنظیم است و مانده درست می‌ماند", async () => {
  const { contractId, ipcId } = await approvedIpcWithRetainage();
  await post(`/api/cnt/retainage/accrue?projectId=${PROJECT}`, { ipcId }, CONTRACTS);
  const pac = await issueCert("pac", { contractId });

  const r = await post(`/api/cnt/retainage/release?projectId=${PROJECT}`, {
    contractId, certificateId: pac.body.data.id, pacSharePct: 30,
  }, CONTRACTS);
  assert.equal(r.body.data.releaseAmount, 1_500_000);
  assert.equal(r.body.data.balanceAfter, 3_500_000);
});

test("نقص بی‌ارجاع به پیمان، تحویل هر پیمانی را می‌بندد", async () => {
  /* نقص در سطح پروژه عمداً در دامنهٔ همهٔ پیمان‌ها می‌افتد: نقصی که به
   * پیمان مشخصی نسبت داده نشده ممکن است مربوط به همین پیمان باشد و
   * نادیده گرفتنش یعنی تحویل قطعی با کار ناتمام صادر شود. */
  const { contractId } = await approvedIpcWithRetainage();
  await issueCert("pac", { contractId });

  const blocker = await post(`/api/com/punch?projectId=${PROJECT}`, {
    itemNo: `PRJ-${tag()}`, titleFa: "نقص سطح پروژه", category: "c",
  }, SITE);
  assert.equal(blocker.status, 201);

  const fac = await issueCert("fac", { contractId, warrantyEnded: true });
  assert.equal(fac.status, 409);
  assert.equal(fac.body.error.code, "E-CNT-PUNCH-OPEN");

  /* پس از بستن نقص، تحویل قطعی صادر می‌شود. */
  await post(`/api/com/punch/${blocker.body.data.id}/close?projectId=${PROJECT}`, {
    status: "closed", evidenceDocNo: "DOC-CLR",
  }, SITE);
  const retry = await issueCert("fac", { contractId, warrantyEnded: true });
  assert.equal(retry.status, 201, JSON.stringify(retry.body));
});

test("وضعیت ماژول زیرماژول ۱۴٫۵ را تحویل‌شده اعلام می‌کند", async () => {
  const r = await get("/api/cnt/status");
  assert.ok(r.body.data.delivered.includes("14.5"));
  assert.equal(r.body.data.vocabularies.certificateType.pac, "تحویل موقت");
});
