/**
 * PMO-INTEGRATED-CHANGE-MANAGEMENT-V1.0 — مدل و سرویس پایهٔ «مدیریت
 * یکپارچهٔ تغییرات پروژه و قراردادها».
 *
 * چرخهٔ کامل تغییر: ثبت درخواست → بررسی کامل‌بودن → ارزیابی اولیه → بررسی
 * فنی → تحلیل اثر زمانی → تحلیل اثر مالی → بررسی قراردادی → ارزیابی ریسک →
 * غربال اختلافات → تجمیع → تأیید/رد مرجع مجاز → ابلاغ → اجرا → به‌روزرسانی
 * مبنا → کنترل اجرا → بستن/بایگانی.
 *
 * قواعد حاکم (از دستور اجرایی):
 *  - هیچ تغییر تأییدنشده‌ای هرگز خودکار در مبنا اعمال نمی‌شود؛ تأیید فقط با
 *    مجوز و SoD (تأییدکننده ≠ کسی که درخواست را برای تصمیم آماده کرد).
 *  - مبالغ برآوردی، پیشنهادی، مذاکره، مصوب و پرداخت‌شده جدا نگه‌داشته
 *    می‌شوند؛ مبلغ مصبدعقد قرارداد فقط پس از تأیید مرجع + مستند معتبر.
 *  - مدت اثرگذاری تغییر ≠ تمدید مدت قراردادی؛ استحقاق تمدید با بررسی
 *    قرارداد/شواهد و تأیید جداگانه تعیین می‌شود.
 *  - هیچ کلید خارجی فیزیکی به سایر ماژول‌ها وجود ندارد (Zero-Regression)؛
 *    پیوندها به تأخیر/ضرر/ریسک/کارشناسی دعاوی نرم است (Code/ID) و دادهٔ آن
 *    ماژول‌ها فقط‌خواندنی خوانده می‌شود — هیچ بازنویسی یا بازمحاسبه‌ای در
 *    این ماژول انجام نمی‌شود.
 *  - دستیار قاعده‌محور است؛ LLM متصل نیست (CHANGE_LLM_CONNECTED=false
 *    صادقانه) و طبقه‌بندی/پیشنهاد با قواعد صریح + صادقانه انجام می‌شود —
 *    نه با جعل «هوش».
 */
export const CHANGE_MODULE_ID = "PMO-INTEGRATED-CHANGE-MANAGEMENT-V1.0";
export const CHANGE_MODULE_VERSION = "1.0.0";
export const CHANGE_LLM_CONNECTED = false;

/* ─────────────── ۱۲ جدول اختصاصی (پیشوند PmisChange) ─────────────── */
export const CHANGE_TABLES = [
  "PmisChangeRequests",
  "PmisChangeImpacts",
  "PmisChangeCostEstimates",
  "PmisChangeScheduleImpacts",
  "PmisChangeApprovals",
  "PmisChangeRiskLinks",
  "PmisChangeClaimLinks",
  "PmisChangeDocuments",
  "PmisChangeImplementation",
  "PmisChangeAuditTrail",
  "PmisChangeModuleLinks",
  "PmisChangeSettings",
] as const;
export type ChangeTable = (typeof CHANGE_TABLES)[number];
export const CHANGE_CHILD_TABLES = CHANGE_TABLES.filter((t) => t !== "PmisChangeRequests" && t !== "PmisChangeSettings");

/* ─────────────── انواع تغییر — حداقل ۱۰ نوع (قابل تنظیم در Settings) ─────────────── */
export const CHANGE_TYPES = [
  { code: "scope", fa: "تغییر در محدوده کار" },
  { code: "design", fa: "تغییر در طراحی" },
  { code: "quantity", fa: "تغییر در مقادیر" },
  { code: "spec_tech", fa: "تغییر در مشخصات فنی" },
  { code: "method", fa: "تغییر در روش اجرا" },
  { code: "schedule", fa: "تغییر در برنامه زمان‌بندی" },
  { code: "resource", fa: "تغییر در منابع" },
  { code: "cost", fa: "تغییر در هزینه" },
  { code: "legal", fa: "تغییر در الزامات قانونی" },
  { code: "contract_terms", fa: "تغییر در شرایط قراردادی" },
  { code: "other", fa: "سایر" },
] as const;
export const CHANGE_TYPE_FA: Record<string, string> = Object.fromEntries(CHANGE_TYPES.map((t) => [t.code, t.fa]));

/* ─────────────── نقش‌های مجاز (۱۵ دستور اجرایی) ─────────────── */
export const CHANGE_ROLES = [
  { code: "requester", fa: "درخواست‌کننده" },
  { code: "technical_expert", fa: "کارشناس فنی" },
  { code: "planner", fa: "برنامه‌ریز" },
  { code: "cost_expert", fa: "کارشناس هزینه" },
  { code: "contract_expert", fa: "کارشناس قرارداد" },
  { code: "risk_owner", fa: "مسئول ریسک" },
  { code: "project_manager", fa: "مدیر پروژه" },
  { code: "approver", fa: "مرجع تصویب" },
  { code: "observer", fa: "ناظر/حسابرس" },
  { code: "admin", fa: "مدیر سامانه" },
] as const;

/* ─────────────── چرخهٔ عمر ۱۶ مرحله‌ای (۱۹ وضعیت) ─────────────── */
export const CHANGE_STATUSES = [
  "draft", "submitted", "completeness_review", "initial_eval",
  "technical_review", "time_analysis", "cost_analysis", "contract_review",
  "risk_assessment", "dispute_screening", "consolidation", "pending_decision",
  "approved", "approved_conditional", "rejected",
  "notified", "implementing", "baselines_updated", "execution_monitoring",
  "closed", "archived",
] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];
export const CHANGE_STATUS_FA: Record<ChangeStatus, string> = {
  draft: "پیش‌نویس (ثبت اولیه)",
  submitted: "ثبت درخواست",
  completeness_review: "بررسی کامل‌بودن اطلاعات",
  initial_eval: "ارزیابی اولیه",
  technical_review: "بررسی فنی و مهندسی",
  time_analysis: "تحلیل اثر بر زمان‌بندی",
  cost_analysis: "تحلیل اثر بر هزینه و بودجه",
  contract_review: "بررسی قراردادی و تعهدات",
  risk_assessment: "ارزیابی ریسک",
  dispute_screening: "غربال ادعاها و اختلافات احتمالی",
  consolidation: "تجمیع نظر کارشناسان",
  pending_decision: "در انتظار تصمیم مرجع مجاز",
  approved: "تأییدشده",
  approved_conditional: "تأیید مشروط",
  rejected: "ردشده",
  notified: "ابلاغ‌شده",
  implementing: "در حال اجرا",
  baselines_updated: "مبناهای مجاز به‌روزرسانی شد",
  execution_monitoring: "کنترل نتایج اجرا",
  closed: "بسته‌شده",
  archived: "بایگانی‌شده",
};

/** گذر مجاز از هر وضعیت (خطی پس‌رو + پرش‌های مجاز صریح). */
export const CHANGE_TRANSITIONS: Record<ChangeStatus, ChangeStatus[]> = {
  draft: ["submitted"],
  submitted: ["completeness_review"],
  completeness_review: ["initial_eval", "draft"],
  initial_eval: ["technical_review", "draft"],
  technical_review: ["time_analysis", "initial_eval"],
  time_analysis: ["cost_analysis", "technical_review"],
  cost_analysis: ["contract_review", "time_analysis"],
  contract_review: ["risk_assessment", "cost_analysis"],
  risk_assessment: ["dispute_screening", "contract_review"],
  dispute_screening: ["consolidation", "risk_assessment"],
  consolidation: ["pending_decision", "dispute_screening"],
  pending_decision: ["approved", "approved_conditional", "rejected"],
  approved: ["notified"],
  approved_conditional: ["notified"],
  rejected: ["archived"],
  notified: ["implementing"],
  implementing: ["baselines_updated"],
  baselines_updated: ["execution_monitoring"],
  execution_monitoring: ["closed"],
  closed: ["archived"],
  archived: [],
};
export function canTransitionChange(from: ChangeStatus, to: ChangeStatus): boolean {
  return (CHANGE_TRANSITIONS[from] ?? []).includes(to);
}

/** مجوز لازم برای ورود به هر وضعیت (تصویب‌ها با SoD در سمت API کنترل می‌شوند). */
export const CHANGE_STATUS_PERM: Record<ChangeStatus, "change.edit" | "change.analyze" | "change.review" | "change.approve" | "change.implement"> = {
  draft: "change.edit",
  submitted: "change.edit",
  completeness_review: "change.edit",
  initial_eval: "change.edit",
  technical_review: "change.analyze",
  time_analysis: "change.analyze",
  cost_analysis: "change.analyze",
  contract_review: "change.review",
  risk_assessment: "change.review",
  dispute_screening: "change.review",
  consolidation: "change.review",
  pending_decision: "change.review",
  approved: "change.approve",
  approved_conditional: "change.approve",
  rejected: "change.approve",
  notified: "change.implement",
  implementing: "change.implement",
  baselines_updated: "change.implement",
  execution_monitoring: "change.implement",
  closed: "change.approve",
  archived: "change.approve",
};
export const CHANGE_APPROVAL_STATUSES: ChangeStatus[] = ["approved", "approved_conditional", "rejected"];
export function changeTransitionIsDecision(to: ChangeStatus): boolean {
  return CHANGE_APPROVAL_STATUSES.includes(to);
}
export function isTerminalChange(status: ChangeStatus): boolean {
  return status === "archived";
}

/* ─────────────── لایه‌های مبلغ — جدا از هم، بدون برابری پیش‌فرض ─────────────── */
export const COST_LAYERS = ["estimated", "proposed", "negotiated", "approved", "paid"] as const;
export type CostLayer = (typeof COST_LAYERS)[number];
export const COST_LAYER_FA: Record<CostLayer, string> = {
  estimated: "برآورد اولیه",
  proposed: "پیشنهادی",
  negotiated: "مذاکره‌شده",
  approved: "مصوب",
  paid: "پرداخت‌شده",
};

/* ─────────────── کدهای یکتا ─────────────── */
export function newChangeCode(now: Date = new Date()): string {
  return `CHG-${now.getTime().toString(36).toUpperCase()}`;
}
export function newRecordCode(prefix: string, now: Date = new Date()): string {
  const p = prefix.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "REC";
  return `${p}-${now.getTime().toString(36).toUpperCase()}`;
}

/* ─────────────── اعتبارسنجی‌ها ─────────────── */
export interface ValidationResult { ok: boolean; errors: string[]; }
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function errors(ok: boolean, ...list: (string | false)[]): ValidationResult {
  return { ok, errors: list.filter(Boolean) as string[] };
}

/** ورودی ساخت/ویرایش درخواست تغییر. */
export function validateChangeInput(b: Record<string, unknown>): ValidationResult {
  const e: string[] = [];
  if (!String(b.TitleFa ?? "").trim()) e.push("عنوان تغییر الزامی است");
  const t = String(b.ChangeType ?? "");
  if (t && !CHANGE_TYPES.some((x) => x.code === t)) e.push("نوع تغییر باید از فهرست استاندارد باشد");
  if (b.RequestDate !== undefined && b.RequestDate !== null && b.RequestDate !== "" && !ISO_DATE.test(String(b.RequestDate))) e.push("تاریخ درخواست باید قالب YYYY-MM-DD باشد");
  const num = (v: unknown, f: string, integer = true) => {
    if (v === undefined || v === null || v === "") return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) e.push(`${f} باید عدد نامنفی باشد`);
    else if (integer && !Number.isInteger(n)) e.push(`${f} باید عدد صحیح باشد`);
  };
  num(b.InitialCostEstimate, "هزینه اولیه برآوردی", false);
  num(b.InitialTimeImpactDays, "اثر اولیه بر مدت");
  if (b.Priority !== undefined && !["", "low", "normal", "high", "urgent"].includes(String(b.Priority))) e.push("اولویت باید low|normal|high|urgent باشد");
  return errors(e.length === 0, ...e);
}

/** وضعیت مرور یک رکورد تحلیل — هیچ نتیجه‌ای بدون تأیید انسانی نهایی نیست. */
export const REVIEW_STATUSES = ["draft", "under_review", "approved", "rejected"] as const;
export const REVIEW_STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس", under_review: "در حال بررسی", approved: "تأییدشده", rejected: "ردشده",
};

/** مشخصات فیلدهای الزامی هر جدول فرزند. */
export const CHANGE_CHILD_SPECS: Record<string, { required: string[] }> = {
  PmisChangeImpacts: { required: ["TopicFa", "ConclusionFa"] },
  PmisChangeCostEstimates: { required: ["Layer", "Amount", "FormulaFa", "SourceFa", "BasisDate"] },
  PmisChangeScheduleImpacts: { required: ["MethodFa", "AssumptionsFa"] },
  PmisChangeApprovals: { required: ["StepCode"] },
  PmisChangeRiskLinks: { required: ["LinkType", "DescriptionFa"] },
  PmisChangeClaimLinks: { required: ["LinkType", "DescriptionFa"] },
  PmisChangeDocuments: { required: ["TitleFa", "Kind"] },
  PmisChangeImplementation: { required: ["Step", "Status"] },
  PmisChangeAuditTrail: { required: ["Action"] },
  PmisChangeModuleLinks: { required: ["LinkKind", "TargetCode", "TargetTitleFa"] },
};

export function validateChildRow(table: string, body: Record<string, unknown>): ValidationResult {
  const spec = CHANGE_CHILD_SPECS[table];
  if (!spec) return { ok: false, errors: ["جدول فرزند نامعتبر است"] };
  const e: string[] = [];
  for (const f of spec.required) {
    const v = body[f];
    if (v === undefined || v === null || String(v).trim() === "") e.push(`فیلد «${f}» الزامی است`);
  }
  /* قوانین تخصصی هر جدول */
  if (table === "PmisChangeCostEstimates") {
    if (!COST_LAYERS.includes(String(body.Layer) as CostLayer)) e.push("لایهٔ مبلغ باید estimated|proposed|negotiated|approved|paid باشد");
    const n = Number(body.Amount);
    if (!Number.isFinite(n) || n < 0) e.push("مبلغ باید عدد نامنفی باشد");
    if (body.BasisDate && !ISO_DATE.test(String(body.BasisDate))) e.push("تاریخ مبنا باید YYYY-MM-DD باشد");
  }
  if (table === "PmisChangeScheduleImpacts") {
    for (const f of ["EstimatedDurationDeltaDays", "CompletionEffectDays", "ApprovedEotDays"] as const) {
      if (body[f] !== undefined && body[f] !== null && body[f] !== "" && !Number.isInteger(Number(body[f]))) e.push(`«${f}» باید عدد صحیح باشد (روز)`);
    }
    if (body.EstimatedDurationDeltaDays !== undefined && body.ApprovedEotDays !== undefined && body.ApprovedEotDays !== null && body.ApprovedEotDays !== "" && !body.EotEntitlementFa) {
      e.push("اثر مدت تغییر با تمدید قراردادی یکسان فرض نشود — برای روزهای تمدید تأییدشده، مبنای استحقاق (EotEntitlementFa) الزامی است");
    }
  }
  if (table === "PmisChangeImplementation") {
    const steps = ["instruction_issued", "started", "baselines_updated", "execution_control", "verified", "completed"];
    if (body.Step && !steps.includes(String(body.Step))) e.push("مرحلهٔ اجرا نامعتبر است");
    const st = ["planned", "in_progress", "done", "blocked"];
    if (body.Status && !st.includes(String(body.Status))) e.push("وضعیت اجرا نامعتبر است");
  }
  return errors(e.length === 0, ...e);
}

/* ─────────────── پیوند نرم به چهار ماژول + EDMS ─────────────── */
export const LINK_KINDS = [
  { code: "delay_event", fa: "رویداد تأخیر/تمدید (ماژول تأخیرات)" },
  { code: "loss_case", fa: "پروندهٔ ضرر و زیان" },
  { code: "contract_risk", fa: "ریسک قراردادی" },
  { code: "claim", fa: "ادعا (RCC)" },
  { code: "dispute_case", fa: "پروندهٔ کارشناسی دعاوی" },
  { code: "edms_document", fa: "سند EDMS" },
  { code: "legacy_change_request", fa: "درخواست تغییر قدیمی d4 (فقط‌خواندنی)" },
] as const;
export const LINK_KIND_FA: Record<string, string> = Object.fromEntries(LINK_KINDS.map((k) => [k.code, k.fa]));

/* ─────────────── داشبورد — همهٔ شاخص‌ها از ردیف‌های واقعی ─────────────── */
export function computeChangeDashboard(requests: Record<string, unknown>[], costs: Record<string, unknown>[], scheduleImpacts: Record<string, unknown>[], riskLinks: Record<string, unknown>[], claimLinks: Record<string, unknown>[], today = new Date().toISOString().slice(0, 10)) {
  const by = (rows: Record<string, unknown>[], key: string) => {
    const m = new Map<string, number>();
    for (const r of rows) { const k = String(r[key] ?? ""); m.set(k, (m.get(k) ?? 0) + 1); }
    return Object.fromEntries([...m.entries()].sort());
  };
  const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const completed = requests.filter((r) => ["closed", "archived"].includes(String(r.Status)) && r.RequestDate && r.StatusChangedAt);
  const avgDays = completed.length
    ? Math.round(completed.reduce((s, r) => s + daysBetween(String(r.RequestDate), String(r.StatusChangedAt).slice(0, 10)), 0) / completed.length)
    : null;
  const sum = (rows: Record<string, unknown>[], layer: string) =>
    rows.filter((c) => String(c.Layer ?? "") === layer).reduce((s, c) => s + (Number(c.Amount) || 0), 0);
  const cumulativeDays = scheduleImpacts.reduce((s, i) => s + (Number(i.EstimatedDurationDeltaDays) || 0), 0);
  const approvedEotDays = scheduleImpacts.reduce((s, i) => s + (Number(i.ApprovedEotDays) || 0), 0);
  return {
    totalRequests: requests.length,
    byStatus: by(requests, "Status"),
    byType: by(requests, "ChangeType"),
    awaitingReview: requests.filter((r) => ["submitted", "completeness_review", "initial_eval"].includes(String(r.Status))).length,
    awaitingApproval: requests.filter((r) => String(r.Status) === "pending_decision").length,
    approvedCount: requests.filter((r) => ["approved", "approved_conditional"].includes(String(r.Status))).length,
    rejectedCount: requests.filter((r) => String(r.Status) === "rejected").length,
    implementingCount: requests.filter((r) => ["notified", "implementing", "baselines_updated", "execution_monitoring"].includes(String(r.Status))).length,
    overdueCount: requests.filter((r) => r.ReviewDueDate && String(r.ReviewDueDate) < today && !isTerminalChange(String(r.Status) as ChangeStatus) && !["closed", "rejected"].includes(String(r.Status))).length,
    avgCompletionDays: avgDays,
    /* لایه‌های مبلغ — برآوردی/پیشنهادی/مذاکره/مصوب/پرداخت جدا و منفاوت */
    costLayers: {
      estimated: sum(costs, "estimated"),
      proposed: sum(costs, "proposed"),
      negotiated: sum(costs, "negotiated"),
      approved: sum(costs, "approved"),
      paid: sum(costs, "paid"),
    },
    cumulativeDurationDeltaDays: cumulativeDays,
    approvedEotDaysTotal: approvedEotDays,
    highRiskCount: riskLinks.filter((r) => Number(r.Score) >= 6).length,
    disputeLinkedCount: claimLinks.filter((r) => r.ExpertCaseRef || String(r.LinkType ?? "") !== "monitoring").length,
    llmConnected: CHANGE_LLM_CONNECTED,
  };
}

export const CHANGE_EMPTY = "—";
