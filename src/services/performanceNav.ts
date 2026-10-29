/**
 * ناوبری ماژول «عملکرد پروژه» (d3 — پایش و کنترل). منبع یکتای نگاشت زیرماژول ← تب.
 *
 * پیش‌تر دو نسخهٔ جدا و ناهم‌خوان داشت: `D3_TAB_BY_SUB` در ModuleDetail و `SUB` در
 * MonitoringWorkspace. حالا هر دو از همین فایل می‌خوانند. بدون ویرایش `framework.ts`.
 *
 * قاعده: هر تب پایش فقط از یک ردیفِ دیدنیِ سایدبار باز می‌شود. دو ردیفی که پیش‌تر
 * هم‌نام یک تب بودند ادغام شدند و شناسه‌شان فقط برای لینک‌های قدیمی در نگاشت ماند.
 * منطق خالص است و با `npm run build:perfnav` در آزمون‌های Node بررسی می‌شود.
 */

import { domains } from "../data/framework";
import type { Bi } from "../data/framework";
import type { MonitorTab } from "../components/MonitoringWorkspace";

export type PerfSub = { id: string; title: Bi; tab: MonitorTab; sql: string[] };

/** ردیف‌های افزوده فقط روی صفحهٔ d3 (سایدبار اصلی دست‌نخورده). */
export const D3_PAGE_SUBS: Record<string, PerfSub[]> = {
  "d3-p1": [
    { id: "d3-p1-phi", title: { fa: "شاخص سلامت PHI", en: "PHI Health" }, tab: "phi", sql: ["pma_health_snapshot"] },
  ],
  "d3-p2": [
    { id: "d3-p2-wpd", title: { fa: "برداشت WPD", en: "WPD Harvester" }, tab: "wpd", sql: ["pma_wpd"] },
    { id: "d3-p2-fc", title: { fa: "پیش‌بینی ثبت‌شده", en: "Stored forecast" }, tab: "forecast", sql: ["pma_forecast"] },
    { id: "d3-p2-trend", title: { fa: "روند تصاویر EVM", en: "EVM snapshot trend" }, tab: "scurve", sql: ["EvmSnapshot"] },
  ],
  "d3-p6": [
    /* داشبورد مدیر پروژه از حوزهٔ برنامه‌ریزی به اینجا منتقل شد: کاری که می‌کند
     * گزارش وضعیت است نه ساختن زمان‌بندی. */
    { id: "d3-p6-dash", title: { fa: "داشبورد مدیر پروژه", en: "PM Dashboard" }, tab: "dash", sql: ["pma_dash_config"] },
    { id: "d3-p6-14", title: { fa: "خروجی داخلی گزارش", en: "Internal export" }, tab: "reports", sql: ["pma_report_def"] },
    { id: "d3-p6-builder", title: { fa: "گزارش‌ساز سفارشی", en: "Custom report builder" }, tab: "builder", sql: [] },
    { id: "d3-p6-drill", title: { fa: "پیمایش سلسله‌مراتبی", en: "Hierarchical drill-down" }, tab: "drill", sql: [] },
    { id: "d3-p6-ai", title: { fa: "دستیار هوشمند", en: "AI assistant" }, tab: "ai", sql: [] },
  ],
};

/**
 * شناسه‌هایی که دیگر ردیف سایدبار ندارند (با ردیف دیگری ادغام شدند)، ولی لینک
 * قدیمی‌شان هنوز باید به همان تب برسد.
 */
export const D3_ALIAS_SUBS: Record<string, string> = {
  "d3-p4-ews": "d3-p4-s1", // «EWS سه لایه»: لایه‌ای جدا نداشت؛ همان تب هشدار
  "d3-p6-exec": "d3-p6-s1", // «گزارش یک‌صفحه EXEC»: همان خلاصهٔ مدیریتی
};

/** نگاشت زیرماژولِ دیدنی ← تب. */
export const D3_TAB_BY_SUB: Record<string, MonitorTab> = {
  "d3-p1-s1": "kpi",
  "d3-p2-s1": "evm",
  "d3-p3-s1": "var",
  "d3-p4-s1": "ews",
  "d3-p5-s1": "action",
  /* گزارش مدیریتی زنده = ادغام KPI/EVM/هشدار؛ همان تب خلاصهٔ مدیریتی. */
  "d3-p6-s1": "exec",
  ...Object.fromEntries(Object.values(D3_PAGE_SUBS).flat().map((s) => [s.id, s.tab])),
  /* لینک‌های قدیمی. */
  "d3-p4-ews": "ews",
  "d3-p6-exec": "exec",
};

export function d3TabForSub(subId?: string): MonitorTab | undefined {
  return subId ? D3_TAB_BY_SUB[subId] : undefined;
}

/* ───────────── دامنهٔ واقعی هر زیرماژول ───────────── */

export type ScopeLevel = "missing" | "limited";
export type ScopeNote = { level: ScopeLevel; fa: string; en: string };

/**
 * زیرماژول‌هایی که کمتر از نامشان کار می‌کنند. «missing» = هیچ مدلی ندارد؛
 * «limited» = بخشی از آنچه نامش می‌گوید ساخته شده. متن همان چیزی است که صفحه
 * واقعاً نشان می‌دهد.
 */
export const D3_SCOPE_NOTES: Record<string, ScopeNote> = {
  "d3-p1-s1": {
    level: "limited",
    fa: "شاخص‌ها در این نسخه از دو جنس‌اند: شاخص‌های EVM (SPI، CPI، SV، CV) از تصویر انتخاب‌شده، و شمارش عملیاتی ده منبع. شاخص‌ساز سفارشی (KPI_Master / KPI_Value) در این نسخه پیاده‌سازی نشده است.",
    en: "Indicators here are EVM indices (SPI, CPI, SV, CV) from the selected snapshot plus operational counts of ten sources. A custom KPI builder (KPI_Master / KPI_Value) is not implemented in this release.",
  },
  "d3-p3-s1": {
    level: "limited",
    fa: "تحلیل انحراف در این نسخه جدول روند SV/CV/SPI/CPI از تصاویر EVM ثبت‌شده است. تحلیل ریشه‌ای و ثبت انحراف (Variance_Log) در این نسخه پیاده‌سازی نشده است.",
    en: "Variance analysis here is the SV/CV/SPI/CPI trend table from stored EVM snapshots. Root-cause analysis and a variance log (Variance_Log) are not implemented in this release.",
  },
  "d3-p5-s1": {
    level: "limited",
    fa: "این نما فقط‌خواندنی است: فعالیت‌های افق پیش‌نگر و مصوبات باز جلسه. ساخت و ویرایش اکشن‌پلن ۱ / ۲ / ۳ ماهه (Action_Plan / Action_Item) در این نسخه پیاده‌سازی نشده است.",
    en: "Read-only view of activities in the lookahead horizon and open meeting actions. Creating or editing 1/2/3-month action plans (Action_Plan / Action_Item) is not implemented in this release.",
  },
  "d3-p1-phi": {
    level: "missing",
    fa: "مدل سلامت PHI در این نسخه پیاده‌سازی نشده است؛ هیچ امتیاز ترکیبی ساختگی نمایش داده نمی‌شود.",
    en: "The PHI health model is not implemented in this release; no synthetic composite score is shown.",
  },
  "d3-p2-fc": {
    level: "limited",
    fa: "فقط EAC ثبت‌شده در تصویر EVM نمایش داده می‌شود (ETC = EAC − AC، VAC = BAC − EAC). مدل پیش‌بینی در این نسخه پیاده‌سازی نشده است.",
    en: "Only the EAC stored in the EVM snapshot is shown (ETC = EAC − AC, VAC = BAC − EAC). A forecast model is not implemented in this release.",
  },
};

export function d3ScopeNote(subId?: string): ScopeNote | undefined {
  return subId ? D3_SCOPE_NOTES[subId] : undefined;
}

/* ───────────── گزارش هم‌خوانی (برای آزمون) ───────────── */

export type PerformanceNavReport = {
  /** زیرماژول‌های دیدنی بدون تب. */
  noTab: string[];
  /** تب‌هایی که دو ردیف دیدنی یا بیشتر دارند: tab → شناسه‌ها. */
  sharedTabs: Record<string, string[]>;
  /** شناسه‌های نگاشت که نه دیدنی‌اند، نه مستعار. */
  orphans: string[];
  /** مستعارهایی که مقصدشان دیدنی نیست یا تبش فرق می‌کند. */
  badAliases: string[];
  /** یادداشت دامنه برای شناسهٔ ناشناخته. */
  badNotes: string[];
  visible: string[];
};

export function performanceNavReport(): PerformanceNavReport {
  const d3 = domains.find((d) => d.id === "d3");
  const official = (d3?.processes ?? []).flatMap((p) => p.subs.map((s) => s.id));
  const extra = Object.values(D3_PAGE_SUBS).flat().map((s) => s.id);
  const visible = [...official, ...extra];
  const noTab = visible.filter((id) => !D3_TAB_BY_SUB[id]);
  const byTab: Record<string, string[]> = {};
  for (const id of visible) (byTab[D3_TAB_BY_SUB[id]] ??= []).push(id);
  const sharedTabs = Object.fromEntries(Object.entries(byTab).filter(([, ids]) => ids.length > 1));
  const known = new Set([...visible, ...Object.keys(D3_ALIAS_SUBS)]);
  const orphans = Object.keys(D3_TAB_BY_SUB).filter((id) => !known.has(id));
  const badAliases = Object.entries(D3_ALIAS_SUBS)
    .filter(([alias, target]) => !visible.includes(target) || D3_TAB_BY_SUB[alias] !== D3_TAB_BY_SUB[target])
    .map(([alias]) => alias);
  const badNotes = Object.keys(D3_SCOPE_NOTES).filter((id) => !visible.includes(id));
  return { noTab, sharedTabs, orphans, badAliases, badNotes, visible };
}
