/**
 * EDM-1 + EDM-2 + EDM-3 + EDM-4 — کلاینت REST فضای کاری اسناد و مدارک (d1).
 */
import { jsonRequest, type ApiResult } from './apiClient';

export type EdmsResult<T> = ApiResult<T>;

export type EdmsDocument = {
  Id: string;
  ProjectId: string;
  DocNo: string;
  TitleFa: string;
  TitleEn?: string | null;
  Revision: string;
  Status: string;
  Discipline?: string | null;
  Classification?: string | null;
  FilePath?: string | null;
  IssuedAt?: string | null;
  ReviewCode?: string | null;
  SlaHours?: number | null;
};

export type EdmsAttachment = {
  Id: string;
  ProjectId: string;
  DocumentId: string;
  DocNo: string;
  Revision: string;
  FileName: string;
  MimeType: string;
  SizeBytes: number;
  StorageKey: string;
  ChecksumSha256?: string | null;
  UploadedBy: string;
  UploadedAt: string;
  NoteFa?: string | null;
  downloadUrl: string;
};

export type EdmsDocumentList = {
  count: number;
  items: (EdmsDocument & { versions: number; hasFile: boolean })[];
  byDocNo: Record<string, { id: string; revision: string; status: string; issuedAt: string | null; filePath: string | null }[]>;
};

export type EdmsFileList = {
  count: number;
  document: { id: string; docNo: string; revision: string; titleFa: string };
  items: EdmsAttachment[];
};

export type EdmsHold = {
  Id: string;
  ProjectId: string;
  DocumentId: string;
  DocNo: string;
  Revision: string;
  HoldNo: string;
  TitleFa: string;
  HoldType: string;
  RaisedBy: string;
  RaisedAt: string;
  DueAt?: string | null;
  ReleasedBy?: string | null;
  ReleasedAt?: string | null;
  NoteFa?: string | null;
  Status: string;
};

export type EdmsHoldList = {
  count: number;
  summary: { open: number; overdue: number; released: number };
  items: EdmsHold[];
};

export type EdmsDependency = {
  Id: string;
  ProjectId: string;
  DocumentId: string;
  DependsOnDocumentId: string;
  DependencyType: string;
  IsMandatory: boolean;
  NoteFa?: string | null;
  CreatedBy: string;
  CreatedAt: string;
  document?: { docNo: string; revision: string; titleFa: string; status: string } | null;
  prereq?: { docNo: string; revision: string; titleFa: string; status: string } | null;
};

export type EdmsDependencyList = { count: number; items: EdmsDependency[] };

export type EdmsReadiness = {
  document: { id: string; docNo: string; revision: string; status: string };
  totalDeps: number;
  mandatory: number;
  blockers: string[];
  warnings: string[];
  canIssue: boolean;
};

export type EdmsComment = {
  Id: string;
  ProjectId: string;
  DocumentId: string;
  DocNo: string;
  Revision: string;
  CommentNo: number;
  CommentText: string;
  CommentedBy: string;
  CommentedAt: string;
  ReplyText?: string | null;
  RepliedBy?: string | null;
  RepliedAt?: string | null;
  ConclusionText?: string | null;
  ConcludedBy?: string | null;
  ConcludedAt?: string | null;
  ReviewCode?: string | null;
  Status: string;
};

export type EdmsDciItem = {
  Id: string;
  DocNo: string;
  TitleFa: string;
  Revision: string;
  Status: string;
  Discipline: string | null;
  hasFile: boolean;
  fileCount: number;
  openHolds: number;
  totalDeps: number;
  mandatoryDeps: number;
  mandatoryNotApproved: number;
  canIssue: boolean;
  comments: { total: number; open: number; replied: number; concluded: number };
  distCount: number;
  effortHours: number;
};
export type EdmsDciList = { count: number; summary: { total: number; canIssue: number; blocked: number; withFile: number; openHolds: number; openComments: number }; items: EdmsDciItem[] };

export type EdmsDistribution = {
  Id: string;
  ProjectId: string;
  DocumentId: string;
  DocNo: string;
  Revision: string;
  Party: string;
  TransmittalNo?: string | null;
  DistributedAt: string;
  DistributedBy: string;
  NoteFa?: string | null;
};
export type EdmsDistributionList = { count: number; items: EdmsDistribution[] };

export type EdmsTemplate = {
  Id: string;
  ProjectId: string;
  TemplateType: string;
  NameFa: string;
  Code?: string | null;
  ContentJson?: string | null;
  NoteFa?: string | null;
  CreatedBy: string;
  CreatedAt: string;
};
export type EdmsTemplateList = { count: number; items: EdmsTemplate[] };

export type EdmsNotification = {
  Id: string;
  ProjectId: string;
  DocumentId: string;
  DocNo: string;
  EventType: string;
  RecipientParty: string;
  RecipientEmail?: string | null;
  SubjectFa: string;
  BodyFa?: string | null;
  Channel: string;
  Status: string;
  CreatedAt: string;
  SentAt?: string | null;
};
export type EdmsNotificationList = { count: number; summary: { pending: number; sent: number; total: number }; items: EdmsNotification[] };

export type EdmsEffort = {
  Id: string;
  ProjectId: string;
  DocumentId: string;
  DocNo: string;
  Revision: string;
  PersonId?: string | null;
  PersonName?: string | null;
  WorkDate: string;
  Hours: number;
  Cost?: number | null;
  Activity?: string | null;
  NoteFa?: string | null;
  CreatedBy: string;
  CreatedAt: string;
};
export type EdmsEffortList = { count: number; summary: { totalHours: number; totalCost: number; byPerson?: Record<string, number> }; items: EdmsEffort[] };

export type EdmsCommentList = {
  count: number;
  summary: { open: number; replied: number; concluded: number; total: number };
  items: EdmsComment[];
};

export class EdmsClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private q(path: string) {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}projectId=${encodeURIComponent(this.projectId)}`;
  }

  private req<T>(method: string, path: string, body?: unknown): Promise<EdmsResult<T>> {
    return jsonRequest<T>(this.q(path), this.userId, method, body);
  }

  documents = (params: { docNo?: string; discipline?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.docNo) qs.set('docNo', params.docNo);
    if (params.discipline) qs.set('discipline', params.discipline);
    if (params.status) qs.set('status', params.status);
    const extra = qs.toString() ? `&${qs.toString()}` : '';
    return this.req<EdmsDocumentList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/documents${extra}`);
  };

  createDocument = (body: unknown) => {
    return jsonRequest<{ row?: any } | any>(`/api/data/Document`, this.userId, 'POST', { ProjectId: this.projectId, ...(body as object) });
  };

  files = (docId: string) => this.req<EdmsFileList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(docId)}/files`);

  async uploadFile(docId: string, file: File, noteFa?: string): Promise<EdmsResult<{ id: string; item: EdmsAttachment; downloadUrl: string }>> {
    try {
      const form = new FormData();
      form.append('file', file);
      if (noteFa) form.append('noteFa', noteFa);
      const res = await fetch(this.q(`/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(docId)}/files`), {
        method: 'POST',
        headers: { ...(this.userId ? { 'x-user-id': this.userId } : {}) },
        body: form,
      });
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) {
        return { ok: false, status: res.status, code: 'E-API-NO-JSON', message: 'پاسخ سرور قابل خواندن نیست' };
      }
      const json = await res.json();
      if (json?.ok) return { ok: true, data: json.data as any };
      const { code, message } = json?.error ?? {};
      return { ok: false, status: res.status, code: code ?? 'E-API-UNKNOWN', message: message ?? 'خطای ناشناخته' };
    } catch {
      return { ok: false, status: 0, code: 'E-API-NETWORK', message: 'اتصال به سرور برقرار نشد' };
    }
  }

  deleteFile = (fileId: string) => this.req<{ deleted: boolean; id: string }>('DELETE', `/api/edms/${encodeURIComponent(this.projectId)}/files/${encodeURIComponent(fileId)}`);

  holds = (params: { documentId?: string; status?: string; holdType?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.documentId) qs.set('documentId', params.documentId);
    if (params.status) qs.set('status', params.status);
    if (params.holdType) qs.set('holdType', params.holdType);
    const extra = qs.toString() ? `&${qs.toString()}` : '';
    return this.req<EdmsHoldList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/holds${extra}`);
  };

  createHold = (body: unknown) => this.req<{ id: string; item: EdmsHold }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/holds`, body);
  releaseHold = (holdId: string, noteFa?: string) => this.req<{ item: EdmsHold }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/holds/${encodeURIComponent(holdId)}/release`, { noteFa });
  cancelHold = (holdId: string) => this.req<{ item: EdmsHold }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/holds/${encodeURIComponent(holdId)}/cancel`, {});

  dependencies = (params: { documentId?: string; dependsOn?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.documentId) qs.set('documentId', params.documentId);
    if (params.dependsOn) qs.set('dependsOn', params.dependsOn);
    const extra = qs.toString() ? `&${qs.toString()}` : '';
    return this.req<EdmsDependencyList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/dependencies${extra}`);
  };

  createDependency = (body: unknown) => this.req<{ id: string; item: EdmsDependency }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/dependencies`, body);
  deleteDependency = (depId: string) => this.req<{ deleted: boolean; id: string }>('DELETE', `/api/edms/${encodeURIComponent(this.projectId)}/dependencies/${encodeURIComponent(depId)}`);
  readiness = (docId: string) => this.req<EdmsReadiness>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(docId)}/readiness`);

  // comments EDM-4
  comments = (docId: string) => this.req<EdmsCommentList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(docId)}/comments`);
  createComment = (docIdOrBody: string | { documentId: string; commentText: string; reviewCode?: string }, bodyMaybe?: unknown) => {
    if (typeof docIdOrBody === 'string') {
      return this.req<{ id: string; item: EdmsComment }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(docIdOrBody)}/comments`, bodyMaybe);
    } else {
      const { documentId, ...rest } = docIdOrBody as any;
      return this.req<{ id: string; item: EdmsComment }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(documentId)}/comments`, rest);
    }
  };
  replyComment = (commentId: string, body: unknown) => {
    const payload = typeof body === 'string' ? { replyText: body } : body;
    return this.req<{ item: EdmsComment }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/comments/${encodeURIComponent(commentId)}/reply`, payload);
  };
  concludeComment = (commentId: string, body: unknown) => {
    const payload = typeof body === 'string' ? { conclusionText: body } : body;
    return this.req<{ item: EdmsComment }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/comments/${encodeURIComponent(commentId)}/conclude`, payload);
  };
  dci = () => this.req<EdmsDciList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/dci`);
  distributions = (params: { documentId?: string; party?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.documentId) qs.set('documentId', params.documentId);
    if (params.party) qs.set('party', params.party);
    const extra = qs.toString() ? `&${qs.toString()}` : '';
    return this.req<EdmsDistributionList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/distributions${extra}`);
  };
  docDistributions = (docId: string) => this.req<EdmsDistributionList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(docId)}/distributions`);
  templates = (params: { templateType?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.templateType) qs.set('templateType', params.templateType);
    const extra = qs.toString() ? `&${qs.toString()}` : '';
    return this.req<EdmsTemplateList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/templates${extra}`);
  };
  createTemplate = (body: { templateType: string; nameFa: string; code?: string; contentJson?: unknown; noteFa?: string }) => this.req<{ id: string; item: EdmsTemplate }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/templates`, body);
  notifications = (params: { documentId?: string; eventType?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.documentId) qs.set('documentId', params.documentId);
    if (params.eventType) qs.set('eventType', params.eventType);
    if (params.status) qs.set('status', params.status);
    const extra = qs.toString() ? `&${qs.toString()}` : '';
    return this.req<EdmsNotificationList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/notifications${extra}`);
  };
  sendNotification = (notifId: string) => this.req<{ item: EdmsNotification }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/notifications/${encodeURIComponent(notifId)}/send`, {});
  effort = (docId: string) => this.req<EdmsEffortList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(docId)}/effort`);
  allEffort = (params: { documentId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.documentId) qs.set('documentId', params.documentId);
    const extra = qs.toString() ? `&${qs.toString()}` : '';
    return this.req<EdmsEffortList>('GET', `/api/edms/${encodeURIComponent(this.projectId)}/effort${extra}`);
  };
  createEffort = (docId: string, body: { workDate: string; hours: number; personName?: string; personId?: string; activity?: string; cost?: number; noteFa?: string }) => this.req<{ id: string; item: EdmsEffort }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(docId)}/effort`, body);
  deleteEffort = (effortId: string) => this.req<{ deleted: boolean; id: string }>('DELETE', `/api/edms/${encodeURIComponent(this.projectId)}/effort/${encodeURIComponent(effortId)}`);

  createNotification = (body: { documentId: string; eventType: string; party?: string; subjectFa?: string; bodyFa?: string; channel?: string }) => this.req<{ id: string; item: EdmsNotification }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/notifications`, body);

  deleteTemplate = (templateId: string) => this.req<{ deleted: boolean; id: string }>('DELETE', `/api/edms/${encodeURIComponent(this.projectId)}/templates/${encodeURIComponent(templateId)}`);

  distribute = (docId: string, body: { party: string; transmittalNo?: string; noteFa?: string }) => this.req<{ id: string; item: EdmsDistribution }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(docId)}/distribute`, body);

  voidComment = (commentId: string) => this.req<{ item: EdmsComment }>('POST', `/api/edms/${encodeURIComponent(this.projectId)}/comments/${encodeURIComponent(commentId)}/void`, {});
}
