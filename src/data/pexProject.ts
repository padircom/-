/**
 * داده نمونه ماژول PEX (d2) — پروژه OG-2401.
 * تنها مصرف‌کننده منطق: src/services/planning.ts . این فایل «ظرف» داده است، نه موتور.
 * وزن گام‌های RoC از pex/data/roc_iran.json (مقیاس ۰..۱) با ضریب ۱۰۰ به مقیاس درصد آمده است.
 */
import type { Activity, Milestone, Period, Relation, RocStep, StepProgress, WeightItem } from "../services/planning";

export const PEX_PROJECT = {
  code: "OG-2401",
  nameFa: "واحد بازیافت گاز — فاز ۲",
  nameEn: "Gas Recovery Unit — Phase 2",
  start: "2026-01-03",
  dataDate: "2026-09-04",
  /** طول مسیر بحرانی در Baseline BL-01 (روز کاری) — مرجع محاسبه CP Drift. */
  baselineCpLength: 291,
  baselineEnd: "2026-12-07",
  baselineId: "BL-01",
  currency: "USD",
};

/** فعالیت‌های زمان‌بندی؛ cost/manHours مبنای وزن‌دهی PMS است. */
export type PexActivity = Activity & {
  wbs: string;
  nameEn: string;
  cost: number;
  manHours: number;
  /** کد دستور Rule of Credit */
  roc: string;
  progress: StepProgress[];
};

export const PEX_ACTIVITIES: PexActivity[] = [
  { id: "ENG-BD", wbs: "1", nameFa: "طراحی پایه", nameEn: "Basic design", duration: 30, cost: 420_000, manHours: 5_400, actualStart: "2026-01-03", actualFinish: "2026-02-05", roc: "ENG-DOC", progress: [{ code: "idc", percent: 100, irApproved: true }, { code: "issue_review", percent: 100, irApproved: true }, { code: "issue_afc", percent: 100, irApproved: true }, { code: "drafting", percent: 100 }, { code: "calc", percent: 100 }] },
  { id: "ENG-DD", wbs: "1", nameFa: "مهندسی تفصیلی", nameEn: "Detail engineering", duration: 55, cost: 780_000, manHours: 11_200, actualStart: "2026-02-07", roc: "ENG-DOC", progress: [{ code: "drafting", percent: 100 }, { code: "calc", percent: 100 }, { code: "idc", percent: 100, irApproved: true }, { code: "issue_review", percent: 100, irApproved: true }, { code: "issue_afc", percent: 70, irApproved: true }] },
  { id: "PRC-LLI", wbs: "2", nameFa: "خرید اقلام بلندمدت", nameEn: "Long-lead items", duration: 110, cost: 3_150_000, manHours: 1_800, actualStart: "2026-02-14", roc: "PRC-EQP", progress: [{ code: "po", percent: 100 }, { code: "fabrication", percent: 100 }, { code: "fat", percent: 100, irApproved: true }, { code: "delivery", percent: 70, irApproved: true }] },
  { id: "PRC-BULK", wbs: "2", nameFa: "خرید اقلام بالک", nameEn: "Bulk materials", duration: 60, cost: 1_240_000, manHours: 900, actualStart: "2026-03-07", roc: "PRC-EQP", progress: [{ code: "po", percent: 100 }, { code: "fabrication", percent: 100 }, { code: "fat", percent: 100, irApproved: true }, { code: "delivery", percent: 90, irApproved: true }] },
  { id: "CIV-EXC", wbs: "3", nameFa: "خاکبرداری و تسطیح", nameEn: "Excavation & grading", duration: 20, cost: 310_000, manHours: 4_100, actualStart: "2026-02-09", actualFinish: "2026-03-10", roc: "CIV-EXC", progress: [{ code: "excavation", percent: 100 }, { code: "grading", percent: 100 }, { code: "compaction", percent: 100, irApproved: true }] },
  { id: "CIV-FND", wbs: "3", nameFa: "فونداسیون تجهیزات", nameEn: "Equipment foundations", duration: 55, cost: 890_000, manHours: 12_600, actualStart: "2026-04-25", roc: "CIV-FND", progress: [{ code: "excavation", percent: 100 }, { code: "blinding", percent: 100, irApproved: true }, { code: "rebar", percent: 100, irApproved: true }, { code: "form", percent: 100 }, { code: "pour", percent: 100, irApproved: true }, { code: "cure_strip", percent: 70 }] },
  { id: "STR-ERC", wbs: "3", nameFa: "نصب اسکلت فلزی", nameEn: "Steel erection", duration: 70, cost: 1_060_000, manHours: 14_800, actualStart: "2026-06-20", roc: "STR-STL", progress: [{ code: "fabrication", percent: 100 }, { code: "erection", percent: 85 }, { code: "bolting", percent: 70, irApproved: true }, { code: "grouting", percent: 40 }, { code: "painting", percent: 0 }] },
  { id: "MEC-EQP", wbs: "3", nameFa: "نصب تجهیزات مکانیکی", nameEn: "Mechanical equipment", duration: 50, cost: 1_480_000, manHours: 9_300, actualStart: "2026-08-15", roc: "MEC-EQP", progress: [{ code: "setting", percent: 100 }, { code: "alignment", percent: 80, irApproved: true }, { code: "grouting", percent: 60 }, { code: "internals", percent: 20 }, { code: "final_check", percent: 0, irApproved: false }] },
  { id: "PIP-SPL", wbs: "3", nameFa: "ساخت اسپول پایپینگ", nameEn: "Pipe spool fabrication", duration: 70, cost: 940_000, manHours: 15_500, actualStart: "2026-05-09", roc: "PIP-SPL", progress: [{ code: "cutting", percent: 100 }, { code: "fitup", percent: 100, irApproved: true }, { code: "welding", percent: 75, irApproved: true }, { code: "ndt", percent: 50, irApproved: true }, { code: "painting", percent: 15 }] },
  { id: "PIP-ERC", wbs: "3", nameFa: "نصب خطوط لوله", nameEn: "Piping erection", duration: 95, cost: 1_320_000, manHours: 21_400, actualStart: "2026-08-01", roc: "PIP-ERC", progress: [{ code: "erection", percent: 55 }, { code: "welding", percent: 45, irApproved: true }, { code: "ndt", percent: 30, irApproved: false }, { code: "support", percent: 25 }, { code: "hydrotest", percent: 0 }] },
  { id: "ELE-CBL", wbs: "3", nameFa: "کابل‌کشی برق", nameEn: "Electrical cabling", duration: 55, cost: 610_000, manHours: 8_700, actualStart: "2026-07-11", roc: "ELE-CBL", progress: [{ code: "tray", percent: 100 }, { code: "pulling", percent: 85 }, { code: "termination", percent: 30, irApproved: true }, { code: "megger", percent: 0 }] },
  { id: "INS-LOOP", wbs: "3", nameFa: "ابزار دقیق و لوپ", nameEn: "Instrumentation & loops", duration: 45, cost: 520_000, manHours: 6_200, actualStart: "2026-08-29", roc: "INS-LOOP", progress: [{ code: "mounting", percent: 60 }, { code: "tubing", percent: 40 }, { code: "cabling", percent: 20 }, { code: "calibration", percent: 10, irApproved: false }, { code: "loop_test", percent: 0, irApproved: false }] },
  { id: "PSU-FLS", wbs: "4", nameFa: "فلاشینگ و تست نهایی", nameEn: "Flushing & final test", duration: 25, cost: 260_000, manHours: 3_100, roc: "PSU-CHK", progress: [{ code: "punch", percent: 0 }, { code: "flushing", percent: 0 }, { code: "loop_check", percent: 0, irApproved: false }, { code: "handover", percent: 0, irApproved: false }] },
  { id: "PSU-RFSU", wbs: "4", nameFa: "آمادگی راه‌اندازی", nameEn: "Ready for start-up", duration: 0, cost: 0, manHours: 0, roc: "PSU-CHK", isMilestone: true, progress: [] },
];

export const PEX_RELATIONS: Relation[] = [
  { pred: "ENG-BD", succ: "ENG-DD", type: "FS" },
  { pred: "ENG-BD", succ: "PRC-LLI", type: "FS" },
  { pred: "ENG-DD", succ: "PRC-BULK", type: "SS", lag: 10 },
  { pred: "ENG-DD", succ: "CIV-FND", type: "FS", lag: 5 },
  { pred: "ENG-BD", succ: "CIV-EXC", type: "FS" },
  { pred: "CIV-EXC", succ: "CIV-FND", type: "FS" },
  { pred: "CIV-FND", succ: "STR-ERC", type: "FS" },
  { pred: "CIV-FND", succ: "MEC-EQP", type: "FS", lag: 5 },
  { pred: "PRC-LLI", succ: "MEC-EQP", type: "FS" },
  { pred: "PRC-BULK", succ: "PIP-SPL", type: "FS" },
  { pred: "STR-ERC", succ: "PIP-ERC", type: "SS", lag: 15 },
  { pred: "PIP-SPL", succ: "PIP-ERC", type: "SS", lag: 20 },
  { pred: "MEC-EQP", succ: "PIP-ERC", type: "SS", lag: 10 },
  { pred: "STR-ERC", succ: "ELE-CBL", type: "SS", lag: 20 },
  { pred: "ELE-CBL", succ: "INS-LOOP", type: "FS" },
  { pred: "PIP-ERC", succ: "PSU-FLS", type: "FS" },
  { pred: "INS-LOOP", succ: "PSU-FLS", type: "FS" },
  { pred: "PSU-FLS", succ: "PSU-RFSU", type: "FS" },
];

/** فعالیت‌های مرجع پیش‌بینی مایلستون: Forecast = EF همان فعالیت در CPM. */
export const PEX_MILESTONES: (Milestone & { driverActivity: string; nameEn: string })[] = [
  { id: "MS-ENG-IFC", nameFa: "صدور نقشه‌های IFC", nameEn: "IFC drawings issued", type: "Key", contractualDate: "2026-04-25", baselineDate: "2026-04-11", forecastDate: "2026-04-25", actualDate: "2026-05-02", driverActivity: "ENG-DD", alertDaysBefore: [30, 14, 7, 3, 1] },
  { id: "MS-CIV-FOC", nameFa: "تکمیل فونداسیون‌ها", nameEn: "Foundations complete", type: "Key", contractualDate: "2026-08-27", baselineDate: "2026-08-27", forecastDate: "2026-08-27", penaltyPerDay: 4_000, driverActivity: "CIV-FND", alertDaysBefore: [30, 14, 7, 3, 1] },
  { id: "MS-EQP-DEL", nameFa: "تحویل تجهیزات بلندمدت", nameEn: "Long-lead delivery", type: "Gate", contractualDate: "2026-09-30", baselineDate: "2026-09-30", forecastDate: "2026-09-30", penaltyPerDay: 6_500, driverActivity: "PRC-LLI", alertDaysBefore: [30, 14, 7, 3, 1] },
  { id: "MS-MECH-RFSU", nameFa: "تحویل مکانیکی و آمادگی راه‌اندازی", nameEn: "Mechanical completion / RFSU", type: "Contractual", contractualDate: "2026-12-14", baselineDate: "2026-12-07", forecastDate: "2026-11-14", penaltyPerDay: 25_000, bonusPerDay: 10_000, driverActivity: "PSU-RFSU", alertDaysBefore: [30, 14, 7, 3, 1] },
];

/** منحنی S برنامه‌ای (Baseline) — مبنای Planned% در Data Date. */
export const PEX_SCURVE: { date: string; cumPct: number }[] = [
  { date: "2026-01-03", cumPct: 0 },
  { date: "2026-03-01", cumPct: 9.4 },
  { date: "2026-04-30", cumPct: 26.8 },
  { date: "2026-06-30", cumPct: 52.5 },
  { date: "2026-08-31", cumPct: 84.2 },
  { date: "2026-09-30", cumPct: 92.6 },
  { date: "2026-10-31", cumPct: 97.1 },
  { date: "2026-12-07", cumPct: 100 },
];

/** تعهدات نگاه‌به‌جلو هفته جاری — مبنای PPC. */
export const PEX_COMMITMENTS: { week: string; activityId: string; committed: number; completed: number }[] = [
  { week: "W36", activityId: "CIV-FND", committed: 6, completed: 5 },
  { week: "W36", activityId: "STR-ERC", committed: 5, completed: 4 },
  { week: "W36", activityId: "PIP-SPL", committed: 7, completed: 6 },
  { week: "W36", activityId: "PIP-ERC", committed: 4, completed: 2 },
  { week: "W36", activityId: "ELE-CBL", committed: 3, completed: 3 },
];

export const PEX_PERIODS: Period[] = [
  { code: "1405-05", from: "2026-07-23", to: "2026-08-22", closedAt: "2026-08-28" },
  { code: "1405-06", from: "2026-08-23", to: "2026-09-22" },
];

/** دستورهای Rule of Credit مصرف‌شده در این پروژه (برگرفته از pex/data/roc_iran.json، مقیاس درصد). */
export const PEX_ROC: Record<string, { nameFa: string; ref: string; steps: RocStep[] }> = {
  "CIV-FND": {
    nameFa: "فونداسیون بتنی",
    ref: "نشریه ۵۵ · ACI 318 · ITP سیویل",
    steps: [
      { code: "excavation", nameFa: "گود/خاکبرداری پی", weight: 10 },
      { code: "blinding", nameFa: "بتن مگر", weight: 8, ir: true },
      { code: "rebar", nameFa: "آرماتوربندی", weight: 22, ir: true },
      { code: "form", nameFa: "قالب‌بندی", weight: 12 },
      { code: "pour", nameFa: "بتن‌ریزی", weight: 30, ir: true },
      { code: "cure_strip", nameFa: "عمل‌آوری و باز کردن قالب", weight: 18 },
    ],
  },
  "CIV-EXC": {
    nameFa: "خاکبرداری و تسطیح",
    ref: "نشریه ۵۵ · ITP خاکی",
    steps: [
      { code: "excavation", nameFa: "خاکبرداری", weight: 55 },
      { code: "grading", nameFa: "تسطیح", weight: 25 },
      { code: "compaction", nameFa: "تراکم و تست خاک", weight: 20, ir: true },
    ],
  },
  "STR-STL": {
    nameFa: "اسکلت فلزی",
    ref: "AISC 360 · مبحث ۱۰",
    steps: [
      { code: "fabrication", nameFa: "ساخت در کارگاه", weight: 30 },
      { code: "erection", nameFa: "نصب", weight: 30 },
      { code: "bolting", nameFa: "پیچ و جوش نهایی", weight: 20, ir: true },
      { code: "grouting", nameFa: "گروت‌ریزی", weight: 10 },
      { code: "painting", nameFa: "رنگ نهایی", weight: 10 },
    ],
  },
  "PIP-SPL": {
    nameFa: "ساخت اسپول",
    ref: "ASME B31.3 · ITP پایپینگ",
    steps: [
      { code: "cutting", nameFa: "برش و آماده‌سازی", weight: 15 },
      { code: "fitup", nameFa: "فیت‌آپ", weight: 20, ir: true },
      { code: "welding", nameFa: "جوشکاری", weight: 30, ir: true },
      { code: "ndt", nameFa: "آزمون غیرمخرب", weight: 20, ir: true },
      { code: "painting", nameFa: "رنگ", weight: 15 },
    ],
  },
  "PIP-ERC": {
    nameFa: "نصب خط لوله",
    ref: "ASME B31.3",
    steps: [
      { code: "erection", nameFa: "نصب اسپول", weight: 30 },
      { code: "welding", nameFa: "جوش فیلد", weight: 25, ir: true },
      { code: "ndt", nameFa: "NDT فیلد", weight: 15, ir: true },
      { code: "support", nameFa: "ساپورت‌گذاری", weight: 15 },
      { code: "hydrotest", nameFa: "تست هیدرواستاتیک", weight: 15, ir: true },
    ],
  },
  "ELE-CBL": {
    nameFa: "کابل‌کشی",
    ref: "IEC 60364 · مبحث ۱۳",
    steps: [
      { code: "tray", nameFa: "سینی و راه کابل", weight: 20 },
      { code: "pulling", nameFa: "کشیدن کابل", weight: 35 },
      { code: "termination", nameFa: "سرسیم‌بندی", weight: 30, ir: true },
      { code: "megger", nameFa: "تست مگر", weight: 15, ir: true },
    ],
  },
  "INS-LOOP": {
    nameFa: "ابزار دقیق و لوپ",
    ref: "ISA 5.1 · ITP ابزار دقیق",
    steps: [
      { code: "mounting", nameFa: "نصب ترانسمیتر", weight: 25 },
      { code: "tubing", nameFa: "تیوبینگ", weight: 20 },
      { code: "cabling", nameFa: "کابل ابزار دقیق", weight: 20 },
      { code: "calibration", nameFa: "کالیبراسیون", weight: 20, ir: true },
      { code: "loop_test", nameFa: "لوپ‌تست", weight: 15, ir: true },
    ],
  },
  "MEC-EQP": {
    nameFa: "نصب تجهیز مکانیکی",
    ref: "ITP مکانیک · دستورالعمل سازنده",
    steps: [
      { code: "setting", nameFa: "استقرار روی فونداسیون", weight: 30 },
      { code: "alignment", nameFa: "الاینمنت", weight: 25, ir: true },
      { code: "grouting", nameFa: "گروت", weight: 15 },
      { code: "internals", nameFa: "نصب اینترنال/متعلقات", weight: 20 },
      { code: "final_check", nameFa: "بازرسی نهایی", weight: 10, ir: true },
    ],
  },
  "ENG-DOC": {
    nameFa: "مدرک مهندسی",
    ref: "رویه کنترل مدارک پروژه",
    steps: [
      { code: "drafting", nameFa: "تهیه پیش‌نویس", weight: 30 },
      { code: "calc", nameFa: "محاسبات", weight: 20 },
      { code: "idc", nameFa: "بازبینی بین‌رشته‌ای", weight: 20, ir: true },
      { code: "issue_review", nameFa: "ارسال برای بازبینی کارفرما", weight: 15, ir: true },
      { code: "issue_afc", nameFa: "صدور AFC", weight: 15, ir: true },
    ],
  },
  "PRC-EQP": {
    nameFa: "تدارک تجهیز",
    ref: "رویه بازرگانی پروژه",
    steps: [
      { code: "po", nameFa: "صدور سفارش", weight: 15 },
      { code: "fabrication", nameFa: "ساخت نزد سازنده", weight: 45 },
      { code: "fat", nameFa: "آزمون کارخانه‌ای", weight: 20, ir: true },
      { code: "delivery", nameFa: "تحویل در سایت", weight: 20, ir: true },
    ],
  },
  "PSU-CHK": {
    nameFa: "پیش‌راه‌اندازی",
    ref: "رویه Pre-commissioning",
    steps: [
      { code: "punch", nameFa: "رفع پانچ", weight: 25 },
      { code: "flushing", nameFa: "فلاشینگ/تمیزکاری", weight: 25 },
      { code: "loop_check", nameFa: "لوپ‌چک", weight: 25, ir: true },
      { code: "handover", nameFa: "تحویل به راه‌اندازی", weight: 25, ir: true },
    ],
  },
};

/** ساختار شکست کار — وزن هر بسته از جمع هزینه فرزندان محاسبه می‌شود. */
export const PEX_WBS: { id: string; nameFa: string; nameEn: string }[] = [
  { id: "1", nameFa: "مهندسی", nameEn: "Engineering" },
  { id: "2", nameFa: "تدارکات", nameEn: "Procurement" },
  { id: "3", nameFa: "اجرا", nameEn: "Construction" },
  { id: "4", nameFa: "پیش‌راه‌اندازی", nameEn: "Pre-commissioning" },
];

export const PEX_WEIGHT_ITEMS: WeightItem[] = PEX_ACTIVITIES.map((a) => ({ id: a.id, cost: a.cost, manHours: a.manHours }));
