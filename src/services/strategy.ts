/* ══════════════════════════════════════════════════════════════════════
   STRAT-v1 — مدیریت استراتژیک (دامنهٔ d20)

   سه لایه که معمولاً در سازمان‌ها از هم جدا می‌افتند و اینجا به هم
   گره می‌خورند:

     هدفِ استراتژیک  →  شاخص (با وزن و هدفِ کمّی)  →  ابتکار/پروژه

   محاسبه‌ها:
     · تحققِ هر هدف = میانگینِ وزنیِ تحققِ شاخص‌هایش
     · تحققِ هر منظرِ BSC = میانگینِ وزنیِ اهدافِ آن منظر
     · تحققِ کلِ استراتژی = میانگینِ وزنیِ چهار منظر
     · ابتکارات با بیشترین «اثرِ وزنی» و کمترین پیشرفت → اولویتِ مداخله

   خروجیِ اصلی تصمیم است: کدام هدف از مسیر خارج شده و کدام ابتکار
   بیشترین اثر را بر آن دارد.
   ══════════════════════════════════════════════════════════════════════ */

export type Perspective = "financial" | "customer" | "process" | "learning";

export const PERSPECTIVES: { code: Perspective; label: { fa: string; en: string }; weight: number }[] = [
  { code: "financial", label: { fa: "مالی", en: "Financial" }, weight: 30 },
  { code: "customer", label: { fa: "مشتری و ذی‌نفعان", en: "Customer & Stakeholders" }, weight: 25 },
  { code: "process", label: { fa: "فرآیندهای داخلی", en: "Internal Processes" }, weight: 25 },
  { code: "learning", label: { fa: "یادگیری و رشد", en: "Learning & Growth" }, weight: 20 },
];

export type Kpi = {
  id: string;
  name: { fa: string; en: string };
  unit: { fa: string; en: string };
  baseline: number;
  target: number;
  actual: number;
  /** جهتِ مطلوب: بالاتر بهتر است یا پایین‌تر؟ */
  direction: "up" | "down";
  /** وزنِ شاخص درون هدف (معمولاً جمعِ وزن‌های یک هدف = ۱۰۰). */
  weight: number;
};

export type Objective = {
  id: string;
  title: { fa: string; en: string };
  perspective: Perspective;
  /** وزنِ هدف درون منظر (جمعِ وزن‌های هر منظر ≈ ۱۰۰). */
  weight: number;
  kpis: Kpi[];
};

export type Initiative = {
  id: string;
  name: { fa: string; en: string };
  /** اهدافی که این ابتکار پشتیبانی می‌کند. */
  objectives: string[];
  progress: number;
  budget: number;
  spent: number;
  status: "on_track" | "at_risk" | "delayed";
};

export type KpiResult = Kpi & {
  /** درصدِ تحققِ شاخص (۰ تا ۱)؛ برای شاخص‌های معکوس هم درست کار می‌کند. */
  attainment: number;
  offTrack: boolean;
};

export type ObjectiveResult = {
  id: string;
  title: { fa: string; en: string };
  perspective: Perspective;
  weight: number;
  attainment: number;
  offTrack: boolean;
  kpis: KpiResult[];
  /** اثرِ این هدف بر تحققِ کل (وزنِ هدف × وزنِ منظر ÷ ۱۰۰). */
  leverage: number;
};

export type PerspectiveResult = {
  code: Perspective;
  label: { fa: string; en: string };
  weight: number;
  attainment: number;
  objectives: ObjectiveResult[];
};

export type StrategyResult = {
  perspectives: PerspectiveResult[];
  attainment: number;
  offTrackObjectives: ObjectiveResult[];
  /** ابتکارات به ترتیبِ اولویتِ مداخله (اثر بالا، پیشرفت پایین). */
  priorityInitiatives: (Initiative & { impact: number })[];
  budgetUtilisation: number;
};

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

/** تحققِ یک شاخص: پیشرفت از مبنا به سمتِ هدف، با رعایتِ جهت. */
export function kpiAttainment(k: Kpi): number {
  const span = k.target - k.baseline;
  if (span === 0) return k.actual === k.target ? 1 : 0;
  const raw = (k.actual - k.baseline) / span;
  return clamp(k.direction === "up" ? raw : raw);
}

export function evaluateStrategy(
  objectives: Objective[],
  initiatives: Initiative[],
): StrategyResult {
  const pWeight = Object.fromEntries(PERSPECTIVES.map((p) => [p.code, p.weight])) as Record<Perspective, number>;

  const objResults: ObjectiveResult[] = objectives.map((o) => {
    const kpis: KpiResult[] = o.kpis.map((k) => {
      const attainment = kpiAttainment(k);
      return { ...k, attainment, offTrack: attainment < 0.9 };
    });
    const wSum = kpis.reduce((s, k) => s + k.weight, 0) || 1;
    const attainment = kpis.reduce((s, k) => s + k.attainment * k.weight, 0) / wSum;
    return {
      id: o.id,
      title: o.title,
      perspective: o.perspective,
      weight: o.weight,
      attainment,
      offTrack: attainment < 0.9,
      kpis,
      leverage: (o.weight * (pWeight[o.perspective] ?? 0)) / 100,
    };
  });

  const perspectives: PerspectiveResult[] = PERSPECTIVES.map((p) => {
    const objs = objResults.filter((o) => o.perspective === p.code);
    const wSum = objs.reduce((s, o) => s + o.weight, 0) || 1;
    const attainment = objs.reduce((s, o) => s + o.attainment * o.weight, 0) / wSum;
    return { code: p.code, label: p.label, weight: p.weight, attainment, objectives: objs };
  });

  const attainment = perspectives.reduce((s, p) => s + p.attainment * p.weight, 0) /
    (PERSPECTIVES.reduce((s, p) => s + p.weight, 0) || 1);

  const budget = initiatives.reduce((s, i) => s + i.budget, 0);
  const spent = initiatives.reduce((s, i) => s + i.spent, 0);

  const priorityInitiatives = initiatives
    .map((i) => {
      const linked = objResults.filter((o) => i.objectives.includes(o.id));
      const impact = linked.reduce((s, o) => s + o.leverage * (1 - o.attainment), 0);
      return { ...i, impact };
    })
    .sort((a, b) => b.impact * (1 - b.progress / 100) - a.impact * (1 - a.progress / 100));

  return {
    perspectives,
    attainment,
    offTrackObjectives: objResults.filter((o) => o.offTrack).sort((a, b) => b.leverage - a.leverage),
    priorityInitiatives,
    budgetUtilisation: safeDiv(spent, budget),
  };
}

/* ══════════════════════════════════════════════════════════════════════
   ظرفِ داده — نقشه‌ی استراتژیِ نمونه (پنج هدف، چهار منظر، شش ابتکار)
   ══════════════════════════════════════════════════════════════════════ */

export const OBJECTIVES_SEED: Objective[] = [
  {
    id: "o1",
    title: { fa: "افزایش حاشیهٔ سود پرتفوی", en: "Grow portfolio margin" },
    perspective: "financial",
    weight: 55,
    kpis: [
      { id: "k1", name: { fa: "حاشیهٔ ناخالص", en: "Gross margin" }, unit: { fa: "درصد", en: "%" }, baseline: 8.5, target: 12, actual: 10.2, direction: "up", weight: 60 },
      { id: "k2", name: { fa: "انحراف هزینه از بودجه", en: "Cost variance" }, unit: { fa: "درصد", en: "%" }, baseline: 6.4, target: 2, actual: 4.1, direction: "down", weight: 40 },
    ],
  },
  {
    id: "o2",
    title: { fa: "تثبیت جریان نقد و وصولی", en: "Stabilise cash & collection" },
    perspective: "financial",
    weight: 45,
    kpis: [
      { id: "k3", name: { fa: "دوره وصول مطالبات", en: "DSO" }, unit: { fa: "روز", en: "days" }, baseline: 96, target: 60, actual: 71, direction: "down", weight: 70 },
      { id: "k4", name: { fa: "درصدِ صورت‌وضعیت‌های به‌موقع", en: "On-time IPC rate" }, unit: { fa: "درصد", en: "%" }, baseline: 62, target: 90, actual: 78, direction: "up", weight: 30 },
    ],
  },
  {
    id: "o3",
    title: { fa: "رضایت و وفاداری کارفرمایان", en: "Client satisfaction & loyalty" },
    perspective: "customer",
    weight: 60,
    kpis: [
      { id: "k5", name: { fa: "شاخص رضایت کارفرما", en: "Client satisfaction index" }, unit: { fa: "از ۱۰۰", en: "of 100" }, baseline: 68, target: 85, actual: 79, direction: "up", weight: 70 },
      { id: "k6", name: { fa: "تکرار قرارداد", en: "Repeat contract rate" }, unit: { fa: "درصد", en: "%" }, baseline: 34, target: 55, actual: 41, direction: "up", weight: 30 },
    ],
  },
  {
    id: "o4",
    title: { fa: "بلوغِ مدیریت پروژه و کنترل", en: "Project management maturity" },
    perspective: "process",
    weight: 60,
    kpis: [
      { id: "k7", name: { fa: "رعایتِ برنامهٔ زمان‌بندی (SPI)", en: "SPI compliance" }, unit: { fa: "نسبت", en: "ratio" }, baseline: 0.82, target: 1, actual: 0.93, direction: "up", weight: 50 },
      { id: "k8", name: { fa: "نرخِ بستنِ به‌موقع NCR", en: "On-time NCR closure" }, unit: { fa: "درصد", en: "%" }, baseline: 54, target: 90, actual: 83, direction: "up", weight: 50 },
    ],
  },
  {
    id: "o5",
    title: { fa: "توانمندسازی و نگهداشت نیرو", en: "Empower & retain people" },
    perspective: "learning",
    weight: 100,
    kpis: [
      { id: "k9", name: { fa: "گردشِ نیروی کلیدی", en: "Key talent turnover" }, unit: { fa: "درصد", en: "%" }, baseline: 14, target: 8, actual: 11, direction: "down", weight: 50 },
      { id: "k10", name: { fa: "ساعت آموزش به‌ازای نفر", en: "Training hours per head" }, unit: { fa: "ساعت", en: "hours" }, baseline: 18, target: 40, actual: 27, direction: "up", weight: 50 },
    ],
  },
];

export const INITIATIVES_SEED: Initiative[] = [
  { id: "i1", name: { fa: "استقرار کنترلِ هزینهٔ برخط", en: "Online cost control rollout" }, objectives: ["o1", "o4"], progress: 62, budget: 42_000_000_000, spent: 27_500_000_000, status: "on_track" },
  { id: "i2", name: { fa: "بهبود چرخهٔ صورت‌وضعیت", en: "IPC cycle improvement" }, objectives: ["o2"], progress: 45, budget: 18_000_000_000, spent: 9_800_000_000, status: "at_risk" },
  { id: "i3", name: { fa: "برنامهٔ وفاداری کارفرمایان کلیدی", en: "Key account programme" }, objectives: ["o3"], progress: 30, budget: 12_500_000_000, spent: 4_200_000_000, status: "at_risk" },
  { id: "i4", name: { fa: "استانداردسازی فرآیندهای کنترل پروژه", en: "Project controls standardisation" }, objectives: ["o4"], progress: 71, budget: 26_000_000_000, spent: 19_100_000_000, status: "on_track" },
  { id: "i5", name: { fa: "آکادمی مهارت و مسیرِ شغلی", en: "Skills academy & career path" }, objectives: ["o5"], progress: 38, budget: 21_000_000_000, spent: 8_600_000_000, status: "delayed" },
  { id: "i6", name: { fa: "داشبورد یکپارچهٔ پورتفولیو", en: "Unified portfolio dashboard" }, objectives: ["o1", "o2", "o4"], progress: 54, budget: 15_500_000_000, spent: 9_300_000_000, status: "on_track" },
];
