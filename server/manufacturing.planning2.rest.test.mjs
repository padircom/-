/**
 * آزمون REST فاز ۵ بخش ۱۱ — نسخهٔ تولید، سفارش برنامه‌ریزی‌شده، CRP،
 * Lead Time Offset، Pegging، تأیید MPS و انطباق ISA-95/MESA-11.
 *
 * از همان مخزن و Express ساختگی آزمون‌های قبلی استفاده می‌کند تا رفتار
 * تراکنش/rollback هم آزموده شود.
 */
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
  const call = async (method, path, { params = {}, query = {}, body = {}, headers = {}, requestId = "mfg-p5b-test" } = {}) => {
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
const VERSIONS = `${ROOT}/production-versions`;
const VERSION = `${ROOT}/production-versions/:versionId`;
const PART_VERSION = `${ROOT}/parts/:partId/production-version`;
const PLANNED = `${ROOT}/planned-orders`;
const PLANNED_ONE = `${ROOT}/planned-orders/:plannedOrderId`;
const PLANNED_APPROVE = `${ROOT}/planned-orders/:plannedOrderId/approve`;
const PLANNED_REJECT = `${ROOT}/planned-orders/:plannedOrderId/reject`;
const PLANNED_CONVERT = `${ROOT}/planned-orders/:plannedOrderId/convert`;
const MRP_CALC = `${ROOT}/mrp/calculate`;
const CRP_CALC = `${ROOT}/crp/calculate`;
const CRP_SUMMARY = `${ROOT}/crp/summary`;
const LEAD_TIME = `${ROOT}/mrp/lead-time-offset`;
const PEGGING = `${ROOT}/mrp/pegging`;
const MPS_APPROVE = `${ROOT}/mps/runs/:runId/approve`;
const CONFORMANCE = `${ROOT}/conformance/isa95`;

const PLANT = "PLANT-DEMO";
const PLAN = "u-mfg-plan";
const ENG = "u-mfg-eng";
const MGR = "u-mfg-manager";
const SUP = "u-mfg-supervisor";
const H = (user) => ({ "x-user-id": user });
const MATCH = (n) => ({ "if-match": String(n) });

/** دادهٔ پایه: قطعه، BOM و Routing آزادشده، ماده با LeadTime و یک مرکز کاری. */
async function seedBase(repo) {
  const part = await repo.create("MfgPart", {
    PlantId: PLANT, PartNo: "FG-GEARBOX-01", NameFa: "گیربکس", PartType: "manufactured", BaseUom: "ea", IsActive: true,
  }, ENG);
  const sub = await repo.create("MfgPart", {
    PlantId: PLANT, PartNo: "SA-HOUSING-01", NameFa: "پوسته", PartType: "manufactured", BaseUom: "ea", IsActive: true,
  }, ENG);
  const raw = await repo.create("MfgPart", {
    PlantId: PLANT, PartNo: "RM-PLATE", NameFa: "ورق فولادی", PartType: "purchased", BaseUom: "kg", IsActive: true,
  }, ENG);
  const bomFg = await repo.create("MfgBomHeader", { PlantId: PLANT, PartId: part.Id, Revision: "A", Status: "released", BaseQuantity: 1, IsDefault: true }, ENG);
  const bomSub = await repo.create("MfgBomHeader", { PlantId: PLANT, PartId: sub.Id, Revision: "A", Status: "released", BaseQuantity: 1, IsDefault: true }, ENG);
  await repo.create("MfgBomItem", { PlantId: PLANT, BomHeaderId: bomFg.Id, LineNo: 1, ComponentPartId: sub.Id, QuantityPer: 1, Uom: "ea" }, ENG);
  await repo.create("MfgBomItem", { PlantId: PLANT, BomHeaderId: bomSub.Id, LineNo: 1, ComponentPartId: raw.Id, QuantityPer: 5, Uom: "kg" }, ENG);
  const routing = await repo.create("MfgRouting", { PlantId: PLANT, PartId: part.Id, Revision: "A", Status: "released", IsDefault: true }, ENG);
  const wc = await repo.create("MfgWorkCenter", { PlantId: PLANT, Code: "WC-ASM", Status: "active", TimeZoneId: "UTC" }, ENG);
  await repo.create("MfgWorkCenterResource", { PlantId: PLANT, WorkCenterId: wc.Id, ResourceCode: "RES-1", IsActive: true, CapacityUnits: 1 }, ENG);
  await repo.create("MfgRoutingOperation", {
    PlantId: PLANT, RoutingId: routing.Id, SequenceNo: 10, OperationCode: "OP-10", WorkCenterId: wc.Id,
    SetupMinutes: 30, RunMinutesPerUnit: 12, QueueMinutes: 0, MoveMinutes: 0, CapacityMinutes: 0,
    OverlapAllowed: true, TransferBatchQty: null, OverlapPct: 50, SplitLotCount: null,
  }, ENG);
  await repo.create("MfgMaterial", { PlantId: PLANT, PartId: part.Id, ProcurementType: "make", LeadTimeDays: 7, SafetyStockQty: 0, IsActive: true }, PLAN);
  await repo.create("MfgMaterial", { PlantId: PLANT, PartId: sub.Id, ProcurementType: "make", LeadTimeDays: 12, SafetyStockQty: 0, IsActive: true }, PLAN);
  await repo.create("MfgMaterial", { PlantId: PLANT, PartId: raw.Id, ProcurementType: "buy", LeadTimeDays: 5, SafetyStockQty: 0, IsActive: true }, PLAN);
  return { part, sub, raw, routing, wc };
}

/* ═══════════════════════ ثبت مسیرها و مجوزها ═══════════════════════ */

test("۱۱: هر ۱۶ مسیر تازهٔ بخش ۱۱ اعلام و ثبت شده‌اند", () => {
  assert.equal(MANUFACTURING_IMPLEMENTED_ROUTES.length, 102);
  for (const declared of [
    `GET ${VERSIONS}`, `POST ${VERSIONS}`, `PATCH ${VERSION}`, `GET ${PART_VERSION}`,
    `GET ${PLANNED}`, `GET ${PLANNED_ONE}`, `PATCH ${PLANNED_ONE}`,
    `POST ${PLANNED_APPROVE}`, `POST ${PLANNED_REJECT}`, `POST ${PLANNED_CONVERT}`,
    `POST ${CRP_CALC}`, `GET ${CRP_SUMMARY}`, `GET ${LEAD_TIME}`, `GET ${PEGGING}`,
    `POST ${MPS_APPROVE}`, `GET ${CONFORMANCE}`,
  ]) {
    assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(declared), `اعلام نشده: ${declared}`);
  }
});

test("۱۱: بدون احراز هویت ۴۰۱ و بدون مجوز ۴۰۳ است", async () => {
  const { call } = makeApi();
  const anon = await call("GET", PLANNED, { params: { plantId: PLANT } });
  assert.equal(anon.statusCode, 401);
  assert.equal(anon.body.error.code, "MFG_AUTH_REQUIRED");

  /* سرپرست کارگاه مجوز سفارش برنامه‌ریزی‌شده ندارد. */
  const forbidden = await call("GET", PLANNED, { params: { plantId: PLANT }, headers: H(SUP) });
  assert.equal(forbidden.statusCode, 403);

  /* و تبدیل سفارش برنامه‌ریزی‌شده برای مهندس ساخت ممنوع است (تفکیک وظایف). */
  const engConvert = await call("POST", PLANNED_CONVERT, {
    params: { plantId: PLANT, plannedOrderId: "x" }, headers: H(ENG), body: {},
  });
  assert.equal(engConvert.statusCode, 403);
});

test("۱۱: کارخانهٔ بیگانه با ۴۰۳ رد می‌شود", async () => {
  const { call } = makeApi();
  const res = await call("GET", PLANNED, { params: { plantId: "PLANT-OTHER" }, headers: H(PLAN) });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "MFG_PLANT_SCOPE_DENIED");
});

/* ═══════════════════════ ۱۱.۹ نسخهٔ تولید ═══════════════════════ */

test("۱۱.۹: نسخهٔ تولید فقط با BOM و Routing آزادشده ساخته می‌شود", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);

  const badBom = await call("POST", VERSIONS, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, VersionCode: "V1", BomRevision: "ZZ", RoutingRevision: "A" },
  });
  assert.equal(badBom.statusCode, 422);
  assert.equal(badBom.body.error.code, "MFG_VERSION_BOM_NOT_RELEASED");

  const ok = await call("POST", VERSIONS, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, VersionCode: "V1-LINE-A", BomRevision: "A", RoutingRevision: "A", Priority: 1, IsDefault: true },
  });
  assert.equal(ok.statusCode, 201);
  assert.equal(ok.body.data.VersionCode, "V1-LINE-A");
  assert.equal(ok.body.data.IsDefault, true);
});

test("۱۱.۹: VersionCode تکراری برای یک قطعه رد می‌شود", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const body = { PartId: part.Id, VersionCode: "V1", BomRevision: "A", RoutingRevision: "A" };
  assert.equal((await call("POST", VERSIONS, { params: { plantId: PLANT }, headers: H(ENG), body })).statusCode, 201);
  const dup = await call("POST", VERSIONS, { params: { plantId: PLANT }, headers: H(ENG), body });
  assert.equal(dup.statusCode, 409);
  assert.equal(dup.body.error.code, "MFG_DUPLICATE");
});

test("۱۱.۹: پیش‌فرض یکتاست — نسخهٔ پیش‌فرض تازه بقیه را از حالت پیش‌فرض خارج می‌کند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const first = await call("POST", VERSIONS, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, VersionCode: "V1", BomRevision: "A", RoutingRevision: "A", IsDefault: true },
  });
  await call("POST", VERSIONS, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, VersionCode: "V2", BomRevision: "A", RoutingRevision: "A", IsDefault: true },
  });
  const after = await repo.get("MfgProductionVersion", first.body.data.Id);
  assert.equal(after.IsDefault, false, "نسخهٔ پیش‌فرض قبلی باید از حالت پیش‌فرض خارج شود");
  const list = await call("GET", VERSIONS, { params: { plantId: PLANT }, query: { partId: part.Id }, headers: H(PLAN) });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.data.items.filter((row) => row.IsDefault === true).length, 1);
});

test("۱۱.۹: resolve نسخهٔ فعال را بر اساس خط و بازهٔ اثر انتخاب می‌کند", async () => {
  const { repo, call } = makeApi();
  const { part, wc } = await seedBase(repo);
  const wc2 = await repo.create("MfgWorkCenter", { PlantId: PLANT, Code: "WC-CNC", Status: "active", TimeZoneId: "UTC" }, ENG);
  await call("POST", VERSIONS, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, VersionCode: "V1-A", BomRevision: "A", RoutingRevision: "A", WorkCenterId: wc.Id, Priority: 1, IsDefault: true },
  });
  await call("POST", VERSIONS, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, VersionCode: "V2-B", BomRevision: "A", RoutingRevision: "A", WorkCenterId: wc2.Id, Priority: 2 },
  });

  const byLine = await call("GET", PART_VERSION, {
    params: { plantId: PLANT, partId: part.Id }, query: { workCenterId: wc2.Id }, headers: H(PLAN),
  });
  assert.equal(byLine.statusCode, 200);
  assert.equal(byLine.body.data.selection.versionCode, "V2-B", "خط CNC نسخهٔ خودش را می‌گیرد");
  assert.equal(byLine.body.data.candidates, 2);

  const fallback = await call("GET", PART_VERSION, { params: { plantId: PLANT, partId: part.Id }, headers: H(PLAN) });
  assert.equal(fallback.body.data.selection.versionCode, "V1-A", "بدون فیلتر خط، نسخهٔ پیش‌فرض");
});

test("۱۱.۹: ویرایش نسخه با If-Match و بدون انتقال به قطعهٔ دیگر", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const created = await call("POST", VERSIONS, {
    params: { plantId: PLANT }, headers: H(ENG),
    body: { PartId: part.Id, VersionCode: "V1", BomRevision: "A", RoutingRevision: "A", Priority: 5 },
  });
  const versionId = created.body.data.Id;

  const noMatch = await call("PATCH", VERSION, { params: { plantId: PLANT, versionId }, headers: H(ENG), body: { Priority: 2 } });
  assert.equal(noMatch.statusCode, 428);
  assert.equal(noMatch.body.error.code, "MFG_IF_MATCH_REQUIRED");

  const movePart = await call("PATCH", VERSION, {
    params: { plantId: PLANT, versionId }, headers: { ...H(ENG), ...MATCH(1) }, body: { PartId: "other" },
  });
  assert.equal(movePart.statusCode, 400);

  const ok = await call("PATCH", VERSION, {
    params: { plantId: PLANT, versionId }, headers: { ...H(ENG), ...MATCH(1) }, body: { Priority: 2, NoteFa: "اولویت بالاتر" },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.data.Priority, 2);
  assert.equal(ok.body.data.RowVersion, 2);
});

/* ═══════════════════ ۱۱.۳ سفارش برنامه‌ریزی‌شده ═══════════════════ */

/** یک سفارش برنامه‌ریزی‌شدهٔ نمونه مستقیم در مخزن می‌سازد. */
async function seedPlannedOrder(repo, { status = "proposed", part } = {}) {
  return repo.create("MfgPlannedOrder", {
    PlantId: PLANT, PlannedOrderNo: `PO-${Math.floor(Math.random() * 9000 + 1000)}`,
    PartId: part.Id, Source: "mrp", MrpRunNo: 1, Quantity: 34, OriginalQuantity: 34, Uom: "ea",
    LowLevelCode: 0, CumulativeLeadTimeDays: 7,
    PlannedReleaseAt: "2026-10-05T00:00:00.000Z", PlannedDueAt: "2026-10-12T00:00:00.000Z",
    BucketIndex: 1, LotSizingRule: "EOQ", Status: status,
  }, PLAN);
}

test("۱۱.۳: تبدیل سفارش تأییدنشده رد می‌شود", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const planned = await seedPlannedOrder(repo, { part });

  const res = await call("POST", PLANNED_CONVERT, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) }, body: {},
  });
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error.code, "MFG_PLANNED_ORDER_NOT_APPROVED");
  /* هیچ سفارش تولیدی ساخته نشده باشد. */
  assert.equal(await repo.count("MfgProductionOrder", [{ column: "PlantId", op: "eq", value: PLANT }]), 0);
});

test("۱۱.۳: گردش کامل پیشنهاد ← تأیید ← تبدیل به سفارش تولید", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const planned = await seedPlannedOrder(repo, { part });

  const approve = await call("POST", PLANNED_APPROVE, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) },
    body: { NoteFa: "مقدار لات تأیید شد" },
  });
  assert.equal(approve.statusCode, 200);
  assert.equal(approve.body.data.Status, "approved");
  assert.equal(approve.body.data.ReviewedBy, PLAN);

  const convert = await call("POST", PLANNED_CONVERT, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(2) },
    body: { OrderNo: "MO-FROM-MRP-1" },
  });
  assert.equal(convert.statusCode, 201);
  assert.equal(convert.body.data.productionOrder.OrderNo, "MO-FROM-MRP-1");
  assert.equal(convert.body.data.productionOrder.Status, "created", "آزادسازی همچنان گیت جداست");
  assert.equal(convert.body.data.productionOrder.DemandSource, "mrp", "منشأ MRP حفظ می‌شود");
  assert.equal(convert.body.data.productionOrder.DemandRef, planned.PlannedOrderNo);
  assert.equal(convert.body.data.operationCount, 1, "snapshot عملیات از Routing ساخته شد");
  assert.equal(convert.body.data.requiresRelease, true);
  assert.equal(convert.body.data.plannedOrder.Status, "converted");
  assert.equal(convert.body.data.plannedOrder.ConvertedProductionOrderId, convert.body.data.productionOrder.Id);

  /* تبدیل دوباره باید رد شود. */
  const again = await call("POST", PLANNED_CONVERT, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(3) }, body: {},
  });
  assert.equal(again.statusCode, 422);
  assert.equal(again.body.error.code, "MFG_PLANNED_ORDER_CONVERTED");
});

test("۱۱.۳: ویرایش پیش از تبدیل مجاز و پس از آن ممنوع است", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const planned = await seedPlannedOrder(repo, { part });

  const edit = await call("PATCH", PLANNED_ONE, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) },
    body: { Quantity: 40, NoteFa: "تطبیق با ظرفیت واقعی" },
  });
  assert.equal(edit.statusCode, 200);
  assert.equal(edit.body.data.Quantity, 40);
  assert.equal(edit.body.data.OriginalQuantity, 34, "مقدار پیشنهادی موتور دست‌نخورده می‌ماند");

  await call("POST", PLANNED_APPROVE, { params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(2) }, body: {} });
  await call("POST", PLANNED_CONVERT, { params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(3) }, body: {} });

  const after = await call("PATCH", PLANNED_ONE, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(4) }, body: { Quantity: 99 },
  });
  assert.equal(after.statusCode, 422);
  assert.equal(after.body.error.code, "MFG_PLANNED_ORDER_CONVERTED");
});

test("۱۱.۳: ویرایش، تأیید قبلی را باطل می‌کند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const planned = await seedPlannedOrder(repo, { part });
  await call("POST", PLANNED_APPROVE, { params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) }, body: {} });

  const edit = await call("PATCH", PLANNED_ONE, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(2) }, body: { Quantity: 55 },
  });
  assert.equal(edit.statusCode, 200);
  assert.equal(edit.body.data.Status, "proposed", "تأیید روی مقدار قبلی داده شده بود");
});

test("۱۱.۳: آزادسازی نباید پس از موعد باشد", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const planned = await seedPlannedOrder(repo, { part });
  const res = await call("PATCH", PLANNED_ONE, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) },
    body: { PlannedReleaseAt: "2026-11-01T00:00:00.000Z" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.field, "PlannedReleaseAt");
});

test("۱۱.۳: رد کردن بدون دلیل رد می‌شود", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const planned = await seedPlannedOrder(repo, { part });

  const noReason = await call("POST", PLANNED_REJECT, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) }, body: {},
  });
  assert.equal(noReason.statusCode, 400);
  assert.equal(noReason.body.error.field, "RejectReasonFa");

  const ok = await call("POST", PLANNED_REJECT, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) },
    body: { RejectReasonFa: "موجودی انبار کفاف می‌دهد" },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.data.Status, "rejected");
});

test("۱۱.۳: تراکنش تبدیل اتمیک است — شکست، سفارش تولید را هم برمی‌گرداند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const planned = await seedPlannedOrder(repo, { part });
  await call("POST", PLANNED_APPROVE, { params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) }, body: {} });

  /* شمارهٔ سفارش تکراری → تبدیل باید شکست بخورد و هیچ ردیفی نماند. */
  await repo.create("MfgProductionOrder", {
    PlantId: PLANT, OrderNo: "MO-TAKEN", PartId: part.Id, OrderQuantity: 1, Uom: "ea",
    DueAt: "2026-10-12T00:00:00.000Z", Status: "created", PriorityRule: "EDD", DemandSource: "manual",
  }, PLAN);

  const res = await call("POST", PLANNED_CONVERT, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(2) }, body: { OrderNo: "MO-TAKEN" },
  });
  assert.equal(res.statusCode, 409);
  assert.equal(await repo.count("MfgProductionOrder", [{ column: "PlantId", op: "eq", value: PLANT }]), 1, "فقط سفارش از پیش موجود");
  assert.equal(await repo.count("MfgProductionOrderOperation", [{ column: "PlantId", op: "eq", value: PLANT }]), 0);
  const unchanged = await repo.get("MfgPlannedOrder", planned.Id);
  assert.equal(unchanged.Status, "approved", "وضعیت سفارش برنامه‌ریزی‌شده دست‌نخورده ماند");
});

test("۱۱.۳: فهرست و فیلتر سفارش‌های برنامه‌ریزی‌شده", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  await seedPlannedOrder(repo, { part, status: "proposed" });
  await seedPlannedOrder(repo, { part, status: "approved" });

  const all = await call("GET", PLANNED, { params: { plantId: PLANT }, headers: H(PLAN) });
  assert.equal(all.statusCode, 200);
  assert.equal(all.body.data.page.total, 2);

  const approved = await call("GET", PLANNED, { params: { plantId: PLANT }, query: { status: "approved" }, headers: H(PLAN) });
  assert.equal(approved.body.data.page.total, 1);

  const badStatus = await call("GET", PLANNED, { params: { plantId: PLANT }, query: { status: "nope" }, headers: H(PLAN) });
  assert.equal(badStatus.statusCode, 400);
});

/* ═══════════════════ ۱۱.۱ تأیید دستی MPS ═══════════════════ */

test("۱۱.۱: MPS پیش‌نمایش قابل تأیید نیست و اجرای ثبت‌شده تأیید می‌شود", async () => {
  const { repo, call } = makeApi();
  const preview = await repo.create("MfgMasterScheduleRun", {
    PlantId: PLANT, RunNo: 1, TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", HorizonEnd: "2026-11-02",
    DemandTimeFenceBuckets: 1, FirmPlannedTimeFenceBuckets: 2, ConsumeForecast: true, PreviewOnly: true,
    PartCount: 1, LineCount: 4, TotalPlannedOrderQty: 34,
  }, PLAN);
  const real = await repo.create("MfgMasterScheduleRun", {
    PlantId: PLANT, RunNo: 2, TimeBucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", HorizonEnd: "2026-11-02",
    DemandTimeFenceBuckets: 1, FirmPlannedTimeFenceBuckets: 2, ConsumeForecast: true, PreviewOnly: false,
    PartCount: 1, LineCount: 4, TotalPlannedOrderQty: 34,
  }, PLAN);

  const bad = await call("POST", MPS_APPROVE, {
    params: { plantId: PLANT, runId: preview.Id }, headers: { ...H(MGR), ...MATCH(1) }, body: {},
  });
  assert.equal(bad.statusCode, 422);
  assert.equal(bad.body.error.code, "MFG_MPS_PREVIEW_NOT_APPROVABLE");

  const ok = await call("POST", MPS_APPROVE, {
    params: { plantId: PLANT, runId: real.Id }, headers: { ...H(MGR), ...MATCH(1) }, body: { NoteFa: "تأیید مدیر تولید" },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.data.Status, "approved");
  assert.equal(ok.body.data.ApprovedBy, MGR);

  /* برنامه‌ریز مجوز تأیید MPS را دارد اما سرپرست کارگاه نه. */
  const forbidden = await call("POST", MPS_APPROVE, {
    params: { plantId: PLANT, runId: real.Id }, headers: { ...H(SUP), ...MATCH(2) }, body: {},
  });
  assert.equal(forbidden.statusCode, 403);
});

/* ═══════════════════ ۱۱.۵ Lead Time Offset ═══════════════════ */

test("۱۱.۵: گزارش Lead Time تجمیعی از پایین‌ترین سطح تا محصول نهایی", async () => {
  const { repo, call } = makeApi();
  const { part, sub, raw } = await seedBase(repo);

  const res = await call("GET", LEAD_TIME, { params: { plantId: PLANT }, headers: H(PLAN) });
  assert.equal(res.statusCode, 200);
  /* FG=7، SA=12، RM=5 → تجمیعی RM=5، SA=17، FG=24. */
  assert.equal(res.body.data.finishedGoodsLeadTimeDays, 24);
  assert.equal(res.body.data.maxLowLevelCode, 2);
  const by = Object.fromEntries(res.body.data.parts.map((row) => [row.partId, row]));
  assert.equal(by[raw.Id].lowLevelCode, 2);
  assert.equal(by[raw.Id].cumulativeLeadTimeDays, 5);
  assert.equal(by[sub.Id].cumulativeLeadTimeDays, 17);
  assert.equal(by[part.Id].cumulativeLeadTimeDays, 24);
  assert.equal(by[raw.Id].availabilityOffsetDays, 19);
  assert.equal(res.body.data.levelOffsets.length, 3);
});

test("۱۱.۵: کارخانهٔ بدون BOM آزادشده گزارش خالی می‌دهد نه خطا", async () => {
  const { call } = makeApi();
  const res = await call("GET", LEAD_TIME, { params: { plantId: PLANT }, headers: H(PLAN) });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.parts, []);
  assert.equal(res.body.data.finishedGoodsLeadTimeDays, 0);
});

/* ═══════════════════════ ۱۱.۶ Pegging ═══════════════════════ */

test("۱۱.۶: pegging تک‌سطحی و چندسطحی از نیازهای مواد واقعی", async () => {
  const { repo, call } = makeApi();
  const { part, raw } = await seedBase(repo);
  const order = await repo.create("MfgProductionOrder", {
    PlantId: PLANT, OrderNo: "MO-PEG-1", PartId: part.Id, OrderQuantity: 50, Uom: "ea",
    DueAt: "2026-10-20T00:00:00.000Z", Status: "released", PriorityRule: "EDD", DemandSource: "sales-order",
  }, PLAN);
  const material = await repo.findOne("MfgMaterial", [{ column: "PartId", op: "eq", value: raw.Id }]);
  const requirement = await repo.create("MfgMaterialRequirement", {
    PlantId: PLANT, ProductionOrderId: order.Id, MaterialId: material.Id,
    RequiredAt: "2026-10-12T00:00:00.000Z", GrossQuantity: 250, ScrapAllowanceQty: 0, NetQuantity: 250, Uom: "kg",
    ScheduleVersion: 1, RequirementKey: "k1",
  }, PLAN);

  const single = await call("GET", PEGGING, { params: { plantId: PLANT }, query: { level: "single" }, headers: H(PLAN) });
  assert.equal(single.statusCode, 200);
  assert.equal(single.body.data.requirementCount, 1);
  const singleItem = single.body.data.items.find((item) => item.supplyRef === requirement.Id);
  assert.equal(singleItem.paths.length, 1);
  assert.equal(singleItem.paths[0].length ?? singleItem.paths[0].length, 1);
  assert.equal(singleItem.paths[0][0].partId, part.Id, "والد مستقیم، محصول نهایی است");

  const multi = await call("GET", PEGGING, { params: { plantId: PLANT }, query: { level: "multi", partId: raw.Id }, headers: H(PLAN) });
  assert.equal(multi.statusCode, 200);
  const multiItem = multi.body.data.items.find((item) => item.supplyRef === requirement.Id);
  assert.deepEqual(multiItem.paths[0].map((step) => step.partId), [raw.Id, part.Id]);
  /* گام مبدأ نسبت به خودش ۱ است؛ ضریب مصرف روی گام والد می‌نشیند: ۲۵۰ کیلو / ۵۰ عدد = ۵. */
  assert.equal(multiItem.paths[0][0].quantityPer, 1);
  assert.equal(multiItem.paths[0][1].quantityPer, 5, "ضریب مصرف = ۲۵۰/۵۰");

  const badLevel = await call("GET", PEGGING, { params: { plantId: PLANT }, query: { level: "deep" }, headers: H(PLAN) });
  assert.equal(badLevel.statusCode, 400);
});

/* ═══════════════════════ ۱۱.۷ CRP ═══════════════════════ */

test("۱۱.۷: CRP بار مراکز کاری را در برابر ظرفیت می‌سنجد", async () => {
  const { repo, call } = makeApi();
  const { part, wc } = await seedBase(repo);
  const order = await repo.create("MfgProductionOrder", {
    PlantId: PLANT, OrderNo: "MO-CRP-1", PartId: part.Id, OrderQuantity: 10, Uom: "ea",
    DueAt: "2026-10-12T00:00:00.000Z", Status: "released", PriorityRule: "EDD", DemandSource: "sales-order",
  }, PLAN);
  const op = await repo.create("MfgProductionOrderOperation", {
    PlantId: PLANT, ProductionOrderId: order.Id, SequenceNo: 10, OperationCode: "OP-10",
    WorkCenterId: wc.Id, PlannedQuantity: 10, PlannedSetupMinutes: 30, PlannedRunMinutesPerUnit: 12,
    PlannedCapacityMinutes: 150, Status: "pending",
  }, PLAN);
  await repo.create("MfgOperationSchedule", {
    PlantId: PLANT, ProductionOrderOperationId: op.Id, ScheduleVersion: 1, SegmentNo: 1,
    PlannedStartAt: "2026-10-05T08:00:00.000Z", PlannedEndAt: "2026-10-05T10:30:00.000Z",
    PlannedCapacityMinutes: 150, Status: "tentative",
  }, PLAN);

  const res = await call("POST", CRP_CALC, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { Bucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", OverloadPct: 100, UnderloadPct: 60 },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.scheduledOperationCount, 1);
  const center = res.body.data.workCenters.find((row) => row.workCenterId === wc.Id);
  assert.equal(center.totalLoadMinutes, 150);
  /* یک منبع با ظرفیت ۱ × ۴۸۰ دقیقه × ۷ روز = ۳۳۶۰ دقیقه در هفته. */
  assert.equal(center.buckets[0].capacityMinutes, 3360);
  assert.equal(center.buckets[0].loadMinutes, 150);
  assert.equal(center.buckets[0].status, "underload");
  assert.equal(res.body.data.totals.overloadBucketCount, 0);
});

test("۱۱.۷: CRP مرکز کاری پربار و پیشنهاد تسطیح بار را گزارش می‌کند", async () => {
  const { repo, call } = makeApi();
  const { part, wc } = await seedBase(repo);
  /* ظرفیت هفتگی ۳۳۶۰ دقیقه؛ باری بزرگ‌تر از آن در یک سطل. */
  const order = await repo.create("MfgProductionOrder", {
    PlantId: PLANT, OrderNo: "MO-CRP-2", PartId: part.Id, OrderQuantity: 100, Uom: "ea",
    DueAt: "2026-10-12T00:00:00.000Z", Status: "released", PriorityRule: "EDD", DemandSource: "sales-order",
  }, PLAN);
  const op = await repo.create("MfgProductionOrderOperation", {
    PlantId: PLANT, ProductionOrderId: order.Id, SequenceNo: 10, OperationCode: "OP-10",
    WorkCenterId: wc.Id, PlannedQuantity: 100, PlannedSetupMinutes: 0, PlannedRunMinutesPerUnit: 60,
    PlannedCapacityMinutes: 6000, Status: "pending",
  }, PLAN);
  await repo.create("MfgOperationSchedule", {
    PlantId: PLANT, ProductionOrderOperationId: op.Id, ScheduleVersion: 1, SegmentNo: 1,
    PlannedStartAt: "2026-10-05T08:00:00.000Z", PlannedEndAt: "2026-10-05T20:00:00.000Z",
    PlannedCapacityMinutes: 6000, Status: "tentative",
  }, PLAN);

  const res = await call("POST", CRP_CALC, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { Bucket: "week", BucketCount: 4, HorizonStart: "2026-10-05", OverloadPct: 100, UnderloadPct: 60 },
  });
  const center = res.body.data.workCenters.find((row) => row.workCenterId === wc.Id);
  assert.equal(center.buckets[0].status, "overload");
  assert.equal(center.overloadBucketCount, 1);
  assert.equal(res.body.data.totals.overloadBucketCount, 1);
  assert.ok(res.body.data.levelingSuggestions.length >= 1, "پیشنهاد تسطیح بار");
  assert.equal(res.body.data.levelingSuggestions[0].workCenterId, wc.Id);
});

test("۱۱.۷: خلاصهٔ CRP فقط سرجمع هر مرکز کاری را برمی‌گرداند", async () => {
  const { repo, call } = makeApi();
  await seedBase(repo);
  const res = await call("GET", CRP_SUMMARY, { params: { plantId: PLANT }, query: { bucket: "week", bucketCount: 4, horizonStart: "2026-10-05" }, headers: H(PLAN) });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data.workCenters.length >= 1);
  assert.equal(res.body.data.workCenters[0].buckets, undefined, "جزئیات سطل در خلاصه نمی‌آید");
  assert.equal(typeof res.body.data.workCenters[0].utilizationPct, "number");
  const badBucket = await call("GET", CRP_SUMMARY, { params: { plantId: PLANT }, query: { bucket: "year" }, headers: H(PLAN) });
  assert.equal(badBucket.statusCode, 400);
});

/* ═══════════════════ ۱۱.۱۱ انطباق ISA-95 / MESA-11 ═══════════════════ */

test("۱۱.۱۱: گزارش انطباق هر ۱۱ عملکرد MESA را با مسیر واقعی می‌سنجد", async () => {
  const { repo, call } = makeApi();
  await seedBase(repo);
  const res = await call("GET", CONFORMANCE, { params: { plantId: PLANT }, headers: H(PLAN) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.mesa11.functionCount, 11);
  assert.equal(res.body.data.mesa11.fullyCovered, 11, "هر ۱۱ عملکرد MESA پوشش کامل دارد");
  assert.equal(res.body.data.mesa11.averageCoveragePct, 100);
  for (const fn of res.body.data.mesa11.functions) {
    assert.equal(fn.coveragePct, 100, `عملکرد ${fn.code} پوشش ناقص دارد`);
    for (const route of fn.routes) assert.equal(route.implemented, true, `مسیر ثبت‌نشده: ${route.route}`);
  }
  assert.equal(res.body.data.isa95.level3.implementedRouteCount, 102);
  /* از خود اسکیما شمرده می‌شود؛ ۳۵ جدول و ۶۸ کلید خارجی، همگی درون ماژول Mfg*. */
  assert.equal(res.body.data.isa95.level4.foreignKeysToLevel4, 0, "استقلال منطقی دیتابیس حفظ شده است");
  assert.deepEqual(res.body.data.isa95.level4.foreignKeysToLevel4Detail, []);
  assert.equal(res.body.data.isa95.level4.mfgTableCount, 35);
  assert.equal(res.body.data.isa95.level4.mfgForeignKeyCount, 68);
});

test("۱۱.۱۱: گزارش انطباق برای نقش بدون مجوز ۴۰۳ است", async () => {
  const { call } = makeApi();
  const res = await call("GET", CONFORMANCE, { params: { plantId: PLANT }, headers: H(SUP) });
  assert.equal(res.statusCode, 403);
});

/* ═══════════ ۱۱.۵/۱۱.۶/۱۱.۳ غنی‌سازی خودِ اجرای MRP ═══════════ */

/** دادهٔ MRP: سفارش آزادشده + موجودی ناکافی تا کمبود واقعی تولید شود. */
async function seedMrpFixture(repo) {
  const { part, raw } = await seedBase(repo);
  const order = await repo.create("MfgProductionOrder", {
    PlantId: PLANT, OrderNo: "MO-MRP-1", PartId: part.Id, OrderQuantity: 10, Uom: "ea",
    DueAt: "2026-10-20T18:00:00.000Z", Status: "released", PriorityRule: "EDD", DemandSource: "sales-order",
  }, PLAN);
  const material = await repo.findOne("MfgMaterial", [{ column: "PartId", op: "eq", value: raw.Id }]);
  await repo.create("MfgInventoryLevel", {
    PlantId: PLANT, MaterialId: material.Id, WarehouseCode: "WH-01", LocationCode: "A1", LotNo: null,
    InventoryKey: "WH-01:A1:-", OnHandQty: 5, ReservedQty: 0, BlockedQty: 0, InTransitQty: 0, SafetyStockQty: 0,
    AsOfAt: "2026-10-01T08:00:00.000Z",
  }, PLAN);
  return { part, raw, order, material };
}

test("۱۱.۵/۱۱.۶/۱۱.۳: اجرای MRP گزارش Lead Time، pegging و سفارش برنامه‌ریزی‌شده می‌دهد", async () => {
  const { repo, call } = makeApi();
  const { part, raw, order } = await seedMrpFixture(repo);

  const res = await call("POST", MRP_CALC, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { OrderIds: [order.Id], ThroughDate: "2026-10-30T23:59:59.000Z", PreviewOnly: false },
  });
  assert.equal(res.statusCode, 200);
  const data = res.body.data;

  /* ۱۱.۵ — offset تجمیعی از پایین‌ترین سطح تا محصول نهایی. */
  assert.equal(data.leadTimeOffset.finishedGoodsLeadTimeDays, 24, "RM=5 + SA=12 + FG=7");
  assert.equal(data.leadTimeOffset.maxLowLevelCode, 2);
  const offsets = Object.fromEntries(data.leadTimeOffset.parts.map((row) => [row.partId, row]));
  assert.equal(offsets[raw.Id].cumulativeLeadTimeDays, 5);
  assert.equal(offsets[part.Id].cumulativeLeadTimeDays, 24);

  /* انفجار چندسطحی دو نیاز می‌سازد: پوسته (۱۰ عدد) و ورق (۵۰ کیلو). */
  assert.equal(data.requirements.length, 2);
  assert.equal(data.pegging.requirementCount, 2);

  /* ۱۱.۶ — pegging از نیازهای واقعیِ همین اجرا ساخته و ثبت شده است. */
  const rawMaterial = await repo.findOne("MfgMaterial", [{ column: "PartId", op: "eq", value: raw.Id }]);
  const rawRequirement = data.requirements.find((row) => row.MaterialId === rawMaterial.Id);
  assert.ok(rawRequirement, "نیاز ورق باید در خروجی باشد");
  const entries = data.pegging.multiLevel[rawRequirement.Id];
  assert.ok(entries && entries.length >= 1, "نیاز باید دست‌کم یک مسیر pegging داشته باشد");
  const chain = entries[0].chain;
  assert.equal(chain[0].partId, raw.Id, "زنجیره از جزء آغاز می‌شود");
  assert.equal(chain[chain.length - 1].partId, part.Id, "ریشهٔ مسیر، محصول نهایی است");
  assert.equal(data.pegging.persistedRowCount, 2, "یک ردیف برای هر نیاز");
  assert.equal(await repo.count("MfgRequirementPegging", [{ column: "PlantId", op: "eq", value: PLANT }]), 2);

  /* ۱۱.۳ — کمبود به سفارش برنامه‌ریزی‌شدهٔ پیشنهادی تبدیل شده و ثبت شده است. */
  assert.equal(data.plannedOrders.length, 2);
  const planned = data.plannedOrders.find((row) => row.PartId === raw.Id);
  assert.ok(planned, "پیشنهاد برای ورق");
  assert.equal(planned.Status, "proposed", "پیشنهاد است نه تعهد");
  assert.equal(planned.Source, "mrp");
  assert.equal(planned.Quantity, 45, "۵۰ نیاز − ۵ موجودی");
  assert.equal(planned.LowLevelCode, 2);
  assert.equal(planned.CumulativeLeadTimeDays, 5);
  const subPlanned = data.plannedOrders.find((row) => row.PartId !== raw.Id);
  assert.equal(subPlanned.LowLevelCode, 1);
  assert.equal(subPlanned.CumulativeLeadTimeDays, 17, "۱۲ روز خودش + ۵ روز ورق");
  assert.equal(await repo.count("MfgPlannedOrder", [{ column: "PlantId", op: "eq", value: PLANT }]), data.plannedOrders.length);

  /* آزادسازی باید به اندازهٔ زمان تحویل تجمیعی عقب‌تر از موعد باشد. */
  const dueMs = Date.parse(planned.PlannedDueAt);
  const releaseMs = Date.parse(planned.PlannedReleaseAt);
  assert.equal(Math.round((dueMs - releaseMs) / 86_400_000), 5, "offset آزادسازی = زمان تحویل تجمیعی");
  assert.equal(Math.round((Date.parse(subPlanned.PlannedDueAt) - Date.parse(subPlanned.PlannedReleaseAt)) / 86_400_000), 17);

  assert.equal(data.summary.plannedOrderCount, data.plannedOrders.length);
  assert.equal(data.summary.peggedRequirementCount, 2);
  assert.equal(data.summary.finishedGoodsLeadTimeDays, 24);
});

test("۱۱.۳: اجرای MRP در حالت پیش‌نمایش هیچ سفارش برنامه‌ریزی‌شده‌ای ثبت نمی‌کند", async () => {
  const { repo, call } = makeApi();
  const { order } = await seedMrpFixture(repo);

  const res = await call("POST", MRP_CALC, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { OrderIds: [order.Id], ThroughDate: "2026-10-30T23:59:59.000Z", PreviewOnly: true },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.previewOnly, true);
  assert.ok(res.body.data.plannedOrders.length >= 1, "پیشنهادها محاسبه و برگردانده می‌شوند");
  assert.equal(await repo.count("MfgPlannedOrder", [{ column: "PlantId", op: "eq", value: PLANT }]), 0);
  assert.equal(await repo.count("MfgRequirementPegging", [{ column: "PlantId", op: "eq", value: PLANT }]), 0);
  /* پیشنهادهای پیش‌نمایش شناسه ندارند چون ردیف دیتابیس نیستند. */
  assert.equal(res.body.data.plannedOrders[0].Id, undefined);
});

test("۱۱.۴: سیاست لات قطعه در پیشنهاد MRP اعمال می‌شود", async () => {
  const { repo, call } = makeApi();
  const { raw, order } = await seedMrpFixture(repo);
  /* FOQ=۵۰۰ با مضرب ۵۰: کمبود ۴۵ باید به ۵۰۰ برسد. */
  await repo.create("MfgLotSizingPolicy", {
    PlantId: PLANT, PartId: raw.Id, PolicyCode: "POL-RM-FOQ", RuleCode: "FOQ",
    FixedLotQty: 500, OrderMultiple: 50, MinOrderQty: null, MaxOrderQty: null,
    OrderingCost: 0, HoldingCostPerUnitPerYear: 0, AnnualDemandQty: null,
    PeriodDays: null, PeriodOrderQuantity: null, Currency: "IRR",
    EffectiveFrom: "2026-01-01", EffectiveTo: null, IsActive: true,
  }, PLAN);

  const res = await call("POST", MRP_CALC, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { OrderIds: [order.Id], ThroughDate: "2026-10-30T23:59:59.000Z", PreviewOnly: true },
  });
  assert.equal(res.statusCode, 200);
  const planned = res.body.data.plannedOrders.find((row) => row.partId === raw.Id);
  assert.ok(planned, "پیشنهاد برای مادهٔ کمبوددار");
  assert.equal(planned.lotSizingRule, "FOQ");
  assert.equal(planned.quantity, 500, "کمبود به اندازهٔ لات ثابت گرد می‌شود");
  assert.equal(planned.shortageQuantity, 45, "کمبود واقعی = ۵۰ نیاز − ۵ موجودی");
});

test("۱۱.۳: اجرای دوبارهٔ MRP پیشنهادهای بازبینی‌نشده را جایگزین می‌کند نه انباشته", async () => {
  const { repo, call } = makeApi();
  const { order } = await seedMrpFixture(repo);
  const body = { OrderIds: [order.Id], ThroughDate: "2026-10-30T23:59:59.000Z", PreviewOnly: false };

  const first = await call("POST", MRP_CALC, { params: { plantId: PLANT }, headers: H(PLAN), body });
  assert.equal(first.statusCode, 200);
  const countAfterFirst = await repo.count("MfgPlannedOrder", [{ column: "PlantId", op: "eq", value: PLANT }]);
  assert.ok(countAfterFirst >= 1);

  /* یکی را تأیید می‌کنیم تا مطمئن شویم پیشنهادهای تأییدشده پاک نمی‌شوند. */
  const approved = first.body.data.plannedOrders[0];
  await call("POST", PLANNED_APPROVE, {
    params: { plantId: PLANT, plannedOrderId: approved.Id }, headers: { ...H(PLAN), ...MATCH(1) }, body: {},
  });

  const second = await call("POST", MRP_CALC, { params: { plantId: PLANT }, headers: H(PLAN), body });
  assert.equal(second.statusCode, 200);
  const rows = await repo.list("MfgPlannedOrder", { where: [{ column: "PlantId", op: "eq", value: PLANT }] });
  const statuses = rows.map((row) => row.Status);
  assert.ok(statuses.includes("approved"), "سفارش تأییدشدهٔ برنامه‌ریز حفظ می‌شود");
  assert.equal(statuses.filter((status) => status === "proposed").length, second.body.data.plannedOrders.length);
});

/* ═══════════════════════ ۱۱.۸ ATP ظرفیت‌آگاه ═══════════════════════ */

const ATP_CHECKS = `${ROOT}/atp/checks`;

/** بار موجود روی مرکز کاری تا ظرفیت سطل نخست تقریباً پر شود. */
async function seedWorkCenterLoad(repo, { part, wc, capacityMinutes = 3200 }) {
  const order = await repo.create("MfgProductionOrder", {
    PlantId: PLANT, OrderNo: "MO-LOAD-1", PartId: part.Id, OrderQuantity: 100, Uom: "ea",
    DueAt: "2026-10-10T18:00:00.000Z", Status: "released", PriorityRule: "EDD", DemandSource: "sales-order",
  }, PLAN);
  const op = await repo.create("MfgProductionOrderOperation", {
    PlantId: PLANT, ProductionOrderId: order.Id, SequenceNo: 10, OperationCode: "OP-10",
    WorkCenterId: wc.Id, PlannedQuantity: 100, PlannedSetupMinutes: 0, PlannedRunMinutesPerUnit: 32,
    PlannedCapacityMinutes: capacityMinutes, Status: "pending",
  }, PLAN);
  await repo.create("MfgOperationSchedule", {
    PlantId: PLANT, ProductionOrderOperationId: op.Id, ScheduleVersion: 1, SegmentNo: 1,
    PlannedStartAt: "2026-10-05T08:00:00.000Z", PlannedEndAt: "2026-10-06T18:00:00.000Z",
    PlannedCapacityMinutes: capacityMinutes, Status: "tentative",
  }, PLAN);
  return { order, op };
}

test("۱۱.۸: ATP ظرفیت آزاد مراکز کاری را می‌سنجد و وعده را به سطل دارای ظرفیت منتقل می‌کند", async () => {
  const { repo, call } = makeApi();
  const { part, wc } = await seedBase(repo);
  const material = await repo.findOne("MfgMaterial", [{ column: "PartId", op: "eq", value: part.Id }]);
  /* موجودی فراوان: قید محدودکننده فقط ظرفیت است. */
  await repo.create("MfgInventoryLevel", {
    PlantId: PLANT, MaterialId: material.Id, WarehouseCode: "WH-01", LocationCode: "A1", InventoryKey: "k",
    OnHandQty: 1000, ReservedQty: 0, BlockedQty: 0, InTransitQty: 0, SafetyStockQty: 0, AsOfAt: "2026-10-01T08:00:00.000Z",
  }, PLAN);
  await seedWorkCenterLoad(repo, { part, wc, capacityMinutes: 3200 });

  const res = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, RequestedQty: 20, RequestedAt: "2026-10-06", BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4, Persist: false },
  });
  assert.equal(res.statusCode, 201);
  const data = res.body.data;
  assert.equal(data.includeCapacity, true);
  assert.equal(data.capacity.considered, true);
  assert.equal(data.capacity.centers.length, 1);

  const center = data.capacity.centers[0];
  assert.equal(center.workCenterId, wc.Id);
  /* ۳۰ دقیقه راه‌اندازی + ۲۰ × ۱۲ دقیقه = ۲۷۰ دقیقه نیاز. */
  assert.equal(center.requiredMinutes, 270);
  /* ظرفیت هفتگی ۳۳۶۰ − بار موجود ۳۲۰۰ = ۱۶۰ دقیقه آزاد در سطل نخست. */
  assert.equal(center.buckets[0].availableMinutes, 3360);
  assert.equal(center.buckets[0].loadedMinutes, 3200);
  assert.equal(center.buckets[0].freeMinutes, 160);
  assert.equal(center.buckets[0].sufficient, false, "۱۶۰ < ۲۷۰ پس سطل نخست جا ندارد");
  assert.equal(center.buckets[1].sufficient, true);

  assert.equal(data.capacity.constrained, true);
  assert.equal(data.capacity.promiseBucketIndex, 1);
  assert.equal(data.capacity.promiseAt, "2026-10-19");
  assert.equal(data.promisedAt, "2026-10-19", "وعدهٔ نهایی = وعدهٔ ظرفیت");
  assert.equal(data.promiseConstrainedByCapacity, true);
});

test("۱۱.۸: وقتی ظرفیت کافی است وعدهٔ موجودی تغییر نمی‌کند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const material = await repo.findOne("MfgMaterial", [{ column: "PartId", op: "eq", value: part.Id }]);
  await repo.create("MfgInventoryLevel", {
    PlantId: PLANT, MaterialId: material.Id, WarehouseCode: "WH-01", LocationCode: "A1", InventoryKey: "k",
    OnHandQty: 1000, ReservedQty: 0, BlockedQty: 0, InTransitQty: 0, SafetyStockQty: 0, AsOfAt: "2026-10-01T08:00:00.000Z",
  }, PLAN);

  const res = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, RequestedQty: 20, RequestedAt: "2026-10-06", BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4, Persist: false },
  });
  assert.equal(res.statusCode, 201);
  const data = res.body.data;
  assert.equal(data.capacity.considered, true);
  assert.equal(data.capacity.constrained, false);
  assert.equal(data.capacity.promiseBucketIndex, 0);
  assert.equal(data.promiseConstrainedByCapacity, false, "ظرفیت قید نبود");
  assert.equal(data.promisedAt, data.check.promisedAt, "وعدهٔ موجودی دست‌نخورده");
});

test("۱۱.۸: IncludeCapacity=false ظرفیت را کنار می‌گذارد", async () => {
  const { repo, call } = makeApi();
  const { part, wc } = await seedBase(repo);
  const material = await repo.findOne("MfgMaterial", [{ column: "PartId", op: "eq", value: part.Id }]);
  await repo.create("MfgInventoryLevel", {
    PlantId: PLANT, MaterialId: material.Id, WarehouseCode: "WH-01", LocationCode: "A1", InventoryKey: "k",
    OnHandQty: 1000, ReservedQty: 0, BlockedQty: 0, InTransitQty: 0, SafetyStockQty: 0, AsOfAt: "2026-10-01T08:00:00.000Z",
  }, PLAN);
  await seedWorkCenterLoad(repo, { part, wc, capacityMinutes: 3350 });

  const res = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, RequestedQty: 20, RequestedAt: "2026-10-06", BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4, IncludeCapacity: false, Persist: false },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.includeCapacity, false);
  assert.equal(res.body.data.capacity.considered, false);
  assert.deepEqual(res.body.data.capacity.centers, []);
  assert.equal(res.body.data.promiseConstrainedByCapacity, false);
});

test("۱۱.۸: قطعهٔ بدون Routing آزادشده ظرفیت را «بررسی‌نشده» گزارش می‌دهد نه خطا", async () => {
  const { repo, call } = makeApi();
  const raw = await repo.create("MfgPart", {
    PlantId: PLANT, PartNo: "RM-NO-ROUTING", NameFa: "مادهٔ خریدنی", PartType: "purchased", BaseUom: "kg", IsActive: true,
  }, ENG);
  const material = await repo.create("MfgMaterial", {
    PlantId: PLANT, PartId: raw.Id, ProcurementType: "buy", LeadTimeDays: 5, SafetyStockQty: 0, IsActive: true,
  }, PLAN);
  await repo.create("MfgInventoryLevel", {
    PlantId: PLANT, MaterialId: material.Id, WarehouseCode: "WH-01", LocationCode: "A1", InventoryKey: "k2",
    OnHandQty: 500, ReservedQty: 0, BlockedQty: 0, InTransitQty: 0, SafetyStockQty: 0, AsOfAt: "2026-10-01T08:00:00.000Z",
  }, PLAN);

  const res = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: raw.Id, RequestedQty: 10, RequestedAt: "2026-10-06", BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4, Persist: false },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.capacity.considered, false);
  assert.equal(res.body.data.capacity.constrained, false);
  assert.equal(res.body.data.promiseConstrainedByCapacity, false);
});

test("۱۱.۸: رکورد ثبت‌شدهٔ ATP قید ظرفیت و وعدهٔ نهایی را نگه می‌دارد", async () => {
  const { repo, call } = makeApi();
  const { part, wc } = await seedBase(repo);
  const material = await repo.findOne("MfgMaterial", [{ column: "PartId", op: "eq", value: part.Id }]);
  await repo.create("MfgInventoryLevel", {
    PlantId: PLANT, MaterialId: material.Id, WarehouseCode: "WH-01", LocationCode: "A1", InventoryKey: "k",
    OnHandQty: 1000, ReservedQty: 0, BlockedQty: 0, InTransitQty: 0, SafetyStockQty: 0, AsOfAt: "2026-10-01T08:00:00.000Z",
  }, PLAN);
  await seedWorkCenterLoad(repo, { part, wc, capacityMinutes: 3200 });

  const res = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, RequestedQty: 20, RequestedAt: "2026-10-06", BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4 },
  });
  assert.equal(res.statusCode, 201);
  const record = res.body.data.record;
  assert.ok(record, "رکورد ثبت شد");
  assert.equal(record.DetailJson.includeCapacity, true);
  assert.equal(record.DetailJson.capacity.constrained, true);
  assert.equal(record.DetailJson.capacity.promiseAt, "2026-10-19");
  assert.equal(record.DetailJson.capacity.centers.length, 1);
  assert.deepEqual(record.DetailJson.capacity.centers[0].sufficientByBucket, [false, true, true, true]);
  assert.equal(record.DetailJson.promisedAt, "2026-10-19");
  assert.equal(record.DetailJson.promiseConstrainedByCapacity, true);
  /* پیام رکورد، قید ظرفیت را توضیح می‌دهد نه فقط کمبود موجودی را. */
  assert.match(record.MessageFa, /ظرفیت/);

  /* و از مسیر فهرست هم خوانده می‌شود. */
  const list = await call("GET", ATP_CHECKS, { params: { plantId: PLANT }, query: { partId: part.Id }, headers: H(PLAN) });
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.data.page.total, 1);
  assert.equal(list.body.data.items[0].DetailJson.capacity.constrained, true);
});

test("۱۱.۳: خواندن تکی سفارش برنامه‌ریزی‌شده pegging را هم برمی‌گرداند", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  const planned = await seedPlannedOrder(repo, { part });

  const res = await call("GET", PLANNED_ONE, { params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: H(PLAN) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.Id, planned.Id);
  assert.equal(res.body.data.PlannedOrderNo, planned.PlannedOrderNo);
  assert.ok(Array.isArray(res.body.data.pegging), "pegging ضمیمه می‌شود");
  assert.deepEqual(res.body.data.pegging, []);

  const missing = await call("GET", PLANNED_ONE, { params: { plantId: PLANT, plannedOrderId: "no-such-id" }, headers: H(PLAN) });
  assert.equal(missing.statusCode, 404);
});

test("۱۱.۳: قطعهٔ خریدنی به سفارش تولید تبدیل نمی‌شود و به مسیر تأمین ارجاع می‌دهد", async () => {
  const { repo, call } = makeApi();
  await seedBase(repo);
  const purchased = await repo.create("MfgPart", {
    PlantId: PLANT, PartNo: "RM-BUY-ONLY", NameFa: "قطعهٔ خریدنی", PartType: "purchased", BaseUom: "ea", IsActive: true,
  }, ENG);
  const planned = await seedPlannedOrder(repo, { part: purchased, status: "approved" });

  const res = await call("POST", PLANNED_CONVERT, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) }, body: {},
  });
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error.code, "MFG_PLANNED_ORDER_NOT_MAKE");
  /* جزئیات MfgApiError مستقیم درون error پخش می‌شود، نه زیر details. */
  assert.match(res.body.error.procurementRoute, /material-procurement-proposals/);
  assert.equal(res.body.error.partNo, "RM-BUY-ONLY");
  /* هیچ سفارش تولیدی ساخته نشده باشد. */
  assert.equal(await repo.count("MfgProductionOrder", [{ column: "PlantId", op: "eq", value: PLANT }]), 0);
  /* و سفارش برنامه‌ریزی‌شده همچنان تأییدشده و قابل اقدام می‌ماند. */
  assert.equal((await repo.get("MfgPlannedOrder", planned.Id)).Status, "approved");
});

test("۱۱.۳: قطعهٔ ساختنی با ProcurementType=buy هم رد می‌شود", async () => {
  const { repo, call } = makeApi();
  const { part } = await seedBase(repo);
  /* PartType ساختنی است اما ماده به‌صورت buy تعریف شده — همان قید باید بگیرد. */
  const material = await repo.findOne("MfgMaterial", [{ column: "PartId", op: "eq", value: part.Id }]);
  await repo.patch("MfgMaterial", material.Id, { ProcurementType: "buy" }, PLAN, material.RowVersion);
  const planned = await seedPlannedOrder(repo, { part, status: "approved" });

  const res = await call("POST", PLANNED_CONVERT, {
    params: { plantId: PLANT, plannedOrderId: planned.Id }, headers: { ...H(PLAN), ...MATCH(1) }, body: {},
  });
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error.code, "MFG_PLANNED_ORDER_NOT_MAKE");
});

test("۱۱.۸: عملیات با چند segment زمان‌بندی ATP را نمی‌شکند (بازگشتی)", async () => {
  /* باگ واقعی: storedIsoTimestamp رشتهٔ ISO می‌دهد و Math.min روی دو رشته NaN
   * می‌سازد؛ new Date(NaN).toISOString() با RangeError می‌ترکید. تنها وقتی
   * بروز می‌کرد که یک عملیات بیش از یک segment داشته باشد. */
  const { repo, call } = makeApi();
  const { part, wc } = await seedBase(repo);
  const material = await repo.findOne("MfgMaterial", [{ column: "PartId", op: "eq", value: part.Id }]);
  await repo.create("MfgInventoryLevel", {
    PlantId: PLANT, MaterialId: material.Id, WarehouseCode: "WH-01", LocationCode: "A1", InventoryKey: "k",
    OnHandQty: 1000, ReservedQty: 0, BlockedQty: 0, InTransitQty: 0, SafetyStockQty: 0, AsOfAt: "2026-10-01T08:00:00.000Z",
  }, PLAN);
  const order = await repo.create("MfgProductionOrder", {
    PlantId: PLANT, OrderNo: "MO-MULTI-SEG", PartId: part.Id, OrderQuantity: 100, Uom: "ea",
    DueAt: "2026-10-10T18:00:00.000Z", Status: "released", PriorityRule: "EDD", DemandSource: "sales-order",
  }, PLAN);
  const op = await repo.create("MfgProductionOrderOperation", {
    PlantId: PLANT, ProductionOrderId: order.Id, SequenceNo: 10, OperationCode: "OP-10",
    WorkCenterId: wc.Id, PlannedQuantity: 100, PlannedSetupMinutes: 0, PlannedRunMinutesPerUnit: 20,
    PlannedCapacityMinutes: 2000, Status: "pending",
  }, PLAN);
  /* دو segment در دو سطل متفاوت، با ترتیب معکوس ثبت‌شده تا هم Math.min و هم
   * Math.max آزموده شوند. اگر ادغام پنجره با Math.min روی رشتهٔ ISO انجام شود
   * NaN می‌شود و بار به‌جای پخش روی دو سطل، یک‌جا در سطل صفر می‌نشیند. */
  await repo.create("MfgOperationSchedule", {
    PlantId: PLANT, ProductionOrderOperationId: op.Id, ScheduleVersion: 1, SegmentNo: 2,
    PlannedStartAt: "2026-10-13T08:00:00.000Z", PlannedEndAt: "2026-10-15T18:00:00.000Z",
    PlannedCapacityMinutes: 1000, Status: "tentative",
  }, PLAN);
  await repo.create("MfgOperationSchedule", {
    PlantId: PLANT, ProductionOrderOperationId: op.Id, ScheduleVersion: 1, SegmentNo: 1,
    PlannedStartAt: "2026-10-08T08:00:00.000Z", PlannedEndAt: "2026-10-10T18:00:00.000Z",
    PlannedCapacityMinutes: 1000, Status: "tentative",
  }, PLAN);

  const res = await call("POST", ATP_CHECKS, {
    params: { plantId: PLANT }, headers: H(PLAN),
    body: { PartId: part.Id, RequestedQty: 20, RequestedAt: "2026-10-06", BucketUnit: "week", HorizonStart: "2026-10-05", BucketCount: 4, Persist: false },
  });
  assert.equal(res.statusCode, 201, "نباید ۵۰۰ شود");
  const center = res.body.data.capacity.centers[0];
  assert.equal(center.workCenterId, wc.Id);
  /* پنجرهٔ ادغام‌شده ۰۸→۱۵ اکتبر دو سطل را می‌پوشاند؛ ۲۰۰۰ دقیقه باید
   * نصف‌نصف پخش شود. باگ NaN همهٔ ۲۰۰۰ را در سطل صفر می‌ریخت. */
  assert.equal(center.buckets[0].loadedMinutes, 1000);
  assert.equal(center.buckets[1].loadedMinutes, 1000);
  assert.equal(center.buckets[2].loadedMinutes, 0);
});
