import test from "node:test";
import assert from "node:assert/strict";
import { MANUFACTURING_IMPLEMENTED_ROUTES, registerManufacturingRoutes } from "./manufacturingApi.js";
import { DEMO_SUBJECTS, evaluate } from "./rbacLogic.js";

/* همان مخزن ساختگی آزمون‌های REST فازهای ۱ تا ۴؛ تراکنش با snapshot/rollback. */
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
    async create(table, data, userId = "system") {
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
  const call = async (method, path, { params = {}, query = {}, body = {}, headers = {}, requestId = "mfg-p5-test" } = {}) => {
    const handler = handlers.get(`${method} ${path}`);
    assert.ok(handler, `route not registered: ${method} ${path}`);
    const req = { params, query, body, headers, requestId };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
      end() { return this; },
    };
    await handler(req, res);
    return res;
  };
  return { repo, call };
}

const ROOT = "/api/mfg/plants/:plantId";
const DEMANDS = `${ROOT}/demand-forecasts`;
const DEMAND = `${ROOT}/demand-forecasts/:demandId`;
const DEMAND_PHASED = `${ROOT}/demand/time-phased`;
const LOT_POLICIES = `${ROOT}/lot-sizing-policies`;
const LOT_POLICY = `${ROOT}/lot-sizing-policies/:policyId`;
const LOT_EVALUATE = `${ROOT}/lot-sizing/evaluate`;
const MPS_RUNS = `${ROOT}/mps/runs`;
const MPS_RUN = `${ROOT}/mps/runs/:runId`;
const MPS_LINES = `${ROOT}/mps/runs/:runId/lines`;
const MPS_FIRM = `${ROOT}/mps/runs/:runId/firm`;
const ATP_CHECKS = `${ROOT}/atp/checks`;
const ATP_SUMMARY = `${ROOT}/atp/summary`;
const SPLITS = `${ROOT}/orders/:orderId/operations/:operationId/splits`;
const SPLIT_LOT = `${ROOT}/operation-splits/:splitLotId`;
const LEAD_TIME = `${ROOT}/orders/:orderId/lead-time-analysis`;

const PLANT = "PLANT-DEMO";
const PLAN = "u-mfg-plan";
const ENG = "u-mfg-eng";
const OPERATOR = "u-mfg-operator";
const H = (userId, extra = {}) => ({ "x-user-id": userId, ...extra });

/** دادهٔ پایهٔ مشترک: یک قطعهٔ تمام‌شده با مادهٔ برنامه‌ریزی و موجودی افتتاحیه. */
async function seedBase(repo) {
  const part = await repo.create("MfgPart", {
    PlantId: PLANT, PartNo: "FG-GEARBOX-01", NameFa: "گیربکس", PartType: "manufactured",
    BaseUom: "ea", StandardUnitCost: 1_000_000, Currency: "IRR", IsLotTracked: false, IsActive: true,
  }, ENG);
  const material = await repo.create("MfgMaterial", {
    PlantId: PLANT, PartId: part.Id, ProcurementType: "make", LeadTimeDays: 7,
    SafetyStockQty: 20, LotSize: 1, OrderMultiple: 1, StandardUnitCost: 1_000_000,
    Currency: "IRR", DefaultWarehouseCode: "WH-MAIN", IsActive: true,
  }, PLAN);
  await repo.create("MfgInventoryLevel", {
    PlantId: PLANT, MaterialId: material.Id, WarehouseCode: "WH-MAIN", LocationCode: "", LotNo: "",
    InventoryKey: `WH-MAIN::`, OnHandQty: 100, ReservedQty: 0, BlockedQty: 0, InTransitQty: 0,
    SafetyStockQty: 20, AsOfAt: "2026-10-01T00:00:00.000Z",
  }, PLAN);
  const order = await repo.create("MfgProductionOrder", {
    PlantId: PLANT, OrderNo: "MO-P5-0001", PartId: part.Id, OrderQuantity: 40, Uom: "ea",
    DueAt: "2026-10-20T00:00:00.000Z", RequestedStartAt: "2026-10-10T00:00:00.000Z",
    Status: "released", PriorityRule: "EDD", DispatchWeight: 1, DemandSource: "sales-order",
    DemandRef: "SO-1", AllowOverrun: false,
  }, PLAN);
  const op1 = await repo.create("MfgProductionOrderOperation", {
    PlantId: PLANT, ProductionOrderId: order.Id, SequenceNo: 10, OperationCode: "OP-10",
    OperationNameFa: "تراشکاری", WorkCenterId: "WC-CNC", PredecessorOperationId: null,
    Status: "pending", PlannedQuantity: 40, PlannedSetupMinutes: 30, PlannedRunMinutesPerUnit: 2,
    PlannedQueueMinutes: 10, PlannedMoveMinutes: 5, PlannedCapacityMinutes: 110,
    OverlapAllowed: false, TransferBatchQty: null, InspectionRequired: false,
  }, PLAN);
  const op2 = await repo.create("MfgProductionOrderOperation", {
    PlantId: PLANT, ProductionOrderId: order.Id, SequenceNo: 20, OperationCode: "OP-20",
    OperationNameFa: "مونتاژ", WorkCenterId: "WC-ASM", PredecessorOperationId: op1.Id,
    Status: "pending", PlannedQuantity: 40, PlannedSetupMinutes: 20, PlannedRunMinutesPerUnit: 1,
    PlannedQueueMinutes: 10, PlannedMoveMinutes: 5, PlannedCapacityMinutes: 60,
    OverlapAllowed: false, TransferBatchQty: null, InspectionRequired: false,
  }, PLAN);
  return { part, material, order, op1, op2 };
}

/* ═══════════════════════ ثبت مسیرها و مجوزها ═══════════════════════ */

test("MFG-P5 REST: هر ۲۱ مسیر فاز ۵ اعلام و ثبت شده‌اند", () => {
  assert.equal(MANUFACTURING_IMPLEMENTED_ROUTES.length, 102);
  for (const declared of [
    `GET ${DEMANDS}`, `POST ${DEMANDS}`, `PATCH ${DEMAND}`, `DELETE ${DEMAND}`, `GET ${DEMAND_PHASED}`,
    `GET ${LOT_POLICIES}`, `POST ${LOT_POLICIES}`, `PATCH ${LOT_POLICY}`, `POST ${LOT_EVALUATE}`,
    `POST ${MPS_RUNS}`, `GET ${MPS_RUNS}`, `GET ${MPS_RUN}`, `GET ${MPS_LINES}`, `POST ${MPS_FIRM}`,
    `POST ${ATP_CHECKS}`, `GET ${ATP_CHECKS}`, `GET ${ATP_SUMMARY}`,
    `GET ${SPLITS}`, `POST ${SPLITS}`, `DELETE ${SPLIT_LOT}`, `GET ${LEAD_TIME}`,
  ]) {
    assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(declared), `${declared} در کاتالوگ نیست`);
  }
});

test("MFG-P5 REST: هویت، مجوز و دامنهٔ کارخانه پیش از هر عمل سنجیده می‌شود", async () => {
  const { call } = makeApi();
  const anonymous = await call("POST", DEMANDS, { params: { plantId: PLANT }, headers: {}, body: { PartId: "x" } });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(anonymous.body.error.code, "MFG_AUTH_REQUIRED");

  /* اپراتور تولید مجوز ثبت تقاضا ندارد. */
  const denied = await call("POST", DEMANDS, { params: { plantId: PLANT }, headers: H(OPERATOR), body: { PartId: "x" } });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body.error.code, "MFG_FORBIDDEN");
  assert.equal(denied.body.error.permission, "mfg.demand.edit");

  /* کارخانهٔ خارج از تخصیص کاربر. */
  const scoped = await call("GET", DEMANDS, { params: { plantId: "PLANT-OTHER" }, headers: H(PLAN) });
  assert.equal(scoped.statusCode, 403);
  assert.equal(scoped.body.error.code, "MFG_PLANT_SCOPE_DENIED");

  const badPlant = await call("GET", DEMANDS, { params: { plantId: "not valid" }, headers: H(PLAN) });
  assert.equal(badPlant.statusCode, 400);
  assert.equal(badPlant.body.error.code, "MFG_BAD_PLANT_ID");
});

/* ═══════════════════════ مدیریت تقاضا و پیش‌بینی ═══════════════════════ */

test("MFG-P5 REST: ثبت، فهرست و ویرایش ردیف تقاضا با If-Match", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);

  const created = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "sales-order", DemandRef: "SO-1001", RequiredAt: "2026-10-06", Quantity: 50, Uom: "ea", CustomerRef: "C-1" },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.data.Status, "draft");
  assert.equal(created.body.data.Uom, "ea");
  assert.equal(created.body.data.Quantity, 50);
  assert.equal(created.body.data.ConsumedQuantity, null);
  assert.equal(created.body.data.RowVersion, 1);

  const forecast = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "forecast", DemandRef: "FC-1", RequiredAt: "2026-10-13", Quantity: 60, ConfidencePct: 80 },
  });
  assert.equal(forecast.statusCode, 201);

  const list = await call("GET", DEMANDS, { params: { plantId: PLANT }, query: { partId: part.Id }, headers: H(PLAN) });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.data.page.total, 2);
  assert.equal(list.body.data.items[0].RequiredAt, "2026-10-06");

  const filtered = await call("GET", DEMANDS, {
    params: { plantId: PLANT }, query: { partId: part.Id, demandType: "forecast" }, headers: H(PLAN),
  });
  assert.equal(filtered.body.data.page.total, 1);

  const patched = await call("PATCH", DEMAND, {
    params: { plantId: PLANT, demandId: created.body.data.Id }, headers: H(PLAN, { "if-match": "1" }),
    body: { Quantity: 70, Status: "confirmed" },
  });
  assert.equal(patched.statusCode, 200);
  assert.equal(patched.body.data.Quantity, 70);
  assert.equal(patched.body.data.Status, "confirmed");
  assert.equal(patched.body.data.RowVersion, 2);
});

test("MFG-P5 REST: اعتبارسنجی ردیف تقاضا و تعارض نسخه", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);

  const unknownPart = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: "nope", DemandType: "forecast", DemandRef: "FC-X", RequiredAt: "2026-10-06", Quantity: 5, ConfidencePct: 50 },
  });
  assert.equal(unknownPart.statusCode, 404);

  const badType = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "wishful", DemandRef: "FC-X", RequiredAt: "2026-10-06", Quantity: 5 },
  });
  assert.equal(badType.statusCode, 400);
  assert.equal(badType.body.error.field, "DemandType");

  const noConfidence = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "forecast", DemandRef: "FC-X", RequiredAt: "2026-10-06", Quantity: 5 },
  });
  assert.equal(noConfidence.statusCode, 422);
  assert.equal(noConfidence.body.error.code, "MFG_DEMAND_CONFIDENCE_REQUIRED");

  const badQty = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "manual", DemandRef: "M-1", RequiredAt: "2026-10-06", Quantity: 0 },
  });
  assert.equal(badQty.statusCode, 400);

  const created = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "manual", DemandRef: "M-1", RequiredAt: "2026-10-06", Quantity: 5 },
  });
  const noIfMatch = await call("PATCH", DEMAND, {
    params: { plantId: PLANT, demandId: created.body.data.Id }, headers: H(PLAN), body: { Quantity: 9 },
  });
  assert.equal(noIfMatch.statusCode, 428);
  assert.equal(noIfMatch.body.error.code, "MFG_IF_MATCH_REQUIRED");

  const stale = await call("PATCH", DEMAND, {
    params: { plantId: PLANT, demandId: created.body.data.Id }, headers: H(PLAN, { "if-match": "5" }), body: { Quantity: 9 },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.error.code, "MFG_ROW_VERSION_CONFLICT");

  const unknownField = await call("PATCH", DEMAND, {
    params: { plantId: PLANT, demandId: created.body.data.Id }, headers: H(PLAN, { "if-match": "1" }),
    body: { Quantity: 9, DemandType: "contract" },
  });
  assert.equal(unknownField.statusCode, 400, "نوع تقاضا پس از ثبت قابل تغییر نیست");
});

test("MFG-P5 REST: حذف فقط برای پیش‌نویسِ مصرف‌نشده مجاز است", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const created = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "manual", DemandRef: "M-2", RequiredAt: "2026-10-06", Quantity: 5 },
  });
  const removed = await call("DELETE", DEMAND, { params: { plantId: PLANT, demandId: created.body.data.Id }, headers: H(PLAN) });
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.body.data.deleted, true);

  const confirmed = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "manual", DemandRef: "M-3", RequiredAt: "2026-10-06", Quantity: 5, Status: "confirmed" },
  });
  const blocked = await call("DELETE", DEMAND, { params: { plantId: PLANT, demandId: confirmed.body.data.Id }, headers: H(PLAN) });
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.body.error.code, "MFG_STATE_CONFLICT");
  assert.equal(await repo.count("MfgDemandForecast", []), 1, "ردیف تأییدشده حذف نشد");
});

test("MFG-P5 REST: نمای زمان‌مند تقاضا هر نوع را در سطل خودش جمع می‌کند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  for (const [type, ref, at, qty] of [
    ["sales-order", "SO-1", "2026-10-06", 50],
    ["forecast", "FC-1", "2026-10-08", 30],
    ["sales-order", "SO-2", "2026-10-14", 20],
  ]) {
    await call("POST", DEMANDS, {
      params: { plantId: PLANT }, headers: H(PLAN),
      body: { PartId: part.Id, DemandType: type, DemandRef: ref, RequiredAt: at, Quantity: qty, ConfidencePct: type === "forecast" ? 70 : undefined },
    });
  }
  const res = await call("GET", DEMAND_PHASED, {
    params: { plantId: PLANT }, query: { partId: part.Id, bucketUnit: "week", horizonStart: "2026-10-05", bucketCount: 4 }, headers: H(PLAN),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.bucketUnit, "week");
  assert.equal(res.body.data.horizonStart, "2026-10-05");
  assert.equal(res.body.data.parts.length, 1);
  const lines = res.body.data.parts[0].lines;
  assert.deepEqual([lines[0].salesOrderQty, lines[0].forecastQty, lines[0].totalQty], [50, 30, 80]);
  assert.deepEqual([lines[1].salesOrderQty, lines[1].totalQty], [20, 20]);
  assert.equal(res.body.data.parts[0].totalQty, 100);

  const outside = await call("GET", DEMAND_PHASED, {
    params: { plantId: PLANT }, query: { partId: part.Id, bucketUnit: "week", horizonStart: "2026-11-02", bucketCount: 2 }, headers: H(PLAN),
  });
  assert.equal(outside.body.data.outsideHorizonQty, 100, "تقاضای بیرون افق گم نمی‌شود");
});

/* ═══════════════════════ سیاست اندازه‌گذاری لات ═══════════════════════ */

test("MFG-P5 REST: ثبت سیاست EOQ همراه با مقدار محاسبه‌شدهٔ EOQ", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const created = await call("POST", LOT_POLICIES, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: {
      PartId: part.Id, RuleCode: "EOQ", OrderingCost: 500000, HoldingCostPerUnitPerYear: 25000,
      AnnualDemandQty: 12000, PeriodDays: 30, OrderMultiple: 1, EffectiveFrom: "2026-10-01",
    },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.data.RuleCode, "EOQ");
  assert.equal(created.body.data.PolicyCode, `LS-${part.PartNo}`);
  assert.equal(created.body.data.eoq.eoq, 693);
  assert.equal(created.body.data.eoq.rawEoq, 692.82);

  const list = await call("GET", LOT_POLICIES, { params: { plantId: PLANT }, query: { partId: part.Id, ruleCode: "EOQ" }, headers: H(PLAN) });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.data.page.total, 1);
  assert.equal(list.body.data.items[0].eoq.eoq, 693);

  const patched = await call("PATCH", LOT_POLICY, {
    params: { plantId: PLANT, policyId: created.body.data.Id }, headers: H(ENG, { "if-match": "1" }),
    body: { RuleCode: "FOQ", FixedLotQty: 250 },
  });
  assert.equal(patched.statusCode, 200);
  assert.equal(patched.body.data.RuleCode, "FOQ");
  assert.equal(patched.body.data.FixedLotQty, 250);
  assert.equal(patched.body.data.RowVersion, 2);
});

test("MFG-P5 REST: سیاست لات نامعتبر با کد دامنه رد می‌شود", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const noFixed = await call("POST", LOT_POLICIES, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, RuleCode: "FOQ", EffectiveFrom: "2026-10-01" },
  });
  assert.equal(noFixed.statusCode, 422);
  assert.equal(noFixed.body.error.code, "MFG_LOT_POLICY_INVALID");

  const badRule = await call("POST", LOT_POLICIES, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, RuleCode: "MAGIC", EffectiveFrom: "2026-10-01" },
  });
  assert.equal(badRule.statusCode, 400);
  assert.equal(badRule.body.error.field, "RuleCode");

  const eoqNoData = await call("POST", LOT_POLICIES, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, RuleCode: "EOQ", EffectiveFrom: "2026-10-01" },
  });
  assert.equal(eoqNoData.statusCode, 422);
  assert.ok(eoqNoData.body.error.message.includes("OrderingCost"));
});

test("MFG-P5 REST: ارزیابی خشک لات هیچ رکوردی نمی‌نویسد", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const res = await call("POST", LOT_EVALUATE, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: {
      PartId: part.Id,
      Policy: { RuleCode: "EOQ", OrderingCost: 500000, HoldingCostPerUnitPerYear: 25000, AnnualDemandQty: 12000 },
      Demand: [
        { RequiredAt: "2026-10-06", Quantity: 50, Type: "sales-order" },
        { RequiredAt: "2026-10-13", Quantity: 60, Type: "sales-order" },
      ],
      OnHandQty: 100, SafetyStockQty: 20, LeadTimeDays: 7,
      BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4,
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.policySource, "inline");
  assert.equal(res.body.data.lotSizingRule, "EOQ");
  assert.equal(res.body.data.eoq.eoq, 693);
  /* سطل اول نیاز خالص ندارد؛ سطل دوم نیاز ۳۰ دارد که تا EOQ بالا می‌رود. */
  assert.deepEqual(res.body.data.lines.map((line) => [line.netRequirementQty, line.plannedOrderReceiptQty]), [
    [0, 0], [30, 693], [0, 0], [0, 0],
  ]);
  assert.equal(res.body.data.totals.plannedOrderReceiptQty, 693);
  assert.equal(await repo.count("MfgMasterScheduleRun", []), 0);
  assert.equal(await repo.count("MfgMasterScheduleLine", []), 0);
});

/* ═══════════════════════ برنامهٔ اصلی تولید ═══════════════════════ */

async function seedDemand(call, part) {
  for (const [type, ref, at, qty] of [
    ["sales-order", "SO-1", "2026-10-06", 50],
    ["sales-order", "SO-2", "2026-10-13", 60],
    ["contract", "CT-1", "2026-10-20", 70],
    ["sales-order", "SO-3", "2026-10-27", 80],
  ]) {
    const res = await call("POST", DEMANDS, {
      params: { plantId: PLANT }, headers: H(PLAN),
      body: { PartId: part.Id, DemandType: type, DemandRef: ref, RequiredAt: at, Quantity: qty },
    });
    assert.equal(res.statusCode, 201);
  }
}

test("MFG-P5 REST: اجرای MPS ردیف زمان‌مند می‌سازد و پیش‌نمایش چیزی نمی‌نویسد", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  await seedDemand(call, part);

  const preview = await call("POST", MPS_RUNS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", PartIds: [part.Id], IncludeOpenOrdersAsReceipts: false, PreviewOnly: true },
  });
  assert.equal(preview.statusCode, 201);
  assert.equal(preview.body.data.previewOnly, true);
  assert.equal(preview.body.data.run, null);
  assert.equal(preview.body.data.parts[0].policySource, "material-planning");
  assert.deepEqual(preview.body.data.lines.map((line) => [line.NetRequirementQty, line.PlannedOrderReceiptQty]), [
    [0, 0], [30, 30], [70, 70], [80, 80],
  ]);
  assert.equal(await repo.count("MfgMasterScheduleRun", []), 0);

  const run = await call("POST", MPS_RUNS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", PartIds: [part.Id], IncludeOpenOrdersAsReceipts: false },
  });
  assert.equal(run.statusCode, 201);
  assert.equal(run.body.data.run.RunNo, 1);
  assert.equal(run.body.data.run.LineCount, 4);
  assert.equal(run.body.data.run.TotalPlannedOrderQty, 180);
  assert.equal(run.body.data.run.ModelVersion, "mfg-planning-v1");
  assert.equal(run.body.data.lines.length, 4);
  assert.equal(await repo.count("MfgMasterScheduleRun", []), 1);
  assert.equal(await repo.count("MfgMasterScheduleLine", []), 4);

  const second = await call("POST", MPS_RUNS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", PartIds: [part.Id], IncludeOpenOrdersAsReceipts: false },
  });
  assert.equal(second.body.data.run.RunNo, 2, "شمارهٔ اجرا افزایشی است");

  const list = await call("GET", MPS_RUNS, { params: { plantId: PLANT }, headers: H(PLAN) });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.data.page.total, 2);
  assert.equal(list.body.data.items[0].RunNo, 2, "تازه‌ترین اجرا اول می‌آید");

  const one = await call("GET", MPS_RUN, { params: { plantId: PLANT, runId: run.body.data.run.Id }, headers: H(PLAN) });
  assert.equal(one.statusCode, 200);
  assert.equal(one.body.data.RunNo, 1);

  const lines = await call("GET", MPS_LINES, {
    params: { plantId: PLANT, runId: run.body.data.run.Id }, query: { onlyPlannedOrders: "true" }, headers: H(PLAN),
  });
  assert.equal(lines.statusCode, 200);
  assert.equal(lines.body.data.items.length, 3);
  assert.equal(lines.body.data.items[0].PartNo, part.PartNo);

  const missing = await call("GET", MPS_RUN, { params: { plantId: PLANT, runId: "nope" }, headers: H(PLAN) });
  assert.equal(missing.statusCode, 404);
});

test("MFG-P5 REST: اجرای MPS رسید سفارش باز را تأمین می‌گیرد و حصارها را رعایت می‌کند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  await seedDemand(call, part);

  const withOrders = await call("POST", MPS_RUNS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", PartIds: [part.Id], IncludeOpenOrdersAsReceipts: true },
  });
  assert.equal(withOrders.statusCode, 201);
  /* سفارش باز ۴۰ عددی در ۲۰۲۶-۱۰-۲۰ (سطل سوم) به عنوان رسید می‌نشیند. */
  assert.equal(withOrders.body.data.lines[2].ScheduledReceiptQty, 40);

  const fenced = await call("POST", MPS_RUNS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: {
      TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", PartIds: [part.Id],
      IncludeOpenOrdersAsReceipts: false, DemandTimeFenceBuckets: 2, FirmPlannedTimeFenceBuckets: 3,
    },
  });
  assert.equal(fenced.statusCode, 201);
  assert.deepEqual(fenced.body.data.lines.map((line) => [line.InsideDemandTimeFence, line.PlannedOrderReceiptQty, line.IsFirm]), [
    [true, 0, false],
    [true, 0, false],
    [false, 100, true],
    [false, 80, false],
  ]);

  const badFence = await call("POST", MPS_RUNS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", DemandTimeFenceBuckets: 3, FirmPlannedTimeFenceBuckets: 1 },
  });
  assert.equal(badFence.statusCode, 422);
  assert.equal(badFence.body.error.code, "MFG_MPS_FENCE_INVALID");
});

test("MFG-P5 REST: مصرف پیش‌بینی با سفارش فروش در همان اجرای MPS ثبت می‌شود", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "forecast", DemandRef: "FC-1", RequiredAt: "2026-10-06", Quantity: 100, ConfidencePct: 70 },
  });
  const sales = await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "sales-order", DemandRef: "SO-1", RequiredAt: "2026-10-07", Quantity: 40 },
  });
  assert.equal(sales.statusCode, 201);

  const run = await call("POST", MPS_RUNS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { TimeBucket: "week", BucketCount: 2, HorizonStart: "2026-10-05", PartIds: [part.Id], IncludeOpenOrdersAsReceipts: false },
  });
  assert.equal(run.statusCode, 201);
  assert.equal(run.body.data.lines[0].ForecastQty, 100);
  assert.equal(run.body.data.lines[0].ConsumedForecastQty, 40);
  assert.equal(run.body.data.lines[0].GrossRequirementQty, 100, "سفارش فروش پیش‌بینی را مصرف می‌کند نه اینکه روی آن جمع شود");

  const forecastRow = (await repo.list("MfgDemandForecast", { where: [{ column: "DemandType", op: "eq", value: "forecast" }] }))[0];
  assert.equal(forecastRow.ConsumedQuantity, 40);
  assert.equal(forecastRow.MpsRunId, run.body.data.run.Id);

  /* ردیف مصرف‌شده دیگر قابل لغو نیست. */
  const cancel = await call("PATCH", DEMAND, {
    params: { plantId: PLANT, demandId: forecastRow.Id }, headers: H(PLAN, { "if-match": String(forecastRow.RowVersion) }),
    body: { Status: "cancelled" },
  });
  assert.equal(cancel.statusCode, 422);
  assert.equal(cancel.body.error.code, "MFG_DEMAND_CONSUMED_LOCK");

  /* مقدار تازه نمی‌تواند از مقدار مصرف‌شده کمتر شود. */
  const shrink = await call("PATCH", DEMAND, {
    params: { plantId: PLANT, demandId: forecastRow.Id }, headers: H(PLAN, { "if-match": String(forecastRow.RowVersion) }),
    body: { Quantity: 10 },
  });
  assert.equal(shrink.statusCode, 422);
  assert.equal(shrink.body.error.code, "MFG_DEMAND_BELOW_CONSUMED");
});

test("MFG-P5 REST: بدون تقاضا اجرای MPS خطای دامنه می‌دهد", async () => {
  const { repo, call } = makeApi();
  await seedBase(repo);
  const res = await call("POST", MPS_RUNS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05" },
  });
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error.code, "MFG_MPS_NO_DEMAND");
});

test("MFG-P5 REST: قطعی‌کردن ردیف MPS با If-Match و گیت حصار", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  await seedDemand(call, part);
  const run = await call("POST", MPS_RUNS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", PartIds: [part.Id], IncludeOpenOrdersAsReceipts: false },
  });
  const runId = run.body.data.run.Id;

  const noMatch = await call("POST", MPS_FIRM, { params: { plantId: PLANT, runId }, headers: H(PLAN), body: {} });
  assert.equal(noMatch.statusCode, 428);

  /* حصار قطعی این اجرا صفر است؛ پس باید صریح بازه داده شود. */
  const noFence = await call("POST", MPS_FIRM, {
    params: { plantId: PLANT, runId }, headers: H(PLAN, { "if-match": "1" }), body: {},
  });
  assert.equal(noFence.statusCode, 422);
  assert.equal(noFence.body.error.code, "MFG_MPS_FENCE_EMPTY");

  const firmed = await call("POST", MPS_FIRM, {
    params: { plantId: PLANT, runId }, headers: H(PLAN, { "if-match": "1" }), body: { ThroughBucketIndex: 1 },
  });
  assert.equal(firmed.statusCode, 200);
  assert.equal(firmed.body.data.firmedLineCount, 1);
  assert.equal(firmed.body.data.lines[0].IsFirm, true);
  assert.equal(firmed.body.data.run.RowVersion, 2);

  const stale = await call("POST", MPS_FIRM, {
    params: { plantId: PLANT, runId }, headers: H(PLAN, { "if-match": "1" }), body: { ThroughBucketIndex: 1 },
  });
  assert.equal(stale.statusCode, 409);

  const nothing = await call("POST", MPS_FIRM, {
    params: { plantId: PLANT, runId }, headers: H(PLAN, { "if-match": "2" }), body: { ThroughBucketIndex: 0 },
  });
  assert.equal(nothing.statusCode, 422);
  assert.equal(nothing.body.error.code, "MFG_MPS_NOTHING_TO_FIRM");
});

/* ═══════════════════════ ATP ═══════════════════════ */

test("MFG-P5 REST: بررسی ATP سه نتیجهٔ available/delayed/unavailable را ثبت می‌کند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  /* تقاضای متعهدشده: ۵۰ در سطل اول. */
  await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "sales-order", DemandRef: "SO-1", RequiredAt: "2026-10-06", Quantity: 50 },
  });

  /* موجودی قابل تعهد آغازین ۸۰ است و ۵۰ تا پایان سطل اول مصرف
   * می‌شود → تا تاریخ درخواست ۳۰ قابل تعهد می‌ماند. */
  const available = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: {
      PartId: part.Id, RequestedQty: 30, RequestedAt: "2026-10-08", Mode: "cumulative",
      BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4, CustomerRef: "C-1",
    },
  });
  assert.equal(available.statusCode, 201);
  assert.equal(available.body.data.check.status, "available");
  assert.equal(available.body.data.check.promisedQty, 30);
  assert.equal(available.body.data.check.sourceBucketStart, "2026-10-05");
  assert.equal(available.body.data.openingAvailableQty, 80, "۱۰۰ موجودی − ۲۰ ذخیرهٔ احتیاطی");
  assert.equal(available.body.data.record.Result, "available");
  assert.equal(available.body.data.record.PromisedAt, "2026-10-08");

  /* ۴۰ تا تاریخ درخواست قابل تعهد نیست؛ سفارش باز ۴۰ عددی در سطل سوم
   * می‌رسد و تعهد به آن سطل منتقل می‌شود. */
  const pushed = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: {
      PartId: part.Id, RequestedQty: 40, RequestedAt: "2026-10-06", Mode: "cumulative",
      BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4,
    },
  });
  assert.equal(pushed.statusCode, 201);
  assert.equal(pushed.body.data.check.status, "delayed");
  assert.equal(pushed.body.data.check.sourceBucketStart, "2026-10-19");
  assert.equal(pushed.body.data.check.delayBuckets, 2);

  const unavailable = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: {
      PartId: part.Id, RequestedQty: 5000, RequestedAt: "2026-10-08", Mode: "cumulative",
      BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4,
    },
  });
  assert.equal(unavailable.statusCode, 201);
  assert.equal(unavailable.body.data.check.status, "unavailable");
  assert.equal(unavailable.body.data.check.promisedAt, null);
  /* بیشترین ATP تجمعی در افق ۷۰ است (۸۰ − ۵۰ + ۴۰). */
  assert.equal(unavailable.body.data.check.promisedQty, 70);
  assert.equal(unavailable.body.data.check.shortageQty, 4930);

  const history = await call("GET", ATP_CHECKS, { params: { plantId: PLANT }, query: { partId: part.Id }, headers: H(PLAN) });
  assert.equal(history.statusCode, 200);
  assert.equal(history.body.data.page.total, 3);
  assert.deepEqual(history.body.data.items.map((item) => item.Result).sort(), ["available", "delayed", "unavailable"]);

  const onlyDelayed = await call("GET", ATP_CHECKS, {
    params: { plantId: PLANT }, query: { partId: part.Id, result: "delayed" }, headers: H(PLAN),
  });
  assert.equal(onlyDelayed.body.data.page.total, 1);
});

test("MFG-P5 REST: خلاصهٔ ATP پیش‌بینی را تعهدشده حساب نمی‌کند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  await call("POST", DEMANDS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, DemandType: "forecast", DemandRef: "FC-1", RequiredAt: "2026-10-06", Quantity: 200, ConfidencePct: 60 },
  });
  const withoutForecast = await call("GET", ATP_SUMMARY, {
    params: { plantId: PLANT }, query: { partId: part.Id, bucketUnit: "week", horizonStart: "2026-10-05", bucketCount: 4 }, headers: H(PLAN),
  });
  assert.equal(withoutForecast.statusCode, 200);
  assert.equal(withoutForecast.body.data.totals.demandQty, 0, "پیش‌بینی تقاضای متعهدشده نیست");
  assert.equal(withoutForecast.body.data.buckets[0].availableToPromise, 80);

  const withForecast = await call("GET", ATP_SUMMARY, {
    params: { plantId: PLANT }, query: { partId: part.Id, includeForecast: "true", bucketUnit: "week", horizonStart: "2026-10-05", bucketCount: 4 }, headers: H(PLAN),
  });
  assert.equal(withForecast.body.data.totals.demandQty, 200);
  assert.equal(withForecast.body.data.buckets[0].availableToPromise, 0);
  assert.equal(withForecast.body.data.totals.firstNegativeBucketStart, "2026-10-05");

  const badMode = await call("GET", ATP_SUMMARY, {
    params: { plantId: PLANT }, query: { partId: part.Id, mode: "guess" }, headers: H(PLAN),
  });
  assert.equal(badMode.statusCode, 400);

  const missingPart = await call("GET", ATP_SUMMARY, { params: { plantId: PLANT }, query: { partId: "nope" }, headers: H(PLAN) });
  assert.equal(missingPart.statusCode, 404);
});

test("MFG-P5 REST: ATP گسسته فقط سطل دارای رسید را قابل تعهد می‌داند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const discrete = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: {
      PartId: part.Id, RequestedQty: 40, RequestedAt: "2026-10-05", Mode: "discrete",
      BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4, Persist: false,
    },
  });
  assert.equal(discrete.statusCode, 201);
  assert.equal(discrete.body.data.mode, "discrete");
  assert.equal(discrete.body.data.record, null, "با Persist=false رکوردی نوشته نمی‌شود");
  assert.equal(discrete.body.data.buckets[0].availableToPromise, 80, "موجودی آغازین در سطل اول قابل تعهد است");
  /* سطل‌های بدون رسید ATP گسسته ندارند. */
  assert.deepEqual(discrete.body.data.buckets.map((bucket) => bucket.availableToPromise), [80, 0, 40, 0]);
  assert.equal(await repo.count("MfgAtpCheck", []), 0);
});

/* ═══════════════════════ تقسیم لات و هم‌پوشانی ═══════════════════════ */

test("MFG-P5 REST: تقسیم لات، عملیات را وصله می‌کند و لات‌ها را می‌سازد", async () => {
  const { repo, call } = makeApi();
  const { order, op1 } = await seedBase(repo);

  const res = await call("POST", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
    body: { SplitLotCount: 2, TransferBatchQty: 10, OverlapAllowed: true },
  });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.data.lots.map((lot) => [lot.SplitNo, lot.Quantity, lot.CumulativeQuantity, lot.IsTransferBatch]), [
    [1, 10, 10, true],
    [2, 30, 40, false],
  ]);
  assert.equal(res.body.data.operation.SplitLotCount, 2);
  assert.equal(res.body.data.operation.OverlapAllowed, true);
  assert.equal(res.body.data.operation.TransferBatchQty, 10);
  assert.equal(await repo.count("MfgOperationSplitLot", []), 2);

  const read = await call("GET", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
  });
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.data.lots.length, 2);
  assert.equal(read.body.data.operation.effectiveTransferBatchQty, 10);
  assert.equal(read.body.data.order.OrderNo, order.OrderNo);

  /* اجرای دوباره با درصد هم‌پوشانی، لات‌های قبلی را جایگزین می‌کند. */
  const byPercent = await call("POST", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
    body: { SplitLotCount: 3, OverlapPct: 75, OverlapAllowed: true },
  });
  assert.equal(byPercent.statusCode, 201);
  assert.equal(byPercent.body.data.lots.length, 3);
  assert.equal(byPercent.body.data.operation.OverlapPct, 75);
  assert.equal(await repo.count("MfgOperationSplitLot", []), 3, "لات‌های قبلی جایگزین شدند نه اضافه");

  const removed = await call("DELETE", SPLIT_LOT, {
    params: { plantId: PLANT, splitLotId: byPercent.body.data.lots[2].Id }, headers: H(PLAN),
  });
  assert.equal(removed.statusCode, 200);
  assert.equal(await repo.count("MfgOperationSplitLot", []), 2);
});

test("MFG-P5 REST: گیت‌های تقسیم لات — وضعیت عملیات، ورودی هم‌پوشانی و اندازهٔ لات انتقال", async () => {
  const { repo, call } = makeApi();
  const { order, op1, op2 } = await seedBase(repo);

  const noOverlapInput = await call("POST", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
    body: { SplitLotCount: 2, OverlapAllowed: true },
  });
  assert.equal(noOverlapInput.statusCode, 422);
  assert.equal(noOverlapInput.body.error.code, "MFG_SPLIT_OVERLAP_INPUT_MISSING");

  const tooLarge = await call("POST", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
    body: { SplitLotCount: 2, TransferBatchQty: 40, OverlapAllowed: true },
  });
  assert.equal(tooLarge.statusCode, 422);
  assert.equal(tooLarge.body.error.code, "MFG_SPLIT_TRANSFER_BATCH_TOO_LARGE");

  const started = await repo.patch("MfgProductionOrderOperation", op2.Id, { Status: "running" }, PLAN, op2.RowVersion);
  assert.equal(started.ok, true);
  const blocked = await call("POST", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op2.Id }, headers: H(PLAN),
    body: { SplitLotCount: 2 },
  });
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.body.error.code, "MFG_STATE_CONFLICT");

  /* حداقل اندازهٔ لات تعداد لات‌ها را کم می‌کند و این تعدیل گزارش می‌شود. */
  const minLot = await call("POST", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
    body: { SplitLotCount: 5, MinLotQty: 15 },
  });
  assert.equal(minLot.statusCode, 201);
  assert.equal(minLot.body.data.plan.effectiveSplitCount, 2);
  assert.ok(minLot.body.data.plan.notes.some((note) => note.includes("کاهش داد")));
});

test("MFG-P5 REST: لات شروع‌شده قابل حذف نیست", async () => {
  const { repo, call } = makeApi();
  const { order, op1 } = await seedBase(repo);
  const created = await call("POST", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
    body: { SplitLotCount: 2 },
  });
  const lotId = created.body.data.lots[0].Id;
  const lot = await repo.get("MfgOperationSplitLot", lotId);
  await repo.patch("MfgOperationSplitLot", lotId, { Status: "in-progress" }, PLAN, lot.RowVersion);

  const res = await call("DELETE", SPLIT_LOT, { params: { plantId: PLANT, splitLotId: lotId }, headers: H(PLAN) });
  assert.equal(res.statusCode, 409);
  assert.equal(await repo.count("MfgOperationSplitLot", []), 2);
});

test("MFG-P5 REST: تحلیل LeadTime صرفه‌جویی هم‌پوشانی را گزارش می‌کند", async () => {
  const { repo, call } = makeApi();
  const { order, op1 } = await seedBase(repo);
  await call("POST", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
    body: { SplitLotCount: 2, TransferBatchQty: 24, OverlapAllowed: true },
  });

  const res = await call("GET", LEAD_TIME, { params: { plantId: PLANT, orderId: order.Id }, headers: H(PLAN) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.operationCount, 2);
  /* OP-10: 30 + 40×2 = 110 دقیقه · OP-20: 20 + 40×1 = 60 دقیقه */
  assert.equal(res.body.data.analysis.baselineCapacityMinutes, 170);
  /* لات انتقال ۲۴ عدد → آماده‌شدن در دقیقهٔ 30 + 24×2 = 78؛ دنبالهٔ هم‌پوشان 32 دقیقه */
  assert.equal(res.body.data.analysis.operations[0].transferReadyMinutes, 78);
  assert.equal(res.body.data.analysis.operations[0].overlapTailMinutes, 32);
  assert.equal(res.body.data.analysis.overlappedCapacityMinutes, 138);
  assert.equal(res.body.data.analysis.savedMinutes, 32);
  assert.equal(res.body.data.analysis.operations[0].splitLotCount, 2);
  assert.equal(res.body.data.analysis.scheduledSpanMinutes, null, "بدون اجرای زمان‌بندی بازه‌ای اندازه‌گیری نمی‌شود");

  const missingOrder = await call("GET", LEAD_TIME, { params: { plantId: PLANT, orderId: "nope" }, headers: H(PLAN) });
  assert.equal(missingOrder.statusCode, 404);
});

test("MFG-P5 REST: عملیات کارخانهٔ دیگر از مسیر تقسیم قابل دسترسی نیست", async () => {
  const { repo, call } = makeApi();
  const { order, op1 } = await seedBase(repo);
  await call("POST", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
    body: { SplitLotCount: 2 },
  });
  /* کارخانهٔ دیگر اصلاً در دامنهٔ کاربر نیست → ۴۰۳ نه ۴۰۴. */
  const otherPlant = await call("GET", SPLITS, {
    params: { plantId: "PLANT-OTHER", orderId: order.Id, operationId: op1.Id }, headers: H(PLAN),
  });
  assert.equal(otherPlant.statusCode, 403);

  /* سفارش همان کارخانه ولی عملیات متعلق به سفارش دیگر → ۴۰۴ بدون افشای وجود. */
  const stranger = await call("GET", SPLITS, {
    params: { plantId: PLANT, orderId: order.Id, operationId: "op-unknown" }, headers: H(PLAN),
  });
  assert.equal(stranger.statusCode, 404);
});
