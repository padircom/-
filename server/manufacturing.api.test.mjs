import test from "node:test";
import assert from "node:assert/strict";
import { registerManufacturingRoutes } from "./manufacturingApi.js";
import { DEMO_SUBJECTS, evaluate } from "./rbacLogic.js";

function makeRepo() {
  const tables = new Map();
  let next = 1;
  const rows = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  const matches = (row, where = []) => where.every((w) => {
    const actual = row[w.column];
    if (w.op === "like") {
      const pattern = String(w.value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
      return new RegExp(`^${pattern}$`, "i").test(String(actual ?? ""));
    }
    if (w.op === "gte") return actual >= w.value;
    if (w.op === "lte") return actual <= w.value;
    return actual === w.value;
  });
  const repo = {
    tables,
    failCreateOn: null,
    async create(table, data, userId = "system") {
      if (repo.failCreateOn === table) {
        const error = new Error(`forced insert failure on ${table}`);
        error.code = "FORCED_INSERT_FAILURE";
        throw error;
      }
      const row = { ...data, Id: data.Id ?? `${table}-${next++}`, CreatedAt: new Date().toISOString(), CreatedBy: userId, RowVersion: 1 };
      rows(table).push(row);
      return row;
    },
    async get(table, id) { return rows(table).find((row) => row.Id === id) ?? null; },
    async findOne(table, where) { return rows(table).find((row) => matches(row, where)) ?? null; },
    async list(table, spec = {}) {
      let out = rows(table).filter((row) => matches(row, spec.where));
      for (const order of [...(spec.orderBy ?? [])].reverse()) {
        out = [...out].sort((a, b) => {
          const cmp = a[order.column] === b[order.column] ? 0 : a[order.column] < b[order.column] ? -1 : 1;
          return order.dir === "desc" ? -cmp : cmp;
        });
      }
      const offset = spec.offset ?? 0;
      return out.slice(offset, spec.limit === undefined ? undefined : offset + spec.limit);
    },
    async count(table, where = []) { return rows(table).filter((row) => matches(row, where)).length; },
    async patch(table, id, data, userId, expectedRowVersion) {
      const row = rows(table).find((item) => item.Id === id);
      if (!row) return { affected: 0, ok: false, code: "NOT_FOUND" };
      if (row.RowVersion !== expectedRowVersion) return { affected: 0, ok: false, code: "CONCURRENCY_CONFLICT" };
      Object.assign(row, data, { UpdatedAt: new Date().toISOString(), UpdatedBy: userId, RowVersion: row.RowVersion + 1 });
      return { affected: 1, ok: true };
    },
    async transaction(work) {
      const snapshot = new Map([...tables.entries()].map(([table, values]) => [table, structuredClone(values)]));
      const beforeNext = next;
      try {
        return await work(repo);
      } catch (error) {
        tables.clear();
        for (const [table, values] of snapshot) tables.set(table, values);
        next = beforeNext;
        throw error;
      }
    },
  };
  return repo;
}

function makeApi() {
  const handlers = new Map();
  const app = Object.fromEntries(["get", "post", "patch"].map((method) => [method, (path, handler) => handlers.set(`${method.toUpperCase()} ${path}`, handler)]));
  const repo = makeRepo();
  registerManufacturingRoutes(app, { repo: async () => repo, subjects: DEMO_SUBJECTS, evaluate });
  const call = async (method, path, { params = {}, query = {}, body = {}, headers = {}, requestId = "mfg-test" } = {}) => {
    const handler = handlers.get(`${method} ${path}`);
    assert.ok(handler, `route not registered: ${method} ${path}`);
    const req = { params, query, body, headers, requestId };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(bodyValue) { this.body = bodyValue; return this; },
    };
    await handler(req, res);
    return res;
  };
  return { repo, call };
}

const PARTS = "/api/mfg/plants/:plantId/parts";
const ORDERS = "/api/mfg/plants/:plantId/orders";
const ORDER = "/api/mfg/plants/:plantId/orders/:orderId";
const SCHEDULE_RUNS = "/api/mfg/plants/:plantId/scheduling/runs";
const SCHEDULE_GANTT = "/api/mfg/plants/:plantId/scheduling/gantt";
const CAPACITY_LOAD = "/api/mfg/plants/:plantId/capacity/load";
const CAPACITY_BOTTLENECKS = "/api/mfg/plants/:plantId/capacity/bottlenecks";

async function seedScheduleFixture(repo, { orderStatus = "released", secondOperation = true } = {}) {
  const order = await repo.create("MfgProductionOrder", {
    PlantId: "PLANT-DEMO", OrderNo: "MO-SCHED-1", PartId: "part-sched", OrderQuantity: 1,
    Uom: "ea", DueAt: "2026-10-05T18:00:00.000Z", RequestedStartAt: null,
    Status: orderStatus, PriorityRule: "EDD", DispatchWeight: 1, DemandSource: "manual", ManualRank: null,
  }, "u-mfg-plan");
  await repo.create("MfgWorkCenter", {
    PlantId: "PLANT-DEMO", Code: "WC-SCHED", NameFa: "مرکز آزمون", Kind: "machine",
    EfficiencyPct: 100, TimeZoneId: "UTC", Status: "active", NominalCapacityMinutesPerDay: 480,
  }, "u-mfg-eng");
  const workCenter = repo.tables.get("MfgWorkCenter")[0];
  const resource = await repo.create("MfgWorkCenterResource", {
    PlantId: "PLANT-DEMO", WorkCenterId: workCenter.Id, ResourceCode: "R-SCHED", NameFa: "منبع آزمون",
    ResourceKind: "machine", CapacityUnits: 1, AvailabilityPct: 100, IsActive: true,
  }, "u-mfg-eng");
  await repo.create("MfgWorkCenterCalendar", {
    PlantId: "PLANT-DEMO", WorkCenterId: workCenter.Id, RuleType: "weekly", RuleKey: "weekly-monday",
    WeekdayIso: 1, CalendarDate: null, ShiftCode: "A", StartMinuteOfDay: 480, EndMinuteOfDay: 1020,
    BreakMinutes: 60, BreakStartMinuteOfDay: 720, IsWorking: true, AvailabilityPct: 100,
    EffectiveFrom: "2026-01-01", EffectiveTo: null,
  }, "u-mfg-eng");
  const first = await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-DEMO", ProductionOrderId: order.Id, RoutingOperationId: null,
    SequenceNo: 1, OperationCode: "OP-10", OperationNameFa: "عملیات اول", WorkCenterId: workCenter.Id,
    PredecessorOperationId: null, Status: "pending", PlannedQuantity: 1, PlannedSetupMinutes: 30,
    PlannedRunMinutesPerUnit: 90, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 120,
    OverlapAllowed: false, TransferBatchQty: null, InspectionRequired: false,
  }, "u-mfg-plan");
  if (secondOperation) {
    await repo.create("MfgProductionOrderOperation", {
      PlantId: "PLANT-DEMO", ProductionOrderId: order.Id, RoutingOperationId: null,
      SequenceNo: 2, OperationCode: "OP-20", OperationNameFa: "عملیات دوم", WorkCenterId: workCenter.Id,
      PredecessorOperationId: first.Id, Status: "pending", PlannedQuantity: 1, PlannedSetupMinutes: 30,
      PlannedRunMinutesPerUnit: 90, PlannedQueueMinutes: 30, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 120,
      OverlapAllowed: false, TransferBatchQty: null, InspectionRequired: false,
    }, "u-mfg-plan");
  }
  return { order, workCenter, resource };
}

test("MFG REST: قطعه با Plant اجباری ثبت و فهرست می‌شود", async () => {
  const { call } = makeApi();
  const created = await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-101", NameFa: "قطعهٔ آلفا", PartType: "manufactured", BaseUom: "ea" },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.data.PlantId, "PLANT-DEMO");
  assert.equal(created.body.data.IsActive, true);
  assert.equal(created.body.data.CreatedBy, "u-mfg-eng");

  const list = await call("GET", PARTS, {
    params: { plantId: "PLANT-DEMO" }, query: { q: "P-10" }, headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.data.page.total, 1);
  assert.equal(list.body.data.items[0].PartNo, "P-101");
});

test("MFG REST: Plant scope به‌صورت fail-closed بین کارخانه‌ها اعمال می‌شود", async () => {
  const { call } = makeApi();
  const response = await call("GET", PARTS, {
    params: { plantId: "PLANT-OTHER" }, headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, "MFG_PLANT_SCOPE_DENIED");
});

test("MFG REST: ورودی نامعتبر و هویت نامعتبر پیش از ذخیره‌سازی رد می‌شوند", async () => {
  const { call } = makeApi();
  const invalid = await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-102", NameFa: "قطعه", PartType: "unknown", BaseUom: "ea" },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.error.code, "MFG_VALIDATION_FAILED");

  const anonymous = await call("GET", PARTS, { params: { plantId: "PLANT-DEMO" } });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(anonymous.body.error.code, "MFG_AUTH_REQUIRED");
});

test("MFG REST: سفارش فقط به قطعهٔ فعال همان کارخانه پیوند می‌خورد و ابتدا created است", async () => {
  const { repo, call } = makeApi();
  const part = await repo.create("MfgPart", {
    PlantId: "PLANT-DEMO", PartNo: "P-201", NameFa: "قطعهٔ بتا", PartType: "manufactured",
    BaseUom: "ea", IsActive: true, IsLotTracked: false, Currency: "IRR",
  }, "u-mfg-eng");
  const created = await call("POST", ORDERS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      OrderNo: "MO-2026-1", PartId: part.Id, OrderQuantity: 12, Uom: "ea",
      DueAt: "2026-11-10T12:00:00Z", DemandSource: "manual",
    },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.data.Status, "created");
  assert.equal(created.body.data.ProjectId, null);
  assert.equal(created.body.data.DispatchWeight, 1);

  const detail = await call("GET", ORDER, {
    params: { plantId: "PLANT-DEMO", orderId: created.body.data.Id }, headers: { "x-user-id": "u-mfg-plan" },
  });
  assert.equal(detail.statusCode, 200);
  assert.deepEqual(detail.body.data.Operations, []);

  const invalidWeight = await call("POST", ORDERS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      OrderNo: "MO-2026-1-BAD-WEIGHT", PartId: part.Id, OrderQuantity: 1, Uom: "ea",
      DueAt: "2026-11-10T12:00:00Z", DemandSource: "manual", DispatchWeight: 0,
    },
  });
  assert.equal(invalidWeight.statusCode, 400);
  assert.equal(invalidWeight.body.error.code, "MFG_VALIDATION_FAILED");

  const invalidLink = await call("POST", ORDERS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      OrderNo: "MO-2026-2", PartId: "part-in-other-plant", OrderQuantity: 1, Uom: "ea",
      DueAt: "2026-11-10T12:00:00Z", DemandSource: "manual",
    },
  });
  assert.equal(invalidLink.statusCode, 422);
  assert.equal(invalidLink.body.error.code, "MFG_PART_UNAVAILABLE");
});

test("MFG REST: تغییر اولویت و DispatchWeight با If-Match و RowVersion محافظت می‌شود", async () => {
  const { repo, call } = makeApi();
  const part = await repo.create("MfgPart", {
    PlantId: "PLANT-DEMO", PartNo: "P-301", NameFa: "قطعهٔ گاما", PartType: "manufactured",
    BaseUom: "ea", IsActive: true, IsLotTracked: false, Currency: "IRR",
  }, "u-mfg-eng");
  const order = await repo.create("MfgProductionOrder", {
    PlantId: "PLANT-DEMO", OrderNo: "MO-2026-3", PartId: part.Id, OrderQuantity: 4,
    Uom: "ea", DueAt: "2026-11-11T12:00:00Z", Status: "created", PriorityRule: "EDD", DemandSource: "manual",
    DispatchWeight: 1,
  }, "u-mfg-plan");

  const changed = await call("PATCH", `${ORDER}/priority`, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id }, headers: { "x-user-id": "u-mfg-plan", "if-match": '"1"' },
    body: { PriorityRule: "MANUAL", ManualRank: 2, DispatchWeight: 3.5 },
  });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.body.data.PriorityRule, "MANUAL");
  assert.equal(changed.body.data.DispatchWeight, 3.5);
  assert.equal(changed.body.data.RowVersion, 2);

  const stale = await call("PATCH", `${ORDER}/priority`, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id }, headers: { "x-user-id": "u-mfg-plan", "if-match": '"1"' },
    body: { PriorityRule: "EDD" },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.error.code, "MFG_ROW_VERSION_CONFLICT");
});

test("MFG REST: زمان‌بندی عملیات، استراحت، نسخه و تصویر ظرفیت را اتمیک ثبت می‌کند", async () => {
  const { repo, call } = makeApi();
  const { order } = await seedScheduleFixture(repo);
  const response = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward", CapacityMode: "finite", DispatchRule: "EDD",
      From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z",
      OrderIds: [order.Id], ExpectedScheduleVersion: 0,
    },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.ScheduleVersion, 1);
  assert.equal(response.body.data.assignments.length, 2);
  assert.equal(response.body.data.unscheduled.length, 0);
  const second = response.body.data.assignments.find((assignment) => assignment.SequenceNo === 2);
  assert.equal(second.Segments.length, 2);
  assert.equal(second.Segments[0].PlannedEndAt, "2026-10-05T12:00:00.000Z");
  assert.equal(second.Segments[1].PlannedStartAt, "2026-10-05T13:00:00.000Z");
  assert.equal(response.body.data.capacity[0].AvailableMinutes, 480);
  assert.equal(response.body.data.capacity[0].PlannedLoadMinutes, 240);
  assert.equal(repo.tables.get("MfgScheduleRun").length, 1);
  assert.equal(repo.tables.get("MfgOperationSchedule").length, 3);
  assert.equal(repo.tables.get("MfgCapacityPlan").length, 1);
  assert.equal(repo.tables.get("AuditLog").length, 1);

  const stale = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward", CapacityMode: "finite", DispatchRule: "EDD",
      From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z",
      OrderIds: [order.Id], ExpectedScheduleVersion: 0,
    },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.error.code, "MFG_SCHEDULE_VERSION_CONFLICT");
  assert.equal(repo.tables.get("MfgScheduleRun").length, 1);
});

test("MFG REST: Gantt نسخهٔ جاری را به Laneهای Plant-scoped و قطعه‌های مرتب تبدیل می‌کند", async () => {
  const { repo, call } = makeApi();
  const { order, workCenter } = await seedScheduleFixture(repo);
  const created = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward", CapacityMode: "finite", DispatchRule: "EDD",
      From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z", OrderIds: [order.Id],
    },
  });
  assert.equal(created.statusCode, 201);

  const gantt = await call("GET", SCHEDULE_GANTT, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-10-05T08:00:00Z", to: "2026-10-05T17:00:00Z" },
  });
  assert.equal(gantt.statusCode, 200);
  assert.equal(gantt.body.data.scheduleVersion, 1);
  assert.equal(gantt.body.data.lanes.length, 1);
  assert.equal(gantt.body.data.lanes[0].workCenter.Id, workCenter.Id);
  assert.equal(gantt.body.data.lanes[0].segments.length, 3);
  assert.deepEqual(
    gantt.body.data.lanes[0].segments.map((segment) => segment.PlannedStartAt),
    ["2026-10-05T08:00:00.000Z", "2026-10-05T10:30:00.000Z", "2026-10-05T13:00:00.000Z"],
  );
  assert.equal(gantt.body.data.lanes[0].segments[0].ProductionOrderId, order.Id);

  const filtered = await call("GET", SCHEDULE_GANTT, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: {
      from: "2026-10-05T11:45:00-00:00", to: "2026-10-05T14:00:00Z",
      workCenterId: workCenter.Id, orderId: order.Id, scheduleVersion: "1",
    },
  });
  assert.equal(filtered.statusCode, 200);
  assert.equal(filtered.body.data.scheduleVersion, 1);
  assert.equal(filtered.body.data.lanes.length, 1);
  assert.equal(filtered.body.data.lanes[0].segments.length, 2);
});

test("MFG REST: Gantt پنجرهٔ نامعتبر/۹۰روزه و نسخه/فیلتر خارج از Plant را رد می‌کند", async () => {
  const { repo, call } = makeApi();
  const foreignOrder = await repo.create("MfgProductionOrder", {
    PlantId: "PLANT-OTHER", OrderNo: "MO-OTHER", Status: "released",
  });
  const base = { from: "2026-01-01T00:00:00Z", to: "2026-04-02T00:00:00Z" };
  const tooLong = await call("GET", SCHEDULE_GANTT, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" }, query: base,
  });
  assert.equal(tooLong.statusCode, 400);
  assert.equal(tooLong.body.error.code, "MFG_VALIDATION_FAILED");

  const invalidRange = await call("GET", SCHEDULE_GANTT, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-01-02T00:00:00Z", to: "2026-01-02T00:00:00Z" },
  });
  assert.equal(invalidRange.statusCode, 400);
  assert.equal(invalidRange.body.error.code, "MFG_VALIDATION_FAILED");

  const missingVersion = await call("GET", SCHEDULE_GANTT, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z", scheduleVersion: "4" },
  });
  assert.equal(missingVersion.statusCode, 404);
  assert.equal(missingVersion.body.error.code, "MFG_SCHEDULE_VERSION_NOT_FOUND");

  const foreignCenter = await call("GET", SCHEDULE_GANTT, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z", workCenterId: "wc-other-plant" },
  });
  assert.equal(foreignCenter.statusCode, 404);
  assert.equal(foreignCenter.body.error.code, "MFG_NOT_FOUND");

  const foreignOrderFilter = await call("GET", SCHEDULE_GANTT, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: {
      from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z",
      orderId: foreignOrder.Id,
    },
  });
  assert.equal(foreignOrderFilter.statusCode, 404);
  assert.equal(foreignOrderFilter.body.error.code, "MFG_NOT_FOUND");
});

test("MFG REST: گزارش ظرفیت روزانه و هفتگی از Snapshot جاری با Plant scope خوانده می‌شود", async () => {
  const { repo, call } = makeApi();
  const { order, workCenter } = await seedScheduleFixture(repo);
  const run = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward", CapacityMode: "finite", DispatchRule: "EDD",
      From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z", OrderIds: [order.Id],
    },
  });
  assert.equal(run.statusCode, 201);

  const daily = await call("GET", CAPACITY_LOAD, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: {
      from: "2026-10-05T00:00:00Z", to: "2026-10-06T00:00:00Z",
      bucket: "day", workCenterId: workCenter.Id,
    },
  });
  assert.equal(daily.statusCode, 200);
  assert.equal(daily.body.data.scheduleVersion, 1);
  assert.equal(daily.body.data.bucket, "day");
  assert.equal(daily.body.data.buckets.length, 1);
  assert.equal(daily.body.data.buckets[0].WorkCenterId, workCenter.Id);
  assert.equal(daily.body.data.buckets[0].AvailableMinutes, 480);
  assert.equal(daily.body.data.buckets[0].PlannedLoadMinutes, 240);
  assert.equal(daily.body.data.buckets[0].UtilizationPct, 50);

  const weekly = await call("GET", CAPACITY_LOAD, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-10-05T00:00:00Z", to: "2026-10-12T00:00:00Z", bucket: "week" },
  });
  assert.equal(weekly.statusCode, 200);
  assert.equal(weekly.body.data.bucket, "week");
  assert.equal(weekly.body.data.buckets.length, 1);
  assert.equal(weekly.body.data.buckets[0].AvailableMinutes, 480);
  assert.equal(weekly.body.data.buckets[0].PlannedLoadMinutes, 240);
  assert.equal(weekly.body.data.buckets[0].UtilizationPct, 50);

  const otherPlantCenter = await repo.create("MfgWorkCenter", {
    PlantId: "PLANT-OTHER", Code: "WC-OTHER", NameFa: "مرکز دیگر", Kind: "machine",
    TimeZoneId: "UTC", Status: "active",
  });
  const foreignFilter = await call("GET", CAPACITY_LOAD, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-10-05T00:00:00Z", to: "2026-10-06T00:00:00Z", workCenterId: otherPlantCenter.Id },
  });
  assert.equal(foreignFilter.statusCode, 404);
  assert.equal(foreignFilter.body.error.code, "MFG_NOT_FOUND");

  const invalidBucket = await call("GET", CAPACITY_LOAD, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-10-05T00:00:00Z", to: "2026-10-06T00:00:00Z", bucket: "month" },
  });
  assert.equal(invalidBucket.statusCode, 400);
  assert.equal(invalidBucket.body.error.code, "MFG_VALIDATION_FAILED");
});

test("MFG REST: Bottleneckها آستانهٔ utilization و اضافه‌بار نسخهٔ جاری را رعایت می‌کنند", async () => {
  const { repo, call } = makeApi();
  const { order, workCenter } = await seedScheduleFixture(repo);
  const run = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward", CapacityMode: "finite", DispatchRule: "EDD",
      From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z", OrderIds: [order.Id],
    },
  });
  assert.equal(run.statusCode, 201);

  const defaultThreshold = await call("GET", CAPACITY_BOTTLENECKS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-10-05T00:00:00Z", to: "2026-10-06T00:00:00Z" },
  });
  assert.equal(defaultThreshold.statusCode, 200);
  assert.deepEqual(defaultThreshold.body.data.items, []);

  const lowerThreshold = await call("GET", CAPACITY_BOTTLENECKS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-10-05T00:00:00Z", to: "2026-10-06T00:00:00Z", minUtilizationPct: "50" },
  });
  assert.equal(lowerThreshold.statusCode, 200);
  assert.equal(lowerThreshold.body.data.items.length, 1);
  assert.equal(lowerThreshold.body.data.items[0].UtilizationPct, 50);
  assert.equal(lowerThreshold.body.data.items[0].OverloadMinutes, 0);

  await repo.create("MfgCapacityPlan", {
    PlantId: "PLANT-DEMO", WorkCenterId: workCenter.Id, ScheduleVersion: 1,
    PeriodStart: "2026-10-06T00:00:00.000Z", PeriodEnd: "2026-10-07T00:00:00.000Z",
    AvailableMinutes: 100, PlannedLoadMinutes: 150, ReservedMinutes: 0,
    UtilizationPct: 150, OverloadMinutes: 50, IsBottleneck: true,
    CalculatedAt: "2026-10-05T17:00:00.000Z", ModelVersion: "mfg-scheduler-v1",
  });
  const overloaded = await call("GET", CAPACITY_BOTTLENECKS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: {
      from: "2026-10-06T00:00:00Z", to: "2026-10-07T00:00:00Z",
      minUtilizationPct: "100",
    },
  });
  assert.equal(overloaded.statusCode, 200);
  assert.equal(overloaded.body.data.scheduleVersion, 1);
  assert.equal(overloaded.body.data.items.length, 1);
  assert.equal(overloaded.body.data.items[0].OverloadMinutes, 50);
  assert.equal(overloaded.body.data.items[0].UtilizationPct, 150);

  const invalidThreshold = await call("GET", CAPACITY_BOTTLENECKS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    query: { from: "2026-10-06T00:00:00Z", to: "2026-10-07T00:00:00Z", minUtilizationPct: "101" },
  });
  assert.equal(invalidThreshold.statusCode, 400);
  assert.equal(invalidThreshold.body.error.code, "MFG_VALIDATION_FAILED");
});

test("MFG REST: سفارش آزادنشده و پنجرهٔ بیش از ۳۶۵ روز رد می‌شوند", async () => {
  const { repo, call } = makeApi();
  const { order } = await seedScheduleFixture(repo, { orderStatus: "created", secondOperation: false });
  const base = {
    Direction: "forward", CapacityMode: "finite", DispatchRule: "WSPT",
    From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z", OrderIds: [order.Id],
  };
  const unreleased = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" }, body: base,
  });
  assert.equal(unreleased.statusCode, 422);
  assert.equal(unreleased.body.error.code, "MFG_ORDER_NOT_RELEASED");

  const tooLong = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: { ...base, OrderIds: undefined, From: "2026-01-01T00:00:00Z", To: "2027-01-02T00:00:00Z" },
  });
  assert.equal(tooLong.statusCode, 400);
  assert.equal(tooLong.body.error.code, "MFG_VALIDATION_FAILED");
});

test("MFG REST: شکست میان درج‌های schedule همهٔ جدول‌های run را rollback می‌کند", async () => {
  const { repo, call } = makeApi();
  await seedScheduleFixture(repo, { secondOperation: false });
  repo.failCreateOn = "MfgCapacityPlan";
  const originalConsoleError = console.error;
  console.error = () => {};
  let failed;
  try {
    failed = await call("POST", SCHEDULE_RUNS, {
      params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
      body: {
        Direction: "forward", CapacityMode: "finite", DispatchRule: "SPT",
        From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z",
      },
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(failed.statusCode, 500);
  assert.equal(repo.tables.get("MfgScheduleRun")?.length ?? 0, 0);
  assert.equal(repo.tables.get("MfgOperationSchedule")?.length ?? 0, 0);
  assert.equal(repo.tables.get("MfgCapacityPlan")?.length ?? 0, 0);
  assert.equal(repo.tables.get("AuditLog")?.length ?? 0, 0);
});
