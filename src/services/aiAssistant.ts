/**
 * P10 — دستیار هوشمند (AI-1..AI-4).
 *
 * چرا این‌گونه ساخته شده:
 *
 * ۱. **ابزار بسته است، SQL آزاد نیست.** پرسش کاربر به یکی از ابزارهای
 *    شناخته‌شده نگاشت می‌شود. پرسش روی داده از موتور گزارش‌ساز سفارشی
 *    (RPT-1) با همان مجموعه‌داده‌های مجاز و همان عملگرهای بسته استفاده
 *    می‌کند؛ هیچ متن آزادی به پایگاه داده نمی‌رود و هیچ ستونی خارج از
 *    فهرست مجاز خوانده نمی‌شود.
 *
 * ۲. **همه‌چیز فقط‌خواندنی است.** هیچ ابزاری نمی‌نویسد، تصویب نمی‌کند و
 *    وضعیت عوض نمی‌کند.
 *
 * ۳. **عدد را سرور می‌سازد، نه مدل.** متن پاسخ و جدول/نمودار از دادهٔ
 *    واقعی همان پروژه ساخته می‌شود. اگر از دادهٔ موجود نتوان عددی ساخت،
 *    صریح «نابسنده» یا «خالی» گفته می‌شود — نه صفر، نه حدس. سرویس هوش
 *    مصنوعی بیرونی (در صورت اتصال) فقط *بازنویسی* همین متن را انجام
 *    می‌دهد و اجازهٔ تغییر عدد ندارد.
 *
 * ۴. **دسترسی، پایهٔ داده است.** هر ابزار مجوز پایهٔ خودش را می‌خواهد و هر
 *    منبع داده دروازهٔ مجوز مستقل دارد؛ منبع بسته در پاسخ «restricted»
 *    می‌آید، نه صفر. (همان اصلی که در MIX-1 و LIVE-5 اعمال شد.)
 */
import {
  RB_DATASETS,
  datasetByKey,
  normalizeSpec,
  applyResult,
  chartSeries,
  type Bi,
  type RbSpec,
} from "./reportBuilder";

export const AI_ASSISTANT_MODEL = "ai-assistant-v1";

export type AiLang = "fa" | "en";

/* ═══════════════════════════ ۱. منابع داده ═══════════════════════════ */

export type AiSourceDef = {
  key: string;
  table: string;
  label: Bi;
  /** مجوز پایهٔ خواندن این جدول؛ بدون آن اصلاً خوانده نمی‌شود. */
  permissions: readonly string[];
};

export const AI_SOURCES: readonly AiSourceDef[] = [
  { key: "risk", table: "Risk", label: { fa: "ریسک‌ها", en: "Risks" }, permissions: ["rcc.risk.view"] },
  { key: "activity", table: "Activity", label: { fa: "فعالیت‌های برنامه", en: "Schedule activities" }, permissions: ["plan.schedule.view"] },
  { key: "progress", table: "ProgressEntry", label: { fa: "ثبت پیشرفت پذیرفته‌شده", en: "Accepted progress entries" }, permissions: ["plan.schedule.view"] },
  { key: "po", table: "PurchaseOrder", label: { fa: "سفارش‌های خرید", en: "Purchase orders" }, permissions: ["fin.cost.view"] },
  { key: "dpr", table: "CpmDprEntry", label: { fa: "گزارش‌های روزانه", en: "Daily reports" }, permissions: ["cpm.dpr.view"] },
  { key: "inspection", table: "CpmInspectionRequest", label: { fa: "درخواست‌های بازرسی", en: "Inspection requests" }, permissions: ["cpm.inspection.view"] },
  { key: "ipc", table: "CntIpcCertificate", label: { fa: "صورت‌وضعیت‌ها", en: "IPC certificates" }, permissions: ["cnt.ipc.prepare", "cnt.ipc.review", "cnt.contract.view"] },
  { key: "document", table: "Document", label: { fa: "مدارک", en: "Documents" }, permissions: ["doc.document.view"] },
  { key: "hold", table: "DocumentHold", label: { fa: "هولدهای مدرک", en: "Document holds" }, permissions: ["doc.document.view"] },
  { key: "comment", table: "DocumentComment", label: { fa: "نظرات مدرک", en: "Document comments" }, permissions: ["doc.document.view"] },
  { key: "ncr", table: "Ncr", label: { fa: "عدم‌انطباق‌ها", en: "NCRs" }, permissions: ["qms.itp.view"] },
  { key: "action", table: "MeetingAction", label: { fa: "مصوبات جلسه", en: "Meeting actions" }, permissions: ["ckm.letter.view", "ckm.meeting.record"] },
  { key: "package", table: "ScmProcPackage", label: { fa: "بسته‌های خرید", en: "Procurement packages" }, permissions: ["scm.package.view"] },
  { key: "health", table: "PmoHealthAssessment", label: { fa: "کارت سلامت پروژه", en: "Health assessments" }, permissions: ["pmo.health.view"] },
];

const SOURCE_BY_KEY = new Map(AI_SOURCES.map((s) => [s.key, s]));
export function sourceByKey(key: string): AiSourceDef | undefined {
  return SOURCE_BY_KEY.get(key);
}

/* ═══════════════════════════ ۲. کاتالوگ ابزارها ═══════════════════════════ */

export type AiToolKey = "top_risks" | "delays" | "forecast" | "bottlenecks" | "briefing" | "dataset_query";

export type AiToolDef = {
  key: AiToolKey;
  kind: "insight" | "query";
  label: Bi;
  hint: Bi;
  /** مجوز پایهٔ خود ابزار (علاوه بر دروازهٔ هر منبع). */
  permissions: readonly string[];
  sources: readonly string[];
  /** کلیدواژه‌های مسیریابی پرسش آزاد (فارسی/انگلیسی). */
  keywords: readonly string[];
  examples: readonly Bi[];
};

export const AI_TOOLS: readonly AiToolDef[] = [
  {
    key: "top_risks",
    kind: "insight",
    label: { fa: "بالاترین ریسک‌ها", en: "Top risks" },
    hint: { fa: "ریسک‌های باز را با امتیاز احتمال×شدت رتبه می‌دهد.", en: "Ranks open risks by probability × impact." },
    permissions: ["rcc.risk.view"],
    sources: ["risk"],
    keywords: ["ریسک", "ریسک‌ها", "خطر", "بحرانی‌ترین", "بالاترین ریسک", "risk", "risks", "top risk"],
    examples: [
      { fa: "بالاترین ریسک‌های پروژه کدام‌اند؟", en: "What are the top risks?" },
      { fa: "ریسک‌های بحرانی را نشان بده", en: "Show critical risks" },
    ],
  },
  {
    key: "delays",
    kind: "insight",
    label: { fa: "تأخیرها و معوقات", en: "Delays & overdue work" },
    hint: { fa: "فعالیت عقب‌افتاده، تحویل دیرکرد، بازرسی معوق، گزارش روزانهٔ در انتظار و مصوبهٔ گذشته را از دادهٔ زنده می‌شمارد.", en: "Counts overdue activities, late deliveries, pending inspections, stuck DPRs and lapsed actions from live data." },
    permissions: ["plan.schedule.view"],
    sources: ["activity", "po", "inspection", "dpr", "action"],
    keywords: ["تأخیر", "تاخیر", "معوق", "عقب", "دیرکرد", "دیر", "از موعد", "گذشته", "سررسید", "موعد", "delay", "delays", "late", "overdue", "due"],
    examples: [
      { fa: "بیشترین تأخیرها کجاست؟", en: "Where are the biggest delays?" },
      { fa: "چه چیزهایی از موعد گذشته‌اند؟", en: "What is overdue?" },
    ],
  },
  {
    key: "forecast",
    kind: "insight",
    label: { fa: "پیش‌بینی پیشرفت", en: "Progress forecast" },
    hint: { fa: "نرخ پیشرفت وزنی را از ثبت‌های پذیرفته‌شده می‌سنجد و تاریخ پایان را خطی برون‌یابی می‌کند؛ با دادهٔ نابسنده عدد نمی‌سازد.", en: "Measures weighted progress rate from accepted entries and extrapolates linearly; fabricates nothing when data is insufficient." },
    permissions: ["plan.schedule.view"],
    sources: ["progress", "activity"],
    keywords: ["پیش‌بینی", "پیش بینی", "پیشرفت", "روند", "نرخ", "forecast", "progress", "pace", "trend"],
    examples: [
      { fa: "پیشرفت پروژه را پیش‌بینی کن", en: "Forecast the progress" },
      { fa: "با این نرخ، کار کِی تمام می‌شود؟", en: "At this pace, when will it finish?" },
    ],
  },
  {
    key: "bottlenecks",
    kind: "insight",
    label: { fa: "گلوگاه‌ها", en: "Bottlenecks" },
    hint: { fa: "کارهای در انتظار اقدام را در گردش‌های واقعی (DPR، بازرسی، صورت‌وضعیت، هولد، نظر مدرک، NCR، مصوبه، بستهٔ خرید) می‌شمارد.", en: "Counts items awaiting action across real workflows (DPR, inspection, IPC, holds, comments, NCRs, actions, packages)." },
    permissions: ["plan.schedule.view"],
    sources: ["dpr", "inspection", "ipc", "hold", "comment", "ncr", "action", "package"],
    keywords: ["گلوگاه", "گلوگاه‌ها", "متوقف", "معلق", "در انتظار", "باز", "باقی‌مانده", "bottleneck", "stuck", "pending", "backlog"],
    examples: [
      { fa: "گلوگاه‌های اصلی کجاست؟", en: "Where are the main bottlenecks?" },
      { fa: "چه کارهایی در انتظار اقدام مانده‌اند؟", en: "What is waiting for action?" },
    ],
  },
  {
    key: "briefing",
    kind: "insight",
    label: { fa: "خلاصهٔ وضعیت پروژه", en: "Project briefing" },
    hint: { fa: "چکیدهٔ ریسک، تأخیر، پیشرفت و گلوگاه در یک پاسخ؛ بخش بی‌مجوز در آن بسته اعلام می‌شود.", en: "A four-part briefing (risks, delays, progress, bottlenecks); restricted parts are declared, not zeroed." },
    permissions: ["plan.schedule.view"],
    sources: [],
    keywords: ["خلاصه", "وضعیت پروژه", "چه خبر", "گزارش کلی", "بریفینگ", "summary", "briefing", "overview", "status"],
    examples: [
      { fa: "خلاصهٔ وضعیت پروژه", en: "Project briefing" },
      { fa: "وضعیت کلی چطور است؟", en: "How is the project doing overall?" },
    ],
  },
  {
    key: "dataset_query",
    kind: "query",
    label: { fa: "پرسش از داده‌های پروژه", en: "Query project data" },
    hint: { fa: "روی ۱۱ مجموعه‌دادهٔ مجاز (فعالیت، مدرک، خرید، صورت‌وضعیت، …) با عملگرهای بسته می‌پرسد؛ نه SQL.", en: "Queries the 11 authorized datasets with closed operators; never SQL." },
    permissions: ["report.custom.run"],
    sources: [],
    keywords: ["چند", "تعداد", "جمع", "مجموع", "میانگین", "فهرست", "لیست", "how many", "count", "sum", "average", "list", "total"],
    examples: [
      { fa: "جمع مبلغ سفارش‌های خرید چقدر است؟", en: "What is the total purchase order amount?" },
      { fa: "سفارش‌های خرید به تفکیک وضعیت", en: "Purchase orders by status" },
    ],
  },
];

const TOOL_BY_KEY = new Map<string, AiToolDef>(AI_TOOLS.map((t) => [t.key, t]));
export function toolByKey(key: string): AiToolDef | undefined {
  return TOOL_BY_KEY.get(key);
}
export function isToolKey(value: unknown): value is AiToolKey {
  return typeof value === "string" && TOOL_BY_KEY.has(value as AiToolKey);
}

/** ابزارهایی که کاربر (بر پایهٔ مجوزهایش) می‌تواند اجرا کند. */
export function allowedTools(can: (permission: string) => boolean): AiToolDef[] {
  return AI_TOOLS.filter((t) => t.permissions.some((p) => can(p)));
}

/* ═══════════════════════════ ۳. متن و قالب پاسخ ═══════════════════════════ */

export type AiFact = { label: Bi; value: string | number | null; kind?: "count" | "money" | "date" | "text" };
export type AiTable = {
  columns: { key: string; label: Bi; kind: string }[];
  rows: (string | number | null)[][];
  truncated: boolean;
};
export type AiChart = {
  kind: "bar" | "pie" | "line";
  category: Bi;
  measure: Bi;
  points: { label: string; value: number | null }[];
};
export type AiSourceUse = { key: string; table: string; label: Bi; rows: number; restricted: boolean; note?: Bi };

export type AiSection = {
  key: string;
  label: Bi;
  state: "answered" | "empty" | "insufficient" | "restricted";
  textFa: string;
  textEn: string;
  facts: AiFact[];
  table: AiTable | null;
  chart: AiChart | null;
  sources: AiSourceUse[];
  limits: Bi[];
};

export type AiContext = {
  projectId: string;
  /** تاریخ داده (ISO day) — قاعده‌های «گذشته از موعد» با آن سنجیده می‌شود. */
  today: string;
  nowIso: string;
  lang: AiLang;
  /** منابعی که خوانده شده‌اند (کلید منبع). */
  loaded: readonly string[];
  /** منابعی که مجوزشان نبود؛ صفر فرض نمی‌شوند. */
  restricted: readonly string[];
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const day = (v: unknown): string | null => {
  if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
};
const says = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true";
const text = (row: Record<string, unknown>, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = row[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return null;
};

export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = day(fromIso);
  const b = day(toIso);
  if (!a || !b) return null;
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
const addDays = (iso: string, days: number): string => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);
const fmt = (v: number | null, lang: AiLang, digits = 0): string =>
  v === null ? (lang === "fa" ? "نامعلوم" : "unknown") : v.toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: digits });
const fmtDate = (v: string | null, lang: AiLang): string => (v === null ? (lang === "fa" ? "نامعلوم" : "unknown") : v);

const b = (fa: string, en: string): Bi => ({ fa, en });

const UNKNOWN_LIMIT = b(
  "عدد نامعلوم با صفر جایگزین نمی‌شود؛ نبود رکورد به معنی نبود خطر نیست.",
  "Unknown is never rendered as zero; an absent record is not proof of absence.",
);

const sourceUses = (ctx: AiContext, keys: readonly string[]): AiSourceUse[] =>
  keys.map((key) => {
    const def = sourceByKey(key)!;
    const restricted = ctx.restricted.includes(key);
    return { key, table: def.table, label: def.label, rows: 0, restricted, note: restricted ? b("مجوز خواندن این منبع را ندارید؛ در این پاسخ لحاظ نشد.", "You lack permission for this source; it is excluded from this answer.") : undefined };
  });

/** تعداد ردیف واقعی هر منبع خوانده‌شده در پاسخ درج می‌شود (منبع داده). */
function withRowCounts(uses: AiSourceUse[], data: AiData): AiSourceUse[] {
  return uses.map((u) => (u.restricted ? u : { ...u, rows: (data[u.key] ?? []).length }));
}

const restrictedNote = (uses: AiSourceUse[]): Bi | null => {
  const closed = uses.filter((u) => u.restricted).map((u) => u.label.fa);
  if (!closed.length) return null;
  return b(`منابع بسته‌شده در این پاسخ: ${closed.join("، ")} (صفر فرض نشدند).`, `Sources excluded by permission: ${closed.map((c) => c).join(", ")} (not treated as zero).`);
};

/* ═══════════════════════════ ۴. اعتبارسنجی پارامترها ═══════════════════════════ */

export class AiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
const bad = (message: string): never => {
  throw new AiError("E-AI-PARAM", message);
};

export type AiData = Record<string, Record<string, unknown>[]>;

const intParam = (raw: unknown, min: number, max: number, fallback: number, what: string): number => {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) bad(`«${what}» باید عددی بین ${min} و ${max} باشد`);
  return n as number;
};

/** پارامترهای مجاز هر ابزار؛ هر چیز دیگری رد می‌شود. */
export function normalizeToolParams(toolKey: AiToolKey, raw: unknown): Record<string, unknown> {
  const input = (raw ?? {}) as Record<string, unknown>;
  if (typeof input !== "object" || Array.isArray(input)) bad("پارامترها باید شیء باشند");
  const allowedByTool: Record<AiToolKey, string[]> = {
    top_risks: ["limit", "status"],
    delays: ["limit", "category"],
    forecast: [],
    bottlenecks: ["limit"],
    briefing: [],
    dataset_query: ["spec"],
  };
  const allowed = allowedByTool[toolKey];
  if (!allowed) throw new AiError("E-AI-TOOL", `ابزار «${String(toolKey)}» شناخته‌شده نیست`);
  const foreign = Object.keys(input).find((k) => !allowed.includes(k));
  if (foreign) bad(`پارامتر ناشناخته: ${foreign}`);
  if (toolKey === "top_risks") {
    const status = input.status === undefined ? "open" : String(input.status);
    if (!["open", "all"].includes(status)) bad("وضعیت ریسک باید open یا all باشد");
    return { limit: intParam(input.limit, 1, 20, 5, "limit"), status };
  }
  if (toolKey === "delays") {
    const category = input.category === undefined ? "all" : String(input.category);
    if (!["all", "schedule", "delivery", "inspection", "approval", "action"].includes(category)) bad("دستهٔ تأخیر نامعتبر است");
    return { limit: intParam(input.limit, 1, 50, 8, "limit"), category };
  }
  if (toolKey === "bottlenecks") return { limit: intParam(input.limit, 1, 20, 6, "limit") };
  if (toolKey === "dataset_query") {
    const spec = input.spec;
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) bad("مشخصات پرسش داده لازم است");
    return { spec: normalizeSpec(spec) };
  }
  return {};
}

/* ═══════════════════════════ ۵. محاسبهٔ ابزارها ═══════════════════════════ */

const RISK_OPEN = new Set(["open", "mitigated"]);

function computeTopRisks(params: Record<string, unknown>, data: AiData, ctx: AiContext): AiSection {
  const limit = Number(params.limit ?? 5);
  const status = String(params.status ?? "open");
  const rows = data.risk ?? [];
  const ranked = rows
    .filter((r) => (status === "all" ? true : RISK_OPEN.has(String(r.Status ?? "open"))))
    .map((r) => ({ row: r, score: num(r.Score) ?? (num(r.Probability) ?? 0) * (num(r.Impact) ?? 0) }))
    .sort((a, x) => x.score - a.score || String(a.row.Code ?? "").localeCompare(String(x.row.Code ?? "")));
  const openCount = rows.filter((r) => RISK_OPEN.has(String(r.Status ?? "open"))).length;
  const uses = withRowCounts(sourceUses(ctx, ["risk"]), data);
  const limits = [
    b("امتیاز = احتمال × شدت (حداکثر ۲۵) همان‌طور که در رکورد ریسک ثبت شده است.", "Score = probability × impact (max 25) as recorded on the risk row."),
    b("این ابزار فقط رتبه‌بندی می‌کند؛ ریسک تازه نمی‌سازد و پاسخ/اقدام ثبت نمی‌کند.", "This tool only ranks; it neither creates risks nor records responses."),
    UNKNOWN_LIMIT,
  ];
  const note = restrictedNote(uses);
  if (!rows.length || !ranked.length) {
    const empty = status === "all" ? rows.length === 0 : openCount === 0;
    return {
      key: "top_risks",
      label: toolByKey("top_risks")!.label,
      state: empty ? "empty" : "answered",
      textFa: empty
        ? `در دادهٔ مجاز این پروژه ریسکی با وضعیت «${status === "all" ? "هر وضعیت" : "باز"}» ثبت نشده است. نبود رکورد به معنی نبود ریسک نیست.`
        : `در فهرست ریسک‌های باز این پروژه رکوردی با امتیاز قابل رتبه‌بندی نیست؛ ${openCount} ریسک باز ثبت شده است.`,
      textEn: empty
        ? `No risk with status "${status}" is recorded in the authorized data of this project. Absence of a record is not absence of risk.`
        : `No open risk carries a rankable score; ${openCount} open risks are recorded.`,
      facts: [{ label: b("ریسک باز", "Open risks"), value: openCount, kind: "count" }],
      table: null,
      chart: null,
      sources: uses,
      limits: note ? [...limits, note] : limits,
    };
  }
  const top = ranked.slice(0, limit);
  const lines = top.map((t, i) => `${i + 1}) ${text(t.row, "Code") ?? "—"} — ${text(t.row, "TitleFa") ?? "—"} (امتیاز ${fmt(t.score, ctx.lang)})`);
  return {
    key: "top_risks",
    label: toolByKey("top_risks")!.label,
    state: "answered",
    textFa: `${openCount} ریسک باز در دادهٔ مجاز این پروژه هست. رتبه‌بندی بر پایهٔ احتمال×شدت:\n${lines.join("\n")}`,
    textEn: `${openCount} open risks are visible in this project. Ranked by probability × impact:\n${top.map((t, i) => `${i + 1}) ${text(t.row, "Code") ?? "—"} — ${text(t.row, "TitleFa") ?? "—"} (score ${fmt(t.score, ctx.lang)})`).join("\n")}`,
    facts: [
      { label: b("ریسک باز", "Open risks"), value: openCount, kind: "count" },
      { label: b("بالاترین امتیاز", "Top score"), value: top[0].score, kind: "count" },
      { label: b("مالک بالاترین ریسک", "Owner of top risk"), value: text(top[0].row, "Owner"), kind: "text" },
    ],
    table: {
      columns: [
        { key: "Code", label: b("کد", "Code"), kind: "text" },
        { key: "TitleFa", label: b("عنوان", "Title"), kind: "text" },
        { key: "Score", label: b("امتیاز", "Score"), kind: "number" },
        { key: "Status", label: b("وضعیت", "Status"), kind: "text" },
        { key: "Owner", label: b("مالک", "Owner"), kind: "text" },
      ],
      rows: top.map((t) => [text(t.row, "Code"), text(t.row, "TitleFa"), t.score, text(t.row, "Status"), text(t.row, "Owner")]),
      truncated: ranked.length > limit,
    },
    chart: {
      kind: "bar",
      category: b("ریسک", "Risk"),
      measure: b("امتیاز", "Score"),
      points: top.map((t) => ({ label: text(t.row, "Code") ?? "—", value: t.score })),
    },
    sources: uses,
    limits: note ? [...limits, note] : limits,
  };
}

type DelayItem = { category: string; ref: string; title: string; days: number; table: string; critical: boolean };

function computeDelays(params: Record<string, unknown>, data: AiData, ctx: AiContext): AiSection {
  const limit = Number(params.limit ?? 8);
  const want = String(params.category ?? "all");
  const items: DelayItem[] = [];

  for (const r of data.activity ?? []) {
    const finish = day(r.PlannedFinish);
    if (!finish || finish >= ctx.today) continue;
    if (day(r.ActualFinish)) continue;
    const pct = num(r.PhysicalPct) ?? 0;
    if (pct >= 100) continue;
    const days = daysBetween(finish, ctx.today) ?? 0;
    if (days <= 0) continue;
    items.push({ category: "schedule", ref: text(r, "Code") ?? "—", title: text(r, "NameFa", "NameEn") ?? "—", days, table: "Activity", critical: says(r.IsCritical) });
  }
  for (const r of data.po ?? []) {
    const promised = day(r.PromisedDate);
    if (!promised || promised >= ctx.today) continue;
    if (day(r.DeliveredDate)) continue;
    const status = String(r.Status ?? "");
    if (["cancelled", "closed", "delivered"].includes(status)) continue;
    const days = daysBetween(promised, ctx.today) ?? 0;
    if (days <= 0) continue;
    items.push({ category: "delivery", ref: text(r, "PoNo") ?? "—", title: text(r, "TitleFa", "VendorName") ?? "—", days, table: "PurchaseOrder", critical: false });
  }
  for (const r of data.inspection ?? []) {
    const target = day(r.TargetDate);
    if (!target || target >= ctx.today) continue;
    const status = String(r.Status ?? "");
    if (["released", "rejected", "cancelled"].includes(status)) continue;
    const days = daysBetween(target, ctx.today) ?? 0;
    if (days <= 0) continue;
    items.push({ category: "inspection", ref: text(r, "RequestNo") ?? "—", title: text(r, "ScopeFa", "ActivityCode") ?? "—", days, table: "CpmInspectionRequest", critical: false });
  }
  for (const r of data.dpr ?? []) {
    if (String(r.Status ?? "") !== "submitted") continue;
    const rdate = day(r.ReportDate) ?? day(r.SubmittedAt);
    if (!rdate) continue;
    const days = daysBetween(rdate, ctx.today) ?? 0;
    if (days <= 7) continue;
    items.push({ category: "approval", ref: text(r, "ReportNo") ?? "—", title: text(r, "WorkDoneFa", "LocationFa") ?? "—", days, table: "CpmDprEntry", critical: false });
  }
  for (const r of data.action ?? []) {
    const due = day(r.DueDate);
    if (!due || due >= ctx.today) continue;
    if (["closed", "cancelled", "done"].includes(String(r.Status ?? ""))) continue;
    const days = daysBetween(due, ctx.today) ?? 0;
    if (days <= 0) continue;
    items.push({ category: "action", ref: text(r, "Code") ?? "—", title: text(r, "TitleFa") ?? "—", days, table: "MeetingAction", critical: false });
  }

  const sourceKeys = ["activity", "po", "inspection", "dpr", "action"];
  const uses = withRowCounts(sourceUses(ctx, sourceKeys), data);
  const note = restrictedNote(uses);
  const filtered = want === "all" ? items : items.filter((i) => i.category === want);
  const sorted = [...filtered].sort((a, x) => x.days - a.days || a.ref.localeCompare(x.ref));
  const byCategory = new Map<string, number>();
  for (const i of filtered) byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + 1);
  const labels: Record<string, Bi> = {
    schedule: b("فعالیت عقب‌افتاده", "Overdue activity"),
    delivery: b("تحویل دیرکرد", "Late delivery"),
    inspection: b("بازرسی معوق", "Overdue inspection"),
    approval: b("گزارش روزانهٔ در انتظار تأیید", "DPR awaiting approval"),
    action: b("مصوبهٔ گذشته از موعد", "Action past due"),
  };
  const limits = [
    b("معیار تأخیر: تاریخ برنامه‌ای/وعده/هدف گذشته و کار هنوز بسته نشده (تاریخ داده سرور).", "Overdue = planned/promised/target date passed while the item is not closed (server data date)."),
    b("گزارش روزانه پس از ۷ روز انتظار تأیید، معوق شمرده می‌شود.", "A DPR counts as stuck after 7 days awaiting approval."),
    UNKNOWN_LIMIT,
  ];
  if (!filtered.length) {
    return {
      key: "delays",
      label: toolByKey("delays")!.label,
      state: "empty",
      textFa: "در منابع مجاز و در دستهٔ انتخاب‌شده، موردی که از موعد گذشته و هنوز بسته نشده باشد دیده نشد. نبود رکورد، اثبات نبود تأخیر نیست.",
      textEn: "No item in the selected category is both past its due date and still open in the authorized sources. An absent record does not prove absence of delay.",
      facts: [{ label: b("مورد معوق", "Overdue items"), value: 0, kind: "count" }],
      table: null,
      chart: null,
      sources: uses,
      limits: note ? [...limits, note] : limits,
    };
  }
  const top = sorted.slice(0, limit);
  const parts = [...byCategory.entries()].map(([k, v]) => `${labels[k]?.fa ?? k}: ${fmt(v, ctx.lang)}`).join(" · ");
  return {
    key: "delays",
    label: toolByKey("delays")!.label,
    state: "answered",
    textFa: `${fmt(filtered.length, ctx.lang)} مورد معوق در دستهٔ «${want === "all" ? "همه" : labels[want]?.fa ?? want}» دیده می‌شود — ${parts}.\nبدترین مورد: ${top[0].ref} با ${fmt(top[0].days, ctx.lang)} روز تأخیر (${top[0].title}).`,
    textEn: `${fmt(filtered.length, ctx.lang)} overdue items in category "${want}": ${[...byCategory.entries()].map(([k, v]) => `${labels[k]?.en ?? k}: ${v}`).join(" · ")}.\nWorst: ${top[0].ref} — ${top[0].days} days late (${top[0].title}).`,
    facts: [
      { label: b("مورد معوق", "Overdue items"), value: filtered.length, kind: "count" },
      { label: b("بیشترین تأخیر (روز)", "Worst delay (days)"), value: top[0].days, kind: "count" },
      ...(byCategory.has("schedule") ? [{ label: b("فعالیت عقب‌افتاده", "Overdue activities"), value: byCategory.get("schedule")!, kind: "count" as const }] : []),
      ...(byCategory.has("delivery") ? [{ label: b("تحویل دیرکرد", "Late deliveries"), value: byCategory.get("delivery")!, kind: "count" as const }] : []),
    ],
    table: {
      columns: [
        { key: "category", label: b("دسته", "Category"), kind: "text" },
        { key: "ref", label: b("مرجع", "Reference"), kind: "text" },
        { key: "title", label: b("عنوان", "Title"), kind: "text" },
        { key: "days", label: b("روز تأخیر", "Days late"), kind: "number" },
        { key: "table", label: b("جدول", "Table"), kind: "text" },
      ],
      rows: top.map((i) => [labels[i.category]?.fa ?? i.category, i.ref, i.title, i.days, i.table]),
      truncated: sorted.length > limit,
    },
    chart: {
      kind: "bar",
      category: b("دسته", "Category"),
      measure: b("تعداد", "Count"),
      points: [...byCategory.entries()].map(([k, v]) => ({ label: labels[k]?.fa ?? k, value: v })),
    },
    sources: uses,
    limits: note ? [...limits, note] : limits,
  };
}

function computeForecast(_params: Record<string, unknown>, data: AiData, ctx: AiContext): AiSection {
  const uses = withRowCounts(sourceUses(ctx, ["progress", "activity"]), data);
  const note = restrictedNote(uses);
  const limits = [
    b("وزن هر فعالیت = هزینهٔ بودجهٔ ثبت‌شدهٔ آن؛ اگر ثبت نشده باشد وزن ۱. اگر بودجه ناقص باشد، نرخ وزنی می‌تواند گمراه‌کننده باشد.", "Activity weight = its recorded budget cost, else 1. A partial budget makes the weighted rate misleading."),
    b("پیش‌بینی خطی است: ادامهٔ نرخ مشاهده‌شده، نه مدل کالibre‌شده و نه تاریخ قراردادی.", "The forecast is linear: extrapolating the observed rate, not a calibrated model or a contractual date."),
    b("فقط ثبت‌های پیشرفت پذیرفته‌شده/تأییدشده خوانده می‌شود، نه درصد خام فعالیت.", "Only accepted/approved progress entries are read, never raw activity percent."),
    UNKNOWN_LIMIT,
  ];
  const progressRows = (data.progress ?? []).filter((r) => says(r.AcceptedIntoEv) || r.ApprovedBy);
  const activityById = new Map<string, Record<string, unknown>>();
  for (const a of data.activity ?? []) activityById.set(String(a.Id ?? ""), a);
  const weightOf = (activityId: string): number => {
    const a = activityById.get(activityId);
    const budget = num(a?.BudgetCost);
    return budget !== null && budget > 0 ? budget : 1;
  };
  const observations = progressRows
    .map((r) => ({ date: day(r.EntryDate), pct: num(r.PhysicalPct), activityId: String(r.ActivityId ?? "") }))
    .filter((o): o is { date: string; pct: number; activityId: string } => o.date !== null && o.pct !== null)
    .sort((a, x) => a.date.localeCompare(x.date));
  const insufficient = (reasonFa: string, reasonEn: string): AiSection => ({
    key: "forecast",
    label: toolByKey("forecast")!.label,
    state: "insufficient",
    textFa: reasonFa,
    textEn: reasonEn,
    facts: [{ label: b("ثبت پذیرفته‌شده", "Accepted entries"), value: observations.length, kind: "count" }],
    table: null,
    chart: null,
    sources: uses,
    limits: note ? [...limits, note] : limits,
  });
  if (observations.length < 2) {
    return insufficient(
      `برای پیش‌بینی پیشرفت حداقل دو ثبت پذیرفته‌شده (با تاریخ و درصد) لازم است؛ اکنون ${fmt(observations.length, ctx.lang)} ثبت وجود دارد. عددی ساخته نمی‌شود.`,
      `A progress forecast needs at least two accepted entries (date + percent); only ${observations.length} is visible. No number is fabricated.`,
    );
  }
  const dates = [...new Set(observations.map((o) => o.date))].sort();
  const span = daysBetween(dates[0], dates[dates.length - 1]) ?? 0;
  if (span < 7) {
    return insufficient(
      `بازهٔ ثبت‌ها ${fmt(span, ctx.lang)} روز است (حداقل ۷ روز لازم است)؛ پیش‌بینی از این بازه ساخته نمی‌شود.`,
      `The observation window is ${span} day(s); at least 7 days are required. No forecast is produced.`,
    );
  }
  const latestByActivity = new Map<string, number>();
  const series: { date: string; value: number }[] = [];
  for (const d of dates) {
    for (const o of observations) if (o.date === d) latestByActivity.set(o.activityId, o.pct);
    let weighted = 0;
    let weightSum = 0;
    for (const [activityId, pct] of latestByActivity) {
      const w = weightOf(activityId);
      weighted += w * (pct / 100);
      weightSum += w;
    }
    series.push({ date: d, value: weightSum > 0 ? (weighted / weightSum) * 100 : 0 });
  }
  const first = series[0];
  const last = series[series.length - 1];
  const rate = (last.value - first.value) / span;
  if (!(rate > 0)) {
    return insufficient(
      `نرخ پیشرفت وزنی در این بازه ${fmt(rate, ctx.lang, 3)} درصد در روز است (صفر یا منفی)؛ با این نرخ تاریخ پایانی برون‌یابی نمی‌شود.`,
      `The weighted progress rate over this window is ${rate.toFixed(3)} %/day (zero or negative); no finish date is extrapolated.`,
    );
  }
  const remaining = Math.max(0, 100 - last.value);
  const daysToFinish = Math.ceil(remaining / rate);
  const forecastDate = addDays(ctx.today, daysToFinish);
  const plannedFinish = (data.activity ?? [])
    .filter((a) => (num(a.PhysicalPct) ?? 0) < 100)
    .map((a) => day(a.PlannedFinish))
    .filter((d): d is string => d !== null)
    .sort()
    .at(-1) ?? null;
  const slipDays = plannedFinish ? Math.max(0, daysBetween(plannedFinish, forecastDate) ?? 0) : null;
  return {
    key: "forecast",
    label: toolByKey("forecast")!.label,
    state: "answered",
    textFa: `پیشرفت وزنی در آخرین ثبت (${last.date}): ${fmt(last.value, ctx.lang, 1)}٪ · نرخ بازهٔ ${fmt(span, ctx.lang)}روزه: ${fmt(rate, ctx.lang, 3)} درصد در روز.\nبا ادامهٔ همین نرخ، ۱۰۰٪ حدود ${fmtDate(forecastDate, ctx.lang)} (${fmt(daysToFinish, ctx.lang)} روز) به‌دست می‌آید.${plannedFinish ? ` آخرین پایان برنامه‌ای کارهای باز: ${fmtDate(plannedFinish, ctx.lang)}${slipDays !== null ? ` — انحراف: ${fmt(slipDays, ctx.lang)} روز` : ""}.` : " تاریخ برنامه‌ای کارهای باز ثبت نشده است."}`,
    textEn: `Weighted progress at the latest entry (${last.date}): ${last.value.toFixed(1)}% · rate over a ${span}-day window: ${rate.toFixed(3)} %/day.\nAt this pace, 100% is reached around ${forecastDate} (${daysToFinish} days).${plannedFinish ? ` Latest planned finish of open work: ${plannedFinish}${slipDays !== null ? ` — slip: ${slipDays} days` : ""}.` : " No planned finish is recorded for open work."}`,
    facts: [
      { label: b("پیشرفت وزنی کنونی", "Weighted progress"), value: Math.round(last.value * 10) / 10, kind: "count" },
      { label: b("نرخ (٪ در روز)", "Rate (%/day)"), value: Math.round(rate * 1000) / 1000, kind: "count" },
      { label: b("تاریخ پیش‌بینی ۱۰۰٪", "Forecast 100% date"), value: forecastDate, kind: "date" },
      { label: b("انحراف از پایان برنامه‌ای (روز)", "Slip vs planned finish (days)"), value: slipDays, kind: "count" },
    ],
    table: {
      columns: [
        { key: "date", label: b("تاریخ", "Date"), kind: "date" },
        { key: "value", label: b("پیشرفت وزنی (٪)", "Weighted progress (%)"), kind: "number" },
      ],
      rows: series.slice(-30).map((p) => [p.date, Math.round(p.value * 100) / 100]),
      truncated: series.length > 30,
    },
    chart: {
      kind: "line",
      category: b("تاریخ", "Date"),
      measure: b("پیشرفت وزنی (٪)", "Weighted progress (%)"),
      points: series.slice(-30).map((p) => ({ label: p.date, value: Math.round(p.value * 100) / 100 })),
    },
    sources: uses,
    limits: note ? [...limits, note] : limits,
  };
}

function computeBottlenecks(params: Record<string, unknown>, data: AiData, ctx: AiContext): AiSection {
  const limit = Number(params.limit ?? 6);
  const sourceKeys = ["dpr", "inspection", "ipc", "hold", "comment", "ncr", "action", "package"];
  const uses = withRowCounts(sourceUses(ctx, sourceKeys), data);
  const note = restrictedNote(uses);
  const buckets: { key: string; label: Bi; count: number; oldestDays: number | null; sample: string | null }[] = [];
  const add = (key: string, label: Bi, refField: string, rows: Record<string, unknown>[], dateField: string) => {
    if (!ctx.loaded.includes(key)) return;
    let oldest: number | null = null;
    let sample: string | null = null;
    for (const r of rows) {
      const d = day(r[dateField]);
      const age = d ? Math.max(0, daysBetween(d, ctx.today) ?? 0) : null;
      if (age !== null && (oldest === null || age > oldest)) {
        oldest = age;
        sample = text(r, refField) ?? null;
      }
    }
    buckets.push({ key, label, count: rows.length, oldestDays: oldest, sample });
  };
  add("dpr", b("گزارش روزانه در انتظار تأیید", "DPRs awaiting approval"), "ReportNo", (data.dpr ?? []).filter((r) => String(r.Status ?? "") === "submitted"), "ReportDate");
  add("inspection", b("درخواست بازرسی باز", "Open inspection requests"), "RequestNo", (data.inspection ?? []).filter((r) => ["draft", "submitted", "requested"].includes(String(r.Status ?? ""))), "RequestedAt");
  add("ipc", b("صورت‌وضعیت در جریان", "IPCs in progress"), "TemplateCode", (data.ipc ?? []).filter((r) => ["draft", "submitted"].includes(String(r.Status ?? ""))), "PeriodTo");
  add("hold", b("هولد باز مدرک", "Open document holds"), "HoldNo", (data.hold ?? []).filter((r) => String(r.Status ?? "") === "open"), "RaisedAt");
  add("comment", b("نظر مدرک بی‌جمع‌بندی", "Document comments without conclusion"), "DocNo", (data.comment ?? []).filter((r) => ["open", "replied"].includes(String(r.Status ?? ""))), "CommentedAt");
  add("ncr", b("عدم‌انطباق باز", "Open NCRs"), "Code", (data.ncr ?? []).filter((r) => String(r.Status ?? "") !== "closed"), "RaisedAt");
  add("action", b("مصوبهٔ باز", "Open meeting actions"), "Code", (data.action ?? []).filter((r) => !["closed", "cancelled", "done"].includes(String(r.Status ?? ""))), "DueDate");
  add("package", b("بستهٔ خرید در جریان", "Procurement packages in progress"), "Code", (data.package ?? []).filter((r) => !["ordered", "closed", "cancelled"].includes(String(r.Status ?? ""))), "PlannedIssueDate");
  const total = buckets.reduce((s, x) => s + x.count, 0);
  const ranked = [...buckets].sort((a, x) => x.count - a.count || a.key.localeCompare(x.key));
  const limits = [
    b("«در انتظار» یعنی رکورد در وضعیت باز همان گردش است؛ ابزار هیچ‌چیز را تغییر نمی‌دهد.", "\"Pending\" means the row sits in an open state of its own workflow; the tool changes nothing."),
    b("سن از تاریخ ثبت/سررسید همان رکورد تا تاریخ داده سرور محاسبه می‌شود.", "Age is measured from the row's own date to the server data date."),
    UNKNOWN_LIMIT,
  ];
  if (!total) {
    return {
      key: "bottlenecks",
      label: toolByKey("bottlenecks")!.label,
      state: "empty",
      textFa: "در منابع مجاز این پروژه، کار در انتظار اقدامی دیده نشد. منابع بسته‌شده در بالا فهرست شده‌اند و صفر فرض نشدند.",
      textEn: "No work awaiting action is visible in the authorized sources of this project. Restricted sources are listed above and were not treated as zero.",
      facts: [{ label: b("کار در انتظار", "Pending items"), value: 0, kind: "count" }],
      table: null,
      chart: null,
      sources: uses,
      limits: note ? [...limits, note] : limits,
    };
  }
  const top = ranked.slice(0, limit);
  return {
    key: "bottlenecks",
    label: toolByKey("bottlenecks")!.label,
    state: "answered",
    textFa: `${fmt(total, ctx.lang)} کار در انتظار اقدام در ${fmt(ranked.length, ctx.lang)} گردش دیده می‌شود. بزرگ‌ترین گلوگاه: «${ranked[0].label.fa}» با ${fmt(ranked[0].count, ctx.lang)} مورد${ranked[0].oldestDays !== null ? ` (قدیمی‌ترین: ${fmt(ranked[0].oldestDays, ctx.lang)} روز${ranked[0].sample ? ` — ${ranked[0].sample}` : ""})` : ""}.`,
    textEn: `${fmt(total, ctx.lang)} items await action across ${ranked.length} workflows. Largest bottleneck: "${ranked[0].label.en}" with ${ranked[0].count} item(s)${ranked[0].oldestDays !== null ? ` (oldest ${ranked[0].oldestDays} days${ranked[0].sample ? ` — ${ranked[0].sample}` : ""})` : ""}.`,
    facts: [
      { label: b("کار در انتظار", "Pending items"), value: total, kind: "count" },
      ...top.slice(0, 4).map((x) => ({ label: x.label, value: x.count, kind: "count" as const })),
    ],
    table: {
      columns: [
        { key: "bucket", label: b("گردش", "Workflow"), kind: "text" },
        { key: "count", label: b("تعداد", "Count"), kind: "number" },
        { key: "oldest", label: b("قدیمی‌ترین (روز)", "Oldest (days)"), kind: "number" },
        { key: "sample", label: b("نمونهٔ مرجع", "Sample ref"), kind: "text" },
      ],
      rows: top.map((x) => [x.label.fa, x.count, x.oldestDays, x.sample]),
      truncated: ranked.length > limit,
    },
    chart: {
      kind: "bar",
      category: b("گردش", "Workflow"),
      measure: b("تعداد", "Count"),
      points: top.map((x) => ({ label: x.label.fa, value: x.count })),
    },
    sources: uses,
    limits: note ? [...limits, note] : limits,
  };
}

function computeDatasetQuery(params: Record<string, unknown>, data: AiData, ctx: AiContext): AiSection {
  const spec = params.spec as RbSpec;
  const dataset = datasetByKey(spec.dataset);
  if (!dataset) throw new AiError("E-AI-DATASET", `مجموعه‌دادهٔ «${spec.dataset}» شناخته‌شده نیست`);
  const rows = data[`dataset:${spec.dataset}`] ?? [];
  const result = applyResult(spec, rows, ctx.nowIso);
  const chart = chartSeries(spec, result);
  const money = dataset.columns.filter((c) => (c.kind === "money" || c.kind === "number") && result.totals[c.name] !== undefined);
  const limits = [
    b("عملگرها و ستون‌ها بسته‌اند؛ فیلتر آزاد/SQL پذیرفته نمی‌شود.", "Operators and columns are closed; free-form filters/SQL are rejected."),
    b(`سقف پیش‌فرض ${fmt(spec.limit, "fa")} ردیف است؛ فراتر از آن عدد کامل نمایش داده نمی‌شود.`, `The default cap is ${spec.limit} rows; beyond that a complete number is not shown.`),
    UNKNOWN_LIMIT,
  ];
  const uses: AiSourceUse[] = [
    {
      key: `dataset:${dataset.key}`,
      table: dataset.table,
      label: dataset.label,
      rows: rows.length,
      restricted: false,
    },
  ];
  const headline = result.groups
    ? `«${dataset.label.fa}» بر پایهٔ ${spec.group!.by}: ${fmt(result.groups.length, ctx.lang)} گروه از ${fmt(result.matched, ctx.lang)} ردیف قابل مشاهده.`
    : `«${dataset.label.fa}»: ${fmt(result.matched, ctx.lang)} ردیف با این مشخصات یافت شد؛ ${fmt(result.shown, ctx.lang)} ردیف نمایش داده می‌شود${result.truncated ? " (بریده — سقف سطر)" : ""}.`;
  const totalLine = money.length ? `\nجمع‌های ستون‌های عددی: ${money.map((c) => `${c.label.fa} = ${fmt(result.totals[c.name], ctx.lang, 2)}`).join(" · ")}` : "";
  return {
    key: "dataset_query",
    label: toolByKey("dataset_query")!.label,
    state: result.matched === 0 ? "empty" : "answered",
    textFa: result.matched === 0 ? `در «${dataset.label.fa}» ردیفی با این مشخصات در دادهٔ مجاز این پروژه نیست (نه اینکه داده‌ای وجود ندارد).` : `${headline}${totalLine}`,
    textEn: result.matched === 0 ? `No row matches the spec in "${dataset.label.en}" within the authorized data of this project (which is not the same as having no data).` : `${result.groups ? `"${dataset.label.en}" grouped by ${spec.group!.by}: ${result.groups.length} group(s) over ${result.matched} visible row(s).` : `"${dataset.label.en}": ${result.matched} matching row(s); showing ${result.shown}${result.truncated ? " (truncated by cap)" : ""}.`}`,
    facts: [
      { label: b("ردیف یافت‌شده", "Matched rows"), value: result.matched, kind: "count" },
      { label: b("ردیف نمایش‌داده‌شده", "Shown rows"), value: result.shown, kind: "count" },
      { label: b("جدول منبع", "Source table"), value: dataset.table, kind: "text" },
    ],
    table: result.groups
      ? {
          columns: [
            { key: spec.group!.by, label: dataset.columns.find((c) => c.name === spec.group!.by)?.label ?? b(spec.group!.by, spec.group!.by), kind: "text" },
            { key: "count", label: b("تعداد", "Count"), kind: "number" },
            ...spec.group!.aggs.filter((a) => a.fn !== "count").map((a) => ({ key: `${a.fn}:${a.column}`, label: b(`${a.fn} ${a.column}`, `${a.fn} ${a.column}`), kind: "number" })),
          ],
          rows: result.groups.map((g) => [
            g.key,
            g.count,
            ...spec.group!.aggs.filter((a) => a.fn !== "count").map((a) => g.aggs[`${a.fn}:${a.column}`] ?? null),
          ]),
          truncated: result.truncated,
        }
      : result.rows.length
        ? {
            columns: spec.fields.map((f) => dataset.columns.find((c) => c.name === f) ? { key: f, label: dataset.columns.find((c) => c.name === f)!.label, kind: dataset.columns.find((c) => c.name === f)!.kind } : { key: f, label: b(f, f), kind: "text" }),
            rows: result.rows.map((r) => spec.fields.map((f) => r[f] ?? null)),
            truncated: result.truncated,
          }
        : null,
    chart: chart && chart.kind !== "none" ? { kind: chart.kind, category: dataset.columns.find((c) => c.name === chart.category)?.label ?? b(chart.category, chart.category), measure: b(chart.measure, chart.measure), points: chart.points } : null,
    sources: uses,
    limits,
  };
}

/** بخش «بسته»: ابزاری که همهٔ منابعش بی‌مجوز است، صفر اعلام نمی‌شود. */
function restrictedSection(def: AiToolDef, ctx: AiContext, reasonFa?: string, reasonEn?: string): AiSection {
  const uses = sourceUses(ctx, def.sources);
  return {
    key: def.key,
    label: def.label,
    state: "restricted",
    textFa: reasonFa ?? "مجوز خواندن منابع این ابزار را ندارید؛ هیچ عددی محاسبه نشد و صفر هم فرض نشد.",
    textEn: reasonEn ?? "You lack permission for this tool's sources; no number was computed and none was treated as zero.",
    facts: [],
    table: null,
    chart: null,
    sources: uses,
    limits: [
      b("برای دریافت این پاسخ، مجوز خواندن پایهٔ منبع داده لازم است؛ خودِ مجوز دستیار جای آن را نمی‌گیرد.", "Answering this needs the source's own base permission; the assistant's own permission never substitutes for it."),
    ],
  };
}

/** اجرای یک ابزار روی دادهٔ آمادهٔ مجاز. */
export function runTool(toolKey: AiToolKey, params: Record<string, unknown>, data: AiData, ctx: AiContext): AiSection {
  const def = toolByKey(toolKey);
  if (!def) throw new AiError("E-AI-TOOL", `ابزار «${String(toolKey)}» شناخته‌شده نیست`);
  if (toolKey !== "dataset_query" && def.sources.length > 0 && def.sources.every((key) => ctx.restricted.includes(key))) {
    return restrictedSection(def, ctx);
  }
  switch (toolKey) {
    case "top_risks":
      return computeTopRisks(params, data, ctx);
    case "delays":
      return computeDelays(params, data, ctx);
    case "forecast":
      return computeForecast(params, data, ctx);
    case "bottlenecks":
      return computeBottlenecks(params, data, ctx);
    case "dataset_query":
      return computeDatasetQuery(params, data, ctx);
    case "briefing":
      throw new AiError("E-AI-TOOL", "briefing از runBriefing ساخته می‌شود");
    default:
      throw new AiError("E-AI-TOOL", `ابزار «${String(toolKey)}» شناخته‌شده نیست`);
  }
}

/** خلاصهٔ چندبخشی (AI-2): هر بخش مستقل است و بخش بی‌مجوز «restricted» می‌آید. */
export function runBriefing(data: AiData, ctx: AiContext, can: (permission: string) => boolean): AiSection[] {
  const sections: AiSection[] = [];
  const wanted: { tool: AiToolKey; permission: string; params: Record<string, unknown> }[] = [
    { tool: "top_risks", permission: "rcc.risk.view", params: { limit: 5, status: "open" } },
    { tool: "delays", permission: "plan.schedule.view", params: { limit: 8, category: "all" } },
    { tool: "forecast", permission: "plan.schedule.view", params: {} },
    { tool: "bottlenecks", permission: "plan.schedule.view", params: { limit: 6 } },
  ];
  for (const w of wanted) {
    const def = toolByKey(w.tool)!;
    if (!can(w.permission)) {
      sections.push({
        key: w.tool,
        label: def.label,
        state: "restricted",
        textFa: "مجوز خواندن این بخش را ندارید؛ در این پاسخ محاسبه نشد و صفر هم فرض نشد.",
        textEn: "You lack permission for this section; it was neither computed nor treated as zero.",
        facts: [],
        table: null,
        chart: null,
        sources: def.sources.map((key) => {
          const s = sourceByKey(key)!;
          return { key, table: s.table, label: s.label, rows: 0, restricted: true };
        }),
        limits: [],
      });
      continue;
    }
    sections.push(runTool(w.tool, w.params, data, ctx));
  }
  return sections;
}

/* ═══════════════════════════ ۶. مسیریابی پرسش آزاد ═══════════════════════════ */

const normalizeText = (input: string): string =>
  input
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/[يﻯﻰ]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ـ]/g, "")
    .replace(/[\u060C،,؛;.!?؟:()"'«»\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const DATASET_HINTS: Record<string, { fa: string[]; en: string[] }> = {
  activities: { fa: ["فعالیت", "فعالیت ها", "فعالیتهای", "برنامه زمانی", "زمان بندی", "برنامه"], en: ["activity", "activities", "schedule"] },
  wbs: { fa: ["ساختار شکست", "wbs", "فاز", "گره"], en: ["wbs", "breakdown", "phase"] },
  documents: { fa: ["مدرک", "مدارک", "نقشه", "سند"], en: ["document", "documents", "drawing"] },
  proc_packages: { fa: ["بسته خرید", "بسته های خرید", "بستههای خرید", "پکیج"], en: ["procurement package", "package", "packages"] },
  purchase_orders: { fa: ["سفارش خرید", "سفارش های خرید", "سفارشهای خرید", "خرید", "سفارش"], en: ["purchase order", "purchase orders", "po"] },
  ipc_certificates: { fa: ["صورت وضعیت", "صورتوضعیت", "صورت وضعیت ها", "پرداخت موقت"], en: ["ipc", "payment certificate", "interim payment"] },
  dpr: { fa: ["گزارش روزانه", "گزارش های روزانه", "گزارشهای روزانه"], en: ["daily report", "daily reports", "dpr"] },
  inspections: { fa: ["بازرسی", "درخواست بازرسی", "rfi"], en: ["inspection", "inspections", "rfi"] },
  ncrs: { fa: ["عدم انطباق", "عدم انطباق ها", "عدم انطباقها", "ncr"], en: ["ncr", "non conformance", "nonconformance"] },
  risks: { fa: ["ریسک", "ریسک ها", "ریسکها"], en: ["risk", "risks"] },
  health: { fa: ["کارت سلامت", "سلامت پروژه"], en: ["health", "health card"] },
};

const COLUMN_HINTS: Record<string, string[]> = {
  Status: ["وضعیت", "status", "state"],
  Discipline: ["دیسیپلین", "رشته", "discipline"],
  Category: ["دسته", "دسته بندی", "category"],
  Severity: ["شدت", "severity"],
  ContractorCode: ["پیمانکار", "contractor"],
  Currency: ["ارز", "currency"],
  Shift: ["شیفت", "shift"],
  RequestType: ["نوع", "type", "kind"],
  Band: ["باند", "band"],
  Level: ["سطح", "level"],
  Owner: ["مسئول", "مالک", "owner"],
  TemplateCode: ["قالب", "template"],
  WorkAreaCode: ["حوزه کاری", "حوزهٔ کاری", "work area"],
  VendorName: ["فروشنده", "تامین کننده", "تأمین‌کننده", "vendor", "supplier"],
  Code: ["کد", "code"],
};
const GROUP_HINTS = ["به تفکیک", "بر اساس", "براساس", "بر حسب", "تفکیک", "group by", "grouped by", " by "];
const SUM_HINTS = ["جمع", "مجموع", "کل مبلغ", "ارزش کل", "sum", "total"];
const AVG_HINTS = ["میانگین", "متوسط", "average", "avg"];
const MAX_HINTS = ["حداکثر", "بیشترین", "بالاترین", "max", "maximum"];
const MIN_HINTS = ["حداقل", "کمترین", "پایین ترین", "min", "minimum"];

export type AiRoute =
  | { matched: true; tool: AiToolKey; params: Record<string, unknown>; matchedKeywords: string[]; dataset?: string }
  | { matched: false; reason: "no_match" | "restricted" | "empty_question"; suggestions: AiToolKey[]; dataset?: string; detailFa: string; detailEn: string };

export type AiRouteOptions = {
  /** ابزارهایی که کاربر مجاز است. */
  allowedTools?: readonly AiToolKey[];
  /** مجموعه‌داده‌هایی که کاربر مجاز است (برای dataset_query). */
  allowedDatasets?: readonly string[];
  lang?: AiLang;
};

function matchDataset(norm: string, allowed: readonly string[]): { key: string; keyword: string } | null {
  const candidates: { key: string; keyword: string }[] = [];
  for (const dataset of RB_DATASETS) {
    if (!allowed.includes(dataset.key)) continue;
    const hints = DATASET_HINTS[dataset.key];
    const words = [...(hints?.fa ?? []), ...(hints?.en ?? []), normalizeText(dataset.label.fa), normalizeText(dataset.label.en)];
    for (const w of words) {
      const kw = normalizeText(w);
      if (kw && norm.includes(kw)) candidates.push({ key: dataset.key, keyword: kw });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, x) => x.keyword.length - a.keyword.length);
  return candidates[0];
}

function detectColumn(datasetKey: string, norm: string, kinds: readonly string[]): string | null {
  const dataset = datasetByKey(datasetKey);
  if (!dataset) return null;
  let best: { name: string; len: number } | null = null;
  for (const col of dataset.columns) {
    if (!kinds.includes(col.kind)) continue;
    const words = [col.name, col.label.fa, col.label.en, ...(COLUMN_HINTS[col.name] ?? [])];
    for (const w of words) {
      const kw = normalizeText(w);
      if (kw && norm.includes(kw) && (!best || kw.length > best.len)) best = { name: col.name, len: kw.length };
    }
  }
  return best?.name ?? null;
}

/** مشخصات گزارش معادل پرسش زبانی را می‌سازد (بدون SQL، با همان موتور RPT-1). */
export function buildDatasetSpec(datasetKey: string, question: string): RbSpec {
  const dataset = datasetByKey(datasetKey);
  if (!dataset) throw new AiError("E-AI-DATASET", `مجموعه‌دادهٔ «${datasetKey}» شناخته‌شده نیست`);
  const norm = normalizeText(question);
  const wantsGroup = GROUP_HINTS.some((h) => norm.includes(normalizeText(h)));
  const fn = AVG_HINTS.some((h) => norm.includes(normalizeText(h)))
    ? "avg"
    : MAX_HINTS.some((h) => norm.includes(normalizeText(h)))
      ? "max"
      : MIN_HINTS.some((h) => norm.includes(normalizeText(h)))
        ? "min"
        : SUM_HINTS.some((h) => norm.includes(normalizeText(h)))
          ? "sum"
          : "count";
  const moneyColumn = dataset.columns.find((c) => c.kind === "money")?.name ?? null;
  const numericColumn = detectColumn(datasetKey, norm, ["number", "money"]);
  const measureColumn = numericColumn ?? moneyColumn;
  if (wantsGroup) {
    const by = detectColumn(datasetKey, norm, ["text", "enum", "bool"]) ?? detectColumn(datasetKey, norm, ["date"]) ?? (dataset.columns.some((c) => c.name === "Status") ? "Status" : dataset.columns.find((c) => c.kind === "text")?.name ?? null);
    if (by) {
      const aggs: { column: string; fn: string }[] = [{ column: by, fn: "count" }];
      if (fn !== "count" && measureColumn) aggs.push({ column: measureColumn, fn });
      return normalizeSpec({
        dataset: datasetKey,
        fields: [by],
        group: { by, aggs },
        sort: fn !== "count" && measureColumn ? [{ column: `${fn}:${measureColumn}`, dir: "desc" }] : [],
        limit: 20,
        chart: { kind: "bar", category: by, measure: fn !== "count" && measureColumn ? `${fn}:${measureColumn}` : `count:${by}` },
      });
    }
  }
  if (fn !== "count" && measureColumn) {
    const label = ["Code", "PoNo", "ReportNo", "DocNo", "RequestNo", "TemplateCode"].find((c) => dataset.columns.some((col) => col.name === c));
    return normalizeSpec({
      dataset: datasetKey,
      fields: label ? [label, measureColumn] : [measureColumn],
      sort: [{ column: measureColumn, dir: "desc" }],
      limit: 50,
    });
  }
  return normalizeSpec({ dataset: datasetKey, limit: 20 });
}

export function routeQuestion(question: string, opts: AiRouteOptions = {}): AiRoute {
  const raw = String(question ?? "").trim();
  if (!raw) return { matched: false, reason: "empty_question", suggestions: [], detailFa: "پرسش خالی است.", detailEn: "The question is empty." };
  if (raw.length > 500) return { matched: false, reason: "empty_question", suggestions: [], detailFa: "پرسش بیش از ۵۰۰ نویسه است.", detailEn: "The question exceeds 500 characters." };
  const norm = normalizeText(raw);
  const allowedInsight = (AI_TOOLS.filter((t) => t.kind === "insight").map((t) => t.key) as AiToolKey[]).filter((k) => !opts.allowedTools || opts.allowedTools.includes(k));
  const ranking: { key: AiToolKey; hits: string[]; score: number }[] = [];
  for (const tool of AI_TOOLS) {
    if (tool.key === "dataset_query") continue;
    const hits = tool.keywords.filter((k) => norm.includes(normalizeText(k)));
    if (hits.length) ranking.push({ key: tool.key, hits, score: hits.reduce((s, h) => s + normalizeText(h).length, 0) });
  }
  ranking.sort((a, x) => x.score - a.score);
  const topInsight = ranking[0];
  const datasetAllowed = opts.allowedDatasets ?? RB_DATASETS.map((d) => d.key);
  /* نخست هر مجموعه‌دادهٔ نام‌برده‌شده پیدا می‌شود — حتی بی‌مجوز — تا پاسخ
   * «مجوز ندارید» بدهد، نه «نمی‌دانم». سکوت دربارهٔ دادهٔ بسته، صفر انگاشتن
   * نیست ولی ابهام هم هست. */
  const mentioned = matchDataset(norm, RB_DATASETS.map((d) => d.key));
  const dataset = mentioned && datasetAllowed.includes(mentioned.key) ? mentioned : null;
  /* پرسش رتبه‌ای روی ریسک (بالاترین/بحرانی) بر فهرست خام ریسک اولویت دارد. */
  if (topInsight && topInsight.key !== "briefing" && topInsight.score >= 4) {
    const tool = toolByKey(topInsight.key)!;
    if (opts.allowedTools && !opts.allowedTools.includes(tool.key)) {
      return { matched: false, reason: "restricted", suggestions: allowedInsight, detailFa: `مجوز «${tool.label.fa}» را ندارید.`, detailEn: `You lack permission for ${tool.label.en}.` };
    }
    return { matched: true, tool: tool.key, params: normalizeToolParams(tool.key, {}), matchedKeywords: topInsight.hits };
  }
  const wantsDatasetQuery = Boolean(dataset) && (toolByKey("dataset_query")!.keywords.some((k) => norm.includes(normalizeText(k))) || GROUP_HINTS.some((h) => norm.includes(normalizeText(h))) || dataset!.key === "risks" || dataset!.key === "activities" || dataset!.key === "documents");
  const datasetToolAllowed = !opts.allowedTools || opts.allowedTools.includes("dataset_query");
  if (mentioned && !dataset && (GROUP_HINTS.some((h) => norm.includes(normalizeText(h))) || toolByKey("dataset_query")!.keywords.some((k) => norm.includes(normalizeText(k))) || mentioned.key === "risks" || mentioned.key === "activities" || mentioned.key === "documents")) {
    const def = datasetByKey(mentioned.key);
    return { matched: false, reason: "restricted", suggestions: allowedInsight, dataset: mentioned.key, detailFa: `مجوز خواندن مجموعه‌دادهٔ «${def?.label.fa ?? mentioned.key}» را ندارید؛ نه عددی ساخته شد و نه صفر فرض شد.`, detailEn: `You lack permission for dataset "${mentioned.key}"; no number was computed and none was treated as zero.` };
  }
  if (wantsDatasetQuery) {
    if (!datasetToolAllowed) {
      return { matched: false, reason: "restricted", suggestions: allowedInsight, dataset: dataset!.key, detailFa: "مجوز پرسش از داده‌ها را ندارید.", detailEn: "You lack permission to query datasets." };
    }
    return { matched: true, tool: "dataset_query", params: { spec: buildDatasetSpec(dataset!.key, raw) }, matchedKeywords: [dataset!.keyword], dataset: dataset!.key };
  }
  if (topInsight) {
    const tool = toolByKey(topInsight.key)!;
    if (opts.allowedTools && !opts.allowedTools.includes(tool.key)) {
      return { matched: false, reason: "restricted", suggestions: allowedInsight, detailFa: `مجوز «${tool.label.fa}» را ندارید.`, detailEn: `You lack permission for ${tool.label.en}.` };
    }
    return { matched: true, tool: tool.key, params: normalizeToolParams(tool.key, {}), matchedKeywords: topInsight.hits };
  }
  return {
    matched: false,
    reason: "no_match",
    suggestions: allowedInsight.length ? allowedInsight : (opts.allowedTools ?? []).slice(),
    detailFa: "این پرسش به هیچ ابزار شناخته‌شده‌ای نگاشت نشد؛ برای پرسش تازه، ابزار و پارامتر را دستی انتخاب کنید. پاسخ ساختگی ساخته نمی‌شود.",
    detailEn: "The question did not map to any known tool; choose a tool and parameters explicitly. No fake answer is produced.",
  };
}

export function toolCatalog(can: (permission: string) => boolean, lang: AiLang = "fa"): { key: AiToolKey; kind: string; label: Bi; hint: Bi; permission: string; allowed: boolean; examples: Bi[] }[] {
  return AI_TOOLS.map((t) => ({
    key: t.key,
    kind: t.kind,
    label: t.label,
    hint: t.hint,
    permission: t.permissions.join(" | "),
    allowed: t.permissions.some((p) => can(p)),
    examples: [...t.examples].slice(0, 2).map((e) => ({ fa: e.fa, en: lang === "fa" ? e.en : e.fa ? e.en : e.en })),
  }));
}

/* ═══════════════════════════ ۷. خروجی و بازنویسی ═══════════════════════════ */

const csvCell = (v: string | number | null): string => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** خروجی CSV از جدول یک پاسخ (بدون BOM؛ سرور اضافه می‌کند). */
export function sectionToCsv(section: AiSection): string {
  const lines: string[] = [];
  lines.push([csvCell(section.label.fa), csvCell(section.textFa.replace(/\n/g, " "))].join(","));
  if (section.table) {
    lines.push("");
    lines.push(section.table.columns.map((c) => csvCell(c.label.fa)).join(","));
    for (const row of section.table.rows) lines.push(row.map(csvCell).join(","));
    if (section.table.truncated) lines.push(csvCell("… (بریده)"));
  }
  lines.push("");
  lines.push(csvCell("منبع / Source"), csvCell("ردیف / Rows"));
  for (const s of section.sources) lines.push([csvCell(`${s.table}${s.restricted ? " (بسته/restricted)" : ""}`), csvCell(s.rows)].join(","));
  return lines.join("\n");
}

/** سند Markdown از یک پاسخ ذخیره‌شده (AI-3). */
export function sectionToMarkdown(payload: { question: string; section: AiSection; createdAt: string; actor: string; modelVersion: string; code?: string }): string {
  const { section } = payload;
  const out: string[] = [];
  out.push(`# ${section.label.fa}`);
  out.push("");
  out.push(`- کد / Code: ${payload.code ?? "—"}`);
  out.push(`- پرسش / Question: ${payload.question}`);
  out.push(`- زمان / At: ${payload.createdAt}`);
  out.push(`- کاربر / Actor: ${payload.actor}`);
  out.push(`- موتور / Engine: ${payload.modelVersion}`);
  out.push(`- وضعیت / State: ${section.state}`);
  out.push("");
  out.push("## پاسخ / Answer");
  out.push("");
  out.push(section.textFa);
  out.push("");
  if (section.facts.length) {
    out.push("## اعداد کلیدی / Key figures");
    out.push("");
    for (const f of section.facts) out.push(`- ${f.label.fa}: ${f.value === null ? "نامعلوم" : String(f.value)}`);
    out.push("");
  }
  if (section.table) {
    out.push("## جدول / Table");
    out.push("");
    out.push(`| ${section.table.columns.map((c) => c.label.fa).join(" | ")} |`);
    out.push(`| ${section.table.columns.map(() => "---").join(" | ")} |`);
    for (const row of section.table.rows) out.push(`| ${row.map((v) => (v === null ? "—" : String(v))).join(" | ")} |`);
    if (section.table.truncated) out.push("", "_جدول بریده شده است._");
    out.push("");
  }
  out.push("## منبع داده / Data sources");
  out.push("");
  for (const s of section.sources) out.push(`- ${s.table} — ${s.restricted ? "بسته (restricted)" : `${s.rows} ردیف`}`);
  out.push("");
  if (section.limits.length) {
    out.push("## محدودیت‌ها / Limits");
    out.push("");
    for (const l of section.limits) out.push(`- ${l.fa}`);
  }
  return out.join("\n");
}

/**
 * دستور بازنویسی متن پاسخ با سرویس هوش مصنوعی (اختیاری).
 * عدد فقط از همین متن می‌آید؛ مدل اجازهٔ تغییر، گردکردن یا افزودن عدد ندارد.
 */
export function narrationInstructions(): string {
  return [
    "تو دستیار گزارش‌دهی پروژه هستی و فقط «بازگوکننده»ی یافته‌های تأییدشده‌ای.",
    "قواعد الزامی:",
    "۱) هیچ عددی را تغییر نده، گرد نکن، حذف نکن و عدد تازه نساز.",
    "۲) اگر عددی با «نامعلوم»، «نابسنده» یا «بسته» علامت خورده، همان را حفظ کن.",
    "۳) کدها و نام‌ها را عیناً کپی کن.",
    "۴) حداکثر ۵ جمله فارسی روان بنویس؛ فهرست‌ها را به نثر کوتاه تبدیل کن.",
    "۵) هیچ توصیه‌ای خارج از متن نده و ادعای تازه‌ای اضافه نکن.",
  ].join("\n");
}

export function narrationInput(section: AiSection): string {
  return JSON.stringify({
    state: section.state,
    headline: section.label.fa,
    answerFa: section.textFa,
    facts: section.facts.map((f) => ({ label: f.label.fa, value: f.value })),
    sources: section.sources.map((s) => ({ table: s.table, rows: s.restricted ? "restricted" : s.rows })),
    limits: section.limits.map((l) => l.fa),
  });
}
