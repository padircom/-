/**
 * ساخت نسخهٔ تک‌فایلی مستقل — برای باز شدن با دوبار کلیک، بدون سرور.
 *
 * دو کار می‌کند:
 *
 * ۱) **ترتیب اسکریپت را درست می‌کند.** `vite-plugin-singlefile` باندل
 *    را در `<head>` می‌گذارد، ولی `<div id="root">` در `<body>` است؛
 *    پس `createRoot` روی `null` صدا زده می‌شود و React با خطای #299
 *    می‌شکند — صفحهٔ سفید بدون هیچ پیامی.
 *
 * ۲) **دادهٔ زنده را درون فایل تزریق می‌کند.** فایل مستقل به سرور
 *    دسترسی ندارد؛ بدون این کار هر پنل خالی می‌ماند. `fetch` قلاب
 *    می‌شود و پاسخ‌های از پیش گرفته‌شده را برمی‌گرداند.
 *
 * محدودیت صادقانه: این یک **عکس** است، نه برنامهٔ زنده. خواندن کار
 * می‌کند؛ هر دکمه‌ای که بنویسد (ثبت، ارسال، تحویل) پاسخ آمادهٔ همان
 * لحظه را می‌گیرد یا خطای مؤدبانه.
 *
 * اجرا (سرور API باید بالا باشد):
 *   npx vite build && node server/standalone.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const API = process.env.API || "http://127.0.0.1:4000";
const P = process.env.PROJECT_ID || "p1";

/* مسیرهایی که رابط کاربری هنگام باز شدن صدا می‌زند.
 * هر کدام با نقشی خوانده می‌شود که در عمل آن پنل را می‌بیند. */
const ROUTES = [
  ["/api/hrm/meta", "u-site"],
  ["/api/hrm/analytics", "u-pm"],
  ["/api/hrm/analytics?groupBy=trade", "u-pm"],
  ["/api/hrm/reports", "u-pm"],
  ["/api/hrm/manpower-plan", "u-planner"],
  ["/api/hrm/timesheets", "u-site"],
  ["/api/hrm/periods", "u-site"],
  ["/api/hrm/conflicts?status=open", "u-hr"],
  ["/api/hrm/devices", "u-hr"],
  ["/api/hrm/people", "u-hr"],
  ["/api/hrm/crews", "u-site"],
  ["/api/hrm/rate-cards", "u-hr"],
  ["/api/hrm/cost/postings", "u-pm"],
  ["/api/events/outbox", "u-pmo"],
  ["/api/events/reconcile", "u-pmo"],
  ["/api/events/catalog", "u-pmo"],
  ["/api/hrm/rca-catalog", "u-pm"],
  ["/api/hrm/productivity?periodCode=2026-01", "u-pm"],
  ["/api/hrm/rates/calibration", "u-pm"],
];

const snap = {};
let ok = 0;
let fail = 0;

for (const [path, user] of ROUTES) {
  const url = path.includes("?") ? `${path}&projectId=${P}` : `${path}?projectId=${P}`;
  try {
    const res = await fetch(`${API}${url}`, { headers: { "x-user-id": user } });
    const body = await res.json().catch(() => null);
    /* کلید بدون `projectId` ذخیره می‌شود تا تطبیق ساده بماند؛ رابط
     * کاربری همیشه همان یک پروژه را می‌خواهد. */
    snap[path.split("?")[0]] = { status: res.status, body };
    if (res.ok) ok++; else fail++;
  } catch {
    fail++;
  }
}

if (ok === 0) {
  console.error(`⛔ سرور API روی ${API} پاسخ نداد.`);
  console.error("   ابتدا: PORT=4000 PERSIST_DRIVER=json DATA_DIR=./server/rundata node server/index.js");
  process.exit(1);
}

let html = await readFile("dist/index.html", "utf8");

/* ── ۱. جابه‌جایی اسکریپت به انتهای body ── */
const open = html.indexOf('<script type="module"');
const close = html.indexOf("</script>", open);
const rootAt = html.indexOf('id="root"');
if (open !== -1 && close !== -1 && open < rootAt) {
  const script = html.slice(open, close + 9);
  const rest = html.slice(0, open) + html.slice(close + 9);
  const bodyEnd = rest.lastIndexOf("</body>");
  html = rest.slice(0, bodyEnd) + script + "\n  " + rest.slice(bodyEnd);
}

/* ── ۲. تزریق دادهٔ آفلاین پیش از باندل ── */
const shim = `<script>
(function () {
  var SNAP = ${JSON.stringify(snap)};
  var realFetch = window.fetch ? window.fetch.bind(window) : null;

  function reply(status, body) {
    var text = JSON.stringify(body);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status: status,
      headers: { get: function (k) { return String(k).toLowerCase() === "content-type" ? "application/json" : null; } },
      json: function () { return Promise.resolve(body); },
      text: function () { return Promise.resolve(text); },
      arrayBuffer: function () { return Promise.resolve(new TextEncoder().encode(text).buffer); },
    });
  }

  window.__OFFLINE_SNAPSHOT__ = SNAP;

  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var path = url.split("?")[0].replace(/^https?:\\/\\/[^/]+/, "");

    if (path.indexOf("/api/") !== 0) {
      return realFetch ? realFetch(input, init) : reply(404, { ok: false });
    }

    var hit = SNAP[path];
    if (hit) return reply(hit.status, hit.body);

    /* مسیر نوشتنی یا ثبت‌نشده: خطای صریح بهتر از سکوت است — کاربر
     * باید بداند این یک عکس آفلاین است نه برنامهٔ زنده. */
    var method = (init && init.method) || "GET";
    if (method !== "GET") {
      return reply(503, {
        ok: false,
        error: {
          code: "E-OFFLINE",
          message: "این نسخهٔ آفلاین است؛ ثبت و تغییر نیاز به سرور زنده دارد",
          traceId: "offline",
        },
      });
    }
    return reply(200, { ok: true, data: {}, meta: { traceId: "offline", engine: "hrm-v1" } });
  };
})();
</script>
`;

html = html.replace("</head>", shim + "</head>");

/* نشان آفلاین تا کسی این فایل را با محیط زنده اشتباه نگیرد. */
const badge = `<div style="position:fixed;top:0;left:0;right:0;z-index:99999;
  background:#b45309;color:#fff;font:400 11px Vazirmatn,system-ui;
  padding:5px 12px;text-align:center;direction:rtl">
  نسخهٔ آفلاین — عکس دادهٔ ${new Date().toISOString().slice(0, 16).replace("T", " ")} ·
  خواندن کار می‌کند، ثبت و تغییر نه
</div><div style="height:26px"></div>`;
html = html.replace("<body>", "<body>\n" + badge);

await writeFile("dist/standalone.html", html, "utf8");

console.log(`✅ dist/standalone.html ساخته شد (${(html.length / 1048576).toFixed(1)} مگابایت)`);
console.log(`   ${ok} مسیر گرفته شد · ${fail} ناموفق`);
console.log("   با دوبار کلیک در مرورگر باز می‌شود — بدون نیاز به سرور.");
