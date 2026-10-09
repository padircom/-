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
  PartNo?: string;
  PartNameFa?: string;
  BaseUom?: string;
  PartType?: MfgPartType;
  IsLotTracked?: boolean;
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
  OnHandQty?: number;
  ReservedQty?: number;
  BlockedQty?: number;
  InTransitQty?: number;
  FreeAvailableQty?: number;
  TotalConsumedQty?: number;
  InventoryLocations?: Array<{
    Id: string;
    WarehouseCode: string;
    LocationCode?: string | null;
    LotNo?: string | null;
    OnHandQty: number;
    ReservedQty: number;
    BlockedQty: number;
    InTransitQty: number;
  }>;
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
  PartId?: string | null;
  PartNo?: string | null;
  PartNameFa?: string | null;
  OrderNo?: string | null;
  OperationCode?: string | null;
  ProcurementType?: "make" | "buy" | null;
  LeadTimeDays?: number | null;
  LotSize?: number | null;
  OrderMultiple?: number | null;
  StandardUnitCost?: number | null;
  Currency?: string;
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

export type MfgCostElement = "material" | "machine" | "labor" | "overhead" | "scrap";

export interface MfgCostElementSummary {
  standard: number;
  planned: number;
  actual: number;
  costVariance?: number;
  costVariancePct?: number | null;
  plannedCostVariance?: number;
  plannedCostVariancePct?: number | null;
}

export interface MfgOperationCost {
  Id?: string;
  PlantId: string;
  ProductionOrderOperationId: string;
  CostCenterId?: string | null;
  CostElement: MfgCostElement;
  CostVersion: number;
  StandardQuantity: number;
  PlannedQuantity?: number;
  ActualQuantity: number;
  StandardRate: number;
  PlannedRate?: number;
  ActualRate: number;
  StandardAmount: number;
  PlannedAmount?: number;
  ActualAmount: number;
  CostVariance?: number;
  CostVariancePct?: number | null;
  PlannedCostVariance?: number;
  PlannedCostVariancePct?: number | null;
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
  PlannedMaterialCost?: number;
  ActualMaterialCost?: number;
  StandardMachineCost?: number;
  PlannedMachineCost?: number;
  ActualMachineCost?: number;
  StandardLaborCost?: number;
  PlannedLaborCost?: number;
  ActualLaborCost?: number;
  StandardOverheadCost?: number;
  PlannedOverheadCost?: number;
  ActualOverheadCost?: number;
  StandardScrapCost?: number;
  PlannedScrapCost?: number;
  ActualScrapCost?: number;
  StandardTotalCost: number;
  PlannedTotalCost?: number;
  ActualTotalCost: number;
  Variance?: number;
  CostVariance?: number;
  CostVariancePct?: number | null;
  PlannedCostVariance?: number;
  PlannedCostVariancePct?: number | null;
  ByElement?: Partial<Record<MfgCostElement, MfgCostElementSummary>>;
  OperationBreakdown?: Array<{
    OperationId: string;
    SequenceNo?: number;
    OperationCode?: string;
    OperationNameFa?: string;
    WorkCenterId?: string;
    Status?: string;
    Currency?: string;
    StandardTotalCost: number;
    PlannedTotalCost: number;
    ActualTotalCost: number;
    CostVariance: number;
    CostVariancePct: number | null;
    PlannedCostVariance: number;
    PlannedCostVariancePct: number | null;
    ByElement: Partial<Record<MfgCostElement, MfgCostElementSummary>>;
  }>;
  ContractRevenue?: number | null;
  GrossMargin?: number | null;
  Reconciled: boolean;
  ReconciledAt?: string | null;
  ReconcileThrough?: string | null;
  Derived?: boolean;
  ModelVersion?: string | null;
  RowVersion?: number;
}

export interface MfgDashboardOeeComponent {
  numerator: number;
  denominator: number;
  value: number | null;
  pct?: number | null;
  idealProductionMinutes?: number;
  actualRunMinutes?: number;
  goodQuantity?: number;
  scrapQuantity?: number;
  reworkQuantity?: number;
  totalProducedQuantity?: number;
}

export interface MfgDashboardOeeSummary {
  from: string;
  to: string;
  workCenterId: string | null;
  workCenterCode?: string;
  workCenterNameFa?: string;
  calendar: { availableMinutes: number; plannedProductionMinutes: number };
  downtime: {
    plannedMinutes: number;
    unplannedMinutes: number;
    plannedDowntimeMinutes: number;
    unplannedDowntimeMinutes: number;
    totalMinutes: number;
  };
  availability: MfgDashboardOeeComponent;
  performance: MfgDashboardOeeComponent;
  quality: MfgDashboardOeeComponent;
  oee: number | null;
  oeePct: number | null;
  workCenters?: MfgDashboardOeeSummary[];
  bottlenecks?: Array<{
    rank: number;
    workCenterId: string;
    workCenterCode: string;
    workCenterNameFa: string;
    oeePct: number;
    availabilityPct: number | null;
    performancePct: number | null;
    qualityPct: number | null;
    unplannedDowntimeMinutes: number;
  }>;
}

export interface MfgDashboardOverview {
  from: string;
  to: string;
  workCenterId: string | null;
  openOrdersCount: number;
  orders: {
    totalCount: number;
    openCount: number;
    closedCount: number;
    statusCounts: Record<string, number>;
    completedInWindowCount: number;
    completedOnTimeCount: number;
    dueInWindowCount: number;
    deliveredDueInWindowCount: number;
    onTimeDueInWindowCount: number;
    lateDeliveryCount: number;
    openLateCount: number;
    onTimeDeliveryPct: number | null;
    deliveredOnTimePct: number | null;
  };
  statusCounts: Record<string, number>;
  completedOrdersCount: number;
  completedOnTimeCount: number;
  onTimeDeliveryPct: number | null;
  deliveredOnTimePct: number | null;
  goodQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  totalProducedQuantity: number;
  production: {
    actualRunMinutes: number;
    idealProductionMinutes: number;
    goodQuantity: number;
    scrapQuantity: number;
    reworkQuantity: number;
    totalProducedQuantity: number;
  };
  openShortagesCount: number;
  totalShortageQuantity: number;
  shortages: { openCount: number; dueInWindowCount: number; totalQuantity: number };
  openAlertsCount: number;
  alerts: { openCount: number; bySeverity: Record<string, number> };
  costSummary: {
    available: boolean;
    currency: string | null;
    orderCount: number;
    reconciledOrderCount: number;
    standardTotalCost: number;
    plannedTotalCost: number;
    actualTotalCost: number;
    costVariance: number;
    costVariancePct: number | null;
    plannedCostVariance: number;
    plannedCostVariancePct: number | null;
    currencies: Array<{
      currency: string;
      orderCount: number;
      reconciledOrderCount: number;
      standardTotalCost: number;
      plannedTotalCost: number;
      actualTotalCost: number;
      costVariance: number;
      costVariancePct: number | null;
      plannedCostVariance: number;
      plannedCostVariancePct: number | null;
    }>;
  };
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
  OrderNo?: string | null;
  OperationCode?: string | null;
  WorkCenterCode?: string | null;
  WorkCenterNameFa?: string | null;
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

/* ═══════════════════════════ فاز ۵ — MES پیشرفته ═══════════════════════════ */

/** قاعدهٔ اندازه‌گذاری لات؛ همان چهار قاعدهٔ کلاسیک APICS. */
export type MfgLotSizingRule = "L4L" | "FOQ" | "EOQ" | "POQ";
/** نوع تقاضا در MPS؛ پیش‌بینی تنها نوعی است که ConfidencePct برایش الزامی است. */
export type MfgDemandType = "sales-order" | "forecast" | "contract" | "manual";
/** حالت ATP: گسسته (هر سطل جدا) یا تجمعی (موجودی جاری). */
export type MfgAtpMode = "discrete" | "cumulative";
export type MfgAtpPromiseStatus = "available" | "delayed" | "unavailable";
export type MfgTimeBucketUnit = "day" | "week" | "month";

/** رکورد تقاضا (`MfgDemandForecast`). */
export interface MfgDemandForecast {
  Id: string;
  PlantId: string;
  PartId: string;
  DemandType: MfgDemandType;
  DemandRef: string;
  RequiredAt: string;
  Quantity: number;
  Uom: string;
  CustomerRef?: string | null;
  CustomerNameSnapshot?: string | null;
  ConfidencePct?: number | null;
  /** مقداری که اجرای MPS از این ردیف مصرف کرده است. */
  ConsumedQuantity?: number | null;
  /** مهر اجرای MPS که این ردیف را مصرف کرده است. */
  MpsRunId?: string | null;
  Status: string;
  NoteFa?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

/** سیاست اندازه‌گذاری لات (`MfgLotSizingPolicy`) به‌همراه EOQ مشتق‌شده. */
export interface MfgLotSizingPolicy {
  Id: string;
  PlantId: string;
  PartId: string;
  PolicyCode?: string | null;
  RuleCode: MfgLotSizingRule;
  FixedLotQty?: number | null;
  OrderMultiple?: number | null;
  MinOrderQty?: number | null;
  MaxOrderQty?: number | null;
  OrderingCost?: number | null;
  HoldingCostPerUnitPerYear?: number | null;
  AnnualDemandQty?: number | null;
  PeriodDays?: number | null;
  PeriodOrderQuantity?: number | null;
  Currency?: string | null;
  EffectiveFrom: string;
  EffectiveTo?: string | null;
  IsActive: boolean;
  NoteFa?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
  /** EOQ محاسبه‌شده از OrderingCost / HoldingCost / AnnualDemandQty؛ null یعنی داده ناکافی. */
  eoq?: number | null;
  /** تعداد سطلِ قاعدهٔ POQ؛ از PeriodOrderQuantity یا نسبت EOQ به تقاضای هر سطل. */
  periodOrderQuantity?: number | null;
}

/** سطر زمان‌بندی‌شدهٔ MPS — پیش‌نمایش و رکورد پایدار شکل یکسانی دارند. */
export interface MfgMasterScheduleLine {
  Id?: string;
  PlantId?: string;
  MpsRunId?: string | null;
  PartId: string;
  BucketIndex: number;
  BucketStart: string;
  BucketEnd: string;
  ForecastQty: number;
  SalesOrderQty: number;
  ContractQty: number;
  ManualQty: number;
  ConsumedForecastQty: number;
  GrossRequirementQty: number;
  ScheduledReceiptQty: number;
  ProjectedOnHandBefore: number;
  NetRequirementQty: number;
  PlannedOrderReceiptQty: number;
  PlannedOrderReleaseQty: number;
  PlannedOrderReleaseAt: string | null;
  ProjectedOnHandAfter: number;
  LotSizingRule: MfgLotSizingRule;
  LotSizingPolicyId?: string | null;
  InsideDemandTimeFence: boolean;
  IsFirm: boolean;
  AppliedConstraints?: string | null;
  DemandRefsJson?: unknown;
  RowVersion?: number;
}

/** هدر اجرای MPS (`MfgMasterScheduleRun`). */
export interface MfgMasterScheduleRun {
  Id: string;
  PlantId: string;
  RunNo: number;
  TimeBucket: MfgTimeBucketUnit;
  BucketCount: number;
  HorizonStart: string;
  HorizonEnd: string;
  PartId?: string | null;
  DemandTimeFenceBuckets: number;
  FirmPlannedTimeFenceBuckets: number;
  ConsumeForecast: boolean;
  PreviewOnly?: boolean;
  CalculatedAt?: string | null;
  CalculatedBy?: string | null;
  ModelVersion?: string | null;
  PartCount: number;
  LineCount: number;
  TotalPlannedOrderQty: number;
  SummaryJson?: unknown;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

/** سطل ATP با مقدار قابل تعهد. */
export interface MfgAtpBucket {
  bucketIndex: number;
  bucketStart: string;
  bucketEnd: string;
  supplyQty: number;
  demandQty: number;
  availableToPromise: number;
  cumulativeAtp: number;
}

/** نتیجهٔ تعهد تحویل. */
export interface MfgAtpPromiseCheck {
  status: MfgAtpPromiseStatus;
  promisedQty: number;
  promisedAt: string | null;
  sourceBucketStart: string | null;
  sourceBucketIndex: number | null;
  delayBuckets: number | null;
  shortageQty: number;
  requestedQty: number;
  requestedAt: string;
}

/** رکورد پایدار بررسی ATP (`MfgAtpCheck`). */
export interface MfgAtpCheck {
  Id: string;
  PlantId: string;
  PartId: string;
  RequestedQty: number;
  RequestedAt: string;
  Mode: MfgAtpMode;
  Result: MfgAtpPromiseStatus;
  PromisedQty: number;
  PromisedAt?: string | null;
  ShortageQty: number;
  DelayBuckets?: number | null;
  SourceBucketStart?: string | null;
  OpeningAvailableQty?: number | null;
  IncludeSafetyStock?: boolean;
  LeadTimeDays?: number | null;
  BucketCount: number;
  CheckedAt?: string | null;
  CheckedBy?: string | null;
  ModelVersion?: string | null;
  CustomerRef?: string | null;
  MessageFa?: string | null;
  DetailJson?: unknown;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}

/** لات تقسیمی یک عملیات (`MfgOperationSplitLot`). */
export interface MfgOperationSplitLot {
  Id: string;
  PlantId: string;
  ProductionOrderOperationId: string;
  SplitNo: number;
  Quantity: number;
  CumulativeQuantity?: number | null;
  IsTransferBatch: boolean;
  Status: string;
  StartedAt?: string | null;
  CompletedAt?: string | null;
  NoteFa?: string | null;
  CreatedAt: string;
  CreatedBy: string;
  RowVersion: number;
}


/* ═══════════════════════════ کلاینت ۸۶ مسیر REST ═══════════════════════════ */

/* ── فاز ۵ بخش ۱۱: نسخهٔ تولید، سفارش برنامه‌ریزی‌شده، CRP، pegging و انطباق ── */

export interface MfgProductionVersion {
  Id: string;
  PlantId: string;
  PartId: string;
  VersionCode: string;
  BomRevision: string;
  RoutingRevision: string;
  /** خط تولیدی که این نسخه برای آن تعریف شده؛ تهی یعنی نسخهٔ عمومی قطعه. */
  WorkCenterId: string | null;
  Priority: number | null;
  IsActive: boolean;
  IsDefault: boolean;
  EffectiveFrom: string | null;
  EffectiveTo: string | null;
  NoteFa: string | null;
  CreatedAt: string;
  CreatedBy: string | null;
  RowVersion: number;
}

export interface MfgPlannedOrder {
  Id: string;
  PlantId: string;
  PlannedOrderNo: string;
  PartId: string;
  ProductionVersionId: string | null;
  /** mrp | mps — کدام موتور این پیشنهاد را صادر کرده است. */
  Source: "mrp" | "mps";
  MrpRunNo: number | null;
  MpsRunId: string | null;
  Quantity: number;
  /** مقدار پیشنهادی موتور؛ پس از ویرایش برنامه‌ریز دست‌نخورده می‌ماند. */
  OriginalQuantity: number;
  Uom: string;
  LowLevelCode: number;
  CumulativeLeadTimeDays: number;
  PlannedReleaseAt: string | null;
  PlannedDueAt: string | null;
  BucketIndex: number;
  LotSizingRule: "L4L" | "FOQ" | "EOQ" | "POQ";
  /** proposed | approved | converted | rejected | cancelled */
  Status: string;
  ReviewedBy: string | null;
  ReviewedAt: string | null;
  ConvertedProductionOrderId: string | null;
  ConvertedAt: string | null;
  RejectReasonFa: string | null;
  NoteFa: string | null;
  CreatedAt: string;
  CreatedBy: string | null;
  RowVersion: number;
  /** ردیف‌های MfgRequirementPegging وابسته؛ در پاسخ‌های تکی ضمیمه می‌شود. */
  pegging?: unknown[];
}

export interface MfgLeadTimeOffsetRow {
  partId: string;
  partNo: string | null;
  lowLevelCode: number;
  ownLeadTimeDays: number;
  /** ساخت این قطعه با همهٔ زیرمجموعه‌اش چقدر طول می‌کشد. */
  cumulativeLeadTimeDays: number;
  /** این قطعه چند روز پیش از سررسید محصول نهایی باید دم دست باشد. */
  availabilityOffsetDays: number;
  releaseOffsetDays: number;
}

export interface MfgLeadTimeOffsetReport {
  parts: MfgLeadTimeOffsetRow[];
  levelOffsets: { level: number; releaseOffsetDays: number; partCount: number }[];
  finishedGoodsLeadTimeDays: number;
  maxLowLevelCode: number;
  rootPartIds?: string[];
}

export interface MfgPeggingStep {
  partId: string;
  partNo: string | null;
  supplyRef: string;
  quantityPer: number;
}

export interface MfgPeggingItem {
  supplyRef: string;
  partId: string;
  partNo: string | null;
  /** زنجیره از جزء به ریشه می‌رود؛ گام نخست نسبت به خودش ۱ است. */
  paths: MfgPeggingStep[][];
}

export interface MfgPeggingReport {
  level: "single" | "multi";
  requirementCount: number;
  supplyCount: number;
  rootSupplyRefs: string[];
  items: MfgPeggingItem[];
}

export interface MfgCrpBucket {
  bucketIndex: number;
  bucketStart: string;
  bucketEnd: string;
  loadMinutes: number;
  capacityMinutes: number;
  utilizationPct: number;
  surplusMinutes: number;
  status: "overload" | "underload" | "idle" | "balanced";
  operationCount: number;
}

export interface MfgCrpWorkCenter {
  workCenterId: string;
  code: string | null;
  /** در پاسخ خلاصه (GET /crp/summary) جزئیات سطل حذف می‌شود. */
  buckets?: MfgCrpBucket[];
  totalLoadMinutes: number;
  totalCapacityMinutes: number;
  utilizationPct: number;
  peakUtilizationPct: number;
  overloadBucketCount: number;
  underloadBucketCount: number;
}

export interface MfgCrpReport {
  bucketUnit: MfgTimeBucketUnit;
  bucketCount: number;
  horizonStart: string;
  horizonEnd: string;
  scheduleVersion: number | null;
  includePlannedOrders: boolean;
  scheduledOperationCount: number;
  plannedOrderCount: number;
  buckets: { bucketIndex: number; bucketStart: string; bucketEnd: string }[];
  workCenters: MfgCrpWorkCenter[];
  totals: {
    loadMinutes: number;
    capacityMinutes: number;
    utilizationPct: number;
    overloadBucketCount: number;
    underloadBucketCount: number;
    idleBucketCount: number;
  };
  levelingSuggestions: unknown[];
}

export interface MfgAtpCapacityCenter {
  workCenterId: string;
  code: string | null;
  requiredMinutes: number;
  buckets: {
    bucketIndex: number;
    bucketStart: string;
    bucketEnd: string;
    availableMinutes: number;
    loadedMinutes: number;
    freeMinutes: number;
    sufficient: boolean;
  }[];
}

export interface MfgAtpCapacity {
  considered: boolean;
  constrained: boolean;
  requestedBucketIndex: number | null;
  promiseBucketIndex: number | null;
  promiseAt: string | null;
  centers: MfgAtpCapacityCenter[];
  message: string | null;
}

export interface MfgIsa95Conformance {
  modelVersion: string;
  isa95: {
    level3: { role: string; roleEn: string; implementedRouteCount: number; counts: Record<string, number> };
    level4: {
      role: string;
      roleEn: string;
      integration: string;
      softKeys: string[];
      /** از خود اسکیما شمرده می‌شود، نه یک عدد ثابت؛ باید صفر بماند. */
      foreignKeysToLevel4: number;
      foreignKeysToLevel4Detail: string[];
      mfgTableCount: number;
      mfgForeignKeyCount: number;
    };
    boundary: string;
  };
  mesa11: {
    functionCount: number;
    fullyCovered: number;
    averageCoveragePct: number;
    functions: {
      id: number;
      code: string;
      titleFa: string;
      titleEn: string;
      coveredRouteCount: number;
      totalRouteCount: number;
      coveragePct: number;
      routes: { route: string; implemented: boolean }[];
    }[];
  };
}

export type MfgIndustryType = "discrete" | "process" | "food" | "pharma" | "automotive" | "metal";

export const MFG_INDUSTRY_TYPES: readonly MfgIndustryType[] = [
  "discrete", "process", "food", "pharma", "automotive", "metal",
] as const;

export interface MfgIndustryCapability {
  code: string;
  titleFa: string;
  titleEn: string;
  /** آیا این صنعت باید این قابلیت را فعال ببیند. */
  enabled: boolean;
  /** آیا در همین سامانه پیاده شده. false یعنی «مرتبط است ولی ساخته نشده». */
  implemented: boolean;
  reasonFa: string;
}

export interface MfgIndustryCapabilityMap {
  industryType: MfgIndustryType;
  industryTitleFa: string;
  industryTitleEn: string;
  characteristicFa: string;
  capabilities: MfgIndustryCapability[];
  totals: {
    capabilityCount: number;
    enabledCount: number;
    implementedCount: number;
    enabledAndImplementedCount: number;
  };
}

export interface MfgPlantSettings {
  plantId: string;
  plantCode: string;
  nameFa: string;
  nameEn: string | null;
  industryType: MfgIndustryType;
  isActive: boolean;
  noteFa: string | null;
  /** برای PATCH بعدی باید در If-Match برگردانده شود. */
  rowVersion: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface MfgPlantSettingsResponse {
  plant: MfgPlantSettings;
  capabilities: MfgIndustryCapabilityMap;
}

export interface MfgPlantSettingsPatch {
  PlantCode?: string;
  NameFa?: string;
  NameEn?: string | null;
  IndustryType?: MfgIndustryType;
  IsActive?: boolean;
  NoteFa?: string | null;
}

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
      WarehouseCode?: string | null;
      LocationCode?: string | null;
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
    body: { CostVersion: number; ReconcileThrough: string; ContractRevenue?: number | null; ModelVersion?: string },
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
  ) => mfgFetch<MfgDashboardOverview>(plantId, "/dashboard/overview", { userId, query }),

  getDashboardWorkCenterLoad: (
    plantId: string,
    userId: string | null | undefined,
    query: { from: string; to: string; bucket?: "day" | "week" },
  ) => mfgFetch<MfgCapacityLoadResponse>(plantId, "/dashboard/work-center-load", { userId, query }),

  getDashboardOee: (
    plantId: string,
    userId: string | null | undefined,
    query: { from: string; to: string; workCenterId?: string },
  ) => mfgFetch<MfgDashboardOeeSummary>(plantId, "/dashboard/oee", { userId, query }),

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

  /* ── ۵.۹ فاز ۵: تقاضا و پیش‌بینی (۵ مسیر) ── */
  listDemandForecasts: (
    plantId: string,
    userId?: string | null,
    query?: { partId?: string; demandType?: MfgDemandType; from?: string; to?: string; status?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgDemandForecast>>(plantId, "/demand-forecasts", { userId, query }),

  createDemandForecast: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      PartId: string;
      DemandType: MfgDemandType;
      DemandRef: string;
      RequiredAt: string;
      Quantity: number;
      Uom?: string | null;
      CustomerRef?: string | null;
      CustomerNameSnapshot?: string | null;
      ConfidencePct?: number | null;
      Status?: string;
      NoteFa?: string | null;
    },
  ) => mfgFetch<MfgDemandForecast>(plantId, "/demand-forecasts", { method: "POST", userId, body }),

  patchDemandForecast: (
    plantId: string,
    userId: string | null | undefined,
    demandId: string,
    rowVersion: number,
    body: {
      RequiredAt?: string;
      Quantity?: number;
      Uom?: string | null;
      CustomerRef?: string | null;
      CustomerNameSnapshot?: string | null;
      ConfidencePct?: number | null;
      Status?: string;
      NoteFa?: string | null;
    },
  ) =>
    mfgFetch<MfgDemandForecast>(plantId, `/demand-forecasts/${encodeURIComponent(demandId)}`, {
      method: "PATCH",
      userId,
      ifMatch: rowVersion,
      body,
    }),

  deleteDemandForecast: (plantId: string, userId: string | null | undefined, demandId: string) =>
    mfgFetch<{ deleted: boolean; id: string }>(plantId, `/demand-forecasts/${encodeURIComponent(demandId)}`, { method: "DELETE", userId }),

  getTimePhasedDemand: (
    plantId: string,
    userId: string | null | undefined,
    query: { partIds?: string; bucket?: MfgTimeBucketUnit; bucketCount?: number; horizonStart?: string; demandTypes?: string; includeConsumed?: boolean },
  ) =>
    mfgFetch<{
      bucketUnit: MfgTimeBucketUnit;
      bucketCount: number;
      horizonStart: string;
      horizonEnd: string;
      outsideHorizonQty: number;
      parts: { partId: string; partNo: string | null; partNameFa: string | null; uom: string | null; totalQty: number; lines: unknown[] }[];
    }>(plantId, "/demand/time-phased", { userId, query }),

  /* ── ۵.۹ فاز ۵: اندازه‌گذاری لات (۴ مسیر) ── */
  listLotSizingPolicies: (
    plantId: string,
    userId?: string | null,
    query?: { partId?: string; ruleCode?: MfgLotSizingRule; isActive?: boolean; effectiveAt?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgLotSizingPolicy>>(plantId, "/lot-sizing-policies", { userId, query }),

  createLotSizingPolicy: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      PartId: string;
      PolicyCode?: string | null;
      RuleCode: MfgLotSizingRule;
      FixedLotQty?: number | null;
      OrderMultiple?: number | null;
      MinOrderQty?: number | null;
      MaxOrderQty?: number | null;
      OrderingCost?: number | null;
      HoldingCostPerUnitPerYear?: number | null;
      AnnualDemandQty?: number | null;
      PeriodDays?: number | null;
      PeriodOrderQuantity?: number | null;
      Currency?: string | null;
      EffectiveFrom: string;
      EffectiveTo?: string | null;
      IsActive?: boolean;
      NoteFa?: string | null;
    },
  ) => mfgFetch<MfgLotSizingPolicy>(plantId, "/lot-sizing-policies", { method: "POST", userId, body }),

  patchLotSizingPolicy: (
    plantId: string,
    userId: string | null | undefined,
    policyId: string,
    rowVersion: number,
    body: Record<string, unknown>,
  ) =>
    mfgFetch<MfgLotSizingPolicy>(plantId, `/lot-sizing-policies/${encodeURIComponent(policyId)}`, {
      method: "PATCH",
      userId,
      ifMatch: rowVersion,
      body,
    }),

  /** ارزیابی خشک قاعدهٔ لات؛ چیزی در پایگاه‌داده نمی‌نویسد. */
  evaluateLotSizing: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      PartId: string;
      Policy?: Record<string, unknown>;
      PolicyId?: string;
      Demand?: { RequiredAt: string; Quantity: number; Type?: MfgDemandType }[];
      ScheduledReceipts?: { DueAt: string; Quantity: number }[];
      OnHandQty?: number | null;
      SafetyStockQty?: number | null;
      LeadTimeDays?: number | null;
      BucketUnit?: MfgTimeBucketUnit;
      BucketCount?: number;
      HorizonStart?: string;
    },
  ) =>
    mfgFetch<{
      partId: string;
      partNo: string;
      uom: string;
      policySource: string;
      policyId: string | null;
      lotSizingRule: MfgLotSizingRule;
      eoq: unknown;
      periodOrderQuantity: number | null;
      bucketUnit: MfgTimeBucketUnit;
      bucketCount: number;
      horizonStart: string;
      horizonEnd: string;
      openingAvailableQty: number;
      safetyStockQty: number;
      totals: Record<string, number>;
      lines: MfgMasterScheduleLine[];
    }>(plantId, "/lot-sizing/evaluate", { method: "POST", userId, body }),

  /* ── ۵.۹ فاز ۵: برنامهٔ اصلی تولید MPS (۵ مسیر) ── */
  runMasterSchedule: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      TimeBucket?: MfgTimeBucketUnit;
      BucketCount?: number;
      HorizonStart?: string;
      PartIds?: string[];
      DemandTimeFenceBuckets?: number;
      FirmPlannedTimeFenceBuckets?: number;
      /** مصرف پیش‌بینی با سفارش فروش در همان سطل (پیش‌فرض true). */
      ConsumeForecast?: boolean;
      IncludeOpenOrdersAsReceipts?: boolean;
      PreviewOnly?: boolean;
    } = {},
  ) =>
    mfgFetch<{
      previewOnly: boolean;
      run: MfgMasterScheduleRun | null;
      timeBucket: MfgTimeBucketUnit;
      bucketCount: number;
      horizonStart: string;
      horizonEnd: string;
      parts: unknown[];
      skippedParts?: unknown[];
      lines: MfgMasterScheduleLine[];
      totals: { partCount: number; lineCount: number; plannedOrderQty: number };
    }>(plantId, "/mps/runs", { method: "POST", userId, body }),

  listMasterScheduleRuns: (
    plantId: string,
    userId?: string | null,
    query?: { timeBucket?: MfgTimeBucketUnit; partId?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgMasterScheduleRun>>(plantId, "/mps/runs", { userId, query }),

  getMasterScheduleRun: (plantId: string, userId: string | null | undefined, runId: string) =>
    mfgFetch<MfgMasterScheduleRun>(plantId, `/mps/runs/${encodeURIComponent(runId)}`, { userId }),

  listMasterScheduleLines: (
    plantId: string,
    userId: string | null | undefined,
    runId: string,
    query?: { partId?: string; firmOnly?: boolean; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgMasterScheduleLine>>(plantId, `/mps/runs/${encodeURIComponent(runId)}/lines`, { userId, query }),

  /** قطعی‌کردن سطرهای درون حصار برنامه؛ If-Match روی هدر اجرا الزامی است. */
  firmMasterScheduleLines: (
    plantId: string,
    userId: string | null | undefined,
    runId: string,
    rowVersion: number,
    body: { PartId?: string; ThroughBucketIndex?: number; Firm?: boolean } = {},
  ) =>
    mfgFetch<{
      run: MfgMasterScheduleRun;
      firmedLineCount: number;
      throughBucketIndex: number;
      firm: boolean;
      lines: MfgMasterScheduleLine[];
    }>(plantId, `/mps/runs/${encodeURIComponent(runId)}/firm`, { method: "POST", userId, ifMatch: rowVersion, body }),

  /* ── ۵.۹ فاز ۵: قابل‌تعهد بودن ATP (۳ مسیر) ── */
  checkAtp: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      PartId: string;
      RequestedQty: number;
      RequestedAt: string;
      CustomerRef?: string | null;
      Mode?: MfgAtpMode;
      IncludeSafetyStock?: boolean;
      IncludeForecast?: boolean;
      IncludePlannedOrders?: boolean;
      BucketUnit?: MfgTimeBucketUnit;
      BucketCount?: number;
      HorizonStart?: string;
      Persist?: boolean;
    },
  ) =>
    mfgFetch<{
      partId: string;
      partNo: string;
      uom: string;
      mode: MfgAtpMode;
      includeSafetyStock: boolean;
      includeForecast: boolean;
      includePlannedOrders: boolean;
      mpsRunId: string | null;
      leadTimeDays: number;
      bucketUnit: MfgTimeBucketUnit;
      horizonStart: string;
      horizonEnd: string;
      openingAvailableQty: number;
      buckets: MfgAtpBucket[];
      totals: Record<string, number>;
      check: MfgAtpPromiseCheck;
      record: MfgAtpCheck | null;
    }>(plantId, "/atp/checks", { method: "POST", userId, body }),

  listAtpChecks: (
    plantId: string,
    userId?: string | null,
    query?: { partId?: string; result?: MfgAtpPromiseStatus; mode?: MfgAtpMode; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgAtpCheck>>(plantId, "/atp/checks", { userId, query }),

  getAtpSummary: (
    plantId: string,
    userId: string | null | undefined,
    query: { partId: string; mode?: MfgAtpMode; includeSafetyStock?: boolean; includeForecast?: boolean; includePlannedOrders?: boolean; bucket?: MfgTimeBucketUnit; bucketCount?: number; horizonStart?: string },
  ) =>
    mfgFetch<{
      partId: string;
      partNo: string;
      partNameFa: string;
      uom: string;
      mode: MfgAtpMode;
      includeSafetyStock: boolean;
      includeForecast: boolean;
      includePlannedOrders: boolean;
      mpsRunId: string | null;
      bucketUnit: MfgTimeBucketUnit;
      horizonStart: string;
      horizonEnd: string;
      openingAvailableQty: number;
      buckets: MfgAtpBucket[];
      totals: Record<string, number>;
    }>(plantId, "/atp/summary", { userId, query }),

  /* ── ۵.۹ فاز ۵: تقسیم لات و هم‌پوشانی عملیات (۴ مسیر) ── */
  listOperationSplits: (plantId: string, userId: string | null | undefined, orderId: string, operationId: string) =>
    mfgFetch<{
      order: { Id: string; OrderNo: string; Status: string };
      operation: {
        Id: string;
        OperationCode: string;
        SequenceNo: number;
        Status: string;
        PlannedQuantity: number;
        PlannedSetupMinutes: number;
        PlannedRunMinutesPerUnit: number;
        OverlapAllowed: boolean;
        TransferBatchQty: number | null;
        OverlapPct: number | null;
        SplitLotCount: number | null;
        effectiveTransferBatchQty: number | null;
      };
      lots: MfgOperationSplitLot[];
    }>(plantId, `/orders/${encodeURIComponent(orderId)}/operations/${encodeURIComponent(operationId)}/splits`, { userId }),

  /** جایگزینی کامل لات‌های تقسیمی یک عملیات (کاهش/افزایش لات در یک فراخوانی). */
  replaceOperationSplits: (
    plantId: string,
    userId: string | null | undefined,
    orderId: string,
    operationId: string,
    body: {
      /** تعداد لات؛ سرور خودش مقدار هر لات را از مقدار سفارش و MinLotQty حساب می‌کند. */
      SplitLotCount?: number;
      TransferBatchQty?: number | null;
      OverlapPct?: number | null;
      OverlapAllowed?: boolean;
      MinLotQty?: number | null;
      NoteFa?: string | null;
    },
  ) =>
    mfgFetch<{ lots: MfgOperationSplitLot[]; deleted: number; created: number }>(
      plantId,
      `/orders/${encodeURIComponent(orderId)}/operations/${encodeURIComponent(operationId)}/splits`,
      { method: "POST", userId, body },
    ),

  deleteOperationSplit: (plantId: string, userId: string | null | undefined, splitLotId: string) =>
    mfgFetch<{ deleted: boolean; id: string }>(plantId, `/operation-splits/${encodeURIComponent(splitLotId)}`, { method: "DELETE", userId }),

  /** تحلیل زمان تحویل با و بدون هم‌پوشانی؛ برای تصمیم «ارزش هم‌پوشانی چقدر است». */
  getLeadTimeAnalysis: (
    plantId: string,
    userId: string | null | undefined,
    orderId: string,
    query?: { scheduleVersion?: number },
  ) =>
    mfgFetch<{
      order: { Id: string; OrderNo: string; Status: string; OrderQuantity: number; DueAt: string | null };
      scheduleVersion: number | null;
      operationCount: number;
      scheduledOperationCount: number;
      analysis: Record<string, unknown>;
    }>(plantId, `/orders/${encodeURIComponent(orderId)}/lead-time-analysis`, { userId, query }),

  /* ── ۱۱.۹ فاز ۵: نسخهٔ تولید (۴ مسیر) ── */
  listProductionVersions: (
    plantId: string,
    userId?: string | null,
    query?: { partId?: string; isActive?: boolean; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgProductionVersion>>(plantId, "/production-versions", { userId, query }),

  createProductionVersion: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      PartId: string;
      VersionCode: string;
      BomRevision: string;
      RoutingRevision: string;
      WorkCenterId?: string | null;
      Priority?: number | null;
      IsActive?: boolean;
      IsDefault?: boolean;
      EffectiveFrom?: string | null;
      EffectiveTo?: string | null;
      NoteFa?: string | null;
    },
  ) => mfgFetch<MfgProductionVersion>(plantId, "/production-versions", { method: "POST", userId, body }),

  patchProductionVersion: (
    plantId: string,
    userId: string | null | undefined,
    versionId: string,
    rowVersion: number,
    body: {
      PartId?: string;
      VersionCode?: string;
      BomRevision?: string;
      RoutingRevision?: string;
      WorkCenterId?: string | null;
      Priority?: number | null;
      IsActive?: boolean;
      IsDefault?: boolean;
      EffectiveFrom?: string | null;
      EffectiveTo?: string | null;
      NoteFa?: string | null;
    } = {},
  ) =>
    mfgFetch<MfgProductionVersion>(plantId, `/production-versions/${encodeURIComponent(versionId)}`, {
      method: "PATCH", userId, ifMatch: rowVersion, body,
    }),

  /** نسخهٔ فعال یک قطعه را برای یک خط مشخص resolve می‌کند (۱۱.۹). */
  resolvePartProductionVersion: (
    plantId: string,
    userId: string | null | undefined,
    partId: string,
    query?: { workCenterId?: string; at?: string; versionId?: string },
  ) =>
    mfgFetch<{
      partId: string;
      partNo: string | null;
      candidates: number;
      selected: MfgProductionVersion | null;
      selection: { versionId: string; versionCode: string; bomRevision: string; routingRevision: string } | null;
    }>(plantId, `/parts/${encodeURIComponent(partId)}/production-version`, { userId, query }),

  /* ── ۱۱.۳ فاز ۵: سفارش برنامه‌ریزی‌شده (۶ مسیر) ── */
  listPlannedOrders: (
    plantId: string,
    userId?: string | null,
    query?: { partId?: string; status?: string; source?: "mrp" | "mps"; dueFrom?: string; dueTo?: string; limit?: number; offset?: number },
  ) => mfgFetch<MfgListResponse<MfgPlannedOrder>>(plantId, "/planned-orders", { userId, query }),

  getPlannedOrder: (plantId: string, userId: string | null | undefined, plannedOrderId: string) =>
    mfgFetch<MfgPlannedOrder>(plantId, `/planned-orders/${encodeURIComponent(plannedOrderId)}`, { userId }),

  /** ویرایش پیش از تبدیل مجاز است؛ پس از تبدیل با ۴۲۲ رد می‌شود. */
  patchPlannedOrder: (
    plantId: string,
    userId: string | null | undefined,
    plannedOrderId: string,
    rowVersion: number,
    body: {
      Quantity?: number;
      PlannedReleaseAt?: string | null;
      PlannedDueAt?: string | null;
      ProductionVersionId?: string | null;
      NoteFa?: string | null;
    } = {},
  ) =>
    mfgFetch<MfgPlannedOrder>(plantId, `/planned-orders/${encodeURIComponent(plannedOrderId)}`, {
      method: "PATCH", userId, ifMatch: rowVersion, body,
    }),

  approvePlannedOrder: (
    plantId: string,
    userId: string | null | undefined,
    plannedOrderId: string,
    rowVersion: number,
    body: { NoteFa?: string | null } = {},
  ) =>
    mfgFetch<MfgPlannedOrder>(plantId, `/planned-orders/${encodeURIComponent(plannedOrderId)}/approve`, {
      method: "POST", userId, ifMatch: rowVersion, body,
    }),

  rejectPlannedOrder: (
    plantId: string,
    userId: string | null | undefined,
    plannedOrderId: string,
    rowVersion: number,
    body: { RejectReasonFa: string; NoteFa?: string | null },
  ) =>
    mfgFetch<MfgPlannedOrder>(plantId, `/planned-orders/${encodeURIComponent(plannedOrderId)}/reject`, {
      method: "POST", userId, ifMatch: rowVersion, body,
    }),

  /** تبدیل به سفارش تولید؛ سفارش در وضعیت created ساخته می‌شود و آزادسازی گیت جداست. */
  convertPlannedOrder: (
    plantId: string,
    userId: string | null | undefined,
    plannedOrderId: string,
    rowVersion: number,
    body: { OrderNo?: string; NoteFa?: string | null; PriorityRule?: "EDD" | "CR" | "MANUAL" } = {},
  ) =>
    mfgFetch<{
      plannedOrder: MfgPlannedOrder;
      productionOrder: MfgProductionOrder;
      operationCount: number;
      routingRevision: string | null;
      requiresRelease: boolean;
    }>(plantId, `/planned-orders/${encodeURIComponent(plannedOrderId)}/convert`, {
      method: "POST", userId, ifMatch: rowVersion, body,
    }),

  /* ── ۱۱.۷ فاز ۵: CRP (۲ مسیر) ── */
  calculateCapacityRequirements: (
    plantId: string,
    userId: string | null | undefined,
    body: {
      Bucket?: MfgTimeBucketUnit;
      BucketCount?: number;
      HorizonStart?: string;
      OverloadPct?: number;
      UnderloadPct?: number;
      IncludePlannedOrders?: boolean;
    } = {},
  ) => mfgFetch<MfgCrpReport>(plantId, "/crp/calculate", { method: "POST", userId, body }),

  getCapacityRequirementsSummary: (
    plantId: string,
    userId?: string | null,
    query?: { bucket?: MfgTimeBucketUnit; bucketCount?: number; horizonStart?: string; overloadPct?: number; underloadPct?: number; includePlannedOrders?: boolean },
  ) => mfgFetch<MfgCrpReport>(plantId, "/crp/summary", { userId, query }),

  /* ── ۱۱.۵/۱۱.۶ فاز ۵: گزارش‌های Lead Time Offset و Pegging ── */
  getMrpLeadTimeOffset: (
    plantId: string,
    userId?: string | null,
    query?: { partId?: string; maxLevels?: number },
  ) => mfgFetch<MfgLeadTimeOffsetReport>(plantId, "/mrp/lead-time-offset", { userId, query }),

  getMrpPegging: (
    plantId: string,
    userId?: string | null,
    query?: { partId?: string; level?: "single" | "multi"; rootPartId?: string; productionOrderId?: string },
  ) => mfgFetch<MfgPeggingReport>(plantId, "/mrp/pegging", { userId, query }),

  /* ── ۱۱.۱ فاز ۵: تأیید دستی MPS پیش از اجرای MRP ── */
  approveMasterScheduleRun: (
    plantId: string,
    userId: string | null | undefined,
    runId: string,
    rowVersion: number,
    body: { NoteFa?: string | null } = {},
  ) =>
    mfgFetch<MfgMasterScheduleRun & { Status: string; ApprovedBy: string | null; ApprovedAt: string | null; NoteFa: string | null }>(
      plantId, `/mps/runs/${encodeURIComponent(runId)}/approve`, { method: "POST", userId, ifMatch: rowVersion, body },
    ),

  /* ── ۱۱.۱۱ فاز ۵: انطباق ISA-95 / MESA-11 ── */
  getIsa95Conformance: (plantId: string, userId?: string | null) =>
    mfgFetch<MfgIsa95Conformance>(plantId, "/conformance/isa95", { userId }),

  /* ── تنظیمات کارخانه و نوع صنعت ── */
  getPlantSettings: (plantId: string, userId?: string | null) =>
    mfgFetch<MfgPlantSettingsResponse>(plantId, "/settings", { userId }),

  /**
   * به‌روزرسانی تنظیمات کارخانه. `rowVersion` فقط وقتی لازم است که رکورد از قبل
   * وجود داشته باشد؛ در فراخوانی نخست (ساخت) `null` بدهید.
   */
  updatePlantSettings: (
    plantId: string,
    body: MfgPlantSettingsPatch,
    rowVersion: number | null,
    userId?: string | null,
  ) =>
    mfgFetch<MfgPlantSettingsResponse & { created: boolean }>(plantId, "/settings", {
      method: "PATCH",
      userId,
      ifMatch: rowVersion === null ? undefined : rowVersion,
      body,
    }),

  /** نگاشت قابلیت‌های صنعت. `industryType` برای پیش‌نمایش بدون ذخیره است. */
  getIndustryCapabilities: (plantId: string, industryType?: string, userId?: string | null) =>
    mfgFetch<MfgIndustryCapabilityMap>(
      plantId,
      `/capabilities${industryType ? `?industryType=${encodeURIComponent(industryType)}` : ""}`,
      { userId },
    ),
};
