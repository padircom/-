/**
 * P9 — گزارش‌ساز سفارشی (RPT-1)، یکپارچه‌سازی خروجی (ITG-1/2/3) و پیمایش
 * سلسله‌مراتبی (MIX-1) روی سرور واقعی (درایور JSON).
 *
 * سؤال محوری: قالب گزارش با فیلتر/گروه/نمودار واقعاً ذخیره، منتشر و اجرا
 * می‌شود و SOD-31 (سازنده ≠ منتشرکننده) و بستن CRUD عمومی اعمال می‌شود؟ خروجی
 * XER/XML/ICS از **دادهٔ زندهٔ** پروژه ساخته می‌شود، رابطه‌ها در MSPDI خواهر
 * می‌مانند، نبودِ تنظیمات P6/Exchange صادقانه ۴۰۹ می‌دهد، `.mpp` ادعای
 * پشتیبانی نمی‌کند؟ و شمارش بخش‌های بی‌مجوز `null` است، نه صفر؟
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

const PORT = 4748;
const BASE = `http://127.0.0.1:${PORT}`;
const PID = "c1-p1";
const TAG = `P9${Date.now().toString(36).toUpperCase()}`;
const TPL = `${TAG}-TPL`;
const TPL2 = `${TAG}-TPL2`;
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

let child = null;
let dataDir = null;
let storageDir = null;
const repo = () => createRepository(new JsonFileDriver(dataDir));

async function startServer() {
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir, FILE_STORAGE_PATH: storageDir, P6_BASE_URL: "", P6_DATABASE: "", P6_USER_ID: "", P6_PASSWORD: "", MS_GRAPH_CLIENT_ID: "" },
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
  throw new Error("سرور آزمون P9 بالا نیامد");
}
async function stopServer() {
  if (!child) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await exited;
  child = null;
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "p9-data-"));
  storageDir = await mkdtemp(path.join(tmpdir(), "p9-files-"));
  const r = repo();
  await r.create("Project", { Id: PID, IndustryId: "OG", Code: "OG-2401", NameFa: "پروژه آزمون P9", Status: "active" }, "u-admin", "prj");
  await r.create("WbsNode", { Id: "w1", ProjectId: PID, Code: "PH-1", NameFa: "فاز یک", ParentId: null, Level: 1 }, "u-pm", "wbs");
  await r.create("WbsNode", { Id: "w1b", ProjectId: PID, Code: "PH-1.1", NameFa: "زیرفاز", ParentId: "w1", Level: 2 }, "u-pm", "wbs");
  await r.create("WbsNode", { Id: "w2", ProjectId: PID, Code: "PH-2", NameFa: "فاز دو", ParentId: null, Level: 1 }, "u-pm", "wbs");
  await r.create("Activity", { Id: "a1", ProjectId: PID, WbsId: "w1b", Code: `${TAG}-A1`, NameFa: "خاکبرداری", Discipline: "civil", PlannedStart: day(10), PlannedFinish: day(20), DurationDays: 8, PhysicalPct: 30, IsCritical: true }, "u-pm", "act");
  await r.create("Activity", { Id: "a2", ProjectId: PID, WbsId: "w2", Code: `${TAG}-A2`, NameFa: "بتن‌ریزی", Discipline: "civil", PlannedStart: day(21), PlannedFinish: day(30), DurationDays: 7, PhysicalPct: 0, IsCritical: false }, "u-pm", "act");
  await r.create("Activity", { Id: "a3", ProjectId: PID, WbsId: "w1", Code: `${TAG}-A3`, NameFa: "نقطهٔ عطف", Discipline: "civil", PlannedStart: day(40), PlannedFinish: day(40), DurationDays: 0, PhysicalPct: 0, IsCritical: false }, "u-pm", "act");
  await r.create("ActivityRelation", { Id: "r1", PredecessorId: "a1", SuccessorId: "a2", RelType: "FS", LagDays: 1 }, "u-pm", "rel");
  await r.create("PurchaseOrder", { Id: "po1", ProjectId: PID, PoNo: `${TAG}-PO-1`, VendorName: "فروشنده الف", TitleFa: "خرید لوله", IssuedAt: "2026-08-01", Status: "approved", Amount: 4000, Currency: "IRR" }, "u-cost", "po");
  await r.create("PurchaseOrder", { Id: "po2", ProjectId: PID, PoNo: `${TAG}-PO-2`, VendorName: "فروشنده ب", TitleFa: "خرید سیمان", IssuedAt: "2026-09-01", Status: "issued", Amount: 1500, Currency: "IRR" }, "u-cost", "po");
  await r.create("ScmProcPackage", { Id: "pk1", ProjectId: PID, Code: `${TAG}-PKG-1`, TitleFa: "بستهٔ لوله‌کشی", Discipline: "piping", WbsId: "w1", Status: "approved", TotalEstimatedAmount: 9000, Currency: "IRR" }, "u-cost", "pkg");
  await r.create("CntIpcCertificate", { Id: "ipc1", ProjectId: PID, TemplateCode: `${TAG}-IPCT`, PeriodNo: 1, PeriodFrom: "2026-08-01", PeriodTo: "2026-08-31", InputsJson: {}, NetAmount: 2000, Status: "approved" }, "u-cost", "ipc");
  await r.create("Ncr", { Id: "ncr1", ProjectId: PID, Code: `${TAG}-NCR-1`, TitleFa: "ترک سطحی", Severity: "major", Discipline: "civil", RaisedBy: "u-qc", RaisedAt: "2026-09-01", Status: "open" }, "u-qc", "ncr");
  await r.create("CpmDprEntry", { Id: "dpr1", ProjectId: PID, ReportNo: `${TAG}-DPR-1`, ReportDate: day(-2), ContractorCode: "SUB-1", Discipline: "civil", LocationFa: "سایت", ManpowerCount: 10, WorkDoneFa: "اجرای فونداسیون", Status: "submitted" }, "u-pm", "dpr");
  await r.create("CpmInspectionRequest", { Id: "ir1", ProjectId: PID, RequestNo: `${TAG}-IR-1`, ActivityCode: `${TAG}-A1`, Discipline: "civil", ContractorCode: "SUB-1", LocationFa: "سایت", ScopeFa: "بازرسی آرماتور", RequestedAt: day(-1), TargetDate: day(15), Status: "requested" }, "u-pm", "ir");
  await r.create("Risk", { Id: "rk1", ProjectId: PID, Code: `${TAG}-RK-1`, TitleFa: "تأخیر تأمین", Category: "procurement", Probability: 3, Impact: 4, Status: "open" }, "u-pm", "risk");
  await r.create("Document", { Id: "doc1", ProjectId: PID, DocNo: `${TAG}-DOC-1`, TitleFa: "نقشهٔ اجرایی", Revision: "00", Status: "issued", IssuedAt: "2026-08-10" }, "u-doc", "doc");
  await r.create("PmoHealthAssessment", { Id: "h1", ProjectId: PID, AsOfDate: day(-3), CriteriaJson: {}, ScoreTotal: 80, Band: "green", Status: "approved" }, "u-pmo", "health");
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

async function call(method, url, { user, body } = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, type, json: type.includes("json") ? await res.json().catch(() => null) : null, text: type.includes("json") ? null : await res.text() };
}
const rpt = (method, p, opts = {}) => call(method, `/api/reports/${PID}${p}`, opts);
const itg = (method, p, opts = {}) => call(method, `/api/itg/${PID}${p}`, opts);
const drill = (method, p, opts = {}) => call(method, `/api/drill/${PID}${p}`, opts);
const err = (r) => r.json?.error?.code;
const data = (r) => r.json?.data;

/* ══════════════════ RPT-1 — گزارش‌ساز سفارشی ══════════════════ */

test("RPT: میز کار مجموعه‌داده‌های مجاز را بر پایهٔ مجوز پایهٔ کاربر می‌دهد", async () => {
  const ws = await rpt("GET", "/workspace", { user: "u-pmo" });
  assert.equal(ws.status, 200);
  const body = data(ws);
  assert.equal(body.datasets.length, 9, "مجموعه‌داده‌های مجاز PMO");
  assert.deepEqual(body.datasets.map((d) => d.key).includes("purchase_orders"), true);
  assert.equal(body.restrictedDatasets, 2, "بستهٔ خرید و عدم‌انطباق از PMO پوشیده‌اند");
  assert.equal(body.can.edit, true);
  assert.equal(body.can.publish, false, "انتشار از PMO گرفته شده است (SOD-31)");
  assert.equal(body.metrics.templates.total, 0);
  assert.equal(body.metrics.modelVersion, "rpt-builder-v1");

  const cost = data(await rpt("GET", "/workspace", { user: "u-cost" }));
  assert.equal(cost.can.edit, false);
  assert.equal(cost.datasets.some((d) => d.key === "risks"), false, "بخش بی‌مجوز در فهرست نمی‌آید");
  assert.ok(cost.restrictedDatasets > 0);
});

test("RPT: مجموعه‌دادهٔ ناشناخته و عملگر بیرون از بسته ۴۰۰ می‌دهد", async () => {
  const badDataset = await rpt("POST", "/preview", { user: "u-pm", body: { spec: { dataset: "payroll" } } });
  assert.equal(badDataset.status, 400);
  assert.equal(err(badDataset), "E-RPT-VALIDATION", "کلید ناشناخته در همان لایهٔ اعتبارسنجی مشخصات رد می‌شود");
  const badOp = await rpt("POST", "/preview", { user: "u-pm", body: { spec: { dataset: "purchase_orders", filters: [{ column: "Amount", op: "sql", value: "1=1" }] } } });
  assert.equal(badOp.status, 400);
  assert.equal(err(badOp), "E-RPT-VALIDATION");
});

test("RPT: مجموعه‌دادهٔ بدون مجوز پایه ۴۰۳ می‌گیرد، هرچند مجوز گزارش‌ساز دارد", async () => {
  const r = await rpt("POST", "/preview", { user: "u-auditor", body: { spec: { dataset: "ncrs" } } });
  assert.equal(r.status, 403);
  assert.equal(err(r), "E-RPT-DATASET-FORBIDDEN");
});

test("RPT: پیش‌نمایش گروه‌بندی و جمع را از دادهٔ زندهٔ همین پروژه می‌سازد", async () => {
  const r = await rpt("POST", "/preview", {
    user: "u-pm",
    body: { spec: { dataset: "purchase_orders", fields: ["PoNo", "Status", "Amount"], group: { by: "Status", aggs: [{ column: "Amount", fn: "sum" }, { column: "Amount", fn: "count" }] }, sort: [{ column: "Amount", dir: "desc" }] } },
  });
  assert.equal(r.status, 200);
  const { result, chart } = data(r);
  assert.equal(result.matched, 2);
  const byStatus = Object.fromEntries(result.groups.map((g) => [g.key, g]));
  assert.equal(byStatus.approved?.count, 1);
  assert.equal(byStatus.approved?.aggs["sum:Amount"], 4000);
  assert.equal(byStatus.issued?.aggs["sum:Amount"], 1500);
  assert.equal(chart, null, "بدون نمودار، سری ساخته نمی‌شود");
});

test("RPT: فیلتر عددی و نمودار میله‌ای روی همان اجرا کار می‌کند", async () => {
  const r = await rpt("POST", "/preview", {
    user: "u-pm",
    body: { spec: { dataset: "purchase_orders", fields: ["PoNo", "Amount"], filters: [{ column: "Amount", op: "gte", value: 2000 }], chart: { kind: "bar", category: "PoNo", measure: "Amount" } } },
  });
  assert.equal(r.status, 200);
  const { result, chart } = data(r);
  assert.equal(result.matched, 1);
  assert.equal(result.rows[0].Amount, 4000);
  assert.equal(chart.kind, "bar");
  assert.deepEqual(chart.points, [{ label: `${TAG}-PO-1`, value: 4000 }]);
});

test("RPT: قالب پیش‌نویس ذخیره می‌شود و کد تکراری ۴۰۹ می‌گیرد", async () => {
  const created = await rpt("POST", "/templates", {
    user: "u-pmo",
    body: { Code: TPL, TitleFa: "گزارش سفارش‌های خرید", DatasetKey: "purchase_orders", Fields: ["PoNo", "Status", "Amount"], Filters: [{ column: "Amount", op: "gte", value: 0 }], Group: { by: "Status", aggs: [{ column: "Amount", fn: "sum" }] }, Limit: 100, NoteFa: "آزمون P9" },
  });
  assert.equal(created.status, 201);
  const row = data(created);
  assert.equal(row.Status, "draft");
  assert.equal(row.Version, 0);
  assert.equal(row.ModelVersion, "rpt-builder-v1");
  assert.deepEqual(row.Fields, ["PoNo", "Status", "Amount"]);

  const dup = await rpt("POST", "/templates", { user: "u-pmo", body: { Code: TPL, TitleFa: "تکراری", DatasetKey: "purchase_orders", Fields: ["PoNo"] } });
  assert.equal(dup.status, 409);
  assert.equal(err(dup), "E-RPT-DUPLICATE");
});

test("RPT: ویرایش با نسخهٔ کهنه ۴۰۹ و ویرایش درست نسخه را جلو می‌برد", async () => {
  const list = data(await rpt("GET", "/workspace", { user: "u-pmo" })).templates;
  const row = list.find((t) => t.Code === TPL);
  assert.ok(row, "قالب ساخته‌شده در میز کار هست");
  const stale = await rpt("PATCH", `/templates/${TPL}`, { user: "u-pmo", body: { RowVersion: 0, TitleFa: "کهنه" } });
  assert.equal(stale.status, 409);
  assert.equal(err(stale), "E-RPT-VERSION");

  const ok = await rpt("PATCH", `/templates/${TPL}`, { user: "u-pmo", body: { RowVersion: row.RowVersion, TitleFa: "گزارش سفارش‌های خرید (روزآمد)" } });
  assert.equal(ok.status, 200);
  assert.equal(data(ok).TitleFa, "گزارش سفارش‌های خرید (روزآمد)");
});

test("RPT: تفکیک تحریر و انتشار — نقش‌های تحریرکننده مجوز انتشار ندارند (SOD-31)", async () => {
  /* SOD-31 در لایهٔ RBAC اعمال می‌شود: هیچ نقشی هم‌زمان تحریر و انتشار ندارد،
   * پس سازندهٔ قالب (=u-pmo) نمی‌تواند منتشر کند. */
  const author = await rpt("POST", `/templates/${TPL}/transition`, { user: "u-pmo", body: { action: "publish" } });
  assert.equal(author.status, 403);
  assert.equal(err(author), "E-RPT-FORBIDDEN");
  const noPerm = await rpt("POST", `/templates/${TPL}/transition`, { user: "u-cost", body: { action: "publish" } });
  assert.equal(noPerm.status, 403);
  assert.equal(err(noPerm), "E-RPT-FORBIDDEN");
  const editor = await rpt("POST", `/templates/${TPL}/transition`, { user: "u-planner", body: { action: "retire" } });
  assert.equal(editor.status, 400, "u-planner می‌تواند ویرایش کند ولی قالب منتشرنشده را بازنشسته نمی‌کند");
  assert.equal(err(editor), "E-RPT-STATE");
});

test("RPT: انتشار با کاربر مستقل انجام می‌شود و تکرارش ۴۰۰ است", async () => {
  const published = await rpt("POST", `/templates/${TPL}/transition`, { user: "u-pm", body: { action: "publish" } });
  assert.equal(published.status, 200);
  assert.equal(data(published).Status, "published");
  assert.equal(data(published).Version, 1);
  const again = await rpt("POST", `/templates/${TPL}/transition`, { user: "u-pm", body: { action: "publish" } });
  assert.equal(again.status, 400);
  assert.equal(err(again), "E-RPT-STATE");
});

test("RPT: قالب منتشرشده ویرایش نمی‌شود و اجرایش با CSV هم‌خوان است", async () => {
  const locked = await rpt("PATCH", `/templates/${TPL}`, { user: "u-pmo", body: { RowVersion: 2, TitleFa: "بعد از انتشار" } });
  assert.equal(locked.status, 409);
  assert.equal(err(locked), "E-RPT-LOCKED");

  const run = await rpt("GET", `/templates/${TPL}/run`, { user: "u-pm" });
  assert.equal(run.status, 200);
  const body = data(run);
  assert.equal(body.template.status, "published");
  assert.equal(body.result.matched, 2);
  assert.equal(body.result.groups.find((g) => g.key === "approved").aggs["sum:Amount"], 4000);

  const csv = await rpt("GET", `/templates/${TPL}/csv`, { user: "u-pm" });
  assert.equal(csv.status, 200);
  assert.match(csv.type, /text\/csv/);
  /* BOM باید در بایت‌ها باشد؛ fetch آن را از رشته برمی‌دارد. */
  const raw = await fetch(`${BASE}/api/reports/${PID}/templates/${TPL}/csv`, { headers: { "x-user-id": "u-pm" } });
  const bytes = new Uint8Array(await raw.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "BOM برای اکسل فارسی");
  const lines = csv.text.trim().split("\n");
  assert.equal(lines.length, 3, "سرستون + دو گروه");
  assert.match(lines[0], /Status/);
  assert.match(lines[1] + lines[2], /4000|1500/);
});

test("RPT: جدول قالب گزارش از CRUD عمومی و ورود Excel بسته است", async () => {
  const generic = await call("GET", "/api/data/RptTemplate", { user: "u-pm" });
  assert.equal(generic.status, 403);
  assert.equal(err(generic), "TABLE_HAS_DEDICATED_API");
  assert.match(generic.json.error.route, /api\/reports/);
});

test("RPT: گارد SOD-31 در موتور — سازنده نمی‌تواند قالب خودش را منتشر کند", async () => {
  /* سطوح RBAC امروز تحریر و انتشار را به نقش‌های جدا می‌دهند؛ این گارد لایهٔ
   * دوم است تا اگر روزی نقشی هر دو را بگیرد، انتشار خودکار بسته بماند. */
  const { templateTransition, RbError } = await import("./rptBuilderLogic.js");
  const draft = { Status: "draft", Version: 0, CreatedBy: "u-author" };
  assert.throws(
    () => templateTransition("publish", draft, "u-author", new Date().toISOString()),
    (e) => e instanceof RbError && e.code === "E-RPT-SOD",
  );
  const published = templateTransition("publish", draft, "u-publisher", new Date().toISOString());
  assert.equal(published.Status, "published");
  assert.equal(published.Version, 1);
});

/* ══════════════════ ITG-1 — XER و MSPDI ══════════════════ */

test("ITG: خروجی XER از فعالیت‌های زنده ساخته می‌شود و بی‌مجوز ۴۰۳ است", async () => {
  const denied = await itg("GET", "/xer", { user: "u-auditor" });
  assert.equal(denied.status, 403);
  assert.equal(err(denied), "E-ITG-FORBIDDEN");

  const res = await itg("GET", "/xer", { user: "u-pm" });
  assert.equal(res.status, 200);
  assert.match(res.type, /text\/plain/);
  assert.match(res.text.split("\n")[0], /^ERMHDR\t19\.12/);
  assert.match(res.text, /%T\tPROJECT/);
  assert.match(res.text, /%T\tTASK/);
  const taskRows = res.text.split("\n").filter((l) => l.startsWith("%R\t") && l.includes(`${TAG}-A1`));
  assert.equal(taskRows.length, 1, "فعالیت A1 در XER هست");

  const json = data(await itg("GET", "/xer?format=json", { user: "u-pm" }));
  assert.equal(json.counts.activities, 3);
  assert.equal(json.counts.relations, 1);
  assert.equal(json.projectSource, "row");
  assert.equal(json.warning, null);
});

test("ITG: XML مایکروسافت پروجکت رابطه‌ها را خواهر می‌نویسد، نه تودرتو", async () => {
  const res = await itg("GET", "/msp.xml", { user: "u-pm" });
  assert.equal(res.status, 200);
  assert.match(res.type, /application\/xml/);
  const opens = res.text.match(/<PredecessorLink>/g) ?? [];
  const closes = res.text.match(/<\/PredecessorLink>/g) ?? [];
  assert.equal(opens.length, 1);
  assert.equal(closes.length, 1);
  assert.equal(/<PredecessorLink>[\s\S]*<PredecessorLink>/.test(res.text), false, "تودرتویی رابطه‌ها ممنوع");
  assert.match(res.text, /<Summary>1<\/Summary>/, "WBS به‌شکل تکلیف خلاصه صادر می‌شود");
  const json = data(await itg("GET", "/msp.xml?format=json", { user: "u-pm" }));
  assert.deepEqual(json.counts, { tasks: 6, links: 1, wbs: 3 });
  assert.equal(json.dataDate, day(40));
});

test("ITG: تقویم iCalendar فقط رویدادهای افق زمانی را می‌دهد", async () => {
  const denied = await itg("GET", "/calendar.ics", { user: "u-auditor" });
  assert.equal(denied.status, 403);

  const res = await itg("GET", "/calendar.ics?format=json", { user: "u-pm" });
  assert.equal(res.status, 200);
  const body = data(res);
  assert.equal(body.count, 4, "سه فعالیت + یک بازرسی در افق");
  assert.equal(body.issues.length, 0);

  const file = await itg("GET", "/calendar.ics", { user: "u-pm" });
  assert.match(file.type, /text\/calendar/);
  assert.match(file.text, /BEGIN:VCALENDAR/);
  assert.equal((file.text.match(/BEGIN:VEVENT/g) ?? []).length, 4);
  assert.match(file.text, /UID:.*@pmis\.local/);
  assert.equal((file.text.match(/CATEGORIES:inspection/g) ?? []).length, 1);
});

/* ══════════════════ ITG-2/3 — P6، MPP، Exchange ══════════════════ */

test("ITG: مشخصات P6 بدون رمز برمی‌گردد و نبودِ تنظیمات ۴۰۹ صادقانه است", async () => {
  const status = await itg("GET", "/p6", { user: "u-pm" });
  assert.equal(status.status, 200);
  const info = data(status);
  assert.equal(info.configured, false);
  assert.deepEqual(info.missing.sort(), ["P6_BASE_URL", "P6_DATABASE", "P6_PASSWORD", "P6_USER_ID"].sort());
  assert.equal(info.probePath, null);
  assert.equal(info.activityCount, 3);
  assert.equal(Object.hasOwn(info, "password"), false);

  const push = await itg("POST", "/p6/push", { user: "u-pmo", body: {} });
  assert.equal(push.status, 409);
  assert.equal(err(push), "E-P6-NOT-CONFIGURED");
  const denied = await itg("POST", "/p6/push", { user: "u-pm", body: {} });
  assert.equal(denied.status, 403, "u-pm مجوز ارسال به P6 ندارد");
});

test("ITG: بازرسی .mpp صادقانه است — ظرف شناسایی می‌شود، پشتیبانی نه", async () => {
  const ole2 = Buffer.from("d0cf11e0a1b11ae100000000000000000000000000000000", "hex").toString("base64");
  const res = await itg("POST", "/mpp/inspect", { user: "u-pm", body: { fileName: "plan.mpp", base64: ole2 } });
  assert.equal(res.status, 200);
  const body = data(res);
  assert.equal(body.isMpp, true);
  assert.equal(body.container, "ole2");
  assert.equal(body.supported, false);
  assert.match(body.guidanceFa, /XML|XER/);
  assert.deepEqual(body.alternatives, ["msp.xml", "xer"]);

  const wrongName = await itg("POST", "/mpp/inspect", { user: "u-pm", body: { fileName: "plan.xml", base64: ole2 } });
  assert.equal(wrongName.status, 400);
  assert.equal(err(wrongName), "E-ITG-VALIDATION");
  const empty = await itg("POST", "/mpp/inspect", { user: "u-pm", body: { fileName: "plan.mpp", base64: "" } });
  assert.equal(err(empty), "E-ITG-VALIDATION");
});

test("ITG: فرستادن تقویم با Exchange تنظیم‌نشده ۴۰۹ می‌دهد و آزمون خشک هم بی‌تنظیمات نیست", async () => {
  const r = await itg("POST", "/exchange/send", { user: "u-pm", body: { dryRun: true } });
  assert.equal(r.status, 409);
  assert.equal(err(r), "E-EXCHANGE-NOT-CONFIGURED");
  assert.equal(r.json.data, undefined);
  assert.ok(Array.isArray(r.json.error.missing));
  const denied = await itg("POST", "/exchange/send", { user: "u-auditor", body: {} });
  assert.equal(denied.status, 403);
});

test("ITG: دفتر اجرا شاهد هر خروجی است و از CRUD عمومی بسته است", async () => {
  const runs = await itg("GET", "/runs", { user: "u-pm" });
  assert.equal(runs.status, 200);
  const body = data(runs);
  const connectors = body.runs.map((r) => r.Connector);
  for (const c of ["xer", "msp", "calendar"]) assert.ok(connectors.includes(c), `اجرای ${c} ثبت شده`);
  const xerRun = body.runs.find((r) => r.Connector === "xer");
  assert.equal(xerRun.Status, "succeeded");
  assert.equal(xerRun.ItemCount, 3);
  assert.equal(xerRun.ActorId, "u-pm");
  assert.equal(xerRun.ModelVersion, "itg-outbound-v1");
  assert.ok(xerRun.PayloadBytes > 0);

  const generic = await call("GET", "/api/data/ItgConnectorRun", { user: "u-pm" });
  assert.equal(generic.status, 403);
  assert.equal(err(generic), "TABLE_HAS_DEDICATED_API");
});

/* ══════════════════ MIX-1 — پیمایش سلسله‌مراتبی ══════════════════ */

test("MIX: میز کار بخش‌ها را با مجوز لازم و بدون ادعای دسترسی نشان می‌دهد", async () => {
  const ws = await drill("GET", "/workspace", { user: "u-cost" });
  assert.equal(ws.status, 200);
  const body = data(ws);
  assert.equal(body.total, 10);
  assert.equal(body.sections.length, 10);
  assert.equal(body.sections.find((s) => s.key === "ncrs").allowed, false);
  assert.equal(body.sections.find((s) => s.key === "purchase_orders").allowed, true);
  assert.equal(body.modelVersion, "mcs-drill-v1");
  assert.equal(body.sections.find((s) => s.key === "activities").hasWbs, true);
  assert.equal(body.sections.find((s) => s.key === "ipc_certificates").hasWbs, false, "صورت‌وضعیت WBS ندارد");
});

test("MIX: شمارش فازها از دادهٔ زنده می‌آید و رابطهٔ WBS تا ریشه حل می‌شود", async () => {
  const res = await drill("GET", "/drill", { user: "u-pm" });
  assert.equal(res.status, 200);
  const body = data(res);
  assert.equal(body.projectSource, "row");
  assert.equal(body.phases.length, 2, "دو ریشهٔ WBS = دو فاز؛ زیرفاز، فاز نیست");
  assert.deepEqual(body.phases.map((p) => p.code).sort(), ["PH-1", "PH-2"]);
  const phase1 = body.phases.find((p) => p.code === "PH-1");
  assert.equal(phase1.counts.activities, 2, "A1 زیر زیرفاز PH-1.1 و A3 روی PH-1 — هر دو به فاز یک می‌رسند");
  const phase2 = body.phases.find((p) => p.code === "PH-2");
  assert.equal(phase2.counts.activities, 1);
  assert.equal(body.unphased.activities ?? 0, 0, "فعالیتِ بی‌فاز نداریم");

  const po = body.sections.find((s) => s.key === "purchase_orders");
  assert.equal(po.count, 2);
  assert.equal(po.amount, 5500);
  assert.deepEqual(po.statusCounts, { approved: 1, issued: 1 });
  const pkg = body.sections.find((s) => s.key === "proc_packages");
  assert.equal(pkg.count, 1);
  assert.equal(pkg.amount, 9000);
});

test("MIX: بخش بی‌مجوز null می‌دهد، نه صفر — و «صفر» فقط برای بخش دیده‌شدهٔ خالی", async () => {
  const auditor = data(await drill("GET", "/drill", { user: "u-auditor" }));
  const ncrs = auditor.sections.find((s) => s.key === "ncrs");
  assert.equal(ncrs.state, "restricted");
  assert.equal(ncrs.count, null, "ندیدن با صفر بودن یکی نیست");
  assert.equal(ncrs.restricted, true);
  const docs = auditor.sections.find((s) => s.key === "documents");
  assert.equal(docs.count, 1);
  const risks = auditor.sections.find((s) => s.key === "risks");
  assert.equal(risks.count, null);
  assert.equal(risks.state, "restricted");
});

test("MIX: اقلام یک بخش با فاز و مبلغ برمی‌گردد و فیلتر فاز کار می‌کند", async () => {
  const all = data(await drill("GET", "/drill?section=purchase_orders&limit=10", { user: "u-pm" }));
  assert.equal(all.itemsSection.readable, true);
  assert.equal(all.items.length, 2);
  assert.equal(all.items[0].code, `${TAG}-PO-2`, "تازه‌ترین سفارش اول می‌آید");
  const wbsItem = all.items.find((i) => i.code === `${TAG}-PO-1`);
  assert.equal(wbsItem.phaseId, null, "سفارش خرید WBS ندارد، پس فاز هم ندارد");
  assert.equal(wbsItem.amount, 4000);

  const byPhase = data(await drill("GET", `/drill?section=proc_packages&phase=${encodeURIComponent("PH-1")}`, { user: "u-pm" }));
  assert.equal(byPhase.items.length, 1);
  assert.equal(byPhase.items[0].phaseCode, "PH-1");

  const hidden = data(await drill("GET", "/drill?section=ncrs", { user: "u-auditor" }));
  assert.equal(hidden.items, null);
  assert.equal(hidden.itemsSection.readable, false);
});

test("MIX: نمای سبد فقط پروژه‌های در دامنه را می‌شمارد و بی‌مجوز ۴۰۳ است", async () => {
  const res = await drill("GET", "/portfolio", { user: "u-pm" });
  assert.equal(res.status, 200);
  const body = data(res);
  assert.equal(body.projects.length, 1);
  const project = body.projects[0];
  assert.equal(project.projectId, PID);
  assert.equal(project.code, "OG-2401");
  assert.equal(project.total, 13, "مجموع بخش‌های خواندنیِ در دامنهٔ u-pm");
  const po = project.sections.find((s) => s.key === "purchase_orders");
  assert.equal(po.count, 2);

  const sub = await drill("GET", "/portfolio", { user: "u-sub" });
  assert.equal(sub.status, 403, "پیمانکار مجوز نمای سبد ندارد");
  assert.equal(err(sub), "E-DRILL-FORBIDDEN");
  const outsider = await drill("GET", "/drill", { user: "u-left" });
  assert.equal(outsider.status, 401, "حساب غیرفعال u-left هویت معتبر نیست");
  assert.equal(err(outsider), "E-DRILL-AUTH-REQUIRED");
  const badSection = await drill("GET", "/drill?section=magic", { user: "u-pm" });
  assert.equal(badSection.status, 400);
  assert.equal(err(badSection), "E-DRILL-SECTION");
});

/* ══════════════════ چارچوب ══════════════════ */

test("P9: مسیرها با شناسهٔ نامعتبر پروژه ۴۰۰ می‌دهند و بی‌هویت ۴۰۱", async () => {
  const bad = await call("GET", `/api/reports/${encodeURIComponent("a b")}/workspace`, { user: "u-pm" });
  assert.equal(bad.status, 400);
  assert.equal(err(bad), "E-RPT-BAD-PROJECT");
  const anon = await call("GET", `/api/drill/${PID}/drill`);
  assert.equal(anon.status, 401);
  assert.equal(err(anon), "E-DRILL-AUTH-REQUIRED");
  const notItg = await call("GET", `/api/itg/${encodeURIComponent("a b")}/runs`, { user: "u-pm" });
  assert.equal(notItg.status, 400);
  assert.equal(err(notItg), "E-ITG-BAD-PROJECT");
});
