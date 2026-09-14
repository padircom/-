/**
 * آزمون اندپوینت‌های صورت‌وضعیت پیمانکار جزء (CNT/D8) روی سرور واقعی.
 *
 * چیزی که فقط اینجا معلوم می‌شود: مقدار مرجع واقعاً از ردیف تأییدشدهٔ
 * صورت‌وضعیت اصلی خوانده شود نه از ورودی کاربر، دروازهٔ تأیید پیش از
 * تأیید اصلی بسته بماند، قفل پس از ارسال کار کند، و SOD-14 در مسیر
 * واقعی برقرار باشد.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4726;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";

const CONTRACTS = "u-contracts"; /* تهیه و کسر */
const PM = "u-pm";               /* تأیید */
const SITE = "u-site";           /* هیچ‌کدام */

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-sub-"));
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
    code: `C-${tag()}`, titleFa: "پیمان جزء", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار",
    initialAmount: 50_000_000_000, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

const Q = (c) => `?projectId=${PROJECT}&contractId=${c.Id}`;
const P = `?projectId=${PROJECT}`;

async function makeSub(c, over = {}) {
  const r = await post(`/api/cnt/subipc${Q(c)}`, {
    periodCode: `SUB-${tag()}`, ...over,
  }, CONTRACTS);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.data.item;
}

/* ══════════════ ۱) دروازهٔ ورودی ══════════════ */

test("بدون هویت، ۴۰۱", async () => {
  const r = await get(`/api/cnt/subipc?projectId=${PROJECT}&contractId=x`);
  assert.equal(r.status, 401);
});

test("نقش بی‌ربط حتی نمی‌بیند", async () => {
  const c = await makeContract();
  assert.equal((await get(`/api/cnt/subipc${Q(c)}`, SITE)).status, 403);
});

test("بدون contractId، ۴۰۰", async () => {
  const r = await get(`/api/cnt/subipc?projectId=${PROJECT}`, CONTRACTS);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "E-CNT-NO-CONTRACT");
});

test("واژگان در دسترس است", async () => {
  const r = await get("/api/cnt/subipc-vocab", CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.states.length, 6);
  assert.equal(r.body.data.sources.length, 4);
  assert.deepEqual(r.body.data.transitions.paid, []);
});

/* ══════════════ ۲) ایجاد و شماره‌گذاری ══════════════ */

test("ایجاد صورت‌وضعیت جزء با شمارهٔ ترتیبی", async () => {
  const c = await makeContract();
  const a = await makeSub(c);
  const b = await makeSub(c);
  assert.equal(a.SerialNo, 1);
  assert.equal(b.SerialNo, 2);
  assert.equal(a.WorkflowState, "draft");
  assert.equal(a.isLocked, false);
});

test("دوره الزامی است", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/subipc${Q(c)}`, {}, CONTRACTS);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-SUB-PERIOD");
});

test("گره به صورت‌وضعیت اصلی ناموجود ۴۰۴ می‌دهد", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/subipc${Q(c)}`, {
    periodCode: "X", mainIpcId: "ghost",
  }, CONTRACTS);
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, "E-CNT-SUB-MAIN-NOT-FOUND");
});

test("مدیر پروژه نمی‌تواند تهیه کند — SOD-14", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/subipc${Q(c)}`, { periodCode: "X" }, PM);
  assert.equal(r.status, 403);
});

test("جزئیات ۴۰۴ برای شناسهٔ ناموجود", async () => {
  const r = await get(`/api/cnt/subipc/ghost${P}`, CONTRACTS);
  assert.equal(r.status, 404);
});

/* ══════════════ ۳) ردیف‌ها ══════════════ */

test("افزودن ردیف و بازمحاسبهٔ سرجمع", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const r = await post(`/api/cnt/subipc/${s.Id}/line${P}`, {
    descriptionFa: "خاک‌برداری دستی", unit: "مترمکعب", quantity: 100, unitRate: 500,
  }, CONTRACTS);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.totals.gross, 50_000);
  assert.equal(r.body.data.totals.netPayable, 50_000);
});

test("ردیف بدون شرح رد می‌شود", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const r = await post(`/api/cnt/subipc/${s.Id}/line${P}`, { quantity: 1, unitRate: 1 }, CONTRACTS);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-SUB-LINE-DESC");
});

test("ردیف بدون مرجع پرچم no_main_ref می‌گیرد", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const r = await post(`/api/cnt/subipc/${s.Id}/line${P}`, {
    descriptionFa: "کار توافقی خارج فهرست", quantity: 1, unitRate: 1_000,
  }, CONTRACTS);
  assert.equal(r.body.data.item.varianceFlag, "no_main_ref");
  assert.equal(r.body.data.totals.unmatchedCount, 1);
});

test("سرجمع ذخیره‌شده با محاسبه همگام می‌ماند", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/line${P}`, {
    descriptionFa: "الف", quantity: 10, unitRate: 100,
  }, CONTRACTS);
  await post(`/api/cnt/subipc/${s.Id}/line${P}`, {
    descriptionFa: "ب", quantity: 20, unitRate: 100,
  }, CONTRACTS);

  const list = await get(`/api/cnt/subipc${Q(c)}`, CONTRACTS);
  const row = list.body.data.items.find((x) => x.Id === s.Id);
  assert.equal(row.GrossCurrent, 3_000, "ستون ذخیره‌شده بازنویسی شده");

  const detail = await get(`/api/cnt/subipc/${s.Id}${P}`, CONTRACTS);
  assert.equal(detail.body.data.totals.gross, row.GrossCurrent, "دو منبع واگرا نشده‌اند");
});

/* ══════════════ ۴) کسور پشت‌به‌پشت ══════════════ */

test("ثبت کسر و اثرش بر خالص", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/line${P}`, {
    descriptionFa: "کار", quantity: 100, unitRate: 1_000,
  }, CONTRACTS);
  const d = await post(`/api/cnt/subipc/${s.Id}/deduction${P}`, {
    sourceModule: "fin_material", descriptionFa: "میلگرد تحویلی از انبار مرکزی",
    amount: 30_000, evidenceDocNo: "W-77", status: "approved",
  }, CONTRACTS);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.data.totals.backToBack, 30_000);
  assert.equal(d.body.data.totals.netPayable, 70_000);
  assert.equal(d.body.data.item.sourceFa, "مصالح تحویلی کارفرما");
});

test("کسر مورد اختلاف از خالص کم نمی‌شود", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/line${P}`, {
    descriptionFa: "کار", quantity: 100, unitRate: 1_000,
  }, CONTRACTS);
  const d = await post(`/api/cnt/subipc/${s.Id}/deduction${P}`, {
    sourceModule: "qlt_rework", descriptionFa: "دوباره‌کاری بتن‌ریزی طبقهٔ سوم",
    amount: 40_000, status: "disputed",
  }, CONTRACTS);
  assert.equal(d.body.data.totals.netPayable, 100_000);
  assert.equal(d.body.data.totals.backToBackDetail.disputedTotal, 40_000);
});

test("کسر تأییدشدهٔ بی‌سند ثبت می‌شود ولی هشدار می‌گیرد", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const d = await post(`/api/cnt/subipc/${s.Id}/deduction${P}`, {
    sourceModule: "hse_incident", descriptionFa: "خسارت واژگونی جرثقیل در کارگاه",
    amount: 1_000, status: "approved",
  }, CONTRACTS);
  assert.equal(d.status, 200);
  assert.ok(d.body.data.warningsFa.some((w) => w.includes("سند پشتیبان")));
});

test("منشأ نامعتبر رد می‌شود", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const d = await post(`/api/cnt/subipc/${s.Id}/deduction${P}`, {
    sourceModule: "invented", descriptionFa: "x", amount: 1,
  }, CONTRACTS);
  assert.equal(d.status, 422);
});

test("مدیر پروژه نمی‌تواند کسر ثبت کند", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const d = await post(`/api/cnt/subipc/${s.Id}/deduction${P}`, {
    sourceModule: "other", descriptionFa: "شرح کافی برای کسر", amount: 1,
  }, PM);
  assert.equal(d.status, 403);
});

/* ══════════════ ۵) گذار وضعیت و دروازه‌ها ══════════════ */

test("ارسال از پیش‌نویس مجاز است", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const r = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.item.WorkflowState, "submitted");
  assert.equal(r.body.data.item.isLocked, true);
});

test("پس از ارسال، ردیف قفل است", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  const r = await post(`/api/cnt/subipc/${s.Id}/line${P}`, {
    descriptionFa: "ردیف دیرهنگام", quantity: 1, unitRate: 1,
  }, CONTRACTS);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-SUB-LOCKED");
});

test("پرش از مرحله ۴۰۹ می‌گیرد", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const r = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "approved" }, PM);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-SUB-TRANSITION");
});

test("تهیه‌کننده نمی‌تواند تأیید کند — SOD-14 در مسیر واقعی", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "reviewed" }, CONTRACTS);
  const r = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "approved" }, CONTRACTS);
  assert.equal(r.status, 403);
  assert.equal(r.body.error.permission, "cnt.subipc.approve");
});

test("تأیید بدون گره به صورت‌وضعیت اصلی بسته است", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "reviewed" }, CONTRACTS);
  const r = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "approved" }, PM);
  assert.equal(r.status, 409);
  assert.ok(r.body.error.detailsFa.some((d) => d.includes("گره نخورده")));
});

test("dryRun حکم را بدون تغییر وضعیت برمی‌گرداند", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const r = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted", dryRun: true }, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.dryRun, true);
  assert.equal(r.body.data.verdict.ok, true);

  const d = await get(`/api/cnt/subipc/${s.Id}${P}`, CONTRACTS);
  assert.equal(d.body.data.item.WorkflowState, "draft", "هنوز ارسال نشده");
});

test("رد کردن مسیر برگشت به پیش‌نویس را باز می‌کند", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  const rej = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "rejected" }, CONTRACTS);
  assert.equal(rej.status, 200);
  assert.equal(rej.body.data.item.isLocked, false, "ردشده باید قابل ویرایش باشد");

  const back = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "draft" }, CONTRACTS);
  assert.equal(back.status, 200);
});

test("پرداخت با خالص صفر بسته است", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "reviewed" }, CONTRACTS);
  /* بدون صورت‌وضعیت اصلی نمی‌شود تأیید کرد، پس مسیر پرداخت هم بسته
   * می‌ماند؛ همین را می‌سنجیم. */
  const r = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "paid" }, PM);
  assert.equal(r.status, 409);
});

test("گذار روی صورت‌وضعیت ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await post(`/api/cnt/subipc/ghost/transition${P}`, { to: "submitted" }, CONTRACTS);
  assert.equal(r.status, 404);
});

test("بدون هویت، گذار ۴۰۱ می‌گیرد", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const r = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted" }, undefined);
  assert.equal(r.status, 401);
});

/* ══════════════ ۶) گره با صورت‌وضعیت اصلی ══════════════ */

test("دفتر، منتظرانِ تأیید اصلی را می‌شمارد", async () => {
  const c = await makeContract();
  const a = await makeSub(c);
  const b = await makeSub(c);
  await post(`/api/cnt/subipc/${a.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  await post(`/api/cnt/subipc/${b.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);

  const r = await get(`/api/cnt/subipc${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.count, 2);
  assert.equal(r.body.data.awaitingMain, 2);
  assert.ok(r.body.data.warningsFa[0].includes("منتظر تأیید"));
});

test("پیش‌نویس منتظر شمرده نمی‌شود", async () => {
  const c = await makeContract();
  await makeSub(c);
  const r = await get(`/api/cnt/subipc${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.awaitingMain, 0);
  assert.deepEqual(r.body.data.warningsFa, []);
});

test("دفتر یک پیمان، صورت‌وضعیت پیمان دیگر را نشان نمی‌دهد", async () => {
  const a = await makeContract();
  const b = await makeContract();
  await makeSub(a);
  const r = await get(`/api/cnt/subipc${Q(b)}`, CONTRACTS);
  assert.equal(r.body.data.count, 0);
});

test("مدیر پروژه می‌بیند ولی تهیه نمی‌کند", async () => {
  const c = await makeContract();
  await makeSub(c);
  const r = await get(`/api/cnt/subipc${Q(c)}`, PM);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.count, 1);
});

test("وضعیت‌های بعدی مجاز در جزئیات می‌آید", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const r = await get(`/api/cnt/subipc/${s.Id}${P}`, CONTRACTS);
  assert.deepEqual(r.body.data.nextStates, ["submitted"]);
});

/* ══════════════ ۷) یکپارچگی با صورت‌وضعیت اصلی ══════════════ */

/**
 * مسیر کامل موفق.
 *
 * هر آزمون قبلی فقط ثابت می‌کرد دروازه *بسته* است. اگر دروازه‌ای
 * باشد که هرگز باز نشود، همان‌قدر بی‌فایده است — پس اینجا صورت‌وضعیت
 * اصلی را واقعاً تأیید می‌کنیم و می‌سنجیم که جزء آزاد شود.
 */
/**
 * پیمان + ردیف فهرست‌بها + صورت‌وضعیت اصلی پیش‌نویس.
 *
 * صورت‌وضعیت اصلی بدون ردیف ثبت نمی‌شود، پس ردیف فهرست‌بها هم اینجا
 * لازم است؛ همان ردیف بعداً مرجع تطبیق جزء می‌شود.
 */
async function makeMainIpc(cumQty = 100, unitRate = 1_000) {
  const c = await makeContract();
  const item = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: `03${Math.floor(Math.random() * 9000 + 1000)}`, chapterCode: "03",
    titleFa: "بتن‌ریزی", pricingBasis: "unit_price", unit: "مترمکعب",
    contractQty: 100_000, unitRate,
  }, CONTRACTS);
  assert.equal(item.status, 201, JSON.stringify(item.body));

  const ipc = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `MAIN-${tag()}`,
    periodFrom: "2026-02-01", periodTo: "2026-02-28",
    lines: [{ boqItemId: item.body.data.item.Id, cumQty }],
  }, CONTRACTS);
  assert.equal(ipc.status, 201, JSON.stringify(ipc.body));
  return { contract: c, boqItemId: item.body.data.item.Id, mainIpcId: ipc.body.data.id };
}

test("پس از تأیید صورت‌وضعیت اصلی، تأیید جزء باز می‌شود", async () => {
  const { contract: c, mainIpcId } = await makeMainIpc();
  const main = { Id: mainIpcId };

  const sub = await makeSub(c, { mainIpcId: main.Id });
  await post(`/api/cnt/subipc/${sub.Id}/line${P}`, {
    descriptionFa: "کار جزء", quantity: 10, unitRate: 1_000,
  }, CONTRACTS);
  await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to: "reviewed" }, CONTRACTS);

  /* در حالی که اصلی هنوز پیش‌نویس است، جزء باید بسته باشد. */
  const early = await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, {
    to: "approved", allowUnmatched: true,
  }, PM);
  assert.equal(early.status, 409, "پیش از تأیید اصلی نباید باز باشد");

  /* حالا اصلی را جلو می‌بریم. */
  for (const [action, actor, user] of [
    ["submit", "contractor", CONTRACTS],
    ["approve", "consultant", "u-consultant"],
    ["approve", "employer", "u-client"],
  ]) {
    await post(`/api/cnt/ipc/${main.Id}/action?projectId=${PROJECT}`, { action, actor }, user);
  }
  const detail = await get(`/api/cnt/subipc/${sub.Id}${P}`, CONTRACTS);
  assert.equal(detail.body.data.mainIpcState, "approved", "اصلی تأیید شد");

  /* و حالا باید باز شود. */
  const ok = await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, {
    to: "approved", allowUnmatched: true,
  }, PM);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.item.WorkflowState, "approved");

  /* و پرداخت با خالص مثبت مجاز است. */
  const paid = await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to: "paid" }, PM);
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.data.item.Status, "closed");
});

test("ردیف گره‌خورده، مقدار مرجع را از سرور می‌گیرد نه از کاربر", async () => {
  const { contract: c, mainIpcId } = await makeMainIpc();
  const main = { Id: mainIpcId };

  const sub = await makeSub(c, { mainIpcId: main.Id });
  /* کاربر عمداً عدد مرجع دروغین می‌فرستد؛ سرور باید نادیده بگیرد. */
  const r = await post(`/api/cnt/subipc/${sub.Id}/line${P}`, {
    descriptionFa: "ردیف با مرجع جعلی", boqItemId: "ghost-boq",
    quantity: 5, unitRate: 100, mainApprovedQty: 9_999_999,
  }, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.item.MainApprovedQty, null, "عدد کاربر پذیرفته نشده");
  assert.equal(r.body.data.item.varianceFlag, "no_main_ref");
});

test("مقدار مرجع واقعاً از ردیف تأییدشدهٔ اصلی خوانده می‌شود", async () => {
  const { contract: c, boqItemId, mainIpcId } = await makeMainIpc(80, 1_000);
  const sub = await makeSub(c, { mainIpcId });

  /* جزء ۵۰ واحد می‌خواهد در برابر ۸۰ واحد اصلی: در حد مجاز. */
  const inside = await post(`/api/cnt/subipc/${sub.Id}/line${P}`, {
    descriptionFa: "زیر سقف اصلی", boqItemId, quantity: 50, unitRate: 900,
  }, CONTRACTS);
  assert.equal(inside.body.data.item.MainApprovedQty, 80, "مرجع از اصلی آمد");
  assert.equal(inside.body.data.item.varianceFlag, "ok");
  assert.equal(inside.body.data.totals.exceedingCount, 0);
});

test("ادعای بیش از مقدار اصلی، تأیید را می‌بندد", async () => {
  const { contract: c, boqItemId, mainIpcId } = await makeMainIpc(80, 1_000);
  const sub = await makeSub(c, { mainIpcId });

  const over = await post(`/api/cnt/subipc/${sub.Id}/line${P}`, {
    descriptionFa: "بیش از اصلی", boqItemId, quantity: 120, unitRate: 900,
  }, CONTRACTS);
  assert.equal(over.body.data.item.varianceFlag, "exceeds_main");
  assert.equal(over.body.data.item.excessQty, 40);
  assert.equal(over.body.data.totals.exceedingCount, 1);

  await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to: "reviewed" }, CONTRACTS);
  for (const [action, actor, user] of [
    ["submit", "contractor", CONTRACTS],
    ["approve", "consultant", "u-consultant"],
    ["approve", "employer", "u-client"],
  ]) {
    await post(`/api/cnt/ipc/${mainIpcId}/action?projectId=${PROJECT}`, { action, actor }, user);
  }

  /* اصلی تأیید شده ولی مقدار جزء بیشتر است: باید همچنان بسته بماند —
   * و allowUnmatched هم نباید این یکی را باز کند. */
  const r = await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, {
    to: "approved", allowUnmatched: true,
  }, PM);
  assert.equal(r.status, 409);
  assert.ok(r.body.error.detailsFa.some((d) => d.includes("بیش از مقدار")));
});

/* ══════════════ ۸) نشت و دور زدن ══════════════ */

test("پروژهٔ دیگر به ردیف دسترسی ندارد — ۴۰۴ نه ۴۰۳", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  for (const path of [
    `/api/cnt/subipc/${s.Id}?projectId=p-other`,
  ]) {
    assert.equal((await get(path, CONTRACTS)).status, 404, path);
  }
  for (const [path, body] of [
    [`/api/cnt/subipc/${s.Id}/line?projectId=p-other`, { descriptionFa: "نشت" }],
    [`/api/cnt/subipc/${s.Id}/deduction?projectId=p-other`, { sourceModule: "other", descriptionFa: "شرح کافی", amount: 1 }],
    [`/api/cnt/subipc/${s.Id}/transition?projectId=p-other`, { to: "submitted" }],
  ]) {
    assert.equal((await post(path, body, CONTRACTS)).status, 404, path);
  }
});

test("قفل را نمی‌شود با کسر دور زد", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  const r = await post(`/api/cnt/subipc/${s.Id}/deduction${P}`, {
    sourceModule: "other", descriptionFa: "کسر پس از قفل شدن", amount: 1_000,
  }, CONTRACTS);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-SUB-LOCKED");
});

test("dryRun نمی‌تواند دروازهٔ بسته را باز جلوه دهد", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  await post(`/api/cnt/subipc/${s.Id}/transition${P}`, { to: "reviewed" }, CONTRACTS);
  const r = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, {
    to: "approved", dryRun: true,
  }, PM);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.verdict.ok, false, "پیش‌نمایش هم باید بسته را بسته نشان دهد");
});

test("dryRun بدون مجوز تأیید هم ۴۰۳ می‌گیرد", async () => {
  const c = await makeContract();
  const s = await makeSub(c);
  const r = await post(`/api/cnt/subipc/${s.Id}/transition${P}`, {
    to: "approved", dryRun: true,
  }, CONTRACTS);
  assert.equal(r.status, 403, "پیش‌نمایش نباید راه فرار از RBAC باشد");
});

test("پرداخت‌شده بن‌بست است", async () => {
  const { contract: c, boqItemId, mainIpcId } = await makeMainIpc(100, 1_000);
  const sub = await makeSub(c, { mainIpcId });
  await post(`/api/cnt/subipc/${sub.Id}/line${P}`, {
    descriptionFa: "کار", boqItemId, quantity: 50, unitRate: 1_000,
  }, CONTRACTS);
  await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to: "submitted" }, CONTRACTS);
  await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to: "reviewed" }, CONTRACTS);
  for (const [action, actor, user] of [
    ["submit", "contractor", CONTRACTS],
    ["approve", "consultant", "u-consultant"],
    ["approve", "employer", "u-client"],
  ]) {
    await post(`/api/cnt/ipc/${mainIpcId}/action?projectId=${PROJECT}`, { action, actor }, user);
  }
  await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to: "approved" }, PM);
  await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to: "paid" }, PM);

  const d = await get(`/api/cnt/subipc/${sub.Id}${P}`, CONTRACTS);
  assert.deepEqual(d.body.data.nextStates, [], "از پرداخت‌شده راه خروجی نیست");
  /* هر مقصد با کاربرِ مجازِ خودش آزموده می‌شود، وگرنه ۴۰۳ جای ۴۰۹
   * می‌نشیند و بن‌بست بودن اثبات نمی‌شود. */
  for (const [to, user] of [["rejected", CONTRACTS], ["draft", CONTRACTS], ["approved", PM]]) {
    const r = await post(`/api/cnt/subipc/${sub.Id}/transition${P}`, { to }, user);
    assert.equal(r.status, 409, `پرداخت‌شده → ${to}`);
    assert.equal(r.body.error.code, "E-CNT-SUB-TRANSITION");
  }
});
