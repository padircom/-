/**
 * آزمون اسکیمای IIoT & DAS — بخش ۵ سازمان.
 *
 * چهار چیز را قفل می‌کند که اگر بشکنند، معماری ماژول از دست می‌رود:
 *   ۱) استقلال منطقی پایگاه‌داده: هیچ کلید خارجی از جدول `Iot*` به جدول
 *      بیرونی (جدول‌های Cmms، Mfg، Claim و IntegrationEvent).
 *   ۲) افزودنی بودن: مهاجرت ۰۰۵۹ فقط CREATE دارد، هیچ ALTER/DROP ندارد.
 *   ۳) ترتیب ساخت والد پیش از فرزند (کلید خارجی درون CREATE TABLE می‌آید).
 *   ۴) سه موجودیت هسته‌ای که پوستهٔ UI وعده داده بود، واقعاً ساخته شده‌اند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  allColumns,
  generateDdl,
  MIGRATIONS,
  SCHEMA,
  tableDef,
  tablesOfModule,
  validateSchema,
} from "./sqlLogic.js";

/* ۱۴ جدول بخش ۵ — بلوک مهاجرت ۰۰۵۹. ترتیب همین‌جا یخ‌زده است. */
const IIOT_NAMES = [
  /* الف) دکل و زیرساخت لبه */
  "IotDrillingRig", "IotEdgeGateway", "IotSensorNode",
  /* ب) جریان، کانال، بافر، نمونه و تجمیع */
  "IotDrillingRigStream", "IotDasChannel", "IotGatewayBuffer",
  "IotTelemetrySample", "IotTelemetryRollup",
  /* ج) فیلترینگ و آستانه */
  "IotSignalFilterRule", "IotThresholdRule",
  /* د) هشدار، توقف/NPT، صف خروجی و پایش وضعیت */
  "IotTelemetryAlert", "IotRigDowntime", "IotIntegrationEvent", "IotConditionSnapshot",
];

/* جدول‌هایی که یکپارچگی با آن‌ها فقط «نرم» است — یعنی باید ستون ارجاع متنی
 * داشته باشیم و نه کلید خارجی. */
const SOFT_REFS = {
  IotDrillingRig: ["CmmsSiteRef", "PmisProjectRef", "MesWorkCenterRef"],
  IotThresholdRule: ["CmmsSiteRef", "CmmsAssetRef", "MesWorkCenterRef", "MesPlantRef", "PmisProjectRef"],
  IotConditionSnapshot: ["CmmsAssetRef"],
  IotTelemetryAlert: ["CmmsWorkOrderRef", "MesDowntimeRef", "PmisEventRef"],
  IotRigDowntime: ["MesDowntimeRef", "PmisEventRef", "PmisClaimRef"],
};

test("اسکیمای کل سامانه بدون ایراد ساختاری است", () => {
  assert.deepEqual(validateSchema(), []);
});

test("بخش ۵: چهارده جدول با پیشوند Iot و module=iiot در اسکیما هستند", () => {
  const tables = tablesOfModule("iiot");
  assert.deepEqual(tables.map((t) => t.name), IIOT_NAMES);
  for (const t of tables) {
    assert.match(t.name, /^Iot[A-Z]/, `نام جدول باید با Iot شروع شود: ${t.name}`);
    assert.ok(t.title.fa && t.title.en, `${t.name} عنوان دوزبانه ندارد`);
  }
  assert.ok(SCHEMA.length >= 331, `اسکیما کوچک شده است: ${SCHEMA.length}`);
});

test("بخش ۵: سه موجودیت هسته‌ای وعده‌داده‌شده ساخته شده‌اند", () => {
  for (const name of ["IotDrillingRigStream", "IotDasChannel", "IotTelemetrySample"]) {
    assert.ok(tableDef(name), `جدول ${name} در اسکیما نیست`);
    assert.equal(tableDef(name).module, "iiot");
  }
});

test("بخش ۵: هیچ کلید خارجی از Iot* به جدول بیرونی وجود ندارد (استقلال منطقی)", () => {
  for (const t of tablesOfModule("iiot")) {
    for (const fk of t.foreignKeys ?? []) {
      assert.match(fk.refTable, /^Iot/, `${t.name}: کلید خارجی به جدول بیرونی ${fk.refTable}`);
      const target = tableDef(fk.refTable);
      assert.ok(target, `${t.name}: مرجع ${fk.refTable} در اسکیما نیست`);
      assert.equal(target.module, "iiot", `${t.name}: مرجع ${fk.refTable} از ماژول دیگری است`);
    }
  }
});

test("بخش ۵: ارجاع‌های بین‌بخشی ستون متنی‌اند، نه کلید خارجی", () => {
  for (const [tableName, columns] of Object.entries(SOFT_REFS)) {
    const t = tableDef(tableName);
    assert.ok(t, `جدول ${tableName} نیست`);
    for (const column of columns) {
      const def = allColumns(t).find((c) => c.name === column);
      assert.ok(def, `${tableName}.${column} در اسکیما نیست`);
      assert.equal(def.kind, "text", `${tableName}.${column} باید ستون متنی باشد`);
      assert.ok(
        !(t.foreignKeys ?? []).some((fk) => fk.column === column),
        `${tableName}.${column} نباید کلید خارجی داشته باشد`,
      );
    }
  }
});

test("بخش ۵: دامنهٔ همهٔ جدول‌های فرزند RigId است", () => {
  for (const t of tablesOfModule("iiot")) {
    if (t.name === "IotDrillingRig") continue;
    const def = allColumns(t).find((c) => c.name === "RigId");
    assert.ok(def, `${t.name} ستون RigId ندارد`);
    assert.equal(def.nullable, false, `${t.name}.RigId باید اجباری باشد`);
  }
  /* و در دکل، RigId کلید کسب‌وکاری یکتاست. */
  const rig = tableDef("IotDrillingRig");
  assert.ok((rig.indexes ?? []).some((i) => i.unique && i.columns.join() === "RigId"), "UX_IotDrillingRig_RigId نیست");
});

test("بخش ۵: ستون‌های حسابرسی دستی اعلام نشده‌اند", () => {
  const audit = ["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy", "RowVersion"];
  for (const t of tablesOfModule("iiot")) {
    for (const name of audit) {
      assert.ok(!t.columns.some((c) => c.name === name), `${t.name}: ستون حسابرسی ${name} دستی اعلام شده`);
    }
    assert.ok(allColumns(t).some((c) => c.name === "RowVersion"), `${t.name}: RowVersion خودکار افزوده نشده`);
  }
});

test("بخش ۵: قیدهای CHECK روی فهرست‌های بسته و سازگاری زمانی تعریف شده‌اند", () => {
  const checksOf = (name) => tableDef(name).checks ?? [];
  /* آستانهٔ چندسطحی: level و detectKind بسته‌اند و پایداری زمانی نامنفی. */
  const threshold = checksOf("IotThresholdRule");
  assert.ok(threshold.some((c) => c.name === "CK_IotThresholdRule_Level"));
  assert.ok(threshold.some((c) => c.name === "CK_IotThresholdRule_Kind"));
  assert.ok(threshold.some((c) => c.name === "CK_IotThresholdRule_Duration"));
  /* ارسال خودکار بدون مقصد، قید دارد — وگرنه رویداد بی‌مقصد در صف می‌ماند. */
  assert.ok(threshold.some((c) => c.name === "CK_IotThresholdRule_Targets"));
  /* NPT: IsNpt=1 فقط با نوع non-productive سازگار است. */
  assert.ok(checksOf("IotRigDowntime").some((c) => c.name === "CK_IotRigDowntime_Npt"));
  assert.ok(checksOf("IotRigDowntime").some((c) => c.name === "CK_IotRigDowntime_Window"));
  /* بافر لبه: پنجرهٔ زمانی و سقف تلاش. */
  assert.ok(checksOf("IotGatewayBuffer").some((c) => c.name === "CK_IotGatewayBuffer_Window"));
  assert.ok(checksOf("IotGatewayBuffer").some((c) => c.name === "CK_IotGatewayBuffer_Attempts"));
  /* هشدار: resolved بدون ResolvedAt ممکن نیست. */
  assert.ok(checksOf("IotTelemetryAlert").some((c) => c.name === "CK_IotAlert_Resolve"));
  /* صف خروجی: قرارداد و مقصد بسته‌اند. */
  assert.ok(checksOf("IotIntegrationEvent").some((c) => c.name === "CK_IotIntegrationEvent_Contract"));
  assert.ok(checksOf("IotIntegrationEvent").some((c) => c.name === "CK_IotIntegrationEvent_Target"));
});

test("بخش ۵: کلیدهای یکتا جلوی دادهٔ تکراری را می‌گیرند", () => {
  const uniqueOf = (name, columns) => (tableDef(name).indexes ?? []).some((i) => i.unique && i.columns.join() === columns.join());
  assert.ok(uniqueOf("IotDasChannel", ["RigId", "ChannelCode"]), "کد کانال باید در دکل یکتا باشد");
  assert.ok(uniqueOf("IotEdgeGateway", ["RigId", "GatewayCode"]), "کد گیت‌وی باید در دکل یکتا باشد");
  assert.ok(uniqueOf("IotGatewayBuffer", ["GatewayId", "BatchNo"]), "شمارهٔ دستهٔ بافر باید یکتا باشد (ضدتکرار همگام‌سازی)");
  assert.ok(uniqueOf("IotIntegrationEvent", ["IdempotencyKey"]), "کلید ضدتکرار رویداد باید یکتا باشد");
  assert.ok(uniqueOf("IotTelemetryRollup", ["ChannelId", "BucketSeconds", "BucketStart"]), "سطل تجمیع باید یکتا باشد");
  assert.ok(uniqueOf("IotRigDowntime", ["RigId", "DowntimeCode"]), "کد توقف باید در دکل یکتا باشد");
});

test("بخش ۵: مهاجرت ۰۰۵۹ وجود دارد و کاملاً افزودنی است", () => {
  const migration = MIGRATIONS.find((m) => m.version === "0059");
  assert.ok(migration, "مهاجرت ۰۰۵۹ در فهرست نیست");
  assert.equal(migration.name, "iiot_field_monitoring_das_telemetry");
  assert.ok(migration.statements.length >= IIOT_NAMES.length, "تعداد دستورات کمتر از تعداد جدول‌هاست");
  /* DDL با محافظ ایدمپوتنت `IF OBJECT_ID(...) IS NULL` تولید می‌شود؛ خودِ
   * محافظ افزودنی است و چیزی را تغییر نمی‌دهد. */
  for (const statement of migration.statements) {
    assert.match(
      statement,
      /^\s*(IF OBJECT_ID\([^\n]*\) IS NULL\s*\n)?CREATE (TABLE|(UNIQUE )?(NONCLUSTERED )?INDEX)/,
      `دستور غیرافزودنی: ${statement.slice(0, 80)}`,
    );
    /* رشته‌های داخل گیومه (مثل 'pump-drop') عبارت DDL نیستند؛ پیش از بررسی
     * حذف می‌شوند تا «drop» داخل یک مقدار CHECK، افزودنی‌بودن را رد نکند. */
    const withoutLiterals = statement.replace(/'[^']*'/g, "''");
    assert.doesNotMatch(withoutLiterals, /\b(ALTER|DROP)\b/i, "مهاجرت افزودنی نباید ALTER/DROP داشته باشد");
  }
  /* هر ۱۴ جدول در همین مهاجرت ساخته می‌شوند. */
  const created = migration.statements.filter((s) => s.includes("CREATE TABLE"));
  assert.equal(created.length, IIOT_NAMES.length);
  for (const name of IIOT_NAMES) {
    assert.ok(created.some((s) => s.includes(`[dbo].[${name}]`)), `${name} در مهاجرت ۰۰۵۹ ساخته نمی‌شود`);
  }
});

test("بخش ۵: در مهاجرت، جدول والد پیش از فرزند ساخته می‌شود", () => {
  const migration = MIGRATIONS.find((m) => m.version === "0059");
  const order = migration.statements
    .filter((s) => s.startsWith("CREATE TABLE"))
    .map((s) => s.match(/\[dbo\]\.\[(\w+)\]/)[1]);
  const position = new Map(order.map((name, index) => [name, index]));
  for (const name of order) {
    for (const fk of tableDef(name).foreignKeys ?? []) {
      assert.ok(position.has(fk.refTable), `${name}: مرجع ${fk.refTable} در همین مهاجرت نیست`);
      assert.ok(position.get(fk.refTable) < position.get(name), `${name} پیش از والدش ${fk.refTable} ساخته می‌شود`);
    }
  }
});

test("بخش ۵: DDL هر دو گویش بدون خطا تولید می‌شود", () => {
  const mssql = generateDdl("mssql");
  const sqlite = generateDdl("sqlite");
  assert.ok(mssql.includes("[IotTelemetrySample]"));
  assert.ok(sqlite.includes('"IotTelemetrySample"'));
  /* ستون پرفرکانس: زمان نمونه و مقدار، هر دو در DDL حاضرند. */
  assert.ok(mssql.includes("[SampledAt]"));
  assert.ok(mssql.includes("[FilteredValue]"));
});

test("بخش ۵: کانال سیگنال همهٔ کمیت‌های خواسته‌شده را پوشش می‌دهد", () => {
  const channel = tableDef("IotDasChannel");
  const check = (channel.checks ?? []).find((c) => c.name === "CK_IotDasChannel_Signal");
  assert.ok(check, "قید SignalType نیست");
  for (const signal of ["wob", "rpm", "torque", "mud-pump-pressure", "flow-rate", "temperature", "vibration"]) {
    assert.ok(check.expression.includes(`'${signal}'`), `کمیت ${signal} در SignalType پشتیبانی نمی‌شود`);
  }
  /* پنجرهٔ فیلتر روی خود کانال است — منبع واحد برای داشبورد و موتور تشخیص. */
  for (const column of ["FilterMethod", "FilterWindowSeconds", "DeadbandPct", "LastValue", "LastValueAt", "LastQuality"]) {
    assert.ok(allColumns(channel).some((c) => c.name === column), `ستون ${column} در IotDasChannel نیست`);
  }
});

test("بخش ۵: نمونهٔ تله‌متری، مقدار خام و فیلترشده را جدا نگه می‌دارد", () => {
  const sample = tableDef("IotTelemetrySample");
  for (const column of ["Value", "RawValue", "FilteredValue", "Quality", "Source", "SampledAt", "IngestedAt", "IsFlagged"]) {
    assert.ok(allColumns(sample).some((c) => c.name === column), `ستون ${column} در IotTelemetrySample نیست`);
  }
  /* ایندکس پرفرکانس: خواندن سری بر پایهٔ کانال و زمان. */
  assert.ok((sample.indexes ?? []).some((i) => i.columns.join() === "ChannelId,SampledAt"));
});

test("بخش ۵: صف خروجی، شاهد تحویل را نگه می‌دارد", () => {
  const event = tableDef("IotIntegrationEvent");
  for (const column of ["IdempotencyKey", "Contract", "Status", "Attempts", "MaxAttempts", "DeliveredAt", "ErrorCode", "ErrorFa", "AckRef"]) {
    assert.ok(allColumns(event).some((c) => c.name === column), `ستون ${column} در IotIntegrationEvent نیست`);
  }
});
