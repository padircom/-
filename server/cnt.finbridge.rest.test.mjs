/**
 * آزمون اندپوینت‌های پل CNT→FIN (D13 / G-03) روی سرور واقعی.
 *
 * سؤال محوری: آیا پول درست جابه‌جا می‌شود، و آیا وقتی نباید جابه‌جا
 * شود واقعاً متوقف می‌ماند؟
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4729;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";

const CONTRACTS = "u-contracts";
const PM = "u-pm";
const COST = "u-cost";
const CONSULTANT = "u-consultant";
const SITE = "u-site";

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-fin-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  child = spawn(process.execPath, ["server/index.js"], {
    /* هر آزمون سناریوی کامل می‌سازد (حساب، پیمان، ردیف، صورت‌وضعیت،
       سه تأیید) پس ۳۸ آزمون از سقف ۳۰۰ درخواست در دقیقه رد می‌شود. */
    env: {
      ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir,
      RATE_LIMIT_PER_MINUTE: "100000",
    },
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

/** حساب هزینه از راه REST عمومی ساخته می‌شود. */
async function makeAccount(over = {}) {
  const r = await post(`/api/data/CostAccount?projectId=${PROJECT}`, {
    ProjectId: PROJECT, Code: `CA-${tag()}`, TitleFa: "حساب آزمون",
    Budget: 1_000_000, Committed: 0, Actual: 0, Currency: "IRR", ...over,
  }, PM);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data ?? r.body.item ?? r.body;
}

async function readAccount(id) {
  const r = await get(`/api/data/CostAccount/${id}?projectId=${PROJECT}`, PM);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.data ?? r.body.item ?? r.body;
}

async function makeContract(over = {}) {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `F-${tag()}`, titleFa: "پیمان پل مالی", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار",
    initialAmount: 1_000_000, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
    retainagePct: 10, ...over,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

async function addBoq(contractId, over = {}) {
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId, itemNo: `03${Math.floor(Math.random() * 9000 + 1000)}`, chapterCode: "03",
    titleFa: "بتن‌ریزی", pricingBasis: "unit_price", unit: "مترمکعب",
    contractQty: 100, unitRate: 1_000, ...over,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

async function addIpc(contractId, lines, { approve = false, deductions } = {}) {
  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId, periodCode: `P-${tag()}`,
    periodFrom: "2026-02-01", periodTo: "2026-02-28", lines,
    /* کسور صریح داده می‌شود چون `computeIpc` نرخ‌های پیمان را خودش
       نمی‌خواند (رفتار موجود D4). برای آزمون پل مالی لازم است خالص و
       ناخالص واقعاً فرق کنند. */
    ...(deductions ? { deductions } : {}),
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.data.id;
  if (approve) {
    for (const [action, actor, user] of [
      ["submit", "contractor", CONTRACTS],
      ["approve", "consultant", CONSULTANT],
      ["approve", "employer", "u-client"],
    ]) {
      const a = await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action, actor }, user);
      assert.equal(a.status, 200, `${action}/${actor}: ${JSON.stringify(a.body)}`);
    }
  }
  return id;
}

/** پیمان کامل با حساب هزینه و یک صورت‌وضعیت تأییدشده. */
async function scenario({ budget = 1_000_000, cumQty = 40 } = {}) {
  const acc = await makeAccount({ Budget: budget });
  const c = await makeContract();
  const b = await addBoq(c.Id);
  const ipc = await addIpc(c.Id, [{ boqItemId: b.Id, cumQty }], {
    approve: true,
    deductions: { retainagePct: 10, insuranceRatePct: 1.6 },
  });
  const link = await post(
    `/api/cnt/fin/account?projectId=${PROJECT}&contractId=${c.Id}`,
    { costAccountCode: acc.Code }, PM,
  );
  assert.equal(link.status, 200, JSON.stringify(link.body));
  return { acc, c, ipc, Q: `?projectId=${PROJECT}&contractId=${c.Id}` };
}

/* ═══════════ ۱. تعیین حساب هزینه ═══════════ */

test("پیمان تازه حساب هزینه ندارد و صریح اعلام می‌شود", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/fin/summary?projectId=${PROJECT}&contractId=${c.Id}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.costAccountCode, null);
  assert.ok(r.body.data.notesFa.some((n) => n.includes("هیچ عددی به مالی نمی‌رسد")));
});

test("حساب هزینهٔ ناموجود پذیرفته نمی‌شود", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/fin/account?projectId=${PROJECT}&contractId=${c.Id}`,
    { costAccountCode: "CA-GHOST" }, PM);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-FIN-ACCOUNT-UNKNOWN");
});

test("کد حساب خالی رد می‌شود", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/fin/account?projectId=${PROJECT}&contractId=${c.Id}`,
    { costAccountCode: "   " }, PM);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-FIN-NO-ACCOUNT-CODE");
});

test("تعیین حساب معتبر، پیمان را به مالی وصل می‌کند", async () => {
  const acc = await makeAccount();
  const c = await makeContract();
  const r = await post(`/api/cnt/fin/account?projectId=${PROJECT}&contractId=${c.Id}`,
    { costAccountCode: acc.Code }, PM);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.costAccountCode, acc.Code);
  assert.equal(r.body.data.account.id, acc.Id);
});

/* ═══════════ ۲. شرط ارسال ═══════════ */

test("صورت‌وضعیت پیش‌نویس ارسال نمی‌شود", async () => {
  const acc = await makeAccount();
  const c = await makeContract();
  const b = await addBoq(c.Id);
  const ipc = await addIpc(c.Id, [{ boqItemId: b.Id, cumQty: 20 }]);
  await post(`/api/cnt/fin/account?projectId=${PROJECT}&contractId=${c.Id}`,
    { costAccountCode: acc.Code }, PM);

  const r = await post(`/api/cnt/fin/post?projectId=${PROJECT}&contractId=${c.Id}`,
    { ipcId: ipc, apply: true }, PM);
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.error.code, "E-CNT-FIN-BLOCKED");
  assert.ok(r.body.error.message.includes("تأیید نهایی"));
});

test("پیمان بدون حساب هزینه، ارسال را متوقف می‌کند", async () => {
  const c = await makeContract();
  const b = await addBoq(c.Id);
  const ipc = await addIpc(c.Id, [{ boqItemId: b.Id, cumQty: 30 }], { approve: true });

  const r = await post(`/api/cnt/fin/post?projectId=${PROJECT}&contractId=${c.Id}`,
    { ipcId: ipc, apply: true }, PM);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.message.includes("حساب هزینه"));
});

test("شناسهٔ صورت‌وضعیت الزامی است", async () => {
  const s = await scenario();
  const r = await post(`/api/cnt/fin/post${s.Q}`, { apply: true }, PM);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-FIN-NO-IPC");
});

test("صورت‌وضعیت پیمان دیگر، ۴۰۴ می‌گیرد نه ۴۰۳", async () => {
  const a = await scenario();
  const b = await scenario();
  const r = await post(`/api/cnt/fin/post${a.Q}`, { ipcId: b.ipc, apply: true }, PM);
  assert.equal(r.status, 404, "وجود رکورد پیمان دیگر نباید قابل استنتاج باشد");
  assert.equal(r.body.error.code, "E-CNT-IPC-NOT-FOUND");
});

/* ═══════════ ۳. پیش‌نمایش و اعمال ═══════════ */

test("پیش‌نمایش هیچ عددی را تغییر نمی‌دهد", async () => {
  const s = await scenario();
  const before = await readAccount(s.acc.Id);

  const r = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc }, PM);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.mode, "preview");
  assert.ok(r.body.data.noteFa.includes("تغییر نکرد"));

  const after = await readAccount(s.acc.Id);
  assert.equal(Number(after.Actual), Number(before.Actual), "پیش‌نمایش نباید دفتر را دست بزند");
});

test("اعمال، خالص پرداختنی را روی حساب می‌نشاند", async () => {
  const s = await scenario();
  const r = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.mode, "applied");

  const net = r.body.data.posting.netAmount;
  assert.ok(net > 0);
  const acc = await readAccount(s.acc.Id);
  assert.equal(Number(acc.Actual), net, "Actual باید دقیقاً خالص پرداختنی شود");
});

test("ناخالص روی حساب نمی‌نشیند — کسور هنوز پول پروژه است", async () => {
  const s = await scenario();
  const r = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const p = r.body.data.posting;
  assert.ok(p.grossAmount > p.netAmount, "باید کسور داشته باشد");
  const acc = await readAccount(s.acc.Id);
  assert.notEqual(Number(acc.Actual), p.grossAmount);
});

test("پرچم PostedToFin روی صورت‌وضعیت ست می‌شود", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const r = await get(`/api/cnt/fin/postable${s.Q}`, CONTRACTS);
  const item = r.body.data.items.find((i) => i.ipcId === s.ipc);
  assert.equal(item.isPosted, true);
  assert.ok(item.postedAt);
});

/* ═══════════ ۴. ایدمپوتنسی ═══════════ */

test("ارسال دوباره جمع را دوبرابر نمی‌کند", async () => {
  const s = await scenario();
  const r1 = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const net = r1.body.data.posting.netAmount;

  const r2 = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal(r2.body.data.posting.isRepost, true);
  assert.equal(r2.body.data.posting.deltaAmount, 0);

  const acc = await readAccount(s.acc.Id);
  assert.equal(Number(acc.Actual), net, "کلیک دوم نباید اثری داشته باشد");
});

test("ارسال دوباره پیام صادقانه می‌دهد", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const r = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  assert.ok(r.body.data.noteFa.includes("ارسال دوباره"),
    "کاربر باید بداند این ارسال تازه نبود");
});

test("هر صورت‌وضعیت فقط یک سطر ثبت دارد", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const r = await get(`/api/cnt/fin/reconcile${s.Q}`, COST);
  const rows = r.body.data.rows.filter((x) => x.ipcId === s.ipc);
  assert.equal(rows.length, 1, "کلید یکتای IpcId باید سطر دوم را مهار کند");
});

/* ═══════════ ۵. بودجه ═══════════ */

test("ثبتی که از بودجه رد می‌کند بدون تأیید صریح انجام نمی‌شود", async () => {
  const s = await scenario({ budget: 1000, cumQty: 40 });
  const r = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.error.code, "E-CNT-FIN-OVER-BUDGET");
  assert.ok(r.body.error.detailsFa.some((d) => d.includes("acceptOverBudget")));

  const acc = await readAccount(s.acc.Id);
  assert.equal(Number(acc.Actual), 0, "رد شدن باید کامل باشد نه نیمه‌کاره");
});

test("با تأیید صریح، ثبت فراتر از بودجه انجام می‌شود", async () => {
  const s = await scenario({ budget: 1000, cumQty: 40 });
  const r = await post(`/api/cnt/fin/post${s.Q}`,
    { ipcId: s.ipc, apply: true, acceptOverBudget: true }, PM);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.budget.isOverBudget, true);
  const acc = await readAccount(s.acc.Id);
  assert.ok(Number(acc.Actual) > 1000);
});

test("پیش‌نمایش فراتر از بودجه رد نمی‌شود — فقط هشدار می‌دهد", async () => {
  const s = await scenario({ budget: 1000, cumQty: 40 });
  const r = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc }, PM);
  assert.equal(r.status, 200, "پیش‌نمایش باید بتواند مشکل را نشان دهد");
  assert.equal(r.body.data.budget.isOverBudget, true);
  assert.ok(r.body.data.budget.warningFa);
});

/* ═══════════ ۶. برگشت ثبت ═══════════ */

test("برگشت بدون دلیل انجام نمی‌شود", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  for (const reason of [undefined, "", "کوتاه"]) {
    const r = await post(`/api/cnt/fin/reverse${s.Q}`, { ipcId: s.ipc, reasonFa: reason }, PM);
    assert.equal(r.status, 422, `دلیل «${reason}» نباید پذیرفته شود`);
    assert.equal(r.body.error.code, "E-CNT-FIN-NO-REASON");
  }
});

test("برگشت، مبلغ را از حساب پس می‌گیرد", async () => {
  const s = await scenario();
  const p = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const net = p.body.data.posting.netAmount;

  const r = await post(`/api/cnt/fin/reverse${s.Q}`,
    { ipcId: s.ipc, reasonFa: "صورت‌وضعیت اشتباه ارسال شده بود" }, PM);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.reversedAmount, net);

  const acc = await readAccount(s.acc.Id);
  assert.equal(Number(acc.Actual), 0);
});

test("سطر برگشتی حذف نمی‌شود — رد ممیزی می‌ماند", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const r = await post(`/api/cnt/fin/reverse${s.Q}`,
    { ipcId: s.ipc, reasonFa: "اصلاح مبلغ لازم است" }, PM);
  assert.ok(r.body.data.noteFa.includes("نگهداری"));
});

test("برگشت دوباره رد می‌شود", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  await post(`/api/cnt/fin/reverse${s.Q}`, { ipcId: s.ipc, reasonFa: "دلیل کافی برای برگشت" }, PM);
  const r = await post(`/api/cnt/fin/reverse${s.Q}`, { ipcId: s.ipc, reasonFa: "دوباره برگشت بزن" }, PM);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-FIN-ALREADY-REVERSED");
});

test("برگشت ثبت ناموجود، ۴۰۴ می‌گیرد", async () => {
  const s = await scenario();
  const r = await post(`/api/cnt/fin/reverse${s.Q}`,
    { ipcId: s.ipc, reasonFa: "چیزی که ثبت نشده را برگردان" }, PM);
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, "E-CNT-FIN-NOT-POSTED");
});

test("پس از برگشت، ارسال دوباره ممکن است", async () => {
  const s = await scenario();
  const p1 = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const net = p1.body.data.posting.netAmount;
  await post(`/api/cnt/fin/reverse${s.Q}`, { ipcId: s.ipc, reasonFa: "برگشت برای اصلاح حساب" }, PM);

  const p2 = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  assert.equal(p2.status, 200, JSON.stringify(p2.body));
  assert.equal(p2.body.data.posting.isRepost, false, "ثبت برگشتی سهم ندارد");

  const acc = await readAccount(s.acc.Id);
  assert.equal(Number(acc.Actual), net, "نباید دوبرابر شود");
});

/* ═══════════ ۷. تطبیق ═══════════ */

test("پیمان کاملاً ارسال‌شده، تطبیق تمیز دارد", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const r = await get(`/api/cnt/fin/reconcile${s.Q}`, COST);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.summary.isClean, true);
  assert.deepEqual(r.body.data.warningsFa, []);
});

test("صورت‌وضعیت تأییدشدهٔ ارسال‌نشده در تطبیق دیده می‌شود", async () => {
  const s = await scenario();
  const r = await get(`/api/cnt/fin/reconcile${s.Q}`, COST);
  assert.equal(r.body.data.summary.notPosted, 1);
  assert.ok(r.body.data.summary.notPostedAmount > 0);
  assert.ok(r.body.data.warningsFa.some((w) => w.includes("تعهد ثبت‌نشده")));
});

test("کد حساب معتبر ولی حساب پاک‌شده، جدا اعلام می‌شود", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/fin/reconcile?projectId=${PROJECT}&contractId=${c.Id}`, COST);
  assert.equal(r.body.data.costAccountFound, false);
  assert.equal(r.body.data.costAccountCode, null);
});

test("پیمان ناموجود در تطبیق، ۴۰۴ می‌گیرد", async () => {
  const r = await get(`/api/cnt/fin/reconcile?projectId=${PROJECT}&contractId=nope`, COST);
  assert.equal(r.status, 404);
});

test("فهرست قابل ارسال، آماده و مسدود را جدا می‌شمارد", async () => {
  const s = await scenario();
  const b2 = await addBoq(s.c.Id);
  await addIpc(s.c.Id, [{ boqItemId: b2.Id, cumQty: 5 }]);

  const r = await get(`/api/cnt/fin/postable${s.Q}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.readyCount, 1);
  assert.equal(r.body.data.blockedCount, 1, "پیش‌نویس باید مسدود باشد");
});

/* ═══════════ ۸. خلاصهٔ مالی ═══════════ */

test("خلاصه، کسورِ در حساب ننشسته را توضیح می‌دهد", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const r = await get(`/api/cnt/fin/summary${s.Q}`, CONTRACTS);
  assert.ok(r.body.data.withheldAmount > 0);
  assert.ok(r.body.data.notesFa.some((n) => n.includes("پول پروژه")));
});

test("خلاصه، مانده و بودجهٔ حساب را نشان می‌دهد", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const r = await get(`/api/cnt/fin/summary${s.Q}`, CONTRACTS);
  assert.ok(r.body.data.account);
  assert.equal(r.body.data.account.code, s.acc.Code);
  assert.ok(r.body.data.account.actual > 0);
});

/* ═══════════ ۹. دسترسی ═══════════ */

test("بدون کاربر، ۴۰۱ می‌گیرد", async () => {
  const s = await scenario();
  const r = await get(`/api/cnt/fin/reconcile${s.Q}`, null);
  assert.equal(r.status, 401);
});

test("مدیر پیمان تطبیق را می‌بیند ولی ارسال نمی‌کند — SOD-15", async () => {
  const s = await scenario();
  const seen = await get(`/api/cnt/fin/reconcile${s.Q}`, CONTRACTS);
  assert.equal(seen.status, 200, "مدیر پیمان باید بداند چه چیزی ارسال نشده");

  const tried = await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, CONTRACTS);
  assert.equal(tried.status, 403, "تهیه‌کنندهٔ صورت‌وضعیت نباید آن را در دفتر بنشاند");
  assert.equal(tried.body.error.permission, "cnt.fin.post");
});

test("کنترل هزینه مغایرت را می‌بیند ولی ارسال نمی‌کند", async () => {
  const s = await scenario();
  assert.equal((await get(`/api/cnt/fin/reconcile${s.Q}`, COST)).status, 200);
  assert.equal((await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, COST)).status, 403);
});

test("مهندس کارگاه به دفتر مالی دسترسی ندارد", async () => {
  const s = await scenario();
  assert.equal((await get(`/api/cnt/fin/reconcile${s.Q}`, SITE)).status, 403);
  assert.equal((await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc }, SITE)).status, 403);
});

test("تعیین حساب هزینه هم مجوز ارسال می‌خواهد", async () => {
  const c = await makeContract();
  const acc = await makeAccount();
  const r = await post(`/api/cnt/fin/account?projectId=${PROJECT}&contractId=${c.Id}`,
    { costAccountCode: acc.Code }, CONTRACTS);
  assert.equal(r.status, 403, "انتخاب مقصد پول همان‌قدر حساس است که فرستادنش");
});

test("برگشت ثبت هم مجوز ارسال می‌خواهد", async () => {
  const s = await scenario();
  await post(`/api/cnt/fin/post${s.Q}`, { ipcId: s.ipc, apply: true }, PM);
  const r = await post(`/api/cnt/fin/reverse${s.Q}`,
    { ipcId: s.ipc, reasonFa: "تلاش برای برگشت بدون مجوز" }, COST);
  assert.equal(r.status, 403);
});

/* ═══════════ ۱۰. نشت بین پروژه‌ها ═══════════ */

test("پیمان پروژهٔ دیگر، ۴۰۴ می‌گیرد نه ۴۰۳", async () => {
  const s = await scenario();
  for (const p of ["fin/reconcile", "fin/summary", "fin/postable"]) {
    const r = await get(`/api/cnt/${p}?projectId=p2&contractId=${s.c.Id}`, PM);
    assert.equal(r.status, 404, `${p} نباید وجود پیمان را لو بدهد`);
  }
});
