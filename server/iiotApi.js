/**
 * API سامانهٔ پایش میدانی، اینترنت اشیاء و تله‌متری حفاری (iiot-api-v1)
 * ═══════════════════════════════════════════════════════════════════════
 * بخش ۵ سازمان — مسیرهای `/api/iiot/...` با دامنهٔ دکل (`rigId`) و مجوزهای
 * `iiot.*`.
 *
 * چهار تصمیم معماری:
 *
 * ۱) **دامنهٔ دکل، نه پروژه.** یک دکل بین چندین چاه و قرارداد جابه‌جا می‌شود؛
 *    پس کلید دامنه از چرخهٔ پروژه مستقل است. ارزیابی مجوز با
 *    `ctx.plantId = rigId` انجام می‌شود (همان سازوکاری که CMMS برای
 *    `SiteId` به کار برد) و fail-closed است: کاربری که دکل در `plantIds` او
 *    نیست، ۴۰۳ می‌گیرد نه فهرست خالی.
 *
 * ۲) **منطق در موتور دامنه، نه در HTTP.** فیلترینگ، آستانه‌ها، تشخیص
 *    Stick-Slip، NPT و چک‌سام بافر همه از `iiotLogic.js` می‌آیند؛ این فایل
 *    فقط ورودی را اعتبارسنجی و نتیجه را ماندگار می‌کند. به همین دلیل
 *    `iiot.domain.test.mjs` ریاضی را می‌آزماید و `iiot.rest.test.mjs` فقط
 *    بررسی می‌کند HTTP همان عدد را برمی‌گرداند.
 *
 * ۳) **تله‌متری دو جا می‌نشیند.** نمونه‌ها هم در موتور سری زمانی
 *    (InfluxDB یا موتور پشتیبان فایلی) و هم در `IotTelemetrySample` نوشته
 *    می‌شوند؛ نمودارها از rollup می‌خوانند. یک مسیر نوشتن، دو مقصد — تا
 *    واگرا نشوند.
 *
 * ۴) **یکپارچگی با صف، نه با FK.** هشدار بحرانی → رویداد در
 *    `IotIntegrationEvent` → تحویل به CMMS/MES/PMIS از راه
 *    `integrationTransport`. نبود حمل‌ونقل خطا نیست: رویداد در صف می‌ماند و
 *    «تحویل‌نشده» گزارش می‌شود. هیچ «موفق»ی بی‌شاهد ثبت نمی‌شود.
 */

import {
  IIOT_DOMAIN_VERSION,
  SIGNAL_TYPES,
  FILTER_METHODS,
  DETECTION_KINDS,
  DOWNTIME_CATEGORIES,
  DISPATCH_TARGETS,
  IIOT_INTEGRATION_CONTRACTS,
  alertMessageFa,
  alertTitleFa,
  buildStoreForwardBatch,
  bufferFillPct,
  classifyDowntime,
  claimWorthy,
  downsampleForChart,
  downtimeMinutesOf,
  evaluateDetectRule,
  eventTypeFor,
  filterSeries,
  idempotencyKeyOf,
  inCooldown,
  nextBufferStatus,
  nptSummary,
  parseDispatchTargets,
  recoveredBelowHysteresis,
  rollupSamples,
  selectBufferedForSync,
  shouldDispatch,
  signalQualityReport,
  statusColorFor,
  verifyBatch,
} from "./iiotLogic.js";

export const IIOT_API_VERSION = "iiot-api-v1";
const ROOT = "/api/iiot/rigs/:rigId";
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/;

/** سقف نمونه در یک درخواست — از سرریز حافظه و قفل طولانی جلوگیری می‌کند. */
const MAX_SAMPLES_PER_REQUEST = 5000;
/** افق خواندن سری برای ارزیابی قاعده؛ پیش‌فرض ۱۰ دقیقه. */
const DEFAULT_RULE_LOOKBACK_SECONDS = 600;
/** اندازهٔ سطل rollup پیش‌فرض (ثانیه). */
const DEFAULT_ROLLUP_BUCKET_SECONDS = 60;

const SIGNAL_TYPE_LIST = [...SIGNAL_TYPES];
const FILTER_METHOD_LIST = [...FILTER_METHODS];
const DETECTION_KIND_LIST = [...DETECTION_KINDS];
const DOWNTIME_CATEGORY_LIST = [...DOWNTIME_CATEGORIES];
const TARGET_LIST = [...DISPATCH_TARGETS];

/* ═══════════════════════ خطاها ═══════════════════════ */

export class IiotApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = "IiotApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const bad = (field, message, extra = {}) => new IiotApiError(400, "IIOT_VALIDATION_FAILED", message, { field, ...extra });
const notFound = () => new IiotApiError(404, "IIOT_NOT_FOUND", "رکورد در دکل جاری یافت نشد");
const conflict = (code, message, details = {}) => new IiotApiError(409, code, message, details);
const businessRule = (code, message, details = {}) => new IiotApiError(422, code, message, details);

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
  return text(value, field, { required: true, max: 60, pattern: CODE_RE });
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
  if (extra.length) throw bad(extra[0], `فیلد ناشناخته: ${extra.join(", ")}`);
}

function assertOnlyQueryKeys(query, allowed) {
  const keys = Object.keys(query ?? {});
  const extra = keys.filter((key) => !allowed.has(key));
  if (extra.length) throw bad(extra[0], `پارامتر پرس‌وجوی ناشناخته: ${extra.join(", ")}`);
}

function requestActor(req) {
  return req.iiotSubject?.id ?? "system";
}

const todayOf = (nowIso) => String(nowIso).slice(0, 10);

async function writeAudit(repo, req, action, entityName, entityId, permission, extra = {}) {
  try {
    await repo.create("AuditLog", {
      At: new Date().toISOString(),
      SubjectId: requestActor(req),
      Action: action,
      Permission: permission,
      Decision: "ALLOW",
      ProjectCode: null,
      EntityName: entityName,
      EntityId: entityId,
      Severity: "info",
      Details: { rigId: req.iiotRigId, traceId: req.requestId, ...extra },
    }, requestActor(req));
  } catch (err) {
    /* نوشتن ممیزی نباید فرمان موفق را شکست دهد؛ ولی باید دیده شود. */
    console.error("[%s] IIoT audit write failed for %s", req.requestId, action, err?.message);
  }
}

/** گرفتن رکورد با قید دکل — تا یک دکل نتواند رکورد دکل دیگر را بخواند. */
async function mustFind(tx, table, recordId, rigId) {
  const row = await tx.get(table, recordId);
  if (!row || row.RigId !== rigId) throw notFound();
  return row;
}

async function countInRig(tx, table, rigId, extraWhere = []) {
  return tx.count(table, [{ column: "RigId", op: "eq", value: rigId }, ...extraWhere]);
}

async function listInRig(tx, table, rigId, { where = [], orderBy, limit, offset } = {}) {
  return tx.list(table, { where: [{ column: "RigId", op: "eq", value: rigId }, ...where], orderBy, limit, offset });
}

/** شمارهٔ بعدی یک سند در دکل (BR-01، BUF-01 …) — خوانا و پایدار. */
async function nextNo(tx, table, rigId, column, prefix) {
  const rows = await listInRig(tx, table, rigId, { orderBy: [{ column, dir: "desc" }], limit: 1 });
  const last = rows[0]?.[column];
  const n = last ? Number(String(last).split("-").pop()) + 1 : 1;
  return `${prefix}-${String(Number.isFinite(n) ? n : 1).padStart(3, "0")}`;
}

function normalizeTransport(transport) {
  if (!transport) return null;
  if (typeof transport === "function") return { deliver: transport };
  if (typeof transport.deliver === "function") return transport;
  throw new TypeError("integrationTransport باید تابع یا شیئی با deliver() باشد");
}

/* ═══════════════════════ فهرست مسیرها ═══════════════════════ */

export const IIOT_IMPLEMENTED_ROUTES = Object.freeze([
  /* دکل */
  "GET /api/iiot/rigs",
  "POST /api/iiot/rigs",
  "GET /api/iiot/rigs/:rigId",
  "PATCH /api/iiot/rigs/:rigId",

  /* جریان و کانال */
  "GET /api/iiot/rigs/:rigId/streams",
  "POST /api/iiot/rigs/:rigId/streams",
  "PATCH /api/iiot/rigs/:rigId/streams/:streamId",
  "GET /api/iiot/rigs/:rigId/channels",
  "POST /api/iiot/rigs/:rigId/channels",
  "GET /api/iiot/rigs/:rigId/channels/:channelId",
  "PATCH /api/iiot/rigs/:rigId/channels/:channelId",

  /* تله‌متری */
  "POST /api/iiot/rigs/:rigId/telemetry",
  "GET /api/iiot/rigs/:rigId/telemetry",
  "GET /api/iiot/rigs/:rigId/telemetry/latest",
  "POST /api/iiot/rigs/:rigId/telemetry/rollups",

  /* فیلترینگ و آستانه */
  "GET /api/iiot/rigs/:rigId/filter-rules",
  "POST /api/iiot/rigs/:rigId/filter-rules",
  "PATCH /api/iiot/rigs/:rigId/filter-rules/:ruleId",
  "GET /api/iiot/rigs/:rigId/threshold-rules",
  "POST /api/iiot/rigs/:rigId/threshold-rules",
  "PATCH /api/iiot/rigs/:rigId/threshold-rules/:ruleId",
  "POST /api/iiot/rigs/:rigId/threshold-rules/:ruleId/test",

  /* هشدار */
  "GET /api/iiot/rigs/:rigId/alerts",
  "POST /api/iiot/rigs/:rigId/alerts/:alertId/acknowledge",
  "POST /api/iiot/rigs/:rigId/alerts/:alertId/resolve",
  "POST /api/iiot/rigs/:rigId/alerts/:alertId/false-positive",
  "POST /api/iiot/rigs/:rigId/alerts/:alertId/dispatch",

  /* گیت‌وی و Store-and-Forward */
  "GET /api/iiot/rigs/:rigId/gateways",
  "POST /api/iiot/rigs/:rigId/gateways",
  "PATCH /api/iiot/rigs/:rigId/gateways/:gatewayId",
  "POST /api/iiot/rigs/:rigId/gateways/:gatewayId/heartbeat",
  "GET /api/iiot/rigs/:rigId/gateways/:gatewayId/buffer",
  "POST /api/iiot/rigs/:rigId/gateways/:gatewayId/buffer",
  "POST /api/iiot/rigs/:rigId/gateways/:gatewayId/buffer/:bufferId/sync",

  /* سنسور و پایش وضعیت */
  "GET /api/iiot/rigs/:rigId/sensors",
  "POST /api/iiot/rigs/:rigId/sensors",
  "PATCH /api/iiot/rigs/:rigId/sensors/:sensorId",
  "POST /api/iiot/rigs/:rigId/sensors/:sensorId/calibration",
  "GET /api/iiot/rigs/:rigId/condition-snapshots",
  "POST /api/iiot/rigs/:rigId/condition-snapshots",

  /* توقف، NPT و یکپارچگی */
  "GET /api/iiot/rigs/:rigId/downtime",
  "POST /api/iiot/rigs/:rigId/downtime",
  "POST /api/iiot/rigs/:rigId/downtime/:downtimeId/close",
  "POST /api/iiot/rigs/:rigId/downtime/:downtimeId/verify",
  "GET /api/iiot/rigs/:rigId/npt/summary",
  "GET /api/iiot/rigs/:rigId/integration/events",
  "POST /api/iiot/rigs/:rigId/integration/events/:eventId/dispatch",

  /* داشبورد */
  "GET /api/iiot/rigs/:rigId/dashboard",
]);

/* ═══════════════════════ ثبت مسیرها ═══════════════════════ */

export function registerIiotRoutes(app, {
  repo, subjects, evaluate, subjectPermissions, timeSeries, integrationTransport, now,
} = {}) {
  if (!app || typeof app.get !== "function" || typeof app.post !== "function") {
    throw new TypeError("Express-compatible app is required");
  }
  if (typeof repo !== "function" && (!repo || typeof repo.list !== "function")) {
    throw new TypeError("IIoT repository is required");
  }
  if (!Array.isArray(subjects) || typeof evaluate !== "function") {
    throw new TypeError("IIoT RBAC dependencies are required");
  }

  const getRepo = async () => (typeof repo === "function" ? repo() : repo);
  const transport = normalizeTransport(integrationTransport);
  /* ساعت تزریق‌شدنی: آزمون‌ها «الان» را ثابت می‌گیرند تا پایداری زمانی و
   * دورهٔ سکوت واقعاً آزموده شوند، نه اینکه به زمان اجرا وابسته باشند. */
  const nowIso = () => (typeof now === "function" ? now() : new Date().toISOString());

  /* موتور سری زمانی اختیاری است؛ نبودش یعنی «فقط لایهٔ رابطه‌ای». این حالت
   * در آزمون‌ها و استقرار سبک استفاده می‌شود و صریحاً در پاسخ اعلام می‌گردد. */
  const ts = timeSeries ?? null;
  const tsDriver = () => (ts ? (ts.driver ?? "unknown") : "sql-only");

  const fail = (req, res, err) => {
    if (err instanceof IiotApiError) {
      return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.details, traceId: req.requestId } });
    }
    if (err instanceof RangeError || err instanceof TypeError) {
      return res.status(400).json({ ok: false, error: { code: "IIOT_DOMAIN_VALIDATION_FAILED", message: err.message, traceId: req.requestId } });
    }
    if (err?.code === "ROW_VALIDATION_FAILED") {
      return res.status(400).json({ ok: false, error: { code: "IIOT_VALIDATION_FAILED", message: err.message, issues: err.issues, traceId: req.requestId } });
    }
    if (["UNIQUE_VIOLATION", "DUPLICATE_KEY"].includes(err?.code) || [2601, 2627].includes(err?.number)) {
      return res.status(409).json({ ok: false, error: { code: "IIOT_DUPLICATE", message: "کلید یکتا در این دکل تکراری است", traceId: req.requestId } });
    }
    if (err?.code === "PERSISTENCE_UNAVAILABLE") {
      return res.status(503).json({ ok: false, error: { code: "IIOT_PERSISTENCE_UNAVAILABLE", message: "مخزن داده در دسترس نیست", traceId: req.requestId } });
    }
    console.error("[%s] IIoT API error:", req.requestId, err);
    return res.status(500).json({ ok: false, error: { code: "IIOT_INTERNAL_ERROR", message: "خطای داخلی سرور", traceId: req.requestId } });
  };

  /** احراز هویت و ارزیابی مجوز با دامنهٔ دکل. */
  const authorize = (req, permission, rigId) => {
    const userId = String(req.headers?.["x-user-id"] ?? "").trim();
    const subject = userId ? subjects.find((item) => item.id === userId && item.active !== false) ?? null : null;
    if (!subject) throw new IiotApiError(401, "IIOT_AUTH_REQUIRED", "هویت کاربر معتبر و فعال الزامی است", { permission });
    const decision = evaluate(subject, permission, { plantId: rigId });
    if (!decision.allow) {
      const scopeDenied = decision.code === "DENY_PLANT_SCOPE";
      throw new IiotApiError(
        403,
        scopeDenied ? "IIOT_RIG_SCOPE_DENIED" : "IIOT_FORBIDDEN",
        scopeDenied ? "کاربر به این دکل تخصیص ندارد" : "مجوز این عمل را ندارید",
        { permission, reason: decision.code },
      );
    }
    req.iiotSubject = subject;
    req.iiotRigId = rigId;
    return subject;
  };

  /** پوشش مشترک مسیرهای دکل‌محور. */
  const route = (permission, handler, status = 200) => async (req, res) => {
    try {
      const rigId = String(req.params?.rigId ?? "").trim();
      if (!ID_RE.test(rigId)) throw new IiotApiError(400, "IIOT_BAD_RIG_ID", "شناسهٔ دکل نامعتبر است");
      const subject = authorize(req, permission, rigId);
      const data = await handler({ repo: await getRepo(), req, subject, rigId, permission });
      if (status === 204) return res.status(204).end();
      return res.status(status).json({ ok: true, data, meta: { traceId: req.requestId, version: IIOT_API_VERSION, tsDriver: tsDriver() } });
    } catch (err) {
      return fail(req, res, err);
    }
  };

  /** مسیر بدون rigId — فهرست/ثبت دکل. */
  const globalRoute = (permission, handler, status = 200) => async (req, res) => {
    try {
      const userId = String(req.headers?.["x-user-id"] ?? "").trim();
      const subject = userId ? subjects.find((item) => item.id === userId && item.active !== false) ?? null : null;
      if (!subject) throw new IiotApiError(401, "IIOT_AUTH_REQUIRED", "هویت کاربر معتبر و فعال الزامی است", { permission });
      req.iiotSubject = subject;
      const data = await handler({ repo: await getRepo(), req, subject, permission });
      return res.status(status).json({ ok: true, data, meta: { traceId: req.requestId, version: IIOT_API_VERSION, tsDriver: tsDriver() } });
    } catch (err) {
      return fail(req, res, err);
    }
  };

  /* ───────────────────── ابزارهای مشترک دامنه ───────────────────── */

  async function mustFindRig(tx, rigId) {
    const rig = await tx.findOne("IotDrillingRig", [{ column: "RigId", op: "eq", value: rigId }]);
    if (!rig) throw notFound();
    return rig;
  }

  /** کانال‌های فعال یک دکل، با نقشهٔ کد → ردیف. */
  async function channelsByCode(tx, rigId) {
    const rows = await listInRig(tx, "IotDasChannel", rigId, { orderBy: [{ column: "ChannelCode", dir: "asc" }] });
    return { rows, byCode: new Map(rows.map((r) => [r.ChannelCode, r])) };
  }

  /**
   * سری زمانی یک کانال برای ارزیابی قاعده.
   * اولویت با موتور سری زمانی است؛ اگر نبود (یا خطا داد) از جدول نمونه‌ها
   * خوانده می‌شود. هیچ‌کدام نبود → سری خالی، یعنی «داده نداریم» نه «آستانه رد شد».
   */
  async function seriesFor(tx, { rigId, channel, lookbackSeconds, nowAt }) {
    const from = new Date(Date.parse(nowAt) - lookbackSeconds * 1000).toISOString();
    if (ts) {
      try {
        const res = await ts.query({ rigId, channelCode: channel.ChannelCode, from, to: nowAt });
        const points = (res.points ?? []).map((p) => ({ at: p.at, value: p.value, quality: p.quality }));
        if (points.length) return points;
      } catch (err) {
        console.error("[iiot] time-series query failed: %s", err?.message);
      }
    }
    const rows = await tx.list("IotTelemetrySample", {
      where: [
        { column: "ChannelId", op: "eq", value: channel.Id },
        { column: "SampledAt", op: "gte", value: from },
        { column: "SampledAt", op: "lte", value: nowAt },
      ],
      orderBy: [{ column: "SampledAt", dir: "asc" }],
      limit: 5000,
    });
    return rows.map((r) => ({ at: r.SampledAt, value: Number(r.Value), quality: r.Quality }));
  }

  /**
   * ساخت رویداد یکپارچگی در صف و تلاش برای تحویل.
   * کلید ضدتکرار از داده ساخته می‌شود، پس تحویل دوباره رکورد تازه نمی‌سازد.
   */
  async function enqueueIntegration(tx, req, { rigId, target, kind, sourceTable, sourceId, payload, discriminator, maxAttempts = 5 }) {
    const key = idempotencyKeyOf(eventTypeFor(target, kind), target, sourceTable, sourceId, discriminator);
    const existing = await tx.findOne("IotIntegrationEvent", [{ column: "IdempotencyKey", op: "eq", value: key }]);
    if (existing) return { event: existing, duplicated: true, delivered: existing.Status === "dispatched" };

    const draft = {
      RigId: rigId,
      EventType: eventTypeFor(target, kind),
      TargetSystem: target,
      TargetRef: payload?.targetRef ?? null,
      Contract: IIOT_INTEGRATION_CONTRACTS[target],
      IdempotencyKey: key,
      CorrelationId: req.requestId ?? null,
      SourceTable: sourceTable,
      SourceId: sourceId,
      OccurredAt: payload?.occurredAt ?? new Date().toISOString(),
      PayloadJson: { contract: IIOT_INTEGRATION_CONTRACTS[target], target, ...payload },
      Status: "pending",
      Attempts: 0,
      MaxAttempts: maxAttempts,
      EmittedBy: requestActor(req),
      ModelVersion: IIOT_DOMAIN_VERSION,
    };
    const event = await tx.create("IotIntegrationEvent", draft, requestActor(req));
    const delivered = await deliverEvent(tx, req, event);
    return { event: delivered.event, duplicated: false, delivered: delivered.delivered, error: delivered.error };
  }

  async function deliverEvent(tx, req, event, actor) {
    if (!transport) {
      /* نبود حمل‌ونقل، «تلاش ناموفق» نیست (تلاشی نشده) ولی باید روی ردیف
       * ثبت شود؛ وگرنه صف، رویدادهای معطل را بی‌دلیل نشان می‌دهد و اپراتور
       * نمی‌فهمد چرا چیزی تحویل نمی‌شود. */
      const missing = { ErrorCode: "E-IIOT-NO-TRANSPORT", ErrorFa: "حمل‌ونقل یکپارچگی پیکربندی نشده است" };
      await tx.patch("IotIntegrationEvent", event.Id, missing, actor ?? requestActor(req), event.RowVersion);
      return { event: { ...event, ...missing }, delivered: false, error: { code: missing.ErrorCode, messageFa: missing.ErrorFa } };
    }
    const attempt = Number(event.Attempts ?? 0) + 1;
    let outcome;
    try {
      outcome = await transport.deliver({
        eventId: event.Id,
        eventType: event.EventType,
        targetSystem: event.TargetSystem,
        targetRef: event.TargetRef,
        contract: event.Contract,
        idempotencyKey: event.IdempotencyKey,
        correlationId: event.CorrelationId,
        occurredAt: event.OccurredAt,
        payload: event.PayloadJson,
        actor: actor ?? requestActor(req),
      });
    } catch (err) {
      outcome = { ok: false, code: err?.code ?? "E-IIOT-TRANSPORT-EXCEPTION", messageFa: err?.message ?? "خطای حمل‌ونقل یکپارچگی" };
    }
    const ok = Boolean(outcome?.ok);
    const deadLetter = !ok && attempt >= Number(event.MaxAttempts ?? 5);
    const patch = {
      Attempts: attempt,
      LastAttemptAt: new Date().toISOString(),
      Status: ok ? "dispatched" : deadLetter ? "dead-letter" : "failed",
      DeliveredAt: ok ? new Date().toISOString() : null,
      AckRef: ok ? String(outcome.ref ?? outcome.ackRef ?? `ack-${event.Id}`) : null,
      ErrorCode: ok ? null : String(outcome?.code ?? "E-IIOT-DELIVERY-FAILED"),
      ErrorFa: ok ? null : String(outcome?.messageFa ?? "تحویل رویداد ناموفق بود"),
    };
    await tx.patch("IotIntegrationEvent", event.Id, patch, actor ?? requestActor(req), event.RowVersion);
    return { event: { ...event, ...patch }, delivered: ok, error: ok ? null : { code: patch.ErrorCode, messageFa: patch.ErrorFa } };
  }

  /* ═══════════════════════ هستهٔ پردازش تله‌متری ═══════════════════════ */

  /**
   * خط لولهٔ پذیرش نمونه: اعتبارسنجی ← فیلتر ← نوشتن در موتور سری زمانی و
   * جدول نمونه ← rollup ← ارزیابی قاعده ← هشدار ← صف یکپارچگی.
   *
   * این تنها مسیر نوشتن تله‌متری است؛ هم درخواست زنده و هم بارگذاری بافر
   * لبه از همین تابع عبور می‌کنند تا دو منطق موازی واگرا نشوند.
   */
  async function ingestPipeline(tx, req, { rigId, rawSamples, source, gatewayId, bufferId, batchNo, persistSamples = true, evaluateRules = true }) {
    const at = nowIso();
    const rig = await mustFindRig(tx, rigId);
    const { rows: channels, byCode } = await channelsByCode(tx, rigId);
    if (!channels.length) throw businessRule("IIOT_NO_CHANNELS", "برای این دکل کانالی تعریف نشده است");

    if (!Array.isArray(rawSamples)) throw bad("samples", "samples باید آرایه باشد");
    if (rawSamples.length === 0) throw bad("samples", "دست‌کم یک نمونه الزامی است");
    if (rawSamples.length > MAX_SAMPLES_PER_REQUEST) {
      throw bad("samples", `حداکثر ${MAX_SAMPLES_PER_REQUEST} نمونه در هر درخواست مجاز است`, { received: rawSamples.length });
    }

    /* ۱) اعتبارسنجی و گروه‌بندی بر پایهٔ کانال */
    const accepted = [];
    const rejected = [];
    const unknownChannels = new Set();
    rawSamples.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") { rejected.push({ index, code: "E-IIOT-SAMPLE-MALFORMED", messageFa: "نمونه قالب معتبر ندارد" }); return; }
      const channelCode = String(raw.channelCode ?? "").trim();
      const channel = byCode.get(channelCode);
      if (!channel) {
        unknownChannels.add(channelCode);
        rejected.push({ index, channelCode, code: "E-IIOT-UNKNOWN-CHANNEL", messageFa: `کانال «${channelCode}» در این دکل تعریف نشده است` });
        return;
      }
      if (channel.IsActive === false) {
        rejected.push({ index, channelCode, code: "E-IIOT-CHANNEL-INACTIVE", messageFa: `کانال «${channelCode}» غیرفعال است` });
        return;
      }
      const sampledAtRaw = raw.at ?? raw.sampledAt;
      const sampledAt = (() => {
        const parsed = new Date(sampledAtRaw ?? at);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
      })();
      if (!sampledAt) { rejected.push({ index, channelCode, code: "E-IIOT-BAD-TIME", messageFa: "زمان نمونه نامعتبر است" }); return; }
      const value = typeof raw.value === "number" ? raw.value : Number(raw.value);
      if (!Number.isFinite(value)) { rejected.push({ index, channelCode, code: "E-IIOT-BAD-VALUE", messageFa: "مقدار نمونه باید عدد باشد" }); return; }
      const quality = ["good", "suspect", "bad", "stale"].includes(raw.quality) ? raw.quality : "good";
      /* نمونهٔ بی‌کیفیت ذخیره می‌شود (برای اثبات) ولی در آستانه شرکت نمی‌کند. */
      accepted.push({ channel, sampledAt, value, quality, seqNo: raw.seqNo === undefined ? null : Number(raw.seqNo) });
    });

    if (!accepted.length) {
      throw businessRule("IIOT_NO_VALID_SAMPLES", "هیچ نمونهٔ معتبری در درخواست نبود", { rejected, unknownChannels: [...unknownChannels] });
    }

    /* ۲) فیلتر پنجره‌ای بر پایهٔ پیکربندی کانال */
    const byChannel = new Map();
    for (const s of accepted) {
      if (!byChannel.has(s.channel.Id)) byChannel.set(s.channel.Id, []);
      byChannel.get(s.channel.Id).push(s);
    }

    const filteredByChannel = new Map();
    const filterStats = [];
    for (const [channelId, list] of byChannel) {
      const channel = list[0].channel;
      const cfg = {
        method: channel.FilterMethod,
        windowSeconds: channel.FilterWindowSeconds,
        minSamples: 1,
        deadbandPct: channel.DeadbandPct === null || channel.DeadbandPct === undefined ? undefined : Number(channel.DeadbandPct),
        sampleRateHz: channel.SampleRateHz,
      };
      const filtered = filterSeries(list.map((s) => s.value), cfg, channel.SampleRateHz ?? 1);
      list.forEach((s, i) => { s.filtered = filtered[i]; });
      filteredByChannel.set(channelId, list);
      const report = signalQualityReport(list.map((s) => ({ value: s.value, quality: s.quality, at: s.sampledAt })), {
        flatlineSeconds: 60, sampleRateHz: channel.SampleRateHz ?? 1,
      });
      filterStats.push({ channelCode: channel.ChannelCode, samples: list.length, ...report });
    }

    /* ۳) نوشتن در موتور سری زمانی (منبع حقیقت تاریخچهٔ پرفرکانس) */
    const tsPoints = accepted.map((s) => ({
      rigId,
      channelCode: s.channel.ChannelCode,
      signalType: s.channel.SignalType,
      at: s.sampledAt,
      value: s.value,
      quality: s.quality,
      source,
    }));
    let tsResult = null;
    if (ts) {
      try { tsResult = await ts.write(tsPoints); } catch (err) {
        /* خطای موتور سری زمانی نباید پذیرش داده را بشکست: لایهٔ رابطه‌ای
         * هنوز می‌نویسد و خطا در پاسخ گزارش می‌شود. */
        tsResult = { ok: false, error: { code: err?.code ?? "E-IIOT-TS-WRITE", message: err?.message } };
      }
    }

    /* ۴) نوشتن در لایهٔ رابطه‌ای + به‌روزرسانی آخرین مقدار کانال */
    if (persistSamples) {
      for (const s of accepted) {
        await tx.create("IotTelemetrySample", {
          RigId: rigId,
          StreamId: s.channel.StreamId ?? null,
          ChannelId: s.channel.Id,
          SampledAt: s.sampledAt,
          Value: s.value,
          RawValue: s.value,
          FilteredValue: s.filtered ?? null,
          Unit: s.channel.Unit,
          SeqNo: s.seqNo,
          Quality: s.quality,
          Source: source,
          GatewayId: gatewayId ?? null,
          BufferId: bufferId ?? null,
          BatchNo: batchNo ?? null,
          IngestedAt: at,
          IsFlagged: false,
        }, requestActor(req));
      }
    }
    for (const [channelId, list] of byChannel) {
      const last = list[list.length - 1];
      await tx.patch("IotDasChannel", channelId, {
        LastValue: last.value,
        LastValueAt: last.sampledAt,
        LastQuality: last.quality,
      }, requestActor(req), last.channel.RowVersion);
    }

    /* ۵) rollup — مبنای نمودارها */
    const rollups = [];
    for (const [channelId, list] of byChannel) {
      const buckets = rollupSamples(list.map((s) => ({ at: s.sampledAt, value: s.value, quality: s.quality })), DEFAULT_ROLLUP_BUCKET_SECONDS);
      for (const b of buckets) {
        const naturalKey = { ChannelId: channelId, BucketSeconds: b.bucketSeconds, BucketStart: b.bucketStart };
        const existing = await tx.findOne("IotTelemetryRollup", Object.entries(naturalKey).map(([column, value]) => ({ column, op: "eq", value })));
        const payload = {
          RigId: rigId, ChannelId: channelId, BucketSeconds: b.bucketSeconds, BucketStart: b.bucketStart,
          SampleCount: b.sampleCount, BadCount: b.badCount, MinValue: b.minValue, MaxValue: b.maxValue,
          AvgValue: b.avgValue, StdDev: b.stdDev, FirstValue: b.firstValue, LastValue: b.lastValue,
          QualityPct: b.qualityPct, ModelVersion: IIOT_DOMAIN_VERSION,
        };
        if (existing) {
          /* سطل باز ممکن است چند بار پر شود؛ جمع می‌شود نه جایگزین، وگرنه
           * ارسال تدریجی یک دقیقه، آمارش را گم می‌کند. */
          const merged = {
            ...payload,
            SampleCount: Number(existing.SampleCount ?? 0) + b.sampleCount,
            BadCount: Number(existing.BadCount ?? 0) + b.badCount,
            MinValue: existing.MinValue === null || existing.MinValue === undefined ? b.minValue : Math.min(Number(existing.MinValue), b.minValue),
            MaxValue: existing.MaxValue === null || existing.MaxValue === undefined ? b.maxValue : Math.max(Number(existing.MaxValue), b.maxValue),
            AvgValue: b.avgValue,
            StdDev: b.stdDev,
            LastValue: b.lastValue,
          };
          await tx.patch("IotTelemetryRollup", existing.Id, merged, requestActor(req), existing.RowVersion);
        } else {
          await tx.create("IotTelemetryRollup", payload, requestActor(req));
        }
        rollups.push(payload);
      }
    }

    /* ۶) ارزیابی قاعده‌ها و ساخت هشدار */
    const alertOutcome = evaluateRules
      ? await evaluateRulesAndAlerts(tx, req, { rigId, rig, at, touchedChannels: [...byChannel.keys()] })
      : { created: [], resolved: [], suppressed: [], dispatched: [] };

    /* ۷) به‌روزرسانی وضعیت جریان */
    const streamIds = [...new Set(accepted.map((s) => s.channel.StreamId).filter(Boolean))];
    for (const streamId of streamIds) {
      const lastSample = accepted.filter((s) => s.channel.StreamId === streamId).sort((a, b) => a.sampledAt.localeCompare(b.sampledAt)).pop();
      if (!lastSample) continue;
      const stream = await tx.get("IotDrillingRigStream", streamId);
      if (!stream) continue;
      const goodPct = (() => {
        const list = accepted.filter((s) => s.channel.StreamId === streamId);
        const good = list.filter((s) => s.quality === "good").length;
        return list.length ? Math.round((good / list.length) * 10000) / 100 : null;
      })();
      await tx.patch("IotDrillingRigStream", streamId, {
        LastSampleAt: lastSample.sampledAt,
        LastSeqNo: lastSample.seqNo ?? stream.LastSeqNo ?? null,
        ConnectionState: goodPct !== null && goodPct < 80 ? "degraded" : "online",
        QualityPct: goodPct,
      }, requestActor(req), stream.RowVersion);
    }

    return {
      rigId,
      accepted: accepted.length,
      rejected,
      unknownChannels: [...unknownChannels],
      channels: [...byChannel.keys()].length,
      filterStats,
      timeSeries: tsResult,
      rollups: rollups.length,
      alerts: alertOutcome,
      at,
      tsDriver: tsDriver(),
    };
  }

  /**
   * ارزیابی همهٔ قاعده‌های فعال روی کانال‌های لمس‌شده.
   *
   * ترتیب مهم است: اول قاعده‌های تک‌کاناله (آستانه/نرخ/اسپایک/یخ‌زدگی)، بعد
   * قاعده‌های چندکاناله (Stick-Slip، افت فشار) که به سری همسایه نیاز دارند.
   * دورهٔ سکوت جلوی طوفان هشدار را می‌گیرد و هیسترزیس، بسته‌شدن را پایدار
   * می‌کند.
   */
  async function evaluateRulesAndAlerts(tx, req, { rigId, rig, at, touchedChannels, force = false }) {
    const rules = await listInRig(tx, "IotThresholdRule", rigId, { where: [{ column: "IsActive", op: "eq", value: true }] });
    if (!rules.length) return { created: [], resolved: [], suppressed: [], dispatched: [] };

    const channelRows = await listInRig(tx, "IotDasChannel", rigId);
    const channelById = new Map(channelRows.map((c) => [c.Id, c]));
    const created = [];
    const resolved = [];
    const suppressed = [];
    const dispatched = [];

    /* سری هر کانال یک بار خوانده می‌شود و بین قاعده‌ها مشترک است. */
    const seriesCache = new Map();
    const lookback = DEFAULT_RULE_LOOKBACK_SECONDS;
    const loadSeries = async (channel) => {
      if (!channel) return [];
      if (!seriesCache.has(channel.Id)) seriesCache.set(channel.Id, await seriesFor(tx, { rigId, channel, lookbackSeconds: lookback, nowAt: at }));
      return seriesCache.get(channel.Id);
    };

    const relevant = rules.filter((rule) => !touchedChannels || touchedChannels.length === 0 || touchedChannels.includes(rule.ChannelId));

    for (const rule of relevant) {
      const channel = channelById.get(rule.ChannelId);
      if (!channel) continue;
      const kind = rule.DetectKind ?? "threshold";
      const seriesBySignal = {};
      let primary = await loadSeries(channel);
      seriesBySignal[channel.SignalType] = primary;
      if (kind === "stick-slip") {
        const torqueChannel = channelRows.find((c) => c.SignalType === "torque" && c.IsActive !== false);
        const rpmChannel = channelRows.find((c) => c.SignalType === "rpm" && c.IsActive !== false);
        seriesBySignal.torque = torqueChannel ? await loadSeries(torqueChannel) : [];
        seriesBySignal.rpm = rpmChannel ? await loadSeries(rpmChannel) : [];
        primary = seriesBySignal.torque.length ? seriesBySignal.torque : primary;
      }
      if (kind === "pump-drop") {
        const pumpChannel = channelRows.find((c) => c.SignalType === "mud-pump-pressure" && c.IsActive !== false) ?? channel;
        seriesBySignal["mud-pump-pressure"] = await loadSeries(pumpChannel);
      }

      const { verdict, stickSlip, pumpDrop } = evaluateDetectRule(
        {
          level: rule.Level,
          detectKind: kind,
          comparison: rule.Comparison,
          thresholdValue: rule.ThresholdValue,
          secondaryValue: rule.SecondaryValue,
          durationSeconds: rule.DurationSeconds,
          minSamples: rule.MinSamples,
          hysteresisPct: rule.HysteresisPct,
          torqueCvThreshold: rule.TorqueCvThreshold,
          rpmSwingPctThreshold: rule.RpmSwingPctThreshold,
          pressureDropPctThreshold: rule.PressureDropPctThreshold,
        },
        seriesBySignal,
        channel.SignalType,
        { sampleRateHz: channel.SampleRateHz, windowSeconds: rule.DurationSeconds || lookback, pumpFloor: rule.ThresholdValue },
      );

      /* الف) بازگشت به حالت عادی: هشدارهای بازِ همین قاعده را با هیسترزیس ببند. */
      const openAlerts = await tx.list("IotTelemetryAlert", {
        where: [
          { column: "RigId", op: "eq", value: rigId },
          { column: "RuleId", op: "eq", value: rule.Id },
          { column: "Status", op: "in", value: ["active", "acknowledged"] },
        ],
        orderBy: [{ column: "DetectedAt", dir: "desc" }],
        limit: 20,
      });
      const recovered = !verdict.breach && primary.length > 0
        ? recoveredBelowHysteresis(Number(primary[primary.length - 1].value), {
          comparison: rule.Comparison, thresholdValue: rule.ThresholdValue, hysteresisPct: rule.HysteresisPct,
        })
        : false;
      if (recovered && openAlerts.length) {
        for (const alert of openAlerts) {
          const patch = {
            Status: "resolved",
            ResolvedAt: at,
            ResolvedById: "svc-iiot-auto",
            ResolutionNoteFa: "بازگشت سیگنال به محدودهٔ عادی با احتساب هیسترزیس",
          };
          await tx.patch("IotTelemetryAlert", alert.Id, patch, requestActor(req), alert.RowVersion);
          resolved.push({ ...alert, ...patch });
          await closeDowntimeForAlert(tx, req, { rigId, alert, at, reasonFa: "بازگشت به حالت عادی" });
          if (rule.AutoDispatch) {
            for (const target of parseDispatchTargets(rule.DispatchTargets)) {
              const out = await enqueueIntegration(tx, req, {
                rigId, target, kind: "alert-resolved", sourceTable: "IotTelemetryAlert", sourceId: alert.Id,
                discriminator: `resolved-${alert.Id}`,
                payload: {
                  occurredAt: at, rigId, rigNo: rig.RigNo, alertCode: alert.AlertCode, level: alert.Level,
                  alertId: alert.Id,
                  channelCode: channel.ChannelCode, signalType: channel.SignalType, resolvedAt: at,
                  /* کلید ضدتکرارِ رویدادی که این ناهنجاری را «باز» کرد. مقصد با
                   * همین کلید، همان ردیفی را پیدا می‌کند که خودش ساخته است؛
                   * بدون آن، بسته‌شدن هرگز به ردیف باز نمی‌رسید. */
                  opensKey: idempotencyKeyOf(eventTypeFor(target, "alert"), target, "IotTelemetryAlert", alert.Id),
                  /* همان ارث‌بری قاعده←دکل که رویداد بازکننده دارد؛ وگرنه
                   * رویداد بسته‌شدن به سایت/پروژهٔ دیگری می‌رفت و هشدار باز
                   * می‌ماند. */
                  cmmsSiteRef: rule.CmmsSiteRef ?? rig.CmmsSiteRef ?? null,
                  mesWorkCenterRef: rule.MesWorkCenterRef ?? rig.MesWorkCenterRef ?? null,
                  pmisProjectRef: rule.PmisProjectRef ?? rig.PmisProjectRef ?? null,
                },
              });
              dispatched.push({ target, eventId: out.event.Id, delivered: out.delivered, kind: "alert.resolved" });
            }
          }
        }
        continue;
      }

      /* ب) نقض پایدار → هشدار تازه (با رعایت دورهٔ سکوت). */
      if (!verdict.breach || !verdict.sustained) continue;
      if (!force) {
        const last = openAlerts[0] ?? await tx.list("IotTelemetryAlert", {
          where: [
            { column: "RigId", op: "eq", value: rigId },
            { column: "RuleId", op: "eq", value: rule.Id },
          ],
          orderBy: [{ column: "DetectedAt", dir: "desc" }],
          limit: 1,
        }).then((rows) => rows[0] ?? null);
        if (last && inCooldown(last.DetectedAt, at, rule.CooldownSeconds ?? 0)) {
          suppressed.push({ ruleId: rule.Id, ruleCode: rule.RuleCode, reason: "E-IIOT-COOLDOWN", lastAlertAt: last.DetectedAt });
          continue;
        }
      }

      const alertCode = `${String(kind).toUpperCase()}-${channel.ChannelCode}-${String(rule.Level).toUpperCase()}`;
      const title = alertTitleFa({
        detectKind: kind, signal: channel.SignalType, channelNameFa: channel.NameFa,
        value: verdict.triggerValue, unit: channel.Unit, threshold: rule.ThresholdValue, level: rule.Level,
      });
      const message = alertMessageFa({
        detectKind: kind, metrics: verdict.metrics, sampleCount: verdict.breachSamples,
        durationSeconds: verdict.breachSeconds, filteredValue: verdict.filteredValue, triggerValue: verdict.triggerValue,
      });
      const alert = await tx.create("IotTelemetryAlert", {
        RigId: rigId,
        ChannelId: channel.Id,
        RuleId: rule.Id,
        AlertCode: alertCode,
        DetectionKind: kind,
        Level: rule.Level,
        TitleFa: title,
        MessageFa: message,
        DetectedAt: at,
        TriggeredAt: at,
        TriggerValue: verdict.triggerValue,
        FilteredValue: verdict.filteredValue,
        BaselineValue: verdict.baselineValue,
        DeviationPct: verdict.deviationPct,
        SampleCount: verdict.breachSamples,
        DurationSeconds: verdict.breachSeconds,
        MetricsJson: { ...verdict.metrics, stickSlip: stickSlip ?? null, pumpDrop: pumpDrop ?? null, ruleVersion: rule.Version ?? 1 },
        Status: "active",
        DispatchStatus: "none",
        ModelVersion: IIOT_DOMAIN_VERSION,
      }, requestActor(req));
      created.push(alert);
      await writeAudit(req.repo ?? tx, req, "IIOT_ALERT_RAISED", "IotTelemetryAlert", alert.Id, "iiot.alert.view", { level: rule.Level, kind });

      /* پ) ثبت خودکار توقف/NPT */
      const downtime = await openDowntimeForAlert(tx, req, { rigId, rig, alert, rule, channel, at });

      /* ت) ارسال بین‌بخشی */
      const decision = shouldDispatch({ level: rule.Level, autoDispatch: Boolean(rule.AutoDispatch), targets: rule.DispatchTargets });
      const results = [];
      if (decision.dispatch) {
        for (const target of decision.targets) {
          const out = await enqueueIntegration(tx, req, {
            rigId, target, kind: "alert", sourceTable: "IotTelemetryAlert", sourceId: alert.Id,
            payload: {
              occurredAt: at,
              rigId, rigNo: rig.RigNo, rigNameFa: rig.NameFa,
              alertId: alert.Id, alertCode, level: rule.Level, detectKind: kind,
              titleFa: title, messageFa: message,
              channelCode: channel.ChannelCode, channelNameFa: channel.NameFa,
              signalType: channel.SignalType, unit: channel.Unit,
              triggerValue: verdict.triggerValue, filteredValue: verdict.filteredValue,
              baselineValue: verdict.baselineValue, deviationPct: verdict.deviationPct,
              durationSeconds: verdict.breachSeconds, sampleCount: verdict.breachSamples,
              metrics: verdict.metrics,
              /* مقصدهای مقصد — نرم و بدون FK */
              cmmsSiteRef: rule.CmmsSiteRef ?? rig.CmmsSiteRef ?? null,
              cmmsAssetRef: rule.CmmsAssetRef ?? null,
              cmmsPriority: rule.CmmsPriority ?? (rule.Level === "critical" ? 1 : 3),
              mesWorkCenterRef: rule.MesWorkCenterRef ?? rig.MesWorkCenterRef ?? null,
              mesPlantRef: rule.MesPlantRef ?? null,
              pmisProjectRef: rule.PmisProjectRef ?? rig.PmisProjectRef ?? null,
              nptCode: rule.NptCode ?? null,
              downtimeId: downtime?.Id ?? null,
              downtimeMinutes: downtime?.DurationMinutes ?? null,
              escalationNoteFa: rule.EscalationNoteFa ?? null,
            },
          });
          results.push({ target, eventId: out.event.Id, delivered: out.delivered, error: out.error ?? null, kind: "alert.critical" });
          dispatched.push({ target, eventId: out.event.Id, delivered: out.delivered, kind: "alert.critical" });
        }
      }
      const dispatchStatus = results.length === 0
        ? "none"
        : results.every((r) => r.delivered) ? "dispatched"
          : results.some((r) => r.delivered) ? "partial" : "failed";
      const external = {
        DispatchStatus: dispatchStatus,
        CmmsWorkOrderRef: results.find((r) => r.target === "cmms" && r.delivered)?.eventId ?? null,
        MesDowntimeRef: results.find((r) => r.target === "mes" && r.delivered)?.eventId ?? null,
        PmisEventRef: results.find((r) => r.target === "pmis" && r.delivered)?.eventId ?? null,
      };
      await tx.patch("IotTelemetryAlert", alert.Id, external, requestActor(req), alert.RowVersion);
      Object.assign(created[created.length - 1], external);
    }

    return { created, resolved, suppressed, dispatched };
  }

  /** ثبت خودکار توقف/NPT هنگام هشدار بحرانی. */
  async function openDowntimeForAlert(tx, req, { rigId, rig, alert, rule, channel, at }) {
    if (alert.Level !== "critical") return null;
    const category = rule.NptCode ? (DOWNTIME_CATEGORY_LIST.includes(rule.NptCode) ? rule.NptCode : "equipment") : "equipment";
    const info = classifyDowntime(category, { nptCode: rule.NptCode ?? undefined });
    const existing = await tx.findOne("IotRigDowntime", [
      { column: "RigId", op: "eq", value: rigId },
      { column: "AlertId", op: "eq", value: alert.Id },
    ]);
    if (existing) return existing;
    const downtimeCode = await nextNo(tx, "IotRigDowntime", rigId, "DowntimeCode", "DT");
    return tx.create("IotRigDowntime", {
      RigId: rigId,
      DowntimeCode: downtimeCode,
      Category: info.category,
      DowntimeType: info.downtimeType,
      NptCode: info.nptCode,
      CauseFa: `توقف خودکار به دنبال هشدار ${alert.Level} روی کانال ${channel.ChannelCode}: ${alert.TitleFa}`,
      EffectFa: rule.EscalationNoteFa ?? null,
      StartedAt: alert.DetectedAt,
      DurationMinutes: 0,
      IsNpt: info.isNpt,
      AlertId: alert.Id,
      DetectedBy: "auto",
      RecordedById: requestActor(req),
      ReportedToMes: false,
      ReportedToPmis: false,
      ModelVersion: IIOT_DOMAIN_VERSION,
    }, requestActor(req));
  }

  /** بستن توقف مرتبط با هشدار و محاسبهٔ مدت. */
  async function closeDowntimeForAlert(tx, req, { rigId, alert, at, reasonFa }) {
    const downtime = await tx.findOne("IotRigDowntime", [
      { column: "RigId", op: "eq", value: rigId },
      { column: "AlertId", op: "eq", value: alert.Id },
    ]);
    if (!downtime || downtime.EndedAt) return null;
    const minutes = downtimeMinutesOf({ startedAt: downtime.StartedAt, endedAt: at }, at) ?? 0;
    const patch = { EndedAt: at, DurationMinutes: minutes, NoteFa: reasonFa ?? null };
    await tx.patch("IotRigDowntime", downtime.Id, patch, requestActor(req), downtime.RowVersion);
    return { ...downtime, ...patch };
  }

  /* ═══════════════════════ ۱. دکل ═══════════════════════ */

  app.get("/api/iiot/rigs", globalRoute("iiot.rig.view", async ({ repo: r, subject }) => {
    const all = await r.list("IotDrillingRig", { where: [], orderBy: [{ column: "RigNo", dir: "asc" }] });
    /* دامنه‌بندی: کاربر فقط دکل‌هایی را می‌بیند که در فهرست plantIds اوست. */
    const allowed = subject.plantIds ?? [];
    const scoped = allowed.includes("*") ? all : all.filter((rig) => allowed.includes(rig.RigId));
    return { rigs: scoped, total: scoped.length };
  }));

  app.post("/api/iiot/rigs", globalRoute("iiot.rig.edit", async ({ repo: r, req }) => {
    assertOnlyKeys(req.body, new Set([
      "RigId", "RigNo", "NameFa", "NameEn", "RigType", "OwnerFa", "DrillingContractorFa",
      "CmmsSiteRef", "PmisProjectRef", "MesWorkCenterRef", "FieldName", "WellName", "SpudDate",
      "TargetDepthM", "CurrentDepthM", "Status", "Latitude", "Longitude", "TimeZoneId",
      "NominalSampleRateHz", "IsActive", "NoteFa",
    ]));
    const RigId = id(req.body.RigId, "RigId");
    const RigNo = code(req.body.RigNo, "RigNo");
    if (await r.findOne("IotDrillingRig", [{ column: "RigId", op: "eq", value: RigId }])) {
      throw conflict("IIOT_DUPLICATE", `دکل «${RigId}» پیش‌تر ثبت شده است`);
    }
    if (await r.findOne("IotDrillingRig", [{ column: "RigNo", op: "eq", value: RigNo }])) {
      throw conflict("IIOT_DUPLICATE", `شمارهٔ دکل «${RigNo}» تکراری است`);
    }
    const row = await r.create("IotDrillingRig", {
      RigId, RigNo,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      RigType: oneOf(req.body.RigType, "RigType", ["land", "jackup", "semi-submersible", "platform", "workover", "coiled-tubing"], { required: true }),
      OwnerFa: text(req.body.OwnerFa, "OwnerFa", { max: 240 }),
      DrillingContractorFa: text(req.body.DrillingContractorFa, "DrillingContractorFa", { max: 240 }),
      CmmsSiteRef: text(req.body.CmmsSiteRef, "CmmsSiteRef", { max: 60 }),
      PmisProjectRef: text(req.body.PmisProjectRef, "PmisProjectRef", { max: 60 }),
      MesWorkCenterRef: text(req.body.MesWorkCenterRef, "MesWorkCenterRef", { max: 60 }),
      FieldName: text(req.body.FieldName, "FieldName", { max: 160 }),
      WellName: text(req.body.WellName, "WellName", { max: 160 }),
      SpudDate: isoDate(req.body.SpudDate, "SpudDate"),
      TargetDepthM: optionalNumber(req.body.TargetDepthM, "TargetDepthM", { min: 0 }),
      CurrentDepthM: optionalNumber(req.body.CurrentDepthM, "CurrentDepthM", { min: 0 }),
      Status: oneOf(req.body.Status, "Status", ["mobilizing", "drilling", "tripping", "cementing", "completion", "workover", "stacked", "demobilized"], { fallback: "drilling" }),
      Latitude: optionalNumber(req.body.Latitude, "Latitude", { min: -90, max: 90 }),
      Longitude: optionalNumber(req.body.Longitude, "Longitude", { min: -180, max: 180 }),
      TimeZoneId: text(req.body.TimeZoneId, "TimeZoneId", { max: 80 }) ?? "Asia/Tehran",
      NominalSampleRateHz: number(req.body.NominalSampleRateHz, "NominalSampleRateHz", { integer: true, min: 1, max: 1000 }) ?? 1,
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "IIOT_RIG_CREATED", "IotDrillingRig", row.Id, "iiot.rig.edit");
    return row;
  }, 201));

  app.get(`${ROOT}`, route("iiot.rig.view", async ({ repo: r, req, rigId }) => {
    const rig = await mustFindRig(r, rigId);
    const [channels, streams, gateways, activeAlerts, openDowntime, samples] = await Promise.all([
      countInRig(r, "IotDasChannel", rigId, [{ column: "IsActive", op: "eq", value: true }]),
      countInRig(r, "IotDrillingRigStream", rigId),
      countInRig(r, "IotEdgeGateway", rigId, [{ column: "IsActive", op: "eq", value: true }]),
      countInRig(r, "IotTelemetryAlert", rigId, [{ column: "Status", op: "in", value: ["active", "acknowledged"] }]),
      r.count("IotRigDowntime", [{ column: "RigId", op: "eq", value: rigId }, { column: "EndedAt", op: "eq", value: null }]),
      countInRig(r, "IotTelemetrySample", rigId),
    ]);
    return {
      rig,
      counts: { channels, streams, gateways, activeAlerts, openDowntime, samples },
      requestId: req.requestId,
    };
  }));

  app.patch(`${ROOT}`, route("iiot.rig.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "RigNo", "NameFa", "NameEn", "RigType", "OwnerFa", "DrillingContractorFa", "CmmsSiteRef",
      "PmisProjectRef", "MesWorkCenterRef", "FieldName", "WellName", "TargetDepthM", "CurrentDepthM",
      "Status", "Latitude", "Longitude", "NominalSampleRateHz", "IsActive", "NoteFa", "RowVersion",
    ]));
    const rig = await mustFindRig(r, rigId);
    const patch = {};
    if (req.body.RigNo !== undefined) patch.RigNo = code(req.body.RigNo, "RigNo");
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.NameEn !== undefined) patch.NameEn = text(req.body.NameEn, "NameEn", { max: 240 });
    if (req.body.RigType !== undefined) patch.RigType = oneOf(req.body.RigType, "RigType", ["land", "jackup", "semi-submersible", "platform", "workover", "coiled-tubing"], { required: true });
    if (req.body.Status !== undefined) patch.Status = oneOf(req.body.Status, "Status", ["mobilizing", "drilling", "tripping", "cementing", "completion", "workover", "stacked", "demobilized"], { required: true });
    if (req.body.CmmsSiteRef !== undefined) patch.CmmsSiteRef = text(req.body.CmmsSiteRef, "CmmsSiteRef", { max: 60 });
    if (req.body.PmisProjectRef !== undefined) patch.PmisProjectRef = text(req.body.PmisProjectRef, "PmisProjectRef", { max: 60 });
    if (req.body.MesWorkCenterRef !== undefined) patch.MesWorkCenterRef = text(req.body.MesWorkCenterRef, "MesWorkCenterRef", { max: 60 });
    if (req.body.CurrentDepthM !== undefined) patch.CurrentDepthM = optionalNumber(req.body.CurrentDepthM, "CurrentDepthM", { min: 0 });
    if (req.body.NominalSampleRateHz !== undefined) patch.NominalSampleRateHz = number(req.body.NominalSampleRateHz, "NominalSampleRateHz", { required: true, integer: true, min: 1, max: 1000 });
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    const result = await r.patch("IotDrillingRig", rig.Id, patch, requestActor(req), req.body.RowVersion ?? rig.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است؛ تازه‌سازی کنید");
    await writeAudit(r, req, "IIOT_RIG_UPDATED", "IotDrillingRig", rig.Id, "iiot.rig.edit");
    return r.get("IotDrillingRig", rig.Id);
  }));

  /* ═══════════════════════ ۲. جریان و کانال ═══════════════════════ */

  app.get(`${ROOT}/streams`, route("iiot.stream.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["sourceSystem", "isActive", "limit", "offset"]));
    const where = [];
    if (req.query.sourceSystem !== undefined) where.push({ column: "SourceSystem", op: "eq", value: oneOf(req.query.sourceSystem, "sourceSystem", ["witsml", "mudlogger", "plc", "scada", "edge", "manual"], { required: true }) });
    if (req.query.isActive !== undefined) where.push({ column: "IsActive", op: "eq", value: bool(req.query.isActive, "isActive") });
    const rows = await listInRig(r, "IotDrillingRigStream", rigId, {
      where,
      orderBy: [{ column: "StreamCode", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 200, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 100000),
    });
    return { streams: rows, total: rows.length };
  }));

  app.post(`${ROOT}/streams`, route("iiot.stream.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "StreamCode", "NameFa", "SourceSystem", "GatewayId", "TransportProtocol", "SampleRateHz",
      "BatchSize", "ConnectionState", "IsActive", "WitsmlMnemonicMap", "NoteFa",
    ]));
    const StreamCode = code(req.body.StreamCode, "StreamCode");
    if (await r.findOne("IotDrillingRigStream", [{ column: "RigId", op: "eq", value: rigId }, { column: "StreamCode", op: "eq", value: StreamCode }])) {
      throw conflict("IIOT_DUPLICATE", `کد جریان «${StreamCode}» تکراری است`);
    }
    const GatewayId = req.body.GatewayId === undefined ? null : id(req.body.GatewayId, "GatewayId");
    if (GatewayId) await mustFind(r, "IotEdgeGateway", GatewayId, rigId);
    const row = await r.create("IotDrillingRigStream", {
      RigId: rigId, StreamCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      SourceSystem: oneOf(req.body.SourceSystem, "SourceSystem", ["witsml", "mudlogger", "plc", "scada", "edge", "manual"], { required: true }),
      GatewayId,
      TransportProtocol: oneOf(req.body.TransportProtocol, "TransportProtocol", ["mqtt", "opc-ua", "modbus", "witsml", "http"], { required: true }),
      SampleRateHz: number(req.body.SampleRateHz, "SampleRateHz", { integer: true, min: 1, max: 1000 }) ?? 1,
      BatchSize: number(req.body.BatchSize, "BatchSize", { integer: true, min: 1, max: 10000 }) ?? 100,
      ConnectionState: oneOf(req.body.ConnectionState, "ConnectionState", ["online", "degraded", "offline"], { fallback: "offline" }),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      WitsmlMnemonicMapJson: req.body.WitsmlMnemonicMap ?? null,
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "IIOT_STREAM_CREATED", "IotDrillingRigStream", row.Id, "iiot.stream.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/streams/:streamId`, route("iiot.stream.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["NameFa", "SourceSystem", "GatewayId", "TransportProtocol", "SampleRateHz", "BatchSize", "ConnectionState", "IsActive", "NoteFa", "RowVersion"]));
    const streamId = id(req.params.streamId, "streamId");
    const existing = await mustFind(r, "IotDrillingRigStream", streamId, rigId);
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.SourceSystem !== undefined) patch.SourceSystem = oneOf(req.body.SourceSystem, "SourceSystem", ["witsml", "mudlogger", "plc", "scada", "edge", "manual"], { required: true });
    if (req.body.TransportProtocol !== undefined) patch.TransportProtocol = oneOf(req.body.TransportProtocol, "TransportProtocol", ["mqtt", "opc-ua", "modbus", "witsml", "http"], { required: true });
    if (req.body.SampleRateHz !== undefined) patch.SampleRateHz = number(req.body.SampleRateHz, "SampleRateHz", { required: true, integer: true, min: 1, max: 1000 });
    if (req.body.BatchSize !== undefined) patch.BatchSize = number(req.body.BatchSize, "BatchSize", { required: true, integer: true, min: 1, max: 10000 });
    if (req.body.ConnectionState !== undefined) patch.ConnectionState = oneOf(req.body.ConnectionState, "ConnectionState", ["online", "degraded", "offline"], { required: true });
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.GatewayId !== undefined) {
      const next = req.body.GatewayId === null ? null : id(req.body.GatewayId, "GatewayId");
      if (next) await mustFind(r, "IotEdgeGateway", next, rigId);
      patch.GatewayId = next;
    }
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    const result = await r.patch("IotDrillingRigStream", streamId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_STREAM_UPDATED", "IotDrillingRigStream", streamId, "iiot.stream.edit");
    return r.get("IotDrillingRigStream", streamId);
  }));

  app.get(`${ROOT}/channels`, route("iiot.channel.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["signalType", "isActive", "streamId", "limit", "offset"]));
    const where = [];
    if (req.query.signalType !== undefined) where.push({ column: "SignalType", op: "eq", value: oneOf(req.query.signalType, "signalType", SIGNAL_TYPE_LIST, { required: true }) });
    if (req.query.isActive !== undefined) where.push({ column: "IsActive", op: "eq", value: bool(req.query.isActive, "isActive") });
    if (req.query.streamId !== undefined) where.push({ column: "StreamId", op: "eq", value: id(req.query.streamId, "streamId") });
    const rows = await listInRig(r, "IotDasChannel", rigId, {
      where,
      orderBy: [{ column: "ChannelCode", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 200, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 100000),
    });
    /* رنگ وضعیت هر کانال از آستانه‌هایش ساخته می‌شود — همان چیزی که داشبورد
     * نشان می‌دهد، پس سرور محاسبه می‌کند نه مرورگر. */
    const withStatus = [];
    for (const channel of rows) {
      const rules = await r.list("IotThresholdRule", {
        where: [{ column: "ChannelId", op: "eq", value: channel.Id }, { column: "IsActive", op: "eq", value: true }],
      });
      withStatus.push({
        ...channel,
        status: statusColorFor(channel.LastValue === null || channel.LastValue === undefined ? null : Number(channel.LastValue), rules.map((rule) => ({
          level: rule.Level, comparison: rule.Comparison, thresholdValue: rule.ThresholdValue === null ? null : Number(rule.ThresholdValue), secondaryValue: rule.SecondaryValue === null ? null : Number(rule.SecondaryValue),
        }))),
        thresholds: rules.map((rule) => ({ id: rule.Id, ruleCode: rule.RuleCode, level: rule.Level, comparison: rule.Comparison, thresholdValue: rule.ThresholdValue, detectKind: rule.DetectKind })),
      });
    }
    return { channels: withStatus, total: withStatus.length };
  }));

  app.post(`${ROOT}/channels`, route("iiot.channel.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "ChannelCode", "StreamId", "NameFa", "NameEn", "SignalType", "Unit", "NominalMin", "NominalMax",
      "NominalValue", "DisplayMin", "DisplayMax", "SampleRateHz", "FilterMethod", "FilterWindowSeconds",
      "DeadbandPct", "SensorTag", "WitsmlMnemonic", "IsCritical", "IsActive", "InstalledLocationFa",
      "NextCalibrationDue", "NoteFa",
    ]));
    const ChannelCode = code(req.body.ChannelCode, "ChannelCode");
    if (await r.findOne("IotDasChannel", [{ column: "RigId", op: "eq", value: rigId }, { column: "ChannelCode", op: "eq", value: ChannelCode }])) {
      throw conflict("IIOT_DUPLICATE", `کد کانال «${ChannelCode}» تکراری است`);
    }
    const StreamId = req.body.StreamId === undefined ? null : id(req.body.StreamId, "StreamId");
    if (StreamId) await mustFind(r, "IotDrillingRigStream", StreamId, rigId);
    const DisplayMin = optionalNumber(req.body.DisplayMin, "DisplayMin");
    const DisplayMax = optionalNumber(req.body.DisplayMax, "DisplayMax");
    if (DisplayMin !== null && DisplayMax !== null && DisplayMax <= DisplayMin) {
      throw bad("DisplayMax", "بیشینهٔ محدودهٔ نمایش باید از کمینه بزرگ‌تر باشد");
    }
    const row = await r.create("IotDasChannel", {
      RigId: rigId, ChannelCode, StreamId,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      NameEn: text(req.body.NameEn, "NameEn", { max: 240 }),
      SignalType: oneOf(req.body.SignalType, "SignalType", SIGNAL_TYPE_LIST, { required: true }),
      Unit: text(req.body.Unit, "Unit", { required: true, max: 24 }),
      NominalMin: optionalNumber(req.body.NominalMin, "NominalMin"),
      NominalMax: optionalNumber(req.body.NominalMax, "NominalMax"),
      NominalValue: optionalNumber(req.body.NominalValue, "NominalValue"),
      DisplayMin, DisplayMax,
      SampleRateHz: number(req.body.SampleRateHz, "SampleRateHz", { integer: true, min: 1, max: 1000 }) ?? 1,
      FilterMethod: oneOf(req.body.FilterMethod, "FilterMethod", FILTER_METHOD_LIST, { fallback: "sma" }),
      FilterWindowSeconds: number(req.body.FilterWindowSeconds, "FilterWindowSeconds", { integer: true, min: 1, max: 3600 }) ?? 10,
      DeadbandPct: optionalNumber(req.body.DeadbandPct, "DeadbandPct", { min: 0, max: 100 }),
      SensorTag: text(req.body.SensorTag, "SensorTag", { max: 60 }),
      WitsmlMnemonic: text(req.body.WitsmlMnemonic, "WitsmlMnemonic", { max: 80 }),
      IsCritical: bool(req.body.IsCritical, "IsCritical", false),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      InstalledLocationFa: text(req.body.InstalledLocationFa, "InstalledLocationFa", { max: 240 }),
      NextCalibrationDue: isoDate(req.body.NextCalibrationDue, "NextCalibrationDue"),
      ModelVersion: IIOT_DOMAIN_VERSION,
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "IIOT_CHANNEL_CREATED", "IotDasChannel", row.Id, "iiot.channel.edit");
    return row;
  }, 201));

  app.get(`${ROOT}/channels/:channelId`, route("iiot.channel.view", async ({ repo: r, req, rigId }) => {
    const channelId = id(req.params.channelId, "channelId");
    const channel = await mustFind(r, "IotDasChannel", channelId, rigId);
    const [rules, filterRules, rollups] = await Promise.all([
      listInRig(r, "IotThresholdRule", rigId, { where: [{ column: "ChannelId", op: "eq", value: channelId }] }),
      listInRig(r, "IotSignalFilterRule", rigId, { where: [{ column: "IsActive", op: "eq", value: true }] }),
      r.list("IotTelemetryRollup", {
        where: [{ column: "ChannelId", op: "eq", value: channelId }],
        orderBy: [{ column: "BucketStart", dir: "desc" }],
        limit: 120,
      }),
    ]);
    return { channel, thresholds: rules, filterRules, rollups: rollups.reverse() };
  }));

  app.patch(`${ROOT}/channels/:channelId`, route("iiot.channel.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "NameFa", "NameEn", "Unit", "NominalMin", "NominalMax", "NominalValue", "DisplayMin", "DisplayMax",
      "SampleRateHz", "FilterMethod", "FilterWindowSeconds", "DeadbandPct", "SensorTag", "IsCritical",
      "IsActive", "InstalledLocationFa", "NextCalibrationDue", "NoteFa", "RowVersion",
    ]));
    const channelId = id(req.params.channelId, "channelId");
    const existing = await mustFind(r, "IotDasChannel", channelId, rigId);
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.NameEn !== undefined) patch.NameEn = text(req.body.NameEn, "NameEn", { max: 240 });
    if (req.body.Unit !== undefined) patch.Unit = text(req.body.Unit, "Unit", { required: true, max: 24 });
    if (req.body.SampleRateHz !== undefined) patch.SampleRateHz = number(req.body.SampleRateHz, "SampleRateHz", { required: true, integer: true, min: 1, max: 1000 });
    if (req.body.FilterMethod !== undefined) patch.FilterMethod = oneOf(req.body.FilterMethod, "FilterMethod", FILTER_METHOD_LIST, { required: true });
    if (req.body.FilterWindowSeconds !== undefined) patch.FilterWindowSeconds = number(req.body.FilterWindowSeconds, "FilterWindowSeconds", { required: true, integer: true, min: 1, max: 3600 });
    if (req.body.DeadbandPct !== undefined) patch.DeadbandPct = optionalNumber(req.body.DeadbandPct, "DeadbandPct", { min: 0, max: 100 });
    if (req.body.IsCritical !== undefined) patch.IsCritical = bool(req.body.IsCritical, "IsCritical");
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.DisplayMin !== undefined) patch.DisplayMin = optionalNumber(req.body.DisplayMin, "DisplayMin");
    if (req.body.DisplayMax !== undefined) patch.DisplayMax = optionalNumber(req.body.DisplayMax, "DisplayMax");
    if (req.body.NextCalibrationDue !== undefined) patch.NextCalibrationDue = isoDate(req.body.NextCalibrationDue, "NextCalibrationDue");
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    const result = await r.patch("IotDasChannel", channelId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_CHANNEL_UPDATED", "IotDasChannel", channelId, "iiot.channel.edit");
    return r.get("IotDasChannel", channelId);
  }));

  /* ═══════════════════════ ۳. تله‌متری ═══════════════════════ */

  app.post(`${ROOT}/telemetry`, route("iiot.telemetry.ingest", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["samples", "gatewayCode", "source", "batchNo", "persistSamples", "evaluateRules"]));
    let gatewayId = null;
    if (req.body.gatewayCode !== undefined) {
      const gw = await r.findOne("IotEdgeGateway", [
        { column: "RigId", op: "eq", value: rigId },
        { column: "GatewayCode", op: "eq", value: code(req.body.gatewayCode, "gatewayCode") },
      ]);
      if (!gw) throw notFound();
      gatewayId = gw.Id;
    }
    const source = oneOf(req.body.source, "source", ["live", "buffer", "replay", "simulated", "manual"], { fallback: "live" });
    return r.transaction(async (tx) => ingestPipeline(tx, req, {
      rigId,
      rawSamples: req.body.samples,
      source,
      gatewayId,
      batchNo: req.body.batchNo === undefined ? null : code(req.body.batchNo, "batchNo"),
      persistSamples: bool(req.body.persistSamples, "persistSamples", true),
      evaluateRules: bool(req.body.evaluateRules, "evaluateRules", true),
    }));
  }, 202));

  app.get(`${ROOT}/telemetry`, route("iiot.telemetry.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["channelCode", "channelId", "from", "to", "limit", "bucketSeconds", "downsample"]));
    const from = req.query.from === undefined ? new Date(Date.now() - 3_600_000).toISOString() : isoDateTime(req.query.from, "from", { required: true });
    const to = req.query.to === undefined ? new Date().toISOString() : isoDateTime(req.query.to, "to", { required: true });
    if (Date.parse(from) > Date.parse(to)) throw bad("from", "بازهٔ زمانی نامعتبر: از باید پیش از تا باشد");
    const limit = pageNumber(req.query.limit, "limit", 500, 5000);
    const bucketSeconds = req.query.bucketSeconds === undefined ? null : number(req.query.bucketSeconds, "bucketSeconds", { integer: true, min: 1, max: 86400 });

    let channel = null;
    if (req.query.channelCode !== undefined) {
      channel = await r.findOne("IotDasChannel", [
        { column: "RigId", op: "eq", value: rigId },
        { column: "ChannelCode", op: "eq", value: code(req.query.channelCode, "channelCode") },
      ]);
      if (!channel) throw notFound();
    } else if (req.query.channelId !== undefined) {
      channel = await mustFind(r, "IotDasChannel", id(req.query.channelId, "channelId"), rigId);
    }

    let points = [];
    let buckets = [];
    /* آیا سری از موتور سری زمانی آمده؟ موتور، مقدار خام را نگه می‌دارد و
     * فیلترشده را همراه ندارد؛ مسیر SQL پاییندست هر دو را دارد. */
    let fromTimeSeries = false;
    if (ts && channel) {
      const res = await ts.query({ rigId, channelCode: channel.ChannelCode, from, to, limit, bucketSeconds });
      points = res.points ?? [];
      buckets = res.buckets ?? [];
      fromTimeSeries = true;
      /* اگر درایور سطل‌بندی را انجام نداد (یا پیاده‌سازی سبک‌تری بود)،
       * نمودار خالی نمی‌ماند: سطل‌ها از همان نقطه‌ها ساخته می‌شوند. */
      if (bucketSeconds && buckets.length === 0 && points.length) {
        buckets = rollupSamples(points.map((p) => ({ at: p.at, value: p.value, quality: p.quality })), bucketSeconds);
      }
    }
    if (!points.length) {
      const where = [
        { column: "SampledAt", op: "gte", value: from },
        { column: "SampledAt", op: "lte", value: to },
      ];
      if (channel) where.push({ column: "ChannelId", op: "eq", value: channel.Id });
      const rows = await r.list("IotTelemetrySample", {
        where: [{ column: "RigId", op: "eq", value: rigId }, ...where],
        orderBy: [{ column: "SampledAt", dir: "asc" }],
        limit: 5000,
      });
      points = rows.map((row) => ({
        at: row.SampledAt, value: Number(row.Value), filtered: row.FilteredValue === null || row.FilteredValue === undefined ? null : Number(row.FilteredValue),
        quality: row.Quality, channelCode: channel?.ChannelCode ?? null,
      }));
      if (bucketSeconds) {
        buckets = rollupSamples(points.map((p) => ({ at: p.at, value: p.value, quality: p.quality })), bucketSeconds);
      }
    }

    /* نمودار داشبورد «خام در برابر فیلترشده» است. موتور سری زمانی فقط مقدار
     * خام را نگه می‌دارد (منبع حقیقت تاریخچهٔ پرفرکانس)، ولی خروجی فیلترِ
     * همان لحظه در `IotTelemetrySample.FilteredValue` نشسته است. پس وقتی سری
     * از موتور سری زمانی آمده و فیلترش را همراه ندارد، همان پنجره را از لایهٔ
     * رابطه‌ای می‌خوانیم و به نقطه‌ها می‌چسبانیم — بی‌این کار، اثر پنجرهٔ
     * هموارسازی روی صفحهٔ پرسنل شیفت نامرئی می‌ماند. */
    if (fromTimeSeries && channel && points.length && points.some((p) => p.filtered === undefined || p.filtered === null)) {
      const rows = await r.list("IotTelemetrySample", {
        where: [
          { column: "RigId", op: "eq", value: rigId },
          { column: "ChannelId", op: "eq", value: channel.Id },
          { column: "SampledAt", op: "gte", value: from },
          { column: "SampledAt", op: "lte", value: to },
        ],
        orderBy: [{ column: "SampledAt", dir: "asc" }],
        limit: 5000,
      });
      const filteredByAt = new Map(rows.map((row) => [
        row.SampledAt,
        row.FilteredValue === null || row.FilteredValue === undefined ? null : Number(row.FilteredValue),
      ]));
      points = points.map((p) => (
        p.filtered === undefined || p.filtered === null
          ? { ...p, filtered: filteredByAt.get(p.at) ?? null }
          : p
      ));
    }

    const downsample = bool(req.query.downsample, "downsample", false);
    return {
      channel: channel ? { id: channel.Id, code: channel.ChannelCode, signalType: channel.SignalType, unit: channel.Unit } : null,
      points: downsample ? downsampleForChart(points.map((p) => ({ at: p.at, value: p.value })), Math.min(limit, 120)) : points,
      buckets,
      total: points.length,
      from, to,
      tsDriver: tsDriver(),
    };
  }));

  app.get(`${ROOT}/telemetry/latest`, route("iiot.telemetry.view", async ({ repo: r, rigId }) => {
    const { rows } = await channelsByCode(r, rigId);
    const active = rows.filter((c) => c.IsActive !== false);
    let latest = [];
    if (ts) {
      try {
        const res = await ts.latest({ rigId, channelCodes: active.map((c) => c.ChannelCode) });
        latest = res.latest ?? [];
      } catch { latest = []; }
    }
    const byCode = new Map(latest.map((l) => [l.channelCode, l]));
    const out = [];
    for (const channel of active) {
      const rules = await r.list("IotThresholdRule", {
        where: [{ column: "ChannelId", op: "eq", value: channel.Id }, { column: "IsActive", op: "eq", value: true }],
      });
      const live = byCode.get(channel.ChannelCode);
      const value = live ? Number(live.value) : channel.LastValue === null || channel.LastValue === undefined ? null : Number(channel.LastValue);
      out.push({
        channelId: channel.Id,
        channelCode: channel.ChannelCode,
        nameFa: channel.NameFa,
        signalType: channel.SignalType,
        unit: channel.Unit,
        value,
        at: live?.at ?? channel.LastValueAt ?? null,
        quality: live?.quality ?? channel.LastQuality ?? null,
        isCritical: channel.IsCritical === true,
        displayMin: channel.DisplayMin, displayMax: channel.DisplayMax,
        status: statusColorFor(value, rules.map((rule) => ({
          level: rule.Level, comparison: rule.Comparison,
          thresholdValue: rule.ThresholdValue === null ? null : Number(rule.ThresholdValue),
          secondaryValue: rule.SecondaryValue === null ? null : Number(rule.SecondaryValue),
        }))),
      });
    }
    return {
      channels: out,
      counts: {
        normal: out.filter((c) => c.status === "normal").length,
        warning: out.filter((c) => c.status === "warning").length,
        critical: out.filter((c) => c.status === "critical").length,
      },
      asOf: nowIso(),
    };
  }));

  app.post(`${ROOT}/telemetry/rollups`, route("iiot.analytics.view", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["channelId", "from", "to", "bucketSeconds"]));
    const channelId = id(req.body.channelId, "channelId");
    const channel = await mustFind(r, "IotDasChannel", channelId, rigId);
    const from = isoDateTime(req.body.from, "from", { required: true });
    const to = isoDateTime(req.body.to, "to", { required: true });
    const bucketSeconds = number(req.body.bucketSeconds, "bucketSeconds", { integer: true, min: 1, max: 86400 }) ?? DEFAULT_ROLLUP_BUCKET_SECONDS;
    if (Date.parse(from) > Date.parse(to)) throw bad("from", "بازهٔ زمانی نامعتبر است");
    const rows = await r.list("IotTelemetrySample", {
      where: [
        { column: "ChannelId", op: "eq", value: channelId },
        { column: "SampledAt", op: "gte", value: from },
        { column: "SampledAt", op: "lte", value: to },
      ],
      orderBy: [{ column: "SampledAt", dir: "asc" }],
      limit: 20000,
    });
    const buckets = rollupSamples(rows.map((row) => ({ at: row.SampledAt, value: Number(row.Value), quality: row.Quality })), bucketSeconds);
    const written = [];
    for (const b of buckets) {
      const where = [
        { column: "ChannelId", op: "eq", value: channelId },
        { column: "BucketSeconds", op: "eq", value: bucketSeconds },
        { column: "BucketStart", op: "eq", value: b.bucketStart },
      ];
      const existing = await r.findOne("IotTelemetryRollup", where);
      const payload = {
        RigId: rigId, ChannelId: channelId, BucketSeconds: bucketSeconds, BucketStart: b.bucketStart,
        SampleCount: b.sampleCount, BadCount: b.badCount, MinValue: b.minValue, MaxValue: b.maxValue,
        AvgValue: b.avgValue, StdDev: b.stdDev, FirstValue: b.firstValue, LastValue: b.lastValue,
        QualityPct: b.qualityPct, ModelVersion: IIOT_DOMAIN_VERSION,
      };
      if (existing) await r.patch("IotTelemetryRollup", existing.Id, payload, requestActor(req), existing.RowVersion);
      else await r.create("IotTelemetryRollup", payload, requestActor(req));
      written.push(payload);
    }
    return { channel: { id: channel.Id, code: channel.ChannelCode }, samples: rows.length, buckets: written, bucketSeconds };
  }));

  /* ═══════════════════════ ۴. فیلترینگ و آستانه ═══════════════════════ */

  app.get(`${ROOT}/filter-rules`, route("iiot.filter.view", async ({ repo: r, req, rigId }) => {
    const rows = await listInRig(r, "IotSignalFilterRule", rigId, { orderBy: [{ column: "RuleCode", dir: "asc" }] });
    return { filterRules: rows, total: rows.length };
  }));

  app.post(`${ROOT}/filter-rules`, route("iiot.filter.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "RuleCode", "NameFa", "AppliesToSignals", "FilterMethod", "WindowSeconds", "EmaAlpha", "MinSamples",
      "DeadbandPct", "SpikeZThreshold", "FlatlineSeconds", "IsDefault", "IsActive", "EffectiveFrom", "NoteFa",
    ]));
    const RuleCode = code(req.body.RuleCode, "RuleCode");
    if (await r.findOne("IotSignalFilterRule", [{ column: "RigId", op: "eq", value: rigId }, { column: "RuleCode", op: "eq", value: RuleCode }])) {
      throw conflict("IIOT_DUPLICATE", `کد قاعده «${RuleCode}» تکراری است`);
    }
    const applies = text(req.body.AppliesToSignals, "AppliesToSignals", { required: true, max: 400 });
    if (applies !== "*") {
      for (const part of applies.split(",")) {
        if (!SIGNAL_TYPE_LIST.includes(part.trim())) throw bad("AppliesToSignals", `نوع سیگنال ناشناخته: ${part}`);
      }
    }
    const row = await r.create("IotSignalFilterRule", {
      RigId: rigId, RuleCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      AppliesToSignals: applies,
      FilterMethod: oneOf(req.body.FilterMethod, "FilterMethod", FILTER_METHOD_LIST, { fallback: "sma" }),
      WindowSeconds: number(req.body.WindowSeconds, "WindowSeconds", { integer: true, min: 1, max: 3600 }) ?? 10,
      EmaAlpha: optionalNumber(req.body.EmaAlpha, "EmaAlpha", { min: 0.0001, max: 1 }),
      MinSamples: number(req.body.MinSamples, "MinSamples", { integer: true, min: 1, max: 10000 }) ?? 5,
      DeadbandPct: optionalNumber(req.body.DeadbandPct, "DeadbandPct", { min: 0, max: 100 }),
      SpikeZThreshold: optionalNumber(req.body.SpikeZThreshold, "SpikeZThreshold", { min: 0, max: 20 }),
      FlatlineSeconds: number(req.body.FlatlineSeconds, "FlatlineSeconds", { integer: true, min: 1, max: 86400 }) ?? 60,
      IsDefault: bool(req.body.IsDefault, "IsDefault", false),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      EffectiveFrom: isoDateTime(req.body.EffectiveFrom, "EffectiveFrom"),
      ModelVersion: IIOT_DOMAIN_VERSION,
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "IIOT_FILTER_RULE_CREATED", "IotSignalFilterRule", row.Id, "iiot.filter.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/filter-rules/:ruleId`, route("iiot.filter.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["NameFa", "AppliesToSignals", "FilterMethod", "WindowSeconds", "EmaAlpha", "MinSamples", "DeadbandPct", "SpikeZThreshold", "FlatlineSeconds", "IsDefault", "IsActive", "NoteFa", "RowVersion"]));
    const ruleId = id(req.params.ruleId, "ruleId");
    const existing = await mustFind(r, "IotSignalFilterRule", ruleId, rigId);
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.FilterMethod !== undefined) patch.FilterMethod = oneOf(req.body.FilterMethod, "FilterMethod", FILTER_METHOD_LIST, { required: true });
    if (req.body.WindowSeconds !== undefined) patch.WindowSeconds = number(req.body.WindowSeconds, "WindowSeconds", { required: true, integer: true, min: 1, max: 3600 });
    if (req.body.MinSamples !== undefined) patch.MinSamples = number(req.body.MinSamples, "MinSamples", { required: true, integer: true, min: 1, max: 10000 });
    if (req.body.FlatlineSeconds !== undefined) patch.FlatlineSeconds = number(req.body.FlatlineSeconds, "FlatlineSeconds", { required: true, integer: true, min: 1, max: 86400 });
    if (req.body.IsDefault !== undefined) patch.IsDefault = bool(req.body.IsDefault, "IsDefault");
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    /* تغییر قاعده، نسخه را بالا می‌برد تا هشدارهای قدیمی با نسخهٔ تازه سنجیده نشوند. */
    patch.Version = Number(existing.Version ?? 1) + 1;
    const result = await r.patch("IotSignalFilterRule", ruleId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_FILTER_RULE_UPDATED", "IotSignalFilterRule", ruleId, "iiot.filter.edit");
    return r.get("IotSignalFilterRule", ruleId);
  }));

  app.get(`${ROOT}/threshold-rules`, route("iiot.threshold.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["channelId", "level", "detectKind", "isActive", "limit", "offset"]));
    const where = [];
    if (req.query.channelId !== undefined) where.push({ column: "ChannelId", op: "eq", value: id(req.query.channelId, "channelId") });
    if (req.query.level !== undefined) where.push({ column: "Level", op: "eq", value: oneOf(req.query.level, "level", ["warning", "critical"], { required: true }) });
    if (req.query.detectKind !== undefined) where.push({ column: "DetectKind", op: "eq", value: oneOf(req.query.detectKind, "detectKind", DETECTION_KIND_LIST, { required: true }) });
    if (req.query.isActive !== undefined) where.push({ column: "IsActive", op: "eq", value: bool(req.query.isActive, "isActive") });
    const rows = await listInRig(r, "IotThresholdRule", rigId, {
      where,
      orderBy: [{ column: "RuleCode", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 200, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 100000),
    });
    return { thresholdRules: rows, total: rows.length };
  }));

  app.post(`${ROOT}/threshold-rules`, route("iiot.threshold.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "RuleCode", "ChannelId", "NameFa", "Level", "DetectKind", "Comparison", "ThresholdValue", "SecondaryValue",
      "DurationSeconds", "MinSamples", "HysteresisPct", "CooldownSeconds", "TorqueCvThreshold",
      "RpmSwingPctThreshold", "PressureDropPctThreshold", "AutoDispatch", "DispatchTargets", "CmmsPriority",
      "CmmsSiteRef", "CmmsAssetRef", "MesWorkCenterRef", "MesPlantRef", "PmisProjectRef", "NptCode",
      "EscalationNoteFa", "IsActive", "EffectiveFrom", "NoteFa",
    ]));
    const RuleCode = code(req.body.RuleCode, "RuleCode");
    if (await r.findOne("IotThresholdRule", [{ column: "RigId", op: "eq", value: rigId }, { column: "RuleCode", op: "eq", value: RuleCode }])) {
      throw conflict("IIOT_DUPLICATE", `کد آستانه «${RuleCode}» تکراری است`);
    }
    const ChannelId = id(req.body.ChannelId, "ChannelId");
    await mustFind(r, "IotDasChannel", ChannelId, rigId);
    const DetectKind = oneOf(req.body.DetectKind, "DetectKind", DETECTION_KIND_LIST, { fallback: "threshold" });
    const Comparison = oneOf(req.body.Comparison, "Comparison", ["gt", "gte", "lt", "lte", "band-out", "rate"], { fallback: "gt" });
    const ThresholdValue = optionalNumber(req.body.ThresholdValue, "ThresholdValue");
    if (DetectKind === "threshold" && ThresholdValue === null) throw bad("ThresholdValue", "برای تشخیص آستانه‌ای، مقدار آستانه الزامی است");
    if (Comparison === "band-out" && optionalNumber(req.body.SecondaryValue, "SecondaryValue") === null) {
      throw bad("SecondaryValue", "برای مقایسهٔ band-out، کرانهٔ دوم الزامی است");
    }
    const AutoDispatch = bool(req.body.AutoDispatch, "AutoDispatch", false);
    const DispatchTargets = text(req.body.DispatchTargets, "DispatchTargets", { max: 120 });
    if (AutoDispatch) {
      const targets = parseDispatchTargets(DispatchTargets);
      if (!targets.length) throw bad("DispatchTargets", "برای ارسال خودکار، دست‌کم یک مقصد معتبر (cmms|mes|pmis) الزامی است");
      /* مقصد باید مرجع نرم خودش را داشته باشد؛ وگرنه رویداد در پل مقصد با
       * خطای «مرجع ناشناخته» رد می‌شود و کاربر فکر می‌کند ارسال شده است. */
      if (targets.includes("cmms") && !text(req.body.CmmsSiteRef, "CmmsSiteRef", { max: 60 })) throw bad("CmmsSiteRef", "برای ارسال به CMMS، مرجع سایت نت الزامی است");
      if (targets.includes("mes") && !text(req.body.MesWorkCenterRef, "MesWorkCenterRef", { max: 60 })) throw bad("MesWorkCenterRef", "برای ارسال به MES، مرجع مرکز کاری الزامی است");
      if (targets.includes("pmis") && !text(req.body.PmisProjectRef, "PmisProjectRef", { max: 60 })) throw bad("PmisProjectRef", "برای ارسال به PMIS، مرجع پروژه الزامی است");
    }
    const row = await r.create("IotThresholdRule", {
      RigId: rigId, RuleCode, ChannelId,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      Level: oneOf(req.body.Level, "Level", ["warning", "critical"], { required: true }),
      DetectKind, Comparison, ThresholdValue,
      SecondaryValue: optionalNumber(req.body.SecondaryValue, "SecondaryValue"),
      DurationSeconds: number(req.body.DurationSeconds, "DurationSeconds", { integer: true, min: 0, max: 86400 }) ?? 30,
      MinSamples: number(req.body.MinSamples, "MinSamples", { integer: true, min: 1, max: 100000 }) ?? 10,
      HysteresisPct: optionalNumber(req.body.HysteresisPct, "HysteresisPct", { min: 0, max: 100 }),
      CooldownSeconds: number(req.body.CooldownSeconds, "CooldownSeconds", { integer: true, min: 0, max: 86400 }) ?? 600,
      TorqueCvThreshold: optionalNumber(req.body.TorqueCvThreshold, "TorqueCvThreshold", { min: 0, max: 500 }),
      RpmSwingPctThreshold: optionalNumber(req.body.RpmSwingPctThreshold, "RpmSwingPctThreshold", { min: 0, max: 500 }),
      PressureDropPctThreshold: optionalNumber(req.body.PressureDropPctThreshold, "PressureDropPctThreshold", { min: 0, max: 100 }),
      AutoDispatch, DispatchTargets,
      CmmsPriority: optionalNumber(req.body.CmmsPriority, "CmmsPriority", { integer: true, min: 1, max: 5 }),
      CmmsSiteRef: text(req.body.CmmsSiteRef, "CmmsSiteRef", { max: 60 }),
      CmmsAssetRef: text(req.body.CmmsAssetRef, "CmmsAssetRef", { max: 60 }),
      MesWorkCenterRef: text(req.body.MesWorkCenterRef, "MesWorkCenterRef", { max: 60 }),
      MesPlantRef: text(req.body.MesPlantRef, "MesPlantRef", { max: 60 }),
      PmisProjectRef: text(req.body.PmisProjectRef, "PmisProjectRef", { max: 60 }),
      NptCode: text(req.body.NptCode, "NptCode", { max: 40 }),
      EscalationNoteFa: text(req.body.EscalationNoteFa, "EscalationNoteFa", { max: 1000 }),
      Version: 1,
      IsActive: bool(req.body.IsActive, "IsActive", true),
      EffectiveFrom: isoDateTime(req.body.EffectiveFrom, "EffectiveFrom"),
      ModelVersion: IIOT_DOMAIN_VERSION,
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "IIOT_THRESHOLD_CREATED", "IotThresholdRule", row.Id, "iiot.threshold.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/threshold-rules/:ruleId`, route("iiot.threshold.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "NameFa", "Level", "Comparison", "ThresholdValue", "SecondaryValue", "DurationSeconds", "MinSamples",
      "HysteresisPct", "CooldownSeconds", "TorqueCvThreshold", "RpmSwingPctThreshold", "PressureDropPctThreshold",
      "AutoDispatch", "DispatchTargets", "CmmsSiteRef", "CmmsAssetRef", "MesWorkCenterRef", "PmisProjectRef",
      "NptCode", "EscalationNoteFa", "IsActive", "NoteFa", "RowVersion",
    ]));
    const ruleId = id(req.params.ruleId, "ruleId");
    const existing = await mustFind(r, "IotThresholdRule", ruleId, rigId);
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.Level !== undefined) patch.Level = oneOf(req.body.Level, "Level", ["warning", "critical"], { required: true });
    if (req.body.Comparison !== undefined) patch.Comparison = oneOf(req.body.Comparison, "Comparison", ["gt", "gte", "lt", "lte", "band-out", "rate"], { required: true });
    if (req.body.ThresholdValue !== undefined) patch.ThresholdValue = optionalNumber(req.body.ThresholdValue, "ThresholdValue");
    if (req.body.SecondaryValue !== undefined) patch.SecondaryValue = optionalNumber(req.body.SecondaryValue, "SecondaryValue");
    if (req.body.DurationSeconds !== undefined) patch.DurationSeconds = number(req.body.DurationSeconds, "DurationSeconds", { required: true, integer: true, min: 0, max: 86400 });
    if (req.body.MinSamples !== undefined) patch.MinSamples = number(req.body.MinSamples, "MinSamples", { required: true, integer: true, min: 1, max: 100000 });
    if (req.body.CooldownSeconds !== undefined) patch.CooldownSeconds = number(req.body.CooldownSeconds, "CooldownSeconds", { required: true, integer: true, min: 0, max: 86400 });
    if (req.body.HysteresisPct !== undefined) patch.HysteresisPct = optionalNumber(req.body.HysteresisPct, "HysteresisPct", { min: 0, max: 100 });
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.AutoDispatch !== undefined) patch.AutoDispatch = bool(req.body.AutoDispatch, "AutoDispatch");
    if (req.body.DispatchTargets !== undefined) patch.DispatchTargets = text(req.body.DispatchTargets, "DispatchTargets", { max: 120 });
    if (req.body.NptCode !== undefined) patch.NptCode = text(req.body.NptCode, "NptCode", { max: 40 });
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    const autoDispatch = patch.AutoDispatch ?? existing.AutoDispatch === true;
    const targets = parseDispatchTargets(patch.DispatchTargets ?? existing.DispatchTargets);
    if (autoDispatch && !targets.length) throw bad("DispatchTargets", "برای ارسال خودکار، دست‌کم یک مقصد معتبر الزامی است");
    patch.Version = Number(existing.Version ?? 1) + 1;
    const result = await r.patch("IotThresholdRule", ruleId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_THRESHOLD_UPDATED", "IotThresholdRule", ruleId, "iiot.threshold.edit");
    return r.get("IotThresholdRule", ruleId);
  }));

  /** اجرای آزمایشی یک قاعده روی دادهٔ واقعی — بدون ساختن هشدار. */
  app.post(`${ROOT}/threshold-rules/:ruleId/test`, route("iiot.threshold.view", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["lookbackSeconds", "dryRun"]));
    const ruleId = id(req.params.ruleId, "ruleId");
    const rule = await mustFind(r, "IotThresholdRule", ruleId, rigId);
    const channel = await mustFind(r, "IotDasChannel", rule.ChannelId, rigId);
    const lookback = number(req.body.lookbackSeconds, "lookbackSeconds", { integer: true, min: 5, max: 7200 }) ?? DEFAULT_RULE_LOOKBACK_SECONDS;
    const at = nowIso();
    const series = await seriesFor(r, { rigId, channel, lookbackSeconds: lookback, nowAt: at });
    const seriesBySignal = { [channel.SignalType]: series };
    if (rule.DetectKind === "stick-slip") {
      const all = await listInRig(r, "IotDasChannel", rigId);
      const torqueChannel = all.find((c) => c.SignalType === "torque");
      const rpmChannel = all.find((c) => c.SignalType === "rpm");
      if (torqueChannel) seriesBySignal.torque = await seriesFor(r, { rigId, channel: torqueChannel, lookbackSeconds: lookback, nowAt: at });
      if (rpmChannel) seriesBySignal.rpm = await seriesFor(r, { rigId, channel: rpmChannel, lookbackSeconds: lookback, nowAt: at });
    }
    if (rule.DetectKind === "pump-drop") {
      const all = await listInRig(r, "IotDasChannel", rigId);
      const pump = all.find((c) => c.SignalType === "mud-pump-pressure") ?? channel;
      seriesBySignal["mud-pump-pressure"] = await seriesFor(r, { rigId, channel: pump, lookbackSeconds: lookback, nowAt: at });
    }
    const { verdict, stickSlip, pumpDrop } = evaluateDetectRule(
      {
        level: rule.Level, detectKind: rule.DetectKind, comparison: rule.Comparison,
        thresholdValue: rule.ThresholdValue, secondaryValue: rule.SecondaryValue,
        durationSeconds: rule.DurationSeconds, minSamples: rule.MinSamples,
        torqueCvThreshold: rule.TorqueCvThreshold, rpmSwingPctThreshold: rule.RpmSwingPctThreshold,
        pressureDropPctThreshold: rule.PressureDropPctThreshold,
      },
      seriesBySignal, channel.SignalType,
      { sampleRateHz: channel.SampleRateHz, windowSeconds: rule.DurationSeconds || lookback, pumpFloor: rule.ThresholdValue },
    );
    return {
      dryRun: true,
      rule: { id: rule.Id, ruleCode: rule.RuleCode, level: rule.Level, detectKind: rule.DetectKind, version: rule.Version },
      channel: { id: channel.Id, code: channel.ChannelCode, signalType: channel.SignalType },
      sampleCount: series.length,
      verdict, stickSlip: stickSlip ?? null, pumpDrop: pumpDrop ?? null,
      wouldAlert: verdict.breach && verdict.sustained,
    };
  }));

  /* ═══════════════════════ ۵. هشدارها ═══════════════════════ */

  app.get(`${ROOT}/alerts`, route("iiot.alert.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["status", "level", "detectionKind", "channelId", "from", "to", "limit", "offset"]));
    const where = [];
    if (req.query.status !== undefined) where.push({ column: "Status", op: "eq", value: oneOf(req.query.status, "status", ["active", "acknowledged", "resolved", "suppressed", "false-positive"], { required: true }) });
    if (req.query.level !== undefined) where.push({ column: "Level", op: "eq", value: oneOf(req.query.level, "level", ["warning", "critical"], { required: true }) });
    if (req.query.detectionKind !== undefined) where.push({ column: "DetectionKind", op: "eq", value: oneOf(req.query.detectionKind, "detectionKind", DETECTION_KIND_LIST, { required: true }) });
    if (req.query.channelId !== undefined) where.push({ column: "ChannelId", op: "eq", value: id(req.query.channelId, "channelId") });
    if (req.query.from !== undefined) where.push({ column: "DetectedAt", op: "gte", value: isoDateTime(req.query.from, "from", { required: true }) });
    if (req.query.to !== undefined) where.push({ column: "DetectedAt", op: "lte", value: isoDateTime(req.query.to, "to", { required: true }) });
    const rows = await listInRig(r, "IotTelemetryAlert", rigId, {
      where,
      orderBy: [{ column: "DetectedAt", dir: "desc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 100000),
    });
    const channels = await listInRig(r, "IotDasChannel", rigId);
    const byId = new Map(channels.map((c) => [c.Id, c]));
    return {
      alerts: rows.map((a) => ({ ...a, channel: byId.get(a.ChannelId) ? { code: byId.get(a.ChannelId).ChannelCode, nameFa: byId.get(a.ChannelId).NameFa, signalType: byId.get(a.ChannelId).SignalType, unit: byId.get(a.ChannelId).Unit } : null })),
      total: rows.length,
      counts: {
        active: rows.filter((a) => a.Status === "active").length,
        acknowledged: rows.filter((a) => a.Status === "acknowledged").length,
        critical: rows.filter((a) => a.Level === "critical").length,
      },
    };
  }));

  app.post(`${ROOT}/alerts/:alertId/acknowledge`, route("iiot.alert.ack", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["NoteFa", "RowVersion"]));
    const alertId = id(req.params.alertId, "alertId");
    const alert = await mustFind(r, "IotTelemetryAlert", alertId, rigId);
    if (!["active", "acknowledged"].includes(alert.Status)) {
      throw businessRule("IIOT_ALERT_STATE", `هشدار با وضعیت «${alert.Status}» قابل تأیید نیست`);
    }
    const at = nowIso();
    const patch = {
      Status: "acknowledged",
      AcknowledgedAt: at,
      AcknowledgedById: requestActor(req),
      AckNoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    };
    const result = await r.patch("IotTelemetryAlert", alertId, patch, requestActor(req), req.body.RowVersion ?? alert.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_ALERT_ACKNOWLEDGED", "IotTelemetryAlert", alertId, "iiot.alert.ack");
    return r.get("IotTelemetryAlert", alertId);
  }));

  app.post(`${ROOT}/alerts/:alertId/resolve`, route("iiot.alert.resolve", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["ResolutionNoteFa", "RowVersion"]));
    const alertId = id(req.params.alertId, "alertId");
    const alert = await mustFind(r, "IotTelemetryAlert", alertId, rigId);
    if (["resolved", "suppressed", "false-positive"].includes(alert.Status)) {
      throw businessRule("IIOT_ALERT_STATE", `هشدار با وضعیت «${alert.Status}» قابل بستن نیست`);
    }
    const at = nowIso();
    const patch = {
      Status: "resolved",
      ResolvedAt: at,
      ResolvedById: requestActor(req),
      ResolutionNoteFa: text(req.body.ResolutionNoteFa, "ResolutionNoteFa", { required: true, max: 1000 }),
    };
    const result = await r.patch("IotTelemetryAlert", alertId, patch, requestActor(req), req.body.RowVersion ?? alert.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    /* بستن هشدار، توقف خودکارِ مرتبط را هم می‌بندد و مدت NPT را قطعی می‌کند. */
    const downtime = await closeDowntimeForAlert(r, req, { rigId, alert, at, reasonFa: "بستن دستی هشدار توسط پرسنل شیفت" });
    await writeAudit(r, req, "IIOT_ALERT_RESOLVED", "IotTelemetryAlert", alertId, "iiot.alert.resolve");
    return { alert: await r.get("IotTelemetryAlert", alertId), downtime };
  }));

  app.post(`${ROOT}/alerts/:alertId/false-positive`, route("iiot.alert.resolve", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["SuppressedReasonFa", "RowVersion"]));
    const alertId = id(req.params.alertId, "alertId");
    const alert = await mustFind(r, "IotTelemetryAlert", alertId, rigId);
    const reason = text(req.body.SuppressedReasonFa, "SuppressedReasonFa", { required: true, max: 600 });
    const patch = {
      Status: "false-positive",
      SuppressedReasonFa: reason,
      ResolvedAt: nowIso(),
      ResolvedById: requestActor(req),
      ResolutionNoteFa: "هشدار کاذب — قاعده نیازمند بازتنظیم است",
    };
    const result = await r.patch("IotTelemetryAlert", alertId, patch, requestActor(req), req.body.RowVersion ?? alert.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    /* توقف خودکاری که از این هشدار ساخته شده بود، NPT نیست — باید برگردد،
     * وگرنه گزارش پیشرفت، زمان نامولّدی را نشان می‌دهد که وجود نداشته. */
    const downtime = await r.findOne("IotRigDowntime", [{ column: "RigId", op: "eq", value: rigId }, { column: "AlertId", op: "eq", value: alertId }]);
    let reverted = null;
    if (downtime) {
      await r.remove("IotRigDowntime", downtime.Id);
      reverted = { downtimeId: downtime.Id, code: downtime.DowntimeCode, action: "removed" };
    }
    await writeAudit(r, req, "IIOT_ALERT_FALSE_POSITIVE", "IotTelemetryAlert", alertId, "iiot.alert.resolve", { reason });
    return { alert: await r.get("IotTelemetryAlert", alertId), revertedDowntime: reverted };
  }));

  app.post(`${ROOT}/alerts/:alertId/dispatch`, route("iiot.alert.dispatch", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["targets"]));
    const alertId = id(req.params.alertId, "alertId");
    const alert = await mustFind(r, "IotTelemetryAlert", alertId, rigId);
    const rule = alert.RuleId ? await r.get("IotThresholdRule", alert.RuleId) : null;
    const requested = req.body.targets === undefined ? parseDispatchTargets(rule?.DispatchTargets) : parseDispatchTargets(text(req.body.targets, "targets", { required: true, max: 120 }));
    if (!requested.length) throw bad("targets", "دست‌کم یک مقصد معتبر (cmms|mes|pmis) الزامی است");
    const channel = await mustFind(r, "IotDasChannel", alert.ChannelId, rigId);
    const rig = await mustFindRig(r, rigId);
    const results = [];
    for (const target of requested) {
      const out = await enqueueIntegration(r, req, {
        rigId, target, kind: "alert", sourceTable: "IotTelemetryAlert", sourceId: alertId,
        discriminator: `manual-${requestActor(req)}`,
        payload: {
          occurredAt: alert.DetectedAt,
          rigId, rigNo: rig.RigNo, alertId, alertCode: alert.AlertCode, level: alert.Level,
          detectKind: alert.DetectionKind, titleFa: alert.TitleFa, messageFa: alert.MessageFa,
          channelCode: channel.ChannelCode, signalType: channel.SignalType, unit: channel.Unit,
          triggerValue: alert.TriggerValue, filteredValue: alert.FilteredValue,
          cmmsSiteRef: rule?.CmmsSiteRef ?? rig.CmmsSiteRef ?? null,
          cmmsAssetRef: rule?.CmmsAssetRef ?? null,
          cmmsPriority: rule?.CmmsPriority ?? 2,
          mesWorkCenterRef: rule?.MesWorkCenterRef ?? rig.MesWorkCenterRef ?? null,
          pmisProjectRef: rule?.PmisProjectRef ?? rig.PmisProjectRef ?? null,
          manual: true,
        },
      });
      results.push({ target, eventId: out.event.Id, duplicated: out.duplicated, delivered: out.delivered, error: out.error ?? null });
    }
    const delivered = results.filter((x) => x.delivered).length;
    await r.patch("IotTelemetryAlert", alertId, {
      DispatchStatus: delivered === results.length ? "dispatched" : delivered > 0 ? "partial" : "failed",
    }, requestActor(req), alert.RowVersion);
    await writeAudit(r, req, "IIOT_ALERT_DISPATCHED", "IotTelemetryAlert", alertId, "iiot.alert.dispatch", { targets: requested });
    return { alertId, results, delivered, total: results.length };
  }));

  /* ═══════════════════════ ۶. گیت‌وی و Store-and-Forward ═══════════════════════ */

  app.get(`${ROOT}/gateways`, route("iiot.gateway.view", async ({ repo: r, req, rigId }) => {
    const rows = await listInRig(r, "IotEdgeGateway", rigId, { orderBy: [{ column: "GatewayCode", dir: "asc" }] });
    const at = nowIso();
    const withHealth = [];
    for (const gw of rows) {
      const buffered = await r.count("IotGatewayBuffer", [
        { column: "GatewayId", op: "eq", value: gw.Id },
        { column: "Status", op: "in", value: ["buffered", "failed"] },
      ]);
      const deadLetter = await r.count("IotGatewayBuffer", [
        { column: "GatewayId", op: "eq", value: gw.Id },
        { column: "Status", op: "eq", value: "dead-letter" },
      ]);
      const heartbeatAge = gw.LastHeartbeatAt ? Math.max(0, (Date.parse(at) - Date.parse(gw.LastHeartbeatAt)) / 1000) : null;
      const stale = heartbeatAge !== null && gw.HeartbeatIntervalSeconds ? heartbeatAge > Number(gw.HeartbeatIntervalSeconds) * 3 : false;
      withHealth.push({
        ...gw,
        bufferedCount: buffered,
        deadLetterCount: deadLetter,
        fillPct: bufferFillPct(Number(gw.BufferUsed ?? 0), Number(gw.BufferCapacity ?? 0)),
        heartbeatAgeSeconds: heartbeatAge === null ? null : Math.round(heartbeatAge),
        stale,
      });
    }
    return { gateways: withHealth, total: withHealth.length };
  }));

  app.post(`${ROOT}/gateways`, route("iiot.gateway.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "GatewayCode", "NameFa", "Protocol", "FirmwareVersion", "IpAddress", "LocationFa", "SyncMode",
      "BufferCapacity", "MaxBatchSize", "MaxAttempts", "HeartbeatIntervalSeconds", "AuthMode", "InstalledAt",
      "IsActive", "NoteFa",
    ]));
    const GatewayCode = code(req.body.GatewayCode, "GatewayCode");
    if (await r.findOne("IotEdgeGateway", [{ column: "RigId", op: "eq", value: rigId }, { column: "GatewayCode", op: "eq", value: GatewayCode }])) {
      throw conflict("IIOT_DUPLICATE", `کد گیت‌وی «${GatewayCode}» تکراری است`);
    }
    const row = await r.create("IotEdgeGateway", {
      RigId: rigId, GatewayCode,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      Protocol: oneOf(req.body.Protocol, "Protocol", ["mqtt", "opc-ua", "modbus", "witsml", "http"], { required: true }),
      FirmwareVersion: text(req.body.FirmwareVersion, "FirmwareVersion", { max: 60 }),
      IpAddress: text(req.body.IpAddress, "IpAddress", { max: 60 }),
      LocationFa: text(req.body.LocationFa, "LocationFa", { max: 240 }),
      SyncMode: oneOf(req.body.SyncMode, "SyncMode", ["realtime", "store-forward", "batch"], { fallback: "store-forward" }),
      BufferCapacity: number(req.body.BufferCapacity, "BufferCapacity", { integer: true, min: 1, max: 10000000 }) ?? 100000,
      BufferUsed: 0,
      MaxBatchSize: number(req.body.MaxBatchSize, "MaxBatchSize", { integer: true, min: 1, max: 100000 }) ?? 1000,
      MaxAttempts: number(req.body.MaxAttempts, "MaxAttempts", { integer: true, min: 1, max: 50 }) ?? 5,
      ConnectionState: "offline",
      HeartbeatIntervalSeconds: optionalNumber(req.body.HeartbeatIntervalSeconds, "HeartbeatIntervalSeconds", { integer: true, min: 1, max: 3600 }),
      AuthMode: oneOf(req.body.AuthMode, "AuthMode", ["token", "certificate", "anonymous"], { fallback: "token" }),
      InstalledAt: isoDateTime(req.body.InstalledAt, "InstalledAt") ?? nowIso(),
      IsActive: bool(req.body.IsActive, "IsActive", true),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "IIOT_GATEWAY_CREATED", "IotEdgeGateway", row.Id, "iiot.gateway.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/gateways/:gatewayId`, route("iiot.gateway.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["NameFa", "Protocol", "FirmwareVersion", "IpAddress", "LocationFa", "SyncMode", "BufferCapacity", "MaxBatchSize", "MaxAttempts", "ConnectionState", "HeartbeatIntervalSeconds", "IsActive", "NoteFa", "RowVersion"]));
    const gatewayId = id(req.params.gatewayId, "gatewayId");
    const existing = await mustFind(r, "IotEdgeGateway", gatewayId, rigId);
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.Protocol !== undefined) patch.Protocol = oneOf(req.body.Protocol, "Protocol", ["mqtt", "opc-ua", "modbus", "witsml", "http"], { required: true });
    if (req.body.FirmwareVersion !== undefined) patch.FirmwareVersion = text(req.body.FirmwareVersion, "FirmwareVersion", { max: 60 });
    if (req.body.SyncMode !== undefined) patch.SyncMode = oneOf(req.body.SyncMode, "SyncMode", ["realtime", "store-forward", "batch"], { required: true });
    if (req.body.BufferCapacity !== undefined) patch.BufferCapacity = number(req.body.BufferCapacity, "BufferCapacity", { required: true, integer: true, min: 1, max: 10000000 });
    if (req.body.ConnectionState !== undefined) patch.ConnectionState = oneOf(req.body.ConnectionState, "ConnectionState", ["online", "degraded", "offline"], { required: true });
    if (req.body.HeartbeatIntervalSeconds !== undefined) patch.HeartbeatIntervalSeconds = optionalNumber(req.body.HeartbeatIntervalSeconds, "HeartbeatIntervalSeconds", { integer: true, min: 1, max: 3600 });
    if (req.body.IsActive !== undefined) patch.IsActive = bool(req.body.IsActive, "IsActive");
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    if (patch.BufferCapacity !== undefined && Number(existing.BufferUsed ?? 0) > patch.BufferCapacity) {
      throw businessRule("IIOT_GATEWAY_BUFFER", "ظرفیت بافر نمی‌تواند از تعداد نمونهٔ بافرشده کمتر باشد");
    }
    const result = await r.patch("IotEdgeGateway", gatewayId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_GATEWAY_UPDATED", "IotEdgeGateway", gatewayId, "iiot.gateway.edit");
    return r.get("IotEdgeGateway", gatewayId);
  }));

  app.post(`${ROOT}/gateways/:gatewayId/heartbeat`, route("iiot.telemetry.ingest", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["connectionState", "bufferUsed", "firmwareVersion", "RowVersion"]));
    const gatewayId = id(req.params.gatewayId, "gatewayId");
    const gateway = await mustFind(r, "IotEdgeGateway", gatewayId, rigId);
    const at = nowIso();
    const bufferUsed = optionalNumber(req.body.bufferUsed, "bufferUsed", { integer: true, min: 0 }) ?? Number(gateway.BufferUsed ?? 0);
    if (bufferUsed > Number(gateway.BufferCapacity ?? 0)) {
      throw businessRule("IIOT_GATEWAY_OVERFLOW", "بافر لبه از ظرفیت رد شده است — همگام‌سازی فوری لازم است");
    }
    const patch = {
      LastHeartbeatAt: at,
      BufferUsed: bufferUsed,
      ConnectionState: oneOf(req.body.connectionState, "connectionState", ["online", "degraded", "offline"], { fallback: "online" }),
    };
    if (req.body.firmwareVersion !== undefined) patch.FirmwareVersion = text(req.body.firmwareVersion, "firmwareVersion", { max: 60 });
    await r.patch("IotEdgeGateway", gatewayId, patch, requestActor(req), req.body.RowVersion ?? gateway.RowVersion);
    return { gatewayId, ...patch, fillPct: bufferFillPct(bufferUsed, Number(gateway.BufferCapacity ?? 0)) };
  }));

  app.get(`${ROOT}/gateways/:gatewayId/buffer`, route("iiot.buffer.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["status", "limit", "offset"]));
    const gatewayId = id(req.params.gatewayId, "gatewayId");
    await mustFind(r, "IotEdgeGateway", gatewayId, rigId);
    const where = [{ column: "GatewayId", op: "eq", value: gatewayId }];
    if (req.query.status !== undefined) where.push({ column: "Status", op: "eq", value: oneOf(req.query.status, "status", ["buffered", "sending", "sent", "failed", "dead-letter"], { required: true }) });
    const rows = await r.list("IotGatewayBuffer", {
      where: [{ column: "RigId", op: "eq", value: rigId }, ...where],
      orderBy: [{ column: "CapturedAt", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 100000),
    });
    /* «آمادهٔ همگام‌سازی» از همان تابع موتور دامنه می‌آید که گیت‌وی واقعی
     * استفاده می‌کند، پس پاسخ API و رفتار لبه یکی است. */
    const ready = selectBufferedForSync(rows.map((x) => ({ id: x.Id, status: x.Status, capturedAt: x.CapturedAt })), { connectivityOnline: true, limit: 50 });
    return {
      buffer: rows.map((row) => ({ ...row, PayloadJson: undefined, checksum: row.Checksum, sampleCount: row.SampleCount })),
      total: rows.length,
      readyToSync: ready,
      counts: {
        buffered: rows.filter((x) => x.Status === "buffered").length,
        failed: rows.filter((x) => x.Status === "failed").length,
        deadLetter: rows.filter((x) => x.Status === "dead-letter").length,
        sent: rows.filter((x) => x.Status === "sent").length,
      },
    };
  }));

  /**
   * بارگذاری دستهٔ بافرشدهٔ لبه.
   * این همان «همگام‌سازی خودکار پس از قطعی اینترنت دکل» است: گیت‌وی دسته را
   * با چک‌سام می‌فرستد، سرور راستی‌آزمایی و درج می‌کند و دسته را «sent»
   * می‌گذارد. ارسال دوبارهٔ همان `BatchNo`، نمونهٔ دوباره نمی‌سازد.
   */
  app.post(`${ROOT}/gateways/:gatewayId/buffer`, route("iiot.telemetry.ingest", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["batchNo", "capturedAt", "checksum", "samples", "connectivityState", "rebuildBatchNo"]));
    const gatewayId = id(req.params.gatewayId, "gatewayId");
    const gateway = await mustFind(r, "IotEdgeGateway", gatewayId, rigId);
    const samples = req.body.samples;
    if (!Array.isArray(samples) || samples.length === 0) throw bad("samples", "دستهٔ بافر باید دست‌کم یک نمونه داشته باشد");
    if (samples.length > MAX_SAMPLES_PER_REQUEST) throw bad("samples", `حداکثر ${MAX_SAMPLES_PER_REQUEST} نمونه در هر دسته مجاز است`);
    const at = nowIso();

    /* اگر batchNo داده نشد، از خودِ داده ساخته می‌شود — یعنی deterministic. */
    const built = buildStoreForwardBatch({
      rigId,
      gatewayCode: gateway.GatewayCode,
      capturedAt: req.body.capturedAt === undefined ? at : isoDateTime(req.body.capturedAt, "capturedAt", { required: true }),
      samples: samples.map((s) => ({
        channelCode: String(s.channelCode ?? "").trim(),
        at: isoDateTime(s.at ?? s.sampledAt, "at", { required: true }),
        value: typeof s.value === "number" ? s.value : Number(s.value),
        quality: ["good", "suspect", "bad", "stale"].includes(s.quality) ? s.quality : "good",
        seqNo: s.seqNo === undefined ? undefined : Number(s.seqNo),
      })),
    });
    const BatchNo = req.body.batchNo === undefined ? built.batchNo : code(req.body.batchNo, "batchNo");
    const Checksum = req.body.checksum === undefined ? built.checksum : text(req.body.checksum, "checksum", { required: true, max: 80 });

    const verification = verifyBatch({ checksum: Checksum, payload: built.payload, sampleCount: built.sampleCount });
    if (!verification.ok) {
      throw businessRule(verification.code, "راستی‌آزمایی دستهٔ بافر ناموفق بود — داده دست‌نخورده در لبه باقی می‌ماند", { batchNo: BatchNo });
    }

    const existing = await r.findOne("IotGatewayBuffer", [
      { column: "GatewayId", op: "eq", value: gatewayId },
      { column: "BatchNo", op: "eq", value: BatchNo },
    ]);
    if (existing && existing.Status === "sent") {
      /* تکرار ارسال پس از تحویل موفق، خطا نیست: گیت‌وی ممکن است تأییدیه را
       * نگرفته باشد. در این حالت داده دوباره درج نمی‌شود. */
      return { duplicated: true, bufferId: existing.Id, batchNo: BatchNo, status: existing.Status, accepted: 0 };
    }
    if (existing) {
      /* تلاش دوبارهٔ دسته‌ای که پردازش نشده (مثلاً کانال در لحظهٔ ارسال
       * غیرفعال بود). بدون این مسیر، گیت‌وی تا ابد «duplicate» می‌گیرد و دادهٔ
       * لبه گم می‌شود — بدترین حالت ممکن برای این ماژول.
       * اگر بخشی از نمونه‌ها پیش‌تر درج شده باشد، درج تکرار نمی‌شود تا آمار
       * سطل‌ها باد نکند؛ فقط ارزیابی قاعده‌ها دوباره انجام می‌شود. */
      const alreadyIngested = await r.count("IotTelemetrySample", [{ column: "BufferId", op: "eq", value: existing.Id }]);
      const retry = await ingestPipeline(r, req, {
        rigId, rawSamples: samples, source: "buffer", gatewayId, bufferId: existing.Id, batchNo: BatchNo,
        persistSamples: alreadyIngested === 0,
      });
      const retryTransition = nextBufferStatus({
        status: existing.Status, attempts: Number(existing.Attempts ?? 0),
        maxAttempts: Number(existing.MaxAttempts ?? 5), delivered: true,
      });
      await r.patch("IotGatewayBuffer", existing.Id, {
        Status: retryTransition.status, Attempts: retryTransition.attempts,
        LastAttemptAt: at, SentAt: at, AckRef: `ingest-${existing.Id}`, ErrorCode: null, ErrorFa: null,
      }, requestActor(req), existing.RowVersion);
      return { duplicated: true, retried: true, bufferId: existing.Id, batchNo: BatchNo, status: retryTransition.status, checksum: Checksum, ingest: retry };
    }

    const bufferRow = await r.create("IotGatewayBuffer", {
      RigId: rigId, GatewayId: gatewayId, BatchNo,
      CapturedAt: built.capturedAt, FromAt: built.fromAt, ToAt: built.toAt,
      SampleCount: built.sampleCount, PayloadJson: built.payload, Checksum,
      Status: "buffered", Attempts: 0, MaxAttempts: Number(gateway.MaxAttempts ?? 5),
      ConnectivityState: text(req.body.connectivityState, "connectivityState", { max: 24 }),
    }, requestActor(req));

    const outcome = await ingestPipeline(r, req, {
      rigId, rawSamples: samples, source: "buffer", gatewayId, bufferId: bufferRow.Id, batchNo: BatchNo,
    });
    const transition = nextBufferStatus({ status: "buffered", attempts: 0, maxAttempts: Number(gateway.MaxAttempts ?? 5), delivered: true });
    await r.patch("IotGatewayBuffer", bufferRow.Id, {
      Status: transition.status,
      Attempts: transition.attempts,
      LastAttemptAt: at,
      SentAt: at,
      AckRef: `ingest-${bufferRow.Id}`,
    }, requestActor(req), bufferRow.RowVersion);
    await r.patch("IotEdgeGateway", gatewayId, {
      LastSyncAt: at,
      ConnectionState: "online",
      BufferUsed: Math.max(0, Number(gateway.BufferUsed ?? 0) - built.sampleCount),
    }, requestActor(req), gateway.RowVersion);
    return { duplicated: false, bufferId: bufferRow.Id, batchNo: BatchNo, status: transition.status, checksum: Checksum, ingest: outcome };
  }, 202));

  app.post(`${ROOT}/gateways/:gatewayId/buffer/:bufferId/sync`, route("iiot.buffer.sync", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["delivered", "ackRef", "errorCode", "errorFa", "RowVersion"]));
    const gatewayId = id(req.params.gatewayId, "gatewayId");
    await mustFind(r, "IotEdgeGateway", gatewayId, rigId);
    const bufferId = id(req.params.bufferId, "bufferId");
    const buffer = await mustFind(r, "IotGatewayBuffer", bufferId, rigId);
    if (buffer.GatewayId !== gatewayId) throw notFound();
    const delivered = bool(req.body.delivered, "delivered", true);
    const transition = nextBufferStatus({
      status: buffer.Status,
      attempts: Number(buffer.Attempts ?? 0),
      maxAttempts: Number(buffer.MaxAttempts ?? 5),
      delivered,
    });
    const at = nowIso();
    const patch = {
      Status: transition.status,
      Attempts: transition.attempts,
      LastAttemptAt: at,
      SentAt: delivered ? at : buffer.SentAt ?? null,
      AckRef: delivered ? text(req.body.ackRef, "ackRef", { max: 120 }) ?? `sync-${bufferId}` : buffer.AckRef ?? null,
      ErrorCode: delivered ? null : text(req.body.errorCode, "errorCode", { max: 60 }) ?? transition.code,
      ErrorFa: delivered ? null : text(req.body.errorFa, "errorFa", { max: 600 }) ?? "همگام‌سازی ناموفق بود",
    };
    const result = await r.patch("IotGatewayBuffer", bufferId, patch, requestActor(req), req.body.RowVersion ?? buffer.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_BUFFER_SYNC", "IotGatewayBuffer", bufferId, "iiot.buffer.sync", { delivered, status: transition.status });
    return { buffer: await r.get("IotGatewayBuffer", bufferId), transition };
  }));

  /* ═══════════════════════ ۷. سنسور و پایش وضعیت ═══════════════════════ */

  app.get(`${ROOT}/sensors`, route("iiot.sensor.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["status", "sensorType", "gatewayId", "limit", "offset"]));
    const where = [];
    if (req.query.status !== undefined) where.push({ column: "Status", op: "eq", value: oneOf(req.query.status, "status", ["active", "faulty", "calibration-due", "removed"], { required: true }) });
    if (req.query.sensorType !== undefined) where.push({ column: "SensorType", op: "eq", value: text(req.query.sensorType, "sensorType", { required: true, max: 40 }) });
    if (req.query.gatewayId !== undefined) where.push({ column: "GatewayId", op: "eq", value: id(req.query.gatewayId, "gatewayId") });
    const rows = await listInRig(r, "IotSensorNode", rigId, {
      where,
      orderBy: [{ column: "SensorTag", dir: "asc" }],
      limit: pageNumber(req.query.limit, "limit", 200, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 100000),
    });
    const today = todayOf(nowIso());
    return {
      sensors: rows.map((s) => ({ ...s, calibrationOverdue: Boolean(s.NextCalibrationDue && s.NextCalibrationDue < today) })),
      total: rows.length,
      counts: {
        active: rows.filter((s) => s.Status === "active").length,
        faulty: rows.filter((s) => s.Status === "faulty").length,
        calibrationDue: rows.filter((s) => s.Status === "calibration-due" || (s.NextCalibrationDue && s.NextCalibrationDue < today)).length,
      },
    };
  }));

  app.post(`${ROOT}/sensors`, route("iiot.sensor.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "SensorTag", "NameFa", "SensorType", "Manufacturer", "ModelNo", "SerialNo", "RangeMin", "RangeMax",
      "Unit", "AccuracyPct", "LocationFa", "GatewayId", "InstalledAt", "LastCalibratedAt", "CalibrationIntervalDays",
      "Status", "NoteFa",
    ]));
    const SensorTag = code(req.body.SensorTag, "SensorTag");
    if (await r.findOne("IotSensorNode", [{ column: "RigId", op: "eq", value: rigId }, { column: "SensorTag", op: "eq", value: SensorTag }])) {
      throw conflict("IIOT_DUPLICATE", `تگ سنسور «${SensorTag}» تکراری است`);
    }
    const GatewayId = req.body.GatewayId === undefined ? null : id(req.body.GatewayId, "GatewayId");
    if (GatewayId) await mustFind(r, "IotEdgeGateway", GatewayId, rigId);
    const RangeMin = optionalNumber(req.body.RangeMin, "RangeMin");
    const RangeMax = optionalNumber(req.body.RangeMax, "RangeMax");
    if (RangeMin !== null && RangeMax !== null && RangeMax <= RangeMin) throw bad("RangeMax", "بیشینهٔ دامنه باید از کمینه بزرگ‌تر باشد");
    const interval = optionalNumber(req.body.CalibrationIntervalDays, "CalibrationIntervalDays", { integer: true, min: 1, max: 3650 });
    const installedAt = isoDateTime(req.body.InstalledAt, "InstalledAt") ?? nowIso();
    const row = await r.create("IotSensorNode", {
      RigId: rigId, SensorTag,
      NameFa: text(req.body.NameFa, "NameFa", { required: true, max: 240 }),
      SensorType: text(req.body.SensorType, "SensorType", { required: true, max: 40 }),
      Manufacturer: text(req.body.Manufacturer, "Manufacturer", { max: 160 }),
      ModelNo: text(req.body.ModelNo, "ModelNo", { max: 120 }),
      SerialNo: text(req.body.SerialNo, "SerialNo", { max: 120 }),
      RangeMin, RangeMax,
      Unit: text(req.body.Unit, "Unit", { max: 24 }),
      AccuracyPct: optionalNumber(req.body.AccuracyPct, "AccuracyPct", { min: 0, max: 100 }),
      LocationFa: text(req.body.LocationFa, "LocationFa", { max: 240 }),
      GatewayId,
      InstalledAt: installedAt,
      LastCalibratedAt: isoDateTime(req.body.LastCalibratedAt, "LastCalibratedAt"),
      CalibrationIntervalDays: interval,
      NextCalibrationDue: interval
        ? new Date(Date.parse(installedAt) + interval * 86_400_000).toISOString().slice(0, 10)
        : null,
      Status: oneOf(req.body.Status, "Status", ["active", "faulty", "calibration-due", "removed"], { fallback: "active" }),
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "IIOT_SENSOR_CREATED", "IotSensorNode", row.Id, "iiot.sensor.edit");
    return row;
  }, 201));

  app.patch(`${ROOT}/sensors/:sensorId`, route("iiot.sensor.edit", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["NameFa", "SensorType", "Manufacturer", "ModelNo", "SerialNo", "RangeMin", "RangeMax", "Unit", "AccuracyPct", "LocationFa", "GatewayId", "Status", "CalibrationIntervalDays", "NoteFa", "RowVersion"]));
    const sensorId = id(req.params.sensorId, "sensorId");
    const existing = await mustFind(r, "IotSensorNode", sensorId, rigId);
    const patch = {};
    if (req.body.NameFa !== undefined) patch.NameFa = text(req.body.NameFa, "NameFa", { required: true, max: 240 });
    if (req.body.SensorType !== undefined) patch.SensorType = text(req.body.SensorType, "SensorType", { required: true, max: 40 });
    if (req.body.Status !== undefined) patch.Status = oneOf(req.body.Status, "Status", ["active", "faulty", "calibration-due", "removed"], { required: true });
    if (req.body.Unit !== undefined) patch.Unit = text(req.body.Unit, "Unit", { max: 24 });
    if (req.body.CalibrationIntervalDays !== undefined) patch.CalibrationIntervalDays = optionalNumber(req.body.CalibrationIntervalDays, "CalibrationIntervalDays", { integer: true, min: 1, max: 3650 });
    if (req.body.GatewayId !== undefined) {
      const next = req.body.GatewayId === null ? null : id(req.body.GatewayId, "GatewayId");
      if (next) await mustFind(r, "IotEdgeGateway", next, rigId);
      patch.GatewayId = next;
    }
    if (req.body.NoteFa !== undefined) patch.NoteFa = text(req.body.NoteFa, "NoteFa", { max: 1000 });
    if (Object.keys(patch).length === 0) throw bad("body", "هیچ فیلد قابل تغییر داده نشد");
    const result = await r.patch("IotSensorNode", sensorId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_SENSOR_UPDATED", "IotSensorNode", sensorId, "iiot.sensor.edit");
    return r.get("IotSensorNode", sensorId);
  }));

  app.post(`${ROOT}/sensors/:sensorId/calibration`, route("iiot.sensor.calibrate", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["calibratedAt", "CertificateNo", "ResultFa", "RowVersion"]));
    const sensorId = id(req.params.sensorId, "sensorId");
    const sensor = await mustFind(r, "IotSensorNode", sensorId, rigId);
    const calibratedAt = isoDateTime(req.body.calibratedAt, "calibratedAt") ?? nowIso();
    const interval = Number(sensor.CalibrationIntervalDays ?? 365);
    const next = new Date(Date.parse(calibratedAt) + interval * 86_400_000).toISOString().slice(0, 10);
    const patch = {
      LastCalibratedAt: calibratedAt,
      NextCalibrationDue: next,
      Status: sensor.Status === "faulty" ? sensor.Status : "active",
      NoteFa: [sensor.NoteFa, text(req.body.ResultFa, "ResultFa", { max: 600 }), text(req.body.CertificateNo, "CertificateNo", { max: 120 })].filter(Boolean).join(" · ").slice(0, 1000),
    };
    const result = await r.patch("IotSensorNode", sensorId, patch, requestActor(req), req.body.RowVersion ?? sensor.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_SENSOR_CALIBRATED", "IotSensorNode", sensorId, "iiot.sensor.calibrate", { next });
    return { sensor: await r.get("IotSensorNode", sensorId), nextCalibrationDue: next };
  }));

  app.get(`${ROOT}/condition-snapshots`, route("iiot.condition.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["assetRef", "readingType", "from", "to", "limit", "offset"]));
    const where = [];
    if (req.query.assetRef !== undefined) where.push({ column: "CmmsAssetRef", op: "eq", value: text(req.query.assetRef, "assetRef", { required: true, max: 60 }) });
    if (req.query.readingType !== undefined) where.push({ column: "ReadingType", op: "eq", value: oneOf(req.query.readingType, "readingType", ["vibration", "temperature", "humidity", "pressure", "current", "gas", "flow"], { required: true }) });
    if (req.query.from !== undefined) where.push({ column: "MeasuredAt", op: "gte", value: isoDateTime(req.query.from, "from", { required: true }) });
    if (req.query.to !== undefined) where.push({ column: "MeasuredAt", op: "lte", value: isoDateTime(req.query.to, "to", { required: true }) });
    const rows = await listInRig(r, "IotConditionSnapshot", rigId, {
      where,
      orderBy: [{ column: "MeasuredAt", dir: "desc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 100000),
    });
    return { snapshots: rows, total: rows.length, unreported: rows.filter((s) => s.ReportedToCmms === false).length };
  }));

  app.post(`${ROOT}/condition-snapshots`, route("iiot.condition.record", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "CmmsAssetRef", "SensorTag", "ReadingType", "Value", "Uom", "Zone", "MeasuredAt", "HealthIndex",
      "TrendDirection", "RateOfChange", "Source", "NoteFa",
    ]));
    const at = nowIso();
    const measuredAt = isoDateTime(req.body.MeasuredAt, "MeasuredAt") ?? at;
    const row = await r.create("IotConditionSnapshot", {
      RigId: rigId,
      CmmsAssetRef: text(req.body.CmmsAssetRef, "CmmsAssetRef", { max: 60 }),
      SensorTag: text(req.body.SensorTag, "SensorTag", { max: 60 }),
      ReadingType: oneOf(req.body.ReadingType, "ReadingType", ["vibration", "temperature", "humidity", "pressure", "current", "gas", "flow"], { required: true }),
      Value: number(req.body.Value, "Value", { required: true }),
      Uom: text(req.body.Uom, "Uom", { required: true, max: 24 }),
      Zone: oneOf(req.body.Zone, "Zone", ["A", "B", "C", "D"]),
      MeasuredAt: measuredAt,
      MeasuredOn: todayOf(measuredAt),
      HealthIndex: optionalNumber(req.body.HealthIndex, "HealthIndex", { min: 0, max: 100 }),
      TrendDirection: oneOf(req.body.TrendDirection, "TrendDirection", ["rising", "falling", "stable"]),
      RateOfChange: optionalNumber(req.body.RateOfChange, "RateOfChange"),
      Source: oneOf(req.body.Source, "Source", ["iiot", "manual", "scada", "portable"], { fallback: "iiot" }),
      ReportedToCmms: false,
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "IIOT_CONDITION_RECORDED", "IotConditionSnapshot", row.Id, "iiot.condition.record");
    return row;
  }, 201));

  /* ═══════════════════════ ۸. توقف، NPT و یکپارچگی ═══════════════════════ */

  app.get(`${ROOT}/downtime`, route("iiot.downtime.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["category", "isNpt", "open", "from", "to", "limit", "offset"]));
    const where = [];
    if (req.query.category !== undefined) where.push({ column: "Category", op: "eq", value: oneOf(req.query.category, "category", DOWNTIME_CATEGORY_LIST, { required: true }) });
    if (req.query.isNpt !== undefined) where.push({ column: "IsNpt", op: "eq", value: bool(req.query.isNpt, "isNpt") });
    if (req.query.from !== undefined) where.push({ column: "StartedAt", op: "gte", value: isoDateTime(req.query.from, "from", { required: true }) });
    if (req.query.to !== undefined) where.push({ column: "StartedAt", op: "lte", value: isoDateTime(req.query.to, "to", { required: true }) });
    const rows = await listInRig(r, "IotRigDowntime", rigId, {
      where,
      orderBy: [{ column: "StartedAt", dir: "desc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 100000),
    });
    const open = req.query.open === undefined ? null : bool(req.query.open, "open");
    const filtered = open === null ? rows : open ? rows.filter((x) => !x.EndedAt) : rows.filter((x) => Boolean(x.EndedAt));
    return { downtime: filtered, total: filtered.length, openCount: filtered.filter((x) => !x.EndedAt).length };
  }));

  app.post(`${ROOT}/downtime`, route("iiot.downtime.report", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([
      "Category", "CauseFa", "EffectFa", "StartedAt", "EndedAt", "IsNpt", "DowntimeType", "NptCode",
      "ResponsibilityFa", "ShiftName", "RecoverableMinutes", "AlertId", "NoteFa",
      "CmmsSiteRef", "MesWorkCenterRef", "PmisProjectRef",
    ]));
    const at = nowIso();
    const rigRow = await mustFindRig(r, rigId);
    const startedAt = isoDateTime(req.body.StartedAt, "StartedAt", { required: true });
    const endedAt = isoDateTime(req.body.EndedAt, "EndedAt");
    if (endedAt && Date.parse(endedAt) < Date.parse(startedAt)) throw bad("EndedAt", "پایان توقف نمی‌تواند پیش از آغاز آن باشد");
    const category = oneOf(req.body.Category, "Category", DOWNTIME_CATEGORY_LIST, { required: true });
    const info = classifyDowntime(category, {
      isNpt: req.body.IsNpt === undefined ? undefined : bool(req.body.IsNpt, "IsNpt"),
      downtimeType: oneOf(req.body.DowntimeType, "DowntimeType", ["productive", "non-productive", "planned"]),
      nptCode: text(req.body.NptCode, "NptCode", { max: 40 }),
    });
    const AlertId = req.body.AlertId === undefined ? null : id(req.body.AlertId, "AlertId");
    if (AlertId) await mustFind(r, "IotTelemetryAlert", AlertId, rigId);
    const minutes = downtimeMinutesOf({ startedAt, endedAt }, at) ?? 0;
    const DowntimeCode = await nextNo(r, "IotRigDowntime", rigId, "DowntimeCode", "DT");
    const row = await r.create("IotRigDowntime", {
      RigId: rigId, DowntimeCode,
      Category: info.category,
      DowntimeType: info.downtimeType,
      NptCode: info.nptCode,
      CauseFa: text(req.body.CauseFa, "CauseFa", { required: true, max: 1000 }),
      EffectFa: text(req.body.EffectFa, "EffectFa", { max: 1000 }),
      StartedAt: startedAt, EndedAt: endedAt,
      DurationMinutes: minutes,
      IsNpt: info.isNpt,
      RecoverableMinutes: optionalNumber(req.body.RecoverableMinutes, "RecoverableMinutes", { min: 0 }),
      ResponsibilityFa: text(req.body.ResponsibilityFa, "ResponsibilityFa", { max: 240 }) ?? info.responsibilityFa,
      AlertId,
      /* سیم‌کشی بین‌بخشی از دکل به ارث می‌رسد — همان مسیری که قاعده‌ها می‌روند.
       * بدون آن، توقفِ ثبت‌شدهٔ دستی در راستی‌آزمایی به هیچ مقصدی نمی‌رسید. */
      CmmsSiteRef: text(req.body.CmmsSiteRef, "CmmsSiteRef", { max: 120 }) ?? rigRow.CmmsSiteRef ?? null,
      MesWorkCenterRef: text(req.body.MesWorkCenterRef, "MesWorkCenterRef", { max: 120 }) ?? rigRow.MesWorkCenterRef ?? null,
      PmisProjectRef: text(req.body.PmisProjectRef, "PmisProjectRef", { max: 120 }) ?? rigRow.PmisProjectRef ?? null,
      DetectedBy: "manual",
      ShiftName: text(req.body.ShiftName, "ShiftName", { max: 80 }),
      RecordedById: requestActor(req),
      ReportedToMes: false,
      ReportedToPmis: false,
      ModelVersion: IIOT_DOMAIN_VERSION,
      NoteFa: text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    }, requestActor(req));
    await writeAudit(r, req, "IIOT_DOWNTIME_REPORTED", "IotRigDowntime", row.Id, "iiot.downtime.report");
    return row;
  }, 201));

  app.post(`${ROOT}/downtime/:downtimeId/close`, route("iiot.downtime.report", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["EndedAt", "CauseFa", "Category", "NoteFa", "RowVersion"]));
    const downtimeId = id(req.params.downtimeId, "downtimeId");
    const existing = await mustFind(r, "IotRigDowntime", downtimeId, rigId);
    if (existing.EndedAt) throw businessRule("IIOT_DOWNTIME_CLOSED", "این توقف پیش‌تر بسته شده است");
    const at = nowIso();
    const endedAt = isoDateTime(req.body.EndedAt, "EndedAt") ?? at;
    if (Date.parse(endedAt) < Date.parse(existing.StartedAt)) throw bad("EndedAt", "پایان توقف نمی‌تواند پیش از آغاز آن باشد");
    const minutes = downtimeMinutesOf({ startedAt: existing.StartedAt, endedAt }, endedAt) ?? 0;
    const patch = {
      EndedAt: endedAt,
      DurationMinutes: minutes,
      CauseFa: req.body.CauseFa === undefined ? existing.CauseFa : text(req.body.CauseFa, "CauseFa", { required: true, max: 1000 }),
      NoteFa: req.body.NoteFa === undefined ? existing.NoteFa : text(req.body.NoteFa, "NoteFa", { max: 1000 }),
    };
    if (req.body.Category !== undefined) {
      const info = classifyDowntime(oneOf(req.body.Category, "Category", DOWNTIME_CATEGORY_LIST, { required: true }));
      patch.Category = info.category;
      patch.NptCode = info.nptCode;
      patch.IsNpt = info.isNpt;
      patch.DowntimeType = info.downtimeType;
    }
    const result = await r.patch("IotRigDowntime", downtimeId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    await writeAudit(r, req, "IIOT_DOWNTIME_CLOSED", "IotRigDowntime", downtimeId, "iiot.downtime.report");
    return r.get("IotRigDowntime", downtimeId);
  }));

  app.post(`${ROOT}/downtime/:downtimeId/verify`, route("iiot.downtime.verify", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set(["NoteFa", "dispatch", "RowVersion"]));
    const downtimeId = id(req.params.downtimeId, "downtimeId");
    const existing = await mustFind(r, "IotRigDowntime", downtimeId, rigId);
    const rigRow = await mustFindRig(r, rigId);
    if (!existing.EndedAt) throw businessRule("IIOT_DOWNTIME_OPEN", "توقف باز را نمی‌توان تأیید کرد؛ ابتدا ببندید");
    if (existing.VerifiedById) throw businessRule("IIOT_DOWNTIME_VERIFIED", "این توقف پیش‌تر تأیید شده است");
    const at = nowIso();
    const patch = { VerifiedById: requestActor(req), VerifiedAt: at, NoteFa: req.body.NoteFa === undefined ? existing.NoteFa : text(req.body.NoteFa, "NoteFa", { max: 1000 }) };
    const result = await r.patch("IotRigDowntime", downtimeId, patch, requestActor(req), req.body.RowVersion ?? existing.RowVersion);
    if (!result.ok) throw conflict("IIOT_CONCURRENCY_CONFLICT", "رکورد هم‌زمان تغییر کرده است");
    const verified = { ...existing, ...patch };

    /* تأیید، همان لحظهٔ «رسمی‌شدن» NPT است: از این پس به MES و PMIS می‌رود. */
    const dispatched = [];
    if (bool(req.body.dispatch, "dispatch", true)) {
      for (const target of TARGET_LIST.filter((t) => t !== "cmms")) {
        const out = await enqueueIntegration(r, req, {
          rigId, target, kind: "downtime-closed", sourceTable: "IotRigDowntime", sourceId: downtimeId,
          payload: {
            occurredAt: at,
            rigId, downtimeId, downtimeCode: verified.DowntimeCode,
            /* کلید رویدادی که این توقف را در مقصد باز کرده بود (اگر باز کرده
             * بود) — تا بسته‌شدن به همان ردیف بنشیند. */
            opensKey: idempotencyKeyOf(eventTypeFor(target, "downtime"), target, "IotRigDowntime", downtimeId),
            category: verified.Category, nptCode: verified.NptCode,
            causeFa: verified.CauseFa, responsibilityFa: verified.ResponsibilityFa,
            startedAt: verified.StartedAt, endedAt: verified.EndedAt,
            durationMinutes: Number(verified.DurationMinutes ?? 0),
            isNpt: verified.IsNpt === true,
            mesWorkCenterRef: existing.MesWorkCenterRef ?? rigRow.MesWorkCenterRef ?? null,
            pmisProjectRef: existing.PmisProjectRef ?? rigRow.PmisProjectRef ?? null,
            claimWorthy: claimWorthy({
              minutes: Number(verified.DurationMinutes ?? 0),
              responsibilityFa: verified.ResponsibilityFa,
              thresholdMinutes: Number(process.env.IIOT_CLAIM_THRESHOLD_MINUTES ?? 240),
            }),
          },
        });
        dispatched.push({ target, eventId: out.event.Id, delivered: out.delivered, error: out.error ?? null });
      }
      const delivered = dispatched.filter((x) => x.delivered).length;
      await r.patch("IotRigDowntime", downtimeId, {
        ReportedToMes: dispatched.some((x) => x.target === "mes" && x.delivered),
        ReportedToPmis: dispatched.some((x) => x.target === "pmis" && x.delivered),
        MesDowntimeRef: dispatched.find((x) => x.target === "mes" && x.delivered)?.eventId ?? existing.MesDowntimeRef ?? null,
        PmisEventRef: dispatched.find((x) => x.target === "pmis" && x.delivered)?.eventId ?? existing.PmisEventRef ?? null,
      }, requestActor(req), verified.RowVersion);
    }
    await writeAudit(r, req, "IIOT_DOWNTIME_VERIFIED", "IotRigDowntime", downtimeId, "iiot.downtime.verify", { dispatched: dispatched.length });
    return { downtime: await r.get("IotRigDowntime", downtimeId), dispatched };
  }));

  app.get(`${ROOT}/npt/summary`, route("iiot.npt.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["from", "to", "claimThresholdMinutes"]));
    const from = req.query.from === undefined ? null : isoDateTime(req.query.from, "from", { required: true });
    const to = req.query.to === undefined ? null : isoDateTime(req.query.to, "to", { required: true });
    const where = [];
    if (from) where.push({ column: "StartedAt", op: "gte", value: from });
    if (to) where.push({ column: "StartedAt", op: "lte", value: to });
    const rows = await listInRig(r, "IotRigDowntime", rigId, { where, limit: 5000 });
    const at = nowIso();
    const summary = nptSummary(rows.map((row) => ({
      startedAt: row.StartedAt, endedAt: row.EndedAt, isNpt: row.IsNpt === true, category: row.Category,
    })), at);
    const threshold = number(req.query.claimThresholdMinutes, "claimThresholdMinutes", { min: 0 }) ?? 240;
    const claims = rows
      .filter((row) => row.EndedAt && claimWorthy({
        minutes: Number(row.DurationMinutes ?? 0),
        responsibilityFa: row.ResponsibilityFa,
        thresholdMinutes: threshold,
      }))
      .map((row) => ({
        downtimeId: row.Id, code: row.DowntimeCode, minutes: Number(row.DurationMinutes ?? 0),
        category: row.Category, nptCode: row.NptCode, responsibilityFa: row.ResponsibilityFa,
        pmisClaimRef: row.PmisClaimRef ?? null,
      }));
    return { rigId, ...summary, claimThresholdMinutes: threshold, claimCandidates: claims, asOf: at };
  }));

  app.get(`${ROOT}/integration/events`, route("iiot.integration.view", async ({ repo: r, req, rigId }) => {
    assertOnlyQueryKeys(req.query, new Set(["status", "targetSystem", "eventType", "limit", "offset"]));
    const where = [];
    if (req.query.status !== undefined) where.push({ column: "Status", op: "eq", value: oneOf(req.query.status, "status", ["pending", "dispatched", "failed", "dead-letter"], { required: true }) });
    if (req.query.targetSystem !== undefined) where.push({ column: "TargetSystem", op: "eq", value: oneOf(req.query.targetSystem, "targetSystem", TARGET_LIST, { required: true }) });
    if (req.query.eventType !== undefined) where.push({ column: "EventType", op: "eq", value: text(req.query.eventType, "eventType", { required: true, max: 60 }) });
    const rows = await listInRig(r, "IotIntegrationEvent", rigId, {
      where,
      orderBy: [{ column: "OccurredAt", dir: "desc" }],
      limit: pageNumber(req.query.limit, "limit", 100, 1000),
      offset: pageNumber(req.query.offset, "offset", 0, 100000),
    });
    return {
      events: rows,
      total: rows.length,
      counts: {
        pending: rows.filter((e) => e.Status === "pending").length,
        dispatched: rows.filter((e) => e.Status === "dispatched").length,
        failed: rows.filter((e) => e.Status === "failed").length,
        deadLetter: rows.filter((e) => e.Status === "dead-letter").length,
      },
      transportConfigured: Boolean(transport),
    };
  }));

  app.post(`${ROOT}/integration/events/:eventId/dispatch`, route("iiot.integration.dispatch", async ({ repo: r, req, rigId }) => {
    assertOnlyKeys(req.body, new Set([]));
    const eventId = id(req.params.eventId, "eventId");
    const event = await mustFind(r, "IotIntegrationEvent", eventId, rigId);
    if (event.Status === "dispatched") {
      throw businessRule("IIOT_EVENT_DELIVERED", "این رویداد پیش‌تر تحویل شده است", { deliveredAt: event.DeliveredAt });
    }
    const { event: updated, delivered, error } = await deliverEvent(r, req, event);
    await writeAudit(r, req, "IIOT_EVENT_DISPATCHED", "IotIntegrationEvent", eventId, "iiot.integration.dispatch", { delivered });
    if (!delivered) {
      throw businessRule("IIOT_DELIVERY_FAILED", error?.messageFa ?? "تحویل رویداد ناموفق بود", { code: error?.code, attempts: updated.Attempts });
    }
    return updated;
  }));

  /* ═══════════════════════ ۹. داشبورد ═══════════════════════ */

  app.get(`${ROOT}/dashboard`, route("iiot.dashboard.view", async ({ repo: r, req, rigId }) => {
    const at = nowIso();
    const rig = await mustFindRig(r, rigId);
    const channels = await listInRig(r, "IotDasChannel", rigId, { where: [{ column: "IsActive", op: "eq", value: true }] });
    const gateways = await listInRig(r, "IotEdgeGateway", rigId);
    const alerts = await listInRig(r, "IotTelemetryAlert", rigId, {
      where: [{ column: "Status", op: "in", value: ["active", "acknowledged"] }],
      orderBy: [{ column: "DetectedAt", dir: "desc" }],
      limit: 50,
    });
    const downtimeRows = await listInRig(r, "IotRigDowntime", rigId, { limit: 2000 });
    const events = await listInRig(r, "IotIntegrationEvent", rigId, { orderBy: [{ column: "OccurredAt", dir: "desc" }], limit: 50 });
    const buffers = await r.list("IotGatewayBuffer", {
      where: [{ column: "RigId", op: "eq", value: rigId }, { column: "Status", op: "in", value: ["buffered", "failed", "dead-letter"] }],
      orderBy: [{ column: "CapturedAt", dir: "asc" }],
      limit: 500,
    });

    const latestRes = ts ? await ts.latest({ rigId, channelCodes: channels.map((c) => c.ChannelCode) }).catch(() => ({ latest: [] })) : { latest: [] };
    const latestByCode = new Map((latestRes.latest ?? []).map((l) => [l.channelCode, l]));
    const gauges = [];
    for (const channel of channels) {
      const rules = await r.list("IotThresholdRule", {
        where: [{ column: "ChannelId", op: "eq", value: channel.Id }, { column: "IsActive", op: "eq", value: true }],
      });
      const live = latestByCode.get(channel.ChannelCode);
      const value = live ? Number(live.value) : channel.LastValue === null || channel.LastValue === undefined ? null : Number(channel.LastValue);
      const at2 = live?.at ?? channel.LastValueAt ?? null;
      /* تازگی داده بخشی از رنگ است: سنسور ساکت، «سبز» نیست. */
      const stale = at2 ? (Date.parse(at) - Date.parse(at2)) / 1000 > 300 : true;
      const color = statusColorFor(value, rules.map((rule) => ({
        level: rule.Level, comparison: rule.Comparison,
        thresholdValue: rule.ThresholdValue === null ? null : Number(rule.ThresholdValue),
        secondaryValue: rule.SecondaryValue === null ? null : Number(rule.SecondaryValue),
      })));
      gauges.push({
        channelId: channel.Id,
        channelCode: channel.ChannelCode,
        nameFa: channel.NameFa,
        signalType: channel.SignalType,
        unit: channel.Unit,
        value,
        at: at2,
        stale,
        isCritical: channel.IsCritical === true,
        displayMin: channel.DisplayMin,
        displayMax: channel.DisplayMax,
        nominalValue: channel.NominalValue,
        status: stale && color === "normal" ? "warning" : color,
        thresholds: rules.map((rule) => ({ level: rule.Level, value: rule.ThresholdValue, kind: rule.DetectKind })),
      });
    }

    return {
      rig,
      asOf: at,
      gauges,
      statusCounts: {
        normal: gauges.filter((g) => g.status === "normal").length,
        warning: gauges.filter((g) => g.status === "warning").length,
        critical: gauges.filter((g) => g.status === "critical").length,
      },
      activeAlerts: alerts,
      alertCounts: {
        active: alerts.filter((a) => a.Status === "active").length,
        critical: alerts.filter((a) => a.Level === "critical").length,
      },
      gateways: gateways.map((g) => ({
        id: g.Id, code: g.GatewayCode, nameFa: g.NameFa, connectionState: g.ConnectionState,
        bufferUsed: Number(g.BufferUsed ?? 0), bufferCapacity: Number(g.BufferCapacity ?? 0),
        fillPct: bufferFillPct(Number(g.BufferUsed ?? 0), Number(g.BufferCapacity ?? 0)),
        lastHeartbeatAt: g.LastHeartbeatAt, lastSyncAt: g.LastSyncAt,
      })),
      storeAndForward: {
        pendingBatches: buffers.filter((b) => b.Status === "buffered" || b.Status === "failed").length,
        deadLetterBatches: buffers.filter((b) => b.Status === "dead-letter").length,
        oldestBufferAt: buffers[0]?.CapturedAt ?? null,
        connectivityOnline: gateways.some((g) => g.ConnectionState === "online"),
      },
      npt: nptSummary(downtimeRows.map((row) => ({
        startedAt: row.StartedAt, endedAt: row.EndedAt, isNpt: row.IsNpt === true, category: row.Category,
      })), at),
      integration: {
        pending: events.filter((e) => e.Status === "pending").length,
        dispatched: events.filter((e) => e.Status === "dispatched").length,
        failed: events.filter((e) => e.Status === "failed" || e.Status === "dead-letter").length,
        transportConfigured: Boolean(transport),
      },
      tsDriver: tsDriver(),
      modelVersion: IIOT_DOMAIN_VERSION,
      requestId: req.requestId,
    };
  }));

  return { routes: IIOT_IMPLEMENTED_ROUTES, version: IIOT_API_VERSION };
}
