/* GENERATED از src/services/iiotDomain.ts — ویرایش دستی ممنوع. بازتولید: npm run build:iiot */

// src/services/iiotDomain.ts
var IIOT_DOMAIN_VERSION = "iiot-v1";
var SIGNAL_TYPES = [
  "wob",
  "rpm",
  "torque",
  "mud-pump-pressure",
  "flow-rate",
  "temperature",
  "vibration",
  "rop",
  "depth",
  "standpipe-pressure",
  "hookload",
  "gas"
];
var SIGNAL_LABELS = {
  wob: { fa: "\u0648\u0632\u0646 \u0631\u0648\u06CC \u0645\u062A\u0647 (WOB)", en: "Weight on Bit", unit: "klbf" },
  rpm: { fa: "\u062F\u0648\u0631 \u0645\u062A\u0647 (RPM)", en: "Rotary Speed", unit: "rpm" },
  torque: { fa: "\u06AF\u0634\u062A\u0627\u0648\u0631 \u0631\u0634\u062A\u0647 \u062D\u0641\u0627\u0631\u06CC", en: "String Torque", unit: "kft\xB7lbf" },
  "mud-pump-pressure": { fa: "\u0641\u0634\u0627\u0631 \u067E\u0645\u067E \u06AF\u0644", en: "Mud Pump Pressure", unit: "psi" },
  "flow-rate": { fa: "\u062F\u0628\u06CC \u06AF\u0644", en: "Flow Rate", unit: "gpm" },
  temperature: { fa: "\u062F\u0645\u0627", en: "Temperature", unit: "\xB0C" },
  vibration: { fa: "\u0627\u0631\u062A\u0639\u0627\u0634", en: "Vibration RMS", unit: "mm/s" },
  rop: { fa: "\u0646\u0631\u062E \u0646\u0641\u0648\u0630 (ROP)", en: "Rate of Penetration", unit: "ft/hr" },
  depth: { fa: "\u0639\u0645\u0642 \u0686\u0627\u0647", en: "Hole Depth", unit: "m" },
  "standpipe-pressure": { fa: "\u0641\u0634\u0627\u0631 \u0644\u0648\u0644\u0647 \u0642\u0627\u0626\u0645 (SPP)", en: "Standpipe Pressure", unit: "psi" },
  hookload: { fa: "\u0628\u0627\u0631 \u0647\u0648\u06A9", en: "Hookload", unit: "klbf" },
  gas: { fa: "\u06AF\u0627\u0632 \u06A9\u0644", en: "Total Gas", unit: "%" }
};
var FILTER_METHODS = ["none", "sma", "ema", "median"];
var DETECTION_KINDS = ["threshold", "rate-of-change", "stick-slip", "pump-drop", "flatline", "spike"];
var toNum = (v) => {
  if (v === null || v === void 0) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
function round(value, digits = 4) {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}
function numbersOf(values) {
  const out = [];
  for (const v of values) {
    const n = toNum(v);
    if (n !== null) out.push(n);
  }
  return out;
}
function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function stddev(values) {
  if (values.length < 2) return null;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
function minOf(values) {
  return values.length ? Math.min(...values) : null;
}
function maxOf(values) {
  return values.length ? Math.max(...values) : null;
}
function coefficientOfVariation(values) {
  const m = mean(values);
  const sd = stddev(values);
  if (m === null || sd === null || m === 0) return null;
  return sd / Math.abs(m) * 100;
}
function zScore(value, values) {
  const m = mean(values);
  const sd = stddev(values);
  if (m === null || sd === null || sd === 0) return null;
  return (value - m) / sd;
}
function pctChange(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return (to - from) / Math.abs(from) * 100;
}
function secondsBetween(fromIso, toIso) {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / 1e3;
}
function minutesBetween(fromIso, toIso) {
  const s = secondsBetween(fromIso, toIso);
  return s === null ? null : round(s / 60, 3);
}
function bucketStartOf(atIso, bucketSeconds) {
  const t = Date.parse(atIso);
  if (Number.isNaN(t) || !(bucketSeconds > 0)) throw new RangeError("bucketStartOf: \u0632\u0645\u0627\u0646 \u06CC\u0627 \u0627\u0646\u062F\u0627\u0632\u0647\u0654 \u0633\u0637\u0644 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A");
  const ms = bucketSeconds * 1e3;
  return new Date(Math.floor(t / ms) * ms).toISOString();
}
function windowSizeOf(config, fallbackRateHz = 1) {
  const rate = config.sampleRateHz && config.sampleRateHz > 0 ? config.sampleRateHz : fallbackRateHz;
  const seconds = config.windowSeconds && config.windowSeconds > 0 ? config.windowSeconds : 1;
  return Math.max(1, Math.round(seconds * rate));
}
function movingAverage(values, windowSize) {
  if (values.length === 0) return null;
  const w = windowSize && windowSize > 0 ? Math.min(windowSize, values.length) : values.length;
  const slice = values.slice(-w);
  return mean(slice);
}
function smaSeries(values, windowSize) {
  if (!(windowSize > 0)) throw new RangeError("smaSeries: \u0627\u0646\u062F\u0627\u0632\u0647\u0654 \u067E\u0646\u062C\u0631\u0647 \u0628\u0627\u06CC\u062F \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F");
  const out = [];
  for (let i = 0; i < values.length; i++) {
    out.push(i + 1 < windowSize ? null : mean(values.slice(i + 1 - windowSize, i + 1)));
  }
  return out;
}
function emaSeries(values, alpha) {
  if (!(alpha > 0 && alpha <= 1)) throw new RangeError("emaSeries: \u0622\u0644\u0641\u0627 \u0628\u0627\u06CC\u062F \u062F\u0631 \u0628\u0627\u0632\u0647\u0654 (\u06F0,\u06F1] \u0628\u0627\u0634\u062F");
  const out = [];
  let prev = null;
  for (const v of values) {
    prev = prev === null ? v : alpha * v + (1 - alpha) * prev;
    out.push(prev);
  }
  return out;
}
function medianFilter(values, windowSize) {
  if (!(windowSize > 0)) throw new RangeError("medianFilter: \u0627\u0646\u062F\u0627\u0632\u0647\u0654 \u067E\u0646\u062C\u0631\u0647 \u0628\u0627\u06CC\u062F \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F");
  const out = [];
  for (let i = 0; i < values.length; i++) {
    out.push(i + 1 < windowSize ? null : median(values.slice(i + 1 - windowSize, i + 1)));
  }
  return out;
}
var SignalFilter = class {
  method;
  windowSize;
  alpha;
  minSamples;
  deadbandPct;
  buffer = [];
  emaState = null;
  lastReported = null;
  count = 0;
  constructor(config = {}, fallbackRateHz = 1) {
    this.method = FILTER_METHODS.includes(config.method ?? "sma") ? config.method : "sma";
    this.windowSize = this.method === "ema" ? Math.max(2, windowSizeOf(config, fallbackRateHz)) : windowSizeOf(config, fallbackRateHz);
    this.alpha = config.alpha && config.alpha > 0 && config.alpha <= 1 ? config.alpha : 2 / (this.windowSize + 1);
    this.minSamples = config.minSamples && config.minSamples > 0 ? config.minSamples : Math.min(this.windowSize, 3);
    this.deadbandPct = config.deadbandPct && config.deadbandPct > 0 ? config.deadbandPct : 0;
  }
  get samples() {
    return this.count;
  }
  get isReady() {
    return this.count >= this.minSamples;
  }
  push(value) {
    const v = toNum(value);
    if (v === null) return { value: NaN, filtered: null, ready: false, changed: false };
    this.count += 1;
    this.buffer.push(v);
    if (this.buffer.length > this.windowSize) this.buffer.shift();
    let filtered;
    if (!this.isReady) filtered = null;
    else if (this.method === "none") filtered = v;
    else if (this.method === "ema") {
      this.emaState = this.emaState === null ? v : this.alpha * v + (1 - this.alpha) * this.emaState;
      filtered = this.emaState;
    } else if (this.method === "median") filtered = median(this.buffer);
    else filtered = mean(this.buffer);
    let changed = true;
    if (filtered !== null && this.lastReported !== null && this.deadbandPct > 0) {
      const delta = pctChange(this.lastReported, filtered);
      changed = delta === null || Math.abs(delta) >= this.deadbandPct;
    }
    if (filtered !== null && (changed || this.lastReported === null)) this.lastReported = filtered;
    return { value: v, filtered, ready: this.isReady, changed };
  }
  /** آخرین مقدار فیلترشده — بدون افزودن نمونه. */
  current() {
    if (!this.isReady) return null;
    if (this.method === "none") return this.buffer.length ? this.buffer[this.buffer.length - 1] : null;
    if (this.method === "ema") return this.emaState;
    if (this.method === "median") return median(this.buffer);
    return mean(this.buffer);
  }
};
function filterSeries(values, config = {}, fallbackRateHz = 1) {
  const method = FILTER_METHODS.includes(config.method ?? "sma") ? config.method : "sma";
  const minSamples = config.minSamples && config.minSamples > 0 ? config.minSamples : 0;
  const raw = method === "none" ? values.map((v) => v) : method === "ema" ? emaSeries(values, config.alpha && config.alpha > 0 && config.alpha <= 1 ? config.alpha : 2 / (windowSizeOf(config, fallbackRateHz) + 1)) : method === "median" ? medianFilter(values, windowSizeOf(config, fallbackRateHz)) : smaSeries(values, windowSizeOf(config, fallbackRateHz));
  if (minSamples <= 0) return raw;
  return raw.map((v, i) => i + 1 < minSamples ? null : v);
}
function signalQualityReport(samples, options = {}) {
  const flatlineSeconds = options.flatlineSeconds && options.flatlineSeconds > 0 ? options.flatlineSeconds : 60;
  const spikeZ = options.spikeZThreshold && options.spikeZThreshold > 0 ? options.spikeZThreshold : 4;
  const rate = options.sampleRateHz && options.sampleRateHz > 0 ? options.sampleRateHz : 1;
  const counts = { good: 0, suspect: 0, bad: 0, stale: 0 };
  const values = [];
  for (const s of samples) {
    const q = s.quality && ["good", "suspect", "bad", "stale"].includes(s.quality) ? s.quality : "good";
    counts[q] += 1;
    const v = toNum(s.value);
    if (v !== null) values.push(v);
  }
  const total = samples.length;
  const qualityPct = total === 0 ? 0 : round(counts.good / total * 100, 2);
  const needSamples = Math.max(3, Math.round(flatlineSeconds * rate));
  const tail = values.slice(-needSamples);
  const allEqual = tail.length >= needSamples && tail.every((v) => v === tail[0]);
  let frozenSeconds = null;
  if (allEqual && samples.length >= needSamples) {
    const last = samples.slice(-needSamples);
    const firstAt = last[0]?.at;
    const lastAt = last[last.length - 1]?.at;
    frozenSeconds = firstAt && lastAt ? secondsBetween(firstAt, lastAt) : null;
    if (frozenSeconds === null) frozenSeconds = round((needSamples - 1) / rate, 3);
  }
  const spikes = [];
  if (values.length >= 5) {
    values.forEach((v, index) => {
      const z = zScore(v, values);
      if (z !== null && Math.abs(z) >= spikeZ) spikes.push({ index, value: v, z: round(z, 3) });
    });
  }
  return {
    total,
    ...counts,
    qualityPct,
    frozen: allEqual,
    frozenSeconds: frozenSeconds === null ? null : round(frozenSeconds, 3),
    spikeCount: spikes.length,
    spikes
  };
}
function compareHits(comparison, value, threshold, secondary) {
  switch (comparison) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "band-out":
      return secondary === null ? false : value < Math.min(threshold, secondary) || value > Math.max(threshold, secondary);
    case "rate":
      return false;
    default:
      return false;
  }
}
function evaluateThreshold(series, rule, options = {}) {
  const level = rule.level === "critical" ? "critical" : "warning";
  const detectKind = DETECTION_KINDS.includes(rule.detectKind ?? "threshold") ? rule.detectKind : "threshold";
  const comparison = ["gt", "gte", "lt", "lte", "band-out", "rate"].includes(rule.comparison ?? "gt") ? rule.comparison : "gt";
  const minSamples = rule.minSamples && rule.minSamples > 0 ? rule.minSamples : 1;
  const durationSeconds = rule.durationSeconds && rule.durationSeconds > 0 ? rule.durationSeconds : 0;
  const threshold = toNum(rule.thresholdValue);
  const secondary = toNum(rule.secondaryValue);
  const base = {
    breach: false,
    level,
    detectKind,
    comparison,
    breachSamples: 0,
    breachSeconds: 0,
    triggerValue: null,
    filteredValue: null,
    baselineValue: null,
    deviationPct: null,
    sustained: false,
    reasons: [],
    metrics: {}
  };
  const clean = series.filter((p) => p.value !== null && Number.isFinite(p.value));
  if (clean.length === 0) {
    base.reasons.push("E-IIOT-NO-DATA");
    return base;
  }
  if (options.nowIso && options.staleAfterSeconds && options.staleAfterSeconds > 0) {
    const age = secondsBetween(clean[clean.length - 1].at, options.nowIso);
    if (age !== null && age > options.staleAfterSeconds) {
      base.reasons.push("E-IIOT-STALE-DATA");
      base.metrics = { dataAgeSeconds: round(age, 3) };
      return base;
    }
  }
  if (detectKind === "rate-of-change" || comparison === "rate") {
    if (clean.length < 2) {
      base.reasons.push("E-IIOT-NEED-2-SAMPLES");
      return base;
    }
    const first = clean[0];
    const last = clean[clean.length - 1];
    const span = secondsBetween(first.at, last.at);
    if (span === null || span <= 0) {
      base.reasons.push("E-IIOT-ZERO-SPAN");
      return base;
    }
    const ratePerSec = (last.value - first.value) / span;
    const limit = threshold ?? 0;
    const exceeded = Math.abs(ratePerSec) > Math.abs(limit);
    base.metrics = { ratePerSecond: round(ratePerSec, 6), limit, spanSeconds: round(span, 3) };
    base.triggerValue = round(ratePerSec, 6);
    base.filteredValue = last.value;
    base.baselineValue = first.value;
    base.deviationPct = pctChange(first.value, last.value) === null ? null : round(pctChange(first.value, last.value), 3);
    base.breachSamples = exceeded ? clean.length : 0;
    base.breachSeconds = exceeded ? round(span, 3) : 0;
    base.breach = exceeded;
    base.sustained = exceeded && clean.length >= minSamples && base.breachSeconds >= durationSeconds;
    if (exceeded && !base.sustained) base.reasons.push("E-IIOT-NOT-SUSTAINED");
    return base;
  }
  if (threshold === null) {
    base.reasons.push("E-IIOT-NO-THRESHOLD");
    return base;
  }
  let breachSamples = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    if (compareHits(comparison, clean[i].value, threshold, secondary)) breachSamples += 1;
    else break;
  }
  const breachPoints = clean.slice(clean.length - breachSamples);
  let breachSeconds = 0;
  if (breachPoints.length >= 2) {
    const s = secondsBetween(breachPoints[0].at, breachPoints[breachPoints.length - 1].at);
    breachSeconds = s === null ? 0 : Math.max(0, s);
  }
  const lastPoint = clean[clean.length - 1];
  const baselineValues = clean.slice(0, Math.max(1, Math.floor(clean.length / 2))).map((p) => p.value);
  const baseline = mean(baselineValues);
  base.breachSamples = breachSamples;
  base.breachSeconds = round(breachSeconds, 3);
  base.breach = breachSamples > 0;
  base.triggerValue = lastPoint.value;
  base.filteredValue = lastPoint.value;
  base.baselineValue = baseline === null ? null : round(baseline, 4);
  base.deviationPct = baseline === null ? null : round(pctChange(baseline, lastPoint.value) ?? 0, 3);
  base.sustained = breachSamples >= minSamples && breachSeconds >= durationSeconds;
  if (breachSamples > 0 && breachSamples < minSamples) base.reasons.push("E-IIOT-BELOW-MIN-SAMPLES");
  if (breachSamples >= minSamples && breachSeconds < durationSeconds) base.reasons.push("E-IIOT-NOT-SUSTAINED");
  return base;
}
function recoveredBelowHysteresis(value, rule) {
  const threshold = toNum(rule.thresholdValue);
  if (threshold === null) return true;
  const comparison = ["gt", "gte", "lt", "lte", "band-out", "rate"].includes(rule.comparison ?? "gt") ? rule.comparison : "gt";
  const hysteresisPct = rule.hysteresisPct && rule.hysteresisPct > 0 ? rule.hysteresisPct : 0;
  const band = Math.abs(threshold) * (hysteresisPct / 100);
  if (comparison === "lt" || comparison === "lte") return value >= threshold + band;
  return value <= threshold - band;
}
function inCooldown(lastAlertAtIso, nowIso, cooldownSeconds) {
  if (!lastAlertAtIso) return false;
  if (!(cooldownSeconds > 0)) return false;
  const gap = secondsBetween(lastAlertAtIso, nowIso);
  return gap !== null && gap < cooldownSeconds;
}
function statusColorFor(filteredValue, thresholds) {
  if (filteredValue === null || !Number.isFinite(filteredValue)) return "normal";
  const order = ["critical", "warning"];
  for (const level of order) {
    for (const t of thresholds.filter((x) => x.level === level)) {
      const threshold = toNum(t.thresholdValue);
      if (threshold === null) continue;
      const comparison = t.comparison ?? "gt";
      const hit = comparison === "band-out" ? toNum(t.secondaryValue) !== null && (filteredValue < Math.min(threshold, toNum(t.secondaryValue)) || filteredValue > Math.max(threshold, toNum(t.secondaryValue))) : compareHits(comparison, filteredValue, threshold, null);
      if (hit) return level;
    }
  }
  return "normal";
}
function detectStickSlip(input, config = {}) {
  const torque = numbersOf(input.torque);
  const rpm = numbersOf(input.rpm);
  const rate = input.sampleRateHz && input.sampleRateHz > 0 ? input.sampleRateHz : 1;
  const windowRequest = input.windowSeconds ?? config.windowSeconds;
  const windowSeconds = windowRequest && windowRequest > 0 ? windowRequest : 0;
  const minSamples = config.minSamples && config.minSamples > 0 ? config.minSamples : 10;
  const out = {
    detected: false,
    severity: "none",
    torqueMean: null,
    torqueStdDev: null,
    torqueCv: null,
    rpmMean: null,
    rpmMin: null,
    rpmMax: null,
    rpmSwingPct: null,
    sampleCount: 0,
    windowSeconds: 0,
    reasons: []
  };
  const maxSamples = windowSeconds > 0 ? Math.max(minSamples, Math.round(windowSeconds * rate)) : Number.POSITIVE_INFINITY;
  const n = Math.min(torque.length, rpm.length, maxSamples);
  out.sampleCount = n;
  out.windowSeconds = n > 1 ? round((n - 1) / rate, 3) : 0;
  if (n < minSamples) {
    out.reasons.push("E-IIOT-BELOW-MIN-SAMPLES");
    return out;
  }
  const t = torque.slice(-n);
  const r = rpm.slice(-n);
  const torqueMean = mean(t);
  const torqueStdDev = stddev(t);
  const torqueCv = coefficientOfVariation(t);
  const rpmMean = mean(r);
  const rpmMin = minOf(r);
  const rpmMax = maxOf(r);
  const rpmSwingPct = rpmMean === null || rpmMean === 0 || rpmMin === null || rpmMax === null ? null : (rpmMax - rpmMin) / Math.abs(rpmMean) * 100;
  out.torqueMean = torqueMean === null ? null : round(torqueMean, 4);
  out.torqueStdDev = torqueStdDev === null ? null : round(torqueStdDev, 4);
  out.torqueCv = torqueCv === null ? null : round(torqueCv, 4);
  out.rpmMean = rpmMean === null ? null : round(rpmMean, 4);
  out.rpmMin = rpmMin;
  out.rpmMax = rpmMax;
  out.rpmSwingPct = rpmSwingPct === null ? null : round(rpmSwingPct, 4);
  const cvLimit = config.torqueCvThreshold && config.torqueCvThreshold > 0 ? config.torqueCvThreshold : 10;
  const swingLimit = config.rpmSwingPctThreshold && config.rpmSwingPctThreshold > 0 ? config.rpmSwingPctThreshold : 15;
  const torqueOscillating = torqueCv !== null && torqueCv >= cvLimit;
  const rpmIrregular = rpmSwingPct !== null && rpmSwingPct >= swingLimit;
  if (!torqueOscillating) out.reasons.push("E-IIOT-TORQUE-CV-LOW");
  if (!rpmIrregular) out.reasons.push("E-IIOT-RPM-SWING-LOW");
  out.detected = torqueOscillating && rpmIrregular;
  if (out.detected && torqueCv !== null) {
    const ratio = torqueCv / cvLimit;
    out.severity = ratio >= 3 ? "severe" : ratio >= 2 ? "moderate" : "mild";
  }
  return out;
}
function detectPumpPressureDrop(pressure, config = {}) {
  const values = numbersOf(pressure);
  const minSamples = config.minSamples && config.minSamples > 0 ? config.minSamples : 10;
  const dropLimit = config.dropPctThreshold && config.dropPctThreshold > 0 ? config.dropPctThreshold : 15;
  const baselineRatio = config.baselineRatio && config.baselineRatio > 0 && config.baselineRatio < 1 ? config.baselineRatio : 0.5;
  const floor = toNum(config.absoluteFloor ?? null);
  const out = { detected: false, baseline: null, current: null, dropPct: null, absoluteFloorBreached: false, sampleCount: values.length, reasons: [] };
  if (values.length < minSamples) {
    out.reasons.push("E-IIOT-BELOW-MIN-SAMPLES");
    return out;
  }
  const baselineCount = Math.max(1, Math.floor(values.length * baselineRatio));
  const baseline = mean(values.slice(0, baselineCount));
  const current = mean(values.slice(-Math.max(1, Math.floor(values.length * 0.2))));
  out.baseline = baseline === null ? null : round(baseline, 4);
  out.current = current === null ? null : round(current, 4);
  out.dropPct = baseline === null || current === null ? null : round(-(pctChange(baseline, current) ?? 0), 4);
  out.absoluteFloorBreached = floor !== null && current !== null && current < floor;
  const dropDetected = out.dropPct !== null && out.dropPct >= dropLimit;
  if (!dropDetected && !out.absoluteFloorBreached) out.reasons.push("E-IIOT-NO-DROP");
  out.detected = dropDetected || out.absoluteFloorBreached;
  return out;
}
function evaluateDetectRule(rule, seriesBySignal, primarySignal, options = {}) {
  const kind = DETECTION_KINDS.includes(rule.detectKind ?? "threshold") ? rule.detectKind : "threshold";
  if (kind === "stick-slip") {
    const torque = (seriesBySignal.torque ?? []).map((p) => p.value).filter((v) => v !== null);
    const rpm = (seriesBySignal.rpm ?? []).map((p) => p.value).filter((v) => v !== null);
    const result = detectStickSlip(
      { torque, rpm, sampleRateHz: options.sampleRateHz, windowSeconds: options.windowSeconds },
      { torqueCvThreshold: toNum(rule.torqueCvThreshold ?? void 0) ?? void 0, rpmSwingPctThreshold: toNum(rule.rpmSwingPctThreshold ?? void 0) ?? void 0, minSamples: rule.minSamples }
    );
    const verdict = {
      breach: result.detected,
      level: rule.level === "critical" ? "critical" : "warning",
      detectKind: "stick-slip",
      comparison: "gt",
      breachSamples: result.detected ? result.sampleCount : 0,
      breachSeconds: result.detected ? result.windowSeconds : 0,
      triggerValue: result.torqueCv,
      filteredValue: result.rpmSwingPct,
      baselineValue: result.torqueMean,
      deviationPct: result.torqueCv === null ? null : round(result.torqueCv, 3),
      sustained: result.detected,
      reasons: result.reasons,
      metrics: {
        torqueCv: result.torqueCv,
        torqueMean: result.torqueMean,
        torqueStdDev: result.torqueStdDev,
        rpmSwingPct: result.rpmSwingPct,
        rpmMean: result.rpmMean,
        rpmMin: result.rpmMin,
        rpmMax: result.rpmMax,
        sampleCount: result.sampleCount
      }
    };
    return { verdict, stickSlip: result };
  }
  if (kind === "pump-drop") {
    const pressure = (seriesBySignal["mud-pump-pressure"] ?? seriesBySignal[primarySignal] ?? []).map((p) => p.value).filter((v) => v !== null);
    const result = detectPumpPressureDrop(pressure, {
      dropPctThreshold: toNum(rule.pressureDropPctThreshold ?? void 0) ?? void 0,
      minSamples: rule.minSamples,
      absoluteFloor: options.pumpFloor ?? toNum(rule.thresholdValue ?? null)
    });
    const verdict = {
      breach: result.detected,
      level: rule.level === "critical" ? "critical" : "warning",
      detectKind: "pump-drop",
      comparison: "lt",
      breachSamples: result.detected ? result.sampleCount : 0,
      breachSeconds: 0,
      triggerValue: result.current,
      filteredValue: result.current,
      baselineValue: result.baseline,
      deviationPct: result.dropPct === null ? null : round(-result.dropPct, 3),
      sustained: result.detected,
      reasons: result.reasons,
      metrics: { dropPct: result.dropPct, baseline: result.baseline, current: result.current, sampleCount: result.sampleCount }
    };
    return { verdict, pumpDrop: result };
  }
  const series = seriesBySignal[primarySignal] ?? [];
  if (kind === "flatline") {
    const points = series.filter((p) => p.value !== null);
    const values = points.map((p) => p.value);
    const rate = options.sampleRateHz && options.sampleRateHz > 0 ? options.sampleRateHz : 1;
    const need = Math.max(3, Math.round((options.windowSeconds && options.windowSeconds > 0 ? options.windowSeconds : 60) * rate));
    const tail = values.slice(-need);
    const frozen = tail.length >= need && tail.every((v) => v === tail[0]);
    const verdict = {
      breach: frozen,
      level: rule.level === "critical" ? "critical" : "warning",
      detectKind: "flatline",
      comparison: "gt",
      breachSamples: frozen ? tail.length : 0,
      breachSeconds: frozen && points.length >= 2 ? round(Math.max(0, secondsBetween(points[points.length - tail.length].at, points[points.length - 1].at) ?? 0), 3) : 0,
      triggerValue: frozen ? tail[0] : null,
      filteredValue: frozen ? tail[0] : null,
      baselineValue: null,
      deviationPct: null,
      sustained: frozen && tail.length >= (rule.minSamples ?? 1),
      reasons: frozen ? [] : ["E-IIOT-NOT-FROZEN"],
      metrics: { windowSamples: tail.length, requiredSamples: need }
    };
    return { verdict };
  }
  if (kind === "spike") {
    const points = series.filter((p) => p.value !== null);
    const values = points.map((p) => p.value);
    const limit = toNum(rule.thresholdValue) ?? 4;
    const last = values.length ? values[values.length - 1] : null;
    const z = last === null ? null : zScore(last, values);
    const hit = z !== null && Math.abs(z) >= limit;
    const verdict = {
      breach: hit,
      level: rule.level === "critical" ? "critical" : "warning",
      detectKind: "spike",
      comparison: "gt",
      breachSamples: hit ? 1 : 0,
      breachSeconds: 0,
      triggerValue: last,
      filteredValue: last,
      baselineValue: round(mean(values) ?? 0, 4),
      deviationPct: z === null ? null : round(Math.abs(z) * 100, 3),
      /* اسپایک ماهیتاً تک‌نمونه است؛ پایداری برایش معنا ندارد. این تنها
       * DetectionKind است که دروازهٔ duration روی آن اعمال نمی‌شود. */
      sustained: hit,
      reasons: hit ? [] : ["E-IIOT-NO-SPIKE"],
      metrics: { zScore: z === null ? null : round(z, 4), zLimit: limit }
    };
    return { verdict };
  }
  return { verdict: evaluateThreshold(series, rule) };
}
function rollupSamples(samples, bucketSeconds) {
  if (!(bucketSeconds > 0)) throw new RangeError("rollupSamples: \u0627\u0646\u062F\u0627\u0632\u0647\u0654 \u0633\u0637\u0644 \u0628\u0627\u06CC\u062F \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F");
  const byBucket = /* @__PURE__ */ new Map();
  for (const s of samples) {
    const v = toNum(s.value);
    if (v === null) continue;
    const key = bucketStartOf(s.at, bucketSeconds);
    if (!byBucket.has(key)) byBucket.set(key, []);
    byBucket.get(key).push({
      value: v,
      quality: s.quality && ["good", "suspect", "bad", "stale"].includes(s.quality) ? s.quality : "good"
    });
  }
  const out = [];
  for (const [bucketStart, rows] of [...byBucket.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const values = rows.map((r) => r.value);
    const bad = rows.filter((r) => r.quality === "bad" || r.quality === "stale").length;
    out.push({
      bucketStart,
      bucketSeconds,
      sampleCount: rows.length,
      badCount: bad,
      minValue: round(minOf(values), 6),
      maxValue: round(maxOf(values), 6),
      avgValue: round(mean(values), 6),
      stdDev: stddev(values) === null ? null : round(stddev(values), 6),
      firstValue: round(values[0], 6),
      lastValue: round(values[values.length - 1], 6),
      qualityPct: rows.length === 0 ? 0 : round((rows.length - bad) / rows.length * 100, 2)
    });
  }
  return out;
}
function downsampleForChart(samples, maxPoints = 120) {
  const points = samples.filter((s) => Number.isFinite(s.value));
  if (!(maxPoints > 0)) throw new RangeError("downsampleForChart: maxPoints \u0628\u0627\u06CC\u062F \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F");
  if (points.length <= maxPoints) {
    return points.map((p) => ({ at: p.at, min: p.value, max: p.value, avg: p.value, count: 1 }));
  }
  const stride = Math.ceil(points.length / maxPoints);
  const out = [];
  for (let i = 0; i < points.length; i += stride) {
    const chunk = points.slice(i, i + stride);
    const values = chunk.map((c) => c.value);
    out.push({
      at: chunk[0].at,
      min: round(minOf(values), 6),
      max: round(maxOf(values), 6),
      avg: round(mean(values), 6),
      count: chunk.length
    });
  }
  return out;
}
var BUFFER_STATUSES = ["buffered", "sending", "sent", "failed", "dead-letter"];
function checksumOf(value) {
  const text = canonicalJson(value);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `fnv1a-${h.toString(16).padStart(8, "0")}`;
}
function canonicalJson(value) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const src = v;
      const out = {};
      for (const key of Object.keys(src).sort()) out[key] = walk(src[key]);
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}
function buildStoreForwardBatch(input) {
  const samples = [...input.samples].sort((a, b) => a.at.localeCompare(b.at) || a.channelCode.localeCompare(b.channelCode));
  const times = samples.map((s) => s.at).filter((t) => !Number.isNaN(Date.parse(t))).sort();
  const payload = { rigId: input.rigId, gatewayCode: input.gatewayCode, samples };
  const capturedAt = !Number.isNaN(Date.parse(input.capturedAt)) ? new Date(Date.parse(input.capturedAt)).toISOString() : (/* @__PURE__ */ new Date(0)).toISOString();
  return {
    batchNo: `BUF-${input.gatewayCode}-${capturedAt.replace(/[:.]/g, "-")}`,
    gatewayCode: input.gatewayCode,
    rigId: input.rigId,
    capturedAt,
    fromAt: times[0] ?? capturedAt,
    toAt: times[times.length - 1] ?? capturedAt,
    sampleCount: samples.length,
    checksum: checksumOf(payload),
    payload
  };
}
function verifyBatch(batch) {
  if (!batch || typeof batch !== "object") return { ok: false, code: "E-IIOT-BATCH-MALFORMED" };
  if (typeof batch.payload !== "object" || batch.payload === null) return { ok: false, code: "E-IIOT-BATCH-NO-PAYLOAD" };
  const payload = batch.payload;
  if (!Array.isArray(payload.samples)) return { ok: false, code: "E-IIOT-BATCH-NO-SAMPLES" };
  if (typeof batch.sampleCount === "number" && batch.sampleCount !== payload.samples.length) return { ok: false, code: "E-IIOT-BATCH-COUNT-MISMATCH" };
  if (typeof batch.checksum === "string" && batch.checksum && batch.checksum !== checksumOf(batch.payload)) {
    return { ok: false, code: "E-IIOT-BATCH-CHECKSUM" };
  }
  return { ok: true, code: null };
}
function nextBufferStatus(input) {
  const attempts = Math.max(0, input.attempts | 0);
  const maxAttempts = input.maxAttempts > 0 ? input.maxAttempts : 5;
  if (input.status === "sent" || input.status === "dead-letter") {
    return { status: input.status, attempts, code: input.status === "sent" ? "E-IIOT-ALREADY-SENT" : "E-IIOT-DEAD-LETTER" };
  }
  if (input.delivered) return { status: "sent", attempts: attempts + 1, code: null };
  const next = attempts + 1;
  if (next >= maxAttempts) return { status: "dead-letter", attempts: next, code: "E-IIOT-MAX-ATTEMPTS" };
  return { status: next >= maxAttempts ? "dead-letter" : "failed", attempts: next, code: "E-IIOT-DELIVERY-FAILED" };
}
function selectBufferedForSync(buffer, options = { connectivityOnline: true }) {
  if (!options.connectivityOnline) return [];
  const limit = options.limit && options.limit > 0 ? options.limit : Infinity;
  return buffer.filter((b) => b.status === "buffered" || b.status === "failed").sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)).slice(0, limit);
}
function bufferFillPct(used, capacity) {
  if (!(capacity > 0)) return 0;
  return round(Math.min(100, Math.max(0, used) / capacity * 100), 2);
}
var DOWNTIME_CATEGORIES = [
  "equipment",
  "mud",
  "directional",
  "wellbore",
  "weather",
  "power",
  "logistics",
  "cementing",
  "waiting-on-decision",
  "other"
];
var NPT_CATEGORY_MAP = {
  equipment: { nptCode: "NPT-1.1", fa: "\u062E\u0631\u0627\u0628\u06CC \u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC/\u0628\u0631\u0642\u06CC", responsibilityFa: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", isNpt: true },
  mud: { nptCode: "NPT-2.3", fa: "\u0645\u0634\u06A9\u0644 \u0633\u06CC\u0633\u062A\u0645 \u06AF\u0644 \u0648 \u0633\u06CC\u0627\u0644 \u062D\u0641\u0627\u0631\u06CC", responsibilityFa: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", isNpt: true },
  directional: { nptCode: "NPT-3.2", fa: "\u0627\u0635\u0644\u0627\u062D \u0645\u0633\u06CC\u0631 \u0648 \u0645\u0634\u06A9\u0644 \u062C\u0647\u062A\u200C\u062F\u0647\u06CC", responsibilityFa: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", isNpt: true },
  wellbore: { nptCode: "NPT-4.1", fa: "\u0645\u0634\u06A9\u0644 \u0686\u0627\u0647 (\u06AF\u06CC\u0631\u06A9\u0631\u062F\u0646/\u0647\u0631\u0632\u0631\u0648\u06CC/\u0641\u0648\u0631\u0627\u0646)", responsibilityFa: "\u06A9\u0627\u0631\u0641\u0631\u0645\u0627", isNpt: true },
  weather: { nptCode: "NPT-5.1", fa: "\u0634\u0631\u0627\u06CC\u0637 \u062C\u0648\u06CC \u0648 \u0641\u0648\u0631\u0633\u200C\u0645\u0627\u0698\u0648\u0631", responsibilityFa: "\u0641\u0648\u0631\u0633\u200C\u0645\u0627\u0698\u0648\u0631", isNpt: true },
  power: { nptCode: "NPT-1.4", fa: "\u0642\u0637\u0639\u06CC \u0628\u0631\u0642 \u0648 \u0645\u0648\u0644\u062F", responsibilityFa: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", isNpt: true },
  logistics: { nptCode: "NPT-6.2", fa: "\u062A\u0623\u062E\u06CC\u0631 \u0644\u062C\u0633\u062A\u06CC\u06A9 \u0648 \u062A\u0623\u0645\u06CC\u0646", responsibilityFa: "\u06A9\u0627\u0631\u0641\u0631\u0645\u0627", isNpt: true },
  cementing: { nptCode: "NPT-7.1", fa: "\u0639\u0645\u0644\u06CC\u0627\u062A \u0633\u06CC\u0645\u0627\u0646\u200C\u06A9\u0627\u0631\u06CC", responsibilityFa: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", isNpt: false },
  "waiting-on-decision": { nptCode: "NPT-8.1", fa: "\u0627\u0646\u062A\u0638\u0627\u0631 \u0628\u0631\u0627\u06CC \u062A\u0635\u0645\u06CC\u0645 \u06A9\u0627\u0631\u0641\u0631\u0645\u0627", responsibilityFa: "\u06A9\u0627\u0631\u0641\u0631\u0645\u0627", isNpt: true },
  other: { nptCode: "NPT-9.9", fa: "\u0633\u0627\u06CC\u0631 \u0639\u0644\u0644", responsibilityFa: "\u0645\u0634\u062E\u0635\u200C\u0646\u0634\u062F\u0647", isNpt: true }
};
function classifyDowntime(category, overrides = {}) {
  const key = DOWNTIME_CATEGORIES.includes(category) ? category : "other";
  const map = NPT_CATEGORY_MAP[key];
  const isNpt = overrides.isNpt === void 0 ? map.isNpt : overrides.isNpt;
  const downtimeType = overrides.downtimeType ?? (isNpt ? "non-productive" : key === "cementing" ? "planned" : "productive");
  return {
    category: key,
    nptCode: overrides.nptCode ?? map.nptCode,
    isNpt: isNpt && downtimeType === "non-productive",
    downtimeType,
    responsibilityFa: map.responsibilityFa,
    causeFa: map.fa
  };
}
function downtimeMinutesOf(row, nowIso) {
  if (row.endedAt) {
    const m2 = minutesBetween(row.startedAt, row.endedAt);
    return m2 === null ? null : Math.max(0, m2);
  }
  const m = minutesBetween(row.startedAt, nowIso);
  return m === null ? null : Math.max(0, m);
}
function nptSummary(rows, nowIso) {
  const byCategory = /* @__PURE__ */ new Map();
  let total = 0;
  let npt = 0;
  let planned = 0;
  let productive = 0;
  let openCount = 0;
  for (const row of rows) {
    const minutes = downtimeMinutesOf(row, nowIso) ?? 0;
    total += minutes;
    if (!row.endedAt) openCount += 1;
    const info = NPT_CATEGORY_MAP[row.category ?? "other"] ?? NPT_CATEGORY_MAP.other;
    if (row.isNpt) npt += minutes;
    else if (info.nptCode.startsWith("NPT-7")) planned += minutes;
    else productive += minutes;
    const key = row.category ?? "other";
    const bucket = byCategory.get(key) ?? { category: key, nptCode: info.nptCode, minutes: 0, count: 0, responsibilityFa: info.responsibilityFa };
    bucket.minutes = round(bucket.minutes + minutes, 3);
    bucket.count += 1;
    byCategory.set(key, bucket);
  }
  return {
    totalMinutes: round(total, 3),
    productiveMinutes: round(productive, 3),
    nptMinutes: round(npt, 3),
    plannedMinutes: round(planned, 3),
    nptPct: total > 0 ? round(npt / total * 100, 2) : 0,
    byCategory: [...byCategory.values()].sort((a, b) => b.minutes - a.minutes),
    openCount,
    modelVersion: IIOT_DOMAIN_VERSION
  };
}
function claimWorthy(input) {
  if (!(input.thresholdMinutes > 0)) return false;
  if (input.minutes < input.thresholdMinutes) return false;
  return input.responsibilityFa !== "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631";
}
var DISPATCH_TARGETS = ["cmms", "mes", "pmis"];
function parseDispatchTargets(raw) {
  if (!raw) return [];
  const out = /* @__PURE__ */ new Set();
  for (const part of String(raw).split(",")) {
    const key = part.trim().toLowerCase();
    if (DISPATCH_TARGETS.includes(key)) out.add(key);
  }
  return [...out];
}
function shouldDispatch(input) {
  const reasons = [];
  const targets = parseDispatchTargets(input.targets);
  if (!input.autoDispatch) reasons.push("E-IIOT-AUTO-DISPATCH-OFF");
  if (!targets.length) reasons.push("E-IIOT-NO-TARGET");
  if (input.level !== "critical" && !input.allowWarning) reasons.push("E-IIOT-NOT-CRITICAL");
  return { dispatch: input.autoDispatch && targets.length > 0 && (input.level === "critical" || input.allowWarning === true), targets, reasons };
}
function idempotencyKeyOf(eventType, target, sourceTable, sourceId, discriminator) {
  const parts = [eventType, target, sourceTable, sourceId, discriminator ?? ""].map((p) => String(p ?? "").trim());
  return `iiot:${parts.join(":")}`.slice(0, 160);
}
var IIOT_INTEGRATION_CONTRACTS = {
  cmms: "iiot-cmms-v1",
  mes: "iiot-mes-v1",
  pmis: "iiot-pmis-v1"
};
function eventTypeFor(target, kind) {
  if (kind === "alert") return "alert.critical";
  if (kind === "alert-resolved") return "alert.resolved";
  if (kind === "downtime") return "downtime.npt";
  if (kind === "downtime-closed") return "downtime.closed";
  return target === "cmms" ? "condition.reading" : "condition.reading";
}
function alertTitleFa(input) {
  const label = SIGNAL_LABELS[input.signal]?.fa ?? input.signal;
  const name = input.channelNameFa || label;
  const levelFa = input.level === "critical" ? "\u0628\u062D\u0631\u0627\u0646\u06CC" : "\u0647\u0634\u062F\u0627\u0631";
  const value = input.value === null || input.value === void 0 ? null : round(input.value, 2);
  switch (input.detectKind) {
    case "stick-slip":
      return `${levelFa}: \u062A\u0634\u062E\u06CC\u0635 \u067E\u062F\u06CC\u062F\u0647\u0654 Stick-Slip \u0631\u0648\u06CC ${name}`;
    case "pump-drop":
      return `${levelFa}: \u0627\u0641\u062A \u0641\u0634\u0627\u0631 \u067E\u0645\u067E \u06AF\u0644 \u0631\u0648\u06CC ${name}${value !== null ? ` (\u0627\u06A9\u0646\u0648\u0646 ${value})` : ""}`;
    case "flatline":
      return `${levelFa}: \u0633\u06CC\u06AF\u0646\u0627\u0644 \u06CC\u062E\u200C\u0632\u062F\u0647 \u0631\u0648\u06CC ${name} \u2014 \u0627\u062D\u062A\u0645\u0627\u0644 \u062E\u0631\u0627\u0628\u06CC \u0633\u0646\u0633\u0648\u0631`;
    case "spike":
      return `${levelFa}: \u062C\u0647\u0634 \u0646\u0627\u06AF\u0647\u0627\u0646\u06CC \u0631\u0648\u06CC ${name}${value !== null ? ` (${value})` : ""}`;
    case "rate-of-change":
      return `${levelFa}: \u0646\u0631\u062E \u062A\u063A\u06CC\u06CC\u0631 \u063A\u06CC\u0631\u0645\u062C\u0627\u0632 \u0631\u0648\u06CC ${name}`;
    default:
      return `${levelFa}: ${name} \u0627\u0632 \u0622\u0633\u062A\u0627\u0646\u0647 \u06AF\u0630\u0634\u062A${value !== null ? ` (${value}${input.unit ? ` ${input.unit}` : ""})` : ""}${input.threshold !== null && input.threshold !== void 0 ? ` \u2014 \u0622\u0633\u062A\u0627\u0646\u0647 ${round(input.threshold, 2)}` : ""}`;
  }
}
function alertMessageFa(input) {
  const parts = [];
  parts.push(`\u0646\u0645\u0648\u0646\u0647\u200C\u0647\u0627\u06CC \u0628\u0631\u0631\u0633\u06CC\u200C\u0634\u062F\u0647: ${input.sampleCount}`);
  if (input.durationSeconds > 0) parts.push(`\u067E\u0627\u06CC\u062F\u0627\u0631\u06CC: ${round(input.durationSeconds, 1)} \u062B\u0627\u0646\u06CC\u0647`);
  if (input.triggerValue !== null && input.triggerValue !== void 0) parts.push(`\u0645\u0642\u062F\u0627\u0631 \u0645\u062D\u0631\u06A9: ${round(input.triggerValue, 3)}`);
  if (input.filteredValue !== null && input.filteredValue !== void 0) parts.push(`\u0645\u0642\u062F\u0627\u0631 \u0641\u06CC\u0644\u062A\u0631\u0634\u062F\u0647: ${round(input.filteredValue, 3)}`);
  const m = input.metrics ?? {};
  if (m.torqueCv !== null && m.torqueCv !== void 0) parts.push(`CV \u06AF\u0634\u062A\u0627\u0648\u0631: ${m.torqueCv}%`);
  if (m.rpmSwingPct !== null && m.rpmSwingPct !== void 0) parts.push(`\u0646\u0648\u0633\u0627\u0646 RPM: ${m.rpmSwingPct}%`);
  if (m.dropPct !== null && m.dropPct !== void 0) parts.push(`\u0627\u0641\u062A \u0641\u0634\u0627\u0631: ${m.dropPct}%`);
  if (m.zScore !== null && m.zScore !== void 0) parts.push(`\u0627\u0645\u062A\u06CC\u0627\u0632 Z: ${m.zScore}`);
  return parts.join(" \xB7 ");
}
export {
  BUFFER_STATUSES,
  DETECTION_KINDS,
  DISPATCH_TARGETS,
  DOWNTIME_CATEGORIES,
  FILTER_METHODS,
  IIOT_DOMAIN_VERSION,
  IIOT_INTEGRATION_CONTRACTS,
  NPT_CATEGORY_MAP,
  SIGNAL_LABELS,
  SIGNAL_TYPES,
  SignalFilter,
  alertMessageFa,
  alertTitleFa,
  bucketStartOf,
  bufferFillPct,
  buildStoreForwardBatch,
  canonicalJson,
  checksumOf,
  claimWorthy,
  classifyDowntime,
  coefficientOfVariation,
  detectPumpPressureDrop,
  detectStickSlip,
  downsampleForChart,
  downtimeMinutesOf,
  emaSeries,
  evaluateDetectRule,
  evaluateThreshold,
  eventTypeFor,
  filterSeries,
  idempotencyKeyOf,
  inCooldown,
  maxOf,
  mean,
  median,
  medianFilter,
  minOf,
  minutesBetween,
  movingAverage,
  nextBufferStatus,
  nptSummary,
  numbersOf,
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
  statusColorFor,
  stddev,
  verifyBatch,
  windowSizeOf,
  zScore
};
