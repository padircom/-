/**
 * سرور پیش‌نمایش — نسخهٔ ساخته‌شده را سرو می‌کند و `/api` را به سرور
 * REST می‌رساند.
 *
 * چرا لازم است: `vite dev` کلاینت HMR را در `index.html` تزریق می‌کند
 * و آن کلاینت تلاش می‌کند WebSocket به `wss://<host>` بزند. در محیط
 * پیش‌نمایش که از راه پروکسی HTTPS دیده می‌شود، آن اتصال برقرار
 * نمی‌شود و بارگذاری ماژول‌ها همان‌جا متوقف می‌ماند — نتیجه یک صفحهٔ
 * **سفید بدون هیچ خطایی** است.
 *
 * `hmr: false` در `vite.config.ts` هم جلوی تزریق را نمی‌گیرد؛ فقط
 * سوکت را خاموش می‌کند و کلاینت همچنان بارگذاری می‌شود.
 *
 * این سرور آن مشکل را دور می‌زند: خروجی `vite build` تک‌فایل است و
 * هیچ وابستگی به HMR ندارد.
 *
 * اجرا:
 *   npx vite build          # یک بار، یا پس از هر تغییر UI
 *   node server/preview.mjs
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = Number(process.env.PREVIEW_PORT || 5173);
const API = `http://127.0.0.1:${process.env.API_PORT || 4000}`;

const INDEX = join(ROOT, "dist", "index.html");

/**
 * انتقال اسکریپت باندل به انتهای `<body>`.
 *
 * `vite-plugin-singlefile` اسکریپت را همان‌جا که `<script src>` بود
 * درون‌خطی می‌کند — و چون قالب تک‌فایلی همه را به `<head>` می‌برد،
 * اسکریپت **پیش از** `<div id="root">` اجرا می‌شود.
 *
 * نتیجه: `createRoot(document.getElementById("root"))` روی `null`
 * صدا زده می‌شود و React با خطای #299 می‌شکند. صفحه سفید می‌ماند
 * بی‌آنکه سرور خطایی بدهد — همهٔ پاسخ‌ها ۲۰۰ هستند.
 *
 * راه درست، اصلاح خودِ پلاگین در زمان build است؛ ولی آن یعنی دست زدن
 * به `vite.config.ts` که قید کارفرماست. اینجا در زمان سرو جابه‌جا
 * می‌شود: نتیجه یکی است و پیکربندی دست‌نخورده می‌ماند.
 */
function fixScriptOrder(html) {
  const open = html.indexOf('<script type="module"');
  if (open === -1) return html;
  const close = html.indexOf("</script>", open);
  if (close === -1) return html;

  const rootAt = html.indexOf('id="root"');
  /* اگر اسکریپت از قبل پس از root است، کاری لازم نیست. */
  if (rootAt !== -1 && open > rootAt) return html;

  const script = html.slice(open, close + "</script>".length);
  const rest = html.slice(0, open) + html.slice(close + "</script>".length);

  const bodyEnd = rest.lastIndexOf("</body>");
  if (bodyEnd === -1) return html;
  return rest.slice(0, bodyEnd) + script + "\n  " + rest.slice(bodyEnd);
}

let cached = null;
let cachedAt = 0;
async function page() {
  /* در حافظه نگه داشته می‌شود چون ۱.۷ مگابایت است و در هر بارگذاری
   * خواندنش از دیسک بی‌دلیل است. برای دیدن تغییر UI، `vite build`
   * دوباره اجرا و این سرور restart شود. */
  /* کش بر پایهٔ زمان تغییر فایل بی‌اعتبار می‌شود: پس از هر
   * `vite build` بدون restart، نسخهٔ تازه سرو می‌شود. */
  const { mtimeMs } = await stat(INDEX);
  if (!cached || mtimeMs !== cachedAt) {
    const raw = await readFile(INDEX, "utf8");
    cached = Buffer.from(fixScriptOrder(raw), "utf8");
    cachedAt = mtimeMs;
  }
  return cached;
}

const server = createServer(async (req, res) => {
  try {
    /* مسیر API عیناً به سرور REST می‌رود — همان هدرها، همان بدنه.
     * `x-user-id` باید دست‌نخورده برسد وگرنه RBAC کار نمی‌کند. */
    if (req.url?.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;

      const headers = { ...req.headers };
      delete headers.host;
      delete headers["content-length"];

      const upstream = await fetch(`${API}${req.url}`, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : body,
      });

      const out = Buffer.from(await upstream.arrayBuffer());
      const pass = {};
      for (const [k, v] of upstream.headers) {
        /* `content-encoding` رد نمی‌شود: fetch از قبل بازش کرده و
         * فرستادنش مرورگر را به رمزگشایی دوباره وامی‌دارد. */
        if (["content-encoding", "content-length", "transfer-encoding"].includes(k)) continue;
        pass[k] = v;
      }
      res.writeHead(upstream.status, pass);
      res.end(out);
      return;
    }

    /* هر مسیر دیگری همان صفحه است — مسیریابی سمت کلاینت انجام
     * می‌شود، پس بازخوانی روی مسیر داخلی نباید ۴۰۴ بدهد. */
    const html = await page();
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`خطای سرور پیش‌نمایش: ${err.message}`);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("=======================================================");
  console.log(`  پیش‌نمایش روی http://localhost:${PORT}`);
  console.log(`  API از ${API} پروکسی می‌شود`);
  console.log("=======================================================");
});
