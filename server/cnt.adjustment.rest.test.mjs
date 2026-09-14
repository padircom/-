/* آزمون اندپوینت‌های تعدیل (D5) روی سرور واقعی.
 *
 * چیزی که فقط اینجا معلوم می‌شود: کارکرد فصل واقعاً از ردیف‌های همان
 * صورت‌وضعیت جمع شود، شاخص پیش‌نویس در مسیر واقعی مسدود کند، تعدیل
 * مضاعف روی یک فصل ثبت نشود، و خالص پرداختنی پس از تعدیل بازمحاسبه گردد. */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4715;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";

const CONTRACTS = "u-contracts";
const SITE = "u-site";

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-adj-"));
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

async function makeContract() {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`, titleFa: "پیمان تعدیل", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار",
    initialAmount: 10_000_000_000, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

async function makeItem(contractId, chapterCode, unitRate = 500_000) {
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId, itemNo: `${chapterCode}${Math.floor(Math.random() * 9000 + 1000)}`,
    chapterCode, titleFa: `ردیف فصل ${chapterCode}`, pricingBasis: "unit_price",
    unit: "مترمکعب", contractQty: 10_000, unitRate,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

async function makeIpc(contractId, lines) {
  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId, periodCode: `ADJ-${tag()}`,
    periodFrom: "2026-01-01", periodTo: "2026-01-31", lines,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data;
}

async function putIndex(indexPeriod, chapterCode, indexValue, status = "published") {
  const r = await post(`/api/cnt/index?projectId=${PROJECT}`, {
    indexPeriod, chapterCode, indexValue, status, sourceFa: "سازمان برنامه و بودجه",
  }, CONTRACTS);
  assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
  return r.body.data;
}

/* ───────────────────────── کاتالوگ شاخص ───────────────────────── */

test("ثبت شاخص و بازخوانی آن با برچسب فارسی", async () => {
  const period = `1405-Q1-${tag()}`;
  await putIndex(period, "03", 130);
  const r = await get(`/api/cnt/index?projectId=${PROJECT}&indexPeriod=${period}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.count, 1);
  assert.equal(r.body.data.items[0].statusFa, "منتشرشده");
});

test("ثبت دوبارهٔ همان دوره و فصل، رکورد دوم نمی‌سازد", async () => {
  const period = `1405-Q2-${tag()}`;
  const first = await putIndex(period, "03", 120, "draft");
  assert.equal(first.action, "created");
  const second = await putIndex(period, "03", 125, "draft");
  assert.equal(second.action, "updated");

  const r = await get(`/api/cnt/index?projectId=${PROJECT}&indexPeriod=${period}`, CONTRACTS);
  assert.equal(r.body.data.count, 1);
  assert.equal(Number(r.body.data.items[0].IndexValue), 125);
});

test("سرپرست کارگاه مجوز ثبت شاخص ندارد", async () => {
  const r = await post(`/api/cnt/index?projectId=${PROJECT}`, {
    indexPeriod: "1405-Q9", chapterCode: "03", indexValue: 100,
  }, SITE);
  assert.equal(r.status, 403);
});

/* ───────────────────────── محاسبهٔ تعدیل ───────────────────────── */

test("تعدیل از کارکرد فصل‌های همان صورت‌وضعیت حساب می‌شود", async () => {
  const c = await makeContract();
  const i3 = await makeItem(c.Id, "03", 500_000);
  const i4 = await makeItem(c.Id, "04", 200_000);
  const ipc = await makeIpc(c.Id, [
    { boqItemId: i3.Id, cumQty: 100 },  // ۵۰ میلیون
    { boqItemId: i4.Id, cumQty: 50 },   // ۱۰ میلیون
  ]);

  const base = `B-${tag()}`;
  const period = `P-${tag()}`;
  await putIndex(base, "03", 100);
  await putIndex(base, "04", 100);
  await putIndex(period, "03", 130);
  await putIndex(period, "04", 110);

  const r = await post(`/api/cnt/ipc/${ipc.id}/adjustment?projectId=${PROJECT}`, {
    indexPeriod: period, baseIndexPeriod: base,
  }, CONTRACTS);

  assert.equal(r.status, 201, JSON.stringify(r.body));
  /* فصل ۰۳: ۵۰م × ۰٫۳ = ۱۵م · فصل ۰۴: ۱۰م × ۰٫۱ = ۱م */
  assert.equal(r.body.data.totalAdjustment, 16_000_000);
  assert.equal(r.body.data.saved.length, 2);
});

test("خالص پرداختنی پس از تعدیل بازمحاسبه می‌شود", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id, "03", 500_000);
  const ipc = await makeIpc(c.Id, [{ boqItemId: item.Id, cumQty: 100 }]);
  assert.equal(ipc.netPayable, 50_000_000);

  const base = `B-${tag()}`, period = `P-${tag()}`;
  await putIndex(base, "03", 100);
  await putIndex(period, "03", 120);

  const r = await post(`/api/cnt/ipc/${ipc.id}/adjustment?projectId=${PROJECT}`, {
    indexPeriod: period, baseIndexPeriod: base,
  }, CONTRACTS);
  assert.equal(r.status, 201);

  const detail = await get(`/api/cnt/ipc/${ipc.id}?projectId=${PROJECT}`, CONTRACTS);
  assert.equal(Number(detail.body.data.header.AdjustmentAmount), 10_000_000);
  assert.equal(Number(detail.body.data.header.NetPayable), 60_000_000);
});

test("شاخص پیش‌نویس محاسبهٔ تعدیل را مسدود می‌کند", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id, "03");
  const ipc = await makeIpc(c.Id, [{ boqItemId: item.Id, cumQty: 10 }]);

  const base = `B-${tag()}`, period = `P-${tag()}`;
  await putIndex(base, "03", 100);
  await putIndex(period, "03", 140, "draft");

  const r = await post(`/api/cnt/ipc/${ipc.id}/adjustment?projectId=${PROJECT}`, {
    indexPeriod: period, baseIndexPeriod: base,
  }, CONTRACTS);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-INDEX-NOT-PUBLISHED");
});

test("شاخص ناموجود با کد مشخص رد می‌شود", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id, "03");
  const ipc = await makeIpc(c.Id, [{ boqItemId: item.Id, cumQty: 10 }]);

  const r = await post(`/api/cnt/ipc/${ipc.id}/adjustment?projectId=${PROJECT}`, {
    indexPeriod: "1499-Q9", baseIndexPeriod: "1499-Q8",
  }, CONTRACTS);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-NO-INDEX");
});

test("حالت آزمایشی محاسبه می‌کند ولی ذخیره نمی‌کند", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id, "03", 500_000);
  const ipc = await makeIpc(c.Id, [{ boqItemId: item.Id, cumQty: 100 }]);

  const base = `B-${tag()}`, period = `P-${tag()}`;
  await putIndex(base, "03", 100);
  await putIndex(period, "03", 130);

  const dry = await post(`/api/cnt/ipc/${ipc.id}/adjustment?projectId=${PROJECT}`, {
    indexPeriod: period, baseIndexPeriod: base, dryRun: true,
  }, CONTRACTS);
  assert.equal(dry.status, 200);
  assert.equal(dry.body.data.totalAdjustment, 15_000_000);

  /* سرآیند نباید عوض شده باشد. */
  const detail = await get(`/api/cnt/ipc/${ipc.id}?projectId=${PROJECT}`, CONTRACTS);
  assert.equal(Number(detail.body.data.header.AdjustmentAmount) || 0, 0);
});

test("تعدیل مضاعف روی یک فصل ثبت نمی‌شود", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id, "03", 500_000);
  const ipc = await makeIpc(c.Id, [{ boqItemId: item.Id, cumQty: 100 }]);

  const base = `B-${tag()}`, period = `P-${tag()}`;
  await putIndex(base, "03", 100);
  await putIndex(period, "03", 130);

  const first = await post(`/api/cnt/ipc/${ipc.id}/adjustment?projectId=${PROJECT}`, {
    indexPeriod: period, baseIndexPeriod: base,
  }, CONTRACTS);
  assert.equal(first.body.data.saved.length, 1);

  const second = await post(`/api/cnt/ipc/${ipc.id}/adjustment?projectId=${PROJECT}`, {
    indexPeriod: period, baseIndexPeriod: base,
  }, CONTRACTS);
  assert.equal(second.status, 201);
  assert.equal(second.body.data.saved.length, 0, "فصل تکراری نباید دوباره ثبت شود");
  assert.equal(second.body.data.skipped, 1);
  /* مبلغ نباید دو برابر شده باشد. */
  assert.equal(second.body.data.totalAdjustment, 15_000_000);
});

test("صورت‌وضعیت مصوب تعدیل جدید نمی‌پذیرد", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id, "03");
  const ipc = await makeIpc(c.Id, [{ boqItemId: item.Id, cumQty: 10 }]);

  await post(`/api/cnt/ipc/${ipc.id}/action?projectId=${PROJECT}`, { action: "submit", actor: "contractor" }, CONTRACTS);
  await post(`/api/cnt/ipc/${ipc.id}/action?projectId=${PROJECT}`, { action: "approve", actor: "consultant" }, "u-consultant");
  await post(`/api/cnt/ipc/${ipc.id}/action?projectId=${PROJECT}`, { action: "approve", actor: "employer" }, "u-client");

  const base = `B-${tag()}`, period = `P-${tag()}`;
  await putIndex(base, "03", 100);
  await putIndex(period, "03", 130);

  const r = await post(`/api/cnt/ipc/${ipc.id}/adjustment?projectId=${PROJECT}`, {
    indexPeriod: period, baseIndexPeriod: base,
  }, CONTRACTS);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-IPC-LOCKED");
});

/* ───────────────────────── مابه‌التفاوت مصالح ───────────────────────── */

test("ثبت مابه‌التفاوت مصالح مبلغ را حساب می‌کند", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id, "03");
  const ipc = await makeIpc(c.Id, [{ boqItemId: item.Id, cumQty: 10 }]);

  const r = await post(`/api/cnt/material-diff?projectId=${PROJECT}`, {
    contractId: c.Id, ipcId: ipc.id, materialCode: "STL-A3", materialNameFa: "میلگرد آجدار",
    quantity: 120, baseRate: 300_000, periodRate: 380_000, unit: "کیلوگرم",
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.diffAmount, 9_600_000);
  assert.equal(r.body.data.direction, "up");
});

test("همان قلم مصالح دو بار در یک صورت‌وضعیت ثبت نمی‌شود", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id, "03");
  const ipc = await makeIpc(c.Id, [{ boqItemId: item.Id, cumQty: 10 }]);
  const body = {
    contractId: c.Id, ipcId: ipc.id, materialCode: "CEM",
    materialNameFa: "سیمان", quantity: 50, baseRate: 100_000, periodRate: 120_000,
  };
  assert.equal((await post(`/api/cnt/material-diff?projectId=${PROJECT}`, body, CONTRACTS)).status, 201);
  const dup = await post(`/api/cnt/material-diff?projectId=${PROJECT}`, body, CONTRACTS);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "E-CNT-DUP-MATERIAL");
});

test("مابه‌التفاوت بدون نرخ دوره رد می‌شود", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id, "03");
  const ipc = await makeIpc(c.Id, [{ boqItemId: item.Id, cumQty: 10 }]);
  const r = await post(`/api/cnt/material-diff?projectId=${PROJECT}`, {
    contractId: c.Id, ipcId: ipc.id, materialCode: "CEM", materialNameFa: "سیمان",
    quantity: 10, baseRate: 100,
  }, CONTRACTS);
  assert.equal(r.status, 422);
});

test("وضعیت ماژول زیرماژول ۱۴٫۴ را تحویل‌شده اعلام می‌کند", async () => {
  const r = await get("/api/cnt/status");
  assert.ok(r.body.data.delivered.includes("14.4"));
  assert.equal(r.body.data.vocabularies.indexStatus.published, "منتشرشده");
});
