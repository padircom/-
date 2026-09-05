/**
 * Typed HTTP contract between the React client and the future PMIS backend.
 * The frontend never opens a direct SQL Server connection.
 */

export type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  meta?: { traceId: string; timestamp: string; total?: number };
};

export type ApiError = {
  ok: false;
  error: { code: string; message: string; traceId?: string; fields?: Record<string, string> };
};

export type PageRequest = { page?: number; pageSize?: number; search?: string; sort?: string };
export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number };

export type IndustryDto = {
  id: string;
  code: string;
  titleFa: string;
  titleEn?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
};

export type ProjectDto = {
  id: string;
  industryId: string;
  code: string;
  nameFa: string;
  nameEn?: string;
  clientFa?: string;
  consultantFa?: string;
  contractorFa?: string;
  locationFa?: string;
  budget?: number;
  currency?: string;
  status: "active" | "tender" | "stopped" | "completed";
  progress: number;
};

export type ProjectScopeDto = { industryId: string; projectId: string };

export type AuthUserDto = {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  roleCode: string;
  projectCodes: string[];
};

export type RoleDto = {
  code: string;
  titleFa: string;
  titleEn?: string;
  permissions: string[];
};

export type AuditLogDto = {
  id: string;
  userId?: string;
  projectCode?: string;
  actionCode: string;
  entityName?: string;
  entityId?: string;
  createdAt: string;
};

export type TemplateDto = {
  id: string;
  projectId: string;
  moduleCode: string;
  kind: "internal" | "mandated";
  name: string;
  fileName: string;
  mimeType: string;
  version: string;
  isLocked: boolean;
  isActive: boolean;
  fileId?: string;
  downloadUrl?: string;
};

export type FileDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  downloadUrl?: string;
};

export type KnowledgeDocumentDto = {
  id: string;
  projectId: string;
  fileId: string;
  title: string;
  documentType: string;
  languageCode?: string;
  characterCount: number;
  chunkCount: number;
  status: string;
  fileName?: string;
};

export type RagSourceDto = {
  documentId: string;
  documentTitle: string;
  fileName?: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
};

export type RagAnswerDto = {
  answer: string;
  mode: "extractive" | "ai";
  model?: string;
  sources: RagSourceDto[];
};

export type OcrJobDto = {
  id: string;
  projectId: string;
  fileId: string;
  engine: string;
  languageCode?: string;
  status: "queued" | "running" | "completed" | "failed";
  characterCount: number;
  confidence?: number;
  errorMessage?: string;
  knowledgeDocumentId?: string;
  fileName?: string;
};

export type NotificationDto = {
  id: string;
  projectCode?: string;
  channel: "email" | "sms" | "in_app";
  recipient: string;
  subject?: string;
  body: string;
  priority: "low" | "normal" | "high" | "critical";
  status: "pending" | "sent" | "failed" | "cancelled" | "read";
  relatedEntity?: string;
  relatedEntityId?: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  sentAt?: string;
};

export type DailyReportDto = {
  id: string;
  projectId: string;
  reportNo: string;
  reportDate: string;
  templateId?: string;
  header: Record<string, string | boolean>;
  status: "draft" | "submitted" | "reviewed" | "approved" | "rejected";
};

export type ReportWorkflowStatus = "draft" | "submitted" | "consultant_review" | "client_review" | "approved" | "rejected" | "revision_required";

export type ReportWorkflowActionDto = {
  id: string;
  actionCode: string;
  fromStatus: ReportWorkflowStatus;
  toStatus: ReportWorkflowStatus;
  actorRole?: string;
  comment?: string;
  createdAt: string;
};

export type ReportWorkflowDto = {
  id: string;
  dailyReportId: string;
  currentStatus: ReportWorkflowStatus;
  currentAssigneeRole?: string;
  actions: ReportWorkflowActionDto[];
};

export type WbsNodeDto = {
  id: string;
  projectId: string;
  parentId?: string;
  code: string;
  title: string;
  level: number;
  weight?: number;
};

export type ScheduleActivityDto = {
  id: string;
  projectId: string;
  wbsId?: string;
  activityCode: string;
  name: string;
  startDate: string;
  finishDate: string;
  durationDays: number;
  progress: number;
  isCritical: boolean;
};

export type EvmDto = {
  id: string;
  projectId: string;
  period: string;
  pv: number;
  ev: number;
  ac: number;
  spi?: number;
  cpi?: number;
};

export type RiskDto = {
  id: string;
  projectId: string;
  title: string;
  probability: number;
  impact: number;
  owner?: string;
  status: "open" | "mitigated" | "accepted" | "closed";
};

export type ChangeRequestDto = {
  id: string;
  projectId: string;
  title: string;
  reason: string;
  timeImpactDays?: number;
  costImpact?: number;
  status: "draft" | "submitted" | "approved" | "rejected";
};

export type ClaimDto = {
  id: string;
  projectId: string;
  subject: string;
  claimedDays?: number;
  claimedAmount?: number;
  status: "draft" | "under_review" | "submitted" | "settled";
};

export type PortfolioSummaryDto = {
  activeProjects: number;
  tenderProjects: number;
  stoppedProjects: number;
  completedProjects: number;
  spi?: number;
  cpi?: number;
  criticalRisks: number;
};

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  entity: string;
  descriptionFa: string;
};

/** Canonical REST routes used by the backend implementation phase. */
export const PMIS_ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/health", entity: "System", descriptionFa: "سلامت سرویس و اتصال SQL Server" },
  { method: "POST", path: "/auth/login", entity: "System_User", descriptionFa: "ورود و دریافت نشست/JWT" },
  { method: "GET", path: "/auth/me", entity: "System_User", descriptionFa: "اطلاعات کاربر جاری" },
  { method: "GET", path: "/roles", entity: "Role_Master", descriptionFa: "نقش‌ها و مجوزها" },
  { method: "GET", path: "/users", entity: "System_User", descriptionFa: "فهرست کاربران" },
  { method: "GET", path: "/audit", entity: "Audit_Log", descriptionFa: "لاگ ممیزی عملیات" },
  { method: "GET", path: "/notifications", entity: "Notification_Queue", descriptionFa: "صف و تاریخچه اعلان‌ها" },
  { method: "POST", path: "/notifications", entity: "Notification_Queue", descriptionFa: "ایجاد اعلان ایمیل/پیامک/درون‌برنامه" },
  { method: "POST", path: "/notifications/:id/send", entity: "Notification_Delivery_Log", descriptionFa: "ارسال مجدد یا ارسال دستی اعلان" },
  { method: "POST", path: "/notifications/test", entity: "Notification_Queue", descriptionFa: "ارسال تستی ایمیل یا پیامک" },
  { method: "GET", path: "/diagnostics/readiness", entity: "System", descriptionFa: "آزمون آمادگی استقرار و اسکیما" },
  { method: "GET", path: "/integrations/status", entity: "Integration_Log", descriptionFa: "وضعیت کانکتورهای خارجی" },
  { method: "GET", path: "/industries", entity: "Industry_Master", descriptionFa: "فهرست خوشه‌ها و صنایع" },
  { method: "POST", path: "/industries", entity: "Industry_Master", descriptionFa: "ایجاد خوشه صنعتی" },
  { method: "PATCH", path: "/industries/:id", entity: "Industry_Master", descriptionFa: "ویرایش خوشه صنعتی" },
  { method: "DELETE", path: "/industries/:id", entity: "Industry_Master", descriptionFa: "آرشیو خوشه صنعتی" },
  { method: "GET", path: "/projects", entity: "Project_Master", descriptionFa: "فهرست و جستجوی پروژه‌ها" },
  { method: "POST", path: "/projects", entity: "Project_Master", descriptionFa: "ثبت پروژه" },
  { method: "PATCH", path: "/projects/:id", entity: "Project_Master", descriptionFa: "ویرایش پروژه" },
  { method: "GET", path: "/projects/:id/templates", entity: "Report_Template", descriptionFa: "قالب‌های سازمانی و ابلاغی پروژه" },
  { method: "POST", path: "/projects/:id/templates", entity: "Report_Template", descriptionFa: "بارگذاری قالب گزارش" },
  { method: "DELETE", path: "/projects/:id/templates/:templateId", entity: "Report_Template", descriptionFa: "آرشیو قالب گزارش" },
  { method: "POST", path: "/files", entity: "File_Object", descriptionFa: "بارگذاری امن فایل و مدرک" },
  { method: "GET", path: "/files/:id", entity: "File_Object", descriptionFa: "متادیتا و مسیر دانلود فایل" },
  { method: "GET", path: "/files/:id/download", entity: "File_Object", descriptionFa: "دانلود امن فایل" },
  { method: "POST", path: "/projects/:id/knowledge/ingest", entity: "Knowledge_Document", descriptionFa: "استخراج و قطعه‌بندی سند برای RAG" },
  { method: "GET", path: "/projects/:id/knowledge/documents", entity: "Knowledge_Document", descriptionFa: "فهرست اسناد دانش پروژه" },
  { method: "POST", path: "/projects/:id/knowledge/ask", entity: "Document_Chunk", descriptionFa: "پرسش مستند با ذکر منابع" },
  { method: "POST", path: "/projects/:id/ocr/ingest", entity: "OCR_Job", descriptionFa: "OCR تصویر یا PDF اسکن‌شده و ورود به RAG" },
  { method: "GET", path: "/projects/:id/ocr/jobs", entity: "OCR_Job", descriptionFa: "فهرست Jobهای OCR پروژه" },
  { method: "GET", path: "/projects/:id/daily-reports", entity: "Daily_Report", descriptionFa: "فهرست گزارش‌های روزانه" },
  { method: "POST", path: "/projects/:id/daily-reports", entity: "Daily_Report", descriptionFa: "ثبت گزارش روزانه" },
  { method: "GET", path: "/daily-reports/:id/workflow", entity: "Report_Workflow", descriptionFa: "وضعیت و تاریخچه تایید گزارش" },
  { method: "POST", path: "/daily-reports/:id/workflow/actions", entity: "Report_Workflow_Action", descriptionFa: "ارسال، بررسی، تایید یا برگشت گزارش" },
  { method: "POST", path: "/projects/:id/schedule/import", entity: "Schedule_Activity", descriptionFa: "ورود XER / MSP / Excel زمان‌بندی" },
  { method: "GET", path: "/projects/:id/wbs", entity: "Project_WBS", descriptionFa: "درخت WBS و PMS" },
  { method: "GET", path: "/projects/:id/evm", entity: "EVM_Transaction", descriptionFa: "مقادیر PV / EV / AC" },
  { method: "GET", path: "/projects/:id/risks", entity: "Risk_Core", descriptionFa: "رجیستر مرکزی ریسک" },
  { method: "DELETE", path: "/projects/:id/risks/:riskId", entity: "Risk_Core", descriptionFa: "حذف ریسک" },
  { method: "GET", path: "/projects/:id/changes", entity: "Change_Request", descriptionFa: "درخواست‌های تغییر" },
  { method: "GET", path: "/projects/:id/claims", entity: "Claim_Register", descriptionFa: "پرونده‌های ادعا و تاخیر" },
  { method: "GET", path: "/portfolio/summary", entity: "Portfolio_Snapshot", descriptionFa: "خلاصه داشبورد پورتفولیو" },
];

export type PmisApi = {
  industries: {
    list: (request?: PageRequest) => Promise<ApiEnvelope<PageResult<IndustryDto>>>;
    create: (body: Omit<IndustryDto, "id">) => Promise<ApiEnvelope<IndustryDto>>;
  };
  projects: {
    list: (request?: PageRequest & { industryId?: string }) => Promise<ApiEnvelope<PageResult<ProjectDto>>>;
    create: (body: Omit<ProjectDto, "id">) => Promise<ApiEnvelope<ProjectDto>>;
  };
  reports: {
    listDaily: (projectId: string, request?: PageRequest) => Promise<ApiEnvelope<PageResult<DailyReportDto>>>;
    createDaily: (projectId: string, body: Omit<DailyReportDto, "id" | "projectId">) => Promise<ApiEnvelope<DailyReportDto>>;
  };
  schedule: {
    getWbs: (projectId: string) => Promise<ApiEnvelope<WbsNodeDto[]>>;
    getActivities: (projectId: string) => Promise<ApiEnvelope<ScheduleActivityDto[]>>;
  };
  performance: { getEvm: (projectId: string) => Promise<ApiEnvelope<EvmDto[]>> };
  risks: { list: (projectId: string) => Promise<ApiEnvelope<RiskDto[]>>; create: (projectId: string, body: Omit<RiskDto, "id" | "projectId">) => Promise<ApiEnvelope<RiskDto>> };
  portfolio: { summary: () => Promise<ApiEnvelope<PortfolioSummaryDto>> };
};