// src/services/plainErrors.ts
var PLAIN_ERROR_VERSION = "perr-v1";
var RULES = [
  {
    match: /api\.(deepseek|openai|anthropic)\.com|E-AI-UNREACHABLE/i,
    titleFa: "\u0633\u0631\u0648\u06CC\u0633 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.",
    titleEn: "The AI service is unreachable.",
    actionFa: "\u0627\u062A\u0635\u0627\u0644 \u0627\u06CC\u0646\u062A\u0631\u0646\u062A \u0633\u0631\u0648\u0631 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u06CC\u062F. \u0627\u06AF\u0631 \u067E\u0634\u062A \u0641\u0627\u06CC\u0631\u0648\u0627\u0644 \u0647\u0633\u062A\u06CC\u062F\u060C \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0646\u0634\u0627\u0646\u06CC \u0633\u0631\u0648\u06CC\u0633 \u0628\u0627\u06CC\u062F \u0628\u0627\u0632 \u0634\u0648\u062F.",
    actionEn: "Check the server's internet connection and firewall access to the service.",
    needsAdmin: true
  },
  {
    match: /E-AI-NO-SECRET|کلید سرویس وارد نشده/i,
    titleFa: "\u06A9\u0644\u06CC\u062F \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u0648\u0627\u0631\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.",
    titleEn: "No AI key has been entered.",
    actionFa: "\u0628\u0647 \xAB\u0645\u062F\u06CC\u0631\u06CC\u062A \u0633\u0627\u0645\u0627\u0646\u0647 \u2190 \u06F5. \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u0648 \u06CC\u06A9\u067E\u0627\u0631\u0686\u06AF\u06CC\xBB \u0628\u0631\u0648\u06CC\u062F \u0648 \u06A9\u0644\u06CC\u062F \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F.",
    actionEn: "Go to System Management \u2192 5. AI & Integrations and enter the key.",
    needsAdmin: false
  },
  {
    match: /E-AI-ARENA-NO-SESSION/i,
    titleFa: "\u062D\u0633\u0627\u0628 Arena.ai \u0628\u0647 \u0628\u0631\u0646\u0627\u0645\u0647 \u0648\u0635\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.",
    titleEn: "The Arena.ai account is not linked.",
    actionFa: "\u0641\u0639\u0644\u0627\u064B \u062F\u0631 \xAB\u0645\u062F\u06CC\u0631\u06CC\u062A \u0633\u0627\u0645\u0627\u0646\u0647 \u2190 \u06F5\xBB \u0633\u0631\u0648\u06CC\u0633 \u062F\u06CC\u06AF\u0631\u06CC \u0645\u062B\u0644 OpenAI \u0631\u0627 \u0628\u0627 \u06A9\u0644\u06CC\u062F \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F.",
    actionEn: "For now choose another provider with a key in System Management \u2192 5.",
    needsAdmin: false
  },
  {
    match: /موتور قاعده‌محور ترجمه نمی‌کند|simulator/i,
    titleFa: "\u0633\u0631\u0648\u06CC\u0633 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u0631\u0648\u06CC \u062D\u0627\u0644\u062A \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0627\u0633\u062A.",
    titleEn: "The AI service is in simulator mode.",
    actionFa: "\u062F\u0631 \xAB\u0645\u062F\u06CC\u0631\u06CC\u062A \u0633\u0627\u0645\u0627\u0646\u0647 \u2190 \u06F5\xBB \u06CC\u06A9 \u0633\u0631\u0648\u06CC\u0633 \u0648\u0627\u0642\u0639\u06CC (\u0645\u062B\u0644 OpenAI) \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F.",
    actionEn: "Pick a real provider in System Management \u2192 5.",
    needsAdmin: false
  },
  {
    /* نشانه‌های نرسیدن به SQL Server. */
    match: /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EINSTLOOKUP|ELOGIN|Failed to connect|socket hang up/i,
    titleFa: "\u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647\u0654 \u067E\u0631\u0648\u0698\u0647 \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A.",
    titleEn: "The project database is not connected.",
    actionFa: "\u0627\u06CC\u0646 \u0628\u062E\u0634 \u0628\u0631\u0627\u06CC \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0627\u0633\u0646\u0627\u062F \u0628\u0647 SQL Server \u0646\u06CC\u0627\u0632 \u062F\u0627\u0631\u062F. \u0627\u0632 \u0645\u062F\u06CC\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0628\u062E\u0648\u0627\u0647\u06CC\u062F \u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0628\u0631\u0642\u0631\u0627\u0631 \u06A9\u0646\u062F.",
    actionEn: "This area needs SQL Server. Ask your administrator to connect it.",
    needsAdmin: true
  },
  {
    match: /NO_TEXT_FOUND|No extractable text|OCR/i,
    titleFa: "\u0627\u0632 \u0627\u06CC\u0646 \u0641\u0627\u06CC\u0644 \u0645\u062A\u0646\u06CC \u062E\u0648\u0627\u0646\u062F\u0647 \u0646\u0634\u062F.",
    titleEn: "No text could be read from this file.",
    actionFa: "\u0627\u062D\u062A\u0645\u0627\u0644\u0627\u064B \u0641\u0627\u06CC\u0644 \u0627\u0633\u06A9\u0646\u200C\u0634\u062F\u0647 (\u0639\u06A9\u0633) \u0627\u0633\u062A. \u0646\u0633\u062E\u0647\u0654 \u0645\u062A\u0646\u06CC PDF \u0631\u0627 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u06A9\u0646\u06CC\u062F \u06CC\u0627 \u0645\u062A\u0646 \u0631\u0627 \u062F\u0633\u062A\u06CC \u0628\u0686\u0633\u0628\u0627\u0646\u06CC\u062F.",
    actionEn: "The file is probably a scan. Upload a text-based PDF or paste the text.",
    needsAdmin: false
  },
  {
    match: /FILE_REQUIRED|EXTRACT_FAILED/i,
    titleFa: "\u0641\u0627\u06CC\u0644 \u062E\u0648\u0627\u0646\u062F\u0647 \u0646\u0634\u062F.",
    titleEn: "The file could not be read.",
    actionFa: "\u0641\u0627\u06CC\u0644 \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A \u062E\u0631\u0627\u0628 \u06CC\u0627 \u0631\u0645\u0632\u06AF\u0630\u0627\u0631\u06CC\u200C\u0634\u062F\u0647 \u0628\u0627\u0634\u062F. \u0641\u0627\u06CC\u0644 \u062F\u06CC\u06AF\u0631\u06CC \u0631\u0627 \u0627\u0645\u062A\u062D\u0627\u0646 \u06A9\u0646\u06CC\u062F.",
    actionEn: "The file may be damaged or password-protected. Try another file.",
    needsAdmin: false
  },
  {
    match: /\b40[13]\b|UNAUTHORIZED|FORBIDDEN|دسترسی/i,
    titleFa: "\u0627\u062C\u0627\u0632\u0647\u0654 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.",
    titleEn: "You do not have permission for this area.",
    actionFa: "\u0627\u0632 \u0645\u062F\u06CC\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0628\u062E\u0648\u0627\u0647\u06CC\u062F \u0646\u0642\u0634 \u0634\u0645\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u062F.",
    actionEn: "Ask your administrator to review your role.",
    needsAdmin: true
  },
  {
    match: /NOT_FOUND|was not found/i,
    titleFa: "\u0627\u06CC\u0646 \u0642\u0627\u0628\u0644\u06CC\u062A \u0631\u0648\u06CC \u0633\u0631\u0648\u0631 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A.",
    titleEn: "This feature is not enabled on the server.",
    actionFa: "\u0646\u0633\u062E\u0647\u0654 \u0633\u0631\u0648\u0631 \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A \u0642\u062F\u06CC\u0645\u06CC \u0628\u0627\u0634\u062F. \u0628\u0627 \u0645\u062F\u06CC\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F.",
    actionEn: "The server build may be outdated. Contact your administrator.",
    needsAdmin: true
  },
  {
    match: /Failed to fetch|NetworkError|ERR_NETWORK/i,
    titleFa: "\u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0633\u0631\u0648\u0631 \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u0634\u062F.",
    titleEn: "Could not reach the server.",
    actionFa: "\u0627\u062A\u0635\u0627\u0644 \u0634\u0628\u06A9\u0647 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u06CC\u062F \u0648 \u0635\u0641\u062D\u0647 \u0631\u0627 \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u06A9\u0646\u06CC\u062F.",
    actionEn: "Check your connection and reload the page.",
    needsAdmin: false
  }
];
function toPlainError(raw) {
  const technical = raw instanceof Error ? raw.message : String(raw ?? "");
  const hit = RULES.find((r) => r.match.test(technical));
  if (!hit) {
    return {
      titleFa: "\u0627\u06CC\u0646 \u0628\u062E\u0634 \u0627\u0644\u0627\u0646 \u06A9\u0627\u0631 \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F.",
      titleEn: "This area is not working right now.",
      actionFa: "\u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u06A9\u0646\u06CC\u062F. \u0627\u06AF\u0631 \u062A\u06A9\u0631\u0627\u0631 \u0634\u062F\u060C \u0645\u062A\u0646 \u0641\u0646\u06CC \u0632\u06CC\u0631 \u0631\u0627 \u0628\u0647 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0628\u062F\u0647\u06CC\u062F.",
      actionEn: "Try again. If it repeats, send the technical detail below to support.",
      needsAdmin: false,
      technical
    };
  }
  return {
    titleFa: hit.titleFa,
    titleEn: hit.titleEn,
    actionFa: hit.actionFa,
    actionEn: hit.actionEn,
    needsAdmin: hit.needsAdmin,
    technical
  };
}
function areaHealth(errors) {
  const real = errors.filter((e) => Boolean(e && e.trim()));
  if (real.length === 0) return "ready";
  const blocking = real.some((e) => /ENOTFOUND|ECONNREFUSED|EINSTLOOKUP|NOT_FOUND|ELOGIN/i.test(e));
  return blocking ? "offline" : "degraded";
}
var HEALTH_LABEL = {
  ready: { fa: "\u0622\u0645\u0627\u062F\u0647", en: "Ready", color: "#8FE3C8" },
  degraded: { fa: "\u0628\u0627 \u0645\u062D\u062F\u0648\u062F\u06CC\u062A", en: "Limited", color: "#FFD48A" },
  offline: { fa: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644", en: "Offline", color: "#FF9F9F" }
};
export {
  HEALTH_LABEL,
  PLAIN_ERROR_VERSION,
  areaHealth,
  toPlainError
};
