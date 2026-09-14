/**
 * لایهٔ ارائه‌دهندهٔ هوش مصنوعی — انتخاب کاربر میان چند سرویس.
 *
 * چرا این لایه وجود دارد:
 *
 * پیش از این تنها یک مسیر به OpenAI در `server/index.js` کدشده بود
 * (`callGroundedAi`). با آن، اگر کلید نبود قابلیت مرده بود و اگر کاربر
 * سرویس دیگری می‌خواست باید کد عوض می‌شد.
 *
 * سه تصمیم بنیادی اینجا گرفته شده:
 *
 * ۱. **کف قاعده‌محور همیشه هست.** ارائه‌دهندهٔ `rule` هیچ کلیدی
 *    نمی‌خواهد و هرگز شکست نمی‌خورد. یعنی ساخت ساختار شکست بدون
 *    اینترنت و بدون حساب هم کار می‌کند — AI فقط کیفیت را بالا می‌برد،
 *    شرط کارکردن نیست.
 *
 * ۲. **کلید هرگز ذخیره نمی‌شود.** نه در پایگاه داده، نه در سیاههٔ
 *    ممیزی، نه در پیام خطا. فقط از هدر درخواست یا محیط خوانده و در
 *    همان فراخوانی مصرف می‌شود.
 *
 * ۳. **کار با حساب کاربری از همین‌جا می‌گذرد.** `AuthMode` دو حالت
 *    دارد: `api_key` (کلید ماشین) و `account` (توکن نشست کاربر).
 *    شکل درخواست یکی است و فقط سربرگ مجوز فرق می‌کند، پس وقتی جریان
 *    ورود آرنا آماده شد بدون بازنویسی وصل می‌شود.
 */

export const AI_VERSION = "ai-v1";

/* ══════════════════════════ نوع‌ها ══════════════════════════ */

export type AiProviderId = "arena" | "claude" | "openai" | "deepseek" | "rule";

export type AuthMode = "api_key" | "account";

export type AiProviderMeta = {
  id: AiProviderId;
  titleFa: string;
  titleEn: string;
  /** آدرس پیش‌فرض؛ با متغیر محیطی قابل جایگزینی است. */
  defaultUrl: string;
  defaultModel: string;
  /** حالت‌های احراز هویتی که این ارائه‌دهنده می‌پذیرد. */
  authModes: AuthMode[];
  /** آیا برای کار کردن به شبکه نیاز دارد. */
  needsNetwork: boolean;
};

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: "arena",
    titleFa: "آرنا (ورود با حساب کاربری)",
    titleEn: "Arena (sign in with your account)",
    defaultUrl: "https://arena.ai/api/v1/responses",
    defaultModel: "arena-default",
    /* آرنا با حساب کاربری کار می‌کند؛ کلید ماشین هم پذیرفته می‌شود تا
     * اجرای سرور به‌سرور ممکن بماند. */
    authModes: ["account", "api_key"],
    needsNetwork: true,
  },
  {
    id: "claude",
    titleFa: "کلاد (Anthropic)",
    titleEn: "Claude (Anthropic)",
    defaultUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-20250514",
    authModes: ["api_key"],
    needsNetwork: true,
  },
  {
    id: "openai",
    titleFa: "اوپن‌ای‌آی",
    titleEn: "OpenAI",
    defaultUrl: "https://api.openai.com/v1/responses",
    defaultModel: "gpt-4.1-mini",
    authModes: ["api_key"],
    needsNetwork: true,
  },
  {
    id: "deepseek",
    titleFa: "دیپ‌سیک",
    titleEn: "DeepSeek",
    defaultUrl: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-chat",
    authModes: ["api_key"],
    needsNetwork: true,
  },
  {
    id: "rule",
    titleFa: "موتور قاعده‌محور (بدون سرویس بیرونی)",
    titleEn: "Rule engine (no external service)",
    defaultUrl: "",
    defaultModel: "rule-v1",
    /* هیچ اعتباری نمی‌خواهد. */
    authModes: [],
    needsNetwork: false,
  },
];

export const PROVIDER_BY_ID = new Map(AI_PROVIDERS.map((p) => [p.id, p]));

export function isProviderId(v: unknown): v is AiProviderId {
  return typeof v === "string" && PROVIDER_BY_ID.has(v as AiProviderId);
}

/* ══════════════════════════ اعتبار ══════════════════════════ */

export type AiCredential = {
  provider: AiProviderId;
  mode: AuthMode;
  /** کلید یا توکن نشست. هرگز ذخیره یا ثبت نمی‌شود. */
  secret: string;
  /** برای حالت حساب کاربری: شناسهٔ کاربر نزد سرویس. فقط برای نمایش. */
  accountEmail?: string | null;
};

export type CredentialCheck = {
  ok: boolean;
  /** کد خطا برای پیام‌های ماشین‌خوان. */
  code?: string;
  messageFa?: string;
};

/**
 * بررسی اینکه اعتبار داده‌شده با ارائه‌دهنده می‌خواند.
 *
 * این تابع **پیش از** هر تماس شبکه‌ای صدا زده می‌شود تا خطای پیکربندی
 * از خطای سرویس جدا بماند. اگر این دو قاطی شوند، کاربر یک «خطای AI»
 * می‌بیند و نمی‌داند کلید را اشتباه زده یا سرویس پایین است.
 */
export function checkCredential(cred: Partial<AiCredential> | null | undefined): CredentialCheck {
  if (!cred || !cred.provider) {
    return { ok: false, code: "E-AI-NO-PROVIDER", messageFa: "ارائه‌دهنده انتخاب نشده است." };
  }
  const meta = PROVIDER_BY_ID.get(cred.provider);
  if (!meta) {
    return { ok: false, code: "E-AI-UNKNOWN-PROVIDER", messageFa: "ارائه‌دهندهٔ ناشناخته." };
  }
  /* موتور قاعده‌محور هیچ اعتباری نمی‌خواهد و همیشه در دسترس است. */
  if (meta.authModes.length === 0) return { ok: true };

  const mode = cred.mode ?? meta.authModes[0];
  if (!meta.authModes.includes(mode)) {
    return {
      ok: false,
      code: "E-AI-MODE-UNSUPPORTED",
      messageFa: `${meta.titleFa} این روش ورود را نمی‌پذیرد.`,
    };
  }
  if (!cred.secret || !String(cred.secret).trim()) {
    return {
      ok: false,
      code: "E-AI-NO-SECRET",
      messageFa: mode === "account"
        ? "برای ورود با حساب کاربری، نشست معتبر لازم است."
        : "کلید سرویس وارد نشده است.",
    };
  }
  return { ok: true };
}

/**
 * پوشاندن راز برای نمایش و سیاههٔ ممیزی.
 *
 * هرگز راز کامل را جایی ننویس. این تابع تنها شکل مجاز نمایش است.
 */
export function maskSecret(secret: string | null | undefined): string {
  const s = String(secret ?? "");
  if (!s) return "";
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 4)}${"•".repeat(Math.min(12, s.length - 8))}${s.slice(-4)}`;
}

/* ══════════════════════════ شکل درخواست ══════════════════════════ */

export type AiRequest = {
  /** دستور سامانه‌ای — نقش و محدودیت‌ها. */
  instructions: string;
  /** ورودی کاربر یا متن منبع. */
  input: string;
  maxOutputTokens?: number;
};

export type WireRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

/**
 * ساخت درخواست سیمی برای هر ارائه‌دهنده.
 *
 * سه سرویس سه شکل بدنهٔ متفاوت دارند و این تنها جایی است که این تفاوت
 * دیده می‌شود. بقیهٔ برنامه فقط `AiRequest` می‌شناسد.
 */
export function buildWireRequest(
  cred: AiCredential,
  req: AiRequest,
  opts: { url?: string; model?: string } = {},
): WireRequest {
  const meta = PROVIDER_BY_ID.get(cred.provider);
  if (!meta) throw new Error(`unknown provider: ${cred.provider}`);
  if (meta.authModes.length === 0) throw new Error("rule engine has no wire request");

  const url = opts.url || meta.defaultUrl;
  const model = opts.model || meta.defaultModel;
  const maxTokens = req.maxOutputTokens ?? 1200;

  if (cred.provider === "claude") {
    /* Anthropic دستور سامانه‌ای را در میدان جدای `system` می‌گیرد، نه
     * داخل پیام‌ها. اگر داخل `messages` گذاشته شود بی‌اثر می‌ماند. */
    return {
      url,
      headers: {
        "content-type": "application/json",
        "x-api-key": cred.secret,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: req.instructions,
        messages: [{ role: "user", content: req.input }],
      }),
    };
  }

  if (cred.provider === "deepseek") {
    /* DeepSeek قالب chat/completions را می‌خواهد، نه Responses.
     * فرستادن بدنهٔ Responses به آن، خطای ۴۰۰ می‌دهد و پیامش هم
     * گویا نیست. */
    return {
      url,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cred.secret}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: req.instructions },
          { role: "user", content: req.input },
        ],
      }),
    };
  }

  /* آرنا و اوپن‌ای‌آی هر دو شکل Responses را می‌پذیرند. تفاوتشان فقط
   * در سربرگ مجوز است: حساب کاربری توکن نشست می‌فرستد. */
  return {
    url,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cred.secret}`,
      ...(cred.mode === "account" ? { "x-auth-mode": "account" } : {}),
    },
    body: JSON.stringify({
      model,
      instructions: req.instructions,
      input: req.input,
      max_output_tokens: maxTokens,
    }),
  };
}

/**
 * بیرون کشیدن متن از پاسخ هر سه سرویس.
 *
 * شکل پاسخ‌ها متفاوت است و اگر این نگاشت در نقاط مختلف تکرار شود،
 * یکی از آن‌ها از قلم می‌افتد و آن سرویس بی‌سروصدا `null` می‌دهد.
 */
export function extractText(provider: AiProviderId, payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  if (provider === "deepseek") {
    const choices = p.choices;
    if (Array.isArray(choices) && choices.length) {
      const msg = (choices[0] as { message?: { content?: unknown } })?.message;
      if (typeof msg?.content === "string" && msg.content) return msg.content;
    }
    return null;
  }

  if (provider === "claude") {
    const content = p.content;
    if (Array.isArray(content)) {
      const parts = content
        .filter((b): b is { type: string; text: string } =>
          Boolean(b) && typeof b === "object" && (b as { type?: unknown }).type === "text")
        .map((b) => b.text);
      return parts.length ? parts.join("\n") : null;
    }
    return null;
  }

  /* شکل Responses: میان‌بر `output_text` ممکن است نباشد، آن‌وقت باید
   * از آرایهٔ `output` بیرون کشیده شود. */
  if (typeof p.output_text === "string" && p.output_text) return p.output_text;
  const output = p.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = (item as { content?: unknown })?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        const b = block as { type?: unknown; text?: unknown };
        if (b?.type === "output_text" && typeof b.text === "string") return b.text;
        if (b?.type === "text" && typeof b.text === "string") return b.text;
      }
    }
  }
  return null;
}

/* ══════════════════════════ تشخیص خطا ══════════════════════════ */

export type AiFailureKind =
  | "auth"        // اعتبار رد شد
  | "rate_limit"  // سقف مصرف
  | "timeout"     // مهلت شبکه
  | "server"      // خطای سرویس
  | "network"     // نرسیدن به سرویس
  | "unknown";

/**
 * تفکیک نوع شکست از روی وضعیت HTTP.
 *
 * چرا مهم است: در D14 (رویدادها) یاد گرفتیم که مهلت شبکه با خطای
 * سرویس یکی نیست — اولی باید دوباره تلاش شود، دومی نه. همان درس
 * اینجا هم صدق می‌کند.
 */
export function classifyHttpFailure(status: number): AiFailureKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "server";
  if (status >= 400) return "unknown";
  return "unknown";
}

export function failureMessageFa(kind: AiFailureKind, providerId: AiProviderId): string {
  const name = PROVIDER_BY_ID.get(providerId)?.titleFa ?? providerId;
  switch (kind) {
    case "auth":
      return `${name}: اعتبار پذیرفته نشد. کلید یا نشست را بررسی کنید.`;
    case "rate_limit":
      return `${name}: سقف مصرف پر شده است. کمی بعد دوباره تلاش کنید.`;
    case "timeout":
      return `${name}: پاسخ در مهلت مقرر نرسید.`;
    case "server":
      return `${name}: سرویس در دسترس نیست.`;
    case "network":
      return `${name}: اتصال برقرار نشد.`;
    default:
      return `${name}: خطای ناشناخته.`;
  }
}

/**
 * آیا با این نوع شکست، افتادن به موتور قاعده‌محور درست است؟
 *
 * خطای اعتبار **نباید** بی‌صدا به کف بیفتد: کاربر باید بداند کلیدش کار
 * نمی‌کند، وگرنه فکر می‌کند AI کار کرده و خروجی ضعیف را می‌پذیرد.
 * ولی قطعی شبکه یا سقف مصرف، دلیلی برای متوقف کردن کار نیست.
 */
export function shouldFallbackToRule(kind: AiFailureKind): boolean {
  return kind !== "auth";
}
