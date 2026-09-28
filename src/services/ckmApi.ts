/**
 * کلاینت REST میز کار ارتباطات و دانش d11 (LIVE-2).
 * مسیر نسبی `/api/ckm/...` از پراکسی Vite عبور می‌کند؛ هرگز localhost.
 */
import type { CkmWorkspaceData } from "./ckmWorkspace";
import { jsonRequest, type ApiResult } from "./apiClient";

export type CkmWorkspacePayload = CkmWorkspaceData & { today: string; lettersHidden: boolean };
export type CkmResult<T> = ApiResult<T>;

const e = encodeURIComponent;

export class CkmClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(method: string, path: string, body?: unknown): Promise<CkmResult<T>> {
    return jsonRequest<T>(`/api/ckm/${e(this.projectId)}${path}`, this.userId, method, body);
  }

  workspace = () => this.req<CkmWorkspacePayload>("GET", "/workspace");
  seed = () => this.req<{ seeded: boolean; today: string }>("POST", "/seed", {});

  createLetter = (l: unknown) => this.req("POST", "/letters", l);
  updateLetter = (no: string, patch: unknown) => this.req("PATCH", `/letters/${e(no)}`, patch);
  issueLetter = (no: string, body: unknown = {}) => this.req("POST", `/letters/${e(no)}/issue`, body);
  respondLetter = (no: string, body: unknown = {}) => this.req("POST", `/letters/${e(no)}/respond`, body);
  closeLetter = (no: string, body: unknown = {}) => this.req("POST", `/letters/${e(no)}/close`, body);
  deleteLetter = (no: string) => this.req("DELETE", `/letters/${e(no)}`);

  createMeeting = (m: unknown) => this.req("POST", "/meetings", m);
  updateMeeting = (code: string, patch: unknown) => this.req("PATCH", `/meetings/${e(code)}`, patch);
  approveMeeting = (code: string) => this.req("POST", `/meetings/${e(code)}/approve`, {});
  distributeMeeting = (code: string, recipients?: string[]) => this.req("POST", `/meetings/${e(code)}/distribute`, recipients ? { recipients } : {});
  deleteMeeting = (code: string) => this.req("DELETE", `/meetings/${e(code)}`);
  createAction = (meetingCode: string, a: unknown) => this.req("POST", `/meetings/${e(meetingCode)}/actions`, a);
  updateAction = (code: string, body: unknown) => this.req("PATCH", `/actions/${e(code)}`, body);

  createStakeholder = (s: unknown) => this.req("POST", "/stakeholders", s);
  updateStakeholder = (code: string, patch: unknown) => this.req("PATCH", `/stakeholders/${e(code)}`, patch);
  deleteStakeholder = (code: string) => this.req("DELETE", `/stakeholders/${e(code)}`);

  createLesson = (l: unknown) => this.req("POST", "/lessons", l);
  validateLesson = (code: string) => this.req("POST", `/lessons/${e(code)}/validate`, {});
  reuseLesson = (code: string, noteFa: string) => this.req("POST", `/lessons/${e(code)}/reuse`, { noteFa });
  deleteLesson = (code: string) => this.req("DELETE", `/lessons/${e(code)}`);

  inbox = (params: { status?: string; type?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.type) qs.set('type', params.type);
    const extra = qs.toString() ? `?${qs.toString()}` : '';
    return this.req<{ count: number; summary: { unread: number; overdue: number; total: number }; items: any[] }>("GET", `/inbox${extra}`);
  };
  readInbox = (id: string) => this.req("POST", `/inbox/${e(id)}/read`, {});
  doneInbox = (id: string) => this.req("POST", `/inbox/${e(id)}/done`, {});
  referrals = (params: { letterNo?: string; toUserId?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.letterNo) qs.set('letterNo', params.letterNo);
    if (params.toUserId) qs.set('toUserId', params.toUserId);
    if (params.status) qs.set('status', params.status);
    const extra = qs.toString() ? `?${qs.toString()}` : '';
    return this.req<{ count: number; items: any[] }>("GET", `/referrals${extra}`);
  };
  referLetter = (no: string, body: unknown) => this.req("POST", `/letters/${e(no)}/refer`, body);
  generateLetter = (body: unknown) => this.req("POST", "/letters/generate", body);
  letterTemplates = () => this.req<{ count: number; items: any[] }>("GET", "/../edms/c1-p1/templates?templateType=letter", {} as any);
  doneReferral = (id: string, body: unknown = {}) => this.req("POST", `/referrals/${e(id)}/done`, body);

  createRule = (r: unknown) => this.req("POST", "/rules", r);
  updateRule = (code: string, patch: unknown) => this.req("PATCH", `/rules/${e(code)}`, patch);
  deleteRule = (code: string) => this.req("DELETE", `/rules/${e(code)}`);
}
