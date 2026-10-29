/**
 * ناوبری شش تب «تأمین و لجستیک» ورک‌اسپیس d5 (`CostSupplyWorkspace`).
 *
 * این تب‌ها (فروشندگان/AVL، بسته‌های خرید، مناقصه، رسید/OPI، انبار، تغییرات MR)
 * کامل ساخته شده و به API وصل‌اند، اما در `framework.ts` فرایند `d5-p10…p15`
 * تعریف نشده بود و نوار تب‌ها هم در صفحهٔ ماژول پنهان است؛ پس از سایدبار هیچ راهی
 * به آن‌ها نبود. این فایل همان فرایندها را فقط برای سایدبار صفحهٔ d5 اضافه می‌کند
 * (بدون ویرایش `framework.ts`)، مثل `D5_PAGE_SUBS` در `ModuleDetail.tsx`.
 *
 * شناسهٔ فرایندها با فیلد `proc` در `TABS` همان کامپوننت یکی است.
 * منطق خالص است و با `npm run build:csnav` در آزمون‌های Node بررسی می‌شود.
 */

import { domains } from "../data/framework";
import type { Bi, Process } from "../data/framework";
import type { FinTab } from "../components/CostSupplyWorkspace";

export type D5ScmSection = "procurement" | "logistics";

type ScmNavEntry = {
  section: D5ScmSection;
  tab: FinTab;
  processId: string;
  processTitle: Bi;
  subId: string;
  subTitle: Bi;
};

export const D5_SCM_NAV: readonly ScmNavEntry[] = [
  { section: "procurement", tab: "scm-vendors", processId: "d5-p10", subId: "d5-p10-s1",
    processTitle: { fa: "فروشندگان و فهرست مجاز (AVL)", en: "Vendors & AVL" },
    subTitle: { fa: "ثبت فروشنده و فهرست فروشندگان مجاز", en: "Vendor register & approved vendor list" } },
  { section: "procurement", tab: "scm-packages", processId: "d5-p11", subId: "d5-p11-s1",
    processTitle: { fa: "بسته‌های خرید", en: "Procurement Packages" },
    subTitle: { fa: "بسته‌های خرید، KOM/PIM و پیشرفت PSR", en: "Packages, KOM/PIM & PSR progress" } },
  { section: "procurement", tab: "scm-tender", processId: "d5-p12", subId: "d5-p12-s1",
    processTitle: { fa: "مناقصه و استعلام", en: "Tender & RFQ" },
    subTitle: { fa: "استعلام، مناقصه، ارزیابی و صدور PO", en: "RFQ, tender, evaluation & PO issue" } },
  { section: "logistics", tab: "scm-receiving", processId: "d5-p13", subId: "d5-p13-s1",
    processTitle: { fa: "رسید و بازرسی (OPI)", en: "Receiving & OPI" },
    subTitle: { fa: "رسید مواد، بازرسی، حمل و ترخیص", en: "Material receipt, inspection, shipment & customs" } },
  { section: "logistics", tab: "scm-warehouse", processId: "d5-p15", subId: "d5-p15-s1",
    processTitle: { fa: "انبار و موجودی", en: "Warehouse & Stock" },
    subTitle: { fa: "انبارها، کاتالوگ، حواله و انتقال", en: "Warehouses, catalog, issues & transfers" } },
  { section: "logistics", tab: "scm-mrlog", processId: "d5-p14", subId: "d5-p14-s1",
    processTitle: { fa: "تغییرات درخواست مواد (MR)", en: "MR Changes" },
    subTitle: { fa: "اعلان و پیگیری تغییرات MR", en: "MR change notices" } },
];

/** نگاشت شناسهٔ زیرماژول ← تب برای ردیف‌های افزوده. */
export const D5_SCM_TAB_BY_SUB: Record<string, FinTab> = Object.fromEntries(
  D5_SCM_NAV.map((e) => [e.subId, e.tab]),
);

/** فرایندهای افزودهٔ یک بخش سایدبار (هر فرایند یک زیرماژول دارد). */
export function d5ScmProcesses(section: string): Process[] {
  return D5_SCM_NAV.filter((e) => e.section === section).map((e) => ({
    id: e.processId,
    title: e.processTitle,
    subs: [{
      id: e.subId,
      title: e.subTitle,
      activity: e.subTitle,
      source: "SCM",
      sql: [],
      output: "",
      connectsTo: "",
      ai: "",
    }],
  }));
}

/* ───────────── نگاشت‌های d5 (پیش‌تر در ModuleDetail.tsx) ───────────── */

/** Extra submodules only on the d5 inner page — main sidebar untouched. */
export const D5_PAGE_SUBS: Record<string, { id: string; title: Bi; tab: FinTab; sql: string[] }[]> = {
  "d5-p1": [
    { id: "d5-p1-cbs", title: { fa: "ساختار شکست هزینه و PMB", en: "CBS & PMB" }, tab: "cost", sql: ["fin_cbs_node", "fin_pmb_period"] },
    { id: "d5-p1-res", title: { fa: "ذخیره احتیاطی و اختیار برداشت", en: "Reserve & DoA" }, tab: "cost", sql: ["fin_reserve_ledger"] },
  ],
  "d5-p2": [
    { id: "d5-p2-evm", title: { fa: "EVM و پنج روش EAC", en: "EVM & five EACs" }, tab: "control", sql: ["fin_evm_snapshot"] },
    { id: "d5-p2-snap", title: { fa: "Snapshot تغییرناپذیر و نسخه فرمول", en: "Immutable snapshots" }, tab: "control", sql: ["fin_evm_snapshot"] },
  ],
  "d5-p3": [
    { id: "d5-p3-age", title: { fa: "سن مطالبات و سرمایه در گردش", en: "AR aging & working capital" }, tab: "cash", sql: ["fin_receivable", "fin_payable"] },
    { id: "d5-p3-ipc", title: { fa: "صورت‌وضعیت و کسورات", en: "Progress invoice" }, tab: "cash", sql: ["fin_progress_invoice"] },
  ],
  "d5-p4": [
    { id: "d5-p4-mrp", title: { fa: "پیشنهاد تجدید سفارش و تاریخ نیاز کالا", en: "Reorder suggestions & material need date" }, tab: "pr", sql: ["fin_mrp_run"] },
    { id: "d5-p4-bud", title: { fa: "کنترل بودجه و مسیر تأیید", en: "Budget check & approval route" }, tab: "pr", sql: ["fin_pr_line"] },
  ],
  "d5-p5": [
    { id: "d5-p5-com", title: { fa: "زنجیره تعهد و عملکرد تأمین‌کننده", en: "Commitment & vendor scoring" }, tab: "po", sql: ["fin_commitment", "fin_vendor_score"] },
    { id: "d5-p5-3wm", title: { fa: "تطابق سه‌جانبه پیش از پرداخت", en: "3-way match gate" }, tab: "po", sql: ["fin_invoice_match"] },
  ],
  "d5-p6": [
    { id: "d5-p6-rop", title: { fa: "نقطه سفارش، EOQ و طبقه‌بندی ABC", en: "ROP, EOQ & ABC" }, tab: "inventory", sql: ["fin_stock_balance"] },
    { id: "d5-p6-trc", title: { fa: "ردیابی بچ و گردش انبار", en: "Batch traceability & flow" }, tab: "inventory", sql: ["fin_grn", "fin_issuance"] },
  ],
};

export const D5_TAB_BY_SUB: Record<string, FinTab> = {
  "d5-p1-s1": "cost",
  "d5-p1-cbs": "cost",
  "d5-p1-res": "cost",
  "d5-p2-s1": "control",
  "d5-p2-evm": "control",
  "d5-p2-snap": "control",
  "d5-p3-s1": "cash",
  "d5-p3-age": "cash",
  "d5-p3-ipc": "cash",
  "d5-p4-s1": "pr",
  "d5-p4-mrp": "pr",
  "d5-p4-bud": "pr",
  "d5-p5-s1": "po",
  "d5-p5-com": "po",
  "d5-p5-3wm": "po",
  "d5-p6-s1": "inventory",
  "d5-p6-rop": "inventory",
  "d5-p6-trc": "inventory",
  "d5-p7-s1": "quantities",
  "d5-p7-s2": "quantities",
  "d5-p8-s1": "balance",
  "d5-p8-s2": "balance",
  "d5-p9-s1": "pnl",
  "d5-p9-s2": "pnl",
};

/**
 * زیرماژول‌های دومِ p7 تا p9 که محتوای جدا دارند (نمای «detail» همان پنل).
 * بقیهٔ زیرماژول‌ها نمای «main» را نشان می‌دهند.
 */
export const D5_DETAIL_VIEW_SUBS: readonly string[] = ["d5-p7-s2", "d5-p8-s2", "d5-p9-s2"];

export function d5ViewForSub(subId?: string): "main" | "detail" {
  return subId && D5_DETAIL_VIEW_SUBS.includes(subId) ? "detail" : "main";
}

/** مقصد تب برای هر زیرماژول d5، شامل ردیف‌های رسمی، افزوده و تأمین/لجستیک. */
export function d5TabForSub(subId?: string): FinTab | undefined {
  if (!subId) return undefined;
  return D5_TAB_BY_SUB[subId] ?? D5_SCM_TAB_BY_SUB[subId];
}

/**
 * بخشِ داخل تب که هر زیرماژول باید به آن برسد. `top` یعنی ابتدای تب.
 * شناسه‌ها با `anchor` روی `<Section>` در CostSupplyWorkspace.tsx یکی‌اند.
 * تب‌های مستقل (p7 تا p9) و تأمین/لجستیک تک‌صفحه‌ای‌اند و به ابتدای تب می‌روند.
 */
export const D5_SECTION_BY_SUB: Record<string, string> = {
  "d5-p1-s1": "top",
  "d5-p1-cbs": "cbs",
  "d5-p1-res": "reserve",
  "d5-p2-s1": "actuals",
  "d5-p2-evm": "eac",
  "d5-p2-snap": "snapshots",
  "d5-p3-s1": "cash-curve",
  "d5-p3-age": "ar-aging",
  "d5-p3-ipc": "ipc-calc",
  "d5-p4-s1": "top",
  "d5-p4-mrp": "reorder",
  "d5-p4-bud": "budget-check",
  "d5-p5-s1": "top",
  "d5-p5-com": "commitment",
  "d5-p5-3wm": "match3",
  "d5-p6-s1": "inventory-control",
  "d5-p6-rop": "inventory-control",
  "d5-p6-trc": "warehouse-flow",
};

/** بخش مقصد؛ زیرماژولِ بی‌بخش (p7 تا p9، تأمین/لجستیک) → ابتدای تب. */
export function d5SectionForSub(subId?: string): string | undefined {
  if (!subId) return undefined;
  return D5_SECTION_BY_SUB[subId] ?? (d5TabForSub(subId) ? "top" : undefined);
}

/** همهٔ شناسه‌های بخش (به‌جز top) که باید روی <Section anchor> باشند. */
export const D5_SECTION_ANCHORS: readonly string[] = [
  ...new Set(Object.values(D5_SECTION_BY_SUB).filter((a) => a !== "top")),
];

export type CostSupplyNavReport = {
  /** شناسه‌های تکراری میان خود ردیف‌ها. */
  duplicateIds: string[];
  /** شناسه‌هایی که با فرایند/زیرماژول رسمی d5 در framework برخورد دارند. */
  collisions: string[];
  /** تب‌های scm-* که هیچ ردیفی ندارند (باید خالی باشد). */
  uncoveredScmTabs: string[];
  /** زیرماژول‌های d5 (رسمی + افزوده + تأمین/لجستیک) بدون نگاشت تب. */
  noTab: string[];
  /** همان‌ها بدون بخش مقصد. */
  noSection: string[];
  /** زیرماژول‌هایی که فقط در D5_SECTION_BY_SUB هستند و هیچ جا تعریف نشده‌اند. */
  orphanSections: string[];
};

export const SCM_TAB_IDS: readonly FinTab[] = [
  "scm-vendors", "scm-packages", "scm-tender", "scm-receiving", "scm-warehouse", "scm-mrlog",
];

export function costSupplyNavReport(): CostSupplyNavReport {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  for (const e of D5_SCM_NAV) {
    for (const id of [e.processId, e.subId]) {
      if (seen.has(id)) duplicateIds.push(id);
      seen.add(id);
    }
  }
  const d5 = domains.find((d) => d.id === "d5");
  const official = new Set<string>();
  for (const p of d5?.processes ?? []) {
    official.add(p.id);
    for (const s of p.subs) official.add(s.id);
  }
  const collisions = [...seen].filter((id) => official.has(id));
  const covered = new Set(D5_SCM_NAV.map((e) => e.tab));
  const uncoveredScmTabs = SCM_TAB_IDS.filter((t) => !covered.has(t));
  const allSubs = new Set<string>();
  for (const p of d5?.processes ?? []) for (const sub of p.subs) allSubs.add(sub.id);
  for (const list of Object.values(D5_PAGE_SUBS)) for (const sub of list) allSubs.add(sub.id);
  for (const e of D5_SCM_NAV) allSubs.add(e.subId);
  const noTab = [...allSubs].filter((id) => !d5TabForSub(id));
  const noSection = [...allSubs].filter((id) => !d5SectionForSub(id));
  const orphanSections = Object.keys(D5_SECTION_BY_SUB).filter((id) => !allSubs.has(id));
  return { duplicateIds, collisions, uncoveredScmTabs, noTab, noSection, orphanSections };
}
