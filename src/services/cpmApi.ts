/**
 * کلاینت REST میز کار ساخت و اجرا (P7 — CPMS، d2/d8).
 * مسیر نسبی `/api/cpm/...` از پراکسی Vite عبور می‌کند؛ هرگز localhost.
 */
import type { CpmWorkspacePayload } from "./cpmWorkspace";
import { jsonRequest, type ApiResult } from "./apiClient";

export type CpmResult<T> = ApiResult<T>;

const e = encodeURIComponent;

export class CpmClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(method: string, path: string, body?: unknown): Promise<CpmResult<T>> {
    return jsonRequest<T>(`/api/cpm/${e(this.projectId)}${path}`, this.userId, method, body);
  }

  workspace = () => this.req<CpmWorkspacePayload>("GET", "/workspace");
  releases = () => this.req<{ projectId: string; items: any[] }>("GET", "/releases");

  /* CPM-1 — حوزهٔ کاری پیمانکار */
  createWorkArea = (body: unknown) => this.req("POST", "/work-areas", body);
  updateWorkArea = (code: string, patch: unknown) => this.req("PATCH", `/work-areas/${e(code)}`, patch);
  deleteWorkArea = (code: string) => this.req("DELETE", `/work-areas/${e(code)}`);

  /* CPM-2 — گزارش روزانه و پیوست */
  createDpr = (body: unknown) => this.req("POST", "/dpr", body);
  updateDpr = (no: string, patch: unknown) => this.req("PATCH", `/dpr/${e(no)}`, patch);
  dprTransition = (no: string, action: "submit" | "approve" | "return", note?: string) =>
    this.req("POST", `/dpr/${e(no)}/transition`, note ? { action, note } : { action });
  dprAttachments = (no: string) => this.req<{ reportNo: string; items: any[] }>("GET", `/dpr/${e(no)}/attachments`);
  deleteDprAttachment = (no: string, id: string) => this.req("DELETE", `/dpr/${e(no)}/attachments/${e(id)}`);

  /* CPM-3 — گزارش دیسیپلینی */
  createReport = (body: unknown) => this.req("POST", "/discipline-reports", body);
  updateReport = (no: string, patch: unknown) => this.req("PATCH", `/discipline-reports/${e(no)}`, patch);
  reportTransition = (no: string, action: "submit" | "approve" | "return", note?: string) =>
    this.req("POST", `/discipline-reports/${e(no)}/transition`, note ? { action, note } : { action });

  /* CPM-4 — درخواست بازرسی و آزادسازی QC */
  createInspection = (body: unknown) => this.req("POST", "/inspections", body);
  inspectionTransition = (no: string, action: "submit" | "release" | "reject" | "cancel", note?: string) =>
    this.req("POST", `/inspections/${e(no)}/transition`, note ? { action, note } : { action });

  /** بارگذاری فایل واقعی (multipart) — فیلد file، به‌همراه نوع پیوست. */
  async uploadDprAttachment(no: string, file: File, kind: string, note?: string): Promise<CpmResult<Record<string, unknown>>> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    if (note) fd.append("note", note);
    try {
      const res = await fetch(`/api/cpm/${e(this.projectId)}/dpr/${e(no)}/attachments`, {
        method: "POST",
        headers: { accept: "application/json", ...(this.userId ? { "x-user-id": this.userId } : {}) },
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (json?.ok) return { ok: true, data: json.data };
      const { code, message, ...details } = json?.error ?? {};
      return { ok: false, status: res.status, code: code ?? "E-API-UNKNOWN", message: message ?? "بارگذاری ناموفق بود", details };
    } catch {
      return { ok: false, status: 0, code: "E-API-NETWORK", message: "اتصال به سرور برقرار نشد" };
    }
  }

  /** دانلود با هدر هویت (لینک ساده هدر x-user-id ندارد) و ذخیره به‌صورت Blob. */
  async downloadDprAttachment(no: string, id: string, fileName: string): Promise<CpmResult<{ saved: true }>> {
    try {
      const res = await fetch(`/api/cpm/${e(this.projectId)}/dpr/${e(no)}/attachments/${e(id)}/download`, {
        headers: this.userId ? { "x-user-id": this.userId } : {},
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        return { ok: false, status: res.status, code: json?.error?.code ?? "E-API-DOWNLOAD", message: json?.error?.message ?? "دانلود ناموفق بود" };
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "attachment";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { ok: true, data: { saved: true } };
    } catch {
      return { ok: false, status: 0, code: "E-API-NETWORK", message: "اتصال به سرور برقرار نشد" };
    }
  }
}
