/**
 * کلاینت یکپارچهٔ سامانهٔ مستقل برنامه‌ریزی و کنترل تولید (mfg-api-v1 — Standalone MES)
 * پوشش کامل ۶۵ مسیر REST API قرارداد `docs/manufacturing-api.md` (بخش‌های ۵.۳ تا ۵.۸)
 * با پشتیبانی از دامنهٔ کارخانه (`plantId`)، هدر هویت (`x-user-id`)، قفل خوش‌بینانه (`If-Match`)
 * و کلید یکتایی درخواست (`Idempotency-Key`).
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

/** تولید کلید یکتای Idempotency-Key منطبق با الگوی سرور `^[A-Za-z0-9._:-]{1,160}$`. */
export function makeIdempotencyKey(prefix = "mfg"): string {
  const safePrefix = prefix.replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, 40) || "mfg";
  const rand = Math.random().toString(36).slice(2, 10);
  return `${safePrefix}-${Date.now()}-${rand}`;
}

/** پنجرهٔ زمانی پیش‌فرض (۳۰ روز حول زمان فعلی/دمو، زیر سقف ۹۰ روز سرور). */
export function defaultMfgTimeWindow(fromIso = "2026-10-01T00:00:00.000Z", toIso = "2026-10-31T23:59:59.000Z"): {
  from: string;
  to: string;
} {
  return { from: fromIso, to: toIso };
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

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  userId?: string | null;
  ifMatch?: number | string | null;
  idempotencyKey?: string | null;
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
  if (opts.idempotencyKey !== undefined && opts.idempotencyKey !== null && String(opts.idempotencyKey).trim() !== "") {
    headers["Idempotency-Key"] = String(opts.idempotencyKey).trim();
  }
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(buildUrl(plantId, subPath, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

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

/* ═══════════════════════════ انواع داده‌ای واقعی ردیف‌ها ═══════════════════════════ */

export interface MfgPage {
  limit: number;
  offset: number;
  total: number;
}

export interface MfgListResponse<T> {
  items: T[];
  page: MfgPage;
}

export type MfgPartType = "manufactured" | "purchased" | "phantom" | "subcontract";

export interface MfgOpeningInventoryInput {
  WarehouseCode: string;
  LocationCode?: string | null;
  LotNo?: string | null;
  OnHandQty: number;
  ReservedQty?: number;
  BlockedQty?: number;
  InTransitQty?: number;
  SafetyStockQty?: number;
}

export interface MfgPartPlanningInput {
  ProcurementType?: "make" | "buy";
  LeadTimeDays?: number;
  SafetyStockQty?: number;
  LotSize?: number;
  OrderMultiple?: number;
  ShelfLifeDays?: number | null;
  StandardUnitCost?: number | null;
  Currency?: string;
  DefaultWarehouseCode?: string | null;
  IsActive?: boolean;
  OpeningInventory?: MfgOpeningInventoryInput | null;
}

export interface MfgMaterial {
  Id: string;
  PlantId: string;
  PartId: string;
  ProcurementType: "make" | "buy";
  LeadTimeDays: number;
  SafetyStockQty: number;
  LotSize: number;
  OrderMultiple: number;
  ShelfLifeDays?: number | null;
  StandardUnitCost?: number | null;
  Currency: string;
  DefaultWarehouseCode?: string | null;
  IsActive: boolean;
  CreatedAt: string;
  CreatedBy: string;
  UpdatedAt?: string | null;
  UpdatedBy?: string | null;
  RowVersion: number;
}

export interface MfgInventoryLevel {
  Id: string;
  PlantId: string;
  MaterialId: string;
  WarehouseCode: string;
  LocationCode: string;
  LotNo: string;
  InventoryKey: string;
  OnHandQty: number;
  ReservedQty: number;
  BlockedQty: number;
  InTransitQty: number;
  SafetyStockQty: number;
  AsOfAt: string;
  LastCountedAt?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgPart {
  Id: string;
  PlantId: string;
  PartNo: string;
  NameFa: string;
  NameEn?: string | null;
  PartType: MfgPartType;
  BaseUom: string;
  DescriptionFa?: string | null;
  StandardUnitCost?: number | null;
  Currency: string;
  IsLotTracked: boolean;
  IsActive: boolean;
  Material?: MfgMaterial | null;
  Inventory?: MfgInventoryLevel | null;
  CreatedAt: string;
  CreatedBy: string;
  UpdatedAt?: string | null;
  UpdatedBy?: string | null;
  RowVersion: number;
}

export interface MfgBomHeader {
  Id: string;
  PlantId: string;
  PartId: string;
  Revision: string;
  Status: "draft" | "released" | "obsolete";
  BaseQuantity: number;
  BaseUom: string;
  EffectiveFrom: string;
  EffectiveTo?: string | null;
  IsDefault: boolean;
  ReleasedAt?: string | null;
  ReleasedBy?: string | null;
  NoteFa?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgBomItem {
  Id: string;
  PlantId: string;
  BomHeaderId: string;
  LineNo: number;
  ComponentPartId: string;
  QuantityPer: number;
  Uom: string;
  ScrapPct: number;
  IssueAtOperationCode?: string | null;
  IssueMethod: "manual" | "backflush" | "kit";
  IsPhantom: boolean;
  NoteFa?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgRouting {
  Id: string;
  PlantId: string;
  PartId: string;
  RoutingCode: string;
  Revision: string;
  Status: "draft" | "released" | "obsolete";
  BaseQuantity: number;
  BaseUom: string;
  EffectiveFrom: string;
  EffectiveTo?: string | null;
  IsDefault: boolean;
  ReleasedAt?: string | null;
  ReleasedBy?: string | null;
  NoteFa?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgRoutingOperation {
  Id: string;
  PlantId: string;
  RoutingId: string;
  SequenceNo: number;
  OperationCode: string;
  OperationNameFa: string;
  OperationNameEn?: string | null;
  WorkCenterId: string;
  SetupMinutes: number;
  RunMinutesPerUnit: number;
  QueueMinutes: number;
  MoveMinutes: number;
  OverlapAllowed: boolean;
  TransferBatchQty?: number | null;
  PredecessorSequence?: number | null;
  InspectionRequired: boolean;
  CostCenterId?: string | null;
  WorkInstructionRef?: string | null;
  NoteFa?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgCostCenter {
  Id: string;
  PlantId: string;
  Code: string;
  NameFa: string;
  CostElement: "machine" | "labor" | "overhead";
  HourlyRate: number;
  Currency: string;
  AllocationBasis: "machine_hours" | "labor_hours" | "units" | "percent";
  EffectiveFrom: string;
  EffectiveTo?: string | null;
  IsActive: boolean;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgWorkCenterRateInput {
  CostElement: "machine" | "labor" | "overhead";
  HourlyRate: number;
  Currency?: string;
  AllocationBasis?: "machine_hours" | "labor_hours" | "units" | "percent";
  Code?: string;
  NameFa?: string;
  EffectiveFrom?: string;
  EffectiveTo?: string | null;
}

export interface MfgWorkCenter {
  Id: string;
  PlantId: string;
  Code: string;
  NameFa: string;
  NameEn?: string | null;
  Kind: "machine" | "labor" | "assembly" | "inspection";
  NominalCapacityMinutesPerDay: number;
  EfficiencyPct: number;
  CostCenterId?: string | null;
  TimeZoneId: string;
  Status: "active" | "inactive" | "maintenance";
  DescriptionFa?: string | null;
  CostCenters?: MfgCostCenter[];
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgWorkCenterResource {
  Id: string;
  PlantId: string;
  WorkCenterId: string;
  ResourceCode: string;
  NameFa: string;
  ResourceKind: "machine" | "labor";
  CapacityUnits: number;
  AvailabilityPct: number;
  EquipmentId?: string | null;
  CostCenterId?: string | null;
  IsActive: boolean;
  EffectiveFrom?: string | null;
  EffectiveTo?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgWorkCenterCalendar {
  Id: string;
  PlantId: string;
  WorkCenterId: string;
  RuleType: "weekly" | "date-override";
  RuleKey: string;
  WeekdayIso?: number | null;
  CalendarDate?: string | null;
  ShiftCode: string;
  StartMinuteOfDay?: number | null;
  EndMinuteOfDay?: number | null;
  BreakMinutes: number;
  BreakStartMinuteOfDay?: number | null;
  IsWorking: boolean;
  AvailabilityPct: number;
  EffectiveFrom: string;
  EffectiveTo?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export type MfgOrderStatus = "created" | "released" | "in-progress" | "completed" | "closed";
export type MfgOperationStatus = "pending" | "queued" | "ready" | "setup" | "running" | "blocked" | "completed";

export interface MfgProductionOrder {
  Id: string;
  PlantId: string;
  OrderNo: string;
  PartId: string;
  OrderQuantity: number;
  Uom: string;
  DueAt: string;
  RequestedStartAt?: string | null;
  Status: MfgOrderStatus;
  PriorityRule: "EDD" | "CR" | "MANUAL";
  ManualRank?: number | null;
  DispatchWeight: number;
  DemandSource: "sales-order" | "contract" | "forecast" | "manual";
  DemandRef?: string | null;
  CustomerRef?: string | null;
  CustomerNameSnapshot?: string | null;
  ContractId?: string | null;
  ProjectId?: string | null;
  BomHeaderId?: string | null;
  RoutingId?: string | null;
  BomRevisionSnapshot?: string | null;
  RoutingRevisionSnapshot?: string | null;
  ReleasedAt?: string | null;
  ReleasedBy?: string | null;
  CompletedAt?: string | null;
  ClosedAt?: string | null;
  ClosedBy?: string | null;
  AllowOverrun: boolean;
  NoteFa?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgOrderOperation {
  Id: string;
  PlantId: string;
  ProductionOrderId: string;
  RoutingOperationId?: string | null;
  SequenceNo: number;
  OperationCode: string;
  OperationNameFa: string;
  WorkCenterId: string;
  PredecessorOperationId?: string | null;
  Status: MfgOperationStatus;
  PlannedQuantity: number;
  PlannedSetupMinutes: number;
  PlannedRunMinutesPerUnit: number;
  PlannedQueueMinutes: number;
  PlannedMoveMinutes: number;
  PlannedCapacityMinutes: number;
  OverlapAllowed: boolean;
  TransferBatchQty?: number | null;
  InspectionRequired: boolean;
  BlockedReasonFa?: string | null;
  CostCenterId?: string | null;
  OrderNo?: string;
  OrderStatus?: MfgOrderStatus;
  PriorityRule?: string;
  DueDate?: string | null;
  WorkCenterCode?: string | null;
  WorkCenterNameFa?: string | null;
  PlannedStartAt?: string | null;
  PlannedEndAt?: string | null;
  ScheduledResourceId?: string | null;
  ScheduleVersion?: number | null;
  SegmentCount?: number;
  IsFirmScheduled?: boolean;
  ActiveExecution?: MfgOperationExecution | null;
  LatestExecution?: MfgOperationExecution | null;
  ExecutionCount?: number;
  CumulativeInputQuantity?: number;
  CumulativeGoodQuantity?: number;
  CumulativeScrapQuantity?: number;
  CumulativeReworkQuantity?: number;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export type MfgProductionOrderOperation = MfgOrderOperation;

export interface MfgOrderDetail extends MfgProductionOrder {
  Operations: MfgOrderOperation[];
}

export interface MfgOperationExecution {
  Id: string;
  PlantId: string;
  ProductionOrderOperationId: string;
  ExecutionNo: number;
  Status: "running" | "completed" | "cancelled";
  ResourceId?: string | null;
  OperatorId?: string | null;
  StartedAt: string;
  FinishedAt?: string | null;
  SetupActualMinutes: number;
  RunActualMinutes: number;
  InputQuantity: number;
  GoodQuantity: number;
  ReworkQuantity: number;
  ScrapQuantity: number;
  IdempotencyKey: string;
  NoteFa?: string | null;
  OperationStatus?: MfgOperationStatus;
  operation?: MfgOrderOperation;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgMaterialRequirement {
  Id: string;
  PlantId: string;
  ProductionOrderId: string;
  ProductionOrderOperationId?: string | null;
  BomItemId: string;
  MaterialId: string;
  RequirementKey: string;
  RequiredAt: string;
  GrossQuantity: number;
  ScrapAllowanceQty: number;
  NetQuantity: number;
  AvailableQuantity: number;
  ReservedQuantity: number;
  ShortageQuantity: number;
  Uom: string;
  Status: "planned" | "shortage" | "reserved" | "issued" | "closed" | "cancelled";
  ScheduleVersion: number;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgMaterialConsumption {
  Id: string;
  PlantId: string;
  ProductionOrderOperationId: string;
  RequirementId?: string | null;
  ExecutionId?: string | null;
  MaterialId: string;
  Quantity: number;
  Uom: string;
  LotNo?: string | null;
  UnitCost: number;
  Currency: string;
  ConsumptionMethod: "manual" | "backflush" | "issue";
  ConsumedAt: string;
  IdempotencyKey: string;
  PostedBy: string;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

export interface MfgGanttSegment {
  Id: string;
  ScheduleVersion: number;
  SegmentNo: number;
  ProductionOrderId: string;
  OrderNo: string;
  ProductionOrderOperationId: string;
  SequenceNo: number;
  OperationCode: string;
  OperationNameFa: string;
  WorkCenterId: string;
  ResourceId?: string | null;
  PlannedStartAt: string;
  PlannedEndAt: string;
  PlannedCapacityMinutes: number;
  QueueMinutes: number;
  MoveMinutes: number;
  CapacityMode: "finite" | "semi-finite";
  Direction: "forward" | "backward";
  DispatchRule: DispatchRule;
  Status: "tentative" | "firm" | "cancelled";
}

export interface MfgGanttLane {
  workCenter: MfgWorkCenter;
  segments: MfgGanttSegment[];
}

export interface MfgGanttResponse {
  scheduleVersion: number;
  from: string;
  to: string;
  lanes: MfgGanttLane[];
}

export interface MfgCapacityBucket {
  WorkCenterId: string;
  PeriodStart: string;
  PeriodEnd: string;
  AvailableMinutes: number;
  PlannedLoadMinutes: number;
  UtilizationPct: number | null;
  OverloadMinutes?: number;
  ScheduleVersion?: number;
}

export interface MfgCapacityLoadResponse {
  scheduleVersion: number;
  bucket: "day" | "week";
  buckets: MfgCapacityBucket[];
}

export interface MfgCapacityBottlenecksResponse {
  scheduleVersion: number;
  items: Array<MfgCapacityBucket & { OverloadMinutes: number }>;
}

export interface MfgOperationCost {
  Id?: string;
  PlantId: string;
  ProductionOrderOperationId: string;
  CostCenterId?: string | null;
  CostElement: "material" | "machine" | "labor" | "overhead";
  CostVersion: number;
  StandardQuantity: number;
  ActualQuantity: number;
  StandardRate: number;
  ActualRate: number;
  StandardAmount: number;
  ActualAmount: number;
  Currency: string;
  CalculatedAt: string;
  SourceRef?: string | null;
  RowVersion?: number;
}

export interface MfgOrderCost {
  Id?: string;
  PlantId?: string;
  ProductionOrderId: string;
  CostVersion: number;
  Currency: string;
  StandardMaterialCost?: number;
  ActualMaterialCost?: number;
  StandardMachineCost?: number;
  ActualMachineCost?: number;
  StandardLaborCost?: number;
  ActualLaborCost?: number;
  StandardOverheadCost?: number;
  ActualOverheadCost?: number;
  StandardTotalCost: number;
  ActualTotalCost: number;
  Variance?: number;
  ByElement?: Record<
    "material" | "machine" | "labor" | "overhead",
    { standard: number; actual: number; variance?: number }
  >;
  ContractRevenue?: number | null;
  GrossMargin?: number | null;
  Reconciled: boolean;
  ReconciledAt?: string | null;
  ModelVersion?: string | null;
  RowVersion?: number;
}

export interface MfgOperationVariance {
  OperationId?: string;
  ProductionOrderId?: string;
  WorkCenterId?: string;
  OperationCode?: string;
  OperationNameFa?: string | null;
  SequenceNo?: number | null;
  Status?: MfgOperationStatus;
  InspectionRequired?: boolean;
  OverlapAllowed?: boolean;
  TransferBatchQty?: number | null;
  Quantities: {
    PlannedQuantity?: number;
    InputQuantity?: number;
    GoodQuantity?: number;
    ScrapQuantity?: number;
    ReworkQuantity?: number;
    Planned?: number;
    Input?: number;
    Good?: number;
    Scrap?: number;
    Rework?: number;
  };
  TimeMinutes: {
    StandardSetupMinutes?: number;
    StandardRunMinutes?: number;
    StandardTotalMinutes?: number;
    ActualSetupMinutes?: number;
    ActualRunMinutes?: number;
    ActualTotalMinutes?: number;
    SetupVarianceMinutes?: number;
    RunVarianceMinutes?: number;
    TotalTimeVarianceMinutes?: number;
    TotalVarianceMinutes?: number;
    DowntimeMinutes?: number;
    [key: string]: number | undefined;
  };
  Executions?: MfgOperationExecution[];
  ScrapRecords?: any[];
  ReworkRecords?: any[];
  DowntimeLogs?: any[];
  Cost?: any;
  CostRedacted?: boolean;
}

export interface MfgProductionAlert {
  Id: string;
  PlantId: string;
  AlertKey: string;
  AlertCode: string;
  Severity: "critical" | "high" | "medium" | "low";
  Status: "open" | "acknowledged" | "resolved" | "suppressed";
  ProductionOrderId?: string | null;
  ProductionOrderOperationId?: string | null;
  WorkCenterId?: string | null;
  TitleFa: string;
  DetailFa?: string | null;
  FirstRaisedAt: string;
  LastRaisedAt: string;
  AcknowledgedAt?: string | null;
  AcknowledgedBy?: string | null;
  ResolvedAt?: string | null;
  ResolvedBy?: string | null;
  OccurrenceCount: number;
  ThresholdValue?: number | null;
  ActualValue?: number | null;
  SourceEventKey?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

/* ═══════════════════════════ کلاینت ۶۵ مسیر REST ═══════════════════════════ */

export const MfgClient = {
  /* ── ۵.۳ داده‌های پایه: قطعه و BOM (۱۴ مسیر) ── */
  listParts: (
    plantId: string,
    userId?: string | null,
    query?: { partType?: MfgPartType; isActive?: boolean; q?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgPart>>(plantId, "/parts", { userId, query }),

  createPart: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      PartNo: string;
      NameFa: string;
      NameEn?: string | null;
      PartType: MfgPartType;
      BaseUom: string;
      DescriptionFa?: string | null;
      StandardUnitCost?: number | null;
      Currency?: string;
      IsLotTracked?: boolean;
      Planning?: MfgPartPlanningInput;
    } & Record<string, unknown>,
  ) => mfgFetch<MfgPart>(plantId, "/parts", { method: "POST", userId, body }),

  getPart: (plantId: string, userId: string | null | undefined, partId: string) =>
    mfgFetch<MfgPart>(plantId, `/parts/${encodeURIComponent(partId)}`, { userId }),

  patchPart: (
    plantId: string,
    userId: string | null | undefined,
    partId: string,
    rowVersion: number,
    body: {
      NameFa?: string;
      NameEn?: string | null;
      PartType?: MfgPartType;
      BaseUom?: string;
      DescriptionFa?: string | null;
      StandardUnitCost?: number | null;
      Currency?: string;
      IsLotTracked?: boolean;
      IsActive?: boolean;
      Planning?: MfgPartPlanningInput;
    } & Record<string, unknown>,
  ) =>
    mfgFetch<MfgPart>(plantId, `/parts/${encodeURIComponent(partId)}`, {
      method: "PATCH",
      userId,
      ifMatch: rowVersion,
      body,
    }),

  listBomHeaders: (
    plantId: string,
    userId?: string | null,
    query?: { partId?: string; status?: "draft" | "released" | "obsolete"; effectiveAt?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgBomHeader>>(plantId, "/bom-headers", { userId, query }),

  createBomHeader: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<MfgBomHeader>(plantId, "/bom-headers", { method: "POST", userId, body }),

  getBomHeader: (plantId: string, userId: string | null | undefined, bomId: string) =>
    mfgFetch<MfgBomHeader>(plantId, `/bom-headers/${encodeURIComponent(bomId)}`, { userId }),

  patchBomHeader: (plantId: string, userId: string | null | undefined, bomId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgBomHeader>(plantId, `/bom-headers/${encodeURIComponent(bomId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  listBomItems: (
    plantId: string,
    userId: string | null | undefined,
    bomId: string,
    query?: { limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgBomItem>>(plantId, `/bom-headers/${encodeURIComponent(bomId)}/items`, { userId, query }),

  createBomItem: (plantId: string, userId: string | null | undefined, bomId: string, body: Record<string, unknown>) =>
    mfgFetch<MfgBomItem>(plantId, `/bom-headers/${encodeURIComponent(bomId)}/items`, { method: "POST", userId, body }),

  patchBomItem: (plantId: string, userId: string | null | undefined, itemId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgBomItem>(plantId, `/bom-items/${encodeURIComponent(itemId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  deleteBomItem: (plantId: string, userId: string | null | undefined, itemId: string) =>
    mfgFetch<void>(plantId, `/bom-items/${encodeURIComponent(itemId)}`, { method: "DELETE", userId }),

  releaseBom: (
    plantId: string,
    userId: string | null | undefined,
    bomId: string,
    rowVersion: number,
    body: { EffectiveAt?: string } = {},
  ) =>
    mfgFetch<MfgBomHeader>(plantId, `/bom-headers/${encodeURIComponent(bomId)}/release`, {
      method: "POST",
      userId,
      ifMatch: rowVersion,
      body,
    }),

  explodeBom: (
    plantId: string,
    userId: string | null | undefined,
    bomId: string,
    body: { Quantity: number; At?: string },
  ) =>
    mfgFetch<{
      bomId?: string;
      lines: Array<{
        PartId: string;
        GrossQuantity: number;
        ScrapAllowanceQty: number;
        NetQuantity: number;
        Depth: number;
        Uom?: string;
        IssueAtOperationCode?: string | null;
        IssueMethod?: string;
      }>;
    }>(plantId, `/bom-headers/${encodeURIComponent(bomId)}/explosions`, { method: "POST", userId, body }),

  /* ── ۵.۳ داده‌های پایه: مسیر ساخت و عملیات (۹ مسیر) ── */
  listRoutings: (
    plantId: string,
    userId?: string | null,
    query?: { partId?: string; status?: "draft" | "released" | "obsolete"; effectiveAt?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgRouting>>(plantId, "/routings", { userId, query }),

  createRouting: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<MfgRouting>(plantId, "/routings", { method: "POST", userId, body }),

  getRouting: (plantId: string, userId: string | null | undefined, routingId: string) =>
    mfgFetch<MfgRouting>(plantId, `/routings/${encodeURIComponent(routingId)}`, { userId }),

  patchRouting: (plantId: string, userId: string | null | undefined, routingId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgRouting>(plantId, `/routings/${encodeURIComponent(routingId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  listRoutingOperations: (
    plantId: string,
    userId: string | null | undefined,
    routingId: string,
    query?: { limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgRoutingOperation>>(plantId, `/routings/${encodeURIComponent(routingId)}/operations`, { userId, query }),

  createRoutingOperation: (plantId: string, userId: string | null | undefined, routingId: string, body: Record<string, unknown>) =>
    mfgFetch<MfgRoutingOperation>(plantId, `/routings/${encodeURIComponent(routingId)}/operations`, { method: "POST", userId, body }),

  patchRoutingOperation: (plantId: string, userId: string | null | undefined, routingOperationId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgRoutingOperation>(plantId, `/routing-operations/${encodeURIComponent(routingOperationId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  deleteRoutingOperation: (plantId: string, userId: string | null | undefined, routingOperationId: string) =>
    mfgFetch<void>(plantId, `/routing-operations/${encodeURIComponent(routingOperationId)}`, { method: "DELETE", userId }),

  releaseRouting: (
    plantId: string,
    userId: string | null | undefined,
    routingId: string,
    rowVersion: number,
    body: { EffectiveAt?: string } = {},
  ) =>
    mfgFetch<MfgRouting>(plantId, `/routings/${encodeURIComponent(routingId)}/release`, {
      method: "POST",
      userId,
      ifMatch: rowVersion,
      body,
    }),

  /* ── ۵.۳ داده‌های پایه: مراکز کاری، منابع و تقویم (۱۰ مسیر) ── */
  listWorkCenters: (
    plantId: string,
    userId?: string | null,
    query?: { kind?: string; status?: string; q?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgWorkCenter>>(plantId, "/work-centers", { userId, query }),

  createWorkCenter: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      Code: string;
      NameFa: string;
      NameEn?: string | null;
      Kind: "machine" | "labor" | "assembly" | "inspection";
      NominalCapacityMinutesPerDay?: number;
      EfficiencyPct: number;
      CostCenterId?: string | null;
      TimeZoneId: string;
      Status?: "active" | "inactive" | "maintenance";
      DescriptionFa?: string | null;
      Rates?: MfgWorkCenterRateInput[];
    } & Record<string, unknown>,
  ) => mfgFetch<MfgWorkCenter>(plantId, "/work-centers", { method: "POST", userId, body }),

  getWorkCenter: (plantId: string, userId: string | null | undefined, workCenterId: string) =>
    mfgFetch<MfgWorkCenter>(
      plantId,
      `/work-centers/${encodeURIComponent(workCenterId)}`,
      { userId },
    ),

  patchWorkCenter: (plantId: string, userId: string | null | undefined, workCenterId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenter>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  listWorkCenterResources: (
    plantId: string,
    userId: string | null | undefined,
    workCenterId: string,
    query?: { activeOnly?: boolean; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgWorkCenterResource>>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}/resources`, { userId, query }),

  createWorkCenterResource: (plantId: string, userId: string | null | undefined, workCenterId: string, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenterResource>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}/resources`, { method: "POST", userId, body }),

  patchWorkCenterResource: (plantId: string, userId: string | null | undefined, resourceId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenterResource>(plantId, `/work-center-resources/${encodeURIComponent(resourceId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  listWorkCenterCalendars: (
    plantId: string,
    userId: string | null | undefined,
    workCenterId: string,
    query?: { from?: string; to?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgWorkCenterCalendar>>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}/calendars`, { userId, query }),

  createWorkCenterCalendar: (plantId: string, userId: string | null | undefined, workCenterId: string, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenterCalendar>(plantId, `/work-centers/${encodeURIComponent(workCenterId)}/calendars`, { method: "POST", userId, body }),

  patchWorkCenterCalendar: (plantId: string, userId: string | null | undefined, calendarId: string, rowVersion: number, body: Record<string, unknown>) =>
    mfgFetch<MfgWorkCenterCalendar>(plantId, `/work-center-calendars/${encodeURIComponent(calendarId)}`, { method: "PATCH", userId, ifMatch: rowVersion, body }),

  /* ── ۵.۴ سفارش‌های تولید (۶ مسیر) ── */
  listOrders: (
    plantId: string,
    userId?: string | null,
    query?: {
      status?: MfgOrderStatus;
      partId?: string;
      dueFrom?: string;
      dueTo?: string;
      projectId?: string;
      contractId?: string;
      priorityRule?: "EDD" | "CR" | "MANUAL";
      q?: string;
      limit?: number;
      offset?: number;
    },
  ) => mfgFetch<MfgListResponse<MfgProductionOrder>>(plantId, "/orders", { userId, query }),

  createOrder: (plantId: string, userId: string | null | undefined, body: Record<string, unknown>) =>
    mfgFetch<MfgProductionOrder>(plantId, "/orders", { method: "POST", userId, body }),

  getOrder: (plantId: string, userId: string | null | undefined, orderId: string) =>
    mfgFetch<MfgOrderDetail>(
      plantId,
      `/orders/${encodeURIComponent(orderId)}`,
      { userId },
    ),

  reprioritizeOrder: (
    plantId: string,
    userId: string | null | undefined,
    orderId: string,
    rowVersion: number,
    body: { PriorityRule?: "EDD" | "CR" | "MANUAL"; ManualRank?: number | null; DispatchWeight?: number },
  ) =>
    mfgFetch<MfgProductionOrder>(plantId, `/orders/${encodeURIComponent(orderId)}/priority`, {
      method: "PATCH",
      userId,
      ifMatch: rowVersion,
      body,
    }),

  releaseOrder: (
    plantId: string,
    userId: string | null | undefined,
    orderId: string,
    rowVersion: number,
    body: { BomHeaderId: string; RoutingId: string; EffectiveAt?: string },
  ) =>
    mfgFetch<{ order: MfgProductionOrder; operations: MfgOrderOperation[] }>(
      plantId,
      `/orders/${encodeURIComponent(orderId)}/release`,
      { method: "POST", userId, ifMatch: rowVersion, body },
    ),

  closeOrder: (
    plantId: string,
    userId: string | null | undefined,
    orderId: string,
    rowVersion: number,
    body: { CloseReasonFa?: string } = {},
  ) =>
    mfgFetch<MfgProductionOrder>(plantId, `/orders/${encodeURIComponent(orderId)}/close`, {
      method: "POST",
      userId,
      ifMatch: rowVersion,
      body,
    }),

  /* ── ۵.۵ زمان‌بندی، باززمان‌بندی، گانت و ظرفیت (۵ مسیر) ── */
  runSchedule: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      Direction: "forward" | "backward";
      CapacityMode: "finite" | "semi-finite";
      DispatchRule: DispatchRule;
      From: string;
      To: string;
      OrderIds?: string[];
      ExpectedScheduleVersion?: number;
    },
  ) =>
    mfgFetch<{
      ScheduleVersion: number;
      RunId?: string;
      assignments: any[];
      unscheduled: any[];
      capacity: MfgCapacityBucket[];
    }>(plantId, "/scheduling/runs", { method: "POST", userId, body }),

  reschedule: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      ExpectedScheduleVersion: number;
      OperationIds: string[];
      Reason: string;
      DispatchRule?: DispatchRule;
    },
  ) =>
    mfgFetch<{
      ScheduleVersion: number;
      PreviousScheduleVersion: number;
      RunId?: string;
      Reason: string;
      RequestedOperationIds: string[];
      RescheduledOperationIds: string[];
      assignments: any[];
      unscheduled: any[];
      capacity: MfgCapacityBucket[];
      diff: {
        fromScheduleVersion: number;
        toScheduleVersion: number;
        changedOperationCount: number;
        unchangedOperationCount: number;
        movedCount: number;
        changedOperations: any[];
      };
    }>(plantId, "/scheduling/reschedules", { method: "POST", userId, body }),

  getGantt: (
    plantId: string,
    userId: string | null | undefined,
    query: { from: string; to: string; workCenterId?: string; orderId?: string; scheduleVersion?: number },
  ) => mfgFetch<MfgGanttResponse>(plantId, "/scheduling/gantt", { userId, query }),

  getCapacityLoad: (
    plantId: string,
    userId: string | null | undefined,
    query: { from: string; to: string; bucket?: "day" | "week"; workCenterId?: string },
  ) => mfgFetch<MfgCapacityLoadResponse>(plantId, "/capacity/load", { userId, query }),

  getCapacityBottlenecks: (
    plantId: string,
    userId: string | null | undefined,
    query: { from: string; to: string; minUtilizationPct?: number },
  ) => mfgFetch<MfgCapacityBottlenecksResponse>(plantId, "/capacity/bottlenecks", { userId, query }),

  /* ── ۵.۶ اجرای کارگاهی، توقف، ضایعات، دوباره‌کاری و انحراف (۸ مسیر) ── */
  getOperationQueue: (
    plantId: string,
    userId?: string | null,
    query?: { workCenterId?: string; status?: MfgOperationStatus; shiftDate?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgOrderOperation>>(plantId, "/operation-queue", { userId, query }),

  startExecution: (
    plantId: string,
    userId: string | null | undefined,
    operationId: string,
    body: { ResourceId?: string | null; OperatorId?: string | null; NoteFa?: string | null } = {},
    idempotencyKey: string = makeIdempotencyKey("start-exec"),
  ) =>
    mfgFetch<MfgOperationExecution>(
      plantId,
      `/operations/${encodeURIComponent(operationId)}/executions`,
      { method: "POST", userId, idempotencyKey, body },
    ),

  reportExecution: (
    plantId: string,
    userId: string | null | undefined,
    executionId: string,
    rowVersion: number,
    body: {
      InputQuantity: number;
      GoodQuantity: number;
      ReworkQuantity: number;
      ScrapQuantity: number;
      SetupActualMinutes: number;
      RunActualMinutes: number;
      NoteFa?: string | null;
    },
    idempotencyKey: string = makeIdempotencyKey("report-exec"),
  ) =>
    mfgFetch<MfgOperationExecution>(
      plantId,
      `/executions/${encodeURIComponent(executionId)}/reports`,
      { method: "POST", userId, ifMatch: rowVersion, idempotencyKey, body },
    ),

  finishExecution: (
    plantId: string,
    userId: string | null | undefined,
    executionId: string,
    rowVersion: number,
    body: { FinishedAt?: string; InspectionApproved?: boolean; NoteFa?: string | null } = {},
    idempotencyKey: string = makeIdempotencyKey("finish-exec"),
  ) =>
    mfgFetch<MfgOperationExecution>(
      plantId,
      `/executions/${encodeURIComponent(executionId)}/finish`,
      { method: "POST", userId, ifMatch: rowVersion, idempotencyKey, body },
    ),

  reportDowntime: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      WorkCenterId: string;
      OperationId?: string | null;
      ExecutionId?: string | null;
      ResourceId?: string | null;
      StartedAt: string;
      FinishedAt?: string | null;
      DowntimeType: "planned" | "unplanned";
      ReasonCode: string;
      NoteFa?: string | null;
    },
    idempotencyKey: string = makeIdempotencyKey("downtime"),
  ) => mfgFetch<any>(plantId, "/downtime", { method: "POST", userId, idempotencyKey, body }),

  reportScrap: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      OperationId: string;
      ExecutionId?: string | null;
      Quantity: number;
      Uom: string;
      ReasonCode: string;
      Disposition: "scrapped" | "returned-to-stock" | "use-as-is";
      CostAmount?: number | null;
      Currency?: string;
      NoteFa?: string | null;
    },
    idempotencyKey: string = makeIdempotencyKey("scrap"),
  ) => mfgFetch<any>(plantId, "/scrap", { method: "POST", userId, idempotencyKey, body }),

  reportRework: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      SourceOperationId: string;
      TargetOperationId?: string | null;
      ExecutionId?: string | null;
      ScrapRecordId?: string | null;
      Quantity: number;
      Uom: string;
      ReasonCode: string;
      Disposition?: "rework-in-place" | "return-to-operation" | "scrap";
      NoteFa?: string | null;
    },
    idempotencyKey: string = makeIdempotencyKey("rework"),
  ) => mfgFetch<any>(plantId, "/rework", { method: "POST", userId, idempotencyKey, body }),

  getOperationVariance: (
    plantId: string,
    userId: string | null | undefined,
    operationId: string,
    query?: { from?: string; to?: string },
  ) => mfgFetch<MfgOperationVariance>(plantId, `/operations/${encodeURIComponent(operationId)}/variance`, { userId, query }),

  /* ── ۵.۷ مواد، MRP، مصرف و پیشنهاد تأمین (۵ مسیر) ── */
  listMaterials: (
    plantId: string,
    userId?: string | null,
    query?: { q?: string; procurementType?: "make" | "buy"; isActive?: boolean; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgMaterial>>(plantId, "/materials", { userId, query }),

  calculateMrp: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      OrderIds?: string[];
      ThroughDate: string;
      ScheduleVersion?: number;
      PreviewOnly?: boolean;
    },
  ) =>
    mfgFetch<{
      calculationAt: string;
      previewOnly: boolean;
      requirements: MfgMaterialRequirement[];
      shortages: MfgMaterialRequirement[];
      proposals: any[];
    }>(
      plantId,
      "/mrp/calculate",
      { method: "POST", userId, body },
    ),

  listShortages: (
    plantId: string,
    userId?: string | null,
    query?: {
      requiredBefore?: string;
      materialId?: string;
      orderId?: string;
      scheduleVersion?: number;
      limit?: number;
      offset?: number;
    },
  ) => mfgFetch<MfgListResponse<MfgMaterialRequirement>>(plantId, "/mrp/shortages", { userId, query }),

  consumeMaterial: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      OperationId: string;
      RequirementId?: string | null;
      ExecutionId?: string | null;
      MaterialId: string;
      Quantity: number;
      Uom: string;
      LotNo?: string | null;
      UnitCost: number;
      Currency?: string;
      ConsumptionMethod: "manual" | "backflush" | "issue";
    },
    idempotencyKey: string = makeIdempotencyKey("consume"),
  ) => mfgFetch<MfgMaterialConsumption>(plantId, "/material-consumptions", { method: "POST", userId, idempotencyKey, body }),

  createProcurementProposal: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      ThroughDate: string;
      RequirementIds: string[];
      NoteFa?: string | null;
    },
  ) => mfgFetch<any>(plantId, "/material-procurement-proposals", { method: "POST", userId, body }),

  /* ── ۵.۸ بهای تمام‌شده، داشبورد، OEE و هشدارها (۸ مسیر) ── */
  getOrderCost: (
    plantId: string,
    userId: string | null | undefined,
    orderId: string,
    query?: { costVersion?: number },
  ) => mfgFetch<MfgOrderCost>(plantId, `/cost/orders/${encodeURIComponent(orderId)}`, { userId, query }),

  getOperationCost: (
    plantId: string,
    userId: string | null | undefined,
    operationId: string,
    query?: { costVersion?: number },
  ) => mfgFetch<{ items: MfgOperationCost[]; derived: boolean }>(plantId, `/cost/operations/${encodeURIComponent(operationId)}`, { userId, query }),

  reconcileOrderCost: (
    plantId: string,
    userId: string | null | undefined,
    orderId: string,
    rowVersion: number,
    body: { CostVersion: number; ReconcileThrough: string; ContractRevenue?: number | null },
    idempotencyKey: string = makeIdempotencyKey("reconcile"),
  ) =>
    mfgFetch<MfgOrderCost>(plantId, `/cost/orders/${encodeURIComponent(orderId)}/reconcile`, {
      method: "POST",
      userId,
      ifMatch: rowVersion,
      idempotencyKey,
      body,
    }),

  getDashboardOverview: (
    plantId: string,
    userId: string | null | undefined,
    query: { from: string; to: string; workCenterId?: string },
  ) => mfgFetch<any>(plantId, "/dashboard/overview", { userId, query }),

  getDashboardWorkCenterLoad: (
    plantId: string,
    userId: string | null | undefined,
    query: { from: string; to: string; bucket?: "day" | "week" },
  ) => mfgFetch<MfgCapacityLoadResponse>(plantId, "/dashboard/work-center-load", { userId, query }),

  getDashboardOee: (
    plantId: string,
    userId: string | null | undefined,
    query: { from: string; to: string; workCenterId?: string },
  ) =>
    mfgFetch<{
      from: string;
      to: string;
      workCenterId?: string | null;
      downtime: any;
      availability: any;
      performance: any;
      quality: any;
      oee: number | null;
      oeePct: number | null;
    }>(plantId, "/dashboard/oee", { userId, query }),

  listAlerts: (
    plantId: string,
    userId?: string | null,
    query?: { status?: string; severity?: string; orderId?: string; workCenterId?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgProductionAlert>>(plantId, "/alerts", { userId, query }),

  acknowledgeAlert: (
    plantId: string,
    userId: string | null | undefined,
    alertId: string,
    rowVersion: number,
    body: { NoteFa?: string | null } = {},
  ) =>
    mfgFetch<MfgProductionAlert>(plantId, `/alerts/${encodeURIComponent(alertId)}/acknowledgements`, {
      method: "POST",
      userId,
      ifMatch: rowVersion,
      body,
    }),
};
