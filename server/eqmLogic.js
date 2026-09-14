// src/services/equipment.ts
var EQM_VERSION = "eqm-v1";
var EQM_DOMAIN_ID = "d9";
var EQUIPMENT_CATEGORY_CATALOG = [
  // خاکبرداری
  { code: "EXC", fa: "\u0628\u06CC\u0644 \u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC", en: "Excavator", cls: "earthmoving", uom: "\u062A\u0646", economicLifeYears: 12, utilLowPct: 40, utilHighPct: 75 },
  { code: "LDR", fa: "\u0644\u0648\u062F\u0631", en: "Wheel Loader", cls: "earthmoving", uom: "\u0645\u062A\u0631\u0645\u06A9\u0639\u0628", economicLifeYears: 12, utilLowPct: 40, utilHighPct: 75 },
  { code: "BLD", fa: "\u0628\u0648\u0644\u062F\u0648\u0632\u0631", en: "Bulldozer", cls: "earthmoving", uom: "\u062A\u0646", economicLifeYears: 14, utilLowPct: 40, utilHighPct: 75 },
  { code: "GDR", fa: "\u06AF\u0631\u06CC\u062F\u0631", en: "Motor Grader", cls: "earthmoving", uom: "\u062A\u0646", economicLifeYears: 14, utilLowPct: 40, utilHighPct: 75 },
  { code: "RLR", fa: "\u063A\u0644\u062A\u06A9", en: "Compaction Roller", cls: "earthmoving", uom: "\u062A\u0646", economicLifeYears: 12, utilLowPct: 40, utilHighPct: 75 },
  { code: "BHO", fa: "\u0628\u06A9\u0647\u0648 \u0644\u0648\u062F\u0631", en: "Backhoe Loader", cls: "earthmoving", uom: "\u062A\u0646", economicLifeYears: 10, utilLowPct: 40, utilHighPct: 75 },
  // باربرداری
  { code: "CRN-TOW", fa: "\u062A\u0627\u0648\u0631 \u06A9\u0631\u06CC\u0646", en: "Tower Crane", cls: "lifting", uom: "\u062A\u0646", economicLifeYears: 18, utilLowPct: 50, utilHighPct: 85 },
  { code: "CRN-MOB", fa: "\u062C\u0631\u062B\u0642\u06CC\u0644 \u0645\u0648\u0628\u0627\u06CC\u0644", en: "Mobile Crane", cls: "lifting", uom: "\u062A\u0646", economicLifeYears: 16, utilLowPct: 45, utilHighPct: 80 },
  { code: "FLT", fa: "\u0644\u06CC\u0641\u062A\u0631\u0627\u06A9", en: "Forklift", cls: "lifting", uom: "\u062A\u0646", economicLifeYears: 12, utilLowPct: 45, utilHighPct: 80 },
  { code: "MNF", fa: "\u0645\u0646\u200C\u0644\u06CC\u0641\u062A", en: "Manlift / Boom Lift", cls: "lifting", uom: "\u0645\u062A\u0631", economicLifeYears: 10, utilLowPct: 45, utilHighPct: 80 },
  // حمل
  { code: "TRK", fa: "\u06A9\u0627\u0645\u06CC\u0648\u0646", en: "Dump Truck", cls: "transport", uom: "\u062A\u0646", economicLifeYears: 10, utilLowPct: 45, utilHighPct: 80 },
  // بتن
  { code: "MXR", fa: "\u0645\u06CC\u06A9\u0633\u0631 \u0628\u062A\u0646", en: "Concrete Mixer", cls: "concrete", uom: "\u0645\u062A\u0631\u0645\u06A9\u0639\u0628", economicLifeYears: 10, utilLowPct: 40, utilHighPct: 75 },
  { code: "PMP", fa: "\u067E\u0645\u067E \u0628\u062A\u0646", en: "Concrete Pump", cls: "concrete", uom: "\u0645\u062A\u0631\u0645\u06A9\u0639\u0628/\u0633\u0627\u0639\u062A", economicLifeYears: 10, utilLowPct: 40, utilHighPct: 75 },
  // توان و تاسیسات
  { code: "GEN", fa: "\u062F\u06CC\u0632\u0644 \u0698\u0646\u0631\u0627\u062A\u0648\u0631", en: "Diesel Generator", cls: "power", uom: "\u06A9\u06CC\u0644\u0648\u0648\u0644\u062A\u200C\u0622\u0645\u067E\u0631", economicLifeYears: 15, utilLowPct: 30, utilHighPct: 85 },
  { code: "CMP", fa: "\u06A9\u0645\u067E\u0631\u0633\u0648\u0631 \u0647\u0648\u0627", en: "Air Compressor", cls: "power", uom: "\u0645\u062A\u0631\u0645\u06A9\u0639\u0628/\u062F\u0642\u06CC\u0642\u0647", economicLifeYears: 12, utilLowPct: 35, utilHighPct: 80 },
  { code: "WLD", fa: "\u062F\u0633\u062A\u06AF\u0627\u0647 \u062C\u0648\u0634", en: "Welding Machine", cls: "power", uom: "\u0622\u0645\u067E\u0631", economicLifeYears: 10, utilLowPct: 40, utilHighPct: 80 },
  { code: "DRL", fa: "\u062F\u0633\u062A\u06AF\u0627\u0647 \u062D\u0641\u0627\u0631\u06CC", en: "Drilling Rig", cls: "other", uom: "\u0645\u062A\u0631", economicLifeYears: 15, utilLowPct: 40, utilHighPct: 75 },
  { code: "OTH", fa: "\u0633\u0627\u06CC\u0631 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A", en: "Other Equipment", cls: "other", economicLifeYears: 10, utilLowPct: 35, utilHighPct: 75 }
];
var CATEGORY_BY_CODE = Object.fromEntries(
  EQUIPMENT_CATEGORY_CATALOG.map((c) => [c.code, c])
);
var OWNERSHIPS = ["owned", "rented", "leased"];
var EQUIPMENT_STATUSES = ["active", "idle", "repair", "disposed"];
var RATE_TYPES = ["hourly", "daily", "monthly"];
var MAINTENANCE_KINDS = ["corrective", "preventive", "inspection", "overhaul"];
var MAINTENANCE_PRIORITIES = ["low", "medium", "high", "critical"];
var MAINTENANCE_STATUSES = ["open", "in_progress", "done", "closed"];
function round2(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
function daysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 864e5));
}
function hoursBetween(fromIso, toIso) {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, (b - a) / 36e5);
}
var REQUIRED = "E-EQM-REQUIRED";
function required(row, col, issues, label) {
  const v = row[col];
  if (v === void 0 || v === null || typeof v === "string" && !v.trim()) {
    issues.push({ code: REQUIRED, column: col, message: `${label} \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A` });
  }
}
function optionalNumber(v) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : void 0;
}
function validateEquipment(row) {
  const issues = [];
  required(row, "ProjectId", issues, "\u067E\u0631\u0648\u0698\u0647");
  required(row, "Code", issues, "\u06A9\u062F \u0634\u0646\u0627\u0633\u0647");
  required(row, "NameFa", issues, "\u0646\u0627\u0645");
  required(row, "Category", issues, "\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC");
  required(row, "Ownership", issues, "\u0646\u0648\u0639 \u0645\u0627\u0644\u06A9\u06CC\u062A");
  required(row, "Status", issues, "\u0648\u0636\u0639\u06CC\u062A");
  if (typeof row.Category === "string" && !CATEGORY_BY_CODE[row.Category]) {
    issues.push({ code: "E-EQM-CATEGORY", column: "Category", message: `\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647: ${row.Category}` });
  }
  if (typeof row.Ownership === "string" && !OWNERSHIPS.includes(row.Ownership)) {
    issues.push({ code: "E-EQM-OWNERSHIP", column: "Ownership", message: `\u0646\u0648\u0639 \u0645\u0627\u0644\u06A9\u06CC\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.Ownership}` });
  }
  if (typeof row.Status === "string" && !EQUIPMENT_STATUSES.includes(row.Status)) {
    issues.push({ code: "E-EQM-STATUS", column: "Status", message: `\u0648\u0636\u0639\u06CC\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.Status}` });
  }
  const year = optionalNumber(row.Year);
  const nowYear = (/* @__PURE__ */ new Date()).getFullYear();
  if (year !== void 0 && (year < 1900 || year > nowYear + 1)) {
    issues.push({ code: "E-EQM-YEAR", column: "Year", message: `\u0633\u0627\u0644 \u0633\u0627\u062E\u062A \u062E\u0627\u0631\u062C \u0627\u0632 \u0628\u0627\u0632\u0647\u0654 \u06F1\u06F9\u06F0\u06F0 \u062A\u0627 ${nowYear + 1}` });
  }
  const cap = optionalNumber(row.Capacity);
  if (cap !== void 0 && cap < 0) {
    issues.push({ code: "E-EQM-CAPACITY", column: "Capacity", message: "\u0638\u0631\u0641\u06CC\u062A \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F" });
  }
  if (optionalNumber(row.PurchaseValue) !== void 0 && optionalNumber(row.PurchaseValue) < 0) {
    issues.push({ code: "E-EQM-CAPACITY", column: "PurchaseValue", message: "\u0627\u0631\u0632\u0634 \u062E\u0631\u06CC\u062F \u0645\u0646\u0641\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  return { ok: issues.length === 0, issues };
}
function validateMeter(row, prevHourMeter) {
  const issues = [];
  required(row, "EquipmentId", issues, "\u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A");
  required(row, "ReadAt", issues, "\u062A\u0627\u0631\u06CC\u062E \u0642\u0631\u0627\u0626\u062A");
  required(row, "HourMeter", issues, "\u0633\u0627\u0639\u062A\u200C\u0634\u0645\u0627\u0631");
  const meter = optionalNumber(row.HourMeter);
  if (meter !== void 0 && meter < 0) {
    issues.push({ code: "E-EQM-METER", column: "HourMeter", message: "\u0633\u0627\u0639\u062A\u200C\u0634\u0645\u0627\u0631 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F" });
  }
  if (meter !== void 0 && prevHourMeter !== void 0 && meter < prevHourMeter) {
    issues.push({ code: "E-EQM-METER-ROLLBACK", column: "HourMeter", message: `\u0633\u0627\u0639\u062A\u200C\u0634\u0645\u0627\u0631 \u0639\u0642\u0628 \u0631\u0641\u062A\u0647: ${meter} < ${prevHourMeter}` });
  }
  const src = row.Source;
  if (src !== void 0 && src !== "manual" && src !== "telemetry") {
    issues.push({ code: "E-EQM-SOURCE", column: "Source", message: `\u0645\u0646\u0628\u0639 \u0642\u0631\u0627\u0626\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${src}` });
  }
  return { ok: issues.length === 0, issues };
}
function validateRental(row) {
  const issues = [];
  required(row, "EquipmentId", issues, "\u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A");
  required(row, "RateType", issues, "\u0646\u0648\u0639 \u0646\u0631\u062E");
  required(row, "Rate", issues, "\u0646\u0631\u062E");
  required(row, "StartDate", issues, "\u062A\u0627\u0631\u06CC\u062E \u0634\u0631\u0648\u0639");
  required(row, "Status", issues, "\u0648\u0636\u0639\u06CC\u062A \u0642\u0631\u0627\u0631\u062F\u0627\u062F");
  const rate = optionalNumber(row.Rate);
  if (rate !== void 0 && rate <= 0) {
    issues.push({ code: "E-EQM-RATE", column: "Rate", message: "\u0646\u0631\u062E \u0628\u0627\u06CC\u062F \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F" });
  }
  if (typeof row.RateType === "string" && !RATE_TYPES.includes(row.RateType)) {
    issues.push({ code: "E-EQM-RATE-TYPE", column: "RateType", message: `\u0646\u0648\u0639 \u0646\u0631\u062E \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.RateType}` });
  }
  const start = typeof row.StartDate === "string" ? row.StartDate : "";
  const end = typeof row.EndDate === "string" ? row.EndDate : "";
  if (start && end && Date.parse(end) < Date.parse(start)) {
    issues.push({ code: "E-EQM-DATE-RANGE", column: "EndDate", message: "\u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646 \u0632\u0648\u062F\u062A\u0631 \u0627\u0632 \u0634\u0631\u0648\u0639 \u0627\u0633\u062A" });
  }
  return { ok: issues.length === 0, issues };
}
function validateMaintenanceOrder(row) {
  const issues = [];
  required(row, "EquipmentId", issues, "\u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A");
  required(row, "Code", issues, "\u06A9\u062F \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631");
  required(row, "Kind", issues, "\u0646\u0648\u0639 \u062A\u0639\u0645\u06CC\u0631");
  required(row, "Priority", issues, "\u0627\u0648\u0644\u0648\u06CC\u062A");
  required(row, "ReportedAt", issues, "\u062A\u0627\u0631\u06CC\u062E \u06AF\u0632\u0627\u0631\u0634");
  required(row, "Status", issues, "\u0648\u0636\u0639\u06CC\u062A");
  if (typeof row.Kind === "string" && !MAINTENANCE_KINDS.includes(row.Kind)) {
    issues.push({ code: "E-EQM-KIND", column: "Kind", message: `\u0646\u0648\u0639 \u062A\u0639\u0645\u06CC\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.Kind}` });
  }
  if (typeof row.Priority === "string" && !MAINTENANCE_PRIORITIES.includes(row.Priority)) {
    issues.push({ code: "E-EQM-PRIORITY", column: "Priority", message: `\u0627\u0648\u0644\u0648\u06CC\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.Priority}` });
  }
  if (typeof row.Status === "string" && !MAINTENANCE_STATUSES.includes(row.Status)) {
    issues.push({ code: "E-EQM-MSTATUS", column: "Status", message: `\u0648\u0636\u0639\u06CC\u062A \u062A\u0639\u0645\u06CC\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.Status}` });
  }
  const down = typeof row.DownFrom === "string" ? row.DownFrom : "";
  const up = typeof row.DownTo === "string" ? row.DownTo : "";
  if (down && up && Date.parse(up) < Date.parse(down)) {
    issues.push({ code: "E-EQM-DATE-RANGE", column: "DownTo", message: "\u0632\u0645\u0627\u0646 \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0632\u0648\u062F\u062A\u0631 \u0627\u0632 \u062A\u0648\u0642\u0641 \u0627\u0633\u062A" });
  }
  return { ok: issues.length === 0, issues };
}
function equipmentAge(commissionedIso, nowIso) {
  const days = commissionedIso ? daysBetween(commissionedIso, nowIso) : 0;
  return { days, months: round2(days / 30.44), years: round2(days / 365.25) };
}
function straightLineDepreciation(purchaseValue, salvageValue, lifeYears, ageYears) {
  const pv = Math.max(0, purchaseValue);
  const sv = clamp(salvageValue, 0, pv);
  const life = Math.max(1, lifeYears);
  const annual = (pv - sv) / life;
  const accumulated = Math.min(pv - sv, annual * Math.max(0, ageYears));
  const bookValue = round2(pv - accumulated);
  return {
    annual: round2(annual),
    accumulated: round2(accumulated),
    bookValue,
    ratePct: pv > 0 ? round2(accumulated / pv * 100) : 0
  };
}
function utilization(workHours, periodDays, workingHoursPerDay = 8, thresholds) {
  const low = thresholds?.lowPct ?? 40;
  const high = thresholds?.highPct ?? 75;
  const availableHours = Math.max(0, periodDays) * Math.max(0, workingHoursPerDay);
  const wh = Math.max(0, workHours);
  const rate = availableHours > 0 ? clamp(wh / availableHours * 100, 0, 100) : 0;
  const verdict = rate <= 0 ? "idle" : rate < low ? "low" : rate > high ? "high" : "normal";
  return { rate: round2(rate), verdict, availableHours, workHours: round2(wh), idleHours: round2(availableHours - wh) };
}
function availability(downtimeHours2, periodHours) {
  const total = Math.max(0, periodHours);
  const down = clamp(downtimeHours2, 0, total);
  const uptime = total - down;
  const rate = total > 0 ? uptime / total * 100 : 100;
  const verdict = rate < 85 ? "critical" : rate < 95 ? "degraded" : "healthy";
  return { rate: round2(rate), verdict, downtimeHours: round2(down), uptimeHours: round2(uptime) };
}
function workHoursSum(meters) {
  return round2(meters.reduce((s, m) => s + (Number(m.WorkHours) || 0), 0));
}
function downtimeHours(orders, fromIso, toIso) {
  let total = 0;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  for (const o of orders) {
    if (!o.DownFrom) continue;
    const start = Math.max(from, Date.parse(o.DownFrom));
    const end = o.DownTo ? Math.min(to, Date.parse(o.DownTo)) : to;
    if (end > start) total += (end - start) / 36e5;
  }
  return round2(total);
}
function mtbf(orders, periodHours, downtimeHrs) {
  const failures = orders.filter((o) => (o.Kind === "corrective" || o.Kind === "overhaul") && (o.Status === "done" || o.Status === "closed"));
  if (failures.length === 0) return null;
  const down = downtimeHrs ?? downtimeHours(failures, "0000-01-01", "9999-12-31");
  const uptime = Math.max(0, periodHours - down);
  const value = uptime / failures.length;
  return { mtbfHours: round2(value), mtbfDays: round2(value / 24) };
}
function mttr(orders) {
  const done = orders.filter((o) => o.DownFrom && o.DownTo && (o.Status === "done" || o.Status === "closed"));
  if (done.length === 0) return null;
  const sum = done.reduce((s, o) => s + hoursBetween(o.DownFrom, o.DownTo), 0);
  const value = sum / done.length;
  return { mttrHours: round2(value), mttrDays: round2(value / 24) };
}
function maintenanceBacklog(orders) {
  const open = orders.filter((o) => o.Status === "open" || o.Status === "in_progress");
  const byPriority = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const o of open) byPriority[o.Priority] += 1;
  return { total: open.length, byPriority };
}
function nextPmDue(lastPmIso, intervalDays, nowIso) {
  const base = lastPmIso ? Date.parse(lastPmIso) : NaN;
  if (Number.isNaN(base) || intervalDays <= 0) return { dueIso: "", daysLeft: 0, overdue: false };
  const dueMs = base + intervalDays * 864e5;
  const dueIso = new Date(dueMs).toISOString().slice(0, 10);
  const daysLeft = Math.round((dueMs - Date.parse(nowIso)) / 864e5);
  return { dueIso, daysLeft, overdue: daysLeft < 0 };
}
function rentalCostAccrued(rental, asOfIso) {
  const start = Date.parse(rental.StartDate);
  const end = rental.EndDate ? Date.parse(rental.EndDate) : Date.parse(asOfIso);
  const asOf = Date.parse(asOfIso);
  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(asOf)) return { elapsedUnits: 0, accrued: 0, periodLabel: rental.RateType };
  const endCapped = Math.max(start, Math.min(end, asOf));
  const days = Math.max(0, (endCapped - start) / 864e5);
  let elapsedUnits;
  let periodLabel;
  if (rental.RateType === "hourly") {
    elapsedUnits = days * 24;
    periodLabel = "\u0633\u0627\u0639\u062A";
  } else if (rental.RateType === "daily") {
    elapsedUnits = days;
    periodLabel = "\u0631\u0648\u0632";
  } else {
    elapsedUnits = days / 30.44;
    periodLabel = "\u0645\u0627\u0647";
  }
  return { elapsedUnits: round2(elapsedUnits), accrued: round2(elapsedUnits * (Number(rental.Rate) || 0)), periodLabel };
}
function equipmentCostPerHour(workHours, costs) {
  const total = (costs.rentalCost || 0) + (costs.maintenanceCost || 0) + (costs.fuelCost || 0);
  const hours = Number(workHours) || 0;
  return { totalCost: round2(total), costPerHour: hours > 0 ? round2(total / hours) : null };
}
function productivity(outputQuantity, plannedQuantity) {
  const planned = Number(plannedQuantity) || 0;
  const output = Number(outputQuantity) || 0;
  const index = planned > 0 ? output / planned : 0;
  const verdict = index < 0.9 ? "under" : index > 1.1 ? "over" : "on_plan";
  return { index: round2(index), verdict };
}
function eqmEws(equipment, ctx) {
  const out = [];
  const cat = CATEGORY_BY_CODE[equipment.Category] ?? CATEGORY_BY_CODE["OTH"];
  const util = utilization(ctx.workHours, ctx.periodDays, 8, { lowPct: ctx.utilLowPct || cat.utilLowPct, highPct: cat.utilHighPct });
  if (util.verdict === "idle" && equipment.Status === "active") {
    out.push({ code: "W-EQM-IDLE", severity: "warning", message: `\u0645\u0627\u0634\u06CC\u0646 \xAB${equipment.NameFa}\xBB \u062F\u0631 \u0628\u0627\u0632\u0647 \u0641\u0639\u0627\u0644 \u0627\u0645\u0627 \u0628\u062F\u0648\u0646 \u06A9\u0627\u0631\u06A9\u0631\u062F \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0627\u0633\u062A` });
  } else if (util.verdict === "low") {
    out.push({ code: "W-EQM-LOW-UTIL", severity: "info", message: `\u0628\u0647\u0631\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC ${util.rate}\u066A \u067E\u0627\u06CC\u06CC\u0646\u200C\u062A\u0631 \u0627\u0632 \u0622\u0633\u062A\u0627\u0646\u0647\u0654 ${ctx.utilLowPct || cat.utilLowPct}\u066A \u0627\u0633\u062A` });
  }
  const totalHours = Math.max(1, ctx.periodDays * 24);
  const avail = availability(ctx.downtimeHrs, totalHours);
  if (avail.verdict === "critical") {
    out.push({ code: "W-EQM-DOWNTIME", severity: "critical", message: `\u062F\u0633\u062A\u0631\u0633\u200C\u067E\u0630\u06CC\u0631\u06CC ${avail.rate}\u066A (\u062A\u0648\u0642\u0641 ${avail.downtimeHours} \u0633\u0627\u0639\u062A)` });
  } else if (avail.verdict === "degraded") {
    out.push({ code: "W-EQM-DOWNTIME", severity: "warning", message: `\u062F\u0633\u062A\u0631\u0633\u200C\u067E\u0630\u06CC\u0631\u06CC ${avail.rate}\u066A \u0632\u06CC\u0631 \u062D\u062F \u0645\u0637\u0644\u0648\u0628 \u0627\u0633\u062A` });
  }
  const backlog = maintenanceBacklog(ctx.orders);
  if (backlog.byPriority.critical > 0) {
    out.push({ code: "W-EQM-BACKLOG", severity: "critical", message: `${backlog.byPriority.critical} \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0627\u0632 \u062F\u0627\u0631\u062F` });
  } else if (backlog.byPriority.high > 0) {
    out.push({ code: "W-EQM-BACKLOG", severity: "warning", message: `${backlog.byPriority.high} \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u0627 \u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627 \u0628\u0627\u0632 \u062F\u0627\u0631\u062F` });
  }
  const pm = nextPmDue(ctx.lastPmIso, ctx.pmIntervalDays ?? 0, ctx.nowIso);
  if (pm.overdue) {
    out.push({ code: "W-EQM-PM-DUE", severity: "critical", message: `\u0633\u0631\u0648\u06CC\u0633 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC ${Math.abs(pm.daysLeft)} \u0631\u0648\u0632 \u0627\u0632 \u0645\u0648\u0639\u062F \u06AF\u0630\u0634\u062A\u0647 \u0627\u0633\u062A` });
  } else if (ctx.lastPmIso && pm.dueIso && pm.daysLeft <= 14 && ctx.pmIntervalDays) {
    out.push({ code: "W-EQM-PM-DUE", severity: "warning", message: `\u0633\u0631\u0648\u06CC\u0633 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u062A\u0627 ${pm.daysLeft} \u0631\u0648\u0632 \u062F\u06CC\u06AF\u0631 \u0645\u0648\u0639\u062F \u0645\u06CC\u200C\u0634\u0648\u062F` });
  }
  if (ctx.rental && ctx.rental.Status === "active" && ctx.rental.EndDate) {
    const left = daysBetween(ctx.nowIso, ctx.rental.EndDate);
    if (left <= 14) {
      out.push({ code: "W-EQM-RENT-EXPIRY", severity: left <= 3 ? "critical" : "warning", message: `\u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0627\u062C\u0627\u0631\u0647 \u062A\u0627 ${left} \u0631\u0648\u0632 \u062F\u06CC\u06AF\u0631 \u067E\u0627\u06CC\u0627\u0646 \u0645\u06CC\u200C\u06CC\u0627\u0628\u062F` });
    }
  }
  if (equipment.Status !== "disposed" && ctx.ageYears >= ctx.economicLifeYears) {
    out.push({ code: "W-EQM-AGING", severity: "info", message: `\u0633\u0646 ${ctx.ageYears} \u0633\u0627\u0644 \u0628\u0647 \u0639\u0645\u0631 \u0627\u0642\u062A\u0635\u0627\u062F\u06CC ${ctx.economicLifeYears} \u0633\u0627\u0644 \u0631\u0633\u06CC\u062F\u0647 \u2014 \u0628\u0627\u0632\u0646\u06AF\u0631\u06CC \u0633\u0631\u0645\u0627\u06CC\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u062F` });
  }
  return out;
}
function fleetSummary(equipment, metrics, openMaintenance, accruedRent, warnings) {
  const byCategory = {};
  const byStatus = { active: 0, idle: 0, repair: 0, disposed: 0 };
  const byOwnership = { owned: 0, rented: 0, leased: 0 };
  for (const e of equipment) {
    byCategory[e.Category] = (byCategory[e.Category] ?? 0) + 1;
    byStatus[e.Status] += 1;
    byOwnership[e.Ownership] += 1;
  }
  const utilRates = metrics.map((m) => utilization(m.workHours, m.periodDays, 8).rate);
  const availRates = metrics.map((m) => availability(m.downtimeHrs, Math.max(1, m.periodDays * 24)).rate);
  const avg = (arr) => arr.length ? round2(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
  return {
    total: equipment.length,
    byCategory,
    byStatus,
    byOwnership,
    active: byStatus.active,
    inRepair: byStatus.repair,
    avgUtilization: avg(utilRates),
    avgAvailability: avg(availRates),
    openMaintenance,
    accruedRent: round2(accruedRent),
    warnings
  };
}
var EQP_VERSION = "eqp-v1";
var ISO14224_TAXONOMY = [
  { code: "ME", fa: "\u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC \u0645\u062A\u062D\u0631\u06A9", en: "Mobile mechanical equipment", level: 4 },
  { code: "ME.EA", fa: "\u062E\u0627\u06A9\u200C\u0628\u0631\u062F\u0627\u0631\u06CC", en: "Earthmoving", level: 5, parent: "ME" },
  { code: "ME.LI", fa: "\u0628\u0627\u0631\u0628\u0631\u062F\u0627\u0631\u06CC", en: "Lifting", level: 5, parent: "ME" },
  { code: "ME.TR", fa: "\u062D\u0645\u0644 \u0648 \u0646\u0642\u0644", en: "Transport", level: 5, parent: "ME" },
  { code: "ME.CO", fa: "\u0628\u062A\u0646 \u0648 \u0645\u0635\u0627\u0644\u062D", en: "Concrete & materials", level: 5, parent: "ME" },
  { code: "SE", fa: "\u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062B\u0627\u0628\u062A", en: "Static equipment", level: 4 },
  { code: "SE.PW", fa: "\u062A\u0648\u0644\u06CC\u062F \u0648 \u062A\u0648\u0632\u06CC\u0639 \u062A\u0648\u0627\u0646", en: "Power generation", level: 5, parent: "SE" },
  { code: "SE.OT", fa: "\u0633\u0627\u06CC\u0631 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062B\u0627\u0628\u062A", en: "Other static", level: 5, parent: "SE" }
];
var ISO14224_BY_CODE = Object.fromEntries(ISO14224_TAXONOMY.map((n) => [n.code, n]));
var CLASS_TO_ISO14224 = {
  earthmoving: "ME.EA",
  lifting: "ME.LI",
  transport: "ME.TR",
  concrete: "ME.CO",
  power: "SE.PW",
  other: "SE.OT"
};
function iso14224Code(categoryCode) {
  const cat = CATEGORY_BY_CODE[categoryCode] ?? CATEGORY_BY_CODE["OTH"];
  return CLASS_TO_ISO14224[cat.cls];
}
function equipmentQrPayload(row) {
  return `EQP:${row.ProjectId}:${row.Code}:${iso14224Code(row.Category)}`;
}
function tco(input) {
  const life = Math.max(1, input.lifeYears);
  const pv = Math.max(0, input.purchaseValue);
  const sv = clamp(input.salvageValue ?? 0, 0, pv);
  const depreciationTotal = pv - sv;
  const annualRunning = (input.annualOperatingCost ?? 0) + (input.annualMaintenanceCost ?? 0) + (input.annualInsuranceCost ?? 0);
  const oneOff = (input.mobilizationCost ?? 0) + (input.demobilizationCost ?? 0);
  const totalCost = depreciationTotal + annualRunning * life + oneOff;
  const lifetimeHours = Math.max(1, (input.annualWorkHours || 0) * life);
  return {
    totalCost: round2(totalCost),
    annualCost: round2(totalCost / life),
    costPerHour: round2(totalCost / lifetimeHours),
    depreciationTotal: round2(depreciationTotal),
    lifetimeHours: round2(lifetimeHours)
  };
}
function buyVsRent(own, rentalHourlyRate, variableOwnCostPerHour = 0) {
  const t = tco(own);
  const rent = Math.max(0, rentalHourlyRate);
  const margin = rent - Math.max(0, variableOwnCostPerHour);
  const breakEvenHours = margin > 0 ? t.totalCost / margin : Infinity;
  const saving = rent - (t.costPerHour + Math.max(0, variableOwnCostPerHour));
  const verdict = Math.abs(saving) < rent * 0.05 ? "neutral" : saving > 0 ? "buy" : "rent";
  return {
    ownCostPerHour: t.costPerHour,
    rentCostPerHour: round2(rent),
    breakEvenHours: Number.isFinite(breakEvenHours) ? round2(breakEvenHours) : Infinity,
    verdict,
    savingPerHour: round2(saving)
  };
}
var DISPATCH_STATUSES = ["draft", "submitted", "approved", "rejected", "executed", "cancelled"];
var SHIFTS = ["day", "night", "full"];
function validateDispatch(row) {
  const issues = [];
  required(row, "ProjectId", issues, "\u067E\u0631\u0648\u0698\u0647");
  required(row, "EquipmentId", issues, "\u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A");
  required(row, "DispatchDate", issues, "\u062A\u0627\u0631\u06CC\u062E \u062F\u06CC\u0633\u067E\u0686");
  required(row, "Shift", issues, "\u0634\u06CC\u0641\u062A");
  required(row, "Status", issues, "\u0648\u0636\u0639\u06CC\u062A");
  if (typeof row.Shift === "string" && !SHIFTS.includes(row.Shift)) {
    issues.push({ code: "E-EQP-SHIFT", column: "Shift", message: `\u0634\u06CC\u0641\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.Shift}` });
  }
  if (typeof row.Status === "string" && !DISPATCH_STATUSES.includes(row.Status)) {
    issues.push({ code: "E-EQP-DSTATUS", column: "Status", message: `\u0648\u0636\u0639\u06CC\u062A \u062F\u06CC\u0633\u067E\u0686 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.Status}` });
  }
  const hours = optionalNumber(row.PlannedHours);
  if (hours !== void 0 && (hours <= 0 || hours > 24)) {
    issues.push({ code: "E-EQP-HOURS", column: "PlannedHours", message: "\u0633\u0627\u0639\u062A \u0628\u0631\u0646\u0627\u0645\u0647 \u0628\u0627\u06CC\u062F \u0628\u06CC\u0646 \u06F0 \u0648 \u06F2\u06F4 \u0628\u0627\u0634\u062F" });
  }
  const qty = optionalNumber(row.PlannedQty);
  if (qty !== void 0 && qty < 0) {
    issues.push({ code: "E-EQP-QTY", column: "PlannedQty", message: "\u062D\u062C\u0645 \u0628\u0631\u0646\u0627\u0645\u0647 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F" });
  }
  return { ok: issues.length === 0, issues };
}
function dispatchPrecheck(ctx) {
  const gates = [];
  const operable = ctx.equipment.Status === "active";
  gates.push({
    code: "G-EQP-STATUS",
    passed: operable,
    blocking: true,
    message: operable ? "\u0645\u0627\u0634\u06CC\u0646 \u062F\u0631 \u0648\u0636\u0639\u06CC\u062A \u0639\u0645\u0644\u06CC\u0627\u062A\u06CC \u0627\u0633\u062A" : `\u0645\u0627\u0634\u06CC\u0646 \u062F\u0631 \u0648\u0636\u0639\u06CC\u062A \xAB${ctx.equipment.Status}\xBB \u0642\u0627\u0628\u0644 \u062F\u06CC\u0633\u067E\u0686 \u0646\u06CC\u0633\u062A`
  });
  gates.push({
    code: "G-EQP-NOCRIT",
    passed: ctx.openCriticalOrders === 0,
    blocking: true,
    message: ctx.openCriticalOrders === 0 ? "\u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0627\u0632 \u0646\u062F\u0627\u0631\u062F" : `${ctx.openCriticalOrders} \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0627\u0632 \u062F\u0627\u0631\u062F`
  });
  const pmOk = ctx.pmOverdueDays <= 0;
  gates.push({
    code: "G-EQP-PM",
    passed: pmOk,
    blocking: ctx.pmOverdueDays > 7,
    message: pmOk ? "\u0633\u0631\u0648\u06CC\u0633 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u0628\u0647\u200C\u0631\u0648\u0632 \u0627\u0633\u062A" : `\u0633\u0631\u0648\u06CC\u0633 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC ${ctx.pmOverdueDays} \u0631\u0648\u0632 \u0645\u0639\u0648\u0642 \u0627\u0633\u062A`
  });
  gates.push({
    code: "G-EQP-OPERATOR",
    passed: ctx.operatorAssigned,
    blocking: true,
    message: ctx.operatorAssigned ? "\u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u062A\u062E\u0635\u06CC\u0635 \u06CC\u0627\u0641\u062A\u0647 \u0627\u0633\u062A" : "\u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u062A\u062E\u0635\u06CC\u0635 \u0646\u06CC\u0627\u0641\u062A\u0647 \u0627\u0633\u062A"
  });
  if (ctx.operatorLicenseExpiry) {
    const left = daysBetween(ctx.nowIso, ctx.operatorLicenseExpiry);
    const valid = Date.parse(ctx.operatorLicenseExpiry) >= Date.parse(ctx.nowIso);
    gates.push({
      code: "G-EQP-LICENSE",
      passed: valid,
      blocking: true,
      message: valid ? `\u06AF\u0648\u0627\u0647\u06CC\u200C\u0646\u0627\u0645\u0647 \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u062A\u0627 ${left} \u0631\u0648\u0632 \u062F\u06CC\u06AF\u0631 \u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A` : "\u06AF\u0648\u0627\u0647\u06CC\u200C\u0646\u0627\u0645\u0647 \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A"
    });
  }
  gates.push({
    code: "G-EQP-SAFETY",
    passed: ctx.safetyCheckDone,
    blocking: true,
    message: ctx.safetyCheckDone ? "\u0686\u06A9\u200C\u0644\u06CC\u0633\u062A \u0627\u06CC\u0645\u0646\u06CC \u067E\u06CC\u0634 \u0627\u0632 \u0627\u0633\u062A\u0627\u0631\u062A \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647" : "\u0686\u06A9\u200C\u0644\u06CC\u0633\u062A \u0627\u06CC\u0645\u0646\u06CC \u067E\u06CC\u0634 \u0627\u0632 \u0627\u0633\u062A\u0627\u0631\u062A \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F\u0647"
  });
  if (ctx.equipment.Ownership !== "owned") {
    const active = ctx.rentalActive !== false;
    gates.push({
      code: "G-EQP-RENTAL",
      passed: active,
      blocking: false,
      message: active ? "\u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0627\u062C\u0627\u0631\u0647 \u0641\u0639\u0627\u0644 \u0627\u0633\u062A" : "\u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0627\u062C\u0627\u0631\u0647 \u0641\u0639\u0627\u0644 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F"
    });
  }
  const blockers = gates.filter((g) => g.blocking && !g.passed).length;
  return { allowed: blockers === 0, gates, blockers };
}
var DISPATCH_FLOW = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["executed", "cancelled"],
  rejected: ["draft", "cancelled"],
  executed: [],
  cancelled: []
};
function canAdvanceDispatch(from, to) {
  return (DISPATCH_FLOW[from] ?? []).includes(to);
}
var FUEL_KINDS = ["diesel", "gasoline", "oil", "grease", "tire", "other"];
function validateFuelLog(row) {
  const issues = [];
  required(row, "ProjectId", issues, "\u067E\u0631\u0648\u0698\u0647");
  required(row, "EquipmentId", issues, "\u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A");
  required(row, "LogDate", issues, "\u062A\u0627\u0631\u06CC\u062E \u062B\u0628\u062A");
  required(row, "Kind", issues, "\u0646\u0648\u0639 \u0645\u0635\u0631\u0641\u06CC");
  required(row, "Quantity", issues, "\u0645\u0642\u062F\u0627\u0631");
  if (typeof row.Kind === "string" && !FUEL_KINDS.includes(row.Kind)) {
    issues.push({ code: "E-EQP-FUEL-KIND", column: "Kind", message: `\u0646\u0648\u0639 \u0645\u0635\u0631\u0641\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.Kind}` });
  }
  const qty = optionalNumber(row.Quantity);
  if (qty !== void 0 && qty <= 0) {
    issues.push({ code: "E-EQP-FUEL-QTY", column: "Quantity", message: "\u0645\u0642\u062F\u0627\u0631 \u0645\u0635\u0631\u0641\u06CC \u0628\u0627\u06CC\u062F \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F" });
  }
  const cost = optionalNumber(row.UnitCost);
  if (cost !== void 0 && cost < 0) {
    issues.push({ code: "E-EQP-FUEL-COST", column: "UnitCost", message: "\u0628\u0647\u0627\u06CC \u0648\u0627\u062D\u062F \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F" });
  }
  return { ok: issues.length === 0, issues };
}
function fuelSummary(logs) {
  const byKind = {};
  let quantity = 0;
  let cost = 0;
  for (const l of logs) {
    const q = Number(l.Quantity) || 0;
    const c = q * (Number(l.UnitCost) || 0);
    byKind[l.Kind] = byKind[l.Kind] ?? { quantity: 0, cost: 0 };
    byKind[l.Kind].quantity = round2(byKind[l.Kind].quantity + q);
    byKind[l.Kind].cost = round2(byKind[l.Kind].cost + c);
    if (l.Kind === "diesel" || l.Kind === "gasoline") quantity += q;
    cost += c;
  }
  return { quantity: round2(quantity), cost: round2(cost), byKind };
}
function specificFuelConsumption(fuelLitres, workHours, benchmark) {
  const hours = Number(workHours) || 0;
  if (hours <= 0) return { sfc: 0, verdict: "unknown" };
  const sfc = round2(Math.max(0, fuelLitres) / hours);
  if (benchmark === void 0 || benchmark <= 0) return { sfc, verdict: "unknown" };
  const ratio = sfc / benchmark;
  return { sfc, verdict: ratio > 1.15 ? "excessive" : ratio < 0.85 ? "efficient" : "normal" };
}
var PM_BASES = ["run_hours", "kilometers", "calendar_days", "cycles"];
function validatePmSchedule(row) {
  const issues = [];
  required(row, "ProjectId", issues, "\u067E\u0631\u0648\u0698\u0647");
  required(row, "EquipmentId", issues, "\u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A");
  required(row, "Code", issues, "\u06A9\u062F \u0628\u0631\u0646\u0627\u0645\u0647");
  required(row, "TitleFa", issues, "\u0639\u0646\u0648\u0627\u0646");
  required(row, "Basis", issues, "\u067E\u0627\u06CC\u0647\u0654 \u062F\u0648\u0631\u0647");
  required(row, "IntervalValue", issues, "\u0628\u0627\u0632\u0647\u0654 \u062F\u0648\u0631\u0647");
  if (typeof row.Basis === "string" && !PM_BASES.includes(row.Basis)) {
    issues.push({ code: "E-EQP-PM-BASIS", column: "Basis", message: `\u067E\u0627\u06CC\u0647\u0654 \u062F\u0648\u0631\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: ${row.Basis}` });
  }
  const iv = optionalNumber(row.IntervalValue);
  if (iv !== void 0 && iv <= 0) {
    issues.push({ code: "E-EQP-PM-INTERVAL", column: "IntervalValue", message: "\u0628\u0627\u0632\u0647\u0654 \u062F\u0648\u0631\u0647 \u0628\u0627\u06CC\u062F \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F" });
  }
  return { ok: issues.length === 0, issues };
}
function pmDueByBasis(schedule, nowIso, currentReading, avgPerDay) {
  const interval = Math.max(0, Number(schedule.IntervalValue) || 0);
  if (interval <= 0) return { basis: schedule.Basis, remaining: 0, overdue: false, progressPct: 0, severity: "ok" };
  if (schedule.Basis === "calendar_days") {
    const due = nextPmDue(schedule.LastDoneAt, interval, nowIso);
    const consumed2 = interval - due.daysLeft;
    const progressPct2 = round2(clamp(consumed2 / interval * 100, 0, 999));
    return {
      basis: schedule.Basis,
      remaining: due.daysLeft,
      overdue: due.overdue,
      dueIso: due.dueIso || void 0,
      progressPct: progressPct2,
      severity: due.overdue ? "overdue" : due.daysLeft === 0 ? "due" : due.daysLeft <= 7 ? "soon" : "ok"
    };
  }
  const base = Number(schedule.LastDoneReading) || 0;
  const now = Number(currentReading) || 0;
  const consumed = Math.max(0, now - base);
  const remaining = round2(interval - consumed);
  const progressPct = round2(clamp(consumed / interval * 100, 0, 999));
  const perDay = Number(avgPerDay) || 0;
  const dueIso = perDay > 0 && remaining > 0 ? new Date(Date.parse(nowIso) + remaining / perDay * 864e5).toISOString().slice(0, 10) : void 0;
  const daysLeft = perDay > 0 ? remaining / perDay : Infinity;
  return {
    basis: schedule.Basis,
    remaining,
    overdue: remaining < 0,
    dueIso,
    progressPct,
    severity: remaining < 0 ? "overdue" : remaining === 0 ? "due" : daysLeft <= 7 || progressPct >= 90 ? "soon" : "ok"
  };
}
function pmCompliance(orders, plannedCount) {
  const done = orders.filter((o) => (o.Kind === "preventive" || o.Kind === "inspection") && (o.Status === "done" || o.Status === "closed")).length;
  const planned = Math.max(0, plannedCount);
  const rate = planned > 0 ? round2(clamp(done / planned * 100, 0, 100)) : 100;
  return { rate, done, planned, verdict: rate < 70 ? "poor" : rate < 90 ? "fair" : "good" };
}
var WO_STAGES = ["requested", "approved", "in_progress", "awaiting_parts", "completed", "verified", "cancelled"];
var WO_FLOW = {
  requested: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["awaiting_parts", "completed", "cancelled"],
  awaiting_parts: ["in_progress", "cancelled"],
  completed: ["verified", "in_progress"],
  verified: [],
  cancelled: []
};
function canAdvanceWo(from, to) {
  return (WO_FLOW[from] ?? []).includes(to);
}
function woStageToStatus(stage) {
  if (stage === "requested" || stage === "approved" || stage === "awaiting_parts") return stage === "awaiting_parts" ? "in_progress" : "open";
  if (stage === "in_progress") return "in_progress";
  if (stage === "completed") return "done";
  return "closed";
}
var RCA_CAUSES = ["mechanical", "electrical", "hydraulic", "instrument", "software", "structural", "human", "external"];
var RCA_CAUSE_FA = {
  mechanical: "\u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC",
  electrical: "\u0627\u0644\u06A9\u062A\u0631\u06CC\u06A9\u06CC",
  hydraulic: "\u0647\u06CC\u062F\u0631\u0648\u0644\u06CC\u06A9\u06CC",
  instrument: "\u0627\u0628\u0632\u0627\u0631 \u062F\u0642\u06CC\u0642",
  software: "\u0646\u0631\u0645\u200C\u0627\u0641\u0632\u0627\u0631\u06CC",
  structural: "\u0633\u0627\u0632\u0647\u200C\u0627\u06CC",
  human: "\u062E\u0637\u0627\u06CC \u0627\u0646\u0633\u0627\u0646\u06CC",
  external: "\u0639\u0648\u0627\u0645\u0644 \u0628\u06CC\u0631\u0648\u0646\u06CC"
};
function rcaPareto(orders) {
  const failures = orders.filter((o) => o.Kind === "corrective" || o.Kind === "overhaul");
  const counts = {};
  for (const o of failures) {
    const key = o.RootCause && RCA_CAUSES.includes(o.RootCause) ? o.RootCause : "external";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const total = failures.length;
  let cum = 0;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cause, count]) => {
    const pct2 = total > 0 ? round2(count / total * 100) : 0;
    cum = round2(cum + pct2);
    return { cause, count, pct: pct2, cumulativePct: cum };
  });
}
function validateSparePart(row) {
  const issues = [];
  required(row, "ProjectId", issues, "\u067E\u0631\u0648\u0698\u0647");
  required(row, "PartNo", issues, "\u06A9\u062F \u0642\u0637\u0639\u0647");
  required(row, "NameFa", issues, "\u0646\u0627\u0645 \u0642\u0637\u0639\u0647");
  required(row, "OnHand", issues, "\u0645\u0648\u062C\u0648\u062F\u06CC");
  required(row, "MinLevel", issues, "\u062D\u062F\u0627\u0642\u0644 \u0645\u0648\u062C\u0648\u062F\u06CC");
  const onHand = optionalNumber(row.OnHand);
  if (onHand !== void 0 && onHand < 0) {
    issues.push({ code: "E-EQP-PART-STOCK", column: "OnHand", message: "\u0645\u0648\u062C\u0648\u062F\u06CC \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F" });
  }
  const min = optionalNumber(row.MinLevel);
  if (min !== void 0 && min < 0) {
    issues.push({ code: "E-EQP-PART-MIN", column: "MinLevel", message: "\u062D\u062F\u0627\u0642\u0644 \u0645\u0648\u062C\u0648\u062F\u06CC \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F" });
  }
  const lead = optionalNumber(row.LeadTimeDays);
  if (lead !== void 0 && lead < 0) {
    issues.push({ code: "E-EQP-PART-LEAD", column: "LeadTimeDays", message: "\u0632\u0645\u0627\u0646 \u062A\u0623\u0645\u06CC\u0646 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F" });
  }
  return { ok: issues.length === 0, issues };
}
function reorderPoint(avgDailyUsage, leadTimeDays, minLevel = 0) {
  return round2(Math.max(0, avgDailyUsage) * Math.max(0, leadTimeDays) + Math.max(0, minLevel));
}
function partStockStatus(part, coverDays = 30) {
  const onHand = Math.max(0, Number(part.OnHand) || 0);
  const min = Math.max(0, Number(part.MinLevel) || 0);
  const usage = Math.max(0, Number(part.AvgDailyUsage) || 0);
  const lead = Math.max(0, Number(part.LeadTimeDays) || 0);
  const rop = reorderPoint(usage, lead, min);
  const status = onHand <= 0 ? "out" : onHand < min ? "shortage" : onHand <= rop ? "reorder" : "ok";
  const target = usage > 0 ? usage * (lead + coverDays) : Math.max(min * 2, rop);
  const suggestedQty = status === "ok" ? 0 : round2(Math.max(0, target - onHand));
  const daysOfCover = usage > 0 ? round2(onHand / usage) : Infinity;
  return { rop, status, suggestedQty, daysOfCover: Number.isFinite(daysOfCover) ? daysOfCover : 9999, critical: part.Critical === true };
}
function partsToRequisition(parts, coverDays = 30) {
  return parts.map((part) => ({ part, stock: partStockStatus(part, coverDays) })).filter((x) => x.stock.status !== "ok").sort((a, b) => {
    if (a.stock.critical !== b.stock.critical) return a.stock.critical ? -1 : 1;
    const rank = { out: 0, shortage: 1, reorder: 2, ok: 3 };
    return rank[a.stock.status] - rank[b.stock.status];
  });
}
function oee(input) {
  const av = availability(input.downtimeHours, input.periodHours).rate;
  const theoretical = Math.max(0, input.workHours) * Math.max(0, input.ratedOutputPerHour);
  const perf = theoretical > 0 ? clamp(Math.max(0, input.actualOutput) / theoretical * 100, 0, 100) : 0;
  const good = input.goodOutput === void 0 ? input.actualOutput : input.goodOutput;
  const qual = input.actualOutput > 0 ? clamp(Math.max(0, good) / input.actualOutput * 100, 0, 100) : 100;
  const value = av / 100 * (perf / 100) * (qual / 100) * 100;
  const util = utilization(input.workHours, Math.max(1, input.periodHours / 24), 8).rate;
  return {
    availability: round2(av),
    performance: round2(perf),
    quality: round2(qual),
    utilization: round2(util),
    oee: round2(value),
    verdict: value >= 85 ? "world_class" : value >= 60 ? "good" : value >= 40 ? "fair" : "poor"
  };
}
function maintenanceCostRatio(maintenanceCost, assetValue) {
  const value = Math.max(0, assetValue);
  const ratio = value > 0 ? round2(Math.max(0, maintenanceCost) / value * 100) : 0;
  return { ratio, verdict: ratio > 15 ? "critical" : ratio > 8 ? "watch" : "healthy" };
}
var EQP_KPI_CATALOG = [
  { code: "K-EQP-AVAIL", fa: "\u062F\u0633\u062A\u0631\u0633\u200C\u067E\u0630\u06CC\u0631\u06CC", en: "Availability", unit: "\u066A", direction: "higher", target: 95 },
  { code: "K-EQP-UTIL", fa: "\u0628\u0647\u0631\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC", en: "Utilization", unit: "\u066A", direction: "higher", target: 70 },
  { code: "K-EQP-OEE", fa: "\u0627\u062B\u0631\u0628\u062E\u0634\u06CC \u06A9\u0644\u06CC \u062A\u062C\u0647\u06CC\u0632", en: "OEE", unit: "\u066A", direction: "higher", target: 65 },
  { code: "K-EQP-MTBF", fa: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0632\u0645\u0627\u0646 \u0628\u06CC\u0646 \u062E\u0631\u0627\u0628\u06CC", en: "MTBF", unit: "\u0633\u0627\u0639\u062A", direction: "higher", target: 500 },
  { code: "K-EQP-MTTR", fa: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0632\u0645\u0627\u0646 \u062A\u0639\u0645\u06CC\u0631", en: "MTTR", unit: "\u0633\u0627\u0639\u062A", direction: "lower", target: 8 },
  { code: "K-EQP-MCR", fa: "\u0646\u0633\u0628\u062A \u0647\u0632\u06CC\u0646\u0647 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC", en: "Maintenance cost ratio", unit: "\u066A", direction: "lower", target: 8 },
  { code: "K-EQP-PMC", fa: "\u0627\u0646\u0637\u0628\u0627\u0642 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u067E\u06CC\u0634\u06AF\u06CC\u0631\u0627\u0646\u0647", en: "PM compliance", unit: "\u066A", direction: "higher", target: 90 },
  { code: "K-EQP-SFC", fa: "\u0645\u0635\u0631\u0641 \u0648\u06CC\u0698\u0647 \u0633\u0648\u062E\u062A", en: "Specific fuel consumption", unit: "\u0644\u06CC\u062A\u0631/\u0633\u0627\u0639\u062A", direction: "lower", target: 18 }
];
var EQP_KPI_BY_CODE = Object.fromEntries(EQP_KPI_CATALOG.map((k) => [k.code, k]));
function equipmentHealthScore(input) {
  const av = clamp(input.availabilityPct, 0, 100) * 0.35;
  const ut = clamp(input.utilizationPct, 0, 100) * 0.2;
  const pm = clamp(input.pmCompliancePct, 0, 100) * 0.25;
  const backlogPenalty = Math.min(20, Math.max(0, input.criticalBacklog) * 10);
  const agingScore = clamp((1 - Math.max(0, input.agingRatio)) * 100, 0, 100) * 0.2;
  const score = round2(clamp(av + ut + pm + agingScore - backlogPenalty, 0, 100));
  return { score, grade: score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D" };
}
var EWS_EQP_RULES = [
  { code: "EWS-EQP-01", fa: "\u062F\u0633\u062A\u0631\u0633\u200C\u067E\u0630\u06CC\u0631\u06CC \u0632\u06CC\u0631 \u06F8\u06F5\u066A", condition: "availability < 85", severity: "critical", escalateTo: "\u0645\u062F\u06CC\u0631 \u067E\u0631\u0648\u0698\u0647" },
  { code: "EWS-EQP-02", fa: "\u0628\u0647\u0631\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC \u0632\u06CC\u0631 \u0622\u0633\u062A\u0627\u0646\u0647\u0654 \u062F\u0633\u062A\u0647", condition: "utilization < categoryLow", severity: "warning", escalateTo: "\u0645\u062F\u06CC\u0631 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A" },
  { code: "EWS-EQP-03", fa: "\u0633\u0631\u0648\u06CC\u0633 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u0645\u0639\u0648\u0642", condition: "pmOverdueDays > 0", severity: "critical", escalateTo: "\u0631\u0626\u06CC\u0633 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC" },
  { code: "EWS-EQP-04", fa: "\u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0627\u0632", condition: "criticalBacklog > 0", severity: "critical", escalateTo: "\u0645\u062F\u06CC\u0631 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A" },
  { code: "EWS-EQP-05", fa: "\u0645\u0635\u0631\u0641 \u0633\u0648\u062E\u062A \u0628\u0627\u0644\u0627\u062A\u0631 \u0627\u0632 \u0645\u0639\u06CC\u0627\u0631", condition: "sfc > benchmark * 1.15", severity: "warning", escalateTo: "\u0633\u0631\u067E\u0631\u0633\u062A \u06A9\u0627\u0631\u06AF\u0627\u0647" },
  { code: "EWS-EQP-06", fa: "\u0627\u0646\u0642\u0636\u0627\u06CC \u0627\u062C\u0627\u0631\u0647/\u0628\u06CC\u0645\u0647/\u0645\u0639\u0627\u06CC\u0646\u0647 \u0641\u0646\u06CC", condition: "daysToExpiry <= 14", severity: "warning", escalateTo: "\u0627\u0645\u0648\u0631 \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u0647\u0627" }
];
function ewsEqp(input) {
  const out = [];
  const push = (rule, message) => out.push({ code: rule.code, rule: rule.code, severity: rule.severity, message, escalateTo: rule.escalateTo });
  if (input.availabilityPct < 85) push(EWS_EQP_RULES[0], `\u062F\u0633\u062A\u0631\u0633\u200C\u067E\u0630\u06CC\u0631\u06CC ${round2(input.availabilityPct)}\u066A \u0632\u06CC\u0631 \u062D\u062F \u06F8\u06F5\u066A \u0627\u0633\u062A`);
  if (input.utilizationPct < input.utilLowPct) push(EWS_EQP_RULES[1], `\u0628\u0647\u0631\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC ${round2(input.utilizationPct)}\u066A \u0632\u06CC\u0631 \u0622\u0633\u062A\u0627\u0646\u0647\u0654 ${input.utilLowPct}\u066A \u062F\u0633\u062A\u0647 \u0627\u0633\u062A`);
  if (input.pmOverdueDays > 0) push(EWS_EQP_RULES[2], `\u0633\u0631\u0648\u06CC\u0633 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC ${input.pmOverdueDays} \u0631\u0648\u0632 \u0645\u0639\u0648\u0642 \u0627\u0633\u062A`);
  if (input.criticalBacklog > 0) push(EWS_EQP_RULES[3], `${input.criticalBacklog} \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0627\u0632 \u062F\u0627\u0631\u062F`);
  if (input.sfc !== void 0 && input.sfcBenchmark !== void 0 && input.sfcBenchmark > 0 && input.sfc > input.sfcBenchmark * 1.15) {
    push(EWS_EQP_RULES[4], `\u0645\u0635\u0631\u0641 \u0648\u06CC\u0698\u0647 \u0633\u0648\u062E\u062A ${input.sfc} \u0644\u06CC\u062A\u0631/\u0633\u0627\u0639\u062A \u0628\u0627\u0644\u0627\u062A\u0631 \u0627\u0632 \u0645\u0639\u06CC\u0627\u0631 ${input.sfcBenchmark} \u0627\u0633\u062A`);
  }
  if (input.daysToExpiry !== void 0 && input.daysToExpiry <= 14) {
    push(EWS_EQP_RULES[5], `\u0645\u062F\u0627\u0631\u06A9/\u0642\u0631\u0627\u0631\u062F\u0627\u062F \u062A\u0627 ${input.daysToExpiry} \u0631\u0648\u0632 \u062F\u06CC\u06AF\u0631 \u0645\u0646\u0642\u0636\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F`);
  }
  return out;
}
function fleetKpiBoard(input) {
  const totalWork = round2(input.metrics.reduce((s, m) => s + m.workHours, 0));
  const totalDown = round2(input.metrics.reduce((s, m) => s + m.downtimeHrs, 0));
  const periodHours = Math.max(1, input.periodDays * 24) * Math.max(1, input.equipment.length);
  const av = availability(totalDown, periodHours);
  const ut = utilization(totalWork, Math.max(1, input.periodDays) * Math.max(1, input.equipment.length), 8);
  const measurable = input.actualOutput !== void 0 && (input.ratedOutputPerHour ?? 0) > 0;
  const o = measurable ? oee({
    downtimeHours: totalDown,
    periodHours,
    workHours: totalWork,
    actualOutput: input.actualOutput,
    ratedOutputPerHour: input.ratedOutputPerHour
  }) : null;
  const reliabilityMtbf = mtbf(input.orders, periodHours, totalDown);
  const repair = mttr(input.orders);
  const mcr = maintenanceCostRatio(input.maintenanceCost, input.assetValue);
  const pmc = pmCompliance(input.orders, input.plannedPmCount);
  const sfcResult = specificFuelConsumption(input.fuelLitres, totalWork);
  const backlog = maintenanceBacklog(input.orders);
  const health = equipmentHealthScore({
    availabilityPct: av.rate,
    utilizationPct: ut.rate,
    pmCompliancePct: pmc.rate,
    criticalBacklog: backlog.byPriority.critical,
    agingRatio: 0.3
  });
  return {
    availability: av.rate,
    utilization: ut.rate,
    oee: o ? o.oee : null,
    mtbfHours: reliabilityMtbf ? reliabilityMtbf.mtbfHours : null,
    mttrHours: repair ? repair.mttrHours : null,
    maintenanceCostRatio: mcr.ratio,
    pmCompliance: pmc.rate,
    sfc: sfcResult.sfc,
    healthScore: health.score,
    grade: health.grade
  };
}
var EQP_REPORT_VERSION = "eqp-rpt-v1";
var EQP_REPORT_CATALOG = [
  { code: "RPT-EQP-DSP", title: { fa: "\u0628\u0631\u06AF\u0647 \u062F\u06CC\u0633\u067E\u0686 \u0631\u0648\u0632\u0627\u0646\u0647", en: "Daily Dispatch Sheet" }, periodicity: "daily", audiences: ["internal", "official"], purpose: { fa: "\u062A\u062E\u0635\u06CC\u0635 \u0631\u0648\u0632\u0627\u0646\u0647 \u0645\u0627\u0634\u06CC\u0646 \u0648 \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u0628\u0627 \u0646\u062A\u06CC\u062C\u0647 \u062F\u0631\u0648\u0627\u0632\u0647\u200C\u0647\u0627\u06CC \u067E\u06CC\u0634\u200C\u0646\u06CC\u0627\u0632", en: "daily machine and operator assignment with gate results" } },
  { code: "RPT-EQP-CARD", title: { fa: "\u06A9\u0627\u0631\u062A \u0634\u0646\u0627\u0633\u0646\u0627\u0645\u0647 \u0645\u0627\u0634\u06CC\u0646", en: "Equipment ID Card" }, periodicity: "adhoc", audiences: ["internal", "official"], purpose: { fa: "\u0645\u0634\u062E\u0635\u0627\u062A \u0641\u0646\u06CC\u060C \u062A\u0627\u06A9\u0633\u0648\u0646\u0648\u0645\u06CC\u060C \u0627\u0631\u0632\u0634 \u062F\u0641\u062A\u0631\u06CC \u0648 \u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u062A\u0639\u0645\u06CC\u0631\u0627\u062A \u06CC\u06A9 \u0645\u0627\u0634\u06CC\u0646", en: "specs, taxonomy, book value and maintenance history of one machine" } },
  { code: "RPT-EQP-MNT", title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u062A\u0639\u0645\u06CC\u0631\u0627\u062A", en: "Periodic Maintenance Report" }, periodicity: "monthly", audiences: ["internal", "official"], purpose: { fa: "\u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631\u0647\u0627\u060C \u062A\u0648\u0642\u0641\u060C \u0627\u0646\u0637\u0628\u0627\u0642 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0648 \u062A\u0648\u0632\u06CC\u0639 \u067E\u0627\u0631\u062A\u0648 \u0639\u0644\u0644 \u062E\u0631\u0627\u0628\u06CC", en: "work orders, downtime, PM compliance and failure Pareto" } },
  { code: "RPT-EQP-PERF", title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0628\u0647\u0631\u0647\u200C\u0648\u0631\u06CC \u0646\u0627\u0648\u06AF\u0627\u0646", en: "Fleet Performance Report" }, periodicity: "monthly", audiences: ["internal", "official"], purpose: { fa: "\u0647\u0634\u062A \u0634\u0627\u062E\u0635\u060C OEE\u060C \u0646\u0645\u0631\u0647 \u0633\u0644\u0627\u0645\u062A \u0648 \u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u0632\u0648\u062F\u0647\u0646\u06AF\u0627\u0645", en: "eight KPIs, OEE, health score and early warnings" } },
  { code: "RPT-EQP-COST", title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u062A\u062E\u0635\u06CC\u0635 \u0647\u0632\u06CC\u0646\u0647 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", en: "Equipment Cost Allocation Report" }, periodicity: "monthly", audiences: ["internal", "official"], purpose: { fa: "\u0647\u0632\u06CC\u0646\u0647 \u0627\u062C\u0627\u0631\u0647\u060C \u062A\u0639\u0645\u06CC\u0631\u0627\u062A \u0648 \u0633\u0648\u062E\u062A \u0628\u0647 \u062A\u0641\u06A9\u06CC\u06A9 \u0645\u0627\u0634\u06CC\u0646 \u0648 \u0647\u0632\u06CC\u0646\u0647 \u0628\u0631 \u0633\u0627\u0639\u062A", en: "rental, maintenance and fuel cost per machine and cost per hour" } },
  { code: "RPT-EQP-PART", title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0645\u0648\u062C\u0648\u062F\u06CC \u0648 \u0633\u0641\u0627\u0631\u0634 \u0642\u0637\u0639\u0627\u062A", en: "Spare Parts Stock & Reorder Report" }, periodicity: "monthly", audiences: ["internal"], purpose: { fa: "\u0645\u0648\u062C\u0648\u062F\u06CC\u060C \u0646\u0642\u0637\u0647 \u0633\u0641\u0627\u0631\u0634 \u0648 \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062E\u0631\u06CC\u062F", en: "stock, reorder point and draft purchase requisition" } },
  { code: "RPT-EQP-EXEC", title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u06CC\u06A9\u200C\u0635\u0641\u062D\u0647\u200C\u0627\u06CC \u0645\u062F\u06CC\u0631\u0639\u0627\u0645\u0644", en: "Executive One-Pager" }, periodicity: "monthly", audiences: ["internal", "official"], purpose: { fa: "\u0634\u0634 \u0628\u0644\u0648\u06A9 \u062A\u0635\u0645\u06CC\u0645\u200C\u0633\u0627\u0632 \u0631\u0648\u06CC \u06CC\u06A9 \u0628\u0631\u06AF A4 \u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u0639\u0627\u0645\u0644", en: "six decision blocks on a single A4 sheet for the CEO" } }
];
var EQP_REPORT_BY_CODE = Object.fromEntries(
  EQP_REPORT_CATALOG.map((r) => [r.code, r])
);
var rcol = (key, fa, en, format = "text") => ({
  key,
  title: { fa, en },
  format
});
function pct(n) {
  return n === null ? "\u2014" : `${round2(n)}\u066A`;
}
function toneOf(value, target, direction) {
  if (value === null) return "warn";
  const ok = direction === "higher" ? value >= target : value <= target;
  if (ok) return "good";
  const margin = direction === "higher" ? value >= target * 0.85 : value <= target * 1.15;
  return margin ? "warn" : "bad";
}
function buildDispatchSheetReport(input) {
  const total = input.rows.length;
  const approved = input.rows.filter((r) => r.dispatch.Status === "approved" || r.dispatch.Status === "executed").length;
  const blocked = input.rows.filter((r) => r.check && !r.check.allowed).length;
  const hours = round2(input.rows.reduce((s, r) => s + (Number(r.dispatch.PlannedHours) || 0), 0));
  return {
    code: "RPT-EQP-DSP",
    title: { fa: "\u0628\u0631\u06AF\u0647 \u062F\u06CC\u0633\u067E\u0686 \u0631\u0648\u0632\u0627\u0646\u0647 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", en: "Daily Equipment Dispatch Sheet" },
    periodicity: "daily",
    sourceModule: `${EQM_DOMAIN_ID} \xB7 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `\u062E\u0644\u0627\u0635\u0647 \u062F\u06CC\u0633\u067E\u0686 ${input.dateIso}`, en: `Dispatch summary ${input.dateIso}` },
        cells: [
          { label: { fa: "\u0628\u0631\u06AF\u0647 \u0635\u0627\u062F\u0631\u0634\u062F\u0647", en: "Sheets issued" }, value: String(total) },
          { label: { fa: "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647", en: "Approved" }, value: String(approved), tone: approved === total ? "good" : "warn" },
          { label: { fa: "\u0645\u0633\u062F\u0648\u062F \u062A\u0648\u0633\u0637 \u062F\u0631\u0648\u0627\u0632\u0647", en: "Gate-blocked" }, value: String(blocked), tone: blocked > 0 ? "bad" : "good" },
          { label: { fa: "\u0633\u0627\u0639\u062A \u0628\u0631\u0646\u0627\u0645\u0647", en: "Planned hours" }, value: String(hours) }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u062A\u062E\u0635\u06CC\u0635 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", en: "Equipment assignment" },
        note: { fa: "\u0647\u0631 \u0628\u0631\u06AF\u0647 \u067E\u06CC\u0634 \u0627\u0632 \u0627\u062C\u0631\u0627 \u0627\u0632 \u062F\u0631\u0648\u0627\u0632\u0647\u200C\u0647\u0627\u06CC \u067E\u06CC\u0634\u200C\u0646\u06CC\u0627\u0632 \u0639\u0628\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F", en: "each sheet passes precondition gates before execution" },
        columns: [
          rcol("code", "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", "Machine code"),
          rcol("name", "\u0646\u0627\u0645 \u0645\u0627\u0634\u06CC\u0646", "Machine"),
          rcol("shift", "\u0634\u06CC\u0641\u062A", "Shift"),
          rcol("operator", "\u0627\u067E\u0631\u0627\u062A\u0648\u0631", "Operator"),
          rcol("site", "\u0645\u062D\u0644 \u06A9\u0627\u0631", "Site"),
          rcol("activity", "\u0641\u0639\u0627\u0644\u06CC\u062A", "Activity"),
          rcol("hours", "\u0633\u0627\u0639\u062A", "Hours", "number"),
          rcol("qty", "\u062D\u062C\u0645 \u0628\u0631\u0646\u0627\u0645\u0647", "Planned qty", "number"),
          rcol("status", "\u0648\u0636\u0639\u06CC\u062A", "Status"),
          rcol("gate", "\u062F\u0631\u0648\u0627\u0632\u0647", "Gate")
        ],
        rows: input.rows.map((r) => ({
          code: r.equipmentCode,
          name: r.equipmentName,
          shift: r.dispatch.Shift,
          operator: r.dispatch.OperatorId ?? "\u2014",
          site: r.dispatch.SiteFa ?? "\u2014",
          activity: r.dispatch.ActivityId ?? "\u2014",
          hours: r.dispatch.PlannedHours,
          qty: r.dispatch.PlannedQty ?? "\u2014",
          status: r.dispatch.Status,
          gate: r.check ? r.check.allowed ? "\u0645\u062C\u0627\u0632" : `${r.check.blockers} \u0645\u0627\u0646\u0639` : "\u2014"
        }))
      },
      {
        kind: "table",
        title: { fa: "\u062F\u0631\u0648\u0627\u0632\u0647\u200C\u0647\u0627\u06CC \u0646\u0627\u0645\u0648\u0641\u0642", en: "Failed gates" },
        columns: [rcol("machine", "\u0645\u0627\u0634\u06CC\u0646", "Machine"), rcol("gate", "\u062F\u0631\u0648\u0627\u0632\u0647", "Gate"), rcol("kind", "\u0646\u0648\u0639", "Kind"), rcol("msg", "\u0634\u0631\u062D", "Detail")],
        rows: input.rows.flatMap(
          (r) => (r.check?.gates ?? []).filter((g) => !g.passed).map((g) => ({
            machine: r.equipmentCode,
            gate: g.code,
            kind: g.blocking ? "\u0645\u0633\u062F\u0648\u062F\u06A9\u0646\u0646\u062F\u0647" : "\u0647\u0634\u062F\u0627\u0631",
            msg: g.message
          }))
        )
      }
    ]
  };
}
function buildEquipmentIdCardReport(input) {
  const cat = CATEGORY_BY_CODE[input.equipment.Category] ?? CATEGORY_BY_CODE["OTH"];
  const age = equipmentAge(input.equipment.CommissionedAt, input.nowIso);
  const dep = input.equipment.PurchaseValue !== void 0 ? straightLineDepreciation(Number(input.equipment.PurchaseValue), Number(input.equipment.SalvageValue ?? 0), cat.economicLifeYears, age.years) : null;
  const lastMeter = [...input.meters].sort((a, b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];
  return {
    code: "RPT-EQP-CARD",
    title: { fa: `\u06A9\u0627\u0631\u062A \u0634\u0646\u0627\u0633\u0646\u0627\u0645\u0647 \u0645\u0627\u0634\u06CC\u0646 ${input.equipment.Code}`, en: `Equipment ID Card ${input.equipment.Code}` },
    periodicity: "adhoc",
    sourceModule: `${EQM_DOMAIN_ID} \xB7 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "\u0634\u0646\u0627\u0633\u0647 \u0648 \u0648\u0636\u0639\u06CC\u062A", en: "Identity & status" },
        cells: [
          { label: { fa: "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", en: "Code" }, value: input.equipment.Code },
          { label: { fa: "\u062A\u0627\u06A9\u0633\u0648\u0646\u0648\u0645\u06CC ISO 14224", en: "ISO 14224" }, value: iso14224Code(input.equipment.Category) },
          { label: { fa: "\u0633\u0646 (\u0633\u0627\u0644)", en: "Age (yr)" }, value: String(age.years), tone: age.years >= cat.economicLifeYears ? "bad" : "good" },
          { label: { fa: "\u0633\u0627\u0639\u062A\u200C\u0634\u0645\u0627\u0631", en: "Hour meter" }, value: lastMeter ? String(lastMeter.HourMeter) : "\u2014" }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u0645\u0634\u062E\u0635\u0627\u062A \u0641\u0646\u06CC", en: "Technical specification" },
        columns: [rcol("field", "\u0639\u0646\u0648\u0627\u0646", "Field"), rcol("value", "\u0645\u0642\u062F\u0627\u0631", "Value")],
        rows: [
          { field: "\u0646\u0627\u0645", value: input.equipment.NameFa },
          { field: "\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC", value: `${cat.fa} (${cat.code})` },
          { field: "\u0633\u0627\u0632\u0646\u062F\u0647 / \u0645\u062F\u0644", value: `${input.equipment.BrandFa ?? "\u2014"} / ${input.equipment.Model ?? "\u2014"}` },
          { field: "\u0633\u0627\u0644 \u0633\u0627\u062E\u062A", value: input.equipment.Year ?? "\u2014" },
          { field: "\u0638\u0631\u0641\u06CC\u062A", value: input.equipment.Capacity !== void 0 ? `${input.equipment.Capacity} ${input.equipment.CapacityUom ?? ""}` : "\u2014" },
          { field: "\u0646\u0648\u0639 \u0645\u0627\u0644\u06A9\u06CC\u062A", value: input.equipment.Ownership },
          { field: "\u062A\u0627\u0631\u06CC\u062E \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC", value: input.equipment.CommissionedAt ?? "\u2014" },
          { field: "\u0645\u062D\u0644 \u0627\u0633\u062A\u0642\u0631\u0627\u0631", value: input.equipment.LocationFa ?? "\u2014" },
          { field: "\u0639\u0645\u0631 \u0627\u0642\u062A\u0635\u0627\u062F\u06CC (\u0633\u0627\u0644)", value: cat.economicLifeYears },
          { field: "\u0634\u0646\u0627\u0633\u0647 \u0627\u0633\u06A9\u0646", value: equipmentQrPayload(input.equipment) },
          { field: "\u0627\u0631\u0632\u0634 \u062E\u0631\u06CC\u062F", value: input.equipment.PurchaseValue ?? "\u2014" },
          { field: "\u0627\u0631\u0632\u0634 \u062F\u0641\u062A\u0631\u06CC", value: dep ? dep.bookValue : "\u2014" },
          { field: "\u0627\u0633\u062A\u0647\u0644\u0627\u06A9 \u0627\u0646\u0628\u0627\u0634\u062A\u0647", value: dep ? dep.accumulated : "\u2014" },
          { field: "\u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0627\u062C\u0627\u0631\u0647", value: input.rental ? `${input.rental.ContractNo ?? "\u2014"} \xB7 ${input.rental.Supplier ?? "\u2014"}` : "\u0645\u0644\u06A9\u06CC" }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u062A\u0639\u0645\u06CC\u0631\u0627\u062A", en: "Maintenance history" },
        columns: [
          rcol("code", "\u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631", "Work order"),
          rcol("kind", "\u0646\u0648\u0639", "Kind"),
          rcol("priority", "\u0627\u0648\u0644\u0648\u06CC\u062A", "Priority"),
          rcol("reported", "\u062A\u0627\u0631\u06CC\u062E \u06AF\u0632\u0627\u0631\u0634", "Reported", "date"),
          rcol("status", "\u0648\u0636\u0639\u06CC\u062A", "Status"),
          rcol("cost", "\u0647\u0632\u06CC\u0646\u0647", "Cost", "currency"),
          rcol("desc", "\u0634\u0631\u062D", "Description")
        ],
        rows: [...input.orders].sort((a, b) => String(b.ReportedAt).localeCompare(String(a.ReportedAt))).map((o) => ({
          code: o.Code,
          kind: o.Kind,
          priority: o.Priority,
          reported: o.ReportedAt,
          status: o.Status,
          cost: o.Cost ?? 0,
          desc: o.DescriptionFa ?? "\u2014"
        }))
      }
    ]
  };
}
function buildMaintenanceReport(input) {
  const backlog = maintenanceBacklog(input.orders);
  const repair = mttr(input.orders);
  const between = mtbf(input.orders, input.periodHours, input.downtimeHrs);
  const compliance = pmCompliance(input.orders, input.plannedPmCount);
  const pareto = rcaPareto(input.orders);
  const totalCost = round2(input.orders.reduce((s, o) => s + (Number(o.Cost) || 0), 0));
  return {
    code: "RPT-EQP-MNT",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u062A\u0639\u0645\u06CC\u0631\u0627\u062A \u0648 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC", en: "Periodic Maintenance Report" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} \xB7 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `\u0634\u0627\u062E\u0635\u200C\u0647\u0627\u06CC \u062F\u0648\u0631\u0647 ${input.fromIso} \u062A\u0627 ${input.toIso}`, en: `Period indicators ${input.fromIso} to ${input.toIso}` },
        cells: [
          { label: { fa: "\u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u0627\u0632", en: "Open orders" }, value: String(backlog.total), tone: backlog.total > 0 ? "warn" : "good" },
          { label: { fa: "\u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0627\u0632", en: "Critical open" }, value: String(backlog.byPriority.critical), tone: backlog.byPriority.critical > 0 ? "bad" : "good" },
          { label: { fa: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0632\u0645\u0627\u0646 \u062A\u0639\u0645\u06CC\u0631", en: "MTTR" }, value: repair ? `${repair.mttrHours} \u0633\u0627\u0639\u062A` : "\u2014", tone: toneOf(repair ? repair.mttrHours : null, 8, "lower") },
          { label: { fa: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0628\u06CC\u0646 \u062E\u0631\u0627\u0628\u06CC", en: "MTBF" }, value: between ? `${between.mtbfHours} \u0633\u0627\u0639\u062A` : "\u2014", tone: toneOf(between ? between.mtbfHours : null, 500, "higher") },
          { label: { fa: "\u0627\u0646\u0637\u0628\u0627\u0642 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC", en: "PM compliance" }, value: pct(compliance.rate), tone: toneOf(compliance.rate, 90, "higher") },
          { label: { fa: "\u0647\u0632\u06CC\u0646\u0647 \u062A\u0639\u0645\u06CC\u0631\u0627\u062A", en: "Maintenance cost" }, value: String(totalCost) }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631\u0647\u0627\u06CC \u062F\u0648\u0631\u0647", en: "Work orders in period" },
        columns: [
          rcol("code", "\u06A9\u062F", "Code"),
          rcol("machine", "\u0645\u0627\u0634\u06CC\u0646", "Machine"),
          rcol("kind", "\u0646\u0648\u0639", "Kind"),
          rcol("priority", "\u0627\u0648\u0644\u0648\u06CC\u062A", "Priority"),
          rcol("reported", "\u06AF\u0632\u0627\u0631\u0634", "Reported", "date"),
          rcol("down", "\u062A\u0648\u0642\u0641 (\u0633\u0627\u0639\u062A)", "Downtime (h)", "number"),
          rcol("status", "\u0648\u0636\u0639\u06CC\u062A", "Status"),
          rcol("cost", "\u0647\u0632\u06CC\u0646\u0647", "Cost", "currency")
        ],
        rows: input.orders.map((o) => ({
          code: o.Code,
          machine: input.equipmentNameById[o.EquipmentId] ?? o.EquipmentId,
          kind: o.Kind,
          priority: o.Priority,
          reported: o.ReportedAt,
          down: o.DownFrom && o.DownTo ? hoursBetween(o.DownFrom, o.DownTo) : 0,
          status: o.Status,
          cost: o.Cost ?? 0
        }))
      },
      {
        kind: "table",
        title: { fa: "\u062A\u062D\u0644\u06CC\u0644 \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC \u062E\u0631\u0627\u0628\u06CC (ISO 14224)", en: "Failure root-cause analysis (ISO 14224)" },
        note: { fa: "\u062A\u0648\u0632\u06CC\u0639 \u067E\u0627\u0631\u062A\u0648 \u2014 \u062A\u0645\u0631\u06A9\u0632 \u0628\u0631 \u0639\u0644\u0644 \u0635\u062F\u0631 \u062C\u062F\u0648\u0644 \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u06A9\u0627\u0647\u0634 \u062A\u0648\u0642\u0641 \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F", en: "Pareto distribution \u2014 top causes yield the largest downtime reduction" },
        columns: [rcol("cause", "\u0639\u0644\u062A \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC", "Root cause"), rcol("count", "\u062A\u0639\u062F\u0627\u062F", "Count", "number"), rcol("pct", "\u0633\u0647\u0645", "Share", "percent"), rcol("cum", "\u062A\u062C\u0645\u0639\u06CC", "Cumulative", "percent")],
        rows: pareto.map((p) => ({
          cause: RCA_CAUSE_FA[p.cause] ?? p.cause,
          count: p.count,
          pct: p.pct,
          cum: p.cumulativePct
        }))
      }
    ]
  };
}
function buildFleetPerformanceReport(input) {
  const kpiValue = (code) => {
    switch (code) {
      case "K-EQP-AVAIL":
        return input.board.availability;
      case "K-EQP-UTIL":
        return input.board.utilization;
      case "K-EQP-OEE":
        return input.board.oee;
      case "K-EQP-MTBF":
        return input.board.mtbfHours;
      case "K-EQP-MTTR":
        return input.board.mttrHours;
      case "K-EQP-MCR":
        return input.board.maintenanceCostRatio;
      case "K-EQP-PMC":
        return input.board.pmCompliance;
      default:
        return input.board.sfc;
    }
  };
  return {
    code: "RPT-EQP-PERF",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u062A\u062D\u0644\u06CC\u0644\u06CC \u0628\u0647\u0631\u0647\u200C\u0648\u0631\u06CC \u0646\u0627\u0648\u06AF\u0627\u0646", en: "Fleet Performance Analytical Report" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} \xB7 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `\u0634\u0627\u062E\u0635\u200C\u0647\u0627\u06CC \u06A9\u0644\u06CC\u062F\u06CC ${input.fromIso} \u062A\u0627 ${input.toIso}`, en: `Key indicators ${input.fromIso} to ${input.toIso}` },
        cells: [
          { label: { fa: "\u062F\u0633\u062A\u0631\u0633\u200C\u067E\u0630\u06CC\u0631\u06CC", en: "Availability" }, value: pct(input.board.availability), tone: toneOf(input.board.availability, 95, "higher") },
          { label: { fa: "\u0628\u0647\u0631\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC", en: "Utilization" }, value: pct(input.board.utilization), tone: toneOf(input.board.utilization, 70, "higher") },
          { label: { fa: "\u0627\u062B\u0631\u0628\u062E\u0634\u06CC \u06A9\u0644\u06CC (OEE)", en: "OEE" }, value: pct(input.board.oee), tone: toneOf(input.board.oee, 65, "higher") },
          { label: { fa: "\u0646\u0645\u0631\u0647 \u0633\u0644\u0627\u0645\u062A \u0646\u0627\u0648\u06AF\u0627\u0646", en: "Fleet health score" }, value: `${input.healthScore} (${input.healthGrade})`, tone: input.healthGrade === "A" ? "good" : input.healthGrade === "D" ? "bad" : "warn" }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u062A\u0627\u0628\u0644\u0648\u06CC \u0647\u0634\u062A \u0634\u0627\u062E\u0635 \u062F\u0631 \u0628\u0631\u0627\u0628\u0631 \u0647\u062F\u0641", en: "Eight-KPI board versus target" },
        note: { fa: "\u0647\u062F\u0641 \u0647\u0631 \u0634\u0627\u062E\u0635 \u0627\u0632 \u06A9\u0627\u062A\u0627\u0644\u0648\u06AF \u0645\u0648\u062A\u0648\u0631 \u0645\u06CC\u200C\u0622\u06CC\u062F\u061B OEE \u0628\u062F\u0648\u0646 \u062B\u0628\u062A \u062A\u0648\u0644\u06CC\u062F \u0648\u0627\u0642\u0639\u06CC \u0633\u0646\u062C\u0634\u200C\u0646\u0627\u067E\u0630\u06CC\u0631 \u0627\u0633\u062A", en: "targets come from the engine catalog; OEE is not measurable without actual output" },
        columns: [
          rcol("code", "\u06A9\u062F", "Code"),
          rcol("kpi", "\u0634\u0627\u062E\u0635", "KPI"),
          rcol("value", "\u0645\u0642\u062F\u0627\u0631", "Value", "number"),
          rcol("unit", "\u0648\u0627\u062D\u062F", "Unit"),
          rcol("target", "\u0647\u062F\u0641", "Target", "number"),
          rcol("verdict", "\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC", "Verdict")
        ],
        rows: EQP_KPI_CATALOG.map((k) => {
          const v = kpiValue(k.code);
          const ok = v === null ? null : k.direction === "higher" ? v >= k.target : v <= k.target;
          return {
            code: k.code,
            kpi: k.fa,
            value: v === null ? "\u0633\u0646\u062C\u0634\u200C\u0646\u0627\u067E\u0630\u06CC\u0631" : v,
            unit: k.unit,
            target: `${k.direction === "higher" ? "\u2265" : "\u2264"} ${k.target}`,
            verdict: ok === null ? "\u0628\u062F\u0648\u0646 \u062F\u0627\u062F\u0647" : ok ? "\u062F\u0631 \u0647\u062F\u0641" : "\u062E\u0627\u0631\u062C \u0627\u0632 \u0647\u062F\u0641"
          };
        })
      },
      {
        kind: "table",
        title: { fa: "\u06A9\u0627\u0631\u0646\u0627\u0645\u0647 \u0647\u0631 \u0645\u0627\u0634\u06CC\u0646", en: "Per-machine scorecard" },
        columns: [
          rcol("code", "\u06A9\u062F", "Code"),
          rcol("name", "\u0645\u0627\u0634\u06CC\u0646", "Machine"),
          rcol("hours", "\u06A9\u0627\u0631\u06A9\u0631\u062F (\u0633\u0627\u0639\u062A)", "Work hours", "number"),
          rcol("util", "\u0628\u0647\u0631\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC", "Utilization", "percent"),
          rcol("avail", "\u062F\u0633\u062A\u0631\u0633\u200C\u067E\u0630\u06CC\u0631\u06CC", "Availability", "percent"),
          rcol("down", "\u062A\u0648\u0642\u0641 (\u0633\u0627\u0639\u062A)", "Downtime (h)", "number"),
          rcol("cph", "\u0647\u0632\u06CC\u0646\u0647 \u0628\u0631 \u0633\u0627\u0639\u062A", "Cost/hour", "currency")
        ],
        rows: input.perEquipment.map((e) => ({
          code: e.code,
          name: e.name,
          hours: e.workHours,
          util: e.utilization,
          avail: e.availability,
          down: e.downtimeHrs,
          cph: e.costPerHour ?? "\u2014"
        }))
      },
      {
        kind: "table",
        title: { fa: "\u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u0632\u0648\u062F\u0647\u0646\u06AF\u0627\u0645 \u0648 \u0645\u0627\u062A\u0631\u06CC\u0633 \u062A\u0634\u062F\u06CC\u062F", en: "Early warnings & escalation matrix" },
        columns: [rcol("code", "\u0642\u0627\u0639\u062F\u0647", "Rule"), rcol("sev", "\u0634\u062F\u062A", "Severity"), rcol("msg", "\u0634\u0631\u062D", "Message"), rcol("esc", "\u062A\u0634\u062F\u06CC\u062F \u0628\u0647", "Escalate to")],
        rows: input.alerts.map((a) => ({ code: a.code, sev: a.severity, msg: a.message, esc: a.escalateTo }))
      }
    ]
  };
}
function buildCostAllocationReport(input) {
  const enriched = input.rows.map((r) => {
    const cost = equipmentCostPerHour(r.workHours, {
      rentalCost: r.rentalCost,
      maintenanceCost: r.maintenanceCost,
      fuelCost: r.fuelCost
    });
    return { ...r, total: cost.totalCost, cph: cost.costPerHour };
  });
  const sum = (k) => round2(enriched.reduce((s, r) => s + r[k], 0));
  const totalHours = round2(enriched.reduce((s, r) => s + r.workHours, 0));
  const grand = sum("total");
  return {
    code: "RPT-EQP-COST",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u062A\u062E\u0635\u06CC\u0635 \u0647\u0632\u06CC\u0646\u0647 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", en: "Equipment Cost Allocation Report" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} \xB7 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `\u062C\u0645\u0639 \u0647\u0632\u06CC\u0646\u0647 \u062F\u0648\u0631\u0647 ${input.fromIso} \u062A\u0627 ${input.toIso}`, en: `Period cost totals ${input.fromIso} to ${input.toIso}` },
        cells: [
          { label: { fa: "\u0647\u0632\u06CC\u0646\u0647 \u0627\u062C\u0627\u0631\u0647", en: "Rental" }, value: String(sum("rentalCost")) },
          { label: { fa: "\u0647\u0632\u06CC\u0646\u0647 \u062A\u0639\u0645\u06CC\u0631\u0627\u062A", en: "Maintenance" }, value: String(sum("maintenanceCost")) },
          { label: { fa: "\u0647\u0632\u06CC\u0646\u0647 \u0633\u0648\u062E\u062A \u0648 \u0645\u0635\u0631\u0641\u06CC", en: "Fuel & consumables" }, value: String(sum("fuelCost")) },
          { label: { fa: "\u0647\u0632\u06CC\u0646\u0647 \u06A9\u0644 \u0646\u0627\u0648\u06AF\u0627\u0646", en: "Fleet total" }, value: String(grand) },
          { label: { fa: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0647\u0632\u06CC\u0646\u0647 \u0628\u0631 \u0633\u0627\u0639\u062A", en: "Average cost/hour" }, value: String(totalHours > 0 ? round2(grand / totalHours) : 0) }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u062A\u0641\u06A9\u06CC\u06A9 \u0647\u0632\u06CC\u0646\u0647 \u0628\u0647 \u062A\u0641\u06A9\u06CC\u06A9 \u0645\u0627\u0634\u06CC\u0646", en: "Cost breakdown per machine" },
        note: { fa: "\u0627\u06CC\u0646 \u0627\u0631\u0642\u0627\u0645 \u0645\u0631\u062C\u0639 \u062A\u062E\u0635\u06CC\u0635 \u0628\u0647 \u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647 \u062F\u0631 \u0645\u0627\u0698\u0648\u0644 \u0645\u0627\u0644\u06CC \u0627\u0633\u062A\u061B \u062B\u0628\u062A \u0633\u0646\u062F \u062F\u0631 \u0645\u0627\u0644\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F", en: "these figures feed cost account allocation in finance; the journal entry is made in finance" },
        columns: [
          rcol("code", "\u06A9\u062F", "Code"),
          rcol("name", "\u0645\u0627\u0634\u06CC\u0646", "Machine"),
          rcol("ca", "\u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647", "Cost account"),
          rcol("hours", "\u06A9\u0627\u0631\u06A9\u0631\u062F", "Hours", "number"),
          rcol("rent", "\u0627\u062C\u0627\u0631\u0647", "Rental", "currency"),
          rcol("mnt", "\u062A\u0639\u0645\u06CC\u0631\u0627\u062A", "Maintenance", "currency"),
          rcol("fuel", "\u0633\u0648\u062E\u062A", "Fuel", "currency"),
          rcol("total", "\u062C\u0645\u0639", "Total", "currency"),
          rcol("cph", "\u0647\u0632\u06CC\u0646\u0647/\u0633\u0627\u0639\u062A", "Cost/hour", "currency")
        ],
        rows: enriched.map((r) => ({
          code: r.code,
          name: r.name,
          ca: r.costAccount ?? "\u2014",
          hours: r.workHours,
          rent: r.rentalCost,
          mnt: r.maintenanceCost,
          fuel: r.fuelCost,
          total: r.total,
          cph: r.cph ?? "\u2014"
        }))
      }
    ]
  };
}
function buildSparePartsReport(input) {
  const all = input.parts.map((p) => ({ part: p, stock: partStockStatus(p, input.coverDays ?? 30) }));
  const need = partsToRequisition(input.parts, input.coverDays ?? 30);
  const value = round2(need.reduce((s, x) => s + x.stock.suggestedQty * (Number(x.part.UnitCost) || 0), 0));
  return {
    code: "RPT-EQP-PART",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u0645\u0648\u062C\u0648\u062F\u06CC \u0648 \u0633\u0641\u0627\u0631\u0634 \u0642\u0637\u0639\u0627\u062A \u06CC\u062F\u06A9\u06CC", en: "Spare Parts Stock & Reorder Report" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} \xB7 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A`,
    audiences: ["internal"],
    sections: [
      {
        kind: "kpi",
        title: { fa: "\u0648\u0636\u0639\u06CC\u062A \u0627\u0646\u0628\u0627\u0631", en: "Warehouse status" },
        cells: [
          { label: { fa: "\u0627\u0642\u0644\u0627\u0645 \u0627\u0646\u0628\u0627\u0631", en: "Stock items" }, value: String(all.length) },
          { label: { fa: "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0633\u0641\u0627\u0631\u0634", en: "To requisition" }, value: String(need.length), tone: need.length > 0 ? "warn" : "good" },
          { label: { fa: "\u06A9\u0645\u0628\u0648\u062F \u0628\u062D\u0631\u0627\u0646\u06CC", en: "Critical shortage" }, value: String(need.filter((x) => x.stock.critical && x.stock.status !== "reorder").length), tone: need.some((x) => x.stock.critical && x.stock.status !== "reorder") ? "bad" : "good" },
          { label: { fa: "\u0627\u0631\u0632\u0634 \u0633\u0641\u0627\u0631\u0634 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC", en: "Suggested order value" }, value: String(value) }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u0645\u0648\u062C\u0648\u062F\u06CC \u0648 \u0646\u0642\u0637\u0647 \u0633\u0641\u0627\u0631\u0634", en: "Stock & reorder point" },
        columns: [
          rcol("no", "\u06A9\u062F \u0642\u0637\u0639\u0647", "Part no."),
          rcol("name", "\u0646\u0627\u0645", "Name"),
          rcol("onhand", "\u0645\u0648\u062C\u0648\u062F\u06CC", "On hand", "number"),
          rcol("min", "\u062D\u062F\u0627\u0642\u0644", "Min", "number"),
          rcol("rop", "\u0646\u0642\u0637\u0647 \u0633\u0641\u0627\u0631\u0634", "ROP", "number"),
          rcol("cover", "\u067E\u0648\u0634\u0634 (\u0631\u0648\u0632)", "Cover (days)", "number"),
          rcol("status", "\u0648\u0636\u0639\u06CC\u062A", "Status"),
          rcol("sug", "\u0633\u0641\u0627\u0631\u0634 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC", "Suggested", "number")
        ],
        rows: all.map(({ part: p, stock }) => ({
          no: p.PartNo,
          name: `${p.NameFa}${stock.critical ? " (\u0628\u062D\u0631\u0627\u0646\u06CC)" : ""}`,
          onhand: p.OnHand,
          min: p.MinLevel,
          rop: stock.rop,
          cover: stock.daysOfCover >= 9999 ? "\u2014" : stock.daysOfCover,
          status: stock.status,
          sug: stock.suggestedQty
        }))
      }
    ]
  };
}
function eqpPublishGate(audience, blockers) {
  if (audience === "internal") return { ok: true, reasons: [], warnings: [] };
  const reasons = [];
  const warnings = [];
  if ((blockers.missingMeterReadings ?? 0) > 0) {
    reasons.push(`${blockers.missingMeterReadings} \u0645\u0627\u0634\u06CC\u0646 \u0628\u062F\u0648\u0646 \u0642\u0631\u0627\u0626\u062A \u0633\u0627\u0639\u062A\u200C\u0634\u0645\u0627\u0631 \u062F\u0631 \u062F\u0648\u0631\u0647 \u2014 \u0634\u0627\u062E\u0635\u200C\u0647\u0627 \u0642\u0627\u0628\u0644 \u0627\u062A\u06A9\u0627 \u0646\u06CC\u0633\u062A\u0646\u062F`);
  }
  if ((blockers.criticalOpen ?? 0) > 0) {
    reasons.push(`${blockers.criticalOpen} \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0627\u0632 \u2014 \u067E\u06CC\u0634 \u0627\u0632 \u0627\u0628\u0644\u0627\u063A \u0631\u0633\u0645\u06CC \u0628\u0627\u06CC\u062F \u062A\u0639\u06CC\u06CC\u0646 \u062A\u06A9\u0644\u06CC\u0641 \u0634\u0648\u062F`);
  }
  if ((blockers.pmOverdue ?? 0) > 0) {
    warnings.push(`${blockers.pmOverdue} \u0633\u0631\u0648\u06CC\u0633 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u0645\u0639\u0648\u0642 \u062F\u0631 \u06AF\u0632\u0627\u0631\u0634 \u062F\u0631\u062C \u0645\u06CC\u200C\u0634\u0648\u062F`);
  }
  if ((blockers.blockedDispatch ?? 0) > 0) {
    warnings.push(`${blockers.blockedDispatch} \u0628\u0631\u06AF\u0647 \u062F\u06CC\u0633\u067E\u0686 \u0645\u0633\u062F\u0648\u062F \u062F\u0631 \u062F\u0648\u0631\u0647`);
  }
  if ((blockers.criticalPartsOut ?? 0) > 0) {
    warnings.push(`${blockers.criticalPartsOut} \u0642\u0637\u0639\u0647 \u0628\u062D\u0631\u0627\u0646\u06CC \u0646\u0627\u0645\u0648\u062C\u0648\u062F`);
  }
  return { ok: reasons.length === 0, reasons, warnings };
}
function eqpReportRows(report) {
  return report.sections.reduce((s, sec) => s + (sec.kind === "table" ? sec.rows.length : 0), 0);
}
function buildExecutiveOnePager(input) {
  const variance = input.cost.budget > 0 ? round2((input.cost.actual - input.cost.budget) / input.cost.budget * 100) : null;
  const critical = input.alerts.filter((a) => a.severity === "critical");
  const verdict = (value, target, higher) => value === null ? "\u0633\u0646\u062C\u0634\u200C\u0646\u0627\u067E\u0630\u06CC\u0631" : (higher ? value >= target : value <= target) ? "\u062F\u0631 \u0647\u062F\u0641" : "\u062E\u0627\u0631\u062C \u0627\u0632 \u0647\u062F\u0641";
  return {
    code: "RPT-EQP-EXEC",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u06CC\u06A9\u200C\u0635\u0641\u062D\u0647\u200C\u0627\u06CC \u0645\u062F\u06CC\u0631\u0639\u0627\u0645\u0644 \u2014 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", en: "Equipment Executive One-Pager" },
    periodicity: "monthly",
    sourceModule: `${EQM_DOMAIN_ID} \xB7 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A`,
    audiences: ["internal", "official"],
    sections: [
      {
        kind: "kpi",
        title: { fa: `\u06F1 \xB7 \u062F\u0633\u062A\u0631\u0633\u200C\u067E\u0630\u06CC\u0631\u06CC \u0648 \u0627\u062B\u0631\u0628\u062E\u0634\u06CC \u0646\u0627\u0648\u06AF\u0627\u0646 ${input.fromIso} \u062A\u0627 ${input.toIso}`, en: "1 \xB7 Fleet availability & effectiveness" },
        cells: [
          { label: { fa: "\u062F\u0633\u062A\u0631\u0633\u200C\u067E\u0630\u06CC\u0631\u06CC", en: "Availability" }, value: input.board.availability === null ? "\u2014" : `${input.board.availability}\u066A` },
          { label: { fa: "\u0627\u062B\u0631\u0628\u062E\u0634\u06CC \u06A9\u0644\u06CC (OEE)", en: "OEE" }, value: input.board.oee === null ? "\u0633\u0646\u062C\u0634\u200C\u0646\u0627\u067E\u0630\u06CC\u0631" : `${input.board.oee}\u066A` },
          { label: { fa: "\u0646\u0645\u0631\u0647 \u0633\u0644\u0627\u0645\u062A \u0646\u0627\u0648\u06AF\u0627\u0646", en: "Fleet health" }, value: `${input.healthScore} (${input.healthGrade})` },
          { label: { fa: "\u0645\u0627\u0634\u06CC\u0646 \u0641\u0639\u0627\u0644", en: "Active machines" }, value: `${input.activeCount} \u0627\u0632 ${input.fleetSize}` }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u06F2 \xB7 \u0628\u0647\u0631\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC \u062F\u0631 \u0628\u0631\u0627\u0628\u0631 \u0628\u06CC\u06A9\u0627\u0631\u06CC", en: "2 \xB7 Utilization vs idle" },
        columns: [rcol("metric", "\u0633\u0646\u062C\u0647", "Metric"), rcol("value", "\u0645\u0642\u062F\u0627\u0631", "Value"), rcol("target", "\u0647\u062F\u0641", "Target"), rcol("verdict", "\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC", "Verdict")],
        rows: [
          { metric: "\u0628\u0647\u0631\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC", value: input.board.utilization === null ? "\u2014" : `${input.board.utilization}\u066A`, target: "\u2265 70\u066A", verdict: verdict(input.board.utilization, 70, true) },
          { metric: "\u0628\u06CC\u06A9\u0627\u0631\u06CC", value: input.board.utilization === null ? "\u2014" : `${round2(100 - input.board.utilization)}\u066A`, target: "\u2264 30\u066A", verdict: verdict(input.board.utilization, 70, true) },
          { metric: "\u0645\u0635\u0631\u0641 \u0648\u06CC\u0698\u0647 \u0633\u0648\u062E\u062A", value: input.board.sfc === null ? "\u2014" : `${input.board.sfc} \u0644/\u0633`, target: "\u2264 18", verdict: verdict(input.board.sfc, 18, false) }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u06F3 \xB7 \u062E\u0631\u0627\u0628\u06CC\u200C\u0647\u0627\u06CC \u0627\u0635\u0644\u06CC \u0648 \u0642\u0627\u0628\u0644\u06CC\u062A \u0627\u0637\u0645\u06CC\u0646\u0627\u0646", en: "3 \xB7 Top breakdowns & reliability" },
        columns: [rcol("item", "\u0642\u0644\u0645", "Item"), rcol("value", "\u0645\u0642\u062F\u0627\u0631", "Value")],
        rows: [
          { item: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0632\u0645\u0627\u0646 \u0628\u06CC\u0646 \u062E\u0631\u0627\u0628\u06CC (MTBF)", value: input.board.mtbfHours === null ? "\u0633\u0646\u062C\u0634\u200C\u0646\u0627\u067E\u0630\u06CC\u0631" : `${input.board.mtbfHours} \u0633\u0627\u0639\u062A` },
          { item: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0632\u0645\u0627\u0646 \u062A\u0639\u0645\u06CC\u0631 (MTTR)", value: input.board.mttrHours === null ? "\u0633\u0646\u062C\u0634\u200C\u0646\u0627\u067E\u0630\u06CC\u0631" : `${input.board.mttrHours} \u0633\u0627\u0639\u062A` },
          { item: "\u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u0627\u0632 (\u0628\u062D\u0631\u0627\u0646\u06CC)", value: `${input.backlog.total} (${input.backlog.byPriority.critical ?? 0})` },
          ...input.topCauses.slice(0, 3).map((c, i) => ({ item: `\u0639\u0644\u062A \u067E\u0631\u062A\u06A9\u0631\u0627\u0631 ${i + 1}: ${RCA_CAUSE_FA[c.cause] ?? String(c.cause)}`, value: `${c.count} \u0645\u0648\u0631\u062F \xB7 ${c.pct}\u066A` }))
        ]
      },
      {
        kind: "kpi",
        title: { fa: "\u06F4 \xB7 \u0627\u0646\u0637\u0628\u0627\u0642 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u067E\u06CC\u0634\u06AF\u06CC\u0631\u0627\u0646\u0647", en: "4 \xB7 PM compliance" },
        cells: [
          { label: { fa: "\u0627\u0646\u0637\u0628\u0627\u0642 PM", en: "PM compliance" }, value: input.board.pmCompliance === null ? "\u2014" : `${input.board.pmCompliance}\u066A` },
          { label: { fa: "\u0647\u062F\u0641", en: "Target" }, value: "\u2265 90\u066A" },
          { label: { fa: "\u0633\u0631\u0648\u06CC\u0633 \u0645\u0639\u0648\u0642", en: "Overdue services" }, value: String(input.pmOverdueCount) },
          { label: { fa: "\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC", en: "Verdict" }, value: verdict(input.board.pmCompliance, 90, true) }
        ]
      },
      {
        kind: "kpi",
        title: { fa: "\u06F5 \xB7 \u0647\u0632\u06CC\u0646\u0647 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u062F\u0631 \u0628\u0631\u0627\u0628\u0631 \u0628\u0648\u062F\u062C\u0647", en: "5 \xB7 Equipment cost vs budget" },
        cells: [
          { label: { fa: "\u0628\u0648\u062F\u062C\u0647 \u062F\u0648\u0631\u0647", en: "Budget" }, value: input.cost.budget > 0 ? String(round2(input.cost.budget)) : "\u062B\u0628\u062A \u0646\u0634\u062F\u0647" },
          { label: { fa: "\u0647\u0632\u06CC\u0646\u0647 \u0648\u0627\u0642\u0639\u06CC", en: "Actual" }, value: String(round2(input.cost.actual)) },
          { label: { fa: "\u0627\u0646\u062D\u0631\u0627\u0641", en: "Variance" }, value: variance === null ? "\u0633\u0646\u062C\u0634\u200C\u0646\u0627\u067E\u0630\u06CC\u0631" : `${variance}\u066A` },
          { label: { fa: "\u0646\u0633\u0628\u062A \u0647\u0632\u06CC\u0646\u0647 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC", en: "Maint. cost ratio" }, value: input.board.maintenanceCostRatio === null ? "\u2014" : `${input.board.maintenanceCostRatio}\u066A` }
        ]
      },
      {
        kind: "table",
        title: { fa: "\u06F6 \xB7 \u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u0628\u062D\u0631\u0627\u0646\u06CC \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0635\u0645\u06CC\u0645", en: "6 \xB7 Critical alerts requiring decision" },
        note: {
          fa: "\u062A\u0646\u0647\u0627 \u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u0628\u062D\u0631\u0627\u0646\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0628\u0631\u06AF \u0645\u06CC\u200C\u0622\u06CC\u0646\u062F\u061B \u0641\u0647\u0631\u0633\u062A \u06A9\u0627\u0645\u0644 \u062F\u0631 \u06AF\u0632\u0627\u0631\u0634 \u0628\u0647\u0631\u0647\u200C\u0648\u0631\u06CC \u0646\u0627\u0648\u06AF\u0627\u0646 \u0627\u0633\u062A",
          en: "only critical alerts appear here; the full list is in the fleet performance report"
        },
        columns: [rcol("code", "\u0642\u0627\u0639\u062F\u0647", "Rule"), rcol("msg", "\u0634\u0631\u062D", "Message"), rcol("esc", "\u062A\u0634\u062F\u06CC\u062F \u0628\u0647", "Escalate to")],
        rows: critical.length > 0 ? critical.map((a) => ({ code: a.code, msg: a.message, esc: a.escalateTo })) : [{ code: "\u2014", msg: "\u0647\u0634\u062F\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0641\u0639\u0627\u0644\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F", esc: "\u2014" }]
      }
    ]
  };
}
function isBlockingOrder(o) {
  return o.Priority === "critical" && (o.Status === "open" || o.Status === "in_progress");
}
function planActivityLocks(input) {
  const blockedEquipment = new Set(input.orders.filter(isBlockingOrder).map((o) => o.EquipmentId));
  const equipmentByActivity = /* @__PURE__ */ new Map();
  for (const d of input.dispatches) {
    if (!d.ActivityId) continue;
    if (d.Status === "cancelled" || d.Status === "rejected") continue;
    const list = equipmentByActivity.get(d.ActivityId) ?? [];
    if (!list.includes(d.EquipmentId)) list.push(d.EquipmentId);
    equipmentByActivity.set(d.ActivityId, list);
  }
  const plan = { lock: [], release: [], unchanged: 0 };
  const nameOf = (id) => input.equipmentNameById?.[id] ?? id;
  for (const a of input.activities) {
    const current = a.BlockedByEquipmentId || null;
    const offender = (equipmentByActivity.get(a.Id) ?? []).find((eid) => blockedEquipment.has(eid)) ?? null;
    if (offender && current !== offender) {
      plan.lock.push({
        activityId: a.Id,
        equipmentId: offender,
        reason: `\u0645\u0627\u0634\u06CC\u0646 ${nameOf(offender)} \u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0627\u0632 \u062F\u0627\u0631\u062F`
      });
    } else if (!offender && current) {
      plan.release.push({
        activityId: a.Id,
        equipmentId: current,
        reason: `\u062F\u0633\u062A\u0648\u0631\u06A9\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0645\u0627\u0634\u06CC\u0646 ${nameOf(current)} \u0628\u0633\u062A\u0647 \u0634\u062F`
      });
    } else {
      plan.unchanged += 1;
    }
  }
  return plan;
}
function buildCostPostings(input) {
  const byAccount = /* @__PURE__ */ new Map();
  const unallocated = [];
  for (const r of input.rows) {
    const amount = round2((r.rentalCost || 0) + (r.maintenanceCost || 0) + (r.fuelCost || 0));
    if (!r.costAccountId) {
      if (amount > 0) unallocated.push({ code: r.code, amount });
      continue;
    }
    const line = byAccount.get(r.costAccountId) ?? {
      costAccountId: r.costAccountId,
      periodCode: input.periodCode,
      rentalCost: 0,
      maintenanceCost: 0,
      fuelCost: 0,
      amount: 0,
      workHours: 0,
      equipmentCodes: [],
      memoFa: ""
    };
    line.rentalCost = round2(line.rentalCost + (r.rentalCost || 0));
    line.maintenanceCost = round2(line.maintenanceCost + (r.maintenanceCost || 0));
    line.fuelCost = round2(line.fuelCost + (r.fuelCost || 0));
    line.amount = round2(line.amount + amount);
    line.workHours = round2(line.workHours + (r.workHours || 0));
    if (!line.equipmentCodes.includes(r.code)) line.equipmentCodes.push(r.code);
    byAccount.set(r.costAccountId, line);
  }
  const postings = [...byAccount.values()].map((l) => ({
    ...l,
    memoFa: `\u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u062F\u0648\u0631\u0647 ${l.periodCode} \u2014 ${l.equipmentCodes.length} \u0645\u0627\u0634\u06CC\u0646\u060C ${l.workHours} \u0633\u0627\u0639\u062A (\u0627\u062C\u0627\u0631\u0647 ${l.rentalCost} / \u062A\u0639\u0645\u06CC\u0631 ${l.maintenanceCost} / \u0633\u0648\u062E\u062A ${l.fuelCost})`
  }));
  return { postings, unallocated };
}
function applyPostingToActual(currentActual, previousEqpShare, newEqpShare) {
  const base = (Number(currentActual) || 0) - (Number(previousEqpShare) || 0);
  return round2(Math.max(0, base) + (Number(newEqpShare) || 0));
}
export {
  CATEGORY_BY_CODE,
  CLASS_TO_ISO14224,
  DISPATCH_FLOW,
  DISPATCH_STATUSES,
  EQM_DOMAIN_ID,
  EQM_VERSION,
  EQP_KPI_BY_CODE,
  EQP_KPI_CATALOG,
  EQP_REPORT_BY_CODE,
  EQP_REPORT_CATALOG,
  EQP_REPORT_VERSION,
  EQP_VERSION,
  EQUIPMENT_CATEGORY_CATALOG,
  EQUIPMENT_STATUSES,
  EWS_EQP_RULES,
  FUEL_KINDS,
  ISO14224_BY_CODE,
  ISO14224_TAXONOMY,
  MAINTENANCE_KINDS,
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  OWNERSHIPS,
  PM_BASES,
  RATE_TYPES,
  RCA_CAUSES,
  RCA_CAUSE_FA,
  SHIFTS,
  WO_FLOW,
  WO_STAGES,
  applyPostingToActual,
  availability,
  buildCostAllocationReport,
  buildCostPostings,
  buildDispatchSheetReport,
  buildEquipmentIdCardReport,
  buildExecutiveOnePager,
  buildFleetPerformanceReport,
  buildMaintenanceReport,
  buildSparePartsReport,
  buyVsRent,
  canAdvanceDispatch,
  canAdvanceWo,
  daysBetween,
  dispatchPrecheck,
  downtimeHours,
  eqmEws,
  eqpPublishGate,
  eqpReportRows,
  equipmentAge,
  equipmentCostPerHour,
  equipmentHealthScore,
  equipmentQrPayload,
  ewsEqp,
  fleetKpiBoard,
  fleetSummary,
  fuelSummary,
  hoursBetween,
  isBlockingOrder,
  iso14224Code,
  maintenanceBacklog,
  maintenanceCostRatio,
  mtbf,
  mttr,
  nextPmDue,
  oee,
  partStockStatus,
  partsToRequisition,
  planActivityLocks,
  pmCompliance,
  pmDueByBasis,
  productivity,
  rcaPareto,
  rentalCostAccrued,
  reorderPoint,
  specificFuelConsumption,
  straightLineDepreciation,
  tco,
  utilization,
  validateDispatch,
  validateEquipment,
  validateFuelLog,
  validateMaintenanceOrder,
  validateMeter,
  validatePmSchedule,
  validateRental,
  validateSparePart,
  woStageToStatus,
  workHoursSum
};
