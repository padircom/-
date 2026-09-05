/** RCC guardian / CCB / quantum — no writes to SPI/pctApproved. */

export function daysLeft(dueIso, now = new Date()) {
  const due = new Date(dueIso + "T12:00:00Z");
  return Math.floor((due.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
}

export function guardianTick(notices, now = new Date()) {
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

export function applyGuardian(notices, now = new Date()) {
  const events = guardianTick(notices, now);
  const next = notices.map((n) => {
    const hit = events.find((e) => e.noticeId === n.id && e.action === "mark_time_barred");
    return hit ? { ...n, timeBarred: true } : n;
  });
  return { events, notices: next };
}

export function depletionAlert(progressPct, opening, balance) {
  if (opening <= 0) return false;
  const usedPct = (1 - balance / opening) * 100;
  return usedPct - progressPct > 10;
}

export function ccbCeiling(role) {
  if (role === "PM") return { cost: 50_000, days: 7, emergency: false };
  if (role === "PMO") return { cost: 250_000, days: 21, emergency: false };
  return { cost: Infinity, days: Infinity, emergency: true };
}

export function ccbEscalate(role, cost, days, emergency) {
  const c = ccbCeiling(role);
  return cost > c.cost || days > c.days || (emergency && !c.emergency);
}

export function quantumDays(tfZeroCount, sampleDays = 12) {
  return tfZeroCount * sampleDays;
}

const IMPACT = ["Scope", "Schedule", "Cost", "Quality", "Risk", "Resource", "HSE", "Contract", "Interface", "Commissioning", "Stakeholder", "Environment"];

export function impactReady(flags) {
  return IMPACT.every((d) => flags[d]);
}
