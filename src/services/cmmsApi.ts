/**
 * کلاینت یکپارچهٔ سامانهٔ نگهداری و تعمیرات (cmms-api-v1).
 *
 * پوشش ۱۰۵ مسیر REST در `server/cmmsApi.js` با دامنهٔ سایت (`siteId`)،
 * هدر هویت (`x-user-id`) و قفل خوش‌بینانه (`If-Match`).
 *
 * این فایل هیچ قاعدهٔ کسب‌وکاری ندارد: هر عددی که نشان می‌دهد از سرور
 * می‌آید. سمت کلاینت فقط مجوز را پیش‌بینی می‌کند تا دکمهٔ بی‌اجازه
 * غیرفعال شود — تصمیم نهایی همیشه با سرور است.
 */

import { DEMO_SUBJECTS, evaluate, type Decision, type Subject } from "./accessControl";

export const DEFAULT_SITE_ID = "SITE-DEMO";

export const CMMS_DEMO_USERS: Array<{
  id: string;
  role: string;
  fa: string;
  en: string;
  clearance: string;
}> = [
  { id: "u-cmms-manager", role: "maintenance_manager", fa: "مدیر نت (آزادسازی/بستن دستورکار/تغییر همگانی)", en: "Maintenance Manager (Release/Close/Bulk)", clearance: "restricted" },
  { id: "u-cmms-planner", role: "maintenance_planner", fa: "برنامه‌ریز نت (دستورکار/زمان‌بندی PM)", en: "Maintenance Planner (WO/PM Scheduling)", clearance: "confidential" },
  { id: "u-cmms-reliability", role: "reliability_engineer", fa: "مهندس قابلیت اطمینان (FMEA/RCM/LCC)", en: "Reliability Engineer (FMEA/RCM/LCC)", clearance: "restricted" },
  { id: "u-cmms-engineer", role: "maintenance_engineer", fa: "مهندس نت (خانواده تجهیز/اتمام دستورکار)", en: "Maintenance Engineer (Family/Complete)", clearance: "confidential" },
  { id: "u-cmms-tech", role: "maintenance_technician", fa: "تکنسین نت (اجرا/ثبت نتیجه چک‌لیست)", en: "Maintenance Technician (Execute/Results)", clearance: "internal" },
  { id: "u-cmms-store", role: "maintenance_storekeeper", fa: "انباردار نت (رسید/حواله قطعات یدکی)", en: "Maintenance Storekeeper (Spare Parts)", clearance: "confidential" },
  { id: "u-cmms-cbm", role: "condition_monitoring_analyst", fa: "تحلیل‌گر پایش وضعیت (ارتعاش/آستانه‌ها)", en: "Condition Monitoring Analyst", clearance: "confidential" },
];

export function findCmmsSubject(userId?: string | null): Subject | null {
  if (!userId) return null;
  return DEMO_SUBJECTS.find((s) => s.id === userId) ?? null;
}

export function evaluateCmmsAccess(
  userId: string | null | undefined,
  permission: string,
  siteId: string = DEFAULT_SITE_ID,
): Decision {
  const subject = findCmmsSubject(userId);
  if (!subject) {
    return {
      allow: false,
      code: "DENY_INACTIVE",
      reason: { fa: "کاربر احراز هویت نشده است", en: "Unauthenticated user" },
      audit: true,
    };
  }
  return evaluate(subject, permission, { plantId: siteId });
}

export function canCmmsAccess(
  userId: string | null | undefined,
  permission: string,
  siteId: string = DEFAULT_SITE_ID,
): boolean {
  return evaluateCmmsAccess(userId, permission, siteId).allow;
}

export interface CmmsApiError {
  code: string;
  message: string;
  traceId?: string;
  status: number;
}

export class CmmsRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId?: string;

  constructor(err: CmmsApiError) {
    super(err.message || err.code);
    this.name = "CmmsRequestError";
    this.code = err.code;
    this.status = err.status;
    this.traceId = err.traceId;
  }
}

export interface CmmsRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  userId?: string | null;
  ifMatch?: number | string | null;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(siteId: string, subPath: string, query?: CmmsRequestOptions["query"]): string {
  const base = `/api/cmms/sites/${encodeURIComponent(siteId)}${subPath}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function cmmsFetch<T = any>(
  siteId: string,
  subPath: string,
  opts: CmmsRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.userId) headers["x-user-id"] = opts.userId;
  if (opts.ifMatch !== undefined && opts.ifMatch !== null && String(opts.ifMatch).trim() !== "") {
    headers["If-Match"] = String(opts.ifMatch);
  }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(buildUrl(siteId, subPath, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.ok === false) {
    const errObj = payload?.error ?? {};
    throw new CmmsRequestError({
      code: errObj.code || `HTTP_${res.status}`,
      message: errObj.message || `خطای ارتباط با سرور (${res.status})`,
      traceId: errObj.traceId,
      status: res.status,
    });
  }
  return payload.data as T;
}

/* ═══════════════════════ انواع ردیف‌ها ═══════════════════════ */

export interface CmmsListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type CmmsCriticalityRank = "A" | "B" | "C" | "D";

export interface CmmsSite {
  Id: string;
  SiteId: string;
  NameFa: string;
  NameEn?: string | null;
  RowVersion: number;
}

export interface CmmsFamily {
  Id: string;
  SiteId: string;
  FamilyGroupId: string;
  FamilyCode: string;
  NameFa: string;
  CriticalityRank: CmmsCriticalityRank;
  Status: "draft" | "approved" | "active" | "retired";
  Version: number;
  RowVersion: number;
}

export interface CmmsAsset {
  Id: string;
  SiteId: string;
  FamilyId: string;
  AssetTag: string;
  NameFa: string;
  ParentAssetId?: string | null;
  LocationId?: string | null;
  AssetState: string;
  CriticalityRank: CmmsCriticalityRank;
  IsActive: boolean;
  RowVersion: number;
}

export type CmmsWorkOrderStatus =
  | "draft" | "planned" | "scheduled" | "released"
  | "in-progress" | "on-hold" | "completed" | "closed" | "cancelled";

export interface CmmsWorkOrder {
  Id: string;
  SiteId: string;
  WorkOrderNo: string;
  WorkOrderType: string;
  AssetId?: string | null;
  TitleFa: string;
  Priority: number;
  Status: CmmsWorkOrderStatus;
  IsAssetDown: boolean;
  ProductionImpact: "none" | "partial" | "line-stop" | "plant-stop";
  ActualHours?: number | null;
  ActualCost?: number | null;
  RowVersion: number;
}

export interface CmmsWorkOrderTask {
  Id: string;
  WorkOrderId: string;
  LineNo: number;
  DescriptionFa: string;
  ResultStatus: "pending" | "pass" | "fail" | "na" | "deferred";
  MeasuredValueNumber?: number | null;
  FindingFa?: string | null;
  RowVersion: number;
}

export interface CmmsWorkOrderDetail {
  workOrder: CmmsWorkOrder;
  tasks: CmmsWorkOrderTask[];
  labor: any[];
  materials: any[];
  costs: any[];
  totals: Record<string, number> & { total: number; actualHours: number };
}

export interface CmmsSparePart {
  Id: string;
  SiteId: string;
  PartNumber: string;
  NameFa: string;
  Category: string;
  QtyOnHand: number;
  MinStock?: number | null;
  ReorderPoint?: number | null;
  RowVersion: number;
}

export interface CmmsTreeNode {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  depth: number;
  pathCode: string;
  children?: CmmsTreeNode[];
}

export interface CmmsFamilyTree {
  nodes: CmmsTreeNode[];
  roots: CmmsTreeNode[];
  maxDepth: number;
  cycleMembers: string[];
}

export interface CmmsDashboard {
  counts: {
    assets: number;
    families: number;
    criticalAssets: number;
    workOrders: number;
    openAlerts: number;
    failures: number;
    spareParts: number;
    proposedAiRecommendations: number;
  };
  workOrdersByStatus: Record<string, number>;
  openAlertsBySeverity: Record<string, number>;
  failuresByMode: Record<string, number>;
  spares: { outOfStock: number; belowReorder: number };
  highlights: {
    latestAvailabilityPct: number | null;
    latestMtbfHours: number | null;
    latestMttrHours: number | null;
    averageOeePct: number | null;
  };
  modelVersion: string;
}

/* ═══════════════════════ کلاینت ═══════════════════════ */

export const CmmsClient = {
  /* ── سایت و مکان ── */
  /* فهرست سایت‌ها تنها مسیری است که زیر ریشهٔ سایت‌محور نیست؛ چون پیش از آنکه
   * بدانیم در کدام سایت هستیم فراخوانی می‌شود. سرور خودش پاسخ را به دامنهٔ
   * کاربر محدود می‌کند. */
  listSites: async (userId?: string | null): Promise<{ sites: CmmsSite[]; total: number }> => {
    const res = await fetch("/api/cmms/sites", {
      headers: userId
        ? { Accept: "application/json", "x-user-id": userId }
        : { Accept: "application/json" },
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload || payload.ok === false) {
      throw new CmmsRequestError({
        code: payload?.error?.code || `HTTP_${res.status}`,
        message: payload?.error?.message || `خطای ارتباط با سرور (${res.status})`,
        status: res.status,
      });
    }
    return payload.data as { sites: CmmsSite[]; total: number };
  },

  listLocations: (siteId: string, userId?: string | null, query?: { level?: number; q?: string }) =>
    cmmsFetch<{ locations: any[]; total: number }>(siteId, "/locations", { userId, query }),

  getLocationTree: (siteId: string, userId?: string | null) =>
    cmmsFetch<{ tree: CmmsTreeNode[]; roots: CmmsTreeNode[]; maxDepth: number }>(siteId, "/locations/tree", { userId }),

  /* ── خانوادهٔ تجهیز ── */
  listFamilyGroups: (siteId: string, userId?: string | null) =>
    cmmsFetch<{ groups: any[]; total: number }>(siteId, "/family-groups", { userId }),

  createFamilyGroup: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/family-groups", { method: "POST", userId, body }),

  listFamilies: (siteId: string, userId?: string | null, query?: { status?: string; q?: string }) =>
    cmmsFetch<{ families: CmmsFamily[]; total: number }>(siteId, "/families", { userId, query }),

  createFamily: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<CmmsFamily>(siteId, "/families", { method: "POST", userId, body }),

  getFamily: (siteId: string, userId: string | null | undefined, familyId: string) =>
    cmmsFetch<CmmsFamily>(siteId, `/families/${encodeURIComponent(familyId)}`, { userId }),

  approveFamily: (siteId: string, userId: string | null | undefined, familyId: string) =>
    cmmsFetch<CmmsFamily>(siteId, `/families/${encodeURIComponent(familyId)}/approve`, { method: "POST", userId, body: {} }),

  getFamilyNodes: (siteId: string, userId: string | null | undefined, familyId: string) =>
    cmmsFetch<CmmsFamilyTree>(siteId, `/families/${encodeURIComponent(familyId)}/nodes`, { userId }),

  createFamilyNode: (siteId: string, userId: string | null | undefined, familyId: string, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, `/families/${encodeURIComponent(familyId)}/nodes`, { method: "POST", userId, body }),

  listFailureModes: (siteId: string, userId?: string | null, familyId?: string) =>
    cmmsFetch<{ modes: any[]; total: number }>(siteId, `/families/${encodeURIComponent(familyId ?? "")}/failure-modes`, { userId }),

  listPmTasks: (siteId: string, userId?: string | null, familyId?: string) =>
    cmmsFetch<{ tasks: any[]; total: number }>(siteId, `/families/${encodeURIComponent(familyId ?? "")}/pm-tasks`, { userId }),

  /* ── تجهیز و دارایی ── */
  listAssets: (siteId: string, userId?: string | null, query?: { familyId?: string; assetState?: string; criticalityRank?: CmmsCriticalityRank; q?: string; limit?: number; offset?: number }) =>
    cmmsFetch<{ assets: CmmsAsset[]; total: number; limit: number; offset: number }>(siteId, "/assets", { userId, query }),

  getAssetTree: (siteId: string, userId?: string | null) =>
    cmmsFetch<{ tree: CmmsTreeNode[]; roots: CmmsTreeNode[]; maxDepth: number; orphans: string[] }>(siteId, "/assets/tree", { userId }),

  createAsset: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<CmmsAsset>(siteId, "/assets", { method: "POST", userId, body }),

  patchAsset: (siteId: string, userId: string | null | undefined, assetId: string, ifMatch: number, body: Record<string, unknown>) =>
    cmmsFetch<CmmsAsset>(siteId, `/assets/${encodeURIComponent(assetId)}`, { method: "PATCH", userId, ifMatch, body }),

  getAsset: (siteId: string, userId: string | null | undefined, assetId: string) =>
    cmmsFetch<any>(siteId, `/assets/${encodeURIComponent(assetId)}`, { userId }),

  /* ── درخواست‌کار و دستورکار ── */
  listWorkRequests: (siteId: string, userId?: string | null, query?: { status?: string; assetId?: string }) =>
    cmmsFetch<{ requests: any[]; total: number }>(siteId, "/work-requests", { userId, query }),

  createWorkRequest: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/work-requests", { method: "POST", userId, body }),

  listWorkOrders: (siteId: string, userId?: string | null, query?: { status?: CmmsWorkOrderStatus; workOrderType?: string; assetId?: string; limit?: number; offset?: number }) =>
    cmmsFetch<{ workOrders: CmmsWorkOrder[]; total: number; limit: number; offset: number }>(siteId, "/work-orders", { userId, query }),

  createWorkOrder: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<CmmsWorkOrder>(siteId, "/work-orders", { method: "POST", userId, body }),

  getWorkOrder: (siteId: string, userId: string | null | undefined, workOrderId: string) =>
    cmmsFetch<CmmsWorkOrderDetail>(siteId, `/work-orders/${encodeURIComponent(workOrderId)}`, { userId }),

  releaseWorkOrder: (siteId: string, userId: string | null | undefined, workOrderId: string) =>
    cmmsFetch<CmmsWorkOrder>(siteId, `/work-orders/${encodeURIComponent(workOrderId)}/release`, { method: "POST", userId, body: {} }),

  startWorkOrder: (siteId: string, userId: string | null | undefined, workOrderId: string) =>
    cmmsFetch<CmmsWorkOrder>(siteId, `/work-orders/${encodeURIComponent(workOrderId)}/start`, { method: "POST", userId, body: {} }),

  completeWorkOrder: (siteId: string, userId: string | null | undefined, workOrderId: string) =>
    cmmsFetch<CmmsWorkOrder>(siteId, `/work-orders/${encodeURIComponent(workOrderId)}/complete`, { method: "POST", userId, body: {} }),

  closeWorkOrder: (siteId: string, userId: string | null | undefined, workOrderId: string) =>
    cmmsFetch<CmmsWorkOrder>(siteId, `/work-orders/${encodeURIComponent(workOrderId)}/close`, { method: "POST", userId, body: {} }),

  addWorkOrderTask: (siteId: string, userId: string | null | undefined, workOrderId: string, body: Record<string, unknown>) =>
    cmmsFetch<CmmsWorkOrderTask>(siteId, `/work-orders/${encodeURIComponent(workOrderId)}/tasks`, { method: "POST", userId, body }),

  recordTaskResult: (siteId: string, userId: string | null | undefined, workOrderId: string, taskId: string, body: Record<string, unknown>) =>
    cmmsFetch<CmmsWorkOrderTask>(siteId, `/work-orders/${encodeURIComponent(workOrderId)}/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", userId, body }),

  postLabor: (siteId: string, userId: string | null | undefined, workOrderId: string, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, `/work-orders/${encodeURIComponent(workOrderId)}/labor`, { method: "POST", userId, body }),

  postCost: (siteId: string, userId: string | null | undefined, workOrderId: string, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, `/work-orders/${encodeURIComponent(workOrderId)}/costs`, { method: "POST", userId, body }),

  /* ── خرابی، توقف و پایش وضعیت ── */
  listFailures: (siteId: string, userId?: string | null, query?: { assetId?: string; failureMode?: string }) =>
    cmmsFetch<{ failures: any[]; total: number }>(siteId, "/failures", { userId, query }),

  reportFailure: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/failures", { method: "POST", userId, body }),

  reportDowntime: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/downtime", { method: "POST", userId, body }),

  postConditionReading: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/condition-readings", { method: "POST", userId, body }),

  /* ── انبار قطعات یدکی ── */
  listSpareParts: (siteId: string, userId?: string | null, query?: { category?: string; q?: string; belowReorder?: boolean }) =>
    cmmsFetch<{ parts: CmmsSparePart[]; total: number }>(siteId, "/spare-parts", { userId, query }),

  createSparePart: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<CmmsSparePart>(siteId, "/spare-parts", { method: "POST", userId, body }),

  postSpareTransaction: (siteId: string, userId: string | null | undefined, partId: string, body: Record<string, unknown>) =>
    cmmsFetch<{ transaction: any; qtyOnHand: number }>(siteId, `/spare-parts/${encodeURIComponent(partId)}/transactions`, { method: "POST", userId, body }),

  /* ── منابع انسانی ── */
  listTechnicians: (siteId: string, userId?: string | null) =>
    cmmsFetch<{ technicians: any[]; total: number }>(siteId, "/technicians", { userId }),

  createTechnician: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/technicians", { method: "POST", userId, body }),

  /* ── محاسبهٔ استانداردها ── */
  computeReliability: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<{ result: any; persisted: any }>(siteId, "/reliability/compute", { method: "POST", userId, body }),

  computeOee: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<{ result: any; persisted: any }>(siteId, "/oee/compute", { method: "POST", userId, body }),

  computeSupplyReliability: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<{ result: any; persisted: any }>(siteId, "/supply-reliability/compute", { method: "POST", userId, body }),

  computeLcc: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<{ result: any; persisted: any }>(siteId, "/lcc/compute", { method: "POST", userId, body }),

  /* ── شاخص‌ها و هشدارها ── */
  listKpiTargets: (siteId: string, userId?: string | null) =>
    cmmsFetch<{ targets: any[]; total: number }>(siteId, "/kpi-targets", { userId }),

  listAlerts: (siteId: string, userId?: string | null, query?: { status?: string; severity?: string }) =>
    cmmsFetch<{ alerts: any[]; total: number }>(siteId, "/alerts", { userId, query }),

  acknowledgeAlert: (siteId: string, userId: string | null | undefined, alertId: string) =>
    cmmsFetch<any>(siteId, `/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: "POST", userId, body: {} }),

  /* ── هوش مصنوعی ── */
  analyzeFailure: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/ai/failure-analysis", { method: "POST", userId, body }),

  optimizePm: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/ai/pm-optimization", { method: "POST", userId, body }),

  recommendRepair: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/ai/repair-guidance", { method: "POST", userId, body }),

  generateTree: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/ai/tree-generator", { method: "POST", userId, body }),

  scheduleWorkOrders: (siteId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, "/ai/smart-scheduler", { method: "POST", userId, body }),

  listRecommendations: (siteId: string, userId?: string | null, query?: { engine?: string; status?: string }) =>
    cmmsFetch<{ recommendations: any[]; total: number }>(siteId, "/ai/recommendations", { userId, query }),

  decideRecommendation: (siteId: string, userId: string | null | undefined, recommendationId: string, body: Record<string, unknown>) =>
    cmmsFetch<any>(siteId, `/ai/recommendations/${encodeURIComponent(recommendationId)}/decide`, { method: "POST", userId, body }),

  /* ── داشبورد ── */
  getDashboard: (siteId: string, userId?: string | null) =>
    cmmsFetch<CmmsDashboard>(siteId, "/dashboard", { userId }),
};
