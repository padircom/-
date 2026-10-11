/**
 * آزمون داشبورد زندهٔ IIoT & DAS در سطح REST.
 * ═══════════════════════════════════════════════════════════════════════
 * سه چیز را می‌آزماید که آزمون‌های موجود پوشش نمی‌دهند:
 *
 *   ۱) **غنی‌سازی خط فیلترشده.** موتور سری زمانی فقط مقدار خام را نگه
 *      می‌دارد؛ نمودار داشبورد به جفت «خام/فیلترشده» نیاز دارد. پس
 *      `GET /telemetry` باید مقدار فیلترشدهٔ همان مهر زمانی را از لایهٔ
 *      رابطه‌ای بچسباند — و اگر نداشت، `null` بگذارد نه مقدار جعلی.
 *
 *   ۲) **زنجیرهٔ واقعی: خروجی سرور → منطق داشبورد.** همان تابع‌های خالصی
 *      که کامپوننت مصرف می‌کند (`iiotDashboardLogic.js`) روی پاسخ واقعی
 *      سرور اجرا می‌شوند؛ اگر شکل پاسخ عوض شود، این آزمون می‌شکند.
 *
 *   ۳) **گذار بافر تا نامهٔ مرده.** دادهٔ دکل هیچ‌وقت بی‌صدا دور ریخته
 *      نمی‌شود: پس از پایان تلاش‌ها، دسته «dead-letter» می‌شود و داشبورد
 *      باید آن را «نیازمند توجه» نشان دهد.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ENGINEER, RIG, ROOT, SUPERVISOR, TECH, makeApi, makeFakeTimeSeries, ok, seedRig, series, iso } from "./iiotTestFixtures.mjs";
import {
  buildChartGeometry,
  summarizeBufferRows,
  summarizeGaugeStatuses,
  toneForStatus,
} from "./iiotDashboardLogic.js";

const P = { rigId: RIG };

function clock(start = 0) {
  let seconds = start;
  return {
    set(value) { seconds = value; },
    iso: () => iso(seconds),
  };
}

async function setup({ ts = true, withRules = true } = {}) {
  const clk = clock();
  const timeSeries = ts ? makeFakeTimeSeries() : null;
  const api = makeApi({ timeSeries, now: () => clk.iso() });
  const seeded = await seedRig(api.repo, { withRules });
  return { ...api, clk, timeSeries, ...seeded };
}

async function ingest(env, samples, opts = {}) {
  const { as, ...body } = opts;
  return ok(env.call, "POST", `${ROOT}/telemetry`, {
    params: P, body: { samples, ...body }, as, expect: 202,
  });
}

/* ═══════════════════ الف) غنی‌سازی خط فیلترشده ═══════════════════ */

test("سری: مقدار فیلترشده از لایهٔ رابطه‌ای به نقطه‌های موتور سری زمانی می‌چسبد", async () => {
  const env = await setup();
  env.clk.set(120);
  await ingest(env, series("CH-TEMP", Array.from({ length: 90 }, (_, i) => 80 + i)), { evaluateRules: false });

  const data = await ok(env.call, "GET", `${ROOT}/telemetry`, {
    params: P, as: TECH,
    query: { channelId: env.channels["CH-TEMP"].Id, from: iso(0), to: iso(90) },
  });
  assert.equal(data.points.length, 90);
  assert.equal(data.tsDriver, "memory-test", "سری از موتور سری زمانی می‌آید، نه از مسیر SQL");
  assert.ok(data.points.every((p) => p.quality === "good"), "کیفیت نمونه حفظ می‌شود");

  /* پنجرهٔ SMA پنج‌نمونه‌ای: چهار نمونهٔ نخست در دورهٔ گرم‌شدن فیلترند و
   * مقدار فیلترشده ندارند — `null`، نه صفر جعلی. داشبورد باید همین را
   * «خط فیلترشدهٔ تازه شروع‌شده» بخواند، نه نقص داده. */
  const warmup = data.points.filter((p) => p.filtered === null).length;
  assert.equal(warmup, 4, "دورهٔ گرم‌شدن فیلتر، مقدار نمی‌سازد");
  assert.ok(data.points.slice(warmup).every((p) => typeof p.filtered === "number"), "بعد از گرم‌شدن، همه مقدار دارند");

  /* فیلتر روی سری صعودی عقب می‌ماند: آخرین مقدار فیلترشده باید کمتر از
   * آخرین مقدار خام باشد، وگرنه فیلتر واقعاً اعمال نشده است. */
  const last = data.points[data.points.length - 1];
  assert.equal(last.value, 169);
  assert.ok(last.filtered < last.value, `فیلتر خط را دنبال نکرد: ${last.filtered}`);
});

test("سری: کانال بدون نمونهٔ رابطه‌ای، خط فیلترشدهٔ خالی می‌دهد نه خطا", async () => {
  const env = await setup();
  /* نوشتن مستقیم در موتور سری زمانی — یعنی همان حالتی که داده از بازپخش
   * یا گیت‌وی بیرونی رسیده و ردیف رابطه‌ای ندارد. */
  await env.timeSeries.write([
    { rigId: RIG, channelCode: "CH-TEMP", signalType: "temperature", at: iso(10), value: 95, quality: "good" },
    { rigId: RIG, channelCode: "CH-TEMP", signalType: "temperature", at: iso(11), value: 96, quality: "good" },
  ]);
  const data = await ok(env.call, "GET", `${ROOT}/telemetry`, {
    params: P, query: { channelId: env.channels["CH-TEMP"].Id, from: iso(0), to: iso(60) },
  });
  assert.equal(data.points.length, 2);
  assert.ok(data.points.every((p) => p.filtered === null), "نبود فیلتر = null، نه صفر و نه حذف کلید");
  assert.equal(data.channel.code, "CH-TEMP");
  assert.equal(data.channel.unit, "C");
});

test("سری: کوچک‌سازی نمودار، جفت min/max اسپایک را نگه می‌دارد", async () => {
  const env = await setup();
  env.clk.set(120);
  const values = Array.from({ length: 300 }, (_, i) => 100);
  values[250] = 400; /* اسپایک تک‌نمونه‌ای */
  await ingest(env, series("CH-TEMP", values), { evaluateRules: false });
  const chart = await ok(env.call, "GET", `${ROOT}/telemetry`, {
    params: P, query: { channelId: env.channels["CH-TEMP"].Id, from: iso(0), to: iso(300), downsample: true, limit: 500 },
  });
  assert.ok(chart.points.length <= 120, "نمودار به سقف ۱۲۰ نقطهٔ کوچک‌سازی می‌چسبد");
  assert.equal(Math.max(...chart.points.map((p) => p.max)), 400, "اسپایک در کوچک‌سازی گم نمی‌شود");
  assert.equal(Math.min(...chart.points.map((p) => p.min)), 100);
});

/* ═══════════════════ ب) شکل پاسخ ↔ منطق داشبورد ═══════════════════ */

test("داشبورد: گیج‌ها همان کلیدهایی را دارند که کارت‌های زنده می‌خوانند", async () => {
  const env = await setup();
  env.clk.set(30);
  await ingest(env, [...series("CH-TEMP", Array(10).fill(95)), ...series("CH-VIB", Array(10).fill(4))], { evaluateRules: false });

  const dash = await ok(env.call, "GET", `${ROOT}/dashboard`, { params: P, as: TECH });
  assert.equal(dash.rig.RigId, RIG);
  assert.equal(dash.gauges.length, 6);

  for (const gauge of dash.gauges) {
    for (const key of ["channelId", "channelCode", "nameFa", "signalType", "unit", "status", "thresholds", "stale", "isCritical"]) {
      assert.ok(key in gauge, `کلید «${key}» در گیج نیست`);
    }
    assert.ok(["normal", "warning", "critical"].includes(gauge.status), `وضعیت ناشناخته: ${gauge.status}`);
    assert.equal(typeof gauge.stale, "boolean");
    assert.ok(Array.isArray(gauge.thresholds));
    assert.notEqual(toneForStatus(gauge.status), "idle", "وضعیت گیج باید به یکی از سه چراغ نگاشت شود");
  }

  const counts = summarizeGaugeStatuses(dash.gauges);
  assert.equal(counts.ok + counts.warn + counts.danger, 6, "هر گیج در یک رنگ می‌نشیند");
  assert.equal(counts.idle, 0);

  /* کانال بی‌نمونه: مقدار null و چراغ زرد (کهنگی داده) — نه سبز جعلی. */
  const torque = dash.gauges.find((g) => g.channelCode === "CH-TORQUE");
  assert.equal(torque.value, null);
  assert.equal(torque.status, "warning");
  assert.ok(dash.statusCounts.warning >= 1, "کانال بی‌نمونه در شمارش هشدار می‌آید");
});

test("زنجیرهٔ کامل: نقطه‌های سرور، هندسهٔ نمودار را می‌سازند", async () => {
  const env = await setup();
  env.clk.set(60);
  await ingest(env, series("CH-TEMP", Array.from({ length: 30 }, (_, i) => 80 + i)), { evaluateRules: false });

  const data = await ok(env.call, "GET", `${ROOT}/telemetry`, {
    params: P, query: { channelId: env.channels["CH-TEMP"].Id, from: iso(0), to: iso(60) },
  });
  const gauge = (await ok(env.call, "GET", `${ROOT}/dashboard`, { params: P })).gauges.find((g) => g.channelCode === "CH-TEMP");
  assert.ok(gauge);

  const geo = buildChartGeometry(data.points, {
    width: 640, height: 200, displayMin: gauge.displayMin, displayMax: gauge.displayMax,
  });
  assert.equal(geo.empty, false);
  assert.deepEqual(geo.lines.map((l) => l.key), ["raw", "filtered"], "نمودار «خام در برابر فیلترشده» است");
  assert.equal(geo.lines[0].vertices.length, 30, "خط خام همهٔ نمونه‌ها را دارد");
  assert.ok(geo.lines[1].vertices.length > 0 && geo.lines[1].vertices.length <= 30, "خط فیلترشده، بی‌دورهٔ گرم‌شدن");
  const lastFiltered = [...data.points].reverse().find((p) => typeof p.filtered === "number");
  assert.equal(geo.lines[1].vertices[geo.lines[1].vertices.length - 1].value, lastFiltered.filtered);
  for (const line of geo.lines) {
    const xs = line.vertices.map((v) => v.x);
    assert.deepEqual([...xs].sort((a, b) => a - b), xs, "محور زمان صعودی");
    assert.ok(line.vertices.every((v) => Number.isFinite(v.y)));
  }
  assert.ok(geo.rawArea.length > 0);
});

test("داشبورد: بافر و صف یکپارچگی، خوراک پنل‌های عملیاتی را می‌دهند", async () => {
  const env = await setup();
  env.clk.set(30);
  await ingest(env, series("CH-TEMP", [95, 96]), { evaluateRules: false });

  const buffer = await ok(env.call, "GET", `${ROOT}/gateways/:gatewayId/buffer`, { params: { ...P, gatewayId: env.gateway.Id } });
  assert.ok(Array.isArray(buffer.buffer));
  assert.ok(Array.isArray(buffer.readyToSync));
  const bufferSummary = summarizeBufferRows(buffer.buffer);
  assert.equal(bufferSummary.buffered + bufferSummary.failed + bufferSummary.deadLetter + bufferSummary.sent, buffer.buffer.length);
  assert.equal(buffer.counts.buffered, bufferSummary.buffered);

  const events = await ok(env.call, "GET", `${ROOT}/integration/events`, { params: P });
  assert.ok(Array.isArray(events.events));
  assert.equal(typeof events.transportConfigured, "boolean");
  assert.ok(Object.keys(events.counts).length >= 3);
  for (const event of events.events) {
    assert.ok(["pending", "dispatched", "failed", "dead-letter"].includes(event.Status));
    assert.equal(typeof event.IdempotencyKey, "string");
  }
});

/* ═══════════════════ ج) Store-and-Forward: تا نامهٔ مرده ═══════════════════ */

test("بافر: دستهٔ تحویل‌نشده پس از پایان تلاش‌ها «نامهٔ مرده» می‌شود و داشبورد آن را نشان می‌دهد", async () => {
  const env = await setup();
  env.clk.set(60);

  /* دستهٔ لبه با کانال ناشناخته: ساخت دسته موفق است، پذیرش نمونه رد می‌شود. */
  const res = await env.call("POST", `${ROOT}/gateways/:gatewayId/buffer`, {
    params: { ...P, gatewayId: env.gateway.Id },
    headers: { "x-user-id": TECH },
    body: {
      batchNo: "BUF-DL-1", capturedAt: iso(10), connectivityState: "satellite",
      samples: series("CH-UNKNOWN", [1, 2, 3], { startOffsetSeconds: 10 }),
    },
  });
  assert.equal(res.statusCode, 422, JSON.stringify(res.body?.error ?? res.body));

  const before = await ok(env.call, "GET", `${ROOT}/gateways/:gatewayId/buffer`, { params: { ...P, gatewayId: env.gateway.Id } });
  assert.equal(before.buffer.length, 1);
  assert.equal(before.buffer[0].Status, "buffered");
  assert.equal(before.buffer[0].PayloadJson, undefined, "بدنهٔ بافر به کلاینت نمی‌رود");
  const pendingSummary = summarizeBufferRows(before.buffer);
  assert.equal(pendingSummary.buffered, 1);
  assert.equal(pendingSummary.pendingSamples, 3);
  assert.equal(pendingSummary.needsAttention, false, "دستهٔ معلق، هنوز فاجعه نیست");
  assert.equal(before.readyToSync.length, 1, "دستهٔ بافرشدهٔ معلق، آمادهٔ همگام‌سازی است");
  assert.equal(before.readyToSync[0].id, before.buffer[0].Id);

  const bufferId = before.buffer[0].Id;
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    last = await ok(env.call, "POST", `${ROOT}/gateways/:gatewayId/buffer/:bufferId/sync`, {
      params: { ...P, gatewayId: env.gateway.Id, bufferId },
      as: TECH,
      body: { delivered: false, errorCode: "E-NET-01", errorFa: "لینک ماهواره قطع است" },
    });
    /* تلاش‌های پیش از سقف «failed» است و تلاش آخر، دسته را نامهٔ مرده می‌کند. */
    assert.equal(last.transition.code, attempt < 3 ? "E-IIOT-DELIVERY-FAILED" : "E-IIOT-MAX-ATTEMPTS");
    assert.equal(last.buffer.Attempts, attempt);
  }
  assert.equal(last.transition.status, "dead-letter", "پس از سه تلاش، دستهٔ نامهٔ مرده");

  const after = await ok(env.call, "GET", `${ROOT}/gateways/:gatewayId/buffer`, { params: { ...P, gatewayId: env.gateway.Id } });
  assert.equal(after.counts.deadLetter, 1);
  const summary = summarizeBufferRows(after.buffer);
  assert.equal(summary.deadLetter, 1);
  assert.equal(summary.needsAttention, true);
  assert.equal(summary.pendingSamples, 3, "نمونهٔ نامهٔ مرده در شمارش «معلق» می‌آید تا گم نشود");

  /* همان دسته با نقش سرپرست حفاری: ۴۰۳ — مرز مجوز روی سرور است، نه فقط UI.
   * سرپرست، هشدار را می‌بندد ولی بافر لبه در اختیار تکنسین میدان است. */
  const denied = await env.call("POST", `${ROOT}/gateways/:gatewayId/buffer/:bufferId/sync`, {
    params: { ...P, gatewayId: env.gateway.Id, bufferId },
    headers: { "x-user-id": SUPERVISOR },
    body: { delivered: true },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body?.error?.code, "IIOT_FORBIDDEN");
});
