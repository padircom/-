/**
 * CNT — قالب‌پذیری صورت‌وضعیت (P8 / CNT-1) + محاسبهٔ صورت‌وضعیت.
 *
 * قرارداد: قالب شامل «ردیف‌ها» و «کسورات» است و هر کسورات، مبنای فرمول
 * خود را از میان سه حالت صریح انتخاب می‌کند (ناخالص، ماندهٔ جاری، یا یک
 * ردیف مشخص). هیچ عبارت آزادی اجرا نمی‌شود — همهٔ فرمول‌ها قواعد ممیزی‌پذیر
 * و محدودند و محاسبه همیشه سمت سرور از ورودی معتبر انجام می‌شود.
 */

export const CNT_MODEL = "cnt-ipc-v1";

export class CntValidationError extends Error {
  code = "CNT_VALIDATION";
  status = 400;
}

/* ═══════════════════════ ۱. کمکی‌های اعتبارسنجی ═══════════════════════ */

function bad(message: string): never {
  throw new CntValidationError(message);
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
function code(v: unknown, label: string, max = 40, required = true): string {
  const s = text(v, label, max, required);
  if (!s) return "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(s)) bad(`«${label}» فقط حروف/رقم لاتین، نقطه، خط تیره و اسلش`);
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
function list(v: unknown, label: string, min: number, max: number): unknown[] {
  if (!Array.isArray(v)) bad(`«${label}» باید فهرست باشد`);
  if (v.length < min) bad(`«${label}» حداقل ${min} مورد لازم دارد`);
  if (v.length > max) bad(`«${label}» حداکثر ${max} مورد است`);
  return v;
}
export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
export function dateOnly(v: unknown, label: string, opts: { required?: boolean; noFuture?: boolean; now?: Date } = {}): string | null {
  const s = text(v, label, 10, opts.required ?? true);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s + "T00:00:00Z")) || new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s) {
    bad(`«${label}» تاریخ YYYY-MM-DD معتبر نیست`);
  }
  if (opts.noFuture && s > todayIso(opts.now)) bad(`«${label}» نباید در آینده باشد`);
  return s;
}
/** گردکردن پولی؛ نیم‌به‌بالا روی دو رقم اعشار (مبنای ریال/سنت). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ═══════════════════════ ۲. قالب صورت‌وضعیت ═══════════════════════ */

export const IPC_ITEM_BASIS = ["measured", "lump", "percent"] as const;
export const IPC_DEDUCTION_KINDS = ["retention", "advance", "tax", "other"] as const;
export const IPC_DEDUCTION_MODES = ["percent", "fixed"] as const;
export const IPC_DEDUCTION_BASES = ["gross", "running", "item"] as const;
export const IPC_TEMPLATE_STATUS = ["draft", "published", "retired"] as const;

export const BASIS_LABEL: Record<string, { fa: string; en: string }> = {
  measured: { fa: "اندازه‌گیری‌شده (مقدار × نرخ)", en: "Measured (qty × rate)" },
  lump: { fa: "مبلغ مقطوع", en: "Lump sum" },
  percent: { fa: "درصدی از ردیف دیگر", en: "Percent of another row" },
};
export const DEDUCTION_KIND_LABEL: Record<string, { fa: string; en: string }> = {
  retention: { fa: "حسن انجام کار", en: "Retention" },
  advance: { fa: "بازیافت پیش‌پرداخت", en: "Advance recovery" },
  tax: { fa: "مالیات/عوارض", en: "Tax" },
  other: { fa: "سایر کسورات", en: "Other deduction" },
};
export const DEDUCTION_BASE_LABEL: Record<string, { fa: string; en: string }> = {
  gross: { fa: "مبلغ ناخالص", en: "Gross" },
  running: { fa: "ماندهٔ جاری", en: "Running balance" },
  item: { fa: "یک ردیف مشخص", en: "Specific row" },
};
export const IPC_STATUS_LABEL: Record<string, { fa: string; en: string }> = {
  draft: { fa: "پیش‌نویس", en: "Draft" },
  submitted: { fa: "ارسال‌شده", en: "Submitted" },
  approved: { fa: "مصوب", en: "Approved" },
  returned: { fa: "برگشتی", en: "Returned" },
  published: { fa: "منتشرشده", en: "Published" },
  retired: { fa: "بازنشسته", en: "Retired" },
};

export type IpcTemplateItem = { Code: string; TitleFa: string; Unit: string; Basis: string; PercentOf: string | null; Sign: string };
export type IpcDeduction = { Code: string; TitleFa: string; Kind: string; Mode: string; Rate: number; Base: string; ItemCode: string | null };
export type IpcTemplateInput = { Code: string; TitleFa: string; ContractCode: string | null; Items: IpcTemplateItem[]; Deductions: IpcDeduction[]; NoteFa: string | null };

export const IPC_TEMPLATE_FIELDS: readonly string[] = ["Code", "TitleFa", "ContractCode", "Items", "Deductions", "NoteFa"];
export const IPC_ITEM_KEYS: readonly string[] = ["Code", "TitleFa", "Unit", "Basis", "PercentOf", "Sign"];
export const IPC_DEDUCTION_KEYS: readonly string[] = ["Code", "TitleFa", "Kind", "Mode", "Rate", "Base", "ItemCode"];

export function normalizeIpcTemplate(value: unknown): IpcTemplateInput {
  const v = record(value, "قالب صورت‌وضعیت");
  keys(v, IPC_TEMPLATE_FIELDS);
  const items = list(v.Items, "ردیف‌ها", 1, 60).map((i0, i) => {
    const t = record(i0, `ردیف ${i + 1}`);
    keys(t, IPC_ITEM_KEYS);
    const Basis = choice(t.Basis, IPC_ITEM_BASIS, `مبنای ردیف ${i + 1}`);
    const PercentOf = Basis === "percent" ? code(t.PercentOf, `مبنای درصدی ردیف ${i + 1}`, 40) : (code(t.PercentOf, "ردیف مرجع", 40, false) || null);
    if (Basis !== "percent" && PercentOf) bad(`«ردیف مرجع» فقط برای ردیف‌های درصدی معنا دارد (ردیف ${i + 1})`);
    return {
      Code: code(t.Code, `کد ردیف ${i + 1}`, 40),
      TitleFa: text(t.TitleFa, `عنوان ردیف ${i + 1}`, 300),
      Unit: text(t.Unit, `واحد ردیف ${i + 1}`, 20, false) || "—",
      Basis,
      PercentOf,
      Sign: choice(t.Sign, ["+", "-"] as const, `علامت ردیف ${i + 1}`, "+"),
    };
  });
  const itemCodes = items.map((i) => i.Code);
  if (new Set(itemCodes).size !== itemCodes.length) bad("کد ردیف تکراری در قالب");
  for (const it of items) {
    if (it.Basis === "percent") {
      const ref = items.find((x) => x.Code === it.PercentOf);
      if (!ref) bad(`ردیف درصدی «${it.Code}» به ردیف ناموجود «${it.PercentOf}» اشاره می‌کند`);
      if (ref.Basis === "percent") bad(`ردیف «${it.Code}» نمی‌تواند به یک ردیف درصدی دیگر وابسته باشد`);
    }
  }
  const deductions = list(v.Deductions, "کسورات", 0, 20).map((d0, i) => {
    const d = record(d0, `کسورات ${i + 1}`);
    keys(d, IPC_DEDUCTION_KEYS);
    const Mode = choice(d.Mode, IPC_DEDUCTION_MODES, `نوع کسر ${i + 1}`);
    const Base = choice(d.Base, IPC_DEDUCTION_BASES, `مبنای کسر ${i + 1}`);
    const ItemCode = Base === "item" ? code(d.ItemCode, `ردیف مبنای کسر ${i + 1}`, 40) : (code(d.ItemCode, "ردیف مبنا", 40, false) || null);
    if (Base === "item" && !itemCodes.includes(ItemCode as string)) bad(`کسر «${d.Code ?? i + 1}» به ردیف ناموجود اشاره می‌کند`);
    if (Base !== "item" && ItemCode) bad(`«ردیف مبنا» فقط برای مبنای «یک ردیف مشخص» معنا دارد`);
    const Rate = Mode === "percent"
      ? (num(d.Rate, `نرخ کسر ${i + 1}`, 0, 100) as number)
      : (num(d.Rate, `مبلغ کسر ${i + 1}`, 0, 1e15) as number);
    return {
      Code: code(d.Code, `کد کسر ${i + 1}`, 40),
      TitleFa: text(d.TitleFa, `عنوان کسر ${i + 1}`, 200),
      Kind: choice(d.Kind, IPC_DEDUCTION_KINDS, `نوع کسر ${i + 1}`, "other"),
      Mode,
      Rate,
      Base,
      ItemCode,
    };
  });
  const dedCodes = deductions.map((d) => d.Code);
  if (new Set(dedCodes).size !== dedCodes.length) bad("کد کسر تکراری در قالب");
  if (deductions.filter((d) => d.Kind === "retention").length > 1) bad("فقط یک کسر «حسن انجام کار» مجاز است");
  if (deductions.filter((d) => d.Kind === "advance").length > 1) bad("فقط یک کسر «بازیافت پیش‌پرداخت» مجاز است");
  return {
    Code: code(v.Code, "کد قالب", 40),
    TitleFa: text(v.TitleFa, "عنوان قالب", 200),
    ContractCode: code(v.ContractCode, "کد پیمان", 60, false) || null,
    Items: items,
    Deductions: deductions,
    NoteFa: text(v.NoteFa, "یادداشت", 1000, false) || null,
  };
}

/* ═══════════════════════ ۳. محاسبهٔ صورت‌وضعیت ═══════════════════════ */

export type IpcRowInput = { ItemCode: string; Quantity: number | null; UnitRate: number | null; Amount: number | null; Percent: number | null };
export type IpcComputedRow = { Code: string; TitleFa: string; Unit: string; Basis: string; Sign: string; Quantity: number | null; UnitRate: number | null; Amount: number };
export type IpcComputedDeduction = { Code: string; TitleFa: string; Kind: string; Mode: string; Base: string; Rate: number; BaseAmount: number; Amount: number };
export type IpcComputation = {
  rows: IpcComputedRow[];
  deductions: IpcComputedDeduction[];
  grossAmount: number;
  deductionTotal: number;
  netAmount: number;
  flags: { negativeNet: boolean; noRows: boolean };
  modelVersion: string;
};

export function normalizeIpcInputs(value: unknown): IpcRowInput[] {
  return list(value, "ردیف‌های صورت‌وضعیت", 0, 60).map((r0, i) => {
    const r = record(r0, `ردیف ${i + 1}`);
    keys(r, ["ItemCode", "Quantity", "UnitRate", "Amount", "Percent"]);
    return {
      ItemCode: code(r.ItemCode, `کد ردیف ${i + 1}`, 40),
      Quantity: num(r.Quantity, `مقدار ردیف ${i + 1}`, 0, 1e12, { nullable: true }),
      UnitRate: num(r.UnitRate, `نرخ ردیف ${i + 1}`, 0, 1e15, { nullable: true }),
      Amount: num(r.Amount, `مبلغ ردیف ${i + 1}`, 0, 1e15, { nullable: true }),
      Percent: num(r.Percent, `درصد ردیف ${i + 1}`, 0, 100, { nullable: true }),
    };
  });
}

/**
 * محاسبهٔ کامل: هر ردیف بر پایهٔ نوع خودش، سپس کسورات به ترتیب قالب.
 * «ماندهٔ جاری» = ناخالص منهای کسوراتِ قبلی؛ «ردیف مشخص» = مبلغ همان ردیف.
 */
export function computeIpc(template: { Items: IpcTemplateItem[]; Deductions: IpcDeduction[] }, inputs: IpcRowInput[]): IpcComputation {
  const byCode = new Map(inputs.map((r) => [r.ItemCode, r]));
  if (byCode.size !== inputs.length) bad("ردیف تکراری در ورودی صورت‌وضعیت");
  const known = new Set(template.Items.map((i) => i.Code));
  for (const r of inputs) if (!known.has(r.ItemCode)) bad(`ردیف «${r.ItemCode}» در قالب نیست`);

  const amounts = new Map<string, number>();
  const rows: IpcComputedRow[] = [];
  const build = (item: IpcTemplateItem, kind: "plain" | "percent") => {
    const input = byCode.get(item.Code);
    if (kind === "percent") {
      if (!input?.Percent) return; // ردیف درصدی بدون ورودی، صفر است و در فهرست نمی‌آید
      const base = amounts.get(item.PercentOf as string) ?? 0;
      const amount = round2((base * input.Percent) / 100);
      amounts.set(item.Code, amount);
      rows.push({ Code: item.Code, TitleFa: item.TitleFa, Unit: item.Unit, Basis: item.Basis, Sign: item.Sign, Quantity: null, UnitRate: null, Amount: andSign(item.Sign, amount) });
      return;
    }
    if (!input) return;
    let amount: number | null = null;
    if (item.Basis === "measured") {
      if (input.Quantity === null || input.UnitRate === null) bad(`ردیف اندازه‌گیری‌شدهٔ «${item.Code}» به مقدار و نرخ نیاز دارد`);
      amount = round2(input.Quantity * input.UnitRate);
    } else if (item.Basis === "lump") {
      if (input.Amount === null) bad(`ردیف مقطوع «${item.Code}» به مبلغ نیاز دارد`);
      amount = round2(input.Amount);
    }
    if (amount === null) return;
    amounts.set(item.Code, amount);
    rows.push({
      Code: item.Code, TitleFa: item.TitleFa, Unit: item.Unit, Basis: item.Basis, Sign: item.Sign,
      Quantity: input.Quantity, UnitRate: input.UnitRate, Amount: andSign(item.Sign, amount),
    });
  };
  /* دو گذر: ابتدا ردیف‌های غیردرصدی، سپس درصدی‌ها که به مبلغ همان‌ها وابسته‌اند. */
  for (const item of template.Items) if (item.Basis !== "percent") build(item, "plain");
  for (const item of template.Items) if (item.Basis === "percent") build(item, "percent");

  const grossAmount = round2(rows.reduce((s, r) => s + r.Amount, 0));
  const deductions: IpcComputedDeduction[] = [];
  let running = grossAmount;
  for (const d of template.Deductions) {
    const baseAmount = d.Base === "gross" ? grossAmount : d.Base === "running" ? running : (amounts.get(d.ItemCode as string) ?? 0);
    const amount = d.Mode === "percent" ? round2((baseAmount * d.Rate) / 100) : round2(d.Rate);
    deductions.push({ Code: d.Code, TitleFa: d.TitleFa, Kind: d.Kind, Mode: d.Mode, Base: d.Base, Rate: d.Rate, BaseAmount: round2(baseAmount), Amount: amount });
    running = round2(running - amount);
  }
  const deductionTotal = round2(deductions.reduce((s, d) => s + d.Amount, 0));
  const netAmount = round2(grossAmount - deductionTotal);
  return {
    rows,
    deductions,
    grossAmount,
    deductionTotal,
    netAmount,
    flags: { negativeNet: netAmount < 0, noRows: rows.length === 0 },
    modelVersion: CNT_MODEL,
  };
}

function andSign(sign: string, amount: number): number {
  return sign === "-" ? round2(-amount) : amount;
}

export function ipcTransition(
  action: string,
  row: { Status: string; CreatedBy?: string | null },
  actor: string,
  note: string | null,
  now = new Date().toISOString(),
): { Status: string; patch: Record<string, unknown> } {
  const a = choice(action, ["submit", "approve", "return"] as const, "اقدام");
  if (row.Status === "approved") bad("صورت‌وضعیت مصوب قفل است");
  if (a === "submit") {
    if (row.Status !== "draft" && row.Status !== "returned") bad("فقط پیش‌نویس یا برگشتی ارسال می‌شود");
    return { Status: "submitted", patch: { Status: "submitted", SubmittedAt: now, SubmittedBy: actor } };
  }
  if (row.Status !== "submitted") bad("فقط صورت‌وضعیت ارسال‌شده تأیید یا برگشت می‌شود");
  if (row.CreatedBy && row.CreatedBy === actor) bad("تهیه‌کننده نمی‌تواند صورت‌وضعیت خود را تأیید یا برگشت کند");
  if (a === "approve") return { Status: "approved", patch: { Status: "approved", ApprovedAt: now, ApprovedBy: actor, SignedNoteFa: note ?? null } };
  const reason = text(note, "دلیل برگشت", 500);
  return { Status: "returned", patch: { Status: "returned", ReturnedAt: now, ReturnedBy: actor, ReturnNoteFa: reason } };
}

export function templateTransition(action: string, row: { Status: string; Version?: number | null }, actor: string, now = new Date().toISOString()) {
  const a = choice(action, ["publish", "retire"] as const, "اقدام");
  if (a === "publish") {
    if (row.Status !== "draft") bad("فقط قالب پیش‌نویس منتشر می‌شود");
    /* نسخهٔ قالب در لحظهٔ انتشار قطعی می‌شود؛ سند مصوب باید بداند با کدام
       نسخه محاسبه شده تا تغییر قالب، سند قدیمی را کهنه کند. */
    const version = Math.max(0, Number(row.Version ?? 0)) + 1;
    return { Status: "published", version, patch: { Status: "published", Version: version, PublishedAt: now, PublishedBy: actor } };
  }
  if (row.Status !== "published") bad("فقط قالب منتشرشده بازنشسته می‌شود");
  return { Status: "retired", patch: { Status: "retired", RetiredAt: now, RetiredBy: actor } };
}

export function cntIpcMetrics(input: {
  templates: { Status: string }[];
  certificates: { Status: string; PeriodNo?: number | null; NetAmount?: number | null; Currency?: string | null }[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const approved = input.certificates.filter((c) => c.Status === "approved");
  const periods = input.certificates.map((c) => Number(c.PeriodNo)).filter((n) => Number.isInteger(n) && n > 0);
  const currencies = [...new Set(input.certificates.map((c) => String(c.Currency ?? "IRR")))];
  return {
    templates: {
      total: input.templates.length,
      published: input.templates.filter((t) => t.Status === "published").length,
      retired: input.templates.filter((t) => t.Status === "retired").length,
    },
    certificates: {
      total: input.certificates.length,
      draft: input.certificates.filter((c) => c.Status === "draft").length,
      pending: input.certificates.filter((c) => c.Status === "submitted").length,
      approved: approved.length,
      returned: input.certificates.filter((c) => c.Status === "returned").length,
      latestPeriod: periods.length ? Math.max(...periods) : null,
      approvedNet: currencies.length === 1
        ? round2(approved.reduce((s, c) => s + (Number(c.NetAmount) || 0), 0))
        : null,
      currency: currencies.length === 1 ? currencies[0] : null,
    },
    generatedAt: now.toISOString(),
    modelVersion: CNT_MODEL,
  };
}

/* ═══════════════════════ ۴. شکل دادهٔ میز کار ═══════════════════════ */

export type CntRowMeta = {
  Id: string;
  ProjectId: string;
  RowVersion: number;
  ModelVersion?: string | null;
  CreatedAt?: string;
  CreatedBy?: string;
  UpdatedAt?: string;
  UpdatedBy?: string;
};
export type CntTemplateRow = IpcTemplateInput & CntRowMeta & {
  Status: string;
  /** نسخهٔ قالب؛ با هر انتشار یکی بالا می‌رود و مبنای محاسبهٔ سندهای بعدی است. */
  Version: number;
  PublishedAt?: string | null; PublishedBy?: string | null;
  RetiredAt?: string | null; RetiredBy?: string | null;
};
export type CntCertificateRow = CntRowMeta & {
  TemplateCode: string; ContractCode: string | null;
  /** نسخهٔ قالبی که سند با آن محاسبه شده — مرجع کهنگی‌سنجی. */
  TemplateVersion: number;
  PeriodNo: number; PeriodFrom: string; PeriodTo: string;
  Currency: string;
  Inputs: IpcRowInput[];
  Computation: IpcComputation | null;
  GrossAmount: number | null; DeductionTotal: number | null; NetAmount: number | null;
  Status: string; NoteFa?: string | null;
  SubmittedAt?: string | null; SubmittedBy?: string | null;
  ApprovedAt?: string | null; ApprovedBy?: string | null; SignedNoteFa?: string | null;
  ReturnedAt?: string | null; ReturnedBy?: string | null; ReturnNoteFa?: string | null;
};
export type CntCan = { templateEdit: boolean; certificateRecord: boolean; certificateApprove: boolean };
export type CntWorkspacePayload = {
  projectId: string;
  can: CntCan;
  templates: CntTemplateRow[];
  certificates: CntCertificateRow[];
  metrics: ReturnType<typeof cntIpcMetrics>;
  generatedAt: string;
  modelVersion: string;
};
