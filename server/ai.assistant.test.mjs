/**
 * P10 — آزمون واحد موتور دستیار هوشمند (`server/aiAssistantLogic.js`) و
 * بستهٔ اسکیما/RBAC همین مرحله.
 *
 * این‌جا مرزها سنجیده می‌شوند: پارامتر بیرون از فهرست سفید، پرسش بی‌نگاشت،
 * منبع بسته، دادهٔ نابسنده و خروجی بستهٔ عملگرها؛ چون این‌ها جایی‌اند که
 * «پاسخ ساختگی» می‌تواند از آن‌ها بیرون بیاید.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA, MIGRATIONS, validateSchema } from "./sqlLogic.js";
import { PERMISSION_CATALOG, ROLE_CATALOG, DEMO_SUBJECTS, evaluate } from "./rbacLogic.js";
import {
  AI_ASSISTANT_MODEL,
  AI_SOURCES,
  AI_TOOLS,
  allowedTools,
  buildDatasetSpec,
  daysBetween,
  isToolKey,
  narrationInstructions,
  narrationInput,
  normalizeToolParams,
  routeQuestion,
  runBriefing,
  runTool,
  sectionToCsv,
  sectionToMarkdown,
  toolByKey,
  AiError,
  sourceByKey,
} from "./aiAssistantLogic.js";
import { RB_DATASETS, normalizeSpec } from "./rptBuilderLogic.js";

const today = new Date().toISOString().slice(0, 10);
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const ctx = (loaded = [], restricted = []) => ({ projectId: "c1-p1", today, nowIso: new Date().toISOString(), lang: "fa", loaded, restricted });
const subject = (id) => DEMO_SUBJECTS.find((u) => u.id === id);
const canFor = (id) => (p) => evaluate(subject(id), p, { projectId: "c1-p1" }).allow;

/* ══════════════════ اسکیما و مهاجرت ══════════════════ */

test("P10: جدول دفتر پرسش‌وپاسخ با مهاجرت ۰۰۴۵ در اسکیما هست", () => {
  const table = SCHEMA.find((t) => t.name === "AiInteraction");
  assert.ok(table, "AiInteraction در اسکیما نیست");
  assert.equal(table.module, "core");
  const unique = (table.indexes ?? []).find((i) => i.unique);
  assert.deepEqual(unique?.columns, ["ProjectId", "Code"]);
  const migration = MIGRATIONS.find((m) => m.version === "0045");
  assert.ok(migration, "مهاجرت ۰۰۴۵ نیست");
  assert.ok(migration.statements.some((sql) => sql.includes("AiInteraction")));
  assert.deepEqual(validateSchema(), []);
});

test("P10: کلید مجوزها با قالب domain.resource.action می‌خواند", () => {
  for (const code of ["ai.assistant.ask", "ai.insight.view", "ai.history.view", "ai.export.run"]) {
    const def = PERMISSION_CATALOG.find((p) => p.code === code);
    assert.ok(def, `${code} در کاتالوگ نیست`);
  }
  const touches = Object.fromEntries(
    ["ai.assistant.ask", "ai.insight.view", "ai.history.view", "ai.export.run"].map((code) => [code, PERMISSION_CATALOG.find((p) => p.code === code)?.touches]),
  );
  assert.deepEqual(touches, {
    "ai.assistant.ask": "internal",
    "ai.insight.view": "internal",
    "ai.history.view": "confidential",
    "ai.export.run": "confidential",
  });
  /* شمار نقش‌ها در کاتالوگ مرکزی نگه داشته می‌شود؛ این آزمون پیش‌تر روی ۲۱
   * مانده بود در حالی که کاتالوگ ۲۸ نقش داشت (همان عددی که rbac.test.mjs
   * بررسی می‌کند). با افزودن هفت نقش بخش ۳ (نگهداری و تعمیرات) شمار به ۳۵
   * رسید: maintenance_manager, maintenance_planner, reliability_engineer,
   * maintenance_engineer, maintenance_technician, maintenance_storekeeper,
   * condition_monitoring_analyst. همان الگویی که برای هفت نقش تولیدی (mfg)
   * به کار رفت. */
  assert.equal(ROLE_CATALOG.length, 35);
});

/* ══════════════════ منابع و ابزارها ══════════════════ */

test("P10: هر منبع فقط‌خواندنی به جدول واقعی اسکیما وصل است", () => {
  assert.equal(AI_SOURCES.length, 14);
  assert.equal(new Set(AI_SOURCES.map((s) => s.key)).size, AI_SOURCES.length);
  for (const source of AI_SOURCES) {
    assert.ok(SCHEMA.some((t) => t.name === source.table), `جدول ${source.table} در اسکیما نیست`);
    assert.ok(source.permissions.length > 0, `منبع ${source.key} مجوز پایه ندارد`);
    for (const p of source.permissions) assert.ok(PERMISSION_CATALOG.some((x) => x.code === p), `${p} در کاتالوگ نیست`);
  }
});

test("P10: ابزارها بسته‌اند و فهرست مجاز هر کاربر از RBAC می‌آید", () => {
  assert.equal(AI_TOOLS.length, 6);
  for (const tool of AI_TOOLS) {
    assert.ok(isToolKey(tool.key));
    assert.ok(tool.permissions.length > 0);
    for (const p of tool.permissions) assert.ok(PERMISSION_CATALOG.some((x) => x.code === p));
    for (const s of tool.sources) assert.ok(sourceByKey(s), `منبع ${s} ابزار ${tool.key} ناشناخته است`);
  }
  const pmo = allowedTools(canFor("u-pmo")).map((t) => t.key);
  assert.deepEqual(pmo.sort(), ["bottlenecks", "briefing", "dataset_query", "delays", "forecast", "top_risks"]);
  const qc = allowedTools(canFor("u-qc")).map((t) => t.key);
  assert.equal(qc.includes("top_risks"), false, "QC مجوز ریسک ندارد");
  assert.equal(qc.includes("briefing"), true, "خلاصهٔ وضعیت برای بینندهٔ برنامه باز است");
  const sub = allowedTools(canFor("u-sub")).map((t) => t.key);
  assert.equal(sub.includes("dataset_query"), false, "پیمانکار مجوز گزارش سفارشی ندارد");
  assert.equal(sub.includes("briefing"), true);
  assert.deepEqual(allowedTools(canFor("u-admin")), [], "مدیر سامانه مجوز دادهٔ کسب‌وکار ندارد؛ دستیار درِ پشتی نیست");
  assert.deepEqual(allowedTools(canFor("u-left")), [], "کاربر غیرفعال ابزاری نمی‌بیند");
});

/* ══════════════════ پارامترها ══════════════════ */

test("P10: پارامتر بیرون از فهرست سفید و مقدار نامعتبر ۴۰۰ می‌دهد", () => {
  assert.deepEqual(normalizeToolParams("top_risks", {}), { limit: 5, status: "open" });
  assert.deepEqual(normalizeToolParams("delays", { category: "delivery", limit: 3 }), { limit: 3, category: "delivery" });
  for (const [tool, params] of [
    ["top_risks", { sql: "1=1" }],
    ["top_risks", { status: "deleted" }],
    ["top_risks", { limit: 999 }],
    ["delays", { category: "unknown" }],
    ["shell", {}],
    ["shell", { limit: 1 }],
  ]) {
    assert.throws(() => normalizeToolParams(tool, params), (e) => e instanceof AiError, `${tool} ${JSON.stringify(params)}`);
  }
  assert.throws(() => normalizeToolParams("top_risks", { sql: "1=1" }), (e) => e.code === "E-AI-PARAM");
  assert.throws(() => normalizeToolParams("shell", { limit: 1 }), (e) => e.code === "E-AI-TOOL");
  /* مشخصات پرسش داده را موتور گزارش اعتبارسنجی می‌کند (RbError) و API آن را
   * به ۴۰۰ E-AI-PARAM ترجمه می‌کند؛ پس این‌جا فقط «رد شدن» با کد گزارش سنجیده می‌شود. */
  assert.throws(
    () => normalizeToolParams("dataset_query", { spec: { dataset: "payroll" } }),
    (e) => String(e.code).startsWith("E-RPT-"),
  );
  assert.throws(
    () => normalizeToolParams("dataset_query", { spec: { dataset: "purchase_orders", filters: [{ column: "Amount", op: "sql", value: "1=1" }] } }),
    (e) => String(e.code).startsWith("E-RPT-"),
  );
});

/* ══════════════════ مسیریابی پرسش ══════════════════ */

test("P10: پرسش‌های فارسی به ابزار درست نگاشت می‌شوند", () => {
  const cases = [
    ["بالاترین ریسک‌های پروژه کدام‌اند؟", "top_risks"],
    ["بیشترین تأخیرها کجاست؟", "delays"],
    ["با این نرخ، کار کی تمام می‌شود؟", "forecast"],
    ["گلوگاه‌های اصلی کجاست؟", "bottlenecks"],
    ["خلاصهٔ وضعیت پروژه", "briefing"],
  ];
  for (const [question, tool] of cases) {
    const r = routeQuestion(question);
    assert.equal(r.matched, true, question);
    assert.equal(r.tool, tool, question);
  }
});

test("P10: پرسش بی‌نگاشت و پرسش خالی پاسخ ساختگی نمی‌گیرند", () => {
  const empty = routeQuestion("   ");
  assert.equal(empty.matched, false);
  assert.equal(empty.reason, "empty_question");
  const noMatch = routeQuestion("امروز هوا در تهران چگونه است؟");
  assert.equal(noMatch.matched, false);
  assert.equal(noMatch.reason, "no_match");
  assert.ok(noMatch.suggestions.length > 0);
  assert.match(noMatch.detailFa, /ساختگی/);
});

test("P10: مجموعه‌دادهٔ نام‌برده‌شده ولی بی‌مجوز «محدود» اعلام می‌شود، نه «نمی‌دانم»", () => {
  const r = routeQuestion("سفارش‌های خرید به تفکیک وضعیت", { allowedDatasets: ["documents", "risks"] });
  assert.equal(r.matched, false);
  assert.equal(r.reason, "restricted");
  assert.equal(r.dataset, "purchase_orders");
  assert.match(r.detailFa, /مجوز/);
  const ok = routeQuestion("سفارش‌های خرید به تفکیک وضعیت", { allowedDatasets: ["purchase_orders"] });
  assert.equal(ok.matched, true);
  assert.equal(ok.tool, "dataset_query");
  assert.equal(ok.params.spec.dataset, "purchase_orders");
});

test("P10: پرسش گروه‌بندی‌شده، مشخصات معتبر می‌سازد و از موتور RPT-1 می‌گذرد", () => {
  const spec = buildDatasetSpec("purchase_orders", "سفارش‌های خرید به تفکیک وضعیت را نشان بده");
  assert.equal(spec.dataset, "purchase_orders");
  assert.equal(spec.group?.by, "Status");
  assert.deepEqual(normalizeSpec(spec), spec, "مشخصات ساخته‌شده با موتور گزارش یکی است");
  const sum = buildDatasetSpec("purchase_orders", "جمع مبلغ سفارش‌های خرید چقدر است؟");
  assert.ok(sum.fields.includes("Amount"));
  for (const dataset of RB_DATASETS) {
    const s = buildDatasetSpec(dataset.key, `وضعیت ${dataset.label.fa} را نشان بده`);
    assert.equal(s.dataset, dataset.key);
  }
});

/* ══════════════════ اجرای ابزارها ══════════════════ */

test("P10: دادهٔ خالی «صفرِ صادق» می‌دهد نه عدد ساختگی", () => {
  const empty = {};
  assert.equal(runTool("top_risks", { limit: 5, status: "open" }, empty, ctx()).state, "empty");
  assert.equal(runTool("delays", { limit: 8, category: "all" }, empty, ctx()).state, "empty");
  assert.equal(runTool("bottlenecks", { limit: 6 }, empty, ctx()).state, "empty");
  const forecast = runTool("forecast", {}, empty, ctx());
  assert.equal(forecast.state, "insufficient");
  assert.equal(forecast.table, null);
});

test("P10: منبع بسته هرگز صفر فرض نمی‌شود", () => {
  const restricted = runTool("top_risks", { limit: 5, status: "open" }, {}, ctx([], ["risk"]));
  assert.equal(restricted.state, "restricted");
  assert.equal(restricted.table, null);
  assert.equal(restricted.sources[0].restricted, true);
  assert.match(restricted.textFa, /مجوز/);
  const partial = runTool("delays", { limit: 8, category: "all" }, { activity: [{ Id: "a1", Code: "A1", NameFa: "x", PlannedFinish: day(-5), PhysicalPct: 10 }] }, ctx(["activity"], ["po", "inspection", "dpr", "action"]));
  assert.equal(partial.state, "answered");
  assert.equal(partial.sources.find((s) => s.table === "PurchaseOrder").restricted, true);
  assert.ok(partial.limits.some((l) => l.fa.includes("بسته‌شده")), "محدودیت منابع بسته اعلام می‌شود");
});

test("P10: پیش‌بینی فقط با دو ثبت پذیرفته‌شده در بازهٔ ≥۷ روز و نرخ مثبت عدد می‌سازد", () => {
  const entries = (pct1, pct2, span) => ({
    progress: [
      { ActivityId: "a1", EntryDate: day(-span), PhysicalPct: pct1, AcceptedIntoEv: true },
      { ActivityId: "a1", EntryDate: day(-1), PhysicalPct: pct2, AcceptedIntoEv: true },
    ],
    activity: [{ Id: "a1", Code: "A1", PhysicalPct: pct2, PlannedFinish: day(30), BudgetCost: 100 }],
  });
  assert.equal(runTool("forecast", {}, entries(20, 40, 10), ctx(["progress", "activity"])).state, "answered");
  assert.equal(runTool("forecast", {}, entries(20, 40, 3), ctx(["progress", "activity"])).state, "insufficient", "بازهٔ کوتاه");
  assert.equal(runTool("forecast", {}, entries(40, 20, 10), ctx(["progress", "activity"])).state, "insufficient", "نرخ منفی");
  const raw = { progress: [{ ActivityId: "a1", EntryDate: day(-10), PhysicalPct: 5, AcceptedIntoEv: false }, { ActivityId: "a1", EntryDate: day(-1), PhysicalPct: 9, AcceptedIntoEv: false }], activity: [] };
  assert.equal(runTool("forecast", {}, raw, ctx(["progress", "activity"])).state, "insufficient", "ثبت پذیرفته‌نشده خوانده نمی‌شود");
});

test("P10: رتبه‌بندی ریسک با احتمال×شدت است و ریسک بسته رتبه نمی‌گیرد", () => {
  const data = {
    risk: [
      { Code: "R-1", TitleFa: "کم", Probability: 1, Impact: 2, Status: "open" },
      { Code: "R-2", TitleFa: "زیاد", Probability: 5, Impact: 4, Status: "open" },
      { Code: "R-3", TitleFa: "بسته", Probability: 5, Impact: 5, Status: "closed" },
    ],
  };
  const section = runTool("top_risks", { limit: 5, status: "open" }, data, ctx(["risk"]));
  assert.equal(section.table.rows.length, 2);
  assert.equal(section.table.rows[0][0], "R-2");
  assert.equal(section.table.rows[0][2], 20);
  const all = runTool("top_risks", { limit: 5, status: "all" }, data, ctx(["risk"]));
  assert.equal(all.table.rows[0][0], "R-3");
});

test("P10: خلاصهٔ وضعیت بخش بی‌مجوز را restricted می‌آورد", () => {
  const can = canFor("u-qc");
  const sections = runBriefing({}, ctx([], ["risk", "activity", "progress"]), can);
  assert.equal(sections.length, 4);
  const risk = sections.find((s) => s.key === "top_risks");
  assert.equal(risk.state, "restricted");
  const schedule = sections.find((s) => s.key === "delays");
  assert.notEqual(schedule.state, "restricted", "QC برنامه را می‌بیند");
});

/* ══════════════════ خروجی ══════════════════ */

test("P10: CSV و سند Markdown منبع داده و محدودیت‌ها را همراه می‌برند", () => {
  const section = runTool(
    "top_risks",
    { limit: 5, status: "open" },
    { risk: [{ Code: "R-1", TitleFa: "خط, با کاما", Probability: 5, Impact: 5, Status: "open" }] },
    ctx(["risk"]),
  );
  const csv = sectionToCsv(section);
  assert.match(csv, /"خط, با کاما"/, "کاما در سلول فرار داده می‌شود");
  assert.match(csv, /Risk/);
  const md = sectionToMarkdown({ question: "ریسک‌ها", section, createdAt: "2026-09-28T00:00:00Z", actor: "u-pm", modelVersion: AI_ASSISTANT_MODEL, code: "AI-0001" });
  assert.match(md, /AI-0001/);
  assert.match(md, /## منبع داده/);
  assert.match(md, /## محدودیت‌ها/);
});

test("P10: دستور بازنویسی هرگونه تغییر عدد را ممنوع می‌کند و ورودی فقط دادهٔ همان پاسخ است", () => {
  const instructions = narrationInstructions();
  assert.match(instructions, /هیچ عددی را تغییر نده/);
  assert.match(instructions, /عدد تازه نساز/);
  const section = runTool("top_risks", { limit: 5, status: "open" }, { risk: [{ Code: "R-1", TitleFa: "x", Probability: 5, Impact: 5, Status: "open" }] }, ctx(["risk"]));
  const input = JSON.parse(narrationInput(section));
  assert.equal(input.facts.length, section.facts.length);
  assert.deepEqual(input.sources, [{ table: "Risk", rows: 1 }]);
  assert.equal(JSON.stringify(input).includes("bom"), false);
});

test("P10: ابزار ناشناخته و briefing از مسیر runTool خطا می‌دهد", () => {
  assert.throws(() => runTool("briefing", {}, {}, ctx()), (e) => e.code === "E-AI-TOOL");
  assert.throws(() => runTool("shell", {}, {}, ctx()), (e) => e.code === "E-AI-TOOL");
  assert.equal(daysBetween("2026-09-01", "2026-09-11"), 10);
  assert.equal(daysBetween("", "2026-09-11"), null);
  assert.equal(toolByKey("top_risks")?.kind, "insight");
});
