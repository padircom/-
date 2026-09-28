// src/services/rcc.ts
var PLAN_THRESHOLDS = { low: 8, med: 12, high: 16 };
var RBS = [
  { code: "EXT", fa: "\u062E\u0627\u0631\u062C\u06CC", en: "External" },
  { code: "ORG", fa: "\u0633\u0627\u0632\u0645\u0627\u0646\u06CC", en: "Organizational" },
  { code: "PM", fa: "\u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0631\u0648\u0698\u0647", en: "PM" },
  { code: "TEC", fa: "\u0641\u0646\u06CC", en: "Technical" },
  { code: "PRC", fa: "\u062A\u062F\u0627\u0631\u06A9\u0627\u062A", en: "Procurement" },
  { code: "CON", fa: "\u0633\u0627\u062E\u062A", en: "Construction" },
  { code: "COM", fa: "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC", en: "Commissioning" }
];
function scoreLevel(score) {
  if (score >= PLAN_THRESHOLDS.high) return "high";
  if (score >= PLAN_THRESHOLDS.med) return "med";
  return "low";
}
function scoreColor(score) {
  const l = scoreLevel(score);
  return l === "high" ? "#EF4444" : l === "med" ? "#F59E0B" : "#10B981";
}
function daysLeft(dueIso, now = /* @__PURE__ */ new Date()) {
  const due = /* @__PURE__ */ new Date(dueIso + "T12:00:00Z");
  return Math.floor((due.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 864e5);
}
function guardianTick(notices, now = /* @__PURE__ */ new Date()) {
  const out = [];
  for (const n of notices) {
    if (n.deliveredAt) continue;
    const left = daysLeft(n.dueAt, now);
    if (n.timeBarred || left < 0) {
      out.push({ noticeId: n.id, daysLeft: left, action: "mark_time_barred", ews: "EWS-CLM-05", severity: "emergency" });
    } else if (left < 1) {
      out.push({ noticeId: n.id, daysLeft: left, action: "auto_escalate", ews: "EWS-CLM-02", severity: "emergency" });
    } else if (left <= 3) {
      out.push({ noticeId: n.id, daysLeft: left, action: "warn", ews: "EWS-CLM-01", severity: "critical" });
    } else if (left <= 14) {
      out.push({ noticeId: n.id, daysLeft: left, action: "warn", ews: "EWS-CLM-00", severity: left <= 7 ? "warn" : "info" });
    }
  }
  return out;
}
function seedNotices() {
  const t = Date.now();
  const iso = (offset) => {
    const d = new Date(t + offset * 864e5);
    return d.toISOString().slice(0, 10);
  };
  return [
    { id: "n1", claimId: "CLM-01", title: "EOT Long Lead", clause: "FIDIC 20.1 / Art.29", dueAt: iso(12), bodyFa: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u0627\u0648\u0644\u06CC\u0647" },
    { id: "n2", claimId: "CLM-02", title: "Access delay", clause: "Art.30", dueAt: iso(2) },
    { id: "n3", claimId: "CLM-03", title: "Weather window", clause: "Particular", dueAt: iso(-1) }
  ];
}
function depletionAlert(progressPct, opening, balance) {
  if (opening <= 0) return false;
  const usedPct = (1 - balance / opening) * 100;
  return usedPct - progressPct > 10;
}
var IMPACT_DIMS = [
  "Scope",
  "Schedule",
  "Cost",
  "Quality",
  "Risk",
  "Resource",
  "HSE",
  "Contract",
  "Interface",
  "Commissioning",
  "Stakeholder",
  "Environment"
];
function impactReady(flags) {
  return IMPACT_DIMS.every((d) => flags[d]);
}
var DELAY_METHODS = [
  { code: "tia", fa: "TIA", en: "Time Impact Analysis" },
  { code: "win", fa: "Windows", en: "Windows" },
  { code: "apab", fa: "\u0628\u0631\u0646\u0627\u0645\u0647 \u062F\u0631 \u0628\u0631\u0627\u0628\u0631 \u0633\u0627\u062E\u062A", en: "As-Planned vs As-Built" },
  { code: "ia", fa: "\u062A\u0623\u062B\u06CC\u0631\u0634\u062F\u0647 \u062F\u0631 \u0628\u0631\u0627\u0628\u0631 \u0633\u0627\u062E\u062A", en: "Impacted As-Planned" },
  { code: "cab", fa: "\u0641\u0631\u0648\u067E\u0627\u0634\u06CC \u0633\u0627\u062E\u062A", en: "Collapsed As-Built" },
  { code: "tbu", fa: "\u0627\u0632 \u067E\u0627\u06CC\u06CC\u0646", en: "Time in the Bottom-Up" },
  { code: "net", fa: "\u0634\u0628\u06A9\u0647", en: "Net effect" },
  { code: "5090", fa: "\u0646\u0634\u0631\u06CC\u0647 \u06F5\u06F0\u06F9\u06F0", en: "Pub. 5090" }
];
function quantumDays(tfZeroCount, sampleDays = 12) {
  return tfZeroCount * sampleDays;
}
function ccbCeiling(role) {
  if (role === "PM") return { cost: 5e4, days: 7, emergency: false };
  if (role === "PMO") return { cost: 25e4, days: 21, emergency: false };
  return { cost: Infinity, days: Infinity, emergency: true };
}
function ccbEscalate(role, cost, days, emergency) {
  const c = ccbCeiling(role);
  return cost > c.cost || days > c.days || emergency && !c.emergency;
}
function execPack(input) {
  return {
    chain: ["Risk", "Issue", "CR", "Claim", "Evidence"],
    counts: input,
    formulaNote: "SPI/PHI read-only"
  };
}
function parseRiskCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const rows = [];
  for (const line of lines.slice(1)) {
    const p = line.split(",").map((c) => c.trim());
    if (p.length < 6) continue;
    const P = Number(p[5]);
    const I = Number(p[6] ?? p[5]);
    if (P < 1 || P > 5 || I < 1 || I > 5) continue;
    rows.push({
      code: p[0],
      title: p[1],
      cause: p[2],
      event: p[3],
      effect: p[4],
      probability: P,
      impact: I,
      owner: p[7] || "",
      rbs: p[8] || "PM"
    });
  }
  return rows;
}
export {
  DELAY_METHODS,
  IMPACT_DIMS,
  PLAN_THRESHOLDS,
  RBS,
  ccbCeiling,
  ccbEscalate,
  daysLeft,
  depletionAlert,
  execPack,
  guardianTick,
  impactReady,
  parseRiskCsv,
  quantumDays,
  scoreColor,
  scoreLevel,
  seedNotices
};
