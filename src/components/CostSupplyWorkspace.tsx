import { useEffect, useMemo, useState } from "react";
import { t, type Bi, type Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import {
  FIN_FORMULA_VERSION,
  abcAnalysis,
  agingBucket,
  cbsRollup,
  ccc,
  commitmentView,
  computeEvm,
  createEvmSnapshot,
  distributeBudget,
  dpo,
  dso,
  eoq,
  finEws,
  irr,
  materialNeedDate,
  mrpRun,
  needsAutoCr,
  npv,
  payback,
  prBudgetCheck,
  progressInvoice,
  reorderPoint,
  reserveDraw,
  safetyStock,
  stockoutRisk,
  threeWayMatch,
  toBase,
  varianceSeverity,
  vendorScore,
  verifySnapshot,
  type CbsNode,
  type CurveType,
  type EvmSnapshot,
} from "../services/finance";

/* شش تب = دقیقاً همان شش زیرماژول d5؛ نام‌ها تغییرناپذیرند (BC). */
export type FinTab = "cost" | "control" | "cash" | "pr" | "po" | "inventory";

const TABS: { id: FinTab; fa: string; en: string; icon: string; proc: string }[] = [
  { id: "cost", fa: "مدیریت هزینه", en: "Cost Management", icon: "💰", proc: "d5-p1" },
  { id: "control", fa: "کنترل هزینه", en: "Cost Control", icon: "📊", proc: "d5-p2" },
  { id: "cash", fa: "جریان نقدی", en: "Cash Flow", icon: "💵", proc: "d5-p3" },
  { id: "pr", fa: "درخواست خرید", en: "Purchase Request", icon: "📝", proc: "d5-p4" },
  { id: "po", fa: "سفارش خرید", en: "Purchase Order", icon: "📦", proc: "d5-p5" },
  { id: "inventory", fa: "مدیریت کالا و انبار", en: "Material & Warehouse", icon: "🏗", proc: "d5-p6" },
];

const RATES: Record<string, number> = { IRR: 1, USD: 620_000, EUR: 680_000, CNY: 86_000 };
const DATA_DATE = "2026-09-08";

/* ─────────────── داده نمونه (تا اتصال ERP در M6) ─────────────── */

const CBS: CbsNode[] = [
  { code: "1", nameFa: "پروژه آزادگان", kind: "direct", category: "labor", budget: 0 },
  { code: "1.1", parent: "1", nameFa: "مهندسی", kind: "direct", category: "labor", budget: 42_000_000_000 },
  { code: "1.2", parent: "1", nameFa: "تدارکات", kind: "direct", category: "material", budget: 0 },
  { code: "1.2.1", parent: "1.2", nameFa: "تجهیزات دوار", kind: "direct", category: "equipment", budget: 96_000_000_000 },
  { code: "1.2.2", parent: "1.2", nameFa: "متریال بالک", kind: "direct", category: "material", budget: 58_000_000_000 },
  { code: "1.3", parent: "1", nameFa: "اجرا و نصب", kind: "direct", category: "subcontract", budget: 121_000_000_000 },
  { code: "1.4", parent: "1", nameFa: "بالاسری کارگاه", kind: "indirect", category: "overhead", budget: 23_000_000_000 },
  { code: "1.5", parent: "1", nameFa: "ذخیره احتیاطی", kind: "reserve", category: "overhead", budget: 18_000_000_000 },
];

type Txn = { id: string; cbs: string; desc: Bi; amount: number; currency: string; period: number };
const TXNS: Txn[] = [
  { id: "TX-1041", cbs: "1.1", desc: { fa: "خدمات مهندسی فاز ۲", en: "Phase 2 engineering" }, amount: 14_200_000_000, currency: "IRR", period: 7 },
  { id: "TX-1042", cbs: "1.2.1", desc: { fa: "پیش‌پرداخت کمپرسور", en: "Compressor advance" }, amount: 78_000, currency: "USD", period: 7 },
  { id: "TX-1043", cbs: "1.3", desc: { fa: "صورت‌وضعیت پیمانکار سیویل ۵", en: "Civil IPC #5" }, amount: 31_500_000_000, currency: "IRR", period: 8 },
  { id: "TX-1044", cbs: "1.2.2", desc: { fa: "میلگرد و سیمان", en: "Rebar & cement" }, amount: 12_800_000_000, currency: "IRR", period: 8 },
  { id: "TX-1045", cbs: "1.4", desc: { fa: "هزینه بالاسری شهریور", en: "September overhead" }, amount: 2_400_000_000, currency: "IRR", period: 9 },
];

type PrRow = { id: string; itemFa: string; qty: number; est: number; cbs: string; needDate: string; urgent: boolean; status: "draft" | "budget" | "approval" | "released" };
const PRS: PrRow[] = [
  { id: "PR-2026-114", itemFa: "شیر پروانه‌ای ۲۴ اینچ", qty: 12, est: 4_800_000_000, cbs: "1.2.1", needDate: "2026-11-20", urgent: false, status: "approval" },
  { id: "PR-2026-115", itemFa: "کابل قدرت ۱۸۵×۳", qty: 3200, est: 9_600_000_000, cbs: "1.2.2", needDate: "2026-10-05", urgent: true, status: "budget" },
  { id: "PR-2026-116", itemFa: "سیمان تیپ ۲ (تن)", qty: 850, est: 2_100_000_000, cbs: "1.2.2", needDate: "2026-09-28", urgent: false, status: "released" },
];

type PoRow = {
  id: string; vendorFa: string; po: number; grn: number; invoiced: number; paid: number;
  currency: string; promised: string; actual?: string;
  kpi: { onTimePct: number; qualityPct: number; pricePct: number; responsePct: number; hsePct: number };
};
const POS: PoRow[] = [
  { id: "PO-2026-058", vendorFa: "صنایع پمپ البرز", po: 96_000_000_000, grn: 62_000_000_000, invoiced: 48_000_000_000, paid: 30_000_000_000, currency: "IRR", promised: "2026-09-01", actual: "2026-09-12", kpi: { onTimePct: 72, qualityPct: 88, pricePct: 80, responsePct: 75, hsePct: 82 } },
  { id: "PO-2026-061", vendorFa: "Sinopec Equipment", po: 145_000, grn: 145_000, invoiced: 145_000, paid: 96_000, currency: "USD", promised: "2026-08-20", actual: "2026-08-18", kpi: { onTimePct: 95, qualityPct: 92, pricePct: 76, responsePct: 90, hsePct: 88 } },
  { id: "PO-2026-063", vendorFa: "فولاد ساختمانی پارس", po: 34_000_000_000, grn: 11_000_000_000, invoiced: 6_000_000_000, paid: 6_000_000_000, currency: "IRR", promised: "2026-09-25", kpi: { onTimePct: 58, qualityPct: 64, pricePct: 91, responsePct: 55, hsePct: 60 } },
];

type StockRow = { code: string; nameFa: string; onHand: number; avgUse: number; maxUse: number; lead: number; unitCost: number; onOrder: number; batch: string };
const STOCK: StockRow[] = [
  { code: "CEM-42", nameFa: "سیمان تیپ ۲ (تن)", onHand: 180, avgUse: 14, maxUse: 22, lead: 12, unitCost: 2_400_000, onOrder: 300, batch: "B-2609-A" },
  { code: "RBR-18", nameFa: "میلگرد A3 قطر ۱۸ (تن)", onHand: 46, avgUse: 6, maxUse: 11, lead: 20, unitCost: 38_000_000, onOrder: 0, batch: "B-2608-K" },
  { code: "CBL-185", nameFa: "کابل قدرت ۱۸۵ (متر)", onHand: 640, avgUse: 95, maxUse: 140, lead: 30, unitCost: 3_100_000, onOrder: 1200, batch: "B-2607-C" },
  { code: "VLV-24", nameFa: "شیر پروانه‌ای ۲۴ اینچ", onHand: 2, avgUse: 0.4, maxUse: 1.2, lead: 90, unitCost: 410_000_000, onOrder: 6, batch: "B-2606-V" },
];

const AR = [
  { id: "AR-311", partyFa: "کارفرما — صورت‌وضعیت ۴", amount: 88_000_000_000, overdue: 22 },
  { id: "AR-312", partyFa: "کارفرما — صورت‌وضعیت ۳", amount: 41_000_000_000, overdue: 74 },
  { id: "AR-313", partyFa: "تعدیل مصالح ۱۴۰۴", amount: 19_500_000_000, overdue: 128 },
];

/* ─────────────── اجزای کوچک ─────────────── */

function Kpi({ label, value, hint, tone = "tx1" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
      <div className="text-[8.5px] font-extralight tx3">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums ${tone}`} dir="ltr">{value}</div>
      {hint && <div className="text-[8px] font-extralight tx4">{hint}</div>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h4 className="text-[11px] font-semibold tx1">{title}</h4>
        {note && <span className="text-[8.5px] font-extralight tx3">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Bars({ values, colors }: { values: number[]; colors?: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-20 items-end gap-1">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(3, (v / max) * 100)}%`, background: colors?.[i] ?? "rgba(56,189,248,0.55)" }} title={String(Math.round(v))} />
      ))}
    </div>
  );
}

const fmtB = (n: number, rtl: boolean) => `${(n / 1_000_000_000).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}${rtl ? " میلیارد" : "B"}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/* ══════════════════════════ کامپوننت اصلی ══════════════════════════ */

export default function CostSupplyWorkspace({
  lang,
  initialTab = "cost",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: FinTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<FinTab>(initialTab);
  const [curve, setCurve] = useState<CurveType>("scurve");
  const [snapshots, setSnapshots] = useState<EvmSnapshot[]>([]);
  const [reserve, setReserve] = useState(18_000_000_000);
  const [reserveMsg, setReserveMsg] = useState<string | null>(null);
  useEffect(() => setTab(initialTab), [initialTab]);

  /* بودجه و PMB */
  const roll = useMemo(() => cbsRollup(CBS), []);
  const bac = roll["1"] ?? 0;
  const pmb = useMemo(() => distributeBudget(bac - reserve, 12, curve), [bac, curve, reserve]);
  const period = 9;
  const pvCum = pmb.slice(0, period).reduce((a, b) => a + b, 0);

  /* هزینه واقعی (AC) — مالک d5 */
  const ac = useMemo(() => TXNS.reduce((s, x) => s + toBase({ amount: x.amount, currency: x.currency }, RATES), 0), []);
  const ev = pvCum * 0.92;
  const evm = useMemo(
    () => computeEvm({ bac, pv: pvCum, ev, ac, pvCurve: pmb, period, reserveRemaining: reserve }),
    [bac, pvCum, ev, ac, pmb, reserve]
  );
  const vacPct = evm.vac !== null ? (evm.vac / bac) * 100 : null;
  const sev = varianceSeverity(evm.cpi ? (evm.cpi - 1) * 100 : 0);

  /* تعهدها */
  const commitments = useMemo(
    () =>
      POS.map((p) => {
        const c = (v: number) => toBase({ amount: v, currency: p.currency }, RATES);
        return {
          row: p,
          view: commitmentView({ poValue: c(p.po), grnValue: c(p.grn), invoicedValue: c(p.invoiced), paidValue: c(p.paid) }, bac - ac),
          score: vendorScore(p.kpi),
        };
      }),
    [bac, ac]
  );
  const committedTotal = commitments.reduce((s, c) => s + c.view.committed, 0);
  const accruedTotal = commitments.reduce((s, c) => s + c.view.accrued, 0);

  /* انبار */
  const stock = useMemo(
    () =>
      STOCK.map((s) => {
        const ss = safetyStock(s.avgUse, s.maxUse, s.lead);
        return {
          ...s,
          ss,
          rop: reorderPoint(s.avgUse, s.lead, ss),
          eoq: eoq(s.avgUse * 365, 18_000_000, s.unitCost * 0.18),
          risk: stockoutRisk(s.onHand, s.avgUse, s.lead),
          value: s.onHand * s.unitCost,
        };
      }),
    []
  );
  const abc = useMemo(() => abcAnalysis(STOCK.map((s) => ({ code: s.code, annualValue: s.avgUse * 365 * s.unitCost }))), []);

  /* MRP */
  const mrp = useMemo(
    () =>
      mrpRun(
        STOCK.map((s) => ({
          materialCode: s.code,
          requiredQty: s.avgUse * 60,
          onHand: s.onHand,
          onOrder: s.onOrder,
          safetyStock: safetyStock(s.avgUse, s.maxUse, s.lead),
          leadTimeDays: s.lead,
          activityStart: "2026-11-01",
        }))
      ),
    []
  );

  /* نقدینگی */
  const inflow = pmb.map((v, i) => v * (i < 6 ? 0.82 : 1.05));
  const outflow = pmb.map((v) => v * 0.96);
  const netCum = inflow.map((_, i) => inflow.slice(0, i + 1).reduce((a, b) => a + b, 0) - outflow.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const arTotal = AR.reduce((s, r) => s + r.amount, 0);
  const dsoV = dso(arTotal, bac * 0.7);
  const dpoV = dpo(committedTotal, ac || 1);
  const dioV = 34;
  const projIrr = irr([-bac * 0.25, ...netCum.slice(0, 8).map((v, i, a) => (i === 0 ? v : v - a[i - 1]))]);

  const alerts = finEws({
    cpi: evm.cpi,
    spi: evm.spi,
    vacPct,
    arOverdueDays: Math.max(...AR.map((r) => r.overdue)),
    poDelayDays: 11,
    vendorScore: Math.min(...commitments.map((c) => c.score.score)),
    emergencyPrRatio: (PRS.filter((p) => p.urgent).length / PRS.length) * 100,
    reorderReached: stock.some((s) => s.onHand <= s.rop),
    stockout: stock.some((s) => s.risk),
    wastagePct: 3.2,
  });

  const takeSnapshot = () => {
    const snap = createEvmSnapshot("c1-p1", DATA_DATE, { bac, pv: pvCum, ev, ac, pvCurve: pmb, period, reserveRemaining: reserve });
    setSnapshots((prev) => (prev.some((s) => s.id === snap.id) ? prev : [snap, ...prev]));
    logAudit("EVM_SNAPSHOT", "Cost", `Immutable EVM snapshot ${snap.id} · ${snap.formulaVersion} · hash ${snap.hash}`);
  };

  const drawReserve = () => {
    const r = reserveDraw(reserve, 4_000_000_000, "PM");
    if (r.ok) {
      setReserve(r.remaining);
      setReserveMsg(rtl ? "۴ میلیارد از ذخیره با مجوز PM آزاد شد" : "4B reserve released under PM authority");
      logAudit("RESERVE_DRAW", "Cost", "Reserve draw 4B approved by PM (DoA)");
    } else setReserveMsg(rtl ? "برداشت رد شد: بدون اختیار یا فاقد موجودی" : `Rejected: ${r.reason}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* هدر */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-[15px]">💰</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">{rtl ? "مدیریت هزینه، تأمین و لجستیک" : "Cost, Supply & Logistics"}</h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "تعهد پیش از هزینه · Snapshot تغییرناپذیر · تطابق سه‌جانبه پیش از پرداخت · چندارزی بومی"
                : "Commitment first · immutable snapshots · 3-way match before payment · multi-currency native"}
            </p>
          </div>
          <span className="rounded-lg bg-amber-400/15 px-2 py-1 text-[10px] font-semibold tabular-nums text-amber-200" dir="ltr">
            BAC {fmtB(bac, rtl)}
          </span>
          <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums ${(evm.cpi ?? 1) < 1 ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/15 text-emerald-300"}`} dir="ltr">
            CPI {evm.cpi?.toFixed(3) ?? "—"}
          </span>
          <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums ${evm.spi < 1 ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/15 text-emerald-300"}`} dir="ltr">
            SPI {evm.spi.toFixed(3)}
          </span>
          <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[9px] tx3" dir="ltr">{FIN_FORMULA_VERSION} · {DATA_DATE}</span>
        </div>
        {alerts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alerts.map((a) => (
              <span
                key={a.code}
                className={`rounded-lg px-2 py-0.5 text-[8.5px] ${
                  a.severity === "critical" ? "bg-rose-400/15 text-rose-300" : a.severity === "high" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"
                }`}
              >
                <span dir="ltr">{a.code}</span> · {a.message}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* تب‌ها = شش زیرماژول (نام‌ها ثابت) */}
      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
          {TABS.map((it) => (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition ${tab === it.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
              title={it.proc}
            >
              <span>{it.icon}</span>
              <span>{rtl ? it.fa : it.en}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* ═══ تب ۱: مدیریت هزینه ═══ */}
        {tab === "cost" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Kpi label={rtl ? "بودجه کل (BAC)" : "BAC"} value={fmtB(bac, rtl)} hint="CBS rollup" />
              <Kpi label={rtl ? "مبنای اندازه‌گیری (PMB)" : "PMB"} value={fmtB(bac - reserve, rtl)} hint={rtl ? "بدون ذخیره" : "excl. reserve"} />
              <Kpi label={rtl ? "ذخیره احتیاطی" : "Reserve"} value={fmtB(reserve, rtl)} tone="text-amber-200" hint="DoA guarded" />
              <Kpi label={rtl ? "مستقیم / غیرمستقیم" : "Direct / Indirect"} value={`${Math.round((CBS.filter((c) => c.kind === "direct").reduce((s, c) => s + c.budget, 0) / bac) * 100)}%`} />
              <Kpi label={rtl ? "نرخ دلار مبنا" : "USD rate"} value={RATES.USD.toLocaleString("en-US")} hint="multi-currency" />
            </div>

            <Section title={rtl ? "ساختار شکست هزینه (CBS) — جمع چندسطحی" : "Cost Breakdown Structure"} note={rtl ? "بودجه هر گره شامل فرزندان" : "rollup incl. children"}>
              <div className="overflow-x-auto">
                <table className="w-full text-[9.5px]">
                  <thead className="tx3">
                    <tr className="border-b b-line-soft text-start">
                      <th className="px-2 py-1 text-start">{rtl ? "کد" : "Code"}</th>
                      <th className="px-2 py-1 text-start">{rtl ? "عنوان" : "Name"}</th>
                      <th className="px-2 py-1 text-start">{rtl ? "نوع" : "Kind"}</th>
                      <th className="px-2 py-1 text-start">{rtl ? "بودجه گره" : "Own"}</th>
                      <th className="px-2 py-1 text-start">{rtl ? "جمع با فرزندان" : "Rolled up"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CBS.map((n) => (
                      <tr key={n.code} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{n.code}</td>
                        <td className="px-2 py-1 tx1" style={{ paddingInlineStart: `${(n.code.split(".").length - 1) * 12 + 8}px` }}>{n.nameFa}</td>
                        <td className="px-2 py-1 tx3">
                          {n.kind === "reserve" ? (rtl ? "ذخیره" : "reserve") : n.kind === "indirect" ? (rtl ? "غیرمستقیم" : "indirect") : rtl ? "مستقیم" : "direct"}
                        </td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmtB(n.budget, rtl)}</td>
                        <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{fmtB(roll[n.code] ?? 0, rtl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={rtl ? "مبنای اندازه‌گیری عملکرد (PMB) — منحنی توزیع" : "Performance Measurement Baseline"} note={rtl ? "۱۲ دوره · مجموع = PMB" : "12 periods"}>
              <div className="mb-2 flex flex-wrap gap-1">
                {(["linear", "bell", "front", "back", "scurve"] as CurveType[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurve(c)}
                    className={`rounded-lg px-2 py-1 text-[9px] transition ${curve === c ? "toggle-on tx1" : "border b-line-soft tx3 hover:tx2"}`}
                    dir="ltr"
                  >
                    {c}
                  </button>
                ))}
              </div>
              <Bars values={pmb} />
              <div className="mt-1 flex justify-between text-[8px] tx4" dir="ltr">
                <span>P1</span>
                <span>P12 · Σ {fmtB(pmb.reduce((a, b) => a + b, 0), rtl)}</span>
              </div>
            </Section>

            <Section title={rtl ? "ذخیره احتیاطی — آزادسازی فقط با اختیار (DoA)" : "Reserve — DoA guarded"}>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={drawReserve} className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[9.5px] text-amber-200 transition hover:bg-amber-400/20">
                  {rtl ? "آزادسازی ۴ میلیارد با مجوز PM" : "Release 4B (PM authority)"}
                </button>
                <span className="text-[9.5px] tx2">{rtl ? "مانده ذخیره:" : "Remaining:"} <span dir="ltr">{fmtB(reserve, rtl)}</span></span>
                {reserveMsg && <span className="rounded-lg bg-emerald-400/10 px-2 py-1 text-[9px] text-emerald-300">{reserveMsg}</span>}
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۲: کنترل هزینه (EVM) ═══ */}
        {tab === "control" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              <Kpi label="PV" value={fmtB(pvCum, rtl)} />
              <Kpi label="EV" value={fmtB(ev, rtl)} />
              <Kpi label={rtl ? "AC (مالک: d5)" : "AC (owner d5)"} value={fmtB(ac, rtl)} />
              <Kpi label="CV" value={fmtB(evm.cv ?? 0, rtl)} tone={(evm.cv ?? 0) < 0 ? "text-rose-300" : "text-emerald-300"} />
              <Kpi label="SV" value={fmtB(evm.sv, rtl)} tone={evm.sv < 0 ? "text-rose-300" : "text-emerald-300"} />
              <Kpi label="SPI(t)" value={evm.spiT?.toFixed(3) ?? "—"} hint={`ES ${evm.es?.toFixed(2) ?? "—"}`} />
            </div>

            <Section title={rtl ? "پنج روش برآورد هزینه نهایی (EAC)" : "Five EAC methods"} note={`TCPI(BAC) ${evm.tcpiBac?.toFixed(3) ?? "—"}`}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Kpi label="AC + (BAC−EV)" value={fmtB(evm.eac.ate ?? 0, rtl)} hint={rtl ? "روند غیرتکراری" : "atypical"} />
                <Kpi label="BAC / CPI" value={fmtB(evm.eac.cpi ?? 0, rtl)} hint={rtl ? "روند تکراری" : "typical"} />
                <Kpi label="AC + rem/(CPI×SPI)" value={fmtB(evm.eac.cpiSpi ?? 0, rtl)} />
                <Kpi label="0.8CPI + 0.2SPI" value={fmtB(evm.eac.weighted ?? 0, rtl)} />
                <Kpi label={rtl ? "با ذخیره ریسک" : "Risk-adjusted"} value={fmtB(evm.eac.riskAdj ?? 0, rtl)} tone="text-amber-200" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Kpi label="ETC" value={fmtB(evm.etc ?? 0, rtl)} />
                <Kpi label="VAC" value={fmtB(evm.vac ?? 0, rtl)} tone={(evm.vac ?? 0) < 0 ? "text-rose-300" : "text-emerald-300"} />
                <Kpi label="VAC %" value={vacPct !== null ? `${vacPct.toFixed(1)}%` : "—"} />
                <Kpi label="TCPI(EAC)" value={evm.tcpiEac?.toFixed(3) ?? "—"} />
              </div>
            </Section>

            <Section title={rtl ? "انحراف و مسیر اقدام" : "Variance & action routing"}>
              <div className="flex flex-wrap items-center gap-2 text-[9.5px]">
                <span className={`rounded-lg px-2 py-1 ${sev === "critical" ? "bg-rose-400/15 text-rose-300" : sev === "major" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>
                  {rtl ? "شدت انحراف هزینه:" : "Cost variance severity:"} {sev}
                </span>
                {needsAutoCr(sev) ? (
                  <span className="rounded-lg bg-rose-400/10 px-2 py-1 text-rose-200">
                    {rtl ? "الزام: صدور درخواست تغییر (RCC) + اقدام اصلاحی (MON)" : "Auto-route: Change Request (RCC) + corrective action (MON)"}
                  </span>
                ) : (
                  <span className="rounded-lg border b-line-soft px-2 py-1 tx3">{rtl ? "در محدوده مجاز" : "Within tolerance"}</span>
                )}
              </div>
            </Section>

            <Section title={rtl ? "Snapshot تغییرناپذیر EVM" : "Immutable EVM snapshots"} note={rtl ? "هر Snapshot با نسخه فرمول مهر می‌شود و ویرایش‌پذیر نیست" : "hash + formula version, never edited"}>
              <button onClick={takeSnapshot} className="mb-2 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-[9.5px] text-sky-200 transition hover:bg-sky-400/20">
                {rtl ? "ثبت Snapshot تاریخ گزارش" : "Freeze snapshot at data date"}
              </button>
              {snapshots.length === 0 ? (
                <p className="text-[9px] tx4">{rtl ? "هنوز Snapshot ثبت نشده است." : "No snapshot yet."}</p>
              ) : (
                <ul className="space-y-1">
                  {snapshots.map((s) => {
                    const v = verifySnapshot(s);
                    return (
                      <li key={s.id + s.hash} className="flex flex-wrap items-center gap-2 rounded-lg border b-line-soft bg-black/15 px-2 py-1 text-[9px]">
                        <span className="font-mono tx2" dir="ltr">{s.id}</span>
                        <span className="font-mono tx4" dir="ltr">#{s.hash}</span>
                        <span className="tx3" dir="ltr">CPI {s.result.cpi?.toFixed(3)} · SPI {s.result.spi.toFixed(3)}</span>
                        <span className="font-mono tx4" dir="ltr">{s.formulaVersion}</span>
                        <span className={v.valid ? "text-emerald-300" : "text-rose-300"}>{v.valid ? (rtl ? "معتبر" : "valid") : v.reason}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title={rtl ? "هزینه‌های واقعی ثبت‌شده (AC)" : "Actual cost transactions"} note={rtl ? "تبدیل خودکار به ارز پایه" : "auto FX to base"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <th className="px-2 py-1 text-start">{rtl ? "شناسه" : "ID"}</th>
                    <th className="px-2 py-1 text-start">CBS</th>
                    <th className="px-2 py-1 text-start">{rtl ? "شرح" : "Description"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "مبلغ ارزی" : "FX amount"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "ارز پایه" : "Base"}</th>
                  </tr>
                </thead>
                <tbody>
                  {TXNS.map((x) => (
                    <tr key={x.id} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{x.id}</td>
                      <td className="px-2 py-1 font-mono tx3" dir="ltr">{x.cbs}</td>
                      <td className="px-2 py-1 tx1">{t(x.desc, lang)}</td>
                      <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{x.amount.toLocaleString("en-US")} {x.currency}</td>
                      <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{fmtB(toBase({ amount: x.amount, currency: x.currency }, RATES), rtl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}

        {/* ═══ تب ۳: جریان نقدی ═══ */}
        {tab === "cash" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Kpi label="DSO" value={`${dsoV.toFixed(0)} ${rtl ? "روز" : "d"}`} />
              <Kpi label="DPO" value={`${dpoV.toFixed(0)} ${rtl ? "روز" : "d"}`} />
              <Kpi label="CCC" value={`${ccc(dsoV, dioV, dpoV).toFixed(0)} ${rtl ? "روز" : "d"}`} tone="text-amber-200" />
              <Kpi label="NPV @18%" value={fmtB(npv(0.18, netCum), rtl)} />
              <Kpi label="IRR" value={projIrr !== null ? pct(projIrr) : "—"} hint={`payback ${payback(netCum)?.toFixed(1) ?? "—"}`} />
            </div>

            <Section title={rtl ? "منحنی نقدینگی — ورودی/خروجی و مانده تجمعی" : "Cash curve"} note={rtl ? "منفی‌شدن مانده = نیاز به تأمین مالی" : "negative = funding gap"}>
              <Bars values={netCum.map((v) => Math.abs(v))} colors={netCum.map((v) => (v < 0 ? "rgba(244,63,94,0.55)" : "rgba(52,211,153,0.55)"))} />
              <div className="mt-1 text-[8.5px] tx4" dir="ltr">
                min {fmtB(Math.min(...netCum), rtl)} · max {fmtB(Math.max(...netCum), rtl)}
              </div>
            </Section>

            <Section title={rtl ? "سن مطالبات (AR Aging)" : "AR aging"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <th className="px-2 py-1 text-start">{rtl ? "شناسه" : "ID"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "طرف حساب" : "Party"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "مبلغ" : "Amount"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "تأخیر" : "Overdue"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "سطل" : "Bucket"}</th>
                  </tr>
                </thead>
                <tbody>
                  {AR.map((r) => {
                    const b = agingBucket(r.overdue);
                    return (
                      <tr key={r.id} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{r.id}</td>
                        <td className="px-2 py-1 tx1">{r.partyFa}</td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmtB(r.amount, rtl)}</td>
                        <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{r.overdue}</td>
                        <td className="px-2 py-1">
                          <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${b === "90+" ? "bg-rose-400/15 text-rose-300" : b === "61-90" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`} dir="ltr">
                            {b}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "صورت‌وضعیت پیمانکاری (محاسبه خالص پرداختنی)" : "Progress invoice (IPC)"} note={rtl ? "حسن انجام ۱۰٪ · استهلاک پیش‌پرداخت ۲۰٪ · کسور قانونی ۵٪" : "retention 10% · advance 20% · legal 5%"}>
              {(() => {
                const ipc = progressInvoice(31_500_000_000, 10, 20, 5);
                return (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    <Kpi label={rtl ? "ناخالص" : "Gross"} value={fmtB(ipc.gross, rtl)} />
                    <Kpi label={rtl ? "حسن انجام کار" : "Retention"} value={fmtB(ipc.retention, rtl)} />
                    <Kpi label={rtl ? "استهلاک پیش‌پرداخت" : "Advance recovery"} value={fmtB(ipc.advanceRecovery, rtl)} />
                    <Kpi label={rtl ? "کسور قانونی" : "Legal"} value={fmtB(ipc.legalDeductions, rtl)} />
                    <Kpi label={rtl ? "خالص پرداختنی" : "Net payable"} value={fmtB(ipc.netPayable, rtl)} tone="text-emerald-300" />
                  </div>
                );
              })()}
            </Section>
          </>
        )}

        {/* ═══ تب ۴: درخواست خرید ═══ */}
        {tab === "pr" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "PR باز" : "Open PRs"} value={String(PRS.filter((p) => p.status !== "released").length)} />
              <Kpi label={rtl ? "PR اضطراری" : "Emergency"} value={`${Math.round((PRS.filter((p) => p.urgent).length / PRS.length) * 100)}%`} tone="text-amber-200" />
              <Kpi label={rtl ? "پیشنهاد MRP" : "MRP suggestions"} value={String(mrp.length)} />
              <Kpi label={rtl ? "بودجه در دسترس" : "Available budget"} value={fmtB(bac - ac - committedTotal, rtl)} />
            </div>

            <Section title={rtl ? "کنترل بودجه پیش از صدور PR" : "Budget verification before PR"} note={rtl ? "فراتر از بودجه = رد مگر با مجوز" : "over-budget rejected without override"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <th className="px-2 py-1 text-start">PR</th>
                    <th className="px-2 py-1 text-start">{rtl ? "کالا" : "Item"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "برآورد" : "Estimate"}</th>
                    <th className="px-2 py-1 text-start">CBS</th>
                    <th className="px-2 py-1 text-start">{rtl ? "تاریخ نیاز" : "Need date"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "کنترل بودجه" : "Budget check"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "مرجع تأیید" : "Approver"}</th>
                  </tr>
                </thead>
                <tbody>
                  {PRS.map((p) => {
                    const remaining = (roll[p.cbs] ?? 0) - ac * 0.2;
                    const chk = prBudgetCheck(p.est, remaining, p.urgent);
                    const usd = p.est / RATES.USD;
                    const approver = usd < 10_000 ? "Manager" : usd < 100_000 ? "Dept Head" : usd < 500_000 ? "PM" : "Sponsor";
                    return (
                      <tr key={p.id} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{p.id}</td>
                        <td className="px-2 py-1 tx1">{p.itemFa} {p.urgent && <span className="rounded bg-rose-400/15 px-1 text-[8px] text-rose-300">{rtl ? "اضطراری" : "urgent"}</span>}</td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmtB(p.est, rtl)}</td>
                        <td className="px-2 py-1 font-mono tx3" dir="ltr">{p.cbs}</td>
                        <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{p.needDate}</td>
                        <td className="px-2 py-1">
                          <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${chk.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
                            {chk.ok ? (rtl ? "تأیید" : "pass") : rtl ? "فراتر از بودجه" : "over budget"}
                          </span>
                        </td>
                        <td className="px-2 py-1 tx2" dir="ltr">{approver}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "اجرای MRP — تولید خودکار درخواست خرید" : "MRP run — auto PR"} note={rtl ? "کسری = نیاز + ذخیره ایمنی − موجودی − در راه" : "shortage = need + SS − on-hand − on-order"}>
              {mrp.length === 0 ? (
                <p className="text-[9px] tx4">{rtl ? "کسری‌ای شناسایی نشد." : "No shortage."}</p>
              ) : (
                <table className="w-full text-[9.5px]">
                  <thead className="tx3">
                    <tr className="border-b b-line-soft">
                      <th className="px-2 py-1 text-start">{rtl ? "کد کالا" : "Material"}</th>
                      <th className="px-2 py-1 text-start">{rtl ? "مقدار سفارش" : "Order qty"}</th>
                      <th className="px-2 py-1 text-start">{rtl ? "تاریخ نیاز" : "Need date"}</th>
                      <th className="px-2 py-1 text-start">{rtl ? "آخرین مهلت صدور PR" : "Release by"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mrp.map((m) => (
                      <tr key={m.materialCode} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{m.materialCode}</td>
                        <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{m.orderQty.toLocaleString("en-US")}</td>
                        <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{m.needDate}</td>
                        <td className="px-2 py-1 tabular-nums text-amber-200" dir="ltr">{m.releaseDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-2 text-[8.5px] tx4">
                {rtl
                  ? `نمونه: فعالیت ۱۴۰۵/۰۸/۱۰ با لیدتایم ۹۰ روز و بافر ۳ روز ⇐ صدور PR تا ${materialNeedDate("2026-11-01", 90, 3)}`
                  : `Example: activity 2026-11-01, lead 90d, buffer 3d ⇒ release by ${materialNeedDate("2026-11-01", 90, 3)}`}
              </p>
            </Section>
          </>
        )}

        {/* ═══ تب ۵: سفارش خرید ═══ */}
        {tab === "po" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "تعهد باز (Committed)" : "Open commitment"} value={fmtB(committedTotal, rtl)} tone="text-sky-300" />
              <Kpi label={rtl ? "تحویل‌شده بدون فاکتور (Accrued)" : "Accrued"} value={fmtB(accruedTotal, rtl)} />
              <Kpi label={rtl ? "پرداخت معوق" : "Outstanding payment"} value={fmtB(commitments.reduce((s, c) => s + c.view.outstandingPayment, 0), rtl)} />
              <Kpi label={rtl ? "بودجه بلااستفاده" : "Uncommitted budget"} value={fmtB(bac - ac - committedTotal, rtl)} />
            </div>

            <Section title={rtl ? "زنجیره تعهد: PR ← PO ← رسید ← فاکتور ← پرداخت" : "Commitment chain"} note={rtl ? "تعهد پیش از هزینه ثبت می‌شود" : "commitment before actual"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <th className="px-2 py-1 text-start">PO</th>
                    <th className="px-2 py-1 text-start">{rtl ? "تأمین‌کننده" : "Vendor"}</th>
                    <th className="px-2 py-1 text-start">Committed</th>
                    <th className="px-2 py-1 text-start">Accrued</th>
                    <th className="px-2 py-1 text-start">Actual</th>
                    <th className="px-2 py-1 text-start">{rtl ? "امتیاز" : "Score"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "تأخیر" : "Delay"}</th>
                  </tr>
                </thead>
                <tbody>
                  {commitments.map(({ row, view, score }) => {
                    const delay = row.actual ? Math.round((Date.parse(row.actual) - Date.parse(row.promised)) / 86400000) : null;
                    return (
                      <tr key={row.id} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{row.id}</td>
                        <td className="px-2 py-1 tx1">{row.vendorFa} <span className="tx4" dir="ltr">({row.currency})</span></td>
                        <td className="px-2 py-1 tabular-nums text-sky-300" dir="ltr">{fmtB(view.committed, rtl)}</td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmtB(view.accrued, rtl)}</td>
                        <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{fmtB(view.actual, rtl)}</td>
                        <td className="px-2 py-1">
                          <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${score.grade === "A" ? "bg-emerald-400/15 text-emerald-300" : score.grade === "D" ? "bg-rose-400/15 text-rose-300" : "bg-amber-400/15 text-amber-200"}`} dir="ltr">
                            {score.grade} · {score.score}
                          </span>
                        </td>
                        <td className={`px-2 py-1 tabular-nums ${delay !== null && delay > 0 ? "text-rose-300" : "tx3"}`} dir="ltr">
                          {delay === null ? (rtl ? "در انتظار" : "pending") : `${delay}d`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "تطابق سه‌جانبه (3-Way Match) پیش از پرداخت" : "3-way match gate"} note={rtl ? "تلورانس ۵٪؛ عدم تطابق = مسدودسازی پرداخت" : "5% tolerance; mismatch blocks payment"}>
              <div className="space-y-1">
                {[
                  { id: "INV-9012", po: { qty: 100, price: 10 }, grn: { qty: 100 }, inv: { qty: 100, price: 10 } },
                  { id: "INV-9013", po: { qty: 500, price: 24 }, grn: { qty: 480 }, inv: { qty: 500, price: 24 } },
                  { id: "INV-9014", po: { qty: 60, price: 120 }, grn: { qty: 60 }, inv: { qty: 60, price: 138 } },
                ].map((c) => {
                  const m = threeWayMatch(c.po, c.grn, c.inv);
                  return (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border b-line-soft bg-black/15 px-2 py-1 text-[9px]">
                      <span className="font-mono tx2" dir="ltr">{c.id}</span>
                      <span className="tx3" dir="ltr">PO {c.po.qty}×{c.po.price} · GRN {c.grn.qty} · INV {c.inv.qty}×{c.inv.price}</span>
                      <span className={`rounded px-1.5 py-0.5 ${m.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
                        {m.ok ? (rtl ? "مجاز پرداخت" : "payable") : rtl ? "پرداخت مسدود" : "payment blocked"}
                      </span>
                      {m.reasons.map((r) => (
                        <span key={r} className="rounded bg-rose-400/10 px-1.5 py-0.5 text-[8px] text-rose-200" dir="ltr">{r}</span>
                      ))}
                      <span className="tx4" dir="ltr">max dev {m.maxDeviationPct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۶: مدیریت کالا و انبار ═══ */}
        {tab === "inventory" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "ارزش موجودی" : "Inventory value"} value={fmtB(stock.reduce((s, x) => s + x.value, 0), rtl)} />
              <Kpi label={rtl ? "اقلام زیر نقطه سفارش" : "Below ROP"} value={String(stock.filter((s) => s.onHand <= s.rop).length)} tone="text-amber-200" />
              <Kpi label={rtl ? "ریسک کسری" : "Stockout risk"} value={String(stock.filter((s) => s.risk).length)} tone="text-rose-300" />
              <Kpi label={rtl ? "اقلام کلاس A" : "Class A items"} value={String(Object.values(abc).filter((v) => v === "A").length)} />
            </div>

            <Section title={rtl ? "کنترل موجودی — ذخیره ایمنی، نقطه سفارش و EOQ" : "Inventory control"} note={rtl ? "بارکد هر بچ برای ردیابی" : "batch barcode traceability"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <th className="px-2 py-1 text-start">{rtl ? "کد" : "Code"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "کالا" : "Item"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "موجودی" : "On hand"}</th>
                    <th className="px-2 py-1 text-start">SS</th>
                    <th className="px-2 py-1 text-start">ROP</th>
                    <th className="px-2 py-1 text-start">EOQ</th>
                    <th className="px-2 py-1 text-start">ABC</th>
                    <th className="px-2 py-1 text-start">{rtl ? "بچ" : "Batch"}</th>
                    <th className="px-2 py-1 text-start">{rtl ? "وضعیت" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={s.code} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{s.code}</td>
                      <td className="px-2 py-1 tx1">{s.nameFa}</td>
                      <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{s.onHand.toLocaleString("en-US")}</td>
                      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{Math.round(s.ss)}</td>
                      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{Math.round(s.rop)}</td>
                      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{Math.round(s.eoq)}</td>
                      <td className="px-2 py-1">
                        <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${abc[s.code] === "A" ? "bg-rose-400/15 text-rose-300" : abc[s.code] === "B" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>
                          {abc[s.code]}
                        </span>
                      </td>
                      <td className="px-2 py-1 font-mono tx4" dir="ltr">▮▯▮ {s.batch}</td>
                      <td className="px-2 py-1">
                        {s.risk ? (
                          <span className="rounded bg-rose-400/15 px-1.5 py-0.5 text-[8.5px] text-rose-300">{rtl ? "کسری قریب‌الوقوع" : "stockout"}</span>
                        ) : s.onHand <= s.rop ? (
                          <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[8.5px] text-amber-200">{rtl ? "سفارش مجدد" : "reorder"}</span>
                        ) : (
                          <span className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] tx3">{rtl ? "نرمال" : "ok"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "گردش انبار — رسید، حواله و ردیابی" : "Warehouse flow"} note={rtl ? "اپ موبایل انبار روی صف همگام‌سازی آفلاین" : "mobile app on offline sync queue"}>
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  { fa: "رسید کالا (GRN)", en: "Goods receipt", v: "۳ در انتظار بازرسی", icon: "📥" },
                  { fa: "حواله مصرف", en: "Issuance", v: "۷ حواله امروز", icon: "📤" },
                  { fa: "انبارگردانی دوره‌ای", en: "Cycle count", v: "دقت ۹۷.۴٪", icon: "🔍" },
                ].map((c) => (
                  <div key={c.en} className="rounded-xl border b-line-soft bg-black/15 p-2">
                    <div className="text-[10px] tx1">{c.icon} {rtl ? c.fa : c.en}</div>
                    <div className="mt-1 text-[9px] tx3">{c.v}</div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
