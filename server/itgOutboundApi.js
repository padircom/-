/**
 * ITG-1..3 — یکپارچه‌سازی خروجی (P9) — سرور
 * ---------------------------------------------------------------
 * مسیر پایه: /api/itg/:projectId
 *   GET  /workspace            وضعیت اتصال‌دهنده‌ها + آخرین اجراها + مجوزها
 *   GET  /xer                  خروجی XER پریماورا از دادهٔ زنده
 *   GET  /msp.xml              خروجی XML مایکروسافت پروجکت (MSPDI)
 *   GET  /calendar.ics         خروجی iCalendar (فعالیت‌ها + بازرسی‌ها)
 *   GET  /p6                   مشخصات اتصال P6 (بدون رمز) + مسیرها
 *   POST /p6/probe             آزمون واقعی اتصال به P6
 *   POST /p6/push              ارسال فعالیت‌ها به P6 (نوشتن بیرونی)
 *   POST /mpp/inspect          بازرسی صادقانهٔ ظرف .mpp
 *   POST /exchange/send        فرستادن دعوت تقویم با Graph/EWS
 *   GET  /runs                 دفتر اجرای اتصال‌دهنده‌ها
 *
 * قواعد:
 *  - هیچ «موفق»ی بی‌شاهد ثبت نمی‌شود: هر تلاش بیرونی یک ردیف ItgConnectorRun
 *    می‌گیرد، با کد خطای دسته‌بندی‌شده و مدت اجرا.
 *  - فایل‌ها از دادهٔ زندهٔ پروژه ساخته می‌شوند؛ عدد و سطر نمونه در کد نیست.
 *  - رمز P6 هرگز برگردانده یا ثبت نمی‌شود.
 *  - `.mpp` یک ظرف دودویی است؛ سامانه ادعای خواندن آن نمی‌کند و راه جایگزین
 *    می‌دهد.
 */
import {
  ITG_OUTBOUND_MODEL,
  buildXer,
  buildMspXml,
  p6ConfigFrom,
  p6ProbePath,
  p6ActivityPath,
  buildP6ActivityPayload,
  classifyP6Error,
  inspectMppHeader,
  buildIcs,
  calendarEventsFrom,
  exchangeConfigFrom,
  buildGraphSendPayload,
  exchangeSendPath,
  base64Utf8,
} from "./itgOutboundLogic.js";

export const ITG_OUTBOUND_TABLES = ["ItgConnectorRun"];

/** دفتر اجرای اتصال‌دهنده‌ها فقط از مسیر اختصاصی خودش خوانده/نوشته می‌شود. */
export const ITG_OUTBOUND_DEDICATED_ROUTES = {
  ItgConnectorRun: "/api/itg/:projectId/runs",
};

const PROJECT_RE = /^[A-Za-z0-9_-]{1,50}$/;
const MAX_LIST = 50;
const MAX_PUSH_ACTIVITIES = 500;
const MAX_MPP_BYTES = 20 * 1024 * 1024;

class ItgError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new ItgError(400, code, message, extra);
const notFound = (message) => new ItgError(404, "E-ITG-NOT-FOUND", message);

const CONNECTOR_DEFS = [
  { key: "xer", labelFa: "خروجی XER پریماورا", permission: "itg.export.run", configured: true, direction: "out" },
  { key: "msp", labelFa: "خروجی XML مایکروسافت پروجکت", permission: "itg.export.run", configured: true, direction: "out" },
  { key: "calendar", labelFa: "خروجی تقویم (iCalendar)", permission: "itg.calendar.sync", configured: true, direction: "out" },
  { key: "p6", labelFa: "ارسال به API پریماورا P6", permission: "itg.primavera.push", configured: null, direction: "out" },
  { key: "exchange", labelFa: "همگام‌سازی Outlook/Exchange", permission: "itg.calendar.sync", configured: null, direction: "out" },
];

export function registerItgOutboundRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app) throw new Error("registerItgOutboundRoutes: app is required");

  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
  const fail = (req, res, err) => {
    if (err instanceof ItgError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    if (err?.code === "ROW_VALIDATION_FAILED") return res.status(400).json({ ok: false, error: { code: "E-ITG-VALIDATION", message: err.message, traceId: req.requestId } });
    console.error(`[${req.requestId}] itg error:`, err);
    return res.status(500).json({ ok: false, error: { code: "E-ITG-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects?.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
  const canIn = (req, permission, projectId) => {
    const subject = subjectOf(req);
    return subject ? evaluate(subject, permission, { projectId }).allow : false;
  };
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-ITG-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-ITG-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر و فعال الزامی است", permission, traceId: req.requestId } });
    }
    if (!evaluate(subject, permission, { projectId: req.params.projectId }).allow) {
      return res.status(403).json({ ok: false, error: { code: "E-ITG-FORBIDDEN", message: "مجوز این اقدام یا دسترسی به این پروژه را ندارید", permission, traceId: req.requestId } });
    }
    return next();
  };
  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      if (!r) throw new ItgError(503, "E-ITG-NO-STORE", "لایهٔ ماندگاری در دسترس نیست");
      await handler(req, res, r, req.params.projectId);
    } catch (err) {
      fail(req, res, err);
    }
  };
  const bodyOf = (req) => {
    const b = req.body;
    if (b === undefined || b === null) return {};
    if (typeof b !== "object" || Array.isArray(b)) throw bad("E-ITG-BODY", "بدنهٔ JSON لازم است");
    return b;
  };
  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  /**
   * ردیف پروژه؛ هم با شناسهٔ داخلی و هم با کد پروژه پذیرفته می‌شود.
   * نبودِ ردیف، دروغ نمی‌سازد: `source: "unresolved"` برمی‌گردد و هشدار
   * داده می‌شود تا کاربر بداند خروجی با شناسهٔ مسیر ساخته شده است، نه با
   * نام ثبت‌شدهٔ پروژه.
   */
  const projectRow = async (r, pid) => {
    const byId = await r.findOne("Project", [{ column: "Id", op: "eq", value: pid }]);
    if (byId) return { row: byId, source: "row" };
    const byCode = await r.findOne("Project", [{ column: "ProjectCode", op: "eq", value: pid }]);
    if (byCode) return { row: byCode, source: "row" };
    return { row: { Id: pid, Code: pid, ProjectCode: pid, NameFa: pid, Name: pid }, source: "unresolved" };
  };
  const unresolvedWarning = "ردیف پروژه در جدول Project یافت نشد؛ خروجی با شناسهٔ مسیر ساخته شد.";
  const runRec = async (r, req, { connector, status, itemCount = null, payloadBytes = null, endpoint = null, durationMs = null, errorCode = null, errorFa = null }) => {
    const startedAt = new Date().toISOString();
    try {
      const row = await r.create("ItgConnectorRun", {
        ProjectId: req.params.projectId,
        Connector: connector,
        Direction: "out",
        Status: status,
        ItemCount: itemCount,
        PayloadBytes: payloadBytes,
        Endpoint: endpoint ? String(endpoint).slice(0, 300) : null,
        DurationMs: durationMs,
        ErrorCode: errorCode ? String(errorCode).slice(0, 40) : null,
        ErrorFa: errorFa ? String(errorFa).slice(0, 500) : null,
        ActorId: actor(req),
        StartedAt: startedAt,
        FinishedAt: new Date().toISOString(),
        ModelVersion: ITG_OUTBOUND_MODEL,
      }, actor(req), "itgrun");
      return row;
    } catch (err) {
      console.error(`[${req.requestId}] itg run record failed:`, err?.message ?? err);
      return null;
    }
  };
  const audit = async (r, req, action, details) => {
    try {
      await r.create("AuditLog", {
        At: new Date().toISOString(),
        SubjectId: actor(req),
        Action: action,
        ProjectCode: req.params.projectId,
        EntityName: details.entityName ?? null,
        EntityId: details.entityId ?? null,
        Severity: details.severity ?? "info",
        Details: { traceId: req.requestId, ...details },
      }, actor(req));
    } catch {
      console.error(`[${req.requestId}] itg audit failed ${action}`);
    }
  };
  const p6Env = () => ({
    P6_BASE_URL: process.env.P6_BASE_URL,
    P6_DATABASE: process.env.P6_DATABASE,
    P6_USER_ID: process.env.P6_USER_ID,
    P6_PASSWORD: process.env.P6_PASSWORD,
    P6_AUTH_MODE: process.env.P6_AUTH_MODE,
    P6_TIMEOUT_MS: process.env.P6_TIMEOUT_MS,
  });
  const exchangeEnv = () => ({
    MS_GRAPH_TENANT_ID: process.env.MS_GRAPH_TENANT_ID,
    MS_GRAPH_CLIENT_ID: process.env.MS_GRAPH_CLIENT_ID,
    MS_GRAPH_CLIENT_SECRET: process.env.MS_GRAPH_CLIENT_SECRET,
    MS_GRAPH_MAILBOX: process.env.MS_GRAPH_MAILBOX,
    EWS_ENDPOINT: process.env.EWS_ENDPOINT,
    EWS_USERNAME: process.env.EWS_USERNAME,
    EWS_PASSWORD: process.env.EWS_PASSWORD,
  });
  /** دادهٔ برنامهٔ پروژه برای خروجی‌ها. */
  const scheduleData = async (r, pid) => {
    const { row: project, source } = await projectRow(r, pid);
    const scope = project.Id;
    const [wbs, activities, relations] = await Promise.all([
      r.list("WbsNode", { where: byProject(scope), limit: 5000 }),
      r.list("Activity", { where: byProject(scope), limit: 5000 }),
      r.list("ActivityRelation", { limit: 10000 }),
    ]);
    const activityIds = new Set(activities.map((a) => String(a.Id)));
    const scopedRelations = relations.filter((rel) => activityIds.has(String(rel.PredecessorId)) || activityIds.has(String(rel.SuccessorId)));
    return { project, wbs, activities, relations: scopedRelations, source };
  };
  const fileHeaders = (res, contentType, fileName) => {
    res.setHeader("content-type", contentType);
    res.setHeader("content-disposition", `attachment; filename="${fileName}"`);
  };
  const fetchWithTimeout = async (url, init, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const base = "/api/itg/:projectId";

  /* ═══════════════ میز کار ═══════════════ */
  app.get(`${base}/workspace`, need("itg.connector.view"), route(async (req, res, r, pid) => {
    const p6 = p6ConfigFrom(p6Env());
    const exchange = exchangeConfigFrom(exchangeEnv());
    let p6ProjectSource = null;
    const runs = await r.list("ItgConnectorRun", { where: byProject(pid), limit: MAX_LIST });
    runs.sort((a, b) => String(b.StartedAt ?? "").localeCompare(String(a.StartedAt ?? "")));
    let activityCount = null;
    let wbsCount = null;
    try {
      const { row: project } = await projectRow(r, pid);
      activityCount = await r.count("Activity", byProject(project.Id));
      wbsCount = await r.count("WbsNode", byProject(project.Id));
    } catch (err) {
      console.error(`[${req.requestId}] itg counts failed:`, err?.message ?? err);
      activityCount = null;
      wbsCount = null;
    }
    const connectors = CONNECTOR_DEFS.map((c) => ({
      ...c,
      allowed: canIn(req, c.permission, pid),
      configured: c.key === "p6" ? p6.configured : c.key === "exchange" ? exchange.configured : true,
      missing: c.key === "p6" ? p6.missing : c.key === "exchange" ? exchange.missing : [],
    }));
    return ok(req, res, {
      projectId: pid,
      connectors,
      p6: { configured: p6.configured, missing: p6.missing, baseUrl: p6.baseUrl || null, database: p6.database || null, authMode: p6.authMode, timeoutMs: p6.timeoutMs },
      exchange: { mode: exchange.mode, configured: exchange.configured, missing: exchange.missing, mailbox: exchange.mailbox },
      counts: { activities: activityCount, wbs: wbsCount },
      projectSource: p6ProjectSource,
      runs: runs.slice(0, MAX_LIST),
      metrics: { runs: runs.length, failed: runs.filter((x) => x.Status === "failed").length, modelVersion: ITG_OUTBOUND_MODEL, generatedAt: new Date().toISOString() },
    });
  }));

  /* ═══════════════ ITG-1: خروجی‌ها ═══════════════ */
  app.get(`${base}/xer`, need("itg.export.run"), route(async (req, res, r, pid) => {
    const started = Date.now();
    const { project, wbs, activities, relations, source: projectSource } = await scheduleData(r, pid);
    const result = buildXer({
      project: { Id: project.Id, Code: project.ProjectCode ?? project.Code ?? project.Id, NameFa: project.NameFa ?? project.Name ?? "" },
      wbs, activities, relations,
      hoursPerDay: Number(req.query.hoursPerDay) || 8,
      exportedAt: new Date().toISOString(),
      user: actor(req),
    });
    await runRec(r, req, { connector: "xer", status: "succeeded", itemCount: activities.length, payloadBytes: Buffer.byteLength(result.text, "utf8"), durationMs: Date.now() - started, endpoint: "file:export.xer" });
    await audit(r, req, "ITG_EXPORT_XER", { entityName: "Activity", entityId: null, activities: activities.length, wbs: wbs.length, warnings: result.issues.length });
    if (String(req.query.format ?? "file") === "json") {
      return ok(req, res, { counts: result.counts, issues: result.issues, bytes: Buffer.byteLength(result.text, "utf8"), projectSource, warning: projectSource === "unresolved" ? unresolvedWarning : null, preview: result.text.slice(0, 2000) });
    }
    fileHeaders(res, "text/plain; charset=utf-8", `${project.ProjectCode ?? project.Code ?? pid}.xer`);
    return res.send(result.text);
  }));

  app.get(`${base}/msp.xml`, need("itg.export.run"), route(async (req, res, r, pid) => {
    const started = Date.now();
    const { project, wbs, activities, relations, source: projectSource } = await scheduleData(r, pid);
    const result = buildMspXml({
      project: { Id: project.Id, Code: project.ProjectCode ?? project.Code ?? project.Id, NameFa: project.NameFa ?? project.Name ?? "" },
      wbs, activities, relations,
      hoursPerDay: Number(req.query.hoursPerDay) || 8,
      exportedAt: new Date().toISOString(),
      user: actor(req),
    });
    await runRec(r, req, { connector: "msp", status: "succeeded", itemCount: result.counts.tasks, payloadBytes: Buffer.byteLength(result.xml, "utf8"), durationMs: Date.now() - started, endpoint: "file:export.xml" });
    await audit(r, req, "ITG_EXPORT_MSP", { entityName: "Activity", entityId: null, tasks: result.counts.tasks, links: result.counts.links, warnings: result.issues.length });
    if (String(req.query.format ?? "file") === "json") {
      return ok(req, res, { counts: result.counts, issues: result.issues, dataDate: result.dataDate, bytes: Buffer.byteLength(result.xml, "utf8"), projectSource, warning: projectSource === "unresolved" ? unresolvedWarning : null });
    }
    fileHeaders(res, "application/xml; charset=utf-8", `${project.ProjectCode ?? project.Code ?? pid}.xml`);
    return res.send(result.xml);
  }));

  /* ═══════════════ ITG-3: تقویم ═══════════════ */
  app.get(`${base}/calendar.ics`, need("itg.calendar.sync"), route(async (req, res, r, pid) => {
    const started = Date.now();
    const { row: project, source: projectSource } = await projectRow(r, pid);
    const [activities, inspections] = await Promise.all([
      r.list("Activity", { where: byProject(project.Id), limit: 5000 }),
      r.list("CpmInspectionRequest", { where: byProject(project.Id), limit: 1000 }),
    ]);
    const events = calendarEventsFrom({ project: { Id: project.Id, Code: project.ProjectCode ?? project.Code ?? project.Id }, activities, inspections, horizonDays: Number(req.query.horizonDays) || 120 });
    const ics = buildIcs(events, { now: new Date().toISOString() });
    await runRec(r, req, { connector: "calendar", status: "succeeded", itemCount: ics.counts.events, payloadBytes: Buffer.byteLength(ics.ics, "utf8"), durationMs: Date.now() - started, endpoint: "file:calendar.ics" });
    await audit(r, req, "ITG_EXPORT_ICS", { entityName: "Activity", entityId: null, events: ics.counts.events, warnings: ics.issues.length });
    if (String(req.query.format ?? "file") === "json") {
      return ok(req, res, { count: ics.counts.events, milestones: ics.counts.milestones, issues: ics.issues, bytes: Buffer.byteLength(ics.ics, "utf8"), events: events.slice(0, 50), projectSource, warning: projectSource === "unresolved" ? unresolvedWarning : null });
    }
    fileHeaders(res, "text/calendar; charset=utf-8", `${project.ProjectCode ?? project.Code ?? pid}.ics`);
    return res.send(ics.ics);
  }));

  /* ═══════════════ ITG-2: پریماورا، MPP ═══════════════ */
  app.get(`${base}/p6`, need("itg.connector.view"), route(async (req, res, r, pid) => {
    const config = p6ConfigFrom(p6Env());
    let activityCount = null;
    try {
      const { row: project } = await projectRow(r, pid);
      activityCount = await r.count("Activity", byProject(project.Id));
    } catch {
      activityCount = null;
    }
    return ok(req, res, {
      configured: config.configured,
      missing: config.missing,
      baseUrl: config.baseUrl || null,
      database: config.database || null,
      user: config.user || null,
      authMode: config.authMode,
      timeoutMs: config.timeoutMs,
      probePath: config.configured ? p6ProbePath(config) : null,
      pushPath: config.configured ? p6ActivityPath(config) : null,
      maxPerPush: MAX_PUSH_ACTIVITIES,
      activityCount,
    });
  }));

  app.post(`${base}/p6/probe`, need("itg.primavera.push"), route(async (req, res, r, pid) => {
    const config = p6ConfigFrom(p6Env());
    if (!config.configured) throw new ItgError(409, "E-P6-NOT-CONFIGURED", "مشخصات اتصال P6 تنظیم نشده است", { missing: config.missing });
    const started = Date.now();
    const headers = config.authMode === "bearer" ? { authorization: `Bearer ${process.env.P6_PASSWORD ?? ""}` } : { authorization: `Basic ${base64Utf8(`${config.user}:${process.env.P6_PASSWORD ?? ""}`)}` };
    let status = 0;
    let bodyText = "";
    try {
      const response = await fetchWithTimeout(p6ProbePath(config), { method: "GET", headers: { accept: "application/json", ...headers } }, config.timeoutMs);
      status = response.status;
      bodyText = (await response.text()).slice(0, 500);
    } catch (err) {
      status = err?.name === "AbortError" ? 408 : 0;
    }
    const verdict = status >= 200 && status < 300 ? { code: "OK", retryable: false, messageFa: "اتصال P6 برقرار است" } : classifyP6Error(status, "probe");
    await runRec(r, req, {
      connector: "p6", status: verdict.code === "OK" ? "succeeded" : "failed", itemCount: 0, payloadBytes: null,
      durationMs: Date.now() - started, endpoint: p6ProbePath(config), errorCode: verdict.code === "OK" ? null : verdict.code, errorFa: verdict.code === "OK" ? null : verdict.messageFa,
    });
    if (verdict.code !== "OK") return res.status(502).json({ ok: false, error: { code: verdict.code, message: verdict.messageFa, retryable: verdict.retryable, httpStatus: status, traceId: req.requestId } });
    return ok(req, res, { reachable: true, httpStatus: status, sample: bodyText ? bodyText.slice(0, 200) : null, database: config.database });
  }));

  app.post(`${base}/p6/push`, need("itg.primavera.push"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    const config = p6ConfigFrom(p6Env());
    if (!config.configured) throw new ItgError(409, "E-P6-NOT-CONFIGURED", "مشخصات اتصال P6 تنظیم نشده است؛ ابتدا متغیرهای محیطی را تعیین کنید", { missing: config.missing });
    const { project, activities } = await scheduleData(r, pid);
    const ids = Array.isArray(body.activityIds) ? new Set(body.activityIds.map(String)) : null;
    const selected = ids ? activities.filter((a) => ids.has(String(a.Id))) : activities;
    if (selected.length === 0) throw bad("E-ITG-VALIDATION", "فعالیتی برای ارسال انتخاب نشده است");
    if (selected.length > MAX_PUSH_ACTIVITIES) throw bad("E-ITG-VALIDATION", `ارسال بیش از ${MAX_PUSH_ACTIVITIES} فعالیت در یک درخواست مجاز نیست`, { count: selected.length, max: MAX_PUSH_ACTIVITIES });
    const payload = buildP6ActivityPayload({ project: { Id: project.Id, Code: project.ProjectCode ?? project.Code ?? project.Id }, activities: selected });
    const started = Date.now();
    const headers = {
      "content-type": "application/json",
      accept: "application/json",
      ...(config.authMode === "bearer" ? { authorization: `Bearer ${process.env.P6_PASSWORD ?? ""}` } : { authorization: `Basic ${base64Utf8(`${config.user}:${process.env.P6_PASSWORD ?? ""}`)}` }),
    };
    let status = 0;
    let bodyText = "";
    try {
      const response = await fetchWithTimeout(p6ActivityPath(config), { method: "POST", headers, body: JSON.stringify(payload) }, config.timeoutMs);
      status = response.status;
      bodyText = (await response.text()).slice(0, 1000);
    } catch (err) {
      status = err?.name === "AbortError" ? 408 : 0;
    }
    const verdict = status >= 200 && status < 300 ? { code: "OK", retryable: false, messageFa: "ارسال انجام شد" } : classifyP6Error(status, "push");
    const run = await runRec(r, req, {
      connector: "p6", status: verdict.code === "OK" ? "succeeded" : "failed", itemCount: selected.length,
      payloadBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"), durationMs: Date.now() - started, endpoint: p6ActivityPath(config),
      errorCode: verdict.code === "OK" ? null : verdict.code, errorFa: verdict.code === "OK" ? null : verdict.messageFa,
    });
    await audit(r, req, "ITG_P6_PUSH", { entityName: "Activity", entityId: run?.Id ?? null, count: selected.length, status: verdict.code, severity: verdict.code === "OK" ? "info" : "warning" });
    if (verdict.code !== "OK") return res.status(502).json({ ok: false, error: { code: verdict.code, message: verdict.messageFa, retryable: verdict.retryable, httpStatus: status, runId: run?.Id ?? null, traceId: req.requestId } });
    return ok(req, res, { sent: selected.length, httpStatus: status, runId: run?.Id ?? null, response: bodyText.slice(0, 200) });
  }));

  app.post(`${base}/mpp/inspect`, need("itg.connector.view"), route(async (req, res) => {
    const body = bodyOf(req);
    const fileName = String(body.fileName ?? "").trim();
    if (!fileName.toLowerCase().endsWith(".mpp")) throw bad("E-ITG-VALIDATION", "نام فایل باید به .mpp ختم شود", { field: "fileName" });
    const raw = String(body.base64 ?? "");
    if (!raw) throw bad("E-ITG-VALIDATION", "محتوای base64 فایل لازم است", { field: "base64" });
    let bytes;
    try {
      bytes = Buffer.from(raw, "base64");
    } catch {
      throw bad("E-ITG-VALIDATION", "base64 نامعتبر است");
    }
    if (bytes.length === 0) throw bad("E-ITG-VALIDATION", "فایل خالی است");
    if (bytes.length > MAX_MPP_BYTES) throw bad("E-ITG-VALIDATION", `حجم فایل بیش از ${MAX_MPP_BYTES / (1024 * 1024)} مگابایت است`, { bytes: bytes.length });
    const inspection = inspectMppHeader(bytes);
    return ok(req, res, { fileName, ...inspection, alternatives: ["msp.xml", "xer"] });
  }));

  /* ═══════════════ ITG-3: Outlook/Exchange ═══════════════ */
  app.post(`${base}/exchange/send`, need("itg.calendar.sync"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    const dryRun = body.dryRun === true || String(req.query.dryRun ?? "") === "1";
    const config = exchangeConfigFrom(exchangeEnv());
    if (!config.configured) throw new ItgError(409, "E-EXCHANGE-NOT-CONFIGURED", "مشخصات Outlook/Exchange تنظیم نشده است", { missing: config.missing });
    const { row: project } = await projectRow(r, pid);
    const [activities, inspections] = await Promise.all([
      r.list("Activity", { where: byProject(project.Id), limit: 5000 }),
      r.list("CpmInspectionRequest", { where: byProject(project.Id), limit: 1000 }),
    ]);
    const events = calendarEventsFrom({ project: { Id: project.Id, Code: project.ProjectCode ?? project.Code ?? project.Id }, activities, inspections, horizonDays: Number(body.horizonDays) || 120 });
    const ics = buildIcs(events, { now: new Date().toISOString(), method: "REQUEST" });
    const subject = String(body.subject ?? `PMIS — ${project.ProjectCode ?? project.Code ?? pid}`).slice(0, 200);
    if (dryRun) {
      return ok(req, res, { dryRun: true, mode: config.mode, mailbox: config.mailbox, endpoint: exchangeSendPath(config), count: ics.counts.events, bytes: Buffer.byteLength(ics.ics, "utf8"), preview: ics.ics.slice(0, 400) });
    }
    const started = Date.now();
    let status = 0;
    let detail = "";
    try {
      if (config.mode === "graph") {
        const tokenResponse = await fetchWithTimeout(`https://login.microsoftonline.com/${encodeURIComponent(process.env.MS_GRAPH_TENANT_ID ?? "")}/oauth2/v2.0/token`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.MS_GRAPH_CLIENT_ID ?? "",
            client_secret: process.env.MS_GRAPH_CLIENT_SECRET ?? "",
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
          }).toString(),
        }, 15000);
        status = tokenResponse.status;
        if (tokenResponse.ok) {
          const token = await tokenResponse.json();
          const payload = buildGraphSendPayload({ mailbox: config.mailbox ?? "", ics: ics.ics, subject, bodyFa: `تقویم پروژه ${project.ProjectCode ?? project.Code ?? pid} — ${ics.counts.events} رویداد` });
          const send = await fetchWithTimeout(exchangeSendPath(config), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token.access_token}` }, body: JSON.stringify(payload) }, 20000);
          status = send.status;
          detail = (await send.text()).slice(0, 500);
        } else {
          detail = (await tokenResponse.text()).slice(0, 500);
        }
      } else {
        const soap = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"><soap:Header><t:RequestServerVersion Version="Exchange2016"/></soap:Header><soap:Body><m:SendItem SaveItemToFolder="true"><m:ItemIds><t:ItemId Id="${icsUidSafe(project.Id)}"/></m:ItemIds></m:SendItem></soap:Body></soap:Envelope>`;
        const response = await fetchWithTimeout(exchangeSendPath(config), {
          method: "POST",
          headers: { "content-type": "text/xml; charset=utf-8", authorization: `Basic ${base64Utf8(`${process.env.EWS_USERNAME ?? ""}:${process.env.EWS_PASSWORD ?? ""}`)}` },
          body: soap,
        }, 20000);
        status = response.status;
        detail = (await response.text()).slice(0, 500);
      }
    } catch (err) {
      status = err?.name === "AbortError" ? 408 : 0;
    }
    const sent = status >= 200 && status < 300;
    const run = await runRec(r, req, {
      connector: "exchange", status: sent ? "succeeded" : "failed", itemCount: ics.counts.events, payloadBytes: Buffer.byteLength(ics.ics, "utf8"),
      durationMs: Date.now() - started, endpoint: exchangeSendPath(config), errorCode: sent ? null : status === 0 ? "E-EXCHANGE-UNREACHABLE" : "E-EXCHANGE-HTTP",
      errorFa: sent ? null : status === 0 ? "سرویس نامه‌رسانی پاسخ نداد" : `پاسخ ناموفق سرویس نامه‌رسانی (${status})`,
    });
    if (!sent) return res.status(502).json({ ok: false, error: { code: status === 0 ? "E-EXCHANGE-UNREACHABLE" : "E-EXCHANGE-HTTP", message: `ارسال تقویم ناموفق بود (${status || "بی‌پاسخ"})`, httpStatus: status, runId: run?.Id ?? null, detail: detail || null, traceId: req.requestId } });
    await audit(r, req, "ITG_EXCHANGE_SEND", { entityName: "Activity", entityId: run?.Id ?? null, count: ics.counts.events, mode: config.mode });
    return ok(req, res, { sent: true, mode: config.mode, mailbox: config.mailbox, count: ics.counts.events, runId: run?.Id ?? null });
  }));

  /* ═══════════════ دفتر اجرا ═══════════════ */
  app.get(`${base}/runs`, need("itg.connector.view"), route(async (req, res, r, pid) => {
    const connector = String(req.query.connector ?? "").trim();
    const runs = await r.list("ItgConnectorRun", { where: connector ? [...byProject(pid), { column: "Connector", op: "eq", value: connector }] : byProject(pid), limit: MAX_LIST });
    runs.sort((a, b) => String(b.StartedAt ?? "").localeCompare(String(a.StartedAt ?? "")));
    return ok(req, res, {
      runs,
      metrics: { total: runs.length, succeeded: runs.filter((x) => x.Status === "succeeded").length, failed: runs.filter((x) => x.Status === "failed").length },
    });
  }));
}

/** شناسهٔ پایدار و ایمن برای ItemId سادهٔ EWS (بدون ادعای تحویل واقعی). */
function icsUidSafe(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40);
}
