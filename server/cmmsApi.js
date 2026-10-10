/**
 * CMMS v1 HTTP boundary — بخش ۳ سازمان.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * شکل این فایل عمداً همان `server/manufacturingApi.js` است (همان هلپرهای
 * اعتبارسنجی، همان الگوی `route(permission, handler)`، همان نگاشت خطا).
 * دلیلش ساده است: کسی که یکی از این دو ماژول را نگه می‌دارد باید بتواند
 * دیگری را هم بدون یادگیری قراردادی تازه بخواند.
 *
 * سه تصمیم که باید صریح باشند:
 *
 * ۱) دامنهٔ مجوز `siteId` است، اما موتور RBAC موجود فقط `plantIds` را روی
 *    سوژه می‌شناسد (`inPlantScope`). به‌جای تغییر هستهٔ RBAC — که روی همهٔ
 *    ماژول‌های دیگر اثر می‌گذارد و تغییر شکننده است — `siteId` از همان فهرست
 *    `plantIds` سنجیده می‌شود. یعنی «دامنهٔ کارخانه» در این سامانه همان
 *    «دامنهٔ سایت بهره‌برداری» است. این یک معاملهٔ پذیرفته‌شده و ثبت‌شده است.
 *
 * ۲) هیچ محاسبهٔ استانداردی در این فایل انجام نمی‌شود. RPN، RCM، CBM،
 *    IEEE 1366، OEE، قابلیت اطمینان، LCC و پنج موتور AI همگی از
 *    `cmmsLogic.js` / `cmmsAiLogic.js` می‌آیند تا فرانت‌اند و بک‌اند از یک
 *    منبع حقیقت استفاده کنند و آزمون واحد بتواند خودِ ریاضی را بپوشاند.
 *
 * ۳) هر فرمان چندجدولی داخل `repo.transaction` اجرا می‌شود و رکورد ممیزی
 *    در همان تراکنش نوشته می‌شود، تا یا هر دو انجام شوند یا هیچ‌کدام.
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
  CMMS_MODEL_VERSION,
  ISO14224_FAILURE_MODES,
  ISO14224_FAILURE_MECHANISMS,
  ISO14224_DETECTION_METHODS,
  ISO14224_BOUNDARY_LEVELS,
  classifyIso14224,
  computeRiskPriorityNumber,
  computeCriticality,
  decideRcmTask,
  vibrationZoneIso10816,
  evaluateCondition,
  computeSupplyReliability,
  computeOee,
  computeReliability,
  computeLifeCycleCost,
  selectLccOption,
  evaluateKpiHealth,
  computeAssetCriticality,
  computeWorkOrderPriorityScore,
  buildTree,
  wouldCreateCycle,
  validateWorkflowDefinition,
  advanceWorkflow,
  CmmsWorkflowError,
} from "./cmmsLogic.js";

import {
  CMMS_AI_VERSION,
  analyzeFailure,
  optimizePmWithAi,
  recommendRepair,
  generateEquipmentTree,
  scheduleWorkOrders,
} from "./cmmsAiLogic.js";

export const CMMS_API_VERSION = "cmms-api-v1";
const ROOT = "/api/cmms/sites/:siteId";
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/;
/** کمینهٔ طول بارکد؛ چون CHECK وابسته به T-SQL در اسکیمای مشترک نگذاشتیم. */
const MIN_BARCODE_LEN = 3;

/* ═══════════════════════ خطاها ═══════════════════════ */

export class CmmsApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = "CmmsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const bad = (field, message) => new CmmsApiError(400, "CMMS_VALIDATION_FAILED", message, { field });
const notFound = () => new CmmsApiError(404, "CMMS_NOT_FOUND", "رکورد در سایت جاری یافت نشد");
const conflict = (code, message) => new CmmsApiError(409, code, message);
const businessRule = (code, message, details = {}) => new CmmsApiError(422, code, message, details);

/* ═══════════════════════ هلپرهای اعتبارسنجی ═══════════════════════ */

function text(value, field, { required = false, max = 240, min = 0, pattern } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw bad(field, `${field} الزامی است`);
    return null;
  }
  if (typeof value !== "string") throw bad(field, `${field} باید رشته باشد`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw bad(field, `${field} باید دست‌کم ${min} نویسه باشد`);
  if (trimmed.length > max) throw bad(field, `${field} نمی‌تواند بیشتر از ${max} نویسه باشد`);
  if (pattern && !pattern.test(trimmed)) throw bad(field, `${field} قالب نامعتبر دارد`);
  return trimmed;
}

function code(value, field = "Code") {
  const out = text(value, field, { required: true, max: 60, pattern: CODE_RE });
  return out;
}

function id(value, field) {
  return text(value, field, { required: true, max: 60, pattern: ID_RE });
}

function number(value, field, { required = false, min = -Infinity, max = Infinity, integer = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw bad(field, `${field} الزامی است`);
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw bad(field, `${field} باید عدد باشد`);
  if (integer && !Number.isInteger(parsed)) throw bad(field, `${field} باید عدد صحیح باشد`);
  if (parsed < min || parsed > max) throw bad(field, `${field} باید بین ${min} و ${max} باشد`);
  return parsed;
}

function optionalNumber(value, field, opts = {}) {
  if (value === undefined || value === null || value === "") return null;
  return number(value, field, opts);
}

function bool(value, field, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  throw bad(field, `${field} باید بولی باشد`);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value, field, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw bad(field, `${field} الزامی است`);
    return null;
  }
  if (typeof value !== "string" || !DATE_RE.test(value)) throw bad(field, `${field} باید تاریخ ISO (YYYY-MM-DD) باشد`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw bad(field, `${field} تاریخ معتبر نیست`);
  return value;
}

function isoDateTime(value, field, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw bad(field, `${field} الزامی است`);
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw bad(field, `${field} باید زمان معتبر ISO باشد`);
  return parsed.toISOString();
}

function oneOf(value, field, allowed, { required = false, fallback = null } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw bad(field, `${field} الزامی است`);
    return fallback;
  }
  if (!allowed.includes(value)) throw bad(field, `${field} باید یکی از [${allowed.join(", ")}] باشد`);
  return value;
}

function pageNumber(value, field, fallback, max) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) throw bad(field, `${field} باید عدد صحیح نامنفی باشد`);
  if (parsed > max) throw bad(field, `${field} نمی‌تواند بیشتر از ${max} باشد`);
  return parsed;
}

function assertOnlyKeys(body, allowed) {
  const keys = Object.keys(body ?? {});
  const extra = keys.filter((key) => !allowed.has(key));
  if (extra.length) {
    throw bad(extra[0], `فیلد ناشناخته: ${extra.join(", ")}`);
  }
}

function assertOnlyQueryKeys(query, allowed) {
  const keys = Object.keys(query ?? {});
  const extra = keys.filter((key) => !allowed.has(key));
  if (extra.length) throw bad(extra[0], `پارامتر پرس‌وجوی ناشناخته: ${extra.join(", ")}`);
}

function rowVersionFrom(req) {
  const header = req.headers?.["if-match"] ?? req.headers?.["x-row-version"];
  if (header === undefined || header === null || header === "") return undefined;
  const parsed = Number(header);
  if (!Number.isFinite(parsed)) throw bad("If-Match", "If-Match باید عدد RowVersion باشد");
  return parsed;
}

function requestActor(req) {
  return req.cmmsSubject?.id ?? "system";
}

/** تاریخ امروز (UTC) برای پرکردن ستون‌های ReadOn/PostedOn و مانند آن. */
function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

async function createAuditRecord(repo, req, action, entityName, entityId, permission, extra = {}) {
  return repo.create("AuditLog", {
    At: new Date().toISOString(),
    SubjectId: requestActor(req),
    Action: action,
    Permission: permission,
    Decision: "ALLOW",
    ProjectCode: null,
    EntityName: entityName,
    EntityId: entityId,
    Severity: "info",
    Details: { siteId: req.cmmsSiteId, traceId: req.requestId, ...extra },
  }, requestActor(req));
}

async function writeAudit(repo, req, action, entityName, entityId, permission, extra = {}) {
  try {
    await createAuditRecord(repo, req, action, entityName, entityId, permission, extra);
  } catch (err) {
    /* نوشتن ممیزی نباید فرمان موفق را شکست دهد؛ ولی باید دیده شود. */
    console.error("[%s] CMMS audit write failed for %s", req.requestId, action, err?.message);
  }
}

/** گرفتن یک رکورد با قید سایت — تا یک سایت نتواند رکورد سایت دیگر را بخواند. */
async function mustFind(tx, table, recordId, siteId) {
  const row = await tx.get(table, recordId);
  if (!row || row.SiteId !== siteId) throw notFound();
  return row;
}

/** شمارش با قید سایت. */
async function countInSite(tx, table, siteId, extraWhere = []) {
  return tx.count(table, [{ column: "SiteId", op: "eq", value: siteId }, ...extraWhere]);
}

async function listInSite(tx, table, siteId, { where = [], orderBy, limit, offset, columns } = {}) {
  return tx.list(table, {
    where: [{ column: "SiteId", op: "eq", value: siteId }, ...where],
    orderBy, limit, offset, columns,
  });
}

/** ردیف‌های فرزند یک والد، برای ساختن پاسخ تودرتو. */
async function childrenOf(tx, table, siteId, parentColumn, parentId) {
  return listInSite(tx, table, siteId, { where: [{ column: parentColumn, op: "eq", value: parentId }] });
}

/* ═══════════════════════ فهرست مسیرهای پیاده‌شده ═══════════════════════ */

export const CMMS_IMPLEMENTED_ROUTES = Object.freeze([
  /* سایت و مکان */
  "GET /api/cmms/sites",
  "GET /api/cmms/sites/:siteId",
  "PATCH /api/cmms/sites/:siteId",
  "GET /api/cmms/sites/:siteId/locations",
  "GET /api/cmms/sites/:siteId/locations/tree",
  "POST /api/cmms/sites/:siteId/locations",
  "PATCH /api/cmms/sites/:siteId/locations/:locationId",

  /* خانوادهٔ تجهیز — ساختار ۱۳گانهٔ PMworks */
  "GET /api/cmms/sites/:siteId/family-groups",
  "POST /api/cmms/sites/:siteId/family-groups",
  "GET /api/cmms/sites/:siteId/families",
  "POST /api/cmms/sites/:siteId/families",
  "PATCH /api/cmms/sites/:siteId/families/:familyId",
  "POST /api/cmms/sites/:siteId/families/:familyId/approve",
  "GET /api/cmms/sites/:siteId/families/:familyId",
  "GET /api/cmms/sites/:siteId/families/:familyId/nodes",
  "POST /api/cmms/sites/:siteId/families/:familyId/nodes",
  "GET /api/cmms/sites/:siteId/families/:familyId/failure-modes",
  "POST /api/cmms/sites/:siteId/families/:familyId/failure-modes",
  "GET /api/cmms/sites/:siteId/families/:familyId/pm-tasks",
  "POST /api/cmms/sites/:siteId/families/:familyId/pm-tasks",
  "POST /api/cmms/sites/:siteId/families/:familyId/pm-tasks/:taskId/checklist-items",
  "GET /api/cmms/sites/:siteId/families/:familyId/custom-fields",
  "POST /api/cmms/sites/:siteId/families/:familyId/custom-fields",
  "GET /api/cmms/sites/:siteId/families/:familyId/documents",
  "POST /api/cmms/sites/:siteId/families/:familyId/documents",
  "POST /api/cmms/sites/:siteId/families/:familyId/bulk-changes",
  "POST /api/cmms/sites/:siteId/families/:familyId/bulk-changes/:changeId/apply",

  /* تجهیز فیزیکی */
  "GET /api/cmms/sites/:siteId/assets",
  "GET /api/cmms/sites/:siteId/assets/tree",
  "POST /api/cmms/sites/:siteId/assets",
  "PATCH /api/cmms/sites/:siteId/assets/:assetId",
  "GET /api/cmms/sites/:siteId/assets/:assetId",
  "POST /api/cmms/sites/:siteId/assets/:assetId/family-assignments",
  "POST /api/cmms/sites/:siteId/assets/:assetId/barcodes",
  "POST /api/cmms/sites/:siteId/assets/:assetId/documents",
  "GET /api/cmms/sites/:siteId/assets/:assetId/meters",
  "POST /api/cmms/sites/:siteId/assets/:assetId/meters",
  "POST /api/cmms/sites/:siteId/meters/:meterId/readings",
  "GET /api/cmms/sites/:siteId/assets/:assetId/lifecycle-events",

  /* درخواست‌کار و دستورکار */
  "GET /api/cmms/sites/:siteId/work-requests",
  "POST /api/cmms/sites/:siteId/work-requests",
  "POST /api/cmms/sites/:siteId/work-requests/:requestId/review",
  "POST /api/cmms/sites/:siteId/work-orders",
  "GET /api/cmms/sites/:siteId/work-orders",
  "GET /api/cmms/sites/:siteId/work-orders/:workOrderId",
  "POST /api/cmms/sites/:siteId/work-orders/:workOrderId/release",
  "POST /api/cmms/sites/:siteId/work-orders/:workOrderId/start",
  "POST /api/cmms/sites/:siteId/work-orders/:workOrderId/complete",
  "POST /api/cmms/sites/:siteId/work-orders/:workOrderId/close",
  "POST /api/cmms/sites/:siteId/work-orders/:workOrderId/cancel",
  "POST /api/cmms/sites/:siteId/work-orders/:workOrderId/tasks",
  "PATCH /api/cmms/sites/:siteId/work-orders/:workOrderId/tasks/:taskId",
  "POST /api/cmms/sites/:siteId/work-orders/:workOrderId/labor",
  "POST /api/cmms/sites/:siteId/work-orders/:workOrderId/materials",
  "POST /api/cmms/sites/:siteId/work-orders/:workOrderId/costs",
  "GET /api/cmms/sites/:siteId/work-orders/:workOrderId/costs",

  /* خرابی، توقف و پایش وضعیت */
  "POST /api/cmms/sites/:siteId/failures",
  "GET /api/cmms/sites/:siteId/failures",
  "POST /api/cmms/sites/:siteId/downtime",
  "POST /api/cmms/sites/:siteId/condition-readings",
  "POST /api/cmms/sites/:siteId/condition-thresholds",

  /* منابع */
  "GET /api/cmms/sites/:siteId/spare-parts",
  "POST /api/cmms/sites/:siteId/spare-parts",
  "PATCH /api/cmms/sites/:siteId/spare-parts/:partId",
  "POST /api/cmms/sites/:siteId/spare-parts/:partId/transactions",
  "GET /api/cmms/sites/:siteId/technicians",
  "POST /api/cmms/sites/:siteId/technicians",
  "POST /api/cmms/sites/:siteId/technicians/:technicianId/skills",
  "GET /api/cmms/sites/:siteId/crews",
  "POST /api/cmms/sites/:siteId/crews",
  "GET /api/cmms/sites/:siteId/vendors",
  "POST /api/cmms/sites/:siteId/vendors",

  /* برنامه‌ریزی */
  "GET /api/cmms/sites/:siteId/pm-schedules",
  "POST /api/cmms/sites/:siteId/pm-schedules",
  "GET /api/cmms/sites/:siteId/pm-schedules/due",

  /* تحلیل و استانداردها */
  "POST /api/cmms/sites/:siteId/fmea",
  "POST /api/cmms/sites/:siteId/fmea/:fmeaId/entries",
  "POST /api/cmms/sites/:siteId/rcm",
  "POST /api/cmms/sites/:siteId/rcm/:rcmId/entries",
  "POST /api/cmms/sites/:siteId/rca-cases",
  "POST /api/cmms/sites/:siteId/rca-cases/:caseId/entries",
  "POST /api/cmms/sites/:siteId/reliability/compute",
  "POST /api/cmms/sites/:siteId/oee/compute",
  "POST /api/cmms/sites/:siteId/supply-reliability/compute",
  "POST /api/cmms/sites/:siteId/lcc/compute",
  "POST /api/cmms/sites/:siteId/lcc/select",

  /* شاخص و هشدار */
  "GET /api/cmms/sites/:siteId/kpi-targets",
  "POST /api/cmms/sites/:siteId/kpi-targets",
  "POST /api/cmms/sites/:siteId/kpi-results",
  "GET /api/cmms/sites/:siteId/alerts",
  "POST /api/cmms/sites/:siteId/alerts",
  "POST /api/cmms/sites/:siteId/alerts/:alertId/acknowledge",
  "POST /api/cmms/sites/:siteId/alerts/:alertId/resolve",

  /* گردش‌کار */
  "GET /api/cmms/sites/:siteId/workflows",
  "POST /api/cmms/sites/:siteId/workflows",
  "POST /api/cmms/sites/:siteId/workflow-instances",
  "POST /api/cmms/sites/:siteId/workflow-instances/:instanceId/advance",

  /* هوش مصنوعی */
  "POST /api/cmms/sites/:siteId/ai/failure-analysis",
  "POST /api/cmms/sites/:siteId/ai/pm-optimization",
  "POST /api/cmms/sites/:siteId/ai/repair-guidance",
  "POST /api/cmms/sites/:siteId/ai/tree-generator",
  "POST /api/cmms/sites/:siteId/ai/smart-scheduler",
  "GET /api/cmms/sites/:siteId/ai/recommendations",
  "POST /api/cmms/sites/:siteId/ai/recommendations/:recommendationId/decide",

  /* داشبورد */
  "GET /api/cmms/sites/:siteId/dashboard",
]);

/* ═══════════════════════ ثبت مسیرها ═══════════════════════ */

export function registerCmmsRoutes(app, { repo, subjects, evaluate, subjectPermissions } = {}) {
  if (!app || typeof app.get !== "function" || typeof app.post !== "function") {
    throw new TypeError("Express-compatible app is required");
  }
  if (typeof repo !== "function" && (!repo || typeof repo.list !== "function")) {
    throw new TypeError("CMMS repository is required");
  }
  if (!Array.isArray(subjects) || typeof evaluate !== "function") {
    throw new TypeError("CMMS RBAC dependencies are required");
  }

  const getRepo = async () => (typeof repo === "function" ? repo() : repo);

  const fail = (req, res, err) => {
    if (err instanceof CmmsApiError) {
      return res.status(err.status).json({
        ok: false,
        error: { code: err.code, message: err.message, ...err.details, traceId: req.requestId },
      });
    }
    if (err instanceof CmmsWorkflowError) {
      const status = err.code === "CMMS_WF_FORBIDDEN" ? 403 : 422;
      return res.status(status).json({
        ok: false, error: { code: err.code, message: err.message, traceId: req.requestId },
      });
    }
    if (err instanceof RangeError || err instanceof TypeError) {
      /* موتورهای دامنه ورودی نامعتبر را با RangeError اعلام می‌کنند. این خطاها
       * باگ کاربرند نه باگ سرور، پس ۴۰۰ برمی‌گردانیم نه ۵۰۰. */
      return res.status(400).json({
        ok: false, error: { code: "CMMS_DOMAIN_VALIDATION_FAILED", message: err.message, traceId: req.requestId },
      });
    }
    if (err?.code === "ROW_VALIDATION_FAILED") {
      return res.status(400).json({
        ok: false, error: { code: "CMMS_VALIDATION_FAILED", message: err.message, issues: err.issues, traceId: req.requestId },
      });
    }
    if (["UNIQUE_VIOLATION", "DUPLICATE_KEY"].includes(err?.code) || [2601, 2627].includes(err?.number)) {
      return res.status(409).json({
        ok: false, error: { code: "CMMS_DUPLICATE", message: "کد یا کلید یکتا در این سایت تکراری است", traceId: req.requestId },
      });
    }
    if (err?.code === "PERSISTENCE_UNAVAILABLE") {
      return res.status(503).json({
        ok: false, error: { code: "CMMS_PERSISTENCE_UNAVAILABLE", message: "مخزن داده در دسترس نیست", traceId: req.requestId },
      });
    }
    console.error("[%s] CMMS API error:", req.requestId, err);
    return res.status(500).json({
      ok: false, error: { code: "CMMS_INTERNAL_ERROR", message: "خطای داخلی سرور", traceId: req.requestId },
    });
  };

  /**
   * پوشش مشترک همهٔ مسیرها: اعتبار siteId، احراز هویت، ارزیابی مجوز.
   *
   * `siteId` از همان `plantIds` سوژه سنجیده می‌شود — توضیحش در سرآییند فایل است.
   */
  const route = (permission, handler, status = 200) => async (req, res) => {
    try {
      const siteId = String(req.params?.siteId ?? "").trim();
      if (!ID_RE.test(siteId)) throw new CmmsApiError(400, "CMMS_BAD_SITE_ID", "شناسهٔ سایت نامعتبر است");
      const userId = String(req.headers?.["x-user-id"] ?? "").trim();
      const subject = userId ? subjects.find((item) => item.id === userId && item.active !== false) ?? null : null;
      if (!subject) {
        throw new CmmsApiError(401, "CMMS_AUTH_REQUIRED", "هویت کاربر معتبر و فعال الزامی است", { permission });
      }
      const decision = evaluate(subject, permission, { plantId: siteId });
      if (!decision.allow) {
        const scopeDenied = decision.code === "DENY_PLANT_SCOPE";
        throw new CmmsApiError(
          403,
          scopeDenied ? "CMMS_SITE_SCOPE_DENIED" : "CMMS_FORBIDDEN",
          scopeDenied ? "کاربر به این سایت تخصیص ندارد" : "مجوز این عمل را ندارید",
          { permission, reason: decision.code },
        );
      }
      req.cmmsSubject = subject;
      req.cmmsSiteId = siteId;
      const data = await handler({ repo: await getRepo(), req, subject, siteId, permission });
      if (status === 204) return res.status(204).end();
      return res.status(status).json({ ok: true, data, meta: { traceId: req.requestId, version: CMMS_API_VERSION } });
    } catch (err) {
      return fail(req, res, err);
    }
  };

  /** مسیر بدون siteId (فهرست سایت‌های مجاز کاربر). */
  const globalRoute = (permission, handler) => async (req, res) => {
    try {
      const userId = String(req.headers?.["x-user-id"] ?? "").trim();
      const subject = userId ? subjects.find((item) => item.id === userId && item.active !== false) ?? null : null;
      if (!subject) throw new CmmsApiError(401, "CMMS_AUTH_REQUIRED", "هویت کاربر معتبر و فعال الزامی است", { permission });
      req.cmmsSubject = subject;
      const data = await handler({ repo: await getRepo(), req, subject, permission });
      return res.status(200).json({ ok: true, data, meta: { traceId: req.requestId, version: CMMS_API_VERSION } });
    } catch (err) {
      return fail(req, res, err);
    }
  };

  /* ───────────────────────── ۱. سایت و مکان ───────────────────────── */

  app.get("/api/cmms/sites", globalRoute("cmms.asset.view", async ({ repo: r, subject }) => {
    const all = await r.list("CmmsSite", { where: [] });
    /* دامنه‌بندی: کاربر فقط سایت‌هایی را می‌بیند که در فهرست plantIds اوست.
     * بدون این فیلتر، یک کاربر سایت‌های کل سازمان را می‌دید. */
    const allowed = subject.plantIds ?? [];
    const scoped = allowed.includes("*") ? all : all.filter((site) => allowed.includes(site.SiteId));
    return { sites: scoped, total: scoped.length };
  }));

  app.get(`${ROOT}`, route("cmms.asset.view", async ({ repo: r, req, siteId }) => {
    const site = await r.findOne("CmmsSite", [{ column: "SiteId", op: "eq", value: siteId }]);
    if (!site) throw notFound();
    const [assets, families, openAlerts, openWorkOrders] = await Promise.all([
      countInSite(r, "CmmsAsset", siteId),
      countInSite(r, "CmmsFamily", siteId),
      countInSite(r, "CmmsAlert", siteId, [{ column: "Status", op: "eq", value: "open" }]),
      countInSite(r, "CmmsWorkOrder", siteId, [{ column: "Status", op: "in", value: ["released", "in-progress"] }]),
    ]);
    return { site, counts: { assets, families, openAlerts, openWorkOrders }, requestId: req.requestId };
  }));

  app.patch(`${ROOT}`, route("cmms.asset.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["SiteCode", "NameFa", "NameEn", "SiteType", "PolicyStatementFa", "TimeZoneId", "Currency", "BaseYear", "IsActive", "NoteFa", "RowVersion"]));
    const site = await r.findOne("CmmsSite", [{ column: "SiteId", op: "eq", value: siteId }]);
    if (!site) throw notFound();
    const patch = {};
    if (req.body.SiteCode !== undefined) patch.SiteCode = code(req.body.SiteCode, "SiteCode");
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.NameEn !== undefined) patch.NameEn = text(req.body.NameEn, "NameEn", { max: 240 });
    if (req.body.SiteType !== undefined) {
      patch.SiteType = oneOf(req.body.SiteType, "SiteType", ["plant", "refinery", "power", "drilling", "utility", "workshop", "office"], { required: true });
    }
    if (req.body.PolicyStatementFa !== undefined) patch.PolicyStatementFa = text(req.body.PolicyStatementFa, "PolicyStatementFa", { max: 2000 });
    if (req.body.TimeZoneId !== undefined) patch.TimeZoneId = text(req.body.TimeZoneId, "TimeZoneId", { max: 80 });
    if (req.body.Currency !== undefined) patch.Currency = text(req.body.Currency, "Currency", { required: true, max: 8 });
    if (req.body.BaseYear !== undefined) patch.BaseYear = optionalNumber(req.body.BaseYear, "BaseYear", { integer: true, min: 1900, max: 2200 });
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");

    const result = await r.patch("CmmsSite", site.Id, patch, requestActor(req), req.body.RowVersion ?? site.RowVersion);
    if (!result.ok) {
      throw result.code === "NOT_FOUND" ? notFound()
        : conflict("CMMS_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است؛ تازه‌سازی کنید");
    }
    await writeAudit(r, req, "CMMS_SITE_UPDATED", "CmmsSite", site.Id, "cmms.asset.edit");
    return r.get("CmmsSite", site.Id);
  }));

  app.get(`${ROOT}/locations`, route("cmms.location.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["level", "parentLocationId", "isActive", "limit", "offset"]));
    const where = [];
    if (req.query.level !== undefined) where.push({ column: "Level", op: "eq", value: number(req.query.level, "level", { integer: true, min: 1, max: 9 }) });
    if (req.query.parentLocationId !== undefined) where.push({ column: "ParentLocationId", op: "eq", value: id(req.query.parentLocationId, "parentLocationId") });
    if (req.query.isActive !== undefined) where.push({ column: "IsActive", op: "eq", value: bool(req.query.isActive, "isActive") });
    const rows = await listInSite(r, "CmmsLocation", siteId, {
      where,
      orderBy: [{ column: "Level", dir: "asc" }, { column: "LocationCode", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 200, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 1_000_000),
    });
    return { locations: rows, total: rows.length };
  }));

  app.get(`${ROOT}/locations/tree`, route("cmms.location.view", async ({ repo: r, req, siteId }) => {
    const rows = await listInSite(r, "CmmsLocation", siteId, { orderBy: [{ column: "LocationCode", dir: "asc" }] });
    const tree = buildTree(rows.map((row) => ({
      id: row.Id, parentId: row.ParentLocationId ?? null, code: row.LocationCode, name: row.NameFa,
    })));
    if (tree.cycleMembers.length) {
      throw businessRule("CMMS_LOCATION_CYCLE", "در ساختار مکان حلقه وجود دارد و درخت ساخته نشد", { cycleMembers: tree.cycleMembers });
    }
    return { roots: tree.roots, maxDepth: tree.maxDepth, total: tree.flat.length };
  }));

  app.post(`${ROOT}/locations`, route("cmms.location.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "LocationCode", "NameFa", "NameEn", "Level", "ParentLocationId", "Latitude", "Longitude",
      "GeoAccuracyMeters", "ZoneClassification", "IsHazardousArea", "IsActive", "NoteFa",
    ]));
    const LocationCode = code(req.body.LocationCode, "LocationCode");
    const NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    const Level = number(req.body.Level, "Level", { required: true, integer: true, min: 1, max: 9 });
    const ParentLocationId = req.body.ParentLocationId === undefined ? null : id(req.body.ParentLocationId, "ParentLocationId");

    if (ParentLocationId) {
      const parent = await mustFind(r, "CmmsLocation", ParentLocationId, siteId);
      if (parent.Level >= Level) {
        throw businessRule("CMMS_LOCATION_LEVEL", `سطح فرزند (${Level}) باید بزرگ‌تر از سطح والد (${parent.Level}) باشد`);
      }
    }
    if (await r.findOne("CmmsLocation", [{ column: "SiteId", op: "eq", value: siteId }, { column: "LocationCode", op: "eq", value: LocationCode }])) {
      throw conflict("CMMS_DUPLICATE", `کد مکان «${LocationCode}» تکراری است`);
    }

    const row = await r.create("CmmsLocation", {
      SiteId: siteId, LocationCode, NameFa, Level, ParentLocationId,
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      Latitude: optionalNumber(req.body.Latitude, "Latitude", { min: -90, max: 90 }),
      Longitude: optionalNumber(req.body.Longitude, "Longitude", { min: -180, max: 180 }),
      GeoAccuracyMeters: optionalNumber(req.body.GeoAccuracyMeters, "GeoAccuracyMeters", { integer: true, min: 0 }),
      ZoneClassification: text(req.body.ZoneClassification, "ZoneClassification", { max: 40 }),
      IsHazardousArea: bool(req.body.IsHazardousArea, "IsHazardousArea", false),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_LOCATION_CREATED", "CmmsLocation", row.Id, "cmms.location.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/locations/:locationId`, route("cmms.location.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["NameFa", "NameEn", "Level", "ParentLocationId", "Latitude", "Longitude", "ZoneClassification", "IsHazardousArea", "IsActive", "NoteFa", "RowVersion"]));
    const locationId = id(req.params.locationId, "locationId");
    const existing = await mustFind(r, "CmmsLocation", locationId, siteId);
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.NameEn !== undefined) patch.NameEn = text(req.body.NameEn, "NameEn", { max: 240 });
    if (req.body.Level !== undefined) patch.Level = number(req.body.Level, "Level", { integer: true, min: 1, max: 9 });
    if (req.body.Latitude !== undefined) patch.Latitude = optionalNumber(req.body.Latitude, "Latitude", { min: -90, max: 90 });
    if (req.body.Longitude !== undefined) patch.Longitude = optionalNumber(req.body.Longitude, "Longitude", { min: -180, max: 180 });
    if (req.body.ZoneClassification !== undefined) patch.ZoneClassification = text(req.body.ZoneClassification, "ZoneClassification", { max: 40 });
    if (req.body.IsHazardousArea !== undefined) patch.IsHazardousArea = bool(req.body.IsHazardousArea, "IsHazardousArea");
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (req.body.ParentLocationId !== undefined) {
      const nextParent = req.body.ParentLocationId === null ? null : id(req.body.ParentLocationId, "ParentLocationId");
      /* جلوگیری از حلقه: نه روی خودش، نه روی یکی از نوادگانش. */
      const all = await listInSite(r, "CmmsLocation", siteId);
      const nodes = all.map((row) => ({ id: row.Id, parentId: row.ParentLocationId ?? null }));
      if (nextParent && wouldCreateCycle(nodes, nextParent, locationId)) {
        throw businessRule("CMMS_LOCATION_CYCLE", "این انتساب در ساختار مکان حلقه ایجاد می‌کند");
      }
      patch.ParentLocationId = nextParent;
    }
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    const result = await r.patch("CmmsLocation", locationId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("CMMS_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "CMMS_LOCATION_UPDATED", "CmmsLocation", locationId, "cmms.location.edit");
    return r.get("CmmsLocation", locationId);
  }));

  /* ───────────────────────── ۲. خانوادهٔ تجهیز (PMworks 13) ───────────────────────── */

  app.get(`${ROOT}/family-groups`, route("cmms.family.view", async ({ repo: r, req, siteId }) => {
    const rows = await listInSite(r, "CmmsFamilyGroup", siteId, { orderBy: [{ column: "GroupCode", dir: "asc" }] });
    return { groups: rows, total: rows.length };
  }));

  app.post(`${ROOT}/family-groups`, route("cmms.family.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["GroupCode", "NameFa", "NameEn", "EquipmentClass", "Discipline", "IsActive", "NoteFa"]));
    const GroupCode = code(req.body.GroupCode, "GroupCode");
    if (await r.findOne("CmmsFamilyGroup", [{ column: "SiteId", op: "eq", value: siteId }, { column: "GroupCode", op: "eq", value: GroupCode }])) {
      throw conflict("CMMS_DUPLICATE", `کد گروه «${GroupCode}» تکراری است`);
    }
    const row = await r.create("CmmsFamilyGroup", {
      SiteId: siteId, GroupCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      EquipmentClass: text(req.body.EquipmentClass, "EquipmentClass", { required: true, max: 40 }),
      Discipline: oneOf(req.body.Discipline, "Discipline", ["mechanical", "electrical", "instrument", "civil", "rotating", "static"]),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_FAMILY_GROUP_CREATED", "CmmsFamilyGroup", row.Id, "cmms.family.edit");
    return row;
  }, 201));

  app.get(`${ROOT}/families`, route("cmms.family.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["familyGroupId", "status", "criticalityRank", "limit", "offset"]));
    const where = [];
    if (req.query.familyGroupId !== undefined) where.push({ column: "FamilyGroupId", op: "eq", value: id(req.query.familyGroupId, "familyGroupId") });
    if (req.query.status !== undefined) where.push({ column: "Status", op: "eq", value: oneOf(req.query.status, "status", ["draft", "approved", "obsolete"], { required: true }) });
    if (req.query.criticalityRank !== undefined) where.push({ column: "CriticalityRank", op: "eq", value: oneOf(req.query.criticalityRank, "criticalityRank", ["A", "B", "C", "D"], { required: true }) });
    const rows = await listInSite(r, "CmmsFamily", siteId, {
      where, orderBy: [{ column: "FamilyCode", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 500),
      offset: pageNumber(req.query.offset, "offset", 0, 1_000_000),
    });
    return { families: rows, total: rows.length };
  }));

  app.post(`${ROOT}/families`, route("cmms.family.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "FamilyGroupId", "FamilyCode", "NameFa", "NameEn", "Manufacturer", "ModelSeries",
      "CriticalityRank", "DefaultStrategy", "IsTemplate", "NoteFa",
    ]));
    const FamilyCode = code(req.body.FamilyCode, "FamilyCode");
    const familyGroupId = id(req.body.FamilyGroupId, "FamilyGroupId");
    await mustFind(r, "CmmsFamilyGroup", familyGroupId, siteId);
    if (await r.findOne("CmmsFamily", [{ column: "SiteId", op: "eq", value: siteId }, { column: "FamilyCode", op: "eq", value: FamilyCode }])) {
      throw conflict("CMMS_DUPLICATE", `کد خانواده «${FamilyCode}» تکراری است`);
    }
    const row = await r.create("CmmsFamily", {
      SiteId: siteId, FamilyGroupId: familyGroupId, FamilyCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      Manufacturer: text(req.body.Manufacturer, "Manufacturer", { max: 240 }),
      ModelSeries: text(req.body.ModelSeries, "ModelSeries", { max: 160 }),
      CriticalityRank: oneOf(req.body.CriticalityRank, "CriticalityRank", ["A", "B", "C", "D"], { fallback: "C" }),
      DefaultStrategy: oneOf(req.body.DefaultStrategy, "DefaultStrategy",
        ["pm", "cbm", "predictive", "risk-based", "run-to-failure", "zero-breakdown"], { fallback: "pm" }),
      Version: 1,
      IsTemplate: bool(req.body.IsTemplate, "IsTemplate", false),
      Status: "draft",
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_FAMILY_CREATED", "CmmsFamily", row.Id, "cmms.family.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/families/:familyId`, route("cmms.family.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["NameFa", "NameEn", "Manufacturer", "ModelSeries", "CriticalityRank", "DefaultStrategy", "NoteFa", "RowVersion"]));
    const familyId = id(req.params.familyId, "familyId");
    const existing = await mustFind(r, "CmmsFamily", familyId, siteId);
    if (existing.Status === "approved") {
      throw businessRule("CMMS_FAMILY_LOCKED", "خانوادهٔ تصویب‌شده مستقیماً ویرایش نمی‌شود؛ نسخهٔ تازه بسازید");
    }
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.NameEn !== undefined) patch.NameEn = text(req.body.NameEn, "NameEn", { max: 240 });
    if (req.body.Manufacturer !== undefined) patch.Manufacturer = text(req.body.Manufacturer, "Manufacturer", { max: 240 });
    if (req.body.ModelSeries !== undefined) patch.ModelSeries = text(req.body.ModelSeries, "ModelSeries", { max: 160 });
    if (req.body.CriticalityRank !== undefined) patch.CriticalityRank = oneOf(req.body.CriticalityRank, "CriticalityRank", ["A", "B", "C", "D"], { required: true });
    if (req.body.DefaultStrategy !== undefined) {
      patch.DefaultStrategy = oneOf(req.body.DefaultStrategy, "DefaultStrategy",
        ["pm", "cbm", "predictive", "risk-based", "run-to-failure", "zero-breakdown"], { required: true });
    }
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    const result = await r.patch("CmmsFamily", familyId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("CMMS_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر شده است");
    await writeAudit(r, req, "CMMS_FAMILY_UPDATED", "CmmsFamily", familyId, "cmms.family.edit");
    return r.get("CmmsFamily", familyId);
  }));

  app.post(`${ROOT}/families/:familyId/approve`, route("cmms.family.approve", async ({ repo: r, req, siteId }) => {
    const familyId = id(req.params.familyId, "familyId");
    const existing = await mustFind(r, "CmmsFamily", familyId, siteId);
    if (existing.Status === "approved") throw conflict("CMMS_FAMILY_ALREADY_APPROVED", "این خانواده پیش‌تر تصویب شده است");
    /* تصویب خانواده بدون گرهٔ ریشه بی‌معناست: خانواده‌ای که ساختار ندارد،
     * الگویی برای ارث‌بری تجهیز نیست. */
    const nodeCount = await countInSite(r, "CmmsFamilyNode", siteId, [{ column: "FamilyId", op: "eq", value: familyId }]);
    if (nodeCount === 0) throw businessRule("CMMS_FAMILY_EMPTY", "خانوادهٔ بدون گرهٔ ساختاری تصویب نمی‌شود");
    await r.patch("CmmsFamily", familyId, {
      Status: "approved", ApprovedAt: new Date().toISOString(), ApprovedBy: requestActor(req),
    }, requestActor(req), existing.RowVersion);
    await writeAudit(r, req, "CMMS_FAMILY_APPROVED", "CmmsFamily", familyId, "cmms.family.approve", { nodeCount });
    return r.get("CmmsFamily", familyId);
  }));

  /** پروفایل جامع خانواده: همهٔ ۱۳ بخش در یک پاسخ تودرتو. */
  app.get(`${ROOT}/families/:familyId`, route("cmms.family.view", async ({ repo: r, req, siteId }) => {
    const familyId = id(req.params.familyId, "familyId");
    const family = await mustFind(r, "CmmsFamily", familyId, siteId);
    const [nodes, profile, operatingParams, conditionParams, failureModes, documents, pmTasks, customFields, bulkChanges] = await Promise.all([
      childrenOf(r, "CmmsFamilyNode", siteId, "FamilyId", familyId),
      childrenOf(r, "CmmsFamilyProfile", siteId, "FamilyId", familyId),
      childrenOf(r, "CmmsFamilyOperatingParam", siteId, "FamilyId", familyId),
      childrenOf(r, "CmmsFamilyConditionParam", siteId, "FamilyId", familyId),
      childrenOf(r, "CmmsFamilyFailureMode", siteId, "FamilyId", familyId),
      childrenOf(r, "CmmsFamilyDocument", siteId, "FamilyId", familyId),
      childrenOf(r, "CmmsFamilyPmTask", siteId, "FamilyId", familyId),
      childrenOf(r, "CmmsFamilyCustomField", siteId, "FamilyId", familyId),
      childrenOf(r, "CmmsFamilyBulkChange", siteId, "FamilyId", familyId),
    ]);
    const assignments = await listInSite(r, "CmmsAssetFamilyAssignment", siteId, {
      where: [{ column: "FamilyId", op: "eq", value: familyId }],
    });
    const tree = buildTree(nodes.map((node) => ({
      id: node.Id, parentId: node.ParentNodeId ?? null, code: node.NodeCode, name: node.NameFa,
    })));
    return {
      family,
      /* نگاشت صریح ۱۳ بخش PMworks به داده — تا مصرف‌کننده لازم نباشد حدس بزند. */
      pmworks: {
        group: family.FamilyGroupId,
        template: { code: family.FamilyCode, version: family.Version, status: family.Status },
        tree: { roots: tree.roots, maxDepth: tree.maxDepth, nodeCount: nodes.length, cycleMembers: tree.cycleMembers },
        profile,
        operatingParams,
        conditionParams,
        failureModes,
        documents,
        pmTasks,
        assignedAssets: assignments.length,
        documentsPerAsset: await countInSite(r, "CmmsAssetDocument", siteId),
        customFields,
        bulkChanges,
      },
      assignments,
    };
  }));

  app.get(`${ROOT}/families/:familyId/nodes`, route("cmms.family.view", async ({ repo: r, req, siteId }) => {
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const nodes = await childrenOf(r, "CmmsFamilyNode", siteId, "FamilyId", familyId);
    const tree = buildTree(nodes.map((node) => ({
      id: node.Id, parentId: node.ParentNodeId ?? null, code: node.NodeCode, name: node.NameFa,
    })));
    return { nodes: tree.flat, roots: tree.roots, maxDepth: tree.maxDepth, cycleMembers: tree.cycleMembers };
  }));

  app.post(`${ROOT}/families/:familyId/nodes`, route("cmms.family.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "NodeCode", "NameFa", "NameEn", "BoundaryLevel", "ParentNodeId", "IsMaintainable",
      "IsCriticalPart", "TechnicalSpecFa", "SortOrder",
    ]));
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const NodeCode = code(req.body.NodeCode, "NodeCode");
    if (await r.findOne("CmmsFamilyNode", [
      { column: "FamilyId", op: "eq", value: familyId }, { column: "NodeCode", op: "eq", value: NodeCode },
    ])) throw conflict("CMMS_DUPLICATE", `کد گره «${NodeCode}» در این خانواده تکراری است`);

    const ParentNodeId = req.body.ParentNodeId === undefined ? null : id(req.body.ParentNodeId, "ParentNodeId");
    let PathLevel = 1;
    let PathCode = NodeCode;
    if (ParentNodeId) {
      const parent = await mustFind(r, "CmmsFamilyNode", ParentNodeId, siteId);
      if (parent.FamilyId !== familyId) throw businessRule("CMMS_NODE_FAMILY_MISMATCH", "گرهٔ والد به خانوادهٔ دیگری تعلق دارد");
      PathLevel = (parent.PathLevel ?? 0) + 1;
      PathCode = `${parent.PathCode ?? parent.NodeCode}/${NodeCode}`;
    }
    const existingNodes = (await childrenOf(r, "CmmsFamilyNode", siteId, "FamilyId", familyId))
      .map((node) => ({ id: node.Id, parentId: node.ParentNodeId ?? null }));
    if (ParentNodeId && wouldCreateCycle(existingNodes, ParentNodeId, "new")) {
      /* «new» هنوز در فهرست نیست، پس این بررسی فقط خودارجاعی/حلقهٔ والد را می‌گیرد. */
      throw businessRule("CMMS_NODE_CYCLE", "این انتساب در درخت خانواده حلقه ایجاد می‌کند");
    }

    const family = await r.get("CmmsFamily", familyId);
    const group = await r.get("CmmsFamilyGroup", family.FamilyGroupId);
    const BoundaryLevel = oneOf(req.body.BoundaryLevel, "BoundaryLevel", [...ISO14224_BOUNDARY_LEVELS], { fallback: "component" });
    const row = await r.create("CmmsFamilyNode", {
      SiteId: siteId, FamilyId: familyId, NodeCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      BoundaryLevel, ParentNodeId, PathLevel, PathCode,
      Iso14224Code: classifyIso14224({ equipmentClass: group?.EquipmentClass ?? null, subUnit: ParentNodeId ? PathCode : null, component: NodeCode }),
      IsMaintainable: bool(req.body.IsMaintainable, "IsMaintainable", true),
      IsCriticalPart: bool(req.body.IsCriticalPart, "IsCriticalPart", false),
      TechnicalSpecFa: text(req.body.TechnicalSpecFa, "TechnicalSpecFa", { max: 1200 }),
      SortOrder: number(req.body.SortOrder, "SortOrder", { integer: true, min: 0, max: 100000, required: false }) ?? 0,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_FAMILY_NODE_CREATED", "CmmsFamilyNode", row.Id, "cmms.family.edit", { familyId });
    return row;
  }, 201));

  app.get(`${ROOT}/families/:familyId/failure-modes`, route("cmms.failuremode.view", async ({ repo: r, req, siteId }) => {
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const rows = await childrenOf(r, "CmmsFamilyFailureMode", siteId, "FamilyId", familyId);
    return { failureModes: rows, total: rows.length, catalog: { failureModes: ISO14224_FAILURE_MODES, mechanisms: ISO14224_FAILURE_MECHANISMS, detectionMethods: ISO14224_DETECTION_METHODS } };
  }));

  app.post(`${ROOT}/families/:familyId/failure-modes`, route("cmms.failuremode.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "FailureModeCode", "FamilyNodeId", "NameFa", "NameEn", "FailureMode", "FailureMechanism",
      "DetectionMethod", "EffectDescriptionFa", "SeverityClass", "OccurrenceClass", "DetectionClass",
      "CriticalityRank", "IsHiddenFailure", "IsActive", "NoteFa",
    ]));
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const FailureModeCode = code(req.body.FailureModeCode, "FailureModeCode");
    if (await r.findOne("CmmsFamilyFailureMode", [
      { column: "FamilyId", op: "eq", value: familyId }, { column: "FailureModeCode", op: "eq", value: FailureModeCode },
    ])) throw conflict("CMMS_DUPLICATE", `کد حالت خرابی «${FailureModeCode}» تکراری است`);

    const FailureMode = oneOf(req.body.FailureMode, "FailureMode", [...ISO14224_FAILURE_MODES], { required: true });
    const FailureMechanism = oneOf(req.body.FailureMechanism, "FailureMechanism", [...ISO14224_FAILURE_MECHANISMS], { required: true });
    const FamilyNodeId = req.body.FamilyNodeId === undefined ? null : id(req.body.FamilyNodeId, "FamilyNodeId");
    if (FamilyNodeId) {
      const node = await mustFind(r, "CmmsFamilyNode", FamilyNodeId, siteId);
      if (node.FamilyId !== familyId) throw businessRule("CMMS_NODE_FAMILY_MISMATCH", "گره به خانوادهٔ دیگری تعلق دارد");
    }

    const row = await r.create("CmmsFamilyFailureMode", {
      SiteId: siteId, FamilyId: familyId, FamilyNodeId, FailureModeCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      FailureMode, FailureMechanism,
      DetectionMethod: text(req.body.DetectionMethod, "DetectionMethod", { max: 120 }),
      EffectDescriptionFa: text(req.body.EffectDescriptionFa, "EffectDescriptionFa", { max: 1200 }),
      SeverityClass: number(req.body.SeverityClass, "SeverityClass", { integer: true, min: 1, max: 5 }) ?? 2,
      OccurrenceClass: number(req.body.OccurrenceClass, "OccurrenceClass", { integer: true, min: 1, max: 5 }) ?? 2,
      DetectionClass: number(req.body.DetectionClass, "DetectionClass", { integer: true, min: 1, max: 5 }) ?? 2,
      CriticalityRank: oneOf(req.body.CriticalityRank, "CriticalityRank", ["A", "B", "C", "D"], { fallback: "C" }),
      IsHiddenFailure: bool(req.body.IsHiddenFailure, "IsHiddenFailure", false),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_FAILURE_MODE_CREATED", "CmmsFamilyFailureMode", row.Id, "cmms.failuremode.edit", { familyId, FailureMode });
    return row;
  }, 201));

  app.get(`${ROOT}/families/:familyId/pm-tasks`, route("cmms.pm.view", async ({ repo: r, req, siteId }) => {
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const tasks = await childrenOf(r, "CmmsFamilyPmTask", siteId, "FamilyId", familyId);
    const withChecklists = await Promise.all(tasks.map(async (task) => ({
      ...task,
      checklist: await childrenOf(r, "CmmsPmChecklistItem", siteId, "FamilyPmTaskId", task.Id),
    })));
    return { tasks: withChecklists, total: withChecklists.length };
  }));

  app.post(`${ROOT}/families/:familyId/pm-tasks`, route("cmms.pm.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "TaskCode", "FamilyNodeId", "NameFa", "TaskType", "StrategyType", "StandardMinutes",
      "TradeSkill", "ToolRequired", "SafetyRequirementFa", "IntervalValue", "IntervalUnit",
      "IsMandatory", "SortOrder", "IsActive", "InstructionFa",
    ]));
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const TaskCode = code(req.body.TaskCode, "TaskCode");
    if (await r.findOne("CmmsFamilyPmTask", [
      { column: "FamilyId", op: "eq", value: familyId }, { column: "TaskCode", op: "eq", value: TaskCode },
    ])) throw conflict("CMMS_DUPLICATE", `کد فعالیت «${TaskCode}» تکراری است`);

    const IntervalValue = optionalNumber(req.body.IntervalValue, "IntervalValue", { min: 0.0001 });
    const IntervalUnit = oneOf(req.body.IntervalUnit, "IntervalUnit", ["hours", "days", "weeks", "months", "cycles", "km"]);
    /* فعالیت زمان‌محور بدون تناوب، برنامه‌ای تولید نمی‌کند؛ پس این ترکیب
     * خطای اعتبارسنجی است نه یک رکورد بی‌اثر. */
    if (IntervalValue == null && oneOf(req.body.StrategyType, "StrategyType", ["pm", "cbm", "predictive", "run-to-failure"], { fallback: "pm" }) !== "run-to-failure") {
      throw bad("IntervalValue", "فعالیت با استراتژی زمان‌محور باید تناوب داشته باشد");
    }

    const row = await r.create("CmmsFamilyPmTask", {
      SiteId: siteId, FamilyId: familyId, TaskCode,
      FamilyNodeId: req.body.FamilyNodeId === undefined ? null : id(req.body.FamilyNodeId, "FamilyNodeId"),
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 300 }),
      TaskType: oneOf(req.body.TaskType, "TaskType",
        ["inspection", "lubrication", "adjustment", "cleaning", "replacement", "overhaul", "test", "calibration"], { required: true }),
      StrategyType: oneOf(req.body.StrategyType, "StrategyType", ["pm", "cbm", "predictive", "run-to-failure"], { fallback: "pm" }),
      StandardMinutes: optionalNumber(req.body.StandardMinutes, "StandardMinutes", { min: 0 }),
      TradeSkill: text(req.body.TradeSkill, "TradeSkill", { required: true, max: 60 }),
      ToolRequired: text(req.body.ToolRequired, "ToolRequired", { max: 400 }),
      SafetyRequirementFa: text(req.body.SafetyRequirementFa, "SafetyRequirementFa", { max: 1000 }),
      IntervalValue, IntervalUnit,
      IsMandatory: bool(req.body.IsMandatory, "IsMandatory", true),
      SortOrder: number(req.body.SortOrder, "SortOrder", { integer: true, min: 0 }) ?? 0,
      IsActive: bool(req.body.IsActive, "IsActive", true),
      InstructionFa: text(req.body.InstructionFa, "InstructionFa", { max: 2000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_PM_TASK_CREATED", "CmmsFamilyPmTask", row.Id, "cmms.pm.edit", { familyId });
    return row;
  }, 201));

  app.post(`${ROOT}/families/:familyId/pm-tasks/:taskId/checklist-items`, route("cmms.pm.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["ItemCode", "DescriptionFa", "InputType", "ExpectedValue", "MinValue", "MaxValue", "Uom", "IsRequired", "SortOrder"]));
    const familyId = id(req.params.familyId, "familyId");
    const taskId = id(req.params.taskId, "taskId");
    const task = await mustFind(r, "CmmsFamilyPmTask", taskId, siteId);
    if (task.FamilyId !== familyId) throw businessRule("CMMS_TASK_FAMILY_MISMATCH", "فعالیت به این خانواده تعلق ندارد");
    const ItemCode = code(req.body.ItemCode, "ItemCode");
    if (await r.findOne("CmmsPmChecklistItem", [
      { column: "FamilyPmTaskId", op: "eq", value: taskId }, { column: "ItemCode", op: "eq", value: ItemCode },
    ])) throw conflict("CMMS_DUPLICATE", `کد ردیف چک‌لیست «${ItemCode}» تکراری است`);
    const row = await r.create("CmmsPmChecklistItem", {
      SiteId: siteId, FamilyPmTaskId: taskId, ItemCode,
      DescriptionFa: text(req.body.DescriptionFa, "DescriptionFa", { required: true, max: 600 }),
      InputType: oneOf(req.body.InputType, "InputType", ["passfail", "numeric", "text", "select", "measurement"], { fallback: "passfail" }),
      ExpectedValue: text(req.body.ExpectedValue, "ExpectedValue", { max: 200 }),
      MinValue: optionalNumber(req.body.MinValue, "MinValue"),
      MaxValue: optionalNumber(req.body.MaxValue, "MaxValue"),
      Uom: text(req.body.Uom, "Uom", { max: 24 }),
      IsRequired: bool(req.body.IsRequired, "IsRequired", true),
      SortOrder: number(req.body.SortOrder, "SortOrder", { integer: true, min: 0 }) ?? 0,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_CHECKLIST_ITEM_CREATED", "CmmsPmChecklistItem", row.Id, "cmms.pm.edit", { taskId });
    return row;
  }, 201));

  app.get(`${ROOT}/families/:familyId/custom-fields`, route("cmms.family.view", async ({ repo: r, req, siteId }) => {
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const rows = await childrenOf(r, "CmmsFamilyCustomField", siteId, "FamilyId", familyId);
    return { customFields: rows, total: rows.length };
  }));

  app.post(`${ROOT}/families/:familyId/custom-fields`, route("cmms.customfield.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["FieldKey", "LabelFa", "LabelEn", "FieldType", "Unit", "OptionsJson", "DefaultValue", "IsRequired", "AppliesTo", "SortOrder", "IsActive"]));
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const FieldKey = code(req.body.FieldKey, "FieldKey");
    if (await r.findOne("CmmsFamilyCustomField", [
      { column: "FamilyId", op: "eq", value: familyId }, { column: "FieldKey", op: "eq", value: FieldKey },
    ])) throw conflict("CMMS_DUPLICATE", `کلید فیلد «${FieldKey}» تکراری است`);
    const FieldType = oneOf(req.body.FieldType, "FieldType", ["text", "number", "date", "boolean", "select"], { required: true });
    const OptionsJson = req.body.OptionsJson ?? null;
    if (FieldType === "select" && (!Array.isArray(OptionsJson) || OptionsJson.length === 0)) {
      throw bad("OptionsJson", "فیلد select باید فهرست گزینه‌ها را داشته باشد");
    }
    const row = await r.create("CmmsFamilyCustomField", {
      SiteId: siteId, FamilyId: familyId, FieldKey,
      LabelFa: text(req.body.LabelFa, "LabelFa", { required: true, max: 200 }),
      LabelEn: text(req.body.LabelEn, "LabelEn", { max: 200 }),
      FieldType, Unit: text(req.body.Unit, "Unit", { max: 24 }), OptionsJson,
      DefaultValue: text(req.body.DefaultValue, "DefaultValue", { max: 400 }),
      IsRequired: bool(req.body.IsRequired, "IsRequired", false),
      AppliesTo: oneOf(req.body.AppliesTo, "AppliesTo", ["asset", "node", "both"], { fallback: "asset" }),
      SortOrder: number(req.body.SortOrder, "SortOrder", { integer: true, min: 0 }) ?? 0,
      IsActive: bool(req.body.IsActive, "IsActive", true),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_CUSTOM_FIELD_CREATED", "CmmsFamilyCustomField", row.Id, "cmms.customfield.edit", { familyId });
    return row;
  }, 201));

  app.get(`${ROOT}/families/:familyId/documents`, route("cmms.document.view", async ({ repo: r, req, siteId }) => {
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const rows = await childrenOf(r, "CmmsFamilyDocument", siteId, "FamilyId", familyId);
    return { documents: rows, total: rows.length };
  }));

  app.post(`${ROOT}/families/:familyId/documents`, route("cmms.document.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["DocCode", "TitleFa", "DocType", "Revision", "StoragePath", "FileFormat", "FileSizeBytes", "IssuedBy", "IssuedOn", "ExpiresOn", "IsActive", "NoteFa"]));
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const DocCode = code(req.body.DocCode, "DocCode");
    const Revision = text(req.body.Revision, "Revision", { max: 40 }) ?? "A";
    if (await r.findOne("CmmsFamilyDocument", [
      { column: "FamilyId", op: "eq", value: familyId }, { column: "DocCode", op: "eq", value: DocCode }, { column: "Revision", op: "eq", value: Revision },
    ])) throw conflict("CMMS_DUPLICATE", `سند «${DocCode}» نسخهٔ «${Revision}» تکراری است`);
    const IssuedOn = isoDate(req.body.IssuedOn, "IssuedOn");
    const ExpiresOn = isoDate(req.body.ExpiresOn, "ExpiresOn");
    if (IssuedOn && ExpiresOn && ExpiresOn < IssuedOn) throw bad("ExpiresOn", "تاریخ انقضا پیش از تاریخ صدور است");
    const row = await r.create("CmmsFamilyDocument", {
      SiteId: siteId, FamilyId: familyId, DocCode, Revision,
      TitleFa: text(req.body.TitleFa, "TitleFa", { required: true, max: 300 }),
      DocType: oneOf(req.body.DocType, "DocType",
        ["drawing", "catalog", "manual", "datasheet", "certificate", "sop", "procedure", "photo", "other"], { required: true }),
      StoragePath: text(req.body.StoragePath, "StoragePath", { max: 600 }),
      FileFormat: text(req.body.FileFormat, "FileFormat", { max: 20 }),
      FileSizeBytes: optionalNumber(req.body.FileSizeBytes, "FileSizeBytes", { integer: true, min: 0 }),
      IssuedBy: text(req.body.IssuedBy, "IssuedBy", { max: 240 }),
      IssuedOn, ExpiresOn,
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_FAMILY_DOCUMENT_CREATED", "CmmsFamilyDocument", row.Id, "cmms.document.edit", { familyId });
    return row;
  }, 201));

  /* ── بخش ۱۳: تغییر همگانی روی اعضای خانواده ── */

  app.post(`${ROOT}/families/:familyId/bulk-changes`, route("cmms.family.bulkchange", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["ChangeKind", "TargetField", "NewValueJson", "ReasonFa"]));
    const familyId = id(req.params.familyId, "familyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const ChangeKind = oneOf(req.body.ChangeKind, "ChangeKind",
      ["pm-interval", "failure-mode", "checklist", "custom-field", "node", "document", "strategy"], { required: true });
    const TargetField = text(req.body.TargetField, "TargetField", { required: true, max: 120 });
    if (req.body.NewValueJson === undefined || req.body.NewValueJson === null) {
      throw bad("NewValueJson", "مقدار تازه الزامی است");
    }
    const affectedAssetCount = await countInSite(r, "CmmsAssetFamilyAssignment", siteId, [{ column: "FamilyId", op: "eq", value: familyId }]);
    const row = await r.create("CmmsFamilyBulkChange", {
      SiteId: siteId, FamilyId: familyId, ChangeKind, TargetField,
      NewValueJson: req.body.NewValueJson,
      AffectedAssetCount: affectedAssetCount,
      ReasonFa: text(req.body.ReasonFa, "ReasonFa", { max: 1000 }),
      Status: "pending",
      RequestedBy: requestActor(req),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_FAMILY_BULK_CHANGE_REQUESTED", "CmmsFamilyBulkChange", row.Id, "cmms.family.bulkchange", { familyId, ChangeKind, affectedAssetCount });
    return row;
  }, 201));

  app.post(`${ROOT}/families/:familyId/bulk-changes/:changeId/apply`, route("cmms.family.bulkchange", async ({ repo: r, req, siteId }) => {
    const familyId = id(req.params.familyId, "familyId");
    const changeId = id(req.params.changeId, "changeId");
    return r.transaction(async (tx) => {
      const change = await mustFind(tx, "CmmsFamilyBulkChange", changeId, siteId);
      if (change.FamilyId !== familyId) throw businessRule("CMMS_CHANGE_FAMILY_MISMATCH", "تغییر به این خانواده تعلق ندارد");
      if (change.Status === "applied") throw conflict("CMMS_CHANGE_ALREADY_APPLIED", "این تغییر پیش‌تر اعمال شده است");
      if (change.Status === "rejected") throw businessRule("CMMS_CHANGE_REJECTED", "تغییر رد شده قابل اعمال نیست");

      /* اعمال واقعی روی جدول هدف. فقط pm-interval و strategy پیاده‌سازی شده‌اند؛
       * بقیه صریحاً «پشتیبانی‌نشده» اعلام می‌شوند تا بی‌صدا موفق به نظر نرسند. */
      let affected = 0;
      if (change.ChangeKind === "pm-interval") {
        const schedules = await childrenOf(tx, "CmmsPmSchedule", siteId, "FamilyId", familyId);
        for (const schedule of schedules) {
          await tx.patch("CmmsPmSchedule", schedule.Id, {
            IntervalValue: change.NewValueJson?.IntervalValue ?? schedule.IntervalValue,
            IntervalUnit: change.NewValueJson?.IntervalUnit ?? schedule.IntervalUnit,
            OptimizedByAi: false,
            OptimizationReasonFa: `تغییر همگانی خانواده: ${change.ReasonFa ?? changeId}`,
          }, requestActor(req), schedule.RowVersion);
          affected += 1;
        }
      } else if (change.ChangeKind === "strategy") {
        const strategies = await childrenOf(tx, "CmmsPmStrategy", siteId, "FamilyId", familyId);
        for (const strategy of strategies) {
          await tx.patch("CmmsPmStrategy", strategy.Id, {
            StrategyType: change.NewValueJson?.StrategyType ?? strategy.StrategyType,
          }, requestActor(req), strategy.RowVersion);
          affected += 1;
        }
      } else {
        throw businessRule("CMMS_CHANGE_UNSUPPORTED", `اعمال همگانی برای نوع «${change.ChangeKind}» در این فاز پیاده‌سازی نشده است`, {
          supported: ["pm-interval", "strategy"],
        });
      }

      await tx.patch("CmmsFamilyBulkChange", change.Id, {
        Status: "applied", AppliedAt: new Date().toISOString(), ApprovedBy: requestActor(req), AffectedAssetCount: affected,
      }, requestActor(req), change.RowVersion);
      await createAuditRecord(tx, req, "CMMS_FAMILY_BULK_CHANGE_APPLIED", "CmmsFamilyBulkChange", change.Id, "cmms.family.bulkchange", { affected });
      return { changeId, status: "applied", affectedRecords: affected };
    });
  }));

  /* ───────────────────────── ۳. تجهیز فیزیکی ───────────────────────── */

  app.get(`${ROOT}/assets`, route("cmms.asset.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["familyId", "locationId", "assetState", "criticalityRank", "q", "isActive", "limit", "offset"]));
    const where = [];
    if (req.query.familyId !== undefined) where.push({ column: "FamilyId", op: "eq", value: id(req.query.familyId, "familyId") });
    if (req.query.locationId !== undefined) where.push({ column: "LocationId", op: "eq", value: id(req.query.locationId, "locationId") });
    if (req.query.assetState !== undefined) {
      where.push({
        column: "AssetState", op: "eq",
        value: oneOf(req.query.assetState, "assetState",
          ["planned", "installed", "commissioned", "operating", "standby", "under-maintenance", "degraded", "retired", "disposed"], { required: true }),
      });
    }
    if (req.query.criticalityRank !== undefined) where.push({ column: "CriticalityRank", op: "eq", value: oneOf(req.query.criticalityRank, "criticalityRank", ["A", "B", "C", "D"], { required: true }) });
    if (req.query.isActive !== undefined) where.push({ column: "IsActive", op: "eq", value: bool(req.query.isActive, "isActive") });
    if (req.query.q !== undefined) where.push({ column: "AssetTag", op: "like", value: `%${text(req.query.q, "q", { max: 60 })}%` });
    const limit = pageNumber(req.query.limit, "limit", 100, 500);
    const offset = pageNumber(req.query.offset, "offset", 0, 1_000_000);
    const rows = await listInSite(r, "CmmsAsset", siteId, {
      where, orderBy: [{ column: "AssetTag", dir: "asc" }], limit, offset,
    });
    const total = await countInSite(r, "CmmsAsset", siteId, where);
    return { assets: rows, total, limit, offset };
  }));

  app.get(`${ROOT}/assets/tree`, route("cmms.asset.view", async ({ repo: r, req, siteId }) => {
    const rows = await listInSite(r, "CmmsAsset", siteId, { orderBy: [{ column: "AssetTag", dir: "asc" }] });
    const tree = buildTree(rows.map((row) => ({
      id: row.Id, parentId: row.ParentAssetId ?? null, code: row.AssetTag, name: row.NameFa,
    })));
    return {
      roots: tree.roots, maxDepth: tree.maxDepth, total: tree.flat.length,
      cycleMembers: tree.cycleMembers, orphans: tree.orphans,
    };
  }));

  app.post(`${ROOT}/assets`, route("cmms.asset.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "FamilyId", "AssetTag", "NameFa", "NameEn", "ParentAssetId", "LocationId", "SerialNumber",
      "Manufacturer", "Model", "AssetState", "CriticalityRank", "VendorId", "CommissionedOn",
      "InstalledOn", "WarrantyExpiresOn", "AcquisitionCost", "Currency", "ExpectedLifeYears",
      "MfgWorkCenterId", "ScmWarehouseId", "IsActive", "NoteFa",
    ]));
    const AssetTag = code(req.body.AssetTag, "AssetTag");
    const familyId = id(req.body.FamilyId, "FamilyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    if (await r.findOne("CmmsAsset", [{ column: "SiteId", op: "eq", value: siteId }, { column: "AssetTag", op: "eq", value: AssetTag }])) {
      throw conflict("CMMS_DUPLICATE", `برچسب تجهیز «${AssetTag}» تکراری است`);
    }
    const LocationId = req.body.LocationId === undefined ? null : id(req.body.LocationId, "LocationId");
    if (LocationId) await mustFind(r, "CmmsLocation", LocationId, siteId);
    const ParentAssetId = req.body.ParentAssetId === undefined ? null : id(req.body.ParentAssetId, "ParentAssetId");
    if (ParentAssetId) await mustFind(r, "CmmsAsset", ParentAssetId, siteId);
    const VendorId = req.body.VendorId === undefined ? null : id(req.body.VendorId, "VendorId");
    if (VendorId) await mustFind(r, "CmmsVendor", VendorId, siteId);

    const row = await r.create("CmmsAsset", {
      SiteId: siteId, FamilyId: familyId, AssetTag,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      ParentAssetId, LocationId,
      SerialNumber: text(req.body.SerialNumber, "SerialNumber", { max: 120 }),
      Manufacturer: text(req.body.Manufacturer, "Manufacturer", { max: 240 }),
      Model: text(req.body.Model, "Model", { max: 160 }),
      AssetState: oneOf(req.body.AssetState, "AssetState",
        ["planned", "installed", "commissioned", "operating", "standby", "under-maintenance", "degraded", "retired", "disposed"],
        { fallback: "commissioned" }),
      CriticalityRank: oneOf(req.body.CriticalityRank, "CriticalityRank", ["A", "B", "C", "D"], { fallback: "C" }),
      VendorId,
      CommissionedOn: isoDate(req.body.CommissionedOn, "CommissionedOn"),
      InstalledOn: isoDate(req.body.InstalledOn, "InstalledOn"),
      WarrantyExpiresOn: isoDate(req.body.WarrantyExpiresOn, "WarrantyExpiresOn"),
      AcquisitionCost: optionalNumber(req.body.AcquisitionCost, "AcquisitionCost", { min: 0 }),
      Currency: text(req.body.Currency, "Currency", { max: 8 }) ?? "IRR",
      ExpectedLifeYears: optionalNumber(req.body.ExpectedLifeYears, "ExpectedLifeYears", { min: 0.01 }),
      /* ارجاع نرم به تولید و انبار — عمداً وجودشان در این ماژول اعتبارسنجی
       * نمی‌شود، چون استقلال CMMS از Mfg/SCM یک الزام معماری است. */
      MfgWorkCenterId: text(req.body.MfgWorkCenterId, "MfgWorkCenterId", { max: 60 }),
      ScmWarehouseId: text(req.body.ScmWarehouseId, "ScmWarehouseId", { max: 60 }),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_ASSET_CREATED", "CmmsAsset", row.Id, "cmms.asset.edit", { AssetTag, familyId });
    return row;
  }, 201));

  app.get(`${ROOT}/assets/:assetId`, route("cmms.asset.view", async ({ repo: r, req, siteId }) => {
    const assetId = id(req.params.assetId, "assetId");
    const asset = await mustFind(r, "CmmsAsset", assetId, siteId);
    const [family, location, documents, barcodes, customValues, assignments, lifecycle] = await Promise.all([
      r.get("CmmsFamily", asset.FamilyId),
      asset.LocationId ? r.get("CmmsLocation", asset.LocationId) : null,
      childrenOf(r, "CmmsAssetDocument", siteId, "AssetId", assetId),
      childrenOf(r, "CmmsAssetBarcode", siteId, "AssetId", assetId),
      childrenOf(r, "CmmsAssetCustomValue", siteId, "AssetId", assetId),
      childrenOf(r, "CmmsAssetFamilyAssignment", siteId, "AssetId", assetId),
      childrenOf(r, "CmmsAssetLifecycleEvent", siteId, "AssetId", assetId),
    ]);
    const children = await listInSite(r, "CmmsAsset", siteId, { where: [{ column: "ParentAssetId", op: "eq", value: assetId }] });
    const recentFailures = await listInSite(r, "CmmsFailureRecord", siteId, {
      where: [{ column: "AssetId", op: "eq", value: assetId }],
      orderBy: [{ column: "DetectedAt", dir: "desc" }], limit: 20,
    });
    return { asset, family, location, documents, barcodes, customValues, assignments, lifecycle, children, recentFailures };
  }));

  app.patch(`${ROOT}/assets/:assetId`, route("cmms.asset.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "NameFa", "NameEn", "AssetState", "CriticalityRank", "LocationId", "ParentAssetId",
      "SerialNumber", "Manufacturer", "Model", "WarrantyExpiresOn", "ExpectedLifeYears",
      "MfgWorkCenterId", "ScmWarehouseId", "IsActive", "NoteFa", "RowVersion",
    ]));
    const assetId = id(req.params.assetId, "assetId");
    const existing = await mustFind(r, "CmmsAsset", assetId, siteId);
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.NameEn !== undefined) patch.NameEn = text(req.body.NameEn, "NameEn", { max: 240 });
    if (req.body.AssetState !== undefined) {
      patch.AssetState = oneOf(req.body.AssetState, "AssetState",
        ["planned", "installed", "commissioned", "operating", "standby", "under-maintenance", "degraded", "retired", "disposed"], { required: true });
    }
    if (req.body.CriticalityRank !== undefined) patch.CriticalityRank = oneOf(req.body.CriticalityRank, "CriticalityRank", ["A", "B", "C", "D"], { required: true });
    if (req.body.SerialNumber !== undefined) patch.SerialNumber = text(req.body.SerialNumber, "SerialNumber", { max: 120 });
    if (req.body.Manufacturer !== undefined) patch.Manufacturer = text(req.body.Manufacturer, "Manufacturer", { max: 240 });
    if (req.body.Model !== undefined) patch.Model = text(req.body.Model, "Model", { max: 160 });
    if (req.body.WarrantyExpiresOn !== undefined) patch.WarrantyExpiresOn = isoDate(req.body.WarrantyExpiresOn, "WarrantyExpiresOn");
    if (req.body.ExpectedLifeYears !== undefined) patch.ExpectedLifeYears = optionalNumber(req.body.ExpectedLifeYears, "ExpectedLifeYears", { min: 0.01 });
    if (req.body.MfgWorkCenterId !== undefined) patch.MfgWorkCenterId = text(req.body.MfgWorkCenterId, "MfgWorkCenterId", { max: 60 });
    if (req.body.ScmWarehouseId !== undefined) patch.ScmWarehouseId = text(req.body.ScmWarehouseId, "ScmWarehouseId", { max: 60 });
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (req.body.LocationId !== undefined) {
      patch.LocationId = req.body.LocationId === null ? null : id(req.body.LocationId, "LocationId");
      if (patch.LocationId) await mustFind(r, "CmmsLocation", patch.LocationId, siteId);
    }
    if (req.body.ParentAssetId !== undefined) {
      const nextParent = req.body.ParentAssetId === null ? null : id(req.body.ParentAssetId, "ParentAssetId");
      if (nextParent) {
        await mustFind(r, "CmmsAsset", nextParent, siteId);
        const all = await listInSite(r, "CmmsAsset", siteId);
        const nodes = all.map((row) => ({ id: row.Id, parentId: row.ParentAssetId ?? null }));
        if (wouldCreateCycle(nodes, nextParent, assetId)) {
          throw businessRule("CMMS_ASSET_TREE_CYCLE", "این انتساب در درخت تجهیز حلقه ایجاد می‌کند");
        }
      }
      patch.ParentAssetId = nextParent;
    }
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    const result = await r.patch("CmmsAsset", assetId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("CMMS_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "CMMS_ASSET_UPDATED", "CmmsAsset", assetId, "cmms.asset.edit", { fields: Object.keys(patch) });
    return r.get("CmmsAsset", assetId);
  }));

  app.post(`${ROOT}/assets/:assetId/family-assignments`, route("cmms.family.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["FamilyId", "EffectiveFrom", "EffectiveTo", "IsPrimary", "InheritPmTasks", "InheritFailureModes", "InheritCustomFields", "ReasonFa"]));
    const assetId = id(req.params.assetId, "assetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const familyId = id(req.body.FamilyId, "FamilyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const EffectiveFrom = isoDate(req.body.EffectiveFrom, "EffectiveFrom", { required: true });
    const EffectiveTo = isoDate(req.body.EffectiveTo, "EffectiveTo");
    if (EffectiveTo && EffectiveTo < EffectiveFrom) throw bad("EffectiveTo", "تاریخ پایان پیش از تاریخ شروع است");
    const IsPrimary = bool(req.body.IsPrimary, "IsPrimary", true);
    if (IsPrimary) {
      const existingPrimary = await r.findOne("CmmsAssetFamilyAssignment", [
        { column: "AssetId", op: "eq", value: assetId }, { column: "IsPrimary", op: "eq", value: true },
      ]);
      if (existingPrimary && existingPrimary.FamilyId !== familyId) {
        throw conflict("CMMS_PRIMARY_FAMILY_EXISTS", "این تجهیز پیش‌تر خانوادهٔ اصلی دیگری دارد؛ آن را غیرفعال کنید");
      }
    }
    const row = await r.create("CmmsAssetFamilyAssignment", {
      SiteId: siteId, FamilyId: familyId, AssetId: assetId, EffectiveFrom, EffectiveTo, IsPrimary,
      InheritPmTasks: bool(req.body.InheritPmTasks, "InheritPmTasks", true),
      InheritFailureModes: bool(req.body.InheritFailureModes, "InheritFailureModes", true),
      InheritCustomFields: bool(req.body.InheritCustomFields, "InheritCustomFields", true),
      ReasonFa: text(req.body.ReasonFa, "ReasonFa", { max: 600 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_ASSET_FAMILY_ASSIGNED", "CmmsAssetFamilyAssignment", row.Id, "cmms.family.edit", { assetId, familyId });
    return row;
  }, 201));

  app.post(`${ROOT}/assets/:assetId/barcodes`, route("cmms.barcode.print", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["BarcodeValue", "BarcodeType", "PrintedLabel", "PrintedOn", "IsPrimary", "IsActive"]));
    const assetId = id(req.params.assetId, "assetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const BarcodeValue = text(req.body.BarcodeValue, "BarcodeValue", { required: true, max: 120, min: MIN_BARCODE_LEN });
    if (await r.findOne("CmmsAssetBarcode", [{ column: "SiteId", op: "eq", value: siteId }, { column: "BarcodeValue", op: "eq", value: BarcodeValue }])) {
      throw conflict("CMMS_DUPLICATE", `مقدار بارکد «${BarcodeValue}» در این سایت تکراری است`);
    }
    const row = await r.create("CmmsAssetBarcode", {
      SiteId: siteId, AssetId: assetId, BarcodeValue,
      BarcodeType: oneOf(req.body.BarcodeType, "BarcodeType", ["qr", "code128", "ean13", "datamatrix", "rfid"], { fallback: "qr" }),
      PrintedLabel: text(req.body.PrintedLabel, "PrintedLabel", { max: 120 }),
      PrintedOn: isoDate(req.body.PrintedOn, "PrintedOn"),
      PrintedBy: requestActor(req),
      IsPrimary: bool(req.body.IsPrimary, "IsPrimary", false),
      IsActive: bool(req.body.IsActive, "IsActive", true),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_BARCODE_CREATED", "CmmsAssetBarcode", row.Id, "cmms.barcode.print", { assetId });
    return row;
  }, 201));

  app.post(`${ROOT}/assets/:assetId/documents`, route("cmms.document.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["DocCode", "TitleFa", "DocType", "Revision", "StoragePath", "FileFormat", "FileSizeBytes", "InheritedFromFamilyDocumentId", "IssuedOn", "ExpiresOn", "IsActive", "NoteFa"]));
    const assetId = id(req.params.assetId, "assetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const DocCode = code(req.body.DocCode, "DocCode");
    const Revision = text(req.body.Revision, "Revision", { max: 40 }) ?? "A";
    if (await r.findOne("CmmsAssetDocument", [
      { column: "AssetId", op: "eq", value: assetId }, { column: "DocCode", op: "eq", value: DocCode }, { column: "Revision", op: "eq", value: Revision },
    ])) throw conflict("CMMS_DUPLICATE", `سند تجهیز «${DocCode}/${Revision}» تکراری است`);
    const InheritedFromFamilyDocumentId = req.body.InheritedFromFamilyDocumentId === undefined ? null : id(req.body.InheritedFromFamilyDocumentId, "InheritedFromFamilyDocumentId");
    if (InheritedFromFamilyDocumentId) await mustFind(r, "CmmsFamilyDocument", InheritedFromFamilyDocumentId, siteId);
    const row = await r.create("CmmsAssetDocument", {
      SiteId: siteId, AssetId: assetId, DocCode, Revision,
      TitleFa: text(req.body.TitleFa, "TitleFa", { required: true, max: 300 }),
      DocType: oneOf(req.body.DocType, "DocType",
        ["drawing", "catalog", "manual", "datasheet", "certificate", "sop", "procedure", "photo", "test-report", "other"], { required: true }),
      StoragePath: text(req.body.StoragePath, "StoragePath", { max: 600 }),
      FileFormat: text(req.body.FileFormat, "FileFormat", { max: 20 }),
      FileSizeBytes: optionalNumber(req.body.FileSizeBytes, "FileSizeBytes", { integer: true, min: 0 }),
      InheritedFromFamilyDocumentId,
      IssuedOn: isoDate(req.body.IssuedOn, "IssuedOn"),
      ExpiresOn: isoDate(req.body.ExpiresOn, "ExpiresOn"),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_ASSET_DOCUMENT_CREATED", "CmmsAssetDocument", row.Id, "cmms.document.edit", { assetId });
    return row;
  }, 201));

  app.get(`${ROOT}/assets/:assetId/meters`, route("cmms.meter.view", async ({ repo: r, req, siteId }) => {
    const assetId = id(req.params.assetId, "assetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const meters = await childrenOf(r, "CmmsMeterDefinition", siteId, "AssetId", assetId);
    const withReadings = await Promise.all(meters.map(async (meter) => ({
      ...meter,
      lastReading: (await listInSite(r, "CmmsMeterReading", siteId, {
        where: [{ column: "MeterDefinitionId", op: "eq", value: meter.Id }],
        orderBy: [{ column: "ReadAt", dir: "desc" }], limit: 1,
      }))[0] ?? null,
    })));
    return { meters: withReadings, total: withReadings.length };
  }));

  app.post(`${ROOT}/assets/:assetId/meters`, route("cmms.asset.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["MeterCode", "NameFa", "Uom", "MeterType", "InitialValue", "RollOverAt", "ReadingSource", "FamilyOperatingParamId", "IsActive"]));
    const assetId = id(req.params.assetId, "assetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const MeterCode = code(req.body.MeterCode, "MeterCode");
    if (await r.findOne("CmmsMeterDefinition", [
      { column: "AssetId", op: "eq", value: assetId }, { column: "MeterCode", op: "eq", value: MeterCode },
    ])) throw conflict("CMMS_DUPLICATE", `کد کنتور «${MeterCode}» تکراری است`);
    const row = await r.create("CmmsMeterDefinition", {
      SiteId: siteId, AssetId: assetId, MeterCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      Uom: text(req.body.Uom, "Uom", { required: true, max: 24 }),
      MeterType: oneOf(req.body.MeterType, "MeterType", ["absolute", "delta"], { fallback: "absolute" }),
      InitialValue: optionalNumber(req.body.InitialValue, "InitialValue", { min: 0 }),
      RollOverAt: optionalNumber(req.body.RollOverAt, "RollOverAt", { min: 0.0001 }),
      ReadingSource: text(req.body.ReadingSource, "ReadingSource", { max: 40 }),
      FamilyOperatingParamId: req.body.FamilyOperatingParamId === undefined ? null : id(req.body.FamilyOperatingParamId, "FamilyOperatingParamId"),
      IsActive: bool(req.body.IsActive, "IsActive", true),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_METER_CREATED", "CmmsMeterDefinition", row.Id, "cmms.asset.edit", { assetId });
    return row;
  }, 201));

  app.post(`${ROOT}/meters/:meterId/readings`, route("cmms.meter.read", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["ReadAt", "Value", "Source", "IsEstimated", "WorkOrderId"]));
    const meterId = id(req.params.meterId, "meterId");
    const meter = await mustFind(r, "CmmsMeterDefinition", meterId, siteId);
    const ReadAt = isoDateTime(req.body.ReadAt, "ReadAt", { required: true });
    const Value = number(req.body.Value, "Value", { required: true, min: 0 });
    const previous = (await listInSite(r, "CmmsMeterReading", siteId, {
      where: [{ column: "MeterDefinitionId", op: "eq", value: meterId }],
      orderBy: [{ column: "ReadAt", dir: "desc" }], limit: 1,
    }))[0] ?? null;
    /* برای کنتور مطلق، مقدار نباید عقب برود. استثنا فقط rollover است که
     * باید صریحاً تعریف شده باشد. */
    const baseline = previous?.Value ?? meter.InitialValue ?? 0;
    let Delta = Value >= baseline ? Value - baseline : null;
    if (Value < baseline) {
      if (meter.MeterType === "absolute" && meter.RollOverAt && Value <= meter.RollOverAt) {
        Delta = meter.RollOverAt - baseline + Value;
      } else {
        throw businessRule("CMMS_METER_BACKWARD", `قرائت ${Value} از قرائت پیشین ${baseline} کمتر است و rollover تعریف نشده`, {
          meterId, previousValue: baseline, value: Value,
        });
      }
    }
    const row = await r.create("CmmsMeterReading", {
      SiteId: siteId, MeterDefinitionId: meterId, AssetId: meter.AssetId,
      ReadAt, ReadOn: ReadAt.slice(0, 10), Value, Delta,
      ReadBy: requestActor(req),
      Source: oneOf(req.body.Source, "Source", ["manual", "scada", "iiot", "erp"], { fallback: "manual" }),
      IsEstimated: bool(req.body.IsEstimated, "IsEstimated", false),
      WorkOrderId: req.body.WorkOrderId === undefined ? null : id(req.body.WorkOrderId, "WorkOrderId"),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_METER_READING_POSTED", "CmmsMeterReading", row.Id, "cmms.meter.read", { meterId, Value, Delta });
    return { reading: row, delta: Delta };
  }, 201));

  app.get(`${ROOT}/assets/:assetId/lifecycle-events`, route("cmms.asset.view", async ({ repo: r, req, siteId }) => {
    const assetId = id(req.params.assetId, "assetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const rows = await childrenOf(r, "CmmsAssetLifecycleEvent", siteId, "AssetId", assetId);
    return { events: rows, total: rows.length };
  }));

  /* ───────────────────────── ۴. درخواست‌کار و دستورکار ───────────────────────── */

  app.get(`${ROOT}/work-requests`, route("cmms.request.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["status", "priority", "assetId", "limit", "offset"]));
    const where = [];
    if (req.query.status !== undefined) {
      where.push({ column: "Status", op: "eq", value: oneOf(req.query.status, "status", ["submitted", "under-review", "approved", "converted", "rejected", "cancelled"], { required: true }) });
    }
    if (req.query.priority !== undefined) where.push({ column: "Priority", op: "eq", value: number(req.query.priority, "priority", { integer: true, min: 1, max: 5 }) });
    if (req.query.assetId !== undefined) where.push({ column: "AssetId", op: "eq", value: id(req.query.assetId, "assetId") });
    const rows = await listInSite(r, "CmmsWorkRequest", siteId, {
      where, orderBy: [{ column: "Priority", dir: "asc" }, { column: "ReportedOn", dir: "desc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 500),
      offset: pageNumber(req.query.offset, "offset", 0, 1_000_000),
    });
    return { requests: rows, total: rows.length };
  }));

  app.post(`${ROOT}/work-requests`, route("cmms.request.create", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "RequestNo", "AssetId", "LocationId", "RequestType", "Priority", "ReportedOn",
      "TitleFa", "DescriptionFa", "SymptomFa", "FamilyFailureModeId", "IsAssetStopped",
    ]));
    const RequestNo = code(req.body.RequestNo, "RequestNo");
    const assetId = id(req.body.AssetId, "AssetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    if (await r.findOne("CmmsWorkRequest", [{ column: "SiteId", op: "eq", value: siteId }, { column: "RequestNo", op: "eq", value: RequestNo }])) {
      throw conflict("CMMS_DUPLICATE", `شمارهٔ درخواست «${RequestNo}» تکراری است`);
    }
    const FamilyFailureModeId = req.body.FamilyFailureModeId === undefined ? null : id(req.body.FamilyFailureModeId, "FamilyFailureModeId");
    if (FamilyFailureModeId) await mustFind(r, "CmmsFamilyFailureMode", FamilyFailureModeId, siteId);
    const ReportedOn = isoDate(req.body.ReportedOn, "ReportedOn") ?? todayUtc();
    const row = await r.create("CmmsWorkRequest", {
      SiteId: siteId, RequestNo, AssetId: assetId,
      LocationId: req.body.LocationId === undefined ? null : id(req.body.LocationId, "LocationId"),
      RequestType: oneOf(req.body.RequestType, "RequestType",
        ["breakdown", "corrective", "preventive", "improvement", "service", "inspection"], { required: true }),
      Priority: number(req.body.Priority, "Priority", { integer: true, min: 1, max: 5 }) ?? 3,
      Status: "submitted", ReportedOn, ReportedAt: new Date().toISOString(),
      ReporterId: requestActor(req),
      TitleFa: text(req.body.TitleFa, "TitleFa", { required: true, max: 300 }),
      DescriptionFa: text(req.body.DescriptionFa, "DescriptionFa", { max: 4000 }),
      SymptomFa: text(req.body.SymptomFa, "SymptomFa", { max: 1000 }),
      FamilyFailureModeId,
      IsAssetStopped: bool(req.body.IsAssetStopped, "IsAssetStopped", false),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_WORK_REQUEST_CREATED", "CmmsWorkRequest", row.Id, "cmms.request.create", { assetId });
    return row;
  }, 201));

  app.post(`${ROOT}/work-requests/:requestId/review`, route("cmms.request.review", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["Decision", "RejectionReasonFa"]));
    const requestId = id(req.params.requestId, "requestId");
    const existing = await mustFind(r, "CmmsWorkRequest", requestId, siteId);
    if (["converted", "rejected", "cancelled"].includes(existing.Status)) {
      throw conflict("CMMS_REQUEST_FINAL", `درخواست در وضعیت «${existing.Status}» قابل بررسی مجدد نیست`);
    }
    const Decision = oneOf(req.body.Decision, "Decision", ["approve", "reject"], { required: true });
    const patch = Decision === "approve"
      ? { Status: "approved", ReviewedById: requestActor(req), ReviewedAt: new Date().toISOString() }
      : {
        Status: "rejected", ReviewedById: requestActor(req), ReviewedAt: new Date().toISOString(),
        RejectionReasonFa: text(req.body.RejectionReasonFa, "RejectionReasonFa", { required: true, max: 1000 }),
      };
    await r.patch("CmmsWorkRequest", requestId, patch, requestActor(req), existing.RowVersion);
    await writeAudit(r, req, `CMMS_WORK_REQUEST_${Decision.toUpperCase()}`, "CmmsWorkRequest", requestId, "cmms.request.review");
    return r.get("CmmsWorkRequest", requestId);
  }));

  app.get(`${ROOT}/work-orders`, route("cmms.wo.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["status", "priority", "assetId", "workOrderType", "technicianId", "from", "to", "limit", "offset"]));
    const where = [];
    if (req.query.status !== undefined) {
      where.push({
        column: "Status", op: "eq",
        value: oneOf(req.query.status, "status",
          ["draft", "planned", "scheduled", "released", "in-progress", "on-hold", "completed", "closed", "cancelled"], { required: true }),
      });
    }
    if (req.query.priority !== undefined) where.push({ column: "Priority", op: "eq", value: number(req.query.priority, "priority", { integer: true, min: 1, max: 5 }) });
    if (req.query.assetId !== undefined) where.push({ column: "AssetId", op: "eq", value: id(req.query.assetId, "assetId") });
    if (req.query.workOrderType !== undefined) {
      where.push({ column: "WorkOrderType", op: "eq", value: oneOf(req.query.workOrderType, "workOrderType", ["pm", "cm", "emergency", "overhaul", "project", "calibration", "inspection"], { required: true }) });
    }
    if (req.query.technicianId !== undefined) where.push({ column: "PrimaryTechnicianId", op: "eq", value: id(req.query.technicianId, "technicianId") });
    if (req.query.from !== undefined) where.push({ column: "ScheduledStartAt", op: "gte", value: isoDate(req.query.from, "from", { required: true }) });
    if (req.query.to !== undefined) where.push({ column: "ScheduledStartAt", op: "lte", value: isoDate(req.query.to, "to", { required: true }) });
    const rows = await listInSite(r, "CmmsWorkOrder", siteId, {
      where, orderBy: [{ column: "Priority", dir: "asc" }, { column: "ScheduledStartAt", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 500),
      offset: pageNumber(req.query.offset, "offset", 0, 1_000_000),
    });
    return { workOrders: rows, total: rows.length };
  }));

  app.post(`${ROOT}/work-orders`, route("cmms.wo.create", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "WorkOrderNo", "WorkOrderType", "AssetId", "LocationId", "WorkRequestId", "PmScheduleId",
      "FamilyPmTaskId", "TitleFa", "ScopeFa", "Priority", "PlannedStartAt", "PlannedFinishAt",
      "EstimatedHours", "EstimatedCost", "CrewId", "PrimaryTechnicianId", "VendorId",
      "IsAssetDown", "ProductionImpact",
    ]));
    const WorkOrderNo = code(req.body.WorkOrderNo, "WorkOrderNo");
    if (await r.findOne("CmmsWorkOrder", [{ column: "SiteId", op: "eq", value: siteId }, { column: "WorkOrderNo", op: "eq", value: WorkOrderNo }])) {
      throw conflict("CMMS_DUPLICATE", `شمارهٔ دستورکار «${WorkOrderNo}» تکراری است`);
    }
    const WorkOrderType = oneOf(req.body.WorkOrderType, "WorkOrderType",
      ["pm", "cm", "emergency", "overhaul", "project", "calibration", "inspection"], { required: true });
    const assetId = req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId");
    if (assetId) await mustFind(r, "CmmsAsset", assetId, siteId);
    const PlannedStartAt = isoDateTime(req.body.PlannedStartAt, "PlannedStartAt");
    const PlannedFinishAt = isoDateTime(req.body.PlannedFinishAt, "PlannedFinishAt");
    if (PlannedStartAt && PlannedFinishAt && PlannedFinishAt < PlannedStartAt) {
      throw bad("PlannedFinishAt", "پایان برنامه‌ریزی‌شده پیش از شروع آن است");
    }
    /* دستورکار بدون تجهیز و بدون مکان یعنی کار شناور؛ در نت چنین رکوردی
     * هرگز بسته نمی‌شود و هزینه‌اش به هیچ دارایی نمی‌نشیند. */
    if (!assetId && !req.body.LocationId) {
      throw bad("AssetId", "دستورکار باید دست‌کم به یک تجهیز یا یک مکان مربوط باشد");
    }
    const Priority = number(req.body.Priority, "Priority", { integer: true, min: 1, max: 5 }) ?? 3;

    const row = await r.create("CmmsWorkOrder", {
      SiteId: siteId, WorkOrderNo, WorkOrderType, AssetId: assetId,
      LocationId: req.body.LocationId === undefined ? null : id(req.body.LocationId, "LocationId"),
      WorkRequestId: req.body.WorkRequestId === undefined ? null : id(req.body.WorkRequestId, "WorkRequestId"),
      PmScheduleId: req.body.PmScheduleId === undefined ? null : id(req.body.PmScheduleId, "PmScheduleId"),
      FamilyPmTaskId: req.body.FamilyPmTaskId === undefined ? null : id(req.body.FamilyPmTaskId, "FamilyPmTaskId"),
      TitleFa: text(req.body.TitleFa, "TitleFa", { required: true, max: 300 }),
      ScopeFa: text(req.body.ScopeFa, "ScopeFa", { max: 4000 }),
      Priority, Status: "draft",
      PlannedStartAt, PlannedFinishAt,
      EstimatedHours: optionalNumber(req.body.EstimatedHours, "EstimatedHours", { min: 0 }),
      EstimatedCost: optionalNumber(req.body.EstimatedCost, "EstimatedCost", { min: 0 }),
      CrewId: req.body.CrewId === undefined ? null : id(req.body.CrewId, "CrewId"),
      PrimaryTechnicianId: req.body.PrimaryTechnicianId === undefined ? null : id(req.body.PrimaryTechnicianId, "PrimaryTechnicianId"),
      VendorId: req.body.VendorId === undefined ? null : id(req.body.VendorId, "VendorId"),
      IsAssetDown: bool(req.body.IsAssetDown, "IsAssetDown", false),
      ProductionImpact: oneOf(req.body.ProductionImpact, "ProductionImpact", ["none", "partial", "line-stop", "plant-stop"], { fallback: "none" }),
      ModelVersion: CMMS_MODEL_VERSION,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_WORK_ORDER_CREATED", "CmmsWorkOrder", row.Id, "cmms.wo.create", { WorkOrderType, Priority });
    return row;
  }, 201));

  app.get(`${ROOT}/work-orders/:workOrderId`, route("cmms.wo.view", async ({ repo: r, req, siteId }) => {
    const workOrderId = id(req.params.workOrderId, "workOrderId");
    const workOrder = await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
    const [tasks, labor, materials, costs] = await Promise.all([
      childrenOf(r, "CmmsWorkOrderTask", siteId, "WorkOrderId", workOrderId),
      childrenOf(r, "CmmsWorkOrderLabor", siteId, "WorkOrderId", workOrderId),
      childrenOf(r, "CmmsWorkOrderMaterial", siteId, "WorkOrderId", workOrderId),
      childrenOf(r, "CmmsWorkOrderCost", siteId, "WorkOrderId", workOrderId),
    ]);
    const totals = costs.reduce((acc, cost) => {
      acc[cost.CostElement] = (acc[cost.CostElement] ?? 0) + (cost.Amount ?? 0);
      acc.total += cost.Amount ?? 0;
      return acc;
    }, { total: 0 });
    const actualHours = labor.reduce((sum, entry) => sum + (entry.RegularHours ?? 0) + (entry.OvertimeHours ?? 0), 0);
    return {
      workOrder, tasks, labor, materials, costs,
      totals: { ...totals, total: Math.round(totals.total * 100) / 100, actualHours: Math.round(actualHours * 1000) / 1000 },
    };
  }));

  /* چرخهٔ وضعیت دستورکار: draft → released → in-progress → completed → closed */
  /**
   * ماده‌سازی چک‌لیست خانواده روی دستورکار هنگام «release».
   *
   * چرا هنگام release و نه create: پیش از آزادسازی، ممکن است برنامه‌ریز
   * دامنهٔ کار را عوض کند. اگر ردیف‌ها در create کپی شوند، تغییر چک‌لیست
   * خانواده روی دستورکارهای از قبل ساخته‌شده اثر نمی‌گذارد و قاعدهٔ
   * «چک‌لیست بی‌نتیجه = بسته‌نشدن» روی دادهٔ کهنه اجرا می‌شود.
   *
   * اگر ردیف از پیش وجود داشته باشد، دوباره کپی نمی‌کنیم تا release دوم
   * چک‌لیست را دو برابر نکند.
   */
  const materializeChecklist = async (tx, siteId, workOrder, actor) => {
    let familyPmTaskId = workOrder.FamilyPmTaskId ?? null;
    if (!familyPmTaskId && workOrder.PmScheduleId) {
      const schedule = await tx.get("CmmsPmSchedule", workOrder.PmScheduleId);
      familyPmTaskId = schedule?.FamilyPmTaskId ?? null;
    }
    if (!familyPmTaskId) return 0;
    const existing = await childrenOf(tx, "CmmsWorkOrderTask", siteId, "WorkOrderId", workOrder.Id);
    if (existing.length > 0) return 0;
    const items = await childrenOf(tx, "CmmsPmChecklistItem", siteId, "FamilyPmTaskId", familyPmTaskId);
    const ordered = [...items].sort((left, right) => (left.SortOrder ?? 0) - (right.SortOrder ?? 0));
    let lineNo = 0;
    for (const item of ordered) {
      lineNo += 1;
      await tx.create("CmmsWorkOrderTask", {
        SiteId: siteId, WorkOrderId: workOrder.Id,
        FamilyPmTaskId: familyPmTaskId, ChecklistItemId: item.Id,
        LineNo: lineNo,
        DescriptionFa: item.DescriptionFa,
        /* «pending» عمداً: نتیجه را باید تکنسین ثبت کند. اگر اینجا pass
         * بگذاریم، چک‌لیست تشریفاتی می‌شود و در ممیزی شواهدی نمی‌ماند. */
        ResultStatus: "pending",
        MeasuredValueText: null, MeasuredValueNumber: null,
        PlannedMinutes: null, ActualMinutes: null,
        PerformedBy: null, PerformedAt: null, FindingFa: null,
      }, actor);
    }
    return lineNo;
  };

  const woTransition = (action, fromStatuses, toStatus, permission, extraPatch = {}) =>
    route(permission, async ({ repo: r, req, siteId }) => {
      const workOrderId = id(req.params.workOrderId, "workOrderId");
      const existing = await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
      if (!fromStatuses.includes(existing.Status)) {
        throw businessRule("CMMS_WO_STATE", `دستورکار در وضعیت «${existing.Status}» قابل «${action}» نیست`, {
          allowedFrom: fromStatuses, currentStatus: existing.Status,
        });
      }
      const now = new Date().toISOString();
      const patch = { Status: toStatus, ...extraPatch };
      if (action === "release") patch.ReleasedAt = now;
      if (action === "start") patch.StartedAt = now;
      if (action === "complete") { patch.CompletedAt = now; patch.CompletedById = requestActor(req); }
      if (action === "close") { patch.ClosedAt = now; patch.ClosedById = requestActor(req); }
      const materializedTasks = action === "release"
        ? await materializeChecklist(r, siteId, existing, requestActor(req))
        : 0;
      await r.patch("CmmsWorkOrder", workOrderId, patch, requestActor(req), existing.RowVersion);
      await writeAudit(r, req, `CMMS_WORK_ORDER_${action.toUpperCase()}`, "CmmsWorkOrder", workOrderId, permission, {
        from: existing.Status, to: toStatus, materializedTasks,
      });
      return r.get("CmmsWorkOrder", workOrderId);
    });

  app.post(`${ROOT}/work-orders/:workOrderId/release`,
    woTransition("release", ["draft", "planned", "scheduled"], "released", "cmms.wo.release"));

  app.post(`${ROOT}/work-orders/:workOrderId/start`,
    woTransition("start", ["released", "on-hold"], "in-progress", "cmms.wo.execute"));

  app.post(`${ROOT}/work-orders/:workOrderId/cancel`,
    woTransition("cancel", ["draft", "planned", "scheduled", "released", "on-hold"], "cancelled", "cmms.wo.cancel"));

  /* اتمام و بستن عمداً از الگوی سادهٔ بالا جدا نوشته شده‌اند، چون هر دو
   * قانون کسب‌وکاری دارند که در یک helper مشترک پنهان می‌شد. */
  app.post(`${ROOT}/work-orders/:workOrderId/complete`, route("cmms.wo.complete", async ({ repo: r, req, siteId }) => {
    const workOrderId = id(req.params.workOrderId, "workOrderId");
    const existing = await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
    if (existing.Status !== "in-progress") {
      throw businessRule("CMMS_WO_STATE", `فقط دستورکار در حال اجرا قابل اتمام است (وضعیت جاری: ${existing.Status})`);
    }
    const tasks = await childrenOf(r, "CmmsWorkOrderTask", siteId, "WorkOrderId", workOrderId);
    const pending = tasks.filter((task) => task.ResultStatus === "pending");
    /* ردیف بی‌نتیجه یعنی کار واقعاً تمام نشده. پذیرفتن آن یعنی چک‌لیست
     * تشریفاتی می‌شود و بعد در ممیزی هیچ شواهدی برای انجام کار نیست. */
    if (pending.length > 0) {
      throw businessRule("CMMS_WO_PENDING_TASKS", `${pending.length} ردیف چک‌لیست بی‌نتیجه است و دستورکار بسته نمی‌شود`, {
        pendingLineNos: pending.map((task) => task.LineNo),
      });
    }
    const labor = await childrenOf(r, "CmmsWorkOrderLabor", siteId, "WorkOrderId", workOrderId);
    const actualHours = Math.round(labor.reduce((sum, entry) => sum + (entry.RegularHours ?? 0) + (entry.OvertimeHours ?? 0), 0) * 1000) / 1000;
    const now = new Date().toISOString();
    await r.patch("CmmsWorkOrder", workOrderId, {
      Status: "completed", CompletedAt: now, CompletedById: requestActor(req),
      ActualHours: actualHours, IsAssetDown: false,
    }, requestActor(req), existing.RowVersion);
    await writeAudit(r, req, "CMMS_WORK_ORDER_COMPLETED", "CmmsWorkOrder", workOrderId, "cmms.wo.complete", { actualHours, taskCount: tasks.length });
    return r.get("CmmsWorkOrder", workOrderId);
  }));

  app.post(`${ROOT}/work-orders/:workOrderId/close`, route("cmms.wo.close", async ({ repo: r, req, siteId }) => {
    const workOrderId = id(req.params.workOrderId, "workOrderId");
    const existing = await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
    if (existing.Status !== "completed") {
      throw businessRule("CMMS_WO_STATE", `فقط دستورکار تمام‌شده قابل بستن است (وضعیت جاری: ${existing.Status})`);
    }
    const costs = await childrenOf(r, "CmmsWorkOrderCost", siteId, "WorkOrderId", workOrderId);
    const actualCost = Math.round(costs.reduce((sum, cost) => sum + (cost.Amount ?? 0), 0) * 100) / 100;
    const now = new Date().toISOString();
    await r.patch("CmmsWorkOrder", workOrderId, {
      Status: "closed", ClosedAt: now, ClosedById: requestActor(req), ActualCost: actualCost,
    }, requestActor(req), existing.RowVersion);
    await writeAudit(r, req, "CMMS_WORK_ORDER_CLOSED", "CmmsWorkOrder", workOrderId, "cmms.wo.close", { actualCost, costLines: costs.length });
    return r.get("CmmsWorkOrder", workOrderId);
  }));

  /* ── ردیف‌های چک‌لیست دستورکار ──────────────────────────────────────────
   * بدون این دو مسیر، قاعدهٔ «دستورکار با چک‌لیست بی‌نتیجه بسته نمی‌شود»
   * هرگز نمی‌توانست اجرا شود چون هیچ راهی برای ساختن ردیف وجود نداشت. */

  app.post(`${ROOT}/work-orders/:workOrderId/tasks`, route("cmms.wo.plan", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "FamilyPmTaskId", "ChecklistItemId", "LineNo", "DescriptionFa",
      "PlannedMinutes", "Replace",
    ]));
    const workOrderId = id(req.params.workOrderId, "workOrderId");
    const workOrder = await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
    if (["completed", "closed", "cancelled"].includes(workOrder.Status)) {
      throw businessRule("CMMS_WO_STATE", `دستورکار در وضعیت «${workOrder.Status}» ردیف تازه نمی‌گیرد`);
    }
    return r.transaction(async (tx) => {
      if (bool(req.body.Replace, "Replace", false)) {
        const existing = await childrenOf(tx, "CmmsWorkOrderTask", siteId, "WorkOrderId", workOrderId);
        /* ردیف نتیجه‌دار پاک نمی‌شود: پاک‌کردن شواهد انجام کار، همان چیزی است
         * که ممیزی ISO 55001 رد می‌کند. */
        for (const task of existing) {
          if (task.ResultStatus !== "pending") {
            throw businessRule("CMMS_WO_TASK_RESULT_LOCKED", `ردیف ${task.LineNo} نتیجهٔ «${task.ResultStatus}» دارد و جایگزین نمی‌شود`);
          }
          await tx.remove("CmmsWorkOrderTask", task.Id);
        }
      }
      const existing = await childrenOf(tx, "CmmsWorkOrderTask", siteId, "WorkOrderId", workOrderId);
      const nextLineNo = existing.reduce((max, task) => Math.max(max, task.LineNo ?? 0), 0);
      const LineNo = number(req.body.LineNo, "LineNo", { integer: true, min: 1 }) ?? nextLineNo + 1;
      if (existing.some((task) => task.LineNo === LineNo)) {
        throw conflict("CMMS_DUPLICATE", `شمارهٔ ردیف ${LineNo} در این دستورکار تکراری است`);
      }
      const ChecklistItemId = req.body.ChecklistItemId === undefined ? null : id(req.body.ChecklistItemId, "ChecklistItemId");
      if (ChecklistItemId) await mustFind(tx, "CmmsPmChecklistItem", ChecklistItemId, siteId);
      const row = await tx.create("CmmsWorkOrderTask", {
        SiteId: siteId, WorkOrderId: workOrderId,
        FamilyPmTaskId: req.body.FamilyPmTaskId === undefined ? workOrder.FamilyPmTaskId ?? null : id(req.body.FamilyPmTaskId, "FamilyPmTaskId"),
        ChecklistItemId, LineNo,
        DescriptionFa: text(req.body.DescriptionFa, "DescriptionFa", { required: true, max: 1000 }),
        ResultStatus: "pending",
        MeasuredValueText: null, MeasuredValueNumber: null,
        PlannedMinutes: optionalNumber(req.body.PlannedMinutes, "PlannedMinutes", { min: 0 }),
        ActualMinutes: null, PerformedBy: null, PerformedAt: null, FindingFa: null,
      }, requestActor(req));
      await createAuditRecord(tx, req, "CMMS_WO_TASK_ADDED", "CmmsWorkOrderTask", row.Id, "cmms.wo.plan", { workOrderId, LineNo });
      return row;
    });
  }, 201));

  app.patch(`${ROOT}/work-orders/:workOrderId/tasks/:taskId`, route("cmms.wo.execute", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "ResultStatus", "MeasuredValueText", "MeasuredValueNumber", "ActualMinutes", "FindingFa", "RowVersion",
    ]));
    const workOrderId = id(req.params.workOrderId, "workOrderId");
    const taskId = id(req.params.taskId, "taskId");
    const workOrder = await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
    if (!["released", "in-progress", "on-hold"].includes(workOrder.Status)) {
      throw businessRule("CMMS_WO_STATE", `ثبت نتیجه فقط روی دستورکار آزاد/در حال اجرا مجاز است (وضعیت: ${workOrder.Status})`);
    }
    const task = await mustFind(r, "CmmsWorkOrderTask", taskId, siteId);
    if (task.WorkOrderId !== workOrderId) {
      throw bad("taskId", "این ردیف به دستورکار جاری تعلق ندارد");
    }
    const ResultStatus = oneOf(req.body.ResultStatus, "ResultStatus", ["pass", "fail", "na", "deferred"], { required: true });
    /* «fail» بدون شرح یعنی خرابی ثبت‌نشده. ردیف مردود باید بگوید چه دیده شد. */
    const FindingFa = text(req.body.FindingFa, "FindingFa", { max: 1000 });
    if (ResultStatus === "fail" && !FindingFa) {
      throw bad("FindingFa", "ردیف ناموفق باید شرح یافته داشته باشد");
    }
    const MeasuredValueNumber = optionalNumber(req.body.MeasuredValueNumber, "MeasuredValueNumber");
    /* اگر ردیف به یک قلم چک‌لیست با بازهٔ مجاز وصل است، مقدار بیرون بازه
     * نباید بی‌صدا «pass» بماند. */
    if (task.ChecklistItemId && MeasuredValueNumber != null) {
      const item = await r.get("CmmsPmChecklistItem", task.ChecklistItemId);
      if (item) {
        if (item.MinValue != null && MeasuredValueNumber < item.MinValue) {
          throw businessRule("CMMS_WO_TASK_OUT_OF_RANGE", `مقدار ${MeasuredValueNumber} کمتر از کمینهٔ مجاز ${item.MinValue} است`, { itemCode: item.ItemCode });
        }
        if (item.MaxValue != null && MeasuredValueNumber > item.MaxValue) {
          throw businessRule("CMMS_WO_TASK_OUT_OF_RANGE", `مقدار ${MeasuredValueNumber} بیشتر از بیشینهٔ مجاز ${item.MaxValue} است`, { itemCode: item.ItemCode });
        }
      }
    }
    const now = new Date().toISOString();
    const result = await r.patch("CmmsWorkOrderTask", taskId, {
      ResultStatus,
      MeasuredValueText: text(req.body.MeasuredValueText, "MeasuredValueText", { max: 240 }),
      MeasuredValueNumber,
      ActualMinutes: optionalNumber(req.body.ActualMinutes, "ActualMinutes", { min: 0 }),
      FindingFa,
      PerformedBy: requestActor(req),
      PerformedAt: now,
    }, requestActor(req), rowVersionFrom(req) ?? task.RowVersion);
    if (!result.ok) {
      throw result.code === "CONCURRENCY_CONFLICT"
        ? conflict("CMMS_CONCURRENCY_CONFLICT", "ردیف چک‌لیست پس از خواندن شما تغییر کرده است")
        : notFound();
    }
    await writeAudit(r, req, "CMMS_WO_TASK_RESULT", "CmmsWorkOrderTask", taskId, "cmms.wo.execute", { workOrderId, ResultStatus, FindingFa });
    return r.get("CmmsWorkOrderTask", taskId);
  }));

  app.post(`${ROOT}/work-orders/:workOrderId/labor`, route("cmms.labor.report", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["TechnicianId", "WorkDate", "StartTime", "EndTime", "RegularHours", "OvertimeHours", "LaborRate", "IsOvertime", "NoteFa"]));
    const workOrderId = id(req.params.workOrderId, "workOrderId");
    const workOrder = await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
    if (!["released", "in-progress", "completed"].includes(workOrder.Status)) {
      throw businessRule("CMMS_WO_STATE", `ثبت نفرساعت روی دستورکار «${workOrder.Status}» مجاز نیست`);
    }
    const technicianId = id(req.body.TechnicianId, "TechnicianId");
    const technician = await mustFind(r, "CmmsTechnician", technicianId, siteId);
    const RegularHours = number(req.body.RegularHours, "RegularHours", { required: true, min: 0, max: 24 });
    const OvertimeHours = optionalNumber(req.body.OvertimeHours, "OvertimeHours", { min: 0, max: 24 }) ?? 0;
    if (RegularHours + OvertimeHours === 0) throw bad("RegularHours", "مجموع ساعات نمی‌تواند صفر باشد");
    const WorkDate = isoDate(req.body.WorkDate, "WorkDate", { required: true });
    const LaborRate = optionalNumber(req.body.LaborRate, "LaborRate", { min: 0 }) ?? technician.StandardHourlyRate ?? 0;
    const row = await r.create("CmmsWorkOrderLabor", {
      SiteId: siteId, WorkOrderId: workOrderId, TechnicianId: technicianId, WorkDate,
      StartTime: text(req.body.StartTime, "StartTime", { max: 10 }) ?? "00:00",
      EndTime: text(req.body.EndTime, "EndTime", { max: 10 }) ?? "00:00",
      RegularHours, OvertimeHours, LaborRate,
      LaborCost: Math.round((RegularHours + OvertimeHours) * LaborRate * 100) / 100,
      IsOvertime: bool(req.body.IsOvertime, "IsOvertime", OvertimeHours > 0),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 600 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_LABOR_REPORTED", "CmmsWorkOrderLabor", row.Id, "cmms.labor.report", { workOrderId, RegularHours });
    return row;
  }, 201));

  app.post(`${ROOT}/work-orders/:workOrderId/materials`, route("cmms.spare.issue", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["SparePartId", "Quantity", "IssuedOn", "UnitCost", "LineType", "NoteFa"]));
    const workOrderId = id(req.params.workOrderId, "workOrderId");
    const workOrder = await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
    if (!["released", "in-progress", "completed"].includes(workOrder.Status)) {
      throw businessRule("CMMS_WO_STATE", `ثبت قطعه روی دستورکار «${workOrder.Status}» مجاز نیست`);
    }
    return r.transaction(async (tx) => {
      const partId = id(req.body.SparePartId, "SparePartId");
      const part = await mustFind(tx, "CmmsSparePart", partId, siteId);
      const Quantity = number(req.body.Quantity, "Quantity", { required: true, min: 0.0001 });
      const UnitCost = optionalNumber(req.body.UnitCost, "UnitCost", { min: 0 }) ?? part.UnitCost ?? 0;
      const material = await tx.create("CmmsWorkOrderMaterial", {
        SiteId: siteId, WorkOrderId: workOrderId, SparePartId: partId, Quantity,
        IssuedOn: isoDate(req.body.IssuedOn, "IssuedOn") ?? todayUtc(),
        UnitCost, TotalCost: Math.round(Quantity * UnitCost * 100) / 100,
        IssuedBy: requestActor(req),
        LineType: oneOf(req.body.LineType, "LineType", ["planned", "actual", "returned"], { fallback: "actual" }),
        NoteFa: text(req.body.NoteFa, "NoteFa", { max: 600 }),
      }, requestActor(req));
      /* کسری موجودی باید صریح رد شود: صدور قطعه‌ای که در انبار نیست، موجودی
       * منفی می‌سازد و بعد هیچ گزارش انباری به واقعیت نمی‌خواند. */
      const onHand = part.QtyOnHand ?? 0;
      if (material.LineType === "actual" && onHand < Quantity) {
        throw businessRule("CMMS_SPARE_SHORTAGE", `موجودی قطعه «${part.PartNumber}» (${onHand}) کمتر از مقدار درخواستی (${Quantity}) است`, {
          partId, onHand, requested: Quantity,
        });
      }
      await tx.patch("CmmsSparePart", partId, { QtyOnHand: onHand - (material.LineType === "returned" ? -Quantity : Quantity) }, requestActor(req), part.RowVersion);
      await tx.create("CmmsSpareTransaction", {
        SiteId: siteId, SparePartId: partId,
        TransactionType: material.LineType === "returned" ? "return" : "issue",
        OccurredAt: new Date().toISOString(), OccurredOn: material.IssuedOn,
        Quantity: material.LineType === "returned" ? Quantity : -Quantity,
        WorkOrderId: workOrderId, AssetId: workOrder.AssetId,
        TotalCost: material.TotalCost,
      }, requestActor(req));
      await createAuditRecord(tx, req, "CMMS_WO_MATERIAL_ISSUED", "CmmsWorkOrderMaterial", material.Id, "cmms.spare.issue", { workOrderId, partId, Quantity });
      return material;
    });
  }, 201));

  app.post(`${ROOT}/work-orders/:workOrderId/costs`, route("cmms.cost.post", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["CostElement", "Amount", "Currency", "PostedOn", "CostCenterRef", "VendorId", "NoteFa"]));
    const workOrderId = id(req.params.workOrderId, "workOrderId");
    await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
    const row = await r.create("CmmsWorkOrderCost", {
      SiteId: siteId, WorkOrderId: workOrderId,
      CostElement: oneOf(req.body.CostElement, "CostElement",
        ["labor", "material", "contract", "tool", "overhead", "downtime-loss"], { required: true }),
      Amount: optionalNumber(req.body.Amount, "Amount", { min: 0 }) ?? 0,
      Currency: text(req.body.Currency, "Currency", { max: 8 }) ?? "IRR",
      PostedOn: isoDate(req.body.PostedOn, "PostedOn") ?? todayUtc(),
      CostCenterRef: text(req.body.CostCenterRef, "CostCenterRef", { max: 60 }),
      VendorId: req.body.VendorId === undefined ? null : id(req.body.VendorId, "VendorId"),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 600 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_WO_COST_POSTED", "CmmsWorkOrderCost", row.Id, "cmms.cost.post", { workOrderId });
    return row;
  }, 201));

  app.get(`${ROOT}/work-orders/:workOrderId/costs`, route("cmms.cost.view", async ({ repo: r, req, siteId }) => {
    const workOrderId = id(req.params.workOrderId, "workOrderId");
    await mustFind(r, "CmmsWorkOrder", workOrderId, siteId);
    const rows = await childrenOf(r, "CmmsWorkOrderCost", siteId, "WorkOrderId", workOrderId);
    const byElement = rows.reduce((acc, row) => {
      acc[row.CostElement] = Math.round(((acc[row.CostElement] ?? 0) + (row.Amount ?? 0)) * 100) / 100;
      return acc;
    }, {});
    const currencies = [...new Set(rows.map((row) => row.Currency))];
    const total = currencies.length > 1
      ? null
      : Math.round(rows.reduce((sum, row) => sum + (row.Amount ?? 0), 0) * 100) / 100;
    return {
      costs: rows, byElement, total, currency: currencies.length === 1 ? currencies[0] : null,
      warnings: currencies.length > 1 ? ["چند ارز در سرفصل‌های هزینه وجود دارد؛ جمع کل محاسبه نشد."] : [],
    };
  }));

  /* ───────────────────────── ۵. خرابی، توقف، پایش وضعیت ───────────────────────── */

  app.get(`${ROOT}/failures`, route("cmms.reliability.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["assetId", "failureMode", "from", "to", "limit", "offset"]));
    const where = [];
    if (req.query.assetId !== undefined) where.push({ column: "AssetId", op: "eq", value: id(req.query.assetId, "assetId") });
    if (req.query.failureMode !== undefined) where.push({ column: "FailureMode", op: "eq", value: oneOf(req.query.failureMode, "failureMode", [...ISO14224_FAILURE_MODES], { required: true }) });
    if (req.query.from !== undefined) where.push({ column: "DetectedOn", op: "gte", value: isoDate(req.query.from, "from", { required: true }) });
    if (req.query.to !== undefined) where.push({ column: "DetectedOn", op: "lte", value: isoDate(req.query.to, "to", { required: true }) });
    const rows = await listInSite(r, "CmmsFailureRecord", siteId, {
      where, orderBy: [{ column: "DetectedAt", dir: "desc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 1_000_000),
    });
    return { failures: rows, total: rows.length };
  }));

  app.post(`${ROOT}/failures`, route("cmms.failure.report", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "AssetId", "FamilyFailureModeId", "FamilyNodeId", "FailureMode", "FailureMechanism",
      "FailureSubMechanism", "DetectedAt", "DetectedBy", "DetectionMethod", "RestoredAt",
      "DowntimeHours", "RepairHours", "RunningHoursBefore", "WorkOrderId", "Consequence", "DescriptionFa",
    ]));
    const assetId = id(req.body.AssetId, "AssetId");
    const asset = await mustFind(r, "CmmsAsset", assetId, siteId);
    const DetectedAt = isoDateTime(req.body.DetectedAt, "DetectedAt", { required: true });
    const RestoredAt = isoDateTime(req.body.RestoredAt, "RestoredAt");
    if (RestoredAt && RestoredAt < DetectedAt) throw bad("RestoredAt", "زمان بازگردانی پیش از زمان کشف خرابی است");
    const FailureMode = oneOf(req.body.FailureMode, "FailureMode", [...ISO14224_FAILURE_MODES], { required: true });
    const FailureMechanism = oneOf(req.body.FailureMechanism, "FailureMechanism", [...ISO14224_FAILURE_MECHANISMS], { required: true });
    const FamilyFailureModeId = req.body.FamilyFailureModeId === undefined ? null : id(req.body.FamilyFailureModeId, "FamilyFailureModeId");
    let FamilyNodeId = req.body.FamilyNodeId === undefined ? null : id(req.body.FamilyNodeId, "FamilyNodeId");
    if (FamilyFailureModeId) {
      const mode = await mustFind(r, "CmmsFamilyFailureMode", FamilyFailureModeId, siteId);
      if (!FamilyNodeId) FamilyNodeId = mode.FamilyNodeId ?? null;
    }
    const family = await r.get("CmmsFamily", asset.FamilyId);
    const group = family ? await r.get("CmmsFamilyGroup", family.FamilyGroupId) : null;
    const node = FamilyNodeId ? await r.get("CmmsFamilyNode", FamilyNodeId) : null;

    const row = await r.create("CmmsFailureRecord", {
      SiteId: siteId, AssetId: assetId, FamilyFailureModeId, FamilyNodeId,
      FailureMode, FailureMechanism,
      FailureSubMechanism: text(req.body.FailureSubMechanism, "FailureSubMechanism", { max: 120 }),
      Iso14224Code: classifyIso14224({
        equipmentClass: group?.EquipmentClass ?? null,
        subUnit: node?.PathCode ?? null,
        component: node?.NodeCode ?? null,
        failureMode: FailureMode, failureMechanism: FailureMechanism,
      }),
      DetectedAt, DetectedOn: DetectedAt.slice(0, 10),
      DetectedBy: text(req.body.DetectedBy, "DetectedBy", { max: 60 }) ?? requestActor(req),
      DetectionMethod: oneOf(req.body.DetectionMethod, "DetectionMethod", [...ISO14224_DETECTION_METHODS], { fallback: "breakdown-report" }),
      RestoredAt,
      DowntimeHours: optionalNumber(req.body.DowntimeHours, "DowntimeHours", { min: 0 }),
      RepairHours: optionalNumber(req.body.RepairHours, "RepairHours", { min: 0 }),
      RunningHoursBefore: optionalNumber(req.body.RunningHoursBefore, "RunningHoursBefore", { min: 0 }),
      WorkOrderId: req.body.WorkOrderId === undefined ? null : id(req.body.WorkOrderId, "WorkOrderId"),
      Consequence: oneOf(req.body.Consequence, "Consequence",
        ["safety-environmental", "operational", "non-operational", "hidden"], { fallback: "non-operational" }),
      DescriptionFa: text(req.body.DescriptionFa, "DescriptionFa", { max: 2000 }),
      ModelVersion: CMMS_MODEL_VERSION,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_FAILURE_REPORTED", "CmmsFailureRecord", row.Id, "cmms.failure.report", { assetId, FailureMode, Iso14224Code: row.Iso14224Code });
    return row;
  }, 201));

  app.post(`${ROOT}/downtime`, route("cmms.downtime.report", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "AssetId", "StartedAt", "EndedAt", "DowntimeType", "DurationHours", "CausedByMaintenance",
      "ProductionImpact", "CustomersAffected", "WorkOrderId", "FailureRecordId", "ReasonFa",
    ]));
    const assetId = id(req.body.AssetId, "AssetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const StartedAt = isoDateTime(req.body.StartedAt, "StartedAt", { required: true });
    const EndedAt = isoDateTime(req.body.EndedAt, "EndedAt");
    if (EndedAt && EndedAt < StartedAt) throw bad("EndedAt", "پایان توقف پیش از شروع آن است");
    const computedDuration = EndedAt ? (new Date(EndedAt).getTime() - new Date(StartedAt).getTime()) / 3600_000 : null;
    const declared = optionalNumber(req.body.DurationHours, "DurationHours", { min: 0 });
    /* اگر هم زمان پایان داده شده هم مدت اعلامی، و این دو نمی‌خوانند، داده
     * مشکل دارد. بی‌صدا یکی را انتخاب نکن — گزارش بده. */
    if (declared != null && computedDuration != null && Math.abs(declared - computedDuration) > 0.01) {
      throw businessRule("CMMS_DOWNTIME_MISMATCH", `مدت اعلامی (${declared}) با اختلاف زمان شروع و پایان (${Math.round(computedDuration * 1000) / 1000}) نمی‌خواند`, {
        declared, computed: Math.round(computedDuration * 1000) / 1000,
      });
    }
    const row = await r.create("CmmsDowntimeRecord", {
      SiteId: siteId, AssetId: assetId, StartedAt, EndedAt,
      DowntimeType: oneOf(req.body.DowntimeType, "DowntimeType",
        ["planned", "unplanned", "standby", "waiting-for-parts", "waiting-for-crew", "no-demand"], { required: true }),
      DurationHours: declared ?? computedDuration,
      CausedByMaintenance: bool(req.body.CausedByMaintenance, "CausedByMaintenance", true),
      ProductionImpact: oneOf(req.body.ProductionImpact, "ProductionImpact", ["none", "partial", "line-stop", "plant-stop"], { fallback: "none" }),
      CustomersAffected: optionalNumber(req.body.CustomersAffected, "CustomersAffected", { integer: true, min: 0 }),
      WorkOrderId: req.body.WorkOrderId === undefined ? null : id(req.body.WorkOrderId, "WorkOrderId"),
      FailureRecordId: req.body.FailureRecordId === undefined ? null : id(req.body.FailureRecordId, "FailureRecordId"),
      ReasonFa: text(req.body.ReasonFa, "ReasonFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_DOWNTIME_REPORTED", "CmmsDowntimeRecord", row.Id, "cmms.downtime.report", { assetId });
    return row;
  }, 201));

  app.post(`${ROOT}/condition-thresholds`, route("cmms.condition.threshold", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["FamilyConditionParamId", "AssetId", "MachineClass", "RigidSupport", "ZoneAUpper", "ZoneBUpper", "ZoneCUpper", "ZoneDefinitionRef", "IsActive"]));
    const FamilyConditionParamId = id(req.body.FamilyConditionParamId, "FamilyConditionParamId");
    await mustFind(r, "CmmsFamilyConditionParam", FamilyConditionParamId, siteId);
    const AssetId = req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId");
    if (AssetId) await mustFind(r, "CmmsAsset", AssetId, siteId);
    const ZoneAUpper = optionalNumber(req.body.ZoneAUpper, "ZoneAUpper", { min: 0 });
    const ZoneBUpper = optionalNumber(req.body.ZoneBUpper, "ZoneBUpper", { min: 0 });
    const ZoneCUpper = optionalNumber(req.body.ZoneCUpper, "ZoneCUpper", { min: 0 });
    if (ZoneBUpper != null && ZoneAUpper != null && ZoneBUpper <= ZoneAUpper) throw bad("ZoneBUpper", "سقف منطقهٔ B باید بزرگ‌تر از A باشد");
    if (ZoneCUpper != null && ZoneBUpper != null && ZoneCUpper <= ZoneBUpper) throw bad("ZoneCUpper", "سقف منطقهٔ C باید بزرگ‌تر از B باشد");
    const row = await r.create("CmmsConditionThreshold", {
      SiteId: siteId, FamilyConditionParamId, AssetId,
      MachineClass: oneOf(req.body.MachineClass, "MachineClass", ["group1", "group2", "group3", "group4"], { fallback: "group2" }),
      RigidSupport: bool(req.body.RigidSupport, "RigidSupport", true),
      ZoneAUpper, ZoneBUpper, ZoneCUpper,
      ZoneDefinitionRef: text(req.body.ZoneDefinitionRef, "ZoneDefinitionRef", { max: 200 }),
      IsActive: bool(req.body.IsActive, "IsActive", true),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_CONDITION_THRESHOLD_SET", "CmmsConditionThreshold", row.Id, "cmms.condition.threshold");
    return row;
  }, 201));

  app.post(`${ROOT}/condition-readings`, route("cmms.condition.record", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "AssetId", "FamilyConditionParamId", "MeasuredAt", "Value", "Source", "AnalystId",
      "WorkOrderId", "TrendDirection", "RateOfChange", "NoteFa",
    ]));
    const assetId = id(req.body.AssetId, "AssetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const paramId = id(req.body.FamilyConditionParamId, "FamilyConditionParamId");
    const param = await mustFind(r, "CmmsFamilyConditionParam", paramId, siteId);
    const MeasuredAt = isoDateTime(req.body.MeasuredAt, "MeasuredAt", { required: true });
    const Value = number(req.body.Value, "Value", { required: true });

    /* منطقه‌بندی: برای ارتعاش از جدول ISO 10816 (اگر آستانه تعریف شده باشد)
     * و در بقیهٔ موارد از آستانه‌های خود پارامتر. */
    const threshold = await r.findOne("CmmsConditionThreshold", [
      { column: "FamilyConditionParamId", op: "eq", value: paramId }, { column: "AssetId", op: "eq", value: assetId },
    ]) ?? await r.findOne("CmmsConditionThreshold", [
      { column: "FamilyConditionParamId", op: "eq", value: paramId }, { column: "AssetId", op: "eq", value: null },
    ]);

    let zone = null;
    let severity = "normal";
    let actionFa = null;
    let iso10816 = null;
    if (param.Technique === "vibration" && threshold) {
      iso10816 = vibrationZoneIso10816(Value, threshold.MachineClass ?? "group2", threshold.RigidSupport !== false);
      zone = iso10816.zone;
      severity = zone === "A" ? "normal" : zone === "B" ? "alert" : zone === "C" ? "alarm" : "trip";
    } else {
      const evaluated = evaluateCondition({
        value: Value,
        alertLimit: param.AlertLimit ?? null,
        alarmLimit: param.AlarmLimit ?? null,
        tripLimit: param.TripLimit ?? null,
        baseline: param.BaselineValue ?? null,
        trendDirection: req.body.TrendDirection ?? null,
      });
      zone = evaluated.zone;
      severity = evaluated.severity;
      actionFa = evaluated.actionFa;
    }

    const row = await r.create("CmmsConditionReading", {
      SiteId: siteId, AssetId: assetId, FamilyConditionParamId: paramId,
      MeasuredAt, MeasuredOn: MeasuredAt.slice(0, 10), Value,
      Uom: param.Uom ?? text(req.body.Uom, "Uom", { max: 24 }) ?? "",
      Zone: zone,
      Source: oneOf(req.body.Source, "Source", ["manual", "iiot", "scada", "portable", "lab"], { fallback: "manual" }),
      AnalystId: text(req.body.AnalystId, "AnalystId", { max: 60 }),
      WorkOrderId: req.body.WorkOrderId === undefined ? null : id(req.body.WorkOrderId, "WorkOrderId"),
      TrendDirection: oneOf(req.body.TrendDirection, "TrendDirection", ["rising", "falling", "stable"]),
      RateOfChange: optionalNumber(req.body.RateOfChange, "RateOfChange"),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));

    /* آلارم خودکار برای منطقهٔ C و D. این همان چیزی است که پایش وضعیت را از
     * «ثبت داده» به «اقدام» تبدیل می‌کند. */
    let alert = null;
    if (severity === "alarm" || severity === "trip") {
      alert = await r.create("CmmsAlert", {
        SiteId: siteId,
        AlertCode: `CBM-${assetId.slice(-8)}-${paramId.slice(-8)}`,
        Severity: severity === "trip" ? "critical" : "high",
        Category: "condition",
        TitleFa: `هشدار پایش وضعیت: ${param.NameFa} در منطقهٔ ${zone}`,
        MessageFa: actionFa ?? `مقدار ${Value} ${param.Uom ?? ""} از آستانهٔ منطقهٔ ${zone} گذشته است.`,
        AssetId: assetId, ConditionReadingId: row.Id,
        Status: "open", RaisedAt: MeasuredAt,
        NotifyInApp: true, NotifyEmail: severity === "trip", NotifySms: severity === "trip",
      }, requestActor(req));
      await writeAudit(r, req, "CMMS_CONDITION_ALERT_RAISED", "CmmsAlert", alert.Id, "cmms.condition.record", { assetId, zone });
    }
    await writeAudit(r, req, "CMMS_CONDITION_READING_POSTED", "CmmsConditionReading", row.Id, "cmms.condition.record", { assetId, zone, severity });
    return { reading: row, zone, severity, actionFa, iso10816, alert };
  }, 201));

  /* ───────────────────────── ۶. منابع ───────────────────────── */

  app.get(`${ROOT}/spare-parts`, route("cmms.spare.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["category", "isCriticalSpare", "q", "lowStockOnly", "limit", "offset"]));
    const where = [];
    if (req.query.category !== undefined) {
      where.push({ column: "Category", op: "eq", value: oneOf(req.query.category, "category", ["mechanical", "electrical", "instrument", "consumable", "lubricant", "seal", "bearing", "filter"], { required: true }) });
    }
    if (req.query.isCriticalSpare !== undefined) where.push({ column: "IsCriticalSpare", op: "eq", value: bool(req.query.isCriticalSpare, "isCriticalSpare") });
    if (req.query.q !== undefined) where.push({ column: "PartNumber", op: "like", value: `%${text(req.query.q, "q", { max: 60 })}%` });
    const rows = await listInSite(r, "CmmsSparePart", siteId, {
      where, orderBy: [{ column: "PartNumber", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 200, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 1_000_000),
    });
    const enrich = rows.map((part) => {
      const onHand = part.QtyOnHand ?? 0;
      const reorderPoint = part.ReorderPoint ?? part.MinStock ?? 0;
      return { ...part, isBelowReorderPoint: onHand <= reorderPoint, isOutOfStock: onHand <= 0 };
    });
    const filtered = req.query.lowStockOnly === undefined ? enrich : enrich.filter((part) => part.isBelowReorderPoint);
    return {
      spareParts: filtered, total: filtered.length,
      summary: {
        outOfStock: filtered.filter((part) => part.isOutOfStock).length,
        belowReorderPoint: filtered.filter((part) => part.isBelowReorderPoint).length,
        critical: filtered.filter((part) => part.IsCriticalSpare).length,
      },
    };
  }));

  app.post(`${ROOT}/spare-parts`, route("cmms.spare.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "PartNumber", "NameFa", "NameEn", "Category", "Uom", "Manufacturer", "OemPartNumber",
      "VendorId", "ScmWarehouseId", "UnitCost", "Currency", "QtyOnHand", "MinStock", "MaxStock",
      "ReorderPoint", "SafetyStock", "LeadTimeDays", "IsCriticalSpare", "IsConsumable",
      "ShelfLifeMonths", "IsActive", "NoteFa",
    ]));
    const PartNumber = code(req.body.PartNumber, "PartNumber");
    if (await r.findOne("CmmsSparePart", [{ column: "SiteId", op: "eq", value: siteId }, { column: "PartNumber", op: "eq", value: PartNumber }])) {
      throw conflict("CMMS_DUPLICATE", `شمارهٔ قطعه «${PartNumber}» تکراری است`);
    }
    const row = await r.create("CmmsSparePart", {
      SiteId: siteId, PartNumber,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      Category: oneOf(req.body.Category, "Category",
        ["mechanical", "electrical", "instrument", "consumable", "lubricant", "seal", "bearing", "filter"], { required: true }),
      Uom: text(req.body.Uom, "Uom", { required: true, max: 24 }),
      Manufacturer: text(req.body.Manufacturer, "Manufacturer", { max: 240 }),
      OemPartNumber: text(req.body.OemPartNumber, "OemPartNumber", { max: 120 }),
      VendorId: req.body.VendorId === undefined ? null : id(req.body.VendorId, "VendorId"),
      ScmWarehouseId: text(req.body.ScmWarehouseId, "ScmWarehouseId", { max: 60 }),
      UnitCost: optionalNumber(req.body.UnitCost, "UnitCost", { min: 0 }),
      Currency: text(req.body.Currency, "Currency", { max: 8 }) ?? "IRR",
      QtyOnHand: optionalNumber(req.body.QtyOnHand, "QtyOnHand", { min: 0 }) ?? 0,
      MinStock: optionalNumber(req.body.MinStock, "MinStock", { min: 0 }),
      MaxStock: optionalNumber(req.body.MaxStock, "MaxStock", { min: 0 }),
      ReorderPoint: optionalNumber(req.body.ReorderPoint, "ReorderPoint", { min: 0 }),
      SafetyStock: optionalNumber(req.body.SafetyStock, "SafetyStock", { min: 0 }),
      LeadTimeDays: optionalNumber(req.body.LeadTimeDays, "LeadTimeDays", { min: 0 }),
      IsCriticalSpare: bool(req.body.IsCriticalSpare, "IsCriticalSpare", false),
      IsConsumable: bool(req.body.IsConsumable, "IsConsumable", false),
      ShelfLifeMonths: number(req.body.ShelfLifeMonths, "ShelfLifeMonths", { integer: true, min: 0 }) ?? 0,
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_SPARE_PART_CREATED", "CmmsSparePart", row.Id, "cmms.spare.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/spare-parts/:partId`, route("cmms.spare.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["NameFa", "UnitCost", "MinStock", "MaxStock", "ReorderPoint", "SafetyStock", "LeadTimeDays", "IsCriticalSpare", "IsConsumable", "IsActive", "NoteFa", "RowVersion"]));
    const partId = id(req.params.partId, "partId");
    const existing = await mustFind(r, "CmmsSparePart", partId, siteId);
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.UnitCost !== undefined) patch.UnitCost = optionalNumber(req.body.UnitCost, "UnitCost", { min: 0 });
    if (req.body.MinStock !== undefined) patch.MinStock = optionalNumber(req.body.MinStock, "MinStock", { min: 0 });
    if (req.body.MaxStock !== undefined) patch.MaxStock = optionalNumber(req.body.MaxStock, "MaxStock", { min: 0 });
    if (req.body.ReorderPoint !== undefined) patch.ReorderPoint = optionalNumber(req.body.ReorderPoint, "ReorderPoint", { min: 0 });
    if (req.body.SafetyStock !== undefined) patch.SafetyStock = optionalNumber(req.body.SafetyStock, "SafetyStock", { min: 0 });
    if (req.body.LeadTimeDays !== undefined) patch.LeadTimeDays = optionalNumber(req.body.LeadTimeDays, "LeadTimeDays", { min: 0 });
    if (req.body.IsCriticalSpare !== undefined) patch.IsCriticalSpare = bool(req.body.IsCriticalSpare, "IsCriticalSpare");
    if (req.body.IsConsumable !== undefined) patch.IsConsumable = bool(req.body.IsConsumable, "IsConsumable");
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    const result = await r.patch("CmmsSparePart", partId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("CMMS_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "CMMS_SPARE_PART_UPDATED", "CmmsSparePart", partId, "cmms.spare.edit");
    return r.get("CmmsSparePart", partId);
  }));

  app.post(`${ROOT}/spare-parts/:partId/transactions`, route("cmms.spare.receive", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["TransactionType", "Quantity", "OccurredAt", "WorkOrderId", "AssetId", "TechnicianId", "ReferenceNo", "NoteFa"]));
    const partId = id(req.params.partId, "partId");
    return r.transaction(async (tx) => {
      const part = await mustFind(tx, "CmmsSparePart", partId, siteId);
      const TransactionType = oneOf(req.body.TransactionType, "TransactionType",
        ["receipt", "issue", "return", "reserve", "unreserve", "adjust", "scrap"], { required: true });
      const Quantity = number(req.body.Quantity, "Quantity", { required: true });
      if (Quantity === 0) throw bad("Quantity", "مقدار تراکنش نمی‌تواند صفر باشد");
      /* اثر هر نوع تراکنش بر موجودی صریح و در یک جدول است، نه پراکنده در
       * چند if — چون اشتباه در علامت، موجودی انبار را برای همیشه خراب می‌کند. */
      const effect = { receipt: 1, return: 1, issue: -1, scrap: -1, adjust: 1, reserve: 0, unreserve: 0 }[TransactionType];
      const onHand = part.QtyOnHand ?? 0;
      const next = onHand + effect * Math.abs(Quantity) * (TransactionType === "adjust" ? Math.sign(Quantity) || 1 : 1);
      if (next < 0) {
        throw businessRule("CMMS_SPARE_SHORTAGE", `موجودی پس از این تراکنش منفی می‌شود (موجودی ${onHand})`, { onHand, effect, Quantity });
      }
      const transaction = await tx.create("CmmsSpareTransaction", {
        SiteId: siteId, SparePartId: partId, TransactionType,
        OccurredAt: isoDateTime(req.body.OccurredAt, "OccurredAt") ?? new Date().toISOString(),
        OccurredOn: todayUtc(),
        Quantity: effect * Math.abs(Quantity),
        WorkOrderId: req.body.WorkOrderId === undefined ? null : id(req.body.WorkOrderId, "WorkOrderId"),
        AssetId: req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId"),
        TechnicianId: req.body.TechnicianId === undefined ? null : id(req.body.TechnicianId, "TechnicianId"),
        TotalCost: TransactionType === "receipt" ? Math.round(Math.abs(Quantity) * (part.UnitCost ?? 0) * 100) / 100 : null,
        ReferenceNo: text(req.body.ReferenceNo, "ReferenceNo", { max: 120 }),
        NoteFa: text(req.body.NoteFa, "NoteFa", { max: 600 }),
      }, requestActor(req));
      await tx.patch("CmmsSparePart", partId, { QtyOnHand: Math.round(next * 10000) / 10000 }, requestActor(req), part.RowVersion);
      await createAuditRecord(tx, req, `CMMS_SPARE_${TransactionType.toUpperCase()}`, "CmmsSpareTransaction", transaction.Id, "cmms.spare.receive", { partId, Quantity, next });
      return { transaction, qtyOnHand: Math.round(next * 10000) / 10000 };
    });
  }, 201));

  app.get(`${ROOT}/technicians`, route("cmms.technician.view", async ({ repo: r, req, siteId }) => {
    const rows = await listInSite(r, "CmmsTechnician", siteId, { orderBy: [{ column: "TechnicianCode", dir: "asc" }] });
    const withSkills = await Promise.all(rows.map(async (technician) => ({
      ...technician,
      skills: await childrenOf(r, "CmmsTechnicianSkill", siteId, "TechnicianId", technician.Id),
    })));
    return { technicians: withSkills, total: withSkills.length };
  }));

  app.post(`${ROOT}/technicians`, route("cmms.technician.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "TechnicianCode", "FullNameFa", "FullNameEn", "NationalCode", "PrimaryTrade", "Grade",
      "CrewId", "StandardHourlyRate", "Currency", "CapacityHoursPerWeek", "EmploymentType",
      "VendorId", "UserId", "IsActive", "NoteFa",
    ]));
    const TechnicianCode = code(req.body.TechnicianCode, "TechnicianCode");
    if (await r.findOne("CmmsTechnician", [{ column: "SiteId", op: "eq", value: siteId }, { column: "TechnicianCode", op: "eq", value: TechnicianCode }])) {
      throw conflict("CMMS_DUPLICATE", `کد تکنسین «${TechnicianCode}» تکراری است`);
    }
    const row = await r.create("CmmsTechnician", {
      SiteId: siteId, TechnicianCode,
      FullNameFa: text(req.body.FullNameFa, "FullNameFa", { required: true, max: 240 }),
      FullNameEn: text(req.body.FullNameEn, "FullNameEn", { max: 240 }),
      NationalCode: text(req.body.NationalCode, "NationalCode", { max: 40 }),
      PrimaryTrade: text(req.body.PrimaryTrade, "PrimaryTrade", { required: true, max: 60 }),
      Grade: oneOf(req.body.Grade, "Grade", ["apprentice", "junior", "senior", "expert", "master"], { fallback: "junior" }),
      CrewId: req.body.CrewId === undefined ? null : id(req.body.CrewId, "CrewId"),
      StandardHourlyRate: optionalNumber(req.body.StandardHourlyRate, "StandardHourlyRate", { min: 0 }),
      Currency: text(req.body.Currency, "Currency", { max: 8 }) ?? "IRR",
      CapacityHoursPerWeek: optionalNumber(req.body.CapacityHoursPerWeek, "CapacityHoursPerWeek", { min: 0.01, max: 168 }) ?? 40,
      EmploymentType: oneOf(req.body.EmploymentType, "EmploymentType", ["direct", "contractor", "oem"], { fallback: "direct" }),
      VendorId: req.body.VendorId === undefined ? null : id(req.body.VendorId, "VendorId"),
      UserId: text(req.body.UserId, "UserId", { max: 60 }),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_TECHNICIAN_CREATED", "CmmsTechnician", row.Id, "cmms.technician.edit");
    return row;
  }, 201));

  app.post(`${ROOT}/technicians/:technicianId/skills`, route("cmms.technician.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["SkillKey", "SkillLevel", "CertifiedBy", "CertifiedOn", "ExpiresOn", "IsActive"]));
    const technicianId = id(req.params.technicianId, "technicianId");
    await mustFind(r, "CmmsTechnician", technicianId, siteId);
    const SkillKey = text(req.body.SkillKey, "SkillKey", { required: true, max: 80 });
    if (await r.findOne("CmmsTechnicianSkill", [
      { column: "TechnicianId", op: "eq", value: technicianId }, { column: "SkillKey", op: "eq", value: SkillKey },
    ])) throw conflict("CMMS_DUPLICATE", `مهارت «${SkillKey}» پیش‌تر برای این تکنسین ثبت شده است`);
    const row = await r.create("CmmsTechnicianSkill", {
      SiteId: siteId, TechnicianId: technicianId, SkillKey,
      SkillLevel: number(req.body.SkillLevel, "SkillLevel", { integer: true, min: 1, max: 5 }) ?? 1,
      CertifiedBy: text(req.body.CertifiedBy, "CertifiedBy", { max: 240 }),
      CertifiedOn: isoDate(req.body.CertifiedOn, "CertifiedOn"),
      ExpiresOn: isoDate(req.body.ExpiresOn, "ExpiresOn"),
      IsActive: bool(req.body.IsActive, "IsActive", true),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_TECHNICIAN_SKILL_ADDED", "CmmsTechnicianSkill", row.Id, "cmms.technician.edit", { technicianId });
    return row;
  }, 201));

  app.get(`${ROOT}/crews`, route("cmms.crew.view", async ({ repo: r, req, siteId }) => {
    const rows = await listInSite(r, "CmmsCrew", siteId, { orderBy: [{ column: "CrewCode", dir: "asc" }] });
    return { crews: rows, total: rows.length };
  }));

  app.post(`${ROOT}/crews`, route("cmms.crew.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["CrewCode", "NameFa", "ShiftPattern", "DailyCapacityHours", "SupervisorTechnicianId", "IsActive", "NoteFa"]));
    const CrewCode = code(req.body.CrewCode, "CrewCode");
    if (await r.findOne("CmmsCrew", [{ column: "SiteId", op: "eq", value: siteId }, { column: "CrewCode", op: "eq", value: CrewCode }])) {
      throw conflict("CMMS_DUPLICATE", `کد گروه کاری «${CrewCode}» تکراری است`);
    }
    const row = await r.create("CmmsCrew", {
      SiteId: siteId, CrewCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      ShiftPattern: text(req.body.ShiftPattern, "ShiftPattern", { required: true, max: 60 }),
      DailyCapacityHours: optionalNumber(req.body.DailyCapacityHours, "DailyCapacityHours", { min: 0.01, max: 24 }) ?? 8,
      SupervisorTechnicianId: req.body.SupervisorTechnicianId === undefined ? null : id(req.body.SupervisorTechnicianId, "SupervisorTechnicianId"),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_CREW_CREATED", "CmmsCrew", row.Id, "cmms.crew.edit");
    return row;
  }, 201));

  app.get(`${ROOT}/vendors`, route("cmms.vendor.view", async ({ repo: r, req, siteId }) => {
    const rows = await listInSite(r, "CmmsVendor", siteId, { orderBy: [{ column: "VendorCode", dir: "asc" }] });
    return { vendors: rows, total: rows.length };
  }));

  app.post(`${ROOT}/vendors`, route("cmms.vendor.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "VendorCode", "NameFa", "NameEn", "VendorType", "ContactName", "ContactPhone", "ContactEmail",
      "NationalId", "Currency", "IsApproved", "ApprovedOn", "QualificationExpiresOn", "RatingScore", "IsActive", "NoteFa",
    ]));
    const VendorCode = code(req.body.VendorCode, "VendorCode");
    if (await r.findOne("CmmsVendor", [{ column: "SiteId", op: "eq", value: siteId }, { column: "VendorCode", op: "eq", value: VendorCode }])) {
      throw conflict("CMMS_DUPLICATE", `کد تأمین‌کننده «${VendorCode}» تکراری است`);
    }
    const row = await r.create("CmmsVendor", {
      SiteId: siteId, VendorCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      VendorType: oneOf(req.body.VendorType, "VendorType", ["oem", "supplier", "contractor", "service", "calibration-lab"], { required: true }),
      ContactName: text(req.body.ContactName, "ContactName", { max: 160 }),
      ContactPhone: text(req.body.ContactPhone, "ContactPhone", { max: 60 }),
      ContactEmail: text(req.body.ContactEmail, "ContactEmail", { max: 200 }),
      NationalId: text(req.body.NationalId, "NationalId", { max: 40 }),
      Currency: text(req.body.Currency, "Currency", { max: 8 }) ?? "IRR",
      IsApproved: bool(req.body.IsApproved, "IsApproved", false),
      ApprovedOn: isoDate(req.body.ApprovedOn, "ApprovedOn"),
      QualificationExpiresOn: isoDate(req.body.QualificationExpiresOn, "QualificationExpiresOn"),
      RatingScore: optionalNumber(req.body.RatingScore, "RatingScore", { min: 0, max: 100 }),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_VENDOR_CREATED", "CmmsVendor", row.Id, "cmms.vendor.edit");
    return row;
  }, 201));

  /* ───────────────────────── ۷. برنامه‌ریزی نت ───────────────────────── */

  app.get(`${ROOT}/pm-schedules`, route("cmms.pm.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["assetId", "familyId", "triggerType", "isActive", "limit", "offset"]));
    const where = [];
    if (req.query.assetId !== undefined) where.push({ column: "AssetId", op: "eq", value: id(req.query.assetId, "assetId") });
    if (req.query.familyId !== undefined) where.push({ column: "FamilyId", op: "eq", value: id(req.query.familyId, "familyId") });
    if (req.query.triggerType !== undefined) where.push({ column: "TriggerType", op: "eq", value: oneOf(req.query.triggerType, "triggerType", ["time", "meter", "condition", "combined"], { required: true }) });
    if (req.query.isActive !== undefined) where.push({ column: "IsActive", op: "eq", value: bool(req.query.isActive, "isActive") });
    const rows = await listInSite(r, "CmmsPmSchedule", siteId, {
      where, orderBy: [{ column: "NextDueAt", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 200, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 1_000_000),
    });
    return { schedules: rows, total: rows.length };
  }));

  app.post(`${ROOT}/pm-schedules`, route("cmms.pm.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "AssetId", "ScheduleCode", "FamilyPmTaskId", "StrategyId", "TriggerType", "IntervalValue",
      "IntervalUnit", "MeterDefinitionId", "LastDoneAt", "LastMeterValue", "NextDueAt",
      "NextDueMeterValue", "Priority", "LeadTimeDays", "IsActive",
    ]));
    const assetId = id(req.body.AssetId, "AssetId");
    const asset = await mustFind(r, "CmmsAsset", assetId, siteId);
    const ScheduleCode = code(req.body.ScheduleCode, "ScheduleCode");
    if (await r.findOne("CmmsPmSchedule", [
      { column: "AssetId", op: "eq", value: assetId }, { column: "ScheduleCode", op: "eq", value: ScheduleCode },
    ])) throw conflict("CMMS_DUPLICATE", `کد برنامهٔ PM «${ScheduleCode}» برای این تجهیز تکراری است`);
    const TriggerType = oneOf(req.body.TriggerType, "TriggerType", ["time", "meter", "condition", "combined"], { required: true });
    const IntervalValue = optionalNumber(req.body.IntervalValue, "IntervalValue", { min: 0.0001 });
    const MeterDefinitionId = req.body.MeterDefinitionId === undefined ? null : id(req.body.MeterDefinitionId, "MeterDefinitionId");
    if ((TriggerType === "meter" || TriggerType === "combined") && !MeterDefinitionId) {
      throw bad("MeterDefinitionId", "برنامهٔ کارکردمحور باید به یک کنتور وصل باشد");
    }
    if (TriggerType === "meter" && IntervalValue == null) throw bad("IntervalValue", "برنامهٔ کارکردمحور باید تناوب داشته باشد");
    if (TriggerType === "time" && IntervalValue == null) throw bad("IntervalValue", "برنامهٔ زمان‌محور باید تناوب داشته باشد");

    const row = await r.create("CmmsPmSchedule", {
      SiteId: siteId, FamilyId: asset.FamilyId, AssetId: assetId, ScheduleCode,
      FamilyPmTaskId: req.body.FamilyPmTaskId === undefined ? null : id(req.body.FamilyPmTaskId, "FamilyPmTaskId"),
      StrategyId: req.body.StrategyId === undefined ? null : id(req.body.StrategyId, "StrategyId"),
      TriggerType, IntervalValue,
      IntervalUnit: oneOf(req.body.IntervalUnit, "IntervalUnit", ["hours", "days", "weeks", "months", "cycles", "km"]),
      MeterDefinitionId,
      LastDoneAt: isoDateTime(req.body.LastDoneAt, "LastDoneAt"),
      LastMeterValue: optionalNumber(req.body.LastMeterValue, "LastMeterValue", { min: 0 }),
      NextDueAt: isoDateTime(req.body.NextDueAt, "NextDueAt"),
      NextDueMeterValue: optionalNumber(req.body.NextDueMeterValue, "NextDueMeterValue", { min: 0 }),
      Priority: number(req.body.Priority, "Priority", { integer: true, min: 1, max: 5 }) ?? 3,
      LeadTimeDays: number(req.body.LeadTimeDays, "LeadTimeDays", { integer: true, min: 0 }) ?? 7,
      IsActive: bool(req.body.IsActive, "IsActive", true),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_PM_SCHEDULE_CREATED", "CmmsPmSchedule", row.Id, "cmms.pm.edit", { assetId, TriggerType });
    return row;
  }, 201));

  app.get(`${ROOT}/pm-schedules/due`, route("cmms.pm.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["asOf", "horizonDays", "limit"]));
    const asOf = isoDate(req.query.asOf, "asOf") ?? todayUtc();
    const horizonDays = number(req.query.horizonDays, "horizonDays", { integer: true, min: 1, max: 365 }) ?? 30;
    const horizonEnd = new Date(new Date(`${asOf}T00:00:00Z`).getTime() + horizonDays * 86_400_000).toISOString();
    const rows = await listInSite(r, "CmmsPmSchedule", siteId, {
      where: [{ column: "IsActive", op: "eq", value: true }],
      orderBy: [{ column: "NextDueAt", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 500, 2000),
    });
    const classified = rows
      .filter((schedule) => schedule.NextDueAt)
      .map((schedule) => ({
        ...schedule,
        isOverdue: schedule.NextDueAt < `${asOf}T00:00:00.000Z`,
        isDueInHorizon: schedule.NextDueAt >= `${asOf}T00:00:00.000Z` && schedule.NextDueAt <= horizonEnd,
      }))
      .filter((schedule) => schedule.isOverdue || schedule.isDueInHorizon);
    return {
      schedules: classified,
      total: classified.length,
      summary: {
        overdue: classified.filter((schedule) => schedule.isOverdue).length,
        dueInHorizon: classified.filter((schedule) => schedule.isDueInHorizon).length,
        horizonDays, asOf,
      },
    };
  }));

  /* ───────────────────────── ۸. تحلیل و استانداردها ───────────────────────── */

  app.post(`${ROOT}/fmea`, route("cmms.fmea.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["FamilyId", "AssetId", "AnalysisCode", "AnalysisType", "Methodology", "TeamLeadId", "AnalyzedOn", "MaxRpnThreshold", "NoteFa"]));
    const AnalysisCode = code(req.body.AnalysisCode, "AnalysisCode");
    const FamilyId = req.body.FamilyId === undefined ? null : id(req.body.FamilyId, "FamilyId");
    const AssetId = req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId");
    if (!FamilyId && !AssetId) throw bad("FamilyId", "تحلیل FMEA باید به یک خانواده یا یک تجهیز مربوط باشد");
    if (FamilyId) await mustFind(r, "CmmsFamily", FamilyId, siteId);
    if (AssetId) await mustFind(r, "CmmsAsset", AssetId, siteId);
    if (await r.findOne("CmmsFmeaRecord", [{ column: "SiteId", op: "eq", value: siteId }, { column: "AnalysisCode", op: "eq", value: AnalysisCode }])) {
      throw conflict("CMMS_DUPLICATE", `کد تحلیل «${AnalysisCode}» تکراری است`);
    }
    const row = await r.create("CmmsFmeaRecord", {
      SiteId: siteId, FamilyId, AssetId, AnalysisCode,
      AnalysisType: oneOf(req.body.AnalysisType, "AnalysisType", ["fmea", "fmeca"], { fallback: "fmea" }),
      Methodology: text(req.body.Methodology, "Methodology", { max: 40 }) ?? "IEC 60812",
      Status: "draft",
      TeamLeadId: text(req.body.TeamLeadId, "TeamLeadId", { max: 60 }),
      AnalyzedOn: isoDate(req.body.AnalyzedOn, "AnalyzedOn") ?? todayUtc(),
      MaxRpnThreshold: optionalNumber(req.body.MaxRpnThreshold, "MaxRpnThreshold", { min: 1 }),
      TotalRpn: 0,
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_FMEA_CREATED", "CmmsFmeaRecord", row.Id, "cmms.fmea.edit");
    return row;
  }, 201));

  app.post(`${ROOT}/fmea/:fmeaId/entries`, route("cmms.fmea.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "FamilyFailureModeId", "FamilyNodeId", "FunctionFa", "FailureModeText", "EffectFa", "CauseFa",
      "CurrentControlFa", "Severity", "Occurrence", "Detection", "FailureRatePerHour", "BetaFactor",
      "MissionTimeHours", "RecommendedActionFa", "ActionOwnerId", "ActionDueOn", "SortOrder",
    ]));
    const fmeaId = id(req.params.fmeaId, "fmeaId");
    return r.transaction(async (tx) => {
      const fmea = await mustFind(tx, "CmmsFmeaRecord", fmeaId, siteId);
      if (fmea.Status === "approved") throw businessRule("CMMS_FMEA_LOCKED", "تحلیل تصویب‌شده قابل افزودن ردیف نیست");
      const Severity = number(req.body.Severity, "Severity", { required: true, integer: true, min: 1, max: 10 });
      const Occurrence = number(req.body.Occurrence, "Occurrence", { required: true, integer: true, min: 1, max: 10 });
      const Detection = number(req.body.Detection, "Detection", { required: true, integer: true, min: 1, max: 10 });
      /* RPN در لایهٔ دامنه محاسبه می‌شود، نه اینجا — تا فرانت‌اند و بک‌اند
       * هرگز عدد متفاوتی تولید نکنند. */
      const rpn = computeRiskPriorityNumber({ severity: Severity, occurrence: Occurrence, detection: Detection });

      const FailureRatePerHour = optionalNumber(req.body.FailureRatePerHour, "FailureRatePerHour", { min: 0 });
      const BetaFactor = optionalNumber(req.body.BetaFactor, "BetaFactor", { min: 0.0001, max: 1 });
      const MissionTimeHours = optionalNumber(req.body.MissionTimeHours, "MissionTimeHours", { min: 0.0001 });
      const criticality = fmea.AnalysisType === "fmeca" && FailureRatePerHour != null && BetaFactor != null && MissionTimeHours != null
        ? computeCriticality({ failureRatePerHour: FailureRatePerHour, betaFactor: BetaFactor, missionTimeHours: MissionTimeHours })
        : null;

      const entry = await tx.create("CmmsFmeaEntry", {
        SiteId: siteId, FmeaRecordId: fmeaId,
        FamilyFailureModeId: req.body.FamilyFailureModeId === undefined ? null : id(req.body.FamilyFailureModeId, "FamilyFailureModeId"),
        FamilyNodeId: req.body.FamilyNodeId === undefined ? null : id(req.body.FamilyNodeId, "FamilyNodeId"),
        FunctionFa: text(req.body.FunctionFa, "FunctionFa", { required: true, max: 600 }),
        FailureModeText: text(req.body.FailureModeText, "FailureModeText", { required: true, max: 400 }),
        EffectFa: text(req.body.EffectFa, "EffectFa", { required: true, max: 800 }),
        CauseFa: text(req.body.CauseFa, "CauseFa", { required: true, max: 800 }),
        CurrentControlFa: text(req.body.CurrentControlFa, "CurrentControlFa", { max: 800 }),
        Severity, Occurrence, Detection, Rpn: rpn.rpn, ActionPriority: rpn.actionPriority,
        FailureRatePerHour, BetaFactor, MissionTimeHours,
        CriticalityNumber: criticality ? criticality.criticalityNumber : null,
        RecommendedActionFa: text(req.body.RecommendedActionFa, "RecommendedActionFa", { required: true, max: 1200 }),
        ActionOwnerId: text(req.body.ActionOwnerId, "ActionOwnerId", { max: 60 }),
        ActionDueOn: isoDate(req.body.ActionDueOn, "ActionDueOn"),
        SortOrder: number(req.body.SortOrder, "SortOrder", { integer: true, min: 0 }) ?? 0,
      }, requestActor(req));

      const entries = await childrenOf(tx, "CmmsFmeaEntry", siteId, "FmeaRecordId", fmeaId);
      const totalRpn = entries.reduce((sum, item) => sum + (item.Rpn ?? 0), 0);
      await tx.patch("CmmsFmeaRecord", fmeaId, { TotalRpn: totalRpn }, requestActor(req), fmea.RowVersion);
      await createAuditRecord(tx, req, "CMMS_FMEA_ENTRY_ADDED", "CmmsFmeaEntry", entry.Id, "cmms.fmea.edit", { rpn: rpn.rpn, actionPriority: rpn.actionPriority });
      return { entry, rpn: rpn.rpn, actionPriority: rpn.actionPriority, reasonFa: rpn.reasonFa, warnings: rpn.warnings, totalRpn };
    });
  }, 201));

  app.post(`${ROOT}/rcm`, route("cmms.rcm.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["FamilyId", "AnalysisCode", "NameFa", "TeamLeadId", "AnalyzedOn", "NoteFa"]));
    const familyId = id(req.body.FamilyId, "FamilyId");
    await mustFind(r, "CmmsFamily", familyId, siteId);
    const AnalysisCode = code(req.body.AnalysisCode, "AnalysisCode");
    if (await r.findOne("CmmsRcmAnalysis", [{ column: "SiteId", op: "eq", value: siteId }, { column: "AnalysisCode", op: "eq", value: AnalysisCode }])) {
      throw conflict("CMMS_DUPLICATE", `کد تحلیل RCM «${AnalysisCode}» تکراری است`);
    }
    const row = await r.create("CmmsRcmAnalysis", {
      SiteId: siteId, FamilyId: familyId, AnalysisCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      Status: "draft",
      TeamLeadId: text(req.body.TeamLeadId, "TeamLeadId", { max: 60 }),
      AnalyzedOn: isoDate(req.body.AnalyzedOn, "AnalyzedOn") ?? todayUtc(),
      FunctionCount: 0, FailureModeCount: 0,
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_RCM_CREATED", "CmmsRcmAnalysis", row.Id, "cmms.rcm.edit", { familyId });
    return row;
  }, 201));

  app.post(`${ROOT}/rcm/:rcmId/entries`, route("cmms.rcm.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "FamilyFailureModeId", "FunctionStatementFa", "FunctionalFailureFa", "FailureMode",
      "Consequence", "IsHiddenFailure", "IsConditionMonitorable", "HasAgeRelatedPattern",
      "ConditionTaskApplicable", "RestorationApplicable", "DiscardApplicable", "FailureFindingApplicable",
      "TaskInterval", "TaskIntervalUnit", "SortOrder",
    ]));
    const rcmId = id(req.params.rcmId, "rcmId");
    return r.transaction(async (tx) => {
      const analysis = await mustFind(tx, "CmmsRcmAnalysis", rcmId, siteId);
      if (analysis.Status === "approved") throw businessRule("CMMS_RCM_LOCKED", "تحلیل RCM تصویب‌شده قابل افزودن ردیف نیست");
      const decision = decideRcmTask({
        isHiddenFailure: bool(req.body.IsHiddenFailure, "IsHiddenFailure", false),
        consequence: oneOf(req.body.Consequence, "Consequence", ["safety-environmental", "operational", "non-operational"], { required: true }),
        isConditionMonitorable: bool(req.body.IsConditionMonitorable, "IsConditionMonitorable", false),
        hasAgeRelatedPattern: bool(req.body.HasAgeRelatedPattern, "HasAgeRelatedPattern", false),
        conditionTaskApplicable: bool(req.body.ConditionTaskApplicable, "ConditionTaskApplicable", false),
        restorationApplicable: bool(req.body.RestorationApplicable, "RestorationApplicable", false),
        discardApplicable: bool(req.body.DiscardApplicable, "DiscardApplicable", false),
        failureFindingApplicable: bool(req.body.FailureFindingApplicable, "FailureFindingApplicable", false),
      });
      const entry = await tx.create("CmmsRcmEntry", {
        SiteId: siteId, RcmAnalysisId: rcmId,
        FamilyFailureModeId: req.body.FamilyFailureModeId === undefined ? null : id(req.body.FamilyFailureModeId, "FamilyFailureModeId"),
        FunctionStatementFa: text(req.body.FunctionStatementFa, "FunctionStatementFa", { required: true, max: 600 }),
        FunctionalFailureFa: text(req.body.FunctionalFailureFa, "FunctionalFailureFa", { required: true, max: 600 }),
        FailureMode: oneOf(req.body.FailureMode, "FailureMode", [...ISO14224_FAILURE_MODES], { required: true }),
        Consequence: decision.consequence,
        IsHiddenFailure: decision.decisionPath[0].answerFa.includes("بله"),
        IsConditionMonitorable: bool(req.body.IsConditionMonitorable, "IsConditionMonitorable", false),
        HasAgeRelatedPattern: bool(req.body.HasAgeRelatedPattern, "HasAgeRelatedPattern", false),
        SelectedTask: decision.selectedTask,
        TaskInterval: optionalNumber(req.body.TaskInterval, "TaskInterval", { min: 0.0001 }),
        TaskIntervalUnit: oneOf(req.body.TaskIntervalUnit, "TaskIntervalUnit", ["hours", "days", "weeks", "months", "cycles", "km"]),
        DecisionPathJson: { path: decision.decisionPath, reasonFa: decision.reasonFa },
        SortOrder: number(req.body.SortOrder, "SortOrder", { integer: true, min: 0 }) ?? 0,
      }, requestActor(req));
      const entries = await childrenOf(tx, "CmmsRcmEntry", siteId, "RcmAnalysisId", rcmId);
      await tx.patch("CmmsRcmAnalysis", rcmId, { FailureModeCount: entries.length }, requestActor(req), analysis.RowVersion);
      await createAuditRecord(tx, req, "CMMS_RCM_ENTRY_ADDED", "CmmsRcmEntry", entry.Id, "cmms.rcm.edit", { selectedTask: decision.selectedTask });
      return { entry, decision };
    });
  }, 201));

  app.post(`${ROOT}/rca-cases`, route("cmms.rca.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["CaseNo", "AssetId", "FailureRecordId", "WorkOrderId", "Method", "OpenedOn", "ProblemStatementFa"]));
    const CaseNo = code(req.body.CaseNo, "CaseNo");
    const assetId = id(req.body.AssetId, "AssetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    if (await r.findOne("CmmsRcaCase", [{ column: "SiteId", op: "eq", value: siteId }, { column: "CaseNo", op: "eq", value: CaseNo }])) {
      throw conflict("CMMS_DUPLICATE", `شمارهٔ پروندهٔ RCFA «${CaseNo}» تکراری است`);
    }
    const row = await r.create("CmmsRcaCase", {
      SiteId: siteId, CaseNo, AssetId: assetId,
      FailureRecordId: req.body.FailureRecordId === undefined ? null : id(req.body.FailureRecordId, "FailureRecordId"),
      WorkOrderId: req.body.WorkOrderId === undefined ? null : id(req.body.WorkOrderId, "WorkOrderId"),
      Method: oneOf(req.body.Method, "Method", ["five-why", "fishbone", "apollo", "fault-tree", "combined"], { fallback: "five-why" }),
      Status: "open",
      OpenedOn: isoDate(req.body.OpenedOn, "OpenedOn") ?? todayUtc(),
      OpenedById: requestActor(req),
      ProblemStatementFa: text(req.body.ProblemStatementFa, "ProblemStatementFa", { required: true, max: 1000 }),
      WhyDepth: 0,
      ModelVersion: CMMS_MODEL_VERSION,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_RCA_CASE_CREATED", "CmmsRcaCase", row.Id, "cmms.rca.edit", { assetId });
    return row;
  }, 201));

  app.post(`${ROOT}/rca-cases/:caseId/entries`, route("cmms.rca.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["EntryType", "Sequence", "ParentEntryId", "StatementFa", "FishboneCategory", "IsRootCause", "EvidencePath", "OwnerId", "DueOn", "AiSuggested", "AiConfidence"]));
    const caseId = id(req.params.caseId, "caseId");
    return r.transaction(async (tx) => {
      const rcaCase = await mustFind(tx, "CmmsRcaCase", caseId, siteId);
      if (rcaCase.Status === "verified") throw businessRule("CMMS_RCA_VERIFIED", "پروندهٔ تأییدشده قابل افزودن ردیف نیست");
      const EntryType = oneOf(req.body.EntryType, "EntryType",
        ["why", "cause-branch", "evidence", "corrective-action", "preventive-action"], { required: true });
      const Sequence = number(req.body.Sequence, "Sequence", { required: true, integer: true, min: 1 });
      if (await tx.findOne("CmmsRcaEntry", [
        { column: "RcaCaseId", op: "eq", value: caseId }, { column: "EntryType", op: "eq", value: EntryType }, { column: "Sequence", op: "eq", value: Sequence },
      ])) throw conflict("CMMS_DUPLICATE", `ردیف «${EntryType}/${Sequence}» تکراری است`);
      const row = await tx.create("CmmsRcaEntry", {
        SiteId: siteId, RcaCaseId: caseId, EntryType, Sequence,
        ParentEntryId: req.body.ParentEntryId === undefined ? null : id(req.body.ParentEntryId, "ParentEntryId"),
        StatementFa: text(req.body.StatementFa, "StatementFa", { required: true, max: 1200 }),
        FishboneCategory: oneOf(req.body.FishboneCategory, "FishboneCategory", ["man", "machine", "method", "material", "measurement", "environment"]),
        IsRootCause: bool(req.body.IsRootCause, "IsRootCause", false),
        EvidencePath: text(req.body.EvidencePath, "EvidencePath", { max: 600 }),
        OwnerId: text(req.body.OwnerId, "OwnerId", { max: 60 }),
        DueOn: isoDate(req.body.DueOn, "DueOn"),
        AiSuggested: bool(req.body.AiSuggested, "AiSuggested", false),
        AiConfidence: optionalNumber(req.body.AiConfidence, "AiConfidence", { min: 0, max: 1 }),
      }, requestActor(req));
      if (EntryType === "why") {
        const whys = await tx.list("CmmsRcaEntry", {
          where: [{ column: "SiteId", op: "eq", value: siteId }, { column: "RcaCaseId", op: "eq", value: caseId }, { column: "EntryType", op: "eq", value: "why" }],
        });
        await tx.patch("CmmsRcaCase", caseId, { WhyDepth: whys.length }, requestActor(req), rcaCase.RowVersion);
      }
      await createAuditRecord(tx, req, "CMMS_RCA_ENTRY_ADDED", "CmmsRcaEntry", row.Id, "cmms.rca.edit", { EntryType, Sequence });
      return row;
    });
  }, 201));

  /* ── موتورهای محاسباتی استاندارد: محاسبه + ذخیره در یک تراکنش ── */

  app.post(`${ROOT}/reliability/compute`, route("cmms.reliability.view", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "AssetId", "FamilyId", "LocationId", "PeriodType", "PeriodStart", "PeriodEnd",
      "CalendarHours", "OperatingHours", "DowntimeHours", "RepairHours", "FailureCount",
      "PmScheduled", "PmDoneOnTime", "MissionTimeHours", "Persist",
    ]));
    const PeriodType = oneOf(req.body.PeriodType, "PeriodType", ["daily", "weekly", "monthly", "quarterly", "yearly"], { required: true });
    const PeriodStart = isoDate(req.body.PeriodStart, "PeriodStart", { required: true });
    const PeriodEnd = isoDate(req.body.PeriodEnd, "PeriodEnd", { required: true });
    if (PeriodEnd < PeriodStart) throw bad("PeriodEnd", "پایان دوره پیش از شروع آن است");
    const result = computeReliability({
      calendarHours: number(req.body.CalendarHours, "CalendarHours", { required: true, min: 0 }),
      operatingHours: number(req.body.OperatingHours, "OperatingHours", { required: true, min: 0 }),
      downtimeHours: number(req.body.DowntimeHours, "DowntimeHours", { required: true, min: 0 }),
      repairHours: optionalNumber(req.body.RepairHours, "RepairHours", { min: 0 }),
      failureCount: number(req.body.FailureCount, "FailureCount", { required: true, integer: true, min: 0 }),
      pmScheduled: optionalNumber(req.body.PmScheduled, "PmScheduled", { integer: true, min: 0 }),
      pmDoneOnTime: optionalNumber(req.body.PmDoneOnTime, "PmDoneOnTime", { integer: true, min: 0 }),
      missionTimeHours: optionalNumber(req.body.MissionTimeHours, "MissionTimeHours", { min: 0 }),
    });
    if (!bool(req.body.Persist, "Persist", false)) return { result, persisted: null };
    const AssetId = req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId");
    const FamilyId = req.body.FamilyId === undefined ? null : id(req.body.FamilyId, "FamilyId");
    if (!AssetId && !FamilyId) throw bad("AssetId", "برای ذخیرهٔ تصویر قابلیت اطمینان، تجهیز یا خانواده الزامی است");
    const row = await r.create("CmmsReliabilitySnapshot", {
      SiteId: siteId, AssetId, FamilyId,
      LocationId: req.body.LocationId === undefined ? null : id(req.body.LocationId, "LocationId"),
      PeriodType, PeriodStart, PeriodEnd,
      CalendarHours: req.body.CalendarHours, OperatingHours: req.body.OperatingHours,
      DowntimeHours: req.body.DowntimeHours, FailureCount: req.body.FailureCount,
      MtbfHours: result.mtbfHours, MttfHours: result.mttfHours, MttrHours: result.mttrHours,
      FailureRateLambda: result.failureRateLambda, AvailabilityPct: result.availabilityPct,
      InherentAvailabilityPct: result.inherentAvailabilityPct, ReliabilityAtMission: result.reliabilityAtMission,
      MissionTimeHours: result.missionTimeHours, PmCompliancePct: result.pmCompliancePct,
      ModelVersion: CMMS_MODEL_VERSION,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_RELIABILITY_SNAPSHOT_CREATED", "CmmsReliabilitySnapshot", row.Id, "cmms.reliability.view");
    return { result, persisted: row };
  }, 200));

  app.post(`${ROOT}/oee/compute`, route("cmms.oee.view", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "AssetId", "PeriodType", "PeriodStart", "PeriodEnd", "CalendarMinutes", "PlannedProductionMinutes",
      "RunMinutes", "TotalUnits", "GoodUnits", "IdealCycleTimeSeconds", "BreakdownMinutes",
      "SetupMinutes", "MinorStopMinutes", "ReducedSpeedMinutes", "StartupRejectUnits", "ProductionRejectUnits", "Persist",
    ]));
    const PeriodType = oneOf(req.body.PeriodType, "PeriodType", ["daily", "weekly", "monthly", "quarterly", "yearly"], { required: true });
    const PeriodStart = isoDate(req.body.PeriodStart, "PeriodStart", { required: true });
    const PeriodEnd = isoDate(req.body.PeriodEnd, "PeriodEnd", { required: true });
    const result = computeOee({
      calendarMinutes: number(req.body.CalendarMinutes, "CalendarMinutes", { required: true, min: 0 }),
      plannedProductionMinutes: number(req.body.PlannedProductionMinutes, "PlannedProductionMinutes", { required: true, min: 0 }),
      runMinutes: number(req.body.RunMinutes, "RunMinutes", { required: true, min: 0 }),
      totalUnits: number(req.body.TotalUnits, "TotalUnits", { required: true, min: 0 }),
      goodUnits: number(req.body.GoodUnits, "GoodUnits", { required: true, min: 0 }),
      idealCycleTimeSeconds: number(req.body.IdealCycleTimeSeconds, "IdealCycleTimeSeconds", { required: true, min: 0.0001 }),
      breakdownMinutes: optionalNumber(req.body.BreakdownMinutes, "BreakdownMinutes", { min: 0 }),
      setupMinutes: optionalNumber(req.body.SetupMinutes, "SetupMinutes", { min: 0 }),
      minorStopMinutes: optionalNumber(req.body.MinorStopMinutes, "MinorStopMinutes", { min: 0 }),
      reducedSpeedMinutes: optionalNumber(req.body.ReducedSpeedMinutes, "ReducedSpeedMinutes", { min: 0 }),
      startupRejectUnits: optionalNumber(req.body.StartupRejectUnits, "StartupRejectUnits", { min: 0 }),
      productionRejectUnits: optionalNumber(req.body.ProductionRejectUnits, "ProductionRejectUnits", { min: 0 }),
    });
    if (!bool(req.body.Persist, "Persist", false)) return { result, persisted: null };
    const assetId = id(req.body.AssetId, "AssetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const row = await r.create("CmmsOeeSnapshot", {
      SiteId: siteId, AssetId: assetId, PeriodType, PeriodStart, PeriodEnd,
      PlannedProductionMinutes: req.body.PlannedProductionMinutes, RunMinutes: req.body.RunMinutes,
      BreakdownHours: (req.body.BreakdownMinutes ?? 0) / 60, SetupHours: (req.body.SetupMinutes ?? 0) / 60,
      MinorStopHours: (req.body.MinorStopMinutes ?? 0) / 60, ReducedSpeedHours: (req.body.ReducedSpeedMinutes ?? 0) / 60,
      StartupRejectUnits: req.body.StartupRejectUnits ?? 0, ProductionRejectUnits: req.body.ProductionRejectUnits ?? 0,
      TotalUnits: req.body.TotalUnits, IdealCycleTimeSeconds: req.body.IdealCycleTimeSeconds,
      AvailabilityPct: result.availabilityPct, PerformancePct: result.performancePct, QualityPct: result.qualityPct,
      OeePct: result.oeePct, TeepPct: result.teepPct, CalendarHours: req.body.CalendarMinutes / 60,
      ModelVersion: CMMS_MODEL_VERSION,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_OEE_SNAPSHOT_CREATED", "CmmsOeeSnapshot", row.Id, "cmms.oee.view");
    return { result, persisted: row };
  }, 200));

  app.post(`${ROOT}/supply-reliability/compute`, route("cmms.reliability.view", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["LocationId", "PeriodType", "PeriodStart", "PeriodEnd", "CustomersServed", "Events", "ExcludeMajorEvents", "Persist"]));
    const PeriodType = oneOf(req.body.PeriodType, "PeriodType", ["daily", "weekly", "monthly", "quarterly", "yearly"], { required: true });
    const PeriodStart = isoDate(req.body.PeriodStart, "PeriodStart", { required: true });
    const PeriodEnd = isoDate(req.body.PeriodEnd, "PeriodEnd", { required: true });
    if (!Array.isArray(req.body.Events)) throw bad("Events", "رویدادهای قطعی باید فهرست باشند");
    const periodMinutes = (new Date(`${PeriodEnd}T23:59:59Z`).getTime() - new Date(`${PeriodStart}T00:00:00Z`).getTime()) / 60_000;
    if (periodMinutes <= 0) throw bad("PeriodEnd", "بازهٔ دوره نامعتبر است");
    const result = computeSupplyReliability({
      customersServed: number(req.body.CustomersServed, "CustomersServed", { required: true, integer: true, min: 0 }),
      periodMinutes,
      events: req.body.Events.map((event, index) => ({
        customersAffected: number(event?.customersAffected, `Events[${index}].customersAffected`, { required: true, min: 0 }),
        durationMinutes: number(event?.durationMinutes, `Events[${index}].durationMinutes`, { required: true, min: 0 }),
        isMomentary: Boolean(event?.isMomentary),
        isMajorEvent: Boolean(event?.isMajorEvent),
      })),
      excludeMajorEvents: bool(req.body.ExcludeMajorEvents, "ExcludeMajorEvents", false),
    });
    if (!bool(req.body.Persist, "Persist", false)) return { result, persisted: null };
    const row = await r.create("CmmsSupplyReliability", {
      SiteId: siteId,
      LocationId: req.body.LocationId === undefined ? null : id(req.body.LocationId, "LocationId"),
      PeriodType, PeriodStart, PeriodEnd,
      CustomersServed: result.customersServed, TotalInterruptions: result.totalInterruptions,
      CustomersInterrupted: result.customersInterrupted,
      TotalCustomerInterruptionMinutes: result.totalCustomerInterruptionMinutes,
      TotalCustomerMinutesAffected: result.totalCustomerMinutesAffected,
      SaidiMinutes: result.saidiMinutes, SaifiCount: result.saifiCount, CaidiMinutes: result.caidiMinutes,
      AsaiPct: result.asaiPct, MaifiCount: result.maifiCount,
      ExcludeMajorEvents: bool(req.body.ExcludeMajorEvents, "ExcludeMajorEvents", false),
      ModelVersion: CMMS_MODEL_VERSION,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_SUPPLY_RELIABILITY_CREATED", "CmmsSupplyReliability", row.Id, "cmms.reliability.view");
    return { result, persisted: row };
  }, 200));

  app.post(`${ROOT}/lcc/compute`, route("cmms.lcc.view", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "AssetId", "ScenarioName", "AnalysisDate", "LifeYears", "DiscountRatePct", "AcquisitionCost",
      "InstallationCost", "OperatingCostPerYear", "MaintenanceCostPerYear", "DowntimeLossPerYear",
      "EnergyCostPerYear", "DisposalCost", "ResidualValue", "YearlyCashflows", "Persist", "IsSelectedOption", "NoteFa",
    ]));
    const result = computeLifeCycleCost({
      lifeYears: number(req.body.LifeYears, "LifeYears", { required: true, integer: true, min: 1 }),
      discountRatePct: number(req.body.DiscountRatePct, "DiscountRatePct", { required: true, min: 0 }),
      acquisitionCost: number(req.body.AcquisitionCost, "AcquisitionCost", { required: true }),
      installationCost: optionalNumber(req.body.InstallationCost, "InstallationCost"),
      operatingCostPerYear: optionalNumber(req.body.OperatingCostPerYear, "OperatingCostPerYear"),
      maintenanceCostPerYear: optionalNumber(req.body.MaintenanceCostPerYear, "MaintenanceCostPerYear"),
      downtimeLossPerYear: optionalNumber(req.body.DowntimeLossPerYear, "DowntimeLossPerYear"),
      energyCostPerYear: optionalNumber(req.body.EnergyCostPerYear, "EnergyCostPerYear"),
      disposalCost: optionalNumber(req.body.DisposalCost, "DisposalCost"),
      residualValue: optionalNumber(req.body.ResidualValue, "ResidualValue"),
      yearlyCashflows: Array.isArray(req.body.YearlyCashflows) ? req.body.YearlyCashflows : undefined,
    });
    if (!bool(req.body.Persist, "Persist", false)) return { result, persisted: null };
    const assetId = id(req.body.AssetId, "AssetId");
    await mustFind(r, "CmmsAsset", assetId, siteId);
    const row = await r.create("CmmsLccRecord", {
      SiteId: siteId, AssetId: assetId,
      ScenarioName: text(req.body.ScenarioName, "ScenarioName", { max: 200 }) ?? "base",
      AnalysisDate: isoDate(req.body.AnalysisDate, "AnalysisDate") ?? todayUtc(),
      LifeYears: req.body.LifeYears, DiscountRatePct: req.body.DiscountRatePct,
      AcquisitionCost: req.body.AcquisitionCost, InstallationCost: req.body.InstallationCost ?? null,
      OperatingCostPerYear: req.body.OperatingCostPerYear ?? null,
      MaintenanceCostPerYear: req.body.MaintenanceCostPerYear ?? null,
      DowntimeLossPerYear: req.body.DowntimeLossPerYear ?? null,
      EnergyCostPerYear: req.body.EnergyCostPerYear ?? null,
      DisposalCost: req.body.DisposalCost ?? null, ResidualValue: req.body.ResidualValue ?? null,
      NpvAcquisition: result.npvAcquisition, NpvOperation: result.npvOperation,
      NpvMaintenance: result.npvMaintenance, NpvDowntime: result.npvDowntime,
      NpvDisposal: result.npvDisposal, TotalNpv: result.totalNpv,
      IsSelectedOption: bool(req.body.IsSelectedOption, "IsSelectedOption", false),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
      ModelVersion: CMMS_MODEL_VERSION,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_LCC_CREATED", "CmmsLccRecord", row.Id, "cmms.lcc.view");
    return { result, persisted: row };
  }, 200));

  app.post(`${ROOT}/lcc/select`, route("cmms.lcc.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["AssetId", "ScenarioIds"]));
    if (!Array.isArray(req.body.ScenarioIds) || req.body.ScenarioIds.length < 2) {
      throw bad("ScenarioIds", "برای مقایسه دست‌کم دو سناریو لازم است");
    }
    const scenarios = [];
    for (const scenarioId of req.body.ScenarioIds) {
      const scenario = await mustFind(r, "CmmsLccRecord", id(scenarioId, "ScenarioIds"), siteId);
      scenarios.push({ name: scenario.ScenarioName ?? scenario.Id, totalNpv: scenario.TotalNpv ?? 0, id: scenario.Id });
    }
    const decision = selectLccOption(scenarios.map(({ name, totalNpv }) => ({ name, totalNpv })));
    const selectedScenario = scenarios.find((scenario) => scenario.name === decision.selected);
    /* علامت‌گذاری گزینهٔ انتخاب‌شده: اگر این کار انجام نشود، دفعهٔ بعد هیچ کس
     * نمی‌داند کدام سناریو مبنای تصمیم بوده است. */
    if (selectedScenario) {
      for (const scenario of scenarios) {
        const current = await r.get("CmmsLccRecord", scenario.id);
        await r.patch("CmmsLccRecord", scenario.id, { IsSelectedOption: scenario.id === selectedScenario.id }, requestActor(req), current.RowVersion);
      }
    }
    await writeAudit(r, req, "CMMS_LCC_OPTION_SELECTED", "CmmsLccRecord", selectedScenario?.id ?? null, "cmms.lcc.edit", { selected: decision.selected });
    return { ...decision, selectedScenarioId: selectedScenario?.id ?? null };
  }));

  /* ───────────────────────── ۹. شاخص‌ها و هشدارها ───────────────────────── */

  app.get(`${ROOT}/kpi-targets`, route("cmms.kpi.view", async ({ repo: r, req, siteId }) => {
    const rows = await listInSite(r, "CmmsKpiTarget", siteId, { orderBy: [{ column: "KpiCode", dir: "asc" }] });
    return { targets: rows, total: rows.length };
  }));

  app.post(`${ROOT}/kpi-targets`, route("cmms.kpi.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["KpiCode", "NameFa", "NameEn", "Category", "Uom", "Direction", "TargetValue", "WarnThreshold", "AlarmThreshold", "PeriodType", "IsActive", "FormulaFa", "NoteFa"]));
    const KpiCode = code(req.body.KpiCode, "KpiCode");
    if (await r.findOne("CmmsKpiTarget", [{ column: "SiteId", op: "eq", value: siteId }, { column: "KpiCode", op: "eq", value: KpiCode }])) {
      throw conflict("CMMS_DUPLICATE", `کد شاخص «${KpiCode}» تکراری است`);
    }
    const row = await r.create("CmmsKpiTarget", {
      SiteId: siteId, KpiCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      Category: oneOf(req.body.Category, "Category", ["technical", "economic", "organizational"], { required: true }),
      Uom: text(req.body.Uom, "Uom", { required: true, max: 24 }),
      Direction: oneOf(req.body.Direction, "Direction", ["maximize", "minimize", "target"], { fallback: "maximize" }),
      TargetValue: optionalNumber(req.body.TargetValue, "TargetValue"),
      WarnThreshold: optionalNumber(req.body.WarnThreshold, "WarnThreshold"),
      AlarmThreshold: optionalNumber(req.body.AlarmThreshold, "AlarmThreshold"),
      PeriodType: oneOf(req.body.PeriodType, "PeriodType", ["daily", "weekly", "monthly", "quarterly", "yearly"], { fallback: "monthly" }),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      FormulaFa: text(req.body.FormulaFa, "FormulaFa", { max: 800 }),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_KPI_TARGET_CREATED", "CmmsKpiTarget", row.Id, "cmms.kpi.edit");
    return row;
  }, 201));

  app.post(`${ROOT}/kpi-results`, route("cmms.kpi.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["KpiTargetId", "AssetId", "FamilyId", "PeriodType", "PeriodStart", "PeriodEnd", "ActualValue", "ComputedBy"]));
    const kpiTargetId = id(req.body.KpiTargetId, "KpiTargetId");
    const target = await mustFind(r, "CmmsKpiTarget", kpiTargetId, siteId);
    const ActualValue = number(req.body.ActualValue, "ActualValue", { required: true });
    const PeriodType = oneOf(req.body.PeriodType, "PeriodType", ["daily", "weekly", "monthly", "quarterly", "yearly"], { fallback: target.PeriodType ?? "monthly" });
    const PeriodStart = isoDate(req.body.PeriodStart, "PeriodStart", { required: true });
    const PeriodEnd = isoDate(req.body.PeriodEnd, "PeriodEnd", { required: true });
    const evaluation = evaluateKpiHealth({
      actualValue: ActualValue,
      targetValue: target.TargetValue ?? null,
      warnThreshold: target.WarnThreshold ?? null,
      alarmThreshold: target.AlarmThreshold ?? null,
      direction: target.Direction ?? "maximize",
    });
    const row = await r.create("CmmsKpiResult", {
      SiteId: siteId, KpiTargetId: kpiTargetId,
      AssetId: req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId"),
      FamilyId: req.body.FamilyId === undefined ? null : id(req.body.FamilyId, "FamilyId"),
      PeriodType, PeriodStart, PeriodEnd,
      ActualValue, TargetValue: target.TargetValue ?? null,
      VariancePct: evaluation.variancePct, Health: evaluation.health,
      ComputedBy: oneOf(req.body.ComputedBy, "ComputedBy", ["engine", "manual"], { fallback: "engine" }),
      ModelVersion: CMMS_MODEL_VERSION,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_KPI_RESULT_CREATED", "CmmsKpiResult", row.Id, "cmms.kpi.edit", { health: evaluation.health });
    return { result: row, evaluation };
  }, 201));

  app.get(`${ROOT}/alerts`, route("cmms.alert.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["status", "severity", "category", "assetId", "limit", "offset"]));
    const where = [];
    if (req.query.status !== undefined) where.push({ column: "Status", op: "eq", value: oneOf(req.query.status, "status", ["open", "acknowledged", "resolved", "suppressed"], { required: true }) });
    if (req.query.severity !== undefined) where.push({ column: "Severity", op: "eq", value: oneOf(req.query.severity, "severity", ["critical", "high", "medium", "low"], { required: true }) });
    if (req.query.category !== undefined) {
      where.push({ column: "Category", op: "eq", value: oneOf(req.query.category, "category", ["condition", "pm-due", "pm-overdue", "spare-shortage", "sla-breach", "safety", "reliability", "ai-insight"], { required: true }) });
    }
    if (req.query.assetId !== undefined) where.push({ column: "AssetId", op: "eq", value: id(req.query.assetId, "assetId") });
    const rows = await listInSite(r, "CmmsAlert", siteId, {
      where, orderBy: [{ column: "RaisedAt", dir: "desc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 500),
      offset: pageNumber(req.query.offset, "offset", 0, 1_000_000),
    });
    return { alerts: rows, total: rows.length };
  }));

  app.post(`${ROOT}/alerts`, route("cmms.alert.ack", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["AlertCode", "Severity", "Category", "TitleFa", "MessageFa", "AssetId", "FamilyId", "WorkOrderId", "NotifyInApp", "NotifyEmail", "NotifySms"]));
    const row = await r.create("CmmsAlert", {
      SiteId: siteId,
      AlertCode: code(req.body.AlertCode, "AlertCode"),
      Severity: oneOf(req.body.Severity, "Severity", ["critical", "high", "medium", "low"], { required: true }),
      Category: oneOf(req.body.Category, "Category",
        ["condition", "pm-due", "pm-overdue", "spare-shortage", "sla-breach", "safety", "reliability", "ai-insight"], { required: true }),
      TitleFa: text(req.body.TitleFa, "TitleFa", { required: true, max: 300 }),
      MessageFa: text(req.body.MessageFa, "MessageFa", { max: 2000 }),
      AssetId: req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId"),
      FamilyId: req.body.FamilyId === undefined ? null : id(req.body.FamilyId, "FamilyId"),
      WorkOrderId: req.body.WorkOrderId === undefined ? null : id(req.body.WorkOrderId, "WorkOrderId"),
      Status: "open", RaisedAt: new Date().toISOString(),
      NotifyInApp: bool(req.body.NotifyInApp, "NotifyInApp", true),
      NotifyEmail: bool(req.body.NotifyEmail, "NotifyEmail", false),
      NotifySms: bool(req.body.NotifySms, "NotifySms", false),
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_ALERT_RAISED", "CmmsAlert", row.Id, "cmms.alert.ack");
    return row;
  }, 201));

  app.post(`${ROOT}/alerts/:alertId/acknowledge`, route("cmms.alert.ack", async ({ repo: r, req, siteId }) => {
    const alertId = id(req.params.alertId, "alertId");
    const existing = await mustFind(r, "CmmsAlert", alertId, siteId);
    if (existing.Status !== "open") throw conflict("CMMS_ALERT_NOT_OPEN", `هشدار در وضعیت «${existing.Status}» قابل رسیدگی نیست`);
    await r.patch("CmmsAlert", alertId, {
      Status: "acknowledged", AcknowledgedAt: new Date().toISOString(), AcknowledgedById: requestActor(req),
    }, requestActor(req), existing.RowVersion);
    await writeAudit(r, req, "CMMS_ALERT_ACKNOWLEDGED", "CmmsAlert", alertId, "cmms.alert.ack");
    return r.get("CmmsAlert", alertId);
  }));

  app.post(`${ROOT}/alerts/:alertId/resolve`, route("cmms.alert.ack", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["ResolutionNoteFa"]));
    const alertId = id(req.params.alertId, "alertId");
    const existing = await mustFind(r, "CmmsAlert", alertId, siteId);
    if (existing.Status === "resolved") throw conflict("CMMS_ALERT_ALREADY_RESOLVED", "هشدار پیش‌تر بسته شده است");
    const now = new Date().toISOString();
    await r.patch("CmmsAlert", alertId, {
      Status: "resolved",
      /* اگر هشدار هنوز رسیدگی نشده بود، رسیدگی و رفع را هم‌زمان ثبت می‌کنیم؛
       * در غیر این صورت قید CHECK جدول (وضعیت resolved بدون AcknowledgedAt) نقض می‌شود. */
      AcknowledgedAt: existing.AcknowledgedAt ?? now,
      AcknowledgedById: existing.AcknowledgedById ?? requestActor(req),
      ResolvedAt: now,
      ResolutionNoteFa: text(req.body.ResolutionNoteFa, "ResolutionNoteFa", { max: 1000 }),
    }, requestActor(req), existing.RowVersion);
    await writeAudit(r, req, "CMMS_ALERT_RESOLVED", "CmmsAlert", alertId, "cmms.alert.ack");
    return r.get("CmmsAlert", alertId);
  }));

  /* ───────────────────────── ۱۰. گردش‌کار ───────────────────────── */

  app.get(`${ROOT}/workflows`, route("cmms.workflow.view", async ({ repo: r, req, siteId }) => {
    const definitions = await listInSite(r, "CmmsWorkflowDefinition", siteId, { orderBy: [{ column: "WorkflowCode", dir: "asc" }] });
    const withParts = await Promise.all(definitions.map(async (definition) => ({
      ...definition,
      steps: await childrenOf(r, "CmmsWorkflowStep", siteId, "WorkflowDefinitionId", definition.Id),
      transitions: await childrenOf(r, "CmmsWorkflowTransition", siteId, "WorkflowDefinitionId", definition.Id),
    })));
    return { workflows: withParts, total: withParts.length };
  }));

  app.post(`${ROOT}/workflows`, route("cmms.workflow.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["WorkflowCode", "NameFa", "AppliesTo", "StartStepCode", "Steps", "Transitions", "NoteFa"]));
    const WorkflowCode = code(req.body.WorkflowCode, "WorkflowCode");
    const AppliesTo = oneOf(req.body.AppliesTo, "AppliesTo",
      ["work-request", "work-order", "rca", "pm-schedule", "bulk-change"], { required: true });
    const Steps = Array.isArray(req.body.Steps) ? req.body.Steps : null;
    const Transitions = Array.isArray(req.body.Transitions) ? req.body.Transitions : null;
    if (!Steps || Steps.length === 0) throw bad("Steps", "دست‌کم یک گام لازم است");
    if (!Transitions) throw bad("Transitions", "گذارها باید فهرست باشند");

    const StartStepCode = text(req.body.StartStepCode, "StartStepCode", { required: true, max: 60 });
    /* اعتبارسنجی ساختاری پیش از ذخیره: تعریف ناسالم در زمان اجرا به بن‌بست
     * بی‌صدا می‌رسد که در محیط عملیاتی بسیار پرهزینه‌تر از ردشدن در ثبت است. */
    const issues = validateWorkflowDefinition({
      workflowCode: WorkflowCode,
      startStepCode: StartStepCode,
      steps: Steps.map((step) => ({
        stepCode: String(step?.StepCode ?? ""),
        stepKind: step?.StepKind ?? "task",
        ownerRole: String(step?.OwnerRole ?? ""),
        slaHours: step?.SlaHours ?? null,
        isTerminal: Boolean(step?.IsTerminal),
        requiresEvidence: Boolean(step?.RequiresEvidence),
      })),
      transitions: Transitions.map((transition) => ({
        fromStepCode: String(transition?.FromStepCode ?? ""),
        toStepCode: String(transition?.ToStepCode ?? ""),
        actionCode: String(transition?.ActionCode ?? ""),
        requiredPermission: String(transition?.RequiredPermission ?? ""),
      })),
    });
    if (issues.length) throw businessRule("CMMS_WORKFLOW_INVALID", "تعریف گردش‌کار نامعتبر است", { issues });

    return r.transaction(async (tx) => {
      const definition = await tx.create("CmmsWorkflowDefinition", {
        SiteId: siteId, WorkflowCode,
        NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
        AppliesTo, StartStepCode, Version: 1, IsActive: true,
        NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
      }, requestActor(req));
      for (const [index, step] of Steps.entries()) {
        await tx.create("CmmsWorkflowStep", {
          SiteId: siteId, WorkflowDefinitionId: definition.Id,
          StepCode: text(step.StepCode, `Steps[${index}].StepCode`, { required: true, max: 60 }),
          NameFa: text(step.NameFa, `Steps[${index}].NameFa`, { required: true, max: 240 }),
          StepKind: oneOf(step.StepKind, `Steps[${index}].StepKind`, ["task", "approval", "notification", "end"], { fallback: "task" }),
          OwnerRole: text(step.OwnerRole, `Steps[${index}].OwnerRole`, { required: true, max: 60 }),
          SlaHours: optionalNumber(step.SlaHours, `Steps[${index}].SlaHours`, { min: 0.01 }),
          IsTerminal: bool(step.IsTerminal, `Steps[${index}].IsTerminal`, false),
          RequiresEvidence: bool(step.RequiresEvidence, `Steps[${index}].RequiresEvidence`, false),
          SortOrder: index + 1,
        }, requestActor(req));
      }
      for (const [index, transition] of Transitions.entries()) {
        await tx.create("CmmsWorkflowTransition", {
          SiteId: siteId, WorkflowDefinitionId: definition.Id,
          FromStepCode: text(transition.FromStepCode, `Transitions[${index}].FromStepCode`, { required: true, max: 60 }),
          ToStepCode: text(transition.ToStepCode, `Transitions[${index}].ToStepCode`, { required: true, max: 60 }),
          ActionCode: oneOf(transition.ActionCode, `Transitions[${index}].ActionCode`,
            ["submit", "approve", "reject", "assign", "complete", "cancel", "reopen"], { required: true }),
          RequiredPermission: text(transition.RequiredPermission, `Transitions[${index}].RequiredPermission`, { required: true, max: 80 }),
          SortOrder: index + 1, IsActive: true,
        }, requestActor(req));
      }
      await createAuditRecord(tx, req, "CMMS_WORKFLOW_CREATED", "CmmsWorkflowDefinition", definition.Id, "cmms.workflow.edit", { AppliesTo, steps: Steps.length, transitions: Transitions.length });
      return definition;
    });
  }, 201));

  app.post(`${ROOT}/workflow-instances`, route("cmms.workflow.edit", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["WorkflowDefinitionId", "SubjectEntity", "SubjectId", "CurrentOwnerId"]));
    const definitionId = id(req.body.WorkflowDefinitionId, "WorkflowDefinitionId");
    const definition = await mustFind(r, "CmmsWorkflowDefinition", definitionId, siteId);
    const now = new Date().toISOString();
    const startStep = await r.findOne("CmmsWorkflowStep", [
      { column: "WorkflowDefinitionId", op: "eq", value: definitionId },
      { column: "StepCode", op: "eq", value: definition.StartStepCode },
    ]);
    const slaHours = startStep?.SlaHours ?? null;
    const row = await r.create("CmmsWorkflowInstance", {
      SiteId: siteId, WorkflowDefinitionId: definitionId,
      SubjectEntity: text(req.body.SubjectEntity, "SubjectEntity", { required: true, max: 60 }),
      SubjectId: id(req.body.SubjectId, "SubjectId"),
      CurrentStepCode: definition.StartStepCode,
      State: "running", StartedAt: now,
      CurrentOwnerId: text(req.body.CurrentOwnerId, "CurrentOwnerId", { max: 60 }),
      DueAt: slaHours ? new Date(new Date(now).getTime() + slaHours * 3600_000).toISOString() : null,
    }, requestActor(req));
    await writeAudit(r, req, "CMMS_WORKFLOW_INSTANCE_STARTED", "CmmsWorkflowInstance", row.Id, "cmms.workflow.edit", { WorkflowCode: definition.WorkflowCode });
    return row;
  }, 201));

  app.post(`${ROOT}/workflow-instances/:instanceId/advance`, route("cmms.workflow.view", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["ActionCode", "CommentFa", "EvidenceProvided"]));
    const instanceId = id(req.params.instanceId, "instanceId");
    return r.transaction(async (tx) => {
      const instance = await mustFind(tx, "CmmsWorkflowInstance", instanceId, siteId);
      if (instance.State !== "running") throw businessRule("CMMS_WF_FINISHED", `گردش‌کار در وضعیت «${instance.State}» قابل پیشروی نیست`);
      const definition = await tx.get("CmmsWorkflowDefinition", instance.WorkflowDefinitionId);
      /* ستون‌های دیتابیس PascalCase هستند ولی موتور دامنه با قرارداد
       * camelCase خودش کار می‌کند (`stepCode`, `ownerRole`, `fromStepCode`, …).
       * این نگاشت را `POST /workflows` هم برای اعتبارسنجی انجام می‌دهد؛
       * بدون آن موتور هیچ گذاری را پیدا نمی‌کند و همیشه CMMS_WF_NO_TRANSITION
       * می‌دهد — یعنی گردش‌کار عملاً کار نمی‌کند. */
      const stepRows = await childrenOf(tx, "CmmsWorkflowStep", siteId, "WorkflowDefinitionId", definition.Id);
      const transitionRows = await childrenOf(tx, "CmmsWorkflowTransition", siteId, "WorkflowDefinitionId", definition.Id);
      const steps = stepRows.map((step) => ({
        stepCode: String(step.StepCode ?? ""),
        stepKind: step.StepKind ?? "task",
        ownerRole: String(step.OwnerRole ?? ""),
        slaHours: step.SlaHours ?? null,
        isTerminal: Boolean(step.IsTerminal),
        requiresEvidence: Boolean(step.RequiresEvidence),
      }));
      const transitions = transitionRows.map((transition) => ({
        fromStepCode: String(transition.FromStepCode ?? ""),
        toStepCode: String(transition.ToStepCode ?? ""),
        actionCode: String(transition.ActionCode ?? ""),
        requiredPermission: String(transition.RequiredPermission ?? ""),
      }));
      /* مجوزهای کنش‌گر از موتور RBAC گرفته می‌شود، نه از بدنهٔ درخواست.
       * دلیلش امنیتی است: اگر کلاینت بتواند `ActorPermissions` را خودش بفرستد،
       * می‌تواند هر گذار مشروط به مجوز را برای خودش باز کند. پس این مقدار
       * فقط از نقش‌های واقعی سوژهٔ احراز هویت‌شده محاسبه می‌شود. */
      const actorPermissions = typeof subjectPermissions === "function"
        ? subjectPermissions(req.cmmsSubject)
        : [];

      const advanced = advanceWorkflow({
        definition: { workflowCode: definition.WorkflowCode, startStepCode: definition.StartStepCode, steps, transitions },
        currentStepCode: instance.CurrentStepCode,
        actionCode: oneOf(req.body.ActionCode, "ActionCode", ["submit", "approve", "reject", "assign", "complete", "cancel", "reopen"], { required: true }),
        now: new Date().toISOString(),
        actorPermissions: Array.isArray(actorPermissions) ? actorPermissions : [],
        actorRoles: req.cmmsSubject?.roles ?? [],
        evidenceProvided: bool(req.body.EvidenceProvided, "EvidenceProvided", false),
      });

      const elapsedHours = instance.StartedAt
        ? (Date.now() - new Date(instance.StartedAt).getTime()) / 3600_000
        : null;
      await tx.create("CmmsWorkflowEvent", {
        SiteId: siteId, WorkflowInstanceId: instanceId,
        FromStepCode: instance.CurrentStepCode, ToStepCode: advanced.nextStepCode,
        ActionCode: advanced.transition.actionCode, OccurredAt: new Date().toISOString(),
        ActorId: requestActor(req),
        CommentFa: text(req.body.CommentFa, "CommentFa", { max: 1000 }),
        ElapsedHours: elapsedHours != null ? Math.round(elapsedHours * 1000) / 1000 : null,
        SlaHours: advanced.slaHours,
        IsSlaBreached: elapsedHours != null && advanced.slaHours != null ? elapsedHours > advanced.slaHours : false,
      }, requestActor(req));

      await tx.patch("CmmsWorkflowInstance", instanceId, {
        CurrentStepCode: advanced.nextStepCode,
        State: advanced.terminal ? "completed" : "running",
        CompletedAt: advanced.terminal ? new Date().toISOString() : null,
        DueAt: advanced.dueAt,
        CurrentOwnerId: advanced.nextStep.ownerRole,
      }, requestActor(req), instance.RowVersion);

      await createAuditRecord(tx, req, "CMMS_WORKFLOW_ADVANCED", "CmmsWorkflowInstance", instanceId, "cmms.workflow.view", {
        from: instance.CurrentStepCode, to: advanced.nextStepCode, action: advanced.transition.actionCode,
      });
      return { instance: await tx.get("CmmsWorkflowInstance", instanceId), advanced };
    });
  }));

  /* ───────────────────────── ۱۱. لایهٔ هوش مصنوعی ───────────────────────── */

  /** ثبت یک اجرای AI همراه با پیشنهادها — در یک تراکنش تا نیمه‌کاره نماند. */
  const persistAiRun = async (tx, { req, siteId, engine, subjectEntity, subjectId, input, suggestions, outputSummary, elapsedMilliseconds, status, errorMessageFa }) => {
    const run = await tx.create("CmmsAiRun", {
      SiteId: siteId, Engine: engine, EngineVersion: CMMS_AI_VERSION,
      RanAt: new Date().toISOString(), RanById: requestActor(req),
      SubjectEntity: subjectEntity ?? null, SubjectId: subjectId ?? null,
      InputSnapshotJson: input ?? null,
      OutputSummaryJson: outputSummary ?? null,
      RecommendationCount: suggestions.length,
      ElapsedMilliseconds: elapsedMilliseconds ?? null,
      Status: status ?? "succeeded",
      ErrorMessageFa: errorMessageFa ?? null,
    }, requestActor(req));
    const persisted = [];
    for (const suggestion of suggestions) {
      persisted.push(await tx.create("CmmsAiRecommendation", {
        SiteId: siteId, AiRunId: run.Id, Engine: engine,
        RecommendationType: suggestion.type,
        TitleFa: suggestion.titleFa, ExplanationFa: suggestion.explanationFa,
        Confidence: suggestion.confidence, Priority: suggestion.priority,
        AssetId: suggestion.suggestedValue?.assetId ?? null,
        FamilyId: suggestion.suggestedValue?.familyId ?? null,
        SparePartId: suggestion.suggestedValue?.sparePartId ?? null,
        SuggestedValueJson: suggestion.suggestedValue ?? null,
        EvidenceJson: suggestion.evidence ?? null,
        Status: "proposed",
      }, requestActor(req)));
    }
    await createAuditRecord(tx, req, `CMMS_AI_${engine.toUpperCase().replace(/-/g, "_")}_RUN`, "CmmsAiRun", run.Id, "cmms.ai.run", {
      engine, recommendations: persisted.length,
    });
    return { run, recommendations: persisted };
  };

  app.post(`${ROOT}/ai/failure-analysis`, route("cmms.ai.run", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["Symptoms", "AssetId", "History", "TopN", "Persist"]));
    const started = Date.now();
    const symptoms = Array.isArray(req.body.Symptoms) ? req.body.Symptoms.map((item) => text(item, "Symptoms", { max: 400 })).filter(Boolean) : [];
    if (symptoms.length === 0) throw bad("Symptoms", "دست‌کم یک علامت برای تحلیل لازم است");

    /* تاریخچه: یا از بدنهٔ درخواست می‌آید (حالت آزمایش/واردسازی) یا از
     * پایگاه‌داده ساخته می‌شود. اگر کاربر تاریخچه داد، همان معتبر است. */
    let history = Array.isArray(req.body.History) ? req.body.History : null;
    let historySource = "request";
    const assetId = req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId");
    if (!history) {
      historySource = "database";
      const failures = await listInSite(r, "CmmsFailureRecord", siteId, { limit: 500 });
      const cases = await listInSite(r, "CmmsRcaCase", siteId, { limit: 500 });
      const caseById = new Map(cases.map((item) => [item.Id, item]));
      history = failures.map((failure) => {
        const linkedCase = failure.RcaCaseId ? caseById.get(failure.RcaCaseId) : null;
        return {
          id: failure.Id,
          assetId: failure.AssetId,
          failureMode: failure.FailureMode,
          failureMechanism: failure.FailureMechanism,
          symptoms: [failure.DescriptionFa, linkedCase?.ProblemStatementFa, linkedCase?.RootCauseFa].filter(Boolean),
          rootCauseFa: linkedCase?.RootCauseFa ?? failure.DescriptionFa ?? "",
          resolved: linkedCase ? ["closed", "verified"].includes(linkedCase.Status) : Boolean(failure.RestoredAt),
        };
      });
    }

    const analysis = analyzeFailure({
      symptoms, history, assetId,
      topN: number(req.body.TopN, "TopN", { integer: true, min: 1, max: 20 }) ?? 5,
    });
    const elapsed = Date.now() - started;

    if (!bool(req.body.Persist, "Persist", false)) {
      return { ...analysis, historySource, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted: null };
    }
    return r.transaction(async (tx) => {
      const persisted = await persistAiRun(tx, {
        req, siteId, engine: "failure-analysis", subjectEntity: assetId ? "CmmsAsset" : null, subjectId: assetId,
        input: { symptoms, historySize: history.length, topN: req.body.TopN ?? 5 },
        suggestions: analysis.suggestions,
        outputSummary: { warnings: analysis.warnings, historySize: analysis.historySize },
        elapsedMilliseconds: elapsed,
      });
      return { ...analysis, historySource, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted };
    });
  }, 200));

  app.post(`${ROOT}/ai/pm-optimization`, route("cmms.ai.run", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set([
      "AssetId", "FamilyId", "TtfHours", "Weibull", "PreventiveCost", "FailureCost",
      "MeanRepairHours", "CurrentInterval", "Persist",
    ]));
    const started = Date.now();
    let ttfHours = Array.isArray(req.body.TtfHours) ? req.body.TtfHours.map((value) => number(value, "TtfHours", { min: 0.0001 })) : null;
    let ttfSource = "request";
    if (!ttfHours) {
      ttfSource = "database";
      const assetId = req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId");
      const where = assetId ? [{ column: "AssetId", op: "eq", value: assetId }] : [];
      const failures = await listInSite(r, "CmmsFailureRecord", siteId, { where, limit: 500 });
      ttfHours = failures.map((failure) => failure.RunningHoursBefore).filter((value) => value != null && value > 0);
    }
    const optimization = optimizePmWithAi({
      ttfHours,
      weibull: req.body.Weibull ? {
        beta: number(req.body.Weibull.beta, "Weibull.beta", { required: true, min: 0.0001 }),
        eta: number(req.body.Weibull.eta, "Weibull.eta", { required: true, min: 0.0001 }),
      } : undefined,
      preventiveCost: number(req.body.PreventiveCost, "PreventiveCost", { required: true, min: 0 }),
      failureCost: number(req.body.FailureCost, "FailureCost", { required: true, min: 0 }),
      meanRepairHours: number(req.body.MeanRepairHours, "MeanRepairHours", { required: true, min: 0 }),
      currentInterval: optionalNumber(req.body.CurrentInterval, "CurrentInterval", { min: 0.0001 }),
      assetId: req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId"),
      familyId: req.body.FamilyId === undefined ? null : id(req.body.FamilyId, "FamilyId"),
    });
    const elapsed = Date.now() - started;
    if (!bool(req.body.Persist, "Persist", false)) {
      return { ...optimization, ttfSource, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted: null };
    }
    return r.transaction(async (tx) => {
      const persisted = await persistAiRun(tx, {
        req, siteId, engine: "pm-optimization",
        subjectEntity: req.body.AssetId ? "CmmsAsset" : "CmmsFamily",
        subjectId: req.body.AssetId ? id(req.body.AssetId, "AssetId") : req.body.FamilyId ? id(req.body.FamilyId, "FamilyId") : null,
        input: { ttfSampleSize: ttfHours.length, ttfSource, preventiveCost: req.body.PreventiveCost, failureCost: req.body.FailureCost },
        suggestions: [optimization.suggestion],
        outputSummary: { warnings: optimization.warnings, weibull: optimization.weibull },
        elapsedMilliseconds: elapsed,
      });
      return { ...optimization, ttfSource, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted };
    });
  }, 200));

  app.post(`${ROOT}/ai/repair-guidance`, route("cmms.ai.run", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["FailureMode", "FailureMechanism", "AssetId", "History", "TopN", "Persist"]));
    const started = Date.now();
    const FailureMode = oneOf(req.body.FailureMode, "FailureMode", [...ISO14224_FAILURE_MODES], { required: true });
    const history = Array.isArray(req.body.History) ? req.body.History : null;
    if (!history) throw bad("History", "در این فاز تاریخچهٔ تعمیر باید در بدنهٔ درخواست بیاید؛ استخراج خودکار از دستورکارها در فاز ۲ افزوده می‌شود.");
    const guidance = recommendRepair({
      failureMode: FailureMode,
      failureMechanism: req.body.FailureMechanism === undefined ? null : oneOf(req.body.FailureMechanism, "FailureMechanism", [...ISO14224_FAILURE_MECHANISMS]),
      assetId: req.body.AssetId === undefined ? null : id(req.body.AssetId, "AssetId"),
      history,
      topN: number(req.body.TopN, "TopN", { integer: true, min: 1, max: 10 }) ?? 3,
    });
    const elapsed = Date.now() - started;
    if (!bool(req.body.Persist, "Persist", false)) {
      return { ...guidance, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted: null };
    }
    return r.transaction(async (tx) => {
      const persisted = await persistAiRun(tx, {
        req, siteId, engine: "repair-guidance",
        subjectEntity: req.body.AssetId ? "CmmsAsset" : null,
        subjectId: req.body.AssetId ? id(req.body.AssetId, "AssetId") : null,
        input: { FailureMode, historySize: history.length },
        suggestions: [...guidance.suggestions, ...guidance.spareSuggestions],
        outputSummary: { warnings: guidance.warnings, matchedRecords: guidance.matchedRecords },
        elapsedMilliseconds: elapsed,
      });
      return { ...guidance, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted };
    });
  }, 200));

  app.post(`${ROOT}/ai/tree-generator`, route("cmms.ai.run", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["CatalogText", "EquipmentCode", "EquipmentNameFa", "IndentUnit", "FamilyId", "Persist", "CreateNodes"]));
    const started = Date.now();
    const EquipmentCode = code(req.body.EquipmentCode, "EquipmentCode");
    const generated = generateEquipmentTree({
      catalogText: text(req.body.CatalogText, "CatalogText", { required: true, max: 200000 }),
      equipmentCode: EquipmentCode,
      equipmentNameFa: text(req.body.EquipmentNameFa, "EquipmentNameFa", { max: 240 }),
      indentUnit: number(req.body.IndentUnit, "IndentUnit", { integer: true, min: 1, max: 16 }) ?? 2,
    });
    const elapsed = Date.now() - started;
    const suggestions = generated.nodes.slice(1).map((node) => ({
      type: "tree-node",
      titleFa: node.nameFa,
      explanationFa: `از خط ${node.sourceLine} کاتالوگ با روش «${node.detectedBy}» استخراج شد و سطح مرز «${node.boundaryLevel}» تشخیص داده شد.`,
      confidence: node.confidence,
      priority: node.confidence >= 0.8 ? 2 : node.confidence >= 0.6 ? 3 : 4,
      evidence: [{ kind: "catalog-line", reference: `line:${node.sourceLine}`, detailFa: `خط ${node.sourceLine} کاتالوگ`, weight: node.confidence }],
      suggestedValue: { ...node, equipmentCode: EquipmentCode, familyId: req.body.FamilyId ?? null },
    }));

    if (!bool(req.body.Persist, "Persist", false)) {
      return { ...generated, suggestions, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted: null, createdNodes: 0 };
    }
    return r.transaction(async (tx) => {
      const persisted = await persistAiRun(tx, {
        req, siteId, engine: "tree-generator",
        subjectEntity: req.body.FamilyId ? "CmmsFamily" : null,
        subjectId: req.body.FamilyId ? id(req.body.FamilyId, "FamilyId") : null,
        input: { equipmentCode: EquipmentCode, textLength: String(req.body.CatalogText).length },
        suggestions,
        outputSummary: { warnings: generated.warnings, nodeCount: generated.nodes.length, skippedLines: generated.skippedLines },
        elapsedMilliseconds: elapsed,
      });
      /* ایجاد واقعی گره‌ها فقط با درخواست صریح. پیش‌فرض «فقط پیشنهاد» است تا
       * یک کاتالوگ بد ساختار، درخت خانواده را بی‌اجازه پُر نکند. */
      let createdNodes = 0;
      if (bool(req.body.CreateNodes, "CreateNodes", false)) {
        const familyId = id(req.body.FamilyId, "FamilyId");
        await mustFind(tx, "CmmsFamily", familyId, siteId);
        const codeByGenerated = new Map();
        for (const node of generated.nodes) {
          const ParentNodeId = node.parentNodeCode ? codeByGenerated.get(node.parentNodeCode) ?? null : null;
          const created = await tx.create("CmmsFamilyNode", {
            SiteId: siteId, FamilyId: familyId,
            NodeCode: node.nodeCode, NameFa: node.nameFa,
            BoundaryLevel: node.boundaryLevel, ParentNodeId,
            PathLevel: node.pathLevel, PathCode: node.nodeCode,
            IsMaintainable: node.boundaryLevel !== "equipment",
            SortOrder: node.sourceLine,
          }, requestActor(req));
          codeByGenerated.set(node.nodeCode, created.Id);
          createdNodes += 1;
        }
      }
      return { ...generated, suggestions, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted, createdNodes };
    });
  }, 200));

  app.post(`${ROOT}/ai/smart-scheduler`, route("cmms.ai.run", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["WorkOrders", "Technicians", "Calendar", "HorizonDays", "Now", "Persist"]));
    const started = Date.now();
    const workOrders = Array.isArray(req.body.WorkOrders) ? req.body.WorkOrders : null;
    const technicians = Array.isArray(req.body.Technicians) ? req.body.Technicians : null;
    const calendar = Array.isArray(req.body.Calendar) ? req.body.Calendar : null;
    if (!workOrders) throw bad("WorkOrders", "فهرست دستورکارها الزامی است");
    if (!technicians) throw bad("Technicians", "فهرست تکنسین‌ها الزامی است");
    if (!calendar) throw bad("Calendar", "تقویم کاری الزامی است");

    const normalizedOrders = workOrders.map((order, index) => ({
      id: text(order?.id, `WorkOrders[${index}].id`, { required: true, max: 60 }),
      estimatedHours: number(order?.estimatedHours, `WorkOrders[${index}].estimatedHours`, { required: true, min: 0 }),
      requiredSkill: text(order?.requiredSkill, `WorkOrders[${index}].requiredSkill`, { required: true, max: 60 }),
      requiredSkillLevel: optionalNumber(order?.requiredSkillLevel, `WorkOrders[${index}].requiredSkillLevel`, { integer: true, min: 1, max: 5 }) ?? 1,
      criticalityRank: oneOf(order?.criticalityRank, `WorkOrders[${index}].criticalityRank`, ["A", "B", "C", "D"], { fallback: "C" }),
      isAssetDown: Boolean(order?.isAssetDown),
      productionImpact: oneOf(order?.productionImpact, `WorkOrders[${index}].productionImpact`, ["none", "partial", "line-stop", "plant-stop"], { fallback: "none" }),
      safetyConcern: Boolean(order?.safetyConcern),
      dueDate: isoDate(order?.dueDate, `WorkOrders[${index}].dueDate`, { required: true }),
      preferredWindow: order?.preferredWindow === "production-break" ? "production-break" : "any",
      assetId: order?.assetId ?? undefined,
    }));
    const normalizedTechnicians = technicians.map((technician, index) => ({
      id: text(technician?.id, `Technicians[${index}].id`, { required: true, max: 60 }),
      nameFa: text(technician?.nameFa, `Technicians[${index}].nameFa`, { required: true, max: 240 }),
      skills: Array.isArray(technician?.skills) ? technician.skills.map((skill) => ({
        key: String(skill?.key ?? ""), level: Number(skill?.level ?? 1),
      })) : [],
      dailyCapacityHours: number(technician?.dailyCapacityHours, `Technicians[${index}].dailyCapacityHours`, { required: true, min: 0, max: 24 }),
      unavailableDates: Array.isArray(technician?.unavailableDates) ? technician.unavailableDates : [],
    }));
    const normalizedCalendar = calendar.map((day, index) => ({
      date: isoDate(day?.date, `Calendar[${index}].date`, { required: true }),
      working: Boolean(day?.working),
      isProductionBreak: Boolean(day?.isProductionBreak),
    }));

    const schedule = scheduleWorkOrders({
      workOrders: normalizedOrders,
      technicians: normalizedTechnicians,
      calendar: normalizedCalendar,
      now: req.body.Now ?? undefined,
      horizonDays: number(req.body.HorizonDays, "HorizonDays", { integer: true, min: 1, max: 365 }) ?? 30,
    });
    const elapsed = Date.now() - started;

    const suggestions = schedule.assignments.map((assignment) => ({
      type: "schedule-slot",
      titleFa: `دستورکار ${assignment.workOrderId} ← ${assignment.technicianId} در ${assignment.date}`,
      explanationFa: assignment.reasonFa,
      confidence: 1,
      priority: assignment.priorityScore >= 70 ? 1 : assignment.priorityScore >= 45 ? 2 : 3,
      evidence: [{ kind: "capacity-check", reference: `${assignment.technicianId}#${assignment.date}`, detailFa: `ظرفیت خالی کافی در ${assignment.date}`, weight: 1 }],
      suggestedValue: { ...assignment },
    }));

    if (!bool(req.body.Persist, "Persist", false)) {
      return { ...schedule, suggestions, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted: null };
    }
    return r.transaction(async (tx) => {
      const persisted = await persistAiRun(tx, {
        req, siteId, engine: "smart-scheduler",
        input: { orders: normalizedOrders.length, technicians: normalizedTechnicians.length, days: normalizedCalendar.length },
        suggestions,
        outputSummary: { summary: schedule.summary, warnings: schedule.warnings, unassigned: schedule.unassigned },
        elapsedMilliseconds: elapsed,
      });
      return { ...schedule, suggestions, engineVersion: CMMS_AI_VERSION, elapsedMilliseconds: elapsed, persisted };
    });
  }, 200));

  app.get(`${ROOT}/ai/recommendations`, route("cmms.ai.view", async ({ repo: r, siteId, req }) => {
    assertOnlyQueryKeys(req.query, new Set(["engine", "status", "assetId", "limit", "offset"]));
    const where = [];
    if (req.query.engine !== undefined) {
      where.push({ column: "Engine", op: "eq", value: oneOf(req.query.engine, "engine", ["failure-analysis", "pm-optimization", "repair-guidance", "tree-generator", "smart-scheduler"], { required: true }) });
    }
    if (req.query.status !== undefined) where.push({ column: "Status", op: "eq", value: oneOf(req.query.status, "status", ["proposed", "accepted", "rejected", "applied"], { required: true }) });
    if (req.query.assetId !== undefined) where.push({ column: "AssetId", op: "eq", value: id(req.query.assetId, "assetId") });
    const rows = await listInSite(r, "CmmsAiRecommendation", siteId, {
      where, orderBy: [{ column: "Priority", dir: "asc" }, { column: "Confidence", dir: "desc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 500),
      offset: pageNumber(req.query.offset, "offset", 0, 1_000_000),
    });
    return { recommendations: rows, total: rows.length };
  }));

  app.post(`${ROOT}/ai/recommendations/:recommendationId/decide`, route("cmms.ai.apply", async ({ repo: r, req, siteId }) => {
    assertOnlyKeys(req.body, new Set(["Decision", "DecisionNoteFa"]));
    const recommendationId = id(req.params.recommendationId, "recommendationId");
    const existing = await mustFind(r, "CmmsAiRecommendation", recommendationId, siteId);
    if (existing.Status !== "proposed") throw conflict("CMMS_AI_ALREADY_DECIDED", `این پیشنهاد پیش‌تر «${existing.Status}» شده است`);
    const Decision = oneOf(req.body.Decision, "Decision", ["accept", "reject", "apply"], { required: true });
    const status = Decision === "accept" ? "accepted" : Decision === "reject" ? "rejected" : "applied";
    await r.patch("CmmsAiRecommendation", recommendationId, {
      Status: status,
      DecidedById: requestActor(req),
      DecidedAt: new Date().toISOString(),
      DecisionNoteFa: text(req.body.DecisionNoteFa, "DecisionNoteFa", { max: 1000 }),
    }, requestActor(req), existing.RowVersion);
    await writeAudit(r, req, `CMMS_AI_RECOMMENDATION_${status.toUpperCase()}`, "CmmsAiRecommendation", recommendationId, "cmms.ai.apply", {
      engine: existing.Engine, type: existing.RecommendationType,
    });
    return r.get("CmmsAiRecommendation", recommendationId);
  }));

  /* ───────────────────────── ۱۲. داشبورد ───────────────────────── */

  app.get(`${ROOT}/dashboard`, route("cmms.dashboard.view", async ({ repo: r, req, siteId }) => {
    const [assets, families, workOrders, alerts, failures, spares, reliability, oee, recommendations] = await Promise.all([
      listInSite(r, "CmmsAsset", siteId, { limit: 2000 }),
      listInSite(r, "CmmsFamily", siteId, { limit: 1000 }),
      listInSite(r, "CmmsWorkOrder", siteId, { limit: 2000 }),
      listInSite(r, "CmmsAlert", siteId, { limit: 2000 }),
      listInSite(r, "CmmsFailureRecord", siteId, { limit: 2000 }),
      listInSite(r, "CmmsSparePart", siteId, { limit: 2000 }),
      listInSite(r, "CmmsReliabilitySnapshot", siteId, { orderBy: [{ column: "PeriodEnd", dir: "desc" }], limit: 50 }),
      listInSite(r, "CmmsOeeSnapshot", siteId, { orderBy: [{ column: "PeriodEnd", dir: "desc" }], limit: 50 }),
      listInSite(r, "CmmsAiRecommendation", siteId, { where: [{ column: "Status", op: "eq", value: "proposed" }], limit: 100 }),
    ]);

    const byStatus = workOrders.reduce((acc, order) => { acc[order.Status] = (acc[order.Status] ?? 0) + 1; return acc; }, {});
    const bySeverity = alerts.filter((alert) => alert.Status === "open")
      .reduce((acc, alert) => { acc[alert.Severity] = (acc[alert.Severity] ?? 0) + 1; return acc; }, {});
    const byFailureMode = failures.reduce((acc, failure) => {
      acc[failure.FailureMode] = (acc[failure.FailureMode] ?? 0) + 1; return acc;
    }, {});
    const criticalAssets = assets.filter((asset) => asset.CriticalityRank === "A").length;
    const outOfStock = spares.filter((part) => (part.QtyOnHand ?? 0) <= 0).length;
    const belowReorder = spares.filter((part) => (part.QtyOnHand ?? 0) <= (part.ReorderPoint ?? part.MinStock ?? 0)).length;

    const latestAvailability = reliability.find((snapshot) => snapshot.AvailabilityPct != null);
    const averageOee = oee.length
      ? Math.round((oee.reduce((sum, snapshot) => sum + (snapshot.OeePct ?? 0), 0) / oee.length) * 100) / 100
      : null;

    return {
      counts: {
        assets: assets.length, families: families.length, criticalAssets,
        workOrders: workOrders.length, openAlerts: alerts.filter((alert) => alert.Status === "open").length,
        failures: failures.length, spareParts: spares.length,
        proposedAiRecommendations: recommendations.length,
      },
      workOrdersByStatus: byStatus,
      openAlertsBySeverity: bySeverity,
      failuresByMode: byFailureMode,
      spares: { outOfStock, belowReorder },
      highlights: {
        latestAvailabilityPct: latestAvailability?.AvailabilityPct ?? null,
        latestMtbfHours: latestAvailability?.MtbfHours ?? null,
        latestMttrHours: latestAvailability?.MttrHours ?? null,
        averageOeePct: averageOee,
      },
      modelVersion: CMMS_MODEL_VERSION,
    };
  }));

  return { routes: CMMS_IMPLEMENTED_ROUTES, version: CMMS_API_VERSION };
}
