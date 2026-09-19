import { Fragment, useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import {
  INITIATIVES_SEED,
  OBJECTIVES_SEED,
  type Perspective,
  evaluateStrategy,
} from "../services/strategy";

/* ══════════════════════════════════════════════════════════════════════
   «مدیریت استراتژیک» — دامنهٔ d20
   نقشه‌ی استراتژی در چهار منظرِ BSC، درختِ هدف/شاخص و سبدِ ابتکارات.
   خروجیِ اصلی: کدام هدف از مسیر خارج شده و کدام ابتکار اثرِ بیشتری دارد.
   ══════════════════════════════════════════════════════════════════════ */

const perspColor: Record<Perspective, string> = {
  financial: "#7FB2FF",
  customer: "#34D399",
  process: "#FBBF24",
  learning: "#A78BFA",
};

const statusLabel = (s: "on_track" | "at_risk" | "delayed", rtl: boolean) =>
  s === "on_track" ? (rtl ? "طبق برنامه" : "On track") : s === "at_risk" ? (rtl ? "در خطر" : "At risk") : (rtl ? "تأخیر" : "Delayed");

const statusColor = (s: "on_track" | "at_risk" | "delayed") =>
  s === "on_track" ? "#34D399" : s === "at_risk" ? "#FBBF24" : "#F87171";

export default function StrategyWorkspace({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const [open, setOpen] = useState<string | null>("o1");
  const res = useMemo(() => evaluateStrategy(OBJECTIVES_SEED, INITIATIVES_SEED), []);

  const pct = (n: number) => `${(n * 100).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}%`;
  const money = (n: number) =>
    `${(n / 1_000_000_000).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })} ${rtl ? "میلیارد ریال" : "B IRR"}`;
  const num = (n: number) => Math.round(n).toLocaleString(rtl ? "fa-IR" : "en-US");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Cell label={rtl ? "تحققِ استراتژی" : "Strategy attainment"} value={pct(res.attainment)} tone={res.attainment >= 0.9 ? "#34D399" : res.attainment >= 0.75 ? "#FBBF24" : "#F87171"} hint={rtl ? "میانگینِ وزنیِ چهار منظر" : "weighted mean of four perspectives"} />
        <Cell label={rtl ? "اهدافِ خارج از مسیر" : "Off-track objectives"} value={num(res.offTrackObjectives.length)} tone={res.offTrackObjectives.length ? "#F87171" : "#34D399"} hint={rtl ? "تحققِ کمتر از ۹۰٪" : "attainment below 90%"} />
        <Cell label={rtl ? "ابتکاراتِ فعال" : "Active initiatives"} value={num(res.priorityInitiatives.length)} hint={rtl ? "شش ابتکارِ جاری" : "six running initiatives"} />
        <Cell label={rtl ? "مصرفِ بودجهٔ ابتکارات" : "Initiative budget used"} value={pct(res.budgetUtilisation)} hint={rtl ? "هزینه‌شده ÷ مصوب" : "spent ÷ approved"} />
      </div>

      {/* منظرها */}
      <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-4">
        {res.perspectives.map((p) => (
          <div key={p.code} className="rounded-xl border b-line-soft bg-[var(--row)] p-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-light tx1">{rtl ? p.label.fa : p.label.en}</span>
              <span className="text-[9px] tx4" dir="ltr">{num(p.weight)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--row-hover)]">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.attainment * 100)}%`, background: perspColor[p.code] }} />
            </div>
            <div className="mt-1 text-[11px] font-light" style={{ color: perspColor[p.code] }}>{pct(p.attainment)}</div>
          </div>
        ))}
      </div>

      {/* درختِ هدف / شاخص */}
      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 bg-[var(--panel2)]">
            <tr className="tx4">
              <th className="px-2 py-2 text-start font-light">{rtl ? "هدف / شاخص" : "Objective / KPI"}</th>
              <th className="px-2 py-2 text-start font-light">{rtl ? "منظر" : "Perspective"}</th>
              <th className="px-2 py-2 text-end font-light" dir="ltr">{rtl ? "مبنا" : "Base"}</th>
              <th className="px-2 py-2 text-end font-light" dir="ltr">{rtl ? "هدف" : "Target"}</th>
              <th className="px-2 py-2 text-end font-light" dir="ltr">{rtl ? "واقعی" : "Actual"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "تحقق" : "Attainment"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "اثر" : "Leverage"}</th>
            </tr>
          </thead>
          <tbody>
            {res.perspectives.flatMap((p) =>
              p.objectives.map((o) => (
                <Fragment key={o.id}>
                  <tr
                    key={o.id}
                    className="cursor-pointer border-t border-[var(--line-soft)] bg-[var(--row)] hover:bg-[var(--row-hover)]"
                    onClick={() => setOpen(open === o.id ? null : o.id)}
                  >
                    <td className="px-2 py-1.5 tx1">
                      <span className="tx4 me-1">{open === o.id ? "▾" : "▸"}</span>
                      {rtl ? o.title.fa : o.title.en}
                    </td>
                    <td className="px-2 py-1.5 tx3">
                      <span className="inline-flex items-center gap-1">
                        <i className="h-1.5 w-1.5 rounded-full" style={{ background: perspColor[p.code] }} />
                        {rtl ? p.label.fa : p.label.en}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-end tx4">—</td>
                    <td className="px-2 py-1.5 text-end tx4">—</td>
                    <td className="px-2 py-1.5 text-end tx4">—</td>
                    <td className="px-2 py-1.5 text-end tx1" style={{ color: o.offTrack ? "#F87171" : "#34D399" }} dir="ltr">{pct(o.attainment)}</td>
                    <td className="px-2 py-1.5 text-end tx3" dir="ltr">{num(o.leverage)}%</td>
                  </tr>
                  {open === o.id &&
                    o.kpis.map((k) => (
                      <tr key={k.id} className="border-t border-[var(--line-soft)]">
                        <td className="ps-6 px-2 py-1.5 tx2">
                          {rtl ? k.name.fa : k.name.en} <span className="tx4">· {rtl ? k.unit.fa : k.unit.en}</span>
                        </td>
                        <td className="px-2 py-1.5 tx4">{rtl ? `وزن ${num(k.weight)}` : `w ${num(k.weight)}`}</td>
                        <td className="px-2 py-1.5 text-end tx3" dir="ltr">{num(k.baseline)}</td>
                        <td className="px-2 py-1.5 text-end tx3" dir="ltr">{num(k.target)}</td>
                        <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(k.actual)}</td>
                        <td className="px-2 py-1.5 text-end" dir="ltr" style={{ color: k.offTrack ? "#FBBF24" : "#34D399" }}>{pct(k.attainment)}</td>
                        <td className="px-2 py-1.5" />
                      </tr>
                    ))}
                </Fragment>
              )),
            )}
          </tbody>
        </table>
      </div>

      {/* ابتکارات */}
      <div className="shrink-0">
        <div className="mb-1 text-[9.5px] font-light tx3">
          {rtl ? "اولویتِ مداخله — اثرِ وزنی × فاصله تا تکمیل" : "Intervention priority — weighted impact × remaining gap"}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {res.priorityInitiatives.map((i) => (
            <div key={i.id} className="min-w-[190px] flex-1 rounded-xl border b-line-soft bg-[var(--row)] p-2.5">
              <div className="truncate text-[10px] font-light tx1">{rtl ? i.name.fa : i.name.en}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--row-hover)]">
                <div className="h-full rounded-full" style={{ width: `${i.progress}%`, background: statusColor(i.status) }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px]">
                <span style={{ color: statusColor(i.status) }}>{statusLabel(i.status, rtl)}</span>
                <span className="tx3" dir="ltr">{i.progress}%</span>
              </div>
              <div className="mt-0.5 text-[8.5px] tx4" dir="ltr">
                {money(i.spent)} / {money(i.budget)}
              </div>
            </div>
          ))}
        </div>
      </div>
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
