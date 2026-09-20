/* ─────────────────────────────────────────────────────────────────────
   فروشگاهِ جایگزین برای زمانی که SQL Server در دسترس نیست

   حدود ۵۰ مسیر در server/index.js مستقیماً با mssql کار می‌کنند
   (getPool(req)). بدون SQL Server این مسیرها ۵۰۰ می‌دهند و کلاینت به
   داده‌ی نمونه برمی‌گردد — یعنی «هیچ چیز ذخیره نمی‌شود».

   این ماژول همان مسیرها را از دو منبع تغذیه می‌کند:
     ۱) فایل‌هایِ درایورِ JSON در server/data/<table>.json  (نوشتنی)
     ۲) داده‌ی اولیه‌ی database/seed-data-mssql.sql         (فقط‌خواندنی)

   هدف: برنامه بدون SQL Server هم با داده‌ی واقعی کار کند و نوشتن‌ها واقعاً
   ذخیره شوند؛ با تنظیمِ SQL_SERVER، همه‌چیز خودکار به پایگاه می‌رود.
   ───────────────────────────────────────────────────────────────────── */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.cwd(), process.env.DATA_DIR)
  : path.join(ROOT, "server", "data");

if (!existsSync(DATA_DIR)) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* اگر هم نشد، فقط حافظه‌ای کار می‌کنیم */
  }
}

const memory = new Map();

const fileFor = (table) => path.join(DATA_DIR, `${table}.json`);

function readTable(table) {
  if (memory.has(table)) return memory.get(table);
  let rows = [];
  const file = fileFor(table);
  try {
    if (existsSync(file)) rows = JSON.parse(readFileSync(file, "utf8")) || [];
  } catch {
    rows = [];
  }
  if (!Array.isArray(rows)) rows = [];
  memory.set(table, rows);
  return rows;
}

function writeTable(table, rows) {
  memory.set(table, rows);
  try {
    writeFileSync(fileFor(table), JSON.stringify(rows, null, 2), "utf8");
  } catch {
    /* ذخیره نشد — در حافظه می‌ماند تا پایانِ فرایند */
  }
}

/* ── داده‌ی اولیه از database/seed-data-mssql.sql ───────────────────── */
let seedCache = null;

function parseInserts(sql) {
  const rows = new Map();
  const re = /INSERT INTO\s+(?:dbo\.)?([A-Za-z_]\w*)\s*\(([^)]*)\)\s*VALUES\s*\(([^;]*)\);/gi;
  for (const m of sql.matchAll(re)) {
    const [, table, colsRaw, valsRaw] = m;
    const cols = colsRaw.split(",").map((c) => c.trim());
    const vals = [];
    let cur = "";
    let inStr = false;
    for (let i = 0; i < valsRaw.length; i += 1) {
      const ch = valsRaw[i];
      if (ch === "'") {
        if (inStr && valsRaw[i + 1] === "'") {
          cur += "'";
          i += 1;
        } else inStr = !inStr;
        continue;
      }
      if (ch === "," && !inStr) {
        vals.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    vals.push(cur.trim());
    const row = {};
    cols.forEach((c, i) => {
      const raw = vals[i] ?? "";
      const value = raw.startsWith("'")
        ? raw.slice(1, -1).replace(/''/g, "'")
        : raw === "NULL"
          ? null
          : Number.isNaN(Number(raw))
            ? raw
            : Number(raw);
      row[c] = value;
    });
    const list = rows.get(table) ?? [];
    list.push({ Id: list.length + 1, ...row });
    rows.set(table, list);
  }
  return rows;
}

function seedRows() {
  if (seedCache) return seedCache;
  seedCache = new Map();
  const file = path.join(ROOT, "database", "seed-data-mssql.sql");
  try {
    if (existsSync(file)) seedCache = parseInserts(readFileSync(file, "utf8"));
  } catch {
    /* بدون داده‌ی اولیه ادامه می‌دهیم */
  }
  return seedCache;
}

/* ── API عمومی ──────────────────────────────────────────────────────── */
export function select(table, { projectCode } = {}) {
  if (!table) return [];
  const stored = readTable(table);
  const seeded = seedRows().get(table) ?? [];
  /* نخستین خواندن: داده‌ی اولیه یک‌بار در فروشگاه نشانده می‌شود تا بعد از
     آن، ویرایش و افزودن روی همان پایه انجام شود (نه به‌جای آن). */
  let rows = stored;
  if (!stored.length && seeded.length) {
    rows = seeded.map((r) => ({ ...r }));
    writeTable(table, rows);
  }
  if (!rows.length) return [];
  const scoped = projectCode
    ? rows.filter((r) => !r.ProjectCode || r.ProjectCode === projectCode)
    : rows;
  return scoped.map((r) => ({ ...r }));
}

export function insert(table, row) {
  if (!table) return null;
  const rows = readTable(table);
  const saved = { Id: rows.length ? Math.max(...rows.map((r) => Number(r.Id) || 0)) + 1 : 1, ...row };
  rows.push(saved);
  writeTable(table, rows);
  return saved;
}

export function patch(table, id, patchRow) {
  if (!table) return null;
  const rows = readTable(table);
  const idx = rows.findIndex((r) => String(r.Id) === String(id));
  if (idx < 0) return null;
  rows[idx] = { ...rows[idx], ...patchRow };
  writeTable(table, rows);
  return rows[idx];
}

export function remove(table, id) {
  if (!table) return false;
  const rows = readTable(table);
  const next = rows.filter((r) => String(r.Id) !== String(id));
  if (next.length === rows.length) return false;
  writeTable(table, next);
  return true;
}

/** نام جدول از روی مسیر — با نقشه‌ای که هنگام ساخت تولید می‌شود. */
let routeMap = null;
export function tableForRoute(routePath, method = "GET") {
  if (!routeMap) {
    routeMap = new Map();
    const file = path.join(__dirname, "sqlRouteTables.json");
    try {
      if (existsSync(file)) {
        const list = JSON.parse(readFileSync(file, "utf8"));
        for (const r of list) routeMap.set(`${r.method} ${r.path}`, r.tables ?? []);
      }
    } catch {
      /* بدون نقشه، نام جدول را حدس نمی‌زنیم */
    }
  }
  const key = `${String(method).toUpperCase()} ${routePath}`;
  if (routeMap.has(key)) return routeMap.get(key)[0] ?? null;
  for (const [k, v] of routeMap) {
    if (!k.startsWith(`${String(method).toUpperCase()} `)) continue;
    const p = k.slice(k.indexOf(" ") + 1);
    if (toRegExp(p).test(routePath)) return v[0] ?? null;
  }
  return null;
}

function toRegExp(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\/:([A-Za-z]\w*)/g, "/[^/]+");
  return new RegExp(`^${escaped}$`);
}

export const driverKind = () => "json";
