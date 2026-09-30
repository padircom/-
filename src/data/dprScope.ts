/** دامنهٔ شمول فرمت گزارش روزانهٔ dprt-v1 (کاور + ۶ تب جداول پشتیبان).
 *
 * به دستور کاربر (۱۴۰۵/۰۷/۰۸): این فرمت فقط در «خوشهٔ زیرساخت و ساختمان»
 * و فقط در «پروژه‌های راهسازی» آن کاربرد دارد و در هیچ خوشهٔ دیگری نباید
 * فراخوانی شود.
 *
 * چون مدل `Project` فیلد نوع/رشته ندارد، پروژه‌های راهسازی صراحتاً فهرست
 * شده‌اند. برای افزودن یا حذف یک پروژه، فقط همین مجموعه را ویرایش کنید —
 * همهٔ نقاط فراخوانی از `isDprFormatActive` تبعیت می‌کنند.
 */
export const DPR_CLUSTER_ID = "c5";

/** شناسهٔ پروژه‌های راهسازی خوشهٔ زیرساخت (فهرست صریح، قابل ویرایش). */
export const DPR_ROAD_PROJECT_IDS: ReadonlySet<string> = new Set([
  "c5-p1", // آزادراه تهران–شمال، قطعه ۲
  "c5-p6", // پل کابلی خلیج فارس (کارفرما: وزارت راه)
]);

/** آیا فرمت گزارش روزانه در این دامنه فعال است؟ (پیش‌فرض بسته: نامشخص = غیرفعال) */
export function isDprFormatActive(clusterId: string | undefined, projectId: string | undefined): boolean {
  if (!clusterId || !projectId) return false;
  return clusterId === DPR_CLUSTER_ID && DPR_ROAD_PROJECT_IDS.has(projectId);
}
