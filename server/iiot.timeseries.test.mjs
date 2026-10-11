/**
 * آزمون لایهٔ سری زمانی IIoT (iiot-ts-v1).
 *
 * سه درایور با یک قرارداد: حافظه، فایل (JSONL) و InfluxDB 2.x. چیزی که اینجا
 * اثبات می‌شود:
 *   ۱) نوشتن/خواندن با هر سه درایور یک نتیجه می‌دهد (قرارداد مشترک).
 *   ۲) InfluxDB واقعاً با HTTP/Line Protocol/Flux حرف می‌زند — با `fetchImpl`
 *      تزریق‌شده، درخواست واقعی بررسی می‌شود نه ادعا.
 *   ۳) قطعی موتور، داشبورد را خالی نمی‌کند (آینهٔ محلی + تنزل آرام).
 *   ۴) بافر لبه/فایل، با دادهٔ ناتمام و مسیر مخرب نمی‌شکند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_MEASUREMENT,
  FileTimeSeriesStore,
  IIOT_TS_VERSION,
  InfluxDbTimeSeriesStore,
  MemoryTimeSeriesStore,
  TimeSeriesError,
  createTimeSeriesStore,
  influxFluxQuery,
  influxLineProtocol,
  normalizePoint,
  parseInfluxCsv,
} from "./iiotTimeSeries.mjs";

const T0 = Date.parse("2026-03-10T06:00:00Z");
const at = (seconds) => new Date(T0 + seconds * 1000).toISOString();
const point = (seconds, value, extra = {}) => ({ rigId: "RIG-DEMO", channelCode: "CH-TEMP", signalType: "temperature", at: at(seconds), value, ...extra });

/** پوشهٔ دادهٔ موقت که پس از هر آزمون پاک می‌شود. */
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iiot-ts-"));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** fetch ساختگی: درخواست‌ها را ثبت و پاسخ ثابت می‌دهد. */
function fakeFetch({ status = 204, body = "", responder = null } = {}) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    const chosen = responder ? responder(url, init) : { status, body };
    return {
      ok: chosen.status >= 200 && chosen.status < 300,
      status: chosen.status,
      text: async () => chosen.body ?? "",
    };
  };
  impl.calls = calls;
  return impl;
}

/**
 * اینفلاکس ساختگی با رفتار واقعی: نوشتن را از Line Protocol تجزیه و در حافظه
 * نگه می‌دارد و خواندن را با CSV annotated پاسخ می‌دهد. با این، قرارداد
 * «نوشتن و خواندن» برای درایور InfluxDB از میان خودِ پروتکل می‌گذرد.
 */
function fakeInfluxServer() {
  const calls = [];
  /* InfluxDB نقاط با measurement/tagset/timestamp یکسان را جایگزین می‌کند
   * (last write wins)؛ همین رفتار، ضدتکرار ارسال دوبارهٔ دسته است. */
  const points = new Map();
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes("/api/v2/write")) {
      for (const line of String(init.body ?? "").split("\n")) {
        if (!line.trim()) continue;
        const [head, fieldsPart, tsPart] = line.split(" ");
        const tags = Object.fromEntries(head.split(",").slice(1).map((t) => {
          const i = t.indexOf("=");
          return [t.slice(0, i), t.slice(i + 1).replace(/\\([,= ])/g, "$1")];
        }));
        const fields = Object.fromEntries(fieldsPart.split(",").map((f) => {
          const i = f.indexOf("=");
          return [f.slice(0, i), f.slice(i + 1).replace(/^"|"$/g, "")];
        }));
        const atMs = Number(tsPart);
        points.set(`${tags.rigId}|${tags.channelCode}|${tags.signalType}|${atMs}`, {
          rigId: tags.rigId, channelCode: tags.channelCode, signalType: tags.signalType,
          atMs, at: new Date(atMs).toISOString(),
          value: Number(fields.value), quality: fields.quality, source: fields.source,
        });
      }
      return { ok: true, status: 204, text: async () => "" };
    }
    if (url.includes("/api/v2/query")) {
      const body = String(init.body ?? "");
      const rigId = (body.match(/r\["rigId"\] == "([^"]*)"/) ?? [])[1] ?? null;
      const setMatch = body.match(/set: \[([^\]]*)\]/);
      const codes = setMatch ? setMatch[1].split(",").map((c) => c.trim().replace(/^"|"$/g, "")).filter(Boolean) : [];
      /* بازهٔ زمانی از خودِ Flux خوانده می‌شود — یعنی آزمون، range را هم
       * راستی‌آزمایی می‌کند نه فقط فیلتر دکل و کانال را. */
      const range = body.match(/range\(start: ([^,]+), stop: ([^)]+)\)/);
      const fromMs = range ? Date.parse(range[1]) : -Infinity;
      const toMs = range ? Date.parse(range[2]) : Number.POSITIVE_INFINITY;
      const rows = [...points.values()]
        .filter((p) => (!rigId || p.rigId === rigId) && (!codes.length || codes.includes(p.channelCode)))
        .filter((p) => p.atMs >= fromMs && p.atMs <= toMs)
        .sort((a, b) => a.atMs - b.atMs);
      const csv = [
        "#datatype,string,long,dateTime:RFC3339,double,string,string,string",
        "#group,false,false,false,false,true,true,true",
        "#default,_result,,,,,,",
        ",result,table,_time,_value,channelCode,rigId,signalType",
        ...rows.map((p) => `,_result,0,${p.at},${p.value},${p.channelCode},${p.rigId},${p.signalType}`),
      ].join("\n");
      return { ok: true, status: 200, text: async () => csv };
    }
    return { ok: true, status: 200, text: async () => "" };
  };
  impl.calls = calls;
  impl.points = () => [...points.values()];
  return impl;
}

/* ═══════════════════════ ۱. یکسان‌سازی نقطه ═══════════════════════ */

test("نقطه: شکل مجاز، با کیفیت و منبع پیش‌فرض", () => {
  const p = normalizePoint(point(5, 123.5));
  assert.equal(p.rigId, "RIG-DEMO");
  assert.equal(p.channelCode, "CH-TEMP");
  assert.equal(p.signalType, "temperature");
  assert.equal(p.at, at(5));
  assert.equal(p.atMs, T0 + 5000);
  assert.equal(p.value, 123.5);
  assert.equal(p.quality, "good");
  assert.equal(p.source, "live");
});

test("نقطه: فیلدهای ناشناخته به پیش‌فرض برمی‌گردند، نه مقدار دلخواه", () => {
  const p = normalizePoint(point(1, 10, { quality: "عالی", source: "ماهواره", signalType: "  " }));
  assert.equal(p.quality, "good");
  assert.equal(p.source, "live");
  assert.equal(p.signalType, "unknown");
});

test("نقطه: دادهٔ ناقص، خطای کددار می‌دهد نه رکورد خراب", () => {
  const expectCode = (bad, code) => {
    try {
      normalizePoint(bad);
      assert.fail("باید خطا می‌داد");
    } catch (err) {
      assert.ok(err instanceof TimeSeriesError);
      assert.equal(err.code, code);
    }
  };
  expectCode(null, "E-IIOT-TS-POINT");
  expectCode({ channelCode: "CH", at: at(1), value: 1 }, "E-IIOT-TS-RIG");
  expectCode({ rigId: "R", at: at(1), value: 1 }, "E-IIOT-TS-CHANNEL");
  expectCode({ rigId: "R", channelCode: "CH", at: "نه-زمان", value: 1 }, "E-IIOT-TS-TIME");
  expectCode({ rigId: "R", channelCode: "CH", at: at(1), value: "abc" }, "E-IIOT-TS-VALUE");
});

test("نقطه: مقدار null صفر نوشته نمی‌شود — سنسور بی‌داده، «صفر» نیست", () => {
  for (const value of [null, undefined, ""]) {
    try {
      const p = normalizePoint(point(1, value));
      assert.fail(`مقدار ${JSON.stringify(value)} نباید پذیرفته شود (شد ${p.value})`);
    } catch (err) {
      assert.equal(err.code, "E-IIOT-TS-VALUE");
    }
  }
  /* ولی صفر واقعی، یک اندازه‌گیری معتبر است. */
  assert.equal(normalizePoint(point(1, 0)).value, 0);
  assert.equal(normalizePoint(point(1, -12.5)).value, -12.5);
});

/* ═══════════════════════ ۲. پروتکل InfluxDB ═══════════════════════ */

test("Line Protocol: قالب measurement,tag=v field=v timestamp", () => {
  const line = influxLineProtocol([point(1, 42, { quality: "suspect", source: "buffer" })]);
  const [measurementTag, fields, timestamp] = line.split(" ");
  assert.equal(measurementTag, `${DEFAULT_MEASUREMENT},rigId=RIG-DEMO,channelCode=CH-TEMP,signalType=temperature`);
  assert.equal(fields, 'value=42,quality="suspect",source="buffer"');
  assert.equal(timestamp, String(T0 + 1000), "دقت میلی‌ثانیه است");
});

test("Line Protocol: نویسهٔ ویژه در تگ escape می‌شود", () => {
  const line = influxLineProtocol([point(1, 1, { channelCode: "CH A,B" })]);
  assert.ok(line.includes("channelCode=CH\\ A\\,B"), `تگ escape نشده: ${line}`);
  /* چند نقطه، چند خط — همان چیزی که write می‌فرستد. */
  const two = influxLineProtocol([point(1, 1), point(2, 2)]).split("\n");
  assert.equal(two.length, 2);
  assert.notEqual(two[0], two[1]);
});

test("Flux: کوئری با فیلتر دکل، کانال و پنجرهٔ تجمیع ساخته می‌شود", () => {
  const flux = influxFluxQuery({
    bucket: "iiot", rigId: "RIG-DEMO", channelCodes: ["CH-TEMP", "CH-WOB"],
    from: "-1h", to: "now()", bucketSeconds: 60,
  });
  assert.ok(flux.startsWith('from(bucket: "iiot")'));
  assert.ok(flux.includes("|> range(start: -1h, stop: now())"));
  assert.ok(flux.includes(`r["_measurement"] == "${DEFAULT_MEASUREMENT}"`));
  assert.ok(flux.includes('r["rigId"] == "RIG-DEMO"'));
  assert.ok(flux.includes('contains(value: r["channelCode"], set: ["CH-TEMP", "CH-WOB"])'));
  assert.ok(flux.includes('r["_field"] == "value"'));
  assert.ok(flux.includes("|> aggregateWindow(every: 60s, fn: mean, createEmpty: false)"));
  /* بدون پنجره، aggregateWindow نمی‌آید — سری خام می‌خواهیم. */
  const raw = influxFluxQuery({ bucket: "iiot", rigId: "R", from: "-5m", to: "now()" });
  assert.ok(!raw.includes("aggregateWindow"));
  assert.ok(!raw.includes("channelCode"), "بدون کد کانال، فیلتر کانال نمی‌آید");
});

test("Flux: تزریق از طریق rigId/کانال ممکن نیست", () => {
  const flux = influxFluxQuery({ bucket: "iiot", rigId: 'R" or 1==1 //', from: "-1h", to: "now()" });
  assert.ok(!flux.includes('R"'), "گیومهٔ دوجلو در فیلتر باقی می‌ماند");
});

test("CSV: پاسخ annotated اینفلاکس تجزیه می‌شود", () => {
  const csv = [
    "#datatype,string,long,dateTime:RFC3339,double,string,string,string",
    "#group,false,false,false,false,true,true,true",
    "#default,_result,,,,,,",
    ",result,table,_time,_value,channelCode,rigId,signalType",
    `,_result,0,${at(5)},101.5,CH-TEMP,RIG-DEMO,temperature`,
    `,_result,0,${at(10)},102.5,CH-TEMP,RIG-DEMO,temperature`,
    ",_result,0,not-a-time,103,CH-TEMP,RIG-DEMO,temperature",
    `,_result,0,${at(20)},,CH-TEMP,RIG-DEMO,temperature`,
  ].join("\n");
  const rows = parseInfluxCsv(csv);
  assert.equal(rows.length, 2, "سطرهای با زمان یا مقدار نامعتبر رد می‌شوند");
  assert.equal(rows[0].value, 101.5);
  assert.equal(rows[0].channelCode, "CH-TEMP");
  assert.equal(rows[0].at, at(5));
  assert.deepEqual(parseInfluxCsv(""), []);
  assert.deepEqual(parseInfluxCsv(null), []);
});

/* ═══════════════════════ ۳. قرارداد مشترک درایورها ═══════════════════════ */

/** همان آزمون قرارداد، روی هر درایور. */
const contractCases = [
  ["memory", () => new MemoryTimeSeriesStore()],
  ["file", () => new FileTimeSeriesStore({ dataDir: tempDir() })],
  ["influx", () => new InfluxDbTimeSeriesStore({ url: "http://influx:8086", token: "t", org: "padir", fetchImpl: fakeInfluxServer() })],
];

for (const [label, makeStore] of contractCases) {
  test(`قرارداد درایور ${label}: نوشتن و خواندن سری`, async () => {
    const store = makeStore();
    const written = await store.write([point(0, 10), point(10, 20), point(20, 30), point(5, 15, { channelCode: "CH-WOB", signalType: "wob" })]);
    assert.equal(written.accepted, 4);

    /* بازهٔ زمانی همیشه صریح است — همان‌طور که API صدا می‌زند. درایور
     * InfluxDB بازه را در Flux می‌گذارد، پس بدون آن چیزی برنمی‌گردد. */
    const span = { from: at(-10), to: at(120) };
    const series = await store.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP", ...span });
    assert.deepEqual(series.points.map((p) => p.value), [10, 20, 30], "سری بر پایهٔ زمان مرتب است");
    assert.equal(series.total, 3);
    assert.equal(series.driver.startsWith(label), true);

    const both = await store.query({ rigId: "RIG-DEMO", ...span });
    assert.equal(both.points.length, 4, "بدون کد کانال، همهٔ کانال‌ها می‌آیند");

    const window = await store.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP", from: at(5), to: at(15) });
    assert.deepEqual(window.points.map((p) => p.value), [20], "بازهٔ زمانی روی هر سه درایور یک معنا دارد");

    const lastTwo = await store.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP", ...span, limit: 2 });
    assert.deepEqual(lastTwo.points.map((p) => p.value), [20, 30], "limit آخرین N نمونه را می‌دهد");

    const rolled = await store.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP", ...span, bucketSeconds: 60 });
    assert.equal(rolled.buckets.length, 1, "سه نمونه در یک سطل دقیقه‌ای");
    assert.equal(rolled.buckets[0].avgValue, 20);

    const latest = await store.latest({ rigId: "RIG-DEMO", ...span });
    const temp = latest.latest.find((l) => l.channelCode === "CH-TEMP");
    assert.equal(temp.value, 30);
    assert.equal(temp.at, at(20));

    /* دکل ناشناخته: خالی، نه خطا. */
    const none = await store.query({ rigId: "RIG-NONE", ...span });
    assert.deepEqual(none.points, []);
    /* بدون دکل: خطای صریح. */
    await assert.rejects(() => store.query({}), (err) => err.code === "E-IIOT-TS-RIG");
    /* سلامت درایور گزارش می‌شود. */
    const health = await store.health();
    assert.equal(health.driver.startsWith(label), true);
    assert.equal(health.version, IIOT_TS_VERSION);
  });

  test(`قرارداد درایور ${label}: ارسال دوبارهٔ همان دسته، سری را دو برابر نمی‌کند`, async () => {
    const store = makeStore();
    await store.write([point(0, 10), point(10, 20)]);
    await store.write([point(0, 11), point(10, 20)]);
    const series = await store.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP", from: at(-10), to: at(120) });
    assert.equal(series.points.length, 2, "نمونهٔ هم‌زمان، جایگزین می‌شود");
    assert.equal(series.points[0].value, 11, "نمونهٔ تازه‌تر می‌ماند");
  });
}

/* ═══════════════════════ ۴. موتور فایلی ═══════════════════════ */

test("فایل: داده روی JSONL می‌نشیند و در نمونهٔ تازهٔ فروشگاه برمی‌گردد", async () => {
  const dir = tempDir();
  const first = new FileTimeSeriesStore({ dataDir: dir });
  await first.write([point(0, 10), point(30, 40)]);
  const root = path.join(path.resolve(dir, "iiot-ts"));
  assert.ok(fs.existsSync(path.join(root, "RIG-DEMO.jsonl")));
  const lines = fs.readFileSync(path.join(root, "RIG-DEMO.jsonl"), "utf8").trim().split("\n");
  assert.equal(lines.length, 2, "هر نمونه یک خط است");
  assert.equal(JSON.parse(lines[0]).value, 10);

  const second = new FileTimeSeriesStore({ dataDir: dir });
  const series = await second.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP" });
  assert.deepEqual(series.points.map((p) => p.value), [10, 40], "تاریخچه از دیسک بازیابی می‌شود");
});

test("فایل: خط ناتمام در انتهای فایل، بارگذاری را نمی‌شکند", async () => {
  const dir = tempDir();
  const store = new FileTimeSeriesStore({ dataDir: dir });
  await store.write([point(0, 10)]);
  const file = path.join(path.resolve(dir, "iiot-ts"), "RIG-DEMO.jsonl");
  /* شبیه‌سازی قطعی برق در میانهٔ نوشتن. */
  fs.appendFileSync(file, '{"rigId":"RIG-DEMO","channelCode":"CH-TEMP","at":"2026-03-10T06:0', "utf8");
  const reloaded = new FileTimeSeriesStore({ dataDir: dir });
  const series = await reloaded.query({ rigId: "RIG-DEMO" });
  assert.equal(series.points.length, 1, "فقط رکوردهای سالم خوانده می‌شوند");
});

test("فایل: شناسهٔ دکل مخرب نمی‌تواند بیرون از ریشهٔ داده بنویسد", async () => {
  const dir = tempDir();
  const store = new FileTimeSeriesStore({ dataDir: dir });
  await store.write([{ rigId: "../../../etc/passwd", channelCode: "CH-X", at: at(1), value: 1 }]);
  const root = path.resolve(dir, "iiot-ts");
  const entries = fs.readdirSync(root);
  assert.equal(entries.length, 1);
  assert.match(entries[0], /^[A-Za-z0-9._-]+\.jsonl$/);
  assert.ok(!entries[0].includes("/"));
  assert.ok(!fs.existsSync(path.resolve(root, "../../etc/passwd.jsonl")));
});

test("فایل: compact تکراری‌ها را حذف می‌کند", async () => {
  const dir = tempDir();
  const store = new FileTimeSeriesStore({ dataDir: dir });
  await store.write([point(0, 10), point(10, 20)]);
  await store.write([point(0, 10), point(10, 20), point(20, 30)]);
  const file = path.join(path.resolve(dir, "iiot-ts"), "RIG-DEMO.jsonl");
  assert.equal(fs.readFileSync(file, "utf8").trim().split("\n").length, 5, "پیش از فشرده‌سازی، پنج خط روی دیسک است");
  const result = await store.compact({ rigId: "RIG-DEMO" });
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(file, "utf8").trim().split("\n").length, 3, "پس از فشرده‌سازی، سه نمونهٔ یکتا");
  const reloaded = new FileTimeSeriesStore({ dataDir: dir });
  assert.equal((await reloaded.query({ rigId: "RIG-DEMO" })).points.length, 3);
});

test("فایل: سقف حافظه، نمونه‌های قدیمی را دور می‌ریزد", async () => {
  const store = new MemoryTimeSeriesStore({ maxPoints: 5 });
  await store.write(Array.from({ length: 20 }, (_, i) => point(i, i)));
  const series = await store.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP" });
  assert.equal(series.points.length, 5);
  assert.equal(series.points[0].value, 15, "۵ نمونهٔ آخر می‌مانند");
});

/* ═══════════════════════ ۵. درایور InfluxDB ═══════════════════════ */

test("InfluxDB: نوشتن، POST به /api/v2/write با توکن و Line Protocol است", async () => {
  const fetch = fakeFetch({ status: 204 });
  const store = new InfluxDbTimeSeriesStore({
    url: "http://influx:8086/", token: "tok-123", org: "padir", bucket: "iiot", fetchImpl: fetch,
  });
  const result = await store.write([point(0, 10), point(10, 20)]);
  assert.equal(result.delivered, true);
  assert.equal(result.accepted, 2);

  assert.equal(fetch.calls.length, 1);
  const { url, init } = fetch.calls[0];
  assert.equal(url, "http://influx:8086/api/v2/write?org=padir&bucket=iiot&precision=ms");
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, "Token tok-123");
  assert.ok(init.headers["Content-Type"].startsWith("text/plain"));
  assert.equal(init.body.split("\n").length, 2);
  assert.ok(init.body.includes("value=10"));
  /* آینهٔ محلی هم پر می‌شود تا داشبورد بدون موتور هم کار کند. */
  assert.equal(result.mirrored, 2);
  assert.equal((await store.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP" })).points.length, 0, "خواندن، از خود InfluxDB است نه آینه");
});

test("InfluxDB: خطای نوشتن با آینهٔ محلی جبران می‌شود و گزارش می‌شود", async () => {
  const fetch = fakeFetch({ status: 500, body: "engine unavailable" });
  const store = new InfluxDbTimeSeriesStore({ url: "http://influx:8086", token: "t", fetchImpl: fetch });
  const result = await store.write([point(0, 10)]);
  assert.equal(result.delivered, false);
  assert.equal(result.mirrored, 1, "داده روی دیسک نمانده، در آینه هست");
  assert.equal(result.error.code, "E-IIOT-TS-INFLUX-WRITE");
  assert.equal(store.lastError.code, "E-IIOT-TS-INFLUX-WRITE");
});

test("InfluxDB: بدون آینهٔ محلی، خطای نوشتن به بالا پرتاب می‌شود", async () => {
  const store = new InfluxDbTimeSeriesStore({
    url: "http://influx:8086", token: "t", mirrorLocally: false, fetchImpl: fakeFetch({ status: 503 }),
  });
  await assert.rejects(() => store.write([point(0, 1)]), (err) => err.code === "E-IIOT-TS-INFLUX-WRITE");
});

test("InfluxDB: خواندن، POST کوئری Flux است و CSV را تجزیه می‌کند", async () => {
  const csv = [
    "#datatype,string,long,dateTime:RFC3339,double,string",
    ",result,table,_time,_value,channelCode",
    `,_result,0,${at(0)},10,CH-TEMP`,
    `,_result,0,${at(10)},20,CH-TEMP`,
  ].join("\n");
  const fetch = fakeFetch({ status: 200, body: csv });
  const store = new InfluxDbTimeSeriesStore({ url: "http://influx:8086", token: "t", org: "padir", fetchImpl: fetch });
  const result = await store.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP", from: at(-100), to: at(100) });
  assert.equal(result.driver, "influx");
  assert.equal(result.points.length, 2);
  assert.deepEqual(result.points.map((p) => p.value), [10, 20]);

  const { url, init } = fetch.calls[0];
  assert.equal(url, "http://influx:8086/api/v2/query?org=padir");
  assert.equal(init.headers.Accept, "application/csv");
  assert.ok(init.body.includes('r["rigId"] == "RIG-DEMO"'));
  assert.ok(init.body.includes('contains(value: r["channelCode"], set: ["CH-TEMP"])'));
});

test("InfluxDB: آخرین مقدار هر کانال از پاسخ کوئری گرفته می‌شود", async () => {
  const csv = [
    ",result,table,_time,_value,channelCode",
    `,_result,0,${at(0)},10,CH-TEMP`,
    `,_result,0,${at(30)},30,CH-TEMP`,
    `,_result,1,${at(20)},55,CH-WOB`,
  ].join("\n");
  const store = new InfluxDbTimeSeriesStore({ url: "http://influx:8086", token: "t", fetchImpl: fakeFetch({ status: 200, body: csv }) });
  const { latest } = await store.latest({ rigId: "RIG-DEMO" });
  assert.equal(latest.length, 2);
  assert.equal(latest.find((l) => l.channelCode === "CH-TEMP").value, 30, "آخرین مقدار، نه اولین");
});

test("InfluxDB: قطعی موتور، داشبورد را خالی نمی‌کند — تنزل آرام به آینه", async () => {
  let failReads = false;
  const fetch = async (url, init) => {
    if (url.includes("/api/v2/query") && failReads) return { ok: false, status: 503, text: async () => "down" };
    return { ok: true, status: 204, text: async () => "" };
  };
  const store = new InfluxDbTimeSeriesStore({ url: "http://influx:8086", token: "t", fetchImpl: fetch });
  await store.write([point(0, 10), point(10, 20)]);
  failReads = true;
  const result = await store.query({ rigId: "RIG-DEMO", channelCode: "CH-TEMP" });
  assert.equal(result.degraded, true);
  assert.equal(result.driver, "influx→memory");
  assert.deepEqual(result.points.map((p) => p.value), [10, 20], "داده از آینهٔ محلی می‌آید");
  assert.equal(store.lastError.code, "E-IIOT-TS-INFLUX-QUERY");
});

test("InfluxDB: health وضعیت موتور را گزارش می‌کند", async () => {
  const ok = await new InfluxDbTimeSeriesStore({ url: "http://influx:8086", token: "t", fetchImpl: fakeFetch({ status: 200 }) }).health();
  assert.equal(ok.ok, true);
  const down = await new InfluxDbTimeSeriesStore({ url: "http://influx:8086", token: "t", fetchImpl: fakeFetch({ status: 503 }) }).health();
  assert.equal(down.ok, false);
  const unreachable = await new InfluxDbTimeSeriesStore({
    url: "http://influx:8086", token: "t",
    fetchImpl: async () => { throw new Error("ECONNREFUSED"); },
  }).health();
  assert.equal(unreachable.ok, false);
  assert.match(unreachable.error, /ECONNREFUSED/);
});

/* ═══════════════════════ ۶. انتخاب درایور ═══════════════════════ */

test("انتخاب درایور: پیش‌فرض فایل است و مسیرش گزارش می‌شود", () => {
  const dir = tempDir();
  const store = createTimeSeriesStore({ env: {}, dataDir: dir, logger: {} });
  assert.equal(store.driver, "file");
  assert.equal(store.root, path.resolve(dir, "iiot-ts"));
});

test("انتخاب درایور: memory و influx از متغیر محیطی", () => {
  assert.equal(createTimeSeriesStore({ env: { IIOT_TS_DRIVER: "memory" }, logger: {} }).driver, "memory");
  const influx = createTimeSeriesStore({
    env: { IIOT_TS_DRIVER: "influx", IIOT_INFLUX_URL: "http://h:8086", IIOT_INFLUX_TOKEN: "tk", IIOT_INFLUX_ORG: "padir", IIOT_INFLUX_BUCKET: "drilling" },
    fetchImpl: fakeFetch(), logger: {},
  });
  assert.equal(influx.driver, "influx");
  assert.equal(influx.bucket, "drilling");
  assert.equal(influx.org, "padir");
  assert.equal(influx.measurement, DEFAULT_MEASUREMENT);
});

test("انتخاب درایور: influx بی‌آدرس/بی‌توکن، خطای پیکربندی می‌دهد — نه سکوت", async () => {
  try {
    createTimeSeriesStore({ env: { IIOT_TS_DRIVER: "influx" }, logger: {} });
    assert.fail("باید خطای پیکربندی می‌داد");
  } catch (err) {
    assert.equal(err.code, "E-IIOT-TS-CONFIG");
  }
  try {
    createTimeSeriesStore({ env: { IIOT_TS_DRIVER: "prometheus" }, logger: {} });
    assert.fail("درایور ناشناخته باید خطا بدهد");
  } catch (err) {
    assert.equal(err.code, "E-IIOT-TS-CONFIG");
  }
});
