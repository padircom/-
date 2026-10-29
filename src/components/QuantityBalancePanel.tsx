import { useMemo } from "react";
import { t, type Lang } from "../data/framework";
import {
  BOQ_SEED,
  MATERIAL_SEED,
  materialLines,
  materialTotals,
  quantityLines,
  quantityTotals,
} from "../services/quantities";
import SampleDataNotice from "./SampleDataNotice";

/* ══════════════════════════════════════════════════════════════════════
   دو تبِ تازهٔ میز کارِ مالی (d5):
     «quantities» → مدیریت احجام و مقادیر فیزیکی  (d5-p7)
     «balance»    → بالانس مصالح و کنترل ضایعات   (d5-p8)

   هیچ عددی در این فایل hard-code نشده؛ همه از موتور `quantities.ts`
   می‌آید و با تغییر دادهٔ نمونه یا اتصال SQL به‌روز می‌شود.
   ══════════════════════════════════════════════════════════════════════ */

type Mode = "quantities" | "balance";
/** main = زیرماژول اول؛ detail = زیرماژول دوم (برداشت دوره‌ای / نُرم و ضایعات). */
type View = "main" | "detail";

const num = (n: number, lang: Lang) =>
  Math.round(n).toLocaleString(lang === "fa" ? "fa-IR" : "en-US");
const pct = (n: number, lang: Lang) =>
  `${(n * 100).toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}%`;
const money = (n: number, lang: Lang) =>
  `${(n / 1_000_000_000).toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 2 })}${lang === "fa" ? " میلیارد ریال" : "B IRR"}`;

const statusColor: Record<string, string> = {
  ahead: "#34D399",
  on: "#7FB2FF",
  behind: "#F87171",
  over: "#F87171",
  under: "#FBBF24",
  ok: "#34D399",
  na: "#94A3B8",
};

function Card({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
      <div className="text-[8.5px] font-extralight tx4">{label}</div>
      <div className="mt-1 text-[13px] font-light tx1" style={{ color }}>{value}</div>
      {hint && <div className="mt-0.5 text-[9px] font-extralight tx3">{hint}</div>}
    </div>
  );
}

export default function QuantityBalancePanel({ lang, mode, view = "main" }: { lang: Lang; mode: Mode; view?: View }) {
  const rtl = lang === "fa";

  const qLines = useMemo(() => quantityLines(BOQ_SEED), []);
  const qTotals = useMemo(() => quantityTotals(qLines), [qLines]);
  const mLines = useMemo(() => materialLines(MATERIAL_SEED), []);
  const mTotals = useMemo(() => materialTotals(mLines), [mLines]);

  /* ───── p7-s2: برداشت و صورت‌برداری دوره‌ای ───── */
  if (mode === "quantities" && view === "detail") {
    const periods = [...new Set(BOQ_SEED.flatMap((r) => r.measurements.map((m) => m.period)))].sort();
    const periodValue = (period: string) =>
      BOQ_SEED.reduce((s, r) => s + r.measurements.filter((m) => m.period === period).reduce((a, m) => a + m.qty * r.unitRate, 0), 0);
    const values = periods.map(periodValue);
    const last = values.length ? values[values.length - 1] : 0;
    const prev = values.length > 1 ? values[values.length - 2] : 0;
    const change = prev === 0 ? null : (last - prev) / prev;
    const latest = periods[periods.length - 1];
    const activeNow = BOQ_SEED.filter((r) => r.measurements.some((m) => m.period === latest)).length;
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <SampleDataNotice rtl={rtl} />
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Card label={rtl ? "دوره‌های صورت‌برداری" : "Measurement periods"} value={num(periods.length, lang)} hint={periods.length ? `${periods[0]} → ${latest}` : undefined} />
          <Card label={rtl ? "ارزش برداشتِ آخرین دوره" : "Latest period value"} value={money(last, lang)} hint={latest} color="#7FB2FF" />
          <Card
            label={rtl ? "تغییر نسبت به دورهٔ قبل" : "Change vs previous period"}
            value={change === null ? "—" : `${change > 0 ? "+" : ""}${pct(change, lang)}`}
            color={change === null ? undefined : change < 0 ? "#F87171" : "#34D399"}
          />
          <Card label={rtl ? "ردیف‌های فعال در آخرین دوره" : "Rows active in latest period"} value={num(activeNow, lang)} hint={rtl ? `از ${num(BOQ_SEED.length, lang)} ردیف` : `of ${num(BOQ_SEED.length, lang)} rows`} />
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-[var(--panel2)]">
              <tr className="tx4">
                <th className="px-2 py-2 text-start font-light">{rtl ? "ردیف / WBS" : "Item / WBS"}</th>
                {periods.map((p) => (
                  <th key={p} className="px-2 py-2 text-end font-light" dir="ltr">{p}</th>
                ))}
                <th className="px-2 py-2 text-end font-light">{rtl ? "جمع برداشت" : "Total measured"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "٪ از کل ردیف" : "% of row total"}</th>
              </tr>
            </thead>
            <tbody>
              {BOQ_SEED.map((r) => {
                const total = r.measurements.reduce((s, m) => s + m.qty, 0);
                return (
                  <tr key={r.id} className="border-t border-[var(--line-soft)]">
                    <td className="px-2 py-1.5">
                      <div className="tx1">{t(r.item, lang)}</div>
                      <div className="tx4" dir="ltr">{r.wbs} · {t(r.unit, lang)}</div>
                    </td>
                    {periods.map((p) => {
                      const q = r.measurements.filter((m) => m.period === p).reduce((s, m) => s + m.qty, 0);
                      return (
                        <td key={p} className="px-2 py-1.5 text-end tx2" dir="ltr">{q ? num(q, lang) : "—"}</td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(total, lang)}</td>
                    <td className="px-2 py-1.5 text-end tx2" dir="ltr">{pct(total / (r.plannedQty || 1), lang)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--line)] bg-[var(--row)]">
                <td className="px-2 py-1.5 tx1">{rtl ? "ارزش برداشت دوره" : "Period value"}</td>
                {values.map((v, i) => (
                  <td key={periods[i]} className="px-2 py-1.5 text-end tx1" dir="ltr">{money(v, lang)}</td>
                ))}
                <td className="px-2 py-1.5 text-end tx1" dir="ltr">{money(values.reduce((a, b) => a + b, 0), lang)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-[9px] font-extralight tx4">
          {rtl
            ? "هر ستون یک دورهٔ صورت‌برداری است. ارزش = مقدار × نرخ واحد. پس از اتصال SQL، منبع Boq_Measurement و Measurement_Approval خواهد بود."
            : "Each column is one measurement period. Value = quantity × unit rate. After SQL wiring the source becomes Boq_Measurement and Measurement_Approval."}
        </p>
      </div>
    );
  }

  /* ───── p8-s2: نُرم مصرف و تحلیل ضایعات ───── */
  if (mode === "balance" && view === "detail") {
    const statusLabel: Record<string, string> = {
      over: rtl ? "ضایعات غیرعادی (بیش از ۵٪)" : "Abnormal waste (>5%)",
      ok: rtl ? "در محدودهٔ نُرم (±۵٪)" : "Within norm (±5%)",
      under: rtl ? "کمتر از نُرم" : "Below norm",
      na: rtl ? "نُرم ندارد" : "No norm",
    };
    const underCount = mLines.filter((l) => l.status === "under").length;
    const noNorm = mLines.filter((l) => l.status === "na").length;
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <SampleDataNotice rtl={rtl} />
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Card label={rtl ? "میانگین ضایعات" : "Average waste"} value={pct(mTotals.avgWastePct, lang)} hint={rtl ? "انحراف ÷ مصرف، روی اقلام دارای نُرم" : "variance ÷ issues, items with norm"} />
          <Card label={rtl ? "اقلام با ضایعات غیرعادی" : "Abnormal-waste items"} value={num(mTotals.overCount, lang)} hint={rtl ? `از ${num(mTotals.rowCount, lang)} قلم` : `of ${num(mTotals.rowCount, lang)} items`} color={mTotals.overCount > 0 ? "#F87171" : "#34D399"} />
          <Card label={rtl ? "اقلام کمتر از نُرم" : "Below-norm items"} value={num(underCount, lang)} hint={rtl ? "ممکن است ثبت مصرف ناقص باشد" : "may indicate under-recorded issues"} color={underCount > 0 ? "#FBBF24" : undefined} />
          <Card label={rtl ? "اقلام بدون نُرم" : "Items without norm"} value={num(noNorm, lang)} hint={rtl ? "قابل ارزیابی نیستند" : "cannot be assessed"} color={noNorm > 0 ? "#FBBF24" : undefined} />
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-[var(--panel2)]">
              <tr className="tx4">
                <th className="px-2 py-2 text-start font-light">{rtl ? "قلم کالا" : "Material"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "نُرم × تولید" : "Norm × production"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "مصرف واقعی" : "Actual issues"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "انحراف" : "Variance"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "ضایعات" : "Waste"}</th>
                <th className="px-2 py-2 text-start font-light">{rtl ? "ارزیابی" : "Assessment"}</th>
              </tr>
            </thead>
            <tbody>
              {mLines.map((l) => (
                <tr key={l.id} className="border-t border-[var(--line-soft)]">
                  <td className="px-2 py-1.5">
                    <div className="tx1">{t(l.material, lang)}</div>
                    <div className="tx4">{t(l.unit, lang)}</div>
                  </td>
                  <td className="px-2 py-1.5 text-end tx2" dir="ltr">{l.normQty === null ? "—" : num(l.normQty, lang)}</td>
                  <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(l.issues, lang)}</td>
                  <td className="px-2 py-1.5 text-end" dir="ltr" style={{ color: statusColor[l.status] }}>
                    {l.variance === null ? "—" : `${l.variance > 0 ? "+" : ""}${num(l.variance, lang)} (${pct(l.variancePct ?? 0, lang)})`}
                  </td>
                  <td className="px-2 py-1.5 text-end tx2" dir="ltr">{l.wastePct === null ? "—" : pct(l.wastePct, lang)}</td>
                  <td className="px-2 py-1.5" style={{ color: statusColor[l.status] }}>{statusLabel[l.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[9px] font-extralight tx4">
          {rtl
            ? "انحراف = مصرف واقعی − (نُرم × تولید). آستانهٔ «غیرعادی» ±۵٪ است. جمع میان اقلامِ با واحد متفاوت عمداً نمایش داده نمی‌شود."
            : "Variance = actual − (norm × production). The abnormal threshold is ±5%. Totals across different units are intentionally not shown."}
        </p>
      </div>
    );
  }

  /* ───── p7-s1: نمای احجام ───── */
  if (mode === "quantities") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <SampleDataNotice rtl={rtl} />
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Card
            label={rtl ? "پیشرفت فیزیکی وزنی" : "Weighted physical progress"}
            value={pct(qTotals.physicalProgress, lang)}
            hint={rtl ? "ارزش برداشت‌شده ÷ ارزش کل فهرست بها" : "Earned value ÷ total BOQ value"}
            color="#7FB2FF"
          />
          <Card
            label={rtl ? "ارزش برداشت‌شده" : "Earned quantity value"}
            value={money(qTotals.earnedValue, lang)}
            hint={rtl ? `از ${money(qTotals.plannedValue, lang)} کل` : `of ${money(qTotals.plannedValue, lang)} total`}
          />
          <Card
            label={rtl ? "ردیف‌های عقب‌تر از برنامه" : "Rows behind plan"}
            value={num(qTotals.behindCount, lang)}
            hint={rtl ? `از ${num(qTotals.rowCount, lang)} ردیفِ فعال` : `of ${num(qTotals.rowCount, lang)} active rows`}
            color={qTotals.behindCount > 0 ? "#F87171" : "#34D399"}
          />
          <Card
            label={rtl ? "ردیف‌های جلوتر از برنامه" : "Rows ahead of plan"}
            value={num(qTotals.aheadCount, lang)}
            hint={rtl ? "انحرافِ مثبتِ بیش از ۵٪" : "positive variance above 5%"}
            color="#34D399"
          />
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-[var(--panel2)]">
              <tr className="tx4">
                <th className="px-2 py-2 text-start font-light">{rtl ? "ردیف / WBS" : "Item / WBS"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "برنامه کل" : "Planned"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "تا امروز" : "To date"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "برداشت‌شده" : "Measured"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "انحراف" : "Variance"}</th>
                <th className="px-2 py-2 text-start font-light" style={{ minWidth: 120 }}>{rtl ? "پیشرفت فیزیکی" : "Physical"}</th>
              </tr>
            </thead>
            <tbody>
              {qLines.map((l) => (
                <tr key={l.id} className="border-t border-[var(--line-soft)]">
                  <td className="px-2 py-1.5">
                    <div className="tx1">{t(l.item, lang)}</div>
                    <div className="tx4" dir="ltr">{l.wbs} · {t(l.unit, lang)}</div>
                  </td>
                  <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.plannedQty, lang)}</td>
                  <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.plannedToDate, lang)}</td>
                  <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(l.measuredQty, lang)}</td>
                  <td className="px-2 py-1.5 text-end" dir="ltr" style={{ color: statusColor[l.status] }}>
                    {l.variance > 0 ? "+" : ""}{num(l.variance, lang)} ({pct(l.variancePct, lang)})
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--row-hover)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, l.physicalProgress * 100))}%`, background: statusColor[l.status] }}
                        />
                      </div>
                      <span className="tabular-nums tx3" dir="ltr">{pct(l.physicalProgress, lang)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[9px] font-extralight tx4">
          {rtl
            ? "محاسبهٔ محلی روی ظرف داده؛ پس از اتصال SQL، منابع Boq_Item و Boq_Measurement جایگزین می‌شوند."
            : "Local computation on a data vessel; after SQL wiring, Boq_Item and Boq_Measurement become the source."}
        </p>
      </div>
    );
  }

  /* ───── p8-s1: تراز مقداری مصالح ───── */
  const stockout = mLines.filter((l) => l.closing <= 0).length;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <SampleDataNotice rtl={rtl} />
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        <Card label={rtl ? "اقلام کالا" : "Material items"} value={num(mTotals.rowCount, lang)} hint={rtl ? "ردیف‌های تراز مقداری" : "balance rows"} />
        <Card
          label={rtl ? "اقلام با مانده صفر یا منفی" : "Items with zero/negative closing"}
          value={num(stockout, lang)}
          hint={rtl ? "نشانهٔ ثبت ناقص یا کمبود موجودی" : "incomplete posting or stock-out"}
          color={stockout > 0 ? "#F87171" : "#34D399"}
        />
        <Card
          label={rtl ? "اقلام بدون نُرم" : "Items without norm"}
          value={num(mLines.filter((l) => l.status === "na").length, lang)}
          hint={rtl ? "تحلیل نُرم در زیرماژول انحراف مصرف" : "norm analysis is in the variance sub-module"}
        />
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 bg-[var(--panel2)]">
            <tr className="tx4">
              <th className="px-2 py-2 text-start font-light">{rtl ? "قلم کالا" : "Material"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "ابتدا" : "Opening"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "دریافت" : "Receipts"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "مصرف" : "Issues"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "برگشتی" : "Returns"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "مانده" : "Closing"}</th>
            </tr>
          </thead>
          <tbody>
            {mLines.map((l) => (
              <tr key={l.id} className="border-t border-[var(--line-soft)]">
                <td className="px-2 py-1.5">
                  <div className="tx1">{t(l.material, lang)}</div>
                  <div className="tx4">{t(l.unit, lang)}</div>
                </td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.opening, lang)}</td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.receipts, lang)}</td>
                <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(l.issues, lang)}</td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.returns, lang)}</td>
                <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(l.closing, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] font-extralight tx4">
        {rtl
          ? "تراز مقداری: مانده = ابتدای دوره + دریافت − مصرف + برگشتی. مقایسه با نُرم در زیرماژول «انحراف مصرف و ضایعات»."
          : "Balance: closing = opening + receipts − issues + returns. Norm comparison is in the consumption-variance & waste sub-module."}
      </p>
    </div>
  );
}
