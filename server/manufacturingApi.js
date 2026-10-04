/**
 * MFG v1 HTTP boundary.
 *
 * مسیرهای پایه، آزادسازی سفارش و زمان‌بندی ظرفیت/نمایش Gantt را فعال می‌کند؛
 * سایر commandهای چندجدولی تا پیاده‌سازی مرحله‌ای UoW دامنه‌ای در قرارداد می‌مانند.
 */

import { SchedulePlanningError, planManufacturingSchedule } from "./manufacturingScheduler.js";

const API_VERSION = "mfg-api-v1";
const ROOT = "/api/mfg/plants/:plantId";
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/;
const PART_TYPES = new Set(["manufactured", "purchased", "phantom", "subcontract"]);
const DEMAND_SOURCES = new Set(["sales-order", "contract", "forecast", "manual"]);
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
const COST_ELEMENTS = ["material", "machine", "labor", "overhead"];
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

/* ─────────── رول‌آپ هزینهٔ عملیات از دادهٔ واقعی کارگاه ───────────
 *
 * هیچ مسیری در قرارداد، `MfgOperationCost` را پیش از تطبیق نمی‌سازد. اگر
 * محاسبهٔ هزینه فقط به ردیف‌های از پیش موجود تکیه کند، `reconcile` هرگز
 * اجرا نمی‌شود و در نتیجه `close` هم هرگز ممکن نیست. این تابع همان ردیف‌ها
 * را از شواهد واقعی می‌سازد:
 *   - ماده: نیازمندی‌ها (استاندارد) و مصرف‌های واقعی (واقعی)
 *   - ماشین/نیروی کار/سربار: دقایق برنامه‌ای و واقعی × نرخ مرکز هزینه،
 *     و در نبود مرکز هزینه، نرخ خود مرکز کاری بر پایهٔ نوع آن.
 */
async function deriveOperationCostRows(db, { plantId, operations, costVersion }) {
  if (!Array.isArray(operations) || operations.length === 0) return [];
  const [consumptions, requirements, parts, materials, workCenters, costCenters, executions] = await Promise.all([
    db.list("MfgMaterialConsumption", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgMaterialRequirement", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgWorkCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    db.list("MfgCostCenter", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    /* دقیقهٔ واقعی روی «اجرا» ثبت می‌شود نه روی خود عملیات؛ بدون این جدول
     * عناصر ماشین/دستمزد/سربار همیشه هزینهٔ واقعی صفر می‌گرفتند. */
    db.list("MfgOperationExecution", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
  ]);

  const materialById = new Map(materials.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));
  const partById = new Map(parts.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));
  const centerById = new Map(workCenters.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));
  const costCenterById = new Map(costCenters.filter((row) => row.PlantId === plantId).map((row) => [row.Id, row]));

  /* نرخ‌ها از مرکز هزینه می‌آیند: هر عنصر نرخ ساعتی خودش را دارد و
   * CostCenterId عملیات/مرکز کاری فقط مرکز ترجیحی همان عنصر را انتخاب می‌کند.
   * نبود نرخ یعنی صفر — نه نرخ حدسی. */
  const costCenterFor = (costCenterId, element) => {
    const candidates = costCenters.filter(
      (row) => row.PlantId === plantId && row.IsActive !== false && row.CostElement === element,
    );
    return (costCenterId ? candidates.find((row) => row.Id === costCenterId) : null) ?? candidates[0] ?? null;
  };
  const rateFor = (costCenterId, element) => {
    const chosen = costCenterFor(costCenterId, element);
    return chosen && chosen.HourlyRate !== null && chosen.HourlyRate !== undefined ? storedNumber(chosen.HourlyRate) : 0;
  };

  const executionsByOperation = new Map();
  for (const row of executions) {
    if (row.PlantId !== plantId) continue;
    const list = executionsByOperation.get(row.ProductionOrderOperationId) ?? [];
    list.push(row);
    executionsByOperation.set(row.ProductionOrderOperationId, list);
  }

  const hours = (minutes) => roundTo3(storedNumber(minutes) / 60);
  const rows = [];

  for (const operation of operations) {
    const workCenter = centerById.get(operation.WorkCenterId) ?? null;
    const operationConsumptions = consumptions.filter(
      (row) => row.PlantId === plantId && row.ProductionOrderOperationId === operation.Id,
    );
    const operationRequirements = requirements.filter(
      (row) => row.PlantId === plantId && row.ProductionOrderOperationId === operation.Id,
    );

    /* نرخ استاندارد ماده = بهای واحد هر جزء در فهرست مواد/قطعه؛ مقدار
     * استاندارد = مجموع مقدار خالص نیازمندی‌ها. تقسیم نرخ بر تعداد ردیف
     * اشتباه است، چون هر ردیف بهای واحد خودش را دارد. */
    const standardMaterialQty = roundTo3(operationRequirements.reduce((sum, row) => sum + storedNumber(row.NetQuantity), 0));
    const standardMaterialAmount = roundTo3(operationRequirements.reduce((sum, row) => {
      const material = materialById.get(row.MaterialId);
      const part = material ? partById.get(material.PartId) : null;
      const unitCost = storedNumber(material?.StandardUnitCost ?? part?.StandardUnitCost);
      return sum + storedNumber(row.NetQuantity) * unitCost;
    }, 0));
    const standardMaterialRate = standardMaterialQty > 0
      ? roundTo3(standardMaterialAmount / standardMaterialQty)
      : 0;
    const actualMaterialQty = roundTo3(operationConsumptions.reduce((sum, row) => sum + storedNumber(row.Quantity), 0));
    const actualMaterialAmount = roundTo3(operationConsumptions.reduce(
      (sum, row) => sum + storedNumber(row.Quantity) * storedNumber(row.UnitCost),
      0,
    ));
    const actualMaterialRate = actualMaterialQty > 0
      ? roundTo3(actualMaterialAmount / actualMaterialQty)
      : standardMaterialRate;

    rows.push({
      PlantId: plantId,
      ProductionOrderOperationId: operation.Id,
      CostCenterId: operation.CostCenterId ?? workCenter?.CostCenterId ?? null,
      CostElement: "material",
      CostVersion: costVersion,
      StandardQuantity: standardMaterialQty,
      ActualQuantity: actualMaterialQty,
      StandardRate: standardMaterialRate,
      ActualRate: actualMaterialRate,
      StandardAmount: standardMaterialAmount,
      ActualAmount: actualMaterialAmount,
      Currency: operationConsumptions[0]?.Currency ?? "IRR",
      CalculatedAt: new Date().toISOString(),
      SourceRef: "derived-from-actuals",
    });

    const plannedMinutes = roundTo3(
      storedNumber(operation.PlannedSetupMinutes)
      + storedNumber(operation.PlannedRunMinutesPerUnit) * storedNumber(operation.PlannedQuantity),
    );
    /* منبع اصلی دقیقهٔ واقعی، ردیف‌های اجراست؛ اگر اجراها هنوز دقیقه‌ای
     * ثبت نکرده باشند، مقدار خود عملیات (اگر پر شده باشد) جایگزین می‌شود. */
    const operationExecutions = executionsByOperation.get(operation.Id) ?? [];
    const executionMinutes = roundTo3(operationExecutions.reduce(
      (sum, row) => sum + storedNumber(row.SetupActualMinutes) + storedNumber(row.RunActualMinutes),
      0,
    ));
    const actualMinutes = executionMinutes > 0
      ? executionMinutes
      : roundTo3(storedNumber(operation.ActualSetupMinutes) + storedNumber(operation.ActualRunMinutes));
    const costCenterId = operation.CostCenterId ?? workCenter?.CostCenterId ?? null;

    for (const element of ["machine", "labor", "overhead"]) {
      const center = costCenterFor(costCenterId, element);
      const rate = rateFor(costCenterId, element);
      const standardQty = hours(plannedMinutes);
      const actualQty = hours(actualMinutes);
      rows.push({
        PlantId: plantId,
        ProductionOrderOperationId: operation.Id,
        CostCenterId: costCenterId,
        CostElement: element,
        CostVersion: costVersion,
        StandardQuantity: standardQty,
        ActualQuantity: actualQty,
        StandardRate: rate,
        ActualRate: rate,
        StandardAmount: roundTo3(standardQty * rate),
        ActualAmount: roundTo3(actualQty * rate),
        Currency: center?.Currency ?? "IRR",
        CalculatedAt: new Date().toISOString(),
        SourceRef: "derived-from-actuals",
      });
    }
  }

  return rows;
}

function rollupCostElements(rows) {
  const totals = {
    material: { standard: 0, actual: 0 },
    machine: { standard: 0, actual: 0 },
    labor: { standard: 0, actual: 0 },
    overhead: { standard: 0, actual: 0 },
  };
  for (const row of rows) {
    const bucket = totals[row.CostElement];
    if (!bucket) continue;
    bucket.standard = roundTo3(bucket.standard + storedNumber(row.StandardAmount));
    bucket.actual = roundTo3(bucket.actual + storedNumber(row.ActualAmount));
  }
  return totals;
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
        scheduleRuns,
      ] = await Promise.all([
        db.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgPart", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgBomHeader", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgBomItem", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgMaterial", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
        db.list("MfgInventoryLevel", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
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

      return {
        calculationAt: new Date().toISOString(),
        previewOnly,
        scheduleVersion,
        requirements: persistedRequirements,
        shortages,
        proposals,
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

    const [orderCostRows, operations, opCostRows] = await Promise.all([
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
      r.list("MfgOperationCost", {
        where: [{ column: "PlantId", op: "eq", value: plantId }],
      }),
    ]);

    const validOrderCosts = orderCostRows.filter((row) => row.PlantId === plantId && row.ProductionOrderId === orderId);
    const opIds = new Set(operations.filter((op) => op.PlantId === plantId).map((op) => op.Id));
    const orderOpCosts = opCostRows.filter((row) => row.PlantId === plantId && opIds.has(row.ProductionOrderOperationId));

    const targetVersion = requestedVersion
      ?? validOrderCosts[0]?.CostVersion
      ?? orderOpCosts.reduce((max, row) => Math.max(max, Number(row.CostVersion) || 0), 0)
      ?? 1;

    const matchedSummary = validOrderCosts.find((row) => row.CostVersion === targetVersion) ?? null;
    const versionOpCosts = orderOpCosts.filter((row) => row.CostVersion === targetVersion);

    if (requestedVersion !== null && !matchedSummary && versionOpCosts.length === 0) {
      throw notFound();
    }

    if (matchedSummary) {
      const stdMat = roundTo3(storedNumber(matchedSummary.StandardMaterialCost));
      const actMat = roundTo3(storedNumber(matchedSummary.ActualMaterialCost));
      const stdMach = roundTo3(storedNumber(matchedSummary.StandardMachineCost));
      const actMach = roundTo3(storedNumber(matchedSummary.ActualMachineCost));
      const stdLab = roundTo3(storedNumber(matchedSummary.StandardLaborCost));
      const actLab = roundTo3(storedNumber(matchedSummary.ActualLaborCost));
      const stdOvh = roundTo3(storedNumber(matchedSummary.StandardOverheadCost));
      const actOvh = roundTo3(storedNumber(matchedSummary.ActualOverheadCost));
      const stdTot = roundTo3(storedNumber(matchedSummary.StandardTotalCost));
      const actTot = roundTo3(storedNumber(matchedSummary.ActualTotalCost));
      const contractRevenue = matchedSummary.ContractRevenue === null || matchedSummary.ContractRevenue === undefined
        ? null
        : roundTo3(storedNumber(matchedSummary.ContractRevenue));
      const grossMargin = matchedSummary.GrossMargin === null || matchedSummary.GrossMargin === undefined
        ? (contractRevenue === null ? null : roundTo3(contractRevenue - actTot))
        : roundTo3(storedNumber(matchedSummary.GrossMargin));

      return {
        ...matchedSummary,
        ProductionOrderId: orderId,
        CostVersion: targetVersion,
        Currency: matchedSummary.Currency ?? "IRR",
        StandardMaterialCost: stdMat,
        ActualMaterialCost: actMat,
        StandardMachineCost: stdMach,
        ActualMachineCost: actMach,
        StandardLaborCost: stdLab,
        ActualLaborCost: actLab,
        StandardOverheadCost: stdOvh,
        ActualOverheadCost: actOvh,
        StandardTotalCost: stdTot,
        ActualTotalCost: actTot,
        Variance: roundTo3(actTot - stdTot),
        ContractRevenue: contractRevenue,
        GrossMargin: grossMargin,
        ByElement: {
          material: { standard: stdMat, actual: actMat },
          machine: { standard: stdMach, actual: actMach },
          labor: { standard: stdLab, actual: actLab },
          overhead: { standard: stdOvh, actual: actOvh },
        },
        Reconciled: Boolean(matchedSummary.Reconciled),
        ReconciledAt: matchedSummary.ReconciledAt ?? null,
      };
    }

    const orderOps = operations.filter((op) => op.PlantId === plantId);
    const effectiveOpCosts = versionOpCosts.length > 0
      ? versionOpCosts
      : await deriveOperationCostRows(r, { plantId, operations: orderOps, costVersion: targetVersion });
    const byElement = {
      material: { standard: 0, actual: 0 },
      machine: { standard: 0, actual: 0 },
      labor: { standard: 0, actual: 0 },
      overhead: { standard: 0, actual: 0 },
    };
    for (const row of effectiveOpCosts) {
      if (!byElement[row.CostElement]) continue;
      byElement[row.CostElement].standard = roundTo3(byElement[row.CostElement].standard + storedNumber(row.StandardAmount));
      byElement[row.CostElement].actual = roundTo3(byElement[row.CostElement].actual + storedNumber(row.ActualAmount));
    }
    const standardTotalCost = roundTo3(
      byElement.material.standard + byElement.machine.standard + byElement.labor.standard + byElement.overhead.standard,
    );
    const actualTotalCost = roundTo3(
      byElement.material.actual + byElement.machine.actual + byElement.labor.actual + byElement.overhead.actual,
    );

    return {
      ProductionOrderId: orderId,
      CostVersion: targetVersion,
      Currency: versionOpCosts[0]?.Currency ?? "IRR",
      StandardMaterialCost: byElement.material.standard,
      ActualMaterialCost: byElement.material.actual,
      StandardMachineCost: byElement.machine.standard,
      ActualMachineCost: byElement.machine.actual,
      StandardLaborCost: byElement.labor.standard,
      ActualLaborCost: byElement.labor.actual,
      StandardOverheadCost: byElement.overhead.standard,
      ActualOverheadCost: byElement.overhead.actual,
      StandardTotalCost: standardTotalCost,
      ActualTotalCost: actualTotalCost,
      Variance: roundTo3(actualTotalCost - standardTotalCost),
      ContractRevenue: null,
      GrossMargin: null,
      ByElement: byElement,
      Reconciled: false,
      ReconciledAt: null,
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

    const rows = await r.list("MfgOperationCost", {
      where: [
        { column: "PlantId", op: "eq", value: plantId },
        { column: "ProductionOrderOperationId", op: "eq", value: operationId },
      ],
    });
    let items = rows
      .filter((row) => row.PlantId === plantId
        && row.ProductionOrderOperationId === operationId
        && (requestedVersion === null || row.CostVersion === requestedVersion))
      .sort((a, b) => (b.CostVersion ?? 0) - (a.CostVersion ?? 0)
        || String(a.CostElement).localeCompare(String(b.CostElement)));

    /* خواندن نباید رد شود: نبود ردیف ذخیره‌شده یعنی رول‌آپ لحظه‌ای از
     * مصرف‌ها، نیازمندی‌ها و دقایق واقعی عملیات. */
    if (items.length === 0) {
      items = await deriveOperationCostRows(r, {
        plantId,
        operations: [operation],
        costVersion: requestedVersion ?? 1,
      });
    }

    return { items, derived: rows.length === 0 };
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
    const modelVersion = text(body.ModelVersion, "ModelVersion", { max: 40 }) ?? "mfg-cost-v1";

    const fingerprint = JSON.stringify({
      orderId,
      costVersion,
      reconcileThrough,
      contractRevenue: contractRevenueInput,
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

      const [operations, executions, requirements, existingCostRows, allOpCosts] = await Promise.all([
        tx.list("MfgProductionOrderOperation", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "ProductionOrderId", op: "eq", value: orderId },
          ],
        }),
        tx.list("MfgOperationExecution", {
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
        tx.list("MfgOperationCost", {
          where: [{ column: "PlantId", op: "eq", value: plantId }],
        }),
      ]);

      const orderOps = operations.filter((op) => op.PlantId === plantId && op.ProductionOrderId === orderId);
      if (orderOps.length === 0 || orderOps.some((op) => op.Status !== "completed")) {
        throw businessRule("MFG_OPERATIONS_NOT_COMPLETED", "پیش از تطبیق هزینهٔ سفارش، تمام عملیات‌های سفارش باید تکمیل شده باشند");
      }
      const opIds = new Set(orderOps.map((op) => op.Id));
      const runningExecs = executions.filter((ex) => ex.PlantId === plantId && opIds.has(ex.ProductionOrderOperationId) && ex.Status === "running");
      if (runningExecs.length > 0) {
        throw businessRule("MFG_OPERATIONS_NOT_COMPLETED", "نشست اجرای باز روی عملیات سفارش وجود دارد");
      }

      const openShortages = requirements.filter(
        (reqRow) => reqRow.PlantId === plantId
          && reqRow.ProductionOrderId === orderId
          && (reqRow.Status === "shortage" || storedNumber(reqRow.ShortageQuantity) > 0),
      );
      if (openShortages.length > 0) {
        throw businessRule("MFG_MATERIALS_NOT_RECONCILED", "پیش از تطبیق نهایی هزینه، کمبودهای مواد سفارش باید تعیین‌تکلیف شوند");
      }

      const existingOrderCost = existingCostRows.find(
        (row) => row.PlantId === plantId && row.ProductionOrderId === orderId && row.CostVersion === costVersion,
      ) ?? null;

      if (existingOrderCost) {
        if (existingOrderCost.RowVersion !== expectedVersion && order.RowVersion !== expectedVersion) {
          throw conflict("MFG_ROW_VERSION_CONFLICT", "رکورد هزینهٔ سفارش از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
        }
      } else if (order.RowVersion !== expectedVersion) {
        throw conflict("MFG_ROW_VERSION_CONFLICT", "رکورد سفارش از زمان خواندن تغییر کرده است؛ تازه‌خوانی کنید");
      }

      let opCostsForVersion = allOpCosts.filter(
        (row) => row.PlantId === plantId
          && opIds.has(row.ProductionOrderOperationId)
          && row.CostVersion === costVersion,
      );

      /* اگر هیچ ردیف هزینه‌ای برای این نسخه ثبت نشده باشد، رول‌آپ از شواهد
       * واقعی ساخته و در همان تراکنش ذخیره می‌شود؛ وگرنه reconcile هیچ‌وقت
       * اجرا نمی‌شد و گیت `close` هم هرگز باز نمی‌شد. */
      let derivedCostRows = [];
      if (opCostsForVersion.length === 0) {
        derivedCostRows = await deriveOperationCostRows(tx, { plantId, operations: orderOps, costVersion });
        opCostsForVersion = [];
        for (const row of derivedCostRows) {
          opCostsForVersion.push(await tx.create("MfgOperationCost", row, subject.id));
        }
      }

      let stdMat = 0;
      let actMat = 0;
      let stdMach = 0;
      let actMach = 0;
      let stdLab = 0;
      let actLab = 0;
      let stdOvh = 0;
      let actOvh = 0;

      if (opCostsForVersion.length > 0) {
        for (const row of opCostsForVersion) {
          const s = storedNumber(row.StandardAmount);
          const a = storedNumber(row.ActualAmount);
          if (row.CostElement === "material") { stdMat = roundTo3(stdMat + s); actMat = roundTo3(actMat + a); }
          if (row.CostElement === "machine") { stdMach = roundTo3(stdMach + s); actMach = roundTo3(actMach + a); }
          if (row.CostElement === "labor") { stdLab = roundTo3(stdLab + s); actLab = roundTo3(actLab + a); }
          if (row.CostElement === "overhead") { stdOvh = roundTo3(stdOvh + s); actOvh = roundTo3(actOvh + a); }
        }
      } else if (existingOrderCost) {
        stdMat = roundTo3(storedNumber(existingOrderCost.StandardMaterialCost));
        actMat = roundTo3(storedNumber(existingOrderCost.ActualMaterialCost));
        stdMach = roundTo3(storedNumber(existingOrderCost.StandardMachineCost));
        actMach = roundTo3(storedNumber(existingOrderCost.ActualMachineCost));
        stdLab = roundTo3(storedNumber(existingOrderCost.StandardLaborCost));
        actLab = roundTo3(storedNumber(existingOrderCost.ActualLaborCost));
        stdOvh = roundTo3(storedNumber(existingOrderCost.StandardOverheadCost));
        actOvh = roundTo3(storedNumber(existingOrderCost.ActualOverheadCost));
      } else {
        throw businessRule("MFG_COST_VERSION_NOT_FOUND", `هیچ ردیف هزینه‌ای برای نسخهٔ ${costVersion} یافت نشد`);
      }

      const computedStdTotal = roundTo3(stdMat + stdMach + stdLab + stdOvh);
      const computedActTotal = roundTo3(actMat + actMach + actLab + actOvh);

      if (existingOrderCost) {
        const storedStdTotal = roundTo3(storedNumber(existingOrderCost.StandardTotalCost));
        const storedActTotal = roundTo3(storedNumber(existingOrderCost.ActualTotalCost));
        if (Math.abs(storedStdTotal - computedStdTotal) > 0.01 || Math.abs(storedActTotal - computedActTotal) > 0.01) {
          throw businessRule("MFG_COST_TOTAL_MISMATCH", "جمع اجزای هزینه با مبلغ کل هزینهٔ سفارش برابر نیست");
        }
      }

      const effectiveRevenue = contractRevenueInput !== null
        ? contractRevenueInput
        : existingOrderCost?.ContractRevenue !== null && existingOrderCost?.ContractRevenue !== undefined
          ? roundTo3(storedNumber(existingOrderCost.ContractRevenue))
          : null;
      const grossMargin = effectiveRevenue === null ? null : roundTo3(effectiveRevenue - computedActTotal);
      const reconciledAt = new Date().toISOString();
      const currency = existingOrderCost?.Currency ?? opCostsForVersion[0]?.Currency ?? "IRR";

      let saved;
      if (existingOrderCost) {
        const patchRes = await tx.patch("MfgOrderCost", existingOrderCost.Id, {
          StandardMaterialCost: stdMat,
          ActualMaterialCost: actMat,
          StandardMachineCost: stdMach,
          ActualMachineCost: actMach,
          StandardLaborCost: stdLab,
          ActualLaborCost: actLab,
          StandardOverheadCost: stdOvh,
          ActualOverheadCost: actOvh,
          StandardTotalCost: computedStdTotal,
          ActualTotalCost: computedActTotal,
          ContractRevenue: effectiveRevenue,
          GrossMargin: grossMargin,
          Reconciled: true,
          ReconciledAt: reconciledAt,
          ModelVersion: modelVersion,
        }, subject.id, existingOrderCost.RowVersion);
        if (!patchRes.ok) throw conflict("MFG_ROW_VERSION_CONFLICT", "رکورد هزینهٔ سفارش هم‌زمان تغییر کرده است");
        saved = await tx.get("MfgOrderCost", existingOrderCost.Id);
      } else {
        saved = await tx.create("MfgOrderCost", {
          PlantId: plantId,
          ProductionOrderId: orderId,
          CostVersion: costVersion,
          Currency: currency,
          StandardMaterialCost: stdMat,
          ActualMaterialCost: actMat,
          StandardMachineCost: stdMach,
          ActualMachineCost: actMach,
          StandardLaborCost: stdLab,
          ActualLaborCost: actLab,
          StandardOverheadCost: stdOvh,
          ActualOverheadCost: actOvh,
          StandardTotalCost: computedStdTotal,
          ActualTotalCost: computedActTotal,
          ContractRevenue: effectiveRevenue,
          GrossMargin: grossMargin,
          Reconciled: true,
          ReconciledAt: reconciledAt,
          ModelVersion: modelVersion,
        }, subject.id);
      }

      await createAuditRecord(tx, req, "MFG_ORDER_COST_RECONCILED", "MfgOrderCost", saved.Id, "mfg.cost.reconcile", {
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        orderId,
        costVersion,
        reconcileThrough,
      });

      return saved;
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

  app.get(`${ROOT}/dashboard/overview`, route("mfg.dashboard.view", async ({ repo: r, req, plantId }) => {
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
      const wc = await r.get("MfgWorkCenter", workCenterId);
      if (!wc || wc.PlantId !== plantId) throw notFound();
    }

    const [orders, operations, executions, requirements, alerts] = await Promise.all([
      r.list("MfgProductionOrder", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgOperationExecution", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgMaterialRequirement", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgProductionAlert", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);

    const plantOrders = orders.filter((o) => o.PlantId === plantId);
    const openOrdersCount = plantOrders.filter((o) => ["created", "released", "in-progress"].includes(o.Status)).length;

    const completedInWindow = plantOrders.filter((o) => {
      if (!["completed", "closed"].includes(o.Status)) return false;
      const finMs = storedTimestamp(o.ClosedAt ?? o.UpdatedAt ?? o.DueAt);
      return Number.isFinite(finMs) && finMs >= fromMs && finMs < toMs;
    });
    const completedOnTimeCount = completedInWindow.filter((o) => {
      const finMs = storedTimestamp(o.ClosedAt ?? o.UpdatedAt ?? o.DueAt);
      const dueMs = storedTimestamp(o.DueAt);
      return Number.isFinite(finMs) && Number.isFinite(dueMs) && finMs <= dueMs;
    }).length;
    const onTimeDeliveryPct = completedInWindow.length === 0
      ? null
      : roundTo3((completedOnTimeCount / completedInWindow.length) * 100);

    const allowedOpIds = new Set(
      operations
        .filter((op) => op.PlantId === plantId && (!workCenterId || op.WorkCenterId === workCenterId))
        .map((op) => op.Id),
    );

    const execsInWindow = executions.filter((ex) => {
      if (ex.PlantId !== plantId || ex.Status === "cancelled" || !allowedOpIds.has(ex.ProductionOrderOperationId)) return false;
      const startMs = storedTimestamp(ex.StartedAt);
      return Number.isFinite(startMs) && startMs >= fromMs && startMs < toMs;
    });

    const goodQuantity = roundTo3(execsInWindow.reduce((s, ex) => s + storedNumber(ex.GoodQuantity), 0));
    const scrapQuantity = roundTo3(execsInWindow.reduce((s, ex) => s + storedNumber(ex.ScrapQuantity), 0));
    const reworkQuantity = roundTo3(execsInWindow.reduce((s, ex) => s + storedNumber(ex.ReworkQuantity), 0));

    const shortagesInWindow = requirements.filter((reqRow) => {
      if (reqRow.PlantId !== plantId || reqRow.Status !== "shortage" || storedNumber(reqRow.ShortageQuantity) <= 0) return false;
      if (workCenterId && reqRow.ProductionOrderOperationId && !allowedOpIds.has(reqRow.ProductionOrderOperationId)) return false;
      const reqMs = storedTimestamp(reqRow.RequiredAt);
      return Number.isFinite(reqMs) && reqMs >= fromMs && reqMs < toMs;
    });
    const totalShortageQuantity = roundTo3(
      shortagesInWindow.reduce((s, reqRow) => s + storedNumber(reqRow.ShortageQuantity), 0),
    );

    const openAlertsCount = alerts.filter(
      (al) => al.PlantId === plantId
        && al.Status === "open"
        && (!workCenterId || al.WorkCenterId === workCenterId),
    ).length;

    return {
      from,
      to,
      workCenterId: workCenterId ?? null,
      openOrdersCount,
      completedOrdersCount: completedInWindow.length,
      completedOnTimeCount,
      onTimeDeliveryPct,
      goodQuantity,
      scrapQuantity,
      reworkQuantity,
      openShortagesCount: shortagesInWindow.length,
      totalShortageQuantity,
      openAlertsCount,
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

    if (workCenterId) {
      const wc = await r.get("MfgWorkCenter", workCenterId);
      if (!wc || wc.PlantId !== plantId) throw notFound();
    }

    const [operations, executions, downtimes] = await Promise.all([
      r.list("MfgProductionOrderOperation", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgOperationExecution", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
      r.list("MfgDowntimeLog", { where: [{ column: "PlantId", op: "eq", value: plantId }] }),
    ]);

    const opById = new Map(
      operations
        .filter((op) => op.PlantId === plantId && (!workCenterId || op.WorkCenterId === workCenterId))
        .map((op) => [op.Id, op]),
    );

    const execsInWindow = executions.filter((ex) => {
      if (ex.PlantId !== plantId || ex.Status === "cancelled" || !opById.has(ex.ProductionOrderOperationId)) return false;
      const startMs = storedTimestamp(ex.StartedAt);
      return Number.isFinite(startMs) && startMs >= fromMs && startMs < toMs;
    });

    const dtsInWindow = downtimes.filter((dt) => {
      if (dt.PlantId !== plantId) return false;
      if (workCenterId && dt.WorkCenterId !== workCenterId) return false;
      const startMs = storedTimestamp(dt.StartedAt);
      return Number.isFinite(startMs) && startMs >= fromMs && startMs < toMs;
    });

    const plannedDowntimeMinutes = roundTo3(
      dtsInWindow
        .filter((dt) => dt.DowntimeType === "planned")
        .reduce((s, dt) => s + storedNumber(dt.DurationMinutes), 0),
    );
    const unplannedDowntimeMinutes = roundTo3(
      dtsInWindow
        .filter((dt) => dt.DowntimeType === "unplanned")
        .reduce((s, dt) => s + storedNumber(dt.DurationMinutes), 0),
    );

    const actualRunAndSetupMinutes = roundTo3(
      execsInWindow.reduce((s, ex) => s + storedNumber(ex.SetupActualMinutes) + storedNumber(ex.RunActualMinutes), 0),
    );
    const plannedProductionMinutes = roundTo3(actualRunAndSetupMinutes + unplannedDowntimeMinutes);
    const operatingMinutes = roundTo3(Math.max(0, plannedProductionMinutes - unplannedDowntimeMinutes));

    let idealOutputMinutes = 0;
    let goodQuantity = 0;
    let totalProducedQuantity = 0;
    const seenOpsForSetup = new Set();

    for (const ex of execsInWindow) {
      const op = opById.get(ex.ProductionOrderOperationId);
      const exGood = storedNumber(ex.GoodQuantity);
      const exScrap = storedNumber(ex.ScrapQuantity);
      const exRework = storedNumber(ex.ReworkQuantity);
      const exProduced = exGood + exScrap + exRework;

      goodQuantity = roundTo3(goodQuantity + exGood);
      totalProducedQuantity = roundTo3(totalProducedQuantity + exProduced);

      if (op) {
        const stdSetup = seenOpsForSetup.has(op.Id) ? 0 : storedNumber(op.PlannedSetupMinutes);
        seenOpsForSetup.add(op.Id);
        const stdRunPerUnit = storedNumber(op.PlannedRunMinutesPerUnit);
        idealOutputMinutes = roundTo3(idealOutputMinutes + stdSetup + exProduced * stdRunPerUnit);
      }
    }

    const availabilityRatio = plannedProductionMinutes <= 0
      ? null
      : roundTo3(Math.min(1, operatingMinutes / plannedProductionMinutes));
    const performanceRatio = operatingMinutes <= 0
      ? null
      : roundTo3(idealOutputMinutes / operatingMinutes);
    const qualityRatio = totalProducedQuantity <= 0
      ? null
      : roundTo3(goodQuantity / totalProducedQuantity);

    const oeeRatio = availabilityRatio === null || performanceRatio === null || qualityRatio === null
      ? null
      : roundTo3(availabilityRatio * performanceRatio * qualityRatio);

    return {
      from,
      to,
      workCenterId: workCenterId ?? null,
      downtime: {
        plannedDowntimeMinutes,
        unplannedDowntimeMinutes,
      },
      availability: {
        numerator: operatingMinutes,
        denominator: plannedProductionMinutes,
        value: availabilityRatio,
      },
      performance: {
        numerator: idealOutputMinutes,
        denominator: operatingMinutes,
        value: performanceRatio,
      },
      quality: {
        numerator: goodQuantity,
        denominator: totalProducedQuantity,
        value: qualityRatio,
      },
      oee: oeeRatio,
      oeePct: oeeRatio === null ? null : roundTo3(oeeRatio * 100),
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
}
