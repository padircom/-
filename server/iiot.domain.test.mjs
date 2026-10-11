/**
 * آزمون موتور دامنهٔ IIoT & DAS (iiot-v1) — ریاضی و قواعد.
 *
 * این فایل قلب ماژول را می‌آزماید: فیلترینگ، دروازه‌های ضد هشدار کاذب،
 * تشخیص Stick-Slip و افت فشار پمپ، Store-and-Forward و محاسبهٔ NPT.
 * HTTP اینجا آزموده نمی‌شود؛ آن کار `iiot.rest.test.mjs` است.
 *
 * قاعدهٔ کلی آزمون‌ها: هر ادعای «تشخیص داد» باید یک ادعای متقابل «تشخیص
 * نداد» داشته باشد. موتور هشی که هر سیگنالی را بحرانی بداند، از موتور هشی
 * که هیچ‌چیز را نبیند بدتر است.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  IIOT_DOMAIN_VERSION,
  IIOT_INTEGRATION_CONTRACTS,
  NPT_CATEGORY_MAP,
  SIGNAL_LABELS,
  SIGNAL_TYPES,
  SignalFilter,
  alertMessageFa,
  alertTitleFa,
  bucketStartOf,
  buildStoreForwardBatch,
  bufferFillPct,
  canonicalJson,
  checksumOf,
  claimWorthy,
  classifyDowntime,
  coefficientOfVariation,
  detectPumpPressureDrop,
  detectStickSlip,
  downsampleForChart,
  downtimeMinutesOf,
  evaluateDetectRule,
  evaluateThreshold,
  eventTypeFor,
  filterSeries,
  idempotencyKeyOf,
  inCooldown,
  mean,
  median,
  minutesBetween,
  nextBufferStatus,
  nptSummary,
  parseDispatchTargets,
  pctChange,
  recoveredBelowHysteresis,
  rollupSamples,
  round,
  secondsBetween,
  selectBufferedForSync,
  shouldDispatch,
  signalQualityReport,
  smaSeries,
  emaSeries,
  medianFilter,
  statusColorFor,
  stddev,
  verifyBatch,
  windowSizeOf,
  zScore,
} from "./iiotLogic.js";

/** محور زمانی ثابت: ۱۰ مارس ۲۰۲۶، ساعت ۰۶:۰۰ UTC. */
const T0 = Date.parse("2026-03-10T06:00:00Z");
const at = (seconds) => new Date(T0 + seconds * 1000).toISOString();
/** سری زمانی با فاصلهٔ ثابت. */
const series = (values, stepSeconds = 1, startSeconds = 0) => values.map((value, i) => ({ at: at(startSeconds + i * stepSeconds), value }));

/* ═══════════════════════ ۱. ابزار عددی ═══════════════════════ */

test("آمار: میانگین، میانه و انحراف معیار نمونه‌ای", () => {
  assert.equal(mean([1, 2, 3, 4]), 2.5);
  assert.equal(mean([]), null, "میانگین سری خالی تعریف‌نشده است نه صفر");
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  /* انحراف معیار نمونه‌ای (n−1) روی [2,4,4,4,5,5,7,9] برابر ریشهٔ ۳۲/۷ است. */
  assert.equal(round(stddev([2, 4, 4, 4, 5, 5, 7, 9]), 5), 2.13809);
  assert.equal(stddev([5]), null, "با یک نمونه، انحراف معیار تعریف‌نشده است");
});

test("آمار: ضریب تغییرات و امتیاز Z — شاخص‌های تشخیص", () => {
  assert.equal(round(coefficientOfVariation([10, 10, 10]), 6), 0);
  assert.equal(coefficientOfVariation([0, 0, 0]), null, "میانگین صفر، CV تعریف‌نشده");
  const z = zScore(20, [10, 10, 10, 10, 30]);
  assert.ok(z !== null && z > 0);
  assert.equal(zScore(5, [5, 5, 5]), null, "انحراف صفر، Z تعریف‌نشده");
});

test("آمار: درصد تغییر و بازهٔ زمانی", () => {
  assert.equal(round(pctChange(2000, 1500), 4), -25);
  assert.equal(pctChange(0, 10), null, "تقسیم بر صفر، عدد نمی‌سازد");
  assert.equal(secondsBetween(at(0), at(90)), 90);
  assert.equal(secondsBetween("نه-زمان", at(10)), null, "زمان نامعتبر null می‌دهد نه NaN");
  assert.equal(minutesBetween(at(0), at(5400)), 90);
});

test("آمار: گردکردن پایدار و سطل‌بندی زمانی", () => {
  assert.equal(round(1.23456789, 3), 1.235);
  assert.equal(bucketStartOf("2026-03-10T06:01:37Z", 60), "2026-03-10T06:01:00.000Z");
  assert.equal(bucketStartOf("2026-03-10T06:04:59Z", 300), "2026-03-10T06:00:00.000Z");
  assert.throws(() => bucketStartOf(at(0), 0), RangeError);
});

/* ═══════════════════════ ۲. فیلترینگ سیگنال ═══════════════════════ */

test("فیلتر: میانگین متحرک تا پرشدن پنجره null می‌دهد", () => {
  const out = smaSeries([10, 20, 30, 40], 3);
  assert.deepEqual(out, [null, null, 20, 30]);
  assert.throws(() => smaSeries([1, 2], 0), RangeError, "پنجرهٔ صفر خطا می‌دهد نه خروجی بی‌معنی");
});

test("فیلتر: هموارسازی نمایی و میانه", () => {
  const ema = emaSeries([10, 20, 30], 0.5);
  assert.deepEqual(ema.map((v) => round(v, 4)), [10, 15, 22.5]);
  assert.throws(() => emaSeries([1], 1.5), RangeError, "آلفای بیرون بازه خطا می‌دهد");
  /* میانه در برابر تک‌نمونهٔ پرت مقاوم است — همان کاری که SMA نمی‌کند. */
  const med = medianFilter([10, 10, 10, 1000, 10], 3);
  assert.deepEqual(med, [null, null, 10, 10, 10]);
  const sma = smaSeries([10, 10, 10, 1000, 10], 3);
  assert.ok(sma[3] > 300, "SMA با اسپایک جابه‌جا می‌شود — تفاوتش با میانه همین است");
});

test("فیلتر: پنجره از ثانیه و نرخ نمونه ساخته می‌شود", () => {
  assert.equal(windowSizeOf({ windowSeconds: 10, sampleRateHz: 5 }), 50);
  assert.equal(windowSizeOf({ windowSeconds: 10 }), 10, "نرخ پیش‌فرض ۱ هرتز است");
  assert.equal(windowSizeOf({ windowSeconds: 0, sampleRateHz: 4 }), 4, "پنجرهٔ صفر به یک ثانیه برمی‌گردد");
});

test("فیلتر: minSamples دورهٔ گرم‌شدن را اعمال می‌کند", () => {
  const out = filterSeries([1, 2, 3, 4, 5], { method: "sma", windowSeconds: 1, sampleRateHz: 1, minSamples: 3 });
  assert.deepEqual(out, [null, null, 3, 4, 5], "دو نمونهٔ اول هنوز آماده نیستند");
});

test("فیلتر: روش none سیگنال را دست‌نخورده رد می‌کند", () => {
  assert.deepEqual(filterSeries([1, 2, 3], { method: "none" }), [1, 2, 3]);
});

test("فیلتر حالت‌دار: warm-up، مقدار جاری و ناحیهٔ مرده", () => {
  const filter = new SignalFilter({ method: "sma", windowSeconds: 3, sampleRateHz: 1, minSamples: 3 });
  assert.equal(filter.push(10).ready, false, "پیش از سه نمونه، فیلتر آماده نیست");
  assert.equal(filter.push(10).filtered, null);
  const third = filter.push(10);
  assert.equal(third.ready, true);
  assert.equal(third.filtered, 10);
  /* پنجرهٔ لغزان: با ورود ۴۰، میانگین سه نمونهٔ آخر است نه کل تاریخچه. */
  assert.equal(filter.push(40).filtered, 20);
  assert.equal(filter.current(), 20);
  assert.equal(filter.samples, 4);
});

test("فیلتر حالت‌دار: ناحیهٔ مرده لرزش رقم آخر را «تغییر» نمی‌شمارد", () => {
  const filter = new SignalFilter({ method: "none", windowSeconds: 1, sampleRateHz: 1, minSamples: 1, deadbandPct: 2 });
  assert.equal(filter.push(100).changed, true);
  assert.equal(filter.push(100.5).changed, false, "تغییر ۰.۵٪ زیر ناحیهٔ مرده است");
  assert.equal(filter.push(105).changed, true, "تغییر ۵٪ از ناحیهٔ مرده رد می‌شود");
});

test("فیلتر حالت‌دار: ورودی غیرعددی نمونهٔ خراب می‌سازد نه NaN", () => {
  const filter = new SignalFilter({ method: "sma", windowSeconds: 2, sampleRateHz: 1, minSamples: 1 });
  const bad = filter.push("نه-عدد");
  assert.equal(bad.filtered, null);
  assert.equal(bad.ready, false);
  assert.equal(filter.samples, 0, "نمونهٔ خراب در شمارش نمی‌آید");
});

/* ═══════════════════════ ۳. کیفیت سیگنال ═══════════════════════ */

test("کیفیت سیگنال: تفکیک good/suspect/bad/stale و درصد کیفیت", () => {
  const report = signalQualityReport([
    { value: 1, quality: "good" }, { value: 2, quality: "good" },
    { value: 3, quality: "suspect" }, { value: 4, quality: "bad" },
  ]);
  assert.equal(report.total, 4);
  assert.equal(report.good, 2);
  assert.equal(report.suspect, 1);
  assert.equal(report.bad, 1);
  assert.equal(report.qualityPct, 50);
});

test("کیفیت سیگنال: سیگنال یخ‌زده شناسایی می‌شود — سنسور مرده عدد ثابت می‌فرستد", () => {
  const frozen = signalQualityReport(
    Array.from({ length: 60 }, (_, i) => ({ value: 42, quality: "good", at: at(i) })),
    { flatlineSeconds: 30, sampleRateHz: 1 },
  );
  assert.equal(frozen.frozen, true);
  assert.ok(frozen.frozenSeconds >= 29, `مدت یخ‌زدگی باید واقعی باشد: ${frozen.frozenSeconds}`);

  const alive = signalQualityReport(
    Array.from({ length: 60 }, (_, i) => ({ value: 42 + (i % 3), quality: "good", at: at(i) })),
    { flatlineSeconds: 30, sampleRateHz: 1 },
  );
  assert.equal(alive.frozen, false, "سیگنال زنده، یخ‌زده نیست");
});

test("کیفیت سیگنال: اسپایک با امتیاز Z پیدا می‌شود", () => {
  const values = Array.from({ length: 30 }, (_, i) => ({ value: i % 2 === 0 ? 100 : 101, at: at(i) }));
  values[15] = { value: 900, at: at(15) };
  const report = signalQualityReport(values, { spikeZThreshold: 4 });
  assert.equal(report.spikeCount, 1);
  assert.equal(report.spikes[0].value, 900);
});

/* ═══════════════════════ ۴. آستانه‌های چندسطحی و ضد هشدار کاذب ═══════════════════════ */

test("آستانه: نقض پایدار با تعداد نمونه و مدت کافی اعلام می‌شود", () => {
  const verdict = evaluateThreshold(series(Array(25).fill(130)), {
    level: "critical", comparison: "gt", thresholdValue: 120, minSamples: 5, durationSeconds: 20,
  });
  assert.equal(verdict.breach, true);
  assert.equal(verdict.sustained, true);
  assert.equal(verdict.breachSamples, 25);
  assert.ok(verdict.breachSeconds >= 24);
  assert.equal(verdict.triggerValue, 130);
  /* سری ثابت، انحراف نسبت به خط مبنا ندارد — انحراف از «روند» می‌آید. */
  assert.equal(verdict.deviationPct, 0);
  assert.equal(verdict.baselineValue, 130);

  /* نیمهٔ نخست سری، خط مبناست؛ پس ۱۵ نمونهٔ آرام و ۱۰ نمونهٔ بحرانی. */
  const rising = evaluateThreshold(series([...Array(15).fill(90), ...Array(10).fill(130)]), {
    level: "critical", comparison: "gt", thresholdValue: 120, minSamples: 5, durationSeconds: 8,
  });
  assert.equal(rising.sustained, true);
  assert.ok(rising.deviationPct > 40, `انحراف از خط مبنا باید دیده شود: ${rising.deviationPct}`);
});

test("آستانه: تک‌نمونهٔ گذرا هشدار نمی‌سازد — دروازهٔ حداقل نمونه", () => {
  const values = [...Array(20).fill(100), 130];
  const verdict = evaluateThreshold(series(values), {
    level: "critical", comparison: "gt", thresholdValue: 120, minSamples: 5, durationSeconds: 20,
  });
  assert.equal(verdict.breach, true, "نقض دیده می‌شود…");
  assert.equal(verdict.sustained, false, "…ولی پایدار نیست، پس آلارم نمی‌سازد");
  assert.ok(verdict.reasons.includes("E-IIOT-BELOW-MIN-SAMPLES"));
});

test("آستانه: نقض بلند از نظر نمونه ولی کوتاه از نظر زمان، پایدار نیست", () => {
  /* ۱۰ نمونه با فاصلهٔ ۱ ثانیه = ۹ ثانیه، کمتر از ۲۰ ثانیهٔ لازم. */
  const verdict = evaluateThreshold(series(Array(10).fill(130)), {
    level: "critical", comparison: "gt", thresholdValue: 120, minSamples: 5, durationSeconds: 20,
  });
  assert.equal(verdict.sustained, false);
  assert.ok(verdict.reasons.includes("E-IIOT-NOT-SUSTAINED"));
});

test("آستانه: شمارش نقض از انتهای سری است، نه کل تاریخچه", () => {
  const values = [...Array(10).fill(130), ...Array(10).fill(100), ...Array(6).fill(130)];
  const verdict = evaluateThreshold(series(values), {
    level: "warning", comparison: "gt", thresholdValue: 120, minSamples: 5, durationSeconds: 5,
  });
  assert.equal(verdict.breachSamples, 6, "فقط شش نمونهٔ آخر متوالی‌اند");
});

test("آستانه: band-out و rate و lt", () => {
  const band = evaluateThreshold(series(Array(10).fill(60)), {
    level: "warning", comparison: "band-out", thresholdValue: 20, secondaryValue: 50, minSamples: 3, durationSeconds: 3,
  });
  assert.equal(band.sustained, true, "۶۰ بیرون باند ۲۰ تا ۵۰ است");

  const inside = evaluateThreshold(series(Array(10).fill(35)), {
    level: "warning", comparison: "band-out", thresholdValue: 20, secondaryValue: 50, minSamples: 3, durationSeconds: 3,
  });
  assert.equal(inside.breach, false);

  const falling = evaluateThreshold(series(Array(10).fill(1000), 5), {
    level: "critical", comparison: "lt", thresholdValue: 1200, minSamples: 3, durationSeconds: 10,
  });
  assert.equal(falling.sustained, true);
});

test("آستانه: نرخ تغییر بر واحد زمان سنجیده می‌شود", () => {
  const values = [100, 100, 100, 100, 400];
  const verdict = evaluateThreshold(series(values, 5), {
    level: "critical", detectKind: "rate-of-change", comparison: "rate", thresholdValue: 1, minSamples: 3, durationSeconds: 10,
  });
  assert.equal(verdict.breach, true);
  assert.ok(Math.abs(verdict.metrics.ratePerSecond) > 1);
  assert.equal(verdict.sustained, true);
});

test("آستانه: سری خالی یا بی‌آستانه، «نقض» نمی‌دهد", () => {
  assert.deepEqual(evaluateThreshold([], { level: "warning", thresholdValue: 1 }).reasons, ["E-IIOT-NO-DATA"]);
  const noThreshold = evaluateThreshold(series([1, 2, 3]), { level: "warning", comparison: "gt", thresholdValue: null });
  assert.equal(noThreshold.breach, false);
  assert.ok(noThreshold.reasons.includes("E-IIOT-NO-THRESHOLD"));
});

test("آستانه: دادهٔ کهنه آلارم نمی‌سازد — سنسور مرده نباید تا ابد هشدار دهد", () => {
  const stale = evaluateThreshold(series(Array(10).fill(130), 1, 0), {
    level: "critical", comparison: "gt", thresholdValue: 120, minSamples: 5, durationSeconds: 5,
  }, { nowIso: at(3600), staleAfterSeconds: 300 });
  assert.equal(stale.breach, false);
  assert.ok(stale.reasons.includes("E-IIOT-STALE-DATA"));
  assert.ok(stale.metrics.dataAgeSeconds > 3000);

  const fresh = evaluateThreshold(series(Array(10).fill(130), 1, 0), {
    level: "critical", comparison: "gt", thresholdValue: 120, minSamples: 5, durationSeconds: 5,
  }, { nowIso: at(20), staleAfterSeconds: 300 });
  assert.equal(fresh.sustained, true);
});

test("هیسترزیس: بازگشت به حالت عادی نیازمند عبور از نوار بازگشت است", () => {
  const rule = { comparison: "gt", thresholdValue: 120, hysteresisPct: 10 };
  assert.equal(recoveredBelowHysteresis(119, rule), false, "کمی زیر آستانه هنوز «بازگشت» نیست");
  assert.equal(recoveredBelowHysteresis(108, rule), true, "زیر ۱۰۸ (آستانه منهای ۱۰٪) بازگشت است");
  assert.equal(recoveredBelowHysteresis(50, { comparison: "lt", thresholdValue: 1000, hysteresisPct: 5 }), false);
  assert.equal(recoveredBelowHysteresis(1060, { comparison: "lt", thresholdValue: 1000, hysteresisPct: 5 }), true);
});

test("دورهٔ سکوت: جلوی طوفان هشدار روی یک ناهنجاری ادامه‌دار را می‌گیرد", () => {
  assert.equal(inCooldown(at(0), at(60), 300), true, "۶۰ ثانیه پس از هشدار، هنوز در سکوت است");
  assert.equal(inCooldown(at(0), at(400), 300), false, "پس از ۳۰۰ ثانیه، هشدار تازه مجاز است");
  assert.equal(inCooldown(null, at(10), 300), false, "بدون هشدار پیشین، سکوت معنا ندارد");
  assert.equal(inCooldown(at(0), at(10), 0), false, "دورهٔ سکوت صفر یعنی بدون سکوت");
});

test("رنگ وضعیت: critical بر warning غالب است و نبود آستانه سبز است", () => {
  const thresholds = [
    { level: "warning", comparison: "gt", thresholdValue: 100 },
    { level: "critical", comparison: "gt", thresholdValue: 120 },
  ];
  assert.equal(statusColorFor(90, thresholds), "normal");
  assert.equal(statusColorFor(110, thresholds), "warning");
  assert.equal(statusColorFor(130, thresholds), "critical");
  assert.equal(statusColorFor(null, thresholds), "normal", "نبود داده، قرمز نیست");
  assert.equal(statusColorFor(130, []), "normal");
});

/* ═══════════════════════ ۵. تشخیص پدیده ═══════════════════════ */

/* امضای واقعی Stick-Slip: گشتاور نوسان شدید + دور نامنظم. */
const STICK_SLIP_TORQUE = [12, 26, 10, 28, 9, 27, 11, 29, 10, 26, 12, 28];
const STICK_SLIP_RPM = [110, 45, 115, 40, 108, 42, 118, 38, 112, 44, 109, 41];

test("Stick-Slip: هر دو امضا با هم، تشخیص قطعی است", () => {
  const result = detectStickSlip({ torque: STICK_SLIP_TORQUE, rpm: STICK_SLIP_RPM, sampleRateHz: 1 }, { minSamples: 6 });
  assert.equal(result.detected, true);
  assert.ok(result.torqueCv > 10, `CV گشتاور باید بالا باشد: ${result.torqueCv}`);
  assert.ok(result.rpmSwingPct > 15, `نوسان دور باید بالا باشد: ${result.rpmSwingPct}`);
  assert.notEqual(result.severity, "none");
  assert.equal(result.sampleCount, 12);
});

test("Stick-Slip: گشتاور نوسانی با دور ثابت، Stick-Slip نیست (احتمال pack-off)", () => {
  const result = detectStickSlip({
    torque: STICK_SLIP_TORQUE,
    rpm: Array(12).fill(110),
    sampleRateHz: 1,
  }, { minSamples: 6 });
  assert.equal(result.detected, false);
  assert.ok(result.reasons.includes("E-IIOT-RPM-SWING-LOW"));
});

test("Stick-Slip: دور متغیر با گشتاور آرام، Stick-Slip نیست (تغییر دور اپراتور)", () => {
  const result = detectStickSlip({
    torque: Array(12).fill(15),
    rpm: STICK_SLIP_RPM,
    sampleRateHz: 1,
  }, { minSamples: 6 });
  assert.equal(result.detected, false);
  assert.ok(result.reasons.includes("E-IIOT-TORQUE-CV-LOW"));
});

test("Stick-Slip: نمونهٔ کم، تشخیص نمی‌دهد — پنجرهٔ کوتاه امضا ندارد", () => {
  const result = detectStickSlip({ torque: STICK_SLIP_TORQUE.slice(0, 4), rpm: STICK_SLIP_RPM.slice(0, 4) }, { minSamples: 6 });
  assert.equal(result.detected, false);
  assert.ok(result.reasons.includes("E-IIOT-BELOW-MIN-SAMPLES"));
});

test("Stick-Slip: شدت با نسبت CV به آستانه سنجیده می‌شود", () => {
  const mild = detectStickSlip({
    torque: [15, 18, 14, 19, 15, 18, 14, 19, 15, 18],
    rpm: [100, 80, 102, 78, 101, 79, 103, 77, 100, 81],
    sampleRateHz: 1,
  }, { minSamples: 5, torqueCvThreshold: 8, rpmSwingPctThreshold: 15 });
  assert.equal(mild.detected, true);
  assert.equal(mild.severity, "mild");

  const severe = detectStickSlip({ torque: STICK_SLIP_TORQUE, rpm: STICK_SLIP_RPM, sampleRateHz: 1 }, {
    minSamples: 6, torqueCvThreshold: 5,
  });
  assert.equal(severe.severity === "severe" || severe.severity === "moderate", true, `شدت باید بالا باشد: ${severe.severity}`);
});

test("Stick-Slip: پنجرهٔ زمانی، پدیدهٔ گذشته را «اکنون» اعلام نمی‌کند", () => {
  /* سناریوی واقعی: Stick-Slip در شروع شیفت رخ داده و برطرف شده؛ ۱۰۰ نمونهٔ
   * اخیر آرام‌اند. بدون پنجره، امضای کهنه هنوز در آمار هست و هشدار می‌سازد. */
  const calmTorque = Array(100).fill(15);
  const calmRpm = Array(100).fill(110);
  const windowed = detectStickSlip({
    torque: [...STICK_SLIP_TORQUE, ...calmTorque],
    rpm: [...STICK_SLIP_RPM, ...calmRpm],
    sampleRateHz: 1,
    windowSeconds: 12,
  }, { minSamples: 6 });
  assert.equal(windowed.sampleCount, 12, "فقط ۱۲ نمونهٔ آخر تحلیل می‌شوند");
  assert.equal(windowed.detected, false, "پدیدهٔ گذشته، هشدار تازه نمی‌سازد");

  const allHistory = detectStickSlip({
    torque: [...STICK_SLIP_TORQUE, ...calmTorque],
    rpm: [...STICK_SLIP_RPM, ...calmRpm],
    sampleRateHz: 1,
  }, { minSamples: 6 });
  assert.equal(allHistory.detected, true, "بدون پنجره، امضای کهنه هنوز هشدار می‌دهد — همین هشدار کاذب است");

  /* و پدیدهٔ جاری، با همان پنجره دیده می‌شود. */
  const live = detectStickSlip({
    torque: [...calmTorque, ...STICK_SLIP_TORQUE],
    rpm: [...calmRpm, ...STICK_SLIP_RPM],
    sampleRateHz: 1,
    windowSeconds: 12,
  }, { minSamples: 6 });
  assert.equal(live.detected, true);
});

test("افت فشار پمپ: افت پایدار نسبت به خط مبنا تشخیص داده می‌شود", () => {
  const pressure = [...Array(12).fill(3000), ...Array(8).fill(2200)];
  const result = detectPumpPressureDrop(pressure, { minSamples: 8, dropPctThreshold: 15 });
  assert.equal(result.detected, true);
  assert.ok(result.dropPct > 20, `افت باید بزرگ باشد: ${result.dropPct}`);
  assert.ok(result.baseline > result.current);
});

test("افت فشار پمپ: فشار پایدار، افت نیست", () => {
  const result = detectPumpPressureDrop(Array(20).fill(3000), { minSamples: 8, dropPctThreshold: 15 });
  assert.equal(result.detected, false);
  assert.ok(result.reasons.includes("E-IIOT-NO-DROP"));
});

test("افت فشار پمپ: کف مطلق، حتی بدون افت نسبی بحرانی است", () => {
  /* فشار از ابتدا پایین بوده (افت نسبی صفر) ولی زیر کف مطلق است. */
  const result = detectPumpPressureDrop(Array(20).fill(400), { minSamples: 8, absoluteFloor: 800 });
  assert.equal(result.detected, true);
  assert.equal(result.absoluteFloorBreached, true);
});

test("قاعدهٔ چندکاناله: Stick-Slip از سری گشتاور و دور ساخته می‌شود", () => {
  const { verdict, stickSlip } = evaluateDetectRule(
    { level: "critical", detectKind: "stick-slip", minSamples: 6, torqueCvThreshold: 10, rpmSwingPctThreshold: 15 },
    { torque: series(STICK_SLIP_TORQUE), rpm: series(STICK_SLIP_RPM) },
    "torque",
    { sampleRateHz: 1 },
  );
  assert.equal(verdict.breach, true);
  assert.equal(verdict.detectKind, "stick-slip");
  assert.equal(verdict.sustained, true);
  assert.ok(stickSlip.detected);
  assert.ok(verdict.metrics.torqueCv > 0);
});

test("قاعدهٔ چندکاناله: افت فشار از سری پمپ گل خوانده می‌شود", () => {
  const pressure = [...Array(12).fill(3000), ...Array(8).fill(2100)];
  const { verdict, pumpDrop } = evaluateDetectRule(
    { level: "critical", detectKind: "pump-drop", minSamples: 8, pressureDropPctThreshold: 15 },
    { "mud-pump-pressure": series(pressure) },
    "mud-pump-pressure",
  );
  assert.equal(verdict.breach, true);
  assert.equal(verdict.detectKind, "pump-drop");
  assert.ok(pumpDrop.detected);
});

test("قاعدهٔ یخ‌زدگی: سیگنال ثابت، خرابی سنسور اعلام می‌کند", () => {
  const { verdict } = evaluateDetectRule(
    { level: "warning", detectKind: "flatline", minSamples: 3 },
    { temperature: series(Array(70).fill(85)) },
    "temperature",
    { sampleRateHz: 1, windowSeconds: 60 },
  );
  assert.equal(verdict.breach, true);
  assert.equal(verdict.detectKind, "flatline");

  const alive = evaluateDetectRule(
    { level: "warning", detectKind: "flatline", minSamples: 3 },
    { temperature: series(Array.from({ length: 70 }, (_, i) => 85 + (i % 4))) },
    "temperature",
    { sampleRateHz: 1, windowSeconds: 60 },
  );
  assert.equal(alive.verdict.breach, false);
});

test("قاعدهٔ اسپایک: تک‌نمونهٔ پرت با Z بالا اعلام می‌شود", () => {
  const values = Array.from({ length: 40 }, (_, i) => 100 + (i % 2));
  values[39] = 900;
  const { verdict } = evaluateDetectRule(
    { level: "warning", detectKind: "spike", thresholdValue: 4 },
    { vibration: series(values) },
    "vibration",
  );
  assert.equal(verdict.breach, true);
  assert.ok(verdict.metrics.zScore > 4);

  const calm = evaluateDetectRule(
    { level: "warning", detectKind: "spike", thresholdValue: 4 },
    { vibration: series(values.slice(0, 39).concat([101])) },
    "vibration",
  );
  assert.equal(calm.verdict.breach, false);
});

/* ═══════════════════════ ۶. تجمیع و نمودار ═══════════════════════ */

test("تجمیع: سطل‌های زمانی با آمار کامل ساخته می‌شوند", () => {
  const samples = [
    { at: "2026-03-10T06:00:05Z", value: 10, quality: "good" },
    { at: "2026-03-10T06:00:35Z", value: 20, quality: "good" },
    { at: "2026-03-10T06:00:50Z", value: 30, quality: "bad" },
    { at: "2026-03-10T06:01:10Z", value: 40, quality: "good" },
  ];
  const buckets = rollupSamples(samples, 60);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].bucketStart, "2026-03-10T06:00:00.000Z");
  assert.equal(buckets[0].sampleCount, 3);
  assert.equal(buckets[0].badCount, 1);
  assert.equal(buckets[0].minValue, 10);
  assert.equal(buckets[0].maxValue, 30);
  assert.equal(buckets[0].avgValue, 20);
  assert.equal(buckets[0].firstValue, 10);
  assert.equal(buckets[0].lastValue, 30);
  assert.equal(buckets[1].sampleCount, 1);
  assert.throws(() => rollupSamples(samples, 0), RangeError);
});

test("کوچک‌سازی نمودار: شکل سیگنال با min/max حفظ می‌شود", () => {
  const samples = Array.from({ length: 300 }, (_, i) => ({ at: at(i), value: i % 50 === 0 ? 500 : 10 }));
  const chart = downsampleForChart(samples, 30);
  assert.ok(chart.length <= 30);
  assert.ok(chart.some((p) => p.max === 500), "اسپایک در کوچک‌سازی گم نمی‌شود");
  assert.ok(chart.every((p) => p.min <= p.avg && p.avg <= p.max));
  /* سری کوتاه دست‌نخورده رد می‌شود. */
  assert.equal(downsampleForChart(samples.slice(0, 5), 30).length, 5);
  assert.throws(() => downsampleForChart(samples, 0), RangeError);
});

/* ═══════════════════════ ۷. Store-and-Forward ═══════════════════════ */

test("بافر لبه: دسته از داده ساخته می‌شود و deterministic است", () => {
  const samples = [
    { channelCode: "CH-TEMP", at: at(10), value: 90 },
    { channelCode: "CH-WOB", at: at(5), value: 20 },
    { channelCode: "CH-TEMP", at: at(5), value: 88 },
  ];
  const a = buildStoreForwardBatch({ rigId: "RIG-1", gatewayCode: "GW-01", capturedAt: at(60), samples });
  const b = buildStoreForwardBatch({ rigId: "RIG-1", gatewayCode: "GW-01", capturedAt: at(60), samples: [...samples].reverse() });
  assert.equal(a.batchNo, b.batchNo, "ترتیب ورودی، شمارهٔ دسته را عوض نمی‌کند");
  assert.equal(a.checksum, b.checksum, "چک‌سام به ترتیب فیلدها وابسته نیست");
  assert.equal(a.sampleCount, 3);
  assert.equal(a.fromAt, at(5));
  assert.equal(a.toAt, at(10));
  assert.equal(a.payload.samples[0].at, at(5), "نمونه‌ها بر پایهٔ زمان مرتب می‌شوند");
});

test("بافر لبه: چک‌سام، دست‌خوردگی داده را لو می‌دهد", () => {
  const batch = buildStoreForwardBatch({
    rigId: "RIG-1", gatewayCode: "GW-01", capturedAt: at(0),
    samples: [{ channelCode: "CH-TEMP", at: at(1), value: 100 }],
  });
  assert.deepEqual(verifyBatch({ checksum: batch.checksum, payload: batch.payload, sampleCount: batch.sampleCount }), { ok: true, code: null });
  const tampered = { ...batch.payload, samples: [{ channelCode: "CH-TEMP", at: at(1), value: 999 }] };
  assert.equal(verifyBatch({ checksum: batch.checksum, payload: tampered, sampleCount: 1 }).code, "E-IIOT-BATCH-CHECKSUM");
  assert.equal(verifyBatch({ checksum: batch.checksum, payload: batch.payload, sampleCount: 5 }).code, "E-IIOT-BATCH-COUNT-MISMATCH");
  assert.equal(verifyBatch({ checksum: batch.checksum, payload: {} }).code, "E-IIOT-BATCH-NO-SAMPLES");
  assert.equal(verifyBatch(null).code, "E-IIOT-BATCH-MALFORMED");
});

test("بافر لبه: JSON کانونی، ترتیب کلیدها را خنثی می‌کند", () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.equal(checksumOf({ a: 1, b: [1, 2] }), checksumOf({ b: [1, 2], a: 1 }));
  assert.notEqual(checksumOf({ a: 1 }), checksumOf({ a: 2 }));
});

test("بافر لبه: گذار وضعیت و نامهٔ مرده پس از سقف تلاش", () => {
  assert.deepEqual(nextBufferStatus({ status: "buffered", attempts: 0, maxAttempts: 3, delivered: true }), { status: "sent", attempts: 1, code: null });
  const first = nextBufferStatus({ status: "buffered", attempts: 0, maxAttempts: 3, delivered: false });
  assert.equal(first.status, "failed");
  const second = nextBufferStatus({ status: "failed", attempts: 1, maxAttempts: 3, delivered: false });
  assert.equal(second.status, "failed");
  const third = nextBufferStatus({ status: "failed", attempts: 2, maxAttempts: 3, delivered: false });
  assert.equal(third.status, "dead-letter", "پس از سه تلاش، داده گم نمی‌شود — به نامهٔ مرده می‌رود");
  assert.equal(third.code, "E-IIOT-MAX-ATTEMPTS");
  /* دستهٔ ارسال‌شده، دوباره ارسال نمی‌شود. */
  assert.equal(nextBufferStatus({ status: "sent", attempts: 1, maxAttempts: 3, delivered: false }).code, "E-IIOT-ALREADY-SENT");
  assert.equal(nextBufferStatus({ status: "dead-letter", attempts: 3, maxAttempts: 3, delivered: true }).code, "E-IIOT-DEAD-LETTER");
});

test("بافر لبه: قطعی لینک یعنی «صبر»، نه خطا", () => {
  const buffer = [
    { status: "buffered", capturedAt: at(30) },
    { status: "buffered", capturedAt: at(10) },
    { status: "sent", capturedAt: at(5) },
    { status: "failed", capturedAt: at(20) },
    { status: "dead-letter", capturedAt: at(1) },
  ];
  const offline = selectBufferedForSync(buffer, { connectivityOnline: false });
  assert.deepEqual(offline, [], "با لینک قطع، چیزی برای ارسال نیست");
  const online = selectBufferedForSync(buffer, { connectivityOnline: true, limit: 10 });
  assert.deepEqual(online.map((b) => b.capturedAt), [at(10), at(20), at(30)], "FIFO بر پایهٔ زمان گرفتن");
  assert.equal(selectBufferedForSync(buffer, { connectivityOnline: true, limit: 1 }).length, 1);
});

test("بافر لبه: درصد پرشدن برای هشدار سرریز", () => {
  assert.equal(bufferFillPct(500, 1000), 50);
  assert.equal(bufferFillPct(2000, 1000), 100, "سرریز، بیشتر از ۱۰۰٪ گزارش نمی‌شود");
  assert.equal(bufferFillPct(10, 0), 0, "ظرفیت صفر، درصد نمی‌سازد");
});

/* ═══════════════════════ ۸. توقف دکل و NPT ═══════════════════════ */

test("NPT: دسته‌بندی، کد IADC و مسئولیت پیش‌فرض", () => {
  const equipment = classifyDowntime("equipment");
  assert.equal(equipment.nptCode, NPT_CATEGORY_MAP.equipment.nptCode);
  assert.equal(equipment.isNpt, true);
  assert.equal(equipment.downtimeType, "non-productive");
  assert.equal(equipment.responsibilityFa, "پیمانکار");

  const weather = classifyDowntime("weather");
  assert.equal(weather.responsibilityFa, "فورس‌ماژور");

  const unknown = classifyDowntime("چیز-ناشناخته");
  assert.equal(unknown.category, "other", "دستهٔ ناشناخته به «سایر» می‌رود نه خطا");

  /* قید اسکیما: IsNpt=1 فقط با non-productive سازگار است. */
  const planned = classifyDowntime("equipment", { downtimeType: "planned" });
  assert.equal(planned.isNpt, false);
  assert.equal(planned.downtimeType, "planned");
});

test("NPT: مدت توقف بسته و باز", () => {
  assert.equal(downtimeMinutesOf({ startedAt: at(0), endedAt: at(5400) }, at(9999)), 90);
  assert.equal(downtimeMinutesOf({ startedAt: at(0), endedAt: null }, at(3600)), 60, "توقف باز تا «الان» شمرده می‌شود");
  assert.equal(downtimeMinutesOf({ startedAt: at(100), endedAt: at(10) }, at(200)), 0, "بازهٔ معکوس، منفی نمی‌دهد");
  assert.equal(downtimeMinutesOf({ startedAt: "نه-زمان", endedAt: null }, at(10)), null);
});

test("NPT: جمع‌بندی با تفکیک دسته و درصد نامولّد", () => {
  const rows = [
    { startedAt: at(0), endedAt: at(3600), isNpt: true, category: "equipment" },
    { startedAt: at(3600), endedAt: at(5400), isNpt: true, category: "weather" },
    { startedAt: at(5400), endedAt: at(10800), isNpt: false, category: "cementing" },
    { startedAt: at(10800), endedAt: null, isNpt: true, category: "mud" },
  ];
  const summary = nptSummary(rows, at(14400));
  assert.equal(summary.totalMinutes, 240);
  /* ۶۰ (تجهیز) + ۳۰ (هوا) + ۶۰ (گِل، باز) = ۱۵۰ دقیقهٔ نامولّد از ۲۴۰. */
  assert.equal(summary.nptMinutes, 150);
  assert.equal(summary.nptPct, 62.5);
  assert.equal(summary.openCount, 1, "توقف باز شمرده می‌شود");
  /* سیمان‌کاری (NPT-7.1) عملیات برنامه‌ریزی‌شده است: نه NPT، نه مولّد. */
  assert.equal(summary.plannedMinutes, 90, "سیمان‌کاری در ستون «برنامه‌ریزی‌شده» می‌نشیند");
  assert.equal(summary.productiveMinutes, 0);
  /* دسته‌ها بر پایهٔ دقیقه، نزولی مرتب می‌شوند. */
  assert.deepEqual(summary.byCategory.map((c) => c.category), ["cementing", "equipment", "mud", "weather"]);
  const equipment = summary.byCategory.find((c) => c.category === "equipment");
  assert.equal(equipment.minutes, 60);
  assert.equal(equipment.count, 1);
  assert.equal(equipment.responsibilityFa, "پیمانکار");
  assert.equal(summary.modelVersion, IIOT_DOMAIN_VERSION);
  /* بدون داده، درصد صفر است نه NaN. */
  assert.equal(nptSummary([], at(0)).nptPct, 0);
});

test("NPT: شایستگی ادعا بر پایهٔ آستانه و مسئولیت", () => {
  assert.equal(claimWorthy({ minutes: 300, responsibilityFa: "کارفرما", thresholdMinutes: 240 }), true);
  assert.equal(claimWorthy({ minutes: 100, responsibilityFa: "کارفرما", thresholdMinutes: 240 }), false, "زیر آستانه، ادعا نمی‌سازد");
  assert.equal(claimWorthy({ minutes: 500, responsibilityFa: "پیمانکار", thresholdMinutes: 240 }), false, "تقصیر خود پیمانکار، مبنای ادعا نیست");
  assert.equal(claimWorthy({ minutes: 500, responsibilityFa: "کارفرما", thresholdMinutes: 0 }), false, "آستانهٔ صفر یعنی غیرفعال");
});

/* ═══════════════════════ ۹. یکپارچگی بین‌بخشی ═══════════════════════ */

test("یکپارچگی: تجزیهٔ مقصدها و حذف مقصد ناشناخته", () => {
  assert.deepEqual(parseDispatchTargets("cmms,mes,pmis"), ["cmms", "mes", "pmis"]);
  assert.deepEqual(parseDispatchTargets(" cmms , erp ,mes"), ["cmms", "mes"], "مقصد ناشناخته دور ریخته می‌شود");
  assert.deepEqual(parseDispatchTargets("cmms,cmms"), ["cmms"], "مقصد تکراری یک بار شمرده می‌شود");
  assert.deepEqual(parseDispatchTargets(null), []);
  assert.deepEqual(parseDispatchTargets(""), []);
});

test("یکپارچگی: ارسال خودکار فقط برای هشدار بحرانی با مقصد مشخص", () => {
  assert.equal(shouldDispatch({ level: "critical", autoDispatch: true, targets: "cmms,mes" }).dispatch, true);
  const noAuto = shouldDispatch({ level: "critical", autoDispatch: false, targets: "cmms" });
  assert.equal(noAuto.dispatch, false);
  assert.ok(noAuto.reasons.includes("E-IIOT-AUTO-DISPATCH-OFF"));
  const warning = shouldDispatch({ level: "warning", autoDispatch: true, targets: "cmms" });
  assert.equal(warning.dispatch, false, "هشدار غیربحرانی، صف نت را پر نمی‌کند");
  assert.ok(warning.reasons.includes("E-IIOT-NOT-CRITICAL"));
  assert.equal(shouldDispatch({ level: "warning", autoDispatch: true, targets: "cmms", allowWarning: true }).dispatch, true);
  const noTarget = shouldDispatch({ level: "critical", autoDispatch: true, targets: null });
  assert.equal(noTarget.dispatch, false);
  assert.ok(noTarget.reasons.includes("E-IIOT-NO-TARGET"));
});

test("یکپارچگی: کلید ضدتکرار از داده ساخته می‌شود نه از زمان", () => {
  const a = idempotencyKeyOf("alert.critical", "cmms", "IotTelemetryAlert", "ALT-1");
  const b = idempotencyKeyOf("alert.critical", "cmms", "IotTelemetryAlert", "ALT-1");
  assert.equal(a, b, "تولید دوبارهٔ همان رویداد، کلید تازه نمی‌سازد");
  assert.notEqual(a, idempotencyKeyOf("alert.critical", "mes", "IotTelemetryAlert", "ALT-1"));
  assert.notEqual(a, idempotencyKeyOf("alert.resolved", "cmms", "IotTelemetryAlert", "ALT-1"));
  assert.ok(a.length <= 160, "کلید باید در ستون ۱۶۰ نویسه‌ای جا شود");
});

test("یکپارچگی: قرارداد و نوع رویداد هر مقصد", () => {
  assert.deepEqual(IIOT_INTEGRATION_CONTRACTS, { cmms: "iiot-cmms-v1", mes: "iiot-mes-v1", pmis: "iiot-pmis-v1" });
  assert.equal(eventTypeFor("cmms", "alert"), "alert.critical");
  assert.equal(eventTypeFor("mes", "downtime"), "downtime.npt");
  assert.equal(eventTypeFor("pmis", "downtime-closed"), "downtime.closed");
  assert.equal(eventTypeFor("cmms", "alert-resolved"), "alert.resolved");
  assert.equal(eventTypeFor("cmms", "condition"), "condition.reading");
});

/* ═══════════════════════ ۱۰. متن هشدار ═══════════════════════ */

test("متن هشدار: عنوان و پیام از داده ساخته می‌شوند، نه رشتهٔ ثابت", () => {
  const stickSlipTitle = alertTitleFa({ detectKind: "stick-slip", signal: "torque", channelNameFa: "گشتاور رشته", level: "critical" });
  assert.ok(stickSlipTitle.includes("Stick-Slip"));
  assert.ok(stickSlipTitle.includes("بحرانی"));

  const thresholdTitle = alertTitleFa({
    detectKind: "threshold", signal: "temperature", channelNameFa: "دمای یاتاقان",
    value: 135.5, unit: "C", threshold: 120, level: "critical",
  });
  assert.ok(thresholdTitle.includes("دمای یاتاقان"));
  assert.ok(thresholdTitle.includes("135.5"));
  assert.ok(thresholdTitle.includes("120"));

  const pumpTitle = alertTitleFa({ detectKind: "pump-drop", signal: "mud-pump-pressure", level: "warning", value: 2100 });
  assert.ok(pumpTitle.includes("افت فشار پمپ گل"));
  assert.ok(pumpTitle.includes("هشدار"));

  const message = alertMessageFa({
    detectKind: "stick-slip",
    metrics: { torqueCv: 32.5, rpmSwingPct: 71.2, dropPct: null, zScore: null },
    sampleCount: 12, durationSeconds: 11, filteredValue: 71.2, triggerValue: 32.5,
  });
  assert.ok(message.includes("CV گشتاور: 32.5%"));
  assert.ok(message.includes("نوسان RPM: 71.2%"));
  assert.ok(message.includes("نمونه‌های بررسی‌شده: 12"));
});

test("کاتالوگ کمیت‌ها: همهٔ انواع سیگنال عنوان دوزبانه و واحد دارند", () => {
  assert.equal(SIGNAL_TYPES.length, 12);
  for (const signal of SIGNAL_TYPES) {
    assert.ok(SIGNAL_LABELS[signal]?.fa, `${signal} عنوان فارسی ندارد`);
    assert.ok(SIGNAL_LABELS[signal]?.en, `${signal} عنوان انگلیسی ندارد`);
    assert.ok(SIGNAL_LABELS[signal]?.unit, `${signal} واحد ندارد`);
  }
});
