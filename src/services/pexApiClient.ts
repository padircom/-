/**
 * PEX API client — مسیر نسبی `/api/pex/*`.
 * اگر بک‌اند در دسترس نباشد توابع `null` برمی‌گردانند و UI روی محاسبه محلی می‌ماند.
 */

const BASE = "/api/pex";
const TIMEOUT_MS = 2500;

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
    clearTimeout(timer);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null; // dev server → index.html
    const body = (await res.json()) as { ok?: boolean; data?: T };
    return body?.ok ? (body.data as T) : null;
  } catch {
    return null;
  }
}

export type ApiScheduleActivity = {
  id: string;
  wbs: string;
  nameFa: string;
  duration: number;
  es: string;
  ef: string;
  ls: string;
  lf: string;
  totalFloat: number;
  freeFloat: number;
  critical: boolean;
  baselineStart: string;
  baselineFinish: string;
  physicalPct: number;
  plannedPct: number;
  weight: number;
  blockedSteps: string[];
};

export type ApiSchedule = {
  project: { code: string; nameFa: string; baselineId: string; currency: string };
  dataDate: string;
  formulaVersion: string;
  projectStart: string;
  projectFinish: string;
  baseline: { start: string; finish: string; lengthDays: number };
  activities: ApiScheduleActivity[];
};

export type ApiCriticalPath = {
  criticalPath: string[];
  lengthDays: number;
  snapshot: { dataDate: string; length: number; baselineLength: number; drift: number; endDate: string; baselineEndDate: string; healthScore: number };
  nearCritical: { id: string; nameFa: string; totalFloat: number }[];
  dcma: { checks: { id: number; nameFa: string; value: number; pass: boolean }[]; healthScore: number };
};

export type ApiMilestones = {
  dataDate: string;
  totalPenalty: number;
  items: {
    id: string;
    nameFa: string;
    type: string;
    status: string;
    contractualDate: string;
    forecastDate: string;
    slipDays: number;
    penalty: number;
    bonus: number;
    escalation: number;
  }[];
};

export type ApiProgress = {
  weightMode: string;
  overallPct: number;
  plannedPct: number;
  variance: { deltaPct: number; status: "ahead" | "on_track" | "behind" };
  ppcPct: number;
  wbs: { id: string; nameFa: string; weight: number; actualPct: number; plannedPct: number }[];
  openPeriod: { code: string; from: string; to: string; closedAt?: string };
  blockedCount: number;
};

export type ApiPexAlerts = {
  items: { code: string; type: string; severity: "warning" | "critical" | "emergency"; message: string; refId?: string }[];
  counts: Record<string, number>;
};

export const getSchedule = (mode?: string, alpha?: number) =>
  request<ApiSchedule>(`/schedule${qs(mode, alpha)}`);
export const getCriticalPath = () => request<ApiCriticalPath>("/critical-path");
export const getMilestones = () => request<ApiMilestones>("/milestones");
export const getProgress = (mode?: string, alpha?: number) => request<ApiProgress>(`/progress${qs(mode, alpha)}`);
export const getAlerts = () => request<ApiPexAlerts>("/alerts");

export const postProgress = (payload: { activityId: string; date?: string; steps: { code: string; percent: number; irApproved?: boolean }[] }) =>
  request<{ activityId: string; physicalPct: number; blockedSteps: string[]; acceptedIntoEv: boolean; period: string }>("/progress", {
    method: "POST",
    body: JSON.stringify(payload),
  });

function qs(mode?: string, alpha?: number) {
  const p = new URLSearchParams();
  if (mode) p.set("mode", mode);
  if (alpha != null) p.set("alpha", String(alpha));
  const s = p.toString();
  return s ? `?${s}` : "";
}
