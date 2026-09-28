/**
 * کلاینت دستیار هوشمند (P10 — AI-1..AI-4).
 *
 * هیچ عددی در مرورگر محاسبه نمی‌شود؛ هر پاسخ (متن، جدول، نمودار، منبع داده)
 * از سرور می‌آید و متن بازنویسی‌شده (در صورت وجود) کنار متن محاسبه‌شده نمایش
 * داده می‌شود تا عدد سرور جای خودش را از دست ندهد.
 */
import { jsonRequest, type ApiResult } from "./apiClient";

const e = encodeURIComponent;

export type AiBi = { fa: string; en: string };
export type AiFact = { label: AiBi; value: string | number | null; kind?: "count" | "money" | "date" | "text" };
export type AiTable = { columns: { key: string; label: AiBi; kind: string }[]; rows: (string | number | null)[][]; truncated: boolean };
export type AiChart = { kind: "bar" | "pie" | "line"; category: AiBi; measure: AiBi; points: { label: string; value: number | null }[] };
export type AiSourceUse = { key: string; table: string; label: AiBi; rows: number; restricted: boolean; note?: AiBi };
export type AiSection = {
  key: string;
  label: AiBi;
  state: "answered" | "empty" | "insufficient" | "restricted";
  textFa: string;
  textEn: string;
  facts: AiFact[];
  table: AiTable | null;
  chart: AiChart | null;
  sources: AiSourceUse[];
  limits: AiBi[];
};
export type AiToolInfo = { key: string; kind: "insight" | "query"; label: AiBi; hint: AiBi; permission: string; sources: string[]; examples: AiBi[] };
export type AiWorkspace = {
  projectId: string;
  can: { ask: boolean; insight: boolean; history: boolean; export: boolean };
  tools: AiToolInfo[];
  restrictedTools: number;
  datasets: { key: string; table: string; label: AiBi }[];
  restrictedDatasets: number;
  recent: { code: string; question: string; tool: string; state: string; at: string; actor: string }[];
  metrics: { interactions: number; byState: Record<string, number>; sources: number; modelVersion: string; generatedAt: string };
  provider: { serverKeyConfigured: boolean; note: string };
};
export type AiAskResult = {
  code: string;
  question: string;
  matched: boolean;
  reason?: "no_match" | "restricted" | "empty_question";
  detailFa?: string;
  detailEn?: string;
  dataset?: string | null;
  suggestions?: string[];
  tool?: string;
  toolLabel?: AiBi;
  params?: Record<string, unknown>;
  matchedKeywords?: string[];
  section?: AiSection;
  narration?: string | null;
  narratedBy?: string | null;
  narrationNote?: string | null;
  dataDate?: string;
  modelVersion: string;
  latencyMs: number;
};
export type AiHistoryItem = {
  code: string;
  question: string;
  tool: string;
  state: string;
  at: string;
  actor: string;
  provider: string | null;
  latencyMs: number | null;
  sources: { table: string; rows: number; restricted: boolean }[];
};
export type AiStoredAnswer = {
  code: string;
  question: string;
  tool: string;
  state: string;
  at: string;
  actor: string;
  params: Record<string, unknown> | null;
  answerFa: string;
  facts: AiFact[];
  table: AiTable | null;
  chart: AiChart | null;
  sources: AiSourceUse[];
  provider: string | null;
  narration: string | null;
  latencyMs: number | null;
  modelVersion: string;
  note: string;
};

export class AiAssistantClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    return jsonRequest<T>(`/api/ai/${e(this.projectId)}${path}`, this.userId, method, body);
  }

  workspace = () => this.req<AiWorkspace>("GET", "/workspace");
  ask = (body: { question?: string; tool?: string; params?: Record<string, unknown>; provider?: string; narrate?: boolean }) => this.req<AiAskResult>("POST", "/ask", body);
  insights = () => this.req<{ code: string; sections: AiSection[]; dataDate: string; modelVersion: string; latencyMs: number }>("GET", "/insights");
  history = (limit = 30) => this.req<{ total: number; items: AiHistoryItem[]; can: { export: boolean }; modelVersion: string }>("GET", `/history?limit=${limit}`);
  answer = (code: string) => this.req<AiStoredAnswer>("GET", `/history/${e(code)}`);
  toTemplate = (code: string, body?: { Code?: string; TitleFa?: string; NoteFa?: string }) =>
    this.req<{ template: { code: string; title: string; dataset: string; status: string; version: number; sourceInteraction: string } }>("POST", `/history/${e(code)}/template`, body ?? {});

  /** خروجی CSV یا سند Markdown — متن است، نه JSON. */
  async exportDoc(code: string, format: "csv" | "md"): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
    try {
      const res = await fetch(`/api/ai/${e(this.projectId)}/history/${e(code)}/export?format=${format}`, {
        headers: { accept: format === "csv" ? "text/csv" : "text/markdown", ...(this.userId ? { "x-user-id": this.userId } : {}) },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error?.message ?? `خروجی ناموفق بود (${res.status})` };
      }
      return { ok: true, text: await res.text() };
    } catch {
      return { ok: false, message: "اتصال به سرور برقرار نشد" };
    }
  }
}
