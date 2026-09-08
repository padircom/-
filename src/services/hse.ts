/**
 * HSE engine — منبع یگانه ماژول ایمنی، بهداشت و محیط‌زیست.
 * ------------------------------------------------------------------
 * موتور خالص (بدون I/O): نرخ‌های OSHA، چرخه PTW، امتیاز بازرسی،
 * SLA اقدامات، TBT/نشت/پسماند و امتیاز ترکیبی HSE.
 * آینه یک‌به‌یک: server/hseLogic.js (نام و رفتار یکسان).
 * مبنا: docs/HSE_D1_Architecture.md
 */

/* ── حوادث ─────────────────────────────────────────────────────── */

export type HseIncidentType =
  | "near_miss"
  | "first_aid"
  | "medical"
  | "lost_time"
  | "fatality"
  | "spill"
  | "property";

export type HseIncidentStatus = "open" | "investigating" | "closed";

export interface HseIncident {
  id: string;
  code: string;
  dateISO: string; // YYYY-MM-DD
  type: HseIncidentType;
  lostDays: number;
  area: string;
  descFa: string;
  status: HseIncidentStatus;
  volumeL?: number; // فقط spill
}

/** قابل‌ثبت OSHA: medical به بالا */
export function isRecordable(t: HseIncidentType): boolean {
  return t === "medical" || t === "lost_time" || t === "fatality";
}

export function isLostTime(t: HseIncidentType): boolean {
  return t === "lost_time" || t === "fatality";
}

/** TRIR = recordables × factor / man-hours (پیش‌فرض ۲۰۰٬۰۰۰) */
export function trir(incidents: HseIncident[], manHours: number, factor = 200000): number {
  if (!(manHours > 0)) return 0;
  const n = incidents.filter((i) => isRecordable(i.type)).length;
  return +((n * factor) / manHours).toFixed(2);
}

export function ltifr(incidents: HseIncident[], manHours: number, factor = 200000): number {
  if (!(manHours > 0)) return 0;
  const n = incidents.filter((i) => isLostTime(i.type)).length;
  return +((n * factor) / manHours).toFixed(2);
}

export function severityWeight(t: HseIncidentType): number {
  switch (t) {
    case "fatality": return 100;
    case "lost_time": return 10;
    case "medical": return 5;
    case "spill": return 3;
    case "property": return 2;
    case "first_aid": return 1;
    case "near_miss": return 0.2;
  }
}

/* ── پروانه کار (PTW) ──────────────────────────────────────────── */

export type PtwType = "hot" | "cold" | "confined" | "electrical" | "height" | "excavation" | "radiation";
export type PtwStatus = "draft" | "requested" | "approved" | "active" | "suspended" | "closed" | "expired";
export type PtwAction = "request" | "approve" | "activate" | "suspend" | "resume" | "close" | "expire";

export interface PtwTransition { from: PtwStatus[]; to: PtwStatus; roles: string[] }

export const PTW_TRANSITIONS: Record<PtwAction, PtwTransition> = {
  request: { from: ["draft"], to: "requested", roles: ["requester", "supervisor", "admin"] },
  approve: { from: ["requested"], to: "approved", roles: ["area_authority", "hse_officer", "admin"] },
  activate: { from: ["approved"], to: "active", roles: ["performing_authority", "admin"] },
  suspend: { from: ["active"], to: "suspended", roles: ["hse_officer", "area_authority", "performing_authority", "admin"] },
  resume: { from: ["suspended"], to: "active", roles: ["area_authority", "hse_officer", "admin"] },
  close: { from: ["active", "suspended"], to: "closed", roles: ["performing_authority", "hse_officer", "admin"] },
  expire: { from: ["approved", "active"], to: "expired", roles: ["system", "admin"] },
};

export function ptwCanTransition(
  from: PtwStatus, action: string, role: string
): { ok: boolean; to?: PtwStatus; code?: string } {
  const tr = (PTW_TRANSITIONS as Record<string, PtwTransition>)[action];
  if (!tr) return { ok: false, code: "INVALID_ACTION" };
  if (!tr.roles.includes(role)) return { ok: false, code: "ROLE_NOT_ALLOWED" };
  if (!tr.from.includes(from)) return { ok: false, code: "INVALID_TRANSITION" };
  return { ok: true, to: tr.to };
}

export interface PtwFlags { gasTest?: boolean; rescuePlan?: boolean; isolation?: boolean; barricade?: boolean }

/** پیش‌شرط‌های جامانده هر نوع کار پرخطر */
export function ptwMissing(type: PtwType, flags: PtwFlags): (keyof PtwFlags)[] {
  const need: Record<PtwType, (keyof PtwFlags)[]> = {
    hot: ["gasTest", "barricade"],
    cold: [],
    confined: ["gasTest", "rescuePlan"],
    electrical: ["isolation"],
    height: ["barricade"],
    excavation: ["barricade"],
    radiation: ["barricade"],
  };
  return (need[type] ?? []).filter((k) => !flags[k]);
}

export interface HsePermit {
  id: string;
  no: string;
  type: PtwType;
  status: PtwStatus;
  workDate: string;
  area: string;
  riskLevel: "low" | "medium" | "high";
}

/* ── بازرسی ─────────────────────────────────────────────────────── */

export interface HseCheckItem { item: string; ok: boolean; na?: boolean }

export function inspectionScore(items: HseCheckItem[]): number {
  const eff = items.filter((i) => !i.na);
  if (!eff.length) return 0;
  return Math.round((eff.filter((i) => i.ok).length / eff.length) * 100);
}

export function inspectionBand(score: number): "A" | "B" | "C" | "D" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

export interface HseInspection {
  id: string;
  area: string;
  dateISO: string;
  items: HseCheckItem[];
}

/* ── اقدامات اصلاحی ────────────────────────────────────────────── */

export type HseActionSeverity = "low" | "medium" | "high" | "critical";

export interface HseAction {
  id: string;
  title: string;
  dueISO: string;
  closedAt: string | null;
  severity: HseActionSeverity;
}

function dayDiff(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.floor((b - a) / 86400000);
}

export function actionSla(a: HseAction, nowISO: string): "closed" | "overdue" | "due_soon" | "ok" {
  if (a.closedAt) return "closed";
  const left = dayDiff(nowISO, a.dueISO);
  if (left < 0) return "overdue";
  if (left <= 3) return "due_soon";
  return "ok";
}

/** تشدید L0..L3 (ارجاع به CAPA حاکمیت در L3) */
export function actionEscalation(a: HseAction, nowISO: string): "L0" | "L1" | "L2" | "L3" {
  if (a.closedAt) return "L0";
  const overdue = Math.max(0, -dayDiff(nowISO, a.dueISO));
  if (a.severity === "critical" && overdue > 7) return "L3";
  if ((a.severity === "critical" || a.severity === "high") && overdue > 3) return "L2";
  if (overdue > 0 || (a.severity === "critical" && dayDiff(nowISO, a.dueISO) <= 3)) return "L1";
  return "L0";
}

/* ── بهداشت و محیط‌زیست ────────────────────────────────────────── */

export function tbtCompliance(planned: number, held: number): number {
  if (!(planned > 0)) return 0;
  return +Math.max(0, Math.min(1, held / planned)).toFixed(3);
}

/** رده نشت بر اساس حجم (لیتر) */
export function spillTier(volumeL: number): "T1" | "T2" | "T3" {
  if (volumeL >= 200) return "T3";
  if (volumeL >= 20) return "T2";
  return "T1";
}

export function recycleRate(recycledKg: number, totalKg: number): number {
  if (!(totalKg > 0)) return 0;
  return +Math.max(0, Math.min(1, recycledKg / totalKg)).toFixed(3);
}

/* ── امتیاز ترکیبی ─────────────────────────────────────────────── */

export interface HseScoreInput {
  trir: number;
  ptwCompliance: number; // 0..1 سهم PTW بدون نقص پیش‌شرط
  inspectionAvg: number; // 0..100
  actionClosure: number; // 0..1 سهم بسته‌شده
}

export function hseScore(x: HseScoreInput): { total: number; band: "Green" | "Yellow" | "Red" } {
  const incident = Math.max(0, 100 - x.trir * 25);
  const total = Math.round(0.35 * incident + 0.25 * x.ptwCompliance * 100 + 0.2 * x.inspectionAvg + 0.2 * x.actionClosure * 100);
  const band = total >= 85 ? "Green" : total >= 65 ? "Yellow" : "Red";
  return { total, band };
}

/* ── سید نمایشی (D1 آفلاین-اول) ────────────────────────────────── */

export const HSE_MANHOURS = [
  { period: "1405-04", hours: 176400 },
  { period: "1405-05", hours: 184000 },
  { period: "1405-06", hours: 62100 },
];

export function totalManHours(rows: { hours: number }[] = HSE_MANHOURS): number {
  return rows.reduce((s, r) => s + r.hours, 0);
}

export const HSE_INCIDENTS: HseIncident[] = [
  { id: "i1", code: "INC-101", dateISO: "2026-08-02", type: "near_miss", lostDays: 0, area: "Piperack B", descFa: "سقوط ابزار از ارتفاع (بدون مصدوم)", status: "closed" },
  { id: "i2", code: "INC-102", dateISO: "2026-08-09", type: "first_aid", lostDays: 0, area: "FND", descFa: "بریدگی سطحی دست", status: "closed" },
  { id: "i3", code: "INC-103", dateISO: "2026-08-17", type: "medical", lostDays: 0, area: "Spool yard", descFa: "درمان سرپایی چشم", status: "closed" },
  { id: "i4", code: "INC-104", dateISO: "2026-08-21", type: "spill", lostDays: 0, area: "Laydown", descFa: "نشت ۱۲ لیتری گازوئیل", status: "closed", volumeL: 12 },
  { id: "i5", code: "INC-105", dateISO: "2026-08-28", type: "near_miss", lostDays: 0, area: "MV trench", descFa: "نزدیک‌برخورد با کابل مدفون", status: "investigating" },
  { id: "i6", code: "INC-106", dateISO: "2026-09-01", type: "lost_time", lostDays: 4, area: "Piperack B", descFa: "پیچ‌خوردگی مچ در نصب", status: "investigating" },
  { id: "i7", code: "INC-107", dateISO: "2026-09-03", type: "property", lostDays: 0, area: "Gate", descFa: "برخورد لیفتراک با گارد", status: "open" },
  { id: "i8", code: "INC-108", dateISO: "2026-09-05", type: "first_aid", lostDays: 0, area: "FND", descFa: "کمک‌های اولیه گرمازدگی", status: "open" },
];

export const HSE_PTWS: HsePermit[] = [
  { id: "p1", no: "PTW-2201", type: "hot", status: "closed", workDate: "2026-08-28", area: "Spool yard", riskLevel: "high" },
  { id: "p2", no: "PTW-2202", type: "confined", status: "active", workDate: "2026-09-06", area: "Tank TK-01", riskLevel: "high" },
  { id: "p3", no: "PTW-2203", type: "electrical", status: "approved", workDate: "2026-09-08", area: "MCC room", riskLevel: "medium" },
  { id: "p4", no: "PTW-2204", type: "height", status: "requested", workDate: "2026-09-09", area: "Piperack B", riskLevel: "medium" },
  { id: "p5", no: "PTW-2205", type: "cold", status: "draft", workDate: "2026-09-10", area: "Laydown", riskLevel: "low" },
];

export const HSE_INSPECTIONS: HseInspection[] = [
  { id: "n1", area: "Spool yard", dateISO: "2026-09-04", items: [
    { item: "کپسول حریق", ok: true }, { item: "داربست برچسب‌دار", ok: true },
    { item: "سیم ارت", ok: false }, { item: "نظم کارگاه", ok: true },
  ]},
  { id: "n2", area: "Piperack B", dateISO: "2026-09-05", items: [
    { item: "هارنس", ok: true }, { item: "توری زیرکار", ok: true },
    { item: "روشنایی", ok: true }, { item: "نردبان استاندارد", ok: true },
  ]},
  { id: "n3", area: "Tank TK-01", dateISO: "2026-09-06", items: [
    { item: "گازسنج کالیبره", ok: true }, { item: "تهویه", ok: false },
    { item: "نگهبان دهانه", ok: true }, { item: "طناب نجات", ok: false },
  ]},
  { id: "n4", area: "MCC room", dateISO: "2026-09-07", items: [
    { item: "LOTO", ok: true }, { item: "دستکش عایق", ok: true }, { item: "کفپوش", ok: true },
  ]},
];

export const HSE_ACTIONS: HseAction[] = [
  { id: "a1", title: "رفع نقص سیم ارت اسپول‌یارد", dueISO: "2026-09-06", closedAt: "2026-09-05", severity: "medium" },
  { id: "a2", title: "تهویه و طناب نجات TK-01", dueISO: "2026-09-09", closedAt: null, severity: "critical" },
  { id: "a3", title: "برچسب‌گذاری مجدد داربست‌ها", dueISO: "2026-09-12", closedAt: null, severity: "low" },
  { id: "a4", title: "آموزش مجدد LOTO برق", dueISO: "2026-09-04", closedAt: null, severity: "high" },
  { id: "a5", title: "خط‌کشی مسیر لیفتراک گیت", dueISO: "2026-09-15", closedAt: null, severity: "medium" },
];

export const HSE_TBT = { planned: 24, held: 21 };
export const HSE_WASTE = { recycledKg: 1840, totalKg: 5200 };
export const HSE_CHECKUP = { covered: 86, total: 112 };
