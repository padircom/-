// src/services/workshopSession.ts
var SESSION_VERSION = "wsess-v1";
var MAX_STORED_TEXT = 4e5;
function emptySession() {
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
    textTruncated: false
  };
}
function sessionKey(projectCode) {
  const safe = String(projectCode || "default").trim() || "default";
  return `arena.workshop.${safe}`;
}
var str = (v, fallback = "") => typeof v === "string" ? v : fallback;
var num = (v, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
function sanitiseNode(v) {
  if (!v || typeof v !== "object") return null;
  const n = v;
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
    plannedPct: typeof n.plannedPct === "number" ? n.plannedPct : null
  };
}
function sanitiseSession(v) {
  const base = emptySession();
  if (!v || typeof v !== "object") return base;
  const s = v;
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
    nodes: Array.isArray(s.nodes) ? s.nodes.map(sanitiseNode).filter((n) => n !== null) : [],
    textTruncated: Boolean(s.textTruncated)
  };
}
function storageOf(given) {
  if (given) return given;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
function loadSession(projectCode, storage) {
  try {
    const store = storageOf(storage);
    if (!store) return emptySession();
    const raw = store.getItem(sessionKey(projectCode));
    if (!raw) return emptySession();
    return sanitiseSession(JSON.parse(raw));
  } catch {
    return emptySession();
  }
}
function saveSession(projectCode, session, storage) {
  const store = storageOf(storage);
  if (!store) return { ok: false, truncated: false, reasonFa: "\u062D\u0627\u0641\u0638\u0647\u0654 \u0645\u0631\u0648\u0631\u06AF\u0631 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A." };
  const truncated = session.rawText.length > MAX_STORED_TEXT;
  const payload = truncated ? { ...session, rawText: session.rawText.slice(0, MAX_STORED_TEXT), textTruncated: true } : session;
  try {
    store.setItem(sessionKey(projectCode), JSON.stringify(payload));
    return { ok: true, truncated };
  } catch {
    try {
      store.setItem(
        sessionKey(projectCode),
        JSON.stringify({ ...payload, rawText: "", translated: "", textTruncated: true })
      );
      return {
        ok: true,
        truncated: true,
        reasonFa: "\u062D\u0627\u0641\u0638\u0647 \u067E\u0631 \u0628\u0648\u062F\u061B \u0633\u0627\u062E\u062A\u0627\u0631 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F \u0648\u0644\u06CC \u0645\u062A\u0646 \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0646\u0634\u062F."
      };
    } catch {
      return { ok: false, truncated: false, reasonFa: "\u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC \u0645\u0645\u06A9\u0646 \u0646\u0634\u062F\u061B \u0646\u0634\u0633\u062A \u0641\u0642\u0637 \u062A\u0627 \u067E\u0627\u06CC\u0627\u0646 \u0627\u06CC\u0646 \u0628\u0627\u0632\u062F\u06CC\u062F \u0645\u06CC\u200C\u0645\u0627\u0646\u062F." };
    }
  }
}
function clearSession(projectCode, storage) {
  try {
    storageOf(storage)?.removeItem(sessionKey(projectCode));
  } catch {
  }
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "\u2014";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function summarise(session, lang = "fa") {
  const loaded = session.loadedAt ? new Date(session.loadedAt) : null;
  const valid = loaded && !Number.isNaN(loaded.getTime());
  return {
    hasFile: Boolean(session.fileName),
    fileName: session.fileName,
    sizeLabel: session.fileSize > 0 ? formatBytes(session.fileSize) : "\u2014",
    charLabel: session.rawText.length.toLocaleString(lang === "fa" ? "fa-IR" : "en-US"),
    loadedLabel: valid ? loaded.toLocaleString(lang === "fa" ? "fa-IR" : "en-US", { dateStyle: "short", timeStyle: "short" }) : "\u2014",
    nodeCount: session.nodes.length,
    hasTranslation: session.translated.trim().length > 0,
    truncated: session.textTruncated
  };
}
export {
  MAX_STORED_TEXT,
  SESSION_VERSION,
  clearSession,
  emptySession,
  formatBytes,
  loadSession,
  sanitiseSession,
  saveSession,
  sessionKey,
  summarise
};
