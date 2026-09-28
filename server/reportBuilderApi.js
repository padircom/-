/**
 * RPT-1 — گزارش‌ساز سفارشی (P9) — سرور
 * ---------------------------------------------------------------
 * مسیر: /api/reports/:projectId
 *   GET    /workspace                 فهرست مجموعه‌داده‌های مجاز + قالب‌ها + can
 *   POST   /preview                   اجرای قالب ناساخته (بدون ذخیره)
 *   POST   /templates                 ثبت قالب پیش‌نویس
 *   PATCH  /templates/:code           ویرایش قالب پیش‌نویس
 *   POST   /templates/:code/transition  انتشار / بازنشستگی
 *   GET    /templates/:code/run       اجرای قالب ذخیره‌شده
 *   GET    /templates/:code/csv       خروجی CSV همان اجرا
 *
 * قواعد:
 *  - مشخصات قالب (فیلد/فیلتر/گروه/نمودار) با موتور مشترک اعتبارسنجی می‌شود؛
 *    نه نام ستون بیرون از فهرست مجاز، نه عملگر آزاد، نه SQL.
 *  - دیدن هر مجموعه‌داده مجوز پایهٔ خودش را می‌خواهد؛ مجوز گزارش‌ساز جای آن
 *    را نمی‌گیرد.
 *  - انتشار قالب سند حاکمیتی است: SOD-31 — سازنده ≠ منتشرکننده.
 *  - جدول RptTemplate از CRUD عمومی و ورود Excel بسته است.
 */
import {
  REPORT_BUILDER_MODEL,
  RB_DATASETS,
  datasetByKey,
  normalizeSpec,
  applyResult,
  chartSeries,
  toResultCsv,
  templateTransition,
  RB_TEMPLATE_FIELDS,
  RbError,
} from "./rptBuilderLogic.js";

export const RPT_TABLES = ["RptTemplate"];

/** جدول قالب گزارش و مسیر اختصاصی‌اش. */
export const RPT_DEDICATED_ROUTES = {
  RptTemplate: "/api/reports/:projectId/templates",
};

const PROJECT_RE = /^[A-Za-z0-9_-]{1,50}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-]{0,39}$/;
const MAX_LIST = 300;
/** سقف ردیف ورودی هر اجرا؛ فراتر از آن «عدد کامل» نمایش داده نمی‌شود. */
const MAX_DATASET_ROWS = 5000;

class RptError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new RptError(400, code, message, extra);
const conflict = (code, message, extra) => new RptError(409, code, message, extra);
const notFound = (message) => new RptError(404, "E-RPT-NOT-FOUND", message);

export function registerReportBuilderRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app) throw new Error("registerReportBuilderRoutes: app is required");

  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
  const fail = (req, res, err) => {
    if (err instanceof RptError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    if (err instanceof RbError) return res.status(400).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
    if (err?.code === "ROW_VALIDATION_FAILED") return res.status(400).json({ ok: false, error: { code: "E-RPT-VALIDATION", message: err.message, traceId: req.requestId } });
    if (err?.code === "UNIQUE_VIOLATION" || err?.code === "DUPLICATE_KEY") return res.status(409).json({ ok: false, error: { code: "E-RPT-DUPLICATE", message: "کد قالب در همین پروژه تکراری است", traceId: req.requestId } });
    console.error("[%s] rpt error:", req.requestId, err);
    return res.status(500).json({ ok: false, error: { code: "E-RPT-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects?.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
  const canOf = (req) => (permission) => {
    const subject = subjectOf(req);
    return subject ? evaluate(subject, permission, { projectId: req.params.projectId }).allow : false;
  };
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-RPT-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-RPT-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر و فعال الزامی است", permission, traceId: req.requestId } });
    }
    if (!evaluate(subject, permission, { projectId: req.params.projectId }).allow) {
      return res.status(403).json({ ok: false, error: { code: "E-RPT-FORBIDDEN", message: "مجوز این اقدام یا دسترسی به این پروژه را ندارید", permission, traceId: req.requestId } });
    }
    return next();
  };
  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      if (!r) throw new RptError(503, "E-RPT-NO-STORE", "لایهٔ ماندگاری در دسترس نیست");
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
        EntityName: details.entityName ?? null,
        EntityId: details.entityId ?? null,
        Severity: details.severity ?? "info",
        Details: { traceId: req.requestId, ...details },
      }, actor(req));
    } catch {
      console.error("[%s] rpt audit failed %s", req.requestId, action);
    }
  };
  const bodyOf = (req) => {
    const b = req.body;
    if (!b || typeof b !== "object" || Array.isArray(b)) throw bad("E-RPT-BODY", "بدنهٔ JSON لازم است");
    return b;
  };
  const rejectForeign = (body, allowed) => {
    const invalid = Object.keys(body).find((k) => !allowed.includes(k));
    if (invalid) throw bad("E-RPT-FIELD", `فیلد قابل نوشتن نیست: ${invalid}`);
  };
  const requireVersion = (row, value) => {
    if (!Number.isInteger(value) || value !== row.RowVersion) throw conflict("E-RPT-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی و مقایسه کنید");
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
  const templateView = (row) => ({
    ...row,
    Fields: jsonOf(row.FieldsJson, []),
    Filters: jsonOf(row.FiltersJson, []),
    Group: jsonOf(row.GroupJson, null),
    Sort: jsonOf(row.SortJson, []),
    Chart: jsonOf(row.ChartJson, null),
  });
  /** مشخصات قابل اجرای یک رکورد ذخیره‌شده. */
  const specOfRow = (row) => normalizeSpec({
    dataset: row.DatasetKey,
    fields: jsonOf(row.FieldsJson, []),
    filters: jsonOf(row.FiltersJson, []),
    group: jsonOf(row.GroupJson, null),
    sort: jsonOf(row.SortJson, []),
    limit: Number(row.LimitRows ?? 500),
    chart: jsonOf(row.ChartJson, null),
  });
  /** فقط مجموعه‌داده‌هایی که مجوز پایهٔ داده‌شان را داریم. */
  const allowedDatasets = (can) => RB_DATASETS.filter((d) => d.permissions.some((p) => can(p)));
  const datasetCatalog = (datasets) =>
    datasets.map((d) => ({
      key: d.key,
      table: d.table,
      label: d.label,
      columns: d.columns.map((c) => ({ name: c.name, label: c.label, kind: c.kind, values: c.values ?? null })),
    }));
  const datasetGuard = (can) => (key) => {
    const dataset = datasetByKey(key);
    if (!dataset) throw bad("E-RPT-DATASET", `مجموعه‌دادهٔ «${String(key)}» شناخته‌شده نیست`);
    if (!dataset.permissions.some((p) => can(p))) throw new RptError(403, "E-RPT-DATASET-FORBIDDEN", `مجوز خواندن مجموعه‌دادهٔ «${dataset.label.fa}» را ندارید`, { permission: dataset.permissions.join("|") });
    return dataset;
  };
  const readRows = async (r, pid, dataset) => {
    const rows = await r.list(dataset.table, { where: byProject(pid), limit: MAX_DATASET_ROWS + 1 });
    if (rows.length > MAX_DATASET_ROWS) {
      throw conflict("E-RPT-TOO-LARGE", `بیش از ${MAX_DATASET_ROWS} ردیف در «${dataset.label.fa}»؛ گزارش ناقص ساخته نمی‌شود`, { table: dataset.table });
    }
    return rows;
  };

  const base = "/api/reports/:projectId";

  /* ═══════════════ میز کار ═══════════════ */
  app.get(`${base}/workspace`, need("report.custom.view"), route(async (req, res, r, pid) => {
    const can = canOf(req);
    const datasets = allowedDatasets(can);
    const templates = await r.list("RptTemplate", { where: byProject(pid), limit: MAX_LIST });
    templates.sort((a, b) => String(b.UpdatedAt ?? b.CreatedAt ?? "").localeCompare(String(a.UpdatedAt ?? a.CreatedAt ?? "")) || String(a.Code).localeCompare(String(b.Code)));
    const statuses = templates.reduce((acc, t) => { acc[String(t.Status)] = (acc[String(t.Status)] ?? 0) + 1; return acc; }, {});
    return ok(req, res, {
      projectId: pid,
      can: {
        view: can("report.custom.view"),
        run: can("report.custom.run"),
        edit: can("report.custom.edit"),
        publish: can("report.custom.publish"),
      },
      datasets: datasetCatalog(datasets),
      restrictedDatasets: RB_DATASETS.length - datasets.length,
      templates: templates.map(templateView),
      metrics: {
        datasets: datasets.length,
        templates: {
          total: templates.length,
          draft: statuses.draft ?? 0,
          published: statuses.published ?? 0,
          retired: statuses.retired ?? 0,
        },
        generatedAt: new Date().toISOString(),
        modelVersion: REPORT_BUILDER_MODEL,
      },
    });
  }));

  /* ═══════════════ اجرای ناساخته ═══════════════ */
  app.post(`${base}/preview`, need("report.custom.run"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    rejectForeign(body, ["spec"]);
    const can = canOf(req);
    const spec = normalizeSpec(body.spec ?? {});
    const dataset = datasetGuard(can)(spec.dataset);
    const rows = await readRows(r, pid, dataset);
    const result = applyResult(spec, rows);
    return ok(req, res, {
      spec,
      dataset: { key: dataset.key, table: dataset.table, label: dataset.label },
      result,
      chart: chartSeries(spec, result),
    });
  }));

  /* ═══════════════ قالب‌ها ═══════════════ */
  app.post(`${base}/templates`, need("report.custom.edit"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    rejectForeign(body, RB_TEMPLATE_FIELDS);
    const code = String(body.Code ?? "").trim();
    if (!CODE_RE.test(code)) throw bad("E-RPT-FIELD", "کد قالب نامعتبر است", { field: "Code" });
    const title = String(body.TitleFa ?? "").trim();
    if (!title || title.length > 200) throw bad("E-RPT-FIELD", "عنوان قالب الزامی و حداکثر ۲۰۰ نویسه است", { field: "TitleFa" });
    const can = canOf(req);
    const spec = normalizeSpec({
      dataset: body.DatasetKey,
      fields: body.Fields,
      filters: body.Filters ?? [],
      group: body.Group ?? null,
      sort: body.Sort ?? [],
      limit: body.Limit ?? 500,
      chart: body.Chart ?? null,
    });
    datasetGuard(can)(spec.dataset);
    if (await r.findOne("RptTemplate", [...byProject(pid), { column: "Code", op: "eq", value: code }])) {
      throw conflict("E-RPT-DUPLICATE", `قالب ${code} تکراری است`);
    }
    const row = await r.create("RptTemplate", {
      ProjectId: pid, Code: code, TitleFa: title, DatasetKey: spec.dataset,
      FieldsJson: spec.fields, FiltersJson: spec.filters, GroupJson: spec.group, SortJson: spec.sort, ChartJson: spec.chart,
      LimitRows: spec.limit, Status: "draft", Version: 0,
      NoteFa: typeof body.NoteFa === "string" ? body.NoteFa.slice(0, 1000) : null,
      ModelVersion: REPORT_BUILDER_MODEL,
    }, actor(req), "rpttpl");
    await audit(r, req, "RPT_TEMPLATE_CREATE", { entityName: "RptTemplate", entityId: row.Id, code, dataset: spec.dataset, fields: spec.fields.length, filters: spec.filters.length });
    return ok(req, res, templateView(row), 201);
  }));

  app.patch(`${base}/templates/:code`, need("report.custom.edit"), route(async (req, res, r, pid) => {
    if (!CODE_RE.test(String(req.params.code))) throw bad("E-RPT-FIELD", "کد قالب نامعتبر است");
    const row = await r.findOne("RptTemplate", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("قالب گزارش در این پروژه یافت نشد");
    if (row.Status !== "draft") throw conflict("E-RPT-LOCKED", "قالب منتشرشده/بازنشسته ویرایش نمی‌شود؛ قالب تازه بسازید");
    const body = bodyOf(req);
    rejectForeign(body, [...RB_TEMPLATE_FIELDS.filter((f) => f !== "Code"), "RowVersion"]);
    requireVersion(row, body.RowVersion);
    const current = templateView(row);
    const can = canOf(req);
    const spec = normalizeSpec({
      dataset: body.DatasetKey ?? row.DatasetKey,
      fields: body.Fields ?? current.Fields,
      filters: body.Filters ?? current.Filters,
      group: body.Group === undefined ? current.Group : body.Group,
      sort: body.Sort ?? current.Sort,
      limit: body.Limit ?? row.LimitRows ?? 500,
      chart: body.Chart === undefined ? current.Chart : body.Chart,
    });
    datasetGuard(can)(spec.dataset);
    const patch = {
      TitleFa: body.TitleFa === undefined ? row.TitleFa : String(body.TitleFa).trim().slice(0, 200),
      DatasetKey: spec.dataset, FieldsJson: spec.fields, FiltersJson: spec.filters, GroupJson: spec.group, SortJson: spec.sort, ChartJson: spec.chart,
      LimitRows: spec.limit,
      NoteFa: body.NoteFa === undefined ? row.NoteFa : (String(body.NoteFa ?? "").slice(0, 1000) || null),
    };
    if (!patch.TitleFa) throw bad("E-RPT-FIELD", "عنوان قالب الزامی است", { field: "TitleFa" });
    const result = await r.patch("RptTemplate", row.Id, patch, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-RPT-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("RptTemplate", row.Id);
    await audit(r, req, "RPT_TEMPLATE_UPDATE", { entityName: "RptTemplate", entityId: row.Id, code: row.Code });
    return ok(req, res, templateView(saved));
  }));

  app.post(`${base}/templates/:code/transition`, route(async (req, res, r, pid) => {
    if (!CODE_RE.test(String(req.params.code))) throw bad("E-RPT-FIELD", "کد قالب نامعتبر است");
    const body = bodyOf(req);
    const action = String(body.action || "");
    const permission = action === "publish" ? "report.custom.publish" : "report.custom.edit";
    const subject = subjectOf(req);
    if (!subject) throw new RptError(401, "E-RPT-AUTH-REQUIRED", "شناسهٔ کاربر معتبر و فعال الزامی است");
    if (!evaluate(subject, permission, { projectId: pid }).allow) {
      throw new RptError(403, "E-RPT-FORBIDDEN", "مجوز این اقدام را ندارید", { permission });
    }
    const row = await r.findOne("RptTemplate", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("قالب گزارش در این پروژه یافت نشد");
    /* SOD-31: سازندهٔ قالب منتشرکنندهٔ آن نیست. */
    if (action === "publish" && String(row.CreatedBy ?? "") === actor(req)) {
      throw new RptError(403, "E-RPT-SOD", "سازندهٔ قالب نمی‌تواند همان قالب را منتشر کند (SOD-31)", { rule: "SOD-31" });
    }
    const { Status, Version, patch } = templateTransition(action, templateView(row), actor(req), new Date().toISOString());
    const result = await r.patch("RptTemplate", row.Id, patch, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-RPT-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("RptTemplate", row.Id);
    await audit(r, req, `RPT_TEMPLATE_${action.toUpperCase()}`, { entityName: "RptTemplate", entityId: row.Id, code: row.Code, status: Status, version: Version });
    return ok(req, res, templateView(saved));
  }));

  app.get(`${base}/templates/:code/run`, need("report.custom.run"), route(async (req, res, r, pid) => {
    const row = await r.findOne("RptTemplate", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("قالب گزارش در این پروژه یافت نشد");
    const spec = specOfRow(row);
    const dataset = datasetGuard(canOf(req))(spec.dataset);
    const rows = await readRows(r, pid, dataset);
    const result = applyResult(spec, rows);
    await audit(r, req, "RPT_RUN", { entityName: "RptTemplate", entityId: row.Id, code: row.Code, matched: result.matched, shown: result.shown });
    return ok(req, res, {
      template: { code: row.Code, title: row.TitleFa, status: row.Status, version: row.Version },
      spec,
      dataset: { key: dataset.key, table: dataset.table, label: dataset.label },
      result,
      chart: chartSeries(spec, result),
    });
  }));

  app.get(`${base}/templates/:code/csv`, need("report.custom.run"), route(async (req, res, r, pid) => {
    const row = await r.findOne("RptTemplate", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("قالب گزارش در این پروژه یافت نشد");
    const spec = specOfRow(row);
    const dataset = datasetGuard(canOf(req))(spec.dataset);
    const rows = await readRows(r, pid, dataset);
    const result = applyResult(spec, rows);
    const csv = toResultCsv(dataset, spec, result, req.query.lang === "en" ? "en" : "fa");
    await audit(r, req, "RPT_EXPORT_CSV", { entityName: "RptTemplate", entityId: row.Id, code: row.Code, matched: result.matched });
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="${row.Code}.csv"`);
    return res.send("\uFEFF" + csv);
  }));
}
