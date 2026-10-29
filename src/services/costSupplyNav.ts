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

export type CostSupplyNavReport = {
  /** شناسه‌های تکراری میان خود ردیف‌ها. */
  duplicateIds: string[];
  /** شناسه‌هایی که با فرایند/زیرماژول رسمی d5 در framework برخورد دارند. */
  collisions: string[];
  /** تب‌های scm-* که هیچ ردیفی ندارند (باید خالی باشد). */
  uncoveredScmTabs: string[];
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
  return { duplicateIds, collisions, uncoveredScmTabs };
}
