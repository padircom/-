/**
 * درخواست JSON مشترک کلاینت‌های REST میز کارها (d5، d11، …).
 * مسیر همیشه نسبی (`/api/...`) است تا از پراکسی Vite عبور کند؛ هرگز localhost.
 * پاسخ خطا به پیام فارسی سرور تبدیل می‌شود تا کاربر دلیل واقعی را ببیند.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

export async function jsonRequest<T>(url: string, userId: string | null, method: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(userId ? { "x-user-id": userId } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return { ok: false, status: res.status, code: "E-API-NO-JSON", message: "پاسخ سرور قابل خواندن نیست (سرور API در دسترس است؟)" };
    }
    const json = await res.json();
    if (json?.ok) return { ok: true, data: json.data as T };
    const { code, message, ...details } = json?.error ?? {};
    return { ok: false, status: res.status, code: code ?? "E-API-UNKNOWN", message: message ?? "خطای ناشناخته", details };
  } catch {
    return { ok: false, status: 0, code: "E-API-NETWORK", message: "اتصال به سرور برقرار نشد" };
  }
}
