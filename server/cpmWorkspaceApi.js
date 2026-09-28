/**
 * CPMS — میز کار ساخت و اجرا (P7) — سرور
 * ------------------------------------------------------------------
 * CPM-1 حوزهٔ کاری پیمانکار (تخصیص WBS)   → /work-areas
 * CPM-2 گزارش روزانهٔ پیمانکار + پیوست     → /dpr
 * CPM-3 گزارش‌های دیسیپلینی با خطوط        → /discipline-reports
 * CPM-4 درخواست بازرسی IR/RFI و آزادسازی QC → /inspections
 *
 * قواعد:
 *  - همهٔ مسیرها پروژه‌ای‌اند (`/api/cpm/:projectId/...`) و مجوز جدا می‌خواهند.
 *    هویت از همان آداپتور `x-user-id` و RBAC سامانه می‌آید.
 *  - هر جدول CPMS از CRUD عمومی و ورود مستقیم Excel بسته است؛ ثبت فقط از همین
 *    مسیرها با اعتبارسنجی موتور `cpmWsLogic.js` انجام می‌شود.
 *  - فیلدهای محاسبه‌شده (تعداد خط، نرخ قبولی NDT، وضعیت گردش، فیلدهای تصمیم)
 *    از بدنهٔ درخواست پذیرفته نمی‌شوند.
 *  - عرضهٔ متقاطع: کد WBS و کد پیمانکار باید در همین پروژه وجود داشته باشند.
 *  - تفکیک وظیفه: تأییدکننده/آزادکننده ≠ ثبت‌کننده (SOD-29 برای بازرسی).
 *  - هر رکورد RowVersion دارد؛ نوشتن با نسخهٔ کهنه ۴۰۹ می‌گیرد.
 */
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  CPM_MODEL,
  WORK_AREA_FIELDS,
  DPR_FIELDS,
  DISCIPLINE_REPORT_FIELDS,
  DISCIPLINE_LINE_FIELDS,
  INSPECTION_FIELDS,
  ATTACHMENT_KINDS,
  normalizeWorkArea,
  normalizeDprEntry,
  normalizeDisciplineReport,
  normalizeInspection,
  inspectionTransition,
  noticeCheck,
  daysBetween,
  disciplineMetrics,
  cpmsMetrics,
  WorkspaceValidationError,
  todayIso,
} from "./cpmWsLogic.js";

export const CPM_TABLES = ["CpmWorkArea", "CpmDprEntry", "CpmDisciplineReport", "CpmDisciplineLine", "CpmInspectionRequest", "CpmDprAttachment"];

/** جدول‌های CPMS و مسیر اختصاصی‌شان — برای بستن CRUD عمومی و ورود Excel. */
export const CPM_DEDICATED_ROUTES = {
  CpmWorkArea: "/api/cpm/:projectId/work-areas",
  CpmDprEntry: "/api/cpm/:projectId/dpr",
  CpmDisciplineReport: "/api/cpm/:projectId/discipline-reports",
  CpmDisciplineLine: "/api/cpm/:projectId/discipline-reports",
  CpmInspectionRequest: "/api/cpm/:projectId/inspections",
  CpmDprAttachment: "/api/cpm/:projectId/dpr",
};

const PROJECT_RE = /^[A-Za-z0-9_-]{1,50}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,59}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const MAX_LIST = 500;
const MAX_LINES = 5000;

class CpmError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new CpmError(400, code, message, extra);
const conflict = (code, message, extra) => new CpmError(409, code, message, extra);
const notFound = (message) => new CpmError(404, "E-CPM-NOT-FOUND", message);

export function registerCpmWorkspaceRoutes(app, { repo, subjects, evaluate, storageRoot, acceptedMimeTypes, maxFileBytes } = {}) {
  if (!app) throw new Error("registerCpmWorkspaceRoutes: app is required");

  const root = path.resolve(storageRoot || path.resolve(process.cwd(), "server/storage"));
  const attachDir = path.join(root, "cpm-dpr");
  fs.mkdirSync(attachDir, { recursive: true });
  const accepted = acceptedMimeTypes instanceof Set ? acceptedMimeTypes : new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]);
  const maxBytes = Number(maxFileBytes) > 0 ? Number(maxFileBytes) : 25 * 1024 * 1024;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } });

  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
  const fail = (req, res, err) => {
    if (err instanceof CpmError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    if (err instanceof WorkspaceValidationError) return res.status(400).json({ ok: false, error: { code: "E-CPM-VALIDATION", message: err.message, traceId: req.requestId } });
    if (err?.code === "ROW_VALIDATION_FAILED") return res.status(400).json({ ok: false, error: { code: "E-CPM-VALIDATION", message: err.message, traceId: req.requestId } });
    if (err?.code === "UNIQUE_VIOLATION" || err?.code === "DUPLICATE_KEY") return res.status(409).json({ ok: false, error: { code: "E-CPM-DUPLICATE", message: "کد در همین پروژه تکراری است", traceId: req.requestId } });
    if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ ok: false, error: { code: "E-CPM-FILE-SIZE", message: "حجم فایل بیش از سقف مجاز است", traceId: req.requestId } });
    console.error(`[${req.requestId}] cpm error:`, err);
    return res.status(500).json({ ok: false, error: { code: "E-CPM-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects?.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const grantOf = (req) => {
    const subject = subjectOf(req);
    if (!subject) return null;
    return (permission) => evaluate(subject, permission, { projectId: req.params.projectId }).allow;
  };
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-CPM-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-CPM-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر و فعال الزامی است", permission, traceId: req.requestId } });
    }
    const verdict = evaluate(subject, permission, { projectId: req.params.projectId });
    if (!verdict.allow) {
      return res.status(403).json({ ok: false, error: { code: "E-CPM-FORBIDDEN", message: "مجوز این اقدام یا دسترسی به این پروژه را ندارید", permission, traceId: req.requestId } });
    }
    return next();
  };
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      if (!r) throw new CpmError(503, "E-CPM-NO-STORE", "لایهٔ ماندگاری در دسترس نیست");
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
      console.error(`[${req.requestId}] cpm audit failed ${action}`);
    }
  };
  const bodyOf = (req) => {
    const b = req.body;
    if (!b || typeof b !== "object" || Array.isArray(b)) throw bad("E-CPM-BODY", "بدنهٔ JSON لازم است");
    return b;
  };
  /** فیلدهای ممنوع: هر چیز بیرون از فهرست موتور، و فیلدهای محاسبه/گردش. */
  const rejectForeign = (body, allowed) => {
    const invalid = Object.keys(body).find((k) => !allowed.includes(k));
    if (invalid) throw bad("E-CPM-FIELD", `فیلد قابل نوشتن نیست: ${invalid}`);
  };
  const requireVersion = (row, value) => {
    if (!Number.isInteger(value) || value !== row.RowVersion) throw conflict("E-CPM-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی و مقایسه کنید");
  };
  /** فقط فیلدهای مجاز موتور از رکورد ذخیره‌شده — رکورد پایگاه‌داده کلیدهای فنی هم دارد. */
  const pickFields = (row, fields) => Object.fromEntries(fields.filter((f) => row[f] !== undefined).map((f) => [f, row[f]]));
  const modelGuard = (row) => {
    if (row.ModelVersion && row.ModelVersion !== CPM_MODEL) throw conflict("E-CPM-MODEL", "نسخهٔ مدل رکورد پشتیبانی نمی‌شود؛ مهاجرت داده لازم است");
    return row;
  };
  const cap = async (r, table, where, limit = MAX_LIST) => {
    const rows = await r.list(table, { where, limit: limit + 1 });
    if (rows.length > limit) throw conflict("E-CPM-CAPACITY", `سقف این نما ${limit} رکورد در هر پروژه است؛ فهرست ناقص نمایش داده نمی‌شود`);
    return rows;
  };
  const contractorOrFail = async (r, pid, code) => {
    const row = await r.findOne("HrmSubContract", [...byProject(pid), { column: "ContractNo", op: "eq", value: code }]);
    if (!row) throw bad("E-CPM-CONTRACTOR", `پیمانکار «${code}» در قراردادهای فرعی همین پروژه ثبت نشده است`, { field: "ContractorCode" });
    return row;
  };
  const workAreaOrFail = async (r, pid, code) => {
    const row = await r.findOne("CpmWorkArea", [...byProject(pid), { column: "Code", op: "eq", value: code }]);
    if (!row) throw bad("E-CPM-WORKAREA", `حوزهٔ کاری «${code}» در این پروژه نیست`, { field: "WorkAreaCode" });
    return row;
  };

  const base = "/api/cpm/:projectId";

  /* ── N+1: فهرست‌ها یک‌بار خوانده می‌شوند و شاخص‌ها از همان داده ساخته می‌شوند ── */
  app.get(`${base}/workspace`, need("cpm.workarea.view"), route(async (req, res, r, pid) => {
    const [workAreas, dprEntries, reports, lines, requests, attachments] = await Promise.all([
      cap(r, "CpmWorkArea", byProject(pid)),
      cap(r, "CpmDprEntry", byProject(pid)),
      cap(r, "CpmDisciplineReport", byProject(pid)),
      cap(r, "CpmDisciplineLine", byProject(pid), MAX_LINES),
      cap(r, "CpmInspectionRequest", byProject(pid)),
      cap(r, "CpmDprAttachment", byProject(pid), 2000),
    ]);
    const decorateReport = (row) => {
      modelGuard(row);
      const own = lines.filter((l) => l.ReportNo === row.ReportNo).sort((a, b) => String(a.ItemRef).localeCompare(String(b.ItemRef)));
      return { ...row, Lines: own, metrics: disciplineMetrics(own) };
    };
    const decorateRequest = (row) => {
      modelGuard(row);
      const notice = noticeCheck(row.RequestedAt, row.TargetDate);
      /* سن درخواست فقط برای درخواست بازِ ارسال‌شده معنا دارد؛ بسته/آزادشده سن ندارد. */
      const ageDays = String(row.Status) === "submitted" && row.RequestedAt ? daysBetween(String(row.RequestedAt).slice(0, 10), todayIso()) : null;
      return { ...row, notice, ageDays };
    };
    const can = (permission) => grantOf(req)(permission);
    const canMap = {
      workAreaEdit: can("cpm.workarea.edit"),
      dprRecord: can("cpm.dpr.record"),
      dprApprove: can("cpm.dpr.approve"),
      disciplineRecord: can("cpm.discipline.record"),
      disciplineApprove: can("cpm.discipline.approve"),
      inspectionRequest: can("cpm.inspection.request"),
      inspectionRelease: can("cpm.inspection.release"),
    };
    return ok(req, res, {
      projectId: pid,
      can: canMap,
      workAreas: workAreas.sort((a, b) => String(a.Code).localeCompare(String(b.Code))),
      dprEntries: dprEntries.sort((a, b) => String(b.ReportDate).localeCompare(String(a.ReportDate))),
      reports: reports.sort((a, b) => String(b.ReportDate).localeCompare(String(a.ReportDate))).map(decorateReport),
      requests: requests.sort((a, b) => String(b.RequestNo).localeCompare(String(a.RequestNo))).map(decorateRequest),
      attachments,
      metrics: cpmsMetrics({ workAreas, dprEntries, reports, lines, requests }),
      generatedAt: new Date().toISOString(),
      modelVersion: CPM_MODEL,
    });
  }));

  /* ═══════════════ CPM-1 حوزهٔ کاری پیمانکار ═══════════════ */
  const weightBudget = async (r, pid, wbsCode, nextWeight, excludeId) => {
    if (nextWeight === null || nextWeight === undefined) return;
    const siblings = await r.list("CpmWorkArea", { where: [...byProject(pid), { column: "WbsCode", op: "eq", value: wbsCode }], limit: MAX_LIST });
    const total = siblings.filter((s) => s.Id !== excludeId).reduce((sum, s) => sum + (Number(s.WeightPct) || 0), 0) + Number(nextWeight);
    if (total > 100.0001) throw conflict("E-CPM-WEIGHT", `جمع وزن حوزه‌های WBS «${wbsCode}» از ۱۰۰٪ می‌گذرد (${total.toFixed(2)}٪)`, { field: "WeightPct" });
  };

  app.post(`${base}/work-areas`, need("cpm.workarea.edit"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    const data = normalizeWorkArea(body);
    const wbs = await r.findOne("WbsNode", [...byProject(pid), { column: "Code", op: "eq", value: data.WbsCode }]);
    if (!wbs) throw bad("E-CPM-WBS", `گره WBS «${data.WbsCode}» در این پروژه نیست`, { field: "WbsCode" });
    await contractorOrFail(r, pid, data.ContractorCode);
    if (await r.findOne("CpmWorkArea", [...byProject(pid), { column: "Code", op: "eq", value: data.Code }])) throw conflict("E-CPM-DUPLICATE", `حوزهٔ کاری ${data.Code} تکراری است`);
    await weightBudget(r, pid, data.WbsCode, data.WeightPct, null);
    const row = await r.create("CpmWorkArea", { ...data, ProjectId: pid, ModelVersion: CPM_MODEL }, actor(req), "cpmarea");
    await audit(r, req, "CPM_WORKAREA_CREATE", { entityName: "CpmWorkArea", entityId: row.Id, code: row.Code, wbsCode: row.WbsCode });
    return ok(req, res, row, 201);
  }));

  app.patch(`${base}/work-areas/:code`, need("cpm.workarea.edit"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmWorkArea", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("حوزهٔ کاری در این پروژه یافت نشد");
    modelGuard(row);
    const body = bodyOf(req);
    rejectForeign(body, [...WORK_AREA_FIELDS.filter((f) => f !== "Code"), "RowVersion"]);
    requireVersion(row, body.RowVersion);
    const data = normalizeWorkArea({ ...pickFields(row, WORK_AREA_FIELDS), ...pickFields(body, WORK_AREA_FIELDS), Code: row.Code });
    if (data.WbsCode !== row.WbsCode) {
      const wbs = await r.findOne("WbsNode", [...byProject(pid), { column: "Code", op: "eq", value: data.WbsCode }]);
      if (!wbs) throw bad("E-CPM-WBS", `گره WBS «${data.WbsCode}» در این پروژه نیست`, { field: "WbsCode" });
    }
    if (data.ContractorCode !== row.ContractorCode) await contractorOrFail(r, pid, data.ContractorCode);
    if (row.Status !== "closed" && data.Status === "closed") {
      const openIr = await r.findOne("CpmInspectionRequest", [...byProject(pid), { column: "WorkAreaCode", op: "eq", value: row.Code }, { column: "Status", op: "eq", value: "submitted" }]);
      if (openIr) throw conflict("E-CPM-OPEN-INSPECTIONS", `درخواست بازرسی باز (${openIr.RequestNo}) برای این حوزه وجود دارد؛ پیش از بستن، تکلیف آن را روشن کنید`);
    }
    await weightBudget(r, pid, data.WbsCode, data.WeightPct, row.Id);
    const result = await r.patch("CpmWorkArea", row.Id, { ...data, ModelVersion: CPM_MODEL }, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-CPM-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("CpmWorkArea", row.Id);
    await audit(r, req, "CPM_WORKAREA_UPDATE", { entityName: "CpmWorkArea", entityId: row.Id, code: row.Code, status: saved.Status });
    return ok(req, res, saved);
  }));

  app.delete(`${base}/work-areas/:code`, need("cpm.workarea.edit"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmWorkArea", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("حوزهٔ کاری در این پروژه یافت نشد");
    const used = await r.findOne("CpmDprEntry", [...byProject(pid), { column: "WorkAreaCode", op: "eq", value: row.Code }]);
    if (used) throw conflict("E-CPM-IN-USE", `گزارش روزانهٔ ${used.ReportNo} به این حوزه گره خورده است؛ حذف ممکن نیست`);
    await r.remove("CpmWorkArea", row.Id);
    await audit(r, req, "CPM_WORKAREA_DELETE", { entityName: "CpmWorkArea", entityId: row.Id, code: row.Code, severity: "warn" });
    return ok(req, res, { deleted: row.Code });
  }));

  /* ═══════════════ CPM-2 گزارش روزانهٔ پیمانکار ═══════════════ */
  const dprTransition = (row, action, actorId, note) => {
    const status = String(row.Status);
    if (action === "submit") {
      if (status !== "draft" && status !== "returned") throw conflict("E-CPM-STATE", "فقط پیش‌نویس یا گزارش برگشتی ارسال می‌شود");
      return { Status: "submitted", SubmittedAt: new Date().toISOString(), SubmittedBy: actorId };
    }
    if (action === "approve" || action === "return") {
      if (status !== "submitted") throw conflict("E-CPM-STATE", "تأیید/برگشت فقط برای گزارش ارسال‌شده ممکن است");
      if (String(row.CreatedBy) === actorId) throw conflict("E-CPM-SOD", "ثبت‌کنندهٔ گزارش نمی‌تواند خودش آن را تأیید یا برگشت دهد (تفکیک وظیفه)");
      if (action === "return" && !String(note || "").trim()) throw bad("E-CPM-NOTE", "برگشت گزارش بدون دلیل ثبت نمی‌شود");
      return action === "approve"
        ? { Status: "approved", ApprovedAt: new Date().toISOString(), ApprovedBy: actorId }
        : { Status: "returned", ReturnNoteFa: String(note).trim().slice(0, 1000) };
    }
    throw bad("E-CPM-ACTION", "اقدام مجاز نیست");
  };

  app.post(`${base}/dpr`, need("cpm.dpr.record"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    rejectForeign(body, DPR_FIELDS);
    const data = normalizeDprEntry(body);
    if (data.Status !== "draft") throw bad("E-CPM-STATE", "گزارش روزانه همیشه پیش‌نویس ساخته می‌شود");
    await contractorOrFail(r, pid, data.ContractorCode);
    if (data.WorkAreaCode) await workAreaOrFail(r, pid, data.WorkAreaCode);
    if (await r.findOne("CpmDprEntry", [...byProject(pid), { column: "ReportNo", op: "eq", value: data.ReportNo }])) throw conflict("E-CPM-DUPLICATE", `گزارش ${data.ReportNo} تکراری است`);
    const row = await r.create("CpmDprEntry", { ...data, Status: "draft", ProjectId: pid, ModelVersion: CPM_MODEL }, actor(req), "cpmdpr");
    await audit(r, req, "CPM_DPR_CREATE", { entityName: "CpmDprEntry", entityId: row.Id, code: row.ReportNo, reportDate: row.ReportDate });
    return ok(req, res, row, 201);
  }));

  app.patch(`${base}/dpr/:no`, need("cpm.dpr.record"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmDprEntry", [...byProject(pid), { column: "ReportNo", op: "eq", value: req.params.no }]);
    if (!row) throw notFound("گزارش روزانه در این پروژه یافت نشد");
    modelGuard(row);
    if (!["draft", "returned"].includes(String(row.Status))) throw conflict("E-CPM-LOCKED", "گزارش ارسال/تأییدشده قفل است؛ برای اصلاح، برگشت لازم است");
    const body = bodyOf(req);
    rejectForeign(body, [...DPR_FIELDS.filter((f) => f !== "ReportNo" && f !== "Status"), "RowVersion"]);
    requireVersion(row, body.RowVersion);
    const data = normalizeDprEntry({ ...pickFields(row, DPR_FIELDS), ...pickFields(body, DPR_FIELDS), ReportNo: row.ReportNo });
    await contractorOrFail(r, pid, data.ContractorCode);
    if (data.WorkAreaCode) await workAreaOrFail(r, pid, data.WorkAreaCode);
    const result = await r.patch("CpmDprEntry", row.Id, { ...data, ModelVersion: CPM_MODEL }, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-CPM-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("CpmDprEntry", row.Id);
    await audit(r, req, "CPM_DPR_UPDATE", { entityName: "CpmDprEntry", entityId: row.Id, code: row.ReportNo });
    return ok(req, res, saved);
  }));

  app.post(`${base}/dpr/:no/transition`, need("cpm.dpr.view"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmDprEntry", [...byProject(pid), { column: "ReportNo", op: "eq", value: req.params.no }]);
    if (!row) throw notFound("گزارش روزانه در این پروژه یافت نشد");
    modelGuard(row);
    const body = bodyOf(req);
    const action = String(body.action || "");
    const permission = action === "submit" ? "cpm.dpr.record" : "cpm.dpr.approve";
    if (!grantOf(req)(permission)) throw new CpmError(403, "E-CPM-FORBIDDEN", "مجوز این اقدام را ندارید", { permission });
    const patch = dprTransition(row, action, actor(req), body.note);
    const result = await r.patch("CpmDprEntry", row.Id, patch, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-CPM-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("CpmDprEntry", row.Id);
    await audit(r, req, `CPM_DPR_${action.toUpperCase()}`, { entityName: "CpmDprEntry", entityId: row.Id, code: row.ReportNo, status: saved.Status });
    return ok(req, res, saved);
  }));

  /* پیوست‌ها/عکس‌ها: فراداده در پایگاه داده، فایل زیر storage/cpm-dpr. */
  app.get(`${base}/dpr/:no/attachments`, need("cpm.dpr.view"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmDprEntry", [...byProject(pid), { column: "ReportNo", op: "eq", value: req.params.no }]);
    if (!row) throw notFound("گزارش روزانه در این پروژه یافت نشد");
    const items = await r.list("CpmDprAttachment", { where: [...byProject(pid), { column: "ReportNo", op: "eq", value: row.ReportNo }], limit: 2000 });
    return ok(req, res, { reportNo: row.ReportNo, items, downloadBase: `${base}/dpr/${encodeURIComponent(row.ReportNo)}/attachments` });
  }));

  app.post(`${base}/dpr/:no/attachments`, need("cpm.dpr.record"), upload.single("file"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmDprEntry", [...byProject(pid), { column: "ReportNo", op: "eq", value: req.params.no }]);
    if (!row) throw notFound("گزارش روزانه در این پروژه یافت نشد");
    if (!req.file) throw bad("E-CPM-FILE", "فایل پیوست لازم است (فیلد file)");
    if (!accepted.has(req.file.mimetype)) throw bad("E-CPM-FILE-TYPE", `نوع فایل مجاز نیست: ${req.file.mimetype}`);
    const kind = ATTACHMENT_KINDS.includes(String(req.body?.kind)) ? String(req.body.kind) : "attachment";
    const stored = `${crypto.randomUUID()}${path.extname(String(req.file.originalname || "")).slice(0, 8).replace(/[^A-Za-z0-9.]/g, "")}`;
    fs.writeFileSync(path.join(attachDir, stored), req.file.buffer);
    const checksum = `sha256-${crypto.createHash("sha256").update(req.file.buffer).digest("hex").slice(0, 32)}`;
    const created = await r.create("CpmDprAttachment", {
      ProjectId: pid,
      ReportNo: row.ReportNo,
      Kind: kind,
      FileName: path.basename(String(req.file.originalname || "file")).slice(0, 200),
      MimeType: String(req.file.mimetype).slice(0, 120),
      SizeBytes: req.file.size,
      Checksum: checksum,
      StoredName: stored,
      NoteFa: String(req.body?.note || "").trim().slice(0, 500) || null,
      UploadedBy: actor(req),
      UploadedAt: new Date().toISOString(),
    }, actor(req), "cpmatt");
    await audit(r, req, "CPM_DPR_ATTACHMENT", { entityName: "CpmDprAttachment", entityId: created.Id, code: row.ReportNo, kind });
    return ok(req, res, created, 201);
  }));

  app.get(`${base}/dpr/:no/attachments/:id/download`, need("cpm.dpr.view"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmDprAttachment", [...byProject(pid), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw notFound("پیوست یافت نشد");
    const file = path.join(attachDir, path.basename(String(row.StoredName)));
    if (!fs.existsSync(file)) throw notFound("فایل پیوست روی دیسک نیست");
    res.setHeader("Content-Type", String(row.MimeType || "application/octet-stream"));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(String(row.FileName || "file"))}`);
    return res.sendFile(file);
  }));

  app.delete(`${base}/dpr/:no/attachments/:id`, need("cpm.dpr.record"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmDprAttachment", [...byProject(pid), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw notFound("پیوست یافت نشد");
    const parent = await r.findOne("CpmDprEntry", [...byProject(pid), { column: "ReportNo", op: "eq", value: row.ReportNo }]);
    if (!parent) throw notFound("گزارش روزانهٔ پیوست یافت نشد");
    if (String(parent.Status) === "approved") throw conflict("E-CPM-LOCKED", "گزارش تأییدشده قفل است؛ حذف پیوست ممکن نیست");
    try { fs.rmSync(path.join(attachDir, path.basename(String(row.StoredName))), { force: true }); } catch { /* فایل نبود؛ فراداده پاک می‌شود */ }
    await r.remove("CpmDprAttachment", row.Id);
    await audit(r, req, "CPM_DPR_ATTACHMENT_DELETE", { entityName: "CpmDprAttachment", entityId: row.Id, code: row.ReportNo, severity: "warn" });
    return ok(req, res, { deleted: row.Id });
  }));

  /* ═══════════════ CPM-3 گزارش‌های دیسیپلینی ═══════════════ */
  const replaceLines = async (r, pid, reportNo, lines, actorId) => {
    const existing = await r.list("CpmDisciplineLine", { where: [...byProject(pid), { column: "ReportNo", op: "eq", value: reportNo }], limit: MAX_LINES });
    for (const line of existing) await r.remove("CpmDisciplineLine", line.Id);
    for (const line of lines) {
      await r.create("CpmDisciplineLine", { ...line, ProjectId: pid, ReportNo: reportNo }, actorId, "cpmlin");
    }
  };

  app.post(`${base}/discipline-reports`, need("cpm.discipline.record"), route(async (req, res, r, pid) => {
    const data = normalizeDisciplineReport(bodyOf(req));
    if (data.Status !== "draft") throw bad("E-CPM-STATE", "گزارش دیسیپلینی همیشه پیش‌نویس ساخته می‌شود");
    await contractorOrFail(r, pid, data.ContractorCode);
    if (data.WorkAreaCode) await workAreaOrFail(r, pid, data.WorkAreaCode);
    if (await r.findOne("CpmDisciplineReport", [...byProject(pid), { column: "ReportNo", op: "eq", value: data.ReportNo }])) throw conflict("E-CPM-DUPLICATE", `گزارش ${data.ReportNo} تکراری است`);
    const metrics = disciplineMetrics(data.Lines);
    const { Lines, ...head } = data;
    const row = await r.create("CpmDisciplineReport", {
      ...head, Status: "draft", ProjectId: pid, ModelVersion: CPM_MODEL,
      LineCount: metrics.lines, RejectedCount: metrics.rejectedItems, NdtPassRate: metrics.ndtPassRate,
    }, actor(req), "cpmrep");
    await replaceLines(r, pid, row.ReportNo, Lines, actor(req));
    await audit(r, req, "CPM_DISCIPLINE_CREATE", { entityName: "CpmDisciplineReport", entityId: row.Id, code: row.ReportNo, discipline: row.Discipline, lines: metrics.lines });
    return ok(req, res, { ...row, Lines, metrics }, 201);
  }));

  app.patch(`${base}/discipline-reports/:no`, need("cpm.discipline.record"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmDisciplineReport", [...byProject(pid), { column: "ReportNo", op: "eq", value: req.params.no }]);
    if (!row) throw notFound("گزارش دیسیپلینی در این پروژه یافت نشد");
    modelGuard(row);
    if (!["draft", "returned"].includes(String(row.Status))) throw conflict("E-CPM-LOCKED", "گزارش ارسال/تأییدشده قفل است؛ برای اصلاح، برگشت لازم است");
    const body = bodyOf(req);
    rejectForeign(body, [...DISCIPLINE_REPORT_FIELDS.filter((f) => f !== "ReportNo" && f !== "Status" && f !== "Discipline"), "RowVersion"]);
    requireVersion(row, body.RowVersion);
    /* خطوط فقط وقتی جایگزین می‌شوند که در بدنه بیایند؛ وگرنه همان خطوط می‌مانند. */
    const keptLines = Array.isArray(body.Lines)
      ? {}
      : { Lines: (await r.list("CpmDisciplineLine", { where: [...byProject(pid), { column: "ReportNo", op: "eq", value: row.ReportNo }], limit: MAX_LINES })).map((l) => pickFields(l, DISCIPLINE_LINE_FIELDS)) };
    const data = normalizeDisciplineReport({ ...pickFields(row, DISCIPLINE_REPORT_FIELDS), ...pickFields(body, DISCIPLINE_REPORT_FIELDS), ...keptLines, ReportNo: row.ReportNo, Discipline: row.Discipline });
    await contractorOrFail(r, pid, data.ContractorCode);
    if (data.WorkAreaCode) await workAreaOrFail(r, pid, data.WorkAreaCode);
    const metrics = disciplineMetrics(data.Lines);
    const { Lines, ...head } = data;
    const result = await r.patch("CpmDisciplineReport", row.Id, {
      ...head, ModelVersion: CPM_MODEL, LineCount: metrics.lines, RejectedCount: metrics.rejectedItems, NdtPassRate: metrics.ndtPassRate,
    }, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-CPM-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    await replaceLines(r, pid, row.ReportNo, Lines, actor(req));
    const saved = await r.get("CpmDisciplineReport", row.Id);
    await audit(r, req, "CPM_DISCIPLINE_UPDATE", { entityName: "CpmDisciplineReport", entityId: row.Id, code: row.ReportNo, lines: metrics.lines });
    return ok(req, res, { ...saved, Lines, metrics });
  }));

  app.post(`${base}/discipline-reports/:no/transition`, need("cpm.discipline.view"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmDisciplineReport", [...byProject(pid), { column: "ReportNo", op: "eq", value: req.params.no }]);
    if (!row) throw notFound("گزارش دیسیپلینی در این پروژه یافت نشد");
    modelGuard(row);
    const body = bodyOf(req);
    const action = String(body.action || "");
    const permission = action === "submit" ? "cpm.discipline.record" : "cpm.discipline.approve";
    if (!grantOf(req)(permission)) throw new CpmError(403, "E-CPM-FORBIDDEN", "مجوز این اقدام را ندارید", { permission });
    const actorId = actor(req);
    const status = String(row.Status);
    let patch;
    if (action === "submit") {
      if (status !== "draft" && status !== "returned") throw conflict("E-CPM-STATE", "فقط پیش‌نویس یا گزارش برگشتی ارسال می‌شود");
      patch = { Status: "submitted", SubmittedAt: new Date().toISOString(), SubmittedBy: actorId };
    } else if (action === "approve" || action === "return") {
      if (status !== "submitted") throw conflict("E-CPM-STATE", "تأیید/برگشت فقط برای گزارش ارسال‌شده ممکن است");
      if (String(row.CreatedBy) === actorId) throw conflict("E-CPM-SOD", "ثبت‌کنندهٔ گزارش نمی‌تواند خودش آن را تأیید یا برگشت دهد (تفکیک وظیفه)");
      if (action === "return" && !String(body.note || "").trim()) throw bad("E-CPM-NOTE", "برگشت گزارش بدون دلیل ثبت نمی‌شود");
      patch = action === "approve"
        ? { Status: "approved", ApprovedAt: new Date().toISOString(), ApprovedBy: actorId }
        : { Status: "returned", ReturnNoteFa: String(body.note).trim().slice(0, 1000) };
    } else throw bad("E-CPM-ACTION", "اقدام مجاز نیست");
    const result = await r.patch("CpmDisciplineReport", row.Id, patch, actorId, row.RowVersion);
    if (!result.ok) throw conflict("E-CPM-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("CpmDisciplineReport", row.Id);
    await audit(r, req, `CPM_DISCIPLINE_${action.toUpperCase()}`, { entityName: "CpmDisciplineReport", entityId: row.Id, code: row.ReportNo, status: saved.Status });
    return ok(req, res, saved);
  }));

  /* ═══════════════ CPM-4 درخواست بازرسی و آزادسازی QC ═══════════════ */
  app.post(`${base}/inspections`, need("cpm.inspection.request"), route(async (req, res, r, pid) => {
    const data = normalizeInspection(bodyOf(req));
    await contractorOrFail(r, pid, data.ContractorCode);
    if (data.WorkAreaCode) await workAreaOrFail(r, pid, data.WorkAreaCode);
    const activity = await r.findOne("Activity", [...byProject(pid), { column: "Code", op: "eq", value: data.ActivityCode }]);
    if (!activity) throw bad("E-CPM-ACTIVITY", `فعالیت «${data.ActivityCode}» در برنامهٔ همین پروژه نیست`, { field: "ActivityCode" });
    if (data.NcrRef) {
      const ncr = await r.findOne("Ncr", [...byProject(pid), { column: "Code", op: "eq", value: data.NcrRef }]);
      if (!ncr) throw bad("E-CPM-NCR", `عدم انطباق «${data.NcrRef}» در این پروژه نیست`, { field: "NcrRef" });
    }
    if (await r.findOne("CpmInspectionRequest", [...byProject(pid), { column: "RequestNo", op: "eq", value: data.RequestNo }])) throw conflict("E-CPM-DUPLICATE", `درخواست ${data.RequestNo} تکراری است`);
    const row = await r.create("CpmInspectionRequest", {
      ...data, Status: "draft", ProjectId: pid, RequestedBy: actor(req), ModelVersion: CPM_MODEL,
    }, actor(req), "cpmir");
    await audit(r, req, "CPM_INSPECTION_CREATE", { entityName: "CpmInspectionRequest", entityId: row.Id, code: row.RequestNo, activityCode: row.ActivityCode });
    return ok(req, res, { ...row, notice: noticeCheck(row.RequestedAt, row.TargetDate) }, 201);
  }));

  app.post(`${base}/inspections/:no/transition`, need("cpm.inspection.view"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CpmInspectionRequest", [...byProject(pid), { column: "RequestNo", op: "eq", value: req.params.no }]);
    if (!row) throw notFound("درخواست بازرسی در این پروژه یافت نشد");
    modelGuard(row);
    const body = bodyOf(req);
    const action = String(body.action || "");
    const permission = action === "release" || action === "reject" ? "cpm.inspection.release" : "cpm.inspection.request";
    if (!grantOf(req)(permission)) throw new CpmError(403, "E-CPM-FORBIDDEN", "مجوز این اقدام را ندارید", { permission });
    const actorId = actor(req);
    const { Status, patch } = inspectionTransition({ Status: row.Status, CreatedBy: row.CreatedBy, RequestedBy: row.RequestedBy }, action, actorId, { note: body.note });
    let recordId = null;
    if (Status === "released" || Status === "rejected") {
      const activity = await r.findOne("Activity", [...byProject(pid), { column: "Code", op: "eq", value: row.ActivityCode }]);
      if (!activity) throw bad("E-CPM-ACTIVITY", `فعالیت «${row.ActivityCode}» دیگر در برنامه نیست؛ سند بازرسی ساخته نمی‌شود`);
      const record = await r.create("InspectionRecord", {
        ProjectId: pid,
        /* سند QMS متناظر: کد درخواست، نقطهٔ ITP ارجاعی همان درخواست بازرسی. */
        Code: `IR-${row.RequestNo}`.slice(0, 40),
        ItpPointCode: String(row.RequestNo).slice(0, 40),
        ActivityId: activity.Id,
        InspectedAt: todayIso(),
        Outcome: Status === "released" ? "accepted" : "rejected",
        InspectedBy: actorId,
        WitnessedBy: null,
        Remarks: String(patch.DecisionNoteFa || row.ScopeFa || "").slice(0, 1000),
      }, actorId, "insp");
      recordId = record.Id;
      patch.InspectionRecordId = recordId;
    }
    const result = await r.patch("CpmInspectionRequest", row.Id, patch, actorId, row.RowVersion);
    if (!result.ok) throw conflict("E-CPM-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("CpmInspectionRequest", row.Id);
    await audit(r, req, `CPM_INSPECTION_${action.toUpperCase()}`, {
      entityName: "CpmInspectionRequest", entityId: row.Id, code: row.RequestNo,
      status: saved.Status, inspectionRecordId: recordId, activityCode: saved.ActivityCode,
      severity: Status === "rejected" ? "warn" : "info",
    });
    return ok(req, res, { ...saved, notice: noticeCheck(saved.RequestedAt, saved.TargetDate) });
  }));

  /* وضعیت آزادسازی به تفکیک فعالیت — برای مصرف‌کننده‌های دیگر (پیشرفت/پایش). */
  app.get(`${base}/releases`, need("cpm.inspection.view"), route(async (req, res, r, pid) => {
    const requests = await cap(r, "CpmInspectionRequest", byProject(pid));
    const byActivity = {};
    for (const item of requests) {
      const key = String(item.ActivityCode);
      const bucket = byActivity[key] ?? { activityCode: key, total: 0, released: 0, open: 0, rejected: 0, latestReleaseAt: null, openRequests: [] };
      bucket.total += 1;
      if (item.Status === "released") {
        bucket.released += 1;
        if (!bucket.latestReleaseAt || String(item.ReleasedAt) > bucket.latestReleaseAt) bucket.latestReleaseAt = item.ReleasedAt ?? null;
      } else if (item.Status === "submitted") {
        bucket.open += 1;
        bucket.openRequests.push({ RequestNo: item.RequestNo, RequestType: item.RequestType, RequestedAt: item.RequestedAt });
      } else if (item.Status === "rejected") bucket.rejected += 1;
      byActivity[key] = bucket;
    }
    const items = Object.values(byActivity).map((b) => ({ ...b, releasedFully: b.open === 0 && b.released > 0 && b.rejected === 0 }));
    return ok(req, res, { projectId: pid, items: items.sort((a, b) => a.activityCode.localeCompare(b.activityCode)) });
  }));
}
