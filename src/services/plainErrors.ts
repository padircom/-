/**
 * ترجمهٔ خطاهای فنی به زبان قابل فهم.
 *
 * چرا لازم است: پنل دانش پروژه خطای خام سرور را مستقیم نشان می‌داد.
 * کاربر `getaddrinfo ENOTFOUND .` می‌دید — عبارتی که حتی برای برنامه‌نویس
 * هم بدون زمینه مبهم است، چه رسد به کسی که فقط می‌خواهد بداند چرا
 * دکمه کار نمی‌کند.
 *
 * سه قاعده:
 *
 * ۱. **علت را بگو، نه کد خطا را.** «پایگاه داده متصل نیست» به کاربر
 *    می‌گوید کجا را درست کند؛ `ENOTFOUND` نمی‌گوید.
 *
 * ۲. **راه‌حل را بگو.** خطایی که نگوید چه کار کنیم، فقط نگرانی
 *    می‌سازد.
 *
 * ۳. **متن فنی را دور نریز.** برای پشتیبانی لازم است، ولی زیر یک
 *    «جزئیات فنی» پنهان می‌شود تا صفحه را نترساند.
 */

export const PLAIN_ERROR_VERSION = "perr-v1";

export type PlainError = {
  /** یک جمله، بدون اصطلاح فنی. */
  titleFa: string;
  titleEn: string;
  /** کاربر باید چه کند. */
  actionFa: string;
  actionEn: string;
  /** آیا این مشکل با تنظیمات کاربر حل می‌شود یا نیاز به مدیر سامانه دارد. */
  needsAdmin: boolean;
  /** متن اصلی خطا، برای پشتیبانی. */
  technical: string;
};

/* ══════════════════════════ الگوها ══════════════════════════ */

type Rule = {
  match: RegExp;
  titleFa: string;
  titleEn: string;
  actionFa: string;
  actionEn: string;
  needsAdmin: boolean;
};

/**
 * ترتیب مهم است: الگوی خاص‌تر اول می‌آید.
 *
 * `ENOTFOUND` هم در خطای پایگاه داده و هم در خطای اینترنت دیده می‌شود،
 * پس نشانه‌های دقیق‌تر (نام میزبان سرویس هوش مصنوعی) باید پیش از
 * قاعدهٔ عمومی بررسی شوند، وگرنه هر دو «پایگاه داده» تشخیص داده
 * می‌شوند و کاربر سراغ چیز اشتباهی می‌رود.
 */
const RULES: Rule[] = [
  {
    match: /api\.(deepseek|openai|anthropic)\.com|E-AI-UNREACHABLE/i,
    titleFa: "سرویس هوش مصنوعی در دسترس نیست.",
    titleEn: "The AI service is unreachable.",
    actionFa: "اتصال اینترنت سرور را بررسی کنید. اگر پشت فایروال هستید، دسترسی به نشانی سرویس باید باز شود.",
    actionEn: "Check the server's internet connection and firewall access to the service.",
    needsAdmin: true,
  },
  {
    match: /E-AI-NO-SECRET|کلید سرویس وارد نشده/i,
    titleFa: "کلید هوش مصنوعی وارد نشده است.",
    titleEn: "No AI key has been entered.",
    actionFa: "به «مدیریت سامانه ← ۵. هوش مصنوعی و یکپارچگی» بروید و کلید را وارد کنید.",
    actionEn: "Go to System Management → 5. AI & Integrations and enter the key.",
    needsAdmin: false,
  },
  {
    match: /E-AI-ARENA-NO-SESSION/i,
    titleFa: "حساب Arena.ai به برنامه وصل نشده است.",
    titleEn: "The Arena.ai account is not linked.",
    actionFa: "فعلاً در «مدیریت سامانه ← ۵» سرویس دیگری مثل OpenAI را با کلید انتخاب کنید.",
    actionEn: "For now choose another provider with a key in System Management → 5.",
    needsAdmin: false,
  },
  {
    match: /موتور قاعده‌محور ترجمه نمی‌کند|simulator/i,
    titleFa: "سرویس هوش مصنوعی روی حالت آزمایشی است.",
    titleEn: "The AI service is in simulator mode.",
    actionFa: "در «مدیریت سامانه ← ۵» یک سرویس واقعی (مثل OpenAI) انتخاب کنید.",
    actionEn: "Pick a real provider in System Management → 5.",
    needsAdmin: false,
  },
  {
    /* نشانه‌های نرسیدن به SQL Server. */
    match: /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EINSTLOOKUP|ELOGIN|Failed to connect|socket hang up/i,
    titleFa: "پایگاه دادهٔ پروژه متصل نیست.",
    titleEn: "The project database is not connected.",
    actionFa: "این بخش برای نگهداری اسناد به SQL Server نیاز دارد. از مدیر سامانه بخواهید اتصال را برقرار کند.",
    actionEn: "This area needs SQL Server. Ask your administrator to connect it.",
    needsAdmin: true,
  },
  {
    match: /NO_TEXT_FOUND|No extractable text|OCR/i,
    titleFa: "از این فایل متنی خوانده نشد.",
    titleEn: "No text could be read from this file.",
    actionFa: "احتمالاً فایل اسکن‌شده (عکس) است. نسخهٔ متنی PDF را بارگذاری کنید یا متن را دستی بچسبانید.",
    actionEn: "The file is probably a scan. Upload a text-based PDF or paste the text.",
    needsAdmin: false,
  },
  {
    match: /FILE_REQUIRED|EXTRACT_FAILED/i,
    titleFa: "فایل خوانده نشد.",
    titleEn: "The file could not be read.",
    actionFa: "فایل ممکن است خراب یا رمزگذاری‌شده باشد. فایل دیگری را امتحان کنید.",
    actionEn: "The file may be damaged or password-protected. Try another file.",
    needsAdmin: false,
  },
  {
    match: /\b40[13]\b|UNAUTHORIZED|FORBIDDEN|دسترسی/i,
    titleFa: "اجازهٔ دسترسی به این بخش را ندارید.",
    titleEn: "You do not have permission for this area.",
    actionFa: "از مدیر سامانه بخواهید نقش شما را بررسی کند.",
    actionEn: "Ask your administrator to review your role.",
    needsAdmin: true,
  },
  {
    match: /NOT_FOUND|was not found/i,
    titleFa: "این قابلیت روی سرور فعال نیست.",
    titleEn: "This feature is not enabled on the server.",
    actionFa: "نسخهٔ سرور ممکن است قدیمی باشد. با مدیر سامانه تماس بگیرید.",
    actionEn: "The server build may be outdated. Contact your administrator.",
    needsAdmin: true,
  },
  {
    match: /Failed to fetch|NetworkError|ERR_NETWORK/i,
    titleFa: "ارتباط با سرور برقرار نشد.",
    titleEn: "Could not reach the server.",
    actionFa: "اتصال شبکه را بررسی کنید و صفحه را دوباره بارگذاری کنید.",
    actionEn: "Check your connection and reload the page.",
    needsAdmin: false,
  },
];

/**
 * تبدیل هر خطا به پیام قابل فهم.
 *
 * اگر هیچ الگویی نخواند، پیام عمومی داده می‌شود ولی متن فنی نگه
 * داشته می‌شود — حدس زدن علت بدتر از گفتن «نمی‌دانم» است.
 */
export function toPlainError(raw: unknown): PlainError {
  const technical = raw instanceof Error ? raw.message : String(raw ?? "");
  const hit = RULES.find((r) => r.match.test(technical));

  if (!hit) {
    return {
      titleFa: "این بخش الان کار نمی‌کند.",
      titleEn: "This area is not working right now.",
      actionFa: "دوباره تلاش کنید. اگر تکرار شد، متن فنی زیر را به پشتیبانی بدهید.",
      actionEn: "Try again. If it repeats, send the technical detail below to support.",
      needsAdmin: false,
      technical,
    };
  }

  return {
    titleFa: hit.titleFa,
    titleEn: hit.titleEn,
    actionFa: hit.actionFa,
    actionEn: hit.actionEn,
    needsAdmin: hit.needsAdmin,
    technical,
  };
}

/* ══════════════════════════ وضعیت بخش ══════════════════════════ */

export type AreaHealth = "ready" | "degraded" | "offline";

/**
 * وضعیت کلی یک بخش از روی خطاهای دیده‌شده.
 *
 * `degraded` برای وقتی است که بخشی کار می‌کند: مثلاً سند ذخیره می‌شود
 * ولی پرسش و پاسخ نه. نشان دادن «خاموش» در آن حالت، کاربر را از
 * قابلیتی که در دسترس است محروم می‌کند.
 */
export function areaHealth(errors: (string | null | undefined)[]): AreaHealth {
  const real = errors.filter((e): e is string => Boolean(e && e.trim()));
  if (real.length === 0) return "ready";
  const blocking = real.some((e) => /ENOTFOUND|ECONNREFUSED|EINSTLOOKUP|NOT_FOUND|ELOGIN/i.test(e));
  return blocking ? "offline" : "degraded";
}

export const HEALTH_LABEL: Record<AreaHealth, { fa: string; en: string; color: string }> = {
  ready: { fa: "آماده", en: "Ready", color: "#8FE3C8" },
  degraded: { fa: "با محدودیت", en: "Limited", color: "#FFD48A" },
  offline: { fa: "غیرفعال", en: "Offline", color: "#FF9F9F" },
};
