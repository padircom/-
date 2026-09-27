/**
 * کلاینت REST میز کار هزینه و تأمین d5 (LIVE-1).
 * مسیر نسبی `/api/fin/...` از پراکسی Vite عبور می‌کند؛ هرگز localhost.
 * درخواست و تبدیل خطا در `apiClient.ts` (مشترک با d11).
 */
import type { FinWorkspaceData } from "./finWorkspace";
import { jsonRequest, type ApiResult } from "./apiClient";

export type FinWorkspacePayload = FinWorkspaceData & { settingsSaved: boolean };

export type FinResult<T> = ApiResult<T>;

export class FinClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(method: string, path: string, body?: unknown): Promise<FinResult<T>> {
    return jsonRequest<T>(`/api/fin/${encodeURIComponent(this.projectId)}${path}`, this.userId, method, body);
  }

  workspace = () => this.req<FinWorkspacePayload>("GET", "/workspace");
  seed = () => this.req<{ seeded: boolean }>("POST", "/seed", {});
  saveSettings = (s: unknown) => this.req("PUT", "/settings", s);
  createAccount = (a: unknown) => this.req("POST", "/accounts", a);
  deleteAccount = (code: string) => this.req("DELETE", `/accounts/${encodeURIComponent(code)}`);
  setProgress = (code: string, ProgressPct: number | null) => this.req("PUT", `/accounts/${encodeURIComponent(code)}/progress`, { ProgressPct });
  postCost = (t: unknown) => this.req("POST", "/transactions", t);
  reverseCost = (code: string) => this.req("DELETE", `/transactions/${encodeURIComponent(code)}`);
  createPr = (p: unknown) => this.req("POST", "/prs", p);
  prAction = (code: string, action: "submit" | "approve" | "reject" | "cancel", body: unknown = {}) =>
    this.req("POST", `/prs/${encodeURIComponent(code)}/${action}`, body);
  createPo = (p: unknown) => this.req("POST", "/pos", p);
  updatePo = (poNo: string, patch: unknown) => this.req("PATCH", `/pos/${encodeURIComponent(poNo)}`, patch);
  cancelPo = (poNo: string) => this.req("POST", `/pos/${encodeURIComponent(poNo)}/cancel`, {});
  createStock = (s: unknown) => this.req("POST", "/stock", s);
  updateStock = (code: string, patch: unknown) => this.req("PATCH", `/stock/${encodeURIComponent(code)}`, patch);
  deleteStock = (code: string) => this.req("DELETE", `/stock/${encodeURIComponent(code)}`);
  createReceivable = (a: unknown) => this.req("POST", "/receivables", a);
  collectReceivable = (code: string) => this.req("POST", `/receivables/${encodeURIComponent(code)}/collect`, {});
  deleteReceivable = (code: string) => this.req("DELETE", `/receivables/${encodeURIComponent(code)}`);
  reserveDraw = (body: { amount: number; toCode: string; reasonFa: string }) => this.req("POST", "/reserve-draw", body);
  snapshot = () => this.req("POST", "/snapshots", {});
}
