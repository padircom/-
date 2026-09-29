import type { Bi } from "../data/framework";

export const HEALTH_POLL_MS = 30_000;
export const HEALTH_TIMEOUT_MS = 8_000;
export const HEALTH_MAX_AGE_MS = 60_000;

export type HealthReason =
  | "loading" | "connected" | "disconnected" | "unconfigured" | "file-import"
  | "unverified" | "missing" | "stale" | "offline" | "signed-out"
  | "unauthorized" | "forbidden" | "network" | "timeout" | "unavailable" | "malformed";
export type SourceHealth = {
  status: "loading" | "connected" | "disconnected" | "unknown";
  reason: HealthReason;
  checkedAt: number | null;
  latencyMs: number | null;
};
export type HealthSnapshot = {
  owner: string | null;
  receivedAt: number;
  items: Record<string, Record<string, unknown>>;
  error?: HealthReason;
};

export const healthMessages: Record<HealthReason, Bi> = {
  loading: { fa: "در حال دریافت وضعیت اتصال از سرور…", en: "Retrieving connection status from the server…" },
  connected: { fa: "سرور وضعیت اتصال را در بررسی اخیر تأیید کرده است.", en: "The server confirmed this connection in its latest health check." },
  disconnected: { fa: "سرور قطع ارتباط را گزارش کرده است؛ تنظیمات اتصال و دسترسی منبع را بررسی کنید.", en: "The server reports a disconnected source. Check its connection settings and access." },
  unconfigured: { fa: "اتصال این منبع تنظیم نشده است؛ تنظیمات یکپارچه‌سازی را در مدیریت سامانه بررسی کنید.", en: "This source is not configured. Check integration settings in System Administration." },
  "file-import": { fa: "این منبع از طریق ورود فایل کار می‌کند؛ آماده بودن ورود فایل به معنی اتصال زنده نیست.", en: "This source uses file import. File-import availability is not a live connection." },
  unverified: { fa: "تنظیمات یا قابلیت اتصال ثبت شده، اما API سلامت زندهٔ ارتباط را تأیید نکرده است.", en: "Configuration or connector availability is reported, but the API has not verified a live connection." },
  missing: { fa: "API برای این منبع وضعیت ارتباطی گزارش نکرده است؛ تنظیمات و پشتیبانی اتصال را بررسی کنید.", en: "The API did not report this source. Check its configuration and connector support." },
  stale: { fa: "نتیجهٔ بررسی اتصال قدیمی است؛ تا دریافت تأیید تازه، وضعیت متصل نمایش داده نمی‌شود.", en: "The health result is stale. A fresh confirmation is required before showing Connected." },
  offline: { fa: "مرورگر آفلاین است؛ بررسی وضعیت اتصال منابع ممکن نیست.", en: "Your browser is offline. Source health cannot be checked." },
  "signed-out": { fa: "برای مشاهدهٔ وضعیت اتصال وارد حساب کاربری شوید.", en: "Sign in to view source connection status." },
  unauthorized: { fa: "نشست معتبر نیست؛ برای بررسی وضعیت اتصال دوباره وارد شوید.", en: "Your session is not authorized. Sign in again to check source status." },
  forbidden: { fa: "مجوز مشاهدهٔ وضعیت ارتباطات را ندارید.", en: "You do not have permission to view integration status." },
  network: { fa: "سرور وضعیت ارتباطات در دسترس نیست؛ اتصال شبکه را بررسی کنید.", en: "The integration status service is unreachable. Check your network connection." },
  timeout: { fa: "سرور وضعیت ارتباطات در مهلت تعیین‌شده پاسخ نداد؛ دوباره تلاش کنید.", en: "The integration status request timed out. Please retry." },
  unavailable: { fa: "دریافت وضعیت ارتباطات از سرور ناموفق بود؛ دوباره تلاش کنید.", en: "The server could not provide integration status. Please retry." },
  malformed: { fa: "پاسخ وضعیت ارتباطات معتبر نیست؛ اتصال قابل تأیید نیست.", en: "The integration status response is invalid. Connection health cannot be confirmed." },
};

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const canonicalId = (id: string) => id === "pbi" ? "powerbi" : id;

/** Existing endpoint: {ok:true,data:[{id,configured,mode}],meta:{timestamp}}.
 * configured/mode and envelope timestamps are NEVER proof of live health.
 * Optional per-source connected:boolean + checkedAt:ISO are a health contract;
 * only a fresh explicit true can produce a green indicator. No probe is faked. */
export function parseHealthSnapshot(body: unknown, owner: string, receivedAt: number): HealthSnapshot {
  if (!object(body) || body.ok !== true || !Array.isArray(body.data)
    || (object(body.meta) && body.meta.degraded === true)) {
    return { owner, receivedAt, items: {}, error: "malformed" };
  }
  const items: HealthSnapshot["items"] = Object.create(null);
  for (const item of body.data) {
    if (!object(item) || typeof item.id !== "string" || !item.id.trim()) {
      return { owner, receivedAt, items: {}, error: "malformed" };
    }
    const id = canonicalId(item.id);
    if (Object.prototype.hasOwnProperty.call(items, id)) return { owner, receivedAt, items: {}, error: "malformed" };
    items[id] = item;
  }
  return { owner, receivedAt, items };
}

export function sourceHealth(snapshot: HealthSnapshot, id: string, now: number): SourceHealth {
  const result = (reason: HealthReason, checkedAt: number | null = null, latencyMs: number | null = null): SourceHealth => ({
    reason,
    status: reason === "connected" ? "connected" : reason === "loading" ? "loading"
      : ["disconnected", "unconfigured", "file-import"].includes(reason) ? "disconnected" : "unknown",
    checkedAt, latencyMs,
  });
  if (snapshot.error) return result(snapshot.error);
  if (now - snapshot.receivedAt > HEALTH_MAX_AGE_MS) return result("stale");
  const item = snapshot.items[canonicalId(id)];
  if (!item) return result("missing");
  if (item.mode === "file-import") return result("file-import");
  if (item.configured === false) return result("unconfigured");
  if (item.connected === false) return result("disconnected");
  if (item.connected !== true) return result("unverified");
  const checkedAt = typeof item.checkedAt === "string" ? Date.parse(item.checkedAt) : NaN;
  if (!Number.isFinite(checkedAt) || checkedAt > now + 5_000) return result("unverified");
  if (now - checkedAt > HEALTH_MAX_AGE_MS) return result("stale", checkedAt);
  const latencyMs = typeof item.latencyMs === "number" && Number.isFinite(item.latencyMs) && item.latencyMs >= 0
    ? item.latencyMs : null;
  return result("connected", checkedAt, latencyMs);
}
