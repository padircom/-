// src/services/lumpSumWeights.ts
function roundMoney(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}
function roundPct(n) {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

// src/services/breakdownExport.ts
var EXPORT_VERSION = "bex-v1";
function letterheadRows(lh) {
  const rows = [
    ["\u067E\u0631\u0648\u0698\u0647", lh.projectTitleFa, null, "\u06A9\u062F \u067E\u0631\u0648\u0698\u0647", lh.projectCode]
  ];
  if (lh.contractNo || lh.contractType) {
    rows.push(["\u0634\u0645\u0627\u0631\u0647 \u0642\u0631\u0627\u0631\u062F\u0627\u062F", lh.contractNo ?? "\u2014", null, "\u0646\u0648\u0639 \u0642\u0631\u0627\u0631\u062F\u0627\u062F", lh.contractType ?? "\u2014"]);
  }
  if (lh.contractAmount !== null && lh.contractAmount !== void 0) {
    rows.push(["\u0645\u0628\u0644\u063A \u0642\u0631\u0627\u0631\u062F\u0627\u062F", lh.contractAmount, lh.currency ?? "", "\u062A\u0627\u0631\u06CC\u062E \u062F\u0627\u062F\u0647", lh.dataDate]);
  } else {
    rows.push(["\u062A\u0627\u0631\u06CC\u062E \u062F\u0627\u062F\u0647", lh.dataDate, null, null, null]);
  }
  rows.push(["\u0648\u06CC\u0631\u0627\u06CC\u0634", lh.revision ?? "\u06F0", null, "\u062A\u0647\u06CC\u0647\u200C\u06A9\u0646\u0646\u062F\u0647", lh.preparedBy ?? "\u2014"]);
  rows.push([]);
  return rows;
}
var COMMON = [
  { key: "id", titleFa: "\u0634\u0646\u0627\u0633\u0647", titleEn: "Id", kind: "text" },
  { key: "code", titleFa: "\u06A9\u062F", titleEn: "Code", kind: "text" },
  { key: "parentCode", titleFa: "\u06A9\u062F \u0648\u0627\u0644\u062F", titleEn: "Parent", kind: "text" },
  { key: "depth", titleFa: "\u0633\u0637\u062D", titleEn: "Level", kind: "number" },
  { key: "titleFa", titleFa: "\u0634\u0631\u062D", titleEn: "Description", kind: "text" }
];
function columnsFor(view, custom = []) {
  const cols = [...COMMON];
  if (view === "cbs") {
    cols.push(
      { key: "costAccountCode", titleFa: "\u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647", titleEn: "Cost account", kind: "text" },
      { key: "weightValue", titleFa: "\u0648\u0632\u0646 \u06A9\u0644 (WV%)", titleEn: "WV%", kind: "percent" },
      { key: "amount", titleFa: "\u0645\u0628\u0644\u063A", titleEn: "Amount", kind: "money" }
    );
    return cols;
  }
  if (view === "wpa") {
    cols.push(
      { key: "weightFactor", titleFa: "\u0648\u0632\u0646 \u0646\u0633\u0628\u06CC (WF%)", titleEn: "WF%", kind: "percent" },
      { key: "weightValue", titleFa: "\u0648\u0632\u0646 \u06A9\u0644 (WV%)", titleEn: "WV%", kind: "percent" },
      { key: "amount", titleFa: "\u0645\u0628\u0644\u063A", titleEn: "Amount", kind: "money" },
      { key: "actualPct", titleFa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0648\u0627\u0642\u0639\u06CC", titleEn: "Actual %", kind: "percent" },
      { key: "basis", titleFa: "\u0645\u0628\u0646\u0627\u06CC \u0648\u0632\u0646", titleEn: "Basis", kind: "text" },
      { key: "sourceRefFa", titleFa: "\u0645\u0631\u062C\u0639", titleEn: "Source", kind: "text" }
    );
    return cols;
  }
  if (view === "pms") {
    cols.push(
      { key: "unit", titleFa: "\u0648\u0627\u062D\u062F", titleEn: "Unit", kind: "text" },
      { key: "qty", titleFa: "\u0645\u0642\u062F\u0627\u0631", titleEn: "Qty", kind: "number" },
      { key: "weightFactor", titleFa: "WF%", titleEn: "WF%", kind: "percent" },
      { key: "weightValue", titleFa: "WV%", titleEn: "WV%", kind: "percent" },
      { key: "amount", titleFa: "\u0645\u0628\u0644\u063A", titleEn: "Amount", kind: "money" },
      { key: "plannedPct", titleFa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC", titleEn: "Planned %", kind: "percent" },
      { key: "actualPct", titleFa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0648\u0627\u0642\u0639\u06CC", titleEn: "Actual %", kind: "percent" },
      { key: "variancePct", titleFa: "\u0627\u0646\u062D\u0631\u0627\u0641", titleEn: "Variance", kind: "percent" }
    );
    for (const c of custom) {
      cols.push({ key: `x:${c.key}`, titleFa: c.titleFa, titleEn: c.titleEn ?? c.key, kind: c.dataKind === "date" ? "text" : c.dataKind });
    }
    return cols;
  }
  cols.push(
    { key: "unit", titleFa: "\u0648\u0627\u062D\u062F", titleEn: "Unit", kind: "text" },
    { key: "qty", titleFa: "\u0645\u0642\u062F\u0627\u0631", titleEn: "Qty", kind: "number" },
    { key: "weightFactor", titleFa: "WF%", titleEn: "WF%", kind: "percent" },
    { key: "weightValue", titleFa: "WV%", titleEn: "WV%", kind: "percent" },
    { key: "sourceRefFa", titleFa: "\u0645\u0631\u062C\u0639", titleEn: "Source", kind: "text" }
  );
  return cols;
}
function variancePct(node) {
  if (node.actualPct === null || node.actualPct === void 0) return null;
  if (node.plannedPct === null || node.plannedPct === void 0) return null;
  return roundPct(node.actualPct - node.plannedPct);
}
function cellOf(node, col) {
  if (col.key.startsWith("x:")) {
    const k = col.key.slice(2);
    return node.custom?.[k] ?? null;
  }
  if (col.key === "variancePct") return variancePct(node);
  const v = node[col.key];
  if (v === void 0) return null;
  if (v === null) return null;
  if (col.kind === "money" && typeof v === "number") return roundMoney(v);
  if (col.kind === "percent" && typeof v === "number") return roundPct(v);
  return v;
}
function buildSheet(view, nodes, lh, custom = [], lang = "fa") {
  const cols = columnsFor(view, custom);
  const rows = [...letterheadRows(lh)];
  rows.push(cols.map((c) => lang === "fa" ? c.titleFa : c.titleEn));
  const headerRowIndex = rows.length - 1;
  rows.push(cols.map((c) => `#${c.key}`));
  for (const n of nodes) rows.push(cols.map((c) => cellOf(n, c)));
  return { name: view.toUpperCase(), rows, headerRowIndex };
}
var num = (v) => {
  if (v === null || v === void 0 || v === "") return null;
  const n = Number(String(v).replace(/[,٬]/g, "").replace("%", ""));
  return Number.isFinite(n) ? n : null;
};
function parseSheet(rows) {
  const issues = [];
  const keyRowIndex = rows.findIndex((r) => r.some((c) => typeof c === "string" && c.startsWith("#code")));
  if (keyRowIndex === -1) {
    return {
      nodes: [],
      issues: [{ rowNo: 0, severity: "error", messageFa: "\u0633\u0637\u0631 \u06A9\u0644\u06CC\u062F \u0633\u062A\u0648\u0646\u200C\u0647\u0627 (#code) \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F. \u0641\u0627\u06CC\u0644 \u0628\u0627\u06CC\u062F \u0627\u0632 \u0647\u0645\u06CC\u0646 \u0633\u0627\u0645\u0627\u0646\u0647 \u062E\u0631\u0648\u062C\u06CC \u06AF\u0631\u0641\u062A\u0647 \u0634\u062F\u0647 \u0628\u0627\u0634\u062F." }],
      updatedCount: 0,
      createdCount: 0
    };
  }
  const keys = rows[keyRowIndex].map((c) => typeof c === "string" && c.startsWith("#") ? c.slice(1) : "");
  const nodes = [];
  const seen = /* @__PURE__ */ new Set();
  let updatedCount = 0;
  let createdCount = 0;
  for (let i = keyRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === void 0 || c === "")) continue;
    const get = (k) => {
      const at = keys.indexOf(k);
      return at === -1 ? null : row[at] ?? null;
    };
    const code = String(get("code") ?? "").trim();
    if (!code) {
      issues.push({ rowNo: i + 1, severity: "error", messageFa: "\u0631\u062F\u06CC\u0641 \u0628\u062F\u0648\u0646 \u06A9\u062F \u0646\u0627\u062F\u06CC\u062F\u0647 \u06AF\u0631\u0641\u062A\u0647 \u0634\u062F." });
      continue;
    }
    if (seen.has(code)) {
      issues.push({ rowNo: i + 1, code, severity: "error", messageFa: `\u06A9\u062F \xAB${code}\xBB \u062A\u06A9\u0631\u0627\u0631\u06CC \u0627\u0633\u062A.` });
      continue;
    }
    seen.add(code);
    const id = get("id");
    if (id) updatedCount += 1;
    else createdCount += 1;
    const custom = {};
    keys.forEach((k, at) => {
      if (k.startsWith("x:")) custom[k.slice(2)] = row[at] ?? null;
    });
    const wf = num(get("weightFactor"));
    if (wf !== null && (wf < 0 || wf > 100)) {
      issues.push({ rowNo: i + 1, code, severity: "error", messageFa: `\u0648\u0632\u0646 \u0646\u0633\u0628\u06CC ${wf} \u062E\u0627\u0631\u062C \u0627\u0632 \u0628\u0627\u0632\u0647\u0654 \u06F0 \u062A\u0627 \u06F1\u06F0\u06F0 \u0627\u0633\u062A.` });
    }
    const actual = num(get("actualPct"));
    if (actual !== null && (actual < 0 || actual > 100)) {
      issues.push({ rowNo: i + 1, code, severity: "warning", messageFa: `\u067E\u06CC\u0634\u0631\u0641\u062A ${actual} \u0645\u0647\u0627\u0631 \u0634\u062F.` });
    }
    nodes.push({
      id: id ? String(id) : null,
      code,
      parentCode: get("parentCode") ? String(get("parentCode")) : null,
      titleFa: String(get("titleFa") ?? ""),
      depth: num(get("depth")) ?? 1,
      unit: get("unit") ? String(get("unit")) : null,
      qty: num(get("qty")),
      weightFactor: wf,
      weightValue: num(get("weightValue")),
      amount: num(get("amount")),
      costAccountCode: get("costAccountCode") ? String(get("costAccountCode")) : null,
      plannedPct: num(get("plannedPct")),
      actualPct: actual === null ? null : Math.min(100, Math.max(0, actual)),
      sourceRefFa: get("sourceRefFa") ? String(get("sourceRefFa")) : null,
      custom: Object.keys(custom).length ? custom : void 0
    });
  }
  const codes = new Set(nodes.map((n) => n.code));
  for (const n of nodes) {
    if (n.parentCode && !codes.has(n.parentCode)) {
      issues.push({ rowNo: 0, code: n.code, severity: "error", messageFa: `\u0648\u0627\u0644\u062F \xAB${n.parentCode}\xBB \u062F\u0631 \u0641\u0627\u06CC\u0644 \u0646\u06CC\u0633\u062A.` });
    }
  }
  return { nodes, issues, updatedCount, createdCount };
}
function diffNodes(current, incoming) {
  const byCode = new Map(current.map((n) => [n.code, n]));
  const inCodes = new Set(incoming.map((n) => n.code));
  const changed = [];
  const added = [];
  const WATCH = ["titleFa", "parentCode", "unit", "qty", "weightFactor", "weightValue", "amount", "costAccountCode", "plannedPct", "actualPct"];
  for (const n of incoming) {
    const old = byCode.get(n.code);
    if (!old) {
      added.push(n.code);
      continue;
    }
    for (const f of WATCH) {
      const a = old[f] ?? null;
      const b = n[f] ?? null;
      if (a === null && b === null) continue;
      if (String(a) !== String(b)) changed.push({ code: n.code, field: String(f), before: a, after: b });
    }
  }
  const removed = current.filter((n) => !inCodes.has(n.code)).map((n) => n.code);
  return { changed, added, removed };
}
var xerEscape = (v) => String(v ?? "").replace(/[\t\r\n]/g, " ");
function buildXer(nodes, lh) {
  const stamp = lh.dataDate.replace(/-/g, "");
  const lines = [];
  lines.push(["ERMHDR", "19.12", stamp, "Project", "PMIS", "PMIS Export", "USD"].join("	"));
  lines.push("%T	PROJWBS");
  lines.push(["%F", "wbs_id", "proj_id", "parent_wbs_id", "seq_num", "wbs_short_name", "wbs_name", "proj_node_flag", "status_code"].join("	"));
  const idOf = /* @__PURE__ */ new Map();
  nodes.forEach((n, i) => idOf.set(n.code, 1e3 + i));
  const root = 999;
  lines.push(["%R", String(root), "1", "", "0", lh.projectCode, lh.projectTitleFa, "Y", "WS_Open"].join("	"));
  nodes.forEach((n, i) => {
    const parent = n.parentCode ? idOf.get(n.parentCode) ?? root : root;
    lines.push([
      "%R",
      String(idOf.get(n.code)),
      "1",
      String(parent),
      String(i + 1),
      xerEscape(n.code),
      xerEscape(n.titleFa),
      "N",
      "WS_Open"
    ].join("	"));
  });
  lines.push("%E");
  return lines.join("\n");
}
var xmlEscape = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function buildMspXml(nodes, lh) {
  const ordered = depthFirst(nodes);
  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  parts.push('<Project xmlns="http://schemas.microsoft.com/project">');
  parts.push(`  <Name>${xmlEscape(lh.projectCode)}</Name>`);
  parts.push(`  <Title>${xmlEscape(lh.projectTitleFa)}</Title>`);
  parts.push(`  <StatusDate>${xmlEscape(lh.dataDate)}T00:00:00</StatusDate>`);
  parts.push("  <Tasks>");
  ordered.forEach((n, i) => {
    parts.push("    <Task>");
    parts.push(`      <UID>${i + 1}</UID>`);
    parts.push(`      <ID>${i + 1}</ID>`);
    parts.push(`      <Name>${xmlEscape(n.titleFa)}</Name>`);
    parts.push(`      <OutlineLevel>${Math.max(1, n.depth)}</OutlineLevel>`);
    parts.push(`      <WBS>${xmlEscape(n.code)}</WBS>`);
    if (n.actualPct !== null && n.actualPct !== void 0) {
      parts.push(`      <PercentComplete>${Math.round(n.actualPct)}</PercentComplete>`);
    }
    parts.push(`      <Summary>${hasChildren(nodes, n.code) ? 1 : 0}</Summary>`);
    parts.push("    </Task>");
  });
  parts.push("  </Tasks>");
  parts.push("</Project>");
  return parts.join("\n");
}
function hasChildren(nodes, code) {
  return nodes.some((n) => n.parentCode === code);
}
function depthFirst(nodes) {
  const childrenOf = /* @__PURE__ */ new Map();
  const roots = [];
  const codes = new Set(nodes.map((n) => n.code));
  for (const n of nodes) {
    if (n.parentCode && codes.has(n.parentCode)) {
      const list = childrenOf.get(n.parentCode) ?? [];
      list.push(n);
      childrenOf.set(n.parentCode, list);
    } else {
      roots.push(n);
    }
  }
  const out = [];
  const guard = /* @__PURE__ */ new Set();
  const walk = (n) => {
    if (guard.has(n.code)) return;
    guard.add(n.code);
    out.push(n);
    for (const c of childrenOf.get(n.code) ?? []) walk(c);
  };
  roots.forEach(walk);
  for (const n of nodes) if (!guard.has(n.code)) out.push(n);
  return out;
}
function exportFileName(lh, view, ext) {
  const safe = (s) => s.replace(/[\\/:*?"<>|]/g, "-").trim();
  const rev = lh.revision ? `-R${safe(lh.revision)}` : "";
  return `${safe(lh.projectCode)}-${view.toUpperCase()}-${lh.dataDate}${rev}.${ext}`;
}
export {
  EXPORT_VERSION,
  buildMspXml,
  buildSheet,
  buildXer,
  columnsFor,
  depthFirst,
  diffNodes,
  exportFileName,
  letterheadRows,
  parseSheet,
  variancePct
};
