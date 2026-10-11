/**
 * آزمون پل یکپارچگی CMMS → MES — سمت سامانهٔ مقصد.
 *
 * این فایل قرارداد `cmms-mes-v1` را از سمت گیرنده قفل می‌کند:
 *   • توقف‌ها در `MfgDowntimeLog` ثبت می‌شوند (ناخواسته/برنامه‌ریزی‌شده).
 *   • بلوکهٔ نرم ظرفیت همان رزرو برنامه‌ریزی‌شده است که موتور زمان‌بندی
 *     از ظرفیت کم می‌کند.
 *   • تحویل دوبارهٔ یک رویداد، دوباره‌کاری نمی‌سازد.
 *   • هیچ کلید خارجی‌ای بین دو اسکیما وجود ندارد؛ اینجا فقط ردیف‌های خودِ
 *     MES ساخته می‌شوند و مرکز کاری با «ارجاع نرم» پیدا می‌شود.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { applyCmmsIntegrationEvent, registerMesCmmsBridgeRoutes } from "./cmmsMesBridge.js";
import { DEMO_SUBJECTS, evaluate } from "./rbacLogic.js";

const WC = { Id: "WC-100", PlantId: "PLANT-DEMO", Code: "CNC-01", NominalCapacityMinutesPerDay: 480 };

function makeRepo({ workCenters = [WC] } = {}) {
  const tables = new Map();
  let next = 1;
  const seed = (table, rows) => tables.set(table, rows.map((row) => ({ RowVersion: 1, ...row })));
  seed("MfgWorkCenter", workCenters);
  seed("MfgDowntimeLog", []);
  const rows = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  const matches = (row, where = []) => where.every((w) => {
    const actual = row[w.column];
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
        out = [...out].sort((a, b) => (a[order.column] === b[order.column] ? 0 : a[order.column] < b[order.column] ? -1 : 1) * (order.dir === "desc" ? -1 : 1));
      }
      const offset = spec.offset ?? 0;
      return out.slice(offset, spec.limit === undefined ? undefined : offset + spec.limit);
    },
    async count(table, where = []) { return rows(table).filter((row) => matches(row, where)).length; },
    async patch(table, id, data, userId, expectedRowVersion) {
      const row = rows(table).find((item) => item.Id === id);
      if (!row) return { affected: 0, ok: false, code: "NOT_FOUND" };
      if (expectedRowVersion !== undefined && row.RowVersion !== expectedRowVersion) return { affected: 0, ok: false, code: "CONCURRENCY_CONFLICT" };
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
      const before = next;
      try {
        return await work(repo);
      } catch (error) {
        tables.clear();
        for (const [table, values] of snapshot) tables.set(table, values);
        next = before;
        throw error;
      }
    },
  };
  return repo;
}

const PAYLOAD_BASE = {
  contract: "cmms-mes-v1", sourceSystem: "cmms", siteId: "SITE-DEMO",
  assetRef: "ASSET-1", assetTag: "P-101", workCenterRef: "WC-100",
  productionImpact: "line-stop", reasonCode: "machine-breakdown", reasonFa: "خرابی یاتاقان",
  workOrderRef: "WO-5", failureRef: null, sourceRef: "CmmsDowntimeRecord:DR-1",
};

const downtimeEvent = (overrides = {}) => ({
  Id: "EV-1", EventType: "downtime.reported", TargetSystem: "mes", TargetRef: "WC-100",
  Contract: "cmms-mes-v1", IdempotencyKey: "SITE-DEMO:downtime.reported:CmmsDowntimeRecord:DR-1:1",
  PayloadJson: { ...PAYLOAD_BASE, startedAt: "2026-10-11T08:00:00.000Z", finishedAt: "2026-10-11T10:00:00.000Z", durationMinutes: 120, downtimeType: "unplanned", ...overrides },
});

const capacityEvent = ({ action = "requested", ...overrides } = {}) => ({
  Id: `EV-CB-${action}`, EventType: action === "released" ? "capacity.block.released" : "capacity.block.requested",
  TargetSystem: "mes", TargetRef: "WC-100", Contract: "cmms-mes-v1",
  IdempotencyKey: `SITE-DEMO:capacity.block.${action}:CmmsCapacityBlock:CB-1:${action === "released" ? 2 : 1}`,
  PayloadJson: {
    contract: "cmms-mes-v1", sourceSystem: "cmms", siteId: "SITE-DEMO",
    blockRef: "CB-1", plantRef: "PLANT-DEMO", workCenterRef: "WC-100",
    sourceType: "pm-schedule", sourceRef: "PM-9", action,
    windowStart: "2026-11-01T08:00:00.000Z", windowEnd: "2026-11-01T12:00:00.000Z",
    reservedMinutes: 240, reasonFa: "رزرو PM", ...overrides,
  },
});

/* ═══════════════════════ ۱. اِعمال رویدادها ═══════════════════════ */

test("رویداد توقف گزارش‌شده، ردیف MfgDowntimeLog و تصویر دسترس‌پذیری می‌سازد", async () => {
  const repo = makeRepo();
  const result = await applyCmmsIntegrationEvent({ repo, event: downtimeEvent() });
  assert.equal(result.ok, true);
  assert.equal(result.workCenterId, "WC-100");
  const logs = await repo.list("MfgDowntimeLog", []);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].WorkCenterId, "WC-100");
  assert.equal(logs[0].DowntimeType, "unplanned");
  assert.equal(logs[0].DurationMinutes, 120);
  assert.equal(logs[0].StartedAt, "2026-10-11T08:00:00.000Z");
  assert.equal(logs[0].FinishedAt, "2026-10-11T10:00:00.000Z");
  assert.equal(logs[0].ReasonCode, "CMMS-DOWNTIME");
  assert.match(logs[0].NoteFa, /SITE-DEMO:downtime\.reported/);
  /* تصویر دسترس‌پذیری: پنجرهٔ روز UTC رویداد (۴۸۰ دقیقه ظرفیت اسمی) منهای
   * ۱۲۰ دقیقه توقف ناخواسته. */
  assert.equal(result.availabilityWindow.from, "2026-10-11T00:00:00.000Z");
  assert.equal(result.availabilityWindow.to, "2026-10-12T00:00:00.000Z");
  assert.equal(result.availability.plannedDowntimeMinutes, 0);
  assert.equal(result.availability.unplannedDowntimeMinutes, 120);
  assert.equal(result.availability.calendarMinutes, 480);
  assert.equal(result.availability.operatingMinutes, 360);
  assert.equal(result.availability.availabilityPct, 75);
  assert.ok(result.ack && result.ack.availability, "پاسخ تحویل باید شاهد وضعیت MES باشد");
});

test("توقف started باز می‌ماند و finished همان ردیف را می‌بندد", async () => {
  const repo = makeRepo();
  const started = await applyCmmsIntegrationEvent({
    repo,
    now: "2026-10-11T09:00:00.000Z",
    event: {
      ...downtimeEvent({ startedAt: "2026-10-11T08:00:00.000Z", finishedAt: null, durationMinutes: null }),
      Id: "EV-START",
      EventType: "downtime.started",
    },
  });
  assert.equal(started.applied.open, true);
  let logs = await repo.list("MfgDowntimeLog", []);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].FinishedAt, null);

  const finished = await applyCmmsIntegrationEvent({
    repo,
    now: "2026-10-11T09:30:00.000Z",
    event: {
      ...downtimeEvent({ startedAt: "2026-10-11T08:00:00.000Z", finishedAt: "2026-10-11T09:30:00.000Z", durationMinutes: 90 }),
      Id: "EV-2",
      EventType: "downtime.finished",
      IdempotencyKey: "SITE-DEMO:downtime.finished:CmmsWorkOrderHold:H-1:2",
    },
  });
  assert.equal(finished.applied.closed, true);
  assert.equal(finished.applied.durationMinutes, 90);
  logs = await repo.list("MfgDowntimeLog", []);
  assert.equal(logs.length, 1, "پایان توقف نباید ردیف دومی بسازد");
  assert.equal(logs[0].FinishedAt, "2026-10-11T09:30:00.000Z");
  assert.equal(logs[0].DurationMinutes, 90);
});

test("تحویل دوبارهٔ همان کلید تکرارناپذیری، ردیف تکراری نمی‌سازد", async () => {
  const repo = makeRepo();
  const first = await applyCmmsIntegrationEvent({ repo, event: downtimeEvent() });
  const second = await applyCmmsIntegrationEvent({ repo, event: { ...downtimeEvent(), Id: "EV-1-dup" } });
  assert.equal(first.applied.duplicate, false);
  assert.equal(second.applied.duplicate, true);
  assert.equal(second.externalRef, first.externalRef);
  assert.equal((await repo.list("MfgDowntimeLog", [])).length, 1);
});

test("بلوکهٔ ظرفیت به توقف برنامه‌ریزی‌شده ترجمه می‌شود و آزادسازی رزرو آینده را حذف می‌کند", async () => {
  const repo = makeRepo();
  const requested = await applyCmmsIntegrationEvent({
    repo,
    now: "2026-10-20T00:00:00.000Z",
    event: capacityEvent({ action: "requested", windowStart: "2026-11-01T08:00:00.000Z", windowEnd: "2026-11-01T12:00:00.000Z" }),
  });
  assert.equal(requested.applied.reservedMinutes, 240);
  let logs = await repo.list("MfgDowntimeLog", []);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].DowntimeType, "planned");
  assert.equal(logs[0].ReasonCode, "CMMS-PM-BLOCK");

  const released = await applyCmmsIntegrationEvent({
    repo,
    now: "2026-10-21T00:00:00.000Z",
    event: capacityEvent({ action: "released", externalRef: requested.externalRef, windowStart: "2026-11-01T08:00:00.000Z", windowEnd: "2026-11-01T12:00:00.000Z" }),
  });
  assert.equal(released.applied.released, true);
  assert.equal(released.applied.removed, true, "رزرو آیندهٔ شروع‌نشده حذف می‌شود، نه ردیف بسته");
  assert.equal((await repo.list("MfgDowntimeLog", [])).length, 0);
});

test("آزادسازی رزروی که شروع شده، آن را در زمان حال می‌بندد", async () => {
  const repo = makeRepo();
  const requested = await applyCmmsIntegrationEvent({
    repo,
    now: "2026-10-31T00:00:00.000Z",
    event: capacityEvent({ action: "requested", windowStart: "2026-11-01T08:00:00.000Z", windowEnd: "2026-11-01T12:00:00.000Z" }),
  });
  const released = await applyCmmsIntegrationEvent({
    repo,
    now: "2026-11-01T09:00:00.000Z",
    event: capacityEvent({ action: "released", externalRef: requested.externalRef, windowStart: "2026-11-01T08:00:00.000Z", windowEnd: "2026-11-01T12:00:00.000Z" }),
  });
  assert.equal(released.applied.released, true);
  assert.equal(released.applied.removed, false);
  const logs = await repo.list("MfgDowntimeLog", []);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].FinishedAt, "2026-11-01T09:00:00.000Z");
  assert.equal(logs[0].DurationMinutes, 60);
});

test("مرکز کاری ناشناخته، قرارداد نادرست و کلید تکرارناپذیری خالی رد می‌شوند", async () => {
  const repo = makeRepo();
  await assert.rejects(
    () => applyCmmsIntegrationEvent({ repo, event: { ...downtimeEvent(), TargetRef: "WC-NOPE" } }),
    (error) => error.code === "E-MES-WORKCENTER-UNKNOWN",
  );
  await assert.rejects(
    () => applyCmmsIntegrationEvent({ repo, event: { ...downtimeEvent(), PayloadJson: { ...downtimeEvent().PayloadJson, contract: "v9" } } }),
    (error) => error.code === "E-MES-CONTRACT",
  );
  await assert.rejects(
    () => applyCmmsIntegrationEvent({ repo, event: { ...downtimeEvent(), IdempotencyKey: "" } }),
    (error) => error.code === "E-MES-IDEMPOTENCY",
  );
  /* خطاهای اعتبارسنجی نباید ردیف نیمه‌کاره بگذارند. */
  assert.equal((await repo.list("MfgDowntimeLog", [])).length, 0);
});

test("واحد اندازه‌گیری زمان توقف به دقیقه گرد می‌شود", async () => {
  const repo = makeRepo();
  const result = await applyCmmsIntegrationEvent({
    repo,
    event: downtimeEvent({ startedAt: "2026-10-11T08:00:10.000Z", finishedAt: "2026-10-11T08:02:45.000Z", durationMinutes: null }),
  });
  assert.equal(result.applied.durationMinutes, 3);
});

/* ═══════════════════════ ۲. لایهٔ HTTP سمت MES ═══════════════════════ */

function makeApi({ repo = makeRepo() } = {}) {
  const handlers = new Map();
  const app = Object.fromEntries(["get", "post"].map((method) => [
    method, (path, handler) => handlers.set(`${method.toUpperCase()} ${path}`, handler),
  ]));
  registerMesCmmsBridgeRoutes(app, { repo, subjects: DEMO_SUBJECTS, evaluate });
  const call = async (method, path, { params = {}, query = {}, body = {}, userId = null } = {}) => {
    const handler = handlers.get(`${method} ${path}`);
    assert.ok(handler, `مسیر ثبت نشده است: ${method} ${path}`);
    const req = { params, query, body, headers: userId ? { "x-user-id": userId } : {}, requestId: "mes-bridge-test" };
    const res = {
      statusCode: 200, body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
    await handler(req, res);
    return res;
  };
  return { repo, call };
}

test("دریافت رویداد بدون هویت ۴۰۱ و با مجوز ناکافی ۴۰۳ می‌گیرد", async () => {
  const { call } = makeApi();
  const anonymous = await call("POST", "/api/mfg/integration/cmms/events", { body: downtimeEvent() });
  assert.equal(anonymous.statusCode, 401);
  /* اپراتور مجوز «ویرایش تقویم» ندارد؛ رویداد ظرفیت باید رد شود. */
  const forbidden = await call("POST", "/api/mfg/integration/cmms/events", {
    userId: "u-mfg-operator", body: { ...capacityEvent({ action: "requested" }), TargetSystem: "mes" },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.body.error.permission, "mfg.calendar.edit");
});

test("سرپرست سالن رویداد توقف را می‌پذیرد و MES ردیف خودش را می‌سازد", async () => {
  const { repo, call } = makeApi();
  const res = await call("POST", "/api/mfg/integration/cmms/events", { userId: "u-mfg-supervisor", body: downtimeEvent() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.availability.unplannedDowntimeMinutes, 120);
  assert.equal((await repo.list("MfgDowntimeLog", [])).length, 1);
  /* کارخانهٔ دیگر همان رویداد را نمی‌پذیرد: دامنهٔ مرکز کاری، مرجع دامنه است. */
  const employee = await call("POST", "/api/mfg/integration/cmms/events", {
    userId: "u-mfg-supervisor",
    body: { ...downtimeEvent(), TargetRef: "WC-200" },
  });
  assert.equal(repo.tables.get("MfgDowntimeLog").length, 1, "درخواست ردشده نباید ردیف بسازد");
  assert.equal(employee.statusCode >= 400, true);
});

test("مهندس ساخت رویداد بلوکهٔ ظرفیت را می‌پذیرد و فهرست رزروها را می‌بیند", async () => {
  const { call } = makeApi();
  const posted = await call("POST", "/api/mfg/integration/cmms/events", { userId: "u-mfg-eng", body: capacityEvent({ action: "requested" }) });
  assert.equal(posted.statusCode, 200);
  assert.equal(posted.body.data.applied.reservedMinutes, 240);

  const blocks = await call("GET", "/api/mfg/integration/cmms/capacity-blocks", { userId: "u-mfg-eng", query: { workCenterId: "WC-100" } });
  assert.equal(blocks.statusCode, 200);
  assert.equal(blocks.body.data.total, 1);
  assert.equal(blocks.body.data.blocks[0].ReservedMinutes, 240);
  assert.equal(blocks.body.data.blocks[0].IsOpen, false);

  const availability = await call("GET", "/api/mfg/integration/cmms/availability", {
    userId: "u-mfg-eng",
    query: { workCenterId: "WC-100", from: "2026-11-01T00:00:00.000Z", to: "2026-11-02T00:00:00.000Z" },
  });
  assert.equal(availability.statusCode, 200);
  /* توقف برنامه‌ریزی‌شده از زمان تولید کم می‌شود — دسترس‌پذیری ۱۰۰٪ می‌ماند. */
  assert.equal(availability.body.data.plannedDowntimeMinutes, 240);
  assert.equal(availability.body.data.plannedProductionMinutes, 240);
  assert.equal(availability.body.data.availabilityPct, 100);
  /* GET با شناسهٔ نامعتبر ۴۰۰ می‌گیرد. */
  const badQuery = await call("GET", "/api/mfg/integration/cmms/capacity-blocks", { userId: "u-mfg-eng", query: { workCenterId: "" } });
  assert.equal(badQuery.statusCode, 400);
});

test("ثبت مسیرها مخزن تابعی (قرارداد server/index.js) را می‌پذیرد و ورودی ناقص را رد می‌کند", () => {
  const handlers = new Map();
  const app = Object.fromEntries(["get", "post"].map((method) => [
    method, (path, handler) => handlers.set(`${method.toUpperCase()} ${path}`, handler),
  ]));
  const repo = makeRepo();
  /* سرور واقعی، repository را به‌صورت تابع می‌دهد تا وابستگی حلقه‌ای نسازد. */
  assert.doesNotThrow(() => registerMesCmmsBridgeRoutes(app, { repo: () => repo, subjects: DEMO_SUBJECTS, evaluate }));
  assert.throws(() => registerMesCmmsBridgeRoutes(app, { repo: null, subjects: DEMO_SUBJECTS, evaluate }), TypeError);
  assert.throws(() => registerMesCmmsBridgeRoutes(app, { repo, subjects: DEMO_SUBJECTS }), TypeError);
  assert.throws(() => registerMesCmmsBridgeRoutes(null, { repo, subjects: DEMO_SUBJECTS, evaluate }), TypeError);
});
