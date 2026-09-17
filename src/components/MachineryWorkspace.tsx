import { useEffect, useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import {
  EQM_VERSION,
  EQUIPMENT_CATEGORY_CATALOG,
  CATEGORY_BY_CODE,
  availability,
  downtimeHours,
  equipmentAge,
  equipmentCostPerHour,
  eqmEws,
  fleetSummary,
  maintenanceBacklog,
  mttr,
  nextPmDue,
  rentalCostAccrued,
  straightLineDepreciation,
  utilization,
  validateEquipment,
  validateMaintenanceOrder,
  validateMeter,
  validateRental,
  workHoursSum,
  EQP_KPI_CATALOG,
  EQP_REPORT_CATALOG,
  EWS_EQP_RULES,
  buyVsRent,
  dispatchPrecheck,
  equipmentHealthScore,
  equipmentQrPayload,
  ewsEqp,
  fleetKpiBoard,
  fuelSummary,
  iso14224Code,
  partStockStatus,
  partsToRequisition,
  pmCompliance,
  pmDueByBasis,
  rcaPareto,
  specificFuelConsumption,
  tco,
  type DispatchRow,
  type EquipmentRow,
  type FuelLogRow,
  type MaintenanceOrderRow,
  type MeterRow,
  type PmScheduleRow,
  type RentalRow,
  type SparePartRow,
} from "../services/equipment";

/* پنج تب = پنج زیرماژول «مدیریت ماشین‌آلات و تجهیزات» */
export type EqmTab = "fleet" | "dispatch" | "meter" | "fuel" | "rental" | "maintenance" | "parts" | "productivity";

const TABS: { id: EqmTab; fa: string; en: string; icon: string }[] = [
  { id: "fleet", fa: "ناوگان و ثبت ماشین‌آلات", en: "Fleet Registry", icon: "🚜" },
  { id: "dispatch", fa: "دیسپچ روزانه", en: "Daily Dispatch", icon: "🧭" },
  { id: "meter", fa: "ساعت کارکرد", en: "Working Hours", icon: "⏱" },
  { id: "fuel", fa: "سوخت و مصرفی", en: "Fuel & Consumables", icon: "⛽" },
  { id: "rental", fa: "اجاره و TCO", en: "Rental & TCO", icon: "📄" },
  { id: "maintenance", fa: "تعمیرات و PM", en: "Maintenance & PM", icon: "🔧" },
  { id: "parts", fa: "قطعات یدکی", en: "Spare Parts", icon: "🔩" },
  { id: "productivity", fa: "بهره‌وری و هشدار", en: "Productivity & EWS", icon: "📊" },
];

/* شناسهٔ پروژه‌ای که گزارش‌های سروری روی آن ساخته می‌شوند (هم‌خوان با دادهٔ لایهٔ ماندگاری). */
const REPORT_PROJECT_ID = "p1";
const TODAY = "2026-09-08";
const WINDOW_DAYS = 30;
const FROM = "2026-08-09";

/* ─────────────── داده نمونه (پروژه OG-2401) ─────────────── */

const SAMPLE_FLEET: EquipmentRow[] = [
  { Id: "e1", ProjectId: "OG-2401", Code: "EQ-001", NameFa: "بیل مکانیکی کوماتسو PC220", Category: "EXC", Ownership: "owned", BrandFa: "کوماتسو", Model: "PC220", Year: 2023, Capacity: 22, CapacityUom: "تن", Status: "active", CommissionedAt: "2024-03-01", PurchaseValue: 28_000_000_000, SalvageValue: 2_800_000_000 },
  { Id: "e2", ProjectId: "OG-2401", Code: "EQ-002", NameFa: "تاور کرین پوتین ۱۲ تن", Category: "CRN-TOW", Ownership: "rented", BrandFa: "Potain", Model: "MC125", Year: 2021, Capacity: 12, CapacityUom: "تن", Status: "active", CommissionedAt: "2023-02-01" },
  { Id: "e3", ProjectId: "OG-2401", Code: "EQ-003", NameFa: "لودر ولوو L120", Category: "LDR", Ownership: "rented", BrandFa: "ولوو", Model: "L120", Year: 2021, Status: "repair", CommissionedAt: "2022-06-01" },
  { Id: "e4", ProjectId: "OG-2401", Code: "EQ-004", NameFa: "دیزل ژنراتور ۵۰۰kVA", Category: "GEN", Ownership: "owned", BrandFa: "کاترپیلار", Model: "C18", Year: 2020, Capacity: 500, CapacityUom: "کیلوولت‌آمپر", Status: "active", CommissionedAt: "2021-01-01", PurchaseValue: 12_000_000_000, SalvageValue: 1_200_000_000 },
  { Id: "e5", ProjectId: "OG-2401", Code: "EQ-005", NameFa: "کمپرسور اطلس کوپکو", Category: "CMP", Ownership: "owned", BrandFa: "Atlas Copco", Year: 2022, Status: "active", CommissionedAt: "2022-09-01" },
  { Id: "e6", ProjectId: "OG-2401", Code: "EQ-006", NameFa: "کامیون بنز ۲۶۲۴", Category: "TRK", Ownership: "owned", BrandFa: "بنز", Model: "2624", Year: 2019, Capacity: 12, CapacityUom: "تن", Status: "active", CommissionedAt: "2020-03-01", PurchaseValue: 8_500_000_000, SalvageValue: 850_000_000 },
  { Id: "e7", ProjectId: "OG-2401", Code: "EQ-007", NameFa: "میکسر بتن ۹ متری", Category: "MXR", Ownership: "rented", Year: 2022, Status: "idle", CommissionedAt: "2022-04-01" },
  { Id: "e8", ProjectId: "OG-2401", Code: "EQ-008", NameFa: "لیفتراک ۵ تن", Category: "FLT", Ownership: "owned", Year: 2021, Capacity: 5, CapacityUom: "تن", Status: "disposed", CommissionedAt: "2018-05-01", PurchaseValue: 1_800_000_000, SalvageValue: 180_000_000 },
];

const SAMPLE_METERS: MeterRow[] = [
  { Id: "m1", ProjectId: "OG-2401", EquipmentId: "e1", ReadAt: "2026-08-09", HourMeter: 1040, WorkHours: 96, Source: "manual", EnteredBy: "admin" },
  { Id: "m2", ProjectId: "OG-2401", EquipmentId: "e1", ReadAt: "2026-08-18", HourMeter: 1160, WorkHours: 120, Source: "manual", EnteredBy: "admin" },
  { Id: "m3", ProjectId: "OG-2401", EquipmentId: "e1", ReadAt: "2026-09-01", HourMeter: 1280, WorkHours: 70, Source: "manual", EnteredBy: "admin" },
  { Id: "m4", ProjectId: "OG-2401", EquipmentId: "e2", ReadAt: "2026-08-09", HourMeter: 3120, WorkHours: 210, Source: "manual", EnteredBy: "admin" },
  { Id: "m5", ProjectId: "OG-2401", EquipmentId: "e2", ReadAt: "2026-09-01", HourMeter: 3310, WorkHours: 190, Source: "manual", EnteredBy: "admin" },
  { Id: "m6", ProjectId: "OG-2401", EquipmentId: "e3", ReadAt: "2026-08-09", HourMeter: 890, WorkHours: 40, Source: "manual", EnteredBy: "admin" },
  { Id: "m7", ProjectId: "OG-2401", EquipmentId: "e4", ReadAt: "2026-08-09", HourMeter: 5100, WorkHours: 700, Source: "telemetry", EnteredBy: "admin" },
  { Id: "m8", ProjectId: "OG-2401", EquipmentId: "e6", ReadAt: "2026-09-01", HourMeter: 4400, WorkHours: 150, Source: "manual", EnteredBy: "admin" },
];

const SAMPLE_RENTALS: RentalRow[] = [
  { Id: "r1", ProjectId: "OG-2401", EquipmentId: "e2", Supplier: "ماشین‌آلات آریا", ContractNo: "R-2026-01", RateType: "monthly", Rate: 600_000_000, Currency: "IRR", StartDate: "2026-08-01", EndDate: "2026-12-31", Status: "active" },
  { Id: "r2", ProjectId: "OG-2401", EquipmentId: "e3", Supplier: "عمران ماشین", ContractNo: "R-2026-02", RateType: "monthly", Rate: 480_000_000, Currency: "IRR", StartDate: "2026-07-01", EndDate: "2026-09-20", Status: "active" },
  { Id: "r3", ProjectId: "OG-2401", EquipmentId: "e7", Supplier: "بتن‌سازان", ContractNo: "R-2026-03", RateType: "daily", Rate: 18_000_000, Currency: "IRR", StartDate: "2026-06-15", EndDate: "2026-08-15", Status: "expired" },
];

const SAMPLE_ORDERS: MaintenanceOrderRow[] = [
  { Id: "o1", ProjectId: "OG-2401", EquipmentId: "e3", Code: "WO-1001", Kind: "corrective", Priority: "critical", ReportedAt: "2026-09-07", DownFrom: "2026-09-07T08:00", DownTo: "2026-09-07T14:00", Status: "in_progress", Cost: 25_000_000, DescriptionFa: "خرابی پمپ هیدرولیک", AssignedTo: "EQP-LDR" },
  { Id: "o2", ProjectId: "OG-2401", EquipmentId: "e1", Code: "WO-1002", Kind: "preventive", Priority: "medium", ReportedAt: "2026-08-20", Status: "done", Cost: 12_000_000, DescriptionFa: "تعویض فیلتر و روغن", AssignedTo: "EQP-EXC" },
  { Id: "o3", ProjectId: "OG-2401", EquipmentId: "e2", Code: "WO-1003", Kind: "inspection", Priority: "low", ReportedAt: "2026-08-25", Status: "done", Cost: 3_000_000, DescriptionFa: "بازرسی دوره‌ای سیم‌بکسل", AssignedTo: "QCM-CIV" },
  { Id: "o4", ProjectId: "OG-2401", EquipmentId: "e6", Code: "WO-1004", Kind: "corrective", Priority: "high", ReportedAt: "2026-09-05", DownFrom: "2026-09-05T06:00", DownTo: "2026-09-05T18:00", Status: "done", Cost: 9_000_000, DescriptionFa: "تعویض لنت ترمز", AssignedTo: "EQP-TRK" },
  { Id: "o5", ProjectId: "OG-2401", EquipmentId: "e4", Code: "WO-1005", Kind: "preventive", Priority: "medium", ReportedAt: "2026-07-01", Status: "closed", Cost: 5_000_000, DescriptionFa: "سرویس ۱۰۰۰ ساعته", AssignedTo: "EQP-CMP" },
];

const SAMPLE_DISPATCH: DispatchRow[] = [
  { Id: "d1", ProjectId: "OG-2401", EquipmentId: "e1", DispatchDate: TODAY, Shift: "day", OperatorId: "OP-101", ActivityId: "A-1240", CostAccountId: "CA-EQ-01", SiteFa: "کارگاه شمالی — بلوک B", PlannedHours: 8, PlannedQty: 450, QtyUom: "مترمکعب", SafetyCheck: true, Status: "approved", ApprovedBy: "مدیر ماشین‌آلات" },
  { Id: "d2", ProjectId: "OG-2401", EquipmentId: "e2", DispatchDate: TODAY, Shift: "full", OperatorId: "OP-204", ActivityId: "A-1310", CostAccountId: "CA-EQ-02", SiteFa: "پایه تاور — محور ۳", PlannedHours: 12, PlannedQty: 96, QtyUom: "حرکت", SafetyCheck: true, Status: "executed", ApprovedBy: "مدیر پروژه" },
  { Id: "d3", ProjectId: "OG-2401", EquipmentId: "e6", DispatchDate: TODAY, Shift: "day", OperatorId: "OP-118", ActivityId: "A-1255", SiteFa: "جاده دسترسی", PlannedHours: 10, PlannedQty: 28, QtyUom: "سرویس", SafetyCheck: true, Status: "submitted" },
  { Id: "d4", ProjectId: "OG-2401", EquipmentId: "e5", DispatchDate: TODAY, Shift: "night", SiteFa: "کارگاه مرکزی", PlannedHours: 8, SafetyCheck: false, Status: "draft" },
  { Id: "d5", ProjectId: "OG-2401", EquipmentId: "e3", DispatchDate: TODAY, Shift: "day", OperatorId: "OP-133", SiteFa: "دپوی مصالح", PlannedHours: 8, SafetyCheck: true, Status: "rejected", NoteFa: "ماشین در تعمیر است" },
];

/** گواهی‌نامه اپراتورها — منبع واقعی HRM است؛ اینجا نمونه برای اثبات دروازه است. */
const OPERATOR_LICENSE: Record<string, string> = {
  "OP-101": "2027-04-20",
  "OP-204": "2026-09-18",
  "OP-118": "2026-08-01",
  "OP-133": "2027-11-30",
};

const SAMPLE_FUEL: FuelLogRow[] = [
  { Id: "f1", ProjectId: "OG-2401", EquipmentId: "e1", LogDate: "2026-08-14", Kind: "diesel", Quantity: 420, Uom: "لیتر", UnitCost: 52_000, HourMeter: 1120, IssuedBy: "انبار سوخت" },
  { Id: "f2", ProjectId: "OG-2401", EquipmentId: "e1", LogDate: "2026-08-28", Kind: "diesel", Quantity: 380, Uom: "لیتر", UnitCost: 52_000, HourMeter: 1240, IssuedBy: "انبار سوخت" },
  { Id: "f3", ProjectId: "OG-2401", EquipmentId: "e1", LogDate: "2026-09-02", Kind: "oil", Quantity: 18, Uom: "لیتر", UnitCost: 310_000, IssuedBy: "انبار روغن" },
  { Id: "f4", ProjectId: "OG-2401", EquipmentId: "e2", LogDate: "2026-08-20", Kind: "diesel", Quantity: 260, Uom: "لیتر", UnitCost: 52_000, IssuedBy: "انبار سوخت" },
  { Id: "f5", ProjectId: "OG-2401", EquipmentId: "e4", LogDate: "2026-08-25", Kind: "diesel", Quantity: 1_450, Uom: "لیتر", UnitCost: 52_000, HourMeter: 5_620, IssuedBy: "انبار سوخت" },
  { Id: "f6", ProjectId: "OG-2401", EquipmentId: "e6", LogDate: "2026-09-03", Kind: "diesel", Quantity: 310, Uom: "لیتر", UnitCost: 52_000, IssuedBy: "انبار سوخت" },
  { Id: "f7", ProjectId: "OG-2401", EquipmentId: "e6", LogDate: "2026-09-04", Kind: "tire", Quantity: 2, Uom: "حلقه", UnitCost: 84_000_000, IssuedBy: "انبار فنی" },
];

const SAMPLE_PM: PmScheduleRow[] = [
  { Id: "p1", ProjectId: "OG-2401", EquipmentId: "e1", Code: "PM-EQ001-250", TitleFa: "تعویض روغن و فیلتر — هر ۲۵۰ ساعت", Basis: "run_hours", IntervalValue: 250, LastDoneReading: 1_040, ChecklistFa: "روغن موتور، فیلتر روغن، فیلتر سوخت، فیلتر هوا", Active: true },
  { Id: "p2", ProjectId: "OG-2401", EquipmentId: "e1", Code: "PM-EQ001-YR", TitleFa: "بازرسی سالانه ایمنی", Basis: "calendar_days", IntervalValue: 365, LastDoneAt: "2025-09-20", ChecklistFa: "ترمز، بوق عقب، کپسول آتش‌نشانی، کمربند", Active: true },
  { Id: "p3", ProjectId: "OG-2401", EquipmentId: "e2", Code: "PM-EQ002-90", TitleFa: "بازرسی سیم‌بکسل و قلاب", Basis: "calendar_days", IntervalValue: 90, LastDoneAt: "2026-08-25", ChecklistFa: "سیم‌بکسل، قلاب، لیمیت‌سوییچ، ترمز بالابر", Active: true },
  { Id: "p4", ProjectId: "OG-2401", EquipmentId: "e4", Code: "PM-EQ004-1000", TitleFa: "سرویس ۱۰۰۰ ساعته ژنراتور", Basis: "run_hours", IntervalValue: 1_000, LastDoneReading: 5_100, Active: true },
  { Id: "p5", ProjectId: "OG-2401", EquipmentId: "e6", Code: "PM-EQ006-KM", TitleFa: "سرویس ۱۰٬۰۰۰ کیلومتر", Basis: "kilometers", IntervalValue: 10_000, LastDoneReading: 148_000, Active: true },
];

/** آخرین قرائت شمارنده برای پایه‌های شمارنده‌ای PM (کیلومتر با ضریب تقریبی از ساعت‌شمار). */
const PM_READING: Record<string, number> = { p1: 1_286, p2: 0, p3: 0, p4: 5_800, p5: 156_900 };

const SAMPLE_PARTS: SparePartRow[] = [
  { Id: "sp1", ProjectId: "OG-2401", PartNo: "CAT-1R-0750", NameFa: "فیلتر سوخت کاترپیلار", Uom: "عدد", OnHand: 4, MinLevel: 10, LeadTimeDays: 21, AvgDailyUsage: 0.4, UnitCost: 4_200_000, Critical: true, EquipmentCategory: "EXC" },
  { Id: "sp2", ProjectId: "OG-2401", PartNo: "KOM-207-60-71180", NameFa: "شیلنگ هیدرولیک بوم", Uom: "عدد", OnHand: 0, MinLevel: 2, LeadTimeDays: 45, AvgDailyUsage: 0.05, UnitCost: 38_000_000, Critical: true, EquipmentCategory: "EXC" },
  { Id: "sp3", ProjectId: "OG-2401", PartNo: "GEN-OIL-15W40", NameFa: "روغن موتور ۱۵W۴۰", Uom: "لیتر", OnHand: 600, MinLevel: 100, LeadTimeDays: 7, AvgDailyUsage: 8, UnitCost: 310_000, Critical: false },
  { Id: "sp4", ProjectId: "OG-2401", PartNo: "TWR-BRK-PAD", NameFa: "لنت ترمز بالابر تاور", Uom: "ست", OnHand: 1, MinLevel: 2, LeadTimeDays: 60, AvgDailyUsage: 0.01, UnitCost: 62_000_000, Critical: true, EquipmentCategory: "CRN-TOW" },
  { Id: "sp5", ProjectId: "OG-2401", PartNo: "TRK-TIRE-1200R20", NameFa: "لاستیک ۱۲۰۰R۲۰", Uom: "حلقه", OnHand: 6, MinLevel: 4, LeadTimeDays: 30, AvgDailyUsage: 0.06, UnitCost: 84_000_000, Critical: false, EquipmentCategory: "TRK" },
];

/** علت ریشه‌ای خرابی‌ها (ISO 14224) — در sql-v1 ستون RootCause روی MaintenanceOrder افزوده می‌شود (F2). */
const ROOT_CAUSE: Record<string, string> = { o1: "hydraulic", o4: "mechanical" };

/* ─────────────── اجزای نمایشی ─────────────── */

function Kpi({ label, value, hint, tone = "tx1" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/10 p-2.5">
      <div className="text-[9px] tx3">{label}</div>
      <div className={`mt-1 text-[15px] font-semibold tabular-nums ${tone}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[8px] font-extralight tx4">{hint}</div>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border b-line-soft bg-black/10 p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h4 className="text-[10.5px] font-semibold tx1">{title}</h4>
        {note && <span className="text-[8px] font-extralight tx4">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b b-line-soft px-2 py-1.5 text-start text-[8.5px] font-medium tx3">{children}</th>;
}

function Td({ children, tone, dir }: { children: React.ReactNode; tone?: string; dir?: string }) {
  return <td dir={dir} className={`border-b b-line-soft px-2 py-1.5 text-[9.5px] ${tone ?? "tx2"}`}>{children}</td>;
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-medium ${tone}`}>{children}</span>;
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-400/15 text-emerald-300",
  idle: "bg-sky-400/15 text-sky-300",
  repair: "bg-amber-400/15 text-amber-200",
  disposed: "bg-zinc-400/15 text-zinc-400",
  open: "bg-rose-400/15 text-rose-300",
  in_progress: "bg-amber-400/15 text-amber-200",
  done: "bg-emerald-400/15 text-emerald-300",
  closed: "bg-zinc-400/15 text-zinc-400",
  expired: "bg-zinc-400/15 text-zinc-400",
  terminated: "bg-zinc-400/15 text-zinc-400",
};

const DISPATCH_TONE: Record<string, string> = {
  draft: "bg-zinc-400/15 text-zinc-400",
  submitted: "bg-amber-400/15 text-amber-200",
  approved: "bg-sky-400/15 text-sky-300",
  rejected: "bg-rose-400/15 text-rose-300",
  executed: "bg-emerald-400/15 text-emerald-300",
  cancelled: "bg-zinc-400/15 text-zinc-400",
};

const DISPATCH_FA: Record<string, string> = {
  draft: "پیش‌نویس", submitted: "ارسال‌شده", approved: "تأییدشده",
  rejected: "رد شده", executed: "اجراشده", cancelled: "لغو شده",
};

const FUEL_FA: Record<string, string> = {
  diesel: "گازوئیل", gasoline: "بنزین", oil: "روغن",
  grease: "گریس", tire: "لاستیک", other: "سایر",
};

const PART_TONE: Record<string, string> = {
  ok: "bg-emerald-400/15 text-emerald-300",
  reorder: "bg-amber-400/15 text-amber-200",
  shortage: "bg-orange-400/15 text-orange-300",
  out: "bg-rose-400/15 text-rose-300",
};

const PART_FA: Record<string, string> = {
  ok: "کافی", reorder: "سفارش مجدد", shortage: "کمبود", out: "ناموجود",
};

const PM_TONE: Record<string, string> = {
  ok: "bg-emerald-400/15 text-emerald-300",
  soon: "bg-amber-400/15 text-amber-200",
  due: "bg-orange-400/15 text-orange-300",
  overdue: "bg-rose-400/15 text-rose-300",
};

const PM_FA: Record<string, string> = {
  ok: "به‌روز", soon: "نزدیک موعد", due: "سررسید", overdue: "معوق",
};

const PM_BASIS_FA: Record<string, string> = {
  run_hours: "ساعت کارکرد", kilometers: "کیلومتر",
  calendar_days: "روز تقویمی", cycles: "سیکل",
};

const RCA_FA: Record<string, string> = {
  mechanical: "مکانیکی", electrical: "الکتریکی", hydraulic: "هیدرولیکی",
  instrument: "ابزار دقیق", software: "نرم‌افزاری", structural: "سازه‌ای",
  human: "خطای انسانی", external: "عوامل بیرونی",
};

const VERDICT_TONE: Record<string, string> = {
  idle: "bg-zinc-400/15 text-zinc-400",
  low: "bg-amber-400/15 text-amber-200",
  normal: "bg-emerald-400/15 text-emerald-300",
  high: "bg-sky-400/15 text-sky-300",
  critical: "bg-rose-400/15 text-rose-300",
  degraded: "bg-amber-400/15 text-amber-200",
  healthy: "bg-emerald-400/15 text-emerald-300",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ─────────────── کامپوننت اصلی ─────────────── */

export default function MachineryWorkspace({
  lang,
  initialTab = "fleet",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: EqmTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<EqmTab>(initialTab);
  const [fleet] = useState<EquipmentRow[]>(SAMPLE_FLEET);
  const [meters] = useState<MeterRow[]>(SAMPLE_METERS);
  const [rentals] = useState<RentalRow[]>(SAMPLE_RENTALS);
  const [orders, setOrders] = useState<MaintenanceOrderRow[]>(SAMPLE_ORDERS);
  useEffect(() => setTab(initialTab), [initialTab]);

  const fmt = (n: number) => n.toLocaleString(rtl ? "fa-IR" : "en-US");

  const metersOf = (id?: string) => meters.filter((m) => m.EquipmentId === id);
  const ordersOf = (id?: string) => orders.filter((o) => o.EquipmentId === id);
  const rentalOf = (id?: string) => rentals.find((r) => r.EquipmentId === id && r.Status === "active");

  const catFa = (code: string) => CATEGORY_BY_CODE[code]?.fa ?? code;
  const catEn = (code: string) => CATEGORY_BY_CODE[code]?.en ?? code;

  /* اعتبارسنجی نمونه‌ها — اثبات اتصال موتور اعتبارسنجی */
  const validationIssues = useMemo(() => {
    const out: string[] = [];
    for (const e of fleet) { const v = validateEquipment(e); if (!v.ok) out.push(`${e.Code}: ${v.issues[0].message}`); }
    for (const m of meters) { const v = validateMeter(m); if (!v.ok) out.push(`${m.Id}: ${v.issues[0].message}`); }
    for (const r of rentals) { const v = validateRental(r); if (!v.ok) out.push(`${r.ContractNo}: ${v.issues[0].message}`); }
    for (const o of orders) { const v = validateMaintenanceOrder(o); if (!v.ok) out.push(`${o.Code}: ${v.issues[0].message}`); }
    return out;
  }, [fleet, meters, rentals, orders]);

  /* شاخص‌های هر ماشین */
  const perEquipment = useMemo(() => {
    return fleet.map((e) => {
      const cat = CATEGORY_BY_CODE[e.Category] ?? CATEGORY_BY_CODE["OTH"];
      const em = metersOf(e.Id);
      const eo = ordersOf(e.Id);
      const wh = workHoursSum(em);
      const down = downtimeHours(eo, FROM, TODAY);
      const age = equipmentAge(e.CommissionedAt, TODAY);
      const util = utilization(wh, WINDOW_DAYS, 8, { lowPct: cat.utilLowPct, highPct: cat.utilHighPct });
      const avail = availability(down, WINDOW_DAYS * 24);
      const rental = rentalOf(e.Id);
      const lastPm = [...eo].filter((o) => (o.Kind === "preventive" || o.Kind === "inspection") && (o.Status === "done" || o.Status === "closed")).sort((a, b) => String(b.ReportedAt).localeCompare(String(a.ReportedAt)))[0];
      const warnings = eqmEws(e, {
        nowIso: TODAY, periodDays: WINDOW_DAYS, workHours: wh, downtimeHrs: down, orders: eo,
        rental, lastPmIso: lastPm?.ReportedAt, pmIntervalDays: 90,
        ageYears: age.years, economicLifeYears: cat.economicLifeYears, utilLowPct: cat.utilLowPct,
      });
      const cost = equipmentCostPerHour(wh, {
        rentalCost: rental ? rentalCostAccrued(rental, TODAY).accrued : 0,
        maintenanceCost: eo.reduce((s, o) => s + (Number(o.Cost) || 0), 0),
      });
      return { e, cat, wh, down, age, util, avail, rental, lastPm, warnings, cost, dep: e.PurchaseValue !== undefined ? straightLineDepreciation(Number(e.PurchaseValue), Number(e.SalvageValue ?? 0), cat.economicLifeYears, age.years) : null };
    });
  }, [fleet, meters, rentals, orders]);

  const summary = useMemo(() => {
    const metrics = fleet.map((e) => {
      const em = metersOf(e.Id);
      return { workHours: workHoursSum(em), downtimeHrs: downtimeHours(ordersOf(e.Id), FROM, TODAY), periodDays: WINDOW_DAYS };
    });
    const open = orders.filter((o) => o.Status === "open" || o.Status === "in_progress").length;
    const rent = rentals.reduce((s, r) => s + rentalCostAccrued(r, TODAY).accrued, 0);
    const warn = perEquipment.reduce((s, p) => s + p.warnings.length, 0);
    return fleetSummary(fleet, metrics, open, rent, warn);
  }, [fleet, meters, rentals, orders, perEquipment]);

  const backlog = maintenanceBacklog(orders);
  const fleetMttr = mttr(orders);

  /* ── محاسبات افزونهٔ EQP ── */

  const nameOf = (id?: string) => fleet.find((e) => e.Id === id)?.NameFa ?? id ?? "—";

  /** دروازه‌های پیش‌نیاز هر برگهٔ دیسپچ — تحویلی ۵. */
  const dispatchRows = useMemo(
    () =>
      SAMPLE_DISPATCH.map((d) => {
        const e = fleet.find((x) => x.Id === d.EquipmentId);
        if (!e) return { d, check: null };
        const eo = ordersOf(e.Id);
        const pmForEquip = SAMPLE_PM.filter((x) => x.EquipmentId === e.Id && x.Active !== false);
        let pmOverdueDays = 0;
        for (const sc of pmForEquip) {
          const due = pmDueByBasis(sc, TODAY, PM_READING[sc.Id ?? ""] ?? 0);
          if (due.overdue) {
            pmOverdueDays = Math.max(pmOverdueDays, sc.Basis === "calendar_days" ? Math.abs(due.remaining) : Math.ceil(Math.abs(due.remaining) / 8));
          }
        }
        const check = dispatchPrecheck({
          nowIso: TODAY,
          equipment: e,
          openCriticalOrders: eo.filter((o) => o.Priority === "critical" && (o.Status === "open" || o.Status === "in_progress")).length,
          pmOverdueDays,
          operatorLicenseExpiry: d.OperatorId ? OPERATOR_LICENSE[d.OperatorId] : undefined,
          operatorAssigned: Boolean(d.OperatorId),
          safetyCheckDone: d.SafetyCheck === true,
          rentalActive: Boolean(rentalOf(e.Id)),
        });
        return { d, check };
      }),
    [fleet, orders, rentals]
  );

  /** سررسید برنامه‌های PM بر چهار پایه — تحویلی ۷. */
  const pmRows = useMemo(
    () =>
      SAMPLE_PM.map((sc) => ({
        sc,
        due: pmDueByBasis(sc, TODAY, PM_READING[sc.Id ?? ""] ?? 0, sc.Basis === "run_hours" ? 4 : 0),
      })).sort((a, b) => {
        const rank = { overdue: 0, due: 1, soon: 2, ok: 3 } as const;
        return rank[a.due.severity] - rank[b.due.severity];
      }),
    []
  );

  const fuelStats = useMemo(() => fuelSummary(SAMPLE_FUEL), []);
  const totalWorkHours = useMemo(() => workHoursSum(meters), [meters]);
  const sfc = useMemo(() => specificFuelConsumption(fuelStats.quantity, totalWorkHours, 18), [fuelStats, totalWorkHours]);

  const partRows = useMemo(() => partsToRequisition(SAMPLE_PARTS), []);
  const partAll = useMemo(() => SAMPLE_PARTS.map((pt) => ({ pt, stock: partStockStatus(pt) })), []);

  const pareto = useMemo(
    () => rcaPareto(orders.map((o) => ({ ...o, RootCause: ROOT_CAUSE[o.Id ?? ""] }))),
    [orders]
  );

  const pmc = useMemo(() => pmCompliance(orders, SAMPLE_PM.filter((x) => x.Active !== false).length), [orders]);

  /** تابلوی هشت شاخص ناوگان — تحویلی ۱۰. تولید واقعی از برگه‌های دیسپچ اجراشده می‌آید. */
  const kpiBoard = useMemo(() => {
    const executed = SAMPLE_DISPATCH.filter((d) => d.Status === "executed" && (d.PlannedQty ?? 0) > 0);
    const actualOutput = executed.reduce((acc, d) => acc + (d.PlannedQty ?? 0), 0);
    const execHours = executed.reduce((acc, d) => acc + (d.PlannedHours || 0), 0);
    const rated = execHours > 0 ? actualOutput / execHours : 0;
    return fleetKpiBoard({
      equipment: fleet,
      metrics: fleet.map((e) => ({
        workHours: workHoursSum(metersOf(e.Id)),
        downtimeHrs: downtimeHours(ordersOf(e.Id), FROM, TODAY),
        periodDays: WINDOW_DAYS,
      })),
      orders,
      plannedPmCount: SAMPLE_PM.filter((x) => x.Active !== false).length,
      maintenanceCost: orders.reduce((acc, o) => acc + (Number(o.Cost) || 0), 0),
      assetValue: fleet.reduce((acc, e) => acc + (Number(e.PurchaseValue) || 0), 0),
      fuelLitres: fuelStats.quantity,
      actualOutput: rated > 0 ? actualOutput : undefined,
      ratedOutputPerHour: rated > 0 ? rated : undefined,
      periodDays: WINDOW_DAYS,
    });
  }, [fleet, meters, orders, fuelStats]);

  const pmOverdueMax = useMemo(
    () => pmRows.reduce((acc, r) => (r.due.overdue ? Math.max(acc, r.sc.Basis === "calendar_days" ? Math.abs(r.due.remaining) : Math.ceil(Math.abs(r.due.remaining) / 8)) : acc), 0),
    [pmRows]
  );

  const fleetAlerts = useMemo(
    () =>
      ewsEqp({
        availabilityPct: kpiBoard.availability,
        utilizationPct: kpiBoard.utilization,
        utilLowPct: 40,
        pmOverdueDays: pmOverdueMax,
        criticalBacklog: backlog.byPriority.critical,
        sfc: sfc.sfc,
        sfcBenchmark: 18,
      }),
    [kpiBoard, pmOverdueMax, backlog, sfc]
  );

  const health = useMemo(
    () =>
      equipmentHealthScore({
        availabilityPct: kpiBoard.availability,
        utilizationPct: kpiBoard.utilization,
        pmCompliancePct: pmc.rate,
        criticalBacklog: backlog.byPriority.critical,
        agingRatio: 0.3,
      }),
    [kpiBoard, pmc, backlog]
  );

  /** نمونهٔ TCO و تحلیل خرید/اجاره روی بیل مکانیکی ملکی — تحویلی ۴. */
  const tcoSample = useMemo(() => {
    const e = fleet.find((x) => x.PurchaseValue);
    if (!e) return null;
    const cat = CATEGORY_BY_CODE[e.Category] ?? CATEGORY_BY_CODE["OTH"];
    const input = {
      purchaseValue: Number(e.PurchaseValue),
      salvageValue: Number(e.SalvageValue ?? 0),
      lifeYears: cat.economicLifeYears,
      annualOperatingCost: 1_800_000_000,
      annualMaintenanceCost: 900_000_000,
      annualInsuranceCost: 240_000_000,
      annualWorkHours: 1_800,
    };
    return { e, tco: tco(input), compare: buyVsRent(input, 2_500_000, 900_000) };
  }, [fleet]);

  const advanceWo = (id: string) => {
    const flow: MaintenanceOrderRow["Status"][] = ["open", "in_progress", "done", "closed"];
    setOrders((prev) =>
      prev.map((o) => {
        if (o.Id !== id) return o;
        const i = flow.indexOf(o.Status);
        if (i < 0 || i === flow.length - 1) return o;
        const next = flow[i + 1];
        logAudit("EQM_WO_ADVANCE", "Equipment", `Work order ${o.Code}: ${o.Status} → ${next}`);
        return { ...o, Status: next };
      })
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* هدر */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10 text-[15px]">🚜</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">
              {rtl ? "مدیریت ماشین‌آلات و تجهیزات" : "Machinery & Equipment Management"}
            </h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "ناوگان · ساعت کارکرد · اجاره · تعمیرات · بهره‌وری — همه محاسبات روی موتور خالص eqm-v1"
                : "fleet · working hours · rental · maintenance · productivity — all on the eqm-v1 engine"}
            </p>
          </div>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3">{rtl ? "ناوگان" : "fleet"} {fmt(summary.total)}</span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3">{rtl ? "در تعمیر" : "in repair"} {fmt(summary.inRepair)}</span>
          <span className={`rounded-lg px-2 py-1 text-[9px] font-semibold tabular-nums ${summary.warnings > 0 ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/15 text-emerald-300"}`}>
            {rtl ? "هشدار" : "alerts"} {fmt(summary.warnings)}
          </span>
          <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[9px] tx3" dir="ltr">{EQM_VERSION} · {TODAY}</span>
        </div>
        {validationIssues.length > 0 && (
          <div className="mt-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-2 py-1 text-[8.5px] text-rose-300">
            {rtl ? "خطای اعتبارسنجی در داده نمونه" : "Validation errors in sample data"}: {validationIssues.join(" · ")}
          </div>
        )}
      </section>

      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
          {TABS.map((it) => (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition ${tab === it.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
            >
              <span>{it.icon}</span>
              <span>{rtl ? it.fa : it.en}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* ═══ تب ۱: ناوگان ═══ */}
        {tab === "fleet" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Kpi label={rtl ? "کل ماشین‌آلات" : "Total equipment"} value={fmt(summary.total)} hint={rtl ? "در ناوگان" : "in fleet"} />
              <Kpi label={rtl ? "فعال" : "Active"} value={fmt(summary.active)} tone="text-emerald-300" />
              <Kpi label={rtl ? "در تعمیر" : "In repair"} value={fmt(summary.inRepair)} tone={summary.inRepair ? "text-amber-300" : "tx1"} />
              <Kpi label={rtl ? "ملکی" : "Owned"} value={fmt(summary.byOwnership.owned)} hint={rtl ? "در برابر اجاره‌ای" : "vs rented"} />
              <Kpi label={rtl ? "اجاره‌ای" : "Rented"} value={fmt(summary.byOwnership.rented)} tone="text-sky-300" />
            </div>

            <Section title={rtl ? "ثبت ناوگان" : "Fleet registry"} note={rtl ? "هر ردیف یک ماشین · اعتبارسنجی دسته/مالکیت/وضعیت از موتور eqm-v1" : "one row per machine · category/ownership/status validated by eqm-v1"}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr>
                      <Th>{rtl ? "کد" : "Code"}</Th>
                      <Th>{rtl ? "نام" : "Name"}</Th>
                      <Th>{rtl ? "دسته" : "Category"}</Th>
                      <Th>{rtl ? "کد ISO 14224" : "ISO 14224"}</Th>
                      <Th>{rtl ? "مالکیت" : "Ownership"}</Th>
                      <Th>{rtl ? "سال" : "Year"}</Th>
                      <Th>{rtl ? "سن (سال)" : "Age (yr)"}</Th>
                      <Th>{rtl ? "وضعیت" : "Status"}</Th>
                      <Th>{rtl ? "شناسه اسکن" : "Scan ID"}</Th>
                      <Th>{rtl ? "هشدار" : "Alerts"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {perEquipment.map(({ e, age, warnings }) => (
                      <tr key={e.Id}>
                        <Td tone="font-mono">{e.Code}</Td>
                        <Td>{e.NameFa}</Td>
                        <Td>{rtl ? catFa(e.Category) : catEn(e.Category)}</Td>
                        <Td tone="font-mono tx3" dir="ltr">{iso14224Code(e.Category)}</Td>
                        <Td>{rtl ? (e.Ownership === "owned" ? "ملکی" : e.Ownership === "rented" ? "اجاره‌ای" : "لیزینگ") : e.Ownership}</Td>
                        <Td>{e.Year ?? "—"}</Td>
                        <Td tone="tabular-nums">{age.years}</Td>
                        <Td><Badge tone={STATUS_TONE[e.Status]}>{rtl ? (e.Status === "active" ? "فعال" : e.Status === "idle" ? "بیکار" : e.Status === "repair" ? "تعمیر" : "مستهلک") : e.Status}</Badge></Td>
                        <Td tone="font-mono text-[8px] tx4" dir="ltr">{equipmentQrPayload(e)}</Td>
                        <Td>{warnings.length ? <Badge tone="bg-rose-400/15 text-rose-300">{warnings.length}</Badge> : <span className="text-[9px] tx4">—</span>}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={rtl ? "کاتالوگ دسته‌بندی‌ها" : "Category catalog"} note={rtl ? "عمر اقتصادی و آستانه بهره‌برداری هر دسته" : "economic life & utilization thresholds per category"}>
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                {EQUIPMENT_CATEGORY_CATALOG.map((c) => (
                  <div key={c.code} className="flex items-center justify-between rounded-lg border b-line-soft bg-black/10 px-2 py-1.5">
                    <span className="text-[9px] tx2">{rtl ? c.fa : c.en} <span className="font-mono tx4" dir="ltr">({c.code})</span></span>
                    <span className="text-[8px] font-extralight tx4" dir="ltr">{c.economicLifeYears}y · {c.utilLowPct}%</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب: دیسپچ روزانه (تحویلی ۵) ═══ */}
        {tab === "dispatch" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Kpi label={rtl ? "برگه‌های امروز" : "Today's sheets"} value={fmt(dispatchRows.length)} hint={TODAY} />
              <Kpi label={rtl ? "تأییدشده" : "Approved"} value={fmt(dispatchRows.filter((x) => x.d.Status === "approved" || x.d.Status === "executed").length)} tone="text-emerald-300" />
              <Kpi label={rtl ? "در انتظار تأیید" : "Pending"} value={fmt(dispatchRows.filter((x) => x.d.Status === "submitted").length)} tone="text-amber-300" />
              <Kpi label={rtl ? "مسدود توسط دروازه" : "Gate-blocked"} value={fmt(dispatchRows.filter((x) => x.check && !x.check.allowed).length)} tone="text-rose-300" hint={rtl ? "پیش‌نیاز ناقص" : "prerequisite failed"} />
              <Kpi label={rtl ? "ساعت برنامه" : "Planned hours"} value={fmt(dispatchRows.reduce((acc, x) => acc + x.d.PlannedHours, 0))} hint={rtl ? "ساعت" : "hours"} />
            </div>

            <Section
              title={rtl ? "برگه دیسپچ روزانه" : "Daily dispatch sheet"}
              note={rtl ? "هر برگه پیش از اجرا از شش دروازه پیش‌نیاز عبور می‌کند (وضعیت، خرابی بحرانی، PM، اپراتور، گواهی‌نامه، ایمنی)" : "each sheet passes six precondition gates before execution"}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr>
                      <Th>{rtl ? "ماشین" : "Machine"}</Th>
                      <Th>{rtl ? "شیفت" : "Shift"}</Th>
                      <Th>{rtl ? "اپراتور" : "Operator"}</Th>
                      <Th>{rtl ? "محل" : "Site"}</Th>
                      <Th>{rtl ? "فعالیت" : "Activity"}</Th>
                      <Th>{rtl ? "ساعت/حجم" : "Hours/Qty"}</Th>
                      <Th>{rtl ? "وضعیت" : "Status"}</Th>
                      <Th>{rtl ? "دروازه‌ها" : "Gates"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchRows.map(({ d, check }) => (
                      <tr key={d.Id}>
                        <Td>{nameOf(d.EquipmentId)}</Td>
                        <Td>{rtl ? (d.Shift === "day" ? "روز" : d.Shift === "night" ? "شب" : "کامل") : d.Shift}</Td>
                        <Td tone="font-mono">{d.OperatorId ?? "—"}</Td>
                        <Td>{d.SiteFa ?? "—"}</Td>
                        <Td tone="font-mono tx3">{d.ActivityId ?? "—"}</Td>
                        <Td tone="tabular-nums">{fmt(d.PlannedHours)}h {d.PlannedQty ? `· ${fmt(d.PlannedQty)} ${d.QtyUom ?? ""}` : ""}</Td>
                        <Td><Badge tone={DISPATCH_TONE[d.Status]}>{rtl ? DISPATCH_FA[d.Status] : d.Status}</Badge></Td>
                        <Td>
                          {check ? (
                            <Badge tone={check.allowed ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}>
                              {check.allowed ? (rtl ? "مجاز" : "allowed") : `${check.blockers} ${rtl ? "مانع" : "blockers"}`}
                            </Badge>
                          ) : "—"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={rtl ? "جزئیات دروازه‌های پیش‌نیاز" : "Precondition gate detail"} note={rtl ? "دروازه‌های مسدودکننده اجرای دیسپچ را متوقف می‌کنند؛ بقیه فقط هشدارند" : "blocking gates stop execution; the rest are advisory"}>
              <div className="space-y-1.5">
                {dispatchRows.filter((x) => x.check && !x.check.allowed).length === 0 ? (
                  <p className="text-[9.5px] tx3">{rtl ? "همه برگه‌ها پیش‌نیازها را دارند." : "All sheets satisfy their preconditions."}</p>
                ) : (
                  dispatchRows.filter((x) => x.check && !x.check.allowed).map(({ d, check }) => (
                    <div key={d.Id} className="rounded-lg border b-line-soft bg-black/10 p-2">
                      <div className="text-[9.5px] font-medium tx2">{nameOf(d.EquipmentId)} <span className="font-mono tx4" dir="ltr">{d.Shift}</span></div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {check!.gates.map((g) => (
                          <span key={g.code} className={`rounded-lg px-2 py-0.5 text-[8.5px] ${g.passed ? "border b-line-soft tx4" : g.blocking ? "bg-rose-400/15 text-rose-300" : "bg-amber-400/15 text-amber-200"}`}>
                            {g.passed ? "✓" : "✕"} {g.message}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۲: ساعت کارکرد ═══ */}
        {tab === "meter" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "میانگین بهره‌برداری" : "Avg utilization"} value={`${summary.avgUtilization}%`} tone={summary.avgUtilization < 40 ? "text-amber-300" : "text-emerald-300"} hint={rtl ? "در ۳۰ روز" : "last 30 days"} />
              <Kpi label={rtl ? "کل ساعت کارکرد" : "Total work hours"} value={fmt(workHoursSum(meters))} hint={rtl ? "ساعت" : "hours"} />
              <Kpi label={rtl ? "قرائت ثبت‌شده" : "Meter readings"} value={fmt(meters.length)} />
              <Kpi label={rtl ? "قرائت تلهمتری" : "Telemetry"} value={fmt(meters.filter((m) => m.Source === "telemetry").length)} tone="text-sky-300" />
            </div>

            <Section title={rtl ? "قرائت ساعت‌شمار" : "Meter readings"} note={rtl ? "ساعت‌شمار صعودی است؛ عقب‌رفت با E-EQM-METER-ROLLBACK رد می‌شود" : "meter is monotonic; rollback rejected with E-EQM-METER-ROLLBACK"}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr>
                      <Th>{rtl ? "ماشین" : "Machine"}</Th>
                      <Th>{rtl ? "تاریخ" : "Date"}</Th>
                      <Th>{rtl ? "ساعت‌شمار" : "Hour meter"}</Th>
                      <Th>{rtl ? "کارکرد دوره" : "Period hours"}</Th>
                      <Th>{rtl ? "منبع" : "Source"}</Th>
                      <Th>{rtl ? "بهره‌برداری" : "Utilization"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...meters].sort((a, b) => String(a.ReadAt).localeCompare(String(b.ReadAt))).map((m) => {
                      const pe = perEquipment.find((p) => p.e.Id === m.EquipmentId);
                      return (
                        <tr key={m.Id}>
                          <Td>{pe ? pe.e.NameFa : m.EquipmentId}</Td>
                          <Td tone="font-mono" dir="ltr">{m.ReadAt}</Td>
                          <Td tone="tabular-nums">{fmt(m.HourMeter)}</Td>
                          <Td tone="tabular-nums">{fmt(m.WorkHours)}</Td>
                          <Td>{rtl ? (m.Source === "telemetry" ? "تلهمتری" : "دستی") : m.Source}</Td>
                          <Td>{pe ? <Badge tone={VERDICT_TONE[pe.util.verdict]}>{pe.util.rate}% · {rtl ? (pe.util.verdict === "normal" ? "نرمال" : pe.util.verdict === "low" ? "کم" : pe.util.verdict === "high" ? "زیاد" : "بدون کار") : pe.util.verdict}</Badge> : "—"}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب: سوخت و مصرفی (تحویلی ۶) ═══ */}
        {tab === "fuel" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "سوخت مصرفی" : "Fuel consumed"} value={fmt(fuelStats.quantity)} hint={rtl ? "لیتر · گازوئیل و بنزین" : "litres · diesel + gasoline"} />
              <Kpi label={rtl ? "هزینه مصرفی‌ها" : "Consumables cost"} value={fmt(Math.round(fuelStats.cost))} hint="IRR" />
              <Kpi label={rtl ? "مصرف ویژه سوخت" : "Specific fuel consumption"} value={`${sfc.sfc}`} tone={sfc.verdict === "excessive" ? "text-rose-300" : sfc.verdict === "efficient" ? "text-emerald-300" : "tx1"} hint={rtl ? "لیتر بر ساعت کارکرد · معیار ۱۸" : "L/h · benchmark 18"} />
              <Kpi label={rtl ? "ثبت‌های مصرف" : "Log entries"} value={fmt(SAMPLE_FUEL.length)} />
            </div>

            <Section title={rtl ? "تفکیک بر حسب نوع مصرفی" : "Breakdown by consumable"} note={rtl ? "روغن، گریس و لاستیک در هزینه می‌آیند اما در مصرف ویژه سوخت شمرده نمی‌شوند" : "oil, grease and tires count in cost but not in fuel consumption"}>
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                {Object.entries(fuelStats.byKind).map(([kind, v]) => (
                  <div key={kind} className="rounded-lg border b-line-soft bg-black/10 px-2 py-1.5">
                    <div className="text-[9px] tx3">{rtl ? FUEL_FA[kind] ?? kind : kind}</div>
                    <div className="mt-0.5 text-[11px] font-semibold tabular-nums tx1">{fmt(v.quantity)}</div>
                    <div className="text-[8px] font-extralight tx4 tabular-nums">{fmt(Math.round(v.cost))} IRR</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={rtl ? "دفتر مصرف سوخت و مواد" : "Fuel & consumables log"} note={rtl ? "مبنای محاسبه هزینه ساعتی ماشین و ارسال به کدهای هزینه در مالی" : "basis for equipment cost/hour sent to finance cost accounts"}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr>
                      <Th>{rtl ? "تاریخ" : "Date"}</Th>
                      <Th>{rtl ? "ماشین" : "Machine"}</Th>
                      <Th>{rtl ? "نوع" : "Kind"}</Th>
                      <Th>{rtl ? "مقدار" : "Quantity"}</Th>
                      <Th>{rtl ? "بهای واحد" : "Unit cost"}</Th>
                      <Th>{rtl ? "جمع" : "Total"}</Th>
                      <Th>{rtl ? "ساعت‌شمار" : "Hour meter"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_FUEL.map((f) => (
                      <tr key={f.Id}>
                        <Td tone="font-mono tx3" dir="ltr">{f.LogDate}</Td>
                        <Td>{nameOf(f.EquipmentId)}</Td>
                        <Td>{rtl ? FUEL_FA[f.Kind] ?? f.Kind : f.Kind}</Td>
                        <Td tone="tabular-nums">{fmt(f.Quantity)} {f.Uom ?? ""}</Td>
                        <Td tone="tabular-nums">{f.UnitCost ? fmt(f.UnitCost) : "—"}</Td>
                        <Td tone="tabular-nums">{f.UnitCost ? fmt(f.Quantity * f.UnitCost) : "—"}</Td>
                        <Td tone="tabular-nums tx3">{f.HourMeter ? fmt(f.HourMeter) : "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۳: اجاره ═══ */}
        {tab === "rental" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "قرارداد فعال" : "Active contracts"} value={fmt(rentals.filter((r) => r.Status === "active").length)} tone="text-sky-300" />
              <Kpi label={rtl ? "اجاره تعهدشده" : "Accrued rent"} value={fmt(Math.round(summary.accruedRent))} hint="IRR" />
              <Kpi label={rtl ? "قراردادها" : "Contracts"} value={fmt(rentals.length)} />
              <Kpi label={rtl ? "رو به پایان" : "Expiring soon"} value={fmt(rentals.filter((r) => r.Status === "active" && r.EndDate && nextPmDue(r.EndDate, 0, TODAY).daysLeft <= 14).length)} tone="text-amber-300" />
            </div>

            <Section title={rtl ? "قراردادهای اجاره" : "Rental contracts"} note={rtl ? "هزینه تعهدی تا امروز از نرخ × مدت (موتور خالص)" : "accrued cost = rate × elapsed, pure engine"}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead>
                    <tr>
                      <Th>{rtl ? "ماشین" : "Machine"}</Th>
                      <Th>{rtl ? "تأمین‌کننده" : "Supplier"}</Th>
                      <Th>{rtl ? "شماره" : "Contract"}</Th>
                      <Th>{rtl ? "نرخ" : "Rate"}</Th>
                      <Th>{rtl ? "دوره" : "Term"}</Th>
                      <Th>{rtl ? "تعهدی" : "Accrued"}</Th>
                      <Th>{rtl ? "وضعیت" : "Status"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentals.map((r) => {
                      const acc = rentalCostAccrued(r, TODAY);
                      const pe = perEquipment.find((p) => p.e.Id === r.EquipmentId);
                      return (
                        <tr key={r.Id}>
                          <Td>{pe ? pe.e.NameFa : r.EquipmentId}</Td>
                          <Td>{r.Supplier ?? "—"}</Td>
                          <Td tone="font-mono" dir="ltr">{r.ContractNo ?? "—"}</Td>
                          <Td tone="tabular-nums">{fmt(r.Rate)} <span className="tx4">/ {rtl ? (r.RateType === "monthly" ? "ماه" : r.RateType === "daily" ? "روز" : "ساعت") : r.RateType}</span></Td>
                          <Td tone="font-mono" dir="ltr">{r.StartDate} → {r.EndDate ?? "…"}</Td>
                          <Td tone="tabular-nums">{fmt(Math.round(acc.accrued))}</Td>
                          <Td><Badge tone={STATUS_TONE[r.Status]}>{rtl ? (r.Status === "active" ? "فعال" : r.Status === "expired" ? "منقضی" : "فسخ‌شده") : r.Status}</Badge></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ═══ TCO و خرید در برابر اجاره — الحاق به تب اجاره (تحویلی ۴) ═══ */}
        {tab === "rental" && tcoSample && (
          <Section
            title={rtl ? "هزینه کل مالکیت و تحلیل خرید در برابر اجاره" : "Total cost of ownership & buy-vs-rent"}
            note={rtl ? `نمونه روی «${tcoSample.e.NameFa}» — استهلاک خط مستقیم بدون تنزیل جریان نقدی` : `sample on “${tcoSample.e.NameFa}” — straight-line depreciation without cash-flow discounting`}
          >
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "هزینه کل مالکیت" : "Total cost of ownership"} value={fmt(Math.round(tcoSample.tco.totalCost))} hint="IRR" />
              <Kpi label={rtl ? "هزینه سالانه" : "Annual cost"} value={fmt(Math.round(tcoSample.tco.annualCost))} hint="IRR" />
              <Kpi label={rtl ? "هزینه مالکیت بر ساعت" : "Own cost per hour"} value={fmt(Math.round(tcoSample.compare.ownCostPerHour))} hint="IRR/h" />
              <Kpi
                label={rtl ? "توصیه" : "Recommendation"}
                value={rtl ? (tcoSample.compare.verdict === "buy" ? "خرید" : tcoSample.compare.verdict === "rent" ? "اجاره" : "خنثی") : tcoSample.compare.verdict}
                tone={tcoSample.compare.verdict === "buy" ? "text-emerald-300" : tcoSample.compare.verdict === "rent" ? "text-sky-300" : "tx1"}
                hint={rtl ? `صرفه‌جویی ${fmt(Math.round(tcoSample.compare.savingPerHour))} در ساعت` : `saving ${fmt(Math.round(tcoSample.compare.savingPerHour))}/h`}
              />
            </div>
            <p className="mt-2 text-[8.5px] font-extralight tx4">
              {rtl
                ? `نقطه سربه‌سر: ${Number.isFinite(tcoSample.compare.breakEvenHours) ? `${fmt(Math.round(tcoSample.compare.breakEvenHours))} ساعت کارکرد` : "با نرخ اجاره فعلی هرگز حاصل نمی‌شود"} · ساعت کارکرد در طول عمر: ${fmt(tcoSample.tco.lifetimeHours)} · استهلاک کل: ${fmt(Math.round(tcoSample.tco.depreciationTotal))} IRR`
                : `Break-even: ${Number.isFinite(tcoSample.compare.breakEvenHours) ? `${fmt(Math.round(tcoSample.compare.breakEvenHours))} work hours` : "never at the current rental rate"} · lifetime hours: ${fmt(tcoSample.tco.lifetimeHours)} · total depreciation: ${fmt(Math.round(tcoSample.tco.depreciationTotal))} IRR`}
            </p>
          </Section>
        )}

        {/* ═══ تب ۴: تعمیرات ═══ */}
        {tab === "maintenance" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Kpi label={rtl ? "دستورکار باز" : "Open orders"} value={fmt(backlog.total)} tone={backlog.total ? "text-amber-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "بحرانی" : "Critical"} value={fmt(backlog.byPriority.critical)} tone={backlog.byPriority.critical ? "text-rose-300" : "tx1"} />
              <Kpi label={rtl ? "اولویت بالا" : "High"} value={fmt(backlog.byPriority.high)} tone={backlog.byPriority.high ? "text-amber-300" : "tx1"} />
              <Kpi label={rtl ? "MTTR (ساعت)" : "MTTR (h)"} value={fleetMttr ? fmt(fleetMttr.mttrHours) : "—"} hint={rtl ? "میانگین زمان تعمیر" : "mean time to repair"} />
              <Kpi label={rtl ? "میانگین دسترس‌پذیری" : "Avg availability"} value={`${summary.avgAvailability}%`} tone={summary.avgAvailability < 95 ? "text-amber-300" : "text-emerald-300"} />
            </div>

            <Section title={rtl ? "دستورکارهای تعمیرات" : "Maintenance work orders"} note={rtl ? "پیشبرد وضعیت با دکمه اجرا می‌شود و در لاگ ممیزی ثبت می‌گردد" : "advance status to log an audit event"}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr>
                      <Th>{rtl ? "کد" : "Code"}</Th>
                      <Th>{rtl ? "ماشین" : "Machine"}</Th>
                      <Th>{rtl ? "نوع" : "Kind"}</Th>
                      <Th>{rtl ? "اولویت" : "Priority"}</Th>
                      <Th>{rtl ? "توقف" : "Downtime"}</Th>
                      <Th>{rtl ? "هزینه" : "Cost"}</Th>
                      <Th>{rtl ? "وضعیت" : "Status"}</Th>
                      <Th>{rtl ? "پیشبرد" : "Advance"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const pe = perEquipment.find((p) => p.e.Id === o.EquipmentId);
                      const down = o.DownFrom && o.DownTo ? round1((Date.parse(o.DownTo) - Date.parse(o.DownFrom)) / 3_600_000) : null;
                      return (
                        <tr key={o.Id}>
                          <Td tone="font-mono" dir="ltr">{o.Code}</Td>
                          <Td>{pe ? pe.e.NameFa : o.EquipmentId}</Td>
                          <Td>{rtl ? (o.Kind === "corrective" ? "اصلاحی" : o.Kind === "preventive" ? "پیشگیرانه" : o.Kind === "inspection" ? "بازرسی" : "اساسی") : o.Kind}</Td>
                          <Td>{rtl ? (o.Priority === "critical" ? "بحرانی" : o.Priority === "high" ? "زیاد" : o.Priority === "medium" ? "متوسط" : "کم") : o.Priority}</Td>
                          <Td tone="tabular-nums">{down !== null ? `${down}h` : "—"}</Td>
                          <Td tone="tabular-nums">{fmt(Number(o.Cost) || 0)}</Td>
                          <Td><Badge tone={STATUS_TONE[o.Status]}>{rtl ? (o.Status === "open" ? "باز" : o.Status === "in_progress" ? "در جریان" : o.Status === "done" ? "انجام‌شده" : "بسته") : o.Status}</Badge></Td>
                          <Td>
                            <button
                              onClick={() => advanceWo(o.Id!)}
                              disabled={o.Status === "closed"}
                              className="rounded-lg border b-line-soft px-2 py-0.5 text-[8.5px] tx3 hover:tx1 disabled:opacity-40"
                            >
                              {rtl ? "مرحله بعد" : "next"}
                            </button>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ═══ برنامه نگهداری پیشگیرانه و تحلیل ریشه‌ای — الحاق به تب تعمیرات (تحویلی ۷ و ۸) ═══ */}
        {tab === "maintenance" && (
          <>
            <Section
              title={rtl ? "برنامه نگهداری پیشگیرانه" : "Preventive maintenance schedule"}
              note={rtl ? "سررسید بر چهار پایه: ساعت کارکرد، کیلومتر، روز تقویمی و سیکل — معوق‌ها دیسپچ را مسدود می‌کنند" : "due on four bases: run hours, kilometers, calendar days and cycles — overdue blocks dispatch"}
            >
              <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Kpi label={rtl ? "برنامه فعال" : "Active schedules"} value={fmt(SAMPLE_PM.filter((x) => x.Active !== false).length)} />
                <Kpi label={rtl ? "معوق" : "Overdue"} value={fmt(pmRows.filter((x) => x.due.severity === "overdue").length)} tone={pmRows.some((x) => x.due.severity === "overdue") ? "text-rose-300" : "text-emerald-300"} />
                <Kpi label={rtl ? "نزدیک موعد" : "Due soon"} value={fmt(pmRows.filter((x) => x.due.severity === "soon" || x.due.severity === "due").length)} tone="text-amber-300" />
                <Kpi label={rtl ? "انطباق نگهداری" : "PM compliance"} value={`${pmc.rate}%`} tone={pmc.verdict === "good" ? "text-emerald-300" : pmc.verdict === "fair" ? "text-amber-300" : "text-rose-300"} hint={`${pmc.done}/${pmc.planned}`} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr>
                      <Th>{rtl ? "کد" : "Code"}</Th>
                      <Th>{rtl ? "ماشین" : "Machine"}</Th>
                      <Th>{rtl ? "عنوان" : "Title"}</Th>
                      <Th>{rtl ? "پایه" : "Basis"}</Th>
                      <Th>{rtl ? "بازه" : "Interval"}</Th>
                      <Th>{rtl ? "مانده" : "Remaining"}</Th>
                      <Th>{rtl ? "پیشرفت دوره" : "Cycle progress"}</Th>
                      <Th>{rtl ? "وضعیت" : "Status"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pmRows.map(({ sc, due }) => (
                      <tr key={sc.Id}>
                        <Td tone="font-mono" dir="ltr">{sc.Code}</Td>
                        <Td>{nameOf(sc.EquipmentId)}</Td>
                        <Td>{sc.TitleFa}</Td>
                        <Td tone="tx3">{rtl ? PM_BASIS_FA[sc.Basis] : sc.Basis}</Td>
                        <Td tone="tabular-nums tx3">{fmt(sc.IntervalValue)}</Td>
                        <Td tone="tabular-nums">{fmt(due.remaining)}{due.dueIso && <span className="ms-1 font-mono text-[8px] tx4" dir="ltr">{due.dueIso}</span>}</Td>
                        <Td>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/25">
                            <div className={`h-full ${due.progressPct >= 100 ? "bg-rose-400/70" : due.progressPct >= 90 ? "bg-amber-400/70" : "bg-emerald-400/60"}`} style={{ width: `${Math.min(100, due.progressPct)}%` }} />
                          </div>
                          <span className="text-[8px] tabular-nums tx4">{due.progressPct}%</span>
                        </Td>
                        <Td><Badge tone={PM_TONE[due.severity]}>{rtl ? PM_FA[due.severity] : due.severity}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title={rtl ? "تحلیل ریشه‌ای خرابی‌ها (ISO 14224)" : "Failure root-cause analysis (ISO 14224)"}
              note={rtl ? "توزیع پارتو علل خرابی — تمرکز بر علل صدر جدول بیشترین کاهش توقف را می‌دهد" : "Pareto of failure causes — attacking the top causes yields the largest downtime reduction"}
            >
              {pareto.length === 0 ? (
                <p className="text-[9.5px] tx3">{rtl ? "خرابی ثبت‌شده‌ای در بازه نیست." : "No failures recorded in this window."}</p>
              ) : (
                <div className="space-y-1.5">
                  {pareto.map((row) => (
                    <div key={row.cause} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-[9px] tx2">{rtl ? RCA_FA[row.cause] ?? row.cause : row.cause}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/25">
                        <div className="h-full bg-sky-400/60" style={{ width: `${row.pct}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-end text-[8.5px] tabular-nums tx4" dir="ltr">{row.count} · {row.pct}% · Σ{row.cumulativePct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {/* ═══ تب: قطعات یدکی (تحویلی ۹) ═══ */}
        {tab === "parts" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "اقلام انبار" : "Stock items"} value={fmt(SAMPLE_PARTS.length)} />
              <Kpi label={rtl ? "نیازمند سفارش" : "To requisition"} value={fmt(partRows.length)} tone={partRows.length ? "text-amber-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "کمبود بحرانی" : "Critical shortage"} value={fmt(partRows.filter((x) => x.stock.critical && x.stock.status !== "reorder").length)} tone="text-rose-300" hint={rtl ? "توقف خط تولید" : "line-stopping"} />
              <Kpi label={rtl ? "ارزش سفارش پیشنهادی" : "Suggested order value"} value={fmt(Math.round(partRows.reduce((acc, x) => acc + x.stock.suggestedQty * (x.part.UnitCost ?? 0), 0)))} hint="IRR" />
            </div>

            <Section
              title={rtl ? "موجودی و نقطه سفارش" : "Inventory & reorder point"}
              note={rtl ? "نقطه سفارش = مصرف روزانه × زمان تأمین + حداقل موجودی؛ اقلام زیر این نقطه به درخواست خرید در مالی تبدیل می‌شوند" : "ROP = daily usage × lead time + safety stock; items below become purchase requisitions in finance"}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] border-collapse">
                  <thead>
                    <tr>
                      <Th>{rtl ? "کد قطعه" : "Part no."}</Th>
                      <Th>{rtl ? "نام" : "Name"}</Th>
                      <Th>{rtl ? "موجودی" : "On hand"}</Th>
                      <Th>{rtl ? "حداقل" : "Min"}</Th>
                      <Th>{rtl ? "نقطه سفارش" : "ROP"}</Th>
                      <Th>{rtl ? "پوشش (روز)" : "Cover (days)"}</Th>
                      <Th>{rtl ? "وضعیت" : "Status"}</Th>
                      <Th>{rtl ? "سفارش پیشنهادی" : "Suggested qty"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {partAll.map(({ pt, stock }) => (
                      <tr key={pt.Id}>
                        <Td tone="font-mono" dir="ltr">{pt.PartNo}</Td>
                        <Td>{pt.NameFa} {pt.Critical && <Badge tone="bg-rose-400/15 text-rose-300">{rtl ? "بحرانی" : "critical"}</Badge>}</Td>
                        <Td tone="tabular-nums">{fmt(pt.OnHand)} {pt.Uom ?? ""}</Td>
                        <Td tone="tabular-nums tx3">{fmt(pt.MinLevel)}</Td>
                        <Td tone="tabular-nums tx3">{fmt(stock.rop)}</Td>
                        <Td tone="tabular-nums tx3">{stock.daysOfCover >= 9999 ? "—" : fmt(Math.round(stock.daysOfCover))}</Td>
                        <Td><Badge tone={PART_TONE[stock.status]}>{rtl ? PART_FA[stock.status] : stock.status}</Badge></Td>
                        <Td tone="tabular-nums">{stock.suggestedQty ? fmt(stock.suggestedQty) : "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={rtl ? "پیش‌نویس درخواست خرید" : "Draft purchase requisition"} note={rtl ? "قطعات بحرانی در صدر فهرست‌اند — این خروجی ورودی گردش‌کار تدارکات در مالی است" : "critical parts first — this output feeds the finance procurement workflow"}>
              {partRows.length === 0 ? (
                <p className="text-[9.5px] tx3">{rtl ? "موجودی همه اقلام بالای نقطه سفارش است." : "All items are above their reorder point."}</p>
              ) : (
                <div className="space-y-1.5">
                  {partRows.map(({ part: pt, stock }) => (
                    <div key={pt.Id} className="flex flex-wrap items-center gap-2 rounded-lg border b-line-soft bg-black/10 px-2 py-1.5">
                      <Badge tone={PART_TONE[stock.status]}>{rtl ? PART_FA[stock.status] : stock.status}</Badge>
                      <span className="text-[9.5px] tx2">{pt.NameFa}</span>
                      <span className="font-mono text-[8.5px] tx4" dir="ltr">{pt.PartNo}</span>
                      <span className="text-[9px] tabular-nums tx3">{rtl ? "سفارش" : "order"} {fmt(stock.suggestedQty)} {pt.Uom ?? ""}</span>
                      <span className="text-[9px] tabular-nums tx3">≈ {fmt(Math.round(stock.suggestedQty * (pt.UnitCost ?? 0)))} IRR</span>
                      <span className="text-[8.5px] tx4">{rtl ? "زمان تأمین" : "lead"} {pt.LeadTimeDays ?? 0} {rtl ? "روز" : "d"}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {/* ═══ تب ۵: بهره‌وری ═══ */}
        {tab === "productivity" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "میانگین بهره‌برداری" : "Avg utilization"} value={`${summary.avgUtilization}%`} />
              <Kpi label={rtl ? "میانگین دسترس‌پذیری" : "Avg availability"} value={`${summary.avgAvailability}%`} />
              <Kpi label={rtl ? "هشدارهای فعال" : "Active warnings"} value={fmt(summary.warnings)} tone={summary.warnings ? "text-rose-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "نمره سلامت ناوگان" : "Fleet health score"} value={`${health.score}`} tone={health.grade === "A" ? "text-emerald-300" : health.grade === "B" ? "text-sky-300" : health.grade === "C" ? "text-amber-300" : "text-rose-300"} hint={rtl ? `رتبه ${health.grade} · سهم در شاخص سلامت پروژه` : `grade ${health.grade} · feeds project health index`} />
            </div>

            <Section
              title={rtl ? "تابلوی هشت شاخص ماشین‌آلات" : "Eight-KPI equipment board"}
              note={rtl ? "شاخص‌های استاندارد ISO 14224 و OEE — هدف هر شاخص از کاتالوگ موتور می‌آید" : "ISO 14224 standard indicators and OEE — targets come from the engine catalog"}
            >
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                {EQP_KPI_CATALOG.map((k) => {
                  const value =
                    k.code === "K-EQP-AVAIL" ? kpiBoard.availability
                    : k.code === "K-EQP-UTIL" ? kpiBoard.utilization
                    : k.code === "K-EQP-OEE" ? kpiBoard.oee
                    : k.code === "K-EQP-MTBF" ? kpiBoard.mtbfHours
                    : k.code === "K-EQP-MTTR" ? kpiBoard.mttrHours
                    : k.code === "K-EQP-MCR" ? kpiBoard.maintenanceCostRatio
                    : k.code === "K-EQP-PMC" ? kpiBoard.pmCompliance
                    : kpiBoard.sfc;
                  const onTarget = value === null ? null : k.direction === "higher" ? value >= k.target : value <= k.target;
                  return (
                    <div key={k.code} className="rounded-lg border b-line-soft bg-black/10 px-2 py-1.5">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[9px] tx3">{rtl ? k.fa : k.en}</span>
                        <span className="font-mono text-[7.5px] tx4" dir="ltr">{k.code.replace("K-EQP-", "")}</span>
                      </div>
                      <div className={`mt-0.5 text-[13px] font-semibold tabular-nums ${onTarget === null ? "tx4" : onTarget ? "text-emerald-300" : "text-amber-300"}`}>
                        {value === null ? (rtl ? "سنجش‌ناپذیر" : "n/a") : `${fmt(value)}`}
                        {value !== null && <span className="ms-1 text-[8px] font-extralight tx4">{k.unit}</span>}
                      </div>
                      <div className="text-[8px] font-extralight tx4">
                        {rtl ? "هدف" : "target"} {k.direction === "higher" ? "≥" : "≤"} {fmt(k.target)} {k.unit}
                      </div>
                    </div>
                  );
                })}
              </div>
              {kpiBoard.oee === null && (
                <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[8.5px] text-amber-200">
                  {rtl
                    ? "OEE بدون ثبت تولید واقعی سنجش‌ناپذیر است؛ برگه دیسپچ اجراشده با حجم تولید لازم است. فرض ۱۰۰٪ برای مؤلفه عملکرد عمداً انجام نمی‌شود."
                    : "OEE is not measurable without actual output; an executed dispatch sheet with quantity is required. The performance factor is deliberately not assumed to be 100%."}
                </p>
              )}
            </Section>

            <Section
              title={rtl ? "هشدار زودهنگام ناوگان (EWS-EQP)" : "Fleet early warning (EWS-EQP)"}
              note={rtl ? "شش قاعده در سطح ناوگان با ماتریس تشدید — جدا از هشدارهای تک‌ماشین در پایین صفحه" : "six fleet-level rules with an escalation matrix — separate from the per-machine warnings below"}
            >
              {fleetAlerts.length === 0 ? (
                <p className="text-[9.5px] tx3">{rtl ? "هیچ قاعده‌ای در سطح ناوگان فعال نشده است." : "No fleet-level rule triggered."}</p>
              ) : (
                <div className="space-y-1.5">
                  {fleetAlerts.map((a) => (
                    <div key={a.code} className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 ${a.severity === "critical" ? "bg-rose-400/10" : "bg-amber-400/10"}`}>
                      <span className="font-mono text-[8px] tx4" dir="ltr">{a.code}</span>
                      <span className={`text-[9.5px] ${a.severity === "critical" ? "text-rose-300" : "text-amber-200"}`}>{a.message}</span>
                      <span className="ms-auto text-[8.5px] tx4">{rtl ? "تشدید به" : "escalate to"}: {a.escalateTo}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
                {EWS_EQP_RULES.map((r) => (
                  <div key={r.code} className="flex items-center gap-2 rounded-lg border b-line-soft px-2 py-1">
                    <span className="font-mono text-[7.5px] tx4" dir="ltr">{r.code}</span>
                    <span className="text-[8.5px] tx3">{r.fa}</span>
                    <span className="ms-auto font-mono text-[7.5px] tx4" dir="ltr">{r.condition}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={rtl ? "کارنامه هر ماشین" : "Per-machine scorecard"} note={rtl ? "بهره‌برداری، دسترس‌پذیری و هزینه بر ساعت — همه از موتور خالص" : "utilization, availability, cost/hour — pure engine"}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse">
                  <thead>
                    <tr>
                      <Th>{rtl ? "ماشین" : "Machine"}</Th>
                      <Th>{rtl ? "کارکرد" : "Hours"}</Th>
                      <Th>{rtl ? "بهره‌برداری" : "Utilization"}</Th>
                      <Th>{rtl ? "دسترس‌پذیری" : "Availability"}</Th>
                      <Th>{rtl ? "توقف" : "Downtime"}</Th>
                      <Th>{rtl ? "هزینه/ساعت" : "Cost/hour"}</Th>
                      <Th>{rtl ? "ارزش دفتری" : "Book value"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {perEquipment.map(({ e, wh, util, avail, down, cost, dep }) => (
                      <tr key={e.Id}>
                        <Td>{e.NameFa}</Td>
                        <Td tone="tabular-nums">{fmt(wh)}</Td>
                        <Td><Badge tone={VERDICT_TONE[util.verdict]}>{util.rate}%</Badge></Td>
                        <Td><Badge tone={VERDICT_TONE[avail.verdict]}>{avail.rate}%</Badge></Td>
                        <Td tone="tabular-nums">{fmt(down)}h</Td>
                        <Td tone="tabular-nums">{cost.costPerHour ? fmt(Math.round(cost.costPerHour)) : "—"}</Td>
                        <Td tone="tabular-nums">{dep ? fmt(Math.round(dep.bookValue)) : "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={rtl ? "هشدار زودهنگام (EWS)" : "Early warning system"} note={rtl ? "کدهای W-EQM-* از موتور خالص eqmEws" : "W-EQM-* codes from pure eqmEws"}>
              {perEquipment.every((p) => p.warnings.length === 0) ? (
                <p className="text-[9.5px] tx3">{rtl ? "هیچ هشدار فعالی نیست. ناوگان در وضعیت سالم است." : "No active warnings — the fleet is healthy."}</p>
              ) : (
                <div className="space-y-1.5">
                  {perEquipment.filter((p) => p.warnings.length > 0).map(({ e, warnings }) => (
                    <div key={e.Id} className="rounded-lg border b-line-soft bg-black/10 p-2">
                      <div className="text-[9.5px] font-medium tx2">{e.NameFa} <span className="font-mono tx4" dir="ltr">{e.Code}</span></div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {warnings.map((w) => (
                          <span key={w.code} className={`rounded-lg px-2 py-0.5 text-[8.5px] ${w.severity === "critical" ? "bg-rose-400/15 text-rose-300" : w.severity === "warning" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>
                            <span dir="ltr">{w.code}</span> · {w.message}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title={rtl ? "خروجی گزارش‌های رسمی A4" : "Official A4 report exports"}
              note={rtl
                ? "شش گزارش با سربرگ سه‌لوگو (کارفرما، مشاور، پیمانکار) از موتور rpt-v1. خروجی رسمی تنها با دادهٔ کامل و بدون خرابی بحرانی باز صادر می‌شود."
                : "six three-logo reports rendered by the rpt-v1 engine; official issue requires complete data and no open critical failures"}
            >
              <div className="grid gap-1.5 md:grid-cols-2">
                {EQP_REPORT_CATALOG.map((r) => {
                  const q = `projectId=${encodeURIComponent(REPORT_PROJECT_ID)}`;
                  const href = (fmt: string) => `/api/eqp/reports/${r.code}?${q}&format=${fmt}`;
                  return (
                    <div key={r.code} className="rounded-lg border b-line-soft bg-black/10 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[9.5px] font-medium tx2">{rtl ? r.title.fa : r.title.en}</div>
                          <div className="mt-0.5 font-mono text-[8.5px] tx4" dir="ltr">{r.code}</div>
                        </div>
                        <Badge tone={r.audiences.includes("official") ? "bg-sky-400/15 text-sky-300" : "border b-line-soft tx3"}>
                          {r.audiences.includes("official") ? (rtl ? "رسمی" : "official") : (rtl ? "داخلی" : "internal")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[8.5px] leading-relaxed tx3">{rtl ? r.purpose.fa : r.purpose.en}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(["html", "doc", "xls", "csv"] as const).map((fmt) => (
                          <a
                            key={fmt}
                            href={href(fmt)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => logAudit("EQP_REPORT_EXPORT", "Equipment", `${r.code} → ${fmt.toUpperCase()}`)}
                            className="rounded-lg border b-line-soft px-2 py-0.5 text-[8.5px] tx2 hover:bg-white/5"
                            dir="ltr"
                          >
                            {fmt === "html" ? (rtl ? "چاپ / PDF" : "print / PDF") : fmt.toUpperCase()}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
