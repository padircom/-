/**
 * GOV — Governance engine (d6).
 * قواعد: ارجاع بدون بازنویسی · Baseline مقدس · هر تصمیم = شاهد + اختیار · ثبت فقط append.
 * این ماژول هیچ عددی از d2/d3/d5 را بازنویسی نمی‌کند؛ فقط ارزیابی و دروازه‌گذاری می‌کند.
 */

/* ---------------------------------------------------------------- زمان */

export function daysLeft(dueIso: string, now = new Date()): number {
  const due = new Date(dueIso + "T12:00:00Z");
  return Math.floor(
    (due.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000
  );
}

export function hoursSince(iso: string, now = new Date()): number {
  const t0 = new Date(iso.replace(" ", "T") + (iso.length <= 10 ? "T00:00:00Z" : "Z")).getTime();
  return Math.max(0, Math.floor((now.getTime() - t0) / 3600000));
}

/* -------------------------------------------------- SLA و تشدید گردش‌کار */

export type SlaLevel = "ok" | "due_soon" | "breach";
export type EscalationLevel = "L0" | "L1" | "L2" | "L3";

export const ESCALATION_ROLE: Record<EscalationLevel, { fa: string; en: string }> = {
  L0: { fa: "مسئول گام", en: "Step owner" },
  L1: { fa: "مدیر پروژه", en: "Project Manager" },
  L2: { fa: "PMO", en: "PMO" },
  L3: { fa: "کمیته راهبری", en: "Steering Committee" },
};

/** روزهای باقی‌مانده تا SLA → سطح وضعیت */
export function slaLevel(left: number): SlaLevel {
  if (left < 0) return "breach";
  if (left <= 1) return "due_soon";
  return "ok";
}

/** تشدید بر مبنای روزهای تأخیر: 0=L0, 1–3=L1, 4–7=L2, >7=L3 */
export function escalationLevel(daysOverdue: number): EscalationLevel {
  if (daysOverdue <= 0) return "L0";
  if (daysOverdue <= 3) return "L1";
  if (daysOverdue <= 7) return "L2";
  return "L3";
}

export type WfTask = {
  id: string;
  code: string;
  dueAt: string; // ISO date
  closedAt?: string;
};

export type WfEvent = {
  taskId: string;
  daysLeft: number;
  level: SlaLevel;
  escalation: EscalationLevel;
  action: "none" | "notify" | "escalate";
};

/** پایش SLA همه گام‌های باز — هیچ داده‌ای را تغییر نمی‌دهد. */
export function workflowTick(tasks: WfTask[], now = new Date()): WfEvent[] {
  const out: WfEvent[] = [];
  for (const task of tasks) {
    if (task.closedAt) continue;
    const left = daysLeft(task.dueAt, now);
    const level = slaLevel(left);
    const escalation = escalationLevel(left < 0 ? -left : 0);
    out.push({
      taskId: task.id,
      daysLeft: left,
      level,
      escalation,
      action: level === "breach" ? "escalate" : level === "due_soon" ? "notify" : "none",
    });
  }
  return out;
}

/* ------------------------------------------------------ ممیزی و انطباق */

export type ComplianceBand = "Green" | "Yellow" | "Red";

export type Finding = {
  id: string;
  compliance: number; // 0..100
  weight?: number; // پیش‌فرض ۱
  severity?: "minor" | "major" | "critical";
  capaId?: string;
};

export function complianceBand(score: number): ComplianceBand {
  if (score >= 90) return "Green";
  if (score >= 75) return "Yellow";
  return "Red";
}

export function bandColor(band: ComplianceBand): string {
  return band === "Green" ? "#8FE3C8" : band === "Yellow" ? "#FFD48A" : "#FF9F9F";
}

/** امتیاز انطباق وزنی (۰..۱۰۰) */
export function complianceScore(findings: Finding[]): number {
  if (findings.length === 0) return 100;
  const wSum = findings.reduce((s, f) => s + (f.weight ?? 1), 0);
  const acc = findings.reduce((s, f) => s + f.compliance * (f.weight ?? 1), 0);
  return Math.round(acc / wSum);
}

/** یافته Major/Critical بدون CAPA → عدم انطباق باز (بلاک بستن ممیزی) */
export function capaRequired(f: Finding): boolean {
  const sev = f.severity ?? (f.compliance < 75 ? "major" : "minor");
  return (sev === "major" || sev === "critical") && !f.capaId;
}

export function auditCloseBlocked(findings: Finding[]): boolean {
  return findings.some(capaRequired);
}

/* --------------------------------------- ماتریس اختیار (DoA) و تصمیم */

export type Authority = "PM" | "PMO" | "STEERING" | "BOARD";

export const DOA: Record<Authority, { cost: number; days: number; fa: string; en: string }> = {
  PM: { cost: 50_000, days: 7, fa: "مدیر پروژه", en: "Project Manager" },
  PMO: { cost: 250_000, days: 21, fa: "PMO", en: "PMO" },
  STEERING: { cost: 1_000_000, days: 60, fa: "کمیته راهبری", en: "Steering Committee" },
  BOARD: { cost: Number.POSITIVE_INFINITY, days: Number.POSITIVE_INFINITY, fa: "هیئت‌مدیره", en: "Board" },
};

const DOA_ORDER: Authority[] = ["PM", "PMO", "STEERING", "BOARD"];

/** کمترین سطح اختیاری که هم سقف هزینه و هم سقف زمان را پوشش دهد. */
export function authorityFor(cost: number, days: number): Authority {
  for (const a of DOA_ORDER) {
    if (cost <= DOA[a].cost && days <= DOA[a].days) return a;
  }
  return "BOARD";
}

export function needsEscalation(current: Authority, cost: number, days: number): boolean {
  return DOA_ORDER.indexOf(authorityFor(cost, days)) > DOA_ORDER.indexOf(current);
}

export type DecisionInput = {
  id: string;
  authority?: Authority;
  evidenceRef?: string; // مثال: "PMA:EVM#2026-06" یا "RCC:CLM-007"
  cost?: number;
  days?: number;
  rewritesBaseline?: boolean;
  crId?: string;
};

export type GateResult = { ok: boolean; reasons: string[] };

/** دروازه ثبت تصمیم — بدون شاهد/اختیار یا با بازنویسی Baseline بدون CR رد می‌شود. */
export function decisionGate(d: DecisionInput): GateResult {
  const reasons: string[] = [];
  if (!d.evidenceRef) reasons.push("evidence_missing");
  if (!d.authority) reasons.push("authority_missing");
  if (d.authority && needsEscalation(d.authority, d.cost ?? 0, d.days ?? 0)) reasons.push("authority_insufficient");
  if (d.rewritesBaseline && !d.crId) reasons.push("baseline_rewrite_without_cr");
  return { ok: reasons.length === 0, reasons };
}

/* ------------------------------------------------------- یکپارچگی داده */

export type ConnectorHealth = "ok" | "warn" | "fail";

/** سلامت اتصال بر مبنای فاصله از آخرین همگام‌سازی موفق. */
export function connectorHealth(lastSyncIso: string, slaHours = 24, now = new Date()): ConnectorHealth {
  const h = hoursSince(lastSyncIso, now);
  if (h <= slaHours) return "ok";
  if (h <= slaHours * 2) return "warn";
  return "fail";
}

/** مالکیت داده: هر عدد فقط توسط ماژول مالک نوشته می‌شود؛ d6 هرگز مالک نیست. */
export const DATA_OWNER: Record<string, string> = {
  progress: "d2",
  baseline: "d2",
  evm: "d3",
  kpi: "d3",
  variance: "d3",
  risk: "d4",
  claim: "d4",
  cost: "d5",
  document: "d1",
  /* HRM — مالک ساعت و بهره‌وری (شکاف H-02 سند HRM_D2). کد از HRM_DOMAIN_ID. */
  manhour: "d10",
  productivity: "d10",
  /* CKM — مالک گردش مکاتبات، مصوبات، ذی‌نفعان و درس‌آموخته.
     مالک فایل مدرک همچنان d1 است. */
  correspondence: "d11",
  meeting: "d11",
  stakeholder: "d11",
  lesson: "d11",
};

export function canGovWrite(field: string): boolean {
  return !(field in DATA_OWNER);
}

/* ------------------------------------------ زنجیره ثبت غیرقابل تغییر */

/** هش ساده و قطعی (FNV-1a 32bit) برای زنجیره ممیزی. */
export function hashLink(prev: string, payload: string): string {
  let h = 0x811c9dc5;
  const s = prev + "|" + payload;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export type TrailEntry = { seq: number; payload: string; hash: string };

export function appendTrail(trail: TrailEntry[], payload: string): TrailEntry[] {
  const prev = trail.length ? trail[trail.length - 1].hash : "00000000";
  return [...trail, { seq: trail.length + 1, payload, hash: hashLink(prev, payload) }];
}

export function verifyTrail(trail: TrailEntry[]): boolean {
  let prev = "00000000";
  for (const e of trail) {
    if (hashLink(prev, e.payload) !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}
