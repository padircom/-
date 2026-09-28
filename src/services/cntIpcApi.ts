/**
 * کلاینت REST قالب‌پذیری صورت‌وضعیت (P8 — CNT-1، d14).
 * محاسبهٔ سند همیشه سمت سرور است؛ این کلاینت فقط ورودی می‌فرستد و نتیجه
 * (`computation`) را برای نمایش/مقایسه می‌گیرد.
 */
import { jsonRequest, type ApiResult } from "./apiClient";
import type { CntCertificateRow, CntTemplateRow, CntWorkspacePayload, IpcComputation, IpcRowInput } from "./cntIpc";

const e = encodeURIComponent;

export type IpcPreview = { template: CntTemplateRow; computation: IpcComputation; asOf: string };

export class CntIpcClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    return jsonRequest<T>(`/api/cnt-ipc/${e(this.projectId)}${path}`, this.userId, method, body);
  }

  workspace = () => this.req<CntWorkspacePayload>("GET", "/workspace");

  createTemplate = (body: unknown) => this.req<CntTemplateRow>("POST", "/templates", body);
  updateTemplate = (code: string, patch: unknown) => this.req<CntTemplateRow>("PATCH", `/templates/${e(code)}`, patch);
  templateTransition = (code: string, action: "publish" | "retire") =>
    this.req<CntTemplateRow>("POST", `/templates/${e(code)}/transition`, { action });

  /** پیش‌نمایش محاسبه بدون ذخیره؛ خروجی همان چیزی است که سند ذخیره می‌کند. */
  preview = (templateCode: string, inputs: IpcRowInput[]) =>
    this.req<IpcPreview>("POST", "/preview", { TemplateCode: templateCode, Inputs: inputs });

  createCertificate = (body: unknown) => this.req<CntCertificateRow>("POST", "/certificates", body);
  certificateTransition = (id: string, action: "submit" | "approve" | "return", note?: string) =>
    this.req<CntCertificateRow>("POST", `/certificates/${e(id)}/transition`, note ? { action, note } : { action });
}
