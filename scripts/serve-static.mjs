#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────
   پیش‌نمایشِ ایستا از خروجی تولید (dist) + پروکسیِ /api به سرورِ :4000
   استفاده:  npm run build && node scripts/serve-static.mjs
   پیش‌فرض پورت ۸۰۸۰ (با PORT قابل تغییر). روی 0.0.0.0 گوش می‌دهد تا
   از بیرونِ ماشین (مرورگر ویندوز از مسیر پروکسی) در دسترس باشد.
   ───────────────────────────────────────────────────────────────────── */
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8080);
const API_PORT = Number(process.env.API_PORT || 4000);

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
});
