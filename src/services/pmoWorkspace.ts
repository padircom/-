/**
 * PMO — دفتر مدیریت پروژه (P8 / PMO-1، PMO-2، PMO-3).
 *
 * موتور مشترک مرورگر و سرور؛ هیچ عدد یا رکوردی این‌جا ساخته نمی‌شود و همهٔ
 * مقادیر محاسبه‌شده (امتیاز کارت سلامت، نسخهٔ فرم، وضعیت گردش) سمت سرور
 * از ورودی معتبر به دست می‌آیند. قواعد امنیتی و پروژه‌ای در سرور اعمال می‌شود.
 */

export const PMO_MODEL = "pmo-gov-v1";

export class PmoValidationError extends Error {
  code = "PMO_VALIDATION";
  status = 400;
}

/* ═══════════════════════ ۱. کمکی‌های اعتبارسنجی ═══════════════════════ */

function bad(message: string): never {
  throw new PmoValidationError(message);
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
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ═══════════════════════ ۲. PMO-1 منشور پروژه ═══════════════════════ */

export const CHARTER_STATUS = ["draft", "submitted", "approved", "returned", "superseded"] as const;
export const CHARTER_ACTIONS = ["submit", "approve", "return"] as const;
export const CURRENCIES = ["IRR", "EUR", "USD", "AED"] as const;
export const RISK_SEVERITY = ["low", "medium", "high"] as const;

export const CHARTER_STATUS_LABEL: Record<string, { fa: string; en: string }> = {
  draft: { fa: "پیش‌نویس", en: "Draft" },
  submitted: { fa: "ارسال‌شده", en: "Submitted" },
  approved: { fa: "مصوب", en: "Approved" },
  returned: { fa: "برگشتی", en: "Returned" },
  superseded: { fa: "جایگزین‌شده", en: "Superseded" },
};

export type CharterMilestone = { TitleFa: string; TargetDate: string; DeliverableFa: string | null };
export type CharterRisk = { TitleFa: string; Severity: string; MitigationFa: string | null };
export type CharterInput = {
  CharterNo: string;
  TitleFa: string;
  SponsorFa: string;
  ManagerFa: string | null;
  ObjectivesFa: string[];
  ScopeInFa: string;
  ScopeOutFa: string | null;
  Milestones: CharterMilestone[];
  BudgetAmount: number | null;
  Currency: string;
  Risks: CharterRisk[];
  NoteFa: string | null;
};

export const CHARTER_FIELDS: readonly string[] = [
  "CharterNo", "TitleFa", "SponsorFa", "ManagerFa", "ObjectivesFa", "ScopeInFa", "ScopeOutFa",
  "Milestones", "BudgetAmount", "Currency", "Risks", "NoteFa",
];

export function normalizeCharter(value: unknown): CharterInput {
  const v = record(value, "منشور پروژه");
  keys(v, CHARTER_FIELDS);
  const objectives = list(v.ObjectivesFa, "اهداف", 1, 20).map((o, i) => text(o, `هدف ${i + 1}`, 300));
  const milestones = list(v.Milestones, "نقاط عطف", 0, 30).map((m, i) => {
    const r = record(m, `نقطهٔ عطف ${i + 1}`);
    keys(r, ["TitleFa", "TargetDate", "DeliverableFa"]);
    return {
      TitleFa: text(r.TitleFa, `عنوان نقطهٔ عطف ${i + 1}`, 200),
      TargetDate: dateOnly(r.TargetDate, `تاریخ نقطهٔ عطف ${i + 1}`) as string,
      DeliverableFa: text(r.DeliverableFa, `تحویل‌دادنی ${i + 1}`, 300, false) || null,
    };
  });
  for (let i = 1; i < milestones.length; i += 1) {
    if (milestones[i].TargetDate < milestones[i - 1].TargetDate) bad("نقاط عطف باید به ترتیب تاریخ باشند");
  }
  const risks = list(v.Risks, "ریسک‌ها", 0, 20).map((r0, i) => {
    const r = record(r0, `ریسک ${i + 1}`);
    keys(r, ["TitleFa", "Severity", "MitigationFa"]);
    return {
      TitleFa: text(r.TitleFa, `عنوان ریسک ${i + 1}`, 200),
      Severity: choice(r.Severity, RISK_SEVERITY, `شدت ریسک ${i + 1}`, "medium"),
      MitigationFa: text(r.MitigationFa, `اقدام کاهش ${i + 1}`, 400, false) || null,
    };
  });
  const currency = choice(v.Currency, CURRENCIES, "ارز", "IRR");
  const budget = num(v.BudgetAmount, "مبلغ بودجه", 0, 1e15, { nullable: true });
  if (currency !== "IRR" && budget !== null && budget > 1e11) bad("مبلغ ارزی بیش از حد مجاز است");
  return {
    CharterNo: code(v.CharterNo, "شمارهٔ منشور", 40),
    TitleFa: text(v.TitleFa, "عنوان منشور", 300),
    SponsorFa: text(v.SponsorFa, "حامی/کارفرما", 200),
    ManagerFa: text(v.ManagerFa, "مدیر پروژه", 200, false) || null,
    ObjectivesFa: objectives,
    ScopeInFa: text(v.ScopeInFa, "دامنهٔ داخل", 2000),
    ScopeOutFa: text(v.ScopeOutFa, "خارج از دامنه", 2000, false) || null,
    Milestones: milestones,
    BudgetAmount: budget,
    Currency: currency,
    Risks: risks,
    NoteFa: text(v.NoteFa, "یادداشت", 1000, false) || null,
  };
}

/** گردش منشور: ارسال ← تصویب (توسط غیرتهیه‌کننده) / برگشت با دلیل. */
export function charterTransition(
  action: string,
  row: { Status: string; CreatedBy?: string | null },
  actor: string,
  note: string | null,
  now = new Date().toISOString(),
): { Status: string; patch: Record<string, unknown> } {
  const a = choice(action, CHARTER_ACTIONS, "اقدام");
  const status = row.Status;
  if (status === "approved") bad("منشور مصوب قفل است");
  if (status === "superseded") bad("منشور جایگزین‌شدهٔ دیگر تغییرپذیر نیست");
  if (a === "submit") {
    if (status !== "draft" && status !== "returned") bad("فقط پیش‌نویس یا برگشتی ارسال می‌شود");
    return { Status: "submitted", patch: { Status: "submitted", SubmittedAt: now, SubmittedBy: actor } };
  }
  if (status !== "submitted") bad("فقط منشور ارسال‌شده تأیید یا برگشت می‌شود");
  if (row.CreatedBy && row.CreatedBy === actor) bad("تهیه‌کننده نمی‌تواند منشور خود را تأیید یا برگشت کند");
  if (a === "approve") return { Status: "approved", patch: { Status: "approved", ApprovedAt: now, ApprovedBy: actor } };
  const reason = text(note, "دلیل برگشت", 500);
  return { Status: "returned", patch: { Status: "returned", ReturnedAt: now, ReturnedBy: actor, ReturnNoteFa: reason } };
}

/* ═══════════════════════ ۳. PMO-2 فرم‌ساز ═══════════════════════ */

export const FORM_FIELD_TYPES = ["text", "textarea", "number", "date", "select", "checkbox"] as const;
export const FORM_STATUS = ["draft", "published", "retired"] as const;
export const ENTRY_STATUS = ["draft", "submitted", "approved", "returned"] as const;

export const FORM_STATUS_LABEL: Record<string, { fa: string; en: string }> = {
  draft: { fa: "پیش‌نویس", en: "Draft" },
  published: { fa: "منتشرشده", en: "Published" },
  retired: { fa: "بازنشسته", en: "Retired" },
  submitted: { fa: "ارسال‌شده", en: "Submitted" },
  approved: { fa: "تأییدشده", en: "Approved" },
  returned: { fa: "برگشتی", en: "Returned" },
};

export type FormField = {
  Key: string;
  LabelFa: string;
  Type: string;
  Required: boolean;
  Options: string[];
  Min: number | null;
  Max: number | null;
  MaxLen: number | null;
  HelpFa: string | null;
};
export type FormDefinitionInput = { Code: string; TitleFa: string; PurposeFa: string; Fields: FormField[]; NoteFa: string | null };

export const FORM_FIELDS: readonly string[] = ["Code", "TitleFa", "PurposeFa", "Fields", "NoteFa"];
export const FORM_FIELD_KEYS: readonly string[] = ["Key", "LabelFa", "Type", "Required", "Options", "Min", "Max", "MaxLen", "HelpFa"];

export function normalizeFormDefinition(value: unknown): FormDefinitionInput {
  const v = record(value, "فرم");
  keys(v, FORM_FIELDS);
  const fields = list(v.Fields, "فیلدها", 1, 40).map((f0, i) => {
    const f = record(f0, `فیلد ${i + 1}`);
    keys(f, FORM_FIELD_KEYS);
    const Key = code(f.Key, `کلید فیلد ${i + 1}`, 30);
    if (!/^[A-Z][A-Z0-9_]*$/.test(Key)) bad(`کلید فیلد «${Key}» باید با حرف شروع شود و فقط حروف بزرگ/رقم/زیرخط داشته باشد`);
    const Type = choice(f.Type, FORM_FIELD_TYPES, `نوع فیلد ${Key}`);
    const options = Type === "select"
      ? list(f.Options, `گزینه‌های ${Key}`, 2, 20).map((o, j) => text(o, `گزینهٔ ${j + 1} از ${Key}`, 100))
      : [];
    if (Type === "select" && new Set(options).size !== options.length) bad(`گزینه‌های تکراری در «${Key}»`);
    const Min = Type === "number" ? num(f.Min, `کمینهٔ ${Key}`, -1e12, 1e12, { nullable: true }) : null;
    const Max = Type === "number" ? num(f.Max, `بیشینهٔ ${Key}`, -1e12, 1e12, { nullable: true }) : null;
    if (Min !== null && Max !== null && Min > Max) bad(`کمینهٔ «${Key}» از بیشینه بزرگ‌تر است`);
    const MaxLen = Type === "text" || Type === "textarea" ? (num(f.MaxLen, `حداکثر طول ${Key}`, 1, 2000, { int: true, nullable: true }) ?? 200) : null;
    return {
      Key,
      LabelFa: text(f.LabelFa, `برچسب ${Key}`, 200),
      Type,
      Required: f.Required === true,
      Options: options,
      Min,
      Max,
      MaxLen,
      HelpFa: text(f.HelpFa, `راهنمای ${Key}`, 300, false) || null,
    };
  });
  const dup = fields.map((f) => f.Key).find((k, i, all) => all.indexOf(k) !== i);
  if (dup) bad(`کلید فیلد تکراری: ${dup}`);
  return {
    Code: code(v.Code, "کد فرم", 40),
    TitleFa: text(v.TitleFa, "عنوان فرم", 200),
    PurposeFa: text(v.PurposeFa, "هدف فرم", 1000),
    Fields: fields,
    NoteFa: text(v.NoteFa, "یادداشت", 500, false) || null,
  };
}

/** اعتبارسنجی دادهٔ ورودی فرم بر پایهٔ تعریف منتشرشده و تبدیل نوع امن. */
export function validateEntryData(definition: { Fields: FormField[] }, value: unknown): Record<string, unknown> {
  const data = record(value ?? {}, "دادهٔ فرم");
  const defs = definition.Fields;
  const unknown = Object.keys(data).find((k) => !defs.some((f) => f.Key === k));
  if (unknown) bad(`فیلد «${unknown}» در نسخهٔ منتشرشدهٔ فرم نیست`);
  const out: Record<string, unknown> = {};
  for (const f of defs) {
    const raw = data[f.Key];
    const empty = raw === undefined || raw === null || raw === "";
    if (empty) {
      if (f.Required) bad(`«${f.LabelFa}» الزامی است`);
      out[f.Key] = null;
      continue;
    }
    if (f.Type === "checkbox") {
      if (typeof raw !== "boolean") bad(`«${f.LabelFa}» باید بله/خیر باشد`);
      out[f.Key] = raw;
    } else if (f.Type === "number") {
      const n = num(raw, f.LabelFa, f.Min ?? -1e12, f.Max ?? 1e12);
      out[f.Key] = n;
    } else if (f.Type === "date") {
      out[f.Key] = dateOnly(raw, f.LabelFa);
    } else if (f.Type === "select") {
      out[f.Key] = choice(raw, f.Options, f.LabelFa);
    } else {
      const s = text(raw, f.LabelFa, f.MaxLen ?? 200);
      out[f.Key] = s;
    }
  }
  return out;
}

export function entryTransition(
  action: string,
  row: { Status: string; CreatedBy?: string | null },
  actor: string,
  note: string | null,
  now = new Date().toISOString(),
): { Status: string; patch: Record<string, unknown> } {
  const a = choice(action, ["submit", "approve", "return"] as const, "اقدام");
  if (row.Status === "approved") bad("رکورد تأییدشده قفل است");
  if (a === "submit") {
    if (row.Status !== "draft" && row.Status !== "returned") bad("فقط پیش‌نویس یا برگشتی ارسال می‌شود");
    return { Status: "submitted", patch: { Status: "submitted", SubmittedAt: now, SubmittedBy: actor } };
  }
  if (row.Status !== "submitted") bad("فقط رکورد ارسال‌شده تأیید یا برگشت می‌شود");
  if (row.CreatedBy && row.CreatedBy === actor) bad("ثبت‌کننده نمی‌تواند رکورد خود را تأیید یا برگشت کند");
  if (a === "approve") return { Status: "approved", patch: { Status: "approved", ApprovedAt: now, ApprovedBy: actor } };
  const reason = text(note, "دلیل برگشت", 500);
  return { Status: "returned", patch: { Status: "returned", ReturnedAt: now, ReturnedBy: actor, ReturnNoteFa: reason } };
}

export function formTransition(action: string, row: { Status: string; Version?: number; Fields?: unknown }, actor: string, now = new Date().toISOString()) {
  const a = choice(action, ["publish", "retire"] as const, "اقدام");
  if (a === "publish") {
    if (row.Status === "published") bad("نسخهٔ منتشرشده دوباره منتشر نمی‌شود؛ برای تغییر، فرم جدید با همان کد بسازید");
    if (row.Status === "retired") bad("فرم بازنشسته منتشر نمی‌شود");
    const fields = Array.isArray(row.Fields) ? row.Fields : [];
    if (!fields.length) bad("فرم بدون فیلد منتشر نمی‌شود");
    const version = Number(row.Version ?? 0) + 1;
    return { Status: "published", Version: version, patch: { Status: "published", Version: version, PublishedAt: now, PublishedBy: actor } };
  }
  if (row.Status !== "published") bad("فقط فرم منتشرشده بازنشسته می‌شود");
  return { Status: "retired", Version: row.Version ?? 1, patch: { Status: "retired", RetiredAt: now, RetiredBy: actor } };
}

/* ═══════════════════════ ۴. PMO-3 کارت سلامت پروژه ═══════════════════════ */

export const HEALTH_CRITERIA: readonly { Code: string; Weight: number; TitleFa: string; TitleEn: string }[] = [
  { Code: "schedule", Weight: 25, TitleFa: "برنامه و زمان‌بندی", TitleEn: "Schedule" },
  { Code: "cost", Weight: 25, TitleFa: "هزینه و بودجه", TitleEn: "Cost" },
  { Code: "quality", Weight: 15, TitleFa: "کیفیت و بازرسی", TitleEn: "Quality" },
  { Code: "safety", Weight: 15, TitleFa: "ایمنی و HSE", TitleEn: "Safety" },
  { Code: "risk", Weight: 10, TitleFa: "ریسک و تغییر", TitleEn: "Risk" },
  { Code: "stakeholder", Weight: 10, TitleFa: "ذی‌نفعان و ارتباطات", TitleEn: "Stakeholders" },
];
export const HEALTH_BANDS = { green: 85, amber: 70 } as const;
export const HEALTH_STATUS = ["draft", "submitted", "approved", "returned"] as const;

export type HealthCriterion = { Code: string; Weight: number; Score: number; EvidenceFa: string };
export type HealthAssessmentInput = { AsOfDate: string; PeriodNo: number | null; Criteria: HealthCriterion[]; NoteFa: string | null };

export const HEALTH_FIELDS: readonly string[] = ["AsOfDate", "PeriodNo", "Criteria", "NoteFa"];

export function healthBand(score: number): "green" | "amber" | "red" {
  if (score >= HEALTH_BANDS.green) return "green";
  if (score >= HEALTH_BANDS.amber) return "amber";
  return "red";
}

/** امتیاز کل = میانگین وزنی معیارها؛ وزن‌ها باید دقیقاً ۱۰۰ باشند. */
export function healthScore(criteria: { Weight: number; Score: number }[]): number {
  const total = criteria.reduce((s, c) => s + (c.Weight * c.Score) / 100, 0);
  return round2(total);
}

export function normalizeHealthAssessment(value: unknown, opts: { now?: Date } = {}): HealthAssessmentInput & { ScoreTotal: number; Band: string } {
  const v = record(value, "کارت سلامت");
  keys(v, HEALTH_FIELDS);
  const rows = list(v.Criteria, "معیارها", HEALTH_CRITERIA.length, HEALTH_CRITERIA.length).map((c0, i) => {
    const c = record(c0, `معیار ${i + 1}`);
    keys(c, ["Code", "Weight", "Score", "EvidenceFa"]);
    const Code = choice(c.Code, HEALTH_CRITERIA.map((h) => h.Code) as readonly string[], `کد معیار ${i + 1}`);
    return {
      Code,
      Weight: num(c.Weight, `وزن ${Code}`, 0, 100, { int: true }) as number,
      Score: num(c.Score, `امتیاز ${Code}`, 0, 100) as number,
      EvidenceFa: text(c.EvidenceFa, `شاهد ${Code}`, 500),
    };
  });
  const codes = new Set(rows.map((r) => r.Code));
  if (codes.size !== HEALTH_CRITERIA.length) bad("هر معیار باید دقیقاً یک بار بیاید");
  const weightSum = rows.reduce((s, r) => s + r.Weight, 0);
  if (weightSum !== 100) bad(`جمع وزن معیارها باید دقیقاً ۱۰۰ باشد (فعلی ${weightSum})`);
  const ScoreTotal = healthScore(rows);
  return {
    AsOfDate: dateOnly(v.AsOfDate, "تاریخ ارزیابی", { now: opts.now }) as string,
    PeriodNo: num(v.PeriodNo, "شمارهٔ دوره", 1, 60, { int: true, nullable: true }),
    Criteria: rows,
    NoteFa: text(v.NoteFa, "یادداشت", 1000, false) || null,
    ScoreTotal,
    Band: healthBand(ScoreTotal),
  };
}

/* ═══════════════════════ ۵. شاخص‌های میز کار ═══════════════════════ */

export function pmoMetrics(input: {
  charters: { Status: string }[];
  forms: { Status: string }[];
  entries: { Status: string }[];
  assessments: { Band: string; AsOfDate: string; ScoreTotal: number | null }[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const approvedCharter = input.charters.find((c) => c.Status === "approved") ?? null;
  const latest = input.assessments
    .filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(String(a.AsOfDate)))
    .sort((a, b) => (a.AsOfDate < b.AsOfDate ? -1 : 1))
    .at(-1) ?? null;
  return {
    charters: {
      total: input.charters.length,
      approved: input.charters.filter((c) => c.Status === "approved").length,
      pending: input.charters.filter((c) => c.Status === "submitted").length,
      hasApprovedCharter: approvedCharter !== null,
    },
    forms: {
      total: input.forms.length,
      published: input.forms.filter((f) => f.Status === "published").length,
      retired: input.forms.filter((f) => f.Status === "retired").length,
    },
    entries: {
      total: input.entries.length,
      pending: input.entries.filter((e) => e.Status === "submitted").length,
      approved: input.entries.filter((e) => e.Status === "approved").length,
      returned: input.entries.filter((e) => e.Status === "returned").length,
    },
    health: latest
      ? { band: latest.Band, score: latest.ScoreTotal, asOfDate: latest.AsOfDate, assessments: input.assessments.length }
      : { band: null, score: null, asOfDate: null, assessments: input.assessments.length },
    generatedAt: now.toISOString(),
    modelVersion: PMO_MODEL,
  };
}

/* ═══════════════════════ ۶. شکل دادهٔ میز کار ═══════════════════════ */

export type PmoRowMeta = {
  Id: string;
  ProjectId: string;
  RowVersion: number;
  ModelVersion?: string | null;
  CreatedAt?: string;
  CreatedBy?: string;
  UpdatedAt?: string;
  UpdatedBy?: string;
};
export type PmoCharterRow = CharterInput & PmoRowMeta & {
  Status: string;
  SubmittedAt?: string | null; SubmittedBy?: string | null;
  ApprovedAt?: string | null; ApprovedBy?: string | null;
  ReturnedAt?: string | null; ReturnedBy?: string | null; ReturnNoteFa?: string | null;
  /* تصویب منشور تازه، منشور مصوب قبلی را جایگزین می‌کند؛ این‌ها ردِ آن‌اند. */
  SupersededAt?: string | null; SupersededBy?: string | null; SupersededByCharterNo?: string | null;
};
export type PmoFormRow = FormDefinitionInput & PmoRowMeta & {
  Status: string; Version: number;
  PublishedAt?: string | null; PublishedBy?: string | null;
  RetiredAt?: string | null; RetiredBy?: string | null;
};
export type PmoFormEntryRow = PmoRowMeta & {
  FormCode: string; FormVersion: number; SubjectFa: string;
  Data: Record<string, unknown>; Status: string; NoteFa?: string | null;
  SubmittedAt?: string | null; SubmittedBy?: string | null;
  ApprovedAt?: string | null; ApprovedBy?: string | null;
  ReturnedAt?: string | null; ReturnedBy?: string | null; ReturnNoteFa?: string | null;
};
export type PmoHealthRow = HealthAssessmentInput & PmoRowMeta & {
  ScoreTotal: number | null; Band: string | null; Status: string;
  SubmittedAt?: string | null; SubmittedBy?: string | null;
  ApprovedAt?: string | null; ApprovedBy?: string | null;
  ReturnedAt?: string | null; ReturnedBy?: string | null; ReturnNoteFa?: string | null;
  ApprovedNoteFa?: string | null;
};
export type PmoCan = {
  charterEdit: boolean; charterApprove: boolean;
  formManage: boolean; formSubmit: boolean; formApprove: boolean;
  healthRecord: boolean; healthApprove: boolean;
};
export type PmoWorkspacePayload = {
  projectId: string;
  can: PmoCan;
  /** مدل معیارهای کارت سلامت با وزن‌های ثابت — از سرور می‌آید. */
  criteriaModel: { Code: string; Weight: number; TitleFa: string; TitleEn: string }[];
  charters: PmoCharterRow[];
  forms: PmoFormRow[];
  entries: PmoFormEntryRow[];
  assessments: PmoHealthRow[];
  metrics: ReturnType<typeof pmoMetrics>;
  generatedAt: string;
  modelVersion: string;
};
