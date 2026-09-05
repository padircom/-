import {
  type ApiEnvelope,
  type DailyReportDto,
  type EvmDto,
  type IndustryDto,
  type PageRequest,
  type PageResult,
  type ProjectDto,
  type RiskDto,
  type PortfolioSummaryDto,
  type WbsNodeDto,
  type ScheduleActivityDto,
  type TemplateDto,
  type FileDto,
  type KnowledgeDocumentDto,
  type RagAnswerDto,
  type OcrJobDto,
  type ReportWorkflowDto,
  type NotificationDto,
} from "./pmisContract";
import { loadSqlConfig, type SqlConfig } from "./sqlServer";

/**
 * PMIS Live REST API Client
 * Dispatches HTTP REST requests to the backend service.
 * Connects React UI -> Express/C# API -> SQL Server (e.g., .\SQL2008EXPRESS).
 */
export class PmisApiClient {
  private getConfig(): SqlConfig {
    return loadSqlConfig();
  }

  private async request<T>(path: string, options?: RequestInit): Promise<ApiEnvelope<T>> {
    const cfg = this.getConfig();
    const url = `${cfg.apiBaseUrl.replace(/\/$/, "")}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs || 15000);

    try {
      const isFormData = options?.body instanceof FormData;
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          "X-Sql-Server": cfg.server,
          "X-Sql-Database": cfg.database,
          ...(options?.headers ?? {}),
        },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        throw new Error(`API Error [${res.status}]: ${errorText}`);
      }

      return (await res.json()) as ApiEnvelope<T>;
    } finally {
      clearTimeout(timer);
    }
  }

  getDownloadUrl(path?: string): string | undefined {
    if (!path) return undefined;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${this.getConfig().apiBaseUrl.replace(/\/$/, "")}${path}`;
  }

  /* ─────────── Industries ─────────── */
  async getIndustries(pageReq?: PageRequest): Promise<PageResult<IndustryDto>> {
    const params = new URLSearchParams();
    if (pageReq?.page) params.set("page", String(pageReq.page));
    if (pageReq?.pageSize) params.set("pageSize", String(pageReq.pageSize));
    if (pageReq?.search) params.set("search", pageReq.search);

    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await this.request<PageResult<IndustryDto>>(`/industries${query}`);
    return res.data;
  }

  async createIndustry(dto: Omit<IndustryDto, "id">): Promise<IndustryDto> {
    const res = await this.request<IndustryDto>("/industries", {
      method: "POST",
      body: JSON.stringify(dto),
    });
    return res.data;
  }

  async updateIndustry(id: string, dto: Partial<IndustryDto>): Promise<IndustryDto> {
    const res = await this.request<IndustryDto>(`/industries/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
    return res.data;
  }

  async deleteIndustry(id: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/industries/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return res.data.success;
  }

  /* ─────────── Projects ─────────── */
  async getProjects(industryId?: string, pageReq?: PageRequest): Promise<PageResult<ProjectDto>> {
    const params = new URLSearchParams();
    if (industryId) params.set("industryId", industryId);
    if (pageReq?.page) params.set("page", String(pageReq.page));
    if (pageReq?.pageSize) params.set("pageSize", String(pageReq.pageSize));

    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await this.request<PageResult<ProjectDto>>(`/projects${query}`);
    return res.data;
  }

  async createProject(dto: Omit<ProjectDto, "id">): Promise<ProjectDto> {
    const res = await this.request<ProjectDto>("/projects", {
      method: "POST",
      body: JSON.stringify(dto),
    });
    return res.data;
  }

  async updateProject(id: string, dto: Partial<ProjectDto>): Promise<ProjectDto> {
    const res = await this.request<ProjectDto>(`/projects/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
    return res.data;
  }

  /* ─────────── Daily Reports ─────────── */
  async getDailyReports(projectId: string): Promise<DailyReportDto[]> {
    const res = await this.request<DailyReportDto[]>(`/projects/${encodeURIComponent(projectId)}/daily-reports`);
    return res.data;
  }

  async createDailyReport(projectId: string, dto: Omit<DailyReportDto, "id" | "projectId">): Promise<DailyReportDto> {
    const res = await this.request<DailyReportDto>(`/projects/${encodeURIComponent(projectId)}/daily-reports`, {
      method: "POST",
      body: JSON.stringify(dto),
    });
    return res.data;
  }

  async getReportWorkflow(dailyReportId: string): Promise<ReportWorkflowDto> {
    const res = await this.request<ReportWorkflowDto>(`/daily-reports/${encodeURIComponent(dailyReportId)}/workflow`);
    return res.data;
  }

  async applyReportWorkflowAction(dailyReportId: string, input: { actionCode: string; actorRole: string; comment?: string }): Promise<ReportWorkflowDto> {
    const res = await this.request<ReportWorkflowDto>(`/daily-reports/${encodeURIComponent(dailyReportId)}/workflow/actions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.data;
  }

  /* ─────────── Notifications ─────────── */
  async getNotifications(filters: { status?: string; projectCode?: string } = {}): Promise<NotificationDto[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.projectCode) params.set("projectCode", filters.projectCode);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await this.request<NotificationDto[]>(`/notifications${query}`);
    return res.data;
  }

  async createNotification(input: Partial<NotificationDto> & { channel: "email" | "sms" | "in_app"; recipient: string; body: string }): Promise<{ id: string; status: string }> {
    const res = await this.request<{ id: string; status: string }>("/notifications", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.data;
  }

  async sendNotification(id: string): Promise<Record<string, unknown>> {
    const res = await this.request<Record<string, unknown>>(`/notifications/${encodeURIComponent(id)}/send`, { method: "POST" });
    return res.data;
  }

  async sendTestNotification(input: { channel: "email" | "sms" | "in_app"; recipient: string; body?: string; projectCode?: string }): Promise<Record<string, unknown>> {
    const res = await this.request<Record<string, unknown>>("/notifications/test", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.data;
  }

  /* ─────────── File & Report Templates ─────────── */
  async uploadFile(file: File, options?: { projectCode?: string }): Promise<FileDto> {
    const form = new FormData();
    form.append("file", file);
    if (options?.projectCode) form.append("projectCode", options.projectCode);
    const res = await this.request<FileDto>("/files", { method: "POST", body: form });
    return { ...res.data, downloadUrl: this.getDownloadUrl(res.data.downloadUrl) };
  }

  async getTemplates(projectId: string, moduleCode = "d2-p4-s1"): Promise<TemplateDto[]> {
    const res = await this.request<TemplateDto[]>(`/projects/${encodeURIComponent(projectId)}/templates?moduleCode=${encodeURIComponent(moduleCode)}`);
    return res.data.map((template) => ({ ...template, downloadUrl: this.getDownloadUrl(template.downloadUrl) }));
  }

  async uploadTemplate(projectId: string, input: { file: File; kind: "internal" | "mandated"; moduleCode?: string; name?: string; version?: string }): Promise<TemplateDto> {
    const form = new FormData();
    form.append("file", input.file);
    form.append("kind", input.kind);
    form.append("moduleCode", input.moduleCode || "d2-p4-s1");
    form.append("name", input.name || input.file.name.replace(/\.[^.]+$/, ""));
    form.append("version", input.version || "v1.0");
    form.append("isLocked", String(input.kind === "mandated"));
    const res = await this.request<TemplateDto>(`/projects/${encodeURIComponent(projectId)}/templates`, { method: "POST", body: form });
    return { ...res.data, downloadUrl: this.getDownloadUrl(res.data.downloadUrl) };
  }

  async archiveTemplate(projectId: string, templateId: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/projects/${encodeURIComponent(projectId)}/templates/${encodeURIComponent(templateId)}`, { method: "DELETE" });
    return res.data.success;
  }

  /* ─────────── Project Knowledge / RAG ─────────── */
  async ingestKnowledgeDocument(projectId: string, input: { file: File; title?: string; documentType?: string }): Promise<KnowledgeDocumentDto> {
    const form = new FormData();
    form.append("file", input.file);
    form.append("title", input.title || input.file.name.replace(/\.[^.]+$/, ""));
    form.append("documentType", input.documentType || "project_document");
    const res = await this.request<KnowledgeDocumentDto>(`/projects/${encodeURIComponent(projectId)}/knowledge/ingest`, { method: "POST", body: form });
    return res.data;
  }

  async getKnowledgeDocuments(projectId: string): Promise<KnowledgeDocumentDto[]> {
    const res = await this.request<KnowledgeDocumentDto[]>(`/projects/${encodeURIComponent(projectId)}/knowledge/documents`);
    return res.data;
  }

  async askProjectKnowledge(projectId: string, question: string): Promise<RagAnswerDto> {
    const res = await this.request<RagAnswerDto>(`/projects/${encodeURIComponent(projectId)}/knowledge/ask`, {
      method: "POST",
      body: JSON.stringify({ question }),
    });
    return res.data;
  }

  async ingestOcrDocument(projectId: string, input: { file: File; title?: string; documentType?: string; languageCode?: string }): Promise<OcrJobDto> {
    const form = new FormData();
    form.append("file", input.file);
    form.append("title", input.title || input.file.name.replace(/\.[^.]+$/, ""));
    form.append("documentType", input.documentType || "ocr_scan");
    form.append("languageCode", input.languageCode || "fas+eng");
    const res = await this.request<OcrJobDto>(`/projects/${encodeURIComponent(projectId)}/ocr/ingest`, { method: "POST", body: form });
    return res.data;
  }

  async getOcrJobs(projectId: string): Promise<OcrJobDto[]> {
    const res = await this.request<OcrJobDto[]>(`/projects/${encodeURIComponent(projectId)}/ocr/jobs`);
    return res.data;
  }

  /* ─────────── Risks ─────────── */
  async getRisks(projectId: string): Promise<RiskDto[]> {
    const res = await this.request<RiskDto[]>(`/projects/${encodeURIComponent(projectId)}/risks`);
    return res.data;
  }

  async createRisk(projectId: string, dto: Omit<RiskDto, "id" | "projectId">): Promise<RiskDto> {
    const res = await this.request<RiskDto>(`/projects/${encodeURIComponent(projectId)}/risks`, {
      method: "POST",
      body: JSON.stringify(dto),
    });
    return res.data;
  }

  /* ─────────── Performance & EVM ─────────── */
  async getEvm(projectId: string): Promise<EvmDto[]> {
    const res = await this.request<EvmDto[]>(`/projects/${encodeURIComponent(projectId)}/evm`);
    return res.data;
  }

  /* ─────────── Portfolio Summary ─────────── */
  async getPortfolioSummary(): Promise<PortfolioSummaryDto> {
    const res = await this.request<PortfolioSummaryDto>("/portfolio/summary");
    return res.data;
  }

  /* ─────────── Schedule & WBS Import ─────────── */
  async importSchedule(projectId: string, payload: { sourceSystem: string; fileName: string; data?: unknown }): Promise<Record<string, unknown>> {
    const res = await this.request<Record<string, unknown>>(`/projects/${encodeURIComponent(projectId)}/schedule/import`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async uploadScheduleFile(projectId: string, file: File, sourceSystem?: string): Promise<Record<string, unknown>> {
    const form = new FormData();
    form.append("file", file);
    form.append("sourceSystem", sourceSystem || (file.name.toLowerCase().endsWith(".mpp") ? "msp" : file.name.toLowerCase().endsWith(".xer") ? "primavera" : "excel"));
    const res = await this.request<Record<string, unknown>>(`/projects/${encodeURIComponent(projectId)}/schedule/import`, {
      method: "POST",
      body: form,
    });
    return res.data;
  }

  async getWbs(projectId: string): Promise<WbsNodeDto[]> {
    const res = await this.request<WbsNodeDto[]>(`/projects/${encodeURIComponent(projectId)}/wbs`);
    return res.data;
  }

  async getScheduleActivities(projectId: string): Promise<ScheduleActivityDto[]> {
    const res = await this.request<ScheduleActivityDto[]>(`/projects/${encodeURIComponent(projectId)}/schedule/activities`);
    return res.data;
  }

  /* ─────────── AI Gateway (secure) ─────────── */
  async runAi(payload: { prompt: string; context?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const res = await this.request<Record<string, unknown>>("/ai/run", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.data;
  }
}

export const pmisApiClient = new PmisApiClient();
