// src/services/wbsCommands.ts
var WBS_CMD_VERSION = "wcmd-v1";
var FA_DIGITS = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9";
function toLatinDigits(s) {
  return s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
}
var WORD_NUMBERS = {
  \u06CC\u06A9: 1,
  \u062F\u0648: 2,
  \u0633\u0647: 3,
  \u0686\u0647\u0627\u0631: 4,
  \u067E\u0646\u062C: 5,
  \u0634\u0634: 6,
  \u0647\u0641\u062A: 7,
  \u0647\u0634\u062A: 8,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6
};
function findNumber(text) {
  const t = toLatinDigits(text);
  const digit = t.match(/\d+/);
  if (digit) return Number(digit[0]);
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (t.includes(word)) return n;
  }
  return null;
}
function parseCommand(input) {
  const raw = String(input ?? "").trim();
  const t = toLatinDigits(raw).toLowerCase();
  const mentionsLevel = /سطح|level|عمق|depth/.test(t);
  const mentionsRemove = /حذف|پاک|remove|delete|drop/.test(t);
  const mentionsKeep = /نگه|تا سطح|keep|limit|حداکثر/.test(t);
  if (mentionsLevel && (mentionsRemove || mentionsKeep)) {
    const n = findNumber(t);
    if (n !== null && n > 0) {
      const keep = mentionsKeep && !mentionsRemove ? n : n - 1;
      return { kind: "prune_depth", value: Math.max(1, keep), raw };
    }
  }
  if (mentionsRemove) {
    const code = raw.match(/[A-Za-z]+[\w.\-]*/)?.[0];
    if (code && !/سطح|level/.test(t)) {
      return { kind: "drop_branch", target: code, raw };
    }
  }
  if (/شماره|renumber|بازشماری|کدگذاری/.test(t)) {
    return { kind: "renumber", raw };
  }
  if (/تغییر نام|rename|عنوانش|نامش/.test(t)) {
    const code = raw.match(/[A-Za-z]+[\w.\-]*/)?.[0];
    const quoted = raw.match(/[«"']([^»"']+)[»"']/)?.[1];
    if (code && quoted) return { kind: "rename", target: code, text: quoted, raw };
  }
  return { kind: "ai", raw };
}
function descendantsOf(nodes, code) {
  const out = [];
  const walk = (parent) => {
    for (const n of nodes) {
      if (n.parentCode === parent && !out.includes(n.code)) {
        out.push(n.code);
        walk(n.code);
      }
    }
  };
  walk(code);
  return out;
}
function pruneDepth(nodes, keep) {
  const kept = nodes.filter((n) => n.depth <= keep);
  const affected = nodes.length - kept.length;
  return {
    nodes: kept,
    changed: affected > 0,
    affected,
    messageFa: affected > 0 ? `${affected} \u06AF\u0631\u0647 \u0639\u0645\u06CC\u0642\u200C\u062A\u0631 \u0627\u0632 \u0633\u0637\u062D ${keep} \u062D\u0630\u0641 \u0634\u062F.` : `\u0647\u06CC\u0686 \u06AF\u0631\u0647\u06CC \u0639\u0645\u06CC\u0642\u200C\u062A\u0631 \u0627\u0632 \u0633\u0637\u062D ${keep} \u0646\u0628\u0648\u062F.`
  };
}
function dropBranch(nodes, code) {
  const exists = nodes.some((n) => n.code.toLowerCase() === code.toLowerCase());
  if (!exists) {
    return { nodes, changed: false, affected: 0, messageFa: `\u06AF\u0631\u0647\u06CC \u0628\u0627 \u06A9\u062F \xAB${code}\xBB \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.` };
  }
  const real = nodes.find((n) => n.code.toLowerCase() === code.toLowerCase()).code;
  const doomed = /* @__PURE__ */ new Set([real, ...descendantsOf(nodes, real)]);
  const kept = nodes.filter((n) => !doomed.has(n.code));
  return {
    nodes: kept,
    changed: true,
    affected: doomed.size,
    messageFa: `\u0634\u0627\u062E\u0647\u0654 \xAB${real}\xBB \u0628\u0627 ${doomed.size - 1} \u0632\u06CC\u0631\u0634\u0627\u062E\u0647 \u062D\u0630\u0641 \u0634\u062F.`
  };
}
function renameNode(nodes, code, title) {
  let hit = false;
  const next = nodes.map((n) => {
    if (n.code.toLowerCase() !== code.toLowerCase()) return n;
    hit = true;
    return { ...n, titleFa: title };
  });
  return {
    nodes: next,
    changed: hit,
    affected: hit ? 1 : 0,
    messageFa: hit ? `\u0639\u0646\u0648\u0627\u0646 \xAB${code}\xBB \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F.` : `\u06AF\u0631\u0647\u06CC \u0628\u0627 \u06A9\u062F \xAB${code}\xBB \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.`
  };
}
function renumber(nodes) {
  if (nodes.length === 0) {
    return { nodes, changed: false, affected: 0, messageFa: "\u062F\u0631\u062E\u062A\u06CC \u0628\u0631\u0627\u06CC \u0634\u0645\u0627\u0631\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0646\u06CC\u0633\u062A." };
  }
  const childrenOf = /* @__PURE__ */ new Map();
  const roots = [];
  const codes = new Set(nodes.map((n) => n.code));
  for (const n of nodes) {
    if (n.parentCode && codes.has(n.parentCode)) {
      const arr = childrenOf.get(n.parentCode) ?? [];
      arr.push(n);
      childrenOf.set(n.parentCode, arr);
    } else {
      roots.push(n);
    }
  }
  const out = [];
  const guard = /* @__PURE__ */ new Set();
  const walk = (n, prefix, parentNew, depth) => {
    if (guard.has(n.code)) return;
    guard.add(n.code);
    out.push({ ...n, code: prefix, parentCode: parentNew, depth });
    (childrenOf.get(n.code) ?? []).forEach((c, i) => walk(c, `${prefix}-${i + 1}`, prefix, depth + 1));
  };
  roots.forEach((r, i) => walk(r, String(i + 1), null, 1));
  for (const n of nodes) if (!guard.has(n.code)) out.push(n);
  return { nodes: out, changed: true, affected: out.length, messageFa: `${out.length} \u06AF\u0631\u0647 \u062F\u0648\u0628\u0627\u0631\u0647 \u0634\u0645\u0627\u0631\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0634\u062F.` };
}
function applyCommand(nodes, cmd) {
  switch (cmd.kind) {
    case "prune_depth":
      return pruneDepth(nodes, cmd.value ?? 1);
    case "drop_branch":
      return dropBranch(nodes, cmd.target ?? "");
    case "rename":
      return renameNode(nodes, cmd.target ?? "", cmd.text ?? "");
    case "renumber":
      return renumber(nodes);
    default:
      return { nodes, changed: false, affected: 0, messageFa: "\u0627\u06CC\u0646 \u062F\u0633\u062A\u0648\u0631 \u0628\u0647 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u0633\u067E\u0631\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F." };
  }
}
var COMMAND_HINTS = [
  { fa: "\u062A\u0627 \u0633\u0637\u062D \u06F3 \u0646\u06AF\u0647 \u062F\u0627\u0631", en: "Keep to level 3" },
  { fa: "\u062F\u0648\u0628\u0627\u0631\u0647 \u0634\u0645\u0627\u0631\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u06A9\u0646", en: "Renumber" },
  { fa: "\u0634\u0627\u062E\u0647\u0654 P \u0631\u0627 \u062D\u0630\u0641 \u06A9\u0646", en: "Drop branch P" },
  { fa: "\u062A\u062F\u0627\u0631\u06A9\u0627\u062A \u0631\u0627 \u0628\u0647 \u0633\u0647 \u0628\u0633\u062A\u0647\u0654 \u0641\u0631\u0639\u06CC \u0628\u0634\u06A9\u0646", en: "Split procurement into three packages" }
];
var HISTORY_LIMIT = 20;
function pushHistory(list, entry) {
  return [...list, entry].slice(-HISTORY_LIMIT);
}
function undo(list) {
  if (list.length === 0) return { nodes: null, history: list };
  const last = list[list.length - 1];
  return { nodes: last.before, history: list.slice(0, -1) };
}
export {
  COMMAND_HINTS,
  HISTORY_LIMIT,
  WBS_CMD_VERSION,
  applyCommand,
  descendantsOf,
  dropBranch,
  parseCommand,
  pruneDepth,
  pushHistory,
  renameNode,
  renumber,
  undo
};
