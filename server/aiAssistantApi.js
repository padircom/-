/**
 * P10 — دستیار هوشمند (AI-1..AI-4) — سرور.
 * ---------------------------------------------------------------
 * مسیر: /api/ai/:projectId
 *   GET    /workspace                 ابزارهای مجاز + تاریخچهٔ کوتاه + can
 *   POST   /ask                       پرسش محاوره‌ای (ابزار بسته، فقط‌خواندنی)
 *   GET    /insights                  بینش‌های آماده (ریسک، تأخیر، پیشرفت، گلوگاه)
 *   GET    /history                   دفتر پرسش و پاسخ (AI-4)
 *   GET    /history/:code             یک پرسش و پاسخ با منبع داده‌اش
 *   GET    /history/:code/export      خروجی CSV یا سند Markdown (AI-3)
 *   POST   /history/:code/template    تبدیل پاسخ داده‌ای به قالب گزارش سفارشی
 *
 * قواعد:
 *  - هیچ ابزاری نمی‌نویسد؛ دادهٔ کسب‌وکار فقط خوانده می‌شود.
 *  - هر ابزار مجوز پایهٔ خودش را می‌خواهد و هر منبع داده دروازهٔ مجوز
 *    مستقل دارد؛ منبع بسته خوانده نمی‌شود و در پاسخ «بسته» اعلام می‌شود.
 *  - پاسخ عددی را همین سرور می‌سازد. سرویس هوش مصنوعی بیرونی (اگر
 *    پیکربندی شده باشد) فقط *بازنویسی* متن را انجام می‌دهد و کلیدش
 *    هرگز ذخیره، برگردانده یا در ممیزی نوشته نمی‌شود.
 *  - جدول AiInteraction از CRUD عمومی و ورود Excel بسته است.
 */
import {
  AI_ASSISTANT_MODEL,
  AI_TOOLS,
  AI_SOURCES,
  sourceByKey,
  toolByKey,
  isToolKey,
  allowedTools,
  normalizeToolParams,
  runTool,
  runBriefing,
  routeQuestion,
  sectionToCsv,
  sectionToMarkdown,
  narrationInstructions,
  narrationInput,
  AiError,
} from "./aiAssistantLogic.js";
import { RB_DATASETS, datasetByKey, normalizeSpec } from "./rptBuilderLogic.js";
import * as aiLogic from "./aiLogic.js";

export const AI_TABLES = ["AiInteraction"];

/** جدول دفتر پرسش‌وپاسخ و مسیر اختصاصی‌اش. */
export const AI_DEDICATED_ROUTES = {
  AiInteraction: "/api/ai/:projectId/history",
};

const PROJECT_RE = /^[A-Za-z0-9_-]{1,50}$/;
const MAX_SOURCE_ROWS = 5000;
const MAX_QUESTION = 500;
/** سقف snapshot تاریخی؛ فراتر از آن «بریده» ثبت می‌شود، نه کامل. */
const SNAPSHOT_ROWS = 200;
const SNAPSHOT_BYTES = 60_000;
const HISTORY_LIST = 300;
const BODY_FIELDS = ["question", "tool", "params", "lang", "provider", "narrate", "secret"];
const CREATE_FIELDS = ["Code", "TitleFa", "NoteFa"];

class AiApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new AiApiError(400, code, message, extra);
const conflict = (code, message, extra) => new AiApiError(409, code, message, extra);
const notFound = (message) => new AiApiError(404, "E-AI-NOT-FOUND", message);

export function registerAiAssistantRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app) throw new Error("registerAiAssistantRoutes: app is required");
  const base = "/api/ai/:projectId";

  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
  const fail = (req, res, err) => {
    if (err instanceof AiApiError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    if (err instanceof AiError) return res.status(400).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
    /* مشخصات بیرون از بستهٔ موتور گزارش، خطای پارامتر دستیار است، نه خطای
     * داخلی. مقایسه با instanceof اینجا کار نمی‌کند: کلاس RbError از باندل
     * aiAssistantLogic می‌آید و با نمونهٔ rptBuilderLogic یکی نیست. */
    if (String(err?.code ?? "").startsWith("E-RPT-") || err?.name === "RbError") {
      return res.status(400).json({ ok: false, error: { code: "E-AI-PARAM", message: err.message, traceId: req.requestId } });
    }
    if (err?.code === "ROW_VALIDATION_FAILED") return res.status(400).json({ ok: false, error: { code: "E-AI-VALIDATION", message: err.message, traceId: req.requestId } });
    if (err?.code === "UNIQUE_VIOLATION" || err?.code === "DUPLICATE_KEY") return res.status(409).json({ ok: false, error: { code: "E-AI-DUPLICATE", message: "کد پرسش تکراری است؛ دوباره تلاش کنید", traceId: req.requestId } });
    console.error("[%s] ai error:", req.requestId, err);
    return res.status(500).json({ ok: false, error: { code: "E-AI-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects?.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
  const allows = (subject, permission, pid) => Boolean(subject) && evaluate(subject, permission, { projectId: pid }).allow;
  const canOf = (req) => (permission) => allows(subjectOf(req), permission, req.params.projectId);
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-AI-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    const wanted = Array.isArray(permission) ? permission : [permission];
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-AI-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر و فعال الزامی است", permission: wanted.join("|"), traceId: req.requestId } });
    }
    if (!wanted.some((p) => allows(subject, p, req.params.projectId))) {
      return res.status(403).json({ ok: false, error: { code: "E-AI-FORBIDDEN", message: "مجوز این اقدام یا دسترسی به این پروژه را ندارید", permission: wanted.join("|"), traceId: req.requestId } });
    }
    return next();
  };
  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      if (!r) throw new AiApiError(503, "E-AI-NO-STORE", "لایهٔ ماندگاری در دسترس نیست");
      await handler(req, res, r, req.params.projectId);
    } catch (err) {
      fail(req, res, err);
    }
  };
  const audit = async (r, req, action, details) => {
    try {
      await r.create("AuditLog", {
        At: new Date().toISOString(),
        SubjectId: actor(req),
        Action: action,
        ProjectCode: req.params.projectId,
        EntityName: details.entityName ?? "AiInteraction",
        EntityId: details.entityId ?? null,
        Severity: details.severity ?? "info",
        Details: { traceId: req.requestId, ...details },
      }, actor(req));
    } catch {
      console.error("[%s] ai audit failed %s", req.requestId, action);
    }
  };
  const bodyOf = (req) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw bad("E-AI-BODY", "بدنهٔ JSON لازم است");
    const foreign = Object.keys(body).find((k) => !BODY_FIELDS.includes(k));
    if (foreign) throw bad("E-AI-FIELD", `فیلد قابل نوشتن نیست: ${foreign}`);
    return body;
  };
  const jsonOf = (v, fallback) => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === "object") return v;
    try {
      return JSON.parse(String(v));
    } catch {
      return fallback;
    }
  };

  /** منابع و مجموعه‌داده‌های موردنیاز یک ابزار، تفکیک‌شده به مجاز/بسته. */
  const planFor = (req, toolKey, params) => {
    const tool = toolByKey(toolKey);
    const subject = subjectOf(req);
    const loaded = [];
    const restricted = [];
    if (toolKey === "dataset_query") {
      const dataset = datasetByKey(params.spec.dataset);
      if (!dataset) throw bad("E-AI-DATASET", `مجموعه‌دادهٔ «${String(params.spec.dataset)}» شناخته‌شده نیست`);
      const okDataset = dataset.permissions.some((p) => allows(subject, p, req.params.projectId));
      if (!okDataset) {
        throw new AiApiError(403, "E-AI-DATASET-FORBIDDEN", `مجوز خواندن مجموعه‌دادهٔ «${dataset.label.fa}» را ندارید`, { permission: dataset.permissions.join("|") });
      }
      return { tool, loaded, restricted, dataset };
    }
    for (const key of tool.sources) {
      const def = sourceByKey(key);
      if (!def) continue;
      if (def.permissions.some((p) => allows(subject, p, req.params.projectId))) loaded.push(key);
      else restricted.push(key);
    }
    return { tool, loaded: [...new Set(loaded)], restricted: [...new Set(restricted)], dataset: null };
  };

  const loadData = async (r, pid, plan, params) => {
    const data = {};
    for (const key of plan.loaded) {
      const def = sourceByKey(key);
      const rows = await r.list(def.table, { where: byProject(pid), limit: MAX_SOURCE_ROWS + 1 });
      if (rows.length > MAX_SOURCE_ROWS) {
        throw conflict("E-AI-TOO-LARGE", `بیش از ${MAX_SOURCE_ROWS} ردیف در «${def.label.fa}»؛ پاسخ ناقص ساخته نمی‌شود`, { table: def.table });
      }
      data[key] = rows;
    }
    if (plan.dataset) {
      const rows = await r.list(plan.dataset.table, { where: byProject(pid), limit: MAX_SOURCE_ROWS + 1 });
      if (rows.length > MAX_SOURCE_ROWS) {
        throw conflict("E-AI-TOO-LARGE", `بیش از ${MAX_SOURCE_ROWS} ردیف در «${plan.dataset.label.fa}»؛ پاسخ ناقص ساخته نمی‌شود`, { table: plan.dataset.table });
      }
      data[`dataset:${plan.dataset.key}`] = rows;
    }
    return data;
  };

  const contextOf = (req) => {
    const now = new Date();
    return {
      projectId: req.params.projectId,
      today: now.toISOString().slice(0, 10),
      nowIso: now.toISOString(),
      lang: "fa",
    };
  };

  /** کد بعدی دفتر؛ با کد تکراری یک بار دوباره تلاش می‌شود. */
  const nextCode = async (r, pid) => {
    const rows = await r.list("AiInteraction", { where: byProject(pid), limit: HISTORY_LIST });
    let max = 0;
    for (const row of rows) {
      const m = /^AI-(\d+)$/.exec(String(row.Code ?? ""));
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `AI-${String(max + 1).padStart(4, "0")}`;
  };

  const snapshotOf = (section) => {
    if (!section || !section.table) return { table: null, truncated: false };
    const rows = section.table.rows.slice(0, SNAPSHOT_ROWS);
    let candidate = { ...section.table, rows, truncated: section.table.truncated || rows.length < section.table.rows.length };
    while (JSON.stringify(candidate).length > SNAPSHOT_BYTES && candidate.rows.length > 10) {
      candidate = { ...candidate, rows: candidate.rows.slice(0, Math.floor(candidate.rows.length / 2)), truncated: true };
    }
    return { table: candidate, truncated: candidate.truncated };
  };

  const logInteraction = async (r, req, { question, tool, params, section, provider, narration, latencyMs, state }) => {
    const { table, truncated } = snapshotOf(section);
    const row = {
      ProjectId: req.params.projectId,
      Code: await nextCode(r, req.params.projectId),
      QuestionFa: String(question ?? "").slice(0, MAX_QUESTION),
      Tool: String(tool ?? "no_match"),
      State: state ?? (section ? section.state : "no_match"),
      ParamsJson: params ?? null,
      AnswerFa: String(section?.textFa ?? "").slice(0, 4000),
      FactsJson: section?.facts ?? [],
      TableJson: table,
      ChartJson: section?.chart ?? null,
      SourcesJson: section?.sources ?? [],
      RowCount: table?.rows.length ?? 0,
      Truncated: Boolean(truncated),
      Provider: provider ?? null,
      NarrationFa: narration ? String(narration).slice(0, 4000) : null,
      LatencyMs: latencyMs ?? null,
      ActorId: actor(req),
      ModelVersion: AI_ASSISTANT_MODEL,
    };
    try {
      const created = await r.create("AiInteraction", row, actor(req), "aiq");
      return created;
    } catch (err) {
      if (err?.code === "UNIQUE_VIOLATION" || err?.code === "DUPLICATE_KEY") {
        row.Code = `AI-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        return r.create("AiInteraction", row, actor(req), "aiq");
      }
      throw err;
    }
  };

  /**
   * بازنویسی اختیاری متن پاسخ با سرویس هوش مصنوعی.
   * عدد از همین متن می‌آید؛ خروجی مدل فقط «روایت» است و در صورت خطا
   * پرسش شکست نمی‌خورد — متن سرور همیشه وجود دارد.
   */
  const narrate = async (req, body, section) => {
    const providerId = String(body.provider || "").trim();
    if (!providerId || providerId === "server" || body.narrate === false) return { narration: null, provider: null, note: null };
    if (providerId === "rule") return { narration: null, provider: null, note: "موتور قاعده‌محور بازنویسی نمی‌کند؛ متن سرور نمایش داده می‌شود." };
    const alias = { mock: "rule", local: "rule" };
    const id = alias[providerId] || providerId;
    const secret = String(req.headers["x-ai-key"] || body.secret || process.env.AI_API_KEY || "");
    const check = aiLogic.checkCredential({ provider: id, mode: "api_key", secret });
    if (!check.ok) return { narration: null, provider: null, note: check.messageFa || "اعتبار سرویس بازنویسی تنظیم نشده است." };
    const wire = aiLogic.buildWireRequest(
      { provider: id, mode: "api_key", secret },
      { instructions: narrationInstructions(), input: narrationInput(section), maxOutputTokens: 700 },
      { url: process.env.AI_RESPONSES_URL || undefined, model: process.env.AI_MODEL || undefined },
    );
    try {
      const upstream = await fetch(wire.url, { method: "POST", headers: wire.headers, body: wire.body });
      if (!upstream.ok) {
        const kind = aiLogic.classifyHttpFailure(upstream.status);
        return { narration: null, provider: null, note: aiLogic.failureMessageFa(kind, id) };
      }
      const payload = await upstream.json();
      const out = aiLogic.extractText(id, payload);
      return out ? { narration: out, provider: id, note: null } : { narration: null, provider: null, note: "سرویس بازنویسی پاسخ متنی برنگرداند." };
    } catch {
      return { narration: null, provider: null, note: "اتصال به سرویس بازنویسی برقرار نشد؛ متن محاسبه‌شدهٔ سرور نمایش داده می‌شود." };
    }
  };

  /** اجرای یک پرسش با ابزار صریح یا مسیریابی پرسش آزاد. */
  const runAsk = async (r, req, body) => {
    const can = canOf(req);
    const tools = allowedTools(can);
    const allowedToolKeys = tools.map((t) => t.key);
    const allowedDatasetKeys = RB_DATASETS.filter((d) => d.permissions.some((p) => can(p))).map((d) => d.key);
    const question = String(body.question ?? "").trim();
    let toolKey = body.tool === undefined || body.tool === null || body.tool === "" ? null : String(body.tool);
    let params;
    let matchedKeywords = [];
    let routeNote = null;
    if (toolKey) {
      if (!isToolKey(toolKey)) throw bad("E-AI-TOOL", `ابزار «${toolKey}» شناخته‌شده نیست`);
      const def = toolByKey(toolKey);
      if (!def.permissions.some((p) => can(p))) {
        throw new AiApiError(403, "E-AI-TOOL-FORBIDDEN", `مجوز اجرای ابزار «${def.label.fa}» را ندارید`, { permission: def.permissions.join("|") });
      }
      if (toolKey === "briefing") throw bad("E-AI-TOOL", "برای خلاصهٔ وضعیت از مسیر /insights استفاده کنید");
      params = normalizeToolParams(toolKey, body.params ?? {});
    } else {
      const routed = routeQuestion(question, { allowedTools: allowedToolKeys, allowedDatasets: allowedDatasetKeys });
      if (!routed.matched) {
        return { unmatched: routed, question, tools, allowedDatasetKeys };
      }
      toolKey = routed.tool;
      params = routed.params;
      matchedKeywords = routed.matchedKeywords;
      routeNote = routed.dataset ? `مجموعه‌داده: ${routed.dataset}` : null;
    }
    if (toolKey === "dataset_query" && !question) {
      throw bad("E-AI-QUESTION", "برای پرسش از داده، متن پرسش لازم است");
    }
    const plan = planFor(req, toolKey, params);
    const data = await loadData(r, req.params.projectId, plan, params);
    const ctx = { ...contextOf(req), loaded: plan.loaded, restricted: plan.restricted };
    const section = runTool(toolKey, params, data, ctx);
    return { toolKey, params, section, plan, question, matchedKeywords, routeNote, tools };
  };

  /* ═══════════════ میز کار ═══════════════ */
  app.get(`${base}/workspace`, need(["ai.assistant.ask", "ai.insight.view", "ai.history.view"]), route(async (req, res, r, pid) => {
    const can = canOf(req);
    const historyRows = can("ai.history.view") ? await r.list("AiInteraction", { where: byProject(pid), limit: HISTORY_LIST }) : [];
    historyRows.sort((a, b) => String(b.CreatedAt ?? "").localeCompare(String(a.CreatedAt ?? "")));
    const tools = allowedTools(can).map((t) => ({
      key: t.key,
      kind: t.kind,
      label: t.label,
      hint: t.hint,
      permission: t.permissions.join(" | "),
      sources: t.sources.map((k) => sourceByKey(k)?.table ?? k),
      examples: t.examples.slice(0, 2),
    }));
    return ok(req, res, {
      projectId: pid,
      can: { ask: can("ai.assistant.ask"), insight: can("ai.insight.view"), history: can("ai.history.view"), export: can("ai.export.run") },
      tools,
      restrictedTools: AI_TOOLS.length - tools.length,
      datasets: RB_DATASETS.filter((d) => d.permissions.some((p) => can(p))).map((d) => ({ key: d.key, table: d.table, label: d.label })),
      restrictedDatasets: RB_DATASETS.filter((d) => !d.permissions.some((p) => can(p))).length,
      recent: historyRows.slice(0, 5).map((row) => ({ code: row.Code, question: row.QuestionFa, tool: row.Tool, state: row.State, at: row.CreatedAt, actor: row.ActorId })),
      metrics: {
        interactions: historyRows.length,
        byState: historyRows.reduce((acc, row) => { acc[String(row.State)] = (acc[String(row.State)] ?? 0) + 1; return acc; }, {}),
        sources: AI_SOURCES.length,
        modelVersion: AI_ASSISTANT_MODEL,
        generatedAt: new Date().toISOString(),
      },
      provider: { serverKeyConfigured: Boolean(process.env.AI_API_KEY), note: "کلید سرویس هرگز از سرور برگردانده نمی‌شود؛ بازنویسی اختیاری است و بدون اتصال هم پاسخ محاسبه‌شده موجود است." },
    });
  }));

  /* ═══════════════ پرسش محاوره‌ای ═══════════════ */
  app.post(`${base}/ask`, need("ai.assistant.ask"), route(async (req, res, r) => {
    const started = Date.now();
    const body = bodyOf(req);
    const question = String(body.question ?? "").trim();
    if (body.tool === undefined && !question) throw bad("E-AI-QUESTION", "متن پرسش لازم است");
    if (question.length > MAX_QUESTION) throw bad("E-AI-QUESTION", `پرسش حداکثر ${MAX_QUESTION} نویسه است`);
    if (body.lang !== undefined && !["fa", "en"].includes(String(body.lang))) throw bad("E-AI-FIELD", "زبان باید fa یا en باشد");
    const ran = await runAsk(r, req, body);
    if (ran.unmatched) {
      const latencyMs = Date.now() - started;
      const created = await logInteraction(r, req, { question: ran.question, tool: ran.unmatched.dataset ? "dataset_query" : "no_match", params: { reason: ran.unmatched.reason, dataset: ran.unmatched.dataset ?? null }, section: null, provider: null, narration: null, latencyMs, state: ran.unmatched.reason === "restricted" ? "restricted" : "no_match" });
      await audit(r, req, "AI_ASK_UNMATCHED", { entityId: created.Id, code: created.Code, reason: ran.unmatched.reason });
      return ok(req, res, {
        code: created.Code,
        matched: false,
        reason: ran.unmatched.reason,
        detailFa: ran.unmatched.detailFa,
        detailEn: ran.unmatched.detailEn,
        dataset: ran.unmatched.dataset ?? null,
        suggestions: ran.unmatched.suggestions,
        modelVersion: AI_ASSISTANT_MODEL,
        latencyMs,
      });
    }
    const { narration, provider, note } = await narrate(req, body, ran.section);
    const latencyMs = Date.now() - started;
    const created = await logInteraction(r, req, { question: ran.question || `(${ran.section.label.fa})`, tool: ran.toolKey, params: ran.params, section: ran.section, provider, narration, latencyMs });
    await audit(r, req, "AI_ASK", { entityId: created.Id, code: created.Code, tool: ran.toolKey, state: ran.section.state, rowCount: ran.section.table?.rows.length ?? 0 });
    return ok(req, res, {
      code: created.Code,
      question: ran.question,
      matched: true,
      tool: ran.toolKey,
      toolLabel: ran.section.label,
      params: ran.params,
      matchedKeywords: ran.matchedKeywords,
      section: ran.section,
      narration,
      narratedBy: provider,
      narrationNote: note,
      dataDate: contextOf(req).today,
      modelVersion: AI_ASSISTANT_MODEL,
      latencyMs,
    });
  }));

  /* ═══════════════ بینش‌های آماده ═══════════════ */
  app.get(`${base}/insights`, need("ai.insight.view"), route(async (req, res, r, pid) => {
    const started = Date.now();
    const can = canOf(req);
    const needed = new Set();
    for (const tool of AI_TOOLS) if (tool.key !== "briefing" && tool.key !== "dataset_query") for (const key of tool.sources) needed.add(key);
    const loaded = [];
    const restricted = [];
    for (const key of needed) {
      const def = sourceByKey(key);
      if (def.permissions.some((p) => can(p))) loaded.push(key);
      else restricted.push(key);
    }
    const data = await loadData(r, pid, { loaded, restricted, dataset: null }, {});
    const ctx = { ...contextOf(req), loaded, restricted };
    const sections = runBriefing(data, ctx, can);
    const latencyMs = Date.now() - started;
    const summary = {
      key: "briefing",
      label: toolByKey("briefing").label,
      state: sections.every((s) => s.state === "restricted") ? "restricted" : "answered",
      textFa: sections.map((s) => `• ${s.label.fa}: ${s.state === "restricted" ? "بسته (بی‌مجوز)" : s.state === "answered" ? "محاسبه شد" : s.state === "empty" ? "موردی یافت نشد" : "داده نابسنده"}`).join("\n"),
      textEn: sections.map((s) => `• ${s.label.en}: ${s.state}`).join("\n"),
      facts: sections.map((s) => ({ label: s.label, value: s.state, kind: "text" })),
      table: null,
      chart: null,
      sources: sections.flatMap((s) => s.sources).filter((s, i, arr) => arr.findIndex((x) => x.table === s.table) === i),
      limits: [],
    };
    const created = await logInteraction(r, req, { question: "خلاصهٔ وضعیت پروژه", tool: "briefing", params: {}, section: summary, provider: null, narration: null, latencyMs });
    await audit(r, req, "AI_INSIGHTS", { entityId: created.Id, code: created.Code, sections: sections.length });
    return ok(req, res, { code: created.Code, sections, dataDate: contextOf(req).today, modelVersion: AI_ASSISTANT_MODEL, latencyMs });
  }));

  /* ═══════════════ دفتر پرسش و پاسخ ═══════════════ */
  app.get(`${base}/history`, need("ai.history.view"), route(async (req, res, r, pid) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 30) || 30, 1), 100);
    const rows = await r.list("AiInteraction", { where: byProject(pid), limit: HISTORY_LIST });
    rows.sort((a, b) => String(b.CreatedAt ?? "").localeCompare(String(a.CreatedAt ?? "")));
    const filtered = req.query.tool ? rows.filter((row) => String(row.Tool) === String(req.query.tool)) : rows;
    return ok(req, res, {
      projectId: pid,
      total: rows.length,
      items: filtered.slice(0, limit).map((row) => ({
        code: row.Code, question: row.QuestionFa, tool: row.Tool, state: row.State, at: row.CreatedAt,
        actor: row.ActorId, provider: row.Provider ?? null, latencyMs: row.LatencyMs ?? null,
        sources: (jsonOf(row.SourcesJson, []) || []).map((s) => ({ table: s.table, rows: s.rows, restricted: Boolean(s.restricted) })),
      })),
      can: { export: canOf(req)("ai.export.run") },
      modelVersion: AI_ASSISTANT_MODEL,
    });
  }));

  const findInteraction = async (r, pid, code) => {
    if (!/^[A-Za-z0-9._-]{1,30}$/.test(String(code))) throw bad("E-AI-FIELD", "کد پرسش نامعتبر است");
    const row = await r.findOne("AiInteraction", [...byProject(pid), { column: "Code", op: "eq", value: code }]);
    if (!row) throw notFound("پرسش و پاسخی با این کد در این پروژه نیست");
    return row;
  };

  app.get(`${base}/history/:code`, need("ai.history.view"), route(async (req, res, r, pid) => {
    const row = await findInteraction(r, pid, req.params.code);
    return ok(req, res, {
      code: row.Code, question: row.QuestionFa, tool: row.Tool, state: row.State, at: row.CreatedAt, actor: row.ActorId,
      params: jsonOf(row.ParamsJson, null),
      answerFa: row.AnswerFa,
      facts: jsonOf(row.FactsJson, []),
      table: jsonOf(row.TableJson, null),
      chart: jsonOf(row.ChartJson, null),
      sources: jsonOf(row.SourcesJson, []),
      provider: row.Provider ?? null,
      narration: row.NarrationFa ?? null,
      latencyMs: row.LatencyMs ?? null,
      modelVersion: row.ModelVersion ?? AI_ASSISTANT_MODEL,
      note: "این رکورد snapshot همان لحظه است؛ دادهٔ پروژه ممکن است از آن زمان تغییر کرده باشد.",
    });
  }));

  app.get(`${base}/history/:code/export`, need("ai.export.run"), route(async (req, res, r, pid) => {
    const row = await findInteraction(r, pid, req.params.code);
    const format = String(req.query.format ?? "md").toLowerCase();
    if (!["md", "csv"].includes(format)) throw bad("E-AI-FIELD", "قالب خروجی باید md یا csv باشد");
    const section = {
      key: row.Tool,
      label: toolByKey(row.Tool)?.label ?? { fa: row.Tool, en: row.Tool },
      state: row.State,
      textFa: row.AnswerFa,
      textEn: row.AnswerFa,
      facts: jsonOf(row.FactsJson, []),
      table: jsonOf(row.TableJson, null),
      chart: jsonOf(row.ChartJson, null),
      sources: jsonOf(row.SourcesJson, []),
      limits: [{ fa: "خروجی از snapshot ثبت‌شده ساخته شد؛ دادهٔ جاری ممکن است متفاوت باشد.", en: "Exported from the stored snapshot; live data may differ." }],
    };
    await audit(r, req, "AI_EXPORT", { entityId: row.Id, code: row.Code, format });
    const safe = String(row.Code).replace(/[^A-Za-z0-9._-]/g, "_");
    if (format === "csv") {
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="${safe}.csv"`);
      return res.send("\uFEFF" + sectionToCsv(section));
    }
    res.setHeader("content-type", "text/markdown; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="${safe}.md"`);
    return res.send(sectionToMarkdown({ question: row.QuestionFa, section, createdAt: row.CreatedAt, actor: row.ActorId, modelVersion: row.ModelVersion ?? AI_ASSISTANT_MODEL, code: row.Code }));
  }));

  /* ═══════════════ تبدیل پاسخ داده‌ای به قالب گزارش (AI-3) ═══════════════ */
  app.post(`${base}/history/:code/template`, need(["ai.export.run", "report.custom.edit"]), route(async (req, res, r, pid) => {
    const row = await findInteraction(r, pid, req.params.code);
    if (String(row.Tool) !== "dataset_query") throw conflict("E-AI-NOT-QUERY", "فقط پاسخ‌های پرسش از داده به قالب گزارش تبدیل می‌شوند");
    const params = jsonOf(row.ParamsJson, null);
    const spec = params?.spec;
    if (!spec) throw conflict("E-AI-NOT-QUERY", "مشخصات داده‌ای این پاسخ ذخیره نشده است");
    const normalized = normalizeSpec(spec);
    const dataset = datasetByKey(normalized.dataset);
    const can = canOf(req);
    if (!dataset.permissions.some((p) => can(p))) {
      throw new AiApiError(403, "E-AI-DATASET-FORBIDDEN", `مجوز خواندن مجموعه‌دادهٔ «${dataset.label.fa}» را ندارید`, { permission: dataset.permissions.join("|") });
    }
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const foreign = Object.keys(body).find((k) => !CREATE_FIELDS.includes(k));
    if (foreign) throw bad("E-AI-FIELD", `فیلد قابل نوشتن نیست: ${foreign}`);
    const code = String(body.Code ?? `AI-${row.Code}`).trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(code)) throw bad("E-AI-FIELD", "کد قالب نامعتبر است", { field: "Code" });
    const title = String(body.TitleFa ?? (row.QuestionFa || `پاسخ ${row.Code}`)).trim();
    if (!title || title.length > 200) throw bad("E-AI-FIELD", "عنوان قالب الزامی و حداکثر ۲۰۰ نویسه است", { field: "TitleFa" });
    if (await r.findOne("RptTemplate", [...byProject(pid), { column: "Code", op: "eq", value: code }])) {
      throw conflict("E-AI-DUPLICATE", `قالب ${code} تکراری است`);
    }
    const created = await r.create("RptTemplate", {
      ProjectId: pid,
      Code: code,
      TitleFa: title,
      DatasetKey: normalized.dataset,
      FieldsJson: normalized.fields,
      FiltersJson: normalized.filters,
      GroupJson: normalized.group,
      SortJson: normalized.sort,
      ChartJson: normalized.chart,
      LimitRows: normalized.limit,
      Status: "draft",
      Version: 0,
      NoteFa: typeof body.NoteFa === "string" ? body.NoteFa.slice(0, 1000) : `ساخته‌شده از پاسخ دستیار ${row.Code}`,
      ModelVersion: "rpt-builder-v1",
    }, actor(req), "rpttpl");
    await audit(r, req, "AI_TO_TEMPLATE", { entityId: created.Id, code: created.Code, source: row.Code, dataset: normalized.dataset });
    return ok(req, res, { template: { code: created.Code, title: created.TitleFa, dataset: normalized.dataset, status: created.Status, version: created.Version, sourceInteraction: row.Code } }, 201);
  }));
}
