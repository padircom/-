/* ══════════════════════════════════════════════════════════════════════
   VEN-RATE-v1 — ارزیابی پیمانکاران و تأمین‌کنندگان (دامنهٔ d14)

   مدلِ امتیازدهی وزنی روی شش محور (جمعِ وزن‌ها = ۱۰۰):
     ایمنی (HSE) ۲۰ · کیفیت ۲۰ · زمان ۲۰ · قیمت ۱۵ · مستندات ۱۵ · همکاری ۱۰

   خروجی فقط یک عدد نیست: رتبهٔ کیفی (A تا D)، روند نسبت به دورهٔ قبل،
   و «کمترین محور» که باید در برنامهٔ بهبود هدف گرفته شود.

   امتیازِ خامِ هر محور بین ۰ تا ۱۰۰ است و وزن‌ها در `RATING_WEIGHTS`
   متمرکزند تا تغییرِ سیاستِ ارزیابی یک‌جا انجام شود.
   ══════════════════════════════════════════════════════════════════════ */

export type AxisCode = "hse" | "quality" | "time" | "price" | "docs" | "coop";

export const RATING_AXES: { code: AxisCode; label: { fa: string; en: string }; weight: number }[] = [
  { code: "hse", label: { fa: "ایمنی (HSE)", en: "HSE" }, weight: 20 },
  { code: "quality", label: { fa: "کیفیت", en: "Quality" }, weight: 20 },
  { code: "time", label: { fa: "زمان", en: "Schedule" }, weight: 20 },
  { code: "price", label: { fa: "قیمت", en: "Price" }, weight: 15 },
  { code: "docs", label: { fa: "مستندات", en: "Documentation" }, weight: 15 },
  { code: "coop", label: { fa: "همکاری", en: "Cooperation" }, weight: 10 },
];

export const RATING_WEIGHTS: Record<AxisCode, number> = RATING_AXES.reduce(
  (acc, a) => ({ ...acc, [a.code]: a.weight }),
  {} as Record<AxisCode, number>,
);

export type Party = {
  id: string;
  name: { fa: string; en: string };
  kind: "contractor" | "supplier";
  /** امتیازِ خامِ هر محور (۰ تا ۱۰۰). */
  scores: Record<AxisCode, number>;
  /** امتیازِ دورهٔ قبل برای محاسبهٔ روند (اختیاری). */
  previousScore?: number;
  /** ارزشِ قرارداد/سفارشِ جاری به ریال — برای وزن‌دهیِ ریسک. */
  contractValue: number;
  active: boolean;
};

export type RatingResult = {
  id: string;
  name: { fa: string; en: string };
  kind: Party["kind"];
  weighted: number;
  grade: "A" | "B" | "C" | "D";
  trend: number | null;
  weakest: AxisCode;
  strongest: AxisCode;
  active: boolean;
  contractValue: number;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const TOTAL_WEIGHT = RATING_AXES.reduce((s, a) => s + a.weight, 0);

export function rateParty(p: Party): RatingResult {
  const weighted =
    RATING_AXES.reduce((s, a) => s + clamp(p.scores[a.code] ?? 0) * a.weight, 0) / TOTAL_WEIGHT;

  const axes = RATING_AXES.map((a) => ({ code: a.code, v: clamp(p.scores[a.code] ?? 0) }));
  const weakest = axes.reduce((m, x) => (x.v < m.v ? x : m), axes[0]).code;
  const strongest = axes.reduce((m, x) => (x.v > m.v ? x : m), axes[0]).code;

  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    weighted: Math.round(weighted),
    grade: weighted >= 85 ? "A" : weighted >= 70 ? "B" : weighted >= 55 ? "C" : "D",
    trend: typeof p.previousScore === "number" ? Math.round(weighted - p.previousScore) : null,
    weakest,
    strongest,
    active: p.active,
    contractValue: p.contractValue,
  };
}

export function rateAll(parties: Party[]): RatingResult[] {
  return parties.map(rateParty).sort((a, b) => b.weighted - a.weighted);
}

export type PortfolioSummary = {
  count: number;
  average: number;
  gradeCounts: Record<"A" | "B" | "C" | "D", number>;
  watchlist: number;
  /** ارزشِ قراردادهایِ زیرِ آستانهٔ C — ریسکِ مالیِ در معرض. */
  valueAtRisk: number;
};

export function portfolioSummary(results: RatingResult[]): PortfolioSummary {
  const gradeCounts: Record<"A" | "B" | "C" | "D", number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of results) if (r.active) gradeCounts[r.grade] += 1;
  const active = results.filter((r) => r.active);
  return {
    count: active.length,
    average: active.length ? Math.round(active.reduce((s, r) => s + r.weighted, 0) / active.length) : 0,
    gradeCounts,
    watchlist: gradeCounts.C + gradeCounts.D,
    valueAtRisk: active.filter((r) => r.grade === "C" || r.grade === "D").reduce((s, r) => s + r.contractValue, 0),
  };
}

/* ══════════════════════════════════════════════════════════════════════
   ظرفِ داده — تا اتصال جداول Vendor / Contractor_Performance
   ══════════════════════════════════════════════════════════════════════ */

export const PARTY_SEED: Party[] = [
  { id: "v1", name: { fa: "پیمانکار ابنیه البرز", en: "Alborz Civil Contractor" }, kind: "contractor", scores: { hse: 88, quality: 82, time: 74, price: 70, docs: 78, coop: 85 }, previousScore: 79, contractValue: 1_250_000_000_000, active: true },
  { id: "v2", name: { fa: "پیمانکار نصب مکانیک پیشگام", en: "Pishgam Mechanical Erection" }, kind: "contractor", scores: { hse: 92, quality: 88, time: 80, price: 66, docs: 84, coop: 78 }, previousScore: 81, contractValue: 980_000_000_000, active: true },
  { id: "v3", name: { fa: "تأمین‌کننده لوله کربن‌استیل", en: "CS Pipe Supplier" }, kind: "supplier", scores: { hse: 74, quality: 70, time: 58, price: 82, docs: 64, coop: 72 }, previousScore: 71, contractValue: 430_000_000_000, active: true },
  { id: "v4", name: { fa: "تأمین‌کننده کابل و تجهیز برق", en: "Cable & Electrical Supplier" }, kind: "supplier", scores: { hse: 80, quality: 86, time: 76, price: 62, docs: 80, coop: 68 }, previousScore: 74, contractValue: 275_000_000_000, active: true },
  { id: "v5", name: { fa: "پیمانکار رنگ و عایق صنعتی", en: "Industrial Painting & Insulation" }, kind: "contractor", scores: { hse: 58, quality: 60, time: 52, price: 74, docs: 55, coop: 60 }, previousScore: 63, contractValue: 190_000_000_000, active: true },
  { id: "v6", name: { fa: "تأمین‌کننده قطعات یدکی ماشین‌آلات", en: "Machinery Spare Parts Supplier" }, kind: "supplier", scores: { hse: 70, quality: 64, time: 66, price: 78, docs: 60, coop: 74 }, previousScore: 68, contractValue: 95_000_000_000, active: false },
];
