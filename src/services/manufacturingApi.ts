/**
 * کلاینت یکپارچهٔ ماژول تولید عملیات‌محور (mfg-api-v1)
 * پوشش کامل ۶۵ مسیر REST API قرارداد `docs/manufacturing-api.md` (بخش‌های ۵.۳ تا ۵.۸)
 * با پشتیبانی از دامنهٔ کارخانه (`plantId`)، هدر هویت (`x-user-id`)، و قفل خوش‌بینانه (`If-Match`).
 */

import {
  DEMO_SUBJECTS,
  evaluate,
  type Decision,
  type Subject,
} from "./accessControl";
import type { DispatchRule } from "./manufacturingModel";

export const DEFAULT_PLANT_ID = "PLANT-DEMO";

export const MFG_DEMO_USERS: Array<{
  id: string;
  role: string;
  fa: string;
  en: string;
  clearance: string;
}> = [
  { id: "u-mfg-eng", role: "manufacturing_engineer", fa: "مهندس ساخت (قطعه/BOM/مسیر/تقویم)", en: "Manufacturing Engineer (Master Data)", clearance: "restricted" },
  { id: "u-mfg-plan", role: "production_planner", fa: "برنامه‌ریز تولید (سفارش/زمان‌بندی/MRP)", en: "Production Planner (Orders/Sched/MRP)", clearance: "confidential" },
  { id: "u-mfg-manager", role: "production_manager", fa: "مدیر تولید (آزادسازی/بستن سفارش/هشدار)", en: "Production Manager (Release/Close/Alerts)", clearance: "restricted" },
  { id: "u-mfg-supervisor", role: "shop_floor_supervisor", fa: "سرپرست سالن (اجرای عملیات/ضایعات/توقف)", en: "Shop-floor Supervisor (Execution/Scrap)", clearance: "confidential" },
  { id: "u-mfg-operator", role: "production_operator", fa: "اپراتور تولید (ثبت پیشرفت/توقف)", en: "Production Operator (Progress/Downtime)", clearance: "internal" },
  { id: "u-mfg-material", role: "material_planner", fa: "برنامه‌ریز مواد (موجودی/MRP/تأمین)", en: "Material Planner (Inventory/MRP)", clearance: "confidential" },
  { id: "u-mfg-cost", role: "industrial_accountant", fa: "حسابدار صنعتی (بهای تمام‌شده/تطبیق)", en: "Industrial Accountant (Costing)", clearance: "restricted" },
];

export function findMfgSubject(userId?: string | null): Subject | null {
  if (!userId) return null;
  return DEMO_SUBJECTS.find((s) => s.id === userId) ?? null;
}

export function evaluateMfgAccess(
  userId: string | null | undefined,
  permission: string,
  plantId: string = DEFAULT_PLANT_ID,
): Decision {
  const subject = findMfgSubject(userId);
  if (!subject) {
    return {
      allow: false,
      code: "DENY_INACTIVE",
      reason: { fa: "کاربر احراز هویت نشده است", en: "Unauthenticated user" },
      audit: true,
    };
  }
  return evaluate(subject, permission, { plantId });
}

export function canMfgAccess(
  userId: string | null | undefined,
  permission: string,
  plantId: string = DEFAULT_PLANT_ID,
): boolean {
  return evaluateMfgAccess(userId, permission, plantId).allow;
}

export interface MfgApiError {
  code: string;
  message: string;
  traceId?: string;
  status: number;
}

export class MfgRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId?: string;

  constructor(err: MfgApiError) {
    super(err.message || err.code);
    this.name = "MfgRequestError";
    this.code = err.code;
    this.status = err.status;
    this.traceId = err.traceId;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  userId?: string | null;
  ifMatch?: number | string | null;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(plantId: string, subPath: string, query?: RequestOptions["query"]): string {
  const base = `/api/mfg/plants/${encodeURIComponent(plantId)}${subPath}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function mfgFetch<T = any>(
  plantId: string,
  subPath: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.userId) {
    headers["x-user-id"] = opts.userId;
  }
  if (opts.ifMatch !== undefined && opts.ifMatch !== null && String(opts.ifMatch).trim() !== "") {
    headers["If-Match"] = String(opts.ifMatch);
  }
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(buildUrl(plantId, subPath, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.ok === false) {
    const errObj = payload?.error ?? {};
    throw new MfgRequestError({
      code: errObj.code || `HTTP_${res.status}`,
      message: errObj.message || `خطای ارتباط با سرور (${res.status})`,
      traceId: errObj.traceId,
      status: res.status,
    });
  }
  return payload.data as T;
}

/* ═══════════════════════════ انواع داده‌ای کلیدی ═══════════════════════════ */

export interface MfgPart {
  Id: string;
  PlantId: string;
  PartCode: string;
  PartName: string;
  PartType: "RAW" | "SEMI" | "FINISHED";
  Uom: string;
  StandardCost: number;
  SafetyStockQty: number;
  LeadTimeDays: number;
  LotSizingPolicy: string;
  MinimumLotQty: number;
  Active: number;
  RowVersion: number;
  CreatedAt: string;
}

export interface MfgBomHeader {
  Id: string;
  PlantId: string;
  PartId: string;
  BomCode: string;
  Revision: string;
  Status: "DRAFT" | "RELEASED" | "OBSOLETE";
  BaseQuantity: number;
  EffectiveFrom?: string | null;
  EffectiveTo?: string | null;
  ReleasedBy?: string | null;
  ReleasedAt?: string | null;
  RowVersion: number;
  CreatedAt: string;
}

export interface MfgBomItem {
  Id: string;
  PlantId: string;
  BomId: string;
  LineNo: number;
  ComponentPartId: string;
  QuantityPer: number;
  ScrapFactorPct: number;
  OperationSeq?: number | null;
  IssueMethod: "BACKFLUSH" | "MANUAL";
  OptionalFlag: number;
  RowVersion: number;
}

export interface MfgRouting {
  Id: string;
  PlantId: string;
  PartId: string;
  RoutingCode: string;
  Revision: string;
  Status: "DRAFT" | "RELEASED" | "OBSOLETE";
  EffectiveFrom?: string | null;
  EffectiveTo?: string | null;
  ReleasedBy?: string | null;
  ReleasedAt?: string | null;
  RowVersion: number;
  CreatedAt: string;
}

export interface MfgRoutingOperation {
  Id: string;
  PlantId: string;
  RoutingId: string;
  OperationSeq: number;
  OperationCode: string;
  OperationName: string;
  WorkCenterId: string;
  SetupMinutes: number;
  RunMinutesPerUnit: number;
  MoveMinutes: number;
  QueueMinutes: number;
  OverlapPct: number;
  YieldPct: number;
  RowVersion: number;
}

export interface MfgWorkCenter {
  Id: string;
  PlantId: string;
  WorkCenterCode: string;
  WorkCenterName: string;
  CapacityUnits: number;
  EfficiencyPct: number;
  UtilizationTargetPct: number;
  StandardHourlyRate: number;
  OverheadHourlyRate: number;
  Status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  RowVersion: number;
}

export interface MfgWorkCenterResource {
  Id: string;
  PlantId: string;
  WorkCenterId: string;
  ResourceCode: string;
  ResourceName: string;
  ResourceType: "MACHINE" | "LABOR" | "TOOL";
  Status: "AVAILABLE" | "BUSY" | "DOWN" | "INACTIVE";
  CapacityFactor: number;
  RowVersion: number;
}

export interface MfgWorkCenterCalendar {
  Id: string;
  PlantId: string;
  WorkCenterId: string;
  CalendarDate: string;
  ShiftCode: string;
  StartMinuteOfDay: number;
  EndMinuteOfDay: number;
  BreakStartMinuteOfDay: number;
  BreakMinutes: number;
  AvailableCapacityFactor: number;
  WorkingDay: number;
  RowVersion: number;
}

export interface MfgProductionOrder {
  Id: string;
  PlantId: string;
  ProjectId?: string | null;
  OrderNo: string;
  PartId: string;
  BomId: string;
  RoutingId: string;
  Status: "DRAFT" | "RELEASED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED";
  QuantityOrdered: number;
  QuantityCompleted: number;
  QuantityScrapped: number;
  Priority: number;
  DispatchWeight: number;
  PlannedStartAt?: string | null;
  PlannedEndAt?: string | null;
  DueDate: string;
  LotCode?: string | null;
  ReleasedBy?: string | null;
  ReleasedAt?: string | null;
  ClosedBy?: string | null;
  ClosedAt?: string | null;
  RowVersion: number;
  CreatedAt: string;
}

export interface MfgOrderOperation {
  Id: string;
  PlantId: string;
  ProductionOrderId: string;
  RoutingOperationId?: string | null;
  OperationSeq: number;
  OperationCode: string;
  OperationName: string;
  WorkCenterId: string;
  Status: "PENDING" | "READY" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "HOLD" | "CANCELLED";
  PlannedSetupMinutes: number;
  PlannedRunMinutes: number;
  PlannedStartAt?: string | null;
  PlannedEndAt?: string | null;
  ActualSetupMinutes: number;
  ActualRunMinutes: number;
  ActualStartAt?: string | null;
  ActualEndAt?: string | null;
  QuantityTarget: number;
  QuantityGood: number;
  QuantityScrap: number;
  QuantityRework: number;
  QueuePosition?: number | null;
  DispatchRule?: string | null;
  RowVersion: number;
}

/* ═══════════════════════════ کلاینت ۶۵ مسیر REST ═══════════════════════════ */

export const MfgClient = {
  /* ── ۵.۳ داده‌های پایه: قطعه و BOM (۱۴ مسیر) ── */
  listParts: (plantId: string, userId?: string | null, query?: { partType?: string; active?: string; q?: string }) =>
    mfgFetch<{ items: MfgPart[]; total: number }>(plantId, "/parts", { userId, query }),

  createPart: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<MfgPart>(plantId, "/parts", { method: "POST", userId, body }),

  getPart: (plantId: string, userId: string | null | undefined, partId: string) =>
    mfgFetch<MfgPart>(plantId, `/parts/${encodeURIComponent(partId)}`, { userId }),

  patchPart: (plantId: string, userId: string | null | undefined, partId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgPart>(plantId, `/parts/${encodeURIComponent(partId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  listBomHeaders: (plantId: string, userId?: string | null, query?: { partId?: string; status?: string }) =>
    mfgFetch<{ items: MfgBomHeader[]; total: number }>(plantId, "/bom-headers", { userId, query }),

  createBomHeader: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<MfgBomHeader>(plantId, "/bom-headers", { method: "POST", userId, body }),

  getBomHeader: (plantId: string, userId: string | null | undefined, bomId: string) =>
    mfgFetch<{ header: MfgBomHeader; items: MfgBomItem[] }>(plantId, `/bom-headers/${encodeURIComponent(bomId)}`, { userId }),

  patchBomHeader: (plantId: string, userId: string | null | undefined, bomId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgBomHeader>(plantId, `/bom-headers/${encodeURIComponent(bomId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  listBomItems: (plantId: string, userId: string | null | undefined, bomId: string) =>
    mfgFetch<{ items: MfgBomItem[]; total: number }>(plantId, `/bom-headers/${encodeURIComponent(bomId)}/items`, { userId }),

  createBomItem: (plantId: string, userId: string | null | undefined, bomId: string, body: Record<string, unknown>) =>
    mfgFetch<MfgBomItem>(plantId, `/bom-headers/${encodeURIComponent(bomId)}/items`, { method: "POST", userId, body }),

  patchBomItem: (plantId: string, userId: string | null | undefined, itemId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgBomItem>(plantId, `/bom-items/${encodeURIComponent(itemId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  deleteBomItem: (plantId: string, userId: string | null | undefined, itemId: string, rowVersion?: number) =>
    mfgFetch<{ deleted: boolean; Id: string }>(plantId, `/bom-items/${encodeURIComponent(itemId)}`, { method: "DELETE", userId, ifMatch: rowVersion }),

  releaseBom: (plantId: string, userId: string | null | undefined, bomId: string) =>
    mfgFetch<MfgBomHeader>(plantId, `/bom-headers/${encodeURIComponent(bomId)}/release`, { method: "POST", userId, body: {} }),

  explodeBom: (plantId: string, userId: string | null | undefined, bomId: string, body: { requiredQuantity?: number; maxLevels?: number } = {}) =>
    mfgFetch<{
      bomId: string;
      parentPartId: string;
      requiredQuantity: number;
      requirements: Array<{
        level: number;
        parentBomId: string;
        parentPartId: string;
        componentPartId: string;
        componentPartCode?: string;
        componentPartName?: string;
        lineNo: number;
        quantityPer: number;
        scrapFactorPct: number;
        netQuantity: number;
        grossQuantity: number;
        issueMethod: string;
      }>;
    }>(plantId, `/bom-headers/${encodeURIComponent(bomId)}/explosions`, { method: "POST", userId, body }),

  /* ── ۵.۳ داده‌های پایه: مسیر ساخت و عملیات (۹ مسیر) ── */
  listRoutings: (plantId: string, userId?: string | null, query?: { partId?: string; status?: string }) =>
    mfgFetch<{ items: MfgRouting[]; total: number }>(plantId, "/routings", { userId, query }),

  createRouting: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<MfgRouting>(plantId, "/routings", { method: "POST", userId, body }),

  getRouting: (plantId: string, userId: string | null | undefined, routingId: string) =>
    mfgFetch<{ routing: MfgRouting; operations: MfgRoutingOperation[] }>(plantId, `/routings/${encodeURIComponent(routingId)}`, { userId }),

  patchRouting: (plantId: string, userId: string | null | undefined, routingId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgRouting>(plantId, `/routings/${encodeURIComponent(routingId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  listRoutingOperations: (plantId: string, userId: string | null | undefined, routingId: string) =>
    mfgFetch<{ items: MfgRoutingOperation[]; total: number }>(plantId, `/routings/${encodeURIComponent(routingId)}/operations`, { userId }),

  createRoutingOperation: (plantId: string, userId: string | null | undefined, routingId: string, body: Record<string, unknown>) =>
    mfgFetch<MfgRoutingOperation>(plantId, `/routings/${encodeURIComponent(routingId)}/operations`, { method: "POST", userId, body }),

  patchRoutingOperation: (plantId: string, userId: string | null | undefined, routingOperationId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgRoutingOperation>(plantId, `/routing-operations/${encodeURIComponent(routingOperationId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  deleteRoutingOperation: (plantId: string, userId: string | null | undefined, routingOperationId: string, rowVersion?: number) =>
    mfgFetch<{ deleted: boolean; Id: string }>(plantId, `/routing-operations/${encodeURIComponent(routingOperationId)}`, { method: "DELETE", userId, ifMatch: rowVersion }),

  releaseRouting: (plantId: string, userId: string | null | undefined, routingId: string) =>
    mfgFetch<MfgRouting>(plantId, `/routings/${encodeURIComponent(routingId)}/release`, { method: "POST", userId, body: {} }),

  /* ── ۵.۳ داده‌های پایه: مراکز کاری، منابع و تقویم (۱۰ مسیر) ── */
  listWorkCenters: (plantId: string, userId?: string | null, query?: { status?: string }) =>
    mfgFetch<{ items: MfgWorkCenter[]; total: number }>(plantId, "/work-centers", { userId, query }),

  createWorkCenter: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenter>(plantId, "/work-centers", { method: "POST", userId, body }),

  getWorkCenter: (plantId: string, userId: string | null | undefined, workCenterId: string) =>
    mfgFetch<{ workCenter: MfgWorkCenter; resources: MfgWorkCenterResource[]; calendars: MfgWorkCenterCalendar[] }>(
      plantId,
      `/work-centers/${encodeURIComponent(workCenterId)}`,
      { userId },
    ),

  patchWorkCenter: (plantId: string, userId: string | null | undefined, workCenterId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenter>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  listWorkCenterResources: (plantId: string, userId: string | null | undefined, workCenterId: string) =>
    mfgFetch<{ items: MfgWorkCenterResource[]; total: number }>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}/resources`, { userId }),

  createWorkCenterResource: (plantId: string, userId: string | null | undefined, workCenterId: string, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenterResource>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}/resources`, { method: "POST", userId, body }),

  patchWorkCenterResource: (plantId: string, userId: string | null | undefined, resourceId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenterResource>(plantId, `/work-center-resources/${encodeURIComponent(resourceId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  listWorkCenterCalendars: (plantId: string, userId: string | null | undefined, workCenterId: string) =>
    mfgFetch<{ items: MfgWorkCenterCalendar[]; total: number }>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}/calendars`, { userId }),

  createWorkCenterCalendar: (plantId: string, userId: string | null | undefined, workCenterId: string, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenterCalendar>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}/calendars`, { method: "POST", userId, body }),

  patchWorkCenterCalendar: (plantId: string, userId: string | null | undefined, calendarId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenterCalendar>(plantId, `/work-center-calendars/${encodeURIComponent(calendarId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  /* ── ۵.۴ سفارش‌های تولید (۶ مسیر) ── */
  listOrders: (plantId: string, userId?: string | null, query?: { status?: string; partId?: string }) =>
    mfgFetch<{ items: MfgProductionOrder[]; total: number }>(plantId, "/orders", { userId, query }),

  createOrder: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<MfgProductionOrder>(plantId, "/orders", { method: "POST", userId, body }),

  getOrder: (plantId: string, userId: string | null | undefined, orderId: string) =>
    mfgFetch<{ order: MfgProductionOrder; operations: MfgOrderOperation[]; materialAllocations: any[]; lots: any[] }>(
      plantId,
      `/orders/${encodeURIComponent(orderId)}`,
      { userId },
    ),

  reprioritizeOrder: (plantId: string, userId: string | null | undefined, orderId: string, rowVersion: number, body: { priority?: number; dispatchWeight?: number; dueDate?: string }) =>
    mfgFetch<MfgProductionOrder>(plantId, `/orders/${encodeURIComponent(orderId)}/priority`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  releaseOrder: (plantId: string, userId: string | null | undefined, orderId: string, body: Record<string, unknown> = {}) =>
    mfgFetch<{ order: MfgProductionOrder; operations: MfgOrderOperation[]; materialRequirements: any[]; lot?: any }>(
      plantId,
      `/orders/${encodeURIComponent(orderId)}/release`,
      { method: "POST", userId, body },
    ),

  closeOrder: (plantId: string, userId: string | null | undefined, orderId: string, body: Record<string, unknown> = {}) =>
    mfgFetch<MfgProductionOrder>(plantId, `/orders/${encodeURIComponent(orderId)}/close`, { method: "POST", userId, body }),

  /* ── ۵.۵ زمان‌بندی، باززمان‌بندی، گانت و ظرفیت (۵ مسیر) ── */
  runSchedule: (
    plantId: string,
    userId: string | null | undefined,
    body: { dispatchRule: DispatchRule; horizonStart: string; horizonEnd: string; publish?: boolean },
  ) => mfgFetch<any>(plantId, "/scheduling/runs", { method: "POST", userId, body }),

  reschedule: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      dispatchRule?: DispatchRule;
      horizonStart: string;
      horizonEnd: string;
      manualOrderIds?: string[];
      selectedOperationIds?: string[];
      publish?: boolean;
    },
  ) => mfgFetch<any>(plantId, "/scheduling/reschedules", { method: "POST", userId, body }),

  getGantt: (plantId: string, userId?: string | null, query?: { runId?: string; workCenterId?: string }) =>
    mfgFetch<{ runId: string | null; bars: any[]; total: number }>(plantId, "/scheduling/gantt", { userId, query }),

  getCapacityLoad: (plantId: string, userId?: string | null, query?: { workCenterId?: string }) =>
    mfgFetch<{ items: any[]; total: number }>(plantId, "/capacity/load", { userId, query }),

  getCapacityBottlenecks: (plantId: string, userId?: string | null, query?: { thresholdPct?: number }) =>
    mfgFetch<{ items: any[]; total: number }>(plantId, "/capacity/bottlenecks", { userId, query }),

  /* ── ۵.۶ اجرای کارگاهی، توقف، ضایعات، دوباره‌کاری و انحراف (۸ مسیر) ── */
  getOperationQueue: (plantId: string, userId?: string | null, query?: { workCenterId?: string; status?: string }) =>
    mfgFetch<{ items: MfgOrderOperation[]; total: number }>(plantId, "/operation-queue", { userId, query }),

  startExecution: (plantId: string, userId: string | null | undefined, operationId: string, body: Record<string, unknown>) =>
    mfgFetch<{ execution: any; operation: MfgOrderOperation }>(
      plantId,
      `/operations/${encodeURIComponent(operationId)}/executions`,
      { method: "POST", userId, body },
    ),

  reportExecution: (plantId: string, userId: string | null | undefined, executionId: string, body: Record<string, unknown>) =>
    mfgFetch<{ execution: any; operation: MfgOrderOperation }>(
      plantId,
      `/executions/${encodeURIComponent(executionId)}/reports`,
      { method: "POST", userId, body },
    ),

  finishExecution: (plantId: string, userId: string | null | undefined, executionId: string, body: Record<string, unknown> = {}) =>
    mfgFetch<{ execution: any; operation: MfgOrderOperation; order?: MfgProductionOrder }>(
      plantId,
      `/executions/${encodeURIComponent(executionId)}/finish`,
      { method: "POST", userId, body },
    ),

  reportDowntime: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<any>(plantId, "/downtime", { method: "POST", userId, body }),

  reportScrap: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<any>(plantId, "/scrap", { method: "POST", userId, body }),

  reportRework: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<any>(plantId, "/rework", { method: "POST", userId, body }),

  getOperationVariance: (plantId: string, userId: string | null | undefined, operationId: string) =>
    mfgFetch<any>(plantId, `/operations/${encodeURIComponent(operationId)}/variance`, { userId }),

  /* ── ۵.۷ مواد، MRP، مصرف و پیشنهاد تأمین (۵ مسیر) ── */
  listMaterials: (plantId: string, userId?: string | null, query?: { partId?: string }) =>
    mfgFetch<{ items: any[]; total: number }>(plantId, "/materials", { userId, query }),

  calculateMrp: (plantId: string, userId: string | null | undefined, body: Record<string, unknown> = {}) =>
    mfgFetch<{ processedRequirements: number; shortagesCount: number; requirements: any[]; shortages: any[] }>(
      plantId,
      "/mrp/calculate",
      { method: "POST", userId, body },
    ),

  listShortages: (plantId: string, userId?: string | null, query?: { status?: string; partId?: string }) =>
    mfgFetch<{ items: any[]; total: number }>(plantId, "/mrp/shortages", { userId, query }),

  consumeMaterial: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<any>(plantId, "/material-consumptions", { method: "POST", userId, body }),

  createProcurementProposal: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<any>(plantId, "/material-procurement-proposals", { method: "POST", userId, body }),

  /* ── ۵.۸ بهای تمام‌شده، داشبورد، OEE و هشدارها (۸ مسیر) ── */
  getOrderCost: (plantId: string, userId: string | null | undefined, orderId: string) =>
    mfgFetch<any>(plantId, `/cost/orders/${encodeURIComponent(orderId)}`, { userId }),

  getOperationCost: (plantId: string, userId: string | null | undefined, operationId: string) =>
    mfgFetch<any>(plantId, `/cost/operations/${encodeURIComponent(operationId)}`, { userId }),

  reconcileOrderCost: (plantId: string, userId: string | null | undefined, orderId: string, body: Record<string, unknown> = {}) =>
    mfgFetch<any>(plantId, `/cost/orders/${encodeURIComponent(orderId)}/reconcile`, { method: "POST", userId, body }),

  getDashboardOverview: (plantId: string, userId?: string | null) =>
    mfgFetch<any>(plantId, "/dashboard/overview", { userId }),

  getDashboardWorkCenterLoad: (plantId: string, userId?: string | null) =>
    mfgFetch<{ items: any[]; total: number }>(plantId, "/dashboard/work-center-load", { userId }),

  getDashboardOee: (plantId: string, userId?: string | null) =>
    mfgFetch<{ summary: any; items: any[] }>(plantId, "/dashboard/oee", { userId }),

  listAlerts: (plantId: string, userId?: string | null, query?: { status?: string; severity?: string }) =>
    mfgFetch<{ items: any[]; total: number }>(plantId, "/alerts", { userId, query }),

  acknowledgeAlert: (plantId: string, userId: string | null | undefined, alertId: string, body: { resolutionNote?: string; resolve?: boolean } = {}) =>
    mfgFetch<any>(plantId, `/alerts/${encodeURIComponent(alertId)}/acknowledgements`, { method: "POST", userId, body }),
};
