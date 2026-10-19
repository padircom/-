/**
 * PMO-FORENSIC-SCHEDULE-ENGINE-V1.0 — کلاینت رابط کاربری موتور کارشناسی
 * بازسازی و تحلیل زمان‌بندی ادعا. همهٔ مسیرها پروژه‌ای و با x-user-id امضا
 * می‌شوند؛ سرور مجوز sched.recon.* را دوباره و مستقل بررسی می‌کند.
 */
import { jsonRequest } from "./apiClient";

export type SchedMission = {
  Id: string; Code: string; TitleFa: string; PurposeFa: string | null;
  PeriodFrom: string; PeriodTo: string; AnalysisStandard: string;
  ClaimCode: string | null; DelayEventCode: string | null; ContractCode: string | null;
  CurrentStep: number; Status: string; CreatedBy: string | null; StartedAt: string | null;
  CompletedAt: string | null; ExpertNoteFa: string | null; ApprovedBy: string | null;
  progress?: { currentStep: number; completedSteps: number; pct: number };
};
export type SchedCatalog = {
  module: string; version: string; llmConnected: boolean;
  permissions: string[];
  steps: { n: number; key: string; titleFa: string; tables: string[]; noteFa?: string }[];
  stepCount: number;
  mipProtocols: { code: string; family: string; logicTreatment: string; unitOfAnalysis: string; commonNameEn: string | null; titleFa: string }[];
  missionStatuses: string[]; analysisStandards: string[];
  childTables: string[]; childSpecs: Record<string, { required: string[]; enums: Record<string, string[]>; dates: string[] }>;
  standardsNoteFa: string; referenceFa: string;
};
export type SchedRow = Record<string, unknown> & { Id: string; Code: string };

const enc = encodeURIComponent;

export const schedReconApi = {
  catalog: (projectId: string, userId: string | null) =>
    jsonRequest<SchedCatalog>(`/api/sched-recon/${enc(projectId)}/catalog`, userId, "GET"),
  listMissions: (projectId: string, userId: string | null) =>
    jsonRequest<{ missions: SchedMission[] }>(`/api/sched-recon/${enc(projectId)}/missions`, userId, "GET"),
  mission: (projectId: string, userId: string | null, id: string) =>
    jsonRequest<{ mission: SchedMission; children: Record<string, SchedRow[]>; progress: { currentStep: number; completedSteps: number; pct: number; counts: Record<string, number> } }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}`, userId, "GET"),
  createMission: (projectId: string, userId: string | null, body: Record<string, unknown>) =>
    jsonRequest<{ mission: SchedMission }>(`/api/sched-recon/${enc(projectId)}/missions`, userId, "POST", body),
  patchMission: (projectId: string, userId: string | null, id: string, body: Record<string, unknown>) =>
    jsonRequest<{ mission: SchedMission }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}`, userId, "PATCH", body),
  transition: (projectId: string, userId: string | null, id: string, to: string) =>
    jsonRequest<{ mission: SchedMission }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}/transition`, userId, "POST", { to }),
  setStep: (projectId: string, userId: string | null, id: string, step: number) =>
    jsonRequest<{ mission: SchedMission }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}/step`, userId, "POST", { step }),
  deleteMission: (projectId: string, userId: string | null, id: string) =>
    jsonRequest<{ deleted: boolean }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}`, userId, "DELETE"),
  rows: (projectId: string, userId: string | null, id: string, table: string) =>
    jsonRequest<{ table: string; rows: SchedRow[] }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}/rows/${enc(table)}`, userId, "GET"),
  addRow: (projectId: string, userId: string | null, id: string, table: string, body: Record<string, unknown>) =>
    jsonRequest<{ row: SchedRow }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}/rows/${enc(table)}`, userId, "POST", body),
  deleteRow: (projectId: string, userId: string | null, id: string, table: string, rowId: string) =>
    jsonRequest<{ deleted: boolean }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}/rows/${enc(table)}/${enc(rowId)}`, userId, "DELETE"),
  runValidation: (projectId: string, userId: string | null, id: string) =>
    jsonRequest<{ stats: Record<string, number>; findingsCreated: number; findingsReplaced: number; noteFa: string }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}/run-validation`, userId, "POST", {}),
  runCriticalPath: (projectId: string, userId: string | null, id: string, snapshotCode?: string) =>
    jsonRequest<{ computed: { projectDuration: number; criticalPath: string[]; results: { code: string; duration: number; es: number; ef: number; totalFloat: number; critical: boolean }[]; drivingOrder: string[] }; snapshotCode: string }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}/run-critical-path`, userId, "POST", snapshotCode ? { snapshotCode } : {}),
  runMipAssessment: (projectId: string, userId: string | null, id: string) =>
    jsonRequest<{ assessments: { code: string; family: string; feasibility: string; reasonFa: string }[]; upserted: number }>(`/api/sched-recon/${enc(projectId)}/missions/${enc(id)}/run-mip-assessment`, userId, "POST", {}),
};

export const CHILD_TABLE_FA: Record<string, string> = {
  PmisSchedReconExtractions: "مستندات استخراج‌شده (مرحلهٔ ۲)",
  PmisSchedReconEvaluations: "ارزیابی فایل و تصمیم Repair/Reconstruction (مرحلهٔ ۳)",
  PmisSchedReconWbsMaps: "نقشهٔ WBS (مرحلهٔ ۴)",
  PmisSchedReconActivities: "دیکشنری فعالیت‌ها (مرحلهٔ ۵)",
  PmisSchedReconCalendars: "تقویم‌ها (مرحلهٔ ۶)",
  PmisSchedReconDurations: "مدت‌های واقعی/برنامه‌ای (مرحلهٔ ۶)",
  PmisSchedReconLogic: "منطق شبکه FS/SS/FF/SF (مرحلهٔ ۷)",
  PmisSchedReconSnapshots: "مقاطع زمانی (مرحلهٔ ۷)",
  PmisSchedReconCriticalPaths: "مسیرهای بحرانی (مرحلهٔ ۷)",
  PmisSchedReconValidations: "یافته‌های اعتبارسنجی (مرحلهٔ ۸)",
  PmisSchedReconMipMappings: "نگاشت پروتکل MIP (مرحلهٔ ۸)",
};

export const MISSION_STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس", in_progress: "در حال انجام", on_hold: "متوقف", completed: "تکمیل‌شده", cancelled: "لغوشده",
};
export const SEVERITY_FA: Record<string, string> = { info: "اطلاع", minor: "جزئی", major: "عمده", critical: "بحرانی" };
export const CHECK_KIND_FA: Record<string, string> = {
  negative_float: "شناوری منفی", open_end: "انتهای باز", loop: "حلقهٔ منطقی", lag_abuse: "سوء‌استفادهٔ Lag",
  out_of_sequence: "ترتیب نامتعارف اجرا", dangling_logic: "منطق معلق/شکسته", constraint_abuse: "سوء‌استفادهٔ قید", missing_calendar: "فقدان تقویم",
};
export const FEASIBILITY_FA: Record<string, string> = { feasible: "امکان‌پذیر", partial: "نیمه‌امکان‌پذیر", not_feasible: "غیرممکن با دادهٔ فعلی" };
export const EMPTY = "—";
