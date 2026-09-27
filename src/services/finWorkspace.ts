/**
 * میز کار هزینه و تأمین d5 — مدل نمایش از دادهٔ ماندگار (LIVE-1)
 * ---------------------------------------------------------------------------
 * پیش از LIVE-1 همهٔ جدول‌های صفحهٔ d5 آرایهٔ ثابت درون کامپوننت بودند و
 * چند عدد کلیدی ساختگی بود: EV = PV×0.92، بودجهٔ در دسترس PR = بودجه −
 * AC×0.2، ورودی نقد = PMB×0.82/1.05، DIO = ۳۴ و تأخیر PO = ۱۱ ثابت.
 *
 * این فایل «خالص» است (بدون fetch و React) تا:
 *   • کامپوننت فقط نمایش دهد،
 *   • سرور همین محاسبه را برای Snapshot تغییرناپذیر EVM اجرا کند
 *     (بستهٔ `server/finWsLogic.js`)، و
 *   • آزمون واحد بدون مرورگر اجرا شود.
 *
 * ورودی همان سطرهای REST است (نام ستون‌ها PascalCase مثل جدول‌ها).
 * هر عددی که داده‌اش نیست `null` است، نه صفر جعلی.
 */
import {
  abcAnalysis,
  cbsAvailable,
  cbsRollup,
  ccc,
  commitmentView,
  computeEvm,
  distributeBudget,
  dpo,
  dso,
  eoq,
  finEws,
  irr,
  mrpRun,
  npv,
  payback,
  prBudgetCheck,
  reorderPoint,
  safetyStock,
  stockoutRisk,
  toBase,
  vendorScore,
  type CbsNode,
  type CurveType,
  type EvmInput,
  type FinAlert,
  type LedgerNode,
} from "./finance";

export const FIN_WS_VERSION = "finws-v1";
/** طول هر دوره بر حسب روز (دوره‌ها ماهانه‌اند). */
export const PERIOD_DAYS = 30;

/* ═══════════════════════ سطرهای REST ═══════════════════════ */

export type FinSettingRow = {
  DataDate: string;
  CurrentPeriod: number;
  PeriodCount: number;
  Curve?: CurveType | null;
  Rates?: Record<string, number> | null;
  BillingMarkupPct?: number | null;
  CollectionLagPeriods?: number | null;
  RetentionPct?: number | null;
  AdvanceRecoveryPct?: number | null;
  LegalDeductionPct?: number | null;
  MrpHorizonDays?: number | null;
};

export type CostAccountRow = {
  Id?: string; Code: string; TitleFa: string; ParentCode?: string | null;
  Kind?: "direct" | "indirect" | "reserve" | null;
  Category?: CbsNode["category"] | null;
  Budget: number; Committed?: number | null; Actual?: number | null;
  ProgressPct?: number | null; Currency?: string | null;
};

export type CostTransactionRow = {
  Id?: string; Code: string; CostAccountCode: string; DescriptionFa: string;
  Amount: number; Currency: string; BaseAmount: number; PeriodNo: number;
  TxnDate?: string | null; SourceType: "manual" | "po_invoice"; SourceRef?: string | null;
};

export type PrStatus = "draft" | "submitted" | "approved" | "rejected" | "converted" | "cancelled";
export type PurchaseRequisitionRow = {
  Id?: string; Code: string; MrCode?: string | null; TitleFa: string;
  Quantity?: number | null; Unit?: string | null; IsUrgent?: boolean | null;
  EstimatedAmount?: number | null; Currency?: string | null; CostAccountCode?: string | null;
  NeedByDate?: string | null; BudgetStatus?: string | null; Status: PrStatus;
  RequestedBy?: string | null; ApprovedBy?: string | null; RemarksFa?: string | null;
};

export type PoStatus = "draft" | "issued" | "acknowledged" | "partially_received" | "received" | "closed" | "cancelled";
export type PurchaseOrderRow = {
  Id?: string; PoNo: string; PrCode?: string | null; VendorName: string; TitleFa: string;
  IssuedAt?: string | null; PromisedDate?: string | null; DeliveredDate?: string | null;
  Amount?: number | null; Currency?: string | null; CostAccountCode?: string | null; Status: PoStatus;
  Quantity?: number | null; Unit?: string | null; UnitPrice?: number | null;
  ReceivedQty?: number | null; InvoicedQty?: number | null; InvoiceUnitPrice?: number | null; PaidAmount?: number | null;
  KpiOnTimePct?: number | null; KpiQualityPct?: number | null; KpiPricePct?: number | null;
  KpiResponsePct?: number | null; KpiHsePct?: number | null;
};

export type StockItemRow = {
  Id?: string; Code: string; NameFa: string; Unit?: string | null; OnHand: number;
  AvgDailyUse: number; MaxDailyUse: number; LeadTimeDays: number; UnitCost: number;
  OnOrder?: number | null; BatchNo?: string | null;
};

export type ReceivableRow = {
  Id?: string; Code: string; PartyFa: string; Amount: number; Currency?: string | null;
  DueDate: string; Status: "open" | "collected"; CollectedAt?: string | null;
};

export type EvmSnapshotRow = {
  Id?: string; DataDate: string; Pv: number; Ev: number; Ac: number; Bac?: number | null;
  Eac?: number | null; Spi?: number | null; Cpi?: number | null;
  FormulaVersion?: string | null; Hash?: string | null; Inputs?: EvmInput | null; CreatedAt?: string; CreatedBy?: string;
};

export type BudgetTransferRow = {
  Id?: string; Code: string; FromCode: string; ToCode: string; Amount: number;
  Authority: string; ReasonFa?: string | null; ApprovedBy: string; ApprovedAt: string;
};

export type FinWorkspaceData = {
  projectId: string;
  settings: FinSettingRow;
  accounts: CostAccountRow[];
  transactions: CostTransactionRow[];
  prs: PurchaseRequisitionRow[];
  pos: PurchaseOrderRow[];
  stock: StockItemRow[];
  receivables: ReceivableRow[];
  snapshots: EvmSnapshotRow[];
  transfers: BudgetTransferRow[];
};

/* ═══════════════════════ تنظیمات پیش‌فرض ═══════════════════════ */

/** تنظیمات کامل پس از اعمال پیش‌فرض‌ها (بدون null). */
export type ResolvedFinSettings = { [K in keyof FinSettingRow]-?: NonNullable<FinSettingRow[K]> };

export const DEFAULT_RATES: Record<string, number> = { IRR: 1, USD: 620_000, EUR: 680_000, CNY: 86_000 };

export function defaultFinSettings(dataDate: string): ResolvedFinSettings {
  return {
    DataDate: dataDate,
    CurrentPeriod: 1,
    PeriodCount: 12,
    Curve: "scurve",
    Rates: { ...DEFAULT_RATES },
    BillingMarkupPct: 8,
    CollectionLagPeriods: 2,
    RetentionPct: 10,
    AdvanceRecoveryPct: 20,
    LegalDeductionPct: 5,
    MrpHorizonDays: 60,
  };
}

/** تنظیمات ذخیره‌شده + پیش‌فرض برای ستون‌های خالی. */
export function resolveSettings(s: FinSettingRow): ResolvedFinSettings {
  const d = defaultFinSettings(s.DataDate);
  const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
  return {
    DataDate: s.DataDate,
    PeriodCount: Math.max(1, Math.round(num(s.PeriodCount, d.PeriodCount))),
    CurrentPeriod: Math.max(1, Math.round(num(s.CurrentPeriod, d.CurrentPeriod))),
    Curve: (s.Curve ?? d.Curve) as CurveType,
    Rates: { IRR: 1, ...(s.Rates ?? d.Rates) },
    BillingMarkupPct: num(s.BillingMarkupPct, d.BillingMarkupPct),
    CollectionLagPeriods: Math.max(0, Math.round(num(s.CollectionLagPeriods, d.CollectionLagPeriods))),
    RetentionPct: num(s.RetentionPct, d.RetentionPct),
    AdvanceRecoveryPct: num(s.AdvanceRecoveryPct, d.AdvanceRecoveryPct),
    LegalDeductionPct: num(s.LegalDeductionPct, d.LegalDeductionPct),
    MrpHorizonDays: Math.max(1, Math.round(num(s.MrpHorizonDays, d.MrpHorizonDays))),
  };
}

/* ═══════════════════════ کمکی‌ها ═══════════════════════ */

const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/** تبدیل امن به ارز پایه؛ نرخ ناموجود = null (نه صفر). */
export function safeBase(amount: number, currency: string | null | undefined, rates: Record<string, number>): number | null {
  try {
    return toBase({ amount: n(amount), currency: currency || "IRR" }, rates);
  } catch {
    return null;
  }
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(Date.parse(iso) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** مقادیر پایهٔ یک PO: ارزش، رسید، فاکتور، پرداخت. */
export function poValues(p: PurchaseOrderRow): { po: number; grn: number; invoiced: number; paid: number } {
  const price = p.UnitPrice ?? null;
  const po = p.Amount ?? (p.Quantity != null && price != null ? n(p.Quantity) * price : 0);
  const grn = price != null ? n(p.ReceivedQty) * price : 0;
  const invoiced = n(p.InvoicedQty) * n(p.InvoiceUnitPrice ?? price);
  return { po: n(po), grn, invoiced, paid: n(p.PaidAmount) };
}

/**
 * تطابق سه‌جانبهٔ تجمعی تا امروز (PO، رسید، فاکتور) با تلورانس ٪.
 * `threeWayMatch` پایه فاکتور را با کل مقدار PO می‌سنجد و هر تحویل جزئی
 * را «مسدود» نشان می‌دهد؛ اینجا فقط موارد واقعی مسدودکننده سنجیده می‌شود:
 * فاکتور بیش از رسید، فاکتور بیش از سفارش، یا انحراف قیمت.
 * بدون مقدار/قیمت یا فاکتور = null (چیزی برای تطبیق نیست).
 */
export function cumulativeMatch(p: PurchaseOrderRow, tolerancePct = 5): { ok: boolean; reasons: string[]; maxDeviationPct: number } | null {
  const ordered = n(p.Quantity);
  const price = n(p.UnitPrice);
  const inv = n(p.InvoicedQty);
  if (ordered <= 0 || price <= 0 || inv <= 0) return null;
  const recv = n(p.ReceivedQty);
  const invPrice = n(p.InvoiceUnitPrice ?? p.UnitPrice);
  const reasons: string[] = [];
  const overRecv = recv > 0 ? ((inv - recv) / recv) * 100 : 100;
  const overOrder = ((inv - ordered) / ordered) * 100;
  const priceDev = (Math.abs(invPrice - price) / price) * 100;
  if (overOrder > tolerancePct) reasons.push("qty_mismatch_po_invoice");
  if (overRecv > tolerancePct) reasons.push("qty_mismatch_grn_invoice");
  if (priceDev > tolerancePct) reasons.push("price_mismatch");
  return { ok: reasons.length === 0, reasons, maxDeviationPct: Math.max(0, overRecv, overOrder, priceDev) };
}

/** PO باز در تعهد حساب می‌شود (لغوشده و پیش‌نویس نه). */
export function poIsCommitted(p: PurchaseOrderRow): boolean {
  return p.Status !== "cancelled" && p.Status !== "draft";
}

/** تعهد یک حساب = Σ(ارزش PO − فاکتورشده) به ارز پایه، فقط POهای متعهد. */
export function committedForAccount(code: string, pos: PurchaseOrderRow[], rates: Record<string, number>): number {
  let sum = 0;
  for (const p of pos) {
    if (p.CostAccountCode !== code || !poIsCommitted(p)) continue;
    const v = poValues(p);
    const base = safeBase(Math.max(0, v.po - v.invoiced), p.Currency, rates);
    sum += base ?? 0;
  }
  return sum;
}

export function ledgerNodes(accounts: CostAccountRow[]): LedgerNode[] {
  return accounts.map((a) => ({
    code: a.Code,
    parent: a.ParentCode || null,
    budget: n(a.Budget),
    committed: n(a.Committed),
    actual: n(a.Actual),
  }));
}

/** مرجع تأیید بر پایهٔ ماتریس DoA (آستانه به دلار). */
export function prApprover(estimateBase: number, rates: Record<string, number>): "Manager" | "Dept Head" | "PM" | "Sponsor" | null {
  const usdRate = rates.USD;
  if (!usdRate) return null;
  const usd = estimateBase / usdRate;
  return usd < 10_000 ? "Manager" : usd < 100_000 ? "Dept Head" : usd < 500_000 ? "PM" : "Sponsor";
}

/* ═══════════════════════ EVM ═══════════════════════ */

export type EvmModel = {
  bac: number;
  reserve: number;
  pmb: number[];
  period: number;
  pvCum: number;
  ev: number;
  ac: number;
  /** آیا پیشرفت فیزیکی برای هیچ حسابی ثبت شده؟ اگر نه EV/CPI/SPI معنا ندارد. */
  evKnown: boolean;
  inputs: EvmInput;
};

export function evmModel(ws: Pick<FinWorkspaceData, "settings" | "accounts">): EvmModel {
  const st = resolveSettings(ws.settings);
  const nodes: CbsNode[] = ws.accounts.map((a) => ({
    code: a.Code,
    parent: a.ParentCode || undefined,
    nameFa: a.TitleFa,
    kind: (a.Kind ?? "direct") as CbsNode["kind"],
    category: (a.Category ?? "overhead") as CbsNode["category"],
    budget: n(a.Budget),
  }));
  const codes = new Set(nodes.map((x) => x.code));
  const roll = cbsRollup(nodes);
  const roots = nodes.filter((x) => !x.parent || !codes.has(x.parent));
  const bac = roots.reduce((s, r) => s + (roll[r.code] ?? 0), 0);
  const reserve = ws.accounts.filter((a) => a.Kind === "reserve").reduce((s, a) => s + n(a.Budget), 0);
  const pmb = distributeBudget(Math.max(0, bac - reserve), st.PeriodCount, st.Curve);
  const period = Math.min(st.CurrentPeriod, st.PeriodCount);
  const pvCum = pmb.slice(0, period).reduce((a, b) => a + b, 0);
  const measurable = ws.accounts.filter((a) => a.Kind !== "reserve" && n(a.Budget) > 0);
  const evKnown = measurable.some((a) => a.ProgressPct !== null && a.ProgressPct !== undefined);
  const ev = measurable.reduce((s, a) => s + (n(a.Budget) * Math.min(100, Math.max(0, n(a.ProgressPct)))) / 100, 0);
  const ac = ws.accounts.reduce((s, a) => s + n(a.Actual), 0);
  return {
    bac, reserve, pmb, period, pvCum, ev, ac, evKnown,
    inputs: { bac, pv: pvCum, ev, ac, pvCurve: pmb, period, reserveRemaining: reserve },
  };
}

/* ═══════════════════════ مدل کامل صفحه ═══════════════════════ */

export function buildFinView(ws: FinWorkspaceData) {
  const st = resolveSettings(ws.settings);
  const rates = st.Rates;
  const em = evmModel(ws);
  const evm = computeEvm(em.inputs);
  const nodes: CbsNode[] = ws.accounts.map((a) => ({
    code: a.Code, parent: a.ParentCode || undefined, nameFa: a.TitleFa,
    kind: (a.Kind ?? "direct") as CbsNode["kind"], category: (a.Category ?? "overhead") as CbsNode["category"], budget: n(a.Budget),
  }));
  const roll = cbsRollup(nodes);
  const ledger = ledgerNodes(ws.accounts);
  const vacPct = em.evKnown && evm.vac !== null && em.bac > 0 ? (evm.vac / em.bac) * 100 : null;
  const directPct = em.bac > 0 ? (ws.accounts.filter((a) => (a.Kind ?? "direct") === "direct").reduce((s, a) => s + n(a.Budget), 0) / em.bac) * 100 : null;

  /* ── تعهدها ── */
  const commitments = ws.pos.map((p) => {
    const v = poValues(p);
    const b = (x: number) => safeBase(x, p.Currency, rates);
    const vb = { po: b(v.po), grn: b(v.grn), invoiced: b(v.invoiced), paid: b(v.paid) };
    const rateMissing = vb.po === null;
    const view = commitmentView(
      { poValue: vb.po ?? 0, grnValue: vb.grn ?? 0, invoicedValue: vb.invoiced ?? 0, paidValue: vb.paid ?? 0 },
      em.bac - em.ac,
    );
    const k = [p.KpiOnTimePct, p.KpiQualityPct, p.KpiPricePct, p.KpiResponsePct, p.KpiHsePct];
    const score = k.every((x) => x !== null && x !== undefined)
      ? vendorScore({ onTimePct: n(k[0]), qualityPct: n(k[1]), pricePct: n(k[2]), responsePct: n(k[3]), hsePct: n(k[4]) })
      : null;
    /* تأخیر: تحویل‌شده = تحویل − قول؛ تحویل‌نشده و گذشته از قول = تأخیر جاری. */
    let delay: number | null = null;
    let delayOpen = false;
    if (p.PromisedDate) {
      if (p.DeliveredDate) delay = daysBetween(p.PromisedDate, p.DeliveredDate);
      else if (p.Status !== "cancelled" && daysBetween(p.PromisedDate, st.DataDate) > 0) {
        delay = daysBetween(p.PromisedDate, st.DataDate);
        delayOpen = true;
      }
    }
    const match = cumulativeMatch(p);
    return { row: p, values: v, view, score, delay, delayOpen, match, rateMissing, committed: poIsCommitted(p) };
  });
  const live = commitments.filter((c) => c.committed);
  const committedTotal = live.reduce((s, c) => s + c.view.committed, 0);
  const accruedTotal = live.reduce((s, c) => s + c.view.accrued, 0);
  const outstandingTotal = live.reduce((s, c) => s + c.view.outstandingPayment, 0);
  const uncommitted = em.bac - em.ac - committedTotal;

  /* ── درخواست خرید ── */
  const prs = ws.prs.map((p) => {
    const est = p.EstimatedAmount != null ? safeBase(p.EstimatedAmount, p.Currency, rates) : null;
    const available = p.CostAccountCode ? cbsAvailable(ledger, p.CostAccountCode) : null;
    const check = est === null || available === null ? null : prBudgetCheck(est, available, false);
    return { row: p, estimateBase: est, available, check, approver: est === null ? null : prApprover(est, rates) };
  });
  const openPrs = ws.prs.filter((p) => p.Status === "draft" || p.Status === "submitted" || p.Status === "approved");
  const emergencyPct = ws.prs.length ? (ws.prs.filter((p) => p.IsUrgent).length / ws.prs.length) * 100 : null;

  /* ── انبار ── */
  const stock = ws.stock.map((s) => {
    const ss = safetyStock(n(s.AvgDailyUse), n(s.MaxDailyUse), n(s.LeadTimeDays));
    const rop = reorderPoint(n(s.AvgDailyUse), n(s.LeadTimeDays), ss);
    return {
      row: s, ss, rop,
      eoq: n(s.UnitCost) > 0 ? eoq(n(s.AvgDailyUse) * 365, 18_000_000, n(s.UnitCost) * 0.18) : 0,
      risk: stockoutRisk(n(s.OnHand), n(s.AvgDailyUse), n(s.LeadTimeDays)),
      reorder: n(s.OnHand) <= rop,
      value: n(s.OnHand) * n(s.UnitCost),
    };
  });
  const abc = abcAnalysis(ws.stock.map((s) => ({ code: s.Code, annualValue: n(s.AvgDailyUse) * 365 * n(s.UnitCost) })));
  const inventoryValue = stock.reduce((s, x) => s + x.value, 0);
  const dailyUseValue = ws.stock.reduce((s, x) => s + n(x.AvgDailyUse) * n(x.UnitCost), 0);
  const mrpNeedDate = addDays(st.DataDate, st.MrpHorizonDays);
  const mrp = mrpRun(ws.stock.map((s) => ({
    materialCode: s.Code,
    requiredQty: n(s.AvgDailyUse) * st.MrpHorizonDays,
    onHand: n(s.OnHand),
    onOrder: n(s.OnOrder),
    safetyStock: safetyStock(n(s.AvgDailyUse), n(s.MaxDailyUse), n(s.LeadTimeDays)),
    leadTimeDays: n(s.LeadTimeDays),
    activityStart: mrpNeedDate,
  })));

  /* ── نقدینگی: گذشته از هزینهٔ ثبت‌شده، آینده از PMB؛ ورودی با فرض صریح ── */
  const actualByPeriod: Record<number, number> = {};
  for (const t of ws.transactions) actualByPeriod[t.PeriodNo] = (actualByPeriod[t.PeriodNo] ?? 0) + n(t.BaseAmount);
  const outflow = em.pmb.map((pv, i) => (i + 1 <= em.period ? actualByPeriod[i + 1] ?? 0 : pv));
  const inflow = em.pmb.map((_, i) => (i - st.CollectionLagPeriods >= 0 ? em.pmb[i - st.CollectionLagPeriods] * (1 + st.BillingMarkupPct / 100) : 0));
  const netFlow = inflow.map((v, i) => v - outflow[i]);
  const netCum = netFlow.map((_, i) => netFlow.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const monthlyRate = Math.pow(1.18, 1 / 12) - 1;
  const irrPeriod = irr(netFlow);
  const openAr = ws.receivables.filter((r) => r.Status === "open");
  const ar = ws.receivables.map((r) => ({
    row: r,
    base: safeBase(r.Amount, r.Currency, rates),
    overdue: r.Status === "open" ? Math.max(0, daysBetween(r.DueDate, st.DataDate)) : 0,
  }));
  const arTotal = ar.filter((x) => x.row.Status === "open").reduce((s, x) => s + (x.base ?? 0), 0);
  const elapsedDays = em.period * PERIOD_DAYS;
  const billedToDate = inflow.slice(0, em.period).reduce((a, b) => a + b, 0);
  const dsoV = billedToDate > 0 ? dso(arTotal, billedToDate, elapsedDays) : null;
  const dpoV = em.ac > 0 ? dpo(outstandingTotal, em.ac, elapsedDays) : null;
  const dioV = dailyUseValue > 0 ? inventoryValue / dailyUseValue : null;
  const cccV = dsoV !== null && dpoV !== null && dioV !== null ? ccc(dsoV, dioV, dpoV) : null;

  /* ── هشدارها ── */
  const delays = commitments.map((c) => c.delay ?? 0).filter((d) => d > 0);
  const scores = commitments.map((c) => c.score?.score).filter((x): x is number => typeof x === "number");
  const overdueDays = ar.map((x) => x.overdue);
  const alerts: FinAlert[] = finEws({
    cpi: em.evKnown ? evm.cpi : null,
    spi: em.evKnown ? evm.spi : undefined,
    vacPct,
    arOverdueDays: overdueDays.length ? Math.max(...overdueDays) : undefined,
    poDelayDays: delays.length ? Math.max(...delays) : undefined,
    vendorScore: scores.length ? Math.min(...scores) : undefined,
    emergencyPrRatio: emergencyPct ?? undefined,
    reorderReached: stock.some((s) => s.reorder),
    stockout: stock.some((s) => s.risk),
  });

  return {
    settings: st,
    empty: ws.accounts.length === 0 && ws.pos.length === 0 && ws.prs.length === 0 && ws.stock.length === 0 && ws.transactions.length === 0 && ws.receivables.length === 0,
    roll,
    ...em,
    evm,
    vacPct,
    directPct,
    commitments,
    committedTotal,
    accruedTotal,
    outstandingTotal,
    uncommitted,
    prs,
    openPrCount: openPrs.length,
    emergencyPct,
    stock,
    abc,
    inventoryValue,
    mrp,
    mrpNeedDate,
    cash: {
      inflow, outflow, netFlow, netCum,
      npv: netFlow.length ? npv(monthlyRate, netFlow) : null,
      irrAnnual: irrPeriod === null ? null : Math.pow(1 + irrPeriod, 12) - 1,
      paybackPeriods: payback(netFlow),
    },
    ar,
    arTotal,
    openArCount: openAr.length,
    dso: dsoV,
    dpo: dpoV,
    dio: dioV,
    ccc: cccV,
    alerts,
  };
}

export type FinView = ReturnType<typeof buildFinView>;

/* ═══════════════════════ دادهٔ نمونه (فقط با درخواست صریح) ═══════════════════════
 * همان نمونهٔ پیشین صفحه، این بار به شکل سطرهای جدول. سرور فقط وقتی
 * بارگذاری می‌کند که پروژه خالی باشد و کاربر دکمهٔ «بارگذاری دادهٔ نمونه»
 * را بزند؛ هیچ‌گاه خودکار نیست. */

export const FIN_SAMPLE: Omit<FinWorkspaceData, "projectId" | "snapshots" | "transfers"> = {
  settings: { ...defaultFinSettings("2026-09-08"), CurrentPeriod: 9 },
  accounts: [
    { Code: "1", TitleFa: "پروژه آزادگان", Kind: "direct", Category: "labor", Budget: 0 },
    { Code: "1.1", ParentCode: "1", TitleFa: "مهندسی", Kind: "direct", Category: "labor", Budget: 42_000_000_000, ProgressPct: 78 },
    { Code: "1.2", ParentCode: "1", TitleFa: "تدارکات", Kind: "direct", Category: "material", Budget: 0 },
    { Code: "1.2.1", ParentCode: "1.2", TitleFa: "تجهیزات دوار", Kind: "direct", Category: "equipment", Budget: 96_000_000_000, ProgressPct: 55 },
    { Code: "1.2.2", ParentCode: "1.2", TitleFa: "متریال بالک", Kind: "direct", Category: "material", Budget: 58_000_000_000, ProgressPct: 48 },
    { Code: "1.3", ParentCode: "1", TitleFa: "اجرا و نصب", Kind: "direct", Category: "subcontract", Budget: 121_000_000_000, ProgressPct: 35 },
    { Code: "1.4", ParentCode: "1", TitleFa: "بالاسری کارگاه", Kind: "indirect", Category: "overhead", Budget: 23_000_000_000, ProgressPct: 70 },
    { Code: "1.5", ParentCode: "1", TitleFa: "ذخیره احتیاطی", Kind: "reserve", Category: "overhead", Budget: 18_000_000_000 },
  ],
  transactions: [
    { Code: "TX-1041", CostAccountCode: "1.1", DescriptionFa: "خدمات مهندسی فاز ۲", Amount: 14_200_000_000, Currency: "IRR", BaseAmount: 0, PeriodNo: 7, SourceType: "manual" },
    { Code: "TX-1042", CostAccountCode: "1.2.1", DescriptionFa: "پیش‌پرداخت کمپرسور", Amount: 78_000, Currency: "USD", BaseAmount: 0, PeriodNo: 7, SourceType: "manual" },
    { Code: "TX-1043", CostAccountCode: "1.3", DescriptionFa: "صورت‌وضعیت پیمانکار سیویل ۵", Amount: 31_500_000_000, Currency: "IRR", BaseAmount: 0, PeriodNo: 8, SourceType: "manual" },
    { Code: "TX-1044", CostAccountCode: "1.2.2", DescriptionFa: "میلگرد و سیمان", Amount: 12_800_000_000, Currency: "IRR", BaseAmount: 0, PeriodNo: 8, SourceType: "manual" },
    { Code: "TX-1045", CostAccountCode: "1.4", DescriptionFa: "هزینه بالاسری شهریور", Amount: 2_400_000_000, Currency: "IRR", BaseAmount: 0, PeriodNo: 9, SourceType: "manual" },
  ],
  prs: [
    { Code: "PR-2026-114", TitleFa: "شیر پروانه‌ای ۲۴ اینچ", Quantity: 12, Unit: "عدد", EstimatedAmount: 4_800_000_000, Currency: "IRR", CostAccountCode: "1.2.1", NeedByDate: "2026-11-20", IsUrgent: false, Status: "submitted" },
    { Code: "PR-2026-115", TitleFa: "کابل قدرت ۱۸۵×۳", Quantity: 3200, Unit: "متر", EstimatedAmount: 9_600_000_000, Currency: "IRR", CostAccountCode: "1.2.2", NeedByDate: "2026-10-05", IsUrgent: true, Status: "draft" },
    { Code: "PR-2026-116", TitleFa: "سیمان تیپ ۲", Quantity: 850, Unit: "تن", EstimatedAmount: 2_100_000_000, Currency: "IRR", CostAccountCode: "1.2.2", NeedByDate: "2026-09-28", IsUrgent: false, Status: "approved" },
  ],
  pos: [
    {
      PoNo: "PO-2026-058", VendorName: "صنایع پمپ البرز", TitleFa: "پمپ‌های سانتریفیوژ", Quantity: 12, Unit: "دستگاه", UnitPrice: 8_000_000_000, Amount: 96_000_000_000,
      ReceivedQty: 8, InvoicedQty: 6, InvoiceUnitPrice: 8_000_000_000, PaidAmount: 30_000_000_000, Currency: "IRR", CostAccountCode: "1.2.1",
      IssuedAt: "2026-04-10", PromisedDate: "2026-09-01", DeliveredDate: "2026-09-14", Status: "partially_received",
      KpiOnTimePct: 62, KpiQualityPct: 88, KpiPricePct: 80, KpiResponsePct: 75, KpiHsePct: 90,
    },
    {
      PoNo: "PO-2026-061", VendorName: "Sinopec Equipment", TitleFa: "کمپرسور گاز", Quantity: 1, Unit: "set", UnitPrice: 145_000, Amount: 145_000,
      ReceivedQty: 1, InvoicedQty: 1, InvoiceUnitPrice: 145_000, PaidAmount: 96_000, Currency: "USD", CostAccountCode: "1.2.1",
      IssuedAt: "2026-03-02", PromisedDate: "2026-08-20", DeliveredDate: "2026-08-18", Status: "received",
      KpiOnTimePct: 95, KpiQualityPct: 92, KpiPricePct: 70, KpiResponsePct: 85, KpiHsePct: 88,
    },
    {
      PoNo: "PO-2026-063", VendorName: "فولاد ساختمانی پارس", TitleFa: "میلگرد A3", Quantity: 900, Unit: "تن", UnitPrice: 37_800_000, Amount: 34_020_000_000,
      ReceivedQty: 290, InvoicedQty: 160, InvoiceUnitPrice: 43_500_000, PaidAmount: 6_000_000_000, Currency: "IRR", CostAccountCode: "1.2.2",
      IssuedAt: "2026-07-15", PromisedDate: "2026-09-25", Status: "partially_received",
      KpiOnTimePct: 55, KpiQualityPct: 60, KpiPricePct: 65, KpiResponsePct: 50, KpiHsePct: 58,
    },
  ],
  stock: [
    { Code: "CEM-42", NameFa: "سیمان تیپ ۲", Unit: "تن", OnHand: 180, AvgDailyUse: 14, MaxDailyUse: 22, LeadTimeDays: 12, UnitCost: 2_400_000, OnOrder: 300, BatchNo: "B-2609-A" },
    { Code: "RBR-18", NameFa: "میلگرد A3 قطر ۱۸", Unit: "تن", OnHand: 46, AvgDailyUse: 6, MaxDailyUse: 11, LeadTimeDays: 20, UnitCost: 38_000_000, OnOrder: 0, BatchNo: "B-2608-K" },
    { Code: "CBL-185", NameFa: "کابل قدرت ۱۸۵", Unit: "متر", OnHand: 640, AvgDailyUse: 95, MaxDailyUse: 140, LeadTimeDays: 30, UnitCost: 3_100_000, OnOrder: 1200, BatchNo: "B-2607-C" },
    { Code: "VLV-24", NameFa: "شیر پروانه‌ای ۲۴ اینچ", Unit: "عدد", OnHand: 2, AvgDailyUse: 0.4, MaxDailyUse: 1.2, LeadTimeDays: 90, UnitCost: 410_000_000, OnOrder: 6, BatchNo: "B-2606-V" },
  ],
  receivables: [
    { Code: "AR-311", PartyFa: "کارفرما — صورت‌وضعیت ۴", Amount: 88_000_000_000, Currency: "IRR", DueDate: "2026-08-17", Status: "open" },
    { Code: "AR-312", PartyFa: "کارفرما — صورت‌وضعیت ۳", Amount: 41_000_000_000, Currency: "IRR", DueDate: "2026-06-26", Status: "open" },
    { Code: "AR-313", PartyFa: "تعدیل مصالح ۱۴۰۴", Amount: 19_500_000_000, Currency: "IRR", DueDate: "2026-05-03", Status: "open" },
  ],
};
