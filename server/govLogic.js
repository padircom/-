/** GOV governance engine — SLA/escalation, CAPA, DoA, decision gate, trail. No writes to owned figures. */

export function daysLeft(dueIso, now = new Date()) {
  const due = new Date(dueIso + "T12:00:00Z");
  return Math.floor(
    (due.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000
  );
}

export function hoursSince(iso, now = new Date()) {
  const t0 = new Date(iso.replace(" ", "T") + (iso.length <= 10 ? "T00:00:00Z" : "Z")).getTime();
  return Math.max(0, Math.floor((now.getTime() - t0) / 3600000));
}

export function slaLevel(left) {
  if (left < 0) return "breach";
  if (left <= 1) return "due_soon";
  return "ok";
}

export function escalationLevel(daysOverdue) {
  if (daysOverdue <= 0) return "L0";
  if (daysOverdue <= 3) return "L1";
  if (daysOverdue <= 7) return "L2";
  return "L3";
}

export function workflowTick(tasks, now = new Date()) {
  const out = [];
  for (const task of tasks) {
    if (task.closedAt) continue;
    const left = daysLeft(task.dueAt, now);
    const level = slaLevel(left);
    out.push({
      taskId: task.id,
      daysLeft: left,
      level,
      escalation: escalationLevel(left < 0 ? -left : 0),
      action: level === "breach" ? "escalate" : level === "due_soon" ? "notify" : "none",
    });
  }
  return out;
}

export function complianceBand(score) {
  if (score >= 90) return "Green";
  if (score >= 75) return "Yellow";
  return "Red";
}

export function complianceScore(findings) {
  if (findings.length === 0) return 100;
  const wSum = findings.reduce((s, f) => s + (f.weight ?? 1), 0);
  const acc = findings.reduce((s, f) => s + f.compliance * (f.weight ?? 1), 0);
  return Math.round(acc / wSum);
}

export function capaRequired(f) {
  const sev = f.severity ?? (f.compliance < 75 ? "major" : "minor");
  return (sev === "major" || sev === "critical") && !f.capaId;
}

export function auditCloseBlocked(findings) {
  return findings.some(capaRequired);
}

export const DOA = {
  PM: { cost: 50_000, days: 7 },
  PMO: { cost: 250_000, days: 21 },
  STEERING: { cost: 1_000_000, days: 60 },
  BOARD: { cost: Infinity, days: Infinity },
};

const DOA_ORDER = ["PM", "PMO", "STEERING", "BOARD"];

export function authorityFor(cost, days) {
  for (const a of DOA_ORDER) {
    if (cost <= DOA[a].cost && days <= DOA[a].days) return a;
  }
  return "BOARD";
}

export function needsEscalation(current, cost, days) {
  return DOA_ORDER.indexOf(authorityFor(cost, days)) > DOA_ORDER.indexOf(current);
}

export function decisionGate(d) {
  const reasons = [];
  if (!d.evidenceRef) reasons.push("evidence_missing");
  if (!d.authority) reasons.push("authority_missing");
  if (d.authority && needsEscalation(d.authority, d.cost ?? 0, d.days ?? 0)) reasons.push("authority_insufficient");
  if (d.rewritesBaseline && !d.crId) reasons.push("baseline_rewrite_without_cr");
  return { ok: reasons.length === 0, reasons };
}

export function connectorHealth(lastSyncIso, slaHours = 24, now = new Date()) {
  const h = hoursSince(lastSyncIso, now);
  if (h <= slaHours) return "ok";
  if (h <= slaHours * 2) return "warn";
  return "fail";
}

export const DATA_OWNER = {
  progress: "d2",
  baseline: "d2",
  evm: "d3",
  kpi: "d3",
  variance: "d3",
  risk: "d4",
  claim: "d4",
  cost: "d5",
  document: "d1",
};

export function canGovWrite(field) {
  return !(field in DATA_OWNER);
}

export function hashLink(prev, payload) {
  let h = 0x811c9dc5;
  const s = prev + "|" + payload;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function appendTrail(trail, payload) {
  const prev = trail.length ? trail[trail.length - 1].hash : "00000000";
  return [...trail, { seq: trail.length + 1, payload, hash: hashLink(prev, payload) }];
}

export function verifyTrail(trail) {
  let prev = "00000000";
  for (const e of trail) {
    if (hashLink(prev, e.payload) !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}
