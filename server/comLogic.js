// src/services/commissioning.ts
var SYSTEM_TYPES = ["system", "subsystem", "package"];
var SYSTEM_STATUSES = ["planned", "precomm", "comm", "handed_over", "closed"];
var GATE_TYPES = ["mc", "rfsu", "pac", "fac"];
var BOUNDARY_KINDS = ["wbs", "activity", "pid", "equipment", "tag"];
var CRITICALITIES = ["high", "medium", "low"];
var SYSTEM_TYPE_FA = {
  system: "\u0633\u06CC\u0633\u062A\u0645",
  subsystem: "\u0632\u06CC\u0631\u0633\u06CC\u0633\u062A\u0645",
  package: "\u0628\u0633\u062A\u0647"
};
var SYSTEM_STATUS_FA = {
  planned: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647",
  precomm: "\u067E\u06CC\u0634\u200C\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC",
  comm: "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC",
  handed_over: "\u062A\u062D\u0648\u06CC\u0644\u200C\u0634\u062F\u0647",
  closed: "\u0628\u0633\u062A\u0647"
};
var GATE_TYPE_FA = {
  mc: "\u062A\u06A9\u0645\u06CC\u0644 \u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC",
  rfsu: "\u0622\u0645\u0627\u062F\u06AF\u06CC \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC",
  pac: "\u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A",
  fac: "\u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC"
};
var BOUNDARY_KIND_FA = {
  wbs: "\u0628\u0633\u062A\u0647\u0654 \u06A9\u0627\u0631\u06CC",
  activity: "\u0641\u0639\u0627\u0644\u06CC\u062A",
  pid: "\u0646\u0642\u0634\u0647\u0654 \u0641\u0631\u0622\u06CC\u0646\u062F\u06CC",
  equipment: "\u062A\u062C\u0647\u06CC\u0632",
  tag: "\u0628\u0631\u0686\u0633\u0628"
};
var CRITICALITY_FA = {
  high: "\u0628\u062D\u0631\u0627\u0646\u06CC",
  medium: "\u0645\u062A\u0648\u0633\u0637",
  low: "\u06A9\u0645"
};
var GATE_ORDER = ["mc", "rfsu", "pac", "fac"];
function previousGate(gate) {
  const i = GATE_ORDER.indexOf(gate);
  return i <= 0 ? null : GATE_ORDER[i - 1];
}
var CODE_RE = /^[A-Za-z0-9][A-Za-z0-9\-_.]{0,39}$/;
function validateSystemCode(code) {
  const v = (code ?? "").trim();
  if (!v) return { code: "E-COM-CODE-REQUIRED", message: "\u06A9\u062F \u0633\u06CC\u0633\u062A\u0645 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" };
  if (!CODE_RE.test(v))
    return {
      code: "E-COM-CODE-INVALID",
      message: "\u06A9\u062F \u0633\u06CC\u0633\u062A\u0645 \u0641\u0642\u0637 \u062D\u0631\u0641 \u0644\u0627\u062A\u06CC\u0646\u060C \u0631\u0642\u0645\u060C \u062E\u0637 \u062A\u06CC\u0631\u0647\u060C \u0632\u06CC\u0631\u062E\u0637 \u0648 \u0646\u0642\u0637\u0647 \u0645\u06CC\u200C\u067E\u0630\u06CC\u0631\u062F \u0648 \u0628\u0627\u06CC\u062F \u0628\u0627 \u062D\u0631\u0641 \u06CC\u0627 \u0631\u0642\u0645 \u0634\u0631\u0648\u0639 \u0634\u0648\u062F"
    };
  return null;
}
function validateSystemInput(input) {
  const errors = [];
  const codeErr = validateSystemCode(input.systemCode ?? "");
  if (codeErr) errors.push(codeErr);
  if (!(input.titleFa ?? "").trim())
    errors.push({ code: "E-COM-TITLE-REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0641\u0627\u0631\u0633\u06CC \u0633\u06CC\u0633\u062A\u0645 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  if (!SYSTEM_TYPES.includes(input.systemType))
    errors.push({ code: "E-COM-TYPE-INVALID", message: `\u0646\u0648\u0639 \u0633\u06CC\u0633\u062A\u0645 \u0628\u0627\u06CC\u062F \u06CC\u06A9\u06CC \u0627\u0632 ${SYSTEM_TYPES.join("\u060C ")} \u0628\u0627\u0634\u062F` });
  if (input.status !== void 0 && !SYSTEM_STATUSES.includes(input.status))
    errors.push({ code: "E-COM-STATUS-INVALID", message: `\u0648\u0636\u0639\u06CC\u062A \u0633\u06CC\u0633\u062A\u0645 \u0628\u0627\u06CC\u062F \u06CC\u06A9\u06CC \u0627\u0632 ${SYSTEM_STATUSES.join("\u060C ")} \u0628\u0627\u0634\u062F` });
  if (input.criticalityFa != null && input.criticalityFa !== "" && !CRITICALITIES.includes(input.criticalityFa))
    errors.push({ code: "E-COM-CRITICALITY-INVALID", message: "\u0628\u062D\u0631\u0627\u0646\u06CC\u062A \u0628\u0627\u06CC\u062F high \u06CC\u0627 medium \u06CC\u0627 low \u0628\u0627\u0634\u062F" });
  const p = input.commissioningPriority;
  if (p != null && (!Number.isFinite(p) || p < 1 || Math.floor(p) !== p))
    errors.push({ code: "E-COM-PRIORITY-INVALID", message: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0628\u0627\u06CC\u062F \u0639\u062F\u062F \u0635\u062D\u06CC\u062D \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F" });
  return errors;
}
function detectCycle(nodes, childId, newParentId) {
  if (!newParentId) return null;
  if (newParentId === childId)
    return { code: "E-COM-SELF-PARENT", message: "\u06CC\u06A9 \u0633\u06CC\u0633\u062A\u0645 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0648\u0627\u0644\u062F \u062E\u0648\u062F\u0634 \u0628\u0627\u0634\u062F" };
  const byId = new Map(nodes.map((n) => [n.Id, n]));
  const seen = /* @__PURE__ */ new Set([childId]);
  let cursor = newParentId;
  while (cursor) {
    if (seen.has(cursor))
      return { code: "E-COM-CYCLE", message: "\u0627\u06CC\u0646 \u0627\u0646\u062A\u0633\u0627\u0628 \u062F\u0631 \u062F\u0631\u062E\u062A \u0633\u06CC\u0633\u062A\u0645\u200C\u0647\u0627 \u062D\u0644\u0642\u0647 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F" };
    seen.add(cursor);
    cursor = byId.get(cursor)?.ParentId ?? null;
  }
  return null;
}
function buildSystemTree(nodes) {
  const byId = /* @__PURE__ */ new Map();
  for (const n of nodes) byId.set(n.Id, { ...n, depth: 0, path: [], children: [], descendantCount: 0 });
  const roots = [];
  const orphans = [];
  for (const node of byId.values()) {
    const pid = node.ParentId;
    if (!pid) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(pid);
    if (!parent) {
      orphans.push(node.Id);
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }
  const sortFn = (a, b) => (a.SortOrder ?? 0) - (b.SortOrder ?? 0) || a.SystemCode.localeCompare(b.SystemCode);
  const walk = (node, depth, path) => {
    node.depth = depth;
    node.path = [...path, node.SystemCode];
    node.children.sort(sortFn);
    let count = 0;
    for (const child of node.children) count += 1 + walk(child, depth + 1, node.path);
    node.descendantCount = count;
    return count;
  };
  roots.sort(sortFn);
  for (const r of roots) walk(r, 0, []);
  return { roots, orphans };
}
function flattenTree(roots) {
  const out = [];
  const walk = (n) => {
    out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}
function subtreeIds(nodes, rootId) {
  const children = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    if (!n.ParentId) continue;
    const arr = children.get(n.ParentId) ?? [];
    arr.push(n.Id);
    children.set(n.ParentId, arr);
  }
  const out = [];
  const stack = [rootId];
  const seen = /* @__PURE__ */ new Set();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return out;
}
function validateBoundary(input) {
  const errors = [];
  if (!BOUNDARY_KINDS.includes(input.targetKind))
    errors.push({ code: "E-COM-BOUNDARY-KIND", message: `\u0646\u0648\u0639 \u0645\u0631\u0632 \u0628\u0627\u06CC\u062F \u06CC\u06A9\u06CC \u0627\u0632 ${BOUNDARY_KINDS.join("\u060C ")} \u0628\u0627\u0634\u062F` });
  if (!(input.targetRef ?? "").trim())
    errors.push({ code: "E-COM-BOUNDARY-REF", message: "\u0627\u0631\u062C\u0627\u0639 \u0645\u0631\u0632 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  return errors;
}
function assertSinglePrimary(rows, systemId) {
  const primaries = rows.filter((r) => r.SystemId === systemId && truthy(r.IsPrimary));
  if (primaries.length > 1)
    return { code: "E-COM-MULTI-PRIMARY", message: "\u0647\u0631 \u0633\u06CC\u0633\u062A\u0645 \u0641\u0642\u0637 \u06CC\u06A9 \u0646\u06AF\u0627\u0634\u062A \u0627\u0635\u0644\u06CC \u0645\u06CC\u200C\u067E\u0630\u06CC\u0631\u062F" };
  return null;
}
function truthy(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}
function boundaryCoverage(rows, systemId) {
  const mine = rows.filter((r) => r.SystemId === systemId);
  const byKind = {};
  for (const r of mine) byKind[r.TargetKind] = (byKind[r.TargetKind] ?? 0) + 1;
  const hasPrimary = mine.some((r) => truthy(r.IsPrimary));
  const gapsFa = [];
  if (mine.length === 0) gapsFa.push("\u0647\u06CC\u0686 \u0645\u0631\u0632\u06CC \u062A\u0639\u0631\u06CC\u0641 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  else if (!hasPrimary) gapsFa.push("\u0646\u06AF\u0627\u0634\u062A \u0627\u0635\u0644\u06CC \u062A\u0639\u06CC\u06CC\u0646 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  if (mine.length > 0 && !byKind.wbs && !byKind.activity)
    gapsFa.push("\u0628\u0647 \u0647\u06CC\u0686 \u0628\u0633\u062A\u0647\u0654 \u06A9\u0627\u0631\u06CC \u06CC\u0627 \u0641\u0639\u0627\u0644\u06CC\u062A\u06CC \u0646\u06AF\u0627\u0634\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  return { systemId, total: mine.length, byKind, hasPrimary, gapsFa };
}
var BAND_FA = {
  now: "\u0627\u06A9\u0646\u0648\u0646",
  next: "\u0628\u0639\u062F\u06CC",
  later: "\u0628\u0639\u062F\u0627\u064B",
  hold: "\u0645\u0639\u0644\u0642"
};
function priorityMatrix(systems, readiness = {}) {
  const cells = systems.map((s) => {
    const criticality = CRITICALITIES.includes(s.CriticalityFa) ? s.CriticalityFa : "medium";
    const readinessPct = clampPct(readiness[s.Id] ?? 0);
    const priority = s.CommissioningPriority ?? 999;
    let band;
    if (readinessPct >= 90) band = criticality === "low" ? "next" : "now";
    else if (readinessPct >= 50) band = criticality === "high" ? "next" : "later";
    else band = criticality === "high" ? "later" : "hold";
    return {
      systemId: s.Id,
      systemCode: s.SystemCode,
      titleFa: s.TitleFa,
      priority,
      criticality,
      readinessPct,
      band,
      bandFa: BAND_FA[band],
      rank: 0
    };
  });
  const bandWeight = { now: 0, next: 1, later: 2, hold: 3 };
  const critWeight = { high: 0, medium: 1, low: 2 };
  cells.sort(
    (a, b) => bandWeight[a.band] - bandWeight[b.band] || a.priority - b.priority || critWeight[a.criticality] - critWeight[b.criticality] || b.readinessPct - a.readinessPct || a.systemCode.localeCompare(b.systemCode)
  );
  cells.forEach((c, i) => c.rank = i + 1);
  return cells;
}
function clampPct(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
function validateMilestone(input) {
  const errors = [];
  if (!GATE_TYPES.includes(input.gateType))
    errors.push({ code: "E-COM-GATE-INVALID", message: `\u0646\u0648\u0639 \u062F\u0631\u0648\u0627\u0632\u0647 \u0628\u0627\u06CC\u062F \u06CC\u06A9\u06CC \u0627\u0632 ${GATE_TYPES.join("\u060C ")} \u0628\u0627\u0634\u062F` });
  if (!isIsoDate(input.targetDate ?? ""))
    errors.push({ code: "E-COM-TARGET-DATE", message: "\u062A\u0627\u0631\u06CC\u062E \u0647\u062F\u0641 \u0628\u0627\u06CC\u062F \u0628\u0647 \u0634\u06A9\u0644 YYYY-MM-DD \u0628\u0627\u0634\u062F" });
  return errors;
}
function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
function daysBetween(from, to) {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 864e5);
}
function gateSlip(row) {
  if (row.ActualDate) return { slipDays: daysBetween(row.TargetDate, row.ActualDate), basis: "actual" };
  if (row.ForecastDate) return { slipDays: daysBetween(row.TargetDate, row.ForecastDate), basis: "forecast" };
  return { slipDays: null, basis: "unknown" };
}
function validateGateSequence(rows) {
  const errors = [];
  const byGate = /* @__PURE__ */ new Map();
  for (const r of rows) byGate.set(r.GateType, r);
  for (let i = 1; i < GATE_ORDER.length; i++) {
    const cur = byGate.get(GATE_ORDER[i]);
    const prev = byGate.get(GATE_ORDER[i - 1]);
    if (!cur || !prev) continue;
    if (daysBetween(prev.TargetDate, cur.TargetDate) < 0)
      errors.push({
        code: "E-COM-GATE-SEQUENCE",
        message: `\u062A\u0627\u0631\u06CC\u062E \u0647\u062F\u0641 ${GATE_TYPE_FA[GATE_ORDER[i]]} \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u067E\u06CC\u0634 \u0627\u0632 ${GATE_TYPE_FA[GATE_ORDER[i - 1]]} \u0628\u0627\u0634\u062F`
      });
  }
  return errors;
}
function completionPlan(systems, milestones) {
  const bySystem = /* @__PURE__ */ new Map();
  for (const m of milestones) {
    const arr = bySystem.get(m.SystemId) ?? [];
    arr.push(m);
    bySystem.set(m.SystemId, arr);
  }
  return systems.map((s) => {
    const rows = bySystem.get(s.Id) ?? [];
    const gates = {};
    let worst = null;
    for (const g of GATE_ORDER) {
      const row = rows.find((r) => r.GateType === g);
      if (!row) {
        gates[g] = { target: null, forecast: null, actual: null, slipDays: null, basis: "unset" };
        continue;
      }
      const { slipDays, basis } = gateSlip(row);
      gates[g] = {
        target: row.TargetDate,
        forecast: row.ForecastDate ?? null,
        actual: row.ActualDate ?? null,
        slipDays,
        basis
      };
      if (slipDays != null && (worst == null || slipDays > worst)) worst = slipDays;
    }
    const status = SYSTEM_STATUSES.includes(s.Status) ? s.Status : "planned";
    return {
      systemId: s.Id,
      systemCode: s.SystemCode,
      titleFa: s.TitleFa,
      gates,
      worstSlipDays: worst,
      status,
      statusFa: SYSTEM_STATUS_FA[status]
    };
  });
}
function systemizationSummary(systems, boundaries, milestones) {
  const { roots, orphans } = buildSystemTree(systems);
  const flat = flattenTree(roots);
  const boundedIds = new Set(boundaries.map((b) => b.SystemId));
  const milestonedIds = new Set(milestones.map((m) => m.SystemId));
  const byType = {};
  const byStatus = {};
  const byCriticality = {};
  for (const s of systems) {
    byType[s.SystemType] = (byType[s.SystemType] ?? 0) + 1;
    byStatus[s.Status] = (byStatus[s.Status] ?? 0) + 1;
    const crit = s.CriticalityFa ?? "unset";
    byCriticality[crit] = (byCriticality[crit] ?? 0) + 1;
  }
  const withoutBoundary = systems.filter((s) => !boundedIds.has(s.Id)).length;
  const withoutMilestone = systems.filter((s) => !milestonedIds.has(s.Id)).length;
  const ready = systems.filter((s) => boundedIds.has(s.Id) && milestonedIds.has(s.Id)).length;
  return {
    total: systems.length,
    byType,
    byStatus,
    byCriticality,
    rootCount: roots.length,
    maxDepth: flat.reduce((m, n) => Math.max(m, n.depth), 0),
    orphanCount: orphans.length,
    withoutBoundary,
    withoutMilestone,
    readinessPct: systems.length ? round2(ready / systems.length * 100) : 0
  };
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
function systemizationMatrix(systems, boundaries, milestones) {
  const { roots } = buildSystemTree(systems);
  const flat = flattenTree(roots);
  const byId = new Map(systems.map((s) => [s.Id, s]));
  const plan = new Map(completionPlan(systems, milestones).map((p) => [p.systemId, p]));
  const boundaryCount = /* @__PURE__ */ new Map();
  for (const b of boundaries) boundaryCount.set(b.SystemId, (boundaryCount.get(b.SystemId) ?? 0) + 1);
  return flat.map((n, i) => {
    const p = plan.get(n.Id);
    const g = (k) => p?.gates[k]?.target ?? "\u2014";
    const worst = p?.worstSlipDays;
    return {
      \u0631\u062F\u06CC\u0641: i + 1,
      \u06A9\u062F: n.SystemCode,
      \u0639\u0646\u0648\u0627\u0646: n.TitleFa,
      \u0646\u0648\u0639: SYSTEM_TYPE_FA[n.SystemType] ?? n.SystemType,
      \u0633\u0637\u062D: n.depth + 1,
      \u0648\u0627\u0644\u062F: n.ParentId ? byId.get(n.ParentId)?.SystemCode ?? "\u2014" : "\u2014",
      \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646: n.DisciplineCode ?? "\u2014",
      \u0627\u0648\u0644\u0648\u06CC\u062A: n.CommissioningPriority != null ? String(n.CommissioningPriority) : "\u2014",
      \u0628\u062D\u0631\u0627\u0646\u06CC\u062A: n.CriticalityFa ? CRITICALITY_FA[n.CriticalityFa] ?? n.CriticalityFa : "\u2014",
      \u0648\u0636\u0639\u06CC\u062A: SYSTEM_STATUS_FA[n.Status] ?? n.Status,
      \u0645\u0631\u0632\u0647\u0627: boundaryCount.get(n.Id) ?? 0,
      "\u0647\u062F\u0641 \u062A\u06A9\u0645\u06CC\u0644 \u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC": g("mc"),
      "\u0647\u062F\u0641 \u0622\u0645\u0627\u062F\u06AF\u06CC \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC": g("rfsu"),
      "\u0647\u062F\u0641 \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A": g("pac"),
      "\u0647\u062F\u0641 \u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC": g("fac"),
      "\u0628\u062F\u062A\u0631\u06CC\u0646 \u0644\u063A\u0632\u0634": worst == null ? "\u2014" : `${worst} \u0631\u0648\u0632`
    };
  });
}
var PACK_TYPES = ["a", "b"];
var PACK_STATUSES = ["draft", "in_progress", "cleared", "rejected"];
var SHEET_STATUSES = ["draft", "signed", "void"];
var SHEET_RESULTS = ["pass", "fail", "conditional"];
var TEST_KINDS_BY_TYPE = {
  a: ["hydrotest", "flushing", "blowing", "megger", "loop_check", "calibration", "alignment"],
  b: ["no_load", "load_test", "vibration", "performance", "interlock_test"]
};
var ALL_TEST_KINDS = [...TEST_KINDS_BY_TYPE.a, ...TEST_KINDS_BY_TYPE.b];
var TEST_KIND_FA = {
  hydrotest: "\u0622\u0632\u0645\u0648\u0646 \u0647\u06CC\u062F\u0631\u0648\u0627\u0633\u062A\u0627\u062A\u06CC\u06A9",
  flushing: "\u0634\u0633\u062A\u200C\u0648\u0634\u0648",
  blowing: "\u062F\u0645\u0634 \u0647\u0648\u0627",
  megger: "\u0645\u0642\u0627\u0648\u0645\u062A \u0639\u0627\u06CC\u0642\u06CC",
  loop_check: "\u06A9\u0646\u062A\u0631\u0644 \u062D\u0644\u0642\u0647\u0654 \u0627\u0628\u0632\u0627\u0631 \u062F\u0642\u06CC\u0642",
  calibration: "\u06A9\u0627\u0644\u06CC\u0628\u0631\u0627\u0633\u06CC\u0648\u0646",
  alignment: "\u0647\u0645\u200C\u0645\u062D\u0648\u0631\u06CC",
  no_load: "\u0622\u0632\u0645\u0648\u0646 \u0628\u06CC\u200C\u0628\u0627\u0631\u06CC",
  load_test: "\u0622\u0632\u0645\u0648\u0646 \u0632\u06CC\u0631 \u0628\u0627\u0631",
  vibration: "\u0622\u0632\u0645\u0648\u0646 \u0644\u0631\u0632\u0634",
  performance: "\u0622\u0632\u0645\u0648\u0646 \u0639\u0645\u0644\u06A9\u0631\u062F",
  interlock_test: "\u0622\u0632\u0645\u0648\u0646 \u0627\u06CC\u0646\u062A\u0631\u0644\u0627\u06A9"
};
var PACK_TYPE_FA = {
  a: "\u0622\u0632\u0645\u0648\u0646 \u0633\u0631\u062F",
  b: "\u0622\u0632\u0645\u0648\u0646 \u06AF\u0631\u0645"
};
var PACK_STATUS_FA = {
  draft: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633",
  in_progress: "\u062F\u0631 \u062D\u0627\u0644 \u0627\u062C\u0631\u0627",
  cleared: "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647",
  rejected: "\u0645\u0631\u062F\u0648\u062F"
};
var SHEET_RESULT_FA = {
  pass: "\u0642\u0628\u0648\u0644",
  fail: "\u0645\u0631\u062F\u0648\u062F",
  conditional: "\u0645\u0634\u0631\u0648\u0637"
};
function validatePackInput(input) {
  const errors = [];
  if (!(input.packNo ?? "").trim())
    errors.push({ code: "E-COM-PACK-NO-REQUIRED", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u0628\u0633\u062A\u0647\u0654 \u0622\u0632\u0645\u0648\u0646 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  if (!(input.titleFa ?? "").trim())
    errors.push({ code: "E-COM-TITLE-REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0641\u0627\u0631\u0633\u06CC \u0628\u0633\u062A\u0647\u0654 \u0622\u0632\u0645\u0648\u0646 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  if (!PACK_TYPES.includes(input.packType))
    errors.push({ code: "E-COM-PACK-TYPE", message: "\u0646\u0648\u0639 \u0628\u0633\u062A\u0647 \u0628\u0627\u06CC\u062F a (\u0633\u0631\u062F) \u06CC\u0627 b (\u06AF\u0631\u0645) \u0628\u0627\u0634\u062F" });
  if (input.status !== void 0 && !PACK_STATUSES.includes(input.status))
    errors.push({ code: "E-COM-PACK-STATUS", message: `\u0648\u0636\u0639\u06CC\u062A \u0628\u0633\u062A\u0647 \u0628\u0627\u06CC\u062F \u06CC\u06A9\u06CC \u0627\u0632 ${PACK_STATUSES.join("\u060C ")} \u0628\u0627\u0634\u062F` });
  return errors;
}
function validateSheetInput(input) {
  const errors = [];
  if (!(input.sheetNo ?? "").trim())
    errors.push({ code: "E-COM-SHEET-NO-REQUIRED", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u0628\u0631\u06AF\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  if (!(input.titleFa ?? "").trim())
    errors.push({ code: "E-COM-TITLE-REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0641\u0627\u0631\u0633\u06CC \u0628\u0631\u06AF\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  const kind = input.testKind ?? "";
  if (!ALL_TEST_KINDS.includes(kind)) {
    errors.push({ code: "E-COM-TEST-KIND", message: `\u0646\u0648\u0639 \u0622\u0632\u0645\u0648\u0646 ${kind || "\u062E\u0627\u0644\u06CC"} \u0634\u0646\u0627\u062E\u062A\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A` });
  } else if (input.packType && PACK_TYPES.includes(input.packType)) {
    const allowed = TEST_KINDS_BY_TYPE[input.packType];
    if (!allowed.includes(kind))
      errors.push({
        code: "E-COM-KIND-PACK-MISMATCH",
        message: `${TEST_KIND_FA[kind] ?? kind} \u0628\u0627 \u0628\u0633\u062A\u0647\u0654 ${PACK_TYPE_FA[input.packType]} \u0633\u0627\u0632\u06AF\u0627\u0631 \u0646\u06CC\u0633\u062A`
      });
  }
  if (input.resultFa != null && input.resultFa !== "" && !SHEET_RESULTS.includes(input.resultFa))
    errors.push({ code: "E-COM-SHEET-RESULT", message: `\u0646\u062A\u06CC\u062C\u0647\u0654 \u0628\u0631\u06AF\u0647 \u0628\u0627\u06CC\u062F \u06CC\u06A9\u06CC \u0627\u0632 ${SHEET_RESULTS.join("\u060C ")} \u0628\u0627\u0634\u062F` });
  if (input.status !== void 0 && !SHEET_STATUSES.includes(input.status))
    errors.push({ code: "E-COM-SHEET-STATUS", message: `\u0648\u0636\u0639\u06CC\u062A \u0628\u0631\u06AF\u0647 \u0628\u0627\u06CC\u062F \u06CC\u06A9\u06CC \u0627\u0632 ${SHEET_STATUSES.join("\u060C ")} \u0628\u0627\u0634\u062F` });
  return errors;
}
function validateSheetLines(lines) {
  const errors = [];
  if (!Array.isArray(lines) || lines.length === 0) {
    errors.push({ code: "E-COM-NO-LINES", message: "\u0628\u0631\u06AF\u0647\u0654 \u0622\u0632\u0645\u0648\u0646 \u0628\u062F\u0648\u0646 \u0631\u062F\u06CC\u0641 \u067E\u0627\u0631\u0627\u0645\u062A\u0631 \u0645\u0639\u0646\u0627 \u0646\u062F\u0627\u0631\u062F" });
    return errors;
  }
  const seen = /* @__PURE__ */ new Set();
  for (const [i, l] of lines.entries()) {
    const n = Number(l.LineNo);
    if (!Number.isInteger(n) || n < 1)
      errors.push({ code: "E-COM-LINE-NO", message: `\u0631\u062F\u06CC\u0641 ${i + 1}: \u0634\u0645\u0627\u0631\u0647\u0654 \u0631\u062F\u06CC\u0641 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F \u0635\u062D\u06CC\u062D \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F` });
    else if (seen.has(n)) errors.push({ code: "E-COM-DUP-LINE", message: `\u0634\u0645\u0627\u0631\u0647\u0654 \u0631\u062F\u06CC\u0641 ${n} \u062A\u06A9\u0631\u0627\u0631\u06CC \u0627\u0633\u062A` });
    else seen.add(n);
    if (!(l.ParameterFa ?? "").trim())
      errors.push({ code: "E-COM-LINE-PARAM", message: `\u0631\u062F\u06CC\u0641 ${n || i + 1}: \u0646\u0627\u0645 \u067E\u0627\u0631\u0627\u0645\u062A\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A` });
  }
  return errors;
}
function sheetVerdict(lines) {
  const mandatoryLines = lines.filter((l) => l.IsMandatory !== false);
  const passed = mandatoryLines.filter((l) => l.Passed === true).length;
  const failed = mandatoryLines.filter((l) => l.Passed === false).length;
  const pending = mandatoryLines.filter((l) => l.Passed == null).length;
  let resultFa;
  const blockersFa = [];
  if (mandatoryLines.length === 0) {
    resultFa = "pending";
    blockersFa.push("\u0647\u06CC\u0686 \u0631\u062F\u06CC\u0641 \u0627\u0644\u0632\u0627\u0645\u06CC \u062A\u0639\u0631\u06CC\u0641 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  } else if (failed > 0) {
    resultFa = "fail";
    blockersFa.push(`${failed} \u067E\u0627\u0631\u0627\u0645\u062A\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0645\u0631\u062F\u0648\u062F \u0627\u0633\u062A`);
  } else if (pending > 0) {
    resultFa = "pending";
    blockersFa.push(`${pending} \u067E\u0627\u0631\u0627\u0645\u062A\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0646\u0648\u0632 \u0633\u0646\u062C\u06CC\u062F\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
  } else {
    resultFa = "pass";
  }
  return {
    total: lines.length,
    mandatory: mandatoryLines.length,
    passed,
    failed,
    pending,
    resultFa,
    resultLabelFa: resultFa === "pending" ? "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631" : SHEET_RESULT_FA[resultFa],
    blockersFa
  };
}
function canSignSheet(lines, witnessedBy) {
  const v = sheetVerdict(lines);
  if (v.resultFa === "pending")
    return { code: "E-COM-SHEET-PENDING", message: v.blockersFa[0] ?? "\u0628\u0631\u06AF\u0647 \u0647\u0646\u0648\u0632 \u06A9\u0627\u0645\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A" };
  if (!(witnessedBy ?? "").trim())
    return { code: "E-COM-NO-WITNESS", message: "\u0627\u0645\u0636\u0627\u06CC \u0628\u0631\u06AF\u0647\u0654 \u0622\u0632\u0645\u0648\u0646 \u0628\u062F\u0648\u0646 \u062B\u0628\u062A \u0634\u0627\u0647\u062F \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A" };
  return null;
}
function packProgress(packId, sheets) {
  const mine = sheets.filter((s) => s.PackId === packId);
  const active = mine.filter((s) => s.Status !== "void");
  const signed = active.filter((s) => s.Status === "signed");
  const passed = signed.filter((s) => s.ResultFa === "pass" || s.ResultFa === "conditional").length;
  const failed = signed.filter((s) => s.ResultFa === "fail").length;
  const draft = active.filter((s) => s.Status === "draft").length;
  const blockersFa = [];
  if (active.length === 0) blockersFa.push("\u0628\u0633\u062A\u0647 \u0647\u06CC\u0686 \u0628\u0631\u06AF\u0647\u0654 \u0641\u0639\u0627\u0644\u06CC \u0646\u062F\u0627\u0631\u062F");
  if (draft > 0) blockersFa.push(`${draft} \u0628\u0631\u06AF\u0647 \u0647\u0646\u0648\u0632 \u0627\u0645\u0636\u0627 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
  if (failed > 0) blockersFa.push(`${failed} \u0628\u0631\u06AF\u0647 \u0645\u0631\u062F\u0648\u062F \u0627\u0633\u062A`);
  return {
    packId,
    total: active.length,
    signed: signed.length,
    passed,
    failed,
    draft,
    voided: mine.length - active.length,
    clearedPct: active.length ? round2(signed.length / active.length * 100) : 0,
    canClear: blockersFa.length === 0,
    blockersFa
  };
}
function coldTestClearance(input) {
  const coldPacks = input.packs.filter((p) => p.SystemId === input.systemId && p.PackType === "a");
  const blockersFa = [];
  const warningsFa = [];
  if (coldPacks.length === 0) blockersFa.push("\u0647\u06CC\u0686 \u0628\u0633\u062A\u0647\u0654 \u0622\u0632\u0645\u0648\u0646 \u0633\u0631\u062F\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0633\u06CC\u0633\u062A\u0645 \u062A\u0639\u0631\u06CC\u0641 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  let cleared = 0;
  for (const p of coldPacks) {
    if (p.Status === "cleared") {
      cleared++;
      continue;
    }
    const prog = packProgress(p.Id, input.sheets);
    blockersFa.push(`\u0628\u0633\u062A\u0647\u0654 ${p.PackNo}: ${prog.blockersFa.join("\u061B ") || "\u0647\u0646\u0648\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"}`);
  }
  const ncr = input.openNcrCount ?? 0;
  if (ncr > 0) blockersFa.push(`${ncr} \u0639\u062F\u0645 \u0627\u0646\u0637\u0628\u0627\u0642 \u0628\u0627\u0632 \u062F\u0631 \u062F\u0627\u0645\u0646\u0647\u0654 \u0627\u06CC\u0646 \u0633\u06CC\u0633\u062A\u0645 \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F`);
  const pct = input.physicalPct;
  if (pct != null && pct < 100) warningsFa.push(`\u067E\u06CC\u0634\u0631\u0641\u062A \u0641\u06CC\u0632\u06CC\u06A9\u06CC ${round2(pct)}\u066A \u0627\u0633\u062A \u0648 \u0647\u0646\u0648\u0632 \u06A9\u0627\u0645\u0644 \u0646\u0634\u062F\u0647`);
  return {
    systemId: input.systemId,
    ok: blockersFa.length === 0,
    packCount: coldPacks.length,
    clearedPacks: cleared,
    blockersFa,
    warningsFa
  };
}
function preCommSummary(systems, packs, sheets) {
  const byType = { a: 0, b: 0 };
  const byStatus = {};
  for (const p of packs) {
    byType[p.PackType] = (byType[p.PackType] ?? 0) + 1;
    byStatus[p.Status] = (byStatus[p.Status] ?? 0) + 1;
  }
  const active = sheets.filter((s) => s.Status !== "void");
  const signed = active.filter((s) => s.Status === "signed");
  const withPack = new Set(packs.map((p) => p.SystemId));
  return {
    packs: packs.length,
    byType,
    byStatus,
    sheets: active.length,
    signedSheets: signed.length,
    failedSheets: signed.filter((s) => s.ResultFa === "fail").length,
    progressPct: active.length ? round2(signed.length / active.length * 100) : 0,
    systemsWithoutPack: systems.filter((s) => !withPack.has(s.Id)).map((s) => s.SystemCode)
  };
}
export {
  ALL_TEST_KINDS,
  BOUNDARY_KINDS,
  BOUNDARY_KIND_FA,
  CRITICALITIES,
  CRITICALITY_FA,
  GATE_ORDER,
  GATE_TYPES,
  GATE_TYPE_FA,
  PACK_STATUSES,
  PACK_STATUS_FA,
  PACK_TYPES,
  PACK_TYPE_FA,
  SHEET_RESULTS,
  SHEET_RESULT_FA,
  SHEET_STATUSES,
  SYSTEM_STATUSES,
  SYSTEM_STATUS_FA,
  SYSTEM_TYPES,
  SYSTEM_TYPE_FA,
  TEST_KINDS_BY_TYPE,
  TEST_KIND_FA,
  assertSinglePrimary,
  boundaryCoverage,
  buildSystemTree,
  canSignSheet,
  coldTestClearance,
  completionPlan,
  daysBetween,
  detectCycle,
  flattenTree,
  gateSlip,
  packProgress,
  preCommSummary,
  previousGate,
  priorityMatrix,
  sheetVerdict,
  subtreeIds,
  systemizationMatrix,
  systemizationSummary,
  validateBoundary,
  validateGateSequence,
  validateMilestone,
  validatePackInput,
  validateSheetInput,
  validateSheetLines,
  validateSystemCode,
  validateSystemInput
};
