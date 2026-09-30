/** موتور خالص جداول پشتیبان گزارش روزانه (dprt-v1) — بدون DOM و بدون node.
 *
 * چرا موتور جدا از کامپوننت:
 * فرمول‌های تجمعی و درصد باید در سه جا «یکی» باشند: جدول داخل مرورگر،
 * سابقه‌ای که سرور برمی‌گرداند، و آزمون‌ها. اگر فرمول در JSX دفن شود،
 * هر اصلاح دو جا واگرا می‌شود. پس همهٔ محاسبات و اعتبارسنجی اینجاست و
 * هم کلاینت مستقیم import می‌کند، هم سرور از روی باندل تولیدشده.
 *
 * تاریخ‌ها شمسی‌اند (`YYYY/MM/DD`) و ماه/سال با شکستن همان رشته به دست
 * می‌آیند — نیازی به کتابخانهٔ تبدیل نیست.
 */
import { DPR_MANPOWER } from "../data/dprManpower";
import { DPR_MACHINERY } from "../data/dprMachinery";

export const DPR_TABLES_VERSION = "dprt-v1";

export type DprReportStatus = "draft" | "submitted" | "approved";
/** عین مقادیر شیت اکسل (ستون وضعیت کارگاه). */
export type DprSiteStatus = "Active" | "In Active" | "SemiActive";
export const DPR_SITE_STATUSES: DprSiteStatus[] = ["Active", "In Active", "SemiActive"];

/** فهرست هوا از عکس خوانده شد (Sunny/Cyclone/Cloudy) و با موارد متعارف
 *  تکمیل شد؛ با تأیید کاربر قابل کم/زیاد شدن است. */
export const DPR_WEATHERS = ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Dusty", "Stormy", "Cyclone"] as const;
export type DprWeather = (typeof DPR_WEATHERS)[number];

export const JALALI_MONTHS_FA = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
] as const;

export const DPR_LIMITS = {
  projectCode: /^[A-Za-z0-9][A-Za-z0-9_.-]{0,60}$/,
  reportNoMax: 60,
  textShortMax: 120,
  textLongMax: 4000,
  activityTextMax: 300,
  maxChangeRows: 200,
  maxActivityRows: 500,
  countMax: 100000,
  qtyMax: 1e12,
} as const;

export interface DprSiteGeneral {
  reportDate: string;
  reportNo: string;
  siteStatus: DprSiteStatus | "";
  weather: string;
  humidity: number | null;
  avgTemp: number | null;
}

export interface DprNarrative {
  siteActivities: string;
  workFront: string;
  areaOfConcerns: string;
}

export interface DprManpowerEntry {
  pd: number;
  ad: number;
  pn: number;
  an: number;
}

export interface DprMachineryEntry {
  active: number;
  ready: number;
  repair: number;
  owner: string;
}

export interface DprChangeRow {
  date: string;
  refId: string;
  location: string;
  unit: string;
  discipline: string;
  activity: string;
  totalQty: number | null;
  thisQty: number | null;
  contractor: string;
  opsFa: string;
  noteFa: string;
}

export interface DprMainActivityRow {
  acCode: string;
  subPhase: string;
  dis: string;
  area: string;
  workPackage: string;
  subPackage: string;
  activity: string;
  unit: string;
  estimated: number | null;
  todayQty: number | null;
  startDate: string;
  endDate: string;
  executor: string;
  note: string;
}

export interface DprTablesReport {
  projectCode: string;
  reportDate: string;
  reportNo: string;
  status: DprReportStatus;
  site: DprSiteGeneral;
  narrative: DprNarrative;
  /** ذخیرهٔ تُنُک: فقط کدهایی که حداقل یک عدد غیرصفر/متن دارند. */
  manpower: Record<string, DprManpowerEntry>;
  machinery: Record<string, DprMachineryEntry>;
  changes: DprChangeRow[];
  activities: DprMainActivityRow[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DprHistory {
  changes: Record<string, number>;
  activities: Record<string, number>;
}

/* ── تاریخ شمسی ─────────────────────────────────────────────────── */

export interface JalaliParts {
  year: number;
  month: number;
  day: number;
}

/** تجزیهٔ سخت‌گیرانهٔ `YYYY/MM/DD` شمسی؛ نامعتبر ← null. */
export function splitReportDate(value: string): JalaliParts | null {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1) return null;
  const maxDay = month <= 6 ? 31 : month <= 11 ? 30 : 30;
  if (day > maxDay) return null;
  return { year, month, day };
}

export function jalaliMonthNameFa(month: number): string {
  return JALALI_MONTHS_FA[month - 1] ?? "";
}

/* ── شماره گزارش ────────────────────────────────────────────────── */

/** افزایش سریال انتهایی: `DRT-171` ← `DRT-172`؛ بدون دنبالهٔ عددی ← همان + `-2`. */
export function incrementTrailingNumber(reportNo: string): string {
  const s = (reportNo ?? "").trim();
  if (!s) return "";
  const m = /^(.*?)(\d+)\s*$/.exec(s);
  if (!m) return `${s}-2`;
  const [, head, digits] = m;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return `${head}${next}`;
}

/* ── پوستهٔ خالی ─────────────────────────────────────────────────── */

export function emptySite(date: string, reportNo: string): DprSiteGeneral {
  return { reportDate: date, reportNo, siteStatus: "", weather: "", humidity: null, avgTemp: null };
}

export function emptyNarrative(): DprNarrative {
  return { siteActivities: "", workFront: "", areaOfConcerns: "" };
}

export function emptyReport(projectCode: string, date: string, reportNo: string): DprTablesReport {
  return {
    projectCode,
    reportDate: date,
    reportNo,
    status: "draft",
    site: emptySite(date, reportNo),
    narrative: emptyNarrative(),
    manpower: {},
    machinery: {},
    changes: [],
    activities: [],
  };
}

/* ── جمع‌ها ─────────────────────────────────────────────────────── */

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export interface DprManpowerTotals {
  rows: Record<string, { day: number; night: number; total: number }>;
  byGroup: Record<string, { pd: number; ad: number; pn: number; an: number; total: number }>;
  direct: { pd: number; ad: number; pn: number; an: number; total: number };
  indirect: { pd: number; ad: number; pn: number; an: number; total: number };
  grand: { pd: number; ad: number; pn: number; an: number; total: number };
}

const zeroHead = () => ({ pd: 0, ad: 0, pn: 0, an: 0, total: 0 });

export function manpowerTotals(entries: Record<string, DprManpowerEntry | undefined>): DprManpowerTotals {
  const rows: DprManpowerTotals["rows"] = {};
  const byGroup: DprManpowerTotals["byGroup"] = {};
  const direct = zeroHead();
  const indirect = zeroHead();
  for (const master of DPR_MANPOWER) {
    const e = entries[master.code];
    const pd = num(e?.pd);
    const ad = num(e?.ad);
    const pn = num(e?.pn);
    const an = num(e?.an);
    const day = pd + ad;
    const night = pn + an;
    rows[master.code] = { day, night, total: day + night };
    const bucket = master.kind === "direct" ? direct : indirect;
    bucket.pd += pd;
    bucket.ad += ad;
    bucket.pn += pn;
    bucket.an += an;
    bucket.total += day + night;
    const g = (byGroup[master.group] ??= zeroHead());
    g.pd += pd;
    g.ad += ad;
    g.pn += pn;
    g.an += an;
    g.total += day + night;
  }
  const grand = zeroHead();
  for (const b of [direct, indirect]) {
    grand.pd += b.pd;
    grand.ad += b.ad;
    grand.pn += b.pn;
    grand.an += b.an;
    grand.total += b.total;
  }
  return { rows, byGroup, direct, indirect, grand };
}

export interface DprMachineryTotals {
  rows: Record<string, number>;
  byGroup: Record<string, { active: number; ready: number; repair: number; total: number }>;
  active: number;
  ready: number;
  repair: number;
  grand: number;
}

export function machineryTotals(entries: Record<string, DprMachineryEntry | undefined>): DprMachineryTotals {
  const rows: Record<string, number> = {};
  const byGroup: DprMachineryTotals["byGroup"] = {};
  let active = 0;
  let ready = 0;
  let repair = 0;
  for (const master of DPR_MACHINERY) {
    const e = entries[master.code];
    const a = num(e?.active);
    const r = num(e?.ready);
    const p = num(e?.repair);
    rows[master.code] = a + r + p;
    active += a;
    ready += r;
    repair += p;
    const g = (byGroup[master.group] ??= { active: 0, ready: 0, repair: 0, total: 0 });
    g.active += a;
    g.ready += r;
    g.repair += p;
    g.total += a + r + p;
  }
  return { rows, byGroup, active, ready, repair, grand: active + ready + repair };
}

/* ── فرمول‌های تجمعی (عین ستون‌های اکسل) ─────────────────────────── */

export interface DprCumResult {
  cum: number;
  remaining: number | null;
  pct: number | null;
}

/** ردیف Change Order: تجمعی = سابقه + این دوره؛ درصد تهی وقتی مقدار کل نیست. */
export function changeCalc(totalQty: number | null, prevCum: number, thisQty: number | null): DprCumResult {
  const total = num(totalQty);
  const prev = num(prevCum);
  const cur = num(thisQty);
  const cum = prev + cur;
  if (!(total > 0)) return { cum, remaining: null, pct: null };
  return { cum, remaining: total - cum, pct: (cum / total) * 100 };
}

export interface DprActivityResult {
  lastCum: number;
  cum: number;
  rem: number | null;
  lastPct: number | null;
  todayPct: number | null;
  cumPct: number | null;
}

/** ردیف فعالیت اصلی: دیروز از سابقه، تجمعی = دیروز + امروز. */
export function activityCalc(
  estimated: number | null,
  lastCum: number,
  todayQty: number | null,
): DprActivityResult {
  const est = num(estimated);
  const last = num(lastCum);
  const today = num(todayQty);
  const cum = last + today;
  if (!(est > 0)) return { lastCum: last, cum, rem: null, lastPct: null, todayPct: null, cumPct: null };
  return {
    lastCum: last,
    cum,
    rem: est - cum,
    lastPct: (last / est) * 100,
    todayPct: (today / est) * 100,
    cumPct: (cum / est) * 100,
  };
}

/** کلید پیوند سابقهٔ فعالیت: کد حساب + عنوان (هر دو trim). */
export function activityHistoryKey(acCode: string, activity: string): string {
  return `${(acCode ?? "").trim()}‖${(activity ?? "").trim()}`;
}

/** سابقهٔ تجمعی تا «قبل» از یک تاریخ، از روی گزارش‌های ذخیره‌شده.
 * همهٔ وضعیت‌ها (حتی پیش‌نویس) حساب می‌شوند، چون ورود اطلاعات روزبه‌روز
 * است و گزارش دیروز ممکن است هنوز تأیید نشده باشد؛ با تأیید/ویرایش،
 * مقدار زنده بازمحاسبه می‌شود. */
export function historyFromReports(
  reports: Pick<DprTablesReport, "reportDate" | "changes" | "activities">[],
  beforeDate: string,
): DprHistory {
  const changes: Record<string, number> = {};
  const activities: Record<string, number> = {};
  for (const r of reports) {
    if (!r || typeof r.reportDate !== "string" || r.reportDate >= beforeDate) continue;
    for (const c of r.changes ?? []) {
      const id = (c?.refId ?? "").trim();
      if (!id) continue;
      changes[id] = num(changes[id]) + num(c?.thisQty);
    }
    for (const a of r.activities ?? []) {
      const key = activityHistoryKey(a?.acCode ?? "", a?.activity ?? "");
      if (key === "‖") continue;
      activities[key] = num(activities[key]) + num(a?.todayQty);
    }
  }
  return { changes, activities };
}

/* ── اعتبارسنجی ─────────────────────────────────────────────────── */

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= DPR_LIMITS.countMax;
}

function isQty(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= DPR_LIMITS.qtyMax;
}

export interface DprValidation {
  ok: boolean;
  issues: string[];
}

/** اعتبارسنجی کامل گزارش؛ پیام‌ها فارسی و آمادهٔ نمایش‌اند. */
export function validateReport(input: unknown): DprValidation {
  const issues: string[] = [];
  const r = (input ?? {}) as Partial<DprTablesReport>;
  if (!r || typeof r !== "object") return { ok: false, issues: ["ساختار گزارش نامعتبر است"] };

  if (typeof r.projectCode !== "string" || !DPR_LIMITS.projectCode.test(r.projectCode)) {
    issues.push("کد پروژه نامعتبر است");
  }
  if (!splitReportDate(r.reportDate ?? "")) issues.push("تاریخ گزارش باید شمسی YYYY/MM/DD باشد (مثل 1403/08/26)");
  if (typeof r.reportNo !== "string" || !r.reportNo.trim() || r.reportNo.trim().length > DPR_LIMITS.reportNoMax) {
    issues.push("شماره گزارش خالی یا بیش از حد طولانی است");
  }
  if (!["draft", "submitted", "approved"].includes(String(r.status))) issues.push("وضعیت گزارش نامعتبر است");

  const site = r.site ?? ({} as DprSiteGeneral);
  if (site.siteStatus !== "" && !DPR_SITE_STATUSES.includes(site.siteStatus as DprSiteStatus)) {
    issues.push("وضعیت کارگاه باید یکی از Active / In Active / SemiActive باشد");
  }
  if (site.weather !== "" && !(DPR_WEATHERS as readonly string[]).includes(site.weather)) {
    issues.push("وضعیت هوا باید از فهرست انتخاب شود");
  }
  if (site.humidity !== null && site.humidity !== undefined) {
    if (typeof site.humidity !== "number" || !Number.isFinite(site.humidity) || site.humidity < 0 || site.humidity > 100) {
      issues.push("رطوبت باید عدد ۰ تا ۱۰۰ باشد");
    }
  }
  if (site.avgTemp !== null && site.avgTemp !== undefined) {
    if (typeof site.avgTemp !== "number" || !Number.isFinite(site.avgTemp) || site.avgTemp < -30 || site.avgTemp > 70) {
      issues.push("میانگین دما باید عدد ۳۰- تا ۷۰ باشد");
    }
  }

  const nar = r.narrative ?? ({} as DprNarrative);
  for (const [key, label] of [["siteActivities", "فعالیت‌های سایت"], ["workFront", "جبهه کاری"], ["areaOfConcerns", "نگرانی‌ها"]] as const) {
    const v = (nar as unknown as Record<string, unknown>)[key];
    if (v !== undefined && typeof v !== "string") issues.push(`متن «${label}» نامعتبر است`);
    else if (typeof v === "string" && v.length > DPR_LIMITS.textLongMax) issues.push(`متن «${label}» بیش از حد طولانی است`);
  }

  const manCodes = new Set(DPR_MANPOWER.map((m) => m.code));
  const man = r.manpower ?? {};
  if (man && typeof man === "object") {
    for (const [code, e] of Object.entries(man)) {
      if (!manCodes.has(code)) {
        issues.push(`کد نیروی انسانی ناشناخته است: ${code}`);
        continue;
      }
      const entry = (e ?? {}) as Partial<DprManpowerEntry>;
      for (const [k, label] of [["pd", "حاضر روز"], ["ad", "غایب روز"], ["pn", "حاضر شب"], ["an", "غایب شب"]] as const) {
        const v = entry[k];
        if (v !== undefined && !isCount(v)) issues.push(`${label} ردیف ${code} باید عدد صحیح نامنفی باشد`);
      }
    }
  } else {
    issues.push("بخش نیروی انسانی نامعتبر است");
  }

  const macCodes = new Set(DPR_MACHINERY.map((m) => m.code));
  const mac = r.machinery ?? {};
  if (mac && typeof mac === "object") {
    for (const [code, e] of Object.entries(mac)) {
      if (!macCodes.has(code)) {
        issues.push(`کد ماشین‌آلات ناشناخته است: ${code}`);
        continue;
      }
      const entry = (e ?? {}) as Partial<DprMachineryEntry>;
      for (const [k, label] of [["active", "فعال"], ["ready", "آماده"], ["repair", "تعمیر"]] as const) {
        const v = entry[k];
        if (v !== undefined && !isCount(v)) issues.push(`${label} ردیف ${code} باید عدد صحیح نامنفی باشد`);
      }
      if (entry.owner !== undefined && (typeof entry.owner !== "string" || entry.owner.length > DPR_LIMITS.textShortMax)) {
        issues.push(`مالکیت ردیف ${code} نامعتبر است`);
      }
    }
  } else {
    issues.push("بخش ماشین‌آلات نامعتبر است");
  }

  const changes = r.changes ?? [];
  if (!Array.isArray(changes)) issues.push("بخش تغییرات نامعتبر است");
  else {
    if (changes.length > DPR_LIMITS.maxChangeRows) issues.push("تعداد ردیف‌های تغییرات بیش از حد مجاز است");
    changes.forEach((c, i) => {
      const n = i + 1;
      if (!c || typeof c !== "object") {
        issues.push(`ردیف ${n} تغییرات نامعتبر است`);
        return;
      }
      if (!c.refId || typeof c.refId !== "string" || !c.refId.trim() || c.refId.length > DPR_LIMITS.textShortMax) {
        issues.push(`ردیف ${n} تغییرات: شناسه (ID) لازم است`);
      }
      if (c.date !== "" && !splitReportDate(c.date ?? "")) issues.push(`ردیف ${n} تغییرات: تاریخ نامعتبر است`);
      for (const [k, label] of [["location", "موقعیت"], ["unit", "واحد"], ["discipline", "دیسیپلین"], ["activity", "فعالیت"], ["contractor", "پیمانکار"]] as const) {
        const v = (c as unknown as Record<string, unknown>)[k];
        if (v !== undefined && (typeof v !== "string" || v.length > DPR_LIMITS.activityTextMax)) {
          issues.push(`ردیف ${n} تغییرات: «${label}» نامعتبر است`);
        }
      }
      for (const [k, label] of [["opsFa", "شرح عملیات"], ["noteFa", "توضیحات"]] as const) {
        const v = (c as unknown as Record<string, unknown>)[k];
        if (v !== undefined && (typeof v !== "string" || v.length > DPR_LIMITS.textLongMax)) {
          issues.push(`ردیف ${n} تغییرات: «${label}» نامعتبر است`);
        }
      }
      if (c.totalQty !== null && c.totalQty !== undefined && !isQty(c.totalQty)) {
        issues.push(`ردیف ${n} تغییرات: مقدار کل باید عدد نامنفی باشد`);
      }
      if (c.thisQty !== null && c.thisQty !== undefined && !isQty(c.thisQty)) {
        issues.push(`ردیف ${n} تغییرات: مقدار این دوره باید عدد نامنفی باشد`);
      }
    });
  }

  const acts = r.activities ?? [];
  if (!Array.isArray(acts)) issues.push("بخش فعالیت‌های اصلی نامعتبر است");
  else {
    if (acts.length > DPR_LIMITS.maxActivityRows) issues.push("تعداد ردیف‌های فعالیت بیش از حد مجاز است");
    acts.forEach((a, i) => {
      const n = i + 1;
      if (!a || typeof a !== "object") {
        issues.push(`ردیف ${n} فعالیت‌ها نامعتبر است`);
        return;
      }
      if (!a.activity || typeof a.activity !== "string" || !a.activity.trim() || a.activity.length > DPR_LIMITS.activityTextMax) {
        issues.push(`ردیف ${n} فعالیت‌ها: عنوان فعالیت لازم است`);
      }
      for (const [k, label] of [["acCode", "کد حساب"], ["subPhase", "زیرفاز"], ["dis", "دیسیپلین"], ["area", "ناحیه"], ["workPackage", "بسته کاری"], ["subPackage", "زیربسته"], ["unit", "واحد"], ["executor", "مجری"]] as const) {
        const v = (a as unknown as Record<string, unknown>)[k];
        if (v !== undefined && (typeof v !== "string" || v.length > DPR_LIMITS.textShortMax)) {
          issues.push(`ردیف ${n} فعالیت‌ها: «${label}» نامعتبر است`);
        }
      }
      if (a.note !== undefined && (typeof a.note !== "string" || a.note.length > DPR_LIMITS.textLongMax)) {
        issues.push(`ردیف ${n} فعالیت‌ها: توضیحات نامعتبر است`);
      }
      if (a.startDate !== "" && a.startDate !== undefined && !splitReportDate(a.startDate ?? "")) {
        issues.push(`ردیف ${n} فعالیت‌ها: تاریخ شروع نامعتبر است`);
      }
      if (a.endDate !== "" && a.endDate !== undefined && !splitReportDate(a.endDate ?? "")) {
        issues.push(`ردیف ${n} فعالیت‌ها: تاریخ پایان نامعتبر است`);
      }
      if (a.estimated !== null && a.estimated !== undefined && !isQty(a.estimated)) {
        issues.push(`ردیف ${n} فعالیت‌ها: برآورد باید عدد نامنفی باشد`);
      }
      if (a.todayQty !== null && a.todayQty !== undefined && !isQty(a.todayQty)) {
        issues.push(`ردیف ${n} فعالیت‌ها: مقدار امروز باید عدد نامنفی باشد`);
      }
    });
  }

  return { ok: issues.length === 0, issues };
}

/** گذار وضعیت سبک گزارش (پیش‌نویس ← ارسال ← تأیید)؛ مقصد نامعتبر ← null. */
export function nextReportStatus(
  from: DprReportStatus,
  action: "submit" | "approve" | "return",
): DprReportStatus | null {
  if (action === "submit" && from === "draft") return "submitted";
  if (action === "approve" && from === "submitted") return "approved";
  if (action === "return" && from === "submitted") return "draft";
  return null;
}

/* بازصادر فهرست‌های ثابت تا سرور و آزمون از یک درگاه بخوانند. */
export { DPR_MANPOWER } from "../data/dprManpower";
export { DPR_MACHINERY } from "../data/dprMachinery";
