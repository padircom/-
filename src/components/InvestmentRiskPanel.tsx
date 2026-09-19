import { useMemo } from "react";
import { type Lang } from "../data/framework";
import {
  CASHFLOWS_SEED,
  DISCOUNT_RATE_SEED,
  MAX_RISK_PREMIUM_SEED,
  RISK_DRIVERS_SEED,
  analyseInvestment,
} from "../services/investment";

/* ══════════════════════════════════════════════════════════════════════
   «داشبورد مدیریت ریسک و تحلیل سرمایه‌گذاری» — تبِ جدید در d4
   NPV پایه → صرفِ ریسک → NPV تعدیل‌شده → سناریوها → حساسیت (تورنادو) → گیت
   ══════════════════════════════════════════════════════════════════════ */

const B = 1_000_000_000;

const decisionColor = { go: "#34D399", conditional: "#FBBF24", no_go: "#F87171" } as const;
const decisionLabel = (d: keyof typeof decisionColor, rtl: boolean) =>
  d === "go" ? (rtl ? "تأیید (Go)" : "Go") : d === "conditional" ? (rtl ? "مشروط (Conditional)" : "Conditional") : (rtl ? "عدم تأیید (No-Go)" : "No-Go");

export default function InvestmentRiskPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const res = useMemo(
    () => analyseInvestment({
      discountRate: DISCOUNT_RATE_SEED,
      cashflows: CASHFLOWS_SEED,
      riskDrivers: RISK_DRIVERS_SEED,
      maxRiskPremium: MAX_RISK_PREMIUM_SEED,
    }),
    [],
  );

  const money = (n: number) =>
    `${(n / B).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })} ${rtl ? "میلیارد ریال" : "B IRR"}`;
  const pct = (n: number) => `${(n * 100).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}%`;
  const maxSwing = Math.max(...res.sensitivity.map((s) => s.swing), 1);
  const maxRisk = Math.max(...res.riskContribution.map((r) => Math.abs(r.value)), 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* خلاصه */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Cell label={rtl ? "NPV پایه" : "Base NPV"} value={money(res.baseNpv)} hint={rtl ? `نرخ تنزیل ${pct(DISCOUNT_RATE_SEED)}` : `discount rate ${pct(DISCOUNT_RATE_SEED)}`} />
        <Cell
          label={rtl ? "NPV تعدیل‌شده با ریسک" : "Risk-adjusted NPV"}
          value={money(res.riskAdjustedNpv)}
          tone={res.riskAdjustedNpv >= 0 ? "#34D399" : "#F87171"}
          hint={rtl ? `نرخ مؤثر ${pct(res.adjustedRate)}` : `effective rate ${pct(res.adjustedRate)}`}
        />
        <Cell
          label={rtl ? "NPV موردانتظار" : "Expected NPV"}
          value={money(res.expectedNpv)}
          tone={res.expectedNpv >= 0 ? "#34D399" : "#F87171"}
          hint={rtl ? "میانگینِ احتمالیِ سه سناریو" : "probability-weighted scenarios"}
        />
        <Cell
          label={rtl ? "تصمیم گیت" : "Gate decision"}
          value={decisionLabel(res.decision, rtl)}
          tone={decisionColor[res.decision]}
          hint={res.internalRate === null ? (rtl ? "IRR محاسبه نشد" : "IRR n/a") : `IRR ${pct(res.internalRate)}`}
        />
      </div>

      <div className="rounded-xl border b-line-soft bg-[var(--row)] p-2.5 text-[10px] tx2">
        {res.decisionHint[rtl ? "fa" : "en"]}
        {res.paybackPeriods !== null && (
          <span className="tx4"> · {rtl ? "دوره بازگشت" : "Payback"}: {res.paybackPeriods.toFixed(1)} {rtl ? "دوره" : "periods"}</span>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-2 overflow-auto lg:grid-cols-2">
        {/* سناریوها */}
        <section className="rounded-xl border b-line-soft p-2.5">
          <h3 className="mb-2 text-[10.5px] font-light tx1">{rtl ? "سناریوها" : "Scenarios"}</h3>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="tx4">
                <th className="px-1 py-1 text-start font-light">{rtl ? "سناریو" : "Scenario"}</th>
                <th className="px-1 py-1 text-end font-light">{rtl ? "احتمال" : "Prob."}</th>
                <th className="px-1 py-1 text-end font-light">NPV</th>
                <th className="px-1 py-1 text-end font-light">{rtl ? "وزن‌دار" : "Weighted"}</th>
              </tr>
            </thead>
            <tbody>
              {res.scenarios.map((s) => (
                <tr key={s.name} className="border-t border-[var(--line-soft)]">
                  <td className="px-1 py-1.5 tx1">{rtl ? s.label.fa : s.label.en}</td>
                  <td className="px-1 py-1.5 text-end tx3" dir="ltr">{pct(s.probability)}</td>
                  <td className="px-1 py-1.5 text-end tx2" dir="ltr" style={{ color: s.npv >= 0 ? "#34D399" : "#F87171" }}>{money(s.npv)}</td>
                  <td className="px-1 py-1.5 text-end tx3" dir="ltr">{money(s.weighted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* حساسیت — تورنادو */}
        <section className="rounded-xl border b-line-soft p-2.5">
          <h3 className="mb-2 text-[10.5px] font-light tx1">{rtl ? "تحلیل حساسیت (تورنادو)" : "Sensitivity (tornado)"}</h3>
          <div className="space-y-2">
            {res.sensitivity.map((s) => (
              <div key={s.id}>
                <div className="flex items-baseline justify-between text-[9.5px]">
                  <span className="tx2">{rtl ? s.label.fa : s.label.en}</span>
                  <span className="tx4" dir="ltr">{money(s.swing)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--row-hover)]">
                  <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${(s.swing / maxSwing) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* سهمِ ریسک‌ها در افت ارزش */}
        <section className="rounded-xl border b-line-soft p-2.5 lg:col-span-2">
          <h3 className="mb-2 text-[10.5px] font-light tx1">
            {rtl ? "سهمِ هر ریسک در کاهشِ ارزش فعلی" : "Value erosion by risk driver"}
          </h3>
          <div className="space-y-1.5">
            {res.riskContribution.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="w-[210px] shrink-0 truncate text-[9.5px] tx2">{rtl ? r.name.fa : r.name.en}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--row-hover)]">
                  <div
                    className="h-full rounded-full bg-rose-400/70"
                    style={{ width: `${(Math.abs(r.value) / maxRisk) * 100}%` }}
                  />
                </div>
                <span className="w-[110px] shrink-0 text-end text-[9px] tx3" dir="ltr">{money(Math.abs(r.value))}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] font-extralight tx4">
            {rtl
              ? `صرفِ ریسکِ اعمال‌شده: ${pct(res.riskPremium)} — حاصلِ میانگینِ وزنیِ شدتِ ریسک‌ها تا سقف ${pct(MAX_RISK_PREMIUM_SEED)}.`
              : `Applied risk premium: ${pct(res.riskPremium)} — weighted mean risk severity, capped at ${pct(MAX_RISK_PREMIUM_SEED)}.`}
          </p>
        </section>
      </div>
    </div>
  );
}

function Cell({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
      <div className="text-[8.5px] font-extralight tx4">{label}</div>
      <div className="mt-1 text-[12px] font-light tx1" style={{ color: tone }}>{value}</div>
      {hint && <div className="mt-0.5 text-[9px] font-extralight tx3">{hint}</div>}
    </div>
  );
}
