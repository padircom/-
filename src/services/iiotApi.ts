/**
 * کلاینت یکپارچهٔ سامانهٔ پایش میدانی و اینترنت اشیاء صنعتی (iiot-api-v1).
 * ═══════════════════════════════════════════════════════════════════════
 * پوشش ۴۸ مسیر REST در `server/iiotApi.js` با دامنهٔ دکل (`rigId`)، هدر هویت
 * (`x-user-id`) و قفل خوش‌بینانه (`If-Match`).
 *
 * سه نکتهٔ طراحی:
 *   • هیچ قاعدهٔ کسب‌وکاری اینجا نیست — هر عددی که نمایش داده می‌شود از
 *     سرور می‌آید. سمت کلاینت فقط مجوز را پیش‌بینی می‌کند تا دکمهٔ بی‌اجازه
 *     غیرفعال شود؛ تصمیم نهایی همیشه با سرور است.
 *   • کلیدهای ردیف PascalCase‌اند (قرارداد لایهٔ ماندگاری) و فقط در لبهٔ
 *     نمایش به فارسی/انگلیسی نگاشت می‌شوند.
 *   • واحد و برچسب سیگنال‌ها در `IIOT_SIGNAL_META` آمده تا گیج‌ها بدون
 *     حدس‌زدن، واحد درست نشان دهند.
 */

import { DEMO_SUBJECTS, evaluate, type Decision, type Subject } from "./accessControl";

export const DEFAULT_RIG_ID = "RIG-DEMO";

/** سه نقش بخش ۵ — همان سوژه‌های آزمایشی که در RBAC تعریف شده‌اند. */
export const IIOT_DEMO_USERS: Array<{
  id: string;
  role: string;
  fa: string;
  en: string;
  clearance: string;
}> = [
  { id: "u-iiot-eng", role: "iiot_engineer", fa: "مهندس IIoT (پیکربندی قاعده/پذیرش تله‌متری/گزارش توقف)", en: "IIoT Engineer (rule config / ingest / downtime report)", clearance: "confidential" },
  { id: "u-iiot-driller", role: "drilling_supervisor", fa: "سرپرست حفاری (تأیید/رفع/ارسال هشدار و راستی‌آزمایی NPT)", en: "Drilling Supervisor (alert ack/resolve/dispatch, NPT verify)", clearance: "restricted" },
  { id: "u-iiot-tech", role: "field_iot_technician", fa: "تکنسین میدان (همگام‌سازی بافر، کالیبراسیون، پایش وضعیت)", en: "Field IoT Technician (buffer sync, calibration, CBM)", clearance: "confidential" },
];

export function findIiotSubject(userId?: string | null): Subject | null {
  if (!userId) return null;
  return DEMO_SUBJECTS.find((s) => s.id === userId) ?? null;
}

/** دامنهٔ IIoT دکل‌محور است و از مسیر `plantIds` ارزیابی می‌شود. */
export function evaluateIiotAccess(
  userId: string | null | undefined,
  permission: string,
  rigId: string = DEFAULT_RIG_ID,
): Decision {
  const subject = findIiotSubject(userId);
  if (!subject) {
    return {
      allow: false,
      code: "DENY_INACTIVE",
      reason: { fa: "کاربر احراز هویت نشده است", en: "Unauthenticated user" },
      audit: true,
    };
  }
  return evaluate(subject, permission, { plantId: rigId });
}

export function canIiotAccess(
  userId: string | null | undefined,
  permission: string,
  rigId: string = DEFAULT_RIG_ID,
): boolean {
  return evaluateIiotAccess(userId, permission, rigId).allow;
}

/* ═══════════════════════ خطاها ═══════════════════════ */

export interface IiotApiError {
  code: string;
  message: string;
  traceId?: string;
  status: number;
  issues?: Array<{ field: string; message: string }>;
}

export class IiotRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId?: string;
  readonly issues?: IiotApiError["issues"];

  constructor(err: IiotApiError) {
    super(err.message || err.code);
    this.name = "IiotRequestError";
    this.code = err.code;
    this.status = err.status;
    this.traceId = err.traceId;
    this.issues = err.issues;
  }
}

export interface IiotRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  userId?: string | null;
  ifMatch?: number | string | null;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(rigId: string, subPath: string, query?: IiotRequestOptions["query"]): string {
  const base = `/api/iiot/rigs/${encodeURIComponent(rigId)}${subPath}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function iiotFetch<T = any>(rigId: string, subPath: string, opts: IiotRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.userId) headers["x-user-id"] = opts.userId;
  if (opts.ifMatch !== undefined && opts.ifMatch !== null && String(opts.ifMatch).trim() !== "") {
    headers["If-Match"] = String(opts.ifMatch);
  }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(buildUrl(rigId, subPath, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.ok === false) {
    const errObj = payload?.error ?? {};
    throw new IiotRequestError({
      code: errObj.code || `HTTP_${res.status}`,
      message: errObj.message || `خطای ارتباط با سرور (${res.status})`,
      traceId: errObj.traceId,
      status: res.status,
      issues: errObj.issues,
    });
  }
  return payload.data as T;
}

/* ═══════════════════════ انواع ردیف‌ها ═══════════════════════ */

export type IiotSignalType =
  | "wob" | "rpm" | "torque" | "mud-pump-pressure" | "flow-rate" | "temperature"
  | "vibration" | "rop" | "depth" | "standpipe-pressure" | "hookload" | "gas";

export const IIOT_SIGNAL_LIST: IiotSignalType[] = [
  "wob", "rpm", "torque", "mud-pump-pressure", "flow-rate", "temperature",
  "vibration", "rop", "depth", "standpipe-pressure", "hookload", "gas",
];

/** برچسب/واحد/محدودهٔ نمایشی هر سیگنال — فقط برای نمایش، نه محاسبه. */
export const IIOT_SIGNAL_META: Record<IiotSignalType, {
  fa: string; en: string; uom: string; shortFa: string; max?: number; decimals?: number;
}> = {
  wob: { fa: "وزن روی مته", en: "Weight on Bit", uom: "klbf", shortFa: "WOB", max: 60, decimals: 1 },
  rpm: { fa: "دور مته", en: "Rotary Speed", uom: "rpm", shortFa: "RPM", max: 200, decimals: 0 },
  torque: { fa: "گشتاور", en: "Torque", uom: "kft·lb", shortFa: "TORQUE", max: 40, decimals: 1 },
  "mud-pump-pressure": { fa: "فشار پمپ گل", en: "Mud Pump Pressure", uom: "psi", shortFa: "SPP", max: 5000, decimals: 0 },
  "flow-rate": { fa: "دبی جریان", en: "Flow Rate", uom: "gpm", shortFa: "FLOW", max: 1500, decimals: 0 },
  temperature: { fa: "دما", en: "Temperature", uom: "°C", shortFa: "TEMP", max: 200, decimals: 1 },
  vibration: { fa: "ارتعاش", en: "Vibration", uom: "mm/s", shortFa: "VIB", max: 30, decimals: 2 },
  rop: { fa: "نرخ نفوذ", en: "Rate of Penetration", uom: "m/h", shortFa: "ROP", max: 60, decimals: 1 },
  depth: { fa: "عمق چاه", en: "Depth", uom: "m", shortFa: "DEPTH", max: 6000, decimals: 0 },
  "standpipe-pressure": { fa: "فشار لولهٔ قائم", en: "Standpipe Pressure", uom: "psi", shortFa: "SP", max: 5000, decimals: 0 },
  hookload: { fa: "بار هوک", en: "Hookload", uom: "klbf", shortFa: "HOOK", max: 500, decimals: 0 },
  gas: { fa: "گاز گل", en: "Gas Units", uom: "%", shortFa: "GAS", max: 100, decimals: 1 },
};

export interface IiotRow {
  Id: string;
  RowVersion: number;
  RigId?: string;
  [key: string]: unknown;
}

/** دکل حفاری — ریشهٔ دامنهٔ IIoT (نام‌ها همان ستون‌های جدول `IotDrillingRig`). */
export interface IiotDrillingRig extends IiotRow {
  RigId: string;
  RigNo: string;
  NameFa: string;
  NameEn?: string | null;
  RigType?: string | null;
  Status: string;
  FieldName?: string | null;
  WellName?: string | null;
  CmmsSiteRef?: string | null;
  MesWorkCenterRef?: string | null;
  PmisProjectRef?: string | null;
  TimeZoneId?: string | null;
  NominalSampleRateHz?: number | null;
  CurrentDepthM?: number | null;
  TargetDepthM?: number | null;
  IsActive?: boolean | null;
}

export interface IiotEdgeGateway extends IiotRow {
  GatewayCode: string;
  NameFa: string;
  Protocol?: string | null;
  SyncMode?: string | null;
  BufferCapacity?: number | null;
  BufferUsed?: number | null;
  MaxBatchSize?: number | null;
  MaxAttempts?: number | null;
  ConnectionState?: string | null;
  LastHeartbeatAt?: string | null;
  LastSyncAt?: string | null;
  FirmwareVersion?: string | null;
  IsActive?: boolean | null;
}

/** خلاصهٔ گیت‌وی در پاسخ `/dashboard` (شکل تخت، نه ردیف کامل). */
export interface IiotGatewaySummary {
  id: string;
  code: string;
  nameFa: string;
  connectionState: string | null;
  bufferUsed: number;
  bufferCapacity: number;
  fillPct: number;
  lastHeartbeatAt: string | null;
  lastSyncAt: string | null;
}

export interface IiotSensorNode extends IiotRow {
  SensorTag: string;
  NameFa: string;
  SensorType?: string | null;
  Manufacturer?: string | null;
  ModelNo?: string | null;
  SerialNo?: string | null;
  Unit?: string | null;
  RangeMin?: number | null;
  RangeMax?: number | null;
  LocationFa?: string | null;
  GatewayId?: string | null;
  InstalledAt?: string | null;
  LastCalibratedAt?: string | null;
  NextCalibrationDue?: string | null;
  CalibrationIntervalDays?: number | null;
  Status: string;
  /** محاسبهٔ سرور در `GET /sensors`: تاریخ کالیبراسیون گذشته است. */
  calibrationOverdue?: boolean;
}

export interface IiotDrillingRigStream extends IiotRow {
  StreamCode: string;
  NameFa: string;
  SourceSystem?: string | null;
  GatewayId?: string | null;
  TransportProtocol?: string | null;
  SampleRateHz?: number | null;
  BatchSize?: number | null;
  ConnectionState?: string | null;
  LastSampleAt?: string | null;
  QualityPct?: number | null;
  IsActive?: boolean | null;
}

export interface IotDasChannel extends IiotRow {
  ChannelCode: string;
  NameFa: string;
  NameEn?: string | null;
  SignalType: IiotSignalType;
  StreamId?: string | null;
  Unit: string;
  NominalMin?: number | null;
  NominalMax?: number | null;
  NominalValue?: number | null;
  DisplayMin?: number | null;
  DisplayMax?: number | null;
  SampleRateHz?: number | null;
  FilterMethod?: string | null;
  FilterWindowSeconds?: number | null;
  DeadbandPct?: number | null;
  SensorTag?: string | null;
  WitsmlMnemonic?: string | null;
  IsCritical?: boolean | null;
  IsActive?: boolean | null;
  InstalledLocationFa?: string | null;
  NextCalibrationDue?: string | null;
  LastValueAt?: string | null;
  LastValue?: number | null;
  LastQuality?: string | null;
  /** افزودهٔ `GET /channels` — رنگ وضعیت از آستانه‌های سرور ساخته می‌شود. */
  thresholds?: Array<{ level: string; value: number | null; kind?: string | null }>;
  status?: string;
}

export interface IiotSignalFilterRule extends IiotRow {
  RuleCode: string;
  NameFa: string;
  AppliesToSignals?: string | null;
  FilterMethod: string;
  WindowSeconds?: number | null;
  EmaAlpha?: number | null;
  MinSamples?: number | null;
  DeadbandPct?: number | null;
  SpikeZThreshold?: number | null;
  FlatlineSeconds?: number | null;
  IsDefault?: boolean | null;
  Version?: number | null;
  IsActive?: boolean | null;
}

export interface IiotThresholdRule extends IiotRow {
  RuleCode: string;
  NameFa: string;
  ChannelId: string;
  Level: "warning" | "critical";
  DetectKind?: string | null;
  Comparison?: string | null;
  ThresholdValue?: number | null;
  SecondaryValue?: number | null;
  DurationSeconds?: number | null;
  MinSamples?: number | null;
  HysteresisPct?: number | null;
  CooldownSeconds?: number | null;
  TorqueCvThreshold?: number | null;
  RpmSwingPctThreshold?: number | null;
  PressureDropPctThreshold?: number | null;
  AutoDispatch?: boolean | null;
  DispatchTargets?: string | null;
  CmmsSiteRef?: string | null;
  MesWorkCenterRef?: string | null;
  PmisProjectRef?: string | null;
  NptCode?: string | null;
  Version?: number | null;
  IsActive?: boolean | null;
}

export type IiotAlertStatus = "active" | "acknowledged" | "resolved" | "suppressed" | "false-positive";

export interface IiotTelemetryAlert extends IiotRow {
  AlertCode: string;
  ChannelId: string;
  RuleId?: string | null;
  DetectionKind?: string | null;
  Level: "warning" | "critical";
  TitleFa?: string | null;
  MessageFa?: string | null;
  Status: IiotAlertStatus;
  DetectedAt: string;
  TriggeredAt?: string | null;
  ResolvedAt?: string | null;
  TriggerValue?: number | null;
  FilteredValue?: number | null;
  BaselineValue?: number | null;
  DeviationPct?: number | null;
  SampleCount?: number | null;
  DurationSeconds?: number | null;
  DispatchStatus?: string | null;
  CmmsWorkOrderRef?: string | null;
  MesDowntimeRef?: string | null;
  PmisEventRef?: string | null;
  AcknowledgedAt?: string | null;
  AcknowledgedById?: string | null;
  ResolutionNoteFa?: string | null;
  /** افزودهٔ `GET /alerts` — کانال هشدار با واحد و نام. */
  channel?: { code: string; nameFa: string; signalType: string; unit: string } | null;
}

export interface IiotRigDowntime extends IiotRow {
  DowntimeCode: string;
  Category: string;
  DowntimeType: string;
  NptCode?: string | null;
  CauseFa: string;
  EffectFa?: string | null;
  StartedAt: string;
  EndedAt?: string | null;
  DurationMinutes?: number | null;
  IsNpt?: boolean | null;
  RecoverableMinutes?: number | null;
  ResponsibilityFa?: string | null;
  DetectedBy?: string | null;
  VerifiedById?: string | null;
  VerifiedAt?: string | null;
  ReportedToMes?: boolean | null;
  ReportedToPmis?: boolean | null;
  AlertId?: string | null;
  PmisClaimRef?: string | null;
}

export interface IiotIntegrationEvent extends IiotRow {
  EventType: string;
  TargetSystem: string;
  Contract?: string | null;
  Status: "pending" | "dispatched" | "failed" | "dead-letter";
  IdempotencyKey: string;
  SourceTable?: string | null;
  SourceId?: string | null;
  Attempts?: number | null;
  MaxAttempts?: number | null;
  DeliveredAt?: string | null;
  ErrorCode?: string | null;
  ErrorFa?: string | null;
  OccurredAt?: string | null;
  PayloadJson?: Record<string, unknown> | null;
}

export interface IiotConditionSnapshot extends IiotRow {
  CmmsAssetRef?: string | null;
  SensorTag?: string | null;
  ReadingType: string;
  Value: number;
  Uom: string;
  Zone?: string | null;
  MeasuredAt?: string | null;
  MeasuredOn?: string | null;
  HealthIndex?: number | null;
  TrendDirection?: string | null;
  Source?: string | null;
  ReportedToCmms?: boolean | null;
}

export interface IiotGatewayBuffer extends IiotRow {
  GatewayId: string;
  BatchNo: string;
  Status: "buffered" | "sending" | "sent" | "failed" | "dead-letter";
  SampleCount?: number | null;
  Checksum?: string | null;
  CapturedAt?: string | null;
  FromAt?: string | null;
  ToAt?: string | null;
  Attempts?: number | null;
  MaxAttempts?: number | null;
  SentAt?: string | null;
  ErrorCode?: string | null;
  ErrorFa?: string | null;
}

/* ═══════════════════════ پاسخ‌های ترکیبی ═══════════════════════ */

/** نقطهٔ سری خام — همان شکل `points` در `GET /telemetry`. */
export interface IiotTelemetryPoint {
  at: string;
  value: number | null;
  /** مقدار فیلترشده؛ سرور در مسیر SQL یا با غنی‌سازی می‌دهد. */
  filtered?: number | null;
  quality?: string | null;
  channelCode?: string | null;
  signalType?: string | null;
}

/** نقطهٔ کوچک‌شده برای نمودار (`downsample=true`) — جفت min/max هر پیمانه. */
export interface IiotChartBucket {
  at: string;
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface IiotRollupBucket {
  bucketStart: string;
  bucketSeconds: number;
  sampleCount: number;
  badCount?: number;
  minValue: number | null;
  maxValue: number | null;
  avgValue: number | null;
  stdDev?: number | null;
  firstValue?: number | null;
  lastValue?: number | null;
  qualityPct?: number | null;
}

export interface IiotTelemetryResponse {
  /** خلاصهٔ کانال انتخاب‌شده، یا `null` وقتی کل دکل خوانده شود. */
  channel: { id: string; code: string; signalType: string; unit: string } | null;
  points: IiotTelemetryPoint[];
  buckets: IiotRollupBucket[];
  total: number;
  from: string;
  to: string;
  tsDriver: string | null;
}

/** یک ردیف `GET /telemetry/latest` — شکل تخت، نه کانال تودرتو. */
export interface IiotLatestChannel {
  channelId: string;
  channelCode: string;
  nameFa: string;
  signalType: string;
  unit: string;
  value: number | null;
  at: string | null;
  quality?: string | null;
  isCritical?: boolean;
  displayMin?: number | null;
  displayMax?: number | null;
  status: "normal" | "warning" | "critical";
}

export interface IiotLatestResponse {
  channels: IiotLatestChannel[];
  counts: Record<string, number>;
  asOf: string;
}

export interface IiotIngestResponse {
  rigId: string;
  accepted: number;
  rejected: Array<{ index: number; channelCode?: string; code?: string; messageFa?: string; reason?: string }>;
  unknownChannels: string[];
  channels: number;
  filterStats: Array<{ channelCode: string; samples: number; [key: string]: unknown }>;
  timeSeries: { ok?: boolean; accepted?: number; driver?: string | null; error?: unknown } | null;
  rollups: number;
  alerts: { created: IiotTelemetryAlert[]; resolved: IiotTelemetryAlert[]; suppressed: unknown[]; dispatched: unknown[] };
  at: string;
  tsDriver: string | null;
}

export interface IiotBufferPostResponse {
  duplicated: boolean;
  retried?: boolean;
  bufferId: string;
  batchNo: string;
  status: IiotGatewayBuffer["Status"];
  checksum?: string;
  accepted?: number;
  ingest?: IiotIngestResponse | null;
}

export interface IiotDispatchResponse {
  alertId?: string;
  results: Array<{ target: string; eventId: string; duplicated: boolean; delivered: boolean; error?: { code: string; messageFa: string } | null }>;
  delivered: number;
  total: number;
}

export interface IiotNptSummary {
  rigId: string;
  totalMinutes: number;
  productiveMinutes?: number;
  nptMinutes: number;
  plannedMinutes: number;
  nptPct: number;
  byCategory: Array<{ category: string; nptCode: string | null; minutes: number; count?: number; responsibilityFa: string | null }>;
  openCount: number;
  modelVersion: string;
  claimThresholdMinutes: number;
  claimCandidates: Array<{
    downtimeId: string; code: string; minutes: number; category: string;
    nptCode: string | null; responsibilityFa: string | null; pmisClaimRef: string | null;
  }>;
  asOf: string;
}

/** یک گیج داشبورد — خروجی تختِ `GET /dashboard`. */
export interface IiotDashboardGauge {
  channelId: string;
  channelCode: string;
  nameFa: string;
  signalType: IiotSignalType;
  unit: string;
  value: number | null;
  at: string | null;
  /** کهنگی داده: حسگر ساکت، «سبز» نیست. */
  stale: boolean;
  isCritical: boolean;
  displayMin?: number | null;
  displayMax?: number | null;
  nominalValue?: number | null;
  status: "normal" | "warning" | "critical";
  thresholds: Array<{ level: string; value: number | null; kind?: string | null }>;
}

export interface IiotDashboard {
  rig: IiotDrillingRig;
  asOf: string;
  gauges: IiotDashboardGauge[];
  statusCounts: Record<string, number>;
  activeAlerts: IiotTelemetryAlert[];
  alertCounts: Record<string, number>;
  gateways: IiotGatewaySummary[];
  storeAndForward: {
    pendingBatches: number;
    deadLetterBatches: number;
    oldestBufferAt: string | null;
    connectivityOnline: boolean;
  };
  npt: IiotNptSummary | null;
  integration: { pending: number; dispatched: number; failed: number; transportConfigured: boolean };
  tsDriver: string | null;
  modelVersion: string;
  requestId: string;
}

export interface IiotRuleTestResponse {
  dryRun: true;
  rule: IiotThresholdRule;
  channel: IotDasChannel | null;
  sampleCount: number;
  verdict: { status: string; statusColor: string; level?: string | null };
  stickSlip?: Record<string, unknown> | null;
  pumpDrop?: Record<string, unknown> | null;
  wouldAlert: boolean;
}

/* ═══════════════════════ فراخوانی‌ها ═══════════════════════ */

export async function iiotListRigs(opts: IiotRequestOptions = {}): Promise<{ rigs: IiotDrillingRig[]; total: number }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.userId) headers["x-user-id"] = opts.userId;
  const res = await fetch("/api/iiot/rigs", { headers });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.ok === false) {
    const errObj = payload?.error ?? {};
    throw new IiotRequestError({
      code: errObj.code || `HTTP_${res.status}`,
      message: errObj.message || `خطای ارتباط با سرور (${res.status})`,
      traceId: errObj.traceId,
      status: res.status,
    });
  }
  return payload.data;
}

/** ساخت دکل — تنها مسیر بیرون از دامنهٔ `/rigs/:rigId`. */
export async function iiotCreateRig(body: Record<string, unknown>, opts: IiotRequestOptions = {}): Promise<IiotDrillingRig> {
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (opts.userId) headers["x-user-id"] = opts.userId;
  const res = await fetch("/api/iiot/rigs", { method: "POST", headers, body: JSON.stringify(body) });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.ok === false) {
    const errObj = payload?.error ?? {};
    throw new IiotRequestError({
      code: errObj.code || `HTTP_${res.status}`,
      message: errObj.message || `خطای ارتباط با سرور (${res.status})`,
      traceId: errObj.traceId,
      status: res.status,
      issues: errObj.issues,
    });
  }
  return payload.data as IiotDrillingRig;
}

export function iiotGetRig(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ rig: IiotDrillingRig; counts: Record<string, number>; requestId: string }>(rigId, "", opts);
}

export function iiotPatchRig(rigId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotDrillingRig>(rigId, "", { ...opts, method: "PATCH", body });
}

export function iiotListStreams(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ streams: IiotDrillingRigStream[]; total: number }>(rigId, "/streams", opts);
}

export function iiotCreateStream(rigId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotDrillingRigStream>(rigId, "/streams", { ...opts, method: "POST", body });
}

export function iiotPatchStream(rigId: string, streamId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotDrillingRigStream>(rigId, `/streams/${encodeURIComponent(streamId)}`, { ...opts, method: "PATCH", body });
}

export function iiotListChannels(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ channels: IotDasChannel[]; total: number }>(rigId, "/channels", opts);
}

export function iiotCreateChannel(rigId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IotDasChannel>(rigId, "/channels", { ...opts, method: "POST", body });
}

export function iiotGetChannel(rigId: string, channelId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ channel: IotDasChannel }>(rigId, `/channels/${encodeURIComponent(channelId)}`, opts);
}

export function iiotPatchChannel(rigId: string, channelId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IotDasChannel>(rigId, `/channels/${encodeURIComponent(channelId)}`, { ...opts, method: "PATCH", body });
}

export interface IiotSampleInput {
  channelCode: string;
  value: number;
  at?: string;
  quality?: string;
  source?: string;
}

export function iiotIngestTelemetry(rigId: string, samples: IiotSampleInput[], opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotIngestResponse>(rigId, "/telemetry", { ...opts, method: "POST", body: { samples } });
}

export function iiotGetTelemetry(
  rigId: string,
  channelId: string,
  query: { from?: string; to?: string; limit?: number; downsample?: boolean; bucketSeconds?: number } = {},
  opts: IiotRequestOptions = {},
) {
  return iiotFetch<IiotTelemetryResponse>(rigId, "/telemetry", { ...opts, query: { channelId, ...query } });
}

export function iiotGetTelemetryLatest(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotLatestResponse>(rigId, "/telemetry/latest", opts);
}

export function iiotComputeRollups(
  rigId: string,
  body: { channelId: string; from?: string; to?: string; bucketSeconds?: number },
  opts: IiotRequestOptions = {},
) {
  return iiotFetch<{ channel: IotDasChannel | null; samples: number; buckets: Array<Record<string, unknown>>; bucketSeconds: number }>(
    rigId, "/telemetry/rollups", { ...opts, method: "POST", body },
  );
}

export function iiotListFilterRules(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ filterRules: IiotSignalFilterRule[]; total: number }>(rigId, "/filter-rules", opts);
}

export function iiotCreateFilterRule(rigId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotSignalFilterRule>(rigId, "/filter-rules", { ...opts, method: "POST", body });
}

export function iiotPatchFilterRule(rigId: string, ruleId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotSignalFilterRule>(rigId, `/filter-rules/${encodeURIComponent(ruleId)}`, { ...opts, method: "PATCH", body });
}

export function iiotListThresholdRules(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ thresholdRules: IiotThresholdRule[]; total: number }>(rigId, "/threshold-rules", opts);
}

export function iiotCreateThresholdRule(rigId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotThresholdRule>(rigId, "/threshold-rules", { ...opts, method: "POST", body });
}

export function iiotPatchThresholdRule(rigId: string, ruleId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotThresholdRule>(rigId, `/threshold-rules/${encodeURIComponent(ruleId)}`, { ...opts, method: "PATCH", body });
}

export function iiotTestThresholdRule(rigId: string, ruleId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotRuleTestResponse>(rigId, `/threshold-rules/${encodeURIComponent(ruleId)}/test`, { ...opts, method: "POST", body: {} });
}

export function iiotListAlerts(
  rigId: string,
  query: { status?: string; level?: string; channelId?: string; limit?: number } = {},
  opts: IiotRequestOptions = {},
) {
  return iiotFetch<{ alerts: IiotTelemetryAlert[]; total: number; counts: Record<string, number> }>(rigId, "/alerts", { ...opts, query });
}

export function iiotAcknowledgeAlert(rigId: string, alertId: string, body: Record<string, unknown> = {}, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotTelemetryAlert>(rigId, `/alerts/${encodeURIComponent(alertId)}/acknowledge`, { ...opts, method: "POST", body });
}

export function iiotResolveAlert(rigId: string, alertId: string, body: Record<string, unknown> = {}, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ alert: IiotTelemetryAlert; [k: string]: unknown }>(rigId, `/alerts/${encodeURIComponent(alertId)}/resolve`, { ...opts, method: "POST", body });
}

export function iiotFalsePositiveAlert(rigId: string, alertId: string, body: Record<string, unknown> = {}, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ alert: IiotTelemetryAlert; [k: string]: unknown }>(rigId, `/alerts/${encodeURIComponent(alertId)}/false-positive`, { ...opts, method: "POST", body });
}

export function iiotDispatchAlert(rigId: string, alertId: string, body: Record<string, unknown> = {}, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotDispatchResponse>(rigId, `/alerts/${encodeURIComponent(alertId)}/dispatch`, { ...opts, method: "POST", body });
}

export function iiotListGateways(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ gateways: IiotEdgeGateway[]; total: number }>(rigId, "/gateways", opts);
}

export function iiotCreateGateway(rigId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotEdgeGateway>(rigId, "/gateways", { ...opts, method: "POST", body });
}

export function iiotPatchGateway(rigId: string, gatewayId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotEdgeGateway>(rigId, `/gateways/${encodeURIComponent(gatewayId)}`, { ...opts, method: "PATCH", body });
}

export function iiotGatewayHeartbeat(rigId: string, gatewayId: string, body: Record<string, unknown> = {}, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotEdgeGateway>(rigId, `/gateways/${encodeURIComponent(gatewayId)}/heartbeat`, { ...opts, method: "POST", body });
}

export function iiotListBuffer(rigId: string, gatewayId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{
    buffer: IiotGatewayBuffer[]; total: number;
    readyToSync: IiotGatewayBuffer[];
    counts: { buffered: number; failed: number; deadLetter: number; sent: number };
  }>(rigId, `/gateways/${encodeURIComponent(gatewayId)}/buffer`, opts);
}

export function iiotPostBuffer(
  rigId: string,
  gatewayId: string,
  body: { batchNo?: string; capturedAt?: string; samples: IiotSampleInput[]; checksum?: string; connectivityState?: string; retried?: number },
  opts: IiotRequestOptions = {},
) {
  return iiotFetch<IiotBufferPostResponse>(rigId, `/gateways/${encodeURIComponent(gatewayId)}/buffer`, { ...opts, method: "POST", body });
}

export function iiotSyncBuffer(rigId: string, gatewayId: string, bufferId: string, body: Record<string, unknown> = {}, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ buffer: IiotGatewayBuffer; transition: Record<string, unknown> }>(
    rigId, `/gateways/${encodeURIComponent(gatewayId)}/buffer/${encodeURIComponent(bufferId)}/sync`, { ...opts, method: "POST", body },
  );
}

export function iiotListSensors(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ sensors: IiotSensorNode[]; total: number; counts: Record<string, number> }>(rigId, "/sensors", opts);
}

export function iiotCreateSensor(rigId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotSensorNode>(rigId, "/sensors", { ...opts, method: "POST", body });
}

export function iiotPatchSensor(rigId: string, sensorId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotSensorNode>(rigId, `/sensors/${encodeURIComponent(sensorId)}`, { ...opts, method: "PATCH", body });
}

export function iiotCalibrateSensor(
  rigId: string,
  sensorId: string,
  body: { calibratedAt?: string; certificateNo?: string; resultFa?: string; RowVersion?: number },
  opts: IiotRequestOptions = {},
) {
  return iiotFetch<{ sensor: IiotSensorNode; nextCalibrationDue: string | null }>(
    rigId, `/sensors/${encodeURIComponent(sensorId)}/calibration`, { ...opts, method: "POST", body },
  );
}

export function iiotListConditionSnapshots(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ snapshots: IiotConditionSnapshot[]; total: number; unreported: number }>(rigId, "/condition-snapshots", opts);
}

export function iiotCreateConditionSnapshot(rigId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotConditionSnapshot>(rigId, "/condition-snapshots", { ...opts, method: "POST", body });
}

export function iiotListDowntime(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ downtime: IiotRigDowntime[]; total: number; openCount: number }>(rigId, "/downtime", opts);
}

export function iiotCreateDowntime(rigId: string, body: Record<string, unknown>, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotRigDowntime>(rigId, "/downtime", { ...opts, method: "POST", body });
}

export function iiotCloseDowntime(rigId: string, downtimeId: string, body: Record<string, unknown> = {}, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotRigDowntime>(rigId, `/downtime/${encodeURIComponent(downtimeId)}/close`, { ...opts, method: "POST", body });
}

export function iiotVerifyDowntime(rigId: string, downtimeId: string, body: Record<string, unknown> = {}, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ downtime: IiotRigDowntime; dispatched: Array<{ target: string; eventId: string; duplicated: boolean; delivered: boolean; error?: unknown }> }>(
    rigId, `/downtime/${encodeURIComponent(downtimeId)}/verify`, { ...opts, method: "POST", body },
  );
}

export function iiotGetNptSummary(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotNptSummary>(rigId, "/npt/summary", opts);
}

export function iiotListIntegrationEvents(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{
    events: IiotIntegrationEvent[]; total: number;
    counts: Record<string, number>; transportConfigured: boolean;
  }>(rigId, "/integration/events", opts);
}

export function iiotDispatchEvent(rigId: string, eventId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<{ event: IiotIntegrationEvent; result: IiotDispatchResponse["results"][number] }>(
    rigId, `/integration/events/${encodeURIComponent(eventId)}/dispatch`, { ...opts, method: "POST", body: {} },
  );
}

export function iiotGetDashboard(rigId: string, opts: IiotRequestOptions = {}) {
  return iiotFetch<IiotDashboard>(rigId, "/dashboard", opts);
}
