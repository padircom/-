// src/services/hseField.ts
function isRecordable(t) {
  return t === "medical" || t === "lost_time" || t === "fatality";
}
function isLostTime(t) {
  return t === "lost_time" || t === "fatality";
}
function trir(incidents, manHours, factor = 2e5) {
  if (!(manHours > 0)) return 0;
  const n = incidents.filter((i) => isRecordable(i.type)).length;
  return +(n * factor / manHours).toFixed(2);
}
function ltifr(incidents, manHours, factor = 2e5) {
  if (!(manHours > 0)) return 0;
  const n = incidents.filter((i) => isLostTime(i.type)).length;
  return +(n * factor / manHours).toFixed(2);
}
function severityWeight(t) {
  switch (t) {
    case "fatality":
      return 100;
    case "lost_time":
      return 10;
    case "medical":
      return 5;
    case "spill":
      return 3;
    case "property":
      return 2;
    case "first_aid":
      return 1;
    case "near_miss":
      return 0.2;
  }
}
var PTW_TRANSITIONS = {
  request: { from: ["draft"], to: "requested", roles: ["requester", "supervisor", "admin"] },
  approve: { from: ["requested"], to: "approved", roles: ["area_authority", "hse_officer", "admin"] },
  activate: { from: ["approved"], to: "active", roles: ["performing_authority", "admin"] },
  suspend: { from: ["active"], to: "suspended", roles: ["hse_officer", "area_authority", "performing_authority", "admin"] },
  resume: { from: ["suspended"], to: "active", roles: ["area_authority", "hse_officer", "admin"] },
  close: { from: ["active", "suspended"], to: "closed", roles: ["performing_authority", "hse_officer", "admin"] },
  expire: { from: ["approved", "active"], to: "expired", roles: ["system", "admin"] }
};
function ptwCanTransition(from, action, role) {
  const tr = PTW_TRANSITIONS[action];
  if (!tr) return { ok: false, code: "INVALID_ACTION" };
  if (!tr.roles.includes(role)) return { ok: false, code: "ROLE_NOT_ALLOWED" };
  if (!tr.from.includes(from)) return { ok: false, code: "INVALID_TRANSITION" };
  return { ok: true, to: tr.to };
}
function ptwMissing(type, flags) {
  const need = {
    hot: ["gasTest", "barricade"],
    cold: [],
    confined: ["gasTest", "rescuePlan"],
    electrical: ["isolation"],
    height: ["barricade"],
    excavation: ["barricade"],
    radiation: ["barricade"]
  };
  return (need[type] ?? []).filter((k) => !flags[k]);
}
function inspectionScore(items) {
  const eff = items.filter((i) => !i.na);
  if (!eff.length) return 0;
  return Math.round(eff.filter((i) => i.ok).length / eff.length * 100);
}
function inspectionBand(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}
function dayDiff(fromISO, toISO) {
  const a = (/* @__PURE__ */ new Date(fromISO + "T00:00:00Z")).getTime();
  const b = (/* @__PURE__ */ new Date(toISO + "T00:00:00Z")).getTime();
  return Math.floor((b - a) / 864e5);
}
function actionSla(a, nowISO) {
  if (a.closedAt) return "closed";
  const left = dayDiff(nowISO, a.dueISO);
  if (left < 0) return "overdue";
  if (left <= 3) return "due_soon";
  return "ok";
}
function actionEscalation(a, nowISO) {
  if (a.closedAt) return "L0";
  const overdue = Math.max(0, -dayDiff(nowISO, a.dueISO));
  if (a.severity === "critical" && overdue > 7) return "L3";
  if ((a.severity === "critical" || a.severity === "high") && overdue > 3) return "L2";
  if (overdue > 0 || a.severity === "critical" && dayDiff(nowISO, a.dueISO) <= 3) return "L1";
  return "L0";
}
function tbtCompliance(planned, held) {
  if (!(planned > 0)) return 0;
  return +Math.max(0, Math.min(1, held / planned)).toFixed(3);
}
function spillTier(volumeL) {
  if (volumeL >= 200) return "T3";
  if (volumeL >= 20) return "T2";
  return "T1";
}
function recycleRate(recycledKg, totalKg) {
  if (!(totalKg > 0)) return 0;
  return +Math.max(0, Math.min(1, recycledKg / totalKg)).toFixed(3);
}
function hseScore(x) {
  const incident = Math.max(0, 100 - x.trir * 25);
  const total = Math.round(0.35 * incident + 0.25 * x.ptwCompliance * 100 + 0.2 * x.inspectionAvg + 0.2 * x.actionClosure * 100);
  const band = total >= 85 ? "Green" : total >= 65 ? "Yellow" : "Red";
  return { total, band };
}
var HSE_MANHOURS = [
  { period: "1405-04", hours: 176400 },
  { period: "1405-05", hours: 184e3 },
  { period: "1405-06", hours: 62100 }
];
function totalManHours(rows = HSE_MANHOURS) {
  return rows.reduce((s, r) => s + r.hours, 0);
}
var HSE_INCIDENTS = [
  { id: "i1", code: "INC-101", dateISO: "2026-08-02", type: "near_miss", lostDays: 0, area: "Piperack B", descFa: "\u0633\u0642\u0648\u0637 \u0627\u0628\u0632\u0627\u0631 \u0627\u0632 \u0627\u0631\u062A\u0641\u0627\u0639 (\u0628\u062F\u0648\u0646 \u0645\u0635\u062F\u0648\u0645)", status: "closed" },
  { id: "i2", code: "INC-102", dateISO: "2026-08-09", type: "first_aid", lostDays: 0, area: "FND", descFa: "\u0628\u0631\u06CC\u062F\u06AF\u06CC \u0633\u0637\u062D\u06CC \u062F\u0633\u062A", status: "closed" },
  { id: "i3", code: "INC-103", dateISO: "2026-08-17", type: "medical", lostDays: 0, area: "Spool yard", descFa: "\u062F\u0631\u0645\u0627\u0646 \u0633\u0631\u067E\u0627\u06CC\u06CC \u0686\u0634\u0645", status: "closed" },
  { id: "i4", code: "INC-104", dateISO: "2026-08-21", type: "spill", lostDays: 0, area: "Laydown", descFa: "\u0646\u0634\u062A \u06F1\u06F2 \u0644\u06CC\u062A\u0631\u06CC \u06AF\u0627\u0632\u0648\u0626\u06CC\u0644", status: "closed", volumeL: 12 },
  { id: "i5", code: "INC-105", dateISO: "2026-08-28", type: "near_miss", lostDays: 0, area: "MV trench", descFa: "\u0646\u0632\u062F\u06CC\u06A9\u200C\u0628\u0631\u062E\u0648\u0631\u062F \u0628\u0627 \u06A9\u0627\u0628\u0644 \u0645\u062F\u0641\u0648\u0646", status: "investigating" },
  { id: "i6", code: "INC-106", dateISO: "2026-09-01", type: "lost_time", lostDays: 4, area: "Piperack B", descFa: "\u067E\u06CC\u0686\u200C\u062E\u0648\u0631\u062F\u06AF\u06CC \u0645\u0686 \u062F\u0631 \u0646\u0635\u0628", status: "investigating" },
  { id: "i7", code: "INC-107", dateISO: "2026-09-03", type: "property", lostDays: 0, area: "Gate", descFa: "\u0628\u0631\u062E\u0648\u0631\u062F \u0644\u06CC\u0641\u062A\u0631\u0627\u06A9 \u0628\u0627 \u06AF\u0627\u0631\u062F", status: "open" },
  { id: "i8", code: "INC-108", dateISO: "2026-09-05", type: "first_aid", lostDays: 0, area: "FND", descFa: "\u06A9\u0645\u06A9\u200C\u0647\u0627\u06CC \u0627\u0648\u0644\u06CC\u0647 \u06AF\u0631\u0645\u0627\u0632\u062F\u06AF\u06CC", status: "open" }
];
var HSE_PTWS = [
  { id: "p1", no: "PTW-2201", type: "hot", status: "closed", workDate: "2026-08-28", area: "Spool yard", riskLevel: "high" },
  { id: "p2", no: "PTW-2202", type: "confined", status: "active", workDate: "2026-09-06", area: "Tank TK-01", riskLevel: "high" },
  { id: "p3", no: "PTW-2203", type: "electrical", status: "approved", workDate: "2026-09-08", area: "MCC room", riskLevel: "medium" },
  { id: "p4", no: "PTW-2204", type: "height", status: "requested", workDate: "2026-09-09", area: "Piperack B", riskLevel: "medium" },
  { id: "p5", no: "PTW-2205", type: "cold", status: "draft", workDate: "2026-09-10", area: "Laydown", riskLevel: "low" }
];
var HSE_INSPECTIONS = [
  { id: "n1", area: "Spool yard", dateISO: "2026-09-04", items: [
    { item: "\u06A9\u067E\u0633\u0648\u0644 \u062D\u0631\u06CC\u0642", ok: true },
    { item: "\u062F\u0627\u0631\u0628\u0633\u062A \u0628\u0631\u0686\u0633\u0628\u200C\u062F\u0627\u0631", ok: true },
    { item: "\u0633\u06CC\u0645 \u0627\u0631\u062A", ok: false },
    { item: "\u0646\u0638\u0645 \u06A9\u0627\u0631\u06AF\u0627\u0647", ok: true }
  ] },
  { id: "n2", area: "Piperack B", dateISO: "2026-09-05", items: [
    { item: "\u0647\u0627\u0631\u0646\u0633", ok: true },
    { item: "\u062A\u0648\u0631\u06CC \u0632\u06CC\u0631\u06A9\u0627\u0631", ok: true },
    { item: "\u0631\u0648\u0634\u0646\u0627\u06CC\u06CC", ok: true },
    { item: "\u0646\u0631\u062F\u0628\u0627\u0646 \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F", ok: true }
  ] },
  { id: "n3", area: "Tank TK-01", dateISO: "2026-09-06", items: [
    { item: "\u06AF\u0627\u0632\u0633\u0646\u062C \u06A9\u0627\u0644\u06CC\u0628\u0631\u0647", ok: true },
    { item: "\u062A\u0647\u0648\u06CC\u0647", ok: false },
    { item: "\u0646\u06AF\u0647\u0628\u0627\u0646 \u062F\u0647\u0627\u0646\u0647", ok: true },
    { item: "\u0637\u0646\u0627\u0628 \u0646\u062C\u0627\u062A", ok: false }
  ] },
  { id: "n4", area: "MCC room", dateISO: "2026-09-07", items: [
    { item: "LOTO", ok: true },
    { item: "\u062F\u0633\u062A\u06A9\u0634 \u0639\u0627\u06CC\u0642", ok: true },
    { item: "\u06A9\u0641\u067E\u0648\u0634", ok: true }
  ] }
];
var HSE_ACTIONS = [
  { id: "a1", title: "\u0631\u0641\u0639 \u0646\u0642\u0635 \u0633\u06CC\u0645 \u0627\u0631\u062A \u0627\u0633\u067E\u0648\u0644\u200C\u06CC\u0627\u0631\u062F", dueISO: "2026-09-06", closedAt: "2026-09-05", severity: "medium" },
  { id: "a2", title: "\u062A\u0647\u0648\u06CC\u0647 \u0648 \u0637\u0646\u0627\u0628 \u0646\u062C\u0627\u062A TK-01", dueISO: "2026-09-09", closedAt: null, severity: "critical" },
  { id: "a3", title: "\u0628\u0631\u0686\u0633\u0628\u200C\u06AF\u0630\u0627\u0631\u06CC \u0645\u062C\u062F\u062F \u062F\u0627\u0631\u0628\u0633\u062A\u200C\u0647\u0627", dueISO: "2026-09-12", closedAt: null, severity: "low" },
  { id: "a4", title: "\u0622\u0645\u0648\u0632\u0634 \u0645\u062C\u062F\u062F LOTO \u0628\u0631\u0642", dueISO: "2026-09-04", closedAt: null, severity: "high" },
  { id: "a5", title: "\u062E\u0637\u200C\u06A9\u0634\u06CC \u0645\u0633\u06CC\u0631 \u0644\u06CC\u0641\u062A\u0631\u0627\u06A9 \u06AF\u06CC\u062A", dueISO: "2026-09-15", closedAt: null, severity: "medium" }
];
var HSE_TBT = { planned: 24, held: 21 };
var HSE_WASTE = { recycledKg: 1840, totalKg: 5200 };
var HSE_CHECKUP = { covered: 86, total: 112 };
var INCIDENT_TYPES = ["near_miss", "first_aid", "medical", "lost_time", "fatality", "spill", "property"];
function isDateISO(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !Number.isNaN((/* @__PURE__ */ new Date((s || "") + "T00:00:00Z")).getTime());
}
function validateIncident(d) {
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
var PTW_TYPES = ["hot", "cold", "confined", "electrical", "height", "excavation", "radiation"];
function validatePermit(d) {
  const e = [];
  if (!PTW_TYPES.includes(d.type)) e.push("TYPE_UNKNOWN");
  if (!isDateISO(d.workDate)) e.push("DATE_INVALID");
  if (!String(d.area || "").trim()) e.push("AREA_REQUIRED");
  if (!["low", "medium", "high"].includes(d.riskLevel)) e.push("RISK_UNKNOWN");
  if (d.no != null && !String(d.no).trim()) e.push("NO_EMPTY");
  return e;
}
function validateInspection(d) {
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
var HIGH_RISK_PTW = ["hot", "confined", "electrical", "height", "excavation", "radiation"];
function woPermitGate(req, permits, mode = "advisory") {
  if (!HIGH_RISK_PTW.includes(req.workType)) return { ok: true, verdict: "allow", reason: "NO_PERMIT_NEEDED" };
  const list = permits || [];
  const match = list.find((p) => p.type === req.workType && p.status === "active" && p.workDate === req.workDate && (!req.area || p.area === req.area));
  if (match) return { ok: true, verdict: "allow", reason: "ACTIVE_PTW", permitNo: match.no };
  const pending = list.filter((p) => p.type === req.workType && (p.status === "requested" || p.status === "approved")).map((p) => p.no);
  if (mode === "hard") return { ok: false, verdict: "block", reason: "NO_ACTIVE_PTW", pending };
  return { ok: true, verdict: "warn", reason: "NO_ACTIVE_PTW", pending };
}
function nextInspectionDue(dateISO, band) {
  const add = band === "A" ? 90 : band === "B" ? 30 : band === "C" ? 14 : 7;
  return new Date((/* @__PURE__ */ new Date(dateISO + "T00:00:00Z")).getTime() + add * 864e5).toISOString().slice(0, 10);
}
export {
  HIGH_RISK_PTW,
  HSE_ACTIONS,
  HSE_CHECKUP,
  HSE_INCIDENTS,
  HSE_INSPECTIONS,
  HSE_MANHOURS,
  HSE_PTWS,
  HSE_TBT,
  HSE_WASTE,
  PTW_TRANSITIONS,
  actionEscalation,
  actionSla,
  hseScore,
  inspectionBand,
  inspectionScore,
  isLostTime,
  isRecordable,
  ltifr,
  nextInspectionDue,
  ptwCanTransition,
  ptwMissing,
  recycleRate,
  severityWeight,
  spillTier,
  tbtCompliance,
  totalManHours,
  trir,
  validateIncident,
  validateInspection,
  validatePermit,
  woPermitGate
};
