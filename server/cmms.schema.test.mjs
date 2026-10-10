/**
 * آزمون اسکیمای CMMS — بخش ۳ سازمان.
 *
 * سه چیز را قفل می‌کند که اگر بشکنند، معماری ماژول از دست می‌رود:
 *   ۱) استقلال منطقی: هیچ کلید خارجی از جدول Cmms* به جدول بیرونی.
 *   ۲) افزودنی بودن: مهاجرت ۰۰۵۷ فقط می‌سازد، چیزی را تغییر نمی‌دهد.
 *   ۳) پوشش ساختار ۱۳گانهٔ خانوادهٔ تجهیز (الگوی PMworks).
 */
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

/* ساختار ۱۳گانهٔ مدیریت و مهندسی خانوادهٔ تجهیز — الگوی PMworks.
 * آزمون زیر تضمین می‌کند هیچ‌کدام از این سیزده بخش در اسکیمای CMMS جا نیفتد. */
const PMWORKS_TABLES = {
  "۱-گروه خانواده": "CmmsFamilyGroup",
  "۲-الگوی خانواده": "CmmsFamily",
  "۳-درخت خانواده": "CmmsFamilyNode",
  "۴-پروفایل جامع": "CmmsFamilyProfile",
  "۵-پارامتر کارکردی": "CmmsFamilyOperatingParam",
  "۶-پارامتر CM": "CmmsFamilyConditionParam",
  "۷-حالت خرابی": "CmmsFamilyFailureMode",
  "۸-آرشیو خانواده": "CmmsFamilyDocument",
  "۹-فعالیت PM": "CmmsFamilyPmTask",
  "۱۰-تجهیزات منتسب": "CmmsAssetFamilyAssignment",
  "۱۱-آرشیو تجهیز": "CmmsAssetDocument",
  "۱۲-فیلد پویا": "CmmsFamilyCustomField",
  "۱۳-تغییر همگانی": "CmmsFamilyBulkChange",
};

const EXPECTED_NAMES = [
  /* الف) سایت و مکان */
  "CmmsSite", "CmmsLocation",
  /* ب) خانوادهٔ تجهیز */
  "CmmsFamilyGroup", "CmmsFamily", "CmmsFamilyNode", "CmmsFamilyProfile",
  "CmmsFamilyOperatingParam", "CmmsFamilyConditionParam", "CmmsFamilyFailureMode",
  "CmmsFamilyDocument", "CmmsFamilyPmTask", "CmmsPmChecklistItem",
  "CmmsFamilyCustomField", "CmmsFamilyBulkChange",
  /* ج) منابع */
  "CmmsVendor", "CmmsAsset", "CmmsAssetFamilyAssignment", "CmmsAssetDocument",
  "CmmsAssetCustomValue", "CmmsAssetBarcode", "CmmsAssetLifecycleEvent",
  "CmmsMeterDefinition", "CmmsMeterReading", "CmmsTechnician", "CmmsTechnicianSkill",
  "CmmsCrew", "CmmsShiftCalendar", "CmmsTool", "CmmsSparePart", "CmmsAssetSpareLink",
  "CmmsSpareTransaction",
  /* د) گردش‌کار */
  "CmmsWorkflowDefinition", "CmmsWorkflowStep", "CmmsWorkflowTransition",
  "CmmsWorkflowInstance", "CmmsWorkflowEvent",
  /* ه) برنامه‌ریزی */
  "CmmsPmStrategy", "CmmsPmSchedule",
  /* و) درخواست‌کار و دستورکار */
  "CmmsWorkRequest", "CmmsWorkOrder", "CmmsWorkOrderTask", "CmmsWorkOrderLabor",
  "CmmsWorkOrderMaterial", "CmmsWorkOrderCost",
  /* ز) خرابی و پایش وضعیت */
  "CmmsFailureRecord", "CmmsDowntimeRecord", "CmmsConditionThreshold", "CmmsConditionReading",
  /* ح) تحلیل */
  "CmmsFmeaRecord", "CmmsFmeaEntry", "CmmsRcmAnalysis", "CmmsRcmEntry",
  "CmmsMaintenancePlan", "CmmsRcaCase", "CmmsRcaEntry",
  /* ط) شاخص، هزینه، هشدار */
  "CmmsReliabilitySnapshot", "CmmsOeeSnapshot", "CmmsSupplyReliability", "CmmsLccRecord",
  "CmmsCostRecord", "CmmsKpiTarget", "CmmsKpiResult", "CmmsAlert",
  /* ی) هوش مصنوعی */
  "CmmsAiRun", "CmmsAiRecommendation",
];

test("اسکیمای CMMS شامل ۶۵ جدول مستقل است", () => {
  const tables = tablesOfModule("cmms");
  assert.equal(tables.length, 65);
  assert.deepEqual(new Set(tables.map((table) => table.name)), new Set(EXPECTED_NAMES));
  /* اسکیمای کل سامانه بدون ایراد ساختاری می‌ماند — این یعنی الحاق CMMS
   * چیزی در بقیهٔ ماژول‌ها را نشکسته است. */
  assert.deepEqual(validateSchema(), []);
});

test("همهٔ جداول CMMS با پیشوند Cmms و در ماژول cmms هستند", () => {
  for (const table of tablesOfModule("cmms")) {
    assert.ok(table.name.startsWith("Cmms"), `${table.name} پیشوند Cmms ندارد`);
    assert.equal(table.module, "cmms");
    assert.ok(table.title.fa && table.title.en, `${table.name} عنوان دوزبانهٔ ناقص دارد`);
  }
});

test("استقلال منطقی: هیچ کلید خارجی از CMMS به جدول بیرونی وجود ندارد", () => {
  for (const table of tablesOfModule("cmms")) {
    for (const foreignKey of table.foreignKeys ?? []) {
      assert.ok(
        foreignKey.refTable.startsWith("Cmms"),
        `${table.name}.${foreignKey.column} نباید به جدول بیرونی ${foreignKey.refTable} وابسته باشد`,
      );
    }
  }
});

test("ارجاع نرم بین‌بخشی بدون کلید خارجی است (Mfg/Scm/Cost/User)", () => {
  /* این چهار ستون عمداً متنی آزادند. اگر کسی روزی روی آن‌ها FK بگذارد،
   * استقلال CMMS می‌شکند و این آزمون باید جلوی آن را بگیرد. */
  const asset = tableDef("CmmsAsset");
  for (const column of ["MfgWorkCenterId", "ScmWarehouseId"]) {
    const def = asset.columns.find((item) => item.name === column);
    assert.ok(def, `${column} در CmmsAsset نیست`);
    assert.equal(def.kind, "text");
    assert.ok(!asset.foreignKeys.some((fk) => fk.column === column), `${column} نباید FK داشته باشد`);
  }
  const technician = tableDef("CmmsTechnician");
  assert.ok(technician.columns.some((item) => item.name === "UserId"));
  assert.ok(!technician.foreignKeys.some((fk) => fk.column === "UserId"));
  const cost = tableDef("CmmsWorkOrderCost");
  assert.ok(cost.columns.some((item) => item.name === "CostCenterRef"));
  assert.ok(!cost.foreignKeys.some((fk) => fk.column === "CostCenterRef"));
});

test("همهٔ جداول CMMS ستون‌های Audit و RowVersion مشترک دارند", () => {
  for (const table of tablesOfModule("cmms")) {
    const names = new Set(allColumns(table).map((column) => column.name));
    for (const name of ["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy", "RowVersion"]) {
      assert.ok(names.has(name), `${table.name} فاقد ${name} است`);
    }
  }
});

test("دامنهٔ CMMS سایت‌محور است و وابستگی اجباری به Project ندارد", () => {
  for (const table of tablesOfModule("cmms")) {
    const siteId = table.columns.find((column) => column.name === "SiteId");
    assert.ok(siteId, `${table.name} فاقد SiteId است`);
    assert.equal(siteId.nullable, false, `${table.name}.SiteId باید NOT NULL باشد`);
    assert.ok(!table.columns.some((column) => column.name === "ProjectId"), `${table.name} نباید ProjectId داشته باشد`);
  }
});

test("ساختار ۱۳گانهٔ خانوادهٔ تجهیز (PMworks) کامل پوشش داده شده است", () => {
  for (const [part, tableName] of Object.entries(PMWORKS_TABLES)) {
    assert.ok(tableDef(tableName), `بخش ${part} از ساختار PMworks جدول ${tableName} را ندارد`);
  }
  assert.equal(Object.keys(PMWORKS_TABLES).length, 13);
});

test("حالات خرابی خانواده به فهرست بستهٔ ISO 14224 محدود است", () => {
  const table = tableDef("CmmsFamilyFailureMode");
  const check = table.checks.find((item) => item.name === "CK_CmmsFamilyFailureMode_Mode");
  assert.ok(check, "CHECK حالت خرابی ISO 14224 وجود ندارد");
  for (const mode of [
    "fail-to-start", "fail-to-function", "fail-to-stop", "abnormal-start", "abnormal-shutdown",
    "erratic-output", "reduced-output", "excessive-output", "spurious-output", "leakage", "structural",
  ]) {
    assert.ok(check.expression.includes(`'${mode}'`), `حالت ${mode} در CHECK نیست`);
  }
  const mechanismCheck = table.checks.find((item) => item.name === "CK_CmmsFamilyFailureMode_Mechanism");
  assert.ok(mechanismCheck);
  for (const mechanism of ["wear", "corrosion", "fatigue", "lubrication", "misalignment"]) {
    assert.ok(mechanismCheck.expression.includes(`'${mechanism}'`), `مکانیزم ${mechanism} در CHECK نیست`);
  }
});

test("شاخص‌های IEEE 1366 در اسکیمای قابلیت اطمینان تأمین ستون دارند", () => {
  const table = tableDef("CmmsSupplyReliability");
  for (const column of ["SaidiMinutes", "SaifiCount", "CaidiMinutes", "AsaiPct", "MaifiCount"]) {
    assert.ok(table.columns.some((item) => item.name === column), `${column} در CmmsSupplyReliability نیست`);
  }
});

test("LCC تفکیک NPV پنج‌گانهٔ IEC 60300-3-3 را دارد", () => {
  const table = tableDef("CmmsLccRecord");
  for (const column of ["NpvAcquisition", "NpvOperation", "NpvMaintenance", "NpvDowntime", "NpvDisposal", "TotalNpv"]) {
    assert.ok(table.columns.some((item) => item.name === column), `${column} در CmmsLccRecord نیست`);
  }
});

test("KPI بر پایهٔ سه دستهٔ EN 15341 محدود شده است", () => {
  const check = tableDef("CmmsKpiTarget").checks.find((item) => item.name === "CK_CmmsKpiTarget_Category");
  assert.ok(check.expression.includes("'technical'"));
  assert.ok(check.expression.includes("'economic'"));
  assert.ok(check.expression.includes("'organizational'"));
});

test("پنج موتور AI در CHECK جدول CmmsAiRun نام‌برده شده‌اند", () => {
  const check = tableDef("CmmsAiRun").checks.find((item) => item.name === "CK_CmmsAiRun_Engine");
  for (const engine of ["failure-analysis", "pm-optimization", "repair-guidance", "tree-generator", "smart-scheduler"]) {
    assert.ok(check.expression.includes(`'${engine}'`), `موتور ${engine} در CHECK نیست`);
  }
});

test("هیچ CHECK وابسته به T-SQL در اسکیمای مشترک نیست", () => {
  /* اسکیمای این سامانه هم برای mssql و هم sqlite DDL می‌سازد. توابعی مثل
   * LEN فقط در T-SQL وجود دارند و CHECK حاوی آن‌ها روی sqlite می‌شکند. */
  for (const table of tablesOfModule("cmms")) {
    for (const check of table.checks ?? []) {
      assert.ok(!/\bLEN\s*\(/i.test(check.expression), `${table.name}.${check.name} از LEN استفاده می‌کند`);
      assert.ok(!/;/i.test(check.expression), `${table.name}.${check.name} نقطه‌ویرگول دارد`);
    }
  }
});

test("مهاجرت 0057 همهٔ جدول‌های CMMS را می‌سازد و افزودنی است", () => {
  const migration = MIGRATIONS.find((item) => item.version === "0057");
  assert.ok(migration, "مهاجرت 0057 وجود ندارد");
  assert.equal(migration.name, "cmms_asset_maintenance_foundation");
  for (const name of EXPECTED_NAMES) {
    assert.ok(
      migration.statements.some((sql) => sql.includes(`[dbo].[${name}]`)),
      `مهاجرت 0057 جدول ${name} را نمی‌سازد`,
    );
  }
  /* افزودنی بودن: مهاجرت نباید هیچ DROP یا ALTER روی جدول داشته باشد. */
  for (const sql of migration.statements) {
    assert.ok(!/^\s*DROP\b/i.test(sql), "مهاجرت 0057 نباید DROP داشته باشد");
    assert.ok(!/ALTER\s+TABLE/i.test(sql), "مهاجرت 0057 نباید ALTER TABLE داشته باشد");
  }
});

test("ترتیب مهاجرت 0057 وابستگی کلید خارجی را رعایت می‌کند", () => {
  /* چون کلید خارجی درون CREATE TABLE می‌آید، جدول والد باید پیش از فرزند
   * ساخته شود. این آزمون همان چیزی است که اگر بشکند، نصب تازهٔ پایگاه‌داده
   * با خطای «جدول مرجع وجود ندارد» شکست می‌خورد. */
  const migration = MIGRATIONS.find((item) => item.version === "0057");
  const createdOrder = [];
  for (const sql of migration.statements) {
    const match = sql.match(/CREATE TABLE \[dbo\]\.\[(\w+)\]/);
    if (match) createdOrder.push(match[1]);
  }
  assert.equal(createdOrder.length, EXPECTED_NAMES.length);
  for (const tableName of createdOrder) {
    const table = tableDef(tableName);
    const position = createdOrder.indexOf(tableName);
    for (const foreignKey of table.foreignKeys ?? []) {
      const parentPosition = createdOrder.indexOf(foreignKey.refTable);
      assert.ok(parentPosition !== -1, `${foreignKey.refTable} اصلاً ساخته نمی‌شود`);
      assert.ok(
        parentPosition <= position,
        `${tableName} پیش از والدش ${foreignKey.refTable} ساخته می‌شود`,
      );
    }
  }
});

test("مهاجرت‌های پیشین CMMS را دست نزده‌اند", () => {
  for (const migration of MIGRATIONS) {
    if (migration.version === "0057") continue;
    for (const sql of migration.statements) {
      assert.ok(
        !/\[dbo\]\.\[Cmms\w+\]/.test(sql),
        `مهاجرت ${migration.version} به جدول CMMS اشاره می‌کند — CMMS باید فقط در 0057 باشد`,
      );
    }
  }
});

test("DDL کل سامانه برای هر دو گویش بدون خطا تولید می‌شود", () => {
  /* mssql نام را [dbo].[CmmsAsset] و sqlite آن را "CmmsAsset" نقل می‌کند
   * (نگاه کنید به qualifiedName در persistence.ts) — پس انتظار هر گویش جداست. */
  const mssql = generateDdl("mssql");
  assert.ok(mssql.includes("[dbo].[CmmsAsset]"), "CmmsAsset در DDL mssql نیست");
  assert.ok(mssql.includes("[dbo].[CmmsAiRecommendation]"), "CmmsAiRecommendation در DDL mssql نیست");

  const sqlite = generateDdl("sqlite");
  assert.ok(sqlite.includes('CREATE TABLE IF NOT EXISTS "CmmsAsset" ('), 'CmmsAsset در DDL sqlite نیست');
  assert.ok(sqlite.includes('"CmmsAiRecommendation"'), "CmmsAiRecommendation در DDL sqlite نیست");
  /* sqlite نباید براکت T-SQL بگیرد. */
  assert.ok(!sqlite.includes("[dbo]."), "DDL sqlite براکت dbo دارد");
  assert.ok(mssql.length > 100_000, "DDL mssql غیرمنتظره کوتاه است");
});

test("ایندکس‌های یکتای CMMS روی ستون‌های nullable فیلتر شده‌اند", () => {
  /* ایندکس یکتا روی ستون nullable در SQL Server فقط یک NULL می‌پذیرد.
   * بدون فیلتر جزئی، ساخت ایندکس روی دادهٔ موجود شکست می‌خورد. */
  const migration = MIGRATIONS.find((item) => item.version === "0057");
  const filtered = migration.statements.filter((sql) => /^\s*CREATE UNIQUE INDEX/.test(sql) && sql.includes("IS NOT NULL"));
  assert.ok(filtered.length > 0, "هیچ ایندکس یکتای فیلترشده‌ای تولید نشده است");
});
