/**
 * RPT — موتور مرکز گزارش‌ساز A4 سه‌لوگو
 * منبع یگانه منطق. آینه سرور با `npm run build:rpt` ساخته می‌شود.
 *
 * این ماژول شکاف مشترک PEX-G3، HRM-H06 و CKM-C01 را یک‌جا می‌بندد.
 *
 * اصول:
 * ۱) گزارش «ابلاغی/رسمی» بدون سه لوگو، شماره سند، نسخه و فهرست توزیع تولید نمی‌شود.
 * ۲) خروجی از دادهٔ ماژول‌ها مشتق می‌شود؛ گزارش هیچ عددی نمی‌سازد.
 * ۳) بدون وابستگی npm: PDF از مسیر چاپ مرورگر، Word و Excel از HTML، CSV با BOM.
 * ۴) سریال‌سازها تابع خالص‌اند تا در Node قابل تست باشند.
 */

export const REPORT_ENGINE_VERSION = "rpt-v1";

/* ══════════════════════════ هندسه A4 ══════════════════════════ */

/** ابعاد A4 بر حسب میلی‌متر و حاشیه استاندارد سربرگ سازمانی. */
export const A4 = {
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 32,   // فضای سربرگ سه‌لوگو
  marginBottomMm: 18, // فضای پاورقی و شماره صفحه
  marginSideMm: 15,
} as const;

/** ارتفاع مفید بدنه گزارش بر حسب میلی‌متر. */
export function usableHeightMm(): number {
  return A4.heightMm - A4.marginTopMm - A4.marginBottomMm;
}

/** تعداد ردیف جا شونده در هر صفحه با ارتفاع ردیف مشخص (میلی‌متر). */
export function rowsPerPage(rowHeightMm = 6, headerRowsMm = 14): number {
  return Math.max(1, Math.floor((usableHeightMm() - headerRowsMm) / rowHeightMm));
}

/** تقسیم ردیف‌ها به صفحات A4. */
export function paginate<T>(rows: T[], perPage = rowsPerPage()): T[][] {
  if (perPage <= 0) return [rows];
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}

/* ══════════════════════════ انواع ══════════════════════════ */

export type Bi = { fa: string; en: string };
export type Lang = "fa" | "en";

/** دو قالب مجزا طبق الزام: داخلی/کاربر و ابلاغی/رسمی. */
export type Audience = "internal" | "official";

export type Periodicity = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "milestone" | "adhoc";

export type Party = { name: string; logoText: string; role: Bi };

export type Letterhead = {
  projectName: string;
  projectCode: string;
  contractNo: string;
  /** سه لوگو: پیمانکار، کارفرما، مشاور */
  contractor: Party;
  client: Party;
  consultant: Party;
  docNo: string;
  revision: string;
  issueDate: string;
  periodLabel: string;
  classification: "internal" | "confidential" | "public";
  distribution: string[];
  preparedBy: string;
  approvedBy: string;
};

export type ColumnFormat = "text" | "number" | "percent" | "currency" | "date" | "status";

export type ColumnDef = {
  key: string;
  title: Bi;
  format?: ColumnFormat;
  align?: "start" | "center" | "end";
  /** سهم عرض ستون (وزن نسبی) */
  weight?: number;
};

export type Row = Record<string, string | number | undefined>;

export type KpiCell = { label: Bi; value: string; tone?: "good" | "warn" | "bad" };

export type ReportSection =
  | { kind: "kpi"; title: Bi; cells: KpiCell[] }
  | { kind: "table"; title: Bi; note?: Bi; columns: ColumnDef[]; rows: Row[] }
  | { kind: "text"; title: Bi; body: Bi };

export type ReportDef = {
  code: string;
  title: Bi;
  periodicity: Periodicity;
  /** ماژول مبدأ داده — گزارش هیچ عددی خودش نمی‌سازد (اصل ۲) */
  sourceModule: string;
  audiences: Audience[];
  sections: ReportSection[];
};

/* ══════════════════════════ رنگ‌بندی پریماورا ══════════════════════════ */

export type ScheduleStatus = "critical" | "near_critical" | "on_track" | "completed" | "not_started" | "baseline";

/**
 * پالت رنگ هم‌خوان با Primavera P6 برای نمودار میله‌ای و جدول.
 * قرمز = مسیر بحرانی، نارنجی = نزدیک بحرانی، آبی = تکمیل‌شده، سبز = در مسیر.
 */
export const PRIMAVERA_COLORS: Record<ScheduleStatus, string> = {
  critical: "#D0021B",
  near_critical: "#F5A623",
  on_track: "#2E9E4F",
  completed: "#1F6FB2",
  not_started: "#9B9B9B",
  baseline: "#4A4A4A",
};

/** نگاشت شناوری کل به وضعیت زمان‌بندی — قاعده مرسوم: TF ≤ 0 بحرانی، ≤ 10 نزدیک بحرانی. */
export function statusFromFloat(totalFloatDays: number, progressPct = 0): ScheduleStatus {
  if (progressPct >= 100) return "completed";
  if (progressPct <= 0 && totalFloatDays > 20) return "not_started";
  if (totalFloatDays <= 0) return "critical";
  if (totalFloatDays <= 10) return "near_critical";
  return "on_track";
}

export function primaveraColor(status: ScheduleStatus): string {
  return PRIMAVERA_COLORS[status];
}

/* ══════════════════════════ قالب‌بندی مقدار ══════════════════════════ */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toFaDigits(s: string): string {
  return s.replace(/\d/g, (d) => FA_DIGITS[+d]);
}

/** جداکننده هزارگان بدون وابستگی به Intl locale خاص. */
export function groupThousands(n: number): string {
  const neg = n < 0;
  const [int, frac] = Math.abs(n).toString().split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + (frac ? "." + frac : "");
}

export function formatValue(v: string | number | undefined, format: ColumnFormat = "text", lang: Lang = "fa"): string {
  if (v === undefined || v === null || v === "") return "—";
  const fa = lang === "fa";
  switch (format) {
    case "number": {
      const s = groupThousands(typeof v === "number" ? Math.round(v * 100) / 100 : Number(v));
      return fa ? toFaDigits(s) : s;
    }
    case "percent": {
      const n = typeof v === "number" ? v : Number(v);
      const s = `${Math.round(n * 10) / 10}%`;
      return fa ? toFaDigits(s) : s;
    }
    case "currency": {
      const s = groupThousands(Math.round(typeof v === "number" ? v : Number(v)));
      return fa ? toFaDigits(s) : s;
    }
    case "date":
      return fa ? toFaDigits(String(v)) : String(v);
    default:
      return String(v);
  }
}

/* ══════════════════════════ شماره سند و اعتبارسنجی ══════════════════════════ */

/**
 * شماره سند استاندارد: `{PROJECT}-{REPORT}-{SEQ}-R{REV}`
 * مثال: OG2401-RPT-M-0007-R01
 */
export function documentNumber(projectCode: string, reportCode: string, seq: number, revision: number): string {
  const s = String(seq).padStart(4, "0");
  const r = String(revision).padStart(2, "0");
  return `${projectCode}-${reportCode}-${s}-R${r}`;
}

export type Issue = { code: string; severity: "error" | "warning"; message: string };

/**
 * گزارش رسمی سختگیرانه‌تر از گزارش داخلی اعتبارسنجی می‌شود (اصل ۱).
 * گزارش داخلی می‌تواند بدون امضا و توزیع تولید شود؛ رسمی هرگز.
 */
export function validateLetterhead(lh: Letterhead, audience: Audience): Issue[] {
  const out: Issue[] = [];
  if (!lh.projectName?.trim()) out.push({ code: "E-RPT-101", severity: "error", message: "نام پروژه در سربرگ خالی است" });
  if (!lh.projectCode?.trim()) out.push({ code: "E-RPT-102", severity: "error", message: "کد پروژه الزامی است" });

  if (audience === "official") {
    const parties: [string, Party][] = [
      ["پیمانکار", lh.contractor],
      ["کارفرما", lh.client],
      ["مشاور", lh.consultant],
    ];
    for (const [label, p] of parties) {
      if (!p?.name?.trim() || !p?.logoText?.trim()) {
        out.push({ code: "E-RPT-103", severity: "error", message: `لوگو و نام ${label} برای گزارش رسمی الزامی است` });
      }
    }
    if (!lh.docNo?.trim()) out.push({ code: "E-RPT-104", severity: "error", message: "شماره سند برای گزارش رسمی الزامی است" });
    if (!lh.revision?.trim()) out.push({ code: "E-RPT-105", severity: "error", message: "شماره نسخه الزامی است" });
    if (!lh.distribution?.length) out.push({ code: "E-RPT-106", severity: "error", message: "فهرست توزیع برای گزارش رسمی الزامی است" });
    if (!lh.approvedBy?.trim()) out.push({ code: "E-RPT-107", severity: "error", message: "تأییدکننده گزارش رسمی مشخص نیست" });
    if (lh.classification === "internal") {
      out.push({ code: "W-RPT-301", severity: "warning", message: "طبقه‌بندی «داخلی» با ابلاغ رسمی سازگار نیست" });
    }
  } else {
    if (!lh.preparedBy?.trim()) out.push({ code: "W-RPT-302", severity: "warning", message: "تهیه‌کننده گزارش مشخص نیست" });
  }
  return out;
}

/** دروازه انتشار: گزارش رسمی با مسدودکننده باز صادر نمی‌شود. */
export function publishGate(
  audience: Audience,
  blockers: { openMajorNcr?: number; unapprovedPeriod?: boolean; timeBarBreach?: number }
): { ok: boolean; reasons: string[] } {
  if (audience === "internal") return { ok: true, reasons: [] };
  const reasons: string[] = [];
  if ((blockers.openMajorNcr ?? 0) > 0) reasons.push(`${blockers.openMajorNcr} عدم انطباق عمده باز`);
  if (blockers.unapprovedPeriod) reasons.push("دوره گزارش هنوز تأیید نشده است");
  if ((blockers.timeBarBreach ?? 0) > 0) reasons.push(`${blockers.timeBarBreach} نقض مهلت قراردادی`);
  return { ok: reasons.length === 0, reasons };
}

/* ══════════════════════════ سریال‌سازها (تابع خالص) ══════════════════════════ */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** فرار CSV طبق RFC 4180 — نقل‌قول دوتایی و بسته‌بندی در صورت وجود جداکننده. */
export function csvCell(s: string): string {
  const needsQuote = /[",\n\r;]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

/** CSV تمام بخش‌های جدولی گزارش. بخش‌های غیرجدولی به‌صورت سرسطر می‌آیند. */
export function toCsv(report: ReportDef, lang: Lang = "fa"): string {
  const lines: string[] = [];
  const T = (b: Bi) => (lang === "fa" ? b.fa : b.en);
  lines.push(csvCell(T(report.title)));
  lines.push("");
  for (const sec of report.sections) {
    lines.push(csvCell(T(sec.title)));
    if (sec.kind === "table") {
      lines.push(sec.columns.map((c) => csvCell(T(c.title))).join(","));
      for (const r of sec.rows) {
        lines.push(sec.columns.map((c) => csvCell(formatValue(r[c.key], c.format, lang))).join(","));
      }
    } else if (sec.kind === "kpi") {
      lines.push(sec.cells.map((c) => csvCell(T(c.label))).join(","));
      lines.push(sec.cells.map((c) => csvCell(c.value)).join(","));
    } else {
      lines.push(csvCell(T(sec.body)));
    }
    lines.push("");
  }
  return lines.join("\r\n");
}

/** سربرگ سه‌لوگو به‌صورت HTML — مشترک میان چاپ، Word و Excel. */
export function letterheadHtml(lh: Letterhead, audience: Audience, lang: Lang = "fa"): string {
  const fa = lang === "fa";
  const cell = (p: Party, side: string) => `
    <td class="lh-party" style="text-align:${side}">
      <div class="lh-logo">${escapeHtml(p.logoText)}</div>
      <div class="lh-name">${escapeHtml(p.name)}</div>
      <div class="lh-role">${escapeHtml(fa ? p.role.fa : p.role.en)}</div>
    </td>`;
  const badge = audience === "official"
    ? (fa ? "نسخه ابلاغی — رسمی" : "OFFICIAL ISSUE")
    : (fa ? "نسخه داخلی — کاری" : "INTERNAL — WORKING COPY");

  return `
  <table class="letterhead">
    <tr>
      ${cell(lh.contractor, fa ? "right" : "left")}
      <td class="lh-center">
        <div class="lh-project">${escapeHtml(lh.projectName)}</div>
        <div class="lh-code">${escapeHtml(lh.projectCode)} · ${escapeHtml(lh.contractNo)}</div>
        <div class="lh-badge ${audience}">${escapeHtml(badge)}</div>
      </td>
      ${cell(lh.consultant, "center")}
      ${cell(lh.client, fa ? "left" : "right")}
    </tr>
  </table>
  <table class="docbar">
    <tr>
      <td>${fa ? "شماره سند" : "Doc no"}: <b>${escapeHtml(lh.docNo || "—")}</b></td>
      <td>${fa ? "نسخه" : "Rev"}: <b>${escapeHtml(lh.revision || "—")}</b></td>
      <td>${fa ? "دوره" : "Period"}: <b>${escapeHtml(lh.periodLabel)}</b></td>
      <td>${fa ? "تاریخ صدور" : "Issued"}: <b>${escapeHtml(lh.issueDate)}</b></td>
    </tr>
  </table>`;
}

function sectionHtml(sec: ReportSection, lang: Lang): string {
  const T = (b: Bi) => (lang === "fa" ? b.fa : b.en);
  if (sec.kind === "kpi") {
    return `
    <div class="sec">
      <h3>${escapeHtml(T(sec.title))}</h3>
      <table class="kpi"><tr>
        ${sec.cells.map((c) => `<td class="${c.tone ?? ""}"><span class="k">${escapeHtml(T(c.label))}</span><span class="v">${escapeHtml(c.value)}</span></td>`).join("")}
      </tr></table>
    </div>`;
  }
  if (sec.kind === "text") {
    return `<div class="sec"><h3>${escapeHtml(T(sec.title))}</h3><p>${escapeHtml(T(sec.body))}</p></div>`;
  }
  return `
  <div class="sec">
    <h3>${escapeHtml(T(sec.title))}</h3>
    ${sec.note ? `<p class="note">${escapeHtml(T(sec.note))}</p>` : ""}
    <table class="grid">
      <thead><tr>${sec.columns.map((c) => `<th>${escapeHtml(T(c.title))}</th>`).join("")}</tr></thead>
      <tbody>
        ${sec.rows
          .map(
            (r) => `<tr>${sec.columns
              .map((c) => {
                const raw = r[c.key];
                const isStatus = c.format === "status";
                const color = isStatus ? primaveraColor(String(raw) as ScheduleStatus) : "";
                const txt = isStatus ? statusLabel(String(raw) as ScheduleStatus, lang) : formatValue(raw, c.format, lang);
                const style = isStatus ? ` style="color:#fff;background:${color}"` : ` style="text-align:${c.align ?? "start"}"`;
                return `<td${style}>${escapeHtml(txt)}</td>`;
              })
              .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
}

export function statusLabel(s: ScheduleStatus, lang: Lang = "fa"): string {
  const map: Record<ScheduleStatus, Bi> = {
    critical: { fa: "بحرانی", en: "Critical" },
    near_critical: { fa: "نزدیک بحرانی", en: "Near critical" },
    on_track: { fa: "در مسیر", en: "On track" },
    completed: { fa: "تکمیل‌شده", en: "Completed" },
    not_started: { fa: "شروع‌نشده", en: "Not started" },
    baseline: { fa: "برنامه پایه", en: "Baseline" },
  };
  return lang === "fa" ? map[s].fa : map[s].en;
}

/** شیوه‌نامه چاپ A4 — عمداً درون‌خطی است تا `src/index.css` دست نخورد. */
export function printCss(lang: Lang = "fa"): string {
  const dir = lang === "fa" ? "rtl" : "ltr";
  return `
  @page { size: A4 ${A4.widthMm}mm ${A4.heightMm}mm; margin: ${A4.marginTopMm}mm ${A4.marginSideMm}mm ${A4.marginBottomMm}mm; }
  * { box-sizing: border-box; }
  body { direction: ${dir}; font-family: Vazirmatn, Tahoma, sans-serif; color: #111; font-size: 9.5pt; margin: 0; }
  .letterhead { width: 100%; border-collapse: collapse; border-bottom: 2px solid #1F6FB2; padding-bottom: 4mm; }
  .lh-party { width: 22%; vertical-align: top; }
  .lh-logo { font-weight: 700; font-size: 11pt; border: 1px solid #999; border-radius: 3mm; padding: 2mm; display: inline-block; min-width: 22mm; text-align: center; }
  .lh-name { font-size: 8pt; margin-top: 1mm; }
  .lh-role { font-size: 7pt; color: #666; }
  .lh-center { text-align: center; }
  .lh-project { font-weight: 700; font-size: 13pt; }
  .lh-code { font-size: 8pt; color: #555; }
  .lh-badge { margin-top: 1.5mm; font-size: 8pt; padding: 1mm 3mm; border-radius: 2mm; display: inline-block; }
  .lh-badge.official { background: #1F6FB2; color: #fff; }
  .lh-badge.internal { background: #eee; color: #444; border: 1px dashed #999; }
  .docbar { width: 100%; border-collapse: collapse; margin-top: 2mm; font-size: 8pt; }
  .docbar td { border: 1px solid #ccc; padding: 1mm 2mm; }
  .sec { margin-top: 5mm; page-break-inside: avoid; }
  .sec h3 { font-size: 10.5pt; margin: 0 0 2mm; border-inline-start: 3mm solid #1F6FB2; padding-inline-start: 2mm; }
  .note { font-size: 8pt; color: #666; margin: 0 0 2mm; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.grid th { background: #EDF2F7; border: 1px solid #B8C4CE; padding: 1.4mm; text-align: start; font-weight: 600; }
  table.grid td { border: 1px solid #CBD5E0; padding: 1.2mm; }
  table.grid tbody tr:nth-child(even) { background: #F7FAFC; }
  table.kpi { width: 100%; border-collapse: collapse; }
  table.kpi td { border: 1px solid #CBD5E0; padding: 2mm; text-align: center; }
  table.kpi .k { display: block; font-size: 7.5pt; color: #555; }
  table.kpi .v { display: block; font-size: 12pt; font-weight: 700; }
  table.kpi td.good .v { color: #2E9E4F; }
  table.kpi td.warn .v { color: #F5A623; }
  table.kpi td.bad .v { color: #D0021B; }
  .signrow { margin-top: 8mm; width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .signrow td { border: 1px solid #CBD5E0; height: 18mm; vertical-align: top; padding: 1.5mm; width: 33.33%; }
  .dist { margin-top: 4mm; font-size: 8pt; color: #444; }
  .foot { margin-top: 4mm; border-top: 1px solid #ccc; padding-top: 1.5mm; font-size: 7.5pt; color: #666; display: flex; justify-content: space-between; }
  `;
}

/** سند کامل قابل چاپ — همین خروجی برای «ذخیره به PDF» مرورگر استفاده می‌شود. */
export function toPrintHtml(report: ReportDef, lh: Letterhead, audience: Audience, lang: Lang = "fa"): string {
  const fa = lang === "fa";
  const T = (b: Bi) => (fa ? b.fa : b.en);
  const sign = audience === "official"
    ? `<table class="signrow">
        <tr>
          <td>${fa ? "تهیه‌کننده" : "Prepared by"}<br/><b>${escapeHtml(lh.preparedBy)}</b></td>
          <td>${fa ? "تأییدکننده" : "Approved by"}<br/><b>${escapeHtml(lh.approvedBy)}</b></td>
          <td>${fa ? "مهر و امضای کارفرما" : "Client stamp"}</td>
        </tr>
      </table>
      <div class="dist"><b>${fa ? "فهرست توزیع:" : "Distribution:"}</b> ${escapeHtml(lh.distribution.join(fa ? "، " : ", "))}</div>`
    : "";

  return `<!doctype html>
<html lang="${lang}" dir="${fa ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><title>${escapeHtml(T(report.title))}</title><style>${printCss(lang)}</style></head>
<body>
  ${letterheadHtml(lh, audience, lang)}
  <h2 style="font-size:12pt;margin:4mm 0 0">${escapeHtml(T(report.title))}</h2>
  ${report.sections.map((s) => sectionHtml(s, lang)).join("")}
  ${sign}
  <div class="foot">
    <span>${escapeHtml(lh.projectCode)} · ${escapeHtml(lh.docNo || "—")}</span>
    <span>${escapeHtml(REPORT_ENGINE_VERSION)} · ${escapeHtml(lh.issueDate)}</span>
  </div>
</body></html>`;
}

/**
 * خروجی Word بدون کتابخانه: Word فایل HTML با پسوند .doc و
 * فضای‌نام Office را به‌درستی باز می‌کند و سربرگ و جدول حفظ می‌شود.
 */
export function toWordHtml(report: ReportDef, lh: Letterhead, audience: Audience, lang: Lang = "fa"): string {
  const body = toPrintHtml(report, lh, audience, lang);
  return body.replace(
    "<html ",
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" `
  );
}

/**
 * خروجی Excel بدون کتابخانه: جدول HTML با MIME اکسل.
 * فقط بخش‌های جدولی و KPI منتقل می‌شوند — فرمول و استایل چاپی معنا ندارد.
 */
export function toExcelHtml(report: ReportDef, lh: Letterhead, lang: Lang = "fa"): string {
  const fa = lang === "fa";
  const T = (b: Bi) => (fa ? b.fa : b.en);
  const tables = report.sections
    .map((sec) => {
      if (sec.kind === "table") {
        return `<table border="1"><tr><th colspan="${sec.columns.length}">${escapeHtml(T(sec.title))}</th></tr>
        <tr>${sec.columns.map((c) => `<th>${escapeHtml(T(c.title))}</th>`).join("")}</tr>
        ${sec.rows.map((r) => `<tr>${sec.columns.map((c) => `<td>${escapeHtml(c.format === "status" ? statusLabel(String(r[c.key]) as ScheduleStatus, lang) : formatValue(r[c.key], c.format, lang))}</td>`).join("")}</tr>`).join("")}
        </table><br/>`;
      }
      if (sec.kind === "kpi") {
        return `<table border="1"><tr><th colspan="${sec.cells.length}">${escapeHtml(T(sec.title))}</th></tr>
        <tr>${sec.cells.map((c) => `<th>${escapeHtml(T(c.label))}</th>`).join("")}</tr>
        <tr>${sec.cells.map((c) => `<td>${escapeHtml(c.value)}</td>`).join("")}</tr></table><br/>`;
      }
      return "";
    })
    .join("");

  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>
<body><h3>${escapeHtml(T(report.title))} — ${escapeHtml(lh.projectCode)} · ${escapeHtml(lh.periodLabel)}</h3>${tables}</body></html>`;
}

/** نام فایل استاندارد خروجی. */
export function exportFileName(report: ReportDef, lh: Letterhead, ext: "pdf" | "doc" | "xls" | "csv"): string {
  const safe = (s: string) => s.replace(/[^\w\u0600-\u06FF.-]+/g, "_");
  return `${safe(lh.projectCode)}_${safe(report.code)}_${safe(lh.revision || "R00")}.${ext}`;
}

/* ══════════════════════════ کاتالوگ ۱۴ گزارش ══════════════════════════ */

const col = (key: string, fa: string, en: string, format: ColumnFormat = "text", align: ColumnDef["align"] = "start"): ColumnDef => ({
  key,
  title: { fa, en },
  format,
  align,
});

/** ۱۴ گزارش استاندارد؛ کدها هم‌خوان با فهرست موجود در ورک‌اسپیس پایش. */
export const REPORT_CATALOG: ReportDef[] = [
  {
    code: "RPT-D",
    title: { fa: "گزارش روزانه کارگاه", en: "Daily Site Report" },
    periodicity: "daily",
    sourceModule: "d2 · برنامه‌ریزی و اجرا",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "خلاصه روز", en: "Day summary" },
        cells: [
          { label: { fa: "نیروی حاضر", en: "Headcount" }, value: "۳۴۸" },
          { label: { fa: "نفر-ساعت", en: "Man-hours" }, value: "۳٬۱۲۰" },
          { label: { fa: "پیشرفت روز", en: "Daily progress" }, value: "۰.۴٪", tone: "warn" },
          { label: { fa: "رویداد ایمنی", en: "HSE events" }, value: "۰", tone: "good" },
        ],
      },
      {
        kind: "table",
        title: { fa: "فعالیت‌های اجراشده", en: "Executed activities" },
        columns: [col("id", "فعالیت", "Activity"), col("desc", "شرح", "Description"), col("qty", "مقدار", "Qty", "number"), col("uom", "واحد", "UoM"), col("crew", "اکیپ", "Crew"), col("status", "وضعیت", "Status", "status")],
        rows: [
          { id: "A-1240", desc: "آرماتوربندی فونداسیون F-204", qty: 12.4, uom: "ton", crew: "CR-01", status: "critical" },
          { id: "A-1255", desc: "قالب‌بندی دیوار حائل محور ۷", qty: 186, uom: "m²", crew: "CR-02", status: "near_critical" },
          { id: "A-1310", desc: "جوشکاری اسپول SP-14", qty: 42, uom: "inch-dia", crew: "CR-07", status: "on_track" },
          { id: "A-1402", desc: "کابل‌کشی ترنچ TR-02", qty: 640, uom: "m", crew: "CR-11", status: "on_track" },
        ],
      },
    ],
  },
  {
    code: "RPT-W",
    title: { fa: "گزارش هفتگی پیشرفت", en: "Weekly Progress Report" },
    periodicity: "weekly",
    sourceModule: "d2 · d3",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "شاخص‌های هفته", en: "Weekly indicators" },
        cells: [
          { label: { fa: "پیشرفت واقعی", en: "Actual" }, value: "۷۵.۳٪" },
          { label: { fa: "پیشرفت برنامه", en: "Planned" }, value: "۸۵.۳٪" },
          { label: { fa: "انحراف", en: "Variance" }, value: "−۱۰.۰٪", tone: "bad" },
          { label: { fa: "SPI", en: "SPI" }, value: "۰.۸۸", tone: "warn" },
        ],
      },
      {
        kind: "table",
        title: { fa: "پیشرفت به تفکیک دیسیپلین", en: "Progress by discipline" },
        columns: [col("disc", "دیسیپلین", "Discipline"), col("plan", "برنامه", "Plan", "percent"), col("actual", "واقعی", "Actual", "percent"), col("var", "انحراف", "Var", "percent"), col("status", "وضعیت", "Status", "status")],
        rows: [
          { disc: "عمران", plan: 92, actual: 88, var: -4, status: "near_critical" },
          { disc: "سازه فلزی", plan: 78, actual: 71, var: -7, status: "critical" },
          { disc: "پایپینگ", plan: 64, actual: 52, var: -12, status: "critical" },
          { disc: "برق", plan: 41, actual: 39, var: -2, status: "on_track" },
          { disc: "ابزار دقیق", plan: 22, actual: 22, var: 0, status: "on_track" },
        ],
      },
    ],
  },
  {
    code: "RPT-BW",
    title: { fa: "گزارش دوهفتگی نگاه به جلو", en: "Biweekly Look-Ahead" },
    periodicity: "biweekly",
    sourceModule: "d2",
    audiences: ["internal"],
    sections: [
      {
        kind: "table",
        title: { fa: "فعالیت‌های دو هفته آینده", en: "Next two weeks" },
        columns: [col("id", "فعالیت", "Activity"), col("start", "شروع", "Start", "date"), col("finish", "پایان", "Finish", "date"), col("tf", "شناوری", "TF", "number"), col("status", "وضعیت", "Status", "status")],
        rows: [
          { id: "A-1420", start: "2026-09-10", finish: "2026-09-18", tf: 0, status: "critical" },
          { id: "A-1433", start: "2026-09-12", finish: "2026-09-20", tf: 6, status: "near_critical" },
          { id: "A-1450", start: "2026-09-14", finish: "2026-09-24", tf: 18, status: "on_track" },
        ],
      },
    ],
  },
  {
    code: "RPT-M",
    title: { fa: "گزارش ماهانه مدیریتی", en: "Monthly Management Report" },
    periodicity: "monthly",
    sourceModule: "d3 · d5",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "وضعیت کلان", en: "Overall status" },
        cells: [
          { label: { fa: "امتیاز سلامت", en: "Health score" }, value: "۷۱", tone: "warn" },
          { label: { fa: "CPI", en: "CPI" }, value: "۰.۹۴", tone: "warn" },
          { label: { fa: "SPI", en: "SPI" }, value: "۰.۸۸", tone: "warn" },
          { label: { fa: "هشدار باز", en: "Open alerts" }, value: "۱۱", tone: "bad" },
        ],
      },
      {
        kind: "table",
        title: { fa: "خلاصه هزینه", en: "Cost summary" },
        columns: [col("cbs", "کد هزینه", "CBS"), col("budget", "بودجه", "Budget", "currency"), col("actual", "هزینه واقعی", "Actual", "currency"), col("evv", "ارزش کسب‌شده", "EV", "currency"), col("cv", "انحراف هزینه", "CV", "currency")],
        rows: [
          { cbs: "CBS-1", budget: 4200000, actual: 3980000, evv: 3720000, cv: -260000 },
          { cbs: "CBS-2", budget: 6800000, actual: 5410000, evv: 5220000, cv: -190000 },
          { cbs: "CBS-3", budget: 3100000, actual: 1240000, evv: 1290000, cv: 50000 },
        ],
      },
      { kind: "text", title: { fa: "جمع‌بندی مدیر پروژه", en: "PM narrative" }, body: { fa: "انحراف پیشرفت عمدتاً ناشی از کمبود جوشکار ۶G و تأخیر تحویل زمین منطقه ۳ است. برنامه جبرانی در دست اجراست.", en: "Progress variance driven by 6G welder shortage and Area 3 land handover delay. Recovery plan in progress." } },
    ],
  },
  {
    code: "RPT-Q",
    title: { fa: "گزارش فصلی پورتفولیو", en: "Quarterly Portfolio Report" },
    periodicity: "quarterly",
    sourceModule: "d3 · d6",
    audiences: ["official"],
    sections: [
      {
        kind: "table",
        title: { fa: "وضعیت پروژه‌های خوشه", en: "Cluster projects" },
        columns: [col("proj", "پروژه", "Project"), col("progress", "پیشرفت", "Progress", "percent"), col("spi", "SPI", "SPI", "number"), col("cpi", "CPI", "CPI", "number"), col("status", "وضعیت", "Status", "status")],
        rows: [
          { proj: "OG-2401", progress: 75.3, spi: 0.88, cpi: 0.94, status: "near_critical" },
          { proj: "OG-2312", progress: 96.1, spi: 1.01, cpi: 0.99, status: "on_track" },
          { proj: "PC-2205", progress: 100, spi: 1, cpi: 1.03, status: "completed" },
        ],
      },
    ],
  },
  {
    code: "RPT-GATE",
    title: { fa: "گزارش دروازه مرحله‌ای", en: "Stage Gate Report" },
    periodicity: "milestone",
    sourceModule: "d6",
    audiences: ["official"],
    sections: [
      {
        kind: "table",
        title: { fa: "معیارهای دروازه", en: "Gate criteria" },
        columns: [col("crit", "معیار", "Criterion"), col("target", "هدف", "Target"), col("actual", "وضعیت فعلی", "Actual"), col("verdict", "نتیجه", "Verdict")],
        rows: [
          { crit: "تکمیل مهندسی پایه", target: "۱۰۰٪", actual: "۱۰۰٪", verdict: "قبول" },
          { crit: "پانچ کلاس A باز", target: "۰", actual: "۳", verdict: "مشروط" },
          { crit: "تأیید HSE", target: "الزامی", actual: "اخذ شد", verdict: "قبول" },
        ],
      },
    ],
  },
  {
    code: "RPT-ADH",
    title: { fa: "گزارش موردی مدیریتی", en: "Ad-hoc Management Report" },
    periodicity: "adhoc",
    sourceModule: "همه ماژول‌ها",
    audiences: ["internal"],
    sections: [{ kind: "text", title: { fa: "موضوع", en: "Subject" }, body: { fa: "گزارش موردی بر اساس درخواست مدیریت تولید می‌شود و ساختار آن انعطاف‌پذیر است.", en: "Ad-hoc report generated on management request with flexible structure." } }],
  },
  {
    code: "RPT-TRD",
    title: { fa: "گزارش روند و پیش‌بینی", en: "Trend & Forecast Report" },
    periodicity: "monthly",
    sourceModule: "d3",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "table",
        title: { fa: "روند شاخص‌ها", en: "Indicator trend" },
        columns: [col("period", "دوره", "Period"), col("spi", "SPI", "SPI", "number"), col("cpi", "CPI", "CPI", "number"), col("eac", "EAC", "EAC", "currency")],
        rows: [
          { period: "1405-04", spi: 0.94, cpi: 0.97, eac: 14800000 },
          { period: "1405-05", spi: 0.91, cpi: 0.95, eac: 15100000 },
          { period: "1405-06", spi: 0.88, cpi: 0.94, eac: 15400000 },
        ],
      },
    ],
  },
  {
    code: "RPT-EXEC",
    title: { fa: "گزارش یک‌صفحه‌ای مدیران ارشد", en: "One-Page Executive Report" },
    periodicity: "monthly",
    sourceModule: "d3",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "یک نگاه", en: "At a glance" },
        cells: [
          { label: { fa: "پیشرفت", en: "Progress" }, value: "۷۵.۳٪" },
          { label: { fa: "انحراف زمان", en: "Time var" }, value: "+۱۱ روز", tone: "bad" },
          { label: { fa: "جریمه پیش‌بینی", en: "Forecast LD" }, value: "۱۶۱٬۰۰۰ $", tone: "bad" },
          { label: { fa: "سلامت", en: "Health" }, value: "۷۱", tone: "warn" },
        ],
      },
    ],
  },
  {
    code: "RPT-EV",
    title: { fa: "گزارش ارزش کسب‌شده", en: "Earned Value Report" },
    periodicity: "monthly",
    sourceModule: "d3 · d5",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "table",
        title: { fa: "شاخص‌های EVM", en: "EVM measures" },
        columns: [col("m", "شاخص", "Measure"), col("v", "مقدار", "Value", "currency"), col("note", "توضیح", "Note")],
        rows: [
          { m: "PV", v: 12100000, note: "ارزش برنامه‌ای تا تاریخ گزارش" },
          { m: "EV", v: 10230000, note: "ارزش کسب‌شده از پیشرفت تأییدشده" },
          { m: "AC", v: 10880000, note: "هزینه واقعی ثبت‌شده" },
          { m: "BAC", v: 14500000, note: "بودجه کل" },
        ],
      },
    ],
  },
  {
    code: "RPT-VA",
    title: { fa: "گزارش تحلیل انحراف", en: "Variance Analysis Report" },
    periodicity: "monthly",
    sourceModule: "d3 · d4",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "table",
        title: { fa: "انحراف‌های بحرانی", en: "Critical variances" },
        columns: [col("item", "قلم", "Item"), col("var", "انحراف", "Variance", "percent"), col("cause", "ریشه", "Root cause"), col("owner", "مالک", "Owner"), col("status", "وضعیت", "Status", "status")],
        rows: [
          { item: "پایپینگ منطقه ۳", var: -12, cause: "کمبود جوشکار ۶G", owner: "منابع انسانی", status: "critical" },
          { item: "تحویل زمین منطقه ۳", var: -8, cause: "تأخیر کارفرما", owner: "مدیر قرارداد", status: "critical" },
          { item: "سازه فلزی", var: -7, cause: "تأخیر تأمین ورق", owner: "تدارکات", status: "near_critical" },
        ],
      },
    ],
  },
  {
    code: "RPT-KPI",
    title: { fa: "گزارش شاخص‌های کلیدی", en: "KPI Dashboard Report" },
    periodicity: "monthly",
    sourceModule: "d3 · d10 · d11",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "table",
        title: { fa: "شاخص‌های چندماژولی", en: "Cross-module KPIs" },
        columns: [col("kpi", "شاخص", "KPI"), col("src", "ماژول", "Module"), col("val", "مقدار", "Value"), col("target", "هدف", "Target"), col("verdict", "وضعیت", "Verdict")],
        rows: [
          { kpi: "شاخص بهره‌وری نیرو", src: "d10", val: "۰.۹۲", target: "≥ ۱.۰۰", verdict: "زرد" },
          { kpi: "انحراف تجهیز نیرو", src: "d10", val: "−۱۲٪", target: "±۱۰٪", verdict: "قرمز" },
          { kpi: "میانگین زمان پاسخ نامه", src: "d11", val: "۳ روز", target: "≤ ۱۰", verdict: "سبز" },
          { kpi: "نرخ استفاده از دانش", src: "d11", val: "۶۲٪", target: "≥ ۴۰٪", verdict: "سبز" },
          { kpi: "نرخ قبولی نخست بازرسی", src: "d8", val: "۵۰٪", target: "≥ ۹۰٪", verdict: "قرمز" },
        ],
      },
    ],
  },
  {
    code: "RPT-ALT",
    title: { fa: "گزارش هشدارهای زودهنگام", en: "Early Warning Report" },
    periodicity: "weekly",
    sourceModule: "همه ماژول‌ها",
    audiences: ["internal"],
    sections: [
      {
        kind: "table",
        title: { fa: "هشدارهای باز", en: "Open alerts" },
        columns: [col("code", "کد", "Code"), col("msg", "شرح", "Message"), col("sev", "شدت", "Severity"), col("age", "عمر (روز)", "Age", "number")],
        rows: [
          { code: "EWS-CKM-01", msg: "دو اعلان قراردادی از مهلت گذشته", sev: "بحرانی", age: 6 },
          { code: "EWS-HRM-01", msg: "انحراف تجهیز نیرو −۱۲٪", sev: "بالا", age: 14 },
          { code: "EWS-QMS-03", msg: "نرخ تعمیر جوش بالای آستانه", sev: "بالا", age: 9 },
        ],
      },
    ],
  },
  {
    code: "RPT-ACT",
    title: { fa: "گزارش اکشن‌پلن و مصوبات", en: "Action Plan & Commitments Report" },
    periodicity: "weekly",
    sourceModule: "d3 · d11",
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "table",
        title: { fa: "اقدامات باز", en: "Open actions" },
        columns: [col("id", "شناسه", "ID"), col("title", "شرح", "Title"), col("owner", "مالک", "Owner"), col("due", "موعد", "Due", "date"), col("state", "وضعیت", "State")],
        rows: [
          { id: "A-2", title: "تأمین ۱۸ جوشکار ۶G", owner: "منابع انسانی", due: "2026-09-04", state: "معوق" },
          { id: "A-5", title: "توافق روش اندازه‌گیری کار خاکی", owner: "برنامه‌ریزی", due: "2026-08-28", state: "معوق" },
          { id: "A-7", title: "تحلیل تأخیر پنجره‌ای تیر تا شهریور", owner: "برنامه‌ریزی", due: "2026-09-15", state: "باز" },
        ],
      },
    ],
  },
];

export function reportByCode(code: string): ReportDef | undefined {
  return REPORT_CATALOG.find((r) => r.code === code);
}

/** شمار ردیف‌های جدولی یک گزارش — پایه برآورد تعداد صفحه. */
export function totalRows(report: ReportDef): number {
  return report.sections.reduce((a, s) => a + (s.kind === "table" ? s.rows.length : 0), 0);
}

export function estimatePages(report: ReportDef): number {
  return Math.max(1, paginate(new Array(totalRows(report)).fill(0)).length);
}
