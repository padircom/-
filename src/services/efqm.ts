/* ══════════════════════════════════════════════════════════════════════
   EFQM-v1 — ارزیابی تعالی سازمانی (مدل EFQM ۲۰۲۰) — دامنهٔ d19

   سه محور + شش معیارِ توانمندساز (۵۰۰ امتیاز) و سه معیارِ نتایج (۵۰۰):

     رهبری ۱۰۰ · استراتژی ۱۰۰ · کارکنان ۱۰۰ · شراکت‌ها و منابع ۱۰۰
     فرآیندها، محصولات و خدمات ۱۰۰
     نتایجِ کارکنان ۱۰۰ · نتایجِ مشتریان ۱۵۰ · نتایجِ جامعه ۱۰۰
     نتایجِ کسب‌وکار ۱۵۰

   منطقِ RADAR: برای معیارهای توانمندساز میانگینِ «رویکرد» و «استقرار»،
   و برای معیارهای نتایج میانگینِ «ربط و کاربرد» و «عملکرد». امتیازِ هر
   معیار = میانگینِ RADAR × وزن ÷ ۱۰۰.

   عددِ نهایی روی مقیاس ۰ تا ۱۰۰۰ است تا با ادبیاتِ EFQM هم‌خوان باشد.
   ══════════════════════════════════════════════════════════════════════ */

export type CriterionKind = "enabler" | "result";

export type Criterion = {
  code: string;
  label: { fa: string; en: string };
  kind: CriterionKind;
  /** وزن روی مقیاس ۰ تا ۱۰۰۰ (جمع کل = ۱۰۰۰). */
  weight: number;
  /** توضیحِ کوتاه برای راهنماییِ ارزیاب. */
  hint: { fa: string; en: string };
};

export const EFQM_CRITERIA: Criterion[] = [
  { code: "C1", label: { fa: "رهبری", en: "Leadership" }, kind: "enabler", weight: 100, hint: { fa: "هدف، الهام‌بخشی و رفتارِ رهبران", en: "purpose, inspiration and leader behaviour" } },
  { code: "C2", label: { fa: "استراتژی", en: "Strategy" }, kind: "enabler", weight: 100, hint: { fa: "تدوین و اجرای استراتژی", en: "strategy design and execution" } },
  { code: "C3", label: { fa: "کارکنان", en: "People" }, kind: "enabler", weight: 100, hint: { fa: "جذب، توانمندسازی و نگهداشت", en: "attract, empower and retain" } },
  { code: "C4", label: { fa: "شراکت‌ها و منابع", en: "Partnerships & Resources" }, kind: "enabler", weight: 100, hint: { fa: "مدیریت شرکا، منابع و فناوری", en: "manage partners, resources and technology" } },
  { code: "C5", label: { fa: "فرآیندها، محصولات و خدمات", en: "Processes, Products & Services" }, kind: "enabler", weight: 100, hint: { fa: "طراحی، بهبود و نوآوری", en: "design, improvement and innovation" } },
  { code: "R1", label: { fa: "نتایجِ کارکنان", en: "People Results" }, kind: "result", weight: 100, hint: { fa: "برداشت و شاخص‌های کارکنان", en: "perception and performance indicators" } },
  { code: "R2", label: { fa: "نتایجِ مشتریان", en: "Customer Results" }, kind: "result", weight: 150, hint: { fa: "رضایت، وفاداری و شاخص‌ها", en: "satisfaction, loyalty and indicators" } },
  { code: "R3", label: { fa: "نتایجِ جامعه", en: "Society Results" }, kind: "result", weight: 100, hint: { fa: "اثرِ اجتماعی و زیست‌محیطی", en: "social and environmental impact" } },
  { code: "R4", label: { fa: "نتایجِ کسب‌وکار", en: "Business Results" }, kind: "result", weight: 150, hint: { fa: "نتایجِ مالی و عملیاتی", en: "financial and operational results" } },
];

export type RadarScore = {
  /** توانمندسازها: رویکرد / استقرار — نتایج: ربط و کاربرد / عملکرد (۰ تا ۱۰۰). */
  a: number;
  b: number;
};

export type Assessment = Record<string, RadarScore>;

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export type CriterionResult = {
  code: string;
  label: { fa: string; en: string };
  kind: CriterionKind;
  weight: number;
  radar: RadarScore;
  /** امتیازِ میانگینِ RADAR (۰ تا ۱۰۰). */
  radarAvg: number;
  /** سهمِ این معیار از ۱۰۰۰. */
  points: number;
  /** درصدِ تحقق نسبت به وزن. */
  attainmentPct: number;
};

export type EfqmResult = {
  lines: CriterionResult[];
  total: number;
  maxTotal: number;
  enablerPoints: number;
  resultPoints: number;
  level: { fa: string; en: string };
  weakest: CriterionResult | null;
  strongest: CriterionResult | null;
};

export function assess(a: Assessment): EfqmResult {
  const lines: CriterionResult[] = EFQM_CRITERIA.map((c) => {
    const r = a[c.code] ?? { a: 0, b: 0 };
    const radarAvg = (clamp(r.a) + clamp(r.b)) / 2;
    return {
      code: c.code,
      label: c.label,
      kind: c.kind,
      weight: c.weight,
      radar: { a: clamp(r.a), b: clamp(r.b) },
      radarAvg,
      points: Math.round((radarAvg * c.weight) / 100),
      attainmentPct: radarAvg,
    };
  });

  const total = lines.reduce((s, l) => s + l.points, 0);
  const maxTotal = EFQM_CRITERIA.reduce((s, c) => s + c.weight, 0);
  const enablerPoints = lines.filter((l) => l.kind === "enabler").reduce((s, l) => s + l.points, 0);
  const resultPoints = lines.filter((l) => l.kind === "result").reduce((s, l) => s + l.points, 0);
  const sorted = [...lines].sort((x, y) => x.attainmentPct - y.attainmentPct);

  return {
    lines,
    total,
    maxTotal,
    enablerPoints,
    resultPoints,
    level: level(total),
    weakest: sorted[0] ?? null,
    strongest: sorted[sorted.length - 1] ?? null,
  };
}

/** سطوحِ شناخته‌شدهٔ مدل: بر پایهٔ امتیازِ کل از ۱۰۰۰. */
export function level(total: number): { fa: string; en: string } {
  if (total >= 700) return { fa: "نامزد/برندهٔ جایزهٔ تعالی", en: "Excellence Award finalist/winner" };
  if (total >= 600) return { fa: "تعالیِ شناخته‌شده — ۵ ستاره", en: "Recognised for Excellence — 5★" };
  if (total >= 500) return { fa: "تعالیِ شناخته‌شده — ۴ ستاره", en: "Recognised for Excellence — 4★" };
  if (total >= 400) return { fa: "تعالیِ شناخته‌شده — ۳ ستاره", en: "Recognised for Excellence — 3★" };
  if (total >= 300) return { fa: "در مسیرِ تعالی", en: "On the way to excellence" };
  return { fa: "آغازِ مسیر", en: "Starting the journey" };
}

/* ══════════════════════════════════════════════════════════════════════
   ظرفِ داده — خودارزیابیِ نمونه (قابل ویرایش در رابط)
   ══════════════════════════════════════════════════════════════════════ */
export const EFQM_SEED: Assessment = {
  C1: { a: 72, b: 66 },
  C2: { a: 68, b: 60 },
  C3: { a: 74, b: 70 },
  C4: { a: 64, b: 62 },
  C5: { a: 70, b: 64 },
  R1: { a: 66, b: 62 },
  R2: { a: 74, b: 70 },
  R3: { a: 60, b: 58 },
  R4: { a: 70, b: 66 },
};
