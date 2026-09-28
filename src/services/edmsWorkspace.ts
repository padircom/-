/**
 * EDM-1 — کلاینت REST فضای کاری اسناد و مدارک (d1) با اتصال فایل به نسخه.
 * مسیرها نسبی هستند تا از پروکسی Vite عبور کنند.
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

  // generic document CRUD via /api/data still exists for now, but we provide direct create via same endpoint as before? Use /api/data/Document for creation
  createDocument = (body: unknown) => {
    // uses generic data endpoint with projectId in body, but we go through /api/data/Document
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
        headers: {
          ...(this.userId ? { 'x-user-id': this.userId } : {}),
        },
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
}
