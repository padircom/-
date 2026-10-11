/**
 * پل یکپارچگی IIoT → CMMS / MES / PMIS — سمت مقصد
 * ═══════════════════════════════════════════════════════════════════════
 * این فایل «سامانه‌های مقصد» سه قرارداد `iiot-cmms-v1`، `iiot-mes-v1` و
 * `iiot-pmis-v1` را پیاده می‌کند.
 *
 * تصمیم معماری: **هیچ کلید خارجی بین `Iot*` و جدول‌های `Cmms*`/`Mfg*`/`d4`
 * وجود ندارد.** رویدادها با REST (یا حمل‌ونقل درون‌فرآیندی) می‌آیند و اینجا
 * به ردیف‌های خودِ سامانهٔ مقصد ترجمه می‌شوند:
 *
 *   alert.critical   → CmmsAlert + CmmsWorkOrder (+ CmmsWorkRequest اگر دارایی
 *                      شناخته شود) · MfgDowntimeLog ناخواسته · رویداد PMIS
 *   alert.resolved   → بستن همان ردیف‌ها (هشدار بسته، توقف بسته)
 *   downtime.npt     → ثبت توقف در MES و صف رویداد PMIS
 *   downtime.closed  → بستن توقف MES + ثبت NPT در PMIS و (در صورت شایستگی)
 *                      پیش‌نویس ادعا در لایهٔ Claims
 *   condition.reading→ CmmsConditionReading با Source='iiot'
 *
 * قواعد مشترک:
 *  • هر رویداد کلید تکرارناپذیر دارد؛ تحویل دوباره ردیف دوباره نمی‌سازد.
 *  • مرجع مقصد با «ارجاع نرم» پیدا می‌شود؛ ناشناخته یعنی خطای دسته‌بندی‌شده،
 *    نه ردیف سرگردان.
 *  • هیچ «موفق»ی بی‌شاهد ثبت نمی‌شود: یا ref برمی‌گردد یا خطا.
 */

import { IIOT_DOMAIN_VERSION } from "./iiotLogic.js";

export const IIOT_BRIDGE_MODEL = "iiot-bridge-v1";

export const IIOT_BRIDGE_EVENT_TYPES = Object.freeze([
  "alert.critical", "alert.resolved", "downtime.npt", "downtime.closed", "condition.reading",
]);

/** مجوز لازم برای هر مسیر REST پل — مقصد، خودش تصمیم می‌گیرد چه کسی بنویسد. */
export const IIOT_BRIDGE_EVENT_PERMISSIONS = Object.freeze({
  cmms: "cmms.request.create",
  mes: "mfg.execution.report",
  pmis: "core.event.view",
});

/** پیشوند شمارهٔ اسنادی که این پل در CMMS می‌سازد — تا از کارهای انسانی جدا بمانند. */
export const IIOT_CMMS_WORK_ORDER_PREFIX = "IIOT-WO";
export const IIOT_CMMS_ALERT_PREFIX = "IIOT";
/** پیشوند کد ادعای NPT در لایهٔ Claims. */
export const IIOT_PMIS_CLAIM_PREFIX = "IIOT-NPT";

class IiotBridgeError extends Error {
  constructor(code, messageFa, extra = {}) {
    super(messageFa);
    this.name = "IiotBridgeError";
    this.code = code;
    this.messageFa = messageFa;
    this.extra = extra;
  }
}

const asIso = (value) => {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
};

const num = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * یکسان‌سازی دو شکلی که یک رویداد به این پل می‌رسد:
 *   • «سطر ذخیره‌شده» — ردیف `IotIntegrationEvent` که یک فراخوان بیرونی با
 *     REST می‌فرستد (`EventType`/`IdempotencyKey`/`PayloadJson`).
 *   • «پاکت حمل‌ونقل» — همان چیزی که قرارداد `deliver()` در IIoT می‌دهد
 *     (`eventType`/`idempotencyKey`/`payload`).
 * بدون این یکسان‌سازی، رویداد درون‌فرآیندی با «قرارداد ناشناخته» رد می‌شود —
 * باگی که فقط در اجرای واقعی سرور دیده می‌شود.
 */
export function normalizeIiotInboundEvent(event) {
  if (!event || typeof event !== "object") return {};
  const payload = event.PayloadJson && typeof event.PayloadJson === "object"
    ? event.PayloadJson
    : event.payload && typeof event.payload === "object" ? event.payload : {};
  return {
    Id: event.Id ?? event.eventId ?? null,
    EventType: event.EventType ?? event.eventType ?? "",
    TargetSystem: event.TargetSystem ?? event.targetSystem ?? "",
    TargetRef: event.TargetRef ?? event.targetRef ?? null,
    Contract: event.Contract ?? event.contract ?? payload.contract ?? null,
    IdempotencyKey: event.IdempotencyKey ?? event.idempotencyKey ?? "",
    CorrelationId: event.CorrelationId ?? event.correlationId ?? null,
    OccurredAt: event.OccurredAt ?? event.occurredAt ?? null,
    PayloadJson: payload,
  };
}

const payloadOf = (event) => (event?.PayloadJson && typeof event.PayloadJson === "object" ? event.PayloadJson : {});

async function nextSerial(repo, table, where, column, prefix) {
  const rows = await repo.list(table, { where, orderBy: [{ column, dir: "desc" }], limit: 1 });
  const last = rows[0]?.[column];
  const n = last ? Number(String(last).split("-").pop()) + 1 : 1;
  return `${prefix}-${String(Number.isFinite(n) ? n : 1).padStart(3, "0")}`;
}

/* ═══════════════════════ سمت CMMS ═══════════════════════ */

/** دارایی را با ارجاع نرم پیدا می‌کند: شناسه مقدم است، کد پشتیبان. */
async function resolveCmmsAsset(repo, siteId, assetRef) {
  const ref = String(assetRef ?? "").trim();
  if (!ref) return null;
  const byId = await repo.get("CmmsAsset", ref);
  if (byId && byId.SiteId === siteId) return byId;
  const byCode = await repo.findOne("CmmsAsset", [
    { column: "SiteId", op: "eq", value: siteId },
    { column: "AssetCode", op: "eq", value: ref },
  ]);
  return byCode ?? null;
}

async function applyToCmms(repo, { payload, key, occurredAt, actor }) {
  const siteId = String(payload.cmmsSiteRef ?? "").trim();
  if (!siteId) throw new IiotBridgeError("E-IIOT-CMMS-SITE-MISSING", "رویداد مرجع سایت نت را ندارد");

  if (payload.eventKind === "condition" || payload.readingType) {
    const asset = await resolveCmmsAsset(repo, siteId, payload.cmmsAssetRef);
    if (!asset) throw new IiotBridgeError("E-IIOT-CMMS-ASSET-UNKNOWN", `دارایی «${payload.cmmsAssetRef}» در سایت نت شناخته نشد`);
    const measuredAt = asIso(payload.measuredAt ?? occurredAt);
    const row = await repo.create("CmmsConditionReading", {
      SiteId: siteId, AssetId: asset.Id,
      /* پارامتر پایش وضعیت خانواده الزامی است؛ اگر مرجع داده نشد، ردیف ساخته
       * نمی‌شود — ساختن ردیف بی‌پارامتر، دادهٔ بی‌صاحب است. */
      FamilyConditionParamId: String(payload.cmmsConditionParamRef ?? "").trim() || null,
      MeasuredAt: measuredAt, MeasuredOn: String(measuredAt).slice(0, 10),
      Value: num(payload.value), Uom: String(payload.uom ?? ""),
      Zone: payload.zone ?? null, Source: "iiot",
      TrendDirection: payload.trendDirection ?? null, RateOfChange: num(payload.rateOfChange),
      NoteFa: `ثبت خودکار از IIoT · کلید: ${key}`,
    }, actor);
    if (!row.FamilyConditionParamId) {
      await repo.remove("CmmsConditionReading", row.Id);
      throw new IiotBridgeError("E-IIOT-CMMS-PARAM-MISSING", "پارامتر پایش وضعیت مقصد مشخص نشده است");
    }
    return { ok: true, ref: row.Id, table: "CmmsConditionReading" };
  }

  /* بستن هشدار: همان ردیفی که کلید ضدتکرار در MessageFa آن نشسته. کلید
   * رویداد بسته‌شدن با کلید رویداد بازکننده یکی نیست، پس هر دو جست‌وجو
   * می‌شوند — `opensKey` را تولیدکننده در پاکت می‌گذارد. */
  if (payload.resolvedAt) {
    const alerts = await repo.list("CmmsAlert", {
      where: [{ column: "SiteId", op: "eq", value: siteId }],
      orderBy: [{ column: "RaisedAt", dir: "desc" }],
      limit: 200,
    });
    const keys = [key, payload.opensKey].map((k) => String(k ?? "").trim()).filter(Boolean);
    const match = alerts.find((row) => keys.some((k) => String(row.MessageFa ?? "").includes(k)));
    if (!match) throw new IiotBridgeError("E-IIOT-CMMS-ALERT-UNKNOWN", "هشدار مرتبط در CMMS یافت نشد");
    if (match.Status === "resolved") return { ok: true, ref: match.Id, table: "CmmsAlert", alreadyApplied: true };
    await repo.patch("CmmsAlert", match.Id, {
      Status: "resolved",
      ResolvedAt: asIso(payload.resolvedAt),
      ResolutionNoteFa: "بستن خودکار از IIoT — بازگشت سیگنال به محدودهٔ عادی",
    }, actor, match.RowVersion);
    return { ok: true, ref: match.Id, table: "CmmsAlert" };
  }

  /* هشدار بحرانی → آلارم + دستورکار (و درخواست‌کار اگر دارایی شناخته شد). */
  const existingAlerts = await repo.list("CmmsAlert", {
    where: [{ column: "SiteId", op: "eq", value: siteId }],
    orderBy: [{ column: "RaisedAt", dir: "desc" }],
    limit: 200,
  });
  const duplicate = existingAlerts.find((row) => String(row.MessageFa ?? "").includes(key));
  if (duplicate) return { ok: true, ref: duplicate.Id, table: "CmmsAlert", alreadyApplied: true };

  const raisedAt = asIso(payload.occurredAt ?? occurredAt);
  const alertCode = `${IIOT_CMMS_ALERT_PREFIX}-${String(payload.alertCode ?? payload.alertId ?? "ALERT").slice(0, 40)}`;
  const messageFa = [
    payload.messageFa ?? "",
    `دکل: ${payload.rigNo ?? payload.rigId ?? "-"}`,
    `کانال: ${payload.channelCode ?? "-"}`,
    `کلید تکرارناپذیر: ${key}`,
  ].filter(Boolean).join(" · ").slice(0, 2000);

  const cmmsAlert = await repo.create("CmmsAlert", {
    SiteId: siteId,
    AlertCode: alertCode,
    Severity: payload.level === "critical" ? "critical" : "high",
    Category: "condition",
    TitleFa: String(payload.titleFa ?? "هشدار تله‌متری IIoT").slice(0, 300),
    MessageFa: messageFa,
    AssetId: (await resolveCmmsAsset(repo, siteId, payload.cmmsAssetRef))?.Id ?? null,
    Status: "open",
    RaisedAt: raisedAt,
    NotifyInApp: true,
    NotifyEmail: payload.level === "critical",
    NotifySms: false,
  }, actor);

  const asset = await resolveCmmsAsset(repo, siteId, payload.cmmsAssetRef);
  const created = [{ table: "CmmsAlert", id: cmmsAlert.Id }];

  /* دستورکار خودکار: AssetId در CmmsWorkOrder اختیاری است، پس حتی بدون
   * شناسنامهٔ دارایی هم کار تعمیراتی ثبت می‌شود — دکل نباید معطل بماند. */
  const workOrderNo = await nextSerial(repo, "CmmsWorkOrder", [{ column: "SiteId", op: "eq", value: siteId }], "WorkOrderNo", IIOT_CMMS_WORK_ORDER_PREFIX);
  const workOrder = await repo.create("CmmsWorkOrder", {
    SiteId: siteId,
    WorkOrderNo: workOrderNo,
    WorkOrderType: payload.level === "critical" ? "emergency" : "cm",
    AssetId: asset?.Id ?? null,
    TitleFa: String(payload.titleFa ?? "بازرسی هشدار تله‌متری").slice(0, 300),
    ScopeFa: [
      payload.messageFa ?? "",
      `منبع: IIoT/${payload.detectKind ?? "threshold"} · دکل ${payload.rigNo ?? payload.rigId ?? "-"}`,
      `کلید تکرارناپذیر: ${key}`,
      payload.escalationNoteFa ?? "",
    ].filter(Boolean).join("\n").slice(0, 4000),
    Priority: num(payload.cmmsPriority) ?? (payload.level === "critical" ? 1 : 3),
    Status: "draft",
    IsAssetDown: payload.level === "critical",
    ProductionImpact: payload.level === "critical" ? "partial" : "none",
  }, actor);
  created.push({ table: "CmmsWorkOrder", id: workOrder.Id, no: workOrderNo });

  /* درخواست‌کار فقط وقتی ساخته می‌شود که دارایی شناخته شود، چون
   * CmmsWorkRequest.AssetId اجباری است و FK دارد. */
  let workRequest = null;
  if (asset) {
    const requestNo = await nextSerial(repo, "CmmsWorkRequest", [{ column: "SiteId", op: "eq", value: siteId }], "RequestNo", "IIOT-REQ");
    workRequest = await repo.create("CmmsWorkRequest", {
      SiteId: siteId,
      RequestNo: requestNo,
      AssetId: asset.Id,
      RequestType: "service",
      Priority: num(payload.cmmsPriority) ?? 2,
      Status: "submitted",
      ReportedOn: String(raisedAt).slice(0, 10),
      ReportedAt: raisedAt,
      ReporterId: actor,
      TitleFa: String(payload.titleFa ?? "درخواست سرویس از IIoT").slice(0, 300),
      DescriptionFa: `ثبت خودکار از پایش میدانی.\nکلید تکرارناپذیر: ${key}`.slice(0, 4000),
      SymptomFa: String(payload.messageFa ?? "").slice(0, 1000),
      IsAssetStopped: payload.level === "critical",
      ConvertedWorkOrderId: workOrder.Id,
    }, actor);
    created.push({ table: "CmmsWorkRequest", id: workRequest.Id, no: requestNo });
  }

  return { ok: true, ref: workOrder.Id, table: "CmmsWorkOrder", workOrderNo, created };
}

/* ═══════════════════════ سمت MES ═══════════════════════ */

async function resolveWorkCenter(repo, workCenterRef) {
  const ref = String(workCenterRef ?? "").trim();
  if (!ref) throw new IiotBridgeError("E-IIOT-MES-WORKCENTER-MISSING", "رویداد مرجع مرکز کاری MES را ندارد");
  const byId = await repo.get("MfgWorkCenter", ref);
  if (byId) return byId;
  const byCode = await repo.findOne("MfgWorkCenter", [{ column: "Code", op: "eq", value: ref }]);
  if (byCode) return byCode;
  throw new IiotBridgeError("E-IIOT-MES-WORKCENTER-UNKNOWN", `مرکز کاری «${ref}» در MES شناخته نشده است`, { workCenterRef: ref });
}

/**
 * همان ردیفی که تحویل قبلی ساخته — کلید ضدتکرار در NoteFa نگه داشته می‌شود.
 * `keys` می‌تواند چند کلید باشد: رویداد بسته‌شدن، کلید خودش را دارد و کلید
 * رویداد بازکننده را در `opensKey` حمل می‌کند؛ هر دو پذیرفته‌اند.
 */
async function findMesRowByKey(repo, plantId, workCenterId, key) {
  const keys = (Array.isArray(key) ? key : [key]).map((k) => String(k ?? "").trim()).filter(Boolean);
  if (!keys.length) return null;
  const rows = await repo.list("MfgDowntimeLog", {
    where: [
      { column: "PlantId", op: "eq", value: plantId },
      { column: "WorkCenterId", op: "eq", value: workCenterId },
    ],
    limit: 500,
  });
  return rows.find((row) => keys.some((k) => String(row.NoteFa ?? "").includes(k))) ?? null;
}

async function applyToMes(repo, { payload, key, occurredAt, actor }) {
  const workCenter = await resolveWorkCenter(repo, payload.mesWorkCenterRef);
  const plantId = String(payload.mesPlantRef ?? workCenter.PlantId ?? "").trim();
  if (!plantId) throw new IiotBridgeError("E-IIOT-MES-PLANT-MISSING", "کارخانهٔ مقصد در MES تعیین نشده است");

  const existing = await findMesRowByKey(repo, plantId, workCenter.Id, [key, payload.opensKey]);

  /* بستن: همان ردیف باز را با زمان پایان پر می‌کند. */
  if (payload.resolvedAt || payload.endedAt) {
    const finishedAt = asIso(payload.resolvedAt ?? payload.endedAt);
    if (!existing) {
      /* توقفی که هیچ‌گاه از راه هشدار تله‌متری باز نشده (مثلاً اپراتور دستی
       * ثبت کرده) هم زمان واقعی از دست رفته دارد. پس ردیف بسته ساخته می‌شود
       * تا OEE تولید، این زمان را نبیند — نه اینکه رویداد بی‌اثر رد شود. */
      const startedAt = asIso(payload.startedAt ?? payload.occurredAt ?? occurredAt);
      const minutes = num(payload.durationMinutes)
        ?? (finishedAt && startedAt ? Math.max(0, (Date.parse(finishedAt) - Date.parse(startedAt)) / 60_000) : null);
      const row = await repo.create("MfgDowntimeLog", {
        PlantId: plantId,
        WorkCenterId: workCenter.Id,
        StartedAt: startedAt,
        FinishedAt: finishedAt,
        DurationMinutes: minutes === null ? null : Math.round(minutes * 1000) / 1000,
        DowntimeType: "unplanned",
        ReasonCode: `IIOT-${String(payload.nptCode ?? payload.category ?? "NPT").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24)}`,
        RecordedBy: actor,
        NoteFa: `توقف راستی‌آزمایی‌شدهٔ دکل (IIoT) — دکل ${payload.rigNo ?? payload.rigId ?? "-"} · ${payload.causeFa ?? ""} · کلید: ${key}`.slice(0, 800),
      }, actor);
      return { ok: true, ref: row.Id, table: "MfgDowntimeLog", closed: true, created: true };
    }
    if (existing.FinishedAt) return { ok: true, ref: existing.Id, table: "MfgDowntimeLog", alreadyApplied: true };
    const minutes = num(payload.durationMinutes) ?? Math.max(0, (Date.parse(finishedAt) - Date.parse(existing.StartedAt)) / 60_000);
    await repo.patch("MfgDowntimeLog", existing.Id, { FinishedAt: finishedAt, DurationMinutes: Math.round(minutes * 1000) / 1000 }, actor, existing.RowVersion);
    return { ok: true, ref: existing.Id, table: "MfgDowntimeLog", closed: true };
  }

  if (existing) return { ok: true, ref: existing.Id, table: "MfgDowntimeLog", alreadyApplied: true };

  const startedAt = asIso(payload.occurredAt ?? payload.startedAt ?? occurredAt);
  const reasonCode = `IIOT-${String(payload.detectKind ?? payload.nptCode ?? "ALERT").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24)}`;
  const row = await repo.create("MfgDowntimeLog", {
    PlantId: plantId,
    WorkCenterId: workCenter.Id,
    StartedAt: startedAt,
    FinishedAt: payload.endedAt ? asIso(payload.endedAt) : null,
    DurationMinutes: num(payload.durationMinutes) ?? null,
    /* توقف ناشی از ناهنجاری تله‌متری، ناخواسته است: OEE آن را از زمان
     * عملیاتی کم می‌کند، نه از زمان برنامه‌ریزی‌شده. */
    DowntimeType: "unplanned",
    ReasonCode: reasonCode,
    RecordedBy: actor,
    NoteFa: `توقف خودکار از پایش میدانی (IIoT) — دکل ${payload.rigNo ?? payload.rigId ?? "-"} · ${payload.causeFa ?? payload.titleFa ?? ""} · کلید: ${key}`.slice(0, 800),
  }, actor);
  return { ok: true, ref: row.Id, table: "MfgDowntimeLog", reasonCode };
}

/* ═══════════════════════ سمت PMIS ═══════════════════════ */

async function applyToPmis(repo, { payload, key, occurredAt, actor }) {
  const projectId = String(payload.pmisProjectRef ?? "").trim();
  if (!projectId) throw new IiotBridgeError("E-IIOT-PMIS-PROJECT-MISSING", "رویداد مرجع پروژهٔ PMIS را ندارد");

  /* ۱) صف رویداد هسته — گزارش پیشرفت پروژه از همین صندوق می‌خواند. */
  const eventKey = `iiot-pmis:${key}`.slice(0, 160);
  let integrationEvent = await repo.findOne("IntegrationEvent", [{ column: "EventKey", op: "eq", value: eventKey }]);
  const eventExisted = Boolean(integrationEvent);
  if (!integrationEvent) {
    integrationEvent = await repo.create("IntegrationEvent", {
      EventKey: eventKey,
      EventType: `iiot.${String(payload.eventTypeSuffix ?? "npt").replace(/[^a-z.]/g, "") || "npt"}`.slice(0, 60),
      SchemaVersion: "1.0",
      SourceModule: "iiot",
      TargetModule: "d2",
      ProjectId: projectId,
      EntityName: payload.entityName ?? "IotRigDowntime",
      EntityId: String(payload.downtimeId ?? payload.alertId ?? "").slice(0, 120) || null,
      PayloadJson: JSON.stringify({
        contract: "iiot-pmis-v1",
        rigId: payload.rigId, rigNo: payload.rigNo,
        category: payload.category, nptCode: payload.nptCode,
        causeFa: payload.causeFa, responsibilityFa: payload.responsibilityFa,
        startedAt: payload.startedAt, endedAt: payload.endedAt,
        durationMinutes: num(payload.durationMinutes),
        isNpt: payload.isNpt === true,
        alertCode: payload.alertCode, channelCode: payload.channelCode,
        modelVersion: IIOT_DOMAIN_VERSION,
        idempotencyKey: key,
      }).slice(0, 8000),
      Status: "pending",
      OccurredAt: asIso(payload.occurredAt ?? occurredAt),
      AttemptCount: 0,
      EmittedBy: actor,
    }, actor);
  }

  const created = [{ table: "IntegrationEvent", id: integrationEvent.Id }];

  /* ۲) لایهٔ ادعاها: NPT شایستهٔ ادعا، پیش‌نویس Claim می‌سازد.
   * «پیش‌نویس» عمداست — اعلام ادعا یک تصمیم قراردادی است و باید انسان
   * امضا کند؛ IIoT فقط شواهد را جمع می‌کند. */
  let claim = null;
  let claimExisted = false;
  if (payload.claimWorthy === true) {
    const claimCode = `${IIOT_PMIS_CLAIM_PREFIX}-${String(payload.downtimeCode ?? payload.downtimeId ?? key).slice(0, 30)}`;
    claim = await repo.findOne("Claim", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Code", op: "eq", value: claimCode },
    ]);
    claimExisted = Boolean(claim);
    if (!claim) {
      const eventDate = String(payload.startedAt ?? occurredAt).slice(0, 10);
      claim = await repo.create("Claim", {
        ProjectId: projectId,
        Code: claimCode,
        TitleFa: `ادعای زمان نامولّد دکل ${payload.rigNo ?? payload.rigId ?? ""} — ${payload.causeFa ?? payload.nptCode ?? ""}`.slice(0, 400),
        NoticeDate: eventDate,
        EventDate: eventDate,
        Status: "draft",
        TimeBarred: false,
        ExtensionDays: num(payload.durationMinutes) === null ? null : Math.round(num(payload.durationMinutes) / 1440),
        Cause: String(payload.causeFa ?? "").slice(0, 1000),
        Causation: `مسئولیت: ${payload.responsibilityFa ?? "مشخص‌نشده"} · کد NPT: ${payload.nptCode ?? "-"}`.slice(0, 1000),
        QuantumNote: `زمان نامولّد ثبت‌شده: ${num(payload.durationMinutes) ?? 0} دقیقه (ثبت خودکار از تله‌متری دکل)`.slice(0, 1000),
        EvidenceRef: `IotRigDowntime:${payload.downtimeId ?? "-"} · IotTelemetryAlert:${payload.alertId ?? "-"} · کلید: ${key}`.slice(0, 1000),
      }, actor);
      created.push({ table: "Claim", id: claim.Id, code: claimCode });
    }
  }

  return {
    ok: true, ref: integrationEvent.Id, table: "IntegrationEvent", created, claimId: claim?.Id ?? null,
    /* اگر هم رویداد و هم ادعا پیش‌تر ساخته شده باشند، این تحویل تکراری است —
     * همان نشانه‌ای که CMMS/MES برمی‌گردانند تا صف خروجی «تکراری» را از
     * «موفق تازه» جدا کند. */
    alreadyApplied: eventExisted && (payload.claimWorthy !== true || claimExisted),
  };
}

/* ═══════════════════════ نقطهٔ ورود یکپارچه ═══════════════════════ */

/* فهرست بستهٔ مقصدها — فراخوانی از راه سوئیچ با مقدار ثابت انجام می‌شود، نه
 * ایندکس پویا با رشتهٔ ورودی (CodeQL: js/unvalidated-dynamic-method-call). */
const IIOT_BRIDGE_TARGETS = Object.freeze(["cmms", "mes", "pmis"]);

/**
 * اِعمال یک رویداد IIoT روی سامانهٔ مقصد.
 * در موفقیت `{ ok: true, ref }` و در شکست، استثنای `IiotBridgeError` با کد
 * دسته‌بندی‌شده — تا صف خروجی بتواند «چرا نرسید» را ثبت کند.
 */
export async function applyIiotIntegrationEvent({ repo, event, actor = "svc-iiot-bridge" }) {
  /* `repo` می‌تواند خودِ مخزن باشد (آزمون‌ها) یا تابع دسترسی به آن — همان
   * قراردادی که `server/index.js` به همهٔ ماژول‌ها می‌دهد. */
  const store = typeof repo === "function" ? await repo() : repo;
  if (!store || typeof store.create !== "function") throw new IiotBridgeError("E-IIOT-BRIDGE-REPO", "مخزن داده در دسترس نیست");
  const normalized = normalizeIiotInboundEvent(event);
  const payload = payloadOf(normalized);
  const target = String(normalized.TargetSystem ?? "").trim().toLowerCase();
  if (!IIOT_BRIDGE_TARGETS.includes(target)) {
    throw new IiotBridgeError("E-IIOT-BRIDGE-TARGET", `سامانهٔ مقصد ناشناخته: ${normalized.TargetSystem || "(خالی)"}`);
  }
  if (!normalized.EventType || !IIOT_BRIDGE_EVENT_TYPES.includes(normalized.EventType)) {
    throw new IiotBridgeError("E-IIOT-BRIDGE-EVENT", `نوع رویداد پشتیبانی‌نشده: ${normalized.EventType || "(خالی)"}`);
  }
  const key = String(normalized.IdempotencyKey ?? "").trim();
  if (!key) throw new IiotBridgeError("E-IIOT-BRIDGE-KEY", "رویداد بدون کلید تکرارناپذیر پذیرفته نمی‌شود");

  const context = {
    payload: { ...payload, eventTypeSuffix: normalized.EventType === "downtime.npt" ? "npt" : normalized.EventType.split(".").pop() },
    key,
    occurredAt: asIso(normalized.OccurredAt) ?? new Date().toISOString(),
    actor,
  };
  switch (target) {
    case "cmms": return applyToCmms(store, context);
    case "mes": return applyToMes(store, context);
    case "pmis": return applyToPmis(store, context);
    default:
      /* از نظر منطقی نرسیدنی — فهرست بالا همین سه مقدار را پذیرفته است. */
      throw new IiotBridgeError("E-IIOT-BRIDGE-TARGET", `سامانهٔ مقصد ناشناخته: ${target}`);
  }
}

/* ═══════════════════════ مسیرهای REST پل ═══════════════════════ */

/**
 * مسیرهای REST برای استقرار جداشده: وقتی IIoT و CMMS/MES/PMIS در فرآیندهای
 * جدا هستند، رویداد از اینجا وارد می‌شود. قرارداد دقیقاً همان
 * `applyIiotIntegrationEvent` است — همان تابع، دو ورودی.
 */
export function registerIiotBridgeRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app || typeof app.post !== "function") throw new TypeError("Express-compatible app is required");
  /* تابع دسترسی یا خود مخزن — هر دو پذیرفته‌اند. */
  if (typeof repo !== "function" && (!repo || typeof repo.create !== "function")) {
    throw new TypeError("IIoT bridge repository is required");
  }
  if (!Array.isArray(subjects) || typeof evaluate !== "function") throw new TypeError("IIoT bridge RBAC dependencies are required");

  const handle = (target) => async (req, res) => {
    try {
      const permission = IIOT_BRIDGE_EVENT_PERMISSIONS[target];
      const userId = String(req.headers?.["x-user-id"] ?? "").trim();
      const subject = userId ? subjects.find((item) => item.id === userId && item.active !== false) ?? null : null;
      if (!subject) {
        return res.status(401).json({ ok: false, error: { code: "IIOT_AUTH_REQUIRED", message: "هویت کاربر معتبر و فعال الزامی است", traceId: req.requestId } });
      }
      const decision = evaluate(subject, permission, {});
      if (!decision.allow) {
        return res.status(403).json({ ok: false, error: { code: "IIOT_FORBIDDEN", message: "مجوز این عمل را ندارید", permission, reason: decision.code, traceId: req.requestId } });
      }
      const outcome = await applyIiotIntegrationEvent({ repo, event: req.body ?? {}, actor: subject.id });
      return res.status(outcome.alreadyApplied ? 200 : 201).json({
        ok: true,
        data: { target, ...outcome, model: IIOT_BRIDGE_MODEL },
        meta: { traceId: req.requestId },
      });
    } catch (err) {
      if (err instanceof IiotBridgeError) {
        const status = err.code.includes("MISSING") || err.code.includes("UNKNOWN") ? 422 : 400;
        return res.status(status).json({ ok: false, error: { code: err.code, message: err.messageFa, ...err.extra, traceId: req.requestId } });
      }
      if (err?.code === "ROW_VALIDATION_FAILED") {
        return res.status(400).json({ ok: false, error: { code: "IIOT_VALIDATION_FAILED", message: err.message, issues: err.issues, traceId: req.requestId } });
      }
      console.error("[%s] IIoT bridge error:", req.requestId, err);
      return res.status(500).json({ ok: false, error: { code: "IIOT_BRIDGE_INTERNAL_ERROR", message: "خطای داخلی پل یکپارچگی", traceId: req.requestId } });
    }
  };

  app.post("/api/cmms/iiot-events", handle("cmms"));
  app.post("/api/mes/iiot-events", handle("mes"));
  app.post("/api/pmis/iiot-events", handle("pmis"));

  return { routes: ["POST /api/cmms/iiot-events", "POST /api/mes/iiot-events", "POST /api/pmis/iiot-events"], model: IIOT_BRIDGE_MODEL };
}
