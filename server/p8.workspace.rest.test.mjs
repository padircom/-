/**
 * P8 — دفتر مدیریت پروژه (PMO-1/2/3) و قالب‌پذیری صورت‌وضعیت (CNT-1) و
 * ویرایش ساختار فرایند (GOV-1) روی سرور واقعی (درایور JSON).
 *
 * سؤال محوری: منشور/فرم/کارت سلامت و قالب صورت‌وضعیت واقعاً ذخیره و بازیابی
 * می‌شوند؟ گردش تأیید، تفکیک وظیفه (SOD-30 منشور، SOD-11 صورت‌وضعیت)،
 * جایگزینی منشور مصوب، محاسبهٔ سرورِ صورت‌وضعیت و قواعد GOV-1 سمت سرور
 * اعمال می‌شوند؟ و CRUD عمومی روی جدول‌های تازه بسته است؟
 *
 * اجرا با پوشهٔ داده و فضای فایل جداگانه؛ به rundata کاربر دست نمی‌زند.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRepository, JsonFileDriver } from "./persistence/driver.mjs";

const PORT = 4746;
const BASE = `http://127.0.0.1:${PORT}`;
const PID = "c1-p1";
const OTHER = "c1-p2";
const TAG = `P8${Date.now().toString(36).toUpperCase()}`;
const code = (n) => `${TAG}-${n}`;
const CONTRACT = code("CON");
const CH = code("CH");
const CH2 = code("CH2");
const FRM = code("FRM");
const FRM2 = code("FRM2");

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
  throw new Error("سرور آزمون P8 بالا نیامد");
}
async function stopServer() {
  if (!child) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await exited;
  child = null;
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "p8ws-data-"));
  storageDir = await mkdtemp(path.join(tmpdir(), "p8ws-files-"));
  /* پیمان مبنا برای قالب صورت‌وضعیت از مسیر داده ساخته می‌شود؛ منابع آزمون
     باید از خود سامانه بیایند، نه از ردیف جعلی. */
  const r = repo();
  await r.create("ContractMaster", {
    ProjectId: PID, Code: CONTRACT, TitleFa: "پیمان آزمون P8", ContractType: "lump_sum", Party: "client",
    EmployerName: "کارفرما", ContractorName: "پیمانکار آزمون", SignDate: "2026-01-01", StartDate: "2026-01-01",
    DurationDays: 365, InitialAmount: 5_000_000, CurrentAmount: 5_000_000, Currency: "IRR",
    CeilingPct: 10, RetainagePct: 5, AdjustmentEnabled: false, Status: "active",
  }, "u-contracts", "cnt");
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

/* ── فراخوانی‌ها ── */
async function pmoCall(method, p, { user, body, project = PID } = {}) {
  const res = await fetch(`${BASE}/api/pmo/${project}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function cntCall(method, p, { user, body, project = PID } = {}) {
  const res = await fetch(`${BASE}/api/cnt-ipc/${project}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const pmoWs = async (user = "u-pmo", project = PID) => (await pmoCall("GET", "/workspace", { user, project })).body.data;
const cntWs = async (user = "u-cost", project = PID) => (await cntCall("GET", "/workspace", { user, project })).body.data;
const err = (r) => r.body?.error?.code;

const charterBody = (over = {}) => ({
  CharterNo: CH, TitleFa: "منشور پروژه آزمون", SponsorFa: "کارفرمای اصلی", ManagerFa: "مدیر پروژه",
  ObjectivesFa: ["تکمیل فاز ۱", "تثبیت برنامه پایه"], ScopeInFa: "ساخت و نصب",
  Milestones: [{ TitleFa: "شروع", TargetDate: "2026-10-01", DeliverableFa: "صورت‌جلسه" }],
  BudgetAmount: 2_000_000, Currency: "IRR",
  Risks: [{ TitleFa: "تأخیر تأمین", Severity: "high", MitigationFa: "خرید پیش‌دستانه" }],
  ...over,
});
const formBody = (over = {}) => ({
  Code: FRM, TitleFa: "چک‌لیست بازرسی", PurposeFa: "ثبت نتیجه بازرسی میدانی",
  Fields: [
    { Key: "AREA", LabelFa: "محدوده", Type: "text", Required: true, MaxLen: 60 },
    { Key: "RESULT", LabelFa: "نتیجه", Type: "select", Required: true, Options: ["ok", "nok"] },
    { Key: "COUNT", LabelFa: "تعداد", Type: "number", Min: 0, Max: 100 },
  ],
  ...over,
});
const criteria = (score = 90, over = {}) => ([
  { Code: "schedule", Weight: 25, Score: score, EvidenceFa: "EVM" },
  { Code: "cost", Weight: 25, Score: score - 5, EvidenceFa: "CPI" },
  { Code: "quality", Weight: 15, Score: score, EvidenceFa: "FPY" },
  { Code: "safety", Weight: 15, Score: score + 2, EvidenceFa: "HSE" },
  { Code: "risk", Weight: 10, Score: score - 10, EvidenceFa: "RCC" },
  { Code: "stakeholder", Weight: 10, Score: score, EvidenceFa: "CKM" },
].map((c) => ({ ...c, ...over })));
const templateBody = (over = {}) => ({
  Code: code("TPL"), TitleFa: "قالب صورت‌وضعیت", ContractCode: CONTRACT,
  Items: [
    { Code: "R01", TitleFa: "ردیف اندازه‌گیری", Unit: "m3", Basis: "measured", Sign: "+" },
    { Code: "R02", TitleFa: "ردیف مقطوع", Unit: "ls", Basis: "lump", Sign: "+" },
    { Code: "R03", TitleFa: "سهم تجهیزات", Unit: "%", Basis: "percent", PercentOf: "R02", Sign: "+" },
  ],
  Deductions: [
    { Code: "D01", TitleFa: "حسن انجام کار", Kind: "retention", Mode: "percent", Rate: 5, Base: "gross" },
    { Code: "D02", TitleFa: "بازیافت پیش‌پرداخت", Kind: "advance", Mode: "percent", Rate: 10, Base: "running" },
  ],
  ...over,
});
const inputs = [
  { ItemCode: "R01", Quantity: 10, UnitRate: 1000 },
  { ItemCode: "R02", Amount: 5000 },
  { ItemCode: "R03", Percent: 20 },
];

/* ══════════════ PMO-1 منشور پروژه ══════════════ */

test("PMO: میز کار فقط با مجوز خوانده می‌شود و نقش‌بندی مجوزها درست است", async () => {
  assert.equal((await pmoCall("GET", "/workspace")).status, 401);
  assert.equal((await pmoCall("GET", "/workspace", { user: "u-left" })).status, 401);
  assert.equal((await pmoCall("GET", "/workspace", { user: "u-admin" })).status, 403);
  assert.equal((await pmoCall("GET", "/workspace", { user: "u-auditor" })).status, 403);
  // u-cost فقط c1-p1 را دارد؛ پروژهٔ دیگر ۴۰۳ است.
  assert.equal((await pmoCall("GET", "/workspace", { user: "u-cost", project: OTHER })).status, 403);

  const pmo = await pmoWs("u-pmo");
  assert.deepEqual(pmo.can, { charterEdit: true, charterApprove: false, formManage: true, formSubmit: true, formApprove: false, healthRecord: true, healthApprove: false });
  const pm = await pmoWs("u-pm");
  assert.equal(pm.can.charterEdit, true);
  assert.equal(pm.can.formApprove, true);
  assert.equal(pm.can.healthApprove, false);
  assert.deepEqual(pm.charters, []);
  const ceo = await pmoWs("u-ceo");
  assert.equal(ceo.can.charterApprove, true);
  assert.equal(ceo.can.healthApprove, true);
  // معیارهای کارت سلامت از سرور می‌آید و وزن‌ها جمعاً ۱۰۰ است.
  assert.equal(pmo.criteriaModel.reduce((s, c) => s + c.Weight, 0), 100);
  assert.equal(pmo.modelVersion, "pmo-gov-v1");
});

test("PMO: CRUD عمومی روی جدول‌های دفتر پروژه بسته است", async () => {
  for (const table of ["PmoCharter", "PmoFormDefinition", "PmoFormEntry", "PmoHealthAssessment"]) {
    for (const user of ["u-admin", "u-pmo"]) {
      const r = await fetch(`${BASE}/api/data/${table}`, { headers: { "x-user-id": user } });
      assert.equal(r.status, 403, `${table} برای ${user}`);
      assert.equal((await r.json()).error.code, "TABLE_HAS_DEDICATED_API", table);
    }
  }
});

test("PMO-1: منشور با هدف الزامی ثبت می‌شود و منشور بی‌هدف رد می‌شود", async () => {
  const empty = await pmoCall("POST", "/charters", { user: "u-pmo", body: charterBody({ CharterNo: code("CH-E"), ObjectivesFa: ["  "] }) });
  assert.equal(empty.status, 400);
  assert.equal(err(empty), "E-PMO-VALIDATION");

  const created = await pmoCall("POST", "/charters", { user: "u-pmo", body: charterBody() });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.Status, "draft");
  assert.equal(created.body.data.ObjectivesJson.length, 2);
  assert.equal(created.body.data.MilestonesJson[0].TitleFa, "شروع");

  const dup = await pmoCall("POST", "/charters", { user: "u-pmo", body: charterBody() });
  assert.equal(dup.status, 409);
  assert.equal(err(dup), "E-PMO-DUPLICATE");

  // فیلد بیرونی نباید دور بزند.
  const foreign = await pmoCall("POST", "/charters", { user: "u-pmo", body: charterBody({ CharterNo: code("CH-F"), Status: "approved" }) });
  assert.equal(foreign.status, 400);
  assert.equal(err(foreign), "E-PMO-VALIDATION");

  // نقش بی‌مجوز نمی‌تواند منشور بسازد.
  assert.equal((await pmoCall("POST", "/charters", { user: "u-qc", body: charterBody({ CharterNo: code("CH-Q") }) })).status, 403);
});

test("PMO-1: گردش منشور — ارسال، قفل ویرایش، SOD-30، برگشت و تصویب، و جایگزینی منشور مصوب", async () => {
  const submitted = await pmoCall("POST", `/charters/${CH}/transition`, { user: "u-pmo", body: { action: "submit" } });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.data.Status, "submitted");

  // ویرایش منشور ارسال‌شده باید قفل باشد (نسخهٔ تازه هم نجات نمی‌دهد).
  const locked = await pmoCall("PATCH", `/charters/${CH}`, { user: "u-pmo", body: { RowVersion: submitted.body.data.RowVersion, TitleFa: "تغییر" } });
  assert.equal(locked.status, 409);
  assert.equal(err(locked), "E-PMO-LOCKED");

  // SOD-30: تحریرکننده نمی‌تواند منشور خودش را تصویب یا برگشت کند.
  const selfApprove = await pmoCall("POST", `/charters/${CH}/transition`, { user: "u-pmo", body: { action: "approve" } });
  assert.equal(selfApprove.status, 403);
  const selfReturn = await pmoCall("POST", `/charters/${CH}/transition`, { user: "u-pmo", body: { action: "return", note: "خودم" } });
  assert.equal(selfReturn.status, 403);

  const returned = await pmoCall("POST", `/charters/${CH}/transition`, { user: "u-ceo", body: { action: "return", note: "هدف دوم را عددی کنید" } });
  assert.equal(returned.status, 200);
  assert.equal(returned.body.data.Status, "returned");
  assert.equal(returned.body.data.ReturnNoteFa, "هدف دوم را عددی کنید");

  // پس از برگشت، ویرایش با نسخهٔ کهنه رد و با نسخهٔ جاری پذیرفته می‌شود.
  const staleWrite = await pmoCall("PATCH", `/charters/${CH}`, { user: "u-pmo", body: { RowVersion: submitted.body.data.RowVersion, TitleFa: "کهنه" } });
  assert.equal(staleWrite.status, 409);
  assert.equal(err(staleWrite), "E-PMO-VERSION");
  const fixed = await pmoCall("PATCH", `/charters/${CH}`, { user: "u-pmo", body: { RowVersion: returned.body.data.RowVersion, ScopeInFa: "ساخت، نصب و راه‌اندازی" } });
  assert.equal(fixed.status, 200);
  assert.equal(fixed.body.data.ScopeInFa, "ساخت، نصب و راه‌اندازی");

  assert.equal((await pmoCall("POST", `/charters/${CH}/transition`, { user: "u-pmo", body: { action: "submit" } })).status, 200);
  const approved = await pmoCall("POST", `/charters/${CH}/transition`, { user: "u-ceo", body: { action: "approve" } });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.Status, "approved");
  assert.equal(approved.body.data.ApprovedBy, "u-ceo");

  // منشور دوم: تصویب آن باید اولی را جایگزین کند تا همیشه یک منشور مصوب بماند.
  const second = await pmoCall("POST", "/charters", { user: "u-pmo", body: charterBody({ CharterNo: CH2, TitleFa: "منشور بازنگری‌شده" }) });
  assert.equal(second.status, 201);
  assert.equal((await pmoCall("POST", `/charters/${CH2}/transition`, { user: "u-pmo", body: { action: "submit" } })).status, 200);
  assert.equal((await pmoCall("POST", `/charters/${CH2}/transition`, { user: "u-ceo", body: { action: "approve" } })).status, 200);

  const list = (await pmoWs("u-pmo")).charters;
  assert.equal(list.filter((c) => c.Status === "approved").length, 1, "باید فقط یک منشور مصوب بماند");
  assert.equal(list.find((c) => c.CharterNo === CH2).Status, "approved");
  assert.equal(list.find((c) => c.CharterNo === CH).Status, "superseded");
  assert.equal(list.find((c) => c.CharterNo === CH).SupersededByCharterNo, CH2);
  assert.ok((await pmoWs("u-pmo")).metrics.charters.hasApprovedCharter);
});

/* ══════════════ PMO-2 فرم‌ساز مصوب ══════════════ */

test("PMO-2: فرم منتشرشده نسخه می‌خورد، قفل می‌شود و رکورد طبق تعریف اعتبارسنجی می‌شود", async () => {
  const published_ = await pmoCall("POST", "/forms", { user: "u-pmo", body: formBody() });
  assert.equal(published_.status, 201);
  assert.equal(published_.body.data.Status, "draft");

  const publish = await pmoCall("POST", `/forms/${FRM}/transition`, { user: "u-pmo", body: { action: "publish" } });
  assert.equal(publish.status, 200);
  assert.equal(publish.body.data.Status, "published");

  // رکورد روی فرم پیش‌نویس ممنوع است.
  const draftForm = await pmoCall("POST", "/forms", { user: "u-pmo", body: formBody({ Code: FRM2, TitleFa: "فرم دوم" }) });
  assert.equal(draftForm.status, 201);
  const onDraft = await pmoCall("POST", "/entries", { user: "u-qc", body: { FormCode: FRM2, SubjectFa: "زودتر از انتشار", Data: { AREA: "A", RESULT: "ok" } } });
  assert.equal(onDraft.status, 400);
  assert.equal(err(onDraft), "E-PMO-NO-FORM");

  // فیلد ناشناس، گزینهٔ نامعتبر و عدد خارج از بازه باید رد شوند.
  const cases = [
    { Data: { AREA: "A", RESULT: "ok", EXTRA: "x" }, label: "فیلد اضافه" },
    { Data: { AREA: "A", RESULT: "maybe" }, label: "گزینهٔ نامعتبر" },
    { Data: { AREA: "A", RESULT: "ok", COUNT: 500 }, label: "عدد خارج از بازه" },
    { Data: { AREA: "" }, label: "فیلد الزامی خالی" },
  ];
  for (const c of cases) {
    const r = await pmoCall("POST", "/entries", { user: "u-qc", body: { FormCode: FRM, SubjectFa: "نامعتبر", Data: c.Data } });
    assert.equal(r.status, 400, c.label);
    assert.equal(err(r), "E-PMO-VALIDATION", c.label);
  }

  const entry = await pmoCall("POST", "/entries", { user: "u-qc", body: { FormCode: FRM, SubjectFa: "بازرسی خط ۱۴", Data: { AREA: "خط ۱۴", RESULT: "nok", COUNT: "3" } } });
  assert.equal(entry.status, 201);
  assert.equal(entry.body.data.Status, "draft");
  assert.equal(entry.body.data.FormVersion, publish.body.data.Version);
  // عدد باید نوع‌دار ذخیره شود، نه رشته.
  assert.equal(entry.body.data.DataJson.COUNT, 3);

  // ویرایش فرم منتشرشده ممنوع است.
  const lockedForm = await pmoCall("PATCH", `/forms/${FRM}`, { user: "u-pmo", body: { RowVersion: publish.body.data.RowVersion, PurposeFa: "تغییر" } });
  assert.equal(lockedForm.status, 409);
  assert.equal(err(lockedForm), "E-PMO-LOCKED");
  // انتشار دوباره هم بی‌معناست.
  const republish = await pmoCall("POST", `/forms/${FRM}/transition`, { user: "u-pmo", body: { action: "publish" } });
  assert.equal(republish.status, 400);

  // گردش رکورد: تهیه‌کننده ≠ تأییدکننده، و تصویب رکورد تازه را قفل می‌کند.
  assert.equal((await pmoCall("POST", `/entries/${entry.body.data.Id}/transition`, { user: "u-qc", body: { action: "submit" } })).status, 200);
  assert.equal((await pmoCall("POST", `/entries/${entry.body.data.Id}/transition`, { user: "u-qc", body: { action: "approve" } })).status, 403);
  const approvedEntry = await pmoCall("POST", `/entries/${entry.body.data.Id}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(approvedEntry.status, 200);
  assert.equal(approvedEntry.body.data.Status, "approved");
  const editApproved = await pmoCall("PATCH", `/entries/${entry.body.data.Id}`, { user: "u-qc", body: { RowVersion: approvedEntry.body.data.RowVersion, SubjectFa: "تغییر" } });
  assert.equal(editApproved.status, 409);
  assert.equal(err(editApproved), "E-PMO-LOCKED");
});

test("PMO-2: فرم بازنشسته رکورد نمی‌پذیرد و نسخه‌های رکورد دست‌نخورده می‌مانند", async () => {
  const retired = await pmoCall("POST", `/forms/${FRM2}/transition`, { user: "u-pmo", body: { action: "publish" } });
  assert.equal(retired.status, 200);
  const version = retired.body.data.Version;
  const retire = await pmoCall("POST", `/forms/${FRM2}/transition`, { user: "u-pmo", body: { action: "retire" } });
  assert.equal(retire.status, 200);
  assert.equal(retire.body.data.Status, "retired");

  const onRetired = await pmoCall("POST", "/entries", { user: "u-qc", body: { FormCode: FRM2, SubjectFa: "روی بازنشسته", Data: { AREA: "A", RESULT: "ok" } } });
  assert.equal(onRetired.status, 400);
  assert.equal(err(onRetired), "E-PMO-NO-FORM");

  // رکورد فرم منتشرشدهٔ قبلی باید با نسخهٔ خودش سالم بماند.
  const entries = (await pmoWs("u-qc")).entries;
  const kept = entries.find((e) => e.FormCode === FRM);
  assert.ok(kept, "رکورد فرم منتشرشده گم شده است");
  assert.equal(kept.Status, "approved");
  assert.ok(version >= 1);
});

/* ══════════════ PMO-3 کارت سلامت پروژه ══════════════ */

test("PMO-3: وزن معیارها باید ۱۰۰ باشد، امتیاز وزنی سرور محاسبه می‌شود و نوار درست در می‌آید", async () => {
  const shortSum = await pmoCall("POST", "/assessments", { user: "u-pm", body: { AsOfDate: "2026-09-21", Criteria: criteria().map((c, i) => (i === 0 ? { ...c, Weight: 20 } : c)) } });
  assert.equal(shortSum.status, 400);
  assert.equal(err(shortSum), "E-PMO-VALIDATION");
  // معیار ناشناس باید رد شود.
  const unknown = await pmoCall("POST", "/assessments", { user: "u-pm", body: { AsOfDate: "2026-09-21", Criteria: criteria().map((c, i) => (i === 0 ? { ...c, Code: "weather" } : c)) } });
  assert.equal(unknown.status, 400);
  assert.equal(err(unknown), "E-PMO-VALIDATION");
  // تاریخ نامعتبر باید رد شود.
  const badDate = await pmoCall("POST", "/assessments", { user: "u-pm", body: { AsOfDate: "21/09/2026", Criteria: criteria() } });
  assert.equal(badDate.status, 400);
  assert.equal(err(badDate), "E-PMO-VALIDATION");

  const green = await pmoCall("POST", "/assessments", { user: "u-pm", body: { AsOfDate: "2026-09-20", Criteria: criteria(90) } });
  assert.equal(green.status, 201);
  /* امتیاز = 25×90 + 25×85 + 15×90 + 15×92 + 10×80 + 10×90 = 8805/100 = 88.05 */
  assert.equal(green.body.data.ScoreTotal, 88.05);
  assert.equal(green.body.data.Band, "green");
  assert.equal(green.body.data.Status, "draft");

  const amber = await pmoCall("POST", "/assessments", { user: "u-pm", body: { AsOfDate: "2026-09-19", Criteria: criteria(75) } });
  assert.equal(amber.status, 201);
  assert.equal(amber.body.data.Band, "amber");

  const red = await pmoCall("POST", "/assessments", { user: "u-pm", body: { AsOfDate: "2026-09-18", Criteria: criteria(50) } });
  assert.equal(red.status, 201);
  assert.equal(red.body.data.Band, "red");

  // گردش: فقط ثبت‌کننده ارسال می‌کند، تصویب با نقش دیگر.
  assert.equal((await pmoCall("POST", `/assessments/${green.body.data.Id}/transition`, { user: "u-pm", body: { action: "submit" } })).status, 200);
  const approve = await pmoCall("POST", `/assessments/${green.body.data.Id}/transition`, { user: "u-ceo", body: { action: "approve" } });
  assert.equal(approve.status, 200);
  assert.equal(approve.body.data.Status, "approved");

  const metrics = (await pmoWs("u-pm")).metrics;
  assert.equal(metrics.health.score, 88.05);
  assert.equal(metrics.health.band, "green");
  assert.equal(metrics.forms.published, 1);
  assert.equal(metrics.forms.retired, 1);
  assert.equal(metrics.entries.approved, 1);
});

/* ══════════════ CNT-1 قالب‌پذیری صورت‌وضعیت ══════════════ */

const TPL = code("TPL");

test("CNT-1: قالب با فرمول ردیف‌ها و کسورات ثبت، منتشر و پس از انتشار قفل می‌شود", async () => {
  assert.equal((await cntCall("GET", "/workspace")).status, 401);
  assert.equal((await cntCall("GET", "/workspace", { user: "u-admin" })).status, 403);
  assert.equal((await cntCall("GET", "/workspace", { user: "u-cost", project: OTHER })).status, 403);

  const cost = await cntWs("u-cost");
  assert.deepEqual(cost.can, { templateEdit: true, certificateRecord: true, certificateApprove: false });
  const pm = await cntWs("u-pm");
  assert.equal(pm.can.certificateApprove, true);
  assert.equal(pm.can.templateEdit, false);

  // پیمان ناموجود و ردیف درصدی روی ردیف ناموجود باید رد شوند.
  const noContract = await cntCall("POST", "/templates", { user: "u-cost", body: templateBody({ Code: code("TPL-X"), ContractCode: code("NOCON") }) });
  assert.equal(noContract.status, 400);
  assert.equal(err(noContract), "E-CNT-IPC-CONTRACT");
  const badPercent = await cntCall("POST", "/templates", { user: "u-cost", body: templateBody({ Code: code("TPL-Y"), Items: [{ Code: "A", TitleFa: "الف", Basis: "percent", PercentOf: "Z" }] }) });
  assert.equal(badPercent.status, 400);
  assert.equal(err(badPercent), "E-CNT-IPC-VALIDATION");
  // ردیف بدون کد/عنوان هم پذیرفته نمی‌شود.
  const noItems = await cntCall("POST", "/templates", { user: "u-cost", body: templateBody({ Code: code("TPL-Z"), Items: [] }) });
  assert.equal(noItems.status, 400);

  const created = await cntCall("POST", "/templates", { user: "u-cost", body: templateBody({ Code: TPL }) });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.Status, "draft");
  assert.equal(created.body.data.Items.length, 3);

  const publish = await cntCall("POST", `/templates/${TPL}/transition`, { user: "u-cost", body: { action: "publish" } });
  assert.equal(publish.status, 200);
  assert.equal(publish.body.data.Status, "published");
  assert.equal(publish.body.data.Version, 1);

  const locked = await cntCall("PATCH", `/templates/${TPL}`, { user: "u-cost", body: { RowVersion: publish.body.data.RowVersion, TitleFa: "تغییر" } });
  assert.equal(locked.status, 409);
  assert.equal(err(locked), "E-CNT-IPC-LOCKED");

  // نقش بی‌مجوز نمی‌تواند قالب بسازد.
  assert.equal((await cntCall("POST", "/templates", { user: "u-qc", body: templateBody({ Code: code("TPL-Q") }) })).status, 403);
});

test("CNT-1: پیش‌نمایش و سند از محاسبهٔ سرور می‌آیند (ناخالص/کسورات/خالص) و دوره تکراری رد می‌شود", async () => {
  const preview = await cntCall("POST", "/preview", { user: "u-cost", body: { TemplateCode: TPL, Inputs: inputs } });
  assert.equal(preview.status, 200);
  /* ناخالص = 10×1000 + 5000 + 20٪×5000 = 16000
     D01 = 5٪×16000 = 800 → مانده 15200
     D02 = 10٪×15200 = 1520 → خالص 13680 */
  const c = preview.body.data.computation;
  assert.equal(c.grossAmount, 16000);
  assert.equal(c.deductionTotal, 2320);
  assert.equal(c.netAmount, 13680);
  assert.equal(c.deductions.find((d) => d.Code === "D01").Amount, 800);
  assert.equal(c.deductions.find((d) => d.Code === "D02").BaseAmount, 15200);
  assert.equal(preview.body.data.template.Version, 1);

  // دورهٔ نامعتبر و ورودی بی‌ردیف باید رد شوند.
  const badPeriod = await cntCall("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 0, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Inputs: inputs } });
  assert.equal(badPeriod.status, 400);
  assert.equal(err(badPeriod), "E-CNT-IPC-VALIDATION");
  const badRange = await cntCall("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-30", PeriodTo: "2026-09-01", Inputs: inputs } });
  assert.equal(badRange.status, 400);
  assert.equal(err(badRange), "E-CNT-IPC-VALIDATION");
  const noRows = await cntCall("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Inputs: [] } });
  assert.equal(noRows.status, 400);

  const cert = await cntCall("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Currency: "IRR", Inputs: inputs } });
  assert.equal(cert.status, 201);
  assert.equal(cert.body.data.Status, "draft");
  assert.equal(cert.body.data.GrossAmount, 16000);
  assert.equal(cert.body.data.NetAmount, 13680);
  assert.equal(cert.body.data.TemplateVersion, 1);

  const dup = await cntCall("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 1, PeriodFrom: "2026-09-01", PeriodTo: "2026-09-30", Inputs: inputs } });
  assert.equal(dup.status, 409);
  assert.equal(err(dup), "E-CNT-IPC-DUPLICATE");
});

test("CNT-1: صورت‌وضعیت با SOD-11 تصویب می‌شود و مهر تأیید می‌گیرد", async () => {
  const cert = await cntCall("POST", "/certificates", { user: "u-cost", body: { TemplateCode: TPL, PeriodNo: 2, PeriodFrom: "2026-10-01", PeriodTo: "2026-10-31", Currency: "IRR", Inputs: inputs } });
  assert.equal(cert.status, 201);
  const id = cert.body.data.Id;

  const submit = await cntCall("POST", `/certificates/${id}/transition`, { user: "u-cost", body: { action: "submit" } });
  assert.equal(submit.status, 200);
  assert.equal(submit.body.data.Status, "submitted");
  assert.equal(submit.body.data.SubmittedBy, "u-cost");

  // u-cost مجوز تصویب ندارد؛ و u-pm که دارد، تهیه‌کننده نیست.
  assert.equal((await cntCall("POST", `/certificates/${id}/transition`, { user: "u-cost", body: { action: "approve" } })).status, 403);

  /* کهنگی: مبلغ ذخیره‌شده از بیرون موتور دست‌کاری می‌شود؛ تصویب باید سند
     کهنه را رد کند. سرور ردیف را در حافظه دارد، پس دست‌کاری روی دیسک با
     راه‌اندازی دوباره سرور دیده می‌شود. */
  const r = repo();
  const row = await r.findOne("CntIpcCertificate", [{ column: "Id", op: "eq", value: id }]);
  await r.patch("CntIpcCertificate", id, { NetAmount: 1 }, "u-pm", row.RowVersion);
  await stopServer();
  await startServer();
  const stale = await cntCall("POST", `/certificates/${id}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(stale.status, 409);
  assert.equal(err(stale), "E-CNT-IPC-STALE");

  const fixed = repo();
  const row2 = await fixed.findOne("CntIpcCertificate", [{ column: "Id", op: "eq", value: id }]);
  await fixed.patch("CntIpcCertificate", id, { NetAmount: 13680 }, "u-pm", row2.RowVersion);
  await stopServer();
  await startServer();
  const approved = await cntCall("POST", `/certificates/${id}/transition`, { user: "u-pm", body: { action: "approve", note: "مطابق کارکرد تأییدشد" } });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.Status, "approved");
  assert.equal(approved.body.data.ApprovedBy, "u-pm");
  assert.equal(approved.body.data.SignedNoteFa, "مطابق کارکرد تأییدشد");

  // سند مصوب دیگر برنمی‌گردد.
  assert.equal((await cntCall("POST", `/certificates/${id}/transition`, { user: "u-pm", body: { action: "return", note: "برگشت" } })).status, 400);
  const metrics = (await cntWs("u-pm")).metrics;
  assert.equal(metrics.templates.published, 1);
  assert.equal(metrics.certificates.approved, 1);
  assert.equal(metrics.certificates.latestPeriod, 2);
  assert.equal(metrics.certificates.approvedNet, 13680);
});

/* ══════════════ GOV-1 ویرایش ساختار فرایند ══════════════ */

test("GOV-1: ساختار فرایند برای همهٔ حوزه‌ها با مجوز ویرایش می‌شود و بی‌مجوز قفل است", async () => {
  const readAnon = await fetch(`${BASE}/api/framework/process-tree?projectId=${PID}&domainId=d5`);
  assert.equal(readAnon.status, 401);

  /* نقش بی‌مجوز (مدیر سامانه در RBAC تصمیم‌گیر حاکمیت نیست): خواندن و
     نوشتن هر دو ۴۰۳. یادداشت: بعضی نقش‌ها فقط «مشاهده» دارند. */
  for (const user of ["u-auditor", "u-admin"]) {
    const readForbidden = await fetch(`${BASE}/api/framework/process-tree?projectId=${PID}&domainId=d5`, { headers: { "x-user-id": user } });
    assert.equal(readForbidden.status, user === "u-admin" ? 403 : 200, `${user} read`);
    const writeForbidden = await fetch(`${BASE}/api/framework/process-tree`, {
      method: "POST", headers: { "content-type": "application/json", "x-user-id": user },
      body: JSON.stringify({ projectId: PID, domainId: "d5", processes: [] }),
    });
    assert.equal(writeForbidden.status, 403, `${user} write`);
  }

  // دامنهٔ خارج از فهرست ویرایش‌پذیر (d13 خالی است).
  const badDomain = await fetch(`${BASE}/api/framework/process-tree?projectId=${PID}&domainId=d13`, { headers: { "x-user-id": "u-pmo" } });
  assert.equal(badDomain.status, 400);

  const tree = { DomainId: "d5", processes: [{ id: "d5-p99", title: { fa: "فرایند آزمون", en: "Test process" }, subs: [{ id: "d5-p99-s1", title: { fa: "زیرفرایند", en: "Sub" }, activity: { fa: "فعالیت", en: "Activity" }, source: "User", sql: [], output: "Out", connectsTo: "PMO", ai: "AI" }] }] };
  const write = await fetch(`${BASE}/api/framework/process-tree`, {
    method: "POST", headers: { "content-type": "application/json", "x-user-id": "u-pmo" },
    body: JSON.stringify({ projectId: PID, domainId: "d5", processes: tree.processes }),
  });
  assert.equal(write.status, 200, JSON.stringify(await write.json().catch(() => null)));

  /* d5 پیش از P8 ویرایش‌پذیر نبود، پس همین ذخیره خودش گواه GOV-1 است. */
  const read = await fetch(`${BASE}/api/framework/process-tree?projectId=${PID}&domainId=d5`, { headers: { "x-user-id": "u-pmo" } });
  assert.equal(read.status, 200);
  const payload = (await read.json()).data;
  assert.equal(payload.source, "database");
  assert.equal(payload.canEdit, true);
  assert.equal(payload.processes[0].id, "d5-p99");

  /* نقش دارندهٔ «مشاهده» می‌خواند ولی canEdit برایش false است؛ یعنی کلاینت
     دکمهٔ ویرایش را نشان نمی‌دهد و سرور هم اجازهٔ نوشتن نمی‌دهد. */
  const readViewer = await fetch(`${BASE}/api/framework/process-tree?projectId=${PID}&domainId=d5`, { headers: { "x-user-id": "u-auditor" } });
  assert.equal(readViewer.status, 200);
  const viewerPayload = (await readViewer.json()).data;
  assert.equal(viewerPayload.canEdit, false);
  assert.equal(viewerPayload.processes[0].id, "d5-p99");
  const writeViewer = await fetch(`${BASE}/api/framework/process-tree`, {
    method: "POST", headers: { "content-type": "application/json", "x-user-id": "u-auditor" },
    body: JSON.stringify({ projectId: PID, domainId: "d5", processes: tree.processes }),
  });
  assert.equal(writeViewer.status, 403);
});

test("داده پس از راه‌اندازی دوباره سرور باقی می‌ماند و رد حسابرسی کامل است", async () => {
  const before = (await pmoWs("u-pmo")).metrics;
  await stopServer();
  await startServer();
  const after = (await pmoWs("u-pmo")).metrics;
  assert.deepEqual(after.charters, before.charters);
  assert.deepEqual(after.forms, before.forms);
  assert.deepEqual(after.entries, before.entries);
  assert.deepEqual(after.health, before.health);

  const r = repo();
  const logs = await r.list("AuditLog");
  const pmoActions = new Set(logs.filter((row) => String(row.Action ?? "").startsWith("PMO_")).map((row) => row.Action));
  const cntActions = new Set(logs.filter((row) => String(row.Action ?? "").startsWith("CNT_IPC_")).map((row) => row.Action));
  for (const a of ["PMO_CHARTER_CREATE", "PMO_CHARTER_SUBMIT", "PMO_CHARTER_APPROVE", "PMO_CHARTER_SUPERSEDE", "PMO_FORM_PUBLISH", "PMO_ENTRY_APPROVE", "PMO_HEALTH_APPROVE"]) {
    assert.ok(pmoActions.has(a), `رد حسابرسی ${a} نیست`);
  }
  for (const a of ["CNT_IPC_TEMPLATE_CREATE", "CNT_IPC_TEMPLATE_PUBLISH", "CNT_IPC_CERT_CREATE", "CNT_IPC_CERT_APPROVE"]) {
    assert.ok(cntActions.has(a), `رد حسابرسی ${a} نیست`);
  }
});
