/**
 * منطق خالص داشبورد زندهٔ پایش میدانی و IIoT & DAS (iiot-dashboard-v1)
 * ═══════════════════════════════════════════════════════════════════════
 * چهار تصمیم طراحی:
 *
 * ۱) **این فایل هیچ React و هیچ DOM نمی‌شناسد.** هر عددی که در صفحه دیده
 *    می‌شود از سرور می‌آید؛ اینجا فقط «تبدیل شکل» است: وضعیت سرور → چراغ
 *    رنگی، سری زمانی → هندسهٔ SVG، ردیف بافر → خلاصهٔ وضعیت. به همین دلیل
 *    `server/iiot.dashboard.test.mjs` می‌تواند همین منطق را مستقیم در Node
 *    بیازماید — نه با رندر کردن یک کامپوننت.
 *
 * ۲) **مرز مجوز سمت کلاینت، فقط برای غیرفعال‌کردن دکمه است.** نگاشت
 *    اکشن → مجوز در `IIOT_ACTION_PERMISSIONS` یک‌جا نشسته و از همان موتور
 *    RBAC (`canIiotAccess`) می‌خواند. تصمیم نهایی همیشه با سرور است؛ اگر
 *    ماتریس نقش‌ها عوض شود، هر دو طرف یکجا عوض می‌شوند.
 *
 * ۳) **دکل نمونه از راه REST ساخته می‌شود، نه با اسکریپت seed.** طرح ساخت
 *    (`buildDemoRigPlan`) دادهٔ خالص است و گره‌زدن شناسه‌ها در
 *    `resolveDemoRigPlan` انجام می‌شود؛ پس ترتیب وابستگی‌ها
 *    (گیت‌وی → جریان → کانال → قاعده) در آزمون قفل می‌شود.
 *
 * ۴) **نمودار با SVG دستی کشیده می‌شود.** `buildChartGeometry` سری
 *    خام/فیلترشده را به مسیر SVG تبدیل می‌کند؛ بدون هیچ کتابخانهٔ نموداری و
 *    بدون محاسبهٔ دوبارهٔ ریاضی دامنه (فیلتر روی سرور اجرا شده است).
 */

import {
  DEFAULT_RIG_ID,
  IIOT_SIGNAL_META,
  canIiotAccess,
  type IiotSignalType,
} from "./iiotApi";

export const IIOT_DASHBOARD_VERSION = "iiot-dashboard-v1";

/* ═══════════════════════ ۱. چراغ وضعیت (سبز/زرد/قرمز) ═══════════════════════ */

/**
 * وضعیت‌های سرور: `normal` سبز · `warning` زرد · `critical` قرمز · بی‌داده
 * خاکستری. «بی‌داده» با سبز اشتباه گرفته نمی‌شود — سنسور ساکت، سالم نیست.
 */
export type IiotTone = "ok" | "warn" | "danger" | "idle";

export const IIOT_TONE_ORDER: IiotTone[] = ["danger", "warn", "ok", "idle"];

export const IIOT_TONE_LABEL: Record<IiotTone, { fa: string; en: string; glyph: string; dot: string }> = {
  ok: { fa: "سالم", en: "Normal", glyph: "●", dot: "bg-emerald-400" },
  warn: { fa: "هشدار", en: "Warning", glyph: "▲", dot: "bg-amber-400" },
  danger: { fa: "بحرانی", en: "Critical", glyph: "◆", dot: "bg-rose-500" },
  idle: { fa: "بی‌داده", en: "No data", glyph: "○", dot: "bg-slate-500" },
};

export function toneForStatus(status: string | null | undefined): IiotTone {
  switch (status) {
    case "critical": return "danger";
    case "warning": return "warn";
    case "normal": case "ok": return "ok";
    default: return "idle";
  }
}

/** رنگ قاب چراغ — همان سه رنگ، با کنتراست کافی برای سالن نمایشگر دکل. */
export const IIOT_TONE_FRAME: Record<IiotTone, string> = {
  ok: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  danger: "border-rose-500/60 bg-rose-500/10 text-rose-300",
  idle: "border-slate-500/40 bg-slate-500/10 text-slate-400",
};

/** ترتیب اهمیت برای مرتب‌سازی کارت‌ها: بحرانی‌ها اول دیده شوند. */
export function toneWeight(tone: IiotTone): number {
  return IIOT_TONE_ORDER.length - IIOT_TONE_ORDER.indexOf(tone);
}

/* ═══════════════════════ ۲. قالب‌بندی مقدار ═══════════════════════ */

export interface IiotMeasureFormat {
  /** رقم اعشار؛ اگر نیامده باشد از متادیتای سیگنال خوانده می‌شود. */
  decimals?: number;
  /** واحد اندازه‌گیری؛ فقط برای نمایش. */
  uom?: string | null;
  /** جایگزین مقدار خالی — پیش‌فرض «—». */
  fallback?: string;
}

/** مقدار عددی + واحد، بدون صفر جعلی برای «بی‌داده». */
export function formatMeasure(value: number | null | undefined, opts: IiotMeasureFormat = {}): string {
  const fallback = opts.fallback ?? "—";
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return fallback;
  const decimals = Math.max(0, Math.min(6, opts.decimals ?? 1));
  const text = Number(value).toFixed(decimals);
  return opts.uom ? `${text} ${opts.uom}` : text;
}

/** رقم اعشار پیشنهادی از متادیتای سیگنال — یک‌جا، نه پراکنده در کامپوننت‌ها. */
export function decimalsForSignal(signalType: string | null | undefined): number {
  const meta = signalType ? IIOT_SIGNAL_META[signalType as IiotSignalType] : undefined;
  return meta?.decimals ?? 1;
}

/** سقف نمایشی پیشنهادی برای گیج؛ اگر کانال سقف خودش را داشته باشد، آن مقدم است. */
export function displayRangeFor(
  signalType: string | null | undefined,
  displayMin: number | null | undefined,
  displayMax: number | null | undefined,
): { min: number; max: number } {
  const meta = signalType ? IIOT_SIGNAL_META[signalType as IiotSignalType] : undefined;
  const min = typeof displayMin === "number" && Number.isFinite(displayMin) ? displayMin : 0;
  const fallbackMax = meta?.max ?? 100;
  const max = typeof displayMax === "number" && Number.isFinite(displayMax) && displayMax > min ? displayMax : Math.max(fallbackMax, min + 1);
  return { min, max };
}

/** درصد پرشدگی گیج؛ همیشه در بازهٔ ۰..۱۰۰ کلمپ می‌شود. */
export function gaugeFillPct(value: number | null | undefined, min: number, max: number): number {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 0;
  if (!(max > min)) return 0;
  const pct = ((Number(value) - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

/** فاصلهٔ زمانی خوانا برای پرسنل شیفت («۱۲ ثانیه پیش»). */
export function formatAgeFa(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "بی‌زمان";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} ثانیه پیش`;
  if (s < 3600) return `${Math.floor(s / 60)} دقیقه پیش`;
  if (s < 86400) return `${Math.floor(s / 3600)} ساعت پیش`;
  return `${Math.floor(s / 86400)} روز پیش`;
}

/** سن داده از دو زمان ISO؛ اگر زمان نامعتبر باشد `null` (نه صفر جعلی). */
export function ageSecondsOf(iso: string | null | undefined, nowIso: string): number | null {
  if (!iso || !nowIso) return null;
  const t = Date.parse(iso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(t) || Number.isNaN(now)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}

/* ═══════════════════════ ۳. هندسهٔ نمودار SVG ═══════════════════════ */

/** یک نقطهٔ سری، همان‌گونه که `GET /telemetry?channelId=` برمی‌گرداند. */
export interface IiotChartInput {
  at: string;
  value: number | null;
  filtered?: number | null;
}

export interface IiotChartOptions {
  width?: number;
  height?: number;
  padX?: number;
  padY?: number;
  displayMin?: number | null;
  displayMax?: number | null;
}

export interface IiotChartLine {
  key: "raw" | "filtered";
  /** `points` برای `polyline` — رشتهٔ آمادهٔ SVG. */
  points: string;
  /** همان نقطه‌ها به‌صورت ساخت‌یافته (برای نشانگر آخرین مقدار). */
  vertices: Array<{ x: number; y: number; at: string; value: number }>;
}

export interface IiotChartGeometry {
  width: number;
  height: number;
  padX: number;
  padY: number;
  empty: boolean;
  sampleCount: number;
  min: number;
  max: number;
  lines: IiotChartLine[];
  yTicks: Array<{ y: number; value: number }>;
  xTickCount: number;
  firstAt: string | null;
  lastAt: string | null;
  /** مساحت زیر خط خام — پس‌زمینهٔ خوانا برای پرسنل شیفت. */
  rawArea: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * سری → هندسهٔ SVG. سه قید:
 *  • مقدارهای نامعتبر (null/NaN) نقطه نمی‌سازند ولی ترتیب زمانی را به هم نمی‌زنند.
 *  • محور Y از `displayMin/displayMax` کانال می‌آید؛ اگر داده بیرون بزند،
 *    دامنه گسترده می‌شود تا اسپایک از قاب نزند بیرون.
 *  • خط فیلترشده فقط وقتی کشیده می‌شود که سرور مقدار فیلتر داده باشد.
 */
export function buildChartGeometry(points: IiotChartInput[], opts: IiotChartOptions = {}): IiotChartGeometry {
  const width = opts.width ?? 760;
  const height = opts.height ?? 220;
  const padX = opts.padX ?? 34;
  const padY = opts.padY ?? 18;
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);

  const rows = (Array.isArray(points) ? points : []).filter((p) => p && typeof p.at === "string");
  const rawValues = rows.map((p) => p.value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const filteredValues = rows
    .map((p) => p.filtered)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const all = [...rawValues, ...filteredValues];

  const empty = all.length === 0;
  const cfgMin = typeof opts.displayMin === "number" && Number.isFinite(opts.displayMin) ? opts.displayMin : null;
  const cfgMax = typeof opts.displayMax === "number" && Number.isFinite(opts.displayMax) && (cfgMin === null || opts.displayMax > cfgMin) ? opts.displayMax : null;
  let min = cfgMin ?? (empty ? 0 : Math.min(...all));
  let max = cfgMax ?? (empty ? 1 : Math.max(...all));
  if (!empty) {
    min = Math.min(min, ...all);
    max = Math.max(max, ...all);
  }
  if (!(max > min)) max = min + 1;

  const xOf = (index: number) => (rows.length <= 1 ? padX : padX + (index / (rows.length - 1)) * innerW);
  const yOf = (value: number) => padY + innerH - ((value - min) / (max - min)) * innerH;

  const lineFor = (key: "raw" | "filtered", pick: (p: IiotChartInput) => number | null | undefined): IiotChartLine => {
    const vertices: IiotChartLine["vertices"] = [];
    rows.forEach((p, index) => {
      const value = pick(p);
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      vertices.push({ x: round2(xOf(index)), y: round2(yOf(value)), at: p.at, value });
    });
    const shifted = vertices.length === 1 ? [{ x: padX, y: vertices[0].y, at: vertices[0].at, value: vertices[0].value }, { x: padX + innerW, y: vertices[0].y, at: vertices[0].at, value: vertices[0].value }] : vertices;
    return { key, vertices, points: shifted.map((v) => `${v.x},${v.y}`).join(" ") };
  };

  const rawLine = lineFor("raw", (p) => p.value);
  const filteredLine = lineFor("filtered", (p) => p.filtered);
  /* فقط سری‌هایی که واقعاً رأس دارند به SVG می‌روند؛ `polyline` بی‌نقطه
   * یعنی «خط بیرنگ روی صفحه»، نه «بدون خط». */
  const lines = [...(rawLine.vertices.length ? [rawLine] : []), ...(filteredLine.vertices.length ? [filteredLine] : [])];

  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const value = max - ((max - min) * i) / (tickCount - 1);
    return { y: round2(padY + (innerH * i) / (tickCount - 1)), value: Math.round(value * 1000) / 1000 };
  });

  const areaBase = round2(padY + innerH);
  const rawArea = rawLine.vertices.length
    ? `M ${rawLine.vertices[0].x} ${areaBase} L ${rawLine.vertices.map((v) => `${v.x} ${v.y}`).join(" L ")} L ${rawLine.vertices[rawLine.vertices.length - 1].x} ${areaBase} Z`
    : "";

  return {
    width, height, padX, padY,
    empty,
    sampleCount: rows.length,
    min: round2(min),
    max: round2(max),
    lines,
    yTicks,
    xTickCount: Math.min(6, rows.length),
    firstAt: rows.length ? rows[0].at : null,
    lastAt: rows.length ? rows[rows.length - 1].at : null,
    rawArea,
  };
}

/* ═══════════════════════ ۴. خلاصه‌های پنل ═══════════════════════ */

export interface IiotCountsLike { [key: string]: number | undefined }

/** شمارش وضعیت‌های گیج — همان چیزی که به نوار خلاصه می‌رود. */
export function summarizeGaugeStatuses(gauges: Array<{ status?: string | null }>): Record<IiotTone, number> {
  const out: Record<IiotTone, number> = { ok: 0, warn: 0, danger: 0, idle: 0 };
  for (const gauge of Array.isArray(gauges) ? gauges : []) out[toneForStatus(gauge?.status)] += 1;
  return out;
}

/**
 * خلاصهٔ بافر لبه. «معلق» = دسته‌ای که هنوز تحویل نشده؛ «نامهٔ مرده» = دسته‌ای
 * که پس از پایان تلاش‌ها هم تحویل نشده و باید دستی بررسی شود.
 */
export function summarizeBufferRows(rows: Array<{ Status?: string | null; SampleCount?: number | null; CapturedAt?: string | null }>): {
  buffered: number;
  failed: number;
  deadLetter: number;
  sent: number;
  pendingSamples: number;
  oldestCapturedAt: string | null;
  needsAttention: boolean;
} {
  const list = Array.isArray(rows) ? rows : [];
  const pending = list.filter((r) => r?.Status === "buffered" || r?.Status === "sending" || r?.Status === "failed");
  const deadLetter = list.filter((r) => r?.Status === "dead-letter");
  const oldest = [...pending, ...deadLetter]
    .map((r) => r?.CapturedAt)
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .sort()[0] ?? null;
  return {
    buffered: list.filter((r) => r?.Status === "buffered" || r?.Status === "sending").length,
    failed: list.filter((r) => r?.Status === "failed").length,
    deadLetter: deadLetter.length,
    sent: list.filter((r) => r?.Status === "sent").length,
    pendingSamples: [...pending, ...deadLetter].reduce((sum, r) => sum + (Number(r?.SampleCount) || 0), 0),
    oldestCapturedAt: oldest,
    needsAttention: deadLetter.length > 0,
  };
}

/** خلاصهٔ صف یکپارچگی: چه چیزی تحویل شده و چه چیزی منتظر تلاش دوباره است. */
export function summarizeIntegrationEvents(events: Array<{ Status?: string | null; Attempts?: number | null; TargetSystem?: string | null }>): {
  pending: number;
  dispatched: number;
  failed: number;
  deadLetter: number;
  retryable: number;
  byTarget: Record<string, number>;
} {
  const list = Array.isArray(events) ? events : [];
  const byTarget: Record<string, number> = {};
  for (const e of list) {
    const target = String(e?.TargetSystem ?? "unknown");
    byTarget[target] = (byTarget[target] ?? 0) + 1;
  }
  return {
    pending: list.filter((e) => e?.Status === "pending").length,
    dispatched: list.filter((e) => e?.Status === "dispatched").length,
    failed: list.filter((e) => e?.Status === "failed").length,
    deadLetter: list.filter((e) => e?.Status === "dead-letter").length,
    retryable: list.filter((e) => e?.Status === "failed" || e?.Status === "dead-letter" || e?.Status === "pending").length,
    byTarget,
  };
}

/* ═══════════════════════ ۵. مرز مجوز اکشن‌ها ═══════════════════════ */

/**
 * هر اکشن داشبورد، دقیقاً یک مجوز. این نگاشت تنها منبع سمت کلاینت است:
 * کامپوننت‌ها دکمهٔ بی‌مجوز را غیرفعال می‌کنند و همان مجوز را نشان می‌دهند؛
 * تصمیم نهایی سرور است (`route(...)` در `server/iiotApi.js`).
 */
export const IIOT_ACTION_PERMISSIONS = Object.freeze({
  acknowledgeAlert: "iiot.alert.ack",
  resolveAlert: "iiot.alert.resolve",
  falsePositiveAlert: "iiot.alert.resolve",
  dispatchAlert: "iiot.alert.dispatch",
  verifyDowntime: "iiot.downtime.verify",
  reportDowntime: "iiot.downtime.report",
  ingestTelemetry: "iiot.telemetry.ingest",
  configureRule: "iiot.threshold.edit",
  syncBuffer: "iiot.buffer.sync",
  calibrateSensor: "iiot.sensor.calibrate",
  recordCondition: "iiot.condition.record",
  dispatchEvent: "iiot.integration.dispatch",
  createRig: "iiot.rig.edit",
} as const);

export type IiotAction = keyof typeof IIOT_ACTION_PERMISSIONS;

export function permissionOf(action: IiotAction): string {
  return IIOT_ACTION_PERMISSIONS[action];
}

/** آیا این کاربر در این دکل اجازهٔ این اکشن را دارد؟ (پیش‌بینی سمت کلاینت) */
export function canPerformAction(userId: string | null | undefined, action: IiotAction, rigId: string = DEFAULT_RIG_ID): boolean {
  return canIiotAccess(userId, permissionOf(action), rigId);
}

/** نقشهٔ کامل اکشن‌ها برای یک کاربر — خوراک غیرفعال‌سازی دکمه‌ها. */
export function actionGates(userId: string | null | undefined, rigId: string = DEFAULT_RIG_ID): Record<IiotAction, boolean> {
  const out = {} as Record<IiotAction, boolean>;
  for (const action of Object.keys(IIOT_ACTION_PERMISSIONS) as IiotAction[]) out[action] = canPerformAction(userId, action, rigId);
  return out;
}

/* ═══════════════════════ ۶. ساخت دکل نمونه از راه REST ═══════════════════════ */

/** شش کانال نمونهٔ دکل: همان مجموعهٔ آزمون‌ها تا UI و API یک چیز نشان دهند. */
export const IIOT_DEMO_CHANNELS: Array<{
  code: string;
  signalType: IiotSignalType;
  nameFa: string;
  unit: string;
  displayMin: number;
  displayMax: number;
  isCritical: boolean;
}> = [
  { code: "CH-WOB", signalType: "wob", nameFa: "وزن روی مته", unit: "klbf", displayMin: 0, displayMax: 60, isCritical: false },
  { code: "CH-RPM", signalType: "rpm", nameFa: "دور مته", unit: "rpm", displayMin: 0, displayMax: 200, isCritical: false },
  { code: "CH-TORQUE", signalType: "torque", nameFa: "گشتاور رشته", unit: "kft.lbf", displayMin: 0, displayMax: 40, isCritical: true },
  { code: "CH-SPP", signalType: "mud-pump-pressure", nameFa: "فشار پمپ گل", unit: "psi", displayMin: 0, displayMax: 5000, isCritical: true },
  { code: "CH-TEMP", signalType: "temperature", nameFa: "دمای یاتاقان", unit: "C", displayMin: 0, displayMax: 150, isCritical: true },
  { code: "CH-VIB", signalType: "vibration", nameFa: "ارتعاش پمپ", unit: "mm/s", displayMin: 0, displayMax: 30, isCritical: false },
];

/** آستانه‌های نمونه — همان چهار قاعدهٔ آزمون‌ها، با کد یکتا در دکل. */
export const IIOT_DEMO_RULES: Array<{
  code: string;
  channelCode: string;
  nameFa: string;
  level: "warning" | "critical";
  detectKind: string;
  comparison: string;
  thresholdValue?: number;
  durationSeconds: number;
  minSamples: number;
  hysteresisPct?: number;
  cooldownSeconds: number;
  autoDispatch: boolean;
  nptCode?: string;
  cmmsSiteRef?: string;
  mesWorkCenterRef?: string;
  pmisProjectRef?: string;
}> = [
  {
    code: "TR-TEMP-HH", channelCode: "CH-TEMP", nameFa: "دمای بحرانی یاتاقان", level: "critical", detectKind: "threshold",
    comparison: "gt", thresholdValue: 120, durationSeconds: 20, minSamples: 5, hysteresisPct: 5, cooldownSeconds: 300,
    autoDispatch: true, nptCode: "NPT-1.1", cmmsSiteRef: "SITE-DEMO", mesWorkCenterRef: "WC-DRILL-01", pmisProjectRef: "c1-p1",
  },
  {
    code: "TR-TORQ-H", channelCode: "CH-TORQUE", nameFa: "گشتاور بالا (هشدار)", level: "warning", detectKind: "threshold",
    comparison: "gt", thresholdValue: 28, durationSeconds: 15, minSamples: 4, cooldownSeconds: 300, autoDispatch: false,
  },
  {
    code: "TR-STICKSLIP", channelCode: "CH-TORQUE", nameFa: "تشخیص Stick-Slip", level: "critical", detectKind: "stick-slip",
    comparison: "gt", durationSeconds: 5, minSamples: 6, cooldownSeconds: 300, autoDispatch: false,
  },
  {
    code: "TR-SPP-DROP", channelCode: "CH-SPP", nameFa: "افت فشار پمپ گل", level: "critical", detectKind: "pump-drop",
    comparison: "lt", thresholdValue: 20, durationSeconds: 5, minSamples: 6, cooldownSeconds: 300, autoDispatch: false,
  },
];

export interface IiotDemoRigPlan {
  version: string;
  rigId: string;
  rig: Record<string, unknown>;
  gateway: { code: string; body: Record<string, unknown> };
  stream: { code: string; body: Record<string, unknown> };
  channels: Array<{ code: string; signalType: IiotSignalType; body: Record<string, unknown> }>;
  rules: Array<{ code: string; channelCode: string; body: Record<string, unknown> }>;
}

/**
 * طرح ساخت دکل نمونه. دادهٔ خالص است تا هم UI و هم آزمون یک چیز ببینند؛
 * اجرای ترتیبی‌اش کار کامپوننت است (گیت‌وی → جریان → کانال → قاعده).
 */
export function buildDemoRigPlan(rigId: string = DEFAULT_RIG_ID): IiotDemoRigPlan {
  return {
    version: IIOT_DASHBOARD_VERSION,
    rigId,
    rig: {
      RigId: rigId,
      RigNo: "RIG-91",
      NameFa: "دکل ۹۱ آزادگان جنوبی (نمونه)",
      RigType: "land",
      Status: "drilling",
      FieldName: "آزادگان جنوبی",
      WellName: "AZ-91",
      CmmsSiteRef: "SITE-DEMO",
      PmisProjectRef: "c1-p1",
      MesWorkCenterRef: "WC-DRILL-01",
      TimeZoneId: "Asia/Tehran",
      NominalSampleRateHz: 1,
      IsActive: true,
      NoteFa: "دکل نمونهٔ داشبورد IIoT & DAS — ساخته‌شده از راه REST",
    },
    gateway: {
      code: "GW-01",
      body: {
        GatewayCode: "GW-01", NameFa: "گیت‌وی لبهٔ دکل ۹۱", Protocol: "mqtt", SyncMode: "store-forward",
        BufferCapacity: 10000, MaxBatchSize: 500, MaxAttempts: 3, AuthMode: "token", IsActive: true,
      },
    },
    stream: {
      code: "MUDLOG-01",
      body: {
        StreamCode: "MUDLOG-01", NameFa: "جریان مادلاگر", SourceSystem: "mudlogger",
        TransportProtocol: "mqtt", SampleRateHz: 1, BatchSize: 100, ConnectionState: "offline", IsActive: true,
      },
    },
    channels: IIOT_DEMO_CHANNELS.map((spec) => ({
      code: spec.code,
      signalType: spec.signalType,
      body: {
        ChannelCode: spec.code, NameFa: spec.nameFa, SignalType: spec.signalType, Unit: spec.unit,
        DisplayMin: spec.displayMin, DisplayMax: spec.displayMax, SampleRateHz: 1,
        FilterMethod: "sma", FilterWindowSeconds: 5, DeadbandPct: 0.5, IsCritical: spec.isCritical, IsActive: true,
      },
    })),
    rules: IIOT_DEMO_RULES.map((spec) => ({
      code: spec.code,
      channelCode: spec.channelCode,
      body: {
        RuleCode: spec.code, NameFa: spec.nameFa, Level: spec.level, DetectKind: spec.detectKind,
        Comparison: spec.comparison, ThresholdValue: spec.thresholdValue, DurationSeconds: spec.durationSeconds,
        MinSamples: spec.minSamples, HysteresisPct: spec.hysteresisPct, CooldownSeconds: spec.cooldownSeconds,
        AutoDispatch: spec.autoDispatch, DispatchTargets: spec.autoDispatch ? "cmms,mes,pmis" : null,
        CmmsSiteRef: spec.cmmsSiteRef, MesWorkCenterRef: spec.mesWorkCenterRef, PmisProjectRef: spec.pmisProjectRef,
        NptCode: spec.nptCode, IsActive: true,
      },
    })),
  };
}

/**
 * گره‌زدن شناسه‌های واقعی به بدنهٔ درخواست‌ها. قاعده نمی‌تواند پیش از کانال
 * ساخته شود و کانال پیش از جریان؛ این تابع همان وابستگی را صریح می‌کند تا
 * ترتیب اشتباه، خطای سرور نشود.
 */
export function resolveDemoRigPlan(
  plan: IiotDemoRigPlan,
  resolved: { gatewayId: string | null; streamId: string | null; channelIdByCode: Record<string, string> },
): {
  stream: Record<string, unknown>;
  channels: Array<{ code: string; signalType: IiotSignalType; body: Record<string, unknown> }>;
  rules: Array<{ code: string; channelCode: string; body: Record<string, unknown> }>;
} {
  return {
    stream: { ...plan.stream.body, GatewayId: resolved.gatewayId },
    channels: plan.channels.map((channel) => ({ code: channel.code, signalType: channel.signalType, body: { ...channel.body, StreamId: resolved.streamId } })),
    rules: plan.rules.map((rule) => ({ code: rule.code, channelCode: rule.channelCode, body: { ...rule.body, ChannelId: resolved.channelIdByCode[rule.channelCode] ?? null } })),
  };
}

/* ═══════════════════════ ۷. نمونهٔ تله‌متری نمونه ═══════════════════════ */

export interface IiotSampleDraft {
  channelCode: string;
  at: string;
  value: number;
  quality: string;
  source: string;
}

/** مقدار پایهٔ هر سیگنال — مبنا برای سری نمونهٔ دمو (نه آستانه، فقط نمایش). */
export const IIOT_DEMO_BASELINE: Record<IiotSignalType, number> = {
  wob: 22, rpm: 110, torque: 18, "mud-pump-pressure": 3200, "flow-rate": 720, temperature: 78,
  vibration: 3.2, rop: 14, depth: 2450, "standpipe-pressure": 3100, hookload: 210, gas: 2.4,
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** موج آرام و قطعی هر سیگنال: بدون تصادف، تا آزمون و نمایش تکرارپذیر باشند. */
export function demoSignalValue(signalType: IiotSignalType, index: number, baselineOverride?: number): number {
  const base = baselineOverride ?? IIOT_DEMO_BASELINE[signalType] ?? 10;
  const swing = signalType === "depth" || signalType === "hookload" ? 0.002 : 0.06;
  return round3(base * (1 + swing * Math.sin(index / 9)));
}

/**
 * سری نمونهٔ دمو برای پرکردن نمودار پس از ساخت دکل: چند دقیقهٔ گذشته،
 * هر کانال با نرخ نمونهٔ مشخص. مقدارها زیر آستانه‌اند تا هشدار جعلی
 * ساخته نشود؛ تزریق ناهنجاری، اقدامی جدا و دستی است.
 */
export function buildDemoTelemetrySamples(input: {
  channels: Array<{ code: string; signalType: IiotSignalType }>;
  nowIso: string;
  minutes?: number;
  stepSeconds?: number;
}): IiotSampleDraft[] {
  const minutes = Math.max(1, Math.min(60, input.minutes ?? 10));
  const stepSeconds = Math.max(1, input.stepSeconds ?? 10);
  const nowMs = Date.parse(input.nowIso);
  if (Number.isNaN(nowMs)) return [];
  const count = Math.floor((minutes * 60) / stepSeconds);
  const out: IiotSampleDraft[] = [];
  for (const channel of input.channels) {
    for (let i = count; i >= 1; i -= 1) {
      out.push({
        channelCode: channel.code,
        at: new Date(nowMs - i * stepSeconds * 1000).toISOString(),
        value: demoSignalValue(channel.signalType, i),
        quality: "good",
        source: "simulated",
      });
    }
  }
  return out;
}

/**
 * سری افزایشی برای آزمودن زنجیرهٔ کامل هشدار (نمونه → پایداری → هشدار →
 * NPT → صف یکپارچگی). از `from` به `to` خطی بالا می‌رود تا شرط «پایداری»
 * قاعدهٔ آستانه‌ای برقرار شود.
 */
export function buildSpikeSamples(input: {
  channelCode: string;
  nowIso: string;
  from: number;
  to: number;
  samples?: number;
  stepSeconds?: number;
}): IiotSampleDraft[] {
  const samples = Math.max(2, Math.min(600, input.samples ?? 24));
  const stepSeconds = Math.max(1, input.stepSeconds ?? 1);
  const nowMs = Date.parse(input.nowIso);
  if (Number.isNaN(nowMs)) return [];
  const out: IiotSampleDraft[] = [];
  for (let i = 0; i < samples; i += 1) {
    const ratio = samples === 1 ? 1 : i / (samples - 1);
    out.push({
      channelCode: input.channelCode,
      at: new Date(nowMs - (samples - 1 - i) * stepSeconds * 1000).toISOString(),
      value: round3(input.from + (input.to - input.from) * ratio),
      quality: "good",
      source: "simulated",
    });
  }
  return out;
}
