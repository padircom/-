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
export function validateChangeInput(b: Record<string, unknown>, extraTypes?: unknown): ValidationResult {
  const e: string[] = [];
  if (!String(b.TitleFa ?? "").trim()) e.push("عنوان تغییر الزامی است");
  const t = String(b.ChangeType ?? "");
  if (t && !effectiveChangeTypes(extraTypes).some((x) => x.code === t)) e.push("نوع تغییر باید از فهرست استاندارد (یا انواع سفارشی پروژه در Settings) باشد");
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

/** فاز ۸ — جنبه‌های مجاز ارزیابی اثر تغییر (بازبینی‌پذیر). */
export const IMPACT_ASPECTS = ["technical", "method", "spec", "resource", "schedule", "contract", "cost", "other"] as const;

export function validateChildRow(table: string, body: Record<string, unknown>): ValidationResult {
  const spec = CHANGE_CHILD_SPECS[table];
  if (!spec) return { ok: false, errors: ["جدول فرزند نامعتبر است"] };
  const e: string[] = [];
  for (const f of spec.required) {
    const v = body[f];
    if (v === undefined || v === null || String(v).trim() === "") e.push(`فیلد «${f}» الزامی است`);
  }
  /* قوانین تخصصی هر جدول */
  if (table === "PmisChangeImpacts") {
    /* فاز ۸ — بحث واقعی: نتیجه‌گیری باید ۱۰+ نویسه و topic ۳+*/
    if (String(body.TopicFa ?? "").trim().length < 3) e.push("TopicFa باید حداقل ۳ نویسهٔ واقعی باشد");
    if (String(body.ConclusionFa ?? "").trim().length < 10) e.push("ConclusionFa باید حداقل ۱۰ نویسهٔ واقعی باشد");
    if (body.Aspect !== undefined && body.Aspect !== null && body.Aspect !== "" && !IMPACT_ASPECTS.includes(String(body.Aspect) as never)) e.push(`Aspect باید یکی از ${IMPACT_ASPECTS.join("/")} باشد`);
  }
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

/* ═══════════════════ فاز ۲: موتورهای تحلیل + پیوند نرم زنده ═══════════════════
   همهٔ توابع خالص‌اند و هیچ دادهٔ ماژول دیگری را بازنویسی/بازمحاسبه نمی‌کنند؛
   ورودی‌ها فقط‌خواندنی از API خوانده می‌شوند. */

/** پارس امن آرایهٔ رشته‌ای از فیلد json (همیشه آرایه برمی‌گرداند). */
export function parseCodeList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean);
    } catch { /* رشتهٔ ساده */ }
    return [v.trim()];
  }
  return [];
}

/* ─────────────── موتور اثر زمانی — تحلیل صادقانه، نه خودکار ─────────────── */
export interface ChangeTimeActivity {
  code: string; nameFa: string; plannedStart: string | null; plannedFinish: string | null;
  durationDays: number | null; totalFloat: number | null; freeFloat: number | null;
  isCritical: boolean; predecessorCodes: string[]; successorCodes: string[];
}
export interface ChangeTimeAnalysis {
  requestedActivityCodes: string[];
  affected: ChangeTimeActivity[];
  unknownCodes: string[];
  affectedCount: number;
  criticalCount: number;
  criticalPathEffect: "none" | "partial" | "critical";
  milestoneCount: number;
  baselineFinish: string | null;
  /** Σ اثر تخمینی مدت از ردیف‌های ScheduleImpacts (با تمدید یکی نیست) */
  estimatedDeltaDays: number;
  approvedEotDays: number;
  scheduleRowCount: number;
  dataBasisNoteFa: string;
}

const ISO_DATE_MIN = /^(\d{4})-(\d{2})-(\d{2})/;
export function analyzeTimeImpact(
  request: Record<string, unknown>,
  schedRows: Record<string, unknown>[],
  activities: Record<string, unknown>[],
  relations: Record<string, unknown>[] = [],
): ChangeTimeAnalysis {
  const byId = new Map(activities.map((a) => [String(a.Id), a]));
  const byCode = new Map(activities.map((a) => [String(a.Code), a]));
  const requestedCodes = [...new Set([
    ...parseCodeList(request.ActivityRefs),
    ...schedRows.flatMap((r) => parseCodeList(r.AffectedActivitiesJson)),
  ])];
  const wbsCodes = [...new Set(parseCodeList(request.WbsRefs))];
  const wbsById = new Map(wbsCodes.map((c) => [c, c]));
  /* انتخاب فعالیت‌های تحت اثر: مستقیم بر اساس کد + فعالیت‌های WBSهای منتخب (اگر رابط Wbs تعریف شده باشد) */
  const affected: ChangeTimeActivity[] = [];
  const unknownCodes: string[] = [];
  const inSet = new Set<string>();
  const push = (a: Record<string, unknown>) => {
    const code = String(a.Code);
    if (inSet.has(code)) return;
    inSet.add(code);
    const id = String(a.Id);
    affected.push({
      code, nameFa: String(a.NameFa ?? ""),
      plannedStart: a.PlannedStart ? String(a.PlannedStart).slice(0, 10) : null,
      plannedFinish: a.PlannedFinish ? String(a.PlannedFinish).slice(0, 10) : null,
      durationDays: a.DurationDays == null ? null : Number(a.DurationDays),
      totalFloat: a.TotalFloat == null ? null : Number(a.TotalFloat),
      freeFloat: a.FreeFloat == null ? null : Number(a.FreeFloat),
      isCritical: Boolean(a.IsCritical),
      predecessorCodes: relations.filter((r) => String(r.SuccessorId) === id).map((r) => { const p = byId.get(String(r.PredecessorId)); return p ? String(p.Code) : ""; }).filter(Boolean),
      successorCodes: relations.filter((r) => String(r.PredecessorId) === id).map((r) => { const p = byId.get(String(r.SuccessorId)); return p ? String(p.Code) : ""; }).filter(Boolean),
    });
  };
  for (const c of requestedCodes) {
    const a = byCode.get(c);
    if (a) push(a); else unknownCodes.push(c);
  }
  if (wbsCodes.length) {
    for (const a of activities) {
      const wbsRef = String(a.WbsId ?? "");
      if (wbsRef && wbsById.has(wbsRef)) push(a);
    }
  }
  const criticalCount = affected.filter((a) => a.isCritical).length;
  /* مسیر بحرانی: اگر هیچ فعالیت بحرانی متاثر نشد ولی برخی تخمین‌ها از تلورانس مَنافی‌شان فراتر روند «جزئی» — تلورانس توسط کاربر در EstimatedDurationDeltaDays ثبت می‌شود؛ اینجا فقط فلگ صریح شناور */
  const totalDelta = schedRows.reduce((s, r) => s + (Number(r.EstimatedDurationDeltaDays) || 0), 0);
  const floatBreach = affected.some((a) => a.totalFloat !== null && totalDelta > Math.max(0, a.totalFloat));
  const criticalPathEffect: ChangeTimeAnalysis["criticalPathEffect"] = criticalCount > 0 ? "critical" : floatBreach ? "partial" : affected.length ? "none" : "none";
  const finishes = affected.map((a) => a.plannedFinish).filter((x): x is string => !!x && ISO_DATE_MIN.test(x)).sort();
  return {
    requestedActivityCodes: requestedCodes,
    affected, unknownCodes,
    affectedCount: affected.length,
    criticalCount,
    criticalPathEffect,
    milestoneCount: affected.filter((a) => (a.durationDays ?? 1) === 0).length,
    baselineFinish: finishes.length ? finishes[finishes.length - 1] : null,
    estimatedDeltaDays: totalDelta,
    approvedEotDays: schedRows.reduce((s, r) => s + (Number(r.ApprovedEotDays) || 0), 0),
    scheduleRowCount: schedRows.length,
    dataBasisNoteFa: "فعالیت‌ها از ماژول برنامه‌ریزی (فقط‌خواندنی) خوانده می‌شوند؛ اثر تخمینی مدت با تمدید قراردادی یکسان نیست و تمدید فقط پس از بررسی استحقاق و تأیید جداگانه معتبر است.",
  };
}

/* ─────────────── موتور اثر هزینه — تجمیع لایه‌ای صادقانه ─────────────── */
export interface ChangeCostAnalysis {
  currency: string;
  layers: Record<string, number>;
  layerDeltas: Record<string, number | null>;
  directTotal: number;
  indirectTotal: number;
  timeRelatedTotal: number;
  rowCount: number;
  approvedLayerCount: number;
  warningsFa: string[];
}
export function analyzeCostImpact(costRows: Record<string, unknown>[], currency = "IRR"): ChangeCostAnalysis {
  const layers: Record<string, number> = Object.fromEntries(COST_LAYERS.map((l) => [l, 0]));
  const layerApprovedBy = new Set<string>();
  let direct = 0, indirect = 0, timeRel = 0;
  const warnings: string[] = [];
  let approvedCount = 0;
  for (const r of costRows) {
    const layer = String(r.Layer ?? "estimated");
    const amt = Number(r.Amount) || 0;
    if (layers[layer] === undefined) { layers[layer] = amt; } else layers[layer] += amt;
    direct += Number(r.DirectAmount) || 0;
    indirect += Number(r.IndirectAmount) || 0;
    timeRel += Number(r.TimeRelatedAmount) || 0;
    if (layer === "approved") { approvedCount++; if (r.ApprovedBy) layerApprovedBy.add(String(r.ApprovedBy)); }
    if (["approved", "paid"].includes(layer) && !String(r.SourceFa ?? "").trim())
      warnings.push(`ردیف ${String(r.Code ?? "")}: لایهٔ مصوب/پرداخت بدون منبع نامعتبر است`);
  }
  const paid = layers.paid ?? 0, approved = layers.approved ?? 0;
  if (paid > 0 && approved <= 0) warnings.push("مبلغ «پرداخت‌شده» بدون لایهٔ «مصوب» ثبت شده است — ابتدا لایهٔ مصوب با مستند معتبر لازم است");
  if (paid > approved) warnings.push("مجموع «پرداخت‌شده» از «مصوب» بیشتر است — بررسی کنید");
  const delta = (a: string, b: string) => (layers[a] > 0 || layers[b] > 0 ? layers[a] - layers[b] : null);
  return {
    currency, layers,
    layerDeltas: {
      "proposed-estimated": delta("proposed", "estimated"),
      "negotiated-proposed": delta("negotiated", "proposed"),
      "approved-negotiated": delta("approved", "negotiated"),
      "paid-approved": delta("paid", "approved"),
    },
    directTotal: direct, indirectTotal: indirect, timeRelatedTotal: timeRel,
    rowCount: costRows.length,
    approvedLayerCount: approvedCount,
    warningsFa: [...new Set(warnings)],
  };
}

/* ─────────────── راستی‌آزمایی پیوندهای نرم (فاز ۲) ─────────────── */
export interface LinkVerifySets {
  delayEventCodes: Set<string>;
  lossCaseCodes: Set<string>;
  contractRiskCodes: Set<string>;
  claimCodes: Set<string>;
  disputeCaseCodes: Set<string>;
  documentIds: Set<string>;
  legacyChangeCodes: Set<string>;
  baselineIds: Set<string>;
}
export function verifyModuleLinks(links: Record<string, unknown>[], sets: LinkVerifySets) {
  const map: Record<string, Set<string>> = {
    delay_event: sets.delayEventCodes,
    loss_case: sets.lossCaseCodes,
    contract_risk: sets.contractRiskCodes,
    claim: sets.claimCodes,
    dispute_case: sets.disputeCaseCodes,
    edms_document: sets.documentIds,
    legacy_change_request: sets.legacyChangeCodes,
    baseline_revision: sets.baselineIds,
  };
  return links.map((l) => {
    const kind = String(l.LinkKind ?? "");
    const set = map[kind];
    const code = String(l.TargetCode ?? "");
    return {
      ...l,
      verified: set ? set.has(code) : null,
      verifiedNoteFa: set ? (set.has(code) ? null : "مقصد پیوند در ماژول مبدأ یافت نشد (نرم ارزیابی شد)") : "نوع پیوند ناشناخته",
    };
  });
}
export type { CostLayer as ChangeCostLayer };

/* ═════════════════════════════ فاز ۲ — موتورهای تحلیل ═════════════════════════════ */

/** پاسارگانهٔ «تاریخ مبنا → جمع لایه‌ها» برای نمای کاش‌فلو. */
export interface ChangeCashflowPoint {
  basisDate: string;
  total: number;
  byLayer: Record<string, number>;
}

/**
 * لایه‌های مبلغ را از ردیف‌های خام CostEstimates تجمیع می‌کند؛ هیچ‌گاه مبالغ را برابر پیش‌فرض نمی‌گذارد.
 * واریانس زنجیرهٔ لایه‌ها: برآورد→پیشنهاد→مذاکره→مصوب→پرداخت.
 */
export function computeCostLayers(rows: Record<string, unknown>[]): {
  totals: Record<CostLayer, number>;
  variance: { estToProp: number; propToNeg: number; negToApp: number; appToPaid: number };
  cashflowByDate: ChangeCashflowPoint[];
  warningsFa: string[];
  duplicates: string[];
} {
  const totals = Object.fromEntries(COST_LAYERS.map((l) => [l, 0])) as Record<CostLayer, number>;
  const seen = new Map<string, Map<CostLayer, number>>();
  const cash = new Map<string, Record<string, number>>();
  const warnings: string[] = [];
  for (const r of rows) {
    const layer = String(r.Layer ?? "") as CostLayer;
    if (!COST_LAYERS.includes(layer)) continue;
    const amount = Number(r.Amount) || 0;
    totals[layer] = (totals[layer] ?? 0) + amount;
    const code = String(r.Code ?? "");
    if (code) {
      const m = seen.get(code) ?? new Map<CostLayer, number>();
      m.set(layer, (m.get(layer) ?? 0) + amount);
      seen.set(code, m);
    }
    const bd = String(r.BasisDate ?? "").slice(0, 7);
    if (bd && ISO_DATE.test(`${bd}-01`)) {
      const bc = cash.get(bd) ?? {};
      bc[layer] = (bc[layer] ?? 0) + amount;
      cash.set(bd, bc);
    }
    const f = String(r.FormulaFa ?? "").trim(), s = String(r.SourceFa ?? "").trim();
    if (layer === "estimated" && (!f || !s)) warnings.push(`ردیف «${code || "?"}»: لایهٔ برآورد بدون فرمول یا منبع`);
    if ((layer === "approved" || layer === "paid") && !s) warnings.push(`ردیف «${code || "?"}»: لایهٔ ${COST_LAYER_FA[layer]} بدون سند معتبر`);
  }
  const layerNum = (l: CostLayer) => totals[l] ?? 0;
  const px = [0, 0, 0, 0]; /* صفر قانون‌مدار نیست — فقط محور محاسبه */
  const variance = {
    estToProp: layerNum("proposed") - layerNum("estimated"),
    propToNeg: layerNum("negotiated") - layerNum("proposed"),
    negToApp: layerNum("approved") - layerNum("negotiated"),
    appToPaid: layerNum("paid") - layerNum("approved"),
  };
  void px;
  const cashflowByDate: ChangeCashflowPoint[] = [...cash.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([basisDate, byLayer]) => ({ basisDate, byLayer, total: Object.values(byLayer).reduce((s, v) => s + v, 0) }));
  const duplicates: string[] = [];
  for (const [code, m] of seen) {
    const paid = m.get("paid") ?? 0, approved = m.get("approved") ?? 0;
    if (paid > 0 && approved > 0 && paid > approved) warnings.push(`کد «${code}»: پرداخت از مصوب بیشتر است — بررسی کنید`);
    if (paid > 0 && approved === 0) warnings.push(`کد «${code}»: پرداخت بدون لایهٔ مصوب ثبت شده است`);
    const dups = [...m.keys()].filter((l) => m.get(l) !== 0).length > 1 && PAIRS.some(([a2, b2]) => (m.get(a2) ?? 0) === (m.get(b2) ?? 0) && (m.get(a2) ?? 0) > 0);
    if (dups) duplicates.push(code);
  }
  if (duplicates.length) warnings.push(`کدهای «${duplicates.join(", ")}»: لایه‌های متمایز با مبلغ یکسان — برابر پیش‌فرض نیستند مگر با مبنا`);
  return { totals, variance, cashflowByDate, warningsFa: warnings, duplicates };

}

const PAIRS: [CostLayer, CostLayer][] = [["estimated", "proposed"], ["proposed", "negotiated"], ["negotiated", "approved"], ["approved", "paid"]];

/* parseCodeList اینجا تعریف شده بود و بالاتر (کنار موتورهای تحلیل) منتقل شد */

/**
 * ارزیابی پایدار اثر زمان‌بندی تغییر — فقط از فعالیت‌های متأثر واقعی (d2) + ردیف‌های ScheduleImpacts.
 * تمدید قراردادی از «اثر زمانِ تغییر» جدا و فقط با ApprovedEotDays + EotEntitlementFa قابل ثبت است.
 */
export function assessTimeEffect(scheduleImpacts: Record<string, unknown>[], affectedActivities: Record<string, unknown>[]): {
  affectedCount: number; criticalCount: number; milestoneCount: number; minFloat: number | null;
  baselineMaxFinish: string | null; estDeltaDays: number; approvedEotDays: number; withoutEntitlement: number;
  highFloatCount: number;
} {
  let criticalCount = 0, milestoneCount = 0, minFloat: number | null = null, highFloat = 0;
  let baselineMaxFinish: string | null = null;
  for (const a of affectedActivities) {
    if (a.IsCritical === true || Number(a.IsCritical) === 1) criticalCount++;
    const dur = Number(a.DurationDays) || 0;
    if (dur === 0) milestoneCount++;
    const tf = a.TotalFloatDays;
    if (tf !== null && tf !== undefined && tf !== "") { const n = Number(tf); if (Number.isFinite(n)) { minFloat = minFloat === null ? n : Math.min(minFloat, n); if (n >= 21) highFloat++; } }
    const pf = String(a.PlannedFinish ?? "").slice(0, 10);
    if (pf && ISO_DATE.test(pf) && (baselineMaxFinish === null || pf > baselineMaxFinish)) baselineMaxFinish = pf;
  }
  let estDeltaDays = 0, approvedEotDays = 0, withoutEntitlement = 0;
  for (const s of scheduleImpacts) {
    estDeltaDays += Number(s.EstimatedDurationDeltaDays) || 0;
    const eot = Number(s.ApprovedEotDays) || 0;
    approvedEotDays += eot;
    if (eot !== 0 && !String(s.EotEntitlementFa ?? "").trim()) withoutEntitlement++;
  }
  return { affectedCount: affectedActivities.length, criticalCount, milestoneCount, minFloat, baselineMaxFinish, estDeltaDays, approvedEotDays, withoutEntitlement, highFloatCount: highFloat };
}

/** فیلتر هابل-پذیر برای drill-down داشبورد. */
export function filterChangeRequests(rows: Record<string, unknown>[], f: { status?: string; type?: string; fromDate?: string; toDate?: string }): Record<string, unknown>[] {
  return rows.filter((r) => {
    if (f.status && String(r.Status) !== f.status) return false;
    if (f.type && String(r.ChangeType) !== f.type) return false;
    const d = String(r.RequestDate ?? "");
    if (f.fromDate && d < f.fromDate) return false;
    if (f.toDate && d > f.toDate) return false;
    return true;
  });
}

/* ─── مراحل اجرای کنترل‌شده (PmisChangeImplementation.Step) ─── */
export const IMPLEMENTATION_STEPS = ["instruction_issued", "started", "baselines_updated", "execution_control", "verified", "completed"] as const;
export const IMPLEMENTATION_STEP_FA: Record<string, string> = {
  instruction_issued: "ابلاغ/دستور اجرا صادر شده",
  started: "اجرای مسیر تصویب آغاز شده",
  baselines_updated: "مبناهای مجاز به‌روزرسانی شد",
  execution_control: "کنترل اجرای واقع‌زیست",
  verified: "تحقق نتایج راستی‌آزمایی شد",
  completed: "تکمیل و آمادهٔ بستن",
};

/** میان‌بر وضعیت پس‌از‌تصویب: هر وضعیتی که مسیر تصویب/اجرا را در بر می‌گیرد. */
export function isPostApproval(status: string): boolean {
  return ["approved", "approved_conditional", "notified", "implementing", "baselines_updated", "execution_monitoring", "closed", "archived"].includes(status);
}



/* ═══════════════════ فاز ۶: آپلود سند واقعی (متادیتا در PmisChangeDocuments، بدنه در دیسک، کنترل sha256) ═══════════════════ */

export const CHANGE_DOC_KINDS = ["supporting", "decision", "instruction", "evidence", "correspondence"] as const;
export type ChangeDocKind = (typeof CHANGE_DOC_KINDS)[number];
export const CHANGE_DOC_KIND_FA: Record<ChangeDocKind, string> = {
  supporting: "مستند پشتیبان", decision: "سند تصمیم CCB", instruction: "دستورکار اجرا",
  evidence: "مدرک اجرایی", correspondence: "مکاتبه",
};

/** بدنهٔ آپلود سند (multipart fields به‌جز file). نتیجهٔ پاک‌سازی‌شده برای درج ردیف. */
export interface ChangeUploadFields { titleFa: string; kind: ChangeDocKind; docNo: string | null; docDate: string | null; noteFa: string | null }
const CHANGE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function validateChangeUploadPayload(b: Record<string, unknown>): ({ ok: true; fields: ChangeUploadFields } | { ok: false; error: string }) {
  const titleFa = String(b.TitleFa ?? "").trim();
  if (titleFa.length < 3 || titleFa.length > 400) return { ok: false, error: "عنوان سند باید بین ۳ تا ۴۰۰ نویسه باشد" };
  const kind = String(b.Kind ?? "").trim();
  if (!CHANGE_DOC_KINDS.includes(kind as ChangeDocKind)) return { ok: false, error: `نوع سند نامعتبر است — مقادیر مجاز: ${CHANGE_DOC_KINDS.join(", ")}` };
  const docNoRaw = b.DocNo === undefined || b.DocNo === null ? "" : String(b.DocNo).trim();
  if (docNoRaw.length > 60) return { ok: false, error: "شمارهٔ سند حداکثر ۶۰ نویسه است" };
  const docDateRaw = b.DocDate === undefined || b.DocDate === null ? "" : String(b.DocDate).trim();
  if (docDateRaw && !CHANGE_ISO_DATE.test(docDateRaw)) return { ok: false, error: "تاریخ سند باید YYYY-MM-DD باشد" };
  const noteRaw = b.NoteFa === undefined || b.NoteFa === null ? "" : String(b.NoteFa).trim();
  if (noteRaw.length > 1000) return { ok: false, error: "یادداشت حداکثر ۱۰۰۰ نویسه است" };
  return { ok: true, fields: { titleFa, kind: kind as ChangeDocKind, docNo: docNoRaw || null, docDate: docDateRaw || null, noteFa: noteRaw || null } };
}

/** نام امن دانلود — حذف مسیر، نویسه‌های کنترلی و کاراکترهای ممنوعهٔ فایل‌سیستم (هوم‌الگوی dprDocApi). */
export function changeSafeDocFileName(name: unknown): string {
  const base = String(name === undefined || name === null ? "" : name).replace(/\\/g, "/").split("/").pop() || "";
  const cleaned = base.replace(/[\u0000-\u001f"\\/:,*?<>|]+/g, "_").slice(-180);
  return cleaned || "file.bin";
}

/** ردیف سند برای خروجی API — FileRef (کلید ذخیره‌سازی داخلی) هرگز نمایش داده نمی‌شود. */
export function publicChangeDocRow<T extends Record<string, unknown>>(row: T): Omit<T, "FileRef"> {
  const { FileRef: _internal, ...pub } = row;
  return pub;
}

/* ── فاز ۵: ۱۴ گزارش مدیریتی ماژول تغییر (فقط‌خواندنی از دادهٔ واقعی) ── */

export const CHANGE_MGMT_REPORTS = [
  { code: "requests_status", fa: "وضعیت پرونده‌ها و گردش‌کار" },
  { code: "requests_by_type", fa: "درخواست‌ها به تفکیک نوع" },
  { code: "trend_requests", fa: "روند ثبت درخواست‌ها (ماهانه)" },
  { code: "cost_layers_detail", fa: "جزئیات پنج لایهٔ هزینه" },
  { code: "cost_warnings", fa: "ثبت‌های لایهٔ مصوب/پرداخت بدون منبع" },
  { code: "analyze_rows", fa: "ردیف‌های تحلیل اثر زمان‌بندی" },
  { code: "links_register", fa: "دفتر پیوندهای نرم ماژول‌ها" },
  { code: "links_gaps", fa: "پیوندهای مفقود/بی‌مقصد (راستی‌آزمایی)" },
  { code: "risk_claim_links", fa: "پیوندهای ریسک و ادعا/اختلاف" },
  { code: "implementation", fa: "مسیر اجرا و نسخهٔ نامستقر مبنا" },
  { code: "documents_register", fa: "دفتر اسناد مدیریت تغییر" },
  { code: "audit_trail", fa: "ردپای ممیزی پروژه" },
  { code: "review_sod_gaps", fa: "شناسه‌های SoD و لایهٔ تأییدشدهٔ بی‌مبنا" },
  { code: "dashboard_detail", fa: "جزئیات داشبورد مبالغ و وضعیت‌ها" },
] as const;
export const CHANGE_MGMT_REPORT_FA: Record<string, string> = Object.fromEntries(CHANGE_MGMT_REPORTS.map((m) => [m.code, m.fa]));
export const CHANGE_MGMT_KINDS = CHANGE_MGMT_REPORTS.map((m) => m.code);

export type ChangeMgmtRows = Record<string, unknown>;
export interface ChangeMgmtData {
  requests: ChangeMgmtRows[]; costs: ChangeMgmtRows[]; schedules: ChangeMgmtRows[];
  moduleLinks: ChangeMgmtRows[]; riskLinks: ChangeMgmtRows[]; claimLinks: ChangeMgmtRows[];
  documents: ChangeMgmtRows[]; implementation: ChangeMgmtRows[]; audits: ChangeMgmtRows[];
  today: string;
}
export interface ChangeMgmtReportOut { title: string; heads: string[]; rows: string[][]; noteFa?: string }

export function buildChangeManagementReport(kind: string, d: ChangeMgmtData): ChangeMgmtReportOut {
  const dash = CHANGE_EMPTY;
  const s = (v: unknown) => (v === undefined || v === null || v === "" ? dash : String(v));
  const m = (v: unknown) => { const n = Number(v); return v === undefined || v === null || v === "" || !Number.isFinite(n) ? dash : n.toLocaleString("en-US"); };
  const stFa = (v: unknown) => CHANGE_STATUS_FA[String(v) as ChangeStatus] ?? s(v);
  const tpFa = (v: unknown) => (CHANGE_TYPE_FA as Record<string, string>)[String(v)] ?? s(v);
  const lyFa = (v: unknown) => (COST_LAYER_FA as Record<string, string>)[String(v)] ?? s(v);
  const stepFa = (v: unknown) => IMPLEMENTATION_STEP_FA[String(v)] ?? s(v);
  switch (kind) {
    case "requests_status": {
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["کد", "عنوان", "نوع", "وضعیت", "اولویت", "درخواست‌کننده", "تاریخ", "مهلت بررسی", "آخرین تصمیم"],
        rows: d.requests.map((r) => [s(r.Code), s(r.TitleFa), tpFa(r.ChangeType), stFa(r.Status), s(r.Priority), s(r.RequestedBy), s(r.RequestDate), s(r.ReviewDueDate), s(r.DecidedBy)]) };
    }
    case "requests_by_type": {
      const by = new Map<string, number>();
      for (const r of d.requests) { const k = String(r.ChangeType ?? "other"); by.set(k, (by.get(k) ?? 0) + 1); }
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["نوع تغییر", "تعداد"], rows: [...by.entries()].map(([k, n]) => [tpFa(k), String(n)]), noteFa: d.requests.length ? undefined : "درخواستی ثبت نشده است" };
    }
    case "trend_requests": {
      const by = new Map<string, number>();
      for (const r of d.requests) { const k = String(r.RequestDate ?? "").slice(0, 7) || "نامشخص"; by.set(k, (by.get(k) ?? 0) + 1); }
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["ماه", "درخواست‌های ثبت‌شده"], rows: [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, n]) => [k, String(n)]) };
    }
    case "cost_layers_detail": {
      const layers = Object.fromEntries(COST_LAYERS.map((l) => [l, { count: 0, total: 0 }]));
      for (const c of d.costs) { const layer = COST_LAYERS.includes(String(c.Layer) as never) ? String(c.Layer) : "estimated"; layers[layer].count += 1; layers[layer].total += Number(c.Amount) || 0; }
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["لایه", "تعداد ردیف", "جمع مبلغ"],
        rows: COST_LAYERS.map((l) => [lyFa(l), String(layers[l].count), String(layers[l].total)]),
        noteFa: "پنج لایهٔ مبلغ جدا و منفاوت‌اند؛ «مصوب» فقط با منبع معتبر." };
    }
    case "cost_warnings": {
      const bad = d.costs.filter((c) => ["approved", "paid"].includes(String(c.Layer)) && !String(c.SourceFa ?? "").trim());
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["تغییر", "کد ردیف", "لایه", "مبلغ", "تهیه‌کننده"],
        rows: bad.map((c) => [s(c.ChangeCode), s(c.Code), lyFa(c.Layer), m(c.Amount), s(c.PreparedBy)]),
        noteFa: bad.length ? "این ردیف‌ها در وب‌مسیر POST رد می‌شدند — اگر دیده می‌شوند یعنی از خارج فرایند ثبت شده‌اند" : "همهٔ ردیف‌های لایهٔ مصوب/پرداخت منبع معتبر دارند" };
    }
    case "analyze_rows": {
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["تغییر", "کد ردیف", "روش", "Δمدت تخمینی (روز)", "اثر پایان (روز)", "تمدید مصوب", "مبنای استحقاق", "تهیه‌کننده"],
        rows: d.schedules.map((x) => [s(x.ChangeCode), s(x.Code), s(x.MethodFa), m(x.EstimatedDurationDeltaDays), m(x.CompletionEffectDays), m(x.ApprovedEotDays), s(x.EotEntitlementFa), s(x.PreparedBy)]),
        noteFa: "اثر مدت تغییر با تمدید قراردادی یکی نیست؛ متن EOT جدا است." };
    }
    case "links_register": {
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["تغییر", "کد پیوند", "نوع", "کد هدف", "عنوان هدف", "ثبت‌کننده"],
        rows: d.moduleLinks.map((l) => [s(l.ChangeCode), s(l.Code), LINK_KIND_FA[String(l.LinkKind)] ?? s(l.LinkKind), s(l.TargetCode), s(l.TargetTitleFa), s(l.EstablishedBy)]),
        noteFa: "پیوندها مرجع‌اند — دادهٔ ماژول مقصد را تغییر نمی‌دهند." };
    }
    case "links_gaps": {
      /* راستی‌آزمایی دوباره توسط server انجام می‌شود — اینجا فقط ردیف‌های مشخص الگوی نیازمند توجه */
      const bad = d.moduleLinks.filter((l) => !String(l.TargetCode ?? "").trim() || !String(l.TargetTitleFa ?? "").trim());
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["تغییر", "کد پیوند", "نوع", "کد هدف", "عیب"],
        rows: bad.map((l) => [s(l.ChangeCode), s(l.Code), s(l.LinkKind), s(l.TargetCode), !String(l.TargetCode ?? "").trim() ? "کد هدف تهی" : "عنوان هدف تهی"]),
        noteFa: "برای راستی‌آزمایی عدد پیوند معتبر/مفقود در درخواست: /requests/:id/analysis/links-verify" };
    }
    case "risk_claim_links": {
      const heads = ["مدل", "کد ردیف", "منبع/رتبه", "نوع", "توضیح", "ایجادکننده"];
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads,
        rows: [
          ...d.riskLinks.map((l) => ["ریسک", s(l.Code), s(l.RiskRegistryRef), s(l.LinkType), s(l.DescriptionFa), s(l.CreatedBy)]),
          ...d.claimLinks.map((l) => ["ادعا/اختلاف", s(l.Code), s(l.ClaimRef ?? l.DisputeCaseRef), s(l.LinkType), s(l.DescriptionFa), s(l.CreatedBy)]),
        ] };
    }
    case "implementation": {
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["تغییر", "کد", "مرحله", "وضعیت", "ارجاع مبنا", "نتیجه"],
        rows: d.implementation.map((i) => [s(i.ChangeCode), s(i.Code), stepFa(i.Step), s(i.Status), s(i.BaselineUpdateRef), s(i.ExecutionResultFa)]),
        noteFa: "به‌روزرسانی مبنا فقط با نسخهٔ نامستقر پیشنهادی انجام می‌شود؛ مبنای جاری خلاف Zero-Regression بازنویسی نمی‌شود." };
    }
    case "documents_register": {
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["تغییر", "کد", "عنوان سند", "نوع", "شماره", "بارگذارنده", "زمان"],
        rows: d.documents.map((doc) => [s(doc.ChangeCode), s(doc.Code), s(doc.TitleFa), s(doc.Kind), s(doc.DocNo), s(doc.UploadedBy), s(doc.UploadedAt)]) };
    }
    case "audit_trail": {
      const sorted = [...d.audits].sort((a, b) => String(b.OccurredAt ?? "").localeCompare(String(a.OccurredAt ?? "")));
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["زمان", "تغییر", "اقدام", "مجری", "جزئیات", "از → به"],
        rows: sorted.slice(0, 300).map((a) => [s(a.OccurredAt), s(a.ChangeCode), s(a.Action), s(a.Actor), s(a.DetailFa), `${s(a.FromValue)} → ${s(a.ToValue)}`]),
        noteFa: sorted.length > 300 ? "تکمیل: ۳۰۰ ردیف اخیر نمایش داده می‌شود" : undefined };
    }
    case "review_sod_gaps": {
      /* SoD: تصمیم غیر SoD‌دار اجرای سرور — هر تصمیم با همان آماده‌کننده مسدود است. این گزارش تطابق رکوردها را بررسی می‌کند. */
      const ready = new Map<string, ChangeMgmtRows>();
      for (const r of d.requests) {
        if (["approved", "approved_conditional", "rejected"].includes(String(r.Status))) {
          if (String(r.DecidedBy) === String(r.StatusChangedBy)) ready.set(String(r.Code), r);
        }
      }
      const approvedNoSource = d.costs.filter((c) => ["approved", "paid"].includes(String(c.Layer)) && !String(c.SourceFa ?? "").trim());
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["شناسه", "نوع وضعیت", "تصمیم‌گیرنده", "آماده‌کننده", "مسئله"],
        rows: [
          ...[...ready.values()].map((r) => [s(r.Code), "تصمیم نهایی", s(r.DecidedBy), s(r.StatusChangedBy), "SoD نقض: تصمیم‌گیرنده = آماده‌کننده"]),
          ...approvedNoSource.map((c) => [s(c.ChangeCode), "لایهٔ مصوب/پرداخت", s(c.PreparedBy), dash, "لایهٔ مصوب/پرداخت بدون منبع مستدل"]),
        ],
        noteFa: "هر دو رویهٔ سمت سرور (در POST /transition یا POST rows) جلوی این حالت را می‌گیرند — این گزارش بازرسی است." };
    }
    case "dashboard_detail": {
      const dash = computeChangeDashboard(d.requests, d.costs, d.schedules, d.riskLinks, d.claimLinks, d.today);
      return { title: CHANGE_MGMT_REPORT_FA[kind], heads: ["شاخص", "مقدار"],
        rows: [
          ["کل درخواست‌ها", String(dash.totalRequests)], ["در انتظار بررسی", String(dash.awaitingReview)],
          ["در انتظار تصمیم", String(dash.awaitingApproval)], ["تأییدشده", String(dash.approvedCount)],
          ["ردشده", String(dash.rejectedCount)], ["مسیر تصویب/اجرا", String(dash.implementingCount)],
          ["عقب‌افتاده", String(dash.overdueCount)], ["میانگین تکمیل (روز)", dash.avgCompletionDays === null ? CHANGE_EMPTY : String(dash.avgCompletionDays)],
          ["ریسک بالا", String(dash.highRiskCount)], ["پیوند به پیکان/دعوا", String(dash.disputeLinkedCount)],
          ["۵ لایهٔ مبلغ — برآورد", String(dash.costLayers.estimated)], ["۵ لایهٔ مبلغ — پیشنهاد", String(dash.costLayers.proposed)],
          ["۵ لایهٔ مبلغ — مذاکره", String(dash.costLayers.negotiated)], ["۵ لایهٔ مبلغ — مصوب", String(dash.costLayers.approved)],
          ["۵ لایهٔ مبلغ — پرداخت", String(dash.costLayers.paid)],
        ], noteFa: "هر لایهٔ مبلغ از رکوردهای واقعی مستقل محاسبه شده است." };
    }
    default:
      return { title: "گزارش نامعتبر", heads: ["خطا"], rows: [["گزارش مدیریتی با این کد تعریف نشده است"]] };
  }
}

/* ═══════════════════ فاز ۷: تنظیمات گردش‌کار واقعی (PmisChangeSettings — جدولِ آماده از 0074 که wire نشده بود) ═══════════════════ */

export const CHANGE_SETTING_KEYS = ["change_types_extra", "workflow_defaults"] as const;
export type ChangeSettingKey = (typeof CHANGE_SETTING_KEYS)[number];
export const CHANGE_SETTING_FA: Record<ChangeSettingKey, string> = {
  change_types_extra: "انواع سفارشی تغییر (افزونه بر ۱۱ نوع پایه)",
  workflow_defaults: "پیش‌فرض‌های گردش‌کار (مهلت بررسی)",
};
const EXTRA_TYPE_CODE = /^[a-z][a-z0-9_]{2,29}$/;

/** اعتبارسنجی مقدار تنظیم — تداخل با ۱۱ نوع پایه رد می‌شود؛ def رد و def همان def است (هیچ پیش‌فرض ساختگی). */
export function validateChangeSetting(key: string, value: unknown): { ok: true; normalized: unknown } | { ok: false; error: string } {
  if (key === "change_types_extra") {
    if (!Array.isArray(value)) return { ok: false, error: "change_types_extra باید آرایه‌ای از {code, fa} باشد" };
    if (value.length > 40) return { ok: false, error: "حداکثر ۴۰ نوع سفارشی مجاز است" };
    const seen = new Set<string>();
    for (const item of value as unknown[]) {
      const i = item as Record<string, unknown>;
      if (!i || typeof i !== "object" || Array.isArray(i)) return { ok: false, error: "هر نوع سفارشی باید آبجکت «{code, fa}» باشد" };
      const code = String(i.code ?? ""), fa = String(i.fa ?? "").trim();
      if (!EXTRA_TYPE_CODE.test(code)) return { ok: false, error: `code «${code}» نامعتبر است — حروف کوچک/عدد/_ با ۳ تا ۳۰ نویسه، شروع با حرف` };
      if (fa.length < 3 || fa.length > 80) return { ok: false, error: `عنوان فارسی «${code}» باید ۳ تا ۸۰ نویسه باشد` };
      if (CHANGE_TYPES.some((t) => t.code === code)) return { ok: false, error: `«${code}» با نوع پایه تداخل دارد — انواع پایه قابل بازتعریف نیستند` };
      if (seen.has(code)) return { ok: false, error: `code «${code}» در آرایه تکراری است` };
      seen.add(code);
    }
    return { ok: true, normalized: (value as Record<string, unknown>[]).map((i) => ({ code: String(i.code), fa: String(i.fa).trim() })) };
  }
  if (key === "workflow_defaults") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "workflow_defaults باید آبجکت باشد" };
    const raw = (value as Record<string, unknown>).reviewDueDays;
    /* بدون تبدیل خاموش رشته — فقط عدد واقعی صادق است */
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 365) return { ok: false, error: "reviewDueDays باید عدد صحیح بین ۱ تا ۳۶۵ باشد (نه رشته)" };
    return { ok: true, normalized: { reviewDueDays: raw } };
  }
  return { ok: false, error: `کلید تنظیم ناشناخته «${key}» — مقادیر مجاز: ${CHANGE_SETTING_KEYS.join(", ")}` };
}

/** انواع مؤثر = ۱۱ نوع پایه + سفارشی‌های معتبر (سفارشی نامعتبری که از خارج API وارد جدول شده باشد خودکار کنار گذاشته می‌شود). */
export function effectiveChangeTypes(extra: unknown): { code: string; fa: string }[] {
  const base: { code: string; fa: string }[] = CHANGE_TYPES.map((t) => ({ code: t.code, fa: t.fa }));
  if (!Array.isArray(extra)) return base;
  const legit = (extra as Record<string, unknown>[])
    .filter((i) => i && typeof i === "object" && !Array.isArray(i)
      && EXTRA_TYPE_CODE.test(String(i.code ?? ""))
      && !CHANGE_TYPES.some((t) => t.code === String(i.code ?? ""))
      && String(i.fa ?? "").trim().length >= 3)
    .map((i) => ({ code: String(i.code), fa: String(i.fa).trim() }));
  return [...base, ...legit];
}

/** مهلت بررسی مؤثر از workflow_defaults — بدون تنظیم null (رفتار pre-existing بدون تغییر باقی می‌ماند). */
export function effectiveReviewDueDays(v: unknown): number | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const raw = (v as Record<string, unknown>).reviewDueDays;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 365 ? raw : null;
}

/** افزایش N روز به تاریخ ISO (UTC-safe)؛ ورودی نامعتبر → null. */
export function addDaysIso(iso: string, days: number): string | null {
  if (!ISO_DATE.test(String(iso)) || !Number.isInteger(days)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
