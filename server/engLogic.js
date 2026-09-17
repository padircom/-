// src/services/engineering.ts
var ENG_VERSION = "eng-v1";
var ENG_DOMAIN_ID = "d12";
var DISCIPLINES = [
  "process",
  "piping",
  "civil",
  "electrical",
  "instrument",
  "mechanical",
  "hvac",
  "safety"
];
var DISCIPLINE_FA = {
  process: "\u0641\u0631\u0622\u06CC\u0646\u062F",
  piping: "\u0644\u0648\u0644\u0647\u200C\u06A9\u0634\u06CC",
  civil: "\u0639\u0645\u0631\u0627\u0646",
  electrical: "\u0628\u0631\u0642",
  instrument: "\u0627\u0628\u0632\u0627\u0631 \u062F\u0642\u06CC\u0642",
  mechanical: "\u0645\u06A9\u0627\u0646\u06CC\u06A9",
  hvac: "\u062A\u0647\u0648\u06CC\u0647",
  safety: "\u0627\u06CC\u0645\u0646\u06CC"
};
var DOC_TYPE_FA = {
  drawing: "\u0646\u0642\u0634\u0647",
  specification: "\u0645\u0634\u062E\u0635\u0627\u062A \u0641\u0646\u06CC",
  calculation: "\u0645\u062D\u0627\u0633\u0628\u0627\u062A",
  datasheet: "\u062F\u06CC\u062A\u0627\u0634\u06CC\u062A",
  pid: "P&ID",
  model3d: "\u0645\u062F\u0644 \u0633\u0647\u200C\u0628\u0639\u062F\u06CC",
  report: "\u06AF\u0632\u0627\u0631\u0634"
};
var PURPOSE_FA = {
  IFR: "\u0628\u0631\u0627\u06CC \u0628\u0627\u0632\u0628\u06CC\u0646\u06CC",
  IFA: "\u0628\u0631\u0627\u06CC \u062A\u0623\u06CC\u06CC\u062F",
  IFC: "\u0628\u0631\u0627\u06CC \u0633\u0627\u062E\u062A",
  IFT: "\u0628\u0631\u0627\u06CC \u0645\u0646\u0627\u0642\u0635\u0647",
  AB: "\u0686\u0648\u0646\u200C\u0633\u0627\u062E\u062A"
};
var REVIEW_CODE_FA = {
  "1": "\u062A\u0623\u06CC\u06CC\u062F \u0634\u062F\u0647",
  "2": "\u062A\u0623\u06CC\u06CC\u062F \u0628\u0627 \u0646\u0638\u0631",
  "3": "\u0627\u0635\u0644\u0627\u062D \u0648 \u0627\u0631\u0633\u0627\u0644 \u0645\u062C\u062F\u062F",
  "4": "\u0635\u0631\u0641\u0627\u064B \u062C\u0647\u062A \u0627\u0637\u0644\u0627\u0639"
};
function isApprovingCode(code) {
  return code === "1" || code === "2";
}
function isRejectingCode(code) {
  return code === "3";
}
var TQ_KIND_FA = {
  TQ: "\u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0641\u0646\u06CC",
  FCR: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0627\u0631\u06AF\u0627\u0647\u06CC",
  DCN: "\u0627\u0628\u0644\u0627\u063A\u06CC\u0647 \u062A\u063A\u06CC\u06CC\u0631 \u0637\u0631\u0627\u062D\u06CC"
};
var DEFAULT_CONTRACT_REVIEW_DAYS = 14;
var DAY_MS = 864e5;
function dayNumber(iso) {
  if (!iso) return NaN;
  const t = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? NaN : Math.floor(t / DAY_MS);
}
function daysBetween(fromIso, toIso) {
  const a = dayNumber(fromIso);
  const b = dayNumber(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}
function addDays(iso, days) {
  const d = dayNumber(iso);
  if (Number.isNaN(d) || !Number.isFinite(days)) return null;
  return new Date((d + Math.trunc(days)) * DAY_MS).toISOString().slice(0, 10);
}
var num = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
var round = (v, p = 2) => {
  const f = 10 ** p;
  return Math.round((v + Number.EPSILON) * f) / f;
};
function reviewDaysFor(d) {
  const v = d?.ContractReviewDays;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.trunc(v) : DEFAULT_CONTRACT_REVIEW_DAYS;
}
function reviewDueDate(issuedAt, deliverable) {
  return addDays(issuedAt, reviewDaysFor(deliverable));
}
function validateMdr(rows) {
  const issues = [];
  const seen = /* @__PURE__ */ new Map();
  let total = 0;
  for (const r of rows) {
    const docNo = r.DocNo ?? "";
    total += num(r.PlannedWeight);
    seen.set(docNo, (seen.get(docNo) ?? 0) + 1);
    if (!docNo.trim()) {
      issues.push({ code: "ENG-MDR-NODOC", severity: "error", docNo, messageFa: "\u0634\u0645\u0627\u0631\u0647\u0654 \u0645\u062F\u0631\u06A9 \u062E\u0627\u0644\u06CC \u0627\u0633\u062A" });
    }
    if (num(r.PlannedWeight) <= 0) {
      issues.push({ code: "ENG-MDR-WEIGHT", severity: "error", docNo, messageFa: "\u0648\u0632\u0646 \u0645\u062F\u0631\u06A9 \u0628\u0627\u06CC\u062F \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F" });
    }
    if (!DISCIPLINES.includes(r.Discipline)) {
      issues.push({ code: "ENG-MDR-DISC", severity: "warning", docNo, messageFa: `\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646 \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647: ${r.Discipline}` });
    }
    const ifa = dayNumber(r.TargetIfaDate);
    const ifc = dayNumber(r.TargetIfcDate);
    if (!Number.isNaN(ifa) && !Number.isNaN(ifc) && ifc < ifa) {
      issues.push({ code: "ENG-MDR-DATE", severity: "error", docNo, messageFa: "\u062A\u0627\u0631\u06CC\u062E \u0647\u062F\u0641 IFC \u067E\u06CC\u0634 \u0627\u0632 IFA \u0627\u0633\u062A" });
    }
    if (Number.isNaN(ifc)) {
      issues.push({ code: "ENG-MDR-NOIFC", severity: "warning", docNo, messageFa: "\u062A\u0627\u0631\u06CC\u062E \u0647\u062F\u0641 IFC \u062A\u0639\u06CC\u06CC\u0646 \u0646\u0634\u062F\u0647" });
    }
  }
  for (const [docNo, n] of seen) {
    if (n > 1) issues.push({ code: "ENG-MDR-DUP", severity: "error", docNo, messageFa: `\u0634\u0645\u0627\u0631\u0647\u0654 \u0645\u062F\u0631\u06A9 ${n} \u0628\u0627\u0631 \u062A\u06A9\u0631\u0627\u0631 \u0634\u062F\u0647` });
  }
  if (rows.length > 0 && Math.abs(total - 100) > 0.01) {
    issues.push({
      code: "ENG-MDR-SUM",
      severity: "error",
      docNo: "",
      messageFa: `\u0645\u062C\u0645\u0648\u0639 \u0648\u0632\u0646 \u0645\u062F\u0627\u0631\u06A9 ${round(total, 4)} \u0627\u0633\u062A\u060C \u0628\u0627\u06CC\u062F \u06F1\u06F0\u06F0 \u0628\u0627\u0634\u062F`
    });
  }
  return { issues, totalWeight: round(total, 4), ok: !issues.some((i) => i.severity === "error") };
}
function distributeWeights(rows) {
  if (rows.length === 0) return [];
  const total = rows.reduce((s, r) => s + num(r.EstimatedManhours), 0);
  if (total <= 0) {
    const even = round(100 / rows.length, 4);
    return rows.map((r) => ({ docNo: r.DocNo, weight: even }));
  }
  return rows.map((r) => ({ docNo: r.DocNo, weight: round(num(r.EstimatedManhours) / total * 100, 4) }));
}
var ROC_STEPS = [
  { code: "DRAFT", pct: 20, titleFa: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633" },
  { code: "IDC", pct: 30, titleFa: "\u0628\u0631\u0631\u0633\u06CC \u0628\u06CC\u0646\u200C\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u06CC" },
  { code: "IFA", pct: 60, titleFa: "\u0627\u0631\u0633\u0627\u0644 \u0628\u0631\u0627\u06CC \u062A\u0623\u06CC\u06CC\u062F" },
  { code: "CODE12", pct: 85, titleFa: "\u062A\u0623\u06CC\u06CC\u062F \u06A9\u0627\u0631\u0641\u0631\u0645\u0627 (\u06A9\u062F \u06F1 \u06CC\u0627 \u06F2)" },
  { code: "IFC", pct: 95, titleFa: "\u0635\u062F\u0648\u0631 \u0628\u0631\u0627\u06CC \u0633\u0627\u062E\u062A" },
  { code: "ASBUILT", pct: 100, titleFa: "\u0686\u0648\u0646\u200C\u0633\u0627\u062E\u062A" }
];
var ROC_BY_CODE = new Map(ROC_STEPS.map((s) => [s.code, s]));
function rocPct(code) {
  return ROC_BY_CODE.get(code)?.pct ?? 0;
}
function deliverableProgress(revisions, opts = {}) {
  const requireDoc = opts.requireDocument !== false;
  const revs = [...revisions].sort((a, b) => (a.IssuedAt ?? "").localeCompare(b.IssuedAt ?? ""));
  const hasAny = revs.length > 0;
  const idcDone = revs.find((r) => !!r.IdcCompletedAt);
  const ifaSent = revs.find((r) => r.Purpose === "IFA");
  const approved = revs.find((r) => r.Purpose === "IFA" && isApprovingCode(r.ReviewCode));
  const ifcRev = revs.find((r) => r.Purpose === "IFC" && (!requireDoc || !!r.DocumentId));
  const abRev = revs.find((r) => r.Purpose === "AB" && (!requireDoc || !!r.DocumentId));
  const trail = [
    { step: "DRAFT", pct: 20, titleFa: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633", evidence: hasAny ? `\u0631\u06CC\u0648\u06CC\u0698\u0646 ${revs[0].RevCode}` : null, reached: hasAny },
    { step: "IDC", pct: 30, titleFa: "\u0628\u0631\u0631\u0633\u06CC \u0628\u06CC\u0646\u200C\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u06CC", evidence: idcDone ? `IDC \u062F\u0631 ${idcDone.IdcCompletedAt}` : null, reached: !!idcDone },
    { step: "IFA", pct: 60, titleFa: "\u0627\u0631\u0633\u0627\u0644 \u0628\u0631\u0627\u06CC \u062A\u0623\u06CC\u06CC\u062F", evidence: ifaSent ? `IFA \u0631\u06CC\u0648\u06CC\u0698\u0646 ${ifaSent.RevCode}` : null, reached: !!ifaSent },
    { step: "CODE12", pct: 85, titleFa: "\u062A\u0623\u06CC\u06CC\u062F \u06A9\u0627\u0631\u0641\u0631\u0645\u0627 (\u06A9\u062F \u06F1 \u06CC\u0627 \u06F2)", evidence: approved ? `\u06A9\u062F ${approved.ReviewCode} \u0631\u0648\u06CC ${approved.RevCode}` : null, reached: !!approved },
    { step: "IFC", pct: 95, titleFa: "\u0635\u062F\u0648\u0631 \u0628\u0631\u0627\u06CC \u0633\u0627\u062E\u062A", evidence: ifcRev ? `IFC \u0631\u06CC\u0648\u06CC\u0698\u0646 ${ifcRev.RevCode}` : null, reached: !!ifcRev },
    { step: "ASBUILT", pct: 100, titleFa: "\u0686\u0648\u0646\u200C\u0633\u0627\u062E\u062A", evidence: abRev ? `\u0686\u0648\u0646\u200C\u0633\u0627\u062E\u062A ${abRev.RevCode}` : null, reached: !!abRev }
  ];
  let pct = 0;
  let step = "NONE";
  for (const t of trail) {
    if (!t.reached) break;
    pct = t.pct;
    step = t.step;
  }
  return { pct, step, trail };
}
function engineeringProgress(rows, asOf) {
  const asOfDay = dayNumber(asOf);
  let earned = 0;
  let planned = 0;
  let totalWeight = 0;
  const items = [];
  const discMap = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const w = num(row.deliverable.PlannedWeight);
    totalWeight += w;
    const { pct, step } = deliverableProgress(row.revisions);
    const ev = w * pct / 100;
    earned += ev;
    let plannedPctItem = 0;
    const ifa = dayNumber(row.deliverable.TargetIfaDate);
    const ifc = dayNumber(row.deliverable.TargetIfcDate);
    if (!Number.isNaN(ifc) && asOfDay >= ifc) plannedPctItem = 95;
    else if (!Number.isNaN(ifa) && asOfDay >= ifa) plannedPctItem = 60;
    planned += w * plannedPctItem / 100;
    items.push({ docNo: row.deliverable.DocNo, discipline: row.deliverable.Discipline, weight: w, pct, step, earned: round(ev, 4) });
    const d = row.deliverable.Discipline;
    const agg = discMap.get(d) ?? { earned: 0, planned: 0, weight: 0, count: 0 };
    agg.earned += ev;
    agg.planned += w * plannedPctItem / 100;
    agg.weight += w;
    agg.count += 1;
    discMap.set(d, agg);
  }
  const actualPct = totalWeight > 0 ? round(earned / totalWeight * 100, 4) : 0;
  const plannedPct = totalWeight > 0 ? round(planned / totalWeight * 100, 4) : 0;
  return {
    actualPct,
    plannedPct,
    spi: planned > 0 ? round(earned / planned, 4) : null,
    earnedWeight: round(earned, 4),
    totalWeight: round(totalWeight, 4),
    byDiscipline: [...discMap.entries()].map(([discipline, a]) => ({
      discipline,
      actualPct: a.weight > 0 ? round(a.earned / a.weight * 100, 4) : 0,
      plannedPct: a.weight > 0 ? round(a.planned / a.weight * 100, 4) : 0,
      weight: round(a.weight, 4),
      count: a.count
    })).sort((x, y) => y.weight - x.weight),
    items
  };
}
function reviewAging(revisions, asOf, deliverableById = /* @__PURE__ */ new Map()) {
  const asOfDay = dayNumber(asOf);
  return revisions.map((r) => {
    const due = r.ReviewDueAt ?? reviewDueDate(r.IssuedAt, deliverableById.get(r.DeliverableId));
    const dueDay = dayNumber(due);
    const base = {
      revisionId: r.Id,
      deliverableId: r.DeliverableId,
      issuedAt: r.IssuedAt,
      dueAt: due,
      overdueDays: null,
      status: "unknown",
      reviewCode: r.ReviewCode ?? null
    };
    if (Number.isNaN(dueDay)) return base;
    if (r.ReviewedAt) {
      const d = daysBetween(due, r.ReviewedAt);
      return { ...base, overdueDays: d, status: "reviewed" };
    }
    if (Number.isNaN(asOfDay)) return base;
    const over = asOfDay - dueDay;
    return {
      ...base,
      overdueDays: over,
      status: over > 0 ? "overdue" : over >= -3 ? "due_soon" : "on_time"
    };
  });
}
function crsSummary(comments) {
  const bySeverity = {};
  let open = 0, agreed = 0, disagreed = 0, noted = 0, verified = 0, unanswered = 0;
  for (const c of comments) {
    bySeverity[c.Severity] = (bySeverity[c.Severity] ?? 0) + 1;
    switch (c.ResponseStatus) {
      case "agreed":
        agreed++;
        break;
      case "disagreed":
        disagreed++;
        break;
      case "noted":
        noted++;
        break;
      default:
        open++;
    }
    if (c.VerifiedBy) verified++;
    if (!c.ResponseText) unanswered++;
  }
  return {
    total: comments.length,
    open,
    agreed,
    disagreed,
    noted,
    verified,
    unanswered,
    bySeverity,
    closureRate: comments.length > 0 ? round(verified / comments.length * 100, 2) : 0
  };
}
function crsGate(comments) {
  const blockers = [];
  const open = comments.filter((c) => c.ResponseStatus === "open");
  const disagreed = comments.filter((c) => c.ResponseStatus === "disagreed");
  const criticalUnverified = comments.filter((c) => (c.Severity === "critical" || c.Severity === "major") && !c.VerifiedBy);
  if (open.length > 0) blockers.push({ code: "ENG-CRS-OPEN", messageFa: `${open.length} \u0646\u0638\u0631 \u0628\u062F\u0648\u0646 \u067E\u0627\u0633\u062E`, count: open.length });
  if (disagreed.length > 0) blockers.push({ code: "ENG-CRS-DISAGREED", messageFa: `${disagreed.length} \u0646\u0638\u0631 \u0645\u0648\u0631\u062F \u0627\u062E\u062A\u0644\u0627\u0641`, count: disagreed.length });
  if (criticalUnverified.length > 0) {
    blockers.push({ code: "ENG-CRS-UNVERIFIED", messageFa: `${criticalUnverified.length} \u0646\u0638\u0631 \u0645\u0647\u0645 \u0628\u062F\u0648\u0646 \u0635\u062D\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0646\u0627\u0638\u0631`, count: criticalUnverified.length });
  }
  return { passed: blockers.length === 0, blockers };
}
function rejectionCycles(revisions) {
  return revisions.filter((r) => isRejectingCode(r.ReviewCode)).length;
}
function idcStatus(checks, asOf) {
  const asOfDay = dayNumber(asOf);
  const byRev = /* @__PURE__ */ new Map();
  for (const c of checks) {
    const arr = byRev.get(c.RevisionId) ?? [];
    arr.push(c);
    byRev.set(c.RevisionId, arr);
  }
  return [...byRev.entries()].map(([revisionId, list]) => {
    const cleared = list.filter((c) => c.Status === "cleared").length;
    const objected = list.filter((c) => c.Status === "objected").length;
    const pending = list.filter((c) => c.Status === "pending" || c.Status === "in_review").length;
    const overdue = list.filter((c) => !c.CompletedAt && !Number.isNaN(dayNumber(c.DueAt)) && !Number.isNaN(asOfDay) && asOfDay > dayNumber(c.DueAt)).map((c) => c.Discipline);
    return { revisionId, requested: list.length, cleared, objected, pending, complete: list.length > 0 && cleared === list.length, overdue };
  });
}
function clashSummary(clashes) {
  const byPair = /* @__PURE__ */ new Map();
  const byStage = {};
  let open = 0, resolved = 0, critical = 0;
  for (const c of clashes) {
    const isOpen = c.Status === "open" || c.Status === "assigned";
    if (isOpen) open++;
    if (c.Status === "resolved" || c.Status === "accepted") resolved++;
    if (c.Severity === "critical") critical++;
    const pair = [c.DisciplineA, c.DisciplineB].sort().join("\u2194");
    const agg = byPair.get(pair) ?? { count: 0, open: 0 };
    agg.count++;
    if (isOpen) agg.open++;
    byPair.set(pair, agg);
    if (c.ModelReviewStage) byStage[c.ModelReviewStage] = (byStage[c.ModelReviewStage] ?? 0) + 1;
  }
  return {
    total: clashes.length,
    open,
    resolved,
    critical,
    byPair: [...byPair.entries()].map(([pair, a]) => ({ pair, ...a })).sort((x, y) => y.count - x.count),
    byStage,
    resolutionRate: clashes.length > 0 ? round(resolved / clashes.length * 100, 2) : 0
  };
}
function tqAging(queries, asOf) {
  const asOfDay = dayNumber(asOf);
  return queries.map((q) => {
    const closed = q.Status === "closed" || q.Status === "rejected";
    const end = closed && q.AnsweredAt ? q.AnsweredAt : asOf;
    const age = daysBetween(q.RaisedAt, end);
    const dueDay = dayNumber(q.DueAt);
    return {
      code: q.Code,
      kind: q.Kind,
      raisedAt: q.RaisedAt,
      ageDays: age,
      overdue: !closed && !Number.isNaN(dueDay) && !Number.isNaN(asOfDay) && asOfDay > dueDay,
      status: q.Status,
      hasImpact: hasCommercialImpact(q)
    };
  });
}
function hasCommercialImpact(q) {
  return num(q.CostImpact) !== 0 || num(q.TimeImpactDays) !== 0;
}
function planChangeRequests(queries) {
  const drafts = [];
  const skippedExisting = [];
  const skippedNoImpact = [];
  for (const q of queries) {
    if (q.LinkedCrCode) {
      skippedExisting.push(q.Code);
      continue;
    }
    if (!hasCommercialImpact(q)) {
      skippedNoImpact.push(q.Code);
      continue;
    }
    if (q.Status === "rejected") {
      skippedNoImpact.push(q.Code);
      continue;
    }
    const cost = num(q.CostImpact);
    const time = num(q.TimeImpactDays);
    const parts = [];
    if (cost !== 0) parts.push(`\u0627\u062B\u0631 \u0647\u0632\u06CC\u0646\u0647 ${round(cost, 2)}`);
    if (time !== 0) parts.push(`\u0627\u062B\u0631 \u0632\u0645\u0627\u0646 ${time} \u0631\u0648\u0632`);
    drafts.push({
      sourceCode: q.Code,
      sourceKind: q.Kind,
      code: `CR-${q.Kind}-${q.Code}`,
      titleFa: q.TitleFa,
      costImpact: cost,
      timeImpactDays: time,
      raisedAt: q.RaisedAt,
      reasonFa: `\u0628\u0631\u062E\u0627\u0633\u062A\u0647 \u0627\u0632 ${TQ_KIND_FA[q.Kind] ?? q.Kind} ${q.Code} \u2014 ${parts.join(" \u0648 ")}`
    });
  }
  return { drafts, skippedExisting, skippedNoImpact };
}
function asBuiltStatus(queries) {
  let notRequired = 0, pending = 0, drafted = 0, approved = 0;
  const outstanding = [];
  for (const q of queries) {
    switch (q.AsBuiltStatus) {
      case "approved":
        approved++;
        break;
      case "drafted":
        drafted++;
        outstanding.push(q.Code);
        break;
      case "pending":
        pending++;
        outstanding.push(q.Code);
        break;
      default:
        notRequired++;
    }
  }
  const required = pending + drafted + approved;
  return {
    total: queries.length,
    notRequired,
    pending,
    drafted,
    approved,
    completionRate: required > 0 ? round(approved / required * 100, 2) : 100,
    outstanding
  };
}
function vprSummary(rows, asOf) {
  const asOfDay = dayNumber(asOf);
  const byVendor = /* @__PURE__ */ new Map();
  let underReview = 0, approvedForMfg = 0, rejected = 0, overdue = 0;
  const unmappedToPo = [];
  for (const r of rows) {
    if (r.Status === "under_review" || r.Status === "received") underReview++;
    if (r.Status === "approved_for_mfg") approvedForMfg++;
    if (r.Status === "rejected") rejected++;
    const dueDay = dayNumber(r.DueAt);
    const done = r.Status === "approved_for_mfg" || r.Status === "rejected";
    if (!done && !Number.isNaN(dueDay) && !Number.isNaN(asOfDay) && asOfDay > dueDay) overdue++;
    if (!r.PoNo) unmappedToPo.push(r.VendorDocNo);
    const agg = byVendor.get(r.VendorName) ?? { count: 0, approved: 0 };
    agg.count++;
    if (r.Status === "approved_for_mfg") agg.approved++;
    byVendor.set(r.VendorName, agg);
  }
  return {
    total: rows.length,
    underReview,
    approvedForMfg,
    rejected,
    overdue,
    unmappedToPo,
    byVendor: [...byVendor.entries()].map(([vendor, a]) => ({ vendor, ...a })).sort((x, y) => y.count - x.count)
  };
}
function planIfcLocks(input) {
  const requireDoc = input.requireDocument !== false;
  const delById = new Map(input.deliverables.map((d) => [d.Id, d]));
  const revsByDel = /* @__PURE__ */ new Map();
  for (const r of input.revisions) {
    const arr = revsByDel.get(r.DeliverableId) ?? [];
    arr.push(r);
    revsByDel.set(r.DeliverableId, arr);
  }
  const ifcReady = /* @__PURE__ */ new Set();
  for (const [delId, revs] of revsByDel) {
    if (revs.some((r) => r.Purpose === "IFC" && (!requireDoc || !!r.DocumentId))) ifcReady.add(delId);
  }
  const linkByActivity = new Map(input.activityDocLinks.map((l) => [l.activityId, l.deliverableId]));
  const lock = [];
  const release = [];
  let unchanged = 0;
  for (const a of input.activities) {
    const delId = linkByActivity.get(a.Id);
    const shouldLock = !!delId && !ifcReady.has(delId) && !a.ActualStart;
    const current = a.BlockedByDocumentId ?? null;
    if (shouldLock && current !== delId) {
      const d = delById.get(delId);
      lock.push({
        activityId: a.Id,
        documentId: delId,
        docNo: d?.DocNo ?? delId,
        reasonFa: `\u0646\u0642\u0634\u0647\u0654 ${d?.DocNo ?? delId} \u0647\u0646\u0648\u0632 IFC \u0646\u0634\u062F\u0647`
      });
    } else if (!shouldLock && current) {
      const d = delById.get(current);
      release.push({
        activityId: a.Id,
        previousDocumentId: current,
        reasonFa: d && ifcReady.has(current) ? `\u0646\u0642\u0634\u0647\u0654 ${d.DocNo} \u0628\u0647 IFC \u0631\u0633\u06CC\u062F` : "\u067E\u06CC\u0634\u200C\u0646\u06CC\u0627\u0632 \u0645\u062F\u0631\u06A9 \u0628\u0631\u062F\u0627\u0634\u062A\u0647 \u0634\u062F"
      });
    } else {
      unchanged++;
    }
  }
  return { lock, release, unchanged };
}
var ENG_KPI_TARGETS = {
  "K-ENG-SPI": { target: 0.95, direction: "higher" },
  "K-ENG-FTA": { target: 60, direction: "higher" },
  "K-ENG-AGE": { target: 14, direction: "lower" },
  "K-ENG-REJ": { target: 20, direction: "lower" },
  "K-ENG-TQA": { target: 10, direction: "lower" },
  "K-ENG-IFC": { target: 90, direction: "higher" }
};
function kpiStatus(value, target, direction) {
  if (value === null) return "unknown";
  const ok = direction === "higher" ? value >= target : value <= target;
  if (ok) return "good";
  const margin = direction === "higher" ? value >= target * 0.9 : value <= target * 1.1;
  return margin ? "warn" : "bad";
}
function engineeringKpis(input) {
  const { progress, revisions, aging, queries, deliverables, asOf } = input;
  const firstRevs = /* @__PURE__ */ new Map();
  for (const r of revisions.filter((x) => x.Purpose === "IFA")) {
    const cur = firstRevs.get(r.DeliverableId);
    if (!cur || (r.IssuedAt ?? "") < (cur.IssuedAt ?? "")) firstRevs.set(r.DeliverableId, r);
  }
  const firstReviewed = [...firstRevs.values()].filter((r) => !!r.ReviewCode);
  const fta = firstReviewed.length > 0 ? round(firstReviewed.filter((r) => isApprovingCode(r.ReviewCode)).length / firstReviewed.length * 100, 2) : null;
  const overdueAging = aging.filter((a) => a.overdueDays !== null && a.overdueDays > 0);
  const avgAge = overdueAging.length > 0 ? round(overdueAging.reduce((s, a) => s + (a.overdueDays ?? 0), 0) / overdueAging.length, 2) : aging.length > 0 ? 0 : null;
  const coded = revisions.filter((r) => !!r.ReviewCode);
  const rej = coded.length > 0 ? round(coded.filter((r) => isRejectingCode(r.ReviewCode)).length / coded.length * 100, 2) : null;
  const openQ = tqAging(queries.filter((q) => q.Status !== "closed" && q.Status !== "rejected"), asOf);
  const tqa = openQ.length > 0 ? round(openQ.reduce((s, q) => s + (q.ageDays ?? 0), 0) / openQ.length, 2) : null;
  const asOfDay = dayNumber(asOf);
  const dueIfc = deliverables.filter((d) => {
    const t = dayNumber(d.TargetIfcDate);
    return !Number.isNaN(t) && !Number.isNaN(asOfDay) && asOfDay >= t;
  });
  const ifcIssued = new Set(revisions.filter((r) => r.Purpose === "IFC").map((r) => r.DeliverableId));
  const ifcRate = dueIfc.length > 0 ? round(dueIfc.filter((d) => ifcIssued.has(d.Id)).length / dueIfc.length * 100, 2) : null;
  const defs = [
    { code: "K-ENG-SPI", fa: "\u0634\u0627\u062E\u0635 \u0639\u0645\u0644\u06A9\u0631\u062F \u0632\u0645\u0627\u0646\u06CC \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Engineering SPI", value: progress.spi, unit: "" },
    { code: "K-ENG-FTA", fa: "\u0646\u0631\u062E \u062A\u0623\u06CC\u06CC\u062F \u0628\u0627\u0631 \u0627\u0648\u0644", en: "First-time approval rate", value: fta, unit: "%" },
    { code: "K-ENG-AGE", fa: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u062A\u0623\u062E\u06CC\u0631 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0641\u0631\u0645\u0627", en: "Client review aging", value: avgAge, unit: "\u0631\u0648\u0632" },
    { code: "K-ENG-REJ", fa: "\u0646\u0631\u062E \u06A9\u062F \u06F3 (\u0627\u0635\u0644\u0627\u062D \u0645\u062C\u062F\u062F)", en: "Rejection rate", value: rej, unit: "%" },
    { code: "K-ENG-TQA", fa: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0633\u0646 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0628\u0627\u0632", en: "Open TQ aging", value: tqa, unit: "\u0631\u0648\u0632" },
    { code: "K-ENG-IFC", fa: "\u0646\u0631\u062E \u0635\u062F\u0648\u0631 IFC \u0637\u0628\u0642 \u0628\u0631\u0646\u0627\u0645\u0647", en: "IFC release rate", value: ifcRate, unit: "%" }
  ];
  return defs.map((d) => {
    const t = ENG_KPI_TARGETS[d.code];
    return {
      code: d.code,
      title: { fa: d.fa, en: d.en },
      value: d.value,
      unit: d.unit,
      target: t.target,
      direction: t.direction,
      status: kpiStatus(d.value, t.target, t.direction)
    };
  });
}
function engineeringAlerts(input) {
  const alerts = [];
  for (const a of input.aging) {
    if (a.status === "overdue" && (a.overdueDays ?? 0) > 0) {
      alerts.push({
        code: "EWS-ENG-01",
        severity: (a.overdueDays ?? 0) > 14 ? "high" : "medium",
        titleFa: "\u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0641\u0631\u0645\u0627 \u0627\u0632 \u0645\u0647\u0644\u062A \u06AF\u0630\u0634\u062A",
        detailFa: `\u0631\u06CC\u0648\u06CC\u0698\u0646 ${a.revisionId} ${a.overdueDays} \u0631\u0648\u0632 \u0627\u0632 \u0633\u0631\u0631\u0633\u06CC\u062F ${a.dueAt} \u06AF\u0630\u0634\u062A\u0647`,
        subject: a.revisionId
      });
    }
  }
  for (const [delId, revs] of input.revisionsByDeliverable) {
    const cycles = rejectionCycles(revs);
    if (cycles >= 3) {
      alerts.push({
        code: "EWS-ENG-02",
        severity: "high",
        titleFa: "\u062F\u0648\u0628\u0627\u0631\u0647\u200C\u06A9\u0627\u0631\u06CC \u0645\u0632\u0645\u0646 \u0645\u062F\u0631\u06A9",
        detailFa: `\u0645\u062F\u0631\u06A9 ${delId} \u062A\u0627\u06A9\u0646\u0648\u0646 ${cycles} \u0628\u0627\u0631 \u06A9\u062F \u06F3 \u06AF\u0631\u0641\u062A\u0647`,
        subject: delId
      });
    }
  }
  for (const q of tqAging(input.queries, input.asOf)) {
    if (q.status === "closed" || q.status === "rejected") continue;
    if ((q.ageDays ?? 0) > 15) {
      alerts.push({
        code: "EWS-ENG-03",
        severity: q.hasImpact ? "high" : "medium",
        titleFa: "\u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0641\u0646\u06CC \u0628\u06CC\u200C\u067E\u0627\u0633\u062E",
        detailFa: `${q.kind} ${q.code} \u067E\u0633 \u0627\u0632 ${q.ageDays} \u0631\u0648\u0632 \u0647\u0646\u0648\u0632 \u0628\u0627\u0632 \u0627\u0633\u062A`,
        subject: q.code
      });
    }
  }
  if (input.lockPlan.lock.length > 0) {
    alerts.push({
      code: "EWS-ENG-04",
      severity: "high",
      titleFa: "\u0633\u0627\u062E\u062A \u0628\u0647 \u062F\u0644\u06CC\u0644 \u0646\u0628\u0648\u062F IFC \u0642\u0641\u0644 \u0627\u0633\u062A",
      detailFa: `${input.lockPlan.lock.length} \u0641\u0639\u0627\u0644\u06CC\u062A \u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u0635\u062F\u0648\u0631 \u0646\u0642\u0634\u0647\u0654 IFC`,
      subject: String(input.lockPlan.lock.length)
    });
  }
  const spi = input.kpis.find((k) => k.code === "K-ENG-SPI");
  if (spi && spi.value !== null && spi.value < 0.85) {
    alerts.push({
      code: "EWS-ENG-05",
      severity: "high",
      titleFa: "\u0639\u0642\u0628\u200C\u0645\u0627\u0646\u062F\u06AF\u06CC \u067E\u06CC\u0634\u0631\u0641\u062A \u0645\u0647\u0646\u062F\u0633\u06CC",
      detailFa: `SPI \u0645\u0647\u0646\u062F\u0633\u06CC ${spi.value} \u0627\u0633\u062A \u0648 \u0627\u0632 \u0622\u0633\u062A\u0627\u0646\u0647\u0654 \u06F0\u066B\u06F8\u06F5 \u067E\u0627\u06CC\u06CC\u0646\u200C\u062A\u0631`,
      subject: "K-ENG-SPI"
    });
  }
  return alerts;
}
var ENG_REPORT_CATALOG = [
  {
    code: "RPT-ENG-MDR",
    title: { fa: "\u0645\u0627\u062A\u0631\u06CC\u0633 \u0648\u0636\u0639\u06CC\u062A \u0645\u062F\u0627\u0631\u06A9 \u0645\u0647\u0646\u062F\u0633\u06CC", en: "MDR status matrix" },
    periodicity: "weekly",
    audiences: ["internal", "official"],
    purpose: { fa: "\u0648\u0636\u0639\u06CC\u062A \u0647\u0631 \u0645\u062F\u0631\u06A9 \u0631\u0648\u06CC \u0634\u0634 \u067E\u0644\u0647\u0654 \u067E\u06CC\u0634\u0631\u0641\u062A \u0628\u0647 \u062A\u0641\u06A9\u06CC\u06A9 \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", en: "per-document status across six credit steps" }
  },
  {
    code: "RPT-ENG-TRN",
    title: { fa: "\u0628\u0631\u06AF\u0647 \u062A\u0631\u0627\u0646\u0633\u0645\u06CC\u062A\u0627\u0644 \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Engineering transmittal sheet" },
    periodicity: "on_demand",
    audiences: ["official"],
    purpose: { fa: "\u0641\u0631\u0645 \u0631\u0633\u0645\u06CC \u0627\u0631\u0633\u0627\u0644 \u0645\u062F\u0627\u0631\u06A9 \u0628\u0647 \u06A9\u0627\u0631\u0641\u0631\u0645\u0627 \u06CC\u0627 \u0645\u0634\u0627\u0648\u0631", en: "formal document submission form" }
  },
  {
    code: "RPT-ENG-CRS",
    title: { fa: "\u0634\u06CC\u062A \u067E\u0627\u0633\u062E \u0628\u0647 \u0646\u0638\u0631\u0627\u062A", en: "Comment resolution sheet" },
    periodicity: "on_demand",
    audiences: ["internal", "official"],
    purpose: { fa: "\u0646\u0638\u0631 \u0628\u0627\u0632\u0628\u06CC\u0646\u060C \u067E\u0627\u0633\u062E \u0637\u0631\u0627\u062D \u0648 \u0635\u062D\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0646\u0627\u0638\u0631 \u062F\u0631 \u06CC\u06A9 \u0628\u0631\u06AF\u0647", en: "comment, response and verification in one sheet" }
  },
  {
    code: "RPT-ENG-TQF",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0648 \u062A\u063A\u06CC\u06CC\u0631 \u0641\u0646\u06CC", en: "TQ / FCR register" },
    periodicity: "weekly",
    audiences: ["internal", "official"],
    purpose: { fa: "\u0641\u0647\u0631\u0633\u062A \u0627\u0633\u062A\u0639\u0644\u0627\u0645\u200C\u0647\u0627 \u0648 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u06A9\u0627\u0631\u06AF\u0627\u0647\u06CC \u0628\u0627 \u0627\u062B\u0631 \u0645\u0627\u0644\u06CC \u0648 \u0632\u0645\u0627\u0646\u06CC", en: "field queries and changes with impacts" }
  },
  {
    code: "RPT-ENG-PRG",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0645\u0627\u0647\u0627\u0646\u0647 \u067E\u06CC\u0634\u0631\u0641\u062A \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Engineering monthly progress" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: { fa: "\u0645\u0646\u062D\u0646\u06CC S \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC \u0648 \u0648\u0627\u0642\u0639\u06CC \u0628\u0627 SPI \u0645\u0647\u0646\u062F\u0633\u06CC", en: "planned vs actual S-curve with engineering SPI" }
  },
  {
    code: "RPT-ENG-VPR",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0628\u0631\u0631\u0633\u06CC \u0645\u062F\u0627\u0631\u06A9 \u0633\u0627\u0632\u0646\u062F\u06AF\u0627\u0646", en: "Vendor print review register" },
    periodicity: "weekly",
    audiences: ["internal"],
    purpose: { fa: "\u0648\u0636\u0639\u06CC\u062A \u0645\u062F\u0627\u0631\u06A9 \u0633\u0627\u0632\u0646\u062F\u06AF\u0627\u0646 \u0648 \u0646\u06AF\u0627\u0634\u062A \u0628\u0647 \u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F", en: "vendor documents and PO mapping" }
  },
  {
    code: "RPT-ENG-IDC",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0628\u0631\u0631\u0633\u06CC \u0628\u06CC\u0646\u200C\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u06CC \u0648 \u062A\u062F\u0627\u062E\u0644", en: "IDC and clash report" },
    periodicity: "weekly",
    audiences: ["internal"],
    purpose: { fa: "\u0648\u0636\u0639\u06CC\u062A Squad Check \u0648 \u062A\u062F\u0627\u062E\u0644\u0627\u062A \u06A9\u0634\u0641\u200C\u0634\u062F\u0647 \u062F\u0631 \u0645\u062F\u0644", en: "squad check status and detected clashes" }
  },
  {
    code: "RPT-ENG-EXEC",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u062A\u06A9\u200C\u0635\u0641\u062D\u0647\u200C\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Engineering executive summary" },
    periodicity: "monthly",
    /* فقط داخلی: برآورد ادعای قابل مطالبه در آن هست. */
    audiences: ["internal"],
    purpose: {
      fa: "\u06CC\u06A9 \u0635\u0641\u062D\u0647 \u0628\u0631\u0627\u06CC \u062A\u0635\u0645\u06CC\u0645\u200C\u06AF\u06CC\u0631 \u0627\u0631\u0634\u062F: \u0642\u0636\u0627\u0648\u062A \u06A9\u0644\u06CC\u060C \u0627\u062B\u0631 \u0628\u0631 \u0633\u0627\u062E\u062A \u0648 \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u060C \u0633\u0647 \u0642\u0644\u0645 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0635\u0645\u06CC\u0645",
      en: "one page for executives: verdict, impact on execution and contract, top three decisions"
    }
  }
];
var REPORT_BY_CODE = new Map(ENG_REPORT_CATALOG.map((r) => [r.code, r]));
function getEngReport(code) {
  return REPORT_BY_CODE.get(code);
}
function isAudienceAllowed(code, audience) {
  const def = REPORT_BY_CODE.get(code);
  return !!def && def.audiences.includes(audience);
}
function engineeringOverview(input) {
  const { deliverables, revisions, comments, clashes, queries, vendorDocs, asOf } = input;
  const delById = new Map(deliverables.map((d) => [d.Id, d]));
  const revsByDel = /* @__PURE__ */ new Map();
  for (const r of revisions) {
    const arr = revsByDel.get(r.DeliverableId) ?? [];
    arr.push(r);
    revsByDel.set(r.DeliverableId, arr);
  }
  const progress = engineeringProgress(
    deliverables.map((d) => ({ deliverable: d, revisions: revsByDel.get(d.Id) ?? [] })),
    asOf
  );
  const aging = reviewAging(revisions.filter((r) => r.Purpose === "IFA"), asOf, delById);
  const lockPlan = input.lockPlan ?? { lock: [], release: [], unchanged: 0 };
  const kpis = engineeringKpis({ progress, revisions, aging, queries, deliverables, asOf });
  return {
    version: ENG_VERSION,
    asOf,
    progress,
    kpis,
    alerts: engineeringAlerts({ aging, revisionsByDeliverable: revsByDel, queries, lockPlan, kpis, asOf }),
    crs: crsSummary(comments),
    clash: clashSummary(clashes),
    vpr: vprSummary(vendorDocs, asOf),
    asBuilt: asBuiltStatus(queries),
    reviewOverdue: aging.filter((a) => a.status === "overdue").length,
    openQueries: queries.filter((q) => q.Status !== "closed" && q.Status !== "rejected").length
  };
}
var SRC = `${ENG_DOMAIN_ID} \xB7 \u0645\u0647\u0646\u062F\u0633\u06CC \u0648 \u0637\u0631\u0627\u062D\u06CC`;
function toRptPeriodicity(p) {
  return p === "on_demand" ? "adhoc" : p;
}
var dash = (v) => v === null || v === void 0 || v === "" ? "\u2014" : String(v);
function buildMdrStatusReport(input) {
  const rows = input.deliverables.map((d) => {
    const p = deliverableProgress(input.revisionsByDeliverable.get(d.Id) ?? []);
    const revs = input.revisionsByDeliverable.get(d.Id) ?? [];
    const last = [...revs].sort((a, b) => String(b.IssuedAt).localeCompare(String(a.IssuedAt)))[0];
    return {
      docNo: d.DocNo,
      title: d.TitleFa,
      discipline: DISCIPLINE_FA[d.Discipline] ?? d.Discipline,
      docType: DOC_TYPE_FA[d.DocType] ?? d.DocType,
      weight: round(num(d.PlannedWeight), 2),
      rev: dash(last?.RevCode),
      purpose: last ? PURPOSE_FA[last.Purpose] ?? last.Purpose : "\u2014",
      reviewCode: last?.ReviewCode ? `${last.ReviewCode} \u2014 ${REVIEW_CODE_FA[last.ReviewCode] ?? ""}` : "\u2014",
      step: p.step === "NONE" ? "\u2014" : ROC_BY_CODE.get(p.step)?.titleFa ?? p.step,
      pct: p.pct,
      targetIfc: dash(d.TargetIfcDate)
    };
  });
  const v = input.validation ?? validateMdr(input.deliverables);
  const sections = [
    {
      kind: "kpi",
      title: { fa: "\u062E\u0644\u0627\u0635\u0647 \u0641\u0647\u0631\u0633\u062A", en: "Register summary" },
      cells: [
        { label: { fa: "\u062A\u0639\u062F\u0627\u062F \u0645\u062F\u0631\u06A9", en: "Deliverables" }, value: String(input.deliverables.length) },
        { label: { fa: "\u0645\u062C\u0645\u0648\u0639 \u0648\u0632\u0646", en: "Total weight" }, value: `${v.totalWeight}\u066A`, tone: v.ok ? "good" : "bad" },
        { label: { fa: "\u0631\u0633\u06CC\u062F\u0647 \u0628\u0647 IFC", en: "Reached IFC" }, value: String(rows.filter((r) => r.pct >= 95).length) },
        { label: { fa: "\u0634\u0631\u0648\u0639\u200C\u0646\u0634\u062F\u0647", en: "Not started" }, value: String(rows.filter((r) => r.pct === 0).length), tone: rows.some((r) => r.pct === 0) ? "warn" : "good" }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u0645\u0627\u062A\u0631\u06CC\u0633 \u0648\u0636\u0639\u06CC\u062A \u0645\u062F\u0627\u0631\u06A9", en: "Document status matrix" },
      note: { fa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0627\u0632 \u067E\u0644\u0647\u200C\u0647\u0627\u06CC \u0645\u0635\u0648\u0628 \u0645\u0634\u062A\u0642 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062F\u0633\u062A\u06CC \u0648\u0627\u0631\u062F \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.", en: "Progress is derived from approved credit steps." },
      columns: [
        { key: "docNo", title: { fa: "\u0634\u0645\u0627\u0631\u0647 \u0645\u062F\u0631\u06A9", en: "Doc no" }, weight: 2 },
        { key: "title", title: { fa: "\u0639\u0646\u0648\u0627\u0646", en: "Title" }, weight: 3 },
        { key: "discipline", title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", en: "Discipline" } },
        { key: "docType", title: { fa: "\u0646\u0648\u0639", en: "Type" } },
        { key: "weight", title: { fa: "\u0648\u0632\u0646", en: "Weight" }, format: "number", align: "center" },
        { key: "rev", title: { fa: "\u0631\u06CC\u0648\u06CC\u0698\u0646", en: "Rev" }, align: "center" },
        { key: "purpose", title: { fa: "\u0647\u062F\u0641 \u0635\u062F\u0648\u0631", en: "Purpose" } },
        { key: "reviewCode", title: { fa: "\u06A9\u062F \u0628\u0631\u0631\u0633\u06CC", en: "Review code" }, weight: 2 },
        { key: "step", title: { fa: "\u067E\u0644\u0647 \u062C\u0627\u0631\u06CC", en: "Step" }, weight: 2 },
        { key: "pct", title: { fa: "\u067E\u06CC\u0634\u0631\u0641\u062A", en: "Progress" }, format: "percent", align: "center" },
        { key: "targetIfc", title: { fa: "\u0647\u062F\u0641 IFC", en: "Target IFC" }, format: "date", align: "center" }
      ],
      rows
    }
  ];
  if (!v.ok) {
    sections.push({
      kind: "table",
      title: { fa: "\u0645\u063A\u0627\u06CC\u0631\u062A\u200C\u0647\u0627\u06CC \u0641\u0647\u0631\u0633\u062A", en: "Register issues" },
      columns: [
        { key: "code", title: { fa: "\u06A9\u062F", en: "Code" } },
        { key: "docNo", title: { fa: "\u0645\u062F\u0631\u06A9", en: "Document" } },
        { key: "msg", title: { fa: "\u0634\u0631\u062D", en: "Message" }, weight: 4 }
      ],
      rows: v.issues.map((i) => ({ code: i.code, docNo: dash(i.docNo), msg: i.messageFa }))
    });
  }
  return {
    code: "RPT-ENG-MDR",
    title: { fa: "\u0645\u0627\u062A\u0631\u06CC\u0633 \u0648\u0636\u0639\u06CC\u062A \u0645\u062F\u0627\u0631\u06A9 \u0645\u0647\u0646\u062F\u0633\u06CC", en: "MDR Status Matrix" },
    periodicity: "weekly",
    sourceModule: SRC,
    audiences: ["internal", "official"],
    sections
  };
}
function buildTransmittalReport(input) {
  const scoped = input.transmittalId ? input.revisions.filter((r) => r.TransmittalId === input.transmittalId) : input.revisions.filter((r) => !!r.TransmittalId);
  const rows = scoped.map((r, i) => {
    const d = input.deliverableById.get(r.DeliverableId);
    return {
      no: i + 1,
      docNo: dash(d?.DocNo ?? r.DeliverableId),
      title: dash(d?.TitleFa),
      discipline: d ? DISCIPLINE_FA[d.Discipline] ?? d.Discipline : "\u2014",
      rev: r.RevCode,
      purpose: PURPOSE_FA[r.Purpose] ?? r.Purpose,
      issuedAt: r.IssuedAt,
      dueAt: dash(r.ReviewDueAt),
      transmittal: dash(r.TransmittalId)
    };
  });
  return {
    code: "RPT-ENG-TRN",
    title: {
      fa: input.transmittalId ? `\u0628\u0631\u06AF\u0647 \u062A\u0631\u0627\u0646\u0633\u0645\u06CC\u062A\u0627\u0644 ${input.transmittalId}` : "\u0628\u0631\u06AF\u0647 \u062A\u0631\u0627\u0646\u0633\u0645\u06CC\u062A\u0627\u0644 \u0645\u0647\u0646\u062F\u0633\u06CC",
      en: input.transmittalId ? `Transmittal ${input.transmittalId}` : "Engineering Transmittal Sheet"
    },
    periodicity: "adhoc",
    sourceModule: SRC,
    audiences: ["official"],
    sections: [
      {
        kind: "text",
        title: { fa: "\u0645\u0648\u0636\u0648\u0639", en: "Subject" },
        body: {
          fa: `\u0628\u062F\u06CC\u0646\u200C\u0648\u0633\u06CC\u0644\u0647 ${rows.length} \u0641\u0642\u0631\u0647 \u0645\u062F\u0631\u06A9 \u0645\u0647\u0646\u062F\u0633\u06CC \u0628\u0647 \u0634\u0631\u062D \u062C\u062F\u0648\u0644 \u067E\u06CC\u0648\u0633\u062A \u062C\u0647\u062A \u0627\u0642\u062F\u0627\u0645 \u0645\u0642\u062A\u0636\u06CC \u0627\u0631\u0633\u0627\u0644 \u0645\u06CC\u200C\u06AF\u0631\u062F\u062F. \u062E\u0648\u0627\u0647\u0634\u0645\u0646\u062F \u0627\u0633\u062A \u0646\u062A\u06CC\u062C\u0647 \u0628\u0631\u0631\u0633\u06CC \u0638\u0631\u0641 \u0645\u0647\u0644\u062A \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC \u0627\u0639\u0644\u0627\u0645 \u0634\u0648\u062F.`,
          en: `${rows.length} engineering document(s) are hereby transmitted for your action. Please advise the review outcome within the contractual period.`
        }
      },
      {
        kind: "table",
        title: { fa: "\u0641\u0647\u0631\u0633\u062A \u0645\u062F\u0627\u0631\u06A9 \u0627\u0631\u0633\u0627\u0644\u06CC", en: "Transmitted documents" },
        columns: [
          { key: "no", title: { fa: "\u0631\u062F\u06CC\u0641", en: "No" }, align: "center" },
          { key: "docNo", title: { fa: "\u0634\u0645\u0627\u0631\u0647 \u0645\u062F\u0631\u06A9", en: "Doc no" }, weight: 2 },
          { key: "title", title: { fa: "\u0639\u0646\u0648\u0627\u0646", en: "Title" }, weight: 3 },
          { key: "discipline", title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", en: "Discipline" } },
          { key: "rev", title: { fa: "\u0631\u06CC\u0648\u06CC\u0698\u0646", en: "Rev" }, align: "center" },
          { key: "purpose", title: { fa: "\u0647\u062F\u0641 \u0635\u062F\u0648\u0631", en: "Purpose" } },
          { key: "issuedAt", title: { fa: "\u062A\u0627\u0631\u06CC\u062E \u0635\u062F\u0648\u0631", en: "Issued" }, format: "date", align: "center" },
          { key: "dueAt", title: { fa: "\u0645\u0647\u0644\u062A \u0628\u0631\u0631\u0633\u06CC", en: "Review due" }, format: "date", align: "center" }
        ],
        rows
      }
    ]
  };
}
function buildCrsReport(input) {
  const scoped = input.revisionId ? input.comments.filter((c) => c.RevisionId === input.revisionId) : input.comments;
  const s = input.summary ?? crsSummary(scoped);
  const g = input.gate ?? crsGate(scoped);
  const sections = [
    {
      kind: "kpi",
      title: { fa: "\u062E\u0644\u0627\u0635\u0647 \u0646\u0638\u0631\u0627\u062A", en: "Comment summary" },
      cells: [
        { label: { fa: "\u06A9\u0644 \u0646\u0638\u0631", en: "Total" }, value: String(s.total) },
        { label: { fa: "\u0628\u062F\u0648\u0646 \u067E\u0627\u0633\u062E", en: "Open" }, value: String(s.open), tone: s.open > 0 ? "bad" : "good" },
        { label: { fa: "\u0645\u0648\u0631\u062F \u062A\u0648\u0627\u0641\u0642", en: "Agreed" }, value: String(s.agreed), tone: "good" },
        { label: { fa: "\u0645\u0648\u0631\u062F \u0627\u062E\u062A\u0644\u0627\u0641", en: "Disagreed" }, value: String(s.disagreed), tone: s.disagreed > 0 ? "warn" : "good" },
        { label: { fa: "\u0635\u062D\u0647\u200C\u062E\u0648\u0631\u062F\u0647", en: "Verified" }, value: String(s.verified) },
        { label: { fa: "\u0646\u0631\u062E \u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646", en: "Closure rate" }, value: `${s.closureRate}\u066A`, tone: s.closureRate >= 90 ? "good" : s.closureRate >= 60 ? "warn" : "bad" }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u0634\u06CC\u062A \u062B\u0628\u062A \u0648 \u067E\u0627\u0633\u062E \u0646\u0638\u0631\u0627\u062A", en: "Comment resolution sheet" },
      columns: [
        { key: "no", title: { fa: "\u0631\u062F\u06CC\u0641", en: "No" }, align: "center" },
        { key: "raisedBy", title: { fa: "\u0628\u0627\u0632\u0628\u06CC\u0646", en: "Reviewer" } },
        { key: "raisedAt", title: { fa: "\u062A\u0627\u0631\u06CC\u062E", en: "Date" }, format: "date", align: "center" },
        { key: "sheetRef", title: { fa: "\u0645\u0631\u062C\u0639", en: "Ref" } },
        { key: "severity", title: { fa: "\u0634\u062F\u062A", en: "Severity" }, align: "center" },
        { key: "comment", title: { fa: "\u0645\u062A\u0646 \u0646\u0638\u0631", en: "Comment" }, weight: 4 },
        { key: "response", title: { fa: "\u067E\u0627\u0633\u062E \u0637\u0631\u0627\u062D", en: "Response" }, weight: 4 },
        { key: "status", title: { fa: "\u0648\u0636\u0639\u06CC\u062A", en: "Status" }, align: "center" },
        { key: "verified", title: { fa: "\u0635\u062D\u0647 \u0646\u0627\u0638\u0631", en: "Verified" }, align: "center" },
        { key: "closedIn", title: { fa: "\u0627\u0639\u0645\u0627\u0644 \u062F\u0631", en: "Closed in" }, align: "center" }
      ],
      rows: scoped.map((c) => ({
        no: c.CommentNo,
        raisedBy: c.RaisedBy,
        raisedAt: c.RaisedAt,
        sheetRef: dash(c.SheetRef),
        severity: c.Severity,
        comment: c.CommentText,
        response: dash(c.ResponseText),
        status: c.ResponseStatus,
        verified: c.VerifiedBy ? "\u2714" : "\u2014",
        closedIn: dash(c.ClosedInRevCode)
      }))
    },
    {
      kind: "text",
      title: { fa: "\u0646\u062A\u06CC\u062C\u0647 \u062F\u0631\u0648\u0627\u0632\u0647 \u0635\u062F\u0648\u0631", en: "Issue gate result" },
      body: g.passed ? { fa: "\u0647\u0645\u0647 \u0646\u0638\u0631\u0627\u062A \u067E\u0627\u0633\u062E \u0648 \u0635\u062D\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0634\u062F\u0647\u200C\u0627\u0646\u062F\u061B \u0645\u0627\u0646\u0639\u06CC \u0628\u0631\u0627\u06CC \u0635\u062F\u0648\u0631 IFC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.", en: "All comments resolved and verified; no blocker for IFC issue." } : {
        fa: `\u0635\u062F\u0648\u0631 IFC \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A: ${g.blockers.map((b) => b.messageFa).join(" \xB7 ")}`,
        en: `IFC issue blocked: ${g.blockers.map((b) => b.code).join(", ")}`
      }
    }
  ];
  return {
    code: "RPT-ENG-CRS",
    title: {
      fa: input.revisionId ? `\u0634\u06CC\u062A \u067E\u0627\u0633\u062E \u0646\u0638\u0631\u0627\u062A \u2014 \u0631\u06CC\u0648\u06CC\u0698\u0646 ${input.revisionId}` : "\u0634\u06CC\u062A \u067E\u0627\u0633\u062E \u0628\u0647 \u0646\u0638\u0631\u0627\u062A",
      en: "Comment Resolution Sheet"
    },
    periodicity: "adhoc",
    sourceModule: SRC,
    audiences: ["internal", "official"],
    sections
  };
}
function buildTqFcrReport(input) {
  const aging = input.aging ?? tqAging(input.queries, input.asOf);
  const plan = input.crPlan ?? planChangeRequests(input.queries);
  const ab = input.asBuilt ?? asBuiltStatus(input.queries);
  const byCode = new Map(input.queries.map((q) => [q.Code, q]));
  const totalCost = input.queries.reduce((s, q) => s + num(q.CostImpact), 0);
  const totalDays = input.queries.reduce((s, q) => s + num(q.TimeImpactDays), 0);
  const sections = [
    {
      kind: "kpi",
      title: { fa: "\u062E\u0644\u0627\u0635\u0647 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A", en: "Change summary" },
      cells: [
        { label: { fa: "\u06A9\u0644 \u0627\u0633\u062A\u0639\u0644\u0627\u0645", en: "Total queries" }, value: String(input.queries.length) },
        { label: { fa: "\u0628\u0627\u0632", en: "Open" }, value: String(aging.filter((a) => a.status !== "closed" && a.status !== "rejected").length) },
        { label: { fa: "\u0627\u0632 \u0645\u0647\u0644\u062A \u06AF\u0630\u0634\u062A\u0647", en: "Overdue" }, value: String(aging.filter((a) => a.overdue).length), tone: aging.some((a) => a.overdue) ? "bad" : "good" },
        { label: { fa: "\u0627\u062B\u0631 \u0647\u0632\u06CC\u0646\u0647\u200C\u0627\u06CC", en: "Cost impact" }, value: String(round(totalCost, 0)) },
        { label: { fa: "\u0627\u062B\u0631 \u0632\u0645\u0627\u0646\u06CC (\u0631\u0648\u0632)", en: "Time impact" }, value: String(totalDays), tone: totalDays > 0 ? "warn" : "good" },
        { label: { fa: "\u0646\u0631\u062E \u0686\u0648\u0646\u200C\u0633\u0627\u062E\u062A", en: "As-built rate" }, value: `${ab.completionRate}\u066A`, tone: ab.completionRate >= 90 ? "good" : "warn" }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u062F\u0641\u062A\u0631 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0648 \u062A\u063A\u06CC\u06CC\u0631 \u0641\u0646\u06CC \u06A9\u0627\u0631\u06AF\u0627\u0647\u06CC", en: "TQ / FCR register" },
      columns: [
        { key: "code", title: { fa: "\u0634\u0645\u0627\u0631\u0647", en: "Code" }, weight: 2 },
        { key: "kind", title: { fa: "\u0646\u0648\u0639", en: "Kind" } },
        { key: "title", title: { fa: "\u0645\u0648\u0636\u0648\u0639", en: "Subject" }, weight: 4 },
        { key: "discipline", title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", en: "Discipline" } },
        { key: "raisedAt", title: { fa: "\u062A\u0627\u0631\u06CC\u062E \u062B\u0628\u062A", en: "Raised" }, format: "date", align: "center" },
        { key: "age", title: { fa: "\u0633\u0646 (\u0631\u0648\u0632)", en: "Age" }, format: "number", align: "center" },
        { key: "status", title: { fa: "\u0648\u0636\u0639\u06CC\u062A", en: "Status" } },
        { key: "cost", title: { fa: "\u0627\u062B\u0631 \u0647\u0632\u06CC\u0646\u0647", en: "Cost" }, format: "currency", align: "end" },
        { key: "days", title: { fa: "\u0627\u062B\u0631 \u0632\u0645\u0627\u0646", en: "Days" }, format: "number", align: "center" },
        { key: "cr", title: { fa: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u063A\u06CC\u06CC\u0631", en: "Change request" }, weight: 2 }
      ],
      rows: aging.map((a) => {
        const q = byCode.get(a.code);
        return {
          code: a.code,
          kind: TQ_KIND_FA[a.kind] ?? a.kind,
          title: dash(q?.TitleFa),
          discipline: q ? DISCIPLINE_FA[q.Discipline] ?? q.Discipline : "\u2014",
          raisedAt: a.raisedAt,
          age: a.ageDays ?? "\u2014",
          status: a.overdue ? `${a.status} \u26A0` : a.status,
          cost: num(q?.CostImpact) || "\u2014",
          days: num(q?.TimeImpactDays) || "\u2014",
          cr: dash(q?.LinkedCrCode)
        };
      })
    }
  ];
  if (plan.drafts.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u063A\u06CC\u06CC\u0631", en: "Draft change requests" },
      note: {
        fa: "\u0627\u06CC\u0646 \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633\u200C\u0647\u0627 \u0627\u06CC\u062F\u0645\u067E\u0648\u062A\u0646\u062A \u0647\u0633\u062A\u0646\u062F\u061B \u0627\u062C\u0631\u0627\u06CC \u062F\u0648\u0628\u0627\u0631\u0647 \u0631\u06A9\u0648\u0631\u062F \u062A\u06A9\u0631\u0627\u0631\u06CC \u0646\u0645\u06CC\u200C\u0633\u0627\u0632\u062F.",
        en: "Drafts are idempotent; re-running creates no duplicates."
      },
      columns: [
        { key: "code", title: { fa: "\u06A9\u062F \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC", en: "Proposed code" }, weight: 2 },
        { key: "source", title: { fa: "\u0645\u0646\u0634\u0623", en: "Source" } },
        { key: "title", title: { fa: "\u0639\u0646\u0648\u0627\u0646", en: "Title" }, weight: 3 },
        { key: "cost", title: { fa: "\u0627\u062B\u0631 \u0647\u0632\u06CC\u0646\u0647", en: "Cost" }, format: "currency", align: "end" },
        { key: "days", title: { fa: "\u0627\u062B\u0631 \u0632\u0645\u0627\u0646", en: "Days" }, format: "number", align: "center" }
      ],
      rows: plan.drafts.map((d) => ({
        code: d.code,
        source: d.sourceCode,
        title: d.titleFa,
        cost: d.costImpact || "\u2014",
        days: d.timeImpactDays || "\u2014"
      }))
    });
  }
  return {
    code: "RPT-ENG-TQF",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0648 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0641\u0646\u06CC \u06A9\u0627\u0631\u06AF\u0627\u0647", en: "TQ / FCR Register" },
    periodicity: "weekly",
    sourceModule: SRC,
    audiences: ["internal", "official"],
    sections
  };
}
function buildProgressReport(input) {
  const p = input.progress;
  const variance = round(p.actualPct - p.plannedPct, 2);
  const sections = [
    {
      kind: "kpi",
      title: { fa: "\u0648\u0636\u0639\u06CC\u062A \u06A9\u0644\u06CC \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Engineering overview" },
      cells: [
        { label: { fa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0648\u0627\u0642\u0639\u06CC", en: "Actual" }, value: `${p.actualPct}\u066A` },
        { label: { fa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC", en: "Planned" }, value: `${p.plannedPct}\u066A` },
        { label: { fa: "\u0627\u0646\u062D\u0631\u0627\u0641", en: "Variance" }, value: `${variance}\u066A`, tone: variance >= 0 ? "good" : variance >= -5 ? "warn" : "bad" },
        { label: { fa: "SPI \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Engineering SPI" }, value: p.spi === null ? "\u2014" : String(p.spi), tone: p.spi === null ? void 0 : p.spi >= 0.95 ? "good" : p.spi >= 0.85 ? "warn" : "bad" },
        { label: { fa: "\u0648\u0632\u0646 \u06A9\u0633\u0628\u200C\u0634\u062F\u0647", en: "Earned weight" }, value: String(p.earnedWeight) },
        { label: { fa: "\u0648\u0632\u0646 \u06A9\u0644", en: "Total weight" }, value: String(p.totalWeight) }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0628\u0647 \u062A\u0641\u06A9\u06CC\u06A9 \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", en: "Progress by discipline" },
      columns: [
        { key: "discipline", title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", en: "Discipline" }, weight: 2 },
        { key: "count", title: { fa: "\u062A\u0639\u062F\u0627\u062F \u0645\u062F\u0631\u06A9", en: "Documents" }, format: "number", align: "center" },
        { key: "weight", title: { fa: "\u0648\u0632\u0646", en: "Weight" }, format: "number", align: "center" },
        { key: "planned", title: { fa: "\u0628\u0631\u0646\u0627\u0645\u0647", en: "Planned" }, format: "percent", align: "center" },
        { key: "actual", title: { fa: "\u0648\u0627\u0642\u0639\u06CC", en: "Actual" }, format: "percent", align: "center" },
        { key: "variance", title: { fa: "\u0627\u0646\u062D\u0631\u0627\u0641", en: "Variance" }, format: "percent", align: "center" }
      ],
      rows: p.byDiscipline.map((d) => ({
        discipline: DISCIPLINE_FA[d.discipline] ?? d.discipline,
        count: d.count,
        weight: d.weight,
        planned: d.plannedPct,
        actual: d.actualPct,
        variance: round(d.actualPct - d.plannedPct, 2)
      }))
    },
    {
      kind: "table",
      title: { fa: "\u0634\u0627\u062E\u0635\u200C\u0647\u0627\u06CC \u06A9\u0644\u06CC\u062F\u06CC \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Engineering KPIs" },
      columns: [
        { key: "code", title: { fa: "\u06A9\u062F", en: "Code" } },
        { key: "name", title: { fa: "\u0634\u0627\u062E\u0635", en: "Indicator" }, weight: 3 },
        { key: "value", title: { fa: "\u0645\u0642\u062F\u0627\u0631", en: "Value" }, align: "center" },
        { key: "target", title: { fa: "\u0647\u062F\u0641", en: "Target" }, align: "center" },
        { key: "status", title: { fa: "\u0648\u0636\u0639\u06CC\u062A", en: "Status" }, align: "center" }
      ],
      rows: input.kpis.map((k) => ({
        code: k.code,
        name: k.title.fa,
        value: k.value === null ? "\u2014" : `${k.value}${k.unit}`,
        target: `${k.direction === "higher" ? "\u2265" : "\u2264"} ${k.target}${k.unit}`,
        status: k.status === "good" ? "\u0645\u0637\u0644\u0648\u0628" : k.status === "warn" ? "\u0647\u0634\u062F\u0627\u0631" : k.status === "bad" ? "\u0646\u0627\u0645\u0637\u0644\u0648\u0628" : "\u0628\u06CC\u200C\u062F\u0627\u062F\u0647"
      }))
    }
  ];
  if (input.alerts && input.alerts.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "\u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u0632\u0648\u062F\u0647\u0646\u06AF\u0627\u0645", en: "Early warnings" },
      columns: [
        { key: "code", title: { fa: "\u06A9\u062F", en: "Code" } },
        { key: "severity", title: { fa: "\u0634\u062F\u062A", en: "Severity" }, align: "center" },
        { key: "title", title: { fa: "\u0639\u0646\u0648\u0627\u0646", en: "Title" }, weight: 2 },
        { key: "detail", title: { fa: "\u0634\u0631\u062D", en: "Detail" }, weight: 4 }
      ],
      rows: input.alerts.map((a) => ({
        code: a.code,
        severity: a.severity === "high" ? "\u0628\u0627\u0644\u0627" : a.severity === "medium" ? "\u0645\u062A\u0648\u0633\u0637" : "\u067E\u0627\u06CC\u06CC\u0646",
        title: a.titleFa,
        detail: a.detailFa
      }))
    });
  }
  return {
    code: "RPT-ENG-PRG",
    title: {
      fa: input.periodLabel ? `\u06AF\u0632\u0627\u0631\u0634 \u067E\u06CC\u0634\u0631\u0641\u062A \u0645\u0647\u0646\u062F\u0633\u06CC \u2014 ${input.periodLabel}` : "\u06AF\u0632\u0627\u0631\u0634 \u0645\u0627\u0647\u0627\u0646\u0647 \u067E\u06CC\u0634\u0631\u0641\u062A \u0645\u0647\u0646\u062F\u0633\u06CC",
      en: "Engineering Monthly Progress Report"
    },
    periodicity: "monthly",
    sourceModule: SRC,
    audiences: ["internal", "official"],
    sections
  };
}
function buildVprReport(input) {
  const s = input.summary ?? vprSummary(input.rows, input.asOf);
  const sections = [
    {
      kind: "kpi",
      title: { fa: "\u062E\u0644\u0627\u0635\u0647 \u0645\u062F\u0627\u0631\u06A9 \u0633\u0627\u0632\u0646\u062F\u06AF\u0627\u0646", en: "Vendor print summary" },
      cells: [
        { label: { fa: "\u06A9\u0644 \u0645\u062F\u0631\u06A9", en: "Total" }, value: String(s.total) },
        { label: { fa: "\u062F\u0631 \u062D\u0627\u0644 \u0628\u0631\u0631\u0633\u06CC", en: "Under review" }, value: String(s.underReview) },
        { label: { fa: "\u062A\u0623\u06CC\u06CC\u062F \u0633\u0627\u062E\u062A", en: "Approved for mfg" }, value: String(s.approvedForMfg), tone: "good" },
        { label: { fa: "\u0645\u0631\u062F\u0648\u062F", en: "Rejected" }, value: String(s.rejected), tone: s.rejected > 0 ? "warn" : "good" },
        { label: { fa: "\u0627\u0632 \u0645\u0647\u0644\u062A \u06AF\u0630\u0634\u062A\u0647", en: "Overdue" }, value: String(s.overdue), tone: s.overdue > 0 ? "bad" : "good" },
        { label: { fa: "\u0628\u062F\u0648\u0646 \u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F", en: "Unmapped to PO" }, value: String(s.unmappedToPo.length), tone: s.unmappedToPo.length > 0 ? "warn" : "good" }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u062F\u0641\u062A\u0631 \u0645\u062F\u0627\u0631\u06A9 \u0641\u0646\u06CC \u0633\u0627\u0632\u0646\u062F\u06AF\u0627\u0646", en: "Vendor print register" },
      note: { fa: "\u0645\u062F\u0631\u06A9 \u0628\u062F\u0648\u0646 \u0646\u06AF\u0627\u0634\u062A \u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F \u0642\u0627\u0628\u0644 \u0631\u062F\u06CC\u0627\u0628\u06CC \u0645\u0627\u0644\u06CC \u0646\u06CC\u0633\u062A.", en: "Documents without PO mapping are not financially traceable." },
      columns: [
        { key: "docNo", title: { fa: "\u0634\u0645\u0627\u0631\u0647 \u0645\u062F\u0631\u06A9", en: "Doc no" }, weight: 2 },
        { key: "vendor", title: { fa: "\u0633\u0627\u0632\u0646\u062F\u0647", en: "Vendor" }, weight: 2 },
        { key: "title", title: { fa: "\u0639\u0646\u0648\u0627\u0646", en: "Title" }, weight: 3 },
        { key: "po", title: { fa: "\u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F", en: "PO" } },
        { key: "tag", title: { fa: "\u062A\u06AF", en: "Tag" } },
        { key: "rev", title: { fa: "\u0631\u06CC\u0648\u06CC\u0698\u0646", en: "Rev" }, align: "center" },
        { key: "received", title: { fa: "\u062F\u0631\u06CC\u0627\u0641\u062A", en: "Received" }, format: "date", align: "center" },
        { key: "code", title: { fa: "\u06A9\u062F \u0628\u0631\u0631\u0633\u06CC", en: "Code" }, align: "center" },
        { key: "status", title: { fa: "\u0648\u0636\u0639\u06CC\u062A", en: "Status" } }
      ],
      rows: input.rows.map((v) => ({
        docNo: v.VendorDocNo,
        vendor: v.VendorName,
        title: v.TitleFa,
        po: dash(v.PoNo),
        tag: dash(v.TagNo),
        rev: v.RevCode,
        received: v.ReceivedAt,
        code: dash(v.ReviewCode),
        status: v.Status
      }))
    }
  ];
  return {
    code: "RPT-ENG-VPR",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0628\u0631\u0631\u0633\u06CC \u0645\u062F\u0627\u0631\u06A9 \u0633\u0627\u0632\u0646\u062F\u06AF\u0627\u0646", en: "Vendor Print Review Register" },
    periodicity: "weekly",
    sourceModule: SRC,
    audiences: ["internal"],
    sections
  };
}
function buildIdcReport(input) {
  const st = input.status ?? idcStatus(input.checks, input.asOf);
  const cs = input.clashSummaryData ?? clashSummary(input.clashes);
  return {
    code: "RPT-ENG-IDC",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0628\u0631\u0631\u0633\u06CC \u0628\u06CC\u0646\u200C\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u06CC \u0648 \u062A\u062F\u0627\u062E\u0644 \u0645\u062F\u0644", en: "IDC and Clash Report" },
    periodicity: "weekly",
    sourceModule: SRC,
    audiences: ["internal"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "\u062E\u0644\u0627\u0635\u0647 \u0647\u0645\u0627\u0647\u0646\u06AF\u06CC", en: "Coordination summary" },
        cells: [
          { label: { fa: "\u0631\u06CC\u0648\u06CC\u0698\u0646 \u062F\u0631 \u06AF\u0631\u062F\u0634", en: "Revisions in IDC" }, value: String(st.length) },
          { label: { fa: "\u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647", en: "Complete" }, value: String(st.filter((x) => x.complete).length), tone: "good" },
          { label: { fa: "\u062F\u0627\u0631\u0627\u06CC \u0627\u0639\u062A\u0631\u0627\u0636", en: "With objection" }, value: String(st.filter((x) => x.objected > 0).length), tone: st.some((x) => x.objected > 0) ? "warn" : "good" },
          { label: { fa: "\u06A9\u0644 \u062A\u062F\u0627\u062E\u0644", en: "Total clashes" }, value: String(cs.total) },
          { label: { fa: "\u062A\u062F\u0627\u062E\u0644 \u0628\u0627\u0632", en: "Open clashes" }, value: String(cs.open), tone: cs.open > 0 ? "bad" : "good" },
          { label: { fa: "\u0646\u0631\u062E \u0631\u0641\u0639", en: "Resolution rate" }, value: `${cs.resolutionRate}\u066A`, tone: cs.resolutionRate >= 80 ? "good" : "warn" }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u0648\u0636\u0639\u06CC\u062A \u0628\u0631\u0631\u0633\u06CC \u0628\u06CC\u0646\u200C\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u06CC", en: "Squad check status" },
        columns: [
          { key: "rev", title: { fa: "\u0631\u06CC\u0648\u06CC\u0698\u0646", en: "Revision" }, weight: 2 },
          { key: "requested", title: { fa: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A", en: "Requested" }, format: "number", align: "center" },
          { key: "cleared", title: { fa: "\u062A\u0623\u06CC\u06CC\u062F", en: "Cleared" }, format: "number", align: "center" },
          { key: "objected", title: { fa: "\u0627\u0639\u062A\u0631\u0627\u0636", en: "Objected" }, format: "number", align: "center" },
          { key: "pending", title: { fa: "\u0645\u0639\u0644\u0642", en: "Pending" }, format: "number", align: "center" },
          { key: "overdue", title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646 \u062A\u0623\u062E\u06CC\u0631\u062F\u0627\u0631", en: "Overdue disciplines" }, weight: 3 }
        ],
        rows: st.map((x) => ({
          rev: x.revisionId,
          requested: x.requested,
          cleared: x.cleared,
          objected: x.objected,
          pending: x.pending,
          overdue: x.overdue.length ? x.overdue.map((d) => DISCIPLINE_FA[d] ?? d).join("\u060C ") : "\u2014"
        }))
      },
      {
        kind: "table",
        title: { fa: "\u062A\u062F\u0627\u062E\u0644 \u0628\u0647 \u062A\u0641\u06A9\u06CC\u06A9 \u062C\u0641\u062A \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", en: "Clashes by discipline pair" },
        note: { fa: "\u0645\u062F\u0644 \u0633\u0647\u200C\u0628\u0639\u062F\u06CC \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0631\u0646\u062F\u0631 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0641\u0642\u0637 \u062E\u0631\u0648\u062C\u06CC \u0627\u0628\u0632\u0627\u0631 \u062A\u0634\u062E\u06CC\u0635 \u062B\u0628\u062A \u0645\u06CC\u200C\u06AF\u0631\u062F\u062F.", en: "3D models are not rendered; only detection tool output is logged." },
        columns: [
          { key: "pair", title: { fa: "\u062C\u0641\u062A \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", en: "Pair" }, weight: 3 },
          { key: "count", title: { fa: "\u062A\u0639\u062F\u0627\u062F", en: "Count" }, format: "number", align: "center" },
          { key: "open", title: { fa: "\u0628\u0627\u0632", en: "Open" }, format: "number", align: "center" }
        ],
        rows: cs.byPair.map((p) => ({
          pair: p.pair.split("\u2194").map((d) => DISCIPLINE_FA[d] ?? d).join(" \u2194 "),
          count: p.count,
          open: p.open
        }))
      },
      {
        kind: "table",
        title: { fa: "\u0641\u0647\u0631\u0633\u062A \u062A\u062F\u0627\u062E\u0644\u0627\u062A", en: "Clash log" },
        columns: [
          { key: "no", title: { fa: "\u0634\u0645\u0627\u0631\u0647", en: "Clash no" } },
          { key: "tool", title: { fa: "\u0627\u0628\u0632\u0627\u0631", en: "Tool" } },
          { key: "a", title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646 \u0627\u0644\u0641", en: "Discipline A" } },
          { key: "b", title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646 \u0628", en: "Discipline B" } },
          { key: "zone", title: { fa: "\u0646\u0627\u062D\u06CC\u0647", en: "Zone" } },
          { key: "severity", title: { fa: "\u0634\u062F\u062A", en: "Severity" }, align: "center" },
          { key: "status", title: { fa: "\u0648\u0636\u0639\u06CC\u062A", en: "Status" }, align: "center" },
          { key: "stage", title: { fa: "\u0645\u0631\u062D\u0644\u0647 \u0628\u0627\u0632\u0628\u06CC\u0646\u06CC", en: "Stage" }, align: "center" }
        ],
        rows: input.clashes.map((c) => ({
          no: c.ClashNo,
          tool: c.SourceTool,
          a: DISCIPLINE_FA[c.DisciplineA] ?? c.DisciplineA,
          b: DISCIPLINE_FA[c.DisciplineB] ?? c.DisciplineB,
          zone: dash(c.Zone),
          severity: c.Severity,
          status: c.Status,
          stage: c.ModelReviewStage ? `${c.ModelReviewStage}\u066A` : "\u2014"
        }))
      }
    ]
  };
}
function buildEngReport(code, input) {
  const def = getEngReport(code);
  if (!def) return null;
  const revsByDel = /* @__PURE__ */ new Map();
  for (const r of input.revisions) {
    const arr = revsByDel.get(r.DeliverableId) ?? [];
    arr.push(r);
    revsByDel.set(r.DeliverableId, arr);
  }
  const delById = new Map(input.deliverables.map((d) => [d.Id, d]));
  switch (code) {
    case "RPT-ENG-MDR":
      return buildMdrStatusReport({ deliverables: input.deliverables, revisionsByDeliverable: revsByDel });
    case "RPT-ENG-TRN":
      return buildTransmittalReport({ revisions: input.revisions, deliverableById: delById, transmittalId: input.transmittalId });
    case "RPT-ENG-CRS":
      return buildCrsReport({ comments: input.comments, revisionId: input.revisionId });
    case "RPT-ENG-TQF":
      return buildTqFcrReport({ queries: input.queries, asOf: input.asOf });
    case "RPT-ENG-PRG": {
      const progress = input.progress ?? engineeringProgress(
        input.deliverables.map((d) => ({ deliverable: d, revisions: revsByDel.get(d.Id) ?? [] })),
        input.asOf
      );
      const aging = reviewAging(input.revisions.filter((r) => r.Purpose === "IFA"), input.asOf, delById);
      const kpis = input.kpis ?? engineeringKpis({
        progress,
        revisions: input.revisions,
        aging,
        queries: input.queries,
        deliverables: input.deliverables,
        asOf: input.asOf
      });
      return buildProgressReport({ progress, kpis, alerts: input.alerts, periodLabel: input.periodLabel });
    }
    case "RPT-ENG-VPR":
      return buildVprReport({ rows: input.vendorDocs, asOf: input.asOf });
    case "RPT-ENG-IDC":
      return buildIdcReport({ checks: input.checks, clashes: input.clashes, asOf: input.asOf });
    case "RPT-ENG-EXEC": {
      const progress = input.progress ?? engineeringProgress(
        input.deliverables.map((d) => ({ deliverable: d, revisions: revsByDel.get(d.Id) ?? [] })),
        input.asOf
      );
      const aging = reviewAging(input.revisions.filter((r) => r.Purpose === "IFA"), input.asOf, delById);
      const kpis = input.kpis ?? engineeringKpis({
        progress,
        revisions: input.revisions,
        aging,
        queries: input.queries,
        deliverables: input.deliverables,
        asOf: input.asOf
      });
      const lockPlan = input.lockPlan ?? planIfcLocks({
        activities: input.activities ?? [],
        activityDocLinks: input.activityDocLinks ?? [],
        deliverables: input.deliverables,
        revisions: input.revisions
      });
      const alerts = input.alerts ?? engineeringAlerts({
        aging,
        revisionsByDeliverable: revsByDel,
        queries: input.queries,
        lockPlan,
        kpis,
        asOf: input.asOf
      });
      const eot = input.eotDrafts ?? planEotClaims({ aging, deliverableById: delById }).drafts;
      return buildExecutiveReport({
        progress,
        kpis,
        alerts,
        aging,
        queries: input.queries,
        lockPlan,
        eotDrafts: eot,
        asOf: input.asOf,
        periodLabel: input.periodLabel
      });
    }
    default:
      return null;
  }
}
function buildExecutiveReport(input) {
  const p = input.progress;
  const variance = round(p.actualPct - p.plannedPct, 2);
  const critical = input.alerts.filter((a) => a.severity === "high").length;
  const verdict = p.spi !== null && p.spi < 0.85 ? { fa: "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0645\u062F\u0627\u062E\u0644\u0647\u0654 \u0641\u0648\u0631\u06CC", tone: "bad" } : critical > 0 || p.spi !== null && p.spi < 0.95 ? { fa: "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0648\u062C\u0647 \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC", tone: "warn" } : { fa: "\u062F\u0631 \u0645\u0633\u06CC\u0631 \u0628\u0631\u0646\u0627\u0645\u0647", tone: "good" };
  const blockedActivities = input.lockPlan.lock.length;
  const claimableDays = (input.eotDrafts ?? []).reduce((sum, d) => sum + Number(d.extensionDays ?? 0), 0);
  const openQueries = input.queries.filter((q) => q.Status !== "closed" && q.Status !== "answered");
  const queryCost = openQueries.reduce((sum, q) => sum + Number(q.CostImpact ?? 0), 0);
  const queryDays = openQueries.reduce((sum, q) => sum + Number(q.TimeImpactDays ?? 0), 0);
  const sections = [
    {
      kind: "kpi",
      title: { fa: "\u0642\u0636\u0627\u0648\u062A \u06A9\u0644\u06CC", en: "Overall verdict" },
      cells: [
        { label: { fa: "\u0648\u0636\u0639\u06CC\u062A \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Status" }, value: verdict.fa, tone: verdict.tone },
        {
          label: { fa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0648\u0627\u0642\u0639\u06CC", en: "Actual" },
          value: `${p.actualPct}\u066A`,
          tone: variance >= 0 ? "good" : variance >= -5 ? "warn" : "bad"
        },
        { label: { fa: "\u0627\u0646\u062D\u0631\u0627\u0641 \u0627\u0632 \u0628\u0631\u0646\u0627\u0645\u0647", en: "Variance" }, value: `${variance}\u066A`, tone: variance >= 0 ? "good" : "bad" },
        {
          label: { fa: "SPI \u0645\u0647\u0646\u062F\u0633\u06CC", en: "SPI" },
          value: p.spi === null ? "\u2014" : String(p.spi),
          tone: p.spi === null ? void 0 : p.spi >= 0.95 ? "good" : p.spi >= 0.85 ? "warn" : "bad"
        }
      ]
    },
    {
      kind: "kpi",
      title: { fa: "\u0627\u062B\u0631 \u0628\u0631 \u0627\u062C\u0631\u0627 \u0648 \u0642\u0631\u0627\u0631\u062F\u0627\u062F", en: "Impact on execution and contract" },
      cells: [
        {
          label: { fa: "\u0641\u0639\u0627\u0644\u06CC\u062A \u0645\u062A\u0648\u0642\u0641 \u0628\u0627\u0628\u062A \u0646\u0628\u0648\u062F \u0645\u062F\u0631\u06A9", en: "Activities blocked" },
          value: String(blockedActivities),
          tone: blockedActivities === 0 ? "good" : blockedActivities > 5 ? "bad" : "warn"
        },
        {
          label: { fa: "\u0631\u0648\u0632 \u0642\u0627\u0628\u0644 \u0645\u0637\u0627\u0644\u0628\u0647 \u0627\u0632 \u06A9\u0627\u0631\u0641\u0631\u0645\u0627", en: "Claimable days" },
          value: String(claimableDays),
          tone: claimableDays === 0 ? "good" : "warn"
        },
        {
          label: { fa: "\u0627\u062B\u0631 \u0647\u0632\u06CC\u0646\u0647\u200C\u0627\u06CC \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0628\u0627\u0632", en: "Open query cost" },
          value: queryCost ? queryCost.toLocaleString("fa-IR") : "\u2014",
          tone: queryCost > 0 ? "warn" : "good"
        },
        {
          label: { fa: "\u0627\u062B\u0631 \u0632\u0645\u0627\u0646\u06CC \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0628\u0627\u0632", en: "Open query days" },
          value: queryDays ? `${queryDays} \u0631\u0648\u0632` : "\u2014",
          tone: queryDays > 0 ? "warn" : "good"
        }
      ]
    }
  ];
  const rank = { high: 0, medium: 1, low: 2 };
  const decisions = [...input.alerts].sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 3);
  if (decisions.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0635\u0645\u06CC\u0645", en: "Requires decision" },
      note: {
        fa: "\u0633\u0647 \u0642\u0644\u0645 \u0628\u0627 \u0628\u0627\u0644\u0627\u062A\u0631\u06CC\u0646 \u0634\u062F\u062A\u061B \u0641\u0647\u0631\u0633\u062A \u06A9\u0627\u0645\u0644 \u062F\u0631 \u06AF\u0632\u0627\u0631\u0634 \u067E\u06CC\u0634\u0631\u0641\u062A \u0645\u0627\u0647\u0627\u0646\u0647 \u0627\u0633\u062A.",
        en: "Top three by severity; full list in the monthly progress report."
      },
      columns: [
        { key: "severity", title: { fa: "\u0634\u062F\u062A", en: "Severity" }, align: "center" },
        { key: "title", title: { fa: "\u0645\u0648\u0636\u0648\u0639", en: "Subject" }, weight: 2 },
        { key: "detail", title: { fa: "\u0634\u0631\u062D", en: "Detail" }, weight: 4 }
      ],
      rows: decisions.map((a) => ({
        severity: a.severity === "high" ? "\u0628\u0627\u0644\u0627" : a.severity === "medium" ? "\u0645\u062A\u0648\u0633\u0637" : "\u067E\u0627\u06CC\u06CC\u0646",
        title: a.titleFa,
        detail: a.detailFa
      }))
    });
  }
  const lagging = p.byDiscipline.map((d) => ({ ...d, variance: round(d.actualPct - d.plannedPct, 2) })).filter((d) => d.variance < 0).sort((a, b) => a.variance - b.variance).slice(0, 5);
  if (lagging.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u200C\u0647\u0627\u06CC \u0639\u0642\u0628 \u0627\u0632 \u0628\u0631\u0646\u0627\u0645\u0647", en: "Lagging disciplines" },
      columns: [
        { key: "discipline", title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", en: "Discipline" }, weight: 2 },
        { key: "weight", title: { fa: "\u0648\u0632\u0646", en: "Weight" }, format: "number", align: "center" },
        { key: "planned", title: { fa: "\u0628\u0631\u0646\u0627\u0645\u0647", en: "Planned" }, format: "percent", align: "center" },
        { key: "actual", title: { fa: "\u0648\u0627\u0642\u0639\u06CC", en: "Actual" }, format: "percent", align: "center" },
        { key: "variance", title: { fa: "\u0627\u0646\u062D\u0631\u0627\u0641", en: "Variance" }, format: "percent", align: "center" }
      ],
      rows: lagging.map((d) => ({
        discipline: DISCIPLINE_FA[d.discipline] ?? d.discipline,
        weight: d.weight,
        planned: d.plannedPct,
        actual: d.actualPct,
        variance: d.variance
      }))
    });
  } else {
    sections.push({
      kind: "text",
      title: { fa: "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u200C\u0647\u0627\u06CC \u0639\u0642\u0628 \u0627\u0632 \u0628\u0631\u0646\u0627\u0645\u0647", en: "Lagging disciplines" },
      body: { fa: "\u0647\u06CC\u0686 \u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646\u06CC \u0639\u0642\u0628 \u0627\u0632 \u0628\u0631\u0646\u0627\u0645\u0647 \u0646\u06CC\u0633\u062A.", en: "No discipline is behind plan." }
    });
  }
  return {
    code: "RPT-ENG-EXEC",
    title: {
      fa: input.periodLabel ? `\u06AF\u0632\u0627\u0631\u0634 \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u0645\u0647\u0646\u062F\u0633\u06CC \u2014 ${input.periodLabel}` : "\u06AF\u0632\u0627\u0631\u0634 \u062A\u06A9\u200C\u0635\u0641\u062D\u0647\u200C\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u0645\u0647\u0646\u062F\u0633\u06CC",
      en: "Engineering Executive Summary"
    },
    periodicity: "monthly",
    sourceModule: SRC,
    /* فقط داخلی: شامل برآورد ادعای قابل مطالبه است و ارسال آن به کارفرما
     * موضع قراردادی را پیش از طرح رسمی ادعا فاش می‌کند. */
    audiences: ["internal"],
    sections
  };
}
function engReportMeta(code) {
  const def = getEngReport(code);
  return def ? { def, periodicity: toRptPeriodicity(def.periodicity) } : null;
}
function ifcLockCoverage(input) {
  const onlyNotStarted = input.onlyNotStarted !== false;
  const linked = new Set(input.activityDocLinks.map((l) => l.activityId));
  const scope = onlyNotStarted ? input.activities.filter((a) => !a.ActualStart) : input.activities;
  const unmapped = [];
  for (const a of scope) {
    if (linked.has(a.Id)) continue;
    unmapped.push({
      activityId: a.Id,
      code: a.Code ?? null,
      nameFa: a.NameFa ?? null,
      reasonFa: "\u0641\u0639\u0627\u0644\u06CC\u062A \u0628\u0647 \u0647\u06CC\u0686 \u0645\u062F\u0631\u06A9\u06CC \u0646\u06AF\u0627\u0634\u062A \u0646\u0634\u062F\u0647\u061B \u0645\u062D\u0627\u0641\u0638 IFC \u0631\u0648\u06CC \u0622\u0646 \u0627\u0639\u0645\u0627\u0644 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F"
    });
  }
  const total = scope.length;
  const mapped = total - unmapped.length;
  return {
    totalActivities: total,
    mappedActivities: mapped,
    unmappedActivities: unmapped.length,
    coveragePct: total === 0 ? null : round(mapped / total * 100, 2),
    unmapped
  };
}
function periodCodeOf(asOf) {
  const s = String(asOf ?? "");
  return s.length >= 7 ? s.slice(0, 7) : s;
}
function engKpiSnapshots(kpis, projectId, periodCode) {
  return kpis.map((k) => ({
    ProjectId: projectId,
    KpiCode: k.code,
    PeriodCode: periodCode,
    Value: k.value,
    Target: k.target ?? null,
    Status: k.status
  }));
}
function engProgressSnapshots(input) {
  const period = input.periodCode ?? periodCodeOf(input.asOf);
  const ifcByDel = new Set(
    input.revisions.filter((r) => r.Purpose === "IFC").map((r) => r.DeliverableId)
  );
  const openComments = input.comments.filter((c) => c.ResponseStatus !== "agreed");
  const delByDiscipline = /* @__PURE__ */ new Map();
  for (const d of input.deliverables) {
    const arr = delByDiscipline.get(d.Discipline) ?? [];
    arr.push(d);
    delByDiscipline.set(d.Discipline, arr);
  }
  const delById = new Map(input.deliverables.map((d) => [d.Id, d]));
  const revById = new Map(input.revisions.map((r) => [r.Id, r]));
  const openByDiscipline = /* @__PURE__ */ new Map();
  for (const c of openComments) {
    const rev = revById.get(c.RevisionId);
    const del = rev ? delById.get(rev.DeliverableId) : void 0;
    if (!del) continue;
    openByDiscipline.set(del.Discipline, (openByDiscipline.get(del.Discipline) ?? 0) + 1);
  }
  const rows = [];
  for (const byDis of input.progress.byDiscipline) {
    const dels = delByDiscipline.get(byDis.discipline) ?? [];
    const earned = round(byDis.weight * byDis.actualPct / 100, 4);
    const planned = round(byDis.weight * byDis.plannedPct / 100, 4);
    rows.push({
      ProjectId: input.projectId,
      PeriodCode: period,
      Discipline: byDis.discipline,
      PlannedPct: byDis.plannedPct,
      ActualPct: byDis.actualPct,
      EarnedWeight: earned,
      SpiEng: planned > 0 ? round(earned / planned, 4) : null,
      DeliverableCount: dels.length,
      IfcIssuedCount: dels.filter((d) => ifcByDel.has(d.Id)).length,
      OpenCommentCount: openByDiscipline.get(byDis.discipline) ?? 0,
      SnapshotAt: input.asOf
    });
  }
  rows.push({
    ProjectId: input.projectId,
    PeriodCode: period,
    Discipline: "ALL",
    PlannedPct: input.progress.plannedPct,
    ActualPct: input.progress.actualPct,
    EarnedWeight: input.progress.earnedWeight,
    SpiEng: input.progress.spi,
    DeliverableCount: input.deliverables.length,
    IfcIssuedCount: ifcByDel.size,
    OpenCommentCount: openComments.length,
    SnapshotAt: input.asOf
  });
  return rows;
}
function eotSeverity(overdueDays) {
  if (overdueDays > 30) return "critical";
  if (overdueDays >= 15) return "high";
  if (overdueDays >= 8) return "medium";
  return "info";
}
function planEotClaims(input) {
  const threshold = input.minOverdueDays ?? 8;
  const contractDays = input.contractReviewDays ?? DEFAULT_CONTRACT_REVIEW_DAYS;
  const delById = input.deliverableById ?? /* @__PURE__ */ new Map();
  const drafts = [];
  const skippedOnTime = [];
  const skippedBelowThreshold = [];
  const skippedNoDueDate = [];
  for (const a of input.aging) {
    const over = a.overdueDays;
    if (over === null || over <= 0) {
      skippedOnTime.push(a.revisionId);
      continue;
    }
    if (over < threshold) {
      skippedBelowThreshold.push(a.revisionId);
      continue;
    }
    if (!a.dueAt) {
      skippedNoDueDate.push(a.revisionId);
      continue;
    }
    const d = delById.get(a.deliverableId);
    const docNo = d?.DocNo ?? a.deliverableId;
    drafts.push({
      code: `EOT-ENG-${a.revisionId}`,
      revisionId: a.revisionId,
      deliverableId: a.deliverableId,
      docNo,
      titleFa: `\u062A\u0623\u062E\u06CC\u0631 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0641\u0631\u0645\u0627 \u2014 \u0645\u062F\u0631\u06A9 ${docNo}`,
      noticeDate: a.dueAt,
      overdueDays: over,
      /* روزهای تمدید برابر تأخیر خالص است؛ اثر شبکه‌ای بر مسیر بحرانی در
       * ماژول برنامه‌ریزی سنجیده می‌شود، نه اینجا. */
      extensionDays: over,
      severity: eotSeverity(over),
      evidenceFa: `\u0645\u062F\u0631\u06A9 ${docNo} \u062F\u0631 ${a.issuedAt} \u0627\u0631\u0633\u0627\u0644 \u0634\u062F\u061B \u0645\u0647\u0644\u062A \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC ${contractDays} \u0631\u0648\u0632 \u0648 \u0633\u0631\u0631\u0633\u06CC\u062F ${a.dueAt} \u0628\u0648\u062F. \u062A\u0623\u062E\u06CC\u0631 \u062B\u0628\u062A\u200C\u0634\u062F\u0647 ${over} \u0631\u0648\u0632 \u0627\u0633\u062A.`
    });
  }
  drafts.sort((x, y) => y.overdueDays - x.overdueDays);
  return {
    drafts,
    skippedOnTime,
    skippedBelowThreshold,
    skippedNoDueDate,
    totalExtensionDays: drafts.reduce((s, d) => s + d.extensionDays, 0)
  };
}
function isDesignNcr(n) {
  const hay = `${n.Code} ${n.TitleFa} ${n.Disposition ?? ""}`.toLowerCase();
  if (/design|طراح|نقشه|مدرک|مهندس/.test(hay)) return true;
  return /^ncr-(eng|dsg)/i.test(n.Code);
}
function planDesignNcrActions(input) {
  const existing = new Set((input.existingQueries ?? []).map((q) => q.Code));
  const byDiscipline = /* @__PURE__ */ new Map();
  for (const d of input.deliverables) {
    const arr = byDiscipline.get(d.Discipline) ?? [];
    arr.push(d);
    byDiscipline.set(d.Discipline, arr);
  }
  const drafts = [];
  const skippedClosed = [];
  const skippedNotDesign = [];
  const unmatchedDiscipline = [];
  for (const n of input.ncrs) {
    if (!isDesignNcr(n)) {
      skippedNotDesign.push(n.Code);
      continue;
    }
    if (n.Status === "closed" || n.Status === "cancelled") {
      skippedClosed.push(n.Code);
      continue;
    }
    const code = `DCN-${n.Code}`;
    if (existing.has(code)) continue;
    const dis = n.Discipline ?? "";
    const candidates = byDiscipline.get(dis) ?? [];
    const target = candidates.length === 1 ? candidates[0] : null;
    if (!target && dis) unmatchedDiscipline.push(n.Code);
    drafts.push({
      code,
      ncrId: n.Id,
      ncrCode: n.Code,
      titleFa: `\u0627\u0635\u0644\u0627\u062D \u0645\u062F\u0631\u06A9 \u0628\u0631 \u067E\u0627\u06CC\u0647\u0654 \u0639\u062F\u0645\u200C\u0627\u0646\u0637\u0628\u0627\u0642 ${n.Code} \u2014 ${n.TitleFa}`,
      discipline: dis || "general",
      raisedAt: n.RaisedAt,
      dueAt: n.DueAt ?? null,
      deliverableId: target?.Id ?? null,
      docNo: target?.DocNo ?? null,
      severity: n.Severity ?? "major",
      reasonFa: target ? `\u0639\u062F\u0645\u200C\u0627\u0646\u0637\u0628\u0627\u0642 \u0637\u0631\u0627\u062D\u06CC \u0628\u0647 \u0645\u062F\u0631\u06A9 ${target.DocNo} \u0646\u0633\u0628\u062A \u062F\u0627\u062F\u0647 \u0634\u062F` : `\u0645\u062F\u0631\u06A9 \u0647\u062F\u0641 \u062A\u0639\u06CC\u06CC\u0646 \u0646\u0634\u062F\u061B ${candidates.length} \u0645\u062F\u0631\u06A9 \u0647\u0645\u200C\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646 \u06CC\u0627\u0641\u062A \u0634\u062F \u0648 \u0627\u0646\u062A\u062E\u0627\u0628 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u06CC\u0645\u0646 \u0646\u06CC\u0633\u062A`
    });
  }
  return { drafts, skippedClosed, skippedNotDesign, unmatchedDiscipline };
}
function auditVendorPoRefs(input) {
  const known = input.knownPoNumbers ? new Set(input.knownPoNumbers.map((p) => String(p).trim())) : null;
  const issues = [];
  let linked = 0;
  for (const v of input.vendorDocs) {
    const po = v.PoNo ? String(v.PoNo).trim() : "";
    if (!po) {
      issues.push({
        vendorDocNo: v.VendorDocNo,
        revCode: v.RevCode,
        poNo: null,
        code: "E-ENG-PO-MISSING",
        messageFa: `\u0645\u062F\u0631\u06A9 ${v.VendorDocNo} \u0628\u0647 \u0647\u06CC\u0686 \u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F\u06CC \u0627\u0631\u062C\u0627\u0639 \u0646\u062F\u0627\u0631\u062F`
      });
      continue;
    }
    if (known && !known.has(po)) {
      issues.push({
        vendorDocNo: v.VendorDocNo,
        revCode: v.RevCode,
        poNo: po,
        code: "E-ENG-PO-ORPHAN",
        messageFa: `\u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F ${po} \u062F\u0631 \u0645\u0627\u0698\u0648\u0644 \u0645\u0627\u0644\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F`
      });
      continue;
    }
    linked++;
  }
  return {
    total: input.vendorDocs.length,
    linked,
    missing: issues.filter((i) => i.code === "E-ENG-PO-MISSING").length,
    orphan: issues.filter((i) => i.code === "E-ENG-PO-ORPHAN").length,
    issues
  };
}
function planRocBackfill(input) {
  const delById = new Map(input.deliverables.map((d) => [d.Id, d]));
  const linkByActivity = new Map(input.activityDocLinks.map((l) => [l.activityId, l.deliverableId]));
  const revsByDel = /* @__PURE__ */ new Map();
  for (const r of input.revisions) {
    const arr = revsByDel.get(r.DeliverableId) ?? [];
    arr.push(r);
    revsByDel.set(r.DeliverableId, arr);
  }
  const rows = [];
  let alreadySet = 0;
  let unlinked = 0;
  for (const a of input.activities) {
    const delId = linkByActivity.get(a.Id);
    if (!delId) {
      unlinked++;
      continue;
    }
    const current = a.RocCode ?? null;
    if (current) {
      alreadySet++;
      continue;
    }
    const d = delById.get(delId);
    const prog = deliverableProgress(revsByDel.get(delId) ?? []);
    rows.push({
      activityId: a.Id,
      code: a.Code ?? null,
      deliverableId: delId,
      docNo: d?.DocNo ?? delId,
      currentRocCode: null,
      /* بالاترین پلهٔ رسیدهٔ مدرک، کد پیشنهادی فعالیت وابسته است. */
      suggestedRocCode: prog.step,
      reachedPct: prog.pct
    });
  }
  return { rows, alreadySet, unlinked };
}
var DEFAULT_LEAD_TIME_DAYS = {
  process: 90,
  mechanical: 120,
  piping: 90,
  civil: 45,
  structural: 60,
  electrical: 105,
  instrument: 120
};
var DEFAULT_PROCUREMENT_BUFFER_DAYS = 14;
function procurementReleaseDate(needBy, leadTimeDays, bufferDays = DEFAULT_PROCUREMENT_BUFFER_DAYS) {
  return addDays(needBy, -(leadTimeDays + bufferDays)) ?? needBy;
}
function planMaterialRequests(input) {
  const requireDoc = input.requireDocument !== false;
  const leadTimes = { ...DEFAULT_LEAD_TIME_DAYS, ...input.leadTimeByDiscipline ?? {} };
  const buffer = input.bufferDays ?? DEFAULT_PROCUREMENT_BUFFER_DAYS;
  const existing = new Set((input.existingRequests ?? []).map((m) => m.Code));
  const ifcByDel = new Set(
    input.revisions.filter((r) => r.Purpose === "IFC" && (!requireDoc || !!r.DocumentId)).map((r) => r.DeliverableId)
  );
  const startByDel = /* @__PURE__ */ new Map();
  const actById = new Map((input.activities ?? []).map((a) => [a.Id, a]));
  for (const link of input.activityDocLinks ?? []) {
    const a = actById.get(link.activityId);
    const start = a?.PlannedStart;
    if (!start) continue;
    const cur = startByDel.get(link.deliverableId);
    if (!cur || start < cur) startByDel.set(link.deliverableId, start);
  }
  const drafts = [];
  const skippedNotIfc = [];
  const skippedExisting = [];
  const skippedNoActivity = [];
  for (const d of input.deliverables) {
    if (!ifcByDel.has(d.Id)) {
      skippedNotIfc.push(d.DocNo);
      continue;
    }
    const code = `MR-${d.DocNo}`;
    if (existing.has(code)) {
      skippedExisting.push(d.DocNo);
      continue;
    }
    const needBy = startByDel.get(d.Id) ?? null;
    if (!needBy) {
      skippedNoActivity.push(d.DocNo);
      continue;
    }
    const lead = leadTimes[d.Discipline] ?? 60;
    drafts.push({
      code,
      deliverableId: d.Id,
      docNo: d.DocNo,
      titleFa: `\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u06A9\u0627\u0644\u0627 \u0628\u0631 \u067E\u0627\u06CC\u0647\u0654 \u0645\u062F\u0631\u06A9 ${d.DocNo} \u2014 ${d.TitleFa}`,
      discipline: d.Discipline,
      leadTimeDays: lead,
      needByDate: needBy,
      releaseByDate: procurementReleaseDate(needBy, lead, buffer),
      raisedAt: needBy,
      reasonFa: `\u0645\u062F\u0631\u06A9 \u0628\u0647 IFC \u0631\u0633\u06CC\u062F\u0647\u061B \u0645\u0647\u0644\u062A \u062A\u062F\u0627\u0631\u06A9 ${lead} \u0631\u0648\u0632 \u0648 \u062D\u0627\u0634\u06CC\u0647\u0654 ${buffer} \u0631\u0648\u0632`
    });
  }
  drafts.sort((a, b) => String(a.releaseByDate).localeCompare(String(b.releaseByDate)));
  return { drafts, skippedNotIfc, skippedExisting, skippedNoActivity };
}
function procurementAlerts(input) {
  const warn = input.warnDays ?? 14;
  const today = dayNumber(input.asOf);
  if (Number.isNaN(today)) return [];
  const out = [];
  for (const m of input.requests) {
    if (m.Status === "ordered" || m.Status === "closed" || m.Status === "cancelled") continue;
    if (m.LinkedPrCode) continue;
    if (!m.ReleaseByDate) continue;
    const rel = dayNumber(m.ReleaseByDate);
    if (Number.isNaN(rel)) continue;
    const slack = rel - today;
    if (slack > warn) continue;
    const severity = slack < 0 ? "critical" : slack <= 7 ? "high" : "medium";
    out.push({
      code: "EWS-ENG-06",
      mrCode: m.Code,
      docNo: m.DocNo ?? m.Code,
      discipline: m.Discipline,
      releaseByDate: m.ReleaseByDate,
      needByDate: m.NeedByDate ?? null,
      slackDays: slack,
      severity,
      titleFa: slack < 0 ? "\u067E\u0646\u062C\u0631\u0647\u0654 \u0633\u0641\u0627\u0631\u0634 \u06A9\u0627\u0644\u0627 \u0628\u0633\u062A\u0647 \u0634\u062F" : "\u067E\u0646\u062C\u0631\u0647\u0654 \u0633\u0641\u0627\u0631\u0634 \u06A9\u0627\u0644\u0627 \u0631\u0648 \u0628\u0647 \u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646",
      detailFa: slack < 0 ? `\u062F\u0631\u062E\u0648\u0627\u0633\u062A ${m.Code} \u0628\u0627\u06CC\u062F \u062A\u0627 ${m.ReleaseByDate} \u0633\u0641\u0627\u0631\u0634 \u0645\u06CC\u200C\u0634\u062F\u061B ${Math.abs(slack)} \u0631\u0648\u0632 \u06AF\u0630\u0634\u062A\u0647 \u0648 \u062A\u0623\u062E\u06CC\u0631 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0628\u0647 \u06A9\u0627\u0631\u06AF\u0627\u0647 \u0645\u0646\u062A\u0642\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F` : `\u062F\u0631\u062E\u0648\u0627\u0633\u062A ${m.Code} \u062A\u0627 ${m.ReleaseByDate} \u0641\u0631\u0635\u062A \u0633\u0641\u0627\u0631\u0634 \u062F\u0627\u0631\u062F (${slack} \u0631\u0648\u0632)`
    });
  }
  return out.sort((a, b) => a.slackDays - b.slackDays);
}
function planPurchaseRequisitions(input) {
  const existing = new Set(input.existingPrCodes ?? []);
  const estimates = input.estimates ?? {};
  const accounts = input.costAccountByDiscipline ?? {};
  const remaining = input.budgetRemaining ?? {};
  const drafts = [];
  const skippedLinked = [];
  const skippedDraft = [];
  const overBudget = [];
  for (const m of input.requests) {
    if (m.LinkedPrCode) {
      skippedLinked.push(m.Code);
      continue;
    }
    if (m.Status !== "approved" && m.Status !== "released") {
      skippedDraft.push(m.Code);
      continue;
    }
    const code = `PR-${m.Code}`;
    if (existing.has(code)) continue;
    const amount = estimates[m.Code] ?? null;
    const account = accounts[m.Discipline] ?? null;
    let budgetStatus = "unknown";
    if (amount !== null && account && account in remaining) {
      budgetStatus = amount <= remaining[account] ? "ok" : "over_budget";
      if (budgetStatus === "over_budget") overBudget.push(code);
    }
    drafts.push({
      code,
      mrCode: m.Code,
      titleFa: m.TitleFa,
      discipline: m.Discipline,
      requestedAt: m.RaisedAt,
      needByDate: m.NeedByDate ?? null,
      estimatedAmount: amount,
      costAccountCode: account,
      budgetStatus,
      reasonFa: budgetStatus === "over_budget" ? "\u0628\u0631\u0622\u0648\u0631\u062F \u0627\u0632 \u0628\u0627\u0642\u06CC\u0645\u0627\u0646\u062F\u0647\u0654 \u0628\u0648\u062F\u062C\u0647 \u0628\u06CC\u0634\u062A\u0631 \u0627\u0633\u062A\u061B \u062A\u0635\u0645\u06CC\u0645 \u0628\u0627 \u0645\u0627\u0644\u06CC \u0627\u0633\u062A" : budgetStatus === "unknown" ? "\u0628\u0631\u0622\u0648\u0631\u062F \u0642\u06CC\u0645\u062A \u06CC\u0627 \u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A\u061B \u06A9\u0646\u062A\u0631\u0644 \u0628\u0648\u062F\u062C\u0647 \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F" : "\u06A9\u0646\u062A\u0631\u0644 \u0628\u0648\u062F\u062C\u0647\u0654 \u0627\u0648\u0644\u06CC\u0647 \u0628\u062F\u0648\u0646 \u0627\u06CC\u0631\u0627\u062F"
    });
  }
  return { drafts, skippedLinked, skippedDraft, overBudget };
}
function poRegistry(orders) {
  return orders.map((o) => String(o.PoNo).trim()).filter(Boolean);
}
export {
  DEFAULT_CONTRACT_REVIEW_DAYS,
  DEFAULT_LEAD_TIME_DAYS,
  DEFAULT_PROCUREMENT_BUFFER_DAYS,
  DISCIPLINES,
  DISCIPLINE_FA,
  DOC_TYPE_FA,
  ENG_DOMAIN_ID,
  ENG_KPI_TARGETS,
  ENG_REPORT_CATALOG,
  ENG_VERSION,
  PURPOSE_FA,
  REVIEW_CODE_FA,
  ROC_STEPS,
  TQ_KIND_FA,
  addDays,
  asBuiltStatus,
  auditVendorPoRefs,
  buildCrsReport,
  buildEngReport,
  buildExecutiveReport,
  buildIdcReport,
  buildMdrStatusReport,
  buildProgressReport,
  buildTqFcrReport,
  buildTransmittalReport,
  buildVprReport,
  clashSummary,
  crsGate,
  crsSummary,
  dayNumber,
  daysBetween,
  deliverableProgress,
  distributeWeights,
  engKpiSnapshots,
  engProgressSnapshots,
  engReportMeta,
  engineeringAlerts,
  engineeringKpis,
  engineeringOverview,
  engineeringProgress,
  eotSeverity,
  getEngReport,
  hasCommercialImpact,
  idcStatus,
  ifcLockCoverage,
  isApprovingCode,
  isAudienceAllowed,
  isRejectingCode,
  periodCodeOf,
  planChangeRequests,
  planDesignNcrActions,
  planEotClaims,
  planIfcLocks,
  planMaterialRequests,
  planPurchaseRequisitions,
  planRocBackfill,
  poRegistry,
  procurementAlerts,
  procurementReleaseDate,
  rejectionCycles,
  reviewAging,
  reviewDaysFor,
  reviewDueDate,
  rocPct,
  tqAging,
  validateMdr,
  vprSummary
};
