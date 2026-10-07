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
/* فاز ۵ — MPS، اندازه‌گذاری لات، ATP و تقسیم لات */
const MFG_PHASE5_NAMES = [
  "MfgLotSizingPolicy", "MfgMasterScheduleRun", "MfgDemandForecast",
  "MfgMasterScheduleLine", "MfgAtpCheck", "MfgOperationSplitLot",
];
/* فاز ۵ بخش ۱۱ — سفارش برنامه‌ریزی‌شده، نسخهٔ تولید و Pegging پایدار */
const MFG_PHASE5B_NAMES = ["MfgProductionVersion", "MfgPlannedOrder", "MfgRequirementPegging"];
const MFG_ALL_NAMES = [...MFG_NAMES, ...MFG_PHASE5_NAMES, ...MFG_PHASE5B_NAMES];
const MFG_V1_NAMES = MFG_NAMES.filter((name) => name !== "MfgScheduleRun");

test("اسکیمای تولید شامل ۳۵ جدول مستقل است", () => {
  const tables = tablesOfModule("mfg");
  assert.equal(tables.length, 35);
  assert.deepEqual(new Set(tables.map((table) => table.name)), new Set(MFG_ALL_NAMES));
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
  for (const table of tablesOfModule("mfg")) {
    for (const foreignKey of table.foreignKeys ?? []) {
      assert.ok(
        foreignKey.refTable.startsWith("Mfg"),
        `${table.name}.${foreignKey.column} نباید به جدول بیرونی ${foreignKey.refTable} وابسته باشد`,
      );
    }
  }
});

test("مهاجرت 0046 همهٔ جدول‌ها، ایندکس‌ها، کلیدهای خارجی و CHECKها را می‌سازد", () => {
  const migration = MIGRATIONS.find((item) => item.version === "0046");
  assert.ok(migration);
  for (const name of MFG_V1_NAMES) assert.ok(migration.statements.some((sql) => sql.includes(`[dbo].[${name}]`)), name);
  assert.ok(!migration.statements.some((sql) => sql.includes("[dbo].[MfgScheduleRun]")));
  for (const name of MFG_PHASE5_NAMES) assert.ok(!migration.statements.some((sql) => sql.includes(`[dbo].[${name}]`)), `${name} نباید در 0046 باشد`);
  assert.ok(!migration.statements.some((sql) => sql.includes("SplitLotCount")));
  assert.ok(!migration.statements.some((sql) => sql.includes("OverlapPct")));
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

test("مهاجرت 0050 هزینهٔ planned/scrap را افزایشی اضافه می‌کند و 0046 یخ‌زده می‌ماند", () => {
  const migration = MIGRATIONS.find((item) => item.version === "0050");
  assert.ok(migration);
  assert.equal(migration.name, "manufacturing_cost_rollup_planned_scrap");
  const operationColumns = ["PlannedQuantity", "PlannedRate", "PlannedAmount"];
  const orderColumns = [
    "PlannedMaterialCost", "PlannedMachineCost", "PlannedLaborCost", "PlannedOverheadCost",
    "StandardScrapCost", "PlannedScrapCost", "ActualScrapCost", "PlannedTotalCost", "ReconcileThrough",
  ];
  for (const column of operationColumns) {
    assert.ok(migration.statements.some((sql) => sql.includes("dbo.MfgOperationCost") && sql.includes(column) && sql.includes("IS NULL")));
    assert.equal(tableDef("MfgOperationCost").columns.find((item) => item.name === column)?.nullable, true);
  }
  for (const column of orderColumns) {
    assert.ok(migration.statements.some((sql) => sql.includes("dbo.MfgOrderCost") && sql.includes(column) && sql.includes("IS NULL")));
    assert.equal(tableDef("MfgOrderCost").columns.find((item) => item.name === column)?.nullable, true);
  }
  assert.ok(migration.statements.some((sql) => sql.includes("CostElement IN ('material','machine','labor','overhead','scrap')")));
  assert.ok(migration.statements.some((sql) => sql.includes("CK_MfgOperationCost_PlannedAmounts")));
  assert.ok(migration.statements.some((sql) => sql.includes("CK_MfgOrderCost_Phase4Amounts")));

  const frozen = MIGRATIONS.find((item) => item.version === "0046");
  assert.ok(frozen);
  const frozenOperationDdl = frozen.statements.find((sql) => sql.includes("CREATE TABLE [dbo].[MfgOperationCost]")) ?? "";
  const frozenOrderDdl = frozen.statements.find((sql) => sql.includes("CREATE TABLE [dbo].[MfgOrderCost]")) ?? "";
  for (const column of operationColumns) assert.ok(!frozenOperationDdl.includes(column), `${column} leaked into frozen MfgOperationCost DDL`);
  for (const column of orderColumns) assert.ok(!frozenOrderDdl.includes(column), `${column} leaked into frozen MfgOrderCost DDL`);
  assert.ok(!frozenOperationDdl.includes("CostElement IN ('material','machine','labor','overhead','scrap')"));
});

test("مهاجرت 0051 جدول‌های فاز ۵ و ستون‌های تقسیم/هم‌پوشانی را افزایشی می‌سازد", () => {
  const migration = MIGRATIONS.find((item) => item.version === "0051");
  assert.ok(migration);
  assert.equal(migration.name, "manufacturing_mps_lotsizing_atp_overlap");
  for (const name of MFG_PHASE5_NAMES) {
    assert.ok(migration.statements.some((sql) => sql.includes(`[dbo].[${name}]`)), `${name} در 0051 ساخته نشده`);
    assert.ok(tableDef(name), `${name} در اسکیما نیست`);
  }
  for (const tableName of ["MfgRoutingOperation", "MfgProductionOrderOperation"]) {
    for (const column of ["SplitLotCount", "OverlapPct"]) {
      assert.ok(
        migration.statements.some((sql) => sql.includes(`dbo.${tableName}`) && sql.includes(column) && sql.includes("IS NULL")),
        `${tableName}.${column} افزایشی اضافه نشده`,
      );
      assert.equal(tableDef(tableName).columns.find((item) => item.name === column)?.nullable, true);
    }
  }
  assert.ok(migration.statements.some((sql) => sql.includes("CK_MfgOrderOp_Split")));
  assert.ok(migration.statements.some((sql) => sql.includes("CK_MfgRoutingOp_Split")));
  /* قید هم‌پوشانی بازنویسی می‌شود تا OverlapPct هم پذیرفته شود. */
  assert.ok(migration.statements.some((sql) => sql.includes("DROP CONSTRAINT CK_MfgOrderOp_Overlap")));
  assert.ok(migration.statements.some((sql) => sql.includes("OverlapPct IS NOT NULL AND OverlapPct > 0 AND OverlapPct < 100")));

  const frozen = MIGRATIONS.find((item) => item.version === "0046");
  const frozenOrderOpDdl = frozen.statements.find((sql) => sql.includes("CREATE TABLE [dbo].[MfgProductionOrderOperation]")) ?? "";
  const frozenRoutingOpDdl = frozen.statements.find((sql) => sql.includes("CREATE TABLE [dbo].[MfgRoutingOperation]")) ?? "";
  for (const ddl of [frozenOrderOpDdl, frozenRoutingOpDdl]) {
    assert.ok(ddl.length > 0);
    assert.ok(!ddl.includes("SplitLotCount"), "SplitLotCount به 0046 نشسته");
    assert.ok(!ddl.includes("OverlapPct"), "OverlapPct به 0046 نشسته");
  }
});

test("DDL فاز ۵ قیدهای دامنه‌ای MPS، لات و ATP را دارد", () => {
  const ddl = generateDdl("mssql", tablesOfModule("mfg"));
  assert.match(ddl, /CREATE TABLE \[dbo\]\.\[MfgMasterScheduleLine\]/);
  assert.match(ddl, /CREATE TABLE \[dbo\]\.\[MfgAtpCheck\]/);
  assert.match(ddl, /LotSizingRule IN \('L4L','FOQ','EOQ','POQ'\)/);
  assert.match(ddl, /DemandType IN \('sales-order','forecast','contract','manual'\)/);
  assert.match(ddl, /Result IN \('available','delayed','unavailable'\)/);
  assert.match(ddl, /Mode IN \('discrete','cumulative'\)/);
  assert.match(ddl, /UX_MfgMpsLine_Bucket/);
  assert.match(ddl, /UX_MfgSplitLot_No/);
});
