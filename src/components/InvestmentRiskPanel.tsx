import { useMemo, useState } from "react";
import { clusters, projectsByCluster, type Lang, t } from "../data/framework";
import { useSystem } from "../context/SystemContext";
import {
  DISCOUNT_RATE_SEED,
  MAX_RISK_HAIRCUT_SEED,
  MAX_RISK_PREMIUM_SEED,
  RISK_DRIVERS_SEED,
  analyseInvestment,
  buildProjectCashflow,
  parseBudgetToNumber,
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
  const { projectScope } = useSystem();

  const allProjects = useMemo(
    () => clusters.flatMap((c) => (projectsByCluster[c.id] ?? []).map((p) => ({ ...p, cluster: c.id }))),
    [],
  );
  const scopedId = projectScope?.projectId ?? allProjects[0]?.id ?? "";
  const [projectId, setProjectId] = useState(scopedId);

  const [discountRate, setDiscountRate] = useState(DISCOUNT_RATE_SEED);
  const [margin, setMargin] = useState(0.14);
  const [advancePct, setAdvancePct] = useState(0.2);
  const [retentionPct, setRetentionPct] = useState(0.1);
  const [durationMonths, setDurationMonths] = useState(36);
  const [delayMonths, setDelayMonths] = useState(3);
  const [lagMonths, setLagMonths] = useState(2);

  const project = allProjects.find((p) => p.id === projectId) ?? allProjects[0];
  const contractValue = project ? parseBudgetToNumber(project.budget) : 0;

  const res = useMemo(
    () => analyseInvestment({
      discountRate,
      cashflows: buildProjectCashflow({
        contractValue,
        margin,
        advancePct,
        retentionPct,
        durationMonths,
        delayMonths,
        collectionLagMonths: lagMonths,
      }),
      riskDrivers: RISK_DRIVERS_SEED,
      maxRiskPremium: MAX_RISK_PREMIUM_SEED,
    }),
    [discountRate, contractValue, margin, advancePct, retentionPct, durationMonths, delayMonths, lagMonths],
  );

  const money = (n: number) =>
    `${(n / B).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })} ${rtl ? "میلیارد ریال" : "B IRR"}`;
  const pct = (n: number) => `${(n * 100).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}%`;
  const maxSwing = Math.max(...res.sensitivity.map((s) => s.swing), 1);
  const maxRisk = Math.max(...res.riskContribution.map((r) => Math.abs(r.value)), 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="grid shrink-0 grid-cols-2 gap-2 rounded-xl border b-line-soft bg-[var(--row)] p-2.5 lg:grid-cols-4">
        <label className="text-[9.5px] tx3">
          <span className="block">{rtl ? "پروژه" : "Project"}</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--line-soft)] bg-transparent px-1 py-0.5 text-[10px] tx1"
          >
            {allProjects.map((p) => (
              <option key={p.id} value={p.id}>{t(p.name, lang)}</option>
            ))}
          </select>
        </label>
        <NumField label={rtl ? "نرخ تنزیل (٪)" : "Discount rate (%)"} value={Math.round(discountRate * 100)} min={0} max={60} step={1} onChange={(v) => setDiscountRate(v / 100)} />
        <NumField label={rtl ? "حاشیهٔ سود (٪)" : "Margin (%)"} value={Math.round(margin * 100)} min={0} max={60} step={1} onChange={(v) => setMargin(v / 100)} />
        <NumField label={rtl ? "پیش‌پرداخت (٪)" : "Advance (%)"} value={Math.round(advancePct * 100)} min={0} max={50} step={1} onChange={(v) => setAdvancePct(v / 100)} />
        <NumField label={rtl ? "حسن‌انجام (٪)" : "Retention (%)"} value={Math.round(retentionPct * 100)} min={0} max={30} step={1} onChange={(v) => setRetentionPct(v / 100)} />
        <NumField label={rtl ? "دورهٔ ساخت (ماه)" : "Duration (mo)"} value={durationMonths} min={6} max={120} step={1} onChange={setDurationMonths} />
        <NumField label={rtl ? "تأخیر (ماه)" : "Delay (mo)"} value={delayMonths} min={0} max={36} step={1} onChange={setDelayMonths} />
        <NumField label={rtl ? "تأخیرِ وصول (ماه)" : "Collection lag (mo)"} value={lagMonths} min={0} max={12} step={1} onChange={setLagMonths} />
      </div>
      <div className="shrink-0 text-[9.5px] tx4">
        {rtl ? "ارزشِ قراردادِ برآوردی: " : "Estimated contract value: "}
        <span dir="ltr">{money(contractValue)}</span>
        {project && <span className="tx4"> · {t(project.name, lang)}</span>}
      </div>

      {/* خلاصه */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <Cell label={rtl ? "NPV پایه" : "Base NPV"} value={money(res.baseNpv)} hint={rtl ? `نرخ تنزیل ${pct(DISCOUNT_RATE_SEED)}` : `discount rate ${pct(DISCOUNT_RATE_SEED)}`} />
        <Cell
          label={rtl ? "NPV تعدیل‌شده با ریسک" : "Risk-adjusted NPV"}
          value={money(res.riskAdjustedNpv)}
          tone={res.riskAdjustedNpv >= 0 ? "#34D399" : "#F87171"}
          hint={rtl ? `کاهشِ قطعیتِ وصولی‌ها ${pct(res.riskHaircut)}` : `certainty haircut ${pct(res.riskHaircut)}`}
        />
        <Cell
          label={rtl ? "NPV با نرخِ تعدیلی" : "NPV at risk-adjusted rate"}
          value={money(res.rateAdjustedNpv)}
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
              ? `کاهشِ قطعیتِ وصولی‌ها: ${pct(res.riskHaircut)} — میانگینِ وزنیِ شدتِ ریسک‌ها تا سقف ${pct(MAX_RISK_HAIRCUT_SEED)}؛ صرفِ نرخ نیز ${pct(res.riskPremium)} است. تحلیل از دیدِ مجری (پیمانکار) است: پیش‌پرداخت مثبت، هزینه‌ها منفی، وصولی‌ها مثبت.`
              : `Certainty haircut on inflows: ${pct(res.riskHaircut)} — weighted mean risk severity capped at ${pct(MAX_RISK_HAIRCUT_SEED)}; rate premium is ${pct(res.riskPremium)}. Viewpoint: contractor — advance positive, costs negative, receipts positive.`}
          </p>
        </section>
      </div>
    </div>
  );
}

function NumField({
  label, value, min, max, step, onChange,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="text-[9.5px] tx3">
      <span className="block">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="mt-1 w-full rounded border border-[var(--line-soft)] bg-transparent px-1 py-0.5 text-[10px] tx1"
        dir="ltr"
      />
    </label>
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
