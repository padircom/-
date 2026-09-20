// src/services/aiProvider.ts
var AI_VERSION = "ai-v1";
var AI_PROVIDERS = [
  {
    id: "arena",
    titleFa: "\u0622\u0631\u0646\u0627 (\u0648\u0631\u0648\u062F \u0628\u0627 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC)",
    titleEn: "Arena (sign in with your account)",
    defaultUrl: "https://arena.ai/api/v1/responses",
    defaultModel: "arena-default",
    /* آرنا با حساب کاربری کار می‌کند؛ کلید ماشین هم پذیرفته می‌شود تا
     * اجرای سرور به‌سرور ممکن بماند. */
    authModes: ["account", "api_key"],
    needsNetwork: true
  },
  {
    id: "claude",
    titleFa: "\u06A9\u0644\u0627\u062F (Anthropic)",
    titleEn: "Claude (Anthropic)",
    defaultUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-20250514",
    authModes: ["api_key"],
    needsNetwork: true
  },
  {
    id: "openai",
    titleFa: "\u0627\u0648\u067E\u0646\u200C\u0627\u06CC\u200C\u0622\u06CC",
    titleEn: "OpenAI",
    defaultUrl: "https://api.openai.com/v1/responses",
    defaultModel: "gpt-4.1-mini",
    authModes: ["api_key"],
    needsNetwork: true
  },
  {
    id: "deepseek",
    titleFa: "\u062F\u06CC\u067E\u200C\u0633\u06CC\u06A9",
    titleEn: "DeepSeek",
    defaultUrl: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-chat",
    authModes: ["api_key"],
    needsNetwork: true
  },
  {
    id: "rule",
    titleFa: "\u0645\u0648\u062A\u0648\u0631 \u0642\u0627\u0639\u062F\u0647\u200C\u0645\u062D\u0648\u0631 (\u0628\u062F\u0648\u0646 \u0633\u0631\u0648\u06CC\u0633 \u0628\u06CC\u0631\u0648\u0646\u06CC)",
    titleEn: "Rule engine (no external service)",
    defaultUrl: "",
    defaultModel: "rule-v1",
    /* هیچ اعتباری نمی‌خواهد. */
    authModes: [],
    needsNetwork: false
  }
];
var PROVIDER_BY_ID = new Map(AI_PROVIDERS.map((p) => [p.id, p]));
function isProviderId(v) {
  return typeof v === "string" && PROVIDER_BY_ID.has(v);
}
function checkCredential(cred) {
  if (!cred || !cred.provider) {
    return { ok: false, code: "E-AI-NO-PROVIDER", messageFa: "\u0627\u0631\u0627\u0626\u0647\u200C\u062F\u0647\u0646\u062F\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." };
  }
  const meta = PROVIDER_BY_ID.get(cred.provider);
  if (!meta) {
    return { ok: false, code: "E-AI-UNKNOWN-PROVIDER", messageFa: "\u0627\u0631\u0627\u0626\u0647\u200C\u062F\u0647\u0646\u062F\u0647\u0654 \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647." };
  }
  if (meta.authModes.length === 0) return { ok: true };
  const mode = cred.mode ?? meta.authModes[0];
  if (!meta.authModes.includes(mode)) {
    return {
      ok: false,
      code: "E-AI-MODE-UNSUPPORTED",
      messageFa: `${meta.titleFa} \u0627\u06CC\u0646 \u0631\u0648\u0634 \u0648\u0631\u0648\u062F \u0631\u0627 \u0646\u0645\u06CC\u200C\u067E\u0630\u06CC\u0631\u062F.`
    };
  }
  if (!cred.secret || !String(cred.secret).trim()) {
    return {
      ok: false,
      code: "E-AI-NO-SECRET",
      messageFa: mode === "account" ? "\u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F \u0628\u0627 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC\u060C \u0646\u0634\u0633\u062A \u0645\u0639\u062A\u0628\u0631 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A." : "\u06A9\u0644\u06CC\u062F \u0633\u0631\u0648\u06CC\u0633 \u0648\u0627\u0631\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A."
    };
  }
  return { ok: true };
}
function maskSecret(secret) {
  const s = String(secret ?? "");
  if (!s) return "";
  if (s.length <= 8) return "\u2022".repeat(s.length);
  return `${s.slice(0, 4)}${"\u2022".repeat(Math.min(12, s.length - 8))}${s.slice(-4)}`;
}
function buildWireRequest(cred, req, opts = {}) {
  const meta = PROVIDER_BY_ID.get(cred.provider);
  if (!meta) throw new Error(`unknown provider: ${cred.provider}`);
  if (meta.authModes.length === 0) throw new Error("rule engine has no wire request");
  const url = opts.url || meta.defaultUrl;
  const model = opts.model || meta.defaultModel;
  const maxTokens = req.maxOutputTokens ?? 1200;
  if (cred.provider === "claude") {
    return {
      url,
      headers: {
        "content-type": "application/json",
        "x-api-key": cred.secret,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: req.instructions,
        messages: [{ role: "user", content: req.input }]
      })
    };
  }
  if (cred.provider === "deepseek") {
    return {
      url,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cred.secret}`
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: req.instructions },
          { role: "user", content: req.input }
        ]
      })
    };
  }
  return {
    url,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cred.secret}`,
      ...cred.mode === "account" ? { "x-auth-mode": "account" } : {}
    },
    body: JSON.stringify({
      model,
      instructions: req.instructions,
      input: req.input,
      max_output_tokens: maxTokens
    })
  };
}
function extractText(provider, payload) {
  if (!payload || typeof payload !== "object") return null;
  const p = payload;
  if (provider === "deepseek") {
    const choices = p.choices;
    if (Array.isArray(choices) && choices.length) {
      const msg = choices[0]?.message;
      if (typeof msg?.content === "string" && msg.content) return msg.content;
    }
    return null;
  }
  if (provider === "claude") {
    const content = p.content;
    if (Array.isArray(content)) {
      const parts = content.filter((b) => Boolean(b) && typeof b === "object" && b.type === "text").map((b) => b.text);
      return parts.length ? parts.join("\n") : null;
    }
    return null;
  }
  if (typeof p.output_text === "string" && p.output_text) return p.output_text;
  const output = p.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        const b = block;
        if (b?.type === "output_text" && typeof b.text === "string") return b.text;
        if (b?.type === "text" && typeof b.text === "string") return b.text;
      }
    }
  }
  return null;
}
function classifyHttpFailure(status) {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "server";
  if (status >= 400) return "unknown";
  return "unknown";
}
function failureMessageFa(kind, providerId) {
  const name = PROVIDER_BY_ID.get(providerId)?.titleFa ?? providerId;
  switch (kind) {
    case "auth":
      return `${name}: \u0627\u0639\u062A\u0628\u0627\u0631 \u067E\u0630\u06CC\u0631\u0641\u062A\u0647 \u0646\u0634\u062F. \u06A9\u0644\u06CC\u062F \u06CC\u0627 \u0646\u0634\u0633\u062A \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u06CC\u062F.`;
    case "rate_limit":
      return `${name}: \u0633\u0642\u0641 \u0645\u0635\u0631\u0641 \u067E\u0631 \u0634\u062F\u0647 \u0627\u0633\u062A. \u06A9\u0645\u06CC \u0628\u0639\u062F \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u06A9\u0646\u06CC\u062F.`;
    case "timeout":
      return `${name}: \u067E\u0627\u0633\u062E \u062F\u0631 \u0645\u0647\u0644\u062A \u0645\u0642\u0631\u0631 \u0646\u0631\u0633\u06CC\u062F.`;
    case "server":
      return `${name}: \u0633\u0631\u0648\u06CC\u0633 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.`;
    case "network":
      return `${name}: \u0627\u062A\u0635\u0627\u0644 \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u0634\u062F.`;
    default:
      return `${name}: \u062E\u0637\u0627\u06CC \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647.`;
  }
}
function shouldFallbackToRule(kind) {
  return kind !== "auth";
}
export {
  AI_PROVIDERS,
  AI_VERSION,
  PROVIDER_BY_ID,
  buildWireRequest,
  checkCredential,
  classifyHttpFailure,
  extractText,
  failureMessageFa,
  isProviderId,
  maskSecret,
  shouldFallbackToRule
};
