/** دامنهٔ شمول فرمت گزارش روزانهٔ dprt-v1.
 *
 * به دستور کاربر (۱۴۰۵/۰۷/۰۸): فرمت کامل (کاور + باکس پشتیبان) فقط در
 * «خوشهٔ زیرساخت و ساختمان» و فقط در «پروژه‌های راهسازی» آن کاربرد دارد.
 * در خوشه‌های نفت و گاز (c1)، پتروشیمی (c2) و حفاری و اکتشاف (c4) فقط
 * «باکس پشتیبان گزارش روزانه» (همان ۶ تب، بدون کاور) نمایش داده می‌شود.
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

/** خوشه‌هایی که فقط «باکس پشتیبان گزارش روزانه» (بدون کاور فرمت) را می‌گیرند. */
export const DPR_SUPPORT_BOX_CLUSTERS: ReadonlySet<string> = new Set([
  "c1", // نفت و گاز
  "c2", // پتروشیمی
  "c4", // حفاری و اکتشاف
]);

/** آیا فقط باکس پشتیبان (بدون کاور) نمایش داده شود؟ (پیش‌فرض بسته) */
export function isDprSupportBoxActive(clusterId: string | undefined): boolean {
  if (!clusterId) return false;
  return DPR_SUPPORT_BOX_CLUSTERS.has(clusterId);
}
