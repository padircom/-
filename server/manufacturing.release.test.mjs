import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerManufacturingRoutes } from "./manufacturingApi.js";
import { DEMO_SUBJECTS, evaluate } from "./rbacLogic.js";
import { createRepository, JsonFileDriver } from "./persistence/driver.mjs";

const ROOT = "/api/mfg/plants/:plantId";

function fixture(t, { creatorId = "u-mfg-plan", bomCycle = false, extraRoutingOperation = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arena-mfg-release-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repo = createRepository(new JsonFileDriver(dir));
  let apiRepo = repo;
  const handlers = new Map();
  const app = Object.fromEntries(["get", "post", "patch"].map((method) => [method, (route, handler) => handlers.set(`${method.toUpperCase()} ${route}`, handler)]));
  const bothRoleSubject = {
    id: "u-mfg-both",
    displayName: "کاربر چندنقشی آزمون",
    roles: ["production_manager", "production_planner"],
    projectIds: ["*"],
    plantIds: ["PLANT-DEMO"],
    active: true,
    party: "contractor",
  };
  registerManufacturingRoutes(app, { repo: async () => apiRepo, subjects: [...DEMO_SUBJECTS, bothRoleSubject], evaluate });
  const failSecondOperationInsert = () => {
    apiRepo = Object.create(repo);
    apiRepo.transaction = (work) => repo.transaction(async (tx) => {
      let operationInserts = 0;
      const faultingTx = new Proxy(tx, {
        get(target, property, receiver) {
          if (property === "create") return async (...args) => {
            if (args[0] === "MfgProductionOrderOperation" && ++operationInserts === 2) {
              throw Object.assign(new Error("simulated unique violation after first operation"), { code: "UNIQUE_VIOLATION" });
            }
            return target.create(...args);
          };
          return Reflect.get(target, property, receiver);
        },
      });
      return work(faultingTx);
    });
  };
  let order;
  const invoke = async ({ userId = "u-mfg-manager", rowVersion = 1, body = {} } = {}) => {
    const handler = handlers.get(`POST ${ROOT}/orders/:orderId/release`);
    assert.ok(handler, "release route should be registered");
    const req = {
      params: { plantId: "PLANT-DEMO", orderId: order.Id },
      query: {},
      body,
      headers: { "x-user-id": userId, "if-match": `"${rowVersion}"` },
      requestId: "mfg-release-test",
    };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
    };
    await handler(req, res);
    return res;
  };

  return (async () => {
    const rootPart = await repo.create("MfgPart", {
      PlantId: "PLANT-DEMO", PartNo: "FG-101", NameFa: "محصول نهایی", PartType: "manufactured",
      BaseUom: "ea", Currency: "IRR", IsLotTracked: false, IsActive: true,
    }, "u-mfg-eng");
    const component = bomCycle ? rootPart : await repo.create("MfgPart", {
      PlantId: "PLANT-DEMO", PartNo: "RM-101", NameFa: "مادهٔ اولیه", PartType: "purchased",
      BaseUom: "ea", Currency: "IRR", IsLotTracked: false, IsActive: true,
    }, "u-mfg-eng");
    const bom = await repo.create("MfgBomHeader", {
      PlantId: "PLANT-DEMO", PartId: rootPart.Id, Revision: "A", Status: "released",
      BaseQuantity: 1, BaseUom: "ea", EffectiveFrom: "2026-01-01", EffectiveTo: null,
      IsDefault: true, ReleasedAt: "2026-01-01T00:00:00.000Z", ReleasedBy: "u-mfg-eng",
    }, "u-mfg-eng");
    await repo.create("MfgBomItem", {
      PlantId: "PLANT-DEMO", BomHeaderId: bom.Id, LineNo: 1, ComponentPartId: component.Id,
      QuantityPer: 2, Uom: "ea", ScrapPct: 0, IssueMethod: "manual", IsPhantom: bomCycle,
    }, "u-mfg-eng");

    const routing = await repo.create("MfgRouting", {
      PlantId: "PLANT-DEMO", PartId: rootPart.Id, RoutingCode: "RT-101", Revision: "A", Status: "released",
      BaseQuantity: 1, BaseUom: "ea", EffectiveFrom: "2026-01-01", EffectiveTo: null,
      IsDefault: true, ReleasedAt: "2026-01-01T00:00:00.000Z", ReleasedBy: "u-mfg-eng",
    }, "u-mfg-eng");
    const workCenter = await repo.create("MfgWorkCenter", {
      PlantId: "PLANT-DEMO", Code: "WC-01", NameFa: "ماشین‌کاری", Kind: "machine",
      NominalCapacityMinutesPerDay: 480, EfficiencyPct: 100, TimeZoneId: "Asia/Tehran", Status: "active",
    }, "u-mfg-eng");
    await repo.create("MfgWorkCenterResource", {
      PlantId: "PLANT-DEMO", WorkCenterId: workCenter.Id, ResourceCode: "MC-01", NameFa: "دستگاه یک",
      ResourceKind: "machine", CapacityUnits: 1, AvailabilityPct: 100, IsActive: true,
      EffectiveFrom: null, EffectiveTo: null,
    }, "u-mfg-eng");
    await repo.create("MfgRoutingOperation", {
      PlantId: "PLANT-DEMO", RoutingId: routing.Id, SequenceNo: 10, OperationCode: "OP-10",
      OperationNameFa: "تراشکاری", WorkCenterId: workCenter.Id, SetupMinutes: 5,
      RunMinutesPerUnit: 1.5, QueueMinutes: 20, MoveMinutes: 10, OverlapAllowed: false,
      TransferBatchQty: null, PredecessorSequence: null, InspectionRequired: false,
      CostCenterId: null,
    }, "u-mfg-eng");
    if (extraRoutingOperation) await repo.create("MfgRoutingOperation", {
      PlantId: "PLANT-DEMO", RoutingId: routing.Id, SequenceNo: 20, OperationCode: "OP-20",
      OperationNameFa: "کنترل نهایی", WorkCenterId: workCenter.Id, SetupMinutes: 2,
      RunMinutesPerUnit: 0.5, QueueMinutes: 5, MoveMinutes: 3, OverlapAllowed: false,
      TransferBatchQty: null, PredecessorSequence: 10, InspectionRequired: true,
      CostCenterId: null,
    }, "u-mfg-eng");
    order = await repo.create("MfgProductionOrder", {
      PlantId: "PLANT-DEMO", OrderNo: bomCycle ? "MO-CYCLE" : "MO-RELEASE-01", PartId: rootPart.Id,
      OrderQuantity: 10, Uom: "ea", DueAt: "2026-11-10T12:00:00.000Z", Status: "created",
      PriorityRule: "EDD", DemandSource: "manual", AllowOverrun: false,
    }, creatorId);
    return { repo, order, bom, routing, invoke, failSecondOperationInsert };
  })();
}

test("MFG release: سفارش و عملیات Routing به‌صورت یک تراکنش آزاد می‌شوند", async (t) => {
  const { repo, order, bom, routing, invoke } = await fixture(t);
  const response = await invoke({ body: { BomHeaderId: bom.Id, RoutingId: routing.Id, EffectiveAt: "2026-10-03" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.order.Status, "released");
  assert.equal(response.body.data.order.RowVersion, 2);
  assert.equal(response.body.data.order.BomRevisionSnapshot, "A");
  assert.equal(response.body.data.operations.length, 1);
  assert.equal(response.body.data.operations[0].ProductionOrderId, order.Id);
  assert.equal(response.body.data.operations[0].PlannedCapacityMinutes, 20);

  const savedOperations = await repo.list("MfgProductionOrderOperation", { where: [{ column: "ProductionOrderId", op: "eq", value: order.Id }] });
  const audit = await repo.list("AuditLog", { where: [{ column: "Action", op: "eq", value: "MFG_ORDER_RELEASED" }] });
  assert.equal(savedOperations.length, 1);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].Details.operationCount, 1);
});

test("MFG release: سازندهٔ همان سفارش به علت تفکیک وظایف رد می‌شود", async (t) => {
  const { repo, order, bom, routing, invoke } = await fixture(t, { creatorId: "u-mfg-both" });
  const response = await invoke({ userId: "u-mfg-both", body: { BomHeaderId: bom.Id, RoutingId: routing.Id, EffectiveAt: "2026-10-03" } });
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, "MFG_SOD_CONFLICT");
  assert.equal((await repo.get("MfgProductionOrder", order.Id)).Status, "created");
  assert.equal(await repo.count("MfgProductionOrderOperation", []), 0);
});

test("MFG release: شکست درج Operation میانی، کل سفارش و Audit را rollback می‌کند", async (t) => {
  const { repo, order, bom, routing, invoke, failSecondOperationInsert } = await fixture(t, { extraRoutingOperation: true });
  failSecondOperationInsert();
  const response = await invoke({ body: { BomHeaderId: bom.Id, RoutingId: routing.Id, EffectiveAt: "2026-10-03" } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error.code, "MFG_DUPLICATE");
  assert.equal((await repo.get("MfgProductionOrder", order.Id)).Status, "created");
  assert.equal(await repo.count("MfgProductionOrderOperation", []), 0);
  assert.equal(await repo.count("AuditLog", [{ column: "Action", op: "eq", value: "MFG_ORDER_RELEASED" }]), 0);
});

test("MFG release: چرخهٔ BOM و RowVersion نامعتبر هیچ تغییر نیمه‌کاره‌ای باقی نمی‌گذارند", async (t) => {
  const { repo, order, bom, routing, invoke } = await fixture(t, { bomCycle: true });
  const cycle = await invoke({ body: { BomHeaderId: bom.Id, RoutingId: routing.Id, EffectiveAt: "2026-10-03" } });
  assert.equal(cycle.statusCode, 422);
  assert.equal(cycle.body.error.code, "MFG_BOM_CYCLE");
  assert.equal((await repo.get("MfgProductionOrder", order.Id)).Status, "created");
  assert.equal(await repo.count("MfgProductionOrderOperation", []), 0);

  const stale = await invoke({ rowVersion: 9, body: { BomHeaderId: bom.Id, RoutingId: routing.Id, EffectiveAt: "2026-10-03" } });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.error.code, "MFG_ROW_VERSION_CONFLICT");
  assert.equal(await repo.count("MfgProductionOrderOperation", []), 0);
});
