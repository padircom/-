/**
 * PMO — دفتر مدیریت پروژه (P8) — سرور
 * ------------------------------------------------------------------
 * PMO-1 منشور پروژه با گردش تأیید    → /api/pmo/:projectId/charters
 * PMO-2 فرم‌ساز (تعریف، انتشار، رکورد) → /forms، /entries
 * PMO-3 کارت سلامت پروژه             → /assessments
 *
 * قواعد:
 *  - همهٔ مسیرها پروژه‌ای‌اند و مجوز جدا می‌خواهند؛ هویت از `x-user-id` و RBAC.
 *  - چهار جدول PMO از CRUD عمومی و ورود مستقیم Excel بسته‌اند.
 *  - از بدنه فقط فیلدهای قابل تحریر پذیرفته می‌شود؛ وضعیت/نسخه/فیلدهای تصمیم
 *    تنها از گردش سرور تغییر می‌کنند.
 *  - تفکیک وظیفه: تحریرکنندهٔ منشور ≠ تصویب‌کننده (SOD-30)، تأییدکنندهٔ رکورد
 *    فرم و کارت سلامت ≠ ثبت‌کننده.
 *  - هر رکورد RowVersion دارد؛ نوشتن با نسخهٔ کهنه ۴۰۹ می‌گیرد.
 *  - کارت سلامت و رکورد فرم، دادهٔ محاسبه‌شده را از سمت کاربر نمی‌پذیرند.
 */
import {
  PMO_MODEL,
  CHARTER_FIELDS,
  FORM_FIELDS,
  HEALTH_FIELDS,
  HEALTH_CRITERIA,
  normalizeCharter,
  normalizeFormDefinition,
  normalizeHealthAssessment,
  validateEntryData,
  charterTransition,
  entryTransition,
  formTransition,
  pmoMetrics,
  PmoValidationError,
} from "./pmoWsLogic.js";

export const PMO_TABLES = ["PmoCharter", "PmoFormDefinition", "PmoFormEntry", "PmoHealthAssessment"];

/** جدول‌های PMO و مسیر اختصاصی‌شان — برای بستن CRUD عمومی و ورود Excel. */
export const PMO_DEDICATED_ROUTES = {
  PmoCharter: "/api/pmo/:projectId/charters",
  PmoFormDefinition: "/api/pmo/:projectId/forms",
  PmoFormEntry: "/api/pmo/:projectId/entries",
  PmoHealthAssessment: "/api/pmo/:projectId/assessments",
};

const PROJECT_RE = /^[A-Za-z0-9_-]{1,50}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,59}$/;
const MAX_LIST = 300;

class PmoError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new PmoError(400, code, message, extra);
const conflict = (code, message, extra) => new PmoError(409, code, message, extra);
const notFound = (message) => new PmoError(404, "E-PMO-NOT-FOUND", message);

export function registerPmoWorkspaceRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app) throw new Error("registerPmoWorkspaceRoutes: app is required");

  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
  const fail = (req, res, err) => {
    if (err instanceof PmoError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    if (err instanceof PmoValidationError) return res.status(400).json({ ok: false, error: { code: "E-PMO-VALIDATION", message: err.message, traceId: req.requestId } });
    if (err?.code === "ROW_VALIDATION_FAILED") return res.status(400).json({ ok: false, error: { code: "E-PMO-VALIDATION", message: err.message, traceId: req.requestId } });
    if (err?.code === "UNIQUE_VIOLATION" || err?.code === "DUPLICATE_KEY") return res.status(409).json({ ok: false, error: { code: "E-PMO-DUPLICATE", message: "کد در همین پروژه تکراری است", traceId: req.requestId } });
    console.error("[%s] pmo error:", req.requestId, err);
    return res.status(500).json({ ok: false, error: { code: "E-PMO-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects?.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
  const verdictOf = (req) => (permission) => {
    const subject = subjectOf(req);
    return subject ? evaluate(subject, permission, { projectId: req.params.projectId }).allow : false;
  };
  /** مسیر محافظت‌شده با یک مجوز مشخص. */
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-PMO-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-PMO-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر و فعال الزامی است", permission, traceId: req.requestId } });
    }
    if (!evaluate(subject, permission, { projectId: req.params.projectId }).allow) {
      return res.status(403).json({ ok: false, error: { code: "E-PMO-FORBIDDEN", message: "مجوز این اقدام یا دسترسی به این پروژه را ندارید", permission, traceId: req.requestId } });
    }
    return next();
  };
  /** مسیر محافظت‌شده با «یکی از» چند مجوز — لازمهٔ نمای تجمیعی میز کار. */
  const needAny = (permissions) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-PMO-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-PMO-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر و فعال الزامی است", permission: permissions.join("|"), traceId: req.requestId } });
    }
    if (!permissions.some((p) => evaluate(subject, p, { projectId: req.params.projectId }).allow)) {
      return res.status(403).json({ ok: false, error: { code: "E-PMO-FORBIDDEN", message: "مجوز دیدن این بخش را ندارید", permission: permissions.join("|"), traceId: req.requestId } });
    }
    return next();
  };
  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      if (!r) throw new PmoError(503, "E-PMO-NO-STORE", "لایهٔ ماندگاری در دسترس نیست");
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
      console.error("[%s] pmo audit failed %s", req.requestId, action);
    }
  };
  const bodyOf = (req) => {
    const b = req.body;
    if (!b || typeof b !== "object" || Array.isArray(b)) throw bad("E-PMO-BODY", "بدنهٔ JSON لازم است");
    return b;
  };
  const rejectForeign = (body, allowed) => {
    const invalid = Object.keys(body).find((k) => !allowed.includes(k));
    if (invalid) throw bad("E-PMO-FIELD", `فیلد قابل نوشتن نیست: ${invalid}`);
  };
  const requireVersion = (row, value) => {
    if (!Number.isInteger(value) || value !== row.RowVersion) throw conflict("E-PMO-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی و مقایسه کنید");
  };
  const modelGuard = (row) => {
    if (row.ModelVersion && row.ModelVersion !== PMO_MODEL) throw conflict("E-PMO-MODEL", "نسخهٔ مدل رکورد پشتیبانی نمی‌شود؛ مهاجرت داده لازم است");
    return row;
  };
  const cap = async (r, table, where, limit = MAX_LIST) => {
    const rows = await r.list(table, { where, limit: limit + 1 });
    if (rows.length > limit) throw conflict("E-PMO-CAPACITY", `سقف این نما ${limit} رکورد در هر پروژه است؛ فهرست ناقص نمایش داده نمی‌شود`);
    return rows;
  };
  const jsonOf = (v, fallback) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }
    return fallback;
  };
  const charterView = (row) => ({
    ...row,
    ObjectivesFa: jsonOf(row.ObjectivesJson, []),
    Milestones: jsonOf(row.MilestonesJson, []),
    Risks: jsonOf(row.RisksJson, []),
  });
  const formView = (row) => ({ ...row, Fields: jsonOf(row.FieldsJson, []) });
  const entryView = (row) => ({ ...row, Data: (row.DataJson && typeof row.DataJson === "object" && !Array.isArray(row.DataJson)) ? row.DataJson : {} });
  const healthView = (row) => ({ ...row, Criteria: jsonOf(row.CriteriaJson, []) });

  const base = "/api/pmo/:projectId";

  /* ═══════════════ نمای تجمیعی میز کار ═══════════════ */
  app.get(`${base}/workspace`, needAny(["pmo.charter.view", "pmo.form.view", "pmo.health.view"]), route(async (req, res, r, pid) => {
    const can = verdictOf(req);
    const canMap = {
      charterEdit: can("pmo.charter.edit"),
      charterApprove: can("pmo.charter.approve"),
      formManage: can("pmo.form.manage"),
      formSubmit: can("pmo.form.submit"),
      formApprove: can("pmo.form.approve"),
      healthRecord: can("pmo.health.record"),
      healthApprove: can("pmo.health.approve"),
    };
    const sections = await Promise.all([
      canMap.charterEdit || can("pmo.charter.view") ? cap(r, "PmoCharter", byProject(pid)) : [],
      can("pmo.form.view") ? cap(r, "PmoFormDefinition", byProject(pid)) : [],
      can("pmo.form.view") ? cap(r, "PmoFormEntry", byProject(pid)) : [],
      can("pmo.health.view") ? cap(r, "PmoHealthAssessment", byProject(pid)) : [],
    ]);
    const [charters, forms, entries, assessments] = sections;
    const view = {
      charters: charters.sort((a, b) => String(b.CreatedAt ?? "").localeCompare(String(a.CreatedAt ?? ""))).map((row) => { modelGuard(row); return charterView(row); }),
      forms: forms.sort((a, b) => String(a.Code).localeCompare(String(b.Code))).map((row) => { modelGuard(row); return formView(row); }),
      entries: entries.sort((a, b) => String(b.CreatedAt ?? "").localeCompare(String(a.CreatedAt ?? ""))).map((row) => { modelGuard(row); return entryView(row); }),
      assessments: assessments.sort((a, b) => String(b.AsOfDate).localeCompare(String(a.AsOfDate))).map((row) => { modelGuard(row); return healthView(row); }),
    };
    return ok(req, res, {
      projectId: pid,
      can: canMap,
      ...view,
      metrics: pmoMetrics({ charters, forms, entries, assessments }),
      criteriaModel: HEALTH_CRITERIA,
      generatedAt: new Date().toISOString(),
      modelVersion: PMO_MODEL,
    });
  }));

  /* ═══════════════ PMO-1 منشور پروژه ═══════════════ */

  app.post(`${base}/charters`, need("pmo.charter.edit"), route(async (req, res, r, pid) => {
    const data = normalizeCharter(bodyOf(req));
    if (await r.findOne("PmoCharter", [...byProject(pid), { column: "CharterNo", op: "eq", value: data.CharterNo }])) {
      throw conflict("E-PMO-DUPLICATE", `منشور ${data.CharterNo} تکراری است`);
    }
    const row = await r.create("PmoCharter", {
      ProjectId: pid,
      CharterNo: data.CharterNo,
      TitleFa: data.TitleFa,
      SponsorFa: data.SponsorFa,
      ManagerFa: data.ManagerFa,
      ObjectivesJson: data.ObjectivesFa,
      ScopeInFa: data.ScopeInFa,
      ScopeOutFa: data.ScopeOutFa,
      MilestonesJson: data.Milestones,
      BudgetAmount: data.BudgetAmount,
      Currency: data.Currency,
      RisksJson: data.Risks,
      NoteFa: data.NoteFa,
      Status: "draft",
      ModelVersion: PMO_MODEL,
    }, actor(req), "pmocharter");
    await audit(r, req, "PMO_CHARTER_CREATE", { entityName: "PmoCharter", entityId: row.Id, code: row.CharterNo, currency: row.Currency, budget: row.BudgetAmount ?? null });
    return ok(req, res, charterView(row), 201);
  }));

  app.patch(`${base}/charters/:charterNo`, need("pmo.charter.edit"), route(async (req, res, r, pid) => {
    const row = await r.findOne("PmoCharter", [...byProject(pid), { column: "CharterNo", op: "eq", value: req.params.charterNo }]);
    if (!row) throw notFound("منشور در این پروژه یافت نشد");
    modelGuard(row);
    if (row.Status !== "draft" && row.Status !== "returned") throw conflict("E-PMO-LOCKED", "منشور ارسال‌شده یا مصوب ویرایش نمی‌شود");
    const body = bodyOf(req);
    rejectForeign(body, [...CHARTER_FIELDS.filter((f) => f !== "CharterNo"), "RowVersion"]);
    /* RowVersion فقط برای کنترل هم‌زمانی است؛ نباید به اعتبارسنج میدان برود. */
    const { RowVersion, ...fields } = body;
    requireVersion(row, RowVersion);
    const merged = normalizeCharter({
      CharterNo: row.CharterNo,
      TitleFa: row.TitleFa,
      SponsorFa: row.SponsorFa,
      ManagerFa: row.ManagerFa,
      ObjectivesFa: jsonOf(row.ObjectivesJson, []),
      ScopeInFa: row.ScopeInFa,
      ScopeOutFa: row.ScopeOutFa,
      Milestones: jsonOf(row.MilestonesJson, []),
      BudgetAmount: row.BudgetAmount,
      Currency: row.Currency,
      Risks: jsonOf(row.RisksJson, []),
      NoteFa: row.NoteFa,
      ...fields,
    });
    const result = await r.patch("PmoCharter", row.Id, {
      TitleFa: merged.TitleFa,
      SponsorFa: merged.SponsorFa,
      ManagerFa: merged.ManagerFa,
      ObjectivesJson: merged.ObjectivesFa,
      ScopeInFa: merged.ScopeInFa,
      ScopeOutFa: merged.ScopeOutFa,
      MilestonesJson: merged.Milestones,
      BudgetAmount: merged.BudgetAmount,
      Currency: merged.Currency,
      RisksJson: merged.Risks,
      NoteFa: merged.NoteFa,
    }, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-PMO-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("PmoCharter", row.Id);
    await audit(r, req, "PMO_CHARTER_UPDATE", { entityName: "PmoCharter", entityId: row.Id, code: row.CharterNo, status: saved.Status });
    return ok(req, res, charterView(saved));
  }));

  app.post(`${base}/charters/:charterNo/transition`, route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    const action = String(body.action || "");
    /* ارسال کار تحریرکننده است؛ تصویب/برگشت مجوز جدا (SOD-30) می‌خواهد. */
    const permission = action === "submit" ? "pmo.charter.edit" : "pmo.charter.approve";
    const subject = subjectOf(req);
    if (!subject) throw new PmoError(401, "E-PMO-AUTH-REQUIRED", "شناسهٔ کاربر معتبر و فعال الزامی است");
    if (!evaluate(subject, permission, { projectId: pid }).allow) {
      throw new PmoError(403, "E-PMO-FORBIDDEN", "مجوز این اقدام را ندارید", { permission });
    }
    const row = await r.findOne("PmoCharter", [...byProject(pid), { column: "CharterNo", op: "eq", value: req.params.charterNo }]);
    if (!row) throw notFound("منشور در این پروژه یافت نشد");
    modelGuard(row);
    const now = new Date().toISOString();
    const { Status, patch } = charterTransition(action, row, actor(req), body.note ?? null, now);
    const result = await r.patch("PmoCharter", row.Id, patch, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-PMO-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    /* تصویب منشور تازه، منشور مصوب قبلی همان پروژه را جایگزین می‌کند. */
    if (Status === "approved") {
      const others = await r.list("PmoCharter", { where: [...byProject(pid), { column: "Status", op: "eq", value: "approved" }], limit: MAX_LIST });
      for (const other of others.filter((o) => o.Id !== row.Id)) {
        await r.patch("PmoCharter", other.Id, { Status: "superseded", SupersededAt: now, SupersededBy: actor(req), SupersededByCharterNo: row.CharterNo }, actor(req), other.RowVersion);
        await audit(r, req, "PMO_CHARTER_SUPERSEDE", { entityName: "PmoCharter", entityId: other.Id, code: other.CharterNo, replacedBy: row.CharterNo, severity: "warn" });
      }
    }
    const saved = await r.get("PmoCharter", row.Id);
    await audit(r, req, `PMO_CHARTER_${action.toUpperCase()}`, {
      entityName: "PmoCharter", entityId: row.Id, code: row.CharterNo, status: saved.Status,
      severity: action === "return" ? "warn" : "info",
    });
    return ok(req, res, charterView(saved));
  }));

  /* ═══════════════ PMO-2 فرم‌ساز ═══════════════ */

  app.post(`${base}/forms`, need("pmo.form.manage"), route(async (req, res, r, pid) => {
    const data = normalizeFormDefinition(bodyOf(req));
    if (await r.findOne("PmoFormDefinition", [...byProject(pid), { column: "Code", op: "eq", value: data.Code }])) {
      throw conflict("E-PMO-DUPLICATE", `فرم ${data.Code} تکراری است`);
    }
    const row = await r.create("PmoFormDefinition", {
      ProjectId: pid, Code: data.Code, TitleFa: data.TitleFa, PurposeFa: data.PurposeFa,
      FieldsJson: data.Fields, Status: "draft", Version: 0, NoteFa: data.NoteFa, ModelVersion: PMO_MODEL,
    }, actor(req), "pmoform");
    await audit(r, req, "PMO_FORM_CREATE", { entityName: "PmoFormDefinition", entityId: row.Id, code: row.Code, fields: data.Fields.length });
    return ok(req, res, formView(row), 201);
  }));

  app.patch(`${base}/forms/:code`, need("pmo.form.manage"), route(async (req, res, r, pid) => {
    const row = await r.findOne("PmoFormDefinition", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("فرم در این پروژه یافت نشد");
    modelGuard(row);
    if (row.Status !== "draft") throw conflict("E-PMO-LOCKED", "فرم منتشرشده ویرایش نمی‌شود؛ نسخهٔ تازه با همان کد بسازید");
    const body = bodyOf(req);
    rejectForeign(body, [...FORM_FIELDS.filter((f) => f !== "Code"), "RowVersion"]);
    const { RowVersion, ...fields } = body;
    requireVersion(row, RowVersion);
    const merged = normalizeFormDefinition({
      Code: row.Code, TitleFa: row.TitleFa, PurposeFa: row.PurposeFa,
      Fields: jsonOf(row.FieldsJson, []), NoteFa: row.NoteFa, ...fields,
    });
    const result = await r.patch("PmoFormDefinition", row.Id, {
      TitleFa: merged.TitleFa, PurposeFa: merged.PurposeFa, FieldsJson: merged.Fields, NoteFa: merged.NoteFa,
    }, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-PMO-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("PmoFormDefinition", row.Id);
    await audit(r, req, "PMO_FORM_UPDATE", { entityName: "PmoFormDefinition", entityId: row.Id, code: row.Code });
    return ok(req, res, formView(saved));
  }));

  app.post(`${base}/forms/:code/transition`, need("pmo.form.manage"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    const row = await r.findOne("PmoFormDefinition", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("فرم در این پروژه یافت نشد");
    modelGuard(row);
    const { version, patch } = formTransition(String(body.action || ""), formView(row), actor(req), new Date().toISOString());
    const result = await r.patch("PmoFormDefinition", row.Id, patch, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-PMO-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("PmoFormDefinition", row.Id);
    await audit(r, req, `PMO_FORM_${String(body.action || "").toUpperCase()}`, { entityName: "PmoFormDefinition", entityId: row.Id, code: row.Code, status: saved.Status, version: saved.Version });
    return ok(req, res, { ...formView(saved), version });
  }));

  app.post(`${base}/entries`, need("pmo.form.submit"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    const code = String(body.FormCode || "");
    if (!CODE_RE.test(code)) throw bad("E-PMO-FIELD", "کد فرم نامعتبر است", { field: "FormCode" });
    const definition = await r.findOne("PmoFormDefinition", [...byProject(pid), { column: "Code", op: "eq", value: code }, { column: "Status", op: "eq", value: "published" }]);
    if (!definition) throw bad("E-PMO-NO-FORM", `فرم منتشرشدهٔ «${code}» در این پروژه نیست`, { field: "FormCode" });
    modelGuard(definition);
    const subject = typeof body.SubjectFa === "string" ? body.SubjectFa.trim() : "";
    if (!subject || subject.length > 300) throw bad("E-PMO-VALIDATION", "«موضوع رکورد» الزامی و حداکثر ۳۰۰ نویسه است", { field: "SubjectFa" });
    const data = validateEntryData(formView(definition), body.Data ?? {});
    const row = await r.create("PmoFormEntry", {
      ProjectId: pid, FormCode: code, FormVersion: Number(definition.Version ?? 1), SubjectFa: subject,
      DataJson: data, Status: "draft", NoteFa: typeof body.NoteFa === "string" ? body.NoteFa.slice(0, 1000) : null, ModelVersion: PMO_MODEL,
    }, actor(req), "pmoentry");
    await audit(r, req, "PMO_ENTRY_CREATE", { entityName: "PmoFormEntry", entityId: row.Id, formCode: code, formVersion: row.FormVersion });
    return ok(req, res, entryView(row), 201);
  }));

  app.patch(`${base}/entries/:id`, need("pmo.form.submit"), route(async (req, res, r, pid) => {
    if (!ID_RE.test(String(req.params.id))) throw bad("E-PMO-FIELD", "شناسهٔ رکورد نامعتبر است");
    const row = await r.findOne("PmoFormEntry", [...byProject(pid), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw notFound("رکورد فرم در این پروژه یافت نشد");
    modelGuard(row);
    if (row.Status !== "draft" && row.Status !== "returned") throw conflict("E-PMO-LOCKED", "رکورد ارسال‌شده یا تأییدشده ویرایش نمی‌شود");
    const body = bodyOf(req);
    rejectForeign(body, ["SubjectFa", "Data", "NoteFa", "RowVersion"]);
    requireVersion(row, body.RowVersion);
    const definition = await r.findOne("PmoFormDefinition", [...byProject(pid), { column: "Code", op: "eq", value: row.FormCode }, { column: "Version", op: "eq", value: row.FormVersion }]);
    if (!definition) throw conflict("E-PMO-NO-FORM", "نسخهٔ فرمِ این رکورد دیگر در دسترس نیست؛ رکورد تازه بسازید");
    const subject = body.SubjectFa === undefined ? row.SubjectFa : String(body.SubjectFa).trim();
    if (!subject || subject.length > 300) throw bad("E-PMO-VALIDATION", "«موضوع رکورد» الزامی و حداکثر ۳۰۰ نویسه است", { field: "SubjectFa" });
    const mergedData = validateEntryData(formView(definition), { ...(row.DataJson ?? {}), ...(body.Data ?? {}) });
    const result = await r.patch("PmoFormEntry", row.Id, {
      SubjectFa: subject, DataJson: mergedData,
      NoteFa: body.NoteFa === undefined ? row.NoteFa : String(body.NoteFa ?? "").slice(0, 1000) || null,
    }, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-PMO-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("PmoFormEntry", row.Id);
    await audit(r, req, "PMO_ENTRY_UPDATE", { entityName: "PmoFormEntry", entityId: row.Id, formCode: row.FormCode });
    return ok(req, res, entryView(saved));
  }));

  app.post(`${base}/entries/:id/transition`, route(async (req, res, r, pid) => {
    if (!ID_RE.test(String(req.params.id))) throw bad("E-PMO-FIELD", "شناسهٔ رکورد نامعتبر است");
    const body = bodyOf(req);
    const action = String(body.action || "");
    const permission = action === "submit" ? "pmo.form.submit" : "pmo.form.approve";
    const subject = subjectOf(req);
    if (!subject) throw new PmoError(401, "E-PMO-AUTH-REQUIRED", "شناسهٔ کاربر معتبر و فعال الزامی است");
    if (!evaluate(subject, permission, { projectId: pid }).allow) {
      throw new PmoError(403, "E-PMO-FORBIDDEN", "مجوز این اقدام را ندارید", { permission });
    }
    const row = await r.findOne("PmoFormEntry", [...byProject(pid), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw notFound("رکورد فرم در این پروژه یافت نشد");
    modelGuard(row);
    const { Status, patch } = entryTransition(action, row, actor(req), body.note ?? null, new Date().toISOString());
    const result = await r.patch("PmoFormEntry", row.Id, patch, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-PMO-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("PmoFormEntry", row.Id);
    await audit(r, req, `PMO_ENTRY_${action.toUpperCase()}`, {
      entityName: "PmoFormEntry", entityId: row.Id, formCode: row.FormCode, status: Status,
      severity: action === "return" ? "warn" : "info",
    });
    return ok(req, res, entryView(saved));
  }));

  /* ═══════════════ PMO-3 کارت سلامت پروژه ═══════════════ */

  app.post(`${base}/assessments`, need("pmo.health.record"), route(async (req, res, r, pid) => {
    const data = normalizeHealthAssessment(bodyOf(req));
    const row = await r.create("PmoHealthAssessment", {
      ProjectId: pid, AsOfDate: data.AsOfDate, PeriodNo: data.PeriodNo, CriteriaJson: data.Criteria,
      ScoreTotal: data.ScoreTotal, Band: data.Band, Status: "draft", NoteFa: data.NoteFa, ModelVersion: PMO_MODEL,
    }, actor(req), "pmohealth");
    await audit(r, req, "PMO_HEALTH_CREATE", {
      entityName: "PmoHealthAssessment", entityId: row.Id, asOfDate: row.AsOfDate,
      score: row.ScoreTotal, band: row.Band, severity: row.Band === "red" ? "warn" : "info",
    });
    return ok(req, res, healthView(row), 201);
  }));

  app.post(`${base}/assessments/:id/transition`, route(async (req, res, r, pid) => {
    if (!ID_RE.test(String(req.params.id))) throw bad("E-PMO-FIELD", "شناسهٔ ارزیابی نامعتبر است");
    const body = bodyOf(req);
    const action = String(body.action || "");
    const permission = action === "submit" ? "pmo.health.record" : "pmo.health.approve";
    const subject = subjectOf(req);
    if (!subject) throw new PmoError(401, "E-PMO-AUTH-REQUIRED", "شناسهٔ کاربر معتبر و فعال الزامی است");
    if (!evaluate(subject, permission, { projectId: pid }).allow) {
      throw new PmoError(403, "E-PMO-FORBIDDEN", "مجوز این اقدام را ندارید", { permission });
    }
    const row = await r.findOne("PmoHealthAssessment", [...byProject(pid), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw notFound("ارزیابی سلامت در این پروژه یافت نشد");
    modelGuard(row);
    const { Status, patch } = entryTransition(action, row, actor(req), body.note ?? null, new Date().toISOString());
    const nextPatch = action === "approve" && typeof body.note === "string" && body.note.trim() ? { ...patch, ApprovedNoteFa: body.note.trim().slice(0, 500) } : patch;
    const result = await r.patch("PmoHealthAssessment", row.Id, nextPatch, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-PMO-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("PmoHealthAssessment", row.Id);
    await audit(r, req, `PMO_HEALTH_${action.toUpperCase()}`, {
      entityName: "PmoHealthAssessment", entityId: row.Id, status: Status, band: saved.Band, score: saved.ScoreTotal,
      severity: action === "return" || saved.Band === "red" ? "warn" : "info",
    });
    return ok(req, res, healthView(saved));
  }));

  return { PMO_TABLES };
}
