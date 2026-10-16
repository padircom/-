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
import { isWorkingDay, plannedPercentAt, rollUp, workingDaysBetween } from "../services/planning";
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
  | "pmsPsr"
  | "pmsConst"
  | "physCurve"
  | "physCurveE"
  | "physCurveP"
  | "physCurveC"
  | "costCurve"
  | "weather"
  | "manpowerStats"
  | "machineryStats"
  | "resourceCharts"
  | "materials"
  | "resourceAnalysis"
  | "keyActivities"
  | "issues"
  | "correspondence"
  | "workStoppage"
  | "changeWork"
  | "delayedActivities"
  | "siteVisit"
  | "shopDrawings"
  | "hse"
  | "photoReport"
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
  { id: "templates", fa: "تحلیل گزارش", en: "Report analysis" },
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
  { id: "pmsPsr", fa: "PSR", en: "PSR" },
  { id: "pmsConst", fa: "پیشرفت Construction", en: "Construction progress" },
  { id: "physCurve", fa: "منحنی پیشرفت EPC", en: "EPC progress curve" },
  { id: "physCurveE", fa: "منحنی پیشرفت Engineering", en: "Engineering progress curve" },
  { id: "physCurveP", fa: "منحنی پیشرفت Procurement", en: "Procurement progress curve" },
  { id: "physCurveC", fa: "منحنی پیشرفت Construction", en: "Construction progress curve" },
  { id: "costCurve", fa: "منحنی پیشرفت ریالی", en: "Cost progress curve" },
  {
    id: "divider-4",
    fa: chapterHeading(MONTHLY_INDEX_CHAPTERS[3], true),
    en: chapterHeading(MONTHLY_INDEX_CHAPTERS[3], false),
  },
  { id: "weather", fa: "وضعیت جوی و کاری", en: "Weather and working conditions" },
  { id: "manpowerStats", fa: "آمار نیروی انسانی", en: "Manpower statistics" },
  { id: "machineryStats", fa: "آمار تجهیزات و ماشین‌آلات", en: "Equipment and machinery statistics" },
  { id: "resourceCharts", fa: "نمودار نیروی انسانی و ماشین‌آلات", en: "Manpower and equipment charts" },
  { id: "materials", fa: "خلاصه کالا و مصالح", en: "Materials summary" },
  { id: "resourceAnalysis", fa: "گزارش تحلیلی منابع", en: "Resource analysis" },
  {
    id: "divider-5",
    fa: chapterHeading(MONTHLY_INDEX_CHAPTERS[4], true),
    en: chapterHeading(MONTHLY_INDEX_CHAPTERS[4], false),
  },
  { id: "keyActivities", fa: "اهم فعالیت‌های پروژه", en: "Key project activities" },
  { id: "issues", fa: "مشکلات و پیشنهادات", en: "Issues and recommendations" },
  { id: "correspondence", fa: "جلسات و مکاتبات", en: "Meetings and correspondence" },
  { id: "workStoppage", fa: "گزارش توقف کاری", en: "Work-stoppage report" },
  { id: "changeWork", fa: "گزارش تغییر کار", en: "Change-of-work report" },
  { id: "delayedActivities", fa: "فعالیت‌های متأثر از تأخیرات", en: "Activities affected by delays" },
  {
    id: "divider-6",
    fa: chapterHeading(MONTHLY_INDEX_CHAPTERS[5], true),
    en: chapterHeading(MONTHLY_INDEX_CHAPTERS[5], false),
  },
  { id: "siteVisit", fa: "بازدید کارشناسان کارفرما", en: "Employer site visit" },
  { id: "shopDrawings", fa: "نقشه‌های کارگاهی و ازبیلت", en: "Shop drawings & as-built" },
  {
    id: "divider-7",
    fa: chapterHeading(MONTHLY_INDEX_CHAPTERS[6], true),
    en: chapterHeading(MONTHLY_INDEX_CHAPTERS[6], false),
  },
  { id: "hse", fa: "گزارش مدیریت HSE", en: "HSE management report" },
  {
    id: "divider-8",
    fa: chapterHeading(MONTHLY_INDEX_CHAPTERS[7], true),
    en: chapterHeading(MONTHLY_INDEX_CHAPTERS[7], false),
  },
  { id: "photoReport", fa: "گزارش تصویری", en: "Photo report" },
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

function MonthlySheet({ title, children, dense = false, landscape = false, dir = "rtl", titleDir }: { title: string; children: ReactNode; dense?: boolean; landscape?: boolean; dir?: "rtl" | "ltr"; titleDir?: "rtl" | "ltr" }) {
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
          dir={titleDir ?? dir}
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
              className="flex min-h-0 flex-1 items-center bg-[#d9dee3] px-2.5 text-start text-[clamp(10.5px,1.5vw,13px)] font-semibold leading-none"
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
    <MonthlySheet title={title} dense landscape dir="ltr" titleDir="rtl">
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

function MonthlyPsrSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const node = model?.wbsRollup.find((item) => item.id === "2");
  const kids = (model?.rows ?? []).filter((row) => row.wbs === "2" && !row.isMilestone);
  const date = (iso?: string) => (iso ? digits(isoToJalali(iso), fa) : "");
  const th: CSSProperties = { background: "#1f4e79", color: "#fff", border: "1px solid #163a5a", padding: "3px 2px", fontSize: 6.5, fontWeight: 700, textAlign: "center", whiteSpace: "normal", lineHeight: 1.15 };
  const th2: CSSProperties = { ...th, background: "#2e6aa0", fontWeight: 600 };
  const td: CSSProperties = { border: "1px solid #8aa0b4", background: "#fff", fontSize: 7, textAlign: "center", padding: "2px 2px", whiteSpace: "nowrap" };
  const tdName: CSSProperties = { ...td, textAlign: "start", whiteSpace: "normal" };
  const stage = ["Plan Start", "Plan Finish", "Plan %", "Actual %"];
  const groups = [
    { title: "P.O.", cols: stage },
    { title: "Inspection During Construction", cols: ["Plan Start", "Plan Finish", "Plan Dur.", "Actual %"] },
    { title: "Release Note", cols: stage },
    { title: "Delivery at Site", cols: stage },
    { title: "Installation, Test, Precom, Com, Hand Over", cols: ["Plan Start", "Plan Finish", "Plan %", "Actual %"] },
  ];
  const baseCols = fa
    ? ["TASK", "Dis.", "Type", "Supply", "MR Number", "Category", "Sub Category", "Package Title", "Vendor", "Plan Start", "Plan Finish", "Cost", "W.V", "W.F", "Unit", "Qty"]
    : ["TASK", "Dis.", "Type", "Supply", "MR Number", "Category", "Sub Category", "Package Title", "Vendor", "Plan Start", "Plan Finish", "Cost", "W.V", "W.F", "Unit", "Qty"];
  const extra = groups.reduce((n, g) => n + g.cols.length, 0);
  const tail = ["Plan Progress %", "Actual Progress %", "Remark"];
  const lines = [
    node
      ? { id: "2", name: fa ? node.nameFa : node.nameEn, start: "", finish: "", cost: kids.reduce((s, r) => s + r.cost, 0), wv: node.weight * 100, wf: node.weight * 100, planned: node.plannedPct, actual: node.actualPct, bold: true }
      : undefined,
    ...kids.map((row) => ({
      id: row.id,
      name: fa ? row.nameFa : row.nameEn,
      start: row.baselineStart ?? "",
      finish: row.baselineFinish ?? "",
      cost: row.cost,
      wv: row.weight * 100,
      wf: row.weight * 100,
      planned: row.plannedPct,
      actual: row.physicalPct,
      bold: false,
    })),
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  return (
    <MonthlySheet title={fa ? "Procurement Status (PSR)" : "Procurement Status (PSR)"} dense landscape dir="ltr" titleDir="rtl">
      <div className="h-full overflow-auto bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#b8f3f8", color: "#1f4e79", textAlign: "center", fontWeight: 800, fontSize: 14, padding: "4px", border: "1px solid #1f4e79" }}>PROCUREMENT</div>
        <div style={{ background: "#1f4e79", color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 11, padding: "3px" }}>Procurement Status</div>
        <table className="border-collapse" style={{ tableLayout: "fixed", minWidth: 1600, fontSize: 7 }}>
          <thead>
            <tr>
              {baseCols.map((col) => <th key={col} rowSpan={2} style={th}>{col}</th>)}
              {groups.map((group) => <th key={group.title} colSpan={group.cols.length} style={th}>{group.title}</th>)}
              {tail.map((col) => <th key={col} rowSpan={2} style={th}>{col}</th>)}
            </tr>
            <tr>
              {groups.flatMap((group) => group.cols.map((col) => <th key={`${group.title}-${col}`} style={th2}>{col}</th>))}
            </tr>
          </thead>
          <tbody>
            {lines.map((row) => (
              <tr key={row.id} style={{ fontWeight: row.bold ? 700 : 400, background: row.bold ? "#d9ead3" : "#fff" }}>
                <td style={tdName}>{row.name}</td>
                {Array.from({ length: 8 }, (_, i) => <td key={`e-${i}`} style={td} />)}
                <td style={td}>{date(row.start)}</td>
                <td style={td}>{date(row.finish)}</td>
                <td style={td}>{row.cost ? num(row.cost, fa, 0) : ""}</td>
                <td style={td}>{pctCell(row.wv, fa)}</td>
                <td style={td}>{pctCell(row.wf, fa)}</td>
                <td style={td} />
                <td style={td} />
                {Array.from({ length: extra }, (_, i) => <td key={`g-${i}`} style={td} />)}
                <td style={td}>{pctCell(row.planned, fa)}</td>
                <td style={td}>{pctCell(row.actual, fa)}</td>
                <td style={td} />
              </tr>
            ))}
          </tbody>
        </table>
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
    padding: "4px 2px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 8,
    lineHeight: 1.2,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };
  const thRed: CSSProperties = { ...th, color: "#c00000" };
  const td: CSSProperties = {
    border,
    padding: "3px 2px",
    fontSize: 8,
    textAlign: "center",
    background: "#fff",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    overflow: "hidden",
  };
  const dash = "—";
  const rotate: CSSProperties = {
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    whiteSpace: "nowrap",
    fontSize: 8,
    fontWeight: 700,
  };
  const colWidths = ["4.5%", "2.5%", "9%", "5.5%", "3.6%", "4%", "3%", "5.8%", "5.8%", "5.8%", "5.8%", "5%", "5%", "5%", "5%", "5%", "5%", "5%", "5%", "5%"];

  return (
    <MonthlySheet title={fa ? titles[wbsId].fa : titles[wbsId].en} dense landscape={wbsId === "2" || wbsId === "3"} dir={wbsId === "2" || wbsId === "3" ? "ltr" : "rtl"} titleDir={wbsId === "2" || wbsId === "3" ? "rtl" : undefined}>
      <div className="h-full overflow-auto bg-white px-[0.6%] pt-[0.8%] pb-[0.6%] font-sans text-[#152536]">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {colWidths.map((width, index) => (
              <col key={index} style={{ width }} />
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
              {["Cost", "W.V", "W.F", "Du.", "Start", "Finish", "Actual\nStart", "Actual\nFinish"].map((label) => (
                <th key={label} style={{ ...th, whiteSpace: "pre-line" }}>{label}</th>
              ))}
              {["Up to\nLast", "The\nPeriod", "Up to\nNow"].map((label) => (
                <th key={`p-${label}`} style={{ ...th, whiteSpace: "pre-line", borderLeft: label.startsWith("Up to\nL") ? groupBorder : border, borderRight: label.startsWith("Up to\nN") ? groupBorder : border }}>{label}</th>
              ))}
              {["Up to\nLast", "The\nPeriod", "Up to\nNow"].map((label) => (
                <th key={`a-${label}`} style={{ ...th, whiteSpace: "pre-line" }}>{label}</th>
              ))}
              {["Up to\nLast", "The\nPeriod", "Up to\nNow"].map((label) => (
                <th key={`v-${label}`} style={{ ...thRed, whiteSpace: "pre-line", borderLeft: label.startsWith("Up to\nL") ? groupBorder : border, borderRight: label.startsWith("Up to\nN") ? groupBorder : border }}>{label}</th>
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
                  <td style={{ ...td, textAlign: "start", fontWeight: weight, whiteSpace: "normal" }}>{line.name}</td>
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

function monthEndIso(year: number, month1: number) {
  return new Date(Date.UTC(year, month1, 0)).toISOString().slice(0, 10);
}

function scurveColumns(start: string, finish: string) {
  const cols: { key: string; iso: string; title: string }[] = [{ key: "stat", iso: start, title: "Stat" }];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = finish.split("-").map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    const iso = monthEndIso(y, m);
    if (iso > start && iso < finish) cols.push({ key: iso, iso, title: isoToJalali(iso) });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  cols.push({ key: "finish", iso: finish, title: "FINISH" });
  return cols;
}

type PhysFocus = "epc" | "e" | "p" | "c";

const PHYS_FOCUS: Record<PhysFocus, { wbsId: string | null; tag: string; titleFa: string; titleEn: string }> = {
  epc: { wbsId: null, tag: "EPC", titleFa: "منحنی و نمودار پیشرفت فیزیکی (در بخش‌های EPC)", titleEn: "Physical progress curve (EPC)" },
  e: { wbsId: "1", tag: "E", titleFa: "منحنی و نمودار پیشرفت فیزیکی (در بخش Engineering)", titleEn: "Physical progress curve (Engineering)" },
  p: { wbsId: "2", tag: "P", titleFa: "منحنی و نمودار پیشرفت فیزیکی (در بخش Procurement)", titleEn: "Physical progress curve (Procurement)" },
  c: { wbsId: "3", tag: "C", titleFa: "منحنی و نمودار پیشرفت فیزیکی (در بخش Construction)", titleEn: "Physical progress curve (Construction)" },
};

function activityPlanAt(row: PexModel["rows"][number], iso: string) {
  if (!row.baselineStart) return 0;
  const elapsed = workingDaysBetween(row.baselineStart, iso) - 1;
  if (row.duration <= 0) return iso >= (row.baselineFinish ?? iso) ? 100 : 0;
  return Math.max(0, Math.min(100, (elapsed / row.duration) * 100));
}

function wbsPlanAt(model: PexModel | undefined, wbsId: string, iso: string) {
  if (!model) return undefined;
  const kids = model.rows.filter((r) => r.wbs === wbsId);
  if (!kids.length) return undefined;
  const weights = Object.fromEntries(kids.map((k) => [k.id, k.weight]));
  return rollUp(kids.map((k) => ({ id: k.id, percent: activityPlanAt(k, iso) })), weights);
}

function deltas(values: (number | undefined)[]) {
  return values.map((value, index) => {
    if (value === undefined) return undefined;
    const prev = index === 0 ? 0 : values[index - 1];
    return prev === undefined ? undefined : value - prev;
  });
}

function MonthlyPhysCurveSheet({ lang, model, focus }: { lang: Lang; model?: PexModel; focus: PhysFocus }) {
  const fa = lang === "fa";
  const meta = PHYS_FOCUS[focus];
  const start = model?.project.start ?? "";
  const finish = model?.project.baselineEnd ?? "";
  const dataDate = model?.dataDate ?? "";
  const curve = model?.scurve ?? [];
  const cols = start && finish ? scurveColumns(start, finish) : [];
  const wbs = (id: string) => model?.wbsRollup.find((item) => item.id === id);
  const planAt = (iso: string) => (curve.length ? plannedPercentAt(curve, iso) : undefined);
  const inDataMonth = (iso: string) => dataDate !== "" && iso.slice(0, 7) === dataDate.slice(0, 7);
  const actualEpc = (iso: string) => (inDataMonth(iso) ? model?.overallPct : undefined);
  const actualWbs = (iso: string, id: string) => (inDataMonth(iso) ? wbs(id)?.actualPct : undefined);
  const planWbs = (iso: string, id: string) => wbsPlanAt(model, id, iso);
  const showActual = (id: string | null) => focus === "epc" || meta.wbsId === id;
  const chartPlan = cols.map((col) => (meta.wbsId ? planWbs(col.iso, meta.wbsId) : planAt(col.iso)));
  const chartActual = cols.map((col) => (meta.wbsId ? actualWbs(col.iso, meta.wbsId) : actualEpc(col.iso)));
  const periodPlan = deltas(chartPlan);
  const periodActual = deltas(chartActual);
  const cell = (value: number | undefined, color?: string) =>
    value === undefined ? "" : (
      <span style={{ color }}>{pctCell(value, fa)}</span>
    );
  const th: CSSProperties = {
    background: "#6e6e6e",
    color: "#fff",
    border: "1px solid #4a4a4a",
    padding: "2px 1px",
    fontSize: 6.5,
    fontWeight: 700,
    textAlign: "center",
    whiteSpace: "nowrap",
  };
  const td: CSSProperties = {
    background: "#d4d4d4",
    border: "1px solid #9a9a9a",
    padding: "2px 1px",
    fontSize: 6.5,
    textAlign: "center",
    whiteSpace: "nowrap",
  };
  const labelTd: CSSProperties = { ...td, textAlign: "start", fontWeight: 700, background: "#c8c8c8", padding: "2px 4px" };
  const rows: { label: string; values: (number | undefined)[]; color?: string }[] = [
    { label: "Plan - EPC", color: "#1a7a2a", values: cols.map((col) => planAt(col.iso)) },
    { label: "Plan - E", color: "#1a7a2a", values: cols.map((col) => planWbs(col.iso, "1")) },
    { label: "Plan - P", color: "#1a7a2a", values: cols.map((col) => planWbs(col.iso, "2")) },
    { label: "Plan - C", color: "#1a7a2a", values: cols.map((col) => planWbs(col.iso, "3")) },
    { label: "Actual - EPC", color: "#2a4dff", values: cols.map((col) => (showActual(null) ? actualEpc(col.iso) : undefined)) },
    { label: "Actual - E", color: "#2a4dff", values: cols.map((col) => (showActual("1") ? actualWbs(col.iso, "1") : undefined)) },
    { label: "Actual - P", color: "#2a4dff", values: cols.map((col) => (showActual("2") ? actualWbs(col.iso, "2") : undefined)) },
    { label: "Actual - C", color: "#2a4dff", values: cols.map((col) => (showActual("3") ? actualWbs(col.iso, "3") : undefined)) },
    {
      label: "Variance - EPC",
      color: "#b00000",
      values: cols.map((col) => {
        if (!showActual(null)) return undefined;
        const a = actualEpc(col.iso);
        const p = planAt(col.iso);
        return a === undefined || p === undefined ? undefined : a - p;
      }),
    },
    {
      label: "Variance - E",
      color: "#b00000",
      values: cols.map((col) => {
        if (!showActual("1")) return undefined;
        const a = actualWbs(col.iso, "1");
        const p = planWbs(col.iso, "1");
        return a === undefined || p === undefined ? undefined : a - p;
      }),
    },
    {
      label: "Variance - P",
      color: "#b00000",
      values: cols.map((col) => {
        if (!showActual("2")) return undefined;
        const a = actualWbs(col.iso, "2");
        const p = planWbs(col.iso, "2");
        return a === undefined || p === undefined ? undefined : a - p;
      }),
    },
    {
      label: "Variance - C",
      color: "#b00000",
      values: cols.map((col) => {
        if (!showActual("3")) return undefined;
        const a = actualWbs(col.iso, "3");
        const p = planWbs(col.iso, "3");
        return a === undefined || p === undefined ? undefined : a - p;
      }),
    },
  ];
  const periodPlanEpc = deltas(cols.map((col) => planAt(col.iso)));
  const periodPlanE = deltas(cols.map((col) => planWbs(col.iso, "1")));
  const periodPlanP = deltas(cols.map((col) => planWbs(col.iso, "2")));
  const periodPlanC = deltas(cols.map((col) => planWbs(col.iso, "3")));
  const periodRows: { label: string; values: (number | undefined)[]; color?: string }[] = [
    { label: "Plan - EPC", color: "#1a7a2a", values: focus === "epc" ? periodPlanEpc : cols.map(() => undefined) },
    { label: "Plan - E", color: "#1a7a2a", values: focus === "e" || focus === "epc" ? periodPlanE : cols.map(() => undefined) },
    { label: "Plan - P", color: "#1a7a2a", values: focus === "p" || focus === "epc" ? periodPlanP : cols.map(() => undefined) },
    { label: "Plan - C", color: "#1a7a2a", values: focus === "c" || focus === "epc" ? periodPlanC : cols.map(() => undefined) },
    { label: "Contractor-Actual - EPC", color: "#2a4dff", values: cols.map(() => undefined) },
    { label: "Actual - E", color: "#2a4dff", values: focus === "e" ? periodActual : cols.map(() => undefined) },
    { label: "Actual - P", color: "#2a4dff", values: focus === "p" ? periodActual : cols.map(() => undefined) },
    { label: "Actual - C", color: "#2a4dff", values: focus === "c" ? periodActual : cols.map(() => undefined) },
    { label: "Variance - EPC", color: "#b00000", values: cols.map(() => undefined) },
    { label: "Variance - E", color: "#b00000", values: cols.map(() => undefined) },
    { label: "Variance - P", color: "#b00000", values: cols.map(() => undefined) },
    { label: "Variance - C", color: "#b00000", values: cols.map(() => undefined) },
  ];
  const plot = { left: 48, top: 22, width: 820, height: 118 };
  const xAt = (index: number) => plot.left + (cols.length <= 1 ? 0 : (index / (cols.length - 1)) * plot.width);
  const yAt = (pct: number, max = 100) => plot.top + ((max - pct) / max) * plot.height;
  const planLine = chartPlan.map((value, i) => `${xAt(i)},${yAt(value ?? 0)}`).join(" ");
  const actualPts = chartActual
    .map((value, i) => (value === undefined ? null : `${xAt(i)},${yAt(value)}`))
    .filter((p): p is string => p !== null);
  const periodMax = Math.max(20, ...periodPlan.map((v) => Math.abs(v ?? 0)), 5);
  const chartTh: CSSProperties = {
    border: "1px solid #111",
    padding: "1px 2px",
    fontSize: 6.5,
    textAlign: "center",
    background: "#fff",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
  const chartTd: CSSProperties = {
    border: "1px solid #111",
    padding: "1px 2px",
    fontSize: 6.5,
    textAlign: "center",
    background: "#fff",
    whiteSpace: "nowrap",
  };
  const underChart = (
    series: { label: string; color: string; dashed?: boolean; values: (number | undefined)[] }[],
  ) => (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed", margin: 0 }}>
      <thead>
        <tr>
          <th style={{ ...chartTh, width: "16%" }} />
          {cols.map((col, index) => (
            <th key={col.key} style={chartTh}>
              <div>{col.key === "stat" || col.key === "finish" ? col.title : digits(col.title, fa)}</div>
              <div>{digits(index + 1, fa)}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {series.map((row) => (
          <tr key={row.label}>
            <td style={{ ...chartTd, textAlign: "start", fontWeight: 700, paddingInline: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 16,
                  marginInlineEnd: 6,
                  verticalAlign: "middle",
                  borderTop: row.dashed ? `2px dashed ${row.color}` : `7px solid ${row.color}`,
                }}
              />
              {row.label}
            </td>
            {row.values.map((value, index) => (
              <td key={`${row.label}-${index}`} style={chartTd}>{value === undefined ? "" : pctCell(value, fa)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <MonthlySheet title={fa ? meta.titleFa : meta.titleEn} dense landscape dir="ltr" titleDir="rtl">
      <div className="h-full overflow-auto bg-white px-[0.5%] pt-[0.5%] pb-[0.4%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ border: "1px solid #111", flexShrink: 0 }}>
          <svg viewBox="0 0 900 148" className="w-full" style={{ display: "block", height: 168 }} preserveAspectRatio="xMidYMid meet">
            <text x="450" y="14" textAnchor="middle" fill="#111" fontSize="12" fontFamily="Vazirmatn, Tahoma, sans-serif">{fa ? "منحنی S-Curve فیزیکی" : "Physical S-Curve"}</text>
            <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} fill="#fff" stroke="#111" />
            {[0, 25, 50, 75, 100].map((tick) => (
              <g key={tick}>
                <line x1={plot.left} y1={yAt(tick)} x2={plot.left + plot.width} y2={yAt(tick)} stroke="#ddd" />
                <text x={plot.left - 4} y={yAt(tick) + 3} textAnchor="end" fill="#8a4b12" fontSize="8">{`${tick}.00%`}</text>
              </g>
            ))}
            <polyline points={planLine} fill="none" stroke="#1a7a2a" strokeWidth="1.8" strokeDasharray="6 3" />
            {actualPts.length > 1 ? <polyline points={actualPts.join(" ")} fill="none" stroke="#2a4dff" strokeWidth="1.8" strokeDasharray="5 3" /> : null}
            {actualPts.length === 1 ? <circle cx={Number(actualPts[0].split(",")[0])} cy={Number(actualPts[0].split(",")[1])} r="2.4" fill="#2a4dff" /> : null}
          </svg>
          {underChart([
            { label: `Plan - ${meta.tag}`, color: "#1a7a2a", dashed: true, values: chartPlan },
            { label: `Actual - ${meta.tag}`, color: "#2a4dff", dashed: true, values: chartActual },
          ])}
        </div>
        <div style={{ border: "1px solid #111", flexShrink: 0 }}>
          <svg viewBox="0 0 900 148" className="w-full" style={{ display: "block", height: 168 }} preserveAspectRatio="xMidYMid meet">
            <text x="450" y="14" textAnchor="middle" fill="#111" fontSize="12" fontFamily="Vazirmatn, Tahoma, sans-serif">{fa ? "جدول درصد پیشرفت فیزیکی (طی دوره)" : "Physical progress this period"}</text>
            <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} fill="#fff" stroke="#111" />
            {[0, 5, 10, 15, 20].map((tick) => {
              const y = plot.top + ((periodMax - tick) / periodMax) * plot.height;
              return (
                <g key={tick}>
                  <line x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} stroke="#ddd" />
                  <text x={plot.left - 4} y={y + 3} textAnchor="end" fill="#8a4b12" fontSize="8">{`${tick}.00%`}</text>
                </g>
              );
            })}
            {periodPlan.map((value, index) => {
              const groupW = plot.width / Math.max(cols.length, 1);
              const x = plot.left + index * groupW + groupW * 0.12;
              const h = (Math.max(value ?? 0, 0) / periodMax) * plot.height;
              const actual = periodActual[index];
              const ah = (Math.max(actual ?? 0, 0) / periodMax) * plot.height;
              return (
                <g key={cols[index].key}>
                  <rect x={x} y={plot.top + plot.height - h} width={groupW * 0.34} height={h} fill="#1a7a2a" />
                  {actual === undefined ? null : (
                    <rect x={x + groupW * 0.38} y={plot.top + plot.height - ah} width={groupW * 0.34} height={ah} fill="#2a4dff" />
                  )}
                </g>
              );
            })}
          </svg>
          {underChart([
            { label: `Plan - ${meta.tag}`, color: "#1a7a2a", values: periodPlan },
            { label: focus === "epc" ? "Contractor-Actual - EPC" : `Actual - ${meta.tag}`, color: "#2a4dff", values: periodActual },
          ])}
        </div>
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", flexShrink: 0 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: "14%" }}>Days</th>
              {cols.map((col, index) => (
                <th key={col.key} style={th}>{col.key === "stat" || col.key === "finish" ? col.title : digits(index, fa)}</th>
              ))}
            </tr>
            <tr>
              <th style={th}>Month</th>
              {cols.map((col) => (
                <th key={col.key} style={th}>{col.key === "stat" || col.key === "finish" ? col.title : digits(col.title, fa)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td style={{ ...labelTd, color: row.color }}>{row.label}</td>
                {row.values.map((value, index) => (
                  <td key={`${row.label}-${index}`} style={td}>{cell(value, row.color)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td colSpan={cols.length + 1} style={{ ...td, height: 6, background: "#6e6e6e" }} />
            </tr>
            {periodRows.map((row) => (
              <tr key={`p-${row.label}`}>
                <td style={{ ...labelTd, color: row.color }}>{row.label}</td>
                {row.values.map((value, index) => (
                  <td key={`${row.label}-p-${index}`} style={td}>{cell(value, row.color)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
  );
}

/*
 * منحنی و نمودار پیشرفت ریالی (جریان نقدینگی) — بند فصل سوم فهرست.
 * برنامه: هزینهٔ هر فعالیت روی برنامهٔ پایه (BL-01) با همان فرض پخش خطی
 * activityPlanAt که منحنی‌های فیزیکی استفاده می‌کنند؛ پس «برنامهٔ ریالی»
 * کاملاً از موتور مشتق است. هزینهٔ واقعی (صورت‌وضعیت/پرداخت) در موتور
 * داده‌ای ندارد، پس ردیف‌های Actual خالی می‌مانند — عددی ساخته نمی‌شود.
 */
function MonthlyCostCurveSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const start = model?.project.start ?? "";
  const finish = model?.project.baselineEnd ?? "";
  const currency = model?.project.currency ?? "";
  const cols = start && finish ? scurveColumns(start, finish) : [];
  const actRows = model?.rows ?? [];
  const totalBudget = actRows.reduce((s, r) => s + r.cost, 0);
  const planCostAt = (iso: string) => actRows.reduce((s, r) => s + (r.cost * activityPlanAt(r, iso)) / 100, 0);
  const cumPlan = cols.map((col) => planCostAt(col.iso));
  const periodPlan = deltas(cumPlan) ?? [];
  const cumPct = cumPlan.map((v) => (totalBudget > 0 ? (v / totalBudget) * 100 : 0));
  const money = (v: number | undefined) => (v === undefined ? "" : moneyCell(Math.round(v), fa));
  const th: CSSProperties = { background: "#6e6e6e", color: "#fff", border: "1px solid #4a4a4a", padding: "2px 1px", fontSize: 6.5, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap" };
  const td: CSSProperties = { background: "#d4d4d4", border: "1px solid #9a9a9a", padding: "2px 1px", fontSize: 6.5, textAlign: "center", whiteSpace: "nowrap" };
  const labelTd: CSSProperties = { ...td, textAlign: "start", fontWeight: 700, background: "#c8c8c8", padding: "2px 4px" };
  const chartTh: CSSProperties = { border: "1px solid #111", padding: "1px 2px", fontSize: 6.5, textAlign: "center", background: "#fff", fontWeight: 700, whiteSpace: "nowrap" };
  const chartTd: CSSProperties = { border: "1px solid #111", padding: "1px 2px", fontSize: 6.5, textAlign: "center", background: "#fff", whiteSpace: "nowrap" };
  const plot = { left: 48, top: 22, width: 820, height: 118 };
  const xAt = (index: number) => plot.left + (cols.length <= 1 ? 0 : (index / (cols.length - 1)) * plot.width);
  const yAt = (pct: number, max = 100) => plot.top + ((max - pct) / max) * plot.height;
  const planLine = cumPct.map((value, i) => `${xAt(i)},${yAt(value)}`).join(" ");
  const periodMax = Math.max(5, ...periodPlan.map((v) => Math.abs((v ?? 0) / Math.max(totalBudget, 1)) * 100));
  const underChart = (series: { label: string; color: string; dashed?: boolean; values: (string | undefined)[] }[]) => (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed", margin: 0 }}>
      <thead>
        <tr>
          <th style={{ ...chartTh, width: "16%" }} />
          {cols.map((col, index) => (
            <th key={col.key} style={chartTh}>
              <div>{col.key === "stat" || col.key === "finish" ? col.title : digits(col.title, fa)}</div>
              <div>{digits(index + 1, fa)}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {series.map((row) => (
          <tr key={row.label}>
            <td style={{ ...chartTd, textAlign: "start", fontWeight: 700, paddingInline: 6 }}>
              <span style={{ display: "inline-block", width: 16, marginInlineEnd: 6, verticalAlign: "middle", borderTop: row.dashed ? `2px dashed ${row.color}` : `7px solid ${row.color}` }} />
              {row.label}
            </td>
            {row.values.map((value, index) => (
              <td key={`${row.label}-${index}`} style={chartTd}>{value ?? ""}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <MonthlySheet title={fa ? "منحنی و نمودار پیشرفت ریالی (جریان نقدینگی)" : "Cost progress curve (cash flow)"} dense landscape dir="ltr" titleDir="rtl">
      <div className="h-full overflow-auto bg-white px-[0.5%] pt-[0.5%] pb-[0.4%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ border: "1px solid #111", flexShrink: 0 }}>
          <svg viewBox="0 0 900 148" className="w-full" style={{ display: "block", height: 168 }} preserveAspectRatio="xMidYMid meet">
            <text x="450" y="14" textAnchor="middle" fill="#111" fontSize="12" fontFamily="Vazirmatn, Tahoma, sans-serif">{fa ? "منحنی جریان نقدینگی تجمعی (برنامه‌ای)" : "Cumulative cash-flow curve (planned)"}</text>
            <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} fill="#fff" stroke="#111" />
            {[0, 25, 50, 75, 100].map((tick) => (
              <g key={tick}>
                <line x1={plot.left} y1={yAt(tick)} x2={plot.left + plot.width} y2={yAt(tick)} stroke="#ddd" />
                <text x={plot.left - 4} y={yAt(tick) + 3} textAnchor="end" fill="#8a4b12" fontSize="8">{`${tick}.00%`}</text>
              </g>
            ))}
            {cols.length > 1 ? <polyline points={planLine} fill="none" stroke="#1a7a2a" strokeWidth="1.8" strokeDasharray="6 3" /> : null}
          </svg>
          {underChart([
            { label: "Plan - Cumulative", color: "#1a7a2a", dashed: true, values: cumPlan.map((v) => money(v)) },
            { label: "Plan - Cumulative %", color: "#1a7a2a", dashed: true, values: cumPct.map((v) => pctCell(v, fa)) },
            { label: "Actual - Cumulative", color: "#2a4dff", dashed: true, values: cols.map(() => undefined) },
          ])}
        </div>
        <div style={{ border: "1px solid #111", flexShrink: 0 }}>
          <svg viewBox="0 0 900 148" className="w-full" style={{ display: "block", height: 168 }} preserveAspectRatio="xMidYMid meet">
            <text x="450" y="14" textAnchor="middle" fill="#111" fontSize="12" fontFamily="Vazirmatn, Tahoma, sans-serif">{fa ? "جریان نقدینگی طی دوره (برنامه‌ای)" : "Cash flow this period (planned)"}</text>
            <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} fill="#fff" stroke="#111" />
            {[0, 25, 50, 75, 100].map((tick) => {
              const frac = tick / 100;
              const y = plot.top + (1 - frac) * plot.height;
              return (
                <g key={tick}>
                  <line x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} stroke="#ddd" />
                  <text x={plot.left - 4} y={y + 3} textAnchor="end" fill="#8a4b12" fontSize="8">{`${(periodMax * frac).toFixed(2)}%`}</text>
                </g>
              );
            })}
            {periodPlan.map((value, index) => {
              const pct = ((value ?? 0) / Math.max(totalBudget, 1)) * 100;
              const groupW = plot.width / Math.max(cols.length, 1);
              const x = plot.left + index * groupW + groupW * 0.12;
              const h = (Math.max(pct, 0) / periodMax) * plot.height;
              return <rect key={cols[index].key} x={x} y={plot.top + plot.height - h} width={groupW * 0.34} height={h} fill="#1a7a2a" />;
            })}
          </svg>
          {underChart([
            { label: "Plan - Period", color: "#1a7a2a", values: periodPlan.map((v) => money(v)) },
            { label: "Actual - Period", color: "#2a4dff", values: cols.map(() => undefined) },
          ])}
        </div>
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", flexShrink: 0 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: "14%" }}>Month</th>
              {cols.map((col) => (
                <th key={col.key} style={th}>{col.key === "stat" || col.key === "finish" ? col.title : digits(col.title, fa)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...labelTd, color: "#1a7a2a" }}>{`Plan - Cumulative (${currency})`}</td>
              {cumPlan.map((v, i) => <td key={i} style={td}>{money(v)}</td>)}
            </tr>
            <tr>
              <td style={{ ...labelTd, color: "#1a7a2a" }}>{`Plan - Period (${currency})`}</td>
              {periodPlan.map((v, i) => <td key={i} style={td}>{money(v)}</td>)}
            </tr>
            <tr>
              <td style={{ ...labelTd, color: "#2a4dff" }}>{`Actual - Cumulative (${currency})`}</td>
              {cols.map((col) => <td key={col.key} style={td} />)}
            </tr>
            <tr>
              <td style={{ ...labelTd, color: "#b00000" }}>{`Variance (${currency})`}</td>
              {cols.map((col) => <td key={col.key} style={td} />)}
            </tr>
            <tr>
              <td style={{ ...labelTd }}>{fa ? "بودجهٔ کل (موتور)" : "Total budget (engine)"}</td>
              <td style={td} colSpan={Math.max(cols.length, 1)}>{totalBudget > 0 ? `${moneyCell(Math.round(totalBudget), fa)} ${currency}` : "—"}</td>
            </tr>
          </tbody>
        </table>
        <p dir={fa ? "rtl" : "ltr"} style={{ fontSize: 8, color: "#5a6b7b", margin: 0 }}>
          {fa
            ? "منحنی برنامه‌ای از هزینهٔ فعالیت‌ها روی برنامهٔ پایه (BL-01) مشتق شده است. هزینهٔ واقعی در موتور داده‌ای ندارد؛ ردیف‌های Actual خالی می‌مانند تا صورت‌وضعیت‌های تأییدشده متصل شوند."
            : "The planned curve is derived from activity costs on baseline BL-01. The engine holds no actual cost; Actual rows stay empty until approved IPCs are connected."}
        </p>
      </div>
    </MonthlySheet>
  );
}

function eachIso(from: string, to: string) {
  const out: string[] = [];
  if (!from || !to || from > to) return out;
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    const next = new Date(`${cur}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cur = next.toISOString().slice(0, 10);
    if (out.length > 400) break;
  }
  return out;
}

function calendarDays(from: string, to: string) {
  return eachIso(from, to).length;
}

function weekdayName(iso: string, fa: boolean, short = false) {
  const faNames = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  const faShort = ["ی", "د", "س", "چ", "پ", "ج", "ش"];
  const enNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  if (short) return fa ? faShort[day] : enNames[day];
  return fa ? faNames[day] : enNames[day];
}

function MonthlyWeatherSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const start = model?.project.start ?? "";
  const finish = model?.project.baselineEnd ?? "";
  const dataDate = model?.dataDate ?? "";
  const periodFrom = model?.openPeriod?.from ?? "";
  const periodTo = model?.openPeriod?.to ?? dataDate;
  const end = dataDate || periodTo;
  const daysShown = periodFrom && periodTo
    ? eachIso(periodFrom, periodTo)
    : end
      ? eachIso(addIso(end, -29), end)
      : [];
  const duration = start && finish ? calendarDays(start, finish) : undefined;
  const elapsed = start && dataDate ? calendarDays(start, dataDate) : undefined;
  const remaining = duration !== undefined && elapsed !== undefined ? Math.max(0, duration - elapsed) : undefined;
  const active = start && dataDate ? workingDaysBetween(start, dataDate) : undefined;
  const inactiveMonth = periodFrom && periodTo
    ? eachIso(periodFrom, periodTo).filter((iso) => !isWorkingDay(iso)).length
    : undefined;
  const dash = "—";
  const cell: CSSProperties = {
    border: "1px solid #8aa0b4",
    padding: "2px 1px",
    fontSize: 6.5,
    textAlign: "center",
    background: "#fff",
    whiteSpace: "nowrap",
  };
  const labelCell: CSSProperties = { ...cell, background: "#e8eef2", fontWeight: 700, textAlign: "start", width: "7.8%", fontSize: 7 };
  const navy: CSSProperties = {
    background: "#1f4e79",
    color: "#fff",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 12,
    padding: "4px 6px",
    border: "1px solid #163a5a",
  };
  const calRows: { label: string; value: number | undefined }[] = [
    { label: fa ? "مدت پروژه" : "Project duration", value: duration },
    { label: fa ? "تعداد روزهای سپری شده" : "Elapsed days", value: elapsed },
    { label: fa ? "تعداد روزهای فعال پروژه تاکنون" : "Active days to date", value: active },
    { label: fa ? "تعداد روزهای غیر فعال پروژه در ماه جاری" : "Inactive days this month", value: inactiveMonth },
    { label: fa ? "تعداد روزهای باقیمانده" : "Remaining days", value: remaining },
  ];
  const pieTotal = Math.max(duration ?? 0, 1);
  const elapsedFrac = (elapsed ?? 0) / pieTotal;
  const piePath = (from: number, to: number, r: number, cx: number, cy: number) => {
    const a0 = -Math.PI / 2 + from * 2 * Math.PI;
    const a1 = -Math.PI / 2 + to * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = to - from > 0.5 ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
  };
  const stack = [
    { value: elapsed ?? 0, color: "#f4d03f", label: fa ? `تعداد روزهای سپری شده: ${elapsed ?? dash}` : `Elapsed: ${elapsed ?? dash}` },
    { value: active ?? 0, color: "#fdebd0", label: fa ? `تعداد روزهای فعال پروژه تاکنون: ${active ?? dash}` : `Active: ${active ?? dash}` },
    { value: inactiveMonth ?? 0, color: "#e67e22", label: fa ? `تعداد روزهای غیر فعال پروژه در ماه جاری: ${inactiveMonth ?? dash}` : `Inactive: ${inactiveMonth ?? dash}` },
  ];
  const stackSum = stack.reduce((s, item) => s + item.value, 0) || 1;

  return (
    <MonthlySheet title={fa ? "وضعیت جوی و کاری" : "Weather and working conditions"} dense landscape>
      <div className="h-full overflow-auto bg-white px-[1%] py-[0.6%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ background: "#b8f3f8", border: "1px solid #1f4e79", color: "#1f4e79", textAlign: "center", fontWeight: 800, fontSize: 14, padding: "5px 8px" }}>
          {fa ? "خلاصه گزارش وضعیت آب و هوا" : "Weather status summary"}
        </div>
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th colSpan={daysShown.length + 2} style={navy}>{fa ? "وضعیت دما" : "Temperature status"}</th>
            </tr>
            <tr>
              <th style={labelCell}>{fa ? "ردیف" : "No."}</th>
              <th style={labelCell}>{fa ? "وضعیت" : "Status"}</th>
              {daysShown.map((iso) => (
                <th key={iso} style={{ ...cell, background: "#e8eef2", fontWeight: 700, whiteSpace: "pre-line", lineHeight: 1.15 }}>
                  {digits(isoToJalali(iso).slice(5), fa)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={labelCell}>{digits(1, fa)}</td>
              <td style={labelCell}>{fa ? "روز های ماه" : "Weekday"}</td>
              {daysShown.map((iso) => {
                const off = !isWorkingDay(iso);
                return (
                  <td key={iso} style={{ ...cell, background: off ? "#c00000" : "#fff", color: off ? "#fff" : "#152536", fontWeight: 700 }}>
                    {weekdayName(iso, fa, true)}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td style={labelCell}>{digits(2, fa)}</td>
              <td style={labelCell}>{fa ? "وضعیت آب و هوا" : "Weather"}</td>
              {daysShown.map((iso) => <td key={iso} style={cell}>{dash}</td>)}
            </tr>
            <tr>
              <td style={labelCell}>{digits(3, fa)}</td>
              <td style={labelCell}>{fa ? "وضعیت کارگاه" : "Site status"}</td>
              {daysShown.map((iso) => (
                <td key={iso} style={cell}>{isWorkingDay(iso) ? (fa ? "فعال" : "Active") : (fa ? "غیرفعال" : "Idle")}</td>
              ))}
            </tr>
            <tr>
              <td style={{ ...labelCell, color: "#1f4e79" }}>{digits(4, fa)}</td>
              <td style={{ ...labelCell, color: "#1f4e79" }}>{fa ? "حداقل دما" : "Min temp"}</td>
              {daysShown.map((iso) => <td key={iso} style={{ ...cell, color: "#1f4e79" }}>{dash}</td>)}
            </tr>
            <tr>
              <td style={{ ...labelCell, color: "#c00000" }}>{digits(5, fa)}</td>
              <td style={{ ...labelCell, color: "#c00000" }}>{fa ? "حداکثر دما" : "Max temp"}</td>
              {daysShown.map((iso) => <td key={iso} style={{ ...cell, color: "#c00000" }}>{dash}</td>)}
            </tr>
            <tr>
              <td style={{ ...labelCell, color: "#1a7a2a" }}>{digits(6, fa)}</td>
              <td style={{ ...labelCell, color: "#1a7a2a" }}>{fa ? "میانگین دما" : "Avg temp"}</td>
              {daysShown.map((iso) => <td key={iso} style={{ ...cell, color: "#1a7a2a" }}>{dash}</td>)}
            </tr>
            <tr>
              <td style={labelCell} />
              <td style={labelCell}>{fa ? "وضعیت" : "OK"}</td>
              {daysShown.map((iso) => (
                <td key={iso} style={cell}>
                  {isWorkingDay(iso) ? <span style={{ color: "#1f9d4a", fontSize: 14 }}>✓</span> : <span style={{ color: "#c00000", fontSize: 14 }}>✕</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <svg viewBox="0 0 1000 200" className="w-full" style={{ display: "block", width: "100%", aspectRatio: "1000 / 200", height: "auto", flexShrink: 0 }} preserveAspectRatio="xMidYMid meet">
          <rect x="156" y="10" width="836" height="162" fill="#fff" stroke="#1f4e79" />
          {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((tick) => {
            const y = 10 + ((80 - tick) / 80) * 162;
            return (
              <g key={tick}>
                <line x1="156" y1={y} x2="992" y2={y} stroke="#e6e6e6" />
                <text x="150" y={y + 3} textAnchor="end" fill="#333" fontSize="9">{tick}</text>
              </g>
            );
          })}
          {daysShown.map((iso, index) => {
            const x = 156 + ((index + 0.5) / Math.max(daysShown.length, 1)) * 836;
            return (
              <text key={iso} x={x} y="188" textAnchor="middle" fill="#333" fontSize="7">{digits(isoToJalali(iso).slice(5), fa)}</text>
            );
          })}
          <g fontSize="9" fill="#333">
            <line x1="700" y1="22" x2="720" y2="22" stroke="#1f4e79" />
            <circle cx="710" cy="22" r="3" fill="#fff" stroke="#1f4e79" />
            <text x="726" y="25">{fa ? "حداقل دما" : "Min"}</text>
            <line x1="800" y1="22" x2="820" y2="22" stroke="#c00000" />
            <rect x="806" y="18" width="8" height="8" fill="#fff" stroke="#c00000" />
            <text x="826" y="25">{fa ? "حداکثر دما" : "Max"}</text>
            <line x1="900" y1="22" x2="920" y2="22" stroke="#1a7a2a" />
            <rect x="906" y="19" width="8" height="6" fill="#fff" stroke="#1a7a2a" />
            <text x="926" y="25">{fa ? "میانگین دما" : "Avg"}</text>
          </g>
        </svg>
        <div style={{ display: "flex", gap: 16, alignItems: "stretch", flex: 1, minHeight: 0 }}>
        <table className="border-collapse" style={{ width: 360, maxWidth: "38%", flexShrink: 0, tableLayout: "fixed" }}>
          <thead>
            <tr><th colSpan={2} style={{ ...navy, fontSize: 15, padding: "7px 8px" }}>{fa ? "تقویم پروژه" : "Project calendar"}</th></tr>
          </thead>
          <tbody>
            {calRows.map((row) => (
              <tr key={row.label}>
                <td style={{ ...labelCell, width: "70%", fontSize: 13, padding: "7px 8px", whiteSpace: "normal" }}>{row.label}</td>
                <td style={{ ...cell, width: "30%", fontSize: 13, padding: "7px 8px", fontWeight: 700 }}>{row.value === undefined ? dash : `${digits(row.value, fa)} ${fa ? "روز" : "days"}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 120 }}>
          <svg viewBox="0 0 360 220" style={{ flex: 1.2, height: "100%" }} preserveAspectRatio="xMidYMid meet">
            <path d={piePath(0, elapsedFrac, 90, 160, 110)} fill="#5dade2" stroke="#fff" />
            <path d={piePath(elapsedFrac, 1, 90, 160, 110)} fill="#1f4e79" stroke="#fff" />
            <text x="160" y="108" textAnchor="middle" fill="#fff" fontSize="10">{fa ? `سپری‌شده: ${elapsed ?? dash}` : `Elapsed: ${elapsed ?? dash}`}</text>
            <rect x="8" y="200" width="10" height="10" fill="#1f4e79" />
            <text x="22" y="209" fontSize="9">{fa ? `مدت پروژه: ${duration ?? dash}` : `Duration: ${duration ?? dash}`}</text>
            <rect x="160" y="200" width="10" height="10" fill="#5dade2" />
            <text x="174" y="209" fontSize="9">{fa ? `سپری‌شده: ${elapsed ?? dash}` : `Elapsed: ${elapsed ?? dash}`}</text>
          </svg>
          <svg viewBox="0 0 280 220" style={{ flex: 0.8, height: "100%" }} preserveAspectRatio="xMidYMid meet">
            {(() => {
              let y = 12;
              return stack.map((item) => {
                const h = (item.value / stackSum) * 196;
                const node = (
                  <g key={item.label}>
                    <rect x="18" y={y} width="70" height={Math.max(h, 0)} fill={item.color} stroke="#bbb" />
                    <line x1="88" y1={y + h / 2} x2="108" y2={y + h / 2} stroke="#888" />
                    <text x="112" y={y + h / 2 + 4} fontSize="9" fill="#333">{item.label}</text>
                  </g>
                );
                y += h;
                return node;
              });
            })()}
          </svg>
        </div>
        </div>
      </div>
    </MonthlySheet>
  );
}

function addIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}


type ManpowerKind = "section" | "role" | "total";
const DIRECT_MANPOWER: { description: string; kind: ManpowerKind }[] = [
  { description: "Civil & Building", kind: "section" },
  { description: "Foreman civil", kind: "role" },
  { description: "Bar Bender", kind: "role" },
  { description: "Bolt Man", kind: "role" },
  { description: "Form Worker / Carpenter", kind: "role" },
  { description: "Concrete Worker", kind: "role" },
  { description: "Concrete Pump Operator", kind: "role" },
  { description: "Asphalt Worker", kind: "role" },
  { description: "Batching Plant Operator", kind: "role" },
  { description: "Brick Layer / Mason", kind: "role" },
  { description: "Tiler", kind: "role" },
  { description: "Painter / Plasterer", kind: "role" },
  { description: "Plumber", kind: "role" },
  { description: "Iron Worker", kind: "role" },
  { description: "Water Proofing Worker", kind: "role" },
  { description: "Others Civil", kind: "role" },
  { description: "Steel Structure", kind: "section" },
  { description: "Foreman Structure", kind: "role" },
  { description: "Technician", kind: "role" },
  { description: "Assembler/Cutter", kind: "role" },
  { description: "Steel / Iron Worker", kind: "role" },
  { description: "Welder", kind: "role" },
  { description: "Welder Helper", kind: "role" },
  { description: "Others Structure", kind: "role" },
  { description: "Piping", kind: "section" },
  { description: "Foreman Piping", kind: "role" },
  { description: "Fitter Helper", kind: "role" },
  { description: "Tack Welder", kind: "role" },
  { description: "Pipe Welder ( ARC )", kind: "role" },
  { description: "Welder Helper", kind: "role" },
  { description: "Assembler", kind: "role" },
  { description: "Electrical & Instrumentation", kind: "section" },
  { description: "Foreman Electrical", kind: "role" },
  { description: "Technician - Electrical", kind: "role" },
  { description: "Technical Worker", kind: "role" },
  { description: "Paint & Insulation", kind: "section" },
  { description: "Foreman painting", kind: "role" },
  { description: "Sand Blaster", kind: "role" },
  { description: "Shot Blaster", kind: "role" },
  { description: "Painter", kind: "role" },
  { description: "Insulator - Pipe", kind: "role" },
  { description: "General", kind: "section" },
  { description: "Controller", kind: "role" },
  { description: "Equipment Operator", kind: "role" },
  { description: "Rigger", kind: "role" },
  { description: "Scaffolder", kind: "role" },
  { description: "Skilled Labor", kind: "role" },
  { description: "Common Labor", kind: "role" },
  { description: "Helper", kind: "role" },
  { description: "Heavy Vehicle Driver", kind: "role" },
  { description: "Machinery Maintenance", kind: "role" },
  { description: "Worker", kind: "role" },
  { description: "Total Direct", kind: "total" },
];
const INDIRECT_MANPOWER: { description: string; kind: ManpowerKind }[] = [
  { description: "Management", kind: "section" },
  { description: "Project Manager / Director", kind: "role" },
  { description: "Site Manager / Deputy", kind: "role" },
  { description: "Construction", kind: "section" },
  { description: "Civil & Steel Structure - Supervisor", kind: "role" },
  { description: "Civil & Steel Structure - Technicians Executive", kind: "role" },
  { description: "Surveying - Engineers", kind: "role" },
  { description: "Surveying - Helper", kind: "role" },
  { description: "Insulation & Paint - Supervisor", kind: "role" },
  { description: "Technical Office", kind: "section" },
  { description: "Technical Office Manager / Deputy", kind: "role" },
  { description: "Technical Office - Engineers", kind: "role" },
  { description: "Technical Office - Technicians", kind: "role" },
  { description: "Planning", kind: "section" },
  { description: "Planning & Control Manager / Deputy", kind: "role" },
  { description: "Planning & Control - Technicians", kind: "role" },
  { description: "QA / QC", kind: "section" },
  { description: "QC Manager / Deputy", kind: "role" },
  { description: "QC - Technicians", kind: "role" },
  { description: "Concrete Lab.", kind: "role" },
  { description: "Soil Mechanic Lab.", kind: "role" },
  { description: "NDT Controller / Radiography", kind: "role" },
  { description: "Document Controller", kind: "role" },
  { description: "HSE", kind: "section" },
  { description: "HSE Manager / Deputy", kind: "role" },
  { description: "HSE - Supervisor", kind: "role" },
  { description: "HSE - Officer", kind: "role" },
  { description: "Safety officer", kind: "role" },
  { description: "Clinic Doctor", kind: "role" },
  { description: "Clinic Nurse", kind: "role" },
  { description: "Material Control", kind: "section" },
  { description: "Material Control Manager / Deputy", kind: "role" },
  { description: "Warehouse - Material Man", kind: "role" },
  { description: "Material Helper", kind: "role" },
  { description: "Administration", kind: "section" },
  { description: "Admin. Manager / Deputy", kind: "role" },
  { description: "Admin./Clerk", kind: "role" },
  { description: "Administrative", kind: "role" },
  { description: "Finance", kind: "section" },
  { description: "Finance Manager", kind: "role" },
  { description: "Finance / Accountant", kind: "role" },
  { description: "Logistics", kind: "section" },
  { description: "Logistics Manager / Deputy", kind: "role" },
  { description: "Local Procurement / Purchaser", kind: "role" },
  { description: "Maintenance / General Services - Site", kind: "role" },
  { description: "Maintenance / General Services - Camp", kind: "role" },
  { description: "Security Manager / Deputy", kind: "role" },
  { description: "Security Officer", kind: "role" },
  { description: "Guard", kind: "role" },
  { description: "Well guard", kind: "role" },
  { description: "Light Vehicle Driver", kind: "role" },
  { description: "Services & Kitchen worker", kind: "role" },
  { description: "Total IN Direct", kind: "total" },
];
type MachineryKind = "asset" | "total";
const MACHINERY_ONE: { mainGroup: string; subGroup: string; description: string; kind: MachineryKind }[] = [
  { mainGroup: "Civil", subGroup: "Heavy", description: "Excavator", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Heavy", description: "Pichor / Jack Hammer", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Heavy", description: "Bulldozer", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Heavy", description: "Loader", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Heavy", description: "Grader", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Heavy", description: "Compact Roller / Vibrating Roller", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Semi-Heavy", description: "Truck Mixer", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Semi-Heavy", description: "Concrete & Grout Mixer", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Semi-Heavy", description: "Concrete Pump", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Semi-Heavy", description: "Truck 1", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Semi-Heavy", description: "Dumper", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Semi-Heavy", description: "Bob cat / Back hoe", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Semi-Heavy", description: "Compactor", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Workshop", description: "Hand Mixer", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Workshop", description: "Batching Plant", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Workshop", description: "Cement Silo", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Workshop", description: "Concrete Laboratory", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Workshop", description: "Vibrator", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Workshop", description: "Rebar Cutting", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Workshop", description: "Bar Bending", kind: "asset" },
  { mainGroup: "Civil", subGroup: "Workshop", description: "Grinding Machine", kind: "asset" },
  { mainGroup: "General", subGroup: "Heavy", description: "Crane ≥ 50 Ton", kind: "asset" },
  { mainGroup: "General", subGroup: "Heavy", description: "Tower Crane", kind: "asset" },
  { mainGroup: "General", subGroup: "Heavy", description: "Tractor / Loader Tractor", kind: "asset" },
  { mainGroup: "General", subGroup: "Heavy", description: "Trailer", kind: "asset" },
  { mainGroup: "General", subGroup: "Heavy", description: "Truck", kind: "asset" },
  { mainGroup: "General", subGroup: "Heavy", description: "Boom Truck", kind: "asset" },
  { mainGroup: "General", subGroup: "Semi-Heavy", description: "Lift Truck", kind: "asset" },
  { mainGroup: "General", subGroup: "Semi-Heavy", description: "Water Tank Lorry", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Fuel Tank Lorry", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Diesel generator(150-200 kv)", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Crane ≤ 50 Ton", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Air Less", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Scaffolding Pipes & Board ( ML )", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Water Pump", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Elevator", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Survey Camera - Leica", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Survey Camera - Nivo", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Survey Camera - Theodolite", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "GPS", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Water Tank", kind: "asset" },
  { mainGroup: "General", subGroup: "Workshop", description: "Diesel Tank (10000 L)", kind: "asset" },
  { mainGroup: "", subGroup: "", description: "", kind: "total" },
];
const MACHINERY_TWO: { mainGroup: string; subGroup: string; description: string; kind: MachineryKind }[] = [
  { mainGroup: "Equipment", subGroup: "Workshop", description: "CuttingMachine", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "SandBlastMachine", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Waterjet", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "WeldingTrans", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Rectifier", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "StressReliefMachine(PWHTEq.)", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "AirCompressor", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "UltrasonicEquipment", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "MagnetTest(Detector/BlackLight)", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "VacumBoxTester", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "HydrotestWaterPump", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "PlasmaCuttingMachine", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "SawMachine", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Gouge", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Shegell", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "JunctionBox", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Oxygen-AcetyleneCutter", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "AngleCutter", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "RollingMachine", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "ThreadingMachine", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Grinder", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Punch/Press", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "ElectrodeDryOven", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "ElectrodePortableOven", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Jack-Horizontal", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Jack-Vertical", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "DrillingMachine", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "Blower", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "ChainBlock", kind: "asset" },
  { mainGroup: "Equipment", subGroup: "Workshop", description: "ElectricWinch", kind: "asset" },
  { mainGroup: "Vehicle", subGroup: "", description: "Bus/Minibus", kind: "asset" },
  { mainGroup: "Vehicle", subGroup: "", description: "Car", kind: "asset" },
  { mainGroup: "Vehicle", subGroup: "", description: "Ambulance", kind: "asset" },
  { mainGroup: "Facility", subGroup: "Workshop", description: "Container/Conex", kind: "asset" },
  { mainGroup: "Office", subGroup: "Workshop", description: "Computer", kind: "asset" },
  { mainGroup: "Office", subGroup: "Workshop", description: "Printer", kind: "asset" },
  { mainGroup: "Other", subGroup: "Workshop", description: "FireProofMachine", kind: "asset" },
  { mainGroup: "Other", subGroup: "Workshop", description: "Weldingmachine", kind: "asset" },
  { mainGroup: "Other", subGroup: "Workshop", description: "TagMachine", kind: "asset" },
  { mainGroup: "Other", subGroup: "Workshop", description: "Projector", kind: "asset" },
  { mainGroup: "Other", subGroup: "Workshop", description: "Electricscissors", kind: "asset" },
  { mainGroup: "", subGroup: "", description: "", kind: "total" },
];

function periodDays(model?: PexModel) {
  const periodFrom = model?.openPeriod?.from ?? "";
  const periodTo = model?.openPeriod?.to ?? model?.dataDate ?? "";
  if (periodFrom && periodTo) return eachIso(periodFrom, periodTo);
  const end = model?.dataDate || "";
  return end ? eachIso(addIso(end, -29), end) : [];
}

function MonthlyManpowerStatsSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const days = periodDays(model);
  const dayCols = days.length * 2;
  const valueCount = dayCols + 4;
  const cell = "border border-[#bcbcbc] px-0 py-0 align-middle";
  const headerCell = `${cell} bg-[#dedede] text-center font-medium text-[#233b55]`;
  const table = (title: string, rows: { description: string; kind: ManpowerKind }[]) => (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div className="flex h-[18px] shrink-0 items-center justify-start border-y border-[#a9a9a9] bg-[#c4c4c4] px-1 text-[10px] font-semibold text-[#254e78]">{title}</div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse bg-white font-sans text-[7px] leading-none text-[#152536]" style={{ tableLayout: "fixed", minWidth: 180 + days.length * 44 + 120 }}>
          <colgroup>
            <col style={{ width: 160 }} />
            {Array.from({ length: dayCols }, (_, index) => <col key={`d-${index}`} style={{ width: 22 }} />)}
            {Array.from({ length: 4 }, (_, index) => <col key={`s-${index}`} style={{ width: 30 }} />)}
          </colgroup>
          <thead>
            <tr className="h-[14px]">
              <th rowSpan={3} className={`${headerCell} text-[10px] font-semibold text-[#111111]`}>Job Description</th>
              {days.map((iso) => <th key={iso} colSpan={2} className={headerCell}>{digits(isoToJalali(iso).slice(5), fa)}</th>)}
              <th colSpan={2} rowSpan={2} className={`${headerCell} font-semibold`}>WEEK</th>
              <th colSpan={2} rowSpan={2} className={`${headerCell} font-semibold`}>Up to Now</th>
            </tr>
            <tr className="h-[14px]">
              {days.map((iso) => <th key={`w-${iso}`} colSpan={2} className={headerCell}>{weekdayName(iso, true, true)}</th>)}
            </tr>
            <tr className="h-[14px]">
              {days.flatMap((iso) => [
                <th key={`${iso}-p`} className={`${headerCell} text-[7px] font-bold`}>Present</th>,
                <th key={`${iso}-r`} className={`${headerCell} text-[7px] font-bold`}>Rest</th>,
              ])}
              <th className={`${headerCell} text-[7px] font-bold`}>Present</th>
              <th className={`${headerCell} text-[7px] font-bold`}>Rest</th>
              <th className={`${headerCell} text-[7px] font-bold`}>Present</th>
              <th className={`${headerCell} text-[7px] font-bold`}>Rest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className={`h-[12px] ${row.kind !== "role" ? "bg-[#d5d5d5]" : "bg-white"}`}>
                <td className={`${cell} px-1 ${row.kind === "section" ? "font-semibold text-[#111111]" : row.kind === "total" ? "font-bold text-[#7116b3]" : "text-[#152536]"}`}>{row.description}</td>
                {Array.from({ length: valueCount }, (_, valueIndex) => (
                  <td key={valueIndex} className={`${cell} ${valueIndex >= dayCols && valueIndex < dayCols + 2 ? "bg-[#f0f0f0]" : ""} ${valueIndex >= dayCols + 2 ? "bg-[#e6e6e6]" : ""}`} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  return (
    <MonthlySheet title={fa ? "آمار نیروی انسانی" : "Manpower statistics"} dense landscape>
      <div className="h-full overflow-auto bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {table("Direct Manpower", DIRECT_MANPOWER)}
        {table("Indirect Manpower", INDIRECT_MANPOWER)}
      </div>
    </MonthlySheet>
  );
}

function MonthlyMachineryStatsSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const days = periodDays(model);
  const dayCols = days.length * 3;
  const valueCount = dayCols + 6;
  const cell = "border border-[#c4c4c4] px-0 py-0 align-middle";
  const headerCell = `${cell} bg-[#dedede] text-center text-[8px] font-medium text-[#263a55]`;
  const rowSpan = (rows: typeof MACHINERY_ONE, rowIndex: number, field: "mainGroup" | "subGroup") => {
    const row = rows[rowIndex];
    let count = 1;
    for (let index = rowIndex + 1; index < rows.length; index += 1) {
      const next = rows[index];
      if (next.kind === "total" || next.mainGroup !== row.mainGroup || next[field] !== row[field]) break;
      count += 1;
    }
    return count;
  };
  const table = (rows: typeof MACHINERY_ONE) => (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div className="flex h-[18px] shrink-0 items-center justify-start border-y border-[#a9a9a9] bg-[#c4c4c4] px-1 text-[10px] font-semibold text-[#254e78]">Machinery&EquipmentDescription</div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse bg-white font-sans text-[7px] leading-none text-[#152536]" style={{ tableLayout: "fixed", minWidth: 200 + days.length * 48 + 150 }}>
          <colgroup>
            <col style={{ width: 18 }} />
            <col style={{ width: 18 }} />
            <col style={{ width: 140 }} />
            {Array.from({ length: dayCols }, (_, index) => <col key={`m-${index}`} style={{ width: 16 }} />)}
            {Array.from({ length: 6 }, (_, index) => <col key={`ms-${index}`} style={{ width: 22 }} />)}
          </colgroup>
          <thead>
            <tr className="h-[16px]">
              <th rowSpan={3} className={headerCell} />
              <th rowSpan={3} className={headerCell} />
              <th rowSpan={3} className={`${headerCell} text-[10px] font-semibold text-[#111111]`}>Description</th>
              {days.map((iso) => <th key={iso} colSpan={3} className={headerCell}>{digits(isoToJalali(iso).slice(5), fa)}</th>)}
              <th colSpan={3} rowSpan={2} className={`${headerCell} font-semibold`}>Week</th>
              <th colSpan={3} rowSpan={2} className={`${headerCell} font-semibold`}>UpToNow</th>
            </tr>
            <tr className="h-[14px]">
              {days.map((iso) => <th key={`mw-${iso}`} colSpan={3} className={`${headerCell} text-[7px]`}>{weekdayName(iso, true, true)}</th>)}
            </tr>
            <tr className="h-[54px]">
              {Array.from({ length: dayCols }, (_, index) => <th key={`st-${index}`} className={`${headerCell} p-0`}><span className="inline-block whitespace-nowrap [writing-mode:vertical-rl] rotate-180">{["Active", "Inactive", "Inrepair"][index % 3]}</span></th>)}
              {Array.from({ length: 6 }, (_, index) => <th key={`sst-${index}`} className={`${headerCell} p-0`}><span className="inline-block whitespace-nowrap [writing-mode:vertical-rl] rotate-180">{["Active", "Inactive", "Inrepair"][index % 3]}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const totalRow = row.kind === "total";
              const firstMain = !totalRow && (rowIndex === 0 || rows[rowIndex - 1].mainGroup !== row.mainGroup);
              const firstSub = !totalRow && (rowIndex === 0 || rows[rowIndex - 1].mainGroup !== row.mainGroup || rows[rowIndex - 1].subGroup !== row.subGroup);
              return (
                <tr key={rowIndex} className={`h-[13px] ${totalRow ? "bg-[#d3d3d3] font-bold text-[#7116b3]" : "bg-white"}`}>
                  {totalRow ? <><td className={`${cell} bg-[#d3d3d3]`} /><td className={`${cell} bg-[#d3d3d3]`} /></> : firstMain ? <td rowSpan={rowSpan(rows, rowIndex, "mainGroup")} className={`${cell} bg-[#e0e0e0] px-0 text-center`}><span className="block whitespace-nowrap py-1 text-[7px] font-semibold text-[#142b45] [writing-mode:vertical-rl] rotate-180">{row.mainGroup}</span></td> : null}
                  {totalRow ? <td className={`${cell} bg-[#d3d3d3]`} /> : firstSub ? <td rowSpan={rowSpan(rows, rowIndex, "subGroup")} className={`${cell} bg-[#e7e7e7] px-0 text-center`}><span className="block whitespace-nowrap py-1 text-[7px] font-semibold text-[#142b45] [writing-mode:vertical-rl] rotate-180">{row.subGroup}</span></td> : null}
                  <td className={`${cell} px-1 ${totalRow ? "text-[#7116b3]" : "text-[#152536]"}`}>{row.description}</td>
                  {Array.from({ length: valueCount }, (_, valueIndex) => (
                    <td key={valueIndex} className={`${cell} ${valueIndex >= dayCols && valueIndex < dayCols + 3 ? "bg-[#f0f0f0]" : ""} ${valueIndex >= dayCols + 3 ? "bg-[#e5e5e5]" : ""}`} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
  return (
    <MonthlySheet title={fa ? "آمار تجهیزات و ماشین‌آلات" : "Equipment and machinery statistics"} dense landscape>
      <div className="h-full overflow-auto bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {table(MACHINERY_ONE)}
        {table(MACHINERY_TWO)}
      </div>
    </MonthlySheet>
  );
}

function MonthlyResourceChartsSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const periodFrom = model?.openPeriod?.from ?? "";
  const periodTo = model?.openPeriod?.to ?? model?.dataDate ?? "";
  const days = periodFrom && periodTo ? eachIso(periodFrom, periodTo) : [];
  const empty = days.map(() => undefined as number | undefined);
  const plot = { left: 36, top: 18, width: 950, height: 72 };
  const yAt = (v: number, max: number) => plot.top + ((max - v) / max) * plot.height;
  const xGroup = (index: number) => plot.left + (index / Math.max(days.length, 1)) * plot.width;
  const groupW = plot.width / Math.max(days.length, 1);
  const th: CSSProperties = {
    border: "1px solid #8aa0b4",
    padding: "1px 2px",
    fontSize: 6.5,
    textAlign: "center",
    background: "#fff",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
  const td: CSSProperties = { ...th, fontWeight: 400 };
  const under = (rows: { label: string; color: string; kind: "fill" | "line"; values: (number | undefined)[] }[]) => (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed", margin: 0 }}>
      <thead>
        <tr>
          <th style={{ ...th, width: "16%" }} />
          {days.map((_, index) => (
            <th key={index} style={th}>{digits(index + 1, fa)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td style={{ ...td, textAlign: "start", paddingInline: 4 }}>
              <span style={{ display: "inline-block", width: 12, height: row.kind === "line" ? 0 : 8, marginInlineEnd: 4, verticalAlign: "middle", background: row.kind === "fill" ? row.color : undefined, borderTop: row.kind === "line" ? `2px solid ${row.color}` : undefined }} />
              {row.label}
            </td>
            {row.values.map((value, index) => (
              <td key={`${row.label}-${index}`} style={td}>{value === undefined ? "" : digits(value, fa)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  const axis = (max: number, ticks: number[]) => (
    <>
      <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} fill="#fff" stroke="#1f4e79" />
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={plot.left} y1={yAt(tick, max)} x2={plot.left + plot.width} y2={yAt(tick, max)} stroke="#eee" />
          <text x={plot.left - 4} y={yAt(tick, max) + 3} textAnchor="end" fill="#333" fontSize="8">{tick}</text>
        </g>
      ))}
      {days.map((_, index) => (
        <text key={index} x={xGroup(index) + groupW / 2} y={plot.top + plot.height + 11} textAnchor="middle" fill="#333" fontSize="7">{digits(index + 1, fa)}</text>
      ))}
    </>
  );

  return (
    <MonthlySheet title={fa ? "نمودارهای نیروی انسانی و ماشین‌آلات ، مصالح" : "Manpower, machinery and material charts"} dense landscape>
      <div className="h-full overflow-auto bg-white px-[0.5%] py-[0.4%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ background: "#b8f3f8", border: "1px solid #1f4e79", color: "#1f4e79", textAlign: "center", fontWeight: 800, fontSize: 13, padding: "4px 6px" }}>
          {fa ? "نمودار های نیروی انسانی و ماشین آلات ، مصالح" : "Manpower, machinery and material charts"}
        </div>
        <div style={{ background: "#1f4e79", color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 12, padding: "3px 6px" }}>
          {fa ? "نمودار وضعیت منابع" : "Resource status chart"}
        </div>
        <div style={{ border: "1px solid #1f4e79", flexShrink: 0 }}>
          <svg viewBox="0 0 1000 108" className="w-full" style={{ display: "block", width: "100%", aspectRatio: "1000 / 108", height: "auto" }} preserveAspectRatio="xMidYMid meet">
            {axis(20, [0, 10, 20])}
          </svg>
          {under([
            { label: fa ? "جمع تجهیزات موتوری سبک" : "Light motor equipment", color: "#6b3fa0", kind: "fill", values: empty },
            { label: fa ? "جمع تجهیزات غیر موتوری" : "Non-motor equipment", color: "#c00000", kind: "fill", values: empty },
            { label: fa ? "جمع کل" : "Total", color: "#e8d5a3", kind: "fill", values: empty },
          ])}
        </div>
        <div style={{ border: "1px solid #1f4e79", flexShrink: 0 }}>
          <svg viewBox="0 0 1000 108" className="w-full" style={{ display: "block", width: "100%", aspectRatio: "1000 / 108", height: "auto" }} preserveAspectRatio="xMidYMid meet">
            {axis(20, [0, 10, 20])}
            <rect x="360" y="6" width="12" height="8" fill="#4472c4" />
            <text x="376" y="13" fontSize="8" fill="#1f4e79">{fa ? "جمع نیروهای غیرمستقیم" : "Indirect labor"}</text>
            <rect x="520" y="6" width="12" height="8" fill="#c00000" />
            <text x="536" y="13" fontSize="8" fill="#c00000">{fa ? "جمع نیروهای مستقیم" : "Direct labor"}</text>
            <line x1="680" y1="10" x2="700" y2="10" stroke="#70ad47" />
            <polygon points="690,6 694,10 690,14 686,10" fill="#70ad47" />
            <text x="706" y="13" fontSize="8" fill="#2e7d32">{fa ? "جمع کل" : "Total"}</text>
          </svg>
          {under([
            { label: fa ? "جمع نیروهای غیرمستقیم" : "Indirect labor", color: "#4472c4", kind: "fill", values: empty },
            { label: fa ? "جمع نیروهای مستقیم" : "Direct labor", color: "#c00000", kind: "fill", values: empty },
            { label: fa ? "جمع کل" : "Total", color: "#70ad47", kind: "line", values: empty },
          ])}
        </div>
        <div style={{ border: "1px solid #1f4e79", flex: 1, minHeight: 70 }}>
          <svg viewBox="0 0 1000 120" className="w-full" style={{ display: "block", width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
            <rect x="48" y="8" width="940" height="100" fill="#fff" stroke="#1f4e79" />
            {[0, 20, 40, 60, 80, 100].map((tick) => {
              const y = 8 + ((100 - tick) / 100) * 100;
              return (
                <g key={tick}>
                  <line x1="48" y1={y} x2="988" y2={y} stroke="#eee" />
                  <text x="44" y={y + 3} textAnchor="end" fill="#333" fontSize="8">{`${tick}%`}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </MonthlySheet>
  );
}

function ReportBanner({ text, navy = false }: { text: string; navy?: boolean }) {
  return (
    <div style={{
      background: navy ? "#1f4e79" : "#b8f3f8",
      color: navy ? "#fff" : "#1f4e79",
      textAlign: "center",
      fontWeight: navy ? 700 : 800,
      fontSize: navy ? 12 : 14,
      padding: navy ? "4px 6px" : "5px 8px",
      border: "1px solid #1f4e79",
    }}>{text}</div>
  );
}

function MonthlyMaterialsSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const cols = fa
    ? ["ردیف", "شرح مصالح", "واحد", "مقدار موردنیاز", "پیشرفت برنامه‌ای", "وارد شده تا ماه قبل", "پای کار ماه قبل", "ورودی این ماه", "مصرفی این ماه", "موجودی پای کار", "مقدار تأمین شده", "پیشرفت واقعی", "تاریخ ورود کالا و مصالح"]
    : ["No.", "Description", "Unit", "Required", "Plan %", "Received to last month", "On site last month", "This month in", "This month used", "On site now", "Supplied", "Actual %", "Arrival date"];
  const th: CSSProperties = { background: "#1f4e79", color: "#fff", border: "1px solid #163a5a", padding: "6px 3px", fontSize: 8, fontWeight: 700, textAlign: "center", whiteSpace: "normal" };
  const td: CSSProperties = { border: "1px solid #8aa0b4", background: "#fff" };
  return (
    <MonthlySheet title={fa ? "خلاصه گزارش کالا و مصالح" : "Materials and goods summary"} dense landscape>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner text={fa ? "خلاصه گزارش کالا و مصالح" : "Materials and goods summary"} />
        <ReportBanner navy text={fa ? "کالا و مصالح" : "Materials"} />
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", flex: 1 }}>
          <colgroup>
            <col style={{ width: 32 }} />
            {cols.slice(1).map((col) => <col key={col} />)}
          </colgroup>
          <thead>
            <tr>{cols.map((col, c) => <th key={col} style={{ ...th, width: c === 0 ? 32 : undefined }}>{col}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => (
              <tr key={i}>
                {cols.map((col, c) => (
                  <td key={col} style={{ ...td, textAlign: "center", fontSize: c === 0 ? 13 : undefined, fontWeight: c === 0 ? 700 : undefined, fontFamily: c === 0 ? "Vazirmatn, Tahoma, sans-serif" : undefined }}>{c === 0 ? digits(i + 1, true) : ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
  );
}

function AnalysisBox({ label, value, border }: { label: string; value: string; border?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", minWidth: 0 }}>
      <div style={{ border: `1px solid ${border ?? "#8aa0b4"}`, minWidth: 72, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: "#fff", padding: "0 8px" }}>{value}</div>
      <span style={{ fontSize: 11, color: "#1f4e79" }}>{label}</span>
    </div>
  );
}

function MonthlyResourceAnalysisSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const dash = "—";
  const start = model?.project.start ?? "";
  const finish = model?.project.baselineEnd ?? "";
  const dataDate = model?.dataDate ?? "";
  const duration = start && finish ? calendarDays(start, finish) : undefined;
  const elapsed = start && dataDate ? calendarDays(start, dataDate) : undefined;
  const timePct = duration && elapsed !== undefined ? (elapsed / duration) * 100 : undefined;
  const planned = model?.plannedPct;
  const actual = model?.overallPct;
  const variance = planned !== undefined && actual !== undefined ? actual - planned : undefined;
  const section = (title: string, rows: ReactNode) => (
    <div style={{ borderBottom: "1px solid #cfd8e3", padding: "8px 4px 10px" }}>
      <div style={{ textAlign: "end", fontWeight: 800, color: "#1f4e79", fontSize: 13, marginBottom: 8 }}>{title}</div>
      {rows}
    </div>
  );
  return (
    <MonthlySheet title={fa ? "گزارش تحلیلی مدیریت منابع" : "Resource-management analysis"} dense landscape>
      <div className="h-full overflow-auto bg-white px-[0.8%] py-[0.5%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <ReportBanner text={fa ? "گزارش تحلیلی مدیریت منابع" : "Resource-management analysis"} />
        <ReportBanner navy text={fa ? "گزارش مدیریت منابع" : "Resource management report"} />
        {section(fa ? "وضعیت نیروی انسانی" : "Manpower status", (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {["میانگین نیروی انسانی مستقیم (دوره قبل)", "آخرین وضعیت نیروی انسانی مستقیم", "افزایش/کاهش نیروی انسانی مستقیم"].map((label) => (
              <AnalysisBox key={label} label={fa ? label : label} value={dash} />
            ))}
            {["میانگین نیروی انسانی غیرمستقیم (دوره قبل)", "آخرین وضعیت نیروی انسانی غیرمستقیم", "افزایش/کاهش نیروی انسانی غیرمستقیم"].map((label) => (
              <AnalysisBox key={label} label={label} value={dash} />
            ))}
            {["میانگین کل نفرات (مستقیم/غیرمستقیم) (دوره قبل)", "آخرین وضعیت کل نفرات (مستقیم/غیرمستقیم)", "افزایش/کاهش کل نفرات (مستقیم/غیرمستقیم)"].map((label) => (
              <AnalysisBox key={label} label={label} value={dash} border="#1f4e79" />
            ))}
          </div>
        ))}
        {section(fa ? "وضعیت ماشین آلات/تجهیزات" : "Equipment status", (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {["میانگین تجهیزات موتوری (دوره قبل)", "آخرین وضعیت تجهیزات موتوری سبک", "افزایش/کاهش تجهیزات موتوری سبک (دوره قبل)", "میانگین تجهیزات غیر موتوری (دوره قبل)", "آخرین وضعیت تجهیزات غیر موتوری", "افزایش/کاهش تجهیزات غیر موتوری (دوره قبل)", "میانگین سایرماشین آلات (دوره قبل)", "آخرین وضعیت سایرماشین آلات", "افزایش/کاهش سایرماشین آلات (دوره قبل)"].map((label) => (
              <AnalysisBox key={label} label={label} value={dash} />
            ))}
            {["میانگین کل ماشین آلات (دوره قبل)", "آخرین وضعیت کل ماشین آلات", "افزایش/کاهش کل ماشین آلات (دوره قبل)"].map((label) => (
              <AnalysisBox key={label} label={label} value={dash} border="#1f4e79" />
            ))}
          </div>
        ))}
        {section(fa ? "وضعیت تدارکات کالا، مواد و مصالح" : "Materials procurement status", (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <AnalysisBox label={fa ? "پیشرفت برنامه‌ای/تجمعی تا دوره قبل" : "Plan to last period"} value={dash} />
            <AnalysisBox label={fa ? "پیشرفت برنامه‌ای/تجمعی تاکنون" : "Plan to date"} value={planned === undefined ? dash : pctCell(planned, fa)} />
            <AnalysisBox label={fa ? "پیشرفت برنامه‌ای - این دوره" : "Plan this period"} value={dash} />
            <AnalysisBox label={fa ? "زمان کل پروژه - روز" : "Project duration - days"} value={duration === undefined ? dash : digits(duration, fa)} />
            <AnalysisBox label={fa ? "پیشرفت واقعی/تجمعی تا دوره قبل" : "Actual to last period"} value={dash} />
            <AnalysisBox label={fa ? "پیشرفت واقعی/تجمعی تاکنون" : "Actual to date"} value={actual === undefined ? dash : pctCell(actual, fa)} />
            <AnalysisBox label={fa ? "پیشرفت واقعی - این دوره" : "Actual this period"} value={dash} />
            <AnalysisBox label={fa ? "زمان سپری شده - روز" : "Elapsed days"} value={elapsed === undefined ? dash : digits(elapsed, fa)} />
            <AnalysisBox label={fa ? "میزان انحراف/تجمعی تا دوره قبل" : "Variance to last period"} value={dash} border="#c00000" />
            <AnalysisBox label={fa ? "میزان انحراف/تجمعی تاکنون" : "Variance to date"} value={variance === undefined ? dash : pctCell(variance, fa)} border="#c00000" />
            <AnalysisBox label={fa ? "میزان انحراف - این دوره" : "Variance this period"} value={dash} border="#c00000" />
            <AnalysisBox label={fa ? "درصد زمان سپری شده" : "Elapsed time %"} value={timePct === undefined ? dash : pctCell(timePct, fa)} border="#1a7a2a" />
          </div>
        ))}
      </div>
    </MonthlySheet>
  );
}

function MonthlyKeyActivitiesSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  return (
    <MonthlySheet title={fa ? "اهم فعالیت‌های پروژه" : "Key project activities"} dense>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner text={fa ? "اهم فعالیت های پروژه" : "Key project activities"} />
        <ReportBanner navy text={fa ? "شرح فعالیت های ماه جاری" : "Current-month activities"} />
        <div style={{ flex: 1, background: "#fff", border: "1px solid #1f4e79", borderTop: "none" }} />
      </div>
    </MonthlySheet>
  );
}

function MonthlyIssuesSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const th: CSSProperties = { background: "#1f4e79", color: "#fff", border: "1px solid #163a5a", padding: "6px", fontSize: 13, fontWeight: 700, textAlign: "center" };
  const td: CSSProperties = { border: "1px solid #8aa0b4", background: "#fff" };
  return (
    <MonthlySheet title={fa ? "گزارش مشکلات و پیشنهادات" : "Issues and recommendations"} dense>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner navy text={fa ? "اهم مشکلات پروژه که منجر به تاخیر در انجام بموقع فعالیت های اجرائی و خرید کالای پروژه گردیده است" : "Key issues causing delay in execution and procurement"} />
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", flex: 1 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: "50%" }}>{fa ? "مشکلات در حین اجرا پروژه" : "Issues during execution"}</th>
              <th style={{ ...th, width: "50%" }}>{fa ? "راه کار ها و پیشنهادات" : "Actions and recommendations"}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 14 }, (_, i) => (
              <tr key={i}><td style={td} /><td style={td} /></tr>
            ))}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
  );
}

function MonthlyCorrespondenceSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const th: CSSProperties = { background: "#1f4e79", color: "#fff", border: "1px solid #163a5a", padding: "4px 3px", fontSize: 10, fontWeight: 700, textAlign: "center" };
  const td: CSSProperties = { border: "1px solid #8aa0b4", background: "#fff", fontSize: 10 };
  const block = (title: string, dateH: string, noH: string, count: number) => (
    <>
      <tr>
        <th style={{ ...th, width: 32, fontSize: 9 }}>{fa ? "ردیف" : "No."}</th>
        <th style={{ ...th, width: "58%" }}>{title}</th>
        <th style={{ ...th, width: "18%" }}>{dateH}</th>
        <th style={{ ...th, width: "20%" }}>{noH}</th>
      </tr>
      {Array.from({ length: count }, (_, i) => (
        <tr key={`${title}-${i}`}>
          <td style={{ ...td, width: 32, textAlign: "center", fontSize: 13, fontWeight: 700, fontFamily: "Vazirmatn, Tahoma, sans-serif" }}>{digits(i + 1, true)}</td>
          <td style={td} />
          <td style={td} />
          <td style={td} />
        </tr>
      ))}
    </>
  );
  return (
    <MonthlySheet title={fa ? "گزارش جلسات پیشبرد پروژه و مکاتبات" : "Progress meetings and correspondence"} dense landscape>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner text={fa ? "گزارش جلسات پیشبرد پروژه و مکاتبات" : "Progress meetings and correspondence"} />
        <ReportBanner navy text={fa ? "گزارشات" : "Reports"} />
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", flex: 1 }}>
          <colgroup>
            <col style={{ width: 32 }} />
            <col />
            <col />
            <col />
          </colgroup>
          <tbody>
            {block(fa ? "موضوع مکاتبات به کارفرما" : "Letters to employer", fa ? "تاریخ نامه" : "Date", fa ? "شماره نامه" : "Letter no.", 8)}
            {block(fa ? "موضوع مکاتبات وارده از کارفرما" : "Letters from employer", fa ? "تاریخ نامه" : "Date", fa ? "شماره نامه" : "Letter no.", 6)}
            {block(fa ? "موضوع صورتجلسات و گواهی انجام کار" : "Minutes and work certificates", fa ? "تاریخ صورتجلسه" : "Minutes date", fa ? "شماره صورتجلسه" : "Minutes no.", 6)}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
  );
}

function MonthlyWorkStoppageSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const cols = fa
    ? ["ردیف", "فعالیت متوقف شده", "علت توقف", "تاریخ توقف", "تاریخ شروع مجدد", "مسئول اجرا", "شماره نامه ارسالی به کارفرما", "تاریخ ارسال نامه به کارفرما", "تائید کننده", "توضیحات"]
    : ["No.", "Stopped activity", "Cause", "Stop date", "Restart date", "Responsible", "Letter no. to employer", "Letter date", "Approver", "Notes"];
  const th: CSSProperties = { background: "#1f4e79", color: "#fff", border: "1px solid #163a5a", padding: "6px 3px", fontSize: 8, fontWeight: 700, textAlign: "center", whiteSpace: "normal" };
  const td: CSSProperties = { border: "1px solid #8aa0b4", background: "#fff" };
  return (
    <MonthlySheet title={fa ? "گزارش توقف کاری" : "Work-stoppage report"} dense landscape>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner text={fa ? "گزارش توقف کاری" : "Work-stoppage report"} />
        <ReportBanner navy text={fa ? "توقفات" : "Stoppages"} />
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", flex: 1 }}>
          <colgroup>
            <col style={{ width: 32 }} />
            {cols.slice(1).map((col) => <col key={col} />)}
          </colgroup>
          <thead>
            <tr>{cols.map((col, c) => <th key={col} style={{ ...th, width: c === 0 ? 32 : undefined }}>{col}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => (
              <tr key={i}>
                {cols.map((col, c) => (
                  <td key={col} style={{ ...td, textAlign: "center", fontSize: c === 0 ? 13 : undefined, fontWeight: c === 0 ? 700 : undefined, fontFamily: c === 0 ? "Vazirmatn, Tahoma, sans-serif" : undefined }}>{c === 0 ? digits(i + 1, true) : ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
  );
}

function headerTable(cols: string[], rows: number, _fa: boolean, fill?: (r: number, c: number) => string) {
  const th: CSSProperties = { background: "#1f4e79", color: "#fff", border: "1px solid #163a5a", padding: "6px 3px", fontSize: 8, fontWeight: 700, textAlign: "center", whiteSpace: "normal" };
  const td: CSSProperties = { border: "1px solid #8aa0b4", background: "#fff", fontSize: 10, textAlign: "center" };
  const rowNo: CSSProperties = { ...td, width: 32, fontSize: 13, fontWeight: 700, fontFamily: "Vazirmatn, Tahoma, sans-serif" };
  return (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed", flex: 1 }}>
      <colgroup>
        <col style={{ width: 32 }} />
        {cols.slice(1).map((col) => <col key={col} />)}
      </colgroup>
      <thead>
        <tr>{cols.map((col, c) => <th key={col} style={{ ...th, width: c === 0 ? 32 : undefined, fontSize: c === 0 ? 9 : 8 }}>{col}</th>)}</tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {cols.map((col, c) => (
              <td key={col} style={c === 0 ? rowNo : td}>{fill ? fill(r, c) : c === 0 ? digits(r + 1, true) : ""}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MonthlyChangeWorkSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const cols = fa
    ? ["ردیف", "فعالیت قابل تغییر", "علت تغییر", "تاریخ تغییر", "تاریخ شروع", "مسئول اجرا", "فعالیت جدید", "شماره نامه ارسالی به کارفرما", "تائید کننده", "تاریخ ارسال نامه به", "توضیحات"]
    : ["No.", "Activity", "Cause", "Change date", "Start date", "Responsible", "New activity", "Letter no.", "Approver", "Letter date", "Notes"];
  return (
    <MonthlySheet title={fa ? "گزارش تغییر کار" : "Change-of-work report"} dense landscape>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner text={fa ? "گزارش تغییر کار" : "Change-of-work report"} />
        <ReportBanner navy text={fa ? "تغییر کار" : "Change of work"} />
        {headerTable(cols, 12, fa)}
      </div>
    </MonthlySheet>
  );
}

function MonthlyDelayedActivitiesSheet({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const cols = fa
    ? ["ردیف", "WBS", "شرح فعالیت دارای تاخیر", "شروع برنامه‌ای", "پایان برنامه‌ای", "دلیل تاخیر", "برنامه جهت برطرف کردن تاخیر", "تاریخ شروع واقعی", "تاریخ پایان واقعی", "واریانس شروع", "واریانس پایان"]
    : ["No.", "WBS", "Delayed activity", "Plan start", "Plan finish", "Delay reason", "Recovery plan", "Actual start", "Actual finish", "Start var.", "Finish var."];
  const delayed = (model?.rows ?? []).filter((row) => row.physicalPct + 0.5 < row.plannedPct);
  const date = (iso?: string) => (iso ? digits(isoToJalali(iso), fa) : "");
  const slip = (actual?: string, plan?: string) => {
    if (!actual || !plan) return "";
    return digits(calendarDays(plan, actual) - 1, fa);
  };
  const th: CSSProperties = { background: "#1f4e79", color: "#fff", border: "1px solid #163a5a", padding: "6px 3px", fontSize: 8, fontWeight: 700, textAlign: "center", whiteSpace: "normal" };
  const td: CSSProperties = { border: "1px solid #8aa0b4", background: "#fff", fontSize: 9, textAlign: "center" };
  const rowNo: CSSProperties = { ...td, width: 32, fontSize: 13, fontWeight: 700, fontFamily: "Vazirmatn, Tahoma, sans-serif" };
  const pad = Math.max(8, delayed.length);
  return (
    <MonthlySheet title={fa ? "گزارش فعالیت های متاثر از تاخیرات" : "Activities affected by delays"} dense landscape>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner text={fa ? "گزارش فعالیت های متاثر از تاخیرات" : "Activities affected by delays"} />
        <ReportBanner navy text={fa ? "گزارش فعالیت های دارای تاخیر" : "Delayed activities"} />
        <table className="w-full border-collapse" style={{ tableLayout: "fixed", flex: 1 }}>
          <colgroup>
            <col style={{ width: 32 }} />
            {cols.slice(1).map((col) => <col key={col} />)}
          </colgroup>
          <thead>
            <tr>{cols.map((col, c) => <th key={col} style={{ ...th, width: c === 0 ? 32 : undefined, fontSize: c === 0 ? 9 : 8 }}>{col}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: pad }, (_, i) => {
              const row = delayed[i];
              const cells = row
                ? [digits(i + 1, true), row.wbs, fa ? row.nameFa : row.nameEn, date(row.baselineStart), date(row.baselineFinish), "", "", date(row.actualStart), date(row.actualFinish), slip(row.actualStart, row.baselineStart), slip(row.actualFinish, row.baselineFinish)]
                : [digits(i + 1, true), ...cols.slice(1).map(() => "")];
              return (
                <tr key={row?.id ?? i}>
                  {cells.map((cell, c) => <td key={c} style={{ ...(c === 0 ? rowNo : td), textAlign: c === 2 ? "start" : "center" }}>{cell}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MonthlySheet>
  );
}

function MonthlySiteVisitSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const cols = fa
    ? ["ردیف", "موضوع بازدید", "تاریخ بازدید", "شماره جلسه", "بازدید کنندگان", "خلاصه نتایج بازدید"]
    : ["No.", "Subject", "Date", "Meeting no.", "Visitors", "Summary"];
  return (
    <MonthlySheet title={fa ? "گزارش بازدید کارشناسان فنی کارفرما از کارگاه" : "Employer technical site-visit report"} dense landscape>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner text={fa ? "گزارش بازدید کارشناسان فنی کارفرما از کارگاه" : "Employer technical site-visit report"} />
        <ReportBanner navy text={fa ? "وضعیت بازدید" : "Visit status"} />
        {headerTable(cols, 12, fa)}
      </div>
    </MonthlySheet>
  );
}

/*
 * گزارش بررسی نقشه‌های کارگاهی و ازبیلت — بند دوم فصل ششم فهرست.
 * موتور دادهٔ بازبینی نقشه ندارد؛ قاب جدول با ردیف‌های خالی می‌آید و
 * هیچ شماره/تاریخی از نمونهٔ اکسل کپی نمی‌شود.
 */
function MonthlyShopDrawingsSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const shopCols = fa
    ? ["ردیف", "شماره نقشه", "عنوان نقشه", "رشته", "تاریخ دریافت", "تاریخ بررسی", "وضعیت بررسی", "نظرات / اقدام اصلاحی"]
    : ["No.", "Drawing no.", "Drawing title", "Discipline", "Received", "Reviewed", "Review status", "Comments / corrective action"];
  const asBuiltCols = fa
    ? ["ردیف", "شماره نقشه", "عنوان نقشه", "رشته", "تاریخ دریافت ازبیلت", "تاریخ بررسی", "وضعیت بررسی", "نظرات / اقدام اصلاحی"]
    : ["No.", "Drawing no.", "Drawing title", "Discipline", "As-built received", "Reviewed", "Review status", "Comments / corrective action"];
  return (
    <MonthlySheet title={fa ? "گزارش بررسی نقشه‌های کارگاهی و ازبیلت" : "Shop-drawing and as-built review"} dense landscape>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner text={fa ? "گزارش بررسی نقشه‌های کارگاهی و ازبیلت" : "Shop-drawing and as-built review"} />
        <ReportBanner navy text={fa ? "نقشه‌های کارگاهی" : "Shop drawings"} />
        {headerTable(shopCols, 7, fa)}
        <ReportBanner navy text={fa ? "نقشه‌های ازبیلت" : "As-built drawings"} />
        {headerTable(asBuiltCols, 7, fa)}
      </div>
    </MonthlySheet>
  );
}

function MonthlyHseSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const cols = fa ? ["ردیف", "اهم اقدامات انجام شده واحد ایمنی در پروژه"] : ["No.", "Key HSE actions on the project"];
  return (
    <MonthlySheet title={fa ? "گزارش مدیریت HSE" : "HSE management report"} dense>
      <div className="h-full overflow-hidden bg-white font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column" }}>
        <ReportBanner text={fa ? "گزارش مدیریت HSE" : "HSE management report"} />
        <ReportBanner navy text={fa ? "ایمنی و محیط زیست" : "HSE"} />
        {headerTable(cols, 16, fa)}
      </div>
    </MonthlySheet>
  );
}

function MonthlyPhotoReportSheet({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  return (
    <MonthlySheet title={fa ? "گزارش مصور" : "Photographic report"} dense>
      <div className="h-full overflow-hidden bg-white px-[0.8%] py-[0.5%] font-sans text-[#152536]" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ textAlign: "end", fontSize: 12, color: "#1f4e79", fontWeight: 700 }}>{fa ? "گزارش مصور" : "Photo report"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "repeat(4, 1fr)", gap: 8, flex: 1, minHeight: 0 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", border: "1px solid #1f4e79", minHeight: 0 }}>
              <div style={{ flex: 1, background: "#eef2f5" }} />
              <div style={{ borderTop: "1px solid #1f4e79", padding: "4px 6px", fontSize: 9, minHeight: 28 }} />
            </div>
          ))}
        </div>
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

/* ══════════════════════════ پنل تحلیل گزارش (فقط دادهٔ موتور) ══════════════════════════ */

/**
 * تحلیل گزارش ماهانه — جایگزین قالب/خروجی نمایشی قبلی.
 * همهٔ اعداد از PexModel می‌آیند؛ متن تحلیل به‌صورت قاعده‌مند از همان
 * واقعیت‌ها ساخته می‌شود (بدون عدد ساختگی و بدون تظاهر به AI بیرونی).
 */
function MonthlyAnalysisPanel({ lang, model }: { lang: Lang; model?: PexModel }) {
  const fa = lang === "fa";
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const m = model;

  const facts: { label: string; value: string; tone: string }[] = m
    ? [
        { label: fa ? "پیشرفت واقعی" : "Actual progress", value: `${num(m.overallPct, fa)}%`, tone: "#34D399" },
        { label: fa ? "پیشرفت برنامه‌ای" : "Planned progress", value: `${num(m.plannedPct, fa)}%`, tone: "#7FB2FF" },
        { label: fa ? "انحراف پیشرفت" : "Progress variance", value: `${m.variance.deltaPct > 0 ? "+" : ""}${num(m.variance.deltaPct, fa)}%`, tone: m.variance.status === "behind" ? "#F87171" : "#34D399" },
        { label: fa ? "مایلستون در تأخیر" : "Delayed milestones", value: `${digits(m.milestones.filter((x) => x.status === "Delayed").length, fa)} / ${digits(m.milestones.length, fa)}`, tone: "#FBBF24" },
        { label: fa ? "سلامت زمان‌بندی (DCMA)" : "Schedule health (DCMA)", value: digits(m.dcma.healthScore, fa), tone: m.dcma.healthScore < 80 ? "#F87171" : "#34D399" },
        { label: fa ? "گام مسدود بابت IR" : "Steps blocked by IR", value: digits(m.blockedCount, fa), tone: "#FBBF24" },
      ]
    : [];

  const runAnalysis = () => {
    if (!m) return;
    const L: string[] = [];
    const delayed = m.milestones.filter((x) => x.status === "Delayed");
    const worst = [...m.wbsRollup].sort((a, b) => a.actualPct - a.plannedPct - (b.actualPct - b.plannedPct))[0];

    L.push(fa ? "■ جمع‌بندی اجرایی" : "■ Executive summary");
    L.push(
      fa
        ? `پیشرفت واقعی ${num(m.overallPct, fa)}٪ در برابر برنامهٔ ${num(m.plannedPct, fa)}٪ (انحراف ${num(m.variance.deltaPct, fa)}٪ — ${m.variance.status === "behind" ? "عقب‌افتاده" : "روی برنامه"}). ضعیف‌ترین بخش: ${worst ? `${fa ? worst.nameFa : worst.nameEn} با انحراف ${num(worst.actualPct - worst.plannedPct, fa)}٪` : "—"}.`
        : `Actual ${m.overallPct}% vs planned ${m.plannedPct}% (variance ${m.variance.deltaPct}% — ${m.variance.status}). Weakest WBS: ${worst ? `${worst.nameEn} at ${Math.round((worst.actualPct - worst.plannedPct) * 10) / 10}%` : "—"}.`,
    );

    L.push(fa ? "■ مایلستون‌ها و جریمه" : "■ Milestones & penalty");
    L.push(
      delayed.length
        ? delayed.map((x) => `• ${fa ? x.nameFa : x.nameEn}: ${fa ? "لغزش" : "slip"} ${digits(x.slipDays, fa)} ${fa ? "روز" : "d"}${x.penalty ? ` — ${fa ? "جریمه" : "penalty"} ${num(Math.round(x.penalty), fa, 0)} ${m.project.currency}` : ""}`).join("\n")
        : fa ? "مایلستونی در تأخیر نیست." : "No delayed milestone.",
    );

    L.push(fa ? "■ فعالیت‌های نزدیک‌بحرانی (شناوری کم)" : "■ Near-critical activities (low float)");
    L.push(
      m.nearCritical.length
        ? m.nearCritical.slice(0, 5).map((r) => `• ${r.id} — ${fa ? r.nameFa : r.nameEn} (${fa ? "شناوری" : "float"}: ${digits(r.totalFloat, fa)} ${fa ? "روز" : "d"}، پیشرفت ${num(r.physicalPct, fa)}٪ از ${num(r.plannedPct, fa)}٪ برنامه)`).join("\n")
        : fa ? "فعالیتی در آستانهٔ بحرانی‌شدن نیست." : "No near-critical activity.",
    );

    L.push(fa ? "■ موانع و هشدارها" : "■ Blockers & alerts");
    L.push(
      (fa ? `گام‌های مسدود بابت IR: ${digits(m.blockedCount, fa)} — پیشرفت آن‌ها وارد EV نشده است.` : `Steps blocked by IR: ${m.blockedCount} — excluded from EV.`)
      + (m.dcma.healthScore < 80 ? (fa ? ` سلامت زمان‌بندی ${digits(m.dcma.healthScore, fa)} (زیر ۸۰) است.` : ` Schedule health ${m.dcma.healthScore} (below 80).`) : "")
      + (m.alerts.length ? `\n${m.alerts.slice(0, 5).map((a) => `• ${a.message}`).join("\n")}` : ""),
    );

    L.push(fa ? "■ تصمیم‌ها و اقدامات اصلاحی" : "■ Decisions & corrective actions");
    const acts: string[] = [];
    if (m.variance.status === "behind") acts.push(fa ? "برنامهٔ جبرانی (Recovery) برای ضعیف‌ترین بخش تصویب و Action Plan سی‌روزه به‌روز شود." : "Approve a recovery plan for the weakest WBS and refresh the 30-day action plan.");
    if (delayed.length) acts.push(fa ? "برای مایلستون‌های در تأخیر، تاریخ جبرانی و مسئول مشخص شود؛ اثر جریمه در جریان نقدی دیده شود." : "Set recovery dates and owners for delayed milestones; reflect penalty in cash flow.");
    if (m.blockedCount > 0) acts.push(fa ? "رفع فوری گام‌های مسدود IR تا پیشرفت واقعی در EV بنشیند." : "Unblock IR-gated steps so earned value reflects reality.");
    if (m.dcma.healthScore < 80) acts.push(fa ? "بازبینی منطق شبکه و قیود زمان‌بندی (DCMA زیر ۸۰)." : "Review network logic and constraints (DCMA below 80).");
    if (m.nearCritical.length) acts.push(fa ? "پایش روزانهٔ فعالیت‌های نزدیک‌بحرانی و تثبیت شناوری آن‌ها." : "Daily monitoring of near-critical activities to protect their float.");
    if (!acts.length) acts.push(fa ? "روند فعلی حفظ شود؛ تصمیم خاصی لازم نیست." : "Sustain current trend; no special decision required.");
    L.push(acts.map((a, i) => `${digits(i + 1, fa)}. ${a}`).join("\n"));

    if (notes.trim()) L.push(`${fa ? "■ یادداشت مدیر پروژه" : "■ PM note"}\n${notes.trim()}`);
    setResult(L.join("\n\n"));
  };

  return (
    <div className="monthly-report-no-print flex flex-col gap-3" dir={fa ? "rtl" : "ltr"}>
      <section className="glass-dark rounded-2xl px-3 py-2.5">
        <h3 className="text-[12px] tx1">✨ {fa ? "تحلیل گزارش ماهانه" : "Monthly report analysis"}</h3>
        <p className="text-[8.5px] tx3">{fa ? "فقط بر پایهٔ دادهٔ موتور برنامه‌ریزی؛ بدون عدد ساختگی" : "Built only on planning-engine data; no invented figures"}</p>
      </section>
      {!m ? (
        <p className="py-6 text-center text-[10px] tx3">{fa ? "دادهٔ موتور در دسترس نیست." : "Engine data is unavailable."}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
            {facts.map((f) => (
              <div key={f.label} className="glass-dark rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full" style={{ background: f.tone }} />
                  <span className="truncate text-[9px] tx3">{f.label}</span>
                </div>
                <div className="mt-2 text-[16px] tabular-nums tx1" dir="ltr">{f.value}</div>
              </div>
            ))}
          </div>
          <div className="glass-dark rounded-2xl p-3">
            <h4 className="mb-2 text-[11px] tx1">{fa ? "انحراف بخش‌ها (WBS)" : "WBS variance"}</h4>
            <table className="w-full table-fixed border-collapse text-[10px] tx2">
              <thead>
                <tr className="tx3">
                  <th className="px-2 py-1 text-start font-normal">{fa ? "بخش" : "WBS"}</th>
                  <th className="px-2 py-1 text-center font-normal">{fa ? "برنامه" : "Planned"}</th>
                  <th className="px-2 py-1 text-center font-normal">{fa ? "واقعی" : "Actual"}</th>
                  <th className="px-2 py-1 text-center font-normal">{fa ? "انحراف" : "Variance"}</th>
                </tr>
              </thead>
              <tbody>
                {m.wbsRollup.map((w) => {
                  const v = w.actualPct - w.plannedPct;
                  return (
                    <tr key={w.id} className="border-t b-line-soft">
                      <td className="px-2 py-1">{fa ? w.nameFa : w.nameEn}</td>
                      <td className="px-2 py-1 text-center tabular-nums" dir="ltr">{num(w.plannedPct, fa)}%</td>
                      <td className="px-2 py-1 text-center tabular-nums" dir="ltr">{num(w.actualPct, fa)}%</td>
                      <td className="px-2 py-1 text-center tabular-nums" dir="ltr" style={{ color: v < -0.05 ? "#F87171" : "#34D399" }}>{v > 0 ? "+" : ""}{num(v, fa)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={fa ? "یادداشت‌ها و نکات مدیریتی این ماه…" : "Management notes for this month…"}
            className="h-20 w-full resize-none rounded-xl border b-line-soft bg-[var(--row)] px-3 py-2 text-[10.5px] tx1 outline-none focus:border-[var(--accent)]"
          />
          <div>
            <button type="button" onClick={runAnalysis} className="rounded-lg border border-fuchsia-400/55 bg-fuchsia-400/10 px-3 py-1.5 text-[10px] text-fuchsia-300 transition hover:bg-fuchsia-400/20">
              {fa ? "تولید تحلیل از دادهٔ موتور" : "Generate analysis from engine data"}
            </button>
          </div>
          <div className="glass rounded-2xl p-4">
            <h4 className="text-[11px] tx1">{fa ? "خروجی تحلیل" : "Analysis output"}</h4>
            <div className="mt-3 whitespace-pre-line rounded-xl border b-line-soft bg-black/10 p-4 text-[11px] leading-6 tx2">
              {result ?? (fa ? "هنوز تحلیلی تولید نشده است." : "No analysis generated yet.")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════ پوستهٔ فضای کاری ══════════════════════════ */

export default function MonthlyReportWorkspace({ lang, model }: Props) {
  const fa = lang === "fa";

  /* بدون prop هم کار می‌کند (گرهٔ نقشهٔ قابلیت‌ها): همان پیش‌فرض موتور. */
  const m = useMemo(() => model ?? buildPexModel("Cost", 0.6), [model]);

  const storageKey = `${STORAGE_PREFIX}${m?.project.code ?? "default"}`;
  const [tab, setTab] = useState<MonthlyReportTab>("cover");
  const [openChapter, setOpenChapter] = useState<string | null>(null);

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
    tab === "pmsPsr" ||
    tab === "pmsConst" ||
    tab === "physCurve" ||
    tab === "physCurveE" ||
    tab === "physCurveP" ||
    tab === "physCurveC" ||
    tab === "weather" ||
    tab === "manpowerStats" ||
    tab === "machineryStats" ||
    tab === "resourceCharts" ||
    tab === "materials" ||
    tab === "resourceAnalysis" ||
    tab === "keyActivities" ||
    tab === "issues" ||
    tab === "correspondence" ||
    tab === "workStoppage" ||
    tab === "changeWork" ||
    tab === "delayedActivities" ||
    tab === "siteVisit" ||
    tab === "shopDrawings" ||
    tab === "costCurve" ||
    tab === "hse" ||
    tab === "photoReport" ||
    tab.startsWith("divider-");
  const dividerChapter = tab.startsWith("divider-")
    ? MONTHLY_INDEX_CHAPTERS[Number(tab.slice("divider-".length)) - 1]
    : undefined;

  /*
   * گروه‌بندی تب‌ها زیر فصل‌ها (برای برگشت آسان: MONTHLY_REPORT_TABS دست‌نخورده
   * می‌ماند؛ فقط رندر ناوبری گروهی می‌شود). کاور/فهرست/خلاصه/قالب تکی می‌مانند.
   */
  type NavGroup = { id: string; items: typeof MONTHLY_REPORT_TABS };
  const navGroups: NavGroup[] = [];
  for (const item of MONTHLY_REPORT_TABS) {
    const last = navGroups[navGroups.length - 1];
    if (item.id.startsWith("divider-")) navGroups.push({ id: item.id, items: [item] });
    else if (last && last.id.startsWith("divider-") && item.id !== "summary" && item.id !== "templates") last.items.push(item);
    else navGroups.push({ id: item.id, items: [item] });
  }
  const tabLabel = (id: MonthlyReportTab) => {
    const found = MONTHLY_REPORT_TABS.find((t) => t.id === id);
    return found ? (fa ? found.fa : found.en) : "";
  };
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
        @page { size: A4 ${tab === "pmsMdr" || tab === "pmsDdr" || tab === "pmsStatus" || tab === "pmsProc" || tab === "pmsPsr" || tab === "pmsConst" || tab === "physCurve" || tab === "physCurveE" || tab === "physCurveP" || tab === "physCurveC" || tab === "weather" || tab === "manpowerStats" || tab === "machineryStats" || tab === "resourceCharts" || tab === "materials" || tab === "resourceAnalysis" || tab === "correspondence" || tab === "workStoppage" || tab === "changeWork" || tab === "delayedActivities" || tab === "siteVisit" || tab === "shopDrawings" || tab === "costCurve" ? "landscape" : "portrait"}; margin: 6mm; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #monthly-report-print-root, #monthly-report-print-root * { visibility: visible !important; }
          #monthly-report-print-root {
            position: fixed !important; inset: 0 auto auto 0 !important; box-sizing: border-box !important;
            width: ${tab === "pmsMdr" || tab === "pmsDdr" || tab === "pmsStatus" || tab === "pmsProc" || tab === "pmsPsr" || tab === "pmsConst" || tab === "physCurve" || tab === "physCurveE" || tab === "physCurveP" || tab === "physCurveC" || tab === "weather" || tab === "manpowerStats" || tab === "machineryStats" || tab === "resourceCharts" || tab === "materials" || tab === "resourceAnalysis" || tab === "correspondence" || tab === "workStoppage" || tab === "changeWork" || tab === "delayedActivities" || tab === "siteVisit" || tab === "shopDrawings" || tab === "costCurve" ? "285mm" : "198mm"} !important; height: ${tab === "pmsMdr" || tab === "pmsDdr" || tab === "pmsStatus" || tab === "pmsProc" || tab === "pmsPsr" || tab === "pmsConst" || tab === "physCurve" || tab === "physCurveE" || tab === "physCurveP" || tab === "physCurveC" || tab === "weather" || tab === "manpowerStats" || tab === "machineryStats" || tab === "resourceCharts" || tab === "materials" || tab === "resourceAnalysis" || tab === "correspondence" || tab === "workStoppage" || tab === "changeWork" || tab === "delayedActivities" || tab === "siteVisit" || tab === "shopDrawings" || tab === "costCurve" ? "198mm" : "285mm"} !important; min-width: 0 !important; max-width: none !important;
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
        className="monthly-report-no-print sticky top-2 z-20 flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1 backdrop-blur"
        role="tablist"
        aria-label={fa ? "شیت‌های گزارش ماهانه" : "Monthly report sheets"}
      >
        {navGroups.map((group) => {
            const isChapter = group.id.startsWith("divider-");
            if (!isChapter) {
              const item = group.items[0];
              return (
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
              );
            }
            const activeInside = group.items.some((t) => t.id === tab);
            const open = openChapter === group.id;
            const chapterTitle = tabLabel(group.id as MonthlyReportTab);
            return (
              <span key={group.id} className="relative">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenChapter(open ? null : group.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] transition ${activeInside || open ? "toggle-on tx1" : "tx3 hover:tx1"}`}
                >
                  {chapterTitle} ▾
                </button>
                {open && (
                  <>
                    <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpenChapter(null)} className="fixed inset-0 z-30 cursor-default bg-transparent" />
                    <span className="absolute top-full z-40 mt-1 flex max-h-72 min-w-44 flex-col gap-0.5 overflow-y-auto rounded-xl border b-line-soft p-1 shadow-2xl" style={{ insetInlineStart: 0, backgroundColor: "#2e4f73", color: "#ffffff" }}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={tab === group.id}
                        onClick={() => { setTab(group.id as MonthlyReportTab); setOpenChapter(null); }}
                        style={tab === group.id ? { color: "#ffffff", backgroundColor: "rgba(255,255,255,0.16)" } : { color: "#ffffff" }}
                        className="rounded-lg px-2.5 py-1.5 text-start text-[10px] font-semibold transition hover:bg-white/10"
                      >
                        {fa ? `صفحهٔ ${chapterTitle}` : `${chapterTitle} divider`}
                      </button>
                      {group.items.slice(1).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        onClick={() => { setTab(item.id); setOpenChapter(null); }}
                        style={tab === item.id ? { color: "#ffffff", backgroundColor: "rgba(255,255,255,0.16)" } : { color: "#ffffff" }}
                        className="rounded-lg px-2.5 py-1.5 text-start text-[10px] transition hover:bg-white/10"
                      >
                        {fa ? item.fa : item.en}
                      </button>
                      ))}
                    </span>
                  </>
                )}
              </span>
            );
          })}
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
      {tab === "pmsPsr" && <MonthlyPsrSheet lang={lang} model={m} />}
      {tab === "pmsConst" && <MonthlyPmsProgressSheet lang={lang} model={m} wbsId="3" />}
      {tab === "physCurve" && <MonthlyPhysCurveSheet lang={lang} model={m} focus="epc" />}
      {tab === "physCurveE" && <MonthlyPhysCurveSheet lang={lang} model={m} focus="e" />}
      {tab === "physCurveP" && <MonthlyPhysCurveSheet lang={lang} model={m} focus="p" />}
      {tab === "physCurveC" && <MonthlyPhysCurveSheet lang={lang} model={m} focus="c" />}
      {tab === "costCurve" && <MonthlyCostCurveSheet lang={lang} model={m} />}
      {tab === "weather" && <MonthlyWeatherSheet lang={lang} model={m} />}
      {tab === "manpowerStats" && <MonthlyManpowerStatsSheet lang={lang} model={m} />}
      {tab === "machineryStats" && <MonthlyMachineryStatsSheet lang={lang} model={m} />}
      {tab === "resourceCharts" && <MonthlyResourceChartsSheet lang={lang} model={m} />}
      {tab === "materials" && <MonthlyMaterialsSheet lang={lang} />}
      {tab === "resourceAnalysis" && <MonthlyResourceAnalysisSheet lang={lang} model={m} />}
      {tab === "keyActivities" && <MonthlyKeyActivitiesSheet lang={lang} />}
      {tab === "issues" && <MonthlyIssuesSheet lang={lang} />}
      {tab === "correspondence" && <MonthlyCorrespondenceSheet lang={lang} />}
      {tab === "workStoppage" && <MonthlyWorkStoppageSheet lang={lang} />}
      {tab === "changeWork" && <MonthlyChangeWorkSheet lang={lang} />}
      {tab === "delayedActivities" && <MonthlyDelayedActivitiesSheet lang={lang} model={m} />}
      {tab === "siteVisit" && <MonthlySiteVisitSheet lang={lang} />}
      {tab === "shopDrawings" && <MonthlyShopDrawingsSheet lang={lang} />}
      {tab === "hse" && <MonthlyHseSheet lang={lang} />}
      {tab === "photoReport" && <MonthlyPhotoReportSheet lang={lang} />}
      {tab === "summary" && <MonthlySummarySheet cover={cover} lang={lang} model={m} />}

      {/* تحلیل گزارش: فقط دادهٔ موتور؛ قالب/خروجی نمایشی قبلی حذف شد. */}
      {tab === "templates" && <MonthlyAnalysisPanel lang={lang} model={m} />}
    </section>
  );
}
