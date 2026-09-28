import { domains, type Process } from "../data/framework";

/**
 * ویرایشِ ساختارِ فرآیند — GOV-1: همهٔ حوزه‌ها (پیش‌تر فقط d6/d20).
 *
 * دادهٔ پایه همچنان در framework.ts است؛ این API فقط override پروژه‌ای را
 * می‌خواند و ذخیره می‌کند تا نبودِ رکورد، نمایشِ پیش‌فرض را از کار نیندازد.
 * مجوز ویرایش (`gov.process.edit`) سمت سرور کنترل می‌شود و پاسخ خواندن،
 * `canEdit` را برمی‌گرداند تا دکمهٔ ویرایش فقط برای دارندهٔ مجوز دیده شود.
 */
export const EDITABLE_TAXONOMY_DOMAINS: readonly string[] = domains.map((d) => d.id);
export type EditableTaxonomyDomain = string;

const BASE = "/api/framework/process-tree";

type Envelope<T> = { ok?: boolean; data?: T };
export type ProcessTreeResult = {
  domainId: string;
  projectId: string;
  processes: Process[] | null;
  source: "framework" | "database";
  /** فقط با مجوز ویرایش مقدار true دارد؛ نبود مجوز یعنی خواندنِ فقط‌خواندنی. */
  canEdit: boolean;
};
type TreeResponse = ProcessTreeResult;

async function readJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  try {
    const body = (await response.json()) as Envelope<T>;
    return body.ok ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

/** درخواست کامل: هم فرایندها و هم مجوز ویرایش همین حوزه. */
export async function loadProcessTreeFull(projectId: string, domainId: string, actor?: string): Promise<ProcessTreeResult | null> {
  if (!projectId || !EDITABLE_TAXONOMY_DOMAINS.includes(domainId)) return null;
  try {
    const response = await fetch(`${BASE}?projectId=${encodeURIComponent(projectId)}&domainId=${encodeURIComponent(domainId)}`, {
      headers: { Accept: "application/json", ...(actor ? { "x-user-id": actor } : {}) },
    });
    const data = await readJson<TreeResponse>(response);
    if (!data) return null;
    return {
      domainId: data.domainId ?? domainId,
      projectId: data.projectId ?? projectId,
      processes: Array.isArray(data.processes) ? data.processes : null,
      source: data.source === "database" ? "database" : "framework",
      canEdit: data.canEdit === true,
    };
  } catch {
    return null;
  }
}

export async function loadProcessTree(projectId: string, domainId: string, actor?: string): Promise<Process[] | null> {
  const result = await loadProcessTreeFull(projectId, domainId, actor);
  return result?.processes ?? null;
}

export async function saveProcessTree(projectId: string, domainId: string, processes: Process[], actor?: string): Promise<Process[] | null> {
  if (!projectId || !EDITABLE_TAXONOMY_DOMAINS.includes(domainId)) return null;
  try {
    const response = await fetch(BASE, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Accept: "application/json",
        ...(actor ? { "x-user-id": actor } : {}),
      },
      body: JSON.stringify({ projectId, domainId, processes }),
    });
    const data = await readJson<TreeResponse>(response);
    return Array.isArray(data?.processes) ? data.processes : null;
  } catch {
    return null;
  }
}

export async function resetProcessTree(projectId: string, domainId: string, actor?: string): Promise<boolean> {
  if (!projectId || !EDITABLE_TAXONOMY_DOMAINS.includes(domainId)) return false;
  try {
    const response = await fetch(`${BASE}?projectId=${encodeURIComponent(projectId)}&domainId=${encodeURIComponent(domainId)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(actor ? { "x-user-id": actor } : {}),
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
