/**
 * گزارش ماهانه (MPR) — فضای کاری شیت‌محور، هم‌الگو با گزارش هفتگی.
 *
 * چرا شیت‌محور و نه کارت؟ چون خروجی ماهانه سند رسمی است: A4، قاب چاپ،
 * و کنترل کامل روی اینکه چه چیزی چاپ می‌شود. گزارش هفتگی همین معماری را
 * دارد و اینجا عیناً تکرار شده تا دو گزارش یک زبان بصری داشته باشند:
 *
 *   · کاور = ساختار WeeklyCoverSheet (نوار موزاییک کنار، دو بلوک متن،
 *     بلوک تاریخ پایین راست) با محتوای ماهانه
 *   · شیت‌های درونی = ساختار WeeklySheet (بنر عنوان آبی + موزاییک + بدنه)
 *
 * قاعدهٔ داده: اعداد از موتور برنامه‌ریزی می‌آیند (`PexModel`) و متنی که
 * کاربر تایپ می‌کند (شمارهٔ گزارش، عنوان‌ها) در localStorage می‌ماند.
 * هیچ عددی اینجا synthesize نمی‌شود؛ اگر موتور داده‌ای نداده باشد، «—»
 * نشان داده می‌شود.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { type Lang } from "../data/framework";
import { toJalaali } from "jalaali-js";
import { buildPexModel, type PexModel } from "../services/pexModel";
import PeriodicReportWorkspace from "./PeriodicReportWorkspace";
import { WeeklyReportDatePicker } from "./WeeklyReportWorkspace";

export type MonthlyReportTab = "cover" | "summary" | "templates";

type Props = {
  lang: Lang;
  model?: PexModel;
};

/** فیلدهای متنی کاور — همان چیزی که کاربر روی صفحه تایپ می‌کند. */
type CoverFields = {
  reportNo: string;
  reportDate: string;
  periodStart: string;
  periodEnd: string;
  projectTitle: string;
  analysisTitle: string;
  preparedBy: string;
  preparedUnit: string;
};

const DEFAULT_COVER: CoverFields = {
  reportNo: "MPR-001",
  reportDate: "",
  periodStart: "",
  periodEnd: "",
  projectTitle: "",
  analysisTitle: "گزارش تحلیل پروژه",
  preparedBy: "تهیه شده،",
  preparedUnit: "واحد برنامه‌ریزی و کنترل پروژه",
};

const STORAGE_PREFIX = "monthly-report:";

const JALALI_MONTHS_FA = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
] as const;

const JALALI_MONTHS_EN = [
  "Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar",
  "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand",
] as const;

/** تب‌های شیت ماهانه — همان الگوی WEEKLY_REPORT_TABS در گزارش هفتگی. */
const MONTHLY_REPORT_TABS: { id: MonthlyReportTab; fa: string; en: string }[] = [
  { id: "cover", fa: "کاور", en: "Cover" },
  { id: "summary", fa: "خلاصه", en: "Summary" },
  { id: "templates", fa: "قالب و خروجی", en: "Templates & export" },
];

/* ── قالب‌بندی عدد: فارسی/لاتین ── */
const digits = (v: string | number, fa: boolean) =>
  String(v).replace(/\d/g, (d) => (fa ? "۰۱۲۳۴۵۶۷۸۹"[Number(d)] : d));

const num = (v: number | null | undefined, fa: boolean, fractionDigits = 1) =>
  v === null || v === undefined
    ? "—"
    : digits(v.toLocaleString("en-US", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }), fa);

/**
 * ISO میلادی («۲۰۲۶-۰۹-۲۲») → رشتهٔ شمسی «۱۴۰۵/۰۶/۳۱».
 * همان قالبی که WeeklyReportDatePicker می‌پذیرد و برمی‌گرداند.
 */
function isoToJalali(iso: string): string {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  const { jy, jm, jd } = toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

/** رشتهٔ شمسی «۱۴۰۵/۰۶/۳۱» → اجزای تاریخ برای بلوک تاریخ کاور. */
function jalaliParts(value: string, fa: boolean) {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const names = fa ? JALALI_MONTHS_FA : JALALI_MONTHS_EN;
  return {
    day: digits(day, fa),
    monthNumber: digits(month, fa),
    year: digits(year, fa),
    monthName: names[month - 1] ?? "",
  };
}

/* ── ورودی متنی روی شیت (همان CoverText گزارش هفتگی) ── */
function CoverText({
  value,
  onChange,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full min-w-0 border-0 bg-transparent p-0 text-center text-inherit outline-none focus:bg-white/30 ${className}`}
    />
  );
}

/* ══════════════════════════ شیت درونی (همالگوی WeeklySheet) ══════════════════════════ */

function MonthlySheet({ title, children, dense = false }: { title: string; children: ReactNode; dense?: boolean }) {
  const contentSpacing = dense ? "pb-[1%] pt-[1.6%]" : "pb-[3%] pt-[2.4%]";
  return (
    <article
      id="monthly-report-print-root"
      aria-label={title}
      className="monthly-report-sheet relative mx-auto aspect-[210/297] w-full min-w-[520px] max-w-[760px] overflow-hidden border-2 border-[#0000ff] bg-[#eef0f2] text-[#152536] shadow-xl print:aspect-auto print:h-[297mm] print:w-[210mm] print:min-w-0 print:max-w-none print:shadow-none"
      dir="rtl"
    >
      {/* بنر عنوان + موزاییک کنار — امضای بصری شیت‌های هفتگی */}
      <div className="absolute inset-x-0 top-0 h-[10.2%] border border-black bg-[#c7dcf0]">
        <div className="absolute inset-y-0 left-0 grid w-[25%] grid-cols-2 grid-rows-2">
          <div className="bg-[#91afd0]" />
          <div className="bg-[#c7dcf0]" />
          <div className="bg-[#c7dcf0]" />
          <div className="bg-[#91afd0]" />
        </div>
        <h1 className="absolute inset-0 flex items-center justify-center px-[26%] text-center text-[clamp(15px,2.2vw,21px)] font-medium tracking-[0.015em] text-[#152536]">
          {title}
        </h1>
      </div>
      <div className={`absolute inset-x-0 bottom-0 top-[10.2%] overflow-hidden bg-[#eef0f2] px-[5.6%] ${contentSpacing}`}>
        {children}
      </div>
    </article>
  );
}

/* ══════════════════════════ کاور (همالگوی WeeklyCoverSheet) ══════════════════════════ */

function MonthlyCoverSheet({
  cover,
  lang,
  model,
  onChange,
}: {
  cover: CoverFields;
  lang: Lang;
  model?: PexModel;
  onChange: (patch: Partial<CoverFields>) => void;
}) {
  const fa = lang === "fa";
  const project = model?.project;
  const period = model?.openPeriod;
  const periodEnd = cover.periodEnd || isoToJalali(period?.to ?? model?.dataDate ?? "");
  const dateParts = jalaliParts(periodEnd, fa);

  return (
    <article
      id="monthly-report-print-root"
      aria-label={fa ? "کاور گزارش ماهانه" : "Monthly report cover"}
      className="monthly-report-sheet relative mx-auto aspect-[210/297] w-full min-w-[520px] max-w-[760px] overflow-hidden border-2 border-[#0000ff] bg-[#f3f6fa] text-[#172b3f] shadow-xl print:aspect-auto print:h-[297mm] print:w-[210mm] print:min-w-0 print:max-w-none print:shadow-none"
      dir="rtl"
    >
      {/* نوار کنار + موزاییک — عیناً از کاور گزارش هفتگی */}
      <div className="absolute inset-y-0 left-0 w-[23%] bg-[#eef3f8]" />
      <div className="absolute left-0 top-[31%] grid w-[23%] grid-cols-2">
        <div className="aspect-square bg-[#82a8c5]" />
        <div className="aspect-square bg-transparent" />
        <div className="aspect-square bg-[#507da3]" />
        <div className="aspect-square bg-[#82a8c5]" />
        <div className="aspect-square bg-[#82a8c5]" />
        <div className="aspect-square bg-[#507da3]" />
        <div className="aspect-square bg-transparent" />
        <div className="aspect-square bg-[#82a8c5]" />
      </div>

      {/* بلوک بالا: نام پروژه + گزارش تحلیل پروژه */}
      <div className="absolute left-[23%] top-[3.5%] w-[77%] px-3 text-center font-sans">
        <CoverText
          ariaLabel={fa ? "نام پروژه" : "Project title"}
          value={cover.projectTitle || project?.nameFa || ""}
          onChange={(value) => onChange({ projectTitle: value })}
          className="text-[clamp(12px,2vw,19px)] font-medium"
        />
        <CoverText
          ariaLabel={fa ? "گزارش تحلیل پروژه" : "Project analysis report"}
          value={cover.analysisTitle}
          onChange={(value) => onChange({ analysisTitle: value })}
          className="mt-[2.2%] text-[clamp(12px,1.9vw,17px)] font-semibold"
        />
      </div>

      {/* بلوک میانی: گزارش پیشرفت + شماره گزارش + دوره + تهیه‌کننده */}
      <div className="absolute left-[23%] top-[41.5%] w-[77%] px-3 text-center font-sans">
        <div className="text-[clamp(13px,2.1vw,19px)] font-bold tracking-[0.09em] text-[#183b5b]">
          {fa ? "گزارش پیشرفت" : "Progress Report"}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 text-[clamp(10px,1.6vw,14px)]">
          <span>{fa ? "شماره گزارش:" : "Report No.:"}</span>
          <CoverText
            ariaLabel={fa ? "شماره گزارش" : "Report number"}
            value={cover.reportNo}
            onChange={(value) => onChange({ reportNo: value })}
            className="w-auto max-w-[62%] text-start"
          />
        </div>
        <div className="mt-1 font-sans text-[clamp(8px,1.1vw,10px)]">
          {fa ? "دوره گزارشی؛ منتهی به" : "Reporting period; ending"} {digits(periodEnd, fa) || "—"}
        </div>
        <CoverText
          ariaLabel={fa ? "تهیه شده" : "Prepared by"}
          value={cover.preparedBy}
          onChange={(value) => onChange({ preparedBy: value })}
          className="mt-[6.5%] text-[clamp(10px,1.5vw,14px)]"
        />
        <CoverText
          ariaLabel={fa ? "واحد تهیه‌کننده" : "Preparing unit"}
          value={cover.preparedUnit}
          onChange={(value) => onChange({ preparedUnit: value })}
          className="mt-[2.2%] text-[clamp(10px,1.5vw,14px)]"
        />
      </div>

      {/* بلوک تاریخ پایین راست — همان جای کاور هفتگی */}
      {dateParts && (
        <div className="absolute bottom-[10%] left-[61%] flex items-stretch gap-1 font-sans">
          <div className="flex w-[clamp(58px,12vw,96px)] flex-col items-center justify-center border border-[#cbd5e1] bg-white/80 px-2 py-1">
            <span className="text-[clamp(10px,1.3vw,14px)]">{dateParts.monthNumber}</span>
            <span className="text-[clamp(30px,5vw,48px)] leading-none">{dateParts.day}</span>
          </div>
          <div className="flex min-w-0 flex-col justify-center text-[clamp(12px,1.9vw,18px)]">
            <span className="font-bold">{dateParts.monthName}</span>
            <span className="mt-1">{dateParts.year}</span>
          </div>
        </div>
      )}
    </article>
  );
}

/* ══════════════════════════ شیت خلاصهٔ ماهانه ══════════════════════════ */

function MonthlySummarySheet({
  cover,
  lang,
  model,
}: {
  cover: CoverFields;
  lang: Lang;
  model?: PexModel;
}) {
  const fa = lang === "fa";
  const cell = "border border-[#b6bec6] px-1 py-0 text-start align-middle";
  const headerCell = `${cell} text-center font-semibold text-[#172f46]`;
  const periodEnd = cover.periodEnd || isoToJalali(model?.openPeriod?.to ?? "");

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
    <MonthlySheet title={fa ? "خلاصهٔ ماهانه" : "Monthly Summary"}>
      <div className="flex h-full flex-col gap-[10px] overflow-hidden font-sans">
        <div className="flex shrink-0 items-center justify-between text-[9.5px] text-[#152536]">
          <span>
            {fa ? "شمارهٔ گزارش:" : "Report No.:"} {cover.reportNo || "—"}
          </span>
          <span>
            {fa ? "دوره گزارشی؛ منتهی به" : "Reporting period; ending"} {digits(periodEnd || "—", fa)}
          </span>
        </div>

        {!model ? (
          <p className="py-6 text-center text-[10px] text-[#5a6b7b]">
            {fa
              ? "دادهٔ موتور برنامه‌ریزی در دسترس نیست؛ عددی نمایش داده نمی‌شود."
              : "Planning engine data is unavailable; no figure is shown."}
          </p>
        ) : (
          <table className="w-full table-fixed border-collapse bg-white font-sans text-[9.5px] leading-[1.15] text-[#152536]">
            <thead>
              <tr className="h-[20px] bg-[#dce7f0]">
                <th className={headerCell}>{fa ? "شاخص" : "Metric"}</th>
                <th className={headerCell}>{fa ? "مقدار" : "Value"}</th>
                <th className={headerCell}>{fa ? "توضیح" : "Note"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.label} className={`h-[18px] ${index % 2 ? "bg-[#f7f9fb]" : "bg-white"}`}>
                  <td className={cell}>{row.label}</td>
                  <td className={`${cell} text-center font-semibold tabular-nums`} dir="ltr">
                    {row.value}
                  </td>
                  <td className={`${cell} text-[#5a6b7b]`}>{row.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="mt-auto shrink-0 text-[8.5px] leading-[1.4] text-[#5a6b7b]">
          {fa
            ? "همهٔ مقادیر از موتور برنامه‌ریزی در Data Date خوانده شده‌اند؛ گزارش ماهانه از دادهٔ تأییدشده ساخته می‌شود و هیچ عددی دستی وارد نمی‌شود."
            : "All values come from the planning engine at the data date; the monthly report is built from approved data and no figure is hand-entered."}
        </p>
      </div>
    </MonthlySheet>
  );
}

/* ══════════════════════════ پوستهٔ فضای کاری ══════════════════════════ */

export default function MonthlyReportWorkspace({ lang, model }: Props) {
  const fa = lang === "fa";

  /* بدون prop هم کار می‌کند (گرهٔ نقشهٔ قابلیت‌ها): همان پیش‌فرض موتور. */
  const m = useMemo(() => model ?? buildPexModel("Cost", 0.6), [model]);

  const storageKey = `${STORAGE_PREFIX}${m?.project.code ?? "default"}`;
  const [tab, setTab] = useState<MonthlyReportTab>("cover");
  const [cover, setCover] = useState<CoverFields>(DEFAULT_COVER);
  const [saved, setSaved] = useState("");

  /* بارگذاری تنظیمات ذخیره‌شدهٔ همین پروژه. */
  useEffect(() => {
    let loaded: CoverFields = {
      ...DEFAULT_COVER,
      reportDate: isoToJalali(m?.openPeriod?.to ?? ""),
      periodStart: isoToJalali(m?.openPeriod?.from ?? ""),
      periodEnd: isoToJalali(m?.openPeriod?.to ?? ""),
    };
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) loaded = { ...loaded, ...(JSON.parse(raw) as Partial<CoverFields>) };
    } catch {
      /* دادهٔ خراب ذخیره را نادیده می‌گیریم و پیش‌فرض می‌ماند. */
    }
    setCover(loaded);
  }, [storageKey, m?.openPeriod?.to]);

  /* فقط شیت‌های سندی چاپ می‌شوند؛ تب قالب/خروجی صفحهٔ کاغذی نیست. */
  const printable = tab === "cover" || tab === "summary";

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
          line-height: 1.4;
          letter-spacing: 0;
          font-kerning: normal;
          font-synthesis: none;
          -webkit-font-smoothing: antialiased;
        }
        .monthly-report-sheet * { font-family: inherit; }
        /*
          توجه: هیچ قانون display خارج از @media print برای این کلاس نگذار.
          مقدار revert روی div باعث می‌شود کلاس flex تیلویند را از کار
          بیاندازد (این استایل در body و بعد از head رندر می‌شود و با
          اولویت برابر، ترتیب بعدی را می‌برد) و کل هدر به block برگردد و
          فیلدها زیر هم چیده شوند. تنها نیاز ما پنهان‌شدن در چاپ است و
          همان در داخل media print انجام شده.
        */
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

      {/* ─── هدر بالا — عیناً ساختار هدر گزارش هفتگی ─── */}
      <div className="monthly-report-no-print flex flex-wrap items-end gap-2 rounded-xl border b-line-soft bg-black/10 p-2 text-[10px]">
        <label className="flex flex-col gap-1">
          <span className="tx3">{fa ? "شماره گزارش" : "Report No."}</span>
          <input
            value={cover.reportNo}
            onChange={(event) => patch({ reportNo: event.target.value })}
            dir="ltr"
            className="w-52 rounded-lg border b-line-soft bg-black/20 px-2 py-1.5 font-mono tx1 outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="tx3">{fa ? "تاریخ گزارش" : "Report date"}</span>
          <WeeklyReportDatePicker value={cover.reportDate} rtl={fa} onChange={(value) => patch({ reportDate: value })} compact />
        </label>
        <label className="flex flex-col gap-1">
          <span className="tx3">{fa ? "شروع دوره" : "Period start"}</span>
          <WeeklyReportDatePicker
            value={cover.periodStart}
            rtl={fa}
            onChange={(value) => patch({ periodStart: value })}
            compact
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="tx3">{fa ? "پایان دوره" : "Period end"}</span>
          <WeeklyReportDatePicker
            value={cover.periodEnd}
            rtl={fa}
            onChange={(value) => patch({ periodEnd: value })}
            compact
          />
        </label>
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
            disabled={!printable}
            className="rounded-lg border b-line-soft bg-black/15 px-3 py-1.5 tx2 transition hover:tx1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🖨 {fa ? "چاپ شیت جاری (A4)" : "Print current sheet (A4)"}
          </button>
        </span>
      </div>

      {/* نوار تب شیت‌ها — همان نوار گزارش هفتگی */}
      <nav
        className="monthly-report-no-print flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1"
        role="tablist"
        aria-label={fa ? "شیت‌های گزارش ماهانه" : "Monthly report sheets"}
      >
        {MONTHLY_REPORT_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] transition ${tab === item.id ? "toggle-on tx1" : "tx3 hover:tx1"}`}
          >
            {fa ? item.fa : item.en}
          </button>
        ))}
      </nav>

      {/* ─── شیت‌ها ─── */}
      {tab === "cover" && <MonthlyCoverSheet cover={cover} lang={lang} model={m} onChange={patch} />}
      {tab === "summary" && <MonthlySummarySheet cover={cover} lang={lang} model={m} />}

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
