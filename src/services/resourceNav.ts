/**
 * نگاشت زیرماژول‌های سایدبار فرعی حوزهٔ «منابع» به مقصد نمایشی.
 *
 * - ماشین‌آلات و تجهیزات (d9): شناسهٔ زیرماژول ← تب EQM.
 * - منابع انسانی (d10): شناسهٔ زیرماژول ← تب HRM و، برای تب «برنامه‌ریزی»،
 *   نمای داخلی (OBS / برنامه و هیستوگرام / تجهیز نیرو). بدون نمای داخلی، هر سه
 *   زیرماژول p1 یک محتوا را نشان می‌دادند و کلیک روی دو تای آخر بی‌اثر بود.
 *
 * این فایل فقط منطق خالص دارد (بدون React) تا با `npm run build:resnav` در
 * آزمون‌های Node بررسی شود. شناسه‌ها باید با `src/data/framework.ts` هم‌خوان بمانند؛
 * `resourceNavReport()` همین هم‌خوانی را می‌سنجد.
 */

import { domains } from "../data/framework";
import type { HrmTab, HrmView } from "../components/WorkforceWorkspace";
import type { EqmTab } from "../components/MachineryWorkspace";

export const RESOURCE_DOMAIN_IDS = ["d9", "d10"] as const;

export type HrmTarget = { tab: HrmTab; view: HrmView };

export const D10_TARGET_BY_SUB: Record<string, HrmTarget> = {
  "d10-p1-s1": { tab: "planning", view: "obs" },
  "d10-p1-s2": { tab: "planning", view: "plan" },
  "d10-p1-s3": { tab: "planning", view: "mob" },
  "d10-p2-s1": { tab: "timesheet", view: "obs" },
  "d10-p3-s1": { tab: "productivity", view: "obs" },
  "d10-p4-s1": { tab: "crew", view: "obs" },
  "d10-p5-s1": { tab: "onboarding", view: "obs" },
  "d10-p6-s1": { tab: "analytics", view: "obs" },
};

export const D9_TAB_BY_SUB: Record<string, EqmTab> = {
  "d9-p1-s1": "fleet",
  "d9-p1-s2": "fleet",
  "d9-p2-s1": "meter",
  "d9-p3-s1": "rental",
  "d9-p4-s1": "maintenance",
  "d9-p4-s2": "maintenance",
  "d9-p4-s3": "maintenance",
  "d9-p5-s1": "productivity",
  "d9-p5-s2": "productivity",
  "d9-p5-s3": "productivity",
  "d9-p6-s1": "dispatch",
  "d9-p7-s1": "fuel",
  "d9-p8-s1": "parts",
};

/**
 * زیرماژول‌های d9 که در EQM هنوز قابلیت اختصاصی ندارند و به نزدیک‌ترین تب می‌روند.
 * سایدبار کنارشان نشان «پیاده‌سازی نشده» می‌گذارد و بالای تب پیام می‌آید.
 * تاکسونومی/اسکن، RCA و OEE با CMMS هم‌پوشان‌اند (CMMS مستقل و اختیاری است)؛
 * TCO کار خود EQM است و رابطش هنوز ساخته نشده.
 */
export const D9_NOT_IMPLEMENTED_SUBS: ReadonlySet<string> = new Set([
  "d9-p1-s2", // تاکسونومی ISO 14224 و شناسهٔ اسکن
  "d9-p4-s3", // تحلیل ریشه‌ای خرابی
  "d9-p5-s2", // تابلوی هشت شاخص و OEE
  "d9-p5-s3", // TCO و خرید در برابر اجاره
]);

export function isNotImplementedSub(subId?: string): boolean {
  return Boolean(subId) && D9_NOT_IMPLEMENTED_SUBS.has(subId as string);
}

const DEFAULT_HRM_TARGET: HrmTarget = { tab: "planning", view: "obs" };

/** مقصد HRM برای یک زیرماژول؛ ناشناخته یا خالی → برنامه‌ریزی / چارت سازمانی. */
export function hrmTargetForSub(subId?: string): HrmTarget {
  return (subId && D10_TARGET_BY_SUB[subId]) || DEFAULT_HRM_TARGET;
}

/** تب EQM برای یک زیرماژول؛ ناشناخته یا خالی → ناوگان. */
export function eqmTabForSub(subId?: string): EqmTab {
  return (subId && D9_TAB_BY_SUB[subId]) || "fleet";
}

export type ResourceNavReport = {
  /** زیرماژول‌هایی که در framework هستند ولی نگاشت ندارند. */
  unmapped: string[];
  /** نگاشت‌هایی که شناسه‌شان دیگر در framework نیست. */
  orphaned: string[];
  /** زیرماژول‌های HRM که دقیقاً به همان {تب، نما}ی زیرماژول دیگری می‌رسند. */
  hrmDuplicates: string[];
  /** شناسه‌های فهرست «پیاده‌سازی نشده» که در framework نیستند یا نگاشت تب ندارند. */
  badNotImplemented: string[];
};

/** هم‌خوانی نگاشت‌ها با فهرست زیرماژول‌های framework (d9 و d10). */
export function resourceNavReport(): ResourceNavReport {
  const unmapped: string[] = [];
  const known = new Set<string>();
  const seen = new Map<string, string>();
  const hrmDuplicates: string[] = [];
  for (const id of RESOURCE_DOMAIN_IDS) {
    const dom = domains.find((d) => d.id === id);
    for (const p of dom?.processes ?? []) {
      for (const s of p.subs) {
        known.add(s.id);
        const mapped = id === "d9" ? D9_TAB_BY_SUB[s.id] : D10_TARGET_BY_SUB[s.id];
        if (!mapped) unmapped.push(s.id);
        if (id === "d10" && mapped) {
          const key = JSON.stringify(mapped);
          const prev = seen.get(key);
          if (prev) hrmDuplicates.push(`${prev} = ${s.id}`);
          else seen.set(key, s.id);
        }
      }
    }
  }
  const orphaned = [...Object.keys(D9_TAB_BY_SUB), ...Object.keys(D10_TARGET_BY_SUB)].filter((k) => !known.has(k));
  const badNotImplemented = [...D9_NOT_IMPLEMENTED_SUBS].filter((id) => !known.has(id) || !D9_TAB_BY_SUB[id]);
  return { unmapped, orphaned, hrmDuplicates, badNotImplemented };
}
