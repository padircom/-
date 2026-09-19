import { useMemo } from "react";
import { t, type Lang } from "../data/framework";
import {
  BOQ_SEED,
  MATERIAL_SEED,
  materialLines,
  materialTotals,
  quantityLines,
  quantityTotals,
} from "../services/quantities";

/* ══════════════════════════════════════════════════════════════════════
   دو تبِ تازهٔ میز کارِ مالی (d5):
     «quantities» → مدیریت احجام و مقادیر فیزیکی  (d5-p7)
     «balance»    → بالانس مصالح و کنترل ضایعات   (d5-p8)

   هیچ عددی در این فایل hard-code نشده؛ همه از موتور `quantities.ts`
   می‌آید و با تغییر دادهٔ نمونه یا اتصال SQL به‌روز می‌شود.
   ══════════════════════════════════════════════════════════════════════ */

type Mode = "quantities" | "balance";

const num = (n: number, lang: Lang) =>
  Math.round(n).toLocaleString(lang === "fa" ? "fa-IR" : "en-US");
const pct = (n: number, lang: Lang) =>
  `${(n * 100).toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}%`;
const money = (n: number, lang: Lang) =>
  `${(n / 1_000_000_000).toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 2 })}${lang === "fa" ? " میلیارد ریال" : "B IRR"}`;

const statusColor: Record<string, string> = {
  ahead: "#34D399",
  on: "#7FB2FF",
  behind: "#F87171",
  over: "#F87171",
  under: "#FBBF24",
  ok: "#34D399",
  na: "#94A3B8",
};

function Card({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
      <div className="text-[8.5px] font-extralight tx4">{label}</div>
      <div className="mt-1 text-[13px] font-light tx1" style={{ color }}>{value}</div>
      {hint && <div className="mt-0.5 text-[9px] font-extralight tx3">{hint}</div>}
    </div>
  );
}

export default function QuantityBalancePanel({ lang, mode }: { lang: Lang; mode: Mode }) {
  const rtl = lang === "fa";

  const qLines = useMemo(() => quantityLines(BOQ_SEED), []);
  const qTotals = useMemo(() => quantityTotals(qLines), [qLines]);
  const mLines = useMemo(() => materialLines(MATERIAL_SEED), []);
  const mTotals = useMemo(() => materialTotals(mLines), [mLines]);

  /* ───── نمای احجام ───── */
  if (mode === "quantities") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Card
            label={rtl ? "پیشرفت فیزیکی وزنی" : "Weighted physical progress"}
            value={pct(qTotals.physicalProgress, lang)}
            hint={rtl ? "ارزش برداشت‌شده ÷ ارزش کل فهرست بها" : "Earned value ÷ total BOQ value"}
            color="#7FB2FF"
          />
          <Card
            label={rtl ? "ارزش برداشت‌شده" : "Earned quantity value"}
            value={money(qTotals.earnedValue, lang)}
            hint={rtl ? `از ${money(qTotals.plannedValue, lang)} کل` : `of ${money(qTotals.plannedValue, lang)} total`}
          />
          <Card
            label={rtl ? "ردیف‌های عقب‌تر از برنامه" : "Rows behind plan"}
            value={num(qTotals.behindCount, lang)}
            hint={rtl ? `از ${num(qTotals.rowCount, lang)} ردیفِ فعال` : `of ${num(qTotals.rowCount, lang)} active rows`}
            color={qTotals.behindCount > 0 ? "#F87171" : "#34D399"}
          />
          <Card
            label={rtl ? "ردیف‌های جلوتر از برنامه" : "Rows ahead of plan"}
            value={num(qTotals.aheadCount, lang)}
            hint={rtl ? "انحرافِ مثبتِ بیش از ۵٪" : "positive variance above 5%"}
            color="#34D399"
          />
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-[var(--panel2)]">
              <tr className="tx4">
                <th className="px-2 py-2 text-start font-light">{rtl ? "ردیف / WBS" : "Item / WBS"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "برنامه کل" : "Planned"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "تا امروز" : "To date"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "برداشت‌شده" : "Measured"}</th>
                <th className="px-2 py-2 text-end font-light">{rtl ? "انحراف" : "Variance"}</th>
                <th className="px-2 py-2 text-start font-light" style={{ minWidth: 120 }}>{rtl ? "پیشرفت فیزیکی" : "Physical"}</th>
              </tr>
            </thead>
            <tbody>
              {qLines.map((l) => (
                <tr key={l.id} className="border-t border-[var(--line-soft)]">
                  <td className="px-2 py-1.5">
                    <div className="tx1">{t(l.item, lang)}</div>
                    <div className="tx4" dir="ltr">{l.wbs} · {t(l.unit, lang)}</div>
                  </td>
                  <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.plannedQty, lang)}</td>
                  <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.plannedToDate, lang)}</td>
                  <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(l.measuredQty, lang)}</td>
                  <td className="px-2 py-1.5 text-end" dir="ltr" style={{ color: statusColor[l.status] }}>
                    {l.variance > 0 ? "+" : ""}{num(l.variance, lang)} ({pct(l.variancePct, lang)})
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--row-hover)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, l.physicalProgress * 100))}%`, background: statusColor[l.status] }}
                        />
                      </div>
                      <span className="tabular-nums tx3" dir="ltr">{pct(l.physicalProgress, lang)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[9px] font-extralight tx4">
          {rtl
            ? "محاسبهٔ محلی روی ظرف داده؛ پس از اتصال SQL، منابع Boq_Item و Boq_Measurement جایگزین می‌شوند."
            : "Local computation on a data vessel; after SQL wiring, Boq_Item and Boq_Measurement become the source."}
        </p>
      </div>
    );
  }

  /* ───── نمای بالانس مصالح ───── */
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Card
          label={rtl ? "مصرف کلِ دوره" : "Total issues"}
          value={num(mTotals.issues, lang)}
          hint={rtl ? "جمع خروج از انبار" : "sum of warehouse issues"}
        />
        <Card
          label={rtl ? "مصرف مجاز (نُرم)" : "Norm-based allowance"}
          value={num(mTotals.normQty, lang)}
          hint={rtl ? "نُرم × تولیدِ دوره" : "norm × period production"}
        />
        <Card
          label={rtl ? "انحراف مصرف" : "Consumption variance"}
          value={num(mTotals.variance, lang)}
          hint={rtl ? "مصرف واقعی − مصرف مجاز" : "actual − allowance"}
          color={mTotals.variance > 0 ? "#F87171" : "#34D399"}
        />
        <Card
          label={rtl ? "ردیف‌های پرمصرف" : "Over-consumption rows"}
          value={num(mTotals.overCount, lang)}
          hint={rtl ? `از ${num(mTotals.rowCount, lang)} قلمِ کالا` : `of ${num(mTotals.rowCount, lang)} items`}
          color={mTotals.overCount > 0 ? "#F87171" : "#34D399"}
        />
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 bg-[var(--panel2)]">
            <tr className="tx4">
              <th className="px-2 py-2 text-start font-light">{rtl ? "قلم کالا" : "Material"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "ابتدا" : "Opening"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "دریافت" : "Receipts"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "مصرف" : "Issues"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "برگشتی" : "Returns"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "مانده" : "Closing"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "انحراف از نُرم" : "Vs norm"}</th>
            </tr>
          </thead>
          <tbody>
            {mLines.map((l) => (
              <tr key={l.id} className="border-t border-[var(--line-soft)]">
                <td className="px-2 py-1.5">
                  <div className="tx1">{t(l.material, lang)}</div>
                  <div className="tx4">{t(l.unit, lang)}</div>
                </td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.opening, lang)}</td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.receipts, lang)}</td>
                <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(l.issues, lang)}</td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(l.returns, lang)}</td>
                <td className="px-2 py-1.5 text-end tx1" dir="ltr">{num(l.closing, lang)}</td>
                <td className="px-2 py-1.5 text-end" dir="ltr" style={{ color: statusColor[l.status] }}>
                  {l.variance === null
                    ? (rtl ? "نُرم ندارد" : "no norm")
                    : `${l.variance > 0 ? "+" : ""}${num(l.variance, lang)} (${pct(l.variancePct ?? 0, lang)})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] font-extralight tx4">
        {rtl
          ? "تراز مقداری: مانده = ابتدای دوره + دریافت − مصرف + برگشتی. انحراف = مصرف واقعی − (نُرم × تولید)."
          : "Balance: closing = opening + receipts − issues + returns. Variance = actual − (norm × production)."}
      </p>
    </div>
  );
}
