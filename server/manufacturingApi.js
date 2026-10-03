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
const MAX_SCHEDULE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_GANTT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export const MANUFACTURING_IMPLEMENTED_ROUTES = Object.freeze([
  `GET ${ROOT}/parts`,
  `POST ${ROOT}/parts`,
  `GET ${ROOT}/orders`,
  `POST ${ROOT}/orders`,
  `GET ${ROOT}/orders/:orderId`,
  `PATCH ${ROOT}/orders/:orderId/priority`,
  `POST ${ROOT}/orders/:orderId/release`,
  `POST ${ROOT}/scheduling/runs`,
  `GET ${ROOT}/scheduling/gantt`,
  `GET ${ROOT}/capacity/load`,
  `GET ${ROOT}/capacity/bottlenecks`,
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

function projectLinkVisible(subject, row, evaluate) {
  if (!row.ProjectId) return true;
  return evaluate(subject, "core.project.view", { projectId: row.ProjectId }).allow;
}

function protectProjectLink(subject, row, evaluate) {
  if (projectLinkVisible(subject, row, evaluate)) return row;
  return { ...row, ProjectId: null, ContractId: null };
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
    const contract = await repo.get("ContractMaster", contractId);
    if (!contract || !evaluate(subject, "core.project.view", { projectId: contract.ProjectId }).allow) {
      throw forbidden("core.project.view", "به پیمان پیوندشده دسترسی ندارید");
    }
    where.push({ column: "ContractId", op: "eq", value: contractId });
  }
  if (q.projectId !== undefined) {
    const projectId = text(q.projectId, "projectId", { max: 60, required: true, pattern: ID_RE });
    if (!evaluate(subject, "core.project.view", { projectId }).allow) throw forbidden("core.project.view", "به پروژهٔ پیوندشده دسترسی ندارید");
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
    const fields = new Set(["PartNo", "NameFa", "NameEn", "PartType", "BaseUom", "DescriptionFa", "StandardUnitCost", "Currency", "IsLotTracked"]);
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
    const duplicate = await r.findOne("MfgPart", [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "PartNo", op: "eq", value: partNo },
    ]);
    if (duplicate) throw conflict("MFG_DUPLICATE", "PartNo در این کارخانه قبلاً ثبت شده است");
    const row = await r.create("MfgPart", {
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
    await writeAudit(r, req, "MFG_PART_CREATED", "MfgPart", row.Id, "mfg.part.edit");
    return row;
  }, 201));

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
    const projectId = text(body.ProjectId, "ProjectId", { max: 60, pattern: ID_RE });
    const contractId = text(body.ContractId, "ContractId", { max: 60, pattern: ID_RE });
    if (projectId) {
      if (!evaluate(subject, "core.project.view", { projectId }).allow) throw forbidden("core.project.view", "برای پیوند سفارش به این پروژه دسترسی ندارید");
      if (!(await r.get("Project", projectId))) throw new MfgApiError(422, "MFG_PROJECT_NOT_FOUND", "پروژهٔ پیوندشده وجود ندارد", { field: "ProjectId" });
    }
    if (contractId) {
      if (!projectId) throw bad("ProjectId", "برای ContractId، ProjectId نیز باید مشخص شود");
      const contract = await r.get("ContractMaster", contractId);
      if (!contract || contract.ProjectId !== projectId) throw new MfgApiError(422, "MFG_CONTRACT_LINK_INVALID", "پیمان به پروژهٔ اعلام‌شده تعلق ندارد", { field: "ContractId" });
    }
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
}
