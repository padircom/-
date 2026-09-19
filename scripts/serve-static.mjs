#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────
   پیش‌نمایشِ ایستا از خروجی تولید (dist) + پروکسیِ /api به سرورِ :4000
   استفاده:  npm run build && node scripts/serve-static.mjs
   پیش‌فرض پورت ۸۰۸۰ (با PORT قابل تغییر). روی 0.0.0.0 گوش می‌دهد تا
   از بیرونِ ماشین (مرورگر ویندوز از مسیر پروکسی) در دسترس باشد.
   ───────────────────────────────────────────────────────────────────── */
import http from "node:http";
import https from "node:https";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8080);
const API_PORT = Number(process.env.API_PORT || 4000);

/* ── کاشیِ نقشه برای شبکه‌ی بسته ──────────────────────────────────────
   مرورگرِ کارفرما معمولاً به اینترنت دسترسی ندارد، امّا سرور برنامه
   دارد (یا می‌تواند یک‌بار کش کند). مسیر:

     ۱) پوشه‌ی سازمانی  tiles/<src>/<z>/<x>/<y>.png   (دستی/ exported)
     ۲) کشِ دیسک        .cache/tiles/…
     ۳) بالادستیِ عمومی (فقط اگر TILE_OFFLINE_ONLY=1 نباشد)

   آدرسِ بالادستی با TILE_UPSTREET / TILE_UP_SAT / TILE_UP_LIGHT قابلِ
   تغییر است تا به سرورِ کاشیِ داخلی سازمان (WMTS/XYZ) وصل شود.
   ───────────────────────────────────────────────────────────────────── */
const TILE_DIR = path.resolve(__dirname, "..", "tiles");
const TILE_CACHE = path.resolve(__dirname, "..", ".cache", "tiles");
const OFFLINE_ONLY = process.env.TILE_OFFLINE_ONLY === "1";
const UPSTREAM = {
  street: process.env.TILE_UP_STREET || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  satellite: process.env.TILE_UP_SAT || "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  light: process.env.TILE_UP_LIGHT || "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
};
const TILE_TYPES = Object.keys(UPSTREAM);

const tilePath = (base, src, z, x, y) => path.join(base, src, String(z), String(x), `${y}.png`);

function serveTile(res, file, cacheable) {
  res.writeHead(200, {
    "content-type": "image/png",
    "cache-control": cacheable ? "public, max-age=2592000" : "no-cache",
  });
  createReadStream(file).pipe(res);
}

function fetchUpstream(src, z, x, y) {
  const url = UPSTREAM[src].replace("{z}", z).replace("{x}", x).replace("{y}", y);
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "user-agent": "PM-Control-TileProxy/1.0" } }, (r) => {
      if (r.statusCode !== 200) {
        r.resume();
        reject(new Error(`upstream ${r.statusCode}`));
        return;
      }
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.setTimeout(8000, () => req.destroy(new Error("timeout")));
  });
}

async function handleTile(req, res, src, z, x, y) {
  /* ۱) کاشیِ سازمانی */
  const local = tilePath(TILE_DIR, src, z, x, y);
  if (existsSync(local)) return serveTile(res, local, true);

  /* ۲) کش */
  const cached = tilePath(TILE_CACHE, src, z, x, y);
  if (existsSync(cached)) return serveTile(res, cached, true);

  /* ۳) بالادستی */
  if (OFFLINE_ONLY) {
    res.writeHead(404, { "content-type": "text/plain" }).end("tile not available offline");
    return;
  }
  try {
    const buf = await fetchUpstream(src, z, x, y);
    try {
      mkdirSync(path.dirname(cached), { recursive: true });
      writeFileSync(cached, buf);
    } catch {
      /* کش اختیاری است */
    }
    res.writeHead(200, { "content-type": "image/png", "cache-control": "public, max-age=2592000" });
    res.end(buf);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("tile unavailable");
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

if (!existsSync(ROOT)) {
  console.error("dist یافت نشد — اول `npm run build` را اجرا کنید.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  /* هرچه /api است به سرور اصلی می‌رود */
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: API_PORT,
        path: url.pathname + url.search,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` },
      },
      (up) => {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: { code: "API_UNREACHABLE" } }));
    });
    req.pipe(upstream);
    return;
  }

  /* کاشی‌های نقشه: /tiles/<street|satellite|light>/<z>/<x>/<y>.png */
  const tileMatch = url.pathname.match(/^\/tiles\/([a-z]+)\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (tileMatch) {
    const [, src, z, x, y] = tileMatch;
    if (!TILE_TYPES.includes(src)) {
      res.writeHead(404, { "content-type": "text/plain" }).end("unknown tile source");
      return;
    }
    void handleTile(req, res, src, z, x, y);
    return;
  }

  /* بقیه: فایل‌های ایستای dist (تک‌فایل، همه‌چیز درون index.html است) */
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(ROOT, "index.html");

  res.writeHead(200, {
    "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-cache",
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`پیش‌نمایش ایستا: http://0.0.0.0:${PORT}  (dist)  ·  /api → :${API_PORT}`);
  console.log(`کاشی نقشه: /tiles/{${TILE_TYPES.join("|")}}/{z}/{x}/{y}.png  ·  حالت: ${OFFLINE_ONLY ? "فقط آفلاین/داخلی" : "کش + بالادستی"}`);
});
