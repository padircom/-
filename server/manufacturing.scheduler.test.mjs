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
