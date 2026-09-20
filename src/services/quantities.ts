/* ══════════════════════════════════════════════════════════════════════
   QTY-v1 — موتور «احجام و مقادیر فیزیکی» و «بالانس مصالح» (دامنهٔ d5)

   چرا جدا از finance.ts: موتور مالی با «پول» کار می‌کند و این یکی با
   «مقدار». یکی کردنشان یعنی هر بار تغییر نُرم مصرف، محاسبات مالی هم
   باید دوباره آزمایش شود. اینجا فقط جبرِ مقدار است:

     احجام:       برداشت‌شده − برنامه‌ایِ تا امروز  → انحراف فیزیکی
     بالانس مصالح: موجودیِ پایان = ابتدا + دریافت − مصرف + برگشتی
                   انحراف مصرف = مصرف واقعی − (نُرم × تولید)

   دادهٔ نمونه (`BOQ_SEED`, `MATERIAL_SEED`) ظرف است نه منبع حقیقت؛ پس از
   اتصال SQL، جداول `Boq_Item`، `Boq_Measurement` و `Material_Ledger` جای
   آن را می‌گیرند و این توابع دست‌نخورده می‌مانند.
   ══════════════════════════════════════════════════════════════════════ */

export type Lbl = { fa: string; en: string };

export type BoqRow = {
  id: string;
  wbs: string;
  item: Lbl;
  unit: Lbl;
  /** کلِ مقدارِ برنامه‌ایِ ردیف (فهرست بها). */
  plannedQty: number;
  /** مقدارِ برنامه‌ایِ تجمعی تا تاریخ داده (Data Date). */
  plannedToDate: number;
  /** نرخ واحد به ریال — برای ارزش‌گذاری پیشرفت فیزیکی. */
  unitRate: number;
  measurements: { period: string; qty: number }[];
};

export type MaterialRow = {
  id: string;
  material: Lbl;
  unit: Lbl;
  opening: number;
  receipts: number;
  issues: number;
  returns: number;
  /** نُرم مصرف به ازای واحدِ تولید (اختیاری). */
  normPerUnit?: number;
  /** مقدار تولید/کارِ انجام‌شدهٔ دوره — مبنای مقایسه با نُرم. */
  productionQty?: number;
};

export type QuantityLine = {
  id: string;
  wbs: string;
  item: Lbl;
  unit: Lbl;
  plannedQty: number;
  plannedToDate: number;
  measuredQty: number;
  variance: number;
  variancePct: number;
  physicalProgress: number;
  plannedValue: number;
  earnedValue: number;
  status: "ahead" | "on" | "behind";
};

export type MaterialLine = {
  id: string;
  material: Lbl;
  unit: Lbl;
  opening: number;
  receipts: number;
  issues: number;
  returns: number;
  closing: number;
  /** مصرفِ مجاز بر پایهٔ نُرم: نُرم × تولید */
  normQty: number | null;
  variance: number | null;
  variancePct: number | null;
  wastePct: number | null;
  status: "over" | "ok" | "under" | "na";
};

export type QuantityTotals = {
  plannedValue: number;
  earnedValue: number;
  physicalProgress: number;
  behindCount: number;
  aheadCount: number;
  rowCount: number;
};

export type MaterialTotals = {
  issues: number;
  normQty: number;
  variance: number;
  avgWastePct: number;
  overCount: number;
  rowCount: number;
};

const safe = (n: number) => (Number.isFinite(n) ? n : 0);
const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

/* ─────────────── احجام: از ردیف‌های فهرست بها تا انحراف فیزیکی ─────────── */

export function quantityLines(rows: BoqRow[]): QuantityLine[] {
  return rows.map((r) => {
    const measuredQty = r.measurements.reduce((s, m) => s + m.qty, 0);
    const variance = measuredQty - r.plannedToDate;
    const variancePct = ratio(variance, r.plannedToDate);
    return {
      id: r.id,
      wbs: r.wbs,
      item: r.item,
      unit: r.unit,
      plannedQty: r.plannedQty,
      plannedToDate: r.plannedToDate,
      measuredQty,
      variance,
      variancePct,
      physicalProgress: ratio(measuredQty, r.plannedQty),
      plannedValue: r.plannedQty * r.unitRate,
      earnedValue: measuredQty * r.unitRate,
      status: variancePct > 0.05 ? "ahead" : variancePct < -0.05 ? "behind" : "on",
    };
  });
}

export function quantityTotals(lines: QuantityLine[]): QuantityTotals {
  const plannedValue = lines.reduce((s, l) => s + l.plannedValue, 0);
  const earnedValue = lines.reduce((s, l) => s + l.earnedValue, 0);
  return {
    plannedValue,
    earnedValue,
    physicalProgress: ratio(earnedValue, plannedValue),
    behindCount: lines.filter((l) => l.status === "behind").length,
    aheadCount: lines.filter((l) => l.status === "ahead").length,
    rowCount: lines.length,
  };
}

/* ─────────────── بالانس مصالح: ترازِ مقداری و انحراف از نُرم ───────────── */

export function materialLines(rows: MaterialRow[]): MaterialLine[] {
  return rows.map((r) => {
    const closing = r.opening + r.receipts - r.issues + r.returns;
    const hasNorm = typeof r.normPerUnit === "number" && typeof r.productionQty === "number";
    const normQty = hasNorm ? r.normPerUnit! * r.productionQty! : null;
    const variance = hasNorm ? r.issues - normQty! : null;
    const variancePct = hasNorm ? ratio(variance!, normQty!) : null;
    const wastePct = hasNorm ? ratio(variance!, r.issues === 0 ? 1 : r.issues) : null;
    return {
      id: r.id,
      material: r.material,
      unit: r.unit,
      opening: r.opening,
      receipts: r.receipts,
      issues: r.issues,
      returns: r.returns,
      closing: safe(closing),
      normQty,
      variance,
      variancePct,
      wastePct,
      status: !hasNorm ? "na" : variancePct! > 0.05 ? "over" : variancePct! < -0.05 ? "under" : "ok",
    };
  });
}

export function materialTotals(lines: MaterialLine[]): MaterialTotals {
  const withNorm = lines.filter((l) => l.normQty !== null);
  const issues = lines.reduce((s, l) => s + l.issues, 0);
  const normQty = withNorm.reduce((s, l) => s + (l.normQty ?? 0), 0);
  const variance = withNorm.reduce((s, l) => s + (l.variance ?? 0), 0);
  const wastes = withNorm.map((l) => l.wastePct ?? 0).filter((n) => Number.isFinite(n));
  return {
    issues,
    normQty,
    variance,
    avgWastePct: wastes.length ? wastes.reduce((a, b) => a + b, 0) / wastes.length : 0,
    overCount: lines.filter((l) => l.status === "over").length,
    rowCount: lines.length,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   ظرفِ داده — تا اتصال SQL (جداول Boq_Item / Boq_Measurement / Material_Ledger)
   اعداد نمونه و در مقیاس یک پروژهٔ EPC متوسطِ ایران هستند.
   ══════════════════════════════════════════════════════════════════════ */

export const BOQ_SEED: BoqRow[] = [
  { id: "b1", wbs: "1.3.1", item: { fa: "بتن فونداسیون C30", en: "Foundation concrete C30" }, unit: { fa: "مترمکعب", en: "m³" }, plannedQty: 12_400, plannedToDate: 9_100, unitRate: 42_000_000, measurements: [{ period: "1404/11", qty: 2_150 }, { period: "1404/12", qty: 2_480 }, { period: "1405/01", qty: 2_010 }, { period: "1405/02", qty: 1_690 }] },
  { id: "b2", wbs: "1.3.2", item: { fa: "آرماتوربندی", en: "Rebar works" }, unit: { fa: "تن", en: "t" }, plannedQty: 1_820, plannedToDate: 1_430, unitRate: 385_000_000, measurements: [{ period: "1404/11", qty: 320 }, { period: "1404/12", qty: 410 }, { period: "1405/01", qty: 355 }, { period: "1405/02", qty: 288 }] },
  { id: "b3", wbs: "1.4.1", item: { fa: "نصب سازه فلزی", en: "Structural steel erection" }, unit: { fa: "تن", en: "t" }, plannedQty: 3_600, plannedToDate: 2_250, unitRate: 510_000_000, measurements: [{ period: "1404/12", qty: 480 }, { period: "1405/01", qty: 620 }, { period: "1405/02", qty: 540 }] },
  { id: "b4", wbs: "1.5.2", item: { fa: "لوله‌کشی فرآیندی", en: "Process piping" }, unit: { fa: "اینچ-متر", en: "in-m" }, plannedQty: 96_000, plannedToDate: 41_000, unitRate: 1_250_000, measurements: [{ period: "1405/01", qty: 11_400 }, { period: "1405/02", qty: 14_800 }] },
  { id: "b5", wbs: "1.5.5", item: { fa: "کابل‌کشی برق", en: "Electrical cabling" }, unit: { fa: "متر", en: "m" }, plannedQty: 148_000, plannedToDate: 52_000, unitRate: 780_000, measurements: [{ period: "1405/01", qty: 13_600 }, { period: "1405/02", qty: 16_200 }] },
  { id: "b6", wbs: "1.6.3", item: { fa: "رنگ‌آمیزی صنعتی", en: "Industrial painting" }, unit: { fa: "مترمربع", en: "m²" }, plannedQty: 74_000, plannedToDate: 18_500, unitRate: 620_000, measurements: [{ period: "1405/02", qty: 6_900 }] },
];

export const MATERIAL_SEED: MaterialRow[] = [
  { id: "m1", material: { fa: "سیمان تیپ ۲", en: "Cement type II" }, unit: { fa: "تن", en: "t" }, opening: 420, receipts: 1_150, issues: 1_020, returns: 24, normPerUnit: 0.34, productionQty: 2_850 },
  { id: "m2", material: { fa: "میلگرد آجدار ۱۶", en: "Rebar Ø16" }, unit: { fa: "تن", en: "t" }, opening: 180, receipts: 640, issues: 610, returns: 12, normPerUnit: 0.098, productionQty: 5_900 },
  { id: "m3", material: { fa: "ورق فولادی ST37", en: "Steel plate ST37" }, unit: { fa: "تن", en: "t" }, opening: 95, receipts: 310, issues: 268, returns: 6, normPerUnit: 0.082, productionQty: 3_100 },
  { id: "m4", material: { fa: "لوله کربن‌استیل ۶ اینچ", en: "CS pipe 6in" }, unit: { fa: "متر", en: "m" }, opening: 1_200, receipts: 4_800, issues: 4_050, returns: 90, normPerUnit: 1.02, productionQty: 3_750 },
  { id: "m5", material: { fa: "کابل برق ۴×۱۶", en: "Power cable 4×16" }, unit: { fa: "متر", en: "m" }, opening: 3_400, receipts: 12_000, issues: 9_600, returns: 150, normPerUnit: 1.05, productionQty: 8_400 },
  { id: "m6", material: { fa: "رنگ اپوکسی", en: "Epoxy paint" }, unit: { fa: "لیتر", en: "L" }, opening: 1_800, receipts: 5_200, issues: 4_950, returns: 60 },
];
