/** Shared OG-2401 controls slice — PEX + PMA. Approved % only. Schedule-only if AC missing. */

export type Act = {
  code: string;
  nameFa: string;
  nameEn: string;
  bac: number;
  durH: number;
  tfH: number;
  pctApproved: number;
  pctPhysicalDraft: number;
  locked: boolean;
};

export const DATA_DATE = "2026-09-04";
export const FORMULA_VERSION = "v1";

export const ACTIVITIES: Act[] = [
  { code: "CIV-001", nameFa: "بتن فونداسیون", nameEn: "Foundation pour", bac: 4200, durH: 80, tfH: 0, pctApproved: 0.62, pctPhysicalDraft: 0.7, locked: true },
  { code: "PIP-ISO-012", nameFa: "اسپول خط ۱۲", nameEn: "Spool 12", bac: 3100, durH: 40, tfH: 0, pctApproved: 0.41, pctPhysicalDraft: 0.5, locked: true },
  { code: "ELE-CBL-04", nameFa: "کابل فشار متوسط", nameEn: "MV cable", bac: 1800, durH: 32, tfH: 48, pctApproved: 0.28, pctPhysicalDraft: 0.28, locked: false },
  { code: "STR-PR-02", nameFa: "پایپ‌رک محور B", nameEn: "Piperack B", bac: 2600, durH: 56, tfH: 16, pctApproved: 0.55, pctPhysicalDraft: 0.6, locked: true },
];

export function evOf(a: Act) {
  return a.bac * a.pctApproved;
}

export function computeEvm(acts: Act[] = ACTIVITIES, ac?: number) {
  const bac = acts.reduce((s, a) => s + a.bac, 0);
  const ev = acts.reduce((s, a) => s + evOf(a), 0);
  const planned = 0.58;
  const pv = bac * planned;
  const scheduleOnly = ac == null;
  const acUse = ac ?? ev;
  const spi = pv ? ev / pv : 0;
  const cpi = scheduleOnly ? null : acUse ? ev / acUse : null;
  const esWeeks = 11.2 * spi;
  const spiT = spi * 0.99;
  const eacCpi = cpi ? bac / cpi : bac / Math.max(spi, 0.01);
  const vac = bac - eacCpi;
  return { bac, ev, pv, ac: scheduleOnly ? null : acUse, spi, cpi, esWeeks, spiT, eacCpi, vac, scheduleOnly, formulaVersion: FORMULA_VERSION, dataDate: DATA_DATE };
}

export function computePhi(evm = computeEvm()) {
  const s = Math.max(0, Math.min(100, evm.spi * 100));
  const c = evm.cpi == null ? 85 : Math.max(0, Math.min(100, evm.cpi * 100));
  const q = 80, hse = 90, risk = 65;
  const total = 0.3 * s + 0.25 * c + 0.2 * q + 0.15 * hse + 0.1 * risk;
  const band = total >= 85 ? "Green" : total >= 70 ? "Yellow" : "Red";
  return { schedule: s, cost: c, quality: q, hse, risk, total, band, formulaVersion: FORMULA_VERSION };
}

export const KPI_SEED = [
  { code: "SPI", cat: "Schedule", w: 12, direction: "HigherBetter" as const },
  { code: "SPI_T", cat: "Schedule", w: 8, direction: "HigherBetter" as const },
  { code: "CPI", cat: "Cost", w: 12, direction: "HigherBetter" as const },
  { code: "PPC", cat: "Schedule", w: 8, direction: "HigherBetter" as const },
  { code: "TF0", cat: "Schedule", w: 4, direction: "LowerBetter" as const },
  { code: "NCR", cat: "Quality", w: 6, direction: "LowerBetter" as const },
  { code: "IRPASS", cat: "Quality", w: 6, direction: "HigherBetter" as const },
  { code: "TRIR", cat: "HSE", w: 8, direction: "LowerBetter" as const },
  { code: "OPEN_CR", cat: "Change", w: 4, direction: "LowerBetter" as const },
  { code: "CLAIM", cat: "Claims", w: 4, direction: "LowerBetter" as const },
  { code: "MDR_CYCLE", cat: "Document", w: 4, direction: "LowerBetter" as const },
  { code: "MAT_OT", cat: "Procurement", w: 6, direction: "LowerBetter" as const },
  { code: "ACT_OVER", cat: "Action", w: 6, direction: "LowerBetter" as const },
  { code: "RPT_LATE", cat: "Report", w: 4, direction: "LowerBetter" as const },
  { code: "RES_PROD", cat: "Resource", w: 8, direction: "HigherBetter" as const },
];

export function kpiWeightSum() {
  return KPI_SEED.reduce((s, k) => s + k.w, 0);
}

export function majorVarianceBlocksReport(hasActionOrCr: boolean) {
  return !hasActionOrCr;
}
