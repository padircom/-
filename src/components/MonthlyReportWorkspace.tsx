/**
 * گزارش ماهانه (MPR) — فضای کاری شیت‌محور، هم‌الگو با گزارش هفتگی.
 *
 * چرا شیت‌محور و نه کارت؟ چون خروجی ماهانه سند رسمی است: A4، قاب چاپ،
 * واترمارک شمارهٔ صفحه و کنترل کامل روی اینکه چه چیزی چاپ می‌شود.
 * گزارش هفتگی همین معماری را دارد (`WeeklySheet`) و اینجا عیناً تکرار
 * شده تا دو گزارش یک زبان بصری داشته باشند.
 *
 * قاعدهٔ داده: اعداد از موتور برنامه‌ریزی می‌آیند (`PexModel`) و متنی که
 * کاربر تایپ می‌کند (شمارهٔ گزارش، عنوان پروژه) در localStorage می‌ماند.
 * هیچ عددی اینجا synthesize نمی‌شود؛ اگر موتور داده‌ای نداده باشد، «—»
 * نشان داده می‌شود.
 */

import { useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { buildPexModel, type PexModel } from "../services/pexModel";
import PeriodicReportWorkspace from "./PeriodicReportWorkspace";

export type MonthlyReportTab = "cover" | "summary" | "templates";

type Props = {
  lang: Lang;
  model?: PexModel;
};

type CoverFields = {
  reportNo: string;
  periodEnd: string;
  projectTitle: string;
  preparedUnit: string;
};

const DEFAULT_COVER: CoverFields = {
  reportNo: "MPR-001",
  periodEnd: "",
  projectTitle: "",
  preparedUnit: "واحد برنامه‌ریزی و کنترل پروژه",
};

const STORAGE_PREFIX = "monthly-report:";

const digits = (v: string | number, fa: boolean) =>
  String(v).replace(/\d/g, (d) => (fa ? "۰۱۲۳۴۵۶۷۸۹"[Number(d)] : d));

const num = (v: number | null | undefined, fa: boolean, fractionDigits = 1) =>
  v === null || v === undefined ? "—" : digits(v.toLocaleString("en-US", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }), fa);

/* ══════════════════════════ شیت کاور (صفحهٔ ۱) ══════════════════════════ */

function CoverSheet({
  cover, lang, model, onChange,
}: {
  cover: CoverFields;
  lang: Lang;
  model?: PexModel;
  onChange: (patch: Partial<CoverFields>) => void;
}) {
  const fa = lang === "fa";
  const period = model?.openPeriod;
  const periodEnd = cover.periodEnd || period?.to || model?.dataDate || "";

  return (
    <article
      id="monthly-report-print-root"
      aria-label={fa ? "کاور گزارش ماهانه" : "Monthly report cover"}
      className="monthly-report-sheet relative mx-auto aspect-[210/297] w-full min-w-[520px] max-w-[760px] overflow-hidden border-2 border-[#0000ff] bg-[#f3f6fa] text-[#172b3f] shadow-xl print:aspect-auto print:h-[297mm] print:w-[210mm] print:min-w-0 print:max-w-none print:shadow-none"
      dir="rtl"
    >
      {/* ─── بلوک هدر: پروژه / گزارش تحلیل پروژه ─── */}
      <div className="absolute inset-x-0 top-0 h-[11%] border border-black bg-[#c7dcf0]">
        <div className="flex h-[54%] items-stretch border-b border-black">
          <div className="w-[12%] border-e border-black" />
          <div className="flex flex-1 items-center justify-center gap-1 px-2">
            <span className="text-[clamp(9px,1.2vw,12px)]">{fa ? "پروژه:" : "Project:"}</span>
            <input
              aria-label={fa ? "نام پروژه" : "Project name"}
              value={cover.projectTitle || model?.project.code || ""}
              onChange={(e) => onChange({ projectTitle: e.target.value })}
              placeholder={model?.project.code ?? "—"}
              className="w-full max-w-[62%] border-0 bg-transparent text-center text-[clamp(10px,1.5vw,15px)] font-medium text-[#172b3f] outline-none focus:bg-white/60"
            />
          </div>
          <div className="w-[12%] border-s border-black" />
        </div>
        <div className="flex h-[46%] items-center justify-center text-[clamp(11px,1.7vw,17px)] font-semibold tracking-wide">
          {fa ? "گزارش تحلیل پروژه" : "Project Analysis Report"}
        </div>
      </div>

      {/* ─── عنوان مرکزی ─── */}
      <div className="absolute inset-x-0 top-[24%] flex flex-col items-center gap-3 px-6 text-center">
        <h1 className="text-[clamp(22px,4vw,38px)] font-extrabold tracking-[0.08em] text-[#183b5b]">
          {fa ? "گزارش پیشرفت" : "Progress Report"}
        </h1>
        <div className="flex items-center gap-2 text-[clamp(11px,1.6vw,15px)]">
          <span>{fa ? "پروژه:" : "Project:"}</span>
          <span className="min-w-[8rem] border-b border-dotted border-[#4a5b6b] px-2 pb-0.5">
            {cover.projectTitle || model?.project.code || "—"}
          </span>
        </div>
        {period && (
          <div className="text-[clamp(9px,1.2vw,12px)] tx3">
            {fa ? "دورهٔ گزارش:" : "Reporting period:"}{" "}
            <span dir="ltr" className="tabular-nums">{digits(period.code, fa)}</span>
            {" · "}
            <span dir="ltr" className="tabular-nums">{digits(period.from, fa)} → {digits(period.to, fa)}</span>
          </div>
        )}
      </div>

      {/* ─── واترمارک شمارهٔ صفحه (فقط روی صفحه، نه روی کاغذ) ─── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[46%] z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[clamp(48px,10vw,76px)] font-light leading-none text-[#777777]/60 print:hidden"
      >
        Page 1
      </div>

      {/* ─── پاصفحه: شمارهٔ گزارش و دوره (چپ) · تهیه‌کننده (راست) ─── */}
      <div className="absolute inset-x-0 bottom-[6%] flex items-start justify-between gap-4 px-[7%]">
        <div className="space-y-1 text-end text-[clamp(10px,1.4vw,13px)]">
          <div>{fa ? "تهیه شده،" : "Prepared by,"}</div>
          <input
            aria-label={fa ? "واحد تهیه‌کننده" : "Preparing unit"}
            value={cover.preparedUnit}
            onChange={(e) => onChange({ preparedUnit: e.target.value })}
            className="w-52 border-0 border-b border-dotted border-[#4a5b6b] bg-transparent px-1 py-0.5 text-center text-[#172b3f] outline-none focus:bg-white/60"
          />
        </div>
        <div className="space-y-3 text-[clamp(10px,1.4vw,13px)]">
          <div className="flex items-center gap-2">
            <span>{fa ? "شماره گزارش:" : "Report No.:"}</span>
            <input
              aria-label={fa ? "شماره گزارش" : "Report number"}
              value={cover.reportNo}
              onChange={(e) => onChange({ reportNo: e.target.value })}
              dir="ltr"
              className="w-28 border-0 border-b border-dotted border-[#4a5b6b] bg-transparent px-1 py-0.5 text-center tabular-nums text-[#172b3f] outline-none focus:bg-white/60"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>{fa ? "دوره گزارشی؛ منتهی به" : "Reporting period; ending"}</span>
            <input
              aria-label={fa ? "پایان دوره گزارشی" : "Reporting period end"}
              type="date"
              value={periodEnd}
              onChange={(e) => onChange({ periodEnd: e.target.value })}
              dir="ltr"
              className="w-32 border-0 border-b border-dotted border-[#4a5b6b] bg-transparent px-1 py-0.5 text-center tabular-nums text-[#172b3f] outline-none focus:bg-white/60"
            />
          </div>
        </div>
      </div>
    </article>
  );
}

/* ══════════════════════════ شیت خلاصهٔ ماهانه (صفحهٔ ۲) ══════════════════════════ */

function SummarySheet({
  cover, lang, model,
}: {
  cover: CoverFields;
  lang: Lang;
  model?: PexModel;
}) {
  const fa = lang === "fa";
  const rows: { label: string; value: string; note?: string }[] = model
    ? [
        {
          label: fa ? "پیشرفت واقعی (وزنی)" : "Actual progress (weighted)",
          value: `${num(model.overallPct, fa)}%`,
          note: fa ? "تا Data Date" : "to data date",
        },
        {
          label: fa ? "پیشرفت برنامه‌ای" : "Planned progress",
          value: `${num(model.plannedPct, fa)}%`,
          note: fa ? "از منحنی برنامه پایه" : "from baseline curve",
        },
        {
          label: fa ? "انحراف پیشرفت" : "Progress variance",
          value: `${model.variance.deltaPct > 0 ? "+" : ""}${num(model.variance.deltaPct, fa)}`,
          note: model.variance.status === "behind" ? (fa ? "عقب‌افتاده" : "behind") : fa ? "روی برنامه" : "on plan",
        },
        {
          label: fa ? "مایلستون‌های در تأخیر" : "Delayed milestones",
          value: digits(model.milestones.filter((x) => x.status === "Delayed").length, fa),
          note: fa ? `از ${digits(model.milestones.length, fa)} مایلستون` : `of ${digits(model.milestones.length, fa)} milestones`,
        },
        {
          label: fa ? "جریمه انباشته" : "Accrued penalty",
          value: `${num(Math.round(model.totalPenalty), fa, 0)} ${model.project.currency}`,
          note: fa ? "پاداش‌ها خالص شده" : "bonuses netted",
        },
        {
          label: fa ? "رانش مسیر بحرانی" : "Critical-path drift",
          value: `${model.snapshot.drift > 0 ? "+" : ""}${digits(model.snapshot.drift, fa)} ${fa ? "روز" : "d"}`,
          note: fa ? "نسبت به برنامه پایه" : "vs baseline",
        },
        {
          label: fa ? "سلامت زمان‌بندی (DCMA)" : "Schedule health (DCMA)",
          value: digits(model.dcma.healthScore, fa),
          note: model.dcma.healthScore < 80 ? (fa ? "زیر ۸۰ — بازبینی" : "below 80 — review") : undefined,
        },
        {
          label: fa ? "دوره‌های بسته‌شده" : "Closed periods",
          value: model.periods.filter((p) => p.closedAt).map((p) => p.code).join("، ") || "—",
        },
        {
          label: fa ? "گام‌های مسدود بابت IR" : "Steps blocked by IR",
          value: digits(model.blockedCount, fa),
          note: fa ? "پیشرفت آن‌ها وارد EV نمی‌شود" : "excluded from EV",
        },
      ]
    : [];

  return (
    <article
      id="monthly-report-print-root"
      aria-label={fa ? "خلاصهٔ گزارش ماهانه" : "Monthly report summary"}
      className="monthly-report-sheet relative mx-auto aspect-[210/297] w-full min-w-[520px] max-w-[760px] overflow-hidden border-2 border-[#0000ff] bg-[#f3f6fa] text-[#172b3f] shadow-xl print:aspect-auto print:h-[297mm] print:w-[210mm] print:min-w-0 print:max-w-none print:shadow-none"
      dir="rtl"
    >
      <div className="absolute inset-x-0 top-0 h-[10%] border border-black bg-[#c7dcf0]">
        <div className="flex h-full items-center justify-center text-[clamp(12px,1.9vw,18px)] font-semibold">
          {fa ? "خلاصهٔ ماهانه" : "Monthly Summary"}
        </div>
      </div>

      <div className="absolute inset-x-0 top-[12%] bottom-[10%] overflow-y-auto px-[8%] py-3">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[clamp(10px,1.4vw,13px)]">
          <span className="font-semibold">{fa ? "شمارهٔ گزارش:" : "Report No.:"}</span>
          <span dir="ltr" className="tabular-nums">{cover.reportNo || "—"}</span>
          <span className="tx3">·</span>
          <span className="font-semibold">{fa ? "پایان دوره:" : "Period end:"}</span>
          <span dir="ltr" className="tabular-nums">{cover.periodEnd || model?.openPeriod?.to || "—"}</span>
        </div>

        {!model ? (
          <p className="py-8 text-center text-[11px] tx4">
            {fa ? "دادهٔ موتور برنامه‌ریزی در دسترس نیست؛ عددی نمایش داده نمی‌شود." : "Planning engine data is unavailable; no figure is shown."}
          </p>
        ) : (
          <table className="w-full border-collapse text-[clamp(9px,1.25vw,12px)]">
            <thead>
              <tr className="bg-[#91afd0]/40">
                <th className="border border-[#4a5b6b] px-2 py-1.5 text-start font-semibold">{fa ? "شاخص" : "Metric"}</th>
                <th className="border border-[#4a5b6b] px-2 py-1.5 text-center font-semibold">{fa ? "مقدار" : "Value"}</th>
                <th className="border border-[#4a5b6b] px-2 py-1.5 text-start font-semibold">{fa ? "توضیح" : "Note"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="odd:bg-white/40">
                  <td className="border border-[#4a5b6b] px-2 py-1.5">{r.label}</td>
                  <td className="border border-[#4a5b6b] px-2 py-1.5 text-center font-semibold tabular-nums" dir="ltr">
                    {r.value}
                  </td>
                  <td className="border border-[#4a5b6b] px-2 py-1.5 tx3">{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="mt-3 text-[9px] tx4">
          {fa
            ? "همهٔ مقادیر از موتور برنامه‌ریزی در Data Date خوانده شده‌اند؛ گزارش ماهانه از دادهٔ تأییدشده ساخته می‌شود و هیچ عددی دستی وارد نمی‌شود."
            : "All values come from the planning engine at the data date; the monthly report is built from approved data and no figure is hand-entered."}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[46%] z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[clamp(48px,10vw,76px)] font-light leading-none text-[#777777]/60 print:hidden"
      >
        Page 2
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[7%] border-t border-black bg-[#c7dcf0]">
        <div className="flex h-full items-center justify-between px-[7%] text-[clamp(9px,1.2vw,11px)]">
          <span>{fa ? "واحد برنامه‌ریزی و کنترل پروژه" : "Planning & Project Control Unit"}</span>
          <span dir="ltr" className="tabular-nums">{cover.reportNo || "—"}</span>
        </div>
      </div>
    </article>
  );
}

/* ══════════════════════════ پوستهٔ فضای کاری ══════════════════════════ */

export default function MonthlyReportWorkspace({ lang, model }: Props) {
  const fa = lang === "fa";

  /* بدون prop هم کار می‌کند (گرهٔ نقشهٔ قابلیت‌ها): همان پیش‌فرض موتور. */
  const m = useMemo(() => model ?? buildPexModel("Cost", 0.6), [model]);
  const period = m?.openPeriod;

  const storageKey = `${STORAGE_PREFIX}${m?.project.code ?? "default"}`;
  const [tab, setTab] = useState<MonthlyReportTab>("cover");
  const [cover, setCover] = useState<CoverFields>(DEFAULT_COVER);
  const [saved, setSaved] = useState("");

  /* بارگذاری تنظیمات ذخیره‌شدهٔ همین پروژه. */
  useEffect(() => {
    let loaded: CoverFields = { ...DEFAULT_COVER, periodEnd: m?.openPeriod?.to ?? "" };
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) loaded = { ...loaded, ...(JSON.parse(raw) as Partial<CoverFields>) };
    } catch {
      /* دادهٔ خراب ذخیره را نادیده می‌گیریم و پیش‌فرض می‌ماند. */
    }
    setCover(loaded);
  }, [storageKey, m?.openPeriod?.to]);

  const patch = (next: Partial<CoverFields>) => setCover((c) => ({ ...c, ...next }));

  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cover));
      setSaved(fa ? "ذخیره شد" : "Saved");
    } catch {
      setSaved(fa ? "ذخیره نشد" : "Not saved");
    }
    window.setTimeout(() => setSaved(""), 2000);
  };

  return (
    <section className="space-y-3" dir={fa ? "rtl" : "ltr"}>
      <style>{`
        .monthly-report-sheet {
          font-family: "Inter", "Vazirmatn", Arial, sans-serif;
          font-size: 10px;
          font-weight: 400;
          line-height: 1.45;
          letter-spacing: 0;
          font-kerning: normal;
          font-synthesis: none;
          -webkit-font-smoothing: antialiased;
        }
        .monthly-report-sheet * { font-family: inherit; }
        .monthly-report-no-print { display: revert; }
        @page { size: A4 portrait; margin: 6mm; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #monthly-report-print-root, #monthly-report-print-root * { visibility: visible !important; }
          #monthly-report-print-root {
            position: fixed !important; inset: 0 auto auto 0 !important; box-sizing: border-box !important;
            width: 198mm !important; height: 285mm !important; min-width: 0 !important; max-width: none !important;
            aspect-ratio: auto !important; margin: 0 !important; box-shadow: none !important;
            print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important;
          }
          .monthly-report-no-print { display: none !important; }
        }
      `}</style>

      {/* ─── نوار ابزار (چاپ نمی‌شود) ─── */}
      <div className="monthly-report-no-print flex flex-wrap items-end gap-2 rounded-xl border b-line-soft bg-black/10 p-2 text-[10px]">
        <div className="flex items-center gap-1">
          {([
            { id: "cover" as const, fa: "کاور", en: "Cover" },
            { id: "summary" as const, fa: "خلاصهٔ ماهانه", en: "Monthly summary" },
            { id: "templates" as const, fa: "قالب و خروجی", en: "Templates & export" },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-2.5 py-1.5 transition ${tab === t.id ? "toggle-on tx1" : "border b-line-soft tx3"}`}
            >
              {fa ? t.fa : t.en}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="tx3">{fa ? "شمارهٔ گزارش" : "Report No."}</span>
          <input
            value={cover.reportNo}
            onChange={(e) => patch({ reportNo: e.target.value })}
            dir="ltr"
            className="w-40 rounded-lg border b-line-soft bg-black/20 px-2 py-1.5 font-mono tx1 outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="tx3">{fa ? "پایان دوره" : "Period end"}</span>
          <input
            type="date"
            value={cover.periodEnd || period?.to || ""}
            onChange={(e) => patch({ periodEnd: e.target.value })}
            className="rounded-lg border b-line-soft bg-black/20 px-2 py-1.5 tx1 outline-none focus:border-[var(--accent)]"
          />
        </label>
        {period && (
          <span className="rounded-lg border b-line-soft px-2 py-1.5 text-[9.5px] tx3" dir="ltr">
            {fa ? "دورهٔ باز" : "Open period"} {period.code} · {period.from} → {period.to}
          </span>
        )}
        <span className="ms-auto flex items-center gap-1.5">
          {saved && <span className="text-[9px] tx4">{saved}</span>}
          <button
            type="button"
            onClick={save}
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-emerald-200 transition hover:bg-emerald-400/15"
          >
            💾 {fa ? "ذخیره" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border b-line-soft bg-black/15 px-3 py-1.5 tx2 transition hover:tx1"
          >
            🖨 {fa ? "چاپ شیت جاری (A4)" : "Print current sheet (A4)"}
          </button>
        </span>
      </div>

      {/* ─── شیت‌ها ─── */}
      {tab === "cover" && <CoverSheet cover={cover} lang={lang} model={m} onChange={patch} />}
      {tab === "summary" && <SummarySheet cover={cover} lang={lang} model={m} />}

      {/*
        قالب‌ها و خروجی: قبلاً در همین ماژول بود (PeriodicReportWorkspace) و به
        تب منتقل شد تا شیت ماهانه تنها ورودی این گره نباشد، اما هیچ قابلیتی از
        دست نرود.
      */}
      {tab === "templates" && (
        <div className="monthly-report-no-print h-[620px] overflow-hidden rounded-2xl">
          <PeriodicReportWorkspace lang={lang} kind="monthly" />
        </div>
      )}
    </section>
  );
}
