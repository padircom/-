#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────
   تولیدِ شِمای پایگاه داده از روی خودِ کد

   چرا تولید به‌جای نوشتنِ دستی؟ فریم‌ورک به ۲۲۳ جدول ارجاع می‌دهد و هیچ
   فهرستِ دستی با کد همگام نمی‌ماند. این اسکریپت:

     ۱) نام جداول را از فیلدِ sql در src/data/framework.ts می‌گیرد
     ۲) ستون‌های واقعی را از رشته‌های SQL در server/*.js و src/services/*.ts
        استخراج می‌کند (INSERT/UPDATE/SELECT … FROM dbo.Table)
     ۳) نوع هر ستون را از نامش استنتاج می‌کند
     ۴) برای جدول‌هایی که ستونِ شناخته‌شده ندارند، ستونِ Payload (JSON) و
        ستون‌های حسابرسی می‌گذارد تا جدول قابلِ استفاده باشد تا وقتی که
        شِمای واقعیِ سازمان (database/schema.custom.sql) جایگزین شود

   خروجی: database/schema-mssql.sql و database/schema-sqlite.sql و database/seed-data.sql
   استفاده: npm run db:schema
   ───────────────────────────────────────────────────────────────────── */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "database");

/* ── ۱) نامِ جداول از فریم‌ورک ───────────────────────────────────────── */
const framework = readFileSync(path.join(ROOT, "src/data/framework.ts"), "utf8");
const tables = new Set();
for (const m of framework.matchAll(/sql:\s*\[([^\]]*)\]/g)) {
  for (const t of m[1].matchAll(/"([A-Za-z_]\w*)"/g)) tables.add(t[1]);
}
/* ساختارِ قابل ویرایشِ d6/d20 در یک جدولِ واقعیِ پروژه‌ای ذخیره می‌شود؛
   چون نام آن در metadata نمایشیِ زیرفرآیندها تکرار نمی‌شود، صریح اضافه‌اش
   می‌کنیم تا خروجیِ DDL با لایهٔ persistence همگام بماند. */
tables.add("ProcessTree");

/* ── ۲) ستون‌ها از رشته‌های SQLِ کد ─────────────────────────────────── */
const SQL_JUNK = new Set([
  "NVARCHAR", "VARCHAR", "INT", "BIGINT", "BIT", "MAX", "NULL", "NOT", "VALUES", "OUTPUT",
  "INSERTED", "SET", "AND", "OR", "SELECT", "FROM", "WHERE", "AS", "DISTINCT", "TOP", "COUNT",
  "SUM", "AVG", "MIN", "MAXVALUE", "CASE", "WHEN", "THEN", "ELSE", "END", "GETDATE", "COALESCE",
  "CAST", "CONVERT", "DESC", "ASC", "JOIN", "LEFT", "INNER", "ON", "GROUP", "ORDER", "BY", "HAVING",
  "UPDATE", "INSERT", "DELETE", "INTO", "IS", "IN", "LIKE", "BETWEEN", "ROW_NUMBER", "OVER",
  "PARTITION", "WITH", "NOLOCK", "DBO", "RETURNING", "MERGE", "EXISTS", "UNION", "ALL",
]);

const columns = new Map();
const addCols = (table, list) => {
  const set = columns.get(table) ?? new Set();
  for (const c of list) {
    if (!/^[A-Z][A-Za-z0-9_]{2,40}$/.test(c)) continue;
    if (SQL_JUNK.has(c.toUpperCase())) continue;
    set.add(c);
  }
  columns.set(table, set);
};

const sourceFiles = [
  ...globSync(path.join(ROOT, "server/*.js")),
  ...globSync(path.join(ROOT, "src/services/*.ts")),
  ...globSync(path.join(ROOT, "src/components/*.tsx")),
];

for (const file of sourceFiles) {
  const txt = readFileSync(file, "utf8");
  for (const m of txt.matchAll(/INSERT\s+INTO\s+(?:dbo\.)?([A-Za-z_]\w*)\s*\(([^)]*)\)/gi)) {
    addCols(m[1], m[2].match(/[A-Za-z_]\w*/g) ?? []);
  }
  for (const m of txt.matchAll(/UPDATE\s+(?:dbo\.)?([A-Za-z_]\w*)\s+SET\s+([^;]{0,600}?)(?:WHERE|FROM|;)/gi)) {
    addCols(m[1], [...m[2].matchAll(/([A-Za-z_]\w*)\s*=/g)].map((x) => x[1]));
  }
  for (const m of txt.matchAll(/SELECT\s+([\s\S]{0,400}?)\s+FROM\s+(?:dbo\.)?([A-Za-z_]\w*)/gi)) {
    const [, sel, table] = m;
    addCols(table, [...sel.matchAll(/\bAS\s+([A-Za-z_]\w*)/gi)].map((x) => x[1]));
    addCols(table, (sel.match(/\b[A-Z][A-Za-z0-9_]{2,40}\b/g) ?? []).slice(0, 40));
  }
}

/* ستون‌هایِ مرسوم که همهٔ ماژول‌ها دارند */
const COMMON = ["ProjectCode", "CreatedAt", "UpdatedAt", "IsDeleted"];

/* ── ۳) استنتاجِ نوع ─────────────────────────────────────────────────── */
function mssqlType(col) {
  const c = col.toLowerCase();
  if (col === "Id" || c === "id") return "BIGINT IDENTITY(1,1) NOT NULL";
  if (c.endsWith("id") && c.length > 2) return "BIGINT NULL";
  if (c.endsWith("date") || c.endsWith("at") || c.endsWith("on")) return "DATETIME2(0) NULL";
  if (/^(is|has|can|should)/.test(c) || c.endsWith("flag")) return "BIT NULL";
  if (/(qty|quantity|amount|rate|price|value|cost|pct|percent|weight|score|progress|km|hours|days|count|ratio|index|factor)/.test(c))
    return "DECIMAL(18,4) NULL";
  if (c.endsWith("json") || c.endsWith("payload")) return "NVARCHAR(MAX) NULL";
  if (/(notes?|description|remark|comment|detail|summary|body|message|text|fa|en)$/.test(c)) return "NVARCHAR(MAX) NULL";
  if (/(code|no|number|status|type|kind|unit|icon|color|version|ref)$/.test(c)) return "NVARCHAR(50) NULL";
  return "NVARCHAR(200) NULL";
}

function sqliteType(col) {
  const t = mssqlType(col);
  if (t.startsWith("BIGINT IDENTITY")) return "INTEGER PRIMARY KEY AUTOINCREMENT";
  if (t.startsWith("BIGINT")) return "INTEGER";
  if (t.startsWith("DECIMAL")) return "REAL";
  if (t.startsWith("BIT")) return "INTEGER";
  if (t.startsWith("DATETIME")) return "TEXT";
  return "TEXT";
}

/* ── ۴) تولید ───────────────────────────────────────────────────────── */
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function buildDdl(dialect) {
  const mssql = dialect === "mssql";
  const lines = [];
  lines.push(`-- ═══════════════════════════════════════════════════════════════`);
  lines.push(`-- شِمای تولیدشده برای ${mssql ? "SQL Server" : "SQLite"} — ${tables.size} جدول`);
  lines.push(`-- تولید خودکار از روی کد (scripts/generate-schema.mjs) — دستی ویرایش نکنید.`);
  lines.push(`-- اگر شِمای واقعی دارید، database/schema.custom.sql را جایگزین کنید.`);
  lines.push(`-- ═══════════════════════════════════════════════════════════════`);
  lines.push("");

  for (const table of [...tables].sort()) {
    if (table === "ProcessTree") {
      if (mssql) {
        lines.push(`IF OBJECT_ID(N'dbo.ProcessTree', N'U') IS NULL`);
        lines.push(`CREATE TABLE dbo.ProcessTree (`);
        lines.push(`    Id NVARCHAR(60) NOT NULL CONSTRAINT PK_ProcessTree PRIMARY KEY,`);
        lines.push(`    ProjectId NVARCHAR(60) NOT NULL,`);
        lines.push(`    DomainId NVARCHAR(20) NOT NULL,`);
        lines.push(`    Payload NVARCHAR(MAX) NOT NULL,`);
        lines.push(`    IsActive BIT NOT NULL CONSTRAINT DF_ProcessTree_IsActive DEFAULT 1,`);
        lines.push(`    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ProcessTree_CreatedAt DEFAULT SYSUTCDATETIME(),`);
        lines.push(`    CreatedBy NVARCHAR(60) NULL,`);
        lines.push(`    UpdatedAt DATETIME2(0) NULL,`);
        lines.push(`    UpdatedBy NVARCHAR(60) NULL,`);
        lines.push(`    RowVersion INT NOT NULL CONSTRAINT DF_ProcessTree_RowVersion DEFAULT 1`);
        lines.push(`);`);
        lines.push(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_ProcessTree_ProjectDomain' AND object_id = OBJECT_ID(N'dbo.ProcessTree'))`);
        lines.push(`  CREATE UNIQUE INDEX UX_ProcessTree_ProjectDomain ON dbo.ProcessTree(ProjectId, DomainId);`);
      } else {
        lines.push(`CREATE TABLE IF NOT EXISTS ProcessTree (`);
        lines.push(`    Id TEXT PRIMARY KEY,`);
        lines.push(`    ProjectId TEXT NOT NULL,`);
        lines.push(`    DomainId TEXT NOT NULL,`);
        lines.push(`    Payload TEXT NOT NULL,`);
        lines.push(`    IsActive INTEGER NOT NULL DEFAULT 1,`);
        lines.push(`    CreatedAt TEXT NOT NULL,`);
        lines.push(`    CreatedBy TEXT,`);
        lines.push(`    UpdatedAt TEXT,`);
        lines.push(`    UpdatedBy TEXT,`);
        lines.push(`    RowVersion INTEGER NOT NULL DEFAULT 1`);
        lines.push(`);`);
        lines.push(`CREATE UNIQUE INDEX IF NOT EXISTS UX_ProcessTree_ProjectDomain ON ProcessTree(ProjectId, DomainId);`);
      }
      lines.push("");
      continue;
    }
    const known = [...(columns.get(table) ?? [])].filter((c) => c !== "Id" && !COMMON.includes(c));
    const defs = [];
    if (mssql) {
      defs.push(`    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_${table} PRIMARY KEY`);
    } else {
      defs.push(`    Id INTEGER PRIMARY KEY AUTOINCREMENT`);
    }
    const used = new Set(["Id"]);
    for (const col of [...COMMON.slice(0, 1), ...known, ...COMMON.slice(1)]) {
      if (used.has(col)) continue;
      used.add(col);
      const type = mssql ? mssqlType(col) : sqliteType(col);
      if (mssql && col === "ProjectCode") defs.push(`    ProjectCode NVARCHAR(50) NULL`);
      else if (mssql && col === "CreatedAt") defs.push(`    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_${table}_CreatedAt DEFAULT SYSUTCDATETIME()`);
      else if (mssql && col === "UpdatedAt") defs.push(`    UpdatedAt DATETIME2(0) NULL`);
      else if (mssql && col === "IsDeleted") defs.push(`    IsDeleted BIT NOT NULL CONSTRAINT DF_${table}_IsDeleted DEFAULT 0`);
      else defs.push(`    ${col} ${type}`);
    }
    if (!known.length) defs.push(`    ${mssql ? "Payload NVARCHAR(MAX) NULL" : "Payload TEXT NULL"} -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی`);

    if (mssql) {
      lines.push(`IF OBJECT_ID(N'dbo.${table}', N'U') IS NULL`);
      lines.push(`CREATE TABLE dbo.${table} (`);
      lines.push(defs.join(",\n"));
      lines.push(`);`);
      lines.push(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_${table}_ProjectCode' AND object_id = OBJECT_ID(N'dbo.${table}'))`);
      lines.push(`  CREATE INDEX IX_${table}_ProjectCode ON dbo.${table}(ProjectCode);`);
    } else {
      lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`);
      lines.push(defs.join(",\n"));
      lines.push(`);`);
      lines.push(`CREATE INDEX IF NOT EXISTS IX_${table}_ProjectCode ON ${table}(ProjectCode);`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/* ── ۴.۵) شِما به‌صورتِ ماژولِ TypeScript برای نمایش در رابط برنامه ───── */
function buildSchemaModule(ddl, count) {
  const safe = ddl.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return `/* GENERATED توسط scripts/generate-schema.mjs — ویرایش دستی ممنوع.
 * بازتولید: npm run db:schema
 * شِمای کاملِ ${count} جدولِ ارجاع‌شده در فریم‌ورک. */
export const PMIS_FULL_SCHEMA_SCRIPT = \`${safe}\`;

export const PMIS_FULL_SCHEMA_TABLE_COUNT = ${count};
`;
}

/* ── ۵) گَزِتیر (برای مختصاتِ داده‌ی اولیه) ──────────────────────────── */
const GEO = new Map();
const geoPath = path.join(ROOT, "src/services/geo.ts");
if (existsSync(geoPath)) {
  const geo = readFileSync(geoPath, "utf8");
  for (const m of geo.matchAll(/"([^"]+)":\s*\{\s*coord:\s*\{\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)\s*\},\s*accuracy:\s*"(\w+)"/g)) {
    GEO.set(m[1], { lat: Number(m[2]), lon: Number(m[3]), accuracy: m[4] });
  }
}
function resolveGeo(location) {
  const key = String(location).trim();
  if (GEO.has(key)) return GEO.get(key);
  for (const [k, v] of GEO) if (key.includes(k) || k.includes(key)) return v;
  return null;
}

/* ── ۶) داده‌ی اولیه از فریم‌ورک ─────────────────────────────────────── */
function buildSeed(dialect) {
  const mssql = dialect === "mssql";
  const out = [];
  out.push(`-- داده‌ی اولیه (تولید خودکار از src/data/framework.ts)`);
  out.push("");

  const clusterRe = /\{\s*id:\s*"(c\d+)",\s*icon:\s*"([^"]*)",\s*color:\s*"([^"]*)",\s*title:\s*\{\s*fa:\s*"([^"]*)",\s*en:\s*"([^"]*)"/g;
  let industries = 0;
  for (const m of framework.matchAll(clusterRe)) {
    const [, id, icon, color, fa, en] = m;
    out.push(
      `INSERT INTO ${mssql ? "dbo." : ""}Industry_Master (Code, TitleFa, TitleEn, Icon, Color, IsActive) VALUES (${q(id)}, ${q(fa)}, ${q(en)}, ${q(icon)}, ${q(color)}, 1);`,
    );
    industries += 1;
  }
  out.push(`-- ${industries} صنعت`);
  out.push("");

  const projRe = /\{\s*id:\s*"([\w-]+)",\s*code:\s*"([^"]*)",\s*name:\s*\{\s*fa:\s*"([^"]*)",\s*en:\s*"([^"]*)"\s*\},\s*client:\s*\{\s*fa:\s*"([^"]*)",\s*en:\s*"([^"]*)"\s*\},\s*status:\s*"(\w+)",\s*progress:\s*(\d+),\s*budget:\s*"([^"]*)",\s*location:\s*\{\s*fa:\s*"([^"]*)",\s*en:\s*"([^"]*)"/g;
  let n = 0;
  for (const m of framework.matchAll(projRe)) {
    const [, , code, nameFa, nameEn, clientFa, clientEn, status, progress, budget, locFa, locEn] = m;
    const industryCode = code.slice(0, 2).toUpperCase();
    out.push(
      `INSERT INTO ${mssql ? "dbo." : ""}Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) ` +
        `VALUES (${q(code)}, ${q(nameFa)}, ${q(nameEn)}, ${q(clientFa)}, ${q(clientEn)}, ${q(status)}, ${progress}, ${q(budget)}, ${q(locFa)}, ${q(locEn)}, ${q(industryCode)}, 1);`,
    );
    n += 1;
  }
  /* مختصاتِ سایت از گَزِتیر — همان چیزی که ماژول GIS استفاده می‌کند */
  out.push("");
  out.push(`-- مختصاتِ سایت از گَزِتیرِ ماژول GIS`);
  let siteCount = 0;
  for (const m of framework.matchAll(projRe)) {
    const code = m[2];
    const locFa = m[10];
    const g = resolveGeo(locFa);
    if (!g) continue;
    out.push(
      `INSERT INTO ${mssql ? "dbo." : ""}Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) ` +
        `VALUES (${q(code)}, ${g.lat}, ${g.lon}, ${q(g.accuracy)}, ${q(locFa)});`,
    );
    siteCount += 1;
  }
  out.push(`-- ${siteCount} سایت`);
  out.unshift(`-- ${n} پروژه`);
  return out.join("\n");
}

mkdirSync(OUT, { recursive: true });
const mssqlDdl = buildDdl("mssql");
const sqliteDdl = buildDdl("sqlite");
writeFileSync(path.join(OUT, "schema-mssql.sql"), mssqlDdl, "utf8");
writeFileSync(path.join(OUT, "schema-sqlite.sql"), sqliteDdl, "utf8");
writeFileSync(path.join(OUT, "seed-data-mssql.sql"), buildSeed("mssql"), "utf8");
writeFileSync(path.join(OUT, "seed-data-sqlite.sql"), buildSeed("sqlite"), "utf8");
writeFileSync(
  path.join(ROOT, "src/services/pmisFullSchema.ts"),
  buildSchemaModule(mssqlDdl, tables.size),
  "utf8",
);

const withCols = [...tables].filter((t) => (columns.get(t) ?? new Set()).size > 1).length;
console.log(`✓ database/schema-mssql.sql     — ${tables.size} جدول (${withCols} با ستونِ استخراج‌شده)`);
console.log(`✓ database/schema-sqlite.sql    — ${tables.size} جدول`);
console.log(`✓ database/seed-data-mssql.sql  — داده‌ی اولیه`);
console.log(`✓ database/seed-data-sqlite.sql — داده‌ی اولیه`);
console.log(`✓ src/services/pmisFullSchema.ts — شِمای کامل در دسترسِ رابط برنامه`);
