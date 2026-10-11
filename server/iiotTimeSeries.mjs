/**
 * لایهٔ سری زمانی تله‌متری حفاری (iiot-ts-v1)
 * ═══════════════════════════════════════════════════════════════════════
 * سه درایور با **یک قرارداد مشترک**:
 *
 *   • InfluxDbTimeSeriesStore — تولید: نوشتن با InfluxDB Line Protocol روی
 *     `/api/v2/write` و خواندن با Flux روی `/api/v2/query`. هیچ وابستگی
 *     بسته‌ای ندارد؛ فقط `fetch` (که در Node 18+ جهانی است) و هدر
 *     `Authorization: Token`.
 *   • FileTimeSeriesStore     — موتور پشتیبان: همان معنا روی فایل JSONL زیر
 *     `DATA_DIR`. این همان الگویی است که `server/persistence/driver.mjs` برای
 *     SQL Server به کار برد: در این محیط InfluxDB در دسترس نیست، و بدون
 *     موتور پشتیبان، «ذخیرهٔ تله‌متری فرکانس بالا» فقط روی کاغذ بسته می‌شد.
 *   • MemoryTimeSeriesStore   — پایهٔ هر دو و مبنای آزمون‌ها.
 *
 * چرا یک قرارداد؟ چون رفتار واگرا یعنی باگی که فقط در استقرار واقعی دیده
 * می‌شود. هر سه درایور `write / query / latest / health` یکسان دارند و
 * سطل‌بندی (bucketing) را از همان موتور دامنه (`iiotLogic.js`) می‌گیرند، پس
 * عددِ نمودار در هر دو درایور یکی است.
 *
 * انتخاب درایور فقط یک متغیر محیطی است:
 *   IIOT_TS_DRIVER=influx  IIOT_INFLUX_URL=…  IIOT_INFLUX_TOKEN=…  IIOT_INFLUX_ORG=…  IIOT_INFLUX_BUCKET=…
 * در غیر این صورت، موتور پشتیبان فایلی.
 */

import fs from "node:fs";
import path from "node:path";
import { rollupSamples } from "./iiotLogic.js";

export const IIOT_TS_VERSION = "iiot-ts-v1";

export const DEFAULT_MEASUREMENT = "iiot_telemetry";
export const DEFAULT_TAG_KEYS = ["rigId", "channelCode", "signalType"];

export class TimeSeriesError extends Error {
  constructor(code, messageFa, extra = {}) {
    super(messageFa);
    this.name = "TimeSeriesError";
    this.code = code;
    this.messageFa = messageFa;
    this.extra = extra;
  }
}

/* `null`/`undefined`/رشتهٔ خالی باید `null` بدهند نه صفر: نمونهٔ بی‌مقدار که
 * صفر نوشته شود، «فشار پمپ صفر» جعلی می‌سازد و تشخیص افت فشار را خراب می‌کند. */
const toNum = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** یکسان‌سازی نقطهٔ تله‌متری — تنها شکل مجاز برای نوشتن. */
export function normalizePoint(point) {
  if (!point || typeof point !== "object") throw new TimeSeriesError("E-IIOT-TS-POINT", "نقطهٔ تله‌متری نامعتبر است");
  const rigId = String(point.rigId ?? "").trim();
  const channelCode = String(point.channelCode ?? "").trim();
  /* `at` (رشتهٔ ISO) شکل اصلی است؛ `atMs` برای فراخوان‌هایی است که زمان را
   * پیش‌تر محاسبه کرده‌اند (بازپخش/رول‌آپ). */
  const atMs = point.at === undefined || point.at === null || point.at === ""
    ? (typeof point.atMs === "number" && Number.isFinite(point.atMs) ? point.atMs : Number.NaN)
    : Date.parse(point.at);
  const value = toNum(point.value);
  if (!rigId) throw new TimeSeriesError("E-IIOT-TS-RIG", "شناسهٔ دکل در نقطهٔ تله‌متری الزامی است");
  if (!channelCode) throw new TimeSeriesError("E-IIOT-TS-CHANNEL", "کد کانال در نقطهٔ تله‌متری الزامی است");
  if (Number.isNaN(atMs)) throw new TimeSeriesError("E-IIOT-TS-TIME", `زمان نمونه نامعتبر است: ${String(point.at)}`);
  if (value === null) throw new TimeSeriesError("E-IIOT-TS-VALUE", `مقدار نمونه نامعتبر است: ${String(point.value)}`);
  return {
    rigId,
    channelCode,
    signalType: String(point.signalType ?? "").trim() || "unknown",
    at: new Date(atMs).toISOString(),
    atMs,
    value,
    quality: ["good", "suspect", "bad", "stale"].includes(point.quality) ? point.quality : "good",
    source: ["live", "buffer", "replay", "simulated", "manual"].includes(point.source) ? point.source : "live",
  };
}

/* فرار Line Protocol: فاصله، کاما و = در تگ/فیلد باید escape شوند — و پیش از
 * همه خودِ backslash. وگرنه یک `\\` در انتهای مقدار، جداکنندهٔ بعدی را
 * می‌بلعد و ساختار پروتکل می‌شکند (پیدا شده توسط CodeQL). */
const escapeTag = (v) => String(v).replace(/\\/g, "\\\\").replace(/([,= ])/g, "\\$1");
const escapeKey = (v) => String(v).replace(/\\/g, "\\\\").replace(/([, ])/g, "\\$1");

/**
 * ساخت InfluxDB Line Protocol.
 * قالب: `measurement,tag=v field=v timestamp` با دقت میلی‌ثانیه.
 * newline در مقدار فیلد رشته‌ای حذف می‌شود تا ساختار پروتکل نشکند.
 */
export function influxLineProtocol(points, { measurement = DEFAULT_MEASUREMENT, tagKeys = DEFAULT_TAG_KEYS } = {}) {
  const rows = [];
  for (const raw of points) {
    /* «پیش‌تر یکسان‌شده» یعنی هم زمان محاسبه‌شده دارد و هم کیفیت؛ وگرنه
     * از یکسان‌سازی می‌گذرد و `quality="undefined"` روی سیم می‌نویسد. */
    const p = (raw.atMs !== undefined && raw.quality !== undefined) ? raw : normalizePoint(raw);
    const tags = tagKeys
      .filter((k) => p[k] !== undefined && p[k] !== null && String(p[k]).length > 0)
      .map((k) => `${escapeKey(k)}=${escapeTag(p[k])}`)
      .join(",");
    const fields = [
      `value=${p.value}`,
      `quality="${String(p.quality).replace(/["\n]/g, "")}"`,
      `source="${String(p.source).replace(/["\n]/g, "")}"`,
    ].join(",");
    rows.push(`${escapeKey(measurement)}${tags ? `,${tags}` : ""} ${fields} ${p.atMs}`);
  }
  return rows.join("\n");
}

/** کوئری Flux برای خواندن سری — همان چیزی که `/api/v2/query` می‌گیرد. */
export function influxFluxQuery({ bucket, rigId, channelCodes = [], from, to, bucketSeconds = null, measurement = DEFAULT_MEASUREMENT }) {
  const filters = [`r["_measurement"] == "${measurement}"`, `r["rigId"] == "${String(rigId).replace(/"/g, "")}"`];
  if (channelCodes.length) {
    const list = channelCodes.map((c) => `"${String(c).replace(/"/g, "")}"`).join(", ");
    filters.push(`contains(value: r["channelCode"], set: [${list}])`);
  }
  const lines = [
    `from(bucket: "${bucket}")`,
    `  |> range(start: ${from}, stop: ${to})`,
    `  |> filter(fn: (r) => ${filters.join(" and ")})`,
    `  |> filter(fn: (r) => r["_field"] == "value")`,
  ];
  if (bucketSeconds && bucketSeconds > 0) {
    lines.push(`  |> aggregateWindow(every: ${bucketSeconds}s, fn: mean, createEmpty: false)`);
  }
  return lines.join("\n");
}

/**
 * تجزیهٔ CSV پاسخ InfluxDB (annotated). فقط ستون‌های `_time` و `_value`
 * لازم‌اند؛ سطرهای کامنت (`#`) و سرآیند خالی رد می‌شوند.
 */
export function parseInfluxCsv(csv) {
  const text = String(csv ?? "");
  const lines = text.split(/\r?\n/);
  let header = null;
  const out = [];
  for (const line of lines) {
    if (!line.trim() || line.startsWith("#")) continue;
    const cells = line.split(",");
    if (!header) { header = cells.map((c) => c.trim()); continue; }
    const row = Object.fromEntries(header.map((name, i) => [name, cells[i]]));
    const atMs = Date.parse(row._time ?? "");
    const value = toNum(row._value);
    if (Number.isNaN(atMs) || value === null) continue;
    out.push({
      at: new Date(atMs).toISOString(),
      value,
      channelCode: row.channelCode ?? null,
      rigId: row.rigId ?? null,
      signalType: row.signalType ?? null,
    });
  }
  return out;
}

/* ═══════════════════════ درایور حافظه‌ای ═══════════════════════ */

export class MemoryTimeSeriesStore {
  constructor(options = {}) {
    this.driver = "memory";
    this.version = IIOT_TS_VERSION;
    this.maxPoints = options.maxPoints && options.maxPoints > 0 ? options.maxPoints : 200_000;
    /** rigId → channelCode → آرایهٔ مرتب‌شده بر پایهٔ زمان */
    this.series = new Map();
    this.writtenCount = 0;
  }

  async write(points) {
    const list = Array.isArray(points) ? points : [points];
    let accepted = 0;
    for (const raw of list) {
      /* «پیش‌تر یکسان‌شده» یعنی هم زمان محاسبه‌شده دارد و هم کیفیت؛ وگرنه
     * از یکسان‌سازی می‌گذرد و `quality="undefined"` روی سیم می‌نویسد. */
    const p = (raw.atMs !== undefined && raw.quality !== undefined) ? raw : normalizePoint(raw);
      if (!this.series.has(p.rigId)) this.series.set(p.rigId, new Map());
      const byChannel = this.series.get(p.rigId);
      if (!byChannel.has(p.channelCode)) byChannel.set(p.channelCode, []);
      const arr = byChannel.get(p.channelCode);
      /* هم‌زمانی نمونه با همان زمان: نمونهٔ تازه‌تر جای قبلی را می‌گیرد تا
       * ارسال دوبارهٔ یک دسته، سری را دو برابر نکند. */
      const sameTime = arr.findIndex((x) => x.atMs === p.atMs);
      if (sameTime >= 0) arr[sameTime] = p;
      else arr.push(p);
      accepted += 1;
    }
    this.writtenCount += accepted;
    for (const [, byChannel] of this.series) {
      for (const [code, arr] of byChannel) {
        arr.sort((a, b) => a.atMs - b.atMs);
        if (arr.length > this.maxPoints) byChannel.set(code, arr.slice(arr.length - this.maxPoints));
      }
    }
    return { ok: true, accepted, driver: this.driver };
  }

  /** خواندن سری خام؛ `bucketSeconds` خروجی را سطل‌بندی می‌کند. */
  async query({ rigId, channelCode, channelCodes = [], from, to, limit, bucketSeconds = null } = {}) {
    if (!rigId) throw new TimeSeriesError("E-IIOT-TS-RIG", "شناسهٔ دکل برای خواندن سری الزامی است");
    const byChannel = this.series.get(rigId);
    if (!byChannel) return { points: [], buckets: [], total: 0, driver: this.driver };
    const wanted = channelCode ? [channelCode] : channelCodes.length ? channelCodes : [...byChannel.keys()];
    const fromMs = from ? Date.parse(from) : -Infinity;
    const toMs = to ? Date.parse(to) : Infinity;
    const points = [];
    for (const code of wanted) {
      for (const p of byChannel.get(code) ?? []) {
        if (p.atMs >= fromMs && p.atMs <= toMs) points.push({ at: p.at, value: p.value, quality: p.quality, channelCode: p.channelCode, signalType: p.signalType });
      }
    }
    points.sort((a, b) => a.at.localeCompare(b.at));
    const sliced = limit && limit > 0 ? points.slice(-limit) : points;
    const buckets = bucketSeconds && bucketSeconds > 0
      ? rollupSamples(sliced.map((p) => ({ at: p.at, value: p.value, quality: p.quality })), bucketSeconds)
      : [];
    return { points: sliced, buckets, total: points.length, driver: this.driver };
  }

  /** آخرین مقدار هر کانال — خوراک گیج‌های داشبورد. */
  async latest({ rigId, channelCodes = [] } = {}) {
    if (!rigId) throw new TimeSeriesError("E-IIOT-TS-RIG", "شناسهٔ دکل الزامی است");
    const byChannel = this.series.get(rigId);
    if (!byChannel) return { latest: [], driver: this.driver };
    const wanted = channelCodes.length ? channelCodes : [...byChannel.keys()];
    const latest = [];
    for (const code of wanted) {
      const arr = byChannel.get(code);
      if (!arr || arr.length === 0) continue;
      const last = arr[arr.length - 1];
      latest.push({ channelCode: code, at: last.at, value: last.value, quality: last.quality, signalType: last.signalType, sampleCount: arr.length });
    }
    return { latest, driver: this.driver };
  }

  async health() {
    return { ok: true, driver: this.driver, version: this.version, written: this.writtenCount };
  }

  count({ rigId, channelCode } = {}) {
    if (!rigId) return this.writtenCount;
    const byChannel = this.series.get(rigId);
    if (!byChannel) return 0;
    if (channelCode) return (byChannel.get(channelCode) ?? []).length;
    return [...byChannel.values()].reduce((s, arr) => s + arr.length, 0);
  }
}

/* ═══════════════════════ موتور پشتیبان فایلی ═══════════════════════ */

/**
 * موتور سری زمانی پشتیبان. همان قرارداد، روی JSONL زیر `dataDir/iiot-ts`.
 *
 * چرا JSONL و نه یک فایل JSON بزرگ؟ چون نوشتن، افزودنی است: هر نمونه یک خط
 * است و قطعی برق، کل تاریخچه را خراب نمی‌کند. این دقیقاً همان دلیلی است که
 * بافر لبه هم دسته‌ای و افزودنی است.
 */
export class FileTimeSeriesStore extends MemoryTimeSeriesStore {
  constructor(options = {}) {
    super(options);
    this.driver = "file";
    this.root = path.resolve(options.dataDir ?? path.join(process.cwd(), "server", "rundata"), "iiot-ts");
    fs.mkdirSync(this.root, { recursive: true });
    this.#load();
  }

  #fileOf(rigId) {
    /* شناسهٔ دکل از ورودی می‌آید؛ پیش از ساخت مسیر پاک‌سازی می‌شود تا
     * `../` نتواند بیرون از ریشهٔ داده بنویسد. */
    const safe = String(rigId).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "rig";
    return path.join(this.root, `${safe}.jsonl`);
  }

  #load() {
    if (!fs.existsSync(this.root)) return;
    for (const entry of fs.readdirSync(this.root)) {
      if (!entry.endsWith(".jsonl")) continue;
      const text = fs.readFileSync(path.join(this.root, entry), "utf8");
      const points = [];
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try { points.push(JSON.parse(line)); } catch { /* خط ناتمام در انتهای فایل نادیده گرفته می‌شود */ }
      }
      if (!points.length) continue;
      const rigId = points[0].rigId;
      if (!this.series.has(rigId)) this.series.set(rigId, new Map());
      const byChannel = this.series.get(rigId);
      for (const p of points) {
        if (!byChannel.has(p.channelCode)) byChannel.set(p.channelCode, []);
        byChannel.get(p.channelCode).push(p);
      }
    }
    for (const [, byChannel] of this.series) for (const [, arr] of byChannel) arr.sort((a, b) => a.atMs - b.atMs);
  }

  async write(points) {
    const list = Array.isArray(points) ? points : [points];
    const normalized = list.map((raw) => (raw.atMs !== undefined ? raw : normalizePoint(raw)));
    const byRig = new Map();
    for (const p of normalized) {
      if (!byRig.has(p.rigId)) byRig.set(p.rigId, []);
      byRig.get(p.rigId).push(p);
    }
    for (const [rigId, rows] of byRig) {
      fs.appendFileSync(this.#fileOf(rigId), rows.map((r) => JSON.stringify({
        rigId: r.rigId, channelCode: r.channelCode, signalType: r.signalType,
        at: r.at, atMs: r.atMs, value: r.value, quality: r.quality, source: r.source,
      })).join("\n") + "\n", "utf8");
    }
    return super.write(normalized);
  }

  /** فشرده‌سازی: بازنویسی فایل فقط با دادهٔ حافظه (حذف تکراری‌ها). */
  async compact({ rigId } = {}) {
    const rigs = rigId ? [rigId] : [...this.series.keys()];
    for (const id of rigs) {
      const byChannel = this.series.get(id);
      if (!byChannel) continue;
      const lines = [];
      for (const [, arr] of byChannel) for (const p of arr) {
        lines.push(JSON.stringify({
          rigId: p.rigId, channelCode: p.channelCode, signalType: p.signalType,
          at: p.at, atMs: p.atMs, value: p.value, quality: p.quality, source: p.source,
        }));
      }
      fs.writeFileSync(this.#fileOf(id), lines.length ? lines.join("\n") + "\n" : "", "utf8");
    }
    return { ok: true, rigs: rigs.length };
  }
}

/* ═══════════════════════ درایور InfluxDB ═══════════════════════ */

/**
 * درایور InfluxDB 2.x.
 *
 * نوشتن: `POST {url}/api/v2/write?org=&bucket=&precision=ms` با Line Protocol.
 * خواندن: `POST {url}/api/v2/query?org=` با Flux و پاسخ CSV annotated.
 *
 * `fetchImpl` تزریق‌شدنی است تا آزمون، درخواست واقعی (URL، هدر، بدنه) را
 * بدون شبکه بررسی کند — همان چیزی که «اتصال به InfluxDB واقعی است» را اثبات
 * می‌کند نه ادعا.
 */
export class InfluxDbTimeSeriesStore extends MemoryTimeSeriesStore {
  constructor(options = {}) {
    super(options);
    this.driver = "influx";
    this.url = String(options.url ?? "").replace(/\/+$/, "");
    this.token = String(options.token ?? "");
    this.org = String(options.org ?? "");
    this.bucket = String(options.bucket ?? "iiot");
    this.measurement = options.measurement || DEFAULT_MEASUREMENT;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    /** آینهٔ محلی: اگر InfluxDB نرسید، داشبورد خالی نماند. */
    this.mirrorLocally = options.mirrorLocally !== false;
    this.lastError = null;
  }

  #headers(extra = {}) {
    return { "Content-Type": "text/plain; charset=utf-8", Authorization: `Token ${this.token}`, ...extra };
  }

  async write(points) {
    const list = Array.isArray(points) ? points : [points];
    const normalized = list.map((raw) => (raw.atMs !== undefined ? raw : normalizePoint(raw)));
    const body = influxLineProtocol(normalized, { measurement: this.measurement });
    const target = `${this.url}/api/v2/write?org=${encodeURIComponent(this.org)}&bucket=${encodeURIComponent(this.bucket)}&precision=ms`;
    let delivered = false;
    try {
      const res = await this.fetchImpl(target, { method: "POST", headers: this.#headers(), body });
      if (!res.ok) {
        const text = await safeText(res);
        throw new TimeSeriesError("E-IIOT-TS-INFLUX-WRITE", `نوشتن در InfluxDB ناموفق بود (HTTP ${res.status})`, { status: res.status, detail: text.slice(0, 400) });
      }
      delivered = true;
      this.lastError = null;
    } catch (err) {
      this.lastError = { code: err?.code ?? "E-IIOT-TS-INFLUX-WRITE", message: err?.message ?? String(err) };
      if (!this.mirrorLocally) throw err;
    }
    /* آینهٔ محلی همیشه پر می‌شود: خواندن داشبورد نباید به دسترس بودن
     * موتور سری زمانی وابسته باشد. */
    const mirrored = await super.write(normalized);
    return { ok: true, accepted: normalized.length, delivered, driver: this.driver, mirrored: mirrored.accepted, error: this.lastError };
  }

  async query(params = {}) {
    /* همان قاعدهٔ دو درایور دیگر: بدون دکل، سری خوانده نمی‌شود. وگرنه یک
     * فراخوان بی‌rigId، دادهٔ همهٔ دکل‌ها را برمی‌گرداند و حصار دامنهٔ
     * کارخانه (plantId) بی‌اثر می‌شود. */
    if (!params.rigId) throw new TimeSeriesError("E-IIOT-TS-RIG", "شناسهٔ دکل برای خواندن سری الزامی است");
    const from = params.from ?? new Date(Date.now() - 3_600_000).toISOString();
    const to = params.to ?? new Date().toISOString();
    /* سطل‌بندی عمداً سمت سرور انجام نمی‌شود: `aggregateWindow` فقط میانگین
     * برمی‌گرداند و نمودار دکل به min/max/first/last هم نیاز دارد (نمایش
     * اسپایک و گیج). پس نقطهٔ خام خوانده می‌شود و با همان `rollupSamples`
     * موتور دامنه سطل‌بندی می‌شود — یعنی عددِ نمودار در هر سه درایور یکی است. */
    const bucketSeconds = params.bucketSeconds && params.bucketSeconds > 0 ? params.bucketSeconds : null;
    const flux = influxFluxQuery({
      bucket: this.bucket, rigId: params.rigId, channelCodes: params.channelCode ? [params.channelCode] : (params.channelCodes ?? []),
      from, to, bucketSeconds: null, measurement: this.measurement,
    });
    try {
      const res = await this.fetchImpl(`${this.url}/api/v2/query?org=${encodeURIComponent(this.org)}`, {
        method: "POST", headers: this.#headers({ Accept: "application/csv" }), body: flux,
      });
      if (!res.ok) throw new TimeSeriesError("E-IIOT-TS-INFLUX-QUERY", `خواندن از InfluxDB ناموفق بود (HTTP ${res.status})`);
      const csv = await safeText(res);
      const points = parseInfluxCsv(csv);
      const sliced = params.limit && params.limit > 0 ? points.slice(-params.limit) : points;
      const buckets = bucketSeconds
        ? rollupSamples(sliced.map((p) => ({ at: p.at, value: p.value, quality: p.quality })), bucketSeconds)
        : [];
      return { points: sliced, buckets, total: points.length, driver: this.driver, query: flux };
    } catch (err) {
      this.lastError = { code: err?.code ?? "E-IIOT-TS-INFLUX-QUERY", message: err?.message ?? String(err) };
      /* تنزل آرام به آینهٔ محلی — دادهٔ داشبورد نباید با قطعی موتور ناپدید شود. */
      const fallback = await super.query(params);
      return { ...fallback, degraded: true, driver: `${this.driver}→memory`, error: this.lastError };
    }
  }

  async latest(params = {}) {
    const now = Date.now();
    /* افق پیش‌فرض ۶ ساعت است، ولی فراخوان می‌تواند بازه را عوض کند — وگرنه
     * رفتار این درایور با دو درایور دیگر واگرا می‌شد (آن‌ها آخرین مقدار
     * ذخیره‌شده را بدون توجه به سن برمی‌گردانند). */
    const from = params.from ?? new Date(now - 6 * 3_600_000).toISOString();
    const to = params.to ?? new Date(now).toISOString();
    const res = await this.query({ ...params, from, to });
    const byChannel = new Map();
    for (const p of res.points ?? []) {
      const key = p.channelCode ?? "unknown";
      const prev = byChannel.get(key);
      if (!prev || String(prev.at) < String(p.at)) byChannel.set(key, p);
    }
    /* کوئری Flux فقط فیلد `value` را می‌گیرد، پس کیفیت نمونه از این مسیر
     * نامعلوم است و "good" گزارش می‌شود؛ کهنه‌بودن خوراک را داشبورد از سنِ
     * آخرین نمونه نسبت به نرخ نمونه‌برداری تشخیص می‌دهد، نه از این فیلد. */
    return { latest: [...byChannel.values()].map((p) => ({ channelCode: p.channelCode, at: p.at, value: p.value, signalType: p.signalType, quality: "good" })), driver: res.driver, degraded: res.degraded === true };
  }

  async health() {
    try {
      const res = await this.fetchImpl(`${this.url}/health`, { method: "GET" });
      return { ok: res.ok, driver: this.driver, version: this.version, status: res.status };
    } catch (err) {
      return { ok: false, driver: this.driver, version: this.version, error: err?.message ?? String(err) };
    }
  }
}

async function safeText(res) {
  try { return typeof res.text === "function" ? await res.text() : String(res.body ?? ""); } catch { return ""; }
}

/* ═══════════════════════ انتخاب درایور ═══════════════════════ */

/**
 * ساخت فروشگاه سری زمانی از متغیرهای محیطی.
 * `IIOT_TS_DRIVER=influx` بدون URL/توکن، خطای پیکربندی می‌دهد — نه اینکه
 * بی‌صدا به موتور فایلی برود و کاربر فکر کند داده در InfluxDB است.
 */
export function createTimeSeriesStore({ env = process.env, fetchImpl, dataDir, logger = console } = {}) {
  const requested = String(env.IIOT_TS_DRIVER ?? "file").trim().toLowerCase();
  if (requested === "influx") {
    const url = String(env.IIOT_INFLUX_URL ?? "").trim();
    const token = String(env.IIOT_INFLUX_TOKEN ?? "").trim();
    if (!url || !token) {
      throw new TimeSeriesError(
        "E-IIOT-TS-CONFIG",
        "پیکربندی InfluxDB ناقص است: IIOT_INFLUX_URL و IIOT_INFLUX_TOKEN الزامی‌اند",
      );
    }
    const store = new InfluxDbTimeSeriesStore({
      url, token,
      org: String(env.IIOT_INFLUX_ORG ?? "").trim(),
      bucket: String(env.IIOT_INFLUX_BUCKET ?? "iiot").trim(),
      measurement: String(env.IIOT_TS_MEASUREMENT ?? DEFAULT_MEASUREMENT).trim(),
      fetchImpl,
      mirrorLocally: String(env.IIOT_TS_MIRROR ?? "1") !== "0",
    });
    logger.info?.("[iiot-ts] InfluxDB driver active");
    return store;
  }
  if (requested !== "file" && requested !== "memory") {
    throw new TimeSeriesError("E-IIOT-TS-CONFIG", `درایور سری زمانی ناشناخته: ${requested}`);
  }
  if (requested === "memory") {
    logger.info?.("[iiot-ts] in-memory time-series driver active");
    return new MemoryTimeSeriesStore();
  }
  const store = new FileTimeSeriesStore({ dataDir });
  logger.info?.(`[iiot-ts] file time-series driver active at ${store.root}`);
  return store;
}
