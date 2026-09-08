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

/* ── ثبت و اعتبارسنجی (D3 · آینه hse.ts) ───────────────────────── */

const INCIDENT_TYPES = ["near_miss", "first_aid", "medical", "lost_time", "fatality", "spill", "property"];

function isDateISO(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !Number.isNaN(new Date((s || "") + "T00:00:00Z").getTime());
}

export function validateIncident(d) {
  const e = [];
  if (!isDateISO(d.dateISO)) e.push("DATE_INVALID");
  if (!INCIDENT_TYPES.includes(d.type)) e.push("TYPE_UNKNOWN");
  if (d.lostDays != null && (!Number.isInteger(d.lostDays) || d.lostDays < 0)) e.push("LOSTDAYS_INVALID");
  if (!String(d.area || "").trim()) e.push("AREA_REQUIRED");
  if (!String(d.descFa || "").trim()) e.push("DESC_REQUIRED");
  if (d.status != null && !["open", "investigating", "closed"].includes(d.status)) e.push("STATUS_UNKNOWN");
  if (d.type === "spill" && !(Number(d.volumeL) > 0)) e.push("VOLUME_REQUIRED");
  if (d.code != null && !String(d.code).trim()) e.push("CODE_EMPTY");
  return e;
}

const PTW_TYPES = ["hot", "cold", "confined", "electrical", "height", "excavation", "radiation"];

export function validatePermit(d) {
  const e = [];
  if (!PTW_TYPES.includes(d.type)) e.push("TYPE_UNKNOWN");
  if (!isDateISO(d.workDate)) e.push("DATE_INVALID");
  if (!String(d.area || "").trim()) e.push("AREA_REQUIRED");
  if (!["low", "medium", "high"].includes(d.riskLevel)) e.push("RISK_UNKNOWN");
  if (d.no != null && !String(d.no).trim()) e.push("NO_EMPTY");
  return e;
}

export function validateInspection(d) {
  const e = [];
  if (!String(d.area || "").trim()) e.push("AREA_REQUIRED");
  if (!isDateISO(d.dateISO)) e.push("DATE_INVALID");
  if (!Array.isArray(d.items) || d.items.length === 0) e.push("ITEMS_REQUIRED");
  else if (d.items.length > 100) e.push("ITEMS_TOO_MANY");
  else d.items.forEach((it, i) => {
    if (!String(it.item || "").trim()) e.push(`I${i + 1}:ITEM_TEXT_REQUIRED`);
  });
  return e;
}

export const HIGH_RISK_PTW = ["hot", "confined", "electrical", "height", "excavation", "radiation"];

export function woPermitGate(req, permits, mode = "advisory") {
  if (!HIGH_RISK_PTW.includes(req.workType)) return { ok: true, verdict: "allow", reason: "NO_PERMIT_NEEDED" };
  const list = permits || [];
  const match = list.find((p) => p.type === req.workType && p.status === "active" && p.workDate === req.workDate && (!req.area || p.area === req.area));
  if (match) return { ok: true, verdict: "allow", reason: "ACTIVE_PTW", permitNo: match.no };
  const pending = list.filter((p) => p.type === req.workType && (p.status === "requested" || p.status === "approved")).map((p) => p.no);
  if (mode === "hard") return { ok: false, verdict: "block", reason: "NO_ACTIVE_PTW", pending };
  return { ok: true, verdict: "warn", reason: "NO_ACTIVE_PTW", pending };
}

export function nextInspectionDue(dateISO, band) {
  const add = band === "A" ? 90 : band === "B" ? 30 : band === "C" ? 14 : 7;
  return new Date(new Date(dateISO + "T00:00:00Z").getTime() + add * 86400000).toISOString().slice(0, 10);
}
