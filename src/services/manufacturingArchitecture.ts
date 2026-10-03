/**
 * قراردادهای معماری MFG: رویداد، Observer، Strategy و Scheduler Factory.
 * این فایل pure logic است؛ اتصال SQL و HTTP در لایه‌های زیرساخت قرار می‌گیرد.
 */

import {
  compareDispatchCandidates,
  type DispatchCandidate,
  type DispatchRule,
} from "./manufacturingModel";

export const MANUFACTURING_EVENT_SCHEMA_VERSION = "1.0" as const;

export type ManufacturingEventType =
  | "mfg.production-order.created"
  | "mfg.production-order.released"
  | "mfg.schedule.published"
  | "mfg.operation.started"
  | "mfg.operation.quantity-reported"
  | "mfg.operation.downtime-recorded"
  | "mfg.operation.finished"
  | "mfg.material.shortage-detected"
  | "mfg.cost.variance-detected"
  | "mfg.alert.raised"
  | "mfg.alert.resolved";

/** تولید مستقل از پروژه است؛ شناسهٔ کارخانه اجباری و پروژه اختیاری است. */
export interface ManufacturingScope {
  plantId: string;
  projectId?: string;
}

/**
 * پاکت رویدادِ تغییرناپذیر برای Outbox و مصرف‌کننده‌ها.
 * رویداد «واقعیت انجام‌شده» را بیان می‌کند، نه فرمانی برای تغییر مالکیت داده.
 */
export interface ManufacturingEvent<Payload extends Record<string, unknown> = Record<string, unknown>> {
  eventKey: string;
  eventType: ManufacturingEventType;
  schemaVersion: string;
  sourceModule: "mfg";
  targetModule?: string;
  aggregateType: "ProductionOrder" | "ProductionOrderOperation" | "WorkCenter" | "MaterialRequirement";
  aggregateId: string;
  scope: ManufacturingScope;
  occurredAt: string;
  payload: Payload;
}

export interface ManufacturingEventInput<Payload extends Record<string, unknown> = Record<string, unknown>> {
  eventKey: string;
  eventType: ManufacturingEventType;
  aggregateType: ManufacturingEvent<Payload>["aggregateType"];
  aggregateId: string;
  scope: ManufacturingScope;
  occurredAt: string;
  payload: Payload;
  targetModule?: string;
}

function requireValue(value: string, field: string, maxLength: number): void {
  if (!value.trim() || value.length > maxLength) {
    throw new Error(`MFG_EVENT: ${field} خالی یا طول آن بیش از حد مجاز است`);
  }
}

/** اعتبارسنجی و ساخت پاکت؛ هیچ I/O یا انتشار پنهانی انجام نمی‌دهد. */
export function createManufacturingEvent<Payload extends Record<string, unknown>>(
  input: ManufacturingEventInput<Payload>,
): ManufacturingEvent<Payload> {
  requireValue(input.eventKey, "eventKey", 160);
  requireValue(input.aggregateId, "aggregateId", 120);
  requireValue(input.scope.plantId, "plantId", 60);
  if (input.scope.projectId !== undefined) requireValue(input.scope.projectId, "projectId", 60);
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error("MFG_EVENT: occurredAt باید تاریخ/زمان ISO معتبر باشد");
  }
  if (input.targetModule !== undefined) requireValue(input.targetModule, "targetModule", 20);
  return {
    eventKey: input.eventKey,
    eventType: input.eventType,
    schemaVersion: MANUFACTURING_EVENT_SCHEMA_VERSION,
    sourceModule: "mfg",
    ...(input.targetModule ? { targetModule: input.targetModule } : {}),
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    scope: { ...input.scope },
    occurredAt: input.occurredAt,
    payload: { ...input.payload },
  };
}

export type ManufacturingEventObserver = {
  name: string;
  /** نبودن فیلتر یعنی Observer همهٔ انواع رویداد را می‌گیرد. */
  eventTypes?: readonly ManufacturingEventType[];
  onEvent: (event: ManufacturingEvent) => void | Promise<void>;
};

export interface ObserverDispatchResult {
  notified: string[];
  failed: Array<{ observer: string; reason: string }>;
}

/**
 * Observerهای درون‌فرایندی برای هشدار و Read Model.
 * این Hub جای Outbox پایدار را نمی‌گیرد؛ فقط پس از Commit/ثبت رویداد صدا زده شود.
 */
export function createManufacturingObserverHub() {
  const observers = new Map<number, ManufacturingEventObserver>();
  let nextSubscriptionId = 1;

  return {
    subscribe(observer: ManufacturingEventObserver): () => void {
      requireValue(observer.name, "observer.name", 80);
      const id = nextSubscriptionId++;
      observers.set(id, observer);
      return () => { observers.delete(id); };
    },

    async notify(event: ManufacturingEvent): Promise<ObserverDispatchResult> {
      const targets = [...observers.values()].filter(
        (observer) => !observer.eventTypes || observer.eventTypes.includes(event.eventType),
      );
      const outcomes = await Promise.all(targets.map(async (observer) => {
        try {
          await observer.onEvent(event);
          return { observer: observer.name, ok: true as const };
        } catch (error) {
          return {
            observer: observer.name,
            ok: false as const,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      }));
      return {
        notified: outcomes.filter((result) => result.ok).map((result) => result.observer),
        failed: outcomes.filter((result) => !result.ok).map((result) => ({
          observer: result.observer,
          reason: result.ok ? "" : result.reason,
        })),
      };
    },
  };
}

/** Strategy برای انتخاب ترتیب اعزام در یک صف Work Center. */
export type DispatchStrategy = (a: DispatchCandidate, b: DispatchCandidate) => number;

export function createDispatchStrategy(rule: DispatchRule, nowEpochMs: number): DispatchStrategy {
  return (a, b) => compareDispatchCandidates(rule, a, b, nowEpochMs);
}

export type SchedulingCapacityMode = "finite" | "semi-finite";
export type SchedulingDirection = "forward" | "backward";
export type SchedulingEngineKey = `${SchedulingCapacityMode}:${SchedulingDirection}`;

export interface SchedulingEngine<Input, Output> {
  run(input: Input): Output;
}

export type SchedulingEngineRegistry<Input, Output> = Record<
  SchedulingEngineKey,
  SchedulingEngine<Input, Output>
>;

/** Factory نوع زمان‌بندی و جهت را به Engine متناظر وصل می‌کند. */
export function createSchedulingEngine<Input, Output>(
  capacityMode: SchedulingCapacityMode,
  direction: SchedulingDirection,
  engines: SchedulingEngineRegistry<Input, Output>,
): SchedulingEngine<Input, Output> {
  const key: SchedulingEngineKey = `${capacityMode}:${direction}`;
  const engine = engines[key];
  if (!engine) throw new Error(`MFG_SCHEDULER: موتور زمان‌بندی تعریف نشده است: ${key}`);
  return engine;
}
