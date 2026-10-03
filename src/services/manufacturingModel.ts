/**
 * مدل دامنهٔ پایهٔ برنامه‌ریزی و کنترل تولید عملیات‌محور (MFG v1).
 *
 * این فایل منطق خالص TypeScript است؛ به React، شبکه یا SQL وابسته نیست و
 * با الگوی فعلی مخزن (منطق خالص در src/services) سازگار است.
 * برنامه‌ریزی تولید روی نمونهٔ Operation انجام می‌شود؛ پروژه فقط مرجع
 * تجاری/گزارشی اختیاری است و ترتیب عملیات را تعیین نمی‌کند.
 */

export const MANUFACTURING_MODEL_VERSION = "mfg-v1" as const;

export type ProductionOrderStatus =
  | "created"
  | "released"
  | "in-progress"
  | "completed"
  | "closed";

/** ضایعات و دوباره‌کاری روی مقدار گزارش می‌شوند، نه وضعیت کل عملیات. */
export type ProductionOperationStatus =
  | "pending"
  | "queued"
  | "ready"
  | "setup"
  | "running"
  | "blocked"
  | "completed";

export type WorkCenterKind = "machine" | "labor" | "assembly" | "inspection";
export type DemandSource = "sales-order" | "contract" | "forecast" | "manual";
export type DispatchRule = "EDD" | "SPT" | "CR" | "WSPT" | "FIFO" | "MANUAL";

export interface DemandReference {
  source: DemandSource;
  sourceId?: string;
  customerId?: string;
  contractId?: string;
  /** فقط برای دامنه/گزارش پروژه؛ مبنای توالی یا زمان‌بندی Operation نیست. */
  projectId?: string;
}

export interface ProductionOrderDraft {
  id: string;
  orderNo: string;
  partId: string;
  quantity: number;
  dueAt: string;
  createdAt: string;
  demand: DemandReference;
  /** عدد کوچک‌تر یعنی اولویت دستی بالاتر؛ فقط برای قاعدهٔ MANUAL. */
  manualRank?: number;
}

export interface ReleasedBomReference {
  id: string;
  partId: string;
  revision: string;
  status: "released";
}

export interface RoutingOperationTemplate {
  id: string;
  sequence: number;
  operationCode: string;
  operationName: string;
  workCenterId: string;
  setupMinutes: number;
  runMinutesPerUnit: number;
  queueMinutes: number;
  moveMinutes: number;
  overlapAllowed: boolean;
}

export interface ReleasedRoutingReference {
  id: string;
  partId: string;
  revision: string;
  status: "released";
  operations: readonly RoutingOperationTemplate[];
}

export interface WorkCenterReference {
  id: string;
  code: string;
  kind: WorkCenterKind;
  active: boolean;
  resourceCount: number;
}

export interface ProductionOrderOperation extends RoutingOperationTemplate {
  /** شناسهٔ نمونهٔ Operation برای همین سفارش؛ از الگوی Routing جداست. */
  id: string;
  productionOrderId: string;
  status: ProductionOperationStatus;
  plannedQuantity: number;
  plannedCapacityMinutes: number;
  goodQuantity: number;
  reworkQuantity: number;
  scrapQuantity: number;
}

export interface ProductionOrder extends ProductionOrderDraft {
  status: ProductionOrderStatus;
  bomRevisionId?: string;
  routingRevisionId?: string;
  releasedAt?: string;
  operations: readonly ProductionOrderOperation[];
}

export type ProductionDomainEvent =
  | {
      type: "ProductionOrderCreated";
      aggregateId: string;
      occurredAt: string;
      payload: { orderNo: string; partId: string; quantity: number };
    }
  | {
      type: "ProductionOrderReleased";
      aggregateId: string;
      occurredAt: string;
      payload: {
        orderNo: string;
        bomRevisionId: string;
        routingRevisionId: string;
        operationCount: number;
      };
    }
  | {
      type: "ProductionOrderStatusChanged";
      aggregateId: string;
      occurredAt: string;
      payload: { from: ProductionOrderStatus; to: ProductionOrderStatus };
    };

export interface DomainResult<T> {
  value: T;
  event: ProductionDomainEvent;
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`MFG_VALIDATION: ${field} نباید خالی باشد`);
}

function requireTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`MFG_VALIDATION: ${field} باید تاریخ/زمان معتبر ISO باشد`);
  }
}

function requireNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`MFG_VALIDATION: ${field} باید عددی نامنفی و متناهی باشد`);
  }
}

function validateOrderDraft(draft: ProductionOrderDraft): void {
  requireText(draft.id, "شناسه سفارش");
  requireText(draft.orderNo, "شماره سفارش");
  requireText(draft.partId, "شناسه محصول");
  requireTimestamp(draft.createdAt, "createdAt");
  requireTimestamp(draft.dueAt, "dueAt");
  if (!Number.isFinite(draft.quantity) || draft.quantity <= 0) {
    throw new Error("MFG_VALIDATION: مقدار سفارش باید بزرگ‌تر از صفر باشد");
  }
  if (draft.demand.source !== "manual" && !draft.demand.sourceId?.trim()) {
    throw new Error("MFG_VALIDATION: سفارش غیر‌دستی باید مرجع تقاضا داشته باشد");
  }
  if (draft.demand.source === "contract" && !draft.demand.contractId?.trim()) {
    throw new Error("MFG_VALIDATION: سفارش قراردادی باید contractId داشته باشد");
  }
  if (draft.manualRank !== undefined) requireNonNegative(draft.manualRank, "manualRank");
}

/** ایجاد سفارش؛ در این مرحله هنوز برنامهٔ عملیاتی/ظرفیتی رزرو نشده است. */
export function createProductionOrder(draft: ProductionOrderDraft): DomainResult<ProductionOrder> {
  validateOrderDraft(draft);
  const order: ProductionOrder = { ...draft, status: "created", operations: [] };
  return {
    value: order,
    event: {
      type: "ProductionOrderCreated",
      aggregateId: order.id,
      occurredAt: order.createdAt,
      payload: { orderNo: order.orderNo, partId: order.partId, quantity: order.quantity },
    },
  };
}

export interface ReleaseOrderContext {
  bom: ReleasedBomReference;
  routing: ReleasedRoutingReference;
  workCenters: ReadonlyMap<string, WorkCenterReference>;
  releasedAt: string;
  /** تزریق شناسه‌ساز، برای تست و اجرای سرور قابل‌پیش‌بینی. */
  newId: () => string;
}

/**
 * آزادسازی، نسخهٔ BOM و Routing را روی سفارش تثبیت و Operationها را
 * از روی Routing به نمونه‌های مستقلِ سفارش تبدیل می‌کند.
 */
export function releaseProductionOrder(
  order: ProductionOrder,
  context: ReleaseOrderContext,
): DomainResult<ProductionOrder> {
  if (order.status !== "created") {
    throw new Error("MFG_STATE: فقط سفارش Created قابل آزادسازی است");
  }
  requireTimestamp(context.releasedAt, "releasedAt");
  if (context.bom.status !== "released" || context.routing.status !== "released") {
    throw new Error("MFG_RELEASE: BOM و Routing باید نسخهٔ Released داشته باشند");
  }
  if (context.bom.partId !== order.partId || context.routing.partId !== order.partId) {
    throw new Error("MFG_RELEASE: Part سفارش با BOM یا Routing هم‌خوان نیست");
  }
  if (context.routing.operations.length === 0) {
    throw new Error("MFG_RELEASE: Routing باید دست‌کم یک Operation داشته باشد");
  }

  const sortedTemplates = [...context.routing.operations].sort((a, b) => a.sequence - b.sequence);
  const seenSequences = new Set<number>();
  const seenOperationIds = new Set<string>();
  const operations: ProductionOrderOperation[] = sortedTemplates.map((template) => {
    if (!Number.isInteger(template.sequence) || template.sequence <= 0) {
      throw new Error("MFG_ROUTING: شماره توالی Operation باید عدد صحیح مثبت باشد");
    }
    if (seenSequences.has(template.sequence)) {
      throw new Error(`MFG_ROUTING: توالی تکراری ${template.sequence}`);
    }
    seenSequences.add(template.sequence);
    requireText(template.id, "شناسه الگوی Operation");
    requireText(template.operationCode, "کد Operation");
    requireText(template.operationName, "نام Operation");
    requireNonNegative(template.setupMinutes, "setupMinutes");
    requireNonNegative(template.runMinutesPerUnit, "runMinutesPerUnit");
    requireNonNegative(template.queueMinutes, "queueMinutes");
    requireNonNegative(template.moveMinutes, "moveMinutes");

    const workCenter = context.workCenters.get(template.workCenterId);
    if (!workCenter || !workCenter.active || workCenter.resourceCount <= 0) {
      throw new Error(`MFG_ROUTING: Work Center فعال/ظرفیت‌دار یافت نشد: ${template.workCenterId}`);
    }
    const id = context.newId();
    requireText(id, "شناسه نمونه Operation");
    if (seenOperationIds.has(id)) throw new Error("MFG_ID: شناسهٔ Operation تکراری تولید شد");
    seenOperationIds.add(id);

    return {
      ...template,
      id,
      productionOrderId: order.id,
      status: "pending",
      plannedQuantity: order.quantity,
      plannedCapacityMinutes: template.setupMinutes + template.runMinutesPerUnit * order.quantity,
      goodQuantity: 0,
      reworkQuantity: 0,
      scrapQuantity: 0,
    };
  });

  const released: ProductionOrder = {
    ...order,
    status: "released",
    bomRevisionId: context.bom.id,
    routingRevisionId: context.routing.id,
    releasedAt: context.releasedAt,
    operations,
  };
  return {
    value: released,
    event: {
      type: "ProductionOrderReleased",
      aggregateId: order.id,
      occurredAt: context.releasedAt,
      payload: {
        orderNo: order.orderNo,
        bomRevisionId: context.bom.id,
        routingRevisionId: context.routing.id,
        operationCount: operations.length,
      },
    },
  };
}

export interface OrderTransitionEvidence {
  firstOperationStarted?: boolean;
  allOperationsComplete?: boolean;
  quantitiesReconciled?: boolean;
  materialsReconciled?: boolean;
  costsReconciled?: boolean;
}

const NEXT_ORDER_STATES: Record<ProductionOrderStatus, readonly ProductionOrderStatus[]> = {
  created: [], // آزادسازی فقط از مسیر releaseProductionOrder مجاز است.
  released: ["in-progress"],
  "in-progress": ["completed"],
  completed: ["closed"],
  closed: [],
};

/** تغییر وضعیت سفارش با Guard؛ وضعیت را از روی عملیات حدس نمی‌زند. */
export function transitionProductionOrder(
  order: ProductionOrder,
  to: ProductionOrderStatus,
  occurredAt: string,
  evidence: OrderTransitionEvidence,
): DomainResult<ProductionOrder> {
  requireTimestamp(occurredAt, "occurredAt");
  if (!NEXT_ORDER_STATES[order.status].includes(to)) {
    throw new Error(`MFG_STATE: انتقال ${order.status} به ${to} مجاز نیست`);
  }
  if (to === "in-progress" && !evidence.firstOperationStarted) {
    throw new Error("MFG_STATE: سفارش با شروع اولین Operation وارد In Progress می‌شود");
  }
  if (to === "completed" && (!evidence.allOperationsComplete || !evidence.quantitiesReconciled)) {
    throw new Error("MFG_STATE: همه Operationها و مقادیر تولید باید تعیین‌تکلیف شوند");
  }
  if (
    to === "closed" &&
    (!evidence.allOperationsComplete || !evidence.quantitiesReconciled ||
      !evidence.materialsReconciled || !evidence.costsReconciled)
  ) {
    throw new Error("MFG_STATE: بستن سفارش به تکمیل عملیات، تطبیق مقدار، مواد و هزینه نیاز دارد");
  }

  return {
    value: { ...order, status: to },
    event: {
      type: "ProductionOrderStatusChanged",
      aggregateId: order.id,
      occurredAt,
      payload: { from: order.status, to },
    },
  };
}

export interface DispatchCandidate {
  id: string;
  dueAt: string;
  queueEnteredAt: string;
  /** زمان کار باقی‌مانده؛ برای CR شامل زمان جریان باقیمانده است. */
  remainingFlowMinutes: number;
  processingMinutes: number;
  priorityWeight?: number;
  manualRank?: number;
}

/**
 * مقایسهٔ دو سفارش/Operation واجد شرایطِ یک صف Work Center.
 * مقدار منفی یعنی a زودتر اعزام شود. فقط کارهای Ready باید وارد صف شوند.
 */
export function compareDispatchCandidates(
  rule: DispatchRule,
  a: DispatchCandidate,
  b: DispatchCandidate,
  nowEpochMs: number,
): number {
  const dueA = Date.parse(a.dueAt);
  const dueB = Date.parse(b.dueAt);
  const queuedA = Date.parse(a.queueEnteredAt);
  const queuedB = Date.parse(b.queueEnteredAt);
  if (![dueA, dueB, queuedA, queuedB, nowEpochMs].every(Number.isFinite)) {
    throw new Error("MFG_DISPATCH: تاریخ یا زمان نامعتبر است");
  }
  requireNonNegative(a.processingMinutes, "processingMinutes");
  requireNonNegative(b.processingMinutes, "processingMinutes");
  requireNonNegative(a.remainingFlowMinutes, "remainingFlowMinutes");
  requireNonNegative(b.remainingFlowMinutes, "remainingFlowMinutes");

  let primary = 0;
  switch (rule) {
    case "EDD":
      primary = dueA - dueB;
      break;
    case "SPT":
      primary = a.processingMinutes - b.processingMinutes;
      break;
    case "CR": {
      const cr = (dueAt: number, remaining: number) =>
        remaining === 0 ? Number.POSITIVE_INFINITY : (dueAt - nowEpochMs) / (remaining * 60_000);
      primary = cr(dueA, a.remainingFlowMinutes) - cr(dueB, b.remainingFlowMinutes);
      break;
    }
    case "WSPT": {
      const weightedTime = (item: DispatchCandidate) => {
        const weight = item.priorityWeight ?? 1;
        if (!Number.isFinite(weight) || weight <= 0) {
          throw new Error("MFG_DISPATCH: priorityWeight باید بزرگ‌تر از صفر باشد");
        }
        return item.processingMinutes / weight;
      };
      primary = weightedTime(a) - weightedTime(b);
      break;
    }
    case "FIFO":
      primary = queuedA - queuedB;
      break;
    case "MANUAL":
      primary = (a.manualRank ?? Number.POSITIVE_INFINITY) - (b.manualRank ?? Number.POSITIVE_INFINITY);
      break;
  }
  return primary || dueA - dueB || queuedA - queuedB || a.id.localeCompare(b.id);
}
