/**
 * P10 — دستیار هوشمند (AI-1..AI-4) روی سرور واقعی (درایور JSON).
 *
 * سؤال محوری: پاسخ عددی را همین سرور از دادهٔ زندهٔ پروژه می‌سازد یا مدل
 * بیرونی؟ آیا دستیار بی‌مجوز چیزی می‌خواند؟ «بسته» را صفر اعلام می‌کند یا
 * صادقانه بسته؟ پرسش بی‌نگاشت پاسخ ساختگی می‌گیرد؟ دفتر پرسش‌وپاسخ همراه
 * منبع داده (و برای هر پرسشگر، حتی بی‌مجوزِ تاریخچه) ثبت می‌شود؟ خروجی CSV/سند
 * از snapshot همان پاسخ ساخته می‌شود؟
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

const PORT = 4749;
const BASE = `http://127.0.0.1:${PORT}`;
const PID = "c1-p1";
const TAG = `P10${Date.now().toString(36).toUpperCase()}`;
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

let child = null;
let dataDir = null;
let storageDir = null;
const repo = () => createRepository(new JsonFileDriver(dataDir));
/** کد پاسخ‌ها بین آزمون‌ها به اشتراک می‌رود تا ترتیب اجرا مسئله نباشد. */
let queryCode = null;

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
  throw new Error("سرور آزمون P10 بالا نیامد");
}
async function stopServer() {
  if (!child) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await exited;
  child = null;
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "p10-data-"));
  storageDir = await mkdtemp(path.join(tmpdir(), "p10-files-"));
  const r = repo();
  await r.create("Project", { Id: PID, IndustryId: "OG", Code: "OG-2401", NameFa: "پروژه آزمون P10", Status: "active" }, "u-admin", "prj");
  /* ریسک: سه رکورد — دو باز با امتیاز متفاوت و یکی بستهٔ ۲۵. اگر ابزار
   * رتبه‌بندی، رکورد بسته را هم بیاورد، آزمون می‌گیرد. */
  await r.create("Risk", { Id: "rk1", ProjectId: PID, Code: `${TAG}-RK-1`, TitleFa: "تأخیر تأمین لوله", Category: "procurement", Probability: 4, Impact: 5, Status: "open", Owner: "u-pm" }, "u-pm", "rk");
  await r.create("Risk", { Id: "rk2", ProjectId: PID, Code: `${TAG}-RK-2`, TitleFa: "کمبود نیروی جوشکار", Category: "hr", Probability: 2, Impact: 3, Status: "open" }, "u-pm", "rk");
  await r.create("Risk", { Id: "rk3", ProjectId: PID, Code: `${TAG}-RK-3`, TitleFa: "ریسک بسته‌شدهٔ بسیار بزرگ", Category: "scope", Probability: 5, Impact: 5, Status: "closed" }, "u-pm", "rk");
  /* فعالیت: یکی از موعد گذشته و یکی در آینده؛ بودجه برای وزن پیش‌بینی. */
  await r.create("Activity", { Id: "a1", ProjectId: PID, WbsId: "w1", Code: `${TAG}-A1`, NameFa: "خاکبرداری", Discipline: "civil", PlannedStart: day(-20), PlannedFinish: day(-10), DurationDays: 10, PhysicalPct: 40, IsCritical: true, BudgetCost: 1000 }, "u-pm", "act");
  await r.create("Activity", { Id: "a2", ProjectId: PID, WbsId: "w1", Code: `${TAG}-A2`, NameFa: "بتن‌ریزی", Discipline: "civil", PlannedStart: day(-20), PlannedFinish: day(20), DurationDays: 20, PhysicalPct: 50, IsCritical: false, BudgetCost: 1000 }, "u-pm", "act");
  /* ثبت پیشرفت پذیرفته‌شده در دو تاریخ با فاصلهٔ ۱۰ روز → پیش‌بینی باید عدد بدهد. */
  await r.create("ProgressEntry", { Id: "pg1", ProjectId: PID, ActivityId: "a1", PeriodCode: `${TAG}-P1`, EntryDate: day(-12), PhysicalPct: 20, AcceptedIntoEv: true, EnteredBy: "u-site", ApprovedBy: "u-pm" }, "u-pm", "pg");
  await r.create("ProgressEntry", { Id: "pg2", ProjectId: PID, ActivityId: "a2", PeriodCode: `${TAG}-P1`, EntryDate: day(-12), PhysicalPct: 30, AcceptedIntoEv: true, EnteredBy: "u-site", ApprovedBy: "u-pm" }, "u-pm", "pg");
  await r.create("ProgressEntry", { Id: "pg3", ProjectId: PID, ActivityId: "a1", PeriodCode: `${TAG}-P2`, EntryDate: day(-2), PhysicalPct: 40, AcceptedIntoEv: true, EnteredBy: "u-site", ApprovedBy: "u-pm" }, "u-pm", "pg");
  await r.create("ProgressEntry", { Id: "pg4", ProjectId: PID, ActivityId: "a2", PeriodCode: `${TAG}-P2`, EntryDate: day(-2), PhysicalPct: 50, AcceptedIntoEv: true, EnteredBy: "u-site", ApprovedBy: "u-pm" }, "u-pm", "pg");
  /* تحویل دیرکرد + گلوگاه‌های گردش‌کار. */
  await r.create("PurchaseOrder", { Id: "po1", ProjectId: PID, PoNo: `${TAG}-PO-1`, VendorName: "فروشنده الف", TitleFa: "خرید لوله", IssuedAt: day(-30), PromisedDate: day(-5), Status: "issued", Amount: 4500, Currency: "IRR" }, "u-cost", "po");
  await r.create("PurchaseOrder", { Id: "po2", ProjectId: PID, PoNo: `${TAG}-PO-2`, VendorName: "فروشنده ب", TitleFa: "خرید سیمان", IssuedAt: day(-30), PromisedDate: day(30), Status: "issued", Amount: 1500, Currency: "IRR" }, "u-cost", "po");
  await r.create("CpmInspectionRequest", { Id: "ir1", ProjectId: PID, RequestNo: `${TAG}-IR-1`, RequestType: "inspection", WitnessRequired: false, ActivityCode: `${TAG}-A1`, Discipline: "civil", ContractorCode: "SUB-1", LocationFa: "سایت", ScopeFa: "بازرسی آرماتور", RequestedAt: day(-5), TargetDate: day(-3), Status: "requested" }, "u-pm", "ir");
  await r.create("CpmDprEntry", { Id: "dpr1", ProjectId: PID, ReportNo: `${TAG}-DPR-1`, ReportDate: day(-10), Shift: "day", ContractorCode: "SUB-1", Discipline: "civil", LocationFa: "سایت", ManpowerCount: 12, WorkDoneFa: "فونداسیون", Status: "submitted" }, "u-pm", "dpr");
  await r.create("Ncr", { Id: "ncr1", ProjectId: PID, Code: `${TAG}-NCR-1`, TitleFa: "ترک سطحی", Severity: "major", Discipline: "civil", RaisedBy: "u-qc", RaisedAt: day(-6), Status: "open" }, "u-qc", "ncr");
  await r.create("Document", { Id: "doc1", ProjectId: PID, DocNo: `${TAG}-DOC-1`, TitleFa: "نقشهٔ اجرایی", Revision: "00", Status: "draft", Discipline: "civil" }, "u-doc", "doc");
  await r.create("MeetingAction", { Id: "ma1", ProjectId: PID, Code: `${TAG}-MA-1`, MeetingCode: `${TAG}-MTG-1`, TitleFa: "تأمین ورق", OwnerRole: "pmo", DueDate: day(-4), Status: "open" }, "u-pmo", "ma");
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

async function call(method, url, { user, body, headers } = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}), ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, type, json: type.includes("json") ? await res.json().catch(() => null) : null, text: type.includes("json") ? null : await res.text() };
}
const ai = (method, p, opts = {}) => call(method, `/api/ai/${PID}${p}`, opts);
const err = (r) => r.json?.error?.code;
const data = (r) => r.json?.data;

/* ══════════════════ AI-1 — پرسش محاوره‌ای ══════════════════ */

test("AI: میز کار ابزارها و مجوزها را صادقانه نشان می‌دهد", async () => {
  const anon = await ai("GET", "/workspace");
  assert.equal(anon.status, 401);
  assert.equal(err(anon), "E-AI-AUTH-REQUIRED");

  const ws = await ai("GET", "/workspace", { user: "u-pm" });
  assert.equal(ws.status, 200);
  const body = data(ws);
  assert.equal(body.can.ask, true);
  assert.equal(body.can.history, false, "تاریخچه از مدیر پروژه گرفته شده است");
  assert.equal(body.can.export, false);
  const tools = body.tools.map((t) => t.key);
  for (const k of ["top_risks", "delays", "forecast", "bottlenecks", "dataset_query"]) assert.ok(tools.includes(k), `ابزار ${k}`);
  assert.equal(body.metrics.modelVersion, "ai-assistant-v1");
  assert.equal(body.provider.serverKeyConfigured, false, "بدون کلید، ادعای سرویس بیرونی نمی‌شود");

  const auditor = data(await ai("GET", "/workspace", { user: "u-auditor" }));
  assert.equal(auditor.can.history, true, "ممیز تاریخچهٔ پرسش‌وپاسخ را می‌بیند");
  assert.equal(auditor.can.export, false, "ولی خروجی سند نمی‌گیرد");

  const qc = data(await ai("GET", "/workspace", { user: "u-qc" }));
  assert.equal(qc.datasets.some((d) => d.key === "purchase_orders"), false, "خرید بیرون از مجوز QC");
  assert.ok(qc.restrictedDatasets > 0);
});

test("AI: پرسش بیرون از پروژهٔ کاربر ۴۰۳ می‌گیرد", async () => {
  const r = await ai("GET", "/workspace", { user: "u-pm", headers: {} });
  assert.equal(r.status, 200);
  const other = await call("GET", "/api/ai/c9-p9/workspace", { user: "u-pm" });
  assert.equal(other.status, 403);
  assert.equal(err(other), "E-AI-FORBIDDEN");
});

test("AI-1: پرسش بالاترین ریسک‌ها را به ابزار درست می‌برد و از دادهٔ زنده رتبه می‌دهد", async () => {
  const r = await ai("POST", "/ask", { user: "u-pm", body: { question: "بالاترین ریسک‌های پروژه کدام‌اند؟" } });
  assert.equal(r.status, 200);
  const body = data(r);
  assert.equal(body.matched, true);
  assert.equal(body.tool, "top_risks");
  assert.match(body.code, /^AI-\d{4}$/);
  assert.equal(body.section.state, "answered");
  const rows = body.section.table.rows;
  assert.equal(rows.length, 2, "فقط ریسک‌های باز رتبه می‌گیرند");
  assert.equal(rows[0][0], `${TAG}-RK-1`, "بالاترین امتیاز اول");
  assert.equal(body.section.sources[0].table, "Risk");
  assert.equal(body.section.sources[0].rows, 3, "شمارش منبع خوانده‌شده");
  assert.equal(body.section.sources[0].restricted, false);
  assert.equal(body.narration, null, "بدون سرویس، متنِ محاسبه‌شدهٔ سرور نمایش داده می‌شود");
});

test("AI-1: پرسش از داده با موتور بستهٔ RPT-1 اجرا می‌شود و SQL نمی‌پذیرد", async () => {
  const r = await ai("POST", "/ask", { user: "u-pm", body: { question: "سفارش‌های خرید به تفکیک وضعیت" } });
  assert.equal(r.status, 200);
  const body = data(r);
  assert.equal(body.tool, "dataset_query");
  assert.equal(body.params.spec.dataset, "purchase_orders");
  assert.equal(body.params.spec.group.by, "Status");
  assert.equal(body.section.table.rows.length, 1, "یک وضعیت در داده");
  queryCode = body.code;

  const injected = await ai("POST", "/ask", { user: "u-pm", body: { tool: "dataset_query", question: "x", params: { spec: { dataset: "purchase_orders", filters: [{ column: "Amount", op: "sql", value: "1=1" }] } } } });
  assert.equal(injected.status, 400, "عملگر آزاد رد می‌شود");
  assert.equal(err(injected), "E-AI-PARAM");

  const unknown = await ai("POST", "/ask", { user: "u-pm", body: { tool: "shell", question: "x" } });
  assert.equal(unknown.status, 400);
  assert.equal(err(unknown), "E-AI-TOOL");
});

test("AI-1: پرسش بی‌نگاشت پاسخ ساختگی نمی‌گیرد", async () => {
  const r = await ai("POST", "/ask", { user: "u-pm", body: { question: "امروز هوا در تهران چگونه است؟" } });
  assert.equal(r.status, 200);
  const body = data(r);
  assert.equal(body.matched, false);
  assert.equal(body.reason, "no_match");
  assert.deepEqual(body.suggestions.length > 0, true);
  assert.match(body.detailFa, /ساختگی|نگاشت/);
  assert.equal(body.section, undefined, "هیچ بخش پاسخی ساخته نمی‌شود");
});

test("AI-1: مجموعه‌دادهٔ بیرون از مجوز «بسته» اعلام می‌شود، نه صفر", async () => {
  const r = await ai("POST", "/ask", { user: "u-qc", body: { question: "سفارش‌های خرید به تفکیک وضعیت" } });
  assert.equal(r.status, 200);
  const body = data(r);
  assert.equal(body.matched, false);
  assert.equal(body.reason, "restricted");
  assert.equal(body.dataset, "purchase_orders");
  assert.match(body.detailFa, /مجوز/);
});

test("AI-1: ابزار بی‌مجوز برای نقش صریحاً ۴۰۳ می‌گیرد", async () => {
  const r = await ai("POST", "/ask", { user: "u-qc", body: { tool: "top_risks", question: "ریسک‌ها" } });
  assert.equal(r.status, 403);
  assert.equal(err(r), "E-AI-TOOL-FORBIDDEN");
  const routed = await ai("POST", "/ask", { user: "u-qc", body: { question: "ریسک‌های بحرانی را نشان بده" } });
  assert.equal(routed.status, 200);
  assert.equal(data(routed).matched, false);
  assert.equal(data(routed).reason, "restricted");
});

/* ══════════════════ AI-2 — بینش‌های آماده ══════════════════ */

test("AI-2: خلاصهٔ وضعیت بخش‌ها را جدا می‌سازد و بخش بسته را صفر نمی‌گیرد", async () => {
  const r = await ai("GET", "/insights", { user: "u-pm" });
  assert.equal(r.status, 200);
  const body = data(r);
  const byKey = Object.fromEntries(body.sections.map((s) => [s.key, s]));
  assert.equal(byKey.top_risks.state, "answered");
  assert.equal(byKey.delays.state, "answered");
  assert.ok(byKey.delays.facts.length > 0);
  assert.equal(byKey.forecast.state, "answered", "دو ثبت پذیرفته‌شده در بازهٔ ۱۰روزه");
  assert.ok(byKey.forecast.facts.some((f) => String(f.label.fa).includes("پایان")) || byKey.forecast.facts.length > 0);
  assert.equal(byKey.bottlenecks.state, "answered");
  assert.match(body.code, /^AI-\d{4}$/);

  const qc = data(await ai("GET", "/insights", { user: "u-qc" }));
  const qcRisk = qc.sections.find((s) => s.key === "top_risks");
  assert.equal(qcRisk.state, "restricted", "QC مجوز ریسک ندارد");
  assert.match(qcRisk.textFa, /مجوز/);
});

test("AI-2: تأخیرها از گردش‌های واقعی شمرده می‌شوند", async () => {
  const r = await ai("POST", "/ask", { user: "u-pm", body: { tool: "delays", params: { category: "all", limit: 10 } } });
  assert.equal(r.status, 200);
  const body = data(r);
  assert.equal(body.section.state, "answered");
  const refs = body.section.table.rows.map((row) => String(row[1]));
  assert.ok(refs.includes(`${TAG}-A1`), "فعالیت عقب‌افتاده در فهرست");
  assert.ok(refs.some((x) => x.includes("IR-1")), "بازرسی معوق در فهرست");
  const names = body.section.table.rows.map((row) => String(row[2])).join(" | ");
  assert.match(names, /عقب‌افتاده|تحویل|بازرسی|گزارش روزانه|مصوبه/);
});

test("AI-2: پیش‌بینی با دادهٔ نابسنده عدد نمی‌سازد", async () => {
  const r = await ai("POST", "/ask", { user: "u-pm", body: { tool: "forecast", params: {} } });
  assert.equal(r.status, 200);
  assert.equal(data(r).section.state, "answered");

  /* با یک ثبت در پروژهٔ خالی، باید «نابسنده» بدهد نه عدد. */
  const empty = await ai("POST", "/ask", { user: "u-pm", body: { question: "با این نرخ، کار کی تمام می‌شود؟" } });
  assert.equal(empty.status, 200);
  assert.equal(["answered", "insufficient"].includes(data(empty).section.state), true);
});

/* ══════════════════ AI-3 — خروجی قابل اقدام ══════════════════ */

test("AI-3: خروجی CSV از snapshot همان پاسخ ساخته می‌شود", async () => {
  assert.ok(queryCode, "پرسش داده‌ای پیش‌تر ثبت شده");
  const csv = await ai("GET", `/history/${queryCode}/export?format=csv`, { user: "u-pmo" });
  assert.equal(csv.status, 200);
  assert.match(csv.type, /text\/csv/);
  const raw = await fetch(`${BASE}/api/ai/${PID}/history/${queryCode}/export?format=csv`, { headers: { "x-user-id": "u-pmo" } });
  const bytes = new Uint8Array(await raw.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "BOM برای اکسل فارسی");
  assert.match(csv.text, /Status/);
  assert.match(csv.text, /issued,2/, "گروه‌های دادهٔ زنده");
  assert.match(csv.text, /PurchaseOrder/, "منبع داده در خروجی");

  const md = await ai("GET", `/history/${queryCode}/export?format=md`, { user: "u-pmo" });
  assert.equal(md.status, 200);
  assert.match(md.type, /text\/markdown/);
  assert.match(md.text, /AI-\d{4}/, "کد پاسخ در سند");

  const forbidden = await ai("GET", `/history/${queryCode}/export?format=csv`, { user: "u-pm" });
  assert.equal(forbidden.status, 403);
  assert.equal(err(forbidden), "E-AI-FORBIDDEN");
});

test("AI-3: پرسش جمع مبلغ، عدد را از دادهٔ زنده می‌آورد و در سند می‌نویسد", async () => {
  const r = await ai("POST", "/ask", { user: "u-pm", body: { question: "جمع مبلغ سفارش‌های خرید چقدر است؟" } });
  assert.equal(r.status, 200);
  const body = data(r);
  assert.equal(body.tool, "dataset_query");
  assert.equal(body.params.spec.dataset, "purchase_orders");
  const rendered = JSON.stringify(body.section.table.rows);
  assert.match(rendered, /4500/, "مبلغ سفارش اول");
  assert.match(rendered, /1500/, "مبلغ سفارش دوم");
  const md = await ai("GET", `/history/${body.code}/export?format=md`, { user: "u-pmo" });
  assert.equal(md.status, 200);
  assert.match(md.text, /4[,٫]?500|4500/, "عدد در سند بازنویسی نمی‌شود");
});

test("AI-3: پاسخ داده‌ای به قالب گزارش پیش‌نویس تبدیل می‌شود", async () => {
  const r = await ai("POST", `/history/${queryCode}/template`, { user: "u-pmo", body: {} });
  assert.equal(r.status, 201);
  const tpl = data(r).template;
  assert.equal(tpl.dataset, "purchase_orders");
  assert.equal(tpl.status, "draft");
  assert.equal(tpl.sourceInteraction, queryCode);

  const dup = await ai("POST", `/history/${queryCode}/template`, { user: "u-pmo", body: {} });
  assert.equal(dup.status, 409);
  assert.equal(err(dup), "E-AI-DUPLICATE");
});

/* ══════════════════ AI-4 — دفتر پرسش و پاسخ ══════════════════ */

test("AI-4: هر پرسش با منبع دادهٔ خودش ثبت می‌شود — حتی برای پرسشگر بی‌مجوز تاریخچه", async () => {
  const list = await ai("GET", "/history", { user: "u-pmo" });
  assert.equal(list.status, 200);
  const items = data(list).items;
  assert.ok(items.length >= 4, "پرسش‌های این آزمون ثبت شده‌اند");
  const ask = items.find((i) => i.tool === "top_risks" && i.state === "answered");
  assert.ok(ask, "پرسش ریسک در دفتر هست");
  assert.equal(ask.question.includes("ریسک"), true);
  const restrictedItem = items.find((i) => i.state === "restricted");
  assert.ok(restrictedItem, "پرسش بی‌مجوز هم با وضعیت restricted ثبت می‌شود");
  assert.equal(restrictedItem.actor, "u-qc");

  const one = await ai("GET", `/history/${ask.code}`, { user: "u-pmo" });
  assert.equal(one.status, 200);
  const body = data(one);
  assert.equal(body.table.rows.length, 2);
  assert.equal(body.sources[0].table, "Risk");
  assert.equal(body.modelVersion, "ai-assistant-v1");
  assert.match(body.note, /snapshot/);

  const denied = await ai("GET", "/history", { user: "u-pm" });
  assert.equal(denied.status, 403);
  assert.equal(err(denied), "E-AI-FORBIDDEN");
});

test("AI: جدول دفتر از CRUD عمومی و ورود Excel بسته است", async () => {
  const generic = await call("GET", "/api/data/AiInteraction", { user: "u-pmo" });
  assert.equal(generic.status, 403);
  assert.equal(err(generic), "TABLE_HAS_DEDICATED_API");
  assert.match(generic.json.error.route, /api\/ai/);
});

/* ══════════════════ سرویس بیرونی: بازنویسی اختیاری و صادقانه ══════════════════ */

test("AI: نبود کلید سرویس، پرسش را نمی‌شکند و متن سرور می‌ماند", async () => {
  const r = await ai("POST", "/ask", { user: "u-pm", body: { tool: "top_risks", params: { limit: 2 }, provider: "deepseek", narrate: true } });
  assert.equal(r.status, 200);
  const body = data(r);
  assert.equal(body.section.state, "answered");
  assert.equal(body.narration, null);
  assert.equal(body.narratedBy, null);
  assert.match(body.narrationNote, /کلید|اعتبار|تنظیم/);

  const rule = await ai("POST", "/ask", { user: "u-pm", body: { tool: "top_risks", params: { limit: 2 }, provider: "rule", narrate: true } });
  assert.equal(rule.status, 200);
  assert.match(data(rule).narrationNote, /قاعده‌محور/);
});
