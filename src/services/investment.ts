/* ══════════════════════════════════════════════════════════════════════
   INV-RISK-v1 — تحلیل سرمایه‌گذاریِ تعدیل‌شده با ریسک (دامنهٔ d4)

   زنجیرهٔ محاسبه:

     جریان نقدی  →  NPV / IRR / دوره بازگشت
        ↓ اعمالِ صرفِ ریسک از ثبتِ ریسک
     NPVِ تعدیل‌شده (Risk-adjusted NPV)
        ↓ سناریوها (بدبینانه / پایه / خوش‌بینانه با احتمال)
     NPVِ موردانتظار (Expected NPV)
        ↓ تحلیل حساسیت روی محرک‌ها
     نمودارِ تورنادو + تصمیمِ گیت

   چرا صرفِ ریسک جدا از نرخِ تنزیل است: نرخِ تنزیل سیاستِ مالیِ سازمان
   است و با هر پروژه عوض نمی‌شود؛ ریسکِ پروژه باید به‌صورتِ صریح و
   قابلِ بحث اعمال شود تا بشود پرسید «کدام ریسک این قدر ارزش کم کرد؟».
   ══════════════════════════════════════════════════════════════════════ */

export type Cashflow = { period: number; net: number };

export type RiskDriver = {
  id: string;
  name: { fa: string; en: string };
  /** شدتِ ریسک ۰ تا ۱۰۰ — از ثبت ریسک (احتمال × اثر). */
  score: number;
  /** سهمِ این ریسک از صرفِ ریسک (جمع ≈ ۱). */
  share: number;
};

export type InvestmentInput = {
  /** نرخ تنزیلِ سازمان (بدون ریسکِ پروژه). */
  discountRate: number;
  cashflows: Cashflow[];
  riskDrivers: RiskDriver[];
  /** حداکثر صرفِ ریسکِ قابل اعمال (مثلاً ۰.۰۶ یعنی ۶ واحد درصد). */
  maxRiskPremium: number;
};

/** NPV با دادهٔ جریان نقدی و نرخ تنزیل. */
export function npv(rate: number, flows: number[]): number {
  return flows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i), 0);
}

/** IRR با جست‌وجوی دودویی روی بازهٔ معقول. */
export function irr(flows: number[]): number | null {
  let lo = -0.9;
  let hi = 2;
  let fLo = npv(lo, flows);
  let fHi = npv(hi, flows);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 120; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, flows);
    if (Math.abs(fMid) < 1) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** دوره بازگشتِ ساده (اولین دوره‌ای که تجمعی مثبت می‌شود، با درون‌یابی). */
export function payback(flows: number[]): number | null {
  let cum = 0;
  for (let i = 0; i < flows.length; i += 1) {
    const prev = cum;
    cum += flows[i];
    if (cum >= 0 && prev < 0) return i - prev / (cum - prev);
  }
  return null;
}

export type ScenarioName = "pessimistic" | "base" | "optimistic";

export type Scenario = {
  name: ScenarioName;
  label: { fa: string; en: string };
  probability: number;
  /** ضریبِ اعمال‌شده بر جریان‌های مثبت (درآمد). */
  revenueFactor: number;
  /** ضریبِ اعمال‌شده بر جریان‌های منفی (هزینه). */
  costFactor: number;
};

export const SCENARIOS: Scenario[] = [
  { name: "pessimistic", label: { fa: "بدبینانه", en: "Pessimistic" }, probability: 0.25, revenueFactor: 0.9, costFactor: 1.12 },
  { name: "base", label: { fa: "پایه", en: "Base" }, probability: 0.5, revenueFactor: 1, costFactor: 1 },
  { name: "optimistic", label: { fa: "خوش‌بینانه", en: "Optimistic" }, probability: 0.25, revenueFactor: 1.1, costFactor: 0.95 },
];

export type SensitivityDriver = {
  id: string;
  label: { fa: string; en: string };
  /** ضریبِ اعمال‌شده بر جریان مثبت (درآمد) در حالتِ بد و خوب. */
  low: number;
  high: number;
};

export type InvestmentResult = {
  baseNpv: number;
  riskPremium: number;
  adjustedRate: number;
  riskAdjustedNpv: number;
  /** سهم هر ریسک در کاهشِ ارزش (برای نمودارِ تورنادوی ریسک). */
  riskContribution: { id: string; name: { fa: string; en: string }; value: number }[];
  internalRate: number | null;
  paybackPeriods: number | null;
  scenarios: { name: ScenarioName; label: { fa: string; en: string }; probability: number; npv: number; weighted: number }[];
  expectedNpv: number;
  sensitivity: { id: string; label: { fa: string; en: string }; lowNpv: number; highNpv: number; swing: number }[];
  decision: "go" | "conditional" | "no_go";
  decisionHint: { fa: string; en: string };
};

export function analyseInvestment(input: InvestmentInput): InvestmentResult {
  const flows = input.cashflows.map((c) => c.net);
  const baseNpv = npv(input.discountRate, flows);

  /* صرفِ ریسک: میانگینِ وزنیِ شدتِ ریسک، مقیاس‌شده به حداکثر صرف */
  const totalShare = input.riskDrivers.reduce((s, r) => s + r.share, 0) || 1;
  const weightedRisk = input.riskDrivers.reduce((s, r) => s + (r.score / 100) * (r.share / totalShare), 0);
  const riskPremium = weightedRisk * input.maxRiskPremium;
  const adjustedRate = input.discountRate + riskPremium;
  const riskAdjustedNpv = npv(adjustedRate, flows);

  /* سهمِ هر ریسک در افتِ ارزش — با تنزیلِ جداگانهٔ هر صرف */
  const riskContribution = input.riskDrivers.map((r) => {
    const sharePremium = (r.score / 100) * (r.share / totalShare) * input.maxRiskPremium;
    return {
      id: r.id,
      name: r.name,
      value: npv(input.discountRate + sharePremium, flows) - baseNpv,
    };
  });

  const scenarios = SCENARIOS.map((s) => {
    const f = flows.map((c) => (c >= 0 ? c * s.revenueFactor : c * s.costFactor));
    const v = npv(adjustedRate, f);
    return { name: s.name, label: s.label, probability: s.probability, npv: v, weighted: v * s.probability };
  });
  const expectedNpv = scenarios.reduce((sum, s) => sum + s.weighted, 0);

  const drivers: SensitivityDriver[] = [
    { id: "capex", label: { fa: "سرمایه‌گذاری اولیه", en: "CAPEX" }, low: 1.15, high: 0.9 },
    { id: "price", label: { fa: "قیمت/نرخ قرارداد", en: "Contract price" }, low: 0.9, high: 1.1 },
    { id: "schedule", label: { fa: "زمان‌بندی (تأخیر)", en: "Schedule slip" }, low: 0.92, high: 1.04 },
    { id: "opex", label: { fa: "هزینهٔ عملیاتی", en: "OPEX" }, low: 1.1, high: 0.94 },
  ];

  const sensitivity = drivers.map((d) => {
    const lowNpv = npv(adjustedRate, flows.map((c, i) => (i === 0 ? c * d.low : c >= 0 ? c * d.low : c * d.low)));
    const highNpv = npv(adjustedRate, flows.map((c) => (c >= 0 ? c * d.high : c * d.high)));
    return { id: d.id, label: d.label, lowNpv, highNpv, swing: Math.abs(highNpv - lowNpv) };
  }).sort((a, b) => b.swing - a.swing);

  const decision: InvestmentResult["decision"] =
    expectedNpv > 0 && riskAdjustedNpv > 0 ? "go" : expectedNpv > 0 ? "conditional" : "no_go";

  const hint: InvestmentResult["decisionHint"] =
    decision === "go"
      ? { fa: "هم NPVِ پایه و هم NPVِ تعدیل‌شده با ریسک مثبت است — مجوزِ سرمایه‌گذاری توصیه می‌شود.", en: "Both base and risk-adjusted NPV are positive — investment is recommended." }
      : decision === "conditional"
        ? { fa: "NPVِ موردانتظار مثبت است امّا پس از اعمالِ ریسک منفی می‌شود — مشروط به کاهشِ ریسک.", en: "Expected NPV is positive but risk-adjusted turns negative — conditional on risk mitigation." }
        : { fa: "NPVِ موردانتظار منفی است — در وضعیتِ فعلی توصیه نمی‌شود.", en: "Expected NPV is negative — not recommended as it stands." };

  return {
    baseNpv,
    riskPremium,
    adjustedRate,
    riskAdjustedNpv,
    riskContribution,
    internalRate: irr(flows),
    paybackPeriods: payback(flows),
    scenarios,
    expectedNpv,
    sensitivity,
    decision,
    decisionHint: hint,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   ظرفِ داده — جریان نقدیِ یک پروژهٔ EPC متوسط (ریال) و ریسک‌هایِ ثبت‌شده
   ══════════════════════════════════════════════════════════════════════ */

export const CASHFLOWS_SEED: Cashflow[] = [
  { period: 0, net: -1_850_000_000_000 },
  { period: 1, net: -620_000_000_000 },
  { period: 2, net: 480_000_000_000 },
  { period: 3, net: 910_000_000_000 },
  { period: 4, net: 1_240_000_000_000 },
  { period: 5, net: 1_180_000_000_000 },
  { period: 6, net: 960_000_000_000 },
  { period: 7, net: 720_000_000_000 },
];

export const RISK_DRIVERS_SEED: RiskDriver[] = [
  { id: "r-sched", name: { fa: "تأخیر در تأمین Long Lead", en: "Long-lead delivery delay" }, score: 72, share: 0.3 },
  { id: "r-price", name: { fa: "تعدیلِ نرخ و تورم مصالح", en: "Price escalation" }, score: 64, share: 0.25 },
  { id: "r-scope", name: { fa: "تغییر محدوده‌ی کارفرما", en: "Client scope change" }, score: 48, share: 0.2 },
  { id: "r-claim", name: { fa: "ادعا و اختلافِ قراردادی", en: "Claims & disputes" }, score: 55, share: 0.15 },
  { id: "r-hse", name: { fa: "حادثه و توقفِ کار", en: "Incident & stoppage" }, score: 38, share: 0.1 },
];

export const DISCOUNT_RATE_SEED = 0.18;
export const MAX_RISK_PREMIUM_SEED = 0.06;
