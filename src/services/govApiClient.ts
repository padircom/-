/**
 * GOV API client — مسیر نسبی `/api/gov/*` (nginx به سرویس Node پراکسی می‌کند).
 * در حالت توسعه که بک‌اند بالا نیست، همه توابع `null` برمی‌گردانند و UI روی داده نمونه می‌ماند.
 */

const BASE = "/api/gov";
const TIMEOUT_MS = 2500;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null; // dev server → index.html
    const body = (await res.json()) as { ok?: boolean; data?: T };
    return body?.ok ? (body.data as T) : null;
  } catch {
    return null;
  }
}

async function postJson<T>(path: string, payload?: unknown): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    clearTimeout(timer);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null;
    const body = (await res.json()) as { ok?: boolean; data?: T };
    return body?.ok ? (body.data as T) : null;
  } catch {
    return null;
  }
}

export type ApiWorkflowTask = {
  id: string;
  code: string;
  processFa: string;
  assignee: string;
  dueAt: string;
  closedAt?: string;
  daysLeft: number | null;
  slaLevel: "ok" | "due_soon" | "breach";
  escalation: "L0" | "L1" | "L2" | "L3";
  action: "none" | "notify" | "escalate";
};

export type ApiConnector = {
  id: string;
  system: string;
  owningDomain: string;
  direction: string;
  lastSync: string;
  slaHours: number;
  records: number;
  health: "ok" | "warn" | "fail";
};

export type ApiFindings = {
  score: number;
  band: "Green" | "Yellow" | "Red";
  closeBlocked: boolean;
  items: {
    id: string;
    code: string;
    itemFa: string;
    standard: string;
    weight: number;
    compliance: number;
    severity: "minor" | "major" | "critical";
    capaId: string | null;
  }[];
};

export type ApiTrail = { valid: boolean; entries: { seq: number; payload: string; hash: string }[] };

export const govApi = {
  workflowTasks: () => getJson<ApiWorkflowTask[]>("/workflow-tasks"),
  approveTask: (taskId: string, actor: string) => postJson<{ entry: { seq: number; payload: string; hash: string } }>(`/workflow-tasks/${taskId}/approve`, { actor }),
  connectors: () => getJson<ApiConnector[]>("/connectors"),
  findings: () => getJson<ApiFindings>("/audit/findings"),
  trail: () => getJson<ApiTrail>("/audit-trail"),
};
