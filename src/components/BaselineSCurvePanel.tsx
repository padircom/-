import { useMemo } from "react";
import { type Lang } from "../data/framework";

/* ══════════════════════════════════════════════════════════════════════
   نمودار اسکرو (S-Curve) — زیرتبِ «برنامه پایه»

   منحنی برنامه‌ای از PEX_SCURVE می‌آید؛ همان منحنی‌ای که موتور برای
   محاسبهٔ Planned% در Data Date استفاده می‌کند. پس عددی که اینجا
   می‌بینید با عدد داشبورد یکی است، نه یک سری جداگانه.

   ── چرا «واقعی» یک نقطه است و نه یک منحنی ─────────────────────────────

   مدل پیشرفت را به‌صورت عکس فوری نگه می‌دارد: هر گام یک `percent` دارد
   بدون تاریخ (`StepProgress` فیلد تاریخ ندارد). پس تنها چیزی که دربارهٔ
   «واقعی» می‌دانیم مقدار آن در Data Date است. کشیدن منحنی واقعی از
   ابتدای پروژه تا امروز یعنی ساختن تاریخچه‌ای که ثبت نشده.

   این نمودار عمداً آن کار را نمی‌کند. وقتی ثبت پیشرفتِ تاریخ‌دار اضافه
   شد، کافی است سری واقعی به `actualSeries` داده شود و منحنی کامل رسم
   می‌شود؛ جای آن در کد باز گذاشته شده.

   ── محور افقی زمانی است، نه ترتیبی ────────────────────────────────────

   رئوس منحنی فاصلهٔ زمانی برابر ندارند (۳ ژانویه، ۱ مارس، ۳۰ آوریل،
   ۳۰ ژوئن، ۳۱ اوت، ۳۰ سپتامبر، ۳۱ اکتبر، ۷ دسامبر). اگر محور را
   شاخص‌محور بگیریم، بازهٔ دوماهه و بازهٔ یک‌ماهه هم‌عرض کشیده می‌شوند و
   شیب منحنی — که کل حرف S-Curve است — دروغ می‌شود. پس مقیاس بر حسب
   میلی‌ثانیه است.
   ══════════════════════════════════════════════════════════════════════ */

export type CurvePoint = { date: string; cumPct: number };

const W = 880;
const H = 300;
const PAD_L = 42;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 30;

/** تاریخ ISO را در UTC می‌خواند تا منطقهٔ زمانی مرورگر نمودار را جابه‌جا نکند. */
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** درون‌یابی خطی روی منحنی — همان قاعدهٔ plannedPercentAt در موتور. */
function pctAt(curve: CurvePoint[], iso: string): number {
  if (!curve.length) return 0;
  const s = [...curve].sort((a, b) => a.date.localeCompare(b.date));
  if (iso <= s[0].date) return s[0].cumPct;
  const last = s[s.length - 1];
  if (iso >= last.date) return last.cumPct;
  for (let i = 1; i < s.length; i++) {
    if (iso <= s[i].date) {
      const a = s[i - 1];
      const b = s[i];
      const span = ms(b.date) - ms(a.date) || 1;
      return a.cumPct + ((b.cumPct - a.cumPct) * (ms(iso) - ms(a.date))) / span;
    }
  }
  return last.cumPct;
}

/** اول هر ماه میلادی در بازه — برچسب محور افقی. */
function monthTicks(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const d = new Date(ms(fromIso));
  d.setUTCDate(1);
  while (d.getTime() <= ms(toIso)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso >= fromIso) out.push(iso);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export default function BaselineSCurvePanel({
  lang,
  curve,
  dataDate,
  actualPct,
  plannedPct,
  baselineFinish,
  forecastFinish,
  actualSeries,
}: {
  lang: Lang;
  /** منحنی برنامه‌ای پایه (مقدس؛ فقط با درخواست تغییر تأییدشده جابه‌جا می‌شود). */
  curve: CurvePoint[];
  dataDate: string;
  /** پیشرفت واقعی تجمعی در Data Date. */
  actualPct: number;
  /** پیشرفت برنامه‌ای تجمعی در همان تاریخ. */
  plannedPct: number;
  baselineFinish: string;
  /** پایان پیش‌بینی از موتور CPM — مبنای خط پیش‌بینی. */
  forecastFinish: string;
  /** سری واقعیِ تاریخ‌دار، اگر روزی ثبت شد. تا آن وقت نقطهٔ Data Date تنها داده است. */
  actualSeries?: CurvePoint[];
}) {
  const rtl = lang === "fa";

  const g = useMemo(() => {
    const sorted = [...curve].sort((a, b) => a.date.localeCompare(b.date));
    const start = sorted[0]?.date ?? dataDate;
    /* دامنه تا دیرترین تاریخ ممکن کشیده می‌شود، وگرنه اگر پیش‌بینی از
     * پایان پایه عقب‌تر باشد خط پیش‌بینی از قاب بیرون می‌زند. */
    const end = [sorted[sorted.length - 1]?.date, baselineFinish, forecastFinish, dataDate]
      .filter(Boolean)
      .sort()
      .pop() as string;

    const t0 = ms(start);
    const span = Math.max(1, ms(end) - t0);
    const x = (iso: string) => PAD_L + ((ms(iso) - t0) / span) * (W - PAD_L - PAD_R);
    const y = (v: number) => H - PAD_B - (Math.max(0, Math.min(100, v)) / 100) * (H - PAD_T - PAD_B);

    const plannedPath = sorted.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date).toFixed(1)},${y(p.cumPct).toFixed(1)}`).join(" ");

    /* سری واقعی فقط وقتی رسم می‌شود که واقعاً وجود داشته باشد. */
    const aSeries = (actualSeries ?? []).filter((p) => p.date <= dataDate).sort((a, b) => a.date.localeCompare(b.date));
    const actualPath = aSeries.length
      ? aSeries.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date).toFixed(1)},${y(p.cumPct).toFixed(1)}`).join(" ")
      : "";

    return { sorted, start, end, x, y, plannedPath, actualPath, ticks: monthTicks(start, end) };
  }, [curve, dataDate, baselineFinish, forecastFinish, actualSeries]);

  /* SV و SPI از همان دو عددی که موتور داده — بازمحاسبه نمی‌شوند تا با
   * بقیهٔ ماژول اختلاف پیدا نکنند. */
  const sv = Math.round((actualPct - plannedPct) * 100) / 100;
  const spi = plannedPct > 0 ? actualPct / plannedPct : 0;
  const behind = sv < -1;
  const ahead = sv > 1;
  const tone = behind ? "#FF9F9F" : ahead ? "#8FE3C8" : "#7FB2FF";

  const planAtDD = pctAt(g.sorted, dataDate);

  return (
    <div className="fade-rise space-y-2" dir={rtl ? "rtl" : "ltr"}>
      {/* نوار شاخص‌ها — همان قالب فشردهٔ زیرتبِ «برنامه پایه». */}
      <div className="glass-dark flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-3 py-2">
        {[
          { k: rtl ? "تاریخ گزارش" : "Data date", v: dataDate, c: undefined as string | undefined, s: "" },
          { k: rtl ? "پیشرفت واقعی" : "Actual", v: `${actualPct}`, c: tone, s: "%" },
          { k: rtl ? "برنامه‌ای همان تاریخ" : "Planned", v: `${plannedPct}`, c: undefined, s: "%" },
          {
            k: rtl ? "انحراف برنامه (SV)" : "Schedule variance",
            v: `${sv > 0 ? "+" : ""}${sv}`,
            c: tone,
            s: "%",
          },
          { k: "SPI", v: spi.toFixed(3), c: spi < 0.95 ? "#FF9F9F" : spi < 1 ? "#FFD48A" : "#8FE3C8", s: "" },
          { k: rtl ? "پایان پایه" : "Baseline finish", v: baselineFinish, c: undefined, s: "" },
          {
            k: rtl ? "پایان پیش‌بینی" : "Forecast finish",
            v: forecastFinish,
            c: forecastFinish > baselineFinish ? "#FF9F9F" : forecastFinish < baselineFinish ? "#8FE3C8" : undefined,
            s: "",
          },
        ].map((x) => (
          <span key={x.k} className="flex items-baseline gap-1.5">
            <span className="text-[10.5px] tx3">{x.k}</span>
            <span className="text-[15px] tabular-nums" style={{ color: x.c }} dir="ltr">{x.v}</span>
            {x.s && <span className="text-[10px] tx4">{x.s}</span>}
          </span>
        ))}
      </div>

      <div className="glass-dark rounded-2xl p-3">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="text-[11.5px] tx1">{rtl ? "نمودار اسکرو — پیشرفت تجمعی" : "S-Curve — cumulative progress"}</span>
          <span className="ms-auto flex flex-wrap items-center gap-3 text-[9.5px] tx3">
            <Legend color="#7FB2FF" label={rtl ? "برنامهٔ پایه" : "Baseline plan"} />
            <Legend color={tone} label={rtl ? "واقعی در تاریخ گزارش" : "Actual at data date"} dot />
            <Legend color="#C9A9FF" label={rtl ? "پیش‌بینی تا پایان" : "Forecast to finish"} dash />
          </span>
        </div>

        {/* مختصات SVG از جهت متن تأثیر نمی‌گیرد و هر برچسب textAnchor صریح
          * دارد، پس نمودار در حالت راست‌به‌چپ هم درست می‌ماند. */}
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
          aria-label={rtl ? "نمودار اسکرو پیشرفت تجمعی" : "Cumulative progress S-curve"}>
          {/* شبکهٔ افقی */}
          {[0, 20, 40, 60, 80, 100].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={g.y(v)} y2={g.y(v)} stroke="var(--line-soft)" strokeWidth="0.8" />
              <text x={PAD_L - 6} y={g.y(v) + 3.5} fontSize="9.5" fill="var(--ink4)" textAnchor="end">{v}%</text>
            </g>
          ))}

          {/* محور افقی: اول هر ماه */}
          {g.ticks.map((iso) => (
            <g key={iso}>
              <line x1={g.x(iso)} x2={g.x(iso)} y1={PAD_T} y2={H - PAD_B} stroke="var(--line-soft)" strokeWidth="0.4" opacity="0.5" />
              <text x={g.x(iso)} y={H - PAD_B + 13} fontSize="9" fill="var(--ink4)" textAnchor="middle">{iso.slice(5, 7)}</text>
            </g>
          ))}
          <text x={PAD_L} y={H - 4} fontSize="8.5" fill="var(--ink4)" textAnchor="start">{g.start.slice(0, 4)}</text>

          {/* خط پیش‌بینی: از نقطهٔ واقعی تا ۱۰۰٪ در پایان پیش‌بینیِ موتور CPM.
            * برون‌یابی SPI نیست — همان تاریخی است که زمان‌بندی می‌دهد. */}
          <path
            d={`M${g.x(dataDate)},${g.y(actualPct)} L${g.x(forecastFinish)},${g.y(100)}`}
            fill="none" stroke="#C9A9FF" strokeWidth="1.8" strokeDasharray="6 4" opacity="0.85"
          />

          {/* منحنی برنامه‌ای */}
          <path d={g.plannedPath} fill="none" stroke="#7FB2FF" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          {g.sorted.map((p) => (
            <circle key={p.date} cx={g.x(p.date)} cy={g.y(p.cumPct)} r="2.6" fill="#7FB2FF">
              <title>{`${p.date} · ${rtl ? "برنامه‌ای" : "planned"} ${p.cumPct}%`}</title>
            </circle>
          ))}

          {/* منحنی واقعی — فقط اگر سری تاریخ‌دار داده شده باشد. */}
          {g.actualPath && <path d={g.actualPath} fill="none" stroke={tone} strokeWidth="2.2" strokeLinejoin="round" />}

          {/* خط عمودی تاریخ گزارش */}
          <line x1={g.x(dataDate)} x2={g.x(dataDate)} y1={PAD_T} y2={H - PAD_B}
            stroke="var(--ink4)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
          <text x={g.x(dataDate)} y={PAD_T - 4} fontSize="9" fill="var(--ink4)" textAnchor="middle">
            {rtl ? "تاریخ گزارش" : "data date"}
          </text>

          {/* شکاف برنامه‌ای ↔ واقعی در تاریخ گزارش */}
          <line x1={g.x(dataDate)} x2={g.x(dataDate)} y1={g.y(planAtDD)} y2={g.y(actualPct)}
            stroke={tone} strokeWidth="3" opacity="0.5" strokeLinecap="round" />
          <circle cx={g.x(dataDate)} cy={g.y(planAtDD)} r="3.4" fill="none" stroke="#7FB2FF" strokeWidth="1.6">
            <title>{`${dataDate} · ${rtl ? "برنامه‌ای" : "planned"} ${Math.round(planAtDD * 10) / 10}%`}</title>
          </circle>
          <circle cx={g.x(dataDate)} cy={g.y(actualPct)} r="4.4" fill={tone} stroke="var(--row)" strokeWidth="1.4">
            <title>{`${dataDate} · ${rtl ? "واقعی" : "actual"} ${actualPct}%`}</title>
          </circle>
          <text
            x={g.x(dataDate) + 8} y={g.y(actualPct) + 3.5}
            fontSize="10.5" fill={tone} textAnchor="start"
          >
            {`${actualPct}%`}
          </text>

          {/* پایان پایه */}
          <line x1={g.x(baselineFinish)} x2={g.x(baselineFinish)} y1={g.y(100)} y2={H - PAD_B}
            stroke="#7FB2FF" strokeWidth="0.9" strokeDasharray="2 3" opacity="0.6" />
        </svg>

        <p className="mt-1.5 text-[10px] leading-relaxed tx3">
          {rtl
            ? "منحنی آبی برنامهٔ پایه است و محور افقی مقیاس زمانی واقعی دارد، پس شیب‌ها با هم قابل مقایسه‌اند. نقطهٔ پررنگ، پیشرفت واقعی در تاریخ گزارش است؛ میلهٔ عمودی همان نقطه، شکاف با برنامه را نشان می‌دهد. خط بنفش‌چین از پیشرفت امروز به پایانِ پیش‌بینیِ موتور CPM می‌رود."
            : "The blue line is the baseline plan on a true time axis, so slopes are comparable. The solid dot is actual progress at the data date; the vertical bar at that point is the gap to plan. The dashed purple line runs from today's progress to the CPM forecast finish."}
        </p>
        {!g.actualPath && (
          <p className="mt-1 text-[10px] leading-relaxed" style={{ color: "#FFD48A" }}>
            {rtl
              ? "منحنی واقعی رسم نشده چون پیشرفت در مدل بدون تاریخ ثبت می‌شود و فقط مقدار امروز معلوم است. کشیدن خطِ گذشته یعنی ساختن تاریخچه‌ای که وجود ندارد؛ به‌جایش تنها نقطهٔ قابل اثبات نشان داده شده."
              : "No actual curve is drawn: progress is stored without dates, so only today's value is known. Drawing a historical line would fabricate data that was never recorded, so only the provable point is shown."}
          </p>
        )}
      </div>

      {/* رئوس منحنی — برای رسیدگی و مقایسه با سند پایه. */}
      <div className="glass-dark rounded-2xl p-3">
        <div className="mb-2 text-[11.5px] tx1">{rtl ? "رئوس منحنی برنامه‌ای" : "Baseline curve vertices"}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10.5px]">
            <thead>
              <tr className="tx3">
                <th className="py-1 text-start font-normal">{rtl ? "تاریخ" : "Date"}</th>
                <th className="py-1 text-end font-normal">{rtl ? "تجمعی برنامه‌ای" : "Planned cum."}</th>
                <th className="py-1 text-end font-normal">{rtl ? "افزایش دوره" : "Period gain"}</th>
                <th className="py-1 text-end font-normal">{rtl ? "وضعیت" : "State"}</th>
              </tr>
            </thead>
            <tbody>
              {g.sorted.map((p, i) => {
                const prev = i > 0 ? g.sorted[i - 1].cumPct : 0;
                const past = p.date <= dataDate;
                return (
                  <tr key={p.date} className="border-t b-line-soft">
                    <td className="py-1 tabular-nums tx2" dir="ltr">{p.date}</td>
                    <td className="py-1 text-end tabular-nums tx1" dir="ltr">{p.cumPct}%</td>
                    <td className="py-1 text-end tabular-nums tx3" dir="ltr">+{Math.round((p.cumPct - prev) * 10) / 10}%</td>
                    <td className="py-1 text-end tx3">
                      {past ? (rtl ? "گذشته" : "past") : (rtl ? "پیش‌رو" : "ahead")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, dash, dot }: { color: string; label: string; dash?: boolean; dot?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {dot ? (
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      ) : (
        <span
          className="inline-block h-0 w-4"
          style={{ borderTop: `2px ${dash ? "dashed" : "solid"} ${color}` }}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
