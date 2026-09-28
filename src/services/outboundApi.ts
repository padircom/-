/**
 * کلاینت یکپارچه‌سازی خروجی (P9 — ITG-1/2/3).
 *
 * فایل‌ها (XER/XML/ICS) از همین کلاینت با هدر هویت دانلود می‌شوند؛ وضعیت P6 و
 * Exchange از سرور خوانده می‌شود. هیچ‌جای این ماژول ادعای اتصال به سامانهٔ
 * بیرونی بدون شاهد نمی‌کند: نتیجهٔ probe/push همان چیزی است که سرور گزارش
 * می‌کند و در دفتر اجرا ثبت می‌شود.
 */
import { jsonRequest, type ApiResult } from "./apiClient";

const e = encodeURIComponent;

export type ItgConnector = {
  key: string;
  labelFa: string;
  permission: string;
  direction: string;
  allowed: boolean;
  configured: boolean | null;
  missing: string[];
};
export type ItgRun = {
  Id: string;
  ProjectId: string;
  Connector: string;
  Status: "queued" | "succeeded" | "failed";
  ItemCount: number | null;
  PayloadBytes: number | null;
  Endpoint: string | null;
  DurationMs: number | null;
  ErrorCode: string | null;
  ErrorFa: string | null;
  ActorId: string;
  StartedAt: string;
  FinishedAt: string | null;
};
export type ItgWorkspace = {
  projectId: string;
  connectors: ItgConnector[];
  p6: { configured: boolean; missing: string[]; baseUrl: string | null; database: string | null; authMode: string; timeoutMs: number };
  exchange: { mode: "graph" | "ews" | "none"; configured: boolean; missing: string[]; mailbox: string | null };
  counts: { activities: number | null; wbs: number | null };
  runs: ItgRun[];
  metrics: { runs: number; failed: number; modelVersion: string; generatedAt: string };
  projectSource?: string;
};
export type ItgExportSummary = { counts: Record<string, number>; issues: { code: string; severity: string; message: string }[]; bytes: number; projectSource?: string; warning?: string | null; dataDate?: string; count?: number; milestones?: number };
export type MppInspection = { fileName: string; isMpp: boolean; container: "ole2" | "zip" | "unknown"; supported: boolean; guidanceFa: string; bytes: number; alternatives: string[] };
export type P6Status = {
  configured: boolean;
  missing: string[];
  baseUrl: string | null;
  database: string | null;
  user: string | null;
  authMode: string;
  timeoutMs: number;
  probePath: string | null;
  pushPath: string | null;
  maxPerPush: number;
  activityCount: number | null;
};

export class OutboundClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    return jsonRequest<T>(`/api/itg/${e(this.projectId)}${path}`, this.userId, method, body);
  }

  workspace = () => this.req<ItgWorkspace>("GET", "/workspace");
  runs = () => this.req<{ runs: ItgRun[]; metrics: { total: number; succeeded: number; failed: number } }>("GET", "/runs");
  p6 = () => this.req<P6Status>("GET", "/p6");
  p6Probe = () => this.req<{ reachable: boolean; httpStatus: number; database: string }>("POST", "/p6/probe", {});
  p6Push = (activityIds?: string[]) => this.req<{ sent: number; httpStatus: number; runId: string | null }>("POST", "/p6/push", activityIds ? { activityIds } : {});
  mppInspect = (fileName: string, base64: string) => this.req<MppInspection>("POST", "/mpp/inspect", { fileName, base64 });
  exchangeDryRun = (horizonDays?: number) =>
    this.req<{ dryRun: true; mode: string; mailbox: string | null; endpoint: string; count: number; bytes: number; preview: string }>("POST", "/exchange/send", { dryRun: true, ...(horizonDays ? { horizonDays } : {}) });
  exchangeSend = (horizonDays?: number) =>
    this.req<{ sent: boolean; mode: string; mailbox: string | null; count: number; runId: string | null }>("POST", "/exchange/send", horizonDays ? { horizonDays } : {});
  xerSummary = () => this.req<ItgExportSummary>("GET", "/xer?format=json");
  mspSummary = () => this.req<ItgExportSummary>("GET", "/msp.xml?format=json");
  icsSummary = (horizonDays = 120) => this.req<ItgExportSummary & { events: unknown[] }>("GET", `/calendar.ics?format=json&horizonDays=${horizonDays}`);

  /** دانلود فایل خروجی از مسیر پروژه‌ای با هدر هویت. */
  async download(kind: "xer" | "msp.xml" | "calendar.ics", fileName?: string): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
    try {
      const res = await fetch(`/api/itg/${e(this.projectId)}/${kind}`, { headers: this.userId ? { "x-user-id": this.userId } : {} });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        return { ok: false, message: json?.error?.message ?? `دریافت خروجی ناموفق بود (${res.status})` };
      }
      const blob = await res.blob();
      const name = fileName ?? `export.${kind === "msp.xml" ? "xml" : kind.split(".").pop()}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      return { ok: true, name };
    } catch {
      return { ok: false, message: "اتصال به سرور برقرار نشد" };
    }
  }
}
