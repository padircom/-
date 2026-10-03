import test from "node:test";
import assert from "node:assert/strict";
import {
  allColumns,
  generateDdl,
  MIGRATIONS,
  tableDef,
  tablesOfModule,
  validateSchema,
} from "./sqlLogic.js";

const MFG_NAMES = [
  "MfgPart", "MfgBomHeader", "MfgBomItem", "MfgWorkCenter", "MfgWorkCenterResource",
  "MfgWorkCenterCalendar", "MfgRouting", "MfgRoutingOperation", "MfgProductionOrder",
  "MfgProductionOrderOperation", "MfgOperationSchedule", "MfgCapacityPlan",
  "MfgOperationExecution", "MfgDowntimeLog", "MfgScrapRecord", "MfgReworkRecord",
  "MfgMaterial", "MfgMaterialRequirement", "MfgMaterialConsumption", "MfgInventoryLevel",
  "MfgCostCenter", "MfgOperationCost", "MfgOrderCost", "MfgProductionAlert", "MfgDispatchingRule", "MfgScheduleRun",
];
const MFG_V1_NAMES = MFG_NAMES.filter((name) => name !== "MfgScheduleRun");

test("اسکیمای تولید شامل ۲۶ جدول مستقل است", () => {
  const tables = tablesOfModule("mfg");
  assert.equal(tables.length, 26);
  assert.deepEqual(new Set(tables.map((table) => table.name)), new Set(MFG_NAMES));
  assert.deepEqual(validateSchema(), []);
});

test("همهٔ جداول تولید ستون‌های Audit و RowVersion مشترک دارند", () => {
  for (const table of tablesOfModule("mfg")) {
    const names = new Set(allColumns(table).map((column) => column.name));
    for (const name of ["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy", "RowVersion"]) {
      assert.ok(names.has(name), `${table.name} فاقد ${name} است`);
    }
  }
});

test("دامنهٔ تولید کارخانه‌محور است و وابستگی اجباری به Project ندارد", () => {
  const order = tableDef("MfgProductionOrder");
  assert.equal(order.columns.find((column) => column.name === "PlantId").nullable, false);
  assert.equal(order.columns.find((column) => column.name === "ProjectId").nullable, true);
  assert.ok(order.foreignKeys.some((foreignKey) => foreignKey.refTable === "ContractMaster"));
  assert.ok(order.foreignKeys.some((foreignKey) => foreignKey.refTable === "Project"));
});

test("مهاجرت 0046 همهٔ جدول‌ها، ایندکس‌ها، کلیدهای خارجی و CHECKها را می‌سازد", () => {
  const migration = MIGRATIONS.find((item) => item.version === "0046");
  assert.ok(migration);
  for (const name of MFG_V1_NAMES) assert.ok(migration.statements.some((sql) => sql.includes(`[dbo].[${name}]`)), name);
  assert.ok(!migration.statements.some((sql) => sql.includes("[dbo].[MfgScheduleRun]")));
  assert.ok(!migration.statements.some((sql) => sql.includes("DispatchWeight")));
  assert.ok(!migration.statements.some((sql) => sql.includes("BreakStartMinuteOfDay")));
  assert.ok(migration.statements.some((sql) => sql.includes("CHECK (")));
  assert.ok(migration.statements.some((sql) => sql.includes("FOREIGN KEY")));
  assert.ok(migration.statements.some((sql) => sql.includes("CREATE UNIQUE INDEX")));
});

test("مهاجرت 0047 نسخهٔ برنامه، وزن سفارش و زمان شروع استراحت را افزایشی می‌سازد", () => {
  const migration = MIGRATIONS.find((item) => item.version === "0047");
  assert.ok(migration);
  assert.ok(migration.statements.some((sql) => sql.includes("MfgScheduleRun")));
  assert.ok(migration.statements.some((sql) => sql.includes("DispatchWeight")));
  assert.ok(migration.statements.some((sql) => sql.includes("BreakStartMinuteOfDay")));
  assert.ok(migration.statements.some((sql) => sql.includes("CK_MfgProdOrder_DispatchWeight")));
});

test("DDL مستقل MFG شامل ظرفیت، تقویم، هزینه و قیدهای اجراست", () => {
  const ddl = generateDdl("mssql", tablesOfModule("mfg"));
  assert.match(ddl, /CREATE TABLE \[dbo\]\.\[MfgOperationSchedule\]/);
  assert.match(ddl, /CHECK \(PlannedEndAt > PlannedStartAt\)/);
  assert.match(ddl, /MfgWorkCenterCalendar/);
  assert.match(ddl, /MfgOperationCost/);
  assert.match(ddl, /\[RowVersion\] INT NOT NULL/);
});

test("مهاجرت 0048 ستون ClosedBy را افزایشی اضافه می‌کند و 0046 یخ‌زده می‌ماند", () => {
  const migration = MIGRATIONS.find((item) => item.version === "0048");
  assert.ok(migration);
  assert.ok(migration.statements.some((sql) => sql.includes("MfgProductionOrder") && sql.includes("ClosedBy")));
  const frozen = MIGRATIONS.find((item) => item.version === "0046");
  assert.ok(!frozen.statements.some((sql) => sql.includes("ClosedBy")));
  const order = tableDef("MfgProductionOrder");
  assert.ok(order.columns.some((column) => column.name === "ClosedBy"));
});
