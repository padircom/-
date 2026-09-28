/**
 * کلاینت REST دفتر مدیریت پروژه (P8 — PMO-1/2/3، d6).
 * مسیر نسبی `/api/pmo/...` از پراکسی Vite عبور می‌کند؛ هرگز localhost.
 */
import { jsonRequest, type ApiResult } from "./apiClient";
import type { PmoFormEntryRow, PmoFormRow, PmoHealthRow, PmoCharterRow, PmoWorkspacePayload } from "./pmoWorkspace";

const e = encodeURIComponent;

export class PmoClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    return jsonRequest<T>(`/api/pmo/${e(this.projectId)}${path}`, this.userId, method, body);
  }

  workspace = () => this.req<PmoWorkspacePayload>("GET", "/workspace");

  /* PMO-1 — منشور پروژه */
  createCharter = (body: unknown) => this.req<PmoCharterRow>("POST", "/charters", body);
  updateCharter = (charterNo: string, patch: unknown) => this.req<PmoCharterRow>("PATCH", `/charters/${e(charterNo)}`, patch);
  charterTransition = (charterNo: string, action: "submit" | "approve" | "return", note?: string) =>
    this.req<PmoCharterRow>("POST", `/charters/${e(charterNo)}/transition`, note ? { action, note } : { action });

  /* PMO-2 — فرم‌ساز مصوب */
  createForm = (body: unknown) => this.req<PmoFormRow>("POST", "/forms", body);
  updateForm = (code: string, patch: unknown) => this.req<PmoFormRow>("PATCH", `/forms/${e(code)}`, patch);
  formTransition = (code: string, action: "publish" | "retire") =>
    this.req<PmoFormRow>("POST", `/forms/${e(code)}/transition`, { action });
  createEntry = (body: unknown) => this.req<PmoFormEntryRow>("POST", "/entries", body);
  updateEntry = (id: string, patch: unknown) => this.req<PmoFormEntryRow>("PATCH", `/entries/${e(id)}`, patch);
  entryTransition = (id: string, action: "submit" | "approve" | "return", note?: string) =>
    this.req<PmoFormEntryRow>("POST", `/entries/${e(id)}/transition`, note ? { action, note } : { action });

  /* PMO-3 — کارت سلامت پروژه */
  createAssessment = (body: unknown) => this.req<PmoHealthRow>("POST", "/assessments", body);
  assessmentTransition = (id: string, action: "submit" | "approve" | "return", note?: string) =>
    this.req<PmoHealthRow>("POST", `/assessments/${e(id)}/transition`, note ? { action, note } : { action });
}
