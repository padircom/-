/**
 * کلاینت پیمایش سلسله‌مراتبی (P9 — MIX-1): سبد ← پروژه ← فاز ← اقلام.
 *
 * هر بخش مجوز پایهٔ خودش را دارد؛ بخشِ بی‌مجوز با `count: null` می‌آید و در UI
 * «بدون دسترسی» نشان داده می‌شود، نه صفر. هیچ شمارشی در مرورگر ساخته نمی‌شود.
 */
import { jsonRequest, type ApiResult } from "./apiClient";

const e = encodeURIComponent;

export type DrillBi = { fa: string; en: string };
export type DrillSectionState = "ready" | "empty" | "restricted" | "unavailable" | "too_large";
export type DrillSectionInfo = { key: string; label: DrillBi; table: string; allowed: boolean; permissions: string[]; hasWbs: boolean; hasAmount: boolean };
export type DrillSectionRollup = {
  key: string;
  table: string;
  label: DrillBi;
  state: DrillSectionState;
  restricted: boolean;
  count: number | null;
  amount: number | null;
  amountField: string | null;
  statusCounts: Record<string, number> | null;
  phased: boolean;
  limit?: number;
};
export type DrillItem = { id: string; code: string; title: string; status: string | null; date: string | null; amount: number | null; phaseId: string | null; phaseCode: string | null };
export type DrillPayload = {
  projectId: string;
  projectCode: string | null;
  projectName: string | null;
  phases: { id: string; code: string; title: string; counts: Record<string, number>; total: number }[];
  unphased: Record<string, number>;
  sections: DrillSectionRollup[];
  items: DrillItem[] | null;
  itemsSection: { key: string; label: DrillBi; readable: boolean; phase: string | null; limit: number; permission: string } | null;
  projectSource?: string;
  warning?: string | null;
  modelVersion: string;
  generatedAt: string;
};
export type DrillPortfolio = {
  sections: { key: string; label: DrillBi; allowed: boolean; tooLarge: boolean; permission: string }[];
  projects: { projectId: string; code: string | null; title: string | null; sections: { key: string; count: number | null; state: DrillSectionState }[]; total: number | null }[];
  metrics: { projects: number; readable: number };
  modelVersion: string;
  generatedAt: string;
};

export class DrillClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(path: string): Promise<ApiResult<T>> {
    return jsonRequest<T>(`/api/drill/${e(this.projectId)}${path}`, this.userId, "GET");
  }

  portfolio = () => this.req<DrillPortfolio>("/portfolio");
  /** پیمایش یک پروژهٔ دلخواه از نمای سبد؛ مسیر عوض می‌شود، نه دامنه. */
  drillOf = (projectId: string, section?: string, phase?: string, limit = 50) => {
    const q = new URLSearchParams();
    if (section) q.set("section", section);
    if (phase) q.set("phase", phase);
    q.set("limit", String(limit));
    return jsonRequest<DrillPayload>(`/api/drill/${e(projectId)}/drill?${q.toString()}`, this.userId, "GET");
  };
  drill = (section?: string, phase?: string, limit = 50) => this.drillOf(this.projectId, section, phase, limit);
}
