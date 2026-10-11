/**
 * پل یکپارچگی CMMS → MES — سمت تولید.
 *
 * ────────────────────────────────────────────────────────────────────────
 * این فایل، «سامانهٔ مقصد» قرارداد `cmms-mes-v1` است. تصمیم معماری: هیچ کلید
 * خارجی بین `Cmms*` و `Mfg*` وجود ندارد؛ رویدادها با REST می‌آیند و اینجا به
 * ردیف‌های خودِ MES ترجمه می‌شوند:
 *
 *   downtime.reported/started  → MfgDowntimeLog (ناخواسته/برنامه‌ریزی‌شده)
 *   downtime.finished          → بستن همان ردیف باز
 *   capacity.block.requested   → رزرو «توقف برنامه‌ریزی‌شده» در MfgDowntimeLog؛
 *                                موتور زمان‌بندی همین ردیف را از ظرفیت کم می‌کند
 *   capacity.block.released    → آزادسازی رزرو (حذف رزرو آینده یا بستن رزرو جاری)
 *
 * چرا «رزرو = ردیف توقف برنامه‌ریزی‌شده»: `manufacturingScheduler.js` ردیف‌های
 * MfgDowntimeLog را به‌عنوان رزرو قطعی از ظرفیت کم می‌کند و OEE هم توقف
 * برنامه‌ریزی‌شده را از زمان تولید برنامه‌ریزی‌شده کنار می‌گذارد؛ پس این
 * ساده‌ترین نگاشتِ درست به معنای «بلوکهٔ نرم» است — بدون هیچ FK تازه.
 *
 * قواعد:
 *  - هر رویداد کلید تکرارناپذیری دارد؛ تحویل دوباره، ردیف دوباره نمی‌سازد.
 *  - مرکز کاری با ارجاع نرم (شناسه یا کد) پیدا می‌شود؛ ناشناخته یعنی خطای
 *    دسته‌بندی‌شده، نه ردیف سرگردان.
 *  - پاسخ شامل «تصویر دسترس‌پذیری به‌روز» است تا CMMS همان عدد را نشان دهد.
 * ────────────────────────────────────────────────────────────────────────
 */
import {
  CMMS_INTEGRATION_CONTRACT,
  CMMS_MES_EVENT_PERMISSIONS,
  CMMS_INTEGRATION_EVENT_TYPES,
  projectAvailability,
} from "./cmmsLogic.js";

export const MES_CMMS_BRIDGE_MODEL = "cmms-mes-bridge-v1";

/** کد دلیل رزرو ظرفیت در MfgDowntimeLog — همین پیشوند، بلوکه‌های CMMS را جدا می‌کند. */
export const MES_CAPACITY_BLOCK_REASON = "CMMS-PM-BLOCK";
const MINUTE_MS = 60_000;

class MesBridgeError extends Error {
  constructor(code, messageFa, extra = {}) {
    super(messageFa);
    this.name = "MesBridgeError";
    this.code = code;
    this.messageFa = messageFa;
    this.extra = extra;
  }
}

const asIso = (value) => {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
};

/**
 * یکسان‌سازی دو شکلی که یک رویداد به این پل می‌رسد:
 *
 *   • «سطر ذخیره‌شده» — همان چیزی که در `CmmsIntegrationEvent` نشسته و یک
 *     فراخوان بیرونی با REST می‌فرستد (`EventType`/`IdempotencyKey`/`PayloadJson`).
 *   • «پاکت حمل‌ونقل» — همان چیزی که قرارداد `deliver()` در CMMS می‌دهد
 *     (`eventType`/`idempotencyKey`/`payload`/`eventId`).
 *
 * بدون این یکسان‌سازی، هر رویدادی که از حمل‌ونقل درون‌فرآیندی بیاید با
 * «قرارداد ناشناخته» رد می‌شود — باگی که فقط در اجرای واقعی سرور دیده می‌شود.
 */
function normalizeInboundEvent(event) {
  if (!event || typeof event !== "object") return {};
  const payload = event.PayloadJson && typeof event.PayloadJson === "object"
    ? event.PayloadJson
    : event.payload && typeof event.payload === "object" ? event.payload : {};
  return {
    Id: event.Id ?? event.eventId ?? null,
    EventType: event.EventType ?? event.eventType ?? "",
    TargetSystem: event.TargetSystem ?? event.targetSystem ?? "mes",
    TargetRef: event.TargetRef ?? event.targetRef ?? null,
    Contract: event.Contract ?? event.contract ?? payload.contract ?? null,
    IdempotencyKey: event.IdempotencyKey ?? event.idempotencyKey ?? "",
    CorrelationId: event.CorrelationId ?? event.correlationId ?? null,
    OccurredAt: event.OccurredAt ?? event.occurredAt ?? null,
    PayloadJson: payload,
  };
}

const payloadOf = (event) => (event?.PayloadJson && typeof event.PayloadJson === "object" ? event.PayloadJson : {});

/** پنجرهٔ روزهای UTC دربرگیرندهٔ یک بازهٔ زمانی — مبنای تصویر دسترس‌پذیری. */
function dayWindowOf(fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const startMs = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const endMs = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1);
  return { from: new Date(startMs).toISOString(), to: new Date(endMs).toISOString() };
}

/** پیدا کردن مرکز کاری با ارجاع نرم؛ شناسه مقدم است، کد پشتیبان. */
async function resolveWorkCenter(repo, workCenterRef) {
  const ref = String(workCenterRef ?? "").trim();
  if (!ref) throw new MesBridgeError("E-MES-WORKCENTER-MISSING", "رویداد مرکز کاری مقصد را مشخص نکرده است");
  const byId = await repo.get("MfgWorkCenter", ref);
  if (byId) return byId;
  const byCode = await repo.findOne("MfgWorkCenter", [{ column: "Code", op: "eq", value: ref }]);
  if (byCode) return byCode;
  throw new MesBridgeError("E-MES-WORKCENTER-UNKNOWN", `مرکز کاری «${ref}» در MES شناخته نشده است`, { workCenterRef: ref });
}

/** همان ردیفی که تحویل قبلی ساخته است — کلید ضدتکرار در NoteFa نگه داشته می‌شود. */
async function findExistingByKey(repo, plantId, workCenterId, reasonCode, idempotencyKey) {
  const rows = await repo.list("MfgDowntimeLog", {
    where: [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "WorkCenterId", op: "eq", value: workCenterId },
      { column: "ReasonCode", op: "eq", value: reasonCode },
    ],
    limit: 200,
  });
  return rows.find((row) => String(row.NoteFa ?? "").includes(idempotencyKey)) ?? null;
}

async function createDowntimeRow(repo, { plantId, workCenterId, startedAt, finishedAt, downtimeType, reasonCode, noteFa, actor }) {
  const startMs = new Date(startedAt).getTime();
  const endMs = finishedAt ? new Date(finishedAt).getTime() : null;
  /* `DurationMinutes` در MES اجباری است و مقدار ۰ با `FinishedAt = null` یعنی
   * «توقف همچنان باز است» — همان قراردادی که `downtimeIntervalsForWindow` در
   * زمان‌بندی MES به آن تکیه می‌کند. نوشتن `null` ردیف را از اعتبارسنجی می‌انداخت. */
  const durationMinutes = endMs === null ? 0 : Math.max(0, Math.round((endMs - startMs) / MINUTE_MS));
  return repo.create("MfgDowntimeLog", {
    PlantId: plantId, WorkCenterId: workCenterId,
    ProductionOrderOperationId: null, ExecutionId: null, ResourceId: null,
    StartedAt: startedAt, FinishedAt: finishedAt ?? null,
    DurationMinutes: durationMinutes, DowntimeType: downtimeType,
    ReasonCode: String(reasonCode ?? "CMMS").slice(0, 60),
    RecordedBy: String(actor ?? "cmms-bridge").slice(0, 60),
    NoteFa: String(noteFa ?? "").slice(0, 800),
  }, actor ?? "cmms-bridge");
}

/**
 * اِعمال یک رویداد قرارداد cmms-mes-v1 روی جدول‌های MES.
 *
 * ورودی `event` همان چیزی است که CMMS در صف خروجی ساخته و تحویل داده است:
 * `{ IdempotencyKey, EventType, TargetRef, PayloadJson, ... }`.
 */
/**
 * مخزن را از دو شکلی که در فراخوانی‌ها دیده می‌شود حل می‌کند: خودِ repository،
 * یا تابعی که دیرتر آن را می‌سازد. `server/index.js` شکل تابعی را می‌دهد تا
 * وابستگی حلقه‌ای نسازد؛ نادیده‌گرفتن این شکل یعنی «repo.get is not a function»
 * در اولین تحویل واقعی.
 */
async function resolveRepo(repo) {
  const resolved = typeof repo === "function" ? await repo() : repo;
  if (!resolved || typeof resolved.list !== "function") {
    throw new MesBridgeError("E-MES-REPO-MISSING", "مخزن دادهٔ MES در دسترس نیست");
  }
  return resolved;
}

export async function applyCmmsIntegrationEvent({ repo, event, actor = "cmms-bridge", now = new Date() } = {}) {
  repo = await resolveRepo(repo);
  event = normalizeInboundEvent(event);
  const payload = payloadOf(event);
  const contract = String(payload.contract ?? event?.Contract ?? "");
  if (contract !== CMMS_INTEGRATION_CONTRACT) {
    throw new MesBridgeError("E-MES-CONTRACT", `قرارداد «${contract || "ناشناخته"}» پشتیبانی نمی‌شود`, { expected: CMMS_INTEGRATION_CONTRACT });
  }
  const eventType = String(event?.EventType ?? "");
  if (!CMMS_INTEGRATION_EVENT_TYPES.includes(eventType)) {
    throw new MesBridgeError("E-MES-EVENT-TYPE", `نوع رویداد «${eventType}» پشتیبانی نمی‌شود`, { allowed: [...CMMS_INTEGRATION_EVENT_TYPES] });
  }
  const idempotencyKey = String(event?.IdempotencyKey ?? "").trim();
  if (!idempotencyKey) throw new MesBridgeError("E-MES-IDEMPOTENCY", "رویداد بدون کلید تکرارناپذیری پذیرفته نمی‌شود");

  const workCenter = await resolveWorkCenter(repo, event?.TargetRef ?? payload.workCenterRef);
  const plantId = workCenter.PlantId;
  const nowIso = asIso(now) ?? new Date().toISOString();

  return repo.transaction(async (tx) => {
    let externalRef = null;
    let applied = null;
    let windowFrom = null;
    let windowTo = null;

    if (eventType === "downtime.reported") {
      const startedAt = asIso(payload.startedAt);
      if (!startedAt) throw new MesBridgeError("E-MES-DOWNTIME-WINDOW", "زمان شروع توقف نامعتبر است");
      const finishedAt = asIso(payload.finishedAt);
      const downtimeType = payload.downtimeType === "planned" ? "planned" : "unplanned";
      const duplicate = await findExistingByKey(tx, plantId, workCenter.Id, "CMMS-DOWNTIME", idempotencyKey);
      const row = duplicate ?? await createDowntimeRow(tx, {
        plantId, workCenterId: workCenter.Id,
        startedAt, finishedAt,
        downtimeType,
        reasonCode: "CMMS-DOWNTIME",
        noteFa: `[${idempotencyKey}] CMMS ${payload.assetTag ?? payload.assetRef ?? ""} — ${payload.reasonFa ?? ""}`,
        actor,
      });
      externalRef = row.Id;
      windowFrom = startedAt;
      windowTo = finishedAt ?? nowIso;
      applied = { duplicate: Boolean(duplicate), downtimeType, durationMinutes: row.DurationMinutes ?? null };
    } else if (eventType === "downtime.started") {
      const startedAt = asIso(payload.startedAt);
      if (!startedAt) throw new MesBridgeError("E-MES-DOWNTIME-WINDOW", "زمان شروع توقف نامعتبر است");
      const downtimeType = payload.downtimeType === "planned" ? "planned" : "unplanned";
      const duplicate = await findExistingByKey(tx, plantId, workCenter.Id, "CMMS-DOWNTIME", idempotencyKey);
      const row = duplicate ?? await createDowntimeRow(tx, {
        plantId, workCenterId: workCenter.Id,
        startedAt, finishedAt: null, downtimeType,
        reasonCode: "CMMS-DOWNTIME",
        noteFa: `[${idempotencyKey}] CMMS ${payload.assetTag ?? payload.assetRef ?? ""} — ${payload.reasonFa ?? ""}`,
        actor,
      });
      externalRef = row.Id;
      windowFrom = startedAt;
      windowTo = nowIso;
      applied = { duplicate: Boolean(duplicate), open: row.FinishedAt == null };
    } else if (eventType === "downtime.finished") {
      const startedAt = asIso(payload.startedAt);
      const finishedAt = asIso(payload.finishedAt) ?? nowIso;
      if (!startedAt) throw new MesBridgeError("E-MES-DOWNTIME-WINDOW", "زمان شروع توقف نامعتبر است");
      const openRows = await tx.list("MfgDowntimeLog", {
        where: [
          { column: "PlantId", op: "eq", value: plantId },
          { column: "WorkCenterId", op: "eq", value: workCenter.Id },
          { column: "ReasonCode", op: "eq", value: "CMMS-DOWNTIME" },
        ],
        limit: 200,
      });
      const open = openRows.find((row) => row.FinishedAt == null && new Date(row.StartedAt).toISOString() === startedAt);
      if (open) {
        const durationMinutes = Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / MINUTE_MS));
        await tx.patch("MfgDowntimeLog", open.Id, { FinishedAt: finishedAt, DurationMinutes: durationMinutes }, actor, open.RowVersion);
        externalRef = open.Id;
        applied = { closed: true, durationMinutes };
      } else {
        /* بدون ردیف باز (مثلاً MES هنگام شروع رویداد را ندیده): پنجرهٔ کامل ثبت
         * می‌شود؛ از دست دادن توقف بدتر از ساختن یک ردیف کامل است. */
        const row = await createDowntimeRow(tx, {
          plantId, workCenterId: workCenter.Id, startedAt, finishedAt,
          downtimeType: payload.downtimeType === "planned" ? "planned" : "unplanned",
          reasonCode: "CMMS-DOWNTIME",
          noteFa: `[${idempotencyKey}] CMMS ${payload.assetTag ?? payload.assetRef ?? ""} — ${payload.reasonFa ?? ""}`,
          actor,
        });
        externalRef = row.Id;
        applied = { closed: false, createdClosed: true };
      }
      windowFrom = startedAt;
      windowTo = finishedAt;
    } else {
      /* بلوکهٔ نرم ظرفیت */
      const windowStart = asIso(payload.windowStart);
      const windowEnd = asIso(payload.windowEnd);
      if (!windowStart || !windowEnd || windowEnd <= windowStart) {
        throw new MesBridgeError("E-MES-CAPACITY-WINDOW", "پنجرهٔ بلوکه‌سازی نامعتبر است");
      }
      if (eventType === "capacity.block.requested") {
        const duplicate = await findExistingByKey(tx, plantId, workCenter.Id, MES_CAPACITY_BLOCK_REASON, idempotencyKey);
        const row = duplicate ?? await createDowntimeRow(tx, {
          plantId, workCenterId: workCenter.Id,
          startedAt: windowStart, finishedAt: windowEnd,
          downtimeType: "planned",
          reasonCode: MES_CAPACITY_BLOCK_REASON,
          noteFa: `[${idempotencyKey}] CMMS block ${payload.blockRef ?? ""} (${payload.sourceType ?? "manual"}) — ${payload.reasonFa ?? ""}`,
          actor,
        });
        externalRef = row.Id;
        applied = { duplicate: Boolean(duplicate), reservedMinutes: row.DurationMinutes ?? null, sourceType: payload.sourceType ?? null };
        windowFrom = windowStart;
        windowTo = windowEnd;
      } else {
        const rows = await tx.list("MfgDowntimeLog", {
          where: [
            { column: "PlantId", op: "eq", value: plantId },
            { column: "WorkCenterId", op: "eq", value: workCenter.Id },
            { column: "ReasonCode", op: "eq", value: MES_CAPACITY_BLOCK_REASON },
          ],
          limit: 200,
        });
        const externalRefOfBlock = String(payload.externalRef ?? "").trim();
        const target = (externalRefOfBlock && rows.find((row) => row.Id === externalRefOfBlock))
          ?? rows.find((row) => new Date(row.StartedAt).toISOString() === windowStart)
          ?? null;
        if (!target) {
          /* آزادسازی رزروی که هرگز در MES ساخته نشده — نه خطا، نه ردیف تازه. */
          applied = { released: false, reason: "not-found" };
        } else if (new Date(target.StartedAt).getTime() >= new Date(nowIso).getTime()) {
          /* رزرو آینده یعنی هنوز چیزی رزرو نشده؛ حذف، همان آزادسازی است. */
          await tx.remove("MfgDowntimeLog", target.Id);
          externalRef = target.Id;
          applied = { released: true, removed: true };
        } else {
          const endIso = new Date(Math.max(new Date(target.StartedAt).getTime(), new Date(nowIso).getTime())).toISOString();
          const durationMinutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(target.StartedAt).getTime()) / MINUTE_MS));
          await tx.patch("MfgDowntimeLog", target.Id, { FinishedAt: endIso, DurationMinutes: durationMinutes }, actor, target.RowVersion);
          externalRef = target.Id;
          applied = { released: true, removed: false, durationMinutes };
        }
        windowFrom = windowStart;
        windowTo = windowEnd;
      }
    }

    /* پنجرهٔ تصویر: روزهای UTC که رویداد در آن‌ها رخ داده است. اگر همین
     * پنجرهٔ توقف را برای محاسبه می‌گرفتیم، «ظرفیت تقویمی» هم‌اندازهٔ خودِ
     * توقف می‌شد و دسترس‌پذیری همیشه صفر درمی‌آمد. */
    const projectionWindow = dayWindowOf(windowFrom ?? nowIso, windowTo ?? nowIso);
    const projection = await projectWorkCenterAvailability(tx, {
      workCenterId: workCenter.Id, plantId,
      from: projectionWindow.from, to: projectionWindow.to,
      nominalMinutesPerDay: workCenter.NominalCapacityMinutesPerDay,
      now: nowIso,
    });
    return {
      ok: true,
      model: MES_CMMS_BRIDGE_MODEL,
      plantId, workCenterId: workCenter.Id, workCenterCode: workCenter.Code ?? null,
      externalRef, applied,
      availabilityWindow: projectionWindow,
      availability: projection,
      /* `ack` همان بدنه‌ای است که CMMS در ستون AckPayloadJson نگه می‌دارد؛
       * سند شاهدِ تحویل از دو طرف یک شکل دارد. */
      ack: {
        model: MES_CMMS_BRIDGE_MODEL,
        plantId, workCenterId: workCenter.Id,
        externalRef, applied,
        availabilityWindow: projectionWindow,
        availability: projection,
      },
    };
  });
}

/**
 * تصویر دسترس‌پذیری یک مرکز کاری از روی توقف‌های ثبت‌شده.
 *
 * تقویم از ظرفیت اسمی روزانه × طول پنجره تخمین زده می‌شود؛ همین تقریب،
 * مبنای نمایش CMMS است و ادعای دقتِ تقویم شیفتی ندارد.
 */
export async function projectWorkCenterAvailability(repo, { workCenterId, plantId, from, to, nominalMinutesPerDay = 480, now } = {}) {
  repo = await resolveRepo(repo);
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return { calendarMinutes: 0, plannedDowntimeMinutes: 0, unplannedDowntimeMinutes: 0, availabilityPct: null, interpretationFa: "پنجرهٔ زمانی نامعتبر است." };
  }
  const rows = await repo.list("MfgDowntimeLog", {
    where: [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "WorkCenterId", op: "eq", value: workCenterId },
    ],
    limit: 500,
  });
  let plannedMs = 0;
  let unplannedMs = 0;
  /* «حالا» تزریق‌شدنی است تا نتیجه به ساعت دیوار وابسته نباشد. */
  const nowMs = now instanceof Date ? now.getTime() : now ? new Date(now).getTime() : Date.now();
  for (const row of rows) {
    const start = new Date(row.StartedAt).getTime();
    const finished = row.FinishedAt == null ? null : new Date(row.FinishedAt).getTime();
    const duration = Number(row.DurationMinutes);
    /* همان قرارداد زمان‌بندی MES: توقف بسته تا پایانش، توقف باز تا «حالا» و
     * حداکثر تا لبهٔ پنجره. اگر توقف باز «صفر دقیقه» شمرده می‌شد، افت
     * دسترس‌پذیری درست دیده نمی‌شد. */
    const end = Number.isFinite(finished)
      ? finished
      : Number.isFinite(duration) && duration > 0 ? start + duration * MINUTE_MS : Math.min(nowMs, toMs);
    const clipStart = Math.max(fromMs, start);
    const clipEnd = Math.min(toMs, end);
    if (clipEnd <= clipStart) continue;
    if (row.DowntimeType === "planned") plannedMs += clipEnd - clipStart;
    else unplannedMs += clipEnd - clipStart;
  }
  const days = (toMs - fromMs) / 86_400_000;
  const calendarMinutes = Math.round(Math.max(0, days) * (Number(nominalMinutesPerDay) || 480));
  return projectAvailability({
    calendarMinutes,
    plannedDowntimeMinutes: plannedMs / MINUTE_MS,
    unplannedDowntimeMinutes: unplannedMs / MINUTE_MS,
  });
}

/* ═══════════════════════ لایهٔ HTTP سمت MES ═══════════════════════ */

const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;

/**
 * مسیرهای ورودی قرارداد یکپارچگی در سمت MES:
 *   POST /api/mfg/integration/cmms/events        دریافت و اِعمال رویداد
 *   GET  /api/mfg/integration/cmms/availability  تصویر دسترس‌پذیری مرکز کاری
 *   GET  /api/mfg/integration/cmms/capacity-blocks رزروهای ظرفیت ساختهٔ CMMS
 */
export function registerMesCmmsBridgeRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app || typeof app.get !== "function" || typeof app.post !== "function") {
    throw new TypeError("Express-compatible app is required");
  }
  /* مخزن می‌تواند خودِ repository باشد یا تابعی که دیرتر آن را می‌سازد؛
   * `server/index.js` شکل تابعی را می‌دهد تا وابستگی حلقه‌ای نسازد. */
  if (typeof repo !== "function" && (!repo || typeof repo.list !== "function")) {
    throw new TypeError("MES repository is required");
  }
  if (!Array.isArray(subjects) || typeof evaluate !== "function") throw new TypeError("MES RBAC dependencies are required");

  const getRepo = () => resolveRepo(repo);
  const fail = (req, res, err) => {
    if (err instanceof MesBridgeError) {
      return res.status(422).json({ ok: false, error: { code: err.code, message: err.messageFa, ...err.extra, traceId: req.requestId } });
    }
    console.error("[%s] cmms-mes bridge error:", req.requestId, err);
    return res.status(500).json({ ok: false, error: { code: "E-MES-BRIDGE", message: "خطای داخلی پل یکپارچگی", traceId: req.requestId } });
  };
  const actorOf = (req) => {
    const userId = String(req.headers?.["x-user-id"] ?? "").trim();
    return userId ? subjects.find((item) => item.id === userId && item.active !== false) ?? null : null;
  };

  app.post("/api/mfg/integration/cmms/events", async (req, res) => {
    try {
      const subject = actorOf(req);
      if (!subject) {
        return res.status(401).json({ ok: false, error: { code: "MES_AUTH_REQUIRED", message: "هویت کاربر معتبر و فعال الزامی است", traceId: req.requestId } });
      }
      const eventType = String(req.body?.EventType ?? "");
      const permission = CMMS_MES_EVENT_PERMISSIONS[eventType];
      if (!permission) {
        return res.status(400).json({ ok: false, error: { code: "E-MES-EVENT-TYPE", message: `نوع رویداد «${eventType}» پشتیبانی نمی‌شود`, traceId: req.requestId } });
      }
      const r = await getRepo();
      /* مرکز کاری پیش از ارزیابی مجوز پیدا می‌شود تا دامنهٔ کارخانهٔ مقصد
       * روشن باشد؛ خودِ رکورد مرکز کاری دادهٔ عمومی کارخانه است. */
      const workCenter = await resolveWorkCenter(r, req.body?.TargetRef ?? payloadOf(req.body).workCenterRef);
      const decision = evaluate(subject, permission, { plantId: workCenter.PlantId });
      if (!decision.allow) {
        const scopeDenied = decision.code === "DENY_PLANT_SCOPE";
        return res.status(403).json({
          ok: false,
          error: {
            code: scopeDenied ? "MES_PLANT_SCOPE_DENIED" : "MES_FORBIDDEN",
            message: scopeDenied ? "کاربر به این کارخانه تخصیص ندارد" : "مجوز این عمل را ندارید",
            permission, reason: decision.code, traceId: req.requestId,
          },
        });
      }
      const data = await applyCmmsIntegrationEvent({ repo: r, event: req.body, actor: subject.id });
      return res.status(200).json({ ok: true, data, meta: { traceId: req.requestId, version: MES_CMMS_BRIDGE_MODEL } });
    } catch (err) {
      return fail(req, res, err);
    }
  });

  app.get("/api/mfg/integration/cmms/availability", async (req, res) => {
    try {
      const subject = actorOf(req);
      if (!subject) {
        return res.status(401).json({ ok: false, error: { code: "MES_AUTH_REQUIRED", message: "هویت کاربر معتبر و فعال الزامی است", traceId: req.requestId } });
      }
      const workCenterId = String(req.query?.workCenterId ?? "").trim();
      if (!ID_RE.test(workCenterId)) {
        return res.status(400).json({ ok: false, error: { code: "E-MES-QUERY", message: "شناسهٔ مرکز کاری نامعتبر است", traceId: req.requestId } });
      }
      const r = await getRepo();
      const workCenter = await resolveWorkCenter(r, workCenterId);
      const decision = evaluate(subject, "mfg.capacity.view", { plantId: workCenter.PlantId });
      if (!decision.allow) {
        return res.status(403).json({ ok: false, error: { code: "MES_FORBIDDEN", message: "مجوز مشاهدهٔ ظرفیت را ندارید", permission: "mfg.capacity.view", reason: decision.code, traceId: req.requestId } });
      }
      const from = req.query?.from ?? new Date(Date.now() - 86_400_000).toISOString();
      const to = req.query?.to ?? new Date().toISOString();
      const data = await projectWorkCenterAvailability(r, {
        workCenterId: workCenter.Id, plantId: workCenter.PlantId, from, to,
        nominalMinutesPerDay: workCenter.NominalCapacityMinutesPerDay,
      });
      return res.status(200).json({ ok: true, data, meta: { traceId: req.requestId, version: MES_CMMS_BRIDGE_MODEL } });
    } catch (err) {
      return fail(req, res, err);
    }
  });

  app.get("/api/mfg/integration/cmms/capacity-blocks", async (req, res) => {
    try {
      const subject = actorOf(req);
      if (!subject) {
        return res.status(401).json({ ok: false, error: { code: "MES_AUTH_REQUIRED", message: "هویت کاربر معتبر و فعال الزامی است", traceId: req.requestId } });
      }
      const workCenterId = String(req.query?.workCenterId ?? "").trim();
      if (!ID_RE.test(workCenterId)) {
        return res.status(400).json({ ok: false, error: { code: "E-MES-QUERY", message: "شناسهٔ مرکز کاری نامعتبر است", traceId: req.requestId } });
      }
      const r = await getRepo();
      const workCenter = await resolveWorkCenter(r, workCenterId);
      const decision = evaluate(subject, "mfg.capacity.view", { plantId: workCenter.PlantId });
      if (!decision.allow) {
        return res.status(403).json({ ok: false, error: { code: "MES_FORBIDDEN", message: "مجوز مشاهدهٔ ظرفیت را ندارید", permission: "mfg.capacity.view", reason: decision.code, traceId: req.requestId } });
      }
      const rows = await r.list("MfgDowntimeLog", {
        where: [
          { column: "PlantId", op: "eq", value: workCenter.PlantId },
          { column: "WorkCenterId", op: "eq", value: workCenter.Id },
        ],
        orderBy: [{ column: "StartedAt", dir: "asc" }],
        limit: 200,
      });
      /* فقط رزروهای ظرفیت؛ ردیف‌های توقف CMMS با کد دیگری ثبت می‌شوند و
       * نباید در فهرست رزروها دیده شوند. */
      const blocks = rows.filter((row) => String(row.ReasonCode ?? "") === MES_CAPACITY_BLOCK_REASON);
      return res.status(200).json({
        ok: true,
        data: {
          workCenterId: workCenter.Id, workCenterCode: workCenter.Code ?? null,
          blocks: blocks.map((row) => ({
            Id: row.Id, StartedAt: row.StartedAt, FinishedAt: row.FinishedAt,
            ReservedMinutes: row.DurationMinutes ?? null, NoteFa: row.NoteFa ?? null,
            IsOpen: row.FinishedAt == null,
          })),
          total: blocks.length,
        },
        meta: { traceId: req.requestId, version: MES_CMMS_BRIDGE_MODEL },
      });
    } catch (err) {
      return fail(req, res, err);
    }
  });
}
