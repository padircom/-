/**
 * PMO-CONSTRUCTION-DISPUTE-EXPERT-ENGINE-V1.0 — کلاینت رابط کاربری
 * «کارشناسی، داوری و تحلیل دعاوی ساخت». همهٔ مسیرها پروژه‌ای و با x-user-id
 * امضا می‌شوند؛ سرور مجوز dispute.* را دوباره و مستقل بررسی می‌کند.
 */
import { jsonRequest } from "./apiClient";

export type DisputeCase = {
  Id: string; Code: string; TitleFa: string; SubjectCode: string;
  DescriptionFa: string | null; EmployerFa: string | null; ContractorFa: string | null;
  ConsultantFa: string | null; CourtRefFa: string | null; ExpertScopeFa: string | null;
  ClaimDescriptionFa: string | null; ClaimedAmount: number | null; Currency: string | null;
  ClaimedDelayDays: number | null; ContractCode: string | null; ClaimCode: string | null;
  DelayEventCode: string | null; DelayCaseId: string | null; LossCaseId: string | null;
  ContractRiskId: string | null; IncidentDate: string | null; RegistrationDate: string | null;
  ResponseDeadline: string | null; DeliveryDeadline: string | null; Priority: string | null;
  InternalOwnerFa: string | null; Status: string; CreatedBy: string | null;
  StatusChangedBy: string | null; StatusChangedAt: string | null; StatusNoteFa: string | null;
  ExpertNoteFa: string | null; RowVersion: number;
};
export type DisputeCatalog = {
  module: string; version: string; llmConnected: boolean; ruleBasedAssistanceNoteFa: string;
  permissions: string[]; tables: string[]; childTables: string[];
  subjects: { code: string; fa: string }[];
  caseStatuses: { code: string; fa: string; to: string[] }[];
  approvalTransitions: string[];
  partyRoles: { code: string; fa: string }[];
  evidenceDocTypes: { code: string; fa: string }[];
  evidenceRuleFa: string; evidenceAuthenticity: string[]; evidenceSufficiency: string[];
  claimBasisKinds: string[]; claimReviewStatuses: string[];
  referenceSourceKinds: { code: string; fa: string }[]; referenceVerification: string[];
  referenceRuleFa: string; reportSections: { key: string; fa: string }[];
  reportStatuses: string[]; amountsRuleFa: string;
};
export type DisputeDashboard = {
  totalCases: number; openCases: number; closedCases: number;
  byStatus: Record<string, number>;
  awaitingExpertReview: number; awaitingDocuments: number; nearDeadlines: number;
  totalClaims: number; claimsInsufficientEvidence: number;
  totalClaimedAmount: number; totalReviewedAmount: number; totalApprovedAmount: number;
  reportsDrafting: number; reportsInReview: number;
  bySubject: Record<string, number>; byContract: Record<string, number>; trend: Record<string, number>;
};
export type DisputeRow = Record<string, unknown> & { Id: string; Code: string; RowVersion?: number };

const enc = encodeURIComponent;

export const disputeApi = {
  catalog: (projectId: string, userId: string | null) =>
    jsonRequest<DisputeCatalog>(`/api/dispute-expert/${enc(projectId)}/catalog`, userId, "GET"),
  dashboard: (projectId: string, userId: string | null) =>
    jsonRequest<DisputeDashboard>(`/api/dispute-expert/${enc(projectId)}/dashboard`, userId, "GET"),
  listCases: (projectId: string, userId: string | null) =>
    jsonRequest<{ cases: DisputeCase[] }>(`/api/dispute-expert/${enc(projectId)}/cases`, userId, "GET"),
  case: (projectId: string, userId: string | null, id: string) =>
    jsonRequest<{ case: DisputeCase; children: Record<string, DisputeRow[]> }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}`, userId, "GET"),
  createCase: (projectId: string, userId: string | null, body: Record<string, unknown>) =>
    jsonRequest<{ case: DisputeCase }>(`/api/dispute-expert/${enc(projectId)}/cases`, userId, "POST", body),
  patchCase: (projectId: string, userId: string | null, id: string, body: Record<string, unknown>) =>
    jsonRequest<{ case: DisputeCase }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}`, userId, "PATCH", body),
  transition: (projectId: string, userId: string | null, id: string, to: string, noteFa?: string) =>
    jsonRequest<{ case: DisputeCase }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/transition`, userId, "POST", { to, noteFa }),
  deleteCase: (projectId: string, userId: string | null, id: string) =>
    jsonRequest<{ deleted: boolean }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}`, userId, "DELETE"),
  addRow: (projectId: string, userId: string | null, id: string, table: string, body: Record<string, unknown>) =>
    jsonRequest<{ row: DisputeRow }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/rows/${enc(table)}`, userId, "POST", body),
  patchRow: (projectId: string, userId: string | null, id: string, table: string, rowId: string, body: Record<string, unknown>) =>
    jsonRequest<{ row: DisputeRow }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/rows/${enc(table)}/${enc(rowId)}`, userId, "PATCH", body),
  deleteRow: (projectId: string, userId: string | null, id: string, table: string, rowId: string) =>
    jsonRequest<{ deleted: boolean }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/rows/${enc(table)}/${enc(rowId)}`, userId, "DELETE"),
  /* ── فاز ۳ ── */
  runAnalysis: (projectId: string, userId: string | null, id: string) =>
    jsonRequest<{ generated: number; summary: string; analyses: { code: string; claimCode: string; findings: number; critical: number }[]; invalidatedApprovalCount: number; llmConnected: boolean }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/analysis/run`, userId, "POST", {}),
  recalcCalculations: (projectId: string, userId: string | null, id: string) =>
    jsonRequest<{ recalculated: number; totals: { code: string; amount: number | null }[]; note: string }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/calculations/recalc`, userId, "POST", {}),
  linkSuggestions: (projectId: string, userId: string | null, id: string) =>
    jsonRequest<LinkSuggestions>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/link-suggestions`, userId, "GET"),
  resolveLink: (projectId: string, userId: string | null, id: string, rowId: string) =>
    jsonRequest<LinkResolution>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/links/${enc(rowId)}/resolve`, userId, "GET"),
  /* ── فاز ۴: نسخه‌های گزارش + گزارش‌های مدیریتی ── */
  createReport: (projectId: string, userId: string | null, id: string, body: Record<string, unknown>) =>
    jsonRequest<{ row: DisputeRow }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/reports`, userId, "POST", body),
  setReportStatus: (projectId: string, userId: string | null, id: string, rowId: string, to: string) =>
    jsonRequest<{ row: DisputeRow }>(`/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/reports/${enc(rowId)}/status`, userId, "POST", { to }),
  reportDocumentUrl: (projectId: string, id: string, rowId: string, format: "word" | "pdf") =>
    `/api/dispute-expert/${enc(projectId)}/cases/${enc(id)}/reports/${enc(rowId)}/document?format=${format}`,
  managementReport: (projectId: string, userId: string | null, kind: string) =>
    jsonRequest<ManagementReportOut>(`/api/dispute-expert/${enc(projectId)}/management-reports?kind=${enc(kind)}`, userId, "GET"),
};

export type ManagementReportOut = { title: string; heads: string[]; rows: string[][]; noteFa?: string };
export const REPORT_STATUS_CLIENT_FA: Record<string, string> = { draft: "پیش‌نویس", in_review: "در حال بازبینی", approved: "تأییدشده", issued: "صادرشده", superseded: "جایگزین‌شده" };
export const HEARING_MINUTES_CLIENT_FA: Record<string, string> = { draft: "پیش‌نویس", awaiting_sign: "در انتظار امضا", signed: "امضاشده" };
export const OPINION_REVIEW_CLIENT_FA: Record<string, string> = { draft: "پیش‌نویس", in_review: "در حال بازبینی", approved: "تأییدشده", final: "نهایی" };
export const OPINION_SOURCE_KIND_CLIENT_FA: Record<string, string> = { evidence: "مدرک", analysis: "تحلیل", claim: "ادعا", module_link: "پیوند ماژولی", hearing: "جلسه", deadline: "مهلت" };
export const MANAGEMENT_REPORTS_CLIENT: { code: string; fa: string }[] = [
  { code: "cases_status", fa: "وضعیت پرونده‌ها و جریان کاری" },
  { code: "cases_by_subject", fa: "پرونده‌ها به تفکیک موضوع" },
  { code: "claims_layers", fa: "ادعاها و لایه‌های سه‌گانهٔ مبلغ" },
  { code: "evidence_register", fa: "دفتر مدارک و وضعیت اصالت" },
  { code: "evidence_gaps", fa: "شکاف‌های مستنداتی" },
  { code: "deadlines", fa: "مهلت‌ها و هشدارها" },
  { code: "parties", fa: "طرفین و نقش‌ها" },
  { code: "analyses", fa: "تحلیل‌ها و وضعیت تأیید کارشناسی" },
  { code: "hearings", fa: "جلسات و وضعیت صورت‌جلسه" },
  { code: "opinions", fa: "نظریات و زنجیرهٔ نسخه‌ها" },
  { code: "module_links", fa: "پیوندهای ماژولی" },
  { code: "reports_register", fa: "دفتر نسخه‌های گزارش" },
  { code: "trend_cases", fa: "روند ثبت پرونده‌ها" },
  { code: "dashboard_detail", fa: "جزئیات داشبورد" },
];
export const REPORT_SECTION_KEYS_CLIENT: string[] = [
  "cover", "referral_scope", "parties", "subject", "expert_questions",
  "documents_reviewed", "claims_and_defenses", "legal_contractual_basis",
  "method_and_assumptions", "technical_analysis", "time_analysis",
  "financial_analysis", "evidence_assessment", "computations",
  "agreements_disagreements", "limitations_gaps", "reasoned_answers",
  "expert_conclusion", "references_annexes", "preparer_reviewer",
];

export type LinkCandidate = { code: string; titleFa: string; alreadyLinked: boolean; status?: string | null; revision?: string | null; amount?: number | null };
export type LinkSuggestions = {
  delay_case: LinkCandidate[]; loss_case: LinkCandidate[]; contract_risk: LinkCandidate[];
  claim: LinkCandidate[]; edms_document: LinkCandidate[]; noteFa: string;
};
export type LinkResolution = {
  link: DisputeRow; resolvable: boolean; found: boolean;
  target: Record<string, unknown> | null; related: Record<string, unknown>[];
  noteFa: string | null; readOnly: boolean;
};

export const LINK_KIND_CLIENT_FA: Record<string, string> = {
  delay_case: "رویداد تأخیر", loss_case: "آیتم خسارت/لایحه", contract_risk: "ریسک قراردادی",
  claim: "ادعای مرجع", contract: "قرارداد", edms_document: "سند EDMS",
};
export const ANALYSIS_APPROVAL_CLIENT_FA: Record<string, string> = { draft: "پیش‌نویس", under_review: "در حال بازبینی", approved: "تأییدشده", rejected: "مرجوع" };

export const CHILD_TABLE_FA: Record<string, string> = {
  PmisDisputeParties: "طرفین و نمایندگان",
  PmisDisputeClaims: "ادعاها و دفاعیات",
  PmisDisputeResponses: "پاسخ‌های طرف مقابل",
  PmisDisputeEvidence: "مستندات و ادله",
  PmisDisputeAnalyses: "تحلیل‌های کارشناسی",
  PmisDisputeCalculations: "محاسبات مستقل (مقایسه)"
,  PmisDisputeHearings: "جلسات و صورت‌جلسات",
  PmisDisputeOpinions: "نظریات کارشناسی",
  PmisDisputeReports: "نسخه‌های گزارش",
  PmisDisputeDeadlines: "ارجاعات و مهلت‌ها",
  PmisDisputeModuleLinks: "پیوندهای نرم به ماژول‌ها",
  PmisDisputeAuditTrail: "تاریخچهٔ پرونده",
};
export const CASE_STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس", registered: "ثبت‌شده", awaiting_documents: "در انتظار تکمیل مدارک",
  under_review: "در حال بررسی", awaiting_party_response: "در انتظار پاسخ طرفین",
  report_drafting: "در حال تهیه گزارش", pending_review: "در انتظار بازبینی",
  ready_for_delivery: "آماده تحویل", delivered: "تحویل‌شده", closed: "مختومه", archived: "بایگانی‌شده",
};
export const PRIORITY_FA: Record<string, string> = { low: "کم", normal: "عادی", high: "زیاد", urgent: "فوری" };
export const CLAIM_BASIS_FA: Record<string, string> = { time: "زمانی", money: "مالی", both: "زمانی و مالی", declaratory: "اعلامی" };
export const REVIEW_STATUS_FA: Record<string, string> = { open: "باز", under_analysis: "در حال تحلیل", question_sent: "پرسش ارسال‌شده", reviewed: "بررسی‌شده", superseded: "جایگزین‌شده" };
export const EVIDENCE_STATUS_FA: Record<string, string> = { pending: "در انتظار", verified: "احرازشده", rejected: "ردشده", contested: "مورد مناقشه", unchecked: "بررسی‌نشده", sufficient: "کافی", insufficient: "ناکافی", reviewed: "بررسی‌شده", flagged: "پرچم‌دار" };
export const EMPTY = "—";
