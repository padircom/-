/**
 * HSE API client — ثبت و گیت روی SQL Server (D3).
 * خوانش‌ها با fallback به seed داخل HseWorkspace ترکیب می‌شوند؛
 * خطاهای ثبت (create/action) به فراخواننده برمی‌گردد.
 */
import { loadSqlConfig } from "./sqlServer";
import type { HseIncidentStatus, HseIncidentType, PtwStatus, PtwType } from "./hse";

export interface HseIncidentDto {
  id: string;
  projectCode: string;
  code: string;
  dateISO: string;
  type: HseIncidentType;
  severityW: number;
  lostDays: number;
  area: string;
  descFa: string;
  status: HseIncidentStatus;
  volumeL: number | null;
}

export interface HsePermitDto {
  id: string;
  projectCode: string;
  no: string;
  type: PtwType;
  status: PtwStatus;
  workDate: string;
  area: string;
  riskLevel: "low" | "medium" | "high";
  flagsJson: string | null;
  warnings?: string[];
}

export interface HseInspectionItem {
  item: string;
  ok: boolean;
  na?: boolean;
}

export interface HseInspectionDto {
  id: string;
  projectCode: string;
  area: string;
  dateISO: string;
  items: HseInspectionItem[];
  score: number;
  band: string;
  nextDue: string | null;
}

export interface WoGateDto {
  ok: boolean;
  verdict: "allow" | "warn" | "block";
  reason: string;
  permitNo?: string;
  pending?: string[];
}

export interface HseIncidentInput {
  code?: string;
  dateISO: string;
  type: string;
  lostDays?: number;
  area: string;
  descFa: string;
  status?: string;
  volumeL?: number;
}

export interface HsePermitInput {
  no?: string;
  type: string;
  workDate: string;
  area: string;
  riskLevel: string;
  flags?: Record<string, boolean>;
}

export interface HseInspectionInput {
  area: string;
  dateISO: string;
  items: { item: string; ok: boolean; na?: boolean }[];
}

type Envelope<T> = { ok: boolean; data: T; error?: { code?: string; message?: string } };

async function hseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = loadSqlConfig();
  const url = `${cfg.apiBaseUrl.replace(/\/$/, "")}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => ({}))) as Envelope<T>;
    if (!res.ok || body.ok === false) {
      throw new Error(body?.error?.message || `HSE API error ${res.status}`);
    }
    return body.data as T;
  } finally {
    clearTimeout(timer);
  }
}

export function listIncidents(projectCode: string): Promise<HseIncidentDto[]> {
  return hseFetch<HseIncidentDto[]>(`/hse/projects/${encodeURIComponent(projectCode)}/incidents`);
}

export function createIncident(projectCode: string, input: HseIncidentInput): Promise<HseIncidentDto> {
  return hseFetch<HseIncidentDto>(`/hse/projects/${encodeURIComponent(projectCode)}/incidents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listPermits(projectCode: string): Promise<HsePermitDto[]> {
  return hseFetch<HsePermitDto[]>(`/hse/projects/${encodeURIComponent(projectCode)}/permits`);
}

export function createPermit(projectCode: string, input: HsePermitInput): Promise<HsePermitDto> {
  return hseFetch<HsePermitDto>(`/hse/projects/${encodeURIComponent(projectCode)}/permits`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function permitAction(id: string, action: string, role: string): Promise<HsePermitDto> {
  return hseFetch<HsePermitDto>(`/hse/permits/${encodeURIComponent(id)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action, role }),
  });
}

export function listInspections(projectCode: string): Promise<HseInspectionDto[]> {
  return hseFetch<HseInspectionDto[]>(`/hse/projects/${encodeURIComponent(projectCode)}/inspections`);
}

export function createInspection(projectCode: string, input: HseInspectionInput): Promise<HseInspectionDto> {
  return hseFetch<HseInspectionDto>(`/hse/projects/${encodeURIComponent(projectCode)}/inspections`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function woGate(
  projectCode: string,
  q: { workType: string; area?: string; workDate: string }
): Promise<WoGateDto> {
  const p = new URLSearchParams({ workType: q.workType, workDate: q.workDate });
  if (q.area) p.set("area", q.area);
  return hseFetch<WoGateDto>(`/hse/projects/${encodeURIComponent(projectCode)}/wo-gate?${p.toString()}`);
}
