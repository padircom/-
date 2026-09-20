import { useMemo } from "react";
import { type Lang } from "../data/framework";
import { SCURVE_SEED, sCurve } from "../services/scheduleInsights";

/* ══════════════════════════════════════════════════════════════════════
   داشبورد «نمودار S و پیشرفت تجمعی» — دامنهٔ d3 (پایش و کنترل عملکرد)
   برنامه‌ایِ تجمعی در برابر واقعیِ تجمعی، SV، SPI و پیش‌بینی بر مبنای SPI.
   ══════════════════════════════════════════════════════════════════════ */

const W = 720;
const H = 260;
const PAD = 34;

export default function ProgressSCurvePanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const res = useMemo(() => sCurve(SCURVE_SEED), []);

  const maxY = 100;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, res.points.length - 1);
  const y = (v: number) => H - PAD - (v / maxY) * (H - PAD * 2);

  const plannedPath = res.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.plannedPct * 100)}`).join(" ");
  const actualPts = res.points.filter((p) => p.actualPct !== null);
  const actualPath = actualPts
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(res.points.indexOf(p))},${y((p.actualPct ?? 0) * 100)}`)
    .join(" ");
  const areaPath = actualPts.length
    ? `${actualPath} L${x(res.points.indexOf(actualPts[actualPts.length - 1]))},${y(0)} L${x(0)},${y(0)} Z`
    : "";

  const pct = (n: number) => `${(n * 100).toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}%`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Kpi
          label={rtl ? "پیشرفت واقعی تجمعی" : "Actual cumulative"}
          value={pct(res.performed / 100)}
          hint={rtl ? "تا آخرین دورهٔ ثبت‌شده" : "to last recorded period"}
        />
        <Kpi
          label={rtl ? "برنامهٔ تجمعی همان نقطه" : "Planned at same point"}
          value={pct((res.performed / 100) - res.svPct)}
          hint={rtl ? "مبنای مقایسه" : "comparison baseline"}
        />
        <Kpi
          label={rtl ? "انحراف برنامه (SV)" : "Schedule variance"}
          value={`${res.svPct > 0 ? "+" : ""}${pct(res.svPct)}`}
          tone={res.behind ? "#F87171" : "#34D399"}
          hint={res.behind ? (rtl ? "عقب‌تر از برنامه" : "behind plan") : (rtl ? "جلوتر از برنامه" : "ahead of plan")}
        />
        <Kpi
          label={rtl ? "شاخص SPI" : "SPI"}
          value={res.spi.toFixed(2)}
          tone={res.spi < 0.95 ? "#F87171" : res.spi < 1 ? "#FBBF24" : "#34D399"}
          hint={rtl ? `پیش‌بینی پایان: ${pct(res.forecastProgress)}` : `forecast: ${pct(res.forecastProgress)}`}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft bg-[var(--row)] p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="S-Curve">
          {/* شبکه */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={PAD} x2={W - PAD} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" strokeWidth="0.8" />
              <text x={6} y={y(v) + 3} fontSize="9" fill="var(--ink4)">{v}%</text>
            </g>
          ))}
          {/* برنامه */}
          <path d={plannedPath} fill="none" stroke="#7FB2FF" strokeWidth="2" strokeDasharray="5 4" />
          {/* واقعی */}
          <path d={areaPath} fill="rgba(52,211,153,0.12)" stroke="none" />
          <path d={actualPath} fill="none" stroke="#34D399" strokeWidth="2.4" />
          {actualPts.map((p) => (
            <circle key={p.period} cx={x(res.points.indexOf(p))} cy={y((p.actualPct ?? 0) * 100)} r="2.6" fill="#34D399" />
          ))}
          {/* برچسب دوره‌ها */}
          {res.points.map((p, i) => (
            <text key={p.period} x={x(i)} y={H - PAD + 14} fontSize="8" textAnchor="middle" fill="var(--ink4)">
              {p.period.slice(-2)}
            </text>
          ))}
        </svg>
        <div className="mt-1 flex items-center gap-4 px-2 text-[9px] tx3">
          <span className="flex items-center gap-1.5">
            <i className="h-0.5 w-4" style={{ background: "#7FB2FF" }} />
            {rtl ? "برنامه‌ای تجمعی" : "Planned cumulative"}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-0.5 w-4" style={{ background: "#34D399" }} />
            {rtl ? "واقعی تجمعی" : "Actual cumulative"}
          </span>
        </div>
      </div>

      <p className="text-[9px] font-extralight tx4">
        {rtl
          ? "SV = واقعی تجمعی − برنامه‌ای تجمعی در آخرین دورهٔ ثبت‌شده؛ SPI = واقعی ÷ برنامه‌ای. پیش‌بینی با ضربِ پیشرفت در SPI است."
          : "SV = actual − planned cumulative at the last recorded period; SPI = actual ÷ planned. Forecast scales progress by SPI."}
      </p>
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
      <div className="text-[8.5px] font-extralight tx4">{label}</div>
      <div className="mt-1 text-[13px] font-light tx1" style={{ color: tone }}>{value}</div>
      {hint && <div className="mt-0.5 text-[9px] font-extralight tx3">{hint}</div>}
    </div>
  );
}
