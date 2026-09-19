/* ══════════════════════════════════════════════════════════════════════
   SCH-INSIGHT-v1 — دو داشبوردِ تحلیلیِ زمان‌بندی (d2 و d3)

   الف) نمودار S و پیشرفت تجمعی (دامنهٔ d3 — پایش):
       برنامه‌ایِ تجمعی در برابر واقعیِ تجمعی، با SV، SPI و پیش‌بینیِ
       پایان بر مبنای SPI.

   ب) تحلیل برنامهٔ وارداتی از MSP/P6 (دامنهٔ d2 — برنامه‌ریزی):
       نه شاخصِ سبک‌‌شدهٔ DCMA روی شبکهٔ وارداتی: اتصال‌های گمشده
       (پیش‌نیاز/پس‌نیاز)، شناوری منفی، فعالیت‌های بلند، محدودیت سخت،
       تاریخ نامعتبر و شناوریِ بیش‌از‌حد — و یک نمرهٔ سلامت ۰ تا ۱۰۰.

   دادهٔ نمونه ظرف است؛ پس از اتصال SQL/P6 همین توابع با ورودیِ واقعی
   صدا زده می‌شوند.
   ══════════════════════════════════════════════════════════════════════ */

export type PeriodPoint = { period: string; planned: number; actual: number | null };

export type SCurvePoint = {
  period: string;
  plannedCum: number;
  actualCum: number | null;
  plannedPct: number;
  actualPct: number | null;
};

export type SCurveResult = {
  points: SCurvePoint[];
  totalPlanned: number;
  performed: number;
  /** SV بر حسب درصدِ برنامه (مثبت = جلوتر از برنامه). */
  svPct: number;
  spi: number;
  /** پیش‌بینیِ پیشرفتِ نهایی بر مبنای SPI (۰ تا ۱). */
  forecastProgress: number;
  behind: boolean;
};

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function sCurve(series: PeriodPoint[]): SCurveResult {
  const totalPlanned = series.reduce((s, p) => s + p.planned, 0);
  let plannedCum = 0;
  let actualCum = 0;
  const points: SCurvePoint[] = series.map((p) => {
    plannedCum += p.planned;
    if (p.actual !== null) actualCum += p.actual;
    return {
      period: p.period,
      plannedCum,
      actualCum: p.actual === null ? null : actualCum,
      plannedPct: ratio(plannedCum, totalPlanned),
      actualPct: p.actual === null ? null : ratio(actualCum, totalPlanned),
    };
  });
  const lastActual = [...points].reverse().find((p) => p.actualPct !== null);
  const performed = actualCum;
  const plannedAtActual = lastActual?.plannedPct ?? 0;
  const actualAtActual = lastActual?.actualPct ?? 0;
  const svPct = actualAtActual - plannedAtActual;
  const spi = ratio(actualAtActual, plannedAtActual);
  return {
    points,
    totalPlanned,
    performed,
    svPct,
    spi,
    forecastProgress: Math.min(1, spi),
    behind: svPct < 0,
  };
}

/* ─────────────────── تحلیلِ برنامهٔ وارداتی (MSP / P6) ─────────────────── */

export type ImportedTask = {
  id: string;
  name: string;
  durationDays: number;
  totalFloat: number;
  predecessors: string[];
  successors: string[];
  /** محدودیت سخت (Start No Earlier Than و مانند آن) دارد؟ */
  hardConstraint: boolean;
  /** تاریخ پایانِ برنامه‌ای معتبر است؟ (خالی/نامعتبر = false) */
  validDates: boolean;
};

export type MspFinding = {
  code: string;
  label: { fa: string; en: string };
  count: number;
  threshold: number;
  severity: "ok" | "warn" | "bad";
  hint: { fa: string; en: string };
};

export type MspAnalysis = {
  taskCount: number;
  findings: MspFinding[];
  health: number;
  grade: "A" | "B" | "C" | "D";
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function mspAnalysis(tasks: ImportedTask[]): MspAnalysis {
  const n = tasks.length || 1;
  const pctCount = (pred: (t: ImportedTask) => boolean) => tasks.filter(pred).length / n;

  const dangling = tasks.filter((t) => t.predecessors.length === 0 && t.successors.length === 0).length;
  const negativeFloat = tasks.filter((t) => t.totalFloat < 0).length;
  const longTasks = tasks.filter((t) => t.durationDays > 44).length; // بیش از دو ماهِ کاری
  const hardConstraints = tasks.filter((t) => t.hardConstraint).length;
  const invalidDates = tasks.filter((t) => !t.validDates).length;
  const highFloat = tasks.filter((t) => t.totalFloat > 44).length;
  const missingLinks = tasks.filter((t) => t.predecessors.length === 0).length;

  const raw: Omit<MspFinding, "severity">[] = [
    {
      code: "DANGLING",
      label: { fa: "فعالیت‌های بی‌اتصال", en: "Dangling activities" },
      count: dangling,
      threshold: 0.05,
      hint: { fa: "هر فعالیت باید دست‌کم یک پیش‌نیاز یا پس‌نیاز داشته باشد", en: "every activity needs at least one link" },
    },
    {
      code: "MISSING_LINKS",
      label: { fa: "بدون پیش‌نیاز", en: "Missing predecessors" },
      count: missingLinks,
      threshold: 0.05,
      hint: { fa: "فقدان پیش‌نیاز یعنی منطقِ اجرا ثبت نشده", en: "no predecessor means logic is missing" },
    },
    {
      code: "NEG_FLOAT",
      label: { fa: "شناوری منفی", en: "Negative float" },
      count: negativeFloat,
      threshold: 0.05,
      hint: { fa: "نشانهٔ تداخلِ محدودیت‌ها یا تأخیرِ پنهان", en: "sign of constraint conflict or hidden delay" },
    },
    {
      code: "LONG_DUR",
      label: { fa: "فعالیت‌های بلند (>۴۴ روز)", en: "Long durations (>44d)" },
      count: longTasks,
      threshold: 0.1,
      hint: { fa: "فعالیت بلند کنترل‌پذیریِ پیشرفت را از بین می‌برد", en: "long tasks make progress uncontrollable" },
    },
    {
      code: "HARD_CONSTRAINT",
      label: { fa: "محدودیت‌های سخت", en: "Hard constraints" },
      count: hardConstraints,
      threshold: 0.05,
      hint: { fa: "محدودیت سخت مانع محاسبهٔ درستِ شناوری است", en: "hard constraints break float logic" },
    },
    {
      code: "INVALID_DATES",
      label: { fa: "تاریخ‌های نامعتبر", en: "Invalid dates" },
      count: invalidDates,
      threshold: 0.01,
      hint: { fa: "تاریخِ خالی یا گذشته/آیندهٔ غیرمنطقی", en: "blank or illogical dates" },
    },
    {
      code: "HIGH_FLOAT",
      label: { fa: "شناوریِ بیش‌از‌حد (>۴۴ روز)", en: "High float (>44d)" },
      count: highFloat,
      threshold: 0.15,
      hint: { fa: "شناوریِ زیاد یعنی منطقِ شبکه سست است", en: "excess float means loose logic" },
    },
  ];

  const findings: MspFinding[] = raw.map((f) => {
    const share = pctCount(() => true) === 0 ? 0 : f.count / n;
    return {
      ...f,
      severity: share > f.threshold * 2 ? "bad" : share > f.threshold ? "warn" : "ok",
    };
  });

  /* نمرهٔ سلامت: هر شاخص به نسبتِ عبور از آستانه امتیاز می‌گیرد. */
  const penalty = findings.reduce((s, f) => {
    const share = f.count / n;
    return s + clamp01(share / (f.threshold * 2));
  }, 0);
  const health = Math.round((1 - clamp01(penalty / findings.length)) * 100);
  const grade: MspAnalysis["grade"] = health >= 85 ? "A" : health >= 70 ? "B" : health >= 55 ? "C" : "D";

  return { taskCount: tasks.length, findings, health, grade };
}

/* ══════════════════════════════════════════════════════════════════════
   ظرفِ داده — ۱۲ دورهٔ ماهانه + شبکهٔ وارداتیِ نمونه
   ══════════════════════════════════════════════════════════════════════ */

export const SCURVE_SEED: PeriodPoint[] = [
  { period: "1404/08", planned: 3.2, actual: 2.8 },
  { period: "1404/09", planned: 5.1, actual: 4.4 },
  { period: "1404/10", planned: 7.4, actual: 6.1 },
  { period: "1404/11", planned: 9.8, actual: 8.2 },
  { period: "1404/12", planned: 11.5, actual: 9.6 },
  { period: "1405/01", planned: 12.1, actual: 10.4 },
  { period: "1405/02", planned: 11.8, actual: 9.9 },
  { period: "1405/03", planned: 10.6, actual: null },
  { period: "1405/04", planned: 9.4, actual: null },
  { period: "1405/05", planned: 8.1, actual: null },
  { period: "1405/06", planned: 6.5, actual: null },
  { period: "1405/07", planned: 4.5, actual: null },
];

export const MSP_TASKS_SEED: ImportedTask[] = [
  { id: "T100", name: "مهندسی پایه", durationDays: 60, totalFloat: 0, predecessors: [], successors: ["T110"], hardConstraint: false, validDates: true },
  { id: "T110", name: "مهندسی تفصیلی", durationDays: 75, totalFloat: 0, predecessors: ["T100"], successors: ["T120", "T130"], hardConstraint: true, validDates: true },
  { id: "T120", name: "تأمین کالای Long Lead", durationDays: 120, totalFloat: 5, predecessors: ["T110"], successors: ["T200"], hardConstraint: true, validDates: true },
  { id: "T130", name: "مدارک ساخت", durationDays: 45, totalFloat: 12, predecessors: ["T110"], successors: ["T210"], hardConstraint: false, validDates: true },
  { id: "T200", name: "ساخت مخازن", durationDays: 90, totalFloat: -8, predecessors: ["T120"], successors: ["T300"], hardConstraint: false, validDates: true },
  { id: "T210", name: "نصب اسکلت", durationDays: 55, totalFloat: 3, predecessors: ["T130"], successors: ["T300"], hardConstraint: false, validDates: true },
  { id: "T220", name: "بتن فونداسیون", durationDays: 40, totalFloat: 18, predecessors: ["T130"], successors: ["T230"], hardConstraint: false, validDates: true },
  { id: "T230", name: "لوله‌کشی زیرزمینی", durationDays: 35, totalFloat: 60, predecessors: ["T220"], successors: [], hardConstraint: false, validDates: true },
  { id: "T240", name: "برق‌کشی", durationDays: 30, totalFloat: 72, predecessors: [], successors: ["T300"], hardConstraint: false, validDates: true },
  { id: "T300", name: "پیش‌راه‌اندازی", durationDays: 48, totalFloat: -4, predecessors: ["T200", "T210", "T240"], successors: [], hardConstraint: true, validDates: true },
];
