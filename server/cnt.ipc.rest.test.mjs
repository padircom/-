/* آزمون اندپوینت‌های صورت‌وضعیت (D4) روی سرور واقعی.
 *
 * موتور در cnt.ipc.test.mjs جدا سنجیده شده؛ اینجا چیزی سنجیده می‌شود که
 * فقط سر جمعِ لایه‌ها معلوم می‌شود: اینکه تجمعی دورهٔ قبل واقعاً از پایگاه
 * داده خوانده شود، سقف ۲۵٪ در مسیر ثبت مانع شود، و تفکیک وظیفهٔ سه‌طرفه
 * با مجوز واقعی اعمال گردد — نه فقط در جدول گذارها. */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4714;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";

const CONTRACTS = "u-contracts";   // تهیه‌کننده
const CONSULTANT = "u-consultant"; // تأیید مشاور
const CLIENT = "u-client";         // تصویب کارفرما
const SITE = "u-site";             // بدون مجوز صورت‌وضعیت

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-ipc-"));
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

async function makeContract(over = {}) {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`,
    titleFa: "پیمان آزمون صورت‌وضعیت",
    contractType: "unit_price",
    employerName: "شرکت کارفرما",
    contractorName: "شرکت پیمانکار",
    initialAmount: 1_000_000_000,
    signDate: "2026-01-01",
    startDate: "2026-01-05",
    durationDays: 360,
    ...over,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

async function makeItem(contractId, over = {}) {
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId,
    itemNo: `01${Math.floor(Math.random() * 9000 + 1000)}`,
    titleFa: "بتن‌ریزی فونداسیون",
    pricingBasis: "unit_price",
    unit: "مترمکعب",
    contractQty: 1000,
    unitRate: 500_000,
    ...over,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

/* ───────────────────────── پیش‌محاسبه ───────────────────────── */

test("پیش‌محاسبه مبلغ را بدون ذخیره برمی‌گرداند", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id);

  const r = await post(`/api/cnt/ipc/preview?projectId=${PROJECT}`, {
    contractId: c.Id,
    lines: [{ boqItemId: item.Id, cumQty: 100 }],
    deductions: { insurancePct: 5, retainagePct: 10, vatPct: 9 },
  }, CONTRACTS);

  assert.equal(r.status, 200, JSON.stringify(r.body));
  const d = r.body.data;
  assert.equal(d.grossCurrent, 50_000_000);
  assert.equal(d.totalDeductions, 7_500_000);
  assert.equal(d.vatAmount, 4_500_000);
  assert.equal(d.netPayable, 47_000_000);
  assert.equal(d.serialNo, 1);

  /* هیچ رکوردی نباید ساخته شده باشد. */
  const list = await get(`/api/cnt/ipc?projectId=${PROJECT}&contractId=${c.Id}`, CONTRACTS);
  assert.equal(list.body.data.count, 0);
});

test("سرپرست کارگاه مجوز تهیهٔ صورت‌وضعیت ندارد", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/ipc/preview?projectId=${PROJECT}`, {
    contractId: c.Id, lines: [],
  }, SITE);
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, "E-CNT-FORBIDDEN");
});

/* ───────────────────────── ثبت ───────────────────────── */

test("ثبت صورت‌وضعیت ردیف‌ها و کسورات را هم می‌سازد", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id);

  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id,
    periodCode: `1405-01-${tag()}`,
    periodFrom: "2026-01-01",
    periodTo: "2026-01-31",
    lines: [{ boqItemId: item.Id, cumQty: 100 }],
    deductions: { insurancePct: 5, retainagePct: 10 },
  }, CONTRACTS);

  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.data.id;
  assert.equal(r.body.data.workflowState, "draft");

  const detail = await get(`/api/cnt/ipc/${id}?projectId=${PROJECT}`, CONTRACTS);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.lines.length, 1);
  assert.equal(detail.body.data.deductions.length, 2);
  assert.equal(Number(detail.body.data.header.NetPayable), 42_500_000);
  /* برچسب فارسی باید همراه داده بیاید تا رابط کاربری نگاشت دوباره نسازد. */
  assert.ok(detail.body.data.deductions.every((d) => d.typeFa));
});

test("دورهٔ تکراری روی یک پیمان با ۴۰۹ رد می‌شود", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id);
  const period = `1405-02-${tag()}`;
  const body = {
    contractId: c.Id, periodCode: period,
    periodFrom: "2026-02-01", periodTo: "2026-02-29",
    lines: [{ boqItemId: item.Id, cumQty: 10 }],
  };

  assert.equal((await post(`/api/cnt/ipc?projectId=${PROJECT}`, body, CONTRACTS)).status, 201);
  const dup = await post(`/api/cnt/ipc?projectId=${PROJECT}`, body, CONTRACTS);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "E-CNT-DUP-PERIOD");
});

test("صورت‌وضعیت بدون ردیف ثبت نمی‌شود", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `1405-03-${tag()}`,
    periodFrom: "2026-03-01", periodTo: "2026-03-31", lines: [],
  }, CONTRACTS);
  assert.equal(r.status, 422);
});

test("ردیف ناشناخته با ۴۰۴ رد می‌شود نه اینکه بی‌صدا حذف شود", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `1405-04-${tag()}`,
    periodFrom: "2026-04-01", periodTo: "2026-04-31",
    lines: [{ boqItemId: "boq-ghost", cumQty: 5 }],
  }, CONTRACTS);
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, "E-CNT-NOT-FOUND");
});

test("سقف ۲۵٪ مانع ثبت صورت‌وضعیت فراتر از مبلغ مجاز است", async () => {
  const c = await makeContract({ initialAmount: 100_000_000 });
  const item = await makeItem(c.Id, { contractQty: 10_000, unitRate: 1_000_000 });

  /* ۱۵۰ واحد × ۱٬۰۰۰٬۰۰۰ = ۱۵۰ میلیون، یعنی ۱۵۰٪ مبلغ اولیه. */
  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `1405-05-${tag()}`,
    periodFrom: "2026-05-01", periodTo: "2026-05-31",
    lines: [{ boqItemId: item.Id, cumQty: 150 }],
  }, CONTRACTS);

  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-CEILING-25");
});

test("عبور از سقف با درخواست تغییر مصوب مجاز می‌شود", async () => {
  const c = await makeContract({ initialAmount: 100_000_000 });
  const item = await makeItem(c.Id, { contractQty: 10_000, unitRate: 1_000_000 });

  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `1405-06-${tag()}`,
    periodFrom: "2026-06-01", periodTo: "2026-06-31",
    lines: [{ boqItemId: item.Id, cumQty: 150 }],
    changeRequestCode: "CR-001",
  }, CONTRACTS);

  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test("کارکرد جاری دورهٔ دوم از تجمعی دورهٔ اول کم می‌شود", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id);
  const suffix = tag();

  const first = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `P1-${suffix}`,
    periodFrom: "2026-01-01", periodTo: "2026-01-31",
    lines: [{ boqItemId: item.Id, cumQty: 100 }],
  }, CONTRACTS);
  assert.equal(first.status, 201);
  assert.equal(first.body.data.grossCurrent, 50_000_000);

  /* تجمعی ۱۵۰ یعنی جاری ۵۰ واحد، نه ۱۵۰. */
  const second = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `P2-${suffix}`,
    periodFrom: "2026-02-01", periodTo: "2026-02-29",
    lines: [{ boqItemId: item.Id, cumQty: 150 }],
  }, CONTRACTS);
  assert.equal(second.status, 201, JSON.stringify(second.body));
  assert.equal(second.body.data.grossCurrent, 25_000_000);
  assert.equal(second.body.data.grossCumulative, 75_000_000);
  assert.equal(second.body.data.serialNo, 2);
});

/* ───────────────────────── گردش کار ───────────────────────── */

async function makeDraft() {
  const c = await makeContract();
  const item = await makeItem(c.Id);
  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `W-${tag()}`,
    periodFrom: "2026-07-01", periodTo: "2026-07-31",
    lines: [{ boqItemId: item.Id, cumQty: 20 }],
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.id;
}

test("زنجیرهٔ کامل ارسال، تأیید مشاور، تصویب کارفرما", async () => {
  const id = await makeDraft();

  const s1 = await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "submit", actor: "contractor" }, CONTRACTS);
  assert.equal(s1.status, 200, JSON.stringify(s1.body));
  assert.equal(s1.body.data.workflowState, "contractor_submitted");

  const s2 = await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "approve", actor: "consultant" }, CONSULTANT);
  assert.equal(s2.status, 200, JSON.stringify(s2.body));
  assert.equal(s2.body.data.workflowState, "consultant_approved");

  const s3 = await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "approve", actor: "employer" }, CLIENT);
  assert.equal(s3.status, 200, JSON.stringify(s3.body));
  assert.equal(s3.body.data.workflowState, "approved");
  assert.equal(s3.body.data.locked, true);

  /* هر سه گام باید در تاریخچه ثبت شده باشند. */
  const detail = await get(`/api/cnt/ipc/${id}?projectId=${PROJECT}`, CONTRACTS);
  assert.equal(detail.body.data.workflow.length, 3);
  assert.deepEqual(detail.body.data.workflow.map((w) => w.StepNo), [1, 2, 3]);
  assert.ok(detail.body.data.header.EmployerApprovedAt);
});

test("تهیه‌کننده نمی‌تواند صورت‌وضعیت خودش را تصویب کند", async () => {
  const id = await makeDraft();
  await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "submit", actor: "contractor" }, CONTRACTS);
  await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "approve", actor: "consultant" }, CONSULTANT);

  /* مدیر پیمان مجوز cnt.ipc.approve را ندارد — تفکیک وظیفه SOD-11. */
  const r = await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "approve", actor: "employer" }, CONTRACTS);
  assert.equal(r.status, 403);
  assert.equal(r.body.error.permission, "cnt.ipc.approve");
});

test("مشاور نمی‌تواند صورت‌وضعیت ارسال‌نشده را تأیید کند", async () => {
  const id = await makeDraft();
  const r = await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "approve", actor: "consultant" }, CONSULTANT);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-BAD-TRANSITION");
});

test("بازگشت برای اصلاح، مدرک را به پیش‌نویس برمی‌گرداند", async () => {
  const id = await makeDraft();
  await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action: "submit", actor: "contractor" }, CONTRACTS);

  const r = await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, {
    action: "return_for_correction", actor: "consultant", commentFa: "ریزمتره ناقص است",
  }, CONSULTANT);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.workflowState, "draft");
  assert.equal(r.body.data.locked, false);
});

test("اقدام روی صورت‌وضعیت ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await post(`/api/cnt/ipc/ipc-ghost/action?projectId=${PROJECT}`, { action: "submit", actor: "contractor" }, CONTRACTS);
  assert.equal(r.status, 404);
});

test("فهرست صورت‌وضعیت‌ها اقدام‌های مجاز بعدی را می‌دهد", async () => {
  const c = await makeContract();
  const item = await makeItem(c.Id);
  await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `L-${tag()}`,
    periodFrom: "2026-08-01", periodTo: "2026-08-31",
    lines: [{ boqItemId: item.Id, cumQty: 5 }],
  }, CONTRACTS);

  const r = await get(`/api/cnt/ipc?projectId=${PROJECT}&contractId=${c.Id}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.count, 1);
  const row = r.body.data.items[0];
  assert.deepEqual(row.nextActions, ["submit"]);
  assert.equal(row.workflowStateFa, "پیش‌نویس");
  assert.equal(row.locked, false);
});

test("وضعیت ماژول زیرماژول ۱۴٫۲ را تحویل‌شده اعلام می‌کند", async () => {
  const r = await get("/api/cnt/status");
  assert.equal(r.status, 200);
  assert.ok(r.body.data.delivered.includes("14.2"));
  assert.equal(r.body.data.vocabularies.ipcWorkflow.draft, "پیش‌نویس");
});
