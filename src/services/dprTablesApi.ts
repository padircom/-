/** کلاینت جداول پشتیبان گزارش روزانه — مسیر نسبی `/api/dpr/*`.
 *
 * مثل govApiClient مستقیم به همان هاست می‌زند تا هم در پیش‌نمایش (پروکسی
 * Vite) و هم پشت nginx کار کند؛ آدرس مطلق localhost در کد کلاینت ممنوع.
 */
import type { DprHistory, DprReportStatus, DprTablesReport } from "./dprTables";

const BASE = "/api/dpr";

type Envelope<T> = { ok: boolean; data: T; error?: { code?: string; message?: string } };

export class DprTablesError extends Error {
  code: string;
  http: number;
  constructor(code: string, message: string, http: number) {
    super(message);
    this.code = code;
    this.http = http;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || body.ok === false) {
    throw new DprTablesError(body?.error?.code || "DPRT_ERROR", body?.error?.message || `خطای ${res.status}`, res.status);
  }
  return body.data as T;
}

export interface DprReportSummary {
  date: string;
  reportNo: string;
  status: DprReportStatus;
  updatedAt?: string;
}

export interface DprReportPayload {
  exists: boolean;
  report: DprTablesReport;
  history: DprHistory;
  suggestedNo: string;
}

export function dprHealth(): Promise<{ mounted: boolean; version: string; projects: number; reports: number }> {
  return call("/tables/health");
}

export function listDprReports(projectCode: string): Promise<DprReportSummary[]> {
  return call(`/projects/${encodeURIComponent(projectCode)}/reports`);
}

export function getDprReport(projectCode: string, date: string): Promise<DprReportPayload> {
  return call(`/projects/${encodeURIComponent(projectCode)}/reports/${encodeURIComponent(date)}`);
}

export function saveDprReport(projectCode: string, date: string, report: DprTablesReport): Promise<DprReportPayload> {
  return call(`/projects/${encodeURIComponent(projectCode)}/reports/${encodeURIComponent(date)}`, {
    method: "PUT",
    body: JSON.stringify(report),
  });
}

export function dprReportAction(
  projectCode: string,
  date: string,
  action: "submit" | "approve" | "return",
  actorRole?: string,
): Promise<{ status: DprReportStatus }> {
  return call(`/projects/${encodeURIComponent(projectCode)}/reports/${encodeURIComponent(date)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action, actorRole }),
  });
}
