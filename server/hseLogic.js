// src/services/hse.ts
var PERMIT_TYPES = ["hot", "cold", "confined", "height", "electrical", "excavation", "lifting"];
var PERMIT_TYPE_FA = {
  hot: "\u06A9\u0627\u0631 \u06AF\u0631\u0645",
  cold: "\u06A9\u0627\u0631 \u0633\u0631\u062F",
  confined: "\u0641\u0636\u0627\u06CC \u0628\u0633\u062A\u0647",
  height: "\u06A9\u0627\u0631 \u062F\u0631 \u0627\u0631\u062A\u0641\u0627\u0639",
  electrical: "\u06A9\u0627\u0631 \u0628\u0631\u0642\u06CC",
  excavation: "\u06AF\u0648\u062F\u0628\u0631\u062F\u0627\u0631\u06CC",
  lifting: "\u0639\u0645\u0644\u06CC\u0627\u062A \u0628\u0627\u0644\u0627\u0628\u0631\u06CC"
};
var HIGH_RISK_PERMITS = ["hot", "confined", "excavation"];
var PERMIT_STATUSES = ["draft", "active", "suspended", "closed", "expired", "rejected"];
var PERMIT_STATUS_FA = {
  draft: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633",
  active: "\u0645\u0639\u062A\u0628\u0631",
  suspended: "\u0645\u0639\u0644\u0642",
  closed: "\u0628\u0633\u062A\u0647",
  expired: "\u0645\u0646\u0642\u0636\u06CC",
  rejected: "\u0631\u062F \u0634\u062F\u0647"
};
var INCIDENT_TYPES = [
  "near_miss",
  "first_aid",
  "medical_treatment",
  "lost_time",
  "fatality",
  "environmental",
  "property_damage"
];
var INCIDENT_TYPE_FA = {
  near_miss: "\u0634\u0628\u0647\u200C\u062D\u0627\u062F\u062B\u0647",
  first_aid: "\u06A9\u0645\u06A9\u200C\u0647\u0627\u06CC \u0627\u0648\u0644\u06CC\u0647",
  medical_treatment: "\u062F\u0631\u0645\u0627\u0646 \u067E\u0632\u0634\u06A9\u06CC",
  lost_time: "\u062D\u0627\u062F\u062B\u0647\u0654 \u0645\u0646\u062C\u0631 \u0628\u0647 \u0627\u0632 \u06A9\u0627\u0631\u0627\u0641\u062A\u0627\u062F\u06AF\u06CC",
  fatality: "\u062D\u0627\u062F\u062B\u0647\u0654 \u0645\u0646\u062C\u0631 \u0628\u0647 \u0641\u0648\u062A",
  environmental: "\u0631\u0648\u06CC\u062F\u0627\u062F \u0632\u06CC\u0633\u062A\u200C\u0645\u062D\u06CC\u0637\u06CC",
  property_damage: "\u062E\u0633\u0627\u0631\u062A \u0628\u0647 \u0627\u0645\u0648\u0627\u0644"
};
var RECORDABLE_TYPES = ["medical_treatment", "lost_time", "fatality"];
var LOST_TIME_TYPES = ["lost_time", "fatality"];
var SEVERITIES = ["low", "medium", "high", "critical"];
var SEVERITY_FA = {
  low: "\u06A9\u0645",
  medium: "\u0645\u062A\u0648\u0633\u0637",
  high: "\u0628\u0627\u0644\u0627",
  critical: "\u0628\u062D\u0631\u0627\u0646\u06CC"
};
var INSPECTION_TYPES = ["walkthrough", "toolbox", "audit", "drill", "equipment"];
var INSPECTION_TYPE_FA = {
  walkthrough: "\u0628\u0627\u0632\u062F\u06CC\u062F \u0645\u06CC\u062F\u0627\u0646\u06CC",
  toolbox: "\u062C\u0644\u0633\u0647\u0654 \u0627\u06CC\u0645\u0646\u06CC \u0631\u0648\u0632\u0627\u0646\u0647",
  audit: "\u0645\u0645\u06CC\u0632\u06CC",
  drill: "\u0645\u0627\u0646\u0648\u0631",
  equipment: "\u0628\u0627\u0632\u0631\u0633\u06CC \u062A\u062C\u0647\u06CC\u0632\u0627\u062A"
};
function round2(n) {
  return Math.round(n * 100) / 100;
}
function round3(n) {
  return Math.round(n * 1e3) / 1e3;
}
function validatePermitInput(input) {
  const out = [];
  if (!String(input.PermitNo ?? "").trim()) {
    out.push({ code: "E-HSE-PERMIT-NO-REQUIRED", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u067E\u0631\u0648\u0627\u0646\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    out.push({ code: "E-HSE-TITLE-REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u06A9\u0627\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!PERMIT_TYPES.includes(input.PermitType)) {
    out.push({ code: "E-HSE-PERMIT-TYPE", message: "\u0646\u0648\u0639 \u067E\u0631\u0648\u0627\u0646\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!String(input.RequestedBy ?? "").trim()) {
    out.push({ code: "E-HSE-REQUESTER-REQUIRED", message: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u06A9\u0646\u0646\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  const from = String(input.ValidFrom ?? "").trim();
  const to = String(input.ValidTo ?? "").trim();
  if (!from || !to) {
    out.push({ code: "E-HSE-VALIDITY-REQUIRED", message: "\u0628\u0627\u0632\u0647\u0654 \u0627\u0639\u062A\u0628\u0627\u0631 \u067E\u0631\u0648\u0627\u0646\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  } else if (new Date(to).getTime() <= new Date(from).getTime()) {
    out.push({ code: "E-HSE-VALIDITY-RANGE", message: "\u067E\u0627\u06CC\u0627\u0646 \u0627\u0639\u062A\u0628\u0627\u0631 \u0628\u0627\u06CC\u062F \u067E\u0633 \u0627\u0632 \u0634\u0631\u0648\u0639 \u0628\u0627\u0634\u062F" });
  }
  return out;
}
function canApprovePermit(permit, approverId) {
  const blockersFa = [];
  if (permit.Status === "closed" || permit.Status === "expired") {
    blockersFa.push(`\u067E\u0631\u0648\u0627\u0646\u0647\u0654 ${PERMIT_STATUS_FA[permit.Status] ?? permit.Status} \u0642\u0627\u0628\u0644 \u062A\u0623\u06CC\u06CC\u062F \u0646\u06CC\u0633\u062A`);
  }
  if (permit.Status === "active") {
    blockersFa.push("\u0627\u06CC\u0646 \u067E\u0631\u0648\u0627\u0646\u0647 \u0642\u0628\u0644\u0627\u064B \u062A\u0623\u06CC\u06CC\u062F \u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  const needsSimops = permit.SimopsRequired === true || HIGH_RISK_PERMITS.includes(permit.PermitType);
  if (needsSimops && !String(permit.SimopsApprovedBy ?? "").trim()) {
    blockersFa.push(`${PERMIT_TYPE_FA[permit.PermitType] ?? permit.PermitType} \u0628\u062F\u0648\u0646 \u062A\u0623\u06CC\u06CC\u062F\u06CC\u0647\u0654 \u0639\u0645\u0644\u06CC\u0627\u062A \u0647\u0645\u200C\u0632\u0645\u0627\u0646 (SIMOPS) \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A`);
  }
  if ((permit.PermitType === "hot" || permit.PermitType === "confined") && !String(permit.GasTestResultFa ?? "").trim()) {
    blockersFa.push("\u0646\u062A\u06CC\u062C\u0647\u0654 \u0622\u0632\u0645\u0648\u0646 \u06AF\u0627\u0632 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  if (approverId && approverId === permit.RequestedBy) {
    blockersFa.push("\u062A\u0623\u06CC\u06CC\u062F\u06A9\u0646\u0646\u062F\u0647\u0654 \u067E\u0631\u0648\u0627\u0646\u0647 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0647\u0645\u0627\u0646 \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u06A9\u0646\u0646\u062F\u0647 \u0628\u0627\u0634\u062F");
  }
  return { ok: blockersFa.length === 0, blockersFa };
}
function permitState(permit, now = /* @__PURE__ */ new Date()) {
  const t = now.getTime();
  const to = new Date(permit.ValidTo).getTime();
  const from = new Date(permit.ValidFrom).getTime();
  let effective = permit.Status;
  if ((permit.Status === "active" || permit.Status === "suspended") && Number.isFinite(to) && t > to) {
    effective = "expired";
  }
  const isValidNow = effective === "active" && Number.isFinite(from) && Number.isFinite(to) && t >= from && t <= to;
  const expiresInHours = Number.isFinite(to) && effective === "active" ? round2((to - t) / 36e5) : null;
  return {
    effectiveStatus: effective,
    statusFa: PERMIT_STATUS_FA[effective] ?? effective,
    isValidNow,
    expiresInHours
  };
}
function rfsuSafetyClearance(args) {
  const now = args.now ?? /* @__PURE__ */ new Date();
  const permits = (args.permits ?? []).filter((p) => p.SystemId === args.systemId);
  const incidents = (args.incidents ?? []).filter((i) => i.SystemId === args.systemId);
  const blockersFa = [];
  const warningsFa = [];
  const states = permits.map((p) => ({ permit: p, state: permitState(p, now) }));
  const open = states.filter((s) => s.state.effectiveStatus === "active" || s.state.effectiveStatus === "suspended");
  const expired = states.filter((s) => s.state.effectiveStatus === "expired");
  if (open.length) {
    blockersFa.push(`${open.length} \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u06A9\u0627\u0631 \u0628\u0627\u0632 \u0631\u0648\u06CC \u0627\u06CC\u0646 \u0633\u06CC\u0633\u062A\u0645 \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F`);
  }
  if (expired.length) {
    warningsFa.push(`${expired.length} \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u0645\u0646\u0642\u0636\u06CC \u0628\u0633\u062A\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  const openHigh = incidents.filter(
    (i) => i.Status !== "closed" && (i.Severity === "high" || i.Severity === "critical")
  );
  if (openHigh.length) {
    blockersFa.push(`${openHigh.length} \u0631\u0648\u06CC\u062F\u0627\u062F \u0627\u06CC\u0645\u0646\u06CC \u0628\u0627\u0632 \u0628\u0627 \u0634\u062F\u062A \u0628\u0627\u0644\u0627 \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F`);
  }
  const openLow = incidents.filter(
    (i) => i.Status !== "closed" && i.Severity !== "high" && i.Severity !== "critical"
  );
  if (openLow.length) {
    warningsFa.push(`${openLow.length} \u0631\u0648\u06CC\u062F\u0627\u062F \u0627\u06CC\u0645\u0646\u06CC \u0628\u0627\u0632 \u0628\u0627 \u0634\u062F\u062A \u067E\u0627\u06CC\u06CC\u0646\u200C\u062A\u0631`);
  }
  const stopWorkOrders = (args.violations ?? []).filter((v) => {
    const st = violationState(v, now);
    if (!st.isBlocking || !st.isEnforceable) return false;
    const scope = v.StopWorkScope;
    if (scope === "project") return true;
    if (scope === "system") return v.SystemId === args.systemId;
    return v.SystemId === args.systemId;
  });
  if (stopWorkOrders.length) {
    blockersFa.push(
      `${stopWorkOrders.length} \u062F\u0633\u062A\u0648\u0631 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u0641\u0639\u0627\u0644 \u0631\u0648\u06CC \u0627\u06CC\u0646 \u0633\u06CC\u0633\u062A\u0645 \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F`
    );
  }
  const unenforceable = (args.violations ?? []).filter((v) => {
    const st = violationState(v, now);
    return st.isBlocking && !st.isEnforceable && v.SystemId === args.systemId;
  });
  if (unenforceable.length) {
    warningsFa.push(`${unenforceable.length} \u062F\u0633\u062A\u0648\u0631 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u0646\u0627\u0642\u0635 \u0631\u0648\u06CC \u0627\u06CC\u0646 \u0633\u06CC\u0633\u062A\u0645 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  return {
    systemId: args.systemId,
    ok: blockersFa.length === 0,
    openPermits: open.length,
    expiredPermits: expired.length,
    openHighSeverityIncidents: openHigh.length,
    activeStopWorkOrders: stopWorkOrders.length,
    blockersFa,
    warningsFa
  };
}
function validateIncidentInput(input) {
  const out = [];
  if (!String(input.IncidentNo ?? "").trim()) {
    out.push({ code: "E-HSE-INCIDENT-NO-REQUIRED", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u0631\u0648\u06CC\u062F\u0627\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    out.push({ code: "E-HSE-TITLE-REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u0631\u0648\u06CC\u062F\u0627\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!INCIDENT_TYPES.includes(input.IncidentType)) {
    out.push({ code: "E-HSE-INCIDENT-TYPE", message: "\u0646\u0648\u0639 \u0631\u0648\u06CC\u062F\u0627\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!String(input.OccurredAt ?? "").trim()) {
    out.push({ code: "E-HSE-OCCURRED-REQUIRED", message: "\u0632\u0645\u0627\u0646 \u0648\u0642\u0648\u0639 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.ReportedBy ?? "").trim()) {
    out.push({ code: "E-HSE-REPORTER-REQUIRED", message: "\u06AF\u0632\u0627\u0631\u0634\u200C\u062F\u0647\u0646\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (input.Severity !== void 0 && !SEVERITIES.includes(input.Severity)) {
    out.push({ code: "E-HSE-SEVERITY", message: "\u0634\u062F\u062A \u0631\u0648\u06CC\u062F\u0627\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  const t = input.IncidentType;
  if (LOST_TIME_TYPES.includes(t) && t !== "fatality") {
    const d = Number(input.LostDays ?? 0);
    if (!Number.isFinite(d) || d <= 0) {
      out.push({ code: "E-HSE-LOST-DAYS", message: "\u0628\u0631\u0627\u06CC \u062D\u0627\u062F\u062B\u0647\u0654 \u0645\u0646\u062C\u0631 \u0628\u0647 \u0627\u0632 \u06A9\u0627\u0631\u0627\u0641\u062A\u0627\u062F\u06AF\u06CC\u060C \u0631\u0648\u0632\u0647\u0627\u06CC \u0627\u0632 \u062F\u0633\u062A \u0631\u0641\u062A\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
    }
  }
  return out;
}
function suggestSeverity(type, lostDays = 0) {
  if (type === "fatality") return "critical";
  if (type === "lost_time") return lostDays > 14 ? "critical" : "high";
  if (type === "medical_treatment") return "medium";
  if (type === "environmental") return "high";
  if (type === "property_damage") return "medium";
  return "low";
}
function canCloseIncident(incident) {
  const blockersFa = [];
  if (incident.Status === "closed") {
    blockersFa.push("\u0627\u06CC\u0646 \u0631\u0648\u06CC\u062F\u0627\u062F \u0642\u0628\u0644\u0627\u064B \u0628\u0633\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  if (!String(incident.RootCauseFa ?? "").trim()) {
    blockersFa.push("\u0631\u06CC\u0634\u0647\u200C\u06CC\u0627\u0628\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  if (!String(incident.CorrectiveActionFa ?? "").trim()) {
    blockersFa.push("\u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  return { ok: blockersFa.length === 0, blockersFa };
}
function safetyMetrics(incidents, manHours) {
  const byType = {};
  for (const t of INCIDENT_TYPES) byType[t] = 0;
  let lostDays = 0;
  for (const i of incidents) {
    byType[i.IncidentType] = (byType[i.IncidentType] ?? 0) + 1;
    lostDays += Number(i.LostDays ?? 0) || 0;
  }
  const recordable = incidents.filter((i) => RECORDABLE_TYPES.includes(i.IncidentType)).length;
  const lostTime = incidents.filter((i) => LOST_TIME_TYPES.includes(i.IncidentType)).length;
  const hours = Number(manHours ?? 0);
  const usable = Number.isFinite(hours) && hours > 0 ? hours : null;
  return {
    total: incidents.length,
    byType,
    recordable,
    lostTime,
    lostDays,
    nearMiss: byType.near_miss ?? 0,
    openCount: incidents.filter((i) => i.Status !== "closed").length,
    ltifr: usable ? round2(lostTime * 1e6 / usable) : null,
    trir: usable ? round2(recordable * 2e5 / usable) : null,
    manHours: usable
  };
}
function trainingValidity(records, personRef, now = /* @__PURE__ */ new Date()) {
  const mine = records.filter((r) => r.PersonRef === personRef);
  const t = now.getTime();
  const soonMs = 30 * 24 * 36e5;
  const validCourses = [];
  const expiredCourses = [];
  const expiringSoonCourses = [];
  for (const r of mine) {
    if (r.Status === "revoked") {
      expiredCourses.push(r.CourseCode);
      continue;
    }
    const exp = String(r.ExpiresAt ?? "").trim();
    if (!exp) {
      validCourses.push(r.CourseCode);
      continue;
    }
    const e = new Date(exp).getTime();
    if (!Number.isFinite(e)) {
      validCourses.push(r.CourseCode);
    } else if (e < t) {
      expiredCourses.push(r.CourseCode);
    } else {
      validCourses.push(r.CourseCode);
      if (e - t <= soonMs) expiringSoonCourses.push(r.CourseCode);
    }
  }
  return {
    personRef,
    hasValid: validCourses.length > 0,
    validCourses,
    expiredCourses,
    expiringSoonCourses
  };
}
function hseSummary(args) {
  const now = args.now ?? /* @__PURE__ */ new Date();
  const byType = {};
  for (const t of PERMIT_TYPES) byType[t] = 0;
  let active = 0;
  let expired = 0;
  for (const p of args.permits) {
    byType[p.PermitType] = (byType[p.PermitType] ?? 0) + 1;
    const st = permitState(p, now).effectiveStatus;
    if (st === "active") active += 1;
    if (st === "expired") expired += 1;
  }
  const insp = args.inspections ?? [];
  const scored = insp.filter((i) => i.ScorePct != null && Number.isFinite(Number(i.ScorePct)));
  const avg = scored.length ? round2(scored.reduce((s, i) => s + Number(i.ScorePct), 0) / scored.length) : null;
  const openFindings = insp.reduce(
    (s, i) => s + Math.max(0, Number(i.FindingsCount ?? 0) - Number(i.ClosedFindings ?? 0)),
    0
  );
  return {
    permits: { total: args.permits.length, active, expired, byType },
    incidents: safetyMetrics(args.incidents, args.manHours),
    inspections: { total: insp.length, avgScorePct: avg, openFindings }
  };
}
function hseAlerts(args) {
  const now = args.now ?? /* @__PURE__ */ new Date();
  const out = [];
  const expiring = args.permits.map((p) => permitState(p, now)).filter((s) => s.effectiveStatus === "active" && s.expiresInHours !== null && s.expiresInHours <= 4);
  if (expiring.length) {
    out.push({
      code: "EWS-HSE-01",
      severity: "medium",
      messageFa: `${expiring.length} \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u06A9\u0627\u0631 \u06A9\u0645\u062A\u0631 \u0627\u0632 \u06F4 \u0633\u0627\u0639\u062A \u062A\u0627 \u0627\u0646\u0642\u0636\u0627 \u062F\u0627\u0631\u062F`
    });
  }
  const expired = args.permits.map((p) => permitState(p, now)).filter((s) => s.effectiveStatus === "expired");
  if (expired.length) {
    out.push({
      code: "EWS-HSE-02",
      severity: "high",
      messageFa: `${expired.length} \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u0645\u0646\u0642\u0636\u06CC \u0647\u0646\u0648\u0632 \u0628\u0633\u062A\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`
    });
  }
  const critical = args.incidents.filter((i) => i.Status !== "closed" && i.Severity === "critical");
  if (critical.length) {
    out.push({
      code: "EWS-HSE-03",
      severity: "critical",
      messageFa: `${critical.length} \u0631\u0648\u06CC\u062F\u0627\u062F \u0627\u06CC\u0645\u0646\u06CC \u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0627\u0632 \u0627\u0633\u062A`
    });
  }
  const counts = {};
  for (const i of args.incidents) counts[i.IncidentType] = (counts[i.IncidentType] ?? 0) + 1;
  for (const [type, n] of Object.entries(counts)) {
    if (n >= 3 && type !== "near_miss") {
      out.push({
        code: "EWS-HSE-04",
        severity: "high",
        messageFa: `${INCIDENT_TYPE_FA[type] ?? type} ${n} \u0628\u0627\u0631 \u062A\u06A9\u0631\u0627\u0631 \u0634\u062F\u0647 \u2014 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0631\u06CC\u0634\u0647\u200C\u06CC\u0627\u0628\u06CC \u0633\u06CC\u0633\u062A\u0645\u06CC`
      });
    }
  }
  const training = args.training ?? [];
  const people = new Set(training.map((r) => r.PersonRef));
  let expiredPeople = 0;
  for (const p of people) {
    const v = trainingValidity(training, p, now);
    if (!v.hasValid && v.expiredCourses.length) expiredPeople += 1;
  }
  if (expiredPeople) {
    out.push({
      code: "EWS-HSE-05",
      severity: "medium",
      messageFa: `${expiredPeople} \u0646\u0641\u0631 \u0622\u0645\u0648\u0632\u0634 \u0627\u06CC\u0645\u0646\u06CC \u0645\u0639\u062A\u0628\u0631 \u0646\u062F\u0627\u0631\u0646\u062F`
    });
  }
  return out;
}
var CONTROL_LEVELS = ["elimination", "substitution", "engineering", "administrative", "ppe"];
var CONTROL_LEVEL_FA = {
  elimination: "\u062D\u0630\u0641 \u062E\u0637\u0631",
  substitution: "\u062C\u0627\u06CC\u06AF\u0632\u06CC\u0646\u06CC",
  engineering: "\u06A9\u0646\u062A\u0631\u0644 \u0645\u0647\u0646\u062F\u0633\u06CC",
  administrative: "\u06A9\u0646\u062A\u0631\u0644 \u0627\u062F\u0627\u0631\u06CC",
  ppe: "\u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062D\u0641\u0627\u0638\u062A \u0641\u0631\u062F\u06CC"
};
var CONTROL_RANK = {
  elimination: 1,
  substitution: 2,
  engineering: 3,
  administrative: 4,
  ppe: 5
};
var HAZARD_CATEGORIES = [
  "fall",
  "struck",
  "caught",
  "electrical",
  "chemical",
  "fire",
  "ergonomic",
  "environmental",
  "biological",
  "noise"
];
var HAZARD_CATEGORY_FA = {
  fall: "\u0633\u0642\u0648\u0637 \u0627\u0632 \u0627\u0631\u062A\u0641\u0627\u0639",
  struck: "\u0628\u0631\u062E\u0648\u0631\u062F \u062C\u0633\u0645",
  caught: "\u06AF\u06CC\u0631\u0627\u0641\u062A\u0627\u062F\u06AF\u06CC \u0628\u06CC\u0646 \u0627\u062C\u0633\u0627\u0645",
  electrical: "\u0628\u0631\u0642\u200C\u06AF\u0631\u0641\u062A\u06AF\u06CC",
  chemical: "\u0645\u0648\u0627\u062F \u0634\u06CC\u0645\u06CC\u0627\u06CC\u06CC",
  fire: "\u0622\u062A\u0634 \u0648 \u0627\u0646\u0641\u062C\u0627\u0631",
  ergonomic: "\u0627\u0631\u06AF\u0648\u0646\u0648\u0645\u06CC",
  environmental: "\u0632\u06CC\u0633\u062A\u200C\u0645\u062D\u06CC\u0637\u06CC",
  biological: "\u0639\u0648\u0627\u0645\u0644 \u0628\u06CC\u0648\u0644\u0648\u0698\u06CC\u06A9",
  noise: "\u0635\u062F\u0627 \u0648 \u0627\u0631\u062A\u0639\u0627\u0634"
};
var JSA_STATUSES = ["draft", "approved", "expired", "void"];
var JSA_STATUS_FA = {
  draft: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633",
  approved: "\u0645\u0635\u0648\u0628",
  expired: "\u0645\u0646\u0642\u0636\u06CC",
  void: "\u0628\u0627\u0637\u0644"
};
var RISK_BANDS = [
  { max: 4, code: "low", fa: "\u06A9\u0645", color: "#16A34A" },
  { max: 9, code: "medium", fa: "\u0645\u062A\u0648\u0633\u0637", color: "#CA8A04" },
  { max: 14, code: "high", fa: "\u0628\u0627\u0644\u0627", color: "#EA580C" },
  { max: 25, code: "extreme", fa: "\u0628\u062D\u0631\u0627\u0646\u06CC", color: "#DC2626" }
];
var PPE_ONLY_RISK_THRESHOLD = 15;
var MAX_APPROVABLE_RESIDUAL = 12;
function riskBand(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n <= 0) {
    return { code: "unknown", fa: "\u0646\u0627\u0645\u0634\u062E\u0635", color: "#94A3B8", score: null };
  }
  for (const b of RISK_BANDS) {
    if (n <= b.max) return { code: b.code, fa: b.fa, color: b.color, score: n };
  }
  const last = RISK_BANDS[RISK_BANDS.length - 1];
  return { code: last.code, fa: last.fa, color: last.color, score: n };
}
function riskScore(likelihood, severity) {
  const clamp = (v) => Math.max(1, Math.min(5, Math.round(Number(v) || 1)));
  return clamp(likelihood) * clamp(severity);
}
function validateJsaInput(input) {
  const out = [];
  if (!String(input.JsaNo ?? "").trim()) {
    out.push({ code: "E-HSE-JSA-NO-REQUIRED", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    out.push({ code: "E-HSE-JSA-TITLE-REQUIRED", message: "\u0639\u0646\u0648\u0627\u0646 \u06A9\u0627\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.PreparedBy ?? "").trim()) {
    out.push({ code: "E-HSE-JSA-PREPARER-REQUIRED", message: "\u062A\u0647\u06CC\u0647\u200C\u06A9\u0646\u0646\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (input.Status !== void 0 && !JSA_STATUSES.includes(input.Status)) {
    out.push({ code: "E-HSE-JSA-STATUS", message: "\u0648\u0636\u0639\u06CC\u062A \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  return out;
}
function validateHazardInput(input) {
  const out = [];
  if (!String(input.HazardFa ?? "").trim()) {
    out.push({ code: "E-HSE-HAZARD-DESC-REQUIRED", message: "\u0634\u0631\u062D \u062E\u0637\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  for (const [field, label] of [["Likelihood", "\u0627\u062D\u062A\u0645\u0627\u0644"], ["Severity", "\u0634\u062F\u062A"]]) {
    const v = Number(input[field]);
    if (!Number.isFinite(v) || v < 1 || v > 5) {
      out.push({ code: "E-HSE-RISK-RANGE", message: `${label} \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0628\u06CC\u0646 \u06F1 \u062A\u0627 \u06F5 \u0628\u0627\u0634\u062F` });
    }
  }
  if (input.HazardCategory && !HAZARD_CATEGORIES.includes(input.HazardCategory)) {
    out.push({ code: "E-HSE-HAZARD-CATEGORY", message: "\u062F\u0633\u062A\u0647\u0654 \u062E\u0637\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  return out;
}
function validateControlInput(input) {
  const out = [];
  if (!String(input.ControlFa ?? "").trim()) {
    out.push({ code: "E-HSE-CONTROL-DESC-REQUIRED", message: "\u0634\u0631\u062D \u06A9\u0646\u062A\u0631\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!CONTROL_LEVELS.includes(input.ControlLevel)) {
    out.push({ code: "E-HSE-CONTROL-LEVEL", message: "\u0633\u0637\u062D \u06A9\u0646\u062A\u0631\u0644 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  return out;
}
function evaluateHazard(hazard, controls) {
  const mine = controls.filter((c) => c.HazardId === hazard.Id);
  const initial = riskScore(hazard.Likelihood, hazard.Severity);
  const hasResidual = hazard.ResidualLikelihood != null && hazard.ResidualSeverity != null;
  const residual = hasResidual ? riskScore(Number(hazard.ResidualLikelihood), Number(hazard.ResidualSeverity)) : initial;
  const ranks = mine.map((c) => CONTROL_RANK[c.ControlLevel]).filter((r) => Number.isFinite(r));
  const bestRank = ranks.length ? Math.min(...ranks) : null;
  const bestLevel = bestRank ? CONTROL_LEVELS.find((l) => CONTROL_RANK[l] === bestRank) ?? null : null;
  const ppeOnly = mine.length > 0 && mine.every((c) => c.ControlLevel === "ppe");
  const warningsFa = [];
  if (!mine.length) {
    warningsFa.push("\u0627\u06CC\u0646 \u062E\u0637\u0631 \u0647\u06CC\u0686 \u06A9\u0646\u062A\u0631\u0644\u06CC \u0646\u062F\u0627\u0631\u062F");
  }
  if (ppeOnly && initial >= PPE_ONLY_RISK_THRESHOLD) {
    warningsFa.push(
      `\u0631\u06CC\u0633\u06A9 ${initial} \u062A\u0646\u0647\u0627 \u0628\u0627 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062D\u0641\u0627\u0638\u062A \u0641\u0631\u062F\u06CC \u06A9\u0646\u062A\u0631\u0644 \u0634\u062F\u0647 \u2014 \u06A9\u0646\u062A\u0631\u0644 \u0645\u0647\u0646\u062F\u0633\u06CC \u06CC\u0627 \u062D\u0630\u0641 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A`
    );
  }
  if (mine.length && !hasResidual) {
    warningsFa.push("\u0627\u062B\u0631 \u06A9\u0646\u062A\u0631\u0644\u200C\u0647\u0627 \u0628\u0631 \u0631\u06CC\u0633\u06A9 \u0633\u0646\u062C\u06CC\u062F\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  if (residual > initial) {
    warningsFa.push("\u0631\u06CC\u0633\u06A9 \u0628\u0627\u0642\u06CC\u0645\u0627\u0646\u062F\u0647 \u0627\u0632 \u0631\u06CC\u0633\u06A9 \u0627\u0648\u0644\u06CC\u0647 \u0628\u06CC\u0634\u062A\u0631 \u0627\u0633\u062A");
  }
  return {
    hazardId: hazard.Id,
    initialRisk: initial,
    initialBand: riskBand(initial),
    residualRisk: residual,
    residualBand: riskBand(residual),
    controlCount: mine.length,
    bestControlLevel: bestLevel,
    bestControlLevelFa: bestLevel ? CONTROL_LEVEL_FA[bestLevel] : null,
    ppeOnly,
    reductionPct: initial > 0 ? round2((initial - residual) / initial * 100) : 0,
    warningsFa
  };
}
function jsaSummary(steps, hazards, controls) {
  const byControlLevel = {};
  for (const l of CONTROL_LEVELS) byControlLevel[l] = 0;
  for (const c of controls) {
    byControlLevel[c.ControlLevel] = (byControlLevel[c.ControlLevel] ?? 0) + 1;
  }
  const byBand = { low: 0, medium: 0, high: 0, extreme: 0 };
  const evals = hazards.map((h) => evaluateHazard(h, controls));
  for (const e of evals) {
    byBand[e.residualBand.code] = (byBand[e.residualBand.code] ?? 0) + 1;
  }
  const maxInitial = evals.length ? Math.max(...evals.map((e) => e.initialRisk)) : null;
  const maxResidual = evals.length ? Math.max(...evals.map((e) => e.residualRisk)) : null;
  const stepIdsWithHazard = new Set(hazards.map((h) => h.StepId));
  const stepsWithoutHazard = steps.filter((s) => !stepIdsWithHazard.has(s.Id)).length;
  const warningsFa = [];
  const noControl = evals.filter((e) => e.controlCount === 0).length;
  if (noControl) warningsFa.push(`${noControl} \u062E\u0637\u0631 \u0628\u062F\u0648\u0646 \u06A9\u0646\u062A\u0631\u0644 \u0627\u0633\u062A`);
  const ppeHigh = evals.filter((e) => e.ppeOnly && e.initialRisk >= PPE_ONLY_RISK_THRESHOLD).length;
  if (ppeHigh) warningsFa.push(`${ppeHigh} \u062E\u0637\u0631 \u067E\u0631\u0631\u06CC\u0633\u06A9 \u062A\u0646\u0647\u0627 \u0628\u0627 \u062D\u0641\u0627\u0638\u062A \u0641\u0631\u062F\u06CC \u06A9\u0646\u062A\u0631\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A`);
  if (stepsWithoutHazard) warningsFa.push(`${stepsWithoutHazard} \u06AF\u0627\u0645 \u06A9\u0627\u0631\u06CC \u0628\u062F\u0648\u0646 \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u062E\u0637\u0631 \u0627\u0633\u062A`);
  return {
    steps: steps.length,
    hazards: hazards.length,
    controls: controls.length,
    maxInitialRisk: maxInitial,
    maxResidualRisk: maxResidual,
    maxResidualBand: riskBand(maxResidual),
    byControlLevel,
    byBand,
    hazardsWithoutControl: noControl,
    ppeOnlyHighRisk: ppeHigh,
    stepsWithoutHazard,
    warningsFa
  };
}
function canApproveJsa(args) {
  const { jsa, steps, hazards, controls, approverId } = args;
  const blockersFa = [];
  const warningsFa = [];
  if (jsa.Status === "approved") blockersFa.push("\u0627\u06CC\u0646 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0642\u0628\u0644\u0627\u064B \u062A\u0635\u0648\u06CC\u0628 \u0634\u062F\u0647 \u0627\u0633\u062A");
  if (jsa.Status === "void") blockersFa.push("\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0628\u0627\u0637\u0644 \u0642\u0627\u0628\u0644 \u062A\u0635\u0648\u06CC\u0628 \u0646\u06CC\u0633\u062A");
  if (!steps.length) blockersFa.push("\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0628\u062F\u0648\u0646 \u06AF\u0627\u0645 \u06A9\u0627\u0631\u06CC \u0642\u0627\u0628\u0644 \u062A\u0635\u0648\u06CC\u0628 \u0646\u06CC\u0633\u062A");
  if (!hazards.length) blockersFa.push("\u0647\u06CC\u0686 \u062E\u0637\u0631\u06CC \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  const evals = hazards.map((h) => evaluateHazard(h, controls));
  const noControl = evals.filter((e) => e.controlCount === 0);
  if (noControl.length) {
    blockersFa.push(`${noControl.length} \u062E\u0637\u0631 \u0647\u06CC\u0686 \u06A9\u0646\u062A\u0631\u0644\u06CC \u0646\u062F\u0627\u0631\u062F`);
  }
  const ppeHigh = evals.filter((e) => e.ppeOnly && e.initialRisk >= PPE_ONLY_RISK_THRESHOLD);
  if (ppeHigh.length) {
    blockersFa.push(
      `${ppeHigh.length} \u062E\u0637\u0631 \u067E\u0631\u0631\u06CC\u0633\u06A9 \u062A\u0646\u0647\u0627 \u0628\u0627 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062D\u0641\u0627\u0638\u062A \u0641\u0631\u062F\u06CC \u06A9\u0646\u062A\u0631\u0644 \u0634\u062F\u0647 \u2014 \u06A9\u0646\u062A\u0631\u0644 \u0628\u0627\u0644\u0627\u062A\u0631 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A`
    );
  }
  const maxResidual = evals.length ? Math.max(...evals.map((e) => e.residualRisk)) : null;
  if (maxResidual !== null && maxResidual > MAX_APPROVABLE_RESIDUAL) {
    blockersFa.push(
      `\u0631\u06CC\u0633\u06A9 \u0628\u0627\u0642\u06CC\u0645\u0627\u0646\u062F\u0647 ${maxResidual} \u0627\u0632 \u062D\u062F \u0645\u062C\u0627\u0632 ${MAX_APPROVABLE_RESIDUAL} \u0628\u06CC\u0634\u062A\u0631 \u0627\u0633\u062A`
    );
  }
  if (approverId && approverId === jsa.PreparedBy) {
    blockersFa.push("\u062A\u0635\u0648\u06CC\u0628\u200C\u06A9\u0646\u0646\u062F\u0647 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0647\u0645\u0627\u0646 \u062A\u0647\u06CC\u0647\u200C\u06A9\u0646\u0646\u062F\u0647 \u0628\u0627\u0634\u062F");
  }
  const stepIdsWithHazard = new Set(hazards.map((h) => h.StepId));
  const orphanSteps = steps.filter((s) => !stepIdsWithHazard.has(s.Id));
  if (orphanSteps.length) {
    warningsFa.push(`${orphanSteps.length} \u06AF\u0627\u0645 \u06A9\u0627\u0631\u06CC \u0628\u062F\u0648\u0646 \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u062E\u0637\u0631 \u0627\u0633\u062A`);
  }
  const unmeasured = evals.filter((e) => e.controlCount > 0 && e.warningsFa.some((w) => w.includes("\u0633\u0646\u062C\u06CC\u062F\u0647 \u0646\u0634\u062F\u0647")));
  if (unmeasured.length) {
    warningsFa.push(`${unmeasured.length} \u062E\u0637\u0631 \u0627\u062B\u0631 \u06A9\u0646\u062A\u0631\u0644\u0634 \u0633\u0646\u062C\u06CC\u062F\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  return { ok: blockersFa.length === 0, blockersFa, warningsFa, maxResidualRisk: maxResidual };
}
function jsaState(jsa, now = /* @__PURE__ */ new Date()) {
  let effective = jsa.Status;
  const until = String(jsa.ValidUntil ?? "").trim();
  const t = now.getTime();
  let expiresInDays = null;
  if (until) {
    const e = new Date(until).getTime();
    if (Number.isFinite(e)) {
      expiresInDays = Math.floor((e - t) / 864e5);
      if (jsa.Status === "approved" && e < t) effective = "expired";
    }
  }
  return {
    effectiveStatus: effective,
    statusFa: JSA_STATUS_FA[effective] ?? effective,
    isUsable: effective === "approved",
    expiresInDays: effective === "approved" ? expiresInDays : null
  };
}
function jsaSupportsPermit(jsa, now = /* @__PURE__ */ new Date()) {
  const blockersFa = [];
  if (!jsa) {
    return { ok: false, blockersFa: ["\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0634\u063A\u0644\u06CC \u0628\u0647 \u0627\u06CC\u0646 \u067E\u0631\u0648\u0627\u0646\u0647 \u067E\u06CC\u0648\u0633\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"] };
  }
  const st = jsaState(jsa, now);
  if (st.effectiveStatus === "draft") blockersFa.push("\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0647\u0646\u0648\u0632 \u062A\u0635\u0648\u06CC\u0628 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  if (st.effectiveStatus === "expired") blockersFa.push("\u0627\u0639\u062A\u0628\u0627\u0631 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A");
  if (st.effectiveStatus === "void") blockersFa.push("\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0628\u0627\u0637\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A");
  return { ok: blockersFa.length === 0, blockersFa };
}
var GAS_LIMITS = {
  /** حد پایین انفجار — بالاتر از این یعنی مخلوط قابل اشتعال. */
  lelMaxPct: 10,
  /** کمبود اکسیژن؛ زیر این حد خفگی. */
  oxygenMinPct: 19.5,
  /** غنای اکسیژن؛ بالای این حد آتش‌گیری شدید. */
  oxygenMaxPct: 23.5,
  h2sMaxPpm: 10,
  coMaxPpm: 35
};
var GAS_TEST_VALIDITY_MINUTES = 120;
var ISOLATION_TYPES = ["electrical", "mechanical", "process", "hydraulic"];
var ISOLATION_TYPE_FA = {
  electrical: "\u0628\u0631\u0642\u06CC",
  mechanical: "\u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC",
  process: "\u0641\u0631\u0622\u06CC\u0646\u062F\u06CC",
  hydraulic: "\u0647\u06CC\u062F\u0631\u0648\u0644\u06CC\u06A9\u06CC"
};
var ISOLATION_STATUSES = ["planned", "applied", "removed"];
var ISOLATION_STATUS_FA = {
  planned: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647",
  applied: "\u0627\u0639\u0645\u0627\u0644\u200C\u0634\u062F\u0647",
  removed: "\u0628\u0631\u062F\u0627\u0634\u062A\u0647\u200C\u0634\u062F\u0647"
};
var APPROVAL_LEVELS = ["supervisor", "hse", "area_manager"];
var APPROVAL_LEVEL_FA = {
  supervisor: "\u0633\u0631\u067E\u0631\u0633\u062A \u0627\u062C\u0631\u0627",
  hse: "\u0627\u0641\u0633\u0631 \u0627\u06CC\u0645\u0646\u06CC \u0648 \u0628\u0647\u062F\u0627\u0634\u062A",
  area_manager: "\u0645\u062F\u06CC\u0631 \u0645\u0646\u0637\u0642\u0647"
};
var GAS_TEST_REQUIRED_PERMITS = ["hot", "confined"];
var ISOLATION_REQUIRED_PERMITS = ["electrical", "confined"];
function evaluateGasTest(reading) {
  const breachesFa = [];
  const missingFa = [];
  const num = (v) => {
    if (v === null || v === void 0 || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };
  const lel = num(reading.LelPct);
  const o2 = num(reading.OxygenPct);
  const h2s = num(reading.H2sPpm);
  const co = num(reading.CoPpm);
  if (lel === null) missingFa.push("\u062D\u062F \u0627\u0646\u0641\u062C\u0627\u0631 (LEL) \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0634\u062F\u0647");
  else if (lel >= GAS_LIMITS.lelMaxPct) {
    breachesFa.push(`\u062D\u062F \u0627\u0646\u0641\u062C\u0627\u0631 ${lel}\u066A \u2014 \u0628\u06CC\u0634\u06CC\u0646\u0647\u0654 \u0645\u062C\u0627\u0632 ${GAS_LIMITS.lelMaxPct}\u066A`);
  }
  if (o2 === null) missingFa.push("\u062F\u0631\u0635\u062F \u0627\u06A9\u0633\u06CC\u0698\u0646 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0634\u062F\u0647");
  else if (o2 < GAS_LIMITS.oxygenMinPct) {
    breachesFa.push(`\u06A9\u0645\u0628\u0648\u062F \u0627\u06A9\u0633\u06CC\u0698\u0646 ${o2}\u066A \u2014 \u06A9\u0645\u06CC\u0646\u0647\u0654 \u0645\u062C\u0627\u0632 ${GAS_LIMITS.oxygenMinPct}\u066A`);
  } else if (o2 > GAS_LIMITS.oxygenMaxPct) {
    breachesFa.push(`\u063A\u0646\u0627\u06CC \u0627\u06A9\u0633\u06CC\u0698\u0646 ${o2}\u066A \u2014 \u0628\u06CC\u0634\u06CC\u0646\u0647\u0654 \u0645\u062C\u0627\u0632 ${GAS_LIMITS.oxygenMaxPct}\u066A`);
  }
  if (h2s === null) missingFa.push("\u063A\u0644\u0638\u062A \u0633\u0648\u0644\u0641\u06CC\u062F \u0647\u06CC\u062F\u0631\u0648\u0698\u0646 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0634\u062F\u0647");
  else if (h2s >= GAS_LIMITS.h2sMaxPpm) {
    breachesFa.push(`\u0633\u0648\u0644\u0641\u06CC\u062F \u0647\u06CC\u062F\u0631\u0648\u0698\u0646 ${h2s} ppm \u2014 \u0628\u06CC\u0634\u06CC\u0646\u0647\u0654 \u0645\u062C\u0627\u0632 ${GAS_LIMITS.h2sMaxPpm} ppm`);
  }
  if (co === null) missingFa.push("\u063A\u0644\u0638\u062A \u0645\u0648\u0646\u0648\u06A9\u0633\u06CC\u062F \u06A9\u0631\u0628\u0646 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0634\u062F\u0647");
  else if (co >= GAS_LIMITS.coMaxPpm) {
    breachesFa.push(`\u0645\u0648\u0646\u0648\u06A9\u0633\u06CC\u062F \u06A9\u0631\u0628\u0646 ${co} ppm \u2014 \u0628\u06CC\u0634\u06CC\u0646\u0647\u0654 \u0645\u062C\u0627\u0632 ${GAS_LIMITS.coMaxPpm} ppm`);
  }
  const measuredCount = [lel, o2, h2s, co].filter((x) => x !== null).length;
  return {
    /* هیچ اندازه‌گیری = ناایمن. سکوت تأیید نیست. */
    isSafe: breachesFa.length === 0 && measuredCount > 0,
    breachesFa,
    missingFa,
    measuredCount
  };
}
function latestGasTest(tests, permitId, now = /* @__PURE__ */ new Date()) {
  const mine = tests.filter((t) => t.PermitId === permitId && Number.isFinite(new Date(t.TestedAt).getTime())).sort((a, b) => new Date(b.TestedAt).getTime() - new Date(a.TestedAt).getTime());
  const test = mine[0] ?? null;
  if (!test) return { test: null, isFresh: false, ageMinutes: null, isSafe: false };
  const ageMinutes = round2((now.getTime() - new Date(test.TestedAt).getTime()) / 6e4);
  const evalRes = evaluateGasTest(test);
  return {
    test,
    /* منفی یعنی زمان‌سنج دستگاه جلوتر است؛ آن را تازه نمی‌شماریم. */
    isFresh: ageMinutes >= 0 && ageMinutes <= GAS_TEST_VALIDITY_MINUTES,
    ageMinutes,
    isSafe: evalRes.isSafe
  };
}
function isolationState(isolations, permitId) {
  const mine = isolations.filter((i) => i.PermitId === permitId);
  const planned = mine.filter((i) => i.Status === "planned").length;
  const applied = mine.filter((i) => i.Status === "applied").length;
  const removed = mine.filter((i) => i.Status === "removed").length;
  const missingLockFa = mine.filter((i) => i.Status === "applied" && !String(i.LockNo ?? "").trim()).map((i) => `\u0627\u06CC\u0632\u0648\u0644\u0627\u0633\u06CC\u0648\u0646 ${i.IsolationNo} (${i.PointTagFa}) \u0634\u0645\u0627\u0631\u0647\u0654 \u0642\u0641\u0644 \u0646\u062F\u0627\u0631\u062F`);
  return {
    total: mine.length,
    planned,
    applied,
    removed,
    allApplied: mine.length > 0 && planned === 0,
    allRemoved: mine.length > 0 && removed === mine.length,
    missingLockFa
  };
}
function approvalChain(approvals, permitId) {
  const mine = approvals.filter((a) => a.PermitId === permitId);
  const byLevel = new Map(mine.map((a) => [a.ApprovalLevel, a]));
  const rejected = APPROVAL_LEVELS.find((l) => byLevel.get(l)?.DecisionFa === "rejected") ?? null;
  const signed = APPROVAL_LEVELS.filter((l) => byLevel.get(l)?.DecisionFa === "approved");
  const pending = APPROVAL_LEVELS.filter((l) => !byLevel.has(l));
  const outOfOrderFa = [];
  for (let i = 0; i < APPROVAL_LEVELS.length; i += 1) {
    const level = APPROVAL_LEVELS[i];
    if (!byLevel.has(level)) continue;
    const unsignedBefore = APPROVAL_LEVELS.slice(0, i).filter((prev) => !byLevel.has(prev));
    if (unsignedBefore.length) {
      outOfOrderFa.push(
        `${APPROVAL_LEVEL_FA[level]} \u067E\u06CC\u0634 \u0627\u0632 ${unsignedBefore.map((x) => APPROVAL_LEVEL_FA[x]).join(" \u0648 ")} \u0627\u0645\u0636\u0627 \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A`
      );
    }
  }
  return {
    signed,
    pending,
    nextLevel: rejected ? null : pending[0] ?? null,
    rejectedBy: rejected,
    isComplete: rejected === null && signed.length === APPROVAL_LEVELS.length,
    outOfOrderFa
  };
}
function canSignPermit(args) {
  const { permit, approvals, level, approverId } = args;
  const blockersFa = [];
  if (!APPROVAL_LEVELS.includes(level)) {
    blockersFa.push("\u0633\u0637\u062D \u0627\u0645\u0636\u0627 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A");
    return { ok: false, blockersFa };
  }
  if (permit.Status === "closed" || permit.Status === "expired" || permit.Status === "rejected") {
    blockersFa.push(`\u067E\u0631\u0648\u0627\u0646\u0647\u0654 ${PERMIT_STATUS_FA[permit.Status] ?? permit.Status} \u0627\u0645\u0636\u0627 \u0646\u0645\u06CC\u200C\u067E\u0630\u06CC\u0631\u062F`);
  }
  const chain = approvalChain(approvals, permit.Id);
  if (chain.rejectedBy) {
    blockersFa.push(`${APPROVAL_LEVEL_FA[chain.rejectedBy]} \u067E\u0631\u0648\u0627\u0646\u0647 \u0631\u0627 \u0631\u062F \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A`);
  }
  if (chain.signed.includes(level) || approvals.some((a) => a.PermitId === permit.Id && a.ApprovalLevel === level)) {
    blockersFa.push(`${APPROVAL_LEVEL_FA[level]} \u0642\u0628\u0644\u0627\u064B \u0646\u0638\u0631 \u062E\u0648\u062F \u0631\u0627 \u062B\u0628\u062A \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A`);
  }
  if (chain.nextLevel && chain.nextLevel !== level) {
    blockersFa.push(`\u0646\u0648\u0628\u062A \u0627\u0645\u0636\u0627\u06CC ${APPROVAL_LEVEL_FA[chain.nextLevel]} \u0627\u0633\u062A`);
  }
  if (approverId && approverId === permit.RequestedBy) {
    blockersFa.push("\u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u06A9\u0646\u0646\u062F\u0647 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u062E\u0648\u062F \u0631\u0627 \u0627\u0645\u0636\u0627 \u06A9\u0646\u062F");
  }
  return { ok: blockersFa.length === 0, blockersFa };
}
function precautionState(precautions, permitId) {
  const mine = precautions.filter((p) => p.PermitId === permitId);
  const confirmed = mine.filter((p) => p.IsConfirmed === true).length;
  const unconfirmed = mine.filter((p) => p.IsConfirmed === false).length;
  const unchecked = mine.filter((p) => p.IsConfirmed === null || p.IsConfirmed === void 0).length;
  const mandatoryPendingFa = mine.filter((p) => p.IsMandatory !== false && p.IsConfirmed !== true).map((p) => {
    const stateFa = p.IsConfirmed === false ? "\u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u06CC\u0633\u062A" : "\u0628\u0631\u0631\u0633\u06CC \u0646\u0634\u062F\u0647";
    return `\u0627\u0642\u062F\u0627\u0645 ${p.PrecautionNo}: ${p.PrecautionFa} \u2014 ${stateFa}`;
  });
  return {
    total: mine.length,
    confirmed,
    unconfirmed,
    unchecked,
    mandatoryPendingFa,
    isReady: mandatoryPendingFa.length === 0
  };
}
function canIssuePermit(args) {
  const {
    permit,
    jsa = null,
    gasTests = [],
    isolations = [],
    approvals = [],
    precautions = [],
    approverId,
    now = /* @__PURE__ */ new Date()
  } = args;
  const blockersFa = [];
  const warningsFa = [];
  const checks = {
    baseGate: false,
    jsa: false,
    gasTest: false,
    isolation: false,
    approvals: false,
    precautions: false
  };
  const base = canApprovePermit(permit, approverId);
  const LEGACY_GAS_BLOCKER = "\u0646\u062A\u06CC\u062C\u0647\u0654 \u0622\u0632\u0645\u0648\u0646 \u06AF\u0627\u0632 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A";
  const baseBlockers = base.blockersFa.filter((b) => b !== LEGACY_GAS_BLOCKER);
  checks.baseGate = baseBlockers.length === 0;
  blockersFa.push(...baseBlockers);
  const type = permit.PermitType;
  const jsaId = String(permit.JsaId ?? "").trim();
  if (!jsaId) {
    blockersFa.push("\u067E\u0631\u0648\u0627\u0646\u0647 \u0628\u0647 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0634\u063A\u0644\u06CC \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A");
  } else if (!jsa) {
    blockersFa.push("\u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u0631\u06CC\u0633\u06A9 \u0645\u0631\u062A\u0628\u0637 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F");
  } else {
    const support = jsaSupportsPermit(jsa, now);
    if (!support.ok) blockersFa.push(...support.blockersFa);
    else checks.jsa = true;
  }
  if (GAS_TEST_REQUIRED_PERMITS.includes(type)) {
    const gas = latestGasTest(gasTests, permit.Id, now);
    if (!gas.test) {
      blockersFa.push(`${PERMIT_TYPE_FA[type] ?? type} \u0628\u062F\u0648\u0646 \u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A`);
    } else if (!gas.isSafe) {
      const detail = evaluateGasTest(gas.test);
      blockersFa.push(
        detail.breachesFa.length ? `\u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u062E\u0627\u0631\u062C \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 \u0627\u06CC\u0645\u0646: ${detail.breachesFa.join("\u060C ")}` : "\u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u0647\u06CC\u0686 \u067E\u0627\u0631\u0627\u0645\u062A\u0631\u06CC \u0631\u0627 \u0627\u0646\u062F\u0627\u0632\u0647 \u0646\u06AF\u0631\u0641\u062A\u0647 \u0627\u0633\u062A"
      );
    } else if (!gas.isFresh) {
      blockersFa.push(
        `\u06AF\u0627\u0632\u0633\u0646\u062C\u06CC ${gas.ageMinutes} \u062F\u0642\u06CC\u0642\u0647 \u067E\u06CC\u0634 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647 \u2014 \u0627\u0639\u062A\u0628\u0627\u0631 \u0622\u0646 ${GAS_TEST_VALIDITY_MINUTES} \u062F\u0642\u06CC\u0642\u0647 \u0627\u0633\u062A`
      );
    } else {
      const detail = evaluateGasTest(gas.test);
      if (detail.missingFa.length) {
        blockersFa.push(
          `\u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u0646\u0627\u0642\u0635 \u0627\u0633\u062A: ${detail.missingFa.join("\u060C ")}`
        );
      } else {
        checks.gasTest = true;
      }
    }
  } else {
    checks.gasTest = true;
    const gas = latestGasTest(gasTests, permit.Id, now);
    if (gas.test && !gas.isSafe) {
      warningsFa.push("\u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u062E\u0627\u0631\u062C \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 \u0627\u06CC\u0645\u0646 \u0627\u0633\u062A \u0647\u0631\u0686\u0646\u062F \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0646\u0648\u0639 \u067E\u0631\u0648\u0627\u0646\u0647 \u0627\u062C\u0628\u0627\u0631\u06CC \u0646\u06CC\u0633\u062A");
    }
  }
  const iso = isolationState(isolations, permit.Id);
  if (ISOLATION_REQUIRED_PERMITS.includes(type)) {
    if (iso.total === 0) {
      blockersFa.push(`${PERMIT_TYPE_FA[type] ?? type} \u0628\u062F\u0648\u0646 \u062B\u0628\u062A \u0627\u06CC\u0632\u0648\u0644\u0627\u0633\u06CC\u0648\u0646 \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A`);
    } else if (!iso.allApplied) {
      blockersFa.push(`${iso.planned} \u0627\u06CC\u0632\u0648\u0644\u0627\u0633\u06CC\u0648\u0646 \u0647\u0646\u0648\u0632 \u0627\u0639\u0645\u0627\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
    } else {
      checks.isolation = true;
    }
  } else {
    checks.isolation = true;
    if (iso.planned > 0) warningsFa.push(`${iso.planned} \u0627\u06CC\u0632\u0648\u0644\u0627\u0633\u06CC\u0648\u0646 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647 \u0647\u0646\u0648\u0632 \u0627\u0639\u0645\u0627\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  blockersFa.push(...iso.missingLockFa);
  const chain = approvalChain(approvals, permit.Id);
  if (chain.rejectedBy) {
    blockersFa.push(`${APPROVAL_LEVEL_FA[chain.rejectedBy]} \u067E\u0631\u0648\u0627\u0646\u0647 \u0631\u0627 \u0631\u062F \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A`);
  } else if (!chain.isComplete) {
    blockersFa.push(
      `\u0627\u0645\u0636\u0627\u06CC ${chain.pending.map((l) => APPROVAL_LEVEL_FA[l]).join(" \u0648 ")} \u0628\u0627\u0642\u06CC \u0645\u0627\u0646\u062F\u0647 \u0627\u0633\u062A`
    );
  } else {
    checks.approvals = true;
  }
  warningsFa.push(...chain.outOfOrderFa);
  const prec = precautionState(precautions, permit.Id);
  if (prec.total === 0) {
    warningsFa.push("\u0647\u06CC\u0686 \u0627\u0642\u062F\u0627\u0645 \u0627\u062D\u062A\u06CC\u0627\u0637\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u067E\u0631\u0648\u0627\u0646\u0647 \u062A\u0639\u0631\u06CC\u0641 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
    checks.precautions = true;
  } else if (!prec.isReady) {
    blockersFa.push(...prec.mandatoryPendingFa);
  } else {
    checks.precautions = true;
  }
  return { ok: blockersFa.length === 0, blockersFa, warningsFa, checks };
}
function canClosePermit(args) {
  const { permit, isolations = [], openIncidents = 0, closerId } = args;
  const blockersFa = [];
  const warningsFa = [];
  if (permit.Status === "closed") blockersFa.push("\u0627\u06CC\u0646 \u067E\u0631\u0648\u0627\u0646\u0647 \u0642\u0628\u0644\u0627\u064B \u0628\u0633\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A");
  if (permit.Status === "draft") blockersFa.push("\u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u0628\u0633\u062A\u0646\u06CC \u0646\u06CC\u0633\u062A");
  const iso = isolationState(isolations, permit.Id);
  if (iso.total > 0 && !iso.allRemoved) {
    const left = iso.total - iso.removed;
    blockersFa.push(`${left} \u0642\u0641\u0644 \u0647\u0646\u0648\u0632 \u0631\u0648\u06CC \u062A\u062C\u0647\u06CC\u0632 \u0627\u0633\u062A \u2014 \u067E\u06CC\u0634 \u0627\u0632 \u0628\u0633\u062A\u0646 \u067E\u0631\u0648\u0627\u0646\u0647 \u0628\u0627\u06CC\u062F \u0628\u0631\u062F\u0627\u0634\u062A\u0647 \u0634\u0648\u062F`);
  }
  if (openIncidents > 0) {
    blockersFa.push(`${openIncidents} \u0631\u0648\u06CC\u062F\u0627\u062F \u0627\u06CC\u0645\u0646\u06CC \u0628\u0627\u0632 \u0632\u06CC\u0631 \u0627\u06CC\u0646 \u067E\u0631\u0648\u0627\u0646\u0647 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  if (closerId && closerId === permit.RequestedBy) {
    warningsFa.push("\u067E\u0631\u0648\u0627\u0646\u0647 \u0628\u0647\u200C\u062F\u0633\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u06A9\u0646\u0646\u062F\u0647 \u0628\u0633\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F");
  }
  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}
function canSuspendPermit(permit) {
  const blockersFa = [];
  if (permit.Status !== "active") {
    blockersFa.push(`\u0641\u0642\u0637 \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u0641\u0639\u0627\u0644 \u0642\u0627\u0628\u0644 \u062A\u0639\u0644\u06CC\u0642 \u0627\u0633\u062A \u2014 \u0648\u0636\u0639\u06CC\u062A \u0641\u0639\u0644\u06CC: ${PERMIT_STATUS_FA[permit.Status] ?? permit.Status}`);
  }
  return { ok: blockersFa.length === 0, blockersFa };
}
function canResumePermit(permit, now = /* @__PURE__ */ new Date(), gasTests = []) {
  const blockersFa = [];
  if (permit.Status !== "suspended") {
    blockersFa.push(`\u0641\u0642\u0637 \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u0645\u0639\u0644\u0642 \u0642\u0627\u0628\u0644 \u0627\u0632\u0633\u0631\u06AF\u06CC\u0631\u06CC \u0627\u0633\u062A \u2014 \u0648\u0636\u0639\u06CC\u062A \u0641\u0639\u0644\u06CC: ${PERMIT_STATUS_FA[permit.Status] ?? permit.Status}`);
  }
  const to = new Date(permit.ValidTo).getTime();
  if (Number.isFinite(to) && now.getTime() > to) {
    blockersFa.push("\u0627\u0639\u062A\u0628\u0627\u0631 \u067E\u0631\u0648\u0627\u0646\u0647 \u062F\u0631 \u0645\u062F\u062A \u062A\u0639\u0644\u06CC\u0642 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u2014 \u062A\u0645\u062F\u06CC\u062F \u0644\u0627\u0632\u0645 \u0627\u0633\u062A");
  }
  if (GAS_TEST_REQUIRED_PERMITS.includes(permit.PermitType)) {
    const gas = latestGasTest(gasTests, permit.Id, now);
    if (!gas.test) {
      blockersFa.push("\u0627\u0632\u0633\u0631\u06AF\u06CC\u0631\u06CC \u0627\u06CC\u0646 \u067E\u0631\u0648\u0627\u0646\u0647 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0627\u0633\u062A");
    } else if (!gas.isSafe) {
      blockersFa.push("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u062E\u0627\u0631\u062C \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 \u0627\u06CC\u0645\u0646 \u0627\u0633\u062A");
    } else if (!gas.isFresh) {
      blockersFa.push(`\u06AF\u0627\u0632\u0633\u0646\u062C\u06CC ${gas.ageMinutes} \u062F\u0642\u06CC\u0642\u0647 \u067E\u06CC\u0634 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647 \u2014 \u0642\u0631\u0627\u0626\u062A \u062A\u0627\u0632\u0647 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A`);
    }
  }
  return { ok: blockersFa.length === 0, blockersFa };
}
function ptwSummary(args) {
  const { permits, gasTests = [], isolations = [], now = /* @__PURE__ */ new Date() } = args;
  const byStatus = {};
  for (const s of PERMIT_STATUSES) byStatus[s] = 0;
  const byType = {};
  for (const t of PERMIT_TYPES) byType[t] = 0;
  let activeNow = 0;
  let expiringSoon = 0;
  let expiredNotClosed = 0;
  let highRiskActive = 0;
  for (const p of permits) {
    const st = permitState(p, now);
    byStatus[st.effectiveStatus] = (byStatus[st.effectiveStatus] ?? 0) + 1;
    byType[p.PermitType] = (byType[p.PermitType] ?? 0) + 1;
    if (st.isValidNow) {
      activeNow += 1;
      if (HIGH_RISK_PERMITS.includes(p.PermitType)) highRiskActive += 1;
      if (st.expiresInHours !== null && st.expiresInHours <= 4) expiringSoon += 1;
    }
    if (st.effectiveStatus === "expired" && p.Status !== "closed") expiredNotClosed += 1;
  }
  const unsafeGasTests = gasTests.filter((t) => !evaluateGasTest(t).isSafe).length;
  const locksOnEquipment = isolations.filter((i) => i.Status === "applied").length;
  const warningsFa = [];
  if (expiredNotClosed > 0) {
    warningsFa.push(`${expiredNotClosed} \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u0645\u0646\u0642\u0636\u06CC \u0647\u0646\u0648\u0632 \u0628\u0633\u062A\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  if (expiringSoon > 0) {
    warningsFa.push(`${expiringSoon} \u067E\u0631\u0648\u0627\u0646\u0647 \u06A9\u0645\u062A\u0631 \u0627\u0632 \u06F4 \u0633\u0627\u0639\u062A \u0627\u0639\u062A\u0628\u0627\u0631 \u062F\u0627\u0631\u062F`);
  }
  if (unsafeGasTests > 0) {
    warningsFa.push(`${unsafeGasTests} \u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u062E\u0627\u0631\u062C \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 \u0627\u06CC\u0645\u0646 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  return {
    total: permits.length,
    byStatus,
    byType,
    activeNow,
    expiringSoon,
    expiredNotClosed,
    highRiskActive,
    unsafeGasTests,
    locksOnEquipment,
    warningsFa
  };
}
var INJURY_TYPES = [
  "cut",
  "fracture",
  "burn",
  "poisoning",
  "crush",
  "sprain",
  "eye",
  "other"
];
var INJURY_TYPE_FA = {
  cut: "\u0628\u0631\u06CC\u062F\u06AF\u06CC",
  fracture: "\u0634\u06A9\u0633\u062A\u06AF\u06CC",
  burn: "\u0633\u0648\u062E\u062A\u06AF\u06CC",
  poisoning: "\u0645\u0633\u0645\u0648\u0645\u06CC\u062A",
  crush: "\u0644\u0647\u200C\u0634\u062F\u06AF\u06CC",
  sprain: "\u06A9\u0634\u06CC\u062F\u06AF\u06CC \u0648 \u0631\u06AF\u200C\u0628\u0647\u200C\u0631\u06AF",
  eye: "\u0622\u0633\u06CC\u0628 \u0686\u0634\u0645",
  other: "\u0633\u0627\u06CC\u0631"
};
var BODY_PARTS = [
  "head",
  "eye",
  "hand",
  "arm",
  "leg",
  "foot",
  "torso",
  "back",
  "multiple"
];
var BODY_PART_FA = {
  head: "\u0633\u0631",
  eye: "\u0686\u0634\u0645",
  hand: "\u062F\u0633\u062A",
  arm: "\u0628\u0627\u0632\u0648",
  leg: "\u067E\u0627",
  foot: "\u06A9\u0641 \u067E\u0627",
  torso: "\u062A\u0646\u0647",
  back: "\u06A9\u0645\u0631",
  multiple: "\u0686\u0646\u062F \u0646\u0627\u062D\u06CC\u0647"
};
var CAUSE_LEVELS = ["immediate", "underlying", "root"];
var CAUSE_LEVEL_FA = {
  immediate: "\u0639\u0644\u062A \u0628\u06CC\u200C\u0648\u0627\u0633\u0637\u0647",
  underlying: "\u0639\u0644\u062A \u0632\u0645\u06CC\u0646\u0647\u200C\u0627\u06CC",
  root: "\u0639\u0644\u062A \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC"
};
var CAUSE_CATEGORIES = [
  "man",
  "machine",
  "method",
  "material",
  "environment",
  "management"
];
var CAUSE_CATEGORY_FA = {
  man: "\u0646\u06CC\u0631\u0648\u06CC \u0627\u0646\u0633\u0627\u0646\u06CC",
  machine: "\u0645\u0627\u0634\u06CC\u0646 \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A",
  method: "\u0631\u0648\u0634 \u0627\u062C\u0631\u0627",
  material: "\u0645\u0648\u0627\u062F \u0648 \u0645\u0635\u0627\u0644\u062D",
  environment: "\u0645\u062D\u06CC\u0637",
  management: "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0648 \u0633\u0627\u0645\u0627\u0646\u0647"
};
var CAPA_TYPES = ["corrective", "preventive"];
var CAPA_TYPE_FA = {
  corrective: "\u0627\u0635\u0644\u0627\u062D\u06CC",
  preventive: "\u067E\u06CC\u0634\u06AF\u06CC\u0631\u0627\u0646\u0647"
};
var CAPA_STATUSES = ["open", "in_progress", "completed", "verified", "cancelled"];
var CAPA_STATUS_FA = {
  open: "\u0628\u0627\u0632",
  in_progress: "\u062F\u0631 \u062D\u0627\u0644 \u0627\u0646\u062C\u0627\u0645",
  completed: "\u0627\u0646\u062C\u0627\u0645\u200C\u0634\u062F\u0647",
  verified: "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647",
  cancelled: "\u0644\u063A\u0648\u0634\u062F\u0647"
};
var INVESTIGATION_STATUSES = ["open", "in_progress", "completed", "approved"];
var INVESTIGATION_STATUS_FA = {
  open: "\u0628\u0627\u0632",
  in_progress: "\u062F\u0631 \u062D\u0627\u0644 \u0628\u0631\u0631\u0633\u06CC",
  completed: "\u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647",
  approved: "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647"
};
var INVESTIGATION_REQUIRED_TYPES = [
  "lost_time",
  "fatality",
  "environmental"
];
var FLASH_REPORT_SLA_MINUTES = 15;
var MIN_ROOT_CAUSE_DEPTH = 3;
var ICEBERG_RATIO_MIN = 4;
function validateInjuredPersonInput(input) {
  const out = [];
  if (!String(input.FullNameFa ?? "").trim()) {
    out.push({ code: "E-HSE-INJURED-NAME-REQUIRED", message: "\u0646\u0627\u0645 \u0641\u0631\u062F \u0645\u0635\u062F\u0648\u0645 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!INJURY_TYPES.includes(input.InjuryType)) {
    out.push({ code: "E-HSE-INJURY-TYPE", message: "\u0646\u0648\u0639 \u0622\u0633\u06CC\u0628 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (input.BodyPart != null && !BODY_PARTS.includes(input.BodyPart)) {
    out.push({ code: "E-HSE-BODY-PART", message: "\u0646\u0627\u062D\u06CC\u0647\u0654 \u0622\u0633\u06CC\u0628 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  for (const [field, label] of [["LostWorkDays", "\u0631\u0648\u0632\u0647\u0627\u06CC \u0627\u0632 \u062F\u0633\u062A \u0631\u0641\u062A\u0647"], ["RestrictedDays", "\u0631\u0648\u0632\u0647\u0627\u06CC \u06A9\u0627\u0631 \u0633\u0628\u06A9"]]) {
    const v = input[field];
    if (v != null && (!Number.isFinite(Number(v)) || Number(v) < 0)) {
      out.push({ code: "E-HSE-DAYS-RANGE", message: `${label} \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F` });
    }
  }
  return out;
}
function validateRootCauseInput(input) {
  const out = [];
  if (!String(input.StatementFa ?? "").trim()) {
    out.push({ code: "E-HSE-CAUSE-STATEMENT-REQUIRED", message: "\u0634\u0631\u062D \u0639\u0644\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!CAUSE_LEVELS.includes(input.CauseLevel)) {
    out.push({ code: "E-HSE-CAUSE-LEVEL", message: "\u0633\u0637\u062D \u0639\u0644\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (input.Category != null && !CAUSE_CATEGORIES.includes(input.Category)) {
    out.push({ code: "E-HSE-CAUSE-CATEGORY", message: "\u062F\u0633\u062A\u0647\u0654 \u0639\u0644\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  return out;
}
function validateCapaInput(input) {
  const out = [];
  if (!String(input.ActionFa ?? "").trim()) {
    out.push({ code: "E-HSE-CAPA-ACTION-REQUIRED", message: "\u0634\u0631\u062D \u0627\u0642\u062F\u0627\u0645 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!CAPA_TYPES.includes(input.ActionType)) {
    out.push({ code: "E-HSE-CAPA-TYPE", message: "\u0646\u0648\u0639 \u0627\u0642\u062F\u0627\u0645 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!String(input.OwnerRef ?? "").trim()) {
    out.push({ code: "E-HSE-CAPA-OWNER-REQUIRED", message: "\u0645\u0633\u0626\u0648\u0644 \u0627\u0642\u062F\u0627\u0645 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.DueDate ?? "").trim()) {
    out.push({ code: "E-HSE-CAPA-DUE-REQUIRED", message: "\u0645\u0647\u0644\u062A \u0627\u0642\u062F\u0627\u0645 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  return out;
}
function flashReportStatus(incident, now = /* @__PURE__ */ new Date()) {
  const occurred = new Date(incident.OccurredAt).getTime();
  const flash = incident.FlashReportAt;
  if (!Number.isFinite(occurred)) {
    return { reported: false, delayMinutes: null, withinSla: false, pendingMinutes: null, statusFa: "\u0632\u0645\u0627\u0646 \u0648\u0642\u0648\u0639 \u0646\u0627\u0645\u0639\u062A\u0628\u0631" };
  }
  if (!flash) {
    const pending = round2((now.getTime() - occurred) / 6e4);
    return {
      reported: false,
      delayMinutes: null,
      /* گزارش‌نشده هرگز «در مهلت» نیست، حتی اگر تازه رخ داده باشد. */
      withinSla: false,
      pendingMinutes: pending >= 0 ? pending : null,
      statusFa: pending > FLASH_REPORT_SLA_MINUTES ? "\u06AF\u0632\u0627\u0631\u0634 \u0641\u0648\u0631\u06CC \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F\u0647 \u2014 \u0645\u0647\u0644\u062A \u06AF\u0630\u0634\u062A\u0647" : "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u06AF\u0632\u0627\u0631\u0634 \u0641\u0648\u0631\u06CC"
    };
  }
  const at = new Date(flash).getTime();
  if (!Number.isFinite(at)) {
    return { reported: false, delayMinutes: null, withinSla: false, pendingMinutes: null, statusFa: "\u0632\u0645\u0627\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0646\u0627\u0645\u0639\u062A\u0628\u0631" };
  }
  const delay = round2((at - occurred) / 6e4);
  if (delay < 0) {
    return {
      reported: true,
      delayMinutes: delay,
      withinSla: false,
      pendingMinutes: null,
      statusFa: "\u0632\u0645\u0627\u0646 \u06AF\u0632\u0627\u0631\u0634 \u067E\u06CC\u0634 \u0627\u0632 \u0632\u0645\u0627\u0646 \u0648\u0642\u0648\u0639 \u0627\u0633\u062A \u2014 \u062A\u0627\u0631\u06CC\u062E\u200C\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u06CC\u062F"
    };
  }
  const withinSla = delay <= FLASH_REPORT_SLA_MINUTES;
  return {
    reported: true,
    delayMinutes: delay,
    withinSla,
    pendingMinutes: null,
    statusFa: withinSla ? "\u062F\u0631 \u0645\u0647\u0644\u062A \u06AF\u0632\u0627\u0631\u0634 \u0634\u062F" : `\u0628\u0627 ${delay} \u062F\u0642\u06CC\u0642\u0647 \u062A\u0623\u062E\u06CC\u0631 \u06AF\u0632\u0627\u0631\u0634 \u0634\u062F`
  };
}
function injurySummary(persons, incidentId) {
  const mine = persons.filter((p) => p.IncidentId === incidentId);
  const byInjuryType = {};
  for (const t of INJURY_TYPES) byInjuryType[t] = 0;
  const byBodyPart = {};
  for (const b of BODY_PARTS) byBodyPart[b] = 0;
  let totalLostDays = 0;
  let totalRestrictedDays = 0;
  let maxLostDays = 0;
  for (const p of mine) {
    byInjuryType[p.InjuryType] = (byInjuryType[p.InjuryType] ?? 0) + 1;
    if (p.BodyPart) byBodyPart[p.BodyPart] = (byBodyPart[p.BodyPart] ?? 0) + 1;
    const lost = Number(p.LostWorkDays ?? 0) || 0;
    totalLostDays += lost;
    totalRestrictedDays += Number(p.RestrictedDays ?? 0) || 0;
    if (lost > maxLostDays) maxLostDays = lost;
  }
  const returnedCount = mine.filter((p) => p.ReturnedToWork === true).length;
  return {
    count: mine.length,
    totalLostDays,
    totalRestrictedDays,
    maxLostDays,
    returnedCount,
    /* کسی که هنوز برنگشته و روز از دست رفته دارد. */
    stillOffWork: mine.filter((p) => p.ReturnedToWork !== true && (Number(p.LostWorkDays ?? 0) || 0) > 0).length,
    byInjuryType,
    byBodyPart
  };
}
function rootCauseTree(nodes, investigationId) {
  const mine = nodes.filter((n) => n.InvestigationId === investigationId);
  const byId = new Map(mine.map((n) => [n.Id, n]));
  const byLevel = {};
  for (const l of CAUSE_LEVELS) byLevel[l] = 0;
  const byCategory = {};
  for (const c of CAUSE_CATEGORIES) byCategory[c] = 0;
  let maxDepth = 0;
  const orphanIds = [];
  for (const n of mine) {
    byLevel[n.CauseLevel] = (byLevel[n.CauseLevel] ?? 0) + 1;
    if (n.Category) byCategory[n.Category] = (byCategory[n.Category] ?? 0) + 1;
    const d = Number(n.Depth ?? 0) || 0;
    if (d > maxDepth) maxDepth = d;
    if (n.ParentId && !byId.has(n.ParentId)) orphanIds.push(n.Id);
  }
  const cyclicIds = [];
  for (const n of mine) {
    const seen = /* @__PURE__ */ new Set([n.Id]);
    let cur = n.ParentId ? byId.get(n.ParentId) : void 0;
    let hops = 0;
    while (cur && hops <= mine.length) {
      if (seen.has(cur.Id)) {
        cyclicIds.push(n.Id);
        break;
      }
      seen.add(cur.Id);
      cur = cur.ParentId ? byId.get(cur.ParentId) : void 0;
      hops += 1;
    }
  }
  const rootCauses = mine.filter((n) => n.CauseLevel === "root");
  const warningsFa = [];
  if (orphanIds.length) warningsFa.push(`${orphanIds.length} \u06AF\u0631\u0647 \u0648\u0627\u0644\u062F \u0646\u0627\u0645\u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F`);
  if (cyclicIds.length) warningsFa.push(`${cyclicIds.length} \u06AF\u0631\u0647 \u062F\u0631 \u062D\u0644\u0642\u0647\u0654 \u0627\u0631\u062C\u0627\u0639\u06CC \u0627\u0633\u062A`);
  if (mine.length && !rootCauses.length) warningsFa.push("\u0647\u06CC\u0686 \u0639\u0644\u062A \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  return {
    total: mine.length,
    maxDepth,
    /* تعداد لایه‌ها — مصرف‌کننده نباید خودش `maxDepth + 1` حساب کند. */
    layerCount: mine.length ? maxDepth + 1 : 0,
    byLevel,
    byCategory,
    rootCauses,
    verifiedRoots: rootCauses.filter((n) => n.IsVerified === true).length,
    orphanIds,
    cyclicIds,
    warningsFa
  };
}
function capaSummary(actions, now = /* @__PURE__ */ new Date()) {
  const byStatus = {};
  for (const s of CAPA_STATUSES) byStatus[s] = 0;
  const byType = {};
  for (const t2 of CAPA_TYPES) byType[t2] = 0;
  let overdue = 0;
  let dueSoon = 0;
  const overdueFa = [];
  const t = now.getTime();
  for (const a of actions) {
    byStatus[a.Status] = (byStatus[a.Status] ?? 0) + 1;
    byType[a.ActionType] = (byType[a.ActionType] ?? 0) + 1;
    const isOpen = a.Status === "open" || a.Status === "in_progress";
    if (!isOpen) continue;
    const due = new Date(a.DueDate).getTime();
    if (!Number.isFinite(due)) continue;
    const days = (due - t) / 864e5;
    if (days < 0) {
      overdue += 1;
      overdueFa.push(`\u0627\u0642\u062F\u0627\u0645 ${a.ActionNo}: ${a.ActionFa} \u2014 ${Math.abs(Math.round(days))} \u0631\u0648\u0632 \u062A\u0623\u062E\u06CC\u0631`);
    } else if (days <= 7) {
      dueSoon += 1;
    }
  }
  return {
    total: actions.length,
    byStatus,
    byType,
    open: (byStatus.open ?? 0) + (byStatus.in_progress ?? 0),
    overdue,
    dueSoon,
    verified: byStatus.verified ?? 0,
    /* اقدام لغوشده به‌عنوان پیشگیرانه به حساب نمی‌آید. */
    hasPreventive: actions.some((a) => a.ActionType === "preventive" && a.Status !== "cancelled"),
    overdueFa
  };
}
function requiresInvestigation(incident) {
  const type = incident.IncidentType;
  if (INVESTIGATION_REQUIRED_TYPES.includes(type)) {
    return { required: true, reasonFa: `${INCIDENT_TYPE_FA[type] ?? type} \u062A\u062D\u0642\u06CC\u0642 \u0631\u0633\u0645\u06CC \u0644\u0627\u0632\u0645 \u062F\u0627\u0631\u062F` };
  }
  if (incident.Severity === "critical" || incident.Severity === "high") {
    return { required: true, reasonFa: `\u0634\u062F\u062A ${SEVERITY_FA[incident.Severity] ?? incident.Severity} \u062A\u062D\u0642\u06CC\u0642 \u0631\u0633\u0645\u06CC \u0644\u0627\u0632\u0645 \u062F\u0627\u0631\u062F` };
  }
  return { required: false, reasonFa: null };
}
function canCloseInvestigation(args) {
  const { investigation, nodes = [], actions = [], approverId, requireDepth = true } = args;
  const blockersFa = [];
  const warningsFa = [];
  if (investigation.Status === "approved") {
    blockersFa.push("\u0627\u06CC\u0646 \u062A\u062D\u0642\u06CC\u0642 \u0642\u0628\u0644\u0627\u064B \u062A\u0623\u06CC\u06CC\u062F \u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  const tree = rootCauseTree(nodes, investigation.Id);
  if (!tree.total) {
    blockersFa.push("\u062F\u0631\u062E\u062A \u0631\u06CC\u0634\u0647\u200C\u06CC\u0627\u0628\u06CC \u062E\u0627\u0644\u06CC \u0627\u0633\u062A");
  } else {
    if (!tree.rootCauses.length) {
      blockersFa.push("\u0647\u06CC\u0686 \u0639\u0644\u062A \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
    }
    if (requireDepth && tree.layerCount < MIN_ROOT_CAUSE_DEPTH) {
      blockersFa.push(
        `\u0631\u06CC\u0634\u0647\u200C\u06CC\u0627\u0628\u06CC ${tree.layerCount} \u0644\u0627\u06CC\u0647 \u062F\u0627\u0631\u062F \u2014 \u062F\u0633\u062A\u200C\u06A9\u0645 ${MIN_ROOT_CAUSE_DEPTH} \u0644\u0627\u06CC\u0647 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A`
      );
    }
    if (tree.cyclicIds.length) {
      blockersFa.push(`${tree.cyclicIds.length} \u06AF\u0631\u0647 \u062F\u0631 \u062D\u0644\u0642\u0647\u0654 \u0627\u0631\u062C\u0627\u0639\u06CC \u0627\u0633\u062A \u0648 \u062F\u0631\u062E\u062A \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A`);
    }
    warningsFa.push(...tree.warningsFa.filter((w) => !w.includes("\u062D\u0644\u0642\u0647") && !w.includes("\u0631\u06CC\u0634\u0647\u200C\u0627\u06CC")));
  }
  const mine = actions.filter((a) => a.SourceId === investigation.Id || a.SourceId === investigation.IncidentId);
  const capa = capaSummary(mine);
  if (!capa.total) {
    blockersFa.push("\u0647\u06CC\u0686 \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u06CC\u0627 \u067E\u06CC\u0634\u06AF\u06CC\u0631\u0627\u0646\u0647\u200C\u0627\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  } else if (!capa.hasPreventive) {
    blockersFa.push("\u062F\u0633\u062A\u200C\u06A9\u0645 \u06CC\u06A9 \u0627\u0642\u062F\u0627\u0645 \u067E\u06CC\u0634\u06AF\u06CC\u0631\u0627\u0646\u0647 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A \u2014 \u0627\u0642\u062F\u0627\u0645 \u0635\u0631\u0641\u0627\u064B \u0627\u0635\u0644\u0627\u062D\u06CC \u062C\u0644\u0648\u06CC \u062A\u06A9\u0631\u0627\u0631 \u0631\u0627 \u0646\u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F");
  }
  if (capa.overdue > 0) {
    warningsFa.push(`${capa.overdue} \u0627\u0642\u062F\u0627\u0645 \u062F\u0627\u0631\u0627\u06CC \u062A\u0623\u062E\u06CC\u0631 \u0627\u0633\u062A`);
  }
  if (approverId && approverId === investigation.LeadInvestigator) {
    blockersFa.push("\u062A\u0623\u06CC\u06CC\u062F\u06A9\u0646\u0646\u062F\u0647\u0654 \u062A\u062D\u0642\u06CC\u0642 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0647\u0645\u0627\u0646 \u0633\u0631\u067E\u0631\u0633\u062A \u062A\u062D\u0642\u06CC\u0642 \u0628\u0627\u0634\u062F");
  }
  const direct = Number(investigation.DirectCost ?? 0) || 0;
  const indirect = Number(investigation.IndirectCost ?? 0) || 0;
  if (direct > 0 && indirect === 0) {
    warningsFa.push("\u0647\u0632\u06CC\u0646\u0647\u0654 \u063A\u06CC\u0631\u0645\u0633\u062A\u0642\u06CC\u0645 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u2014 \u0645\u0639\u0645\u0648\u0644\u0627\u064B \u0686\u0646\u062F \u0628\u0631\u0627\u0628\u0631 \u0647\u0632\u06CC\u0646\u0647\u0654 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0627\u0633\u062A");
  } else if (direct > 0 && indirect > 0 && indirect < direct * ICEBERG_RATIO_MIN) {
    warningsFa.push(
      `\u0646\u0633\u0628\u062A \u0647\u0632\u06CC\u0646\u0647\u0654 \u063A\u06CC\u0631\u0645\u0633\u062A\u0642\u06CC\u0645 \u0628\u0647 \u0645\u0633\u062A\u0642\u06CC\u0645 \u06A9\u0645\u062A\u0631 \u0627\u0632 ${ICEBERG_RATIO_MIN} \u0628\u0631\u0627\u0628\u0631 \u0627\u0633\u062A \u2014 \u0627\u062D\u062A\u0645\u0627\u0644 \u06A9\u0645\u200C\u0628\u0631\u0622\u0648\u0631\u062F\u06CC`
    );
  }
  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}
function canCloseIncidentFull(args) {
  const { incident, investigation = null, nodes = [], actions = [], persons = [], closerId } = args;
  const blockersFa = [];
  const warningsFa = [];
  if (incident.Status === "closed") {
    blockersFa.push("\u0627\u06CC\u0646 \u0631\u0648\u06CC\u062F\u0627\u062F \u0642\u0628\u0644\u0627\u064B \u0628\u0633\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  const need = requiresInvestigation(incident);
  if (need.required) {
    if (!investigation) {
      blockersFa.push(`${need.reasonFa} \u2014 \u062A\u062D\u0642\u06CC\u0642\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
    } else if (investigation.Status !== "approved") {
      blockersFa.push(
        `\u062A\u062D\u0642\u06CC\u0642 \u062F\u0631 \u0648\u0636\u0639\u06CC\u062A ${INVESTIGATION_STATUS_FA[investigation.Status] ?? investigation.Status} \u0627\u0633\u062A \u0648 \u0628\u0627\u06CC\u062F \u062A\u0623\u06CC\u06CC\u062F \u0634\u0648\u062F`
      );
    } else {
      const tree = rootCauseTree(nodes, investigation.Id);
      if (!tree.rootCauses.length) {
        blockersFa.push("\u062A\u062D\u0642\u06CC\u0642 \u062A\u0623\u06CC\u06CC\u062F \u0634\u062F\u0647 \u0648\u0644\u06CC \u0647\u06CC\u0686 \u0639\u0644\u062A \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC \u062F\u0631 \u062F\u0631\u062E\u062A \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
      } else if (!tree.verifiedRoots) {
        warningsFa.push("\u0647\u06CC\u0686\u200C\u06CC\u06A9 \u0627\u0632 \u0639\u0644\u0644 \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC \u0631\u0627\u0633\u062A\u06CC\u200C\u0622\u0632\u0645\u0627\u06CC\u06CC \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
      }
    }
  } else {
    if (!String(incident.RootCauseFa ?? "").trim()) {
      blockersFa.push("\u0631\u06CC\u0634\u0647\u200C\u06CC\u0627\u0628\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
    }
    if (!String(incident.CorrectiveActionFa ?? "").trim()) {
      blockersFa.push("\u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
    }
  }
  const src = investigation ? actions.filter((a) => a.SourceId === incident.Id || a.SourceId === investigation.Id) : actions.filter((a) => a.SourceId === incident.Id);
  const capa = capaSummary(src);
  if (capa.open > 0) {
    blockersFa.push(`${capa.open} \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u0647\u0646\u0648\u0632 \u0628\u0627\u0632 \u0627\u0633\u062A`);
  }
  const inj = injurySummary(persons, incident.Id);
  if (inj.stillOffWork > 0) {
    warningsFa.push(`${inj.stillOffWork} \u0645\u0635\u062F\u0648\u0645 \u0647\u0646\u0648\u0632 \u0628\u0647 \u06A9\u0627\u0631 \u0628\u0627\u0632\u0646\u06AF\u0634\u062A\u0647 \u0627\u0633\u062A`);
  }
  if (closerId && closerId === incident.ReportedBy) {
    warningsFa.push("\u0631\u0648\u06CC\u062F\u0627\u062F \u0628\u0647\u200C\u062F\u0633\u062A \u06AF\u0632\u0627\u0631\u0634\u200C\u062F\u0647\u0646\u062F\u0647 \u0628\u0633\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F");
  }
  const flash = flashReportStatus(incident);
  if (flash.reported && !flash.withinSla) {
    warningsFa.push(`\u06AF\u0632\u0627\u0631\u0634 \u0641\u0648\u0631\u06CC \u0628\u0627 ${flash.delayMinutes} \u062F\u0642\u06CC\u0642\u0647 \u062A\u0623\u062E\u06CC\u0631 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647 \u0628\u0648\u062F`);
  }
  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}
function manHourTotal(logs, from, to) {
  const f = from ? new Date(from).getTime() : null;
  const t = to ? new Date(to).getTime() : null;
  let totalHours = 0;
  let invalidCount = 0;
  let headSum = 0;
  let headDays = 0;
  const days = /* @__PURE__ */ new Set();
  const bySource = { manual: 0, timesheet: 0 };
  for (const l of logs) {
    const d = new Date(l.LogDate).getTime();
    const h = Number(l.ManHours);
    if (!Number.isFinite(d) || !Number.isFinite(h) || h < 0) {
      invalidCount += 1;
      continue;
    }
    if (f !== null && d < f) continue;
    if (t !== null && d > t) continue;
    totalHours += h;
    days.add(String(l.LogDate));
    bySource[l.SourceFa] = (bySource[l.SourceFa] ?? 0) + h;
    const hc = Number(l.HeadCount ?? 0);
    if (Number.isFinite(hc) && hc > 0) {
      headSum += hc;
      headDays += 1;
    }
  }
  return {
    totalHours: round2(totalHours),
    dayCount: days.size,
    invalidCount,
    avgHeadCount: headDays ? round2(headSum / headDays) : null,
    bySource
  };
}
function safetyMetricsFull(args) {
  const { incidents: allIncidents, persons = [], manHourLogs = [], from, to } = args;
  const f = from ? new Date(from).getTime() : null;
  const t2 = to ? new Date(to).getTime() : null;
  const incidents = f === null && t2 === null ? allIncidents : allIncidents.filter((i) => {
    const d = new Date(i.OccurredAt).getTime();
    if (!Number.isFinite(d)) return false;
    if (f !== null && d < f) return false;
    if (t2 !== null && d > t2 + 86399999) return false;
    return true;
  });
  const byType = {};
  for (const t of INCIDENT_TYPES) byType[t] = 0;
  for (const i of incidents) byType[i.IncidentType] = (byType[i.IncidentType] ?? 0) + 1;
  const incidentIds = new Set(incidents.map((i) => i.Id));
  const mine = persons.filter((p) => incidentIds.has(p.IncidentId));
  let lostDays = 0;
  let restrictedDays = 0;
  for (const p of mine) {
    lostDays += Number(p.LostWorkDays ?? 0) || 0;
    restrictedDays += Number(p.RestrictedDays ?? 0) || 0;
  }
  const warningsFa = [];
  if (!mine.length) {
    let legacy = 0;
    for (const i of incidents) legacy += Number(i.LostDays ?? 0) || 0;
    if (legacy > 0) {
      lostDays = legacy;
      warningsFa.push("\u0631\u0648\u0632\u0647\u0627\u06CC \u0627\u0632 \u062F\u0633\u062A \u0631\u0641\u062A\u0647 \u0627\u0632 \u0633\u062A\u0648\u0646 \u0642\u062F\u06CC\u0645\u06CC \u062E\u0648\u0627\u0646\u062F\u0647 \u0634\u062F \u2014 \u062C\u062F\u0648\u0644 \u0645\u0635\u062F\u0648\u0645\u0627\u0646 \u062E\u0627\u0644\u06CC \u0627\u0633\u062A");
    }
  }
  const recordable = incidents.filter((i) => RECORDABLE_TYPES.includes(i.IncidentType)).length;
  const lostTime = incidents.filter((i) => LOST_TIME_TYPES.includes(i.IncidentType)).length;
  const mh = manHourTotal(manHourLogs, from, to);
  const usable = mh.totalHours > 0 ? mh.totalHours : null;
  if (!usable) {
    warningsFa.push("\u0646\u0641\u0631\u0633\u0627\u0639\u062A \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u2014 \u0634\u0627\u062E\u0635\u200C\u0647\u0627\u06CC \u0646\u0633\u0628\u06CC \u0645\u062D\u0627\u0633\u0628\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F");
  }
  if (mh.invalidCount > 0) {
    warningsFa.push(`${mh.invalidCount} \u0633\u06CC\u0627\u0647\u0647\u0654 \u0646\u0641\u0631\u0633\u0627\u0639\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0646\u0627\u062F\u06CC\u062F\u0647 \u06AF\u0631\u0641\u062A\u0647 \u0634\u062F`);
  }
  return {
    total: incidents.length,
    byType,
    recordable,
    lostTime,
    lostDays,
    restrictedDays,
    injuredCount: mine.length,
    nearMiss: byType.near_miss ?? 0,
    openCount: incidents.filter((i) => i.Status !== "closed").length,
    manHours: usable,
    ltifr: usable ? round2(lostTime * 1e6 / usable) : null,
    trir: usable ? round2(recordable * 2e5 / usable) : null,
    /* نرخ شدت: روز از دست رفته به ازای یک میلیون نفرساعت. */
    severityRate: usable ? round2(lostDays * 1e6 / usable) : null,
    warningsFa
  };
}
var FINDING_CATEGORIES = [
  "unsafe_act",
  "unsafe_condition",
  "housekeeping",
  "ppe",
  "documentation",
  "environmental"
];
var FINDING_CATEGORY_FA = {
  unsafe_act: "\u0631\u0641\u062A\u0627\u0631 \u0646\u0627\u0627\u06CC\u0645\u0646",
  unsafe_condition: "\u0634\u0631\u0627\u06CC\u0637 \u0646\u0627\u0627\u06CC\u0645\u0646",
  housekeeping: "\u0646\u0638\u0645 \u0648 \u0646\u0638\u0627\u0641\u062A",
  ppe: "\u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062D\u0641\u0627\u0638\u062A \u0641\u0631\u062F\u06CC",
  documentation: "\u0645\u0633\u062A\u0646\u062F\u0627\u062A",
  environmental: "\u0632\u06CC\u0633\u062A\u200C\u0645\u062D\u06CC\u0637\u06CC"
};
var VIOLATION_TYPES = [
  "unsafe_act",
  "unsafe_condition",
  "no_ptw",
  "ppe_missing",
  "environmental",
  "housekeeping"
];
var VIOLATION_TYPE_FA = {
  unsafe_act: "\u0631\u0641\u062A\u0627\u0631 \u0646\u0627\u0627\u06CC\u0645\u0646",
  unsafe_condition: "\u0634\u0631\u0627\u06CC\u0637 \u0646\u0627\u0627\u06CC\u0645\u0646",
  no_ptw: "\u06A9\u0627\u0631 \u0628\u062F\u0648\u0646 \u067E\u0631\u0648\u0627\u0646\u0647",
  ppe_missing: "\u0646\u0628\u0648\u062F \u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062D\u0641\u0627\u0638\u062A \u0641\u0631\u062F\u06CC",
  environmental: "\u062A\u062E\u0644\u0641 \u0632\u06CC\u0633\u062A\u200C\u0645\u062D\u06CC\u0637\u06CC",
  housekeeping: "\u0628\u06CC\u200C\u0646\u0638\u0645\u06CC \u06A9\u0627\u0631\u06AF\u0627\u0647"
};
var STOP_WORK_SCOPES = ["activity", "area", "system", "project"];
var STOP_WORK_SCOPE_FA = {
  activity: "\u0641\u0639\u0627\u0644\u06CC\u062A",
  area: "\u0645\u0646\u0637\u0642\u0647",
  system: "\u0633\u06CC\u0633\u062A\u0645",
  project: "\u06A9\u0644 \u067E\u0631\u0648\u0698\u0647"
};
var VIOLATION_STATUSES = ["issued", "in_progress", "re_inspected", "closed", "void"];
var VIOLATION_STATUS_FA = {
  issued: "\u0635\u0627\u062F\u0631\u0634\u062F\u0647",
  in_progress: "\u062F\u0631 \u062D\u0627\u0644 \u0631\u0641\u0639",
  re_inspected: "\u0628\u0627\u0632\u0628\u06CC\u0646\u06CC\u200C\u0634\u062F\u0647",
  closed: "\u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0647",
  void: "\u0627\u0628\u0637\u0627\u0644\u200C\u0634\u062F\u0647"
};
var FINDING_STATUSES = ["open", "in_progress", "closed", "void"];
var FINDING_STATUS_FA = {
  open: "\u0628\u0627\u0632",
  in_progress: "\u062F\u0631 \u062D\u0627\u0644 \u0631\u0641\u0639",
  closed: "\u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0647",
  void: "\u0627\u0628\u0637\u0627\u0644\u200C\u0634\u062F\u0647"
};
var MANDATORY_STOP_WORK_TYPES = ["no_ptw"];
var VIOLATION_SLA_DAYS = {
  critical: 1,
  high: 3,
  medium: 7,
  low: 14
};
var INSPECTION_PASS_SCORE = 80;
function validateFindingInput(input) {
  const issues = [];
  if (!String(input.DescriptionFa ?? "").trim()) {
    issues.push({ code: "E-HSE-FINDING-DESC", message: "\u0634\u0631\u062D \u06CC\u0627\u0641\u062A\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!FINDING_CATEGORIES.includes(input.Category)) {
    issues.push({ code: "E-HSE-FINDING-CATEGORY", message: "\u062F\u0633\u062A\u0647\u0654 \u06CC\u0627\u0641\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!SEVERITIES.includes(input.Severity)) {
    issues.push({ code: "E-HSE-FINDING-SEVERITY", message: "\u0634\u062F\u062A \u06CC\u0627\u0641\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  return issues;
}
function validateViolationInput(input) {
  const issues = [];
  if (!String(input.ViolationNo ?? "").trim()) {
    issues.push({ code: "E-HSE-VIOLATION-NO", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u062A\u062E\u0644\u0641 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    issues.push({ code: "E-HSE-VIOLATION-TITLE", message: "\u0639\u0646\u0648\u0627\u0646 \u062A\u062E\u0644\u0641 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!VIOLATION_TYPES.includes(input.ViolationType)) {
    issues.push({ code: "E-HSE-VIOLATION-TYPE", message: "\u0646\u0648\u0639 \u062A\u062E\u0644\u0641 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!SEVERITIES.includes(input.Severity)) {
    issues.push({ code: "E-HSE-VIOLATION-SEVERITY", message: "\u0634\u062F\u062A \u062A\u062E\u0644\u0641 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!String(input.IssuedBy ?? "").trim()) {
    issues.push({ code: "E-HSE-VIOLATION-ISSUER", message: "\u0635\u0627\u062F\u0631\u06A9\u0646\u0646\u062F\u0647\u0654 \u062A\u062E\u0644\u0641 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (input.IssuedAt && !Number.isFinite(new Date(input.IssuedAt).getTime())) {
    issues.push({ code: "E-HSE-VIOLATION-DATE", message: "\u0632\u0645\u0627\u0646 \u0635\u062F\u0648\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (input.IsStopWork === true) {
    if (!STOP_WORK_SCOPES.includes(input.StopWorkScope)) {
      issues.push({ code: "E-HSE-SWO-SCOPE", message: "\u062F\u0627\u0645\u0646\u0647\u0654 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0648 \u0628\u0627\u06CC\u062F \u0645\u0639\u062A\u0628\u0631 \u0628\u0627\u0634\u062F" });
    }
    if (input.StopWorkScope === "activity" && !String(input.ActivityId ?? "").trim()) {
      issues.push({ code: "E-HSE-SWO-ACTIVITY", message: "\u062A\u0648\u0642\u0641 \u062F\u0631 \u0633\u0637\u062D \u0641\u0639\u0627\u0644\u06CC\u062A \u0628\u062F\u0648\u0646 \u0634\u0646\u0627\u0633\u0647\u0654 \u0641\u0639\u0627\u0644\u06CC\u062A \u0645\u0639\u0646\u0627 \u0646\u062F\u0627\u0631\u062F" });
    }
    if (input.StopWorkScope === "system" && !String(input.SystemId ?? "").trim()) {
      issues.push({ code: "E-HSE-SWO-SYSTEM", message: "\u062A\u0648\u0642\u0641 \u062F\u0631 \u0633\u0637\u062D \u0633\u06CC\u0633\u062A\u0645 \u0628\u062F\u0648\u0646 \u0634\u0646\u0627\u0633\u0647\u0654 \u0633\u06CC\u0633\u062A\u0645 \u0645\u0639\u0646\u0627 \u0646\u062F\u0627\u0631\u062F" });
    }
    if (input.StopWorkScope === "area" && !String(input.AreaFa ?? "").trim()) {
      issues.push({ code: "E-HSE-SWO-AREA", message: "\u062A\u0648\u0642\u0641 \u062F\u0631 \u0633\u0637\u062D \u0645\u0646\u0637\u0642\u0647 \u0628\u062F\u0648\u0646 \u0646\u0627\u0645 \u0645\u0646\u0637\u0642\u0647 \u0645\u0639\u0646\u0627 \u0646\u062F\u0627\u0631\u062F" });
    }
  }
  const fine = Number(input.FineAmount ?? 0);
  if (input.FineAmount != null && (!Number.isFinite(fine) || fine < 0)) {
    issues.push({ code: "E-HSE-VIOLATION-FINE", message: "\u0645\u0628\u0644\u063A \u062C\u0631\u06CC\u0645\u0647 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F" });
  }
  return issues;
}
function stopWorkRequirement(input) {
  if (MANDATORY_STOP_WORK_TYPES.includes(String(input.ViolationType))) {
    return {
      required: true,
      reasonFa: `${VIOLATION_TYPE_FA[String(input.ViolationType)]} \u0628\u062F\u0648\u0646 \u0627\u0633\u062A\u062B\u0646\u0627 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u062F\u0627\u0631\u062F`
    };
  }
  if (input.Severity === "critical") {
    return { required: true, reasonFa: "\u062A\u062E\u0644\u0641 \u0628\u0627 \u0634\u062F\u062A \u0628\u062D\u0631\u0627\u0646\u06CC \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u062F\u0627\u0631\u062F" };
  }
  return { required: false, reasonFa: null };
}
function suggestViolationDueDate(severity, issuedAt) {
  const days = VIOLATION_SLA_DAYS[severity];
  const t = new Date(issuedAt).getTime();
  if (days == null || !Number.isFinite(t)) return null;
  return new Date(t + days * 864e5).toISOString().slice(0, 10);
}
function findingSummary(findings, inspectionId, now = /* @__PURE__ */ new Date()) {
  const mine = findings.filter((f) => f.InspectionId === inspectionId);
  const byCategory = {};
  for (const c of FINDING_CATEGORIES) byCategory[c] = 0;
  const bySeverity = {};
  for (const s of SEVERITIES) bySeverity[s] = 0;
  let open = 0;
  let closed = 0;
  let overdue = 0;
  const overdueFa = [];
  const today = now.getTime();
  for (const f of mine) {
    byCategory[f.Category] = (byCategory[f.Category] ?? 0) + 1;
    bySeverity[f.Severity] = (bySeverity[f.Severity] ?? 0) + 1;
    if (f.Status === "closed") {
      closed += 1;
      continue;
    }
    if (f.Status === "void") continue;
    open += 1;
    const due = f.DueDate ? new Date(f.DueDate).getTime() : null;
    if (due != null && Number.isFinite(due) && due < today) {
      overdue += 1;
      overdueFa.push(`\u06CC\u0627\u0641\u062A\u0647\u0654 ${f.FindingNo}: ${f.DescriptionFa.slice(0, 40)}`);
    }
  }
  const denominator = open + closed;
  return {
    total: mine.length,
    open,
    closed,
    overdue,
    byCategory,
    bySeverity,
    closureRatePct: denominator ? round2(closed * 100 / denominator) : null,
    hasCritical: mine.some((f) => f.Severity === "critical" && f.Status !== "closed" && f.Status !== "void"),
    overdueFa
  };
}
function violationState(violation, now = /* @__PURE__ */ new Date()) {
  const status = violation.Status;
  const isClosed = status === "closed" || status === "void";
  const isOpen = !isClosed;
  const isBlocking = isOpen && violation.IsStopWork === true;
  let isEnforceable = true;
  let enforcementIssueFa = null;
  if (isBlocking) {
    const scope = violation.StopWorkScope;
    if (!scope) {
      isEnforceable = false;
      enforcementIssueFa = "\u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u0628\u062F\u0648\u0646 \u062F\u0627\u0645\u0646\u0647 \u062B\u0628\u062A \u0634\u062F\u0647 \u0648 \u0647\u06CC\u0686 \u06A9\u0627\u0631\u06CC \u0631\u0627 \u0645\u062A\u0648\u0642\u0641 \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F";
    } else if (!STOP_WORK_SCOPES.includes(scope)) {
      isEnforceable = false;
      enforcementIssueFa = `\u062F\u0627\u0645\u0646\u0647\u0654 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \xAB${scope}\xBB \u0634\u0646\u0627\u062E\u062A\u0647\u200C\u0634\u062F\u0647 \u0646\u06CC\u0633\u062A`;
    } else if (scope === "activity" && !String(violation.ActivityId ?? "").trim()) {
      isEnforceable = false;
      enforcementIssueFa = "\u062A\u0648\u0642\u0641 \u062F\u0631 \u0633\u0637\u062D \u0641\u0639\u0627\u0644\u06CC\u062A \u0628\u062F\u0648\u0646 \u0634\u0646\u0627\u0633\u0647\u0654 \u0641\u0639\u0627\u0644\u06CC\u062A \u0627\u0639\u0645\u0627\u0644 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F";
    } else if (scope === "system" && !String(violation.SystemId ?? "").trim()) {
      isEnforceable = false;
      enforcementIssueFa = "\u062A\u0648\u0642\u0641 \u062F\u0631 \u0633\u0637\u062D \u0633\u06CC\u0633\u062A\u0645 \u0628\u062F\u0648\u0646 \u0634\u0646\u0627\u0633\u0647\u0654 \u0633\u06CC\u0633\u062A\u0645 \u0627\u0639\u0645\u0627\u0644 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F";
    } else if (scope === "area" && !String(violation.AreaFa ?? "").trim()) {
      isEnforceable = false;
      enforcementIssueFa = "\u062A\u0648\u0642\u0641 \u062F\u0631 \u0633\u0637\u062D \u0645\u0646\u0637\u0642\u0647 \u0628\u062F\u0648\u0646 \u0646\u0627\u0645 \u0645\u0646\u0637\u0642\u0647 \u0627\u0639\u0645\u0627\u0644 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F";
    }
  }
  let isOverdue = false;
  let overdueDays = null;
  if (isOpen && violation.DueDate) {
    const due = new Date(violation.DueDate).getTime();
    if (Number.isFinite(due)) {
      const diff = Math.floor((now.getTime() - due) / 864e5);
      if (diff > 0) {
        isOverdue = true;
        overdueDays = diff;
      }
    }
  }
  return {
    status,
    statusFa: VIOLATION_STATUS_FA[status] ?? status,
    isOpen,
    isBlocking,
    isEnforceable,
    enforcementIssueFa,
    isOverdue,
    overdueDays,
    slaFa: isOverdue ? `${overdueDays} \u0631\u0648\u0632 \u0627\u0632 \u0645\u0647\u0644\u062A \u06AF\u0630\u0634\u062A\u0647` : isOpen ? "\u062F\u0631 \u0645\u0647\u0644\u062A" : "\u0628\u0633\u062A\u0647"
  };
}
function activityStopWorkState(args) {
  const now = args.now ?? /* @__PURE__ */ new Date();
  const blockingIds = [];
  const reasonsFa = [];
  const unenforceableFa = [];
  for (const v of args.violations) {
    const st = violationState(v, now);
    if (!st.isBlocking) continue;
    if (!st.isEnforceable) {
      unenforceableFa.push(`\u062A\u062E\u0644\u0641 ${v.ViolationNo}: ${st.enforcementIssueFa}`);
      continue;
    }
    const scope = v.StopWorkScope;
    let hits = false;
    if (scope === "project") hits = true;
    else if (scope === "activity") hits = v.ActivityId === args.activityId;
    else if (scope === "area") hits = v.AreaFa === args.areaFa;
    else if (scope === "system") hits = v.SystemId === args.systemId;
    if (!hits) continue;
    blockingIds.push(v.Id);
    reasonsFa.push(
      `\u062A\u062E\u0644\u0641 ${v.ViolationNo} (${VIOLATION_TYPE_FA[v.ViolationType] ?? v.ViolationType}) \u2014 \u062A\u0648\u0642\u0641 \u062F\u0631 \u0633\u0637\u062D ${STOP_WORK_SCOPE_FA[scope] ?? scope}`
    );
  }
  return {
    activityId: args.activityId,
    isLocked: blockingIds.length > 0,
    blockingIds,
    reasonsFa,
    unenforceableFa
  };
}
function canReleaseViolation(args) {
  const { violation, closures = [], actions = [], releaserId } = args;
  const blockersFa = [];
  const warningsFa = [];
  if (violation.Status === "closed") {
    blockersFa.push("\u0627\u06CC\u0646 \u062A\u062E\u0644\u0641 \u0642\u0628\u0644\u0627\u064B \u0628\u0633\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  if (violation.Status === "void") {
    blockersFa.push("\u062A\u062E\u0644\u0641 \u0627\u0628\u0637\u0627\u0644\u200C\u0634\u062F\u0647 \u0642\u0627\u0628\u0644 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0646\u06CC\u0633\u062A");
  }
  const mine = closures.filter((c) => c.ViolationId === violation.Id).sort((a, b) => Number(a.AttemptNo) - Number(b.AttemptNo));
  const last = mine.at(-1);
  if (!last) {
    blockersFa.push("\u0628\u0627\u0632\u0628\u06CC\u0646\u06CC \u0645\u062C\u062F\u062F \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  } else if (last.IsSatisfactory !== true) {
    blockersFa.push(`\u0622\u062E\u0631\u06CC\u0646 \u0628\u0627\u0632\u0628\u06CC\u0646\u06CC (\u062A\u0644\u0627\u0634 ${last.AttemptNo}) \u0646\u062A\u06CC\u062C\u0647\u0654 \u0631\u0636\u0627\u06CC\u062A\u200C\u0628\u062E\u0634 \u0646\u062F\u0627\u0634\u062A`);
  }
  if (releaserId) {
    if (releaserId === violation.IssuedBy) {
      blockersFa.push("\u0622\u0632\u0627\u062F\u06A9\u0646\u0646\u062F\u0647 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0647\u0645\u0627\u0646 \u0635\u0627\u062F\u0631\u06A9\u0646\u0646\u062F\u0647\u0654 \u062A\u062E\u0644\u0641 \u0628\u0627\u0634\u062F");
    }
    if (violation.OffenderRef && releaserId === violation.OffenderRef) {
      blockersFa.push("\u0645\u062A\u062E\u0644\u0641 \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u062A\u062E\u0644\u0641 \u062E\u0648\u062F\u0634 \u0631\u0627 \u0622\u0632\u0627\u062F \u06A9\u0646\u062F");
    }
    if (last && releaserId === last.ReInspectedBy) {
      warningsFa.push("\u0622\u0632\u0627\u062F\u06A9\u0646\u0646\u062F\u0647 \u0647\u0645\u0627\u0646 \u0628\u0627\u0632\u0628\u06CC\u0646 \u0627\u0633\u062A \u2014 \u0628\u0647\u062A\u0631 \u0627\u0633\u062A \u062F\u0648 \u0646\u0641\u0631 \u062C\u062F\u0627 \u0628\u0627\u0634\u0646\u062F");
    }
  }
  if (violation.IsStopWork === true) {
    const mineActions = actions.filter((a) => a.SourceType === "violation" && a.SourceId === violation.Id);
    if (!mineActions.length) {
      blockersFa.push("\u062A\u062E\u0644\u0641 \u062F\u0627\u0631\u0627\u06CC \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u0628\u062F\u0648\u0646 \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0622\u0632\u0627\u062F \u0646\u0645\u06CC\u200C\u0634\u0648\u062F");
    } else {
      const stillOpen = mineActions.filter((a) => a.Status === "open" || a.Status === "in_progress");
      if (stillOpen.length) {
        blockersFa.push(`${stillOpen.length} \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u0627\u06CC\u0646 \u062A\u062E\u0644\u0641 \u0647\u0646\u0648\u0632 \u0628\u0627\u0632 \u0627\u0633\u062A`);
      }
    }
  }
  if (mine.length > 2) {
    warningsFa.push(`${mine.length} \u0628\u0627\u0631 \u0628\u0627\u0632\u0628\u06CC\u0646\u06CC \u0644\u0627\u0632\u0645 \u0634\u062F \u2014 \u0646\u0634\u0627\u0646\u0647\u0654 \u0636\u0639\u0641 \u0646\u0638\u0627\u0645\u200C\u0645\u0646\u062F \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631`);
  }
  const st = violationState(violation);
  if (st.isOverdue) {
    warningsFa.push(`\u0631\u0641\u0639 \u062A\u062E\u0644\u0641 ${st.overdueDays} \u0631\u0648\u0632 \u0627\u0632 \u0645\u0647\u0644\u062A \u06AF\u0630\u0634\u062A`);
  }
  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}
function canCloseInspection(args) {
  const { inspection, findings = [], violations = [], now = /* @__PURE__ */ new Date() } = args;
  const blockersFa = [];
  const warningsFa = [];
  if (inspection.Status === "closed") {
    blockersFa.push("\u0627\u06CC\u0646 \u0628\u0627\u0632\u0631\u0633\u06CC \u0642\u0628\u0644\u0627\u064B \u0628\u0633\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  const sum = findingSummary(findings, inspection.Id, now);
  if (sum.open > 0) {
    blockersFa.push(`${sum.open} \u06CC\u0627\u0641\u062A\u0647\u0654 \u0628\u0627\u0632 \u062F\u0627\u0631\u062F`);
  }
  const openViolations = violations.filter(
    (v) => v.InspectionId === inspection.Id && violationState(v, now).isOpen
  );
  if (openViolations.length) {
    blockersFa.push(`${openViolations.length} \u062A\u062E\u0644\u0641 \u0635\u0627\u062F\u0631\u0634\u062F\u0647 \u0627\u0632 \u0627\u06CC\u0646 \u0628\u0627\u0632\u0631\u0633\u06CC \u0647\u0646\u0648\u0632 \u0628\u0627\u0632 \u0627\u0633\u062A`);
  }
  const score = Number(inspection.ScorePct ?? NaN);
  if (Number.isFinite(score) && score < INSPECTION_PASS_SCORE) {
    warningsFa.push(`\u0627\u0645\u062A\u06CC\u0627\u0632 ${score} \u0632\u06CC\u0631 \u062D\u062F \u0642\u0628\u0648\u0644\u06CC ${INSPECTION_PASS_SCORE} \u0627\u0633\u062A \u2014 \u0628\u0627\u0632\u0631\u0633\u06CC \u0645\u062C\u062F\u062F \u062A\u0648\u0635\u06CC\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F`);
  }
  if (sum.total === 0) {
    warningsFa.push("\u0647\u06CC\u0686 \u06CC\u0627\u0641\u062A\u0647\u200C\u0627\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u2014 \u0628\u0627\u0632\u0631\u0633\u06CC \u0628\u062F\u0648\u0646 \u06CC\u0627\u0641\u062A\u0647 \u0645\u0639\u0645\u0648\u0644\u0627\u064B \u06CC\u0639\u0646\u06CC \u0628\u0627\u0632\u0631\u0633\u06CC \u0633\u0637\u062D\u06CC");
  }
  return { ok: blockersFa.length === 0, blockersFa, warningsFa };
}
function violationSummary(violations, now = /* @__PURE__ */ new Date()) {
  const byStatus = {};
  for (const s of VIOLATION_STATUSES) byStatus[s] = 0;
  const byType = {};
  for (const t of VIOLATION_TYPES) byType[t] = 0;
  const bySeverity = {};
  for (const s of SEVERITIES) bySeverity[s] = 0;
  let open = 0;
  let overdue = 0;
  let stopWorkTotal = 0;
  let stopWorkActive = 0;
  let stopWorkUnenforceable = 0;
  let totalFine = 0;
  const unenforceableFa = [];
  const byContractor = {};
  for (const v of violations) {
    byStatus[v.Status] = (byStatus[v.Status] ?? 0) + 1;
    byType[v.ViolationType] = (byType[v.ViolationType] ?? 0) + 1;
    bySeverity[v.Severity] = (bySeverity[v.Severity] ?? 0) + 1;
    const st = violationState(v, now);
    if (st.isOpen) open += 1;
    if (st.isOverdue) overdue += 1;
    if (v.IsStopWork === true) stopWorkTotal += 1;
    if (st.isBlocking) {
      stopWorkActive += 1;
      if (!st.isEnforceable) {
        stopWorkUnenforceable += 1;
        unenforceableFa.push(`\u062A\u062E\u0644\u0641 ${v.ViolationNo}: ${st.enforcementIssueFa}`);
      }
    }
    if (v.Status !== "void") {
      const fine = Number(v.FineAmount ?? 0);
      if (Number.isFinite(fine) && fine > 0) totalFine += fine;
    }
    const c = String(v.ContractorFa ?? "").trim();
    if (c) byContractor[c] = (byContractor[c] ?? 0) + 1;
  }
  const repeatOffendersFa = Object.entries(byContractor).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name}: ${n} \u062A\u062E\u0644\u0641`);
  const warningsFa = [];
  if (stopWorkActive > 0) {
    warningsFa.push(`${stopWorkActive} \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u0641\u0639\u0627\u0644 \u0627\u0633\u062A`);
  }
  if (overdue > 0) {
    warningsFa.push(`${overdue} \u062A\u062E\u0644\u0641 \u0627\u0632 \u0645\u0647\u0644\u062A \u0631\u0641\u0639 \u06AF\u0630\u0634\u062A\u0647 \u0627\u0633\u062A`);
  }
  if (repeatOffendersFa.length) {
    warningsFa.push(`${repeatOffendersFa.length} \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u062A\u062E\u0644\u0641 \u062A\u06A9\u0631\u0627\u0631\u06CC \u062F\u0627\u0631\u062F`);
  }
  if (stopWorkUnenforceable > 0) {
    warningsFa.push(
      `${stopWorkUnenforceable} \u062F\u0633\u062A\u0648\u0631 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u0642\u0627\u0628\u0644 \u0627\u0639\u0645\u0627\u0644 \u0646\u06CC\u0633\u062A \u2014 \u062F\u0627\u0645\u0646\u0647 \u06CC\u0627 \u0645\u0631\u062C\u0639 \u0622\u0646 \u0646\u0627\u0642\u0635 \u0627\u0633\u062A`
    );
  }
  return {
    total: violations.length,
    byStatus,
    byType,
    bySeverity,
    open,
    overdue,
    stopWorkTotal,
    stopWorkActive,
    stopWorkUnenforceable,
    totalFine: round2(totalFine),
    repeatOffendersFa,
    unenforceableFa,
    warningsFa
  };
}
var TRAINING_TYPES = ["induction", "toolbox", "specialist", "refresher", "drill"];
var TRAINING_TYPE_FA = {
  induction: "\u0622\u0645\u0648\u0632\u0634 \u0628\u062F\u0648 \u0648\u0631\u0648\u062F",
  toolbox: "\u062C\u0644\u0633\u0647\u0654 \u0631\u0648\u0632\u0627\u0646\u0647\u0654 \u0627\u06CC\u0645\u0646\u06CC",
  specialist: "\u062F\u0648\u0631\u0647\u0654 \u062A\u062E\u0635\u0635\u06CC",
  refresher: "\u062F\u0648\u0631\u0647\u0654 \u0628\u0627\u0632\u0622\u0645\u0648\u0632\u06CC",
  drill: "\u0645\u0627\u0646\u0648\u0631"
};
var SESSION_STATUSES = ["planned", "held", "cancelled"];
var SESSION_STATUS_FA = {
  planned: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647",
  held: "\u0628\u0631\u06AF\u0632\u0627\u0631\u0634\u062F\u0647",
  cancelled: "\u0644\u063A\u0648\u0634\u062F\u0647"
};
var PPE_TYPES = [
  "helmet",
  "boots",
  "goggles",
  "gloves",
  "harness",
  "respirator",
  "earplug",
  "coverall",
  "face_shield"
];
var PPE_TYPE_FA = {
  helmet: "\u06A9\u0644\u0627\u0647 \u0627\u06CC\u0645\u0646\u06CC",
  boots: "\u06A9\u0641\u0634 \u0627\u06CC\u0645\u0646\u06CC",
  goggles: "\u0639\u06CC\u0646\u06A9 \u0627\u06CC\u0645\u0646\u06CC",
  gloves: "\u062F\u0633\u062A\u06A9\u0634",
  harness: "\u06A9\u0645\u0631\u0628\u0646\u062F \u0648 \u0647\u0627\u0631\u0646\u0633",
  respirator: "\u0645\u0627\u0633\u06A9 \u062A\u0646\u0641\u0633\u06CC",
  earplug: "\u06AF\u0648\u0634\u06CC \u062D\u0641\u0627\u0638\u062A\u06CC",
  coverall: "\u0644\u0628\u0627\u0633 \u06A9\u0627\u0631",
  face_shield: "\u0634\u06CC\u0644\u062F \u0635\u0648\u0631\u062A"
};
var CRITICAL_PPE = ["helmet", "boots", "harness", "respirator"];
var PPE_STATUSES = ["issued", "returned", "lost", "damaged"];
var PPE_STATUS_FA = {
  issued: "\u062A\u062D\u0648\u06CC\u0644\u200C\u0634\u062F\u0647",
  returned: "\u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u062F\u0647\u200C\u0634\u062F\u0647",
  lost: "\u0645\u0641\u0642\u0648\u062F",
  damaged: "\u0622\u0633\u06CC\u0628\u200C\u062F\u06CC\u062F\u0647"
};
var HAZARD_TYPES = [
  "noise",
  "dust",
  "chemical",
  "vibration",
  "radiation",
  "heat",
  "ergonomic",
  "biological"
];
var HAZARD_TYPE_FA = {
  noise: "\u0635\u062F\u0627",
  dust: "\u06AF\u0631\u062F \u0648 \u063A\u0628\u0627\u0631",
  chemical: "\u0639\u0648\u0627\u0645\u0644 \u0634\u06CC\u0645\u06CC\u0627\u06CC\u06CC",
  vibration: "\u0627\u0631\u062A\u0639\u0627\u0634",
  radiation: "\u067E\u0631\u062A\u0648",
  heat: "\u0627\u0633\u062A\u0631\u0633 \u06AF\u0631\u0645\u0627\u06CC\u06CC",
  ergonomic: "\u0627\u0631\u06AF\u0648\u0646\u0648\u0645\u06CC",
  biological: "\u0639\u0648\u0627\u0645\u0644 \u0628\u06CC\u0648\u0644\u0648\u0698\u06CC\u06A9"
};
var EXAM_TYPES = ["pre_employment", "periodic", "exit", "special"];
var EXAM_TYPE_FA = {
  pre_employment: "\u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u0628\u062F\u0648 \u0627\u0633\u062A\u062E\u062F\u0627\u0645",
  periodic: "\u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC",
  exit: "\u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u062E\u0631\u0648\u062C",
  special: "\u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC"
};
var FITNESS_RESULTS = ["fit", "fit_with_restriction", "unfit", "pending"];
var FITNESS_FA = {
  fit: "\u0628\u0644\u0627\u0645\u0627\u0646\u0639",
  fit_with_restriction: "\u0628\u0644\u0627\u0645\u0627\u0646\u0639 \u0645\u0634\u0631\u0648\u0637",
  unfit: "\u063A\u06CC\u0631\u0645\u062C\u0627\u0632",
  pending: "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u0646\u062A\u06CC\u062C\u0647"
};
var WASTE_TYPES = ["hazardous", "non_hazardous", "recyclable", "construction", "liquid"];
var WASTE_TYPE_FA = {
  hazardous: "\u067E\u0633\u0645\u0627\u0646\u062F \u062E\u0637\u0631\u0646\u0627\u06A9",
  non_hazardous: "\u067E\u0633\u0645\u0627\u0646\u062F \u0639\u0627\u062F\u06CC",
  recyclable: "\u067E\u0633\u0645\u0627\u0646\u062F \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u06CC",
  construction: "\u0646\u062E\u0627\u0644\u0647\u0654 \u0633\u0627\u062E\u062A\u0645\u0627\u0646\u06CC",
  liquid: "\u067E\u0633\u0645\u0627\u0646\u062F \u0645\u0627\u06CC\u0639"
};
var MANIFEST_REQUIRED_WASTE = ["hazardous", "liquid"];
var DISPOSAL_METHODS = [
  "landfill",
  "incineration",
  "recycling",
  "treatment",
  "licensed_contractor"
];
var DISPOSAL_METHOD_FA = {
  landfill: "\u062F\u0641\u0646 \u0628\u0647\u062F\u0627\u0634\u062A\u06CC",
  incineration: "\u0633\u0648\u0632\u0627\u0646\u062F\u0646",
  recycling: "\u0628\u0627\u0632\u06CC\u0627\u0641\u062A",
  treatment: "\u062A\u0635\u0641\u06CC\u0647",
  licensed_contractor: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u0645\u062C\u0627\u0632"
};
var WASTE_STATUSES = ["generated", "in_transit", "disposed", "rejected"];
var WASTE_STATUS_FA = {
  generated: "\u062A\u0648\u0644\u06CC\u062F\u0634\u062F\u0647",
  in_transit: "\u062F\u0631 \u062D\u0627\u0644 \u062D\u0645\u0644",
  disposed: "\u062F\u0641\u0639\u200C\u0634\u062F\u0647",
  rejected: "\u0628\u0631\u06AF\u0634\u062A\u200C\u062E\u0648\u0631\u062F\u0647"
};
var MONITORING_MEDIA = ["air", "water", "soil", "noise", "effluent"];
var MEDIUM_FA = {
  air: "\u0647\u0648\u0627",
  water: "\u0622\u0628",
  soil: "\u062E\u0627\u06A9",
  noise: "\u0635\u062F\u0627",
  effluent: "\u067E\u0633\u0627\u0628"
};
var EXPIRY_WARNING_DAYS = 30;
var INDUCTION_COURSE_CODE = "HSE-IND";
function daysUntil(dateStr, now) {
  const raw = String(dateStr ?? "").trim();
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((t + 86399999 - now.getTime()) / 864e5);
}
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return null;
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
function trainingSessionState(session, attendees, now = /* @__PURE__ */ new Date()) {
  const mine = attendees.filter((a) => a.SessionId === session.Id);
  const registered = mine.length;
  const attended = mine.filter((a) => a.Attended === true).length;
  const passed = mine.filter((a) => a.Attended === true && a.Passed === true).length;
  const absent = registered - attended;
  const attendanceRatePct = registered > 0 ? round2(attended / registered * 100) : null;
  const passRatePct = attended > 0 ? round2(passed / attended * 100) : null;
  const months = session.ValidityMonths;
  const certificateExpiry = months != null && months > 0 ? addMonths(session.HeldAt.slice(0, 10), months) : null;
  const expiresInDays = daysUntil(certificateExpiry, now);
  const isExpired = expiresInDays !== null && expiresInDays < 0;
  const warningsFa = [];
  if (session.Status === "held" && registered === 0) {
    warningsFa.push("\u062C\u0644\u0633\u0647 \u0628\u0631\u06AF\u0632\u0627\u0631\u0634\u062F\u0647 \u062B\u0628\u062A \u0634\u062F\u0647 \u0648\u0644\u06CC \u0647\u06CC\u0686 \u062D\u0627\u0636\u0631\u06CC \u0646\u062F\u0627\u0631\u062F");
  }
  if (session.Status === "held" && attended === 0 && registered > 0) {
    warningsFa.push("\u0647\u06CC\u0686\u200C\u06CC\u06A9 \u0627\u0632 \u062B\u0628\u062A\u200C\u0646\u0627\u0645\u200C\u0634\u062F\u06AF\u0627\u0646 \u062D\u0627\u0636\u0631 \u0646\u0634\u062F\u0647\u200C\u0627\u0646\u062F");
  }
  if (absent > 0 && session.Status === "held") {
    warningsFa.push(`${absent} \u0646\u0641\u0631 \u0627\u0632 \u062B\u0628\u062A\u200C\u0646\u0627\u0645\u200C\u0634\u062F\u06AF\u0627\u0646 \u063A\u0627\u06CC\u0628 \u0628\u0648\u062F\u0647\u200C\u0627\u0646\u062F`);
  }
  if (passRatePct !== null && passRatePct < 50) {
    warningsFa.push(`\u0646\u0631\u062E \u0642\u0628\u0648\u0644\u06CC ${passRatePct} \u062F\u0631\u0635\u062F \u0627\u0633\u062A \u2014 \u0627\u062B\u0631\u0628\u062E\u0634\u06CC \u0622\u0645\u0648\u0632\u0634 \u0628\u0627\u06CC\u062F \u0628\u0627\u0632\u0646\u06AF\u0631\u06CC \u0634\u0648\u062F`);
  }
  if (isExpired && session.Status === "held") {
    warningsFa.push("\u0627\u0639\u062A\u0628\u0627\u0631 \u06AF\u0648\u0627\u0647\u06CC \u0627\u06CC\u0646 \u062C\u0644\u0633\u0647 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0648 \u062D\u0627\u0636\u0631\u0627\u0646 \u0646\u06CC\u0627\u0632 \u0628\u0647 \u0628\u0627\u0632\u0622\u0645\u0648\u0632\u06CC \u062F\u0627\u0631\u0646\u062F");
  }
  return {
    statusFa: SESSION_STATUS_FA[session.Status] ?? session.Status,
    typeFa: TRAINING_TYPE_FA[session.TrainingType] ?? session.TrainingType,
    registered,
    attended,
    passed,
    absent,
    attendanceRatePct,
    passRatePct,
    certificateExpiry,
    expiresInDays,
    isExpired,
    warningsFa
  };
}
function personTrainingMatrix(args) {
  const { personRef, records, requiredCourses = [], now = /* @__PURE__ */ new Date() } = args;
  const mine = records.filter((r) => r.PersonRef === personRef);
  const valid = [];
  const expired = [];
  const expiringSoon = [];
  for (const r of mine) {
    const titleFa = r.CourseTitleFa || r.CourseCode;
    if (r.Status === "revoked") {
      expired.push({ courseCode: r.CourseCode, titleFa, expiredAt: r.ExpiresAt ?? null });
      continue;
    }
    const left = daysUntil(r.ExpiresAt, now);
    if (left === null) {
      valid.push({ courseCode: r.CourseCode, titleFa, expiresAt: null, daysLeft: null });
      continue;
    }
    if (left < 0) {
      expired.push({ courseCode: r.CourseCode, titleFa, expiredAt: r.ExpiresAt ?? null });
      continue;
    }
    valid.push({ courseCode: r.CourseCode, titleFa, expiresAt: r.ExpiresAt ?? null, daysLeft: left });
    if (left <= EXPIRY_WARNING_DAYS) expiringSoon.push({ courseCode: r.CourseCode, titleFa, daysLeft: left });
  }
  const validCodes = new Set(valid.map((v) => v.courseCode));
  const missingRequired = requiredCourses.filter((c) => !validCodes.has(c));
  const hasInduction = validCodes.has(INDUCTION_COURSE_CODE);
  const blockersFa = [];
  if (!hasInduction) blockersFa.push("\u0622\u0645\u0648\u0632\u0634 \u0628\u062F\u0648 \u0648\u0631\u0648\u062F \u0645\u0639\u062A\u0628\u0631 \u0646\u062F\u0627\u0631\u062F");
  for (const c of missingRequired) {
    if (c === INDUCTION_COURSE_CODE) continue;
    blockersFa.push(`\u062F\u0648\u0631\u0647\u0654 \u0627\u0644\u0632\u0627\u0645\u06CC \xAB${c}\xBB \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A`);
  }
  const warningsFa = [];
  for (const e of expiringSoon) {
    warningsFa.push(`\u06AF\u0648\u0627\u0647\u06CC \xAB${e.titleFa}\xBB \u062A\u0627 ${e.daysLeft} \u0631\u0648\u0632 \u062F\u06CC\u06AF\u0631 \u0645\u0646\u0642\u0636\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F`);
  }
  if (mine.length === 0) warningsFa.push("\u0647\u06CC\u0686 \u0633\u0627\u0628\u0642\u0647\u0654 \u0622\u0645\u0648\u0632\u0634\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0641\u0631\u062F \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  return {
    personRef,
    valid,
    expired,
    expiringSoon,
    missingRequired,
    hasInduction,
    isCleared: blockersFa.length === 0,
    blockersFa,
    warningsFa
  };
}
function personPpeState(args) {
  const { personRef, issuances, requiredPpe = [], now = /* @__PURE__ */ new Date() } = args;
  const mine = issuances.filter((i) => i.PersonRef === personRef);
  const active = [];
  const overdue = [];
  const dueSoon = [];
  for (const i of mine) {
    if (i.Status !== "issued") continue;
    const typeFa = PPE_TYPE_FA[i.PpeType] ?? i.PpeType;
    const left = daysUntil(i.ReplaceDueDate, now);
    if (left !== null && left < 0) {
      overdue.push({ ppeType: i.PpeType, typeFa, replaceDue: String(i.ReplaceDueDate), overdueDays: -left });
      continue;
    }
    active.push({ ppeType: i.PpeType, typeFa, issuedAt: i.IssuedAt, replaceDue: i.ReplaceDueDate ?? null, daysLeft: left });
    if (left !== null && left <= EXPIRY_WARNING_DAYS) dueSoon.push({ ppeType: i.PpeType, typeFa, daysLeft: left });
  }
  const activeTypes = new Set(active.map((a) => a.ppeType));
  const missingRequired = requiredPpe.filter((t) => !activeTypes.has(t));
  const missingCritical = missingRequired.filter((t) => CRITICAL_PPE.includes(t));
  const missingCriticalFa = missingCritical.map((t) => PPE_TYPE_FA[t] ?? t);
  const blockersFa = [];
  for (const t of missingCritical) {
    blockersFa.push(`\u062A\u062C\u0647\u06CC\u0632 \u062D\u06CC\u0627\u062A\u06CC \xAB${PPE_TYPE_FA[t] ?? t}\xBB \u062A\u062D\u0648\u06CC\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  for (const o of overdue) {
    if (CRITICAL_PPE.includes(o.ppeType)) {
      blockersFa.push(`\xAB${o.typeFa}\xBB ${o.overdueDays} \u0631\u0648\u0632 \u0627\u0632 \u062A\u0627\u0631\u06CC\u062E \u062A\u0639\u0648\u06CC\u0636\u0634 \u06AF\u0630\u0634\u062A\u0647 \u0627\u0633\u062A`);
    }
  }
  const warningsFa = [];
  for (const t of missingRequired) {
    if (missingCritical.includes(t)) continue;
    warningsFa.push(`\u062A\u062C\u0647\u06CC\u0632 \xAB${PPE_TYPE_FA[t] ?? t}\xBB \u062A\u062D\u0648\u06CC\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  for (const d of dueSoon) warningsFa.push(`\xAB${d.typeFa}\xBB \u062A\u0627 ${d.daysLeft} \u0631\u0648\u0632 \u062F\u06CC\u06AF\u0631 \u0628\u0627\u06CC\u062F \u062A\u0639\u0648\u06CC\u0636 \u0634\u0648\u062F`);
  for (const o of overdue) {
    if (!CRITICAL_PPE.includes(o.ppeType)) {
      warningsFa.push(`\xAB${o.typeFa}\xBB ${o.overdueDays} \u0631\u0648\u0632 \u0627\u0632 \u062A\u0627\u0631\u06CC\u062E \u062A\u0639\u0648\u06CC\u0636\u0634 \u06AF\u0630\u0634\u062A\u0647 \u0627\u0633\u062A`);
    }
  }
  return {
    personRef,
    active,
    overdue,
    dueSoon,
    missingRequired,
    missingCriticalFa,
    isEquipped: blockersFa.length === 0,
    blockersFa,
    warningsFa
  };
}
function personHealthState(args) {
  const { personRef, exams, hazards = [], tradeCode = null, now = /* @__PURE__ */ new Date() } = args;
  const mine = exams.filter((e) => e.PersonRef === personRef && e.Status !== "superseded").sort((a, b) => new Date(a.ExaminedAt).getTime() - new Date(b.ExaminedAt).getTime());
  const latestExam = mine.length ? mine[mine.length - 1] : null;
  const hasPreEmployment = mine.some((e) => e.ExamType === "pre_employment" && e.Fitness !== "unfit");
  const fitness = latestExam?.Fitness ?? "pending";
  const nextExamDate2 = latestExam?.NextExamDate ?? null;
  const daysToNextExam = daysUntil(nextExamDate2, now);
  const isOverdue = daysToNextExam !== null && daysToNextExam < 0;
  const requiredHazards = hazards.filter((h) => h.Status === "active" && (!h.TradeCode || h.TradeCode === tradeCode)).map((h) => ({ hazardCode: h.HazardCode, titleFa: h.TitleFa, intervalMonths: h.ExamIntervalMonths }));
  const blockersFa = [];
  if (!latestExam) {
    blockersFa.push("\u0647\u06CC\u0686 \u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u0637\u0628 \u06A9\u0627\u0631\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0641\u0631\u062F \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  } else {
    if (fitness === "unfit") blockersFa.push("\u0646\u062A\u06CC\u062C\u0647\u0654 \u0622\u062E\u0631\u06CC\u0646 \u0645\u0639\u0627\u06CC\u0646\u0647 \xAB\u063A\u06CC\u0631\u0645\u062C\u0627\u0632\xBB \u0627\u0633\u062A");
    if (fitness === "pending") blockersFa.push("\u0646\u062A\u06CC\u062C\u0647\u0654 \u0645\u0639\u0627\u06CC\u0646\u0647 \u0647\u0646\u0648\u0632 \u0627\u0639\u0644\u0627\u0645 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
    if (!hasPreEmployment) blockersFa.push("\u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u0628\u062F\u0648 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0645\u0639\u062A\u0628\u0631 \u0646\u062F\u0627\u0631\u062F");
    if (isOverdue) blockersFa.push(`\u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC ${-daysToNextExam} \u0631\u0648\u0632 \u0645\u0639\u0648\u0642 \u0627\u0633\u062A`);
  }
  const warningsFa = [];
  if (fitness === "fit_with_restriction") {
    warningsFa.push(
      latestExam?.RestrictionFa ? `\u06A9\u0627\u0631 \u0645\u0634\u0631\u0648\u0637: ${latestExam.RestrictionFa}` : "\u0646\u062A\u06CC\u062C\u0647 \xAB\u0628\u0644\u0627\u0645\u0627\u0646\u0639 \u0645\u0634\u0631\u0648\u0637\xBB \u0627\u0633\u062A \u0648\u0644\u06CC \u0634\u0631\u062D \u0645\u062D\u062F\u0648\u062F\u06CC\u062A \u062B\u0628\u062A \u0646\u0634\u062F\u0647"
    );
  }
  if (daysToNextExam !== null && daysToNextExam >= 0 && daysToNextExam <= EXPIRY_WARNING_DAYS) {
    warningsFa.push(`\u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u062A\u0627 ${daysToNextExam} \u0631\u0648\u0632 \u062F\u06CC\u06AF\u0631 \u0633\u0631\u0631\u0633\u06CC\u062F \u0645\u06CC\u200C\u0634\u0648\u062F`);
  }
  if (requiredHazards.length && !latestExam?.HazardCode) {
    warningsFa.push("\u0639\u0627\u0645\u0644 \u0632\u06CC\u0627\u0646\u200C\u0622\u0648\u0631 \u0634\u063A\u0644 \u0645\u0634\u062E\u0635 \u0627\u0633\u062A \u0648\u0644\u06CC \u0645\u0639\u0627\u06CC\u0646\u0647 \u0628\u0647 \u0622\u0646 \u0627\u0631\u062C\u0627\u0639 \u0646\u062F\u0627\u062F\u0647");
  }
  return {
    personRef,
    latestExam,
    fitness,
    fitnessFa: FITNESS_FA[fitness] ?? fitness,
    restrictionFa: latestExam?.RestrictionFa ?? null,
    nextExamDate: nextExamDate2,
    daysToNextExam,
    isOverdue,
    hasPreEmployment,
    requiredHazards,
    isCleared: blockersFa.length === 0,
    blockersFa,
    warningsFa
  };
}
function nextExamDate(examinedAt, intervalMonths) {
  if (!Number.isFinite(intervalMonths) || intervalMonths <= 0) return null;
  return addMonths(examinedAt.slice(0, 10), intervalMonths);
}
function personSiteClearance(args) {
  const {
    personRef,
    trainings = [],
    issuances = [],
    exams = [],
    hazards = [],
    requiredCourses = [],
    requiredPpe = [],
    tradeCode = null,
    now = /* @__PURE__ */ new Date()
  } = args;
  const t = personTrainingMatrix({ personRef, records: trainings, requiredCourses, now });
  const p = personPpeState({ personRef, issuances, requiredPpe, now });
  const h = personHealthState({ personRef, exams, hazards, tradeCode, now });
  const blockersFa = [
    ...t.blockersFa.map((b) => `\u0622\u0645\u0648\u0632\u0634: ${b}`),
    ...p.blockersFa.map((b) => `\u062A\u062C\u0647\u06CC\u0632\u0627\u062A: ${b}`),
    ...h.blockersFa.map((b) => `\u0633\u0644\u0627\u0645\u062A: ${b}`)
  ];
  const warningsFa = [
    ...t.warningsFa.map((w) => `\u0622\u0645\u0648\u0632\u0634: ${w}`),
    ...p.warningsFa.map((w) => `\u062A\u062C\u0647\u06CC\u0632\u0627\u062A: ${w}`),
    ...h.warningsFa.map((w) => `\u0633\u0644\u0627\u0645\u062A: ${w}`)
  ];
  return {
    personRef,
    ok: blockersFa.length === 0,
    training: { ok: t.isCleared, blockersFa: t.blockersFa },
    ppe: { ok: p.isEquipped, blockersFa: p.blockersFa },
    health: { ok: h.isCleared, blockersFa: h.blockersFa },
    blockersFa,
    warningsFa
  };
}
function wasteLogState(waste, now = /* @__PURE__ */ new Date()) {
  const needsManifest = MANIFEST_REQUIRED_WASTE.includes(waste.WasteType);
  const hasManifest = String(waste.ManifestNo ?? "").trim().length > 0;
  const gen = new Date(waste.GeneratedAt).getTime();
  const ageDays = Number.isFinite(gen) ? Math.floor((now.getTime() - gen) / 864e5) : null;
  const isStale = waste.Status !== "disposed" && ageDays !== null && ageDays > 90;
  const issuesFa = [];
  if (needsManifest && !hasManifest) {
    issuesFa.push(`${WASTE_TYPE_FA[waste.WasteType] ?? waste.WasteType} \u0628\u062F\u0648\u0646 \u0634\u0645\u0627\u0631\u0647\u0654 \u0645\u0627\u0646\u06CC\u0641\u0633\u062A \u062D\u0645\u0644 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  if (waste.Status === "disposed" && !waste.DisposedAt) {
    issuesFa.push("\u0648\u0636\u0639\u06CC\u062A \xAB\u062F\u0641\u0639\u200C\u0634\u062F\u0647\xBB \u0627\u0633\u062A \u0648\u0644\u06CC \u062A\u0627\u0631\u06CC\u062E \u062F\u0641\u0639 \u062B\u0628\u062A \u0646\u0634\u062F\u0647");
  }
  if (waste.Status === "in_transit" && !String(waste.CarrierFa ?? "").trim()) {
    issuesFa.push("\u067E\u0633\u0645\u0627\u0646\u062F \u062F\u0631 \u062D\u0627\u0644 \u062D\u0645\u0644 \u0627\u0633\u062A \u0648\u0644\u06CC \u062D\u0645\u0644\u200C\u06A9\u0646\u0646\u062F\u0647 \u0645\u0634\u062E\u0635 \u0646\u06CC\u0633\u062A");
  }
  if (isStale) {
    issuesFa.push(`${ageDays} \u0631\u0648\u0632 \u0627\u0632 \u062A\u0648\u0644\u06CC\u062F \u0627\u06CC\u0646 \u067E\u0633\u0645\u0627\u0646\u062F \u0645\u06CC\u200C\u06AF\u0630\u0631\u062F \u0648 \u0647\u0646\u0648\u0632 \u062F\u0641\u0639 \u0646\u0634\u062F\u0647`);
  }
  if (waste.Quantity <= 0) issuesFa.push("\u0645\u0642\u062F\u0627\u0631 \u067E\u0633\u0645\u0627\u0646\u062F \u0628\u0627\u06CC\u062F \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F");
  return {
    typeFa: WASTE_TYPE_FA[waste.WasteType] ?? waste.WasteType,
    statusFa: WASTE_STATUS_FA[waste.Status] ?? waste.Status,
    methodFa: DISPOSAL_METHOD_FA[waste.DisposalMethod] ?? waste.DisposalMethod,
    needsManifest,
    hasManifest,
    isCompliant: issuesFa.length === 0,
    isStale,
    ageDays,
    issuesFa
  };
}
function wasteSummary(logs, now = /* @__PURE__ */ new Date()) {
  const byType = {};
  for (const t of WASTE_TYPES) byType[t] = 0;
  const byStatus = {};
  for (const st of WASTE_STATUSES) byStatus[st] = 0;
  const quantityByUnit = {};
  const hazardousQuantityByUnit = {};
  const recycledQuantityByUnit = {};
  let missingManifest = 0;
  let staleCount = 0;
  let totalCost = 0;
  const nonCompliantFa = [];
  for (const w of logs) {
    byType[w.WasteType] = (byType[w.WasteType] ?? 0) + 1;
    byStatus[w.Status] = (byStatus[w.Status] ?? 0) + 1;
    const q = Number(w.Quantity) || 0;
    const u = w.Unit || "?";
    quantityByUnit[u] = round3((quantityByUnit[u] ?? 0) + q);
    if (w.WasteType === "hazardous") {
      hazardousQuantityByUnit[u] = round3((hazardousQuantityByUnit[u] ?? 0) + q);
    }
    if (w.WasteType === "recyclable" || w.DisposalMethod === "recycling") {
      recycledQuantityByUnit[u] = round3((recycledQuantityByUnit[u] ?? 0) + q);
    }
    totalCost += Number(w.CostAmount) || 0;
    const st = wasteLogState(w, now);
    if (st.needsManifest && !st.hasManifest) missingManifest += 1;
    if (st.isStale) staleCount += 1;
    if (!st.isCompliant) nonCompliantFa.push(`${w.WasteNo}: ${st.issuesFa.join("\u061B ")}`);
  }
  const recyclingRatePctByUnit = {};
  for (const [u, total] of Object.entries(quantityByUnit)) {
    if (total > 0) recyclingRatePctByUnit[u] = round2((recycledQuantityByUnit[u] ?? 0) / total * 100);
  }
  const warningsFa = [];
  if (missingManifest > 0) {
    warningsFa.push(`${missingManifest} \u0631\u062F\u06CC\u0641 \u067E\u0633\u0645\u0627\u0646\u062F \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0645\u0627\u0646\u06CC\u0641\u0633\u062A\u060C \u0628\u062F\u0648\u0646 \u0634\u0645\u0627\u0631\u0647\u0654 \u0645\u0627\u0646\u06CC\u0641\u0633\u062A \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  if (staleCount > 0) {
    warningsFa.push(`${staleCount} \u0631\u062F\u06CC\u0641 \u067E\u0633\u0645\u0627\u0646\u062F \u0628\u06CC\u0634 \u0627\u0632 \u06F9\u06F0 \u0631\u0648\u0632 \u0627\u0633\u062A \u06A9\u0647 \u062F\u0641\u0639 \u0646\u0634\u062F\u0647`);
  }
  if (Object.keys(quantityByUnit).length > 2) {
    warningsFa.push("\u067E\u0633\u0645\u0627\u0646\u062F\u0647\u0627 \u0628\u0627 \u0648\u0627\u062D\u062F\u0647\u0627\u06CC \u0646\u0627\u0647\u0645\u06AF\u0646 \u062B\u0628\u062A \u0634\u062F\u0647\u200C\u0627\u0646\u062F\u061B \u0645\u0642\u0627\u06CC\u0633\u0647\u0654 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0645\u0642\u0627\u062F\u06CC\u0631 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A");
  }
  return {
    total: logs.length,
    byType,
    byStatus,
    quantityByUnit,
    hazardousQuantityByUnit,
    recycledQuantityByUnit,
    recyclingRatePctByUnit,
    missingManifest,
    staleCount,
    totalCost: round2(totalCost),
    nonCompliantFa,
    warningsFa
  };
}
function monitoringState(reading) {
  const v = Number(reading.MeasuredValue);
  const lim = Number(reading.LimitValue);
  const issuesFa = [];
  if (!Number.isFinite(v) || !Number.isFinite(lim) || lim <= 0) {
    issuesFa.push("\u0645\u0642\u062F\u0627\u0631 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u06CC\u0627 \u062D\u062F \u0645\u062C\u0627\u0632 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A");
    return {
      mediumFa: MEDIUM_FA[reading.Medium] ?? reading.Medium,
      isExceeded: false,
      exceedancePct: null,
      ratio: null,
      isNearLimit: false,
      severityFa: "\u0646\u0627\u0645\u0634\u062E\u0635",
      needsAction: false,
      issuesFa
    };
  }
  const ratio = round3(v / lim);
  const isExceeded = v > lim;
  const exceedancePct = isExceeded ? round2((v - lim) / lim * 100) : 0;
  const isNearLimit = !isExceeded && ratio >= 0.9;
  let severityFa = "\u062F\u0631 \u062D\u062F \u0645\u062C\u0627\u0632";
  if (isExceeded) {
    severityFa = exceedancePct >= 100 ? "\u0641\u0631\u0627\u062A\u0631 \u0627\u0632 \u062F\u0648 \u0628\u0631\u0627\u0628\u0631 \u062D\u062F" : exceedancePct >= 20 ? "\u0641\u0631\u0627\u062A\u0631 \u0627\u0632 \u062D\u062F" : "\u0641\u0631\u0627\u062A\u0631 \u0627\u0632 \u062D\u062F (\u062C\u0632\u0626\u06CC)";
  } else if (isNearLimit) {
    severityFa = "\u0646\u0632\u062F\u06CC\u06A9 \u062D\u062F \u0645\u062C\u0627\u0632";
  }
  if (isExceeded) {
    issuesFa.push(`${reading.ParameterFa} ${exceedancePct} \u062F\u0631\u0635\u062F \u0641\u0631\u0627\u062A\u0631 \u0627\u0632 \u062D\u062F \u0645\u062C\u0627\u0632 \u0627\u0633\u062A`);
    if (!String(reading.CorrectiveActionFa ?? "").trim()) {
      issuesFa.push("\u0641\u0631\u0627\u062A\u0631\u0631\u0641\u062A\u0646 \u0627\u0632 \u062D\u062F \u0628\u062F\u0648\u0646 \u062B\u0628\u062A \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC");
    }
  }
  return {
    mediumFa: MEDIUM_FA[reading.Medium] ?? reading.Medium,
    isExceeded,
    exceedancePct,
    ratio,
    isNearLimit,
    severityFa,
    /* اقدام لازم است وقتی فراتر رفته و هنوز اقدامی ثبت نشده. */
    needsAction: isExceeded && !String(reading.CorrectiveActionFa ?? "").trim(),
    issuesFa
  };
}
function monitoringSummary(readings) {
  const byMedium = {};
  for (const m of MONITORING_MEDIA) byMedium[m] = 0;
  const exceededByMedium = {};
  for (const m of MONITORING_MEDIA) exceededByMedium[m] = 0;
  let exceeded = 0;
  let nearLimit = 0;
  let exceededWithoutAction = 0;
  let valid = 0;
  let worstPct = -1;
  let worstFa = null;
  for (const r of readings) {
    byMedium[r.Medium] = (byMedium[r.Medium] ?? 0) + 1;
    const st = monitoringState(r);
    if (st.ratio === null) continue;
    valid += 1;
    if (st.isExceeded) {
      exceeded += 1;
      exceededByMedium[r.Medium] = (exceededByMedium[r.Medium] ?? 0) + 1;
      if (st.needsAction) exceededWithoutAction += 1;
      if ((st.exceedancePct ?? 0) > worstPct) {
        worstPct = st.exceedancePct ?? 0;
        worstFa = `${r.ReadingNo} \u2014 ${r.ParameterFa} (${st.mediumFa}): ${st.exceedancePct} \u062F\u0631\u0635\u062F \u0641\u0631\u0627\u062A\u0631 \u0627\u0632 \u062D\u062F`;
      }
    } else if (st.isNearLimit) {
      nearLimit += 1;
    }
  }
  const warningsFa = [];
  if (exceededWithoutAction > 0) {
    warningsFa.push(`${exceededWithoutAction} \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0641\u0631\u0627\u062A\u0631 \u0627\u0632 \u062D\u062F \u0628\u062F\u0648\u0646 \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  if (nearLimit > 0) {
    warningsFa.push(`${nearLimit} \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0632\u062F\u06CC\u06A9 \u062D\u062F \u0645\u062C\u0627\u0632 \u0627\u0633\u062A \u0648 \u0631\u0648\u0646\u062F \u0628\u0627\u06CC\u062F \u067E\u0627\u06CC\u0634 \u0634\u0648\u062F`);
  }
  if (valid === 0 && readings.length > 0) {
    warningsFa.push("\u0647\u06CC\u0686 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0645\u0639\u062A\u0628\u0631\u06CC \u0628\u0631\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u0646\u0631\u062E \u0627\u0646\u0637\u0628\u0627\u0642 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F");
  }
  return {
    total: readings.length,
    byMedium,
    exceeded,
    nearLimit,
    exceededWithoutAction,
    complianceRatePct: valid > 0 ? round2((valid - exceeded) / valid * 100) : null,
    worstFa,
    exceededByMedium,
    warningsFa
  };
}
function trainingSummary(args) {
  const { sessions, attendees, records = [], now = /* @__PURE__ */ new Date() } = args;
  const bySessionType = {};
  for (const t of TRAINING_TYPES) bySessionType[t] = 0;
  let totalManHours = 0;
  const attendanceRates = [];
  const passRates = [];
  const held = sessions.filter((s) => s.Status === "held");
  for (const s of sessions) {
    bySessionType[s.TrainingType] = (bySessionType[s.TrainingType] ?? 0) + 1;
  }
  for (const s of held) {
    const st = trainingSessionState(s, attendees, now);
    totalManHours += st.attended * (Number(s.DurationMinutes) || 0) / 60;
    if (st.attendanceRatePct !== null) attendanceRates.push(st.attendanceRatePct);
    if (st.passRatePct !== null) passRates.push(st.passRatePct);
  }
  const sessionIds = new Set(sessions.map((s) => s.Id));
  const mine = attendees.filter((a) => sessionIds.has(a.SessionId));
  const persons = new Set(mine.map((a) => a.PersonRef));
  let validCertificates = 0;
  let expiredCertificates = 0;
  let expiringSoonCertificates = 0;
  for (const r of records) {
    if (r.Status === "revoked") {
      expiredCertificates += 1;
      continue;
    }
    const left = daysUntil(r.ExpiresAt, now);
    if (left === null) {
      validCertificates += 1;
      continue;
    }
    if (left < 0) expiredCertificates += 1;
    else {
      validCertificates += 1;
      if (left <= EXPIRY_WARNING_DAYS) expiringSoonCertificates += 1;
    }
  }
  const withInduction = new Set(
    records.filter((r) => r.CourseCode === INDUCTION_COURSE_CODE && r.Status !== "revoked").filter((r) => {
      const left = daysUntil(r.ExpiresAt, now);
      return left === null || left >= 0;
    }).map((r) => r.PersonRef)
  );
  const personsWithoutInduction = [...persons].filter((p) => !withInduction.has(p)).sort();
  const avg = (xs) => xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  const warningsFa = [];
  if (expiredCertificates > 0) {
    warningsFa.push(`${expiredCertificates} \u06AF\u0648\u0627\u0647\u06CC \u0622\u0645\u0648\u0632\u0634 \u0645\u0646\u0642\u0636\u06CC \u06CC\u0627 \u0628\u0627\u0637\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  if (expiringSoonCertificates > 0) {
    warningsFa.push(`${expiringSoonCertificates} \u06AF\u0648\u0627\u0647\u06CC \u062A\u0627 ${EXPIRY_WARNING_DAYS} \u0631\u0648\u0632 \u0622\u06CC\u0646\u062F\u0647 \u0645\u0646\u0642\u0636\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F`);
  }
  if (personsWithoutInduction.length > 0) {
    warningsFa.push(`${personsWithoutInduction.length} \u0646\u0641\u0631 \u0628\u062F\u0648\u0646 \u0622\u0645\u0648\u0632\u0634 \u0628\u062F\u0648 \u0648\u0631\u0648\u062F \u0645\u0639\u062A\u0628\u0631 \u062F\u0631 \u062C\u0644\u0633\u0627\u062A \u0634\u0631\u06A9\u062A \u06A9\u0631\u062F\u0647\u200C\u0627\u0646\u062F`);
  }
  return {
    totalSessions: sessions.length,
    heldSessions: held.length,
    bySessionType,
    totalAttendees: mine.length,
    uniquePersons: persons.size,
    totalManHours: round2(totalManHours),
    avgAttendanceRatePct: avg(attendanceRates),
    avgPassRatePct: avg(passRates),
    validCertificates,
    expiredCertificates,
    expiringSoonCertificates,
    personsWithoutInduction,
    warningsFa
  };
}
function healthPpeSummary(args) {
  const { issuances, exams, now = /* @__PURE__ */ new Date() } = args;
  const byPpeType = {};
  for (const t of PPE_TYPES) byPpeType[t] = 0;
  let activeIssuances = 0;
  let overdueReplacement = 0;
  let dueSoonReplacement = 0;
  let totalPpeCost = 0;
  for (const i of issuances) {
    byPpeType[i.PpeType] = (byPpeType[i.PpeType] ?? 0) + 1;
    totalPpeCost += (Number(i.UnitCost) || 0) * (Number(i.Quantity) || 0);
    if (i.Status !== "issued") continue;
    const left = daysUntil(i.ReplaceDueDate, now);
    if (left !== null && left < 0) {
      overdueReplacement += 1;
      continue;
    }
    activeIssuances += 1;
    if (left !== null && left <= EXPIRY_WARNING_DAYS) dueSoonReplacement += 1;
  }
  const byFitness = {};
  for (const f of FITNESS_RESULTS) byFitness[f] = 0;
  const latestByPerson = /* @__PURE__ */ new Map();
  for (const e of exams) {
    if (e.Status === "superseded") continue;
    const prev = latestByPerson.get(e.PersonRef);
    if (!prev || new Date(e.ExaminedAt).getTime() > new Date(prev.ExaminedAt).getTime()) {
      latestByPerson.set(e.PersonRef, e);
    }
  }
  let overdueExams = 0;
  let dueSoonExams = 0;
  let restrictedWithoutDetail = 0;
  const unfitPersons = [];
  for (const e of latestByPerson.values()) {
    byFitness[e.Fitness] = (byFitness[e.Fitness] ?? 0) + 1;
    if (e.Fitness === "unfit") unfitPersons.push(e.PersonNameFa || e.PersonRef);
    if (e.Fitness === "fit_with_restriction" && !String(e.RestrictionFa ?? "").trim()) {
      restrictedWithoutDetail += 1;
    }
    const left = daysUntil(e.NextExamDate, now);
    if (left === null) continue;
    if (left < 0) overdueExams += 1;
    else if (left <= EXPIRY_WARNING_DAYS) dueSoonExams += 1;
  }
  const warningsFa = [];
  if (overdueReplacement > 0) {
    warningsFa.push(`${overdueReplacement} \u062A\u062C\u0647\u06CC\u0632 \u062D\u0641\u0627\u0638\u062A \u0641\u0631\u062F\u06CC \u0627\u0632 \u062A\u0627\u0631\u06CC\u062E \u062A\u0639\u0648\u06CC\u0636 \u06AF\u0630\u0634\u062A\u0647 \u0648 \u0647\u0645\u0686\u0646\u0627\u0646 \u062A\u062D\u0648\u06CC\u0644\u200C\u0646\u0634\u062F\u0647 \u0645\u0627\u0646\u062F\u0647 \u0627\u0633\u062A`);
  }
  if (overdueExams > 0) warningsFa.push(`${overdueExams} \u0646\u0641\u0631 \u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u0645\u0639\u0648\u0642 \u062F\u0627\u0631\u0646\u062F`);
  if (unfitPersons.length > 0) {
    warningsFa.push(`${unfitPersons.length} \u0646\u0641\u0631 \u0628\u0627 \u0646\u062A\u06CC\u062C\u0647\u0654 \xAB\u063A\u06CC\u0631\u0645\u062C\u0627\u0632\xBB \u062F\u0631 \u0641\u0647\u0631\u0633\u062A \u0641\u0639\u0627\u0644 \u0647\u0633\u062A\u0646\u062F`);
  }
  if (restrictedWithoutDetail > 0) {
    warningsFa.push(`${restrictedWithoutDetail} \u0645\u0639\u0627\u06CC\u0646\u0647\u0654 \xAB\u0645\u0634\u0631\u0648\u0637\xBB \u0628\u062F\u0648\u0646 \u0634\u0631\u062D \u0645\u062D\u062F\u0648\u062F\u06CC\u062A \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  return {
    totalIssuances: issuances.length,
    byPpeType,
    activeIssuances,
    overdueReplacement,
    dueSoonReplacement,
    totalPpeCost: round2(totalPpeCost),
    totalExams: exams.length,
    byFitness,
    overdueExams,
    dueSoonExams,
    unfitPersons: unfitPersons.sort(),
    restrictedWithoutDetail,
    warningsFa
  };
}
function validateTrainingSessionInput(input) {
  const issues = [];
  if (!String(input.SessionNo ?? "").trim()) {
    issues.push({ code: "E-HSE-SESSION-NO", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u062C\u0644\u0633\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    issues.push({ code: "E-HSE-SESSION-TITLE", message: "\u0639\u0646\u0648\u0627\u0646 \u062C\u0644\u0633\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.CourseCode ?? "").trim()) {
    issues.push({ code: "E-HSE-SESSION-COURSE", message: "\u06A9\u062F \u062F\u0648\u0631\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!TRAINING_TYPES.includes(input.TrainingType)) {
    issues.push({ code: "E-HSE-SESSION-TYPE", message: "\u0646\u0648\u0639 \u0622\u0645\u0648\u0632\u0634 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  const held = new Date(String(input.HeldAt ?? "")).getTime();
  if (!Number.isFinite(held)) {
    issues.push({ code: "E-HSE-SESSION-DATE", message: "\u062A\u0627\u0631\u06CC\u062E \u0628\u0631\u06AF\u0632\u0627\u0631\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  const dur = Number(input.DurationMinutes);
  if (!Number.isFinite(dur) || dur <= 0) {
    issues.push({ code: "E-HSE-SESSION-DURATION", message: "\u0645\u062F\u062A \u062C\u0644\u0633\u0647 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F" });
  }
  if (!String(input.InstructorFa ?? "").trim()) {
    issues.push({ code: "E-HSE-SESSION-INSTRUCTOR", message: "\u0646\u0627\u0645 \u0645\u062F\u0631\u0633 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (input.ValidityMonths != null) {
    const v = Number(input.ValidityMonths);
    if (!Number.isFinite(v) || v <= 0) {
      issues.push({ code: "E-HSE-SESSION-VALIDITY", message: "\u0645\u062F\u062A \u0627\u0639\u062A\u0628\u0627\u0631 \u06AF\u0648\u0627\u0647\u06CC \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F" });
    }
  }
  return issues;
}
function validatePpeInput(input) {
  const issues = [];
  if (!String(input.IssueNo ?? "").trim()) {
    issues.push({ code: "E-HSE-PPE-NO", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u062A\u062D\u0648\u06CC\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.PersonRef ?? "").trim()) {
    issues.push({ code: "E-HSE-PPE-PERSON", message: "\u0634\u0646\u0627\u0633\u0647\u0654 \u0641\u0631\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!PPE_TYPES.includes(input.PpeType)) {
    issues.push({ code: "E-HSE-PPE-TYPE", message: "\u0646\u0648\u0639 \u062A\u062C\u0647\u06CC\u0632 \u062D\u0641\u0627\u0638\u062A \u0641\u0631\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  const q = Number(input.Quantity);
  if (!Number.isFinite(q) || q <= 0) {
    issues.push({ code: "E-HSE-PPE-QTY", message: "\u062A\u0639\u062F\u0627\u062F \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F" });
  }
  if (!String(input.IssuedAt ?? "").trim() || !Number.isFinite(new Date(String(input.IssuedAt)).getTime())) {
    issues.push({ code: "E-HSE-PPE-DATE", message: "\u062A\u0627\u0631\u06CC\u062E \u062A\u062D\u0648\u06CC\u0644 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (CRITICAL_PPE.includes(input.PpeType) && input.PpeType === "harness" && !input.ReplaceDueDate) {
    issues.push({ code: "E-HSE-PPE-REPLACE-REQUIRED", message: "\u0647\u0627\u0631\u0646\u0633 \u0628\u0627\u06CC\u062F \u062A\u0627\u0631\u06CC\u062E \u062A\u0639\u0648\u06CC\u0636 \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" });
  }
  return issues;
}
function validateHealthExamInput(input) {
  const issues = [];
  if (!String(input.ExamNo ?? "").trim()) {
    issues.push({ code: "E-HSE-EXAM-NO", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u0645\u0639\u0627\u06CC\u0646\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.PersonRef ?? "").trim()) {
    issues.push({ code: "E-HSE-EXAM-PERSON", message: "\u0634\u0646\u0627\u0633\u0647\u0654 \u0641\u0631\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!EXAM_TYPES.includes(input.ExamType)) {
    issues.push({ code: "E-HSE-EXAM-TYPE", message: "\u0646\u0648\u0639 \u0645\u0639\u0627\u06CC\u0646\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!FITNESS_RESULTS.includes(input.Fitness)) {
    issues.push({ code: "E-HSE-EXAM-FITNESS", message: "\u0646\u062A\u06CC\u062C\u0647\u0654 \u0645\u0639\u0627\u06CC\u0646\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!String(input.ExaminedAt ?? "").trim() || !Number.isFinite(new Date(String(input.ExaminedAt)).getTime())) {
    issues.push({ code: "E-HSE-EXAM-DATE", message: "\u062A\u0627\u0631\u06CC\u062E \u0645\u0639\u0627\u06CC\u0646\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (input.Fitness === "fit_with_restriction" && !String(input.RestrictionFa ?? "").trim()) {
    issues.push({
      code: "E-HSE-EXAM-RESTRICTION-REQUIRED",
      message: "\u0646\u062A\u06CC\u062C\u0647\u0654 \xAB\u0628\u0644\u0627\u0645\u0627\u0646\u0639 \u0645\u0634\u0631\u0648\u0637\xBB \u0628\u062F\u0648\u0646 \u0634\u0631\u062D \u0645\u062D\u062F\u0648\u062F\u06CC\u062A \u062B\u0628\u062A \u0646\u0645\u06CC\u200C\u0634\u0648\u062F"
    });
  }
  return issues;
}
function validateWasteInput(input) {
  const issues = [];
  if (!String(input.WasteNo ?? "").trim()) {
    issues.push({ code: "E-HSE-WASTE-NO", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u067E\u0633\u0645\u0627\u0646\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!WASTE_TYPES.includes(input.WasteType)) {
    issues.push({ code: "E-HSE-WASTE-TYPE", message: "\u0646\u0648\u0639 \u067E\u0633\u0645\u0627\u0646\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!String(input.DescriptionFa ?? "").trim()) {
    issues.push({ code: "E-HSE-WASTE-DESC", message: "\u0634\u0631\u062D \u067E\u0633\u0645\u0627\u0646\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  const q = Number(input.Quantity);
  if (!Number.isFinite(q) || q <= 0) {
    issues.push({ code: "E-HSE-WASTE-QTY", message: "\u0645\u0642\u062F\u0627\u0631 \u067E\u0633\u0645\u0627\u0646\u062F \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F" });
  }
  if (!String(input.Unit ?? "").trim()) {
    issues.push({ code: "E-HSE-WASTE-UNIT", message: "\u0648\u0627\u062D\u062F \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!DISPOSAL_METHODS.includes(input.DisposalMethod)) {
    issues.push({ code: "E-HSE-WASTE-METHOD", message: "\u0631\u0648\u0634 \u062F\u0641\u0639 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (MANIFEST_REQUIRED_WASTE.includes(input.WasteType) && !String(input.ManifestNo ?? "").trim()) {
    issues.push({
      code: "E-HSE-WASTE-MANIFEST-REQUIRED",
      message: `${WASTE_TYPE_FA[input.WasteType] ?? "\u0627\u06CC\u0646 \u067E\u0633\u0645\u0627\u0646\u062F"} \u0628\u062F\u0648\u0646 \u0634\u0645\u0627\u0631\u0647\u0654 \u0645\u0627\u0646\u06CC\u0641\u0633\u062A \u062D\u0645\u0644 \u062B\u0628\u062A \u0646\u0645\u06CC\u200C\u0634\u0648\u062F`
    });
  }
  return issues;
}
function validateMonitoringInput(input) {
  const issues = [];
  if (!String(input.ReadingNo ?? "").trim()) {
    issues.push({ code: "E-HSE-ENV-NO", message: "\u0634\u0645\u0627\u0631\u0647\u0654 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!MONITORING_MEDIA.includes(input.Medium)) {
    issues.push({ code: "E-HSE-ENV-MEDIUM", message: "\u0645\u062D\u06CC\u0637 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!String(input.ParameterFa ?? "").trim()) {
    issues.push({ code: "E-HSE-ENV-PARAM", message: "\u0646\u0627\u0645 \u067E\u0627\u0631\u0627\u0645\u062A\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  const v = Number(input.MeasuredValue);
  if (!Number.isFinite(v)) {
    issues.push({ code: "E-HSE-ENV-VALUE", message: "\u0645\u0642\u062F\u0627\u0631 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0628\u0627\u06CC\u062F \u0639\u062F\u062F \u0628\u0627\u0634\u062F" });
  }
  const lim = Number(input.LimitValue);
  if (!Number.isFinite(lim) || lim <= 0) {
    issues.push({ code: "E-HSE-ENV-LIMIT", message: "\u062D\u062F \u0645\u062C\u0627\u0632 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F" });
  }
  if (!String(input.Unit ?? "").trim()) {
    issues.push({ code: "E-HSE-ENV-UNIT", message: "\u0648\u0627\u062D\u062F \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!String(input.MeasuredAt ?? "").trim() || !Number.isFinite(new Date(String(input.MeasuredAt)).getTime())) {
    issues.push({ code: "E-HSE-ENV-DATE", message: "\u062A\u0627\u0631\u06CC\u062E \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  return issues;
}
var HSE_METRIC_CODES = [
  "ltifr",
  "trir",
  "permit_compliance",
  "training_hours_per_worker",
  "violation_closure_rate",
  "hse_score"
];
var HSE_METRIC_FA = {
  ltifr: "\u0646\u0631\u062E \u062A\u06A9\u0631\u0627\u0631 \u062D\u0627\u062F\u062B\u0647\u0654 \u0645\u0646\u062C\u0631 \u0628\u0647 \u0627\u0632 \u06A9\u0627\u0631\u0627\u0641\u062A\u0627\u062F\u06AF\u06CC",
  trir: "\u0646\u0631\u062E \u06A9\u0644 \u062D\u0648\u0627\u062F\u062B \u062B\u0628\u062A\u200C\u0634\u062F\u0646\u06CC",
  permit_compliance: "\u0627\u0646\u0637\u0628\u0627\u0642 \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u06A9\u0627\u0631",
  training_hours_per_worker: "\u0633\u0627\u0639\u062A \u0622\u0645\u0648\u0632\u0634 \u0633\u0631\u0627\u0646\u0647",
  violation_closure_rate: "\u0646\u0631\u062E \u0631\u0641\u0639 \u062A\u062E\u0644\u0641",
  hse_score: "\u0646\u0645\u0631\u0647\u0654 \u0627\u06CC\u0645\u0646\u06CC"
};
var HSE_METRIC_UNIT = {
  ltifr: "rate",
  trir: "rate",
  permit_compliance: "pct",
  training_hours_per_worker: "hours",
  violation_closure_rate: "pct",
  hse_score: "score"
};
var HSE_METRIC_DIRECTION = {
  ltifr: "lower_better",
  trir: "lower_better",
  permit_compliance: "higher_better",
  training_hours_per_worker: "higher_better",
  violation_closure_rate: "higher_better",
  hse_score: "higher_better"
};
var HSE_METRIC_DEFAULT_TARGET = {
  ltifr: 0.5,
  trir: 2,
  permit_compliance: 95,
  training_hours_per_worker: 8,
  violation_closure_rate: 90,
  hse_score: 80
};
var HSE_ALERT_RULES = [
  "unsafe_gas",
  "active_stop_work",
  "expired_permit",
  "training_gap",
  "env_exceedance"
];
var HSE_ALERT_RULE_FA = {
  unsafe_gas: "\u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u0646\u0627\u0627\u06CC\u0645\u0646",
  active_stop_work: "\u062F\u0633\u062A\u0648\u0631 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u0641\u0639\u0627\u0644",
  expired_permit: "\u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u0645\u0646\u0642\u0636\u06CC \u0628\u0627\u0632\u0646\u0634\u062F\u0647",
  training_gap: "\u0634\u06A9\u0627\u0641 \u0622\u0645\u0648\u0632\u0634 \u0627\u06CC\u0645\u0646\u06CC",
  env_exceedance: "\u062A\u062C\u0627\u0648\u0632 \u0627\u0632 \u062D\u062F \u0645\u062C\u0627\u0632 \u0632\u06CC\u0633\u062A\u200C\u0645\u062D\u06CC\u0637\u06CC"
};
var HSE_ALERT_DEFAULTS = {
  unsafe_gas: {
    threshold: 0,
    comparison: "gt",
    severity: "critical",
    ownerRole: "hse_officer",
    actionFa: "\u062A\u0648\u0642\u0641 \u0641\u0648\u0631\u06CC \u06A9\u0627\u0631 \u062F\u0631 \u0645\u062D\u0644\u060C \u062A\u062E\u0644\u06CC\u0647 \u0648 \u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u0645\u062C\u062F\u062F \u067E\u06CC\u0634 \u0627\u0632 \u0647\u0631 \u0627\u062F\u0627\u0645\u0647\u200C\u0627\u06CC"
  },
  active_stop_work: {
    threshold: 0,
    comparison: "gt",
    severity: "critical",
    ownerRole: "project_manager",
    actionFa: "\u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0631\u0641\u0639 \u0639\u0644\u062A \u062A\u0648\u0642\u0641 \u0648 \u0628\u0633\u062A\u0646 \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u067E\u06CC\u0634 \u0627\u0632 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC"
  },
  expired_permit: {
    threshold: 0,
    comparison: "gt",
    severity: "high",
    ownerRole: "hse_officer",
    actionFa: "\u0628\u0633\u062A\u0646 \u0631\u0633\u0645\u06CC \u067E\u0631\u0648\u0627\u0646\u0647\u200C\u0647\u0627\u06CC \u0645\u0646\u0642\u0636\u06CC \u0648 \u0628\u0627\u0632\u06AF\u0631\u062F\u0627\u0646\u062F\u0646 \u0642\u0641\u0644\u200C\u0647\u0627 \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062C\u062F\u0627\u0633\u0627\u0632\u06CC"
  },
  training_gap: {
    threshold: 0,
    comparison: "gt",
    severity: "high",
    ownerRole: "hse_officer",
    actionFa: "\u0628\u0631\u06AF\u0632\u0627\u0631\u06CC \u062F\u0648\u0631\u0647\u0654 \u0628\u062F\u0648 \u0648\u0631\u0648\u062F \u0628\u0631\u0627\u06CC \u0627\u0641\u0631\u0627\u062F \u0641\u0627\u0642\u062F \u06AF\u0648\u0627\u0647\u06CC \u0648 \u062A\u0639\u0644\u06CC\u0642 \u06A9\u0627\u0631\u062A \u062A\u0631\u062F\u062F \u0622\u0646\u0627\u0646"
  },
  env_exceedance: {
    threshold: 0,
    comparison: "gt",
    severity: "medium",
    ownerRole: "hse_officer",
    actionFa: "\u062B\u0628\u062A \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u0648 \u0646\u0645\u0648\u0646\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0645\u062C\u062F\u062F\u061B \u0627\u0637\u0644\u0627\u0639 \u0628\u0647 \u0648\u0627\u062D\u062F \u0645\u062D\u06CC\u0637\u200C\u0632\u06CC\u0633\u062A \u06A9\u0627\u0631\u0641\u0631\u0645\u0627"
  }
};
var HSE_SCORE_WEIGHTS = {
  ltifr: 30,
  trir: 20,
  permit_compliance: 20,
  training_hours_per_worker: 15,
  violation_closure_rate: 15
};
var HSE_SCORE_BLOCKED_CAP = 55;
function periodCodeOf(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function periodRange(periodCode) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(periodCode).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const end = new Date(Date.UTC(y, mo, 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
function permitComplianceMetric(permits, now = /* @__PURE__ */ new Date()) {
  const warningsFa = [];
  if (!permits.length) {
    warningsFa.push("\u0647\u06CC\u0686 \u067E\u0631\u0648\u0627\u0646\u0647\u0654 \u06A9\u0627\u0631\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u062F\u0648\u0631\u0647 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
    return { value: null, total: 0, compliant: 0, expiredOpen: 0, warningsFa };
  }
  let compliant = 0;
  let expiredOpen = 0;
  for (const p of permits) {
    const st = permitState(p, now);
    if (st.effectiveStatus === "expired" && p.Status !== "closed" && p.Status !== "cancelled") {
      expiredOpen += 1;
      continue;
    }
    compliant += 1;
  }
  return {
    value: round2(compliant / permits.length * 100),
    total: permits.length,
    compliant,
    expiredOpen,
    warningsFa
  };
}
function trainingHoursMetric(args) {
  const { sessions, attendees, headCount, from, to } = args;
  const warningsFa = [];
  const f = from ? new Date(from).getTime() : null;
  const t = to ? new Date(to).getTime() : null;
  const inRange = (iso) => {
    const d = new Date(iso).getTime();
    if (!Number.isFinite(d)) return false;
    if (f !== null && d < f) return false;
    if (t !== null && d > t + 86399999) return false;
    return true;
  };
  const held = sessions.filter((s) => s.Status === "held" && inRange(String(s.HeldAt)));
  const heldIds = new Set(held.map((s) => s.Id));
  const durationById = new Map(held.map((s) => [s.Id, Number(s.DurationMinutes) || 0]));
  let totalMinutes = 0;
  const persons = /* @__PURE__ */ new Set();
  for (const a of attendees) {
    if (!heldIds.has(a.SessionId)) continue;
    if (a.Attended === false) continue;
    totalMinutes += durationById.get(a.SessionId) ?? 0;
    persons.add(a.PersonRef);
  }
  const totalManHours = round2(totalMinutes / 60);
  const explicit = Number(headCount);
  if (Number.isFinite(explicit) && explicit > 0) {
    return {
      value: round2(totalManHours / explicit),
      totalManHours,
      personCount: explicit,
      basis: "headcount",
      warningsFa
    };
  }
  if (!persons.size) {
    warningsFa.push("\u0647\u06CC\u0686 \u062D\u0627\u0636\u0631\u06CC \u062F\u0631 \u062C\u0644\u0633\u0627\u062A \u0627\u06CC\u0646 \u062F\u0648\u0631\u0647 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
    return { value: null, totalManHours, personCount: 0, basis: "attendees", warningsFa };
  }
  warningsFa.push(
    "\u0634\u0645\u0627\u0631 \u06A9\u0627\u0631\u06A9\u0646\u0627\u0646 \u067E\u0631\u0648\u0698\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u0628\u0648\u062F\u061B \u0633\u0631\u0627\u0646\u0647 \u0628\u0631 \u067E\u0627\u06CC\u0647\u0654 \u0627\u0641\u0631\u0627\u062F \u062D\u0627\u0636\u0631 \u0645\u062D\u0627\u0633\u0628\u0647 \u0634\u062F\u0647 \u0648 \u0627\u0632 \u0645\u0642\u062F\u0627\u0631 \u0648\u0627\u0642\u0639\u06CC \u0628\u0627\u0644\u0627\u062A\u0631 \u0627\u0633\u062A"
  );
  return {
    value: round2(totalManHours / persons.size),
    totalManHours,
    personCount: persons.size,
    basis: "attendees",
    warningsFa
  };
}
function violationClosureMetric(violations, now = /* @__PURE__ */ new Date()) {
  const warningsFa = [];
  const nowMs = now.getTime();
  const due = violations.filter((v) => {
    if (v.Status === "cancelled") return false;
    if (v.Status === "closed" || v.Status === "released") return true;
    const d = v.DueDate ? new Date(String(v.DueDate)).getTime() : NaN;
    return Number.isFinite(d) && d + 86399999 < nowMs;
  });
  if (!due.length) {
    warningsFa.push("\u0647\u06CC\u0686 \u062A\u062E\u0644\u0641\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u062F\u0648\u0631\u0647 \u0633\u0631\u0631\u0633\u06CC\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
    return { value: null, due: 0, closed: 0, overdue: 0, warningsFa };
  }
  const closed = due.filter((v) => v.Status === "closed" || v.Status === "released").length;
  return {
    value: round2(closed / due.length * 100),
    due: due.length,
    closed,
    overdue: due.length - closed,
    warningsFa
  };
}
function metricVerdict(code, value, target) {
  if (value == null || !Number.isFinite(value)) {
    return { code: "unknown", fa: "\u0646\u0627\u0645\u0639\u0644\u0648\u0645 \u2014 \u062F\u0627\u062F\u0647\u0654 \u067E\u0627\u06CC\u0647 \u0646\u0627\u0642\u0635 \u0627\u0633\u062A", color: "#6B7280", isMet: null };
  }
  const t = Number.isFinite(Number(target)) ? Number(target) : HSE_METRIC_DEFAULT_TARGET[code];
  const lower = HSE_METRIC_DIRECTION[code] === "lower_better";
  const met = lower ? value <= t : value >= t;
  if (met) return { code: "met", fa: "\u062F\u0631 \u062D\u062F \u0647\u062F\u0641", color: "#059669", isMet: true };
  const gap = lower ? (value - t) / (t || 1) : (t - value) / (t || 1);
  if (gap <= 0.2) return { code: "near", fa: "\u0646\u0632\u062F\u06CC\u06A9 \u0647\u062F\u0641", color: "#D97706", isMet: false };
  return { code: "missed", fa: "\u062E\u0627\u0631\u062C \u0627\u0632 \u0647\u062F\u0641", color: "#DC2626", isMet: false };
}
function hseMetricSet(args) {
  const {
    periodCode,
    incidents = [],
    persons = [],
    manHourLogs = [],
    permits = [],
    violations = [],
    sessions = [],
    attendees = [],
    headCount,
    targets = {},
    now = /* @__PURE__ */ new Date()
  } = args;
  const range = periodRange(periodCode);
  const from = range?.from ?? void 0;
  const to = range?.to ?? void 0;
  const warningsFa = [];
  const safety = safetyMetricsFull({ incidents, persons, manHourLogs, from, to });
  warningsFa.push(...safety.warningsFa);
  const inRange = (iso) => {
    if (!range) return true;
    const d = iso ? new Date(String(iso)).getTime() : NaN;
    if (!Number.isFinite(d)) return false;
    return d >= new Date(range.from).getTime() && d <= new Date(range.to).getTime() + 86399999;
  };
  const periodPermits = permits.filter((p) => inRange(p.ValidFrom));
  const periodViolations = violations.filter((v) => inRange(v.IssuedAt));
  const compliance = permitComplianceMetric(periodPermits, now);
  warningsFa.push(...compliance.warningsFa);
  const training = trainingHoursMetric({ sessions, attendees, headCount, from, to });
  warningsFa.push(...training.warningsFa);
  const closure = violationClosureMetric(periodViolations, now);
  warningsFa.push(...closure.warningsFa);
  const raw = {
    ltifr: {
      value: safety.ltifr,
      detailFa: safety.manHours ? `${safety.lostTime} \u062D\u0627\u062F\u062B\u0647\u0654 \u0645\u0646\u062C\u0631 \u0628\u0647 \u0627\u0632 \u06A9\u0627\u0631\u0627\u0641\u062A\u0627\u062F\u06AF\u06CC \u062F\u0631 ${round2(safety.manHours).toLocaleString("fa-IR")} \u0646\u0641\u0631\u0633\u0627\u0639\u062A` : "\u0646\u0641\u0631\u0633\u0627\u0639\u062A \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"
    },
    trir: {
      value: safety.trir,
      detailFa: safety.manHours ? `${safety.recordable} \u062D\u0627\u062F\u062B\u0647\u0654 \u062B\u0628\u062A\u200C\u0634\u062F\u0646\u06CC \u062F\u0631 ${round2(safety.manHours).toLocaleString("fa-IR")} \u0646\u0641\u0631\u0633\u0627\u0639\u062A` : "\u0646\u0641\u0631\u0633\u0627\u0639\u062A \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"
    },
    permit_compliance: {
      value: compliance.value,
      detailFa: compliance.total ? `${compliance.compliant} \u0627\u0632 ${compliance.total} \u067E\u0631\u0648\u0627\u0646\u0647 \u0645\u0646\u0637\u0628\u0642 \xB7 ${compliance.expiredOpen} \u0645\u0646\u0642\u0636\u06CC \u0628\u0627\u0632\u0646\u0634\u062F\u0647` : "\u067E\u0631\u0648\u0627\u0646\u0647\u200C\u0627\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"
    },
    training_hours_per_worker: {
      value: training.value,
      detailFa: training.personCount ? `${training.totalManHours} \u0646\u0641\u0631\u0633\u0627\u0639\u062A \u0622\u0645\u0648\u0632\u0634 \u0628\u0631\u0627\u06CC ${training.personCount} \u0646\u0641\u0631 (${training.basis === "headcount" ? "\u0634\u0645\u0627\u0631 \u06A9\u0627\u0631\u06A9\u0646\u0627\u0646" : "\u0627\u0641\u0631\u0627\u062F \u062D\u0627\u0636\u0631"})` : "\u062D\u0627\u0636\u0631\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"
    },
    violation_closure_rate: {
      value: closure.value,
      detailFa: closure.due ? `${closure.closed} \u0627\u0632 ${closure.due} \u062A\u062E\u0644\u0641 \u0633\u0631\u0631\u0633\u06CC\u062F\u0634\u062F\u0647 \u0631\u0641\u0639 \u0634\u062F\u0647 \xB7 ${closure.overdue} \u0645\u0639\u0648\u0642` : "\u062A\u062E\u0644\u0641 \u0633\u0631\u0631\u0633\u06CC\u062F\u0634\u062F\u0647\u200C\u0627\u06CC \u0646\u06CC\u0633\u062A"
    }
  };
  const metrics = Object.keys(raw).map((code) => {
    const target = Number.isFinite(Number(targets[code])) ? Number(targets[code]) : HSE_METRIC_DEFAULT_TARGET[code];
    return {
      code,
      titleFa: HSE_METRIC_FA[code],
      unit: HSE_METRIC_UNIT[code],
      value: raw[code].value,
      target,
      verdict: metricVerdict(code, raw[code].value, target),
      detailFa: raw[code].detailFa
    };
  });
  return {
    periodCode,
    from: range?.from ?? null,
    to: range?.to ?? null,
    metrics,
    manHours: safety.manHours,
    warningsFa: [...new Set(warningsFa)]
  };
}
function evaluateHseAlerts(args) {
  const {
    rules = [],
    gasTests = [],
    violations = [],
    permits = [],
    trainings = [],
    personRefs = [],
    readings = [],
    now = /* @__PURE__ */ new Date()
  } = args;
  const byCode = new Map(rules.filter((r) => r.Status !== "retired").map((r) => [r.RuleCode, r]));
  const warningsFa = [];
  const nowMs = now.getTime();
  const unsafeGas = gasTests.filter((g) => g.IsSafe === false).length;
  const activeStopWork = violations.filter((v) => {
    const st = violationState(v, now);
    return st.isBlocking;
  }).length;
  const expiredPermits = permits.filter((p) => {
    const st = permitState(p, now);
    return st.effectiveStatus === "expired" && p.Status !== "closed" && p.Status !== "cancelled";
  }).length;
  let trainingGap = 0;
  let trainingMeasurable = true;
  if (!personRefs.length) {
    trainingMeasurable = false;
    warningsFa.push("\u0641\u0647\u0631\u0633\u062A \u0627\u0641\u0631\u0627\u062F \u06A9\u0627\u0631\u06AF\u0627\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u0628\u0648\u062F\u061B \u0634\u06A9\u0627\u0641 \u0622\u0645\u0648\u0632\u0634 \u0633\u0646\u062C\u06CC\u062F\u0647 \u0646\u0634\u062F");
  } else {
    for (const ref of personRefs) {
      const m = personTrainingMatrix({ personRef: ref, records: trainings, now });
      if (!m.isCleared) trainingGap += 1;
    }
  }
  const envExceedance = readings.filter((r) => {
    const st = monitoringState(r);
    return st.needsAction;
  }).length;
  const observed = {
    unsafe_gas: unsafeGas,
    active_stop_work: activeStopWork,
    expired_permit: expiredPermits,
    training_gap: trainingGap,
    env_exceedance: envExceedance
  };
  const compare = (v, op, t) => {
    switch (op) {
      case "gte":
        return v >= t;
      case "lt":
        return v < t;
      case "lte":
        return v <= t;
      case "eq":
        return v === t;
      case "gt":
      default:
        return v > t;
    }
  };
  const alerts = HSE_ALERT_RULES.map((code) => {
    const def = HSE_ALERT_DEFAULTS[code];
    const row = byCode.get(code);
    const threshold = row && Number.isFinite(Number(row.Threshold)) ? Number(row.Threshold) : def.threshold;
    const comparison = row?.Comparison || def.comparison;
    const severity = row?.Severity || def.severity;
    const enabled = row ? row.IsEnabled !== false : true;
    const mutedUntil = row?.MutedUntil ? new Date(String(row.MutedUntil)).getTime() : NaN;
    const isMuted = !enabled || Number.isFinite(mutedUntil) && mutedUntil + 86399999 >= nowMs;
    const value = observed[code];
    const measurable = code === "training_gap" ? trainingMeasurable : true;
    const isTriggered = measurable && !isMuted && compare(value, comparison, threshold);
    let detailFa;
    if (!measurable) detailFa = "\u0642\u0627\u0628\u0644 \u0633\u0646\u062C\u0634 \u0646\u0628\u0648\u062F";
    else if (isMuted) detailFa = row?.MuteReasonFa ? `\u062F\u0631 \u0633\u06A9\u0648\u062A: ${row.MuteReasonFa}` : "\u062F\u0631 \u0633\u06A9\u0648\u062A \u0645\u0648\u0642\u062A";
    else if (!isTriggered) detailFa = "\u062F\u0631 \u0648\u0636\u0639\u06CC\u062A \u0639\u0627\u062F\u06CC";
    else {
      switch (code) {
        case "unsafe_gas":
          detailFa = `${value} \u06AF\u0627\u0632\u0633\u0646\u062C\u06CC \u0646\u0627\u0627\u06CC\u0645\u0646 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A`;
          break;
        case "active_stop_work":
          detailFa = `${value} \u062F\u0633\u062A\u0648\u0631 \u062A\u0648\u0642\u0641 \u06A9\u0627\u0631 \u0641\u0639\u0627\u0644 \u0627\u0633\u062A`;
          break;
        case "expired_permit":
          detailFa = `${value} \u067E\u0631\u0648\u0627\u0646\u0647 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0648 \u0628\u0633\u062A\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`;
          break;
        case "training_gap":
          detailFa = `${value} \u0646\u0641\u0631 \u0641\u0627\u0642\u062F \u0622\u0645\u0648\u0632\u0634 \u0645\u0639\u062A\u0628\u0631 \u0628\u062F\u0648 \u0648\u0631\u0648\u062F \u0647\u0633\u062A\u0646\u062F`;
          break;
        default:
          detailFa = `${value} \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0641\u0631\u0627\u062A\u0631 \u0627\u0632 \u062D\u062F \u0628\u062F\u0648\u0646 \u0627\u0642\u062F\u0627\u0645 \u0627\u0635\u0644\u0627\u062D\u06CC \u0627\u0633\u062A`;
      }
    }
    return {
      ruleCode: code,
      titleFa: row?.TitleFa || HSE_ALERT_RULE_FA[code],
      severity,
      isTriggered,
      isMuted,
      observed: value,
      threshold,
      comparison,
      ownerRole: row?.OwnerRole || def.ownerRole,
      actionFa: row?.ActionFa || def.actionFa,
      detailFa
    };
  });
  const triggered = alerts.filter((a) => a.isTriggered);
  const critical = triggered.filter((a) => a.severity === "critical");
  return {
    alerts,
    triggeredCount: triggered.length,
    criticalCount: critical.length,
    mutedCount: alerts.filter((a) => a.isMuted).length,
    blockingFa: critical.map((a) => `${a.titleFa}: ${a.detailFa}`),
    warningsFa
  };
}
function hseScore(args) {
  const { metrics, alerts } = args;
  const warningsFa = [];
  const contributions = [];
  let weighted = 0;
  let usedWeight = 0;
  let totalWeight = 0;
  for (const m of metrics) {
    if (m.code === "hse_score") continue;
    const weight = HSE_SCORE_WEIGHTS[m.code] ?? 0;
    totalWeight += weight;
    if (m.value == null || !Number.isFinite(m.value)) {
      contributions.push({ code: m.code, titleFa: m.titleFa, weight, normalized: null });
      continue;
    }
    const target = m.target || HSE_METRIC_DEFAULT_TARGET[m.code];
    let normalized;
    if (HSE_METRIC_DIRECTION[m.code] === "lower_better") {
      normalized = target <= 0 ? m.value <= 0 ? 100 : 0 : 100 * (1 - (m.value - target) / target);
      if (m.value <= target) normalized = 100;
    } else {
      normalized = target <= 0 ? 100 : m.value / target * 100;
    }
    normalized = Math.max(0, Math.min(100, round2(normalized)));
    contributions.push({ code: m.code, titleFa: m.titleFa, weight, normalized });
    weighted += normalized * weight;
    usedWeight += weight;
  }
  if (!usedWeight) {
    warningsFa.push("\u0647\u06CC\u0686 \u0634\u0627\u062E\u0635\u06CC \u062F\u0627\u062F\u0647\u0654 \u06A9\u0627\u0641\u06CC \u0646\u062F\u0627\u0634\u062A\u061B \u0646\u0645\u0631\u0647\u0654 \u0627\u06CC\u0645\u0646\u06CC \u0645\u062D\u0627\u0633\u0628\u0647 \u0646\u0634\u062F");
    return {
      score: null,
      band: { code: "unknown", fa: "\u0646\u0627\u0645\u0639\u0644\u0648\u0645", color: "#6B7280" },
      coveragePct: 0,
      contributions,
      isCapped: false,
      capReasonFa: [],
      warningsFa
    };
  }
  const coveragePct = round2(usedWeight / (totalWeight || 1) * 100);
  if (coveragePct < 60) {
    warningsFa.push(`\u0646\u0645\u0631\u0647 \u062A\u0646\u0647\u0627 \u0628\u0631 \u067E\u0627\u06CC\u0647\u0654 ${coveragePct} \u062F\u0631\u0635\u062F \u0648\u0632\u0646 \u0634\u0627\u062E\u0635\u200C\u0647\u0627 \u0645\u062D\u0627\u0633\u0628\u0647 \u0634\u062F\u0647 \u0648 \u0642\u0627\u0628\u0644 \u0627\u062A\u06A9\u0627 \u0646\u06CC\u0633\u062A`);
  }
  let score = round2(weighted / usedWeight);
  const capReasonFa = [];
  if (alerts && alerts.criticalCount > 0 && score > HSE_SCORE_BLOCKED_CAP) {
    score = HSE_SCORE_BLOCKED_CAP;
    capReasonFa.push(...alerts.blockingFa);
    warningsFa.push(`\u0646\u0645\u0631\u0647 \u0628\u0647\u200C\u062F\u0644\u06CC\u0644 ${alerts.criticalCount} \u0647\u0634\u062F\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC \u0628\u0647 \u0633\u0642\u0641 ${HSE_SCORE_BLOCKED_CAP} \u0645\u062D\u062F\u0648\u062F \u0634\u062F`);
  }
  const band = score >= 85 ? { code: "excellent", fa: "\u0639\u0627\u0644\u06CC", color: "#059669" } : score >= 70 ? { code: "good", fa: "\u0642\u0627\u0628\u0644 \u0642\u0628\u0648\u0644", color: "#65A30D" } : score >= 55 ? { code: "fair", fa: "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0647\u0628\u0648\u062F", color: "#D97706" } : { code: "poor", fa: "\u0628\u062D\u0631\u0627\u0646\u06CC", color: "#DC2626" };
  return {
    score,
    band,
    coveragePct,
    contributions,
    isCapped: capReasonFa.length > 0,
    capReasonFa,
    warningsFa
  };
}
function metricTrend(snapshots, metricCode) {
  const points = snapshots.filter((s) => s.MetricCode === metricCode && s.Status !== "superseded").map((s) => ({
    periodCode: String(s.PeriodCode),
    value: Number(s.Value),
    isEstimated: s.IsEstimated === true
  })).filter((p) => Number.isFinite(p.value)).sort((a, b) => a.periodCode.localeCompare(b.periodCode));
  const titleFa = HSE_METRIC_FA[metricCode];
  if (points.length < 2) {
    return {
      metricCode,
      titleFa,
      points,
      latest: points.length ? points[points.length - 1].value : null,
      previous: null,
      changePct: null,
      direction: "unknown",
      directionFa: "\u0631\u0648\u0646\u062F \u0647\u0646\u0648\u0632 \u0642\u0627\u0628\u0644 \u062A\u0634\u062E\u06CC\u0635 \u0646\u06CC\u0633\u062A"
    };
  }
  const latest = points[points.length - 1].value;
  const previous = points[points.length - 2].value;
  const changePct = previous === 0 ? null : round2((latest - previous) / Math.abs(previous) * 100);
  const lower = HSE_METRIC_DIRECTION[metricCode] === "lower_better";
  let direction;
  if (latest === previous) direction = "flat";
  else if (latest < previous) direction = lower ? "improving" : "worsening";
  else direction = lower ? "worsening" : "improving";
  const directionFa = direction === "improving" ? "\u0631\u0648 \u0628\u0647 \u0628\u0647\u0628\u0648\u062F" : direction === "worsening" ? "\u0631\u0648 \u0628\u0647 \u0628\u062F\u062A\u0631 \u0634\u062F\u0646" : "\u0628\u062F\u0648\u0646 \u062A\u063A\u06CC\u06CC\u0631";
  return { metricCode, titleFa, points, latest, previous, changePct, direction, directionFa };
}
function hseDashboard(args) {
  const set = hseMetricSet(args);
  const alerts = evaluateHseAlerts({
    rules: args.rules,
    gasTests: args.gasTests,
    violations: args.violations,
    permits: args.permits,
    trainings: args.trainings,
    personRefs: args.personRefs,
    readings: args.readings,
    now: args.now
  });
  const score = hseScore({ metrics: set.metrics, alerts });
  const snapshots = args.snapshots ?? [];
  const trends = snapshots.length ? HSE_METRIC_CODES.map((c) => metricTrend(snapshots, c)).filter((t) => t.points.length > 0) : [];
  return {
    periodCode: set.periodCode,
    from: set.from,
    to: set.to,
    metrics: set.metrics,
    manHours: set.manHours,
    alerts,
    score,
    trends,
    warningsFa: [.../* @__PURE__ */ new Set([...set.warningsFa, ...alerts.warningsFa, ...score.warningsFa])]
  };
}
function buildMetricSnapshots(args) {
  const { projectId, periodCode, dashboard, capturedAt } = args;
  const at = capturedAt || (/* @__PURE__ */ new Date()).toISOString();
  const rows = [];
  for (const m of dashboard.metrics) {
    if (m.value == null) continue;
    rows.push({
      ProjectId: projectId,
      PeriodCode: periodCode,
      MetricCode: m.code,
      Value: m.value,
      Target: m.target,
      Unit: HSE_METRIC_UNIT[m.code],
      CapturedAt: at,
      BaseManHours: dashboard.manHours ?? null,
      SampleSize: null,
      IsEstimated: dashboard.manHours == null,
      NoteFa: m.detailFa,
      Status: "published"
    });
  }
  if (dashboard.score.score != null) {
    rows.push({
      ProjectId: projectId,
      PeriodCode: periodCode,
      MetricCode: "hse_score",
      Value: dashboard.score.score,
      Target: HSE_METRIC_DEFAULT_TARGET.hse_score,
      Unit: "score",
      CapturedAt: at,
      BaseManHours: dashboard.manHours ?? null,
      SampleSize: dashboard.score.contributions.filter((c) => c.normalized != null).length,
      /* پوشش کمتر از کامل یعنی نمره برآوردی است، حتی اگر عدد دقیق
       * به نظر برسد. */
      IsEstimated: dashboard.score.coveragePct < 100,
      NoteFa: dashboard.score.isCapped ? `\u0645\u062D\u062F\u0648\u062F\u0634\u062F\u0647 \u0628\u0647 \u0633\u0642\u0641: ${dashboard.score.capReasonFa.join("\u061B ")}` : `\u067E\u0648\u0634\u0634 ${dashboard.score.coveragePct} \u062F\u0631\u0635\u062F \u0648\u0632\u0646 \u0634\u0627\u062E\u0635\u200C\u0647\u0627`,
      Status: "published"
    });
  }
  return rows;
}
function hseHealthContribution(args) {
  const { score, alerts } = args;
  if (score.score == null) {
    return {
      kpiCode: "hse_score",
      value: null,
      status: "unknown",
      isReliable: false,
      summaryFa: "\u0646\u0645\u0631\u0647\u0654 \u0627\u06CC\u0645\u0646\u06CC \u0628\u0647\u200C\u062F\u0644\u06CC\u0644 \u0646\u0628\u0648\u062F \u062F\u0627\u062F\u0647\u0654 \u067E\u0627\u06CC\u0647 \u0645\u062D\u0627\u0633\u0628\u0647 \u0646\u0634\u062F"
    };
  }
  const status = alerts.criticalCount > 0 ? "red" : score.score >= 85 ? "green" : score.score >= 70 ? "amber" : score.score >= 55 ? "amber" : "red";
  const parts = [`\u0646\u0645\u0631\u0647\u0654 \u0627\u06CC\u0645\u0646\u06CC ${score.score} (${score.band.fa})`];
  if (alerts.triggeredCount) parts.push(`${alerts.triggeredCount} \u0647\u0634\u062F\u0627\u0631 \u0641\u0639\u0627\u0644`);
  if (alerts.criticalCount) parts.push(`${alerts.criticalCount} \u0645\u0648\u0631\u062F \u0628\u062D\u0631\u0627\u0646\u06CC`);
  if (score.coveragePct < 100) parts.push(`\u067E\u0648\u0634\u0634 \u062F\u0627\u062F\u0647 ${score.coveragePct} \u062F\u0631\u0635\u062F`);
  return {
    kpiCode: "hse_score",
    value: score.score,
    status,
    isReliable: score.coveragePct >= 60 && !score.isCapped,
    summaryFa: parts.join(" \xB7 ")
  };
}
function validateAlertRuleInput(input) {
  const issues = [];
  if (!HSE_ALERT_RULES.includes(String(input.RuleCode))) {
    issues.push({ code: "E-HSE-ALERT-CODE", message: "\u06A9\u062F \u0642\u0627\u0639\u062F\u0647\u0654 \u0647\u0634\u062F\u0627\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (!String(input.TitleFa ?? "").trim()) {
    issues.push({ code: "E-HSE-ALERT-TITLE", message: "\u0639\u0646\u0648\u0627\u0646 \u0642\u0627\u0639\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (!SEVERITIES.includes(String(input.Severity))) {
    issues.push({ code: "E-HSE-ALERT-SEVERITY", message: "\u0634\u062F\u062A \u0647\u0634\u062F\u0627\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  const th = Number(input.Threshold);
  if (!Number.isFinite(th) || th < 0) {
    issues.push({ code: "E-HSE-ALERT-THRESHOLD", message: "\u0622\u0633\u062A\u0627\u0646\u0647 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0646\u0627\u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F" });
  }
  if (!["gt", "gte", "lt", "lte", "eq"].includes(String(input.Comparison))) {
    issues.push({ code: "E-HSE-ALERT-COMPARISON", message: "\u0639\u0645\u0644\u06AF\u0631 \u0645\u0642\u0627\u06CC\u0633\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  if (input.MutedUntil && !String(input.MuteReasonFa ?? "").trim()) {
    issues.push({ code: "E-HSE-ALERT-MUTE-REASON", message: "\u0628\u0631\u0627\u06CC \u0633\u06A9\u0648\u062A \u0645\u0648\u0642\u062A\u060C \u0630\u06A9\u0631 \u062F\u0644\u06CC\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A" });
  }
  if (input.MutedUntil && !Number.isFinite(new Date(String(input.MutedUntil)).getTime())) {
    issues.push({ code: "E-HSE-ALERT-MUTE-DATE", message: "\u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646 \u0633\u06A9\u0648\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A" });
  }
  return issues;
}
export {
  APPROVAL_LEVELS,
  APPROVAL_LEVEL_FA,
  BODY_PARTS,
  BODY_PART_FA,
  CAPA_STATUSES,
  CAPA_STATUS_FA,
  CAPA_TYPES,
  CAPA_TYPE_FA,
  CAUSE_CATEGORIES,
  CAUSE_CATEGORY_FA,
  CAUSE_LEVELS,
  CAUSE_LEVEL_FA,
  CONTROL_LEVELS,
  CONTROL_LEVEL_FA,
  CONTROL_RANK,
  CRITICAL_PPE,
  DISPOSAL_METHODS,
  DISPOSAL_METHOD_FA,
  EXAM_TYPES,
  EXAM_TYPE_FA,
  EXPIRY_WARNING_DAYS,
  FINDING_CATEGORIES,
  FINDING_CATEGORY_FA,
  FINDING_STATUSES,
  FINDING_STATUS_FA,
  FITNESS_FA,
  FITNESS_RESULTS,
  FLASH_REPORT_SLA_MINUTES,
  GAS_LIMITS,
  GAS_TEST_REQUIRED_PERMITS,
  GAS_TEST_VALIDITY_MINUTES,
  HAZARD_CATEGORIES,
  HAZARD_CATEGORY_FA,
  HAZARD_TYPES,
  HAZARD_TYPE_FA,
  HIGH_RISK_PERMITS,
  HSE_ALERT_DEFAULTS,
  HSE_ALERT_RULES,
  HSE_ALERT_RULE_FA,
  HSE_METRIC_CODES,
  HSE_METRIC_DEFAULT_TARGET,
  HSE_METRIC_DIRECTION,
  HSE_METRIC_FA,
  HSE_METRIC_UNIT,
  HSE_SCORE_BLOCKED_CAP,
  HSE_SCORE_WEIGHTS,
  ICEBERG_RATIO_MIN,
  INCIDENT_TYPES,
  INCIDENT_TYPE_FA,
  INDUCTION_COURSE_CODE,
  INJURY_TYPES,
  INJURY_TYPE_FA,
  INSPECTION_PASS_SCORE,
  INSPECTION_TYPES,
  INSPECTION_TYPE_FA,
  INVESTIGATION_REQUIRED_TYPES,
  INVESTIGATION_STATUSES,
  INVESTIGATION_STATUS_FA,
  ISOLATION_REQUIRED_PERMITS,
  ISOLATION_STATUSES,
  ISOLATION_STATUS_FA,
  ISOLATION_TYPES,
  ISOLATION_TYPE_FA,
  JSA_STATUSES,
  JSA_STATUS_FA,
  LOST_TIME_TYPES,
  MANDATORY_STOP_WORK_TYPES,
  MANIFEST_REQUIRED_WASTE,
  MAX_APPROVABLE_RESIDUAL,
  MEDIUM_FA,
  MIN_ROOT_CAUSE_DEPTH,
  MONITORING_MEDIA,
  PERMIT_STATUSES,
  PERMIT_STATUS_FA,
  PERMIT_TYPES,
  PERMIT_TYPE_FA,
  PPE_ONLY_RISK_THRESHOLD,
  PPE_STATUSES,
  PPE_STATUS_FA,
  PPE_TYPES,
  PPE_TYPE_FA,
  RECORDABLE_TYPES,
  RISK_BANDS,
  SESSION_STATUSES,
  SESSION_STATUS_FA,
  SEVERITIES,
  SEVERITY_FA,
  STOP_WORK_SCOPES,
  STOP_WORK_SCOPE_FA,
  TRAINING_TYPES,
  TRAINING_TYPE_FA,
  VIOLATION_SLA_DAYS,
  VIOLATION_STATUSES,
  VIOLATION_STATUS_FA,
  VIOLATION_TYPES,
  VIOLATION_TYPE_FA,
  WASTE_STATUSES,
  WASTE_STATUS_FA,
  WASTE_TYPES,
  WASTE_TYPE_FA,
  activityStopWorkState,
  approvalChain,
  buildMetricSnapshots,
  canApproveJsa,
  canApprovePermit,
  canCloseIncident,
  canCloseIncidentFull,
  canCloseInspection,
  canCloseInvestigation,
  canClosePermit,
  canIssuePermit,
  canReleaseViolation,
  canResumePermit,
  canSignPermit,
  canSuspendPermit,
  capaSummary,
  evaluateGasTest,
  evaluateHazard,
  evaluateHseAlerts,
  findingSummary,
  flashReportStatus,
  healthPpeSummary,
  hseAlerts,
  hseDashboard,
  hseHealthContribution,
  hseMetricSet,
  hseScore,
  hseSummary,
  injurySummary,
  isolationState,
  jsaState,
  jsaSummary,
  jsaSupportsPermit,
  latestGasTest,
  manHourTotal,
  metricTrend,
  metricVerdict,
  monitoringState,
  monitoringSummary,
  nextExamDate,
  periodCodeOf,
  periodRange,
  permitComplianceMetric,
  permitState,
  personHealthState,
  personPpeState,
  personSiteClearance,
  personTrainingMatrix,
  precautionState,
  ptwSummary,
  requiresInvestigation,
  rfsuSafetyClearance,
  riskBand,
  riskScore,
  rootCauseTree,
  safetyMetrics,
  safetyMetricsFull,
  stopWorkRequirement,
  suggestSeverity,
  suggestViolationDueDate,
  trainingHoursMetric,
  trainingSessionState,
  trainingSummary,
  trainingValidity,
  validateAlertRuleInput,
  validateCapaInput,
  validateControlInput,
  validateFindingInput,
  validateHazardInput,
  validateHealthExamInput,
  validateIncidentInput,
  validateInjuredPersonInput,
  validateJsaInput,
  validateMonitoringInput,
  validatePermitInput,
  validatePpeInput,
  validateRootCauseInput,
  validateTrainingSessionInput,
  validateViolationInput,
  validateWasteInput,
  violationClosureMetric,
  violationState,
  violationSummary,
  wasteLogState,
  wasteSummary
};
