import test from "node:test";
import assert from "node:assert/strict";
import { MANUFACTURING_IMPLEMENTED_ROUTES, registerManufacturingRoutes } from "./manufacturingApi.js";
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
    if (w.op === "in") return Array.isArray(w.value) && w.value.includes(actual);
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
    async remove(table, id) {
      const list = rows(table);
      const index = list.findIndex((item) => item.Id === id);
      if (index === -1) return { affected: 0 };
      list.splice(index, 1);
      return { affected: 1 };
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
  const app = Object.fromEntries(["get", "post", "patch", "delete"].map((method) => [method, (path, handler) => handlers.set(`${method.toUpperCase()} ${path}`, handler)]));
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
      end() { return this; },
    };
    await handler(req, res);
    return res;
  };
  return { repo, call };
}

const PARTS = "/api/mfg/plants/:plantId/parts";
const PART = "/api/mfg/plants/:plantId/parts/:partId";
const BOM_HEADERS = "/api/mfg/plants/:plantId/bom-headers";
const BOM_HEADER = "/api/mfg/plants/:plantId/bom-headers/:bomId";
const BOM_ITEMS = "/api/mfg/plants/:plantId/bom-headers/:bomId/items";
const BOM_ITEM = "/api/mfg/plants/:plantId/bom-items/:itemId";
const BOM_RELEASE = "/api/mfg/plants/:plantId/bom-headers/:bomId/release";
const BOM_EXPLOSIONS = "/api/mfg/plants/:plantId/bom-headers/:bomId/explosions";
const ROUTINGS = "/api/mfg/plants/:plantId/routings";
const ROUTING = "/api/mfg/plants/:plantId/routings/:routingId";
const ROUTING_OPERATIONS = "/api/mfg/plants/:plantId/routings/:routingId/operations";
const ROUTING_OPERATION = "/api/mfg/plants/:plantId/routing-operations/:routingOperationId";
const ROUTING_RELEASE = "/api/mfg/plants/:plantId/routings/:routingId/release";
const WORK_CENTERS = "/api/mfg/plants/:plantId/work-centers";
const WORK_CENTER = "/api/mfg/plants/:plantId/work-centers/:workCenterId";
const WORK_CENTER_RESOURCES = "/api/mfg/plants/:plantId/work-centers/:workCenterId/resources";
const WORK_CENTER_RESOURCE = "/api/mfg/plants/:plantId/work-center-resources/:resourceId";
const WORK_CENTER_CALENDARS = "/api/mfg/plants/:plantId/work-centers/:workCenterId/calendars";
const WORK_CENTER_CALENDAR = "/api/mfg/plants/:plantId/work-center-calendars/:calendarId";
const ORDERS = "/api/mfg/plants/:plantId/orders";
const ORDER = "/api/mfg/plants/:plantId/orders/:orderId";
const SCHEDULE_RUNS = "/api/mfg/plants/:plantId/scheduling/runs";
const SCHEDULE_RESCHEDULES = "/api/mfg/plants/:plantId/scheduling/reschedules";
const SCHEDULE_GANTT = "/api/mfg/plants/:plantId/scheduling/gantt";
const CAPACITY_LOAD = "/api/mfg/plants/:plantId/capacity/load";
const CAPACITY_BOTTLENECKS = "/api/mfg/plants/:plantId/capacity/bottlenecks";
const OPERATION_QUEUE = "/api/mfg/plants/:plantId/operation-queue";
const OPERATION_EXECUTIONS = "/api/mfg/plants/:plantId/operations/:operationId/executions";
const EXECUTION_REPORTS = "/api/mfg/plants/:plantId/executions/:executionId/reports";
const EXECUTION_FINISH = "/api/mfg/plants/:plantId/executions/:executionId/finish";
const DOWNTIME = "/api/mfg/plants/:plantId/downtime";
const SCRAP = "/api/mfg/plants/:plantId/scrap";
const REWORK = "/api/mfg/plants/:plantId/rework";
const OPERATION_VARIANCE = "/api/mfg/plants/:plantId/operations/:operationId/variance";
const OPERATION_COST = "/api/mfg/plants/:plantId/cost/operations/:operationId";
const ORDER_COST_RECONCILE = "/api/mfg/plants/:plantId/cost/orders/:orderId/reconcile";
const MATERIALS = "/api/mfg/plants/:plantId/materials";
const MRP_CALCULATE = "/api/mfg/plants/:plantId/mrp/calculate";
const MRP_SHORTAGES = "/api/mfg/plants/:plantId/mrp/shortages";
const MATERIAL_CONSUMPTIONS = "/api/mfg/plants/:plantId/material-consumptions";
const PROCUREMENT_PROPOSALS = "/api/mfg/plants/:plantId/material-procurement-proposals";
const ORDER_CLOSE = "/api/mfg/plants/:plantId/orders/:orderId/close";
const COST_ORDER = "/api/mfg/plants/:plantId/cost/orders/:orderId";
const COST_OPERATION = "/api/mfg/plants/:plantId/cost/operations/:operationId";
const COST_ORDER_RECONCILE = "/api/mfg/plants/:plantId/cost/orders/:orderId/reconcile";
const DASHBOARD_OVERVIEW = "/api/mfg/plants/:plantId/dashboard/overview";
const DASHBOARD_WC_LOAD = "/api/mfg/plants/:plantId/dashboard/work-center-load";
const DASHBOARD_OEE = "/api/mfg/plants/:plantId/dashboard/oee";
const ALERTS = "/api/mfg/plants/:plantId/alerts";
const ALERT_ACK = "/api/mfg/plants/:plantId/alerts/:alertId/acknowledgements";

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

test("MFG REST: باززمان‌بندی فقط عملیات هدف و زنجیرهٔ وابستگی را برنامه‌ریزی می‌کند و diff و نسخهٔ جدید ثبت می‌کند", async () => {
  assert.equal(MANUFACTURING_IMPLEMENTED_ROUTES.length, 65);
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${PART}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`PATCH ${PART}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${BOM_HEADERS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${BOM_HEADERS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${BOM_HEADER}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`PATCH ${BOM_HEADER}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${BOM_ITEMS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${BOM_ITEMS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`PATCH ${BOM_ITEM}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`DELETE ${BOM_ITEM}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${BOM_RELEASE}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${BOM_EXPLOSIONS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${ROUTINGS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${ROUTINGS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${ROUTING}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`PATCH ${ROUTING}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${ROUTING_OPERATIONS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${ROUTING_OPERATIONS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`PATCH ${ROUTING_OPERATION}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`DELETE ${ROUTING_OPERATION}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${ROUTING_RELEASE}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${WORK_CENTERS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${WORK_CENTERS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${WORK_CENTER}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`PATCH ${WORK_CENTER}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${WORK_CENTER_RESOURCES}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${WORK_CENTER_RESOURCES}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`PATCH ${WORK_CENTER_RESOURCE}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${WORK_CENTER_CALENDARS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${WORK_CENTER_CALENDARS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`PATCH ${WORK_CENTER_CALENDAR}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${SCHEDULE_RESCHEDULES}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${OPERATION_QUEUE}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${OPERATION_EXECUTIONS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${EXECUTION_REPORTS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${EXECUTION_FINISH}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${DOWNTIME}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${SCRAP}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${REWORK}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${OPERATION_VARIANCE}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${MATERIALS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${MRP_CALCULATE}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${MRP_SHORTAGES}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${MATERIAL_CONSUMPTIONS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${PROCUREMENT_PROPOSALS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${ORDER_CLOSE}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${COST_ORDER}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${COST_OPERATION}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${COST_ORDER_RECONCILE}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${DASHBOARD_OVERVIEW}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${DASHBOARD_WC_LOAD}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${DASHBOARD_OEE}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`GET ${ALERTS}`));
  assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(`POST ${ALERT_ACK}`));

  const { repo, call } = makeApi();
  const { order, workCenter } = await seedScheduleFixture(repo, { secondOperation: true });
  const initialOps = repo.tables.get("MfgProductionOrderOperation");
  const op10 = initialOps.find((item) => item.SequenceNo === 1);
  const op20 = initialOps.find((item) => item.SequenceNo === 2);
  const op30 = await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-DEMO", ProductionOrderId: order.Id, RoutingOperationId: null,
    SequenceNo: 3, OperationCode: "OP-30", OperationNameFa: "عملیات سوم", WorkCenterId: workCenter.Id,
    PredecessorOperationId: op20.Id, Status: "pending", PlannedQuantity: 1, PlannedSetupMinutes: 15,
    PlannedRunMinutesPerUnit: 45, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 60,
    OverlapAllowed: false, TransferBatchQty: null, InspectionRequired: false,
  }, "u-mfg-plan");
  const secondOrder = await repo.create("MfgProductionOrder", {
    PlantId: "PLANT-DEMO", OrderNo: "MO-SCHED-2", PartId: "part-sched", OrderQuantity: 1,
    Uom: "ea", DueAt: "2026-10-05T18:00:00.000Z", RequestedStartAt: null,
    Status: "released", PriorityRule: "EDD", DispatchWeight: 1, DemandSource: "manual", ManualRank: null,
  }, "u-mfg-plan");
  const opOther = await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-DEMO", ProductionOrderId: secondOrder.Id, RoutingOperationId: null,
    SequenceNo: 1, OperationCode: "OP-OTHER", OperationNameFa: "عملیات سفارش دیگر", WorkCenterId: workCenter.Id,
    PredecessorOperationId: null, Status: "pending", PlannedQuantity: 1, PlannedSetupMinutes: 15,
    PlannedRunMinutesPerUnit: 45, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 60,
    OverlapAllowed: false, TransferBatchQty: null, InspectionRequired: false,
  }, "u-mfg-plan");

  const initialRun = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward", CapacityMode: "finite", DispatchRule: "EDD",
      From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z",
      ExpectedScheduleVersion: 0,
    },
  });
  assert.equal(initialRun.statusCode, 201);
  assert.equal(initialRun.body.data.ScheduleVersion, 1);
  const v1SegmentsSnapshot = structuredClone(repo.tables.get("MfgOperationSchedule"));

  await repo.create("MfgDowntimeLog", {
    PlantId: "PLANT-DEMO", WorkCenterId: workCenter.Id, ResourceId: null,
    StartedAt: "2026-10-05T10:30:00.000Z", FinishedAt: "2026-10-05T11:30:00.000Z",
    DowntimeType: "unplanned", ReasonCode: "MECH", RecordedBy: "u-mfg-sup",
  }, "u-mfg-sup");

  const rescheduled = await call("POST", SCHEDULE_RESCHEDULES, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      ExpectedScheduleVersion: 1,
      OperationIds: [op20.Id],
      Reason: "توقف ناخواسته در مرکز تراشکاری",
    },
  });
  assert.equal(rescheduled.statusCode, 201);
  assert.equal(rescheduled.body.data.ScheduleVersion, 2);
  assert.equal(rescheduled.body.data.PreviousScheduleVersion, 1);
  assert.deepEqual(rescheduled.body.data.RequestedOperationIds, [op20.Id]);
  assert.deepEqual(rescheduled.body.data.RescheduledOperationIds, [op20.Id, op30.Id]);

  const assignOp10 = rescheduled.body.data.assignments.find((item) => item.ProductionOrderOperationId === op10.Id);
  const assignOpOther = rescheduled.body.data.assignments.find((item) => item.ProductionOrderOperationId === opOther.Id);
  const assignOp20 = rescheduled.body.data.assignments.find((item) => item.ProductionOrderOperationId === op20.Id);
  const assignOp30 = rescheduled.body.data.assignments.find((item) => item.ProductionOrderOperationId === op30.Id);
  assert.equal(assignOp10.Preserved, true);
  assert.equal(assignOpOther.Preserved, true);
  assert.equal(assignOp20.Preserved, false);
  assert.equal(assignOp30.Preserved, false);
  assert.ok(Date.parse(assignOp20.PlannedStartAt) >= Date.parse("2026-10-05T11:30:00.000Z"));
  assert.ok(Date.parse(assignOp30.PlannedStartAt) >= Date.parse(assignOp20.PlannedEndAt));

  const { diff } = rescheduled.body.data;
  assert.equal(diff.fromScheduleVersion, 1);
  assert.equal(diff.toScheduleVersion, 2);
  assert.equal(diff.changedOperationCount, 2);
  assert.equal(diff.unchangedOperationCount, 2);
  assert.equal(diff.movedCount, 2);
  assert.deepEqual(
    diff.changedOperations.map((item) => item.ProductionOrderOperationId),
    [op20.Id, op30.Id],
  );
  assert.ok(diff.changedOperations.every((item) => item.StartDeltaMinutes > 0 && item.EndDeltaMinutes > 0));

  const storedV1Segments = repo.tables.get("MfgOperationSchedule").filter((item) => item.ScheduleVersion === 1);
  assert.deepEqual(storedV1Segments, v1SegmentsSnapshot);
  assert.equal(repo.tables.get("MfgScheduleRun").length, 2);
  assert.equal(repo.tables.get("MfgCapacityPlan").filter((item) => item.ScheduleVersion === 2).length, 1);
  const auditLogs = repo.tables.get("AuditLog").filter((item) => item.Action === "MFG_SCHEDULE_RESCHEDULED");
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].Details.previousScheduleVersion, 1);
  assert.equal(auditLogs[0].Details.scheduleVersion, 2);
});

test("MFG REST: باززمان‌بندی قطعهٔ firm را حفظ می‌کند و DispatchRule سفارشی را اعمال می‌کند", async () => {
  const { repo, call } = makeApi();
  const { order: firstOrder, workCenter } = await seedScheduleFixture(repo, { secondOperation: false });
  const secondOrder = await repo.create("MfgProductionOrder", {
    PlantId: "PLANT-DEMO", OrderNo: "MO-SCHED-HIGH", PartId: "part-sched", OrderQuantity: 1,
    Uom: "ea", DueAt: "2026-10-05T18:00:00.000Z", RequestedStartAt: null,
    Status: "released", PriorityRule: "EDD", DispatchWeight: 8, DemandSource: "manual", ManualRank: null,
  }, "u-mfg-plan");
  const thirdOrder = await repo.create("MfgProductionOrder", {
    PlantId: "PLANT-DEMO", OrderNo: "MO-SCHED-LOW", PartId: "part-sched", OrderQuantity: 1,
    Uom: "ea", DueAt: "2026-10-05T18:00:00.000Z", RequestedStartAt: null,
    Status: "released", PriorityRule: "EDD", DispatchWeight: 1, DemandSource: "manual", ManualRank: null,
  }, "u-mfg-plan");
  const opFirm = repo.tables.get("MfgProductionOrderOperation")[0];
  const opHigh = await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-DEMO", ProductionOrderId: secondOrder.Id, RoutingOperationId: null,
    SequenceNo: 1, OperationCode: "OP-HIGH", OperationNameFa: "عملیات اولویت بالا", WorkCenterId: workCenter.Id,
    PredecessorOperationId: null, Status: "pending", PlannedQuantity: 1, PlannedSetupMinutes: 10,
    PlannedRunMinutesPerUnit: 50, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 60,
    OverlapAllowed: false, TransferBatchQty: null, InspectionRequired: false,
  }, "u-mfg-plan");
  const opLow = await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-DEMO", ProductionOrderId: thirdOrder.Id, RoutingOperationId: null,
    SequenceNo: 1, OperationCode: "OP-LOW", OperationNameFa: "عملیات اولویت پایین", WorkCenterId: workCenter.Id,
    PredecessorOperationId: null, Status: "pending", PlannedQuantity: 1, PlannedSetupMinutes: 10,
    PlannedRunMinutesPerUnit: 50, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 60,
    OverlapAllowed: false, TransferBatchQty: null, InspectionRequired: false,
  }, "u-mfg-plan");

  const run = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward", CapacityMode: "finite", DispatchRule: "EDD",
      From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z",
      OrderIds: [firstOrder.Id, secondOrder.Id, thirdOrder.Id], ExpectedScheduleVersion: 0,
    },
  });
  assert.equal(run.statusCode, 201);
  for (const segment of repo.tables.get("MfgOperationSchedule")) {
    if (segment.ProductionOrderOperationId === opFirm.Id) segment.Status = "firm";
  }

  const rescheduled = await call("POST", SCHEDULE_RESCHEDULES, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      ExpectedScheduleVersion: 1,
      OperationIds: [opFirm.Id, opLow.Id, opHigh.Id],
      Reason: "تغییر قاعدهٔ اعزام به WSPT با حفظ بلوک قطعی",
      DispatchRule: "WSPT",
    },
  });
  assert.equal(rescheduled.statusCode, 201);
  const firmAssign = rescheduled.body.data.assignments.find((item) => item.ProductionOrderOperationId === opFirm.Id);
  const highAssign = rescheduled.body.data.assignments.find((item) => item.ProductionOrderOperationId === opHigh.Id);
  const lowAssign = rescheduled.body.data.assignments.find((item) => item.ProductionOrderOperationId === opLow.Id);
  assert.equal(firmAssign.Status, "firm");
  assert.equal(firmAssign.Preserved, true);
  assert.equal(firmAssign.PlannedStartAt, "2026-10-05T08:00:00.000Z");
  assert.equal(firmAssign.PlannedEndAt, "2026-10-05T10:00:00.000Z");
  assert.equal(highAssign.PlannedStartAt, "2026-10-05T10:00:00.000Z");
  assert.equal(lowAssign.PlannedStartAt, "2026-10-05T11:00:00.000Z");
  assert.equal(rescheduled.body.data.capacity[0].ReservedMinutes, 120);
});

test("MFG REST: باززمان‌بندی مجوز، نسخهٔ stale، خارج از Plant، سفارش غیرفعال، عملیات غیرقابل‌اعزام و rollback را کنترل می‌کند", async () => {
  const { repo, call } = makeApi();
  const { workCenter } = await seedScheduleFixture(repo, { secondOperation: false });
  const validOp = repo.tables.get("MfgProductionOrderOperation")[0];

  const run = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward", CapacityMode: "finite", DispatchRule: "EDD",
      From: "2026-10-05T08:00:00Z", To: "2026-10-05T17:00:00Z",
    },
  });
  assert.equal(run.statusCode, 201);

  const noPermission = await call("POST", SCHEDULE_RESCHEDULES, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-manager" },
    body: { ExpectedScheduleVersion: 1, OperationIds: [validOp.Id], Reason: "بدون مجوز resequence" },
  });
  assert.equal(noPermission.statusCode, 403);
  assert.equal(noPermission.body.error.code, "MFG_FORBIDDEN");

  const wrongPlantScope = await call("POST", SCHEDULE_RESCHEDULES, {
    params: { plantId: "PLANT-OTHER" }, headers: { "x-user-id": "u-mfg-plan" },
    body: { ExpectedScheduleVersion: 1, OperationIds: [validOp.Id], Reason: "کارخانهٔ دیگر" },
  });
  assert.equal(wrongPlantScope.statusCode, 403);
  assert.equal(wrongPlantScope.body.error.code, "MFG_PLANT_SCOPE_DENIED");

  const stale = await call("POST", SCHEDULE_RESCHEDULES, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: { ExpectedScheduleVersion: 0, OperationIds: [validOp.Id], Reason: "نسخهٔ کهنه" },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.error.code, "MFG_SCHEDULE_VERSION_CONFLICT");

  const foreignOrder = await repo.create("MfgProductionOrder", {
    PlantId: "PLANT-OTHER", OrderNo: "MO-FOREIGN", PartId: "part-other", OrderQuantity: 1,
    Uom: "ea", DueAt: "2026-10-05T18:00:00.000Z", Status: "released", PriorityRule: "EDD", DispatchWeight: 1, DemandSource: "manual",
  });
  const foreignOp = await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-OTHER", ProductionOrderId: foreignOrder.Id, SequenceNo: 1, OperationCode: "OP-F",
    OperationNameFa: "عملیات بیگانه", WorkCenterId: workCenter.Id, Status: "pending", PlannedQuantity: 1,
    PlannedSetupMinutes: 10, PlannedRunMinutesPerUnit: 20, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 30,
  });
  const foreignRes = await call("POST", SCHEDULE_RESCHEDULES, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: { ExpectedScheduleVersion: 1, OperationIds: [foreignOp.Id], Reason: "شناسهٔ خارج از کارخانه" },
  });
  assert.equal(foreignRes.statusCode, 404);
  assert.equal(foreignRes.body.error.code, "MFG_NOT_FOUND");

  const inactiveOrder = await repo.create("MfgProductionOrder", {
    PlantId: "PLANT-DEMO", OrderNo: "MO-CLOSED", PartId: "part-sched", OrderQuantity: 1,
    Uom: "ea", DueAt: "2026-10-05T18:00:00.000Z", Status: "closed", PriorityRule: "EDD", DispatchWeight: 1, DemandSource: "manual",
  });
  const inactiveOrderOp = await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-DEMO", ProductionOrderId: inactiveOrder.Id, SequenceNo: 1, OperationCode: "OP-CL",
    OperationNameFa: "عملیات سفارش بسته", WorkCenterId: workCenter.Id, Status: "pending", PlannedQuantity: 1,
    PlannedSetupMinutes: 10, PlannedRunMinutesPerUnit: 20, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 30,
  });
  const inactiveRes = await call("POST", SCHEDULE_RESCHEDULES, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: { ExpectedScheduleVersion: 1, OperationIds: [inactiveOrderOp.Id], Reason: "سفارش غیرفعال" },
  });
  assert.equal(inactiveRes.statusCode, 422);
  assert.equal(inactiveRes.body.error.code, "MFG_ORDER_NOT_RELEASED");

  const runningOp = await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-DEMO", ProductionOrderId: validOp.ProductionOrderId, SequenceNo: 99, OperationCode: "OP-RUN",
    OperationNameFa: "عملیات در حال اجرا", WorkCenterId: workCenter.Id, Status: "running", PlannedQuantity: 1,
    PlannedSetupMinutes: 10, PlannedRunMinutesPerUnit: 20, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 30,
  });
  const nonDispatchableRes = await call("POST", SCHEDULE_RESCHEDULES, {
    params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
    body: { ExpectedScheduleVersion: 1, OperationIds: [runningOp.Id], Reason: "عملیات غیرقابل‌اعزام" },
  });
  assert.equal(nonDispatchableRes.statusCode, 422);
  assert.equal(nonDispatchableRes.body.error.code, "MFG_OPERATION_NOT_DISPATCHABLE");

  repo.failCreateOn = "MfgCapacityPlan";
  const originalConsoleError = console.error;
  console.error = () => {};
  let rollbackRes;
  try {
    rollbackRes = await call("POST", SCHEDULE_RESCHEDULES, {
      params: { plantId: "PLANT-DEMO" }, headers: { "x-user-id": "u-mfg-plan" },
      body: { ExpectedScheduleVersion: 1, OperationIds: [validOp.Id], Reason: "آزمون rollback تراکنش" },
    });
  } finally {
    console.error = originalConsoleError;
    repo.failCreateOn = null;
  }
  assert.equal(rollbackRes.statusCode, 500);
  assert.equal(repo.tables.get("MfgScheduleRun").length, 1);
  assert.equal(repo.tables.get("MfgOperationSchedule").filter((item) => item.ScheduleVersion === 2).length, 0);
  assert.equal(repo.tables.get("MfgCapacityPlan").filter((item) => item.ScheduleVersion === 2).length, 0);
  assert.equal(repo.tables.get("AuditLog").filter((item) => item.Action === "MFG_SCHEDULE_RESCHEDULED").length, 0);
});

test("MFG REST: صف عملیات، شروع نشست، گزارش تجمعی و اتمام با پیش‌نیاز و گیت بازرسی و Idempotency کار می‌کند", async () => {
  const { repo, call } = makeApi();
  const { order, workCenter, resource } = await seedScheduleFixture(repo, { secondOperation: true });
  const ops = repo.tables.get("MfgProductionOrderOperation");
  const op10 = ops.find((item) => item.SequenceNo === 1);
  const op20 = ops.find((item) => item.SequenceNo === 2);

  await repo.patch("MfgProductionOrder", order.Id, { OrderQuantity: 10, AllowOverrun: false }, "u-mfg-plan", order.RowVersion);
  await repo.patch("MfgProductionOrderOperation", op10.Id, { PlannedQuantity: 10, InspectionRequired: true }, "u-mfg-plan", op10.RowVersion);
  await repo.patch("MfgProductionOrderOperation", op20.Id, { PlannedQuantity: 10 }, "u-mfg-plan", op20.RowVersion);

  const runRes = await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward",
      CapacityMode: "finite",
      DispatchRule: "EDD",
      From: "2026-10-05T08:00:00.000Z",
      To: "2026-10-05T17:00:00.000Z",
    },
  });
  assert.equal(runRes.statusCode, 201);

  const queueRes = await call("GET", OPERATION_QUEUE, {
    params: { plantId: "PLANT-DEMO" },
    query: { workCenterId: workCenter.Id, shiftDate: "2026-10-05" },
    headers: { "x-user-id": "u-mfg-operator" },
  });
  assert.equal(queueRes.statusCode, 200);
  assert.equal(queueRes.body.data.page.total, 2);
  assert.equal(queueRes.body.data.items[0].Id, op10.Id);

  // اپراتور سطح internal دارد و برای شروع نشست که confidential است 403 می‌گیرد
  const operatorStartDenied = await call("POST", OPERATION_EXECUTIONS, {
    params: { plantId: "PLANT-DEMO", operationId: op10.Id },
    headers: { "x-user-id": "u-mfg-operator", "idempotency-key": "exec-op10-denied" },
    body: { ResourceId: resource.Id },
  });
  assert.equal(operatorStartDenied.statusCode, 403);
  assert.equal(operatorStartDenied.body.error.code, "MFG_FORBIDDEN");

  // تلاش برای شروع عملیات دوم قبل از تکمیل پیش‌نیاز رد می‌شود
  const prematureStart = await call("POST", OPERATION_EXECUTIONS, {
    params: { plantId: "PLANT-DEMO", operationId: op20.Id },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "exec-op20-early" },
    body: { ResourceId: resource.Id, StartedAt: "2026-10-05T08:05:00.000Z" },
  });
  assert.equal(prematureStart.statusCode, 422);
  assert.equal(prematureStart.body.error.code, "MFG_PREDECESSOR_NOT_COMPLETED");

  // شروع عملیات اول و تکرار ایدمپوتنت با همان کلید
  const startRes = await call("POST", OPERATION_EXECUTIONS, {
    params: { plantId: "PLANT-DEMO", operationId: op10.Id },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "exec-op10-1" },
    body: { ResourceId: resource.Id, StartedAt: "2026-10-05T08:00:00.000Z", NoteFa: "شروع شیفت صبح" },
  });
  assert.equal(startRes.statusCode, 201);
  assert.equal(startRes.body.data.ExecutionNo, 1);
  assert.equal(startRes.body.data.Status, "running");

  const startReplay = await call("POST", OPERATION_EXECUTIONS, {
    params: { plantId: "PLANT-DEMO", operationId: op10.Id },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "exec-op10-1" },
    body: { ResourceId: resource.Id, StartedAt: "2026-10-05T08:00:00.000Z" },
  });
  assert.equal(startReplay.statusCode, 201);
  assert.equal(startReplay.body.data.Id, startRes.body.data.Id);
  assert.equal(repo.tables.get("MfgOperationExecution").length, 1);

  // مصرف همان کلید برای عملیات دیگر 409 برمی‌گرداند
  const keyConflict = await call("POST", OPERATION_EXECUTIONS, {
    params: { plantId: "PLANT-DEMO", operationId: op20.Id },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "exec-op10-1" },
    body: { ResourceId: resource.Id },
  });
  assert.equal(keyConflict.statusCode, 409);
  assert.equal(keyConflict.body.error.code, "MFG_IDEMPOTENCY_CONFLICT");

  // گزارش تجمعی مرحلهٔ اول توسط اپراتور (۶ واحد ورودی، ۵ سالم، هنوز ۱ واحد تعیین‌تکلیف‌نشده)
  const execId = startRes.body.data.Id;
  const report1 = await call("POST", EXECUTION_REPORTS, {
    params: { plantId: "PLANT-DEMO", executionId: execId },
    headers: { "x-user-id": "u-mfg-operator", "if-match": "1" },
    body: {
      InputQuantity: 6,
      GoodQuantity: 5,
      ReworkQuantity: 0,
      ScrapQuantity: 0,
      SetupActualMinutes: 25,
      RunActualMinutes: 50,
    },
  });
  assert.equal(report1.statusCode, 200);
  assert.equal(report1.body.data.RowVersion, 2);

  // تلاش برای گزارش با نسخهٔ قدیمی If-Match رد می‌شود
  const staleReport = await call("POST", EXECUTION_REPORTS, {
    params: { plantId: "PLANT-DEMO", executionId: execId },
    headers: { "x-user-id": "u-mfg-operator", "if-match": "1" },
    body: {
      InputQuantity: 4,
      GoodQuantity: 4,
      ReworkQuantity: 0,
      ScrapQuantity: 0,
      SetupActualMinutes: 0,
      RunActualMinutes: 30,
    },
  });
  assert.equal(staleReport.statusCode, 409);
  assert.equal(staleReport.body.error.code, "MFG_ROW_VERSION_CONFLICT");

  // تلاش برای گزارش بیش از سقف سفارش وقتی AllowOverrun=false است رد می‌شود
  const overrunReport = await call("POST", EXECUTION_REPORTS, {
    params: { plantId: "PLANT-DEMO", executionId: execId },
    headers: { "x-user-id": "u-mfg-operator", "if-match": "2" },
    body: {
      InputQuantity: 6,
      GoodQuantity: 6,
      ReworkQuantity: 0,
      ScrapQuantity: 0,
      SetupActualMinutes: 0,
      RunActualMinutes: 40,
    },
  });
  assert.equal(overrunReport.statusCode, 422);
  assert.equal(overrunReport.body.error.code, "MFG_OVERRUN_NOT_ALLOWED");

  // تلاش برای اتمام قبل از تعیین‌تکلیف کامل مقادیر ورودی رد می‌شود
  const unreconciledFinish = await call("POST", EXECUTION_FINISH, {
    params: { plantId: "PLANT-DEMO", executionId: execId },
    headers: { "x-user-id": "u-mfg-supervisor", "if-match": "2", "idempotency-key": "fin-unreconciled" },
    body: { FinishedAt: "2026-10-05T10:00:00.000Z", InspectionApproved: true },
  });
  assert.equal(unreconciledFinish.statusCode, 422);
  assert.equal(unreconciledFinish.body.error.code, "MFG_EXECUTION_QUANTITY_UNRECONCILED");

  // گزارش تجمعی مرحلهٔ دوم برای تکمیل ۱۰ واحد (مجموع: ۱۰ ورودی = ۸ سالم + ۱ ضایعات + ۱ دوباره‌کاری)
  const report2 = await call("POST", EXECUTION_REPORTS, {
    params: { plantId: "PLANT-DEMO", executionId: execId },
    headers: { "x-user-id": "u-mfg-operator", "if-match": "2" },
    body: {
      InputQuantity: 4,
      GoodQuantity: 3,
      ReworkQuantity: 1,
      ScrapQuantity: 1,
      SetupActualMinutes: 5,
      RunActualMinutes: 45,
    },
  });
  assert.equal(report2.statusCode, 200);
  assert.equal(report2.body.data.InputQuantity, 10);
  assert.equal(report2.body.data.GoodQuantity, 8);
  assert.equal(report2.body.data.ScrapQuantity, 1);
  assert.equal(report2.body.data.ReworkQuantity, 1);

  // تلاش برای اتمام بدون تایید بازرسی کیفی (InspectionRequired=true) رد می‌شود
  const missingInspectionFinish = await call("POST", EXECUTION_FINISH, {
    params: { plantId: "PLANT-DEMO", executionId: execId },
    headers: { "x-user-id": "u-mfg-supervisor", "if-match": "3", "idempotency-key": "fin-no-insp" },
    body: { FinishedAt: "2026-10-05T10:00:00.000Z", InspectionApproved: false },
  });
  assert.equal(missingInspectionFinish.statusCode, 422);
  assert.equal(missingInspectionFinish.body.error.code, "MFG_INSPECTION_REQUIRED");

  // اتمام موفق با تایید بازرسی و تکرار ایدمپوتنت
  const finishRes = await call("POST", EXECUTION_FINISH, {
    params: { plantId: "PLANT-DEMO", executionId: execId },
    headers: { "x-user-id": "u-mfg-supervisor", "if-match": "3", "idempotency-key": "fin-op10-ok" },
    body: { FinishedAt: "2026-10-05T10:00:00.000Z", InspectionApproved: true },
  });
  assert.equal(finishRes.statusCode, 200);
  assert.equal(finishRes.body.data.Status, "completed");
  assert.equal(finishRes.body.data.OperationStatus, "completed");

  const finishReplay = await call("POST", EXECUTION_FINISH, {
    params: { plantId: "PLANT-DEMO", executionId: execId },
    headers: { "x-user-id": "u-mfg-supervisor", "if-match": "3", "idempotency-key": "fin-op10-ok" },
    body: { FinishedAt: "2026-10-05T10:00:00.000Z", InspectionApproved: true },
  });
  assert.equal(finishReplay.statusCode, 200);
  assert.equal(finishReplay.body.data.Id, execId);
  assert.equal(finishReplay.body.data.OperationStatus, "completed");

  // اکنون عملیات دوم که پیش‌نیاز آن تکمیل شده قابل شروع است
  const startOp20 = await call("POST", OPERATION_EXECUTIONS, {
    params: { plantId: "PLANT-DEMO", operationId: op20.Id },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "exec-op20-ok" },
    body: { ResourceId: resource.Id, StartedAt: "2026-10-05T10:15:00.000Z" },
  });
  assert.equal(startOp20.statusCode, 201);
  assert.equal(startOp20.body.data.Status, "running");
});

test("MFG REST: ثبت توقف، ضایعات، دوباره‌کاری و گزارش انحراف عملیات با کنترل هزینه کار می‌کند", async () => {
  const { repo, call } = makeApi();
  const { workCenter, resource } = await seedScheduleFixture(repo, { secondOperation: true });
  const ops = repo.tables.get("MfgProductionOrderOperation");
  const op10 = ops.find((item) => item.SequenceNo === 1);
  const op20 = ops.find((item) => item.SequenceNo === 2);

  const startRes = await call("POST", OPERATION_EXECUTIONS, {
    params: { plantId: "PLANT-DEMO", operationId: op10.Id },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "exec-var-1" },
    body: { ResourceId: resource.Id, StartedAt: "2026-10-05T08:00:00.000Z" },
  });
  assert.equal(startRes.statusCode, 201);
  const execId = startRes.body.data.Id;

  await call("POST", EXECUTION_REPORTS, {
    params: { plantId: "PLANT-DEMO", executionId: execId },
    headers: { "x-user-id": "u-mfg-operator", "if-match": "1" },
    body: {
      InputQuantity: 1,
      GoodQuantity: 0.7,
      ScrapQuantity: 0.2,
      ReworkQuantity: 0.1,
      SetupActualMinutes: 40,
      RunActualMinutes: 100,
    },
  });

  // ۱. ثبت توقف با محاسبهٔ DurationMinutes توسط سرور و کنترل Idempotency
  const dtRes = await call("POST", DOWNTIME, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-operator", "idempotency-key": "dt-key-1" },
    body: {
      WorkCenterId: workCenter.Id,
      OperationId: op10.Id,
      ExecutionId: execId,
      ResourceId: resource.Id,
      StartedAt: "2026-10-05T08:30:00.000Z",
      FinishedAt: "2026-10-05T08:45:00.000Z",
      DowntimeType: "unplanned",
      ReasonCode: "TOOL-BREAK",
      NoteFa: "شکست ابزار برش",
    },
  });
  assert.equal(dtRes.statusCode, 201);
  assert.equal(dtRes.body.data.DurationMinutes, 15);
  assert.equal(dtRes.body.data.RecordedBy, "u-mfg-operator");

  const dtReplay = await call("POST", DOWNTIME, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-operator", "idempotency-key": "dt-key-1" },
    body: {
      WorkCenterId: workCenter.Id,
      OperationId: op10.Id,
      ExecutionId: execId,
      ResourceId: resource.Id,
      StartedAt: "2026-10-05T08:30:00.000Z",
      FinishedAt: "2026-10-05T08:45:00.000Z",
      DowntimeType: "unplanned",
      ReasonCode: "TOOL-BREAK",
    },
  });
  assert.equal(dtReplay.statusCode, 201);
  assert.equal(dtReplay.body.data.Id, dtRes.body.data.Id);
  assert.equal(repo.tables.get("MfgDowntimeLog").length, 1);

  // ۲. ثبت ضایعات بخشی بدون تغییر وضعیت کل عملیات
  const scrapRes = await call("POST", SCRAP, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "scrap-key-1" },
    body: {
      OperationId: op10.Id,
      ExecutionId: execId,
      Quantity: 0.2,
      Uom: "ea",
      ReasonCode: "DIM-ERR",
      Disposition: "scrapped",
      CostAmount: 250000,
      Currency: "IRR",
    },
  });
  assert.equal(scrapRes.statusCode, 201);
  assert.equal(scrapRes.body.data.RecordedBy, "u-mfg-supervisor");
  const currentOp = await repo.get("MfgProductionOrderOperation", op10.Id);
  assert.equal(currentOp.Status, "running");

  // ۳. ثبت دوباره‌کاری و بررسی سازگاری عملیات مقصد با همان سفارش
  const otherOrder = await repo.create("MfgProductionOrder", {
    PlantId: "PLANT-DEMO", OrderNo: "MO-OTHER", PartId: "part-sched", OrderQuantity: 1,
    Uom: "ea", DueAt: "2026-10-06T18:00:00.000Z", Status: "released", PriorityRule: "EDD", DispatchWeight: 1, DemandSource: "manual",
  });
  const otherOp = await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-DEMO", ProductionOrderId: otherOrder.Id, SequenceNo: 1, OperationCode: "OP-X",
    OperationNameFa: "عملیات سفارش دیگر", WorkCenterId: workCenter.Id, Status: "pending", PlannedQuantity: 1,
    PlannedSetupMinutes: 10, PlannedRunMinutesPerUnit: 10, PlannedQueueMinutes: 0, PlannedMoveMinutes: 0, PlannedCapacityMinutes: 20,
  });

  const badReworkTarget = await call("POST", REWORK, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "rw-bad-target" },
    body: {
      SourceOperationId: op10.Id,
      TargetOperationId: otherOp.Id,
      Quantity: 0.1,
      Uom: "ea",
      ReasonCode: "SURF-DEFECT",
    },
  });
  assert.equal(badReworkTarget.statusCode, 422);
  assert.equal(badReworkTarget.body.error.code, "MFG_REWORK_TARGET_MISMATCH");

  const reworkRes = await call("POST", REWORK, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "rw-key-1" },
    body: {
      SourceOperationId: op10.Id,
      TargetOperationId: op20.Id,
      ExecutionId: execId,
      ScrapRecordId: scrapRes.body.data.Id,
      Quantity: 0.1,
      Uom: "ea",
      ReasonCode: "SURF-DEFECT",
      Disposition: "return-to-operation",
    },
  });
  assert.equal(reworkRes.statusCode, 201);
  assert.equal(reworkRes.body.data.ReworkNo, "RW-0001");
  assert.equal(reworkRes.body.data.Status, "open");

  // ۴. بررسی گزارش انحراف عملیات (variance) و تفکیک دسترسی هزینه (mfg.cost.view)
  await repo.create("MfgOperationCost", {
    PlantId: "PLANT-DEMO",
    ProductionOrderOperationId: op10.Id,
    CostCenterId: null,
    CostElement: "machine",
    CostVersion: 1,
    StandardQuantity: 120,
    ActualQuantity: 140,
    StandardRate: 1000,
    ActualRate: 1100,
    StandardAmount: 120000,
    ActualAmount: 154000,
    Currency: "IRR",
    CalculatedAt: "2026-10-05T09:30:00.000Z",
    SourceRef: "TEST",
  });

  // اپراتور مجوز mfg.execution.view دارد ولی mfg.cost.view ندارد -> Cost باید null باشد
  const operatorVariance = await call("GET", OPERATION_VARIANCE, {
    params: { plantId: "PLANT-DEMO", operationId: op10.Id },
    headers: { "x-user-id": "u-mfg-operator" },
  });
  assert.equal(operatorVariance.statusCode, 200);
  assert.equal(operatorVariance.body.data.TimeMinutes.StandardSetupMinutes, 30);
  assert.equal(operatorVariance.body.data.TimeMinutes.ActualSetupMinutes, 40);
  assert.equal(operatorVariance.body.data.TimeMinutes.SetupVarianceMinutes, 10);
  assert.equal(operatorVariance.body.data.TimeMinutes.StandardRunMinutes, 90);
  assert.equal(operatorVariance.body.data.TimeMinutes.ActualRunMinutes, 100);
  assert.equal(operatorVariance.body.data.TimeMinutes.RunVarianceMinutes, 10);
  assert.equal(operatorVariance.body.data.TimeMinutes.DowntimeMinutes, 15);
  assert.equal(operatorVariance.body.data.Quantities.GoodQuantity, 0.7);
  assert.equal(operatorVariance.body.data.Quantities.ScrapQuantity, 0.2);
  assert.equal(operatorVariance.body.data.Quantities.ReworkQuantity, 0.1);
  assert.equal(operatorVariance.body.data.Executions.length, 1);
  assert.equal(operatorVariance.body.data.ScrapRecords.length, 1);
  assert.equal(operatorVariance.body.data.ReworkRecords.length, 1);
  assert.equal(operatorVariance.body.data.DowntimeLogs.length, 1);
  assert.equal(operatorVariance.body.data.Cost, null);
  assert.equal(operatorVariance.body.data.CostRedacted, true);

  // ۵. بررسی غنی‌سازی صف عملیات کارگاهی (GET /operation-queue) برای کنترل عملیات فاز ۲
  const queueCheck = await call("GET", OPERATION_QUEUE, {
    params: { plantId: "PLANT-DEMO" },
    query: { workCenterId: workCenter.Id },
    headers: { "x-user-id": "u-mfg-operator" },
  });
  assert.equal(queueCheck.statusCode, 200);
  const queuedOp10 = queueCheck.body.data.items.find((item) => item.Id === op10.Id);
  assert.ok(queuedOp10);
  assert.equal(queuedOp10.ExecutionCount, 1);
  assert.equal(queuedOp10.CumulativeGoodQuantity, 0.7);
  assert.equal(queuedOp10.CumulativeScrapQuantity, 0.2);
  assert.equal(queuedOp10.CumulativeReworkQuantity, 0.1);
  assert.equal(queuedOp10.ActiveExecution.Id, execId);
  assert.equal(queuedOp10.WorkCenterCode, workCenter.Code);

  // کاربر دارای هر دو نقش سرپرست/مدیر و حسابدار صنعتی هزینه را کامل می‌بیند
  DEMO_SUBJECTS.push({
    id: "u-mfg-exec-cost-test",
    displayName: "ممیز هزینه و اجرا",
    roles: ["shop_floor_supervisor", "industrial_accountant"],
    projectIds: ["*"],
    plantIds: ["PLANT-DEMO"],
    active: true,
    party: "contractor",
  });
  try {
    const costVariance = await call("GET", OPERATION_VARIANCE, {
      params: { plantId: "PLANT-DEMO", operationId: op10.Id },
      headers: { "x-user-id": "u-mfg-exec-cost-test" },
    });
    assert.equal(costVariance.statusCode, 200);
    assert.equal(costVariance.body.data.CostRedacted, false);
    assert.equal(costVariance.body.data.Cost.StandardAmount, 120000);
    assert.equal(costVariance.body.data.Cost.ActualAmount, 154000);
    assert.equal(costVariance.body.data.Cost.VarianceAmount, 34000);
    assert.equal(costVariance.body.data.Cost.ScrapCostAmount, 250000);
  } finally {
    const idx = DEMO_SUBJECTS.findIndex((s) => s.id === "u-mfg-exec-cost-test");
    if (idx !== -1) DEMO_SUBJECTS.splice(idx, 1);
  }
});

test("MFG REST: مواد، محاسبهٔ MRP (پیش‌نمایش و ثبت اتمیک)، کمبودها و پیشنهاد تأمین کار می‌کنند", async () => {
  const { repo, call } = makeApi();
  const { order } = await seedScheduleFixture(repo, { secondOperation: false });
  await repo.patch("MfgProductionOrder", order.Id, { OrderQuantity: 10 }, "u-mfg-plan", order.RowVersion);

  const fgPart = await repo.create("MfgPart", {
    Id: "part-sched", PlantId: "PLANT-DEMO", PartNo: "FG-100", NameFa: "محصول نهایی",
    PartType: "manufactured", BaseUom: "ea", Currency: "IRR", IsLotTracked: false, IsActive: true,
  });
  const rawPart = await repo.create("MfgPart", {
    PlantId: "PLANT-DEMO", PartNo: "RM-STEEL-01", NameFa: "ورق فولادی",
    PartType: "purchased", BaseUom: "kg", StandardUnitCost: 50000, Currency: "IRR", IsLotTracked: true, IsActive: true,
  });
  const material = await repo.create("MfgMaterial", {
    PlantId: "PLANT-DEMO", PartId: rawPart.Id, ProcurementType: "buy",
    LeadTimeDays: 5, SafetyStockQty: 20, LotSize: 50, OrderMultiple: 25,
    StandardUnitCost: 50000, Currency: "IRR", DefaultWarehouseCode: "WH-01", IsActive: true,
  });
  await repo.create("MfgInventoryLevel", {
    PlantId: "PLANT-DEMO", MaterialId: material.Id, WarehouseCode: "WH-01", LocationCode: "A1", LotNo: "LOT-01",
    InventoryKey: "WH-01:A1:LOT-01", OnHandQty: 150, ReservedQty: 10, BlockedQty: 0, InTransitQty: 0, SafetyStockQty: 20,
    AsOfAt: "2026-10-01T08:00:00.000Z",
  });

  const bom = await repo.create("MfgBomHeader", {
    PlantId: "PLANT-DEMO", PartId: fgPart.Id, Revision: "R1", Status: "released",
    BaseQuantity: 1, BaseUom: "ea", EffectiveFrom: "2026-01-01", IsDefault: true,
    ReleasedAt: "2026-01-01T08:00:00.000Z", ReleasedBy: "u-mfg-eng",
  });
  await repo.create("MfgBomItem", {
    PlantId: "PLANT-DEMO", BomHeaderId: bom.Id, LineNo: 10, ComponentPartId: rawPart.Id,
    QuantityPer: 20, Uom: "kg", ScrapPct: 10, IssueMethod: "manual", IsPhantom: false, OperationSequenceNo: 1,
  });

  // ۱. فهرست مواد قابل برنامه‌ریزی
  const matList = await call("GET", MATERIALS, {
    params: { plantId: "PLANT-DEMO" },
    query: { procurementType: "buy", q: "STEEL" },
    headers: { "x-user-id": "u-mfg-material" },
  });
  assert.equal(matList.statusCode, 200);
  assert.equal(matList.body.data.page.total, 1);
  assert.equal(matList.body.data.items[0].PartNo, "RM-STEEL-01");
  assert.equal(matList.body.data.items[0].IsLotTracked, true);
  assert.equal(matList.body.data.items[0].OnHandQty, 150);
  assert.equal(matList.body.data.items[0].ReservedQty, 10);
  assert.equal(matList.body.data.items[0].FreeAvailableQty, 120);
  assert.equal(matList.body.data.items[0].InventoryLocations.length, 1);
  assert.equal(matList.body.data.items[0].InventoryLocations[0].LotNo, "LOT-01");

  // ۲. اجرای MRP در حالت PreviewOnly (نیاز ناخالص = ۲۰۰، ضایعات ۱۰٪ = ۲۰، نیاز خالص = ۲۲۰؛ موجودی آزاد = ۱۵۰ - ۱۰ - ۲۰ = ۱۲۰ -> کمبود = ۱۰۰)
  const previewRes = await call("POST", MRP_CALCULATE, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-material" },
    body: {
      OrderIds: [order.Id],
      ThroughDate: "2026-10-30T23:59:59.000Z",
      PreviewOnly: true,
    },
  });
  assert.equal(previewRes.statusCode, 200);
  assert.equal(previewRes.body.data.previewOnly, true);
  assert.equal(previewRes.body.data.requirements.length, 1);
  assert.equal(previewRes.body.data.requirements[0].GrossQuantity, 200);
  assert.equal(previewRes.body.data.requirements[0].ScrapAllowanceQty, 20);
  assert.equal(previewRes.body.data.requirements[0].NetQuantity, 220);
  assert.equal(previewRes.body.data.requirements[0].AvailableQuantity, 120);
  assert.equal(previewRes.body.data.requirements[0].ShortageQuantity, 100);
  assert.equal(repo.tables.get("MfgMaterialRequirement")?.length ?? 0, 0);

  // ۳. اجرای MRP با ثبت اتمیک نیازمندی‌ها و صدور خودکار هشدار کمبود (MATERIAL_SHORTAGE)
  const commitMrp = await call("POST", MRP_CALCULATE, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-material" },
    body: {
      OrderIds: [order.Id],
      ThroughDate: "2026-10-30T23:59:59.000Z",
      PreviewOnly: false,
    },
  });
  assert.equal(commitMrp.statusCode, 200);
  assert.equal(commitMrp.body.data.previewOnly, false);
  assert.equal(repo.tables.get("MfgMaterialRequirement").length, 1);
  const reqId = commitMrp.body.data.requirements[0].Id;

  const mrpAlerts = await call("GET", ALERTS, {
    params: { plantId: "PLANT-DEMO" },
    query: { status: "open" },
    headers: { "x-user-id": "u-mfg-manager" },
  });
  assert.equal(mrpAlerts.statusCode, 200);
  assert.equal(mrpAlerts.body.data.items.length, 1);
  assert.equal(mrpAlerts.body.data.items[0].AlertCode, "MATERIAL_SHORTAGE");
  assert.equal(mrpAlerts.body.data.items[0].ActualValue, 100);
  assert.equal(mrpAlerts.body.data.items[0].OrderNo, order.OrderNo);

  // ۴. مشاهدهٔ فهرست کمبودهای باز همراه با فیلدهای غنی‌شدهٔ قطعه و سفارش
  const shortagesRes = await call("GET", MRP_SHORTAGES, {
    params: { plantId: "PLANT-DEMO" },
    query: { materialId: material.Id },
    headers: { "x-user-id": "u-mfg-material" },
  });
  assert.equal(shortagesRes.statusCode, 200);
  assert.equal(shortagesRes.body.data.page.total, 1);
  assert.equal(shortagesRes.body.data.items[0].Id, reqId);
  assert.equal(shortagesRes.body.data.items[0].PartNo, "RM-STEEL-01");
  assert.equal(shortagesRes.body.data.items[0].OrderNo, order.OrderNo);
  assert.equal(shortagesRes.body.data.items[0].ProcurementType, "buy");

  // ۵. ایجاد پیشنهاد خرید از روی کمبودها با حذف اقلام تکراری و بدون صدور PO
  const proposalRes = await call("POST", PROCUREMENT_PROPOSALS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-material" },
    body: {
      ThroughDate: "2026-10-30T23:59:59.000Z",
      RequirementIds: [reqId, reqId],
      NoteFa: "تأمین ورق فولادی سفارش اول",
    },
  });
  assert.equal(proposalRes.statusCode, 201);
  assert.equal(proposalRes.body.data.purchaseOrderIssued, false);
  assert.equal(proposalRes.body.data.proposalsCount, 1);
  assert.equal(proposalRes.body.data.proposals[0].ShortageQuantity, 100);
  assert.equal(proposalRes.body.data.proposals[0].SuggestedQuantity, 100);
});

test("MFG REST: ثبت مصرف واقعی مواد با کنترل LotNo، کسر اتمیک موجودی و Idempotency کار می‌کند", async () => {
  const { repo, call } = makeApi();
  const { order } = await seedScheduleFixture(repo, { secondOperation: false });
  const op10 = repo.tables.get("MfgProductionOrderOperation")[0];

  const rawPart = await repo.create("MfgPart", {
    PlantId: "PLANT-DEMO", PartNo: "RM-LOT-01", NameFa: "مادهٔ دارای بچ",
    PartType: "purchased", BaseUom: "kg", StandardUnitCost: 10000, Currency: "IRR", IsLotTracked: true, IsActive: true,
  });
  const material = await repo.create("MfgMaterial", {
    PlantId: "PLANT-DEMO", PartId: rawPart.Id, ProcurementType: "buy",
    LeadTimeDays: 2, SafetyStockQty: 5, LotSize: 10, OrderMultiple: 5,
    StandardUnitCost: 10000, Currency: "IRR", DefaultWarehouseCode: "WH-01", IsActive: true,
  });
  const inv = await repo.create("MfgInventoryLevel", {
    PlantId: "PLANT-DEMO", MaterialId: material.Id, WarehouseCode: "WH-01", LocationCode: "B1", LotNo: "LOT-99",
    InventoryKey: "WH-01:B1:LOT-99", OnHandQty: 50, ReservedQty: 20, BlockedQty: 5, InTransitQty: 0, SafetyStockQty: 5,
    AsOfAt: "2026-10-01T08:00:00.000Z",
  });
  const reqRow = await repo.create("MfgMaterialRequirement", {
    PlantId: "PLANT-DEMO", ProductionOrderId: order.Id, ProductionOrderOperationId: op10.Id,
    BomItemId: "bom-item-1", MaterialId: material.Id, RequirementKey: "req-1",
    RequiredAt: "2026-10-05T08:00:00.000Z", GrossQuantity: 20, ScrapAllowanceQty: 0, NetQuantity: 20,
    AvailableQuantity: 20, ReservedQuantity: 20, ShortageQuantity: 0, Uom: "kg", Status: "reserved", ScheduleVersion: 1,
  });

  // عدم ارسال LotNo برای قطعهٔ IsLotTracked=true رد می‌شود
  const missingLot = await call("POST", MATERIAL_CONSUMPTIONS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "cons-no-lot" },
    body: {
      OperationId: op10.Id,
      RequirementId: reqRow.Id,
      MaterialId: material.Id,
      Quantity: 20,
      Uom: "kg",
      UnitCost: 10000,
      ConsumptionMethod: "issue",
    },
  });
  assert.equal(missingLot.statusCode, 422);
  assert.equal(missingLot.body.error.code, "MFG_LOT_REQUIRED");

  // درخواست بیش از موجودی آزاد (OnHand 50 - Blocked 5 = 45) رد می‌شود
  const insufficientRes = await call("POST", MATERIAL_CONSUMPTIONS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "cons-too-much" },
    body: {
      OperationId: op10.Id,
      RequirementId: reqRow.Id,
      MaterialId: material.Id,
      Quantity: 46,
      Uom: "kg",
      LotNo: "LOT-99",
      UnitCost: 10000,
      ConsumptionMethod: "issue",
    },
  });
  assert.equal(insufficientRes.statusCode, 422);
  assert.equal(insufficientRes.body.error.code, "MFG_INSUFFICIENT_INVENTORY");

  // ثبت موفق مصرف و کسر اتمیک از موجودی و تغییر وضعیت نیازمندی به issued
  const consumeRes = await call("POST", MATERIAL_CONSUMPTIONS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "cons-ok-1" },
    body: {
      OperationId: op10.Id,
      RequirementId: reqRow.Id,
      MaterialId: material.Id,
      Quantity: 20,
      Uom: "kg",
      LotNo: "LOT-99",
      UnitCost: 10000,
      ConsumptionMethod: "issue",
    },
  });
  assert.equal(consumeRes.statusCode, 201);
  assert.equal(consumeRes.body.data.Quantity, 20);
  assert.equal(consumeRes.body.data.requirement.Status, "issued");

  const updatedInv = await repo.get("MfgInventoryLevel", inv.Id);
  assert.equal(updatedInv.OnHandQty, 30);
  assert.equal(updatedInv.ReservedQty, 0);

  // تکرار ایدمپوتنت با همان کلید موجودی را دوباره کم نمی‌کند
  const consumeReplay = await call("POST", MATERIAL_CONSUMPTIONS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "cons-ok-1" },
    body: {
      OperationId: op10.Id,
      RequirementId: reqRow.Id,
      MaterialId: material.Id,
      Quantity: 20,
      Uom: "kg",
      LotNo: "LOT-99",
      UnitCost: 10000,
      ConsumptionMethod: "issue",
    },
  });
  assert.equal(consumeReplay.statusCode, 201);
  assert.equal(consumeReplay.body.data.Id, consumeRes.body.data.Id);
  const invAfterReplay = await repo.get("MfgInventoryLevel", inv.Id);
  assert.equal(invAfterReplay.OnHandQty, 30);
});

test("MFG REST: مشاهدهٔ هزینه، تطبیق نهایی هزینه و بستن چندگیتی سفارش تولید کار می‌کنند", async () => {
  const { repo, call } = makeApi();
  const { order } = await seedScheduleFixture(repo, { orderStatus: "in-progress", secondOperation: false });
  const op10 = repo.tables.get("MfgProductionOrderOperation")[0];

  await repo.create("MfgOperationCost", {
    PlantId: "PLANT-DEMO", ProductionOrderOperationId: op10.Id, CostCenterId: null,
    CostElement: "material", CostVersion: 1, StandardQuantity: 1, ActualQuantity: 1,
    StandardRate: 70000, ActualRate: 75000, StandardAmount: 70000, ActualAmount: 75000,
    Currency: "IRR", CalculatedAt: "2026-10-05T10:00:00.000Z",
  });
  await repo.create("MfgOperationCost", {
    PlantId: "PLANT-DEMO", ProductionOrderOperationId: op10.Id, CostCenterId: null,
    CostElement: "machine", CostVersion: 1, StandardQuantity: 120, ActualQuantity: 130,
    StandardRate: 250, ActualRate: 250, StandardAmount: 30000, ActualAmount: 32500,
    Currency: "IRR", CalculatedAt: "2026-10-05T10:00:00.000Z",
  });

  // مشاهدهٔ هزینهٔ عملیات و سفارش پیش از تطبیق (GrossMargin تهی به صفر تبدیل نمی‌شود)
  const opCostRes = await call("GET", COST_OPERATION, {
    params: { plantId: "PLANT-DEMO", operationId: op10.Id },
    headers: { "x-user-id": "u-mfg-cost" },
  });
  assert.equal(opCostRes.statusCode, 200);
  assert.equal(opCostRes.body.data.items.length, 5);
  assert.equal(opCostRes.body.data.derived, true);
  assert.ok(opCostRes.body.data.items.some((row) => row.CostElement === "scrap"));

  const ordCostBefore = await call("GET", COST_ORDER, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id },
    headers: { "x-user-id": "u-mfg-cost" },
  });
  assert.equal(ordCostBefore.statusCode, 200);
  assert.equal(ordCostBefore.body.data.StandardTotalCost, 100000);
  assert.equal(ordCostBefore.body.data.ActualTotalCost, 107500);
  assert.equal(ordCostBefore.body.data.Variance, 7500);
  assert.equal(ordCostBefore.body.data.ContractRevenue, null);
  assert.equal(ordCostBefore.body.data.GrossMargin, null);
  assert.equal(ordCostBefore.body.data.Reconciled, false);
  assert.equal(ordCostBefore.body.data.PlannedTotalCost, 100000);
  assert.equal(ordCostBefore.body.data.CostVariancePct, 7.5);
  assert.equal(ordCostBefore.body.data.OperationBreakdown.length, 1);
  assert.equal(ordCostBefore.body.data.ByElement.scrap.actual, 0);

  // تلاش برای تطبیق هزینه پیش از تکمیل عملیات رد می‌شود
  const prematureReconcile = await call("POST", COST_ORDER_RECONCILE, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id },
    headers: { "x-user-id": "u-mfg-cost", "if-match": "1", "idempotency-key": "rec-early" },
    body: { CostVersion: 1, ReconcileThrough: "2026-10-05T18:00:00.000Z" },
  });
  assert.equal(prematureReconcile.statusCode, 422);
  assert.equal(prematureReconcile.body.error.code, "MFG_OPERATIONS_NOT_COMPLETED");

  // تکمیل عملیات، اما تلاش برای بستن سفارش پیش از تطبیق هزینه رد می‌شود
  await repo.patch("MfgProductionOrderOperation", op10.Id, { Status: "completed" }, "u-mfg-supervisor", op10.RowVersion);
  const prematureClose = await call("POST", ORDER_CLOSE, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id },
    headers: { "x-user-id": "u-mfg-manager", "if-match": "1" },
    body: { closeReason: "تلاش زودهنگام" },
  });
  assert.equal(prematureClose.statusCode, 422);
  assert.equal(prematureClose.body.error.code, "MFG_COST_NOT_RECONCILED");

  // تطبیق نهایی هزینهٔ سفارش با درآمد قراردادی و محاسبهٔ GrossMargin
  const reconcileRes = await call("POST", COST_ORDER_RECONCILE, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id },
    headers: { "x-user-id": "u-mfg-cost", "if-match": "1", "idempotency-key": "rec-ok-1" },
    body: {
      CostVersion: 1,
      ReconcileThrough: "2026-10-05T18:00:00.000Z",
      ContractRevenue: 150000,
    },
  });
  assert.equal(reconcileRes.statusCode, 200);
  assert.equal(reconcileRes.body.data.Reconciled, true);
  assert.equal(reconcileRes.body.data.GrossMargin, 42500);
  assert.equal(reconcileRes.body.data.PlannedTotalCost, 100000);
  assert.equal(reconcileRes.body.data.CostVariance, 7500);
  assert.equal(reconcileRes.body.data.CostVariancePct, 7.5);
  assert.equal(reconcileRes.body.data.OperationBreakdown.length, 1);

  const reconcileReplay = await call("POST", COST_ORDER_RECONCILE, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id },
    headers: { "x-user-id": "u-mfg-cost", "if-match": "1", "idempotency-key": "rec-ok-1" },
    body: {
      CostVersion: 1,
      ReconcileThrough: "2026-10-05T18:00:00.000Z",
      ContractRevenue: 150000,
    },
  });
  assert.equal(reconcileReplay.statusCode, 200);
  assert.equal(reconcileReplay.body.data.Id, reconcileRes.body.data.Id);

  const staleReconcile = await call("POST", COST_ORDER_RECONCILE, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id },
    headers: { "x-user-id": "u-mfg-cost", "if-match": "2", "idempotency-key": "rec-stale-row" },
    body: { CostVersion: 1, ReconcileThrough: "2026-10-05T18:00:00.000Z" },
  });
  assert.equal(staleReconcile.statusCode, 409);
  assert.equal(staleReconcile.body.error.code, "MFG_ROW_VERSION_CONFLICT");

  const idempotencyConflict = await call("POST", COST_ORDER_RECONCILE, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id },
    headers: { "x-user-id": "u-mfg-cost", "if-match": "1", "idempotency-key": "rec-ok-1" },
    body: {
      CostVersion: 1,
      ReconcileThrough: "2026-10-05T18:00:00.000Z",
      ContractRevenue: 150001,
    },
  });
  assert.equal(idempotencyConflict.statusCode, 409);
  assert.equal(idempotencyConflict.body.error.code, "MFG_IDEMPOTENCY_CONFLICT");

  // بستن نهایی سفارش تولید پس از عبور از تمام گیت‌ها
  const closeRes = await call("POST", ORDER_CLOSE, {
    params: { plantId: "PLANT-DEMO", orderId: order.Id },
    headers: { "x-user-id": "u-mfg-manager", "if-match": "1" },
    body: { closeReason: "تکمیل و تحویل به انبار محصول" },
  });
  assert.equal(closeRes.statusCode, 200);
  assert.equal(closeRes.body.data.Status, "closed");
  assert.equal(closeRes.body.data.ClosedBy, "u-mfg-manager");
  assert.ok(closeRes.body.data.ClosedAt);
});

test("MFG REST: داشبورد خلاصه، بار مراکز کاری، شاخص OEE و چرخهٔ رسیدگی به هشدارها کار می‌کنند", async () => {
  const { repo, call } = makeApi();
  const { order, workCenter, resource } = await seedScheduleFixture(repo, { secondOperation: false });
  const op10 = repo.tables.get("MfgProductionOrderOperation")[0];

  await call("POST", SCHEDULE_RUNS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-plan" },
    body: {
      Direction: "forward",
      CapacityMode: "finite",
      DispatchRule: "EDD",
      From: "2026-10-05T08:00:00.000Z",
      To: "2026-10-05T17:00:00.000Z",
    },
  });

  // ثبت نشست اجرا (۳۰ دقیقه Setup + ۹۰ دقیقه Run = ۱۲۰ دقیقه کارکرد واقعی؛ ۰.۸ سالم و ۰.۲ ضایعات = ۱ واحد کل)
  const startRes = await call("POST", OPERATION_EXECUTIONS, {
    params: { plantId: "PLANT-DEMO", operationId: op10.Id },
    headers: { "x-user-id": "u-mfg-supervisor", "idempotency-key": "oee-exec-1" },
    body: { ResourceId: resource.Id, StartedAt: "2026-10-05T08:00:00.000Z" },
  });
  await call("POST", EXECUTION_REPORTS, {
    params: { plantId: "PLANT-DEMO", executionId: startRes.body.data.Id },
    headers: { "x-user-id": "u-mfg-operator", "if-match": "1" },
    body: {
      InputQuantity: 1,
      GoodQuantity: 0.8,
      ScrapQuantity: 0.2,
      ReworkQuantity: 0,
      SetupActualMinutes: 30,
      RunActualMinutes: 90,
    },
  });
  await repo.create("MfgScrapRecord", {
    PlantId: "PLANT-DEMO", ProductionOrderOperationId: op10.Id,
    ExecutionId: startRes.body.data.Id, Quantity: 0.2, Uom: "ea",
    Disposition: "scrapped", Currency: "IRR", RecordedAt: "2026-10-05T09:30:00.000Z",
  }, "u-mfg-operator");
  await repo.create("MfgMaterialRequirement", {
    PlantId: "PLANT-DEMO", ProductionOrderId: order.Id, ProductionOrderOperationId: op10.Id,
    BomItemId: "bomitem-short-dashboard", MaterialId: "material-short-dashboard",
    RequirementKey: "dashboard-shortage-v1", RequiredAt: "2026-10-05T12:00:00.000Z",
    GrossQuantity: 5, ScrapAllowanceQty: 0, NetQuantity: 5, AvailableQuantity: 3,
    ReservedQuantity: 0, ShortageQuantity: 2, Uom: "ea", ScheduleVersion: 1, Status: "shortage",
  }, "u-mfg-material");

  // ثبت ۳۰ دقیقه توقف ناخواسته و ۱۵ دقیقه توقف برنامه‌ریزی‌شده
  await call("POST", DOWNTIME, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-operator", "idempotency-key": "oee-dt-unplanned" },
    body: {
      WorkCenterId: workCenter.Id,
      OperationId: op10.Id,
      StartedAt: "2026-10-05T09:00:00.000Z",
      FinishedAt: "2026-10-05T09:30:00.000Z",
      DowntimeType: "unplanned",
      ReasonCode: "PWR-DROP",
    },
  });
  await call("POST", DOWNTIME, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-operator", "idempotency-key": "oee-dt-planned" },
    body: {
      WorkCenterId: workCenter.Id,
      StartedAt: "2026-10-05T09:00:00.000Z",
      FinishedAt: "2026-10-05T09:15:00.000Z",
      DowntimeType: "planned",
      ReasonCode: "PM-CHECK",
    },
  });

  // ثبت یک هشدار باز
  const alert = await repo.create("MfgProductionAlert", {
    PlantId: "PLANT-DEMO", AlertKey: "ALT-WC-1", AlertCode: "DOWNTIME_SPIKE",
    Severity: "high", Status: "open", ProductionOrderId: order.Id,
    ProductionOrderOperationId: op10.Id, WorkCenterId: workCenter.Id,
    TitleFa: "افزایش توقف ناخواسته", DetailFa: "توقف ۳۰ دقیقه‌ای",
    FirstRaisedAt: "2026-10-05T09:30:00.000Z", LastRaisedAt: "2026-10-05T09:30:00.000Z",
    OccurrenceCount: 1,
  });

  // ۱. داشبورد خلاصه
  const overviewRes = await call("GET", DASHBOARD_OVERVIEW, {
    params: { plantId: "PLANT-DEMO" },
    query: { from: "2026-10-05T00:00:00.000Z", to: "2026-10-06T00:00:00.000Z" },
    headers: { "x-user-id": "u-mfg-manager" },
  });
  assert.equal(overviewRes.statusCode, 200);
  assert.equal(overviewRes.body.data.openOrdersCount, 1);
  assert.equal(overviewRes.body.data.goodQuantity, 0.8);
  assert.equal(overviewRes.body.data.scrapQuantity, 0.2);
  assert.equal(overviewRes.body.data.openAlertsCount, 1);
  assert.equal(overviewRes.body.data.alerts.bySeverity.high, 1);
  assert.equal(overviewRes.body.data.openShortagesCount, 1);
  assert.equal(overviewRes.body.data.totalShortageQuantity, 2);
  assert.equal(overviewRes.body.data.shortages.dueInWindowCount, 1);
  assert.equal(overviewRes.body.data.orders.dueInWindowCount, 1);
  assert.equal(overviewRes.body.data.orders.onTimeDeliveryPct, 0);
  assert.equal(overviewRes.body.data.orders.openLateCount, 1);

  // ۲. بار مرکز کاری در داشبورد
  const loadRes = await call("GET", DASHBOARD_WC_LOAD, {
    params: { plantId: "PLANT-DEMO" },
    query: { from: "2026-10-05T00:00:00.000Z", to: "2026-10-06T00:00:00.000Z", bucket: "day" },
    headers: { "x-user-id": "u-mfg-manager" },
  });
  assert.equal(loadRes.statusCode, 200);
  assert.equal(loadRes.body.data.buckets.length, 1);

  // ۳. OEE بر پایهٔ تقویم ۴۸۰ دقیقه‌ای؛ ۱۵ دقیقه توقف برنامه‌ریزی‌شده
  // از مخرج کم و هم‌پوشانی توقف برنامه‌ریزی‌شده/ناخواسته دوباره‌شماری نمی‌شود.
  const oeeRes = await call("GET", DASHBOARD_OEE, {
    params: { plantId: "PLANT-DEMO" },
    query: { from: "2026-10-05T00:00:00.000Z", to: "2026-10-06T00:00:00.000Z", workCenterId: workCenter.Id },
    headers: { "x-user-id": "u-mfg-manager" },
  });
  assert.equal(oeeRes.statusCode, 200);
  assert.equal(oeeRes.body.data.calendar.availableMinutes, 480);
  assert.equal(oeeRes.body.data.downtime.plannedDowntimeMinutes, 15);
  assert.equal(oeeRes.body.data.downtime.unplannedDowntimeMinutes, 15);
  assert.equal(oeeRes.body.data.availability.numerator, 450);
  assert.equal(oeeRes.body.data.availability.denominator, 465);
  assert.equal(oeeRes.body.data.availability.value, 0.968);
  assert.equal(oeeRes.body.data.performance.value, 1);
  assert.equal(oeeRes.body.data.quality.value, 0.8);
  assert.equal(oeeRes.body.data.oee, 0.774);
  assert.equal(oeeRes.body.data.oeePct, 77.4);
  assert.equal(oeeRes.body.data.workCenters.length, 1);
  assert.equal(oeeRes.body.data.workCenters[0].workCenterId, workCenter.Id);
  assert.equal(oeeRes.body.data.quality.scrapQuantity, 0.2);

  // OEE کارخانه بدون فیلتر باید از تجمیع Work Centerها حاصل شود.
  const plantOee = await call("GET", DASHBOARD_OEE, {
    params: { plantId: "PLANT-DEMO" },
    query: { from: "2026-10-05T00:00:00.000Z", to: "2026-10-06T00:00:00.000Z" },
    headers: { "x-user-id": "u-mfg-manager" },
  });
  assert.equal(plantOee.statusCode, 200);
  assert.equal(plantOee.body.data.oeePct, 77.4);
  assert.equal(plantOee.body.data.workCenters.length, 1);

  // روز override بر تقویم هفتگی مقدم است؛ break و AvailabilityPct در ظرفیت اعمال می‌شوند.
  const overrideCalendar = await call("POST", WORK_CENTER_CALENDARS, {
    params: { plantId: "PLANT-DEMO", workCenterId: workCenter.Id },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      RuleType: "date-override", RuleKey: "oee-override-2026-10-06", CalendarDate: "2026-10-06",
      ShiftCode: "SHORT", StartMinuteOfDay: 480, EndMinuteOfDay: 720,
      BreakMinutes: 30, BreakStartMinuteOfDay: 600, IsWorking: true, AvailabilityPct: 80,
      EffectiveFrom: "2026-01-01",
    },
  });
  assert.equal(overrideCalendar.statusCode, 201);
  const overrideOee = await call("GET", DASHBOARD_OEE, {
    params: { plantId: "PLANT-DEMO" },
    query: { from: "2026-10-06T00:00:00.000Z", to: "2026-10-07T00:00:00.000Z", workCenterId: workCenter.Id },
    headers: { "x-user-id": "u-mfg-manager" },
  });
  assert.equal(overrideOee.statusCode, 200);
  assert.equal(overrideOee.body.data.calendar.availableMinutes, 168);
  assert.equal(overrideOee.body.data.oee, null);

  // ۴. فهرست هشدارها و رسیدگی (acknowledge) با If-Match
  const alertsRes = await call("GET", ALERTS, {
    params: { plantId: "PLANT-DEMO" },
    query: { status: "open", severity: "high" },
    headers: { "x-user-id": "u-mfg-manager" },
  });
  assert.equal(alertsRes.statusCode, 200);
  assert.equal(alertsRes.body.data.page.total, 1);

  const ackRes = await call("POST", ALERT_ACK, {
    params: { plantId: "PLANT-DEMO", alertId: alert.Id },
    headers: { "x-user-id": "u-mfg-manager", "if-match": "1" },
    body: { NoteFa: "تیم تعمیرات اعزام شد" },
  });
  assert.equal(ackRes.statusCode, 200);
  assert.equal(ackRes.body.data.Status, "acknowledged");
  assert.equal(ackRes.body.data.AcknowledgedBy, "u-mfg-manager");

  // تلاش مجدد برای acknowledge هشدار غیر open با 409 رد می‌شود
  const ackAgain = await call("POST", ALERT_ACK, {
    params: { plantId: "PLANT-DEMO", alertId: alert.Id },
    headers: { "x-user-id": "u-mfg-manager", "if-match": "2" },
    body: {},
  });
  assert.equal(ackAgain.statusCode, 409);
  assert.equal(ackAgain.body.error.code, "MFG_STATE_CONFLICT");
});

test("MFG REST: مدیریت قطعه (GET/PATCH /parts/:partId) و CRUD سربرگ و ردیف BOM پیش‌نویس با کنترل If-Match", async () => {
  const { call } = makeApi();

  // ۱. ایجاد قطعهٔ محصول و دو قطعهٔ جزء
  const pParent = await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-BOM-TOP", NameFa: "پمپ اصلی", PartType: "manufactured", BaseUom: "ea", StandardUnitCost: 1000 },
  });
  assert.equal(pParent.statusCode, 201);

  const pChild1 = await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-BOM-C1", NameFa: "پروانه", PartType: "purchased", BaseUom: "ea" },
  });
  const pChild2 = await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-BOM-C2", NameFa: "واشر آب‌بندی", PartType: "purchased", BaseUom: "ea" },
  });

  // ۲. خواندن و ویرایش قطعه با If-Match و جلوگیری از تغییر PartNo
  const getPart = await call("GET", PART, {
    params: { plantId: "PLANT-DEMO", partId: pParent.body.data.Id },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(getPart.statusCode, 200);
  assert.equal(getPart.body.data.PartNo, "P-BOM-TOP");

  const patchForbiddenField = await call("PATCH", PART, {
    params: { plantId: "PLANT-DEMO", partId: pParent.body.data.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { PartNo: "CHANGED" },
  });
  assert.equal(patchForbiddenField.statusCode, 400);
  assert.equal(patchForbiddenField.body.error.code, "MFG_UNKNOWN_FIELDS");

  const patchPart = await call("PATCH", PART, {
    params: { plantId: "PLANT-DEMO", partId: pParent.body.data.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { NameFa: "پمپ اصلی بازنگری‌شده", StandardUnitCost: 1250, IsLotTracked: true },
  });
  assert.equal(patchPart.statusCode, 200);
  assert.equal(patchPart.body.data.NameFa, "پمپ اصلی بازنگری‌شده");
  assert.equal(patchPart.body.data.StandardUnitCost, 1250);
  assert.equal(patchPart.body.data.IsLotTracked, true);
  assert.equal(patchPart.body.data.RowVersion, 2);

  // ۳. ساخت سربرگ BOM پیش‌نویس و ویرایش آن
  const bomRes = await call("POST", BOM_HEADERS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      PartId: pParent.body.data.Id,
      Revision: "R1",
      BaseQuantity: 1,
      BaseUom: "ea",
      EffectiveFrom: "2026-10-01",
      IsDefault: true,
    },
  });
  assert.equal(bomRes.statusCode, 201);
  assert.equal(bomRes.body.data.Status, "draft");
  const bomId = bomRes.body.data.Id;

  const patchBom = await call("PATCH", BOM_HEADER, {
    params: { plantId: "PLANT-DEMO", bomId },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { NoteFa: "نسخهٔ اولیهٔ مهندسی", EffectiveTo: "2027-10-01" },
  });
  assert.equal(patchBom.statusCode, 200);
  assert.equal(patchBom.body.data.NoteFa, "نسخهٔ اولیهٔ مهندسی");
  assert.equal(patchBom.body.data.RowVersion, 2);

  // ۴. افزودن، ویرایش، فهرست و حذف ردیف BOM
  const item1Res = await call("POST", BOM_ITEMS, {
    params: { plantId: "PLANT-DEMO", bomId },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      LineNo: 10,
      ComponentPartId: pChild1.body.data.Id,
      QuantityPer: 2,
      Uom: "ea",
      ScrapPct: 5,
      IssueMethod: "backflush",
    },
  });
  assert.equal(item1Res.statusCode, 201);

  const item2Res = await call("POST", BOM_ITEMS, {
    params: { plantId: "PLANT-DEMO", bomId },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      LineNo: 20,
      ComponentPartId: pChild2.body.data.Id,
      QuantityPer: 4,
      Uom: "ea",
      ScrapPct: 0,
      IssueMethod: "manual",
    },
  });
  assert.equal(item2Res.statusCode, 201);

  const patchItem1 = await call("PATCH", BOM_ITEM, {
    params: { plantId: "PLANT-DEMO", itemId: item1Res.body.data.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { QuantityPer: 3, ScrapPct: 10 },
  });
  assert.equal(patchItem1.statusCode, 200);
  assert.equal(patchItem1.body.data.QuantityPer, 3);
  assert.equal(patchItem1.body.data.ScrapPct, 10);

  const itemsList = await call("GET", BOM_ITEMS, {
    params: { plantId: "PLANT-DEMO", bomId },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(itemsList.statusCode, 200);
  assert.equal(itemsList.body.data.page.total, 2);

  const delItem2 = await call("DELETE", BOM_ITEM, {
    params: { plantId: "PLANT-DEMO", itemId: item2Res.body.data.Id },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(delItem2.statusCode, 204);

  const itemsAfterDelete = await call("GET", BOM_ITEMS, {
    params: { plantId: "PLANT-DEMO", bomId },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(itemsAfterDelete.body.data.page.total, 1);
});

test("MFG REST: آزادسازی BOM (POST /bom-headers/:bomId/release) و انفجار چندسطحی (POST /bom-headers/:bomId/explosions)", async () => {
  const { call } = makeApi();

  // ساخت درخت دو سطحی: P-FG -> P-SUB (manufactured) -> P-RAW (purchased)
  const pFg = (await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-FG-1", NameFa: "محصول نهایی", PartType: "manufactured", BaseUom: "ea" },
  })).body.data;

  const pSub = (await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-SUB-1", NameFa: "زیرمجموعه", PartType: "manufactured", BaseUom: "ea" },
  })).body.data;

  const pRaw = (await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-RAW-1", NameFa: "ورق فولادی", PartType: "purchased", BaseUom: "kg" },
  })).body.data;

  // ۱. ساخت و آزادسازی BOM زیرمجموعه (P-SUB-1)
  const subBom = (await call("POST", BOM_HEADERS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartId: pSub.Id, Revision: "A", BaseQuantity: 1, BaseUom: "ea", EffectiveFrom: "2026-01-01", IsDefault: true },
  })).body.data;

  // تلاش برای آزادسازی BOM خالی باید با 422 رد شود
  const emptyRelease = await call("POST", BOM_RELEASE, {
    params: { plantId: "PLANT-DEMO", bomId: subBom.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { EffectiveAt: "2026-10-05" },
  });
  assert.equal(emptyRelease.statusCode, 422);
  assert.equal(emptyRelease.body.error.code, "MFG_BOM_EMPTY");

  await call("POST", BOM_ITEMS, {
    params: { plantId: "PLANT-DEMO", bomId: subBom.Id },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { LineNo: 10, ComponentPartId: pRaw.Id, QuantityPer: 2.5, Uom: "kg", ScrapPct: 0, IssueMethod: "manual" },
  });

  const subRelease = await call("POST", BOM_RELEASE, {
    params: { plantId: "PLANT-DEMO", bomId: subBom.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { EffectiveAt: "2026-10-05" },
  });
  assert.equal(subRelease.statusCode, 200);
  assert.equal(subRelease.body.data.Status, "released");
  assert.equal(subRelease.body.data.ReleasedBy, "u-mfg-eng");

  // ۲. ساخت و آزادسازی BOM محصول نهایی (P-FG-1)
  const fgBom = (await call("POST", BOM_HEADERS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartId: pFg.Id, Revision: "A", BaseQuantity: 1, BaseUom: "ea", EffectiveFrom: "2026-01-01", IsDefault: true },
  })).body.data;

  await call("POST", BOM_ITEMS, {
    params: { plantId: "PLANT-DEMO", bomId: fgBom.Id },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { LineNo: 10, ComponentPartId: pSub.Id, QuantityPer: 2, Uom: "ea", ScrapPct: 10, IssueMethod: "backflush" },
  });

  const fgRelease = await call("POST", BOM_RELEASE, {
    params: { plantId: "PLANT-DEMO", bomId: fgBom.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { EffectiveAt: "2026-10-05" },
  });
  assert.equal(fgRelease.statusCode, 200);
  assert.equal(fgRelease.body.data.Status, "released");

  // پس از release، ویرایش سربرگ BOM با 422 رد می‌شود
  const editAfterRelease = await call("PATCH", BOM_HEADER, {
    params: { plantId: "PLANT-DEMO", bomId: fgBom.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "2" },
    body: { NoteFa: "تلاش برای تغییر پس از انتشار" },
  });
  assert.equal(editAfterRelease.statusCode, 422);
  assert.equal(editAfterRelease.body.error.code, "MFG_BOM_NOT_DRAFT");

  // ۳. هم‌پوشانی نسخهٔ پیش‌فرض برای همان قطعه با 409 رد می‌شود
  const fgBomDupDefault = (await call("POST", BOM_HEADERS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartId: pFg.Id, Revision: "B", BaseQuantity: 1, BaseUom: "ea", EffectiveFrom: "2026-06-01", IsDefault: true },
  })).body.data;
  await call("POST", BOM_ITEMS, {
    params: { plantId: "PLANT-DEMO", bomId: fgBomDupDefault.Id },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { LineNo: 10, ComponentPartId: pSub.Id, QuantityPer: 2, Uom: "ea", ScrapPct: 0, IssueMethod: "manual" },
  });
  const overlapRelease = await call("POST", BOM_RELEASE, {
    params: { plantId: "PLANT-DEMO", bomId: fgBomDupDefault.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { EffectiveAt: "2026-10-05" },
  });
  assert.equal(overlapRelease.statusCode, 409);
  assert.equal(overlapRelease.body.error.code, "MFG_BOM_DEFAULT_OVERLAP");

  // ۴. انفجار چندسطحی BOM محصول نهایی برای Quantity = 10
  // سطح ۱ (P-SUB-1): Gross = 10 * 2 = 20, Scrap = 2, Net = 22, Depth = 1
  // سطح ۲ (P-RAW-1): Gross = 22 * 2.5 = 55, Scrap = 0, Net = 55, Depth = 2
  const explosion = await call("POST", BOM_EXPLOSIONS, {
    params: { plantId: "PLANT-DEMO", bomId: fgBom.Id },
    headers: { "x-user-id": "u-mfg-plan" },
    body: { Quantity: 10, At: "2026-10-05" },
  });
  assert.equal(explosion.statusCode, 200);
  assert.equal(explosion.body.data.lines.length, 2);
  assert.equal(explosion.body.data.lines[0].PartId, pSub.Id);
  assert.equal(explosion.body.data.lines[0].GrossQuantity, 20);
  assert.equal(explosion.body.data.lines[0].ScrapAllowanceQty, 2);
  assert.equal(explosion.body.data.lines[0].NetQuantity, 22);
  assert.equal(explosion.body.data.lines[0].Depth, 1);

  assert.equal(explosion.body.data.lines[1].PartId, pRaw.Id);
  assert.equal(explosion.body.data.lines[1].GrossQuantity, 55);
  assert.equal(explosion.body.data.lines[1].ScrapAllowanceQty, 0);
  assert.equal(explosion.body.data.lines[1].NetQuantity, 55);
  assert.equal(explosion.body.data.lines[1].Depth, 2);
});

test("MFG REST: مدیریت Routing پیش‌نویس و عملیات آن (GET/POST/PATCH/DELETE) با کنترل پیش‌نیاز و Overlap", async () => {
  const { repo, call } = makeApi();

  const part = (await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-RT-10", NameFa: "شفت فولادی", PartType: "manufactured", BaseUom: "ea" },
  })).body.data;

  const wc = await repo.create("MfgWorkCenter", {
    PlantId: "PLANT-DEMO", Code: "WC-RT-1", NameFa: "مرکز تراش", Kind: "machine",
    NominalCapacityMinutesPerDay: 480, EfficiencyPct: 100, TimeZoneId: "UTC", Status: "active",
  }, "u-mfg-eng");

  // ۱. ساخت سربرگ Routing پیش‌نویس و ویرایش آن
  const createdRouting = await call("POST", ROUTINGS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      PartId: part.Id,
      RoutingCode: "RT-SHAFT",
      Revision: "R1",
      BaseQuantity: 1,
      BaseUom: "ea",
      EffectiveFrom: "2026-01-01",
      IsDefault: true,
    },
  });
  assert.equal(createdRouting.statusCode, 201);
  assert.equal(createdRouting.body.data.Status, "draft");
  const routingId = createdRouting.body.data.Id;

  const patchRouting = await call("PATCH", ROUTING, {
    params: { plantId: "PLANT-DEMO", routingId },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { NoteFa: "مسیر ساخت استاندارد شفت", EffectiveTo: "2027-01-01" },
  });
  assert.equal(patchRouting.statusCode, 200);
  assert.equal(patchRouting.body.data.RowVersion, 2);

  // ۲. افزودن عملیات اول و بررسی خطای Overlap بدون TransferBatchQty
  const badOverlap = await call("POST", ROUTING_OPERATIONS, {
    params: { plantId: "PLANT-DEMO", routingId },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      SequenceNo: 10,
      OperationCode: "OP-10",
      OperationNameFa: "تراش اولیه",
      WorkCenterId: wc.Id,
      SetupMinutes: 15,
      RunMinutesPerUnit: 30,
      OverlapAllowed: true,
    },
  });
  assert.equal(badOverlap.statusCode, 422);
  assert.equal(badOverlap.body.error.code, "MFG_ROUTING_OVERLAP_INVALID");

  const op10 = (await call("POST", ROUTING_OPERATIONS, {
    params: { plantId: "PLANT-DEMO", routingId },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      SequenceNo: 10,
      OperationCode: "OP-10",
      OperationNameFa: "تراش اولیه",
      WorkCenterId: wc.Id,
      SetupMinutes: 15,
      RunMinutesPerUnit: 30,
      OverlapAllowed: true,
      TransferBatchQty: 5,
    },
  })).body.data;

  // ۳. افزودن عملیات دوم با پیش‌نیاز SequenceNo = 10
  const op20 = (await call("POST", ROUTING_OPERATIONS, {
    params: { plantId: "PLANT-DEMO", routingId },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      SequenceNo: 20,
      OperationCode: "OP-20",
      OperationNameFa: "سنگ‌زنی",
      WorkCenterId: wc.Id,
      SetupMinutes: 10,
      RunMinutesPerUnit: 20,
      PredecessorSequence: 10,
      InspectionRequired: true,
    },
  })).body.data;

  // تلاش برای حذف op10 در حالی که op20 به آن وابسته است باید با 422 رد شود
  const delBlockedByPred = await call("DELETE", ROUTING_OPERATION, {
    params: { plantId: "PLANT-DEMO", routingOperationId: op10.Id },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(delBlockedByPred.statusCode, 422);
  assert.equal(delBlockedByPred.body.error.code, "MFG_ROUTING_PREDECESSOR_IN_USE");

  // ویرایش op20 و برداشتن وابستگی و سپس حذف آن
  const patchOp20 = await call("PATCH", ROUTING_OPERATION, {
    params: { plantId: "PLANT-DEMO", routingOperationId: op20.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { RunMinutesPerUnit: 25, PredecessorSequence: null },
  });
  assert.equal(patchOp20.statusCode, 200);
  assert.equal(patchOp20.body.data.RunMinutesPerUnit, 25);

  const delOp20 = await call("DELETE", ROUTING_OPERATION, {
    params: { plantId: "PLANT-DEMO", routingOperationId: op20.Id },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(delOp20.statusCode, 204);

  const opsList = await call("GET", ROUTING_OPERATIONS, {
    params: { plantId: "PLANT-DEMO", routingId },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(opsList.statusCode, 200);
  assert.equal(opsList.body.data.page.total, 1);
});

test("MFG REST: آزادسازی Routing (POST /routings/:routingId/release) نیازمند منبع فعال مرکز کاری و نبود هم‌پوشانی نسخهٔ پیش‌فرض است", async () => {
  const { repo, call } = makeApi();

  const part = (await call("POST", PARTS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { PartNo: "P-RT-REL", NameFa: "پوسته یاتاقان", PartType: "manufactured", BaseUom: "ea" },
  })).body.data;

  const wc = await repo.create("MfgWorkCenter", {
    PlantId: "PLANT-DEMO", Code: "WC-RT-REL", NameFa: "مرکز فرز", Kind: "machine",
    NominalCapacityMinutesPerDay: 480, EfficiencyPct: 100, TimeZoneId: "UTC", Status: "active",
  }, "u-mfg-eng");

  const routing = (await call("POST", ROUTINGS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      PartId: part.Id,
      RoutingCode: "RT-HOUSING",
      Revision: "A",
      BaseQuantity: 1,
      BaseUom: "ea",
      EffectiveFrom: "2026-01-01",
      IsDefault: true,
    },
  })).body.data;

  // ۱. آزادسازی بدون Operation با 422 رد می‌شود
  const emptyRel = await call("POST", ROUTING_RELEASE, {
    params: { plantId: "PLANT-DEMO", routingId: routing.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { EffectiveAt: "2026-10-05" },
  });
  assert.equal(emptyRel.statusCode, 422);
  assert.equal(emptyRel.body.error.code, "MFG_ROUTING_EMPTY");

  await call("POST", ROUTING_OPERATIONS, {
    params: { plantId: "PLANT-DEMO", routingId: routing.Id },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      SequenceNo: 10,
      OperationCode: "MILL-10",
      OperationNameFa: "فرزکاری پوسته",
      WorkCenterId: wc.Id,
      SetupMinutes: 20,
      RunMinutesPerUnit: 40,
    },
  });

  // ۲. آزادسازی بدون منبع فعال در Work Center با 422 رد می‌شود
  const noResRel = await call("POST", ROUTING_RELEASE, {
    params: { plantId: "PLANT-DEMO", routingId: routing.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { EffectiveAt: "2026-10-05" },
  });
  assert.equal(noResRel.statusCode, 422);
  assert.equal(noResRel.body.error.code, "MFG_WORKCENTER_NO_RESOURCE");

  await repo.create("MfgWorkCenterResource", {
    PlantId: "PLANT-DEMO",
    WorkCenterId: wc.Id,
    ResourceCode: "CNC-MILL-1",
    NameFa: "فرز CNC شماره ۱",
    ResourceKind: "machine",
    CapacityUnits: 1,
    AvailabilityPct: 100,
    IsActive: true,
  }, "u-mfg-eng");

  // ۳. آزادسازی موفق
  const released = await call("POST", ROUTING_RELEASE, {
    params: { plantId: "PLANT-DEMO", routingId: routing.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { EffectiveAt: "2026-10-05" },
  });
  assert.equal(released.statusCode, 200);
  assert.equal(released.body.data.Status, "released");
  assert.equal(released.body.data.ReleasedBy, "u-mfg-eng");

  // ۴. هم‌پوشانی نسخهٔ پیش‌فرض برای همان قطعه با 409 رد می‌شود
  const dupDefault = (await call("POST", ROUTINGS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      PartId: part.Id,
      RoutingCode: "RT-HOUSING",
      Revision: "B",
      BaseQuantity: 1,
      BaseUom: "ea",
      EffectiveFrom: "2026-06-01",
      IsDefault: true,
    },
  })).body.data;
  await call("POST", ROUTING_OPERATIONS, {
    params: { plantId: "PLANT-DEMO", routingId: dupDefault.Id },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      SequenceNo: 10,
      OperationCode: "MILL-10",
      OperationNameFa: "فرزکاری پوسته",
      WorkCenterId: wc.Id,
      SetupMinutes: 20,
      RunMinutesPerUnit: 35,
    },
  });
  const overlapRel = await call("POST", ROUTING_RELEASE, {
    params: { plantId: "PLANT-DEMO", routingId: dupDefault.Id },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { EffectiveAt: "2026-10-05" },
  });
  assert.equal(overlapRel.statusCode, 409);
  assert.equal(overlapRel.body.error.code, "MFG_ROUTING_DEFAULT_OVERLAP");
});

test("MFG REST: مدیریت مراکز کاری و منابع (GET/POST/PATCH work-centers & resources) و جلوگیری از غیرفعال‌سازی مرکز دارای عملیات جاری", async () => {
  const { repo, call } = makeApi();

  // ۱. ایجاد مرکز کاری و بررسی منطقهٔ زمانی نامعتبر
  const badTz = await call("POST", WORK_CENTERS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      Code: "WC-BAD-TZ",
      NameFa: "مرکز نامعتبر",
      Kind: "machine",
      NominalCapacityMinutesPerDay: 480,
      EfficiencyPct: 95,
      TimeZoneId: "Invalid/Zone",
    },
  });
  assert.equal(badTz.statusCode, 400);
  assert.equal(badTz.body.error.code, "MFG_VALIDATION_FAILED");

  const wcRes = await call("POST", WORK_CENTERS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      Code: "WC-ASM-01",
      NameFa: "خط مونتاژ اول",
      Kind: "assembly",
      NominalCapacityMinutesPerDay: 480,
      EfficiencyPct: 95,
      TimeZoneId: "Asia/Tehran",
    },
  });
  assert.equal(wcRes.statusCode, 201);
  const wcId = wcRes.body.data.Id;

  const listWc = await call("GET", WORK_CENTERS, {
    params: { plantId: "PLANT-DEMO" },
    query: { kind: "assembly", status: "active", q: "ASM" },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(listWc.statusCode, 200);
  assert.equal(listWc.body.data.page.total, 1);

  // ۲. افزودن و ویرایش منبع مرکز کاری
  const resCreate = await call("POST", WORK_CENTER_RESOURCES, {
    params: { plantId: "PLANT-DEMO", workCenterId: wcId },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      ResourceCode: "ASM-BENCH-1",
      NameFa: "ایستگاه مونتاژ ۱",
      ResourceKind: "labor",
      CapacityUnits: 2,
      AvailabilityPct: 90,
      EffectiveFrom: "2026-01-01",
    },
  });
  assert.equal(resCreate.statusCode, 201);
  const resourceId = resCreate.body.data.Id;

  const resPatch = await call("PATCH", WORK_CENTER_RESOURCE, {
    params: { plantId: "PLANT-DEMO", resourceId },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { CapacityUnits: 3, AvailabilityPct: 95 },
  });
  assert.equal(resPatch.statusCode, 200);
  assert.equal(resPatch.body.data.CapacityUnits, 3);

  const listRes = await call("GET", WORK_CENTER_RESOURCES, {
    params: { plantId: "PLANT-DEMO", workCenterId: wcId },
    query: { activeOnly: "true" },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.body.data.page.total, 1);

  // ۳. جلوگیری از غیرفعال‌سازی مرکز کاری دارای عملیات running
  await repo.create("MfgProductionOrderOperation", {
    PlantId: "PLANT-DEMO",
    ProductionOrderId: "order-running-1",
    SequenceNo: 10,
    OperationCode: "OP-RUN",
    OperationNameFa: "عملیات در حال اجرا",
    WorkCenterId: wcId,
    Status: "running",
    PlannedQuantity: 10,
    PlannedSetupMinutes: 10,
    PlannedRunMinutesPerUnit: 5,
    PlannedQueueMinutes: 0,
    PlannedMoveMinutes: 0,
    PlannedCapacityMinutes: 60,
    OverlapAllowed: false,
    InspectionRequired: false,
  });

  const deactivateBlocked = await call("PATCH", WORK_CENTER, {
    params: { plantId: "PLANT-DEMO", workCenterId: wcId },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { Status: "inactive" },
  });
  assert.equal(deactivateBlocked.statusCode, 422);
  assert.equal(deactivateBlocked.body.error.code, "MFG_WORK_CENTER_HAS_ACTIVE_OPERATIONS");
});

test("MFG REST: مدیریت تقویم مراکز کاری (GET/POST/PATCH calendars) با کنترل BreakStartMinuteOfDay و برنامهٔ firm", async () => {
  const { repo, call } = makeApi();

  const wc = (await call("POST", WORK_CENTERS, {
    params: { plantId: "PLANT-DEMO" },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      Code: "WC-CAL-01",
      NameFa: "مرکز تقویم",
      Kind: "machine",
      NominalCapacityMinutesPerDay: 480,
      EfficiencyPct: 100,
      TimeZoneId: "UTC",
    },
  })).body.data;

  // ۱. رد شدن استراحت بدون BreakStartMinuteOfDay صریح
  const missingBreakStart = await call("POST", WORK_CENTER_CALENDARS, {
    params: { plantId: "PLANT-DEMO", workCenterId: wc.Id },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      RuleType: "weekly",
      RuleKey: "W-MON-S1",
      WeekdayIso: 1,
      ShiftCode: "S1",
      StartMinuteOfDay: 480,
      EndMinuteOfDay: 960,
      BreakMinutes: 30,
      IsWorking: true,
      AvailabilityPct: 100,
      EffectiveFrom: "2026-01-01",
    },
  });
  assert.equal(missingBreakStart.statusCode, 400);
  assert.equal(missingBreakStart.body.error.code, "MFG_VALIDATION_FAILED");

  // ۲. ثبت الگوی هفتگی معتبر با BreakStartMinuteOfDay صریح
  const createdCal = await call("POST", WORK_CENTER_CALENDARS, {
    params: { plantId: "PLANT-DEMO", workCenterId: wc.Id },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      RuleType: "weekly",
      RuleKey: "W-MON-S1",
      WeekdayIso: 1,
      ShiftCode: "S1",
      StartMinuteOfDay: 480,
      EndMinuteOfDay: 960,
      BreakMinutes: 30,
      BreakStartMinuteOfDay: 720,
      IsWorking: true,
      AvailabilityPct: 100,
      EffectiveFrom: "2026-01-01",
    },
  });
  assert.equal(createdCal.statusCode, 201);
  const calId = createdCal.body.data.Id;

  // ۳. ویرایش تقویم پیش از وجود برنامهٔ firm
  const patchedCal = await call("PATCH", WORK_CENTER_CALENDAR, {
    params: { plantId: "PLANT-DEMO", calendarId: calId },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { EndMinuteOfDay: 1020 },
  });
  assert.equal(patchedCal.statusCode, 200);
  assert.equal(patchedCal.body.data.EndMinuteOfDay, 1020);
  assert.equal(patchedCal.body.data.RowVersion, 2);

  // ۴. فهرست تقویم در بازهٔ زمانی
  const listCal = await call("GET", WORK_CENTER_CALENDARS, {
    params: { plantId: "PLANT-DEMO", workCenterId: wc.Id },
    query: { from: "2026-10-01", to: "2026-10-31" },
    headers: { "x-user-id": "u-mfg-eng" },
  });
  assert.equal(listCal.statusCode, 200);
  assert.equal(listCal.body.data.page.total, 1);

  // ۵. جلوگیری از تغییر تقویم وقتی قطعهٔ زمان‌بندی firm روی آن وجود دارد
  await repo.create("MfgOperationSchedule", {
    PlantId: "PLANT-DEMO",
    ScheduleVersion: 1,
    ProductionOrderId: "order-firm-1",
    ProductionOrderOperationId: "op-firm-1",
    WorkCenterId: wc.Id,
    ResourceId: null,
    SegmentNo: 1,
    PlannedStartAt: "2026-10-05T08:00:00.000Z",
    PlannedEndAt: "2026-10-05T12:00:00.000Z",
    PlannedCapacityMinutes: 240,
    QueueMinutes: 0,
    MoveMinutes: 0,
    CapacityMode: "finite",
    Direction: "forward",
    DispatchRule: "EDD",
    Status: "firm",
  });

  const patchBlockedByFirm = await call("PATCH", WORK_CENTER_CALENDAR, {
    params: { plantId: "PLANT-DEMO", calendarId: calId },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "2" },
    body: { AvailabilityPct: 80 },
  });
  assert.equal(patchBlockedByFirm.statusCode, 422);
  assert.equal(patchBlockedByFirm.body.error.code, "MFG_CALENDAR_USED_BY_FIRM_SCHEDULE");
});

test("MFG REST: بلوک Planning روی قطعه، مادهٔ برنامه‌ریزی و موجودی افتتاحیه را در همان تراکنش می‌سازد", async () => {
  const { repo, call } = makeApi();
  const plantId = "PLANT-DEMO";
  const eng = { "x-user-id": "u-mfg-eng" };

  // ۱. قطعهٔ خریدنی با بلوک Planning کامل
  const created = await call("POST", PARTS, {
    params: { plantId },
    headers: eng,
    body: {
      PartNo: "RM-PLAN-01",
      NameFa: "ورق فولادی",
      PartType: "purchased",
      BaseUom: "kg",
      StandardUnitCost: 9_500,
      Currency: "IRR",
      Planning: {
        LeadTimeDays: 12,
        SafetyStockQty: 40,
        LotSize: 100,
        OrderMultiple: 25,
        DefaultWarehouseCode: "WH-RAW",
        OpeningInventory: { WarehouseCode: "WH-RAW", LocationCode: "A-01", OnHandQty: 250, ReservedQty: 10 },
      },
    },
  });
  assert.equal(created.statusCode, 201);
  const partId = created.body.data.Id;
  // نوع تأمین از نوع قطعه مشتق می‌شود: purchased → buy
  assert.equal(created.body.data.Material.ProcurementType, "buy");
  assert.equal(created.body.data.Material.LeadTimeDays, 12);
  assert.equal(created.body.data.Material.StandardUnitCost, 9_500);
  assert.equal(created.body.data.Inventory.OnHandQty, 250);
  assert.equal(created.body.data.Inventory.ReservedQty, 10);
  assert.equal(created.body.data.Inventory.MaterialId, created.body.data.Material.Id);
  assert.equal(repo.tables.get("MfgMaterial").length, 1);
  assert.equal(repo.tables.get("MfgInventoryLevel").length, 1);

  // ۲. مواد فهرست‌شده همان ردیف را با پیوند قطعه برمی‌گرداند
  const materials = await call("GET", MATERIALS, { params: { plantId }, headers: { "x-user-id": "u-mfg-material" }, query: { procurementType: "buy" } });
  assert.equal(materials.statusCode, 200);
  assert.equal(materials.body.data.page.total, 1);
  assert.equal(materials.body.data.items[0].PartNo, "RM-PLAN-01");
  assert.equal(materials.body.data.items[0].PartNameFa, "ورق فولادی");

  // ۳. بدون بلوک Planning هیچ ردیف ماده‌ای ساخته نمی‌شود (رفتار پیشین دست‌نخورده)
  const plain = await call("POST", PARTS, {
    params: { plantId },
    headers: eng,
    body: { PartNo: "FG-PLAIN-01", NameFa: "قطعهٔ بدون برنامه‌ریزی", PartType: "manufactured", BaseUom: "ea" },
  });
  assert.equal(plain.statusCode, 201);
  assert.equal(plain.body.data.Material, undefined);
  assert.equal(repo.tables.get("MfgMaterial").length, 1);

  // ۴. کلید ناشناخته در Planning و ProcurementType نامعتبر رد می‌شوند
  const unknownField = await call("POST", PARTS, {
    params: { plantId },
    headers: eng,
    body: {
      PartNo: "RM-BAD-01", NameFa: "نامعتبر", PartType: "purchased", BaseUom: "kg",
      Planning: { ProcurementType: "buy", Unexpected: true },
    },
  });
  assert.equal(unknownField.statusCode, 400);
  assert.equal(unknownField.body.error.code, "MFG_UNKNOWN_FIELDS");
  const badType = await call("POST", PARTS, {
    params: { plantId },
    headers: eng,
    body: { PartNo: "RM-BAD-02", NameFa: "نامعتبر", PartType: "purchased", BaseUom: "kg", Planning: { ProcurementType: "lease" } },
  });
  assert.equal(badType.statusCode, 400);
  const badInventory = await call("POST", PARTS, {
    params: { plantId },
    headers: eng,
    body: {
      PartNo: "RM-BAD-03", NameFa: "نامعتبر", PartType: "purchased", BaseUom: "kg",
      Planning: { OpeningInventory: { WarehouseCode: "WH-RAW", OnHandQty: 5, BlockedQty: 9 } },
    },
  });
  assert.equal(badInventory.statusCode, 400);
  assert.equal(repo.tables.get("MfgPart").length, 2);

  // ۵. تکرار همان PartNo ردیف ماده/موجودی دوم نمی‌سازد
  const duplicate = await call("POST", PARTS, {
    params: { plantId },
    headers: eng,
    body: { PartNo: "RM-PLAN-01", NameFa: "تکراری", PartType: "purchased", BaseUom: "kg", Planning: { LeadTimeDays: 1 } },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(repo.tables.get("MfgMaterial").length, 1);
  assert.equal(repo.tables.get("MfgInventoryLevel").length, 1);

  // ۶. PATCH فقط-Planning روی قطعهٔ بدون ماده، ماده را می‌سازد و موجودی را دوباره درج نمی‌کند
  const plainId = plain.body.data.Id;
  const patchPlanning = await call("PATCH", PART, {
    params: { plantId, partId: plainId },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: {
      Planning: {
        LotSize: 5,
        OpeningInventory: { WarehouseCode: "WH-FG", OnHandQty: 30 },
      },
    },
  });
  assert.equal(patchPlanning.statusCode, 200);
  assert.equal(patchPlanning.body.data.Material.PartId, plainId);
  assert.equal(patchPlanning.body.data.Material.ProcurementType, "make");
  assert.equal(patchPlanning.body.data.Inventory.OnHandQty, 30);
  assert.equal(repo.tables.get("MfgInventoryLevel").length, 2);

  const replay = await call("PATCH", PART, {
    params: { plantId, partId: plainId },
    headers: { "x-user-id": "u-mfg-eng", "if-match": "1" },
    body: { Planning: { LotSize: 7, OpeningInventory: { WarehouseCode: "WH-FG", OnHandQty: 30 } } },
  });
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.body.data.Material.LotSize, 7);
  // موجودی افتتاحیه تکرار نمی‌شود؛ انبار با فراخوانی دوباره دو برابر نمی‌شود
  assert.equal(repo.tables.get("MfgInventoryLevel").length, 2);
  assert.equal(replay.body.data.Inventory.OnHandQty, 30);

  // ۷. شکست درج موجودی، قطعه و ماده را هم rollback می‌کند
  repo.failCreateOn = "MfgInventoryLevel";
  const rolledBack = await call("POST", PARTS, {
    params: { plantId },
    headers: eng,
    body: {
      PartNo: "RM-ROLLBACK-01", NameFa: "باید برگردد", PartType: "purchased", BaseUom: "kg",
      Planning: { OpeningInventory: { WarehouseCode: "WH-RAW", OnHandQty: 5 } },
    },
  });
  assert.equal(rolledBack.statusCode, 500);
  repo.failCreateOn = null;
  assert.equal(repo.tables.get("MfgPart").some((row) => row.PartNo === "RM-ROLLBACK-01"), false);
  assert.equal(repo.tables.get("MfgMaterial").some((row) => row.PartNo === "RM-ROLLBACK-01"), false);
});

const round3 = (value) => Math.round((value + Number.EPSILON) * 1000) / 1000;

test("MFG REST: رول‌آپ هزینه از دادهٔ واقعی، تطبیق و بستن سفارش را ممکن می‌کند", async () => {
  const { repo, call } = makeApi();
  const plantId = "PLANT-DEMO";
  const costView = { "x-user-id": "u-mfg-cost" };
  const manager = { "x-user-id": "u-mfg-manager" };

  /* نرخ‌ها فقط در MfgCostCenter نگه داشته می‌شوند و قرارداد مسیر جداگانه‌ای برای
   * ساخت آن‌ها ندارد؛ بلوک اختیاری Rates روی همان مرکز کاری این کار را می‌کند. */
  const workCenterResponse = await call("POST", WORK_CENTERS, {
    params: { plantId },
    headers: { "x-user-id": "u-mfg-eng" },
    body: {
      Code: "WC-COST",
      NameFa: "مرکز ماشین‌کاری هزینه",
      Kind: "machine",
      NominalCapacityMinutesPerDay: 960,
      EfficiencyPct: 100,
      TimeZoneId: "Asia/Tehran",
      Status: "active",
      Rates: [
        { CostElement: "machine", HourlyRate: 1_200 },
        { CostElement: "overhead", HourlyRate: 300 },
      ],
    },
  });
  assert.equal(workCenterResponse.statusCode, 201);
  const workCenter = workCenterResponse.body.data;
  assert.equal(workCenter.CostCenters.length, 2);
  assert.equal(workCenter.CostCenterId, workCenter.CostCenters.find((row) => row.CostElement === "machine").Id);
  assert.equal(repo.tables.get("MfgCostCenter").length, 2);

  const duplicateRate = await call("POST", WORK_CENTERS, {
    params: { plantId },
    headers: { "x-user-id": "u-mfg-eng" },
    body: { Code: "WC-COST", NameFa: "تکراری", Kind: "machine", TimeZoneId: "Asia/Tehran", Rates: [{ CostElement: "labor", HourlyRate: 10 }] },
  });
  assert.equal(duplicateRate.statusCode, 409);
  assert.equal(repo.tables.get("MfgCostCenter").length, 2);
  const part = await repo.create("MfgPart", {
    PlantId: plantId,
    PartNo: "FG-COST-01",
    NameFa: "قطعهٔ هزینه",
    PartType: "manufactured",
    BaseUom: "ea",
    StandardUnitCost: 100_000,
    Currency: "IRR",
    IsActive: true,
  });
  const material = await repo.create("MfgMaterial", {
    PlantId: plantId,
    PartId: part.Id,
    ProcurementType: "make",
    LeadTimeDays: 0,
    SafetyStockQty: 0,
    LotSize: 1,
    OrderMultiple: 1,
    StandardUnitCost: 600,
    Currency: "IRR",
    IsActive: true,
  });
  const order = await repo.create("MfgProductionOrder", {
    PlantId: plantId,
    OrderNo: "MO-COST-01",
    PartId: part.Id,
    OrderQuantity: 40,
    Uom: "ea",
    DueAt: "2026-10-30T12:00:00.000Z",
    Status: "in-progress",
    PriorityRule: "EDD",
    ManualRank: null,
    DispatchWeight: 1,
    DemandSource: "manual",
    DemandRef: null,
    AllowOverrun: false,
    CreatedBy: "u-mfg-plan",
  });
  const operation = await repo.create("MfgProductionOrderOperation", {
    PlantId: plantId,
    ProductionOrderId: order.Id,
    SequenceNo: 10,
    OperationCode: "OP-10",
    OperationNameFa: "ماشین‌کاری",
    WorkCenterId: workCenter.Id,
    Status: "completed",
    PlannedQuantity: 40,
    PlannedSetupMinutes: 45,
    PlannedRunMinutesPerUnit: 8,
    ActualSetupMinutes: 50,
    ActualRunMinutes: 300,
    InspectionRequired: false,
  });
  const execution = await repo.create("MfgOperationExecution", {
    PlantId: plantId,
    ProductionOrderOperationId: operation.Id,
    Status: "completed",
    InputQuantity: 40,
    GoodQuantity: 38,
    ReworkQuantity: 0,
    ScrapQuantity: 2,
    StartedAt: "2026-10-05T04:30:00.000Z",
    FinishedAt: "2026-10-05T10:00:00.000Z",
  });
  await repo.create("MfgMaterialRequirement", {
    PlantId: plantId,
    ProductionOrderId: order.Id,
    ProductionOrderOperationId: operation.Id,
    BomItemId: "bomitem-cost-1",
    MaterialId: material.Id,
    RequirementKey: `${order.Id}:${operation.Id}:bomitem-cost-1:v1`,
    RequiredAt: "2026-10-05T04:30:00.000Z",
    GrossQuantity: 10,
    ScrapAllowanceQty: 0,
    NetQuantity: 10,
    Uom: "ea",
    ScheduleVersion: 1,
    AvailableQuantity: 10,
    ReservedQuantity: 0,
    ShortageQuantity: 0,
    Status: "issued",
  });
  await repo.create("MfgMaterialConsumption", {
    PlantId: plantId,
    ProductionOrderOperationId: operation.Id,
    MaterialId: material.Id,
    Quantity: 10,
    Uom: "ea",
    UnitCost: 500,
    Currency: "IRR",
    ConsumptionMethod: "manual",
    ConsumedAt: "2026-10-05T04:30:00.000Z",
  });
  await repo.create("MfgScrapRecord", {
    PlantId: plantId,
    ProductionOrderOperationId: operation.Id,
    ExecutionId: execution.Id,
    Quantity: 2,
    Uom: "ea",
    Disposition: "scrapped",
    CostAmount: 320,
    Currency: "IRR",
    RecordedAt: "2026-10-05T09:15:00.000Z",
  });

  // ۱. خواندن هزینهٔ عملیات بدون ردیف ذخیره‌شده، رول‌آپ لحظه‌ای می‌دهد
  const operationCost = await call("GET", OPERATION_COST, {
    params: { plantId, operationId: operation.Id },
    headers: costView,
  });
  assert.equal(operationCost.statusCode, 200);
  assert.equal(operationCost.body.data.items.length, 5);
  assert.equal(operationCost.body.data.derived, true);
  const materialElement = operationCost.body.data.items.find((row) => row.CostElement === "material");
  assert.equal(materialElement.ActualAmount, 5_000);
  assert.equal(materialElement.StandardAmount, 6_000);
  const machineElement = operationCost.body.data.items.find((row) => row.CostElement === "machine");
  /* نرخ ماشین از مرکز هزینه می‌آید: ۳۵۰ دقیقهٔ واقعی ÷ ۶۰ × ۱۲۰۰ */
  const hours = (minutes) => Math.round((minutes / 60 + Number.EPSILON) * 1000) / 1000;
  assert.equal(machineElement.ActualAmount, round3(hours(350) * 1_200));
  assert.equal(machineElement.StandardAmount, round3(hours(365) * 1_200));
  assert.equal(machineElement.ActualRate, 1_200);
  /* بدون مرکز هزینهٔ نیروی کار، این عنصر صفر می‌ماند — نه نرخ حدسی */
  assert.equal(operationCost.body.data.items.find((row) => row.CostElement === "labor").ActualAmount, 0);

  /* حالا دقیقهٔ واقعی روی خود «اجرا» ثبت می‌شود؛ این مقدار بر فیلدهای عملیات
   * اولویت دارد و مبنای هزینهٔ واقعی ماشین می‌شود. */
  const patchedExecution = await repo.patch("MfgOperationExecution", execution.Id, {
    SetupActualMinutes: 20,
    RunActualMinutes: 40,
  }, "u-mfg-supervisor", execution.RowVersion);
  assert.equal(patchedExecution.ok, true);
  const fromExecutions = await call("GET", OPERATION_COST, {
    params: { plantId, operationId: operation.Id },
    headers: costView,
  });
  const actualMachineAmount = round3(hours(60) * 1_200);
  assert.equal(
    fromExecutions.body.data.items.find((row) => row.CostElement === "machine").ActualAmount,
    actualMachineAmount,
  );
  const scrapCost = fromExecutions.body.data.items.find((row) => row.CostElement === "scrap");
  assert.equal(scrapCost.ActualQuantity, 2);
  assert.equal(scrapCost.ActualAmount, 320);
  assert.equal(scrapCost.StandardAmount, 0);

  // ۲. تطبیق: ردیف‌های هزینه ساخته و روی سفارش Reconciled می‌شود
  const refreshed = await call("GET", ORDER, { params: { plantId, orderId: order.Id }, headers: manager });
  assert.equal(refreshed.statusCode, 200);
  const reconciled = await call("POST", ORDER_COST_RECONCILE, {
    params: { plantId, orderId: order.Id },
    headers: { ...costView, "if-match": String(refreshed.body.data.RowVersion), "idempotency-key": "cost-reconcile-1" },
    body: { CostVersion: 1, ReconcileThrough: "2026-10-06T00:00:00.000Z", ContractRevenue: 100_000 },
  });
  assert.equal(reconciled.statusCode, 200, JSON.stringify(reconciled.body));
  assert.equal(reconciled.body.data.Reconciled, true);
  assert.equal(reconciled.body.data.ActualMaterialCost, 5_000);
  assert.equal(reconciled.body.data.StandardMaterialCost, 6_000);
  assert.equal(reconciled.body.data.PlannedMaterialCost, 6_000);
  assert.equal(reconciled.body.data.StandardScrapCost, 0);
  assert.equal(reconciled.body.data.ActualScrapCost, 320);
  assert.ok(reconciled.body.data.ByElement.scrap);
  assert.equal(
    reconciled.body.data.ActualTotalCost,
    round3(5_000 + actualMachineAmount + 320 + fromExecutions.body.data.items.find((row) => row.CostElement === "overhead").ActualAmount),
  );
  assert.equal(reconciled.body.data.GrossMargin, 100_000 - reconciled.body.data.ActualTotalCost);
  assert.equal(repo.tables.get("MfgOperationCost").length, 5);
  const persistedMachine = repo.tables.get("MfgOperationCost").find((row) => row.CostElement === "machine");
  assert.equal(persistedMachine.ActualAmount, actualMachineAmount);
  assert.equal(persistedMachine.SourceRef, "derived-from-actuals");
  assert.equal(repo.tables.get("MfgOrderCost").length, 1);

  // ۳. بستن نهایی سفارش پس از تطبیق هزینه ممکن می‌شود (پیش‌تر به گیت هزینه می‌خورد)
  const closeable = await call("GET", ORDER, { params: { plantId, orderId: order.Id }, headers: manager });
  const closed = await call("POST", ORDER_CLOSE, {
    params: { plantId, orderId: order.Id },
    headers: { ...manager, "if-match": String(closeable.body.data.RowVersion) },
    body: { CloseReason: "تکمیل و تطبیق هزینه" },
  });
  assert.equal(closed.statusCode, 200, JSON.stringify(closed.body));
  assert.equal(closed.body.data.Status, "closed");
  assert.equal(closed.body.data.ClosedBy, "u-mfg-manager");
});
