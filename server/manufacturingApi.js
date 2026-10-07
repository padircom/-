/**
 * MFG v1 HTTP boundary.
 *
 * مسیرهای پایه، آزادسازی سفارش و زمان‌بندی ظرفیت/نمایش Gantt را فعال می‌کند؛
 * سایر commandهای چندجدولی تا پیاده‌سازی مرحله‌ای UoW دامنه‌ای در قرارداد می‌مانند.
 */

import { SchedulePlanningError, planManufacturingSchedule } from "./manufacturingScheduler.js";
import { tablesOfModule } from "./sqlLogic.js";
import {
  analyzeLeadTimeOverlap,
  buildPegging,
  buildTimeBuckets,
  checkAtpPromise,
  computeAvailableToPromise,
  computeCapacityRequirements,
  computeEconomicOrderQuantity,
  computeLeadTimeOffsets,
  computeMasterSchedule,
  computePlannedOrders,
  computeSplitLots,
  isoDateShift,
  LOT_SIZING_RULES,
  resolveProductionVersion,
  MANUFACTURING_PLANNING_MODEL_VERSION,
  resolvePeriodOrderQuantity,
  resolveTransferBatchQty,
  validateLotSizingPolicy,
} from "./mfgPlanLogic.js";

const API_VERSION = "mfg-api-v1";
const ROOT = "/api/mfg/plants/:plantId";
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/;
const PART_TYPES = new Set(["manufactured", "purchased", "phantom", "subcontract"]);
/* `mrp` از بخش ۱۱.۳ اضافه شد: سفارش تولیدی که از تبدیل سفارش برنامه‌ریزی‌شده
 * به وجود آمده باید منشأ MRP خود را در خود رکورد نگه دارد. */
const DEMAND_SOURCES = new Set(["sales-order", "contract", "forecast", "manual", "mrp"]);
const PRIORITY_RULES = new Set(["EDD", "CR", "MANUAL"]);
const DISPATCH_RULES = new Set(["EDD", "SPT", "CR", "WSPT", "FIFO", "MANUAL"]);
const ORDER_STATUSES = new Set(["created", "released", "in-progress", "completed", "closed"]);
const OPERATION_STATUSES = new Set(["pending", "queued", "ready", "setup", "running", "blocked", "completed"]);
const DOWNTIME_TYPES = new Set(["planned", "unplanned"]);
const SCRAP_DISPOSITIONS = new Set(["scrapped", "returned-to-stock", "use-as-is"]);
const REWORK_DISPOSITIONS = new Set(["return-to-operation", "separate-rework-order", "use-as-is"]);
const PROCUREMENT_TYPES = new Set(["make", "buy"]);
const CONSUMPTION_METHODS = new Set(["manual", "backflush", "issue"]);
const ALERT_STATUSES = new Set(["open", "acknowledged", "resolved", "suppressed"]);
const ALERT_SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const COST_ELEMENTS = ["material", "machine", "labor", "overhead", "scrap"];
const BOM_STATUSES = new Set(["draft", "released", "obsolete"]);
const BOM_ISSUE_METHODS = new Set(["manual", "backflush", "kit"]);
const WORK_CENTER_KINDS = new Set(["machine", "labor", "assembly", "inspection"]);
const WORK_CENTER_STATUSES = new Set(["active", "inactive", "maintenance"]);
const RESOURCE_KINDS = new Set(["machine", "labor"]);
const CALENDAR_RULE_TYPES = new Set(["weekly", "date-override"]);
/* بلوک اختیاری `Planning` روی قطعه: هویت کالا از MfgPart می‌آید و ویژگی‌های
 * برنامه‌ریزی مواد (make/buy، LeadTime، LotSize، موجودی افتتاحیه) در همان
 * UoW روی MfgMaterial/MfgInventoryLevel ثبت می‌شود. بدون این بلوک، MRP برای
 * جزئی که ردیف مادهٔ برنامه‌ریزی ندارد بی‌صدا از آن عبور می‌کند و کمبودی
 * گزارش نمی‌شود؛ پس مسیر ساخت ماده باید بخشی از همان قرارداد قطعه باشد. */
const PART_PLANNING_FIELDS = new Set([
  "ProcurementType", "LeadTimeDays", "SafetyStockQty", "LotSize", "OrderMultiple",
  "ShelfLifeDays", "StandardUnitCost", "Currency", "DefaultWarehouseCode", "IsActive",
  "OpeningInventory",
]);
const OPENING_INVENTORY_FIELDS = new Set([
  "WarehouseCode", "LocationCode", "LotNo", "OnHandQty",
  "ReservedQty", "BlockedQty", "InTransitQty", "SafetyStockQty",
]);
/* ─── فاز ۵: MPS، اندازه‌گذاری لات، ATP، تقسیم/هم‌پوشانی ─── */
const DEMAND_TYPES = new Set(["sales-order", "forecast", "contract", "manual"]);
const DEMAND_STATUSES = new Set(["draft", "confirmed", "cancelled"]);
const TIME_BUCKETS = new Set(["day", "week", "month"]);
const ATP_MODES = new Set(["discrete", "cumulative"]);
const SPLIT_LOT_STATUSES = new Set(["planned", "in-progress", "completed", "cancelled"]);
const LOT_POLICY_FIELDS = new Set([
  "PolicyCode", "RuleCode", "FixedLotQty", "OrderMultiple", "MinOrderQty", "MaxOrderQty",
  "OrderingCost", "HoldingCostPerUnitPerYear", "AnnualDemandQty", "PeriodDays",
  "PeriodOrderQuantity", "Currency", "EffectiveFrom", "EffectiveTo", "IsActive", "NoteFa",
]);
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{1,160}$/;
const CURRENCY_RE = /^[A-Z]{3,8}$/;
const MAX_SCHEDULE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_GANTT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export const MANUFACTURING_IMPLEMENTED_ROUTES = Object.freeze([
  `GET ${ROOT}/parts`,
  `POST ${ROOT}/parts`,
  `GET ${ROOT}/parts/:partId`,
  `PATCH ${ROOT}/parts/:partId`,
  `GET ${ROOT}/bom-headers`,
  `POST ${ROOT}/bom-headers`,
  `GET ${ROOT}/bom-headers/:bomId`,
  `PATCH ${ROOT}/bom-headers/:bomId`,
  `GET ${ROOT}/bom-headers/:bomId/items`,
  `POST ${ROOT}/bom-headers/:bomId/items`,
  `PATCH ${ROOT}/bom-items/:itemId`,
  `DELETE ${ROOT}/bom-items/:itemId`,
  `POST ${ROOT}/bom-headers/:bomId/release`,
  `POST ${ROOT}/bom-headers/:bomId/explosions`,
  `GET ${ROOT}/routings`,
  `POST ${ROOT}/routings`,
  `GET ${ROOT}/routings/:routingId`,
  `PATCH ${ROOT}/routings/:routingId`,
  `GET ${ROOT}/routings/:routingId/operations`,
  `POST ${ROOT}/routings/:routingId/operations`,
  `PATCH ${ROOT}/routing-operations/:routingOperationId`,
  `DELETE ${ROOT}/routing-operations/:routingOperationId`,
  `POST ${ROOT}/routings/:routingId/release`,
  `GET ${ROOT}/work-centers`,
  `POST ${ROOT}/work-centers`,
  `GET ${ROOT}/work-centers/:workCenterId`,
  `PATCH ${ROOT}/work-centers/:workCenterId`,
  `GET ${ROOT}/work-centers/:workCenterId/resources`,
  `POST ${ROOT}/work-centers/:workCenterId/resources`,
  `PATCH ${ROOT}/work-center-resources/:resourceId`,
  `GET ${ROOT}/work-centers/:workCenterId/calendars`,
  `POST ${ROOT}/work-centers/:workCenterId/calendars`,
  `PATCH ${ROOT}/work-center-calendars/:calendarId`,
  `GET ${ROOT}/orders`,
  `POST ${ROOT}/orders`,
  `GET ${ROOT}/orders/:orderId`,
  `PATCH ${ROOT}/orders/:orderId/priority`,
  `POST ${ROOT}/orders/:orderId/release`,
  `POST ${ROOT}/orders/:orderId/close`,
  `POST ${ROOT}/scheduling/runs`,
  `POST ${ROOT}/scheduling/reschedules`,
  `GET ${ROOT}/scheduling/gantt`,
  `GET ${ROOT}/capacity/load`,
  `GET ${ROOT}/capacity/bottlenecks`,
  `GET ${ROOT}/operation-queue`,
  `POST ${ROOT}/operations/:operationId/executions`,
  `POST ${ROOT}/executions/:executionId/reports`,
  `POST ${ROOT}/executions/:executionId/finish`,
  `POST ${ROOT}/downtime`,
  `POST ${ROOT}/scrap`,
  `POST ${ROOT}/rework`,
  `GET ${ROOT}/operations/:operationId/variance`,
  `GET ${ROOT}/materials`,
  `POST ${ROOT}/mrp/calculate`,
  `GET ${ROOT}/mrp/shortages`,
  `POST ${ROOT}/material-consumptions`,
  `POST ${ROOT}/material-procurement-proposals`,
  `GET ${ROOT}/cost/orders/:orderId`,
  `GET ${ROOT}/cost/operations/:operationId`,
  `POST ${ROOT}/cost/orders/:orderId/reconcile`,
  `GET ${ROOT}/dashboard/overview`,
  `GET ${ROOT}/dashboard/work-center-load`,
  `GET ${ROOT}/dashboard/oee`,
  `GET ${ROOT}/alerts`,
  `POST ${ROOT}/alerts/:alertId/acknowledgements`,
  /* فاز ۵ — مدیریت تقاضا و پیش‌بینی فروش (۵ مسیر) */
  `GET ${ROOT}/demand-forecasts`,
  `POST ${ROOT}/demand-forecasts`,
  `PATCH ${ROOT}/demand-forecasts/:demandId`,
  `DELETE ${ROOT}/demand-forecasts/:demandId`,
  `GET ${ROOT}/demand/time-phased`,
  /* فاز ۵ — قواعد اندازه‌گذاری لات (۴ مسیر) */
  `GET ${ROOT}/lot-sizing-policies`,
  `POST ${ROOT}/lot-sizing-policies`,
  `PATCH ${ROOT}/lot-sizing-policies/:policyId`,
  `POST ${ROOT}/lot-sizing/evaluate`,
  /* فاز ۵ — برنامهٔ اصلی تولید MPS (۵ مسیر) */
  `POST ${ROOT}/mps/runs`,
  `GET ${ROOT}/mps/runs`,
  `GET ${ROOT}/mps/runs/:runId`,
  `GET ${ROOT}/mps/runs/:runId/lines`,
  `POST ${ROOT}/mps/runs/:runId/firm`,
  `POST ${ROOT}/mps/runs/:runId/approve`,
  /* فاز ۵ بخش ۱۱ — نسخهٔ تولید (۴ مسیر) */
  `GET ${ROOT}/production-versions`,
  `POST ${ROOT}/production-versions`,
  `PATCH ${ROOT}/production-versions/:versionId`,
  `GET ${ROOT}/parts/:partId/production-version`,
  /* فاز ۵ بخش ۱۱ — سفارش برنامه‌ریزی‌شده (۶ مسیر) */
  `GET ${ROOT}/planned-orders`,
  `GET ${ROOT}/planned-orders/:plannedOrderId`,
  `PATCH ${ROOT}/planned-orders/:plannedOrderId`,
  `POST ${ROOT}/planned-orders/:plannedOrderId/approve`,
  `POST ${ROOT}/planned-orders/:plannedOrderId/reject`,
  `POST ${ROOT}/planned-orders/:plannedOrderId/convert`,
  /* فاز ۵ بخش ۱۱ — CRP (۲ مسیر)، گزارش MRP (۲ مسیر) و انطباق ISA-95 (۱ مسیر) */
  `POST ${ROOT}/crp/calculate`,
  `GET ${ROOT}/crp/summary`,
  `GET ${ROOT}/mrp/lead-time-offset`,
  `GET ${ROOT}/mrp/pegging`,
  `GET ${ROOT}/conformance/isa95`,
  /* فاز ۵ — قابلیت تعهد تحویل ATP (۳ مسیر) */
  `POST ${ROOT}/atp/checks`,
  `GET ${ROOT}/atp/checks`,
  `GET ${ROOT}/atp/summary`,
  /* فاز ۵ — تقسیم و هم‌پوشانی عملیات (۴ مسیر) */
  `GET ${ROOT}/orders/:orderId/operations/:operationId/splits`,
  `POST ${ROOT}/orders/:orderId/operations/:operationId/splits`,
  `DELETE ${ROOT}/operation-splits/:splitLotId`,
  `GET ${ROOT}/orders/:orderId/lead-time-analysis`,
]);

class MfgApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const bad = (field, message) => new MfgApiError(400, "MFG_VALIDATION_FAILED", message, { field });
const forbidden = (permission, message = "مجوز یا دامنهٔ کارخانه برای این عمل وجود ندارد") =>
  new MfgApiError(403, "MFG_FORBIDDEN", message, { permission });
const notFound = () => new MfgApiError(404, "MFG_NOT_FOUND", "رکورد در کارخانهٔ جاری یافت نشد");
const conflict = (code, message) => new MfgApiError(409, code, message);
const businessRule = (code, message, details = {}) => new MfgApiError(422, code, message, details);

function text(value, field, { required = false, max = 240, pattern } = {}) {
  if (value === undefined || value === null) {
    if (required) throw bad(field, `«${field}» الزامی است`);
    return null;
  }
  if (typeof value !== "string") throw bad(field, `«${field}» باید رشته باشد`);
  const out = value.trim();
  if (!out) {
    if (required) throw bad(field, `«${field}» الزامی است`);
    return null;
  }
  if (out.length > max) throw bad(field, `«${field}» حداکثر ${max} نویسه است`);
  if (pattern && !pattern.test(out)) throw bad(field, `«${field}» قالب معتبری ندارد`);
  return out;
}

function number(value, field, { required = false, min = -Infinity, max = Infinity, integer = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw bad(field, `«${field}» الزامی است`);
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < min || value > max) {
    throw bad(field, `«${field}» باید عدد معتبر در بازهٔ مجاز باشد`);
  }
  return value;
}

function parseDispatchWeight(value, field = "DispatchWeight") {
  const parsed = number(value, field, { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
  const normalized = Math.round((parsed + Number.EPSILON) * 10_000) / 10_000;
  if (normalized <= 0) throw bad(field, "DispatchWeight باید پس از دقت ذخیره‌سازی همچنان مثبت باشد");
  return normalized;
}

function bool(value, field, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw bad(field, `«${field}» باید true یا false باشد`);
  return value;
}

function isoDate(value, field, { required = false } = {}) {
  const out = text(value, field, { required, max: 10 });
  if (out === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(out);
  if (!match) throw bad(field, `«${field}» باید تاریخ YYYY-MM-DD باشد`);
  const [, year, month, day] = match.map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
    throw bad(field, `تاریخ داخل «${field}» معتبر نیست`);
  }
  return out;
}

function isoDateTime(value, field, { required = false } = {}) {
  const out = text(value, field, { required, max: 40 });
  if (out === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T.+(?:Z|[+-]\d{2}:\d{2})$/.exec(out);
  if (!match || !Number.isFinite(Date.parse(out))) throw bad(field, `«${field}» باید زمان ISO-8601 همراه با timezone باشد`);
  const [, year, month, day] = match.map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
    throw bad(field, `تاریخ داخل «${field}» معتبر نیست`);
  }
  return new Date(out).toISOString();
}

const localDayFormatterCache = new Map();

function storedTimestamp(value) {
  return value instanceof Date ? value.getTime() : Date.parse(value ?? "");
}

function storedIsoTimestamp(value) {
  const timestamp = storedTimestamp(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function storedNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundTo3(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

const WORK_CENTER_RATE_FIELDS = new Set([
  "CostElement", "HourlyRate", "Currency", "AllocationBasis", "EffectiveFrom", "EffectiveTo", "Code", "NameFa",
]);
const ALLOCATION_BASES = new Set(["machine_hours", "labor_hours", "units", "percent"]);

/**
 * اعتبارسنجی بلوک اختیاری `Rates` روی `POST /work-centers`.
 * هر ردیف یک مرکز هزینهٔ نرخی برای یکی از عناصر machine|labor|overhead می‌سازد.
 */
function parseWorkCenterRates(raw, { code }) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw bad("Rates", "Rates باید آرایه باشد");
  if (raw.length > 3) throw bad("Rates", "حداکثر سه ردیف نرخ (machine/labor/overhead) پذیرفته می‌شود");
  const seen = new Set();
  return raw.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw bad(`Rates[${index}]`, "هر ردیف Rates باید یک شیء باشد");
    assertOnlyKeys(item, WORK_CENTER_RATE_FIELDS);
    const element = text(item.CostElement, `Rates[${index}].CostElement`, { required: true, max: 16 });
    if (!["machine", "labor", "overhead"].includes(element)) {
      throw bad(`Rates[${index}].CostElement`, "CostElement باید machine/labor/overhead باشد");
    }
    if (seen.has(element)) throw bad("Rates", `عنصر ${element} تکراری است`);
    seen.add(element);
    const hourlyRate = number(item.HourlyRate, `Rates[${index}].HourlyRate`, { required: true, min: 0 });
    const currency = text(item.Currency ?? "IRR", `Rates[${index}].Currency`, { required: true, max: 8, pattern: CURRENCY_RE });
    const allocationBasis = text(
      item.AllocationBasis ?? (element === "labor" ? "labor_hours" : "machine_hours"),
      `Rates[${index}].AllocationBasis`,
      { required: true, max: 20 },
    );
    if (!ALLOCATION_BASES.has(allocationBasis)) {
      throw bad(`Rates[${index}].AllocationBasis`, "AllocationBasis باید machine_hours/labor_hours/units/percent باشد");
    }
    const effectiveFrom = isoDate(item.EffectiveFrom ?? "2026-01-01", `Rates[${index}].EffectiveFrom`, { required: true });
    const effectiveTo = item.EffectiveTo === undefined || item.EffectiveTo === null
      ? null
      : isoDate(item.EffectiveTo, `Rates[${index}].EffectiveTo`, { required: true });
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw bad(`Rates[${index}].EffectiveTo`, "EffectiveTo نباید پیش از EffectiveFrom باشد");
    }
    return {
      Code: text(item.Code ?? `${code}-${element.toUpperCase()}`, `Rates[${index}].Code`, { required: true, max: 60, pattern: CODE_RE }),
      NameFa: text(item.NameFa ?? `نرخ ${element}` , `Rates[${index}].NameFa`, { required: true, max: 240 }),
      CostElement: element,
      HourlyRate: hourlyRate,
      Currency: currency,
      AllocationBasis: allocationBasis,
      EffectiveFrom: effectiveFrom,
      EffectiveTo: effectiveTo,
    };
  });
}

function localDateAt(timestamp, timeZone) {
  let formatter = localDayFormatterCache.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      throw businessRule("MFG_WORK_CENTER_TIMEZONE_INVALID", `منطقهٔ زمانی مرکز کاری «${timeZone}» معتبر نیست`);
    }
    localDayFormatterCache.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
  return `${String(parts.year).padStart(4, "0")}-${parts.month}-${parts.day}`;
}

function isoWeekStart(date) {
  const day = new Date(`${date}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

function pageNumber(value, field, fallback, max) {
  if (value === undefined || value === "") return fallback;
  if (!/^[0-9]+$/.test(String(value))) throw bad(field, `«${field}» باید عدد صحیح نامنفی باشد`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0 || result > max) throw bad(field, `«${field}» بیرون از بازهٔ مجاز است`);
  return result;
}

function assertOnlyKeys(body, allowed) {
  const unknown = Object.keys(body ?? {}).filter((key) => !allowed.has(key));
  if (unknown.length) throw new MfgApiError(400, "MFG_UNKNOWN_FIELDS", "فیلدهای غیرمجاز در درخواست وجود دارد", { fields: unknown });
}

function assertOnlyQueryKeys(query, allowed) {
  const unknown = Object.keys(query ?? {}).filter((key) => !allowed.has(key));
  if (unknown.length) throw new MfgApiError(400, "MFG_UNKNOWN_QUERY", "پارامترهای query ناشناخته‌اند", { fields: unknown });
}

function rowVersionFrom(req) {
  const raw = String(req.headers?.["if-match"] ?? "").trim();
  const match = /^(?:W\/)?"?([1-9][0-9]*)"?$/.exec(raw);
  if (!match) throw new MfgApiError(428, "MFG_IF_MATCH_REQUIRED", "هدر If-Match با RowVersion خوانده‌شده الزامی است");
  const version = Number(match[1]);
  if (!Number.isSafeInteger(version)) throw bad("If-Match", "نسخهٔ رکورد معتبر نیست");
  return version;
}

function idempotencyKeyFrom(req) {
  const raw = String(req.headers?.["idempotency-key"] ?? "").trim();
  if (!raw) throw bad("Idempotency-Key", "هدر Idempotency-Key الزامی است");
  if (!IDEMPOTENCY_KEY_RE.test(raw)) throw bad("Idempotency-Key", "هدر Idempotency-Key قالب معتبری ندارد");
  return raw;
}

async function resolveIdempotentAuditReplay(tx, {
  idempotencyKey,
  plantId,
  action,
  entityName,
  fingerprint,
}) {
  const [existingExecutionKeys, existingConsumptionKeys] = await Promise.all([
    tx.list("MfgOperationExecution", {
      where: [{ column: "IdempotencyKey", op: "eq", value: idempotencyKey }],
      limit: 1,
    }),
    tx.list("MfgMaterialConsumption", {
      where: [{ column: "IdempotencyKey", op: "eq", value: idempotencyKey }],
      limit: 1,
    }),
  ]);
  if (existingExecutionKeys.length > 0 && action !== "MFG_EXECUTION_STARTED") {
    throw conflict("MFG_IDEMPOTENCY_CONFLICT", "کلید Idempotency-Key قبلاً برای درخواست دیگری مصرف شده است");
  }
  if (existingConsumptionKeys.length > 0 && action !== "MFG_MATERIAL_CONSUMED") {
    throw conflict("MFG_IDEMPOTENCY_CONFLICT", "کلید Idempotency-Key قبلاً برای درخواست دیگری مصرف شده است");
  }
  const auditRows = await tx.list("AuditLog", {});
  const matchedAudit = auditRows.find((row) => row?.Details?.idempotencyKey === idempotencyKey);
  if (!matchedAudit) return null;
  if (
    matchedAudit.Action !== action
    || matchedAudit.EntityName !== entityName
    || matchedAudit.Details?.plantId !== plantId
    || matchedAudit.Details?.idempotencyFingerprint !== fingerprint
  ) {
    throw conflict("MFG_IDEMPOTENCY_CONFLICT", "کلید Idempotency-Key قبلاً برای درخواست دیگری مصرف شده است");
  }
  const existingEntity = await tx.get(entityName, matchedAudit.EntityId);
  if (!existingEntity) {
    throw conflict("MFG_IDEMPOTENCY_CONFLICT", "کلید Idempotency-Key قبلاً مصرف شده اما رکورد مقصد یافت نشد");
  }
  return existingEntity;
}

function requestActor(req) {
  return req.mfgSubject.id;
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
    Details: { plantId: req.mfgPlantId, traceId: req.requestId, ...extra },
  }, requestActor(req));
}

async function writeAudit(repo, req, action, entityName, entityId, permission) {
  try {
    await createAuditRecord(repo, req, action, entityName, entityId, permission);
  } catch (err) {
    // مسیرهای تک‌جدولی فعلی best-effort هستند؛ فرمان چندجدولی Audit را در همان UoW می‌نویسد.
    console.error("[%s] MFG audit write failed for %s", req.requestId, action, err?.message);
  }
}

function protectProjectLink(_subject, row, _evaluate) {
  return row;
}

/* ─────────── بلوک اختیاری Planning روی قطعه (مادهٔ برنامه‌ریزی + موجودی افتتاحیه) ─────────── */

/** نوع تأمین پیش‌فرض از نوع قطعه مشتق می‌شود تا ماده بدون تصمیم دستی هم قابل برنامه‌ریزی باشد. */
function defaultProcurementType(partType) {
  return partType === "purchased" ? "buy" : "make";
}

function optionalNumber(value, field, opts = {}) {
  if (value === undefined || value === null) return null;
  return number(value, field, opts);
}

/**
 * اعتبارسنجی بلوک `Planning` روی `POST/PATCH /parts`.
 * خروجی نرمال‌شده: `{ material, openingInventory }` — نبودن بلوک یعنی `null`.
 */
function parsePartPlanning(raw, { partType, standardUnitCost, currency }) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw bad("Planning", "Planning باید یک شیء باشد");
  assertOnlyKeys(raw, PART_PLANNING_FIELDS);

  let procurementType = raw.ProcurementType === undefined
    ? defaultProcurementType(partType)
    : text(raw.ProcurementType, "Planning.ProcurementType", { required: true, max: 8 });
  if (!PROCUREMENT_TYPES.has(procurementType)) throw bad("Planning.ProcurementType", "ProcurementType باید make یا buy باشد");

  const leadTimeDays = optionalNumber(raw.LeadTimeDays, "Planning.LeadTimeDays", { min: 0, integer: true }) ?? 0;
  const safetyStockQty = optionalNumber(raw.SafetyStockQty, "Planning.SafetyStockQty", { min: 0 }) ?? 0;
  const lotSize = optionalNumber(raw.LotSize, "Planning.LotSize", { min: Number.MIN_VALUE }) ?? 1;
  const orderMultiple = optionalNumber(raw.OrderMultiple, "Planning.OrderMultiple", { min: Number.MIN_VALUE }) ?? 1;
  const shelfLifeDays = optionalNumber(raw.ShelfLifeDays, "Planning.ShelfLifeDays", { min: 0, integer: true });
  const planningCost = optionalNumber(raw.StandardUnitCost, "Planning.StandardUnitCost", { min: 0 });
  const unitCost = planningCost ?? standardUnitCost ?? null;
  const planningCurrency = raw.Currency === undefined
    ? (currency || "IRR")
    : text(raw.Currency, "Planning.Currency", { required: true, max: 8, pattern: CURRENCY_RE });
  const defaultWarehouseCode = text(raw.DefaultWarehouseCode, "Planning.DefaultWarehouseCode", { max: 40, pattern: CODE_RE });
  const isActive = raw.IsActive === undefined ? true : bool(raw.IsActive, "Planning.IsActive");

  const material = {
    ProcurementType: procurementType,
    LeadTimeDays: leadTimeDays,
    SafetyStockQty: safetyStockQty,
    LotSize: lotSize,
    OrderMultiple: orderMultiple,
    ShelfLifeDays: shelfLifeDays,
    StandardUnitCost: unitCost,
    Currency: planningCurrency,
    DefaultWarehouseCode: defaultWarehouseCode || null,
    IsActive: isActive,
  };

  const rawOpening = raw.OpeningInventory;
  let openingInventory = null;
  if (rawOpening !== undefined && rawOpening !== null) {
    if (typeof rawOpening !== "object" || Array.isArray(rawOpening)) throw bad("Planning.OpeningInventory", "OpeningInventory باید یک شیء باشد");
    assertOnlyKeys(rawOpening, OPENING_INVENTORY_FIELDS);
    const warehouseCode = text(rawOpening.WarehouseCode, "Planning.OpeningInventory.WarehouseCode", { required: true, max: 40, pattern: CODE_RE });
    const locationCode = text(rawOpening.LocationCode, "Planning.OpeningInventory.LocationCode", { max: 40, pattern: CODE_RE });
    const lotNo = text(rawOpening.LotNo, "Planning.OpeningInventory.LotNo", { max: 60, pattern: CODE_RE });
    const onHandQty = number(rawOpening.OnHandQty, "Planning.OpeningInventory.OnHandQty", { required: true, min: Number.MIN_VALUE });
    const reservedQty = optionalNumber(rawOpening.ReservedQty, "Planning.OpeningInventory.ReservedQty", { min: 0 }) ?? 0;
    const blockedQty = optionalNumber(rawOpening.BlockedQty, "Planning.OpeningInventory.BlockedQty", { min: 0 }) ?? 0;
    const inTransitQty = optionalNumber(rawOpening.InTransitQty, "Planning.OpeningInventory.InTransitQty", { min: 0 }) ?? 0;
    const invSafetyStock = optionalNumber(rawOpening.SafetyStockQty, "Planning.OpeningInventory.SafetyStockQty", { min: 0 }) ?? safetyStockQty;
    if (roundTo3(reservedQty + blockedQty) > roundTo3(onHandQty)) {
      throw bad("Planning.OpeningInventory.OnHandQty", "ReservedQty + BlockedQty نباید از OnHandQty بیشتر باشد");
    }
    openingInventory = {
      WarehouseCode: warehouseCode,
      LocationCode: locationCode || null,
      LotNo: lotNo || null,
      OnHandQty: onHandQty,
      ReservedQty: reservedQty,
      BlockedQty: blockedQty,
      InTransitQty: inTransitQty,
      SafetyStockQty: invSafetyStock,
    };
  }

  return { material, openingInventory };
}

/**
 * درج/به‌روزرسانی مادهٔ برنامه‌ریزی و (در صورت ارسال) موجودی افتتاحیه در همان
 * تراکنش قطعه. موجودی افتتاحیه فقط یک‌بار درج می‌شود؛ تکرار همان کلید، موجودی
 * موجود را دست‌نخورده برمی‌گرداند تا فراخوانی دوبارهٔ همان درخواست، انبار را
 * دو برابر نکند. تغییر موجودی پس از افتتاح فقط از مسیر مصرف/دریافت مجاز است.
 */
async function persistPartPlanning(tx, { plantId, partId, partType, planning, subjectId }) {
  const existing = await tx.findOne("MfgMaterial", [
    { column: "PlantId", op: "eq", value: plantId },
    { column: "PartId", op: "eq", value: partId },
  ]);

  let material;
  if (existing) {
    const patch = await tx.patch("MfgMaterial", existing.Id, planning.material, subjectId, existing.RowVersion);
    if (!patch.ok) throw conflict("MFG_CONFLICT", "مادهٔ برنامه‌ریزی هم‌زمان تغییر کرده است");
    material = await tx.get("MfgMaterial", existing.Id);
  } else {
    material = await tx.create("MfgMaterial", {
      PlantId: plantId,
      PartId: partId,
      ...planning.material,
    }, subjectId);
  }

  let inventory = null;
  if (planning.openingInventory) {
    const lotNo = planning.openingInventory.LotNo ?? "";
    const locationCode = planning.openingInventory.LocationCode ?? "";
    const inventoryKey = `${material.Id}|${planning.openingInventory.WarehouseCode}|${locationCode}|${lotNo}`;
    const already = await tx.findOne("MfgInventoryLevel", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "InventoryKey", op: "eq", value: inventoryKey },
    ]);
    inventory = already ?? await tx.create("MfgInventoryLevel", {
      PlantId: plantId,
      MaterialId: material.Id,
      InventoryKey: inventoryKey,
      ...planning.openingInventory,
      AsOfAt: new Date().toISOString(),
    }, subjectId);
  }

  return { material, inventory, defaultProcurementType: defaultProcurementType(partType) };
}

/* ─────────── رول‌آپ هزینهٔ عملیات از دادهٔ واقعی کارگاه ─────────── */
function costVariance(actual, basis) {
  return roundTo3(storedNumber(actual) - storedNumber(basis));
}

function costVariancePct(actual, basis) {
  const denominator = storedNumber(basis);
  return denominator > 0 ? roundTo3((costVariance(actual, denominator) / denominator) * 100) : null;
}

function enrichOperationCostRow(row) {
  const standardAmount = roundTo3(storedNumber(row.StandardAmount));
  const plannedAmount = roundTo3(storedNumber(row.PlannedAmount, standardAmount));
  const actualAmount = roundTo3(storedNumber(row.ActualAmount));
  const standardQty = roundTo3(storedNumber(row.StandardQuantity));
  const plannedQty = roundTo3(storedNumber(row.PlannedQuantity, standardQty));
  const actualQty = roundTo3(storedNumber(row.ActualQuantity));
  return {
    ...row,
    StandardQuantity: standardQty,
    PlannedQuantity: plannedQty,
    ActualQuantity: actualQty,
    StandardAmount: standardAmount,
    PlannedAmount: plannedAmount,
    ActualAmount: actualAmount,
    CostVariance: costVariance(actualAmount, standardAmount),
    CostVariancePct: costVariancePct(actualAmount, standardAmount),
    PlannedCostVariance: costVariance(actualAmount, plannedAmount),
    PlannedCostVariancePct: costVariancePct(actualAmount, plannedAmount),
  };
}

function assertSingleCostCurrency(rows, fallback = "IRR") {
  const currencies = new Set(rows
    .filter((row) => Math.abs(storedNumber(row.StandardAmount)) > 0.000001
      || Math.abs(storedNumber(row.PlannedAmount, storedNumber(row.StandardAmount))) > 0.000001
      || Math.abs(storedNumber(row.ActualAmount)) > 0.000001)
    .map((row) => String(row.Currency ?? fallback).toUpperCase()));
  if (currencies.size > 1) {
    throw businessRule("MFG_COST_CURRENCY_MISMATCH", "هزینه‌های سفارش چند ارز دارند و بدون نرخ تبدیل نمی‌توان آن‌ها را با هم جمع زد");
  }
  return currencies.values().next().value ?? String(rows[0]?.Currency ?? fallback).toUpperCase();
}

function rollupCostElements(rows) {
  const elements = ["material", "machine", "labor", "overhead", "scrap"];
  const totals = Object.fromEntries(elements.map((element) => [element, { standard: 0, planned: 0, actual: 0 }]));
  for (const raw of rows) {
    const row = enrichOperationCostRow(raw);
    const bucket = totals[row.CostElement];
    if (!bucket) continue;
    bucket.standard = roundTo3(bucket.standard + row.StandardAmount);
    bucket.planned = roundTo3(bucket.planned + row.PlannedAmount);
    bucket.actual = roundTo3(bucket.actual + row.ActualAmount);
  }
  for (const bucket of Object.values(totals)) {
    bucket.costVariance = costVariance(bucket.actual, bucket.standard);
    bucket.costVariancePct = costVariancePct(bucket.actual, bucket.standard);
    bucket.plannedCostVariance = costVariance(bucket.actual, bucket.planned);
    bucket.plannedCostVariancePct = costVariancePct(bucket.actual, bucket.planned);
  }
  return totals;
}

function summarizeCostRows(rows) {
  const enrichedRows = rows.map(enrichOperationCostRow);
  const byElement = rollupCostElements(enrichedRows);
  const sum = (key) => roundTo3(Object.values(byElement).reduce((total, element) => total + storedNumber(element[key]), 0));
  const standardTotalCost = sum("standard");
  const plannedTotalCost = sum("planned");
  const actualTotalCost = sum("actual");
  return {
    byElement,
    standardTotalCost,
    plannedTotalCost,
    actualTotalCost,
    costVariance: costVariance(actualTotalCost, standardTotalCost),
    costVariancePct: costVariancePct(actualTotalCost, standardTotalCost),
    plannedCostVariance: costVariance(actualTotalCost, plannedTotalCost),
    plannedCostVariancePct: costVariancePct(actualTotalCost, plannedTotalCost),
    currency: assertSingleCostCurrency(enrichedRows),
    rows: enrichedRows,
  };
}

function operationCostBreakdown(operations, rows) {
  const rowsByOperation = new Map();
  for (const row of rows) {
    const list = rowsByOperation.get(row.ProductionOrderOperationId) ?? [];
    list.push(enrichOperationCostRow(row));
    rowsByOperation.set(row.ProductionOrderOperationId, list);
  }
  return operations.map((operation) => {
    const opRows = rowsByOperation.get(operation.Id) ?? [];
    const summary = summarizeCostRows(opRows);
    return {
      OperationId: operation.Id,
      SequenceNo: operation.SequenceNo,
      OperationCode: operation.OperationCode,
      OperationNameFa: operation.OperationNameFa,
      WorkCenterId: operation.WorkCenterId,
      Status: operation.Status,
      Currency: summary.currency,
      StandardTotalCost: summary.standardTotalCost,
      PlannedTotalCost: summary.plannedTotalCost,
      ActualTotalCost: summary.actualTotalCost,
      CostVariance: summary.costVariance,
      CostVariancePct: summary.costVariancePct,
      PlannedCostVariance: summary.plannedCostVariance,
      PlannedCostVariancePct: summary.plannedCostVariancePct,
      ByElement: summary.byElement,
    };
  });
}

function completeOperationCostRows(operations, storedRows, derivedRows) {
  const storedByKey = new Map();
  for (const row of storedRows) storedByKey.set(`${row.ProductionOrderOperationId}\u0000${row.CostElement}`, row);
  const derivedByKey = new Map();
  for (const row of derivedRows) derivedByKey.set(`${row.ProductionOrderOperationId}\u0000${row.CostElement}`, row);
  const result = [];
  let usedDerived = false;
  for (const operation of operations) {
    for (const element of COST_ELEMENTS) {
      const key = `${operation.Id}\u0000${element}`;
      const stored = storedByKey.get(key);
      const derived = derivedByKey.get(key);
      if (stored) result.push(enrichOperationCostRow(stored));
      else if (derived) {
        result.push(enrichOperationCostRow(derived));
        usedDerived = true;
      }
    }
  }
  return { rows: result, derived: usedDerived || result.length === 0 };
}

function isAtOrBefore(value, throughMs) {
  if (throughMs === null || throughMs === undefined) return true;
  const timestamp = storedTimestamp(value);
  return Number.isFinite(timestamp) && timestamp <= throughMs;
}

function chooseRateCostCenter(costCenters, { plantId, preferredId, workCenter, element, effectiveAt }) {
  const effectiveDate = dateOnly(effectiveAt) ?? new Date().toISOString().slice(0, 10);
  const active = costCenters.filter((row) => row.PlantId === plantId
    && row.CostElement === element
    && row.IsActive !== false
    && effectiveOn(row, effectiveDate));
  const preferred = preferredId ? active.find((row) => row.Id === preferredId) : null;
  if (preferred) return preferred;
  if (workCenter?.Code) {
    const exactCode = `${workCenter.Code}-${element.toUpperCase()}`;
    const sameCenterRates = active.filter((row) => String(row.Code ?? "").toUpperCase() === exactCode.toUpperCase()
      || String(row.Code ?? "").toUpperCase().startsWith(`${String(workCenter.Code).toUpperCase()}-`));
    if (sameCenterRates.length) {
      sameCenterRates.sort((left, right) => String(dateOnly(right.EffectiveFrom) ?? "").localeCompare(String(dateOnly(left.EffectiveFrom) ?? "")));
      return sameCenterRates[0];
    }
  }
  active.sort((left, right) => String(dateOnly(right.EffectiveFrom) ?? "").localeCompare(String(dateOnly(left.EffectiveFrom) ?? ""))
    || String(left.Id).localeCompare(String(right.Id)));
  return active[0] ?? null;
}

function assertSingleCurrencyAmounts(items, fallback = "IRR") {
  const currencies = new Set(items
    .filter((item) => Math.abs(storedNumber(item.amount)) > 0.000001)
    .map((item) => String(item.currency ?? fallback).toUpperCase()));
  if (currencies.size > 1) {
    throw businessRule("MFG_COST_CURRENCY_MISMATCH", "هزینهٔ یک عنصر در چند ارز ثبت شده است؛ ابتدا ارزها را یکسان‌سازی کنید");
  }
  return currencies.values().next().value
    ?? String(items.find((item) => item.currency)?.currency ?? fallback).toUpperCase();
}

/**
 * رول‌آپ هزینهٔ یک مجموعه Operation با تفکیک استاندارد، برنامه‌ریزی‌شده و واقعی.
 * استاندارد مواد از GrossQuantity و برنامه از NetQuantity (شامل allowance ضایعات)
 * می‌آید؛ هزینهٔ واقعی از تراکنش مصرف و زمان/نرخ واقعی اجرا محاسبه می‌شود.
 */
async function deriveOperationCostRows(db, { plantId, operations, costVersion = 1, asOf = null }) {
  if (!Array.isArray(operations) || operations.length === 0) return [];
  const [consumptions, requirements, parts, materials, workCenters, costCenters, executions, scrapRecords, orders, schedules] = await Promise.all([
    db.list("MfgMaterialConsumption", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgMaterialRequirement", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgCostCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgOperationExecution", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgScrapRecord", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgOperationSchedule", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
  ]);
  const throughMs = asOf ? Date.parse(asOf) : null;
  const operationIds = new Set(operations.filter((row) => row.PlantId === plantId).map((row) => row.Id));
  const orderById = new Map(orders.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));
  const materialById = new Map(materials.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));
  const partById = new Map(parts.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));
  const centerById = new Map(workCenters.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));

  const requirementByOperation = new Map();
  const latestRequirementByKey = new Map();
  for (const row of requirements) {
    if (row.PlantId !== plantId || !operationIds.has(row.ProductionOrderOperationId) || row.Status === "cancelled") continue;
    if (!isAtOrBefore(row.RequiredAt, throughMs)) continue;
    const stableKey = String(row.RequirementKey ?? row.Id).replace(/:v\d+$/, "");
    const previous = latestRequirementByKey.get(stableKey);
    if (!previous || Number(row.ScheduleVersion ?? 0) > Number(previous.ScheduleVersion ?? 0)
      || (Number(row.ScheduleVersion ?? 0) === Number(previous.ScheduleVersion ?? 0)
        && storedTimestamp(row.CreatedAt) > storedTimestamp(previous.CreatedAt))) {
      latestRequirementByKey.set(stableKey, row);
    }
  }
  for (const row of latestRequirementByKey.values()) {
    const list = requirementByOperation.get(row.ProductionOrderOperationId) ?? [];
    list.push(row);
    requirementByOperation.set(row.ProductionOrderOperationId, list);
  }

  const consumptionsByOperation = new Map();
  for (const row of consumptions) {
    if (row.PlantId !== plantId || !operationIds.has(row.ProductionOrderOperationId) || !isAtOrBefore(row.ConsumedAt, throughMs)) continue;
    const list = consumptionsByOperation.get(row.ProductionOrderOperationId) ?? [];
    list.push(row);
    consumptionsByOperation.set(row.ProductionOrderOperationId, list);
  }
  const executionsByOperation = new Map();
  for (const row of executions) {
    if (row.PlantId !== plantId || !operationIds.has(row.ProductionOrderOperationId) || row.Status === "cancelled") continue;
    if (!isAtOrBefore(row.StartedAt, throughMs) || (row.FinishedAt && !isAtOrBefore(row.FinishedAt, throughMs))) continue;
    const list = executionsByOperation.get(row.ProductionOrderOperationId) ?? [];
    list.push(row);
    executionsByOperation.set(row.ProductionOrderOperationId, list);
  }
  const scrapByOperation = new Map();
  for (const row of scrapRecords) {
    if (row.PlantId !== plantId || !operationIds.has(row.ProductionOrderOperationId) || row.Disposition !== "scrapped") continue;
    if (!isAtOrBefore(row.RecordedAt, throughMs)) continue;
    const list = scrapByOperation.get(row.ProductionOrderOperationId) ?? [];
    list.push(row);
    scrapByOperation.set(row.ProductionOrderOperationId, list);
  }
  const scheduleByOperation = new Map();
  for (const row of schedules) {
    if (row.PlantId !== plantId || !operationIds.has(row.ProductionOrderOperationId) || row.Status === "cancelled") continue;
    const list = scheduleByOperation.get(row.ProductionOrderOperationId) ?? [];
    list.push(row);
    scheduleByOperation.set(row.ProductionOrderOperationId, list);
  }

  const hours = (minutes) => roundTo3(storedNumber(minutes) / 60);
  const rows = [];
  for (const operation of operations) {
    if (operation.PlantId !== plantId) continue;
    const workCenter = centerById.get(operation.WorkCenterId) ?? null;
    const order = orderById.get(operation.ProductionOrderId) ?? null;
    const orderPart = order ? partById.get(order.PartId) : null;
    const operationRequirements = requirementByOperation.get(operation.Id) ?? [];
    const operationConsumptions = consumptionsByOperation.get(operation.Id) ?? [];
    const operationExecutions = executionsByOperation.get(operation.Id) ?? [];
    const operationScraps = scrapByOperation.get(operation.Id) ?? [];
    const operationSchedules = scheduleByOperation.get(operation.Id) ?? [];

    // یک نسخهٔ برنامهٔ آخر برای جلوگیری از جمع دوبارهٔ چند بار زمان‌بندی.
    const latestScheduleVersion = operationSchedules.reduce((max, row) => Math.max(max, Number(row.ScheduleVersion) || 0), 0);
    const latestSchedule = operationSchedules.filter((row) => Number(row.ScheduleVersion) === latestScheduleVersion);
    const scheduledMinutes = roundTo3(latestSchedule.reduce((sum, row) => sum + storedNumber(row.PlannedCapacityMinutes), 0));
    const firstPlannedStart = latestSchedule
      .map((row) => storedTimestamp(row.PlannedStartAt))
      .filter(Number.isFinite)
      .sort((left, right) => left - right)[0];
    const plannedAt = Number.isFinite(firstPlannedStart)
      ? new Date(firstPlannedStart).toISOString()
      : order?.RequestedStartAt ?? order?.ReleasedAt ?? order?.DueAt ?? new Date().toISOString();
    const plannedDate = dateOnly(plannedAt) ?? new Date().toISOString().slice(0, 10);

    const standardMaterialDetails = operationRequirements.map((requirement) => {
      const material = materialById.get(requirement.MaterialId);
      const part = material ? partById.get(material.PartId) : null;
      const rate = storedNumber(material?.StandardUnitCost ?? part?.StandardUnitCost);
      const currency = material?.Currency ?? part?.Currency ?? "IRR";
      const standardQty = storedNumber(requirement.GrossQuantity, storedNumber(requirement.NetQuantity));
      const plannedQty = storedNumber(requirement.NetQuantity, standardQty);
      return {
        standardQty,
        plannedQty,
        standardAmount: standardQty * rate,
        plannedAmount: plannedQty * rate,
        currency,
      };
    });
    const actualMaterialDetails = operationConsumptions.map((row) => ({
      qty: storedNumber(row.Quantity),
      amount: storedNumber(row.Quantity) * storedNumber(row.UnitCost),
      currency: row.Currency ?? "IRR",
    }));
    const standardMaterialQty = roundTo3(standardMaterialDetails.reduce((sum, row) => sum + row.standardQty, 0));
    const plannedMaterialQty = roundTo3(standardMaterialDetails.reduce((sum, row) => sum + row.plannedQty, 0));
    const actualMaterialQty = roundTo3(actualMaterialDetails.reduce((sum, row) => sum + row.qty, 0));
    const standardMaterialAmount = roundTo3(standardMaterialDetails.reduce((sum, row) => sum + row.standardAmount, 0));
    const plannedMaterialAmount = roundTo3(standardMaterialDetails.reduce((sum, row) => sum + row.plannedAmount, 0));
    const actualMaterialAmount = roundTo3(actualMaterialDetails.reduce((sum, row) => sum + row.amount, 0));
    const materialCurrency = assertSingleCurrencyAmounts([
      ...standardMaterialDetails.map((row) => ({ amount: row.standardAmount, currency: row.currency })),
      ...actualMaterialDetails.map((row) => ({ amount: row.amount, currency: row.currency })),
    ], orderPart?.Currency ?? "IRR");
    const standardMaterialRate = standardMaterialQty > 0 ? roundTo3(standardMaterialAmount / standardMaterialQty) : 0;
    const plannedMaterialRate = plannedMaterialQty > 0 ? roundTo3(plannedMaterialAmount / plannedMaterialQty) : standardMaterialRate;
    const actualMaterialRate = actualMaterialQty > 0 ? roundTo3(actualMaterialAmount / actualMaterialQty) : standardMaterialRate;
    rows.push({
      PlantId: plantId,
      ProductionOrderOperationId: operation.Id,
      CostCenterId: null,
      CostElement: "material",
      CostVersion: costVersion,
      StandardQuantity: standardMaterialQty,
      PlannedQuantity: plannedMaterialQty,
      ActualQuantity: actualMaterialQty,
      StandardRate: standardMaterialRate,
      PlannedRate: plannedMaterialRate,
      ActualRate: actualMaterialRate,
      StandardAmount: standardMaterialAmount,
      PlannedAmount: plannedMaterialAmount,
      ActualAmount: actualMaterialAmount,
      Currency: materialCurrency,
      CalculatedAt: new Date().toISOString(),
      SourceRef: "material-requirements-and-consumptions",
    });

    const standardMinutes = roundTo3(
      storedNumber(operation.PlannedSetupMinutes)
      + storedNumber(operation.PlannedRunMinutesPerUnit) * storedNumber(operation.PlannedQuantity),
    );
    const plannedMinutes = scheduledMinutes > 0
      ? scheduledMinutes
      : storedNumber(operation.PlannedCapacityMinutes) > 0
        ? storedNumber(operation.PlannedCapacityMinutes)
        : standardMinutes;
    const actualMinutes = roundTo3(operationExecutions.reduce(
      (sum, row) => sum + storedNumber(row.SetupActualMinutes) + storedNumber(row.RunActualMinutes),
      0,
    ) || storedNumber(operation.ActualSetupMinutes) + storedNumber(operation.ActualRunMinutes));
    const preferredCostCenterId = operation.CostCenterId ?? workCenter?.CostCenterId ?? null;
    const selectedRates = new Map();
    for (const element of ["machine", "labor", "overhead"]) {
      const standardCenter = chooseRateCostCenter(costCenters, {
        plantId, preferredId: preferredCostCenterId, workCenter, element, effectiveAt: plannedDate,
      });
      const standardRate = storedNumber(standardCenter?.HourlyRate);
      const standardCurrency = standardCenter?.Currency ?? "IRR";
      const actualRateAmounts = [];
      for (const execution of operationExecutions) {
        const minutes = storedNumber(execution.SetupActualMinutes) + storedNumber(execution.RunActualMinutes);
        if (minutes <= 0) continue;
        const executionDate = dateOnly(execution.StartedAt) ?? plannedDate;
        const actualCenter = chooseRateCostCenter(costCenters, {
          plantId, preferredId: preferredCostCenterId, workCenter, element, effectiveAt: executionDate,
        });
        actualRateAmounts.push({
          amount: hours(minutes) * storedNumber(actualCenter?.HourlyRate),
          currency: actualCenter?.Currency ?? standardCurrency,
        });
      }
      const actualMinutesFromExecutions = roundTo3(operationExecutions.reduce(
        (sum, row) => sum + storedNumber(row.SetupActualMinutes) + storedNumber(row.RunActualMinutes),
        0,
      ));
      if (actualMinutesFromExecutions <= 0 && actualMinutes > 0) {
        actualRateAmounts.push({ amount: hours(actualMinutes) * standardRate, currency: standardCurrency });
      }
      const actualAmount = roundTo3(actualRateAmounts.reduce((sum, item) => sum + item.amount, 0));
      const actualCurrency = assertSingleCurrencyAmounts(actualRateAmounts, standardCurrency);
      const actualQty = hours(actualMinutes);
      const effectiveActualRate = actualQty > 0 ? roundTo3(actualAmount / actualQty) : standardRate;
      selectedRates.set(element, { standardCenter, standardRate, standardCurrency, actualCurrency, actualAmount, actualQty });
      rows.push({
        PlantId: plantId,
        ProductionOrderOperationId: operation.Id,
        CostCenterId: standardCenter?.Id ?? preferredCostCenterId,
        CostElement: element,
        CostVersion: costVersion,
        StandardQuantity: hours(standardMinutes),
        PlannedQuantity: hours(plannedMinutes),
        ActualQuantity: actualQty,
        StandardRate: standardRate,
        PlannedRate: standardRate,
        ActualRate: effectiveActualRate,
        StandardAmount: roundTo3(hours(standardMinutes) * standardRate),
        PlannedAmount: roundTo3(hours(plannedMinutes) * standardRate),
        ActualAmount: actualAmount,
        Currency: actualAmount > 0 ? actualCurrency : standardCurrency,
        CalculatedAt: new Date().toISOString(),
        SourceRef: "derived-from-actuals",
      });
    }

    const standardScrapQty = roundTo3(operationRequirements.reduce((sum, row) => sum + storedNumber(row.ScrapAllowanceQty), 0));
    const standardScrapAmount = roundTo3(operationRequirements.reduce((sum, row) => {
      const material = materialById.get(row.MaterialId);
      const part = material ? partById.get(material.PartId) : null;
      return sum + storedNumber(row.ScrapAllowanceQty) * storedNumber(material?.StandardUnitCost ?? part?.StandardUnitCost);
    }, 0));
    const plannedScrapQty = standardScrapQty;
    const plannedScrapAmount = standardScrapAmount;
    const executionScrapById = new Map(operationExecutions.map((row) => [row.Id, row]));
    const recordsByExecution = new Map();
    const unlinkedScrapRecords = [];
    for (const record of operationScraps) {
      if (record.ExecutionId && executionScrapById.has(record.ExecutionId)) {
        const list = recordsByExecution.get(record.ExecutionId) ?? [];
        list.push(record);
        recordsByExecution.set(record.ExecutionId, list);
      } else {
        unlinkedScrapRecords.push(record);
      }
    }
    const scrapValuationItems = [];
    let actualScrapQty = 0;
    const addRecordValuation = (record, qty) => {
      const costAmount = record.CostAmount === null || record.CostAmount === undefined
        ? null
        : storedNumber(record.CostAmount);
      scrapValuationItems.push({
        amount: costAmount === null ? null : costAmount,
        qty,
        currency: record.Currency ?? materialCurrency,
      });
    };
    for (const execution of operationExecutions) {
      const records = recordsByExecution.get(execution.Id) ?? [];
      const recordQty = roundTo3(records.reduce((sum, row) => sum + storedNumber(row.Quantity), 0));
      const executionQty = storedNumber(execution.ScrapQuantity);
      const effectiveQty = Math.max(recordQty, executionQty);
      actualScrapQty = roundTo3(actualScrapQty + effectiveQty);
      for (const record of records) addRecordValuation(record, storedNumber(record.Quantity));
      const unvaluedExecutionQty = Math.max(0, executionQty - recordQty);
      if (unvaluedExecutionQty > 0) scrapValuationItems.push({ amount: null, qty: unvaluedExecutionQty, currency: materialCurrency });
    }
    for (const record of unlinkedScrapRecords) {
      const qty = storedNumber(record.Quantity);
      actualScrapQty = roundTo3(actualScrapQty + qty);
      addRecordValuation(record, qty);
    }
    const executionInputQty = roundTo3(operationExecutions.reduce((sum, row) => sum + storedNumber(row.InputQuantity), 0));
    const executionOutputQty = roundTo3(operationExecutions.reduce((sum, row) =>
      sum + storedNumber(row.GoodQuantity) + storedNumber(row.ReworkQuantity) + storedNumber(row.ScrapQuantity), 0));
    const unitScrapValuation = executionInputQty > 0
      ? roundTo3((actualMaterialAmount
        + [...selectedRates.values()].reduce((sum, item) => sum + item.actualAmount, 0)) / executionInputQty)
      : orderPart?.StandardUnitCost !== null && orderPart?.StandardUnitCost !== undefined
        ? storedNumber(orderPart.StandardUnitCost)
        : storedNumber(orderPart?.StandardUnitCost);
    const actualScrapAmount = roundTo3(scrapValuationItems.reduce((sum, item) =>
      sum + (item.amount === null ? item.qty * unitScrapValuation : item.amount), 0));
    const scrapCurrency = assertSingleCurrencyAmounts(
      scrapValuationItems.map((item) => ({ amount: item.amount === null ? item.qty * unitScrapValuation : item.amount, currency: item.currency })),
      materialCurrency,
    );
    const standardScrapRate = standardScrapQty > 0 ? roundTo3(standardScrapAmount / standardScrapQty) : 0;
    const actualScrapRate = actualScrapQty > 0 ? roundTo3(actualScrapAmount / actualScrapQty) : standardScrapRate;
    const allScrapCostsEntered = operationScraps.length > 0 && operationScraps.every((row) => row.CostAmount !== null && row.CostAmount !== undefined);
    rows.push({
      PlantId: plantId,
      ProductionOrderOperationId: operation.Id,
      CostCenterId: null,
      CostElement: "scrap",
      CostVersion: costVersion,
      StandardQuantity: standardScrapQty,
      PlannedQuantity: plannedScrapQty,
      ActualQuantity: actualScrapQty,
      StandardRate: standardScrapRate,
      PlannedRate: standardScrapRate,
      ActualRate: actualScrapRate,
      StandardAmount: standardScrapAmount,
      PlannedAmount: plannedScrapAmount,
      ActualAmount: actualScrapAmount,
      Currency: actualScrapAmount > 0 ? scrapCurrency : materialCurrency,
      CalculatedAt: new Date().toISOString(),
      SourceRef: operationScraps.length === 0
        ? (actualScrapQty > 0 ? "execution-scrap-valued-at-operation-cost" : "bom-scrap-allowance")
        : allScrapCostsEntered ? "scrap-record-cost-amount" : "scrap-records-with-derived-valuation",
    });
  }
  return rows.map(enrichOperationCostRow);
}
function dateOnly(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

function effectiveOn(row, effectiveAt) {
  const from = dateOnly(row?.EffectiveFrom);
  const to = dateOnly(row?.EffectiveTo);
  return !!from && from <= effectiveAt && (!row.EffectiveTo || (to && to >= effectiveAt));
}

function requireReleasedHeader(row, { plantId, partId, effectiveAt, resource }) {
  if (!row || row.PlantId !== plantId || row.PartId !== partId || row.Status !== "released" || !effectiveOn(row, effectiveAt)) {
    throw businessRule(resource === "BOM" ? "MFG_BOM_NOT_EFFECTIVE" : "MFG_ROUTING_NOT_EFFECTIVE", `${resource} آزادشده و مؤثر برای همین قطعه و کارخانه الزامی است`);
  }
}

async function validateBomGraph(repo, rootBom, plantId, effectiveAt) {
  const partCache = new Map();
  const defaultBomCache = new Map();
  const stack = new Set();
  const visited = new Set();
  let visitedLines = 0;

  const componentPart = async (partId) => {
    if (!partCache.has(partId)) partCache.set(partId, await repo.get("MfgPart", partId));
    const part = partCache.get(partId);
    if (!part || part.PlantId !== plantId || part.IsActive !== true) {
      throw businessRule("MFG_BOM_COMPONENT_UNAVAILABLE", `قطعهٔ جزء ${partId} غیرفعال یا خارج از کارخانه است`);
    }
    return part;
  };
  const defaultBomFor = async (partId) => {
    if (defaultBomCache.has(partId)) return defaultBomCache.get(partId);
    const candidates = await repo.list("MfgBomHeader", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "PartId", op: "eq", value: partId },
        { column: "Status", op: "eq", value: "released" },
        { column: "IsDefault", op: "eq", value: true },
      ],
      orderBy: [{ column: "EffectiveFrom", dir: "desc" }],
      limit: 1001,
    });
    if (candidates.length > 1000) throw businessRule("MFG_BOM_REVISION_LIMIT", `نسخه‌های BOM قطعهٔ ${partId} از سقف بررسی‌شدنی بیشترند`);
    const effective = candidates.filter((header) => effectiveOn(header, effectiveAt));
    if (effective.length > 1) throw businessRule("MFG_BOM_DEFAULT_AMBIGUOUS", `برای قطعهٔ ${partId} بیش از یک BOM پیش‌فرض مؤثر وجود دارد`);
    const header = effective[0] ?? null;
    defaultBomCache.set(partId, header);
    return header;
  };

  const walk = async (partId, header, depth) => {
    if (depth >= 32) throw businessRule("MFG_BOM_DEPTH_LIMIT", "عمق انفجار BOM از سقف ۳۲ سطح بیشتر است");
    if (stack.has(partId)) throw businessRule("MFG_BOM_CYCLE", `چرخه در ساختار BOM قطعهٔ ${partId} تشخیص داده شد`);
    const key = `${partId}:${header.Id}`;
    if (visited.has(key)) return;
    const remainingLimit = Math.max(1, 5001 - visitedLines);
    const lines = await repo.list("MfgBomItem", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "BomHeaderId", op: "eq", value: header.Id },
      ],
      orderBy: [{ column: "LineNo", dir: "asc" }],
      limit: remainingLimit,
    });
    if (lines.length === 0) throw businessRule("MFG_BOM_EMPTY", `نسخهٔ BOM ${header.Revision} هیچ ردیفی ندارد`);
    if (visitedLines + lines.length > 5000) throw businessRule("MFG_BOM_NODE_LIMIT", "تعداد گره‌های انفجار BOM از سقف ۵۰۰۰ بیشتر است");
    stack.add(partId);
    for (const line of lines) {
      visitedLines++;
      if (!Number.isInteger(line.LineNo) || line.LineNo <= 0 || !(Number(line.QuantityPer) > 0) || !(Number(line.ScrapPct) >= 0 && Number(line.ScrapPct) <= 100)) {
        throw businessRule("MFG_BOM_LINE_INVALID", `ردیف ${line.LineNo} در BOM معتبر نیست`);
      }
      if (!["manual", "backflush", "kit"].includes(line.IssueMethod)) throw businessRule("MFG_BOM_ISSUE_METHOD", `روش صدور ردیف ${line.LineNo} نامعتبر است`);
      const component = await componentPart(line.ComponentPartId);
      const requiresExpansion = line.IsPhantom === true || ["manufactured", "phantom"].includes(component.PartType);
      if (!requiresExpansion) continue;
      if (stack.has(component.Id)) throw businessRule("MFG_BOM_CYCLE", `چرخه در ساختار BOM قطعهٔ ${component.Id} تشخیص داده شد`);
      const childHeader = await defaultBomFor(component.Id);
      if (!childHeader) throw businessRule("MFG_BOM_CHILD_NOT_RELEASED", `BOM پیش‌فرض مؤثر برای زیرمونتاژ ${component.PartNo} وجود ندارد`);
      await walk(component.Id, childHeader, depth + 1);
    }
    stack.delete(partId);
    visited.add(key);
  };
  await walk(rootBom.PartId, rootBom, 0);
}

async function validateRoutingForRelease(repo, routing, plantId, effectiveAt) {
  const operations = await repo.list("MfgRoutingOperation", {
    where: [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "RoutingId", op: "eq", value: routing.Id },
    ],
    orderBy: [{ column: "SequenceNo", dir: "asc" }],
    limit: 501,
  });
  if (operations.length === 0) throw businessRule("MFG_ROUTING_EMPTY", "Routing باید دست‌کم یک Operation داشته باشد");
  if (operations.length > 500) throw businessRule("MFG_ROUTING_OPERATION_LIMIT", "تعداد Operationهای Routing از سقف ۵۰۰ بیشتر است");

  const workCenterIds = [...new Set(operations.map((operation) => operation.WorkCenterId))];
  const costCenterIds = [...new Set(operations.map((operation) => operation.CostCenterId).filter(Boolean))];
  const workCenters = await repo.list("MfgWorkCenter", {
    where: [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "Id", op: "in", value: workCenterIds },
    ],
    limit: 500,
  });
  const resources = await repo.list("MfgWorkCenterResource", {
    where: [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "WorkCenterId", op: "in", value: workCenterIds },
      { column: "IsActive", op: "eq", value: true },
    ],
    limit: 10001,
  });
  if (resources.length > 10000) throw businessRule("MFG_ROUTING_RESOURCE_LIMIT", "تعداد منابع Work Centerهای Routing از سقف بررسی بیشتر است");
  const costCenters = costCenterIds.length === 0 ? [] : await repo.list("MfgCostCenter", {
    where: [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "Id", op: "in", value: costCenterIds },
    ],
    limit: 500,
  });
  const workCenterById = new Map(workCenters.map((row) => [row.Id, row]));
  const costCenterById = new Map(costCenters.map((row) => [row.Id, row]));
  const seenSequences = new Set();

  for (const operation of operations) {
    if (!Number.isInteger(operation.SequenceNo) || operation.SequenceNo <= 0 || seenSequences.has(operation.SequenceNo)) {
      throw businessRule("MFG_ROUTING_SEQUENCE_INVALID", "شمارهٔ توالی Operation نامعتبر یا تکراری است");
    }
    if (![operation.SetupMinutes, operation.RunMinutesPerUnit, operation.QueueMinutes, operation.MoveMinutes].every((value) => Number.isFinite(value) && value >= 0)) {
      throw businessRule("MFG_ROUTING_TIME_INVALID", `زمان‌های Operation ${operation.OperationCode} نامعتبرند`);
    }
    if (operation.PredecessorSequence !== null && operation.PredecessorSequence !== undefined &&
        (!Number.isInteger(operation.PredecessorSequence) || operation.PredecessorSequence <= 0 || operation.PredecessorSequence >= operation.SequenceNo || !seenSequences.has(operation.PredecessorSequence))) {
      throw businessRule("MFG_ROUTING_PREDECESSOR_INVALID", `پیش‌نیاز Operation ${operation.OperationCode} در Routing معتبر نیست`);
    }
    if (operation.OverlapAllowed === true && !(Number(operation.TransferBatchQty) > 0)) {
      throw businessRule("MFG_ROUTING_OVERLAP_INVALID", `TransferBatchQty برای Operation هم‌پوشان ${operation.OperationCode} الزامی است`);
    }

    const workCenter = workCenterById.get(operation.WorkCenterId);
    if (!workCenter || workCenter.Status !== "active") throw businessRule("MFG_WORKCENTER_UNAVAILABLE", `Work Center فعال برای ${operation.OperationCode} یافت نشد`);
    const activeResources = resources.filter((resource) => {
      const resourceFrom = dateOnly(resource.EffectiveFrom);
      const resourceTo = dateOnly(resource.EffectiveTo);
      return resource.WorkCenterId === workCenter.Id && resource.IsActive === true &&
        (!resource.EffectiveFrom || (resourceFrom && resourceFrom <= effectiveAt)) &&
        (!resource.EffectiveTo || (resourceTo && resourceTo >= effectiveAt));
    });
    if (activeResources.length === 0) throw businessRule("MFG_WORKCENTER_NO_RESOURCE", `Work Center ${workCenter.Code} منبع فعال و مؤثر ندارد`);
    if (operation.CostCenterId) {
      const costCenter = costCenterById.get(operation.CostCenterId);
      const costCenterFrom = dateOnly(costCenter?.EffectiveFrom);
      const costCenterTo = dateOnly(costCenter?.EffectiveTo);
      if (!costCenter || costCenter.IsActive !== true || !costCenterFrom || costCenterFrom > effectiveAt || (costCenter.EffectiveTo && (!costCenterTo || costCenterTo < effectiveAt))) {
        throw businessRule("MFG_COST_CENTER_UNAVAILABLE", `مرکز هزینهٔ Operation ${operation.OperationCode} فعال یا مؤثر نیست`);
      }
    }
    seenSequences.add(operation.SequenceNo);
  }
  return operations;
}

const calendarDateTimeFormatterCache = new Map();

function addLocalCalendarDays(date, amount) {
  const value = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value.getTime())) return null;
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function isoWeekday(date) {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = value.getUTCDay();
  return day === 0 ? 7 : day;
}

function localDateTimePartsAt(timestamp, timeZone) {
  let formatter = calendarDateTimeFormatterCache.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
        timeZone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      });
    } catch {
      throw businessRule("MFG_WORK_CENTER_TIMEZONE_INVALID", `منطقهٔ زمانی مرکز کاری «${timeZone}» معتبر نیست`);
    }
    calendarDateTimeFormatterCache.set(timeZone, formatter);
  }
  const values = Object.fromEntries(formatter.formatToParts(new Date(timestamp))
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year, month: values.month, day: values.day,
    hour: values.hour, minute: values.minute, second: values.second,
  };
}

function localCalendarMinuteToTimestamp(date, minuteOfDay, timeZone) {
  const parts = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date ?? "");
  if (!parts || !Number.isFinite(minuteOfDay)) throw businessRule("MFG_CALENDAR_INVALID", "تاریخ یا دقیقهٔ محلی تقویم معتبر نیست");
  const dayOffset = Math.floor(minuteOfDay / 1440);
  const withinDay = ((minuteOfDay % 1440) + 1440) % 1440;
  const shiftedDate = addLocalCalendarDays(date, dayOffset);
  const shifted = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(shiftedDate ?? "");
  const target = Date.UTC(Number(shifted[1]), Number(shifted[2]) - 1, Number(shifted[3]), Math.floor(withinDay / 60), withinDay % 60);
  let guess = target;
  for (let attempt = 0; attempt < 6; attempt++) {
    const local = localDateTimePartsAt(guess, timeZone);
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const adjustment = target - represented;
    if (adjustment === 0) break;
    guess += adjustment;
  }
  return guess;
}

function mergeTimeIntervals(intervals) {
  const sorted = intervals
    .filter((row) => Number.isFinite(row.start) && Number.isFinite(row.end) && row.end > row.start)
    .map((row) => ({ start: row.start, end: row.end }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const result = [];
  for (const interval of sorted) {
    const last = result[result.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else result.push(interval);
  }
  return result;
}

function subtractTimeIntervals(intervals, exclusions) {
  const cuts = mergeTimeIntervals(exclusions);
  const result = [];
  for (const interval of mergeTimeIntervals(intervals)) {
    let fragments = [interval];
    for (const cut of cuts) {
      fragments = fragments.flatMap((fragment) => {
        if (cut.end <= fragment.start || cut.start >= fragment.end) return [fragment];
        const remaining = [];
        if (cut.start > fragment.start) remaining.push({ start: fragment.start, end: Math.min(cut.start, fragment.end) });
        if (cut.end < fragment.end) remaining.push({ start: Math.max(cut.end, fragment.start), end: fragment.end });
        return remaining.filter((piece) => piece.end > piece.start);
      });
      if (!fragments.length) break;
    }
    result.push(...fragments);
  }
  return result;
}

function workCenterCalendarIntervals(workCenter, calendarRows, fromMs, toMs) {
  const timeZone = workCenter.TimeZoneId || "UTC";
  const firstDate = addLocalCalendarDays(localDateAt(fromMs, timeZone), -1);
  const lastDate = addLocalCalendarDays(localDateAt(toMs - 1, timeZone), 1);
  const rows = calendarRows.filter((row) => row.PlantId === workCenter.PlantId && row.WorkCenterId === workCenter.Id);
  const shifts = [];
  for (let date = firstDate; date && lastDate && date <= lastDate; date = addLocalCalendarDays(date, 1)) {
    const effectiveRows = rows.filter((row) => effectiveOn(row, date));
    const overrides = effectiveRows.filter((row) => row.RuleType === "date-override" && dateOnly(row.CalendarDate) === date);
    const candidates = overrides.length
      ? overrides
      : effectiveRows.filter((row) => row.RuleType === "weekly" && Number(row.WeekdayIso) === isoWeekday(date));
    for (const calendar of candidates) {
      if (calendar.IsWorking === false || calendar.IsWorking === 0) continue;
      const startMinute = Number(calendar.StartMinuteOfDay);
      const endMinute = Number(calendar.EndMinuteOfDay);
      const breakMinutes = storedNumber(calendar.BreakMinutes);
      const availabilityPct = storedNumber(calendar.AvailabilityPct, 100);
      if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute)
        || startMinute < 0 || startMinute > 1439 || endMinute <= startMinute || endMinute > 2879
        || !Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes > endMinute - startMinute
        || availabilityPct < 0 || availabilityPct > 100) {
        throw businessRule("MFG_CALENDAR_INVALID", `شیفت تقویم ${calendar.RuleKey ?? calendar.Id} معتبر نیست`);
      }
      let segments = [{ start: startMinute, end: endMinute }];
      if (breakMinutes > 0) {
        const breakStart = Number(calendar.BreakStartMinuteOfDay);
        if (!Number.isInteger(breakStart) || breakStart < startMinute || breakStart + breakMinutes > endMinute) {
          throw businessRule("MFG_CALENDAR_BREAK_START_REQUIRED", `زمان شروع استراحت تقویم ${calendar.RuleKey ?? calendar.Id} معتبر نیست`);
        }
        segments = [];
        if (breakStart > startMinute) segments.push({ start: startMinute, end: breakStart });
        if (breakStart + breakMinutes < endMinute) segments.push({ start: breakStart + breakMinutes, end: endMinute });
      }
      for (const segment of segments) {
        const start = Math.max(fromMs, localCalendarMinuteToTimestamp(date, segment.start, timeZone));
        const end = Math.min(toMs, localCalendarMinuteToTimestamp(date, segment.end, timeZone));
        if (end > start && availabilityPct > 0) shifts.push({ start, end, availabilityPct });
      }
    }
  }

  const boundaries = [...new Set(shifts.flatMap((row) => [row.start, row.end]))].sort((left, right) => left - right);
  const result = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const pct = shifts.reduce((max, row) => row.start < end && row.end > start ? Math.max(max, row.availabilityPct) : max, 0);
    if (pct <= 0 || end <= start) continue;
    const previous = result[result.length - 1];
    if (previous && previous.end === start && previous.availabilityPct === pct) previous.end = end;
    else result.push({ start, end, availabilityPct: pct });
  }
  return result;
}

function weightedCalendarMinutes(intervals) {
  return roundTo3(intervals.reduce((sum, row) => sum + ((row.end - row.start) / 60_000) * row.availabilityPct / 100, 0));
}

function weightedOverlapMinutes(events, calendarIntervals) {
  let minutes = 0;
  for (const event of events) {
    for (const shift of calendarIntervals) {
      const start = Math.max(event.start, shift.start);
      const end = Math.min(event.end, shift.end);
      if (end > start) minutes += ((end - start) / 60_000) * shift.availabilityPct / 100;
    }
  }
  return roundTo3(minutes);
}

function downtimeIntervalsForWindow(downtimes, workCenterId, fromMs, toMs, type) {
  const intervals = [];
  for (const row of downtimes) {
    if (row.WorkCenterId !== workCenterId || (type && row.DowntimeType !== type)) continue;
    const start = storedTimestamp(row.StartedAt);
    if (!Number.isFinite(start) || start >= toMs) continue;
    const finished = storedTimestamp(row.FinishedAt);
    const duration = storedNumber(row.DurationMinutes);
    const end = Number.isFinite(finished) ? finished : duration > 0 ? start + duration * 60_000 : toMs;
    const clippedStart = Math.max(fromMs, start);
    const clippedEnd = Math.min(toMs, end);
    if (clippedEnd > clippedStart) intervals.push({ start: clippedStart, end: clippedEnd });
  }
  return mergeTimeIntervals(intervals);
}

function executionWindowFraction(execution, fromMs, toMs) {
  const start = storedTimestamp(execution.StartedAt);
  if (!Number.isFinite(start) || start >= toMs) return 0;
  const end = storedTimestamp(execution.FinishedAt);
  if (!Number.isFinite(end)) return start >= fromMs && start < toMs ? 1 : 0;
  if (end <= fromMs) return 0;
  if (end <= start) return start >= fromMs && start < toMs ? 1 : 0;
  const overlap = Math.max(0, Math.min(end, toMs) - Math.max(start, fromMs));
  return overlap > 0 ? Math.min(1, overlap / (end - start)) : 0;
}

function productionFactsForOperations(operations, executions, scrapRecords, fromMs, toMs) {
  const operationById = new Map(operations.map((row) => [row.Id, row]));
  const executionRows = executions.filter((row) => row.PlantId === operations[0]?.PlantId
    && row.Status !== "cancelled"
    && operationById.has(row.ProductionOrderOperationId)
    && executionWindowFraction(row, fromMs, toMs) > 0);
  const executionIds = new Set(executionRows.map((row) => row.Id));
  const linkedScrapByExecution = new Map();
  const standaloneScrapByOperation = new Map();
  for (const row of scrapRecords) {
    if (row.PlantId !== operations[0]?.PlantId || row.Disposition !== "scrapped") continue;
    const recordedAt = storedTimestamp(row.RecordedAt);
    if (!Number.isFinite(recordedAt) || recordedAt < fromMs || recordedAt >= toMs || !operationById.has(row.ProductionOrderOperationId)) continue;
    if (row.ExecutionId && executionIds.has(row.ExecutionId)) {
      const list = linkedScrapByExecution.get(row.ExecutionId) ?? [];
      list.push(row);
      linkedScrapByExecution.set(row.ExecutionId, list);
    } else {
      const list = standaloneScrapByOperation.get(row.ProductionOrderOperationId) ?? [];
      list.push(row);
      standaloneScrapByOperation.set(row.ProductionOrderOperationId, list);
    }
  }
  const facts = new Map();
  const empty = () => ({
    actualRunMinutes: 0,
    idealProductionMinutes: 0,
    goodQuantity: 0,
    scrapQuantity: 0,
    reworkQuantity: 0,
    totalProducedQuantity: 0,
  });
  for (const operation of operations) facts.set(operation.Id, empty());
  for (const execution of executionRows) {
    const operation = operationById.get(execution.ProductionOrderOperationId);
    const target = facts.get(operation.Id);
    const fraction = executionWindowFraction(execution, fromMs, toMs);
    const good = storedNumber(execution.GoodQuantity) * fraction;
    const rework = storedNumber(execution.ReworkQuantity) * fraction;
    const executionScrap = storedNumber(execution.ScrapQuantity) * fraction;
    const linkedRecords = linkedScrapByExecution.get(execution.Id) ?? [];
    const recordScrap = linkedRecords.reduce((sum, row) => sum + storedNumber(row.Quantity), 0);
    const scrap = Math.max(executionScrap, recordScrap);
    const produced = good + rework + scrap;
    const actualMinutes = (storedNumber(execution.SetupActualMinutes) + storedNumber(execution.RunActualMinutes)) * fraction;
    target.actualRunMinutes += actualMinutes;
    target.goodQuantity += good;
    target.scrapQuantity += scrap;
    target.reworkQuantity += rework;
    target.totalProducedQuantity += produced;
    if (actualMinutes > 0 || produced > 0) {
      target.idealProductionMinutes += storedNumber(operation.PlannedSetupMinutes);
      target.idealProductionMinutes += produced * storedNumber(operation.PlannedRunMinutesPerUnit);
    }
  }
  for (const [operationId, records] of standaloneScrapByOperation) {
    const target = facts.get(operationId);
    const qty = records.reduce((sum, row) => sum + storedNumber(row.Quantity), 0);
    target.scrapQuantity += qty;
    target.totalProducedQuantity += qty;
  }
  for (const target of facts.values()) {
    target.actualRunMinutes = roundTo3(target.actualRunMinutes);
    target.idealProductionMinutes = roundTo3(target.idealProductionMinutes);
    target.goodQuantity = roundTo3(target.goodQuantity);
    target.scrapQuantity = roundTo3(target.scrapQuantity);
    target.reworkQuantity = roundTo3(target.reworkQuantity);
    target.totalProducedQuantity = roundTo3(target.totalProducedQuantity);
  }
  return [...facts.values()].reduce((sum, row) => ({
    actualRunMinutes: roundTo3(sum.actualRunMinutes + row.actualRunMinutes),
    idealProductionMinutes: roundTo3(sum.idealProductionMinutes + row.idealProductionMinutes),
    goodQuantity: roundTo3(sum.goodQuantity + row.goodQuantity),
    scrapQuantity: roundTo3(sum.scrapQuantity + row.scrapQuantity),
    reworkQuantity: roundTo3(sum.reworkQuantity + row.reworkQuantity),
    totalProducedQuantity: roundTo3(sum.totalProducedQuantity + row.totalProducedQuantity),
  }), empty());
}

function buildOeeMetrics({ from, to, workCenter = null, calendarMinutes, plannedDowntimeMinutes, unplannedDowntimeMinutes, facts }) {
  const plannedProductionMinutes = roundTo3(Math.max(0, calendarMinutes - plannedDowntimeMinutes));
  const operatingMinutes = roundTo3(Math.max(0, plannedProductionMinutes - unplannedDowntimeMinutes));
  const availabilityValue = plannedProductionMinutes > 0 ? roundTo3(operatingMinutes / plannedProductionMinutes) : null;
    const performanceValue = facts.actualRunMinutes > 0 ? roundTo3(Math.min(1, facts.idealProductionMinutes / facts.actualRunMinutes)) : null;
  const qualityValue = facts.totalProducedQuantity > 0 ? roundTo3(facts.goodQuantity / facts.totalProducedQuantity) : null;
  const oeeValue = availabilityValue === null || performanceValue === null || qualityValue === null
    ? null
    : roundTo3(availabilityValue * performanceValue * qualityValue);
  return {
    from,
    to,
    ...(workCenter ? {
      workCenterId: workCenter.Id,
      workCenterCode: workCenter.Code,
      workCenterNameFa: workCenter.NameFa,
    } : {}),
    calendar: {
      availableMinutes: roundTo3(calendarMinutes),
      plannedProductionMinutes,
    },
    downtime: {
      plannedMinutes: roundTo3(plannedDowntimeMinutes),
      unplannedMinutes: roundTo3(unplannedDowntimeMinutes),
      plannedDowntimeMinutes: roundTo3(plannedDowntimeMinutes),
      unplannedDowntimeMinutes: roundTo3(unplannedDowntimeMinutes),
      totalMinutes: roundTo3(plannedDowntimeMinutes + unplannedDowntimeMinutes),
    },
    availability: {
      numerator: operatingMinutes,
      denominator: plannedProductionMinutes,
      value: availabilityValue,
      pct: availabilityValue === null ? null : roundTo3(availabilityValue * 100),
    },
    performance: {
      numerator: facts.idealProductionMinutes,
      denominator: facts.actualRunMinutes,
      value: performanceValue,
      pct: performanceValue === null ? null : roundTo3(performanceValue * 100),
      idealProductionMinutes: facts.idealProductionMinutes,
      actualRunMinutes: facts.actualRunMinutes,
    },
    quality: {
      numerator: facts.goodQuantity,
      denominator: facts.totalProducedQuantity,
      value: qualityValue,
      pct: qualityValue === null ? null : roundTo3(qualityValue * 100),
      goodQuantity: facts.goodQuantity,
      scrapQuantity: facts.scrapQuantity,
      reworkQuantity: facts.reworkQuantity,
      totalProducedQuantity: facts.totalProducedQuantity,
    },
    oee: oeeValue,
    oeePct: oeeValue === null ? null : roundTo3(oeeValue * 100),
  };
}

/* ─────────── فاز ۵: کمکی‌های MPS، اندازه‌گذاری لات، ATP و تقسیم لات ─────────── */

/** خطای موتور برنامه‌ریزی به قرارداد خطای REST نگاشت می‌شود؛ هیچ خطایی خام بیرون نمی‌رود. */
function runPlanning(work) {
  try {
    return work();
  } catch (err) {
    if (err && typeof err.code === "string" && err.name === "ManufacturingPlanningError") {
      const status = err.code.endsWith("_INVALID") ? 400 : 422;
      throw new MfgApiError(status, err.code, err.message, err.details ?? {});
    }
    throw err;
  }
}

function parseDemandType(value, field) {
  if (value === undefined || value === null) return "manual";
  const parsed = text(value, field, { required: true, max: 16 });
  if (!DEMAND_TYPES.has(parsed)) throw bad(field, `${field} باید sales-order/forecast/contract/manual باشد`);
  return parsed;
}

/** ورودی سیاست لات را به دو شکل برمی‌گرداند: ستون‌های پایگاه‌داده و ورودی موتور. */
function parseLotPolicyInput(body, { allowExistingNulls = false } = {}) {
  const ruleCode = text(body.RuleCode, "RuleCode", { required: true, max: 8 });
  if (!LOT_SIZING_RULES.includes(ruleCode)) throw bad("RuleCode", "RuleCode باید L4L/FOQ/EOQ/POQ باشد");
  const decimalField = (value, field) => {
    if (value === undefined || value === null) return null;
    return number(value, field, { required: true, min: 0, max: 99_999_999_999.9999 });
  };
  const intField = (value, field, max) => {
    if (value === undefined || value === null) return null;
    return number(value, field, { required: true, min: 1, max, integer: true });
  };
  const currency = text(body.Currency, "Currency", { max: 8, pattern: CURRENCY_RE }) ?? "IRR";
  const effectiveFrom = isoDate(body.EffectiveFrom, "EffectiveFrom", { required: !allowExistingNulls }) ?? null;
  const effectiveTo = body.EffectiveTo === undefined || body.EffectiveTo === null ? null : isoDate(body.EffectiveTo, "EffectiveTo", { required: true });
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
    throw bad("EffectiveTo", "EffectiveTo نمی‌تواند پیش از EffectiveFrom باشد");
  }
  return {
    policyCode: text(body.PolicyCode, "PolicyCode", { max: 60, pattern: CODE_RE }),
    ruleCode,
    fixedLotQty: decimalField(body.FixedLotQty, "FixedLotQty"),
    orderMultiple: decimalField(body.OrderMultiple, "OrderMultiple"),
    minOrderQty: decimalField(body.MinOrderQty, "MinOrderQty"),
    maxOrderQty: decimalField(body.MaxOrderQty, "MaxOrderQty"),
    orderingCost: decimalField(body.OrderingCost, "OrderingCost"),
    holdingCostPerUnitPerYear: decimalField(body.HoldingCostPerUnitPerYear, "HoldingCostPerUnitPerYear"),
    annualDemandQty: decimalField(body.AnnualDemandQty, "AnnualDemandQty"),
    periodDays: intField(body.PeriodDays, "PeriodDays", 365),
    periodOrderQuantity: intField(body.PeriodOrderQuantity, "PeriodOrderQuantity", 260),
    currency,
    effectiveFrom,
    effectiveTo,
    isActive: bool(body.IsActive, "IsActive", true),
    noteFa: text(body.NoteFa, "NoteFa", { max: 800 }),
    engine: {
      rule: ruleCode,
      fixedLotQty: decimalField(body.FixedLotQty, "FixedLotQty"),
      orderMultiple: decimalField(body.OrderMultiple, "OrderMultiple"),
      minOrderQty: decimalField(body.MinOrderQty, "MinOrderQty"),
      maxOrderQty: decimalField(body.MaxOrderQty, "MaxOrderQty"),
      orderingCost: decimalField(body.OrderingCost, "OrderingCost"),
      holdingCostPerUnitPerYear: decimalField(body.HoldingCostPerUnitPerYear, "HoldingCostPerUnitPerYear"),
      annualDemandQty: decimalField(body.AnnualDemandQty, "AnnualDemandQty"),
      periodDays: intField(body.PeriodDays, "PeriodDays", 365),
      periodOrderQuantity: intField(body.PeriodOrderQuantity, "PeriodOrderQuantity", 260),
    },
  };
}

/** EOQ/POQ محاسبه‌شده برای نمایش کنار ردیف سیاست؛ منبع حقیقت همان ورودی‌های سیاست است. */
function enrichLotPolicy(row) {
  const engine = {
    rule: row.RuleCode,
    fixedLotQty: row.FixedLotQty,
    orderMultiple: row.OrderMultiple,
    minOrderQty: row.MinOrderQty,
    maxOrderQty: row.MaxOrderQty,
    orderingCost: row.OrderingCost,
    holdingCostPerUnitPerYear: row.HoldingCostPerUnitPerYear,
    annualDemandQty: row.AnnualDemandQty,
    periodDays: row.PeriodDays,
    periodOrderQuantity: row.PeriodOrderQuantity,
  };
  return runPlanning(() => ({
    eoq: computeEconomicOrderQuantity(engine),
    periodOrderQuantity: row.RuleCode === "POQ" ? resolvePeriodOrderQuantity(engine) : null,
  }));
}

/** سیاست مؤثر در یک تاریخ؛ تازه‌ترین EffectiveFrom که هنوز منقضی نشده باشد. */
function pickEffectivePolicy(policies, atDate) {
  const candidates = policies
    .filter((row) => String(row.EffectiveFrom).slice(0, 10) <= atDate
      && (!row.EffectiveTo || String(row.EffectiveTo).slice(0, 10) >= atDate))
    .sort((left, right) => String(right.EffectiveFrom).localeCompare(String(left.EffectiveFrom)));
  return candidates[0] ?? null;
}

/**
 * زنجیرهٔ حل سیاست اندازه‌گذاری:
 * ۱) سیاست صریح `MfgLotSizingPolicy` · ۲) بلوک `Planning` ماده (LotSize/OrderMultiple)
 * · ۳) پیش‌فرض L4L. بدون این زنجیره قطعه‌ای که سیاست صریح ندارد بی‌صدا از MPS بیرون می‌ماند.
 */
function resolveLotPolicy({ policyRow, material, override }) {
  if (override) {
    return { source: "inline", policyId: null, engine: override.engine };
  }
  if (policyRow) {
    return {
      source: "policy",
      policyId: policyRow.Id,
      engine: {
        rule: policyRow.RuleCode,
        fixedLotQty: policyRow.FixedLotQty,
        orderMultiple: policyRow.OrderMultiple,
        minOrderQty: policyRow.MinOrderQty,
        maxOrderQty: policyRow.MaxOrderQty,
        orderingCost: policyRow.OrderingCost,
        holdingCostPerUnitPerYear: policyRow.HoldingCostPerUnitPerYear,
        annualDemandQty: policyRow.AnnualDemandQty,
        periodDays: policyRow.PeriodDays,
        periodOrderQuantity: policyRow.PeriodOrderQuantity,
      },
    };
  }
  if (material) {
    const lotSize = storedNumber(material.LotSize, 0);
    return {
      source: "material-planning",
      policyId: null,
      engine: {
        rule: lotSize > 1 ? "FOQ" : "L4L",
        fixedLotQty: lotSize > 0 ? lotSize : null,
        orderMultiple: storedNumber(material.OrderMultiple, 1) || 1,
        minOrderQty: null,
        maxOrderQty: null,
        orderingCost: null,
        holdingCostPerUnitPerYear: null,
        annualDemandQty: null,
        periodDays: null,
        periodOrderQuantity: null,
      },
    };
  }
  return { source: "default-l4l", policyId: null, engine: { rule: "L4L" } };
}

/** جمع موجودی قابل برنامه‌ریزی همهٔ ردیف‌های انبار یک ماده. */
function sumInventory(rows) {
  const totals = { onHand: 0, reserved: 0, blocked: 0, inTransit: 0, safety: 0 };
  for (const row of rows) {
    totals.onHand = roundTo3(totals.onHand + storedNumber(row.OnHandQty));
    totals.reserved = roundTo3(totals.reserved + storedNumber(row.ReservedQty));
    totals.blocked = roundTo3(totals.blocked + storedNumber(row.BlockedQty));
    totals.inTransit = roundTo3(totals.inTransit + storedNumber(row.InTransitQty));
    totals.safety = roundTo3(totals.safety + storedNumber(row.SafetyStockQty));
  }
  return totals;
}

async function inventoryForMaterial(repo, plantId, material) {
  if (!material) return { onHand: 0, reserved: 0, blocked: 0, inTransit: 0, safety: 0 };
  const rows = await repo.list("MfgInventoryLevel", {
    where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "MaterialId", op: "eq", value: material.Id }],
  });
  return sumInventory(rows.filter((row) => row.PlantId === plantId));
}

/**
 * ردیف موتور MPS به شکل رکورد `MfgMasterScheduleLine`.
 * خروجی پیش‌نمایش و خروجی پایدار عمداً یک شکل دارند تا کلاینت مجبور نباشد
 * دو شکل مختلف از یک ردیف را بفهمد.
 */
function masterScheduleLineRow(line, { plantId = null, mpsRunId = null, policyId = null } = {}) {
  return {
    ...(plantId ? { PlantId: plantId } : {}),
    ...(mpsRunId ? { MpsRunId: mpsRunId } : {}),
    PartId: line.partId,
    BucketIndex: line.bucketIndex,
    BucketStart: line.bucketStart,
    BucketEnd: line.bucketEnd,
    ForecastQty: line.forecastQty,
    SalesOrderQty: line.salesOrderQty,
    ContractQty: line.contractQty,
    ManualQty: line.manualQty,
    ConsumedForecastQty: line.consumedForecastQty,
    GrossRequirementQty: line.grossRequirementQty,
    ScheduledReceiptQty: line.scheduledReceiptQty,
    ProjectedOnHandBefore: line.projectedOnHandBefore,
    NetRequirementQty: line.netRequirementQty,
    PlannedOrderReceiptQty: line.plannedOrderReceiptQty,
    PlannedOrderReleaseQty: line.plannedOrderReleaseQty,
    PlannedOrderReleaseAt: line.plannedOrderReleaseAt,
    ProjectedOnHandAfter: line.projectedOnHandAfter,
    LotSizingRule: line.lotSizingRule,
    LotSizingPolicyId: policyId,
    InsideDemandTimeFence: line.insideDemandTimeFence,
    IsFirm: line.isFirm,
    AppliedConstraints: line.appliedConstraints.join(",").slice(0, 300) || null,
    DemandRefsJson: line.demandRefs,
  };
}

/** سفارش و عملیات آن را با بررسی دامنهٔ کارخانه بار می‌کند. */
async function loadOrderOperation(repo, plantId, params) {
  const orderId = text(params.orderId, "orderId", { required: true, max: 60, pattern: ID_RE });
  const operationId = text(params.operationId, "operationId", { required: true, max: 60, pattern: ID_RE });
  const order = await repo.get("MfgProductionOrder", orderId);
  if (!order || order.PlantId !== plantId) throw notFound();
  const operation = await repo.get("MfgProductionOrderOperation", operationId);
  if (!operation || operation.PlantId !== plantId || operation.ProductionOrderId !== order.Id) throw notFound();
  return { order, operation };
}

async function parseOrderFilters(req, subject, evaluate, repo) {
  const q = req.query ?? {};
  const where = [{ column: "PlantId", op: "eq", value: req.mfgPlantId }];
  if (q.status !== undefined) {
    const status = text(q.status, "status", { max: 24, required: true });
    if (!ORDER_STATUSES.has(status)) throw bad("status", "وضعیت سفارش نامعتبر است");
    where.push({ column: "Status", op: "eq", value: status });
  }
  if (q.partId !== undefined) where.push({ column: "PartId", op: "eq", value: text(q.partId, "partId", { max: 60, required: true, pattern: ID_RE }) });
  if (q.q !== undefined) {
    const needle = text(q.q, "q", { max: 60, required: true });
    where.push({ column: "OrderNo", op: "like", value: `%${needle}%` });
  }
  if (q.contractId !== undefined) {
    const contractId = text(q.contractId, "contractId", { max: 60, required: true, pattern: ID_RE });
    where.push({ column: "ContractId", op: "eq", value: contractId });
  }
  if (q.projectId !== undefined) {
    const projectId = text(q.projectId, "projectId", { max: 60, required: true, pattern: ID_RE });
    where.push({ column: "ProjectId", op: "eq", value: projectId });
  }
  if (q.dueFrom !== undefined) where.push({ column: "DueAt", op: "gte", value: isoDateTime(q.dueFrom, "dueFrom", { required: true }) });
  if (q.dueTo !== undefined) where.push({ column: "DueAt", op: "lte", value: isoDateTime(q.dueTo, "dueTo", { required: true }) });
  if (q.dueFrom !== undefined && q.dueTo !== undefined && Date.parse(q.dueTo) < Date.parse(q.dueFrom)) throw bad("dueTo", "dueTo پیش از dueFrom است");
  if (q.priorityRule !== undefined) {
    const rule = text(q.priorityRule, "priorityRule", { max: 12, required: true });
    if (!PRIORITY_RULES.has(rule)) throw bad("priorityRule", "قاعدهٔ اولویت نامعتبر است");
    where.push({ column: "PriorityRule", op: "eq", value: rule });
  }
  return where;
}

/**
 * ثبت REST پایهٔ تولید. تمام handlerها از Subject معتبر و Plant scope عبور
 * می‌کنند؛ `ProjectId` فقط در ارجاع اختیاری سفارش ارزیابی جداگانه دارد.
 */
export function registerManufacturingRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app || typeof app.get !== "function" || typeof app.post !== "function") throw new TypeError("Express-compatible app is required");
  if (typeof repo !== "function" && (!repo || typeof repo.list !== "function")) throw new TypeError("Manufacturing repository is required");
  if (!Array.isArray(subjects) || typeof evaluate !== "function") throw new TypeError("Manufacturing RBAC dependencies are required");

  const getRepo = async () => typeof repo === "function" ? repo() : repo;
  const fail = (req, res, err) => {
    if (err instanceof MfgApiError) {
      return res.status(err.status).json({
        ok: false,
        error: { code: err.code, message: err.message, ...err.details, traceId: req.requestId },
      });
    }
    if (err?.code === "ROW_VALIDATION_FAILED") {
      return res.status(400).json({ ok: false, error: { code: "MFG_VALIDATION_FAILED", message: err.message, issues: err.issues, traceId: req.requestId } });
    }
    if (["UNIQUE_VIOLATION", "DUPLICATE_KEY"].includes(err?.code) || [2601, 2627].includes(err?.number)) {
      return res.status(409).json({ ok: false, error: { code: "MFG_DUPLICATE", message: "کد یا کلید یکتا در این کارخانه تکراری است", traceId: req.requestId } });
    }
    if (err?.code === "PERSISTENCE_UNAVAILABLE") {
      return res.status(503).json({ ok: false, error: { code: "MFG_PERSISTENCE_UNAVAILABLE", message: "مخزن داده در دسترس نیست", traceId: req.requestId } });
    }
    console.error("[%s] MFG API error:", req.requestId, err);
    return res.status(500).json({ ok: false, error: { code: "MFG_INTERNAL_ERROR", message: "خطای داخلی سرور", traceId: req.requestId } });
  };

  const route = (permission, handler, status = 200) => async (req, res) => {
    try {
      const plantId = String(req.params?.plantId ?? "").trim();
      if (!ID_RE.test(plantId)) throw new MfgApiError(400, "MFG_BAD_PLANT_ID", "شناسهٔ کارخانه نامعتبر است");
      const userId = String(req.headers?.["x-user-id"] ?? "").trim();
      const subject = userId ? subjects.find((item) => item.id === userId && item.active !== false) ?? null : null;
      if (!subject) throw new MfgApiError(401, "MFG_AUTH_REQUIRED", "هویت کاربر معتبر و فعال الزامی است", { permission });
      const decision = evaluate(subject, permission, { plantId });
      if (!decision.allow) {
        const code = decision.code === "DENY_PLANT_SCOPE" ? "MFG_PLANT_SCOPE_DENIED" : "MFG_FORBIDDEN";
        throw new MfgApiError(403, code, decision.code === "DENY_PLANT_SCOPE" ? "کاربر به این کارخانه تخصیص ندارد" : "مجوز این عمل را ندارید", { permission });
      }
      req.mfgSubject = subject;
      req.mfgPlantId = plantId;
      const data = await handler({ repo: await getRepo(), req, subject, plantId, permission });
      if (status === 204) return res.status(204).end();
      return res.status(status).json({ ok: true, data, meta: { traceId: req.requestId, version: API_VERSION } });
    } catch (err) {
      return fail(req, res, err);
    }
  };

  app.get(`${ROOT}/parts`, route("mfg.part.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["q", "partType", "isActive", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.partType !== undefined) {
      const partType = text(q.partType, "partType", { max: 20, required: true });
      if (!PART_TYPES.has(partType)) throw bad("partType", "نوع قطعه نامعتبر است");
      where.push({ column: "PartType", op: "eq", value: partType });
    }
    if (q.isActive !== undefined) {
      if (!/^(true|false)$/.test(String(q.isActive))) throw bad("isActive", "isActive باید true یا false باشد");
      where.push({ column: "IsActive", op: "eq", value: q.isActive === "true" });
    }
    if (q.q !== undefined) {
      const needle = text(q.q, "q", { max: 60, required: true });
      // LIKE پارامتری است؛ % و _ فقط wildcard جست‌وجو هستند و SQL تزریق نمی‌شوند.
      where.push({ column: "PartNo", op: "like", value: `%${needle}%` });
    }
    const [items, total] = await Promise.all([
      r.list("MfgPart", { where, orderBy: [{ column: "PartNo", dir: "asc" }], limit, offset }),
      r.count("MfgPart", where),
    ]);
    return { items, page: { limit, offset, total } };
  }));

  app.post(`${ROOT}/parts`, route("mfg.part.edit", async ({ repo: r, req, plantId }) => {
    const body = req.body ?? {};
    const fields = new Set(["PartNo", "NameFa", "NameEn", "PartType", "BaseUom", "DescriptionFa", "StandardUnitCost", "Currency", "IsLotTracked", "Planning"]);
    assertOnlyKeys(body, fields);
    const partNo = text(body.PartNo, "PartNo", { required: true, max: 60, pattern: CODE_RE });
    const nameFa = text(body.NameFa, "NameFa", { required: true, max: 240 });
    const nameEn = text(body.NameEn, "NameEn", { max: 240 });
    const partType = text(body.PartType, "PartType", { required: true, max: 20 });
    if (!PART_TYPES.has(partType)) throw bad("PartType", "PartType باید manufactured/purchased/phantom/subcontract باشد");
    const baseUom = text(body.BaseUom, "BaseUom", { required: true, max: 16, pattern: /^[A-Za-z0-9._-]+$/ });
    const descriptionFa = text(body.DescriptionFa, "DescriptionFa", { max: 1200 });
    const standardUnitCost = number(body.StandardUnitCost, "StandardUnitCost", { min: 0 });
    const currency = text(body.Currency ?? "IRR", "Currency", { required: true, max: 8, pattern: /^[A-Z]{3,8}$/ });
    const isLotTracked = bool(body.IsLotTracked, "IsLotTracked", false);
    const planning = parsePartPlanning(body.Planning, { partType, standardUnitCost, currency });

    const created = await r.transaction(async (tx) => {
      const duplicate = await tx.findOne("MfgPart", [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "PartNo", op: "eq", value: partNo },
      ]);
      if (duplicate) throw conflict("MFG_DUPLICATE", "PartNo در این کارخانه قبلاً ثبت شده است");
      const row = await tx.create("MfgPart", {
        PlantId: plantId,
        PartNo: partNo,
        NameFa: nameFa,
        NameEn: nameEn,
        PartType: partType,
        BaseUom: baseUom,
        DescriptionFa: descriptionFa,
        StandardUnitCost: standardUnitCost,
        Currency: currency,
        IsLotTracked: isLotTracked,
        IsActive: true,
      }, requestActor(req));

      let material = null;
      let inventory = null;
      if (planning) {
        ({ material, inventory } = await persistPartPlanning(tx, {
          plantId,
          partId: row.Id,
          partType,
          planning,
          subjectId: requestActor(req),
        }));
      }

      await createAuditRecord(tx, req, "MFG_PART_CREATED", "MfgPart", row.Id, "mfg.part.edit", planning
        ? { materialId: material?.Id ?? null, openingInventoryId: inventory?.Id ?? null }
        : {});
      return { row, material, inventory };
    });

    /* پاسخ پایه همان قطعه است؛ `Material/Inventory` فقط وقتی افزوده می‌شود که
     * بلوک Planning ارسال شده باشد تا کلاینت‌های موجود بدون تغییر بمانند. */
    if (!planning) return created.row;
    return { ...created.row, Material: created.material, Inventory: created.inventory };
  }, 201));

  app.get(`${ROOT}/parts/:partId`, route("mfg.part.view", async ({ repo: r, req, plantId }) => {
    assertOnlyQueryKeys(req.query ?? {}, new Set());
    const partId = text(req.params.partId, "partId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgPart", partId);
    if (!row || row.PlantId !== plantId) throw notFound();
    return row;
  }));

  app.patch(`${ROOT}/parts/:partId`, route("mfg.part.edit", async ({ repo: r, req, plantId }) => {
    const partId = text(req.params.partId, "partId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    const fields = new Set(["NameFa", "NameEn", "PartType", "BaseUom", "DescriptionFa", "StandardUnitCost", "Currency", "IsLotTracked", "IsActive", "Planning"]);
    assertOnlyKeys(body, fields);
    if (Object.keys(body).length === 0) throw bad("body", "حداقل یک فیلد قابل‌ویرایش الزامی است");

    const existing = await r.get("MfgPart", partId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    if (existing.RowVersion !== expectedRowVersion) {
      throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ قطعه تغییر کرده است؛ آخرین نسخه را بخوانید");
    }
    const bodyWithoutPlanning = { ...body };
    delete bodyWithoutPlanning.Planning;
    if (Object.keys(bodyWithoutPlanning).length === 0 && body.Planning === undefined) {
      throw bad("body", "حداقل یک فیلد قابل‌ویرایش الزامی است");
    }

    const patchData = {};
    if (body.NameFa !== undefined) patchData.NameFa = text(body.NameFa, "NameFa", { required: true, max: 240 });
    if (body.NameEn !== undefined) patchData.NameEn = body.NameEn === null ? null : text(body.NameEn, "NameEn", { max: 240 });
    if (body.PartType !== undefined) {
      const partType = text(body.PartType, "PartType", { required: true, max: 20 });
      if (!PART_TYPES.has(partType)) throw bad("PartType", "PartType باید manufactured/purchased/phantom/subcontract باشد");
      patchData.PartType = partType;
    }
    if (body.BaseUom !== undefined) {
      patchData.BaseUom = text(body.BaseUom, "BaseUom", { required: true, max: 16, pattern: /^[A-Za-z0-9._-]+$/ });
    }
    if (body.DescriptionFa !== undefined) {
      patchData.DescriptionFa = body.DescriptionFa === null ? null : text(body.DescriptionFa, "DescriptionFa", { max: 1200 });
    }
    if (body.StandardUnitCost !== undefined) {
      patchData.StandardUnitCost = body.StandardUnitCost === null ? null : number(body.StandardUnitCost, "StandardUnitCost", { min: 0 });
    }
    if (body.Currency !== undefined) {
      patchData.Currency = text(body.Currency, "Currency", { required: true, max: 8, pattern: CURRENCY_RE });
    }
    if (body.IsLotTracked !== undefined) {
      patchData.IsLotTracked = bool(body.IsLotTracked, "IsLotTracked");
    }
    if (body.IsActive !== undefined) {
      patchData.IsActive = bool(body.IsActive, "IsActive");
    }

    const nextPartType = patchData.PartType ?? existing.PartType;
    const planning = parsePartPlanning(body.Planning, {
      partType: nextPartType,
      standardUnitCost: patchData.StandardUnitCost ?? existing.StandardUnitCost ?? null,
      currency: patchData.Currency ?? existing.Currency ?? "IRR",
    });

    const applied = await r.transaction(async (tx) => {
      const current = await tx.get("MfgPart", existing.Id);
      if (!current || current.PlantId !== plantId) throw notFound();
      if (current.RowVersion !== expectedRowVersion) throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ قطعه تغییر کرده است");

      let updated = current;
      if (Object.keys(patchData).length > 0) {
        const resPatch = await tx.patch("MfgPart", current.Id, patchData, requestActor(req), expectedRowVersion);
        if (!resPatch.ok) throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ قطعه تغییر کرده است");
        updated = await tx.get("MfgPart", current.Id);
      } else if (updated.RowVersion !== expectedRowVersion) {
        throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ قطعه تغییر کرده است");
      }

      let material = null;
      let inventory = null;
      if (planning) {
        ({ material, inventory } = await persistPartPlanning(tx, {
          plantId,
          partId: current.Id,
          partType: nextPartType,
          planning,
          subjectId: requestActor(req),
        }));
      }

      await createAuditRecord(tx, req, "MFG_PART_UPDATED", "MfgPart", current.Id, "mfg.part.edit", planning
        ? { materialId: material?.Id ?? null, openingInventoryId: inventory?.Id ?? null }
        : {});
      return { updated, material, inventory };
    });

    if (!planning) return applied.updated;
    return { ...applied.updated, Material: applied.material, Inventory: applied.inventory };
  }));

  app.get(`${ROOT}/bom-headers`, route("mfg.bom.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "status", "effectiveAt", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);

    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.partId !== undefined) {
      const partId = text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE });
      const part = await r.get("MfgPart", partId);
      if (!part || part.PlantId !== plantId) throw notFound();
      where.push({ column: "PartId", op: "eq", value: partId });
    }
    if (q.status !== undefined) {
      const status = text(q.status, "status", { required: true, max: 24 });
      if (!BOM_STATUSES.has(status)) throw bad("status", "status باید draft/released/obsolete باشد");
      where.push({ column: "Status", op: "eq", value: status });
    }
    const effectiveAt = q.effectiveAt !== undefined ? isoDate(q.effectiveAt, "effectiveAt", { required: true }) : null;

    const allRows = await r.list("MfgBomHeader", {
      where,
      orderBy: [{ column: "PartId", dir: "asc" }, { column: "Revision", dir: "asc" }],
    });
    const filtered = effectiveAt ? allRows.filter((row) => effectiveOn(row, effectiveAt)) : allRows;
    const items = filtered.slice(offset, offset + limit);
    return { items, page: { limit, offset, total: filtered.length } };
  }));

  app.post(`${ROOT}/bom-headers`, route("mfg.bom.edit", async ({ repo: r, req, plantId }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["PartId", "Revision", "BaseQuantity", "BaseUom", "EffectiveFrom", "EffectiveTo", "IsDefault", "NoteFa"]));
    const partId = text(body.PartId, "PartId", { required: true, max: 60, pattern: ID_RE });
    const part = await r.get("MfgPart", partId);
    if (!part || part.PlantId !== plantId) throw notFound();

    const revision = text(body.Revision, "Revision", { required: true, max: 60, pattern: CODE_RE });
    const baseQuantity = number(body.BaseQuantity ?? 1, "BaseQuantity", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    const baseUom = text(body.BaseUom ?? part.BaseUom, "BaseUom", { required: true, max: 16, pattern: /^[A-Za-z0-9._-]+$/ });
    const effectiveFrom = isoDate(body.EffectiveFrom, "EffectiveFrom", { required: true });
    const effectiveTo = body.EffectiveTo === undefined || body.EffectiveTo === null ? null : isoDate(body.EffectiveTo, "EffectiveTo", { required: true });
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw bad("EffectiveTo", "EffectiveTo نباید پیش از EffectiveFrom باشد");
    }
    const isDefault = bool(body.IsDefault, "IsDefault", false);
    const noteFa = text(body.NoteFa, "NoteFa", { max: 1000 });

    const duplicate = await r.findOne("MfgBomHeader", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "PartId", op: "eq", value: partId },
      { column: "Revision", op: "eq", value: revision },
    ]);
    if (duplicate) throw conflict("MFG_DUPLICATE", "این نسخهٔ BOM برای قطعه قبلاً ثبت شده است");

    const row = await r.create("MfgBomHeader", {
      PlantId: plantId,
      PartId: partId,
      Revision: revision,
      Status: "draft",
      BaseQuantity: baseQuantity,
      BaseUom: baseUom,
      EffectiveFrom: effectiveFrom,
      EffectiveTo: effectiveTo,
      IsDefault: isDefault,
      ReleasedAt: null,
      ReleasedBy: null,
      NoteFa: noteFa,
    }, requestActor(req));
    await writeAudit(r, req, "MFG_BOM_HEADER_CREATED", "MfgBomHeader", row.Id, "mfg.bom.edit");
    return row;
  }, 201));

  app.get(`${ROOT}/bom-headers/:bomId`, route("mfg.bom.view", async ({ repo: r, req, plantId }) => {
    assertOnlyQueryKeys(req.query ?? {}, new Set());
    const bomId = text(req.params.bomId, "bomId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgBomHeader", bomId);
    if (!row || row.PlantId !== plantId) throw notFound();
    return row;
  }));

  app.patch(`${ROOT}/bom-headers/:bomId`, route("mfg.bom.edit", async ({ repo: r, req, plantId }) => {
    const bomId = text(req.params.bomId, "bomId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["Revision", "BaseQuantity", "BaseUom", "EffectiveFrom", "EffectiveTo", "IsDefault", "NoteFa"]));
    if (Object.keys(body).length === 0) throw bad("body", "حداقل یک فیلد قابل‌ویرایش الزامی است");

    const existing = await r.get("MfgBomHeader", bomId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    if (existing.Status !== "draft") {
      throw businessRule("MFG_BOM_NOT_DRAFT", "فقط BOM در وضعیت draft قابل ویرایش است");
    }
    if (existing.RowVersion !== expectedRowVersion) {
      throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ BOM تغییر کرده است؛ آخرین نسخه را بخوانید");
    }

    const patchData = {};
    if (body.Revision !== undefined) {
      const revision = text(body.Revision, "Revision", { required: true, max: 60, pattern: CODE_RE });
      if (revision !== existing.Revision) {
        const duplicate = await r.findOne("MfgBomHeader", [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "PartId", op: "eq", value: existing.PartId },
          { column: "Revision", op: "eq", value: revision },
        ]);
        if (duplicate && duplicate.Id !== existing.Id) {
          throw conflict("MFG_DUPLICATE", "این نسخهٔ BOM برای قطعه قبلاً ثبت شده است");
        }
      }
      patchData.Revision = revision;
    }
    if (body.BaseQuantity !== undefined) {
      patchData.BaseQuantity = number(body.BaseQuantity, "BaseQuantity", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    }
    if (body.BaseUom !== undefined) {
      patchData.BaseUom = text(body.BaseUom, "BaseUom", { required: true, max: 16, pattern: /^[A-Za-z0-9._-]+$/ });
    }
    if (body.EffectiveFrom !== undefined) {
      patchData.EffectiveFrom = isoDate(body.EffectiveFrom, "EffectiveFrom", { required: true });
    }
    if (body.EffectiveTo !== undefined) {
      patchData.EffectiveTo = body.EffectiveTo === null ? null : isoDate(body.EffectiveTo, "EffectiveTo", { required: true });
    }
    const finalFrom = patchData.EffectiveFrom ?? dateOnly(existing.EffectiveFrom);
    const finalTo = patchData.EffectiveTo !== undefined ? patchData.EffectiveTo : dateOnly(existing.EffectiveTo);
    if (finalTo && finalFrom && finalTo < finalFrom) {
      throw bad("EffectiveTo", "EffectiveTo نباید پیش از EffectiveFrom باشد");
    }
    if (body.IsDefault !== undefined) {
      patchData.IsDefault = bool(body.IsDefault, "IsDefault");
    }
    if (body.NoteFa !== undefined) {
      patchData.NoteFa = body.NoteFa === null ? null : text(body.NoteFa, "NoteFa", { max: 1000 });
    }

    const resPatch = await r.patch("MfgBomHeader", existing.Id, patchData, requestActor(req), expectedRowVersion);
    if (!resPatch.ok) throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ BOM تغییر کرده است");
    const updated = await r.get("MfgBomHeader", existing.Id);
    await writeAudit(r, req, "MFG_BOM_HEADER_UPDATED", "MfgBomHeader", existing.Id, "mfg.bom.edit");
    return updated;
  }));

  app.get(`${ROOT}/bom-headers/:bomId/items`, route("mfg.bom.view", async ({ repo: r, req, plantId }) => {
    const bomId = text(req.params.bomId, "bomId", { required: true, max: 60, pattern: ID_RE });
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);

    const bom = await r.get("MfgBomHeader", bomId);
    if (!bom || bom.PlantId !== plantId) throw notFound();

    const where = [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "BomHeaderId", op: "eq", value: bom.Id },
    ];
    const [items, total] = await Promise.all([
      r.list("MfgBomItem", { where, orderBy: [{ column: "LineNo", dir: "asc" }], limit, offset }),
      r.count("MfgBomItem", where),
    ]);
    return { items, page: { limit, offset, total } };
  }));

  app.post(`${ROOT}/bom-headers/:bomId/items`, route("mfg.bom.edit", async ({ repo: r, req, plantId }) => {
    const bomId = text(req.params.bomId, "bomId", { required: true, max: 60, pattern: ID_RE });
    const bom = await r.get("MfgBomHeader", bomId);
    if (!bom || bom.PlantId !== plantId) throw notFound();
    if (bom.Status !== "draft") {
      throw businessRule("MFG_BOM_NOT_DRAFT", "افزودن ردیف فقط به BOM در وضعیت draft مجاز است");
    }

    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["LineNo", "ComponentPartId", "QuantityPer", "Uom", "ScrapPct", "IssueAtOperationCode", "IssueMethod", "IsPhantom", "NoteFa"]));
    const lineNo = number(body.LineNo, "LineNo", { required: true, integer: true, min: 1, max: 100_000 });
    const componentPartId = text(body.ComponentPartId, "ComponentPartId", { required: true, max: 60, pattern: ID_RE });
    const componentPart = await r.get("MfgPart", componentPartId);
    if (!componentPart || componentPart.PlantId !== plantId) throw notFound();

    const quantityPer = number(body.QuantityPer, "QuantityPer", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    const uom = text(body.Uom ?? componentPart.BaseUom, "Uom", { required: true, max: 16, pattern: /^[A-Za-z0-9._-]+$/ });
    const scrapPct = number(body.ScrapPct ?? 0, "ScrapPct", { required: true, min: 0, max: 100 });
    const issueAtOperationCode = body.IssueAtOperationCode === undefined || body.IssueAtOperationCode === null
      ? null
      : text(body.IssueAtOperationCode, "IssueAtOperationCode", { max: 40, pattern: CODE_RE });
    const issueMethod = text(body.IssueMethod ?? "manual", "IssueMethod", { required: true, max: 16 });
    if (!BOM_ISSUE_METHODS.has(issueMethod)) {
      throw bad("IssueMethod", "IssueMethod باید manual/backflush/kit باشد");
    }
    const isPhantom = bool(body.IsPhantom, "IsPhantom", componentPart.PartType === "phantom");
    const noteFa = text(body.NoteFa, "NoteFa", { max: 600 });

    const duplicateLine = await r.findOne("MfgBomItem", [
      { column: "BomHeaderId", op: "eq", value: bom.Id },
      { column: "LineNo", op: "eq", value: lineNo },
    ]);
    if (duplicateLine) throw conflict("MFG_DUPLICATE", "شماره ردیف LineNo در این BOM قبلاً ثبت شده است");

    const row = await r.create("MfgBomItem", {
      PlantId: plantId,
      BomHeaderId: bom.Id,
      LineNo: lineNo,
      ComponentPartId: componentPart.Id,
      QuantityPer: quantityPer,
      Uom: uom,
      ScrapPct: scrapPct,
      IssueAtOperationCode: issueAtOperationCode,
      IssueMethod: issueMethod,
      IsPhantom: isPhantom,
      NoteFa: noteFa,
    }, requestActor(req));
    await writeAudit(r, req, "MFG_BOM_ITEM_CREATED", "MfgBomItem", row.Id, "mfg.bom.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/bom-items/:itemId`, route("mfg.bom.edit", async ({ repo: r, req, plantId }) => {
    const itemId = text(req.params.itemId, "itemId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["LineNo", "ComponentPartId", "QuantityPer", "Uom", "ScrapPct", "IssueAtOperationCode", "IssueMethod", "IsPhantom", "NoteFa"]));
    if (Object.keys(body).length === 0) throw bad("body", "حداقل یک فیلد قابل‌ویرایش الزامی است");

    const existing = await r.get("MfgBomItem", itemId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    const bom = await r.get("MfgBomHeader", existing.BomHeaderId);
    if (!bom || bom.PlantId !== plantId) throw notFound();
    if (bom.Status !== "draft") {
      throw businessRule("MFG_BOM_NOT_DRAFT", "ویرایش ردیف فقط برای BOM در وضعیت draft مجاز است");
    }
    if (existing.RowVersion !== expectedRowVersion) {
      throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ ردیف BOM تغییر کرده است؛ آخرین نسخه را بخوانید");
    }

    const patchData = {};
    if (body.LineNo !== undefined) {
      const lineNo = number(body.LineNo, "LineNo", { required: true, integer: true, min: 1, max: 100_000 });
      if (lineNo !== existing.LineNo) {
        const duplicateLine = await r.findOne("MfgBomItem", [
          { column: "BomHeaderId", op: "eq", value: bom.Id },
          { column: "LineNo", op: "eq", value: lineNo },
        ]);
        if (duplicateLine && duplicateLine.Id !== existing.Id) {
          throw conflict("MFG_DUPLICATE", "شماره ردیف LineNo در این BOM تکراری است");
        }
      }
      patchData.LineNo = lineNo;
    }
    if (body.ComponentPartId !== undefined) {
      const componentPartId = text(body.ComponentPartId, "ComponentPartId", { required: true, max: 60, pattern: ID_RE });
      const componentPart = await r.get("MfgPart", componentPartId);
      if (!componentPart || componentPart.PlantId !== plantId) throw notFound();
      patchData.ComponentPartId = componentPart.Id;
    }
    if (body.QuantityPer !== undefined) {
      patchData.QuantityPer = number(body.QuantityPer, "QuantityPer", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    }
    if (body.Uom !== undefined) {
      patchData.Uom = text(body.Uom, "Uom", { required: true, max: 16, pattern: /^[A-Za-z0-9._-]+$/ });
    }
    if (body.ScrapPct !== undefined) {
      patchData.ScrapPct = number(body.ScrapPct, "ScrapPct", { required: true, min: 0, max: 100 });
    }
    if (body.IssueAtOperationCode !== undefined) {
      patchData.IssueAtOperationCode = body.IssueAtOperationCode === null
        ? null
        : text(body.IssueAtOperationCode, "IssueAtOperationCode", { max: 40, pattern: CODE_RE });
    }
    if (body.IssueMethod !== undefined) {
      const issueMethod = text(body.IssueMethod, "IssueMethod", { required: true, max: 16 });
      if (!BOM_ISSUE_METHODS.has(issueMethod)) {
        throw bad("IssueMethod", "IssueMethod باید manual/backflush/kit باشد");
      }
      patchData.IssueMethod = issueMethod;
    }
    if (body.IsPhantom !== undefined) {
      patchData.IsPhantom = bool(body.IsPhantom, "IsPhantom");
    }
    if (body.NoteFa !== undefined) {
      patchData.NoteFa = body.NoteFa === null ? null : text(body.NoteFa, "NoteFa", { max: 600 });
    }

    const resPatch = await r.patch("MfgBomItem", existing.Id, patchData, requestActor(req), expectedRowVersion);
    if (!resPatch.ok) throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ ردیف BOM تغییر کرده است");
    const updated = await r.get("MfgBomItem", existing.Id);
    await writeAudit(r, req, "MFG_BOM_ITEM_UPDATED", "MfgBomItem", existing.Id, "mfg.bom.edit");
    return updated;
  }));

  if (typeof app.delete === "function") {
    app.delete(`${ROOT}/bom-items/:itemId`, route("mfg.bom.edit", async ({ repo: r, req, plantId }) => {
      const itemId = text(req.params.itemId, "itemId", { required: true, max: 60, pattern: ID_RE });
      const existing = await r.get("MfgBomItem", itemId);
      if (!existing || existing.PlantId !== plantId) throw notFound();
      const bom = await r.get("MfgBomHeader", existing.BomHeaderId);
      if (!bom || bom.PlantId !== plantId) throw notFound();
      if (bom.Status !== "draft") {
        throw businessRule("MFG_BOM_NOT_DRAFT", "حذف ردیف فقط از BOM در وضعیت draft مجاز است");
      }

      const [linkedRequirements, ordersUsingBom] = await Promise.all([
        r.list("MfgMaterialRequirement", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "BomItemId", op: "eq", value: existing.Id },
          ],
          limit: 1,
        }),
        r.list("MfgProductionOrder", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "BomHeaderId", op: "eq", value: bom.Id },
          ],
        }),
      ]);
      if (linkedRequirements.length > 0 || ordersUsingBom.some((order) => order.Status !== "created")) {
        throw businessRule("MFG_BOM_ITEM_IN_USE", "ردیف BOM در سفارش آزادشده یا نیازمندی مواد استفاده شده و قابل حذف نیست");
      }

      return r.transaction(async (tx) => {
        await tx.remove("MfgBomItem", existing.Id);
        await createAuditRecord(tx, req, "MFG_BOM_ITEM_DELETED", "MfgBomItem", existing.Id, "mfg.bom.edit", {
          bomHeaderId: bom.Id,
          lineNo: existing.LineNo,
        });
        return null;
      });
    }, 204));
  }

  app.post(`${ROOT}/bom-headers/:bomId/release`, route("mfg.bom.release", async ({ repo: r, req, plantId }) => {
    const bomId = text(req.params.bomId, "bomId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["EffectiveAt"]));

    return r.transaction(async (tx) => {
      const bom = await tx.get("MfgBomHeader", bomId);
      if (!bom || bom.PlantId !== plantId) throw notFound();
      if (bom.RowVersion !== expectedRowVersion) {
        throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ BOM تغییر کرده است؛ آخرین نسخه را بخوانید");
      }
      if (bom.Status !== "draft") {
        throw businessRule("MFG_BOM_INVALID_STATE", "فقط BOM در وضعیت draft قابل آزادسازی است");
      }

      const parentPart = await tx.get("MfgPart", bom.PartId);
      if (!parentPart || parentPart.PlantId !== plantId || parentPart.IsActive !== true) {
        throw businessRule("MFG_PART_INACTIVE", "قطعهٔ والد BOM غیرفعال یا نامعتبر است");
      }

      const effectiveAt = body.EffectiveAt !== undefined
        ? isoDate(body.EffectiveAt, "EffectiveAt", { required: true })
        : (dateOnly(bom.EffectiveFrom) ?? new Date().toISOString().slice(0, 10));
      if (!effectiveOn(bom, effectiveAt)) {
        throw businessRule("MFG_BOM_NOT_EFFECTIVE", "BOM در تاریخ موردنظر مؤثر نیست");
      }

      if (bom.IsDefault === true) {
        const otherDefaults = await tx.list("MfgBomHeader", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "PartId", op: "eq", value: bom.PartId },
            { column: "Status", op: "eq", value: "released" },
            { column: "IsDefault", op: "eq", value: true },
          ],
        });
        const fromA = dateOnly(bom.EffectiveFrom);
        const toA = dateOnly(bom.EffectiveTo) ?? "9999-12-31";
        const overlapping = otherDefaults.find((other) => {
          if (other.Id === bom.Id) return false;
          const fromB = dateOnly(other.EffectiveFrom);
          const toB = dateOnly(other.EffectiveTo) ?? "9999-12-31";
          return fromA <= toB && fromB <= toA;
        });
        if (overlapping) {
          throw conflict("MFG_BOM_DEFAULT_OVERLAP", `نسخهٔ پیش‌فرض آزادشدهٔ دیگری (${overlapping.Revision}) در این بازهٔ زمانی فعال است`);
        }
      }

      await validateBomGraph(tx, bom, plantId, effectiveAt);

      const releasedAt = new Date().toISOString();
      const patchRes = await tx.patch("MfgBomHeader", bom.Id, {
        Status: "released",
        ReleasedAt: releasedAt,
        ReleasedBy: requestActor(req),
      }, requestActor(req), expectedRowVersion);
      if (!patchRes.ok) {
        throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ BOM تغییر کرده است");
      }

      const released = await tx.get("MfgBomHeader", bom.Id);
      await createAuditRecord(tx, req, "MFG_BOM_RELEASED", "MfgBomHeader", bom.Id, "mfg.bom.release", {
        revision: bom.Revision,
        effectiveAt,
      });
      return released;
    });
  }));

  app.post(`${ROOT}/bom-headers/:bomId/explosions`, route("mfg.bom.view", async ({ repo: r, req, plantId }) => {
    const bomId = text(req.params.bomId, "bomId", { required: true, max: 60, pattern: ID_RE });
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["Quantity", "At"]));
    const quantity = number(body.Quantity, "Quantity", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });

    const bom = await r.get("MfgBomHeader", bomId);
    if (!bom || bom.PlantId !== plantId) throw notFound();

    const effectiveAt = body.At !== undefined
      ? isoDate(body.At, "At", { required: true })
      : (dateOnly(bom.EffectiveFrom) ?? new Date().toISOString().slice(0, 10));
    if (bom.Status !== "released" || !effectiveOn(bom, effectiveAt)) {
      throw businessRule("MFG_BOM_NOT_EFFECTIVE", "انفجار فقط برای BOM آزادشده و مؤثر در تاریخ درخواستی مجاز است");
    }

    const [allParts, allBomHeaders, allBomItems] = await Promise.all([
      r.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgBomHeader", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgBomItem", {
        where: [{ column: "PlantId", op: "eq", value: plantId }],
        orderBy: [{ column: "LineNo", dir: "asc" }],
      }),
    ]);

    const partById = new Map(allParts.map((part) => [part.Id, part]));
    const itemsByHeaderId = new Map();
    for (const item of allBomItems) {
      if (!itemsByHeaderId.has(item.BomHeaderId)) itemsByHeaderId.set(item.BomHeaderId, []);
      itemsByHeaderId.get(item.BomHeaderId).push(item);
    }

    const defaultBomForPart = (partId) => {
      const candidates = allBomHeaders.filter((header) => header.PartId === partId
        && header.Status === "released"
        && header.IsDefault === true
        && effectiveOn(header, effectiveAt));
      if (candidates.length > 1) {
        throw businessRule("MFG_BOM_DEFAULT_AMBIGUOUS", `برای قطعهٔ ${partId} بیش از یک BOM پیش‌فرض مؤثر وجود دارد`);
      }
      return candidates[0] ?? null;
    };

    const roundQty = (value) => Math.round((value + Number.EPSILON) * 10_000) / 10_000;
    const lines = [];

    const explodeLevel = (currentHeader, parentQuantity, depth, ancestors) => {
      if (depth > 32) {
        throw businessRule("MFG_BOM_DEPTH_LIMIT", "عمق انفجار BOM از سقف ۳۲ سطح بیشتر است");
      }
      const headerItems = itemsByHeaderId.get(currentHeader.Id) ?? [];
      if (headerItems.length === 0) {
        throw businessRule("MFG_BOM_EMPTY", `نسخهٔ BOM ${currentHeader.Revision} هیچ ردیفی ندارد`);
      }
      const baseQty = storedNumber(currentHeader.BaseQuantity, 1);
      const scale = baseQty > 0 ? parentQuantity / baseQty : parentQuantity;

      for (const item of headerItems) {
        if (lines.length >= 5000) {
          throw businessRule("MFG_BOM_NODE_LIMIT", "تعداد گره‌های انفجار BOM از سقف ۵۰۰۰ بیشتر است");
        }
        const component = partById.get(item.ComponentPartId);
        if (!component || component.PlantId !== plantId || component.IsActive !== true) {
          throw businessRule("MFG_BOM_COMPONENT_UNAVAILABLE", `قطعهٔ جزء ${item.ComponentPartId} غیرفعال یا خارج از کارخانه است`);
        }
        if (ancestors.has(component.Id)) {
          throw businessRule("MFG_BOM_CYCLE", `چرخه در ساختار BOM قطعهٔ ${component.PartNo ?? component.Id} تشخیص داده شد`);
        }

        const grossQuantity = roundQty(scale * storedNumber(item.QuantityPer, 0));
        const scrapAllowanceQty = roundQty(grossQuantity * (storedNumber(item.ScrapPct, 0) / 100));
        const netQuantity = roundQty(grossQuantity + scrapAllowanceQty);

        lines.push({
          PartId: component.Id,
          PartNo: component.PartNo,
          PartNameFa: component.NameFa,
          PartType: component.PartType,
          BomHeaderId: currentHeader.Id,
          BomItemId: item.Id,
          LineNo: item.LineNo,
          Uom: item.Uom,
          GrossQuantity: grossQuantity,
          ScrapAllowanceQty: scrapAllowanceQty,
          NetQuantity: netQuantity,
          Depth: depth,
          IsPhantom: Boolean(item.IsPhantom),
          IssueMethod: item.IssueMethod,
          IssueAtOperationCode: item.IssueAtOperationCode ?? null,
        });

        const requiresExpansion = item.IsPhantom === true || ["manufactured", "phantom"].includes(component.PartType);
        if (requiresExpansion) {
          const childBom = defaultBomForPart(component.Id);
          if (!childBom) {
            throw businessRule("MFG_BOM_CHILD_NOT_RELEASED", `BOM پیش‌فرض مؤثر برای زیرمونتاژ ${component.PartNo} وجود ندارد`);
          }
          const nextAncestors = new Set(ancestors);
          nextAncestors.add(component.Id);
          explodeLevel(childBom, netQuantity, depth + 1, nextAncestors);
        }
      }
    };

    explodeLevel(bom, quantity, 1, new Set([bom.PartId]));
    return {
      bomHeaderId: bom.Id,
      partId: bom.PartId,
      revision: bom.Revision,
      quantity,
      effectiveAt,
      lines,
    };
  }));

  app.get(`${ROOT}/routings`, route("mfg.routing.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "status", "effectiveAt", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);

    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.partId !== undefined) {
      const partId = text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE });
      const part = await r.get("MfgPart", partId);
      if (!part || part.PlantId !== plantId) throw notFound();
      where.push({ column: "PartId", op: "eq", value: partId });
    }
    if (q.status !== undefined) {
      const status = text(q.status, "status", { required: true, max: 24 });
      if (!BOM_STATUSES.has(status)) throw bad("status", "status باید draft/released/obsolete باشد");
      where.push({ column: "Status", op: "eq", value: status });
    }
    const effectiveAt = q.effectiveAt !== undefined ? isoDate(q.effectiveAt, "effectiveAt", { required: true }) : null;

    const allRows = await r.list("MfgRouting", {
      where,
      orderBy: [{ column: "PartId", dir: "asc" }, { column: "RoutingCode", dir: "asc" }, { column: "Revision", dir: "asc" }],
    });
    const filtered = effectiveAt ? allRows.filter((row) => effectiveOn(row, effectiveAt)) : allRows;
    const items = filtered.slice(offset, offset + limit);
    return { items, page: { limit, offset, total: filtered.length } };
  }));

  app.post(`${ROOT}/routings`, route("mfg.routing.edit", async ({ repo: r, req, plantId }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["PartId", "RoutingCode", "Revision", "BaseQuantity", "BaseUom", "EffectiveFrom", "EffectiveTo", "IsDefault", "NoteFa"]));
    const partId = text(body.PartId, "PartId", { required: true, max: 60, pattern: ID_RE });
    const part = await r.get("MfgPart", partId);
    if (!part || part.PlantId !== plantId) throw notFound();

    const routingCode = text(body.RoutingCode, "RoutingCode", { required: true, max: 60, pattern: CODE_RE });
    const revision = text(body.Revision, "Revision", { required: true, max: 60, pattern: CODE_RE });
    const baseQuantity = number(body.BaseQuantity ?? 1, "BaseQuantity", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    const baseUom = text(body.BaseUom ?? part.BaseUom, "BaseUom", { required: true, max: 16, pattern: /^[A-Za-z0-9._-]+$/ });
    const effectiveFrom = isoDate(body.EffectiveFrom, "EffectiveFrom", { required: true });
    const effectiveTo = body.EffectiveTo === undefined || body.EffectiveTo === null ? null : isoDate(body.EffectiveTo, "EffectiveTo", { required: true });
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw bad("EffectiveTo", "EffectiveTo نباید پیش از EffectiveFrom باشد");
    }
    const isDefault = bool(body.IsDefault, "IsDefault", false);
    const noteFa = text(body.NoteFa, "NoteFa", { max: 1000 });

    const duplicate = await r.findOne("MfgRouting", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "PartId", op: "eq", value: partId },
      { column: "RoutingCode", op: "eq", value: routingCode },
      { column: "Revision", op: "eq", value: revision },
    ]);
    if (duplicate) throw conflict("MFG_DUPLICATE", "این کد و نسخهٔ Routing برای قطعه قبلاً ثبت شده است");

    const row = await r.create("MfgRouting", {
      PlantId: plantId,
      PartId: partId,
      RoutingCode: routingCode,
      Revision: revision,
      Status: "draft",
      BaseQuantity: baseQuantity,
      BaseUom: baseUom,
      EffectiveFrom: effectiveFrom,
      EffectiveTo: effectiveTo,
      IsDefault: isDefault,
      ReleasedAt: null,
      ReleasedBy: null,
      NoteFa: noteFa,
    }, requestActor(req));
    await writeAudit(r, req, "MFG_ROUTING_CREATED", "MfgRouting", row.Id, "mfg.routing.edit");
    return row;
  }, 201));

  app.get(`${ROOT}/routings/:routingId`, route("mfg.routing.view", async ({ repo: r, req, plantId }) => {
    assertOnlyQueryKeys(req.query ?? {}, new Set());
    const routingId = text(req.params.routingId, "routingId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgRouting", routingId);
    if (!row || row.PlantId !== plantId) throw notFound();
    return row;
  }));

  app.patch(`${ROOT}/routings/:routingId`, route("mfg.routing.edit", async ({ repo: r, req, plantId }) => {
    const routingId = text(req.params.routingId, "routingId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["RoutingCode", "Revision", "BaseQuantity", "BaseUom", "EffectiveFrom", "EffectiveTo", "IsDefault", "NoteFa"]));
    if (Object.keys(body).length === 0) throw bad("body", "حداقل یک فیلد قابل‌ویرایش الزامی است");

    const existing = await r.get("MfgRouting", routingId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    if (existing.Status !== "draft") {
      throw businessRule("MFG_ROUTING_NOT_DRAFT", "فقط Routing در وضعیت draft قابل ویرایش است");
    }
    if (existing.RowVersion !== expectedRowVersion) {
      throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ Routing تغییر کرده است؛ آخرین نسخه را بخوانید");
    }

    const patchData = {};
    if (body.RoutingCode !== undefined) {
      patchData.RoutingCode = text(body.RoutingCode, "RoutingCode", { required: true, max: 60, pattern: CODE_RE });
    }
    if (body.Revision !== undefined) {
      patchData.Revision = text(body.Revision, "Revision", { required: true, max: 60, pattern: CODE_RE });
    }
    const nextCode = patchData.RoutingCode ?? existing.RoutingCode;
    const nextRev = patchData.Revision ?? existing.Revision;
    if (nextCode !== existing.RoutingCode || nextRev !== existing.Revision) {
      const duplicate = await r.findOne("MfgRouting", [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "PartId", op: "eq", value: existing.PartId },
        { column: "RoutingCode", op: "eq", value: nextCode },
        { column: "Revision", op: "eq", value: nextRev },
      ]);
      if (duplicate && duplicate.Id !== existing.Id) {
        throw conflict("MFG_DUPLICATE", "این کد و نسخهٔ Routing برای قطعه قبلاً ثبت شده است");
      }
    }
    if (body.BaseQuantity !== undefined) {
      patchData.BaseQuantity = number(body.BaseQuantity, "BaseQuantity", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    }
    if (body.BaseUom !== undefined) {
      patchData.BaseUom = text(body.BaseUom, "BaseUom", { required: true, max: 16, pattern: /^[A-Za-z0-9._-]+$/ });
    }
    if (body.EffectiveFrom !== undefined) {
      patchData.EffectiveFrom = isoDate(body.EffectiveFrom, "EffectiveFrom", { required: true });
    }
    if (body.EffectiveTo !== undefined) {
      patchData.EffectiveTo = body.EffectiveTo === null ? null : isoDate(body.EffectiveTo, "EffectiveTo", { required: true });
    }
    const finalFrom = patchData.EffectiveFrom ?? dateOnly(existing.EffectiveFrom);
    const finalTo = patchData.EffectiveTo !== undefined ? patchData.EffectiveTo : dateOnly(existing.EffectiveTo);
    if (finalTo && finalFrom && finalTo < finalFrom) {
      throw bad("EffectiveTo", "EffectiveTo نباید پیش از EffectiveFrom باشد");
    }
    if (body.IsDefault !== undefined) {
      patchData.IsDefault = bool(body.IsDefault, "IsDefault");
    }
    if (body.NoteFa !== undefined) {
      patchData.NoteFa = body.NoteFa === null ? null : text(body.NoteFa, "NoteFa", { max: 1000 });
    }

    const resPatch = await r.patch("MfgRouting", existing.Id, patchData, requestActor(req), expectedRowVersion);
    if (!resPatch.ok) throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ Routing تغییر کرده است");
    const updated = await r.get("MfgRouting", existing.Id);
    await writeAudit(r, req, "MFG_ROUTING_UPDATED", "MfgRouting", existing.Id, "mfg.routing.edit");
    return updated;
  }));

  app.get(`${ROOT}/routings/:routingId/operations`, route("mfg.routing.view", async ({ repo: r, req, plantId }) => {
    const routingId = text(req.params.routingId, "routingId", { required: true, max: 60, pattern: ID_RE });
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);

    const routing = await r.get("MfgRouting", routingId);
    if (!routing || routing.PlantId !== plantId) throw notFound();

    const where = [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "RoutingId", op: "eq", value: routing.Id },
    ];
    const [items, total] = await Promise.all([
      r.list("MfgRoutingOperation", { where, orderBy: [{ column: "SequenceNo", dir: "asc" }], limit, offset }),
      r.count("MfgRoutingOperation", where),
    ]);
    return { items, page: { limit, offset, total } };
  }));

  app.post(`${ROOT}/routings/:routingId/operations`, route("mfg.routing.edit", async ({ repo: r, req, plantId }) => {
    const routingId = text(req.params.routingId, "routingId", { required: true, max: 60, pattern: ID_RE });
    const routing = await r.get("MfgRouting", routingId);
    if (!routing || routing.PlantId !== plantId) throw notFound();
    if (routing.Status !== "draft") {
      throw businessRule("MFG_ROUTING_NOT_DRAFT", "افزودن Operation فقط به Routing در وضعیت draft مجاز است");
    }

    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "SequenceNo", "OperationCode", "OperationNameFa", "OperationNameEn",
      "WorkCenterId", "SetupMinutes", "RunMinutesPerUnit", "QueueMinutes", "MoveMinutes",
      "OverlapAllowed", "TransferBatchQty", "PredecessorSequence", "InspectionRequired",
      "CostCenterId", "WorkInstructionRef", "NoteFa",
    ]));

    const sequenceNo = number(body.SequenceNo, "SequenceNo", { required: true, integer: true, min: 1, max: 100_000 });
    const operationCode = text(body.OperationCode, "OperationCode", { required: true, max: 60, pattern: CODE_RE });
    const operationNameFa = text(body.OperationNameFa, "OperationNameFa", { required: true, max: 240 });
    const operationNameEn = text(body.OperationNameEn, "OperationNameEn", { max: 240 });
    const workCenterId = text(body.WorkCenterId, "WorkCenterId", { required: true, max: 60, pattern: ID_RE });
    const workCenter = await r.get("MfgWorkCenter", workCenterId);
    if (!workCenter || workCenter.PlantId !== plantId) throw notFound();

    const setupMinutes = number(body.SetupMinutes ?? 0, "SetupMinutes", { required: true, min: 0, max: 1_000_000 });
    const runMinutesPerUnit = number(body.RunMinutesPerUnit, "RunMinutesPerUnit", { required: true, min: 0, max: 1_000_000 });
    const queueMinutes = number(body.QueueMinutes ?? 0, "QueueMinutes", { required: true, min: 0, max: 1_000_000 });
    const moveMinutes = number(body.MoveMinutes ?? 0, "MoveMinutes", { required: true, min: 0, max: 1_000_000 });
    const overlapAllowed = bool(body.OverlapAllowed, "OverlapAllowed", false);
    const transferBatchQty = body.TransferBatchQty === undefined || body.TransferBatchQty === null
      ? null
      : number(body.TransferBatchQty, "TransferBatchQty", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    if (overlapAllowed && !(transferBatchQty !== null && transferBatchQty > 0)) {
      throw businessRule("MFG_ROUTING_OVERLAP_INVALID", "وقتی OverlapAllowed فعال است، TransferBatchQty باید مثبت باشد");
    }

    const predecessorSequence = body.PredecessorSequence === undefined || body.PredecessorSequence === null
      ? null
      : number(body.PredecessorSequence, "PredecessorSequence", { required: true, integer: true, min: 1, max: 100_000 });
    if (predecessorSequence !== null && predecessorSequence >= sequenceNo) {
      throw businessRule("MFG_ROUTING_PREDECESSOR_INVALID", "PredecessorSequence باید کوچک‌تر از SequenceNo باشد");
    }

    const inspectionRequired = bool(body.InspectionRequired, "InspectionRequired", false);
    let costCenterId = null;
    if (body.CostCenterId !== undefined && body.CostCenterId !== null) {
      costCenterId = text(body.CostCenterId, "CostCenterId", { required: true, max: 60, pattern: ID_RE });
      const costCenter = await r.get("MfgCostCenter", costCenterId);
      if (!costCenter || costCenter.PlantId !== plantId) throw notFound();
    }
    const workInstructionRef = text(body.WorkInstructionRef, "WorkInstructionRef", { max: 120 });
    const noteFa = text(body.NoteFa, "NoteFa", { max: 800 });

    const existingOps = await r.list("MfgRoutingOperation", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "RoutingId", op: "eq", value: routing.Id },
      ],
    });
    if (existingOps.some((op) => op.SequenceNo === sequenceNo)) {
      throw conflict("MFG_DUPLICATE", "SequenceNo در این Routing تکراری است");
    }
    if (predecessorSequence !== null && !existingOps.some((op) => op.SequenceNo === predecessorSequence)) {
      throw businessRule("MFG_ROUTING_PREDECESSOR_INVALID", "Operation پیش‌نیاز با این SequenceNo در Routing وجود ندارد");
    }

    const row = await r.create("MfgRoutingOperation", {
      PlantId: plantId,
      RoutingId: routing.Id,
      SequenceNo: sequenceNo,
      OperationCode: operationCode,
      OperationNameFa: operationNameFa,
      OperationNameEn: operationNameEn,
      WorkCenterId: workCenter.Id,
      SetupMinutes: setupMinutes,
      RunMinutesPerUnit: runMinutesPerUnit,
      QueueMinutes: queueMinutes,
      MoveMinutes: moveMinutes,
      OverlapAllowed: overlapAllowed,
      TransferBatchQty: transferBatchQty,
      PredecessorSequence: predecessorSequence,
      InspectionRequired: inspectionRequired,
      CostCenterId: costCenterId,
      WorkInstructionRef: workInstructionRef,
      NoteFa: noteFa,
    }, requestActor(req));
    await writeAudit(r, req, "MFG_ROUTING_OPERATION_CREATED", "MfgRoutingOperation", row.Id, "mfg.routing.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/routing-operations/:routingOperationId`, route("mfg.routing.edit", async ({ repo: r, req, plantId }) => {
    const routingOperationId = text(req.params.routingOperationId, "routingOperationId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "SequenceNo", "OperationCode", "OperationNameFa", "OperationNameEn",
      "WorkCenterId", "SetupMinutes", "RunMinutesPerUnit", "QueueMinutes", "MoveMinutes",
      "OverlapAllowed", "TransferBatchQty", "PredecessorSequence", "InspectionRequired",
      "CostCenterId", "WorkInstructionRef", "NoteFa",
    ]));
    if (Object.keys(body).length === 0) throw bad("body", "حداقل یک فیلد قابل‌ویرایش الزامی است");

    const existing = await r.get("MfgRoutingOperation", routingOperationId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    const routing = await r.get("MfgRouting", existing.RoutingId);
    if (!routing || routing.PlantId !== plantId) throw notFound();
    if (routing.Status !== "draft") {
      throw businessRule("MFG_ROUTING_NOT_DRAFT", "ویرایش Operation فقط برای Routing در وضعیت draft مجاز است");
    }
    if (existing.RowVersion !== expectedRowVersion) {
      throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ Operation تغییر کرده است؛ آخرین نسخه را بخوانید");
    }

    const allOps = await r.list("MfgRoutingOperation", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "RoutingId", op: "eq", value: routing.Id },
      ],
    });

    const patchData = {};
    if (body.SequenceNo !== undefined) {
      const sequenceNo = number(body.SequenceNo, "SequenceNo", { required: true, integer: true, min: 1, max: 100_000 });
      if (sequenceNo !== existing.SequenceNo) {
        if (allOps.some((op) => op.Id !== existing.Id && op.SequenceNo === sequenceNo)) {
          throw conflict("MFG_DUPLICATE", "SequenceNo در این Routing تکراری است");
        }
        if (allOps.some((op) => op.Id !== existing.Id && op.PredecessorSequence === existing.SequenceNo && sequenceNo >= op.SequenceNo)) {
          throw businessRule("MFG_ROUTING_PREDECESSOR_INVALID", "تغییر SequenceNo پیش‌نیاز عملیات پسین را نامعتبر می‌کند");
        }
      }
      patchData.SequenceNo = sequenceNo;
    }
    if (body.OperationCode !== undefined) {
      patchData.OperationCode = text(body.OperationCode, "OperationCode", { required: true, max: 60, pattern: CODE_RE });
    }
    if (body.OperationNameFa !== undefined) {
      patchData.OperationNameFa = text(body.OperationNameFa, "OperationNameFa", { required: true, max: 240 });
    }
    if (body.OperationNameEn !== undefined) {
      patchData.OperationNameEn = body.OperationNameEn === null ? null : text(body.OperationNameEn, "OperationNameEn", { max: 240 });
    }
    if (body.WorkCenterId !== undefined) {
      const workCenterId = text(body.WorkCenterId, "WorkCenterId", { required: true, max: 60, pattern: ID_RE });
      const workCenter = await r.get("MfgWorkCenter", workCenterId);
      if (!workCenter || workCenter.PlantId !== plantId) throw notFound();
      patchData.WorkCenterId = workCenter.Id;
    }
    if (body.SetupMinutes !== undefined) {
      patchData.SetupMinutes = number(body.SetupMinutes, "SetupMinutes", { required: true, min: 0, max: 1_000_000 });
    }
    if (body.RunMinutesPerUnit !== undefined) {
      patchData.RunMinutesPerUnit = number(body.RunMinutesPerUnit, "RunMinutesPerUnit", { required: true, min: 0, max: 1_000_000 });
    }
    if (body.QueueMinutes !== undefined) {
      patchData.QueueMinutes = number(body.QueueMinutes, "QueueMinutes", { required: true, min: 0, max: 1_000_000 });
    }
    if (body.MoveMinutes !== undefined) {
      patchData.MoveMinutes = number(body.MoveMinutes, "MoveMinutes", { required: true, min: 0, max: 1_000_000 });
    }
    if (body.OverlapAllowed !== undefined) {
      patchData.OverlapAllowed = bool(body.OverlapAllowed, "OverlapAllowed");
    }
    if (body.TransferBatchQty !== undefined) {
      patchData.TransferBatchQty = body.TransferBatchQty === null
        ? null
        : number(body.TransferBatchQty, "TransferBatchQty", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    }
    const finalOverlap = patchData.OverlapAllowed ?? existing.OverlapAllowed;
    const finalTransferBatch = patchData.TransferBatchQty !== undefined ? patchData.TransferBatchQty : existing.TransferBatchQty;
    if (finalOverlap && !(finalTransferBatch !== null && finalTransferBatch > 0)) {
      throw businessRule("MFG_ROUTING_OVERLAP_INVALID", "وقتی OverlapAllowed فعال است، TransferBatchQty باید مثبت باشد");
    }

    if (body.PredecessorSequence !== undefined) {
      patchData.PredecessorSequence = body.PredecessorSequence === null
        ? null
        : number(body.PredecessorSequence, "PredecessorSequence", { required: true, integer: true, min: 1, max: 100_000 });
    }
    const finalSeq = patchData.SequenceNo ?? existing.SequenceNo;
    const finalPred = patchData.PredecessorSequence !== undefined ? patchData.PredecessorSequence : existing.PredecessorSequence;
    if (finalPred !== null) {
      if (finalPred >= finalSeq || !allOps.some((op) => op.Id !== existing.Id && op.SequenceNo === finalPred)) {
        throw businessRule("MFG_ROUTING_PREDECESSOR_INVALID", "PredecessorSequence باید کوچک‌تر از SequenceNo و موجود در Routing باشد");
      }
    }

    if (body.InspectionRequired !== undefined) {
      patchData.InspectionRequired = bool(body.InspectionRequired, "InspectionRequired");
    }
    if (body.CostCenterId !== undefined) {
      if (body.CostCenterId === null) {
        patchData.CostCenterId = null;
      } else {
        const costCenterId = text(body.CostCenterId, "CostCenterId", { required: true, max: 60, pattern: ID_RE });
        const costCenter = await r.get("MfgCostCenter", costCenterId);
        if (!costCenter || costCenter.PlantId !== plantId) throw notFound();
        patchData.CostCenterId = costCenter.Id;
      }
    }
    if (body.WorkInstructionRef !== undefined) {
      patchData.WorkInstructionRef = body.WorkInstructionRef === null ? null : text(body.WorkInstructionRef, "WorkInstructionRef", { max: 120 });
    }
    if (body.NoteFa !== undefined) {
      patchData.NoteFa = body.NoteFa === null ? null : text(body.NoteFa, "NoteFa", { max: 800 });
    }

    const resPatch = await r.patch("MfgRoutingOperation", existing.Id, patchData, requestActor(req), expectedRowVersion);
    if (!resPatch.ok) throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ Operation تغییر کرده است");
    const updated = await r.get("MfgRoutingOperation", existing.Id);
    await writeAudit(r, req, "MFG_ROUTING_OPERATION_UPDATED", "MfgRoutingOperation", existing.Id, "mfg.routing.edit");
    return updated;
  }));

  if (typeof app.delete === "function") {
    app.delete(`${ROOT}/routing-operations/:routingOperationId`, route("mfg.routing.edit", async ({ repo: r, req, plantId }) => {
      const routingOperationId = text(req.params.routingOperationId, "routingOperationId", { required: true, max: 60, pattern: ID_RE });
      const existing = await r.get("MfgRoutingOperation", routingOperationId);
      if (!existing || existing.PlantId !== plantId) throw notFound();
      const routing = await r.get("MfgRouting", existing.RoutingId);
      if (!routing || routing.PlantId !== plantId) throw notFound();
      if (routing.Status !== "draft") {
        throw businessRule("MFG_ROUTING_NOT_DRAFT", "حذف Operation فقط از Routing در وضعیت draft مجاز است");
      }

      const [siblingOps, ordersUsingRouting, orderOpsUsingRoutingOp] = await Promise.all([
        r.list("MfgRoutingOperation", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "RoutingId", op: "eq", value: routing.Id },
          ],
        }),
        r.list("MfgProductionOrder", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "RoutingId", op: "eq", value: routing.Id },
          ],
        }),
        r.list("MfgProductionOrderOperation", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "RoutingOperationId", op: "eq", value: existing.Id },
          ],
          limit: 1,
        }),
      ]);

      if (orderOpsUsingRoutingOp.length > 0 || ordersUsingRouting.some((order) => order.Status !== "created")) {
        throw businessRule("MFG_ROUTING_OPERATION_IN_USE", "این Operation در سفارش تولید مصرف شده و قابل حذف نیست");
      }
      if (siblingOps.some((op) => op.Id !== existing.Id && op.PredecessorSequence === existing.SequenceNo)) {
        throw businessRule("MFG_ROUTING_PREDECESSOR_IN_USE", "عملیات دیگری در این Routing به این توالی وابسته است");
      }

      return r.transaction(async (tx) => {
        await tx.remove("MfgRoutingOperation", existing.Id);
        await createAuditRecord(tx, req, "MFG_ROUTING_OPERATION_DELETED", "MfgRoutingOperation", existing.Id, "mfg.routing.edit", {
          routingId: routing.Id,
          sequenceNo: existing.SequenceNo,
        });
        return null;
      });
    }, 204));
  }

  app.post(`${ROOT}/routings/:routingId/release`, route("mfg.routing.release", async ({ repo: r, req, plantId }) => {
    const routingId = text(req.params.routingId, "routingId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["EffectiveAt"]));

    return r.transaction(async (tx) => {
      const routing = await tx.get("MfgRouting", routingId);
      if (!routing || routing.PlantId !== plantId) throw notFound();
      if (routing.RowVersion !== expectedRowVersion) {
        throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ Routing تغییر کرده است؛ آخرین نسخه را بخوانید");
      }
      if (routing.Status !== "draft") {
        throw businessRule("MFG_ROUTING_INVALID_STATE", "فقط Routing در وضعیت draft قابل آزادسازی است");
      }

      const parentPart = await tx.get("MfgPart", routing.PartId);
      if (!parentPart || parentPart.PlantId !== plantId || parentPart.IsActive !== true) {
        throw businessRule("MFG_PART_INACTIVE", "قطعهٔ والد Routing غیرفعال یا نامعتبر است");
      }

      const effectiveAt = body.EffectiveAt !== undefined
        ? isoDate(body.EffectiveAt, "EffectiveAt", { required: true })
        : (dateOnly(routing.EffectiveFrom) ?? new Date().toISOString().slice(0, 10));
      if (!effectiveOn(routing, effectiveAt)) {
        throw businessRule("MFG_ROUTING_NOT_EFFECTIVE", "Routing در تاریخ موردنظر مؤثر نیست");
      }

      if (routing.IsDefault === true) {
        const otherDefaults = await tx.list("MfgRouting", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "PartId", op: "eq", value: routing.PartId },
            { column: "Status", op: "eq", value: "released" },
            { column: "IsDefault", op: "eq", value: true },
          ],
        });
        const fromA = dateOnly(routing.EffectiveFrom);
        const toA = dateOnly(routing.EffectiveTo) ?? "9999-12-31";
        const overlapping = otherDefaults.find((other) => {
          if (other.Id === routing.Id) return false;
          const fromB = dateOnly(other.EffectiveFrom);
          const toB = dateOnly(other.EffectiveTo) ?? "9999-12-31";
          return fromA <= toB && fromB <= toA;
        });
        if (overlapping) {
          throw conflict("MFG_ROUTING_DEFAULT_OVERLAP", `نسخهٔ پیش‌فرض آزادشدهٔ دیگری (${overlapping.RoutingCode}/${overlapping.Revision}) در این بازهٔ زمانی فعال است`);
        }
      }

      await validateRoutingForRelease(tx, routing, plantId, effectiveAt);

      const releasedAt = new Date().toISOString();
      const patchRes = await tx.patch("MfgRouting", routing.Id, {
        Status: "released",
        ReleasedAt: releasedAt,
        ReleasedBy: requestActor(req),
      }, requestActor(req), expectedRowVersion);
      if (!patchRes.ok) {
        throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ Routing تغییر کرده است");
      }

      const released = await tx.get("MfgRouting", routing.Id);
      await createAuditRecord(tx, req, "MFG_ROUTING_RELEASED", "MfgRouting", routing.Id, "mfg.routing.release", {
        routingCode: routing.RoutingCode,
        revision: routing.Revision,
        effectiveAt,
      });
      return released;
    });
  }));

  app.get(`${ROOT}/work-centers`, route("mfg.workcenter.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["kind", "status", "q", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);

    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.kind !== undefined) {
      const kind = text(q.kind, "kind", { required: true, max: 20 });
      if (!WORK_CENTER_KINDS.has(kind)) throw bad("kind", "kind باید machine/labor/assembly/inspection باشد");
      where.push({ column: "Kind", op: "eq", value: kind });
    }
    if (q.status !== undefined) {
      const status = text(q.status, "status", { required: true, max: 24 });
      if (!WORK_CENTER_STATUSES.has(status)) throw bad("status", "status باید active/inactive/maintenance باشد");
      where.push({ column: "Status", op: "eq", value: status });
    }
    const needle = q.q !== undefined ? text(q.q, "q", { required: true, max: 60 }).toLowerCase() : null;

    const allRows = await r.list("MfgWorkCenter", {
      where,
      orderBy: [{ column: "Code", dir: "asc" }],
    });
    const filtered = needle
      ? allRows.filter((row) => String(row.Code ?? "").toLowerCase().includes(needle)
        || String(row.NameFa ?? "").toLowerCase().includes(needle)
        || String(row.NameEn ?? "").toLowerCase().includes(needle))
      : allRows;
    const items = filtered.slice(offset, offset + limit);
    return { items, page: { limit, offset, total: filtered.length } };
  }));

  app.post(`${ROOT}/work-centers`, route("mfg.workcenter.edit", async ({ repo: r, req, plantId }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "Code", "NameFa", "NameEn", "Kind", "NominalCapacityMinutesPerDay",
      "EfficiencyPct", "CostCenterId", "TimeZoneId", "Status", "DescriptionFa", "Rates",
    ]));

    const code = text(body.Code, "Code", { required: true, max: 60, pattern: CODE_RE });
    const nameFa = text(body.NameFa, "NameFa", { required: true, max: 240 });
    const nameEn = text(body.NameEn, "NameEn", { max: 240 });
    const kind = text(body.Kind, "Kind", { required: true, max: 20 });
    if (!WORK_CENTER_KINDS.has(kind)) throw bad("Kind", "Kind باید machine/labor/assembly/inspection باشد");

    const nominalCapacityMinutesPerDay = number(body.NominalCapacityMinutesPerDay ?? 480, "NominalCapacityMinutesPerDay", {
      required: true,
      integer: true,
      min: 1,
      max: 1_000_000,
    });
    const efficiencyPct = number(body.EfficiencyPct ?? 100, "EfficiencyPct", { required: true, min: 0, max: 100 });

    let costCenterId = null;
    if (body.CostCenterId !== undefined && body.CostCenterId !== null) {
      costCenterId = text(body.CostCenterId, "CostCenterId", { required: true, max: 60, pattern: ID_RE });
      const costCenter = await r.get("MfgCostCenter", costCenterId);
      if (!costCenter || costCenter.PlantId !== plantId) throw notFound();
    }

    const timeZoneId = text(body.TimeZoneId, "TimeZoneId", { required: true, max: 80 });
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timeZoneId });
    } catch {
      throw bad("TimeZoneId", `منطقهٔ زمانی «${timeZoneId}» معتبر نیست`);
    }

    const status = text(body.Status ?? "active", "Status", { required: true, max: 24 });
    if (!WORK_CENTER_STATUSES.has(status)) throw bad("Status", "Status باید active/inactive/maintenance باشد");
    const descriptionFa = text(body.DescriptionFa, "DescriptionFa", { max: 1000 });

    /* نرخ ساعتی عناصر هزینه فقط در `MfgCostCenter` نگه داشته می‌شود و قرارداد
     * ۵.۳ مسیری برای ساخت آن ندارد؛ بدون این بلوک، رول‌آپ هزینه در عناصر
     * ماشین/نیروی کار/سربار همیشه صفر می‌ماند. بلوک اختیاری `Rates` همان
     * ردیف‌ها را در UoW مرکز کاری می‌سازد. */
    const rates = parseWorkCenterRates(body.Rates, { code });

    const created = await r.transaction(async (tx) => {
      const duplicate = await tx.findOne("MfgWorkCenter", [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "Code", op: "eq", value: code },
      ]);
      if (duplicate) throw conflict("MFG_DUPLICATE", "کد مرکز کاری در این کارخانه تکراری است");

      const costCenters = [];
      for (const rate of rates) {
        const existing = await tx.findOne("MfgCostCenter", [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "Code", op: "eq", value: rate.Code },
          { column: "EffectiveFrom", op: "eq", value: rate.EffectiveFrom },
        ]);
        if (existing) throw conflict("MFG_DUPLICATE", `مرکز هزینهٔ ${rate.Code} در این کارخانه و تاریخ تکراری است`);
        costCenters.push(await tx.create("MfgCostCenter", {
          PlantId: plantId,
          Code: rate.Code,
          NameFa: rate.NameFa,
          CostElement: rate.CostElement,
          HourlyRate: rate.HourlyRate,
          Currency: rate.Currency,
          AllocationBasis: rate.AllocationBasis,
          EffectiveFrom: rate.EffectiveFrom,
          EffectiveTo: rate.EffectiveTo,
          IsActive: true,
        }, requestActor(req)));
      }

      const row = await tx.create("MfgWorkCenter", {
        PlantId: plantId,
        Code: code,
        NameFa: nameFa,
        NameEn: nameEn,
        Kind: kind,
        NominalCapacityMinutesPerDay: nominalCapacityMinutesPerDay,
        EfficiencyPct: efficiencyPct,
        CostCenterId: costCenterId ?? costCenters.find((center) => center.CostElement === "machine")?.Id ?? costCenters[0]?.Id ?? null,
        TimeZoneId: timeZoneId,
        Status: status,
        DescriptionFa: descriptionFa,
      }, requestActor(req));
      await createAuditRecord(tx, req, "MFG_WORK_CENTER_CREATED", "MfgWorkCenter", row.Id, "mfg.workcenter.edit", {
        costCenterIds: costCenters.map((center) => center.Id),
      });
      return { row, costCenters };
    });

    if (rates.length === 0) return created.row;
    return { ...created.row, CostCenters: created.costCenters };
  }, 201));

  app.get(`${ROOT}/work-centers/:workCenterId`, route("mfg.workcenter.view", async ({ repo: r, req, plantId }) => {
    assertOnlyQueryKeys(req.query ?? {}, new Set());
    const workCenterId = text(req.params.workCenterId, "workCenterId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgWorkCenter", workCenterId);
    if (!row || row.PlantId !== plantId) throw notFound();
    return row;
  }));

  app.patch(`${ROOT}/work-centers/:workCenterId`, route("mfg.workcenter.edit", async ({ repo: r, req, plantId }) => {
    const workCenterId = text(req.params.workCenterId, "workCenterId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "NameFa", "NameEn", "Kind", "NominalCapacityMinutesPerDay",
      "EfficiencyPct", "CostCenterId", "TimeZoneId", "Status", "DescriptionFa",
    ]));
    if (Object.keys(body).length === 0) throw bad("body", "حداقل یک فیلد قابل‌ویرایش الزامی است");

    const existing = await r.get("MfgWorkCenter", workCenterId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    if (existing.RowVersion !== expectedRowVersion) {
      throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ مرکز کاری تغییر کرده است؛ آخرین نسخه را بخوانید");
    }

    const patchData = {};
    if (body.NameFa !== undefined) patchData.NameFa = text(body.NameFa, "NameFa", { required: true, max: 240 });
    if (body.NameEn !== undefined) patchData.NameEn = body.NameEn === null ? null : text(body.NameEn, "NameEn", { max: 240 });
    if (body.Kind !== undefined) {
      const kind = text(body.Kind, "Kind", { required: true, max: 20 });
      if (!WORK_CENTER_KINDS.has(kind)) throw bad("Kind", "Kind باید machine/labor/assembly/inspection باشد");
      patchData.Kind = kind;
    }
    if (body.NominalCapacityMinutesPerDay !== undefined) {
      patchData.NominalCapacityMinutesPerDay = number(body.NominalCapacityMinutesPerDay, "NominalCapacityMinutesPerDay", {
        required: true,
        integer: true,
        min: 1,
        max: 1_000_000,
      });
    }
    if (body.EfficiencyPct !== undefined) {
      patchData.EfficiencyPct = number(body.EfficiencyPct, "EfficiencyPct", { required: true, min: 0, max: 100 });
    }
    if (body.CostCenterId !== undefined) {
      if (body.CostCenterId === null) {
        patchData.CostCenterId = null;
      } else {
        const costCenterId = text(body.CostCenterId, "CostCenterId", { required: true, max: 60, pattern: ID_RE });
        const costCenter = await r.get("MfgCostCenter", costCenterId);
        if (!costCenter || costCenter.PlantId !== plantId) throw notFound();
        patchData.CostCenterId = costCenter.Id;
      }
    }
    if (body.TimeZoneId !== undefined) {
      const timeZoneId = text(body.TimeZoneId, "TimeZoneId", { required: true, max: 80 });
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timeZoneId });
      } catch {
        throw bad("TimeZoneId", `منطقهٔ زمانی «${timeZoneId}» معتبر نیست`);
      }
      patchData.TimeZoneId = timeZoneId;
    }
    if (body.Status !== undefined) {
      const status = text(body.Status, "Status", { required: true, max: 24 });
      if (!WORK_CENTER_STATUSES.has(status)) throw bad("Status", "Status باید active/inactive/maintenance باشد");
      if (status !== "active" && existing.Status === "active") {
        const [opsOnWc, runningExecs] = await Promise.all([
          r.list("MfgProductionOrderOperation", {
            where: [
              { column: "PlantId", op: "eq", value: plantId },
              { column: "WorkCenterId", op: "eq", value: existing.Id },
            ],
          }),
          r.list("MfgOperationExecution", {
            where: [
              { column: "PlantId", op: "eq", value: plantId },
              { column: "WorkCenterId", op: "eq", value: existing.Id },
              { column: "Status", op: "eq", value: "running" },
            ],
            limit: 1,
          }),
        ]);
        if (runningExecs.length > 0 || opsOnWc.some((op) => ["setup", "running"].includes(op.Status))) {
          throw businessRule("MFG_WORK_CENTER_HAS_ACTIVE_OPERATIONS", "مرکز کاری دارای عملیات در حال اجراست و قابل غیرفعال‌سازی نیست");
        }
      }
      patchData.Status = status;
    }
    if (body.DescriptionFa !== undefined) {
      patchData.DescriptionFa = body.DescriptionFa === null ? null : text(body.DescriptionFa, "DescriptionFa", { max: 1000 });
    }

    const resPatch = await r.patch("MfgWorkCenter", existing.Id, patchData, requestActor(req), expectedRowVersion);
    if (!resPatch.ok) throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ مرکز کاری تغییر کرده است");
    const updated = await r.get("MfgWorkCenter", existing.Id);
    await writeAudit(r, req, "MFG_WORK_CENTER_UPDATED", "MfgWorkCenter", existing.Id, "mfg.workcenter.edit");
    return updated;
  }));

  app.get(`${ROOT}/work-centers/:workCenterId/resources`, route("mfg.workcenter.view", async ({ repo: r, req, plantId }) => {
    const workCenterId = text(req.params.workCenterId, "workCenterId", { required: true, max: 60, pattern: ID_RE });
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["activeOnly", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);

    const wc = await r.get("MfgWorkCenter", workCenterId);
    if (!wc || wc.PlantId !== plantId) throw notFound();

    const where = [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "WorkCenterId", op: "eq", value: wc.Id },
    ];
    if (q.activeOnly !== undefined) {
      if (!/^(true|false)$/.test(String(q.activeOnly))) throw bad("activeOnly", "activeOnly باید true یا false باشد");
      if (String(q.activeOnly) === "true") {
        where.push({ column: "IsActive", op: "eq", value: true });
      }
    }

    const [items, total] = await Promise.all([
      r.list("MfgWorkCenterResource", { where, orderBy: [{ column: "ResourceCode", dir: "asc" }], limit, offset }),
      r.count("MfgWorkCenterResource", where),
    ]);
    return { items, page: { limit, offset, total } };
  }));

  app.post(`${ROOT}/work-centers/:workCenterId/resources`, route("mfg.workcenter.edit", async ({ repo: r, req, plantId }) => {
    const workCenterId = text(req.params.workCenterId, "workCenterId", { required: true, max: 60, pattern: ID_RE });
    const wc = await r.get("MfgWorkCenter", workCenterId);
    if (!wc || wc.PlantId !== plantId) throw notFound();

    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "ResourceCode", "NameFa", "ResourceKind", "CapacityUnits",
      "AvailabilityPct", "EquipmentId", "CostCenterId", "IsActive",
      "EffectiveFrom", "EffectiveTo",
    ]));

    const resourceCode = text(body.ResourceCode, "ResourceCode", { required: true, max: 60, pattern: CODE_RE });
    const nameFa = text(body.NameFa, "NameFa", { required: true, max: 200 });
    const resourceKind = text(body.ResourceKind, "ResourceKind", { required: true, max: 12 });
    if (!RESOURCE_KINDS.has(resourceKind)) throw bad("ResourceKind", "ResourceKind باید machine یا labor باشد");

    const capacityUnits = number(body.CapacityUnits, "CapacityUnits", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    const availabilityPct = number(body.AvailabilityPct ?? 100, "AvailabilityPct", { required: true, min: 0, max: 100 });
    const equipmentId = body.EquipmentId === undefined || body.EquipmentId === null
      ? null
      : text(body.EquipmentId, "EquipmentId", { required: true, max: 60, pattern: ID_RE });
    let costCenterId = null;
    if (body.CostCenterId !== undefined && body.CostCenterId !== null) {
      costCenterId = text(body.CostCenterId, "CostCenterId", { required: true, max: 60, pattern: ID_RE });
      const costCenter = await r.get("MfgCostCenter", costCenterId);
      if (!costCenter || costCenter.PlantId !== plantId) throw notFound();
    }
    const isActive = bool(body.IsActive, "IsActive", true);
    const effectiveFrom = body.EffectiveFrom === undefined || body.EffectiveFrom === null
      ? null
      : isoDate(body.EffectiveFrom, "EffectiveFrom", { required: true });
    const effectiveTo = body.EffectiveTo === undefined || body.EffectiveTo === null
      ? null
      : isoDate(body.EffectiveTo, "EffectiveTo", { required: true });
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      throw bad("EffectiveTo", "EffectiveTo نباید پیش از EffectiveFrom باشد");
    }

    const duplicate = await r.findOne("MfgWorkCenterResource", [
      { column: "WorkCenterId", op: "eq", value: wc.Id },
      { column: "ResourceCode", op: "eq", value: resourceCode },
    ]);
    if (duplicate) throw conflict("MFG_DUPLICATE", "ResourceCode در این مرکز کاری تکراری است");

    const row = await r.create("MfgWorkCenterResource", {
      PlantId: plantId,
      WorkCenterId: wc.Id,
      ResourceCode: resourceCode,
      NameFa: nameFa,
      ResourceKind: resourceKind,
      CapacityUnits: capacityUnits,
      AvailabilityPct: availabilityPct,
      EquipmentId: equipmentId,
      CostCenterId: costCenterId,
      IsActive: isActive,
      EffectiveFrom: effectiveFrom,
      EffectiveTo: effectiveTo,
    }, requestActor(req));
    await writeAudit(r, req, "MFG_WORK_CENTER_RESOURCE_CREATED", "MfgWorkCenterResource", row.Id, "mfg.workcenter.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/work-center-resources/:resourceId`, route("mfg.workcenter.edit", async ({ repo: r, req, plantId }) => {
    const resourceId = text(req.params.resourceId, "resourceId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "NameFa", "ResourceKind", "CapacityUnits", "AvailabilityPct",
      "EquipmentId", "CostCenterId", "IsActive", "EffectiveFrom", "EffectiveTo",
    ]));
    if (Object.keys(body).length === 0) throw bad("body", "حداقل یک فیلد قابل‌ویرایش الزامی است");

    const existing = await r.get("MfgWorkCenterResource", resourceId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    if (existing.RowVersion !== expectedRowVersion) {
      throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ منبع تغییر کرده است؛ آخرین نسخه را بخوانید");
    }

    const patchData = {};
    if (body.NameFa !== undefined) patchData.NameFa = text(body.NameFa, "NameFa", { required: true, max: 200 });
    if (body.ResourceKind !== undefined) {
      const resourceKind = text(body.ResourceKind, "ResourceKind", { required: true, max: 12 });
      if (!RESOURCE_KINDS.has(resourceKind)) throw bad("ResourceKind", "ResourceKind باید machine یا labor باشد");
      patchData.ResourceKind = resourceKind;
    }
    if (body.CapacityUnits !== undefined) {
      patchData.CapacityUnits = number(body.CapacityUnits, "CapacityUnits", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    }
    if (body.AvailabilityPct !== undefined) {
      patchData.AvailabilityPct = number(body.AvailabilityPct, "AvailabilityPct", { required: true, min: 0, max: 100 });
    }
    if (body.EquipmentId !== undefined) {
      patchData.EquipmentId = body.EquipmentId === null
        ? null
        : text(body.EquipmentId, "EquipmentId", { required: true, max: 60, pattern: ID_RE });
    }
    if (body.CostCenterId !== undefined) {
      if (body.CostCenterId === null) {
        patchData.CostCenterId = null;
      } else {
        const costCenterId = text(body.CostCenterId, "CostCenterId", { required: true, max: 60, pattern: ID_RE });
        const costCenter = await r.get("MfgCostCenter", costCenterId);
        if (!costCenter || costCenter.PlantId !== plantId) throw notFound();
        patchData.CostCenterId = costCenter.Id;
      }
    }
    if (body.IsActive !== undefined) {
      patchData.IsActive = bool(body.IsActive, "IsActive");
    }
    if (body.EffectiveFrom !== undefined) {
      patchData.EffectiveFrom = body.EffectiveFrom === null ? null : isoDate(body.EffectiveFrom, "EffectiveFrom", { required: true });
    }
    if (body.EffectiveTo !== undefined) {
      patchData.EffectiveTo = body.EffectiveTo === null ? null : isoDate(body.EffectiveTo, "EffectiveTo", { required: true });
    }
    const finalFrom = patchData.EffectiveFrom !== undefined ? patchData.EffectiveFrom : dateOnly(existing.EffectiveFrom);
    const finalTo = patchData.EffectiveTo !== undefined ? patchData.EffectiveTo : dateOnly(existing.EffectiveTo);
    if (finalFrom && finalTo && finalTo < finalFrom) {
      throw bad("EffectiveTo", "EffectiveTo نباید پیش از EffectiveFrom باشد");
    }

    const resPatch = await r.patch("MfgWorkCenterResource", existing.Id, patchData, requestActor(req), expectedRowVersion);
    if (!resPatch.ok) throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ منبع تغییر کرده است");
    const updated = await r.get("MfgWorkCenterResource", existing.Id);
    await writeAudit(r, req, "MFG_WORK_CENTER_RESOURCE_UPDATED", "MfgWorkCenterResource", existing.Id, "mfg.workcenter.edit");
    return updated;
  }));

  app.get(`${ROOT}/work-centers/:workCenterId/calendars`, route("mfg.workcenter.view", async ({ repo: r, req, plantId }) => {
    const workCenterId = text(req.params.workCenterId, "workCenterId", { required: true, max: 60, pattern: ID_RE });
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["from", "to", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);

    const fromDate = q.from !== undefined ? isoDate(q.from, "from", { required: true }) : null;
    const toDate = q.to !== undefined ? isoDate(q.to, "to", { required: true }) : null;
    if (fromDate && toDate && toDate < fromDate) {
      throw bad("to", "to نباید پیش از from باشد");
    }

    const wc = await r.get("MfgWorkCenter", workCenterId);
    if (!wc || wc.PlantId !== plantId) throw notFound();

    const allRows = await r.list("MfgWorkCenterCalendar", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "WorkCenterId", op: "eq", value: wc.Id },
      ],
      orderBy: [{ column: "RuleType", dir: "asc" }, { column: "RuleKey", dir: "asc" }],
    });

    const filtered = allRows.filter((row) => {
      if (!fromDate && !toDate) return true;
      const wStart = fromDate ?? "0000-01-01";
      const wEnd = toDate ?? "9999-12-31";
      if (row.RuleType === "date-override" && row.CalendarDate) {
        const cDate = dateOnly(row.CalendarDate);
        if (cDate && (cDate < wStart || cDate > wEnd)) return false;
      }
      const effFrom = dateOnly(row.EffectiveFrom) ?? "0000-01-01";
      const effTo = dateOnly(row.EffectiveTo) ?? "9999-12-31";
      return effFrom <= wEnd && wStart <= effTo;
    });

    const items = filtered.slice(offset, offset + limit);
    return { items, page: { limit, offset, total: filtered.length } };
  }));

  app.post(`${ROOT}/work-centers/:workCenterId/calendars`, route("mfg.calendar.edit", async ({ repo: r, req, plantId }) => {
    const workCenterId = text(req.params.workCenterId, "workCenterId", { required: true, max: 60, pattern: ID_RE });
    const wc = await r.get("MfgWorkCenter", workCenterId);
    if (!wc || wc.PlantId !== plantId) throw notFound();

    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "RuleType", "RuleKey", "WeekdayIso", "CalendarDate", "ShiftCode",
      "StartMinuteOfDay", "EndMinuteOfDay", "BreakMinutes", "BreakStartMinuteOfDay",
      "IsWorking", "AvailabilityPct", "EffectiveFrom", "EffectiveTo",
    ]));

    const ruleType = text(body.RuleType, "RuleType", { required: true, max: 16 });
    if (!CALENDAR_RULE_TYPES.has(ruleType)) throw bad("RuleType", "RuleType باید weekly یا date-override باشد");
    const ruleKey = text(body.RuleKey, "RuleKey", { required: true, max: 100 });

    let weekdayIso = null;
    let calendarDate = null;
    if (ruleType === "weekly") {
      if (body.CalendarDate !== undefined && body.CalendarDate !== null) {
        throw bad("CalendarDate", "برای RuleType=weekly فیلد CalendarDate باید تهی باشد");
      }
      weekdayIso = number(body.WeekdayIso, "WeekdayIso", { required: true, integer: true, min: 1, max: 7 });
    } else {
      if (body.WeekdayIso !== undefined && body.WeekdayIso !== null) {
        throw bad("WeekdayIso", "برای RuleType=date-override فیلد WeekdayIso باید تهی باشد");
      }
      calendarDate = isoDate(body.CalendarDate, "CalendarDate", { required: true });
    }

    const shiftCode = text(body.ShiftCode, "ShiftCode", { required: true, max: 60, pattern: CODE_RE });
    const isWorking = bool(body.IsWorking, "IsWorking", true);

    let startMinuteOfDay = null;
    let endMinuteOfDay = null;
    let breakMinutes = 0;
    let breakStartMinuteOfDay = null;

    if (isWorking) {
      startMinuteOfDay = number(body.StartMinuteOfDay, "StartMinuteOfDay", { required: true, integer: true, min: 0, max: 1439 });
      endMinuteOfDay = number(body.EndMinuteOfDay, "EndMinuteOfDay", { required: true, integer: true, min: startMinuteOfDay + 1, max: 2879 });
      breakMinutes = number(body.BreakMinutes ?? 0, "BreakMinutes", { required: true, integer: true, min: 0, max: endMinuteOfDay - startMinuteOfDay });
      if (breakMinutes > 0) {
        breakStartMinuteOfDay = number(body.BreakStartMinuteOfDay, "BreakStartMinuteOfDay", {
          required: true,
          integer: true,
          min: startMinuteOfDay,
          max: endMinuteOfDay - breakMinutes,
        });
      } else if (body.BreakStartMinuteOfDay !== undefined && body.BreakStartMinuteOfDay !== null) {
        throw bad("BreakStartMinuteOfDay", "وقتی BreakMinutes برابر ۰ است، BreakStartMinuteOfDay باید تهی باشد");
      }
    } else {
      if (body.StartMinuteOfDay !== undefined && body.StartMinuteOfDay !== null) {
        throw bad("StartMinuteOfDay", "برای روز غیرکاری StartMinuteOfDay باید تهی باشد");
      }
      if (body.EndMinuteOfDay !== undefined && body.EndMinuteOfDay !== null) {
        throw bad("EndMinuteOfDay", "برای روز غیرکاری EndMinuteOfDay باید تهی باشد");
      }
      if (body.BreakStartMinuteOfDay !== undefined && body.BreakStartMinuteOfDay !== null) {
        throw bad("BreakStartMinuteOfDay", "برای روز غیرکاری BreakStartMinuteOfDay باید تهی باشد");
      }
      breakMinutes = number(body.BreakMinutes ?? 0, "BreakMinutes", { required: true, integer: true, min: 0, max: 0 });
    }

    const availabilityPct = number(body.AvailabilityPct ?? 100, "AvailabilityPct", { required: true, min: 0, max: 100 });
    const effectiveFrom = isoDate(body.EffectiveFrom, "EffectiveFrom", { required: true });
    const effectiveTo = body.EffectiveTo === undefined || body.EffectiveTo === null
      ? null
      : isoDate(body.EffectiveTo, "EffectiveTo", { required: true });
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw bad("EffectiveTo", "EffectiveTo نباید پیش از EffectiveFrom باشد");
    }

    const duplicate = await r.findOne("MfgWorkCenterCalendar", [
      { column: "WorkCenterId", op: "eq", value: wc.Id },
      { column: "RuleKey", op: "eq", value: ruleKey },
    ]);
    if (duplicate) throw conflict("MFG_DUPLICATE", "RuleKey در این مرکز کاری تکراری است");

    const row = await r.create("MfgWorkCenterCalendar", {
      PlantId: plantId,
      WorkCenterId: wc.Id,
      RuleType: ruleType,
      RuleKey: ruleKey,
      WeekdayIso: weekdayIso,
      CalendarDate: calendarDate,
      ShiftCode: shiftCode,
      StartMinuteOfDay: startMinuteOfDay,
      EndMinuteOfDay: endMinuteOfDay,
      BreakMinutes: breakMinutes,
      BreakStartMinuteOfDay: breakStartMinuteOfDay,
      IsWorking: isWorking,
      AvailabilityPct: availabilityPct,
      EffectiveFrom: effectiveFrom,
      EffectiveTo: effectiveTo,
    }, requestActor(req));
    await writeAudit(r, req, "MFG_WORK_CENTER_CALENDAR_CREATED", "MfgWorkCenterCalendar", row.Id, "mfg.calendar.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/work-center-calendars/:calendarId`, route("mfg.calendar.edit", async ({ repo: r, req, plantId }) => {
    const calendarId = text(req.params.calendarId, "calendarId", { required: true, max: 60, pattern: ID_RE });
    const expectedRowVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "ShiftCode", "StartMinuteOfDay", "EndMinuteOfDay", "BreakMinutes",
      "BreakStartMinuteOfDay", "IsWorking", "AvailabilityPct", "EffectiveFrom", "EffectiveTo",
    ]));
    if (Object.keys(body).length === 0) throw bad("body", "حداقل یک فیلد قابل‌ویرایش الزامی است");

    const existing = await r.get("MfgWorkCenterCalendar", calendarId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    if (existing.RowVersion !== expectedRowVersion) {
      throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ تقویم تغییر کرده است؛ آخرین نسخه را بخوانید");
    }

    const wc = await r.get("MfgWorkCenter", existing.WorkCenterId);
    if (!wc || wc.PlantId !== plantId) throw notFound();

    const firmSegments = await r.list("MfgOperationSchedule", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "WorkCenterId", op: "eq", value: existing.WorkCenterId },
        { column: "Status", op: "eq", value: "firm" },
      ],
    });
    if (firmSegments.length > 0) {
      const effFrom = dateOnly(existing.EffectiveFrom) ?? "0000-01-01";
      const effTo = dateOnly(existing.EffectiveTo) ?? "9999-12-31";
      const calDate = dateOnly(existing.CalendarDate);
      const usedByFirm = firmSegments.some((seg) => {
        const startTs = storedTimestamp(seg.PlannedStartAt);
        if (!Number.isFinite(startTs)) return false;
        const segLocalDate = localDateAt(startTs, wc.TimeZoneId || "UTC");
        if (existing.RuleType === "date-override" && calDate) {
          return segLocalDate === calDate;
        }
        return segLocalDate >= effFrom && segLocalDate <= effTo;
      });
      if (usedByFirm) {
        throw businessRule("MFG_CALENDAR_USED_BY_FIRM_SCHEDULE", "این تقویم در برنامهٔ زمان‌بندی تثبیت‌شده (firm) مصرف شده و قابل تغییر نیست");
      }
    }

    const nextShiftCode = body.ShiftCode !== undefined
      ? text(body.ShiftCode, "ShiftCode", { required: true, max: 60, pattern: CODE_RE })
      : existing.ShiftCode;
    const nextIsWorking = body.IsWorking !== undefined
      ? bool(body.IsWorking, "IsWorking")
      : existing.IsWorking;

    let nextStart = body.StartMinuteOfDay !== undefined ? body.StartMinuteOfDay : existing.StartMinuteOfDay;
    let nextEnd = body.EndMinuteOfDay !== undefined ? body.EndMinuteOfDay : existing.EndMinuteOfDay;
    let nextBreak = body.BreakMinutes !== undefined ? body.BreakMinutes : existing.BreakMinutes;
    let nextBreakStart = body.BreakStartMinuteOfDay !== undefined ? body.BreakStartMinuteOfDay : existing.BreakStartMinuteOfDay;

    if (nextIsWorking) {
      nextStart = number(nextStart, "StartMinuteOfDay", { required: true, integer: true, min: 0, max: 1439 });
      nextEnd = number(nextEnd, "EndMinuteOfDay", { required: true, integer: true, min: nextStart + 1, max: 2879 });
      nextBreak = number(nextBreak ?? 0, "BreakMinutes", { required: true, integer: true, min: 0, max: nextEnd - nextStart });
      if (nextBreak > 0) {
        nextBreakStart = number(nextBreakStart, "BreakStartMinuteOfDay", {
          required: true,
          integer: true,
          min: nextStart,
          max: nextEnd - nextBreak,
        });
      } else {
        if (body.BreakStartMinuteOfDay !== undefined && body.BreakStartMinuteOfDay !== null) {
          throw bad("BreakStartMinuteOfDay", "وقتی BreakMinutes برابر ۰ است، BreakStartMinuteOfDay باید تهی باشد");
        }
        nextBreakStart = null;
      }
    } else {
      if (body.StartMinuteOfDay !== undefined && body.StartMinuteOfDay !== null) {
        throw bad("StartMinuteOfDay", "برای روز غیرکاری StartMinuteOfDay باید تهی باشد");
      }
      if (body.EndMinuteOfDay !== undefined && body.EndMinuteOfDay !== null) {
        throw bad("EndMinuteOfDay", "برای روز غیرکاری EndMinuteOfDay باید تهی باشد");
      }
      if (body.BreakStartMinuteOfDay !== undefined && body.BreakStartMinuteOfDay !== null) {
        throw bad("BreakStartMinuteOfDay", "برای روز غیرکاری BreakStartMinuteOfDay باید تهی باشد");
      }
      nextStart = null;
      nextEnd = null;
      nextBreak = 0;
      nextBreakStart = null;
    }

    const nextAvailabilityPct = body.AvailabilityPct !== undefined
      ? number(body.AvailabilityPct, "AvailabilityPct", { required: true, min: 0, max: 100 })
      : existing.AvailabilityPct;
    const nextEffectiveFrom = body.EffectiveFrom !== undefined
      ? isoDate(body.EffectiveFrom, "EffectiveFrom", { required: true })
      : dateOnly(existing.EffectiveFrom);
    const nextEffectiveTo = body.EffectiveTo !== undefined
      ? (body.EffectiveTo === null ? null : isoDate(body.EffectiveTo, "EffectiveTo", { required: true }))
      : dateOnly(existing.EffectiveTo);
    if (nextEffectiveFrom && nextEffectiveTo && nextEffectiveTo < nextEffectiveFrom) {
      throw bad("EffectiveTo", "EffectiveTo نباید پیش از EffectiveFrom باشد");
    }

    const patchData = {
      ShiftCode: nextShiftCode,
      IsWorking: nextIsWorking,
      StartMinuteOfDay: nextStart,
      EndMinuteOfDay: nextEnd,
      BreakMinutes: nextBreak,
      BreakStartMinuteOfDay: nextBreakStart,
      AvailabilityPct: nextAvailabilityPct,
      EffectiveFrom: nextEffectiveFrom,
      EffectiveTo: nextEffectiveTo,
    };

    const resPatch = await r.patch("MfgWorkCenterCalendar", existing.Id, patchData, requestActor(req), expectedRowVersion);
    if (!resPatch.ok) throw conflict("MFG_CONCURRENCY_CONFLICT", "نسخهٔ تقویم تغییر کرده است");
    const updated = await r.get("MfgWorkCenterCalendar", existing.Id);
    await writeAudit(r, req, "MFG_WORK_CENTER_CALENDAR_UPDATED", "MfgWorkCenterCalendar", existing.Id, "mfg.calendar.edit");
    return updated;
  }));

  app.get(`${ROOT}/orders`, route("mfg.order.view", async ({ repo: r, req, subject }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["status", "partId", "projectId", "contractId", "q", "dueFrom", "dueTo", "priorityRule", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const where = await parseOrderFilters(req, subject, evaluate, r);
    const [rows, total] = await Promise.all([
      r.list("MfgProductionOrder", { where, orderBy: [{ column: "DueAt", dir: "asc" }, { column: "OrderNo", dir: "asc" }], limit, offset }),
      r.count("MfgProductionOrder", where),
    ]);
    return { items: rows.map((row) => protectProjectLink(subject, row, evaluate)), page: { limit, offset, total } };
  }));

  app.post(`${ROOT}/orders`, route("mfg.order.create", async ({ repo: r, req, subject, plantId }) => {
    const body = req.body ?? {};
    const fields = new Set([
      "OrderNo", "PartId", "OrderQuantity", "Uom", "DueAt", "RequestedStartAt", "PriorityRule", "ManualRank", "DispatchWeight",
      "DemandSource", "DemandRef", "CustomerRef", "CustomerNameSnapshot", "ContractId", "ProjectId", "AllowOverrun", "NoteFa",
    ]);
    assertOnlyKeys(body, fields);
    const orderNo = text(body.OrderNo, "OrderNo", { required: true, max: 60, pattern: CODE_RE });
    const partId = text(body.PartId, "PartId", { required: true, max: 60, pattern: ID_RE });
    const part = await r.get("MfgPart", partId);
    if (!part || part.PlantId !== plantId || part.IsActive !== true) throw new MfgApiError(422, "MFG_PART_UNAVAILABLE", "قطعه فعال و متعلق به همین کارخانه نیست", { field: "PartId" });
    const orderQuantity = number(body.OrderQuantity, "OrderQuantity", { required: true, min: Number.MIN_VALUE });
    const uom = text(body.Uom, "Uom", { required: true, max: 16, pattern: /^[A-Za-z0-9._-]+$/ });
    const dueAt = isoDateTime(body.DueAt, "DueAt", { required: true });
    const requestedStartAt = isoDateTime(body.RequestedStartAt, "RequestedStartAt");
    if (requestedStartAt && Date.parse(requestedStartAt) > Date.parse(dueAt)) throw bad("RequestedStartAt", "شروع درخواستی نباید بعد از موعد سفارش باشد");
    const priorityRule = text(body.PriorityRule ?? "EDD", "PriorityRule", { required: true, max: 12 });
    if (!PRIORITY_RULES.has(priorityRule)) throw bad("PriorityRule", "PriorityRule باید EDD، CR یا MANUAL باشد");
    const manualRank = number(body.ManualRank, "ManualRank", { min: 0, integer: true });
    if (priorityRule === "MANUAL" && manualRank === null) throw bad("ManualRank", "برای MANUAL، ManualRank الزامی است");
    if (priorityRule !== "MANUAL" && manualRank !== null) throw bad("ManualRank", "ManualRank فقط برای PriorityRule=MANUAL پذیرفته می‌شود");
    const dispatchWeight = body.DispatchWeight === undefined ? 1 : parseDispatchWeight(body.DispatchWeight);
    const demandSource = text(body.DemandSource, "DemandSource", { required: true, max: 16 });
    if (!DEMAND_SOURCES.has(demandSource)) throw bad("DemandSource", "DemandSource نامعتبر است");
    /* در معماری مستقل MES (Standalone MES)، شناسه‌های ProjectId و ContractId صرفاً
     * کلیدهای نرم بیرونی برای تبادل REST API هستند و هیچ جدول پروژه‌ای در دیتابیس
     * MES خوانده یا ملزم نمی‌شود. */
    const projectId = text(body.ProjectId, "ProjectId", { max: 60, pattern: ID_RE });
    const contractId = text(body.ContractId, "ContractId", { max: 60, pattern: ID_RE });
    const duplicate = await r.findOne("MfgProductionOrder", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "OrderNo", op: "eq", value: orderNo },
    ]);
    if (duplicate) throw conflict("MFG_DUPLICATE", "OrderNo در این کارخانه قبلاً ثبت شده است");
    const demandRef = text(body.DemandRef, "DemandRef", { max: 80 });
    if (demandSource !== "manual" && !demandRef) throw bad("DemandRef", "برای منبع تقاضای غیر manual، DemandRef الزامی است");
    if (demandSource === "contract" && !contractId) throw bad("ContractId", "برای DemandSource=contract، ContractId الزامی است");
    if (contractId && demandSource !== "contract") throw bad("ContractId", "ContractId فقط با DemandSource=contract پذیرفته می‌شود");
    const customerRef = text(body.CustomerRef, "CustomerRef", { max: 80 });
    const customerNameSnapshot = text(body.CustomerNameSnapshot, "CustomerNameSnapshot", { max: 240 });
    const noteFa = text(body.NoteFa, "NoteFa", { max: 1200 });
    const allowOverrun = bool(body.AllowOverrun, "AllowOverrun", false);
    const row = await r.create("MfgProductionOrder", {
      PlantId: plantId,
      OrderNo: orderNo,
      PartId: partId,
      OrderQuantity: orderQuantity,
      Uom: uom,
      DueAt: dueAt,
      RequestedStartAt: requestedStartAt,
      Status: "created",
      PriorityRule: priorityRule,
      ManualRank: manualRank,
      DispatchWeight: dispatchWeight,
      DemandSource: demandSource,
      DemandRef: demandRef,
      CustomerRef: customerRef,
      CustomerNameSnapshot: customerNameSnapshot,
      ContractId: contractId,
      ProjectId: projectId,
      AllowOverrun: allowOverrun,
      NoteFa: noteFa,
    }, requestActor(req));
    await writeAudit(r, req, "MFG_ORDER_CREATED", "MfgProductionOrder", row.Id, "mfg.order.create");
    return protectProjectLink(subject, row, evaluate);
  }, 201));

  app.get(`${ROOT}/orders/:orderId`, route("mfg.order.view", async ({ repo: r, req, subject }) => {
    const orderId = text(req.params.orderId, "orderId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgProductionOrder", orderId);
    if (!row || row.PlantId !== req.mfgPlantId) throw notFound();
    const operations = await r.list("MfgProductionOrderOperation", {
      where: [
        { column: "PlantId", op: "eq", value: req.mfgPlantId },
        { column: "ProductionOrderId", op: "eq", value: row.Id },
      ],
      orderBy: [{ column: "SequenceNo", dir: "asc" }],
    });
    return { ...protectProjectLink(subject, row, evaluate), Operations: operations };
  }));

  app.post(`${ROOT}/orders/:orderId/release`, route("mfg.order.release", async ({ repo: r, req, subject, plantId }) => {
    const orderId = text(req.params.orderId, "orderId", { required: true, max: 60, pattern: ID_RE });
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["BomHeaderId", "RoutingId", "EffectiveAt"]));
    const bomHeaderId = text(body.BomHeaderId, "BomHeaderId", { required: true, max: 60, pattern: ID_RE });
    const routingId = text(body.RoutingId, "RoutingId", { required: true, max: 60, pattern: ID_RE });
    const effectiveAt = isoDate(body.EffectiveAt ?? new Date().toISOString().slice(0, 10), "EffectiveAt", { required: true });
    const expectedVersion = rowVersionFrom(req);

    const result = await r.transaction(async (tx) => {
      const order = await tx.get("MfgProductionOrder", orderId);
      if (!order || order.PlantId !== plantId) throw notFound();
      if (order.RowVersion !== expectedVersion) throw conflict("MFG_ROW_VERSION_CONFLICT", "سفارش از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      if (order.Status !== "created") throw conflict("MFG_STATE_CONFLICT", "فقط سفارش created قابل آزادسازی است");
      if (order.CreatedBy === subject.id) throw new MfgApiError(403, "MFG_SOD_CONFLICT", "سازندهٔ سفارش نمی‌تواند همان سفارش را آزاد کند", { permission: "mfg.order.release" });

      const part = await tx.get("MfgPart", order.PartId);
      if (!part || part.PlantId !== plantId || part.IsActive !== true) throw businessRule("MFG_PART_UNAVAILABLE", "قطعهٔ سفارش فعال و متعلق به همین کارخانه نیست");
      const bom = await tx.get("MfgBomHeader", bomHeaderId);
      requireReleasedHeader(bom, { plantId, partId: order.PartId, effectiveAt, resource: "BOM" });
      const routing = await tx.get("MfgRouting", routingId);
      requireReleasedHeader(routing, { plantId, partId: order.PartId, effectiveAt, resource: "Routing" });
      if (typeof bom.Revision !== "string" || bom.Revision.length > 40 || typeof routing.Revision !== "string" || routing.Revision.length > 40) {
        throw businessRule("MFG_REVISION_SNAPSHOT_TOO_LONG", "طول Revision از ظرفیت snapshot سفارش بیشتر است");
      }

      await validateBomGraph(tx, bom, plantId, effectiveAt);
      const routingOperations = await validateRoutingForRelease(tx, routing, plantId, effectiveAt);
      const operationIdBySequence = new Map();
      const createdOperations = [];
      for (const template of routingOperations) {
        const predecessorId = template.PredecessorSequence === null || template.PredecessorSequence === undefined
          ? null
          : operationIdBySequence.get(template.PredecessorSequence);
        if (template.PredecessorSequence !== null && template.PredecessorSequence !== undefined && !predecessorId) {
          throw businessRule("MFG_ROUTING_PREDECESSOR_INVALID", `پیش‌نیاز Operation ${template.OperationCode} قابل نگاشت نیست`);
        }
        const plannedCapacityMinutes = Math.round((template.SetupMinutes + template.RunMinutesPerUnit * order.OrderQuantity) * 1000) / 1000;
        if (!Number.isFinite(plannedCapacityMinutes) || plannedCapacityMinutes < 0) throw businessRule("MFG_OPERATION_CAPACITY_INVALID", `ظرفیت محاسبه‌شده برای ${template.OperationCode} معتبر نیست`);
        const operation = await tx.create("MfgProductionOrderOperation", {
          PlantId: plantId,
          ProductionOrderId: order.Id,
          RoutingOperationId: template.Id,
          SequenceNo: template.SequenceNo,
          OperationCode: template.OperationCode,
          OperationNameFa: template.OperationNameFa,
          WorkCenterId: template.WorkCenterId,
          PredecessorOperationId: predecessorId,
          Status: "pending",
          PlannedQuantity: order.OrderQuantity,
          PlannedSetupMinutes: template.SetupMinutes,
          PlannedRunMinutesPerUnit: template.RunMinutesPerUnit,
          PlannedQueueMinutes: template.QueueMinutes,
          PlannedMoveMinutes: template.MoveMinutes,
          PlannedCapacityMinutes: plannedCapacityMinutes,
          OverlapAllowed: template.OverlapAllowed === true,
          TransferBatchQty: template.TransferBatchQty ?? null,
          InspectionRequired: template.InspectionRequired === true,
          BlockedReasonFa: null,
        }, subject.id);
        operationIdBySequence.set(template.SequenceNo, operation.Id);
        createdOperations.push(operation);
      }

      const releasedAt = new Date().toISOString();
      const patch = await tx.patch("MfgProductionOrder", order.Id, {
        Status: "released",
        BomHeaderId: bom.Id,
        RoutingId: routing.Id,
        BomRevisionSnapshot: bom.Revision,
        RoutingRevisionSnapshot: routing.Revision,
        ReleasedAt: releasedAt,
        ReleasedBy: subject.id,
      }, subject.id, expectedVersion);
      if (!patch.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "نسخهٔ سفارش هنگام آزادسازی تغییر کرد");
      const releasedOrder = await tx.get("MfgProductionOrder", order.Id);
      await createAuditRecord(tx, req, "MFG_ORDER_RELEASED", "MfgProductionOrder", order.Id, "mfg.order.release", {
        orderNo: order.OrderNo,
        bomHeaderId: bom.Id,
        routingId: routing.Id,
        operationCount: createdOperations.length,
      });
      return { order: releasedOrder, operations: createdOperations };
    });

    return { order: protectProjectLink(subject, result.order, evaluate), operations: result.operations };
  }));

  app.post(`${ROOT}/scheduling/runs`, route("mfg.schedule.run", async ({ repo: r, req, subject, plantId }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["Direction", "CapacityMode", "DispatchRule", "From", "To", "OrderIds", "ExpectedScheduleVersion"]));
    const direction = text(body.Direction, "Direction", { required: true, max: 12 });
    if (!["forward", "backward"].includes(direction)) throw bad("Direction", "Direction باید forward یا backward باشد");
    const capacityMode = text(body.CapacityMode, "CapacityMode", { required: true, max: 16 });
    if (!["finite", "semi-finite"].includes(capacityMode)) throw bad("CapacityMode", "CapacityMode باید finite یا semi-finite باشد");
    const dispatchRule = text(body.DispatchRule, "DispatchRule", { required: true, max: 12 });
    if (!DISPATCH_RULES.has(dispatchRule)) throw bad("DispatchRule", "DispatchRule باید EDD، SPT، CR، WSPT، FIFO یا MANUAL باشد");
    const from = isoDateTime(body.From, "From", { required: true });
    const to = isoDateTime(body.To, "To", { required: true });
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (toMs <= fromMs) throw bad("To", "To باید پس از From باشد");
    if (toMs - fromMs > MAX_SCHEDULE_WINDOW_MS) throw bad("To", "پنجرهٔ زمان‌بندی حداکثر ۳۶۵ روز است");

    let requestedOrderIds = null;
    if (body.OrderIds !== undefined) {
      if (!Array.isArray(body.OrderIds) || body.OrderIds.length < 1 || body.OrderIds.length > 1000) {
        throw bad("OrderIds", "OrderIds باید آرایه‌ای شامل ۱ تا ۱۰۰۰ شناسه باشد");
      }
      requestedOrderIds = body.OrderIds.map((value, index) => text(value, `OrderIds[${index}]`, { required: true, max: 60, pattern: ID_RE }));
      if (new Set(requestedOrderIds).size !== requestedOrderIds.length) throw bad("OrderIds", "شناسهٔ تکراری در OrderIds پذیرفته نمی‌شود");
    }
    const expectedScheduleVersion = body.ExpectedScheduleVersion === undefined
      ? null
      : number(body.ExpectedScheduleVersion, "ExpectedScheduleVersion", { required: true, min: 0, integer: true });

    try {
      return await r.transaction(async (tx) => {
        const latestRuns = await tx.list("MfgScheduleRun", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
          orderBy: [{ column: "ScheduleVersion", dir: "desc" }],
          limit: 1,
        });
        const currentScheduleVersion = latestRuns[0]?.ScheduleVersion ?? 0;
        if (expectedScheduleVersion !== null && expectedScheduleVersion !== currentScheduleVersion) {
          throw new MfgApiError(409, "MFG_SCHEDULE_VERSION_CONFLICT", "نسخهٔ برنامه از زمان خواندن تغییر کرده است؛ برنامه را تازه‌خوانی کنید", {
            expectedScheduleVersion,
            currentScheduleVersion,
          });
        }
        const scheduleVersion = currentScheduleVersion + 1;
        const allOrders = await tx.list("MfgProductionOrder", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        });
        const activeOrders = allOrders.filter((order) => ["released", "in-progress"].includes(order.Status));
        let selectedOrders;
        if (requestedOrderIds) {
          const byId = new Map(allOrders.map((order) => [order.Id, order]));
          for (const orderId of requestedOrderIds) {
            const order = byId.get(orderId);
            if (!order || order.PlantId !== plantId) throw notFound();
            if (!["released", "in-progress"].includes(order.Status)) {
              throw new MfgApiError(422, "MFG_ORDER_NOT_RELEASED", `سفارش ${order.OrderNo} آزادشده یا درحال‌تولید نیست`, { orderId });
            }
          }
          selectedOrders = requestedOrderIds.map((orderId) => byId.get(orderId));
        } else {
          selectedOrders = activeOrders;
        }
        const selectedOrderIds = new Set(selectedOrders.map((order) => order.Id));
        const activeOrderIds = new Set(activeOrders.map((order) => order.Id));
        const scheduleOrderRows = activeOrders;
        const allOperations = await tx.list("MfgProductionOrderOperation", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        });
        const operations = allOperations.filter((operation) => activeOrderIds.has(operation.ProductionOrderId));
        if (operations.length > 5000) throw new MfgApiError(422, "MFG_SCHEDULE_OPERATION_LIMIT", "در هر اجرا حداکثر ۵۰۰۰ عملیات فعال بررسی می‌شود");

        const previousSchedules = currentScheduleVersion > 0
          ? await tx.list("MfgOperationSchedule", {
            where: [
              { column: "PlantId", op: "eq", value: plantId },
              { column: "ScheduleVersion", op: "eq", value: currentScheduleVersion },
            ],
          })
          : [];
        const executionRows = await tx.list("MfgOperationExecution", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "Status", op: "eq", value: "completed" },
          ],
        });
        const downtimeRows = await tx.list("MfgDowntimeLog", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        });
        const downtime = downtimeRows.filter((event) => {
          const startedAt = event.StartedAt instanceof Date ? event.StartedAt.getTime() : Date.parse(event.StartedAt ?? "");
          const finishedAt = event.FinishedAt instanceof Date ? event.FinishedAt.getTime() : Date.parse(event.FinishedAt ?? "");
          return Number.isFinite(startedAt) && startedAt < toMs
            && (event.FinishedAt === null || event.FinishedAt === undefined || (Number.isFinite(finishedAt) && finishedAt >= fromMs));
        });
        const workCenterIds = new Set(operations.map((operation) => operation.WorkCenterId));
        for (const schedule of previousSchedules) workCenterIds.add(schedule.WorkCenterId);
        const plantWorkCenters = await tx.list("MfgWorkCenter", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        });
        const workCenters = plantWorkCenters.filter((workCenter) => workCenterIds.has(workCenter.Id));
        const resources = workCenterIds.size
          ? await tx.list("MfgWorkCenterResource", {
            where: [{ column: "PlantId", op: "eq", value: plantId }],
          }).then((rows) => rows.filter((row) => workCenterIds.has(row.WorkCenterId)))
          : [];
        const calendars = workCenterIds.size
          ? await tx.list("MfgWorkCenterCalendar", {
            where: [{ column: "PlantId", op: "eq", value: plantId }],
          }).then((rows) => rows.filter((row) => workCenterIds.has(row.WorkCenterId)))
          : [];
        const planned = planManufacturingSchedule({
          plantId,
          direction,
          capacityMode,
          dispatchRule,
          fromMs,
          toMs,
          scheduleVersion,
          orders: scheduleOrderRows,
          operations,
          workCenters,
          resources,
          calendars,
          existingSchedules: previousSchedules,
          executions: executionRows,
          downtime,
          selectedOrderIds,
        });
        const calculatedAt = new Date().toISOString();
        const run = await tx.create("MfgScheduleRun", {
          PlantId: plantId,
          ScheduleVersion: scheduleVersion,
          Direction: direction,
          CapacityMode: capacityMode,
          DispatchRule: dispatchRule,
          WindowStart: from,
          WindowEnd: to,
          ExpectedScheduleVersion: expectedScheduleVersion,
          ScheduledOperationCount: planned.summary.scheduledOperationCount,
          UnscheduledOperationCount: planned.summary.unscheduledOperationCount,
          CalculatedAt: calculatedAt,
          ModelVersion: "mfg-scheduler-v1",
          SummaryJson: planned.summary,
        }, subject.id);
        for (const segment of planned.scheduleSegments) {
          await tx.create("MfgOperationSchedule", segment, subject.id);
        }
        for (const capacity of planned.capacityRows) {
          await tx.create("MfgCapacityPlan", capacity, subject.id);
        }
        await createAuditRecord(tx, req, "MFG_SCHEDULE_RUN_CREATED", "MfgScheduleRun", run.Id, "mfg.schedule.run", {
          scheduleVersion,
          direction,
          capacityMode,
          dispatchRule,
          selectedOrderCount: selectedOrderIds.size,
          scheduledOperationCount: planned.summary.scheduledOperationCount,
          unscheduledOperationCount: planned.summary.unscheduledOperationCount,
          segmentCount: planned.summary.segmentCount,
        });
        return {
          ScheduleVersion: scheduleVersion,
          CurrentScheduleVersion: currentScheduleVersion,
          RunId: run.Id,
          assignments: planned.assignments,
          unscheduled: planned.unscheduled,
          capacity: planned.capacityRows,
          summary: planned.summary,
        };
      });
    } catch (err) {
      if (err instanceof SchedulePlanningError) {
        throw new MfgApiError(422, err.code, err.message, err.details);
      }
      const message = String(err?.message ?? "");
      if ((err?.code === "UNIQUE_VIOLATION" || [2601, 2627].includes(err?.number)) && /MfgScheduleRun_Version|MfgScheduleRun/i.test(message)) {
        throw conflict("MFG_SCHEDULE_VERSION_CONFLICT", "اجرای دیگری هم‌زمان نسخهٔ برنامه را ثبت کرد؛ برنامه را تازه‌خوانی کنید");
      }
      if (["TRANSACTIONS_UNSUPPORTED", "NESTED_TRANSACTION_UNSUPPORTED"].includes(err?.code)) {
        throw new MfgApiError(503, "MFG_TRANSACTIONS_UNAVAILABLE", "اجرای زمان‌بندی بدون تراکنش اتمیک مجاز نیست");
      }
      throw err;
    }
  }, 201));

  app.post(`${ROOT}/scheduling/reschedules`, route("mfg.schedule.resequence", async ({ repo: r, req, subject, plantId }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["ExpectedScheduleVersion", "OperationIds", "Reason", "DispatchRule"]));
    const expectedScheduleVersion = number(body.ExpectedScheduleVersion, "ExpectedScheduleVersion", {
      required: true,
      min: 0,
      integer: true,
    });
    if (!Array.isArray(body.OperationIds) || body.OperationIds.length < 1 || body.OperationIds.length > 1000) {
      throw bad("OperationIds", "OperationIds باید آرایه‌ای شامل ۱ تا ۱۰۰۰ شناسه باشد");
    }
    const requestedOperationIds = body.OperationIds.map((value, index) =>
      text(value, `OperationIds[${index}]`, { required: true, max: 60, pattern: ID_RE }),
    );
    if (new Set(requestedOperationIds).size !== requestedOperationIds.length) {
      throw bad("OperationIds", "شناسهٔ تکراری در OperationIds پذیرفته نمی‌شود");
    }
    const reason = text(body.Reason, "Reason", { required: true, max: 500 });
    const requestedDispatchRule = body.DispatchRule === undefined
      ? null
      : text(body.DispatchRule, "DispatchRule", { required: true, max: 12 });
    if (requestedDispatchRule !== null && !DISPATCH_RULES.has(requestedDispatchRule)) {
      throw bad("DispatchRule", "DispatchRule باید EDD، SPT، CR، WSPT، FIFO یا MANUAL باشد");
    }

    try {
      return await r.transaction(async (tx) => {
        const latestRuns = await tx.list("MfgScheduleRun", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
          orderBy: [{ column: "ScheduleVersion", dir: "desc" }],
          limit: 1,
        });
        const latestRun = latestRuns[0] ?? null;
        const currentScheduleVersion = latestRun?.ScheduleVersion ?? 0;
        if (!latestRun || expectedScheduleVersion !== currentScheduleVersion) {
          throw new MfgApiError(409, "MFG_SCHEDULE_VERSION_CONFLICT", "نسخهٔ برنامه از زمان خواندن تغییر کرده است؛ برنامه را تازه‌خوانی کنید", {
            expectedScheduleVersion,
            currentScheduleVersion,
          });
        }
        const scheduleVersion = currentScheduleVersion + 1;
        const direction = latestRun.Direction;
        const capacityMode = latestRun.CapacityMode;
        const dispatchRule = requestedDispatchRule ?? latestRun.DispatchRule;
        const from = storedIsoTimestamp(latestRun.WindowStart);
        const to = storedIsoTimestamp(latestRun.WindowEnd);
        const fromMs = storedTimestamp(latestRun.WindowStart);
        const toMs = storedTimestamp(latestRun.WindowEnd);
        if (!from || !to || !Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
          throw businessRule("MFG_SCHEDULE_WINDOW_INVALID", "پنجرهٔ زمانی نسخهٔ جاری برنامه معتبر نیست");
        }

        const [allOrders, allOperations] = await Promise.all([
          tx.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
          tx.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        ]);
        const orderById = new Map(allOrders.map((order) => [order.Id, order]));
        const plantOperationById = new Map(allOperations.map((operation) => [operation.Id, operation]));

        for (const operationId of requestedOperationIds) {
          const operation = plantOperationById.get(operationId);
          if (!operation || operation.PlantId !== plantId) throw notFound();
          const order = orderById.get(operation.ProductionOrderId);
          if (!order || order.PlantId !== plantId) throw notFound();
          if (!["released", "in-progress"].includes(order.Status)) {
            throw new MfgApiError(422, "MFG_ORDER_NOT_RELEASED", `سفارش ${order.OrderNo} آزادشده یا درحال‌تولید نیست`, {
              orderId: order.Id,
              operationId: operation.Id,
            });
          }
          if (!["pending", "queued", "ready"].includes(operation.Status)) {
            throw new MfgApiError(422, "MFG_OPERATION_NOT_DISPATCHABLE", `عملیات ${operation.OperationCode ?? operation.Id} در وضعیت ${operation.Status} قابل‌اعزام نیست`, {
              operationId: operation.Id,
              orderId: order.Id,
              status: operation.Status,
            });
          }
        }

        const activeOrders = allOrders.filter((order) => ["released", "in-progress"].includes(order.Status));
        const activeOrderIds = new Set(activeOrders.map((order) => order.Id));
        const operations = allOperations.filter((operation) => activeOrderIds.has(operation.ProductionOrderId));
        if (operations.length > 5000) {
          throw new MfgApiError(422, "MFG_SCHEDULE_OPERATION_LIMIT", "در هر اجرا حداکثر ۵۰۰۰ عملیات فعال بررسی می‌شود");
        }

        const previousSchedules = await tx.list("MfgOperationSchedule", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "ScheduleVersion", op: "eq", value: currentScheduleVersion },
          ],
        });
        const executionRows = await tx.list("MfgOperationExecution", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "Status", op: "eq", value: "completed" },
          ],
        });
        const downtimeRows = await tx.list("MfgDowntimeLog", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        });
        const downtime = downtimeRows.filter((event) => {
          const startedAt = storedTimestamp(event.StartedAt);
          const finishedAt = storedTimestamp(event.FinishedAt);
          return Number.isFinite(startedAt) && startedAt < toMs
            && (event.FinishedAt === null || event.FinishedAt === undefined || (Number.isFinite(finishedAt) && finishedAt >= fromMs));
        });
        const workCenterIds = new Set(operations.map((operation) => operation.WorkCenterId));
        for (const schedule of previousSchedules) workCenterIds.add(schedule.WorkCenterId);
        const plantWorkCenters = await tx.list("MfgWorkCenter", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        });
        const workCenters = plantWorkCenters.filter((workCenter) => workCenterIds.has(workCenter.Id));
        const resources = workCenterIds.size
          ? await tx.list("MfgWorkCenterResource", {
            where: [{ column: "PlantId", op: "eq", value: plantId }],
          }).then((rows) => rows.filter((row) => workCenterIds.has(row.WorkCenterId)))
          : [];
        const calendars = workCenterIds.size
          ? await tx.list("MfgWorkCenterCalendar", {
            where: [{ column: "PlantId", op: "eq", value: plantId }],
          }).then((rows) => rows.filter((row) => workCenterIds.has(row.WorkCenterId)))
          : [];

        const planned = planManufacturingSchedule({
          plantId,
          direction,
          capacityMode,
          dispatchRule,
          fromMs,
          toMs,
          previousScheduleVersion: currentScheduleVersion,
          scheduleVersion,
          orders: activeOrders,
          operations,
          workCenters,
          resources,
          calendars,
          existingSchedules: previousSchedules,
          executions: executionRows,
          downtime,
          selectedOperationIds: requestedOperationIds,
        });

        const calculatedAt = new Date().toISOString();
        const runSummary = {
          ...planned.summary,
          reason,
          previousScheduleVersion: currentScheduleVersion,
          requestedOperationIds,
          rescheduledOperationIds: planned.rescheduledOperationIds,
          changedOperationCount: planned.diff.changedOperationCount,
        };
        const run = await tx.create("MfgScheduleRun", {
          PlantId: plantId,
          ScheduleVersion: scheduleVersion,
          Direction: direction,
          CapacityMode: capacityMode,
          DispatchRule: dispatchRule,
          WindowStart: from,
          WindowEnd: to,
          ExpectedScheduleVersion: expectedScheduleVersion,
          ScheduledOperationCount: planned.summary.scheduledOperationCount,
          UnscheduledOperationCount: planned.summary.unscheduledOperationCount,
          CalculatedAt: calculatedAt,
          ModelVersion: "mfg-scheduler-v1",
          SummaryJson: runSummary,
        }, subject.id);
        for (const segment of planned.scheduleSegments) {
          await tx.create("MfgOperationSchedule", segment, subject.id);
        }
        for (const capacity of planned.capacityRows) {
          await tx.create("MfgCapacityPlan", capacity, subject.id);
        }
        await createAuditRecord(tx, req, "MFG_SCHEDULE_RESCHEDULED", "MfgScheduleRun", run.Id, "mfg.schedule.resequence", {
          previousScheduleVersion: currentScheduleVersion,
          scheduleVersion,
          reason,
          direction,
          capacityMode,
          dispatchRule,
          requestedOperationIds,
          rescheduledOperationIds: planned.rescheduledOperationIds,
          changedOperationCount: planned.diff.changedOperationCount,
          scheduledOperationCount: planned.summary.scheduledOperationCount,
          unscheduledOperationCount: planned.summary.unscheduledOperationCount,
          segmentCount: planned.summary.segmentCount,
        });
        return {
          ScheduleVersion: scheduleVersion,
          PreviousScheduleVersion: currentScheduleVersion,
          CurrentScheduleVersion: currentScheduleVersion,
          RunId: run.Id,
          Reason: reason,
          Direction: direction,
          CapacityMode: capacityMode,
          DispatchRule: dispatchRule,
          RequestedOperationIds: requestedOperationIds,
          RescheduledOperationIds: planned.rescheduledOperationIds,
          assignments: planned.assignments,
          unscheduled: planned.unscheduled,
          capacity: planned.capacityRows,
          summary: planned.summary,
          diff: planned.diff,
        };
      });
    } catch (err) {
      if (err instanceof SchedulePlanningError) {
        throw new MfgApiError(422, err.code, err.message, err.details);
      }
      const message = String(err?.message ?? "");
      if ((err?.code === "UNIQUE_VIOLATION" || [2601, 2627].includes(err?.number)) && /MfgScheduleRun_Version|MfgScheduleRun/i.test(message)) {
        throw conflict("MFG_SCHEDULE_VERSION_CONFLICT", "اجرای دیگری هم‌زمان نسخهٔ برنامه را ثبت کرد؛ برنامه را تازه‌خوانی کنید");
      }
      if (["TRANSACTIONS_UNSUPPORTED", "NESTED_TRANSACTION_UNSUPPORTED"].includes(err?.code)) {
        throw new MfgApiError(503, "MFG_TRANSACTIONS_UNAVAILABLE", "باززمان‌بندی بدون تراکنش اتمیک مجاز نیست");
      }
      throw err;
    }
  }, 201));

  app.get(`${ROOT}/scheduling/gantt`, route("mfg.schedule.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["from", "to", "workCenterId", "orderId", "scheduleVersion"]));
    const from = isoDateTime(q.from, "from", { required: true });
    const to = isoDateTime(q.to, "to", { required: true });
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (toMs <= fromMs) throw bad("to", "to باید پس از from باشد");
    if (toMs - fromMs > MAX_GANTT_WINDOW_MS) throw bad("to", "پنجرهٔ Gantt حداکثر ۹۰ روز است");
    const workCenterId = q.workCenterId === undefined
      ? null
      : text(q.workCenterId, "workCenterId", { required: true, max: 60, pattern: ID_RE });
    const orderId = q.orderId === undefined
      ? null
      : text(q.orderId, "orderId", { required: true, max: 60, pattern: ID_RE });

    const latestRuns = await r.list("MfgScheduleRun", {
      where: [{ column: "PlantId", op: "eq", value: plantId }],
      orderBy: [{ column: "ScheduleVersion", dir: "desc" }],
      limit: 1,
    });
    const currentScheduleVersion = latestRuns[0]?.ScheduleVersion ?? 0;
    const scheduleVersion = q.scheduleVersion === undefined
      ? currentScheduleVersion
      : pageNumber(q.scheduleVersion, "scheduleVersion", 0, 2_147_483_647);
    if (scheduleVersion === 0 ? currentScheduleVersion !== 0 : !await r.findOne("MfgScheduleRun", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "ScheduleVersion", op: "eq", value: scheduleVersion },
    ])) {
      throw new MfgApiError(404, "MFG_SCHEDULE_VERSION_NOT_FOUND", "نسخهٔ برنامه در کارخانهٔ جاری یافت نشد", { scheduleVersion });
    }

    if (workCenterId) {
      const workCenter = await r.get("MfgWorkCenter", workCenterId);
      if (!workCenter || workCenter.PlantId !== plantId) throw notFound();
    }
    if (orderId) {
      const order = await r.get("MfgProductionOrder", orderId);
      if (!order || order.PlantId !== plantId) throw notFound();
    }

    const storedSegments = scheduleVersion === 0
      ? []
      : await r.list("MfgOperationSchedule", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ScheduleVersion", op: "eq", value: scheduleVersion },
        ],
      });
    const visibleSegments = storedSegments.filter((segment) => {
      if (segment.Status === "cancelled") return false;
      if (workCenterId && segment.WorkCenterId !== workCenterId) return false;
      const start = segment.PlannedStartAt instanceof Date ? segment.PlannedStartAt.getTime() : Date.parse(segment.PlannedStartAt ?? "");
      const end = segment.PlannedEndAt instanceof Date ? segment.PlannedEndAt.getTime() : Date.parse(segment.PlannedEndAt ?? "");
      return Number.isFinite(start) && Number.isFinite(end) && start < toMs && end > fromMs;
    });
    const operationIds = new Set(visibleSegments.map((segment) => segment.ProductionOrderOperationId));
    const workCenterIds = new Set(visibleSegments.map((segment) => segment.WorkCenterId));
    const operations = operationIds.size
      ? await r.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] })
      : [];
    const operationById = new Map(operations.filter((operation) => operationIds.has(operation.Id)).map((operation) => [operation.Id, operation]));
    const relevantOperationIds = new Set([...operationById.values()]
      .filter((operation) => !orderId || operation.ProductionOrderId === orderId)
      .map((operation) => operation.Id));
    const relevantOrderIds = new Set([...operationById.values()]
      .filter((operation) => relevantOperationIds.has(operation.Id))
      .map((operation) => operation.ProductionOrderId));
    const [orders, workCenters] = await Promise.all([
      relevantOrderIds.size
        ? r.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] })
        : Promise.resolve([]),
      workCenterIds.size
        ? r.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] })
        : Promise.resolve([]),
    ]);
    const orderById = new Map(orders.filter((order) => relevantOrderIds.has(order.Id)).map((order) => [order.Id, order]));
    const workCenterById = new Map(workCenters.filter((workCenter) => workCenterIds.has(workCenter.Id)).map((workCenter) => [workCenter.Id, workCenter]));
    const segmentsByWorkCenter = new Map();
    for (const segment of visibleSegments) {
      const operation = operationById.get(segment.ProductionOrderOperationId);
      const order = operation && orderById.get(operation.ProductionOrderId);
      const workCenter = workCenterById.get(segment.WorkCenterId);
      if (!operation || !order || !workCenter || !relevantOperationIds.has(operation.Id)) continue;
      if (!segmentsByWorkCenter.has(workCenter.Id)) segmentsByWorkCenter.set(workCenter.Id, []);
      segmentsByWorkCenter.get(workCenter.Id).push({
        Id: segment.Id,
        ScheduleVersion: segment.ScheduleVersion,
        SegmentNo: segment.SegmentNo,
        ProductionOrderId: order.Id,
        OrderNo: order.OrderNo,
        ProductionOrderOperationId: operation.Id,
        SequenceNo: operation.SequenceNo,
        OperationCode: operation.OperationCode,
        OperationNameFa: operation.OperationNameFa,
        WorkCenterId: workCenter.Id,
        ResourceId: segment.ResourceId,
        PlannedStartAt: segment.PlannedStartAt instanceof Date ? segment.PlannedStartAt.toISOString() : segment.PlannedStartAt,
        PlannedEndAt: segment.PlannedEndAt instanceof Date ? segment.PlannedEndAt.toISOString() : segment.PlannedEndAt,
        PlannedCapacityMinutes: segment.PlannedCapacityMinutes,
        QueueMinutes: segment.QueueMinutes,
        MoveMinutes: segment.MoveMinutes,
        CapacityMode: segment.CapacityMode,
        Direction: segment.Direction,
        DispatchRule: segment.DispatchRule,
        Status: segment.Status,
      });
    }
    const lanes = [...segmentsByWorkCenter.entries()].map(([id, segments]) => {
      const workCenter = workCenterById.get(id);
      segments.sort((left, right) => Date.parse(left.PlannedStartAt) - Date.parse(right.PlannedStartAt)
        || Date.parse(left.PlannedEndAt) - Date.parse(right.PlannedEndAt)
        || String(left.OrderNo).localeCompare(String(right.OrderNo))
        || Number(left.SequenceNo) - Number(right.SequenceNo));
      return {
        workCenter: {
          Id: workCenter.Id,
          Code: workCenter.Code,
          NameFa: workCenter.NameFa,
          NameEn: workCenter.NameEn,
          Kind: workCenter.Kind,
          TimeZoneId: workCenter.TimeZoneId,
          Status: workCenter.Status,
        },
        segments,
      };
    }).sort((left, right) => String(left.workCenter.Code).localeCompare(String(right.workCenter.Code)));
    return { scheduleVersion, from, to, lanes };
  }));

  app.get(`${ROOT}/capacity/load`, route("mfg.capacity.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["from", "to", "bucket", "workCenterId"]));
    const from = isoDateTime(q.from, "from", { required: true });
    const to = isoDateTime(q.to, "to", { required: true });
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (toMs <= fromMs) throw bad("to", "to باید پس از from باشد");
    const bucket = q.bucket === undefined ? "day" : text(q.bucket, "bucket", { required: true, max: 8 });
    if (!["day", "week"].includes(bucket)) throw bad("bucket", "bucket باید day یا week باشد");
    const workCenterId = q.workCenterId === undefined
      ? null
      : text(q.workCenterId, "workCenterId", { required: true, max: 60, pattern: ID_RE });
    const requestedWorkCenter = workCenterId ? await r.get("MfgWorkCenter", workCenterId) : null;
    if (workCenterId && (!requestedWorkCenter || requestedWorkCenter.PlantId !== plantId)) throw notFound();

    const latestRuns = await r.list("MfgScheduleRun", {
      where: [{ column: "PlantId", op: "eq", value: plantId }],
      orderBy: [{ column: "ScheduleVersion", dir: "desc" }],
      limit: 1,
    });
    const scheduleVersion = latestRuns[0]?.ScheduleVersion ?? 0;
    if (scheduleVersion === 0) return { scheduleVersion, bucket, buckets: [] };

    const [capacityRows, workCenters] = await Promise.all([
      r.list("MfgCapacityPlan", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ScheduleVersion", op: "eq", value: scheduleVersion },
        ],
      }),
      workCenterId
        ? Promise.resolve([requestedWorkCenter])
        : r.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const workCenterById = new Map(workCenters
      .filter((workCenter) => workCenter.PlantId === plantId)
      .map((workCenter) => [workCenter.Id, workCenter]));
    const rows = capacityRows.flatMap((row) => {
      if (row.PlantId !== plantId || (workCenterId && row.WorkCenterId !== workCenterId)) return [];
      const workCenter = workCenterById.get(row.WorkCenterId);
      const start = storedTimestamp(row.PeriodStart);
      const end = storedTimestamp(row.PeriodEnd);
      if (!workCenter || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || start >= toMs || end <= fromMs) return [];
      return [{ row, workCenter, start, end }];
    });

    let buckets;
    if (bucket === "day") {
      buckets = rows.map(({ row, start, end }) => ({
        WorkCenterId: row.WorkCenterId,
        PeriodStart: new Date(start).toISOString(),
        PeriodEnd: new Date(end).toISOString(),
        AvailableMinutes: roundTo3(storedNumber(row.AvailableMinutes)),
        PlannedLoadMinutes: roundTo3(storedNumber(row.PlannedLoadMinutes)),
        UtilizationPct: row.UtilizationPct === null || row.UtilizationPct === undefined
          ? null
          : roundTo3(storedNumber(row.UtilizationPct)),
        ScheduleVersion: scheduleVersion,
      }));
    } else {
      const grouped = new Map();
      for (const { row, workCenter, start, end } of rows) {
        const localDate = localDateAt(start, workCenter.TimeZoneId || "UTC");
        const weekStart = isoWeekStart(localDate);
        const key = `${workCenter.Id}\u0000${weekStart}`;
        let aggregate = grouped.get(key);
        if (!aggregate) {
          aggregate = {
            WorkCenterId: workCenter.Id,
            start,
            end,
            available: 0,
            planned: 0,
          };
          grouped.set(key, aggregate);
        }
        aggregate.start = Math.min(aggregate.start, start);
        aggregate.end = Math.max(aggregate.end, end);
        aggregate.available += storedNumber(row.AvailableMinutes);
        aggregate.planned += storedNumber(row.PlannedLoadMinutes);
      }
      buckets = [...grouped.values()].map((aggregate) => ({
        WorkCenterId: aggregate.WorkCenterId,
        PeriodStart: new Date(aggregate.start).toISOString(),
        PeriodEnd: new Date(aggregate.end).toISOString(),
        AvailableMinutes: roundTo3(aggregate.available),
        PlannedLoadMinutes: roundTo3(aggregate.planned),
        UtilizationPct: aggregate.available <= 0
          ? null
          : Math.min(9999.999, roundTo3((aggregate.planned / aggregate.available) * 100)),
        ScheduleVersion: scheduleVersion,
      }));
    }
    buckets.sort((left, right) => Date.parse(left.PeriodStart) - Date.parse(right.PeriodStart)
      || String(left.WorkCenterId).localeCompare(String(right.WorkCenterId)));
    return { scheduleVersion, bucket, buckets };
  }));

  app.get(`${ROOT}/capacity/bottlenecks`, route("mfg.capacity.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["from", "to", "minUtilizationPct"]));
    const from = isoDateTime(q.from, "from", { required: true });
    const to = isoDateTime(q.to, "to", { required: true });
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (toMs <= fromMs) throw bad("to", "to باید پس از from باشد");
    let minUtilizationPct = null;
    if (q.minUtilizationPct !== undefined) {
      const raw = String(q.minUtilizationPct);
      if (!/^\d+(?:\.\d+)?$/.test(raw)) throw bad("minUtilizationPct", "minUtilizationPct باید عددی بین ۰ و ۱۰۰ باشد");
      minUtilizationPct = Number(raw);
      if (!Number.isFinite(minUtilizationPct) || minUtilizationPct < 0 || minUtilizationPct > 100) {
        throw bad("minUtilizationPct", "minUtilizationPct باید عددی بین ۰ و ۱۰۰ باشد");
      }
    }
    const effectiveMinUtilizationPct = minUtilizationPct ?? 100;
    const latestRuns = await r.list("MfgScheduleRun", {
      where: [{ column: "PlantId", op: "eq", value: plantId }],
      orderBy: [{ column: "ScheduleVersion", dir: "desc" }],
      limit: 1,
    });
    const scheduleVersion = latestRuns[0]?.ScheduleVersion ?? 0;
    if (scheduleVersion === 0) return { scheduleVersion, items: [] };

    const [capacityRows, workCenters] = await Promise.all([
      r.list("MfgCapacityPlan", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ScheduleVersion", op: "eq", value: scheduleVersion },
        ],
      }),
      r.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const plantWorkCenterIds = new Set(workCenters
      .filter((workCenter) => workCenter.PlantId === plantId)
      .map((workCenter) => workCenter.Id));
    const items = capacityRows.flatMap((row) => {
      if (row.PlantId !== plantId || !plantWorkCenterIds.has(row.WorkCenterId)) return [];
      const start = storedTimestamp(row.PeriodStart);
      const end = storedTimestamp(row.PeriodEnd);
      const overload = storedNumber(row.OverloadMinutes);
      const planned = storedNumber(row.PlannedLoadMinutes);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start >= toMs || end <= fromMs) return [];
      const utilization = row.UtilizationPct === null || row.UtilizationPct === undefined
        ? null
        : storedNumber(row.UtilizationPct);
      if (overload <= 0 && !(planned > 0 && utilization !== null && utilization >= effectiveMinUtilizationPct)) return [];
      return [{
        WorkCenterId: row.WorkCenterId,
        PeriodStart: new Date(start).toISOString(),
        PeriodEnd: new Date(end).toISOString(),
        AvailableMinutes: roundTo3(storedNumber(row.AvailableMinutes)),
        PlannedLoadMinutes: roundTo3(planned),
        OverloadMinutes: roundTo3(overload),
        UtilizationPct: utilization === null ? null : roundTo3(utilization),
        scheduleVersion,
      }];
    }).sort((left, right) => Date.parse(left.PeriodStart) - Date.parse(right.PeriodStart)
      || String(left.WorkCenterId).localeCompare(String(right.WorkCenterId)));
    return { scheduleVersion, items };
  }));

  app.patch(`${ROOT}/orders/:orderId/priority`, route("mfg.order.reprioritize", async ({ repo: r, req, subject }) => {
    const orderId = text(req.params.orderId, "orderId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgProductionOrder", orderId);
    if (!row || row.PlantId !== req.mfgPlantId) throw notFound();
    if (["completed", "closed"].includes(row.Status)) throw conflict("MFG_STATE_CONFLICT", "اولویت سفارش تکمیل‌شده یا بسته قابل تغییر نیست");
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["PriorityRule", "ManualRank", "DispatchWeight"]));
    const priorityRule = text(body.PriorityRule, "PriorityRule", { required: true, max: 12 });
    if (!PRIORITY_RULES.has(priorityRule)) throw bad("PriorityRule", "PriorityRule باید EDD، CR یا MANUAL باشد");
    const manualRank = number(body.ManualRank, "ManualRank", { min: 0, integer: true });
    if (priorityRule === "MANUAL" && manualRank === null) throw bad("ManualRank", "برای MANUAL، ManualRank الزامی است");
    if (priorityRule !== "MANUAL" && manualRank !== null) throw bad("ManualRank", "ManualRank فقط برای PriorityRule=MANUAL پذیرفته می‌شود");
    const dispatchWeight = body.DispatchWeight === undefined
      ? (row.DispatchWeight ?? 1)
      : parseDispatchWeight(body.DispatchWeight);
    const expectedVersion = rowVersionFrom(req);
    const result = await r.patch("MfgProductionOrder", row.Id, { PriorityRule: priorityRule, ManualRank: manualRank, DispatchWeight: dispatchWeight }, requestActor(req), expectedVersion);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") throw notFound();
      throw conflict("MFG_ROW_VERSION_CONFLICT", "رکورد از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
    }
    const saved = await r.get("MfgProductionOrder", row.Id);
    await writeAudit(r, req, "MFG_ORDER_REPRIORITIZED", "MfgProductionOrder", row.Id, "mfg.order.reprioritize");
    return protectProjectLink(subject, saved, evaluate);
  }));

  app.get(`${ROOT}/operation-queue`, route("mfg.execution.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["workCenterId", "status", "shiftDate", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit حداقل ۱ است");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const workCenterId = text(q.workCenterId, "workCenterId", { max: 60, pattern: ID_RE });
    const statusFilter = text(q.status, "status", { max: 24 });
    if (statusFilter && !OPERATION_STATUSES.has(statusFilter)) {
      throw bad("status", "وضعیت عملیات معتبر نیست");
    }
    const shiftDate = isoDate(q.shiftDate, "shiftDate");

    if (workCenterId) {
      const wc = await r.get("MfgWorkCenter", workCenterId);
      if (!wc || wc.PlantId !== plantId) throw notFound();
    }

    const [orders, operations, latestRuns, workCenters, allExecutions] = await Promise.all([
      r.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgScheduleRun", {
        where: [{ column: "PlantId", op: "eq", value: plantId }],
        orderBy: [{ column: "ScheduleVersion", dir: "desc" }],
        limit: 1,
      }),
      r.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgOperationExecution", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);

    const activeOrdersById = new Map(
      orders
        .filter((order) => order.PlantId === plantId && ["released", "in-progress"].includes(order.Status))
        .map((order) => [order.Id, order]),
    );
    const workCenterById = new Map(
      workCenters
        .filter((wc) => wc.PlantId === plantId)
        .map((wc) => [wc.Id, wc]),
    );
    const executionsByOperationId = new Map();
    for (const exec of allExecutions) {
      if (exec.PlantId !== plantId || exec.Status === "cancelled") continue;
      const list = executionsByOperationId.get(exec.ProductionOrderOperationId) ?? [];
      list.push(exec);
      executionsByOperationId.set(exec.ProductionOrderOperationId, list);
    }
    for (const list of executionsByOperationId.values()) {
      list.sort((a, b) => (Number(b.ExecutionNo) || 0) - (Number(a.ExecutionNo) || 0));
    }

    const scheduleVersion = latestRuns[0]?.ScheduleVersion ?? 0;
    const scheduleRows = scheduleVersion > 0
      ? await r.list("MfgOperationSchedule", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ScheduleVersion", op: "eq", value: scheduleVersion },
        ],
      })
      : [];

    const segmentsByOperationId = new Map();
    for (const seg of scheduleRows) {
      if (seg.PlantId !== plantId || seg.Status === "cancelled") continue;
      const list = segmentsByOperationId.get(seg.ProductionOrderOperationId) ?? [];
      list.push(seg);
      segmentsByOperationId.set(seg.ProductionOrderOperationId, list);
    }
    for (const list of segmentsByOperationId.values()) {
      list.sort((a, b) => storedTimestamp(a.PlannedStartAt) - storedTimestamp(b.PlannedStartAt)
        || (a.SegmentIndex ?? 1) - (b.SegmentIndex ?? 1));
    }

    const matched = [];
    for (const op of operations) {
      if (op.PlantId !== plantId) continue;
      const order = activeOrdersById.get(op.ProductionOrderId);
      if (!order) continue;
      if (workCenterId && op.WorkCenterId !== workCenterId) continue;
      if (statusFilter && op.Status !== statusFilter) continue;

      const segments = segmentsByOperationId.get(op.Id) ?? [];
      if (shiftDate) {
        const wc = workCenterById.get(op.WorkCenterId);
        const tz = wc?.TimeZoneId || "UTC";
        const matchesShiftDate = segments.some((seg) => {
          const startMs = storedTimestamp(seg.PlannedStartAt);
          const endMs = storedTimestamp(seg.PlannedEndAt);
          if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
          const startLocal = localDateAt(startMs, tz);
          const endLocal = localDateAt(Math.max(startMs, endMs - 1), tz);
          return startLocal <= shiftDate && endLocal >= shiftDate;
        });
        if (!matchesShiftDate) continue;
      }

      const firstSeg = segments[0] ?? null;
      const lastSeg = segments[segments.length - 1] ?? null;
      const plannedStartMs = firstSeg ? storedTimestamp(firstSeg.PlannedStartAt) : Number.POSITIVE_INFINITY;
      const wc = workCenterById.get(op.WorkCenterId) ?? null;
      const opExecs = executionsByOperationId.get(op.Id) ?? [];
      const activeExec = opExecs.find((ex) => ex.Status === "running") ?? null;
      const latestExec = opExecs[0] ?? null;
      const cumulativeInputQty = roundTo3(opExecs.reduce((sum, ex) => sum + storedNumber(ex.InputQuantity), 0));
      const cumulativeGoodQty = roundTo3(opExecs.reduce((sum, ex) => sum + storedNumber(ex.GoodQuantity), 0));
      const cumulativeScrapQty = roundTo3(opExecs.reduce((sum, ex) => sum + storedNumber(ex.ScrapQuantity), 0));
      const cumulativeReworkQty = roundTo3(opExecs.reduce((sum, ex) => sum + storedNumber(ex.ReworkQuantity), 0));

      matched.push({
        op,
        plannedStartMs,
        enriched: {
          ...op,
          OrderNo: order.OrderNo,
          OrderStatus: order.Status,
          PriorityRule: order.PriorityRule,
          DueDate: order.DueDate,
          WorkCenterCode: wc?.Code ?? null,
          WorkCenterNameFa: wc?.NameFa ?? null,
          PlannedStartAt: firstSeg ? storedIsoTimestamp(firstSeg.PlannedStartAt) : null,
          PlannedEndAt: lastSeg ? storedIsoTimestamp(lastSeg.PlannedEndAt) : null,
          ScheduledResourceId: firstSeg?.ResourceId ?? null,
          ScheduleVersion: scheduleVersion > 0 ? scheduleVersion : null,
          SegmentCount: segments.length,
          IsFirmScheduled: segments.some((s) => Boolean(s.IsFirm)),
          ActiveExecution: activeExec,
          LatestExecution: latestExec,
          ExecutionCount: opExecs.length,
          CumulativeInputQuantity: cumulativeInputQty,
          CumulativeGoodQuantity: cumulativeGoodQty,
          CumulativeScrapQuantity: cumulativeScrapQty,
          CumulativeReworkQuantity: cumulativeReworkQty,
        },
      });
    }

    matched.sort((left, right) => {
      if (left.plannedStartMs !== right.plannedStartMs) return left.plannedStartMs - right.plannedStartMs;
      if ((left.op.SequenceNo ?? 0) !== (right.op.SequenceNo ?? 0)) return (left.op.SequenceNo ?? 0) - (right.op.SequenceNo ?? 0);
      return String(left.op.Id).localeCompare(String(right.op.Id));
    });

    const items = matched.slice(offset, offset + limit).map((entry) => entry.enriched);
    return { items, page: { limit, offset, total: matched.length } };
  }));

  app.post(`${ROOT}/operations/:operationId/executions`, route("mfg.execution.start", async ({ repo: r, req, plantId, subject }) => {
    const operationId = text(req.params.operationId, "operationId", { required: true, max: 60, pattern: ID_RE });
    const idempotencyKey = idempotencyKeyFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["ResourceId", "OperatorId", "StartedAt", "NoteFa"]));
    const resourceId = text(body.ResourceId, "ResourceId", { max: 60, pattern: ID_RE });
    const operatorId = text(body.OperatorId, "OperatorId", { max: 60, pattern: ID_RE }) ?? subject.id;
    const startedAt = body.StartedAt !== undefined
      ? isoDateTime(body.StartedAt, "StartedAt", { required: true })
      : new Date().toISOString();
    const noteFa = text(body.NoteFa, "NoteFa", { max: 800 });

    return r.transaction(async (tx) => {
      const existingByKey = await tx.list("MfgOperationExecution", {
        where: [{ column: "IdempotencyKey", op: "eq", value: idempotencyKey }],
        limit: 1,
      });
      if (existingByKey.length > 0) {
        const existing = existingByKey[0];
        if (
          existing.PlantId !== plantId
          || existing.ProductionOrderOperationId !== operationId
          || (resourceId !== null && existing.ResourceId !== resourceId)
          || (body.OperatorId !== undefined && existing.OperatorId !== operatorId)
        ) {
          throw conflict("MFG_IDEMPOTENCY_CONFLICT", "کلید Idempotency-Key قبلاً برای درخواست دیگری مصرف شده است");
        }
        return existing;
      }

      const auditRows = await tx.list("AuditLog", {});
      if (auditRows.some((row) => row?.Details?.idempotencyKey === idempotencyKey && row.Action !== "MFG_EXECUTION_STARTED")) {
        throw conflict("MFG_IDEMPOTENCY_CONFLICT", "کلید Idempotency-Key قبلاً برای درخواست دیگری مصرف شده است");
      }

      const operation = await tx.get("MfgProductionOrderOperation", operationId);
      if (!operation || operation.PlantId !== plantId) throw notFound();
      if (operation.Status === "completed" || operation.Status === "blocked") {
        throw conflict("MFG_STATE_CONFLICT", "عملیات تکمیل‌شده یا مسدود قابل شروع مجدد نیست");
      }

      const order = await tx.get("MfgProductionOrder", operation.ProductionOrderId);
      if (!order || order.PlantId !== plantId) throw notFound();
      if (!["released", "in-progress"].includes(order.Status)) {
        throw businessRule("MFG_ORDER_NOT_RELEASED", "سفارش تولید هنوز آزاد نشده یا قابل اجرا نیست", { orderStatus: order.Status });
      }

      if (operation.PredecessorOperationId) {
        const predecessor = await tx.get("MfgProductionOrderOperation", operation.PredecessorOperationId);
        if (!predecessor || predecessor.PlantId !== plantId) {
          throw businessRule("MFG_PREDECESSOR_NOT_COMPLETED", "عملیات پیش‌نیاز در کارخانه یافت نشد");
        }
        if (predecessor.Status !== "completed") {
          let overlapReady = false;
          const transferBatchQty = storedNumber(operation.TransferBatchQty, 0);
          if (operation.OverlapAllowed === true && transferBatchQty > 0) {
            const predExecutions = await tx.list("MfgOperationExecution", {
              where: [
                { column: "PlantId", op: "eq", value: plantId },
                { column: "ProductionOrderOperationId", op: "eq", value: predecessor.Id },
              ],
            });
            const predGoodQty = predExecutions
              .filter((exec) => exec.Status !== "cancelled")
              .reduce((sum, exec) => sum + storedNumber(exec.GoodQuantity), 0);
            overlapReady = predGoodQty + 1e-6 >= transferBatchQty;
          }
          if (!overlapReady) {
            throw businessRule("MFG_PREDECESSOR_NOT_COMPLETED", "پیش‌نیاز عملیات هنوز تکمیل نشده است", {
              predecessorOperationId: predecessor.Id,
              predecessorStatus: predecessor.Status,
            });
          }
        }
      }

      const workCenter = await tx.get("MfgWorkCenter", operation.WorkCenterId);
      if (!workCenter || workCenter.PlantId !== plantId || workCenter.Status !== "active") {
        throw businessRule("MFG_WORKCENTER_UNAVAILABLE", "مرکز کاری عملیات فعال نیست");
      }

      if (resourceId) {
        const resource = await tx.get("MfgWorkCenterResource", resourceId);
        if (!resource || resource.PlantId !== plantId || resource.WorkCenterId !== operation.WorkCenterId || !resource.IsActive) {
          throw businessRule("MFG_RESOURCE_UNAVAILABLE", "منبع انتخابی در مرکز کاری عملیات فعال نیست");
        }
      }

      const existingExecutions = await tx.list("MfgOperationExecution", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderOperationId", op: "eq", value: operation.Id },
        ],
      });
      const maxExecNo = existingExecutions.reduce((max, row) => Math.max(max, Number(row.ExecutionNo) || 0), 0);
      const executionNo = maxExecNo + 1;

      const created = await tx.create("MfgOperationExecution", {
        PlantId: plantId,
        ProductionOrderOperationId: operation.Id,
        ExecutionNo: executionNo,
        Status: "running",
        ResourceId: resourceId,
        OperatorId: operatorId,
        StartedAt: startedAt,
        FinishedAt: null,
        SetupActualMinutes: 0,
        RunActualMinutes: 0,
        InputQuantity: 0,
        GoodQuantity: 0,
        ReworkQuantity: 0,
        ScrapQuantity: 0,
        IdempotencyKey: idempotencyKey,
        NoteFa: noteFa,
      }, subject.id);

      if (operation.Status !== "running") {
        const opPatch = await tx.patch("MfgProductionOrderOperation", operation.Id, { Status: "running" }, subject.id, operation.RowVersion);
        if (!opPatch.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "وضعیت عملیات هم‌زمان تغییر کرده است؛ دوباره تلاش کنید");
      }

      if (order.Status === "released") {
        const orderPatch = await tx.patch("MfgProductionOrder", order.Id, { Status: "in-progress" }, subject.id, order.RowVersion);
        if (!orderPatch.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "وضعیت سفارش هم‌زمان تغییر کرده است؛ دوباره تلاش کنید");
      }

      await createAuditRecord(tx, req, "MFG_EXECUTION_STARTED", "MfgOperationExecution", created.Id, "mfg.execution.start", {
        idempotencyKey,
        operationId: operation.Id,
        executionNo,
      });

      return created;
    });
  }, 201));

  app.post(`${ROOT}/executions/:executionId/reports`, route("mfg.execution.report", async ({ repo: r, req, plantId, subject }) => {
    const executionId = text(req.params.executionId, "executionId", { required: true, max: 60, pattern: ID_RE });
    const expectedVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "InputQuantity",
      "GoodQuantity",
      "ReworkQuantity",
      "ScrapQuantity",
      "SetupActualMinutes",
      "RunActualMinutes",
      "NoteFa",
    ]));

    const inputQuantity = number(body.InputQuantity, "InputQuantity", { required: true, min: 0, max: 999_999_999 });
    const goodQuantity = number(body.GoodQuantity, "GoodQuantity", { required: true, min: 0, max: 999_999_999 });
    const reworkQuantity = number(body.ReworkQuantity, "ReworkQuantity", { required: true, min: 0, max: 999_999_999 });
    const scrapQuantity = number(body.ScrapQuantity, "ScrapQuantity", { required: true, min: 0, max: 999_999_999 });
    const setupActualMinutes = number(body.SetupActualMinutes, "SetupActualMinutes", { required: true, min: 0, max: 999_999_999 });
    const runActualMinutes = number(body.RunActualMinutes, "RunActualMinutes", { required: true, min: 0, max: 999_999_999 });
    const noteFa = text(body.NoteFa, "NoteFa", { max: 800 });

    return r.transaction(async (tx) => {
      const execution = await tx.get("MfgOperationExecution", executionId);
      if (!execution || execution.PlantId !== plantId) throw notFound();
      if (execution.RowVersion !== expectedVersion) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "رکورد نشست اجرا از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }
      if (execution.Status !== "running") {
        throw conflict("MFG_STATE_CONFLICT", "فقط نشست در حال اجرا قابل گزارش‌دهی است");
      }

      const operation = await tx.get("MfgProductionOrderOperation", execution.ProductionOrderOperationId);
      if (!operation || operation.PlantId !== plantId) throw notFound();
      const order = await tx.get("MfgProductionOrder", operation.ProductionOrderId);
      if (!order || order.PlantId !== plantId) throw notFound();

      const nextInput = roundTo3(storedNumber(execution.InputQuantity) + inputQuantity);
      const nextGood = roundTo3(storedNumber(execution.GoodQuantity) + goodQuantity);
      const nextRework = roundTo3(storedNumber(execution.ReworkQuantity) + reworkQuantity);
      const nextScrap = roundTo3(storedNumber(execution.ScrapQuantity) + scrapQuantity);
      const nextSetup = roundTo3(storedNumber(execution.SetupActualMinutes) + setupActualMinutes);
      const nextRun = roundTo3(storedNumber(execution.RunActualMinutes) + runActualMinutes);

      if (roundTo3(nextGood + nextRework + nextScrap) > nextInput + 1e-6) {
        throw bad("InputQuantity", "مجموع تجمعی مقادیر خروجی از مقدار ورودی نشست بیشتر است");
      }

      const allExecutions = await tx.list("MfgOperationExecution", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderOperationId", op: "eq", value: operation.Id },
        ],
      });
      const otherInput = allExecutions
        .filter((row) => row.Id !== execution.Id && row.Status !== "cancelled")
        .reduce((sum, row) => sum + storedNumber(row.InputQuantity), 0);
      const totalOperationInput = roundTo3(otherInput + nextInput);
      const maxAllowedQty = storedNumber(operation.PlannedQuantity, storedNumber(order.OrderQuantity));
      if (order.AllowOverrun !== true && totalOperationInput > maxAllowedQty + 1e-6) {
        throw businessRule("MFG_OVERRUN_NOT_ALLOWED", "مجموع مقدار گزارش‌شده از سقف مجاز سفارش بیشتر است و AllowOverrun فعال نیست", {
          plannedQuantity: maxAllowedQty,
          reportedInputQuantity: totalOperationInput,
        });
      }

      const patchPayload = {
        InputQuantity: nextInput,
        GoodQuantity: nextGood,
        ReworkQuantity: nextRework,
        ScrapQuantity: nextScrap,
        SetupActualMinutes: nextSetup,
        RunActualMinutes: nextRun,
      };
      if (body.NoteFa !== undefined) patchPayload.NoteFa = noteFa;

      const patchRes = await tx.patch("MfgOperationExecution", execution.Id, patchPayload, subject.id, expectedVersion);
      if (!patchRes.ok) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "رکورد نشست اجرا از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }
      const updated = await tx.get("MfgOperationExecution", execution.Id);
      await createAuditRecord(tx, req, "MFG_EXECUTION_REPORTED", "MfgOperationExecution", execution.Id, "mfg.execution.report", {
        operationId: operation.Id,
        addedInputQuantity: inputQuantity,
        addedGoodQuantity: goodQuantity,
        addedScrapQuantity: scrapQuantity,
        addedReworkQuantity: reworkQuantity,
      });
      return updated;
    });
  }));

  app.post(`${ROOT}/executions/:executionId/finish`, route("mfg.execution.finish", async ({ repo: r, req, plantId, subject }) => {
    const executionId = text(req.params.executionId, "executionId", { required: true, max: 60, pattern: ID_RE });
    const idempotencyKey = idempotencyKeyFrom(req);
    const expectedVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["FinishedAt", "InspectionApproved", "NoteFa"]));
    const finishedAtInput = isoDateTime(body.FinishedAt, "FinishedAt");
    const inspectionApproved = bool(body.InspectionApproved, "InspectionApproved", false);
    const noteFa = text(body.NoteFa, "NoteFa", { max: 800 });
    const fingerprint = JSON.stringify({
      executionId,
      finishedAt: finishedAtInput ?? null,
      inspectionApproved,
    });

    return r.transaction(async (tx) => {
      const replayedExecution = await resolveIdempotentAuditReplay(tx, {
        idempotencyKey,
        plantId,
        action: "MFG_EXECUTION_FINISHED",
        entityName: "MfgOperationExecution",
        fingerprint,
      });
      if (replayedExecution) {
        const currentOp = await tx.get("MfgProductionOrderOperation", replayedExecution.ProductionOrderOperationId);
        return {
          ...replayedExecution,
          OperationStatus: currentOp?.Status ?? null,
          execution: replayedExecution,
          operation: currentOp ?? null,
        };
      }

      const execution = await tx.get("MfgOperationExecution", executionId);
      if (!execution || execution.PlantId !== plantId) throw notFound();
      if (execution.RowVersion !== expectedVersion) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "رکورد نشست اجرا از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }
      if (execution.Status !== "running") {
        throw conflict("MFG_STATE_CONFLICT", "فقط نشست در حال اجرا قابل اتمام است");
      }

      const finishedAt = finishedAtInput ?? new Date().toISOString();
      const startedMs = storedTimestamp(execution.StartedAt);
      const finishedMs = Date.parse(finishedAt);
      if (!Number.isFinite(startedMs) || finishedMs < startedMs) {
        throw bad("FinishedAt", "FinishedAt نمی‌تواند پیش از StartedAt باشد");
      }

      const inputQty = roundTo3(storedNumber(execution.InputQuantity));
      const accountedQty = roundTo3(
        storedNumber(execution.GoodQuantity)
        + storedNumber(execution.ReworkQuantity)
        + storedNumber(execution.ScrapQuantity),
      );
      if (inputQty <= 0 || Math.abs(accountedQty - inputQty) > 1e-6) {
        throw businessRule("MFG_EXECUTION_QUANTITY_UNRECONCILED", "پیش از اتمام نشست، همهٔ مقادیر ورودی باید بین سالم، ضایعات و دوباره‌کاری تعیین تکلیف شوند", {
          inputQuantity: inputQty,
          accountedQuantity: accountedQty,
        });
      }

      const operation = await tx.get("MfgProductionOrderOperation", execution.ProductionOrderOperationId);
      if (!operation || operation.PlantId !== plantId) throw notFound();
      if (operation.InspectionRequired === true && inspectionApproved !== true) {
        throw businessRule("MFG_INSPECTION_REQUIRED", "این عملیات نیازمند تأیید بازرسی کیفی (InspectionApproved=true) پیش از اتمام است", {
          operationId: operation.Id,
        });
      }

      const execPatchPayload = {
        Status: "completed",
        FinishedAt: finishedAt,
      };
      if (body.NoteFa !== undefined) execPatchPayload.NoteFa = noteFa;
      const execPatch = await tx.patch("MfgOperationExecution", execution.Id, execPatchPayload, subject.id, expectedVersion);
      if (!execPatch.ok) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "رکورد نشست اجرا از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }

      const allExecutions = await tx.list("MfgOperationExecution", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderOperationId", op: "eq", value: operation.Id },
        ],
      });
      const hasOtherRunning = allExecutions.some((row) => row.Id !== execution.Id && row.Status === "running");
      const completedAccountedQty = allExecutions
        .filter((row) => row.Status === "completed" || row.Id === execution.Id)
        .reduce((sum, row) => sum + storedNumber(row.GoodQuantity) + storedNumber(row.ScrapQuantity) + storedNumber(row.ReworkQuantity), 0);
      const targetPlannedQty = storedNumber(operation.PlannedQuantity);
      const nextOpStatus = hasOtherRunning
        ? "running"
        : completedAccountedQty + 1e-6 >= targetPlannedQty
          ? "completed"
          : "queued";

      if (operation.Status !== nextOpStatus) {
        const opPatch = await tx.patch("MfgProductionOrderOperation", operation.Id, { Status: nextOpStatus }, subject.id, operation.RowVersion);
        if (!opPatch.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "وضعیت عملیات هم‌زمان تغییر کرده است؛ دوباره تلاش کنید");
      }

      const updatedExecution = await tx.get("MfgOperationExecution", execution.Id);
      const updatedOperation = await tx.get("MfgProductionOrderOperation", operation.Id);

      await createAuditRecord(tx, req, "MFG_EXECUTION_FINISHED", "MfgOperationExecution", execution.Id, "mfg.execution.finish", {
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        operationId: operation.Id,
        operationStatus: updatedOperation.Status,
      });

      return {
        ...updatedExecution,
        OperationStatus: updatedOperation.Status,
        execution: updatedExecution,
        operation: updatedOperation,
      };
    });
  }));

  app.post(`${ROOT}/downtime`, route("mfg.downtime.report", async ({ repo: r, req, plantId, subject }) => {
    const idempotencyKey = idempotencyKeyFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "WorkCenterId",
      "OperationId",
      "ProductionOrderOperationId",
      "ExecutionId",
      "ResourceId",
      "StartedAt",
      "FinishedAt",
      "DowntimeType",
      "ReasonCode",
      "NoteFa",
    ]));

    const workCenterId = text(body.WorkCenterId, "WorkCenterId", { required: true, max: 60, pattern: ID_RE });
    const rawOpId = body.OperationId !== undefined ? body.OperationId : body.ProductionOrderOperationId;
    const operationId = text(rawOpId, "OperationId", { max: 60, pattern: ID_RE });
    if (
      body.OperationId !== undefined
      && body.ProductionOrderOperationId !== undefined
      && body.OperationId !== body.ProductionOrderOperationId
    ) {
      throw bad("OperationId", "OperationId و ProductionOrderOperationId نباید متعارض باشند");
    }
    const executionId = text(body.ExecutionId, "ExecutionId", { max: 60, pattern: ID_RE });
    const resourceId = text(body.ResourceId, "ResourceId", { max: 60, pattern: ID_RE });
    const startedAt = isoDateTime(body.StartedAt, "StartedAt", { required: true });
    const finishedAt = isoDateTime(body.FinishedAt, "FinishedAt");
    const downtimeType = text(body.DowntimeType, "DowntimeType", { required: true, max: 16 });
    if (!DOWNTIME_TYPES.has(downtimeType)) {
      throw bad("DowntimeType", "DowntimeType باید planned یا unplanned باشد");
    }
    const reasonCode = text(body.ReasonCode, "ReasonCode", { required: true, max: 60, pattern: CODE_RE });
    const noteFa = text(body.NoteFa, "NoteFa", { max: 800 });

    let durationMinutes = null;
    if (finishedAt !== null) {
      const startMs = Date.parse(startedAt);
      const endMs = Date.parse(finishedAt);
      if (endMs < startMs) {
        throw bad("FinishedAt", "FinishedAt نمی‌تواند پیش از StartedAt باشد");
      }
      durationMinutes = roundTo3((endMs - startMs) / 60_000);
    }

    const fingerprint = JSON.stringify({
      workCenterId,
      operationId,
      executionId,
      resourceId,
      startedAt,
      finishedAt,
      downtimeType,
      reasonCode,
    });

    return r.transaction(async (tx) => {
      const replayed = await resolveIdempotentAuditReplay(tx, {
        idempotencyKey,
        plantId,
        action: "MFG_DOWNTIME_RECORDED",
        entityName: "MfgDowntimeLog",
        fingerprint,
      });
      if (replayed) return replayed;

      const workCenter = await tx.get("MfgWorkCenter", workCenterId);
      if (!workCenter || workCenter.PlantId !== plantId) throw notFound();

      if (operationId) {
        const operation = await tx.get("MfgProductionOrderOperation", operationId);
        if (!operation || operation.PlantId !== plantId) throw notFound();
        if (operation.WorkCenterId !== workCenterId) {
          throw businessRule("MFG_DOWNTIME_WORKCENTER_MISMATCH", "عملیات انتخابی متعلق به این مرکز کاری نیست");
        }
      }

      if (executionId) {
        const execution = await tx.get("MfgOperationExecution", executionId);
        if (!execution || execution.PlantId !== plantId) throw notFound();
        if (operationId && execution.ProductionOrderOperationId !== operationId) {
          throw businessRule("MFG_DOWNTIME_EXECUTION_MISMATCH", "نشست انتخابی متعلق به عملیات اعلام‌شده نیست");
        }
      }

      if (resourceId) {
        const resource = await tx.get("MfgWorkCenterResource", resourceId);
        if (!resource || resource.PlantId !== plantId || resource.WorkCenterId !== workCenterId) {
          throw businessRule("MFG_RESOURCE_UNAVAILABLE", "منبع انتخابی متعلق به این مرکز کاری در کارخانه نیست");
        }
      }

      const created = await tx.create("MfgDowntimeLog", {
        PlantId: plantId,
        WorkCenterId: workCenterId,
        ProductionOrderOperationId: operationId,
        ExecutionId: executionId,
        ResourceId: resourceId,
        StartedAt: startedAt,
        FinishedAt: finishedAt,
        DurationMinutes: durationMinutes,
        DowntimeType: downtimeType,
        ReasonCode: reasonCode,
        RecordedBy: subject.id,
        NoteFa: noteFa,
      }, subject.id);

      await createAuditRecord(tx, req, "MFG_DOWNTIME_RECORDED", "MfgDowntimeLog", created.Id, "mfg.downtime.report", {
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        workCenterId,
        downtimeType,
      });

      return created;
    });
  }, 201));

  app.post(`${ROOT}/scrap`, route("mfg.scrap.report", async ({ repo: r, req, plantId, subject }) => {
    const idempotencyKey = idempotencyKeyFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "OperationId",
      "ProductionOrderOperationId",
      "ExecutionId",
      "Quantity",
      "Uom",
      "ReasonCode",
      "Disposition",
      "CostAmount",
      "Currency",
      "NoteFa",
    ]));

    const rawOpId = body.OperationId !== undefined ? body.OperationId : body.ProductionOrderOperationId;
    const operationId = text(rawOpId, "OperationId", { required: true, max: 60, pattern: ID_RE });
    if (
      body.OperationId !== undefined
      && body.ProductionOrderOperationId !== undefined
      && body.OperationId !== body.ProductionOrderOperationId
    ) {
      throw bad("OperationId", "OperationId و ProductionOrderOperationId نباید متعارض باشند");
    }
    const executionId = text(body.ExecutionId, "ExecutionId", { max: 60, pattern: ID_RE });
    const quantity = number(body.Quantity, "Quantity", { required: true, min: Number.MIN_VALUE, max: 999_999_999 });
    const uom = text(body.Uom, "Uom", { required: true, max: 16 });
    const reasonCode = text(body.ReasonCode, "ReasonCode", { required: true, max: 60, pattern: CODE_RE });
    const disposition = text(body.Disposition, "Disposition", { required: true, max: 20 });
    if (!SCRAP_DISPOSITIONS.has(disposition)) {
      throw bad("Disposition", "Disposition باید scrapped، returned-to-stock یا use-as-is باشد");
    }
    const costAmount = number(body.CostAmount, "CostAmount", { min: 0, max: 999_999_999_999 });
    const currency = text(body.Currency, "Currency", { max: 8, pattern: CURRENCY_RE }) ?? "IRR";
    const noteFa = text(body.NoteFa, "NoteFa", { max: 800 });

    const fingerprint = JSON.stringify({
      operationId,
      executionId,
      quantity,
      uom,
      reasonCode,
      disposition,
      costAmount,
      currency,
    });

    return r.transaction(async (tx) => {
      const replayed = await resolveIdempotentAuditReplay(tx, {
        idempotencyKey,
        plantId,
        action: "MFG_SCRAP_RECORDED",
        entityName: "MfgScrapRecord",
        fingerprint,
      });
      if (replayed) return replayed;

      const operation = await tx.get("MfgProductionOrderOperation", operationId);
      if (!operation || operation.PlantId !== plantId) throw notFound();

      if (executionId) {
        const execution = await tx.get("MfgOperationExecution", executionId);
        if (!execution || execution.PlantId !== plantId) throw notFound();
        if (execution.ProductionOrderOperationId !== operationId) {
          throw businessRule("MFG_SCRAP_EXECUTION_MISMATCH", "نشست انتخابی متعلق به عملیات اعلام‌شده نیست");
        }
      }

      const created = await tx.create("MfgScrapRecord", {
        PlantId: plantId,
        ProductionOrderOperationId: operationId,
        ExecutionId: executionId,
        Quantity: quantity,
        Uom: uom,
        ReasonCode: reasonCode,
        Disposition: disposition,
        CostAmount: costAmount,
        Currency: currency,
        RecordedAt: new Date().toISOString(),
        RecordedBy: subject.id,
        NoteFa: noteFa,
      }, subject.id);

      await createAuditRecord(tx, req, "MFG_SCRAP_RECORDED", "MfgScrapRecord", created.Id, "mfg.scrap.report", {
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        operationId,
        quantity,
      });

      return created;
    });
  }, 201));

  app.post(`${ROOT}/rework`, route("mfg.rework.report", async ({ repo: r, req, plantId, subject }) => {
    const idempotencyKey = idempotencyKeyFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "SourceOperationId",
      "TargetOperationId",
      "ExecutionId",
      "ScrapRecordId",
      "Quantity",
      "Uom",
      "ReasonCode",
      "Disposition",
      "NoteFa",
    ]));

    const sourceOperationId = text(body.SourceOperationId, "SourceOperationId", { required: true, max: 60, pattern: ID_RE });
    const targetOperationId = text(body.TargetOperationId, "TargetOperationId", { max: 60, pattern: ID_RE });
    const executionId = text(body.ExecutionId, "ExecutionId", { max: 60, pattern: ID_RE });
    const scrapRecordId = text(body.ScrapRecordId, "ScrapRecordId", { max: 60, pattern: ID_RE });
    const quantity = number(body.Quantity, "Quantity", { required: true, min: Number.MIN_VALUE, max: 999_999_999 });
    const uom = text(body.Uom, "Uom", { required: true, max: 16 });
    const reasonCode = text(body.ReasonCode, "ReasonCode", { required: true, max: 60, pattern: CODE_RE });
    const disposition = text(body.Disposition, "Disposition", { max: 20 });
    if (disposition !== null && !REWORK_DISPOSITIONS.has(disposition)) {
      throw bad("Disposition", "Disposition معتبر نیست");
    }
    const noteFa = text(body.NoteFa, "NoteFa", { max: 800 });

    const fingerprint = JSON.stringify({
      sourceOperationId,
      targetOperationId,
      executionId,
      scrapRecordId,
      quantity,
      uom,
      reasonCode,
      disposition,
    });

    return r.transaction(async (tx) => {
      const replayed = await resolveIdempotentAuditReplay(tx, {
        idempotencyKey,
        plantId,
        action: "MFG_REWORK_RECORDED",
        entityName: "MfgReworkRecord",
        fingerprint,
      });
      if (replayed) return replayed;

      const sourceOperation = await tx.get("MfgProductionOrderOperation", sourceOperationId);
      if (!sourceOperation || sourceOperation.PlantId !== plantId) throw notFound();

      if (targetOperationId) {
        const targetOperation = await tx.get("MfgProductionOrderOperation", targetOperationId);
        if (!targetOperation || targetOperation.PlantId !== plantId) throw notFound();
        if (targetOperation.ProductionOrderId !== sourceOperation.ProductionOrderId) {
          throw businessRule("MFG_REWORK_TARGET_MISMATCH", "عملیات مقصد دوباره‌کاری باید متعلق به همان سفارش تولید باشد");
        }
      }

      if (executionId) {
        const execution = await tx.get("MfgOperationExecution", executionId);
        if (!execution || execution.PlantId !== plantId) throw notFound();
        if (execution.ProductionOrderOperationId !== sourceOperationId) {
          throw businessRule("MFG_REWORK_EXECUTION_MISMATCH", "نشست اجرا متعلق به عملیات منبع دوباره‌کاری نیست");
        }
      }

      if (scrapRecordId) {
        const scrapRecord = await tx.get("MfgScrapRecord", scrapRecordId);
        if (!scrapRecord || scrapRecord.PlantId !== plantId) throw notFound();
        if (scrapRecord.ProductionOrderOperationId !== sourceOperationId) {
          throw businessRule("MFG_REWORK_SCRAP_MISMATCH", "رکورد ضایعات متعلق به عملیات منبع دوباره‌کاری نیست");
        }
      }

      const existingReworks = await tx.list("MfgReworkRecord", {
        where: [{ column: "PlantId", op: "eq", value: plantId }],
      });
      const existingNos = new Set(existingReworks.map((row) => row.ReworkNo));
      let seq = existingReworks.length + 1;
      let reworkNo = `RW-${String(seq).padStart(4, "0")}`;
      while (existingNos.has(reworkNo)) {
        seq += 1;
        reworkNo = `RW-${String(seq).padStart(4, "0")}`;
      }

      const created = await tx.create("MfgReworkRecord", {
        PlantId: plantId,
        ReworkNo: reworkNo,
        SourceOperationId: sourceOperationId,
        ExecutionId: executionId,
        TargetOperationId: targetOperationId,
        ScrapRecordId: scrapRecordId,
        Quantity: quantity,
        Uom: uom,
        ReasonCode: reasonCode,
        Status: "open",
        StartedAt: null,
        FinishedAt: null,
        Disposition: disposition,
        ActualCost: null,
        NoteFa: noteFa,
      }, subject.id);

      await createAuditRecord(tx, req, "MFG_REWORK_RECORDED", "MfgReworkRecord", created.Id, "mfg.rework.report", {
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        sourceOperationId,
        targetOperationId,
        reworkNo,
      });

      return created;
    });
  }, 201));

  app.get(`${ROOT}/operations/:operationId/variance`, route("mfg.execution.view", async ({ repo: r, req, plantId, subject }) => {
    const operationId = text(req.params.operationId, "operationId", { required: true, max: 60, pattern: ID_RE });
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["from", "to"]));
    const from = isoDateTime(q.from, "from");
    const to = isoDateTime(q.to, "to");
    const fromMs = from ? Date.parse(from) : null;
    const toMs = to ? Date.parse(to) : null;
    if (fromMs !== null && toMs !== null && toMs < fromMs) {
      throw bad("to", "to نمی‌تواند پیش از from باشد");
    }

    const operation = await r.get("MfgProductionOrderOperation", operationId);
    if (!operation || operation.PlantId !== plantId) throw notFound();

    const [executions, scrapRecords, reworkRecords, downtimeLogs] = await Promise.all([
      r.list("MfgOperationExecution", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderOperationId", op: "eq", value: operationId },
        ],
      }),
      r.list("MfgScrapRecord", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderOperationId", op: "eq", value: operationId },
        ],
      }),
      r.list("MfgReworkRecord", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "SourceOperationId", op: "eq", value: operationId },
        ],
      }),
      r.list("MfgDowntimeLog", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderOperationId", op: "eq", value: operationId },
        ],
      }),
    ]);

    const inWindow = (timestampValue) => {
      if (fromMs === null && toMs === null) return true;
      const ts = storedTimestamp(timestampValue);
      if (!Number.isFinite(ts)) return false;
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      return true;
    };

    const filteredExecutions = executions.filter(
      (row) => row.PlantId === plantId && row.Status !== "cancelled" && inWindow(row.StartedAt),
    );
    const filteredScraps = scrapRecords.filter(
      (row) => row.PlantId === plantId && inWindow(row.RecordedAt),
    );
    const filteredReworks = reworkRecords.filter(
      (row) => row.PlantId === plantId && row.Status !== "cancelled" && inWindow(row.StartedAt ?? row.CreatedAt ?? new Date().toISOString()),
    );
    const filteredDowntimes = downtimeLogs.filter(
      (row) => row.PlantId === plantId && inWindow(row.StartedAt),
    );

    const plannedQuantity = roundTo3(storedNumber(operation.PlannedQuantity));
    const standardSetupMinutes = roundTo3(storedNumber(operation.PlannedSetupMinutes));
    const standardRunMinutes = roundTo3(storedNumber(operation.PlannedRunMinutesPerUnit) * plannedQuantity);
    const standardTotalMinutes = roundTo3(
      storedNumber(operation.PlannedCapacityMinutes, standardSetupMinutes + standardRunMinutes),
    );

    const actualSetupMinutes = roundTo3(
      filteredExecutions.reduce((sum, row) => sum + storedNumber(row.SetupActualMinutes), 0),
    );
    const actualRunMinutes = roundTo3(
      filteredExecutions.reduce((sum, row) => sum + storedNumber(row.RunActualMinutes), 0),
    );
    const actualTotalMinutes = roundTo3(actualSetupMinutes + actualRunMinutes);

    const setupVarianceMinutes = roundTo3(actualSetupMinutes - standardSetupMinutes);
    const runVarianceMinutes = roundTo3(actualRunMinutes - standardRunMinutes);
    const totalTimeVarianceMinutes = roundTo3(actualTotalMinutes - standardTotalMinutes);

    const inputQuantity = roundTo3(
      filteredExecutions.reduce((sum, row) => sum + storedNumber(row.InputQuantity), 0),
    );
    const goodQuantity = roundTo3(
      filteredExecutions.reduce((sum, row) => sum + storedNumber(row.GoodQuantity), 0),
    );
    const executionScrapQty = roundTo3(
      filteredExecutions.reduce((sum, row) => sum + storedNumber(row.ScrapQuantity), 0),
    );
    const standaloneScrapQty = roundTo3(
      filteredScraps.reduce((sum, row) => sum + storedNumber(row.Quantity), 0),
    );
    const scrapQuantity = Math.max(executionScrapQty, standaloneScrapQty);

    const executionReworkQty = roundTo3(
      filteredExecutions.reduce((sum, row) => sum + storedNumber(row.ReworkQuantity), 0),
    );
    const standaloneReworkQty = roundTo3(
      filteredReworks.reduce((sum, row) => sum + storedNumber(row.Quantity), 0),
    );
    const reworkQuantity = Math.max(executionReworkQty, standaloneReworkQty);

    const downtimeMinutes = roundTo3(
      filteredDowntimes.reduce((sum, row) => sum + storedNumber(row.DurationMinutes), 0),
    );

    const canViewCost = evaluate(subject, "mfg.cost.view", { plantId }).allow;
    let cost = null;
    if (canViewCost) {
      const costRows = await r.list("MfgOperationCost", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderOperationId", op: "eq", value: operationId },
        ],
      });
      const validCostRows = costRows.filter((row) => row.PlantId === plantId && inWindow(row.CalculatedAt));
      const standardAmount = roundTo3(
        validCostRows.reduce((sum, row) => sum + storedNumber(row.StandardAmount), 0),
      );
      const actualAmount = roundTo3(
        validCostRows.reduce((sum, row) => sum + storedNumber(row.ActualAmount), 0),
      );
      const scrapCostAmount = roundTo3(
        filteredScraps.reduce((sum, row) => sum + storedNumber(row.CostAmount), 0),
      );
      cost = {
        Currency: validCostRows[0]?.Currency ?? filteredScraps[0]?.Currency ?? "IRR",
        StandardAmount: standardAmount,
        ActualAmount: actualAmount,
        VarianceAmount: roundTo3(actualAmount - standardAmount),
        ScrapCostAmount: scrapCostAmount,
        Elements: validCostRows,
      };
    }

    return {
      OperationId: operation.Id,
      ProductionOrderId: operation.ProductionOrderId,
      WorkCenterId: operation.WorkCenterId,
      OperationCode: operation.OperationCode,
      OperationNameFa: operation.OperationNameFa ?? null,
      SequenceNo: operation.SequenceNo ?? null,
      Status: operation.Status,
      InspectionRequired: Boolean(operation.InspectionRequired),
      OverlapAllowed: Boolean(operation.OverlapAllowed),
      TransferBatchQty: operation.TransferBatchQty ?? null,
      Quantities: {
        PlannedQuantity: plannedQuantity,
        InputQuantity: inputQuantity,
        GoodQuantity: goodQuantity,
        ScrapQuantity: scrapQuantity,
        ReworkQuantity: reworkQuantity,
      },
      TimeMinutes: {
        StandardSetupMinutes: standardSetupMinutes,
        ActualSetupMinutes: actualSetupMinutes,
        SetupVarianceMinutes: setupVarianceMinutes,
        StandardRunMinutes: standardRunMinutes,
        ActualRunMinutes: actualRunMinutes,
        RunVarianceMinutes: runVarianceMinutes,
        StandardTotalMinutes: standardTotalMinutes,
        ActualTotalMinutes: actualTotalMinutes,
        TotalTimeVarianceMinutes: totalTimeVarianceMinutes,
        DowntimeMinutes: downtimeMinutes,
      },
      Executions: filteredExecutions,
      ScrapRecords: filteredScraps,
      ReworkRecords: filteredReworks,
      DowntimeLogs: filteredDowntimes,
      Cost: cost,
      CostRedacted: !canViewCost,
    };
  }));

  app.get(`${ROOT}/materials`, route("mfg.material.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["q", "procurementType", "isActive", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit حداقل ۱ است");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);

    const procurementType = text(q.procurementType, "procurementType", { max: 8 });
    if (procurementType && !PROCUREMENT_TYPES.has(procurementType)) {
      throw bad("procurementType", "procurementType باید make یا buy باشد");
    }
    let isActiveFilter = null;
    if (q.isActive !== undefined) {
      if (!/^(true|false)$/.test(String(q.isActive))) throw bad("isActive", "isActive باید true یا false باشد");
      isActiveFilter = q.isActive === "true";
    }
    const needle = text(q.q, "q", { max: 80 });

    const [materials, parts, inventories, consumptions] = await Promise.all([
      r.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgInventoryLevel", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgMaterialConsumption", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const partById = new Map(parts.filter((p) => p.PlantId === plantId).map((p) => [p.Id, p]));
    const invByMaterialId = new Map();
    for (const inv of inventories) {
      if (inv.PlantId !== plantId) continue;
      const list = invByMaterialId.get(inv.MaterialId) ?? [];
      list.push(inv);
      invByMaterialId.set(inv.MaterialId, list);
    }
    const consumedByMaterialId = new Map();
    for (const cRow of consumptions) {
      if (cRow.PlantId !== plantId) continue;
      consumedByMaterialId.set(
        cRow.MaterialId,
        roundTo3((consumedByMaterialId.get(cRow.MaterialId) ?? 0) + storedNumber(cRow.Quantity)),
      );
    }

    const matched = [];
    for (const mat of materials) {
      if (mat.PlantId !== plantId) continue;
      const part = partById.get(mat.PartId);
      if (!part) continue;
      if (procurementType && mat.ProcurementType !== procurementType) continue;
      if (isActiveFilter !== null && Boolean(mat.IsActive) !== isActiveFilter) continue;
      if (needle) {
        const lower = needle.toLowerCase();
        const hay = `${part.PartNo ?? ""} ${part.NameFa ?? ""} ${part.NameEn ?? ""} ${mat.DefaultWarehouseCode ?? ""} ${mat.Id ?? ""}`.toLowerCase();
        if (!hay.includes(lower)) continue;
      }
      const invRows = invByMaterialId.get(mat.Id) ?? [];
      const totalOnHand = roundTo3(invRows.reduce((s, rRow) => s + storedNumber(rRow.OnHandQty), 0));
      const totalReserved = roundTo3(invRows.reduce((s, rRow) => s + storedNumber(rRow.ReservedQty), 0));
      const totalBlocked = roundTo3(invRows.reduce((s, rRow) => s + storedNumber(rRow.BlockedQty), 0));
      const totalInTransit = roundTo3(invRows.reduce((s, rRow) => s + storedNumber(rRow.InTransitQty), 0));
      const safetyStock = Math.max(
        storedNumber(mat.SafetyStockQty),
        invRows.reduce((s, rRow) => s + storedNumber(rRow.SafetyStockQty), 0),
      );
      const freeAvailable = Math.max(
        0,
        roundTo3(totalOnHand + totalInTransit - totalReserved - totalBlocked - safetyStock),
      );
      matched.push({
        ...mat,
        PartNo: part.PartNo,
        PartNameFa: part.NameFa,
        BaseUom: part.BaseUom,
        PartType: part.PartType,
        IsLotTracked: Boolean(part.IsLotTracked),
        OnHandQty: totalOnHand,
        ReservedQty: totalReserved,
        BlockedQty: totalBlocked,
        InTransitQty: totalInTransit,
        FreeAvailableQty: freeAvailable,
        TotalConsumedQty: consumedByMaterialId.get(mat.Id) ?? 0,
        InventoryLocations: invRows.map((rRow) => ({
          Id: rRow.Id,
          WarehouseCode: rRow.WarehouseCode,
          LocationCode: rRow.LocationCode ?? null,
          LotNo: rRow.LotNo ?? null,
          OnHandQty: storedNumber(rRow.OnHandQty),
          ReservedQty: storedNumber(rRow.ReservedQty),
          BlockedQty: storedNumber(rRow.BlockedQty),
          InTransitQty: storedNumber(rRow.InTransitQty),
        })),
      });
    }

    matched.sort((a, b) => String(a.PartNo ?? "").localeCompare(String(b.PartNo ?? "")) || String(a.Id).localeCompare(String(b.Id)));
    const items = matched.slice(offset, offset + limit);
    return { items, page: { limit, offset, total: matched.length } };
  }));

  app.post(`${ROOT}/mrp/calculate`, route("mfg.mrp.run", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["OrderIds", "ThroughDate", "ScheduleVersion", "PreviewOnly"]));
    const throughDate = isoDateTime(body.ThroughDate, "ThroughDate", { required: true });
    const throughMs = Date.parse(throughDate);
    const previewOnly = bool(body.PreviewOnly, "PreviewOnly", false);

    let requestedOrderIds = null;
    if (body.OrderIds !== undefined) {
      if (!Array.isArray(body.OrderIds) || body.OrderIds.length < 1 || body.OrderIds.length > 1000) {
        throw bad("OrderIds", "OrderIds باید آرایه‌ای شامل ۱ تا ۱۰۰۰ شناسه باشد");
      }
      requestedOrderIds = body.OrderIds.map((val, idx) => text(val, `OrderIds[${idx}]`, { required: true, max: 60, pattern: ID_RE }));
      if (new Set(requestedOrderIds).size !== requestedOrderIds.length) {
        throw bad("OrderIds", "شناسهٔ تکراری در OrderIds مجاز نیست");
      }
    }

    const explicitScheduleVersion = body.ScheduleVersion === undefined
      ? null
      : number(body.ScheduleVersion, "ScheduleVersion", { required: true, min: 1, integer: true });

    const executeMrp = async (db) => {
      const [
        allOrders,
        allParts,
        allBomHeaders,
        allBomItems,
        allOperations,
        allMaterials,
        allInventories,
        allLotPolicies,
        scheduleRuns,
      ] = await Promise.all([
        db.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgBomHeader", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgBomItem", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgInventoryLevel", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgLotSizingPolicy", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgScheduleRun", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
          orderBy: [{ column: "ScheduleVersion", dir: "desc" }],
        }),
      ]);

      let scheduleVersion = explicitScheduleVersion;
      if (scheduleVersion !== null) {
        const runExists = scheduleRuns.some((run) => run.PlantId === plantId && run.ScheduleVersion === scheduleVersion);
        if (!runExists) {
          const segCheck = await db.list("MfgOperationSchedule", {
            where: [
              { column: "PlantId", op: "eq", value: plantId },
              { column: "ScheduleVersion", op: "eq", value: scheduleVersion },
            ],
            limit: 1,
          });
          if (segCheck.length === 0) {
            throw new MfgApiError(404, "MFG_SCHEDULE_VERSION_NOT_FOUND", "نسخهٔ برنامه در کارخانه یافت نشد", { scheduleVersion });
          }
        }
      } else {
        scheduleVersion = scheduleRuns[0]?.ScheduleVersion ?? 1;
      }

      const scheduleSegments = await db.list("MfgOperationSchedule", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ScheduleVersion", op: "eq", value: scheduleVersion },
        ],
      });

      const orderById = new Map(allOrders.filter((o) => o.PlantId === plantId).map((o) => [o.Id, o]));
      let targetOrders = [];
      if (requestedOrderIds) {
        for (const id of requestedOrderIds) {
          const ord = orderById.get(id);
          if (!ord) throw notFound();
          if (!["released", "in-progress"].includes(ord.Status)) {
            throw businessRule("MFG_ORDER_NOT_RELEASED", `سفارش ${ord.OrderNo} آزادشده یا در حال اجرا نیست`, { orderId: id });
          }
          if (storedTimestamp(ord.DueAt) <= throughMs) {
            targetOrders.push(ord);
          }
        }
      } else {
        targetOrders = allOrders.filter(
          (ord) => ord.PlantId === plantId
            && ["released", "in-progress"].includes(ord.Status)
            && storedTimestamp(ord.DueAt) <= throughMs,
        );
      }

      const partById = new Map(allParts.filter((p) => p.PlantId === plantId).map((p) => [p.Id, p]));
      const materialByPartId = new Map(
        allMaterials
          .filter((m) => m.PlantId === plantId && m.IsActive)
          .map((m) => [m.PartId, m]),
      );
      const materialById = new Map(
        allMaterials
          .filter((m) => m.PlantId === plantId)
          .map((m) => [m.Id, m]),
      );

      const releasedBomsByPartId = new Map();
      for (const hdr of allBomHeaders) {
        if (hdr.PlantId !== plantId || hdr.Status !== "released") continue;
        const list = releasedBomsByPartId.get(hdr.PartId) ?? [];
        list.push(hdr);
        releasedBomsByPartId.set(hdr.PartId, list);
      }
      const bomItemsByHeaderId = new Map();
      for (const item of allBomItems) {
        if (item.PlantId !== plantId) continue;
        const list = bomItemsByHeaderId.get(item.BomHeaderId) ?? [];
        list.push(item);
        bomItemsByHeaderId.set(item.BomHeaderId, list);
      }
      for (const list of bomItemsByHeaderId.values()) {
        list.sort((a, b) => (a.LineNo ?? 0) - (b.LineNo ?? 0));
      }

      const operationsByOrderId = new Map();
      for (const op of allOperations) {
        if (op.PlantId !== plantId) continue;
        const list = operationsByOrderId.get(op.ProductionOrderId) ?? [];
        list.push(op);
        operationsByOrderId.set(op.ProductionOrderId, list);
      }
      for (const list of operationsByOrderId.values()) {
        list.sort((a, b) => (a.SequenceNo ?? 0) - (b.SequenceNo ?? 0));
      }

      const earliestStartByOperationId = new Map();
      for (const seg of scheduleSegments) {
        if (seg.PlantId !== plantId || seg.Status === "cancelled") continue;
        const startMs = storedTimestamp(seg.PlannedStartAt);
        if (!Number.isFinite(startMs)) continue;
        const prev = earliestStartByOperationId.get(seg.ProductionOrderOperationId);
        if (prev === undefined || startMs < prev) {
          earliestStartByOperationId.set(seg.ProductionOrderOperationId, startMs);
        }
      }

      const resolveBomForPart = (partId, preferredRevision = null) => {
        const candidates = releasedBomsByPartId.get(partId) ?? [];
        if (preferredRevision) {
          const matchedRev = candidates.find((h) => h.Revision === preferredRevision);
          if (matchedRev) return matchedRev;
        }
        const defaults = candidates.filter((h) => h.IsDefault === true);
        if (defaults.length > 0) return defaults[0];
        return candidates[0] ?? null;
      };

      const rawRequirements = [];
      for (const order of targetOrders) {
        const rootBom = resolveBomForPart(order.PartId, order.BomRevisionSnapshot);
        if (!rootBom) {
          throw businessRule("MFG_BOM_NOT_EFFECTIVE", `BOM آزادشده برای سفارش ${order.OrderNo} یافت نشد`, { orderId: order.Id });
        }
        const orderOps = operationsByOrderId.get(order.Id) ?? [];
        const stack = new Set([order.PartId]);

        const explode = (bomHeader, parentQty, depth) => {
          if (depth >= 32) throw businessRule("MFG_BOM_DEPTH_LIMIT", "عمق انفجار BOM در MRP از سقف ۳۲ سطح بیشتر است");
          const baseQty = storedNumber(bomHeader.BaseQuantity, 1);
          const lines = bomItemsByHeaderId.get(bomHeader.Id) ?? [];
          if (lines.length === 0) throw businessRule("MFG_BOM_EMPTY", `BOM ${bomHeader.Revision} هیچ ردیفی ندارد`);

          for (const line of lines) {
            const compPart = partById.get(line.ComponentPartId);
            if (!compPart || !compPart.IsActive) {
              throw businessRule("MFG_BOM_COMPONENT_UNAVAILABLE", `قطعهٔ جزء ${line.ComponentPartId} فعال نیست`);
            }
            if (stack.has(compPart.Id)) {
              throw businessRule("MFG_BOM_CYCLE", `چرخه در انفجار BOM روی قطعهٔ ${compPart.Id} تشخیص داده شد`);
            }

            const grossQty = roundTo3((parentQty / baseQty) * storedNumber(line.QuantityPer));
            const scrapAllowanceQty = roundTo3(grossQty * (storedNumber(line.ScrapPct) / 100));
            const netQty = roundTo3(grossQty + scrapAllowanceQty);

            const matchedOp = (line.OperationSequenceNo
              ? orderOps.find((op) => op.SequenceNo === line.OperationSequenceNo)
              : null) ?? orderOps[0] ?? null;
            const scheduledStartMs = matchedOp ? earliestStartByOperationId.get(matchedOp.Id) : undefined;
            const fallbackReqAt = order.RequestedStartAt ?? order.DueAt;
            const requiredAtIso = scheduledStartMs !== undefined
              ? new Date(scheduledStartMs).toISOString()
              : storedIsoTimestamp(fallbackReqAt) ?? throughDate;

            const material = materialByPartId.get(compPart.Id);
            if (material && !line.IsPhantom && compPart.PartType !== "phantom") {
              rawRequirements.push({
                PlantId: plantId,
                ProductionOrderId: order.Id,
                ProductionOrderOperationId: matchedOp?.Id ?? null,
                BomItemId: line.Id,
                MaterialId: material.Id,
                RequirementKey: `${order.Id}:${matchedOp?.Id ?? "ORD"}:${line.Id}:v${scheduleVersion}`,
                RequiredAt: requiredAtIso,
                GrossQuantity: grossQty,
                ScrapAllowanceQty: scrapAllowanceQty,
                NetQuantity: netQty,
                Uom: line.Uom || compPart.BaseUom,
                ScheduleVersion: scheduleVersion,
              });
            }

            const shouldExpandChild = line.IsPhantom === true || ["phantom", "manufactured"].includes(compPart.PartType);
            if (shouldExpandChild) {
              const childBom = resolveBomForPart(compPart.Id);
              if (childBom) {
                stack.add(compPart.Id);
                explode(childBom, netQty, depth + 1);
                stack.delete(compPart.Id);
              } else if (line.IsPhantom === true || compPart.PartType === "phantom") {
                throw businessRule("MFG_BOM_CHILD_NOT_RELEASED", `برای قطعهٔ phantom ${compPart.PartNo} نسخهٔ BOM آزادشده یافت نشد`);
              }
            }
          }
        };

        explode(rootBom, storedNumber(order.OrderQuantity), 0);
      }

      rawRequirements.sort((a, b) => Date.parse(a.RequiredAt) - Date.parse(b.RequiredAt)
        || String(a.RequirementKey).localeCompare(String(b.RequirementKey)));

      const netPoolByMaterial = new Map();
      const reservedPoolByMaterial = new Map();
      for (const mat of allMaterials) {
        if (mat.PlantId !== plantId) continue;
        const invRows = allInventories.filter((inv) => inv.PlantId === plantId && inv.MaterialId === mat.Id);
        const totalOnHand = invRows.reduce((s, r) => s + storedNumber(r.OnHandQty), 0);
        const totalReserved = invRows.reduce((s, r) => s + storedNumber(r.ReservedQty), 0);
        const totalBlocked = invRows.reduce((s, r) => s + storedNumber(r.BlockedQty), 0);
        const totalInTransit = invRows.reduce((s, r) => s + storedNumber(r.InTransitQty), 0);
        const safetyStock = Math.max(
          storedNumber(mat.SafetyStockQty),
          invRows.reduce((s, r) => s + storedNumber(r.SafetyStockQty), 0),
        );
        const freeAvailable = Math.max(0, roundTo3(totalOnHand + totalInTransit - totalReserved - totalBlocked - safetyStock));
        netPoolByMaterial.set(mat.Id, freeAvailable);
        reservedPoolByMaterial.set(mat.Id, roundTo3(totalReserved));
      }

      const calculatedRequirements = rawRequirements.map((reqRow) => {
        const currentPool = netPoolByMaterial.get(reqRow.MaterialId) ?? 0;
        const allocated = roundTo3(Math.min(reqRow.NetQuantity, currentPool));
        const shortage = roundTo3(Math.max(0, reqRow.NetQuantity - allocated));
        netPoolByMaterial.set(reqRow.MaterialId, roundTo3(currentPool - allocated));
        const status = shortage > 0 ? "shortage" : allocated > 0 ? "reserved" : "planned";
        return {
          ...reqRow,
          AvailableQuantity: allocated,
          ReservedQuantity: allocated,
          ShortageQuantity: shortage,
          Status: status,
        };
      });

      let persistedRequirements = calculatedRequirements;
      if (!previewOnly) {
        const existingReqs = await db.list("MfgMaterialRequirement", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        });
        const existingByKey = new Map(
          existingReqs
            .filter((rRow) => rRow.PlantId === plantId)
            .map((rRow) => [rRow.RequirementKey, rRow]),
        );

        persistedRequirements = [];
        for (const item of calculatedRequirements) {
          const existing = existingByKey.get(item.RequirementKey);
          if (existing && !["issued", "closed"].includes(existing.Status)) {
            const patchRes = await db.patch("MfgMaterialRequirement", existing.Id, {
              RequiredAt: item.RequiredAt,
              GrossQuantity: item.GrossQuantity,
              ScrapAllowanceQty: item.ScrapAllowanceQty,
              NetQuantity: item.NetQuantity,
              AvailableQuantity: item.AvailableQuantity,
              ReservedQuantity: item.ReservedQuantity,
              ShortageQuantity: item.ShortageQuantity,
              Status: item.Status,
              ScheduleVersion: item.ScheduleVersion,
            }, subject.id, existing.RowVersion);
            if (!patchRes.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "نیازمندی مواد هم‌زمان تغییر کرده است");
            persistedRequirements.push(await db.get("MfgMaterialRequirement", existing.Id));
          } else if (existing) {
            persistedRequirements.push(existing);
          } else {
            const created = await db.create("MfgMaterialRequirement", item, subject.id);
            persistedRequirements.push(created);
          }
        }

        // همگام‌سازی خودکار هشدارهای کمبود مواد (MfgProductionAlert) در همان تراکنش MRP
        const existingAlerts = await db.list("MfgProductionAlert", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        });
        const alertByKey = new Map(
          existingAlerts
            .filter((al) => al.PlantId === plantId)
            .map((al) => [al.AlertKey, al]),
        );
        const nowAlertIso = new Date().toISOString();
        for (const pReq of persistedRequirements) {
          const alertKey = `SH-${pReq.Id}`.slice(0, 60);
          const existingAlert = alertByKey.get(alertKey);
          const shortageVal = roundTo3(storedNumber(pReq.ShortageQuantity));
          const matObj = materialById.get(pReq.MaterialId);
          const partObj = matObj ? partById.get(matObj.PartId) : null;
          const ordObj = orderById.get(pReq.ProductionOrderId);
          if (shortageVal > 0) {
            const titleFa = `کمبود مادهٔ ${partObj?.PartNo ?? pReq.MaterialId} برای سفارش ${ordObj?.OrderNo ?? pReq.ProductionOrderId}`;
            const detailFa = `کمبود ${shortageVal} ${pReq.Uom} (نیاز خالص: ${pReq.NetQuantity} ${pReq.Uom}، تخصیص‌یافته: ${pReq.AvailableQuantity} ${pReq.Uom})`;
            if (!existingAlert) {
              await db.create("MfgProductionAlert", {
                PlantId: plantId,
                AlertKey: alertKey,
                AlertCode: "MATERIAL_SHORTAGE",
                Severity: "high",
                Status: "open",
                ProductionOrderId: pReq.ProductionOrderId,
                ProductionOrderOperationId: pReq.ProductionOrderOperationId ?? null,
                WorkCenterId: null,
                TitleFa: titleFa.slice(0, 240),
                DetailFa: detailFa.slice(0, 1200),
                FirstRaisedAt: nowAlertIso,
                LastRaisedAt: nowAlertIso,
                OccurrenceCount: 1,
                ThresholdValue: pReq.NetQuantity,
                ActualValue: shortageVal,
                SourceEventKey: pReq.RequirementKey.slice(0, 160),
              }, subject.id);
            } else if (existingAlert.Status !== "suppressed") {
              await db.patch("MfgProductionAlert", existingAlert.Id, {
                Status: existingAlert.Status === "resolved" ? "open" : existingAlert.Status,
                ResolvedAt: existingAlert.Status === "resolved" ? null : existingAlert.ResolvedAt,
                ResolvedBy: existingAlert.Status === "resolved" ? null : existingAlert.ResolvedBy,
                LastRaisedAt: nowAlertIso,
                OccurrenceCount: (Number(existingAlert.OccurrenceCount) || 1) + 1,
                ThresholdValue: pReq.NetQuantity,
                ActualValue: shortageVal,
                DetailFa: detailFa.slice(0, 1200),
              }, subject.id, existingAlert.RowVersion);
            }
          } else if (existingAlert && ["open", "acknowledged"].includes(existingAlert.Status)) {
            await db.patch("MfgProductionAlert", existingAlert.Id, {
              Status: "resolved",
              ResolvedAt: nowAlertIso,
              ResolvedBy: subject.id,
            }, subject.id, existingAlert.RowVersion);
          }
        }

        await createAuditRecord(db, req, "MFG_MRP_CALCULATED", "MfgMaterialRequirement", `mrp-v${scheduleVersion}`, "mfg.mrp.run", {
          scheduleVersion,
          throughDate,
          requirementsCount: persistedRequirements.length,
        });
      }

      const shortages = persistedRequirements.filter((row) => storedNumber(row.ShortageQuantity) > 0);
      const shortageByMaterial = new Map();
      for (const sh of shortages) {
        const group = shortageByMaterial.get(sh.MaterialId) ?? {
          MaterialId: sh.MaterialId,
          totalShortage: 0,
          earliestNeedMs: Number.POSITIVE_INFINITY,
          uom: sh.Uom,
        };
        group.totalShortage = roundTo3(group.totalShortage + storedNumber(sh.ShortageQuantity));
        const reqMs = storedTimestamp(sh.RequiredAt);
        if (Number.isFinite(reqMs) && reqMs < group.earliestNeedMs) {
          group.earliestNeedMs = reqMs;
        }
        shortageByMaterial.set(sh.MaterialId, group);
      }

      const proposals = [];
      for (const group of shortageByMaterial.values()) {
        const mat = materialById.get(group.MaterialId);
        const lotSize = Math.max(storedNumber(mat?.LotSize, 1), Number.MIN_VALUE);
        const multiple = Math.max(storedNumber(mat?.OrderMultiple, 1), Number.MIN_VALUE);
        const baseOrderQty = Math.max(group.totalShortage, lotSize);
        const suggestedQuantity = roundTo3(Math.ceil((baseOrderQty - 1e-9) / multiple) * multiple);
        const needByIso = Number.isFinite(group.earliestNeedMs)
          ? new Date(group.earliestNeedMs).toISOString()
          : throughDate;
        const leadDays = storedNumber(mat?.LeadTimeDays, 0);
        const orderByIso = new Date(Date.parse(needByIso) - leadDays * 86_400_000).toISOString();
        proposals.push({
          MaterialId: group.MaterialId,
          ProcurementType: mat?.ProcurementType ?? "buy",
          ShortageQuantity: group.totalShortage,
          SuggestedQuantity: suggestedQuantity,
          Uom: group.uom,
          NeedBy: needByIso,
          OrderBy: orderByIso,
        });
      }

      /* ── غنی‌سازی گزارش MRP ───────────────────────────────────────────────
       * سه چیزی که گزارش MRP بدون آن‌ها کامل نیست و هر سه از همان داده‌ای
       * ساخته می‌شوند که خودِ MRP مصرف کرده است (بارگذاری جداگانه ندارد):
       *   ۱۱.۵ Lead Time Offset تجمیعی — چه زمانی باید آزادسازی شود،
       *   ۱۱.۶ Pegging — این نیاز از کدام سفارش سرچشمه گرفته،
       *   ۱۱.۳ سفارش برنامه‌ریزی‌شده — پیشنهاد موتور با رعایت لات و offset. */
      const mrpBomEdges = [];
      const mrpChildPartIds = new Set();
      for (const [parentPartId, headers] of releasedBomsByPartId) {
        for (const header of headers) {
          for (const item of bomItemsByHeaderId.get(header.Id) ?? []) {
            mrpBomEdges.push({
              parentPartId,
              componentPartId: item.ComponentPartId,
              quantityPer: storedNumber(item.QuantityPer, 1),
            });
            mrpChildPartIds.add(item.ComponentPartId);
          }
        }
      }
      const mrpLeadTimeDaysByPartId = {};
      for (const material of materialByPartId.values()) {
        mrpLeadTimeDaysByPartId[material.PartId] = storedNumber(material.LeadTimeDays, 0);
      }
      const mrpRootPartIds = [...partById.keys()].filter((partId) => !mrpChildPartIds.has(partId));
      const leadTimeOffset = mrpBomEdges.length === 0
        ? { parts: [], levelOffsets: [], finishedGoodsLeadTimeDays: 0, maxLowLevelCode: 0 }
        : runPlanning(() => computeLeadTimeOffsets({
          edges: mrpBomEdges,
          leadTimeDaysByPartId: mrpLeadTimeDaysByPartId,
          rootPartIds: mrpRootPartIds,
        }));
      const lowLevelCodeByPartId = new Map(leadTimeOffset.parts.map((row) => [row.partId, row.lowLevelCode]));
      const cumulativeLeadTimeByPartId = new Map(leadTimeOffset.parts.map((row) => [row.partId, row.cumulativeLeadTimeDays]));

      /* pegging از نیازهای مواد واقعیِ همین اجرا ساخته می‌شود، نه از گراف تئوری
       * BOM: پرسش کاربر «این نیاز به کدام سفارش تعلق دارد» است. */
      const pegSupplies = [];
      const pegLinks = [];
      const seenPegSupply = new Set();
      const requirementIdsByMaterialId = new Map();
      for (const row of persistedRequirements) {
        const componentPartId = materialById.get(row.MaterialId)?.PartId;
        if (!componentPartId) continue;
        const refList = requirementIdsByMaterialId.get(row.MaterialId) ?? [];
        refList.push(row.Id);
        requirementIdsByMaterialId.set(row.MaterialId, refList);
        if (!seenPegSupply.has(row.Id)) {
          seenPegSupply.add(row.Id);
          pegSupplies.push({
            partId: componentPartId,
            supplyRef: row.Id,
            quantity: storedNumber(row.NetQuantity),
            supplyType: "requirement",
          });
        }
        const parentOrder = orderById.get(row.ProductionOrderId);
        if (!parentOrder) continue;
        if (!seenPegSupply.has(parentOrder.Id)) {
          seenPegSupply.add(parentOrder.Id);
          pegSupplies.push({
            partId: parentOrder.PartId,
            supplyRef: parentOrder.Id,
            quantity: storedNumber(parentOrder.OrderQuantity),
            supplyType: "production-order",
          });
        }
        pegLinks.push({
          parentSupplyRef: parentOrder.Id,
          componentSupplyRef: row.Id,
          quantityPer: storedNumber(row.NetQuantity) > 0 && storedNumber(parentOrder.OrderQuantity) > 0
            ? roundTo3(storedNumber(row.NetQuantity) / storedNumber(parentOrder.OrderQuantity))
            : 1,
        });
      }
      const pegging = pegSupplies.length === 0
        ? { singleLevel: {}, multiLevel: {}, rootSupplyRefs: [] }
        : runPlanning(() => buildPegging({ supplies: pegSupplies, links: pegLinks }));
      /* multiLevel با ref همهٔ supplyها کلید می‌خورد (هم جزء هم والد)؛ آنچه
       * گزارش MRP لازم دارد فقط مسیرهای خودِ نیازهای مواد است. */
      const peggedPathsByRequirementId = new Map();
      for (const row of persistedRequirements) {
        const paths = pegging.multiLevel?.[row.Id] ?? [];
        if (paths.length > 0) peggedPathsByRequirementId.set(row.Id, paths);
      }

      /* ۱۱.۳ کمبودها به «پیشنهاد» تبدیل می‌شوند، نه به تعهد: سیاست لات قطعه و
       * offset آزادسازی تجمیعی اعمال می‌شود و ردیف در وضعیت proposed می‌ماند
       * تا برنامه‌ریز بازبینی، ویرایش و سپس تأیید کند. */
      const activeLotPolicyByPartId = new Map();
      for (const policy of allLotPolicies) {
        if (policy.PlantId !== plantId || !policy.IsActive) continue;
        activeLotPolicyByPartId.set(policy.PartId, policy);
      }
      const plannedOrderDrafts = [];
      for (const group of shortageByMaterial.values()) {
        const mat = materialById.get(group.MaterialId);
        const partId = mat?.PartId;
        if (!partId || !(group.totalShortage > 0)) continue;
        const policyRow = activeLotPolicyByPartId.get(partId);
        const policy = {
          rule: policyRow && LOT_SIZING_RULES.includes(policyRow.RuleCode) ? policyRow.RuleCode : "L4L",
          fixedLotQty: policyRow?.FixedLotQty ?? null,
          orderMultiple: policyRow?.OrderMultiple ?? storedNumber(mat?.OrderMultiple, 1),
          minOrderQty: policyRow?.MinOrderQty ?? null,
          maxOrderQty: policyRow?.MaxOrderQty ?? null,
          orderingCost: policyRow?.OrderingCost ?? null,
          holdingCostPerUnitPerYear: policyRow?.HoldingCostPerUnitPerYear ?? null,
          annualDemandQty: policyRow?.AnnualDemandQty ?? null,
          periodDays: policyRow?.PeriodDays ?? null,
          periodOrderQuantity: policyRow?.PeriodOrderQuantity ?? null,
        };
        /* offset تجمیعی BOM بر زمان تحویل خودِ قطعه اولویت دارد: اگر قطعه زیر
         * مجموعه دارد، زودتر از زمان تحویل خودش باید آزاد شود. */
        const cumulativeLeadTimeDays = Math.max(
          cumulativeLeadTimeByPartId.get(partId) ?? 0,
          storedNumber(mat?.LeadTimeDays, 0),
        );
        const needByIso = Number.isFinite(group.earliestNeedMs)
          ? new Date(group.earliestNeedMs).toISOString()
          : throughDate;
        const drafts = runPlanning(() => computePlannedOrders({
          partId,
          partNo: partById.get(partId)?.PartNo ?? partId,
          uom: group.uom,
          buckets: buildTimeBuckets({ horizonStart: needByIso.slice(0, 10), bucketUnit: "week", bucketCount: 1 }),
          netRequirementByBucket: [roundTo3(group.totalShortage)],
          policy,
          cumulativeLeadTimeDays,
          lowLevelCode: lowLevelCodeByPartId.get(partId) ?? 0,
          source: "mrp",
          peggedSupplyRefs: requirementIdsByMaterialId.get(group.MaterialId) ?? [],
        }));
        for (const draft of drafts) {
          plannedOrderDrafts.push({
            ...draft,
            materialId: group.MaterialId,
            shortageQuantity: roundTo3(group.totalShortage),
            productionVersionId: null,
          });
        }
      }

      let plannedOrders = plannedOrderDrafts;
      let peggingRows = [];
      if (!previewOnly) {
        /* اجرای دوبارهٔ MRP، پیشنهادهای بازبینی‌نشدهٔ همان runNo را جایگزین
         * می‌کند تا انباشته نشوند؛ آنچه برنامه‌ریز تأیید/تبدیل کرده دست‌نخورده
         * می‌ماند چون دیگر proposed نیست. */
        const stalePlanned = await db.list("MfgPlannedOrder", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "MrpRunNo", op: "eq", value: scheduleVersion },
            { column: "Status", op: "eq", value: "proposed" },
          ],
        });
        for (const row of stalePlanned) await db.remove("MfgPlannedOrder", row.Id);

        plannedOrders = [];
        let plannedSeq = 0;
        for (const draft of plannedOrderDrafts) {
          plannedSeq += 1;
          plannedOrders.push(await db.create("MfgPlannedOrder", {
            PlantId: plantId,
            PlannedOrderNo: `MPO-${scheduleVersion}-${String(plannedSeq).padStart(4, "0")}`,
            PartId: draft.partId,
            ProductionVersionId: draft.productionVersionId,
            Source: "mrp",
            MrpRunNo: scheduleVersion,
            MpsRunId: null,
            Quantity: draft.quantity,
            OriginalQuantity: draft.quantity,
            Uom: draft.uom,
            LowLevelCode: draft.lowLevelCode,
            CumulativeLeadTimeDays: draft.cumulativeLeadTimeDays,
            PlannedReleaseAt: new Date(`${draft.releaseAt}T00:00:00.000Z`).toISOString(),
            PlannedDueAt: new Date(`${draft.dueAt}T00:00:00.000Z`).toISOString(),
            BucketIndex: draft.bucketIndex,
            LotSizingRule: draft.lotSizingRule,
            Status: "proposed",
            NoteFa: `پیشنهاد MRP اجرای ${scheduleVersion} برای کمبود ${draft.shortageQuantity}`,
          }, subject.id));
        }

        /* pegging هم ثبت می‌شود تا گزارش‌های بعدی بدون بازمحاسبه خوانده شوند.
         * کرانهٔ defensive دارد: ردیف‌ها متناسب با نیازها × طول مسیرند. */
        const stalePegging = await db.list("MfgRequirementPegging", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
          limit: 5000,
        });
        for (const row of stalePegging) await db.remove("MfgRequirementPegging", row.Id);

        const partIdBySupplyRef = new Map(pegSupplies.map((supply) => [supply.supplyRef, supply.partId]));
        const componentPartIdOf = (row) => materialById.get(row.MaterialId)?.PartId ?? null;
        for (const row of persistedRequirements) {
          /* هر ورودی multiLevel یک {chain, depth} است، نه آرایهٔ گام‌ها؛ گام‌ها
           * زیر chain هستند و زنجیره از جزء به ریشه می‌رود. */
          for (const entry of peggedPathsByRequirementId.get(row.Id) ?? []) {
            const chain = entry.chain ?? [];
            for (let step = 1; step < chain.length && peggingRows.length < 5000; step += 1) {
              const parentRef = chain[step].supplyRef;
              const parentOrder = orderById.get(parentRef) ?? null;
              const rootStep = chain[chain.length - 1];
              peggingRows.push(await db.create("MfgRequirementPegging", {
                PlantId: plantId,
                ComponentPartId: componentPartIdOf(row),
                ComponentSupplyRef: row.Id,
                ParentPartId: partIdBySupplyRef.get(parentRef) ?? null,
                ParentSupplyRef: parentRef,
                MaterialRequirementId: row.Id,
                ProductionOrderId: parentOrder?.Id ?? row.ProductionOrderId,
                PlannedOrderId: null,
                PeggedQuantity: storedNumber(row.NetQuantity),
                QuantityPer: storedNumber(chain[step].quantityPer, 1),
                LevelFromRoot: step,
                IsMultiLevel: chain.length > 2,
                RootPartId: partIdBySupplyRef.get(rootStep.supplyRef) ?? null,
                RootSupplyRef: rootStep.supplyRef,
              }, subject.id));
            }
          }
        }
      }

      return {
        calculationAt: new Date().toISOString(),
        previewOnly,
        scheduleVersion,
        requirements: persistedRequirements,
        shortages,
        proposals,
        /* ۱۱.۵/۱۱.۶/۱۱.۳ — گزارش MRP حالا این سه بخش را هم دارد. */
        leadTimeOffset,
        pegging: {
          requirementCount: persistedRequirements.length,
          singleLevel: pegging.singleLevel,
          multiLevel: pegging.multiLevel,
          rootSupplyRefs: pegging.rootSupplyRefs,
          persistedRowCount: peggingRows.length,
        },
        plannedOrders,
        summary: {
          requirementCount: persistedRequirements.length,
          shortageCount: shortages.length,
          proposalCount: proposals.length,
          plannedOrderCount: plannedOrders.length,
          peggedRequirementCount: peggedPathsByRequirementId.size,
          finishedGoodsLeadTimeDays: leadTimeOffset.finishedGoodsLeadTimeDays,
          maxLowLevelCode: leadTimeOffset.maxLowLevelCode,
        },
      };
    };

    return previewOnly ? executeMrp(r) : r.transaction((tx) => executeMrp(tx));
  }));

  app.get(`${ROOT}/mrp/shortages`, route("mfg.mrp.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["requiredBefore", "materialId", "orderId", "scheduleVersion", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit حداقل ۱ است");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const requiredBefore = isoDateTime(q.requiredBefore, "requiredBefore");
    const requiredBeforeMs = requiredBefore ? Date.parse(requiredBefore) : null;
    const materialId = text(q.materialId, "materialId", { max: 60, pattern: ID_RE });
    const orderId = text(q.orderId, "orderId", { max: 60, pattern: ID_RE });
    let scheduleVersion = null;
    if (q.scheduleVersion !== undefined && q.scheduleVersion !== "") {
      scheduleVersion = pageNumber(q.scheduleVersion, "scheduleVersion", 1, 1_000_000);
      if (scheduleVersion < 1) throw bad("scheduleVersion", "scheduleVersion باید عدد صحیح مثبت باشد");
    }

    if (materialId) {
      const mat = await r.get("MfgMaterial", materialId);
      if (!mat || mat.PlantId !== plantId) throw notFound();
    }
    if (orderId) {
      const ord = await r.get("MfgProductionOrder", orderId);
      if (!ord || ord.PlantId !== plantId) throw notFound();
    }

    const [allReqs, allMaterials, allParts, allOrders, allOperations] = await Promise.all([
      r.list("MfgMaterialRequirement", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const matById = new Map(allMaterials.filter((m) => m.PlantId === plantId).map((m) => [m.Id, m]));
    const partById = new Map(allParts.filter((p) => p.PlantId === plantId).map((p) => [p.Id, p]));
    const orderById = new Map(allOrders.filter((o) => o.PlantId === plantId).map((o) => [o.Id, o]));
    const opById = new Map(allOperations.filter((op) => op.PlantId === plantId).map((op) => [op.Id, op]));

    const matched = allReqs
      .filter((row) => {
        if (row.PlantId !== plantId) return false;
        if (row.Status !== "shortage" || storedNumber(row.ShortageQuantity) <= 0) return false;
        if (materialId && row.MaterialId !== materialId) return false;
        if (orderId && row.ProductionOrderId !== orderId) return false;
        if (scheduleVersion !== null && row.ScheduleVersion !== scheduleVersion) return false;
        if (requiredBeforeMs !== null) {
          const reqMs = storedTimestamp(row.RequiredAt);
          if (!Number.isFinite(reqMs) || reqMs > requiredBeforeMs) return false;
        }
        return true;
      })
      .map((row) => {
        const mat = matById.get(row.MaterialId);
        const part = mat ? partById.get(mat.PartId) : null;
        const ord = orderById.get(row.ProductionOrderId);
        const op = row.ProductionOrderOperationId ? opById.get(row.ProductionOrderOperationId) : null;
        return {
          ...row,
          PartId: mat?.PartId ?? null,
          PartNo: part?.PartNo ?? null,
          PartNameFa: part?.NameFa ?? null,
          OrderNo: ord?.OrderNo ?? null,
          OperationCode: op?.OperationCode ?? null,
          ProcurementType: mat?.ProcurementType ?? null,
          LeadTimeDays: mat?.LeadTimeDays ?? null,
          LotSize: mat?.LotSize ?? null,
          OrderMultiple: mat?.OrderMultiple ?? null,
          StandardUnitCost: mat?.StandardUnitCost ?? part?.StandardUnitCost ?? null,
          Currency: mat?.Currency ?? part?.Currency ?? "IRR",
        };
      });

    matched.sort((a, b) => storedTimestamp(a.RequiredAt) - storedTimestamp(b.RequiredAt)
      || String(a.Id).localeCompare(String(b.Id)));
    const items = matched.slice(offset, offset + limit);
    return { items, page: { limit, offset, total: matched.length } };
  }));

  app.post(`${ROOT}/material-consumptions`, route("mfg.material.consume", async ({ repo: r, req, plantId, subject }) => {
    const idempotencyKey = idempotencyKeyFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([
      "OperationId",
      "ProductionOrderOperationId",
      "RequirementId",
      "ExecutionId",
      "MaterialId",
      "Quantity",
      "Uom",
      "LotNo",
      "WarehouseCode",
      "LocationCode",
      "UnitCost",
      "Currency",
      "ConsumptionMethod",
    ]));

    const rawOpId = body.OperationId !== undefined ? body.OperationId : body.ProductionOrderOperationId;
    const operationId = text(rawOpId, "OperationId", { required: true, max: 60, pattern: ID_RE });
    if (
      body.OperationId !== undefined
      && body.ProductionOrderOperationId !== undefined
      && body.OperationId !== body.ProductionOrderOperationId
    ) {
      throw bad("OperationId", "OperationId و ProductionOrderOperationId نباید متعارض باشند");
    }
    const requirementId = text(body.RequirementId, "RequirementId", { max: 60, pattern: ID_RE });
    const executionId = text(body.ExecutionId, "ExecutionId", { max: 60, pattern: ID_RE });
    const materialId = text(body.MaterialId, "MaterialId", { required: true, max: 60, pattern: ID_RE });
    const quantity = number(body.Quantity, "Quantity", { required: true, min: Number.MIN_VALUE, max: 999_999_999 });
    const uom = text(body.Uom, "Uom", { required: true, max: 16 });
    const lotNo = text(body.LotNo, "LotNo", { max: 60 });
    const warehouseCode = text(body.WarehouseCode, "WarehouseCode", { max: 40 });
    const locationCode = text(body.LocationCode, "LocationCode", { max: 40 });
    const unitCost = number(body.UnitCost, "UnitCost", { required: true, min: 0, max: 999_999_999_999 });
    const currency = text(body.Currency, "Currency", { max: 8, pattern: CURRENCY_RE }) ?? "IRR";
    const consumptionMethod = text(body.ConsumptionMethod, "ConsumptionMethod", { required: true, max: 12 });
    if (!CONSUMPTION_METHODS.has(consumptionMethod)) {
      throw bad("ConsumptionMethod", "ConsumptionMethod باید manual، backflush یا issue باشد");
    }

    return r.transaction(async (tx) => {
      const existingByKey = await tx.list("MfgMaterialConsumption", {
        where: [{ column: "IdempotencyKey", op: "eq", value: idempotencyKey }],
        limit: 1,
      });
      if (existingByKey.length > 0) {
        const existing = existingByKey[0];
        if (
          existing.PlantId !== plantId
          || existing.ProductionOrderOperationId !== operationId
          || existing.MaterialId !== materialId
          || Math.abs(storedNumber(existing.Quantity) - quantity) > 1e-6
        ) {
          throw conflict("MFG_IDEMPOTENCY_CONFLICT", "کلید Idempotency-Key قبلاً برای درخواست دیگری مصرف شده است");
        }
        const currentReq = existing.RequirementId ? await tx.get("MfgMaterialRequirement", existing.RequirementId) : null;
        return {
          ...existing,
          consumption: existing,
          requirement: currentReq,
        };
      }

      const [execKeyCheck, auditRows] = await Promise.all([
        tx.list("MfgOperationExecution", {
          where: [{ column: "IdempotencyKey", op: "eq", value: idempotencyKey }],
          limit: 1,
        }),
        tx.list("AuditLog", {}),
      ]);
      if (
        execKeyCheck.length > 0
        || auditRows.some((row) => row?.Details?.idempotencyKey === idempotencyKey && row.Action !== "MFG_MATERIAL_CONSUMED")
      ) {
        throw conflict("MFG_IDEMPOTENCY_CONFLICT", "کلید Idempotency-Key قبلاً برای درخواست دیگری مصرف شده است");
      }

      const operation = await tx.get("MfgProductionOrderOperation", operationId);
      if (!operation || operation.PlantId !== plantId) throw notFound();
      const order = await tx.get("MfgProductionOrder", operation.ProductionOrderId);
      if (!order || order.PlantId !== plantId) throw notFound();
      if (!["released", "in-progress"].includes(order.Status)) {
        throw businessRule("MFG_ORDER_NOT_RELEASED", "ثبت مصرف مواد فقط روی سفارش آزادشده یا در حال اجرا مجاز است");
      }

      const material = await tx.get("MfgMaterial", materialId);
      if (!material || material.PlantId !== plantId) throw notFound();
      if (!material.IsActive) {
        throw businessRule("MFG_MATERIAL_INACTIVE", "مادهٔ انتخابی غیرفعال است");
      }
      const part = await tx.get("MfgPart", material.PartId);
      if (!part || part.PlantId !== plantId) throw notFound();
      if (part.BaseUom && part.BaseUom !== uom) {
        throw businessRule("MFG_UOM_MISMATCH", `واحد سنجش مصرف (${uom}) با واحد پایهٔ ماده (${part.BaseUom}) سازگار نیست`);
      }
      if (part.IsLotTracked === true && !lotNo) {
        throw businessRule("MFG_LOT_REQUIRED", "این ماده دارای رهگیری بچ/لات است و ارسال LotNo الزامی است");
      }

      if (executionId) {
        const execution = await tx.get("MfgOperationExecution", executionId);
        if (!execution || execution.PlantId !== plantId) throw notFound();
        if (execution.ProductionOrderOperationId !== operationId) {
          throw businessRule("MFG_CONSUMPTION_EXECUTION_MISMATCH", "نشست اجرا متعلق به عملیات اعلام‌شده نیست");
        }
      }

      let requirement = null;
      if (requirementId) {
        requirement = await tx.get("MfgMaterialRequirement", requirementId);
        if (!requirement || requirement.PlantId !== plantId) throw notFound();
        if (
          requirement.MaterialId !== materialId
          || requirement.ProductionOrderId !== operation.ProductionOrderId
          || (requirement.ProductionOrderOperationId && requirement.ProductionOrderOperationId !== operationId)
        ) {
          throw businessRule("MFG_REQUIREMENT_MISMATCH", "نیازمندی انتخابی با عملیات یا مادهٔ مصرفی هم‌خوانی ندارد");
        }
        if (["cancelled", "closed"].includes(requirement.Status)) {
          throw businessRule("MFG_REQUIREMENT_NOT_CONSUMABLE", "این نیازمندی بسته یا لغو شده و قابل مصرف نیست");
        }
      }

      const invRows = await tx.list("MfgInventoryLevel", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "MaterialId", op: "eq", value: materialId },
        ],
      });
      const candidateInv = invRows.filter((row) => {
        if (row.PlantId !== plantId || row.MaterialId !== materialId) return false;
        if (lotNo && row.LotNo && row.LotNo !== lotNo) return false;
        if (warehouseCode && row.WarehouseCode !== warehouseCode) return false;
        if (locationCode && row.LocationCode !== locationCode) return false;
        return true;
      });

      const totalConsumable = candidateInv.reduce(
        (sum, row) => sum + Math.max(0, storedNumber(row.OnHandQty) - storedNumber(row.BlockedQty)),
        0,
      );
      if (roundTo3(totalConsumable) + 1e-6 < quantity) {
        throw businessRule("MFG_INSUFFICIENT_INVENTORY", "موجودی قابل مصرف در انبار برای ثبت این مصرف کافی نیست", {
          requestedQuantity: quantity,
          availableToConsume: roundTo3(totalConsumable),
        });
      }

      let remainingToDeduct = quantity;
      const updatedInventory = [];
      for (const inv of candidateInv) {
        if (remainingToDeduct <= 1e-6) break;
        const onHand = storedNumber(inv.OnHandQty);
        const blocked = storedNumber(inv.BlockedQty);
        const reserved = storedNumber(inv.ReservedQty);
        const canTake = Math.max(0, roundTo3(onHand - blocked));
        if (canTake <= 0) continue;
        const deduct = roundTo3(Math.min(remainingToDeduct, canTake));
        const nextOnHand = roundTo3(onHand - deduct);
        const maxAllowedReserved = Math.max(0, roundTo3(nextOnHand - blocked));
        const nextReserved = Math.min(reserved, maxAllowedReserved, Math.max(0, roundTo3(reserved - deduct)));

        const invPatch = await tx.patch("MfgInventoryLevel", inv.Id, {
          OnHandQty: nextOnHand,
          ReservedQty: nextReserved,
          AsOfAt: new Date().toISOString(),
        }, subject.id, inv.RowVersion);
        if (!invPatch.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "موجودی انبار هم‌زمان تغییر کرده است؛ دوباره تلاش کنید");
        updatedInventory.push(await tx.get("MfgInventoryLevel", inv.Id));
        remainingToDeduct = roundTo3(remainingToDeduct - deduct);
      }

      let updatedRequirement = null;
      if (requirement) {
        const nextReservedReq = Math.max(0, roundTo3(storedNumber(requirement.ReservedQuantity) - quantity));
        const nextShortageReq = Math.max(0, roundTo3(storedNumber(requirement.ShortageQuantity) - quantity));
        const nextStatus = nextReservedReq <= 0 && nextShortageReq <= 0 ? "issued" : requirement.Status;
        const reqPatch = await tx.patch("MfgMaterialRequirement", requirement.Id, {
          ReservedQuantity: nextReservedReq,
          ShortageQuantity: nextShortageReq,
          Status: nextStatus,
        }, subject.id, requirement.RowVersion);
        if (!reqPatch.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "نیازمندی مواد هم‌زمان تغییر کرده است");
        updatedRequirement = await tx.get("MfgMaterialRequirement", requirement.Id);
      }

      const created = await tx.create("MfgMaterialConsumption", {
        PlantId: plantId,
        ProductionOrderOperationId: operationId,
        RequirementId: requirementId,
        ExecutionId: executionId,
        MaterialId: materialId,
        Quantity: quantity,
        Uom: uom,
        LotNo: lotNo,
        UnitCost: unitCost,
        Currency: currency,
        ConsumptionMethod: consumptionMethod,
        ConsumedAt: new Date().toISOString(),
        IdempotencyKey: idempotencyKey,
        PostedBy: subject.id,
      }, subject.id);

      await createAuditRecord(tx, req, "MFG_MATERIAL_CONSUMED", "MfgMaterialConsumption", created.Id, "mfg.material.consume", {
        idempotencyKey,
        operationId,
        materialId,
        quantity,
      });

      return {
        ...created,
        consumption: created,
        inventoryUpdated: updatedInventory,
        requirement: updatedRequirement,
      };
    });
  }, 201));

  app.post(`${ROOT}/material-procurement-proposals`, route("mfg.requisition.create", async ({ repo: r, req, plantId }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["ThroughDate", "RequirementIds", "NoteFa"]));
    const throughDate = isoDateTime(body.ThroughDate, "ThroughDate", { required: true });
    const throughMs = Date.parse(throughDate);

    if (!Array.isArray(body.RequirementIds) || body.RequirementIds.length < 1 || body.RequirementIds.length > 1000) {
      throw bad("RequirementIds", "RequirementIds باید آرایه‌ای شامل ۱ تا ۱۰۰۰ شناسه باشد");
    }
    const rawIds = body.RequirementIds.map((val, idx) => text(val, `RequirementIds[${idx}]`, { required: true, max: 60, pattern: ID_RE }));
    const uniqueRequirementIds = [...new Set(rawIds)];
    const noteFa = text(body.NoteFa, "NoteFa", { max: 800 });

    const [allRequirements, allMaterials, allParts] = await Promise.all([
      r.list("MfgMaterialRequirement", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);

    const reqById = new Map(allRequirements.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));
    const matById = new Map(allMaterials.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));
    const partById = new Map(allParts.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));

    const groupedByMaterial = new Map();
    for (const reqId of uniqueRequirementIds) {
      const reqRow = reqById.get(reqId);
      if (!reqRow) throw notFound();
      const shortageQty = storedNumber(reqRow.ShortageQuantity);
      if (reqRow.Status !== "shortage" || shortageQty <= 0) {
        throw businessRule("MFG_REQUIREMENT_NOT_SHORTAGE", `نیازمندی ${reqId} در وضعیت کمبود باز (shortage) نیست`, { requirementId: reqId });
      }
      const reqAtMs = storedTimestamp(reqRow.RequiredAt);
      if (Number.isFinite(reqAtMs) && reqAtMs > throughMs) {
        throw businessRule("MFG_REQUIREMENT_AFTER_HORIZON", `تاریخ نیاز ${reqId} پس از افق ThroughDate است`, { requirementId: reqId });
      }

      const group = groupedByMaterial.get(reqRow.MaterialId) ?? {
        materialId: reqRow.MaterialId,
        shortageQuantity: 0,
        earliestNeedMs: Number.POSITIVE_INFINITY,
        uom: reqRow.Uom,
        requirementIds: [],
      };
      group.shortageQuantity = roundTo3(group.shortageQuantity + shortageQty);
      if (Number.isFinite(reqAtMs) && reqAtMs < group.earliestNeedMs) {
        group.earliestNeedMs = reqAtMs;
      }
      group.requirementIds.push(reqId);
      groupedByMaterial.set(reqRow.MaterialId, group);
    }

    const proposals = [];
    let index = 1;
    for (const group of groupedByMaterial.values()) {
      const mat = matById.get(group.materialId);
      if (!mat) throw notFound();
      const part = partById.get(mat.PartId);
      const lotSize = Math.max(storedNumber(mat.LotSize, 1), Number.MIN_VALUE);
      const multiple = Math.max(storedNumber(mat.OrderMultiple, 1), Number.MIN_VALUE);
      const baseQty = Math.max(group.shortageQuantity, lotSize);
      const suggestedQuantity = roundTo3(Math.ceil((baseQty - 1e-9) / multiple) * multiple);
      const needByIso = Number.isFinite(group.earliestNeedMs) ? new Date(group.earliestNeedMs).toISOString() : throughDate;
      const leadDays = storedNumber(mat.LeadTimeDays, 0);
      const orderByIso = new Date(Date.parse(needByIso) - leadDays * 86_400_000).toISOString();
      const unitCost = mat.StandardUnitCost !== null && mat.StandardUnitCost !== undefined
        ? storedNumber(mat.StandardUnitCost)
        : part?.StandardUnitCost !== null && part?.StandardUnitCost !== undefined
          ? storedNumber(part.StandardUnitCost)
          : null;

      proposals.push({
        ProposalNo: `PRP-${String(index++).padStart(4, "0")}`,
        MaterialId: mat.Id,
        PartId: mat.PartId,
        PartNo: part?.PartNo ?? null,
        ProcurementType: mat.ProcurementType,
        ShortageQuantity: group.shortageQuantity,
        SuggestedQuantity: suggestedQuantity,
        Uom: group.uom,
        NeedBy: needByIso,
        OrderBy: orderByIso,
        EstimatedUnitCost: unitCost,
        EstimatedTotalCost: unitCost !== null ? roundTo3(unitCost * suggestedQuantity) : null,
        Currency: mat.Currency ?? "IRR",
        RequirementIds: group.requirementIds,
        NoteFa: noteFa,
        Status: "proposed",
        PurchaseOrderIssued: false,
      });
    }

    await writeAudit(r, req, "MFG_PROCUREMENT_PROPOSAL_CREATED", "MfgMaterialRequirement", proposals[0]?.ProposalNo ?? "PRP-0000", "mfg.requisition.create");
    return {
      throughDate,
      proposalsCount: proposals.length,
      purchaseOrderIssued: false,
      proposals,
    };
  }, 201));

  app.get(`${ROOT}/cost/orders/:orderId`, route("mfg.cost.view", async ({ repo: r, req, plantId }) => {
    const orderId = text(req.params.orderId, "orderId", { required: true, max: 60, pattern: ID_RE });
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["costVersion"]));
    let requestedVersion = null;
    if (q.costVersion !== undefined && q.costVersion !== "") {
      requestedVersion = pageNumber(q.costVersion, "costVersion", 1, 1_000_000);
      if (requestedVersion < 1) throw bad("costVersion", "costVersion باید عدد صحیح مثبت باشد");
    }

    const order = await r.get("MfgProductionOrder", orderId);
    if (!order || order.PlantId !== plantId) throw notFound();
    const [orderCostRows, operations, allOperationCostRows] = await Promise.all([
      r.list("MfgOrderCost", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderId", op: "eq", value: orderId },
        ],
        orderBy: [{ column: "CostVersion", dir: "desc" }],
      }),
      r.list("MfgProductionOrderOperation", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderId", op: "eq", value: orderId },
        ],
      }),
      r.list("MfgOperationCost", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);

    const validOrderCosts = orderCostRows.filter((row) => row.PlantId === plantId && row.ProductionOrderId === orderId);
    const orderOps = operations.filter((row) => row.PlantId === plantId && row.ProductionOrderId === orderId);
    const operationIds = new Set(orderOps.map((row) => row.Id));
    const orderOperationCosts = allOperationCostRows.filter((row) =>
      row.PlantId === plantId && operationIds.has(row.ProductionOrderOperationId));
    const maxStoredVersion = Math.max(
      0,
      ...validOrderCosts.map((row) => Number(row.CostVersion) || 0),
      ...orderOperationCosts.map((row) => Number(row.CostVersion) || 0),
    );
    const targetVersion = requestedVersion ?? (maxStoredVersion > 0 ? maxStoredVersion : 1);
    const matchedSummary = validOrderCosts.find((row) => Number(row.CostVersion) === targetVersion) ?? null;
    const storedRowsForVersion = orderOperationCosts.filter((row) => Number(row.CostVersion) === targetVersion);
    if (requestedVersion !== null && !matchedSummary && storedRowsForVersion.length === 0) throw notFound();

    const derivedRows = await deriveOperationCostRows(r, {
      plantId,
      operations: orderOps,
      costVersion: targetVersion,
    });
    const completeCosts = completeOperationCostRows(orderOps, storedRowsForVersion, derivedRows);
    const totals = summarizeCostRows(completeCosts.rows);
    const operationBreakdown = operationCostBreakdown(orderOps, completeCosts.rows);

    if (matchedSummary) {
      const standardMaterialCost = roundTo3(storedNumber(matchedSummary.StandardMaterialCost));
      const plannedMaterialCost = roundTo3(storedNumber(matchedSummary.PlannedMaterialCost, standardMaterialCost));
      const actualMaterialCost = roundTo3(storedNumber(matchedSummary.ActualMaterialCost));
      const standardMachineCost = roundTo3(storedNumber(matchedSummary.StandardMachineCost));
      const plannedMachineCost = roundTo3(storedNumber(matchedSummary.PlannedMachineCost, standardMachineCost));
      const actualMachineCost = roundTo3(storedNumber(matchedSummary.ActualMachineCost));
      const standardLaborCost = roundTo3(storedNumber(matchedSummary.StandardLaborCost));
      const plannedLaborCost = roundTo3(storedNumber(matchedSummary.PlannedLaborCost, standardLaborCost));
      const actualLaborCost = roundTo3(storedNumber(matchedSummary.ActualLaborCost));
      const standardOverheadCost = roundTo3(storedNumber(matchedSummary.StandardOverheadCost));
      const plannedOverheadCost = roundTo3(storedNumber(matchedSummary.PlannedOverheadCost, standardOverheadCost));
      const actualOverheadCost = roundTo3(storedNumber(matchedSummary.ActualOverheadCost));
      const standardScrapCost = roundTo3(storedNumber(matchedSummary.StandardScrapCost));
      const plannedScrapCost = roundTo3(storedNumber(matchedSummary.PlannedScrapCost, standardScrapCost));
      const actualScrapCost = roundTo3(storedNumber(matchedSummary.ActualScrapCost));
      const standardTotalCost = roundTo3(storedNumber(matchedSummary.StandardTotalCost));
      const plannedTotalCost = roundTo3(storedNumber(matchedSummary.PlannedTotalCost, standardTotalCost));
      const actualTotalCost = roundTo3(storedNumber(matchedSummary.ActualTotalCost));
      const contractRevenue = matchedSummary.ContractRevenue === null || matchedSummary.ContractRevenue === undefined
        ? null
        : roundTo3(storedNumber(matchedSummary.ContractRevenue));
      const grossMargin = matchedSummary.GrossMargin === null || matchedSummary.GrossMargin === undefined
        ? (contractRevenue === null ? null : roundTo3(contractRevenue - actualTotalCost))
        : roundTo3(storedNumber(matchedSummary.GrossMargin));
      const byElement = {
        material: { standard: standardMaterialCost, planned: plannedMaterialCost, actual: actualMaterialCost },
        machine: { standard: standardMachineCost, planned: plannedMachineCost, actual: actualMachineCost },
        labor: { standard: standardLaborCost, planned: plannedLaborCost, actual: actualLaborCost },
        overhead: { standard: standardOverheadCost, planned: plannedOverheadCost, actual: actualOverheadCost },
        scrap: { standard: standardScrapCost, planned: plannedScrapCost, actual: actualScrapCost },
      };
      for (const element of Object.values(byElement)) {
        element.costVariance = costVariance(element.actual, element.standard);
        element.costVariancePct = costVariancePct(element.actual, element.standard);
        element.plannedCostVariance = costVariance(element.actual, element.planned);
        element.plannedCostVariancePct = costVariancePct(element.actual, element.planned);
      }
      return {
        ...matchedSummary,
        ProductionOrderId: orderId,
        CostVersion: targetVersion,
        Currency: matchedSummary.Currency ?? totals.currency,
        StandardMaterialCost: standardMaterialCost,
        PlannedMaterialCost: plannedMaterialCost,
        ActualMaterialCost: actualMaterialCost,
        StandardMachineCost: standardMachineCost,
        PlannedMachineCost: plannedMachineCost,
        ActualMachineCost: actualMachineCost,
        StandardLaborCost: standardLaborCost,
        PlannedLaborCost: plannedLaborCost,
        ActualLaborCost: actualLaborCost,
        StandardOverheadCost: standardOverheadCost,
        PlannedOverheadCost: plannedOverheadCost,
        ActualOverheadCost: actualOverheadCost,
        StandardScrapCost: standardScrapCost,
        PlannedScrapCost: plannedScrapCost,
        ActualScrapCost: actualScrapCost,
        StandardTotalCost: standardTotalCost,
        PlannedTotalCost: plannedTotalCost,
        ActualTotalCost: actualTotalCost,
        Variance: costVariance(actualTotalCost, standardTotalCost),
        CostVariance: costVariance(actualTotalCost, standardTotalCost),
        CostVariancePct: costVariancePct(actualTotalCost, standardTotalCost),
        PlannedCostVariance: costVariance(actualTotalCost, plannedTotalCost),
        PlannedCostVariancePct: costVariancePct(actualTotalCost, plannedTotalCost),
        ContractRevenue: contractRevenue,
        GrossMargin: grossMargin,
        ByElement: byElement,
        OperationBreakdown: operationBreakdown,
        Reconciled: Boolean(matchedSummary.Reconciled),
        ReconciledAt: matchedSummary.ReconciledAt ?? null,
        ReconcileThrough: matchedSummary.ReconcileThrough ?? null,
      };
    }

    return {
      PlantId: plantId,
      ProductionOrderId: orderId,
      CostVersion: targetVersion,
      Currency: totals.currency,
      StandardMaterialCost: totals.byElement.material.standard,
      PlannedMaterialCost: totals.byElement.material.planned,
      ActualMaterialCost: totals.byElement.material.actual,
      StandardMachineCost: totals.byElement.machine.standard,
      PlannedMachineCost: totals.byElement.machine.planned,
      ActualMachineCost: totals.byElement.machine.actual,
      StandardLaborCost: totals.byElement.labor.standard,
      PlannedLaborCost: totals.byElement.labor.planned,
      ActualLaborCost: totals.byElement.labor.actual,
      StandardOverheadCost: totals.byElement.overhead.standard,
      PlannedOverheadCost: totals.byElement.overhead.planned,
      ActualOverheadCost: totals.byElement.overhead.actual,
      StandardScrapCost: totals.byElement.scrap.standard,
      PlannedScrapCost: totals.byElement.scrap.planned,
      ActualScrapCost: totals.byElement.scrap.actual,
      StandardTotalCost: totals.standardTotalCost,
      PlannedTotalCost: totals.plannedTotalCost,
      ActualTotalCost: totals.actualTotalCost,
      Variance: totals.costVariance,
      CostVariance: totals.costVariance,
      CostVariancePct: totals.costVariancePct,
      PlannedCostVariance: totals.plannedCostVariance,
      PlannedCostVariancePct: totals.plannedCostVariancePct,
      ContractRevenue: null,
      GrossMargin: null,
      ByElement: totals.byElement,
      OperationBreakdown: operationBreakdown,
      Reconciled: false,
      ReconciledAt: null,
      ReconcileThrough: null,
      Derived: completeCosts.derived,
    };
  }));

  app.get(`${ROOT}/cost/operations/:operationId`, route("mfg.cost.view", async ({ repo: r, req, plantId }) => {
    const operationId = text(req.params.operationId, "operationId", { required: true, max: 60, pattern: ID_RE });
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["costVersion"]));
    let requestedVersion = null;
    if (q.costVersion !== undefined && q.costVersion !== "") {
      requestedVersion = pageNumber(q.costVersion, "costVersion", 1, 1_000_000);
      if (requestedVersion < 1) throw bad("costVersion", "costVersion باید عدد صحیح مثبت باشد");
    }
    const operation = await r.get("MfgProductionOrderOperation", operationId);
    if (!operation || operation.PlantId !== plantId) throw notFound();
    const allRows = await r.list("MfgOperationCost", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "ProductionOrderOperationId", op: "eq", value: operationId },
      ],
    });
    const storedRows = allRows.filter((row) => row.PlantId === plantId
      && row.ProductionOrderOperationId === operationId
      && (requestedVersion === null || Number(row.CostVersion) === requestedVersion));
    let targetVersion = requestedVersion;
    if (targetVersion === null) {
      targetVersion = storedRows.reduce((max, row) => Math.max(max, Number(row.CostVersion) || 0), 0) || 1;
    }
    const versionRows = storedRows.filter((row) => Number(row.CostVersion) === targetVersion);
    const derivedRows = await deriveOperationCostRows(r, { plantId, operations: [operation], costVersion: targetVersion });
    const completeCosts = completeOperationCostRows([operation], versionRows, derivedRows);
    return { items: completeCosts.rows, derived: completeCosts.derived };
  }));

  app.post(`${ROOT}/cost/orders/:orderId/reconcile`, route("mfg.cost.reconcile", async ({ repo: r, req, plantId, subject }) => {
    const orderId = text(req.params.orderId, "orderId", { required: true, max: 60, pattern: ID_RE });
    const idempotencyKey = idempotencyKeyFrom(req);
    const expectedVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["CostVersion", "ReconcileThrough", "ContractRevenue", "ModelVersion"]));
    const costVersion = number(body.CostVersion, "CostVersion", { required: true, min: 1, max: 1_000_000, integer: true });
    const reconcileThrough = isoDateTime(body.ReconcileThrough, "ReconcileThrough", { required: true });
    const contractRevenueInput = number(body.ContractRevenue, "ContractRevenue", { min: 0, max: 999_999_999_999 });
    const modelVersion = text(body.ModelVersion, "ModelVersion", { max: 40 }) ?? "mfg-cost-v2";
    const fingerprint = JSON.stringify({
      orderId,
      costVersion,
      reconcileThrough,
      contractRevenue: contractRevenueInput,
      modelVersion,
    });

    return r.transaction(async (tx) => {
      const replayed = await resolveIdempotentAuditReplay(tx, {
        idempotencyKey,
        plantId,
        action: "MFG_ORDER_COST_RECONCILED",
        entityName: "MfgOrderCost",
        fingerprint,
      });
      if (replayed) return replayed;

      const order = await tx.get("MfgProductionOrder", orderId);
      if (!order || order.PlantId !== plantId) throw notFound();
      if (order.RowVersion !== expectedVersion) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "RowVersion سفارش از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }

      const [operations, executions, requirements, existingCostRows, allOperationCosts] = await Promise.all([
        tx.list("MfgProductionOrderOperation", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "ProductionOrderId", op: "eq", value: orderId },
          ],
        }),
        tx.list("MfgOperationExecution", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        tx.list("MfgMaterialRequirement", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "ProductionOrderId", op: "eq", value: orderId },
          ],
        }),
        tx.list("MfgOrderCost", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "ProductionOrderId", op: "eq", value: orderId },
          ],
        }),
        tx.list("MfgOperationCost", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      ]);
      const orderOps = operations.filter((row) => row.PlantId === plantId && row.ProductionOrderId === orderId);
      if (orderOps.length === 0 || orderOps.some((row) => row.Status !== "completed")) {
        throw businessRule("MFG_OPERATIONS_NOT_COMPLETED", "پیش از تطبیق هزینهٔ سفارش، تمام عملیات‌های سفارش باید تکمیل شده باشند");
      }
      const operationIds = new Set(orderOps.map((row) => row.Id));
      if (executions.some((row) => row.PlantId === plantId && operationIds.has(row.ProductionOrderOperationId) && row.Status === "running")) {
        throw businessRule("MFG_OPERATIONS_NOT_COMPLETED", "نشست اجرای باز روی عملیات سفارش وجود دارد");
      }
      const openShortages = requirements.filter((row) => row.PlantId === plantId
        && row.ProductionOrderId === orderId
        && (row.Status === "shortage" || storedNumber(row.ShortageQuantity) > 0));
      if (openShortages.length > 0) {
        throw businessRule("MFG_MATERIALS_NOT_RECONCILED", "پیش از تطبیق نهایی هزینه، کمبودهای مواد سفارش باید تعیین‌تکلیف شوند");
      }

      const existingOrderCost = existingCostRows.find((row) => row.PlantId === plantId
        && row.ProductionOrderId === orderId
        && Number(row.CostVersion) === costVersion) ?? null;
      const storedRows = allOperationCosts.filter((row) => row.PlantId === plantId
        && operationIds.has(row.ProductionOrderOperationId)
        && Number(row.CostVersion) === costVersion);
      const derivedRows = await deriveOperationCostRows(tx, {
        plantId,
        operations: orderOps,
        costVersion,
        asOf: reconcileThrough,
      });
      const completeCosts = completeOperationCostRows(orderOps, storedRows, derivedRows);
      const rowsByKey = new Map(storedRows.map((row) => [`${row.ProductionOrderOperationId}\\u0000${row.CostElement}`, row]));
      const derivedByKey = new Map(derivedRows.map((row) => [`${row.ProductionOrderOperationId}\\u0000${row.CostElement}`, row]));
      const operationCostsForVersion = [];
      for (const operation of orderOps) {
        for (const element of COST_ELEMENTS) {
          const key = `${operation.Id}\\u0000${element}`;
          const stored = rowsByKey.get(key);
          if (stored) operationCostsForVersion.push(stored);
          else {
            const derived = derivedByKey.get(key);
            if (!derived) continue;
            operationCostsForVersion.push(await tx.create("MfgOperationCost", derived, subject.id));
          }
        }
      }
      const totals = summarizeCostRows(completeCosts.rows);
      if (operationCostsForVersion.length === 0) {
        throw businessRule("MFG_COST_VERSION_NOT_FOUND", `هیچ ردیف هزینه‌ای برای نسخهٔ ${costVersion} یافت نشد`);
      }

      if (existingOrderCost) {
        const storedStandard = roundTo3(storedNumber(existingOrderCost.StandardTotalCost));
        const storedActual = roundTo3(storedNumber(existingOrderCost.ActualTotalCost));
        if (Math.abs(storedStandard - totals.standardTotalCost) > 0.01 || Math.abs(storedActual - totals.actualTotalCost) > 0.01) {
          throw businessRule("MFG_COST_TOTAL_MISMATCH", "جمع اجزای هزینه با مبلغ کل نسخهٔ تطبیق‌شده برابر نیست؛ برای محاسبهٔ تازه نسخهٔ هزینهٔ جدید بسازید");
        }
      }

      const effectiveRevenue = contractRevenueInput !== null
        ? contractRevenueInput
        : existingOrderCost?.ContractRevenue !== null && existingOrderCost?.ContractRevenue !== undefined
          ? roundTo3(storedNumber(existingOrderCost.ContractRevenue))
          : null;
      const grossMargin = effectiveRevenue === null ? null : roundTo3(effectiveRevenue - totals.actualTotalCost);
      const reconciledAt = new Date().toISOString();
      const summary = {
        StandardMaterialCost: totals.byElement.material.standard,
        PlannedMaterialCost: totals.byElement.material.planned,
        ActualMaterialCost: totals.byElement.material.actual,
        StandardMachineCost: totals.byElement.machine.standard,
        PlannedMachineCost: totals.byElement.machine.planned,
        ActualMachineCost: totals.byElement.machine.actual,
        StandardLaborCost: totals.byElement.labor.standard,
        PlannedLaborCost: totals.byElement.labor.planned,
        ActualLaborCost: totals.byElement.labor.actual,
        StandardOverheadCost: totals.byElement.overhead.standard,
        PlannedOverheadCost: totals.byElement.overhead.planned,
        ActualOverheadCost: totals.byElement.overhead.actual,
        StandardScrapCost: totals.byElement.scrap.standard,
        PlannedScrapCost: totals.byElement.scrap.planned,
        ActualScrapCost: totals.byElement.scrap.actual,
        StandardTotalCost: totals.standardTotalCost,
        PlannedTotalCost: totals.plannedTotalCost,
        ActualTotalCost: totals.actualTotalCost,
        ContractRevenue: effectiveRevenue,
        GrossMargin: grossMargin,
        Reconciled: true,
        ReconciledAt: reconciledAt,
        ReconcileThrough: reconcileThrough,
        ModelVersion: modelVersion,
      };
      let saved;
      if (existingOrderCost) {
        const patchRes = await tx.patch("MfgOrderCost", existingOrderCost.Id, summary, subject.id, existingOrderCost.RowVersion);
        if (!patchRes.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "رکورد هزینهٔ سفارش هم‌زمان تغییر کرده است");
        saved = await tx.get("MfgOrderCost", existingOrderCost.Id);
      } else {
        saved = await tx.create("MfgOrderCost", {
          PlantId: plantId,
          ProductionOrderId: orderId,
          CostVersion: costVersion,
          Currency: totals.currency,
          ...summary,
        }, subject.id);
      }
      await createAuditRecord(tx, req, "MFG_ORDER_COST_RECONCILED", "MfgOrderCost", saved.Id, "mfg.cost.reconcile", {
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        orderId,
        costVersion,
        reconcileThrough,
      });
      const byElement = totals.byElement;
      return {
        ...saved,
        Variance: totals.costVariance,
        CostVariance: totals.costVariance,
        CostVariancePct: totals.costVariancePct,
        PlannedCostVariance: totals.plannedCostVariance,
        PlannedCostVariancePct: totals.plannedCostVariancePct,
        ByElement: byElement,
        OperationBreakdown: operationCostBreakdown(orderOps, completeCosts.rows),
      };
    });
  }));

  app.post(`${ROOT}/orders/:orderId/close`, route("mfg.order.close", async ({ repo: r, req, plantId, subject }) => {
    const orderId = text(req.params.orderId, "orderId", { required: true, max: 60, pattern: ID_RE });
    const expectedVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["CloseReason", "closeReason", "NoteFa"]));
    const closeReason = text(body.CloseReason ?? body.closeReason ?? body.NoteFa, "closeReason", { max: 1200 });

    const closed = await r.transaction(async (tx) => {
      const order = await tx.get("MfgProductionOrder", orderId);
      if (!order || order.PlantId !== plantId) throw notFound();
      if (order.RowVersion !== expectedVersion) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "سفارش از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }
      if (order.Status === "closed") {
        throw conflict("MFG_STATE_CONFLICT", "سفارش قبلاً بسته شده است");
      }
      if (!["in-progress", "completed"].includes(order.Status)) {
        throw businessRule("MFG_ORDER_NOT_CLOSABLE", "فقط سفارش در حال اجرا یا تکمیل‌شده قابل بستن نهایی است", { status: order.Status });
      }

      const [operations, executions, reworks, requirements, orderCosts] = await Promise.all([
        tx.list("MfgProductionOrderOperation", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "ProductionOrderId", op: "eq", value: orderId },
          ],
        }),
        tx.list("MfgOperationExecution", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        }),
        tx.list("MfgReworkRecord", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        }),
        tx.list("MfgMaterialRequirement", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "ProductionOrderId", op: "eq", value: orderId },
          ],
        }),
        tx.list("MfgOrderCost", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "ProductionOrderId", op: "eq", value: orderId },
          ],
        }),
      ]);

      const orderOps = operations.filter((op) => op.PlantId === plantId && op.ProductionOrderId === orderId);
      if (orderOps.length === 0 || orderOps.some((op) => op.Status !== "completed")) {
        throw businessRule("MFG_OPERATIONS_NOT_COMPLETED", "پیش از بستن سفارش، همهٔ عملیات‌های سفارش باید تکمیل شده باشند");
      }
      const opIds = new Set(orderOps.map((op) => op.Id));

      const runningExecs = executions.filter(
        (ex) => ex.PlantId === plantId && opIds.has(ex.ProductionOrderOperationId) && ex.Status === "running",
      );
      if (runningExecs.length > 0) {
        throw businessRule("MFG_OPERATIONS_NOT_COMPLETED", "نشست اجرای باز روی عملیات سفارش وجود دارد");
      }

      const openReworks = reworks.filter(
        (rw) => rw.PlantId === plantId && opIds.has(rw.SourceOperationId) && ["open", "in-progress"].includes(rw.Status),
      );
      if (openReworks.length > 0) {
        throw businessRule("MFG_REWORK_OPEN", "پیش از بستن سفارش، همهٔ چرخه‌های دوباره‌کاری باید تعیین‌تکلیف شوند");
      }

      const unsettledReqs = requirements.filter(
        (reqRow) => reqRow.PlantId === plantId
          && reqRow.ProductionOrderId === orderId
          && !["issued", "closed", "cancelled"].includes(reqRow.Status),
      );
      if (unsettledReqs.length > 0) {
        throw businessRule("MFG_MATERIALS_NOT_RECONCILED", "پیش از بستن سفارش، نیازمندی‌ها و مصرف مواد باید تعیین‌تکلیف شوند");
      }

      const hasReconciledCost = orderCosts.some(
        (costRow) => costRow.PlantId === plantId && costRow.ProductionOrderId === orderId && costRow.Reconciled === true,
      );
      if (!hasReconciledCost) {
        throw businessRule("MFG_COST_NOT_RECONCILED", "پیش از بستن سفارش، هزینهٔ سفارش باید تطبیق (Reconciled) شده باشد");
      }

      const closedAt = new Date().toISOString();
      const patchPayload = {
        Status: "closed",
        ClosedAt: closedAt,
        ClosedBy: subject.id,
      };
      if (closeReason !== null) patchPayload.NoteFa = closeReason;

      const patchRes = await tx.patch("MfgProductionOrder", order.Id, patchPayload, subject.id, expectedVersion);
      if (!patchRes.ok) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "سفارش از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }
      const updated = await tx.get("MfgProductionOrder", order.Id);
      await createAuditRecord(tx, req, "MFG_ORDER_CLOSED", "MfgProductionOrder", order.Id, "mfg.order.close", {
        orderNo: order.OrderNo,
        closedAt,
      });
      return updated;
    });

    return protectProjectLink(subject, closed, evaluate);
  }));

  app.get(`${ROOT}/dashboard/overview`, route("mfg.dashboard.view", async ({ repo: r, req, plantId, subject }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["from", "to", "workCenterId"]));
    const from = isoDateTime(q.from, "from", { required: true });
    const to = isoDateTime(q.to, "to", { required: true });
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (toMs <= fromMs) throw bad("to", "to باید پس از from باشد");
    if (toMs - fromMs > MAX_GANTT_WINDOW_MS) throw bad("to", "پنجرهٔ داشبورد حداکثر ۹۰ روز است");
    const workCenterId = text(q.workCenterId, "workCenterId", { max: 60, pattern: ID_RE });
    if (workCenterId) {
      const workCenter = await r.get("MfgWorkCenter", workCenterId);
      if (!workCenter || workCenter.PlantId !== plantId) throw notFound();
    }

    const [allOrders, allOperations, executions, requirements, alerts, scrapRecords] = await Promise.all([
      r.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgOperationExecution", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgMaterialRequirement", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionAlert", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgScrapRecord", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const plantOperations = allOperations.filter((row) => row.PlantId === plantId
      && (!workCenterId || row.WorkCenterId === workCenterId));
    const allowedOperationIds = new Set(plantOperations.map((row) => row.Id));
    const scopedOrderIds = new Set(plantOperations.map((row) => row.ProductionOrderId));
    const plantOrders = allOrders.filter((row) => row.PlantId === plantId
      && (!workCenterId || scopedOrderIds.has(row.Id)));
    const scopedOrderIdSet = new Set(plantOrders.map((row) => row.Id));

    const statusCounts = { created: 0, released: 0, "in-progress": 0, completed: 0, closed: 0, cancelled: 0 };
    for (const order of plantOrders) {
      if (Object.hasOwn(statusCounts, order.Status)) statusCounts[order.Status]++;
    }
    const openOrdersCount = statusCounts.created + statusCounts.released + statusCounts["in-progress"];
    const deliveryAt = (order) => storedTimestamp(order.CompletedAt ?? order.ClosedAt);
    const completedInWindow = plantOrders.filter((order) => {
      if (!["completed", "closed"].includes(order.Status)) return false;
      const completedAt = deliveryAt(order);
      return Number.isFinite(completedAt) && completedAt >= fromMs && completedAt < toMs;
    });
    const completedOnTimeCount = completedInWindow.filter((order) => {
      const finishedAt = deliveryAt(order);
      const dueAt = storedTimestamp(order.DueAt);
      return Number.isFinite(finishedAt) && Number.isFinite(dueAt) && finishedAt <= dueAt;
    }).length;
    const dueOrders = plantOrders.filter((order) => {
      const dueAt = storedTimestamp(order.DueAt);
      return Number.isFinite(dueAt) && dueAt >= fromMs && dueAt < toMs;
    });
    const deliveredDueOrders = dueOrders.filter((order) => ["completed", "closed"].includes(order.Status)
      && Number.isFinite(deliveryAt(order)));
    const onTimeDueOrders = deliveredDueOrders.filter((order) => deliveryAt(order) <= storedTimestamp(order.DueAt));
    const openLateOrdersCount = plantOrders.filter((order) => {
      const dueAt = storedTimestamp(order.DueAt);
      return Number.isFinite(dueAt) && dueAt < toMs && !["completed", "closed", "cancelled"].includes(order.Status);
    }).length;
    const onTimeDeliveryPct = dueOrders.length === 0
      ? null
      : roundTo3((onTimeDueOrders.length / dueOrders.length) * 100);
    const deliveredOnTimePct = deliveredDueOrders.length === 0
      ? null
      : roundTo3((onTimeDueOrders.length / deliveredDueOrders.length) * 100);

    const production = productionFactsForOperations(plantOperations, executions, scrapRecords, fromMs, toMs);
    const openShortages = requirements.filter((row) => {
      if (row.PlantId !== plantId || !scopedOrderIdSet.has(row.ProductionOrderId)
        || !["shortage"].includes(row.Status) || storedNumber(row.ShortageQuantity) <= 0) return false;
      if (workCenterId && row.ProductionOrderOperationId && !allowedOperationIds.has(row.ProductionOrderOperationId)) return false;
      return true;
    });
    const shortagesDueInWindow = openShortages.filter((row) => {
      const requiredAt = storedTimestamp(row.RequiredAt);
      return Number.isFinite(requiredAt) && requiredAt >= fromMs && requiredAt < toMs;
    });
    const totalShortageQuantity = roundTo3(openShortages.reduce((sum, row) => sum + storedNumber(row.ShortageQuantity), 0));
    const openAlerts = alerts.filter((row) => row.PlantId === plantId && row.Status === "open"
      && (!workCenterId || row.WorkCenterId === workCenterId
        || (!row.WorkCenterId && row.ProductionOrderId && scopedOrderIdSet.has(row.ProductionOrderId))));
    const alertsBySeverity = Object.fromEntries([...ALERT_SEVERITIES].map((severity) => [
      severity, openAlerts.filter((row) => row.Severity === severity).length,
    ]));

    const costVisible = evaluate(subject, "mfg.cost.view", { plantId }).allow;
    const costSummary = {
      available: costVisible,
      currency: null,
      orderCount: 0,
      reconciledOrderCount: 0,
      standardTotalCost: 0,
      plannedTotalCost: 0,
      actualTotalCost: 0,
      costVariance: 0,
      costVariancePct: null,
      plannedCostVariance: 0,
      plannedCostVariancePct: null,
      currencies: [],
    };
    if (costVisible && plantOrders.length > 0) {
      const [orderCostRows, allOperationCostRows] = await Promise.all([
        r.list("MfgOrderCost", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        r.list("MfgOperationCost", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      ]);
      const byCurrency = new Map();
      const operationByOrder = new Map();
      for (const operation of plantOperations) {
        const list = operationByOrder.get(operation.ProductionOrderId) ?? [];
        list.push(operation);
        operationByOrder.set(operation.ProductionOrderId, list);
      }
      for (const order of plantOrders) {
        const operationsForOrder = operationByOrder.get(order.Id) ?? [];
        if (operationsForOrder.length === 0) continue;
        const summaries = orderCostRows.filter((row) => row.PlantId === plantId && row.ProductionOrderId === order.Id);
        const latestSummary = summaries.sort((left, right) => Number(right.CostVersion) - Number(left.CostVersion))[0] ?? null;
        let currency = null;
        let standardTotalCost = 0;
        let plannedTotalCost = 0;
        let actualTotalCost = 0;
        let reconciled = false;
        if (!workCenterId && latestSummary?.Reconciled === true) {
          currency = latestSummary.Currency ?? "IRR";
          standardTotalCost = roundTo3(storedNumber(latestSummary.StandardTotalCost));
          plannedTotalCost = roundTo3(storedNumber(latestSummary.PlannedTotalCost, standardTotalCost));
          actualTotalCost = roundTo3(storedNumber(latestSummary.ActualTotalCost));
          reconciled = true;
        } else {
          const operationIdsForOrder = new Set(operationsForOrder.map((row) => row.Id));
          const storedVersions = allOperationCostRows.filter((row) => row.PlantId === plantId
            && operationIdsForOrder.has(row.ProductionOrderOperationId));
          const targetVersion = Math.max(Number(latestSummary?.CostVersion) || 0,
            ...storedVersions.map((row) => Number(row.CostVersion) || 0), 1);
          const storedForVersion = storedVersions.filter((row) => Number(row.CostVersion) === targetVersion);
          const derived = await deriveOperationCostRows(r, {
            plantId,
            operations: operationsForOrder,
            costVersion: targetVersion,
          });
          const complete = completeOperationCostRows(operationsForOrder, storedForVersion, derived);
          const totals = summarizeCostRows(complete.rows);
          currency = totals.currency;
          standardTotalCost = totals.standardTotalCost;
          plannedTotalCost = totals.plannedTotalCost;
          actualTotalCost = totals.actualTotalCost;
        }
        const key = String(currency ?? "IRR").toUpperCase();
        let aggregate = byCurrency.get(key);
        if (!aggregate) {
          aggregate = { currency: key, orderCount: 0, reconciledOrderCount: 0, standardTotalCost: 0, plannedTotalCost: 0, actualTotalCost: 0 };
          byCurrency.set(key, aggregate);
        }
        aggregate.orderCount++;
        if (reconciled) aggregate.reconciledOrderCount++;
        aggregate.standardTotalCost = roundTo3(aggregate.standardTotalCost + standardTotalCost);
        aggregate.plannedTotalCost = roundTo3(aggregate.plannedTotalCost + plannedTotalCost);
        aggregate.actualTotalCost = roundTo3(aggregate.actualTotalCost + actualTotalCost);
      }
      costSummary.currencies = [...byCurrency.values()].map((row) => ({
        ...row,
        costVariance: costVariance(row.actualTotalCost, row.standardTotalCost),
        costVariancePct: costVariancePct(row.actualTotalCost, row.standardTotalCost),
        plannedCostVariance: costVariance(row.actualTotalCost, row.plannedTotalCost),
        plannedCostVariancePct: costVariancePct(row.actualTotalCost, row.plannedTotalCost),
      }));
      costSummary.orderCount = costSummary.currencies.reduce((sum, row) => sum + row.orderCount, 0);
      costSummary.reconciledOrderCount = costSummary.currencies.reduce((sum, row) => sum + row.reconciledOrderCount, 0);
      if (costSummary.currencies.length === 1) {
        const aggregate = costSummary.currencies[0];
        costSummary.currency = aggregate.currency;
        costSummary.standardTotalCost = aggregate.standardTotalCost;
        costSummary.plannedTotalCost = aggregate.plannedTotalCost;
        costSummary.actualTotalCost = aggregate.actualTotalCost;
        costSummary.costVariance = aggregate.costVariance;
        costSummary.costVariancePct = aggregate.costVariancePct;
        costSummary.plannedCostVariance = aggregate.plannedCostVariance;
        costSummary.plannedCostVariancePct = aggregate.plannedCostVariancePct;
      }
    }

    const ordersSummary = {
      totalCount: plantOrders.length,
      openCount: openOrdersCount,
      closedCount: statusCounts.closed,
      statusCounts,
      completedInWindowCount: completedInWindow.length,
      completedOnTimeCount,
      dueInWindowCount: dueOrders.length,
      deliveredDueInWindowCount: deliveredDueOrders.length,
      onTimeDueInWindowCount: onTimeDueOrders.length,
      lateDeliveryCount: Math.max(0, deliveredDueOrders.length - onTimeDueOrders.length),
      openLateCount: openLateOrdersCount,
      onTimeDeliveryPct,
      deliveredOnTimePct,
    };
    return {
      from,
      to,
      workCenterId: workCenterId ?? null,
      openOrdersCount,
      orders: ordersSummary,
      statusCounts,
      completedOrdersCount: completedInWindow.length,
      completedOnTimeCount,
      onTimeDeliveryPct,
      deliveredOnTimePct,
      goodQuantity: production.goodQuantity,
      scrapQuantity: production.scrapQuantity,
      reworkQuantity: production.reworkQuantity,
      totalProducedQuantity: production.totalProducedQuantity,
      production,
      openShortagesCount: openShortages.length,
      totalShortageQuantity,
      shortages: {
        openCount: openShortages.length,
        dueInWindowCount: shortagesDueInWindow.length,
        totalQuantity: totalShortageQuantity,
      },
      openAlertsCount: openAlerts.length,
      alerts: { openCount: openAlerts.length, bySeverity: alertsBySeverity },
      costSummary,
    };
  }));

  app.get(`${ROOT}/dashboard/work-center-load`, route("mfg.dashboard.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["from", "to", "bucket", "workCenterId"]));
    const from = isoDateTime(q.from, "from", { required: true });
    const to = isoDateTime(q.to, "to", { required: true });
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (toMs <= fromMs) throw bad("to", "to باید پس از from باشد");
    if (toMs - fromMs > MAX_GANTT_WINDOW_MS) throw bad("to", "پنجرهٔ داشبورد حداکثر ۹۰ روز است");
    const bucket = text(q.bucket ?? "day", "bucket", { required: true, max: 8 });
    if (!["day", "week"].includes(bucket)) throw bad("bucket", "bucket باید day یا week باشد");
    const workCenterId = text(q.workCenterId, "workCenterId", { max: 60, pattern: ID_RE });

    const workCenters = await r.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] });
    const workCenterById = new Map(workCenters.filter((wc) => wc.PlantId === plantId).map((wc) => [wc.Id, wc]));
    if (workCenterId && !workCenterById.has(workCenterId)) throw notFound();

    const latestRuns = await r.list("MfgScheduleRun", {
      where: [{ column: "PlantId", op: "eq", value: plantId }],
      orderBy: [{ column: "ScheduleVersion", dir: "desc" }],
      limit: 1,
    });
    const scheduleVersion = latestRuns[0]?.ScheduleVersion ?? 0;
    if (scheduleVersion === 0) return { scheduleVersion, bucket, buckets: [] };

    const capacityRows = await r.list("MfgCapacityPlan", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "ScheduleVersion", op: "eq", value: scheduleVersion },
      ],
    });
    const rows = capacityRows.flatMap((row) => {
      if (row.PlantId !== plantId) return [];
      if (workCenterId && row.WorkCenterId !== workCenterId) return [];
      const workCenter = workCenterById.get(row.WorkCenterId);
      if (!workCenter) return [];
      const start = storedTimestamp(row.PeriodStart);
      const end = storedTimestamp(row.PeriodEnd);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start >= toMs || end <= fromMs) return [];
      return [{ row, workCenter, start, end }];
    });

    let buckets;
    if (bucket === "day") {
      buckets = rows.map(({ row, start, end }) => ({
        WorkCenterId: row.WorkCenterId,
        PeriodStart: new Date(start).toISOString(),
        PeriodEnd: new Date(end).toISOString(),
        AvailableMinutes: roundTo3(storedNumber(row.AvailableMinutes)),
        PlannedLoadMinutes: roundTo3(storedNumber(row.PlannedLoadMinutes)),
        UtilizationPct: row.UtilizationPct === null || row.UtilizationPct === undefined
          ? null
          : roundTo3(storedNumber(row.UtilizationPct)),
        ScheduleVersion: scheduleVersion,
      }));
    } else {
      const grouped = new Map();
      for (const { row, workCenter, start, end } of rows) {
        const localDate = localDateAt(start, workCenter.TimeZoneId || "UTC");
        const weekStart = isoWeekStart(localDate);
        const key = `${workCenter.Id}\u0000${weekStart}`;
        let aggregate = grouped.get(key);
        if (!aggregate) {
          aggregate = { WorkCenterId: workCenter.Id, start, end, available: 0, planned: 0 };
          grouped.set(key, aggregate);
        }
        aggregate.start = Math.min(aggregate.start, start);
        aggregate.end = Math.max(aggregate.end, end);
        aggregate.available += storedNumber(row.AvailableMinutes);
        aggregate.planned += storedNumber(row.PlannedLoadMinutes);
      }
      buckets = [...grouped.values()].map((aggregate) => ({
        WorkCenterId: aggregate.WorkCenterId,
        PeriodStart: new Date(aggregate.start).toISOString(),
        PeriodEnd: new Date(aggregate.end).toISOString(),
        AvailableMinutes: roundTo3(aggregate.available),
        PlannedLoadMinutes: roundTo3(aggregate.planned),
        UtilizationPct: aggregate.available <= 0
          ? null
          : Math.min(9999.999, roundTo3((aggregate.planned / aggregate.available) * 100)),
        ScheduleVersion: scheduleVersion,
      }));
    }

    buckets.sort((left, right) => Date.parse(left.PeriodStart) - Date.parse(right.PeriodStart)
      || String(left.WorkCenterId).localeCompare(String(right.WorkCenterId)));
    return { scheduleVersion, bucket, buckets };
  }));

  app.get(`${ROOT}/dashboard/oee`, route("mfg.dashboard.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["from", "to", "workCenterId"]));
    const from = isoDateTime(q.from, "from", { required: true });
    const to = isoDateTime(q.to, "to", { required: true });
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (toMs <= fromMs) throw bad("to", "to باید پس از from باشد");
    if (toMs - fromMs > MAX_GANTT_WINDOW_MS) throw bad("to", "پنجرهٔ OEE حداکثر ۹۰ روز است");
    const workCenterId = text(q.workCenterId, "workCenterId", { max: 60, pattern: ID_RE });
    const [allWorkCenters, allOperations, executions, downtimes, scrapRecords, calendars] = await Promise.all([
      r.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgOperationExecution", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgDowntimeLog", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgScrapRecord", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgWorkCenterCalendar", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const workCenters = allWorkCenters.filter((row) => row.PlantId === plantId
      && (!workCenterId || row.Id === workCenterId));
    if (workCenterId && workCenters.length === 0) throw notFound();
    const perWorkCenter = [];
    let calendarMinutes = 0;
    let plannedDowntimeMinutes = 0;
    let unplannedDowntimeMinutes = 0;
    const plantFacts = {
      actualRunMinutes: 0,
      idealProductionMinutes: 0,
      goodQuantity: 0,
      scrapQuantity: 0,
      reworkQuantity: 0,
      totalProducedQuantity: 0,
    };
    for (const workCenter of workCenters) {
      const centerOperations = allOperations.filter((row) => row.PlantId === plantId && row.WorkCenterId === workCenter.Id);
      const centerCalendar = workCenterCalendarIntervals(workCenter, calendars, fromMs, toMs);
      const available = weightedCalendarMinutes(centerCalendar);
      const plannedIntervals = downtimeIntervalsForWindow(downtimes, workCenter.Id, fromMs, toMs, "planned");
      const allUnplannedIntervals = downtimeIntervalsForWindow(downtimes, workCenter.Id, fromMs, toMs, "unplanned");
      const unplannedIntervals = subtractTimeIntervals(allUnplannedIntervals, plannedIntervals);
      const plannedMinutes = weightedOverlapMinutes(plannedIntervals, centerCalendar);
      const unplannedMinutes = weightedOverlapMinutes(unplannedIntervals, centerCalendar);
      const facts = productionFactsForOperations(centerOperations, executions, scrapRecords, fromMs, toMs);
      const metrics = buildOeeMetrics({
        from,
        to,
        workCenter,
        calendarMinutes: available,
        plannedDowntimeMinutes: plannedMinutes,
        unplannedDowntimeMinutes: unplannedMinutes,
        facts,
      });
      perWorkCenter.push(metrics);
      calendarMinutes += available;
      plannedDowntimeMinutes += plannedMinutes;
      unplannedDowntimeMinutes += unplannedMinutes;
      for (const key of Object.keys(plantFacts)) plantFacts[key] += facts[key];
    }
    for (const key of Object.keys(plantFacts)) plantFacts[key] = roundTo3(plantFacts[key]);
    const overall = buildOeeMetrics({
      from,
      to,
      calendarMinutes: roundTo3(calendarMinutes),
      plannedDowntimeMinutes: roundTo3(plannedDowntimeMinutes),
      unplannedDowntimeMinutes: roundTo3(unplannedDowntimeMinutes),
      facts: plantFacts,
    });
    const bottlenecks = perWorkCenter
      .filter((row) => row.oeePct !== null)
      .sort((left, right) => left.oeePct - right.oeePct || String(left.workCenterCode).localeCompare(String(right.workCenterCode)))
      .slice(0, 5)
      .map((row, index) => ({
        rank: index + 1,
        workCenterId: row.workCenterId,
        workCenterCode: row.workCenterCode,
        workCenterNameFa: row.workCenterNameFa,
        oeePct: row.oeePct,
        availabilityPct: row.availability.pct,
        performancePct: row.performance.pct,
        qualityPct: row.quality.pct,
        unplannedDowntimeMinutes: row.downtime.unplannedMinutes,
      }));
    return {
      ...overall,
      workCenterId: workCenterId ?? null,
      workCenters: perWorkCenter,
      bottlenecks,
    };
  }));

  app.get(`${ROOT}/alerts`, route("mfg.alert.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["status", "severity", "orderId", "workCenterId", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit حداقل ۱ است");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);

    const statusFilter = text(q.status, "status", { max: 24 });
    if (statusFilter && !ALERT_STATUSES.has(statusFilter)) {
      throw bad("status", "status هشدار معتبر نیست");
    }
    const severityFilter = text(q.severity, "severity", { max: 12 });
    if (severityFilter && !ALERT_SEVERITIES.has(severityFilter)) {
      throw bad("severity", "severity هشدار باید critical، high، medium یا low باشد");
    }
    const orderId = text(q.orderId, "orderId", { max: 60, pattern: ID_RE });
    const workCenterId = text(q.workCenterId, "workCenterId", { max: 60, pattern: ID_RE });

    const [allAlerts, allOrders, allOperations, allWorkCenters] = await Promise.all([
      r.list("MfgProductionAlert", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const orderById = new Map(allOrders.filter((o) => o.PlantId === plantId).map((o) => [o.Id, o]));
    const opById = new Map(allOperations.filter((op) => op.PlantId === plantId).map((op) => [op.Id, op]));
    const wcById = new Map(allWorkCenters.filter((wc) => wc.PlantId === plantId).map((wc) => [wc.Id, wc]));

    const matched = allAlerts
      .filter((al) => {
        if (al.PlantId !== plantId) return false;
        if (statusFilter && al.Status !== statusFilter) return false;
        if (severityFilter && al.Severity !== severityFilter) return false;
        if (orderId && al.ProductionOrderId !== orderId) return false;
        if (workCenterId && al.WorkCenterId !== workCenterId) return false;
        return true;
      })
      .map((al) => {
        const ord = al.ProductionOrderId ? orderById.get(al.ProductionOrderId) : null;
        const op = al.ProductionOrderOperationId ? opById.get(al.ProductionOrderOperationId) : null;
        const wc = al.WorkCenterId ? wcById.get(al.WorkCenterId) : null;
        return {
          ...al,
          OrderNo: ord?.OrderNo ?? null,
          OperationCode: op?.OperationCode ?? null,
          WorkCenterCode: wc?.Code ?? null,
          WorkCenterNameFa: wc?.NameFa ?? null,
        };
      });

    matched.sort((a, b) => storedTimestamp(b.LastRaisedAt) - storedTimestamp(a.LastRaisedAt)
      || String(a.Id).localeCompare(String(b.Id)));
    const items = matched.slice(offset, offset + limit);
    return { items, page: { limit, offset, total: matched.length } };
  }));

  app.post(`${ROOT}/alerts/:alertId/acknowledgements`, route("mfg.alert.ack", async ({ repo: r, req, plantId, subject }) => {
    const alertId = text(req.params.alertId, "alertId", { required: true, max: 60, pattern: ID_RE });
    const expectedVersion = rowVersionFrom(req);
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["NoteFa"]));
    const noteFa = text(body.NoteFa, "NoteFa", { max: 1200 });

    return r.transaction(async (tx) => {
      const alert = await tx.get("MfgProductionAlert", alertId);
      if (!alert || alert.PlantId !== plantId) throw notFound();
      if (alert.RowVersion !== expectedVersion) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "هشدار از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }
      if (alert.Status !== "open") {
        throw conflict("MFG_STATE_CONFLICT", "فقط هشدار در وضعیت open قابل رسیدگی (acknowledge) است");
      }

      const acknowledgedAt = new Date().toISOString();
      const patchPayload = {
        Status: "acknowledged",
        AcknowledgedAt: acknowledgedAt,
        AcknowledgedBy: subject.id,
      };
      if (noteFa !== null) {
        patchPayload.DetailFa = alert.DetailFa ? `${alert.DetailFa} | ${noteFa}` : noteFa;
      }

      const patchRes = await tx.patch("MfgProductionAlert", alert.Id, patchPayload, subject.id, expectedVersion);
      if (!patchRes.ok) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "هشدار از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }
      const updated = await tx.get("MfgProductionAlert", alert.Id);
      await createAuditRecord(tx, req, "MFG_ALERT_ACKNOWLEDGED", "MfgProductionAlert", alert.Id, "mfg.alert.ack", {
        alertCode: alert.AlertCode,
        acknowledgedAt,
      });
      return updated;
    });
  }));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — مدیریت تقاضا و پیش‌بینی فروش (Demand Management)
   * ════════════════════════════════════════════════════════════════════════ */

  app.get(`${ROOT}/demand-forecasts`, route("mfg.demand.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "demandType", "status", "customerRef", "requiredFrom", "requiredTo", "q", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.partId !== undefined) {
      const partId = text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE });
      const part = await r.get("MfgPart", partId);
      if (!part || part.PlantId !== plantId) throw notFound();
      where.push({ column: "PartId", op: "eq", value: partId });
    }
    if (q.demandType !== undefined) {
      const demandType = text(q.demandType, "demandType", { required: true, max: 16 });
      if (!DEMAND_TYPES.has(demandType)) throw bad("demandType", "demandType باید sales-order/forecast/contract/manual باشد");
      where.push({ column: "DemandType", op: "eq", value: demandType });
    }
    if (q.status !== undefined) {
      const status = text(q.status, "status", { required: true, max: 16 });
      if (!DEMAND_STATUSES.has(status)) throw bad("status", "status باید draft/confirmed/cancelled باشد");
      where.push({ column: "Status", op: "eq", value: status });
    }
    if (q.customerRef !== undefined) where.push({ column: "CustomerRef", op: "eq", value: text(q.customerRef, "customerRef", { required: true, max: 80 }) });
    if (q.requiredFrom !== undefined) where.push({ column: "RequiredAt", op: "gte", value: isoDate(q.requiredFrom, "requiredFrom", { required: true }) });
    if (q.requiredTo !== undefined) where.push({ column: "RequiredAt", op: "lte", value: isoDate(q.requiredTo, "requiredTo", { required: true }) });
    if (q.q !== undefined) where.push({ column: "DemandRef", op: "like", value: `%${text(q.q, "q", { required: true, max: 60 })}%` });

    const [items, total] = await Promise.all([
      r.list("MfgDemandForecast", { where, orderBy: [{ column: "RequiredAt", dir: "asc" }, { column: "DemandRef", dir: "asc" }], limit, offset }),
      r.count("MfgDemandForecast", where),
    ]);
    return { items, page: { limit, offset, total } };
  }));

  app.post(`${ROOT}/demand-forecasts`, route("mfg.demand.edit", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["PartId", "DemandType", "DemandRef", "RequiredAt", "Quantity", "Uom", "CustomerRef", "CustomerNameSnapshot", "ConfidencePct", "Status", "NoteFa"]));
    const partId = text(body.PartId, "PartId", { required: true, max: 60, pattern: ID_RE });
    const part = await r.get("MfgPart", partId);
    if (!part || part.PlantId !== plantId) throw notFound();
    if (!part.IsActive) throw businessRule("MFG_PART_INACTIVE", `قطعهٔ ${part.PartNo} غیرفعال است`, { partId });

    const demandType = text(body.DemandType, "DemandType", { required: true, max: 16 });
    if (!DEMAND_TYPES.has(demandType)) throw bad("DemandType", "DemandType باید sales-order/forecast/contract/manual باشد");
    const demandRef = text(body.DemandRef, "DemandRef", { required: true, max: 60, pattern: CODE_RE });
    const requiredAt = isoDate(body.RequiredAt, "RequiredAt", { required: true });
    const quantity = number(body.Quantity, "Quantity", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    const uom = text(body.Uom, "Uom", { max: 16 }) ?? part.BaseUom;
    const confidencePct = body.ConfidencePct === undefined || body.ConfidencePct === null
      ? null
      : number(body.ConfidencePct, "ConfidencePct", { required: true, min: 0, max: 100 });
    if (demandType === "forecast" && confidencePct === null) {
      throw businessRule("MFG_DEMAND_CONFIDENCE_REQUIRED", "ردیف پیش‌بینی فروش باید ConfidencePct داشته باشد", { demandType });
    }
    const status = text(body.Status, "Status", { max: 16 }) ?? "draft";
    if (!DEMAND_STATUSES.has(status)) throw bad("Status", "Status باید draft/confirmed/cancelled باشد");
    if (status === "cancelled") throw bad("Status", "ثبت اولیه با وضعیت cancelled مجاز نیست؛ ردیف ثبت‌شده را لغو کنید");

    const row = await r.create("MfgDemandForecast", {
      PlantId: plantId,
      PartId: part.Id,
      DemandType: demandType,
      DemandRef: demandRef,
      CustomerRef: text(body.CustomerRef, "CustomerRef", { max: 80 }),
      CustomerNameSnapshot: text(body.CustomerNameSnapshot, "CustomerNameSnapshot", { max: 240 }),
      RequiredAt: requiredAt,
      Quantity: roundTo3(quantity),
      Uom: uom,
      ConfidencePct: confidencePct,
      Status: status,
      ConsumedQuantity: null,
      MpsRunId: null,
      NoteFa: text(body.NoteFa, "NoteFa", { max: 800 }),
    }, subject.id);
    await writeAudit(r, req, "MFG_DEMAND_CREATED", "MfgDemandForecast", row.Id, "mfg.demand.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/demand-forecasts/:demandId`, route("mfg.demand.edit", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["RequiredAt", "Quantity", "Uom", "ConfidencePct", "Status", "CustomerRef", "CustomerNameSnapshot", "NoteFa"]));
    const expectedVersion = rowVersionFrom(req);
    const demandId = text(req.params.demandId, "demandId", { required: true, max: 60, pattern: ID_RE });
    const existing = await r.get("MfgDemandForecast", demandId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    if (existing.RowVersion !== expectedVersion) throw conflict("MFG_ROW_VERSION_CONFLICT", "ردیف تقاضا از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");

    const patch = {};
    if (body.RequiredAt !== undefined) patch.RequiredAt = isoDate(body.RequiredAt, "RequiredAt", { required: true });
    if (body.Quantity !== undefined) {
      patch.Quantity = roundTo3(number(body.Quantity, "Quantity", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 }));
      /* مصرف ثبت‌شده نباید از مقدار تازه بیشتر شود؛ وگرنه ردیابی پیش‌بینی مصرف‌شده بی‌معنا می‌شود. */
      if (storedNumber(existing.ConsumedQuantity) > patch.Quantity) {
        throw businessRule("MFG_DEMAND_BELOW_CONSUMED", `مقدار تازه از مقدار مصرف‌شده (${storedNumber(existing.ConsumedQuantity)}) کمتر است`, { demandId });
      }
    }
    if (body.Uom !== undefined) patch.Uom = text(body.Uom, "Uom", { required: true, max: 16 });
    if (body.ConfidencePct !== undefined) {
      patch.ConfidencePct = body.ConfidencePct === null ? null : number(body.ConfidencePct, "ConfidencePct", { required: true, min: 0, max: 100 });
    }
    if (body.Status !== undefined) {
      const status = text(body.Status, "Status", { required: true, max: 16 });
      if (!DEMAND_STATUSES.has(status)) throw bad("Status", "Status باید draft/confirmed/cancelled باشد");
      if (status === "cancelled" && existing.MpsRunId && storedNumber(existing.ConsumedQuantity) > 0) {
        throw businessRule("MFG_DEMAND_CONSUMED_LOCK", "ردیفی که در اجرای MPS مصرف شده قابل لغو نیست", { demandId });
      }
      patch.Status = status;
    }
    if (body.CustomerRef !== undefined) patch.CustomerRef = text(body.CustomerRef, "CustomerRef", { max: 80 });
    if (body.CustomerNameSnapshot !== undefined) patch.CustomerNameSnapshot = text(body.CustomerNameSnapshot, "CustomerNameSnapshot", { max: 240 });
    if (body.NoteFa !== undefined) patch.NoteFa = text(body.NoteFa, "NoteFa", { max: 800 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییری ارسال نشده است");

    const result = await r.patch("MfgDemandForecast", existing.Id, patch, subject.id, expectedVersion);
    if (!result.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "ردیف تقاضا از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
    await writeAudit(r, req, "MFG_DEMAND_UPDATED", "MfgDemandForecast", existing.Id, "mfg.demand.edit");
    return r.get("MfgDemandForecast", existing.Id);
  }));

  app.delete(`${ROOT}/demand-forecasts/:demandId`, route("mfg.demand.edit", async ({ repo: r, req, plantId, subject }) => {
    const demandId = text(req.params.demandId, "demandId", { required: true, max: 60, pattern: ID_RE });
    return r.transaction(async (tx) => {
      const existing = await tx.get("MfgDemandForecast", demandId);
      if (!existing || existing.PlantId !== plantId) throw notFound();
      /* حذف فیزیکی فقط برای پیش‌نویسِ مصرف‌نشده؛ دادهٔ تأییدشده یا مصرف‌شده در
       * تاریخچهٔ برنامهٔ تولید معنا دارد و فقط لغو (cancelled) می‌شود. */
      if (existing.Status !== "draft" || existing.MpsRunId) {
        throw conflict("MFG_STATE_CONFLICT", "فقط ردیف پیش‌نویسِ مصرف‌نشده قابل حذف است؛ برای بقیه Status را به cancelled تغییر دهید");
      }
      const removed = await tx.remove("MfgDemandForecast", existing.Id);
      if (!removed || removed.affected !== 1) throw conflict("MFG_STATE_CONFLICT", "ردیف تقاضا هم‌زمان حذف شده است");
      await createAuditRecord(tx, req, "MFG_DEMAND_DELETED", "MfgDemandForecast", existing.Id, "mfg.demand.edit", {
        demandRef: existing.DemandRef,
        demandType: existing.DemandType,
      });
      return { deleted: true, id: existing.Id };
    });
  }));

  app.get(`${ROOT}/demand/time-phased`, route("mfg.demand.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "bucketUnit", "horizonStart", "bucketCount", "status", "includeCancelled"]));
    const bucketUnit = text(q.bucketUnit, "bucketUnit", { max: 8 }) ?? "week";
    if (!TIME_BUCKETS.has(bucketUnit)) throw bad("bucketUnit", "bucketUnit باید day/week/month باشد");
    const bucketCount = pageNumber(q.bucketCount, "bucketCount", 12, 260);
    if (bucketCount < 1 || bucketCount > 260) throw bad("bucketCount", "bucketCount باید بین ۱ و ۲۶۰ باشد");
    const today = new Date().toISOString().slice(0, 10);
    const horizonStart = isoDate(q.horizonStart, "horizonStart") ?? today;
    const includeCancelled = q.includeCancelled === "true";

    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.partId !== undefined) {
      const partId = text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE });
      const part = await r.get("MfgPart", partId);
      if (!part || part.PlantId !== plantId) throw notFound();
      where.push({ column: "PartId", op: "eq", value: partId });
    }
    if (q.status !== undefined) {
      const status = text(q.status, "status", { required: true, max: 16 });
      if (!DEMAND_STATUSES.has(status)) throw bad("status", "status باید draft/confirmed/cancelled باشد");
      where.push({ column: "Status", op: "eq", value: status });
    }
    const [rows, parts] = await Promise.all([
      r.list("MfgDemandForecast", { where, orderBy: [{ column: "RequiredAt", dir: "asc" }] }),
      r.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const partById = new Map(parts.filter((item) => item.PlantId === plantId).map((item) => [item.Id, item]));
    const buckets = runPlanning(() => buildTimeBuckets({ horizonStart, bucketUnit, bucketCount }));

    const byPart = new Map();
    let outsideHorizonQty = 0;
    for (const row of rows) {
      if (row.PlantId !== plantId) continue;
      if (!includeCancelled && row.Status === "cancelled") continue;
      const quantity = storedNumber(row.Quantity);
      const bucket = buckets.find((item) => String(row.RequiredAt).slice(0, 10) >= item.start && String(row.RequiredAt).slice(0, 10) < item.end);
      if (!bucket) {
        outsideHorizonQty = roundTo3(outsideHorizonQty + quantity);
        continue;
      }
      if (!byPart.has(row.PartId)) {
        byPart.set(row.PartId, buckets.map((item) => ({
          bucketIndex: item.index,
          bucketStart: item.start,
          bucketEnd: item.end,
          salesOrderQty: 0,
          forecastQty: 0,
          contractQty: 0,
          manualQty: 0,
          totalQty: 0,
        })));
      }
      const line = byPart.get(row.PartId)[bucket.index];
      const field = row.DemandType === "sales-order" ? "salesOrderQty"
        : row.DemandType === "forecast" ? "forecastQty"
          : row.DemandType === "contract" ? "contractQty" : "manualQty";
      line[field] = roundTo3(line[field] + quantity);
      line.totalQty = roundTo3(line.totalQty + quantity);
    }

    return {
      bucketUnit,
      bucketCount: buckets.length,
      horizonStart: buckets[0].start,
      horizonEnd: buckets[buckets.length - 1].end,
      outsideHorizonQty,
      parts: [...byPart.entries()].map(([partId, lines]) => ({
        partId,
        partNo: partById.get(partId)?.PartNo ?? null,
        partNameFa: partById.get(partId)?.NameFa ?? null,
        uom: partById.get(partId)?.BaseUom ?? null,
        totalQty: roundTo3(lines.reduce((sum, line) => sum + line.totalQty, 0)),
        lines,
      })),
    };
  }));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — قواعد اندازه‌گذاری لات (Lot Sizing: L4L / FOQ / EOQ / POQ)
   * ════════════════════════════════════════════════════════════════════════ */

  app.get(`${ROOT}/lot-sizing-policies`, route("mfg.lotsize.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "ruleCode", "isActive", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.partId !== undefined) {
      const partId = text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE });
      const part = await r.get("MfgPart", partId);
      if (!part || part.PlantId !== plantId) throw notFound();
      where.push({ column: "PartId", op: "eq", value: partId });
    }
    if (q.ruleCode !== undefined) {
      const ruleCode = text(q.ruleCode, "ruleCode", { required: true, max: 8 });
      if (!LOT_SIZING_RULES.includes(ruleCode)) throw bad("ruleCode", "ruleCode باید L4L/FOQ/EOQ/POQ باشد");
      where.push({ column: "RuleCode", op: "eq", value: ruleCode });
    }
    if (q.isActive !== undefined) {
      if (!/^(true|false)$/.test(String(q.isActive))) throw bad("isActive", "isActive باید true یا false باشد");
      where.push({ column: "IsActive", op: "eq", value: q.isActive === "true" });
    }
    const [items, total] = await Promise.all([
      r.list("MfgLotSizingPolicy", { where, orderBy: [{ column: "EffectiveFrom", dir: "asc" }], limit, offset }),
      r.count("MfgLotSizingPolicy", where),
    ]);
    return {
      items: items.map((row) => ({ ...row, eoq: enrichLotPolicy(row).eoq, periodOrderQuantity: enrichLotPolicy(row).periodOrderQuantity })),
      page: { limit, offset, total },
    };
  }));

  app.post(`${ROOT}/lot-sizing-policies`, route("mfg.lotsize.edit", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    /* PartId فقط هنگام ثبت پذیرفته می‌شود؛ جابه‌جایی سیاست بین قطعه‌ها مجاز نیست. */
    assertOnlyKeys(body, new Set([...LOT_POLICY_FIELDS, "PartId"]));
    const partId = text(body.PartId, "PartId", { required: true, max: 60, pattern: ID_RE });
    const part = await r.get("MfgPart", partId);
    if (!part || part.PlantId !== plantId) throw notFound();

    const parsed = parseLotPolicyInput(body, {});
    const issues = runPlanning(() => validateLotSizingPolicy(parsed.engine));
    if (issues.length > 0) throw businessRule("MFG_LOT_POLICY_INVALID", `سیاست اندازه‌گذاری لات نامعتبر است: ${issues.join("؛ ")}`, { issues });

    const row = await r.create("MfgLotSizingPolicy", {
      PlantId: plantId,
      PartId: part.Id,
      PolicyCode: parsed.policyCode ?? `LS-${part.PartNo}`.slice(0, 60),
      RuleCode: parsed.ruleCode,
      FixedLotQty: parsed.fixedLotQty,
      OrderMultiple: parsed.orderMultiple,
      MinOrderQty: parsed.minOrderQty,
      MaxOrderQty: parsed.maxOrderQty,
      OrderingCost: parsed.orderingCost,
      HoldingCostPerUnitPerYear: parsed.holdingCostPerUnitPerYear,
      AnnualDemandQty: parsed.annualDemandQty,
      PeriodDays: parsed.periodDays,
      PeriodOrderQuantity: parsed.periodOrderQuantity,
      Currency: parsed.currency,
      EffectiveFrom: parsed.effectiveFrom,
      EffectiveTo: parsed.effectiveTo,
      IsActive: parsed.isActive,
      NoteFa: parsed.noteFa,
    }, subject.id);
    await writeAudit(r, req, "MFG_LOT_POLICY_CREATED", "MfgLotSizingPolicy", row.Id, "mfg.lotsize.edit");
    return { ...row, eoq: enrichLotPolicy(row).eoq, periodOrderQuantity: enrichLotPolicy(row).periodOrderQuantity };
  }, 201));

  app.patch(`${ROOT}/lot-sizing-policies/:policyId`, route("mfg.lotsize.edit", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    const editable = new Set([...LOT_POLICY_FIELDS].filter((field) => !["PolicyCode", "PartId"].includes(field)));
    assertOnlyKeys(body, editable);
    const expectedVersion = rowVersionFrom(req);
    const policyId = text(req.params.policyId, "policyId", { required: true, max: 60, pattern: ID_RE });
    const existing = await r.get("MfgLotSizingPolicy", policyId);
    if (!existing || existing.PlantId !== plantId) throw notFound();
    if (existing.RowVersion !== expectedVersion) throw conflict("MFG_ROW_VERSION_CONFLICT", "سیاست لات از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");

    const merged = {
      PolicyCode: existing.PolicyCode,
      RuleCode: body.RuleCode ?? existing.RuleCode,
      FixedLotQty: body.FixedLotQty === undefined ? existing.FixedLotQty : body.FixedLotQty,
      OrderMultiple: body.OrderMultiple === undefined ? existing.OrderMultiple : body.OrderMultiple,
      MinOrderQty: body.MinOrderQty === undefined ? existing.MinOrderQty : body.MinOrderQty,
      MaxOrderQty: body.MaxOrderQty === undefined ? existing.MaxOrderQty : body.MaxOrderQty,
      OrderingCost: body.OrderingCost === undefined ? existing.OrderingCost : body.OrderingCost,
      HoldingCostPerUnitPerYear: body.HoldingCostPerUnitPerYear === undefined ? existing.HoldingCostPerUnitPerYear : body.HoldingCostPerUnitPerYear,
      AnnualDemandQty: body.AnnualDemandQty === undefined ? existing.AnnualDemandQty : body.AnnualDemandQty,
      PeriodDays: body.PeriodDays === undefined ? existing.PeriodDays : body.PeriodDays,
      PeriodOrderQuantity: body.PeriodOrderQuantity === undefined ? existing.PeriodOrderQuantity : body.PeriodOrderQuantity,
      Currency: body.Currency ?? existing.Currency,
      EffectiveFrom: body.EffectiveFrom ?? existing.EffectiveFrom,
      EffectiveTo: body.EffectiveTo === undefined ? existing.EffectiveTo : body.EffectiveTo,
      IsActive: body.IsActive === undefined ? existing.IsActive : body.IsActive,
      NoteFa: body.NoteFa === undefined ? existing.NoteFa : body.NoteFa,
    };
    const parsed = parseLotPolicyInput(merged, { allowExistingNulls: true });
    const issues = runPlanning(() => validateLotSizingPolicy(parsed.engine));
    if (issues.length > 0) throw businessRule("MFG_LOT_POLICY_INVALID", `سیاست اندازه‌گذاری لات نامعتبر است: ${issues.join("؛ ")}`, { issues });

    const patch = {
      RuleCode: parsed.ruleCode,
      FixedLotQty: parsed.fixedLotQty,
      OrderMultiple: parsed.orderMultiple,
      MinOrderQty: parsed.minOrderQty,
      MaxOrderQty: parsed.maxOrderQty,
      OrderingCost: parsed.orderingCost,
      HoldingCostPerUnitPerYear: parsed.holdingCostPerUnitPerYear,
      AnnualDemandQty: parsed.annualDemandQty,
      PeriodDays: parsed.periodDays,
      PeriodOrderQuantity: parsed.periodOrderQuantity,
      Currency: parsed.currency,
      EffectiveFrom: parsed.effectiveFrom,
      EffectiveTo: parsed.effectiveTo,
      IsActive: parsed.isActive,
      NoteFa: parsed.noteFa,
    };
    const result = await r.patch("MfgLotSizingPolicy", existing.Id, patch, subject.id, expectedVersion);
    if (!result.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "سیاست لات از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
    await writeAudit(r, req, "MFG_LOT_POLICY_UPDATED", "MfgLotSizingPolicy", existing.Id, "mfg.lotsize.edit");
    const updated = await r.get("MfgLotSizingPolicy", existing.Id);
    return { ...updated, eoq: enrichLotPolicy(updated).eoq, periodOrderQuantity: enrichLotPolicy(updated).periodOrderQuantity };
  }));

  /* ارزیابی خشک (dry-run) اندازه‌گذاری لات روی یک سری تقاضا؛ هیچ رکوردی نوشته نمی‌شود. */
  app.post(`${ROOT}/lot-sizing/evaluate`, route("mfg.lotsize.view", async ({ repo: r, req, plantId }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["PartId", "Policy", "Demand", "OnHandQty", "ReservedQty", "BlockedQty", "SafetyStockQty", "LeadTimeDays", "BucketUnit", "HorizonStart", "BucketCount", "DemandTimeFenceBuckets", "FirmPlannedTimeFenceBuckets"]));
    const partId = text(body.PartId, "PartId", { required: true, max: 60, pattern: ID_RE });
    const part = await r.get("MfgPart", partId);
    if (!part || part.PlantId !== plantId) throw notFound();

    const bucketUnit = text(body.BucketUnit, "BucketUnit", { max: 8 }) ?? "week";
    if (!TIME_BUCKETS.has(bucketUnit)) throw bad("BucketUnit", "BucketUnit باید day/week/month باشد");
    const bucketCount = body.BucketCount === undefined ? 12 : number(body.BucketCount, "BucketCount", { required: true, min: 1, max: 260, integer: true });
    const horizonStart = isoDate(body.HorizonStart, "HorizonStart") ?? new Date().toISOString().slice(0, 10);
    const buckets = runPlanning(() => buildTimeBuckets({ horizonStart, bucketUnit, bucketCount }));

    /* Demand اختیاری است: وقتی فرستاده نشود، همان رجیستر تقاضایی خوانده می‌شود
     * که MPS می‌خواند — وگرنه ارزیابی خشک با اجرای واقعی MPS قابل مقایسه نیست.
     * هر عدد دیگری (OnHandQty، SafetyStockQty، LeadTimeDays) هم همین رفتار را دارد. */
    let demand;
    let demandSource;
    if (body.Demand === undefined || body.Demand === null) {
      const rows = await r.list("MfgDemandForecast", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "PartId", op: "eq", value: part.Id },
        ],
        orderBy: [{ column: "RequiredAt", dir: "asc" }],
      });
      demand = rows
        .filter((row) => row.PlantId === plantId && row.Status !== "cancelled")
        .map((row) => ({
          requiredAt: String(row.RequiredAt).slice(0, 10),
          quantity: storedNumber(row.Quantity),
          type: DEMAND_TYPES.has(row.DemandType) ? row.DemandType : "manual",
          demandRef: row.DemandRef,
          customerRef: row.CustomerRef,
        }));
      demandSource = "register";
    } else {
      if (!Array.isArray(body.Demand)) throw bad("Demand", "Demand باید آرایه‌ای از ردیف‌های تقاضا باشد");
      if (body.Demand.length > 5_000) throw bad("Demand", "حداکثر ۵۰۰۰ ردیف تقاضا در هر ارزیابی مجاز است");
      demand = body.Demand.map((line, index) => ({
        requiredAt: isoDate(line?.RequiredAt, `Demand[${index}].RequiredAt`, { required: true }),
        quantity: number(line?.Quantity, `Demand[${index}].Quantity`, { required: true, min: 0, max: 99_999_999.9999 }),
        type: parseDemandType(line?.Type, `Demand[${index}].Type`),
        demandRef: text(line?.DemandRef, `Demand[${index}].DemandRef`, { max: 60 }),
      }));
      demandSource = "request";
    }

    const [policyRow, material] = await Promise.all([
      r.findOne("MfgLotSizingPolicy", [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "PartId", op: "eq", value: part.Id },
        { column: "IsActive", op: "eq", value: true },
      ]),
      r.findOne("MfgMaterial", [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "PartId", op: "eq", value: part.Id },
        { column: "IsActive", op: "eq", value: true },
      ]),
    ]);
    /* سیاست درون‌خطی فقط برای ارزیابی خشک است؛ تاریخ اثر در پایگاه‌داده ثبت نمی‌شود. */
    const inlinePolicy = body.Policy === undefined ? null : parseLotPolicyInput(body.Policy, { allowExistingNulls: true });
    const resolved = resolveLotPolicy({ policyRow: inlinePolicy ? null : policyRow, material, override: inlinePolicy });
    const issues = runPlanning(() => validateLotSizingPolicy(resolved.engine));
    if (issues.length > 0) throw businessRule("MFG_LOT_POLICY_INVALID", `سیاست اندازه‌گذاری لات نامعتبر است: ${issues.join("؛ ")}`, { issues });

    const inventory = await inventoryForMaterial(r, plantId, material);
    const onHandQty = body.OnHandQty === undefined
      ? inventory.onHand
      : number(body.OnHandQty, "OnHandQty", { required: true, min: 0, max: 99_999_999.9999 });

    const result = runPlanning(() => computeMasterSchedule({
      partId: part.Id,
      partNo: part.PartNo,
      uom: part.BaseUom,
      buckets,
      demand,
      policy: resolved.engine,
      onHandQty,
      reservedQty: optionalNumber(body.ReservedQty, "ReservedQty", { min: 0, max: 99_999_999.9999 }) ?? inventory.reserved,
      blockedQty: optionalNumber(body.BlockedQty, "BlockedQty", { min: 0, max: 99_999_999.9999 }) ?? inventory.blocked,
      safetyStockQty: optionalNumber(body.SafetyStockQty, "SafetyStockQty", { min: 0, max: 99_999_999.9999 })
        ?? storedNumber(material?.SafetyStockQty),
      leadTimeDays: optionalNumber(body.LeadTimeDays, "LeadTimeDays", { min: 0, max: 3650, integer: true })
        ?? storedNumber(material?.LeadTimeDays),
      demandTimeFenceBuckets: optionalNumber(body.DemandTimeFenceBuckets, "DemandTimeFenceBuckets", { min: 0, max: 260, integer: true }) ?? 0,
      firmPlannedTimeFenceBuckets: optionalNumber(body.FirmPlannedTimeFenceBuckets, "FirmPlannedTimeFenceBuckets", { min: 0, max: 260, integer: true }) ?? 0,
    }));

    const eoqDetail = runPlanning(() => computeEconomicOrderQuantity(resolved.engine));
    return {
      partId: part.Id,
      partNo: part.PartNo,
      uom: result.uom,
      policySource: resolved.source,
      policyId: resolved.policyId,
      demandSource,
      lotSizingRule: result.lotSizingRule,
      eoq: eoqDetail,
      periodOrderQuantity: result.periodOrderQuantity,
      bucketUnit: result.bucketUnit,
      bucketCount: result.bucketCount,
      horizonStart: buckets[0].start,
      horizonEnd: buckets[buckets.length - 1].end,
      openingAvailableQty: result.openingAvailableQty,
      safetyStockQty: result.safetyStockQty,
      totals: result.totals,
      lines: result.lines,
    };
  }));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — برنامهٔ اصلی تولید (MPS)
   * ════════════════════════════════════════════════════════════════════════ */

  app.post(`${ROOT}/mps/runs`, route("mfg.mps.run", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["TimeBucket", "BucketCount", "HorizonStart", "PartIds", "DemandTimeFenceBuckets", "FirmPlannedTimeFenceBuckets", "ConsumeForecast", "IncludeOpenOrdersAsReceipts", "PreviewOnly"]));
    const timeBucket = text(body.TimeBucket, "TimeBucket", { max: 8 }) ?? "week";
    if (!TIME_BUCKETS.has(timeBucket)) throw bad("TimeBucket", "TimeBucket باید day/week/month باشد");
    const bucketCount = body.BucketCount === undefined ? 12 : number(body.BucketCount, "BucketCount", { required: true, min: 1, max: 260, integer: true });
    const horizonStart = isoDate(body.HorizonStart, "HorizonStart") ?? new Date().toISOString().slice(0, 10);
    const dtf = optionalNumber(body.DemandTimeFenceBuckets, "DemandTimeFenceBuckets", { min: 0, max: 260, integer: true }) ?? 0;
    const fptf = optionalNumber(body.FirmPlannedTimeFenceBuckets, "FirmPlannedTimeFenceBuckets", { min: 0, max: 260, integer: true }) ?? 0;
    if (fptf < dtf) throw businessRule("MFG_MPS_FENCE_INVALID", "حصار برنامهٔ قطعی نمی‌تواند کوتاه‌تر از حصار تقاضا باشد", { demandTimeFenceBuckets: dtf, firmPlannedTimeFenceBuckets: fptf });
    const consumeForecast = bool(body.ConsumeForecast, "ConsumeForecast", true);
    const includeOpenOrders = bool(body.IncludeOpenOrdersAsReceipts, "IncludeOpenOrdersAsReceipts", true);
    const previewOnly = bool(body.PreviewOnly, "PreviewOnly", false);

    let requestedPartIds = null;
    if (body.PartIds !== undefined) {
      if (!Array.isArray(body.PartIds) || body.PartIds.length < 1 || body.PartIds.length > 200) {
        throw bad("PartIds", "PartIds باید آرایه‌ای شامل ۱ تا ۲۰۰ شناسه باشد");
      }
      requestedPartIds = body.PartIds.map((value, index) => text(value, `PartIds[${index}]`, { required: true, max: 60, pattern: ID_RE }));
      if (new Set(requestedPartIds).size !== requestedPartIds.length) throw bad("PartIds", "شناسهٔ تکراری در PartIds مجاز نیست");
    }

    const executeMps = async (db) => {
      const buckets = runPlanning(() => buildTimeBuckets({ horizonStart, bucketUnit: timeBucket, bucketCount }));
      const [parts, demands, policies, materials, inventories, orders] = await Promise.all([
        db.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgDemandForecast", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgLotSizingPolicy", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgInventoryLevel", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      ]);
      const partById = new Map(parts.filter((item) => item.PlantId === plantId).map((item) => [item.Id, item]));
      const materialByPartId = new Map(materials.filter((item) => item.PlantId === plantId && item.IsActive).map((item) => [item.PartId, item]));
      const inventoryByMaterialId = new Map();
      for (const row of inventories) {
        if (row.PlantId !== plantId) continue;
        const list = inventoryByMaterialId.get(row.MaterialId) ?? [];
        list.push(row);
        inventoryByMaterialId.set(row.MaterialId, list);
      }
      const policiesByPartId = new Map();
      for (const row of policies) {
        if (row.PlantId !== plantId || row.IsActive !== true) continue;
        const list = policiesByPartId.get(row.PartId) ?? [];
        list.push(row);
        policiesByPartId.set(row.PartId, list);
      }

      const demandByPartId = new Map();
      for (const row of demands) {
        if (row.PlantId !== plantId || row.Status === "cancelled") continue;
        const list = demandByPartId.get(row.PartId) ?? [];
        list.push(row);
        demandByPartId.set(row.PartId, list);
      }

      const targetPartIds = requestedPartIds
        ? requestedPartIds
        : [...new Set([...demandByPartId.keys()])].sort();
      for (const partId of targetPartIds) {
        if (!partById.has(partId)) throw notFound();
      }
      if (targetPartIds.length === 0) {
        throw businessRule("MFG_MPS_NO_DEMAND", "هیچ تقاضای فعالی در این کارخانه وجود ندارد؛ ابتدا ردیف تقاضا ثبت کنید");
      }

      const runs = await db.list("MfgMasterScheduleRun", {
        where: [{ column: "PlantId", op: "eq", value: plantId }],
        orderBy: [{ column: "RunNo", dir: "desc" }],
        limit: 1,
      });
      const runNo = storedNumber(runs[0]?.RunNo, 0) + 1;
      const calculatedAt = new Date().toISOString();
      const horizonEnd = buckets[buckets.length - 1].end;

      const plannedParts = [];
      const allLines = [];
      const skippedParts = [];
      for (const partId of targetPartIds) {
        const part = partById.get(partId);
        const material = materialByPartId.get(partId) ?? null;
        const policyRow = pickEffectivePolicy(policiesByPartId.get(partId) ?? [], horizonStart);
        const resolved = resolveLotPolicy({ policyRow, material, override: null });
        const issues = runPlanning(() => validateLotSizingPolicy(resolved.engine));
        if (issues.length > 0) {
          skippedParts.push({ partId, partNo: part.PartNo, reason: `MFG_LOT_POLICY_INVALID: ${issues.join("؛ ")}` });
          continue;
        }
        const inventory = sumInventory(inventoryByMaterialId.get(material?.Id) ?? []);
        const demandRows = demandByPartId.get(partId) ?? [];
        const demand = demandRows.map((row) => ({
          requiredAt: String(row.RequiredAt).slice(0, 10),
          quantity: storedNumber(row.Quantity),
          type: DEMAND_TYPES.has(row.DemandType) ? row.DemandType : "manual",
          demandRef: row.DemandRef,
          customerRef: row.CustomerRef,
        }));
        const scheduledReceipts = includeOpenOrders
          ? orders
            .filter((order) => order.PlantId === plantId && order.PartId === partId && ["released", "in-progress"].includes(order.Status))
            .map((order) => ({
              plannedAt: storedIsoTimestamp(order.DueAt)?.slice(0, 10) ?? horizonStart,
              quantity: storedNumber(order.OrderQuantity),
              sourceRef: order.OrderNo,
            }))
          : [];

        const result = runPlanning(() => computeMasterSchedule({
          partId,
          partNo: part.PartNo,
          uom: part.BaseUom,
          buckets,
          demand,
          scheduledReceipts,
          policy: resolved.engine,
          onHandQty: inventory.onHand,
          reservedQty: inventory.reserved,
          blockedQty: inventory.blocked,
          safetyStockQty: Math.max(inventory.safety, storedNumber(material?.SafetyStockQty)),
          leadTimeDays: storedNumber(material?.LeadTimeDays),
          demandTimeFenceBuckets: dtf,
          firmPlannedTimeFenceBuckets: fptf,
          consumeForecastWithSalesOrders: consumeForecast,
        }));

        plannedParts.push({
          partId,
          partNo: part.PartNo,
          uom: result.uom,
          policySource: resolved.source,
          policyId: resolved.policyId,
          lotSizingRule: result.lotSizingRule,
          eoq: result.eoq,
          periodOrderQuantity: result.periodOrderQuantity,
          openingAvailableQty: result.openingAvailableQty,
          safetyStockQty: result.safetyStockQty,
          leadTimeBuckets: result.leadTimeBuckets,
          totals: result.totals,
          consumedDemandRefs: result.lines.flatMap((line) => (line.consumedForecastQty > 0 ? line.demandRefs : [])),
        });
        for (const line of result.lines) {
          allLines.push({ line, part, policyId: resolved.policyId, demandRows });
        }
      }

      if (plannedParts.length === 0) {
        throw businessRule("MFG_MPS_NOTHING_PLANNED", "هیچ قطعه‌ای برنامه‌ریزی نشد", { skippedParts });
      }
      if (!previewOnly && allLines.length > 20_000) {
        throw businessRule("MFG_MPS_LINE_LIMIT", `هر اجرای MPS حداکثر ۲۰٬۰۰۰ ردیف می‌سازد؛ فعلی ${allLines.length}`, { lineCount: allLines.length });
      }

      if (previewOnly) {
        return {
          previewOnly: true,
          run: null,
          timeBucket,
          bucketCount,
          horizonStart: buckets[0].start,
          horizonEnd,
          parts: plannedParts,
          skippedParts,
          lines: allLines.map(({ line, policyId }) => masterScheduleLineRow(line, { plantId, policyId })),
          totals: {
            partCount: plannedParts.length,
            lineCount: allLines.length,
            plannedOrderQty: roundTo3(allLines.reduce((sum, item) => sum + item.line.plannedOrderReceiptQty, 0)),
          },
        };
      }

      const totalPlanned = roundTo3(allLines.reduce((sum, item) => sum + item.line.plannedOrderReceiptQty, 0));
      const runRow = await db.create("MfgMasterScheduleRun", {
        PlantId: plantId,
        RunNo: runNo,
        TimeBucket: timeBucket,
        BucketCount: bucketCount,
        HorizonStart: buckets[0].start,
        HorizonEnd: horizonEnd,
        PartId: requestedPartIds && requestedPartIds.length === 1 ? requestedPartIds[0] : null,
        DemandTimeFenceBuckets: dtf,
        FirmPlannedTimeFenceBuckets: fptf,
        ConsumeForecast: consumeForecast,
        PreviewOnly: false,
        CalculatedAt: calculatedAt,
        CalculatedBy: subject.id,
        ModelVersion: MANUFACTURING_PLANNING_MODEL_VERSION,
        PartCount: plannedParts.length,
        LineCount: allLines.length,
        TotalPlannedOrderQty: totalPlanned,
        SummaryJson: { parts: plannedParts, skippedParts },
      }, subject.id);

      const persistedLines = [];
      for (const { line, policyId } of allLines) {
        const created = await db.create("MfgMasterScheduleLine",
          masterScheduleLineRow(line, { plantId, mpsRunId: runRow.Id, policyId }), subject.id);
        persistedLines.push(created);
      }

      /* مصرف پیش‌بینی با سفارش فروش در همان سطل؛ ردیف تقاضا مهرِ اجرای MPS می‌خورد
       * تا دفعهٔ بعد همان مقدار دوباره شمرده نشود. */
      const consumedByDemandId = new Map();
      for (const { line, demandRows } of allLines) {
        if (line.consumedForecastQty <= 0) continue;
        const candidates = demandRows
          .filter((row) => row.DemandType === "forecast" && String(row.RequiredAt).slice(0, 10) >= line.bucketStart && String(row.RequiredAt).slice(0, 10) < line.bucketEnd)
          .sort((left, right) => String(left.RequiredAt).localeCompare(String(right.RequiredAt)) || String(left.DemandRef).localeCompare(String(right.DemandRef)));
        let remaining = line.consumedForecastQty;
        for (const row of candidates) {
          if (remaining <= 0) break;
          const already = storedNumber(consumedByDemandId.get(row.Id)?.consumed ?? row.ConsumedQuantity);
          const room = Math.max(0, storedNumber(row.Quantity) - already);
          const applied = roundTo3(Math.min(room, remaining));
          if (applied <= 0) continue;
          consumedByDemandId.set(row.Id, { row, consumed: roundTo3(already + applied) });
          remaining = roundTo3(remaining - applied);
        }
      }
      for (const { row, consumed } of consumedByDemandId.values()) {
        const patchRes = await db.patch("MfgDemandForecast", row.Id, {
          ConsumedQuantity: consumed,
          MpsRunId: runRow.Id,
        }, subject.id, row.RowVersion);
        if (!patchRes.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "ردیف تقاضا هم‌زمان تغییر کرده است؛ اجرای MPS لغو شد");
      }

      await createAuditRecord(db, req, "MFG_MPS_RUN_CREATED", "MfgMasterScheduleRun", runRow.Id, "mfg.mps.run", {
        runNo,
        timeBucket,
        bucketCount,
        horizonStart: buckets[0].start,
        horizonEnd,
        partCount: plannedParts.length,
        lineCount: allLines.length,
        totalPlannedOrderQty: totalPlanned,
      });

      return {
        previewOnly: false,
        run: runRow,
        timeBucket,
        bucketCount,
        horizonStart: buckets[0].start,
        horizonEnd,
        parts: plannedParts,
        skippedParts,
        lines: persistedLines,
        totals: { partCount: plannedParts.length, lineCount: persistedLines.length, plannedOrderQty: totalPlanned },
      };
    };

    return previewOnly ? executeMps(r) : r.transaction((tx) => executeMps(tx));
  }, 201));

  app.get(`${ROOT}/mps/runs`, route("mfg.mps.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["timeBucket", "partId", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.timeBucket !== undefined) {
      const timeBucket = text(q.timeBucket, "timeBucket", { required: true, max: 8 });
      if (!TIME_BUCKETS.has(timeBucket)) throw bad("timeBucket", "timeBucket باید day/week/month باشد");
      where.push({ column: "TimeBucket", op: "eq", value: timeBucket });
    }
    if (q.partId !== undefined) where.push({ column: "PartId", op: "eq", value: text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE }) });
    const [items, total] = await Promise.all([
      r.list("MfgMasterScheduleRun", { where, orderBy: [{ column: "RunNo", dir: "desc" }], limit, offset }),
      r.count("MfgMasterScheduleRun", where),
    ]);
    return { items, page: { limit, offset, total } };
  }));

  app.get(`${ROOT}/mps/runs/:runId`, route("mfg.mps.view", async ({ repo: r, req, plantId }) => {
    const runId = text(req.params.runId, "runId", { required: true, max: 60, pattern: ID_RE });
    const run = await r.get("MfgMasterScheduleRun", runId);
    if (!run || run.PlantId !== plantId) throw notFound();
    return run;
  }));

  app.get(`${ROOT}/mps/runs/:runId/lines`, route("mfg.mps.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "onlyPlannedOrders", "limit", "offset"]));
    const runId = text(req.params.runId, "runId", { required: true, max: 60, pattern: ID_RE });
    const run = await r.get("MfgMasterScheduleRun", runId);
    if (!run || run.PlantId !== plantId) throw notFound();
    const limit = pageNumber(q.limit, "limit", 200, 2000);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const where = [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "MpsRunId", op: "eq", value: run.Id },
    ];
    if (q.partId !== undefined) where.push({ column: "PartId", op: "eq", value: text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE }) });
    const [rows, total] = await Promise.all([
      r.list("MfgMasterScheduleLine", { where, orderBy: [{ column: "PartId", dir: "asc" }, { column: "BucketIndex", dir: "asc" }], limit, offset }),
      r.count("MfgMasterScheduleLine", where),
    ]);
    const items = q.onlyPlannedOrders === "true"
      ? rows.filter((row) => storedNumber(row.PlannedOrderReceiptQty) > 0)
      : rows;
    const [parts] = await Promise.all([r.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] })]);
    const partById = new Map(parts.filter((item) => item.PlantId === plantId).map((item) => [item.Id, item]));
    return {
      run: { Id: run.Id, RunNo: run.RunNo, TimeBucket: run.TimeBucket, BucketCount: run.BucketCount, HorizonStart: run.HorizonStart, HorizonEnd: run.HorizonEnd },
      items: items.map((row) => ({ ...row, PartNo: partById.get(row.PartId)?.PartNo ?? null, PartNameFa: partById.get(row.PartId)?.NameFa ?? null })),
      page: { limit, offset, total, returned: items.length },
    };
  }));

  app.post(`${ROOT}/mps/runs/:runId/firm`, route("mfg.mps.firm", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["PartId", "ThroughBucketIndex", "Firm"]));
    const expectedVersion = rowVersionFrom(req);
    const runId = text(req.params.runId, "runId", { required: true, max: 60, pattern: ID_RE });
    const firm = bool(body.Firm, "Firm", true);
    const throughBucketIndex = optionalNumber(body.ThroughBucketIndex, "ThroughBucketIndex", { min: 0, max: 260, integer: true });

    return r.transaction(async (tx) => {
      const run = await tx.get("MfgMasterScheduleRun", runId);
      if (!run || run.PlantId !== plantId) throw notFound();
      if (run.RowVersion !== expectedVersion) throw conflict("MFG_ROW_VERSION_CONFLICT", "اجرای MPS از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      if (run.PreviewOnly === true) throw conflict("MFG_STATE_CONFLICT", "اجرای پیش‌نمایش رکوردی ندارد که قطعی شود");

      const where = [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "MpsRunId", op: "eq", value: run.Id },
      ];
      if (body.PartId !== undefined) {
        const partId = text(body.PartId, "PartId", { required: true, max: 60, pattern: ID_RE });
        const part = await tx.get("MfgPart", partId);
        if (!part || part.PlantId !== plantId) throw notFound();
        where.push({ column: "PartId", op: "eq", value: partId });
      }
      const lines = await tx.list("MfgMasterScheduleLine", { where, orderBy: [{ column: "PartId", dir: "asc" }, { column: "BucketIndex", dir: "asc" }] });
      if (lines.length === 0) throw notFound();

      /* حصار اجرا بر حسب تعداد سطل است؛ اندیس آخرین سطل درون حصار
       * یک کمتر از خود حصار است. حصار صفر یعنی هیچ سطلی قطعی نیست
       * و باید صریحاً بازه خواسته شود، نه اینکه سطل صفر بی‌سروصدا قطعی شود. */
      const runFenceIndex = storedNumber(run.FirmPlannedTimeFenceBuckets) - 1;
      if (throughBucketIndex === null && runFenceIndex < 0) {
        throw businessRule("MFG_MPS_FENCE_EMPTY", "حصار برنامهٔ قطعی این اجرا صفر است؛ ThroughBucketIndex را صریح بفرستید", {
          firmPlannedTimeFenceBuckets: run.FirmPlannedTimeFenceBuckets,
        });
      }
      const fence = throughBucketIndex ?? runFenceIndex;
      const targets = lines.filter((line) => storedNumber(line.BucketIndex) <= fence && storedNumber(line.PlannedOrderReceiptQty) > 0);
      if (targets.length === 0) {
        throw businessRule("MFG_MPS_NOTHING_TO_FIRM", "در این حصار هیچ سفارش برنامه‌ریزی‌شده‌ای برای قطعی‌کردن وجود ندارد", { throughBucketIndex: fence });
      }
      const updated = [];
      for (const line of targets) {
        if (line.IsFirm === firm) {
          updated.push(line);
          continue;
        }
        const patchRes = await tx.patch("MfgMasterScheduleLine", line.Id, { IsFirm: firm }, subject.id, line.RowVersion);
        if (!patchRes.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "ردیف MPS هم‌زمان تغییر کرده است");
        updated.push(await tx.get("MfgMasterScheduleLine", line.Id));
      }
      const patchRes = await tx.patch("MfgMasterScheduleRun", run.Id, {
        SummaryJson: { ...(run.SummaryJson ?? {}), lastFirmAction: { at: new Date().toISOString(), by: subject.id, firm, throughBucketIndex: fence, lineCount: updated.length } },
      }, subject.id, expectedVersion);
      if (!patchRes.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "اجرای MPS هم‌زمان تغییر کرده است");
      await createAuditRecord(tx, req, "MFG_MPS_LINES_FIRMED", "MfgMasterScheduleRun", run.Id, "mfg.mps.firm", {
        runNo: run.RunNo,
        firm,
        throughBucketIndex: fence,
        lineCount: updated.length,
      });
      return { run: await tx.get("MfgMasterScheduleRun", run.Id), firmedLineCount: updated.length, throughBucketIndex: fence, firm, lines: updated };
    });
  }));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — قابلیت تعهد تحویل به مشتری (ATP)
   * ════════════════════════════════════════════════════════════════════════ */

  app.post(`${ROOT}/atp/checks`, route("mfg.atp.check", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["PartId", "RequestedQty", "RequestedAt", "Mode", "IncludeSafetyStock", "IncludeForecast", "IncludePlannedOrders", "IncludeCapacity", "BucketUnit", "HorizonStart", "BucketCount", "LeadTimeDays", "CustomerRef", "Persist"]));
    const partId = text(body.PartId, "PartId", { required: true, max: 60, pattern: ID_RE });
    const requestedQty = number(body.RequestedQty, "RequestedQty", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    const requestedAt = isoDate(body.RequestedAt, "RequestedAt", { required: true });
    const mode = text(body.Mode, "Mode", { max: 12 }) ?? "cumulative";
    if (!ATP_MODES.has(mode)) throw bad("Mode", "Mode باید discrete یا cumulative باشد");
    const includeSafetyStock = bool(body.IncludeSafetyStock, "IncludeSafetyStock", true);
    const includeForecast = bool(body.IncludeForecast, "IncludeForecast", false);
    const includePlannedOrders = bool(body.IncludePlannedOrders, "IncludePlannedOrders", true);
    const includeCapacity = bool(body.IncludeCapacity, "IncludeCapacity", true);
    const persist = bool(body.Persist, "Persist", true);
    const bucketUnit = text(body.BucketUnit, "BucketUnit", { max: 8 }) ?? "week";
    if (!TIME_BUCKETS.has(bucketUnit)) throw bad("BucketUnit", "BucketUnit باید day/week/month باشد");
    const bucketCount = body.BucketCount === undefined ? 12 : number(body.BucketCount, "BucketCount", { required: true, min: 1, max: 260, integer: true });
    const horizonStart = isoDate(body.HorizonStart, "HorizonStart") ?? new Date().toISOString().slice(0, 10);
    const leadTimeDays = optionalNumber(body.LeadTimeDays, "LeadTimeDays", { min: 0, max: 3650, integer: true });
    const customerRef = text(body.CustomerRef, "CustomerRef", { max: 80 });

    const compute = async (db) => {
      const [part, material, inventories, demands, orders, latestRuns] = await Promise.all([
        db.get("MfgPart", partId),
        db.findOne("MfgMaterial", [{ column: "PlantId", op: "eq", value: plantId }, { column: "PartId", op: "eq", value: partId }, { column: "IsActive", op: "eq", value: true }]),
        db.list("MfgInventoryLevel", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgDemandForecast", { where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "PartId", op: "eq", value: partId }] }),
        db.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "PartId", op: "eq", value: partId }] }),
        db.list("MfgMasterScheduleRun", { where: [{ column: "PlantId", op: "eq", value: plantId }], orderBy: [{ column: "RunNo", dir: "desc" }], limit: 1 }),
      ]);
      if (!part || part.PlantId !== plantId) throw notFound();
      const buckets = runPlanning(() => buildTimeBuckets({ horizonStart, bucketUnit, bucketCount }));
      const inventory = sumInventory(inventories.filter((row) => row.PlantId === plantId && material && row.MaterialId === material.Id));
      const effectiveLeadTimeDays = leadTimeDays ?? storedNumber(material?.LeadTimeDays);

      /* ATP فقط در برابر تقاضای متعهدشده سنجیده می‌شود؛ پیش‌بینی به‌صورت اختیاری. */
      const committedTypes = new Set(includeForecast ? ["sales-order", "forecast", "contract", "manual"] : ["sales-order", "contract", "manual"]);
      const demandBuckets = buckets.map(() => 0);
      for (const row of demands) {
        if (row.PlantId !== plantId || row.Status === "cancelled") continue;
        if (!committedTypes.has(row.DemandType)) continue;
        const index = buckets.findIndex((bucket) => {
          const day = String(row.RequiredAt).slice(0, 10);
          return day >= bucket.start && day < bucket.end;
        });
        if (index < 0) continue;
        demandBuckets[index] = roundTo3(demandBuckets[index] + storedNumber(row.Quantity));
      }

      const supplyBuckets = buckets.map(() => 0);
      const supplyRefs = buckets.map(() => []);
      for (const order of orders) {
        if (order.PlantId !== plantId || !["released", "in-progress"].includes(order.Status)) continue;
        const day = storedIsoTimestamp(order.DueAt)?.slice(0, 10);
        const index = day ? buckets.findIndex((bucket) => day >= bucket.start && day < bucket.end) : -1;
        if (index < 0) continue;
        supplyBuckets[index] = roundTo3(supplyBuckets[index] + storedNumber(order.OrderQuantity));
        supplyRefs[index].push(order.OrderNo);
      }
      let mpsRunId = null;
      if (includePlannedOrders && latestRuns[0]) {
        mpsRunId = latestRuns[0].Id;
        const plannedLines = await db.list("MfgMasterScheduleLine", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "MpsRunId", op: "eq", value: latestRuns[0].Id },
            { column: "PartId", op: "eq", value: partId },
          ],
        });
        for (const line of plannedLines) {
          const qty = storedNumber(line.PlannedOrderReceiptQty);
          if (qty <= 0) continue;
          const index = buckets.findIndex((bucket) => String(line.BucketStart) === bucket.start);
          if (index < 0) continue;
          supplyBuckets[index] = roundTo3(supplyBuckets[index] + qty);
          supplyRefs[index].push(`MPS-${latestRuns[0].RunNo}`);
        }
      }

      const atp = runPlanning(() => computeAvailableToPromise({
        onHandQty: inventory.onHand,
        reservedQty: inventory.reserved,
        blockedQty: inventory.blocked,
        safetyStockQty: Math.max(inventory.safety, storedNumber(material?.SafetyStockQty)),
        includeSafetyStock,
        mode,
        buckets: buckets.map((bucket, index) => ({
          bucketStart: bucket.start,
          bucketEnd: bucket.end,
          demandQty: demandBuckets[index],
          supplyQty: supplyBuckets[index],
        })),
      }));
      const check = runPlanning(() => checkAtpPromise({ atp, requestedQty, requestedAt, leadTimeDays: effectiveLeadTimeDays }));

      /* ۱۱.۸ — موجودی تنها نیمی از پاسخ است. ظرفیت آزاد مراکز کاریِ Routing
       * قطعه هم سنجیده می‌شود و وعدهٔ نهایی دیرترِ این دو است. */
      let capacity = { considered: false, constrained: false, requestedBucketIndex: null, promiseBucketIndex: null, promiseAt: null, centers: [], message: null };
      if (includeCapacity) {
        const [workCenters, resources, routings, allOperations, schedules] = await Promise.all([
          db.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
          db.list("MfgWorkCenterResource", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
          db.list("MfgRouting", { where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "PartId", op: "eq", value: partId }] }),
          db.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
          db.list("MfgOperationSchedule", { where: [{ column: "PlantId", op: "eq", value: plantId }], orderBy: [{ column: "ScheduleVersion", dir: "desc" }] }),
        ]);
        const routing = routings.find((row) => row.PlantId === plantId && row.Status === "released" && row.IsDefault === true)
          ?? routings.find((row) => row.PlantId === plantId && row.Status === "released")
          ?? null;
        const routingOperations = routing
          ? await db.list("MfgRoutingOperation", {
            where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "RoutingId", op: "eq", value: routing.Id }],
            orderBy: [{ column: "SequenceNo", dir: "asc" }],
          })
          : [];

        /* بار فعلی: عملیات سفارش‌های باز در پنجرهٔ زمان‌بندی‌شده‌شان، پخش‌شده
         * روی سطل‌هایی که آن پنجره می‌پوشاند. */
        const openOrderIds = new Set(
          (await db.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }))
            .filter((order) => ["released", "in-progress"].includes(order.Status))
            .map((order) => order.Id),
        );
        const latestScheduleVersion = schedules.find((row) => row.PlantId === plantId)?.ScheduleVersion ?? null;
        const windows = new Map();
        for (const segment of schedules) {
          if (segment.PlantId !== plantId || latestScheduleVersion === null || segment.ScheduleVersion !== latestScheduleVersion) continue;
          if (segment.Status === "cancelled") continue;
          const start = storedIsoTimestamp(segment.PlannedStartAt);
          const end = storedIsoTimestamp(segment.PlannedEndAt);
          if (!start || !end) continue;
          /* storedIsoTimestamp رشتهٔ ISO می‌دهد؛ Math.min روی رشته NaN می‌سازد و
           * بعداً toISOString با RangeError می‌ترکد. ISOهای UTC با مقایسهٔ
           * رشته‌ای مرتب می‌شوند — همان کاری که runCrp می‌کند. */
          const existing = windows.get(segment.ProductionOrderOperationId);
          windows.set(segment.ProductionOrderOperationId, {
            plannedStartAt: existing && existing.plannedStartAt < start ? existing.plannedStartAt : start,
            plannedEndAt: existing && existing.plannedEndAt > end ? existing.plannedEndAt : end,
          });
        }
        const loadedMinutesByCenterBucket = new Map();
        for (const op of allOperations) {
          if (op.PlantId !== plantId || !openOrderIds.has(op.ProductionOrderId)) continue;
          const minutes = storedNumber(op.PlannedCapacityMinutes, 0);
          if (minutes <= 0) continue;
          const window = windows.get(op.Id);
          /* مقدار از پیش رشتهٔ ISO است؛ روز آن با slice گرفته می‌شود. */
          const startDay = window ? String(window.plannedStartAt).slice(0, 10) : null;
          const endDay = window ? String(window.plannedEndAt).slice(0, 10) : null;
          let from = startDay ? buckets.findIndex((bucket) => startDay >= bucket.start && startDay < bucket.end) : 0;
          let to = endDay ? buckets.findIndex((bucket) => endDay >= bucket.start && endDay < bucket.end) : from;
          if (from < 0) from = 0;
          if (to < from) to = from;
          to = Math.min(buckets.length - 1, to);
          const perBucket = roundTo3(minutes / (to - from + 1));
          const list = loadedMinutesByCenterBucket.get(op.WorkCenterId) ?? buckets.map(() => 0);
          for (let index = from; index <= to; index += 1) list[index] = roundTo3(list[index] + perBucket);
          loadedMinutesByCenterBucket.set(op.WorkCenterId, list);
        }

        capacity = atpCapacityCheck({
          buckets, requestedQty, requestedAt, routingOperations,
          workCenters: workCenters.filter((row) => row.PlantId === plantId && row.Status !== "inactive"),
          resources: resources.filter((row) => row.PlantId === plantId),
          loadedMinutesByCenterBucket,
        });
      }

      /* وعدهٔ نهایی: دیرترِ وعدهٔ موجودی و وعدهٔ ظرفیت. اگر ظرفیت هیچ سطلی
       * کافی نداشت، وعدهٔ موجودی دست‌نخورده می‌ماند و فقط هشدار ظرفیت می‌آید. */
      let promisedAt = check.promisedAt;
      let promiseConstrainedByCapacity = false;
      /* فقط وقتی مقید است که سطلِ درخواستی جا نداشته باشد. وعدهٔ ظرفیت انتهای
       * سطل است و وعدهٔ موجودی یک تاریخ دقیق؛ مقایسهٔ بی‌قیدِ این دو، ظرفیتِ
       * کافی را هم «مقید» نشان می‌داد. */
      if (capacity.considered && capacity.constrained && capacity.promiseAt) {
        if (!promisedAt || capacity.promiseAt > promisedAt) {
          promisedAt = capacity.promiseAt;
          promiseConstrainedByCapacity = true;
        }
      }

      let persisted = null;
      if (persist) {
        persisted = await db.create("MfgAtpCheck", {
          PlantId: plantId,
          PartId: part.Id,
          RequestedQty: roundTo3(requestedQty),
          RequestedAt: requestedAt,
          Mode: mode,
          Result: check.status,
          PromisedQty: roundTo3(check.promisedQty),
          ShortageQty: roundTo3(check.shortageQty),
          PromisedAt: check.promisedAt,
          DelayBuckets: check.delayBuckets,
          SourceBucketStart: check.sourceBucketStart,
          OpeningAvailableQty: atp.openingAvailableQty,
          IncludeSafetyStock: includeSafetyStock,
          LeadTimeDays: effectiveLeadTimeDays,
          BucketCount: atp.buckets.length,
          CheckedAt: new Date().toISOString(),
          CheckedBy: subject.id,
          ModelVersion: MANUFACTURING_PLANNING_MODEL_VERSION,
          CustomerRef: customerRef,
          MessageFa: capacity.constrained && capacity.message ? capacity.message : check.message,
          DetailJson: {
            buckets: atp.buckets,
            totals: atp.totals,
            mpsRunId,
            supplyRefs,
            /* ۱۱.۸ — قید ظرفیت هم در رکورد می‌ماند تا بعداً قابل بازخوانی باشد. */
            includeCapacity,
            capacity: {
              considered: capacity.considered,
              constrained: capacity.constrained,
              promiseBucketIndex: capacity.promiseBucketIndex,
              promiseAt: capacity.promiseAt,
              centers: capacity.centers.map((center) => ({
                workCenterId: center.workCenterId,
                code: center.code,
                requiredMinutes: center.requiredMinutes,
                freeMinutesByBucket: center.buckets.map((row) => row.freeMinutes),
                sufficientByBucket: center.buckets.map((row) => row.sufficient),
              })),
            },
            promisedAt,
            promiseConstrainedByCapacity,
          },
        }, subject.id);
        await createAuditRecord(db, req, "MFG_ATP_CHECKED", "MfgAtpCheck", persisted.Id, "mfg.atp.check", {
          partNo: part.PartNo,
          requestedQty: roundTo3(requestedQty),
          requestedAt,
          result: check.status,
          promisedAt: check.promisedAt,
          shortageQty: roundTo3(check.shortageQty),
        });
      }

      return {
        partId: part.Id,
        partNo: part.PartNo,
        uom: part.BaseUom,
        mode,
        includeSafetyStock,
        includeForecast,
        includePlannedOrders,
        includeCapacity,
        mpsRunId,
        leadTimeDays: effectiveLeadTimeDays,
        bucketUnit,
        horizonStart: buckets[0].start,
        horizonEnd: buckets[buckets.length - 1].end,
        openingAvailableQty: atp.openingAvailableQty,
        buckets: atp.buckets,
        totals: atp.totals,
        check,
        /* ۱۱.۸ — ظرفیت آزاد مراکز کاری و وعدهٔ نهاییِ حاصل از هر دو قید. */
        capacity,
        promisedAt,
        promiseConstrainedByCapacity,
        record: persisted,
      };
    };

    return persist ? r.transaction((tx) => compute(tx)) : compute(r);
  }, 201));

  app.get(`${ROOT}/atp/checks`, route("mfg.atp.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "result", "mode", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    if (limit < 1) throw bad("limit", "limit باید بین ۱ و ۲۰۰ باشد");
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.partId !== undefined) {
      const partId = text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE });
      const part = await r.get("MfgPart", partId);
      if (!part || part.PlantId !== plantId) throw notFound();
      where.push({ column: "PartId", op: "eq", value: partId });
    }
    if (q.result !== undefined) {
      const result = text(q.result, "result", { required: true, max: 12 });
      if (!["available", "delayed", "unavailable"].includes(result)) throw bad("result", "result باید available/delayed/unavailable باشد");
      where.push({ column: "Result", op: "eq", value: result });
    }
    if (q.mode !== undefined) {
      const mode = text(q.mode, "mode", { required: true, max: 12 });
      if (!ATP_MODES.has(mode)) throw bad("mode", "mode باید discrete یا cumulative باشد");
      where.push({ column: "Mode", op: "eq", value: mode });
    }
    const [items, total] = await Promise.all([
      r.list("MfgAtpCheck", { where, orderBy: [{ column: "CheckedAt", dir: "desc" }], limit, offset }),
      r.count("MfgAtpCheck", where),
    ]);
    return { items, page: { limit, offset, total } };
  }));

  app.get(`${ROOT}/atp/summary`, route("mfg.atp.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "mode", "includeSafetyStock", "includeForecast", "includePlannedOrders", "bucketUnit", "horizonStart", "bucketCount"]));
    const partId = text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE });
    const part = await r.get("MfgPart", partId);
    if (!part || part.PlantId !== plantId) throw notFound();
    const mode = text(q.mode, "mode", { max: 12 }) ?? "cumulative";
    if (!ATP_MODES.has(mode)) throw bad("mode", "mode باید discrete یا cumulative باشد");
    const includeSafetyStock = q.includeSafetyStock !== "false";
    const includeForecast = q.includeForecast === "true";
    const includePlannedOrders = q.includePlannedOrders !== "false";
    const bucketUnit = text(q.bucketUnit, "bucketUnit", { max: 8 }) ?? "week";
    if (!TIME_BUCKETS.has(bucketUnit)) throw bad("bucketUnit", "bucketUnit باید day/week/month باشد");
    const bucketCount = pageNumber(q.bucketCount, "bucketCount", 12, 260);
    if (bucketCount < 1 || bucketCount > 260) throw bad("bucketCount", "bucketCount باید بین ۱ و ۲۶۰ باشد");
    const horizonStart = isoDate(q.horizonStart, "horizonStart") ?? new Date().toISOString().slice(0, 10);

    const [material, inventories, demands, orders, latestRuns] = await Promise.all([
      r.findOne("MfgMaterial", [{ column: "PlantId", op: "eq", value: plantId }, { column: "PartId", op: "eq", value: partId }, { column: "IsActive", op: "eq", value: true }]),
      r.list("MfgInventoryLevel", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgDemandForecast", { where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "PartId", op: "eq", value: partId }] }),
      r.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "PartId", op: "eq", value: partId }] }),
      r.list("MfgMasterScheduleRun", { where: [{ column: "PlantId", op: "eq", value: plantId }], orderBy: [{ column: "RunNo", dir: "desc" }], limit: 1 }),
    ]);
    const buckets = runPlanning(() => buildTimeBuckets({ horizonStart, bucketUnit, bucketCount }));
    const inventory = sumInventory(inventories.filter((row) => row.PlantId === plantId && material && row.MaterialId === material.Id));
    const committedTypes = new Set(includeForecast ? ["sales-order", "forecast", "contract", "manual"] : ["sales-order", "contract", "manual"]);

    const demandBuckets = buckets.map(() => 0);
    for (const row of demands) {
      if (row.PlantId !== plantId || row.Status === "cancelled" || !committedTypes.has(row.DemandType)) continue;
      const day = String(row.RequiredAt).slice(0, 10);
      const index = buckets.findIndex((bucket) => day >= bucket.start && day < bucket.end);
      if (index < 0) continue;
      demandBuckets[index] = roundTo3(demandBuckets[index] + storedNumber(row.Quantity));
    }
    const supplyBuckets = buckets.map(() => 0);
    for (const order of orders) {
      if (order.PlantId !== plantId || !["released", "in-progress"].includes(order.Status)) continue;
      const day = storedIsoTimestamp(order.DueAt)?.slice(0, 10);
      const index = day ? buckets.findIndex((bucket) => day >= bucket.start && day < bucket.end) : -1;
      if (index < 0) continue;
      supplyBuckets[index] = roundTo3(supplyBuckets[index] + storedNumber(order.OrderQuantity));
    }
    if (includePlannedOrders && latestRuns[0]) {
      const plannedLines = await r.list("MfgMasterScheduleLine", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "MpsRunId", op: "eq", value: latestRuns[0].Id },
          { column: "PartId", op: "eq", value: partId },
        ],
      });
      for (const line of plannedLines) {
        const index = buckets.findIndex((bucket) => String(line.BucketStart) === bucket.start);
        if (index < 0) continue;
        supplyBuckets[index] = roundTo3(supplyBuckets[index] + storedNumber(line.PlannedOrderReceiptQty));
      }
    }

    const atp = runPlanning(() => computeAvailableToPromise({
      onHandQty: inventory.onHand,
      reservedQty: inventory.reserved,
      blockedQty: inventory.blocked,
      safetyStockQty: Math.max(inventory.safety, storedNumber(material?.SafetyStockQty)),
      includeSafetyStock,
      mode,
      buckets: buckets.map((bucket, index) => ({
        bucketStart: bucket.start,
        bucketEnd: bucket.end,
        demandQty: demandBuckets[index],
        supplyQty: supplyBuckets[index],
      })),
    }));
    return {
      partId: part.Id,
      partNo: part.PartNo,
      partNameFa: part.NameFa,
      uom: part.BaseUom,
      mode,
      includeSafetyStock,
      includeForecast,
      includePlannedOrders,
      mpsRunId: includePlannedOrders ? latestRuns[0]?.Id ?? null : null,
      bucketUnit,
      horizonStart: buckets[0].start,
      horizonEnd: buckets[buckets.length - 1].end,
      openingAvailableQty: atp.openingAvailableQty,
      buckets: atp.buckets,
      totals: atp.totals,
    };
  }));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — تقسیم لات و هم‌پوشانی عملیات (Splitting & Overlapping)
   * ════════════════════════════════════════════════════════════════════════ */

  app.get(`${ROOT}/orders/:orderId/operations/:operationId/splits`, route("mfg.order.view", async ({ repo: r, req, plantId }) => {
    const { order, operation } = await loadOrderOperation(r, plantId, req.params);
    const lots = await r.list("MfgOperationSplitLot", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "ProductionOrderOperationId", op: "eq", value: operation.Id },
      ],
      orderBy: [{ column: "SplitNo", dir: "asc" }],
    });
    return {
      order: { Id: order.Id, OrderNo: order.OrderNo, Status: order.Status },
      operation: {
        Id: operation.Id,
        OperationCode: operation.OperationCode,
        SequenceNo: operation.SequenceNo,
        Status: operation.Status,
        PlannedQuantity: storedNumber(operation.PlannedQuantity),
        PlannedSetupMinutes: storedNumber(operation.PlannedSetupMinutes),
        PlannedRunMinutesPerUnit: storedNumber(operation.PlannedRunMinutesPerUnit),
        OverlapAllowed: operation.OverlapAllowed === true,
        TransferBatchQty: operation.TransferBatchQty ?? null,
        OverlapPct: operation.OverlapPct ?? null,
        SplitLotCount: operation.SplitLotCount ?? null,
        effectiveTransferBatchQty: runPlanning(() => resolveTransferBatchQty({
          quantity: storedNumber(operation.PlannedQuantity),
          overlapAllowed: operation.OverlapAllowed === true,
          transferBatchQty: operation.TransferBatchQty,
          overlapPct: operation.OverlapPct,
        })),
      },
      lots,
    };
  }));

  app.post(`${ROOT}/orders/:orderId/operations/:operationId/splits`, route("mfg.split.edit", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["SplitLotCount", "TransferBatchQty", "OverlapPct", "OverlapAllowed", "MinLotQty", "NoteFa"]));
    const { order, operation } = await loadOrderOperation(r, plantId, req.params);
    if (!["created", "released", "in-progress"].includes(order.Status)) {
      throw conflict("MFG_STATE_CONFLICT", `سفارش در وضعیت ${order.Status} قابل تقسیم لات نیست`);
    }
    if (!["pending", "queued", "ready"].includes(operation.Status)) {
      throw conflict("MFG_STATE_CONFLICT", `عملیات ${operation.OperationCode} در وضعیت ${operation.Status} قابل تقسیم نیست`);
    }

    const orderQuantity = storedNumber(operation.PlannedQuantity);
    const splitLotCount = optionalNumber(body.SplitLotCount, "SplitLotCount", { min: 1, max: 50, integer: true });
    const transferBatchQty = body.TransferBatchQty === undefined ? null
      : (body.TransferBatchQty === null ? null : number(body.TransferBatchQty, "TransferBatchQty", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 }));
    const overlapPct = body.OverlapPct === undefined ? null
      : (body.OverlapPct === null ? null : number(body.OverlapPct, "OverlapPct", { required: true, min: 0.001, max: 99.999 }));
    const overlapAllowed = body.OverlapAllowed === undefined ? operation.OverlapAllowed === true : bool(body.OverlapAllowed, "OverlapAllowed", false);
    const minLotQty = optionalNumber(body.MinLotQty, "MinLotQty", { min: 0, max: 99_999_999.9999 });
    const splitNote = text(body.NoteFa, "NoteFa", { max: 400 });

    const plan = runPlanning(() => computeSplitLots({
      orderQuantity,
      splitLotCount: splitLotCount ?? operation.SplitLotCount ?? 1,
      transferBatchQty: transferBatchQty ?? operation.TransferBatchQty,
      minLotQty: minLotQty ?? 0,
    }));
    if (overlapAllowed && transferBatchQty === null && overlapPct === null && !operation.TransferBatchQty && !operation.OverlapPct) {
      throw businessRule("MFG_SPLIT_OVERLAP_INPUT_MISSING", "برای فعال‌کردن هم‌پوشانی باید TransferBatchQty یا OverlapPct تعیین شود", {
        operationId: operation.Id,
      });
    }
    if (transferBatchQty !== null && transferBatchQty >= orderQuantity) {
      throw businessRule("MFG_SPLIT_TRANSFER_BATCH_TOO_LARGE", `لات انتقال (${transferBatchQty}) باید از مقدار عملیات (${orderQuantity}) کمتر باشد`, {
        operationId: operation.Id,
      });
    }

    return r.transaction(async (tx) => {
      const existingLots = await tx.list("MfgOperationSplitLot", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "ProductionOrderOperationId", op: "eq", value: operation.Id },
        ],
      });
      const started = existingLots.filter((lot) => lot.Status !== "planned" && lot.Status !== "cancelled");
      if (started.length > 0) {
        throw conflict("MFG_STATE_CONFLICT", `${started.length} لات تقسیم‌شده از قبل شروع یا تمام شده است؛ تقسیم جدید مجاز نیست`);
      }
      for (const lot of existingLots) {
        const removed = await tx.remove("MfgOperationSplitLot", lot.Id);
        if (!removed || removed.affected !== 1) throw conflict("MFG_STATE_CONFLICT", "لات تقسیم‌شده هم‌زمان تغییر کرده است");
      }

      const created = [];
      for (const lot of plan.lots) {
        created.push(await tx.create("MfgOperationSplitLot", {
          PlantId: plantId,
          ProductionOrderOperationId: operation.Id,
          SplitNo: lot.splitNo,
          Quantity: roundTo3(lot.quantity),
          CumulativeQuantity: roundTo3(lot.cumulativeQuantity),
          IsTransferBatch: lot.splitNo === 1 && plan.transferBatchQty !== null,
          Status: "planned",
          StartedAt: null,
          CompletedAt: null,
          NoteFa: splitNote,
        }, subject.id));
      }

      const patch = {
        SplitLotCount: plan.effectiveSplitCount,
        OverlapAllowed: overlapAllowed,
        TransferBatchQty: transferBatchQty ?? (overlapAllowed ? operation.TransferBatchQty ?? null : null),
        OverlapPct: overlapAllowed ? (overlapPct ?? operation.OverlapPct ?? null) : null,
      };
      const patchRes = await tx.patch("MfgProductionOrderOperation", operation.Id, patch, subject.id, operation.RowVersion);
      if (!patchRes.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "عملیات هم‌زمان تغییر کرده است؛ تازه‌خوانی کنید");
      await createAuditRecord(tx, req, "MFG_OPERATION_SPLIT", "MfgProductionOrderOperation", operation.Id, "mfg.split.edit", {
        orderNo: order.OrderNo,
        operationCode: operation.OperationCode,
        splitLotCount: plan.effectiveSplitCount,
        transferBatchQty: patch.TransferBatchQty,
        overlapPct: patch.OverlapPct,
        overlapAllowed,
        notes: plan.notes,
      });
      return {
        order: { Id: order.Id, OrderNo: order.OrderNo },
        operation: await tx.get("MfgProductionOrderOperation", operation.Id),
        plan: {
          orderQuantity: plan.orderQuantity,
          requestedSplitCount: plan.requestedSplitCount,
          effectiveSplitCount: plan.effectiveSplitCount,
          transferBatchQty: plan.transferBatchQty,
          minLotQty: plan.minLotQty,
          notes: plan.notes,
        },
        lots: created,
      };
    });
  }, 201));

  app.delete(`${ROOT}/operation-splits/:splitLotId`, route("mfg.split.edit", async ({ repo: r, req, plantId, subject }) => {
    const splitLotId = text(req.params.splitLotId, "splitLotId", { required: true, max: 60, pattern: ID_RE });
    return r.transaction(async (tx) => {
      const lot = await tx.get("MfgOperationSplitLot", splitLotId);
      if (!lot || lot.PlantId !== plantId) throw notFound();
      if (lot.Status !== "planned") {
        throw conflict("MFG_STATE_CONFLICT", `لات در وضعیت ${lot.Status} قابل حذف نیست`);
      }
      const removed = await tx.remove("MfgOperationSplitLot", lot.Id);
      if (!removed || removed.affected !== 1) throw conflict("MFG_STATE_CONFLICT", "لات تقسیم‌شده هم‌زمان حذف شده است");
      await createAuditRecord(tx, req, "MFG_OPERATION_SPLIT_DELETED", "MfgOperationSplitLot", lot.Id, "mfg.split.edit", {
        operationId: lot.ProductionOrderOperationId,
        splitNo: lot.SplitNo,
        quantity: lot.Quantity,
      });
      return { deleted: true, id: lot.Id };
    });
  }));

  app.get(`${ROOT}/orders/:orderId/lead-time-analysis`, route("mfg.schedule.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["scheduleVersion"]));
    const orderId = text(req.params.orderId, "orderId", { required: true, max: 60, pattern: ID_RE });
    const order = await r.get("MfgProductionOrder", orderId);
    if (!order || order.PlantId !== plantId) throw notFound();

    const [operations, segments, lots, runs] = await Promise.all([
      r.list("MfgProductionOrderOperation", {
        where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "ProductionOrderId", op: "eq", value: order.Id }],
        orderBy: [{ column: "SequenceNo", dir: "asc" }],
      }),
      r.list("MfgOperationSchedule", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgOperationSplitLot", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgScheduleRun", { where: [{ column: "PlantId", op: "eq", value: plantId }], orderBy: [{ column: "ScheduleVersion", dir: "desc" }], limit: 1 }),
    ]);
    if (operations.length === 0) throw businessRule("MFG_ORDER_NO_OPERATIONS", "سفارش هیچ عملیاتی ندارد", { orderId });

    let scheduleVersion = q.scheduleVersion === undefined || q.scheduleVersion === ""
      ? runs[0]?.ScheduleVersion ?? null
      : pageNumber(q.scheduleVersion, "scheduleVersion", 1, 1_000_000);
    if (scheduleVersion !== null && scheduleVersion < 1) throw bad("scheduleVersion", "scheduleVersion باید عدد صحیح مثبت باشد");

    const operationIds = new Set(operations.map((item) => item.Id));
    const relevantSegments = segments.filter((segment) => segment.PlantId === plantId
      && operationIds.has(segment.ProductionOrderOperationId)
      && segment.Status !== "cancelled"
      && (scheduleVersion === null || segment.ScheduleVersion === scheduleVersion));
    const windowsByOperation = new Map();
    for (const segment of relevantSegments) {
      const list = windowsByOperation.get(segment.ProductionOrderOperationId) ?? [];
      list.push({ operationId: segment.ProductionOrderOperationId, startAt: segment.PlannedStartAt, endAt: segment.PlannedEndAt });
      windowsByOperation.set(segment.ProductionOrderOperationId, list);
    }
    const splitCountByOperation = new Map();
    for (const lot of lots) {
      if (lot.PlantId !== plantId || lot.Status === "cancelled") continue;
      splitCountByOperation.set(lot.ProductionOrderOperationId, (splitCountByOperation.get(lot.ProductionOrderOperationId) ?? 0) + 1);
    }

    const analysis = runPlanning(() => analyzeLeadTimeOverlap({
      operations: operations.map((item) => ({
        operationId: item.Id,
        operationCode: item.OperationCode,
        sequenceNo: storedNumber(item.SequenceNo),
        quantity: storedNumber(item.PlannedQuantity),
        setupMinutes: storedNumber(item.PlannedSetupMinutes),
        runMinutesPerUnit: storedNumber(item.PlannedRunMinutesPerUnit),
        queueMinutes: storedNumber(item.PlannedQueueMinutes),
        moveMinutes: storedNumber(item.PlannedMoveMinutes),
        overlapAllowed: item.OverlapAllowed === true,
        transferBatchQty: item.TransferBatchQty,
        overlapPct: item.OverlapPct,
      })),
      scheduledWindows: [...windowsByOperation.values()].flat(),
      splitLotCountByOperation: Object.fromEntries(splitCountByOperation),
    }));

    return {
      order: { Id: order.Id, OrderNo: order.OrderNo, Status: order.Status, OrderQuantity: storedNumber(order.OrderQuantity), DueAt: order.DueAt },
      scheduleVersion,
      operationCount: operations.length,
      scheduledOperationCount: windowsByOperation.size,
      analysis,
    };
  }));
  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — بخش ۱۱.۹ نسخهٔ تولید (Production Version)
   * ════════════════════════════════════════════════════════════════════════ */

  const VERSION_FIELDS = new Set([
    "PartId", "VersionCode", "BomRevision", "RoutingRevision", "WorkCenterId",
    "Priority", "IsActive", "IsDefault", "EffectiveFrom", "EffectiveTo", "NoteFa",
  ]);

  app.get(`${ROOT}/production-versions`, route("mfg.version.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "isActive", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 100, 200);
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.partId) where.push({ column: "PartId", op: "eq", value: text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE }) });
    if (q.isActive !== undefined) where.push({ column: "IsActive", op: "eq", value: q.isActive === "true" || q.isActive === true });
    const [items, total] = await Promise.all([
      r.list("MfgProductionVersion", { where, orderBy: [{ column: "PartId", dir: "asc" }, { column: "Priority", dir: "asc" }], limit, offset }),
      r.count("MfgProductionVersion", where),
    ]);
    return { items, page: { limit, offset, total } };
  }));

  /** نسخهٔ تولید باید به BOM و Routing آزادشدهٔ همان قطعه اشاره کند. */
  const assertVersionRevisionsExist = async (db, plantId, partId, bomRevision, routingRevision) => {
    const bom = await db.findOne("MfgBomHeader", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "PartId", op: "eq", value: partId },
      { column: "Revision", op: "eq", value: bomRevision },
      { column: "Status", op: "eq", value: "released" },
    ]);
    if (!bom) {
      throw businessRule("MFG_VERSION_BOM_NOT_RELEASED", `BOM آزادشده با نسخهٔ ${bomRevision} برای این قطعه وجود ندارد`, { bomRevision });
    }
    const routing = await db.findOne("MfgRouting", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "PartId", op: "eq", value: partId },
      { column: "Revision", op: "eq", value: routingRevision },
      { column: "Status", op: "eq", value: "released" },
    ]);
    if (!routing) {
      throw businessRule("MFG_VERSION_ROUTING_NOT_RELEASED", `Routing آزادشده با نسخهٔ ${routingRevision} برای این قطعه وجود ندارد`, { routingRevision });
    }
    return { bom, routing };
  };

  app.post(`${ROOT}/production-versions`, route("mfg.version.edit", async ({ repo: r, req, plantId, subject }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, VERSION_FIELDS);
    const partId = text(body.PartId, "PartId", { required: true, max: 60, pattern: ID_RE });
    const part = await r.get("MfgPart", partId);
    if (!part || part.PlantId !== plantId) throw notFound();
    const versionCode = text(body.VersionCode, "VersionCode", { required: true, max: 32, pattern: CODE_RE });
    const bomRevision = text(body.BomRevision, "BomRevision", { required: true, max: 32 });
    const routingRevision = text(body.RoutingRevision, "RoutingRevision", { required: true, max: 32 });
    const workCenterId = text(body.WorkCenterId, "WorkCenterId", { max: 60, pattern: ID_RE });
    if (workCenterId) {
      const wc = await r.get("MfgWorkCenter", workCenterId);
      if (!wc || wc.PlantId !== plantId) throw bad("WorkCenterId", "مرکز کاری در این کارخانه یافت نشد");
    }
    const priority = body.Priority === undefined || body.Priority === null ? null : number(body.Priority, "Priority", { required: true, min: 0, max: 999, integer: true });
    const effectiveFrom = isoDate(body.EffectiveFrom, "EffectiveFrom");
    const effectiveTo = isoDate(body.EffectiveTo, "EffectiveTo");
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw bad("EffectiveTo", "پایان بازه نباید پیش از آغاز آن باشد");

    await assertVersionRevisionsExist(r, plantId, partId, bomRevision, routingRevision);

    const duplicate = await r.findOne("MfgProductionVersion", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "PartId", op: "eq", value: partId },
      { column: "VersionCode", op: "eq", value: versionCode },
    ]);
    if (duplicate) throw conflict("MFG_DUPLICATE", "VersionCode برای این قطعه قبلاً ثبت شده است");

    const isDefault = bool(body.IsDefault, "IsDefault", false);
    const execute = async (db) => {
      /* پیش‌فرض یکتا: اگر این نسخه پیش‌فرض شد، بقیهٔ نسخه‌های همان قطعه از
       * حالت پیش‌فرض خارج می‌شوند تا resolveProductionVersion بی‌ابهام بماند. */
      if (isDefault) {
        const others = await db.list("MfgProductionVersion", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "PartId", op: "eq", value: partId },
            { column: "IsDefault", op: "eq", value: true },
          ],
        });
        for (const other of others) {
          const res = await db.patch("MfgProductionVersion", other.Id, { IsDefault: false }, subject.id, other.RowVersion);
          if (!res.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "نسخهٔ پیش‌فرض قبلی هم‌زمان تغییر کرده است");
        }
      }
      const row = await db.create("MfgProductionVersion", {
        PlantId: plantId,
        PartId: partId,
        VersionCode: versionCode,
        BomRevision: bomRevision,
        RoutingRevision: routingRevision,
        WorkCenterId: workCenterId,
        Priority: priority,
        IsActive: body.IsActive === undefined ? true : bool(body.IsActive, "IsActive", true),
        IsDefault: isDefault,
        EffectiveFrom: effectiveFrom,
        EffectiveTo: effectiveTo,
        NoteFa: text(body.NoteFa, "NoteFa", { max: 800 }),
      }, subject.id);
      await createAuditRecord(db, req, "MFG_PRODUCTION_VERSION_CREATED", "MfgProductionVersion", row.Id, "mfg.version.edit", { versionCode });
      return row;
    };
    return r.transaction((tx) => execute(tx));
  }, 201));

  app.patch(`${ROOT}/production-versions/:versionId`, route("mfg.version.edit", async ({ repo: r, req, plantId, subject }) => {
    const versionId = text(req.params.versionId, "versionId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgProductionVersion", versionId);
    if (!row || row.PlantId !== plantId) throw notFound();
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set([...VERSION_FIELDS].filter((key) => key !== "PartId")));
    if (body.PartId !== undefined) throw bad("PartId", "نسخهٔ تولید نمی‌تواند به قطعهٔ دیگری منتقل شود");
    const ifMatch = rowVersionFrom(req);

    const patch = {};
    if (body.BomRevision !== undefined || body.RoutingRevision !== undefined) {
      const bomRevision = text(body.BomRevision ?? row.BomRevision, "BomRevision", { required: true, max: 32 });
      const routingRevision = text(body.RoutingRevision ?? row.RoutingRevision, "RoutingRevision", { required: true, max: 32 });
      await assertVersionRevisionsExist(r, plantId, row.PartId, bomRevision, routingRevision);
      patch.BomRevision = bomRevision;
      patch.RoutingRevision = routingRevision;
    }
    if (body.VersionCode !== undefined) {
      const versionCode = text(body.VersionCode, "VersionCode", { required: true, max: 32, pattern: CODE_RE });
      const duplicate = await r.findOne("MfgProductionVersion", [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "PartId", op: "eq", value: row.PartId },
        { column: "VersionCode", op: "eq", value: versionCode },
      ]);
      if (duplicate && duplicate.Id !== row.Id) throw conflict("MFG_DUPLICATE", "VersionCode برای این قطعه قبلاً ثبت شده است");
      patch.VersionCode = versionCode;
    }
    if (body.WorkCenterId !== undefined) {
      const workCenterId = text(body.WorkCenterId, "WorkCenterId", { max: 60, pattern: ID_RE });
      if (workCenterId) {
        const wc = await r.get("MfgWorkCenter", workCenterId);
        if (!wc || wc.PlantId !== plantId) throw bad("WorkCenterId", "مرکز کاری در این کارخانه یافت نشد");
      }
      patch.WorkCenterId = workCenterId;
    }
    if (body.Priority !== undefined) patch.Priority = body.Priority === null ? null : number(body.Priority, "Priority", { required: true, min: 0, max: 999, integer: true });
    if (body.IsActive !== undefined) patch.IsActive = bool(body.IsActive, "IsActive", true);
    if (body.EffectiveFrom !== undefined) patch.EffectiveFrom = isoDate(body.EffectiveFrom, "EffectiveFrom");
    if (body.EffectiveTo !== undefined) patch.EffectiveTo = isoDate(body.EffectiveTo, "EffectiveTo");
    if (body.NoteFa !== undefined) patch.NoteFa = text(body.NoteFa, "NoteFa", { max: 800 });
    const nextFrom = patch.EffectiveFrom ?? row.EffectiveFrom;
    const nextTo = patch.EffectiveTo ?? row.EffectiveTo;
    if (nextFrom && nextTo && nextTo < nextFrom) throw bad("EffectiveTo", "پایان بازه نباید پیش از آغاز آن باشد");
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل‌ویرایشی ارسال نشده است");

    const execute = async (db) => {
      if (body.IsDefault === true) {
        patch.IsDefault = true;
        const others = await db.list("MfgProductionVersion", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "PartId", op: "eq", value: row.PartId },
            { column: "IsDefault", op: "eq", value: true },
          ],
        });
        for (const other of others) {
          if (other.Id === row.Id) continue;
          const res = await db.patch("MfgProductionVersion", other.Id, { IsDefault: false }, subject.id, other.RowVersion);
          if (!res.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "نسخهٔ پیش‌فرض قبلی هم‌زمان تغییر کرده است");
        }
      } else if (body.IsDefault === false) {
        patch.IsDefault = false;
      }
      const res = await db.patch("MfgProductionVersion", row.Id, patch, subject.id, ifMatch);
      if (!res.ok) throw conflict(res.code === "CONCURRENCY_CONFLICT" ? "MFG_ROW_VERSION_CONFLICT" : res.code, "نسخهٔ تولید هم‌زمان تغییر کرده است");
      await createAuditRecord(db, req, "MFG_PRODUCTION_VERSION_UPDATED", "MfgProductionVersion", row.Id, "mfg.version.edit", { fields: Object.keys(patch) });
      return db.get("MfgProductionVersion", row.Id);
    };
    return r.transaction((tx) => execute(tx));
  }));

  app.get(`${ROOT}/parts/:partId/production-version`, route("mfg.version.view", async ({ repo: r, req, plantId }) => {
    const partId = text(req.params.partId, "partId", { required: true, max: 60, pattern: ID_RE });
    const part = await r.get("MfgPart", partId);
    if (!part || part.PlantId !== plantId) throw notFound();
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["versionId", "workCenterId", "effectiveAt"]));
    const versions = await r.list("MfgProductionVersion", {
      where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "PartId", op: "eq", value: partId }],
    });
    const selected = runPlanning(() => resolveProductionVersion({
      versions: versions.map((row) => ({
        versionId: row.Id,
        partId: row.PartId,
        versionCode: row.VersionCode,
        bomRevision: row.BomRevision,
        routingRevision: row.RoutingRevision,
        workCenterId: row.WorkCenterId ?? null,
        isActive: row.IsActive === true,
        isDefault: row.IsDefault === true,
        effectiveFrom: row.EffectiveFrom ?? null,
        effectiveTo: row.EffectiveTo ?? null,
        priority: storedNumber(row.Priority, null),
      })),
      partId,
      versionId: text(q.versionId, "versionId", { max: 60, pattern: ID_RE }),
      workCenterId: text(q.workCenterId, "workCenterId", { max: 60, pattern: ID_RE }),
      effectiveAt: isoDate(q.effectiveAt, "effectiveAt"),
    }));
    const matched = selected ? versions.find((row) => row.Id === selected.versionId) ?? null : null;
    return {
      partId,
      partNo: part.PartNo,
      candidates: versions.filter((row) => row.IsActive === true).length,
      selected: matched,
      selection: selected
        ? { versionId: selected.versionId, versionCode: selected.versionCode, bomRevision: selected.bomRevision, routingRevision: selected.routingRevision }
        : null,
    };
  }));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — بخش ۱۱.۱ تأیید دستی MPS پیش از اجرای MRP
   * ════════════════════════════════════════════════════════════════════════ */

  app.post(`${ROOT}/mps/runs/:runId/approve`, route("mfg.mps.approve", async ({ repo: r, req, plantId, subject }) => {
    const runId = text(req.params.runId, "runId", { required: true, max: 60, pattern: ID_RE });
    const run = await r.get("MfgMasterScheduleRun", runId);
    if (!run || run.PlantId !== plantId) throw notFound();
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["Approved", "NoteFa"]));
    const ifMatch = rowVersionFrom(req);
    const approved = body.Approved === undefined ? true : bool(body.Approved, "Approved", true);

    if (run.PreviewOnly === true) {
      throw businessRule("MFG_MPS_PREVIEW_NOT_APPROVABLE", "اجرای پیش‌نمایش چیزی ثبت نکرده است؛ ابتدا MPS را ثبت کنید", { runId });
    }
    if (storedNumber(run.LineCount) < 1) {
      throw businessRule("MFG_MPS_NOTHING_TO_APPROVE", "این اجرا هیچ سطری ندارد که تأیید شود", { runId });
    }

    const execute = async (db) => {
      const res = await db.patch("MfgMasterScheduleRun", run.Id, {
        Status: approved ? "approved" : "rejected",
        ApprovedBy: approved ? subject.id : null,
        ApprovedAt: approved ? new Date().toISOString() : null,
        NoteFa: text(body.NoteFa, "NoteFa", { max: 800 }) ?? run.NoteFa ?? null,
      }, subject.id, ifMatch);
      if (!res.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "اجرای MPS هم‌زمان تغییر کرده است");
      await createAuditRecord(db, req, approved ? "MFG_MPS_APPROVED" : "MFG_MPS_REJECTED", "MfgMasterScheduleRun", run.Id, "mfg.mps.approve", {
        runNo: run.RunNo,
      });
      return db.get("MfgMasterScheduleRun", run.Id);
    };
    return r.transaction((tx) => execute(tx));
  }));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — بخش ۱۱.۵ Lead Time Offset و ۱۱.۶ Pegging در گزارش MRP
   * ════════════════════════════════════════════════════════════════════════ */

  /** گراف BOM آزادشده + زمان تحویل هر قطعه؛ ورودی مشترک offset و pegging. */
  const loadBomGraph = async (db, plantId) => {
    const [parts, bomHeaders, bomItems, materials] = await Promise.all([
      db.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      db.list("MfgBomHeader", { where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "Status", op: "eq", value: "released" }] }),
      db.list("MfgBomItem", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      db.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const partIds = parts.filter((part) => part.PlantId === plantId).map((part) => part.Id);
    const itemsByHeader = new Map();
    for (const item of bomItems) {
      if (item.PlantId !== plantId) continue;
      const list = itemsByHeader.get(item.BomHeaderId) ?? [];
      list.push(item);
      itemsByHeader.set(item.BomHeaderId, list);
    }
    const edges = [];
    const rootPartIds = [];
    const childPartIds = new Set();
    for (const header of bomHeaders) {
      if (header.PlantId !== plantId) continue;
      for (const item of itemsByHeader.get(header.Id) ?? []) {
        edges.push({
          parentPartId: header.PartId,
          componentPartId: item.ComponentPartId,
          quantityPer: storedNumber(item.QuantityPer, 1),
        });
        childPartIds.add(item.ComponentPartId);
      }
    }
    for (const partId of partIds) {
      if (!childPartIds.has(partId)) rootPartIds.push(partId);
    }
    const leadTimeDaysByPartId = {};
    for (const material of materials) {
      if (material.PlantId !== plantId) continue;
      leadTimeDaysByPartId[material.PartId] = storedNumber(material.LeadTimeDays, 0);
    }
    return { partIds, edges, rootPartIds, leadTimeDaysByPartId };
  };

  app.get(`${ROOT}/mrp/lead-time-offset`, route("mfg.mrp.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "maxLevels"]));
    const graph = await loadBomGraph(r, plantId);
    if (graph.edges.length === 0) {
      return { parts: [], levelOffsets: [], finishedGoodsLeadTimeDays: 0, maxLowLevelCode: 0, rootPartIds: [] };
    }
    const onlyPartId = text(q.partId, "partId", { max: 60, pattern: ID_RE });
    const result = runPlanning(() => computeLeadTimeOffsets({
      edges: graph.edges,
      leadTimeDaysByPartId: graph.leadTimeDaysByPartId,
      rootPartIds: onlyPartId ? [onlyPartId] : graph.rootPartIds,
      maxLevels: q.maxLevels === undefined ? 32 : Number(q.maxLevels),
    }));
    return { ...result, rootPartIds: onlyPartId ? [onlyPartId] : graph.rootPartIds };
  }));

  app.get(`${ROOT}/mrp/pegging`, route("mfg.mrp.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "level", "rootPartId", "productionOrderId"]));
    const level = text(q.level ?? "multi", "level", { required: true, max: 8 });
    if (!["single", "multi"].includes(level)) throw bad("level", "level باید single یا multi باشد");
    const partId = text(q.partId, "partId", { max: 60, pattern: ID_RE });
    const productionOrderId = text(q.productionOrderId, "productionOrderId", { max: 60, pattern: ID_RE });

    /* pegging از نیازهای مواد واقعی ساخته می‌شود، نه از گراف تئوری BOM:
     * آنچه کاربر می‌پرسد «این نیاز به کدام سفارش تعلق دارد» است. */
    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (productionOrderId) where.push({ column: "ProductionOrderId", op: "eq", value: productionOrderId });
    const requirements = await r.list("MfgMaterialRequirement", { where, limit: 5000 });
    const [parts, materials] = await Promise.all([
      r.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);
    const partById = new Map(parts.map((part) => [part.Id, part]));
    const partIdByMaterialId = new Map(materials.map((material) => [material.Id, material.PartId]));
    const orderById = new Map();
    if (requirements.length > 0) {
      const orders = await r.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] });
      for (const order of orders) orderById.set(order.Id, order);
    }

    const supplies = [];
    const links = [];
    const seenSupply = new Set();
    for (const row of requirements) {
      if (row.PlantId !== plantId) continue;
      const componentPartId = partIdByMaterialId.get(row.MaterialId);
      if (!componentPartId) continue;
      if (partId && componentPartId !== partId) continue;
      const order = orderById.get(row.ProductionOrderId);
      const componentRef = row.Id;
      const parentRef = row.ProductionOrderId;
      if (!seenSupply.has(componentRef)) {
        seenSupply.add(componentRef);
        supplies.push({ partId: componentPartId, supplyRef: componentRef, quantity: storedNumber(row.NetQuantity), supplyType: "requirement" });
      }
      if (order && !seenSupply.has(parentRef)) {
        seenSupply.add(parentRef);
        supplies.push({ partId: order.PartId, supplyRef: parentRef, quantity: storedNumber(order.OrderQuantity), supplyType: "production-order" });
      }
      if (order) {
        links.push({
          parentSupplyRef: parentRef,
          componentSupplyRef: componentRef,
          quantityPer: storedNumber(row.NetQuantity) > 0 && storedNumber(order.OrderQuantity) > 0
            ? roundTo3(storedNumber(row.NetQuantity) / storedNumber(order.OrderQuantity))
            : 1,
        });
      }
    }

    const rootPartId = text(q.rootPartId, "rootPartId", { max: 60, pattern: ID_RE });
    const rootSupplyRefs = rootPartId
      ? supplies.filter((supply) => supply.partId === rootPartId).map((supply) => supply.supplyRef)
      : undefined;

    const pegging = runPlanning(() => buildPegging({ supplies, links, rootSupplyRefs }));
    const wanted = level === "single" ? pegging.singleLevel : pegging.multiLevel;
    const items = Object.entries(wanted).map(([supplyRef, paths]) => ({
      supplyRef,
      partId: supplies.find((supply) => supply.supplyRef === supplyRef)?.partId ?? null,
      partNo: partById.get(supplies.find((supply) => supply.supplyRef === supplyRef)?.partId ?? "")?.PartNo ?? null,
      paths: paths.map((path) => path.chain.map((step) => ({
        partId: step.partId,
        partNo: partById.get(step.partId)?.PartNo ?? null,
        supplyRef: step.supplyRef,
        quantityPer: step.quantityPer,
      }))),
    }));
    return {
      level,
      requirementCount: requirements.length,
      supplyCount: supplies.length,
      rootSupplyRefs: pegging.rootSupplyRefs,
      items: items.filter((item) => item.paths.length > 0).slice(0, 1000),
    };
  }));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — بخش ۱۱.۳ سفارش برنامه‌ریزی‌شده (Planned Order)
   * ════════════════════════════════════════════════════════════════════════ */

  const PLANNED_STATUS = new Set(["proposed", "approved", "converted", "rejected", "cancelled"]);

  const nextPlannedOrderNo = async (db) => {
    const rows = await db.list("MfgPlannedOrder", {
      where: [{ column: "PlantId", op: "eq", value: plantId }],
      orderBy: [{ column: "CreatedAt", dir: "desc" }],
      limit: 1,
    });
    const last = rows[0]?.PlannedOrderNo ?? "";
    const match = /^PO-(\d+)$/.exec(String(last));
    const next = (match ? Number(match[1]) : 0) + 1;
    return `PO-${String(next).padStart(4, "0")}`;
  };

  const plannedOrderWithPegging = async (db, plantId, row) => {
    const pegging = await db.list("MfgRequirementPegging", {
      where: [{ column: "PlantId", op: "eq", value: plantId }, { column: "PlannedOrderId", op: "eq", value: row.Id }],
    });
    return { ...row, pegging };
  };

  app.get(`${ROOT}/planned-orders`, route("mfg.plannedorder.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set(["partId", "status", "source", "dueFrom", "dueTo", "limit", "offset"]));
    const limit = pageNumber(q.limit, "limit", 50, 200);
    const offset = pageNumber(q.offset, "offset", 0, 1_000_000);
    const where = [{ column: "PlantId", op: "eq", value: plantId }];
    if (q.partId) where.push({ column: "PartId", op: "eq", value: text(q.partId, "partId", { required: true, max: 60, pattern: ID_RE }) });
    if (q.status) {
      const status = text(q.status, "status", { required: true, max: 16 });
      if (!PLANNED_STATUS.has(status)) throw bad("status", "status باید proposed/approved/converted/rejected/cancelled باشد");
      where.push({ column: "Status", op: "eq", value: status });
    }
    if (q.source) where.push({ column: "Source", op: "eq", value: text(q.source, "source", { required: true, max: 8 }) });
    if (q.dueFrom) where.push({ column: "PlannedDueAt", op: "gte", value: isoDateTime(q.dueFrom, "dueFrom", { required: true }) });
    if (q.dueTo) where.push({ column: "PlannedDueAt", op: "lte", value: isoDateTime(q.dueTo, "dueTo", { required: true }) });
    const [items, total] = await Promise.all([
      r.list("MfgPlannedOrder", { where, orderBy: [{ column: "PlannedDueAt", dir: "asc" }, { column: "PlannedOrderNo", dir: "asc" }], limit, offset }),
      r.count("MfgPlannedOrder", where),
    ]);
    return { items, page: { limit, offset, total } };
  }));

  app.get(`${ROOT}/planned-orders/:plannedOrderId`, route("mfg.plannedorder.view", async ({ repo: r, req, plantId }) => {
    const plannedOrderId = text(req.params.plannedOrderId, "plannedOrderId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgPlannedOrder", plannedOrderId);
    if (!row || row.PlantId !== plantId) throw notFound();
    return plannedOrderWithPegging(r, plantId, row);
  }));

  /** ویرایش سفارش برنامه‌ریزی‌شده — فقط تا پیش از تبدیل مجاز است (۱۱.۳). */
  app.patch(`${ROOT}/planned-orders/:plannedOrderId`, route("mfg.plannedorder.edit", async ({ repo: r, req, plantId, subject }) => {
    const plannedOrderId = text(req.params.plannedOrderId, "plannedOrderId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgPlannedOrder", plannedOrderId);
    if (!row || row.PlantId !== plantId) throw notFound();
    if (row.Status === "converted") {
      throw businessRule("MFG_PLANNED_ORDER_CONVERTED", "سفارش برنامه‌ریزی‌شدهٔ تبدیل‌شده قابل ویرایش نیست؛ سفارش تولید را ویرایش کنید", {
        productionOrderId: row.ConvertedProductionOrderId,
      });
    }
    if (row.Status === "cancelled") throw businessRule("MFG_PLANNED_ORDER_CANCELLED", "سفارش برنامه‌ریزی‌شدهٔ لغوشده قابل ویرایش نیست");
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["Quantity", "PlannedReleaseAt", "PlannedDueAt", "ProductionVersionId", "NoteFa"]));
    const ifMatch = rowVersionFrom(req);

    const patch = {};
    if (body.Quantity !== undefined) patch.Quantity = number(body.Quantity, "Quantity", { required: true, min: Number.MIN_VALUE, max: 99_999_999.9999 });
    if (body.PlannedReleaseAt !== undefined) patch.PlannedReleaseAt = isoDateTime(body.PlannedReleaseAt, "PlannedReleaseAt", { required: true });
    if (body.PlannedDueAt !== undefined) patch.PlannedDueAt = isoDateTime(body.PlannedDueAt, "PlannedDueAt", { required: true });
    if (body.ProductionVersionId !== undefined) {
      const versionId = text(body.ProductionVersionId, "ProductionVersionId", { max: 60, pattern: ID_RE });
      if (versionId) {
        const version = await r.get("MfgProductionVersion", versionId);
        if (!version || version.PlantId !== plantId || version.PartId !== row.PartId) {
          throw bad("ProductionVersionId", "نسخهٔ تولید باید فعال و متعلق به همین قطعه باشد");
        }
      }
      patch.ProductionVersionId = versionId ?? null;
    }
    if (body.NoteFa !== undefined) patch.NoteFa = text(body.NoteFa, "NoteFa", { max: 800 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل‌ویرایشی ارسال نشده است");

    const nextRelease = patch.PlannedReleaseAt ?? row.PlannedReleaseAt;
    const nextDue = patch.PlannedDueAt ?? row.PlannedDueAt;
    if (Date.parse(nextRelease) > Date.parse(nextDue)) {
      throw bad("PlannedReleaseAt", "آزادسازی برنامه‌ریزی‌شده نباید پس از موعد آن باشد");
    }

    const execute = async (db) => {
      /* ویرایش، وضعیت را به proposed برمی‌گرداند: تأیید قبلی روی مقدار قبلی
       * داده شده بود و نباید بی‌سروصدا به مقدار تازه منتقل شود. */
      if (row.Status === "approved") patch.Status = "proposed";
      const res = await db.patch("MfgPlannedOrder", row.Id, patch, subject.id, ifMatch);
      if (!res.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "سفارش برنامه‌ریزی‌شده هم‌زمان تغییر کرده است");
      await createAuditRecord(db, req, "MFG_PLANNED_ORDER_UPDATED", "MfgPlannedOrder", row.Id, "mfg.plannedorder.edit", { fields: Object.keys(patch) });
      return plannedOrderWithPegging(db, plantId, await db.get("MfgPlannedOrder", row.Id));
    };
    return r.transaction((tx) => execute(tx));
  }));

  const transitionPlannedOrder = (targetStatus, permission, auditAction) => async ({ repo: r, req, plantId, subject }) => {
    const plannedOrderId = text(req.params.plannedOrderId, "plannedOrderId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgPlannedOrder", plannedOrderId);
    if (!row || row.PlantId !== plantId) throw notFound();
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["NoteFa", "RejectReasonFa"]));
    const ifMatch = rowVersionFrom(req);

    if (row.Status === "converted") throw businessRule("MFG_PLANNED_ORDER_CONVERTED", "این سفارش قبلاً به سفارش تولید تبدیل شده است", { productionOrderId: row.ConvertedProductionOrderId });
    if (row.Status === "cancelled") throw businessRule("MFG_PLANNED_ORDER_CANCELLED", "سفارش برنامه‌ریزی‌شدهٔ لغوشده قابل تغییر وضعیت نیست");
    if (targetStatus === "approved" && row.Status === "approved") {
      throw businessRule("MFG_PLANNED_ORDER_ALREADY_APPROVED", "این سفارش پیش‌تر تأیید شده است");
    }
    if (targetStatus === "rejected") {
      const reason = text(body.RejectReasonFa ?? body.NoteFa, "RejectReasonFa", { max: 400 });
      if (!reason) throw bad("RejectReasonFa", "دلیل رد الزامی است تا برنامه‌ریز بعدی بداند چرا رد شده");
    }

    const execute = async (db) => {
      const patch = {
        Status: targetStatus,
        ReviewedBy: subject.id,
        ReviewedAt: new Date().toISOString(),
      };
      if (targetStatus === "rejected") patch.RejectReasonFa = text(body.RejectReasonFa ?? body.NoteFa, "RejectReasonFa", { max: 400 });
      if (body.NoteFa !== undefined) patch.NoteFa = text(body.NoteFa, "NoteFa", { max: 800 });
      const res = await db.patch("MfgPlannedOrder", row.Id, patch, subject.id, ifMatch);
      if (!res.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "سفارش برنامه‌ریزی‌شده هم‌زمان تغییر شده است");
      await createAuditRecord(db, req, auditAction, "MfgPlannedOrder", row.Id, permission, { status: targetStatus });
      return plannedOrderWithPegging(db, plantId, await db.get("MfgPlannedOrder", row.Id));
    };
    return r.transaction((tx) => execute(tx));
  };

  app.post(`${ROOT}/planned-orders/:plannedOrderId/approve`, route("mfg.plannedorder.approve",
    transitionPlannedOrder("approved", "mfg.plannedorder.approve", "MFG_PLANNED_ORDER_APPROVED")));

  app.post(`${ROOT}/planned-orders/:plannedOrderId/reject`, route("mfg.plannedorder.approve",
    transitionPlannedOrder("rejected", "mfg.plannedorder.approve", "MFG_PLANNED_ORDER_REJECTED")));

  /**
   * تبدیل سفارش برنامه‌ریزی‌شده به سفارش تولید (۱۱.۳).
   *
   * تنها مسیر «approved» قابل تبدیل است؛ وگرنه هر پیشنهاد MRP می‌توانست بی‌آنکه
   * کسی بازبینی کند کار روی کف کارگاه ایجاد کند. سفارش تولید در وضعیت created
   * ساخته می‌شود تا آزادسازی (Release) همچنان گیت جداگانهٔ خودش را داشته باشد.
   */
  app.post(`${ROOT}/planned-orders/:plannedOrderId/convert`, route("mfg.plannedorder.convert", async ({ repo: r, req, plantId, subject }) => {
    const plannedOrderId = text(req.params.plannedOrderId, "plannedOrderId", { required: true, max: 60, pattern: ID_RE });
    const row = await r.get("MfgPlannedOrder", plannedOrderId);
    if (!row || row.PlantId !== plantId) throw notFound();
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["OrderNo", "NoteFa", "PriorityRule"]));
    const ifMatch = rowVersionFrom(req);

    if (row.Status === "converted") {
      throw businessRule("MFG_PLANNED_ORDER_CONVERTED", "این سفارش قبلاً تبدیل شده است", { productionOrderId: row.ConvertedProductionOrderId });
    }
    if (row.Status !== "approved") {
      throw businessRule("MFG_PLANNED_ORDER_NOT_APPROVED", `سفارش برنامه‌ریزی‌شده با وضعیت ${row.Status} قابل تبدیل نیست؛ ابتدا تأیید کنید`, {
        status: row.Status,
      });
    }

    const part = await r.get("MfgPart", row.PartId);
    if (!part || part.PlantId !== plantId || part.IsActive !== true) {
      throw businessRule("MFG_PART_UNAVAILABLE", "قطعهٔ این سفارش برنامه‌ریزی‌شده دیگر فعال نیست", { partId: row.PartId });
    }
    /* قطعهٔ خریدنی Routing ندارد و تبدیلش به «سفارش تولید» یک سفارش بی‌عملیات
     * می‌سازد که نه زمان‌بندی می‌شود نه اجرا. مسیر درستش پیشنهاد تأمین است. */
    const partMaterial = await r.findOne("MfgMaterial", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "PartId", op: "eq", value: row.PartId },
      { column: "IsActive", op: "eq", value: true },
    ]);
    if (part.PartType === "purchased" || partMaterial?.ProcurementType === "buy") {
      throw businessRule("MFG_PLANNED_ORDER_NOT_MAKE",
        "این قطعه خریدنی است و به سفارش تولید تبدیل نمی‌شود؛ از مسیر پیشنهاد تأمین استفاده کنید", {
          partId: row.PartId,
          partNo: part.PartNo,
          procurementRoute: `POST ${ROOT}/material-procurement-proposals`,
        });
    }
    const orderNo = text(body.OrderNo, "OrderNo", { max: 60, pattern: CODE_RE }) ?? `MO-${String(row.PlannedOrderNo).replace(/^PO-/, "")}`;
    const duplicate = await r.findOne("MfgProductionOrder", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "OrderNo", op: "eq", value: orderNo },
    ]);
    if (duplicate) throw conflict("MFG_DUPLICATE", "OrderNo در این کارخانه قبلاً ثبت شده است");
    const priorityRule = text(body.PriorityRule ?? "EDD", "PriorityRule", { required: true, max: 12 });
    if (!PRIORITY_RULES.has(priorityRule)) throw bad("PriorityRule", "PriorityRule باید EDD، CR یا MANUAL باشد");

    const execute = async (db) => {
      const order = await db.create("MfgProductionOrder", {
        PlantId: plantId,
        OrderNo: orderNo,
        PartId: row.PartId,
        OrderQuantity: storedNumber(row.Quantity),
        Uom: row.Uom,
        DueAt: row.PlannedDueAt,
        RequestedStartAt: row.PlannedReleaseAt,
        Status: "created",
        PriorityRule: priorityRule,
        ManualRank: null,
        DispatchWeight: 1,
        DemandSource: "mrp",
        DemandRef: row.PlannedOrderNo,
        CustomerRef: null,
        CustomerNameSnapshot: null,
        ContractId: null,
        ProjectId: null,
        AllowOverrun: false,
        NoteFa: text(body.NoteFa, "NoteFa", { max: 1200 }) ?? `تبدیل‌شده از سفارش برنامه‌ریزی‌شدهٔ ${row.PlannedOrderNo}`,
      }, subject.id);

      /* snapshot عملیات از Routing نسخهٔ تولید (یا Routing پیش‌فرض) ساخته می‌شود
       * تا سفارشِ تازه مثل هر سفارش دیگری قابل آزادسازی باشد. */
      const version = row.ProductionVersionId ? await db.get("MfgProductionVersion", row.ProductionVersionId) : null;
      const routing = await db.findOne("MfgRouting", [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "PartId", op: "eq", value: row.PartId },
        ...(version?.RoutingRevision ? [{ column: "Revision", op: "eq", value: version.RoutingRevision }] : []),
        { column: "Status", op: "eq", value: "released" },
      ]);
      let operationCount = 0;
      if (routing) {
        const templateOps = await db.list("MfgRoutingOperation", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "RoutingId", op: "eq", value: routing.Id },
          ],
          orderBy: [{ column: "SequenceNo", dir: "asc" }],
        });
        for (const template of templateOps) {
          await db.create("MfgProductionOrderOperation", {
            PlantId: plantId,
            ProductionOrderId: order.Id,
            SequenceNo: template.SequenceNo,
            OperationCode: template.OperationCode,
            OperationNameFa: template.OperationNameFa,
            WorkCenterId: template.WorkCenterId,
            PredecessorOperationId: null,
            PlannedQuantity: storedNumber(row.Quantity),
            PlannedSetupMinutes: template.SetupMinutes,
            PlannedRunMinutesPerUnit: template.RunMinutesPerUnit,
            PlannedQueueMinutes: template.QueueMinutes,
            PlannedMoveMinutes: template.MoveMinutes,
            PlannedCapacityMinutes: template.CapacityMinutes,
            OverlapAllowed: template.OverlapAllowed === true,
            TransferBatchQty: template.TransferBatchQty ?? null,
            OverlapPct: template.OverlapPct ?? null,
            SplitLotCount: template.SplitLotCount ?? null,
            Status: "pending",
          }, subject.id);
          operationCount += 1;
        }
      }

      const res = await db.patch("MfgPlannedOrder", row.Id, {
        Status: "converted",
        ConvertedProductionOrderId: order.Id,
        ConvertedAt: new Date().toISOString(),
      }, subject.id, ifMatch);
      if (!res.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "سفارش برنامه‌ریزی‌شده هم‌زمان تغییر کرده است");

      await createAuditRecord(db, req, "MFG_PLANNED_ORDER_CONVERTED", "MfgPlannedOrder", row.Id, "mfg.plannedorder.convert", {
        productionOrderId: order.Id,
        orderNo,
        operationCount,
      });
      return {
        plannedOrder: await plannedOrderWithPegging(db, plantId, await db.get("MfgPlannedOrder", row.Id)),
        productionOrder: order,
        operationCount,
        routingRevision: routing?.Revision ?? null,
        requiresRelease: true,
      };
    };
    return r.transaction((tx) => execute(tx));
  }, 201));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — بخش ۱۱.۷ برنامه‌ریزی نیاز ظرفیت (CRP)
   * ════════════════════════════════════════════════════════════════════════ */

  /** ظرفیت دقیقه‌ای هر مرکز کاری در هر سطل، از تقویم و منابع همان مرکز. */
  const crpCapacityByBucket = (workCenter, resources, buckets) => {
    const activeResources = resources.filter((resource) => resource.IsActive !== false);
    const capacityUnits = activeResources.reduce((sum, resource) => sum + storedNumber(resource.CapacityUnits, 1), 0);
    return buckets.map((bucket) => {
      const days = Math.max(1, bucket.days);
      /* یک شیفت ۸ ساعته به ازای هر روز کاری؛ تقویم دقیق در زمان‌بند خودش
       * لحاظ می‌شود و CRP در سطح «ظرفیت ناخالص در دسترس» مقایسه می‌کند. */
      const minutesPerDay = 480 * Math.max(0, capacityUnits);
      return roundTo3(minutesPerDay * days);
    });
  };

  /**
   * ظرفیت آزاد مراکز کاری برای یک مقدار درخواستی (۱۱.۸).
   *
   * ATP مبتنی بر موجودی تنها نیمی از پاسخ است: اگر خط ظرفیت خالی نداشته باشد،
   * همان موجودی هم در تاریخ خواسته‌شده قابل تحویل نیست. این هلپر برای هر سطل
   * بار فعلی را از ظرفیت ناخالص کم می‌کند و نخستین سطلی را برمی‌گرداند که همهٔ
   * مراکز کاریِ Routing قطعه در آن جا دارند.
   */
  const atpCapacityCheck = ({ buckets, requestedQty, requestedAt, routingOperations, workCenters, resources, loadedMinutesByCenterBucket }) => {
    const neededByCenter = new Map();
    for (const op of routingOperations) {
      const minutes = roundTo3(storedNumber(op.SetupMinutes, 0) + storedNumber(op.RunMinutesPerUnit, 0) * Math.max(0, requestedQty));
      if (minutes <= 0) continue;
      neededByCenter.set(op.WorkCenterId, roundTo3((neededByCenter.get(op.WorkCenterId) ?? 0) + minutes));
    }
    const centers = [];
    for (const [workCenterId, requiredMinutes] of neededByCenter) {
      const center = workCenters.find((row) => row.Id === workCenterId) ?? null;
      const availableByBucket = crpCapacityByBucket(
        center ?? { Id: workCenterId },
        resources.filter((resource) => resource.WorkCenterId === workCenterId),
        buckets,
      );
      const loadedByBucket = loadedMinutesByCenterBucket.get(workCenterId) ?? buckets.map(() => 0);
      centers.push({
        workCenterId,
        code: center?.Code ?? null,
        requiredMinutes,
        buckets: buckets.map((bucket, index) => {
          const availableMinutes = availableByBucket[index];
          const loadedMinutes = roundTo3(loadedByBucket[index] ?? 0);
          const freeMinutes = roundTo3(Math.max(0, availableMinutes - loadedMinutes));
          return {
            bucketIndex: index,
            bucketStart: bucket.start,
            bucketEnd: bucket.end,
            availableMinutes,
            loadedMinutes,
            freeMinutes,
            sufficient: freeMinutes >= requiredMinutes - 1e-9,
          };
        }),
      });
    }
    if (centers.length === 0) {
      return {
        considered: false, constrained: false, requestedBucketIndex: null,
        promiseBucketIndex: null, promiseAt: null, centers: [], message: null,
      };
    }
    const requestedIndex = buckets.findIndex((bucket) => requestedAt >= bucket.start && requestedAt < bucket.end);
    const firstIndex = Math.max(0, requestedIndex);
    let promiseIndex = null;
    for (let index = firstIndex; index < buckets.length; index += 1) {
      if (centers.every((center) => center.buckets[index].sufficient)) { promiseIndex = index; break; }
    }
    return {
      considered: true,
      constrained: promiseIndex !== null && promiseIndex > firstIndex,
      requestedBucketIndex: requestedIndex < 0 ? null : requestedIndex,
      promiseBucketIndex: promiseIndex,
      promiseAt: promiseIndex === null ? null : buckets[promiseIndex].end,
      centers,
      message: promiseIndex === null
        ? "ظرفیت آزاد هیچ مرکز کاری در افق بررسی برای این مقدار کافی نیست"
        : promiseIndex > firstIndex
          ? `ظرفیت آزاد در سطل درخواستی کافی نیست؛ نخستین سطل با ظرفیت کافی ${buckets[promiseIndex].start} است`
          : null,
    };
  };

  const runCrp = async (db, plantId, { bucketUnit, bucketCount, horizonStart, overloadPct, underloadPct, includePlannedOrders }) => {
    const buckets = runPlanning(() => buildTimeBuckets({ horizonStart, bucketUnit, bucketCount }));
    const [workCenters, resources, orders, operations, schedules, plannedOrders, parts] = await Promise.all([
      db.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      db.list("MfgWorkCenterResource", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      db.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      db.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      db.list("MfgOperationSchedule", { where: [{ column: "PlantId", op: "eq", value: plantId }], orderBy: [{ column: "ScheduleVersion", dir: "desc" }] }),
      includePlannedOrders ? db.list("MfgPlannedOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }) : Promise.resolve([]),
      db.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);

    const centers = workCenters
      .filter((center) => center.PlantId === plantId && center.Status !== "inactive")
      .map((center) => ({
        workCenterId: center.Id,
        code: center.Code,
        availableMinutesByBucket: crpCapacityByBucket(center, resources.filter((resource) => resource.WorkCenterId === center.Id), buckets),
      }));

    const latestVersion = schedules[0]?.ScheduleVersion ?? null;
    const windows = new Map();
    for (const segment of schedules) {
      if (segment.PlantId !== plantId || latestVersion === null || segment.ScheduleVersion !== latestVersion) continue;
      if (segment.Status === "cancelled") continue;
      const existing = windows.get(segment.ProductionOrderOperationId);
      const start = storedIsoTimestamp(segment.PlannedStartAt);
      const end = storedIsoTimestamp(segment.PlannedEndAt);
      if (!start || !end) continue;
      windows.set(segment.ProductionOrderOperationId, {
        plannedStartAt: existing && existing.plannedStartAt < start ? existing.plannedStartAt : start,
        plannedEndAt: existing && existing.plannedEndAt > end ? existing.plannedEndAt : end,
      });
    }

    const openStatuses = new Set(["released", "in-progress"]);
    const crpOperations = operations
      .filter((op) => op.PlantId === plantId && openStatuses.has(orders.find((order) => order.Id === op.ProductionOrderId)?.Status ?? ""))
      .map((op) => ({
        operationId: op.Id,
        workCenterId: op.WorkCenterId,
        capacityMinutes: storedNumber(op.PlannedCapacityMinutes),
        plannedStartAt: windows.get(op.Id)?.plannedStartAt ?? null,
        plannedEndAt: windows.get(op.Id)?.plannedEndAt ?? null,
        quantity: storedNumber(op.PlannedQuantity),
        productionOrderId: op.ProductionOrderId,
      }));

    /* سفارش‌های برنامه‌ریزی‌شده هنوز زمان‌بندی ندارند؛ CRP باید بار آیندهٔ آن‌ها
     * را هم ببیند وگرنه ظرفیت «خالی» نشان داده می‌شود در حالی که تعهد شده است. */
    const partById = new Map(parts.map((part) => [part.Id, part]));
    const plannedLoad = plannedOrders
      .filter((row) => row.PlantId === plantId && ["proposed", "approved"].includes(row.Status))
      .map((row) => ({
        operationId: `planned:${row.Id}`,
        workCenterId: null,
        capacityMinutes: 0,
        plannedStartAt: row.PlannedReleaseAt,
        plannedEndAt: row.PlannedDueAt,
        quantity: storedNumber(row.Quantity),
        plannedOrderId: row.Id,
        partNo: partById.get(row.PartId)?.PartNo ?? null,
      }));

    const result = runPlanning(() => computeCapacityRequirements({
      buckets,
      operations: crpOperations,
      workCenters: centers,
      overloadThresholdPct: overloadPct,
      underloadThresholdPct: underloadPct,
    }));

    return {
      bucketUnit,
      bucketCount,
      horizonStart: buckets[0].start,
      horizonEnd: buckets[buckets.length - 1].end,
      scheduleVersion: latestVersion,
      includePlannedOrders,
      scheduledOperationCount: crpOperations.length,
      plannedOrderCount: plannedLoad.length,
      ...result,
    };
  };

  const parseCrpQuery = (q) => {
    assertOnlyQueryKeys(q, new Set(["bucket", "bucketCount", "horizonStart", "overloadPct", "underloadPct", "includePlannedOrders"]));
    const bucketUnit = text(q.bucket ?? "week", "bucket", { required: true, max: 8 });
    if (!TIME_BUCKETS.has(bucketUnit)) throw bad("bucket", "bucket باید day/week/month باشد");
    /* مقدارهای query رشته‌اند؛ number() فقط typeof number را می‌پذیرد و هر
     * درخواست GET با bucketCount را ۴۰۰ می‌کرد. pageNumber رشتهٔ صحیح می‌گیرد. */
    const bucketCount = pageNumber(q.bucketCount, "bucketCount", 8, 260);
    const overloadPct = pageNumber(q.overloadPct, "overloadPct", 100, 500);
    const underloadPct = pageNumber(q.underloadPct, "underloadPct", 60, 100);
    if (bucketCount < 1) throw bad("bucketCount", "«bucketCount» باید دست‌کم ۱ باشد");
    if (overloadPct < 1) throw bad("overloadPct", "«overloadPct» باید دست‌کم ۱ باشد");
    return {
      bucketUnit,
      bucketCount,
      horizonStart: isoDate(q.horizonStart, "horizonStart") ?? new Date().toISOString().slice(0, 10),
      overloadPct,
      underloadPct,
      includePlannedOrders: q.includePlannedOrders === "false" ? false : true,
    };
  };

  app.post(`${ROOT}/crp/calculate`, route("mfg.crp.view", async ({ repo: r, req, plantId }) => {
    const body = req.body ?? {};
    assertOnlyKeys(body, new Set(["Bucket", "BucketCount", "HorizonStart", "OverloadPct", "UnderloadPct", "IncludePlannedOrders"]));
    const options = parseCrpQuery({
      ...(body.Bucket !== undefined ? { bucket: body.Bucket } : {}),
      ...(body.BucketCount !== undefined ? { bucketCount: body.BucketCount } : {}),
      ...(body.HorizonStart !== undefined ? { horizonStart: body.HorizonStart } : {}),
      ...(body.OverloadPct !== undefined ? { overloadPct: body.OverloadPct } : {}),
      ...(body.UnderloadPct !== undefined ? { underloadPct: body.UnderloadPct } : {}),
      ...(body.IncludePlannedOrders !== undefined ? { includePlannedOrders: body.IncludePlannedOrders === true || body.IncludePlannedOrders === "true" ? "true" : "false" } : {}),
    });
    return runCrp(r, plantId, options);
  }));

  app.get(`${ROOT}/crp/summary`, route("mfg.crp.view", async ({ repo: r, req, plantId }) => {
    const options = parseCrpQuery(req.query ?? {});
    const full = await runCrp(r, plantId, options);
    return {
      ...full,
      workCenters: full.workCenters.map((center) => ({
        workCenterId: center.workCenterId,
        code: center.code,
        totalLoadMinutes: center.totalLoadMinutes,
        totalCapacityMinutes: center.totalCapacityMinutes,
        utilizationPct: center.utilizationPct,
        peakUtilizationPct: center.peakUtilizationPct,
        overloadBucketCount: center.overloadBucketCount,
        underloadBucketCount: center.underloadBucketCount,
      })),
    };
  }));

  /* ════════════════════════════════════════════════════════════════════════
   * فاز ۵ — بخش ۱۱.۱۱ انطباق ISA-95 / MESA-11
   * ════════════════════════════════════════════════════════════════════════ */

  app.get(`${ROOT}/conformance/isa95`, route("mfg.conformance.view", async ({ repo: r, req, plantId }) => {
    const q = req.query ?? {};
    assertOnlyQueryKeys(q, new Set([]));
    /* پوشش هر یک از ۱۱ عملکرد MESA با مسیر واقعی همان عملکرد سنجیده می‌شود،
     * نه با یک ادعای ثابت؛ اگر مسیری حذف شود این گزارش هم دروغ نمی‌گوید
     * چون از همان فهرست مسیرهای پیاده‌شده خوانده می‌شود. */
    const implemented = new Set(MANUFACTURING_IMPLEMENTED_ROUTES);
    const has = (route) => implemented.has(route);
    const mesaFunctions = [
      { id: 1, code: "operations-scheduling", fa: "زمان‌بندی عملیات", en: "Operations / Detail Scheduling", routes: [`POST ${ROOT}/scheduling/runs`, `POST ${ROOT}/scheduling/reschedules`] },
      { id: 2, code: "dispatching", fa: "اعزام تولید", en: "Dispatching Production Units", routes: [`GET ${ROOT}/operation-queue`, `POST ${ROOT}/orders/:orderId/release`] },
      { id: 3, code: "data-collection", fa: "گردآوری داده", en: "Data Collection / Acquisition", routes: [`POST ${ROOT}/operations/:operationId/executions`, `POST ${ROOT}/executions/:executionId/reports`] },
      { id: 4, code: "resource-management", fa: "مدیریت منابع", en: "Resource Allocation & Status", routes: [`GET ${ROOT}/work-centers`, `POST ${ROOT}/work-centers/:workCenterId/resources`, `GET ${ROOT}/capacity/load`] },
      { id: 5, code: "product-tracking", fa: "ردیابی محصول", en: "Product Tracking & Genealogy", routes: [`GET ${ROOT}/mrp/pegging`, `GET ${ROOT}/orders/:orderId`] },
      { id: 6, code: "performance-analysis", fa: "تحلیل عملکرد", en: "Performance Analysis", routes: [`GET ${ROOT}/dashboard/oee`, `GET ${ROOT}/operations/:operationId/variance`, `GET ${ROOT}/crp/summary`] },
      { id: 7, code: "quality-management", fa: "مدیریت کیفیت", en: "Quality Management", routes: [`POST ${ROOT}/scrap`, `POST ${ROOT}/rework`, `POST ${ROOT}/executions/:executionId/finish`] },
      { id: 8, code: "maintenance-management", fa: "مدیریت نگهداری", en: "Maintenance Management", routes: [`POST ${ROOT}/downtime`, `GET ${ROOT}/alerts`] },
      { id: 9, code: "document-control", fa: "کنترل مستندات", en: "Document Control", routes: [`GET ${ROOT}/routings`, `GET ${ROOT}/bom-headers`, `GET ${ROOT}/production-versions`] },
      { id: 10, code: "labor-management", fa: "مدیریت نیروی کار", en: "Labor Management", routes: [`POST ${ROOT}/operations/:operationId/executions`, `GET ${ROOT}/operation-queue`] },
      { id: 11, code: "production-tracking", fa: "پیگیری تولید", en: "Production Tracking", routes: [`GET ${ROOT}/orders`, `GET ${ROOT}/scheduling/gantt`] },
    ];
    const rows = mesaFunctions.map((fn) => {
      const covered = fn.routes.filter((route) => has(route));
      return {
        id: fn.id,
        code: fn.code,
        titleFa: fn.fa,
        titleEn: fn.en,
        coveredRouteCount: covered.length,
        totalRouteCount: fn.routes.length,
        coveragePct: roundTo3((covered.length / fn.routes.length) * 100),
        routes: fn.routes.map((route) => ({ route, implemented: has(route) })),
      };
    });
    /* استقلال منطقی دیتابیس یک ادعای دستی نیست: از خود اسکیما شمرده می‌شود تا
     * اگر روزی FK تازه‌ای به جدولی بیرون ماژول اضافه شد، این گزارش همان لحظه
     * نقض را نشان دهد. */
    const mfgTables = tablesOfModule("mfg");
    const foreignKeysToLevel4 = [];
    let mfgForeignKeyCount = 0;
    for (const table of mfgTables) {
      for (const fk of table.foreignKeys ?? []) {
        mfgForeignKeyCount += 1;
        if (!String(fk.refTable ?? "").startsWith("Mfg")) {
          foreignKeysToLevel4.push(`${table.name}.${fk.column} -> ${fk.refTable}`);
        }
      }
    }

    const counts = await Promise.all([
      r.count("MfgProductionOrder", [{ column: "PlantId", op: "eq", value: plantId }]),
      r.count("MfgPlannedOrder", [{ column: "PlantId", op: "eq", value: plantId }]),
      r.count("MfgMasterScheduleRun", [{ column: "PlantId", op: "eq", value: plantId }]),
      r.count("MfgOperationExecution", [{ column: "PlantId", op: "eq", value: plantId }]),
    ]);
    return {
      modelVersion: MANUFACTURING_PLANNING_MODEL_VERSION,
      isa95: {
        level3: {
          role: "MES — اجرای تولید",
          roleEn: "Manufacturing Operations Management",
          implementedRouteCount: MANUFACTURING_IMPLEMENTED_ROUTES.length,
          counts: {
            productionOrders: counts[0],
            plannedOrders: counts[1],
            masterScheduleRuns: counts[2],
            operationExecutions: counts[3],
          },
        },
        level4: {
          role: "ERP — مالی، فروش و تدارکات",
          roleEn: "Business Planning & Logistics",
          integration: "REST",
          /* MES این سامانه عمداً مستقل است؛ سطح ۴ از طریق کلیدهای نرم
           * (ProjectId/ContractId/CustomerRef) و تبادل REST وصل می‌شود، نه FK. */
          softKeys: ["ProjectId", "ContractId", "CustomerRef", "DemandRef"],
          foreignKeysToLevel4: foreignKeysToLevel4.length,
          foreignKeysToLevel4Detail: foreignKeysToLevel4,
          mfgTableCount: mfgTables.length,
          mfgForeignKeyCount: mfgForeignKeyCount,
        },
        boundary: foreignKeysToLevel4.length === 0
          ? "هیچ کلید خارجی از جداول Mfg* به جداول سطح ۴ وجود ندارد؛ استقلال منطقی دیتابیس حفظ شده است."
          : `${foreignKeysToLevel4.length} کلید خارجی از جداول Mfg* به جداول بیرون ماژول وجود دارد و استقلال منطقی دیتابیس نقض شده است.`,
      },
      mesa11: {
        functionCount: rows.length,
        fullyCovered: rows.filter((row) => row.coveragePct === 100).length,
        averageCoveragePct: roundTo3(rows.reduce((sum, row) => sum + row.coveragePct, 0) / rows.length),
        functions: rows,
      },
    };
  }));
}
