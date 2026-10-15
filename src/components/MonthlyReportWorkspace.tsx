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

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { type Lang } from "../data/framework";
import { toJalaali } from "jalaali-js";
import { buildPexModel, type PexModel } from "../services/pexModel";
import PeriodicReportWorkspace from "./PeriodicReportWorkspace";
import { WeeklyReportDatePicker } from "./WeeklyReportWorkspace";
import iranMap from "../assets/iran-provinces-map.png";

export type MonthlyReportTab =
  | "cover"
  | "index"
  | "summary"
  | "templates"
  | "contract"
  | "geography"
  | "reportId"
  | "scope"
  | "overallProgress"
  | "finance"
  | "timeAnalysis"
  | "delayAnalysis"
  | "rootCause"
  | "updatedSchedule"
  | "actionPlan"
  | "pmsMdr"
  | "pmsDdr"
  | "pmsStatus"
  | "pmsProc"
  | "pmsConst"
  | `divider-${number}`;

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
  /** مسئول کنترل پروژه — همان «Project Control: [...]» انتهای کاور. */
  projectControl: string;
};

/** فیلدهای صفحهٔ تمپلت «مشخصات قرارداد» — متن روی شیت قابل ویرایش است. */
type ContractFields = {
  project: string;
  projectNo: string;
  mainClient: string;
  client: string;
  contractor: string;
  contractType: string;
  contractNo: string;
  location: string;
  subject: string;
  duration: string;
  maintenanceMonths: string;
  startDate: string;
  siteHandoverDate: string;
  endDate: string;
  extension: string;
  bidCoefficient: string;
  priceListYear: string;
  amount: string;
  mobilizationAmount: string;
  constructionAmount: string;
  procurementAmount: string;
  engWeight: string;
  procWeight: string;
  constWeight: string;
  epcTotal: string;
};

type GeographyFields = {
  overview: string;
};

type ScopeFields = {
  text: string;
};

type ReportIdFields = {
  author: string;
  physPlannedCum: string;
  physActualCum: string;
  physPlannedPeriod: string;
  physActualPeriod: string;
  costActualCum: string;
  costActualPeriod: string;
  baselineDoc: string;
  baselineApproved: string;
};

const DEFAULT_GEOGRAPHY: GeographyFields = { overview: "" };

const DEFAULT_SCOPE: ScopeFields = { text: "" };

const DEFAULT_REPORT_ID: ReportIdFields = {
  author: "شرکت پس کرانه",
  physPlannedCum: "38.83%",
  physActualCum: "5.58%",
  physPlannedPeriod: "4.55%",
  physActualPeriod: "1.09%",
  costActualCum: "708,418",
  costActualPeriod: "138,758",
  baselineDoc: "نسخه اول برنامه زمان بندی مصوب با کد مدرک:",
  baselineApproved: "خط مبنای اول، مصوب در مورخ",
};

const DEFAULT_CONTRACT: ContractFields = {
  project:
    "طراحی تفصیلی خرید و احداث ساختمانها و مجموعه انبارهای جدید جاده فرودگاه در منطقه ویژه انرژی پارس پتروشیمی جم به روش (EPC)",
  projectNo: "",
  mainClient: "",
  client: "",
  contractor: "",
  contractType: "",
  contractNo: "۷۲ ۱۴۰۳",
  location: "استان بوشهر . جاده فرودگاه منطقه ویژه انرژی پارس انبار پتروشیمی جم",
  subject:
    "طراحی تفصیلی خرید و احداث ساختمانها و مجموعه انبارهای جدید جاده فرودگاه در منطقه ویژه انرژی پارس پتروشیمی\nاحداث ساختمانها و مجموعه انبار های جدید",
  duration: "۲۰ ماه – (معادل ۶۰۸ روز )",
  maintenanceMonths: "",
  startDate: "مورخ: ۱۴۰۳/۰۸/۲۶ ابلاغی طی نامه شماره ......... مورخ: ..........",
  siteHandoverDate: "",
  endDate: "مورخ: ۱۴۰۵/۰۴/۲۵",
  extension: "----",
  bidCoefficient: "",
  priceListYear: "",
  amount: "ریال",
  mobilizationAmount: "",
  constructionAmount: "",
  procurementAmount: "",
  engWeight: "1.91%",
  procWeight: "1.65%",
  constWeight: "96.45%",
  epcTotal: "100.00%",
};

const DEFAULT_COVER: CoverFields = {
  reportNo: "MPR-001",
  reportDate: "",
  periodStart: "",
  periodEnd: "",
  projectTitle: "",
  analysisTitle: "گزارش تحلیلی پروژه",
  preparedBy: "تهیه شده،",
  preparedUnit: "واحد برنامه‌ریزی و کنترل پروژه",
  projectControl: "",
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

const MONTHLY_CORE_TABS: { id: MonthlyReportTab; fa: string; en: string }[] = [
  { id: "cover", fa: "کاور", en: "Cover" },
  { id: "index", fa: "فهرست", en: "Index" },
];

const MONTHLY_TAIL_TABS: { id: MonthlyReportTab; fa: string; en: string }[] = [
  { id: "summary", fa: "خلاصه", en: "Summary" },
  { id: "templates", fa: "قالب و خروجی", en: "Templates & export" },
];

/**
 * فهرست یکپارچهٔ گزارش ماهانه.
 * قاب شیت از WeeklyIndexSheet است. محتوا ادغام دو صفحهٔ مرجع است:
 *   · فهرست زرد هفت‌فصلی (منشور، زمان، منابع، کنترل، کیفیت، HSE، مصور)
 *   · فهرست شماره‌دار هشت‌فصلی MPR (PMS، پیشرفت Eng/Proc/Const، منحنی‌ها، Action Plan)
 * بندهای هم‌معنی یکی شدند (مثلاً S-Curve ≡ منحنی‌های پیشرفت؛ مکاتبات داخل جلسات).
 */
const MONTHLY_INDEX_CHAPTERS: { fa: string; en: string; items: { fa: string; en: string }[] }[] = [
  {
    fa: "فصل اول : منشور پروژه",
    en: "Chapter 1: Project charter",
    items: [
      { fa: "شناسنامه قراردادی پروژه", en: "Project contract identity" },
      { fa: "مشخصات جغرافیایی", en: "Geographic particulars" },
      { fa: "شناسنامه گزارش", en: "Report identity" },
      { fa: "شرح محدوده پروژه", en: "Project scope description" },
    ],
  },
  {
    fa: "فصل دوم : مدیریت زمان",
    en: "Chapter 2: Time management",
    items: [
      { fa: "پیشرفت کلی پروژه فیزیکی / ریالی", en: "Overall physical / cost progress" },
      { fa: "وضعیت مالی", en: "Financial status" },
      { fa: "گزارش تحلیلی مدیریت زمان", en: "Time-management analysis report" },
      { fa: "آنالیز تأخیر و انحراف پروژه", en: "Delay and variance analysis" },
      { fa: "علل ریشه‌ای انحرافات و دلالت تأخیرات", en: "Root-cause of deviations and delay implications" },
      { fa: "گزارش مدیریت ارزش کسب‌شده", en: "Earned value management report" },
      { fa: "برنامه زمان‌بندی به‌روزشده و متأثر از تأخیرات", en: "Updated schedule affected by delays" },
      { fa: "Action Plan (۳۰ روزه)", en: "Action Plan (30-day)" },
    ],
  },
  {
    fa: "فصل سوم : سیستم اندازه‌گیری پیشرفت (PMS)",
    en: "Chapter 3: Progress Measurement System (PMS)",
    items: [
      { fa: "گزارش پیشرفت (در بخش Engineering)", en: "Progress report (Engineering)" },
      { fa: "گزارش پیشرفت (در بخش Procurement)", en: "Progress report (Procurement)" },
      { fa: "گزارش پیشرفت (در بخش Construction)", en: "Progress report (Construction)" },
      { fa: "منحنی و نمودار پیشرفت فیزیکی (در بخش‌های EPC)", en: "Physical progress curve (EPC)" },
      { fa: "منحنی و نمودار پیشرفت فیزیکی (در بخش Engineering)", en: "Physical progress curve (Engineering)" },
      { fa: "منحنی و نمودار پیشرفت فیزیکی (در بخش Procurement)", en: "Physical progress curve (Procurement)" },
      { fa: "منحنی و نمودار پیشرفت فیزیکی (در بخش Construction)", en: "Physical progress curve (Construction)" },
      { fa: "منحنی و نمودار پیشرفت ریالی (جریان نقدینگی)", en: "Cost progress curve (cash flow)" },
    ],
  },
  {
    fa: "فصل چهارم : مدیریت منابع",
    en: "Chapter 4: Resource management",
    items: [
      { fa: "وضعیت جوی و کاری", en: "Weather and working conditions" },
      { fa: "آمار نیروی انسانی", en: "Manpower statistics" },
      { fa: "آمار تجهیزات و ماشین‌آلات", en: "Equipment and machinery statistics" },
      { fa: "نمودارهای نیروی انسانی و ماشین‌آلات ، مصالح", en: "Manpower, machinery and material charts" },
      { fa: "خلاصه گزارش کالا و مصالح", en: "Materials and goods summary" },
      { fa: "گزارش تحلیلی مدیریت منابع", en: "Resource-management analysis report" },
    ],
  },
  {
    fa: "فصل پنجم : مدیریت کنترل پروژه",
    en: "Chapter 5: Project controls",
    items: [
      { fa: "اهم فعالیت‌های پروژه", en: "Key project activities" },
      { fa: "گزارش مشکلات و پیشنهادات", en: "Issues and recommendations" },
      { fa: "گزارش جلسات پیشبرد پروژه و مکاتبات", en: "Progress meetings and correspondence" },
      { fa: "گزارش توقف کاری", en: "Work-stoppage report" },
      { fa: "گزارش تغییر کار", en: "Change-of-work report" },
      { fa: "گزارش فعالیت‌های متأثر از تأخیرات", en: "Activities affected by delays" },
    ],
  },
  {
    fa: "فصل ششم : مدیریت کنترل کیفیت",
    en: "Chapter 6: Quality control",
    items: [
      { fa: "گزارش بازدید کارشناسان فنی کارفرما از کارگاه", en: "Employer technical site-visit report" },
      { fa: "گزارش بررسی نقشه‌های کارگاهی و ازبیلت", en: "Shop-drawing and as-built review" },
    ],
  },
  {
    fa: "فصل هفتم : ایمنی و محیط زیست (HSE)",
    en: "Chapter 7: Health, safety and environment (HSE)",
    items: [{ fa: "گزارش مدیریت HSE", en: "HSE management report" }],
  },
  {
    fa: "فصل هشتم : گزارش مصور",
    en: "Chapter 8: Photographic report",
    items: [{ fa: "گزارش تصویری", en: "Photo report" }],
  },
];

type MonthlyIndexChapter = (typeof MONTHLY_INDEX_CHAPTERS)[number];

/** «فصل اول : منشور پروژه» → «فصل اول» — همان عنوان دیوایدر در صفحهٔ مرجع. */
function chapterHeading(chapter: MonthlyIndexChapter, fa: boolean): string {
  const title = fa ? chapter.fa : chapter.en;
  return title.split(/\s*[:：]\s*/)[0]?.trim() || title;
}

/** «فصل اول : منشور پروژه» → «منشور پروژه». */
function chapterTopic(chapter: MonthlyIndexChapter, fa: boolean): string {
  const title = fa ? chapter.fa : chapter.en;
  return title.split(/\s*[:：]\s*/)[1]?.trim() || "";
}

const MONTHLY_REPORT_TABS: { id: MonthlyReportTab; fa: string; en: string }[] = [
  ...MONTHLY_CORE_TABS,
  {
    id: "divider-1",
    fa: chapterHeading(MONTHLY_INDEX_CHAPTERS[0], true),
    en: chapterHeading(MONTHLY_INDEX_CHAPTERS[0], false),
  },
  { id: "contract", fa: "مشخصات قرارداد", en: "Contract particulars" },
  { id: "geography", fa: "مشخصات جغرافیایی", en: "Geographic particulars" },
  { id: "reportId", fa: "شناسنامه گزارش", en: "Report identity" },
  { id: "scope", fa: "شرح محدوده", en: "Scope description" },
  {
    id: "divider-2",
    fa: chapterHeading(MONTHLY_INDEX_CHAPTERS[1], true),
    en: chapterHeading(MONTHLY_INDEX_CHAPTERS[1], false),
  },
  { id: "overallProgress", fa: "پیشرفت کلی", en: "Overall progress" },
  { id: "finance", fa: "وضعیت مالی", en: "Financial status" },
  { id: "timeAnalysis", fa: "گزارش تحلیلی زمان", en: "Time analysis" },
  { id: "delayAnalysis", fa: "آنالیز تأخیر و انحراف", en: "Delay analysis" },
  { id: "rootCause", fa: "علل ریشه‌ای تأخیرات", en: "Root-cause of delays" },
  { id: "updatedSchedule", fa: "برنامه زمان‌بندی به‌روز", en: "Updated schedule" },
  { id: "actionPlan", fa: "Action Plan (۳۰ روزه)", en: "Action Plan (30-day)" },
  {
    id: "divider-3",
    fa: chapterHeading(MONTHLY_INDEX_CHAPTERS[2], true),
    en: chapterHeading(MONTHLY_INDEX_CHAPTERS[2], false),
  },
  { id: "pmsMdr", fa: "MDR", en: "MDR" },
  { id: "pmsDdr", fa: "DDR", en: "DDR" },
  { id: "pmsStatus", fa: "E - Chart", en: "E - Chart" },
  { id: "pmsProc", fa: "پیشرفت Procurement", en: "Procurement progress" },
  { id: "pmsConst", fa: "پیشرفت Construction", en: "Construction progress" },
  ...MONTHLY_INDEX_CHAPTERS.slice(3).map((chapter, index) => ({
    id: `divider-${index + 4}` as MonthlyReportTab,
    fa: chapterHeading(chapter, true),
    en: chapterHeading(chapter, false),
  })),
  ...MONTHLY_TAIL_TABS,
];

/* ── قالب‌بندی عدد: فارسی/لاتین ── */
const digits = (v: string | number, fa: boolean) =>
  String(v).replace(/\d/g, (d) => (fa ? "۰۱۲۳۴۵۶۷۸۹"[Number(d)] : d));

const asciiDigits = (value: string) =>
  value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

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

function MonthlySheet({ title, children, dense = false, landscape = false, dir = "rtl" }: { title: string; children: ReactNode; dense?: boolean; landscape?: boolean; dir?: "rtl" | "ltr" }) {
  const contentSpacing = dense ? "pb-[1%] pt-[1.6%]" : "pb-[3%] pt-[2.4%]";
  return (
    <article
      id="monthly-report-print-root"
      aria-label={title}
      className={
        landscape
          ? "monthly-report-sheet monthly-report-landscape relative mx-auto aspect-[297/210] w-full min-w-[720px] max-w-[1100px] overflow-hidden border-2 border-[#0000ff] bg-[#eef0f2] text-[#152536] shadow-xl print:aspect-auto print:h-[210mm] print:w-[297mm] print:min-w-0 print:max-w-none print:shadow-none"
          : "monthly-report-sheet relative mx-auto aspect-[210/297] w-full min-w-[520px] max-w-[760px] overflow-hidden border-2 border-[#0000ff] bg-[#eef0f2] text-[#152536] shadow-xl print:aspect-auto print:h-[297mm] print:w-[210mm] print:min-w-0 print:max-w-none print:shadow-none"
      }
      dir={dir}
    >
      {/* بنر عنوان + موزاییک کنار — امضای بصری شیت‌های هفتگی */}
      <div className="absolute inset-x-0 top-0 h-[10.2%] border border-black bg-[#c7dcf0]">
        <div className="absolute inset-y-0 left-0 grid w-[25%] grid-cols-2 grid-rows-2">
          <div className="bg-[#91afd0]" />
          <div className="bg-[#c7dcf0]" />
          <div className="bg-[#c7dcf0]" />
          <div className="bg-[#91afd0]" />
        </div>
        <h1
          dir={dir}
          className="absolute inset-0 flex items-center justify-center px-[26%] text-center text-[clamp(15px,2.2vw,21px)] font-medium tracking-[0.015em] text-[#152536]"
          style={{ unicodeBidi: "isolate" }}
        >
          {title}
        </h1>
      </div>
      <div className={`absolute inset-x-0 bottom-0 top-[10.2%] overflow-hidden bg-[#eef0f2] px-[5.6%] ${contentSpacing}`}>
        {children}
      </div>
    </article>
  );
}

function TemplateInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full min-w-0 border-0 bg-transparent p-0 text-start text-[clamp(10px,1.4vw,12.5px)] text-inherit outline-none focus:bg-[#eef4f8]"
    />
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

      {/* بلوک میانی: عنوان گزارش + شماره گزارش + دوره گزارشی */}
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
        <div className="mt-1 font-sans text-[clamp(10px,1.6vw,14px)]">
          {fa ? "دوره گزارشی؛ منتهی به" : "Reporting period; ending"} {digits(periodEnd, fa) || "—"}
        </div>
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

      {/*
        پاصفحه چپ: تهیه‌کننده و واحد — انتهای پایین، سمت چپ صفحه.
        text-left چون محل بصری چپ است (درخواست صریح)، نه راستِ dir=rtl.
        سطر Project Control به راستِ همان ردیف رفت تا روی هم نیفتند.
      */}
      <div className="absolute bottom-[2%] left-[7%] w-[46%] font-sans text-[clamp(10px,1.5vw,14px)]">
        <CoverText
          ariaLabel={fa ? "تهیه شده" : "Prepared by"}
          value={cover.preparedBy}
          onChange={(value) => onChange({ preparedBy: value })}
          className="!text-left text-[clamp(10px,1.5vw,14px)]"
        />
        <CoverText
          ariaLabel={fa ? "واحد تهیه‌کننده" : "Preparing unit"}
          value={cover.preparedUnit}
          onChange={(value) => onChange({ preparedUnit: value })}
          className="mt-1 !text-left text-[clamp(10px,1.5vw,14px)]"
        />
      </div>

      {/*
        انتهای صفحه، سمت راست: مسئول کنترل پروژه — «Project Control: [...]».
        برچسب انگلیسی همان‌طور که در صفحهٔ مرجع بود باقی می‌ماند و مقدار
        داخل براکت روی خود کاور قابل تایپ است (مثل بقیهٔ متن‌های کاور).
        dir=ltr تا ترتیب «Project Control: [نام]» درست بنشیند.
      */}
      <div className="absolute bottom-[2%] right-[7%] flex items-center gap-1 font-sans text-[clamp(9px,1.2vw,11px)]" dir="ltr">
        <span className="text-[#4a5b6b]">Project Control:</span>
        <span className="text-[#1b4672]">[</span>
        <input
          aria-label={fa ? "مسئول کنترل پروژه" : "Project control"}
          value={cover.projectControl}
          onChange={(event) => onChange({ projectControl: event.target.value })}
          placeholder={fa ? "نام مسئول" : "Name"}
          className="w-40 border-0 border-b border-dotted border-[#4a5b6b] bg-transparent px-1 py-0.5 text-center font-medium text-[#1b4672] outline-none focus:bg-white/60"
        />
        <span className="text-[#1b4672]">]</span>
      </div>
    </article>
  );
}

/* ══════════════════════════ شیت فهرست (همالگوی WeeklyIndexSheet) ══════════════════════════ */

function MonthlyIndexSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const rows = MONTHLY_INDEX_CHAPTERS.flatMap((chapter) => [
    { kind: "chapter" as const, key: chapter.en, fa: chapter.fa, en: chapter.en },
    ...chapter.items.map((item, itemIndex) => ({
      kind: "item" as const,
      key: `${chapter.en}-${item.en}`,
      fa: item.fa,
      en: item.en,
      no: itemIndex + 1,
    })),
  ]);

  return (
    <MonthlySheet title={fa ? "فهرست گزارش" : "Report Contents"} dense>
      <div className="flex h-full flex-col overflow-hidden font-sans text-[clamp(10px,1.4vw,12.5px)] text-[#152536]">
        {rows.map((row) =>
          row.kind === "chapter" ? (
            <h2
              key={row.key}
              className="flex min-h-0 flex-1 items-center bg-[#f3e45a] px-2.5 text-start text-[clamp(10.5px,1.5vw,13px)] font-semibold leading-none"
            >
              {fa ? row.fa : row.en}
            </h2>
          ) : (
            <div
              key={row.key}
              className="flex min-h-0 flex-1 items-center gap-2 border-b border-[#e2e6ea] bg-white ps-[8%] pe-2"
            >
              <span className="w-[1.8em] shrink-0 text-start tabular-nums">{digits(row.no, fa)}.</span>
              <span className="min-w-0 text-start leading-none">{fa ? row.fa : row.en}</span>
            </div>
          ),
        )}
      </div>
    </MonthlySheet>
  );
}

/* ══════════════════════════ دیوایدر فصل (صفحهٔ جداکنندهٔ بین فصول) ══════════════════════════ */

function MonthlyChapterDividerSheet({
  cover,
  lang,
  chapter,
}: {
  cover: CoverFields;
  lang: Lang;
  chapter: MonthlyIndexChapter;
}) {
  const fa = lang === "fa";

  return (
    <article
      id="monthly-report-print-root"
      aria-label={chapterHeading(chapter, fa)}
      className="monthly-report-sheet relative mx-auto aspect-[210/297] w-full min-w-[520px] max-w-[760px] overflow-hidden border-2 border-[#0000ff] bg-[#f3f6fa] text-[#172b3f] shadow-xl print:aspect-auto print:h-[297mm] print:w-[210mm] print:min-w-0 print:max-w-none print:shadow-none"
      dir="rtl"
    >
      {/* نوار کنار + موزاییک — عیناً همان کاور */}
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

      {cover.projectTitle ? (
        <div className="absolute left-[23%] top-[4%] w-[77%] px-3 text-center font-sans text-[clamp(12px,1.8vw,16px)] font-medium text-[#5a6b7b]">
          {cover.projectTitle}
        </div>
      ) : null}

      {/*
        بدون flex. عنوان روی خط وسطِ ردیف اول موزاییک (top 31%، کاشی مربعی 23%/2).
        calc: 31% + نیم‌ارتفاع کاشی = 31% + 23%×(210/297)/4
      */}
      <div
        className="absolute left-[23%] w-[77%] px-6 text-center font-sans"
        style={{ top: "calc(31% + 23% * 210 / 297 / 4)", marginTop: "-23px" }}
      >
        <div className="font-bold tracking-[0.04em] text-[#183b5b]" style={{ fontSize: "42px", lineHeight: 1.1 }}>
          {chapterHeading(chapter, fa)}
        </div>
        <div style={{ marginTop: "48px", paddingRight: "8%", textAlign: "right" }}>
          {chapterTopic(chapter, fa) ? (
            <div className="font-semibold text-[#2f5570]" style={{ fontSize: "22px" }}>
              {chapterTopic(chapter, fa)}
            </div>
          ) : null}
          <div className="mt-5 h-[2px] w-24 bg-[#82a8c5]" style={{ marginLeft: "auto", marginRight: 0 }} />
          <ul className="mt-5 list-none space-y-2.5 p-0 text-[clamp(12px,1.8vw,16px)] font-medium leading-[1.4] text-[#24384c]">
            {chapter.items.map((item) => (
              <li key={item.en}>{fa ? item.fa : item.en}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

/* ══════════════════════════ مشخصات قرارداد (تمپلت درونی) ══════════════════════════ */

function MonthlyContractSheet({
  lang,
  contract,
  onChange,
}: {
  lang: Lang;
  contract: ContractFields;
  onChange: (patch: Partial<ContractFields>) => void;
}) {
  const fa = lang === "fa";
  const sections: { fa: string; en: string; fields: { key: keyof ContractFields; fa: string; en: string }[] }[] = [
    {
      fa: "مشخصات پیمان",
      en: "Contract identity",
      fields: [
        { key: "project", fa: "پروژه", en: "Project" },
        { key: "projectNo", fa: "شماره پروژه", en: "Project no." },
        { key: "subject", fa: "موضوع پیمان", en: "Subject" },
        { key: "location", fa: "محل پروژه", en: "Location" },
        { key: "mainClient", fa: "کارفرما اصلی", en: "Main client" },
        { key: "client", fa: "کارفرما", en: "Client" },
        { key: "contractor", fa: "پیمانکار", en: "Contractor" },
        { key: "contractType", fa: "نوع قرارداد", en: "Contract type" },
        { key: "contractNo", fa: "شماره پیمان", en: "Contract no." },
      ],
    },
    {
      fa: "زمان پیمان",
      en: "Contract time",
      fields: [
        { key: "duration", fa: "مدت پیمان / ماه", en: "Duration / months" },
        { key: "maintenanceMonths", fa: "دوره نگهداری / ماه", en: "Maintenance / months" },
        { key: "startDate", fa: "تاریخ شروع بکار", en: "Work start date" },
        { key: "siteHandoverDate", fa: "تاریخ تحویل زمین", en: "Site handover date" },
        { key: "endDate", fa: "تاریخ خاتمه قراردادی پروژه", en: "Contractual finish date" },
        { key: "extension", fa: "تمدید مدت پیمان", en: "Duration extension" },
      ],
    },
    {
      fa: "مبالغ پیمان",
      en: "Contract amounts",
      fields: [
        { key: "bidCoefficient", fa: "ضریب پیشنهادی پیمانکار", en: "Bid coefficient" },
        { key: "priceListYear", fa: "سال فهرست بهای منظم به پیمان", en: "Price-list year" },
        { key: "amount", fa: "مبلغ پیمان", en: "Contract amount" },
        { key: "mobilizationAmount", fa: "مبلغ تجهیز کارگاه", en: "Mobilization amount" },
        { key: "constructionAmount", fa: "مبلغ بخش اجرا- C", en: "Construction amount (C)" },
        { key: "procurementAmount", fa: "مبلغ بخش کالا- P", en: "Procurement amount (P)" },
      ],
    },
    {
      fa: "اوزان EPC",
      en: "EPC weights",
      fields: [
        { key: "engWeight", fa: "بخش Engineering", en: "Engineering" },
        { key: "procWeight", fa: "بخش Procurement", en: "Procurement" },
        { key: "constWeight", fa: "بخش Construction & Erection", en: "Construction & Erection" },
        { key: "epcTotal", fa: "کل EPC", en: "Total EPC" },
      ],
    },
  ];

  const lines = sections.flatMap((section) => [
    { kind: "section" as const, key: section.en, fa: section.fa, en: section.en },
    ...section.fields.map((field) => ({ kind: "field" as const, ...field })),
  ]);

  return (
    <MonthlySheet title={fa ? "مشخصات قرارداد" : "Contract particulars"} dense>
      <div className="flex h-full flex-col overflow-hidden font-sans text-[clamp(10px,1.4vw,12.5px)] text-[#152536]">
        {lines.map((line) =>
          line.kind === "section" ? (
            <h2
              key={line.key}
              className="flex min-h-0 flex-1 items-center bg-[#d9d9d9] px-2.5 text-start text-[clamp(10.5px,1.5vw,13px)] font-semibold leading-none"
            >
              {fa ? line.fa : line.en}
            </h2>
          ) : (
            <div
              key={line.key}
              className="flex min-h-0 flex-1 items-center gap-2 border-b border-[#e2e6ea] bg-white px-2"
            >
              <span className="w-[38%] shrink-0 text-start font-semibold leading-none">{fa ? line.fa : line.en}</span>
              <TemplateInput
                ariaLabel={fa ? line.fa : line.en}
                value={contract[line.key]}
                onChange={(value) => onChange({ [line.key]: value })}
              />
            </div>
          ),
        )}
      </div>
    </MonthlySheet>
  );
}

const geoBand =
  "flex h-[22px] shrink-0 items-center bg-[#d9d9d9] px-2.5 text-start text-[clamp(10.5px,1.5vw,13px)] font-semibold text-[#152536]";

function MonthlyGeographySheet({
  lang,
  geography,
  onChange,
}: {
  lang: Lang;
  geography: GeographyFields;
  onChange: (patch: Partial<GeographyFields>) => void;
}) {
  const fa = lang === "fa";
  return (
    <MonthlySheet title={fa ? "مشخصات جغرافیایی" : "Geographic particulars"} dense>
      <div className="flex h-full flex-col overflow-hidden font-sans text-[#152536]">
        <h2 className={geoBand}>{fa ? "چشم‌انداز پروژه (شرح کلی پروژه):" : "Project overview:"}</h2>
        <textarea
          aria-label={fa ? "چشم‌انداز پروژه" : "Project overview"}
          value={geography.overview}
          onChange={(event) => onChange({ overview: event.target.value })}
          className="min-h-0 w-full flex-[2] resize-none border-0 border-b border-[#e2e6ea] bg-white p-2 text-start text-[clamp(10px,1.4vw,12.5px)] outline-none focus:bg-[#eef4f8]"
        />
        <h2 className={geoBand}>{fa ? "موقعیت جغرافیایی:" : "Geographic location:"}</h2>
        <div className="relative min-h-0 flex-[5] bg-white">
          <table className="h-full w-full table-fixed border-collapse">
            <tbody>
              <tr>
                <td className="w-[42%] border border-[#d5d9de] bg-[#fafafa] align-top" />
                <td className="border border-[#d5d9de] p-1 align-middle">
                  <img src={iranMap} alt={fa ? "نقشه ایران" : "Map of Iran"} className="mx-auto max-h-full max-w-full object-contain" />
                </td>
              </tr>
            </tbody>
          </table>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 48 78 C 62 80, 74 62, 82 48" fill="none" stroke="#1a1a1a" strokeWidth="1.6" />
            <polygon points="79,44 88,47 79,52" fill="#1a1a1a" />
          </svg>
        </div>
      </div>
    </MonthlySheet>
  );
}

function MonthlyReportIdSheet({
  cover,
  lang,
  reportId,
  onChange,
  onChangeCover,
}: {
  cover: CoverFields;
  lang: Lang;
  model?: PexModel;
  reportId: ReportIdFields;
  onChange: (patch: Partial<ReportIdFields>) => void;
  onChangeCover: (patch: Partial<CoverFields>) => void;
}) {
  const fa = lang === "fa";
  const field =
    "min-w-0 border-0 bg-transparent p-0 text-[12.5px] text-inherit outline-none focus:bg-[#eef4f8]";
  const meta = [
    {
      label: fa ? "تهیه کننده گزارش:" : "Prepared by:",
      value: reportId.author || cover.preparedBy,
      onChange: (value: string) => onChange({ author: value }),
    },
    {
      label: fa ? "شماره گزارش:" : "Report no.:",
      value: cover.reportNo,
      onChange: (value: string) => onChangeCover({ reportNo: value }),
    },
    {
      label: fa ? "تاریخ تنظیم:" : "Issue date:",
      value: digits(cover.reportDate, fa),
      onChange: (value: string) => onChangeCover({ reportDate: asciiDigits(value) }),
    },
  ];
  const phys = [
    { key: "physPlannedCum" as const, fa: "درصد پیشرفت فیزیکی مورد انتظار، (تجمعی):", en: "Planned physical progress (cumulative):" },
    { key: "physActualCum" as const, fa: "درصد پیشرفت فیزیکی تحقق یافته، (تجمعی):", en: "Actual physical progress (cumulative):" },
    { key: "physPlannedPeriod" as const, fa: "درصد پیشرفت فیزیکی مورد انتظار، (طی دوره):", en: "Planned physical progress (period):" },
    { key: "physActualPeriod" as const, fa: "درصد پیشرفت فیزیکی تحقق یافته، (طی دوره):", en: "Actual physical progress (period):" },
  ];
  const cost = [
    { key: "costActualCum" as const, fa: "درصد پیشرفت ریالی تحقق یافته، (تجمعی):", en: "Actual cost progress (cumulative):" },
    { key: "costActualPeriod" as const, fa: "درصد پیشرفت ریالی تحقق یافته، (دوره):", en: "Actual cost progress (period):" },
  ];

  return (
    <MonthlySheet title={fa ? "شناسنامه گزارش" : "Report identity"} dense>
      <div
        className="h-full overflow-hidden bg-white px-[2%] font-sans text-[12.5px] text-[#152536]"
        style={{ paddingTop: 70 }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <tbody>
            <tr>
              <td style={{ width: "40%", verticalAlign: "top" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {meta.map((row) => (
                      <tr key={row.label}>
                        <td style={{ width: 1, whiteSpace: "nowrap", padding: "3px 0", verticalAlign: "middle" }}>{row.label}</td>
                        <td style={{ padding: "3px 10px", verticalAlign: "middle" }}>
                          <input
                            aria-label={row.label}
                            value={row.value}
                            onChange={(event) => row.onChange(event.target.value)}
                            className={field}
                            style={{ width: "100%", textAlign: "center", fontFamily: "Vazirmatn, Tahoma, sans-serif" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
              <td style={{ verticalAlign: "top", paddingTop: 4, whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-block", borderBottom: "1px solid #152536", paddingBottom: 2 }}>
                  {fa ? "دوره گزارش:" : "Period:"}
                  <span style={{ marginInlineStart: 10 }}>{fa ? "از تاریخ:" : "From:"}</span>
                  <input
                    aria-label={fa ? "از تاریخ" : "Period start"}
                    value={digits(cover.periodStart, fa)}
                    onChange={(event) => onChangeCover({ periodStart: asciiDigits(event.target.value) })}
                    className={field}
                    style={{ width: 88, margin: "0 6px", textAlign: "center", fontFamily: "Vazirmatn, Tahoma, sans-serif" }}
                  />
                  {fa ? "تا تاریخ:" : "To:"}
                  <input
                    aria-label={fa ? "تا تاریخ" : "Period end"}
                    value={digits(cover.periodEnd, fa)}
                    onChange={(event) => onChangeCover({ periodEnd: asciiDigits(event.target.value) })}
                    className={field}
                    style={{ width: 88, margin: "0 6px", textAlign: "center", fontFamily: "Vazirmatn, Tahoma, sans-serif" }}
                  />
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 72 }}>
          <div>{fa ? "درصد پیشرفت فیزیکی:" : "Physical progress:"}</div>
          <table style={{ width: "auto", marginTop: 10, marginRight: 28, borderCollapse: "collapse" }}>
            <tbody>
              {phys.map((row) => (
                <tr key={row.key}>
                  <td style={{ whiteSpace: "nowrap", padding: "6px 0 6px 28px", verticalAlign: "middle" }}>{fa ? row.fa : row.en}</td>
                  <td style={{ width: 72, padding: "6px 0", verticalAlign: "middle" }}>
                    <input
                      aria-label={fa ? row.fa : row.en}
                      dir="ltr"
                      value={reportId[row.key]}
                      onChange={(event) => onChange({ [row.key]: event.target.value })}
                      className={field}
                      style={{ width: 72, textAlign: "center" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 64 }}>
          <div>{fa ? "درصد پیشرفت ریالی:" : "Cost progress:"}</div>
          <table style={{ width: "auto", marginTop: 10, marginRight: 28, borderCollapse: "collapse" }}>
            <tbody>
              {cost.map((row) => (
                <tr key={row.key}>
                  <td style={{ whiteSpace: "nowrap", padding: "6px 0 6px 20px", verticalAlign: "middle" }}>{fa ? row.fa : row.en}</td>
                  <td style={{ width: 80, padding: "6px 0", verticalAlign: "middle" }}>
                    <input
                      aria-label={fa ? row.fa : row.en}
                      dir="ltr"
                      value={reportId[row.key]}
                      onChange={(event) => onChange({ [row.key]: event.target.value })}
                      className={field}
                      style={{ width: 80, textAlign: "center" }}
                    />
                  </td>
                  <td style={{ whiteSpace: "nowrap", padding: "6px 8px 6px 0", verticalAlign: "middle" }}>
                    {fa ? "میلیون ریال" : "million Rials"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 80 }}>
          <div>{fa ? "برنامه زمان بندی مبنای گزارش:" : "Baseline schedule:"}</div>
          <div style={{ marginRight: 36, marginTop: 12 }}>
            <input
              aria-label={fa ? "نسخه مبنا" : "Baseline revision"}
              value={reportId.baselineDoc}
              onChange={(event) => onChange({ baselineDoc: event.target.value })}
              className={field}
              style={{ display: "block", width: "92%", textAlign: "start" }}
            />
            <input
              aria-label={fa ? "خط مبنا" : "Baseline"}
              value={reportId.baselineApproved}
              onChange={(event) => onChange({ baselineApproved: event.target.value })}
              className={field}
              style={{ display: "block", width: "92%", marginTop: 6, textAlign: "start" }}
            />
          </div>
        </div>
      </div>
    </MonthlySheet>
  );
}

function MonthlyScopeSheet({
  lang,
  scope,
  onChange,
}: {
  lang: Lang;
  scope: ScopeFields;
  onChange: (patch: Partial<ScopeFields>) => void;
}) {
  const fa = lang === "fa";
  return (
    <MonthlySheet title={fa ? "شرح محدوده پروژه" : "Project scope"} dense>
      <textarea
        aria-label={fa ? "شرح محدوده پروژه" : "Project scope"}
        value={scope.text}
        onChange={(event) => onChange({ text: event.target.value })}
        className="h-full w-full resize-none border-0 bg-white p-3 text-start text-[12.5px] leading-[1.9] text-[#152536] outline-none focus:bg-[#eef4f8]"
      />
    </MonthlySheet>
  );
}

function pctCell(value: number | null | undefined, fa: boolean) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${num(value, fa, 2)}%`;
}

function durationMonths(value: string, fa: boolean) {
  const match = asciiDigits(value).match(/(\d+)/);
  return match ? digits(match[1], fa) : "";
}

function dateOnly(value: string, fa: boolean) {
  const match = asciiDigits(value).match(/(\d{4}[/.]\d{1,2}[/.]\d{1,2})/);
  return match ? digits(match[1], fa) : "";
}

function moneyCell(value: number | null | undefined, fa: boolean) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const formatted = Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return digits(value < 0 ? `-${formatted}` : formatted, fa);
}

function MonthlyOverallProgressSheet({
  cover,
  lang,
  model,
}: {
  cover: CoverFields;
  lang: Lang;
  model?: PexModel;
}) {
  const fa = lang === "fa";
  const headers = fa
    ? [
        "شرح فعالیت",
        "وزن (%)",
        "پیشرفت برنامه ای طی دوره",
        "پیشرفت واقعی طی دوره",
        "پیشرفت برنامه ای تجمعی",
        "پیشرفت واقعی تجمعی",
        "پیشرفت برنامه تجمعی قبل",
        "پیشرفت واقعی تجمعی قبل",
        "انحراف تجمعی",
      ]
    : [
        "Activity",
        "Weight (%)",
        "Planned (period)",
        "Actual (period)",
        "Planned (cum.)",
        "Actual (cum.)",
        "Planned cum. prior",
        "Actual cum. prior",
        "Cum. variance",
      ];
  const wbs = model?.wbsRollup ?? [];
  const costByWbs = new Map<string, number>();
  for (const row of model?.rows ?? []) {
    costByWbs.set(row.wbs, (costByWbs.get(row.wbs) ?? 0) + row.cost);
  }
  const rows = wbs.map((node) => {
    const planned = node.plannedPct;
    const actual = node.actualPct;
    return [
      fa ? node.nameFa : node.nameEn,
      pctCell(node.weight * 100, fa),
      "—",
      "—",
      pctCell(planned, fa),
      pctCell(actual, fa),
      "—",
      "—",
      pctCell(actual - planned, fa),
    ];
  });
  if (model) {
    rows.push([
      fa ? "جمع کل" : "Total",
      pctCell(100, fa),
      "—",
      "—",
      pctCell(model.plannedPct, fa),
      pctCell(model.overallPct, fa),
      "—",
      "—",
      pctCell(model.overallPct - model.plannedPct, fa),
    ]);
  }
  const costHeaders = fa
    ? [
        "شرح فعالیت",
        "وزن (%)",
        "مبلغ کل",
        "برنامه",
        "واقعی",
        "انحراف تجمعی",
        "پیش بینی شده در ماه جاری",
        "اجرا شده در ماه جاری",
        "انحراف تجمعی",
      ]
    : [
        "Activity",
        "Weight (%)",
        "Total amount",
        "Plan",
        "Actual",
        "Cum. variance",
        "Forecast this month",
        "Executed this month",
        "Cum. variance",
      ];
  const costRows = wbs.map((node) => {
    const total = costByWbs.get(node.id) ?? 0;
    const plannedAmt = (total * node.plannedPct) / 100;
    const actualAmt = (total * node.actualPct) / 100;
    return [
      fa ? node.nameFa : node.nameEn,
      pctCell(node.weight * 100, fa),
      moneyCell(total, fa),
      moneyCell(plannedAmt, fa),
      moneyCell(actualAmt, fa),
      moneyCell(actualAmt - plannedAmt, fa),
      "—",
      "—",
      "—",
    ];
  });
  const totalCost = [...costByWbs.values()].reduce((sum, value) => sum + value, 0);
  const plannedTotal = model ? (totalCost * model.plannedPct) / 100 : 0;
  const actualTotal = model ? (totalCost * model.overallPct) / 100 : 0;
  if (model) {
    costRows.push([
      fa ? "جمع کل" : "Total",
      pctCell(100, fa),
      moneyCell(totalCost, fa),
      moneyCell(plannedTotal, fa),
      moneyCell(actualTotal, fa),
      moneyCell(actualTotal - plannedTotal, fa),
      "—",
      "—",
      "—",
    ]);
  }
  const thStyle: CSSProperties = {
    background: "#1f4e79",
    color: "#ffffff",
    border: "1px solid #16375a",
    padding: "6px 3px",
    textAlign: "center",
    verticalAlign: "middle",
    fontWeight: 600,
    lineHeight: 1.25,
    fontSize: 10,
  };
  const tdStyle: CSSProperties = {
    background: "#ffffff",
    border: "1px solid #8aa4bc",
    padding: "4px 3px",
    verticalAlign: "middle",
    fontSize: 9,
  };

  const renderTable = (title: string, cols: string[], body: string[][]) => (
    <table className="w-full table-fixed border-collapse" style={{ marginBottom: 8 }}>
      <thead>
        <tr>
          <th colSpan={cols.length} style={{ ...thStyle, fontSize: 12, padding: "7px 4px" }}>
            {title}
          </th>
        </tr>
        <tr>
          {cols.map((label, index) => (
            <th key={`${title}-${label}-${index}`} style={{ ...thStyle, width: index === 0 ? "18%" : "10.25%" }}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, index) => (
          <tr key={`${title}-${row[0]}-${index}`}>
            {row.map((cell, cellIndex) => (
              <td
                key={`${index}-${cellIndex}`}
                style={{
                  ...tdStyle,
                  textAlign: cellIndex === 0 ? "start" : "center",
                  fontWeight: index === body.length - 1 ? 700 : 400,
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <MonthlySheet title={fa ? "پیشرفت کلی پروژه فیزیکی / ریالی" : "Overall physical / cost progress"} dense>
      <div className="h-full overflow-hidden bg-white font-sans text-[8px] text-[#152536]">
        {renderTable(
          fa ? "پیشرفت کلی - ساختار شکست سطح-۲ فیزیکی" : "Overall progress — WBS level-2 physical",
          headers,
          rows,
        )}
        {renderTable(
          fa ? "پیشرفت کلی - ساختار شکست سطح-۲ ریالی" : "Overall progress — WBS level-2 cost",
          costHeaders,
          costRows,
        )}
        <table className="w-full table-fixed border-collapse" style={{ marginBottom: 8 }}>
          <thead>
            <tr>
              <th colSpan={10} style={{ ...thStyle, fontSize: 12, padding: "7px 4px" }}>
                {fa ? "اقدامات انجام شده طی ماه" : "Actions completed during the month"}
              </th>
            </tr>
            <tr>
              {(fa
                ? ["ردیف", "شرح فعالیت", "واحد", "حجم کل کار", "انجام شده تا دوره قبل", "انجام شده طی دوره", "انجام شده کل"]
                : ["No.", "Activity", "Unit", "Total quantity", "Done before period", "Done this period", "Done total"]
              ).map((label) => (
                <th key={label} rowSpan={2} style={thStyle}>
                  {label}
                </th>
              ))}
              <th colSpan={2} style={thStyle}>
                {fa ? "درصد اجرا شده" : "% complete"}
              </th>
              <th rowSpan={2} style={thStyle}>
                {fa ? "محل اجرا" : "Location"}
              </th>
            </tr>
            <tr>
              <th style={thStyle}>{fa ? "در ماه جاری" : "This month"}</th>
              <th style={thStyle}>{fa ? "تجمعی" : "Cumulative"}</th>
            </tr>
          </thead>
          <tbody>
            {(model?.rows ?? [])
              .filter((item) => !item.isMilestone)
              .map((item, index) => (
                <tr key={item.id}>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{digits(index + 1, fa)}</td>
                  <td style={{ ...tdStyle, textAlign: "start" }}>{fa ? item.nameFa : item.nameEn}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>—</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>—</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>—</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>—</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>—</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>—</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{pctCell(item.physicalPct, fa)}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>—</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
  );
}

function MonthlyFinanceSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const th: CSSProperties = {
    background: "#1f4e79",
    color: "#ffffff",
    border: "1px solid #16375a",
    padding: "5px 2px",
    textAlign: "center",
    verticalAlign: "middle",
    fontWeight: 600,
    fontSize: 9,
    lineHeight: 1.25,
  };
  const td: CSSProperties = {
    background: "#ffffff",
    border: "1px solid #8aa4bc",
    padding: "3px 4px",
    textAlign: "center",
    verticalAlign: "middle",
    fontSize: 10,
  };
  const kinds = fa
    ? ["صورت وضعیت", "تعدیل", "مابه التفاوت مصالح", "کل"]
    : ["IPC", "Adjustment", "Material difference", "Total"];
  const rial = fa ? "— ریال" : "—";
  const letterHead = fa ? (
    <>
      تاریخ ارسال
      <br />
      شماره نامه
    </>
  ) : (
    <>
      Send date
      <br />
      Letter no.
    </>
  );

  return (
    <MonthlySheet title={fa ? "وضعیت مالی" : "Financial status"} dense>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]">
        <table className="h-full w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th colSpan={12} style={{ ...th, fontSize: 13, padding: "8px 4px" }}>
                {fa ? "وضعیت مالی-صورت وضعیت" : "Financial status — IPC"}
              </th>
            </tr>
            <tr>
              <th rowSpan={2} style={{ ...th, width: "4%" }} />
              <th rowSpan={2} style={{ ...th, width: "14%" }}>
                {fa ? "شماره صورت وضعیت" : "IPC no."}
              </th>
              <th rowSpan={2} style={{ ...th, width: "5%" }}>
                {fa ? "از تاریخ" : "From"}
              </th>
              <th rowSpan={2} style={{ ...th, width: "5%" }}>
                {fa ? "تا تاریخ" : "To"}
              </th>
              <th colSpan={3} style={th}>
                {fa ? "ارسالی پیمانکار" : "Contractor submission"}
              </th>
              <th rowSpan={2} style={{ ...th, width: "8%" }}>
                {letterHead}
              </th>
              <th rowSpan={2} style={{ ...th, width: "8%" }}>
                {letterHead}
              </th>
              <th colSpan={2} style={th}>
                {fa ? "تایید شده کارفرما" : "Client approved"}
              </th>
              <th rowSpan={2} style={{ ...th, width: "9%" }}>
                {fa ? "مبلغ پرداختی" : "Paid amount"}
              </th>
            </tr>
            <tr>
              <th style={{ ...th, width: "8%" }}>{letterHead}</th>
              <th style={{ ...th, width: "9%" }}>{fa ? "دوره(ریال)" : "Period"}</th>
              <th style={{ ...th, width: "9%" }}>{fa ? "تجمعی(ریال)" : "Cumulative"}</th>
              <th style={{ ...th, width: "9%" }}>{fa ? "دوره(ریال)" : "Period"}</th>
              <th style={{ ...th, width: "9%" }}>{fa ? "تجمعی(ریال)" : "Cumulative"}</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((group) =>
              kinds.map((kind, index) => {
                const isTotal = index === 3;
                return (
                  <tr key={`${group}-${kind}`}>
                    {index === 0 && (
                      <td rowSpan={4} style={{ ...td, fontWeight: 700, fontSize: 13 }}>
                        {digits(group, fa)}
                      </td>
                    )}
                    <td style={{ ...td, textAlign: "start" }}>{kind}</td>
                    {index === 0 && (
                      <>
                        <td rowSpan={4} style={{ ...td, writingMode: "vertical-rl" }} />
                        <td rowSpan={4} style={{ ...td, writingMode: "vertical-rl" }} />
                      </>
                    )}
                    <td style={td} />
                    <td style={td}>{isTotal ? rial : ""}</td>
                    <td style={td}>{isTotal ? rial : ""}</td>
                    <td style={td} />
                    <td style={td} />
                    <td style={td}>{isTotal ? rial : ""}</td>
                    <td style={td}>{isTotal ? rial : ""}</td>
                    <td style={td}>{isTotal ? rial : ""}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
  );
}

function AnalysisPair({
  label,
  value,
  boxStyle,
  after,
  boxWidth = 96,
  afterWidth,
}: {
  label: string;
  value?: string;
  boxStyle?: CSSProperties;
  after?: string;
  boxWidth?: number;
  afterWidth?: number;
}) {
  const tail = afterWidth ?? (after ? 36 : 0);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>
        <col />
        <col style={{ width: boxWidth }} />
        {tail > 0 ? <col style={{ width: tail }} /> : null}
      </colgroup>
      <tbody>
        <tr>
          <td style={{ color: "#1f4e79", fontSize: 10, lineHeight: 1.35, padding: "5px 6px 5px 0", verticalAlign: "middle" }}>
            {label}
          </td>
          <td style={{ verticalAlign: "middle", padding: 0 }}>
            <span
              style={{
                display: "block",
                width: "100%",
                height: 26,
                border: "1px solid #7a7a7a",
                background: "#fff",
                color: "#c41e3a",
                textAlign: "center",
                lineHeight: "26px",
                fontSize: 11,
                overflow: "hidden",
                ...boxStyle,
              }}
            >
              {value ?? ""}
            </span>
          </td>
          {tail > 0 ? (
            <td style={{ verticalAlign: "middle", whiteSpace: "nowrap", color: "#1f4e79", fontSize: 11, fontWeight: 700, paddingRight: 4 }}>
              {after ?? ""}
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  );
}

function MonthlyTimeAnalysisSheet({
  contract,
  lang,
  model,
}: {
  contract: ContractFields;
  lang: Lang;
  model?: PexModel;
}) {
  const fa = lang === "fa";
  const planned = model?.plannedPct;
  const actual = model?.overallPct;
  const variance = planned !== undefined && actual !== undefined ? actual - planned : undefined;
  const totalDays = model?.project.baselineCpLength;
  let elapsedDays: number | undefined;
  if (model?.project.start && model.dataDate) {
    const start = new Date(`${model.project.start}T00:00:00Z`);
    const dataDate = new Date(`${model.dataDate}T00:00:00Z`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(dataDate.getTime())) {
      elapsedDays = Math.max(0, Math.round((dataDate.getTime() - start.getTime()) / 86_400_000));
    }
  }
  const elapsedPct =
    totalDays && elapsedDays !== undefined && totalDays > 0 ? (elapsedDays / totalDays) * 100 : undefined;
  const show = (value: string | number | undefined | null, kind: "text" | "pct" | "day" = "text") => {
    if (value === undefined || value === null || value === "") return "";
    if (kind === "pct") return pctCell(Number(value), fa);
    if (kind === "day") return digits(value, fa);
    return String(value);
  };
  const varBorder = (value: number | undefined): CSSProperties =>
    value === undefined ? { border: "2px solid #d21f3c" } : { border: `2px solid ${value < 0 ? "#d21f3c" : "#2e7d32"}` };
  const section: CSSProperties = { color: "#1f4e79", fontSize: 12, fontWeight: 700, padding: "8px 4px 6px", textAlign: "start" };
  const navy: CSSProperties = { color: "#1f4e79" };
  const identity = [
    [
      { label: fa ? "شماره قرارداد :" : "Contract no.:", value: contract.contractNo },
      { label: fa ? "مبلغ اولیه پیمان :" : "Initial amount:", value: contract.amount.replace(/ریال/g, "").trim(), after: fa ? "ریال" : "" },
    ],
    [
      { label: fa ? "تاریخ انعقاد قرارداد :" : "Contract date:", value: dateOnly(contract.startDate, fa) },
      { label: fa ? "مبلغ ثانویه پیمان :" : "Revised amount:", value: "", after: fa ? "ریال" : "" },
    ],
    [
      { label: fa ? "مدت اولیه پیمان :" : "Initial duration:", value: durationMonths(contract.duration, fa) },
      { label: fa ? "مدت پیمان :" : "Duration:", value: durationMonths(contract.duration, fa) },
    ],
    [
      { label: fa ? "مدت ثانویه پیمان :" : "Revised duration:", value: contract.extension === "----" ? "" : contract.extension },
      { label: fa ? "ضریب پیمان :" : "Coefficient:", value: contract.bidCoefficient },
    ],
  ];
  const progress = [
    [
      { label: fa ? "پیشرفت برنامه ای/تجمعی تا دوره قبل:" : "Planned cum. prior:", value: "", box: navy },
      { label: fa ? "پیشرفت برنامه ای/تجمعی تاکنون:" : "Planned cum. to date:", value: show(planned, "pct"), box: navy },
      { label: fa ? "پیشرفت برنامه ای - این دوره :" : "Planned this period:", value: "", box: navy },
      { label: fa ? "زمان کل پروژه - روز :" : "Total duration — days:", value: show(totalDays, "day"), box: navy },
    ],
    [
      { label: fa ? "پیشرفت واقعی/تجمعی تا دوره قبل:" : "Actual cum. prior:", value: "", box: navy },
      { label: fa ? "پیشرفت واقعی/تجمعی تاکنون:" : "Actual cum. to date:", value: show(actual, "pct"), box: navy },
      { label: fa ? "پیشرفت واقعی - این دوره :" : "Actual this period:", value: "", box: navy },
      { label: fa ? "زمان سپری شده - روز :" : "Elapsed — days:", value: show(elapsedDays, "day"), box: navy },
    ],
    [
      { label: fa ? "میزان انحراف/تجمعی تا دوره قبل:" : "Variance cum. prior:", value: "", box: varBorder(undefined) },
      { label: fa ? "میزان انحراف/تجمعی تاکنون:" : "Variance cum. to date:", value: show(variance, "pct"), box: { ...navy, ...varBorder(variance) } },
      { label: fa ? "میزان انحراف - این دوره :" : "Variance this period:", value: "", box: varBorder(undefined) },
      { label: fa ? "درصد زمان سپری شده :" : "% time elapsed:", value: show(elapsedPct, "pct"), box: { ...navy, border: "2px solid #2e7d32" } },
    ],
  ];

  return (
    <MonthlySheet title={fa ? "گزارش تحلیلی مدیریت زمان" : "Time-management analysis report"} dense>
      <div className="h-full overflow-hidden bg-white px-[1%] pt-[1%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#1f4e79", color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 12, padding: "7px 4px" }}>
          {fa ? "گزارش مدیریت زمان" : "Time management report"}
        </div>

        <div style={section}>{fa ? "مشخصات کلی و دامنه کار پروژه" : "Project particulars and scope"}</div>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            {identity.map((row, index) => (
              <tr key={index}>
                {row.map((item) => (
                  <td key={item.label} style={{ width: "50%", padding: "2px 6px", verticalAlign: "middle" }}>
                    <AnalysisPair label={item.label} value={item.value} after={"after" in item ? item.after : undefined} boxWidth={150} afterWidth={40} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: "1px solid #c5c5c5", marginTop: 10 }} />
        <div style={section}>{fa ? "وضعیت پیشرفت فیزیکی پروژه" : "Physical progress status"}</div>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            {progress.map((row, index) => (
              <tr key={index}>
                {row.map((item) => (
                  <td key={item.label} style={{ width: "25%", padding: "2px 4px", verticalAlign: "middle" }}>
                    <AnalysisPair label={item.label} value={item.value} boxStyle={item.box} boxWidth={68} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: "1px solid #c5c5c5", marginTop: 10 }} />
        <div style={section}>{fa ? "وضعیت مالی پروژه- آخرین وضعیت" : "Project financial status — latest"}</div>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            <tr>
              <td style={{ width: "42%", padding: "2px 4px" }}>
                <AnalysisPair label={fa ? "رقم تایید شده صورت وضعیت تجمعی موقت شماره ... :" : "Approved IPC cum. no. …:"} value="" after={fa ? "ریال" : ""} boxStyle={navy} boxWidth={88} />
              </td>
              <td style={{ width: "36%", padding: "2px 4px" }}>
                <AnalysisPair label={fa ? "پیشرفت ریالی طبق برنامه زمانبندی :" : "Cost progress vs schedule:"} value={show(planned, "pct")} after="PV" boxStyle={navy} boxWidth={64} />
              </td>
              <td style={{ width: "22%", padding: "2px 4px" }}>
                <AnalysisPair label={fa ? "میزان انحراف" : "Variance"} value={show(variance, "pct")} after="CV" boxStyle={{ ...navy, background: "#fff3a1" }} boxWidth={64} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "2px 4px" }}>
                <AnalysisPair label={fa ? "رقم تایید شده تعدیل تجمعی موقت شماره ... :" : "Approved adjustment cum. no. …:"} value="" after={fa ? "ریال" : ""} boxStyle={navy} boxWidth={88} />
              </td>
              <td style={{ padding: "2px 4px" }}>
                <AnalysisPair label={fa ? "پیشرفت ریالی طبق صورت وضعیت :" : "Cost progress vs IPC:"} value="" after="AC" boxStyle={navy} boxWidth={64} />
              </td>
              <td style={{ padding: "2px 4px" }}>
                <AnalysisPair label={fa ? "شاخص عملکرد زمانی" : "Schedule performance"} value="" after="SPI" boxStyle={{ ...navy, background: "#fff3a1" }} boxWidth={64} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "2px 4px" }}>
                <AnalysisPair label={fa ? "رقم تایید شده مابه التفاوت تجمعی موقت شماره ... :" : "Approved material difference cum. no. …:"} value="" after={fa ? "ریال" : ""} boxStyle={navy} boxWidth={88} />
              </td>
              <td style={{ padding: "2px 4px" }}>
                <AnalysisPair label={fa ? "پیشرفت ریالی طبق آخرین پرداخت :" : "Cost progress vs last payment:"} value="" after="EV" boxStyle={navy} boxWidth={64} />
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        <EvmChartBlock lang={lang} model={model} />
      </div>
    </MonthlySheet>
  );
}

function EvmChartBlock({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const months = fa ? JALALI_MONTHS_FA : JALALI_MONTHS_EN;
  const bac = (model?.rows ?? []).reduce((sum, row) => sum + row.cost, 0);
  const pv = model ? (bac * model.plannedPct) / 100 : undefined;
  const ev = model ? (bac * model.overallPct) / 100 : undefined;
  const cv = ev !== undefined && pv !== undefined ? ev - pv : undefined;
  const spi = model && model.plannedPct > 0 ? model.overallPct / model.plannedPct : undefined;
  const dataDate = model?.dataDate ?? "";
  let currentMonth = -1;
  if (dataDate) {
    const date = new Date(`${dataDate}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      currentMonth = toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()).jm - 1;
    }
  }
  const series = months.map((_, index) => (index === currentMonth && spi !== undefined ? Math.round(spi * 100) / 100 : 0));
  const yMax = 5;
  const yMin = -20;
  const plot = { left: 48, top: 10, width: 640, height: 340 };
  const viewH = plot.top + plot.height + 16;
  const yToSvg = (value: number) => plot.top + ((yMax - value) / (yMax - yMin)) * plot.height;
  const zeroY = yToSvg(0);
  const barW = plot.width / series.length;
  const ticks = [5, 0, -5, -10, -15, -20];

  const kpi = [
    { code: "EV", value: ev },
    { code: "PV", value: pv },
    { code: "CV", value: cv },
  ];

  return (
    <div style={{ marginTop: 8, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ color: "#1f4e79", fontSize: 12, fontWeight: 700, textAlign: "start", marginBottom: 6 }}>
          {fa ? "نمودار ارزش کسب شده" : "Earned value chart"}
        </div>
        <table style={{ marginBottom: 6, marginRight: "auto", flexShrink: 0 }}>
          <tbody>
            <tr>
              {kpi.map((item) => (
                <td key={item.code} style={{ padding: "0 18px", verticalAlign: "middle" }}>
                  <span style={{ color: "#1f4e79", fontWeight: 700, marginInlineEnd: 8 }}>{item.code}</span>
                  <span
                    style={{
                      display: "inline-block",
                      minWidth: 88,
                      height: 28,
                      lineHeight: "28px",
                      textAlign: "center",
                      background: "#fff3a1",
                      border: "1px solid #d6c56a",
                      color: "#8b1e2d",
                      fontSize: 12,
                    }}
                  >
                    {item.value === undefined ? "" : moneyCell(item.value, fa)}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <svg viewBox={`0 0 720 ${viewH}`} className="w-full" style={{ flex: 1, minHeight: 0, display: "block" }} preserveAspectRatio="none" role="img" aria-label="SPI">
          {ticks.map((tick) => {
            const y = yToSvg(tick);
            return (
              <g key={tick}>
                <line x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} stroke="#d9d9d9" strokeWidth="1" />
                <text x={plot.left - 8} y={y + 4} textAnchor="end" fill="#666" fontSize="11" fontFamily="Vazirmatn, Tahoma, sans-serif">
                  {tick}
                  {tick === 5 || tick === -20 ? "'" : ""}
                </text>
              </g>
            );
          })}
          <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} fill="none" stroke="#bdbdbd" />
          {series.map((value, index) => {
            const x = plot.left + index * barW + barW * 0.28;
            const h = Math.abs(yToSvg(value) - zeroY);
            const y = value >= 0 ? yToSvg(value) : zeroY;
            return (
              <g key={months[index]}>
                <rect x={x} y={y} width={barW * 0.44} height={Math.max(h, value === 0 ? 3 : 0)} fill={value > 0 ? "#3d6fd4" : "#cfcfcf"} />
                <text
                  x={plot.left + index * barW + barW / 2}
                  y={plot.top + plot.height + 13}
                  textAnchor="middle"
                  fill="#333"
                  fontSize="9"
                  fontFamily="Vazirmatn, Tahoma, sans-serif"
                >
                  {months[index]}
                </text>
              </g>
            );
          })}
          <text x={plot.left + plot.width / 2} y={zeroY + 48} textAnchor="middle" fill="#111" fontSize="14" fontFamily="Vazirmatn, Tahoma, sans-serif">
            SPI
          </text>
        </svg>
        <table className="w-full table-fixed border-collapse" style={{ fontSize: 10, flexShrink: 0, marginTop: 0 }}>
          <tbody>
            <tr>
              <td style={{ width: 36, border: "1px solid #bbb", background: "#3d6fd4", color: "#fff", textAlign: "center" }}>SPI</td>
              {series.map((value, index) => (
                <td key={months[index]} style={{ border: "1px solid #bbb", textAlign: "center" }}>
                  {digits(value.toFixed(1), fa)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
    </div>
  );
}

function MonthlyDelayAnalysisSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const series = (model?.wbsRollup ?? []).map((node) => ({
    name: fa ? node.nameFa : node.nameEn,
    planned: node.plannedPct,
    actual: node.actualPct,
    variance: node.actualPct - node.plannedPct,
  }));
  const rowMeta = [
    { key: "planned" as const, fa: "پیشرفت فیزیکی تجمعی برنامه ای", en: "Cumulative planned physical progress", fill: "#ffffff" },
    { key: "actual" as const, fa: "پیشرفت فیزیکی تجمعی واقعی ( Cum %Act )", en: "Cumulative actual physical (Cum %Act)", fill: "#fff200" },
    { key: "variance" as const, fa: "انحراف تجمعی ( Cum S )", en: "Cumulative variance (Cum S)", fill: "#6c63ff" },
  ];
  const colors = { planned: "#c45c1a", actual: "#7db83a", variance: "#00b0f0" };
  const yMax = 125;
  const yMin = -155;
  const plot = { left: 18, top: 10, width: 924, height: 530 };
  const yToSvg = (value: number) => plot.top + ((yMax - value) / (yMax - yMin)) * plot.height;
  const zeroY = yToSvg(0);
  const groupW = series.length ? plot.width / series.length : plot.width;
  const barW = Math.min(36, groupW * 0.18);
  const th: CSSProperties = {
    background: "#1f4e79",
    color: "#fff",
    border: "1px solid #16375a",
    padding: "7px 4px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 12,
  };
  const colTh: CSSProperties = {
    background: "#d9d9d9",
    color: "#152536",
    border: "1px solid #9aa3ad",
    padding: "8px 4px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 11,
  };
  const td: CSSProperties = {
    border: "1px solid #9aa3ad",
    padding: "6px 4px",
    textAlign: "center",
    fontSize: 11,
  };

  return (
    <MonthlySheet title={fa ? "آنالیز تأخیر و انحراف پروژه" : "Delay and variance analysis"} dense>
      <div className="h-full overflow-hidden bg-white px-[1.2%] pt-[1%] pb-[1%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", border: "2px solid #1f4e79" }}>
          <table className="w-full table-fixed border-collapse" style={{ flexShrink: 0 }}>
            <thead>
              <tr>
                <th colSpan={series.length + 1} style={th}>
                  Physical S-Curve
                </th>
              </tr>
              <tr>
                <th style={{ ...colTh, width: "26%", textAlign: "center" }}>{fa ? "توضیحات" : "Description"}</th>
                {series.map((item) => (
                  <th key={item.name} style={colTh}>
                    {item.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowMeta.map((row) => (
                <tr key={row.key}>
                  <td style={{ ...td, textAlign: "start", background: row.fill, fontWeight: 700 }}>{fa ? row.fa : row.en}</td>
                  {series.map((item) => (
                    <td key={`${row.key}-${item.name}`} style={{ ...td, background: row.fill, fontWeight: 600 }}>
                      {pctCell(item[row.key], fa)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <svg viewBox="0 0 960 560" className="w-full" style={{ flex: 1, minHeight: 0, display: "block", background: "#fff" }} preserveAspectRatio="xMidYMid meet" direction="ltr" role="img" aria-label="Physical S-Curve">
            <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} fill="#fff" />
            {[100, 50, 0, -50, -100].map((tick) => (
              <line key={tick} x1={plot.left} y1={yToSvg(tick)} x2={plot.left + plot.width} y2={yToSvg(tick)} stroke="#d0d0d0" strokeWidth="1" />
            ))}
            {series.map((item, index) => {
              const gx = plot.left + index * groupW + groupW / 2;
              const bars = [
                { key: "planned" as const, value: item.planned },
                { key: "actual" as const, value: item.actual },
                { key: "variance" as const, value: item.variance },
              ];
              return (
                <g key={item.name}>
                  {bars.map((bar, barIndex) => {
                    const x = gx - (barW * 3 + 8) / 2 + barIndex * (barW + 4);
                    const h = Math.abs(yToSvg(bar.value) - zeroY);
                    if (h < 0.5) {
                      return (
                        <text key={bar.key} x={x + barW / 2} y={zeroY - 6} textAnchor="middle" fill="#333" fontSize="10" fontFamily="Vazirmatn, Tahoma, sans-serif">
                          {pctCell(bar.value, fa)}
                        </text>
                      );
                    }
                    const y = bar.value >= 0 ? yToSvg(bar.value) : zeroY;
                    const labelY = bar.value >= 0 ? y - 5 : y + h + 12;
                    return (
                      <g key={bar.key}>
                        <rect x={x} y={y} width={barW} height={h} fill={colors[bar.key]} />
                        <text
                          x={x + barW / 2}
                          y={labelY}
                          textAnchor="middle"
                          fill={bar.key === "variance" && bar.value < 0 ? "#c62828" : "#222"}
                          fontSize="10"
                          fontFamily="Vazirmatn, Tahoma, sans-serif"
                        >
                          {pctCell(bar.value, fa)}
                        </text>
                      </g>
                    );
                  })}
                  <text x={gx} y={zeroY + 16} textAnchor="middle" fill="#111" fontSize="12" fontFamily="Vazirmatn, Tahoma, sans-serif">
                    {item.name}
                  </text>
                </g>
              );
            })}
            <rect x={688} y={16} width={250} height={62} fill="#d8f6fb" />
            {[
              { color: colors.planned, fa: "پیشرفت فیزیکی تجمعی برنامه ای", en: "Cumulative planned physical" },
              { color: colors.actual, fa: "پیشرفت فیزیکی تجمعی واقعی (Cum %Act)", en: "Cumulative actual (Cum %Act)" },
              { color: colors.variance, fa: "انحراف تجمعی (Cum S)", en: "Cumulative variance (Cum S)" },
            ].map((item, index) => (
              <g key={item.en}>
                <rect x={700} y={26 + index * 17} width="11" height="11" fill={item.color} />
                <text x={718} y={35 + index * 17} fill="#1a3a4a" fontSize="10" fontFamily="Vazirmatn, Tahoma, sans-serif">
                  {fa ? item.fa : item.en}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </MonthlySheet>
  );
}

function MonthlyRootCauseSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const wbsName = new Map((model?.wbsRollup ?? []).map((node) => [node.id, fa ? node.nameFa : node.nameEn]));
  const delayed = (model?.rows ?? [])
    .filter((row) => {
      if (row.isMilestone) return false;
      const behind = row.physicalPct < row.plannedPct;
      const lateFinish = Boolean(row.baselineFinish && model && row.baselineFinish < model.dataDate && row.physicalPct < 100);
      return behind || lateFinish || row.totalFloat < 0;
    })
    .map((row) => {
      let days: number | undefined;
      if (row.totalFloat < 0) days = Math.abs(row.totalFloat);
      else if (row.baselineFinish && row.ef > row.baselineFinish) {
        const start = new Date(`${row.baselineFinish}T00:00:00Z`);
        const end = new Date(`${row.ef}T00:00:00Z`);
        const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
        if (diff > 0) days = diff;
      }
      return {
        activity: fa ? row.nameFa : row.nameEn,
        section: wbsName.get(row.wbs) ?? "",
        days,
      };
    })
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
  const slots = 20;
  const headers = fa
    ? ["ردیف", "فعالیت تاخیر", "کد تاخیر", "بخش", "میزان تاخیر", "شرح علت انحراف"]
    : ["No.", "Delayed activity", "Delay code", "Area", "Delay amount", "Root-cause description"];
  const th: CSSProperties = {
    background: "#d9d9d9",
    color: "#152536",
    border: "1px solid #9aa3ad",
    padding: "8px 4px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 11,
  };
  const td: CSSProperties = {
    border: "1px solid #9aa3ad",
    padding: "4px 6px",
    fontSize: 10,
    background: "#fff",
    verticalAlign: "middle",
  };
  const widths = ["8%", "22%", "12%", "18%", "12%", "28%"];

  return (
    <MonthlySheet title={fa ? "علل ریشه‌ای انحرافات و دلائل تأخیرات" : "Root-cause of deviations and delay reasons"} dense>
      <div className="h-full overflow-hidden bg-white px-[1.2%] pt-[1.4%] pb-[1.2%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <table className="w-full border-collapse" style={{ flex: 1, height: "100%", tableLayout: "fixed" }}>
          <thead>
            <tr>
              {headers.map((label, index) => (
                <th key={label} style={{ ...th, width: widths[index] }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: slots }, (_, index) => {
              const row = delayed[index];
              const cells = [
                digits(index + 1, fa),
                row?.activity ?? "",
                "",
                row?.section ?? "",
                row?.days !== undefined ? `${digits(row.days, fa)} ${fa ? "روز" : "days"}` : "",
                "",
              ];
              return (
                <tr key={index}>
                  {cells.map((cell, cellIndex) => (
                    <td key={cellIndex} style={{ ...td, textAlign: cellIndex === 1 || cellIndex === 5 ? "start" : "center" }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
  );
}

function MonthlyUpdatedScheduleSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  return (
    <MonthlySheet title={fa ? "برنامه زمان‌بندی به‌روز شده و متأثر از تأخیرات" : "Updated schedule affected by delays"} dense>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#1f4e79", color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 13, padding: "8px 4px", flexShrink: 0 }}>
          MS.Project
        </div>
        <div style={{ flex: 1, background: "#fff" }} />
      </div>
    </MonthlySheet>
  );
}

function MonthlyActionPlanSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  return (
    <MonthlySheet title={fa ? "Action Plan (۳۰ روزه)" : "Action Plan (30-day)"} dense>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#1f4e79", color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 13, padding: "8px 4px", flexShrink: 0 }}>
          Action Plan
        </div>
        <div style={{ flex: 1, background: "#fff" }} />
      </div>
    </MonthlySheet>
  );
}

function pmsDate(iso: string | undefined, fa: boolean) {
  return iso ? digits(isoToJalali(iso), fa) : "";
}

const MDR_DOC_GROUPS = [
  { id: "dd-review", fa: "بررسی و صحه گذاری طراحی تفصیلی", en: "Detail design review and verification" },
  { id: "dd-eng", fa: "خدمات مهندسی و تکمیل طراحی تفصیلی", en: "Engineering services and detail design completion" },
  { id: "proc-eng", fa: "خدمات مهندسی خرید کالا", en: "Procurement engineering services" },
  { id: "asbuilt", fa: "ازبیلت شده", en: "As-built" },
];

const MDR_STATUS_KEYS = ["A", "AN", "AFC", "C", "NC", "R"] as const;
type MdrStatus = (typeof MDR_STATUS_KEYS)[number];

/** ردیف‌های MDR — منبع واحد جدول بالا و خلاصهٔ E-Chart. ثبت مدرک هنوز در موتور نیست. */
function mdrDocuments(_model?: PexModel): { group: string; status?: MdrStatus; produced: boolean }[] {
  return [];
}

function mdrDocumentSummary(model?: PexModel) {
  const docs = mdrDocuments(model);
  const counts = MDR_STATUS_KEYS.map((key) => docs.filter((row) => row.status === key).length);
  const statusTotal = counts.reduce((sum, n) => sum + n, 0);
  const total = docs.length;
  const issued = docs.filter((row) => row.produced || row.status).length;
  const remain = Math.max(0, total - issued);
  const groups = MDR_DOC_GROUPS.map((item) => {
    const rows = docs.filter((row) => row.group === item.id);
    return { ...item, total: rows.length, produced: rows.filter((row) => row.produced).length };
  });
  return {
    groups,
    produced: groups.reduce((sum, item) => sum + item.produced, 0),
    total,
    issued,
    remain,
    counts,
    statusTotal,
    percents: counts.map((n) => (statusTotal > 0 ? (n / statusTotal) * 100 : 0)),
  };
}

function MonthlyEngineeringProgressSheet({ lang, model, kind }: { lang: Lang; model?: PexModel; kind: "mdr" | "ddr" }) {
  const fa = lang === "fa";
  const node = model?.wbsRollup.find((item) => item.id === "1");
  const empty = Array.from({ length: 14 }, () => null);
  const rotate: CSSProperties = {
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    whiteSpace: "nowrap",
    fontSize: 7,
    fontWeight: 700,
    padding: "6px 2px",
  };
  const th: CSSProperties = {
    background: "#d9d9d9",
    color: "#152536",
    border: "1px solid #9aa3ad",
    padding: "3px 2px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 7,
    lineHeight: 1.15,
    verticalAlign: "middle",
  };
  const td: CSSProperties = {
    border: "1px solid #9aa3ad",
    padding: "2px 3px",
    fontSize: 7.5,
    textAlign: "center",
    background: "#fff",
    height: 18,
  };
  const idHeaders = ["Project Code", "Client", "Sender", "Discipline", "Doc Type", "Serial No."];
  const band: CSSProperties = { ...td, background: "#b7c4d0", fontWeight: 700, textAlign: "start" };

  const title = kind === "mdr"
    ? (fa ? "گزارش پیشرفت Engineering — MDR" : "Engineering progress — MDR")
    : (fa ? "گزارش پیشرفت Engineering — DDR" : "Engineering progress — DDR");

  return (
    <MonthlySheet title={title} dense landscape dir="ltr">
      <div className="h-full overflow-auto bg-white px-[0.5%] pt-[0.6%] pb-[0.5%] font-sans text-[#152536]">
        {kind === "mdr" ? (
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 900, height: "100%" }}>
          <thead>
            <tr>
              {idHeaders.map((label) => (
                <th key={label} rowSpan={2} style={{ ...th, ...rotate, width: "2.2%" }}>{label}</th>
              ))}
              <th rowSpan={2} style={{ ...th, width: "11%" }}>Document No.</th>
              <th rowSpan={2} style={{ ...th, width: "16%" }}>Document Title</th>
              <th rowSpan={2} style={{ ...th, ...rotate, width: "2.4%" }}>REV 01 &amp; 02</th>
              <th colSpan={3} style={th}>Weight Factor</th>
              <th rowSpan={2} style={{ ...th, ...rotate, width: "2.4%" }}>Latest Status</th>
              <th style={th}>70%</th>
              <th style={th}>5%</th>
              <th style={th}>10%</th>
              <th style={th}>10%</th>
              <th style={th}>5%</th>
              <th rowSpan={2} style={{ ...th, ...rotate, width: "2.4%" }}>Cumulative</th>
              <th rowSpan={2} style={th}>Last Cumulative Progress (%)</th>
              <th rowSpan={2} style={th}>This Cumulative Progress (%)</th>
              <th rowSpan={2} style={th}>Cumulative Progress (%)</th>
            </tr>
            <tr>
              <th style={th}>WP (%)</th>
              <th style={th}>WP (%)</th>
              <th style={th}>WP (%)</th>
              <th style={th}>1st issue</th>
              <th style={th}>CM</th>
              <th style={th}>AN</th>
              <th style={th}>AP</th>
              <th style={th}>AFC / FIN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={8} style={band}>ENGINEERING</td>
              <td style={{ ...td, background: "#b7c4d0" }} />
              <td colSpan={3} style={{ ...td, background: "#b7c4d0", fontWeight: 700 }}>{pctCell(100, fa)}</td>
              <td colSpan={6} style={{ ...td, background: "#b7c4d0" }} />
              <td style={{ ...td, background: "#b7c4d0" }} />
              <td style={{ ...td, background: "#b7c4d0" }}>{node ? "—" : ""}</td>
              <td style={{ ...td, background: "#b7c4d0" }}>{node ? "—" : ""}</td>
              <td style={{ ...td, background: "#b7c4d0", fontWeight: 700 }}>{node ? pctCell(node.actualPct, fa) : ""}</td>
            </tr>
            {empty.map((_, index) => (
              <tr key={`mdr-${index}`}>
                {Array.from({ length: 22 }, (_, cell) => (
                  <td key={cell} style={td} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        ) : (
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 900, height: "100%" }}>
          <thead>
            <tr>
              <th rowSpan={3} style={{ ...th, ...rotate, width: "3%" }}>Project Code</th>
              <th rowSpan={3} style={{ ...th, width: "14%" }}>Document No.</th>
              <th rowSpan={3} style={{ ...th, width: "28%" }}>Document Title</th>
              <th rowSpan={3} style={th}>Discipline level 1</th>
              <th rowSpan={3} style={th}>Discipline level 2</th>
              <th colSpan={2} style={th}>Weight Factor</th>
              <th style={th}>70%</th>
              <th style={th}>5%</th>
              <th style={th}>10%</th>
              <th style={th}>10%</th>
              <th style={th}>5%</th>
              <th rowSpan={3} style={th}>Cumulative Progress (%)</th>
            </tr>
            <tr>
              <th rowSpan={2} style={{ ...th, ...rotate }}>WP (%)</th>
              <th rowSpan={2} style={{ ...th, ...rotate }}>WP (%)</th>
              <th style={th}>1st issue</th>
              <th style={th}>CM</th>
              <th style={th}>AN</th>
              <th style={th}>AP</th>
              <th style={th}>AFC / FIN</th>
            </tr>
            <tr>
              <th colSpan={5} style={th}>Cumulative Progress (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} style={band}>ENGINEERING</td>
              {Array.from({ length: 7 }, (_, cell) => (
                <td key={cell} style={{ ...td, background: "#b7c4d0" }} />
              ))}
              <td style={{ ...td, background: "#b7c4d0", fontWeight: 700 }}>{node ? pctCell(node.actualPct, fa) : ""}</td>
            </tr>
            {empty.map((_, index) => (
              <tr key={`ddr-${index}`}>
                {Array.from({ length: 13 }, (_, cell) => (
                  <td key={cell} style={td} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </MonthlySheet>
  );
}

function MonthlyEngineeringStatusSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const node = model?.wbsRollup.find((item) => item.id === "1");
  const statuses = [
    { key: "A", label: "A\n(Approved)", color: "#5a3a12", text: "#fff" },
    { key: "AN", label: "AN\n(Approved as Noted)", color: "#f3b36a", text: "#111" },
    { key: "AFC", label: "AFC\n(Approved For Construction)", color: "#3cff2a", text: "#111" },
    { key: "C", label: "C\n(Commented)", color: "#1c2cff", text: "#fff" },
    { key: "NC", label: "NC\n(No Comment)", color: "#ff4dff", text: "#111" },
    { key: "R", label: "R\n(Rejected)", color: "#ffe600", text: "#111" },
  ];
  const mdr = mdrDocumentSummary(model);
  const counts = mdr.counts;
  const issued = mdr.issued;
  const total = mdr.total;
  const remain = mdr.remain;
  const statusTotal = mdr.statusTotal;
  const percents = mdr.percents;
  const sum = statusTotal;
  const th: CSSProperties = {
    border: "2px solid #111",
    padding: "8px 4px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 10,
    lineHeight: 1.2,
    verticalAlign: "middle",
    whiteSpace: "pre-line",
  };
  const td: CSSProperties = {
    border: "2px solid #111",
    padding: "7px 4px",
    textAlign: "center",
    fontSize: 12,
    background: "#c6d36e",
    verticalAlign: "middle",
  };
  const cx = 280;
  const cy = 240;
  const r = 205;
  const pie = sum > 0
    ? percents.reduce<{ d: string; color: string; start: number; mid: number }[]>((acc, pct, index) => {
        const start = acc.length ? acc[acc.length - 1].start + (percents[index - 1] / 100) * 2 * Math.PI : -Math.PI / 2;
        const sweep = (pct / 100) * 2 * Math.PI;
        const end = start + sweep;
        const x1 = cx + r * Math.cos(start);
        const y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end);
        const y2 = cy + r * Math.sin(end);
        const large = sweep > Math.PI ? 1 : 0;
        acc.push({
          d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
          color: statuses[index].color,
          start,
          mid: start + sweep / 2,
        });
        return acc;
      }, [])
    : [];

  return (
    <MonthlySheet title="E - Chart" dense landscape dir="ltr">
      <div className="h-full overflow-hidden bg-white px-[0.8%] pt-[0.8%] pb-[0.6%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", flexShrink: 0 }}>
          <thead>
            <tr>
              <th style={{ ...th, background: "#d9d9d9", width: "8%" }}>WBS</th>
              <th style={{ ...th, background: "#d9d9d9", width: "24%" }}>Task Name</th>
              {["Total", "Issued", "Remain"].map((label) => (
                <th key={label} style={{ ...th, background: "#2a4d7a", color: "#fff", width: "6%" }}>{label}</th>
              ))}
              {statuses.map((item) => (
                <th key={item.key} style={{ ...th, background: item.color, color: item.text, width: "7.5%" }}>{item.label}</th>
              ))}
              <th style={{ ...th, background: "#e10600", color: "#fff", width: "7%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowSpan={2} style={{ ...td, fontWeight: 700 }}>{node ? node.id : ""}</td>
              <td rowSpan={2} style={{ ...td, fontWeight: 700 }}>ENGINEERING</td>
              <td rowSpan={2} style={{ ...td, fontWeight: 700 }}>{digits(total, fa)}</td>
              <td rowSpan={2} style={{ ...td, fontWeight: 700 }}>{digits(issued, fa)}</td>
              <td rowSpan={2} style={{ ...td, fontWeight: 700 }}>{digits(remain, fa)}</td>
              {counts.map((n, i) => (
                <td key={`s-${i}`} style={{ ...td, fontWeight: 700 }}>{digits(n, fa)}</td>
              ))}
              <td style={{ ...td, fontWeight: 700 }}>{digits(statusTotal, fa)}</td>
            </tr>
            <tr>
              {percents.map((pct, i) => (
                <td key={`pp-${i}`} style={{ ...td, fontWeight: 700 }}>{pctCell(pct, fa)}</td>
              ))}
              <td style={{ ...td, fontWeight: 700 }}>{pctCell(statusTotal > 0 ? 100 : 0, fa)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ flex: 1, minHeight: 0, background: "#d4d4d4", border: "1px solid #111", display: "flex" }}>
          <div style={{ flex: 1.7, minWidth: 0, minHeight: 0 }}>
          <svg viewBox="0 0 560 480" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            {pie.length ? (
              pie.map((slice, index) => <path key={statuses[index].key} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth="1" />)
            ) : (
              <circle cx={cx} cy={cy} r={r} fill="#f3f3f3" stroke="#c8c8c8" />
            )}
            {statuses.map((item, index) => {
              const places = [
                { x: 390, y: 70 },
                { x: 330, y: 400 },
                { x: 8, y: 370 },
                { x: 8, y: 110 },
                { x: 8, y: 18 },
                { x: 300, y: 12 },
              ];
              const p = places[index];
              return (
                <g key={item.key}>
                  <rect x={p.x} y={p.y} width={160} height={44} fill={item.color} />
                  <text x={p.x + 80} y={p.y + 18} textAnchor="middle" fill={item.text} fontSize="11" fontFamily="Vazirmatn, Tahoma, sans-serif">
                    {item.key} {item.label.split("\n")[1]}
                  </text>
                  <text x={p.x + 80} y={p.y + 36} textAnchor="middle" fill={item.text} fontSize="12" fontWeight="700" fontFamily="Vazirmatn, Tahoma, sans-serif">
                    {sum > 0 ? pctCell(percents[index], fa) : ""}
                  </text>
                </g>
              );
            })}
          </svg>
          </div>
          <div dir="rtl" style={{ width: "30%", padding: "14px 18px 10px 8px", fontSize: 12, lineHeight: 1.95, color: "#111", textAlign: "right" }}>
            <div>
              از ابتدای پروژه تا کنون {digits(mdr.produced, fa)} مدرک تولید شده است که شامل :
            </div>
            {mdr.groups.map((item) => (
              <div key={item.id}>
                * از {digits(item.total, fa)} مدرک {item.fa} – {digits(item.produced, fa)} مدرک تولید شده است
              </div>
            ))}
          </div>
        </div>
      </div>
    </MonthlySheet>
  );
}

function MonthlyPmsProgressSheet({ lang, model, wbsId }: { lang: Lang; model?: PexModel; wbsId: string; }) {
  const fa = lang === "fa";
  const titles: Record<string, { fa: string; en: string }> = {
    "2": { fa: "گزارش پیشرفت (در بخش Procurement)", en: "Progress report (Procurement)" },
    "3": { fa: "گزارش پیشرفت (در بخش Construction)", en: "Progress report (Construction)" },
  };
  const node = model?.wbsRollup.find((item) => item.id === wbsId);
  const kids = (model?.rows ?? []).filter((row) => row.wbs === wbsId && !row.isMilestone);
  const isoMin = (values: (string | undefined)[]) => values.filter((v): v is string => Boolean(v)).sort()[0] ?? "";
  const isoMax = (values: (string | undefined)[]) => values.filter((v): v is string => Boolean(v)).sort().at(-1) ?? "";
  type PmsLine = {
    id: string;
    level: number;
    name: string;
    cost: number;
    wv: number;
    wf: number;
    duration: number | "";
    start: string;
    finish: string;
    actualStart: string;
    actualFinish: string;
    planned: number;
    actual: number;
    bold: boolean;
  };
  const lines: PmsLine[] = [];
  if (node) {
    const allDone = kids.length > 0 && kids.every((row) => row.physicalPct >= 100);
    lines.push({
      id: wbsId,
      level: 2,
      name: fa ? node.nameFa : node.nameEn,
      cost: kids.reduce((sum, row) => sum + row.cost, 0),
      wv: node.weight * 100,
      wf: node.weight * 100,
      duration: "",
      start: isoMin(kids.map((row) => row.baselineStart)),
      finish: isoMax(kids.map((row) => row.baselineFinish)),
      actualStart: isoMin(kids.map((row) => row.actualStart)),
      actualFinish: allDone ? isoMax(kids.map((row) => row.actualFinish)) : "",
      planned: node.plannedPct,
      actual: node.actualPct,
      bold: true,
    });
  }
  for (const row of kids) {
    lines.push({
      id: row.id,
      level: 3,
      name: fa ? row.nameFa : row.nameEn,
      cost: row.cost,
      wv: row.weight * 100,
      wf: row.weight * 100,
      duration: row.duration,
      start: row.baselineStart ?? "",
      finish: row.baselineFinish ?? "",
      actualStart: row.actualStart ?? "",
      actualFinish: row.actualFinish ?? "",
      planned: row.plannedPct,
      actual: row.physicalPct,
      bold: false,
    });
  }
  const border = "1px solid #9aa3ad";
  const groupBorder = "2px solid #4a4a4a";
  const th: CSSProperties = {
    background: "#d9d9d9",
    color: "#152536",
    border,
    padding: "3px 2px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 7.5,
    lineHeight: 1.15,
    verticalAlign: "middle",
  };
  const thRed: CSSProperties = { ...th, color: "#c00000" };
  const td: CSSProperties = {
    border,
    padding: "3px 2px",
    fontSize: 7.5,
    textAlign: "center",
    background: "#fff",
    verticalAlign: "middle",
  };
  const dash = "—";
  const rotate: CSSProperties = {
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    whiteSpace: "nowrap",
    fontSize: 8,
    fontWeight: 700,
  };

  return (
    <MonthlySheet title={fa ? titles[wbsId].fa : titles[wbsId].en} dense>
      <div className="h-full overflow-auto bg-white px-[0.6%] pt-[0.8%] pb-[0.6%] font-sans text-[#152536]">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 720 }}>
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "3.2%" }} />
            <col style={{ width: "14%" }} />
            {Array.from({ length: 17 }, (_, index) => (
              <col key={index} style={{ width: `${78 / 17}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, ...rotate }} rowSpan={2}>Activity ID</th>
              <th style={{ ...th, ...rotate }} rowSpan={2}>level</th>
              <th style={{ ...th }} rowSpan={2}>Activity</th>
              <th style={th} colSpan={3}>Weight Factor</th>
              <th style={th} colSpan={3}>Plan &quot;Date&quot;</th>
              <th style={th} colSpan={2}>Actual &quot;Date&quot;</th>
              <th style={{ ...th, borderLeft: groupBorder, borderTop: groupBorder, borderRight: groupBorder }} colSpan={3}>PLAN &quot;Progress&quot;</th>
              <th style={th} colSpan={3}>Actual &quot;Progress&quot;</th>
              <th style={{ ...thRed, border: groupBorder }} colSpan={3}>Variance &quot;Progress&quot;</th>
            </tr>
            <tr>
              {["Cost", "W.V", "W.F", "Du.", "Start", "Finish", "Actual Start", "Actual Finish"].map((label) => (
                <th key={label} style={th}>{label}</th>
              ))}
              {["Up to Last", "The Period", "Up to Now"].map((label) => (
                <th key={`p-${label}`} style={{ ...th, borderLeft: label === "Up to Last" ? groupBorder : border, borderRight: label === "Up to Now" ? groupBorder : border }}>{label}</th>
              ))}
              {["Up to Last", "The Period", "Up to Now"].map((label) => (
                <th key={`a-${label}`} style={th}>{label}</th>
              ))}
              {["Up to Last", "The Period", "Up to Now"].map((label) => (
                <th key={`v-${label}`} style={{ ...thRed, borderLeft: label === "Up to Last" ? groupBorder : border, borderRight: label === "Up to Now" ? groupBorder : border }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const weight = line.bold ? 700 : 400;
              const variance = line.actual - line.planned;
              return (
                <tr key={line.id}>
                  <td style={{ ...td, fontWeight: weight }}>{line.id}</td>
                  <td style={{ ...td, fontWeight: weight }}>{digits(line.level, fa)}</td>
                  <td style={{ ...td, textAlign: "start", fontWeight: weight }}>{line.name}</td>
                  <td style={{ ...td, fontWeight: weight }}>{moneyCell(line.cost, fa)}</td>
                  <td style={{ ...td, fontWeight: weight }}>{num(line.wv, fa, 2)}</td>
                  <td style={{ ...td, fontWeight: weight }}>{pctCell(line.wf, fa)}</td>
                  <td style={{ ...td, fontWeight: weight }}>{line.duration === "" ? "" : digits(line.duration, fa)}</td>
                  <td style={{ ...td, fontWeight: weight }}>{pmsDate(line.start, fa)}</td>
                  <td style={{ ...td, fontWeight: weight }}>{pmsDate(line.finish, fa)}</td>
                  <td style={{ ...td, fontWeight: weight }}>{pmsDate(line.actualStart, fa)}</td>
                  <td style={{ ...td, fontWeight: weight }}>{pmsDate(line.actualFinish, fa)}</td>
                  <td style={{ ...td, fontWeight: weight }}>{dash}</td>
                  <td style={{ ...td, fontWeight: weight }}>{dash}</td>
                  <td style={{ ...td, fontWeight: weight }}>{pctCell(line.planned, fa)}</td>
                  <td style={{ ...td, fontWeight: weight }}>{dash}</td>
                  <td style={{ ...td, fontWeight: weight }}>{dash}</td>
                  <td style={{ ...td, fontWeight: weight }}>{pctCell(line.actual, fa)}</td>
                  <td style={{ ...td, fontWeight: weight, color: "#c00000" }}>{dash}</td>
                  <td style={{ ...td, fontWeight: weight, color: "#c00000" }}>{dash}</td>
                  <td style={{ ...td, fontWeight: weight, color: "#c00000" }}>{pctCell(variance, fa)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
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
  const [contract, setContract] = useState<ContractFields>(DEFAULT_CONTRACT);
  const [geography, setGeography] = useState<GeographyFields>(DEFAULT_GEOGRAPHY);
  const [reportId, setReportId] = useState<ReportIdFields>(DEFAULT_REPORT_ID);
  const [scope, setScope] = useState<ScopeFields>(DEFAULT_SCOPE);
  const [saved, setSaved] = useState("");

  /* بارگذاری تنظیمات ذخیره‌شدهٔ همین پروژه. */
  useEffect(() => {
    let loadedCover: CoverFields = {
      ...DEFAULT_COVER,
      reportDate: isoToJalali(m?.openPeriod?.to ?? ""),
      periodStart: isoToJalali(m?.openPeriod?.from ?? ""),
      periodEnd: isoToJalali(m?.openPeriod?.to ?? ""),
    };
    let loadedContract: ContractFields = DEFAULT_CONTRACT;
    let loadedGeography: GeographyFields = DEFAULT_GEOGRAPHY;
    let loadedReportId: ReportIdFields = DEFAULT_REPORT_ID;
    let loadedScope: ScopeFields = DEFAULT_SCOPE;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CoverFields> & {
          cover?: Partial<CoverFields>;
          contract?: Partial<ContractFields>;
          geography?: Partial<GeographyFields>;
          reportId?: Partial<ReportIdFields>;
          scope?: Partial<ScopeFields>;
        };
        if (parsed.cover) {
          loadedCover = { ...loadedCover, ...parsed.cover };
          loadedContract = { ...DEFAULT_CONTRACT, ...parsed.contract };
          loadedGeography = { ...DEFAULT_GEOGRAPHY, ...parsed.geography };
          loadedReportId = { ...DEFAULT_REPORT_ID, ...parsed.reportId };
          loadedScope = { ...DEFAULT_SCOPE, ...parsed.scope };
        } else {
          const { contract: storedContract, ...flatCover } = parsed;
          loadedCover = { ...loadedCover, ...flatCover };
          if (storedContract) loadedContract = { ...DEFAULT_CONTRACT, ...storedContract };
        }
      }
    } catch {
      /* دادهٔ خراب ذخیره را نادیده می‌گیریم و پیش‌فرض می‌ماند. */
    }
    setCover(loadedCover);
    setContract(loadedContract);
    setGeography(loadedGeography);
    setReportId(loadedReportId);
    setScope(loadedScope);
  }, [storageKey, m?.openPeriod?.to]);

  /* فقط شیت‌های سندی چاپ می‌شوند؛ تب قالب/خروجی صفحهٔ کاغذی نیست. */
  const printable =
    tab === "cover" ||
    tab === "index" ||
    tab === "summary" ||
    tab === "contract" ||
    tab === "geography" ||
    tab === "reportId" ||
    tab === "scope" ||
    tab === "overallProgress" ||
    tab === "finance" ||
    tab === "timeAnalysis" ||
    tab === "delayAnalysis" ||
    tab === "rootCause" ||
    tab === "updatedSchedule" ||
    tab === "actionPlan" ||
    tab === "pmsMdr" ||
    tab === "pmsDdr" ||
    tab === "pmsStatus" ||
    tab === "pmsProc" ||
    tab === "pmsConst" ||
    tab.startsWith("divider-");
  const dividerChapter = tab.startsWith("divider-")
    ? MONTHLY_INDEX_CHAPTERS[Number(tab.slice("divider-".length)) - 1]
    : undefined;

  const patch = (next: Partial<CoverFields>) => setCover((c) => ({ ...c, ...next }));
  const patchContract = (next: Partial<ContractFields>) => setContract((c) => ({ ...c, ...next }));
  const patchScope = (next: Partial<ScopeFields>) => setScope((c) => ({ ...c, ...next }));
  const patchGeography = (next: Partial<GeographyFields>) => setGeography((c) => ({ ...c, ...next }));
  const patchReportId = (next: Partial<ReportIdFields>) => setReportId((c) => ({ ...c, ...next }));

  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ cover, contract, geography, reportId, scope }));
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
        @page { size: A4 ${tab === "pmsMdr" || tab === "pmsDdr" || tab === "pmsStatus" ? "landscape" : "portrait"}; margin: 6mm; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #monthly-report-print-root, #monthly-report-print-root * { visibility: visible !important; }
          #monthly-report-print-root {
            position: fixed !important; inset: 0 auto auto 0 !important; box-sizing: border-box !important;
            width: ${tab === "pmsMdr" || tab === "pmsDdr" || tab === "pmsStatus" ? "285mm" : "198mm"} !important; height: ${tab === "pmsMdr" || tab === "pmsDdr" || tab === "pmsStatus" ? "198mm" : "285mm"} !important; min-width: 0 !important; max-width: none !important;
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
      {tab === "index" && <MonthlyIndexSheet lang={lang} />}
      {dividerChapter && <MonthlyChapterDividerSheet cover={cover} lang={lang} chapter={dividerChapter} />}
      {tab === "contract" && <MonthlyContractSheet lang={lang} contract={contract} onChange={patchContract} />}
      {tab === "geography" && <MonthlyGeographySheet lang={lang} geography={geography} onChange={patchGeography} />}
      {tab === "reportId" && (
        <MonthlyReportIdSheet
          cover={cover}
          lang={lang}
          model={m}
          reportId={reportId}
          onChange={patchReportId}
          onChangeCover={patch}
        />
      )}
      {tab === "scope" && <MonthlyScopeSheet lang={lang} scope={scope} onChange={patchScope} />}
      {tab === "overallProgress" && <MonthlyOverallProgressSheet cover={cover} lang={lang} model={m} />}
      {tab === "finance" && <MonthlyFinanceSheet lang={lang} />}
      {tab === "timeAnalysis" && (
        <MonthlyTimeAnalysisSheet contract={contract} lang={lang} model={m} />
      )}
      {tab === "delayAnalysis" && <MonthlyDelayAnalysisSheet lang={lang} model={m} />}
      {tab === "rootCause" && <MonthlyRootCauseSheet lang={lang} model={m} />}
      {tab === "updatedSchedule" && <MonthlyUpdatedScheduleSheet lang={lang} />}
      {tab === "actionPlan" && <MonthlyActionPlanSheet lang={lang} />}
      {tab === "pmsMdr" && <MonthlyEngineeringProgressSheet lang={lang} model={m} kind="mdr" />}
      {tab === "pmsDdr" && <MonthlyEngineeringProgressSheet lang={lang} model={m} kind="ddr" />}
      {tab === "pmsStatus" && <MonthlyEngineeringStatusSheet lang={lang} model={m} />}
      {tab === "pmsProc" && <MonthlyPmsProgressSheet lang={lang} model={m} wbsId="2" />}
      {tab === "pmsConst" && <MonthlyPmsProgressSheet lang={lang} model={m} wbsId="3" />}
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
