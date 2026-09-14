/**
 * ماندگاری نشست کارگاه برنامه‌ریزی.
 *
 * ایراد اساسی‌ای که این فایل می‌بندد: همهٔ وضعیت کارگاه در `useState`
 * محلی بود. کاربر قرارداد را بارگذاری می‌کرد، از ماژول بیرون می‌رفت و
 * برمی‌گشت — کامپوننت unmount شده بود و فایل، متن، ترجمه و کل درخت
 * استخراج‌شده از بین می‌رفت. کاری که ده دقیقه طول کشیده با یک کلیک
 * ناوبری می‌سوخت.
 *
 * چهار تصمیم:
 *
 * ۱. **کلید به پروژه بسته است.** دو پروژه نباید قرارداد هم را ببینند.
 *    نشتِ سند یک پروژه به پروژهٔ دیگر، در محیط پیمانکاری فاجعه است.
 *
 * ۲. **متن بلند حجیم است و باید مهار شود.** حافظهٔ مرورگر سقف دارد
 *    (معمولاً ۵ مگابایت). یک قرارداد ۳۰۰ صفحه‌ای می‌تواند آن را پر کند
 *    و نوشتن‌های بعدی — از جمله چیدمان — بی‌صدا شکست می‌خورند.
 *
 * ۳. **شکست ذخیره نباید کار را متوقف کند.** حالت ناشناس مرورگر نوشتن
 *    را رد می‌کند؛ در آن حالت نشست در همان بازدید کار می‌کند و فقط
 *    ماندگار نمی‌شود — با اعلام صریح، نه سکوت.
 *
 * ۴. **نسخه‌دار است.** اگر شکل داده عوض شود، نشست قدیمی به‌جای خطای
 *    عجیب، تمیز دور ریخته می‌شود.
 */

export const SESSION_VERSION = "wsess-v1";

/* ══════════════════════════ نوع‌ها ══════════════════════════ */

export type SessionNode = {
  code: string;
  parentCode?: string | null;
  titleFa: string;
  titleEn?: string | null;
  depth: number;
  weightFactor?: number | null;
  weightValue?: number | null;
  amount?: number | null;
  sourceRefFa?: string | null;
  actualPct?: number | null;
  plannedPct?: number | null;
};

export type WorkshopSession = {
  version: string;
  /** نام فایل بارگذاری‌شده. */
  fileName: string;
  /** اندازهٔ فایل اصلی به بایت — برای نمایش، نه محاسبه. */
  fileSize: number;
  /** زمان بارگذاری، ISO. */
  loadedAt: string | null;
  rawText: string;
  translated: string;
  targetLang: "fa" | "en";
  templateId: string;
  nodes: SessionNode[];
  /** آیا متن به‌خاطر سقف حجم بریده شده است. */
  textTruncated: boolean;
};

/**
 * سقف متن ذخیره‌شده.
 *
 * ۴۰۰ هزار نویسه تقریباً ۸۰۰ کیلوبایت در UTF-16 است — جا برای چند
 * پروژه و چیدمان باقی می‌ماند. متن بلندتر بریده می‌شود و پرچم
 * `textTruncated` بالا می‌رود تا کاربر بداند چرا استخراج ناقص است.
 */
export const MAX_STORED_TEXT = 400_000;

export function emptySession(): WorkshopSession {
  return {
    version: SESSION_VERSION,
    fileName: "",
    fileSize: 0,
    loadedAt: null,
    rawText: "",
    translated: "",
    targetLang: "fa",
    templateId: "og-epc",
    nodes: [],
    textTruncated: false,
  };
}

/* ══════════════════════════ کلید ══════════════════════════ */

/** کلید ذخیره؛ به پروژه بسته تا اسناد دو پروژه قاطی نشوند. */
export function sessionKey(projectCode: string): string {
  const safe = String(projectCode || "default").trim() || "default";
  return `arena.workshop.${safe}`;
}

/* ══════════════════════════ اعتبارسنجی ══════════════════════════ */

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function sanitiseNode(v: unknown): SessionNode | null {
  if (!v || typeof v !== "object") return null;
  const n = v as Record<string, unknown>;
  const code = str(n.code).trim();
  if (!code) return null;
  return {
    code,
    parentCode: typeof n.parentCode === "string" ? n.parentCode : null,
    titleFa: str(n.titleFa),
    titleEn: typeof n.titleEn === "string" ? n.titleEn : null,
    depth: Math.max(1, num(n.depth, 1)),
    weightFactor: typeof n.weightFactor === "number" ? n.weightFactor : null,
    weightValue: typeof n.weightValue === "number" ? n.weightValue : null,
    amount: typeof n.amount === "number" ? n.amount : null,
    sourceRefFa: typeof n.sourceRefFa === "string" ? n.sourceRefFa : null,
    actualPct: typeof n.actualPct === "number" ? n.actualPct : null,
    plannedPct: typeof n.plannedPct === "number" ? n.plannedPct : null,
  };
}

/**
 * پاک‌سازی نشست خوانده‌شده.
 *
 * هر چیزی که شکلش نمی‌خواند کنار گذاشته می‌شود، ولی بقیه نگه داشته
 * می‌شود. دور ریختن کل نشست به‌خاطر یک گرهٔ خراب، همان از دست رفتن
 * کار است که می‌خواستیم جلویش را بگیریم.
 */
export function sanitiseSession(v: unknown): WorkshopSession {
  const base = emptySession();
  if (!v || typeof v !== "object") return base;
  const s = v as Record<string, unknown>;

  /* نسخهٔ ناسازگار تمیز دور ریخته می‌شود، نه اینکه نیمه‌خوانده شود. */
  if (str(s.version) !== SESSION_VERSION) return base;

  const rawText = str(s.rawText);
  const lang = s.targetLang === "en" ? "en" : "fa";

  return {
    version: SESSION_VERSION,
    fileName: str(s.fileName),
    fileSize: num(s.fileSize),
    loadedAt: typeof s.loadedAt === "string" ? s.loadedAt : null,
    rawText,
    translated: str(s.translated),
    targetLang: lang,
    templateId: str(s.templateId) || "og-epc",
    nodes: Array.isArray(s.nodes)
      ? s.nodes.map(sanitiseNode).filter((n): n is SessionNode => n !== null)
      : [],
    textTruncated: Boolean(s.textTruncated),
  };
}

/* ══════════════════════════ خواندن و نوشتن ══════════════════════════ */

export type SaveOutcome = { ok: boolean; truncated: boolean; reasonFa?: string };

function storageOf(given?: Storage): Storage | null {
  if (given) return given;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    /* دسترسی به localStorage در برخی تنظیمات، خودش پرتاب می‌کند. */
    return null;
  }
}

export function loadSession(projectCode: string, storage?: Storage): WorkshopSession {
  try {
    const store = storageOf(storage);
    if (!store) return emptySession();
    const raw = store.getItem(sessionKey(projectCode));
    if (!raw) return emptySession();
    return sanitiseSession(JSON.parse(raw));
  } catch {
    /* JSON خراب نباید صفحه را از کار بیندازد. */
    return emptySession();
  }
}

export function saveSession(projectCode: string, session: WorkshopSession, storage?: Storage): SaveOutcome {
  const store = storageOf(storage);
  if (!store) return { ok: false, truncated: false, reasonFa: "حافظهٔ مرورگر در دسترس نیست." };

  const truncated = session.rawText.length > MAX_STORED_TEXT;
  const payload: WorkshopSession = truncated
    ? { ...session, rawText: session.rawText.slice(0, MAX_STORED_TEXT), textTruncated: true }
    : session;

  try {
    store.setItem(sessionKey(projectCode), JSON.stringify(payload));
    return { ok: true, truncated };
  } catch {
    /* حافظه پر شد. تلاش دوم بدون متن: درخت استخراج‌شده ارزشمندتر از
     * متن خام است، چون متن را می‌شود دوباره از فایل گرفت ولی درخت
     * ویرایش‌شده را نه. */
    try {
      store.setItem(
        sessionKey(projectCode),
        JSON.stringify({ ...payload, rawText: "", translated: "", textTruncated: true }),
      );
      return {
        ok: true,
        truncated: true,
        reasonFa: "حافظه پر بود؛ ساختار ذخیره شد ولی متن قرارداد نگه داشته نشد.",
      };
    } catch {
      return { ok: false, truncated: false, reasonFa: "ذخیره‌سازی ممکن نشد؛ نشست فقط تا پایان این بازدید می‌ماند." };
    }
  }
}

export function clearSession(projectCode: string, storage?: Storage): void {
  try {
    storageOf(storage)?.removeItem(sessionKey(projectCode));
  } catch {
    /* پاک نشدن حافظه خطای کاربر نیست. */
  }
}

/* ══════════════════════════ خلاصهٔ فایل ══════════════════════════ */

export type FileSummary = {
  hasFile: boolean;
  fileName: string;
  sizeLabel: string;
  charLabel: string;
  loadedLabel: string;
  nodeCount: number;
  hasTranslation: boolean;
  truncated: boolean;
};

/** اندازهٔ خوانا. صفر بایت هم «۰ B» است نه رشتهٔ خالی. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * خلاصهٔ وضعیت برای نوار فایل.
 *
 * کاربر باید بدون باز کردن هیچ کشویی بداند چه فایلی سوار است، چند
 * نویسه دارد، کی بارگذاری شده و چند گره از آن درآمده.
 */
export function summarise(session: WorkshopSession, lang: "fa" | "en" = "fa"): FileSummary {
  const loaded = session.loadedAt ? new Date(session.loadedAt) : null;
  const valid = loaded && !Number.isNaN(loaded.getTime());
  return {
    hasFile: Boolean(session.fileName),
    fileName: session.fileName,
    sizeLabel: session.fileSize > 0 ? formatBytes(session.fileSize) : "—",
    charLabel: session.rawText.length.toLocaleString(lang === "fa" ? "fa-IR" : "en-US"),
    loadedLabel: valid
      ? loaded.toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { dateStyle: "short", timeStyle: "short" })
      : "—",
    nodeCount: session.nodes.length,
    hasTranslation: session.translated.trim().length > 0,
    truncated: session.textTruncated,
  };
}
