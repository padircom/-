/**
 * زیرساخت مشترک آزمون‌های IIoT & DAS.
 * ═══════════════════════════════════════════════════════════════════════
 * سه چیز را یکجا می‌دهد تا پنج فایل آزمون، سه نسخهٔ واگرا از آن نسازند:
 *
 *   • `makeRepo()`  — مخزن درون‌حافظه‌ای با همان قرارداد
 *                     `createRepository()` در `server/persistence/driver.mjs`
 *                     (create/get/findOne/list/count/patch/remove/transaction
 *                     با کنترل هم‌زمانی خوش‌بینانه).
 *   • `makeApi()`   — ثبت مسیرها روی یک app شبیه‌سازی‌شده و فراخوان
 *                     `call(method, path, …)`.
 *   • `seedRig()`   — دکل نمونه با گیت‌وی، جریان و کانال‌های واقعی حفاری
 *                     (WOB/RPM/گشتاور/فشار پمپ گل/دما) تا آزمون‌ها روی
 *                     دادهٔ معنادار اجرا شوند نه رشته‌های بی‌معنی.
 *
 * RBAC واقعی است: `evaluate` و `subjectPermissions` از `rbacLogic.js`
 * می‌آیند، نه یک تقلب محلی. پس اگر ماتریس مجوز در accessControl.ts عوض شود،
 * این آزمون‌ها هم عوض می‌شوند — همان چیزی که «آزمون مسیر واقعی است» یعنی.
 */
import assert from "node:assert/strict";
import { registerIiotRoutes } from "./iiotApi.js";
import { DEMO_SUBJECTS, evaluate, subjectPermissions } from "./rbacLogic.js";

export const RIG = "RIG-DEMO";
export const OTHER_RIG = "RIG-OTHER";
export const ROOT = "/api/iiot/rigs/:rigId";

/** نقش‌های IIoT. ماتریس مجوزشان در accessControl.ts تعریف شده و
 * server/rbac.test.mjs ناوردایی‌هایش را قفل می‌کند. */
export const ENGINEER = "u-iiot-eng";
export const SUPERVISOR = "u-iiot-driller";
export const TECH = "u-iiot-tech";
/** کاربر نت — عمداً خارج از دامنهٔ دکل، تا نشت دسترسی آزموده شود. */
export const CMMS_MANAGER = "u-cmms-manager";

export function makeRepo() {
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
    if (w.op === "neq") return actual !== w.value;
    return actual === w.value;
  });
  /* درایور واقعی SQL، کپی برمی‌گرداند نه ارجاع زنده. اگر اینجا ارجاع زنده
   * بدهیم، آزمون می‌تواند «تغییر نکردن یک رکورد» را اشتباهی پاس کند — پس
   * همهٔ خواندن‌ها کپی عمیق می‌دهند. */
  const clone = (row) => (row ? structuredClone(row) : row);
  const repo = {
    tables,
    async create(table, data, userId = "system") {
      const row = { ...data, Id: data.Id ?? `${table}-${next++}`, CreatedAt: new Date().toISOString(), CreatedBy: userId, RowVersion: 1 };
      rows(table).push(row);
      return clone(row);
    },
    async get(table, id) { return clone(rows(table).find((row) => row.Id === id) ?? null); },
    async findOne(table, where) { return clone(rows(table).find((row) => matches(row, where)) ?? null); },
    async list(table, spec = {}) {
      let out = rows(table).filter((row) => matches(row, spec.where));
      for (const order of [...(spec.orderBy ?? [])].reverse()) {
        out = [...out].sort((a, b) => {
          const cmp = a[order.column] === b[order.column] ? 0 : a[order.column] < b[order.column] ? -1 : 1;
          return order.dir === "desc" ? -cmp : cmp;
        });
      }
      const offset = spec.offset ?? 0;
      return out.slice(offset, spec.limit === undefined ? undefined : offset + spec.limit).map(clone);
    },
    async count(table, where = []) { return rows(table).filter((row) => matches(row, where)).length; },
    async patch(table, id, data, userId, expectedRowVersion) {
      const row = rows(table).find((item) => item.Id === id);
      if (!row) return { affected: 0, ok: false, code: "NOT_FOUND" };
      if (expectedRowVersion !== undefined && row.RowVersion !== expectedRowVersion) {
        return { affected: 0, ok: false, code: "CONCURRENCY_CONFLICT" };
      }
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

/**
 * فروشگاه سری زمانی درون‌حافظه‌ای برای آزمون — نه خودِ درایور تولید، بلکه
 * همان قرارداد. `iiot.timeseries.test.mjs` درایورهای واقعی را جدا می‌آزماید.
 */
export function makeFakeTimeSeries() {
  const points = [];
  return {
    driver: "memory-test",
    points,
    async write(list) { points.push(...(Array.isArray(list) ? list : [list])); return { ok: true, accepted: 1 }; },
    async query({ rigId, channelCode, from, to, limit } = {}) {
      let out = points.filter((p) => p.rigId === rigId && (!channelCode || p.channelCode === channelCode));
      if (from) out = out.filter((p) => p.at >= from);
      if (to) out = out.filter((p) => p.at <= to);
      out = [...out].sort((a, b) => a.at.localeCompare(b.at));
      return { points: limit ? out.slice(-limit) : out, buckets: [], total: out.length };
    },
    async latest({ rigId, channelCodes = [] } = {}) {
      const out = [];
      for (const code of channelCodes) {
        const rows = points.filter((p) => p.rigId === rigId && p.channelCode === code).sort((a, b) => a.at.localeCompare(b.at));
        if (rows.length) {
          const last = rows[rows.length - 1];
          out.push({ channelCode: code, at: last.at, value: last.value, quality: last.quality, signalType: last.signalType });
        }
      }
      return { latest: out };
    },
    async health() { return { ok: true, driver: "memory-test" }; },
  };
}

/**
 * ثبت مسیرها و ساخت فراخوان.
 * `now` تزریق می‌شود تا پایداری زمانی و دورهٔ سکوت با ساعت ثابت آزموده شوند.
 */
export function makeApi({ transport = null, timeSeries = null, now = null, subjects = DEMO_SUBJECTS } = {}) {
  const handlers = new Map();
  const app = Object.fromEntries(["get", "post", "patch", "delete"].map((method) => [
    method, (path, handler) => handlers.set(`${method.toUpperCase()} ${path}`, handler),
  ]));
  const repo = makeRepo();
  registerIiotRoutes(app, {
    repo,
    subjects,
    evaluate,
    subjectPermissions,
    timeSeries,
    integrationTransport: transport,
    now,
  });
  const call = async (method, path, { params = {}, query = {}, body = {}, headers = {}, requestId = "iiot-test" } = {}) => {
    const handler = handlers.get(`${method.toUpperCase()} ${path}`);
    assert.ok(handler, `مسیر ثبت نشده است: ${method} ${path}`);
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
  return { repo, handlers, call };
}

/** فراخوانی موفق با هویت پیش‌فرض مهندس IIoT. */
export async function ok(call, method, path, opts = {}) {
  const res = await call(method, path, { ...opts, headers: { "x-user-id": opts.as ?? ENGINEER, ...(opts.headers ?? {}) } });
  assert.equal(res.statusCode, opts.expect ?? 200, JSON.stringify(res.body?.error ?? res.body));
  return res.body?.data;
}

/** فراخوانی ناموفق — کد خطا برمی‌گرداند. */
export async function fail(call, method, path, status, code, opts = {}) {
  const res = await call(method, path, { ...opts, headers: { "x-user-id": opts.as ?? ENGINEER, ...(opts.headers ?? {}) } });
  assert.equal(res.statusCode, status, `انتظار ${status} بود، شد ${res.statusCode}: ${JSON.stringify(res.body)}`);
  if (code) assert.equal(res.body?.error?.code, code);
  return res.body?.error;
}

const iso = (offsetSeconds) => new Date(Date.parse("2026-03-10T06:00:00Z") + offsetSeconds * 1000).toISOString();

/**
 * دکل نمونه با زیرساخت کامل. `at` مبنای زمان است تا آزمون‌ها روی محور زمانی
 * ثابت اجرا شوند.
 */
export async function seedRig(repo, { rigId = RIG, withRules = true, actor = "seed" } = {}) {
  const rig = await repo.create("IotDrillingRig", {
    RigId: rigId, RigNo: "RIG-91", NameFa: "دکل ۹۱ آزادگان جنوبی", RigType: "land",
    Status: "drilling", NominalSampleRateHz: 1, TimeZoneId: "Asia/Tehran",
    CmmsSiteRef: "SITE-DEMO", PmisProjectRef: "c1-p1", MesWorkCenterRef: "WC-DRILL-01",
    IsActive: true,
  }, actor);

  const gateway = await repo.create("IotEdgeGateway", {
    RigId: rigId, GatewayCode: "GW-01", NameFa: "گیت‌وی لبهٔ دکل ۹۱", Protocol: "mqtt",
    SyncMode: "store-forward", BufferCapacity: 10000, BufferUsed: 0, MaxBatchSize: 500,
    MaxAttempts: 3, ConnectionState: "offline", InstalledAt: iso(0), IsActive: true,
  }, actor);

  const stream = await repo.create("IotDrillingRigStream", {
    RigId: rigId, StreamCode: "MUDLOG-01", NameFa: "جریان مادلاگر", SourceSystem: "mudlogger",
    GatewayId: gateway.Id, TransportProtocol: "mqtt", SampleRateHz: 1, BatchSize: 100,
    ConnectionState: "offline", IsActive: true,
  }, actor);

  const channelSpecs = [
    { code: "CH-WOB", signal: "wob", unit: "klbf", name: "وزن روی مته", display: [0, 60] },
    { code: "CH-RPM", signal: "rpm", unit: "rpm", name: "دور مته", display: [0, 200] },
    { code: "CH-TORQUE", signal: "torque", unit: "kft.lbf", name: "گشتاور رشته", display: [0, 40], critical: true },
    { code: "CH-SPP", signal: "mud-pump-pressure", unit: "psi", name: "فشار پمپ گل", display: [0, 5000], critical: true },
    { code: "CH-TEMP", signal: "temperature", unit: "C", name: "دمای یاتاقان", display: [0, 150], critical: true },
    { code: "CH-VIB", signal: "vibration", unit: "mm/s", name: "ارتعاش پمپ", display: [0, 30] },
  ];
  const channels = {};
  for (const spec of channelSpecs) {
    channels[spec.code] = await repo.create("IotDasChannel", {
      RigId: rigId, StreamId: stream.Id, ChannelCode: spec.code, NameFa: spec.name,
      SignalType: spec.signal, Unit: spec.unit, SampleRateHz: 1,
      FilterMethod: "sma", FilterWindowSeconds: 5, DeadbandPct: 0.5,
      DisplayMin: spec.display[0], DisplayMax: spec.display[1],
      IsCritical: spec.critical === true, IsActive: true, ModelVersion: "iiot-v1",
    }, actor);
  }

  const rules = {};
  if (withRules) {
    /* آستانهٔ بحرانی دما: ۳۰ ثانیه پایداری و ۵ نمونه — ضد هشدار کاذب. */
    rules.tempCritical = await repo.create("IotThresholdRule", {
      RigId: rigId, ChannelId: channels["CH-TEMP"].Id, RuleCode: "TR-TEMP-HH",
      NameFa: "دمای بحرانی یاتاقان", Level: "critical", DetectKind: "threshold", Comparison: "gt",
      ThresholdValue: 120, DurationSeconds: 20, MinSamples: 5, HysteresisPct: 5,
      CooldownSeconds: 300, AutoDispatch: true, DispatchTargets: "cmms,mes,pmis",
      CmmsSiteRef: "SITE-DEMO", CmmsAssetRef: null, CmmsPriority: 1,
      MesWorkCenterRef: "WC-DRILL-01", PmisProjectRef: "c1-p1", NptCode: "NPT-1.1",
      Version: 1, IsActive: true, ModelVersion: "iiot-v1",
    }, actor);
    /* آستانهٔ هشدار گشتاور — فقط اطلاع‌رسانی، بدون ارسال خودکار. */
    rules.torqueWarning = await repo.create("IotThresholdRule", {
      RigId: rigId, ChannelId: channels["CH-TORQUE"].Id, RuleCode: "TR-TORQ-H",
      NameFa: "گشتاور بالا", Level: "warning", DetectKind: "threshold", Comparison: "gt",
      ThresholdValue: 28, DurationSeconds: 15, MinSamples: 4, CooldownSeconds: 300,
      AutoDispatch: false, Version: 1, IsActive: true, ModelVersion: "iiot-v1",
    }, actor);
    rules.stickSlip = await repo.create("IotThresholdRule", {
      RigId: rigId, ChannelId: channels["CH-TORQUE"].Id, RuleCode: "TR-STICKSLIP",
      NameFa: "تشخیص Stick-Slip", Level: "critical", DetectKind: "stick-slip", Comparison: "gt",
      TorqueCvThreshold: 10, RpmSwingPctThreshold: 15, MinSamples: 6, DurationSeconds: 5,
      CooldownSeconds: 300, AutoDispatch: false, Version: 1, IsActive: true, ModelVersion: "iiot-v1",
    }, actor);
    rules.pumpDrop = await repo.create("IotThresholdRule", {
      RigId: rigId, ChannelId: channels["CH-SPP"].Id, RuleCode: "TR-SPP-DROP",
      NameFa: "افت فشار پمپ گل", Level: "critical", DetectKind: "pump-drop", Comparison: "lt",
      PressureDropPctThreshold: 15, MinSamples: 6, DurationSeconds: 5,
      CooldownSeconds: 300, AutoDispatch: false, Version: 1, IsActive: true, ModelVersion: "iiot-v1",
    }, actor);
  }

  return { rig, gateway, stream, channels, rules };
}

/** ساخت سری نمونه با فاصلهٔ زمانی ثابت. */
export function series(channelCode, values, { startOffsetSeconds = 0, stepSeconds = 1, at = iso } = {}) {
  return values.map((value, i) => ({
    channelCode,
    at: at(startOffsetSeconds + i * stepSeconds),
    value,
    quality: "good",
    seqNo: i + 1,
  }));
}

export { iso };
