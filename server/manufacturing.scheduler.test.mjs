import test from "node:test";
import assert from "node:assert/strict";
import { planManufacturingSchedule, SchedulePlanningError } from "./manufacturingScheduler.js";

const PLANT = "PLANT-SCHED";
const WINDOW_FROM = Date.parse("2026-10-05T08:00:00.000Z");
const WINDOW_TO = Date.parse("2026-10-05T17:00:00.000Z");

function input({ orders, operations, calendars, downtime = [], direction = "forward", capacityMode = "finite", dispatchRule = "EDD", fromMs = WINDOW_FROM, toMs = WINDOW_TO, timeZone = "UTC" }) {
  const workCenters = [{
    Id: "wc-1", PlantId: PLANT, Code: "WC-1", Status: "active", TimeZoneId: timeZone, EfficiencyPct: 100,
  }];
  const resources = [{
    Id: "res-1", PlantId: PLANT, WorkCenterId: "wc-1", ResourceCode: "RES-1", IsActive: true,
    CapacityUnits: 1, AvailabilityPct: 100,
  }];
  return {
    plantId: PLANT,
    direction,
    capacityMode,
    dispatchRule,
    fromMs,
    toMs,
    scheduleVersion: 1,
    orders,
    operations,
    workCenters,
    resources,
    calendars,
    existingSchedules: [],
    executions: [],
    downtime,
    selectedOrderIds: new Set(orders.map((order) => order.Id)),
  };
}

function calendar({ start = 480, end = 1020, breakMinutes = 0, breakStart = null, availability = 100 } = {}) {
  return {
    Id: "cal-1", PlantId: PLANT, WorkCenterId: "wc-1", RuleType: "weekly", RuleKey: "mon-a",
    WeekdayIso: 1, CalendarDate: null, ShiftCode: "A", StartMinuteOfDay: start, EndMinuteOfDay: end,
    BreakMinutes: breakMinutes, BreakStartMinuteOfDay: breakStart, IsWorking: true,
    AvailabilityPct: availability, EffectiveFrom: "2026-01-01", EffectiveTo: null,
  };
}

function order(id, { due = "2026-10-05T18:00:00.000Z", weight = 1, manualRank = null, created = "2026-10-01T00:00:00.000Z" } = {}) {
  return {
    Id: id, PlantId: PLANT, OrderNo: id.toUpperCase(), Status: "released",
    DueAt: due, DispatchWeight: weight, ManualRank: manualRank, CreatedAt: created,
    RequestedStartAt: null,
  };
}

function operation(id, productionOrderId, sequence, duration, predecessor = null, extra = {}) {
  return {
    Id: id, PlantId: PLANT, ProductionOrderId: productionOrderId, SequenceNo: sequence,
    WorkCenterId: "wc-1", PredecessorOperationId: predecessor, Status: "pending",
    PlannedQuantity: 1, PlannedSetupMinutes: 0, PlannedRunMinutesPerUnit: duration,
    PlannedCapacityMinutes: duration, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0,
    ...extra,
  };
}

test("برنامهٔ forward وقت استراحت صریح و صف را رعایت می‌کند و Operation را چندقطعه می‌سازد", () => {
  const orders = [order("o-1")];
  const operations = [
    operation("op-1", "o-1", 1, 120),
    operation("op-2", "o-1", 2, 120, "op-1", { PlannedQueueMinutes: 30 }),
  ];
  const planned = planManufacturingSchedule(input({
    orders, operations, calendars: [calendar({ breakMinutes: 60, breakStart: 720 })],
  }));
  const second = planned.assignments.find((assignment) => assignment.ProductionOrderOperationId === "op-2");
  assert.equal(second.Segments.length, 2);
  assert.equal(second.Segments[0].PlannedStartAt, "2026-10-05T10:30:00.000Z");
  assert.equal(second.Segments[0].PlannedEndAt, "2026-10-05T12:00:00.000Z");
  assert.equal(second.Segments[1].PlannedStartAt, "2026-10-05T13:00:00.000Z");
  assert.equal(second.Segments[1].PlannedEndAt, "2026-10-05T13:30:00.000Z");
  assert.equal(planned.capacityRows[0].AvailableMinutes, 480);
  assert.equal(planned.summary.segmentCount, 3);
});

test("WSPT از DispatchWeight سفارش استفاده می‌کند و نسبت وزن به زمان را نزولی مرتب می‌کند", () => {
  const orders = [order("low", { weight: 1 }), order("high", { weight: 4 })];
  const operations = [operation("op-low", "low", 1, 60), operation("op-high", "high", 1, 60)];
  const planned = planManufacturingSchedule(input({
    orders, operations, calendars: [calendar()], dispatchRule: "WSPT",
  }));
  assert.equal(planned.assignments[0].ProductionOrderId, "high");
  assert.equal(planned.assignments[0].PlannedStartAt, "2026-10-05T08:00:00.000Z");
  assert.equal(planned.assignments[1].PlannedStartAt, "2026-10-05T09:00:00.000Z");
});

test("semi-finite هم‌پوشانی را می‌پذیرد و اضافه‌بار را به ظرفیت گزارش می‌کند", () => {
  const orders = [order("a"), order("b")];
  const operations = [operation("op-a", "a", 1, 300), operation("op-b", "b", 1, 300)];
  const planned = planManufacturingSchedule(input({
    orders, operations,
    calendars: [calendar({ start: 480, end: 960 })],
    capacityMode: "semi-finite",
  }));
  assert.equal(planned.unscheduled.length, 0);
  assert.equal(planned.assignments[0].PlannedStartAt, "2026-10-05T08:00:00.000Z");
  assert.equal(planned.assignments[1].PlannedStartAt, "2026-10-05T08:00:00.000Z");
  assert.equal(planned.capacityRows[0].AvailableMinutes, 480);
  assert.equal(planned.capacityRows[0].PlannedLoadMinutes, 600);
  assert.equal(planned.capacityRows[0].OverloadMinutes, 120);
  assert.equal(planned.capacityRows[0].IsBottleneck, true);
});

test("backward به DueAt و رابطهٔ پیش‌نیازی احترام می‌گذارد", () => {
  const orders = [order("o-1", { due: "2026-10-05T17:00:00.000Z" })];
  const operations = [
    operation("op-1", "o-1", 1, 120),
    operation("op-2", "o-1", 2, 90, "op-1", { PlannedQueueMinutes: 30 }),
  ];
  const planned = planManufacturingSchedule(input({
    orders, operations, calendars: [calendar({ breakMinutes: 60, breakStart: 720 })], direction: "backward",
  }));
  const first = planned.assignments.find((assignment) => assignment.SequenceNo === 1);
  const second = planned.assignments.find((assignment) => assignment.SequenceNo === 2);
  assert.equal(second.PlannedEndAt, "2026-10-05T17:00:00.000Z");
  assert.equal(first.PlannedEndAt, "2026-10-05T15:00:00.000Z");
  assert.ok(Date.parse(first.PlannedEndAt) <= Date.parse(second.PlannedStartAt) - 30 * 60_000);
});

test("اگر پیش‌نیاز در برنامهٔ backward جا نشود، Operation وابسته هم حذف می‌شود", () => {
  const orders = [order("o-1")];
  const operations = [
    operation("op-1", "o-1", 1, 60, null, { WorkCenterId: "wc-no-calendar" }),
    operation("op-2", "o-1", 2, 60, "op-1", { WorkCenterId: "wc-1" }),
  ];
  const scenario = input({ orders, operations, calendars: [calendar()], direction: "backward" });
  scenario.workCenters.push({
    Id: "wc-no-calendar", PlantId: PLANT, Code: "WC-NO-CAL", Status: "active", TimeZoneId: "UTC", EfficiencyPct: 100,
  });
  const planned = planManufacturingSchedule(scenario);
  assert.equal(planned.assignments.length, 0);
  assert.deepEqual(new Set(planned.unscheduled.map((item) => item.Reason)), new Set(["NO_WORKING_CALENDAR", "PREDECESSOR_UNSCHEDULED"]));
  assert.equal(planned.scheduleSegments.length, 0);
});

test("توقف ثبت‌شدهٔ مرکز/منبع از برنامه و ظرفیت قابل‌استفاده کسر می‌شود", () => {
  const orders = [order("o-1")];
  const operations = [operation("op-1", "o-1", 1, 60)];
  const planned = planManufacturingSchedule(input({
    orders, operations, calendars: [calendar()],
    downtime: [{
      Id: "down-1", PlantId: PLANT, WorkCenterId: "wc-1", ResourceId: null,
      StartedAt: "2026-10-05T08:00:00.000Z", FinishedAt: "2026-10-05T09:00:00.000Z", DowntimeType: "planned",
    }],
  }));
  assert.equal(planned.assignments[0].PlannedStartAt, "2026-10-05T09:00:00.000Z");
  assert.equal(planned.capacityRows[0].AvailableMinutes, 480);
});

test("زمان محلی Work Center به UTC تبدیل می‌شود و استراحت فاقد شروع صریح خطاست", () => {
  const orders = [order("o-1")];
  const operations = [operation("op-1", "o-1", 1, 60)];
  const tehran = calendar({ start: 480, end: 1020 });
  const planned = planManufacturingSchedule(input({
    orders, operations, calendars: [tehran], timeZone: "Asia/Tehran",
    fromMs: Date.parse("2026-10-05T04:30:00.000Z"),
    toMs: Date.parse("2026-10-05T13:30:00.000Z"),
  }));
  assert.equal(planned.assignments[0].PlannedStartAt, "2026-10-05T04:30:00.000Z");

  assert.throws(() => planManufacturingSchedule(input({
    orders, operations, calendars: [calendar({ breakMinutes: 30, breakStart: null })],
  })), (error) => error instanceof SchedulePlanningError && error.code === "MFG_CALENDAR_BREAK_START_REQUIRED");
});

test("باززمان‌بندی با selectedOperationIds فقط عملیات هدف و پس‌نیاز وابسته را جابه‌جا می‌کند و diff دقیق می‌دهد", () => {
  const orders = [order("o-1"), order("o-2")];
  const operations = [
    operation("op-10", "o-1", 1, 60),
    operation("op-20", "o-1", 2, 60, "op-10"),
    operation("op-30", "o-1", 3, 60, "op-20"),
    operation("op-other", "o-2", 1, 60),
  ];
  const baseCalendars = [calendar({ start: 480, end: 1020 })];
  const v1 = planManufacturingSchedule(input({
    orders,
    operations,
    calendars: baseCalendars,
  }));
  assert.equal(v1.assignments.length, 4);

  const v2 = planManufacturingSchedule({
    ...input({
      orders,
      operations,
      calendars: baseCalendars,
      downtime: [{
        Id: "down-op20", PlantId: PLANT, WorkCenterId: "wc-1", ResourceId: null,
        StartedAt: "2026-10-05T09:00:00.000Z", FinishedAt: "2026-10-05T11:00:00.000Z", DowntimeType: "unplanned",
      }],
    }),
    previousScheduleVersion: 1,
    scheduleVersion: 2,
    existingSchedules: v1.scheduleSegments,
    selectedOperationIds: ["op-20"],
  });

  assert.deepEqual(v2.rescheduledOperationIds, ["op-20", "op-30"]);
  const op10 = v2.assignments.find((item) => item.ProductionOrderOperationId === "op-10");
  const opOther = v2.assignments.find((item) => item.ProductionOrderOperationId === "op-other");
  const op20 = v2.assignments.find((item) => item.ProductionOrderOperationId === "op-20");
  const op30 = v2.assignments.find((item) => item.ProductionOrderOperationId === "op-30");

  assert.equal(op10.Preserved, true);
  assert.equal(op10.PlannedStartAt, "2026-10-05T08:00:00.000Z");
  assert.equal(op10.PlannedEndAt, "2026-10-05T09:00:00.000Z");
  assert.equal(opOther.Preserved, true);
  assert.equal(op20.Preserved, false);
  assert.equal(op30.Preserved, false);
  assert.ok(Date.parse(op20.PlannedStartAt) >= Date.parse("2026-10-05T11:00:00.000Z"));
  assert.ok(Date.parse(op30.PlannedStartAt) >= Date.parse(op20.PlannedEndAt));

  assert.equal(v2.diff.fromScheduleVersion, 1);
  assert.equal(v2.diff.toScheduleVersion, 2);
  assert.equal(v2.diff.changedOperationCount, 2);
  assert.equal(v2.diff.unchangedOperationCount, 2);
  assert.equal(v2.diff.movedCount, 2);
  assert.deepEqual(
    v2.diff.changedOperations.map((item) => item.ProductionOrderOperationId),
    ["op-20", "op-30"],
  );
  const diffOp10 = v2.diff.operations.find((item) => item.ProductionOrderOperationId === "op-10");
  assert.equal(diffOp10.Changed, false);
  assert.equal(diffOp10.Preserved, true);
});

test("باززمان‌بندی firm blockها را حفظ می‌کند و عملیات غیرقابل‌اعزام یا خارج از Plant را رد می‌کند", () => {
  const orders = [
    order("o-firm", { weight: 1 }),
    order("o-target", { weight: 5 }),
    { ...order("o-created"), Status: "created" },
  ];
  const operations = [
    operation("op-firm", "o-firm", 1, 120),
    operation("op-target", "o-target", 1, 60),
    operation("op-running", "o-target", 2, 60, null, { Status: "running" }),
    operation("op-unreleased", "o-created", 1, 60),
  ];
  const existingSchedules = [{
    Id: "seg-firm-1",
    PlantId: PLANT,
    ProductionOrderOperationId: "op-firm",
    ScheduleVersion: 1,
    SegmentNo: 1,
    WorkCenterId: "wc-1",
    ResourceId: "res-1",
    PlannedStartAt: "2026-10-05T08:00:00.000Z",
    PlannedEndAt: "2026-10-05T10:00:00.000Z",
    PlannedCapacityMinutes: 120,
    QueueMinutes: 0,
    MoveMinutes: 0,
    CapacityMode: "finite",
    Direction: "forward",
    DispatchRule: "EDD",
    Status: "firm",
  }, {
    Id: "seg-target-1",
    PlantId: PLANT,
    ProductionOrderOperationId: "op-target",
    ScheduleVersion: 1,
    SegmentNo: 1,
    WorkCenterId: "wc-1",
    ResourceId: "res-1",
    PlannedStartAt: "2026-10-05T11:00:00.000Z",
    PlannedEndAt: "2026-10-05T12:00:00.000Z",
    PlannedCapacityMinutes: 60,
    QueueMinutes: 0,
    MoveMinutes: 0,
    CapacityMode: "finite",
    Direction: "forward",
    DispatchRule: "EDD",
    Status: "tentative",
  }];

  const planned = planManufacturingSchedule({
    ...input({ orders, operations, calendars: [calendar()], dispatchRule: "WSPT", capacityMode: "semi-finite" }),
    previousScheduleVersion: 1,
    scheduleVersion: 2,
    existingSchedules,
    selectedOperationIds: ["op-firm", "op-target"],
  });

  const firmAssignment = planned.assignments.find((item) => item.ProductionOrderOperationId === "op-firm");
  const targetAssignment = planned.assignments.find((item) => item.ProductionOrderOperationId === "op-target");
  assert.equal(firmAssignment.Status, "firm");
  assert.equal(firmAssignment.Preserved, true);
  assert.equal(firmAssignment.PlannedStartAt, "2026-10-05T08:00:00.000Z");
  assert.equal(firmAssignment.PlannedEndAt, "2026-10-05T10:00:00.000Z");
  assert.equal(targetAssignment.PlannedStartAt, "2026-10-05T10:00:00.000Z");
  assert.equal(targetAssignment.PlannedEndAt, "2026-10-05T11:00:00.000Z");
  assert.equal(planned.capacityRows[0].ReservedMinutes, 120);

  assert.throws(() => planManufacturingSchedule({
    ...input({ orders, operations, calendars: [calendar()] }),
    selectedOperationIds: ["op-running"],
  }), (error) => error instanceof SchedulePlanningError && error.code === "MFG_OPERATION_NOT_DISPATCHABLE");

  assert.throws(() => planManufacturingSchedule({
    ...input({ orders, operations, calendars: [calendar()] }),
    selectedOperationIds: ["op-unreleased"],
  }), (error) => error instanceof SchedulePlanningError && error.code === "MFG_ORDER_NOT_RELEASED");

  assert.throws(() => planManufacturingSchedule({
    ...input({ orders, operations, calendars: [calendar()] }),
    selectedOperationIds: ["op-missing"],
  }), (error) => error instanceof SchedulePlanningError && error.code === "MFG_OPERATION_NOT_FOUND");
});

/* ═══════════════════════ فاز ۵ — تقسیم لات و هم‌پوشانی ═══════════════════════
 * هر دو عملیات روی مرکز کاری/منبع جداگانه هستند تا ظرفیت محدودِ یک منبع،
 * اثر هم‌پوشانی را پنهان نکند. */

function dualInput({ orders, operations, direction = "forward", capacityMode = "finite", dispatchRule = "EDD", fromMs = WINDOW_FROM, toMs = WINDOW_TO }) {
  const workCenters = [
    { Id: "wc-1", PlantId: PLANT, Code: "WC-1", Status: "active", TimeZoneId: "UTC", EfficiencyPct: 100 },
    { Id: "wc-2", PlantId: PLANT, Code: "WC-2", Status: "active", TimeZoneId: "UTC", EfficiencyPct: 100 },
  ];
  const resources = [
    { Id: "res-1", PlantId: PLANT, WorkCenterId: "wc-1", ResourceCode: "RES-1", IsActive: true, CapacityUnits: 1, AvailabilityPct: 100 },
    { Id: "res-2", PlantId: PLANT, WorkCenterId: "wc-2", ResourceCode: "RES-2", IsActive: true, CapacityUnits: 1, AvailabilityPct: 100 },
  ];
  const calendars = [
    calendar(),
    { ...calendar(), Id: "cal-2", WorkCenterId: "wc-2", RuleKey: "mon-b" },
  ];
  return {
    plantId: PLANT, direction, capacityMode, dispatchRule, fromMs, toMs, scheduleVersion: 1,
    orders, operations, workCenters, resources, calendars,
    existingSchedules: [], executions: [], downtime: [],
    selectedOrderIds: new Set(orders.map((item) => item.Id)),
  };
}

const tenUnitsAt20 = { PlannedQuantity: 10, PlannedSetupMinutes: 0, PlannedRunMinutesPerUnit: 20, PlannedCapacityMinutes: 200 };

test("فاز۵: هم‌پوشانی، عملیات بعدی را از آماده‌شدن لات انتقال شروع می‌کند", () => {
  const orders = [order("o-1")];
  const makeOperations = (overlap) => [
    operation("op-1", "o-1", 1, 200, null, {
      WorkCenterId: "wc-1", ...tenUnitsAt20,
      OverlapAllowed: overlap, TransferBatchQty: overlap ? 5 : null,
    }),
    operation("op-2", "o-1", 2, 200, "op-1", { WorkCenterId: "wc-2", ...tenUnitsAt20 }),
  ];

  const baseline = planManufacturingSchedule(dualInput({ orders, operations: makeOperations(false) }));
  const baselineSecond = baseline.assignments.find((item) => item.ProductionOrderOperationId === "op-2");
  assert.equal(baselineSecond.PlannedStartAt, "2026-10-05T11:20:00.000Z", "بدون هم‌پوشانی از پایان کامل عملیات قبلی");
  assert.equal(baselineSecond.PlannedEndAt, "2026-10-05T14:40:00.000Z");

  const overlapped = planManufacturingSchedule(dualInput({ orders, operations: makeOperations(true) }));
  const first = overlapped.assignments.find((item) => item.ProductionOrderOperationId === "op-1");
  const second = overlapped.assignments.find((item) => item.ProductionOrderOperationId === "op-2");
  /* لات انتقال ۵ عدد × ۲۰ دقیقه = ۱۰۰ دقیقه پس از شروع عملیات اول آماده است. */
  assert.equal(first.TransferReadyMinutes, 100);
  assert.equal(first.TransferReadyAt, "2026-10-05T09:40:00.000Z");
  assert.equal(first.PlannedEndAt, "2026-10-05T11:20:00.000Z", "انتهای عملیات اول تغییر نمی‌کند");
  assert.equal(second.PlannedStartAt, "2026-10-05T09:40:00.000Z", "عملیات دوم ۱۰۰ دقیقه زودتر شروع می‌شود");
  assert.equal(second.PlannedEndAt, "2026-10-05T13:00:00.000Z");
});

test("فاز۵: درصد هم‌پوشانی جایگزین مقدار لات انتقال است", () => {
  const orders = [order("o-1")];
  const operations = [
    operation("op-1", "o-1", 1, 200, null, {
      WorkCenterId: "wc-1", ...tenUnitsAt20, OverlapAllowed: true, TransferBatchQty: null, OverlapPct: 50,
    }),
    operation("op-2", "o-1", 2, 200, "op-1", { WorkCenterId: "wc-2", ...tenUnitsAt20 }),
  ];
  const planned = planManufacturingSchedule(dualInput({ orders, operations }));
  const first = planned.assignments.find((item) => item.ProductionOrderOperationId === "op-1");
  const second = planned.assignments.find((item) => item.ProductionOrderOperationId === "op-2");
  /* ۵۰٪ هم‌پوشانی روی ۱۰ عدد یعنی لات انتقال ۵ عدد → همان ۱۰۰ دقیقه. */
  assert.equal(first.TransferBatchQty, 5);
  assert.equal(second.PlannedStartAt, "2026-10-05T09:40:00.000Z");
});

test("فاز۵: تقسیم لات قطعه‌های زمان‌بندی را به زیرلات‌های متوالی می‌شکند", () => {
  const orders = [order("o-1")];
  const operations = [
    operation("op-1", "o-1", 1, 200, null, { WorkCenterId: "wc-1", ...tenUnitsAt20, SplitLotCount: 2 }),
  ];
  const planned = planManufacturingSchedule(dualInput({ orders, operations }));
  const assignment = planned.assignments.find((item) => item.ProductionOrderOperationId === "op-1");
  assert.equal(assignment.SplitLotCount, 2);
  assert.equal(assignment.Segments.length, 2);
  assert.deepEqual(assignment.Segments.map((segment) => segment.SegmentNo), [1, 2]);
  assert.deepEqual(assignment.Segments.map((segment) => [segment.PlannedStartAt, segment.PlannedEndAt]), [
    ["2026-10-05T08:00:00.000Z", "2026-10-05T09:40:00.000Z"],
    ["2026-10-05T09:40:00.000Z", "2026-10-05T11:20:00.000Z"],
  ]);
  /* جمع دقایق ظرفیت پس از تقسیم دست‌نخورده می‌ماند. */
  assert.equal(assignment.PlannedCapacityMinutes, 200);
  assert.deepEqual(assignment.Segments.map((segment) => segment.PlannedCapacityMinutes), [100, 100]);
  assert.equal(planned.scheduleSegments.every((segment) => segment._splitLotNo === undefined), true, "نشانگر داخلی به خروجی نشت نمی‌کند");
});

test("فاز۵: هم‌پوشانی در زمان‌بندی رو‌به‌عقب انتهای عملیات قبلی را دیرتر می‌برد", () => {
  const orders = [order("o-1", { due: "2026-10-05T17:00:00.000Z" })];
  const makeOperations = (overlap) => [
    operation("op-1", "o-1", 1, 200, null, {
      WorkCenterId: "wc-1", ...tenUnitsAt20,
      OverlapAllowed: overlap, TransferBatchQty: overlap ? 5 : null,
    }),
    operation("op-2", "o-1", 2, 200, "op-1", { WorkCenterId: "wc-2", ...tenUnitsAt20 }),
  ];

  const baseline = planManufacturingSchedule(dualInput({ orders, operations: makeOperations(false), direction: "backward" }));
  const baselineFirst = baseline.assignments.find((item) => item.ProductionOrderOperationId === "op-1");
  assert.equal(baselineFirst.PlannedEndAt, "2026-10-05T13:40:00.000Z", "بدون هم‌پوشانی باید پیش از شروع عملیات بعدی تمام شود");

  const overlapped = planManufacturingSchedule(dualInput({ orders, operations: makeOperations(true), direction: "backward" }));
  const first = overlapped.assignments.find((item) => item.ProductionOrderOperationId === "op-1");
  const second = overlapped.assignments.find((item) => item.ProductionOrderOperationId === "op-2");
  assert.equal(second.PlannedStartAt, "2026-10-05T13:40:00.000Z");
  /* دنبالهٔ هم‌پوشان ۱۰۰ دقیقه است؛ پس عملیات اول تا ۱۵:۲۰ ادامه دارد. */
  assert.equal(first.PlannedEndAt, "2026-10-05T15:20:00.000Z");
});

test("فاز۵: لات انتقال برابر کل مقدار، هم‌پوشانی نمی‌سازد", () => {
  const orders = [order("o-1")];
  const operations = [
    operation("op-1", "o-1", 1, 200, null, {
      WorkCenterId: "wc-1", ...tenUnitsAt20, OverlapAllowed: true, TransferBatchQty: 10,
    }),
    operation("op-2", "o-1", 2, 200, "op-1", { WorkCenterId: "wc-2", ...tenUnitsAt20 }),
  ];
  const planned = planManufacturingSchedule(dualInput({ orders, operations }));
  const first = planned.assignments.find((item) => item.ProductionOrderOperationId === "op-1");
  const second = planned.assignments.find((item) => item.ProductionOrderOperationId === "op-2");
  assert.equal(first.TransferReadyAt, null);
  assert.equal(second.PlannedStartAt, "2026-10-05T11:20:00.000Z");
});
