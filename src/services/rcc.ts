/** RCC helpers — read-only vs PEX/PMA. Excel is a vessel. */

export const PLAN_THRESHOLDS = { low: 8, med: 12, high: 16 };

export const RBS = [
  { code: "EXT", fa: "خارجی", en: "External" },
  { code: "ORG", fa: "سازمانی", en: "Organizational" },
  { code: "PM", fa: "مدیریت پروژه", en: "PM" },
  { code: "TEC", fa: "فنی", en: "Technical" },
  { code: "PRC", fa: "تدارکات", en: "Procurement" },
  { code: "CON", fa: "ساخت", en: "Construction" },
  { code: "COM", fa: "راه‌اندازی", en: "Commissioning" },
] as const;

export function scoreLevel(score: number) {
  if (score >= PLAN_THRESHOLDS.high) return "high" as const;
  if (score >= PLAN_THRESHOLDS.med) return "med" as const;
  return "low" as const;
}

export function scoreColor(score: number) {
  const l = scoreLevel(score);
  return l === "high" ? "#EF4444" : l === "med" ? "#F59E0B" : "#10B981";
}

export type Notice = {
  id: string;
  claimId: string;
  title: string;
  clause: string;
  dueAt: string; // ISO date
  deliveredAt?: string;
  timeBarred?: boolean;
  bodyFa?: string;
};

export function daysLeft(dueIso: string, now = new Date()) {
  const due = new Date(dueIso + "T12:00:00Z");
  return Math.floor((due.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
}

export type GuardEvent = {
  noticeId: string;
  daysLeft: number;
  action: "ok" | "warn" | "auto_escalate" | "mark_time_barred";
  ews: string;
  severity: string;
};

export function guardianTick(notices: Notice[], now = new Date()): GuardEvent[] {
  const out: GuardEvent[] = [];
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

export function seedNotices(): Notice[] {
  const t = Date.now();
  const iso = (offset: number) => {
    const d = new Date(t + offset * 86400000);
    return d.toISOString().slice(0, 10);
  };
  return [
    { id: "n1", claimId: "CLM-01", title: "EOT Long Lead", clause: "FIDIC 20.1 / Art.29", dueAt: iso(12), bodyFa: "پیش‌نویس اولیه" },
    { id: "n2", claimId: "CLM-02", title: "Access delay", clause: "Art.30", dueAt: iso(2) },
    { id: "n3", claimId: "CLM-03", title: "Weather window", clause: "Particular", dueAt: iso(-1) },
  ];
}

export function depletionAlert(progressPct: number, opening: number, balance: number) {
  if (opening <= 0) return false;
  const usedPct = (1 - balance / opening) * 100;
  return usedPct - progressPct > 10;
}

export const IMPACT_DIMS = [
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
  "Environment",
] as const;

export function impactReady(flags: Record<string, boolean>) {
  return IMPACT_DIMS.every((d) => flags[d]);
}

export const DELAY_METHODS = [
  { code: "tia", fa: "TIA", en: "Time Impact Analysis" },
  { code: "win", fa: "Windows", en: "Windows" },
  { code: "apab", fa: "برنامه در برابر ساخت", en: "As-Planned vs As-Built" },
  { code: "ia", fa: "تأثیرشده در برابر ساخت", en: "Impacted As-Planned" },
  { code: "cab", fa: "فروپاشی ساخت", en: "Collapsed As-Built" },
  { code: "tbu", fa: "از پایین", en: "Time in the Bottom-Up" },
  { code: "net", fa: "شبکه", en: "Net effect" },
  { code: "5090", fa: "نشریه ۵۰۹۰", en: "Pub. 5090" },
] as const;

export function quantumDays(tfZeroCount: number, sampleDays = 12) {
  return tfZeroCount * sampleDays;
}

export type CcbRole = "PM" | "PMO" | "Sponsor" | "CCB";

export function ccbCeiling(role: CcbRole) {
  if (role === "PM") return { cost: 50_000, days: 7, emergency: false };
  if (role === "PMO") return { cost: 250_000, days: 21, emergency: false };
  return { cost: Infinity, days: Infinity, emergency: true };
}

export function ccbEscalate(role: CcbRole, cost: number, days: number, emergency: boolean) {
  const c = ccbCeiling(role);
  return cost > c.cost || days > c.days || (emergency && !c.emergency);
}

export function execPack(input: {
  risks: number;
  issues: number;
  crs: number;
  claims: number;
  noticesBarred: number;
  spi: number;
  phi: number;
}) {
  return {
    chain: ["Risk", "Issue", "CR", "Claim", "Evidence"] as const,
    counts: input,
    formulaNote: "SPI/PHI read-only",
  };
}

export function parseRiskCsv(text: string) {
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
      rbs: p[8] || "PM",
    });
  }
  return rows;
}
