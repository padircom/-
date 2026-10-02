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
  maxMaterialRows: 500,
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
  minTemp?: number | null;
  maxTemp?: number | null;
  workShift?: string;
  landStatus?: string;
}

export interface DprNarrative {
  siteActivities: string;
  workFront: string;
  areaOfConcerns: string;
  areaOfConcerns2?: string;
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
  activityId?: string;
  activityType?: string;
  acCode: string;
  subPhase: string;
  dis: string;
  area: string;
  workPackage: string;
  subPackage: string;
  wbsCode?: string;
  level?: string;
  activity: string;
  wv?: number | null;
  wf?: number | null;
  duration?: number | null;
  unit: string;
  boq?: number | null;
  estimated: number | null;
  todayQty: number | null;
  startDate: string;
  endDate: string;
  planPct?: number | null;
  actPct?: number | null;
  varPct?: number | null;
  executor: string;
  note: string;
}

/** ردیف متریال وارده به کارگاه — عین سرستون‌های شیت اکسل کاربر (۱۷ ستون).
 * «تناز» و «تراک» املای عین شیت است. سرستون دوازدهم (حجم/تعداد/وزن) از
 * روی عکس خوانده شد و نیاز به کنترل با اکسل دارد. خالص فعلاً ورود دستی
 * است؛ اگر در شیت فرمول (پر − خالی) است با اعلام کاربر محاسباتی می‌شود. */
export interface DprMaterialRow {
  group: string;
  itemCode: string;
  desc: string;
  truckNo: string;
  ticketNo: string;
  grade: string;
  unit: string;
  gross: number | null;
  tare: number | null;
  net: number | null;
  qtyVcn: number | null;
  tonnage: number | null;
  entryDate: string;
  entryTime: string;
  contractor: string;
  usage: string;
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
  materials: DprMaterialRow[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DprHistory {
  changes: Record<string, number>;
  activities: Record<string, number>;
  manpower?: Record<string, number>;
  machinery?: Record<string, number>;
  materialsByBlock?: Record<string, Record<string, { desc: string; unit: string; qty: number }>>;
}

/** تشخیص بلوک متریال در شیت گزارش روزانه از روی گروه یا شرح ردیف متریال وارده. */
export function materialBlockForRow(m: Pick<DprMaterialRow, "group" | "desc">): string {
  const g = `${m.group ?? ""} ${m.desc ?? ""}`.toLowerCase();
  if (g.includes("rebar") || g.includes("آرماتور") || g.includes("میلگرد")) return "rebar";
  if (g.includes("anchor") || g.includes("انکربولت") || g.includes("بولت")) return "anchorbolt";
  if (
    g.includes("batching") ||
    g.includes("بتن") ||
    g.includes("سیمان") ||
    g.includes("سیـمان") ||
    g.includes("شن") ||
    g.includes("ماسه") ||
    g.includes("الیاف")
  )
    return "batching";
  if (
    g.includes("steel") ||
    g.includes("سازه") ||
    g.includes("ورق") ||
    g.includes("انگلوریت") ||
    g.includes("تیرآهن") ||
    g.includes("نبشی")
  )
    return "steel";
  if (g.includes("u/g") || g.includes("ug ") || g.includes("لوله دو جداره") || g.includes("منهول") || g.includes("دفنی"))
    return "ug-pipe";
  if (g.includes("a/g") || g.includes("ag ") || g.includes("پایپینگ") || g.includes("فلنج") || g.includes("شیر"))
    return "ag-piping";
  if (g.includes("elec") || g.includes("inst") || g.includes("برق") || g.includes("کابل") || g.includes("cable"))
    return "elec-inst";
  if (g.includes("equip") || g.includes("تجهیز") || g.includes("static") || g.includes("rotary") || g.includes("پمپ") || g.includes("مخزن"))
    return "equipment";
  return "other";
}

export function materialRowQty(m: DprMaterialRow): number {
  if (typeof m.tonnage === "number" && Number.isFinite(m.tonnage) && m.tonnage > 0) return m.tonnage;
  if (typeof m.qtyVcn === "number" && Number.isFinite(m.qtyVcn) && m.qtyVcn > 0) return m.qtyVcn;
  if (typeof m.net === "number" && Number.isFinite(m.net) && m.net > 0) return m.net;
  if (typeof m.gross === "number" && Number.isFinite(m.gross) && m.gross > 0) return m.gross;
  return 0;
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
  return {
    reportDate: date,
    reportNo,
    siteStatus: "",
    weather: "",
    humidity: null,
    avgTemp: null,
    minTemp: null,
    maxTemp: null,
    workShift: "",
    landStatus: "",
  };
}

export function emptyNarrative(): DprNarrative {
  return { siteActivities: "", workFront: "", areaOfConcerns: "", areaOfConcerns2: "" };
}

export const MATERIAL_CATALOG: Array<[string, string]> = [
  ["001", "ماسه بادی"], ["002", "قالب فلزی"], ["003", "آرماتور"], ["004", "آجر"], ["005", "بلوک"],
  ["006", "قلوه سنگ"], ["007", "مخلوط"], ["008", "انگلوریت شماره ۱۶"], ["009", "بتن ۱۵۰"], ["010", "بتن ۲۵۰"],
  ["011", "بتن ۳۵۰"], ["012", "بتن ۲۵۰"], ["013", "سیمان متعادل آرماسیون‌بندی"], ["014", "سیمان متعادل قالب‌بندی"], ["015", "شن سه هشتم"],
  ["016", "شن سه چهارم"], ["017", "لوله دو جداره ۱۰۰۰"], ["018", "لوله دو جداره ۸۰۰"], ["019", "لوله دو جداره ۶۰۰"], ["020", "درب منهول"],
  ["021", "ماسه شسته"], ["022", "سیـمان تیپ ۲"], ["023", "الیاف بتن"], ["024", "ورق"], ["025", "ورق ۲۵"],
];

export function emptyMaterials(date: string): DprMaterialRow[] {
  return MATERIAL_CATALOG.map(([itemCode, desc]) => ({ group: "", itemCode, desc, truckNo: "", ticketNo: "", grade: "", unit: "", gross: null, tare: null, net: null, qtyVcn: null, tonnage: null, entryDate: date, entryTime: "", contractor: "", usage: "" }));
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
    materials: [],
  };
}

/** نرمال‌سازی گزارش خوانده‌شده از ذخیره‌سازی قدیمی.
 * گزارش‌های ذخیره‌شده پیش از افزوده شدن تب متریال، فیلد materials را
 * ندارند؛ بدون این نرمال‌سازی، رندر روی `.map` می‌افتد. */
export function normalizeReport(r: DprTablesReport): DprTablesReport {
  const p = r as Partial<DprTablesReport>;
  return {
    ...r,
    site: { ...emptySite(p.reportDate ?? "", p.reportNo ?? ""), ...(p.site ?? {}) },
    narrative: { ...emptyNarrative(), ...(p.narrative ?? {}) },
    manpower: p.manpower ?? {},
    machinery: p.machinery ?? {},
    changes: p.changes ?? [],
    activities: p.activities ?? [],
    materials: p.materials ?? [],
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
  reports: Array<
    Pick<DprTablesReport, "reportDate" | "changes" | "activities"> &
      Partial<Pick<DprTablesReport, "manpower" | "machinery" | "materials">>
  >,
  beforeDate: string,
): DprHistory {
  const changes: Record<string, number> = {};
  const activities: Record<string, number> = {};
  const manpower: Record<string, number> = {};
  const machinery: Record<string, number> = {};
  const materialsByBlock: Record<string, Record<string, { desc: string; unit: string; qty: number }>> = {};

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
    if (r.manpower && typeof r.manpower === "object") {
      for (const [code, e] of Object.entries(r.manpower)) {
        const dayNight = num(e?.pd) + num(e?.ad) + num(e?.pn) + num(e?.an);
        if (dayNight > 0) manpower[code] = num(manpower[code]) + dayNight;
      }
    }
    if (r.machinery && typeof r.machinery === "object") {
      for (const [code, e] of Object.entries(r.machinery)) {
        const act = num(e?.active);
        if (act > 0) machinery[code] = num(machinery[code]) + act;
      }
    }
    for (const m of r.materials ?? []) {
      const desc = (m?.desc ?? "").trim();
      if (!desc) continue;
      const qty = materialRowQty(m);
      if (!(qty > 0)) continue;
      const block = materialBlockForRow(m);
      const bucket = (materialsByBlock[block] ??= {});
      const cur = bucket[desc] ?? { desc, unit: (m.unit ?? "").trim() || "Ton", qty: 0 };
      cur.qty = Number((cur.qty + qty).toFixed(2));
      if (!cur.unit && m.unit) cur.unit = m.unit.trim();
      bucket[desc] = cur;
    }
  }
  return { changes, activities, manpower, machinery, materialsByBlock };
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
  for (const [key, label] of [["minTemp", "حداقل دما"], ["maxTemp", "حداکثر دما"]] as const) {
    const value = site[key];
    if (value !== null && value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < -30 || value > 70)) {
      issues.push(`${label} باید عدد ۳۰- تا ۷۰ باشد`);
    }
  }
  for (const [key, label] of [["workShift", "شیفت کاری"], ["landStatus", "وضعیت زمین"]] as const) {
    const value = site[key];
    if (value !== undefined && (typeof value !== "string" || value.length > DPR_LIMITS.textShortMax)) {
      issues.push(`${label} نامعتبر است`);
    }
  }

  const nar = r.narrative ?? ({} as DprNarrative);
  for (const [key, label] of [["siteActivities", "فعالیت‌های سایت"], ["workFront", "جبهه کاری"], ["areaOfConcerns", "نگرانی‌ها"], ["areaOfConcerns2", "نگرانی‌های تکمیلی"]] as const) {
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
      for (const [k, label] of [
        ["activityId", "شناسه فعالیت"],
        ["activityType", "نوع فعالیت"],
        ["acCode", "کد حساب"],
        ["subPhase", "زیرفاز"],
        ["dis", "دیسیپلین"],
        ["area", "ناحیه"],
        ["workPackage", "بسته کاری"],
        ["subPackage", "زیربسته"],
        ["wbsCode", "کد WBS"],
        ["level", "سطح"],
        ["unit", "واحد"],
        ["executor", "مجری"],
      ] as const) {
        const v = (a as unknown as Record<string, unknown>)[k];
        if (v !== undefined && (typeof v !== "string" || v.length > DPR_LIMITS.textShortMax)) {
          issues.push(`ردیف ${n} فعالیت‌ها: «${label}» نامعتبر است`);
        }
      }
      for (const [k, label] of [
        ["wv", "W.V"],
        ["wf", "W.F"],
        ["duration", "مدت (Du.)"],
        ["boq", "BOQ"],
        ["planPct", "Plan"],
        ["actPct", "Act"],
        ["varPct", "Var."],
      ] as const) {
        const v = (a as unknown as Record<string, unknown>)[k];
        if (v !== null && v !== undefined && (typeof v !== "number" || !Number.isFinite(v))) {
          issues.push(`ردیف ${n} فعالیت‌ها: «${label}» باید عدد معتبر باشد`);
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

  const mats = r.materials ?? [];
  if (!Array.isArray(mats)) issues.push("بخش متریال وارده نامعتبر است");
  else {
    if (mats.length > DPR_LIMITS.maxMaterialRows) issues.push("تعداد ردیف‌های متریال بیش از حد مجاز است");
    mats.forEach((m, i) => {
      const n = i + 1;
      if (!m || typeof m !== "object") {
        issues.push(`ردیف ${n} متریال نامعتبر است`);
        return;
      }
      if (!m.desc || typeof m.desc !== "string" || !m.desc.trim() || m.desc.length > DPR_LIMITS.activityTextMax) {
        issues.push(`ردیف ${n} متریال: شرح لازم است`);
      }
      for (const [k, label] of [["group", "گروه"], ["itemCode", "کد کالا"], ["truckNo", "شماره کامیون"], ["ticketNo", "قبض انبار/باسکول"], ["grade", "رده"], ["unit", "واحد"], ["contractor", "پیمانکار/شخص"], ["usage", "موقعیت مصرف"]] as const) {
        const v = (m as unknown as Record<string, unknown>)[k];
        if (v !== undefined && (typeof v !== "string" || v.length > DPR_LIMITS.textShortMax)) {
          issues.push(`ردیف ${n} متریال: «${label}» نامعتبر است`);
        }
      }
      if (m.entryDate !== "" && m.entryDate !== undefined && !splitReportDate(m.entryDate ?? "")) {
        issues.push(`ردیف ${n} متریال: تاریخ ورود نامعتبر است`);
      }
      if (m.entryTime !== undefined && (typeof m.entryTime !== "string" || m.entryTime.length > DPR_LIMITS.textShortMax)) {
        issues.push(`ردیف ${n} متریال: ساعت ورود نامعتبر است`);
      }
      for (const [k, label] of [["gross", "پر"], ["tare", "خالی"], ["net", "خالص"], ["qtyVcn", "حجم/تعداد/وزن"], ["tonnage", "تناز"]] as const) {
        const v = (m as unknown as Record<string, unknown>)[k];
        if (v !== null && v !== undefined && !isQty(v)) {
          issues.push(`ردیف ${n} متریال: «${label}» باید عدد نامنفی باشد`);
        }
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

/** تولید ۳ روز دادهٔ نمونهٔ کامل (۱۴۰۳/۰۸/۲۴، ۱۴۰۳/۰۸/۲۵ و ۱۴۰۳/۰۸/۲۶) برای کنترل خودکار شیت‌های گزارش روزانه. */
export function buildSampleThreeDayReports(projectCode: string): Record<string, DprTablesReport> {
  const days: Array<{
    date: string;
    reportNo: string;
    weather: DprWeather;
    humidity: number;
    avgTemp: number;
    minTemp: number;
    maxTemp: number;
    workShift: string;
    landStatus: string;
    narrative: DprNarrative;
    manMult: number;
    macShift: number;
    actToday: [number, number, number, number, number, number];
    changeThis: [number, number, number];
    matScale: number;
  }> = [
    {
      date: "1403/08/24",
      reportNo: "DRT-101",
      weather: "Sunny",
      humidity: 32,
      avgTemp: 24,
      minTemp: 17,
      maxTemp: 30,
      workShift: "Day Shift",
      landStatus: "Open - Civil Zone 1",
      narrative: {
        siteActivities:
          "1. آرماتوربندی و قالب‌بندی فونداسیون‌های F-101 الی F-104 در ناحیه سیویل زون ۱\n2. بتن‌ریزی مگر کانال‌های هدایت آب‌های سطحی به حجم ۴۵ مترمکعب\n3. نصب انکربولت‌های سازه فلزی پایپ‌رک اصلی محورهای A تا D\n4. حفاری و رگلاژ بستر خط لوله زیرزمینی (U/G Pipe) سایز ۱۴ اینچ",
        workFront:
          "• جبهه فونداسیون تجهیزات روتاری واحد ۱۰۰ آماده آرماتوربندی\n• جبهه مونتاژ ستون‌های سازه فلزی زون ۲ آماده تحویل به تیم نصب\n• جبهه کابل‌کشی ترانشه برق پست فرعی SS-02 آزادسازی شد",
        areaOfConcerns:
          "• تسریع در ابلاغ نقشه‌های شاپ‌دراوینگ سازه فلزی زون ۳ توسط بخش مهندسی\n• هماهنگی ترخیص محموله شیرآلات و فلنج‌های پایپینگ از انبار مرکزی",
        areaOfConcerns2: "• اخذ مجوز ورود محموله میلگرد از حراست در ساعت ۰۷:۰۰\n• آماده‌سازی ژنراتور رزرو برای قطع برق احتمالی",
      },
      manMult: 0,
      macShift: 0,
      actToday: [45, 18, 22, 35, 28, 40],
      changeThis: [35, 12, 18],
      matScale: 1,
    },
    {
      date: "1403/08/25",
      reportNo: "DRT-102",
      weather: "Cloudy",
      humidity: 44,
      avgTemp: 21,
      minTemp: 15,
      maxTemp: 27,
      workShift: "Day & Night Shift",
      landStatus: "Open - Pipe Rack Zone 1",
      narrative: {
        siteActivities:
          "1. بتن‌ریزی سازه‌ای فونداسیون‌های F-101 و F-102 به حجم ۶۵ مترمکعب با پمپ دکل\n2. پیش‌ساخت و مونتاژ تیرها و ستون‌های سازه فلزی پایپ‌رک به وزن ۲۸ تن\n3. لوله‌گذاری و جوشکاری خط لوله زیرزمینی U/G سایز ۱۴ اینچ به متراژ ۴۲ متر\n4. نصب سینی کابل و لوله‌های کاندوئیت ابزار دقیق در واحد ۲۰۰",
        workFront:
          "• جبهه نصب سازه فلزی محورهای ۱ تا ۴ پس از کیورینگ فونداسیون آماده نصب\n• جبهه نصب تجهیزات استاتیک (مخزن ذخیره TK-101) آماده بهره‌برداری جرثقیل سنگین",
        areaOfConcerns:
          "• وزش باد نسبتاً شدید در شیفت عصر و لزوم پایش سرعت باد پیش از عملیات لیفتینگ\n• پیگیری تأمین مستمر سیمان تیپ ۲ جهت بچینگ پلنت مرکزی",
        areaOfConcerns2: "• هماهنگی با QC برای بازرسی جوش‌های پایپ‌رک\n• تأمین روشنایی کافی در مسیر تردد شبانه",
      },
      manMult: 1,
      macShift: 1,
      actToday: [65, 24, 28, 42, 36, 55],
      changeThis: [40, 15, 22],
      matScale: 1.2,
    },
    {
      date: "1403/08/26",
      reportNo: "DRT-103",
      weather: "Sunny",
      humidity: 38,
      avgTemp: 23,
      minTemp: 16,
      maxTemp: 29,
      workShift: "Day & Night Shift",
      landStatus: "Restricted - Firewater Tank Area",
      narrative: {
        siteActivities:
          "1. نصب ستون‌ها و بادبندهای سازه فلزی پایپ‌رک زون ۱ به وزن ۳۴ تن\n2. آرماتوربندی دیوار مخزن بتنی ذخیره آب آتش‌نشانی (۳۲ تن میلگرد سایز ۱۶ و ۲۰)\n3. بتن‌ریزی فونداسیون تجهیزات روتاری واحد ۱۰۰ به حجم ۸۰ مترمکعب\n4. نصب و تراز تجهیزات استاتیک و روتاری (TK-101 و P-102A/B) و ادامه پایپینگ روکار (A/G)",
        workFront:
          "• جبهه پایپینگ روکار (A/G Piping) روی پایپ‌رک محور ۱ تا ۶ آماده نصب ساپورت و اسپول‌ها\n• جبهه تست هیدرواستاتیک خط لوله زیرزمینی زون ۱ آماده تحویل به QC",
        areaOfConcerns:
          "• هماهنگی حضور بازرس شخص ثالث (TPI) جهت تست‌های غیرمخرب جوش (NDT) در شیفت صبح\n• تکمیل برج‌های روشنایی محوطه جهت افزایش راندمان کار در شیفت شب",
        areaOfConcerns2: "• تأیید نهایی مسیر لیفت تجهیزات دوار پیش از ورود جرثقیل\n• تکمیل صورت‌جلسه تحویل کارگاه پس از تست هیدرواستاتیک",
      },
      manMult: 2,
      macShift: 2,
      actToday: [80, 32, 34, 48, 45, 70],
      changeThis: [50, 18, 25],
      matScale: 1.4,
    },
  ];

  const baseDirectManpower: Array<[string, number, number]> = [
    ["MP-001", 2, 1],
    ["MP-002", 4, 1],
    ["MP-003", 3, 1],
    ["MP-004", 5, 2],
    ["MP-005", 4, 1],
    ["MP-007", 14, 4],
    ["MP-008", 16, 4],
    ["MP-009", 12, 3],
    ["MP-011", 3, 1],
    ["MP-015", 8, 2],
    ["MP-016", 6, 2],
    ["MP-019", 3, 1],
    ["MP-021", 8, 2],
    ["MP-022", 12, 3],
    ["MP-023", 6, 2],
    ["MP-024", 10, 3],
    ["MP-027", 3, 1],
    ["MP-028", 10, 2],
    ["MP-030", 12, 3],
    ["MP-032", 8, 2],
    ["MP-036", 2, 1],
    ["MP-037", 9, 2],
    ["MP-038", 7, 2],
    ["MP-039", 6, 1],
    ["MP-049", 2, 0],
    ["MP-050", 6, 1],
    ["MP-052", 5, 1],
    ["MP-063", 4, 1],
    ["MP-064", 6, 1],
    ["MP-068", 3, 1],
    ["MP-070", 5, 1],
    ["MP-075", 15, 4],
    ["MP-078", 4, 1],
    ["MP-084", 8, 2],
  ];

  const baseIndirectManpower: Array<[string, number, number]> = [
    ["MP-089", 1, 0],
    ["MP-090", 1, 0],
    ["MP-093", 2, 1],
    ["MP-094", 4, 1],
    ["MP-098", 1, 0],
    ["MP-099", 5, 0],
    ["MP-104", 1, 0],
    ["MP-106", 4, 1],
    ["MP-111", 1, 0],
    ["MP-112", 2, 0],
    ["MP-114", 1, 0],
    ["MP-116", 4, 1],
    ["MP-117", 3, 1],
    ["MP-120", 1, 0],
    ["MP-122", 5, 2],
    ["MP-125", 1, 0],
    ["MP-126", 3, 1],
    ["MP-127", 2, 1],
    ["MP-130", 1, 0],
    ["MP-133", 3, 0],
    ["MP-136", 2, 0],
    ["MP-137", 3, 0],
    ["MP-140", 3, 1],
    ["MP-141", 2, 1],
    ["MP-148", 2, 2],
    ["MP-149", 8, 8],
    ["MP-152", 4, 2],
    ["MP-157", 6, 2],
    ["MP-158", 4, 1],
    ["MP-159", 3, 1],
  ];

  const baseMachinery: Array<[string, number, number, number, string]> = [
    ["MC-001", 4, 1, 0, "پیمانکار سیویل"],
    ["MC-002", 3, 0, 1, "پیمانکار سیویل"],
    ["MC-003", 8, 1, 1, "پیمانکار سیویل"],
    ["MC-004", 2, 1, 0, "پیمانکار سیویل"],
    ["MC-005", 2, 0, 0, "پیمانکار سیویل"],
    ["MC-008", 2, 0, 0, "بچینگ مرکزی"],
    ["MC-009", 6, 1, 0, "بچینگ مرکزی"],
    ["MC-011", 2, 0, 0, "بچینگ مرکزی"],
    ["MC-033", 2, 0, 0, "پیمانکار مکانیک"],
    ["MC-034", 3, 1, 0, "پیمانکار مکانیک"],
    ["MC-036", 4, 0, 1, "پیمانکار مکانیک"],
    ["MC-039", 18, 2, 1, "پیمانکار پایپینگ"],
    ["MC-041", 14, 2, 0, "پیمانکار سازه"],
    ["MC-046", 4, 1, 0, "پیمانکار مکانیک"],
    ["MC-080", 3, 0, 0, "خدمات عمومی"],
    ["MC-081", 6, 1, 0, "ترابری سایت"],
    ["MC-082", 4, 0, 0, "ترابری سایت"],
    ["MC-083", 12, 1, 1, "ترابری سایت"],
    ["MC-084", 3, 0, 0, "HSE"],
    ["MC-091", 5, 1, 0, "برق و تأسیسات"],
    ["MC-105", 8, 0, 0, "دفتر مرکزی کارگاه"],
    ["MC-145", 2, 0, 0, "پیمانکار سیویل"],
    ["MC-150", 3, 1, 0, "پیمانکار مکانیک"],
  ];

  const out: Record<string, DprTablesReport> = {};
  const nowIso = new Date().toISOString();

  for (const d of days) {
    const manpower: Record<string, DprManpowerEntry> = {};
    for (const [code, pdBase, pnBase] of baseDirectManpower) {
      manpower[code] = {
        pd: pdBase + (d.manMult % 2),
        ad: pdBase >= 10 ? 1 : 0,
        pn: pnBase + (d.manMult === 2 && pnBase > 0 ? 1 : 0),
        an: 0,
      };
    }
    for (const [code, pdBase, pnBase] of baseIndirectManpower) {
      manpower[code] = {
        pd: pdBase + (d.manMult === 2 && pdBase >= 3 ? 1 : 0),
        ad: 0,
        pn: pnBase,
        an: 0,
      };
    }

    const machinery: Record<string, DprMachineryEntry> = {};
    for (const [code, act, rdy, rep, owner] of baseMachinery) {
      machinery[code] = {
        active: act + (d.macShift === 2 && act >= 4 ? 1 : 0),
        ready: rdy,
        repair: rep,
        owner,
      };
    }

    const s = d.matScale;
    const materials: DprMaterialRow[] = [
      {
        group: "Rebar",
        itemCode: "003",
        desc: "Rebar Φ16 (AIII)",
        truckNo: "14ع382",
        ticketNo: `RB-${d.reportNo}-1`,
        grade: "AIII",
        unit: "Ton",
        gross: Math.round(36 * s),
        tare: 12,
        net: Math.round(24 * s),
        qtyVcn: Math.round(24 * s),
        tonnage: Math.round(24 * s),
        entryDate: d.date,
        entryTime: "08:30",
        contractor: "فولاد خوزستان",
        usage: "فونداسیون زون ۱",
      },
      {
        group: "Rebar",
        itemCode: "003",
        desc: "Rebar Φ20 (AIII)",
        truckNo: "22ع741",
        ticketNo: `RB-${d.reportNo}-2`,
        grade: "AIII",
        unit: "Ton",
        gross: Math.round(32 * s),
        tare: 12,
        net: Math.round(20 * s),
        qtyVcn: Math.round(20 * s),
        tonnage: Math.round(20 * s),
        entryDate: d.date,
        entryTime: "09:15",
        contractor: "فولاد اصفهان",
        usage: "دیوار مخزن بتنی",
      },
      {
        group: "Anchorbolt",
        itemCode: "AB-01",
        desc: "Anchor Bolt M24 (L=800mm)",
        truckNo: "45ط118",
        ticketNo: `AB-${d.reportNo}-1`,
        grade: "8.8",
        unit: "pcs",
        gross: 2.5,
        tare: 1.5,
        net: 1,
        qtyVcn: Math.round(40 * s),
        tonnage: null,
        entryDate: d.date,
        entryTime: "10:00",
        contractor: "پیمانکار سازه",
        usage: "پایپ‌رک زون ۱",
      },
      {
        group: "Batching Plant Material",
        itemCode: "022",
        desc: "Cement Type II (سیمان تیپ ۲)",
        truckNo: "61ع914",
        ticketNo: `BP-${d.reportNo}-1`,
        grade: "Type-II",
        unit: "Ton",
        gross: Math.round(40 * s),
        tare: 14,
        net: Math.round(26 * s),
        qtyVcn: Math.round(26 * s),
        tonnage: Math.round(26 * s),
        entryDate: d.date,
        entryTime: "07:45",
        contractor: "سیمان بهبهان",
        usage: "بچینگ مرکزی",
      },
      {
        group: "Batching Plant Material",
        itemCode: "021",
        desc: "Washed Sand (ماسه شسته)",
        truckNo: "73ع512",
        ticketNo: `BP-${d.reportNo}-2`,
        grade: "Standard",
        unit: "Ton",
        gross: Math.round(52 * s),
        tare: 14,
        net: Math.round(38 * s),
        qtyVcn: Math.round(38 * s),
        tonnage: Math.round(38 * s),
        entryDate: d.date,
        entryTime: "11:20",
        contractor: "معدن شن و ماسه",
        usage: "بچینگ مرکزی",
      },
      {
        group: "Steel Structure",
        itemCode: "024",
        desc: "Steel Plate & Profiles ST37",
        truckNo: "18ع609",
        ticketNo: `ST-${d.reportNo}-1`,
        grade: "ST37",
        unit: "Ton",
        gross: Math.round(34 * s),
        tare: 12,
        net: Math.round(22 * s),
        qtyVcn: Math.round(22 * s),
        tonnage: Math.round(22 * s),
        entryDate: d.date,
        entryTime: "13:10",
        contractor: "کارخانه سازه فلزی",
        usage: "پایپ‌رک محور A-D",
      },
      {
        group: "U/G Pipe",
        itemCode: "018",
        desc: "HDPE / CS Pipe 14 inch",
        truckNo: "88ع204",
        ticketNo: `UG-${d.reportNo}-1`,
        grade: "API 5L",
        unit: "m",
        gross: 18,
        tare: 10,
        net: 8,
        qtyVcn: Math.round(36 * s),
        tonnage: null,
        entryDate: d.date,
        entryTime: "14:00",
        contractor: "لوله‌سازی اهواز",
        usage: "شبکه زیرزمینی زون ۱",
      },
      {
        group: "A/G Piping",
        itemCode: "AG-01",
        desc: "CS Seamless Pipe 8 inch Sch40",
        truckNo: "92ع331",
        ticketNo: `AG-${d.reportNo}-1`,
        grade: "A106-B",
        unit: "Inch-m",
        gross: 20,
        tare: 11,
        net: 9,
        qtyVcn: Math.round(45 * s),
        tonnage: null,
        entryDate: d.date,
        entryTime: "15:15",
        contractor: "پیمانکار پایپینگ",
        usage: "پایپ‌رک واحد ۱۰۰",
      },
      {
        group: "Electrical& instrument",
        itemCode: "EL-01",
        desc: "Cable Shoe 25mm",
        truckNo: "11ط405",
        ticketNo: `EL-${d.reportNo}-1`,
        grade: "Cu",
        unit: "pcs",
        gross: 1,
        tare: 0.8,
        net: 0.2,
        qtyVcn: Math.round(120 * s),
        tonnage: null,
        entryDate: d.date,
        entryTime: "16:00",
        contractor: "پیمانکار برق",
        usage: "پست فرعی SS-02",
      },
      {
        group: "Equipment",
        itemCode: "EQ-01",
        desc: "Static",
        truckNo: "99ع110",
        ticketNo: `EQ-${d.reportNo}-1`,
        grade: "A516",
        unit: "Ton",
        gross: Math.round(28 * s),
        tare: 13,
        net: Math.round(15 * s),
        qtyVcn: Math.round(15 * s),
        tonnage: Math.round(15 * s),
        entryDate: d.date,
        entryTime: "16:40",
        contractor: "ماشین‌سازی اراک",
        usage: "واحد ۱۰۰",
      },
      {
        group: "Equipment",
        itemCode: "EQ-02",
        desc: "Rotary",
        truckNo: "99ع210",
        ticketNo: `EQ-${d.reportNo}-2`,
        grade: "API-610",
        unit: "Ton",
        gross: Math.round(18 * s),
        tare: 12,
        net: Math.round(6 * s),
        qtyVcn: Math.round(6 * s),
        tonnage: Math.round(6 * s),
        entryDate: d.date,
        entryTime: "17:10",
        contractor: "پمپیران",
        usage: "پمپ‌خانه واحد ۱۰۰",
      },
      {
        group: "Other",
        itemCode: "002",
        desc: "Steel Formwork Panel (قالب فلزی)",
        truckNo: "33ع819",
        ticketNo: `OT-${d.reportNo}-1`,
        grade: "ST37",
        unit: "m2",
        gross: 16,
        tare: 10,
        net: 6,
        qtyVcn: Math.round(60 * s),
        tonnage: null,
        entryDate: d.date,
        entryTime: "17:30",
        contractor: "پیمانکار سیویل",
        usage: "فونداسیون زون ۲",
      },
    ];

    const changes: DprChangeRow[] = [
      {
        date: d.date,
        refId: "TQ-101",
        location: "Unit 100 - F-102",
        unit: "m3",
        discipline: "Civil",
        activity: "افزایش ابعاد فونداسیون تجهیزات روتاری",
        totalQty: 250,
        thisQty: d.changeThis[0],
        contractor: "پیمانکار سیویل",
        opsFa: "آرماتوربندی و بتن‌ریزی الحاقی طبق TQ-101",
        noteFa: "تأیید مهندسی مقیم",
      },
      {
        date: d.date,
        refId: "VQ-204",
        location: "Pipe Rack Zone 1",
        unit: "Ton",
        discipline: "Structure",
        activity: "تقویت بادبندهای سازه فلزی پایپ‌رک",
        totalQty: 90,
        thisQty: d.changeThis[1],
        contractor: "پیمانکار سازه",
        opsFa: "برشکاری، فیت‌آپ و نصب بادبندهای تقویتی",
        noteFa: "طبق دستور کار کارگاهی VQ-204",
      },
      {
        date: d.date,
        refId: "SI-309",
        location: "Substation SS-02",
        unit: "m",
        discipline: "Electrical",
        activity: "تغییر مسیر ترانشه کابل فشار متوسط",
        totalQty: 180,
        thisQty: d.changeThis[2],
        contractor: "پیمانکار برق",
        opsFa: "حفاری و لوله‌گذاری کاندوئیت مسیر جدید",
        noteFa: "هماهنگ‌شده با واحد بهره‌برداری",
      },
    ];

    const activities: DprMainActivityRow[] = [
      {
        activityId: "ACT-1010",
        activityType: "Task Dependent",
        acCode: "CIV-01",
        subPhase: "Construction",
        dis: "Civil",
        area: "Unit 100",
        workPackage: "WP-CIV-01",
        subPackage: "Foundation",
        wbsCode: "WBS-1.3.1",
        level: "L3",
        activity: "Structural Concrete Pouring (بتن‌ریزی سازه‌ای فونداسیون‌ها)",
        wv: 18.5,
        wf: 22.0,
        duration: 90,
        unit: "m3",
        boq: 2400,
        estimated: 2500,
        todayQty: d.actToday[0],
        startDate: "1403/07/01",
        endDate: "1403/10/01",
        planPct: 48,
        actPct: 52,
        varPct: 4,
        executor: "پیمانکار سیویل",
        note: "طبق برنامه زمان‌بندی",
      },
      {
        activityId: "ACT-1020",
        activityType: "Task Dependent",
        acCode: "CIV-02",
        subPhase: "Construction",
        dis: "Civil",
        area: "Unit 100",
        workPackage: "WP-CIV-02",
        subPackage: "Rebar",
        wbsCode: "WBS-1.3.2",
        level: "L3",
        activity: "Rebar Cutting, Bending & Fixing (آرماتوربندی سازه‌های بتنی)",
        wv: 14.0,
        wf: 16.5,
        duration: 85,
        unit: "Ton",
        boq: 420,
        estimated: 450,
        todayQty: d.actToday[1],
        startDate: "1403/07/05",
        endDate: "1403/09/30",
        planPct: 55,
        actPct: 58,
        varPct: 3,
        executor: "پیمانکار سیویل",
        note: "زون ۱ و ۲",
      },
      {
        activityId: "ACT-2010",
        activityType: "Task Dependent",
        acCode: "STR-01",
        subPhase: "Construction",
        dis: "Structure",
        area: "Pipe Rack",
        workPackage: "WP-STR-01",
        subPackage: "Erection",
        wbsCode: "WBS-1.4.1",
        level: "L3",
        activity: "Steel Structure Fabrication & Erection (ساخت و نصب سازه فلزی)",
        wv: 20.0,
        wf: 21.5,
        duration: 110,
        unit: "Ton",
        boq: 600,
        estimated: 600,
        todayQty: d.actToday[2],
        startDate: "1403/07/10",
        endDate: "1403/11/01",
        planPct: 42,
        actPct: 44,
        varPct: 2,
        executor: "پیمانکار سازه",
        note: "محورهای A تا D",
      },
      {
        activityId: "ACT-3010",
        activityType: "Task Dependent",
        acCode: "PIP-01",
        subPhase: "Construction",
        dis: "Piping",
        area: "Offsite",
        workPackage: "WP-PIP-01",
        subPackage: "U/G Piping",
        wbsCode: "WBS-1.5.1",
        level: "L3",
        activity: "Underground Piping Installation (لوله‌کشی زیرزمینی U/G)",
        wv: 12.5,
        wf: 13.0,
        duration: 75,
        unit: "m",
        boq: 800,
        estimated: 800,
        todayQty: d.actToday[3],
        startDate: "1403/07/15",
        endDate: "1403/10/01",
        planPct: 50,
        actPct: 49,
        varPct: -1,
        executor: "پیمانکار پایپینگ",
        note: "خط ۱۴ اینچ",
      },
      {
        activityId: "ACT-3020",
        activityType: "Task Dependent",
        acCode: "PIP-02",
        subPhase: "Construction",
        dis: "Piping",
        area: "Unit 100",
        workPackage: "WP-PIP-02",
        subPackage: "A/G Piping",
        wbsCode: "WBS-1.5.2",
        level: "L3",
        activity: "Aboveground Piping Welding & Erection (پایپینگ روکار A/G)",
        wv: 22.0,
        wf: 17.0,
        duration: 120,
        unit: "Inch-Dia",
        boq: 1500,
        estimated: 1500,
        todayQty: d.actToday[4],
        startDate: "1403/08/01",
        endDate: "1403/12/01",
        planPct: 30,
        actPct: 32,
        varPct: 2,
        executor: "پیمانکار پایپینگ",
        note: "روی پایپ‌رک اصلی",
      },
      {
        activityId: "ACT-4010",
        activityType: "Task Dependent",
        acCode: "ELE-01",
        subPhase: "Construction",
        dis: "E&I",
        area: "Substation SS-02",
        workPackage: "WP-EI-01",
        subPackage: "Cable Pulling",
        wbsCode: "WBS-1.6.1",
        level: "L3",
        activity: "Electrical & Instrument Cable Pulling (کابل‌کشی برق و ابزار دقیق)",
        wv: 13.0,
        wf: 10.0,
        duration: 95,
        unit: "m",
        boq: 3000,
        estimated: 3000,
        todayQty: d.actToday[5],
        startDate: "1403/08/01",
        endDate: "1403/11/10",
        planPct: 35,
        actPct: 36,
        varPct: 1,
        executor: "پیمانکار برق",
        note: "ترانشه و سینی کابل",
      },
    ];

    out[d.date] = {
      projectCode,
      reportDate: d.date,
      reportNo: d.reportNo,
      status: "draft",
      site: {
        reportDate: d.date,
        reportNo: d.reportNo,
        siteStatus: "Active",
        weather: d.weather,
        humidity: d.humidity,
        avgTemp: d.avgTemp,
        minTemp: d.minTemp,
        maxTemp: d.maxTemp,
        workShift: d.workShift,
        landStatus: d.landStatus,
      },
      narrative: d.narrative,
      manpower,
      machinery,
      changes,
      activities,
      materials,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  return out;
}

/* بازصادر فهرست‌های ثابت تا سرور و آزمون از یک درگاه بخوانند. */
export { DPR_MANPOWER } from "../data/dprManpower";
export { DPR_MACHINERY } from "../data/dprMachinery";
