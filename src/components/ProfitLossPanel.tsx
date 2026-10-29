import { useMemo } from "react";
import { type Lang } from "../data/framework";
import { PL_SEED, profitLoss } from "../services/profitability";
import SampleDataNotice from "./SampleDataNotice";

/* ══════════════════════════════════════════════════════════════════════
   تب «سود و زیان پروژه» (d5-p9)
   دو ستون عمداً کنار هم‌اند: سودِ «تا امروز» و سودِ «در انتهای کار».
   تفاوتشان همان چیزی است که در گزارش‌های تک‌ستونه گم می‌شود.
   ══════════════════════════════════════════════════════════════════════ */

const B = 1_000_000_000;

export default function ProfitLossPanel({ lang, view = "main" }: { lang: Lang; view?: "main" | "detail" }) {
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

  /* ───── p9-s2: حاشیه، پیش‌دریافت و وصولی ───── */
  if (view === "detail") {
    const certified = PL_SEED.certifiedToDate;
    const waterfall: { label: string; value: number; sign: "" | "−" | "=" }[] = [
      { label: rtl ? "صورت‌وضعیت‌های تأییدشده (تجمعی)" : "Certified IPC (cumulative)", value: certified, sign: "" },
      { label: rtl ? "کسورات نگه‌داشته‌شده" : "Retention held", value: PL_SEED.retention, sign: "−" },
      { label: rtl ? "ماندهٔ پیش‌پرداخت تسویه‌نشده" : "Outstanding advance", value: PL_SEED.advanceOutstanding, sign: "−" },
      { label: rtl ? "قابل وصول" : "Net receivable", value: pl.netReceivable, sign: "=" },
    ];
    const margins: { label: string; value: number }[] = [
      { label: rtl ? "حاشیهٔ ناخالص تا امروز" : "Gross margin to date", value: pl.grossMarginPct },
      { label: rtl ? "حاشیهٔ تحقق‌یافته (متناسب با پیشرفت)" : "Earned margin (progress-weighted)", value: pl.earnedMarginPct },
      { label: rtl ? "حاشیهٔ انتهای کار" : "At-complete margin", value: pl.forecastMarginPct },
    ];
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <SampleDataNotice rtl={rtl} />
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Cell label={rtl ? "حاشیهٔ تحقق‌یافته" : "Earned margin"} value={pct(pl.earnedMarginPct)} tone={tone(pl.earnedMarginPct)} hint={rtl ? "متناسب با پیشرفت" : "progress-weighted"} />
          <Cell label={rtl ? "قابل وصول" : "Net receivable"} value={money(pl.netReceivable)} hint={rtl ? "پس از کسورات و پیش‌پرداخت" : "after retention & advance"} />
          <Cell label={rtl ? "ماندهٔ پیش‌پرداخت" : "Outstanding advance"} value={money(PL_SEED.advanceOutstanding)} />
          <Cell label={rtl ? "کسورات نگه‌داشته‌شده" : "Retention held"} value={money(PL_SEED.retention)} />
        </div>

        {pl.overBillingRisk ? (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-2.5 text-[10px] text-amber-200">
            {rtl
              ? "هشدار: سود تا امروز مثبت است امّا برآوردِ انتهای کار زیان می‌دهد — پیش‌دریافت جلوتر از هزینه افتاده است."
              : "Warning: profit to date is positive while at-complete forecast is a loss — billing has run ahead of cost."}
          </div>
        ) : (
          <div className="rounded-xl border b-line-soft bg-[var(--row)] p-2.5 text-[10px] tx3">
            {rtl ? "هشدار پیش‌صورت‌وضعیت‌گیری: فعال نیست (سود انتهای کار منفی نیست)." : "Over-billing warning: not triggered (at-complete profit is not negative)."}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto xl:grid-cols-2">
          <div className="thin-scroll rounded-xl border b-line-soft">
            <table className="w-full border-collapse text-[10.5px]">
              <thead className="bg-[var(--panel2)]">
                <tr className="tx4">
                  <th className="px-3 py-2 text-start font-light">{rtl ? "از صورت‌وضعیت تا وصولی" : "From certificate to cash"}</th>
                  <th className="px-3 py-2 text-end font-light">{rtl ? "مبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody>
                {waterfall.map((r) => (
                  <tr key={r.label} className={`border-t border-[var(--line-soft)] ${r.sign === "=" ? "bg-[var(--row)]" : ""}`}>
                    <td className={`px-3 py-2 ${r.sign === "=" ? "tx1 font-medium" : "tx2"}`}>{r.sign ? `${r.sign} ` : ""}{r.label}</td>
                    <td className="px-3 py-2 text-end tx1" dir="ltr">{money(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="thin-scroll rounded-xl border b-line-soft">
            <table className="w-full border-collapse text-[10.5px]">
              <thead className="bg-[var(--panel2)]">
                <tr className="tx4">
                  <th className="px-3 py-2 text-start font-light">{rtl ? "حاشیه" : "Margin"}</th>
                  <th className="px-3 py-2 text-end font-light">{rtl ? "درصد" : "Percent"}</th>
                </tr>
              </thead>
              <tbody>
                {margins.map((r) => (
                  <tr key={r.label} className="border-t border-[var(--line-soft)]">
                    <td className="px-3 py-2 tx2">{r.label}</td>
                    <td className="px-3 py-2 text-end" dir="ltr" style={{ color: tone(r.value) }}>{pct(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[9px] font-extralight tx4">
          {rtl
            ? "قابل وصول = تأییدشده − کسورات − ماندهٔ پیش‌پرداخت. پس از اتصال SQL، منبع Ipc_Certificate، Advance_Ledger و Retention_Ledger خواهد بود."
            : "Net receivable = certified − retention − outstanding advance. After SQL wiring the source becomes Ipc_Certificate, Advance_Ledger and Retention_Ledger."}
        </p>
      </div>
    );
  }

  /* ───── p9-s1: صورت سود و زیان ───── */
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <SampleDataNotice rtl={rtl} />
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        <Cell label={rtl ? "سود ناخالص تا امروز" : "Gross profit to date"} value={money(pl.grossProfit)} tone={tone(pl.grossProfit)} hint={pct(pl.grossMarginPct)} />
        <Cell label={rtl ? "درآمد شناسایی‌شده" : "Recognised revenue"} value={money(pl.revenue)} hint={rtl ? "صورت‌وضعیت‌های تأییدشده" : "certified IPCs"} />
        <Cell label={rtl ? "سودِ انتهای کار" : "At-complete profit"} value={money(pl.forecastProfit)} tone={tone(pl.forecastProfit)} hint={pct(pl.forecastMarginPct)} />
      </div>

      {pl.overBillingRisk && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-2.5 text-[10px] text-amber-200">
          {rtl
            ? "هشدار: سود تا امروز مثبت است امّا برآوردِ انتهای کار زیان می‌دهد."
            : "Warning: profit to date is positive while the at-complete forecast is a loss."}
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
          ? "درآمد = تجمعیِ صورت‌وضعیت‌های تأییدشده (مالک d14)؛ بهای تمام‌شده = هزینهٔ واقعیِ تخصیص‌یافته (مالک d5). حاشیه، پیش‌پرداخت و وصولی در زیرماژول بعدی است."
          : "Revenue = certified IPC cumulative (owned by d14); cost = allocated actual cost (owned by d5). Margin, advance and receivable are in the next sub-module."}
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
