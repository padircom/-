/**
 * EQM — موتور مدیریت ماشین‌آلات و تجهیزات (ناوگان، ساعت کارکرد، اجاره، تعمیرات، بهره‌وری)
 * منبع یگانه منطق (ADR-01). آینه سرور با `npm run build:eqm` ساخته می‌شود.
 *
 * اصل حاکم: موتور «خالص» است — بدون I/O، بدون Date.now مستقیم («اکنون» تزریق می‌شود) و
 * تاریخ‌ها همگی ISO (YYYY-MM-DD). نمایش شمسی بر عهدهٔ لایهٔ UI است.
 * داده از راه جداول sql-v1 (Equipment / EquipmentMeter / EquipmentRental / MaintenanceOrder)
 * تأمین می‌شود؛ این فایل فقط محاسبه و اعتبارسنجی می‌کند.
 */

export const EQM_VERSION = "eqm-v1";

/** کد دامنه در یک نقطه متمرکز — تغییر آن تک‌خطی است. */
export const EQM_DOMAIN_ID = "d9";

/* ══════════════════════════ انواع پایه ══════════════════════════ */

export type EquipmentCategory =
  | "crane_tower" | "crane_mobile" | "excavator" | "loader" | "bulldozer"
  | "grader" | "roller" | "forklift" | "backhoe" | "truck" | "mixer"
  | "pump" | "generator" | "compressor" | "welding" | "manlift"
  | "drilling" | "other";

export type EquipmentClass =
  | "earthmoving" | "lifting" | "transport" | "concrete" | "power" | "other";

export type Ownership = "owned" | "rented" | "leased";
export type EquipmentStatus = "active" | "idle" | "repair" | "disposed";
export type RateType = "hourly" | "daily" | "monthly";
export type MaintenanceKind = "corrective" | "preventive" | "inspection" | "overhaul";
export type MaintenancePriority = "low" | "medium" | "high" | "critical";
export type MaintenanceStatus = "open" | "in_progress" | "done" | "closed";

export type EquipmentCategoryDef = {
  code: string;
  fa: string;
  en: string;
  cls: EquipmentClass;
  /** واحد ظرفیت متعارف (تن، مترمکعب، کیلوولت‌آمپر و …) */
  uom?: string;
  /** عمر مفید اقتصادی پیش‌فرض (سال) برای هشدار فرسودگی و استهلاک */
  economicLifeYears: number;
  /** آستانهٔ بهره‌برداری نرمال — کمتر از آن «کم‌کار» و هشداردهنده است */
  utilLowPct: number;
  utilHighPct: number;
};

/* ══════════════════════════ کاتالوگ ماشین‌آلات ══════════════════════════ */

export const EQUIPMENT_CATEGORY_CATALOG: EquipmentCategoryDef[] = [
  // خاکبرداری
  { code: "EXC", fa: "بیل مکانیکی", en: "Excavator", cls: "earthmoving", uom: "تن", economicLifeYears: 12, utilLowPct: 40, utilHighPct: 75 },
  { code: "LDR", fa: "لودر", en: "Wheel Loader", cls: "earthmoving", uom: "مترمکعب", economicLifeYears: 12, utilLowPct: 40, utilHighPct: 75 },
  { code: "BLD", fa: "بولدوزر", en: "Bulldozer", cls: "earthmoving", uom: "تن", economicLifeYears: 14, utilLowPct: 40, utilHighPct: 75 },
  { code: "GDR", fa: "گریدر", en: "Motor Grader", cls: "earthmoving", uom: "تن", economicLifeYears: 14, utilLowPct: 40, utilHighPct: 75 },
  { code: "RLR", fa: "غلتک", en: "Compaction Roller", cls: "earthmoving", uom: "تن", economicLifeYears: 12, utilLowPct: 40, utilHighPct: 75 },
  { code: "BHO", fa: "بکهو لودر", en: "Backhoe Loader", cls: "earthmoving", uom: "تن", economicLifeYears: 10, utilLowPct: 40, utilHighPct: 75 },
  // باربرداری
  { code: "CRN-TOW", fa: "تاور کرین", en: "Tower Crane", cls: "lifting", uom: "تن", economicLifeYears: 18, utilLowPct: 50, utilHighPct: 85 },
  { code: "CRN-MOB", fa: "جرثقیل موبایل", en: "Mobile Crane", cls: "lifting", uom: "تن", economicLifeYears: 16, utilLowPct: 45, utilHighPct: 80 },
  { code: "FLT", fa: "لیفتراک", en: "Forklift", cls: "lifting", uom: "تن", economicLifeYears: 12, utilLowPct: 45, utilHighPct: 80 },
  { code: "MNF", fa: "من‌لیفت", en: "Manlift / Boom Lift", cls: "lifting", uom: "متر", economicLifeYears: 10, utilLowPct: 45, utilHighPct: 80 },
  // حمل
  { code: "TRK", fa: "کامیون", en: "Dump Truck", cls: "transport", uom: "تن", economicLifeYears: 10, utilLowPct: 45, utilHighPct: 80 },
  // بتن
  { code: "MXR", fa: "میکسر بتن", en: "Concrete Mixer", cls: "concrete", uom: "مترمکعب", economicLifeYears: 10, utilLowPct: 40, utilHighPct: 75 },
  { code: "PMP", fa: "پمپ بتن", en: "Concrete Pump", cls: "concrete", uom: "مترمکعب/ساعت", economicLifeYears: 10, utilLowPct: 40, utilHighPct: 75 },
  // توان و تاسیسات
  { code: "GEN", fa: "دیزل ژنراتور", en: "Diesel Generator", cls: "power", uom: "کیلوولت‌آمپر", economicLifeYears: 15, utilLowPct: 30, utilHighPct: 85 },
  { code: "CMP", fa: "کمپرسور هوا", en: "Air Compressor", cls: "power", uom: "مترمکعب/دقیقه", economicLifeYears: 12, utilLowPct: 35, utilHighPct: 80 },
  { code: "WLD", fa: "دستگاه جوش", en: "Welding Machine", cls: "power", uom: "آمپر", economicLifeYears: 10, utilLowPct: 40, utilHighPct: 80 },
  { code: "DRL", fa: "دستگاه حفاری", en: "Drilling Rig", cls: "other", uom: "متر", economicLifeYears: 15, utilLowPct: 40, utilHighPct: 75 },
  { code: "OTH", fa: "سایر تجهیزات", en: "Other Equipment", cls: "other", economicLifeYears: 10, utilLowPct: 35, utilHighPct: 75 },
];

export const CATEGORY_BY_CODE: Record<string, EquipmentCategoryDef> = Object.fromEntries(
  EQUIPMENT_CATEGORY_CATALOG.map((c) => [c.code, c])
);

export const OWNERSHIPS: Ownership[] = ["owned", "rented", "leased"];
export const EQUIPMENT_STATUSES: EquipmentStatus[] = ["active", "idle", "repair", "disposed"];
export const RATE_TYPES: RateType[] = ["hourly", "daily", "monthly"];
export const MAINTENANCE_KINDS: MaintenanceKind[] = ["corrective", "preventive", "inspection", "overhaul"];
export const MAINTENANCE_PRIORITIES: MaintenancePriority[] = ["low", "medium", "high", "critical"];
export const MAINTENANCE_STATUSES: MaintenanceStatus[] = ["open", "in_progress", "done", "closed"];

/* ══════════════════════════ شکل ردیف‌ها (منطبق بر sql-v1) ══════════════════════════ */

export type EquipmentRow = {
  Id?: string;
  ProjectId: string;
  Code: string;
  NameFa: string;
  Category: string;
  Ownership: Ownership;
  BrandFa?: string;
  Model?: string;
  Year?: number;
  Capacity?: number;
  CapacityUom?: string;
  Status: EquipmentStatus;
  CommissionedAt?: string;
  LocationFa?: string;
  PurchaseValue?: number;
  SalvageValue?: number;
};

export type MeterRow = {
  Id?: string;
  ProjectId: string;
  EquipmentId: string;
  ReadAt: string;
  HourMeter: number;
  WorkHours: number;
  Source: "manual" | "telemetry";
  EnteredBy?: string;
};

export type RentalRow = {
  Id?: string;
  ProjectId: string;
  EquipmentId: string;
  Supplier?: string;
  ContractNo?: string;
  RateType: RateType;
  Rate: number;
  Currency?: string;
  StartDate: string;
  EndDate?: string;
  Status: "active" | "expired" | "terminated";
};

export type MaintenanceOrderRow = {
  Id?: string;
  ProjectId: string;
  EquipmentId: string;
  Code: string;
  Kind: MaintenanceKind;
  Priority: MaintenancePriority;
  ReportedAt: string;
  DownFrom?: string;
  DownTo?: string;
  Status: MaintenanceStatus;
  Cost?: number;
  DescriptionFa?: string;
  AssignedTo?: string;
};

/* ══════════════════════════ ابزار ══════════════════════════ */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** تعداد روز صحیح بین دو تاریخ ISO؛ بازهٔ معکوس صفر می‌شود نه منفی. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** ساعت بین دو تاریخ-زمان؛ برای محاسبهٔ خرابی دقیق تا کسری روز. */
export function hoursBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, (b - a) / 3_600_000);
}

export type Issue = { code: string; column?: string; message: string };
export type CheckResult = { ok: boolean; issues: Issue[] };

const REQUIRED = "E-EQM-REQUIRED";

function required(row: Record<string, unknown>, col: string, issues: Issue[], label: string) {
  const v = row[col];
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) {
    issues.push({ code: REQUIRED, column: col, message: `${label} الزامی است` });
  }
}

function optionalNumber(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/* ══════════════════════════ ۱. اعتبارسنجی ══════════════════════════ */

export function validateEquipment(row: Record<string, unknown>): CheckResult {
  const issues: Issue[] = [];
  required(row, "ProjectId", issues, "پروژه");
  required(row, "Code", issues, "کد شناسه");
  required(row, "NameFa", issues, "نام");
  required(row, "Category", issues, "دسته‌بندی");
  required(row, "Ownership", issues, "نوع مالکیت");
  required(row, "Status", issues, "وضعیت");
  if (typeof row.Category === "string" && !CATEGORY_BY_CODE[row.Category]) {
    issues.push({ code: "E-EQM-CATEGORY", column: "Category", message: `دسته‌بندی ناشناخته: ${row.Category}` });
  }
  if (typeof row.Ownership === "string" && !OWNERSHIPS.includes(row.Ownership as Ownership)) {
    issues.push({ code: "E-EQM-OWNERSHIP", column: "Ownership", message: `نوع مالکیت نامعتبر: ${row.Ownership}` });
  }
  if (typeof row.Status === "string" && !EQUIPMENT_STATUSES.includes(row.Status as EquipmentStatus)) {
    issues.push({ code: "E-EQM-STATUS", column: "Status", message: `وضعیت نامعتبر: ${row.Status}` });
  }
  const year = optionalNumber(row.Year);
  const nowYear = new Date().getFullYear();
  if (year !== undefined && (year < 1900 || year > nowYear + 1)) {
    issues.push({ code: "E-EQM-YEAR", column: "Year", message: `سال ساخت خارج از بازهٔ ۱۹۰۰ تا ${nowYear + 1}` });
  }
  const cap = optionalNumber(row.Capacity);
  if (cap !== undefined && cap < 0) {
    issues.push({ code: "E-EQM-CAPACITY", column: "Capacity", message: "ظرفیت نمی‌تواند منفی باشد" });
  }
  if (optionalNumber(row.PurchaseValue) !== undefined && optionalNumber(row.PurchaseValue)! < 0) {
    issues.push({ code: "E-EQM-CAPACITY", column: "PurchaseValue", message: "ارزش خرید منفی نامعتبر است" });
  }
  return { ok: issues.length === 0, issues };
}

export function validateMeter(row: Record<string, unknown>, prevHourMeter?: number): CheckResult {
  const issues: Issue[] = [];
  required(row, "EquipmentId", issues, "ماشین‌آلات");
  required(row, "ReadAt", issues, "تاریخ قرائت");
  required(row, "HourMeter", issues, "ساعت‌شمار");
  const meter = optionalNumber(row.HourMeter);
  if (meter !== undefined && meter < 0) {
    issues.push({ code: "E-EQM-METER", column: "HourMeter", message: "ساعت‌شمار نمی‌تواند منفی باشد" });
  }
  if (meter !== undefined && prevHourMeter !== undefined && meter < prevHourMeter) {
    issues.push({ code: "E-EQM-METER-ROLLBACK", column: "HourMeter", message: `ساعت‌شمار عقب رفته: ${meter} < ${prevHourMeter}` });
  }
  const src = row.Source;
  if (src !== undefined && src !== "manual" && src !== "telemetry") {
    issues.push({ code: "E-EQM-SOURCE", column: "Source", message: `منبع قرائت نامعتبر: ${src}` });
  }
  return { ok: issues.length === 0, issues };
}

export function validateRental(row: Record<string, unknown>): CheckResult {
  const issues: Issue[] = [];
  required(row, "EquipmentId", issues, "ماشین‌آلات");
  required(row, "RateType", issues, "نوع نرخ");
  required(row, "Rate", issues, "نرخ");
  required(row, "StartDate", issues, "تاریخ شروع");
  required(row, "Status", issues, "وضعیت قرارداد");
  const rate = optionalNumber(row.Rate);
  if (rate !== undefined && rate <= 0) {
    issues.push({ code: "E-EQM-RATE", column: "Rate", message: "نرخ باید بزرگ‌تر از صفر باشد" });
  }
  if (typeof row.RateType === "string" && !RATE_TYPES.includes(row.RateType as RateType)) {
    issues.push({ code: "E-EQM-RATE-TYPE", column: "RateType", message: `نوع نرخ نامعتبر: ${row.RateType}` });
  }
  const start = typeof row.StartDate === "string" ? row.StartDate : "";
  const end = typeof row.EndDate === "string" ? row.EndDate : "";
  if (start && end && Date.parse(end) < Date.parse(start)) {
    issues.push({ code: "E-EQM-DATE-RANGE", column: "EndDate", message: "تاریخ پایان زودتر از شروع است" });
  }
  return { ok: issues.length === 0, issues };
}

export function validateMaintenanceOrder(row: Record<string, unknown>): CheckResult {
  const issues: Issue[] = [];
  required(row, "EquipmentId", issues, "ماشین‌آلات");
  required(row, "Code", issues, "کد دستورکار");
  required(row, "Kind", issues, "نوع تعمیر");
  required(row, "Priority", issues, "اولویت");
  required(row, "ReportedAt", issues, "تاریخ گزارش");
  required(row, "Status", issues, "وضعیت");
  if (typeof row.Kind === "string" && !MAINTENANCE_KINDS.includes(row.Kind as MaintenanceKind)) {
    issues.push({ code: "E-EQM-KIND", column: "Kind", message: `نوع تعمیر نامعتبر: ${row.Kind}` });
  }
  if (typeof row.Priority === "string" && !MAINTENANCE_PRIORITIES.includes(row.Priority as MaintenancePriority)) {
    issues.push({ code: "E-EQM-PRIORITY", column: "Priority", message: `اولویت نامعتبر: ${row.Priority}` });
  }
  if (typeof row.Status === "string" && !MAINTENANCE_STATUSES.includes(row.Status as MaintenanceStatus)) {
    issues.push({ code: "E-EQM-MSTATUS", column: "Status", message: `وضعیت تعمیر نامعتبر: ${row.Status}` });
  }
  const down = typeof row.DownFrom === "string" ? row.DownFrom : "";
  const up = typeof row.DownTo === "string" ? row.DownTo : "";
  if (down && up && Date.parse(up) < Date.parse(down)) {
    issues.push({ code: "E-EQM-DATE-RANGE", column: "DownTo", message: "زمان راه‌اندازی زودتر از توقف است" });
  }
  return { ok: issues.length === 0, issues };
}

/* ══════════════════════════ ۲. سن و استهلاک ══════════════════════════ */

export function equipmentAge(commissionedIso: string | undefined, nowIso: string): { days: number; months: number; years: number } {
  const days = commissionedIso ? daysBetween(commissionedIso, nowIso) : 0;
  return { days, months: round2(days / 30.44), years: round2(days / 365.25) };
}

export function straightLineDepreciation(
  purchaseValue: number,
  salvageValue: number,
  lifeYears: number,
  ageYears: number
): { annual: number; accumulated: number; bookValue: number; ratePct: number } {
  const pv = Math.max(0, purchaseValue);
  const sv = clamp(salvageValue, 0, pv);
  const life = Math.max(1, lifeYears);
  const annual = (pv - sv) / life;
  const accumulated = Math.min(pv - sv, annual * Math.max(0, ageYears));
  const bookValue = round2(pv - accumulated);
  return {
    annual: round2(annual),
    accumulated: round2(accumulated),
    bookValue,
    ratePct: pv > 0 ? round2((accumulated / pv) * 100) : 0,
  };
}

/* ══════════════════════════ ۳. ساعت کارکرد و بهره‌برداری ══════════════════════════ */

export type Utilization = { rate: number; verdict: "idle" | "low" | "normal" | "high"; availableHours: number; workHours: number; idleHours: number };

export function utilization(
  workHours: number,
  periodDays: number,
  workingHoursPerDay = 8,
  thresholds?: { lowPct: number; highPct: number }
): Utilization {
  const low = thresholds?.lowPct ?? 40;
  const high = thresholds?.highPct ?? 75;
  const availableHours = Math.max(0, periodDays) * Math.max(0, workingHoursPerDay);
  const wh = Math.max(0, workHours);
  const rate = availableHours > 0 ? clamp((wh / availableHours) * 100, 0, 100) : 0;
  const verdict = rate <= 0 ? "idle" : rate < low ? "low" : rate > high ? "high" : "normal";
  return { rate: round2(rate), verdict, availableHours, workHours: round2(wh), idleHours: round2(availableHours - wh) };
}

export type Availability = { rate: number; verdict: "critical" | "degraded" | "healthy"; downtimeHours: number; uptimeHours: number };

export function availability(downtimeHours: number, periodHours: number): Availability {
  const total = Math.max(0, periodHours);
  const down = clamp(downtimeHours, 0, total);
  const uptime = total - down;
  const rate = total > 0 ? (uptime / total) * 100 : 100;
  const verdict = rate < 85 ? "critical" : rate < 95 ? "degraded" : "healthy";
  return { rate: round2(rate), verdict, downtimeHours: round2(down), uptimeHours: round2(uptime) };
}

/** مجموع ساعت کارکرد از قرائت‌ها (ستون WorkHours). */
export function workHoursSum(meters: Pick<MeterRow, "WorkHours">[]): number {
  return round2(meters.reduce((s, m) => s + (Number(m.WorkHours) || 0), 0));
}

/** مجموع ساعت توقف ناشی از دستورکارهای تعمیر، محدود به بازهٔ [from,to]. */
export function downtimeHours(orders: MaintenanceOrderRow[], fromIso: string, toIso: string): number {
  let total = 0;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  for (const o of orders) {
    if (!o.DownFrom) continue;
    const start = Math.max(from, Date.parse(o.DownFrom));
    const end = o.DownTo ? Math.min(to, Date.parse(o.DownTo)) : to;
    if (end > start) total += (end - start) / 3_600_000;
  }
  return round2(total);
}

/* ══════════════════════════ ۴. قابلیت اطمینان (MTBF / MTTR) ══════════════════════════ */

export function mtbf(orders: MaintenanceOrderRow[], periodHours: number, downtimeHrs?: number): { mtbfHours: number; mtbfDays: number } | null {
  const failures = orders.filter((o) => (o.Kind === "corrective" || o.Kind === "overhaul") && (o.Status === "done" || o.Status === "closed"));
  if (failures.length === 0) return null;
  const down = downtimeHrs ?? downtimeHours(failures, "0000-01-01", "9999-12-31");
  const uptime = Math.max(0, periodHours - down);
  const value = uptime / failures.length;
  return { mtbfHours: round2(value), mtbfDays: round2(value / 24) };
}

export function mttr(orders: MaintenanceOrderRow[]): { mttrHours: number; mttrDays: number } | null {
  const done = orders.filter((o) => o.DownFrom && o.DownTo && (o.Status === "done" || o.Status === "closed"));
  if (done.length === 0) return null;
  const sum = done.reduce((s, o) => s + hoursBetween(o.DownFrom!, o.DownTo!), 0);
  const value = sum / done.length;
  return { mttrHours: round2(value), mttrDays: round2(value / 24) };
}

/* ══════════════════════════ ۵. تعمیرات ══════════════════════════ */

export function maintenanceBacklog(orders: MaintenanceOrderRow[]): { total: number; byPriority: Record<MaintenancePriority, number> } {
  const open = orders.filter((o) => o.Status === "open" || o.Status === "in_progress");
  const byPriority: Record<MaintenancePriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const o of open) byPriority[o.Priority] += 1;
  return { total: open.length, byPriority };
}

export function nextPmDue(lastPmIso: string | undefined, intervalDays: number, nowIso: string): { dueIso: string; daysLeft: number; overdue: boolean } {
  const base = lastPmIso ? Date.parse(lastPmIso) : NaN;
  if (Number.isNaN(base) || intervalDays <= 0) return { dueIso: "", daysLeft: 0, overdue: false };
  const dueMs = base + intervalDays * 86_400_000;
  const dueIso = new Date(dueMs).toISOString().slice(0, 10);
  const daysLeft = Math.round((dueMs - Date.parse(nowIso)) / 86_400_000);
  return { dueIso, daysLeft, overdue: daysLeft < 0 };
}

/* ══════════════════════════ ۶. اجاره ══════════════════════════ */

export function rentalCostAccrued(rental: RentalRow, asOfIso: string): { elapsedUnits: number; accrued: number; periodLabel: string } {
  const start = Date.parse(rental.StartDate);
  const end = rental.EndDate ? Date.parse(rental.EndDate) : Date.parse(asOfIso);
  const asOf = Date.parse(asOfIso);
  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(asOf)) return { elapsedUnits: 0, accrued: 0, periodLabel: rental.RateType };
  const endCapped = Math.max(start, Math.min(end, asOf));
  const days = Math.max(0, (endCapped - start) / 86_400_000);
  let elapsedUnits: number;
  let periodLabel: string;
  if (rental.RateType === "hourly") { elapsedUnits = days * 24; periodLabel = "ساعت"; }
  else if (rental.RateType === "daily") { elapsedUnits = days; periodLabel = "روز"; }
  else { elapsedUnits = days / 30.44; periodLabel = "ماه"; }
  return { elapsedUnits: round2(elapsedUnits), accrued: round2(elapsedUnits * (Number(rental.Rate) || 0)), periodLabel };
}

/* ══════════════════════════ ۷. هزینه و بهره‌وری ══════════════════════════ */

/**
 * هزینهٔ هر ساعت کارکرد ماشین.
 *
 * ADR-17: اگر ساعت کارکرد صفر باشد نرخ ساعتی «سنجش‌ناپذیر» (`null`) است، نه
 * برابر کل هزینهٔ دوره. تقسیم بر `Math.max(1, hours)` باعث می‌شد ماشین بیکارِ
 * اجاره‌ای نرخی هم‌اندازهٔ کل اجارهٔ ماه نشان دهد (مثلاً ۷۹۳ میلیون ریال بر
 * ساعت) و در گزارش تخصیص هزینه گران‌ترین ماشین ناوگان جلوه کند. هزینهٔ ماشین
 * بیکار واقعی است و در `totalCost` می‌ماند؛ فقط نرخ ساعتی بی‌معناست.
 */
export function equipmentCostPerHour(
  workHours: number,
  costs: { rentalCost?: number; maintenanceCost?: number; fuelCost?: number },
): { totalCost: number; costPerHour: number | null } {
  const total = (costs.rentalCost || 0) + (costs.maintenanceCost || 0) + (costs.fuelCost || 0);
  const hours = Number(workHours) || 0;
  return { totalCost: round2(total), costPerHour: hours > 0 ? round2(total / hours) : null };
}

export type Productivity = { index: number; verdict: "under" | "on_plan" | "over" };

export function productivity(outputQuantity: number, plannedQuantity: number): Productivity {
  const planned = Number(plannedQuantity) || 0;
  const output = Number(outputQuantity) || 0;
  const index = planned > 0 ? output / planned : 0;
  const verdict: Productivity["verdict"] = index < 0.9 ? "under" : index > 1.1 ? "over" : "on_plan";
  return { index: round2(index), verdict };
}

/* ══════════════════════════ ۸. هشدار زودهنگام (EWS) ══════════════════════════ */

export type EqmWarning = { code: string; severity: "info" | "warning" | "critical"; message: string };

export type EqmContext = {
  nowIso: string;
  periodDays: number;
  workHours: number;
  downtimeHrs: number;
  orders: MaintenanceOrderRow[];
  rental?: RentalRow;
  lastPmIso?: string;
  pmIntervalDays?: number;
  ageYears: number;
  economicLifeYears: number;
  utilLowPct: number;
};

export function eqmEws(equipment: EquipmentRow, ctx: EqmContext): EqmWarning[] {
  const out: EqmWarning[] = [];
  const cat = CATEGORY_BY_CODE[equipment.Category] ?? CATEGORY_BY_CODE["OTH"];

  const util = utilization(ctx.workHours, ctx.periodDays, 8, { lowPct: ctx.utilLowPct || cat.utilLowPct, highPct: cat.utilHighPct });
  if (util.verdict === "idle" && equipment.Status === "active") {
    out.push({ code: "W-EQM-IDLE", severity: "warning", message: `ماشین «${equipment.NameFa}» در بازه فعال اما بدون کارکرد ثبت‌شده است` });
  } else if (util.verdict === "low") {
    out.push({ code: "W-EQM-LOW-UTIL", severity: "info", message: `بهره‌برداری ${util.rate}٪ پایین‌تر از آستانهٔ ${ctx.utilLowPct || cat.utilLowPct}٪ است` });
  }

  const totalHours = Math.max(1, ctx.periodDays * 24);
  const avail = availability(ctx.downtimeHrs, totalHours);
  if (avail.verdict === "critical") {
    out.push({ code: "W-EQM-DOWNTIME", severity: "critical", message: `دسترس‌پذیری ${avail.rate}٪ (توقف ${avail.downtimeHours} ساعت)` });
  } else if (avail.verdict === "degraded") {
    out.push({ code: "W-EQM-DOWNTIME", severity: "warning", message: `دسترس‌پذیری ${avail.rate}٪ زیر حد مطلوب است` });
  }

  const backlog = maintenanceBacklog(ctx.orders);
  if (backlog.byPriority.critical > 0) {
    out.push({ code: "W-EQM-BACKLOG", severity: "critical", message: `${backlog.byPriority.critical} دستورکار بحرانی باز دارد` });
  } else if (backlog.byPriority.high > 0) {
    out.push({ code: "W-EQM-BACKLOG", severity: "warning", message: `${backlog.byPriority.high} دستورکار با اولویت بالا باز دارد` });
  }

  const pm = nextPmDue(ctx.lastPmIso, ctx.pmIntervalDays ?? 0, ctx.nowIso);
  if (pm.overdue) {
    out.push({ code: "W-EQM-PM-DUE", severity: "critical", message: `سرویس دوره‌ای ${Math.abs(pm.daysLeft)} روز از موعد گذشته است` });
  } else if (ctx.lastPmIso && pm.dueIso && pm.daysLeft <= 14 && ctx.pmIntervalDays) {
    out.push({ code: "W-EQM-PM-DUE", severity: "warning", message: `سرویس دوره‌ای تا ${pm.daysLeft} روز دیگر موعد می‌شود` });
  }

  if (ctx.rental && ctx.rental.Status === "active" && ctx.rental.EndDate) {
    const left = daysBetween(ctx.nowIso, ctx.rental.EndDate);
    if (left <= 14) {
      out.push({ code: "W-EQM-RENT-EXPIRY", severity: left <= 3 ? "critical" : "warning", message: `قرارداد اجاره تا ${left} روز دیگر پایان می‌یابد` });
    }
  }

  if (equipment.Status !== "disposed" && ctx.ageYears >= ctx.economicLifeYears) {
    out.push({ code: "W-EQM-AGING", severity: "info", message: `سن ${ctx.ageYears} سال به عمر اقتصادی ${ctx.economicLifeYears} سال رسیده — بازنگری سرمایه‌گذاری پیشنهاد می‌شود` });
  }

  return out;
}

/* ══════════════════════════ ۹. خلاصهٔ ناوگان ══════════════════════════ */

export type FleetSummary = {
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<EquipmentStatus, number>;
  byOwnership: Record<Ownership, number>;
  active: number;
  inRepair: number;
  avgUtilization: number;
  avgAvailability: number;
  openMaintenance: number;
  accruedRent: number;
  warnings: number;
};

export function fleetSummary(
  equipment: EquipmentRow[],
  metrics: { workHours: number; downtimeHrs: number; periodDays: number }[],
  openMaintenance: number,
  accruedRent: number,
  warnings: number
): FleetSummary {
  const byCategory: Record<string, number> = {};
  const byStatus: Record<EquipmentStatus, number> = { active: 0, idle: 0, repair: 0, disposed: 0 };
  const byOwnership: Record<Ownership, number> = { owned: 0, rented: 0, leased: 0 };
  for (const e of equipment) {
    byCategory[e.Category] = (byCategory[e.Category] ?? 0) + 1;
    byStatus[e.Status] += 1;
    byOwnership[e.Ownership] += 1;
  }
  const utilRates = metrics.map((m) => utilization(m.workHours, m.periodDays, 8).rate);
  const availRates = metrics.map((m) => availability(m.downtimeHrs, Math.max(1, m.periodDays * 24)).rate);
  const avg = (arr: number[]) => (arr.length ? round2(arr.reduce((s, v) => s + v, 0) / arr.length) : 0);
  return {
    total: equipment.length,
    byCategory,
    byStatus,
    byOwnership,
    active: byStatus.active,
    inRepair: byStatus.repair,
    avgUtilization: avg(utilRates),
    avgAvailability: avg(availRates),
    openMaintenance,
    accruedRent: round2(accruedRent),
    warnings,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * افزونهٔ EQP (پراممپت MACHINERY & EQUIPMENT MANAGEMENT v1.0)
 * ---------------------------------------------------------------------------
 * این بخش شکاف‌های پراممپت را می‌بندد بدون تغییر در امضای توابع بالا (سازگاری عقب‌رو).
 * افزوده‌ها: تاکسونومی ISO 14224 · TCO و خرید/اجاره · دیسپچ روزانه · سوخت و مصرفی‌ها ·
 * برنامهٔ PM چهارپایه · گردش‌کار CMMS و RCA · انبار قطعات · هشت شاخص و OEE · EWS-EQP.
 * ═══════════════════════════════════════════════════════════════════════════ */

export const EQP_VERSION = "eqp-v1";

/* ─────────── ۱۰. تاکسونومی ISO 14224 ─────────── */

/** سطح تاکسونومی ISO 14224: 4=دستهٔ تجهیز 5=واحد 6=زیرواحد */
export type Iso14224Node = { code: string; fa: string; en: string; level: 4 | 5 | 6; parent?: string };

export const ISO14224_TAXONOMY: Iso14224Node[] = [
  { code: "ME", fa: "ماشین‌آلات مکانیکی متحرک", en: "Mobile mechanical equipment", level: 4 },
  { code: "ME.EA", fa: "خاک‌برداری", en: "Earthmoving", level: 5, parent: "ME" },
  { code: "ME.LI", fa: "باربرداری", en: "Lifting", level: 5, parent: "ME" },
  { code: "ME.TR", fa: "حمل و نقل", en: "Transport", level: 5, parent: "ME" },
  { code: "ME.CO", fa: "بتن و مصالح", en: "Concrete & materials", level: 5, parent: "ME" },
  { code: "SE", fa: "تجهیزات ثابت", en: "Static equipment", level: 4 },
  { code: "SE.PW", fa: "تولید و توزیع توان", en: "Power generation", level: 5, parent: "SE" },
  { code: "SE.OT", fa: "سایر تجهیزات ثابت", en: "Other static", level: 5, parent: "SE" },
];

export const ISO14224_BY_CODE: Record<string, Iso14224Node> = Object.fromEntries(ISO14224_TAXONOMY.map((n) => [n.code, n]));

/** نگاشت طبقهٔ داخلی به کد تاکسونومی ISO 14224 (سطح ۵). */
export const CLASS_TO_ISO14224: Record<EquipmentClass, string> = {
  earthmoving: "ME.EA",
  lifting: "ME.LI",
  transport: "ME.TR",
  concrete: "ME.CO",
  power: "SE.PW",
  other: "SE.OT",
};

/** کد تاکسونومی ISO 14224 یک ماشین از روی دستهٔ کاتالوگ. */
export function iso14224Code(categoryCode: string): string {
  const cat = CATEGORY_BY_CODE[categoryCode] ?? CATEGORY_BY_CODE["OTH"];
  return CLASS_TO_ISO14224[cat.cls];
}

/** شناسهٔ یکتای اسکن (QR) — قطعی و بدون I/O: PROJECT|CODE|ISO. */
export function equipmentQrPayload(row: Pick<EquipmentRow, "ProjectId" | "Code" | "Category">): string {
  return `EQP:${row.ProjectId}:${row.Code}:${iso14224Code(row.Category)}`;
}

/* ─────────── ۱۱. TCO و خرید در برابر اجاره ─────────── */

export type TcoInput = {
  purchaseValue: number;
  salvageValue?: number;
  lifeYears: number;
  annualOperatingCost?: number;
  annualMaintenanceCost?: number;
  annualInsuranceCost?: number;
  mobilizationCost?: number;
  demobilizationCost?: number;
  annualWorkHours: number;
};

export type Tco = { totalCost: number; annualCost: number; costPerHour: number; depreciationTotal: number; lifetimeHours: number };

/** هزینهٔ کل مالکیت در طول عمر اقتصادی (ADR-09: خط مستقیم، بدون تنزیل). */
export function tco(input: TcoInput): Tco {
  const life = Math.max(1, input.lifeYears);
  const pv = Math.max(0, input.purchaseValue);
  const sv = clamp(input.salvageValue ?? 0, 0, pv);
  const depreciationTotal = pv - sv;
  const annualRunning =
    (input.annualOperatingCost ?? 0) + (input.annualMaintenanceCost ?? 0) + (input.annualInsuranceCost ?? 0);
  const oneOff = (input.mobilizationCost ?? 0) + (input.demobilizationCost ?? 0);
  const totalCost = depreciationTotal + annualRunning * life + oneOff;
  const lifetimeHours = Math.max(1, (input.annualWorkHours || 0) * life);
  return {
    totalCost: round2(totalCost),
    annualCost: round2(totalCost / life),
    costPerHour: round2(totalCost / lifetimeHours),
    depreciationTotal: round2(depreciationTotal),
    lifetimeHours: round2(lifetimeHours),
  };
}

export type BuyVsRent = {
  ownCostPerHour: number;
  rentCostPerHour: number;
  breakEvenHours: number;
  verdict: "buy" | "rent" | "neutral";
  savingPerHour: number;
};

/**
 * نقطهٔ سربه‌سر خرید در برابر اجاره.
 * هزینهٔ مالکیت برای h ساعت = TCO ثابت + هزینهٔ متغیر ساعتی × h؛ هزینهٔ اجاره = نرخ × h.
 * سربه‌سر جایی است که این دو برابر شوند: h = TCO ÷ (نرخ اجاره − هزینهٔ متغیر ساعتی).
 * اگر نرخ اجاره از هزینهٔ متغیر مالکیت بیشتر نباشد، اجاره هرگز به‌صرفه نمی‌شود (بی‌نهایت).
 */
export function buyVsRent(
  own: TcoInput,
  rentalHourlyRate: number,
  variableOwnCostPerHour = 0
): BuyVsRent {
  const t = tco(own);
  const rent = Math.max(0, rentalHourlyRate);
  const margin = rent - Math.max(0, variableOwnCostPerHour);
  const breakEvenHours = margin > 0 ? t.totalCost / margin : Infinity;
  const saving = rent - (t.costPerHour + Math.max(0, variableOwnCostPerHour));
  const verdict: BuyVsRent["verdict"] =
    Math.abs(saving) < rent * 0.05 ? "neutral" : saving > 0 ? "buy" : "rent";
  return {
    ownCostPerHour: t.costPerHour,
    rentCostPerHour: round2(rent),
    breakEvenHours: Number.isFinite(breakEvenHours) ? round2(breakEvenHours) : Infinity,
    verdict,
    savingPerHour: round2(saving),
  };
}

/* ─────────── ۱۲. دیسپچ روزانه ─────────── */

export type DispatchStatus = "draft" | "submitted" | "approved" | "rejected" | "executed" | "cancelled";
export const DISPATCH_STATUSES: DispatchStatus[] = ["draft", "submitted", "approved", "rejected", "executed", "cancelled"];

export type Shift = "day" | "night" | "full";
export const SHIFTS: Shift[] = ["day", "night", "full"];

export type DispatchRow = {
  Id?: string;
  ProjectId: string;
  EquipmentId: string;
  DispatchDate: string;
  Shift: Shift;
  OperatorId?: string;
  ActivityId?: string;
  CostAccountId?: string;
  SiteFa?: string;
  PlannedHours: number;
  PlannedQty?: number;
  QtyUom?: string;
  SafetyCheck?: boolean;
  Status: DispatchStatus;
  ApprovedBy?: string;
  NoteFa?: string;
};

export function validateDispatch(row: Record<string, unknown>): CheckResult {
  const issues: Issue[] = [];
  required(row, "ProjectId", issues, "پروژه");
  required(row, "EquipmentId", issues, "ماشین‌آلات");
  required(row, "DispatchDate", issues, "تاریخ دیسپچ");
  required(row, "Shift", issues, "شیفت");
  required(row, "Status", issues, "وضعیت");
  if (typeof row.Shift === "string" && !SHIFTS.includes(row.Shift as Shift)) {
    issues.push({ code: "E-EQP-SHIFT", column: "Shift", message: `شیفت نامعتبر: ${row.Shift}` });
  }
  if (typeof row.Status === "string" && !DISPATCH_STATUSES.includes(row.Status as DispatchStatus)) {
    issues.push({ code: "E-EQP-DSTATUS", column: "Status", message: `وضعیت دیسپچ نامعتبر: ${row.Status}` });
  }
  const hours = optionalNumber(row.PlannedHours);
  if (hours !== undefined && (hours <= 0 || hours > 24)) {
    issues.push({ code: "E-EQP-HOURS", column: "PlannedHours", message: "ساعت برنامه باید بین ۰ و ۲۴ باشد" });
  }
  const qty = optionalNumber(row.PlannedQty);
  if (qty !== undefined && qty < 0) {
    issues.push({ code: "E-EQP-QTY", column: "PlannedQty", message: "حجم برنامه نمی‌تواند منفی باشد" });
  }
  return { ok: issues.length === 0, issues };
}

export type DispatchGate = { code: string; passed: boolean; message: string; blocking: boolean };
export type DispatchPrecheck = { allowed: boolean; gates: DispatchGate[]; blockers: number };

export type DispatchContext = {
  nowIso: string;
  equipment: EquipmentRow;
  openCriticalOrders: number;
  pmOverdueDays: number;
  operatorLicenseExpiry?: string;
  operatorAssigned: boolean;
  safetyCheckDone: boolean;
  rentalActive?: boolean;
};

/** دروازه‌های پیش‌نیاز دیسپچ (تحویلی ۵ پراممپت). هر دروازهٔ blocking شکست‌خورده دیسپچ را مسدود می‌کند. */
export function dispatchPrecheck(ctx: DispatchContext): DispatchPrecheck {
  const gates: DispatchGate[] = [];

  const operable = ctx.equipment.Status === "active";
  gates.push({
    code: "G-EQP-STATUS",
    passed: operable,
    blocking: true,
    message: operable ? "ماشین در وضعیت عملیاتی است" : `ماشین در وضعیت «${ctx.equipment.Status}» قابل دیسپچ نیست`,
  });

  gates.push({
    code: "G-EQP-NOCRIT",
    passed: ctx.openCriticalOrders === 0,
    blocking: true,
    message: ctx.openCriticalOrders === 0 ? "دستورکار بحرانی باز ندارد" : `${ctx.openCriticalOrders} دستورکار بحرانی باز دارد`,
  });

  const pmOk = ctx.pmOverdueDays <= 0;
  gates.push({
    code: "G-EQP-PM",
    passed: pmOk,
    blocking: ctx.pmOverdueDays > 7,
    message: pmOk ? "سرویس دوره‌ای به‌روز است" : `سرویس دوره‌ای ${ctx.pmOverdueDays} روز معوق است`,
  });

  gates.push({
    code: "G-EQP-OPERATOR",
    passed: ctx.operatorAssigned,
    blocking: true,
    message: ctx.operatorAssigned ? "اپراتور تخصیص یافته است" : "اپراتور تخصیص نیافته است",
  });

  if (ctx.operatorLicenseExpiry) {
    const left = daysBetween(ctx.nowIso, ctx.operatorLicenseExpiry);
    const valid = Date.parse(ctx.operatorLicenseExpiry) >= Date.parse(ctx.nowIso);
    gates.push({
      code: "G-EQP-LICENSE",
      passed: valid,
      blocking: true,
      message: valid ? `گواهی‌نامه اپراتور تا ${left} روز دیگر معتبر است` : "گواهی‌نامه اپراتور منقضی شده است",
    });
  }

  gates.push({
    code: "G-EQP-SAFETY",
    passed: ctx.safetyCheckDone,
    blocking: true,
    message: ctx.safetyCheckDone ? "چک‌لیست ایمنی پیش از استارت انجام شده" : "چک‌لیست ایمنی پیش از استارت انجام نشده",
  });

  if (ctx.equipment.Ownership !== "owned") {
    const active = ctx.rentalActive !== false;
    gates.push({
      code: "G-EQP-RENTAL",
      passed: active,
      blocking: false,
      message: active ? "قرارداد اجاره فعال است" : "قرارداد اجاره فعال یافت نشد",
    });
  }

  const blockers = gates.filter((g) => g.blocking && !g.passed).length;
  return { allowed: blockers === 0, gates, blockers };
}

/** گذارهای مجاز وضعیت دیسپچ. */
export const DISPATCH_FLOW: Record<DispatchStatus, DispatchStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["executed", "cancelled"],
  rejected: ["draft", "cancelled"],
  executed: [],
  cancelled: [],
};

export function canAdvanceDispatch(from: DispatchStatus, to: DispatchStatus): boolean {
  return (DISPATCH_FLOW[from] ?? []).includes(to);
}

/* ─────────── ۱۳. سوخت و مصرفی‌ها ─────────── */

export type FuelKind = "diesel" | "gasoline" | "oil" | "grease" | "tire" | "other";
export const FUEL_KINDS: FuelKind[] = ["diesel", "gasoline", "oil", "grease", "tire", "other"];

export type FuelLogRow = {
  Id?: string;
  ProjectId: string;
  EquipmentId: string;
  LogDate: string;
  Kind: FuelKind;
  Quantity: number;
  Uom?: string;
  UnitCost?: number;
  HourMeter?: number;
  IssuedBy?: string;
};

export function validateFuelLog(row: Record<string, unknown>): CheckResult {
  const issues: Issue[] = [];
  required(row, "ProjectId", issues, "پروژه");
  required(row, "EquipmentId", issues, "ماشین‌آلات");
  required(row, "LogDate", issues, "تاریخ ثبت");
  required(row, "Kind", issues, "نوع مصرفی");
  required(row, "Quantity", issues, "مقدار");
  if (typeof row.Kind === "string" && !FUEL_KINDS.includes(row.Kind as FuelKind)) {
    issues.push({ code: "E-EQP-FUEL-KIND", column: "Kind", message: `نوع مصرفی نامعتبر: ${row.Kind}` });
  }
  const qty = optionalNumber(row.Quantity);
  if (qty !== undefined && qty <= 0) {
    issues.push({ code: "E-EQP-FUEL-QTY", column: "Quantity", message: "مقدار مصرفی باید بزرگ‌تر از صفر باشد" });
  }
  const cost = optionalNumber(row.UnitCost);
  if (cost !== undefined && cost < 0) {
    issues.push({ code: "E-EQP-FUEL-COST", column: "UnitCost", message: "بهای واحد نمی‌تواند منفی باشد" });
  }
  return { ok: issues.length === 0, issues };
}

export type FuelSummary = { quantity: number; cost: number; byKind: Record<string, { quantity: number; cost: number }> };

export function fuelSummary(logs: FuelLogRow[]): FuelSummary {
  const byKind: Record<string, { quantity: number; cost: number }> = {};
  let quantity = 0;
  let cost = 0;
  for (const l of logs) {
    const q = Number(l.Quantity) || 0;
    const c = q * (Number(l.UnitCost) || 0);
    byKind[l.Kind] = byKind[l.Kind] ?? { quantity: 0, cost: 0 };
    byKind[l.Kind].quantity = round2(byKind[l.Kind].quantity + q);
    byKind[l.Kind].cost = round2(byKind[l.Kind].cost + c);
    if (l.Kind === "diesel" || l.Kind === "gasoline") quantity += q;
    cost += c;
  }
  return { quantity: round2(quantity), cost: round2(cost), byKind };
}

/** مصرف ویژه سوخت (لیتر بر ساعت کارکرد) — شاخص ۸ پراممپت. */
export function specificFuelConsumption(
  fuelLitres: number,
  workHours: number,
  benchmark?: number
): { sfc: number; verdict: "efficient" | "normal" | "excessive" | "unknown" } {
  const hours = Number(workHours) || 0;
  if (hours <= 0) return { sfc: 0, verdict: "unknown" };
  const sfc = round2(Math.max(0, fuelLitres) / hours);
  if (benchmark === undefined || benchmark <= 0) return { sfc, verdict: "unknown" };
  const ratio = sfc / benchmark;
  return { sfc, verdict: ratio > 1.15 ? "excessive" : ratio < 0.85 ? "efficient" : "normal" };
}

/* ─────────── ۱۴. برنامهٔ نگهداری پیشگیرانه (چهارپایه) ─────────── */

export type PmBasis = "run_hours" | "kilometers" | "calendar_days" | "cycles";
export const PM_BASES: PmBasis[] = ["run_hours", "kilometers", "calendar_days", "cycles"];

export type PmScheduleRow = {
  Id?: string;
  ProjectId: string;
  EquipmentId: string;
  Code: string;
  TitleFa: string;
  Basis: PmBasis;
  IntervalValue: number;
  LastDoneAt?: string;
  LastDoneReading?: number;
  ChecklistFa?: string;
  Active?: boolean;
};

export function validatePmSchedule(row: Record<string, unknown>): CheckResult {
  const issues: Issue[] = [];
  required(row, "ProjectId", issues, "پروژه");
  required(row, "EquipmentId", issues, "ماشین‌آلات");
  required(row, "Code", issues, "کد برنامه");
  required(row, "TitleFa", issues, "عنوان");
  required(row, "Basis", issues, "پایهٔ دوره");
  required(row, "IntervalValue", issues, "بازهٔ دوره");
  if (typeof row.Basis === "string" && !PM_BASES.includes(row.Basis as PmBasis)) {
    issues.push({ code: "E-EQP-PM-BASIS", column: "Basis", message: `پایهٔ دوره نامعتبر: ${row.Basis}` });
  }
  const iv = optionalNumber(row.IntervalValue);
  if (iv !== undefined && iv <= 0) {
    issues.push({ code: "E-EQP-PM-INTERVAL", column: "IntervalValue", message: "بازهٔ دوره باید بزرگ‌تر از صفر باشد" });
  }
  return { ok: issues.length === 0, issues };
}

export type PmDue = {
  basis: PmBasis;
  /** مانده تا سررسید بر حسب واحد پایه (ساعت/کیلومتر/روز/سیکل) */
  remaining: number;
  overdue: boolean;
  /** تاریخ تخمینی سررسید (فقط برای پایه‌های قابل تصویر روی تقویم) */
  dueIso?: string;
  /** درصد پیشرفت دوره (۰ تا ۱۰۰+) */
  progressPct: number;
  severity: "ok" | "soon" | "due" | "overdue";
};

/**
 * سررسید PM بر پایهٔ چهار مبنا. برای پایه‌های شمارنده‌ای (ساعت/کیلومتر/سیکل)
 * `currentReading` لازم است؛ برای تبدیل به تاریخ، `avgPerDay` مصرف روزانه.
 */
export function pmDueByBasis(
  schedule: Pick<PmScheduleRow, "Basis" | "IntervalValue" | "LastDoneAt" | "LastDoneReading">,
  nowIso: string,
  currentReading?: number,
  avgPerDay?: number
): PmDue {
  const interval = Math.max(0, Number(schedule.IntervalValue) || 0);
  if (interval <= 0) return { basis: schedule.Basis, remaining: 0, overdue: false, progressPct: 0, severity: "ok" };

  if (schedule.Basis === "calendar_days") {
    const due = nextPmDue(schedule.LastDoneAt, interval, nowIso);
    const consumed = interval - due.daysLeft;
    const progressPct = round2(clamp((consumed / interval) * 100, 0, 999));
    return {
      basis: schedule.Basis,
      remaining: due.daysLeft,
      overdue: due.overdue,
      dueIso: due.dueIso || undefined,
      progressPct,
      severity: due.overdue ? "overdue" : due.daysLeft === 0 ? "due" : due.daysLeft <= 7 ? "soon" : "ok",
    };
  }

  const base = Number(schedule.LastDoneReading) || 0;
  const now = Number(currentReading) || 0;
  const consumed = Math.max(0, now - base);
  const remaining = round2(interval - consumed);
  const progressPct = round2(clamp((consumed / interval) * 100, 0, 999));
  const perDay = Number(avgPerDay) || 0;
  const dueIso =
    perDay > 0 && remaining > 0
      ? new Date(Date.parse(nowIso) + (remaining / perDay) * 86_400_000).toISOString().slice(0, 10)
      : undefined;
  const daysLeft = perDay > 0 ? remaining / perDay : Infinity;
  return {
    basis: schedule.Basis,
    remaining,
    overdue: remaining < 0,
    dueIso,
    progressPct,
    severity: remaining < 0 ? "overdue" : remaining === 0 ? "due" : daysLeft <= 7 || progressPct >= 90 ? "soon" : "ok",
  };
}

/** انطباق برنامهٔ نگهداری: نسبت PM انجام‌شدهٔ به‌موقع به کل PM سررسیدشده. */
export function pmCompliance(
  orders: MaintenanceOrderRow[],
  plannedCount: number
): { rate: number; done: number; planned: number; verdict: "poor" | "fair" | "good" } {
  const done = orders.filter((o) => (o.Kind === "preventive" || o.Kind === "inspection") && (o.Status === "done" || o.Status === "closed")).length;
  const planned = Math.max(0, plannedCount);
  const rate = planned > 0 ? round2(clamp((done / planned) * 100, 0, 100)) : 100;
  return { rate, done, planned, verdict: rate < 70 ? "poor" : rate < 90 ? "fair" : "good" };
}

/* ─────────── ۱۵. گردش‌کار CMMS و تحلیل ریشه‌ای ─────────── */

/** گردش‌کار کامل تحویلی ۸ پراممپت. وضعیت‌های پایه (open/in_progress/done/closed) حفظ شده‌اند. */
export type WoStage = "requested" | "approved" | "in_progress" | "awaiting_parts" | "completed" | "verified" | "cancelled";
export const WO_STAGES: WoStage[] = ["requested", "approved", "in_progress", "awaiting_parts", "completed", "verified", "cancelled"];

export const WO_FLOW: Record<WoStage, WoStage[]> = {
  requested: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["awaiting_parts", "completed", "cancelled"],
  awaiting_parts: ["in_progress", "cancelled"],
  completed: ["verified", "in_progress"],
  verified: [],
  cancelled: [],
};

export function canAdvanceWo(from: WoStage, to: WoStage): boolean {
  return (WO_FLOW[from] ?? []).includes(to);
}

/** نگاشت مرحلهٔ CMMS به وضعیت سادهٔ ذخیره‌شده در `MaintenanceOrder.Status`. */
export function woStageToStatus(stage: WoStage): MaintenanceStatus {
  if (stage === "requested" || stage === "approved" || stage === "awaiting_parts") return stage === "awaiting_parts" ? "in_progress" : "open";
  if (stage === "in_progress") return "in_progress";
  if (stage === "completed") return "done";
  return "closed";
}

/** طبقه‌بندی علت ریشه‌ای بر پایهٔ ISO 14224. */
export type RcaCause = "mechanical" | "electrical" | "hydraulic" | "instrument" | "software" | "structural" | "human" | "external";
export const RCA_CAUSES: RcaCause[] = ["mechanical", "electrical", "hydraulic", "instrument", "software", "structural", "human", "external"];

export const RCA_CAUSE_FA: Record<RcaCause, string> = {
  mechanical: "مکانیکی",
  electrical: "الکتریکی",
  hydraulic: "هیدرولیکی",
  instrument: "ابزار دقیق",
  software: "نرم‌افزاری",
  structural: "سازه‌ای",
  human: "خطای انسانی",
  external: "عوامل بیرونی",
};

/** توزیع علل خرابی برای نمودار پارتو (تحلیل ریشه‌ای ناوگان). */
export function rcaPareto(orders: (MaintenanceOrderRow & { RootCause?: string })[]): { cause: string; count: number; pct: number; cumulativePct: number }[] {
  const failures = orders.filter((o) => o.Kind === "corrective" || o.Kind === "overhaul");
  const counts: Record<string, number> = {};
  for (const o of failures) {
    const key = o.RootCause && RCA_CAUSES.includes(o.RootCause as RcaCause) ? o.RootCause : "external";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const total = failures.length;
  let cum = 0;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => {
      const pct = total > 0 ? round2((count / total) * 100) : 0;
      cum = round2(cum + pct);
      return { cause, count, pct, cumulativePct: cum };
    });
}

/* ─────────── ۱۶. انبار قطعات یدکی ─────────── */

export type SparePartRow = {
  Id?: string;
  ProjectId: string;
  PartNo: string;
  NameFa: string;
  Uom?: string;
  OnHand: number;
  MinLevel: number;
  LeadTimeDays?: number;
  AvgDailyUsage?: number;
  UnitCost?: number;
  Critical?: boolean;
  EquipmentCategory?: string;
};

export function validateSparePart(row: Record<string, unknown>): CheckResult {
  const issues: Issue[] = [];
  required(row, "ProjectId", issues, "پروژه");
  required(row, "PartNo", issues, "کد قطعه");
  required(row, "NameFa", issues, "نام قطعه");
  required(row, "OnHand", issues, "موجودی");
  required(row, "MinLevel", issues, "حداقل موجودی");
  const onHand = optionalNumber(row.OnHand);
  if (onHand !== undefined && onHand < 0) {
    issues.push({ code: "E-EQP-PART-STOCK", column: "OnHand", message: "موجودی نمی‌تواند منفی باشد" });
  }
  const min = optionalNumber(row.MinLevel);
  if (min !== undefined && min < 0) {
    issues.push({ code: "E-EQP-PART-MIN", column: "MinLevel", message: "حداقل موجودی نمی‌تواند منفی باشد" });
  }
  const lead = optionalNumber(row.LeadTimeDays);
  if (lead !== undefined && lead < 0) {
    issues.push({ code: "E-EQP-PART-LEAD", column: "LeadTimeDays", message: "زمان تأمین نمی‌تواند منفی باشد" });
  }
  return { ok: issues.length === 0, issues };
}

/** نقطهٔ سفارش مجدد = مصرف روزانه × زمان تأمین + ذخیرهٔ اطمینان (حداقل موجودی). */
export function reorderPoint(avgDailyUsage: number, leadTimeDays: number, minLevel = 0): number {
  return round2(Math.max(0, avgDailyUsage) * Math.max(0, leadTimeDays) + Math.max(0, minLevel));
}

export type PartStock = {
  rop: number;
  status: "ok" | "reorder" | "shortage" | "out";
  suggestedQty: number;
  daysOfCover: number;
  critical: boolean;
};

export function partStockStatus(part: SparePartRow, coverDays = 30): PartStock {
  const onHand = Math.max(0, Number(part.OnHand) || 0);
  const min = Math.max(0, Number(part.MinLevel) || 0);
  const usage = Math.max(0, Number(part.AvgDailyUsage) || 0);
  const lead = Math.max(0, Number(part.LeadTimeDays) || 0);
  const rop = reorderPoint(usage, lead, min);
  const status: PartStock["status"] = onHand <= 0 ? "out" : onHand < min ? "shortage" : onHand <= rop ? "reorder" : "ok";
  const target = usage > 0 ? usage * (lead + coverDays) : Math.max(min * 2, rop);
  const suggestedQty = status === "ok" ? 0 : round2(Math.max(0, target - onHand));
  const daysOfCover = usage > 0 ? round2(onHand / usage) : Infinity;
  return { rop, status, suggestedQty, daysOfCover: Number.isFinite(daysOfCover) ? daysOfCover : 9999, critical: part.Critical === true };
}

/** فهرست قطعاتی که باید برایشان درخواست خرید صادر شود (ورودی PR در FIN). */
export function partsToRequisition(parts: SparePartRow[], coverDays = 30): { part: SparePartRow; stock: PartStock }[] {
  return parts
    .map((part) => ({ part, stock: partStockStatus(part, coverDays) }))
    .filter((x) => x.stock.status !== "ok")
    .sort((a, b) => {
      if (a.stock.critical !== b.stock.critical) return a.stock.critical ? -1 : 1;
      const rank = { out: 0, shortage: 1, reorder: 2, ok: 3 } as const;
      return rank[a.stock.status] - rank[b.stock.status];
    });
}

/* ─────────── ۱۷. OEE و کاتالوگ هشت‌گانهٔ شاخص‌ها ─────────── */

export type Oee = {
  availability: number;
  performance: number;
  quality: number;
  utilization: number;
  oee: number;
  verdict: "poor" | "fair" | "good" | "world_class";
};

/**
 * OEE = دسترس‌پذیری × عملکرد × کیفیت (درصد).
 * عملکرد = تولید واقعی ÷ تولید نظری در ساعات کارکرد؛ کیفیت = تولید سالم ÷ کل تولید.
 */
export function oee(input: {
  downtimeHours: number;
  periodHours: number;
  workHours: number;
  actualOutput: number;
  ratedOutputPerHour: number;
  goodOutput?: number;
}): Oee {
  const av = availability(input.downtimeHours, input.periodHours).rate;
  const theoretical = Math.max(0, input.workHours) * Math.max(0, input.ratedOutputPerHour);
  const perf = theoretical > 0 ? clamp((Math.max(0, input.actualOutput) / theoretical) * 100, 0, 100) : 0;
  const good = input.goodOutput === undefined ? input.actualOutput : input.goodOutput;
  const qual = input.actualOutput > 0 ? clamp((Math.max(0, good) / input.actualOutput) * 100, 0, 100) : 100;
  const value = (av / 100) * (perf / 100) * (qual / 100) * 100;
  const util = utilization(input.workHours, Math.max(1, input.periodHours / 24), 8).rate;
  return {
    availability: round2(av),
    performance: round2(perf),
    quality: round2(qual),
    utilization: round2(util),
    oee: round2(value),
    verdict: value >= 85 ? "world_class" : value >= 60 ? "good" : value >= 40 ? "fair" : "poor",
  };
}

/** نسبت هزینهٔ نگهداری به ارزش دارایی (شاخص ۶). */
export function maintenanceCostRatio(maintenanceCost: number, assetValue: number): { ratio: number; verdict: "healthy" | "watch" | "critical" } {
  const value = Math.max(0, assetValue);
  const ratio = value > 0 ? round2((Math.max(0, maintenanceCost) / value) * 100) : 0;
  return { ratio, verdict: ratio > 15 ? "critical" : ratio > 8 ? "watch" : "healthy" };
}

export type EqpKpiDef = { code: string; fa: string; en: string; unit: string; direction: "higher" | "lower"; target: number };

/** کاتالوگ هشت شاخص اختصاصی ماشین‌آلات (تحویلی ۱۰ پراممپت). */
export const EQP_KPI_CATALOG: EqpKpiDef[] = [
  { code: "K-EQP-AVAIL", fa: "دسترس‌پذیری", en: "Availability", unit: "٪", direction: "higher", target: 95 },
  { code: "K-EQP-UTIL", fa: "بهره‌برداری", en: "Utilization", unit: "٪", direction: "higher", target: 70 },
  { code: "K-EQP-OEE", fa: "اثربخشی کلی تجهیز", en: "OEE", unit: "٪", direction: "higher", target: 65 },
  { code: "K-EQP-MTBF", fa: "میانگین زمان بین خرابی", en: "MTBF", unit: "ساعت", direction: "higher", target: 500 },
  { code: "K-EQP-MTTR", fa: "میانگین زمان تعمیر", en: "MTTR", unit: "ساعت", direction: "lower", target: 8 },
  { code: "K-EQP-MCR", fa: "نسبت هزینه نگهداری", en: "Maintenance cost ratio", unit: "٪", direction: "lower", target: 8 },
  { code: "K-EQP-PMC", fa: "انطباق نگهداری پیشگیرانه", en: "PM compliance", unit: "٪", direction: "higher", target: 90 },
  { code: "K-EQP-SFC", fa: "مصرف ویژه سوخت", en: "Specific fuel consumption", unit: "لیتر/ساعت", direction: "lower", target: 18 },
];

export const EQP_KPI_BY_CODE: Record<string, EqpKpiDef> = Object.fromEntries(EQP_KPI_CATALOG.map((k) => [k.code, k]));

/** نمرهٔ سلامت ماشین (۰ تا ۱۰۰) برای سهم در شاخص سلامت پروژه (PHI). */
export function equipmentHealthScore(input: {
  availabilityPct: number;
  utilizationPct: number;
  pmCompliancePct: number;
  criticalBacklog: number;
  agingRatio: number;
}): { score: number; grade: "A" | "B" | "C" | "D" } {
  const av = clamp(input.availabilityPct, 0, 100) * 0.35;
  const ut = clamp(input.utilizationPct, 0, 100) * 0.2;
  const pm = clamp(input.pmCompliancePct, 0, 100) * 0.25;
  const backlogPenalty = Math.min(20, Math.max(0, input.criticalBacklog) * 10);
  const agingScore = clamp((1 - Math.max(0, input.agingRatio)) * 100, 0, 100) * 0.2;
  const score = round2(clamp(av + ut + pm + agingScore - backlogPenalty, 0, 100));
  return { score, grade: score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D" };
}

/* ─────────── ۱۸. قواعد شش‌گانهٔ هشدار زودهنگام EWS-EQP ─────────── */

export type EwsEqpRule = { code: string; fa: string; condition: string; severity: "info" | "warning" | "critical"; escalateTo: string };

export const EWS_EQP_RULES: EwsEqpRule[] = [
  { code: "EWS-EQP-01", fa: "دسترس‌پذیری زیر ۸۵٪", condition: "availability < 85", severity: "critical", escalateTo: "مدیر پروژه" },
  { code: "EWS-EQP-02", fa: "بهره‌برداری زیر آستانهٔ دسته", condition: "utilization < categoryLow", severity: "warning", escalateTo: "مدیر ماشین‌آلات" },
  { code: "EWS-EQP-03", fa: "سرویس دوره‌ای معوق", condition: "pmOverdueDays > 0", severity: "critical", escalateTo: "رئیس نگهداری" },
  { code: "EWS-EQP-04", fa: "دستورکار بحرانی باز", condition: "criticalBacklog > 0", severity: "critical", escalateTo: "مدیر ماشین‌آلات" },
  { code: "EWS-EQP-05", fa: "مصرف سوخت بالاتر از معیار", condition: "sfc > benchmark * 1.15", severity: "warning", escalateTo: "سرپرست کارگاه" },
  { code: "EWS-EQP-06", fa: "انقضای اجاره/بیمه/معاینه فنی", condition: "daysToExpiry <= 14", severity: "warning", escalateTo: "امور قراردادها" },
];

export type EwsEqpInput = {
  availabilityPct: number;
  utilizationPct: number;
  utilLowPct: number;
  pmOverdueDays: number;
  criticalBacklog: number;
  sfc?: number;
  sfcBenchmark?: number;
  daysToExpiry?: number;
};

export function ewsEqp(input: EwsEqpInput): (EqmWarning & { rule: string; escalateTo: string })[] {
  const out: (EqmWarning & { rule: string; escalateTo: string })[] = [];
  const push = (rule: EwsEqpRule, message: string) =>
    out.push({ code: rule.code, rule: rule.code, severity: rule.severity, message, escalateTo: rule.escalateTo });

  if (input.availabilityPct < 85) push(EWS_EQP_RULES[0], `دسترس‌پذیری ${round2(input.availabilityPct)}٪ زیر حد ۸۵٪ است`);
  if (input.utilizationPct < input.utilLowPct) push(EWS_EQP_RULES[1], `بهره‌برداری ${round2(input.utilizationPct)}٪ زیر آستانهٔ ${input.utilLowPct}٪ دسته است`);
  if (input.pmOverdueDays > 0) push(EWS_EQP_RULES[2], `سرویس دوره‌ای ${input.pmOverdueDays} روز معوق است`);
  if (input.criticalBacklog > 0) push(EWS_EQP_RULES[3], `${input.criticalBacklog} دستورکار بحرانی باز دارد`);
  if (input.sfc !== undefined && input.sfcBenchmark !== undefined && input.sfcBenchmark > 0 && input.sfc > input.sfcBenchmark * 1.15) {
    push(EWS_EQP_RULES[4], `مصرف ویژه سوخت ${input.sfc} لیتر/ساعت بالاتر از معیار ${input.sfcBenchmark} است`);
  }
  if (input.daysToExpiry !== undefined && input.daysToExpiry <= 14) {
    push(EWS_EQP_RULES[5], `مدارک/قرارداد تا ${input.daysToExpiry} روز دیگر منقضی می‌شود`);
  }
  return out;
}

/* ─────────── ۱۹. خلاصهٔ توسعه‌یافتهٔ ناوگان ─────────── */

export type FleetKpiBoard = {
  availability: number;
  utilization: number;
  /** null یعنی تولید واقعی ثبت نشده و OEE سنجش‌ناپذیر است (فرض ۱۰۰٪ گمراه‌کننده بود). */
  oee: number | null;
  mtbfHours: number | null;
  mttrHours: number | null;
  maintenanceCostRatio: number;
  pmCompliance: number;
  sfc: number;
  healthScore: number;
  grade: "A" | "B" | "C" | "D";
};

/** تابلوی هشت شاخص در سطح ناوگان — ورودی مستقیم داشبورد و MON. */
export function fleetKpiBoard(input: {
  equipment: EquipmentRow[];
  metrics: { workHours: number; downtimeHrs: number; periodDays: number }[];
  orders: MaintenanceOrderRow[];
  plannedPmCount: number;
  maintenanceCost: number;
  assetValue: number;
  fuelLitres: number;
  actualOutput?: number;
  ratedOutputPerHour?: number;
  periodDays: number;
}): FleetKpiBoard {
  const totalWork = round2(input.metrics.reduce((s, m) => s + m.workHours, 0));
  const totalDown = round2(input.metrics.reduce((s, m) => s + m.downtimeHrs, 0));
  const periodHours = Math.max(1, input.periodDays * 24) * Math.max(1, input.equipment.length);
  const av = availability(totalDown, periodHours);
  const ut = utilization(totalWork, Math.max(1, input.periodDays) * Math.max(1, input.equipment.length), 8);
  const measurable = input.actualOutput !== undefined && (input.ratedOutputPerHour ?? 0) > 0;
  const o = measurable
    ? oee({
        downtimeHours: totalDown,
        periodHours,
        workHours: totalWork,
        actualOutput: input.actualOutput!,
        ratedOutputPerHour: input.ratedOutputPerHour!,
      })
    : null;
  const reliabilityMtbf = mtbf(input.orders, periodHours, totalDown);
  const repair = mttr(input.orders);
  const mcr = maintenanceCostRatio(input.maintenanceCost, input.assetValue);
  const pmc = pmCompliance(input.orders, input.plannedPmCount);
  const sfcResult = specificFuelConsumption(input.fuelLitres, totalWork);
  const backlog = maintenanceBacklog(input.orders);
  const health = equipmentHealthScore({
    availabilityPct: av.rate,
    utilizationPct: ut.rate,
    pmCompliancePct: pmc.rate,
    criticalBacklog: backlog.byPriority.critical,
    agingRatio: 0.3,
  });
  return {
    availability: av.rate,
    utilization: ut.rate,
    oee: o ? o.oee : null,
    mtbfHours: reliabilityMtbf ? reliabilityMtbf.mtbfHours : null,
    mttrHours: repair ? repair.mttrHours : null,
    maintenanceCostRatio: mcr.ratio,
    pmCompliance: pmc.rate,
    sfc: sfcResult.sfc,
    healthScore: health.score,
    grade: health.grade,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DELIVERABLE 11 — مرکز گزارش‌ها و خروجی‌های A4 سه‌لوگو (EQP-RPT)
 * ---------------------------------------------------------------------------
 * 📌 موجود: موتور `rpt-v1` (سربرگ سه‌لوگو، صفحه‌بندی A4، PDF/Word/Excel/CSV،
 *    دروازهٔ انتشار، رنگ‌بندی پریماورا) — بازنویسی نشد و از آن استفاده می‌شود.
 * 🔧 بهبود: دروازهٔ انتشار عمومی با مسدودکننده‌های اختصاصی ناوگان تکمیل شد.
 * ✨ جدید: شش سازندهٔ گزارش ماشین‌آلات که از دادهٔ خام `ReportDef` می‌سازند.
 *
 * اصل حاکم (هم‌راستا با اصل ۲ موتور گزارش): این توابع هیچ عددی «نمی‌سازند» —
 * فقط داده‌ای که موتورهای بالا محاسبه کرده‌اند را به ساختار گزارش ترجمه می‌کنند.
 * ═══════════════════════════════════════════════════════════════════════════ */

export const EQP_REPORT_VERSION = "eqp-rpt-v1";

/** ساختار حداقلی گزارش — عمداً با `ReportDef` موتور rpt-v1 هم‌ریخت است تا
 *  بدون وابستگی متقابل بین دو فایل، خروجی مستقیم به سریال‌سازهای آن داده شود. */
export type EqpBi = { fa: string; en: string };

export type EqpColumn = {
  key: string;
  title: EqpBi;
  format?: "text" | "number" | "percent" | "currency" | "date" | "status";
  align?: "start" | "center" | "end";
};

export type EqpRow = Record<string, string | number | undefined>;

export type EqpSection =
  | { kind: "kpi"; title: EqpBi; cells: { label: EqpBi; value: string; tone?: "good" | "warn" | "bad" }[] }
  | { kind: "table"; title: EqpBi; note?: EqpBi; columns: EqpColumn[]; rows: EqpRow[] }
  | { kind: "text"; title: EqpBi; body: EqpBi };

export type EqpReport = {
  code: string;
  title: EqpBi;
  periodicity: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "milestone" | "adhoc";
  sourceModule: string;
  audiences: ("internal" | "official")[];
  sections: EqpSection[];
};

export type EqpReportDef = {
  code: string;
  title: EqpBi;
  periodicity: EqpReport["periodicity"];
  audiences: EqpReport["audiences"];
  /** توضیح یک‌خطی برای فهرست مرکز گزارش */
  purpose: EqpBi;
};

/** فهرست شش گزارش رسمی ماشین‌آلات (تحویلی ۱۱). */
export const EQP_REPORT_CATALOG: EqpReportDef[] = [
  { code: "RPT-EQP-DSP", title: { fa: "برگه دیسپچ روزانه", en: "Daily Dispatch Sheet" }, periodicity: "daily", audiences: ["internal", "official"], purpose: { fa: "تخصیص روزانه ماشین و اپراتور با نتیجه دروازه‌های پیش‌نیاز", en: "daily machine and operator assignment with gate results" } },
  { code: "RPT-EQP-CARD", title: { fa: "کارت شناسنامه ماشین", en: "Equipment ID Card" }, periodicity: "adhoc", audiences: ["internal", "official"], purpose: { fa: "مشخصات فنی، تاکسونومی، ارزش دفتری و تاریخچه تعمیرات یک ماشین", en: "specs, taxonomy, book value and maintenance history of one machine" } },
  { code: "RPT-EQP-MNT", title: { fa: "گزارش دوره‌ای تعمیرات", en: "Periodic Maintenance Report" }, periodicity: "monthly", audiences: ["internal", "official"], purpose: { fa: "دستورکارها، توقف، انطباق نگهداری و توزیع پارتو علل خرابی", en: "work orders, downtime, PM compliance and failure Pareto" } },
  { code: "RPT-EQP-PERF", title: { fa: "گزارش بهره‌وری ناوگان", en: "Fleet Performance Report" }, periodicity: "monthly", audiences: ["internal", "official"], purpose: { fa: "هشت شاخص، OEE، نمره سلامت و هشدارهای زودهنگام", en: "eight KPIs, OEE, health score and early warnings" } },
  { code: "RPT-EQP-COST", title: { fa: "گزارش تخصیص هزینه ماشین‌آلات", en: "Equipment Cost Allocation Report" }, periodicity: "monthly", audiences: ["internal", "official"], purpose: { fa: "هزینه اجاره، تعمیرات و سوخت به تفکیک ماشین و هزینه بر ساعت", en: "rental, maintenance and fuel cost per machine and cost per hour" } },
  { code: "RPT-EQP-PART", title: { fa: "گزارش موجودی و سفارش قطعات", en: "Spare Parts Stock & Reorder Report" }, periodicity: "monthly", audiences: ["internal"], purpose: { fa: "موجودی، نقطه سفارش و پیش‌نویس درخواست خرید", en: "stock, reorder point and draft purchase requisition" } },
  { code: "RPT-EQP-EXEC", title: { fa: "گزارش یک‌صفحه‌ای مدیرعامل", en: "Executive One-Pager" }, periodicity: "monthly", audiences: ["internal", "official"], purpose: { fa: "شش بلوک تصمیم‌ساز روی یک برگ A4 برای مدیرعامل", en: "six decision blocks on a single A4 sheet for the CEO" } },
];

export const EQP_REPORT_BY_CODE: Record<string, EqpReportDef> = Object.fromEntries(
  EQP_REPORT_CATALOG.map((r) => [r.code, r])
);

/* ── ابزار داخلی گزارش ── */

const rcol = (key: string, fa: string, en: string, format: EqpColumn["format"] = "text"): EqpColumn => ({
  key,
  title: { fa, en },
  format,
});

/** درصد با یک رقم اعشار برای سلول KPI. */
function pct(n: number | null): string {
  return n === null ? "—" : `${round2(n)}٪`;
}

function toneOf(value: number | null, target: number, direction: "higher" | "lower"): "good" | "warn" | "bad" {
  if (value === null) return "warn";
  const ok = direction === "higher" ? value >= target : value <= target;
  if (ok) return "good";
  const margin = direction === "higher" ? value >= target * 0.85 : value <= target * 1.15;
  return margin ? "warn" : "bad";
}

/* ── ۱. برگه دیسپچ روزانه ── */

export function buildDispatchSheetReport(input: {
  dateIso: string;
  rows: { dispatch: DispatchRow; equipmentName: string; equipmentCode: string; check?: DispatchPrecheck }[];
}): EqpReport {
  const total = input.rows.length;
  const approved = input.rows.filter((r) => r.dispatch.Status === "approved" || r.dispatch.Status === "executed").length;
  const blocked = input.rows.filter((r) => r.check && !r.check.allowed).length;
  const hours = round2(input.rows.reduce((s, r) => s + (Number(r.dispatch.PlannedHours) || 0), 0));

  return {
    code: "RPT-EQP-DSP",
    title: { fa: "برگه دیسپچ روزانه ماشین‌آلات", en: "Daily Equipment Dispatch Sheet" },
    periodicity: "daily",
    sourceModule: `${EQM_DOMAIN_ID} · ماشین‌آلات و تجهیزات`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `خلاصه دیسپچ ${input.dateIso}`, en: `Dispatch summary ${input.dateIso}` },
        cells: [
          { label: { fa: "برگه صادرشده", en: "Sheets issued" }, value: String(total) },
          { label: { fa: "تأییدشده", en: "Approved" }, value: String(approved), tone: approved === total ? "good" : "warn" },
          { label: { fa: "مسدود توسط دروازه", en: "Gate-blocked" }, value: String(blocked), tone: blocked > 0 ? "bad" : "good" },
          { label: { fa: "ساعت برنامه", en: "Planned hours" }, value: String(hours) },
        ],
      },
      {
        kind: "table",
        title: { fa: "تخصیص ماشین‌آلات", en: "Equipment assignment" },
        note: { fa: "هر برگه پیش از اجرا از دروازه‌های پیش‌نیاز عبور می‌کند", en: "each sheet passes precondition gates before execution" },
        columns: [
          rcol("code", "کد ماشین", "Machine code"),
          rcol("name", "نام ماشین", "Machine"),
          rcol("shift", "شیفت", "Shift"),
          rcol("operator", "اپراتور", "Operator"),
          rcol("site", "محل کار", "Site"),
          rcol("activity", "فعالیت", "Activity"),
          rcol("hours", "ساعت", "Hours", "number"),
          rcol("qty", "حجم برنامه", "Planned qty", "number"),
          rcol("status", "وضعیت", "Status"),
          rcol("gate", "دروازه", "Gate"),
        ],
        rows: input.rows.map((r) => ({
          code: r.equipmentCode,
          name: r.equipmentName,
          shift: r.dispatch.Shift,
          operator: r.dispatch.OperatorId ?? "—",
          site: r.dispatch.SiteFa ?? "—",
          activity: r.dispatch.ActivityId ?? "—",
          hours: r.dispatch.PlannedHours,
          qty: r.dispatch.PlannedQty ?? "—",
          status: r.dispatch.Status,
          gate: r.check ? (r.check.allowed ? "مجاز" : `${r.check.blockers} مانع`) : "—",
        })),
      },
      {
        kind: "table",
        title: { fa: "دروازه‌های ناموفق", en: "Failed gates" },
        columns: [rcol("machine", "ماشین", "Machine"), rcol("gate", "دروازه", "Gate"), rcol("kind", "نوع", "Kind"), rcol("msg", "شرح", "Detail")],
        rows: input.rows.flatMap((r) =>
          (r.check?.gates ?? [])
            .filter((g) => !g.passed)
            .map((g) => ({
              machine: r.equipmentCode,
              gate: g.code,
              kind: g.blocking ? "مسدودکننده" : "هشدار",
              msg: g.message,
            }))
        ),
      },
    ],
  };
}

/* ── ۲. کارت شناسنامه ماشین ── */

export function buildEquipmentIdCardReport(input: {
  equipment: EquipmentRow;
  nowIso: string;
  orders: MaintenanceOrderRow[];
  meters: MeterRow[];
  rental?: RentalRow;
}): EqpReport {
  const cat = CATEGORY_BY_CODE[input.equipment.Category] ?? CATEGORY_BY_CODE["OTH"];
  const age = equipmentAge(input.equipment.CommissionedAt, input.nowIso);
  const dep =
    input.equipment.PurchaseValue !== undefined
      ? straightLineDepreciation(Number(input.equipment.PurchaseValue), Number(input.equipment.SalvageValue ?? 0), cat.economicLifeYears, age.years)
      : null;
  const lastMeter = [...input.meters].sort((a, b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];

  return {
    code: "RPT-EQP-CARD",
    title: { fa: `کارت شناسنامه ماشین ${input.equipment.Code}`, en: `Equipment ID Card ${input.equipment.Code}` },
    periodicity: "adhoc",
    sourceModule: `${EQM_DOMAIN_ID} · ماشین‌آلات و تجهیزات`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "شناسه و وضعیت", en: "Identity & status" },
        cells: [
          { label: { fa: "کد ماشین", en: "Code" }, value: input.equipment.Code },
          { label: { fa: "تاکسونومی ISO 14224", en: "ISO 14224" }, value: iso14224Code(input.equipment.Category) },
          { label: { fa: "سن (سال)", en: "Age (yr)" }, value: String(age.years), tone: age.years >= cat.economicLifeYears ? "bad" : "good" },
          { label: { fa: "ساعت‌شمار", en: "Hour meter" }, value: lastMeter ? String(lastMeter.HourMeter) : "—" },
        ],
      },
      {
        kind: "table",
        title: { fa: "مشخصات فنی", en: "Technical specification" },
        columns: [rcol("field", "عنوان", "Field"), rcol("value", "مقدار", "Value")],
        rows: [
          { field: "نام", value: input.equipment.NameFa },
          { field: "دسته‌بندی", value: `${cat.fa} (${cat.code})` },
          { field: "سازنده / مدل", value: `${input.equipment.BrandFa ?? "—"} / ${input.equipment.Model ?? "—"}` },
          { field: "سال ساخت", value: input.equipment.Year ?? "—" },
          { field: "ظرفیت", value: input.equipment.Capacity !== undefined ? `${input.equipment.Capacity} ${input.equipment.CapacityUom ?? ""}` : "—" },
          { field: "نوع مالکیت", value: input.equipment.Ownership },
          { field: "تاریخ راه‌اندازی", value: input.equipment.CommissionedAt ?? "—" },
          { field: "محل استقرار", value: input.equipment.LocationFa ?? "—" },
          { field: "عمر اقتصادی (سال)", value: cat.economicLifeYears },
          { field: "شناسه اسکن", value: equipmentQrPayload(input.equipment) },
          { field: "ارزش خرید", value: input.equipment.PurchaseValue ?? "—" },
          { field: "ارزش دفتری", value: dep ? dep.bookValue : "—" },
          { field: "استهلاک انباشته", value: dep ? dep.accumulated : "—" },
          { field: "قرارداد اجاره", value: input.rental ? `${input.rental.ContractNo ?? "—"} · ${input.rental.Supplier ?? "—"}` : "ملکی" },
        ],
      },
      {
        kind: "table",
        title: { fa: "تاریخچه تعمیرات", en: "Maintenance history" },
        columns: [
          rcol("code", "دستورکار", "Work order"),
          rcol("kind", "نوع", "Kind"),
          rcol("priority", "اولویت", "Priority"),
          rcol("reported", "تاریخ گزارش", "Reported", "date"),
          rcol("status", "وضعیت", "Status"),
          rcol("cost", "هزینه", "Cost", "currency"),
          rcol("desc", "شرح", "Description"),
        ],
        rows: [...input.orders]
          .sort((a, b) => String(b.ReportedAt).localeCompare(String(a.ReportedAt)))
          .map((o) => ({
            code: o.Code,
            kind: o.Kind,
            priority: o.Priority,
            reported: o.ReportedAt,
            status: o.Status,
            cost: o.Cost ?? 0,
            desc: o.DescriptionFa ?? "—",
          })),
      },
    ],
  };
}

/* ── ۳. گزارش دوره‌ای تعمیرات ── */

export function buildMaintenanceReport(input: {
  fromIso: string;
  toIso: string;
  orders: (MaintenanceOrderRow & { RootCause?: string })[];
  equipmentNameById: Record<string, string>;
  plannedPmCount: number;
  periodHours: number;
  downtimeHrs: number;
}): EqpReport {
  const backlog = maintenanceBacklog(input.orders);
  const repair = mttr(input.orders);
  const between = mtbf(input.orders, input.periodHours, input.downtimeHrs);
  const compliance = pmCompliance(input.orders, input.plannedPmCount);
  const pareto = rcaPareto(input.orders);
  const totalCost = round2(input.orders.reduce((s, o) => s + (Number(o.Cost) || 0), 0));

  return {
    code: "RPT-EQP-MNT",
    title: { fa: "گزارش دوره‌ای تعمیرات و نگهداری", en: "Periodic Maintenance Report" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} · ماشین‌آلات و تجهیزات`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `شاخص‌های دوره ${input.fromIso} تا ${input.toIso}`, en: `Period indicators ${input.fromIso} to ${input.toIso}` },
        cells: [
          { label: { fa: "دستورکار باز", en: "Open orders" }, value: String(backlog.total), tone: backlog.total > 0 ? "warn" : "good" },
          { label: { fa: "بحرانی باز", en: "Critical open" }, value: String(backlog.byPriority.critical), tone: backlog.byPriority.critical > 0 ? "bad" : "good" },
          { label: { fa: "میانگین زمان تعمیر", en: "MTTR" }, value: repair ? `${repair.mttrHours} ساعت` : "—", tone: toneOf(repair ? repair.mttrHours : null, 8, "lower") },
          { label: { fa: "میانگین بین خرابی", en: "MTBF" }, value: between ? `${between.mtbfHours} ساعت` : "—", tone: toneOf(between ? between.mtbfHours : null, 500, "higher") },
          { label: { fa: "انطباق نگهداری", en: "PM compliance" }, value: pct(compliance.rate), tone: toneOf(compliance.rate, 90, "higher") },
          { label: { fa: "هزینه تعمیرات", en: "Maintenance cost" }, value: String(totalCost) },
        ],
      },
      {
        kind: "table",
        title: { fa: "دستورکارهای دوره", en: "Work orders in period" },
        columns: [
          rcol("code", "کد", "Code"),
          rcol("machine", "ماشین", "Machine"),
          rcol("kind", "نوع", "Kind"),
          rcol("priority", "اولویت", "Priority"),
          rcol("reported", "گزارش", "Reported", "date"),
          rcol("down", "توقف (ساعت)", "Downtime (h)", "number"),
          rcol("status", "وضعیت", "Status"),
          rcol("cost", "هزینه", "Cost", "currency"),
        ],
        rows: input.orders.map((o) => ({
          code: o.Code,
          machine: input.equipmentNameById[o.EquipmentId] ?? o.EquipmentId,
          kind: o.Kind,
          priority: o.Priority,
          reported: o.ReportedAt,
          down: o.DownFrom && o.DownTo ? hoursBetween(o.DownFrom, o.DownTo) : 0,
          status: o.Status,
          cost: o.Cost ?? 0,
        })),
      },
      {
        kind: "table",
        title: { fa: "تحلیل ریشه‌ای خرابی (ISO 14224)", en: "Failure root-cause analysis (ISO 14224)" },
        note: { fa: "توزیع پارتو — تمرکز بر علل صدر جدول بیشترین کاهش توقف را می‌دهد", en: "Pareto distribution — top causes yield the largest downtime reduction" },
        columns: [rcol("cause", "علت ریشه‌ای", "Root cause"), rcol("count", "تعداد", "Count", "number"), rcol("pct", "سهم", "Share", "percent"), rcol("cum", "تجمعی", "Cumulative", "percent")],
        rows: pareto.map((p) => ({
          cause: RCA_CAUSE_FA[p.cause as RcaCause] ?? p.cause,
          count: p.count,
          pct: p.pct,
          cum: p.cumulativePct,
        })),
      },
    ],
  };
}

/* ── ۴. گزارش بهره‌وری ناوگان ── */

export function buildFleetPerformanceReport(input: {
  fromIso: string;
  toIso: string;
  board: FleetKpiBoard;
  perEquipment: { code: string; name: string; utilization: number; availability: number; workHours: number; downtimeHrs: number; costPerHour: number | null }[];
  alerts: (EqmWarning & { escalateTo: string })[];
  healthScore: number;
  healthGrade: string;
}): EqpReport {
  const kpiValue = (code: string): number | null => {
    switch (code) {
      case "K-EQP-AVAIL": return input.board.availability;
      case "K-EQP-UTIL": return input.board.utilization;
      case "K-EQP-OEE": return input.board.oee;
      case "K-EQP-MTBF": return input.board.mtbfHours;
      case "K-EQP-MTTR": return input.board.mttrHours;
      case "K-EQP-MCR": return input.board.maintenanceCostRatio;
      case "K-EQP-PMC": return input.board.pmCompliance;
      default: return input.board.sfc;
    }
  };

  return {
    code: "RPT-EQP-PERF",
    title: { fa: "گزارش تحلیلی بهره‌وری ناوگان", en: "Fleet Performance Analytical Report" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} · ماشین‌آلات و تجهیزات`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `شاخص‌های کلیدی ${input.fromIso} تا ${input.toIso}`, en: `Key indicators ${input.fromIso} to ${input.toIso}` },
        cells: [
          { label: { fa: "دسترس‌پذیری", en: "Availability" }, value: pct(input.board.availability), tone: toneOf(input.board.availability, 95, "higher") },
          { label: { fa: "بهره‌برداری", en: "Utilization" }, value: pct(input.board.utilization), tone: toneOf(input.board.utilization, 70, "higher") },
          { label: { fa: "اثربخشی کلی (OEE)", en: "OEE" }, value: pct(input.board.oee), tone: toneOf(input.board.oee, 65, "higher") },
          { label: { fa: "نمره سلامت ناوگان", en: "Fleet health score" }, value: `${input.healthScore} (${input.healthGrade})`, tone: input.healthGrade === "A" ? "good" : input.healthGrade === "D" ? "bad" : "warn" },
        ],
      },
      {
        kind: "table",
        title: { fa: "تابلوی هشت شاخص در برابر هدف", en: "Eight-KPI board versus target" },
        note: { fa: "هدف هر شاخص از کاتالوگ موتور می‌آید؛ OEE بدون ثبت تولید واقعی سنجش‌ناپذیر است", en: "targets come from the engine catalog; OEE is not measurable without actual output" },
        columns: [
          rcol("code", "کد", "Code"),
          rcol("kpi", "شاخص", "KPI"),
          rcol("value", "مقدار", "Value", "number"),
          rcol("unit", "واحد", "Unit"),
          rcol("target", "هدف", "Target", "number"),
          rcol("verdict", "ارزیابی", "Verdict"),
        ],
        rows: EQP_KPI_CATALOG.map((k) => {
          const v = kpiValue(k.code);
          const ok = v === null ? null : k.direction === "higher" ? v >= k.target : v <= k.target;
          return {
            code: k.code,
            kpi: k.fa,
            value: v === null ? "سنجش‌ناپذیر" : v,
            unit: k.unit,
            target: `${k.direction === "higher" ? "≥" : "≤"} ${k.target}`,
            verdict: ok === null ? "بدون داده" : ok ? "در هدف" : "خارج از هدف",
          };
        }),
      },
      {
        kind: "table",
        title: { fa: "کارنامه هر ماشین", en: "Per-machine scorecard" },
        columns: [
          rcol("code", "کد", "Code"),
          rcol("name", "ماشین", "Machine"),
          rcol("hours", "کارکرد (ساعت)", "Work hours", "number"),
          rcol("util", "بهره‌برداری", "Utilization", "percent"),
          rcol("avail", "دسترس‌پذیری", "Availability", "percent"),
          rcol("down", "توقف (ساعت)", "Downtime (h)", "number"),
          rcol("cph", "هزینه بر ساعت", "Cost/hour", "currency"),
        ],
        rows: input.perEquipment.map((e) => ({
          code: e.code,
          name: e.name,
          hours: e.workHours,
          util: e.utilization,
          avail: e.availability,
          down: e.downtimeHrs,
          cph: e.costPerHour ?? "—",
        })),
      },
      {
        kind: "table",
        title: { fa: "هشدارهای زودهنگام و ماتریس تشدید", en: "Early warnings & escalation matrix" },
        columns: [rcol("code", "قاعده", "Rule"), rcol("sev", "شدت", "Severity"), rcol("msg", "شرح", "Message"), rcol("esc", "تشدید به", "Escalate to")],
        rows: input.alerts.map((a) => ({ code: a.code, sev: a.severity, msg: a.message, esc: a.escalateTo })),
      },
    ],
  };
}

/* ── ۵. گزارش تخصیص هزینه ماشین‌آلات ── */

export function buildCostAllocationReport(input: {
  fromIso: string;
  toIso: string;
  rows: {
    code: string;
    name: string;
    costAccount?: string;
    workHours: number;
    rentalCost: number;
    maintenanceCost: number;
    fuelCost: number;
  }[];
}): EqpReport {
  const enriched = input.rows.map((r) => {
    const cost = equipmentCostPerHour(r.workHours, {
      rentalCost: r.rentalCost,
      maintenanceCost: r.maintenanceCost,
      fuelCost: r.fuelCost,
    });
    return { ...r, total: cost.totalCost, cph: cost.costPerHour };  // cph ممکن است null باشد (ماشین بدون کارکرد)
  });
  const sum = (k: "rentalCost" | "maintenanceCost" | "fuelCost" | "total") => round2(enriched.reduce((s, r) => s + r[k], 0));
  const totalHours = round2(enriched.reduce((s, r) => s + r.workHours, 0));
  const grand = sum("total");

  return {
    code: "RPT-EQP-COST",
    title: { fa: "گزارش تخصیص هزینه ماشین‌آلات", en: "Equipment Cost Allocation Report" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} · ماشین‌آلات و تجهیزات`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `جمع هزینه دوره ${input.fromIso} تا ${input.toIso}`, en: `Period cost totals ${input.fromIso} to ${input.toIso}` },
        cells: [
          { label: { fa: "هزینه اجاره", en: "Rental" }, value: String(sum("rentalCost")) },
          { label: { fa: "هزینه تعمیرات", en: "Maintenance" }, value: String(sum("maintenanceCost")) },
          { label: { fa: "هزینه سوخت و مصرفی", en: "Fuel & consumables" }, value: String(sum("fuelCost")) },
          { label: { fa: "هزینه کل ناوگان", en: "Fleet total" }, value: String(grand) },
          { label: { fa: "میانگین هزینه بر ساعت", en: "Average cost/hour" }, value: String(totalHours > 0 ? round2(grand / totalHours) : 0) },
        ],
      },
      {
        kind: "table",
        title: { fa: "تفکیک هزینه به تفکیک ماشین", en: "Cost breakdown per machine" },
        note: { fa: "این ارقام مرجع تخصیص به حساب هزینه در ماژول مالی است؛ ثبت سند در مالی انجام می‌شود", en: "these figures feed cost account allocation in finance; the journal entry is made in finance" },
        columns: [
          rcol("code", "کد", "Code"),
          rcol("name", "ماشین", "Machine"),
          rcol("ca", "حساب هزینه", "Cost account"),
          rcol("hours", "کارکرد", "Hours", "number"),
          rcol("rent", "اجاره", "Rental", "currency"),
          rcol("mnt", "تعمیرات", "Maintenance", "currency"),
          rcol("fuel", "سوخت", "Fuel", "currency"),
          rcol("total", "جمع", "Total", "currency"),
          rcol("cph", "هزینه/ساعت", "Cost/hour", "currency"),
        ],
        rows: enriched.map((r) => ({
          code: r.code,
          name: r.name,
          ca: r.costAccount ?? "—",
          hours: r.workHours,
          rent: r.rentalCost,
          mnt: r.maintenanceCost,
          fuel: r.fuelCost,
          total: r.total,
          cph: r.cph ?? "—",
        })),
      },
    ],
  };
}

/* ── ۶. گزارش موجودی و سفارش قطعات ── */

export function buildSparePartsReport(input: { parts: SparePartRow[]; coverDays?: number }): EqpReport {
  const all = input.parts.map((p) => ({ part: p, stock: partStockStatus(p, input.coverDays ?? 30) }));
  const need = partsToRequisition(input.parts, input.coverDays ?? 30);
  const value = round2(need.reduce((s, x) => s + x.stock.suggestedQty * (Number(x.part.UnitCost) || 0), 0));

  return {
    code: "RPT-EQP-PART",
    title: { fa: "گزارش موجودی و سفارش قطعات یدکی", en: "Spare Parts Stock & Reorder Report" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} · ماشین‌آلات و تجهیزات`,
    audiences: ["internal"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "وضعیت انبار", en: "Warehouse status" },
        cells: [
          { label: { fa: "اقلام انبار", en: "Stock items" }, value: String(all.length) },
          { label: { fa: "نیازمند سفارش", en: "To requisition" }, value: String(need.length), tone: need.length > 0 ? "warn" : "good" },
          { label: { fa: "کمبود بحرانی", en: "Critical shortage" }, value: String(need.filter((x) => x.stock.critical && x.stock.status !== "reorder").length), tone: need.some((x) => x.stock.critical && x.stock.status !== "reorder") ? "bad" : "good" },
          { label: { fa: "ارزش سفارش پیشنهادی", en: "Suggested order value" }, value: String(value) },
        ],
      },
      {
        kind: "table",
        title: { fa: "موجودی و نقطه سفارش", en: "Stock & reorder point" },
        columns: [
          rcol("no", "کد قطعه", "Part no."),
          rcol("name", "نام", "Name"),
          rcol("onhand", "موجودی", "On hand", "number"),
          rcol("min", "حداقل", "Min", "number"),
          rcol("rop", "نقطه سفارش", "ROP", "number"),
          rcol("cover", "پوشش (روز)", "Cover (days)", "number"),
          rcol("status", "وضعیت", "Status"),
          rcol("sug", "سفارش پیشنهادی", "Suggested", "number"),
        ],
        rows: all.map(({ part: p, stock }) => ({
          no: p.PartNo,
          name: `${p.NameFa}${stock.critical ? " (بحرانی)" : ""}`,
          onhand: p.OnHand,
          min: p.MinLevel,
          rop: stock.rop,
          cover: stock.daysOfCover >= 9999 ? "—" : stock.daysOfCover,
          status: stock.status,
          sug: stock.suggestedQty,
        })),
      },
    ],
  };
}

/* ── دروازهٔ انتشار اختصاصی ناوگان (🔧 بهبود دروازهٔ عمومی) ── */

export type EqpPublishBlockers = {
  /** برگه‌های دیسپچ امروز که دروازه‌ها را رد نکرده‌اند */
  blockedDispatch?: number;
  /** برنامه‌های PM معوق */
  pmOverdue?: number;
  /** دستورکار بحرانی باز */
  criticalOpen?: number;
  /** قطعات بحرانی ناموجود */
  criticalPartsOut?: number;
  /** قرائت ساعت‌شمار ثبت‌نشده در دوره */
  missingMeterReadings?: number;
};

/**
 * گزارش رسمی ناوگان با دادهٔ ناقص یا وضعیت بحرانیِ اعلام‌نشده منتشر نمی‌شود.
 * گزارش داخلی همیشه مجاز است — تیم کارگاه باید بتواند وضعیت بد را ببیند.
 */
export function eqpPublishGate(
  audience: "internal" | "official",
  blockers: EqpPublishBlockers
): { ok: boolean; reasons: string[]; warnings: string[] } {
  if (audience === "internal") return { ok: true, reasons: [], warnings: [] };
  const reasons: string[] = [];
  const warnings: string[] = [];

  if ((blockers.missingMeterReadings ?? 0) > 0) {
    reasons.push(`${blockers.missingMeterReadings} ماشین بدون قرائت ساعت‌شمار در دوره — شاخص‌ها قابل اتکا نیستند`);
  }
  if ((blockers.criticalOpen ?? 0) > 0) {
    reasons.push(`${blockers.criticalOpen} دستورکار بحرانی باز — پیش از ابلاغ رسمی باید تعیین تکلیف شود`);
  }
  if ((blockers.pmOverdue ?? 0) > 0) {
    warnings.push(`${blockers.pmOverdue} سرویس دوره‌ای معوق در گزارش درج می‌شود`);
  }
  if ((blockers.blockedDispatch ?? 0) > 0) {
    warnings.push(`${blockers.blockedDispatch} برگه دیسپچ مسدود در دوره`);
  }
  if ((blockers.criticalPartsOut ?? 0) > 0) {
    warnings.push(`${blockers.criticalPartsOut} قطعه بحرانی ناموجود`);
  }
  return { ok: reasons.length === 0, reasons, warnings };
}

/** شمار ردیف‌های جدولی — پایه برآورد تعداد صفحه A4. */
export function eqpReportRows(report: EqpReport): number {
  return report.sections.reduce((s, sec) => s + (sec.kind === "table" ? sec.rows.length : 0), 0);
}

/* ══════════════ گزارش تک‌صفحه‌ای مدیرعامل (RPT-EQP-EXEC) ══════════════
 * شش بلوک روی یک برگ A4. هیچ محاسبهٔ تازه‌ای ندارد — همان اعداد گزارش‌های
 * تفصیلی را فشرده می‌کند تا دو سند هرگز دو رقم متفاوت ندهند. */

export type ExecBudget = { budget: number; actual: number };

export function buildExecutiveOnePager(input: {
  fromIso: string;
  toIso: string;
  board: FleetKpiBoard;
  fleetSize: number;
  activeCount: number;
  healthScore: number;
  healthGrade: string;
  backlog: { total: number; byPriority: Record<string, number> };
  topCauses: { cause: RcaCause; count: number; pct: number }[];
  cost: ExecBudget;
  alerts: (EqmWarning & { escalateTo: string })[];
  pmOverdueCount: number;
}): EqpReport {
  const variance = input.cost.budget > 0 ? round2(((input.cost.actual - input.cost.budget) / input.cost.budget) * 100) : null;
  const critical = input.alerts.filter((a) => a.severity === "critical");

  /* مدیرعامل عدد خام نمی‌خواهد، «در هدف / خارج از هدف» می‌خواهد. */
  const verdict = (value: number | null, target: number, higher: boolean): string =>
    value === null ? "سنجش‌ناپذیر" : (higher ? value >= target : value <= target) ? "در هدف" : "خارج از هدف";

  return {
    code: "RPT-EQP-EXEC",
    title: { fa: "گزارش یک‌صفحه‌ای مدیرعامل — ماشین‌آلات", en: "Equipment Executive One-Pager" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} · ماشین‌آلات و تجهیزات`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `۱ · دسترس‌پذیری و اثربخشی ناوگان ${input.fromIso} تا ${input.toIso}`, en: "1 · Fleet availability & effectiveness" },
        cells: [
          { label: { fa: "دسترس‌پذیری", en: "Availability" }, value: input.board.availability === null ? "—" : `${input.board.availability}٪` },
          { label: { fa: "اثربخشی کلی (OEE)", en: "OEE" }, value: input.board.oee === null ? "سنجش‌ناپذیر" : `${input.board.oee}٪` },
          { label: { fa: "نمره سلامت ناوگان", en: "Fleet health" }, value: `${input.healthScore} (${input.healthGrade})` },
          { label: { fa: "ماشین فعال", en: "Active machines" }, value: `${input.activeCount} از ${input.fleetSize}` },
        ],
      },
      {
        kind: "table",
        title: { fa: "۲ · بهره‌برداری در برابر بیکاری", en: "2 · Utilization vs idle" },
        columns: [rcol("metric", "سنجه", "Metric"), rcol("value", "مقدار", "Value"), rcol("target", "هدف", "Target"), rcol("verdict", "ارزیابی", "Verdict")],
        rows: [
          { metric: "بهره‌برداری", value: input.board.utilization === null ? "—" : `${input.board.utilization}٪`, target: "≥ 70٪", verdict: verdict(input.board.utilization, 70, true) },
          { metric: "بیکاری", value: input.board.utilization === null ? "—" : `${round2(100 - input.board.utilization)}٪`, target: "≤ 30٪", verdict: verdict(input.board.utilization, 70, true) },
          { metric: "مصرف ویژه سوخت", value: input.board.sfc === null ? "—" : `${input.board.sfc} ل/س`, target: "≤ 18", verdict: verdict(input.board.sfc, 18, false) },
        ],
      },
      {
        kind: "table",
        title: { fa: "۳ · خرابی‌های اصلی و قابلیت اطمینان", en: "3 · Top breakdowns & reliability" },
        columns: [rcol("item", "قلم", "Item"), rcol("value", "مقدار", "Value")],
        rows: [
          { item: "میانگین زمان بین خرابی (MTBF)", value: input.board.mtbfHours === null ? "سنجش‌ناپذیر" : `${input.board.mtbfHours} ساعت` },
          { item: "میانگین زمان تعمیر (MTTR)", value: input.board.mttrHours === null ? "سنجش‌ناپذیر" : `${input.board.mttrHours} ساعت` },
          { item: "دستورکار باز (بحرانی)", value: `${input.backlog.total} (${input.backlog.byPriority.critical ?? 0})` },
          ...input.topCauses.slice(0, 3).map((c, i) => ({ item: `علت پرتکرار ${i + 1}: ${RCA_CAUSE_FA[c.cause] ?? String(c.cause)}`, value: `${c.count} مورد · ${c.pct}٪` })),
        ],
      },
      {
        kind: "kpi",
        title: { fa: "۴ · انطباق نگهداری پیشگیرانه", en: "4 · PM compliance" },
        cells: [
          { label: { fa: "انطباق PM", en: "PM compliance" }, value: input.board.pmCompliance === null ? "—" : `${input.board.pmCompliance}٪` },
          { label: { fa: "هدف", en: "Target" }, value: "≥ 90٪" },
          { label: { fa: "سرویس معوق", en: "Overdue services" }, value: String(input.pmOverdueCount) },
          { label: { fa: "ارزیابی", en: "Verdict" }, value: verdict(input.board.pmCompliance, 90, true) },
        ],
      },
      {
        kind: "kpi",
        title: { fa: "۵ · هزینه ماشین‌آلات در برابر بودجه", en: "5 · Equipment cost vs budget" },
        cells: [
          { label: { fa: "بودجه دوره", en: "Budget" }, value: input.cost.budget > 0 ? String(round2(input.cost.budget)) : "ثبت نشده" },
          { label: { fa: "هزینه واقعی", en: "Actual" }, value: String(round2(input.cost.actual)) },
          { label: { fa: "انحراف", en: "Variance" }, value: variance === null ? "سنجش‌ناپذیر" : `${variance}٪` },
          { label: { fa: "نسبت هزینه نگهداری", en: "Maint. cost ratio" }, value: input.board.maintenanceCostRatio === null ? "—" : `${input.board.maintenanceCostRatio}٪` },
        ],
      },
      {
        kind: "table",
        title: { fa: "۶ · هشدارهای بحرانی نیازمند تصمیم", en: "6 · Critical alerts requiring decision" },
        note: {
          fa: "تنها هشدارهای بحرانی در این برگ می‌آیند؛ فهرست کامل در گزارش بهره‌وری ناوگان است",
          en: "only critical alerts appear here; the full list is in the fleet performance report",
        },
        columns: [rcol("code", "قاعده", "Rule"), rcol("msg", "شرح", "Message"), rcol("esc", "تشدید به", "Escalate to")],
        rows: critical.length > 0
          ? critical.map((a) => ({ code: a.code, msg: a.message, esc: a.escalateTo }))
          : [{ code: "—", msg: "هشدار بحرانی فعالی وجود ندارد", esc: "—" }],
      },
    ],
  };
}

/* ═══════════ G-01 · قفل فعالیت PEX هنگام خرابی ماشین بحرانی ═══════════
 *
 * ADR-19 — EQP اجازهٔ نوشتن روی `Activity` را فقط روی یک ستون اختصاصی دارد:
 * `BlockedByEquipmentId`. هیچ ستون دیگری از دامنهٔ PEX را نمی‌نویسد. دلیل:
 * مالکیت داده باید تک‌نقطه‌ای بماند و برنامهٔ زمان‌بندی هرگز به‌صورت جانبی
 * توسط ماژول دیگری بازنویسی نشود.
 *
 * ADR-20 — آزادسازی خودکار و اجباری است. قفلی که فقط دستی باز شود، فعالیت را
 * برای همیشه قفل نگه می‌دارد (ریسک R-04). قاعده: تا وقتی دست‌کم یک دستورکار
 * بحرانیِ باز روی آن ماشین هست فعالیت قفل می‌ماند؛ با بسته شدن آخرین مورد،
 * قفل همان لحظه برداشته می‌شود. قفل «وضعیت مشتق‌شده» است نه «رویداد».
 */

export type ActivityLockPlan = {
  lock: { activityId: string; equipmentId: string; reason: string }[];
  release: { activityId: string; equipmentId: string; reason: string }[];
  unchanged: number;
};

/** آیا این دستورکار، ماشین را از کار می‌اندازد؟ */
export function isBlockingOrder(o: MaintenanceOrderRow): boolean {
  return o.Priority === "critical" && (o.Status === "open" || o.Status === "in_progress");
}

/**
 * نقشهٔ قفل/آزادسازی را از وضعیت فعلی محاسبه می‌کند — بدون هیچ عارضهٔ جانبی.
 * لایهٔ REST نتیجه را اعمال می‌کند؛ این تابع فقط تصمیم می‌گیرد.
 *
 * @param activities فعالیت‌های پروژه با ستون `BlockedByEquipmentId`
 * @param dispatches دیسپچ‌ها، برای یافتن اینکه کدام ماشین به کدام فعالیت وصل است
 * @param orders همهٔ دستورکارهای پروژه
 */
export function planActivityLocks(input: {
  activities: { Id: string; Code?: string; BlockedByEquipmentId?: string | null }[];
  dispatches: DispatchRow[];
  orders: MaintenanceOrderRow[];
  equipmentNameById?: Record<string, string>;
}): ActivityLockPlan {
  const blockedEquipment = new Set(input.orders.filter(isBlockingOrder).map((o) => o.EquipmentId));

  /* یک فعالیت ممکن است چند ماشین داشته باشد؛ اگر هر کدام خراب باشد قفل می‌شود.
   * دیسپچ لغوشده یا ردشده تخصیص محسوب نمی‌شود. */
  const equipmentByActivity = new Map<string, string[]>();
  for (const d of input.dispatches) {
    if (!d.ActivityId) continue;
    if (d.Status === "cancelled" || d.Status === "rejected") continue;
    const list = equipmentByActivity.get(d.ActivityId) ?? [];
    if (!list.includes(d.EquipmentId)) list.push(d.EquipmentId);
    equipmentByActivity.set(d.ActivityId, list);
  }

  const plan: ActivityLockPlan = { lock: [], release: [], unchanged: 0 };
  const nameOf = (id: string) => input.equipmentNameById?.[id] ?? id;

  for (const a of input.activities) {
    const current = a.BlockedByEquipmentId || null;
    const offender = (equipmentByActivity.get(a.Id) ?? []).find((eid) => blockedEquipment.has(eid)) ?? null;

    if (offender && current !== offender) {
      plan.lock.push({
        activityId: a.Id,
        equipmentId: offender,
        reason: `ماشین ${nameOf(offender)} دستورکار بحرانی باز دارد`,
      });
    } else if (!offender && current) {
      plan.release.push({
        activityId: a.Id,
        equipmentId: current,
        reason: `دستورکار بحرانی ماشین ${nameOf(current)} بسته شد`,
      });
    } else {
      plan.unchanged += 1;
    }
  }

  return plan;
}

/* ═══════════ G-02 · ثبت هزینهٔ ماشین‌آلات در حساب هزینهٔ مالی ═══════════
 *
 * ADR-21 — ثبت ایدمپوتنت با کلید `(CostAccountId, PeriodCode)`.
 * خطر واقعی این است که اجرای دوبارهٔ ثبت ماهانه، ستون `Actual` را دوبرابر کند
 * (ریسک R-05). راه‌حل: EQP «سهم خودش» را اعلام می‌کند، نه «مقدار افزوده».
 * لایهٔ اعمال، سهم قبلی همان دوره را کم و سهم تازه را جایگزین می‌کند؛ پس
 * اجرای صد بارهٔ یک دوره همان نتیجهٔ یک بار را می‌دهد.
 *
 * ADR-22 — EQP سند حسابداری نمی‌زند. فقط `CostAccount.Actual` را به‌روز
 * می‌کند و شرح تفکیکی می‌دهد؛ ثبت سند دوطرفه کار ماژول مالی است.
 */

export type CostPostingLine = {
  costAccountId: string;
  periodCode: string;
  rentalCost: number;
  maintenanceCost: number;
  fuelCost: number;
  amount: number;
  workHours: number;
  equipmentCodes: string[];
  memoFa: string;
};

/**
 * هزینهٔ دوره را به تفکیک حساب هزینه جمع می‌کند.
 * ماشین بدون `CostAccountId` در دیسپچ‌ها، در خروجی نمی‌آید — هزینهٔ
 * تخصیص‌نیافته نباید بی‌سروصدا به حسابی دلخواه بچسبد.
 */
export function buildCostPostings(input: {
  periodCode: string;
  rows: {
    equipmentId: string;
    code: string;
    costAccountId?: string | null;
    workHours: number;
    rentalCost: number;
    maintenanceCost: number;
    fuelCost: number;
  }[];
}): { postings: CostPostingLine[]; unallocated: { code: string; amount: number }[] } {
  const byAccount = new Map<string, CostPostingLine>();
  const unallocated: { code: string; amount: number }[] = [];

  for (const r of input.rows) {
    const amount = round2((r.rentalCost || 0) + (r.maintenanceCost || 0) + (r.fuelCost || 0));
    if (!r.costAccountId) {
      if (amount > 0) unallocated.push({ code: r.code, amount });
      continue;
    }
    const line = byAccount.get(r.costAccountId) ?? {
      costAccountId: r.costAccountId,
      periodCode: input.periodCode,
      rentalCost: 0,
      maintenanceCost: 0,
      fuelCost: 0,
      amount: 0,
      workHours: 0,
      equipmentCodes: [],
      memoFa: "",
    };
    line.rentalCost = round2(line.rentalCost + (r.rentalCost || 0));
    line.maintenanceCost = round2(line.maintenanceCost + (r.maintenanceCost || 0));
    line.fuelCost = round2(line.fuelCost + (r.fuelCost || 0));
    line.amount = round2(line.amount + amount);
    line.workHours = round2(line.workHours + (r.workHours || 0));
    if (!line.equipmentCodes.includes(r.code)) line.equipmentCodes.push(r.code);
    byAccount.set(r.costAccountId, line);
  }

  const postings = [...byAccount.values()].map((l) => ({
    ...l,
    memoFa: `ماشین‌آلات دوره ${l.periodCode} — ${l.equipmentCodes.length} ماشین، ${l.workHours} ساعت (اجاره ${l.rentalCost} / تعمیر ${l.maintenanceCost} / سوخت ${l.fuelCost})`,
  }));

  return { postings, unallocated };
}

/**
 * مقدار تازهٔ `Actual` را برای یک حساب حساب می‌کند.
 * `previousEqpShare` سهمی است که EQP در همان دوره قبلاً ثبت کرده بود؛ با کم
 * کردن آن، اجرای دوباره جمع را متورم نمی‌کند.
 */
export function applyPostingToActual(currentActual: number, previousEqpShare: number, newEqpShare: number): number {
  const base = (Number(currentActual) || 0) - (Number(previousEqpShare) || 0);
  return round2(Math.max(0, base) + (Number(newEqpShare) || 0));
}
