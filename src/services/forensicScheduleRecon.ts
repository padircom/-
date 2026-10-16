/**
 * PMO-FORENSIC-SCHEDULE-ENGINE-V1.0 — مدل و سرویس پایهٔ «موتور کارشناسی
 * بازسازی و تحلیل زمان‌بندی ادعا» (Forensic Schedule Reconstruction).
 *
 * اجرای دستورالعمل کارشناسی ۸ مرحله‌ای بازسازی/اصلاح برنامه‌های زمان‌بندی
 * مطابق AACE 29R-03 (MIP 3.1..3.9) و SCL Delay Protocol (ویرایش دوم).
 * این موتور زیربنای داده‌ای موتور تحلیل تأخیرات (بخشنامه‌های ۱۳۰۰/۵۰۹۰)
 * و سند ۵۱ جدولی ادعاست، ولی هیچ‌گونه کلید خارجی فیزیکی به جداول دیگر
 * ندارد؛ پیوندها فقط نرم‌اند (MissionCode/ActivityCode/ClaimCode/
 * DelayEventCode/DocumentId). Zero-Regression ماژول‌های دیگر حفظ می‌شود.
 *
 * قواعد حاکم:
 *  - بدون تأیید کارشناس هیچ نتیجه‌ای قطعی نیست؛ همهٔ خروجی‌های موتور تا
 *    تأیید انسانی «پیش‌نویس محاسباتی» هستند.
 *  - دستیار قاعده‌محور است (SCHED_RECON_LLM_CONNECTED=false صادقانه نگه
 *    داشته می‌شود) و هیچ مبلغ، مدت تمدید یا استحقاقی تولید نمی‌کند —
 *    خروجی این ماژول «زمان‌بندی بازسازی‌شده و آنومالی» است، نه رأی مالی.
 *  - دادهٔ ناقص با «—» نمایش داده می‌شود؛ دادهٔ نمونه/نمایشی وجود ندارد.
 */
export const FORENSIC_SCHED_MODULE_ID = "PMO-FORENSIC-SCHEDULE-ENGINE-V1.0";
export const FORENSIC_SCHED_VERSION = "1.0.0";

/** دستیار این ماژول قاعده‌محور است؛ اتصال مدل زبانی صادقانه غلط اعلام می‌شود. */
export const SCHED_RECON_LLM_CONNECTED = false;

/* ─────────────── جدول‌های اختصاصی (پیشوند PmisSchedRecon) ─────────────── */
export const SCHED_RECON_TABLES = [
  "PmisSchedReconMissions",
  "PmisSchedReconExtractions",
  "PmisSchedReconEvaluations",
  "PmisSchedReconWbsMaps",
  "PmisSchedReconActivities",
  "PmisSchedReconCalendars",
  "PmisSchedReconDurations",
  "PmisSchedReconLogic",
  "PmisSchedReconCriticalPaths",
  "PmisSchedReconSnapshots",
  "PmisSchedReconValidations",
  "PmisSchedReconMipMappings",
] as const;
export type SchedReconTable = (typeof SCHED_RECON_TABLES)[number];

/** جدول‌های فرزندِ یک مأموریت (همه به‌جز خودِ مأموریت)؛ کلید نرم MissionCode. */
export const SCHED_RECON_CHILD_TABLES = SCHED_RECON_TABLES.filter((t) => t !== "PmisSchedReconMissions");

/* ─────────────── وضعیت‌ها و شمارش‌ها (Enum) ─────────────── */
export const MISSION_STATUSES = ["draft", "in_progress", "on_hold", "completed", "cancelled"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

/** گذر مجاز وضعیت مأموریت؛ completed فقط با مجوز تأیید و SoD (≠ سازنده). */
export const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  draft: ["in_progress", "cancelled"],
  in_progress: ["on_hold", "completed", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export const ANALYSIS_STANDARDS = ["AACE_29R03", "SCL_V2", "BOTH"] as const;
export type AnalysisStandard = (typeof ANALYSIS_STANDARDS)[number];

export const EXTRACTION_DOC_TYPES = ["daily_report", "meeting_minute", "transmittal", "letter", "weather_report", "progress_photo", "ipc", "other"] as const;
export const EXTRACTION_STATUSES = ["collected", "verified", "rejected"] as const;

export const EVAL_FILE_KINDS = ["xer", "xml", "mpp", "pdf", "other"] as const;
export const EVAL_DAMAGE_CLASSES = ["intact", "repairable", "reconstruction_required"] as const;
/** تصمیم مرحلهٔ ۳: تعمیر فایل موجود یا بازسازی از مستندات. پیش‌فرض pending. */
export const EVAL_DECISIONS = ["pending", "repair", "reconstruction"] as const;
export const EVAL_STATUSES = ["pending_review", "confirmed", "superseded"] as const;

export const WBS_MAP_KINDS = ["one_to_one", "merged", "split", "renumbered", "new", "dropped"] as const;
export const RECORD_STATUSES = ["draft", "confirmed"] as const;

export const ACTIVITY_TYPES = ["task", "milestone", "hammock", "loe"] as const;
export const ACTIVITY_FLAGS = ["not_started", "in_progress", "completed", "suspended"] as const;

export const CALENDAR_KINDS = ["standard", "modified", "weather_suspension"] as const;

export const DURATION_METHODS = ["records", "interview", "interpolation"] as const;
export const DURATION_STATUSES = ["estimated", "evidenced", "confirmed"] as const;

export const REL_TYPES = ["FS", "SS", "FF", "SF"] as const;
export const REL_BASES = ["file_record", "inferred_physical", "inferred_documented", "assumed"] as const;
export const REL_FLAGS = ["normal", "suspect", "broken"] as const;

export const CP_CHANGE_KINDS = ["new", "extended", "shortened", "shifted", "unchanged"] as const;

export const SNAPSHOT_KINDS = ["periodic_update", "claim_event", "milestone", "other"] as const;
export const SNAPSHOT_STATUSES = ["open", "frozen"] as const;

export const CHECK_KINDS = ["negative_float", "open_end", "loop", "lag_abuse", "out_of_sequence", "dangling_logic", "constraint_abuse", "missing_calendar"] as const;
export const CHECK_SEVERITIES = ["info", "minor", "major", "critical"] as const;
export const CHECK_RESOLUTIONS = ["open", "accepted_risk", "fixed", "not_applicable"] as const;

export const MIP_CODES = ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9"] as const;
export type MipCode = (typeof MIP_CODES)[number];
export const MIP_FEASIBILITIES = ["feasible", "partial", "not_feasible"] as const;

/* ─────────────── دستورالعمل کارشناسی ۸ مرحله‌ای بازسازی ─────────────── */
export type ReconStep = {
  n: number;
  key: string;
  titleFa: string;
  /** جدول‌هایی که خروجی مستند این مرحله را نگه می‌دارند. */
  tables: SchedReconTable[];
  noteFa?: string;
};
export const RECON_STEPS: ReconStep[] = [
  { n: 1, key: "mission", titleFa: "تعریف مأموریت، هدف کارشناسی و بازه ادعا", tables: ["PmisSchedReconMissions"] },
  { n: 2, key: "extraction", titleFa: "استخراج مستندات واقعیت (گزارش روزانه، صورت‌جلسه، ترانسمیتال)", tables: ["PmisSchedReconExtractions"] },
  { n: 3, key: "evaluation", titleFa: "ارزیابی آسیب‌دیدگی فایل زمان‌بندی و تصمیم Repair/Reconstruction", tables: ["PmisSchedReconEvaluations"] },
  { n: 4, key: "wbs", titleFa: "همسان‌سازی و نقشه تطبیق WBS مصوب با واقعیت", tables: ["PmisSchedReconWbsMaps"] },
  { n: 5, key: "activities", titleFa: "دیکشنری فعالیت‌های بازسازی‌شده و کدگذاری استاندارد", tables: ["PmisSchedReconActivities"] },
  { n: 6, key: "calendars_durations", titleFa: "بازسازی تقویم‌های کاری و مدت‌های واقعی در برابر برنامه‌ای", tables: ["PmisSchedReconCalendars", "PmisSchedReconDurations"] },
  { n: 7, key: "logic_cp", titleFa: "بازسازی منطق شبکه (FS/SS/FF/SF و Lag/Lead) و ردیابی مسیر بحرانی", tables: ["PmisSchedReconLogic", "PmisSchedReconCriticalPaths", "PmisSchedReconSnapshots"] },
  { n: 8, key: "validation_mip", titleFa: "اعتبارسنجی مدل و تطبیق با پروتکل‌های MIP 3.1 تا 3.9", tables: ["PmisSchedReconValidations", "PmisSchedReconMipMappings"] },
];
export const RECON_STEP_COUNT = RECON_STEPS.length;

/* ─────────────── رده‌بندی پروتکل‌های AACE 29R-03 (MIP 3.1..3.9) ───────────────
 * نام‌های رایج فقط برای خوانایی کارشناس آورده شده‌اند؛ انتخاب نهایی روش با
 * کارشناس است (SelectedFlag) و موتور هیچ تخصیص خودکاری به روش نمی‌کند. */
export type MipProtocol = {
  code: MipCode;
  family: "observational" | "modeled";
  logicTreatment: "static" | "dynamic" | "additive" | "subtractive";
  unitOfAnalysis: "gross" | "periodic";
  commonNameEn: string | null;
  titleFa: string;
};
export const MIP_PROTOCOLS: MipProtocol[] = [
  { code: "3.1", family: "observational", logicTreatment: "static", unitOfAnalysis: "gross", commonNameEn: "As-Planned vs As-Built", titleFa: "مشاهده‌ای / قطعیِ کلی — مقایسهٔ برنامه‌ای در برابر اجراشده" },
  { code: "3.2", family: "observational", logicTreatment: "static", unitOfAnalysis: "periodic", commonNameEn: "Contemporaneous Period Analysis", titleFa: "مشاهده‌ای / قطعیِ دوره‌ای — تحلیل دوره‌ای معاصر" },
  { code: "3.3", family: "observational", logicTreatment: "dynamic", unitOfAnalysis: "gross", commonNameEn: null, titleFa: "مشاهده‌ای / پویای کلی — تحلیل معاصر با منطق به‌روز" },
  { code: "3.4", family: "observational", logicTreatment: "dynamic", unitOfAnalysis: "periodic", commonNameEn: "Time Slice Windows Analysis", titleFa: "مشاهده‌ای / پویای دوره‌ای — پنجره‌های زمانی" },
  { code: "3.5", family: "observational", logicTreatment: "dynamic", unitOfAnalysis: "periodic", commonNameEn: null, titleFa: "مشاهده‌ای / پویای دوره‌ای تفکیک‌شده — وقفه و اندرکنش" },
  { code: "3.6", family: "modeled", logicTreatment: "additive", unitOfAnalysis: "gross", commonNameEn: "Impacted As-Planned", titleFa: "مدل‌سازی / افزایشیِ تک‌مبنا — تأثیرگذاری برنامه مبنا" },
  { code: "3.7", family: "modeled", logicTreatment: "additive", unitOfAnalysis: "periodic", commonNameEn: "Time Impact Analysis", titleFa: "مدل‌سازی / افزایشیِ چندمبنا — تحلیل اثر زمانی (TIA)" },
  { code: "3.8", family: "modeled", logicTreatment: "subtractive", unitOfAnalysis: "gross", commonNameEn: "Collapsed As-Built", titleFa: "مدل‌سازی / کاهشیِ تک‌مبنا — فروافتادهٔ اجراشده (But-For)" },
  { code: "3.9", family: "modeled", logicTreatment: "subtractive", unitOfAnalysis: "periodic", commonNameEn: null, titleFa: "مدل‌سازی / کاهشیِ چندمبنا/دوره‌ای — فروافتادهٔ دوره‌ای" },
];

/* بازهٔ جداول سند ۵۱ جدولی ادعا که از خروجی این موتور تغذیه می‌شوند (فاز ۳). */
export const CLAIM_DOC_SCHEDULE_TABLE_RANGE = { from: 11, to: 25 } as const;

/* ─────────────── تایپ‌های رکورد (نمای سبک برای سرویس/API) ─────────────── */
export type MissionInput = {
  TitleFa: string;
  PurposeFa?: string | null;
  PeriodFrom: string;
  PeriodTo: string;
  AnalysisStandard?: AnalysisStandard;
  ClaimCode?: string | null;
  DelayEventCode?: string | null;
  ContractCode?: string | null;
  ScheduleFileRefs?: string | null; // JSON: شناسهٔ مدارک فایل XER/XML (پیوند نرم EDMS)
  ExpertNoteFa?: string | null;
};

export type ValidationResult = { ok: boolean; errors: string[] };

/* ─────────────── اعتبارسنجی‌های پایه (قاعده‌محور، بدون استثنا) ─────────────── */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validateMissionInput(b: Partial<MissionInput>): ValidationResult {
  const errors: string[] = [];
  if (!b.TitleFa || !String(b.TitleFa).trim()) errors.push("عنوان مأموریت الزامی است");
  if (b.TitleFa && String(b.TitleFa).length > 400) errors.push("عنوان مأموریت نباید از ۴۰۰ نویسه بیشتر باشد");
  if (!b.PeriodFrom || !ISO_DAY.test(String(b.PeriodFrom))) errors.push("شروع بازه ادعا باید به قالب YYYY-MM-DD باشد");
  if (!b.PeriodTo || !ISO_DAY.test(String(b.PeriodTo))) errors.push("پایان بازه ادعا باید به قالب YYYY-MM-DD باشد");
  if (b.PeriodFrom && b.PeriodTo && ISO_DAY.test(String(b.PeriodFrom)) && ISO_DAY.test(String(b.PeriodTo)) && String(b.PeriodFrom) > String(b.PeriodTo)) {
    errors.push("شروع بازه ادعا نمی‌تواند بعد از پایان آن باشد");
  }
  if (b.AnalysisStandard !== undefined && !ANALYSIS_STANDARDS.includes(b.AnalysisStandard)) errors.push("استاندارد تحلیل باید AACE_29R03 یا SCL_V2 یا BOTH باشد");
  if (b.PurposeFa && String(b.PurposeFa).length > 2000) errors.push("شرح هدف کارشناسی نباید از ۲۰۰۰ نویسه بیشتر باشد");
  return { ok: errors.length === 0, errors };
}

export function validateStep(step: number): boolean {
  return Number.isInteger(step) && step >= 1 && step <= RECON_STEP_COUNT;
}

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return (MISSION_TRANSITIONS[from] ?? []).includes(to);
}

/** گذری که به «تکمیل‌شده» می‌رسد دروازهٔ تأیید + SoD دارد (≠ سازندهٔ مأموریت). */
export function transitionNeedsApproval(to: MissionStatus): boolean {
  return to === "completed";
}

/** کد خودکار مأموریت: FSR- + مهر زمانی مبنای ۳۶ (یکتا، بدون وابستگی به شمارنده). */
export function newMissionCode(now: Date = new Date()): string {
  return `FSR-${now.getTime().toString(36).toUpperCase()}`;
}

/** کد خودکار رکورد فرزند: پیشوند جدول + مهر زمانی؛ خوانا برای ممیزی. */
export function newRecordCode(prefix: string, now: Date = new Date()): string {
  const p = prefix.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "REC";
  return `${p}-${now.getTime().toString(36).toUpperCase()}`;
}

/* ─────────────── پیشرفت مأموریت (گزارش‌دهی صادقانه) ─────────────── */
export type MissionProgress = {
  currentStep: number;
  completedSteps: number;
  pct: number;
  counts: Partial<Record<SchedReconTable, number>>;
};

/**
 * محاسبهٔ پیشرفت بر پایهٔ شمارش واقعی رکوردها؛ «کامل‌شدن» مرحله یعنی حداقل
 * یک رکورد در همهٔ جدول‌های آن مرحله وجود دارد (تأیید کارشناسی جداست و در
 * خودِ رکوردها نگه داشته می‌شود، نه اینجا).
 */
export function computeMissionProgress(currentStep: number, counts: Partial<Record<SchedReconTable, number>>): MissionProgress {
  const step = validateStep(currentStep) ? currentStep : 1;
  let completed = 0;
  for (const s of RECON_STEPS) {
    if (s.n === 1) { completed += 1; continue; } // تعریف مأموریت با ایجاد رکورد انجام شده
    const done = s.tables.every((t) => (counts[t] ?? 0) > 0);
    if (done && s.n < step) completed += 1;
  }
  const pct = Math.round((Math.max(step - 1, completed) / RECON_STEP_COUNT) * 100);
  return { currentStep: step, completedSteps: Math.max(step - 1, completed), pct, counts };
}

/* ─────────────── مشخصات فیلدهای جدول‌های فرزند (برای اعتبارسنجی API) ─────────────── */
export type ChildFieldSpec = {
  required: string[];
  enums: Record<string, readonly string[]>;
  dates: string[];
};
export const CHILD_TABLE_SPECS: Record<Exclude<SchedReconTable, "PmisSchedReconMissions">, ChildFieldSpec> = {
  PmisSchedReconExtractions: {
    required: ["DocType", "EventDate"],
    enums: { DocType: EXTRACTION_DOC_TYPES, Status: EXTRACTION_STATUSES },
    dates: ["EventDate", "PeriodFrom", "PeriodTo"],
  },
  PmisSchedReconEvaluations: {
    required: ["FileKind"],
    enums: { FileKind: EVAL_FILE_KINDS, DamageClass: EVAL_DAMAGE_CLASSES, Decision: EVAL_DECISIONS, Status: EVAL_STATUSES },
    dates: ["BaselineDate", "DataDate"],
  },
  PmisSchedReconWbsMaps: {
    required: ["BaselineWbsCode", "MapKind"],
    enums: { MapKind: WBS_MAP_KINDS, Status: RECORD_STATUSES },
    dates: [],
  },
  PmisSchedReconActivities: {
    required: ["ActivityId", "TitleFa"],
    enums: { ActivityType: ACTIVITY_TYPES, StatusFlag: ACTIVITY_FLAGS },
    dates: ["PlannedStart", "PlannedFinish", "ActualStart", "ActualFinish"],
  },
  PmisSchedReconCalendars: {
    required: ["NameFa", "BaseKind"],
    enums: { BaseKind: CALENDAR_KINDS, Status: RECORD_STATUSES },
    dates: ["ValidFrom", "ValidTo"],
  },
  PmisSchedReconDurations: {
    required: ["ActivityCode", "Method"],
    enums: { Method: DURATION_METHODS, Status: DURATION_STATUSES },
    dates: [],
  },
  PmisSchedReconLogic: {
    required: ["PredecessorCode", "SuccessorCode", "RelType", "ReconstructionBasis"],
    enums: { RelType: REL_TYPES, ReconstructionBasis: REL_BASES, Flag: REL_FLAGS },
    dates: [],
  },
  PmisSchedReconCriticalPaths: {
    required: ["SnapshotCode"],
    enums: { ChangeKind: CP_CHANGE_KINDS },
    dates: [],
  },
  PmisSchedReconSnapshots: {
    required: ["LabelFa", "CutoffDate"],
    enums: { DataKind: SNAPSHOT_KINDS, Status: SNAPSHOT_STATUSES },
    dates: ["CutoffDate"],
  },
  PmisSchedReconValidations: {
    required: ["CheckKind", "Severity"],
    enums: { CheckKind: CHECK_KINDS, Severity: CHECK_SEVERITIES, Resolution: CHECK_RESOLUTIONS },
    dates: [],
  },
  PmisSchedReconMipMappings: {
    required: ["MipCode"],
    enums: { MipCode: MIP_CODES, Feasibility: MIP_FEASIBILITIES },
    dates: [],
  },
};

/** اعتبارسنجی قاعده‌محور رکورد فرزند؛ تاریخ‌ها فقط قالب ISO روز پذیرفته می‌شوند. */
export function validateChildRow(table: keyof typeof CHILD_TABLE_SPECS, body: Record<string, unknown>): ValidationResult {
  const spec = CHILD_TABLE_SPECS[table];
  const errors: string[] = [];
  for (const f of spec.required) {
    const v = body[f];
    if (v === undefined || v === null || String(v).trim() === "") errors.push(`فیلد ${f} الزامی است`);
  }
  for (const [f, allowed] of Object.entries(spec.enums)) {
    const v = body[f];
    if (v !== undefined && v !== null && String(v).trim() !== "" && !allowed.includes(String(v))) errors.push(`مقدار ${f} باید یکی از ${allowed.join("|")} باشد`);
  }
  for (const f of spec.dates) {
    const v = body[f];
    if (v !== undefined && v !== null && String(v).trim() !== "" && !ISO_DAY.test(String(v))) errors.push(`فیلد ${f} باید تاریخ ISO (YYYY-MM-DD) باشد`);
  }
  return { ok: errors.length === 0, errors };
}
