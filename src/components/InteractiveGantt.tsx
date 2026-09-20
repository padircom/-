/**
 * گانت تعاملی با تعدیل دستی و تراز هوشمند.
 *
 * این نما از قبل در `CapabilityDetail` وجود داشت ولی عملاً غیرقابل
 * دسترس بود: `ModuleDetail` برای حوزهٔ d2 خیلی زودتر به
 * `PlanningWorkspace` منشعب می‌شود و هرگز به شاخه‌ای که
 * `CapabilityDetail` را رندر می‌کند نمی‌رسد.
 *
 * جدول تحلیلی که زیرش بود حذف شد؛ ستون‌های مفیدش (شروع، پایان، شناوری)
 * به خود نمودار آمدند تا یک نمایش واحد بماند. دو جدول از یک داده یعنی
 * کاربر باید حدس بزند کدام مرجع است.
 */

import { useMemo, useState } from "react";
import type { Lang } from "../data/framework";

export type GanttActivity = {
  id: string;
  nameFa: string;
  nameEn?: string;
  startDay: number;
  duration: number;
  progress: number;
  critical: boolean;
  resource?: string;
};

const SAMPLE: GanttActivity[] = [
  { id: "act1", nameFa: "مطالعات مقدماتی و تجهیز کارگاه", nameEn: "Mobilization & Site Prep", startDay: 1, duration: 8, progress: 90, critical: true, resource: "Eng. Team" },
  { id: "act2", nameFa: "طراحی تفصیلی فونداسیون", nameEn: "Foundation Detailed Design", startDay: 9, duration: 12, progress: 65, critical: true, resource: "Civil Dept" },
  { id: "act3", nameFa: "خرید لوله‌ها و اقلام پایپینگ", nameEn: "Piping Material Procurement", startDay: 14, duration: 20, progress: 30, critical: false, resource: "Procurement" },
  { id: "act4", nameFa: "گودبرداری و بتن‌ریزی فونداسیون", nameEn: "Excavation & Concreting", startDay: 21, duration: 15, progress: 10, critical: true, resource: "Civil Contractor" },
  { id: "act5", nameFa: "نصب تجهیزات مکانیکی و پایپینگ", nameEn: "Mechanical Installation", startDay: 36, duration: 18, progress: 0, critical: true, resource: "Mech. Contractor" },
  { id: "act6", nameFa: "راه‌اندازی و تست سرد سیستم", nameEn: "Cold Commissioning & Testing", startDay: 54, duration: 7, progress: 0, critical: false, resource: "Commissioning Team" },
];

type Props = { lang: Lang; activities?: GanttActivity[] };

/** روز جاری فرضی برای خط «امروز» — وسط افق، تا خط همیشه دیده شود. */
const TODAY_RATIO = 0.42;

export default function InteractiveGantt({ lang, activities: incoming }: Props) {
  const rtl = lang === "fa";
  const isSample = !incoming || incoming.length === 0;
  const [rows, setRows] = useState<GanttActivity[]>(incoming?.length ? incoming : SAMPLE);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [onlyCritical, setOnlyCritical] = useState(false);

  const horizon = useMemo(() => {
    const end = rows.reduce((m, a) => Math.max(m, a.startDay + a.duration), 0);
    return Math.max(60, Math.ceil(end / 10) * 10);
  }, [rows]);

  const buckets = Math.max(6, Math.ceil(horizon / 10));
  const todayDay = Math.round(horizon * TODAY_RATIO);

  const visible = onlyCritical ? rows.filter((r) => r.critical) : rows;

  const setDuration = (id: string, dur: number) => {
    setRows((prev) => prev.map((a) => (a.id === id ? { ...a, duration: Math.max(1, dur) } : a)));
    setNote(null);
  };

  const balance = () => {
    setBusy(true);
    setNote(null);
    window.setTimeout(() => {
      let touched = 0;
      setRows((prev) =>
        prev.map((a) => {
          if (a.critical && a.duration > 10) {
            touched += 1;
            return { ...a, duration: a.duration - 2, progress: Math.min(100, a.progress + 5) };
          }
          return a;
        }),
      );
      setBusy(false);
      setNote(
        touched > 0
          ? (rtl ? `${touched} فعالیت بحرانی متعادل شد؛ مدت هرکدام ۲ روز کاهش یافت.` : `${touched} critical activities levelled.`)
          : (rtl ? "فعالیت بحرانی بلندتر از ۱۰ روز پیدا نشد؛ تغییری اعمال نشد." : "Nothing to level."),
      );
    }, 700);
  };

  const reset = () => {
    setRows(incoming?.length ? incoming : SAMPLE);
    setNote(rtl ? "به مقادیر اولیه بازگشت." : "Reset to initial values.");
  };

  const totalEnd = rows.reduce((m, a) => Math.max(m, a.startDay + a.duration), 0);
  const criticalCount = rows.filter((a) => a.critical).length;
  const avgProgress = rows.length
    ? Math.round(rows.reduce((s, a) => s + a.progress, 0) / rows.length)
    : 0;

  /** رنگ میله: بحرانی قرمز، در جریان کهربایی، عادی سبز-آبی. */
  const barColor = (a: GanttActivity) =>
    a.critical
      ? "linear-gradient(90deg,#FB7185 0%,#E11D48 100%)"
      : a.progress > 0
        ? "linear-gradient(90deg,#FBBF24 0%,#F59E0B 100%)"
        : "linear-gradient(90deg,#60A5FA 0%,#3B82F6 100%)";

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="fade-rise flex min-h-0 flex-col gap-3 lg:flex-row">
      {/* ══════════ ستون تعدیل ══════════ */}
      <div className="glass-dark flex w-full flex-col rounded-2xl p-3 lg:w-[276px]">
        <div className="mb-2.5 flex items-center justify-between border-b b-line-soft pb-2">
          <span className="text-[11.5px] font-normal tx1">{rtl ? "تعدیل دستی و تراز هوشمند" : "Manual & AI Adjustments"}</span>
          <button
            onClick={balance}
            disabled={busy}
            className="rounded-lg border border-emerald-400 bg-emerald-400/10 px-2 py-1 text-[10.5px] font-medium text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-40"
          >
            {busy ? "…" : (rtl ? "تراز هوشمند AI" : "AI Level")}
          </button>
        </div>

        <div className="thin-scroll flex-1 space-y-2 overflow-y-auto pe-1" style={{ maxHeight: 360 }}>
          {rows.map((act) => {
            const lit = hover === act.id;
            return (
              <div
                key={act.id}
                onMouseEnter={() => setHover(act.id)}
                onMouseLeave={() => setHover(null)}
                className="space-y-1.5 rounded-xl border p-2 transition"
                style={{
                  borderColor: lit ? "var(--accent)" : "var(--line)",
                  background: lit ? "var(--row-hover)" : "rgba(0,0,0,.10)",
                }}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-[11px] font-normal tx1">{rtl ? act.nameFa : (act.nameEn ?? act.nameFa)}</span>
                  {act.critical && (
                    <span className="shrink-0 rounded bg-rose-500/20 px-1 text-[8.5px] text-rose-400">
                      {rtl ? "بحرانی" : "Critical"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[9.5px] font-extralight tx3">{rtl ? "مدت:" : "Dur:"}</span>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={act.duration}
                    onChange={(e) => setDuration(act.id, parseInt(e.target.value, 10))}
                    className="h-1 flex-1 cursor-ew-resize rounded-lg bg-[var(--ring-track)] accent-[var(--accent)]"
                  />
                  <span className="w-9 text-end text-[10.5px] font-normal tabular-nums tx2">
                    {act.duration} {rtl ? "روز" : "d"}
                  </span>
                </div>

                {/* نوار پیشرفت کوچک: عدد تنها حس پیشرفت نمی‌دهد. */}
                <div className="flex items-center gap-1.5">
                  <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${act.progress}%`, background: act.progress >= 100 ? "#6EE7B7" : "var(--accent)" }}
                    />
                  </div>
                  <span className="w-7 text-end text-[9px] tabular-nums tx4">{act.progress}%</span>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={reset} className="mt-2 rounded-lg border b-line-soft px-2 py-1 text-[10px] tx3 transition hover:tx1">
          ↶ {rtl ? "بازگشت به مقادیر اولیه" : "Reset"}
        </button>
      </div>

      {/* ══════════ نمودار ══════════ */}
      <div className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-4">
        {/* ── سربرگ با شاخص‌ها ── */}
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b b-line-soft pb-2.5">
          <span className="text-[12px] font-normal tx1">{rtl ? "نمودار گانت زمان‌بندی تعاملی" : "Live Interactive Gantt"}</span>
          {isSample && (
            <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-300">
              {rtl ? "دادهٔ نمونه" : "sample"}
            </span>
          )}

          <button
            onClick={() => setOnlyCritical((v) => !v)}
            className={`rounded-lg px-2 py-0.5 text-[9.5px] transition ${onlyCritical ? "toggle-on tx1" : "border b-line-soft tx3 hover:tx1"}`}
          >
            {rtl ? "فقط مسیر بحرانی" : "Critical only"}
          </button>

          <div className="ms-auto flex items-center gap-3 text-[9.5px]" dir="ltr">
            <span className="tx4">{rows.length} {rtl ? "فعالیت" : "act"}</span>
            <span className="text-rose-300">{criticalCount} {rtl ? "بحرانی" : "crit"}</span>
            <span className="ok-t">{avgProgress}%</span>
            <span className="tx4">{totalEnd} {rtl ? "روز" : "d"}</span>
          </div>
        </div>

        <div className="thin-scroll flex-1 overflow-auto">
          <div className="relative min-w-[620px]">
            {/* ── سربرگ ستون‌ها ── */}
            <div className="sticky top-0 z-10 flex border-b b-line pb-1.5 text-[9.5px] font-extralight tx3" style={{ background: "var(--bg-c)" }}>
              <div className="w-[186px] shrink-0 ps-1">{rtl ? "نام فعالیت" : "Activity"}</div>
              <div className="grid flex-1 gap-0 text-center" style={{ gridTemplateColumns: `repeat(${buckets}, minmax(0,1fr))` }}>
                {Array.from({ length: buckets }, (_, i) => (
                  <div key={i} className="border-s b-line-soft">{rtl ? `دهه ${i + 1}` : `${i * 10 + 1}-${(i + 1) * 10}`}</div>
                ))}
              </div>
              <div className="w-[92px] shrink-0 text-center">{rtl ? "شروع/پایان" : "Start/End"}</div>
            </div>

            {/* ── ردیف‌ها ── */}
            <div className="relative">
              {/* خطوط شبکهٔ عمودی — چشم بدون آن‌ها نمی‌تواند میله را به
                * ستون زمانی وصل کند. */}
              <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
                <div className="w-[186px] shrink-0" />
                <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${buckets}, minmax(0,1fr))` }}>
                  {Array.from({ length: buckets }, (_, i) => (
                    <div key={i} className="border-s b-line-soft" />
                  ))}
                </div>
                <div className="w-[92px] shrink-0" />
              </div>

              {/* خط امروز */}
              <div className="pointer-events-none absolute inset-y-0 flex" aria-hidden>
                <div className="w-[186px] shrink-0" />
                <div className="relative flex-1">
                  <div
                    className="absolute inset-y-0 w-px"
                    style={{ left: `${(todayDay / horizon) * 100}%`, background: "rgba(251,191,36,.55)" }}
                  >
                    <span className="absolute -top-0.5 -translate-x-1/2 rounded bg-amber-400/20 px-1 text-[8px] text-amber-200">
                      {rtl ? "امروز" : "today"}
                    </span>
                  </div>
                </div>
                <div className="w-[92px] shrink-0" />
              </div>

              {visible.map((act) => {
                const startPct = Math.min(96, (act.startDay / horizon) * 100);
                const durPct = Math.max(1.5, Math.min(100 - startPct, (act.duration / horizon) * 100));
                const lit = hover === act.id;
                return (
                  <div
                    key={act.id}
                    onMouseEnter={() => setHover(act.id)}
                    onMouseLeave={() => setHover(null)}
                    className="relative flex items-center rounded py-[3px] text-[11px] transition"
                    style={{ background: lit ? "var(--row-hover)" : undefined }}
                  >
                    <div className="flex w-[186px] shrink-0 items-center gap-1 truncate pe-2 ps-1 font-light tx1">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: act.critical ? "#FB7185" : act.progress > 0 ? "#FBBF24" : "#60A5FA" }}
                      />
                      <span className="truncate" title={rtl ? act.nameFa : (act.nameEn ?? act.nameFa)}>
                        {rtl ? act.nameFa : (act.nameEn ?? act.nameFa)}
                      </span>
                    </div>

                    <div className="relative h-[22px] flex-1">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-md shadow-sm transition-all duration-300"
                        style={{
                          /* همیشه از چپ. در RTL اگر از right استفاده شود
                           * محور زمان وارونه می‌شود. */
                          left: `${startPct}%`,
                          width: `${durPct}%`,
                          height: lit ? 18 : 15,
                          background: barColor(act),
                          boxShadow: lit ? "0 0 0 1px var(--accent)" : undefined,
                        }}
                      >
                        {/* بخش پیشرفت — تیره‌تر، روی خود میله. */}
                        <div
                          className="absolute inset-y-0 start-0 bg-black/25"
                          style={{ width: `${100 - act.progress}%`, insetInlineStart: "auto", insetInlineEnd: 0 }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center truncate px-1 text-[9px] font-medium text-white/95">
                          {act.duration}{rtl ? "ر" : "d"} · {act.progress}%
                        </span>
                      </div>
                    </div>

                    {/* شروع و پایان — از جدول حذف‌شده به اینجا آمد. */}
                    <div className="w-[92px] shrink-0 text-center text-[9px] tabular-nums tx4" dir="ltr">
                      {act.startDay} → {act.startDay + act.duration}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── راهنما و پیام ── */}
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t b-line-soft pt-2 text-[9px] tx4">
          <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: "linear-gradient(90deg,#FB7185,#E11D48)" }} /> {rtl ? "بحرانی" : "critical"}</span>
          <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: "linear-gradient(90deg,#FBBF24,#F59E0B)" }} /> {rtl ? "در جریان" : "in progress"}</span>
          <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: "linear-gradient(90deg,#60A5FA,#3B82F6)" }} /> {rtl ? "شروع‌نشده" : "not started"}</span>
          <span className="flex items-center gap-1"><i className="h-3 w-px" style={{ background: "rgba(251,191,36,.8)" }} /> {rtl ? "امروز" : "today"}</span>
          {note && <span className="ms-auto ok-t">✓ {note}</span>}
        </div>
      </div>
    </div>
  );
}
