/**
 * هویت کاربر جاری برای لایهٔ سرویس (بدون وابستگی به React).
 *
 * چرا جدا از `AuthContext`؟ چون `AuthContext` یک ماژول React است و
 * `pmisApiClient` (لایهٔ فراخوانی REST) نباید برای خواندن یک شناسه، React را
 * وارد زنجیرهٔ import خود کند. هر دو از همین یک کلید می‌خوانند تا «کاربر
 * واردشده در رابط کاربری» و «هدر `x-user-id` درخواست‌ها» همیشه یکی باشند.
 */
export const AUTH_USER_STORE = "pmis:auth-user:v1";

/** شناسهٔ کاربر واردشده، یا `null` اگر کسی وارد نشده باشد. */
export function currentUserId(): string | null {
  try {
    return localStorage.getItem(AUTH_USER_STORE);
  } catch {
    return null;
  }
}
