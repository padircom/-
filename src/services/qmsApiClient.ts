/**
 * QMS API client — مسیر نسبی `/api/qms/*` (nginx به سرویس Node پراکسی می‌کند).
 * اگر بک‌اند در دسترس نباشد همه توابع `null` برمی‌گردانند و UI روی داده نمونه می‌ماند.
 */

const BASE = "/api/qms";
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

export type ApiItpPoint = {
  id: string;
  activityId: string;
  type: "H" | "W" | "R" | "M";
  party: "contractor" | "consultant" | "client" | "tpi";
  titleFa: string;
  signedAt?: string;
  signedBy?: string;
  waivedBy?: string;
};

export type ApiInspection = {
  id: string;
  titleFa: string;
  requestedAt: string;
  inspectionAt: string;
  noticeHours: number;
  defects: { severity: "critical" | "major" | "minor" }[];
  notice: { ok: boolean; leadHours: number };
  outcome: "accepted" | "conditional" | "rejected";
  signature: { signer: string; at: string; hash: string } | null;
};

export type ApiNcr = {
  id: string;
  titleFa: string;
  severity: "critical" | "major" | "minor";
  openedAt: string;
  closedAt?: string;
  cause: string;
  disposition: "rework" | "repair" | "use_as_is" | "reject" | "scrap";
  concessionBy?: string;
  recurrence: number;
  capaId?: string;
  overdue: boolean;
  capaRequired: boolean;
  dispositionCheck: { ok: boolean; reason?: string };
};

export type ApiCertificate = {
  itemFa: string;
  heatNo: string;
  certType: "2.1" | "2.2" | "3.1" | "3.2";
  declaredGrade: string;
  requiredGrade: string;
  verdict: { ok: boolean; reasons: string[] };
};

export type ApiHandover = {
  punch: { id: string; category: "A" | "B"; systemId: string; titleFa: string; closed?: boolean }[];
  summary: { openA: number; openB: number; closureRate: number };
  dossier: { pct: number; missing: string[] };
  gate: { ok: boolean; blockers: string[] };
};

export const qmsApi = {
  itp: () => request<{ points: ApiItpPoint[]; blocking: string[]; canProceed: boolean; coveragePct: number }>("/itp"),
  signItpPoint: (pointId: string, actor: string) =>
    request<{ point: ApiItpPoint; canProceed: boolean }>(`/itp/${encodeURIComponent(pointId)}/sign`, { method: "POST", body: JSON.stringify({ actor }) }),

  inspections: () => request<{ items: ApiInspection[]; firstPassYieldPct: number }>("/inspections"),
  signInspection: (irId: string, actor: string) =>
    request<{ irId: string; outcome: string; signature: { signer: string; at: string; hash: string } }>(
      `/inspections/${encodeURIComponent(irId)}/sign`,
      { method: "POST", body: JSON.stringify({ actor }) }
    ),

  ncr: () => request<{ items: ApiNcr[]; closureRatePct: number; pareto: { cause: string; count: number; cumPct: number; vital: boolean }[] }>("/ncr"),
  certificates: () => request<{ items: ApiCertificate[]; rejected: number }>("/certificates"),
  audit: () => request<{ findings: { clause: string; titleFa: string; severity: "major" | "minor" | "observation"; closed?: boolean }[]; score: number; certificationRisk: string }>("/audit"),
  handover: () => request<ApiHandover>("/handover"),
  issueMc: (systemId: string) => request<{ certificate: string; state: string }>("/handover/mc", { method: "POST", body: JSON.stringify({ systemId }) }),
  dashboard: () =>
    request<{
      itpCoveragePct: number;
      firstPassYieldPct: number;
      ncrClosureRatePct: number;
      copqPct: number;
      complianceScore: number;
      dossierPct: number;
      alerts: { code: string; severity: "warning" | "high" | "critical"; message: string }[];
    }>("/dashboard"),
};
