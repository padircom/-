/**
 * آزمون منطق خالص داشبورد زندهٔ IIoT & DAS (`iiot-dashboard-v1`).
 * ═══════════════════════════════════════════════════════════════════════
 * این فایل به React کاری ندارد: هندسهٔ SVG، قالب‌بندی مقدار، خلاصهٔ پنل‌ها،
 * مرز مجوز اکشن‌ها و طرح دکل نمونه، همه دادهٔ خالص‌اند. پس آزمون، همان
 * تابع‌هایی را می‌آزماید که کامپوننت مصرف می‌کند — نه یک بازنویسی موازی.
 *
 * نکتهٔ کلیدی: مرز مجوز از همان موتور RBAC (`rbacLogic.js`) می‌آید، پس اگر
 * ماتریس نقش‌ها در `accessControl.ts` عوض شود، این آزمون هم عوض می‌شود.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  IIOT_ACTION_PERMISSIONS,
  IIOT_DASHBOARD_VERSION,
  IIOT_DEMO_BASELINE,
  IIOT_DEMO_CHANNELS,
  IIOT_DEMO_RULES,
  actionGates,
  ageSecondsOf,
  buildChartGeometry,
  buildDemoRigPlan,
  buildDemoTelemetrySamples,
  buildSpikeSamples,
  canPerformAction,
  decimalsForSignal,
  demoSignalValue,
  displayRangeFor,
  formatAgeFa,
  formatMeasure,
  gaugeFillPct,
  permissionOf,
  resolveDemoRigPlan,
  summarizeBufferRows,
  summarizeGaugeStatuses,
  summarizeIntegrationEvents,
  toneForStatus,
  toneWeight,
} from "./iiotDashboardLogic.js";

/* سوژه‌های نمونهٔ RBAC — همان‌هایی که `iiotApi.ts` اعلام می‌کند. */
const ENGINEER = "u-iiot-eng";
const SUPERVISOR = "u-iiot-driller";
const TECH = "u-iiot-tech";
const RIG = "RIG-DEMO";
const OTHER_RIG = "RIG-OTHER";

/* ═══════════════════ الف) چراغ وضعیت و قالب‌بندی ═══════════════════ */

test("چراغ وضعیت: نگاشت وضعیت سرور به سه رنگ، و بی‌داده ≠ سبز", () => {
  assert.equal(toneForStatus("normal"), "ok");
  assert.equal(toneForStatus("warning"), "warn");
  assert.equal(toneForStatus("critical"), "danger");
  assert.equal(toneForStatus(null), "idle");
  assert.equal(toneForStatus("no-data"), "idle");
  assert.equal(toneForStatus("هر-چیز-دیگر"), "idle");
  /* بحرانی باید پیش از سالم مرتب شود تا در فهرست اول دیده شود. */
  assert.ok(toneWeight("danger") > toneWeight("warn"));
  assert.ok(toneWeight("warn") > toneWeight("ok"));
  assert.ok(toneWeight("ok") > toneWeight("idle"));
  assert.equal(IIOT_DASHBOARD_VERSION, "iiot-dashboard-v1");
});

test("قالب‌بندی مقدار: بی‌داده صفر نشان داده نمی‌شود", () => {
  assert.equal(formatMeasure(null), "—");
  assert.equal(formatMeasure(undefined, { uom: "psi" }), "—");
  assert.equal(formatMeasure(Number.NaN, { fallback: "بی‌مقدار" }), "بی‌مقدار");
  assert.equal(formatMeasure(3200.456, { uom: "psi", decimals: 0 }), "3200 psi");
  assert.equal(formatMeasure(18.2, { uom: "kft·lb", decimals: 1 }), "18.2 kft·lb");
  assert.equal(formatMeasure(1.23456789, { decimals: 9 }), "1.234568", "رقم اعشار بیش از ۶ کلمپ می‌شود");
});

test("رقم اعشار و محدودهٔ نمایش از متادیتای سیگنال می‌آید", () => {
  assert.equal(decimalsForSignal("rpm"), 0);
  assert.equal(decimalsForSignal("vibration"), 2);
  assert.equal(decimalsForSignal("torque"), 1);
  assert.equal(decimalsForSignal("ناشناخته"), 1);

  assert.deepEqual(displayRangeFor("torque", 0, 40), { min: 0, max: 40 }, "محدودهٔ کانال مقدم است");
  assert.deepEqual(displayRangeFor("torque", null, null), { min: 0, max: 40 }, "سقف متادیتا جایگزین می‌شود");
  assert.deepEqual(displayRangeFor("wob", 0, 0), { min: 0, max: 60 }, "محدودهٔ نامعتبر دور ریخته می‌شود");
  assert.equal(displayRangeFor("temperature", null, null).max, 200);
});

test("درصد پرشدگی گیج: همیشه در بازهٔ ۰..۱۰۰", () => {
  assert.equal(gaugeFillPct(30, 0, 60), 50);
  assert.equal(gaugeFillPct(-5, 0, 60), 0);
  assert.equal(gaugeFillPct(999, 0, 60), 100);
  assert.equal(gaugeFillPct(null, 0, 60), 0);
  assert.equal(gaugeFillPct(5, 10, 10), 0, "بازهٔ صفر، پرشدگی نمی‌سازد");
});

test("سن داده: از اختلاف دو زمان ISO تا متن فارسی", () => {
  const now = "2026-03-10T06:00:00.000Z";
  assert.equal(ageSecondsOf("2026-03-10T05:59:48.000Z", now), 12);
  assert.equal(ageSecondsOf(null, now), null, "بی‌زمانی، صفر نیست");
  assert.equal(ageSecondsOf("زمان-نامعتبر", now), null);
  assert.equal(ageSecondsOf(now, "نامعتبر"), null);
  assert.equal(formatAgeFa(12), "12 ثانیه پیش");
  assert.equal(formatAgeFa(90), "1 دقیقه پیش");
  assert.equal(formatAgeFa(7200), "2 ساعت پیش");
  assert.equal(formatAgeFa(null), "بی‌زمان");
});

/* ═══════════════════ ب) هندسهٔ نمودار SVG ═══════════════════ */

test("نمودار: سری خالی، خط نمی‌کشد", () => {
  const geo = buildChartGeometry([], { width: 400, height: 120 });
  assert.equal(geo.empty, true);
  assert.equal(geo.lines.length, 0);
  assert.equal(geo.rawArea, "");
  assert.equal(geo.sampleCount, 0);
  assert.ok(geo.max > geo.min, "دامنهٔ خالی هم نامعتبر نمی‌شود");
});

test("نمودار: خط خام از چپ به راست و برعکس مقدار بالا/پایین می‌رود", () => {
  const geo = buildChartGeometry(
    [
      { at: "2026-03-10T06:00:00.000Z", value: 10 },
      { at: "2026-03-10T06:00:10.000Z", value: 30 },
      { at: "2026-03-10T06:00:20.000Z", value: 20 },
    ],
    { width: 300, height: 100, displayMin: 0, displayMax: 40 },
  );
  const raw = geo.lines.find((l) => l.key === "raw");
  assert.equal(raw.vertices.length, 3);
  assert.ok(raw.vertices[0].x < raw.vertices[1].x && raw.vertices[1].x < raw.vertices[2].x, "زمان ↦ محور X");
  assert.ok(raw.vertices[1].y < raw.vertices[0].y, "مقدار بزرگ‌تر، بالا‌تر (y کوچک‌تر)");
  assert.ok(raw.vertices[2].y > raw.vertices[1].y, "افت مقدار ↦ پایین‌تر");
  assert.equal(geo.min, 0);
  assert.equal(geo.max, 40);
  assert.equal(geo.yTicks.length, 5);
  assert.equal(geo.yTicks[0].value, 40);
  assert.equal(geo.yTicks[4].value, 0);
  assert.ok(geo.rawArea.startsWith("M ") && geo.rawArea.endsWith(" Z"));
  assert.equal(raw.points.split(" ").length, 3);
  assert.ok(!raw.points.includes("NaN"));
});

test("نمودار: خط فیلترشده فقط وقتی کشیده می‌شود که سرور داده باشد", () => {
  const without = buildChartGeometry([{ at: "t1", value: 5 }, { at: "t2", value: 7 }]);
  assert.equal(without.lines.length, 1);
  const withFiltered = buildChartGeometry([
    { at: "t1", value: 5, filtered: 4.5 },
    { at: "t2", value: 7, filtered: 6.2 },
  ]);
  assert.equal(withFiltered.lines.length, 2);
  assert.deepEqual(withFiltered.lines.map((l) => l.key), ["raw", "filtered"]);
  assert.equal(withFiltered.lines[1].vertices.length, 2);
});

test("نمودار: مقدار نامعتبر نقطه نمی‌سازد ولی ترتیب زمانی حفظ می‌شود", () => {
  const geo = buildChartGeometry([
    { at: "t1", value: 10 },
    { at: "t2", value: null },
    { at: "t3", value: Number.NaN },
    { at: "t4", value: 12 },
  ]);
  const raw = geo.lines.find((l) => l.key === "raw");
  assert.equal(raw.vertices.length, 2);
  assert.equal(geo.sampleCount, 4, "ردیف‌ها شمرده می‌شوند، نه فقط مقدارهای معتبر");
  assert.equal(geo.firstAt, "t1");
  assert.equal(geo.lastAt, "t4");
});

test("نمودار: اسپایک بیرون از محدودهٔ نمایش، از قاب بیرون نمی‌زند", () => {
  const geo = buildChartGeometry(
    [{ at: "t1", value: 10 }, { at: "t2", value: 500 }],
    { width: 200, height: 100, displayMin: 0, displayMax: 60 },
  );
  assert.equal(geo.max, 500, "دامنه تا مقدار واقعی گسترده می‌شود");
  for (const line of geo.lines) {
    for (const v of line.vertices) {
      assert.ok(v.y >= geo.padY - 0.01 && v.y <= geo.height - geo.padY + 0.01, `y بیرون از قاب: ${v.y}`);
    }
  }
});

test("نمودار: یک نقطه تنها، خط تخت می‌سازد نه نقطهٔ بی‌عرض", () => {
  const geo = buildChartGeometry([{ at: "t1", value: 42 }], { width: 300, height: 100 });
  const raw = geo.lines.find((l) => l.key === "raw");
  assert.equal(raw.vertices.length, 1, "رأس اصلی یکی است");
  assert.equal(raw.points.split(" ").length, 2, "خط تخت از دو سر کشیده می‌شود");
  assert.ok(!raw.points.includes("NaN"));
});

test("نمودار: واحد خام و فیلترشده یک محور مشترک دارند", () => {
  const geo = buildChartGeometry([
    { at: "t1", value: 100, filtered: 90 },
    { at: "t2", value: 110, filtered: 130 },
  ]);
  assert.equal(geo.min, 90, "کمینهٔ هر دو سری");
  assert.equal(geo.max, 130, "بیشینهٔ هر دو سری");
});

/* ═══════════════════ ج) خلاصهٔ پنل‌ها ═══════════════════ */

test("خلاصهٔ گیج‌ها: شمارش سه رنگ", () => {
  const counts = summarizeGaugeStatuses([
    { status: "normal" }, { status: "warning" }, { status: "critical" }, { status: "critical" }, { status: null },
  ]);
  assert.deepEqual(counts, { ok: 1, warn: 1, danger: 2, idle: 1 });
});

test("خلاصهٔ بافر: دستهٔ نامهٔ مرده، نیازمند توجه است", () => {
  const summary = summarizeBufferRows([
    { Status: "sent", SampleCount: 100, CapturedAt: "2026-03-10T05:00:00.000Z" },
    { Status: "buffered", SampleCount: 50, CapturedAt: "2026-03-10T05:30:00.000Z" },
    { Status: "failed", SampleCount: 25, CapturedAt: "2026-03-10T05:10:00.000Z" },
    { Status: "dead-letter", SampleCount: 10, CapturedAt: "2026-03-10T05:05:00.000Z" },
  ]);
  assert.equal(summary.sent, 1);
  assert.equal(summary.buffered, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.deadLetter, 1);
  assert.equal(summary.pendingSamples, 85, "نمونه‌های معلق + نامهٔ مرده");
  assert.equal(summary.oldestCapturedAt, "2026-03-10T05:05:00.000Z", "قدیمی‌ترین معلق اول دیده می‌شود");
  assert.equal(summary.needsAttention, true);
  assert.equal(summarizeBufferRows([]).needsAttention, false);
});

test("خلاصهٔ صف یکپارچگی: قابل‌تلاش‌دوباره و تفکیک مقصد", () => {
  const summary = summarizeIntegrationEvents([
    { Status: "pending", TargetSystem: "cmms" },
    { Status: "dispatched", TargetSystem: "mes" },
    { Status: "failed", TargetSystem: "pmis" },
    { Status: "dead-letter", TargetSystem: "pmis" },
  ]);
  assert.equal(summary.pending, 1);
  assert.equal(summary.dispatched, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.deadLetter, 1);
  assert.equal(summary.retryable, 3, "معلق و ناموفق و نامهٔ مرده قابل تلاش دوباره‌اند");
  assert.deepEqual(summary.byTarget, { cmms: 1, mes: 1, pmis: 2 });
});

/* ═══════════════════ د) مرز مجوز اکشن‌ها ═══════════════════ */

test("مرز مجوز: هر اکشن یک مجوز `iiot.*` دارد", () => {
  const actions = Object.keys(IIOT_ACTION_PERMISSIONS);
  assert.ok(actions.length >= 10);
  for (const action of actions) {
    assert.match(permissionOf(action), /^iiot\.[a-z]+\.[a-z]+$/, `مجوز نامعتبر برای ${action}`);
  }
  assert.equal(permissionOf("acknowledgeAlert"), "iiot.alert.ack");
  assert.equal(permissionOf("configureRule"), "iiot.threshold.edit");
  assert.equal(permissionOf("syncBuffer"), "iiot.buffer.sync");
  assert.equal(permissionOf("calibrateSensor"), "iiot.sensor.calibrate");
});

test("مرز مجوز: سرپرست حفاری هشدار را می‌بندد، ولی آستانه را عوض نمی‌کند", () => {
  const gates = actionGates(SUPERVISOR, RIG);
  assert.equal(gates.acknowledgeAlert, true);
  assert.equal(gates.resolveAlert, true);
  assert.equal(gates.falsePositiveAlert, true);
  assert.equal(gates.dispatchAlert, true);
  assert.equal(gates.verifyDowntime, true);
  assert.equal(gates.dispatchEvent, true);
  assert.equal(gates.ingestTelemetry, false, "پذیرش نمونه کار مهندس/تکنسین است");
  assert.equal(gates.configureRule, false, "تنظیم آستانه با کسی است که تأیید نمی‌کند (تفکیک وظایف)");
  assert.equal(gates.calibrateSensor, false);
  assert.equal(gates.createRig, false);
});

test("مرز مجوز: مهندس IIoT پیکربندی می‌کند و هشدار را تأیید نمی‌کند", () => {
  const gates = actionGates(ENGINEER, RIG);
  assert.equal(gates.ingestTelemetry, true);
  assert.equal(gates.configureRule, true);
  assert.equal(gates.createRig, true);
  assert.equal(gates.acknowledgeAlert, false);
  assert.equal(gates.resolveAlert, false);
  assert.equal(gates.dispatchAlert, false);
  assert.equal(gates.verifyDowntime, false);
  assert.equal(gates.dispatchEvent, false);
  assert.equal(gates.calibrateSensor, false, "کالیبراسیون کار تکنسین میدان است");
});

test("مرز مجوز: تکنسین میدان بافر و کالیبراسیون را در دست دارد", () => {
  const gates = actionGates(TECH, RIG);
  assert.equal(gates.syncBuffer, true);
  assert.equal(gates.calibrateSensor, true);
  assert.equal(gates.ingestTelemetry, true);
  assert.equal(gates.recordCondition, true);
  assert.equal(gates.acknowledgeAlert, false);
  assert.equal(gates.configureRule, false);
  assert.equal(gates.dispatchEvent, false);
  assert.equal(gates.createRig, false);
});

test("مرز مجوز: دامنهٔ دکل و هویت ناشناس، هر دو مسدود می‌شوند", () => {
  /* مهندسِ همین نقش، ولی دامنه‌اش دکل دیگری است. */
  assert.equal(canPerformAction(ENGINEER, "ingestTelemetry", OTHER_RIG), false);
  assert.equal(canPerformAction(null, "acknowledgeAlert", RIG), false);
  assert.equal(canPerformAction("u-ناشناخته", "acknowledgeAlert", RIG), false);
  const all = Object.values(actionGates(null, RIG));
  assert.ok(all.every((v) => v === false), "بی‌هویت: همهٔ دکمه‌ها خاموش");
});

/* ═══════════════════ ه) طرح دکل نمونه ═══════════════════ */

test("طرح دکل نمونه: ریگ + گیت‌وی + جریان + ۶ کانال + ۴ قاعده", () => {
  const plan = buildDemoRigPlan(RIG);
  assert.equal(plan.rigId, RIG);
  assert.equal(plan.rig.RigId, RIG);
  assert.equal(plan.rig.RigType, "land");
  assert.equal(plan.rig.CmmsSiteRef, "SITE-DEMO", "ارجاع نرم به نت برای پل یکپارچگی");
  assert.equal(plan.gateway.code, "GW-01");
  assert.equal(plan.stream.code, "MUDLOG-01");
  assert.equal(plan.channels.length, 6);
  assert.deepEqual(plan.channels.map((c) => c.code), IIOT_DEMO_CHANNELS.map((c) => c.code));
  assert.equal(plan.rules.length, 4);
  assert.equal(plan.rules.length, IIOT_DEMO_RULES.length);

  const channelCodes = new Set(plan.channels.map((c) => c.code));
  for (const rule of plan.rules) {
    assert.ok(channelCodes.has(rule.channelCode), `قاعده روی کانال ناموجود: ${rule.channelCode}`);
    assert.match(rule.code, /^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/, "کد قاعده باید قالب CODE_RE سرور را بگذراند");
    assert.match(String(rule.body.NameFa), /.+/, "نام فارسی قاعده الزامی است");
  }
  for (const channel of plan.channels) {
    assert.match(channel.code, /^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/);
    assert.ok(Number(channel.body.DisplayMax).valueOf() > Number(channel.body.DisplayMin).valueOf());
  }
  /* قاعدهٔ ارسال خودکار باید هر سه مرجع نرم را داشته باشد، وگرنه سرور ۴۰۰ می‌دهد. */
  const auto = plan.rules.find((r) => r.code === "TR-TEMP-HH");
  assert.equal(auto.body.AutoDispatch, true);
  assert.equal(auto.body.DispatchTargets, "cmms,mes,pmis");
  assert.ok(auto.body.CmmsSiteRef && auto.body.MesWorkCenterRef && auto.body.PmisProjectRef);
  /* قاعدهٔ بدون ارسال خودکار، مقصد تعریف نمی‌کند. */
  assert.equal(plan.rules.find((r) => r.code === "TR-TORQ-H").body.DispatchTargets, null);
});

test("طرح دکل نمونه: گره‌زدن شناسه‌های واقعی، ترتیب وابستگی را حفظ می‌کند", () => {
  const plan = buildDemoRigPlan(RIG);
  const resolved = resolveDemoRigPlan(plan, {
    gatewayId: "gw-1",
    streamId: "st-1",
    channelIdByCode: { "CH-TEMP": "ch-1", "CH-TORQUE": "ch-2" },
  });
  assert.equal(resolved.stream.GatewayId, "gw-1", "جریان بدون گیت‌وی ساخته نمی‌شود");
  assert.ok(resolved.channels.every((c) => c.body.StreamId === "st-1"));
  assert.equal(resolved.rules.find((r) => r.code === "TR-TEMP-HH").body.ChannelId, "ch-1");
  assert.equal(resolved.rules.find((r) => r.code === "TR-TORQ-H").body.ChannelId, "ch-2");
  /* قاعده روی کانال ساخته‌نشده، شناسه نمی‌گیرد — سرور باید آن را رد کند. */
  assert.equal(resolved.rules.find((r) => r.code === "TR-SPP-DROP").body.ChannelId, null);
});

/* ═══════════════════ و) نمونهٔ تله‌متری دمو ═══════════════════ */

test("نمونهٔ دمو: قطعی، مرتب و زیر آستانه (بی هشدار جعلی)", () => {
  const now = "2026-03-10T06:00:00.000Z";
  const channels = IIOT_DEMO_CHANNELS.map((c) => ({ code: c.code, signalType: c.signalType }));
  const a = buildDemoTelemetrySamples({ channels, nowIso: now, minutes: 10, stepSeconds: 10 });
  const b = buildDemoTelemetrySamples({ channels, nowIso: now, minutes: 10, stepSeconds: 10 });
  assert.deepEqual(a, b, "بدون تصادف — قابل بازتولید");
  assert.equal(a.length, 6 * 60, "۶ کانال × ۶۰ نمونه");
  assert.ok(a.every((s) => s.source === "simulated" && s.quality === "good"));
  assert.ok(a.every((s) => Date.parse(s.at) < Date.parse(now)), "همهٔ نمونه‌ها در گذشته‌اند");
  for (const channel of channels) {
    const series = a.filter((s) => s.channelCode === channel.code);
    for (let i = 1; i < series.length; i += 1) {
      assert.ok(series[i - 1].at < series[i].at, "ترتیب زمانی صعودی");
    }
  }
  /* آستانهٔ نمونه‌ها: دما ۱۲۰ و گشتاور ۲۸ — سری دمو نباید آن‌ها را رد کند. */
  const maxTemp = Math.max(...a.filter((s) => s.channelCode === "CH-TEMP").map((s) => s.value));
  const maxTorque = Math.max(...a.filter((s) => s.channelCode === "CH-TORQUE").map((s) => s.value));
  assert.ok(maxTemp < 120, `دمای نمونه از آستانه گذشت: ${maxTemp}`);
  assert.ok(maxTorque < 28, `گشتاور نمونه از آستانه گذشت: ${maxTorque}`);
  assert.deepEqual(buildDemoTelemetrySamples({ channels, nowIso: "نامعتبر" }), [], "زمان نامعتبر → بدون نمونه");
});

test("مقدار پایهٔ هر سیگنال، متناهی و تعریف‌شده است", () => {
  for (const [signal, base] of Object.entries(IIOT_DEMO_BASELINE)) {
    assert.ok(Number.isFinite(base) && base > 0, `پایهٔ نامعتبر برای ${signal}`);
  }
  /* موج آرام است: انحراف از پایه در چند نمونه از ۱۰٪ بیشتر نمی‌شود. */
  for (const signal of Object.keys(IIOT_DEMO_BASELINE)) {
    const base = IIOT_DEMO_BASELINE[signal];
    for (let i = 0; i < 40; i += 1) {
      const value = demoSignalValue(signal, i);
      assert.ok(Math.abs(value - base) / base < 0.1, `نوسان زیاد برای ${signal}`);
    }
  }
});

test("سری تزریق اسپایک: افزایشی تا سقف، برای آزمودن زنجیرهٔ هشدار", () => {
  const now = "2026-03-10T06:00:00.000Z";
  const series = buildSpikeSamples({ channelCode: "CH-TEMP", nowIso: now, from: 80, to: 130, samples: 24, stepSeconds: 1 });
  assert.equal(series.length, 24);
  assert.equal(series[0].value, 80);
  assert.equal(series[series.length - 1].value, 130, "سقف باید از آستانهٔ ۱۲۰ بگذرد");
  for (let i = 1; i < series.length; i += 1) {
    assert.ok(series[i].value > series[i - 1].value, "صعودی");
    assert.ok(series[i].at > series[i - 1].at, "ترتیب زمانی صعودی");
  }
  assert.equal(series[series.length - 1].at, now, "آخرین نمونه، همین حالا");
  assert.ok(series.every((s) => s.channelCode === "CH-TEMP" && s.quality === "good"));
  assert.equal(buildSpikeSamples({ channelCode: "CH-TEMP", nowIso: now, from: 0, to: 1, samples: 1 }).length, 2, "کمینهٔ دو نمونه");
});
