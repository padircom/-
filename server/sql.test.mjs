import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AUDIT_COLUMN_NAMES,
  MIGRATIONS,
  PERSISTENCE_VERSION,
  SCHEMA,
  allColumns,
  applySelect,
  assertIdentifier,
  buildCount,
  buildDelete,
  buildInsert,
  buildSelect,
  buildUpdate,
  checksumOf,
  columnDdl,
  concurrencyResult,
  detectDrift,
  fromStorage,
  generateDdl,
  indexDdl,
  isSafeIdentifier,
  mapFromStorage,
  mapToStorage,
  matchesWhere,
  migrationPlan,
  newId,
  pendingMigrations,
  qualifiedName,
  quoteIdent,
  schemaStats,
  sqlType,
  tableDdl,
  tableDef,
  tablesOfModule,
  toStorage,
  validateRow,
  validateSchema,
  withAudit,
} from "./sqlLogic.js";
import { JsonFileDriver, ValidationError, createRepository } from "./persistence/driver.mjs";

const Activity = tableDef("Activity");
const ProgressEntry = tableDef("ProgressEntry");

/* ══════════════ ۱. یکپارچگی اسکیما ══════════════ */

test("نسخه و اندازه اسکیما", () => {
  assert.equal(PERSISTENCE_VERSION, "sql-v1");
  const s = schemaStats();
  assert.equal(s.tables, SCHEMA.length);
  assert.ok(s.tables >= 30, `تعداد جدول کم است: ${s.tables}`);
  assert.ok(s.columns > 300);
});

test("اسکیما هیچ ایراد ساختاری ندارد", () => {
  assert.deepEqual(validateSchema(), []);
});

test("هر جدول ستون‌های حسابرسی را دارد", () => {
  for (const t of SCHEMA) {
    const names = allColumns(t).map((c) => c.name);
    for (const a of AUDIT_COLUMN_NAMES) assert.ok(names.includes(a), `${t.name} فاقد ${a}`);
  }
});

test("کلید اصلی هر جدول ستونی واقعی و غیرتهی‌پذیر است", () => {
  for (const t of SCHEMA) {
    const pk = allColumns(t).find((c) => c.name === t.pk);
    assert.ok(pk, `${t.name}: کلید اصلی یافت نشد`);
    assert.equal(pk.nullable, false, `${t.name}: کلید اصلی nullable است`);
  }
});

test("همه ستون‌های کلید خارجی به جدول موجود اشاره می‌کنند", () => {
  const names = new Set(SCHEMA.map((t) => t.name));
  for (const t of SCHEMA) {
    for (const fk of t.foreignKeys ?? []) assert.ok(names.has(fk.refTable), `${t.name} → ${fk.refTable}`);
  }
});

test("tablesOfModule جدول‌های هر ماژول را می‌دهد", () => {
  assert.ok(tablesOfModule("d2").length >= 6);
  assert.equal(tablesOfModule("d99").length, 0);
  assert.equal(tableDef("NoSuchTable"), undefined);
});

/* ══════════════ ۲. ایمنی شناسه ══════════════ */

test("شناسه معتبر پذیرفته می‌شود", () => {
  assert.equal(isSafeIdentifier("Activity"), true);
  assert.equal(isSafeIdentifier("Project_Code_2"), true);
  assert.equal(assertIdentifier("Id"), "Id");
});

test("تزریق در نام جدول یا ستون استثنا می‌دهد", () => {
  for (const bad of ["Activity; DROP TABLE x", "1abc", "a-b", "col name", "", "[Id]", "Id--", "'x'"]) {
    assert.equal(isSafeIdentifier(bad), false, `باید ناامن باشد: ${bad}`);
    assert.throws(() => assertIdentifier(bad), /SQL_UNSAFE_IDENTIFIER/);
  }
});

test("نقل‌قول شناسه بر حسب گویش", () => {
  assert.equal(quoteIdent("Id", "mssql"), "[Id]");
  assert.equal(quoteIdent("Id", "sqlite"), '"Id"');
  assert.equal(qualifiedName("Activity", "mssql"), "[dbo].[Activity]");
  assert.equal(qualifiedName("Activity", "sqlite"), '"Activity"');
});

/* ══════════════ ۳. تولید DDL ══════════════ */

test("نگاشت نوع برای SQL Server", () => {
  assert.equal(sqlType({ name: "x", kind: "text", len: 50 }, "mssql"), "NVARCHAR(50)");
  assert.equal(sqlType({ name: "x", kind: "text" }, "mssql"), "NVARCHAR(MAX)");
  assert.equal(sqlType({ name: "x", kind: "decimal", precision: 9, scale: 4 }, "mssql"), "DECIMAL(9,4)");
  assert.equal(sqlType({ name: "x", kind: "bool" }, "mssql"), "BIT");
  assert.equal(sqlType({ name: "x", kind: "datetime" }, "mssql"), "DATETIME2");
  assert.equal(sqlType({ name: "x", kind: "json" }, "mssql"), "NVARCHAR(MAX)");
});

test("نگاشت نوع برای SQLite ساده‌سازی می‌شود", () => {
  assert.equal(sqlType({ name: "x", kind: "bool" }, "sqlite"), "INTEGER");
  assert.equal(sqlType({ name: "x", kind: "datetime" }, "sqlite"), "TEXT");
  assert.equal(sqlType({ name: "x", kind: "decimal" }, "sqlite"), "NUMERIC");
});

test("columnDdl تهی‌پذیری و پیش‌فرض را می‌آورد", () => {
  assert.equal(columnDdl({ name: "Code", kind: "text", len: 20, nullable: false }, "mssql"), "[Code] NVARCHAR(20) NOT NULL");
  assert.match(columnDdl({ name: "CreatedAt", kind: "datetime", nullable: false, default: "SYSUTCDATETIME" }, "mssql"), /DEFAULT SYSUTCDATETIME\(\)/);
  assert.match(columnDdl({ name: "CreatedAt", kind: "datetime", nullable: false, default: "SYSUTCDATETIME" }, "sqlite"), /DEFAULT CURRENT_TIMESTAMP/);
});

test("tableDdl کلید اصلی و کلید خارجی را می‌سازد", () => {
  const ddl = tableDdl(tableDef("Project"), "mssql");
  assert.match(ddl, /CREATE TABLE \[dbo\]\.\[Project\]/);
  assert.match(ddl, /CONSTRAINT \[PK_Project\] PRIMARY KEY \(\[Id\]\)/);
  assert.match(ddl, /FOREIGN KEY \(\[IndustryId\]\) REFERENCES \[dbo\]\.\[Industry\]/);
  assert.match(ddl, /IF OBJECT_ID\('dbo\.Project', 'U'\) IS NULL/);
});

test("tableDdl در SQLite از IF NOT EXISTS استفاده می‌کند", () => {
  const ddl = tableDdl(tableDef("Project"), "sqlite");
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS "Project"/);
  assert.ok(!ddl.includes("OBJECT_ID"));
});

test("indexDdl یکتایی را رعایت می‌کند", () => {
  const t = tableDef("Project");
  const uniq = t.indexes.find((i) => i.unique);
  assert.match(indexDdl(t, uniq, "mssql"), /CREATE UNIQUE INDEX/);
  const plain = t.indexes.find((i) => !i.unique);
  assert.match(indexDdl(t, plain, "mssql"), /^CREATE INDEX/);
});

test("generateDdl همه جدول‌ها را پوشش می‌دهد و GO می‌گذارد", () => {
  const ddl = generateDdl("mssql");
  for (const t of SCHEMA) assert.ok(ddl.includes(`[dbo].[${t.name}]`), `${t.name} در DDL نیست`);
  assert.ok(ddl.includes("\nGO\n"));
  assert.ok(ddl.startsWith("-- Arena Platform · sql-v1"));
});

test("generateDdl برای SQLite بدون GO است", () => {
  const ddl = generateDdl("sqlite");
  assert.ok(!ddl.includes("\nGO\n"));
  assert.ok(ddl.includes('CREATE TABLE IF NOT EXISTS "Activity"'));
});

/* ══════════════ ۴. مهاجرت ══════════════ */

test("نسخه مهاجرت‌ها یکتا و مرتب است", () => {
  const versions = MIGRATIONS.map((m) => m.version);
  assert.equal(new Set(versions).size, versions.length);
  assert.deepEqual(versions, [...versions].sort());
});

test("مهاجرت‌ها روی هم همه جدول‌ها را می‌سازند", () => {
  const all = MIGRATIONS.flatMap((m) => m.statements).join("\n");
  for (const t of SCHEMA) assert.ok(all.includes(`[dbo].[${t.name}]`), `${t.name} در هیچ مهاجرتی نیست`);
});

test("چک‌سام پایدار و مستقل از فاصله‌گذاری است", () => {
  const a = checksumOf(["SELECT  1", "SELECT 2"]);
  const b = checksumOf(["SELECT 1", "  SELECT   2  "]);
  assert.equal(a, b);
  assert.notEqual(a, checksumOf(["SELECT 1", "SELECT 3"]));
  assert.match(a, /^fnv1a-[0-9a-f]{8}$/);
});

test("pendingMigrations فقط اجرانشده‌ها را می‌دهد", () => {
  const applied = [{ version: "0001", name: "core_and_security", checksum: checksumOf(MIGRATIONS[0].statements), appliedAt: "2026-01-01T00:00:00Z" }];
  const pending = pendingMigrations(applied);
  assert.equal(pending.length, MIGRATIONS.length - 1);
  assert.equal(pending[0].version, "0002");
});

test("پایگاه داده کاملاً به‌روز هیچ مهاجرت معلقی ندارد", () => {
  const applied = MIGRATIONS.map((m) => ({ version: m.version, name: m.name, checksum: checksumOf(m.statements), appliedAt: "2026-01-01T00:00:00Z" }));
  const plan = migrationPlan(applied);
  assert.equal(plan.upToDate, true);
  assert.deepEqual(plan.pending, []);
  assert.deepEqual(plan.drift, []);
});

test("detectDrift ویرایش مهاجرت اجراشده را می‌گیرد", () => {
  const applied = [{ version: "0001", name: "core_and_security", checksum: "fnv1a-deadbeef", appliedAt: "2026-01-01T00:00:00Z" }];
  const drift = detectDrift(applied);
  assert.equal(drift.length, 1);
  assert.equal(drift[0].version, "0001");
  assert.equal(drift[0].found, "fnv1a-deadbeef");
  assert.notEqual(drift[0].expected, "fnv1a-deadbeef");
});

test("migrationPlan مهاجرت ناشناخته در پایگاه داده را گزارش می‌کند", () => {
  const plan = migrationPlan([{ version: "9999", name: "from_the_future", checksum: "x", appliedAt: "2026-01-01T00:00:00Z" }]);
  assert.deepEqual(plan.missingLocally, ["9999"]);
  assert.equal(plan.upToDate, false);
});

test("پایگاه داده خالی همه مهاجرت‌ها را معلق می‌بیند", () => {
  const plan = migrationPlan([]);
  assert.equal(plan.pending.length, MIGRATIONS.length);
  assert.equal(plan.upToDate, false);
});

/* ══════════════ ۵. اعتبارسنجی ردیف ══════════════ */

const validActivity = {
  Id: "act-1",
  ProjectId: "prj-1",
  Code: "A-1000",
  NameFa: "بتن‌ریزی فونداسیون",
  PlannedStart: "2026-09-01",
  PlannedFinish: "2026-09-20",
  PhysicalPct: 0,
  IsCritical: false,
};

test("ردیف معتبر هیچ ایرادی ندارد", () => {
  assert.deepEqual(validateRow(Activity, validActivity, "insert"), []);
});

test("ستون ناشناخته رد می‌شود", () => {
  const issues = validateRow(Activity, { ...validActivity, Bogus: 1 });
  assert.ok(issues.some((i) => i.code === "E-SQL-UNKNOWN-COL" && i.column === "Bogus"));
});

test("ستون اجباری بدون پیش‌فرض در درج الزامی است", () => {
  const { NameFa, ...rest } = validActivity;
  assert.ok(validateRow(Activity, rest, "insert").some((i) => i.code === "E-SQL-NOT-NULL" && i.column === "NameFa"));
});

test("در به‌روزرسانی ستون غایب اجباری نیست", () => {
  assert.deepEqual(validateRow(Activity, { PhysicalPct: 50 }, "update"), []);
});

test("طول رشته بیش از حد گرفته می‌شود", () => {
  const issues = validateRow(Activity, { ...validActivity, Code: "x".repeat(61) });
  assert.ok(issues.some((i) => i.code === "E-SQL-LENGTH" && i.column === "Code"));
});

test("قالب تاریخ اجباری است", () => {
  assert.ok(validateRow(Activity, { ...validActivity, PlannedStart: "2026/09/01" }).some((i) => i.code === "E-SQL-DATE"));
  assert.ok(validateRow(Activity, { ...validActivity, PlannedStart: "1 Sep 2026" }).some((i) => i.code === "E-SQL-DATE"));
});

test("نوع عدد صحیح، بولی و متن بررسی می‌شود", () => {
  assert.ok(validateRow(Activity, { ...validActivity, DurationDays: 3.5 }).some((i) => i.code === "E-SQL-TYPE"));
  assert.ok(validateRow(Activity, { ...validActivity, IsCritical: "yes" }).some((i) => i.code === "E-SQL-TYPE"));
  assert.ok(validateRow(Activity, { ...validActivity, NameFa: 42 }).some((i) => i.code === "E-SQL-TYPE"));
});

test("ستون دارای پیش‌فرض در درج اجباری نیست", () => {
  const { PhysicalPct, IsCritical, ...rest } = validActivity;
  assert.deepEqual(validateRow(Activity, rest, "insert"), []);
});

/* ══════════════ ۶. نگاشت نوع ذخیره‌سازی ══════════════ */

test("بولی به بیت و برعکس", () => {
  const col = { name: "IsCritical", kind: "bool" };
  assert.equal(toStorage(col, true), 1);
  assert.equal(toStorage(col, false), 0);
  assert.equal(fromStorage(col, 1), true);
  assert.equal(fromStorage(col, 0), false);
});

test("JSON در ذخیره رشته و در خواندن شیء می‌شود", () => {
  const col = { name: "Steps", kind: "json" };
  assert.equal(toStorage(col, { a: 1 }), '{"a":1}');
  assert.deepEqual(fromStorage(col, '{"a":1}'), { a: 1 });
  assert.equal(fromStorage(col, "not json"), "not json");
});

test("مقدار تهی در هر دو جهت تهی می‌ماند", () => {
  const col = { name: "X", kind: "text" };
  assert.equal(toStorage(col, undefined), null);
  assert.equal(fromStorage(col, null), null);
});

test("mapToStorage و mapFromStorage رفت‌وبرگشت را حفظ می‌کنند", () => {
  const row = { ...validActivity, IsCritical: true };
  const stored = mapToStorage(Activity, row);
  assert.equal(stored.IsCritical, 1);
  const back = mapFromStorage(Activity, stored);
  assert.equal(back.IsCritical, true);
  assert.equal(back.NameFa, row.NameFa);
});

test("mapToStorage ستون ناشناخته را دور می‌ریزد", () => {
  assert.equal("Bogus" in mapToStorage(Activity, { ...validActivity, Bogus: 1 }), false);
});

/* ══════════════ ۷. سازنده پرس‌وجو ══════════════ */

test("buildInsert پارامتری است و مقدار را داخل SQL نمی‌گذارد", () => {
  const q = buildInsert(Activity, validActivity, "mssql");
  assert.match(q.sql, /^INSERT INTO \[dbo\]\.\[Activity\] \(/);
  assert.ok(!q.sql.includes("بتن‌ریزی"), "مقدار داخل SQL جاسازی شده");
  assert.ok(q.params.includes("بتن‌ریزی فونداسیون"));
  assert.equal(q.params.length, Object.keys(validActivity).length);
  assert.match(q.sql, /@p0/);
});

test("buildInsert در SQLite از علامت سؤال استفاده می‌کند", () => {
  const q = buildInsert(Activity, validActivity, "sqlite");
  assert.ok(q.sql.includes("?"));
  assert.ok(!q.sql.includes("@p0"));
});

test("buildInsert مقدار بولی را به بیت تبدیل می‌کند", () => {
  const q = buildInsert(Activity, { ...validActivity, IsCritical: true }, "mssql");
  assert.ok(q.params.includes(1));
  assert.ok(!q.params.includes(true));
});

test("buildInsert روی ردیف تهی استثنا می‌دهد", () => {
  assert.throws(() => buildInsert(Activity, {}, "mssql"), /SQL_EMPTY_INSERT/);
});

test("تلاش برای تزریق از راه مقدار بی‌خطر است", () => {
  const q = buildInsert(Activity, { ...validActivity, NameFa: "x'); DROP TABLE Activity;--" }, "mssql");
  assert.ok(!q.sql.includes("DROP TABLE"));
  assert.ok(q.params.includes("x'); DROP TABLE Activity;--"));
});

test("buildUpdate شماره نسخه را افزایش و UpdatedAt را ست می‌کند", () => {
  const q = buildUpdate(Activity, { PhysicalPct: 40 }, [{ column: "Id", op: "eq", value: "act-1" }], "mssql", { updatedBy: "u-pm" });
  assert.match(q.sql, /\[RowVersion\] = \[RowVersion\] \+ 1/);
  assert.match(q.sql, /\[UpdatedAt\] = @p/);
  assert.match(q.sql, /\[UpdatedBy\] = @p/);
  assert.ok(q.params.includes("u-pm"));
});

test("buildUpdate با نسخه مورد انتظار شرط هم‌زمانی می‌گذارد", () => {
  const q = buildUpdate(Activity, { PhysicalPct: 40 }, [{ column: "Id", op: "eq", value: "act-1" }], "mssql", { expectedRowVersion: 3 });
  assert.match(q.sql, /\[RowVersion\] = @p\d+/);
  assert.ok(q.params.includes(3));
});

test("buildUpdate کلید اصلی و ستون‌های ایجاد را تغییر نمی‌دهد", () => {
  const q = buildUpdate(Activity, { Id: "hack", CreatedBy: "hack", PhysicalPct: 10 }, [{ column: "Id", op: "eq", value: "act-1" }], "mssql");
  // فقط بخش SET بررسی می‌شود؛ [Id] در WHERE طبیعتاً هست.
  const setPart = q.sql.slice(q.sql.indexOf(" SET "), q.sql.indexOf(" WHERE "));
  assert.ok(!setPart.includes("[Id]"), `کلید اصلی در SET آمد: ${setPart}`);
  assert.ok(!setPart.includes("[CreatedBy]"));
  assert.ok(setPart.includes("[PhysicalPct]"));
  assert.ok(!q.params.includes("hack"), "مقدار دستکاری‌شده به پارامترها راه یافت");
});

test("buildUpdate و buildDelete بدون WHERE استثنا می‌دهند", () => {
  assert.throws(() => buildUpdate(Activity, { PhysicalPct: 1 }, [], "mssql"), /SQL_UNSAFE_UPDATE_NO_WHERE/);
  assert.throws(() => buildDelete(Activity, [], "mssql"), /SQL_UNSAFE_DELETE_NO_WHERE/);
});

test("buildSelect ستون و ترتیب و صفحه‌بندی را می‌سازد", () => {
  const q = buildSelect(Activity, { columns: ["Id", "Code"], where: [{ column: "ProjectId", op: "eq", value: "prj-1" }], orderBy: [{ column: "Code", dir: "desc" }], limit: 20, offset: 40 }, "mssql");
  assert.match(q.sql, /SELECT \[Id\], \[Code\] FROM \[dbo\]\.\[Activity\]/);
  assert.match(q.sql, /WHERE \[ProjectId\] = @p0/);
  assert.match(q.sql, /ORDER BY \[Code\] DESC/);
  assert.match(q.sql, /OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY/);
  assert.deepEqual(q.params, ["prj-1"]);
});

test("buildSelect در SQL Server بدون ترتیب هم برای صفحه‌بندی ترتیب می‌گذارد", () => {
  const q = buildSelect(Activity, { limit: 10 }, "mssql");
  assert.match(q.sql, /ORDER BY \[Id\] ASC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY/);
});

test("buildSelect در SQLite از LIMIT/OFFSET استفاده می‌کند", () => {
  const q = buildSelect(Activity, { limit: 5, offset: 10 }, "sqlite");
  assert.match(q.sql, /LIMIT 5 OFFSET 10/);
});

test("ستون ناشناخته در select یا where استثنا می‌دهد", () => {
  assert.throws(() => buildSelect(Activity, { columns: ["Nope"] }, "mssql"), /SQL_UNKNOWN_COLUMN/);
  assert.throws(() => buildSelect(Activity, { where: [{ column: "Nope", op: "eq", value: 1 }] }, "mssql"), /SQL_UNKNOWN_COLUMN/);
  assert.throws(() => buildSelect(Activity, { orderBy: [{ column: "Nope" }] }, "mssql"), /SQL_UNKNOWN_COLUMN/);
});

test("عملگر IN با فهرست تهی به شرط همیشه‌غلط تبدیل می‌شود", () => {
  const q = buildSelect(Activity, { where: [{ column: "Id", op: "in", value: [] }] }, "mssql");
  assert.match(q.sql, /WHERE 1 = 0/);
  assert.deepEqual(q.params, []);
});

test("عملگر IN چند پارامتر می‌سازد", () => {
  const q = buildSelect(Activity, { where: [{ column: "Id", op: "in", value: ["a", "b", "c"] }] }, "mssql");
  assert.match(q.sql, /\[Id\] IN \(@p0, @p1, @p2\)/);
  assert.deepEqual(q.params, ["a", "b", "c"]);
});

test("عملگرهای تهی بدون پارامتر ساخته می‌شوند", () => {
  const q = buildSelect(Activity, { where: [{ column: "ActualFinish", op: "isnull" }, { column: "ActualStart", op: "notnull" }] }, "mssql");
  assert.match(q.sql, /\[ActualFinish\] IS NULL AND \[ActualStart\] IS NOT NULL/);
  assert.deepEqual(q.params, []);
});

test("buildCount شمارش پارامتری می‌سازد", () => {
  const q = buildCount(Activity, [{ column: "IsCritical", op: "eq", value: true }], "mssql");
  assert.match(q.sql, /SELECT COUNT\(\*\) AS \[Total\]/);
  assert.deepEqual(q.params, [true]);
});

/* ══════════════ ۸. ارزیابی شرط در حافظه ══════════════ */

const rows = [
  { Id: "a", Code: "A-100", Pct: 10, Done: false, Note: null },
  { Id: "b", Code: "A-200", Pct: 50, Done: true, Note: "ok" },
  { Id: "c", Code: "B-100", Pct: 90, Done: true, Note: null },
];

test("matchesWhere عملگرهای مقایسه‌ای", () => {
  assert.equal(matchesWhere(rows[1], [{ column: "Pct", op: "gte", value: 50 }]), true);
  assert.equal(matchesWhere(rows[0], [{ column: "Pct", op: "gt", value: 50 }]), false);
  assert.equal(matchesWhere(rows[1], [{ column: "Done", op: "ne", value: false }]), true);
});

test("matchesWhere عملگر LIKE با درصد", () => {
  assert.equal(matchesWhere(rows[0], [{ column: "Code", op: "like", value: "A-%" }]), true);
  assert.equal(matchesWhere(rows[2], [{ column: "Code", op: "like", value: "A-%" }]), false);
  assert.equal(matchesWhere(rows[0], [{ column: "Code", op: "like", value: "A-1_0" }]), true);
});

test("matchesWhere شرط‌های چندگانه با AND ترکیب می‌شوند", () => {
  assert.equal(matchesWhere(rows[1], [{ column: "Done", op: "eq", value: true }, { column: "Pct", op: "lt", value: 60 }]), true);
  assert.equal(matchesWhere(rows[2], [{ column: "Done", op: "eq", value: true }, { column: "Pct", op: "lt", value: 60 }]), false);
});

test("applySelect فیلتر و ترتیب و صفحه‌بندی را اعمال می‌کند", () => {
  const out = applySelect(rows, { where: [{ column: "Done", op: "eq", value: true }], orderBy: [{ column: "Pct", dir: "desc" }] });
  assert.deepEqual(out.map((r) => r.Id), ["c", "b"]);
  assert.deepEqual(applySelect(rows, { limit: 2 }).map((r) => r.Id), ["a", "b"]);
  assert.deepEqual(applySelect(rows, { limit: 2, offset: 2 }).map((r) => r.Id), ["c"]);
});

test("applySelect مقادیر تهی را در انتها می‌گذارد", () => {
  const out = applySelect(rows, { orderBy: [{ column: "Note", dir: "asc" }] });
  assert.equal(out[0].Note, "ok");
});

/* ══════════════ ۹. کمکی ══════════════ */

test("newId قطعی و یکتاست", () => {
  assert.equal(newId("act", 1000, () => 0.5), `act-${(1000).toString(36)}-${Math.floor(0.5 * 0x1000000).toString(36).padStart(5, "0")}`);
  assert.notEqual(newId("x"), newId("x"));
  assert.match(newId("progress"), /^progress-/);
});

test("withAudit ستون‌های ایجاد را پر می‌کند", () => {
  const r = withAudit({ Id: "a" }, "u-pm", "2026-09-08T00:00:00Z");
  assert.equal(r.CreatedBy, "u-pm");
  assert.equal(r.CreatedAt, "2026-09-08T00:00:00Z");
  assert.equal(r.RowVersion, 1);
});

test("concurrencyResult سه حالت را تفکیک می‌کند", () => {
  assert.deepEqual(concurrencyResult(1, true), { ok: true });
  assert.equal(concurrencyResult(0, false).code, "NOT_FOUND");
  assert.equal(concurrencyResult(0, true).code, "CONCURRENCY_CONFLICT");
});

/* ══════════════ ۱۰. ماندگاری واقعی روی درایور فایلی ══════════════ */

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arena-sql-"));
  return { repo: createRepository(new JsonFileDriver(dir)), dir };
}

test("درایور: درج و خواندن رفت‌وبرگشتی", async () => {
  const { repo } = tempRepo();
  const created = await repo.create("Activity", validActivity, "u-planner");
  assert.equal(created.Id, "act-1");
  const back = await repo.get("Activity", "act-1");
  assert.equal(back.NameFa, "بتن‌ریزی فونداسیون");
  assert.equal(back.IsCritical, false, "بولی باید بولی برگردد نه ۰");
  assert.equal(back.CreatedBy, "u-planner");
  assert.equal(back.RowVersion, 1);
});

test("درایور: داده روی دیسک می‌ماند و نمونهٔ تازه آن را می‌خواند", async () => {
  const { repo, dir } = tempRepo();
  await repo.create("Activity", validActivity, "u-planner");
  const fresh = createRepository(new JsonFileDriver(dir));
  const back = await fresh.get("Activity", "act-1");
  assert.ok(back, "داده پس از ساخت نمونهٔ جدید گم شد");
  assert.equal(back.Code, "A-1000");
});

test("درایور: کلید تکراری رد می‌شود", async () => {
  const { repo } = tempRepo();
  await repo.create("Activity", validActivity);
  await assert.rejects(() => repo.create("Activity", validActivity), /DUPLICATE_KEY/);
});

test("درایور: نقض ایندکس یکتا رد می‌شود", async () => {
  const { repo } = tempRepo();
  await repo.create("Activity", validActivity);
  await assert.rejects(() => repo.create("Activity", { ...validActivity, Id: "act-2" }), /UNIQUE_VIOLATION/);
});

test("درایور: ردیف نامعتبر پیش از نوشتن رد می‌شود", async () => {
  const { repo } = tempRepo();
  await assert.rejects(() => repo.create("Activity", { ...validActivity, PlannedStart: "بد" }), ValidationError);
  assert.equal(await repo.count("Activity"), 0, "ردیف نامعتبر نوشته شد");
});

test("درایور: به‌روزرسانی نسخه را بالا می‌برد", async () => {
  const { repo } = tempRepo();
  await repo.create("Activity", validActivity);
  const res = await repo.patch("Activity", "act-1", { PhysicalPct: 45 }, "u-pm");
  assert.equal(res.ok, true);
  assert.equal(res.affected, 1);
  const back = await repo.get("Activity", "act-1");
  assert.equal(back.PhysicalPct, 45);
  assert.equal(back.RowVersion, 2);
  assert.equal(back.UpdatedBy, "u-pm");
});

test("درایور: تعارض هم‌زمانی گرفته می‌شود", async () => {
  const { repo } = tempRepo();
  await repo.create("Activity", validActivity);
  await repo.patch("Activity", "act-1", { PhysicalPct: 20 }, "u-a");
  const stale = await repo.patch("Activity", "act-1", { PhysicalPct: 30 }, "u-b", 1);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "CONCURRENCY_CONFLICT");
  assert.equal((await repo.get("Activity", "act-1")).PhysicalPct, 20, "نوشتن بیات اعمال شد");
});

test("درایور: به‌روزرسانی رکورد ناموجود NOT_FOUND می‌دهد", async () => {
  const { repo } = tempRepo();
  assert.equal((await repo.patch("Activity", "nope", { PhysicalPct: 1 })).code, "NOT_FOUND");
});

test("درایور: حذف و شمارش", async () => {
  const { repo } = tempRepo();
  await repo.create("Activity", validActivity);
  await repo.create("Activity", { ...validActivity, Id: "act-2", Code: "A-2000" });
  assert.equal(await repo.count("Activity"), 2);
  assert.equal((await repo.remove("Activity", "act-1")).affected, 1);
  assert.equal(await repo.count("Activity"), 1);
  assert.equal(await repo.get("Activity", "act-1"), null);
});

test("درایور: list با فیلتر و ترتیب", async () => {
  const { repo } = tempRepo();
  for (const [i, pct] of [10, 90, 50].entries()) {
    await repo.create("Activity", { ...validActivity, Id: `act-${i}`, Code: `A-${i}`, PhysicalPct: pct });
  }
  const out = await repo.list("Activity", { where: [{ column: "PhysicalPct", op: "gte", value: 50 }], orderBy: [{ column: "PhysicalPct", dir: "desc" }] });
  assert.deepEqual(out.map((r) => r.PhysicalPct), [90, 50]);
});

test("درایور: upsert بار اول درج و بار دوم به‌روزرسانی می‌کند", async () => {
  const { repo } = tempRepo();
  const a = await repo.upsert("Activity", { ProjectId: "prj-1", Code: "A-1" }, { NameFa: "اول", PlannedStart: "2026-09-01", PlannedFinish: "2026-09-05" });
  assert.equal(a.action, "insert");
  const b = await repo.upsert("Activity", { ProjectId: "prj-1", Code: "A-1" }, { NameFa: "دوم" });
  assert.equal(b.action, "update");
  assert.equal(b.row.NameFa, "دوم");
  assert.equal(await repo.count("Activity"), 1);
});

test("درایور: pickWritable ستون‌های حسابرسی و ناشناخته را حذف می‌کند", () => {
  const { repo } = tempRepo();
  const clean = repo.pickWritable("Activity", { Code: "A-1", RowVersion: 99, CreatedBy: "hack", Bogus: 1 });
  assert.deepEqual(clean, { Code: "A-1" });
  assert.ok(!repo.writableColumns("Activity").includes("RowVersion"));
});

/* ══════════════ ۱۱. سناریوی PEX-G2 ══════════════ */

test("PEX-G2: ثبت پیشرفت واقعاً ذخیره و بازخوانی می‌شود", async () => {
  const { repo, dir } = tempRepo();
  await repo.create("ProgressEntry", {
    ProjectId: "prj-1",
    ActivityId: "act-1",
    PeriodCode: "1405-06",
    EntryDate: "2026-09-08",
    PhysicalPct: 35.5,
    Steps: [{ code: "s1", done: true }],
    BlockedSteps: [],
    AcceptedIntoEv: true,
    EnteredBy: "u-site",
  }, "u-site", "progress");

  const fresh = createRepository(new JsonFileDriver(dir));
  const saved = await fresh.list("ProgressEntry", { where: [{ column: "ActivityId", op: "eq", value: "act-1" }] });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].PhysicalPct, 35.5);
  assert.deepEqual(saved[0].Steps, [{ code: "s1", done: true }], "JSON باید شیء برگردد");
  assert.equal(saved[0].AcceptedIntoEv, true);
  assert.match(saved[0].Id, /^progress-/);
});

test("PEX-G2: چند ثبت برای یک فعالیت به ترتیب تاریخ خوانده می‌شود", async () => {
  const { repo } = tempRepo();
  for (const d of ["2026-09-06", "2026-09-08", "2026-09-07"]) {
    await repo.create("ProgressEntry", { ProjectId: "prj-1", ActivityId: "act-1", PeriodCode: "1405-06", EntryDate: d, PhysicalPct: 10, EnteredBy: "u-site" }, "u-site", "progress");
  }
  const out = await repo.list("ProgressEntry", { orderBy: [{ column: "EntryDate", dir: "asc" }] });
  assert.deepEqual(out.map((r) => r.EntryDate), ["2026-09-06", "2026-09-07", "2026-09-08"]);
});

test("PEX-G2: ثبت پیشرفت بدون ثبت‌کننده رد می‌شود", async () => {
  const { repo } = tempRepo();
  await assert.rejects(
    () => repo.create("ProgressEntry", { ProjectId: "prj-1", ActivityId: "act-1", PeriodCode: "1405-06", EntryDate: "2026-09-08", PhysicalPct: 10 }, "sys", "progress"),
    /EnteredBy/
  );
});

test("جدول ProgressEntry ایندکس‌های لازم برای پرس‌وجوی رایج را دارد", () => {
  const names = (ProgressEntry.indexes ?? []).flatMap((i) => i.columns);
  assert.ok(names.includes("ActivityId"));
  assert.ok(names.includes("PeriodCode"));
});
