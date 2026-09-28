/**
 * کلاینت گزارش‌ساز سفارشی (P9 — RPT-1).
 *
 * مشخصات گزارش (فیلد/فیلتر/گروه/نمودار) یک سند است: این کلاینت آن را برای
 * اعتبارسنجی به سرور می‌فرستد و اجرا/خروجی را از سرور می‌گیرد. هیچ فیلتری
 * سمت مرورگر روی داده اعمال نمی‌شود تا «عددِ نمایش» همان «عددِ سرور» باشد.
 */
import { jsonRequest, type ApiResult } from "./apiClient";

const e = encodeURIComponent;

export type RbBi = { fa: string; en: string };
export type RbColumnInfo = { name: string; label: RbBi; kind: string; values: string[] | null };
export type RbDatasetInfo = { key: string; table: string; label: RbBi; columns: RbColumnInfo[] };
export type RbTemplate = {
  Id: string;
  ProjectId: string;
  Code: string;
  TitleFa: string;
  DatasetKey: string;
  Status: "draft" | "published" | "retired";
  Version: number;
  RowVersion: number;
  LimitRows: number;
  NoteFa: string | null;
  Fields: string[];
  Filters: { column: string; op: string; value?: string | number | null; values?: (string | number)[] }[];
  Group: { by: string; aggs: { column: string; fn: string }[] } | null;
  Sort: { column: string; dir: "asc" | "desc" }[];
  Chart: { kind: string; category: string; measure: string } | null;
};
export type RbResult = {
  dataset: string;
  table: string;
  fields: string[];
  rows: Record<string, string | number | null>[];
  groups: { key: string; count: number; aggs: Record<string, number | null> }[] | null;
  totals: Record<string, number>;
  matched: number;
  shown: number;
  truncated: boolean;
  groupBy: string | null;
  generatedAt: string;
};
export type RbChart = { kind: string; category: string; measure: string; points: { label: string; value: number | null }[] } | null;
export type RbWorkspace = {
  projectId: string;
  can: { view: boolean; run: boolean; edit: boolean; publish: boolean };
  datasets: RbDatasetInfo[];
  restrictedDatasets: number;
  templates: RbTemplate[];
  metrics: { datasets: number; templates: { total: number; draft: number; published: number; retired: number }; generatedAt: string; modelVersion: string };
};
export type RbRunPayload = { spec: unknown; dataset: { key: string; table: string; label: RbBi }; result: RbResult; chart: RbChart; template?: { code: string; title: string; status: string; version: number } };
export type RbSpecInput = {
  dataset: string;
  fields: string[];
  filters?: unknown[];
  group?: unknown;
  sort?: unknown[];
  limit?: number;
  chart?: unknown;
};

export class ReportBuilderClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    return jsonRequest<T>(`/api/reports/${e(this.projectId)}${path}`, this.userId, method, body);
  }

  workspace = () => this.req<RbWorkspace>("GET", "/workspace");
  preview = (spec: RbSpecInput) => this.req<RbRunPayload>("POST", "/preview", { spec });
  createTemplate = (body: Record<string, unknown>) => this.req<RbTemplate>("POST", "/templates", body);
  updateTemplate = (code: string, patch: Record<string, unknown>) => this.req<RbTemplate>("PATCH", `/templates/${e(code)}`, patch);
  transition = (code: string, action: "publish" | "retire") => this.req<RbTemplate>("POST", `/templates/${e(code)}/transition`, { action });
  run = (code: string) => this.req<RbRunPayload>("GET", `/templates/${e(code)}/run`);

  /** CSV با هدر هویت کاربر؛ خروجی متن است نه JSON. */
  async csv(code: string): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
    try {
      const res = await fetch(`/api/reports/${e(this.projectId)}/templates/${e(code)}/csv`, {
        headers: { accept: "text/csv", ...(this.userId ? { "x-user-id": this.userId } : {}) },
      });
      if (!res.ok) return { ok: false, message: `خروجی CSV ناموفق بود (${res.status})` };
      return { ok: true, text: await res.text() };
    } catch {
      return { ok: false, message: "اتصال به سرور برقرار نشد" };
    }
  }
}
