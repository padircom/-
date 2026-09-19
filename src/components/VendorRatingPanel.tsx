import { useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import {
  PARTY_SEED,
  RATING_AXES,
  type AxisCode,
  portfolioSummary,
  rateAll,
} from "../services/vendorRating";

/* ══════════════════════════════════════════════════════════════════════
   «ارزیابی پیمانکاران و تأمین‌کنندگان» — d14-p8
   امتیازِ وزنی روی شش محور + رتبه + روند + ضعیف‌ترین محور (هدفِ بهبود).
   ══════════════════════════════════════════════════════════════════════ */

const gradeColor: Record<string, string> = { A: "#34D399", B: "#7FB2FF", C: "#FBBF24", D: "#F87171" };
const B = 1_000_000_000;

export default function VendorRatingPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const [kind, setKind] = useState<"all" | "contractor" | "supplier">("all");

  const results = useMemo(() => rateAll(PARTY_SEED), []);
  const sum = useMemo(() => portfolioSummary(results), [results]);
  const rows = results.filter((r) => kind === "all" || r.kind === kind);

  const num = (n: number) => Math.round(n).toLocaleString(rtl ? "fa-IR" : "en-US");
  const money = (n: number) =>
    `${(n / B).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })} ${rtl ? "میلیارد ریال" : "B IRR"}`;
  const axisLabel = (code: AxisCode) => {
    const a = RATING_AXES.find((x) => x.code === code)!;
    return rtl ? a.label.fa : a.label.en;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Cell label={rtl ? "میانگین امتیاز" : "Average score"} value={num(sum.average)} hint={rtl ? `${num(sum.count)} طرفِ فعال` : `${num(sum.count)} active parties`} />
        <Cell label={rtl ? "در فهرست پایش (C/D)" : "Watchlist (C/D)"} value={num(sum.watchlist)} tone={sum.watchlist > 0 ? "#FBBF24" : "#34D399"} hint={rtl ? "نیازمند برنامهٔ بهبود" : "needs improvement plan"} />
        <Cell label={rtl ? "ارزشِ در معرضِ ریسک" : "Value at risk"} value={money(sum.valueAtRisk)} tone={sum.valueAtRisk > 0 ? "#F87171" : "#34D399"} hint={rtl ? "قراردادهایِ رتبهٔ C و D" : "contracts graded C and D"} />
        <Cell
          label={rtl ? "توزیع رتبه" : "Grade mix"}
          value={`A:${sum.gradeCounts.A} B:${sum.gradeCounts.B} C:${sum.gradeCounts.C} D:${sum.gradeCounts.D}`}
          hint={rtl ? "وزن‌ها: ایمنی/کیفیت/زمان ۲۰ · قیمت/مستندات ۱۵ · همکاری ۱۰" : "weights: HSE/quality/time 20 · price/docs 15 · coop 10"}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {(["all", "contractor", "supplier"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-light transition ${
              kind === k ? "toggle-on tx1" : "tx3 hover:tx2"
            }`}
          >
            {k === "all" ? (rtl ? "همه" : "All") : k === "contractor" ? (rtl ? "پیمانکاران" : "Contractors") : (rtl ? "تأمین‌کنندگان" : "Suppliers")}
          </button>
        ))}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 bg-[var(--panel2)]">
            <tr className="tx4">
              <th className="px-2 py-2 text-start font-light">{rtl ? "طرف قرارداد" : "Party"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "امتیاز" : "Score"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "رتبه" : "Grade"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "روند" : "Trend"}</th>
              <th className="px-2 py-2 text-start font-light">{rtl ? "ضعیف‌ترین محور" : "Weakest axis"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "ارزش قرارداد" : "Contract value"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--line-soft)]">
                <td className="px-2 py-1.5">
                  <div className="tx1">{rtl ? r.name.fa : r.name.en}</div>
                  <div className="tx4">{r.kind === "contractor" ? (rtl ? "پیمانکار" : "Contractor") : (rtl ? "تأمین‌کننده" : "Supplier")}{!r.active && (rtl ? " · غیرفعال" : " · inactive")}</div>
                </td>
                <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(r.weighted)}</td>
                <td className="px-2 py-1.5 text-end" style={{ color: gradeColor[r.grade] }}>{r.grade}</td>
                <td className="px-2 py-1.5 text-end" dir="ltr" style={{ color: r.trend === null ? undefined : r.trend < 0 ? "#F87171" : "#34D399" }}>
                  {r.trend === null ? "—" : `${r.trend > 0 ? "+" : ""}${num(r.trend)}`}
                </td>
                <td className="px-2 py-1.5 tx3">{axisLabel(r.weakest)}</td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">{money(r.contractValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] font-extralight tx4">
        {rtl
          ? "امتیاز = میانگینِ وزنیِ شش محور (۰ تا ۱۰۰). رتبه: A ≥ ۸۵، B ≥ ۷۰، C ≥ ۵۵، D کمتر. ضعیف‌ترین محور مبنای برنامهٔ بهبود است."
          : "Score = weighted mean of six axes (0–100). Grades: A ≥ 85, B ≥ 70, C ≥ 55, D below. The weakest axis drives the improvement plan."}
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
