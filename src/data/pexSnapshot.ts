/**
 * PEX seed — پروژه OG-2401 (برنامه‌ریزی و اجرا، دامنه d2)
 * ------------------------------------------------------------------
 * این فایل «داده انتقالی» است: مقصد نهایی جداول SQL Server است
 * (db/mssql/V001__pex_core.sql + seed__pex_og2401.sql) و فرانت‌اند
 * ابتدا از API می‌خواند و فقط در حالت آفلاین به این seed برمی‌گردد
 * (src/services/pexApi.ts → loadPexSnapshot).
 *
 * مبنا: docs/PEX_D2_DataModel.md، docs/PEX_ROC_LIBRARY.md و اسنپ‌شات
 * مشترک OG-2401 در src/services/projectControls.ts (فقط Approved).
 */

export const PEX_PROJECT_CODE = "OG-2401";

export interface PexProject {
  code: string;
  nameFa: string;
  nameEn: string;
  clientFa: string;
  dataDate: string; // ISO gregorian — مبنای CPM/EVM
  formulaVersion: string;
}

export const PEX_PROJECT: PexProject = {
  code: PEX_PROJECT_CODE,
  nameFa: "پروژه نمونه OG-2401",
  nameEn: "Sample Project OG-2401",
  clientFa: "کارفرمای نمونه",
  dataDate: "2026-09-04",
  formulaVersion: "v1",
};

/* ── WBS (وزن فرزندان هر گره = ۱ طبق PEX_D2) ─────────────────────── */

export type PexNodeType = "Summary" | "CA" | "WP";

export interface PexWbsNode {
  code: string;
  parentCode: string | null;
  nameFa: string;
  nameEn: string;
  level: number;
  nodeType: PexNodeType;
  /** وزن نسبی نسبت به والد */
  weight: number;
  isLocked: boolean;
}

export const PEX_WBS: PexWbsNode[] = [
  { code: "1", parentCode: null, nameFa: "مهندسی", nameEn: "Engineering", level: 1, nodeType: "Summary", weight: 0.18, isLocked: true },
  { code: "2", parentCode: null, nameFa: "ساخت", nameEn: "Construction", level: 1, nodeType: "Summary", weight: 0.62, isLocked: true },
  { code: "3", parentCode: null, nameFa: "تدارکات", nameEn: "Procurement", level: 1, nodeType: "Summary", weight: 0.2, isLocked: false },
  { code: "1.1", parentCode: "1", nameFa: "طراحی", nameEn: "Design", level: 2, nodeType: "CA", weight: 0.35, isLocked: true },
  { code: "1.2", parentCode: "1", nameFa: "فونداسیون", nameEn: "Foundations", level: 2, nodeType: "WP", weight: 0.65, isLocked: true },
  { code: "2.1", parentCode: "2", nameFa: "سازه", nameEn: "Structural", level: 2, nodeType: "WP", weight: 0.3, isLocked: true },
  { code: "2.2", parentCode: "2", nameFa: "پایپینگ", nameEn: "Piping", level: 2, nodeType: "WP", weight: 0.45, isLocked: true },
  { code: "2.3", parentCode: "2", nameFa: "برق", nameEn: "Electrical", level: 2, nodeType: "WP", weight: 0.25, isLocked: false },
];

/* ── کتابخانه RoC (جمع وزن گام‌ها = ۱) ───────────────────────────── */

export interface PexRocStep {
  seq: number;
  nameFa: string;
  nameEn: string;
  weight: number;
}

export interface PexRoc {
  code: string;
  nameFa: string;
  nameEn: string;
  discipline: string;
  steps: PexRocStep[];
}

export const PEX_ROC: PexRoc[] = [
  {
    code: "CIV-FND", nameFa: "فونداسیون", nameEn: "Foundation", discipline: "Civil",
    steps: [
      { seq: 1, nameFa: "گودبرداری", nameEn: "Excavation", weight: 0.1 },
      { seq: 2, nameFa: "بتن مگر", nameEn: "Lean concrete", weight: 0.08 },
      { seq: 3, nameFa: "آرماتوربندی", nameEn: "Rebar", weight: 0.22 },
      { seq: 4, nameFa: "قالب‌بندی", nameEn: "Formwork", weight: 0.12 },
      { seq: 5, nameFa: "بتن‌ریزی", nameEn: "Pour", weight: 0.3 },
      { seq: 6, nameFa: "عمل‌آوری", nameEn: "Curing", weight: 0.18 },
    ],
  },
  {
    code: "PIP-LINE", nameFa: "پایپینگ", nameEn: "Piping", discipline: "Piping",
    steps: [
      { seq: 1, nameFa: "ساخت اسپول", nameEn: "Spool fab", weight: 0.12 },
      { seq: 2, nameFa: "فیت‌آپ", nameEn: "Fit-up", weight: 0.15 },
      { seq: 3, nameFa: "جوشکاری", nameEn: "Welding", weight: 0.22 },
      { seq: 4, nameFa: "تست غیرمخرب", nameEn: "NDT", weight: 0.13 },
      { seq: 5, nameFa: "تنش‌زدایی", nameEn: "PWHT", weight: 0.08 },
      { seq: 6, nameFa: "هیدروتست", nameEn: "Hydrotest", weight: 0.18 },
      { seq: 7, nameFa: "رنگ", nameEn: "Painting", weight: 0.12 },
    ],
  },
  {
    code: "ELE-CABLE", nameFa: "کابل", nameEn: "Cable", discipline: "Electrical",
    steps: [
      { seq: 1, nameFa: "سینی کابل", nameEn: "Cable tray", weight: 0.15 },
      { seq: 2, nameFa: "کابل‌کشی", nameEn: "Pulling", weight: 0.35 },
      { seq: 3, nameFa: "سرسیم‌بندی", nameEn: "Termination", weight: 0.25 },
      { seq: 4, nameFa: "تست مگر", nameEn: "Megger test", weight: 0.25 },
    ],
  },
  {
    code: "STR-STL", nameFa: "استراکچر", nameEn: "Steel structure", discipline: "Structural",
    steps: [
      { seq: 1, nameFa: "ساخت", nameEn: "Fabrication", weight: 0.3 },
      { seq: 2, nameFa: "نصب", nameEn: "Erection", weight: 0.4 },
      { seq: 3, nameFa: "بولت و تراز", nameEn: "Bolting & alignment", weight: 0.15 },
      { seq: 4, nameFa: "رنگ", nameEn: "Painting", weight: 0.15 },
    ],
  },
];

/* ── فعالیت‌ها (گام‌ها = RoC + مقدار هدف؛ ApprovedQty بازتولید pct) ── */

export interface PexActivityStep extends PexRocStep {
  targetQty: number;
  uom: string;
  approvedQty: number;
}

export interface PexActivity {
  code: string;
  wbsCode: string;
  nameFa: string;
  nameEn: string;
  bac: number;
  durH: number;
  tfH: number;
  pctApproved: number;
  pctPhysicalDraft: number;
  locked: boolean;
  rocCode: string;
  steps: PexActivityStep[];
}

type StepSeed = [seq: number, targetQty: number, uom: string];

function buildSteps(rocCode: string, seeds: StepSeed[], pctApproved: number): PexActivityStep[] {
  const roc = PEX_ROC.find((r) => r.code === rocCode);
  if (!roc) throw new Error(`RoC not found: ${rocCode}`);
  return seeds.map(([seq, targetQty, uom]) => {
    const s = roc.steps.find((x) => x.seq === seq);
    if (!s) throw new Error(`RoC step not found: ${rocCode}#${seq}`);
    return { ...s, targetQty, uom, approvedQty: +(targetQty * pctApproved).toFixed(2) };
  });
}

export const PEX_ACTIVITIES: PexActivity[] = [
  {
    code: "CIV-001", wbsCode: "1.2", nameFa: "بتن فونداسیون", nameEn: "Foundation pour",
    bac: 4200, durH: 80, tfH: 0, pctApproved: 0.62, pctPhysicalDraft: 0.7, locked: true, rocCode: "CIV-FND",
    steps: buildSteps("CIV-FND", [[1, 500, "m3"], [2, 60, "m3"], [3, 45, "ton"], [4, 800, "m2"], [5, 420, "m3"], [6, 14, "day"]], 0.62),
  },
  {
    code: "PIP-ISO-012", wbsCode: "2.2", nameFa: "اسپول خط ۱۲", nameEn: "Spool 12",
    bac: 3100, durH: 40, tfH: 0, pctApproved: 0.41, pctPhysicalDraft: 0.5, locked: true, rocCode: "PIP-LINE",
    steps: buildSteps("PIP-LINE", [[1, 12, "jt"], [2, 40, "di"], [3, 40, "di"], [4, 40, "jt"], [5, 8, "jt"], [6, 3, "test"], [7, 250, "m2"]], 0.41),
  },
  {
    code: "ELE-CBL-04", wbsCode: "2.3", nameFa: "کابل فشار متوسط", nameEn: "MV cable",
    bac: 1800, durH: 32, tfH: 48, pctApproved: 0.28, pctPhysicalDraft: 0.28, locked: false, rocCode: "ELE-CABLE",
    steps: buildSteps("ELE-CABLE", [[1, 120, "m"], [2, 1800, "m"], [3, 64, "ea"], [4, 64, "test"]], 0.28),
  },
  {
    code: "STR-PR-02", wbsCode: "2.1", nameFa: "پایپ‌رک محور B", nameEn: "Piperack B",
    bac: 2600, durH: 56, tfH: 16, pctApproved: 0.55, pctPhysicalDraft: 0.6, locked: true, rocCode: "STR-STL",
    steps: buildSteps("STR-STL", [[1, 18, "ton"], [2, 18, "ton"], [3, 320, "bolt"], [4, 180, "m2"]], 0.55),
  },
];

/* ── مایلستون‌ها ─────────────────────────────────────────────────── */

export type PexMsType = "Contractual" | "Key" | "Payment" | "Gate" | "Internal" | "Interface";
export type PexMsStatus = "OnTrack" | "AtRisk" | "Delayed" | "Achieved" | "Cancelled";

export interface PexMilestone {
  code: string;
  activityCode: string;
  msType: PexMsType;
  status: PexMsStatus;
  contractualFa: string;
  forecastFa: string;
  contractualIso: string;
  forecastIso: string;
  penaltyPerDay: number;
  ownerOrg: string;
  priority: string;
}

export const PEX_MILESTONES: PexMilestone[] = [
  {
    code: "MS-MECH-RFSU", activityCode: "PIP-ISO-012", msType: "Contractual", status: "Delayed",
    contractualFa: "1404/11/14", forecastFa: "1404/11/28",
    contractualIso: "2026-02-02", forecastIso: "2026-02-16",
    penaltyPerDay: 25000, ownerOrg: "Contractor", priority: "Critical",
  },
  {
    code: "MS-CIV-FOC", activityCode: "CIV-001", msType: "Key", status: "AtRisk",
    contractualFa: "1403/07/01", forecastFa: "1403/07/04",
    contractualIso: "2024-09-22", forecastIso: "2024-09-25",
    penaltyPerDay: 0, ownerOrg: "Contractor", priority: "High",
  },
  {
    code: "MS-PIP-HYDRO", activityCode: "PIP-ISO-012", msType: "Gate", status: "OnTrack",
    contractualFa: "1403/09/15", forecastFa: "1403/09/12",
    contractualIso: "2024-12-05", forecastIso: "2024-12-02",
    penaltyPerDay: 0, ownerOrg: "Contractor", priority: "Medium",
  },
];

/* ── هلپرها ───────────────────────────────────────────────────────── */

export function pexActivityByCode(code: string): PexActivity | undefined {
  return PEX_ACTIVITIES.find((a) => a.code === code);
}

export function pexRocByCode(code: string): PexRoc | undefined {
  return PEX_ROC.find((r) => r.code === code);
}

export function pexWbsChildren(parentCode: string | null): PexWbsNode[] {
  return PEX_WBS.filter((n) => n.parentCode === parentCode);
}

/** درصد فیزیکی از روی گام‌های تأییدشده (roll-up سمت کلاینت، آینه منطق سرور). */
export function pexActivityPhysicalPct(a: PexActivity): number {
  return +a.steps
    .reduce((s, st) => s + st.weight * Math.min(1, st.targetQty > 0 ? st.approvedQty / st.targetQty : 0), 0)
    .toFixed(4);
}
