/**
 * ویجت‌های داشبورد کنترل پروژه — سنجهٔ SPI، دونات پیشرفت، میلهٔ مقایسه‌ای
 * و روند انحراف زمان‌بندی.
 *
 * قاعدهٔ اصلی: هیچ عددی synthesize نمی‌شود. همهٔ مقادیر از تصاویر EVM
 * ثبت‌شده (EvmSnapshot) می‌آیند؛ نبود تصویر یعنی ویجت خالی، نه ویجت با
 * مقدار ساختگی.
 *
 * پالت با بقیهٔ برنامه یکی است — همان رنگ‌های SnapshotTrend و مسیر
 * بحرانی: برنامه‌ای #7FB2FF · کسب‌شده #8FE3C8 · هزینهٔ واقعی #FFD48A ·
 * انحراف منفی #FF9F9F.
 */

import { toJalaali } from "jalaali-js";
import type { Lang } from "../data/framework";

/* ══════════════════════════ قالب‌بندی ══════════════════════════ */

const num = (v: number, lang: Lang, digits = 1) =>
  v.toLocaleString(lang === "fa" ? "fa-IR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** مبلغ به واحد منبع — بدون تبدیل ارز و بدون جمع دوباره با هزینهٔ جاری. */
const money = (v: number, lang: Lang) => num(v, lang, 0);

/**
 * تاریخ ISO → شمسی خواندنی. اگر تبدیل شکست خورد، خود ISO برمی‌گردد تا
 * تاریخ از دست نرود؛ ذخیرهٔ داخلی همیشه ISO می‌ماند.
 */
export function jalaliLabel(iso: string | null, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    const j = toJalaali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    const pad = (n: number) => String(n).padStart(2, "0");
    const label = `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
    return lang === "fa" ? label : iso;
  } catch {
    return iso;
  }
}

/* ══════════════════════════ سنجهٔ SPI ══════════════════════════ */

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/** مقیاس سنجه ۰ تا ۱٫۵ — بالاتر از آن عدد، معنا ندارد. */
const SPI_MAX = 1.5;
/** باندها با آستانهٔ خودِ برنامه: کمتر از ۰٫۹۵ هشدار، کمتر از ۱ عقب. */
const SPI_BANDS: [number, number, string][] = [
  [0, 0.85, "#FF9F9F"],
  [0.85, 0.95, "#FFD48A"],
  [0.95, SPI_MAX, "#8FE3C8"],
];

export function SpiDial({ value, lang }: { value: number | null; lang: Lang }) {
  const fa = lang === "fa";
  const cx = 100;
  const cy = 98;
  const r = 76;
  const ang = (v: number) => 180 + (Math.min(Math.max(v, 0), SPI_MAX) / SPI_MAX) * 180;
  const [nx, ny] = polar(cx, cy, r - 16, value === null ? 270 : ang(value));
  const clamped = value === null ? null : Math.min(Math.max(value, 0), SPI_MAX);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-full max-w-[220px]" role="img"
        aria-label={fa ? `سنجهٔ شاخص عملکرد زمان‌بندی: ${value === null ? "بدون داده" : num(value, lang, 2)}` : `Schedule performance index gauge: ${value === null ? "no data" : num(value, lang, 2)}`}>
        {SPI_BANDS.map(([a0, a1, color]) => (
          <path key={color} d={arcPath(cx, cy, r, ang(a0), ang(a1))} fill="none" stroke={color} strokeWidth={13} strokeLinecap="butt" opacity={value === null ? 0.35 : 0.9} />
        ))}
        {/* خط مرز باندها: مرزِ زرد/سبز همان آستانهٔ ۰٫۹۵ است. */}
        {[0.85, 0.95].map((t) => {
          const [x, y] = polar(cx, cy, r - 8, ang(t));
          const [x2, y2] = polar(cx, cy, r + 8, ang(t));
          return <line key={t} x1={x} y1={y} x2={x2} y2={y2} stroke="rgba(255,255,255,.45)" strokeWidth={1} />;
        })}
        {clamped !== null && (
          <>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="tx1" />
            <circle cx={cx} cy={cy} r={5} fill="currentColor" className="tx1" />
          </>
        )}
        <text x={cx} y={cy - 26} textAnchor="middle" className="tx1" fontSize={30} fontWeight={600} fill="currentColor">
          {value === null ? "—" : num(value, lang, 2)}
        </text>
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={10} className="tx3" fill="currentColor">
          SPI
        </text>
        <text x={cx - r - 4} y={cy + 14} textAnchor="middle" fontSize={8.5} className="tx4" fill="currentColor">۰</text>
        <text x={cx + r + 4} y={cy + 14} textAnchor="middle" fontSize={8.5} className="tx4" fill="currentColor">۱٫۵</text>
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] tx3">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "#FF9F9F" }} />{fa ? "عقب (>۵٪)" : "Behind (>5%)"}</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "#FFD48A" }} />{fa ? "هشدار" : "Warning"}</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "#8FE3C8" }} />{fa ? "روی برنامه" : "On plan"}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════ دونات پیشرفت ══════════════════════════ */

/**
 * دو حلقهٔ تمرکز: بیرونی EV/BAC (کسب‌شده)، درونی PV/BAC (برنامه‌ای).
 * چرا دو حلقه و نه یک دونات تک‌قطعه؟ چون اگر EV از PV کمتر باشد،
 * «کسب‌نشده» بخشی از برنامه است نه بخشی از کل — با یک دونات، قطعهٔ
 * منفی می‌سازد که در دونات بی‌معناست.
 */
export function ProgressDonut({
  pv, ev, bac, lang,
}: { pv: number | null; ev: number | null; bac: number | null; lang: Lang }) {
  const fa = lang === "fa";
  const base = bac && bac > 0 ? bac : null;
  const evFrac = base && ev !== null ? Math.min(1, Math.max(0, ev / base)) : null;
  const pvFrac = base && pv !== null ? Math.min(1, Math.max(0, pv / base)) : null;
  const outer = 2 * Math.PI * 34;
  const inner = 2 * Math.PI * 25;
  const spi = pv && pv > 0 && ev !== null ? ev / pv : null;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 80 80" className="h-32 w-32" role="img"
        aria-label={fa ? "دونات پیشرفت کسب‌شده در مقابل برنامه‌ای" : "Earned vs planned progress donut"}>
        <g transform="rotate(-90 40 40)">
          <circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={7} />
          {evFrac !== null && (
            <circle cx={40} cy={40} r={34} fill="none" stroke="#8FE3C8" strokeWidth={7} strokeLinecap="round"
              strokeDasharray={`${(evFrac * outer).toFixed(2)} ${outer.toFixed(2)}`} />
          )}
          <circle cx={40} cy={40} r={25} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={6} />
          {pvFrac !== null && (
            <circle cx={40} cy={40} r={25} fill="none" stroke="#7FB2FF" strokeWidth={6} strokeLinecap="round"
              strokeDasharray={`${(pvFrac * inner).toFixed(2)} ${inner.toFixed(2)}`} />
          )}
        </g>
        <text x={40} y={38} textAnchor="middle" fontSize={17} fontWeight={600} className="tx1" fill="currentColor">
          {evFrac === null ? "—" : `${num(evFrac * 100, lang, 1)}%`}
        </text>
        <text x={40} y={51} textAnchor="middle" fontSize={8} className="tx3" fill="currentColor">
          {fa ? "کسب‌شده از BAC" : "of BAC"}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] tx3">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "#8FE3C8" }} />{fa ? "کسب‌شده (EV)" : "Earned (EV)"}</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "#7FB2FF" }} />{fa ? "برنامه‌ای (PV)" : "Planned (PV)"}</span>
        {spi !== null && <span className="tabular-nums" dir="ltr">SPI {num(spi, lang, 2)}</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════ میلهٔ مقایسه‌ای ══════════════════════════ */

export function TriBar({
  pv, ev, ac, lang,
}: { pv: number | null; ev: number | null; ac: number | null; lang: Lang }) {
  const fa = lang === "fa";
  const rows: { label: string; v: number | null; c: string }[] = [
    { label: fa ? "برنامه‌ای (PV)" : "Planned (PV)", v: pv, c: "#7FB2FF" },
    { label: fa ? "کسب‌شده (EV)" : "Earned (EV)", v: ev, c: "#8FE3C8" },
    { label: fa ? "هزینهٔ واقعی (AC)" : "Actual cost (AC)", v: ac, c: "#FFD48A" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.v ?? 0));

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-[10px] tx2">
            <span>{r.label}</span>
            <span className="tabular-nums" dir="ltr">{r.v === null ? "—" : money(r.v, lang)}</span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded bg-white/10">
            {r.v !== null && <div className="h-3 rounded" style={{ width: `${(r.v / max) * 100}%`, background: r.c }} />}
          </div>
        </div>
      ))}
      <p className="text-[9px] tx4">
        {fa ? "مبالغ در واحد منبع‌اند؛ بدون تبدیل ارز و بدون جمع دوباره با هزینهٔ جاری." : "Amounts keep source units; no FX conversion, no double counting with current costs."}
      </p>
    </div>
  );
}

/* ══════════════════════════ روند انحراف ══════════════════════════ */

export type VariancePoint = { id: string; dataDate: string | null; sv: number | null };

/**
 * انحراف زمان‌بندی (SV = EV − PV) به تفکیک تصویر ثبت‌شده.
 * میله‌ها از خط صفر واگرا می‌روند — بدون خط صفر، خواندن بزرگی
 * انحراف ممکن نیست.
 */
export function VarianceTrend({ history, lang }: { history: VariancePoint[]; lang: Lang }) {
  const fa = lang === "fa";
  const pts = history.filter((p) => p.dataDate && p.sv !== null);
  if (!pts.length) {
    return (
      <p className="py-6 text-center text-[10.5px] tx4">
        {fa ? "تصویر EVM ثبت‌شده‌ای برای رسم روند نیست." : "No stored EVM snapshot to plot."}
      </p>
    );
  }
  const W = 680;
  const H = 190;
  const PAD_L = 58;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 24;
  const vals = pts.map((p) => p.sv as number);
  const rawMax = Math.max(...vals, 0);
  const rawMin = Math.min(...vals, 0);
  const span = Math.max(1e-9, rawMax - rawMin);
  const step = pts.length > 1 ? (W - PAD_L - PAD_R) / (pts.length - 1) : 0;
  const barW = Math.min(26, Math.max(6, step * 0.55));
  const x = (i: number) => PAD_L + i * step;
  const y = (v: number) => PAD_T + (1 - (v - rawMin) / span) * (H - PAD_T - PAD_B);
  const zeroY = y(0);
  const tickEvery = Math.ceil(pts.length / 8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={fa ? "روند انحراف زمان‌بندی به تفکیک تصویر ثبت‌شده" : "Schedule variance trend across stored snapshots"}>
      {/* خط صفر — مرجع خواندن انحراف */}
      <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="rgba(255,255,255,.55)" strokeWidth={1.2} />
      <text x={PAD_L - 8} y={y(rawMax) + 4} textAnchor="end" fontSize={9} className="tx4" fill="currentColor">
        {money(rawMax, lang)}
      </text>
      <text x={PAD_L - 8} y={zeroY + 4} textAnchor="end" fontSize={9} className="tx4" fill="currentColor">۰</text>
      <text x={PAD_L - 8} y={y(rawMin) + 4} textAnchor="end" fontSize={9} className="tx4" fill="currentColor">
        {money(rawMin, lang)}
      </text>
      {pts.map((p, i) => {
        const v = p.sv as number;
        const top = v >= 0 ? y(v) : zeroY;
        const h = Math.max(1.5, Math.abs(y(v) - zeroY));
        return (
          <g key={p.id}>
            <rect x={x(i) - barW / 2} y={top} width={barW} height={h} rx={1.5}
              fill={v >= 0 ? "#8FE3C8" : "#FF9F9F"}>
              <title>{`${jalaliLabel(p.dataDate, lang)} · SV ${v >= 0 ? "+" : "−"}${money(Math.abs(v), lang)}`}</title>
            </rect>
            {i % tickEvery === 0 || i === pts.length - 1 ? (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={8.5} className="tx4" fill="currentColor">
                {jalaliLabel(p.dataDate, fa ? "fa" : "en").replace(/^[^/]*\//, "")}
              </text>
            ) : null}
          </g>
        );
      })}
      <text x={PAD_L} y={H - 6} fontSize={8.5} className="tx4" fill="currentColor">
        {fa ? "SV = EV − PV به ازای هر تصویر؛ مثبت = جلوتر از برنامه" : "SV = EV − PV per snapshot; positive = ahead of plan"}
      </text>
    </svg>
  );
}
