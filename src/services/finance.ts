/**
 * FIN — موتور هزینه، تأمین و لجستیک (d5).
 * قواعد: AC مالک d5 است · Snapshot غیرقابل تغییر با نسخه فرمول · Commitment پیش از Actual ·
 * 3-Way Match پیش از پرداخت · چندارزی بومی · هیچ نوشتنی روی داده d2/d3/d4.
 */

export const FIN_FORMULA_VERSION = "fin-v1";

/* ══════════════════════════ چندارزی ══════════════════════════ */

export type Money = { amount: number; currency: string };

/** نرخ‌ها نسبت به ارز پایه (پیش‌فرض IRR). */
export function toBase(m: Money, rates: Record<string, number>, base = "IRR"): number {
  if (m.currency === base) return m.amount;
  const r = rates[m.currency];
  if (!r) throw new Error(`FIN: نرخ ارز ${m.currency} تعریف نشده`);
  return m.amount * r;
}

/** تعدیل (Escalation) با شاخص دوره‌ای. */
export function escalate(amount: number, indexFrom: number, indexTo: number): number {
  if (indexFrom <= 0) return amount;
  return amount * (indexTo / indexFrom);
}

/* ══════════════════════════ CBS و PMB ══════════════════════════ */

export type CbsNode = {
  code: string;
  parent?: string;
  nameFa: string;
  kind: "direct" | "indirect" | "reserve";
  category: "labor" | "material" | "equipment" | "subcontract" | "overhead";
  budget: number; // ارز پایه
};

/** جمع بودجه هر گره با فرزندانش (Rollup چندسطحی). */
export function cbsRollup(nodes: CbsNode[]): Record<string, number> {
  const children: Record<string, string[]> = {};
  const byCode: Record<string, CbsNode> = {};
  for (const n of nodes) {
    byCode[n.code] = n;
    if (n.parent) (children[n.parent] ??= []).push(n.code);
  }
  const memo: Record<string, number> = {};
  const walk = (code: string): number => {
    if (memo[code] !== undefined) return memo[code];
    const own = byCode[code]?.budget ?? 0;
    const kids = (children[code] ?? []).reduce((s, c) => s + walk(c), 0);
    return (memo[code] = own + kids);
  };
  for (const n of nodes) walk(n.code);
  return memo;
}

export type CurveType = "linear" | "bell" | "front" | "back" | "scurve" | "custom";

/** توزیع زمانی بودجه (PMB) روی n دوره؛ مجموع همیشه برابر total است. */
export function distributeBudget(total: number, periods: number, curve: CurveType, custom?: number[]): number[] {
  if (periods <= 0) return [];
  let w: number[];
  switch (curve) {
    case "linear":
      w = Array.from({ length: periods }, () => 1);
      break;
    case "bell":
      w = Array.from({ length: periods }, (_, i) => {
        const x = (i + 0.5) / periods;
        return Math.exp(-Math.pow((x - 0.5) / 0.22, 2) / 2);
      });
      break;
    case "front":
      w = Array.from({ length: periods }, (_, i) => periods - i);
      break;
    case "back":
      w = Array.from({ length: periods }, (_, i) => i + 1);
      break;
    case "scurve":
      w = Array.from({ length: periods }, (_, i) => {
        const x = (i + 1) / periods;
        const prev = i / periods;
        const s = (t: number) => 1 / (1 + Math.exp(-12 * (t - 0.5)));
        return s(x) - s(prev);
      });
      break;
    case "custom":
      w = custom && custom.length === periods ? custom.slice() : Array.from({ length: periods }, () => 1);
      break;
  }
  const sum = w.reduce((s, x) => s + x, 0) || 1;
  return w.map((x) => (x / sum) * total);
}

/* ══════════════════════════ EVM Powerhouse ══════════════════════════ */

export type EvmInput = {
  bac: number;
  pv: number;
  ev: number;
  ac?: number; // نبودش = Schedule-Only Mode
  /** PV تجمعی هر دوره برای محاسبه Earned Schedule */
  pvCurve?: number[];
  /** شماره دوره جاری (۱-پایه) */
  period?: number;
  reserveRemaining?: number;
};

export type EvmResult = {
  scheduleOnly: boolean;
  sv: number;
  cv: number | null;
  spi: number;
  cpi: number | null;
  es: number | null;
  spiT: number | null;
  eac: { ate: number | null; cpi: number | null; cpiSpi: number | null; weighted: number | null; riskAdj: number | null };
  etc: number | null;
  vac: number | null;
  tcpiBac: number | null;
  tcpiEac: number | null;
  formulaVersion: string;
};

/** Earned Schedule: دوره‌ای که PV تجمعی آن برابر EV فعلی است (با درون‌یابی خطی). */
export function earnedSchedule(ev: number, pvCurve: number[]): number | null {
  if (!pvCurve.length) return null;
  let cum = 0;
  const cums: number[] = [];
  for (const p of pvCurve) {
    cum += p;
    cums.push(cum);
  }
  if (ev <= 0) return 0;
  if (ev >= cums[cums.length - 1]) return cums.length;
  for (let i = 0; i < cums.length; i++) {
    if (cums[i] >= ev) {
      const prev = i === 0 ? 0 : cums[i - 1];
      const frac = (ev - prev) / (cums[i] - prev || 1);
      return i + frac;
    }
  }
  return null;
}

export function computeEvm(input: EvmInput): EvmResult {
  const { bac, pv, ev, ac, pvCurve, period, reserveRemaining = 0 } = input;
  const scheduleOnly = ac === undefined || ac === null;
  const spi = pv > 0 ? ev / pv : 0;
  const cpi = scheduleOnly ? null : (ac as number) > 0 ? ev / (ac as number) : 0;
  const es = pvCurve && pvCurve.length ? earnedSchedule(ev, pvCurve) : null;
  const spiT = es !== null && period && period > 0 ? es / period : null;

  const remaining = bac - ev;
  const acv = (ac ?? 0) as number;
  const safe = (x: number | null) => (x === null || x === 0 ? null : x);
  const cpiS = safe(cpi);
  const spiS = spi === 0 ? null : spi;

  const eacAte = scheduleOnly ? null : acv + remaining;
  const eacCpi = cpiS ? bac / cpiS : null;
  const eacCpiSpi = cpiS && spiS ? acv + remaining / (cpiS * spiS) : null;
  const eacWeighted = cpiS && spiS ? acv + remaining / (0.8 * cpiS + 0.2 * spiS) : null;
  const eacRisk = eacCpiSpi === null ? null : eacCpiSpi + reserveRemaining;

  const chosen = eacCpi ?? eacAte;
  const etc = chosen === null ? null : chosen - acv;
  const vac = chosen === null ? null : bac - chosen;
  const tcpiBac = scheduleOnly ? null : bac - acv !== 0 ? remaining / (bac - acv) : null;
  const tcpiEac = chosen !== null && chosen - acv !== 0 ? remaining / (chosen - acv) : null;

  return {
    scheduleOnly,
    sv: ev - pv,
    cv: scheduleOnly ? null : ev - acv,
    spi,
    cpi,
    es,
    spiT,
    eac: { ate: eacAte, cpi: eacCpi, cpiSpi: eacCpiSpi, weighted: eacWeighted, riskAdj: eacRisk },
    etc,
    vac,
    tcpiBac,
    tcpiEac,
    formulaVersion: FIN_FORMULA_VERSION,
  };
}

/* ─────────────── انحراف، روند و ناهنجاری ─────────────── */

export type Severity = "minor" | "moderate" | "major" | "critical";

/** شدت انحراف بر مبنای درصد (قدرمطلق). آستانه‌ها: ۵٪ / ۱۰٪ / ۲۰٪ */
export function varianceSeverity(pct: number): Severity {
  const a = Math.abs(pct);
  if (a >= 20) return "critical";
  if (a >= 10) return "major";
  if (a >= 5) return "moderate";
  return "minor";
}

/** انحراف Major/Critical باید به اقدام (MON) یا CR (RCC) وصل شود. */
export function needsAutoCr(sev: Severity): boolean {
  return sev === "major" || sev === "critical";
}

/** میانگین متحرک n دوره‌ای. */
export function movingAverage(series: number[], window = 6): number | null {
  if (!series.length) return null;
  const s = series.slice(-window);
  return s.reduce((a, b) => a + b, 0) / s.length;
}

/** ناهنجاری با Z-Score (پیش‌فرض آستانه ۲). */
export function isAnomaly(series: number[], value: number, z = 2): boolean {
  if (series.length < 3) return false;
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const sd = Math.sqrt(series.reduce((s, x) => s + (x - mean) ** 2, 0) / series.length);
  if (sd === 0) return false;
  return Math.abs((value - mean) / sd) >= z;
}

/* ══════════════════════════ نقدینگی و سرمایه در گردش ══════════════════════════ */

export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

export function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

export function dso(receivables: number, revenue: number, days = 365): number {
  return revenue > 0 ? (receivables / revenue) * days : 0;
}

export function dpo(payables: number, cogs: number, days = 365): number {
  return cogs > 0 ? (payables / cogs) * days : 0;
}

/** چرخه تبدیل نقد: DSO + DIO − DPO */
export function ccc(dsoV: number, dioV: number, dpoV: number): number {
  return dsoV + dioV - dpoV;
}

export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((s, cf, i) => s + cf / Math.pow(1 + rate, i), 0);
}

/** IRR با جست‌وجوی دوبخشی؛ در نبود ریشه null. */
export function irr(cashflows: number[], lo = -0.9, hi = 5, iter = 200): number | null {
  let a = lo;
  let b = hi;
  let fa = npv(a, cashflows);
  let fb = npv(b, cashflows);
  if (fa * fb > 0) return null;
  for (let i = 0; i < iter; i++) {
    const m = (a + b) / 2;
    const fm = npv(m, cashflows);
    if (Math.abs(fm) < 1e-9) return m;
    if (fa * fm < 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/** دوره بازگشت سرمایه (با درون‌یابی خطی)؛ null یعنی بازنمی‌گردد. */
export function payback(cashflows: number[]): number | null {
  let cum = 0;
  for (let i = 0; i < cashflows.length; i++) {
    const prev = cum;
    cum += cashflows[i];
    if (prev < 0 && cum >= 0) return i - 1 + Math.abs(prev) / (cashflows[i] || 1);
  }
  return null;
}

/* ══════════════════════════ زنجیره تعهد و 3-Way Match ══════════════════════════ */

export type CommitmentState = { poValue: number; grnValue: number; invoicedValue: number; paidValue: number };

export type CommitmentView = {
  committed: number; // PO منهای مبلغ فاکتورشده
  accrued: number; // تحویل‌شده ولی فاکتور نشده
  actual: number; // AC = فاکتور تأییدشده
  outstandingPayment: number;
  overCommitted: boolean;
};

export function commitmentView(c: CommitmentState, bacRemaining: number): CommitmentView {
  return {
    committed: Math.max(0, c.poValue - c.invoicedValue),
    accrued: Math.max(0, c.grnValue - c.invoicedValue),
    actual: c.invoicedValue,
    outstandingPayment: Math.max(0, c.invoicedValue - c.paidValue),
    overCommitted: c.poValue - c.invoicedValue > bacRemaining,
  };
}

export type MatchResult = { ok: boolean; reasons: string[]; maxDeviationPct: number };

/** تطابق سه‌جانبه PO + GRN + Invoice با تلورانس درصدی (پیش‌فرض ۵٪). */
export function threeWayMatch(
  po: { qty: number; price: number },
  grn: { qty: number },
  inv: { qty: number; price: number },
  tolerancePct = 5
): MatchResult {
  const reasons: string[] = [];
  const qtyDev = po.qty > 0 ? (Math.abs(inv.qty - po.qty) / po.qty) * 100 : 0;
  const recvDev = po.qty > 0 ? (Math.abs(grn.qty - inv.qty) / po.qty) * 100 : 0;
  const priceDev = po.price > 0 ? (Math.abs(inv.price - po.price) / po.price) * 100 : 0;
  if (qtyDev > tolerancePct) reasons.push("qty_mismatch_po_invoice");
  if (recvDev > tolerancePct) reasons.push("qty_mismatch_grn_invoice");
  if (priceDev > tolerancePct) reasons.push("price_mismatch");
  if (inv.qty > grn.qty) reasons.push("invoiced_more_than_received");
  return { ok: reasons.length === 0, reasons, maxDeviationPct: Math.max(qtyDev, recvDev, priceDev) };
}

/* ══════════════════════════ PR / MRP ══════════════════════════ */

/** تاریخ نیاز کالا = شروع فعالیت − زمان تدارک − بافر ایمنی (خروجی: ISO date). */
export function materialNeedDate(activityStartIso: string, leadTimeDays: number, safetyBufferDays = 0): string {
  const d = new Date(activityStartIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - leadTimeDays - safetyBufferDays);
  return d.toISOString().slice(0, 10);
}

export type MrpLine = {
  materialCode: string;
  requiredQty: number;
  onHand: number;
  onOrder: number;
  safetyStock: number;
  leadTimeDays: number;
  activityStart: string;
};

export type MrpSuggestion = { materialCode: string; orderQty: number; needDate: string; releaseDate: string };

/** پیشنهاد PR خودکار: کسری = نیاز + ذخیره ایمنی − موجودی − در راه. */
export function mrpRun(lines: MrpLine[], safetyBufferDays = 3): MrpSuggestion[] {
  const out: MrpSuggestion[] = [];
  for (const l of lines) {
    const shortage = l.requiredQty + l.safetyStock - l.onHand - l.onOrder;
    if (shortage <= 0) continue;
    out.push({
      materialCode: l.materialCode,
      orderQty: Math.ceil(shortage),
      needDate: l.activityStart,
      releaseDate: materialNeedDate(l.activityStart, l.leadTimeDays, safetyBufferDays),
    });
  }
  return out;
}

/** کنترل بودجه پیش از ثبت PR — فراتر از بودجه بدون مجوز = رد. */
export function prBudgetCheck(amount: number, cbsRemaining: number, hasOverrideApproval = false): { ok: boolean; reason?: string } {
  if (amount <= cbsRemaining) return { ok: true };
  return hasOverrideApproval ? { ok: true } : { ok: false, reason: "over_budget" };
}

/* ══════════════════════════ انبار و موجودی ══════════════════════════ */

export function safetyStock(avgDailyUse: number, maxDailyUse: number, leadTimeDays: number): number {
  return Math.max(0, (maxDailyUse - avgDailyUse) * leadTimeDays);
}

export function reorderPoint(avgDailyUse: number, leadTimeDays: number, ss: number): number {
  return avgDailyUse * leadTimeDays + ss;
}

/** مقدار سفارش اقتصادی: √(2·D·S / H) */
export function eoq(annualDemand: number, orderCost: number, holdingCostPerUnit: number): number {
  if (holdingCostPerUnit <= 0) return 0;
  return Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit);
}

export type AbcItem = { code: string; annualValue: number };

/** طبقه‌بندی ABC بر مبنای ارزش تجمعی: ۷۰٪ → A، تا ۹۰٪ → B، بقیه → C. */
export function abcAnalysis(items: AbcItem[]): Record<string, "A" | "B" | "C"> {
  const sorted = [...items].sort((a, b) => b.annualValue - a.annualValue);
  const total = sorted.reduce((s, i) => s + i.annualValue, 0) || 1;
  const out: Record<string, "A" | "B" | "C"> = {};
  let cum = 0;
  for (const it of sorted) {
    cum += it.annualValue;
    const pct = (cum / total) * 100;
    out[it.code] = pct <= 70 ? "A" : pct <= 90 ? "B" : "C";
  }
  return out;
}

/** پیش‌بینی کسری: آیا موجودی پیش از رسیدن سفارش تمام می‌شود؟ */
export function stockoutRisk(onHand: number, avgDailyUse: number, daysToArrival: number): boolean {
  if (avgDailyUse <= 0) return false;
  return onHand / avgDailyUse < daysToArrival;
}

/* ══════════════════════════ EWS ماژول مالی/تأمین ══════════════════════════ */

export type FinAlert = { code: string; severity: "warning" | "high" | "critical"; message: string };

export function finEws(ctx: {
  cpi?: number | null;
  spi?: number;
  vacPct?: number | null;
  arOverdueDays?: number;
  poDelayDays?: number;
  vendorScore?: number;
  emergencyPrRatio?: number;
  reorderReached?: boolean;
  stockout?: boolean;
  wastagePct?: number;
}): FinAlert[] {
  const a: FinAlert[] = [];
  if (ctx.cpi !== null && ctx.cpi !== undefined && ctx.cpi < 0.85) a.push({ code: "EWS-FIN-01", severity: "critical", message: "CPI < 0.85 — نیاز به CR" });
  if (ctx.spi !== undefined && ctx.spi < 0.85) a.push({ code: "EWS-FIN-02", severity: "critical", message: "SPI < 0.85 — نیاز به CR" });
  if (ctx.vacPct !== null && ctx.vacPct !== undefined && ctx.vacPct < -10) a.push({ code: "EWS-FIN-03", severity: "critical", message: "VAC < −۱۰٪" });
  if ((ctx.arOverdueDays ?? 0) > 90) a.push({ code: "EWS-FIN-05", severity: "high", message: "مطالبات بالای ۹۰ روز" });
  if ((ctx.poDelayDays ?? 0) > 7) a.push({ code: "EWS-SUPP-02", severity: "high", message: "تأخیر تحویل PO بیش از ۷ روز" });
  if (ctx.vendorScore !== undefined && ctx.vendorScore < 60) a.push({ code: "EWS-SUPP-03", severity: "warning", message: "افت عملکرد تأمین‌کننده" });
  if ((ctx.emergencyPrRatio ?? 0) > 15) a.push({ code: "EWS-SUPP-04", severity: "high", message: "نسبت PR اضطراری بیش از ۱۵٪" });
  if (ctx.reorderReached) a.push({ code: "EWS-INV-01", severity: "warning", message: "رسیدن به نقطه سفارش مجدد" });
  if (ctx.stockout) a.push({ code: "EWS-INV-02", severity: "critical", message: "پیش‌بینی کسری کالا" });
  if ((ctx.wastagePct ?? 0) > 5) a.push({ code: "EWS-INV-04", severity: "warning", message: "ضایعات بیش از ۵٪" });
  return a;
}

/* ══════════════════════════ Snapshot غیرقابل تغییر ══════════════════════════ */

export type EvmSnapshot = {
  id: string;
  projectId: string;
  dataDate: string;
  formulaVersion: string;
  inputs: EvmInput;
  result: EvmResult;
  hash: string;
  createdAt: string;
  frozen: true;
};

/** سریال‌سازی قطعی: کلیدها در همه سطوح مرتب می‌شوند تا هش مستقل از ترتیب باشد. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

/** هش پایدار FNV-1a (۳۲ بیت) برای مهر تغییرناپذیری Snapshot. */
export function stableHash(obj: unknown): string {
  const s = stableStringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Snapshot فقط ساخته می‌شود؛ اصلاح آن ممنوع است (Object.freeze عمیق روی سطح اول). */
export function createEvmSnapshot(projectId: string, dataDate: string, inputs: EvmInput, createdAt = new Date().toISOString()): EvmSnapshot {
  const result = computeEvm(inputs);
  const body = { projectId, dataDate, formulaVersion: FIN_FORMULA_VERSION, inputs, result };
  const snap: EvmSnapshot = {
    id: `SNP-${projectId}-${dataDate}`,
    ...body,
    hash: stableHash(body),
    createdAt,
    frozen: true,
  };
  Object.freeze(snap.inputs);
  Object.freeze(snap.result);
  return Object.freeze(snap);
}

/** اعتبارسنجی Snapshot: دست‌کاری داده یا تغییر نسخه فرمول را آشکار می‌کند. */
export function verifySnapshot(snap: EvmSnapshot): { valid: boolean; reason?: string } {
  const body = {
    projectId: snap.projectId,
    dataDate: snap.dataDate,
    formulaVersion: snap.formulaVersion,
    inputs: snap.inputs,
    result: snap.result,
  };
  if (stableHash(body) !== snap.hash) return { valid: false, reason: "hash_mismatch" };
  if (snap.formulaVersion !== FIN_FORMULA_VERSION) return { valid: false, reason: "formula_version_drift" };
  return { valid: true };
}

/** مقایسه دو Snapshot با نسخه فرمول متفاوت ممنوع است. */
export function compareSnapshots(a: EvmSnapshot, b: EvmSnapshot): { comparable: boolean; deltaCpi: number | null; deltaSpi: number | null } {
  if (a.formulaVersion !== b.formulaVersion) return { comparable: false, deltaCpi: null, deltaSpi: null };
  return {
    comparable: true,
    deltaCpi: (b.result.cpi ?? 0) - (a.result.cpi ?? 0),
    deltaSpi: b.result.spi - a.result.spi,
  };
}

/* ══════════════════════════ تأمین‌کننده و پرداخت ══════════════════════════ */

export type VendorKpi = { onTimePct: number; qualityPct: number; pricePct: number; responsePct: number; hsePct: number };

/** امتیاز تأمین‌کننده: تحویل ۳۰٪ · کیفیت ۳۰٪ · قیمت ۲۰٪ · پاسخ‌گویی ۱۰٪ · HSE ۱۰٪ */
export function vendorScore(k: VendorKpi): { score: number; grade: "A" | "B" | "C" | "D"; blacklisted: boolean } {
  const score = k.onTimePct * 0.3 + k.qualityPct * 0.3 + k.pricePct * 0.2 + k.responsePct * 0.1 + k.hsePct * 0.1;
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  return { score: Math.round(score * 10) / 10, grade, blacklisted: score < 40 };
}

/** امتیاز فنی/مالی مناقصه؛ وزن فنی پیش‌فرض ۷۰٪. */
export function bidScore(technical: number, price: number, lowestPrice: number, technicalWeight = 0.7): number {
  const priceScore = price > 0 ? (lowestPrice / price) * 100 : 0;
  return Math.round((technical * technicalWeight + priceScore * (1 - technicalWeight)) * 10) / 10;
}

export type PaymentTerm = { label: string; pct: number; offsetDays: number };

/** زمان‌بندی پرداخت از تاریخ مبنا با شرایط پرداخت (پیش/میان/تسویه). */
export function paymentSchedule(baseIso: string, total: number, terms: PaymentTerm[]): { label: string; dueDate: string; amount: number }[] {
  return terms.map((t) => {
    const d = new Date(baseIso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + t.offsetDays);
    return { label: t.label, dueDate: d.toISOString().slice(0, 10), amount: (total * t.pct) / 100 };
  });
}

/** صورت‌وضعیت پیمانکاری (ایران): ناخالص − حسن انجام کار − پیش‌پرداخت مستهلک − کسورات قانونی. */
export function progressInvoice(gross: number, retentionPct = 10, advanceRecoveryPct = 0, legalDeductionsPct = 0): {
  gross: number; retention: number; advanceRecovery: number; legalDeductions: number; netPayable: number;
} {
  const retention = (gross * retentionPct) / 100;
  const advanceRecovery = (gross * advanceRecoveryPct) / 100;
  const legalDeductions = (gross * legalDeductionsPct) / 100;
  return { gross, retention, advanceRecovery, legalDeductions, netPayable: gross - retention - advanceRecovery - legalDeductions };
}

/** ذخیره احتیاطی (Reserve) فقط با مجوز DoA آزاد می‌شود. */
export function reserveDraw(available: number, request: number, approvedBy?: string): { ok: boolean; drawn: number; remaining: number; reason?: string } {
  if (!approvedBy) return { ok: false, drawn: 0, remaining: available, reason: "no_authority" };
  if (request > available) return { ok: false, drawn: 0, remaining: available, reason: "insufficient_reserve" };
  return { ok: true, drawn: request, remaining: available - request };
}
