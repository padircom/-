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
  if (table === "PmisDisputeModuleLinks" && body.LinkKind && !(LINK_KINDS as readonly string[]).includes(String(body.LinkKind))) errors.push("نوع پیوند باید از فهرست استاندارد باشد");
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

/* ═══════════════════════ فاز ۳ — سرویس‌های تحلیل قاعده‌محور ═══════════════════════
 * همهٔ خروجی‌ها پیش‌نویس‌اند و پیش از مؤثرشدن نیازمند تأیید کارشناس انسانی‌اند.
 * هیچ مادهٔ قانونی/رأی/منبعی، بدون وجود رکورد واقعی در پایگاه‌داده، ذکر نمی‌شود؛
 * هر مرجع احرازنشده صریحاً «تأییدنشده» برچسب می‌خورد. سامانه رأی صادر نمی‌کند.
 */

/** انواع مجاز پیوند نرم با ماژول‌های دیگر (مطابق کامنت ستون LinkKind). */
export const LINK_KINDS = ["delay_case", "loss_case", "contract_risk", "claim", "contract", "edms_document"] as const;
export const LINK_KIND_FA: Record<(typeof LINK_KINDS)[number], string> = {
  delay_case: "رویداد تأخیر", loss_case: "آیتم خسارت/لایحه", contract_risk: "ریسک قراردادی",
  claim: "ادعای ماژول ادعاها", contract: "قرارداد", edms_document: "سند EDMS",
};

export const ANALYSIS_APPROVAL_STATUSES = ["draft", "under_review", "approved", "rejected"] as const;
export const ANALYSIS_APPROVAL_FA: Record<string, string> = {
  draft: "پیش‌نویس", under_review: "در حال بازبینی", approved: "تأییدشده", rejected: "مرجوع",
};

export type ClaimLike = Record<string, unknown> & { Code?: string; BasisKind?: string; ReviewStatus?: string };
export type PartyLike = Record<string, unknown> & { Code?: string; Role?: string };
export type EvidenceLike = Record<string, unknown> & { Code?: string; DocType?: string; AuthenticityStatus?: string; SufficiencyStatus?: string };
export type ResponseLike = Record<string, unknown> & { Code?: string; ClaimCode?: string; ResponderPartyCode?: string; Verdict?: string };
export type LinkLike = Record<string, unknown> & { Code?: string; LinkKind?: string; TargetCode?: string };
export type FindingSeverity = "critical" | "warning" | "info";
export interface AnalysisFinding { code: string; severity: FindingSeverity; text: string }

export const SEVERITY_FA: Record<FindingSeverity, string> = {
  critical: "بحرانی", warning: "هشدار", info: "اطلاع",
};

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * DisputeClaimAnalysisService — تحلیل قاعده‌محور یک ادعا در قلمرو پرونده.
 * فقط از داده‌های واقعی رکوردها استفاده می‌کند؛ هیچ استناد قراردادی خارج از
 * آنچه کاربر ثبت کرده اضافه نمی‌شود.
 */
export function analyzeClaim(claim: ClaimLike, evidence: EvidenceLike[], responses: ResponseLike[], links: LinkLike[]): AnalysisFinding[] {
  const out: AnalysisFinding[] = [];
  const push = (code: string, severity: FindingSeverity, text: string) => out.push({ code, severity, text });
  const claimed = num(claim.ClaimedAmount);
  const reviewed = num(claim.ReviewedAmount);
  const approved = num(claim.ApprovedAmount);
  const claimedDays = num(claim.ClaimedDelayDays);

  /* A-amt: لایه‌بندی مبالغ */
  if (claimed === null) push("amt-missing", "warning", "مبلغ مورد مطالبه ثبت نشده است — ارزیابی مالی ادعا فعلاً ممکن نیست.");
  else if (claimed === 0) push("amt-zero", "info", "مبلغ مورد مطالبه صفر ثبت شده است؛ اگر ادعا صرفاً زمانی/اعلامی است نادیده بگیرید.");
  if (reviewed !== null && approved === null) push("amt-review-pending", "info", "لایهٔ بررسی ثبت شده ولی لایهٔ تأیید هنوز انجام نشده است.");
  if (reviewed !== null && claimed !== null && reviewed > claimed) push("amt-review-gt-claim", "warning", "مبلغ بررسی‌شده بیش از مبلغ مورد مطالبه است — انطباق داده بررسی شود.");
  if (approved !== null && reviewed !== null && approved > reviewed) push("amt-approved-gt-review", "critical", "مبلغ تأییدشده بیش از مبلغ بررسی‌شده است — مغایر قاعدهٔ لایه‌بندی مبالغ.");

  /* A-clause: استناد قراردادی — بدون جعل بند */
  const clause = String(claim.ContractClauseRef ?? "").trim();
  if (!clause) push("clause-missing", "critical", "ارجاع به بند/شرط قرارداد ثبت نشده است؛ اقامهٔ ادعا بدون استناد قراردادی نظم‌بخشی ثبت‌شده ضعیف است.");
  else push("clause-registered", "info", `ارجاع قراردادی «${clause}» ثبت شده است — احراز اعتبار متن بند بر عهدهٔ کارشناس است (تأیید خودکار نشده).`);

  /* A-basis: انطباق مبنا با داده */
  const basis = String(claim.BasisKind ?? "");
  if ((basis === "time" || basis === "both") && claimedDays === null) push("basis-time-no-days", "warning", "مبنای ادعا زمانی است ولی مدت مطالبه‌شده (روز) ثبت نشده است.");
  if ((basis === "money" || basis === "both") && claimed === null) push("basis-money-no-amount", "warning", "مبنای ادعا مالی است ولی مبلغ مطالبه‌شده ثبت نشده است.");
  /* پیوندهای پیشنهادی: مبنای زمانی ← رویداد تأخیر | مبنای مالی ← آیتم خسارت */
  const kindCodes = new Set(links.map((l) => String(l.LinkKind ?? "")));
  if ((basis === "time" || basis === "both") && !kindCodes.has("delay_case")) push("link-delay-missing", "warning", "برای ادعای زمانی پیوندی به «رویداد تأخیر» برقرار نشده است.");
  if ((basis === "money" || basis === "both") && !kindCodes.has("loss_case")) push("link-loss-missing", "info", "برای ادعای مالی پیوندی به «آیتم خسارت/لایحه» برقرار نشده است (اختیاری ولی توصیه‌شده).");

  /* A-evidence: اصالت و کفایت */
  const myEvidence = evidence.filter((e) => {
    const refs = e.ClaimRefs;
    if (Array.isArray(refs) && refs.length) return refs.some((x) => String(x) === String(claim.Code ?? ""));
    return true; // مدارک بدون اتصال صریح در سطح پرونده تلقی می‌شوند
  });
  if (myEvidence.length === 0) push("ev-none", "critical", "هیچ مدرکی به این ادعا متصل نیست — ادعا فاقد سند است.");
  else {
    const verified = myEvidence.filter((e) => String(e.AuthenticityStatus ?? "pending") === "verified").length;
    const rejected = myEvidence.filter((e) => String(e.AuthenticityStatus ?? "pending") === "rejected").length;
    const pending = myEvidence.length - verified - rejected;
    const insufficient = myEvidence.filter((e) => String(e.SufficiencyStatus ?? "unchecked") === "insufficient").length;
    push("ev-count", "info", `تعداد مدارک متصل/سطح پرونده: ${myEvidence.length} (اصالت: تأییدشده ${verified}، نامعلوم/در انتظار ${pending}، ردشده ${rejected}).`);
    if (rejected > 0) push("ev-rejected", "critical", `${rejected} مدرک دارای اصالت «ردشده» است — اتکای مستقیم به آن‌ها قابل دفاع نیست.`);
    if (pending === myEvidence.length) push("ev-all-pending", "warning", "اصالت هیچ‌کدام از مدارک هنوز احراز/ثبت نشده است.");
    if (insufficient > 0) push("ev-insufficient", "warning", `${insufficient} مدرک «ناکافی» ارزیابی شده است — شکاف مستنداتی وجود دارد.`);
  }

  /* A-responses: دفاع طرف */
  const myResponses = responses.filter((x) => String(x.ClaimCode ?? "") === String(claim.Code ?? ""));
  if (myResponses.length === 0) push("resp-none", "info", "پاسخی از طرف مقابل برای این ادعا ثبت نشده است.");
  else {
    const accepted = myResponses.filter((x) => ["accepted", "partial"].includes(String(x.Verdict ?? ""))).length;
    const rejected = myResponses.filter((x) => String(x.Verdict ?? "") === "rejected").length;
    if (rejected > 0) push("resp-rejected", "warning", `${rejected} پاسخ ردکننده ثبت شده است — مواضع دفاعی طرف مقابل مستند و در تحلیل لحاظ شود.`);
    if (accepted > 0) push("resp-accepted", "info", `${accepted} پاسخ پذیرش‌گر/جزئی ثبت شده است — محل اتفاقات طرفین مشخص است.`);
  }

  /* A-status */
  const rs = String(claim.ReviewStatus ?? "open");
  if (["approved"].includes(rs)) push("st-approved", "info", "وضعیت ارزیابی ادعا «تأیید» است."); 
  if (["rejected"].includes(rs)) push("st-rejected", "info", "وضعیت ارزیابی ادعا «رد» است.");
  return out;
}

/**
 * DisputeExpertAnalysisEngine — جمع‌بندی تحلیل در سطح پرونده.
 * خروجی متنی برای فیلدهای متنی تحلیل‌ها + آرایهٔ یافته‌ها برای ذخیرهٔ ساختاری.
 */
export function summarizeCaseFindings(
  claims: ClaimLike[], links: LinkLike[], deadlines: { DueDate: string; Status: string }[], today: string,
): { findings: AnalysisFinding[]; totals: { claims: number; claimed: number; reviewed: number; approved: number; delayDaysClaimed: number }; overdueDeadlines: number } {
  const findings: AnalysisFinding[] = [];
  const push = (code: string, severity: FindingSeverity, text: string) => findings.push({ code, severity, text });
  const sum = (f: string) => claims.reduce((a, c) => a + (num((c as Record<string, unknown>)[f]) ?? 0), 0);
  const totals = {
    claims: claims.length,
    claimed: sum("ClaimedAmount"), reviewed: sum("ReviewedAmount"), approved: sum("ApprovedAmount"),
    delayDaysClaimed: sum("ClaimedDelayDays"),
  };
  const overdue = deadlines.filter((d) => deadlineDaysLeft(d, today) !== null && (deadlineDaysLeft(d, today) as number) < 0).length;
  if (claims.length === 0) push("cc-no-claims", "warning", "هیچ ادعایی در پرونده ثبت نشده است — خروجی تحلیل نمی‌تواند دربارهٔ موضوع اختلاف قضاوت مستند داشته باشد.");
  if (totals.approved === 0 && claims.length > 0) push("cc-approve-empty", "info", "مجموع مبالغ تأییدشدهٔ پرونده صفر است؛ این یعنی «تأییدی هنوز انجام نشده» — نه «رد کامل». لایهٔ تأیید جدا نمایش داده می‌شود.");
  if (totals.reviewed > 0 && totals.reviewed !== totals.claimed) push("cc-layers-differ", "info", "مجموع لایه‌های مبلغ متفاوت است (مطالبه/بررسی/تأیید) — طبیعی و نشانهٔ کاربرگ سه‌لایه است؛ مبناهای ثبت‌شده کنترل شوند.");
  if (overdue > 0) push("cc-deadline-overdue", "critical", `${overdue} مهلت از موعد گذشته است — ریسک تعطیلی فرایند داوری/کارشناسی.`);
  const acceptedRisks = links.filter((l) => String(l.LinkKind) === "contract_risk").length;
  if (acceptedRisks === 0) push("cc-no-risk-links", "info", "هیچ پیوندی به ریسک قراردادی ثبت نشده است (اختیاری).");
  const riskScoreNote = "یادآوری قاعده: هیچ امتیاز ریسکی به‌خودی‌خود مبلغ خسارت یا تمدید مدت تولید نمی‌کند و بخشنامهٔ ۱۳۰۰ تنها به‌تنهایی مبنای EOT نیست.";
  push("cc-principles", "info", riskScoreNote);
  return { findings, totals, overdueDeadlines: overdue };
}

/** قالب‌بندی یافته‌ها برای فیلد متنی نتایج تحلیل (قابل نمایش در گزارش). */
export function renderFindingsLines(findings: AnalysisFinding[]): string {
  if (findings.length === 0) return "— هیچ یافته‌ای تولید نشد —";
  return findings.map((f) => `${f.severity === "critical" ? "✖" : f.severity === "warning" ? "⚠" : "ℹ"} [${SEVERITY_FA[f.severity]}] ${f.text}`).join("\n");
}

/** پرسش/روش استاندارد تحلیل خودکار ادعا — روی رکورد قابل بازتولید است. */
export const CLAIM_ANALYSIS_METHOD_FA =
  "تحلیل قاعده‌محور خودکار سامانهٔ کارشناسی دعاوی نسخهٔ ۱٫۰: کنترل لایه‌بندی مبالغ (مطالبه/بررسی/تأیید)، وجود استناد قراردادی، انطباق مبنای ادعا با داده، وضعیت اصالت و کفایت مدارک، پاسخ‌های طرف مقابل و پیوندهای ماژولی مرتبط. هیچ داده‌ای استنباط/جعل نمی‌شود؛ موارد احرازنشده صریحاً «تأییدنشده» اعلام می‌شوند.";
export const CALC_TOTALS_METHOD_FA =
  "محاسبهٔ جمع سادهٔ روی ردیف‌های ثبت‌شدهٔ ادعای همین پرونده (sum). منبع داده: ستون‌های ClaimedAmount/ReviewedAmount/ApprovedAmount/ClaimedDelayDays. مقادیر ماژول‌های دیگر فقط نمایشی خوانده می‌شوند و در این ماژول بازمحاسبه نمی‌گردند. این محاسبهٔ مستقل کارشناسی «برای مقایسه» است و جای محاسبهٔ اصلی مدعی/پاسخگو را نمی‌گیرد.";
