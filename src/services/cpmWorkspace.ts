/**
 * CPMS — میز کار ساخت و اجرا (P7)
 * ------------------------------------------------------------------
 * CPM-1 حوزهٔ کاری پیمانکار (تخصیص WBS به پیمانکار)
 * CPM-2 گزارش روزانهٔ پیمانکار (پیمانکار، دیسیپلین، عکس و پیوست)
 * CPM-3 گزارش‌های دیسیپلینی — لوله‌کشی (Fit-up/Weld/NDT/PWHT)، برق،
 *       ابزار دقیق، سیویل
 * CPM-4 درخواست بازرسی (IR/RFI) و آزادسازی فعالیت توسط QC
 *
 * این فایل خالص است: نه اتصال پایگاه داده دارد نه HTTP. سرور آن را از راه
 * `server/cpmWsLogic.js` (خروجی esbuild، بازتولید با `npm run build:cpmws`)
 * می‌خواند و کلاینت همان قواعد را برای پیش‌اعتبارسنجی فرم به کار می‌برد.
 * مرجع نهایی همیشه سرور است؛ هیچ عدد یا وضعیتی از بدنهٔ درخواست پذیرفته
 * نمی‌شود مگر از فیلدهای مجاز همین ماژول.
 *
 * اصل حاکم: «نامعلوم» با صفر یکی نیست. اگر داده‌ای برای نرخ یا پوشش نباشد،
 * خروجی `null` است تا در UI «نامعلوم» نمایش داده شود.
 */

export const CPM_MODEL = "cpm-cpms-v1";

/* ═══════════════════════ ۱. کاتالوگ دیسیپلین‌ها ═══════════════════════ */

export type Discipline = "piping" | "electrical" | "instrument" | "civil";
export const DISCIPLINES: readonly Discipline[] = ["piping", "electrical", "instrument", "civil"];
export const DISCIPLINE_LABEL: Record<Discipline, { fa: string; en: string }> = {
  piping: { fa: "لوله‌کشی", en: "Piping" },
  electrical: { fa: "برق", en: "Electrical" },
  instrument: { fa: "ابزار دقیق", en: "Instrumentation" },
  civil: { fa: "سیویل", en: "Civil" },
};

/** آیتم‌های هر دیسیپلین — گزارش دیسیپلینی فقط همین انواع را می‌پذیرد. */
export const DISCIPLINE_ITEMS: Record<Discipline, readonly string[]> = {
  piping: ["fitup", "weld", "ndt", "pwht"],
  electrical: ["cable_pull", "termination", "megger", "grounding"],
  instrument: ["loop_check", "calibration", "installation"],
  civil: ["pour", "compaction", "cube_test", "formwork"],
};
export const ITEM_LABEL: Record<string, { fa: string; en: string }> = {
  fitup: { fa: "جفت‌شدن (Fit-up)", en: "Fit-up" },
  weld: { fa: "جوشکاری (Weld)", en: "Weld" },
  ndt: { fa: "آزمون غیرمخرب (NDT)", en: "NDT" },
  pwht: { fa: "عملیات حرارتی پس از جوش (PWHT)", en: "PWHT" },
  cable_pull: { fa: "کابل‌کشی", en: "Cable pull" },
  termination: { fa: "ترمینال و سرکابل", en: "Termination" },
  megger: { fa: "تست عایقی (Megger)", en: "Megger" },
  grounding: { fa: "ارتینگ", en: "Grounding" },
  loop_check: { fa: "لوپ‌چک", en: "Loop check" },
  calibration: { fa: "کالیبراسیون", en: "Calibration" },
  installation: { fa: "نصب تجهیز", en: "Installation" },
  pour: { fa: "بتن‌ریزی", en: "Pour" },
  compaction: { fa: "تراکم", en: "Compaction" },
  cube_test: { fa: "آزمون نمونه مکعبی", en: "Cube test" },
  formwork: { fa: "قالب‌بندی", en: "Formwork" },
};
/** فقط این آیتم‌ها به روش NDT نیاز دارند و «مورد قبول/رد» دارند. */
export const ITEMS_WITH_NDT: readonly string[] = ["ndt"];
export const ITEMS_WITH_RESULT: readonly string[] = ["ndt", "megger", "cube_test", "calibration", "compaction", "loop_check"];
export const NDT_METHODS: readonly string[] = ["RT", "UT", "PT", "MT", "VT"];
export const RESULT_CODES: readonly string[] = ["ok", "rejected", "pending", "na"];
export const RESULT_LABEL: Record<string, { fa: string; en: string }> = {
  ok: { fa: "قبول", en: "Accepted" },
  rejected: { fa: "رد", en: "Rejected" },
  pending: { fa: "در انتظار نتیجه", en: "Pending" },
  na: { fa: "نامرتبط", en: "N/A" },
};

/* ═══════════════════════ ۲. وضعیت‌ها و گردش‌کار ═══════════════════════ */

export const WORK_AREA_STATUS: readonly string[] = ["planned", "active", "suspended", "closed"];
export const DPR_STATUS: readonly string[] = ["draft", "submitted", "approved", "returned"];
export const REPORT_STATUS: readonly string[] = ["draft", "submitted", "approved", "returned"];
export const INSPECTION_TYPES: readonly string[] = ["ir", "rfi"];
export const INSPECTION_STATUS: readonly string[] = ["draft", "submitted", "released", "rejected", "cancelled"];
export const INSPECTION_ACTIONS: readonly string[] = ["submit", "release", "reject", "cancel"];
export const SHIFT_CODES: readonly string[] = ["day", "night"];
export const ATTACHMENT_KINDS: readonly string[] = ["photo", "attachment", "test_report"];
export const ATTACHMENT_KIND_LABEL: Record<string, { fa: string; en: string }> = {
  photo: { fa: "عکس", en: "Photo" },
  attachment: { fa: "پیوست", en: "Attachment" },
  test_report: { fa: "گزارش آزمون", en: "Test report" },
};

/** اعلان ۴۸ ساعتهٔ بازرسی (هم‌راستا با QMS d8) — شکل واقعی، نه تخمین. */
export const NOTICE_HOURS = 48;

export const STATUS_LABEL: Record<string, { fa: string; en: string }> = {
  planned: { fa: "برنامه‌ریزی‌شده", en: "Planned" },
  active: { fa: "فعال", en: "Active" },
  suspended: { fa: "متوقف", en: "Suspended" },
  closed: { fa: "بسته", en: "Closed" },
  draft: { fa: "پیش‌نویس", en: "Draft" },
  submitted: { fa: "ارسال‌شده", en: "Submitted" },
  approved: { fa: "تأییدشده", en: "Approved" },
  returned: { fa: "برگشتی", en: "Returned" },
  released: { fa: "آزادشده توسط QC", en: "QC released" },
  rejected: { fa: "ردشده", en: "Rejected" },
  cancelled: { fa: "لغوشده", en: "Cancelled" },
  day: { fa: "روز", en: "Day" },
  night: { fa: "شب", en: "Night" },
  ir: { fa: "درخواست بازرسی (IR)", en: "IR" },
  rfi: { fa: "درخواست بازرسی شاهد (RFI)", en: "RFI" },
};

export class WorkspaceValidationError extends Error {
  code = "CPM_VALIDATION";
  status = 400;
}

/* ═══════════════════════ ۳. کمکی‌های اعتبارسنجی ═══════════════════════ */

function bad(message: string): never {
  throw new WorkspaceValidationError(message);
}
function record(v: unknown, label = "رکورد"): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) bad(`${label}: ساختار شیء لازم است`);
  return v as Record<string, unknown>;
}
function keys(v: Record<string, unknown>, allowed: readonly string[]) {
  const unknown = Object.keys(v).find((k) => !allowed.includes(k));
  if (unknown) bad(`فیلد مجاز نیست: ${unknown}`);
}
function text(v: unknown, label: string, max: number, required = true): string {
  if (v === undefined || v === null) {
    if (required) bad(`«${label}» الزامی است`);
    return "";
  }
  if (typeof v !== "string") bad(`«${label}» باید متن باشد`);
  const s = v.trim();
  if (required && !s) bad(`«${label}» الزامی است`);
  if (s.length > max) bad(`«${label}» حداکثر ${max} نویسه است`);
  return s;
}
function latinCode(v: unknown, label: string, max = 40, required = true): string {
  const s = text(v, label, max, required);
  if (!s) return "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(s)) bad(`«${label}» فقط حروف/رقم لاتین، نقطه، خط تیره و اسلش (حداکثر ${max})`);
  return s.toUpperCase();
}
function num(v: unknown, label: string, min: number, max: number, opts: { nullable?: boolean; int?: boolean } = {}): number | null {
  if (v === undefined || v === null || v === "") {
    if (opts.nullable) return null;
    bad(`«${label}» عددی لازم است`);
  }
  const n = Number(v);
  if (!Number.isFinite(n)) bad(`«${label}» عدد معتبر نیست`);
  if (opts.int && !Number.isInteger(n)) bad(`«${label}» باید عدد صحیح باشد`);
  if (n < min || n > max) bad(`«${label}» باید بین ${min} و ${max} باشد`);
  return n;
}
function choice<T extends string>(v: unknown, allowed: readonly T[], label: string, fallback?: T): T {
  if ((v === undefined || v === null || v === "") && fallback !== undefined) return fallback;
  if (typeof v !== "string" || !allowed.includes(v as T)) bad(`«${label}» باید یکی از ${allowed.join(" / ")} باشد`);
  return v as T;
}
function bool(v: unknown, label: string, fallback = false): boolean {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  bad(`«${label}» باید بله/خیر باشد`);
}
export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
/** تاریخ YYYY-MM-DD معتبر؛ `noFuture` برای تاریخ‌های اظهار/گزارش. */
export function dateOnly(v: unknown, label: string, opts: { required?: boolean; noFuture?: boolean; now?: Date } = {}): string | null {
  const s = text(v, label, 10, opts.required ?? true);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s + "T00:00:00Z")) || new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s) {
    bad(`«${label}» تاریخ YYYY-MM-DD معتبر نیست`);
  }
  if (opts.noFuture && s > todayIso(opts.now)) bad(`«${label}» نباید در آینده باشد`);
  return s;
}
/** فاصلهٔ روز بین دو تاریخ میلادی (روز تقویمی). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);
}

/* ═══════════════════ ۴. CPM-1 حوزهٔ کاری پیمانکار ═══════════════════ */

export type WorkAreaInput = {
  Code: string;
  WbsCode: string;
  ContractorCode: string;
  Discipline: Discipline;
  ScopeFa: string;
  PackageNo: string | null;
  StartDate: string | null;
  EndDate: string | null;
  WeightPct: number | null;
  Status: string;
  NoteFa: string | null;
};
export const WORK_AREA_FIELDS: readonly string[] = [
  "Code", "WbsCode", "ContractorCode", "Discipline", "ScopeFa", "PackageNo", "StartDate", "EndDate", "WeightPct", "Status", "NoteFa",
];

export function normalizeWorkArea(value: unknown): WorkAreaInput {
  const v = record(value, "حوزهٔ کاری");
  keys(v, WORK_AREA_FIELDS);
  const StartDate = dateOnly(v.StartDate, "تاریخ شروع", { required: false });
  const EndDate = dateOnly(v.EndDate, "تاریخ پایان", { required: false });
  if (StartDate && EndDate && EndDate < StartDate) bad("تاریخ پایان نباید پیش از تاریخ شروع باشد");
  return {
    Code: latinCode(v.Code, "کد حوزهٔ کاری", 40),
    WbsCode: latinCode(v.WbsCode, "کد WBS", 60),
    ContractorCode: latinCode(v.ContractorCode, "کد پیمانکار", 60),
    Discipline: choice(v.Discipline, DISCIPLINES, "دیسیپلین"),
    ScopeFa: text(v.ScopeFa, "شرح دامنه", 1000),
    PackageNo: latinCode(v.PackageNo, "شمارهٔ بسته", 40, false) || null,
    StartDate,
    EndDate,
    WeightPct: num(v.WeightPct, "وزن", 0, 100, { nullable: true }),
    Status: choice(v.Status, WORK_AREA_STATUS, "وضعیت", "planned"),
    NoteFa: text(v.NoteFa, "یادداشت", 1000, false) || null,
  };
}

/* ═══════════════════ ۵. CPM-2 گزارش روزانهٔ پیمانکار ═══════════════════ */

export type DprEntryInput = {
  ReportNo: string;
  ReportDate: string;
  Shift: string;
  ContractorCode: string;
  Discipline: Discipline;
  WorkAreaCode: string | null;
  LocationFa: string;
  WeatherFa: string | null;
  ManpowerCount: number;
  EquipmentCount: number | null;
  WorkDoneFa: string;
  Status: string;
  NoteFa: string | null;
};
export const DPR_FIELDS: readonly string[] = [
  "ReportNo", "ReportDate", "Shift", "ContractorCode", "Discipline", "WorkAreaCode", "LocationFa",
  "WeatherFa", "ManpowerCount", "EquipmentCount", "WorkDoneFa", "Status", "NoteFa",
];

export function normalizeDprEntry(value: unknown, opts: { now?: Date } = {}): DprEntryInput {
  const v = record(value, "گزارش روزانه");
  keys(v, DPR_FIELDS);
  return {
    ReportNo: latinCode(v.ReportNo, "شمارهٔ گزارش", 40),
    ReportDate: dateOnly(v.ReportDate, "تاریخ گزارش", { noFuture: true, now: opts.now })!,
    Shift: choice(v.Shift, SHIFT_CODES, "شیفت", "day"),
    ContractorCode: latinCode(v.ContractorCode, "کد پیمانکار", 60),
    Discipline: choice(v.Discipline, DISCIPLINES, "دیسیپلین"),
    WorkAreaCode: latinCode(v.WorkAreaCode, "کد حوزهٔ کاری", 40, false) || null,
    LocationFa: text(v.LocationFa, "موقعیت", 200),
    WeatherFa: text(v.WeatherFa, "وضعیت جوی", 120, false) || null,
    ManpowerCount: num(v.ManpowerCount, "نفرات", 0, 20000, { int: true })!,
    EquipmentCount: num(v.EquipmentCount, "تجهیزات", 0, 2000, { int: true, nullable: true }),
    WorkDoneFa: text(v.WorkDoneFa, "کار انجام‌شده", 3000),
    Status: choice(v.Status, DPR_STATUS, "وضعیت", "draft"),
    NoteFa: text(v.NoteFa, "یادداشت", 1000, false) || null,
  };
}

/* ═══════════ ۶. CPM-3 گزارش دیسیپلینی و خطوط آن ═══════════ */

export type DisciplineLineInput = {
  ItemRef: string;
  ItemType: string;
  SizeInch: number | null;
  Quantity: number;
  Unit: string;
  ResultCode: string;
  NdtMethod: string | null;
  TestDate: string | null;
  NoteFa: string | null;
};
export type DisciplineReportInput = {
  ReportNo: string;
  ReportDate: string;
  Discipline: Discipline;
  ContractorCode: string;
  WorkAreaCode: string | null;
  Status: string;
  NoteFa: string | null;
  Lines: DisciplineLineInput[];
};
export const DISCIPLINE_LINE_FIELDS: readonly string[] = [
  "ItemRef", "ItemType", "SizeInch", "Quantity", "Unit", "ResultCode", "NdtMethod", "TestDate", "NoteFa",
];
export const DISCIPLINE_REPORT_FIELDS: readonly string[] = [
  "ReportNo", "ReportDate", "Discipline", "ContractorCode", "WorkAreaCode", "Status", "NoteFa", "Lines",
];

export function normalizeDisciplineLine(value: unknown, discipline: Discipline, opts: { now?: Date } = {}): DisciplineLineInput {
  const v = record(value, "خط گزارش");
  keys(v, DISCIPLINE_LINE_FIELDS);
  const allowed = DISCIPLINE_ITEMS[discipline];
  const ItemType = text(v.ItemType, "نوع آیتم", 30);
  if (!allowed.includes(ItemType)) bad(`«${ItemType}» برای دیسیپلین ${DISCIPLINE_LABEL[discipline].fa} مجاز نیست؛ مجازها: ${allowed.join(" / ")}`);
  const needsNdt = ITEMS_WITH_NDT.includes(ItemType);
  const NdtMethod = needsNdt ? choice(v.NdtMethod, NDT_METHODS, "روش NDT") : text(v.NdtMethod, "روش NDT", 10, false) || null;
  if (!needsNdt && NdtMethod) bad(`روش NDT فقط برای آیتم ${ITEMS_WITH_NDT.join("/")} معنا دارد`);
  const needsResult = ITEMS_WITH_RESULT.includes(ItemType);
  const ResultCode = needsResult ? choice(v.ResultCode, RESULT_CODES, "نتیجه") : choice(v.ResultCode, RESULT_CODES, "نتیجه", "na");
  if (!needsResult && ResultCode !== "na") bad(`آیتم «${ItemType}» نتیجهٔ قبول/رد ندارد؛ مقدار na را بگذارید`);
  const NoteFa = text(v.NoteFa, "یادداشت خط", 500, false) || null;
  if (ResultCode === "rejected" && !NoteFa) bad("نتیجهٔ «رد» بدون دلیل و اقدام اصلاحی ثبت نمی‌شود");
  const pipingSize = ["fitup", "weld", "ndt"].includes(ItemType);
  const SizeInch = pipingSize ? num(v.SizeInch, "قطر (اینچ)", 0.25, 120, { nullable: false }) : num(v.SizeInch, "قطر (اینچ)", 0.25, 120, { nullable: true });
  return {
    ItemRef: latinCode(v.ItemRef, "شناسهٔ آیتم", 60),
    ItemType,
    SizeInch,
    Quantity: num(v.Quantity, "مقدار", 0.001, 1e7)!,
    Unit: text(v.Unit, "واحد", 12, false) || "ea",
    ResultCode,
    NdtMethod,
    TestDate: dateOnly(v.TestDate, "تاریخ آزمون", { required: false, noFuture: true, now: opts.now }),
    NoteFa,
  };
}

export function normalizeDisciplineReport(value: unknown, opts: { now?: Date } = {}): DisciplineReportInput {
  const v = record(value, "گزارش دیسیپلینی");
  keys(v, DISCIPLINE_REPORT_FIELDS);
  const Discipline = choice(v.Discipline, DISCIPLINES, "دیسیپلین");
  const rawLines = v.Lines;
  if (!Array.isArray(rawLines) || rawLines.length === 0) bad("گزارش دیسیپلینی حداقل یک خط لازم دارد");
  if (rawLines.length > 300) bad("هر گزارش حداکثر ۳۰۰ خط می‌پذیرد");
  const Lines = rawLines.map((line) => normalizeDisciplineLine(line, Discipline, opts));
  const refs = Lines.map((l) => l.ItemRef);
  if (new Set(refs).size !== refs.length) bad("شناسهٔ آیتم در یک گزارش تکراری است");
  return {
    ReportNo: latinCode(v.ReportNo, "شمارهٔ گزارش", 40),
    ReportDate: dateOnly(v.ReportDate, "تاریخ گزارش", { noFuture: true, now: opts.now })!,
    Discipline,
    ContractorCode: latinCode(v.ContractorCode, "کد پیمانکار", 60),
    WorkAreaCode: latinCode(v.WorkAreaCode, "کد حوزهٔ کاری", 40, false) || null,
    Status: choice(v.Status, REPORT_STATUS, "وضعیت", "draft"),
    NoteFa: text(v.NoteFa, "یادداشت", 1000, false) || null,
    Lines,
  };
}

/** شاخص‌های یک گزارش از خطوط واقعی — نرخ بدون داده `null` است، نه صفر. */
export function disciplineMetrics(lines: DisciplineLineInput[]) {
  const byType: Record<string, number> = {};
  for (const l of lines) byType[l.ItemType] = (byType[l.ItemType] ?? 0) + 1;
  const decided = lines.filter((l) => ITEMS_WITH_RESULT.includes(l.ItemType) && (l.ResultCode === "ok" || l.ResultCode === "rejected"));
  const accepted = decided.filter((l) => l.ResultCode === "ok").length;
  const ndt = lines.filter((l) => l.ItemType === "ndt");
  const ndtDecided = ndt.filter((l) => l.ResultCode === "ok" || l.ResultCode === "rejected");
  const ndtOk = ndtDecided.filter((l) => l.ResultCode === "ok").length;
  return {
    lines: lines.length,
    byType,
    welds: byType.weld ?? 0,
    fitUps: byType.fitup ?? 0,
    pwht: byType.pwht ?? 0,
    decidedItems: decided.length,
    rejectedItems: decided.length - accepted,
    passRate: decided.length ? Number((accepted / decided.length).toFixed(4)) : null,
    ndtTotal: ndt.length,
    ndtDecided: ndtDecided.length,
    ndtPassRate: ndtDecided.length ? Number((ndtOk / ndtDecided.length).toFixed(4)) : null,
  };
}

/* ══════════ ۷. CPM-4 درخواست بازرسی و آزادسازی توسط QC ══════════ */

export type InspectionInput = {
  RequestNo: string;
  RequestType: string;
  ActivityCode: string;
  WorkAreaCode: string | null;
  Discipline: Discipline;
  ContractorCode: string;
  LocationFa: string;
  ScopeFa: string;
  RequestedAt: string;
  TargetDate: string | null;
  WitnessRequired: boolean;
  NcrRef: string | null;
  NoteFa: string | null;
};
export const INSPECTION_FIELDS: readonly string[] = [
  "RequestNo", "RequestType", "ActivityCode", "WorkAreaCode", "Discipline", "ContractorCode", "LocationFa",
  "ScopeFa", "RequestedAt", "TargetDate", "WitnessRequired", "NcrRef", "NoteFa",
];

export function normalizeInspection(value: unknown, opts: { now?: Date } = {}): InspectionInput {
  const v = record(value, "درخواست بازرسی");
  keys(v, INSPECTION_FIELDS);
  const RequestedAt = dateOnly(v.RequestedAt, "تاریخ درخواست", { noFuture: true, now: opts.now })!;
  const TargetDate = dateOnly(v.TargetDate, "تاریخ بازرسی", { required: false });
  if (TargetDate && TargetDate < RequestedAt) bad("تاریخ بازرسی نباید پیش از تاریخ درخواست باشد");
  return {
    RequestNo: latinCode(v.RequestNo, "شمارهٔ درخواست", 40),
    RequestType: choice(v.RequestType, INSPECTION_TYPES, "نوع درخواست", "ir"),
    ActivityCode: latinCode(v.ActivityCode, "فعالیت", 60),
    WorkAreaCode: latinCode(v.WorkAreaCode, "کد حوزهٔ کاری", 40, false) || null,
    Discipline: choice(v.Discipline, DISCIPLINES, "دیسیپلین"),
    ContractorCode: latinCode(v.ContractorCode, "کد پیمانکار", 60),
    LocationFa: text(v.LocationFa, "موقعیت", 200),
    ScopeFa: text(v.ScopeFa, "شرح بازرسی", 1500),
    RequestedAt,
    TargetDate,
    WitnessRequired: bool(v.WitnessRequired, "نیاز به شاهد", false),
    NcrRef: latinCode(v.NcrRef, "مرجع NCR", 40, false) || null,
    NoteFa: text(v.NoteFa, "یادداشت", 1000, false) || null,
  };
}

/**
 * گردش کار درخواست بازرسی. جداسازی وظیفه: آزادسازی/رد فقط توسط کاربری که
 * درخواست را ثبت نکرده است. برگشت به عقب وجود ندارد.
 */
export function inspectionTransition(
  request: { Status: string; CreatedBy?: string; RequestedBy?: string },
  action: string,
  actor: string,
  opts: { note?: string | null } = {}
): { Status: string; patch: Record<string, unknown> } {
  const act = choice(action, INSPECTION_ACTIONS, "اقدام");
  const status = String(request.Status ?? "");
  const creator = String(request.CreatedBy ?? request.RequestedBy ?? "");
  const note = String(opts.note ?? "").trim();
  const now = new Date().toISOString();
  if (act === "submit") {
    if (status !== "draft") bad("فقط درخواست پیش‌نویس ارسال می‌شود");
    return { Status: "submitted", patch: { Status: "submitted", SubmittedAt: now, SubmittedBy: actor } };
  }
  if (act === "release" || act === "reject") {
    if (status !== "submitted") bad("آزادسازی/رد فقط برای درخواست ارسال‌شده ممکن است");
    if (!creator) bad("ثبت‌کنندهٔ درخواست مشخص نیست؛ تفکیک وظیفه قابل کنترل نیست");
    if (creator === actor) bad("ثبت‌کنندهٔ درخواست نمی‌تواند خودش آن را آزاد یا رد کند (تفکیک وظیفه)");
    if (act === "reject" && !note) bad("رد درخواست بدون دلیل ثبت نمی‌شود");
    return act === "release"
      ? { Status: "released", patch: { Status: "released", ReleasedAt: now, ReleasedBy: actor, DecisionNoteFa: note || null } }
      : { Status: "rejected", patch: { Status: "rejected", RejectedAt: now, RejectedBy: actor, DecisionNoteFa: note } };
  }
  if (status !== "draft" && status !== "submitted") bad("فقط پیش‌نویس یا درخواست ارسال‌شده لغو می‌شود");
  if (creator && creator !== actor) bad("فقط ثبت‌کنندهٔ درخواست می‌تواند آن را لغو کند");
  return { Status: "cancelled", patch: { Status: "cancelled", CancelledAt: now, CancelledBy: actor } };
}

/** اعلان ۴۸ ساعته: از تاریخ درخواست تا تاریخ بازرسی — نامعلوم وقتی تاریخ بازرسی نیست. */
export function noticeCheck(requestedAt: string, targetDate: string | null): { status: "ok" | "short" | "unknown"; hours: number | null } {
  if (!targetDate) return { status: "unknown", hours: null };
  const hours = Math.round((Date.parse(targetDate + "T00:00:00Z") - Date.parse(requestedAt + "T00:00:00Z")) / 3600000);
  return { status: hours >= NOTICE_HOURS ? "ok" : "short", hours };
}

/** شاخص‌های تجمیعی CPMS از رکوردهای واقعی همان پروژه. */
export function cpmsMetrics(input: {
  workAreas: any[];
  dprEntries: any[];
  reports: any[];
  lines: any[];
  requests: any[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const today = todayIso(now);
  const wbs = new Set(input.workAreas.map((w) => w.WbsCode).filter(Boolean));
  const contractors = new Set(input.workAreas.map((w) => w.ContractorCode).filter(Boolean));
  const weightTotal = input.workAreas.reduce((s, w) => s + (Number.isFinite(Number(w.WeightPct)) ? Number(w.WeightPct) : 0), 0);
  const dprDates = input.dprEntries.map((d) => String(d.ReportDate)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const lastDpr = dprDates.at(-1) ?? null;
  const open = input.requests.filter((r) => r.Status === "submitted");
  const released = input.requests.filter((r) => r.Status === "released");
  const rejected = input.requests.filter((r) => r.Status === "rejected");
  const pendingReleaseActivities = [...new Set(
    open.filter((r) => !released.some((x) => x.ActivityCode === r.ActivityCode)).map((r) => r.ActivityCode)
  )];
  return {
    workAreas: {
      total: input.workAreas.length,
      active: input.workAreas.filter((w) => w.Status === "active").length,
      wbsCovered: wbs.size,
      contractors: contractors.size,
      weightTotal: input.workAreas.length && input.workAreas.every((w) => w.WeightPct === null || w.WeightPct === undefined) ? null : Number(weightTotal.toFixed(2)),
    },
    dpr: {
      total: input.dprEntries.length,
      draft: input.dprEntries.filter((d) => d.Status === "draft").length,
      submitted: input.dprEntries.filter((d) => d.Status === "submitted").length,
      approved: input.dprEntries.filter((d) => d.Status === "approved").length,
      returned: input.dprEntries.filter((d) => d.Status === "returned").length,
      lastReportDate: lastDpr,
      daysSinceLastReport: lastDpr ? daysBetween(lastDpr, today) : null,
    },
    discipline: {
      reports: input.reports.length,
      approved: input.reports.filter((r) => r.Status === "approved").length,
      ...disciplineMetrics(input.lines as DisciplineLineInput[]),
    },
    inspection: {
      total: input.requests.length,
      open: open.length,
      released: released.length,
      rejected: rejected.length,
      cancelled: input.requests.filter((r) => r.Status === "cancelled").length,
      releaseRate: input.requests.length ? Number((released.length / input.requests.length).toFixed(4)) : null,
      pendingReleaseActivities,
    },
    generatedAt: now.toISOString(),
    modelVersion: CPM_MODEL,
  };
}

/* ═══════════ ۸. شکل دادهٔ میز کار برای کلاینت (پاسخ /workspace) ═══════════ */

export type CpmRowMeta = {
  Id: string;
  ProjectId: string;
  RowVersion: number;
  ModelVersion?: string | null;
  CreatedAt?: string;
  CreatedBy?: string;
  UpdatedAt?: string;
  UpdatedBy?: string;
};

export type CpmWorkAreaRow = WorkAreaInput & CpmRowMeta;
export type CpmDprRow = DprEntryInput & CpmRowMeta & {
  SubmittedAt?: string | null;
  SubmittedBy?: string | null;
  ApprovedAt?: string | null;
  ApprovedBy?: string | null;
  ReturnNoteFa?: string | null;
};
export type CpmDisciplineLineRow = DisciplineLineInput & { Id: string; ProjectId: string; ReportNo: string };
export type CpmDisciplineReportRow = Omit<DisciplineReportInput, "Lines"> & CpmRowMeta & {
  LineCount?: number;
  RejectedCount?: number;
  NdtPassRate?: number | null;
  Lines?: CpmDisciplineLineRow[];
  metrics?: ReturnType<typeof disciplineMetrics>;
};
export type CpmInspectionRow = InspectionInput & CpmRowMeta & {
  Status: string;
  RequestedBy?: string | null;
  SubmittedAt?: string | null;
  SubmittedBy?: string | null;
  ReleasedAt?: string | null;
  ReleasedBy?: string | null;
  RejectedAt?: string | null;
  RejectedBy?: string | null;
  DecisionNoteFa?: string | null;
  InspectionRecordId?: string | null;
  notice?: ReturnType<typeof noticeCheck>;
  ageDays?: number | null;
};

export type CpmCan = {
  workAreaEdit: boolean;
  dprRecord: boolean;
  dprApprove: boolean;
  disciplineRecord: boolean;
  disciplineApprove: boolean;
  inspectionRequest: boolean;
  inspectionRelease: boolean;
};

export type CpmWorkspacePayload = {
  projectId: string;
  can: CpmCan;
  workAreas: CpmWorkAreaRow[];
  dprEntries: CpmDprRow[];
  reports: CpmDisciplineReportRow[];
  requests: CpmInspectionRow[];
  attachments: (CpmRowMeta & { ReportNo: string; Kind: string; FileName: string; MimeType: string; SizeBytes: number; Checksum: string; UploadedBy?: string })[] | any[];
  metrics: ReturnType<typeof cpmsMetrics>;
  generatedAt: string;
  modelVersion: string;
};
