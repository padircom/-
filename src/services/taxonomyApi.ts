import type { Process } from "../data/framework";

/**
 * ویرایشِ ساختارِ فرآیندهای دو حوزهٔ آغازین.
 *
 * دادهٔ پایه همچنان در framework.ts است؛ این API فقط override پروژه‌ای را
 * می‌خواند و ذخیره می‌کند تا نبودِ رکورد، نمایشِ پیش‌فرض را از کار نیندازد.
 */
export const EDITABLE_TAXONOMY_DOMAINS = ["d6", "d20"] as const;
export type EditableTaxonomyDomain = (typeof EDITABLE_TAXONOMY_DOMAINS)[number];

const BASE = "/api/framework/process-tree";

type Envelope<T> = { ok?: boolean; data?: T };
type TreeResponse = {
  domainId: string;
  projectId: string;
  processes: Process[] | null;
  source: "framework" | "database";
};

async function readJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  try {
    const body = (await response.json()) as Envelope<T>;
    return body.ok ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

export async function loadProcessTree(projectId: string, domainId: string): Promise<Process[] | null> {
  if (!projectId || !EDITABLE_TAXONOMY_DOMAINS.includes(domainId as EditableTaxonomyDomain)) return null;
  try {
    const response = await fetch(`${BASE}?projectId=${encodeURIComponent(projectId)}&domainId=${encodeURIComponent(domainId)}`, {
      headers: { Accept: "application/json" },
    });
    const data = await readJson<TreeResponse>(response);
    return Array.isArray(data?.processes) ? data.processes : null;
  } catch {
    return null;
  }
}

export async function saveProcessTree(projectId: string, domainId: string, processes: Process[], actor?: string): Promise<Process[] | null> {
  if (!projectId || !EDITABLE_TAXONOMY_DOMAINS.includes(domainId as EditableTaxonomyDomain)) return null;
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
  if (!projectId || !EDITABLE_TAXONOMY_DOMAINS.includes(domainId as EditableTaxonomyDomain)) return false;
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
