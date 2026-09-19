import { useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import { EFQM_CRITERIA, EFQM_SEED, type Assessment, type RadarScore, assess } from "../services/efqm";

/* ══════════════════════════════════════════════════════════════════════
   «مدیریت تعالی سازمانی (EFQM)» — دامنهٔ d19
   خودارزیابیِ ۹ معیار با منطقِ RADAR و امتیازِ ۰ تا ۱۰۰۰.
   ══════════════════════════════════════════════════════════════════════ */

const axisLabels = (kind: "enabler" | "result", rtl: boolean): [string, string] =>
  kind === "enabler"
    ? [rtl ? "رویکرد" : "Approach", rtl ? "استقرار" : "Deployment"]
    : [rtl ? "ربط و کاربرد" : "Relevance & usability", rtl ? "عملکرد" : "Performance"];

export default function EfqmPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const [values, setValues] = useState<Assessment>(EFQM_SEED);
  const res = useMemo(() => assess(values), [values]);

  const set = (code: string, key: keyof RadarScore, v: number) =>
    setValues((prev) => ({ ...prev, [code]: { ...(prev[code] ?? { a: 0, b: 0 }), [key]: v } }));

  const num = (n: number) => Math.round(n).toLocaleString(rtl ? "fa-IR" : "en-US");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Cell label={rtl ? "امتیاز کل" : "Total score"} value={`${num(res.total)} / ${num(res.maxTotal)}`} hint={res.level[rtl ? "fa" : "en"]} tone="#7FB2FF" />
        <Cell label={rtl ? "توانمندسازها" : "Enablers"} value={`${num(res.enablerPoints)} / 500`} hint={rtl ? "پنج معیار" : "five criteria"} />
        <Cell label={rtl ? "نتایج" : "Results"} value={`${num(res.resultPoints)} / 500`} hint={rtl ? "چهار معیار" : "four criteria"} />
        <Cell
          label={rtl ? "ضعیف‌ترین معیار" : "Weakest criterion"}
          value={res.weakest ? (rtl ? res.weakest.label.fa : res.weakest.label.en) : "—"}
          hint={res.weakest ? `${num(res.weakest.attainmentPct)}%` : undefined}
          tone={res.weakest && res.weakest.attainmentPct < 60 ? "#F87171" : "#FBBF24"}
        />
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 bg-[var(--panel2)]">
            <tr className="tx4">
              <th className="px-2 py-2 text-start font-light">{rtl ? "معیار" : "Criterion"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "وزن" : "Weight"}</th>
              <th className="px-2 py-2 text-start font-light" style={{ minWidth: 170 }}>{rtl ? "بُعد اول" : "Axis 1"}</th>
              <th className="px-2 py-2 text-start font-light" style={{ minWidth: 170 }}>{rtl ? "بُعد دوم" : "Axis 2"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "امتیاز" : "Points"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "تحقق" : "Attainment"}</th>
            </tr>
          </thead>
          <tbody>
            {res.lines.map((l, i) => {
              const [a1, a2] = axisLabels(l.kind, rtl);
              const crit = EFQM_CRITERIA[i];
              return (
                <tr key={l.code} className="border-t border-[var(--line-soft)]">
                  <td className="px-2 py-2">
                    <div className="tx1">{rtl ? l.label.fa : l.label.en}</div>
                    <div className="tx4">{crit.hint[rtl ? "fa" : "en"]}</div>
                  </td>
                  <td className="px-2 py-2 text-end tx3" dir="ltr">{num(l.weight)}</td>
                  <td className="px-2 py-2">
                    <Slider label={a1} value={l.radar.a} onChange={(v) => set(l.code, "a", v)} rtl={rtl} />
                  </td>
                  <td className="px-2 py-2">
                    <Slider label={a2} value={l.radar.b} onChange={(v) => set(l.code, "b", v)} rtl={rtl} />
                  </td>
                  <td className="px-2 py-2 text-end tx1" dir="ltr">{num(l.points)}</td>
                  <td className="px-2 py-2 text-end" dir="ltr" style={{ color: l.attainmentPct >= 70 ? "#34D399" : l.attainmentPct >= 55 ? "#FBBF24" : "#F87171" }}>
                    {num(l.attainmentPct)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] font-extralight tx4">
        {rtl
          ? "امتیاز هر معیار = میانگینِ دو بُعدِ RADAR × وزن ÷ ۱۰۰. سطوح: ۳۰۰+ در مسیر، ۴۰۰+ سه ستاره، ۵۰۰+ چهار ستاره، ۶۰۰+ پنج ستاره، ۷۰۰+ نامزد/برنده."
          : "Criterion points = mean of two RADAR axes × weight ÷ 100. Levels: 300+ on the way, 400+ three-star, 500+ four-star, 600+ five-star, 700+ finalist/winner."}
      </p>
    </div>
  );
}

function Slider({ label, value, onChange, rtl }: { label: string; value: number; onChange: (v: number) => void; rtl: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-[86px] shrink-0 text-[8.5px] font-extralight tx4">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20"
      />
      <span className="tabular-nums text-[9.5px] tx2" dir="ltr">
        {Math.round(value).toLocaleString(rtl ? "fa-IR" : "en-US")}
      </span>
    </label>
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
