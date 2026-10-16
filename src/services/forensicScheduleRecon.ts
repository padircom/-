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

/* ═══════════════════ فاز ۲ — موتورهای کارشناسی (قاعده‌محور) ═══════════════════
 * همهٔ خروجی‌ها «پیش‌نویس محاسباتی»‌اند و بدون تأیید کارشناس قطعی نیستند.
 * هیچ موتوری مبلغ خسارت یا مدت تمدید تولید نمی‌کند؛ خروجی فقط زمان‌بندی
 * بازسازی‌شده، یافتهٔ اعتبارسنجی و امکان‌سنجی روش است. */

export type ReconActivityLite = {
  Code: string;
  ActivityId?: string | null;
  TitleFa?: string | null;
  OriginalDuration?: number | null;
  ActualDuration?: number | null;
  PctComplete?: number | null;
  StatusFlag?: string | null;
  PlannedStart?: string | null;
  PlannedFinish?: string | null;
  ActualStart?: string | null;
  ActualFinish?: string | null;
};
export type ReconLogicLite = {
  Code: string;
  PredecessorCode: string;
  SuccessorCode: string;
  RelType: string;
  Lag?: number | null;
  ReconstructionBasis?: string | null;
  Flag?: string | null;
};

export type ValidationFinding = {
  CheckKind: (typeof CHECK_KINDS)[number];
  Severity: (typeof CHECK_SEVERITIES)[number];
  ActivityCode?: string | null;
  LogicCode?: string | null;
  DetailFa: string;
};

/* آستانه‌های قاعده‌محور اعتبارسنجی — شفاف و قابل‌بازبینی (نه عدد جادویی در کد). */
export const NETWORK_VALIDATION_THRESHOLDS = {
  /** |Lag| بیش از این کسری از مدت پیش‌نیاز «سوء‌استفادهٔ Lag» تلقی می‌شود. */
  lagFractionOfPredDuration: 0.5,
  /** سقف مطلق روز Lag که از آن بزرگ‌تر، هشدار سوء‌استفاده صادر می‌شود. */
  lagAbsoluteLimitDays: 30,
} as const;

const actKey = (a: ReconActivityLite): string => String(a.Code ?? "").trim();
const logicRef = (v: unknown): string => String(v ?? "").trim();
const titleOf = (a: ReconActivityLite): string => a.TitleFa ?? a.ActivityId ?? a.Code;
const durOf = (a: ReconActivityLite): number => {
  const v = a.OriginalDuration ?? a.ActualDuration;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function dedupeFindings(findings: ValidationFinding[]): ValidationFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const k = `${f.CheckKind}|${f.Severity}|${f.ActivityCode ?? ""}|${f.LogicCode ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * NetworkLogicValidator — تشخیص آنومالی شبکهٔ بازسازی‌شده:
 * روابط شکسته (ارجاع به فعالیت ناموجود)، انتهای باز، حلقه (Loop)،
 * سوء‌استفادهٔ Lag و ترتیب اجرای نامتعارف (out-of-sequence).
 */
export function validateNetworkLogic(activities: ReconActivityLite[], logicRows: ReconLogicLite[]): { findings: ValidationFinding[]; stats: { activityCount: number; relationCount: number; openStarts: number; openFinishes: number; broken: number } } {
  const findings: ValidationFinding[] = [];
  const codes = new Map<string, ReconActivityLite>();
  const aliases = new Map<string, ReconActivityLite>();
  for (const a of activities) {
    codes.set(actKey(a), a);
    if (a.ActivityId) aliases.set(String(a.ActivityId).trim(), a);
  }
  const resolve = (ref: string): ReconActivityLite | undefined => codes.get(ref) ?? aliases.get(ref);

  /* ۱) روابط شکسته/معلق */
  let broken = 0;
  const usable: ReconLogicLite[] = [];
  for (const l of logicRows) {
    const p = resolve(logicRef(l.PredecessorCode));
    const s = resolve(logicRef(l.SuccessorCode));
    if (!p || !s) {
      broken += 1;
      findings.push({
        CheckKind: "dangling_logic", Severity: "critical", LogicCode: l.Code,
        DetailFa: `رابطهٔ ${l.RelType} ارجاع نامعتبر دارد (${!p ? "پیش‌نیاز" : "پس‌نیاز"} یافت نشد)؛ بدون اصلاح ارجاع، مسیر بحرانی قابل محاسبه نیست.`,
      });
    } else if (actKey(p) === actKey(s)) {
      broken += 1;
      findings.push({ CheckKind: "dangling_logic", Severity: "major", LogicCode: l.Code, DetailFa: `رابطهٔ خودارجاعی روی «${titleOf(p)}» مجاز نیست.` });
    } else {
      usable.push(l);
    }
    if (l.Flag === "broken") {
      findings.push({ CheckKind: "dangling_logic", Severity: "major", LogicCode: l.Code, DetailFa: `رابطه توسط ثبت‌کننده «شکسته» علامت خورده؛ باید اصلاح یا حذف شود.` });
    }
  }

  /* ۲) انتهای باز */
  const hasPred = new Set<string>();
  const hasSucc = new Set<string>();
  for (const l of usable) {
    hasSucc.add(actKey(resolve(logicRef(l.PredecessorCode))!));
    hasPred.add(actKey(resolve(logicRef(l.SuccessorCode))!));
  }
  const openStarts = activities.filter((a) => !hasPred.has(actKey(a))).length;
  const openFinishes = activities.filter((a) => !hasSucc.has(actKey(a))).length;
  for (const a of activities) {
    const k = actKey(a);
    if (activities.length > 1 && !hasPred.has(k)) {
      findings.push({ CheckKind: "open_end", Severity: "minor", ActivityCode: k, DetailFa: `فعالیت «${titleOf(a)}» پیش‌نیاز ندارد؛ اگر شروع شبکه نیست، انتهای باز است.` });
    }
    if (activities.length > 1 && !hasSucc.has(k)) {
      findings.push({ CheckKind: "open_end", Severity: "minor", ActivityCode: k, DetailFa: `فعالیت «${titleOf(a)}» پس‌نیاز ندارد؛ اگر پایان شبکه نیست، انتهای باز است.` });
    }
  }

  /* ۳) حلقه — DFS سه‌رنگ روی گراف جهت‌دار */
  const adj = new Map<string, string[]>();
  for (const l of usable) {
    const p = actKey(resolve(logicRef(l.PredecessorCode))!);
    const s = actKey(resolve(logicRef(l.SuccessorCode))!);
    adj.set(p, [...(adj.get(p) ?? []), s]);
  }
  const color = new Map<string, 0 | 1 | 2>();
  let loopMember: string | null = null;
  const dfs = (u: string): boolean => {
    color.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? 0;
      if (c === 1) { loopMember = v; return true; }
      if (c === 0 && dfs(v)) return true;
    }
    color.set(u, 2);
    return false;
  };
  let hasLoop = false;
  for (const a of activities) {
    const u = actKey(a);
    if ((color.get(u) ?? 0) === 0 && dfs(u)) { hasLoop = true; break; }
  }
  if (hasLoop) {
    findings.push({ CheckKind: "loop", Severity: "critical", ActivityCode: loopMember, DetailFa: `حلقهٔ منطقی در شبکه تشخیص داده شد (گذر از «${loopMember ?? "?"}»)؛ تا رفع حلقه، محاسبهٔ مسیر بحرانی ممکن نیست.` });
  }

  /* ۴) سوء‌استفادهٔ Lag — آستانهٔ قاعده‌محور اعلام‌شده در NETWORK_VALIDATION_THRESHOLDS */
  for (const l of usable) {
    const lag = Math.abs(Number(l.Lag ?? 0));
    if (!Number.isFinite(lag) || lag === 0) continue;
    const p = resolve(logicRef(l.PredecessorCode))!;
    const limit = Math.max(durOf(p) * NETWORK_VALIDATION_THRESHOLDS.lagFractionOfPredDuration, NETWORK_VALIDATION_THRESHOLDS.lagAbsoluteLimitDays);
    if (lag > limit) {
      findings.push({ CheckKind: "lag_abuse", Severity: "major", LogicCode: l.Code, ActivityCode: actKey(p), DetailFa: `Lag رابطهٔ ${actKey(p)}→${actKey(resolve(logicRef(l.SuccessorCode))!)} برابر ${lag} از آستانهٔ ${limit.toFixed(1)} روز بزرگ‌تر است؛ باید با مدرک توجیه شود.` });
    }
  }

  /* ۵) ترتیب اجرای نامتعارف: FS به‌همراه شروع پس‌نیاز قبل از پایان واقعی پیش‌نیاز */
  for (const l of usable) {
    if (l.RelType !== "FS") continue;
    const p = resolve(logicRef(l.PredecessorCode))!;
    const s = resolve(logicRef(l.SuccessorCode))!;
    if (p.ActualFinish && s.ActualStart && String(s.ActualStart) < String(p.ActualFinish)) {
      findings.push({ CheckKind: "out_of_sequence", Severity: "minor", ActivityCode: actKey(s), LogicCode: l.Code, DetailFa: `شروع واقعی «${titleOf(s)}» پیش از پایان واقعی پیش‌نیاز FS ثبت شده؛ پیشرفت نامتعارف باید مستند شود.` });
    }
  }

  return {
    findings: dedupeFindings(findings),
    stats: { activityCount: activities.length, relationCount: logicRows.length, openStarts, openFinishes, broken },
  };
}

/* ─────────────── CriticalPathReconstructionEngine ─────────────── */
export type CpmActivityResult = { code: string; duration: number; es: number; ef: number; ls: number; lf: number; totalFloat: number; critical: boolean };
export type CpmResult =
  | { ok: true; projectDuration: number; results: CpmActivityResult[]; criticalPath: string[]; drivingOrder: string[] }
  | { ok: false; reason: "loop" | "empty" | "broken_chain"; loopMember?: string };

/**
 * محاسبهٔ CPM روی شبکهٔ بازسازی‌شده با چهار نوع رابطهٔ FS/SS/FF/SF و Lag.
 * پیاده‌سازی روی گراف دو گره‌ای (شروع/پایان هر فعالیت) با پاس رو به‌جلو/عقب.
 * تقویم‌ها در این فاز واحد «روز کاری ناپویا»‌اند؛ دقت تقویمی با تأیید کارشناس است.
 */
export function computeCriticalPath(activities: ReconActivityLite[], logicRows: ReconLogicLite[]): CpmResult {
  const acts = activities.filter((a) => actKey(a));
  if (acts.length === 0) return { ok: false, reason: "empty" };
  const byCode = new Map<string, ReconActivityLite>();
  const aliases = new Map<string, ReconActivityLite>();
  for (const a of acts) { byCode.set(actKey(a), a); if (a.ActivityId) aliases.set(String(a.ActivityId).trim(), a); }
  const resolve = (ref: string): ReconActivityLite | undefined => byCode.get(ref) ?? aliases.get(ref);

  /* گره‌ها: برای هر فعالیت دو گره s:/e: — یال شروع→پایان با وزن مدت. */
  type Edge = { to: string; w: number };
  const edges = new Map<string, Edge[]>();
  const addEdge = (from: string, to: string, w: number) => edges.set(from, [...(edges.get(from) ?? []), { to, w }]);
  for (const a of acts) {
    const k = actKey(a);
    addEdge(`s:${k}`, `e:${k}`, durOf(a));
    if (!edges.has(`e:${k}`)) edges.set(`e:${k}`, []);
    if (!edges.has(`s:${k}`) && !edges.get(`s:${k}`)) edges.set(`s:${k}`, []);
  }
  let relationEdges = 0;
  for (const l of logicRows) {
    const p = resolve(logicRef(l.PredecessorCode));
    const s = resolve(logicRef(l.SuccessorCode));
    if (!p || !s) continue;
    const pk = actKey(p), sk = actKey(s);
    if (pk === sk) continue;
    const lag = Number(l.Lag ?? 0) || 0;
    const rt = l.RelType;
    if (rt === "FS") addEdge(`e:${pk}`, `s:${sk}`, lag);
    else if (rt === "SS") addEdge(`s:${pk}`, `s:${sk}`, lag);
    else if (rt === "FF") addEdge(`e:${pk}`, `e:${sk}`, lag);
    else if (rt === "SF") addEdge(`s:${pk}`, `e:${sk}`, lag);
    else continue;
    relationEdges += 1;
  }
  if (relationEdges === 0 && acts.length > 1) return { ok: false, reason: "broken_chain" };

  /* مرتب‌سازی توپولوژیک (Kahn)؛ چرخه → گزارش loop */
  const nodes = [...edges.keys()];
  const indeg = new Map<string, number>(nodes.map((n) => [n, 0]));
  for (const [, es] of edges) for (const e of es) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const queue = nodes.filter((n) => (indeg.get(n) ?? 0) === 0);
  const topo: string[] = [];
  const inQ = new Map(indeg);
  while (queue.length) {
    const u = queue.shift()!;
    topo.push(u);
    for (const e of edges.get(u) ?? []) {
      const d = (inQ.get(e.to) ?? 0) - 1;
      inQ.set(e.to, d);
      if (d === 0) queue.push(e.to);
    }
  }
  if (topo.length !== nodes.length) {
    const loopMember = nodes.find((n) => (inQ.get(n) ?? 0) > 0)?.slice(2);
    return { ok: false, reason: "loop", loopMember };
  }

  /* پاس رو به‌جلو: طولانی‌ترین مسیر (Longest Path / CPM) */
  const es = new Map<string, number>(nodes.map((n) => [n, 0]));
  for (const u of topo) for (const e of edges.get(u) ?? []) {
    const cand = (es.get(u) ?? 0) + e.w;
    if (cand > (es.get(e.to) ?? 0)) es.set(e.to, cand);
  }
  const projectDuration = Math.max(...[...es.values()], 0);

  /* پاس رو به‌عقب */
  const rev = new Map<string, Edge[]>();
  for (const [u, es_] of edges) for (const e of es_) rev.set(e.to, [...(rev.get(e.to) ?? []), { to: u, w: e.w }]);
  const ls = new Map<string, number>(nodes.map((n) => [n, projectDuration]));
  for (const u of [...topo].reverse()) for (const e of rev.get(u) ?? []) {
    const cand = (ls.get(u) ?? projectDuration) - e.w;
    if (cand < (ls.get(e.to) ?? projectDuration)) ls.set(e.to, cand);
  }

  const EPS = 1e-6;
  const results: CpmActivityResult[] = acts.map((a) => {
    const k = actKey(a);
    const d = durOf(a);
    const s0 = es.get(`s:${k}`) ?? 0, e0 = es.get(`e:${k}`) ?? d;
    const l1 = ls.get(`s:${k}`) ?? projectDuration - d, l2 = ls.get(`e:${k}`) ?? projectDuration;
    const tf = Math.min(l1 - s0, l2 - e0);
    return { code: k, duration: d, es: s0, ef: e0, ls: l1, lf: l2, totalFloat: Math.abs(tf) < EPS ? 0 : Number(tf.toFixed(4)), critical: Math.abs(tf) < EPS };
  });
  const critical = results.filter((r) => r.critical).sort((a, b) => a.es - b.es || a.ef - b.ef).map((r) => r.code);
  const drivingOrder = [...results].sort((a, b) => a.es - b.es || a.ef - b.ef).map((r) => r.code);
  return { ok: true, projectDuration: Number(projectDuration.toFixed(4)), results, criticalPath: critical, drivingOrder };
}

/* ─────────────── AACE29R03ProtocolMapper — امکان‌سنجی قاعده‌محور ─────────────── */
export type MipDataInventory = {
  activities: number;
  activitiesWithActualDates: number;
  logicRows: number;
  snapshots: number;
  extractions: number;
  durations: number;
  calendars: number;
  evaluationsConfirmed: number;
  decisionRepair: boolean;
  decisionReconstruction: boolean;
};
export type MipAssessment = {
  code: MipCode;
  family: MipProtocol["family"];
  feasibility: (typeof MIP_FEASIBILITIES)[number];
  reasonFa: string;
  required: string[];
  provided: string[];
};

const NEEDS = {
  baseline: "برنامهٔ مبنا (فعالیت‌های برنامه‌ای)",
  actuals: "تاریخ‌های واقعی اجرا (As-Built)",
  logic: "منطق شبکهٔ بازسازی‌شده",
  snapshots2: "حداقل دو مقطع زمانی (Cut-Off) دوره‌ای",
  events: "رویدادهای مستند تأخیر/استخراج واقعیت",
  durationEvidence: "مدت‌های مستند (سوابق کارگاهی)",
  calendars: "تقویم‌های کاری بازسازی‌شده",
} as const;

/**
 * برای هر پروتکل MIP بر اساس موجودیت واقعی دادهٔ مأموریت امکان‌سنجی می‌کند.
 * انتخاب نهایی روش (SelectedFlag) فقط با کارشناس است؛ موتور فقط امکان را گزارش می‌دهد.
 */
export function assessMipFeasibility(inv: MipDataInventory): MipAssessment[] {
  const has = {
    baseline: inv.activities > 0,
    actuals: inv.activitiesWithActualDates > 0,
    fullActuals: inv.activities > 0 && inv.activitiesWithActualDates >= inv.activities,
    logic: inv.logicRows > 0,
    snapshots2: inv.snapshots >= 2,
    events: inv.extractions > 0,
    durationEvidence: inv.durations > 0,
    calendars: inv.calendars > 0,
  };
  const grade = (missing: string[]): { feasibility: MipAssessment["feasibility"]; reasonFa: string } => {
    if (missing.length === 0) return { feasibility: "feasible", reasonFa: "پیش‌نیازهای داده‌ای این روش در پرونده موجود است؛ اجرا با تأیید کارشناس." };
    if (missing.length === 1) return { feasibility: "partial", reasonFa: `یک پیش‌نیاز کم است (${missing[0]})؛ با تأمین آن روش کامل می‌شود.` };
    return { feasibility: "not_feasible", reasonFa: `${missing.length} پیش‌نیاز داده‌ای موجود نیست: ${missing.join("، ")}.` };
  };
  const mk = (code: MipCode, required: (keyof typeof NEEDS)[]): MipAssessment => {
    const requiredFa = required.map((k) => NEEDS[k]);
    const missing = required.filter((k) => !has[k as keyof typeof has]);
    const missingFa = missing.map((k) => NEEDS[k]);
    const g = grade(missingFa);
    return { code, family: MIP_PROTOCOLS.find((m) => m.code === code)!.family, ...g, required: requiredFa, provided: requiredFa.filter((_, i) => !missing.includes(required[i])) };
  };
  return [
    mk("3.1", ["baseline", "actuals"]),
    mk("3.2", ["baseline", "actuals", "snapshots2"]),
    mk("3.3", ["baseline", "actuals", "logic"]),
    mk("3.4", ["baseline", "actuals", "logic", "snapshots2"]),
    mk("3.5", ["baseline", "actuals", "logic", "snapshots2", "events"]),
    mk("3.6", ["baseline", "logic", "events"]),
    mk("3.7", ["baseline", "logic", "events", "snapshots2", "durationEvidence"]),
    mk("3.8", ["actuals", "logic"]),
    mk("3.9", ["actuals", "logic", "snapshots2", "calendars"]),
  ];
}

export function mipProtocolByCode(code: MipCode): MipProtocol | undefined {
  return MIP_PROTOCOLS.find((m) => m.code === code);
}
