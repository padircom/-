/**
 * آزمون REST ماژول IIoT & DAS (iiot-api-v1).
 * ═══════════════════════════════════════════════════════════════════════
 * مسیرها روی یک app شبیه‌سازی‌شده ثبت می‌شوند (همان الگوی `cmms.rest.test.mjs`)
 * ولی RBAC واقعی است: `evaluate`/`subjectPermissions` از `rbacLogic.js` می‌آیند.
 * پس اگر ماتریس مجوز در accessControl.ts عوض شود، این آزمون هم عوض می‌شود.
 *
 * ساعت تزریق می‌شود (`now`) تا «پایداری زمانی»، «دورهٔ سکوت» و «هیسترزیس»
 * با محور زمانی ثابت آزموده شوند — نه وابسته به لحظهٔ اجرای آزمون.
 *
 * تفکیک نقش‌ها (منبع حقیقت: accessControl.ts):
 *   مهندس تله‌متری  → پیکربندی، پذیرش نمونه، همگام‌سازی بافر
 *   سرپرست حفاری    → تأیید/رفع/ارسال هشدار، راستی‌آزمایی NPT، ارسال یکپارچگی
 *   تکنسین میدان    → پذیرش نمونه، سنسور و کالیبراسیون
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_SUBJECTS } from "./rbacLogic.js";
import { IIOT_API_VERSION, IIOT_IMPLEMENTED_ROUTES } from "./iiotApi.js";
import {
  CMMS_MANAGER,
  ENGINEER,
  OTHER_RIG,
  RIG,
  ROOT,
  SUPERVISOR,
  TECH,
  fail,
  iso,
  makeApi,
  makeFakeTimeSeries,
  ok,
  seedRig,
  series,
} from "./iiotTestFixtures.mjs";

/** مهندس دکل دیگر — همان نقش، ولی دامنهٔ دکلش فرق دارد (آزمون نشت دسترسی). */
const OUT_OF_SCOPE = {
  id: "u-iiot-other", displayName: "مهندس دکل دیگر (آزمایشی)", roles: ["iiot_engineer"],
  projectIds: ["*"], plantIds: [OTHER_RIG], active: true, party: "contractor",
};
/** در دامنهٔ دکل است ولی هیچ نقش IIoT ندارد — برای تفکیک ۴۰۳ مجوز از ۴۰۳ دامنه. */
const IN_SCOPE_NO_ROLE = {
  id: "u-viewer-inplant", displayName: "کاربر تنها‌بیننده (آزمایشی)", roles: ["viewer"],
  projectIds: ["*"], plantIds: [RIG], active: true, party: "employer",
};
/** دامنهٔ همهٔ دکل‌ها — برای آزمودن ۴۰۴ واقعی. */
const ALL_RIGS = {
  id: "u-iiot-allrigs", displayName: "مهندس ستاد (آزمایشی)", roles: ["iiot_engineer"],
  projectIds: ["*"], plantIds: ["*"], active: true, party: "employer",
};
const SUBJECTS = [...DEMO_SUBJECTS, OUT_OF_SCOPE, IN_SCOPE_NO_ROLE, ALL_RIGS];

/** ساعت قابل پیش‌رفتن. */
function clock(start = 0) {
  let seconds = start;
  return {
    get at() { return seconds; },
    set(value) { seconds = value; },
    advance(delta) { seconds += delta; },
    iso: () => iso(seconds),
  };
}

/** حمل‌ونقل یکپارچگی ساختگی: فراخوان‌ها را ثبت و نتیجه را برمی‌گرداند. */
function transport({ okResult = true, throws = false } = {}) {
  const calls = [];
  return {
    calls,
    async deliver(envelope) {
      calls.push(envelope);
      if (throws) throw new Error("CMMS در دسترس نیست");
      return okResult
        ? { ok: true, ref: `ack-${envelope.targetSystem}-${calls.length}` }
        : { ok: false, code: "E-IIOT-BRIDGE-REJECTED", messageFa: "مقصد نپذیرفت" };
    },
  };
}

/** محیط آزمون: دکل نمونه + ساعت + حمل‌ونقل + موتور سری زمانی. */
async function setup({ withRules = true, ts = true, transport: transportOpts = null, start = 0 } = {}) {
  const clk = clock(start);
  const bus = transportOpts ? transport(transportOpts) : null;
  const timeSeries = ts ? makeFakeTimeSeries() : null;
  const api = makeApi({ subjects: SUBJECTS, now: () => clk.iso(), timeSeries, transport: bus });
  const seeded = await seedRig(api.repo, { withRules });
  return { ...api, clk, timeSeries, bus, ...seeded };
}

/** پذیرش نمونه. `as` هویت است و هر چیز دیگر، بدنهٔ درخواست. */
async function ingest(env, samples, opts = {}) {
  const { as, ...body } = opts;
  return ok(env.call, "POST", `${ROOT}/telemetry`, {
    params: { rigId: RIG }, body: { samples, ...body }, as, expect: 202,
  });
}

const P = { rigId: RIG };

/* ═══════════════════ الف) سطح API و RBAC ═══════════════════ */

test("سطح API: هر ۴۸ مسیر اعلام‌شده واقعاً ثبت می‌شوند", async () => {
  const { handlers } = await setup();
  assert.equal(IIOT_IMPLEMENTED_ROUTES.length, 48);
  for (const route of IIOT_IMPLEMENTED_ROUTES) {
    assert.ok(handlers.has(route), `مسیر ثبت نشده است: ${route}`);
  }
  const extra = [...handlers.keys()].filter((key) => !IIOT_IMPLEMENTED_ROUTES.includes(key));
  assert.deepEqual(extra, [], "مسیر ثبت‌شده ولی اعلام‌نشده وجود دارد");
  assert.ok(IIOT_IMPLEMENTED_ROUTES.every((route) => route.includes(" /api/iiot/")), "همهٔ مسیرها باید زیر /api/iiot باشند");
});

test("RBAC: بدون هویت، ۴۰۱ است نه ۵۰۰", async () => {
  const env = await setup();
  await fail(env.call, "GET", ROOT, 401, "IIOT_AUTH_REQUIRED", { params: P, headers: { "x-user-id": "" } });
  await fail(env.call, "GET", "/api/iiot/rigs", 401, "IIOT_AUTH_REQUIRED", { headers: { "x-user-id": "u-nobody" } });
});

test("RBAC: کاربر بیرون از دامنهٔ دکل، ۴۰۳ دامنه می‌گیرد — نه داده", async () => {
  const env = await setup();
  const err = await fail(env.call, "GET", ROOT, 403, "IIOT_RIG_SCOPE_DENIED", { params: P, as: OUT_OF_SCOPE.id });
  assert.equal(err.permission, "iiot.rig.view");
  assert.equal(err.reason, "DENY_PLANT_SCOPE");
  await fail(env.call, "POST", `${ROOT}/telemetry`, 403, "IIOT_RIG_SCOPE_DENIED", {
    params: P, as: OUT_OF_SCOPE.id, body: { samples: series("CH-TEMP", [10]) },
  });
});

test("RBAC: کاربر درون‌دامنه ولی بی‌نقش، ۴۰۳ مجوز می‌گیرد", async () => {
  const env = await setup();
  const err = await fail(env.call, "GET", `${ROOT}/dashboard`, 403, "IIOT_FORBIDDEN", { params: P, as: IN_SCOPE_NO_ROLE.id });
  assert.equal(err.reason, "DENY_NO_PERMISSION");
  /* و مدیر نت از بیرون دامنه، همان ۴۰۳ دامنه را می‌گیرد. */
  await fail(env.call, "GET", `${ROOT}/dashboard`, 403, "IIOT_RIG_SCOPE_DENIED", { params: P, as: CMMS_MANAGER });
});

test("RBAC: تکنسین می‌بیند و نمونه می‌فرستد، ولی پیکربندی را ویرایش نمی‌کند", async () => {
  const env = await setup();
  const dash = await ok(env.call, "GET", `${ROOT}/dashboard`, { params: P, as: TECH });
  assert.equal(dash.rig.RigId, RIG);
  await fail(env.call, "PATCH", ROOT, 403, "IIOT_FORBIDDEN", { params: P, as: TECH, body: { NameFa: "تغییر غیرمجاز" } });
  await fail(env.call, "POST", `${ROOT}/threshold-rules`, 403, "IIOT_FORBIDDEN", {
    params: P, as: TECH,
    body: { RuleCode: "TR-X", ChannelId: env.channels["CH-TEMP"].Id, NameFa: "x", Level: "critical", ThresholdValue: 100 },
  });
  const data = await ingest(env, series("CH-TEMP", [90]), { as: TECH });
  assert.equal(data.accepted, 1, "پذیرش نمونه در نقش تکنسین است");
});

test("RBAC: مهندس پیکربندی می‌کند ولی هشدار تأیید نمی‌کند", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  const { alerts } = await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  const alertId = alerts.created[0].Id;
  await fail(env.call, "POST", `${ROOT}/alerts/:alertId/acknowledge`, 403, "IIOT_FORBIDDEN", { params: { ...P, alertId }, as: ENGINEER, body: {} });
  await fail(env.call, "POST", `${ROOT}/integration/events/:eventId/dispatch`, 403, "IIOT_FORBIDDEN", {
    params: { ...P, eventId: "IotIntegrationEvent-1" }, as: ENGINEER, body: {},
  });
});

test("RBAC: شناسهٔ دکل نامعتبر، ۴۰۰ است", async () => {
  const env = await setup();
  for (const rigId of ["", "  ", "RIG DEMO", "a".repeat(80), "../etc"]) {
    await fail(env.call, "GET", ROOT, 400, "IIOT_BAD_RIG_ID", { params: { rigId } });
  }
});

test("RBAC: دکل ناشناخته برای کاربر ستادی، ۴۰۴ است", async () => {
  const env = await setup();
  await fail(env.call, "GET", ROOT, 404, "IIOT_NOT_FOUND", { params: { rigId: OTHER_RIG }, as: ALL_RIGS.id });
});

test("فهرست دکل‌ها بر پایهٔ دامنهٔ کاربر فیلتر می‌شود", async () => {
  const env = await setup();
  await seedRig(env.repo, { rigId: OTHER_RIG });
  const mine = await ok(env.call, "GET", "/api/iiot/rigs", { as: ENGINEER });
  assert.deepEqual(mine.rigs.map((r) => r.RigId), [RIG]);
  const theirs = await ok(env.call, "GET", "/api/iiot/rigs", { as: OUT_OF_SCOPE.id });
  assert.deepEqual(theirs.rigs.map((r) => r.RigId), [OTHER_RIG]);
  const all = await ok(env.call, "GET", "/api/iiot/rigs", { as: ALL_RIGS.id });
  assert.equal(all.total, 2, "کاربر ستادی هر دو دکل را می‌بیند");
});

test("پوشش پاسخ: نسخهٔ API، traceId و درایور سری زمانی اعلام می‌شود", async () => {
  const env = await setup();
  const res = await env.call("GET", `${ROOT}/dashboard`, { params: P, headers: { "x-user-id": ENGINEER }, requestId: "req-123" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.meta.version, IIOT_API_VERSION);
  assert.equal(res.body.meta.traceId, "req-123");
  assert.equal(res.body.meta.tsDriver, "memory-test");
});

test("پوشش پاسخ: بدون موتور سری زمانی، صریحاً sql-only اعلام می‌شود", async () => {
  const env = await setup({ ts: false });
  const res = await env.call("GET", `${ROOT}/dashboard`, { params: P, headers: { "x-user-id": ENGINEER } });
  assert.equal(res.body.meta.tsDriver, "sql-only");
});

/* ═══════════════════ ب) دکل ═══════════════════ */

test("دکل: ثبت با ارجاع نرم به CMMS/MES/PMIS — بدون کلید خارجی", async () => {
  const env = await setup();
  const rig = await ok(env.call, "POST", "/api/iiot/rigs", {
    expect: 201,
    body: {
      RigId: "RIG-NEW", RigNo: "RIG-92", NameFa: "دکل ۹۲ یادآوران", RigType: "land",
      Status: "mobilizing", CmmsSiteRef: "SITE-DEMO", PmisProjectRef: "c1-p2",
      MesWorkCenterRef: "WC-DRILL-02", NominalSampleRateHz: 1, TimeZoneId: "Asia/Tehran",
    },
  });
  assert.equal(rig.RigId, "RIG-NEW");
  assert.equal(rig.CmmsSiteRef, "SITE-DEMO");
  assert.equal(rig.PmisProjectRef, "c1-p2");
  /* ارجاع‌ها اعتبارسنجی خارجی نمی‌شوند — چون کلید خارجی نیستند. */
  const loose = await ok(env.call, "POST", "/api/iiot/rigs", {
    expect: 201,
    body: { RigId: "RIG-SOFT", RigNo: "RIG-94", NameFa: "ارجاع نرم", RigType: "land", Status: "drilling", CmmsSiteRef: "SITE-ناموجود" },
  });
  assert.equal(loose.CmmsSiteRef, "SITE-ناموجود");
});

test("دکل: شناسه یا شمارهٔ تکراری، ۴۰۹ می‌دهد", async () => {
  const env = await setup();
  await fail(env.call, "POST", "/api/iiot/rigs", 409, "IIOT_DUPLICATE", {
    body: { RigId: RIG, RigNo: "RIG-99", NameFa: "تکراری", RigType: "land", Status: "drilling" },
  });
  await fail(env.call, "POST", "/api/iiot/rigs", 409, "IIOT_DUPLICATE", {
    body: { RigId: "RIG-NEW", RigNo: "RIG-91", NameFa: "شمارهٔ تکراری", RigType: "land", Status: "drilling" },
  });
});

test("دکل: فیلد ناشناخته، مقدار اجباری و نوع نامعتبر، ۴۰۰ است", async () => {
  const env = await setup();
  /* فیلد بیرونی — همان چیزی که مرز ماژول را می‌شکند. */
  await fail(env.call, "POST", "/api/iiot/rigs", 400, "IIOT_VALIDATION_FAILED", {
    body: { RigId: "RIG-X", RigNo: "RIG-93", NameFa: "x", RigType: "land", Status: "drilling", AssetId: "SQL-FK" },
  });
  await fail(env.call, "POST", "/api/iiot/rigs", 400, "IIOT_VALIDATION_FAILED", { body: { RigId: "RIG-X" } });
  await fail(env.call, "POST", "/api/iiot/rigs", 400, "IIOT_VALIDATION_FAILED", {
    body: { RigId: "RIG-X", RigNo: "RIG-93", NameFa: "x", RigType: "submarine", Status: "drilling" },
  });
});

test("دکل: ویرایش با کنترل هم‌زمانی خوش‌بینانه", async () => {
  const env = await setup();
  const { rig } = await ok(env.call, "GET", ROOT, { params: P });
  const patched = await ok(env.call, "PATCH", ROOT, {
    params: P, body: { Status: "tripping", CurrentDepthM: 3120.5, RowVersion: rig.RowVersion },
  });
  assert.equal(patched.Status, "tripping");
  assert.equal(Number(patched.CurrentDepthM), 3120.5);
  assert.equal(patched.RowVersion, rig.RowVersion + 1);
  await fail(env.call, "PATCH", ROOT, 409, "IIOT_CONCURRENCY_CONFLICT", {
    params: P, body: { Status: "cementing", RowVersion: rig.RowVersion },
  });
});

/* ═══════════════════ پ) جریان و کانال ═══════════════════ */

test("جریان: فهرست، ثبت و ویرایش", async () => {
  const env = await setup();
  const list = await ok(env.call, "GET", `${ROOT}/streams`, { params: P });
  assert.equal(list.total, 1);
  const created = await ok(env.call, "POST", `${ROOT}/streams`, {
    params: P, expect: 201,
    body: { StreamCode: "WITSML-01", NameFa: "جریان WITSML", SourceSystem: "witsml", TransportProtocol: "witsml", SampleRateHz: 2 },
  });
  assert.equal(created.StreamCode, "WITSML-01");
  const patched = await ok(env.call, "PATCH", `${ROOT}/streams/:streamId`, {
    params: { ...P, streamId: created.Id }, body: { ConnectionState: "online", RowVersion: created.RowVersion },
  });
  assert.equal(patched.ConnectionState, "online");
  /* پروتکل بیرون از فهرست بسته پذیرفته نمی‌شود. */
  await fail(env.call, "POST", `${ROOT}/streams`, 400, "IIOT_VALIDATION_FAILED", {
    params: P, body: { StreamCode: "S-BAD", NameFa: "بد", SourceSystem: "witsml", TransportProtocol: "tcp" },
  });
});

test("کانال: شش کمیت حفاری با پیکربندی فیلتر خوانده می‌شوند", async () => {
  const env = await setup();
  const list = await ok(env.call, "GET", `${ROOT}/channels`, { params: P });
  assert.deepEqual(list.channels.map((c) => c.ChannelCode), ["CH-RPM", "CH-SPP", "CH-TEMP", "CH-TORQUE", "CH-VIB", "CH-WOB"]);
  const temp = list.channels.find((c) => c.ChannelCode === "CH-TEMP");
  assert.equal(temp.SignalType, "temperature");
  assert.equal(temp.FilterMethod, "sma");
  assert.equal(temp.FilterWindowSeconds, 5);
  const onlyTemp = await ok(env.call, "GET", `${ROOT}/channels`, { params: P, query: { signalType: "temperature" } });
  assert.equal(onlyTemp.total, 1);
  await fail(env.call, "GET", `${ROOT}/channels`, 400, "IIOT_VALIDATION_FAILED", { params: P, query: { drop: "table" } });
});

test("کانال: ثبت، تکراری و محدودهٔ نمایش نامعتبر", async () => {
  const env = await setup();
  const created = await ok(env.call, "POST", `${ROOT}/channels`, {
    params: P, expect: 201,
    body: {
      ChannelCode: "CH-FLOW", StreamId: env.stream.Id, NameFa: "دبی خروجی", SignalType: "flow-rate",
      Unit: "gpm", SampleRateHz: 1, FilterMethod: "median", FilterWindowSeconds: 7,
      DisplayMin: 0, DisplayMax: 1200, IsCritical: false,
    },
  });
  assert.equal(created.SignalType, "flow-rate");
  await fail(env.call, "POST", `${ROOT}/channels`, 409, "IIOT_DUPLICATE", {
    params: P, body: { ChannelCode: "CH-FLOW", NameFa: "تکراری", SignalType: "flow-rate", Unit: "gpm", SampleRateHz: 1 },
  });
  await fail(env.call, "POST", `${ROOT}/channels`, 400, "IIOT_VALIDATION_FAILED", {
    params: P,
    body: { ChannelCode: "CH-BAD", NameFa: "بد", SignalType: "flow-rate", Unit: "gpm", SampleRateHz: 1, DisplayMin: 100, DisplayMax: 50 },
  });
  await fail(env.call, "POST", `${ROOT}/channels`, 400, "IIOT_VALIDATION_FAILED", {
    params: P, body: { ChannelCode: "CH-BAD2", NameFa: "بد", SignalType: "telepathy", Unit: "-", SampleRateHz: 1 },
  });
});

test("کانال: ویرایش پنجرهٔ فیلتر — منبع واحد داشبورد و موتور تشخیص", async () => {
  const env = await setup();
  const patched = await ok(env.call, "PATCH", `${ROOT}/channels/:channelId`, {
    params: { ...P, channelId: env.channels["CH-TEMP"].Id },
    body: { FilterMethod: "ema", FilterWindowSeconds: 15, DeadbandPct: 2, RowVersion: env.channels["CH-TEMP"].RowVersion },
  });
  assert.equal(patched.FilterMethod, "ema");
  assert.equal(patched.FilterWindowSeconds, 15);
  const single = await ok(env.call, "GET", `${ROOT}/channels/:channelId`, { params: { ...P, channelId: env.channels["CH-TEMP"].Id } });
  assert.equal(single.channel.FilterMethod, "ema");
});

/* ═══════════════════ ت) پذیرش تله‌متری ═══════════════════ */

test("پذیرش: نمونه‌ها در موتور سری زمانی و جدول نمونه نوشته می‌شوند", async () => {
  const env = await setup();
  const data = await ingest(env, series("CH-TEMP", [80, 82, 84, 86, 88]));
  assert.equal(data.accepted, 5);
  assert.equal(data.rejected.length, 0);
  assert.equal(data.tsDriver, "memory-test");
  assert.equal(env.timeSeries.points.length, 5);
  assert.equal(env.timeSeries.points[0].signalType, "temperature");
  const rows = await env.repo.list("IotTelemetrySample", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(rows.length, 5);
  assert.equal(rows[0].Unit, "C");
  assert.equal(rows[0].Source, "live");
  /* پنجرهٔ ۵ ثانیه‌ای: چهار نمونهٔ نخست هنوز در دورهٔ گرم‌شدن فیلترند. */
  assert.equal(rows[0].FilteredValue, null);
  assert.ok(rows[rows.length - 1].FilteredValue !== null, "مقدار فیلترشده کنار مقدار خام می‌نشیند");
  assert.equal(data.rollups, 1);
  const rollups = await env.repo.list("IotTelemetryRollup", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(rollups.length, 1);
  assert.equal(rollups[0].ModelVersion, "iiot-v1");
  assert.equal(rollups[0].SampleCount, 5);
});

test("پذیرش: ارسال تدریجی یک دقیقه، سطل را جمع می‌زند نه جایگزین", async () => {
  const env = await setup();
  await ingest(env, series("CH-TEMP", [80, 82], { startOffsetSeconds: 0 }), { evaluateRules: false });
  await ingest(env, series("CH-TEMP", [84, 86], { startOffsetSeconds: 2 }), { evaluateRules: false });
  const rollups = await env.repo.list("IotTelemetryRollup", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(rollups.length, 1, "یک سطل دقیقه‌ای");
  assert.equal(rollups[0].SampleCount, 4, "چهار نمونه در همان سطل جمع شده‌اند");
  assert.equal(Number(rollups[0].LastValue), 86);
});

test("پذیرش: آخرین مقدار کانال و وضعیت جریان به‌روز می‌شود", async () => {
  const env = await setup();
  await ingest(env, series("CH-TEMP", [80, 90]));
  const channel = await env.repo.get("IotDasChannel", env.channels["CH-TEMP"].Id);
  assert.equal(Number(channel.LastValue), 90);
  assert.equal(channel.LastQuality, "good");
  const stream = await env.repo.get("IotDrillingRigStream", env.stream.Id);
  assert.equal(stream.ConnectionState, "online");
  assert.equal(Number(stream.QualityPct), 100);
});

test("پذیرش: نمونهٔ بی‌کیفیت، جریان را «degraded» می‌کند", async () => {
  const env = await setup();
  const samples = [
    { channelCode: "CH-TEMP", at: iso(0), value: 80, quality: "good" },
    { channelCode: "CH-TEMP", at: iso(1), value: 81, quality: "bad" },
    { channelCode: "CH-TEMP", at: iso(2), value: 82, quality: "bad" },
    { channelCode: "CH-TEMP", at: iso(3), value: 83, quality: "bad" },
    { channelCode: "CH-TEMP", at: iso(4), value: 84, quality: "bad" },
  ];
  await ingest(env, samples);
  const stream = await env.repo.get("IotDrillingRigStream", env.stream.Id);
  assert.equal(stream.ConnectionState, "degraded", "۲۰٪ کیفیت خوب، جریان سالم نیست");
  assert.equal(Number(stream.QualityPct), 20);
});

test("پذیرش: نمونه‌های خراب رد می‌شوند ولی درخواست نمی‌شکند", async () => {
  const env = await setup();
  const samples = [
    ...series("CH-TEMP", [80]),
    { channelCode: "CH-NOPE", at: iso(1), value: 1 },
    { channelCode: "CH-TEMP", at: "نه-زمان", value: 2 },
    { channelCode: "CH-TEMP", at: iso(3), value: "abc" },
    null,
  ];
  const data = await ingest(env, samples);
  assert.equal(data.accepted, 1);
  assert.deepEqual(data.rejected.map((r) => r.code).sort(), [
    "E-IIOT-BAD-TIME", "E-IIOT-BAD-VALUE", "E-IIOT-SAMPLE-MALFORMED", "E-IIOT-UNKNOWN-CHANNEL",
  ]);
  assert.deepEqual(data.unknownChannels, ["CH-NOPE"]);
});

test("پذیرش: همهٔ نمونه‌ها نامعتبر → ۴۲۲ با فهرست ردشدگان", async () => {
  const env = await setup();
  const err = await fail(env.call, "POST", `${ROOT}/telemetry`, 422, "IIOT_NO_VALID_SAMPLES", {
    params: P, body: { samples: [{ channelCode: "CH-NOPE", at: iso(1), value: 1 }] },
  });
  assert.deepEqual(err.unknownChannels, ["CH-NOPE"]);
  assert.equal(err.rejected.length, 1);
});

test("پذیرش: کانال غیرفعال، داده نمی‌گیرد", async () => {
  const env = await setup();
  await env.repo.patch("IotDasChannel", env.channels["CH-VIB"].Id, { IsActive: false }, "test", env.channels["CH-VIB"].RowVersion);
  const err = await fail(env.call, "POST", `${ROOT}/telemetry`, 422, "IIOT_NO_VALID_SAMPLES", {
    params: P, body: { samples: series("CH-VIB", [1, 2, 3]) },
  });
  assert.deepEqual(err.rejected.map((r) => r.code), ["E-IIOT-CHANNEL-INACTIVE", "E-IIOT-CHANNEL-INACTIVE", "E-IIOT-CHANNEL-INACTIVE"]);
});

test("پذیرش: آرایهٔ خالی یا بیش از سقف، ۴۰۰ است", async () => {
  const env = await setup();
  await fail(env.call, "POST", `${ROOT}/telemetry`, 400, "IIOT_VALIDATION_FAILED", { params: P, body: { samples: [] } });
  await fail(env.call, "POST", `${ROOT}/telemetry`, 400, "IIOT_VALIDATION_FAILED", { params: P, body: { samples: "نه-آرایه" } });
  const huge = Array.from({ length: 5001 }, (_, i) => ({ channelCode: "CH-TEMP", at: iso(i), value: 1 }));
  await fail(env.call, "POST", `${ROOT}/telemetry`, 400, "IIOT_VALIDATION_FAILED", { params: P, body: { samples: huge } });
});

test("پذیرش: persistSamples=false فقط سری زمانی را پر می‌کند", async () => {
  const env = await setup();
  const data = await ingest(env, series("CH-TEMP", [80, 81]), { persistSamples: false, evaluateRules: false });
  assert.equal(data.accepted, 2);
  assert.equal(env.timeSeries.points.length, 2);
  const rows = await env.repo.list("IotTelemetrySample", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(rows.length, 0);
});

test("پذیرش: خطای موتور سری زمانی، پذیرش داده را نمی‌شکند", async () => {
  const env = await setup();
  env.timeSeries.write = async () => { throw new Error("influx down"); };
  const data = await ingest(env, series("CH-TEMP", [80, 81]));
  assert.equal(data.accepted, 2);
  assert.equal(data.timeSeries.ok, false);
  const rows = await env.repo.list("IotTelemetrySample", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(rows.length, 2, "لایهٔ رابطه‌ای هنوز می‌نویسد");
});

test("پذیرش: دکل بدون کانال، ۴۲۲ می‌دهد", async () => {
  const env = await setup();
  for (const channel of Object.values(env.channels)) await env.repo.remove("IotDasChannel", channel.Id);
  await fail(env.call, "POST", `${ROOT}/telemetry`, 422, "IIOT_NO_CHANNELS", { params: P, body: { samples: series("CH-TEMP", [1]) } });
});

test("فیلترینگ: گزارش کیفیت هر کانال در پاسخ پذیرش می‌آید", async () => {
  const env = await setup();
  const data = await ingest(env, series("CH-TEMP", [80, 80, 80, 80, 80, 80]));
  const stat = data.filterStats.find((s) => s.channelCode === "CH-TEMP");
  assert.equal(stat.samples, 6);
  assert.equal(stat.qualityPct, 100);
  assert.equal(stat.good, 6);
});

/* ═══════════════════ ث) آستانه، هشدار و ضد هشدار کاذب ═══════════════════ */

test("آستانه: نقض پایدار بحرانی، هشدار + توقف NPT + ارسال خودکار می‌سازد", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  const data = await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  assert.equal(data.alerts.created.length, 1);
  const alert = data.alerts.created[0];
  assert.equal(alert.Level, "critical");
  assert.equal(alert.Status, "active");
  assert.equal(alert.DetectionKind, "threshold");
  assert.ok(alert.TitleFa.includes("دمای یاتاقان"), `عنوان باید نام کانال داشته باشد: ${alert.TitleFa}`);
  assert.ok(alert.TitleFa.includes("بحرانی"));
  assert.equal(alert.DispatchStatus, "dispatched");
  assert.ok(alert.CmmsWorkOrderRef && alert.MesDowntimeRef && alert.PmisEventRef, "ارجاع سه مقصد باید ثبت شود");

  const events = await env.repo.list("IotIntegrationEvent", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((e) => e.TargetSystem).sort(), ["cmms", "mes", "pmis"]);
  assert.equal(events[0].Status, "dispatched");
  assert.deepEqual(env.bus.calls.map((c) => c.targetSystem).sort(), ["cmms", "mes", "pmis"]);
  const cmmsCall = env.bus.calls.find((c) => c.targetSystem === "cmms");
  assert.equal(cmmsCall.contract, "iiot-cmms-v1");
  assert.equal(cmmsCall.eventType, "alert.critical");
  assert.equal(cmmsCall.payload.level, "critical");
  assert.equal(cmmsCall.payload.channelCode, "CH-TEMP");
  assert.equal(cmmsCall.payload.cmmsSiteRef, "SITE-DEMO", "ارجاع نرم CMMS از قاعده/دکل می‌آید");
  assert.ok(cmmsCall.idempotencyKey.length > 0);

  const downtime = await env.repo.list("IotRigDowntime", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(downtime.length, 1);
  assert.equal(downtime[0].IsNpt, true);
  assert.equal(downtime[0].AlertId, alert.Id);
  assert.equal(downtime[0].NptCode, "NPT-1.1");
  assert.ok(!downtime[0].EndedAt, "تا رفع نشود، باز می‌ماند");
});

test("آستانه: تک‌نمونهٔ گذرا، هشدار نمی‌سازد", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  const data = await ingest(env, [...series("CH-TEMP", Array(20).fill(90)), { channelCode: "CH-TEMP", at: iso(20), value: 190 }]);
  assert.equal(data.alerts.created.length, 0, "نویز لحظه‌ای نباید دکل را متوقف کند");
  assert.equal((await env.repo.list("IotTelemetryAlert", { where: [{ column: "RigId", op: "eq", value: RIG }] })).length, 0);
});

test("آستانه: زیر آستانه، هیچ هشداری نمی‌سازد", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  const data = await ingest(env, series("CH-TEMP", Array(25).fill(119)));
  assert.equal(data.alerts.created.length, 0);
});

test("آستانه: قاعدهٔ غیرفعال ارزیابی نمی‌شود", async () => {
  const env = await setup({ transport: {} });
  await env.repo.patch("IotThresholdRule", env.rules.tempCritical.Id, { IsActive: false }, "test", env.rules.tempCritical.RowVersion);
  env.clk.set(30);
  const data = await ingest(env, series("CH-TEMP", Array(25).fill(140)));
  assert.equal(data.alerts.created.length, 0);
});

test("دورهٔ سکوت: هشدار تکراری روی همان ناهنجاری ساخته نمی‌شود", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  const first = await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  assert.equal(first.alerts.created.length, 1);
  env.clk.set(90);
  const second = await ingest(env, series("CH-TEMP", Array(25).fill(140), { startOffsetSeconds: 40 }));
  assert.equal(second.alerts.created.length, 0);
  assert.equal(second.alerts.suppressed.length, 1);
  assert.equal(second.alerts.suppressed[0].reason, "E-IIOT-COOLDOWN");
  assert.equal((await env.repo.list("IotTelemetryAlert", { where: [{ column: "RigId", op: "eq", value: RIG }] })).length, 1);
});

test("هیسترزیس: بازگشت زیر نوار بازگشت، هشدار و توقف را می‌بندد", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  env.clk.set(400);
  const data = await ingest(env, series("CH-TEMP", Array(10).fill(90), { startOffsetSeconds: 380 }));
  assert.equal(data.alerts.resolved.length, 1);
  const alerts = await env.repo.list("IotTelemetryAlert", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(alerts[0].Status, "resolved");
  assert.equal(alerts[0].ResolvedById, "svc-iiot-auto");
  const downtime = await env.repo.list("IotRigDowntime", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.ok(downtime[0].EndedAt, "توقف با رفع هشدار بسته می‌شود");
  assert.ok(Number(downtime[0].DurationMinutes) > 0);
  /* و بسته‌شدن توقف، به مقصدها خبر می‌دهد. */
  assert.ok(data.alerts.dispatched.some((d) => d.kind === "downtime.closed" || d.kind === "alert.resolved"));
});

test("هیسترزیس: مقدار بین آستانه و نوار بازگشت، هشدار را باز نگه می‌دارد", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  env.clk.set(400);
  const data = await ingest(env, series("CH-TEMP", Array(10).fill(118), { startOffsetSeconds: 380 }));
  assert.equal(data.alerts.resolved.length, 0);
  const alerts = await env.repo.list("IotTelemetryAlert", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(alerts[0].Status, "active");
});

test("Stick-Slip: با دادهٔ گشتاور و دور، تشخیص داده می‌شود", async () => {
  const env = await setup();
  const torque = [12, 26, 10, 28, 9, 27, 11, 29, 10, 26, 12, 28];
  const rpm = [110, 45, 115, 40, 108, 42, 118, 38, 112, 44, 109, 41];
  env.clk.set(30);
  const data = await ingest(env, [...series("CH-TORQUE", torque), ...series("CH-RPM", rpm)]);
  const created = data.alerts.created.filter((a) => a.DetectionKind === "stick-slip");
  assert.equal(created.length, 1);
  assert.equal(created[0].Level, "critical");
  assert.ok(created[0].TitleFa.includes("Stick-Slip"));
  assert.equal(created[0].MetricsJson.stickSlip.detected, true, "شاخص‌های تشخیص باید در هشدار بمانند");
});

test("Stick-Slip: گشتاور نوسانی با دور ثابت، هشدار نمی‌سازد", async () => {
  const env = await setup();
  env.clk.set(30);
  const data = await ingest(env, [
    ...series("CH-TORQUE", [12, 26, 10, 28, 9, 27, 11, 29, 10, 26, 12, 28]),
    ...series("CH-RPM", Array(12).fill(110)),
  ]);
  assert.equal(data.alerts.created.filter((a) => a.DetectionKind === "stick-slip").length, 0);
});

test("افت فشار پمپ: افت پایدار نسبت به خط مبنا، بحرانی است", async () => {
  const env = await setup();
  const pressure = [...Array(12).fill(3000), ...Array(8).fill(2100)];
  env.clk.set(30);
  const data = await ingest(env, series("CH-SPP", pressure));
  const created = data.alerts.created.filter((a) => a.DetectionKind === "pump-drop");
  assert.equal(created.length, 1);
  assert.equal(created[0].MetricsJson.pumpDrop.detected, true);
});

test("افت فشار پمپ: فشار پایدار، هشداری نمی‌سازد", async () => {
  const env = await setup();
  env.clk.set(30);
  const data = await ingest(env, series("CH-SPP", Array(20).fill(3000)));
  assert.equal(data.alerts.created.filter((a) => a.DetectionKind === "pump-drop").length, 0);
});

test("قاعده: ثبت آستانهٔ تازه و اجرای آن روی دادهٔ جاری", async () => {
  const env = await setup();
  const rule = await ok(env.call, "POST", `${ROOT}/threshold-rules`, {
    params: P, expect: 201,
    body: {
      RuleCode: "TR-VIB-H", ChannelId: env.channels["CH-VIB"].Id, NameFa: "ارتعاش بالا",
      Level: "warning", DetectKind: "threshold", Comparison: "gt", ThresholdValue: 18,
      DurationSeconds: 5, MinSamples: 5, HysteresisPct: 10, CooldownSeconds: 600, AutoDispatch: false,
    },
  });
  assert.equal(rule.RuleCode, "TR-VIB-H");
  env.clk.set(20);
  const data = await ingest(env, series("CH-VIB", Array(12).fill(24)));
  const created = data.alerts.created.find((a) => a.RuleId === rule.Id);
  assert.ok(created, "قاعدهٔ تازه باید روی دادهٔ جاری اجرا شود");
  assert.equal(created.Level, "warning");
  const downtime = await env.repo.list("IotRigDowntime", { where: [{ column: "AlertId", op: "eq", value: created.Id }] });
  assert.equal(downtime.length, 0, "هشدار غیربحرانی، توقف NPT نمی‌سازد");
});

test("قاعده: ارسال خودکار بدون مقصد، پذیرفته نمی‌شود", async () => {
  const env = await setup();
  await fail(env.call, "POST", `${ROOT}/threshold-rules`, 400, "IIOT_VALIDATION_FAILED", {
    params: P,
    body: { RuleCode: "TR-BAD", ChannelId: env.channels["CH-TEMP"].Id, NameFa: "بدون مقصد", Level: "critical", ThresholdValue: 100, AutoDispatch: true },
  });
  await fail(env.call, "POST", `${ROOT}/threshold-rules`, 400, "IIOT_VALIDATION_FAILED", {
    params: P,
    body: {
      RuleCode: "TR-BAD2", ChannelId: env.channels["CH-TEMP"].Id, NameFa: "مقصد ناشناخته",
      Level: "critical", ThresholdValue: 100, AutoDispatch: true, DispatchTargets: "cmms,sap",
    },
  });
  await fail(env.call, "POST", `${ROOT}/threshold-rules`, 404, "IIOT_NOT_FOUND", {
    params: P,
    body: { RuleCode: "TR-BAD3", ChannelId: "IotDasChannel-999", NameFa: "کانال غریبه", Level: "critical", ThresholdValue: 100 },
  });
});

test("قاعده: آزمون خشک، نتیجه را می‌دهد بدون اینکه هشدار بسازد", async () => {
  const env = await setup();
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", Array(25).fill(135)), { evaluateRules: false });
  const result = await ok(env.call, "POST", `${ROOT}/threshold-rules/:ruleId/test`, {
    params: { ...P, ruleId: env.rules.tempCritical.Id }, body: { lookbackSeconds: 120, dryRun: true },
  });
  assert.equal(result.dryRun, true);
  assert.equal(result.verdict.breach, true);
  assert.equal(result.verdict.sustained, true);
  assert.equal(result.wouldAlert, true);
  assert.equal(result.sampleCount, 25);
  assert.equal((await env.repo.list("IotTelemetryAlert", { where: [{ column: "RigId", op: "eq", value: RIG }] })).length, 0);
});

test("قاعده: ویرایش آستانه، نسخه را بالا می‌برد", async () => {
  const env = await setup();
  const patched = await ok(env.call, "PATCH", `${ROOT}/threshold-rules/:ruleId`, {
    params: { ...P, ruleId: env.rules.tempCritical.Id },
    body: { ThresholdValue: 125, DurationSeconds: 30, RowVersion: env.rules.tempCritical.RowVersion },
  });
  assert.equal(Number(patched.ThresholdValue), 125);
  assert.equal(patched.Version, 2, "تغییر آستانه باید نسخه‌دار باشد");
  const list = await ok(env.call, "GET", `${ROOT}/threshold-rules`, { params: P });
  assert.equal(list.total, 4);
});

test("قاعدهٔ فیلتر: ثبت، فهرست و رد سیگنال ناشناخته", async () => {
  const env = await setup();
  const rule = await ok(env.call, "POST", `${ROOT}/filter-rules`, {
    params: P, expect: 201,
    body: {
      RuleCode: "FLT-VIB", NameFa: "هموارسازی ارتعاش", AppliesToSignals: "vibration,torque",
      FilterMethod: "median", WindowSeconds: 9, MinSamples: 3, SpikeZThreshold: 4, FlatlineSeconds: 45,
    },
  });
  assert.equal(rule.FilterMethod, "median");
  const list = await ok(env.call, "GET", `${ROOT}/filter-rules`, { params: P });
  assert.equal(list.total, 1);
  await fail(env.call, "POST", `${ROOT}/filter-rules`, 400, "IIOT_VALIDATION_FAILED", {
    params: P, body: { RuleCode: "FLT-BAD", NameFa: "بد", AppliesToSignals: "telepathy", FilterMethod: "sma", WindowSeconds: 5 },
  });
});

/* ═══════════════════ ج) چرخهٔ عمر هشدار ═══════════════════ */

test("هشدار: تأیید، رفع و ثبت هشدار کاذب — فقط سرپرست", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  const { alerts } = await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  const alertId = alerts.created[0].Id;

  const acked = await ok(env.call, "POST", `${ROOT}/alerts/:alertId/acknowledge`, {
    params: { ...P, alertId }, as: SUPERVISOR, body: { NoteFa: "اپراتور در حال بررسی" },
  });
  assert.equal(acked.Status, "acknowledged");
  assert.equal(acked.AcknowledgedById, SUPERVISOR);
  assert.ok(acked.AcknowledgedAt);

  const resolved = await ok(env.call, "POST", `${ROOT}/alerts/:alertId/resolve`, {
    params: { ...P, alertId }, as: SUPERVISOR, body: { ResolutionNoteFa: "خنک‌کاری یاتاقان انجام شد" },
  });
  assert.equal(resolved.alert.Status, "resolved");
  assert.ok(resolved.alert.ResolvedAt);

  env.clk.set(500);
  const second = await ingest(env, series("CH-TEMP", Array(25).fill(136), { startOffsetSeconds: 470 }));
  const secondId = second.alerts.created[0].Id;
  const suppressed = await ok(env.call, "POST", `${ROOT}/alerts/:alertId/false-positive`, {
    params: { ...P, alertId: secondId }, as: SUPERVISOR, body: { SuppressedReasonFa: "سنسور کالیبره نبود" },
  });
  assert.equal(suppressed.alert.Status, "false-positive");
});

test("هشدار: تکنسین می‌بیند ولی تأیید یا رفع نمی‌کند", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  const { alerts } = await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  const alertId = alerts.created[0].Id;
  await fail(env.call, "POST", `${ROOT}/alerts/:alertId/acknowledge`, 403, "IIOT_FORBIDDEN", { params: { ...P, alertId }, as: TECH, body: {} });
  await fail(env.call, "POST", `${ROOT}/alerts/:alertId/resolve`, 403, "IIOT_FORBIDDEN", { params: { ...P, alertId }, as: TECH, body: {} });
  const list = await ok(env.call, "GET", `${ROOT}/alerts`, { params: P, as: TECH });
  assert.equal(list.total, 1);
});

test("هشدار: فیلتر بر پایهٔ وضعیت و سطح", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  const critical = await ok(env.call, "GET", `${ROOT}/alerts`, { params: P, query: { level: "critical", status: "active" } });
  assert.equal(critical.total, 1);
  const warning = await ok(env.call, "GET", `${ROOT}/alerts`, { params: P, query: { level: "warning" } });
  assert.equal(warning.total, 0);
});

test("هشدار: ارسال دستی با مقصد دلخواه و ضدتکرار", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  const data = await ingest(env, series("CH-TORQUE", Array(20).fill(33)));
  const torqueAlert = data.alerts.created.find((a) => a.RuleId === env.rules.torqueWarning.Id);
  assert.ok(torqueAlert, "هشدار گشتاور باید ساخته شود");
  assert.equal(torqueAlert.DispatchStatus, "none");

  const result = await ok(env.call, "POST", `${ROOT}/alerts/:alertId/dispatch`, {
    params: { ...P, alertId: torqueAlert.Id }, as: SUPERVISOR, body: { targets: "cmms,pmis" },
  });
  assert.deepEqual(result.results.map((r) => r.target).sort(), ["cmms", "pmis"]);
  assert.equal(result.delivered, 2);

  const again = await ok(env.call, "POST", `${ROOT}/alerts/:alertId/dispatch`, {
    params: { ...P, alertId: torqueAlert.Id }, as: SUPERVISOR, body: { targets: "cmms" },
  });
  assert.equal(again.results[0].duplicated, true);
  const events = await env.repo.list("IotIntegrationEvent", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(events.length, 2, "فقط cmms و pmis — بدون رکورد تکراری");
});

/* ═══════════════════ چ) خواندن سری، گیج و rollup ═══════════════════ */

test("سری: خواندن با بازه، سطل‌بندی و کوچک‌سازی", async () => {
  const env = await setup();
  env.clk.set(120);
  await ingest(env, series("CH-TEMP", Array.from({ length: 90 }, (_, i) => 80 + i)), { evaluateRules: false });
  const data = await ok(env.call, "GET", `${ROOT}/telemetry`, {
    params: P, query: { channelCode: "CH-TEMP", from: iso(0), to: iso(90), bucketSeconds: 30 },
  });
  assert.equal(data.total, 90);
  assert.equal(data.points.length, 90);
  assert.equal(data.buckets.length, 3);
  assert.equal(data.buckets[0].sampleCount, 30);

  const chart = await ok(env.call, "GET", `${ROOT}/telemetry`, {
    params: P, query: { channelCode: "CH-TEMP", from: iso(0), to: iso(90), limit: 10, downsample: true },
  });
  assert.equal(chart.points.length, 10, "نمودار به ۱۰ نقطه کوچک می‌شود");
  assert.ok(chart.points.every((p) => p.max >= p.min), "min/max اسپایک را نگه می‌دارد");
});

test("سری: آخرین مقدار هر کانال برای گیج‌ها، با رنگ و تازگی", async () => {
  const env = await setup();
  env.clk.set(60);
  await ingest(env, [...series("CH-TEMP", [80, 95]), ...series("CH-WOB", [30])], { evaluateRules: false });
  const data = await ok(env.call, "GET", `${ROOT}/telemetry/latest`, { params: P });
  const temp = data.channels.find((c) => c.channelCode === "CH-TEMP");
  assert.equal(Number(temp.value), 95);
  assert.equal(temp.unit, "C");
  assert.equal(temp.status, "normal");
  const wob = data.channels.find((c) => c.channelCode === "CH-WOB");
  assert.equal(Number(wob.value), 30);
  /* کانال بی‌داده، مقدار null دارد نه صفر. */
  const vib = data.channels.find((c) => c.channelCode === "CH-VIB");
  assert.equal(vib.value, null);
});

test("rollup: ساخت دستی سطل‌ها از جدول نمونه", async () => {
  const env = await setup();
  env.clk.set(120);
  await ingest(env, series("CH-TEMP", Array.from({ length: 60 }, (_, i) => 80 + i)), { evaluateRules: false });
  const data = await ok(env.call, "POST", `${ROOT}/telemetry/rollups`, {
    params: P, body: { channelId: env.channels["CH-TEMP"].Id, from: iso(0), to: iso(120), bucketSeconds: 60 },
  });
  assert.equal(data.samples, 60);
  assert.equal(data.bucketSeconds, 60);
  assert.ok(data.buckets.length >= 1);
  assert.equal(data.buckets[0].SampleCount, 60, "همهٔ ۶۰ نمونه در یک سطل دقیقه‌ای");
});

/* ═══════════════════ خ) گیت‌وی و Store-and-Forward ═══════════════════ */

test("گیت‌وی: ثبت، ضربان قلب و به‌روزرسانی وضعیت لینک", async () => {
  const env = await setup();
  const gateway = await ok(env.call, "POST", `${ROOT}/gateways`, {
    params: P, expect: 201,
    body: {
      GatewayCode: "GW-02", NameFa: "گیت‌وی پشتیبان", Protocol: "modbus", SyncMode: "store-forward",
      BufferCapacity: 5000, MaxBatchSize: 200, MaxAttempts: 3, HeartbeatIntervalSeconds: 30,
    },
  });
  assert.equal(gateway.GatewayCode, "GW-02");
  const beat = await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/heartbeat`, {
    params: { ...P, gatewayId: gateway.Id }, body: { connectionState: "online", bufferUsed: 120, firmwareVersion: "2.4.1" },
  });
  assert.equal(beat.ConnectionState, "online");
  assert.equal(Number(beat.BufferUsed), 120);
  assert.ok(beat.LastHeartbeatAt);
  const list = await ok(env.call, "GET", `${ROOT}/gateways`, { params: P });
  assert.equal(list.total, 2);
});

test("بافر لبه: دستهٔ لبه راستی‌آزمایی، درج و «sent» می‌شود", async () => {
  const env = await setup();
  const samples = series("CH-TEMP", [95, 96, 97, 98, 99], { startOffsetSeconds: 10 });
  const data = await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, {
    params: { ...P, gatewayId: env.gateway.Id }, expect: 202,
    body: { batchNo: "BUF-GW-01-001", capturedAt: iso(15), samples, connectivityState: "online" },
  });
  assert.equal(data.duplicated, false);
  assert.equal(data.status, "sent");
  assert.equal(data.ingest.accepted, 5);
  assert.ok(data.checksum.startsWith("fnv1a-"));
  const rows = await env.repo.list("IotTelemetrySample", { where: [{ column: "BufferId", op: "eq", value: data.bufferId }] });
  assert.equal(rows.length, 5, "نمونه‌ها با ارجاع به بافر نوشته می‌شوند — زنجیرهٔ اثبات");
  assert.equal(rows[0].BatchNo, "BUF-GW-01-001");
  assert.equal(rows[0].Source, "buffer");
  const gateway = await env.repo.get("IotEdgeGateway", env.gateway.Id);
  assert.ok(gateway.LastSyncAt, "زمان آخرین همگام‌سازی ثبت می‌شود");
});

test("بافر لبه: شمارهٔ دسته از خودِ داده ساخته می‌شود (deterministic)", async () => {
  const env = await setup();
  const samples = series("CH-TEMP", [95, 96], { startOffsetSeconds: 10 });
  const data = await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, {
    params: { ...P, gatewayId: env.gateway.Id }, expect: 202,
    body: { capturedAt: iso(15), samples, connectivityState: "online" },
  });
  assert.equal(data.batchNo, "BUF-GW-01-2026-03-10T06-00-15-000Z");
  assert.ok(data.batchNo.startsWith("BUF-GW-01-"));
});

test("بافر لبه: چک‌سام نادرست، دسته را نمی‌پذیرد", async () => {
  const env = await setup();
  const samples = series("CH-TEMP", [95, 96], { startOffsetSeconds: 10 });
  await fail(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, 422, "E-IIOT-BATCH-CHECKSUM", {
    params: { ...P, gatewayId: env.gateway.Id },
    body: { batchNo: "BUF-BAD", capturedAt: iso(15), samples, checksum: "fnv1a-deadbeef", connectivityState: "online" },
  });
  assert.equal((await env.repo.list("IotGatewayBuffer", { where: [{ column: "RigId", op: "eq", value: RIG }] })).length, 0);
});

test("بافر لبه: ارسال دوبارهٔ دستهٔ تحویل‌شده، داده را دو برابر نمی‌کند", async () => {
  const env = await setup();
  const samples = series("CH-TEMP", [95, 96, 97], { startOffsetSeconds: 10 });
  const body = { batchNo: "BUF-DUP", capturedAt: iso(15), samples, connectivityState: "online" };
  const first = await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, { params: { ...P, gatewayId: env.gateway.Id }, expect: 202, body });
  const second = await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, { params: { ...P, gatewayId: env.gateway.Id }, expect: 202, body });
  assert.equal(second.duplicated, true);
  assert.equal(second.bufferId, first.bufferId);
  assert.equal(second.accepted, 0);
  const rows = await env.repo.list("IotTelemetrySample", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(rows.length, 3, "سه نمونه، نه شش تا");
});

test("بافر لبه: دستهٔ پردازش‌نشده buffered می‌ماند و با تلاش دوباره پردازش می‌شود", async () => {
  const env = await setup();
  /* کانال در لحظهٔ ارسال غیرفعال است → پردازش ناموفق، ولی رد بافر ساخته شده. */
  await env.repo.patch("IotDasChannel", env.channels["CH-TEMP"].Id, { IsActive: false }, "test", env.channels["CH-TEMP"].RowVersion);
  const samples = series("CH-TEMP", [95, 96], { startOffsetSeconds: 10 });
  const body = { batchNo: "BUF-RETRY", capturedAt: iso(15), samples, connectivityState: "online" };
  await fail(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, 422, "IIOT_NO_VALID_SAMPLES", {
    params: { ...P, gatewayId: env.gateway.Id }, body,
  });
  const pending = await ok(env.call, "GET", `${ROOT}/gateways/:gatewayId/buffer`, {
    params: { ...P, gatewayId: env.gateway.Id }, query: { status: "buffered" },
  });
  assert.equal(pending.total, 1, "داده در لبه/بافر می‌ماند — گم نمی‌شود");
  assert.equal(pending.counts.buffered, 1);
  assert.deepEqual(pending.readyToSync.map((b) => b.id), [pending.buffer[0].Id]);

  /* کانال دوباره فعال می‌شود و گیت‌وی همان دسته را می‌فرستد. */
  const row = await env.repo.get("IotDasChannel", env.channels["CH-TEMP"].Id);
  await env.repo.patch("IotDasChannel", row.Id, { IsActive: true }, "test", row.RowVersion);
  const retried = await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, {
    params: { ...P, gatewayId: env.gateway.Id }, expect: 202, body,
  });
  assert.equal(retried.retried, true);
  assert.equal(retried.status, "sent");
  assert.equal(retried.ingest.accepted, 2);
  const rows = await env.repo.list("IotTelemetrySample", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(rows.length, 2, "دقیقاً یک بار درج می‌شود");
});

test("همگام‌سازی: تحویل موفق، دسته را «sent» می‌کند", async () => {
  const env = await setup();
  /* رد بافری که پردازش نشده — همان پنجرهٔ بازیابی پس از خطای پردازش. */
  await env.repo.patch("IotDasChannel", env.channels["CH-TEMP"].Id, { IsActive: false }, "test", env.channels["CH-TEMP"].RowVersion);
  const samples = series("CH-TEMP", [95, 96], { startOffsetSeconds: 10 });
  await fail(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, 422, "IIOT_NO_VALID_SAMPLES", {
    params: { ...P, gatewayId: env.gateway.Id }, body: { batchNo: "BUF-SYNC", capturedAt: iso(15), samples, connectivityState: "online" },
  });
  const pending = await ok(env.call, "GET", `${ROOT}/gateways/:gatewayId/buffer`, { params: { ...P, gatewayId: env.gateway.Id } });
  const bufferId = pending.buffer[0].Id;
  const synced = await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer/:bufferId/sync`, {
    params: { ...P, gatewayId: env.gateway.Id, bufferId }, as: TECH, body: { delivered: true, ackRef: "ack-77" },
  });
  assert.equal(synced.buffer.Status, "sent");
  assert.equal(synced.buffer.AckRef, "ack-77");
  assert.equal(Number(synced.buffer.Attempts), 1);
});

test("همگام‌سازی: شکست پیاپی به نامهٔ مرده می‌رسد — داده گم نمی‌شود", async () => {
  const env = await setup();
  await env.repo.patch("IotDasChannel", env.channels["CH-TEMP"].Id, { IsActive: false }, "test", env.channels["CH-TEMP"].RowVersion);
  const samples = series("CH-TEMP", [95], { startOffsetSeconds: 10 });
  await fail(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, 422, "IIOT_NO_VALID_SAMPLES", {
    params: { ...P, gatewayId: env.gateway.Id }, body: { batchNo: "BUF-DEAD", capturedAt: iso(15), samples, connectivityState: "online" },
  });
  const pending = await ok(env.call, "GET", `${ROOT}/gateways/:gatewayId/buffer`, { params: { ...P, gatewayId: env.gateway.Id } });
  const bufferId = pending.buffer[0].Id;
  const path = `${ROOT}/gateways/:gatewayId/buffer/:bufferId/sync`;
  const params = { ...P, gatewayId: env.gateway.Id, bufferId };
  let rowVersion = pending.buffer[0].RowVersion;
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    last = await ok(env.call, "POST", path, {
      params, body: { delivered: false, errorCode: "E-IIOT-BRIDGE-REJECTED", errorFa: "مقصد نپذیرفت", RowVersion: rowVersion },
    });
    rowVersion = last.buffer.RowVersion;
  }
  assert.equal(last.buffer.Status, "dead-letter", "پس از MaxAttempts=3، نامهٔ مرده");
  assert.equal(Number(last.buffer.Attempts), 3);
  assert.equal(last.buffer.ErrorCode, "E-IIOT-BRIDGE-REJECTED");
  const row = await env.repo.get("IotGatewayBuffer", bufferId);
  assert.equal(row.PayloadJson.samples.length, 1, "بار داده همچنان برای بررسی دستی باقی است");
});

/* ═══════════════════ د) سنسور و پایش وضعیت ═══════════════════ */

test("سنسور: ثبت توسط مهندس، کالیبراسیون توسط تکنسین", async () => {
  const env = await setup();
  const sensor = await ok(env.call, "POST", `${ROOT}/sensors`, {
    params: P, expect: 201,
    body: {
      SensorTag: "TT-1001", NameFa: "دماسنج یاتاقان پمپ گل", SensorType: "temperature",
      Manufacturer: "Endress+Hauser", RangeMin: 0, RangeMax: 200, Unit: "C",
      AccuracyPct: 0.5, GatewayId: env.gateway.Id, CalibrationIntervalDays: 180,
    },
  });
  assert.equal(sensor.SensorTag, "TT-1001");
  /* کالیبراسیون در نقش تکنسین میدان است، نه مهندس. */
  await fail(env.call, "POST", `${ROOT}/sensors/:sensorId/calibration`, 403, "IIOT_FORBIDDEN", {
    params: { ...P, sensorId: sensor.Id }, as: ENGINEER, body: { calibratedAt: iso(0) },
  });
  const calibrated = await ok(env.call, "POST", `${ROOT}/sensors/:sensorId/calibration`, {
    params: { ...P, sensorId: sensor.Id }, as: TECH,
    body: { calibratedAt: iso(0), CertificateNo: "CAL-2026-114", ResultFa: "در محدودهٔ مجاز" },
  });
  /* ۱۸۰ روز پس از ۱۰ مارس ۲۰۲۶. */
  assert.equal(calibrated.nextCalibrationDue, "2026-09-06");
  assert.equal(calibrated.sensor.NextCalibrationDue, "2026-09-06");
  assert.ok(calibrated.sensor.NoteFa.includes("CAL-2026-114"), "گواهی کالیبراسیون در سابقهٔ سنسور می‌نشیند");
  assert.equal(calibrated.sensor.LastCalibratedAt, iso(0));
  const list = await ok(env.call, "GET", `${ROOT}/sensors`, { params: P });
  assert.equal(list.total, 1);
  await fail(env.call, "POST", `${ROOT}/sensors`, 409, "IIOT_DUPLICATE", {
    params: P, body: { SensorTag: "TT-1001", NameFa: "تکراری", SensorType: "temperature", Unit: "C" },
  });
});

test("پایش وضعیت: ثبت تصویر وضعیت با ارجاع نرم به تجهیز CMMS", async () => {
  const env = await setup();
  const snapshot = await ok(env.call, "POST", `${ROOT}/condition-snapshots`, {
    params: P, expect: 201,
    body: {
      CmmsAssetRef: "ASSET-PUMP-01", SensorTag: "VT-2001", ReadingType: "vibration",
      Value: 7.8, Uom: "mm/s", Zone: "B", HealthIndex: 72, TrendDirection: "rising",
      RateOfChange: 0.4, Source: "iiot", NoteFa: "روند صعودی آرام",
    },
  });
  assert.equal(snapshot.CmmsAssetRef, "ASSET-PUMP-01");
  assert.equal(snapshot.MeasuredOn, "2026-03-10");
  const list = await ok(env.call, "GET", `${ROOT}/condition-snapshots`, { params: P, query: { assetRef: "ASSET-PUMP-01" } });
  assert.equal(list.total, 1);
  assert.equal(list.unreported, 1, "تا گزارش به CMMS نرود، «گزارش‌نشده» می‌ماند");
});

/* ═══════════════════ ذ) توقف، NPT و ادعا ═══════════════════ */

test("توقف: ثبت دستی با دسته‌بندی IADC و مسئولیت پیش‌فرض", async () => {
  const env = await setup();
  const downtime = await ok(env.call, "POST", `${ROOT}/downtime`, {
    params: P, expect: 201,
    body: { Category: "weather", CauseFa: "طوفان شن", StartedAt: iso(-7200), EndedAt: iso(-3600), ShiftName: "شیفت الف" },
  });
  assert.equal(downtime.NptCode, "NPT-5.1");
  assert.equal(downtime.ResponsibilityFa, "فورس‌ماژور");
  assert.equal(downtime.IsNpt, true);
  assert.equal(Number(downtime.DurationMinutes), 60);
  assert.equal(downtime.DowntimeCode, "DT-001");
});

test("توقف: باز می‌ماند و با «بستن» مدت واقعی می‌گیرد", async () => {
  const env = await setup();
  const created = await ok(env.call, "POST", `${ROOT}/downtime`, {
    params: P, expect: 201, body: { Category: "equipment", CauseFa: "خرابی پمپ گل", StartedAt: iso(-5400) },
  });
  assert.equal(created.EndedAt, null);
  const closed = await ok(env.call, "POST", `${ROOT}/downtime/:downtimeId/close`, {
    params: { ...P, downtimeId: created.Id }, body: { EndedAt: iso(-1800), CauseFa: "تعویض سیلندر", Category: "equipment" },
  });
  assert.equal(Number(closed.DurationMinutes), 60);
  await fail(env.call, "POST", `${ROOT}/downtime`, 400, "IIOT_VALIDATION_FAILED", {
    params: P, body: { Category: "equipment", CauseFa: "بد", StartedAt: iso(100), EndedAt: iso(50) },
  });
  /* بستن دوباره، پذیرفته نیست. */
  await fail(env.call, "POST", `${ROOT}/downtime/:downtimeId/close`, 422, "IIOT_DOWNTIME_CLOSED", {
    params: { ...P, downtimeId: created.Id }, body: {},
  });
});

test("توقف: راستی‌آزمایی سرپرست، NPT را رسمی و به MES/PMIS ارسال می‌کند", async () => {
  const env = await setup({ transport: {} });
  const created = await ok(env.call, "POST", `${ROOT}/downtime`, {
    params: P, expect: 201, body: { Category: "wellbore", CauseFa: "گیرکردن رشته", StartedAt: iso(-10800), EndedAt: iso(-3600) },
  });
  /* تکنسین اجازهٔ راستی‌آزمایی ندارد. */
  await fail(env.call, "POST", `${ROOT}/downtime/:downtimeId/verify`, 403, "IIOT_FORBIDDEN", {
    params: { ...P, downtimeId: created.Id }, as: TECH, body: {},
  });
  const verified = await ok(env.call, "POST", `${ROOT}/downtime/:downtimeId/verify`, {
    params: { ...P, downtimeId: created.Id }, as: SUPERVISOR, body: { NoteFa: "تأیید شد — مسئولیت کارفرما", dispatch: true },
  });
  assert.equal(verified.downtime.VerifiedById, SUPERVISOR);
  assert.deepEqual(verified.dispatched.map((d) => d.target).sort(), ["mes", "pmis"]);
  const events = await env.repo.list("IotIntegrationEvent", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(events.length, 2);
  assert.equal(events[0].EventType, "downtime.closed");
  /* راستی‌آزمایی دوباره پذیرفته نیست. */
  await fail(env.call, "POST", `${ROOT}/downtime/:downtimeId/verify`, 422, "IIOT_DOWNTIME_VERIFIED", {
    params: { ...P, downtimeId: created.Id }, as: SUPERVISOR, body: {},
  });
});

test("توقف: باز را نمی‌توان راستی‌آزمایی کرد", async () => {
  const env = await setup();
  const created = await ok(env.call, "POST", `${ROOT}/downtime`, {
    params: P, expect: 201, body: { Category: "equipment", CauseFa: "باز", StartedAt: iso(-3600) },
  });
  await fail(env.call, "POST", `${ROOT}/downtime/:downtimeId/verify`, 422, "IIOT_DOWNTIME_OPEN", {
    params: { ...P, downtimeId: created.Id }, as: SUPERVISOR, body: {},
  });
});

test("NPT: جمع‌بندی برای گزارش پیشرفت PMIS و نامزد ادعا", async () => {
  const env = await setup();
  /* ۳۰۰ دقیقه با مسئولیت کارفرما — نامزد ادعا. */
  await ok(env.call, "POST", `${ROOT}/downtime`, {
    params: P, expect: 201, body: { Category: "wellbore", CauseFa: "گیرکردن رشته", StartedAt: iso(-21600), EndedAt: iso(-3600) },
  });
  /* ۶۰ دقیقه با مسئولیت پیمانکار — زیر آستانه و هم تقصیر خود پیمانکار. */
  await ok(env.call, "POST", `${ROOT}/downtime`, {
    params: P, expect: 201, body: { Category: "equipment", CauseFa: "خرابی پمپ", StartedAt: iso(-3600), EndedAt: iso(-1800) },
  });
  await ok(env.call, "POST", `${ROOT}/downtime`, {
    params: P, expect: 201, body: { Category: "cementing", CauseFa: "سیمان‌کاری", StartedAt: iso(-1800), EndedAt: iso(-900) },
  });
  const summary = await ok(env.call, "GET", `${ROOT}/npt/summary`, { params: P });
  /* ۳۰۰ (چاه) + ۳۰ (تجهیز) + ۱۵ (سیمان‌کاری) = ۳۴۵ دقیقه. */
  assert.equal(summary.totalMinutes, 345);
  assert.equal(summary.nptMinutes, 330);
  assert.equal(summary.plannedMinutes, 15);
  assert.equal(summary.modelVersion, "iiot-v1");
  assert.equal(summary.claimThresholdMinutes, 240);
  assert.equal(summary.claimCandidates.length, 1, "فقط توقف با مسئولیت کارفرما و بالای آستانه، نامزد ادعا است");
  assert.equal(summary.claimCandidates[0].nptCode, "NPT-4.1");
  assert.equal(summary.claimCandidates[0].minutes, 300);
  assert.equal(summary.claimCandidates[0].responsibilityFa, "کارفرما");
  /* آستانهٔ بالاتر، نامزدی باقی نمی‌گذارد. */
  const strict = await ok(env.call, "GET", `${ROOT}/npt/summary`, { params: P, query: { claimThresholdMinutes: 600 } });
  assert.equal(strict.claimCandidates.length, 0);
});

/* ═══════════════════ ر) صف یکپارچگی ═══════════════════ */

test("یکپارچگی: رویدادهای صف با وضعیت و مقصد فهرست می‌شوند", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  const events = await ok(env.call, "GET", `${ROOT}/integration/events`, { params: P, query: { status: "dispatched" } });
  assert.equal(events.total, 3);
  assert.ok(events.events.every((e) => e.Contract.startsWith("iiot-")));
  assert.equal(events.transportConfigured, true);
});

test("یکپارچگی: تحویل دوبارهٔ رویداد شکست‌خورده", async () => {
  const env = await setup({ transport: { okResult: false } });
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  const events = await ok(env.call, "GET", `${ROOT}/integration/events`, { params: P, query: { status: "failed" } });
  assert.equal(events.total, 3);
  assert.equal(events.events[0].ErrorCode, "E-IIOT-BRIDGE-REJECTED");
  await fail(env.call, "POST", `${ROOT}/integration/events/:eventId/dispatch`, 422, "E-IIOT-BRIDGE-REJECTED", {
    params: { ...P, eventId: events.events[0].Id }, as: SUPERVISOR, body: {},
  });
  const row = await env.repo.get("IotIntegrationEvent", events.events[0].Id);
  assert.equal(row.Status, "failed");
  assert.equal(Number(row.Attempts), 2, "تلاش دوم شمرده می‌شود");
});

test("یکپارچگی: رویداد تحویل‌شده، دوباره تحویل نمی‌شود", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  const events = await ok(env.call, "GET", `${ROOT}/integration/events`, { params: P });
  const delivered = events.events.find((e) => e.Status === "dispatched");
  await fail(env.call, "POST", `${ROOT}/integration/events/:eventId/dispatch`, 422, "IIOT_EVENT_DELIVERED", {
    params: { ...P, eventId: delivered.Id }, as: SUPERVISOR, body: {},
  });
});

test("یکپارچگی: استثنای حمل‌ونقل، صف را نمی‌شکند", async () => {
  const env = await setup({ transport: { throws: true } });
  env.clk.set(30);
  const data = await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  assert.equal(data.alerts.created.length, 1, "هشدار با وجود خطای حمل‌ونقل ساخته می‌شود");
  assert.equal(data.alerts.created[0].DispatchStatus, "failed");
  const events = await env.repo.list("IotIntegrationEvent", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(events[0].ErrorCode, "E-IIOT-TRANSPORT-EXCEPTION");
});

test("یکپارچگی: بدون حمل‌ونقل، رویداد در صف می‌ماند و گزارش می‌شود", async () => {
  const env = await setup();
  env.clk.set(30);
  const data = await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  assert.equal(data.alerts.created[0].DispatchStatus, "failed");
  const events = await env.repo.list("IotIntegrationEvent", { where: [{ column: "RigId", op: "eq", value: RIG }] });
  assert.equal(events[0].ErrorCode, "E-IIOT-NO-TRANSPORT");
  assert.equal(events[0].Status, "pending", "رویداد برای تحویل بعدی در صف می‌ماند");
  const dash = await ok(env.call, "GET", `${ROOT}/dashboard`, { params: P });
  assert.equal(dash.integration.transportConfigured, false);
  assert.equal(dash.integration.pending, 3);
});

/* ═══════════════════ ز) داشبورد ═══════════════════ */

test("داشبورد: گیج‌ها با رنگ سه‌سطحی و تازگی داده", async () => {
  const env = await setup();
  env.clk.set(30);
  await ingest(env, [...series("CH-TEMP", Array(10).fill(135)), ...series("CH-WOB", Array(10).fill(30))], { evaluateRules: false });
  const dash = await ok(env.call, "GET", `${ROOT}/dashboard`, { params: P });
  assert.equal(dash.rig.RigId, RIG);
  assert.equal(dash.gauges.length, 6);
  const temp = dash.gauges.find((g) => g.channelCode === "CH-TEMP");
  assert.equal(Number(temp.value), 135);
  assert.equal(temp.status, "critical", "دمای ۱۳۵ با آستانهٔ ۱۲۰، قرمز است");
  assert.deepEqual(temp.thresholds.map((t) => t.level), ["critical"]);
  const wob = dash.gauges.find((g) => g.channelCode === "CH-WOB");
  assert.equal(wob.status, "normal");
  assert.equal(dash.statusCounts.critical, 1);
  assert.equal(dash.modelVersion, "iiot-v1");
});

test("داشبورد: سنسور ساکت، سبز نیست", async () => {
  const env = await setup();
  env.clk.set(30);
  await ingest(env, series("CH-VIB", [5]), { evaluateRules: false });
  env.clk.set(700);
  const dash = await ok(env.call, "GET", `${ROOT}/dashboard`, { params: P });
  const vib = dash.gauges.find((g) => g.channelCode === "CH-VIB");
  assert.equal(vib.stale, true);
  assert.equal(vib.status, "warning", "دادهٔ کهنه حداقل زرد است");
});

test("داشبورد: وضعیت Store-and-Forward و صف یکپارچگی دیده می‌شود", async () => {
  const env = await setup({ transport: {} });
  /* دستهٔ بافر، مربوط به پیش از قطعی است — زمانش با نمونه‌های زنده یکی نیست. */
  const samples = series("CH-TEMP", [95, 96], { startOffsetSeconds: -60 });
  await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer`, {
    params: { ...P, gatewayId: env.gateway.Id }, expect: 202,
    body: { batchNo: "BUF-DASH", capturedAt: iso(-55), samples, connectivityState: "online" },
  });
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  const dash = await ok(env.call, "GET", `${ROOT}/dashboard`, { params: P });
  assert.equal(dash.gateways.length, 1);
  assert.equal(dash.gateways[0].code, "GW-01");
  assert.equal(dash.gateways[0].fillPct, 0);
  assert.equal(dash.storeAndForward.connectivityOnline, true, "بارگذاری بافر، لینک را online ثبت می‌کند");
  assert.equal(dash.integration.dispatched, 3);
  assert.equal(dash.alertCounts.critical, 1);
  assert.ok(dash.npt.nptMinutes >= 0);
});

test("داشبورد: هشدارهای باز و NPT در یک نگاه", async () => {
  const env = await setup({ transport: {} });
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", Array(25).fill(135)));
  const dash = await ok(env.call, "GET", `${ROOT}/dashboard`, { params: P });
  assert.equal(dash.activeAlerts.length, 1);
  assert.equal(dash.alertCounts.active, 1);
  assert.ok(dash.npt.openCount >= 1, "توقف بازِ ناشی از هشدار باید دیده شود");
  assert.equal(dash.tsDriver, "memory-test");
});
