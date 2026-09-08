/**
 * Arena Platform — Integration Centre (itg-v1)
 * ---------------------------------------------------------------------------
 * ورود داده از دنیای بیرون: پریماورا P6 (XER)، قالب‌های Excel/CSV، و تولید OpenAPI.
 *
 * قید طراحی: فایل کاملاً خالص است — نه فایل می‌خواند نه شبکه می‌زند نه به express
 * وابسته است. ورودی «متن» است و خروجی «ردیف قانونی». به همین دلیل کل موتور در Node
 * تست می‌شود و همان کد در مرورگر هم برای پیش‌نمایش پیش از بارگذاری کار می‌کند.
 *
 * تبدیل تاریخ شمسی عمداً تزریق می‌شود (پارامتر `jalaliToGregorian`) تا این ماژول
 * به هیچ بستهٔ npm گره نخورد.
 *
 * می‌بندد: PEX-G5 (ورود XER) · PEX-G7 (OpenAPI) · بخشی از «اکسل ظرف است نه منبع حقیقت»
 */

export const INTEGRATION_VERSION = "itg-v1";

export type Bi = { fa: string; en: string };
export type Lang = "fa" | "en";

/* ═══════════════════════════ ۱. کمکی مشترک ═══════════════════════════ */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** ارقام فارسی و عربی را به لاتین برمی‌گرداند و جداکنندهٔ هزارگان را پاک می‌کند. */
export function normalizeDigits(value: unknown): string {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/\u200c/g, "")
    .trim();
}

export function toNumber(value: unknown): number | null {
  const s = normalizeDigits(value).replace(/,/g, "").replace(/%$/, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type JalaliConverter = (jy: number, jm: number, jd: number) => { gy: number; gm: number; gd: number };

/**
 * تاریخ را به ISO برمی‌گرداند.
 * سال کمتر از ۱۷۰۰ شمسی فرض می‌شود؛ اگر مبدل تزریق نشده باشد null برمی‌گردد
 * تا به‌جای تاریخ غلط، خطای صریح تولید شود.
 */
export function toIsoDate(value: unknown, jalali?: JalaliConverter): string | null {
  if (value === null || value === undefined) return null;
  const s = normalizeDigits(value);
  if (!s) return null;
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (y < 1700) {
    if (!jalali) return null;
    const g = jalali(y, mo, d);
    return `${String(g.gy).padStart(4, "0")}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
  }
  return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function toBool(value: unknown): boolean {
  const s = normalizeDigits(value).toLowerCase();
  return ["y", "yes", "true", "1", "بله", "دارد", "on"].includes(s);
}

/* ═══════════════════════════ ۲. تجزیه‌گر XER ═══════════════════════════ */

/**
 * XER قالب متنی صادرات پریماورا است:
 *   %T <TABLE>      شروع جدول
 *   %F f1 f2 f3     نام ستون‌ها (جدا شده با tab)
 *   %R v1 v2 v3     یک ردیف
 *   %E              پایان فایل
 */
export type XerTables = Record<string, Record<string, string>[]>;

export type XerHeader = { version?: string; exportedAt?: string; projectName?: string; user?: string };

export type XerFile = { header: XerHeader; tables: XerTables; tableNames: string[] };

export function parseXer(content: string): XerFile {
  const tables: XerTables = {};
  const header: XerHeader = {};
  let current: string | null = null;
  let fields: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine) continue;
    const tag = rawLine.slice(0, 2);
    const body = rawLine.slice(3);

    if (tag === "ERMHDR") {
      // خط سرآیند tab-separated است و با ERMHDR شروع می‌شود، نه %.
    }
    if (rawLine.startsWith("ERMHDR")) {
      const parts = rawLine.split("\t");
      header.version = parts[1];
      header.exportedAt = parts[2];
      header.user = parts[4];
      header.projectName = parts[7];
      continue;
    }
    if (tag === "%T") {
      current = body.trim().toUpperCase();
      fields = [];
      if (!tables[current]) tables[current] = [];
      continue;
    }
    if (tag === "%F") {
      fields = body.split("\t").map((f) => f.trim());
      continue;
    }
    if (tag === "%R" && current && fields.length) {
      const values = body.split("\t");
      const row: Record<string, string> = {};
      fields.forEach((f, i) => {
        row[f] = (values[i] ?? "").trim();
      });
      tables[current].push(row);
      continue;
    }
    if (tag === "%E") break;
  }

  return { header, tables, tableNames: Object.keys(tables) };
}

/* ── نگاشت پریماورا ── */

export const XER_STATUS: Record<string, string> = {
  TK_NotStart: "not_started",
  TK_Active: "in_progress",
  TK_Complete: "completed",
};

export const XER_RELATION: Record<string, "FS" | "SS" | "FF" | "SF"> = {
  PR_FS: "FS",
  PR_SS: "SS",
  PR_FF: "FF",
  PR_SF: "SF",
};

export const XER_CONSTRAINT: Record<string, Bi> = {
  CS_MSO: { fa: "شروع در تاریخ معین", en: "Start On" },
  CS_MSOA: { fa: "شروع در یا بعد از", en: "Start On or After" },
  CS_MSOB: { fa: "شروع در یا قبل از", en: "Start On or Before" },
  CS_MEO: { fa: "پایان در تاریخ معین", en: "Finish On" },
  CS_MEOA: { fa: "پایان در یا بعد از", en: "Finish On or After" },
  CS_MEOB: { fa: "پایان در یا قبل از", en: "Finish On or Before" },
  CS_MANDSTART: { fa: "شروع اجباری", en: "Mandatory Start" },
  CS_MANDFIN: { fa: "پایان اجباری", en: "Mandatory Finish" },
  CS_ALAP: { fa: "تا حد ممکن دیر", en: "As Late As Possible" },
};

/** ساعت پریماورا را به روز تبدیل می‌کند. پیش‌فرض ۸ ساعت در روز. */
export function hoursToDays(hours: unknown, hoursPerDay = 8): number | null {
  const h = toNumber(hours);
  if (h === null) return null;
  if (hoursPerDay <= 0) return null;
  return Math.round((h / hoursPerDay) * 100) / 100;
}

export type XerCalendar = { id: string; name: string; hoursPerDay: number; isDefault: boolean };

export function extractCalendars(x: XerFile): XerCalendar[] {
  return (x.tables.CALENDAR ?? []).map((r) => ({
    id: r.clndr_id,
    name: r.clndr_name || r.clndr_id,
    hoursPerDay: toNumber(r.day_hr_cnt) ?? 8,
    isDefault: toBool(r.default_flag),
  }));
}

export type XerWbs = { Id: string; ProjectId: string; Code: string; NameFa: string; ParentId: string | null; Level: number };

export function extractWbs(x: XerFile, projectId: string): XerWbs[] {
  const rows = x.tables.PROJWBS ?? [];
  const byId = new Map(rows.map((r) => [r.wbs_id, r]));
  const level = (r: Record<string, string>, depth = 0): number => {
    const parent = r.parent_wbs_id && byId.get(r.parent_wbs_id);
    if (!parent || depth > 30) return depth;
    return level(parent, depth + 1);
  };
  return rows.map((r) => ({
    Id: `${projectId}:wbs:${r.wbs_id}`,
    ProjectId: projectId,
    Code: r.wbs_short_name || r.wbs_id,
    NameFa: r.wbs_name || r.wbs_short_name || r.wbs_id,
    ParentId: r.parent_wbs_id && byId.has(r.parent_wbs_id) ? `${projectId}:wbs:${r.parent_wbs_id}` : null,
    Level: level(r),
  }));
}

export type XerActivity = {
  Id: string;
  ProjectId: string;
  WbsId: string | null;
  Code: string;
  NameFa: string;
  PlannedStart: string | null;
  PlannedFinish: string | null;
  ActualStart: string | null;
  ActualFinish: string | null;
  DurationDays: number | null;
  TotalFloat: number | null;
  FreeFloat: number | null;
  PhysicalPct: number;
  IsCritical: boolean;
  /** خارج از اسکیمای پایگاه داده — فقط برای نمایش و بازرسی ورود */
  _status: string;
  _constraint: string | null;
  _calendarId: string | null;
};

export type XerRelation = { Id: string; PredecessorId: string; SuccessorId: string; RelType: "FS" | "SS" | "FF" | "SF"; LagDays: number };

export type XerExtract = {
  projectName: string | null;
  dataDate: string | null;
  calendars: XerCalendar[];
  wbs: XerWbs[];
  activities: XerActivity[];
  relations: XerRelation[];
  issues: ImportIssue[];
  counts: Record<string, number>;
};

export type ImportIssue = { code: string; severity: "error" | "warning"; row?: number; column?: string; message: string };

/**
 * استخراج کامل از XER به ردیف‌های قانونی اسکیمای `sql-v1`.
 * تاریخ‌های نامعتبر ردیف را دور نمی‌ریزند؛ به‌عنوان هشدار گزارش می‌شوند تا
 * کاربر تصمیم بگیرد، نه اینکه بی‌سروصدا داده گم شود.
 */
export function extractXer(x: XerFile, projectId: string, jalali?: JalaliConverter): XerExtract {
  const issues: ImportIssue[] = [];
  const calendars = extractCalendars(x);
  const defaultHours = calendars.find((c) => c.isDefault)?.hoursPerDay ?? calendars[0]?.hoursPerDay ?? 8;
  const hoursById = new Map(calendars.map((c) => [c.id, c.hoursPerDay]));

  const projectRow = (x.tables.PROJECT ?? [])[0];
  const wbs = extractWbs(x, projectId);
  const wbsIds = new Set(wbs.map((w) => w.Id));

  const taskRows = x.tables.TASK ?? [];
  if (taskRows.length === 0) issues.push({ code: "W-ITG-XER-NOTASK", severity: "warning", message: "جدول TASK در فایل XER خالی یا موجود نیست" });

  const codeSeen = new Map<string, number>();
  const activities: XerActivity[] = taskRows.map((r, i) => {
    const hpd = hoursById.get(r.clndr_id) ?? defaultHours;
    const code = r.task_code || r.task_id || `ACT-${String(i + 1).padStart(4, "0")}`;
    if (codeSeen.has(code)) {
      issues.push({ code: "E-ITG-XER-DUPCODE", severity: "error", row: i + 1, column: "task_code", message: `کد فعالیت تکراری: ${code}` });
    }
    codeSeen.set(code, i);

    const ps = toIsoDate(r.target_start_date || r.early_start_date, jalali);
    const pf = toIsoDate(r.target_end_date || r.early_end_date, jalali);
    if (!ps || !pf) {
      issues.push({ code: "W-ITG-XER-NODATE", severity: "warning", row: i + 1, message: `فعالیت ${code} تاریخ برنامه‌ای معتبر ندارد` });
    } else if (pf < ps) {
      issues.push({ code: "E-ITG-XER-BADRANGE", severity: "error", row: i + 1, message: `فعالیت ${code}: پایان پیش از شروع` });
    }

    const tf = hoursToDays(r.total_float_hr_cnt, hpd);
    const pct = toNumber(r.phys_complete_pct) ?? 0;

    return {
      Id: `${projectId}:act:${r.task_id || code}`,
      ProjectId: projectId,
      WbsId: r.wbs_id && wbsIds.has(`${projectId}:wbs:${r.wbs_id}`) ? `${projectId}:wbs:${r.wbs_id}` : null,
      Code: code,
      NameFa: r.task_name || code,
      PlannedStart: ps,
      PlannedFinish: pf,
      ActualStart: toIsoDate(r.act_start_date, jalali),
      ActualFinish: toIsoDate(r.act_end_date, jalali),
      DurationDays: hoursToDays(r.target_drtn_hr_cnt, hpd),
      TotalFloat: tf === null ? null : Math.round(tf),
      FreeFloat: (() => {
        const ff = hoursToDays(r.free_float_hr_cnt, hpd);
        return ff === null ? null : Math.round(ff);
      })(),
      PhysicalPct: Math.max(0, Math.min(100, pct)),
      // بحرانی بودن از شناوری کل استنتاج می‌شود، نه از پرچم مسیر راهبر —
      // چون driving_path_flag در همه صادرات‌ها پر نمی‌شود.
      IsCritical: tf !== null ? tf <= 0 : toBool(r.driving_path_flag),
      _status: XER_STATUS[r.status_code] ?? "unknown",
      _constraint: r.cstr_type || null,
      _calendarId: r.clndr_id || null,
    };
  });

  const actIds = new Set(activities.map((a) => a.Id));
  const relRows = x.tables.TASKPRED ?? [];
  const relations: XerRelation[] = [];
  for (const [i, r] of relRows.entries()) {
    const pred = `${projectId}:act:${r.pred_task_id}`;
    const succ = `${projectId}:act:${r.task_id}`;
    if (!actIds.has(pred) || !actIds.has(succ)) {
      issues.push({ code: "W-ITG-XER-ORPHANREL", severity: "warning", row: i + 1, message: `رابطه به فعالیت ناموجود اشاره دارد (${r.pred_task_id} → ${r.task_id})` });
      continue;
    }
    const relType = XER_RELATION[r.pred_type] ?? "FS";
    if (!XER_RELATION[r.pred_type]) {
      issues.push({ code: "W-ITG-XER-RELTYPE", severity: "warning", row: i + 1, message: `نوع رابطهٔ ناشناخته ${r.pred_type} — FS فرض شد` });
    }
    const hpd = hoursById.get(r.clndr_id ?? "") ?? defaultHours;
    relations.push({
      Id: `${projectId}:rel:${r.task_pred_id || `${r.pred_task_id}-${r.task_id}-${relType}`}`,
      PredecessorId: pred,
      SuccessorId: succ,
      RelType: relType,
      LagDays: Math.round(hoursToDays(r.lag_hr_cnt, hpd) ?? 0),
    });
  }

  return {
    projectName: projectRow?.proj_short_name || x.header.projectName || null,
    dataDate: toIsoDate(projectRow?.last_recalc_date, jalali),
    calendars,
    wbs,
    activities,
    relations,
    issues,
    counts: {
      tables: x.tableNames.length,
      calendars: calendars.length,
      wbs: wbs.length,
      activities: activities.length,
      relations: relations.length,
      errors: issues.filter((i) => i.severity === "error").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
    },
  };
}

/* ═══════════════════════════ ۳. آشتی‌دهی ورود ═══════════════════════════ */

export type DiffResult<T> = { added: T[]; updated: { before: T; after: T; changed: string[] }[]; removed: T[]; unchanged: number };

/**
 * ورود مجدد برنامه نباید کورکورانه درج کند.
 * این تابع تفاوت را می‌سازد تا کاربر پیش از نوشتن ببیند چه چیزی عوض می‌شود.
 */
export function diffRows<T extends Record<string, unknown>>(existing: T[], incoming: T[], keyField: string, compareFields: string[]): DiffResult<T> {
  const byKey = new Map(existing.map((r) => [String(r[keyField]), r]));
  const seen = new Set<string>();
  const added: T[] = [];
  const updated: { before: T; after: T; changed: string[] }[] = [];
  let unchanged = 0;

  for (const row of incoming) {
    const k = String(row[keyField]);
    seen.add(k);
    const before = byKey.get(k);
    if (!before) {
      added.push(row);
      continue;
    }
    const changed = compareFields.filter((f) => {
      const a = before[f];
      const b = row[f];
      if (a === null && b === undefined) return false;
      if (a === undefined && b === null) return false;
      return a !== b;
    });
    if (changed.length) updated.push({ before, after: row, changed });
    else unchanged++;
  }

  const removed = existing.filter((r) => !seen.has(String(r[keyField])));
  return { added, updated, removed, unchanged };
}

export const ACTIVITY_COMPARE_FIELDS = ["NameFa", "PlannedStart", "PlannedFinish", "ActualStart", "ActualFinish", "DurationDays", "TotalFloat", "PhysicalPct", "IsCritical", "WbsId"];

/* ═══════════════════════════ ۴. تجزیه‌گر CSV ═══════════════════════════ */

/**
 * تجزیه‌گر RFC 4180: نقل‌قول، نقل‌قول تودرتو و خط جدید داخل سلول را می‌فهمد.
 * `split(",")` ساده روی داده‌های واقعی می‌شکند و بی‌سروصدا ستون‌ها را جابه‌جا می‌کند.
 */
export function parseDelimited(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** تشخیص خودکار جداکننده — اکسل فارسی گاهی نقطه‌ویرگول می‌دهد. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/* ═══════════════════════════ ۵. قالب‌های Excel/CSV ═══════════════════════════ */

export type FieldKind = "text" | "number" | "int" | "date" | "bool" | "enum";

export type TemplateField = {
  key: string;
  title: Bi;
  kind: FieldKind;
  required?: boolean;
  /** نام‌های جایگزین سرستون که پذیرفته می‌شوند */
  aliases: string[];
  enumValues?: string[];
  maxLen?: number;
  min?: number;
  max?: number;
  sample: string;
  note?: Bi;
};

export type TemplateDef = {
  code: string;
  title: Bi;
  targetTable: string;
  module: string;
  keyFields: string[];
  fields: TemplateField[];
};

const f = (key: string, fa: string, en: string, kind: FieldKind, sample: string, extra: Partial<TemplateField> = {}): TemplateField => ({
  key,
  title: { fa, en },
  kind,
  aliases: [key, fa, en, key.toLowerCase()],
  sample,
  ...extra,
});

export const TEMPLATE_CATALOG: TemplateDef[] = [
  {
    code: "TPL-ACT",
    title: { fa: "فعالیت‌های برنامه", en: "Schedule activities" },
    targetTable: "Activity",
    module: "d2",
    keyFields: ["Code"],
    fields: [
      f("Code", "کد فعالیت", "Activity ID", "text", "A-1010", { required: true, maxLen: 60, aliases: ["Code", "کد فعالیت", "Activity ID", "ActivityID", "task_code", "activity_id"] }),
      f("NameFa", "شرح فعالیت", "Activity Name", "text", "بتن‌ریزی فونداسیون واحد ۱", { required: true, maxLen: 400, aliases: ["NameFa", "شرح فعالیت", "نام فعالیت", "Activity Name", "task_name", "Name"] }),
      f("Discipline", "دیسیپلین", "Discipline", "text", "civil", { maxLen: 40, aliases: ["Discipline", "دیسیپلین", "رشته"] }),
      f("PlannedStart", "شروع برنامه‌ای", "Planned Start", "date", "2026-09-01", { required: true, aliases: ["PlannedStart", "شروع برنامه‌ای", "شروع", "Planned Start", "Start", "target_start_date"] }),
      f("PlannedFinish", "پایان برنامه‌ای", "Planned Finish", "date", "2026-09-20", { required: true, aliases: ["PlannedFinish", "پایان برنامه‌ای", "پایان", "Planned Finish", "Finish", "target_end_date"] }),
      f("DurationDays", "مدت (روز)", "Duration (days)", "int", "20", { min: 0, max: 3650, aliases: ["DurationDays", "مدت", "مدت (روز)", "Duration", "Original Duration"] }),
      f("TotalFloat", "شناوری کل (روز)", "Total float (days)", "int", "5", { aliases: ["TotalFloat", "شناوری کل", "شناوری", "Total Float", "TF"] }),
      f("PhysicalPct", "درصد پیشرفت", "Progress %", "number", "35.5", { min: 0, max: 100, aliases: ["PhysicalPct", "درصد پیشرفت", "پیشرفت", "Progress", "% Complete", "Physical % Complete"] }),
      f("BudgetCost", "هزینه بودجه‌ای", "Budget cost", "number", "1250000000", { min: 0, aliases: ["BudgetCost", "هزینه بودجه‌ای", "بودجه", "Budget", "BAC"] }),
    ],
  },
  {
    code: "TPL-PRG",
    title: { fa: "ثبت پیشرفت دوره‌ای", en: "Periodic progress" },
    targetTable: "ProgressEntry",
    module: "d2",
    keyFields: ["ActivityId", "EntryDate"],
    fields: [
      f("ActivityId", "کد فعالیت", "Activity ID", "text", "A-1010", { required: true, maxLen: 60, aliases: ["ActivityId", "کد فعالیت", "Activity ID", "activity_id"] }),
      f("EntryDate", "تاریخ ثبت", "Entry date", "date", "2026-09-08", { required: true, aliases: ["EntryDate", "تاریخ ثبت", "تاریخ", "Date"] }),
      f("PeriodCode", "کد دوره", "Period", "text", "1405-06", { required: true, maxLen: 20, aliases: ["PeriodCode", "کد دوره", "دوره", "Period"] }),
      f("PhysicalPct", "درصد پیشرفت", "Progress %", "number", "42", { required: true, min: 0, max: 100, aliases: ["PhysicalPct", "درصد پیشرفت", "پیشرفت", "Progress"] }),
      f("EnteredBy", "ثبت‌کننده", "Entered by", "text", "u-site", { required: true, maxLen: 60, aliases: ["EnteredBy", "ثبت‌کننده", "Entered By"] }),
      f("Note", "توضیح", "Note", "text", "دو تیم فعال", { maxLen: 500, aliases: ["Note", "توضیح", "شرح", "Remarks"] }),
    ],
  },
  {
    code: "TPL-TMS",
    title: { fa: "تایم‌شیت نیروی کار", en: "Workforce timesheet" },
    targetTable: "Timesheet",
    module: "d10",
    keyFields: ["MemberId", "WorkDate"],
    fields: [
      f("MemberId", "شماره پرسنلی", "Personnel no", "text", "P-10432", { required: true, maxLen: 60, aliases: ["MemberId", "شماره پرسنلی", "پرسنلی", "Personnel", "Personnel No"] }),
      f("WorkDate", "تاریخ کارکرد", "Work date", "date", "2026-09-08", { required: true, aliases: ["WorkDate", "تاریخ کارکرد", "تاریخ", "Date"] }),
      f("NormalHours", "ساعت عادی", "Normal hours", "number", "8.5", { required: true, min: 0, max: 24, aliases: ["NormalHours", "ساعت عادی", "عادی", "Normal"] }),
      f("OvertimeHours", "اضافه‌کاری", "Overtime hours", "number", "2", { min: 0, max: 16, aliases: ["OvertimeHours", "اضافه‌کاری", "اضافه کاری", "Overtime", "OT"] }),
      f("HolidayHours", "کار در تعطیلات", "Holiday hours", "number", "0", { min: 0, max: 24, aliases: ["HolidayHours", "کار در تعطیلات", "تعطیل‌کاری", "Holiday"] }),
      f("ActivityId", "کد فعالیت", "Activity ID", "text", "A-1010", { maxLen: 60, aliases: ["ActivityId", "کد فعالیت", "Activity ID"] }),
      f("EnteredBy", "ثبت‌کننده", "Entered by", "text", "u-site", { required: true, maxLen: 60, aliases: ["EnteredBy", "ثبت‌کننده"] }),
    ],
  },
  {
    code: "TPL-NCR",
    title: { fa: "عدم انطباق", en: "Non-conformance" },
    targetTable: "Ncr",
    module: "d8",
    keyFields: ["Code"],
    fields: [
      f("Code", "شماره NCR", "NCR no", "text", "NCR-0042", { required: true, maxLen: 40, aliases: ["Code", "شماره NCR", "شماره", "NCR No"] }),
      f("TitleFa", "شرح عدم انطباق", "Description", "text", "انحراف ابعادی قالب‌بندی", { required: true, maxLen: 400, aliases: ["TitleFa", "شرح عدم انطباق", "شرح", "Description", "Title"] }),
      f("Severity", "شدت", "Severity", "enum", "major", { required: true, enumValues: ["minor", "major", "critical"], aliases: ["Severity", "شدت", "درجه"] }),
      f("Discipline", "دیسیپلین", "Discipline", "text", "civil", { required: true, maxLen: 40, aliases: ["Discipline", "دیسیپلین", "رشته"] }),
      f("RaisedBy", "صادرکننده", "Raised by", "text", "u-qc", { required: true, maxLen: 60, aliases: ["RaisedBy", "صادرکننده", "Raised By"] }),
      f("RaisedAt", "تاریخ صدور", "Raised at", "date", "2026-09-02", { required: true, aliases: ["RaisedAt", "تاریخ صدور", "تاریخ", "Date"] }),
      f("DueAt", "مهلت رفع", "Due at", "date", "2026-09-16", { aliases: ["DueAt", "مهلت رفع", "مهلت", "Due"] }),
      f("Status", "وضعیت", "Status", "enum", "open", { required: true, enumValues: ["open", "in_progress", "closed", "void"], aliases: ["Status", "وضعیت"] }),
    ],
  },
  {
    code: "TPL-COR",
    title: { fa: "مکاتبات", en: "Correspondence" },
    targetTable: "Correspondence",
    module: "d11",
    keyFields: ["LetterNo"],
    fields: [
      f("LetterNo", "شماره نامه", "Letter no", "text", "ARN-OUT-1405-0231", { required: true, maxLen: 80, aliases: ["LetterNo", "شماره نامه", "شماره", "Letter No"] }),
      f("Direction", "جهت", "Direction", "enum", "outgoing", { required: true, enumValues: ["incoming", "outgoing", "internal"], aliases: ["Direction", "جهت", "نوع"] }),
      f("Kind", "دسته", "Kind", "enum", "general", { required: true, enumValues: ["general", "instruction", "notice", "claim_notice", "submittal", "rfi", "ncr_related"], aliases: ["Kind", "دسته", "طبقه"] }),
      f("SubjectFa", "موضوع", "Subject", "text", "اعلام تأخیر در تحویل زمین", { required: true, maxLen: 500, aliases: ["SubjectFa", "موضوع", "Subject"] }),
      f("IssuedAt", "تاریخ صدور", "Issued at", "date", "2026-09-03", { required: true, aliases: ["IssuedAt", "تاریخ صدور", "تاریخ", "Date"] }),
      f("DueAt", "مهلت پاسخ", "Due at", "date", "2026-09-17", { aliases: ["DueAt", "مهلت پاسخ", "مهلت", "Due"] }),
      f("Status", "وضعیت", "Status", "enum", "open", { required: true, enumValues: ["draft", "open", "answered", "closed"], aliases: ["Status", "وضعیت"] }),
    ],
  },
  {
    code: "TPL-CST",
    title: { fa: "حساب‌های هزینه", en: "Cost accounts" },
    targetTable: "CostAccount",
    module: "d5",
    keyFields: ["Code"],
    fields: [
      f("Code", "کد حساب", "Account code", "text", "CA-01-100", { required: true, maxLen: 40, aliases: ["Code", "کد حساب", "کد", "Account Code"] }),
      f("TitleFa", "عنوان حساب", "Account title", "text", "عملیات خاکی", { required: true, maxLen: 300, aliases: ["TitleFa", "عنوان حساب", "عنوان", "Title"] }),
      f("Budget", "بودجه", "Budget", "number", "8500000000", { required: true, min: 0, aliases: ["Budget", "بودجه", "مبلغ بودجه"] }),
      f("Committed", "تعهد شده", "Committed", "number", "3200000000", { min: 0, aliases: ["Committed", "تعهد شده", "تعهدات"] }),
      f("Actual", "هزینه واقعی", "Actual", "number", "2750000000", { min: 0, aliases: ["Actual", "هزینه واقعی", "واقعی"] }),
    ],
  },
];

const TPL_BY_CODE = new Map(TEMPLATE_CATALOG.map((t) => [t.code, t]));

export function templateByCode(code: string): TemplateDef | undefined {
  return TPL_BY_CODE.get(code);
}

/* ── تولید قالب ── */

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** فایل CSV نمونه با سرستون فارسی و یک ردیف راهنما. */
export function templateCsv(t: TemplateDef, lang: Lang = "fa"): string {
  const header = t.fields.map((fd) => csvCell(lang === "fa" ? fd.title.fa : fd.title.en));
  const sample = t.fields.map((fd) => csvCell(fd.sample));
  return `${header.join(",")}\r\n${sample.join(",")}\r\n`;
}

/** توضیح ستون‌ها برای برگهٔ راهنمای کنار قالب. */
export function templateGuide(t: TemplateDef, lang: Lang = "fa"): { column: string; required: boolean; kind: string; rule: string }[] {
  return t.fields.map((fd) => ({
    column: lang === "fa" ? fd.title.fa : fd.title.en,
    required: !!fd.required,
    kind: fd.kind,
    rule: [
      fd.enumValues ? `${lang === "fa" ? "مقادیر مجاز" : "allowed"}: ${fd.enumValues.join(" | ")}` : "",
      fd.maxLen ? `${lang === "fa" ? "حداکثر" : "max"} ${fd.maxLen} ${lang === "fa" ? "نویسه" : "chars"}` : "",
      fd.min !== undefined || fd.max !== undefined ? `${fd.min ?? "-∞"} … ${fd.max ?? "+∞"}` : "",
      fd.kind === "date" ? "YYYY-MM-DD" : "",
    ]
      .filter(Boolean)
      .join(" · "),
  }));
}

/* ── نگاشت سرستون ── */

const normHeader = (s: string) => normalizeDigits(s).toLowerCase().replace(/[\s_\-‌]/g, "");

export type HeaderMap = { byIndex: (TemplateField | null)[]; unmatched: string[]; missingRequired: TemplateField[] };

/** سرستون‌های فایل را به میدان‌های قالب می‌بندد؛ فارسی و انگلیسی و نام‌های پریماورا. */
export function mapHeaders(t: TemplateDef, headers: string[]): HeaderMap {
  const lookup = new Map<string, TemplateField>();
  for (const fd of t.fields) for (const a of fd.aliases) lookup.set(normHeader(a), fd);

  const byIndex = headers.map((h) => lookup.get(normHeader(h)) ?? null);
  const unmatched = headers.filter((h, i) => byIndex[i] === null && h.trim() !== "");
  const matched = new Set(byIndex.filter(Boolean).map((fd) => fd!.key));
  const missingRequired = t.fields.filter((fd) => fd.required && !matched.has(fd.key));
  return { byIndex, unmatched, missingRequired };
}

/* ── اعتبارسنجی و تبدیل سلول ── */

export function coerceCell(field: TemplateField, raw: string, jalali?: JalaliConverter): { value: unknown; issue?: string } {
  const s = normalizeDigits(raw);
  if (s === "") {
    if (field.required) return { value: null, issue: `${field.title.fa} اجباری است` };
    return { value: null };
  }
  switch (field.kind) {
    case "int":
    case "number": {
      const n = toNumber(s);
      if (n === null) return { value: null, issue: `${field.title.fa} عدد نیست: «${raw}»` };
      if (field.kind === "int" && !Number.isInteger(n)) return { value: Math.round(n), issue: undefined };
      if (field.min !== undefined && n < field.min) return { value: n, issue: `${field.title.fa} کمتر از ${field.min} است` };
      if (field.max !== undefined && n > field.max) return { value: n, issue: `${field.title.fa} بیشتر از ${field.max} است` };
      return { value: n };
    }
    case "date": {
      const iso = toIsoDate(s, jalali);
      if (!iso) return { value: null, issue: `${field.title.fa} تاریخ معتبر نیست: «${raw}»` };
      return { value: iso };
    }
    case "bool":
      return { value: toBool(s) };
    case "enum":
      if (field.enumValues && !field.enumValues.includes(s)) {
        return { value: s, issue: `${field.title.fa} خارج از مقادیر مجاز: «${raw}»` };
      }
      return { value: s };
    default:
      if (field.maxLen && s.length > field.maxLen) return { value: s.slice(0, field.maxLen), issue: `${field.title.fa} از ${field.maxLen} نویسه بلندتر است` };
      return { value: s };
  }
}

export type ParsedImport = {
  template: string;
  targetTable: string;
  headers: string[];
  rows: Record<string, unknown>[];
  issues: ImportIssue[];
  counts: { total: number; valid: number; invalid: number; duplicates: number; errors: number; warnings: number };
};

/**
 * متن CSV/TSV را به ردیف‌های آمادهٔ نوشتن در جدول هدف تبدیل می‌کند.
 * ردیف دارای خطا دور ریخته نمی‌شود؛ با شمارهٔ سطر و ستون گزارش می‌شود.
 */
export function parseImport(t: TemplateDef, text: string, jalali?: JalaliConverter): ParsedImport {
  const delimiter = detectDelimiter(text);
  const grid = parseDelimited(text, delimiter);
  const issues: ImportIssue[] = [];

  if (grid.length === 0) {
    return { template: t.code, targetTable: t.targetTable, headers: [], rows: [], issues: [{ code: "E-ITG-EMPTY", severity: "error", message: "فایل خالی است" }], counts: { total: 0, valid: 0, invalid: 0, duplicates: 0, errors: 1, warnings: 0 } };
  }

  const headers = grid[0].map((h) => h.trim());
  const map = mapHeaders(t, headers);
  for (const h of map.unmatched) issues.push({ code: "W-ITG-UNKNOWNCOL", severity: "warning", column: h, message: `ستون «${h}» شناخته نشد و نادیده گرفته می‌شود` });
  for (const fd of map.missingRequired) issues.push({ code: "E-ITG-MISSINGCOL", severity: "error", column: fd.key, message: `ستون اجباری «${fd.title.fa}» در فایل نیست` });

  const rows: Record<string, unknown>[] = [];
  const keySeen = new Set<string>();
  let invalid = 0;
  let duplicates = 0;

  if (map.missingRequired.length === 0) {
    for (let r = 1; r < grid.length; r++) {
      const line = grid[r];
      const out: Record<string, unknown> = {};
      let rowBad = false;

      map.byIndex.forEach((fd, ci) => {
        if (!fd) return;
        const { value, issue } = coerceCell(fd, line[ci] ?? "", jalali);
        out[fd.key] = value;
        if (issue) {
          issues.push({ code: "E-ITG-CELL", severity: "error", row: r + 1, column: fd.title.fa, message: issue });
          rowBad = true;
        }
      });

      const key = t.keyFields.map((k) => String(out[k] ?? "")).join("|");
      if (t.keyFields.length && key.replace(/\|/g, "") !== "") {
        if (keySeen.has(key)) {
          issues.push({ code: "E-ITG-DUPKEY", severity: "error", row: r + 1, message: `کلید تکراری در فایل: ${key}` });
          duplicates++;
          rowBad = true;
        }
        keySeen.add(key);
      }

      if (rowBad) invalid++;
      else rows.push(out);
    }
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  return {
    template: t.code,
    targetTable: t.targetTable,
    headers,
    rows,
    issues,
    counts: { total: Math.max(0, grid.length - 1), valid: rows.length, invalid, duplicates, errors, warnings: issues.length - errors },
  };
}

/* ═══════════════════════════ ۶. تولید OpenAPI ═══════════════════════════ */

export type OpenApiTable = {
  name: string;
  title: Bi;
  pk: string;
  columns: { name: string; kind: string; len?: number; nullable?: boolean }[];
};

const OPENAPI_TYPE: Record<string, { type: string; format?: string }> = {
  uuid: { type: "string", format: "uuid" },
  text: { type: "string" },
  int: { type: "integer", format: "int32" },
  bigint: { type: "integer", format: "int64" },
  decimal: { type: "number", format: "double" },
  bool: { type: "boolean" },
  date: { type: "string", format: "date" },
  datetime: { type: "string", format: "date-time" },
  json: { type: "object" },
};

/**
 * مشخصات OpenAPI از **اسکیمای قانونی** ساخته می‌شود، نه دستی.
 * تنها راه اینکه سند و کد از هم جدا نیفتند همین است.
 */
export function generateOpenApi(tables: OpenApiTable[], opts: { title?: string; version?: string; serverUrl?: string } = {}) {
  const schemas: Record<string, unknown> = {};
  const paths: Record<string, unknown> = {};

  for (const t of tables) {
    const props: Record<string, unknown> = {};
    const required: string[] = [];
    for (const col of t.columns) {
      const base = OPENAPI_TYPE[col.kind] ?? { type: "string" };
      props[col.name] = { ...base, ...(col.len ? { maxLength: col.len } : {}), nullable: col.nullable !== false };
      if (col.nullable === false) required.push(col.name);
    }
    schemas[t.name] = { type: "object", description: t.title.fa, properties: props, ...(required.length ? { required } : {}) };

    const ref = { $ref: `#/components/schemas/${t.name}` };
    const notFound = { description: "یافت نشد", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } };

    paths[`/api/data/${t.name}`] = {
      get: {
        tags: [t.name],
        summary: `فهرست ${t.title.fa}`,
        parameters: [
          { name: "where", in: "query", schema: { type: "array", items: { type: "string" } }, description: "Col:op:value — op ∈ eq|ne|gt|gte|lt|lte|like|in|isnull|notnull" },
          { name: "order", in: "query", schema: { type: "string" }, description: "Col:asc یا Col:desc" },
          { name: "limit", in: "query", schema: { type: "integer", default: 200, maximum: 1000 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, data: { type: "object", properties: { items: { type: "array", items: ref }, total: { type: "integer" } } } } } } } },
          400: { description: "ستون ناشناخته", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
      post: {
        tags: [t.name],
        summary: `ایجاد ${t.title.fa}`,
        requestBody: { required: true, content: { "application/json": { schema: ref } } },
        responses: {
          201: { description: "ایجاد شد", content: { "application/json": { schema: ref } } },
          409: { description: "کلید تکراری", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          422: { description: "اعتبارسنجی ردیف ناموفق", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    };

    paths[`/api/data/${t.name}/{id}`] = {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: { tags: [t.name], summary: `دریافت ${t.title.fa}`, responses: { 200: { description: "OK", content: { "application/json": { schema: ref } } }, 404: notFound } },
      patch: {
        tags: [t.name],
        summary: `به‌روزرسانی ${t.title.fa}`,
        parameters: [{ name: "If-Match", in: "header", schema: { type: "integer" }, description: "RowVersion مورد انتظار — کنترل هم‌زمانی خوش‌بینانه" }],
        requestBody: { required: true, content: { "application/json": { schema: ref } } },
        responses: { 200: { description: "OK", content: { "application/json": { schema: ref } } }, 404: notFound, 409: { description: "تعارض هم‌زمانی", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } } },
      },
      delete: { tags: [t.name], summary: `حذف ${t.title.fa}`, responses: { 200: { description: "حذف شد" }, 404: notFound } },
    };
  }

  paths["/api/integration/xer"] = {
    post: {
      tags: ["Integration"],
      summary: "ورود برنامه پریماورا (XER)",
      requestBody: { required: true, content: { "text/plain": { schema: { type: "string" } }, "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } },
      responses: { 200: { description: "استخراج و تفاوت", content: { "application/json": { schema: { type: "object" } } } } },
    },
  };
  paths["/api/integration/templates"] = { get: { tags: ["Integration"], summary: "کاتالوگ قالب‌های ورود", responses: { 200: { description: "OK" } } } };
  paths["/api/integration/templates/{code}.csv"] = { get: { tags: ["Integration"], parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }], summary: "دانلود قالب CSV", responses: { 200: { description: "CSV" } } } };
  paths["/api/integration/import/{code}"] = {
    post: {
      tags: ["Integration"],
      parameters: [
        { name: "code", in: "path", required: true, schema: { type: "string" } },
        { name: "commit", in: "query", schema: { type: "boolean", default: false }, description: "false یعنی فقط اعتبارسنجی خشک" },
      ],
      summary: "ورود داده از قالب",
      requestBody: { required: true, content: { "text/csv": { schema: { type: "string" } } } },
      responses: { 200: { description: "نتیجه ورود" }, 422: { description: "خطای اعتبارسنجی" } },
    },
  };

  schemas.ApiError = {
    type: "object",
    properties: {
      ok: { type: "boolean", example: false },
      error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, traceId: { type: "string" } } },
    },
  };

  return {
    openapi: "3.0.3",
    info: {
      title: opts.title ?? "Arena Platform Data & Integration API",
      version: opts.version ?? "1.0.0",
      description: "تولیدشده به‌صورت خودکار از اسکیمای قانونی sql-v1 — دستی ویرایش نکنید.",
    },
    servers: [{ url: opts.serverUrl ?? "http://localhost:4000", description: "Local" }],
    tags: [{ name: "Integration" }, ...tables.map((t) => ({ name: t.name, description: t.title.fa }))],
    paths,
    components: { schemas, securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
  };
}

/** YAML مینیمال — فقط برای همین ساختار داده (بدون وابستگی npm). */
export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value === "") return '""';
    if (/^[\w./#-]+$/.test(value) && !/^\d+$/.test(value)) return value;
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.map((v) => `\n${pad}- ${toYaml(v, indent + 1).replace(/^\n/, "")}`).join("");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .map(([k, v]) => {
      const key = /^[\w./-]+$/.test(k) ? k : `"${k}"`;
      const rendered = toYaml(v, indent + 1);
      if (typeof v === "object" && v !== null && !(Array.isArray(v) && v.length === 0) && Object.keys(v as object).length > 0) {
        return Array.isArray(v) ? `\n${pad}${key}:${rendered}` : `\n${pad}${key}:${rendered}`;
      }
      return `\n${pad}${key}: ${rendered}`;
    })
    .join("");
}

/* ═══════════════════════════ ۷. رجیستری اتصال‌دهنده ═══════════════════════════ */

export type ConnectorDef = {
  code: string;
  title: Bi;
  direction: "inbound" | "outbound" | "both";
  format: string;
  targetTables: string[];
  status: "ready" | "partial" | "planned";
  note: Bi;
};

export const CONNECTORS: ConnectorDef[] = [
  {
    code: "CN-P6-XER",
    title: { fa: "پریماورا P6 — فایل XER", en: "Primavera P6 — XER file" },
    direction: "inbound",
    format: "XER",
    targetTables: ["WbsNode", "Activity", "ActivityRelation"],
    status: "ready",
    note: { fa: "تجزیهٔ کامل TASK، TASKPRED، PROJWBS و CALENDAR با تفاوت‌گیری پیش از نوشتن", en: "Full TASK, TASKPRED, PROJWBS and CALENDAR parsing with pre-write diff" },
  },
  {
    code: "CN-XLS-TPL",
    title: { fa: "قالب‌های Excel و CSV", en: "Excel & CSV templates" },
    direction: "both",
    format: "CSV / XLSX",
    targetTables: TEMPLATE_CATALOG.map((t) => t.targetTable),
    status: "ready",
    note: { fa: "شش قالب با نگاشت سرستون فارسی/انگلیسی و اعتبارسنجی سلولی", en: "Six templates with FA/EN header mapping and per-cell validation" },
  },
  {
    code: "CN-OPENAPI",
    title: { fa: "OpenAPI 3.0", en: "OpenAPI 3.0" },
    direction: "outbound",
    format: "JSON / YAML",
    targetTables: [],
    status: "ready",
    note: { fa: "از اسکیمای قانونی sql-v1 تولید می‌شود، پس هرگز با کد واگرا نمی‌شود", en: "Generated from the canonical sql-v1 schema so it cannot drift" },
  },
  {
    code: "CN-MSP",
    title: { fa: "Microsoft Project", en: "Microsoft Project" },
    direction: "inbound",
    format: "MPP / XML",
    targetTables: ["Activity"],
    status: "planned",
    note: { fa: "MPP قالب باینری بسته است؛ مسیر عملی، صادرات XML پروژه است", en: "MPP is a closed binary; the practical route is Project XML export" },
  },
  {
    code: "CN-MAIL",
    title: { fa: "ایمیل و پیامک", en: "Email & SMS" },
    direction: "outbound",
    format: "SMTP / HTTP",
    targetTables: [],
    status: "partial",
    note: { fa: "کد ارسال هست ولی سرویس‌دهنده پیکربندی نشده", en: "Sending code exists but no provider configured" },
  },
  {
    code: "CN-ERP",
    title: { fa: "سامانه مالی سازمان", en: "Corporate ERP" },
    direction: "both",
    format: "REST",
    targetTables: ["CostAccount", "PaymentCertificate"],
    status: "planned",
    note: { fa: "نیازمند تعریف قرارداد داده با واحد مالی", en: "Requires a data contract with the finance department" },
  },
];

export function connectorsByStatus(status: ConnectorDef["status"]): ConnectorDef[] {
  return CONNECTORS.filter((c) => c.status === status);
}

export function integrationStats() {
  return {
    connectors: CONNECTORS.length,
    ready: connectorsByStatus("ready").length,
    templates: TEMPLATE_CATALOG.length,
    templateFields: TEMPLATE_CATALOG.reduce((s, t) => s + t.fields.length, 0),
  };
}
