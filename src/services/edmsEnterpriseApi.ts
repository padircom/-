/**
 * کلاینت REST API بخش ۷ سازمان: مدیریت اسناد، بایگانی دیجیتال و مدیریت دانش (Enterprise EDMS / KMS)
 * منطبق با ISO 15489، ISO 30301، ISO 9001 و ISO 30401.
 */

export const EDMS_DEMO_USERS = [
  { id: "u-doc", labelFa: "کنترل مدارک DCC (مدیریت DMI، نسخه‌ها، ترانسمیتال، آرشیو و KMS)", roleFa: "doc_controller" },
  { id: "u-engmgr", labelFa: "مدیر مهندسی و طراحی (صدور نسخه، تأیید فنی و دانش مهندسی)", roleFa: "engineering_manager" },
  { id: "u-qa", labelFa: "مدیر تضمین کیفیت (تأیید گردش‌کار ISO 9001، آرشیو و KMS)", roleFa: "qa_manager" },
  { id: "u-pm", labelFa: "مدیر پروژه (تصویب نهایی مدارک، ترانسمیتال و دروس آموخته)", roleFa: "project_manager" },
  { id: "u-site", labelFa: "سرپرست کارگاه (فقط مشاهده اسناد، جستجوی OCR و مطالعه ویکی)", roleFa: "site_engineer" },
  { id: "u-admin", labelFa: "مدیر سامانه (همهٔ مجوزهای مدیریتی)", roleFa: "admin" },
] as const;

export interface EdmsWorkspaceSummary {
  projectId: string;
  standards: string[];
  kpis: {
    numberingRulesCount: number;
    masterDocumentsCount: number;
    approvedOrIfcDocsCount: number;
    asBuiltDocsCount: number;
    revisionsCount: number;
    activeCheckoutLocksCount: number;
    activeWorkflowsCount: number;
    transmittalsCount: number;
    archiveZonesCount: number;
    totalArchivedDocsCount: number;
    ocrIndexedCount: number;
    avgOcrConfidencePct: number;
    lessonsLearnedCount: number;
    knowledgeArticlesCount: number;
    totalKnowledgeSavingsRials: number;
  };
}

export interface EdmsSearchHit {
  id: string;
  sourceType: "dmi" | "ocr" | "lessons" | "wiki";
  sourceLabelFa: string;
  code: string;
  titleFa: string;
  revisionOrCategory: string;
  snippetFa: string;
  confidenceOrScore: number;
}

async function edmsFetch<T>(path: string, userId: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (userId) headers.set("x-user-id", userId);
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.error?.message ||
      body?.messageFa ||
      body?.message ||
      `خطای ارتباط با سرور مدیریت اسناد و دانش (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export async function fetchEdmsWorkspace(projectId: string, userId: string): Promise<EdmsWorkspaceSummary> {
  return edmsFetch<EdmsWorkspaceSummary>(`/api/edms/${encodeURIComponent(projectId)}/workspace`, userId);
}

export async function generateEdmsDocCode(
  projectId: string,
  userId: string,
  ruleId: string,
): Promise<{ ok: boolean; generatedCode: string; rule: Record<string, unknown> }> {
  return edmsFetch(
    `/api/edms/${encodeURIComponent(projectId)}/numbering-rules/${encodeURIComponent(ruleId)}/generate-code`,
    userId,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function checkoutEdmsDocument(
  projectId: string,
  userId: string,
  docId: string,
  reasonFa: string,
): Promise<{ ok: boolean; document: Record<string, unknown>; lock: Record<string, unknown> }> {
  return edmsFetch(
    `/api/edms/${encodeURIComponent(projectId)}/master-documents/${encodeURIComponent(docId)}/checkout`,
    userId,
    { method: "POST", body: JSON.stringify({ reasonFa }) },
  );
}

export async function checkinEdmsDocument(
  projectId: string,
  userId: string,
  docId: string,
  payload: { newRevision: string; diffHighlightsFa: string },
): Promise<{ ok: boolean; document: Record<string, unknown>; revision: Record<string, unknown> }> {
  return edmsFetch(
    `/api/edms/${encodeURIComponent(projectId)}/master-documents/${encodeURIComponent(docId)}/checkin`,
    userId,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function searchEdmsFullText(
  projectId: string,
  userId: string,
  query: string,
  sourceFilter: string = "all",
): Promise<{ projectId: string; query: string; sourceFilter: string; count: number; items: EdmsSearchHit[] }> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (sourceFilter) params.set("source", sourceFilter);
  return edmsFetch(
    `/api/edms/${encodeURIComponent(projectId)}/fulltext-search?${params.toString()}`,
    userId,
  );
}

export function createEdmsCrudClient<T extends Record<string, unknown>>(resourcePath: string) {
  return {
    async list(projectId: string, userId: string): Promise<T[]> {
      const res = await edmsFetch<{ items?: T[] }>(
        `/api/edms/${encodeURIComponent(projectId)}/${resourcePath}`,
        userId,
      );
      return Array.isArray(res.items) ? res.items : [];
    },
    async create(projectId: string, userId: string, payload: Partial<T>): Promise<T> {
      return edmsFetch<T>(`/api/edms/${encodeURIComponent(projectId)}/${resourcePath}`, userId, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    async update(projectId: string, userId: string, id: string, payload: Partial<T>): Promise<T> {
      return edmsFetch<T>(
        `/api/edms/${encodeURIComponent(projectId)}/${resourcePath}/${encodeURIComponent(id)}`,
        userId,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
    },
    async remove(projectId: string, userId: string, id: string): Promise<{ ok: boolean; id: string }> {
      return edmsFetch<{ ok: boolean; id: string }>(
        `/api/edms/${encodeURIComponent(projectId)}/${resourcePath}/${encodeURIComponent(id)}`,
        userId,
        {
          method: "DELETE",
        },
      );
    },
  };
}
