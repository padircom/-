#!/usr/bin/env node
/* نقشهٔ «مسیر → جدول» برای مسیرهایی که مستقیماً SQL می‌زنند.
 * خروجی: server/sqlRouteTables.json — فروشگاهِ جایگزین (fallbackStore.mjs)
 * از آن استفاده می‌کند تا هنگامِ نبودِ SQL Server بداند از کدام جدول بخواند.
 * بازتولید: npm run build:routemap
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const src = readFileSync(path.join(ROOT, "server/index.js"), "utf8");

const routes = [...src.matchAll(/app\.(get|post|patch|put|delete)\("([^"]+)"/g)].map((m) => ({
  pos: m.index,
  method: m[1].toUpperCase(),
  path: m[2],
}));

const out = [];
routes.forEach((route, i) => {
  const end = i + 1 < routes.length ? routes[i + 1].pos : src.length;
  const body = src.slice(route.pos, end);
  if (!body.includes("getPool(req)")) return;
  const tables = [...new Set([...body.matchAll(/dbo\.([A-Za-z_]\w*)/g)].map((m) => m[1]))];
  out.push({ method: route.method, path: route.path, tables });
});

writeFileSync(
  path.join(ROOT, "server/sqlRouteTables.json"),
  `${JSON.stringify(out, null, 2)}\n`,
  "utf8",
);
console.log(`✓ server/sqlRouteTables.json — ${out.length} مسیرِ وابسته به SQL`);
