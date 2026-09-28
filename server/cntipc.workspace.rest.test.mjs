/**
 * P8 CNT-1 — قالب‌پذیری صورت‌وضعیت (d14) روی سرور واقعی (درایور JSON).
 *
 * سؤال محوری: قالبِ ردیف/کسر‌محور واقعاً ذخیره و منتشر می‌شود، محاسبه همیشه
 * سمت سرور و در برابر محاسبهٔ مستقل درست است، سند پس از ارسال/تصویب دوباره
 * محاسبه و کهنگی (stale) رد می‌شود، تهیه‌کننده ≠ تصویب‌کننده (SOD-11)، و CRUD
 * عمومی روی جدول‌های CNT IPC بسته است؟
 *
 * اجرا با پوشهٔ دادهٔ جداگانه؛ به rundata کاربر دست نمی‌زند.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRepository, JsonFileDriver } from "./persistence/driver.mjs";

const PORT = 4747;
const BASE = `http://127.0.0.1:${PORT}`;
const PID = "c1-p1";
const OTHER = "c1-p2";
const TAG = `C8${Date.now().toString(36).toUpperCase()}`;
const code = (n) => `${TAG}-${n}`;
const TPL = code("TPL");
const TPL2 = code("TPL2");
const CONTRACT = code("CON");

let child = null;
let dataDir = null;
let storageDir = null;
const repo = () => createRepository(new JsonFileDriver(dataDir));

async function startServer() {
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir, FILE_STORAGE_PATH: storageDir },
    stdio: "ignore",
  });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (r.status < 500 || r.status === 503) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون CNT IPC بالا نیامد");
}
async function stopServer() {
  if (!child) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await exited;
  child = null;
}
async function restart() {
  await stopServer();
  await startServer();
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cntipc-data-"));
  storageDir = await mkdtemp(path.join(tmpdir(), "cntipc-files-"));
  const r = repo();
  await r.create("ContractMaster", {
    ProjectId: PID, Code: CONTRACT, TitleFa: "پیمان آزمون", ContractType: "lump_sum", Party: "client",
    EmployerName: "کارفرما", ContractorName: "پیمانکار آزمون", SignDate: "2026-01-01", StartDate: "2026-01-01",
    DurationDays: 365, InitialAmount: 10_000_000, CurrentAmount: 10_000_000, Currency: "IRR",
    CeilingPct: 10, RetainagePct: 5, AdjustmentEnabled: false, Status: "active",
  }, "u-contracts", "cnt");
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

async function call(method, p, { user, body, project = PID } = {}) {
  const res = await fetch(`${BASE}/api/cnt-ipc/${project}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const ws = async (user = "u-cost", project = PID) => (await call("GET", "/workspace", { user, project })).body.data;
const err = (r) => r.body?.error?.code;

/* قالب نمونه: ردیف اندازه‌گیری‌شده + مقطوع + درصدی از مقطوع، و سه کسر با
   پایه‌های متفاوت تا ترتیب اجرای کسورات هم آزموده شود. */
const templateBody = (over = {}) => ({
  Code: TPL, TitleFa: "قالب استاندارد صورت‌وضعیت", ContractCode: CONTRACT,
  Items: [
    { Code: "R01", TitleFa: "ردیف اندازه‌گیری‌شده", Unit: "m3", Basis: "measured", Sign: "+" },
    { Code: "R02", TitleFa: "ردیف مقطوع", Unit: "ls", Basis: "lump", Sign: "+" },
    { Code: "R03", TitleFa: "سهم تجهیزات", Unit: "%", Basis: "percent", PercentOf: "R02", Sign: "+" },
    { Code: "R04", TitleFa: "کسری کارکرد", Unit: "ls", Basis: "lump", Sign: "-" },
  ],
  Deductions: [
    { Code: "D01", TitleFa: "حسن انجام کار", Kind: "retention", Mode: "percent", Rate: 5, Base: "gross" },
    { Code: "D02", TitleFa: "بازیافت پیش‌پرداخت", Kind: "advance", Mode: "percent", Rate: 10, Base: "running" },
    { Code: "D03", TitleFa: "مالیات تکلیفی", Kind: "tax", Mode: "fixed", Rate: 500, Base: "item", ItemCode: "R01" },
  ],
  ...over,
});
const inputsBody = [
  { ItemCode: "R01", Quantity: 10, UnitRate: 1000 },   // ۱۰٬۰۰۰
  { ItemCode: "R02", Amount: 5000 },                   // ۵٬۰۰۰
  { ItemCode: "R03", Percent: 20 },                    // ۲۰٪ × ۵٬۰۰۰ = ۱٬۰۰۰
  { ItemCode: "R04", Amount: 500 },                    // −۵۰۰
];
/* محاسبهٔ دستی مستقل از سرور:
   ناخالص = ۱۰٬۰۰۰ + ۵٬۰۰۰ + ۱٬۰۰۰ − ۵۰۰ = ۱۵٬۵۰۰
   D01 = ۵٪ × ۱۵٬۵۰۰ = ۷۷۵  → مانده ۱۴٬۷۲۵
   D02 = ۱۰٪ × ۱۴٬۷۲۵ = ۱٬۴۷۲٫۵ → مانده ۱۳٬۲۵۲٫۵
   D03 = ۵۰۰ ثابت روی ردیف R01 → مانده ۱۲٬۷۵۲٫۵
*/
const EXPECT = { gross: 15_500, d1: 775, d2: 1472.5, d3: 500, deductions: 2747.5, net: 12_752.5 };

test("مجوز و دامنهٔ پروژه: بدون کاربر ۴۰۱، خارج از نقش ۴۰۳، نقش‌بندی میز کار درست است", async () => {
  assert.equal((await call("GET", "/workspace")).status, 401);
  assert.equal((await call("GET", "/workspace", { user: "u-left" })).status, 401);
  assert.equal((await call("GET", "/workspace", { user: "u-admin" })).status, 403);
  assert.equal((await call("GET", "/workspace", { user: "u-auditor" })).status, 403);
  assert.equal((await call("GET", "/workspace", { user: "u-cost", project: OTHER })).status, 403);

  const cost = await ws("u-cost");
  assert.deepEqual(cost.can, { templateEdit: true, certificateRecord: true, certificateApprove: false });
  const pm = await ws("u-pm");
  assert.equal(pm.can.certificateApprove, true);
  assert.equal(pm.can.templateEdit, false);
  assert.equal(cost.modelVersion, "cnt-ipc-v1");
  assert.equal(cost.metrics.templates.total, 0);
});

test("CRUD عمومی روی جدول‌های CNT IPC بسته است — فقط مسیر اختصاصی", async () => {
  for (const table of ["CntIpcTemplate", "CntIpcCertificate"]) {
    for (const user of ["u-admin", "u-cost"]) {
      const r = await fetch(`${BASE}/api/data/${table}`, { headers: { "x-user-id": user } });
      assert.equal(r.status, 403, `${table} برای ${user}`);
      assert.equal((await r.json()).error.code, "TABLE_HAS_DEDICATED_API", table);
    }
  }
});

test("CNT-1: قالب با قواعد ردیف و کسر اعتبارسنجی می‌شود", async () => {
  const noItems = await call("POST", "/templates", { user: "u-cost", body: templateBody({ Items: [] }) });
  assert.equal(noItems.status, 400);
  assert.equal(err(noItems), "E-CNT-IPC-VALIDATION");

  const badContract = await call("POST", "/templates", { user: "u-cost", body: templateBody({ ContractCode: code("NOCON") }) });
  assert.equal(badContract.status, 400, JSON.stringify(badContract.body));
  assert.equal(err(badContract), "E-CNT-IPC-CONTRACT");

  const unknownItemRef = await call("POST", "/templates", { user: "u-cost", body: templateBody({ Items: [{ Code: "R01", TitleFa: "الف", Basis: "percent", PercentOf: "R99" }] }) });
  assert.equal(unknownItemRef.status, 400);
  assert.equal(err(unknownItemRef), "E-CNT-IPC-VALIDATION");

  // ردیف درصدی روی ردیف درصدی دیگر ممنوع است (حلقه/وابستگی دوگانه).
  const chain = await call("POST", "/templates", { user: "u-cost", body: templateBody({ Items: [
    { Code: "A1", TitleFa: "الف", Basis: "percent", PercentOf: "B1" },
    { Code: "B1", TitleFa: "ب", Basis: "percent", PercentOf: "A1" },
  ] }) });
  assert.equal(chain.status, 400);
  assert.equal(err(chain), "E-CNT-IPC-VALIDATION");

  const badDeduction = await call("POST", "/templates", { user: "u-cost", body: templateBody({ Deductions: [{ Code: "D01", TitleFa: "کسر", Kind: "other", Mode: "percent", Rate: 200, Base: "gross" }] }) });
  assert.equal(badDeduction.status, 400);
  assert.equal(err(badDeduction), "E-CNT-IPC-VALIDATION");

  /* وضعیت را کلاینت تعیین نمی‌کند؛ فیلد بیرونی باید رد شود. */
  const foreign = await call("POST", "/templates", { user: "u-cost", body: { ...templateBody(), Status: "published" } });
  assert.equal(foreign.status, 400);
  assert.equal(err(foreign), "E-CNT-IPC-VALIDATION");

  const created = await call("POST", "/templates", { user: "u-cost", body: templateBody() });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.Status, "draft");
  assert.equal(created.body.data.Version, 0);
  assert.equal(created.body.data.Items.length, 4);
  assert.equal(created.body.data.Deductions.length, 3);

  const dup = await call("POST", "/templates", { user: "u-cost", body: templateBody() });
  assert.equal(dup.status, 409);
  assert.equal(err(dup), "E-CNT-IPC-DUPLICATE");
});

test("CNT-1: قالب پیش‌نویس ویرایش و منتشر می‌شود و پس از انتشار قفل است", async () => {
  const draft2 = await call("POST", "/templates", { user: "u-cost", body: templateBody({ Code: TPL2, TitleFa: "قالب دوم" }) });
  assert.equal(draft2.status, 201);
  const patched = await call("PATCH", `/templates/${TPL2}`, { user: "u-cost", body: { RowVersion: draft2.body.data.RowVersion, TitleFa: "قالب دوم اصلاح‌شده" } });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.TitleFa, "قالب دوم اصلاح‌شده");

  const published = await call("POST", `/templates/${TPL}/transition`, { user: "u-cost", body: { action: "publish" } });
  assert.equal(published.status, 200);
  assert.equal(published.body.data.Status, "published");
  assert.equal(published.body.data.Version, 1);

  const locked = await call("PATCH", `/templates/${TPL}`, { user: "u-cost", body: { RowVersion: published.body.data.RowVersion, TitleFa: "تغییر" } });
  assert.equal(locked.status, 409);
  assert.equal(err(locked), "E-CNT-IPC-LOCKED");

  const republish = await call("POST", `/templates/${TPL}/transition`, { user: "u-cost", body: { action: "publish" } });
  assert.equal(republish.status, 400);
  assert.equal(err(republish), "E-CNT-IPC-VALIDATION");
});

test("CNT-1: محاسبهٔ سرور با محاسبهٔ دستی مستقل می‌خواند (ناخالص، کسورات، خالص)", async () => {
  const preview = await call("POST", "/preview", { user: "u-cost", body: { TemplateCode: TPL, Inputs: inputsBody } });
  assert.equal(preview.status, 200);
  const c = preview.body.data.computation;
  assert.equal(c.grossAmount, EXPECT.gross);
  assert.equal(c.deductionTotal, EXPECT.deductions);
  assert.equal(c.netAmount, EXPECT.net);
  const byCode = Object.fromEntries(c.deductions.map((d) => [d.Code, d]));
  assert.equal(byCode.D01.Amount, EXPECT.d1);
  assert.equal(byCode.D02.Amount, EXPECT.d2);
  assert.equal(byCode.D03.Amount, EXPECT.d3);
  // پایهٔ «ماندهٔ جاری» باید بعد از کسر اول محاسبه شده باشد، نه از ناخالص.
  assert.equal(byCode.D02.BaseAmount, EXPECT.gross - EXPECT.d1);
  assert.equal(byCode.D03.BaseAmount, 10_000);
  // ردیف منفی هم باید در ناخالص اثر بگذارد.
  assert.equal(c.rows.find((r) => r.Code === "R04").Amount, -500);
  assert.equal(preview.body.data.template.Version, 1);
});

test("CNT-1: صورت‌وضعیت فقط با قالب منتشرشده و ورودی معنادار ثبت می‌شود", async () => {
  const draftTemplate = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL2, PeriodNo: 1, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Inputs: inputsBody } });
  assert.equal(draftTemplate.status, 409, JSON.stringify(draftTemplate.body));
  assert.equal(err(draftTemplate), "E-CNT-IPC-TEMPLATE");

  const badPeriod = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 61, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Inputs: inputsBody } });
  assert.equal(badPeriod.status, 400);
  assert.equal(err(badPeriod), "E-CNT-IPC-VALIDATION");

  const badRange = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-30", PeriodTo: "2026-09-01", Inputs: inputsBody } });
  assert.equal(badRange.status, 400);
  assert.equal(err(badRange), "E-CNT-IPC-VALIDATION");

  const badCurrency = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Currency: "GBP", Inputs: inputsBody } });
  assert.equal(badCurrency.status, 400);
  assert.equal(err(badCurrency), "E-CNT-IPC-VALIDATION");

  const noRows = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Inputs: [] } });
  assert.equal(noRows.status, 400);
  assert.equal(err(noRows), "E-CNT-IPC-VALIDATION");

  // کسورات بیش از کارکرد: خالص منفی باید رد شود.
  const negative = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Inputs: [{ ItemCode: "R01", Quantity: 1, UnitRate: 1 }] } });
  assert.equal(negative.status, 400);
  assert.equal(err(negative), "E-CNT-IPC-VALIDATION");

  const created = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Currency: "IRR", Inputs: inputsBody } });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.Status, "draft");
  assert.equal(created.body.data.GrossAmount, EXPECT.gross);
  assert.equal(created.body.data.DeductionTotal, EXPECT.deductions);
  assert.equal(created.body.data.NetAmount, EXPECT.net);
  assert.equal(created.body.data.ContractCode, CONTRACT);

  const dup = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Inputs: inputsBody } });
  assert.equal(dup.status, 409);
  assert.equal(err(dup), "E-CNT-IPC-DUPLICATE");

  return created.body.data.Id;
});

test("CNT-1: گردش صورت‌وضعیت — SOD-11، مهر تأیید و رد سند کهنه", async () => {
  const created = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 2, PeriodFrom: "2026-10-01", PeriodTo: "2026-10-31", Currency: "IRR", Inputs: inputsBody } });
  assert.equal(created.status, 201);
  const id = created.body.data.Id;

  const submitted = await call("POST", `/certificates/${id}/transition`, { user: "u-cost", body: { action: "submit" } });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.data.Status, "submitted");
  assert.equal(submitted.body.data.SubmittedBy, "u-cost");

  // SOD-11: تهیه‌کننده با مجوز تصویب هم نباید سند خودش را تصویب کند.
  const selfApprove = await call("POST", `/certificates/${id}/transition`, { user: "u-cost", body: { action: "approve" } });
  assert.equal(selfApprove.status, 403);

  /* کهنگی: مبلغ ذخیره‌شده دست‌کاری می‌شود؛ تصویب باید E-CNT-IPC-STALE بدهد
     تا سند با محاسبهٔ سرور نخواند. سرور داده را در حافظه نگه می‌دارد، پس
     دست‌کاریِ روی دیسک با راه‌اندازی دوباره دیده می‌شود. */
  const r = repo();
  const row = await r.get("CntIpcCertificate", id);
  await r.patch("CntIpcCertificate", id, { NetAmount: 1 }, "u-pmo", row.RowVersion);
  await restart();
  const stale = await call("POST", `/certificates/${id}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.equal(err(stale), "E-CNT-IPC-STALE");

  /* نسخهٔ قالبِ ثبت‌شده هم مرجع کهنگی است: اگر با نسخهٔ جاری قالب نخواند،
     سند قدیمی است حتی اگر مبالغ دست‌کاری نشده باشد. */
  const back = repo();
  const row2 = await back.get("CntIpcCertificate", id);
  await back.patch("CntIpcCertificate", id, { NetAmount: EXPECT.net, TemplateVersion: 0 }, "u-pmo", row2.RowVersion);
  await restart();
  const staleVersion = await call("POST", `/certificates/${id}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(staleVersion.status, 409, JSON.stringify(staleVersion.body));
  assert.equal(err(staleVersion), "E-CNT-IPC-STALE");

  const fixed = repo();
  const row3 = await fixed.get("CntIpcCertificate", id);
  await fixed.patch("CntIpcCertificate", id, { TemplateVersion: 1 }, "u-pmo", row3.RowVersion);
  await restart();
  const approved = await call("POST", `/certificates/${id}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.Status, "approved");
  assert.equal(approved.body.data.ApprovedBy, "u-pm");
  assert.ok(String(approved.body.data.SignedNoteFa ?? "").length > 0, "یادداشت امضاشدهٔ تأیید خالی است");

  // سند مصوب دیگر برنمی‌گردد (برگشت فقط روی سند ارسال‌شده معنا دارد).
  const locked = await call("POST", `/certificates/${id}/transition`, { user: "u-pm", body: { action: "return", note: "دیر شد" } });
  assert.equal(locked.status, 400, JSON.stringify(locked.body));
  assert.equal(err(locked), "E-CNT-IPC-VALIDATION");
});

test("متریک‌های میز کار، مانایی پس از راه‌اندازی دوباره و audit", async () => {
  const before = (await ws("u-pm")).metrics;
  assert.equal(before.templates.published, 1);
  assert.equal(before.templates.retired, 0);
  assert.equal(before.certificates.approved, 1);
  assert.equal(before.certificates.latestPeriod, 2);
  assert.equal(before.certificates.approvedNet, EXPECT.net);

  await restart();

  /* generatedAt هر پاسخ تازه است؛ مقایسه باید فقط اعداد را بسنجد. */
  const { generatedAt: _before, ...beforeStable } = before;
  const { generatedAt: _after, ...afterStable } = (await ws("u-pm")).metrics;
  assert.deepEqual(afterStable, beforeStable);
  const certificates = (await ws("u-pm")).certificates;
  assert.equal(certificates.filter((c) => c.Status === "approved").length, 1);
  assert.equal(certificates.find((c) => c.PeriodNo === 2).NetAmount, EXPECT.net);

  const r = repo();
  const audits = await r.list("AuditLog");
  const actions = new Set(audits.filter((row) => row.ProjectCode === PID).map((row) => row.Action));
  for (const action of ["CNT_IPC_TEMPLATE_CREATE", "CNT_IPC_TEMPLATE_PUBLISH", "CNT_IPC_CERT_CREATE", "CNT_IPC_CERT_APPROVE"]) {
    assert.ok(actions.has(action), `اقدام ممیزی ${action} ثبت نشده است`);
  }
});
