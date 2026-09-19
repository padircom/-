import { useMemo } from "react";
import { type Lang } from "../data/framework";
import { PL_SEED, profitLoss } from "../services/profitability";

/* ══════════════════════════════════════════════════════════════════════
   تب «سود و زیان پروژه» (d5-p9)
   دو ستون عمداً کنار هم‌اند: سودِ «تا امروز» و سودِ «در انتهای کار».
   تفاوتشان همان چیزی است که در گزارش‌های تک‌ستونه گم می‌شود.
   ══════════════════════════════════════════════════════════════════════ */

const B = 1_000_000_000;

export default function ProfitLossPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const pl = useMemo(() => profitLoss(PL_SEED), []);

  const money = (n: number) =>
    `${(n / B).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 2 })} ${rtl ? "میلیارد ریال" : "B IRR"}`;
  const pct = (n: number) => `${(n * 100).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}%`;
  const tone = (n: number) => (n < 0 ? "#F87171" : "#34D399");

  const rows: { label: string; today: number; atComplete: number }[] = [
    { label: rtl ? "درآمد" : "Revenue", today: pl.revenue, atComplete: PL_SEED.contractValue },
    { label: rtl ? "بهای تمام‌شده" : "Cost", today: pl.cost, atComplete: PL_SEED.forecastCost },
    { label: rtl ? "سود (زیان)" : "Profit (loss)", today: pl.grossProfit, atComplete: pl.forecastProfit },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Cell label={rtl ? "سود ناخالص تا امروز" : "Gross profit to date"} value={money(pl.grossProfit)} tone={tone(pl.grossProfit)} hint={pct(pl.grossMarginPct)} />
        <Cell label={rtl ? "حاشیهٔ تحقق‌یافته" : "Earned margin"} value={pct(pl.earnedMarginPct)} hint={rtl ? "متناسب با پیشرفت" : "progress-weighted"} />
        <Cell label={rtl ? "سودِ انتهای کار" : "At-complete profit"} value={money(pl.forecastProfit)} tone={tone(pl.forecastProfit)} hint={pct(pl.forecastMarginPct)} />
        <Cell
          label={rtl ? "قابل وصول" : "Net receivable"}
          value={money(pl.netReceivable)}
          hint={rtl ? "پس از کسورات و پیش‌پرداخت" : "after retention & advance"}
        />
      </div>

      {pl.overBillingRisk && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-2.5 text-[10px] text-amber-200">
          {rtl
            ? "هشدار: سود تا امروز مثبت است امّا برآوردِ انتهای کار زیان می‌دهد — پیش‌دریافت جلوتر از هزینه افتاده است."
            : "Warning: profit to date is positive while at-complete forecast is a loss — billing has run ahead of cost."}
        </div>
      )}

      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
        <table className="w-full border-collapse text-[10.5px]">
          <thead className="sticky top-0 bg-[var(--panel2)]">
            <tr className="tx4">
              <th className="px-3 py-2 text-start font-light">{rtl ? "قلم" : "Line"}</th>
              <th className="px-3 py-2 text-end font-light">{rtl ? "تا امروز" : "To date"}</th>
              <th className="px-3 py-2 text-end font-light">{rtl ? "در انتهای کار" : "At complete"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isTotal = i === rows.length - 1;
              return (
                <tr key={r.label} className={`border-t border-[var(--line-soft)] ${isTotal ? "bg-[var(--row)]" : ""}`}>
                  <td className={`px-3 py-2 ${isTotal ? "tx1 font-medium" : "tx2"}`}>{r.label}</td>
                  <td className="px-3 py-2 text-end tx1" dir="ltr" style={isTotal ? { color: tone(r.today) } : undefined}>{money(r.today)}</td>
                  <td className="px-3 py-2 text-end tx1" dir="ltr" style={isTotal ? { color: tone(r.atComplete) } : undefined}>{money(r.atComplete)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] font-extralight tx4">
        {rtl
          ? "درآمد = تجمعیِ صورت‌وضعیت‌های تأییدشده (مالک d14)؛ بهای تمام‌شده = هزینهٔ واقعیِ تخصیص‌یافته (مالک d5). قابل وصول = تأییدشده − کسورات − ماندهٔ پیش‌پرداخت."
          : "Revenue = certified IPC cumulative (owned by d14); cost = allocated actual cost (owned by d5). Net receivable = certified − retention − outstanding advance."}
      </p>
    </div>
  );
}

function Cell({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
      <div className="text-[8.5px] font-extralight tx4">{label}</div>
      <div className="mt-1 text-[12.5px] font-light tx1" style={{ color: tone }}>{value}</div>
      {hint && <div className="mt-0.5 text-[9px] font-extralight tx3">{hint}</div>}
    </div>
  );
}
