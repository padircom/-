/**
 * PMO-CONTRACT-RISK-ENGINE-V1.0 — موتور امتیازدهی و جمع‌بندی ریسک قراردادی.
 *
 * ContractRiskScoringEngine: احتمال (۱..۵) × اثر وزن‌دار پنج‌بعدی (۱..۵)
 * = امتیاز ذاتی ۱..۲۵؛ ریسک باقیمانده فقط از «اثربخشی کنترل مستند» کم
 * می‌شود، نه با کم‌کردن دستی عدد. قاعدهٔ امتیازدهی نسخه‌دار و قابل تنظیم
 * است و فقط نسخهٔ approved آن مبنای محاسبهٔ قطعی قرار می‌گیرد.
 * امتیاز ریسک هرگز به‌خودی‌خود مبلغ خسارت یا مدت تمدید تولید نمی‌کند.
 */

export const CONTRACT_RISK_ENGINE_VERSION = "contract-risk-v1";

/* ۱۵ دستهٔ پایهٔ ریسک قراردادی (قابل توسعه از طریق ثبت دستهٔ other). */
export const CONTRACT_RISK_CATEGORIES = [
  { code: "payment_cashflow", labelFa: "ریسک پرداخت و جریان نقدی" },
  { code: "delay_eot", labelFa: "ریسک تأخیرات و تمدید مدت" },
  { code: "variation_scope", labelFa: "ریسک تغییر مقادیر و محدودهٔ کار" },
  { code: "scope_ambiguity", labelFa: "ریسک ابهام در شرح خدمات و تعهدات" },
  { code: "price_adjustment", labelFa: "ریسک تعدیل و تغییر قیمت" },
  { code: "procurement_supply", labelFa: "ریسک تأمین کالا و تجهیزات" },
  { code: "quality_acceptance", labelFa: "ریسک کیفیت و پذیرش کار" },
  { code: "guarantee_bond", labelFa: "ریسک تضمین‌ها و ضمانت‌نامه‌ها" },
  { code: "insurance_liability", labelFa: "ریسک بیمه و مسئولیت" },
  { code: "legal_regulatory", labelFa: "ریسک تغییر قوانین و مقررات" },
  { code: "suspension_termination", labelFa: "ریسک تعلیق و خاتمهٔ قرارداد" },
  { code: "dispute_claim", labelFa: "ریسک حل اختلاف و ادعا" },
  { code: "site_access", labelFa: "ریسک تحویل جبههٔ کار و دسترسی" },
  { code: "noncompliance", labelFa: "ریسک عدم انطباق با الزامات قراردادی" },
  { code: "other", labelFa: "سایر ریسک‌های قراردادی" },
] as const;

export const PROBABILITY_LABELS_FA: Record<number, string> = { 1: "بسیار کم", 2: "کم", 3: "متوسط", 4: "زیاد", 5: "بسیار زیاد" };
export const IMPACT_LABELS_FA: Record<number, string> = { 1: "ناچیز", 2: "کم", 3: "متوسط", 4: "زیاد", 5: "بحرانی" };

export type RiskBand = "low" | "medium" | "high" | "critical";
export const BAND_LABELS_FA: Record<RiskBand, string> = { low: "پایین", medium: "متوسط", high: "بالا", critical: "بحرانی" };

export type ScoringConfig = {
  version: string;
  /* وزن پنج بعد اثر؛ مجموع باید ۱ باشد. */
  impactWeights: { time: number; financial: number; legal: number; operational: number; quality: number };
  /* آستانه‌های طبقه‌بندی امتیاز ۱..۲۵ */
  bands: { critical: number; high: number; medium: number };
  /* ضریب کاهش امتیاز باقیمانده بر اساس اثربخشی کنترل */
  controlEffects: { none: number; weak: number; partial: number; strong: number };
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  version: "contract-risk-scoring-v1",
  impactWeights: { time: 0.25, financial: 0.25, legal: 0.2, operational: 0.15, quality: 0.15 },
  bands: { critical: 15, high: 10, medium: 5 },
  controlEffects: { none: 0, weak: 0.15, partial: 0.35, strong: 0.6 },
};

export type RiskScoringInput = {
  probability?: number | null;
  impactTime?: number | null;
  impactFinancial?: number | null;
  impactLegal?: number | null;
  impactOperational?: number | null;
  impactQuality?: number | null;
  controlEffectiveness?: string | null; /* none|weak|partial|strong */
  controlEvidenceRefs?: unknown;
};

export type RiskScoringResult = {
  engine: string;
  scoringVersion: string;
  configApproved: boolean;
  status: "scored" | "needs_review";
  weightedImpact: number | null;
  inherentScore: number | null;
  inherentBand: RiskBand | null;
  controlEffectApplied: number;
  residualScore: number | null;
  residualBand: RiskBand | null;
  rationaleFa: string[];
  suggestedStrategy: "avoid" | "mitigate" | "transfer" | "accept" | "exploit" | null;
  suggestedActionFa: string | null;
};

const clampScale = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 5 ? Math.round(v) : null;

export function bandOf(score: number, config: ScoringConfig): RiskBand {
  if (score >= config.bands.critical) return "critical";
  if (score >= config.bands.high) return "high";
  if (score >= config.bands.medium) return "medium";
  return "low";
}

/** ContractRiskScoringEngine — ارزیابی ذاتی و باقیماندهٔ یک ریسک. */
export function evaluateContractRisk(input: RiskScoringInput, config: ScoringConfig = DEFAULT_SCORING_CONFIG, configApproved = true): RiskScoringResult {
  const rationaleFa: string[] = [];
  const p = clampScale(input.probability ?? null);
  const dims = {
    time: clampScale(input.impactTime ?? null),
    financial: clampScale(input.impactFinancial ?? null),
    legal: clampScale(input.impactLegal ?? null),
    operational: clampScale(input.impactOperational ?? null),
    quality: clampScale(input.impactQuality ?? null),
  };
  const base: RiskScoringResult = {
    engine: CONTRACT_RISK_ENGINE_VERSION, scoringVersion: config.version, configApproved,
    status: "needs_review", weightedImpact: null, inherentScore: null, inherentBand: null,
    controlEffectApplied: 0, residualScore: null, residualBand: null,
    rationaleFa, suggestedStrategy: null, suggestedActionFa: null,
  };
  if (p === null) { rationaleFa.push("احتمال وقوع ثبت نشده است؛ ارزیابی کامل نیست."); return base; }
  const present = Object.entries(dims).filter(([, v]) => v !== null) as [keyof typeof dims, number][];
  if (!present.length) { rationaleFa.push("هیچ‌یک از ابعاد اثر ارزیابی نشده است."); return base; }
  /* وزن‌ها فقط روی ابعاد موجود نرمال می‌شوند تا دادهٔ ناقص صفرِ کاذب نسازد. */
  const wSum = present.reduce((s, [k]) => s + config.impactWeights[k], 0);
  const weightedImpact = present.reduce((s, [k, v]) => s + v * (config.impactWeights[k] / wSum), 0);
  if (present.length < 5) rationaleFa.push(`اثر فقط در ${present.length} بعد از ۵ بعد ارزیابی شده و وزن‌ها روی همان ابعاد نرمال شده‌اند.`);
  const inherentScore = Math.round(p * weightedImpact * 100) / 100;
  const inherentBand = bandOf(inherentScore, config);
  rationaleFa.push(`امتیاز ذاتی = احتمال ${p} (${PROBABILITY_LABELS_FA[p]}) × اثر وزن‌دار ${Math.round(weightedImpact * 100) / 100} = ${inherentScore} ← رتبهٔ ${BAND_LABELS_FA[inherentBand]}.`);

  /* باقیمانده: کنترلِ بدون شاهد، حداکثر «ضعیف» اثر می‌گذارد. */
  const hasEvidence = Array.isArray(input.controlEvidenceRefs) && input.controlEvidenceRefs.length > 0;
  let effKey = (input.controlEffectiveness ?? "none") as keyof ScoringConfig["controlEffects"];
  if (!(effKey in config.controlEffects)) effKey = "none";
  if ((effKey === "partial" || effKey === "strong") && !hasEvidence) {
    rationaleFa.push("برای کنترل، شاهد اجرایی ثبت نشده است؛ اثربخشی در سطح «ضعیف» محدود شد.");
    effKey = "weak";
  }
  const effect = config.controlEffects[effKey];
  const residualScore = Math.round(inherentScore * (1 - effect) * 100) / 100;
  const residualBand = bandOf(residualScore, config);
  rationaleFa.push(effect > 0
    ? `کنترل موجود با اثربخشی «${effKey}» امتیاز را ${Math.round(effect * 100)}٪ کاهش داد: باقیمانده ${residualScore} (${BAND_LABELS_FA[residualBand]}).`
    : "کنترل مؤثر مستندی ثبت نشده است؛ امتیاز باقیمانده برابر امتیاز ذاتی است.");

  const strategy = inherentBand === "critical" ? "avoid" : inherentBand === "high" ? "mitigate" : inherentBand === "medium" ? "mitigate" : "accept";
  const actionFa = inherentBand === "critical"
    ? "اقدام فوری: اجتناب یا انتقال ریسک، تعیین مالک و بازبینی هفتگی تا خروج از وضعیت بحرانی."
    : inherentBand === "high"
      ? "برنامهٔ کاهش با مسئول و موعد مشخص تعریف و اثربخشی آن پس از اجرا دوباره ارزیابی شود."
      : inherentBand === "medium"
        ? "کنترل پیشگیرانه و پایش دوره‌ای در بازبینی بعدی انجام شود."
        : "پذیرش آگاهانه با پایش دوره‌ای کافی است.";
  if (!configApproved) rationaleFa.push("قاعدهٔ امتیازدهی مصوب نیست؛ نتیجه صرفاً برآورد اولیه است و رتبهٔ قطعی محسوب نمی‌شود.");
  return { ...base, status: configApproved ? "scored" : "needs_review", weightedImpact: Math.round(weightedImpact * 100) / 100, inherentScore, inherentBand, controlEffectApplied: effect, residualScore, residualBand, suggestedStrategy: strategy as RiskScoringResult["suggestedStrategy"], suggestedActionFa: actionFa };
}

export type ContractRiskLike = {
  Code?: string; Status?: string; Category?: string; Owner?: string | null;
  InherentBand?: string | null; ResidualBand?: string | null; InherentScore?: number | null; ResidualScore?: number | null;
  Probability?: number | null; ClauseRef?: string | null; ClaimCode?: string | null; ControlEffectiveness?: string | null;
};

export type ContractRiskActionLike = { RiskCode?: string; Status?: string; DueDate?: string | null };
export type ObligationLike = { Status?: string; DueDate?: string | null };
export type ImprovementLike = { Status?: string };

/** جمع‌بندی مرکز کنترل ریسک قراردادی — فقط از دادهٔ واقعی. */
export function summarizeContractRiskPortfolio(
  risks: ContractRiskLike[], actions: ContractRiskActionLike[], obligations: ObligationLike[],
  improvements: ImprovementLike[], findingsPending = 0, todayIso: string,
) {
  const open = risks.filter((r) => r.Status !== "closed");
  const bandCount = (key: "InherentBand" | "ResidualBand", band: RiskBand) => open.filter((r) => r[key] === band).length;
  const matrix: Record<string, number> = {};
  for (const r of open) {
    const p = r.Probability ?? 0;
    const imp = r.InherentScore && r.Probability ? Math.round(r.InherentScore / Math.max(1, r.Probability)) : 0;
    if (p >= 1 && imp >= 1) matrix[`${p}x${imp}`] = (matrix[`${p}x${imp}`] ?? 0) + 1;
  }
  const overdueActions = actions.filter((a) => a.Status !== "done" && a.Status !== "cancelled" && a.DueDate && a.DueDate < todayIso);
  return {
    totalRisks: risks.length,
    openRisks: open.length,
    critical: bandCount("InherentBand", "critical"),
    high: bandCount("InherentBand", "high"),
    medium: bandCount("InherentBand", "medium"),
    low: bandCount("InherentBand", "low"),
    residualCritical: bandCount("ResidualBand", "critical"),
    residualHigh: bandCount("ResidualBand", "high"),
    unassessed: open.filter((r) => r.InherentScore === null || r.InherentScore === undefined).length,
    ownerless: open.filter((r) => !r.Owner).length,
    inadequateControl: open.filter((r) => !r.ControlEffectiveness || r.ControlEffectiveness === "none").length,
    clausesNeedingReview: findingsPending,
    improvementsPendingApproval: improvements.filter((i) => i.Status === "pending_approval" || i.Status === "needs_review").length,
    linkedActiveClaims: open.filter((r) => r.ClaimCode).length,
    overdueActions: overdueActions.length,
    overdueObligations: obligations.filter((o) => o.Status === "pending" && o.DueDate && o.DueDate < todayIso).length,
    matrix,
    criticalList: open.filter((r) => r.InherentBand === "critical" || r.InherentBand === "high").slice(0, 20),
  };
}
