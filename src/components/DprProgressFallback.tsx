/** نمای پیش‌فرض تب «گزارش روزانه» بیرون از دامنهٔ dprt-v1.
 *
 * فرمت گزارش روزانه فقط در پروژه‌های راهسازی خوشهٔ زیرساخت و ساختمان فعال
 * است (`isDprFormatActive`)؛ در بقیهٔ دامنه‌ها این نمای «ثبت پیشرفت واقعی»
 * نمایش داده می‌شود تا تب خالی نماند. محتوا عین نمای قبلی همین تب است.
 */
import { useState } from "react";
import type { Lang } from "../data/framework";
import type { buildPexModel } from "../services/pexModel";
import { canPostProgress } from "../services/planning";

type PexModel = ReturnType<typeof buildPexModel>;

export default function DprProgressFallback({ lang, model: m }: { lang: Lang; model: PexModel }) {
  const rtl = lang === "fa";
  const [dprDate, setDprDate] = useState("2026-09-04");
  const postGate = canPostProgress(m.openPeriod, dprDate);

  return (
    <div className="fade-rise space-y-2">
      <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-3 text-[11px]">
        <span className="tx3">{rtl ? "تاریخ گزارش" : "Report date"}</span>
        <input
          value={dprDate}
          onChange={(e) => setDprDate(e.target.value)}
          className="rounded border b-line-soft bg-black/20 px-2 py-1 tx1"
          dir="ltr"
        />
        <span className="tx3">{rtl ? "دوره باز" : "Open period"}</span>
        <span className="rounded border b-line-soft px-2 py-1 tx1" dir="ltr">{m.openPeriod.code} · {m.openPeriod.from} → {m.openPeriod.to}</span>
        <span
          className="ms-auto rounded-lg px-2 py-1 text-[10px]"
          style={{ background: postGate.ok ? "#8FE3C822" : "#FF9F9F22", color: postGate.ok ? "#8FE3C8" : "#FF9F9F" }}
        >
          {postGate.ok
            ? rtl ? "ثبت پیشرفت مجاز" : "posting allowed"
            : postGate.reason === "period_closed"
              ? rtl ? "دوره بسته است" : "period closed"
              : rtl ? "خارج از دوره" : "out of period"}
        </span>
      </div>

      <div className="glass-dark overflow-x-auto rounded-2xl p-3">
        <div className="mb-2 text-[11.5px] tx1">{rtl ? "خطوط پیشرفت گام‌های RoC" : "RoC step progress lines"}</div>
        <table className="w-full min-w-[640px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b b-line-soft text-[10px] tx3">
              <th className="px-2 py-1.5 text-start">{rtl ? "فعالیت" : "Activity"}</th>
              <th className="px-2 py-1.5 text-start">RoC</th>
              <th className="px-2 py-1.5 text-center">{rtl ? "درصد فیزیکی" : "Physical %"}</th>
              <th className="px-2 py-1.5 text-start">{rtl ? "گام مسدود (بدون IR)" : "Blocked (no IR)"}</th>
            </tr>
          </thead>
          <tbody className="divide-y b-line-soft">
            {m.rows.filter((r) => !r.isMilestone).map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{r.id}</td>
                <td className="px-2 py-1.5 tx3" dir="ltr">{r.roc}</td>
                <td className="px-2 py-1.5 text-center tabular-nums tx1">{r.physicalPct}%</td>
                <td className="px-2 py-1.5 text-[10px]" style={{ color: r.blockedSteps.length ? "#FF9F9F" : undefined }}>
                  {r.blockedSteps.length ? r.blockedSteps.join(" · ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[9.5px] tx4">
          {rtl
            ? "گام دارای الزام بازرسی بدون IR تأییدشده وارد پیشرفت و EV نمی‌شود؛ فقط پیشرفت Approved محاسبه می‌گردد."
            : "Steps requiring inspection without an approved IR are excluded from progress and EV."}
        </p>
        <p className="mt-1 text-[9px] tx4">
          {rtl
            ? "فرمت گزارش روزانه (dprt-v1) فقط در پروژه‌های راهسازی خوشهٔ زیرساخت و ساختمان فعال است."
            : "The daily report format (dprt-v1) is only active in road projects of the Infrastructure cluster."}
        </p>
      </div>
    </div>
  );
}
