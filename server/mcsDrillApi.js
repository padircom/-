/**
 * MIX-1 — پیمایش سلسله‌مراتبی سبد → پروژه → فاز → اقلام (P9) — سرور
 * ---------------------------------------------------------------
 * مسیر پایه: /api/drill/:projectId
 *   GET /workspace   فهرست بخش‌ها + مجوز لازم هر بخش
 *   GET /drill       شمارش بخش‌ها در فازها + اقلام یک بخش (?section=&phase=&limit=)
 *   GET /portfolio   نمای سبد: هر پروژه با شمارش بخش‌ها
 *
 * قواعد:
 *  - خواندن هر بخش مجوز پایهٔ خودش را می‌خواهد؛ بخشِ بی‌مجوز با `count: null`
 *    برمی‌گردد، نه صفر. «ندیدن» با «صفر بودن» یکی نمی‌شود.
 *  - فاز = ریشهٔ زنجیرهٔ WBS؛ ردیفِ بی‌WBS یا با زنجیرهٔ قطع در `unphased`
 *    می‌آید تا از چشم نیفتد.
 *  - سقف ردیف‌ها صریح است؛ فراتر از سقف وضعیت `too_large` است، نه عدد ناقص.
 *  - نمای سبد فقط پروژه‌های در دامنهٔ کاربر را می‌شمارد.
 */
import { DRILL_MODEL, DRILL_SECTIONS, buildPhaseIndex, buildDrill, buildPortfolioDrill, projectItems, drillSectionByKey } from "./mcsDrillLogic.js";

const PROJECT_RE = /^[A-Za-z0-9_-]{1,50}$/;
const MAX_SECTION_ROWS = 5000;
const MAX_ITEMS = 200;
const MAX_PROJECTS = 100;

class DrillError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new DrillError(400, code, message, extra);
const notFound = (message) => new DrillError(404, "E-DRILL-NOT-FOUND", message);

export function registerDrillRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app) throw new Error("registerDrillRoutes: app is required");

  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
  const fail = (req, res, err) => {
    if (err instanceof DrillError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    console.error("[%s] drill error:", req.requestId, err);
    return res.status(500).json({ ok: false, error: { code: "E-DRILL-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects?.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const canIn = (req, permission, projectId) => {
    const subject = subjectOf(req);
    return subject ? evaluate(subject, permission, { projectId }).allow : false;
  };
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-DRILL-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-DRILL-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر و فعال الزامی است", permission, traceId: req.requestId } });
    }
    if (!evaluate(subject, permission, { projectId: req.params.projectId }).allow) {
      return res.status(403).json({ ok: false, error: { code: "E-DRILL-FORBIDDEN", message: "مجوز این اقدام یا دسترسی به این پروژه را ندارید", permission, traceId: req.requestId } });
    }
    return next();
  };
  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      if (!r) throw new DrillError(503, "E-DRILL-NO-STORE", "لایهٔ ماندگاری در دسترس نیست");
      await handler(req, res, r, req.params.projectId);
    } catch (err) {
      fail(req, res, err);
    }
  };
  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  /**
   * ردیف پروژه با شناسهٔ داخلی یا کد پروژه. نبودِ ردیف دروغ نمی‌سازد:
   * `source: "unresolved"` و هشدار صریح برمی‌گردد تا شمارش‌های خالی به حساب
   * «پروژهٔ بی‌داده» گذاشته شود، نه «پروژهٔ ناشناخته».
   */
  const projectRow = async (r, pid) => {
    const row = await r.findOne("Project", [{ column: "Id", op: "eq", value: pid }])
      ?? await r.findOne("Project", [{ column: "ProjectCode", op: "eq", value: pid }]);
    if (row) return { row, source: "row" };
    return { row: { Id: pid, Code: pid, ProjectCode: pid, NameFa: pid, Name: pid }, source: "unresolved" };
  };
  const readable = (req, pid, spec) => spec.permissions.some((p) => canIn(req, p, pid));
  const restrictedResult = (spec) => ({
    key: spec.key, table: spec.table, label: spec.label,
    state: "restricted", restricted: true, count: null, amount: null,
    amountField: spec.amountField ?? null, statusCounts: null, phased: Boolean(spec.wbsField),
  });

  const base = "/api/drill/:projectId";

  app.get(`${base}/workspace`, need("core.project.view"), route(async (req, res, r, pid) => {
    const sections = DRILL_SECTIONS.map((spec) => ({
      key: spec.key, label: spec.label, table: spec.table,
      allowed: readable(req, pid, spec), permissions: spec.permissions,
      hasWbs: Boolean(spec.wbsField), hasAmount: Boolean(spec.amountField),
    }));
    return ok(req, res, {
      projectId: pid,
      sections,
      readable: sections.filter((s) => s.allowed).length,
      total: sections.length,
      maxItems: MAX_ITEMS,
      maxRowsPerSection: MAX_SECTION_ROWS,
      modelVersion: DRILL_MODEL,
      generatedAt: new Date().toISOString(),
    });
  }));

  app.get(`${base}/drill`, need("core.project.view"), route(async (req, res, r, pid) => {
    const { row: project, source: projectSource } = await projectRow(r, pid);
    const wbs = await r.list("WbsNode", { where: byProject(project.Id), limit: MAX_SECTION_ROWS });
    const phaseIndex = buildPhaseIndex(wbs);
    const allowed = [];
    const tooLarge = new Set();
    for (const spec of DRILL_SECTIONS) {
      if (!readable(req, project.Id, spec)) continue;
      const rows = await r.list(spec.table, { where: byProject(project.Id), limit: MAX_SECTION_ROWS + 1 });
      if (rows.length > MAX_SECTION_ROWS) {
        tooLarge.add(spec.key);
        continue;
      }
      allowed.push({ spec, rows });
    }
    const drill = buildDrill({ projectId: project.Id, wbs, sections: allowed, generatedAt: new Date().toISOString() });
    const rollups = new Map(drill.sections.map((s) => [s.key, s]));
    const rowsBySection = new Map(allowed.map(({ spec, rows }) => [spec.key, rows]));
    const sections = DRILL_SECTIONS.map((spec) => {
      if (tooLarge.has(spec.key)) {
        return { ...restrictedResult(spec), state: "too_large", restricted: false, limit: MAX_SECTION_ROWS };
      }
      return rollups.get(spec.key) ?? restrictedResult(spec);
    });

    const wanted = String(req.query.section ?? "").trim();
    let items = null;
    let itemsSection = null;
    if (wanted) {
      const spec = drillSectionByKey(wanted);
      if (!spec) throw bad("E-DRILL-SECTION", `بخش «${wanted}» شناخته‌شده نیست`, { known: DRILL_SECTIONS.map((s) => s.key) });
      const phase = String(req.query.phase ?? "").trim() || null;
      const limit = Math.min(MAX_ITEMS, Math.max(1, Number(req.query.limit) || 50));
      const isReadable = rowsBySection.has(spec.key);
      itemsSection = { key: spec.key, label: spec.label, readable: isReadable, phase, limit, permission: spec.permissions.join("|") };
      if (isReadable) {
        const built = projectItems(spec, rowsBySection.get(spec.key) ?? [], MAX_ITEMS, phaseIndex);
        items = (phase ? built.filter((i) => (phase === "__unphased" ? !i.phaseId : i.phaseId === phase || i.phaseCode === phase)) : built).slice(0, limit);
      }
    }
    return ok(req, res, {
      projectId: project.Id,
      projectCode: project.ProjectCode ?? project.Code ?? null,
      projectName: project.NameFa ?? project.Name ?? null,
      phases: drill.phases,
      unphased: drill.unphased,
      sections,
      items,
      itemsSection,
      projectSource,
      warning: projectSource === "unresolved" ? "ردیف پروژه در جدول Project یافت نشد؛ شمارش‌ها با شناسهٔ مسیر خوانده شد." : null,
      modelVersion: DRILL_MODEL,
      generatedAt: new Date().toISOString(),
    });
  }));

  app.get(`${base}/portfolio`, need("core.portfolio.view"), route(async (req, res, r, pid) => {
    const subject = subjectOf(req);
    const scope = subject?.projectIds?.includes("*") ? "*" : subject?.projectIds ?? [];
    const empty = { projects: [], sections: DRILL_SECTIONS.map((s) => ({ key: s.key, label: s.label, allowed: false })), metrics: { projects: 0, readable: 0 }, modelVersion: DRILL_MODEL, generatedAt: new Date().toISOString() };
    if (scope !== "*" && scope.length === 0) return ok(req, res, empty);
    const projectRows = scope === "*"
      ? await r.list("Project", { limit: MAX_PROJECTS })
      : await r.list("Project", { where: [{ column: "Id", op: "in", value: scope }], limit: MAX_PROJECTS });
    const projects = projectRows.map((p) => ({ projectId: p.Id, code: p.ProjectCode ?? p.Code ?? null, title: p.NameFa ?? p.Name ?? null }));
    const perProject = {};
    for (const p of projects) perProject[p.projectId] = [];
    const sectionStates = [];
    for (const spec of DRILL_SECTIONS) {
      const scopeIds = projects.map((p) => p.projectId);
      const allowed = scopeIds.some((id) => readable(req, id, spec));
      const allowedIds = scopeIds.filter((id) => readable(req, id, spec));
      sectionStates.push({ key: spec.key, label: spec.label, allowed, tooLarge: false, permission: spec.permissions.join("|") });
      if (!allowed) {
        for (const p of projects) perProject[p.projectId].push({ spec, rows: [], state: "restricted" });
        continue;
      }
      const rows = await r.list(spec.table, { where: [{ column: "ProjectId", op: "in", value: allowedIds }], limit: MAX_SECTION_ROWS + 1 });
      if (rows.length > MAX_SECTION_ROWS) {
        sectionStates[sectionStates.length - 1].tooLarge = true;
        for (const p of projects) perProject[p.projectId].push({ spec, rows: [], state: allowedIds.includes(p.projectId) ? "too_large" : "restricted" });
        continue;
      }
      const grouped = new Map();
      for (const row of rows) {
        const key = String(row.ProjectId ?? "");
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
      }
      for (const p of projects) {
        const bucket = grouped.get(p.projectId);
        if (!allowedIds.includes(p.projectId)) perProject[p.projectId].push({ spec, rows: [], state: "restricted" });
        else perProject[p.projectId].push({ spec, rows: bucket ?? [], state: bucket && bucket.length ? "ready" : "empty" });
      }
    }
    const result = buildPortfolioDrill({ projects: projects.map((p) => p.projectId), perProject });
    const byId = new Map(projects.map((p) => [p.projectId, p]));
    return ok(req, res, {
      sections: sectionStates,
      projects: result.projects.map((row) => ({ ...row, code: byId.get(row.projectId)?.code ?? null, title: byId.get(row.projectId)?.title ?? null })),
      metrics: { projects: projects.length, readable: sectionStates.filter((s) => s.allowed).length },
      modelVersion: DRILL_MODEL,
      generatedAt: new Date().toISOString(),
    });
  }));
}
