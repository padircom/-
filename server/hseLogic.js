/**
 * HSE engine (server mirror of src/services/hse.ts).
 * Pure logic, no I/O. Same names and behavior as the single source.
 */

export function isRecordable(t) {
  return t === "medical" || t === "lost_time" || t === "fatality";
}

export function isLostTime(t) {
  return t === "lost_time" || t === "fatality";
}

export function trir(incidents, manHours, factor = 200000) {
  if (!(manHours > 0)) return 0;
  const n = (incidents || []).filter((i) => isRecordable(i.type)).length;
  return +((n * factor) / manHours).toFixed(2);
}

export function ltifr(incidents, manHours, factor = 200000) {
  if (!(manHours > 0)) return 0;
  const n = (incidents || []).filter((i) => isLostTime(i.type)).length;
  return +((n * factor) / manHours).toFixed(2);
}

export function severityWeight(t) {
  switch (t) {
    case "fatality": return 100;
    case "lost_time": return 10;
    case "medical": return 5;
    case "spill": return 3;
    case "property": return 2;
    case "first_aid": return 1;
    case "near_miss": return 0.2;
    default: return 0;
  }
}

export const PTW_TRANSITIONS = {
  request: { from: ["draft"], to: "requested", roles: ["requester", "supervisor", "admin"] },
  approve: { from: ["requested"], to: "approved", roles: ["area_authority", "hse_officer", "admin"] },
  activate: { from: ["approved"], to: "active", roles: ["performing_authority", "admin"] },
  suspend: { from: ["active"], to: "suspended", roles: ["hse_officer", "area_authority", "performing_authority", "admin"] },
  resume: { from: ["suspended"], to: "active", roles: ["area_authority", "hse_officer", "admin"] },
  close: { from: ["active", "suspended"], to: "closed", roles: ["performing_authority", "hse_officer", "admin"] },
  expire: { from: ["approved", "active"], to: "expired", roles: ["system", "admin"] },
};

export function ptwCanTransition(from, action, role) {
  const tr = PTW_TRANSITIONS[action];
  if (!tr) return { ok: false, code: "INVALID_ACTION" };
  if (!tr.roles.includes(role)) return { ok: false, code: "ROLE_NOT_ALLOWED" };
  if (!tr.from.includes(from)) return { ok: false, code: "INVALID_TRANSITION" };
  return { ok: true, to: tr.to };
}

export function ptwMissing(type, flags = {}) {
  const need = {
    hot: ["gasTest", "barricade"],
    cold: [],
    confined: ["gasTest", "rescuePlan"],
    electrical: ["isolation"],
    height: ["barricade"],
    excavation: ["barricade"],
    radiation: ["barricade"],
  };
  return (need[type] || []).filter((k) => !flags[k]);
}

export function inspectionScore(items) {
  const eff = (items || []).filter((i) => !i.na);
  if (!eff.length) return 0;
  return Math.round((eff.filter((i) => i.ok).length / eff.length) * 100);
}

export function inspectionBand(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

function dayDiff(fromISO, toISO) {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.floor((b - a) / 86400000);
}

export function actionSla(a, nowISO) {
  if (a.closedAt) return "closed";
  const left = dayDiff(nowISO, a.dueISO);
  if (left < 0) return "overdue";
  if (left <= 3) return "due_soon";
  return "ok";
}

export function actionEscalation(a, nowISO) {
  if (a.closedAt) return "L0";
  const overdue = Math.max(0, -dayDiff(nowISO, a.dueISO));
  if (a.severity === "critical" && overdue > 7) return "L3";
  if ((a.severity === "critical" || a.severity === "high") && overdue > 3) return "L2";
  if (overdue > 0 || (a.severity === "critical" && dayDiff(nowISO, a.dueISO) <= 3)) return "L1";
  return "L0";
}

export function tbtCompliance(planned, held) {
  if (!(planned > 0)) return 0;
  return +Math.max(0, Math.min(1, held / planned)).toFixed(3);
}

export function spillTier(volumeL) {
  if (volumeL >= 200) return "T3";
  if (volumeL >= 20) return "T2";
  return "T1";
}

export function recycleRate(recycledKg, totalKg) {
  if (!(totalKg > 0)) return 0;
  return +Math.max(0, Math.min(1, recycledKg / totalKg)).toFixed(3);
}

export function hseScore(x) {
  const incident = Math.max(0, 100 - x.trir * 25);
  const total = Math.round(0.35 * incident + 0.25 * x.ptwCompliance * 100 + 0.2 * x.inspectionAvg + 0.2 * x.actionClosure * 100);
  const band = total >= 85 ? "Green" : total >= 65 ? "Yellow" : "Red";
  return { total, band };
}
