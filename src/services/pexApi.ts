/**
 * PEX API client — خواندن از SQL Server با fallback به seed.
 * ------------------------------------------------------------------
 * قرارداد: همه متدها ابتدا REST را می‌زنند
 * (`${apiBaseUrl}/pex/...` طبق server/index.js). اگر سرور/جداول در
 * دسترس نباشند، `loadPexSnapshot` به seed داخل `src/data/pexProject.ts`
 * برمی‌گردد تا UI (حالت d2) هرگز خالی نماند. خطاهای DPR (G2) به
 * فراخواننده برمی‌گردد چون ثبت واقعی باید به SQL برود.
 */
import { loadSqlConfig } from "./sqlServer";
import {
  PEX_ACTIVITIES,
  PEX_MILESTONES,
  PEX_PROJECT,
  PEX_ROC,
  PEX_WBS,
  type PexActivity,
  type PexMilestone,
  type PexProject,
  type PexRoc,
  type PexWbsNode,
} from "../data/pexSnapshot";

export type PexSource = "sql" | "seed";

export interface PexSnapshot {
  source: PexSource;
  project: PexProject;
  wbs: PexWbsNode[];
  activities: PexActivity[];
  milestones: PexMilestone[];
  roc: PexRoc[];
}

export type DprStatus = "draft" | "submitted" | "approved" | "rejected" | "revision_required";
export type DprAction = "submit" | "approve" | "reject" | "revise";

export interface PexDpr {
  id: string;
  projectCode: string;
  reportNo: string;
  reportDate: string;
  shift: string;
  weather?: string | null;
  status: DprStatus;
  lineCount?: number;
  createdAt?: string;
}

export interface PexProgressLine {
  id: string;
  dprId: string;
  activityCode: string;
  activityNameFa?: string;
  locationCode?: string | null;
  stepSeq: number;
  stepNameFa?: string;
  qty: number;
  uom?: string | null;
  lineStatus: "draft" | "approved" | "void";
  approvedQty?: number | null;
  note?: string | null;
}

export interface PexDprEvent {
  id: string;
  actionCode: DprAction | string;
  fromStatus: string;
  toStatus: string;
  actorRole: string;
  comment?: string | null;
  createdAt: string;
}

export interface PexDprDetail extends PexDpr {
  lines: PexProgressLine[];
  events: PexDprEvent[];
}

export interface DprLineInput {
  activityCode: string;
  locationCode?: string;
  stepSeq: number;
  qty: number;
  uom?: string;
  crId?: string;
  note?: string;
}

export interface DprCreateInput {
  reportDate: string;
  shift: string;
  weather?: string;
  reportNo?: string;
  lines: DprLineInput[];
}

export interface DprConflict {
  activityCode: string;
  reportDate: string;
  stepSeq: number;
  lines: { dprId: string; reportNo: string; qty: number }[];
}

type Envelope<T> = { ok: boolean; data: T; error?: { code?: string; message?: string } };

async function pexFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
      throw new Error(body?.error?.message || `PEX API error ${res.status}`);
    }
    return body.data as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ── G1: خوانش دسته‌ای با fallback ─────────────────────────────── */

export function seedSnapshot(): PexSnapshot {
  return {
    source: "seed",
    project: PEX_PROJECT,
    wbs: PEX_WBS,
    activities: PEX_ACTIVITIES,
    milestones: PEX_MILESTONES,
    roc: PEX_ROC,
  };
}

export async function loadPexSnapshot(projectCode: string): Promise<PexSnapshot> {
  try {
    const [wbs, activities, milestones, roc] = await Promise.all([
      pexFetch<PexWbsNode[]>(`/pex/projects/${encodeURIComponent(projectCode)}/wbs`),
      pexFetch<PexActivity[]>(`/pex/projects/${encodeURIComponent(projectCode)}/activities`),
      pexFetch<PexMilestone[]>(`/pex/projects/${encodeURIComponent(projectCode)}/milestones`),
      pexFetch<PexRoc[]>(`/pex/projects/${encodeURIComponent(projectCode)}/roc`),
    ]);
    if (!activities.length) throw new Error("empty");
    return { source: "sql", project: PEX_PROJECT, wbs, activities, milestones, roc };
  } catch {
    return seedSnapshot();
  }
}

/* ── G2: DPR واقعی (بدون fallback — باید به SQL برود) ───────────── */

export function listDpr(projectCode: string, status?: string): Promise<PexDpr[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return pexFetch<PexDpr[]>(`/pex/projects/${encodeURIComponent(projectCode)}/dpr${q}`);
}

export function getDpr(id: string): Promise<PexDprDetail> {
  return pexFetch<PexDprDetail>(`/pex/dpr/${encodeURIComponent(id)}`);
}

export function createDpr(projectCode: string, input: DprCreateInput): Promise<PexDpr> {
  return pexFetch<PexDpr>(`/pex/projects/${encodeURIComponent(projectCode)}/dpr`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function dprAction(id: string, actionCode: DprAction, actorRole: string, comment?: string): Promise<PexDprDetail> {
  return pexFetch<PexDprDetail>(`/pex/dpr/${encodeURIComponent(id)}/actions`, {
    method: "POST",
    body: JSON.stringify({ actionCode, actorRole, comment }),
  });
}

export function dprConflicts(projectCode: string): Promise<DprConflict[]> {
  return pexFetch<DprConflict[]>(`/pex/projects/${encodeURIComponent(projectCode)}/dpr/conflicts`);
}
