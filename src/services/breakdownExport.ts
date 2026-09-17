/**
 * خروجی و ورودی ساختار شکست — اکسل دوطرفه، XER (P6) و XML (MSP).
 *
 * سه تصمیم که کل این فایل بر آن‌ها استوار است:
 *
 * ۱. **اکسل باید رفت‌وبرگشتی باشد.** اگر فقط خروجی بدهیم، کاربر در
 *    اکسل کار می‌کند و برنامه از حقیقت عقب می‌افتد — همان چیزی که
 *    کارفرما گفت: «Excel ظرف است نه Source of Truth». پس هر ردیف
 *    خروجی شناسهٔ خودش را حمل می‌کند و همان فایل قابل بازخوانی است.
 *
 * ۲. **`.mpp` ساخته نمی‌شود.** نوشتن فرمت بومی MSP بدون کتابخانهٔ
 *    MPXJ ممکن نیست. ولی MS Project XML یک طرح باز است و MSP بومی
 *    بازش می‌کند؛ P6 هم XER را مستقیم می‌خورد. پس هر دو مقصد بدون
 *    هیچ سرویس بیرونی پوشش داده می‌شوند.
 *
 * ۳. **این فایل داده تولید نمی‌کند.** فقط شکل می‌دهد. هر عددی که
 *    بیرون می‌رود باید از موتور وزن آمده باشد، وگرنه دو منبع حقیقت
 *    می‌شود و گزارش با صورت‌وضعیت نمی‌خواند.
 */

import { roundMoney, roundPct } from "./lumpSumWeights";
import type { WeightBasis } from "./lumpSumWeights";

export const EXPORT_VERSION = "bex-v1";

/* ══════════════════════════ نوع‌ها ══════════════════════════ */

export type BreakdownView = "wbs" | "cbs" | "wpa" | "pms";

export type ExportNode = {
  id?: string | null;
  code: string;
  parentCode?: string | null;
  titleFa: string;
  titleEn?: string | null;
  depth: number;
  unit?: string | null;
  qty?: number | null;
  /** WF — درصد نسبت به والد. */
  weightFactor?: number | null;
  /** WV — درصد نسبت به کل پروژه. */
  weightValue?: number | null;
  amount?: number | null;
  costAccountCode?: string | null;
  basis?: WeightBasis | null;
  sourceRefFa?: string | null;
  plannedPct?: number | null;
  actualPct?: number | null;
  /** ستون‌های دلخواه نمای PMS. */
  custom?: Record<string, string | number | null>;
};

export type CustomColumn = {
  key: string;
  titleFa: string;
  titleEn?: string | null;
  dataKind: "text" | "number" | "percent" | "date";
};

/* ══════════════════════════ سربرگ سازمانی ══════════════════════════ */

export type Letterhead = {
  projectCode: string;
  projectTitleFa: string;
  contractNo?: string | null;
  contractType?: string | null;
  contractAmount?: number | null;
  currency?: string | null;
  dataDate: string;
  revision?: string | null;
  preparedBy?: string | null;
};

/**
 * سطرهای سربرگ که پیش از جدول می‌آیند.
 *
 * شکل سربرگ عمداً همان چیزی است که در گزارش‌های رسمی D11 استفاده شد.
 * دو شکل متفاوت برای یک سازمان یعنی دو هویت.
 */
export function letterheadRows(lh: Letterhead): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [
    ["پروژه", lh.projectTitleFa, null, "کد پروژه", lh.projectCode],
  ];
  if (lh.contractNo || lh.contractType) {
    rows.push(["شماره قرارداد", lh.contractNo ?? "—", null, "نوع قرارداد", lh.contractType ?? "—"]);
  }
  if (lh.contractAmount !== null && lh.contractAmount !== undefined) {
    rows.push(["مبلغ قرارداد", lh.contractAmount, lh.currency ?? "", "تاریخ داده", lh.dataDate]);
  } else {
    rows.push(["تاریخ داده", lh.dataDate, null, null, null]);
  }
  rows.push(["ویرایش", lh.revision ?? "۰", null, "تهیه‌کننده", lh.preparedBy ?? "—"]);
  rows.push([]);
  return rows;
}

/* ══════════════════════════ ستون‌های ثابت ══════════════════════════ */

/**
 * ستون‌های ثابت هر نما.
 *
 * `id` نخستین ستون است چون بازخوانی به آن تکیه می‌کند. اگر کاربر آن
 * را پاک کند، ردیف به‌عنوان «تازه» خوانده می‌شود نه «ویرایش‌شده» —
 * و آن تفاوت در گزارش مغایرت صریح اعلام می‌شود.
 */
export type ColumnSpec = { key: string; titleFa: string; titleEn: string; kind: "text" | "number" | "percent" | "money" };

const COMMON: ColumnSpec[] = [
  { key: "id", titleFa: "شناسه", titleEn: "Id", kind: "text" },
  { key: "code", titleFa: "کد", titleEn: "Code", kind: "text" },
  { key: "parentCode", titleFa: "کد والد", titleEn: "Parent", kind: "text" },
  { key: "depth", titleFa: "سطح", titleEn: "Level", kind: "number" },
  { key: "titleFa", titleFa: "شرح", titleEn: "Description", kind: "text" },
];

export function columnsFor(view: BreakdownView, custom: CustomColumn[] = []): ColumnSpec[] {
  const cols = [...COMMON];

  if (view === "cbs") {
    cols.push(
      { key: "costAccountCode", titleFa: "حساب هزینه", titleEn: "Cost account", kind: "text" },
      { key: "weightValue", titleFa: "وزن کل (WV%)", titleEn: "WV%", kind: "percent" },
      { key: "amount", titleFa: "مبلغ", titleEn: "Amount", kind: "money" },
    );
    return cols;
  }

  if (view === "wpa") {
    /* نمای لامپ‌سام: مبنای صورت‌وضعیت درصدی. مقدار و واحد اینجا
     * معنا ندارد چون قرارداد ردیف متره‌ای ندارد. */
    cols.push(
      { key: "weightFactor", titleFa: "وزن نسبی (WF%)", titleEn: "WF%", kind: "percent" },
      { key: "weightValue", titleFa: "وزن کل (WV%)", titleEn: "WV%", kind: "percent" },
      { key: "amount", titleFa: "مبلغ", titleEn: "Amount", kind: "money" },
      { key: "actualPct", titleFa: "پیشرفت واقعی", titleEn: "Actual %", kind: "percent" },
      { key: "basis", titleFa: "مبنای وزن", titleEn: "Basis", kind: "text" },
      { key: "sourceRefFa", titleFa: "مرجع", titleEn: "Source", kind: "text" },
    );
    return cols;
  }

  if (view === "pms") {
    cols.push(
      { key: "unit", titleFa: "واحد", titleEn: "Unit", kind: "text" },
      { key: "qty", titleFa: "مقدار", titleEn: "Qty", kind: "number" },
      { key: "weightFactor", titleFa: "WF%", titleEn: "WF%", kind: "percent" },
      { key: "weightValue", titleFa: "WV%", titleEn: "WV%", kind: "percent" },
      { key: "amount", titleFa: "مبلغ", titleEn: "Amount", kind: "money" },
      { key: "plannedPct", titleFa: "پیشرفت برنامه‌ای", titleEn: "Planned %", kind: "percent" },
      { key: "actualPct", titleFa: "پیشرفت واقعی", titleEn: "Actual %", kind: "percent" },
      { key: "variancePct", titleFa: "انحراف", titleEn: "Variance", kind: "percent" },
    );
    /* ستون‌های دلخواه پس از ثابت‌ها می‌آیند تا جای ستون‌های ثابت با
     * افزودن ستون تازه جابه‌جا نشود — وگرنه قالب ذخیره‌شدهٔ کاربر
     * می‌شکند. */
    for (const c of custom) {
      cols.push({ key: `x:${c.key}`, titleFa: c.titleFa, titleEn: c.titleEn ?? c.key, kind: c.dataKind === "date" ? "text" : c.dataKind });
    }
    return cols;
  }

  /* wbs */
  cols.push(
    { key: "unit", titleFa: "واحد", titleEn: "Unit", kind: "text" },
    { key: "qty", titleFa: "مقدار", titleEn: "Qty", kind: "number" },
    { key: "weightFactor", titleFa: "WF%", titleEn: "WF%", kind: "percent" },
    { key: "weightValue", titleFa: "WV%", titleEn: "WV%", kind: "percent" },
    { key: "sourceRefFa", titleFa: "مرجع", titleEn: "Source", kind: "text" },
  );
  return cols;
}

/* ══════════════════════════ ساخت سطر ══════════════════════════ */

/** انحراف = واقعی − برنامه‌ای. `null` وقتی یکی از دو طرف نباشد. */
export function variancePct(node: ExportNode): number | null {
  if (node.actualPct === null || node.actualPct === undefined) return null;
  if (node.plannedPct === null || node.plannedPct === undefined) return null;
  return roundPct(node.actualPct - node.plannedPct);
}

function cellOf(node: ExportNode, col: ColumnSpec): string | number | null {
  if (col.key.startsWith("x:")) {
    const k = col.key.slice(2);
    return node.custom?.[k] ?? null;
  }
  if (col.key === "variancePct") return variancePct(node);

  const v = (node as unknown as Record<string, unknown>)[col.key];
  if (v === undefined) return null;
  if (v === null) return null;
  if (col.kind === "money" && typeof v === "number") return roundMoney(v);
  if (col.kind === "percent" && typeof v === "number") return roundPct(v);
  return v as string | number;
}

export type SheetData = {
  name: string;
  rows: (string | number | null)[][];
  /** شمارهٔ سطری که سرستون‌ها در آن نشسته‌اند — بازخوانی به آن نیاز دارد. */
  headerRowIndex: number;
};

/**
 * ساخت یک برگهٔ اکسل.
 *
 * سرستون فارسی است ولی کلید ماشینی در سطر پنهان زیر آن می‌آید. بدون
 * آن، بازخوانی باید عنوان فارسی را حدس بزند و هر تغییر نگارشی —
 * حتی یک نیم‌فاصله — واردات را می‌شکند.
 */
export function buildSheet(
  view: BreakdownView,
  nodes: ExportNode[],
  lh: Letterhead,
  custom: CustomColumn[] = [],
  lang: "fa" | "en" = "fa",
): SheetData {
  const cols = columnsFor(view, custom);
  const rows: (string | number | null)[][] = [...letterheadRows(lh)];

  rows.push(cols.map((c) => (lang === "fa" ? c.titleFa : c.titleEn)));
  const headerRowIndex = rows.length - 1;
  rows.push(cols.map((c) => `#${c.key}`));

  for (const n of nodes) rows.push(cols.map((c) => cellOf(n, c)));

  return { name: view.toUpperCase(), rows, headerRowIndex };
}

/* ══════════════════════════ بازخوانی ══════════════════════════ */

export type ImportIssue = {
  rowNo: number;
  code?: string | null;
  severity: "error" | "warning";
  messageFa: string;
};

export type ImportResult = {
  nodes: ExportNode[];
  issues: ImportIssue[];
  /** ردیف‌هایی که شناسه داشتند — یعنی ویرایش، نه ایجاد. */
  updatedCount: number;
  createdCount: number;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,٬]/g, "").replace("%", ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * خواندن برگه‌ای که از همین موتور بیرون رفته و کاربر ویرایشش کرده.
 *
 * سطر کلید (`#code`) مرجع است نه عنوان فارسی. اگر کاربر آن سطر را
 * پاک کرده باشد، کار متوقف می‌شود با پیام صریح — حدس زدن نگاشت ستون
 * یعنی نوشتن عدد در ستون اشتباه.
 */
export function parseSheet(rows: (string | number | null)[][]): ImportResult {
  const issues: ImportIssue[] = [];

  const keyRowIndex = rows.findIndex((r) => r.some((c) => typeof c === "string" && c.startsWith("#code")));
  if (keyRowIndex === -1) {
    return {
      nodes: [],
      issues: [{ rowNo: 0, severity: "error", messageFa: "سطر کلید ستون‌ها (#code) پیدا نشد. فایل باید از همین سامانه خروجی گرفته شده باشد." }],
      updatedCount: 0,
      createdCount: 0,
    };
  }

  const keys = rows[keyRowIndex].map((c) => (typeof c === "string" && c.startsWith("#") ? c.slice(1) : ""));
  const nodes: ExportNode[] = [];
  const seen = new Set<string>();
  let updatedCount = 0;
  let createdCount = 0;

  for (let i = keyRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === undefined || c === "")) continue;

    const get = (k: string) => {
      const at = keys.indexOf(k);
      return at === -1 ? null : row[at] ?? null;
    };

    const code = String(get("code") ?? "").trim();
    if (!code) {
      issues.push({ rowNo: i + 1, severity: "error", messageFa: "ردیف بدون کد نادیده گرفته شد." });
      continue;
    }
    if (seen.has(code)) {
      /* کد تکراری یعنی دو ردیف سر یک گره دعوا دارند؛ کدام درست است
       * قابل تشخیص نیست، پس هر دو باید دیده شوند. */
      issues.push({ rowNo: i + 1, code, severity: "error", messageFa: `کد «${code}» تکراری است.` });
      continue;
    }
    seen.add(code);

    const id = get("id");
    if (id) updatedCount += 1;
    else createdCount += 1;

    const custom: Record<string, string | number | null> = {};
    keys.forEach((k, at) => {
      if (k.startsWith("x:")) custom[k.slice(2)] = row[at] ?? null;
    });

    const wf = num(get("weightFactor"));
    if (wf !== null && (wf < 0 || wf > 100)) {
      issues.push({ rowNo: i + 1, code, severity: "error", messageFa: `وزن نسبی ${wf} خارج از بازهٔ ۰ تا ۱۰۰ است.` });
    }

    const actual = num(get("actualPct"));
    if (actual !== null && (actual < 0 || actual > 100)) {
      issues.push({ rowNo: i + 1, code, severity: "warning", messageFa: `پیشرفت ${actual} مهار شد.` });
    }

    nodes.push({
      id: id ? String(id) : null,
      code,
      parentCode: get("parentCode") ? String(get("parentCode")) : null,
      titleFa: String(get("titleFa") ?? ""),
      depth: num(get("depth")) ?? 1,
      unit: get("unit") ? String(get("unit")) : null,
      qty: num(get("qty")),
      weightFactor: wf,
      weightValue: num(get("weightValue")),
      amount: num(get("amount")),
      costAccountCode: get("costAccountCode") ? String(get("costAccountCode")) : null,
      plannedPct: num(get("plannedPct")),
      actualPct: actual === null ? null : Math.min(100, Math.max(0, actual)),
      sourceRefFa: get("sourceRefFa") ? String(get("sourceRefFa")) : null,
      custom: Object.keys(custom).length ? custom : undefined,
    });
  }

  /* والد ناموجود: درخت را می‌شکند و باید پیش از ذخیره دیده شود. */
  const codes = new Set(nodes.map((n) => n.code));
  for (const n of nodes) {
    if (n.parentCode && !codes.has(n.parentCode)) {
      issues.push({ rowNo: 0, code: n.code, severity: "error", messageFa: `والد «${n.parentCode}» در فایل نیست.` });
    }
  }

  return { nodes, issues, updatedCount, createdCount };
}

/* ══════════════════════════ گزارش مغایرت ══════════════════════════ */

export type DiffRow = {
  code: string;
  field: string;
  before: string | number | null;
  after: string | number | null;
};

/**
 * مقایسهٔ فایل بازخوانی‌شده با وضعیت فعلی.
 *
 * بدون این، کاربر فایل را وارد می‌کند و نمی‌داند چه چیزی عوض شد.
 * در قراردادی با مبلغ صدها میلیون، یک وزن جابه‌جا شده باید دیده شود
 * پیش از آنکه ذخیره شود.
 */
export function diffNodes(current: ExportNode[], incoming: ExportNode[]): {
  changed: DiffRow[];
  added: string[];
  removed: string[];
} {
  const byCode = new Map(current.map((n) => [n.code, n]));
  const inCodes = new Set(incoming.map((n) => n.code));
  const changed: DiffRow[] = [];
  const added: string[] = [];

  const WATCH: (keyof ExportNode)[] = ["titleFa", "parentCode", "unit", "qty", "weightFactor", "weightValue", "amount", "costAccountCode", "plannedPct", "actualPct"];

  for (const n of incoming) {
    const old = byCode.get(n.code);
    if (!old) {
      added.push(n.code);
      continue;
    }
    for (const f of WATCH) {
      const a = old[f] ?? null;
      const b = n[f] ?? null;
      if (a === null && b === null) continue;
      if (String(a) !== String(b)) changed.push({ code: n.code, field: String(f), before: a as never, after: b as never });
    }
  }

  const removed = current.filter((n) => !inCodes.has(n.code)).map((n) => n.code);
  return { changed, added, removed };
}

/* ══════════════════════════ XER برای P6 ══════════════════════════ */

const xerEscape = (v: unknown): string => String(v ?? "").replace(/[\t\r\n]/g, " ");

/**
 * تولید XER که Primavera P6 می‌خواند.
 *
 * XER یک قالب جدولی جداشده با tab است: هر جدول با `%T` آغاز می‌شود،
 * سرستون با `%F` و هر سطر با `%R`. ساختار شکست در جدول `PROJWBS`
 * می‌نشیند.
 *
 * محدودیت صریح: این خروجی فقط **ساختار** را می‌برد. تقویم، روابط و
 * منابع در آن نیست، چون ساختار شکست آن‌ها را ندارد. وانمود کردن به
 * اینکه یک برنامهٔ کامل تولید شده، بدتر از ندادن است.
 */
export function buildXer(nodes: ExportNode[], lh: Letterhead): string {
  const stamp = lh.dataDate.replace(/-/g, "");
  const lines: string[] = [];

  lines.push(["ERMHDR", "19.12", stamp, "Project", "PMIS", "PMIS Export", "USD"].join("\t"));

  lines.push("%T\tPROJWBS");
  lines.push(["%F", "wbs_id", "proj_id", "parent_wbs_id", "seq_num", "wbs_short_name", "wbs_name", "proj_node_flag", "status_code"].join("\t"));

  /* شناسهٔ عددی لازم است چون P6 کد متنی را کلید نمی‌پذیرد. نگاشت
   * پایدار است تا واردات دوباره گره‌ها را جابه‌جا نکند. */
  const idOf = new Map<string, number>();
  nodes.forEach((n, i) => idOf.set(n.code, 1000 + i));

  const root = 999;
  lines.push(["%R", String(root), "1", "", "0", lh.projectCode, lh.projectTitleFa, "Y", "WS_Open"].join("\t"));

  nodes.forEach((n, i) => {
    const parent = n.parentCode ? idOf.get(n.parentCode) ?? root : root;
    lines.push([
      "%R",
      String(idOf.get(n.code)),
      "1",
      String(parent),
      String(i + 1),
      xerEscape(n.code),
      xerEscape(n.titleFa),
      "N",
      "WS_Open",
    ].join("\t"));
  });

  lines.push("%E");
  return lines.join("\n");
}

/* ══════════════════════════ XML برای MS Project ══════════════════════════ */

const xmlEscape = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * تولید MS Project XML.
 *
 * چرا XML و نه MPP: نوشتن فرمت بومی MSP بدون MPXJ ممکن نیست، ولی این
 * طرح باز است و MSP بومی بازش می‌کند. نتیجه از دید کاربر یکی است.
 *
 * `OutlineLevel` سلسله‌مراتب را می‌سازد و MSP از روی همان تورفتگی را
 * می‌کشد. ترتیب سطرها باید پیمایش عمق‌اول باشد وگرنه درخت به‌هم
 * می‌ریزد — پس اینجا مرتب می‌شود، نه اینکه به فراخواننده سپرده شود.
 */
export function buildMspXml(nodes: ExportNode[], lh: Letterhead): string {
  const ordered = depthFirst(nodes);
  const parts: string[] = [];

  parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  parts.push('<Project xmlns="http://schemas.microsoft.com/project">');
  parts.push(`  <Name>${xmlEscape(lh.projectCode)}</Name>`);
  parts.push(`  <Title>${xmlEscape(lh.projectTitleFa)}</Title>`);
  parts.push(`  <StatusDate>${xmlEscape(lh.dataDate)}T00:00:00</StatusDate>`);
  parts.push("  <Tasks>");

  ordered.forEach((n, i) => {
    parts.push("    <Task>");
    parts.push(`      <UID>${i + 1}</UID>`);
    parts.push(`      <ID>${i + 1}</ID>`);
    parts.push(`      <Name>${xmlEscape(n.titleFa)}</Name>`);
    parts.push(`      <OutlineLevel>${Math.max(1, n.depth)}</OutlineLevel>`);
    parts.push(`      <WBS>${xmlEscape(n.code)}</WBS>`);
    /* درصد پیشرفت فقط وقتی نوشته می‌شود که واقعاً وجود دارد؛ صفرِ
     * ساختگی یعنی ادعای «شروع نشده» برای کاری که ممکن است تمام باشد. */
    if (n.actualPct !== null && n.actualPct !== undefined) {
      parts.push(`      <PercentComplete>${Math.round(n.actualPct)}</PercentComplete>`);
    }
    parts.push(`      <Summary>${hasChildren(nodes, n.code) ? 1 : 0}</Summary>`);
    parts.push("    </Task>");
  });

  parts.push("  </Tasks>");
  parts.push("</Project>");
  return parts.join("\n");
}

function hasChildren(nodes: ExportNode[], code: string): boolean {
  return nodes.some((n) => n.parentCode === code);
}

/**
 * مرتب‌سازی عمق‌اول.
 *
 * هم XER و هم XML به ترتیب درست وابسته‌اند: در XML تورفتگی از ترتیب
 * سطرها به‌علاوهٔ `OutlineLevel` ساخته می‌شود، پس یک فرزند که پیش از
 * والدش بیاید کل درخت را می‌شکند.
 */
export function depthFirst(nodes: ExportNode[]): ExportNode[] {
  const childrenOf = new Map<string, ExportNode[]>();
  const roots: ExportNode[] = [];
  const codes = new Set(nodes.map((n) => n.code));

  for (const n of nodes) {
    if (n.parentCode && codes.has(n.parentCode)) {
      const list = childrenOf.get(n.parentCode) ?? [];
      list.push(n);
      childrenOf.set(n.parentCode, list);
    } else {
      roots.push(n);
    }
  }

  const out: ExportNode[] = [];
  const guard = new Set<string>();
  const walk = (n: ExportNode) => {
    if (guard.has(n.code)) return;
    guard.add(n.code);
    out.push(n);
    for (const c of childrenOf.get(n.code) ?? []) walk(c);
  };
  roots.forEach(walk);

  /* گره‌هایی که به‌خاطر حلقه جا ماندند نباید بی‌صدا حذف شوند. */
  for (const n of nodes) if (!guard.has(n.code)) out.push(n);
  return out;
}

/* ══════════════════════════ نام فایل ══════════════════════════ */

/** نام فایل خروجی: قابل مرتب‌سازی، بدون نویسهٔ ممنوع ویندوز. */
export function exportFileName(lh: Letterhead, view: BreakdownView, ext: string): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim();
  const rev = lh.revision ? `-R${safe(lh.revision)}` : "";
  return `${safe(lh.projectCode)}-${view.toUpperCase()}-${lh.dataDate}${rev}.${ext}`;
}
