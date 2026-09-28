/**
 * RPT-1 — گزارش‌ساز سفارشی (P9).
 *
 * قالب گزارش یک **مشخصات اعتبارسنجی‌شده** است: مجموعه‌داده + فیلدها + فیلترها
 * + گروه‌بندی + نمودار. هیچ SQL آزادی از کاربر پذیرفته نمی‌شود؛ فقط نام
 * ستون‌های مجاز هر مجموعه‌داده، عملگرهای بسته و توابع تجمیع شناخته‌شده.
 *
 * همین ماژول هم در مرورگر (پیش‌نمایش زنده) و هم در سرور (اجرای ذخیره‌شده‌ها
 * و ساخت where ماندگاری) استفاده می‌شود تا تعریف قالب یک جا بماند.
 */
export const REPORT_BUILDER_MODEL = "rpt-builder-v1";

export type Bi = { fa: string; en: string };
export type RbLang = "fa" | "en";
export type RbColumnKind = "text" | "number" | "money" | "date" | "enum" | "bool";

export type RbColumn = {
  name: string;
  label: Bi;
  kind: RbColumnKind;
  values?: readonly string[];
};

export type RbDataset = {
  key: string;
  table: string;
  label: Bi;
  /** مجوز پایهٔ داده؛ بدون آن، مجموعه‌داده حتی با مجوز گزارش‌ساز دیده نمی‌شود. */
  permissions: readonly string[];
  columns: readonly RbColumn[];
};

const C = (name: string, fa: string, en: string, kind: RbColumnKind, values?: readonly string[]): RbColumn =>
  values ? { name, label: { fa, en }, kind, values } : { name, label: { fa, en }, kind };

export const RB_DATASETS: readonly RbDataset[] = [
  {
    key: "activities",
    table: "Activity",
    label: { fa: "فعالیت‌های برنامه", en: "Schedule activities" },
    permissions: ["plan.schedule.view"],
    columns: [
      C("Code", "کد", "Code", "text"),
      C("NameFa", "عنوان", "Title", "text"),
      C("Discipline", "دیسیپلین", "Discipline", "text"),
      C("PlannedStart", "شروع برنامه‌ای", "Planned start", "date"),
      C("PlannedFinish", "پایان برنامه‌ای", "Planned finish", "date"),
      C("ActualStart", "شروع واقعی", "Actual start", "date"),
      C("ActualFinish", "پایان واقعی", "Actual finish", "date"),
      C("DurationDays", "مدت (روز)", "Duration (days)", "number"),
      C("TotalFloat", "شناوری کل", "Total float", "number"),
      C("PhysicalPct", "پیشرفت فیزیکی", "Physical %", "number"),
      C("BudgetCost", "بودجه", "Budget cost", "money"),
      C("IsCritical", "مسیر بحرانی", "Critical", "bool"),
      C("WbsId", "WBS", "WBS", "text"),
    ],
  },
  {
    key: "wbs",
    table: "WbsNode",
    label: { fa: "ساختار شکست کار", en: "WBS nodes" },
    permissions: ["plan.schedule.view"],
    columns: [
      C("Code", "کد WBS", "WBS code", "text"),
      C("NameFa", "عنوان", "Title", "text"),
      C("ParentId", "والد", "Parent", "text"),
      C("Level", "سطح", "Level", "number"),
      C("Weight", "وزن", "Weight", "number"),
    ],
  },
  {
    key: "documents",
    table: "Document",
    label: { fa: "مدارک", en: "Documents" },
    permissions: ["doc.document.view"],
    columns: [
      C("DocNo", "شمارهٔ مدرک", "Doc no", "text"),
      C("TitleFa", "عنوان", "Title", "text"),
      C("Revision", "ویرایش", "Revision", "text"),
      C("Discipline", "دیسیپلین", "Discipline", "text"),
      C("Classification", "طبقه‌بندی", "Classification", "text"),
      C("Status", "وضعیت", "Status", "enum", ["draft", "under_review", "approved", "issued", "superseded", "void"]),
      C("IssuedAt", "تاریخ صدور", "Issued at", "date"),
      C("SlaHours", "مهلت (ساعت)", "SLA hours", "number"),
    ],
  },
  {
    key: "proc_packages",
    table: "ScmProcPackage",
    label: { fa: "بسته‌های خرید", en: "Procurement packages" },
    permissions: ["scm.package.view"],
    columns: [
      C("Code", "کد بسته", "Package code", "text"),
      C("TitleFa", "عنوان", "Title", "text"),
      C("Discipline", "دیسیپلین", "Discipline", "text"),
      C("Status", "وضعیت", "Status", "text"),
      C("PlannedIssueDate", "تاریخ صدور برنامه‌ای", "Planned issue", "date"),
      C("TotalEstimatedAmount", "مبلغ برآوردی", "Estimated amount", "money"),
      C("Currency", "ارز", "Currency", "text"),
    ],
  },
  {
    key: "purchase_orders",
    table: "PurchaseOrder",
    label: { fa: "سفارش‌های خرید", en: "Purchase orders" },
    permissions: ["fin.cost.view"],
    columns: [
      C("PoNo", "شمارهٔ سفارش", "PO no", "text"),
      C("PrCode", "درخواست خرید", "PR code", "text"),
      C("VendorName", "فروشنده", "Vendor", "text"),
      C("VendorCode", "کد فروشنده", "Vendor code", "text"),
      C("TitleFa", "عنوان", "Title", "text"),
      C("Discipline", "دیسیپلین", "Discipline", "text"),
      C("Status", "وضعیت", "Status", "text"),
      C("Amount", "مبلغ", "Amount", "money"),
      C("Currency", "ارز", "Currency", "text"),
      C("IssuedAt", "تاریخ صدور", "Issued at", "date"),
      C("PromisedDate", "تاریخ وعده", "Promised", "date"),
      C("DeliveredDate", "تاریخ تحویل", "Delivered", "date"),
      C("Quantity", "مقدار", "Quantity", "number"),
      C("PaidAmount", "پرداخت‌شده", "Paid", "money"),
      C("KpiOnTimePct", "KPI به‌موقع", "On-time KPI", "number"),
    ],
  },
  {
    key: "ipc_certificates",
    table: "CntIpcCertificate",
    label: { fa: "صورت‌وضعیت‌ها", en: "IPC certificates" },
    /* همان مجوزهای میز کار صورت‌وضعیت: بازبین/تهیه‌کننده/دارندهٔ پیمان. */
    permissions: ["cnt.ipc.review", "cnt.ipc.prepare", "cnt.contract.view"],
    columns: [
      C("TemplateCode", "قالب", "Template", "text"),
      C("ContractCode", "پیمان", "Contract", "text"),
      C("PeriodNo", "دوره", "Period", "number"),
      C("PeriodFrom", "از تاریخ", "From", "date"),
      C("PeriodTo", "تا تاریخ", "To", "date"),
      C("Currency", "ارز", "Currency", "text"),
      C("GrossAmount", "ناخالص", "Gross", "money"),
      C("DeductionTotal", "کسورات", "Deductions", "money"),
      C("NetAmount", "خالص", "Net", "money"),
      C("Status", "وضعیت", "Status", "enum", ["draft", "submitted", "approved", "returned"]),
    ],
  },
  {
    key: "dpr",
    table: "CpmDprEntry",
    label: { fa: "گزارش‌های روزانه", en: "Daily reports" },
    permissions: ["cpm.dpr.view"],
    columns: [
      C("ReportNo", "شمارهٔ گزارش", "Report no", "text"),
      C("ReportDate", "تاریخ", "Date", "date"),
      C("Shift", "شیفت", "Shift", "enum", ["day", "night"]),
      C("Discipline", "دیسیپلین", "Discipline", "text"),
      C("ContractorCode", "پیمانکار", "Contractor", "text"),
      C("WorkAreaCode", "حوزهٔ کاری", "Work area", "text"),
      C("LocationFa", "موقعیت", "Location", "text"),
      C("ManpowerCount", "نفرات", "Manpower", "number"),
      C("EquipmentCount", "ماشین‌آلات", "Equipment", "number"),
      C("Status", "وضعیت", "Status", "enum", ["draft", "submitted", "approved", "returned"]),
    ],
  },
  {
    key: "inspections",
    table: "CpmInspectionRequest",
    label: { fa: "درخواست‌های بازرسی", en: "Inspection requests" },
    permissions: ["cpm.inspection.view"],
    columns: [
      C("RequestNo", "شمارهٔ درخواست", "Request no", "text"),
      C("RequestType", "نوع", "Type", "enum", ["ir", "rfi"]),
      C("ActivityCode", "فعالیت", "Activity", "text"),
      C("Discipline", "دیسیپلین", "Discipline", "text"),
      C("ContractorCode", "پیمانکار", "Contractor", "text"),
      C("RequestedAt", "زمان درخواست", "Requested at", "date"),
      C("TargetDate", "تاریخ هدف", "Target date", "date"),
      C("WitnessRequired", "حضور شاهد", "Witness", "bool"),
      C("Status", "وضعیت", "Status", "enum", ["draft", "submitted", "released", "rejected", "cancelled"]),
    ],
  },
  {
    key: "ncrs",
    table: "Ncr",
    label: { fa: "عدم‌انطباق‌ها", en: "NCRs" },
    permissions: ["qms.itp.view"],
    columns: [
      C("Code", "کد", "Code", "text"),
      C("TitleFa", "عنوان", "Title", "text"),
      C("Severity", "شدت", "Severity", "text"),
      C("Discipline", "دیسیپلین", "Discipline", "text"),
      C("RaisedAt", "تاریخ صدور", "Raised at", "date"),
      C("DueAt", "مهلت", "Due at", "date"),
      C("Status", "وضعیت", "Status", "text"),
      C("Disposition", "اقدام", "Disposition", "text"),
    ],
  },
  {
    key: "risks",
    table: "Risk",
    label: { fa: "ریسک‌ها", en: "Risks" },
    permissions: ["rcc.risk.view"],
    columns: [
      C("Code", "کد", "Code", "text"),
      C("TitleFa", "عنوان", "Title", "text"),
      C("Category", "دسته", "Category", "text"),
      C("Probability", "احتمال", "Probability", "number"),
      C("Impact", "اثر", "Impact", "number"),
      C("Score", "امتیاز", "Score", "number"),
      C("Status", "وضعیت", "Status", "text"),
      C("Owner", "مالک", "Owner", "text"),
    ],
  },
  {
    key: "health",
    table: "PmoHealthAssessment",
    label: { fa: "کارت‌های سلامت پروژه", en: "Project health cards" },
    permissions: ["pmo.health.view"],
    columns: [
      C("AsOfDate", "تاریخ ارزیابی", "As of", "date"),
      C("PeriodNo", "دوره", "Period", "number"),
      C("ScoreTotal", "امتیاز", "Score", "number"),
      C("Band", "باند", "Band", "enum", ["green", "amber", "red"]),
      C("Status", "وضعیت", "Status", "enum", ["draft", "submitted", "approved", "returned"]),
    ],
  },
] as const;

export function datasetByKey(key: unknown): RbDataset | undefined {
  const k = String(key ?? "").trim();
  return RB_DATASETS.find((d) => d.key === k);
}
export function columnOf(dataset: RbDataset, name: unknown): RbColumn | undefined {
  const n = String(name ?? "").trim();
  return dataset.columns.find((c) => c.name === n);
}
export function defaultFields(dataset: RbDataset): string[] {
  return dataset.columns.filter((c) => c.kind !== "bool").slice(0, 5).map((c) => c.name);
}

export class RbError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RbError";
  }
}
const bad = (message: string) => new RbError("E-RPT-VALIDATION", message);

export const RB_FILTER_OPS = ["eq", "ne", "contains", "starts", "gt", "gte", "lt", "lte", "in", "empty", "notempty"] as const;
export type RbFilterOp = (typeof RB_FILTER_OPS)[number];
/** عملگرهایی که فقط روی ستون عددی/تاریخی/پولی معنا دارند. */
const ORDERED_OPS: readonly string[] = ["gt", "gte", "lt", "lte"];
const NUMERIC_KINDS: readonly RbColumnKind[] = ["number", "money"];
export const RB_AGG_FUNCS = ["count", "sum", "avg", "min", "max"] as const;
export type RbAggFunc = (typeof RB_AGG_FUNCS)[number];
export const RB_CHART_KINDS = ["none", "bar", "line", "pie"] as const;
export type RbChartKind = (typeof RB_CHART_KINDS)[number];
export const RB_MAX_LIMIT = 5000;
export const RB_MAX_FILTERS = 8;

export type RbFilter = { column: string; op: RbFilterOp; value?: string | number | null; values?: (string | number)[] };
export type RbAgg = { column: string; fn: RbAggFunc };
export type RbGroup = { by: string; aggs: RbAgg[] };
export type RbSort = { column: string; dir: "asc" | "desc" };
export type RbChart = { kind: RbChartKind; category: string; measure: string };
export type RbSpec = {
  dataset: string;
  fields: string[];
  filters: RbFilter[];
  group: RbGroup | null;
  sort: RbSort[];
  limit: number;
  chart: RbChart | null;
};

const asRecord = (v: unknown, what: string): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad(`«${what}» باید شیء باشد`);
  return v as Record<string, unknown>;
};
const asList = (v: unknown, what: string, min: number, max: number): unknown[] => {
  if (!Array.isArray(v)) throw bad(`«${what}» باید فهرست باشد`);
  if (v.length < min) throw bad(`«${what}» باید حداقل ${min} مورد داشته باشد`);
  if (v.length > max) throw bad(`«${what}» حداکثر ${max} مورد می‌پذیرد`);
  return v;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], what: string): T => {
  const s = String(v ?? "").trim() as T;
  if (!allowed.includes(s)) throw bad(`«${what}» باید یکی از ${allowed.join(" / ")} باشد`);
  return s;
};

/** مقدار فیلتر بر پایهٔ نوع ستون نرمال می‌شود؛ فیلتر متنی روی ستون عددی معنا ندارد. */
export function normalizeFilter(dataset: RbDataset, raw: unknown, index: number): RbFilter {
  const f = asRecord(raw, `فیلتر ${index + 1}`);
  const column = columnOf(dataset, f.column);
  if (!column) throw bad(`ستون فیلتر ${index + 1} در مجموعه‌دادهٔ «${dataset.label.fa}» نیست`);
  const op = oneOf<RbFilterOp>(f.op, RB_FILTER_OPS, `عملگر فیلتر ${index + 1}`);
  if (ORDERED_OPS.includes(op) && column.kind === "text") throw bad(`عملگر «${op}» روی ستون متنی «${column.name}» مجاز نیست`);
  if (["empty", "notempty"].includes(op)) return { column: column.name, op };
  if (op === "in") {
    const values = asList(f.values, `مقادیر فیلتر ${index + 1}`, 1, 50);
    return { column: column.name, op, values: values.map((v, i) => coerceValue(column, v, `مقدار ${i + 1} فیلتر ${index + 1}`)) as (string | number)[] };
  }
  if (op === "contains" || op === "starts") {
    if (column.kind !== "text" && column.kind !== "enum") throw bad(`عملگر «${op}» فقط روی ستون متنی است`);
    const value = String(f.value ?? "").trim();
    if (!value) throw bad("مقدار جست‌وجو خالی است");
    return { column: column.name, op, value };
  }
  return { column: column.name, op, value: coerceValue(column, f.value, `مقدار فیلتر ${index + 1}`) };
}

function coerceValue(column: RbColumn, value: unknown, what: string): string | number | null {
  if (value === null || value === undefined || value === "") {
    if (column.kind === "text" || column.kind === "enum") return null;
    throw bad(`«${what}» خالی است`);
  }
  if (NUMERIC_KINDS.includes(column.kind)) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw bad(`«${what}» باید عدد باشد`);
    return n;
  }
  if (column.kind === "bool") return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
  const s = String(value).trim();
  if (column.kind === "date" && !/^\d{4}-\d{2}-\d{2}/.test(s)) throw bad(`«${what}» باید تاریخ ISO باشد`);
  if (column.kind === "enum" && column.values && !column.values.includes(s)) throw bad(`«${what}» باید یکی از مقادیر مجاز «${column.name}» باشد`);
  return s;
}

/** مشخصات قالب را می‌سنجد و نسخهٔ نرمال‌شده و قابل‌ذخیره برمی‌گرداند. */
export function normalizeSpec(value: unknown, opts: { maxLimit?: number } = {}): RbSpec {
  const raw = asRecord(value, "قالب گزارش");
  const dataset = datasetByKey(raw.dataset);
  if (!dataset) throw bad(`مجموعه‌دادهٔ «${String(raw.dataset ?? "")}» شناخته‌شده نیست`);
  const fieldNames = raw.fields === undefined ? defaultFields(dataset) : asList(raw.fields, "فیلدها", 1, 12).map((f) => {
    const c = columnOf(dataset, f);
    if (!c) throw bad(`ستون «${String(f)}» در مجموعه‌دادهٔ «${dataset.label.fa}» نیست`);
    return c.name;
  });
  const fields = [...new Set(fieldNames)];
  if (!fields.length) throw bad("حداقل یک ستون لازم است");

  const filters = (raw.filters === undefined ? [] : asList(raw.filters, "فیلترها", 0, RB_MAX_FILTERS)).map((f, i) => normalizeFilter(dataset, f, i));

  let group: RbGroup | null = null;
  if (raw.group !== undefined && raw.group !== null) {
    const g = asRecord(raw.group, "گروه‌بندی");
    const by = columnOf(dataset, g.by);
    if (!by) throw bad("ستون گروه‌بندی در مجموعه‌داده نیست");
    if (!fields.includes(by.name)) throw bad(`ستون گروه‌بندی «${by.name}» باید در فهرست فیلدها باشد`);
    if (by.kind === "money" || by.kind === "number") throw bad("گروه‌بندی روی ستون عددی مجاز نیست؛ از ستون دسته‌ای استفاده کنید");
    const aggs = asList(g.aggs ?? [{ column: by.name, fn: "count" }], "تجمیع‌ها", 1, 4).map((a, i) => {
      const agg = asRecord(a, `تجمیع ${i + 1}`);
      const fn = oneOf<RbAggFunc>(agg.fn, RB_AGG_FUNCS, `تابع تجمیع ${i + 1}`);
      if (fn === "count") {
        const c = columnOf(dataset, agg.column ?? by.name) ?? by;
        return { column: c.name, fn };
      }
      const col = columnOf(dataset, agg.column);
      if (!col) throw bad(`ستون تجمیع ${i + 1} در مجموعه‌داده نیست`);
      const numericOnly = fn === "sum" || fn === "avg";
      if (numericOnly && !NUMERIC_KINDS.includes(col.kind)) throw bad(`تابع «${fn}» فقط روی ستون عددی/مبلغی معنا دارد («${col.name}»)`);
      if (!numericOnly && col.kind === "text") throw bad(`تابع «${fn}» روی ستون متنی «${col.name}» مجاز نیست`);
      return { column: col.name, fn };
    });
    const seen = new Set<string>();
    for (const a of aggs) {
      if (seen.has(`${a.fn}:${a.column}`)) throw bad("تجمیع تکراری در گروه‌بندی");
      seen.add(`${a.fn}:${a.column}`);
    }
    group = { by: by.name, aggs };
  }

  const sortRaw = raw.sort === undefined ? [] : asList(raw.sort, "ترتیب", 0, 3);
  const sort: RbSort[] = sortRaw.map((s, i) => {
    const spec = asRecord(s, `ترتیب ${i + 1}`);
    const column = String(spec.column ?? "").trim();
    const dir = oneOf<"asc" | "desc">(spec.dir ?? "asc", ["asc", "desc"], `جهت ترتیب ${i + 1}`);
    const isAggAlias = /^(count|sum|avg|min|max):[A-Za-z0-9_]+$/.test(column);
    if (!isAggAlias && !fields.includes(column)) throw bad(`ستون ترتیب «${column}» در فهرست فیلدها نیست`);
    if (isAggAlias && !group) throw bad("ترتیب روی نتیجهٔ تجمیع بدون گروه‌بندی معنا ندارد");
    return { column, dir };
  });

  const limitRaw = raw.limit === undefined || raw.limit === null || raw.limit === "" ? 500 : Number(raw.limit);
  if (!Number.isInteger(limitRaw) || limitRaw < 1) throw bad("سقف سطرها باید عددی درست باشد");
  const maxLimit = Math.min(opts.maxLimit ?? RB_MAX_LIMIT, RB_MAX_LIMIT);
  const limit = Math.min(limitRaw, maxLimit);

  let chart: RbChart | null = null;
  if (raw.chart !== undefined && raw.chart !== null && String((raw.chart as RbChart).kind ?? "none") !== "none") {
    const ch = asRecord(raw.chart, "نمودار");
    const kind = oneOf<RbChartKind>(ch.kind, RB_CHART_KINDS, "نوع نمودار");
    const category = String(ch.category ?? group?.by ?? fields[0]).trim();
    const measure = String(ch.measure ?? (group ? `count:${group.by}` : "")).trim();
    if (group) {
      if (category !== group.by) throw bad("محور دستهٔ نمودار باید همان ستون گروه‌بندی باشد");
      if (measure !== `count:${group.by}` && !group.aggs.some((a) => `${a.fn}:${a.column}` === measure)) throw bad("سنجهٔ نمودار باید یکی از تجمیع‌های گروه‌بندی باشد");
    } else {
      if (!fields.includes(category)) throw bad("محور دستهٔ نمودار باید یکی از فیلدهای انتخابی باشد");
      const col = columnOf(dataset, measure);
      if (!col || !NUMERIC_KINDS.includes(col.kind)) throw bad("سنجهٔ نمودار باید ستون عددی/مبلغی انتخاب‌شده باشد");
    }
    chart = { kind, category, measure };
  }

  return { dataset: dataset.key, fields, filters, group, sort, limit, chart };
}

/* ─────────────── اجرا ─────────────── */

export type RbRow = Record<string, string | number | null>;
export type RbGroupRow = { key: string; count: number; aggs: Record<string, number | null> };
export type RbResult = {
  dataset: string;
  table: string;
  fields: string[];
  rows: RbRow[];
  groups: RbGroupRow[] | null;
  totals: Record<string, number>;
  matched: number;
  shown: number;
  truncated: boolean;
  groupBy: string | null;
  generatedAt: string;
};

const numberOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const isoDay = (v: unknown): string | null => {
  if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
};
/** مقدار نمایشی یک سلول بر پایهٔ نوع ستون؛ نامعلوم `null` می‌ماند، نه صفر. */
export function cellValue(column: RbColumn, row: Record<string, unknown>): string | number | null {
  const raw = row[column.name];
  switch (column.kind) {
    case "number":
    case "money":
      return numberOrNull(raw);
    case "date":
      return isoDay(raw) ?? (typeof raw === "string" && raw ? raw : null);
    case "bool":
      return raw === true || raw === 1 || raw === "1" ? 1 : raw === false || raw === 0 || raw === "0" ? 0 : null;
    default:
      return raw === null || raw === undefined || raw === "" ? null : String(raw);
  }
}

/** همان فیلتر سمت مرورگر؛ سرور هم فیلترها را به where ماندگاری ترجمه می‌کند. */
export function matchFilter(column: RbColumn, filter: RbFilter, row: Record<string, unknown>): boolean {
  const value = cellValue(column, row);
  const text = value === null ? "" : String(value).toLowerCase();
  const target = filter.value === null || filter.value === undefined ? "" : String(filter.value).toLowerCase();
  switch (filter.op) {
    case "empty":
      return value === null || value === "";
    case "notempty":
      return !(value === null || value === "");
    case "eq":
      return (value === null ? null : String(value)) === (filter.value === null ? null : String(filter.value));
    case "ne":
      return (value === null ? null : String(value)) !== (filter.value === null ? null : String(filter.value));
    case "contains":
      return text.includes(target);
    case "starts":
      return text.startsWith(target);
    case "in":
      return (filter.values ?? []).some((v) => String(v).toLowerCase() === text);
    default: {
      const left = NUMERIC_KINDS.includes(column.kind) ? numberOrNull(value) : value === null ? null : String(value);
      const right = NUMERIC_KINDS.includes(column.kind) ? numberOrNull(filter.value) : filter.value === null ? null : String(filter.value);
      if (left === null || right === null) return false;
      const cmp = typeof left === "number" && typeof right === "number" ? (left < right ? -1 : left > right ? 1 : 0) : String(left).localeCompare(String(right));
      if (filter.op === "gt") return cmp > 0;
      if (filter.op === "gte") return cmp >= 0;
      if (filter.op === "lt") return cmp < 0;
      return cmp <= 0;
    }
  }
}

export function applyResult(spec: RbSpec, rawRows: readonly Record<string, unknown>[], now = new Date().toISOString()): RbResult {
  const dataset = datasetByKey(spec.dataset)!;
  const columns = spec.fields.map((f) => columnOf(dataset, f)!);
  const matchedRows = rawRows.filter((row) => spec.filters.every((f) => matchFilter(columnOf(dataset, f.column)!, f, row)));

  let groups: RbGroupRow[] | null = null;
  let rows: RbRow[] = [];
  if (spec.group) {
    const by = columnOf(dataset, spec.group.by)!;
    const buckets = new Map<string, { count: number; sums: Record<string, number[]> }>();
    for (const row of matchedRows) {
      const key = cellValue(by, row);
      const label = key === null ? "—" : String(key);
      const bucket = buckets.get(label) ?? { count: 0, sums: {} };
      bucket.count += 1;
      for (const agg of spec.group.aggs) {
        if (agg.fn === "count") continue;
        const n = numberOrNull(cellValue(columnOf(dataset, agg.column)!, row));
        if (n === null) continue;
        (bucket.sums[`${agg.fn}:${agg.column}`] ??= []).push(n);
      }
      buckets.set(label, bucket);
    }
    groups = [...buckets.entries()].map(([key, b]) => {
      const aggs: Record<string, number | null> = {};
      for (const agg of spec.group!.aggs) {
        const alias = `${agg.fn}:${agg.column}`;
        if (agg.fn === "count") { aggs[alias] = b.count; continue; }
        const list = b.sums[alias] ?? [];
        aggs[alias] = list.length === 0 ? null : agg.fn === "sum" ? round(list.reduce((s, n) => s + n, 0)) : agg.fn === "avg" ? round(list.reduce((s, n) => s + n, 0) / list.length) : agg.fn === "min" ? Math.min(...list) : Math.max(...list);
      }
      return { key, count: b.count, aggs };
    });
    groups.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  } else {
    rows = matchedRows.map((row) => {
      const out: RbRow = {};
      for (const col of columns) out[col.name] = cellValue(col, row);
      return out;
    });
  }

  const sortKeys = spec.sort.length ? spec.sort : [];
  const dir = (d: "asc" | "desc") => (d === "desc" ? -1 : 1);
  const cmp = (a: string | number | null, b: string | number | null) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
    return String(a).localeCompare(String(b));
  };
  if (spec.group && groups) {
    const groupRows = groups;
    for (const s of [...sortKeys].reverse()) {
      groupRows.sort((a, b) => {
        const av = s.column.startsWith("count:") ? a.count : s.column === `count:${spec.group!.by}` ? a.count : a.aggs[s.column] ?? null;
        const bv = s.column.startsWith("count:") ? b.count : s.column === `count:${spec.group!.by}` ? b.count : b.aggs[s.column] ?? null;
        return dir(s.dir) * cmp(av as string | number | null, bv as string | number | null);
      });
    }
    if (!sortKeys.length) groupRows.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  } else {
    for (const s of [...sortKeys].reverse()) rows.sort((a, b) => dir(s.dir) * cmp(a[s.column] ?? null, b[s.column] ?? null));
  }

  const totalRows = spec.group ? (groups?.length ?? 0) : rows.length;
  const shownRows = spec.group ? (groups ?? []).slice(0, spec.limit) : rows.slice(0, spec.limit);
  if (spec.group) groups = shownRows as RbGroupRow[];
  else rows = shownRows as RbRow[];

  const totals: Record<string, number> = { matched: matchedRows.length, returned: totalRows };
  for (const col of columns) {
    if (!NUMERIC_KINDS.includes(col.kind)) continue;
    let sum = 0;
    let seen = 0;
    for (const row of matchedRows) {
      const n = numberOrNull(cellValue(col, row));
      if (n === null) continue;
      sum += n;
      seen += 1;
    }
    if (seen) totals[col.name] = round(sum);
  }

  return {
    dataset: dataset.key,
    table: dataset.table,
    fields: spec.fields,
    rows: spec.group ? [] : rows,
    groups: spec.group ? groups : null,
    totals,
    matched: matchedRows.length,
    shown: shownRows.length,
    truncated: totalRows > spec.limit,
    groupBy: spec.group ? spec.group.by : null,
    generatedAt: now,
  };
}
const round = (n: number) => Math.round(n * 1000) / 1000;

export type RbChartSeries = { kind: RbChartKind; category: string; measure: string; points: { label: string; value: number | null }[] };
export function chartSeries(spec: RbSpec, result: RbResult): RbChartSeries | null {
  if (!spec.chart) return null;
  if (result.groups) {
    return {
      kind: spec.chart.kind,
      category: spec.chart.category,
      measure: spec.chart.measure,
      points: result.groups.map((g) => ({ label: g.key, value: spec.chart!.measure === `count:${spec.chart!.category}` ? g.count : g.aggs[spec.chart!.measure] ?? null })),
    };
  }
  return {
    kind: spec.chart.kind,
    category: spec.chart.category,
    measure: spec.chart.measure,
    points: result.rows.map((r) => ({ label: String(r[spec.chart!.category] ?? "—"), value: numberOrNull(r[spec.chart!.measure]) })),
  };
}

export function toResultCsv(dataset: RbDataset, spec: RbSpec, result: RbResult, lang: RbLang = "fa"): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  if (result.groups) {
    const header = [labelOf(spec.group!.by, dataset, lang), "count", ...spec.group!.aggs.filter((a) => a.fn !== "count").map((a) => `${a.fn}:${a.column}`)];
    const lines = [header.join(",")];
    for (const g of result.groups) {
      lines.push([esc(g.key), String(g.count), ...spec.group!.aggs.filter((a) => a.fn !== "count").map((a) => (g.aggs[`${a.fn}:${a.column}`] === null ? "" : String(g.aggs[`${a.fn}:${a.column}`])))].join(","));
    }
    return lines.join("\n");
  }
  const header = spec.fields.map((f) => labelOf(f, dataset, lang));
  const lines = [header.map(esc).join(",")];
  for (const row of result.rows) lines.push(spec.fields.map((f) => esc(row[f] ?? null)).join(","));
  return lines.join("\n");
}
function labelOf(name: string, dataset: RbDataset, lang: RbLang): string {
  const c = columnOf(dataset, name);
  const base = c ? (lang === "fa" ? c.label.fa : c.label.en) : name;
  return `${base} (${name})`;
}

/* ─────────────── گردش قالب ─────────────── */

export const RB_TEMPLATE_STATUS = ["draft", "published", "retired"] as const;
export type RbTemplateStatus = (typeof RB_TEMPLATE_STATUS)[number];
export const RB_TEMPLATE_FIELDS = ["Code", "TitleFa", "DatasetKey", "Fields", "Filters", "Group", "Sort", "Chart", "Limit", "NoteFa"] as const;

export function templateTransition(action: string, row: Record<string, unknown>, actor: string, at: string): { Status: RbTemplateStatus; Version: number; patch: Record<string, unknown> } {
  const status = String(row.Status ?? "draft") as RbTemplateStatus;
  const version = Number(row.Version ?? 0);
  if (action === "publish") {
    /* SOD-31 در همین موتور اعمال می‌شود تا با هر ترکیب نقش هم قابل دور زدن نباشد؛
     * سرور هم پیش از رسیدن به این‌جا همان قاعده را می‌سنجد. */
    if (row.CreatedBy !== undefined && row.CreatedBy !== null && String(row.CreatedBy) === actor) {
      throw new RbError("E-RPT-SOD", "سازندهٔ قالب نمی‌تواند همان قالب را منتشر کند (SOD-31)");
    }
    if (status === "published") throw new RbError("E-RPT-STATE", "قالب منتشرشده دوباره منتشر نمی‌شود");
    if (status === "retired") throw new RbError("E-RPT-STATE", "قالب بازنشسته منتشر نمی‌شود؛ قالب تازه بسازید");
    return { Status: "published", Version: version + 1, patch: { Status: "published", Version: version + 1, PublishedAt: at, PublishedBy: actor } };
  }
  if (action === "retire") {
    if (status !== "published") throw new RbError("E-RPT-STATE", "فقط قالب منتشرشده بازنشسته می‌شود");
    return { Status: "retired", Version: version, patch: { Status: "retired", RetiredAt: at, RetiredBy: actor } };
  }
  throw new RbError("E-RPT-STATE", `اقدام «${action}» در گردش قالب گزارش وجود ندارد`);
}
