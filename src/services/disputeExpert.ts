/**
 * PMO-CONSTRUCTION-DISPUTE-EXPERT-ENGINE-V1.0 — مدل و سرویس پایهٔ
 * «کارشناسی، داوری و تحلیل دعاوی ساخت».
 *
 * سامانهٔ پشتیبان کارشناسی و تصمیم‌گیری است: تشکیل پرونده، گردآوری اسناد,
 * تحلیل ادعا/دفاع، محاسبه و گزارش کارشناسی. صدور رأی داوری/حکم قضایی فقط در
 * صلاحیت مرجع مجاز است و هرگز به سامانه یا هوش مصنوعی واگذار نمی‌شود؛ دستیار
 * این ماژول قاعده‌محور است (DISPUTE_LLM_CONNECTED=false صادقانه).
 *
 * قواعد حاکم:
 *  - مبلغ مورد مطالبه ≠ مبلغ بررسی‌شده ≠ مبلغ تأییدشده؛ هیچ مبلغی بدون منبع
 *    یا محاسبهٔ ثبت‌شده نمایش داده نمی‌شود و هیج محاسبهٔ خسارت تکراری انجام
 *    نمی‌شود (ارجاع به ماژول ضرر و زیان).
 *  - نتیجهٔ هیچ تحلیل بدون تأیید کارشناس قطعی نیست؛ هر نسخهٔ گزارش صادرشده
 *    بدون مجوز بازنویسی نمی‌شود (VersionedReport).
 *  - کلید خارجی فیزیکی به هیچ جدول ماژول دیگر وجود ندارد؛ پیوندها نرم‌اند
 *    (Code/ID). جدول‌ها با پیشوند PmisDispute و فیلد module="d4".
 */
export const DISPUTE_MODULE_ID = "PMO-CONSTRUCTION-DISPUTE-EXPERT-ENGINE-V1.0";
export const DISPUTE_MODULE_VERSION = "1.0.0";
export const DISPUTE_LLM_CONNECTED = false;

/* ─────────────── ۱۳ جدول اختصاصی (پیشوند PmisDispute) ─────────────── */
export const DISPUTE_TABLES = [
  "PmisDisputeCases",
  "PmisDisputeParties",
  "PmisDisputeClaims",
  "PmisDisputeResponses",
  "PmisDisputeEvidence",
  "PmisDisputeAnalyses",
  "PmisDisputeCalculations",
  "PmisDisputeHearings",
  "PmisDisputeOpinions",
  "PmisDisputeReports",
  "PmisDisputeDeadlines",
  "PmisDisputeModuleLinks",
  "PmisDisputeAuditTrail",
] as const;
export type DisputeTable = (typeof DISPUTE_TABLES)[number];
export const DISPUTE_CHILD_TABLES = DISPUTE_TABLES.filter((t) => t !== "PmisDisputeCases");

/* ─────────────── موضوع‌های اختلاف (قابل توسعه) ─────────────── */
export const DISPUTE_SUBJECTS = [
  { code: "workfront_delay", fa: "تأخیر در تحویل جبهه کار" },
  { code: "payment_delay", fa: "تأخیر در پرداخت صورت‌وضعیت‌ها" },
  { code: "eot_dispute", fa: "اختلاف در تمدید مدت پیمان" },
  { code: "contractor_delay", fa: "تأخیرات منتسب به پیمانکار" },
  { code: "quantity_scope_change", fa: "تغییر مقادیر و محدوده کار" },
  { code: "work_order", fa: "دستورکارها و کارهای جدید" },
  { code: "rate_escalation", fa: "اختلاف در نرخ‌ها و تعدیل" },
  { code: "ipc_quantity", fa: "اختلاف در مقادیر صورت‌وضعیت" },
  { code: "delay_damages", fa: "خسارت ناشی از تأخیر" },
  { code: "overhead", fa: "هزینه‌های بالاسری" },
  { code: "suspension", fa: "تعلیق کار" },
  { code: "termination", fa: "خاتمه یا فسخ قرارداد" },
  { code: "quality_ncr", fa: "کیفیت و عدم انطباق" },
  { code: "handover", fa: "تحویل موقت و قطعی" },
  { code: "guarantee_seizure", fa: "ضبط یا آزادسازی ضمانت‌نامه" },
  { code: "insurance", fa: "مسئولیت‌های بیمه‌ای" },
  { code: "clause_interpretation", fa: "تفسیر بندهای قرارداد" },
  { code: "minutes_dispute", fa: "اختلاف در صورت‌جلسات" },
  { code: "final_settlement", fa: "اختلاف در تسویه‌حساب نهایی" },
  { code: "other", fa: "سایر موضوعات" },
] as const;

/* ─────────────── وضعیت پرونده (۱۱ حالت الزامی) و گذر ─────────────── */
export const CASE_STATUSES = [
  "draft", "registered", "awaiting_documents", "under_review",
  "awaiting_party_response", "report_drafting", "pending_review",
  "ready_for_delivery", "delivered", "closed", "archived",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const CASE_STATUS_FA: Record<CaseStatus, string> = {
  draft: "پیش‌نویس", registered: "ثبت‌شده", awaiting_documents: "در انتظار تکمیل مدارک",
  under_review: "در حال بررسی", awaiting_party_response: "در انتظار پاسخ طرفین",
  report_drafting: "در حال تهیه گزارش", pending_review: "در انتظار بازبینی",
  ready_for_delivery: "آماده تحویل", delivered: "تحویل‌شده", closed: "مختومه", archived: "بایگانی‌شده",
};
export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  draft: ["registered"],
  registered: ["awaiting_documents", "under_review"],
  awaiting_documents: ["under_review", "closed"],
  under_review: ["awaiting_party_response", "awaiting_documents", "report_drafting"],
  awaiting_party_response: ["under_review"],
  report_drafting: ["pending_review", "under_review"],
  pending_review: ["ready_for_delivery", "report_drafting"],
  ready_for_delivery: ["delivered", "pending_review"],
  delivered: ["closed"],
  closed: ["archived"],
  archived: [],
};
export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
  return (CASE_TRANSITIONS[from] ?? []).includes(to);
}
/** گذرهایی که نیازمند مجوز تأیید و SoD (تأییدکننده ≠ ثبت‌کنندهٔ اقدام قبلی) هستند. */
export const CASE_APPROVAL_TRANSITIONS: CaseStatus[] = ["ready_for_delivery", "delivered", "closed", "archived"];
export function caseTransitionNeedsApproval(to: CaseStatus): boolean {
  return CASE_APPROVAL_TRANSITIONS.includes(to);
}

/* ─────────────── طرفین و نقش‌ها ─────────────── */
export const PARTY_ROLES = [
  { code: "employer", fa: "کارفرما" }, { code: "contractor", fa: "پیمانکار" },
  { code: "consultant", fa: "مشاور" }, { code: "arbitrator", fa: "داور/مرجع رسیدگی" },
  { code: "insurer", fa: "بیمه‌گر" }, { code: "subcontractor", fa: "پیمانکار جزء" },
  { code: "other", fa: "سایر" },
] as const;

/* ─────────────── نوع سند (EDMS) ─────────────── */
export const EVIDENCE_DOC_TYPES = [
  { code: "contract", fa: "قرارداد و الحاقیه‌ها" }, { code: "gcc_scc", fa: "شرایط عمومی/خصوصی پیمان" },
  { code: "correspondence", fa: "مکاتبات رسمی" }, { code: "minutes", fa: "صورت‌جلسات" },
  { code: "ipc", fa: "صورت‌وضعیت‌ها" }, { code: "periodic_report", fa: "گزارش‌های روزانه/ماهانه" },
  { code: "schedule", fa: "برنامه زمان‌بندی مبنا و به‌روزرسانی‌ها" }, { code: "progress_report", fa: "گزارش‌های پیشرفت" },
  { code: "work_order", fa: "دستورکارها" }, { code: "notification", fa: "ابلاغیه‌ها" },
  { code: "payment", fa: "اسناد پرداخت" }, { code: "invoice", fa: "فاکتورها و اسناد مالی" },
  { code: "technical_report", fa: "گزارش‌های فنی" }, { code: "handover", fa: "اسناد تحویل" },
  { code: "qc", fa: "مدارک کنترل کیفیت" }, { code: "inspection", fa: "گزارش‌های بازرسی" },
  { code: "media", fa: "اسناد تصویری و پیوست‌ها" }, { code: "other", fa: "سایر" },
] as const;

/* اصالت و کفایت مدرک مستقل از وجود فایل است (قاعده: فایل ≠ اصالت حقوقی). */
export const EVIDENCE_AUTHENTICITY = ["pending", "verified", "rejected", "contested"] as const;
export const EVIDENCE_SUFFICIENCY = ["unchecked", "sufficient", "insufficient", "contested"] as const;

/* ─────────────── وضعیت بررسی ادعا ─────────────── */
export const CLAIM_REVIEW_STATUSES = ["open", "under_analysis", "question_sent", "reviewed", "superseded"] as const;
export const CLAIM_BASIS_KINDS = ["time", "money", "both", "declaratory"] as const; // زمانی/مالی/هر دو/صرفاً اعلامی

/* ─────────────── ارجاع قانونی/قراردادی — بدون جعل منبع ─────────────── */
export const REFERENCE_SOURCE_KINDS = [
  { code: "contract_clause", fa: "بند قرارداد" }, { code: "gcc_scc", fa: "شرایط عمومی/خصوصی" },
  { code: "law", fa: "قانون" }, { code: "circular", fa: "بخشنامه/آیین‌نامه" },
  { code: "standard", fa: "استاندارد فنی" }, { code: "judicial", fa: "رأی قضایی" },
  { code: "arbitral", fa: "رأی داوری" }, { code: "expert_opinion", fa: "نظریه کارشناسی مرجع" },
] as const;
export const REFERENCE_VERIFICATION = ["unverified", "verified_text", "verified_official"] as const;

/* ─────────────── گزارش کارشناسی: ۲۰ بخش الزامی (قابل تنظیم سفارش‌یده) ─────────────── */
export const REPORT_SECTIONS = [
  "cover", "referral_scope", "parties", "subject", "expert_questions",
  "documents_reviewed", "claims_and_defenses", "legal_contractual_basis",
  "method_and_assumptions", "technical_analysis", "time_analysis",
  "financial_analysis", "evidence_assessment", "computations",
  "agreements_disagreements", "limitations_gaps", "reasoned_answers",
  "expert_conclusion", "references_annexes", "preparer_reviewer",
] as const;
export type ReportSectionKey = (typeof REPORT_SECTIONS)[number];
export const REPORT_SECTION_FA: Record<ReportSectionKey, string> = {
  cover: "صفحه عنوان و مشخصات پرونده", referral_scope: "مرجع ارجاع و حدود مأموریت",
  parties: "مشخصات طرفین", subject: "شرح موضوع اختلاف", expert_questions: "پرسش‌های کارشناسی",
  documents_reviewed: "فهرست اسناد بررسی‌شده", claims_and_defenses: "شرح ادعاها و دفاعیات",
  legal_contractual_basis: "مبانی قراردادی ו قانونی", method_and_assumptions: "روش بررسی ו مفروضات",
  technical_analysis: "تحلیل فنی", time_analysis: "تحلیل زمانی", financial_analysis: "تحلیل مالی",
  evidence_assessment: "ارزیابی ادله", computations: "محاسبات ו جداول",
  agreements_disagreements: "موارد توافق ו اختلاف", limitations_gaps: "محدودیت‌ها ו اطلاعات ناقص",
  reasoned_answers: "پاسخ مستدل به پرسش‌ها", expert_conclusion: "نتیجه کارشناسی",
  references_annexes: "منابع و پیوست‌ها", preparer_reviewer: "مشخصات تهیه‌کننده و بازبین",
};
export const REPORT_STATUSES = ["draft", "in_review", "approved", "issued", "superseded"] as const;

/* ─────────────── اعتبارسنجی پایه ─────────────── */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export type ValidationResult = { ok: boolean; errors: string[] };

export type CaseInput = {
  TitleFa: string; SubjectCode: string; DescriptionFa?: string | null;
  EmployerFa?: string | null; ContractorFa?: string | null; ConsultantFa?: string | null;
  ReferringAuthorityFa?: string | null; ExpertScopeFa?: string | null;
  ClaimDescriptionFa?: string | null; ClaimedAmount?: number | null; Currency?: string | null;
  ClaimedDelayDays?: number | null; ContractCode?: string | null; ClaimCode?: string | null;
  DelayEventCode?: string | null; DelayCaseId?: string | null; LossCaseId?: string | null;
  ContractRiskId?: string | null; IncidentDate?: string | null; RegistrationDate?: string | null;
  ResponseDeadline?: string | null; DeliveryDeadline?: string | null; Priority?: string | null;
  InternalOwnerFa?: string | null; CourtRefFa?: string | null;
};
export function validateCaseInput(b: Partial<CaseInput>): ValidationResult {
  const errors: string[] = [];
  if (!b.TitleFa || !String(b.TitleFa).trim()) errors.push("عنوان پرونده الزامی است");
  if (b.TitleFa && String(b.TitleFa).length > 400) errors.push("عنوان پرونده نباید از ۴۰۰ نویسه بیشتر باشد");
  if (!b.SubjectCode || !DISPUTE_SUBJECTS.some((s) => s.code === b.SubjectCode)) errors.push("موضوع اختلاف باید از فهرست استاندارد انتخاب شود");
  if (b.CourtRefFa && String(b.CourtRefFa).length > 300) errors.push("مرجع رسیدگی نباید از ۳۰۰ نویسه بیشتر باشد");
  if (b.IncidentDate && !ISO_DAY.test(String(b.IncidentDate))) errors.push("تاریخ وقوع/آغاز اختلاف باید YYYY-MM-DD باشد");
  if (b.DeliveryDeadline && !ISO_DAY.test(String(b.DeliveryDeadline))) errors.push("مهلت تحویل باید YYYY-MM-DD باشد");
  if (b.ResponseDeadline && !ISO_DAY.test(String(b.ResponseDeadline))) errors.push("مهلت پاسخ باید YYYY-MM-DD باشد");
  if (b.Priority && !["low", "normal", "high", "urgent"].includes(String(b.Priority))) errors.push("اولویت نامعتبر است");
  if (b.ClaimedAmount !== undefined && b.ClaimedAmount !== null) {
    const n = Number(b.ClaimedAmount);
    if (!Number.isFinite(n) || n < 0) errors.push("مبلغ مورد مطالبه باید عدد نامنفی باشد");
  }
  if (b.ClaimedDelayDays !== undefined && b.ClaimedDelayDays !== null) {
    const n = Number(b.ClaimedDelayDays);
    if (!Number.isInteger(n) || n < 0) errors.push("مدت مورد مطالبه باید عدد صحیح نامنفی باشد");
  }
  return { ok: errors.length === 0, errors };
}

export function newCaseCode(now: Date = new Date()): string {
  return `DSP-${now.getTime().toString(36).toUpperCase()}`;
}
export function newRecordCode(prefix: string, now: Date = new Date()): string {
  const p = prefix.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "REC";
  return `${p}-${now.getTime().toString(36).toUpperCase()}`;
}

/* ─────────────── مشخصات جدول‌های فرزند (validation سمت API) ─────────────── */
export type ChildFieldSpec = { required: string[] };
export const CHILD_TABLE_SPECS: Record<(typeof DISPUTE_CHILD_TABLES)[number], ChildFieldSpec> = {
  PmisDisputeParties: { required: ["Role", "NameFa"] },
  PmisDisputeClaims: { required: ["TitleFa", "ClaimantPartyCode", "BasisKind"] },
  PmisDisputeResponses: { required: ["ClaimCode", "ResponderPartyCode", "BodyFa"] },
  PmisDisputeEvidence: { required: ["DocType", "TitleFa"] },
  PmisDisputeAnalyses: { required: ["TopicFa", "QuestionFa", "MethodFa"] },
  PmisDisputeCalculations: { required: ["TitleFa", "MethodFa"] },
  PmisDisputeHearings: { required: ["MeetingDate", "TitleFa"] },
  PmisDisputeOpinions: { required: ["TitleFa", "BodyFa"] },
  PmisDisputeReports: { required: ["TitleFa"] },
  PmisDisputeDeadlines: { required: ["TitleFa", "Kind", "DueDate"] },
  PmisDisputeModuleLinks: { required: ["LinkKind", "TargetCode", "TargetTitleFa"] },
  PmisDisputeAuditTrail: { required: ["Action"] },
};
export function validateChildRow(table: keyof typeof CHILD_TABLE_SPECS, body: Record<string, unknown>): ValidationResult {
  const spec = CHILD_TABLE_SPECS[table];
  if (!spec) return { ok: false, errors: ["جدول نامعتبر است"] };
  const errors: string[] = [];
  for (const f of spec.required) {
    const v = body[f];
    if (v === undefined || v === null || String(v).trim() === "") errors.push(`فیلد «${f}» الزامی است`);
  }
  if (table === "PmisDisputeEvidence" && body.DocType && !EVIDENCE_DOC_TYPES.some((d) => d.code === body.DocType)) errors.push("نوع سند باید از فهرست استاندارد باشد");
  if (table === "PmisDisputeParties" && body.Role && !PARTY_ROLES.some((r) => r.code === body.Role)) errors.push("نقش طرف باید از فهرست استاندارد باشد");
  if (table === "PmisDisputeClaims" && body.BasisKind && !(CLAIM_BASIS_KINDS as readonly string[]).includes(String(body.BasisKind))) errors.push("مبنای ادعا نامعتبر است");
  if (table === "PmisDisputeDeadlines" && body.DueDate && !ISO_DAY.test(String(body.DueDate))) errors.push("مهلت باید YYYY-MM-DD باشد");
  return { ok: errors.length === 0, errors };
}

/* ─────────────── مبلغ‌ها: بدون منبع، نمایش نده ─────────────── */
export function validateClaimAmounts(b: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  for (const [field, label] of [["ClaimedAmount", "مبلغ مورد مطالبه"], ["ReviewedAmount", "مبلغ بررسی‌شده"], ["ApprovedAmount", "مبلغ تأییدشده"]] as const) {
    const v = b[field];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) errors.push(`${label} باید عدد نامنفی باشد`);
  }
  if ((b.ReviewedAmount !== undefined && b.ReviewedAmount !== null && b.ReviewedAmount !== "") && !String(b.ReviewBasisFa ?? "").trim()) {
    errors.push("ثبت «مبلغ بررسی‌شده» بدون مبنای بررسی مجاز نیست");
  }
  if ((b.ApprovedAmount !== undefined && b.ApprovedAmount !== null && b.ApprovedAmount !== "") && !String(b.ApprovedBasisFa ?? "").trim()) {
    errors.push("ثبت «مبلغ تأییدشده» بدون مبنای تأیید مجاز نیست");
  }
  if ((b.ApprovedAmount !== undefined && b.ApprovedAmount !== null && b.ApprovedAmount !== "") && (b.ReviewedAmount === undefined || b.ReviewedAmount === null || b.ReviewedAmount === "")) {
    errors.push("تأیید مبلغ بدون ثبت مبلغ بررسی‌شده مجاز نیست (لایه‌بندی مبلغ‌ها رعایت شود)");
  }
  return { ok: errors.length === 0, errors };
}

/* ─────────────── ارجاعات: هیچ منبع حقوقی جعل نمی‌شود ─────────────── */
export function validateLegalReference(b: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  if (!String(b.SourceKind ?? "").trim() || !REFERENCE_SOURCE_KINDS.some((k) => k.code === b.SourceKind)) errors.push("نوع منبع باید از فهرست استاندارد باشد");
  if (!String(b.TitleFa ?? "").trim()) errors.push("عنوان منبع الزامی است");
  const ver = String(b.Verification ?? "unverified");
  if (!(REFERENCE_VERIFICATION as readonly string[]).includes(ver)) errors.push("وضعیت احراز منبع نامعتبر است");
  if (ver !== "unverified" && !String(b.VerifiedBy ?? "").trim()) errors.push("برای منبع احرازشده، نام احرازکننده الزامی است");
  return { ok: errors.length === 0, errors };
}

/* ─────────────── مهلت‌ها ─────────────── */
export type DeadlineLite = { DueDate: string; Status: string };
export function deadlineDaysLeft(d: DeadlineLite, today: string): number | null {
  if (!ISO_DAY.test(d.DueDate) || !ISO_DAY.test(today)) return null;
  if (["met", "cancelled", "expired"].includes(d.Status)) return null;
  return Math.round((Date.parse(d.DueDate) - Date.parse(today)) / 86400000);
}
export function deadlineSeverity(daysLeft: number | null): "overdue" | "critical" | "warning" | "ok" | "none" {
  if (daysLeft === null) return "none";
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 3) return "critical";
  if (daysLeft <= 7) return "warning";
  return "ok";
}

/* ─────────────── داشبورد: محاسبهٔ شاخص‌ها از رکوردهای واقعی ─────────────── */
export type CaseLite = Record<string, unknown> & { Status: string; ClaimedAmount?: number | null; DeliveryDeadline?: string | null; SubjectCode?: string | null; ContractCode?: string | null; IncidentDate?: string | null };
export type ClaimLite = Record<string, unknown> & { ReviewStatus?: string | null; ClaimedAmount?: number | null; ReviewedAmount?: number | null; ApprovedAmount?: number | null; EvidenceSufficiency?: string | null };
export type ReportLite = { Status: string };

export function computeDisputeDashboard(cases: CaseLite[], claims: ClaimLite[], reports: ReportLite[], deadlines: DeadlineLite[], today: string) {
  const byStatus = Object.fromEntries(CASE_STATUSES.map((s) => [s, cases.filter((c) => c.Status === s).length]));
  const openCount = cases.filter((c) => !["closed", "archived"].includes(c.Status)).length;
  const awaitingDocs = (byStatus as Record<string, number>).awaiting_documents ?? 0;
  const awaitingExpertReview = (byStatus as Record<string, number>).under_review ?? 0;
  const nearDeadlines = deadlines.filter((d) => { const n = deadlineDaysLeft(d, today); return n !== null && n >= 0 && n <= 7; }).length
    + cases.filter((c) => {
      if (!c.DeliveryDeadline || ["closed", "archived", "delivered"].includes(c.Status)) return false;
      const n = Math.round((Date.parse(String(c.DeliveryDeadline)) - Date.parse(today)) / 86400000);
      return Number.isFinite(n) && n >= 0 && n <= 7;
    }).length;
  // مبالغ: هر سه لایه جدا؛ مجموع فقط از رکوردهای دارای مقدار
  const sum = (arr: ClaimLite[], f: keyof ClaimLite) => arr.reduce((acc, c) => acc + (Number(c[f]) || 0), 0);
  const insufficientEvidence = claims.filter((c) => c.EvidenceSufficiency === "insufficient").length;
  const bySubject: Record<string, number> = {};
  for (const c of cases) { const k = String(c.SubjectCode ?? "other"); bySubject[k] = (bySubject[k] ?? 0) + 1; }
  const byContract: Record<string, number> = {};
  for (const c of cases) { if (c.ContractCode) { const k = String(c.ContractCode); byContract[k] = (byContract[k] ?? 0) + 1; } }
  const byTrend: Record<string, number> = {};
  for (const c of cases) { const k = String(c.IncidentDate ?? "").slice(0, 7) || "—"; byTrend[k] = (byTrend[k] ?? 0) + 1; }
  return {
    totalCases: cases.length, openCases: openCount, closedCases: (byStatus as Record<string, number>).closed ?? 0,
    byStatus, awaitingExpertReview, awaitingDocuments: awaitingDocs, nearDeadlines,
    totalClaims: claims.length, claimsInsufficientEvidence: insufficientEvidence,
    totalClaimedAmount: sum(claims, "ClaimedAmount"), totalReviewedAmount: sum(claims, "ReviewedAmount"), totalApprovedAmount: sum(claims, "ApprovedAmount"),
    reportsDrafting: reports.filter((r) => r.Status === "draft").length, reportsInReview: reports.filter((r) => r.Status === "in_review").length,
    bySubject, byContract, trend: byTrend,
  };
}

/* ─────────────── متن قابل ارائه در گزارش ─────────────── */
/** لیبل فارسی موضوع؛ برای کدهای نامعلوم «سایر». */
export function disputeSubjectFa(code: string): string {
  return DISPUTE_SUBJECTS.find((s) => s.code === code)?.fa ?? "سایر موضوعات";
}
export function partyRoleFa(code: string): string {
  return PARTY_ROLES.find((r) => r.code === code)?.fa ?? code;
}
export function claimBasisFa(code: string): string {
  return ({ time: "زمانی", money: "مالی", both: "زمانی و مالی", declaratory: "اعلامی" } as Record<string, string>)[code] ?? code;
}
