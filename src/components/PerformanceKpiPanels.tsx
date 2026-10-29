import { type Lang } from "../data/framework";
import { earnedProgress, indexTone, varianceRows, varianceTone, type EvmPointLike, type IndexTone } from "../services/performanceKpi";
import { jalaliLabel } from "./ControlCharts";

/* بخش‌های واقعیِ تب‌های «شاخص‌ها» و «انحراف» در d3. همه از تصاویر EVM ثبت‌شده می‌آیند. */

type Fmt = (n: number | null | undefined) => string;
const COLOR: Record<IndexTone, string | undefined> = { ok: "#34D399", alert: "#F87171", unknown: undefined };

export function KpiIndicators({ p, lang, fmt }: { p: EvmPointLike | null; lang: Lang; fmt: Fmt }) {
  const fa = lang === "fa";
  const text = (a: string, b: string) => (fa ? a : b);
  const progress = earnedProgress(p?.ev, p?.bac);
  const cards: { label: string; value: string; tone: IndexTone; hint: string }[] = [
    { label: "SPI", value: fmt(p?.spi), tone: indexTone("spi", p?.spi), hint: text("EV ÷ PV · هشدار زیر ۰٫۹۵", "EV ÷ PV · alert below 0.95") },
    { label: "CPI", value: fmt(p?.cpi), tone: indexTone("cpi", p?.cpi), hint: text("EV ÷ AC · هشدار زیر ۱", "EV ÷ AC · alert below 1") },
    { label: "SV", value: fmt(p?.sv), tone: varianceTone(p?.sv), hint: text("EV − PV · منفی = عقب از برنامه", "EV − PV · negative = behind plan") },
    { label: "CV", value: fmt(p?.cv), tone: varianceTone(p?.cv), hint: text("EV − AC · منفی = بیش از بودجه", "EV − AC · negative = over budget") },
    {
      label: text("پیشرفت کسب‌شده", "Earned progress"),
      value: progress === null ? "—" : `${(progress * 100).toLocaleString(fa ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}%`,
      tone: "unknown",
      hint: text("EV ÷ BAC", "EV ÷ BAC"),
    },
  ];
  return (
    <section className="glass-dark space-y-2 rounded-xl p-3">
      <h4 className="text-sm tx1">{text("شاخص‌های عملکرد (از تصویر EVM انتخاب‌شده)", "Performance indices (selected EVM snapshot)")}</h4>
      {!p || p.spi === null ? (
        <p className="text-xs tx3">
          {text("تصویر EVM سازگار و دارای ورودی ثبت نشده است؛ شاخصی نمایش داده نمی‌شود، نه صفر.", "No consistent EVM snapshot with inputs is stored; no index is shown (not zero).")}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border b-line-soft p-3">
            <div className="text-xs tx3">{c.label}</div>
            <div className="text-xl tabular-nums" dir="ltr" style={{ color: COLOR[c.tone] }}>{c.value}</div>
            <div className="mt-1 text-[10px] tx4">{c.hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function VarianceHistory({ history, lang, fmt }: { history: EvmPointLike[]; lang: Lang; fmt: Fmt }) {
  const fa = lang === "fa";
  const text = (a: string, b: string) => (fa ? a : b);
  const rows = varianceRows(history);
  return (
    <section className="glass-dark space-y-2 rounded-xl p-3">
      <h4 className="text-sm tx1">{text("روند انحراف برنامه و هزینه (تصاویر EVM ثبت‌شده)", "Schedule / cost variance trend (stored EVM snapshots)")}</h4>
      {rows.length === 0 ? (
        <p className="text-xs tx3">{text("هیچ تصویر EVM ثبت‌شده‌ای نیست.", "No stored EVM snapshots.")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs tx2">
            <thead>
              <tr className="tx3">
                {[text("تاریخ داده", "Data date"), "PV", "EV", "AC", "SV", "CV", "SPI", "CPI"].map((h) => (
                  <th key={h} className="p-2 text-start font-light">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t b-line-soft">
                  <td className="p-2">
                    {jalaliLabel(r.dataDate, lang)}
                    {r.integrity !== "verified" && (
                      <span className="ms-1 text-amber-300" title={text("تصویر فاقد مهر سازگاری؛ شاخص‌ها محاسبه نشده‌اند", "Snapshot lacks integrity stamp; indices not computed")}>⚠</span>
                    )}
                  </td>
                  <td className="p-2 tabular-nums" dir="ltr">{fmt(r.pv)}</td>
                  <td className="p-2 tabular-nums" dir="ltr">{fmt(r.ev)}</td>
                  <td className="p-2 tabular-nums" dir="ltr">{fmt(r.ac)}</td>
                  <td className="p-2 tabular-nums" dir="ltr" style={{ color: COLOR[varianceTone(r.sv)] }}>{fmt(r.sv)}</td>
                  <td className="p-2 tabular-nums" dir="ltr" style={{ color: COLOR[varianceTone(r.cv)] }}>{fmt(r.cv)}</td>
                  <td className="p-2 tabular-nums" dir="ltr" style={{ color: COLOR[indexTone("spi", r.spi)] }}>{fmt(r.spi)}</td>
                  <td className="p-2 tabular-nums" dir="ltr" style={{ color: COLOR[indexTone("cpi", r.cpi)] }}>{fmt(r.cpi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] tx4">
        {text("منبع: EvmSnapshot. تحلیل ریشه‌ای در این نسخه پیاده‌سازی نشده است.", "Source: EvmSnapshot. Root-cause analysis is not implemented in this release.")}
      </p>
    </section>
  );
}
