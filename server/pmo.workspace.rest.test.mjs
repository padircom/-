/**
 * P8 PMO — دفتر مدیریت پروژه (d6) روی سرور واقعی (درایور JSON).
 *
 * سؤال محوری: منشور پروژه، فرم‌ساز مصوب و کارت سلامت واقعاً ذخیره می‌شوند،
 * گردش تأیید سمت سرور کنترل می‌شود، تفکیک وظیفه (SOD-30) و «تصویب، منشور
 * قبلی را جایگزین می‌کند» کار می‌کنند، امتیاز سلامت از وزن‌های ثابت محاسبه
 * می‌شود و CRUD عمومی روی جدول‌های PMO بسته است؟
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

const PORT = 4746;
const BASE = `http://127.0.0.1:${PORT}`;
const PID = "c1-p1";
const OTHER = "c1-p2";
const TAG = `P8${Date.now().toString(36).toUpperCase()}`;
const code = (n) => `${TAG}-${n}`;
const CH = code("CH");
const CH2 = code("CH2");
const FRM = code("FRM");
const FRM2 = code("FRM2");
const FRM3 = code("FRM3");

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
  throw new Error("سرور آزمون PMO بالا نیامد");
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

let seededCharter = null;
let seededAssessment = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "pmows-data-"));
  storageDir = await mkdtemp(path.join(tmpdir(), "pmows-files-"));
  /* ردیف‌های خودنوشته: تفکیک وظیفه و قفل گردش باید از خود موتور بیاید، نه از
     نبود مجوز در نقش. */
  const r = repo();
  seededCharter = await r.create("PmoCharter", {
    ProjectId: PID, CharterNo: code("SEEDCH"), TitleFa: "منشور پایه", SponsorFa: "کارفرما", ManagerFa: null,
    ObjectivesJson: ["هدف پایه"], ScopeInFa: "دامنه", ScopeOutFa: null, MilestonesJson: [], RisksJson: [],
    BudgetAmount: 100, Currency: "IRR", Status: "submitted", SubmittedAt: "2026-09-20T06:00:00.000Z",
    SubmittedBy: "u-pmo", ApprovedAt: null, ApprovedBy: null, ReturnNoteFa: null, NoteFa: null, ModelVersion: "pmo-gov-v1",
  }, "u-pmo", "pmo");
  seededAssessment = await r.create("PmoHealthAssessment", {
    ProjectId: PID, AsOfDate: "2026-09-19", PeriodNo: null,
    CriteriaJson: [{ Code: "schedule", Weight: 25, Score: 90, EvidenceFa: "EVM" }, { Code: "cost", Weight: 25, Score: 80, EvidenceFa: "CPI" }, { Code: "quality", Weight: 15, Score: 70, EvidenceFa: "FPY" }, { Code: "safety", Weight: 15, Score: 95, EvidenceFa: "HSE" }, { Code: "risk", Weight: 10, Score: 60, EvidenceFa: "RCC" }, { Code: "stakeholder", Weight: 10, Score: 75, EvidenceFa: "CKM" }],
    ScoreTotal: 80, Band: "amber", Status: "submitted", SubmittedAt: "2026-09-19T06:00:00.000Z", SubmittedBy: "u-pm",
    ApprovedAt: null, ApprovedBy: null, ReturnNoteFa: null, NoteFa: null, ModelVersion: "pmo-gov-v1",
  }, "u-pm", "pmo");
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

async function call(method, p, { user, body, project = PID } = {}) {
  const res = await fetch(`${BASE}/api/pmo/${project}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const ws = async (user = "u-pm", project = PID) => (await call("GET", "/workspace", { user, project })).body.data;
const err = (r) => r.body?.error?.code;

const charterBody = (over = {}) => ({
  CharterNo: CH, TitleFa: "منشور پروژه نمونه", SponsorFa: "کارفرمای اصلی", ManagerFa: "مدیر پروژه",
  ObjectivesFa: ["راه‌اندازی واحد ۱۰۰", "تثبیت برنامه پایه"], ScopeInFa: "ساخت و نصب",
  Milestones: [{ TitleFa: "شروع", TargetDate: "2026-10-01", DeliverableFa: "صورت‌جلسه" }],
  BudgetAmount: 1_000_000, Currency: "IRR",
  Risks: [{ TitleFa: "تأخیر تأمین", Severity: "high", MitigationFa: "خرید زودتر" }],
  ...over,
});
const formBody = (over = {}) => ({
  Code: FRM, TitleFa: "چک‌لیست بازرسی", PurposeFa: "ثبت نتیجه بازرسی",
  Fields: [
    { Key: "AREA", LabelFa: "محدوده", Type: "text", Required: true, MaxLen: 60 },
    { Key: "RESULT", LabelFa: "نتیجه", Type: "select", Required: true, Options: ["ok", "nok"] },
    { Key: "COUNT", LabelFa: "تعداد", Type: "number", Min: 0, Max: 100 },
    { Key: "DONE", LabelFa: "پایان‌یافته", Type: "checkbox" },
  ],
  ...over,
});
const criteria = (over = {}) => ([
  { Code: "schedule", Weight: 25, Score: 90, EvidenceFa: "EVM SPI=1.02" },
  { Code: "cost", Weight: 25, Score: 88, EvidenceFa: "CPI=0.99" },
  { Code: "quality", Weight: 15, Score: 90, EvidenceFa: "FPY=97%" },
  { Code: "safety", Weight: 15, Score: 92, EvidenceFa: "LTIFR=0" },
  { Code: "risk", Weight: 10, Score: 80, EvidenceFa: "RCC open=3" },
  { Code: "stakeholder", Weight: 10, Score: 85, EvidenceFa: "CKM score" },
].map((c) => ({ ...c, ...over })));
const assessmentBody = (over = {}) => ({ AsOfDate: "2026-09-20", Criteria: criteria(), ...over });

test("مجوز و دامنهٔ پروژه: بدون کاربر ۴۰۱، خارج از نقش ۴۰۳، نقش‌بندی میز کار درست است", async () => {
  assert.equal((await call("GET", "/workspace")).status, 401);
  assert.equal((await call("GET", "/workspace", { user: "u-left" })).status, 401);
  assert.equal((await call("GET", "/workspace", { user: "u-admin" })).status, 403);
  assert.equal((await call("GET", "/workspace", { user: "u-auditor" })).status, 403);
  /* u-pm دو پروژه دارد (دامنه‌اش c1-p1 و c1-p2 است) پس برای مرز پروژه
     کاربر محدود استفاده می‌شود. */
  assert.equal((await call("GET", "/workspace", { user: "u-cost", project: OTHER })).status, 403);
  const pmo = await ws("u-pmo");
  assert.deepEqual(pmo.can, { charterEdit: true, charterApprove: false, formManage: true, formSubmit: true, formApprove: false, healthRecord: true, healthApprove: false });
  const pm = await ws("u-pm");
  assert.equal(pm.can.charterEdit, true);
  assert.equal(pm.can.formApprove, true);
  assert.equal(pm.can.formManage, false);
  assert.equal(pm.can.healthApprove, false);
  const ceo = await ws("u-ceo");
  assert.equal(ceo.can.charterApprove, true);
  assert.equal(ceo.can.healthApprove, true);
  const qc = await ws("u-qc");
  assert.equal(qc.can.formSubmit, true);
  assert.equal(qc.can.charterEdit, false);
  // معیارهای وزن‌دار از سرور می‌آید و جمعشان ۱۰۰ است.
  assert.equal(pmo.criteriaModel.reduce((s, c) => s + c.Weight, 0), 100);
  assert.equal(pmo.modelVersion, "pmo-gov-v1");
});

test("CRUD عمومی روی جدول‌های PMO بسته است — فقط مسیر اختصاصی", async () => {
  for (const table of ["PmoCharter", "PmoFormDefinition", "PmoFormEntry", "PmoHealthAssessment"]) {
    for (const user of ["u-admin", "u-pm"]) {
      const r = await fetch(`${BASE}/api/data/${table}`, { headers: { "x-user-id": user } });
      assert.equal(r.status, 403, `${table} برای ${user}`);
      assert.equal((await r.json()).error.code, "TABLE_HAS_DEDICATED_API", table);
    }
  }
});

test("PMO-1: منشور با حداقل یک هدف ثبت می‌شود و اعتبارسنجی سرور کار می‌کند", async () => {
  const noObjective = await call("POST", "/charters", { user: "u-pmo", body: charterBody({ ObjectivesFa: ["", "  "] }) });
  assert.equal(noObjective.status, 400);
  assert.equal(err(noObjective), "E-PMO-VALIDATION");

  const noScope = await call("POST", "/charters", { user: "u-pmo", body: charterBody({ ScopeInFa: "" }) });
  assert.equal(noScope.status, 400);
  assert.equal(err(noScope), "E-PMO-VALIDATION");

  /* وضعیت را کلاینت تعیین نمی‌کند؛ فیلد بیرونی باید رد شود، نه ذخیره. */
  const foreignStatus = await call("POST", "/charters", { user: "u-pmo", body: { ...charterBody(), CharterNo: code("CH-X"), Status: "approved" } });
  assert.equal(foreignStatus.status, 400);
  assert.equal(err(foreignStatus), "E-PMO-VALIDATION");

  const created = await call("POST", "/charters", { user: "u-pmo", body: charterBody() });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.Status, "draft");
  assert.equal(created.body.data.ObjectivesJson.length, 2);
  assert.equal(created.body.data.MilestonesJson[0].TitleFa, "شروع");
  assert.equal(created.body.data.BudgetAmount, 1_000_000);
  assert.equal(created.body.data.CreatedBy, "u-pmo");

  const dup = await call("POST", "/charters", { user: "u-pmo", body: charterBody() });
  assert.equal(dup.status, 409);
  assert.equal(err(dup), "E-PMO-DUPLICATE");
});

test("PMO-1: گردش منشور — ارسال، برگشت با یادداشت، و تصویب بیرونی با قفل ویرایش", async () => {
  const submitted = await call("POST", `/charters/${CH}/transition`, { user: "u-pmo", body: { action: "submit" } });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.data.Status, "submitted");

  // منشور ارسال‌شده قابل ویرایش نیست؛ باید برگردد.
  const locked = await call("PATCH", `/charters/${CH}`, { user: "u-pmo", body: { RowVersion: submitted.body.data.RowVersion, TitleFa: "تغییر" } });
  assert.equal(locked.status, 409);
  assert.equal(err(locked), "E-PMO-LOCKED");

  // SOD-30: تحریرکننده نمی‌تواند تصویب کند.
  const selfApprove = await call("POST", `/charters/${CH}/transition`, { user: "u-pmo", body: { action: "approve" } });
  assert.equal(selfApprove.status, 403);
  assert.equal(err(selfApprove), "E-PMO-FORBIDDEN");

  const returned = await call("POST", `/charters/${CH}/transition`, { user: "u-ceo", body: { action: "return", note: "هدف دوم عددی نیست" } });
  assert.equal(returned.status, 200);
  assert.equal(returned.body.data.Status, "returned");
  assert.equal(returned.body.data.ReturnNoteFa, "هدف دوم عددی نیست");

  // پس از برگشت، ویرایش با نسخهٔ درست مجاز است و نسخهٔ کهنه رد می‌شود.
  const stale = await call("PATCH", `/charters/${CH}`, { user: "u-pmo", body: { RowVersion: submitted.body.data.RowVersion, TitleFa: "تغییر کهنه" } });
  assert.equal(stale.status, 409);
  assert.equal(err(stale), "E-PMO-VERSION");

  const fixed = await call("PATCH", `/charters/${CH}`, { user: "u-pmo", body: { RowVersion: returned.body.data.RowVersion, ScopeInFa: "ساخت، نصب و راه‌اندازی" } });
  assert.equal(fixed.status, 200);
  assert.equal(fixed.body.data.ScopeInFa, "ساخت، نصب و راه‌اندازی");

  const resubmitted = await call("POST", `/charters/${CH}/transition`, { user: "u-pmo", body: { action: "submit" } });
  assert.equal(resubmitted.status, 200);
  const approved = await call("POST", `/charters/${CH}/transition`, { user: "u-ceo", body: { action: "approve" } });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.Status, "approved");
  assert.equal(approved.body.data.ApprovedBy, "u-ceo");
});

test("PMO-1: تصویب منشور تازه، منشور مصوب قبلی را جایگزین می‌کند", async () => {
  // منشور خودنوشتهٔ «ارسال‌شده» ابتدا مصوب می‌شود تا نسخهٔ قبلی وجود داشته باشد.
  const first = await call("POST", `/charters/${code("SEEDCH")}/transition`, { user: "u-ceo", body: { action: "approve" } });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.Status, "approved");

  const second = await call("POST", "/charters", { user: "u-pmo", body: charterBody({ CharterNo: CH2, TitleFa: "منشور بازنگری" }) });
  assert.equal(second.status, 201);
  await call("POST", `/charters/${CH2}/transition`, { user: "u-pmo", body: { action: "submit" } });
  const approvedSecond = await call("POST", `/charters/${CH2}/transition`, { user: "u-ceo", body: { action: "approve" } });
  assert.equal(approvedSecond.status, 200);

  const list = (await ws("u-ceo")).charters;
  const old = list.find((c) => c.CharterNo === code("SEEDCH"));
  const fresh = list.find((c) => c.CharterNo === CH2);
  assert.equal(old.Status, "superseded");
  assert.equal(old.SupersededByCharterNo, CH2);
  assert.ok(old.SupersededAt);
  assert.equal(fresh.Status, "approved");
  // حداکثر یک منشور مصوب در هر لحظه.
  assert.equal(list.filter((c) => c.Status === "approved").length, 1);
});

test("PMO-2: فرم پیش‌نویس منتشر می‌شود، نسخه بالا می‌رود و پس از انتشار قفل است", async () => {
  const badField = await call("POST", "/forms", { user: "u-pmo", body: formBody({ Fields: [{ Key: "A", LabelFa: "الف", Type: "magic" }] }) });
  assert.equal(badField.status, 400);
  assert.equal(err(badField), "E-PMO-VALIDATION");

  const created = await call("POST", "/forms", { user: "u-pmo", body: formBody() });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.Status, "draft");
  assert.equal(created.body.data.Version, 0);

  const published = await call("POST", `/forms/${FRM}/transition`, { user: "u-pmo", body: { action: "publish" } });
  assert.equal(published.status, 200);
  assert.equal(published.body.data.Status, "published");
  assert.equal(published.body.data.Version, 1);

  const noPublishAgain = await call("POST", `/forms/${FRM}/transition`, { user: "u-pmo", body: { action: "publish" } });
  assert.equal(noPublishAgain.status, 400);
  assert.equal(err(noPublishAgain), "E-PMO-VALIDATION");

  /* فرم منتشرشده می‌تواند بازنشسته شود؛ فرم بازنشسته دیگر رکورد نمی‌پذیرد.
     بازنشستگی روی FRM3 انجام می‌شود تا FRM منتشرشده برای آزمون رکورد بماند. */
  const f3 = await call("POST", "/forms", { user: "u-pmo", body: formBody({ Code: FRM3, TitleFa: "فرم بازنشستنی" }) });
  assert.equal(f3.status, 201);
  assert.equal((await call("POST", `/forms/${FRM3}/transition`, { user: "u-pmo", body: { action: "publish" } })).status, 200);
  const retired = await call("POST", `/forms/${FRM3}/transition`, { user: "u-pmo", body: { action: "retire" } });
  assert.equal(retired.status, 200);
  assert.equal(retired.body.data.Status, "retired");

  const locked = await call("PATCH", `/forms/${FRM}`, { user: "u-pmo", body: { RowVersion: published.body.data.RowVersion, TitleFa: "تغییر" } });
  assert.equal(locked.status, 409);
  assert.equal(err(locked), "E-PMO-LOCKED");

  // فرم پیش‌نویس دیگر باید قابل ویرایش باشد (نبود فرم منتشرشده کافی نیست).
  const draftForm = await call("POST", "/forms", { user: "u-pmo", body: formBody({ Code: FRM2, TitleFa: "فرم دوم" }) });
  assert.equal(draftForm.status, 201);
  const patched = await call("PATCH", `/forms/${FRM2}`, { user: "u-pmo", body: { RowVersion: draftForm.body.data.RowVersion, PurposeFa: "هدف اصلاح‌شده" } });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.PurposeFa, "هدف اصلاح‌شده");
});

test("PMO-2: رکورد فرم فقط روی نسخهٔ منتشرشده و با دادهٔ معتبر ثبت می‌شود", async () => {
  const onDraft = await call("POST", "/entries", { user: "u-qc", body: { FormCode: FRM2, SubjectFa: "روی پیش‌نویس", Data: {} } });
  assert.equal(onDraft.status, 400);
  assert.equal(err(onDraft), "E-PMO-NO-FORM");

  const onRetired = await call("POST", "/entries", { user: "u-qc", body: { FormCode: FRM3, SubjectFa: "روی بازنشسته", Data: { AREA: "A", RESULT: "ok" } } });
  assert.equal(onRetired.status, 400);
  assert.equal(err(onRetired), "E-PMO-NO-FORM");

  const unknown = await call("POST", "/entries", { user: "u-qc", body: { FormCode: FRM, SubjectFa: "فیلد ناشناس", Data: { AREA: "A", RESULT: "ok", EXTRA: "x" } } });
  assert.equal(unknown.status, 400);
  assert.equal(err(unknown), "E-PMO-VALIDATION");

  const missingRequired = await call("POST", "/entries", { user: "u-qc", body: { FormCode: FRM, SubjectFa: "بدون فیلد الزامی", Data: { AREA: "A" } } });
  assert.equal(missingRequired.status, 400);
  assert.equal(err(missingRequired), "E-PMO-VALIDATION");

  const badOption = await call("POST", "/entries", { user: "u-qc", body: { FormCode: FRM, SubjectFa: "گزینهٔ نامعتبر", Data: { AREA: "A", RESULT: "maybe" } } });
  assert.equal(badOption.status, 400);
  assert.equal(err(badOption), "E-PMO-VALIDATION");

  const outOfRange = await call("POST", "/entries", { user: "u-qc", body: { FormCode: FRM, SubjectFa: "خارج از بازه", Data: { AREA: "A", RESULT: "ok", COUNT: 900 } } });
  assert.equal(outOfRange.status, 400);
  assert.equal(err(outOfRange), "E-PMO-VALIDATION");

  const created = await call("POST", "/entries", { user: "u-qc", body: { FormCode: FRM, SubjectFa: "بازرسی ناحیه A", Data: { AREA: "A", RESULT: "nok", COUNT: "3", DONE: true } } });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.Status, "draft");
  assert.equal(created.body.data.FormVersion, 1);
  // دادهٔ عددی/بولی باید نوع‌دار ذخیره شود، نه رشته.
  assert.equal(created.body.data.DataJson.COUNT, 3);
  assert.equal(created.body.data.DataJson.DONE, true);

  const submitted = await call("POST", `/entries/${created.body.data.Id}/transition`, { user: "u-qc", body: { action: "submit" } });
  assert.equal(submitted.status, 200);
  // SOD: تأییدکننده نباید خود ثبت‌کننده باشد.
  const qcApprove = await call("POST", `/entries/${created.body.data.Id}/transition`, { user: "u-qc", body: { action: "approve" } });
  assert.equal(qcApprove.status, 403);
  const approved = await call("POST", `/entries/${created.body.data.Id}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.Status, "approved");
});

test("PMO-3: کارت سلامت از وزن‌های ثابت محاسبه می‌شود و جمع وزن باید ۱۰۰ باشد", async () => {
  const badSum = await call("POST", "/assessments", { user: "u-pm", body: assessmentBody({ Criteria: criteria().map((c, i) => (i === 0 ? { ...c, Weight: 40 } : c)) }) });
  assert.equal(badSum.status, 400);
  assert.equal(err(badSum), "E-PMO-VALIDATION");

  const unknownCriterion = await call("POST", "/assessments", { user: "u-pm", body: assessmentBody({ Criteria: criteria().map((c, i) => (i === 0 ? { ...c, Code: "weather" } : c)) }) });
  assert.equal(unknownCriterion.status, 400);
  assert.equal(err(unknownCriterion), "E-PMO-VALIDATION");

  const outOfRange = await call("POST", "/assessments", { user: "u-pm", body: assessmentBody({ Criteria: criteria().map((c, i) => (i === 0 ? { ...c, Score: 140 } : c)) }) });
  assert.equal(outOfRange.status, 400);
  assert.equal(err(outOfRange), "E-PMO-VALIDATION");

  const badDate = await call("POST", "/assessments", { user: "u-pm", body: assessmentBody({ AsOfDate: "20/09/2026" }) });
  assert.equal(badDate.status, 400);
  assert.equal(err(badDate), "E-PMO-VALIDATION");

  /* امتیاز وزنی: ۹۰×۰٫۲۵ + ۸۸×۰٫۲۵ + ۹۰×۰٫۱۵ + ۹۲×۰٫۱۵ + ۸۰×۰٫۱ + ۸۵×۰٫۱ = ۸۸٫۳ */
  const created = await call("POST", "/assessments", { user: "u-pm", body: assessmentBody() });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.ScoreTotal, 88.3);
  assert.equal(created.body.data.Band, "green");
  assert.equal(created.body.data.Status, "draft");

  // نوار کهربایی و قرمز هم باید از همان قاعده بیاید.
  const amber = await call("POST", "/assessments", { user: "u-pm", body: assessmentBody({ AsOfDate: "2026-09-18", Criteria: criteria({ Score: 72 }), NoteFa: "میان‌راه" }) });
  assert.equal(amber.status, 201);
  assert.equal(amber.body.data.Band, "amber");
  const red = await call("POST", "/assessments", { user: "u-pm", body: assessmentBody({ AsOfDate: "2026-09-17", Criteria: criteria({ Score: 40 }), NoteFa: "بحرانی" }) });
  assert.equal(red.status, 201);
  assert.equal(red.body.data.Band, "red");

  // ارزیابی مصوب باید ثبت‌کننده و تصویب‌کنندهٔ متفاوت داشته باشد.
  const submit = await call("POST", `/assessments/${created.body.data.Id}/transition`, { user: "u-pm", body: { action: "submit" } });
  assert.equal(submit.status, 200);
  const selfApprove = await call("POST", `/assessments/${created.body.data.Id}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(selfApprove.status, 403);
  const approved = await call("POST", `/assessments/${created.body.data.Id}/transition`, { user: "u-ceo", body: { action: "approve" } });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.Status, "approved");

  const metrics = (await ws("u-pm")).metrics;
  assert.equal(metrics.health.band, "green");
  assert.equal(metrics.charters.hasApprovedCharter, true);
  assert.equal(metrics.forms.published, 1);
  assert.equal(metrics.forms.retired, 1);
});

test("داده پس از راه‌اندازی دوباره سرور باقی می‌ماند و audit ثبت شده است", async () => {
  await restart();
  /* هر بخش میز کار پشت مجوز خودش است، پس هر سنجش با نقش دارندهٔ همان مجوز
     خوانده می‌شود: منشور با تصویب‌کننده، فرم با مدیر فرم، سلامت با ثبت‌کننده.
     نقش بی‌مجوز (اینجا تصویب‌کنندهٔ منشور) نباید فرم‌ها را ببیند. */
  const ceoView = await ws("u-ceo");
  assert.equal(ceoView.charters.find((c) => c.CharterNo === CH2)?.Status, "approved");
  assert.equal(ceoView.forms.length, 0, "نمای منشور نباید فرم‌های بی‌مجوز را نشان دهد");

  const pmoView = await ws("u-pmo");
  assert.equal(pmoView.forms.find((f) => f.Code === FRM)?.Version, 1);
  assert.equal(pmoView.charters.find((c) => c.CharterNo === code("SEEDCH"))?.Status, "superseded");

  const pmView = await ws("u-pm");
  assert.ok(pmView.assessments.some((a) => a.Band === "green" && a.Status === "approved"));

  const r = repo();
  const audits = await r.list("AuditLog");
  const actions = new Set(audits.filter((row) => row.ProjectCode === PID).map((row) => row.Action));
  for (const action of ["PMO_CHARTER_CREATE", "PMO_CHARTER_APPROVE", "PMO_FORM_PUBLISH", "PMO_FORM_RETIRE", "PMO_ENTRY_APPROVE", "PMO_HEALTH_APPROVE"]) {
    assert.ok(actions.has(action), `اقدام ممیزی ${action} ثبت نشده است`);
  }
});
