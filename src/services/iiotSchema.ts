/**
 * اسکیمای سامانهٔ پایش میدانی، اینترنت اشیاء صنعتی و تله‌متری حفاری
 * (IIoT & DAS / Drilling DAS) — بخش ۵ سازمان.
 *
 * سه تصمیم معماری که در سراسر این فایل رعایت شده‌اند:
 *
 * ۱) استقلال منطقی پایگاه‌داده: نام فیزیکی همهٔ جدول‌ها با `Iot` شروع می‌شود و
 *    `module: "iiot"` دارد. **هیچ** کلید خارجی به جدول بیرونی
 *    (`Cmms*` / `Mfg*` / `Claim` / `IntegrationEvent` / …) تعریف نمی‌شود؛
 *    پیوند بین‌بخشی با «ارجاع نرم» (ستون متنی آزاد مثل `CmmsAssetRef`،
 *    `MesWorkCenterRef`، `PmisProjectRef`) و صف رویداد `IotIntegrationEvent`
 *    انجام می‌شود. آزمون `iiot.schema.test.mjs` این قید را اجبار می‌کند.
 *
 * ۲) افزودنی بودن: این فایل هیچ جدول یا ستون موجودی را تغییر نمی‌دهد؛ فقط
 *    آرایهٔ تازه‌ای صادر می‌کند که در `SCHEMA` الحاق می‌شود و در مهاجرت
 *    `0059` ساخته می‌شود.
 *
 * ۳) انطباق با مرجع صنعتی: هر جا مدلی ریشه در استاندارد دارد، نام آن در
 *    کامنت آمده است — WITSML 2.0 (کانال‌های تله‌متری حفاری)، IADC NPT
 *    (دسته‌بندی زمان نامولّد)، ISO 10816 (مناطق ارتعاش)، IEC 62443
 *    (امنیت لایهٔ OT)، API RP 7G (محدوده‌های عملیاتی دکل).
 *
 * دامنهٔ اصلی این ماژول «دکل» (`RigId`) است، نه پروژه و نه سایت: یک دکل
 * حفاری بین چندین چاه، قرارداد و پروژه جابه‌جا می‌شود، پس کلید دامنه باید از
 * چرخهٔ قرارداد مستقل باشد (همان استدلال CMMS برای `SiteId`).
 *
 * ستون‌های حسابرسی (CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/RowVersion) از
 * `AUDIT_COLUMNS` در persistence.ts خودکار افزوده می‌شوند و اینجا اعلام
 * نمی‌شوند — اعلام دستی‌شان خطای اعتبارسنجی اسکیما می‌دهد.
 */
import type { ColumnDef, TableDef } from "./persistence";

const c = (name: string, kind: ColumnDef["kind"], extra: Partial<ColumnDef> = {}): ColumnDef => ({ name, kind, nullable: true, ...extra });
const req = (name: string, kind: ColumnDef["kind"], extra: Partial<ColumnDef> = {}): ColumnDef => ({ name, kind, nullable: false, ...extra });
const id = (): ColumnDef => req("Id", "text", { len: 60 });
/** ارجاع داخلی با کلید خارجی واقعی (فقط درون بلوک Iot*). */
const hardRef = (name: string): ColumnDef => c(name, "text", { len: 60 });
const num = (name: string, precision = 18, scale = 6, nullable = true): ColumnDef => ({ name, kind: "decimal", precision, scale, nullable });
const reqNum = (name: string, precision = 18, scale = 6): ColumnDef => ({ name, kind: "decimal", precision, scale, nullable: false });
const pct = (name: string, nullable = true): ColumnDef => ({ name, kind: "decimal", precision: 9, scale: 4, nullable });
const ck = (name: string, expression: string, columns: string[]) => ({ name, expression, columns });

/** دامنهٔ اصلی پایش میدانی؛ مستقل از ProjectId و SiteId نت و PlantId تولید. */
const rig = () => req("RigId", "text", { len: 60, comment: "دامنهٔ اصلی IIoT؛ مستقل از ProjectId پمیس و SiteId نت" });
const code = (name = "Code") => req(name, "text", { len: 60 });
const note = (name = "NoteFa", len = 1000) => c(name, "text", { len });
/** نسخهٔ موتور دامنه؛ برای ردیابی تغییر الگوریتم در خروجی‌های محاسباتی. */
const modelVersion = () => c("ModelVersion", "text", { len: 40, comment: "iiot-v1" });

/**
 * ۱۴ جدول بخش ۵ — بلوک مهاجرت ۰۰۵۹.
 *
 * ترتیب این آرایه مهم است: کلیدهای خارجی درون `CREATE TABLE` می‌آیند، پس جدول
 * والد باید پیش از فرزند باشد. آزمون `iiot.schema.test.mjs` همین ترتیب را قفل
 * می‌کند تا مهاجرت به مرتب‌سازی تصادفی وابسته نشود.
 */
export const IIOT_TABLES: TableDef[] = [
  /* ═══════════════ الف) رجیستری دکل و زیرساخت لبه ═══════════════ */

  /* 01 — دکل حفاری. ریشهٔ دامنهٔ IIoT: مالک شناسهٔ `RigId` می‌شود تا در جدول‌های
   * فرزند یک رشتهٔ بی‌صاحب نباشد. ارجاع به سایت نت و پروژهٔ پمیس عمداً «نرم»
   * است (بدون FK) چون عمر دکل از عمر قرارداد بلندتر است. */
  {
    name: "IotDrillingRig", module: "iiot", title: { fa: "دکل حفاری و جریان عملیات", en: "Drilling rig" }, pk: "Id",
    columns: [
      id(), req("RigId", "text", { len: 60, comment: "کلید کسب‌وکاری دکل — دامنهٔ همهٔ جدول‌های Iot*" }),
      code("RigNo"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("RigType", "text", { len: 24, comment: "land|jackup|semi-submersible|platform|workover|coiled-tubing" }),
      c("OwnerFa", "text", { len: 240 }), c("DrillingContractorFa", "text", { len: 240 }),
      c("CmmsSiteRef", "text", { len: 60, comment: "ارجاع نرم به CmmsSite.SiteId — بدون FK" }),
      c("PmisProjectRef", "text", { len: 60, comment: "ارجاع نرم به Project.Id پمیس — بدون FK" }),
      c("MesWorkCenterRef", "text", { len: 60, comment: "ارجاع نرم به MfgWorkCenter — بدون FK" }),
      c("FieldName", "text", { len: 160 }), c("WellName", "text", { len: 160 }),
      c("SpudDate", "date"), num("TargetDepthM", 12, 2), num("CurrentDepthM", 12, 2),
      req("Status", "text", { len: 24, default: "'drilling'", comment: "mobilizing|drilling|tripping|cementing|completion|workover|stacked|demobilized" }),
      num("Latitude", 10, 6), num("Longitude", 10, 6),
      c("TimeZoneId", "text", { len: 80, default: "'Asia/Tehran'" }),
      req("NominalSampleRateHz", "int", { default: "1", comment: "نرخ نمونه‌برداری مبنا؛ سقف فرکانس کانال‌ها" }),
      req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_IotDrillingRig_RigId", columns: ["RigId"], unique: true },
      { name: "UX_IotDrillingRig_No", columns: ["RigNo"], unique: true },
      { name: "IX_IotDrillingRig_Status", columns: ["Status", "IsActive"] },
    ],
    checks: [
      ck("CK_IotDrillingRig_Type", "RigType IN ('land','jackup','semi-submersible','platform','workover','coiled-tubing')", ["RigType"]),
      ck("CK_IotDrillingRig_Status", "Status IN ('mobilizing','drilling','tripping','cementing','completion','workover','stacked','demobilized')", ["Status"]),
      ck("CK_IotDrillingRig_Rate", "NominalSampleRateHz >= 1", ["NominalSampleRateHz"]),
    ],
  },

  /* 02 — گیت‌وی لبه. محل اجرای Store-and-Forward: وقتی لینک دکل قطع است،
   * نمونه‌ها همین‌جا بافر می‌شوند و پس از بازگشت ارتباط همگام می‌شوند.
   * امنیت لایهٔ OT طبق IEC 62443: احراز هویت گیت‌وی و ثبت نسخهٔ فریم‌ور. */
  {
    name: "IotEdgeGateway", module: "iiot", title: { fa: "گیت‌وی لبه (Edge Gateway)", en: "Edge gateway" }, pk: "Id",
    columns: [
      id(), rig(), code("GatewayCode"), req("NameFa", "text", { len: 240 }),
      req("Protocol", "text", { len: 24, comment: "mqtt|opc-ua|modbus|witsml|http" }),
      c("FirmwareVersion", "text", { len: 60 }), c("IpAddress", "text", { len: 60 }),
      c("LocationFa", "text", { len: 240 }),
      req("SyncMode", "text", { len: 24, default: "'store-forward'", comment: "realtime|store-forward|batch" }),
      req("BufferCapacity", "int", { default: "100000", comment: "ظرفیت بافر محلی بر حسب نمونه" }),
      req("BufferUsed", "int", { default: "0" }),
      req("MaxBatchSize", "int", { default: "1000" }),
      req("MaxAttempts", "int", { default: "5" }),
      req("ConnectionState", "text", { len: 16, default: "'offline'", comment: "online|degraded|offline" }),
      c("LastHeartbeatAt", "datetime"), c("LastSyncAt", "datetime"),
      c("HeartbeatIntervalSeconds", "int"),
      req("InstalledAt", "datetime"), req("IsActive", "bool", { default: "1" }),
      c("AuthMode", "text", { len: 24, default: "'token'", comment: "token|certificate|anonymous — IEC 62443" }),
      note(),
    ],
    indexes: [
      { name: "UX_IotEdgeGateway_Code", columns: ["RigId", "GatewayCode"], unique: true },
      { name: "IX_IotEdgeGateway_State", columns: ["RigId", "ConnectionState", "IsActive"] },
    ],
    checks: [
      ck("CK_IotEdgeGateway_Protocol", "Protocol IN ('mqtt','opc-ua','modbus','witsml','http')", ["Protocol"]),
      ck("CK_IotEdgeGateway_Sync", "SyncMode IN ('realtime','store-forward','batch')", ["SyncMode"]),
      ck("CK_IotEdgeGateway_State", "ConnectionState IN ('online','degraded','offline')", ["ConnectionState"]),
      ck("CK_IotEdgeGateway_Buffer", "BufferUsed >= 0 AND BufferUsed <= BufferCapacity", ["BufferUsed", "BufferCapacity"]),
      ck("CK_IotEdgeGateway_Batch", "MaxBatchSize >= 1", ["MaxBatchSize"]),
    ],
  },

  /* 03 — شناسنامهٔ سنسور و تگ فیزیکی؛ مبنای کالیبراسیون و ردیابی خرابی سنسور. */
  {
    name: "IotSensorNode", module: "iiot", title: { fa: "سنسور و تگ میدان", en: "Field sensor node" }, pk: "Id",
    columns: [
      id(), rig(), code("SensorTag"), req("NameFa", "text", { len: 240 }),
      req("SensorType", "text", { len: 40, comment: "vibration|temperature|pressure|flow|torque|rpm|gas|humidity|current|load" }),
      c("Manufacturer", "text", { len: 160 }), c("ModelNo", "text", { len: 120 }), c("SerialNo", "text", { len: 120 }),
      num("RangeMin", 18, 4), num("RangeMax", 18, 4), c("Unit", "text", { len: 24 }),
      pct("AccuracyPct"), c("LocationFa", "text", { len: 240 }),
      hardRef("GatewayId"),
      c("InstalledAt", "datetime"), c("LastCalibratedAt", "datetime"), c("NextCalibrationDue", "date"),
      c("CalibrationIntervalDays", "int"),
      req("Status", "text", { len: 24, default: "'active'", comment: "active|faulty|calibration-due|removed" }),
      note(),
    ],
    indexes: [
      { name: "UX_IotSensorNode_Tag", columns: ["RigId", "SensorTag"], unique: true },
      { name: "IX_IotSensorNode_Status", columns: ["RigId", "Status"] },
      { name: "IX_IotSensorNode_Calibration", columns: ["RigId", "NextCalibrationDue"] },
    ],
    foreignKeys: [
      { column: "GatewayId", refTable: "IotEdgeGateway", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_IotSensorNode_Status", "Status IN ('active','faulty','calibration-due','removed')", ["Status"]),
      ck("CK_IotSensorNode_Range", "RangeMin IS NULL OR RangeMax IS NULL OR RangeMax > RangeMin", ["RangeMin", "RangeMax"]),
    ],
  },

  /* ═══════════════ ب) جریان، کانال و نمونهٔ تله‌متری ═══════════════ */

  /* 04 — جریان تله‌متری: یک منبع داده (Mudlogger / WITSML / PLC) که گروهی از
   * کانال‌ها را با نرخ و پروتکل مشخص تحویل می‌دهد. ساختار کانال برگرفته از
   * مدل Channel/Setlog در WITSML 2.0 است. */
  {
    name: "IotDrillingRigStream", module: "iiot", title: { fa: "جریان تله‌متری دکل", en: "Drilling rig telemetry stream" }, pk: "Id",
    columns: [
      id(), rig(), code("StreamCode"), req("NameFa", "text", { len: 240 }),
      req("SourceSystem", "text", { len: 24, comment: "witsml|mudlogger|plc|scada|edge|manual" }),
      hardRef("GatewayId"),
      req("TransportProtocol", "text", { len: 24, comment: "mqtt|opc-ua|modbus|witsml|http" }),
      req("SampleRateHz", "int", { default: "1" }),
      req("BatchSize", "int", { default: "100" }),
      req("ConnectionState", "text", { len: 16, default: "'offline'", comment: "online|degraded|offline" }),
      c("LastSampleAt", "datetime"), c("LastSeqNo", "bigint"),
      pct("QualityPct"),
      req("IsActive", "bool", { default: "1" }),
      c("WitsmlMnemonicMapJson", "json", { comment: "نگاشت منومونیک WITSML به کد کانال داخلی" }),
      note(),
    ],
    indexes: [
      { name: "UX_IotRigStream_Code", columns: ["RigId", "StreamCode"], unique: true },
      { name: "IX_IotRigStream_State", columns: ["RigId", "ConnectionState", "IsActive"] },
      { name: "IX_IotRigStream_Gateway", columns: ["GatewayId"] },
    ],
    foreignKeys: [
      { column: "GatewayId", refTable: "IotEdgeGateway", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_IotRigStream_Source", "SourceSystem IN ('witsml','mudlogger','plc','scada','edge','manual')", ["SourceSystem"]),
      ck("CK_IotRigStream_Protocol", "TransportProtocol IN ('mqtt','opc-ua','modbus','witsml','http')", ["TransportProtocol"]),
      ck("CK_IotRigStream_Rate", "SampleRateHz >= 1", ["SampleRateHz"]),
      ck("CK_IotRigStream_State", "ConnectionState IN ('online','degraded','offline')", ["ConnectionState"]),
    ],
  },

  /* 05 — کانال سیگنال (DAS Channel). هر کانال یک کمیت فیزیکی است (WOB، RPM،
   * گشتاور، فشار پمپ گل، دبی، دما، ارتعاش، ROP، عمق) با واحد، محدودهٔ نمایش،
   * تنظیمات فیلتر و منبع سنسور. پنجرهٔ فیلتر همین‌جا نگه داشته می‌شود تا
   * داشبورد و موتور تشخیص از یک تنظیم واحد بخوانند. */
  {
    name: "IotDasChannel", module: "iiot", title: { fa: "کانال سیگنال حفاری (DAS)", en: "Drilling DAS signal channel" }, pk: "Id",
    columns: [
      id(), rig(), hardRef("StreamId"), code("ChannelCode"),
      req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("SignalType", "text", { len: 32, comment: "wob|rpm|torque|mud-pump-pressure|flow-rate|temperature|vibration|rop|depth|standpipe-pressure|hookload|gas" }),
      req("Unit", "text", { len: 24 }),
      num("NominalMin", 18, 4), num("NominalMax", 18, 4), num("NominalValue", 18, 4),
      num("DisplayMin", 18, 4), num("DisplayMax", 18, 4),
      req("SampleRateHz", "int", { default: "1" }),
      req("FilterMethod", "text", { len: 16, default: "'sma'", comment: "none|sma|ema|median" }),
      req("FilterWindowSeconds", "int", { default: "10", comment: "پنجرهٔ میانگین‌گیری؛ ضد هشدار کاذب" }),
      pct("DeadbandPct"),
      c("SensorTag", "text", { len: 60, comment: "ارجاع نرم به IotSensorNode.SensorTag" }),
      c("WitsmlMnemonic", "text", { len: 80 }),
      req("IsCritical", "bool", { default: "0", comment: "کانال حیاتی: ناهنجاری بحرانی آن دستورکار خودکار می‌سازد" }),
      req("IsActive", "bool", { default: "1" }),
      c("InstalledLocationFa", "text", { len: 240 }),
      c("CalibratedAt", "datetime"), c("NextCalibrationDue", "date"),
      c("LastValueAt", "datetime"), num("LastValue", 18, 6), c("LastQuality", "text", { len: 16 }),
      modelVersion(), note(),
    ],
    indexes: [
      { name: "UX_IotDasChannel_Code", columns: ["RigId", "ChannelCode"], unique: true },
      { name: "IX_IotDasChannel_Signal", columns: ["RigId", "SignalType", "IsActive"] },
      { name: "IX_IotDasChannel_Stream", columns: ["StreamId", "IsActive"] },
    ],
    foreignKeys: [
      { column: "StreamId", refTable: "IotDrillingRigStream", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_IotDasChannel_Signal",
        "SignalType IN ('wob','rpm','torque','mud-pump-pressure','flow-rate','temperature','vibration','rop','depth','standpipe-pressure','hookload','gas')",
        ["SignalType"]),
      ck("CK_IotDasChannel_Filter", "FilterMethod IN ('none','sma','ema','median')", ["FilterMethod"]),
      ck("CK_IotDasChannel_Window", "FilterWindowSeconds >= 1", ["FilterWindowSeconds"]),
      ck("CK_IotDasChannel_Rate", "SampleRateHz >= 1", ["SampleRateHz"]),
      ck("CK_IotDasChannel_Display", "DisplayMin IS NULL OR DisplayMax IS NULL OR DisplayMax > DisplayMin", ["DisplayMin", "DisplayMax"]),
      ck("CK_IotDasChannel_Deadband", "DeadbandPct IS NULL OR DeadbandPct >= 0", ["DeadbandPct"]),
    ],
  },

  /* ═══════════════ ج) بافر لبه و همگام‌سازی (Store-and-Forward) ═══════════════ */

  /* 06 — دستهٔ بافرشدهٔ لبه. هر دسته چک‌سام دارد تا همگام‌سازی دوباره یا
   * ناقص قابل تشخیص باشد؛ `IdempotencyKey`-مانند همان `BatchNo` یکتا است، پس
   * ارسال دوبارهٔ یک دسته، نمونهٔ دوباره نمی‌سازد. */
  {
    name: "IotGatewayBuffer", module: "iiot", title: { fa: "بافر لبه (Store-and-Forward)", en: "Edge store-and-forward batch" }, pk: "Id",
    columns: [
      id(), rig(), hardRef("GatewayId"), req("BatchNo", "text", { len: 80 }),
      req("CapturedAt", "datetime"),
      req("FromAt", "datetime"), req("ToAt", "datetime"),
      req("SampleCount", "int", { default: "0" }),
      req("PayloadJson", "json"),
      req("Checksum", "text", { len: 80 }),
      req("Status", "text", { len: 16, default: "'buffered'", comment: "buffered|sending|sent|failed|dead-letter" }),
      req("Attempts", "int", { default: "0" }),
      req("MaxAttempts", "int", { default: "5" }),
      c("LastAttemptAt", "datetime"), c("SentAt", "datetime"), c("AckRef", "text", { len: 120 }),
      c("ErrorCode", "text", { len: 60 }), c("ErrorFa", "text", { len: 600 }),
      c("ConnectivityState", "text", { len: 24, comment: "satellite|4g|fiber|offline" }),
      note(),
    ],
    indexes: [
      { name: "UX_IotGatewayBuffer_Batch", columns: ["GatewayId", "BatchNo"], unique: true },
      { name: "IX_IotGatewayBuffer_Status", columns: ["RigId", "Status", "CapturedAt"] },
    ],
    foreignKeys: [
      { column: "GatewayId", refTable: "IotEdgeGateway", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_IotGatewayBuffer_Status", "Status IN ('buffered','sending','sent','failed','dead-letter')", ["Status"]),
      ck("CK_IotGatewayBuffer_Window", "ToAt >= FromAt", ["FromAt", "ToAt"]),
      ck("CK_IotGatewayBuffer_Attempts", "Attempts >= 0 AND Attempts <= MaxAttempts", ["Attempts", "MaxAttempts"]),
    ],
  },

  /* 07 — نمونهٔ تله‌متری فرکانس‌بالا. در استقرار تولیدی، منبع حقیقت تاریخچهٔ
   * پرفرکانس InfluxDB است (`server/iiotTimeSeries.mjs`) و این جدول لایهٔ
   * رابطه‌ای پشتیبان/قابل‌پرس‌وجو با SQL Server است؛ هر دو از یک مسیر نوشتن
   * پر می‌شوند تا واگرا نشوند. `RawValue` مقدار پیش از فیلتر و `FilteredValue`
   * خروجی فیلتر پنجره‌ای است — همین دو ستون، «چرا هشدار داد/نداد» را قابل
   * اثبات می‌کنند. */
  {
    name: "IotTelemetrySample", module: "iiot", title: { fa: "نمونهٔ تله‌متری", en: "Telemetry sample" }, pk: "Id",
    columns: [
      id(), rig(), hardRef("StreamId"), hardRef("ChannelId"),
      req("SampledAt", "datetime"), reqNum("Value", 18, 6),
      num("RawValue", 18, 6), num("FilteredValue", 18, 6),
      c("Unit", "text", { len: 24 }),
      c("SeqNo", "bigint"),
      req("Quality", "text", { len: 16, default: "'good'", comment: "good|suspect|bad|stale" }),
      req("Source", "text", { len: 16, default: "'live'", comment: "live|buffer|replay|simulated|manual" }),
      hardRef("GatewayId"), hardRef("BufferId"),
      c("BatchNo", "text", { len: 80 }),
      req("IngestedAt", "datetime"),
      req("IsFlagged", "bool", { default: "0", comment: "نمونهٔ مشارکت‌کننده در یک ناهنجاری تشخیص‌داده‌شده" }),
      c("QualityReasonFa", "text", { len: 240 }),
    ],
    indexes: [
      { name: "IX_IotSample_ChannelTime", columns: ["ChannelId", "SampledAt"] },
      { name: "IX_IotSample_RigTime", columns: ["RigId", "SampledAt"] },
      { name: "IX_IotSample_Quality", columns: ["RigId", "Quality", "SampledAt"] },
      { name: "IX_IotSample_Buffer", columns: ["BufferId", "SampledAt"] },
    ],
    foreignKeys: [
      { column: "StreamId", refTable: "IotDrillingRigStream", refColumn: "Id", onDelete: "SET NULL" },
      { column: "ChannelId", refTable: "IotDasChannel", refColumn: "Id" },
      { column: "GatewayId", refTable: "IotEdgeGateway", refColumn: "Id", onDelete: "SET NULL" },
      { column: "BufferId", refTable: "IotGatewayBuffer", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_IotSample_Quality", "Quality IN ('good','suspect','bad','stale')", ["Quality"]),
      ck("CK_IotSample_Source", "Source IN ('live','buffer','replay','simulated','manual')", ["Source"]),
    ],
  },

  /* 08 — تجمیع (Rollup) سری زمانی در سطل‌های زمانی ثابت. داشبورد و نمودارها از
   * این جدول می‌خوانند، نه از میلیون‌ها نمونهٔ خام — همان الگوی
   * downsampling که InfluxDB هم دارد. */
  {
    name: "IotTelemetryRollup", module: "iiot", title: { fa: "تجمیع سری زمانی", en: "Telemetry rollup bucket" }, pk: "Id",
    columns: [
      id(), rig(), hardRef("ChannelId"),
      req("BucketSeconds", "int"), req("BucketStart", "datetime"),
      req("SampleCount", "int", { default: "0" }),
      req("BadCount", "int", { default: "0" }),
      num("MinValue", 18, 6), num("MaxValue", 18, 6), num("AvgValue", 18, 6), num("StdDev", 18, 6),
      num("FirstValue", 18, 6), num("LastValue", 18, 6),
      pct("QualityPct"),
      modelVersion(),
    ],
    indexes: [
      { name: "UX_IotRollup_Channel", columns: ["ChannelId", "BucketSeconds", "BucketStart"], unique: true },
      { name: "IX_IotRollup_Rig", columns: ["RigId", "BucketStart"] },
    ],
    foreignKeys: [
      { column: "ChannelId", refTable: "IotDasChannel", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_IotRollup_Bucket", "BucketSeconds >= 1", ["BucketSeconds"]),
      ck("CK_IotRollup_Count", "SampleCount >= 0 AND BadCount >= 0", ["SampleCount", "BadCount"]),
      ck("CK_IotRollup_MinMax", "MinValue IS NULL OR MaxValue IS NULL OR MaxValue >= MinValue", ["MinValue", "MaxValue"]),
    ],
  },

  /* ═══════════════ د) فیلترینگ سیگنال و آستانه‌های چندسطحی ═══════════════ */

  /* 09 — قاعدهٔ فیلترینگ سیگنال (نسخه‌دار). جدا از کانال نگه داشته می‌شود تا
   * «تنظیم امروز» با «تنظیم دیروز که این هشدار را ساخت» قابل تفکیک بماند.
   * هدف اصلی ضد هشدار کاذب است: نویز طبیعی لایه‌های زمین نباید آلارم بسازد. */
  {
    name: "IotSignalFilterRule", module: "iiot", title: { fa: "قاعدهٔ فیلترینگ سیگنال", en: "Signal filter rule" }, pk: "Id",
    columns: [
      id(), rig(), code("RuleCode"), req("NameFa", "text", { len: 240 }),
      req("AppliesToSignals", "text", { len: 400, comment: "فهرست SignalType با کاما؛ * یعنی همه" }),
      req("FilterMethod", "text", { len: 16, default: "'sma'", comment: "none|sma|ema|median" }),
      req("WindowSeconds", "int", { default: "10" }),
      pct("EmaAlpha"),
      req("MinSamples", "int", { default: "5", comment: "حداقل نمونه برای آماده‌بودن فیلتر (warm-up)" }),
      pct("DeadbandPct"),
      pct("SpikeZThreshold"),
      req("FlatlineSeconds", "int", { default: "60", comment: "مدت ثابت‌ماندن سیگنال پیش از اعلام «سیگنال یخ‌زده»" }),
      req("IsDefault", "bool", { default: "0" }),
      req("Version", "int", { default: "1" }),
      req("IsActive", "bool", { default: "1" }),
      c("EffectiveFrom", "datetime"),
      modelVersion(), note(),
    ],
    indexes: [
      { name: "UX_IotSignalFilterRule_Code", columns: ["RigId", "RuleCode"], unique: true },
      { name: "IX_IotSignalFilterRule_Active", columns: ["RigId", "IsActive"] },
    ],
    checks: [
      ck("CK_IotSignalFilterRule_Method", "FilterMethod IN ('none','sma','ema','median')", ["FilterMethod"]),
      ck("CK_IotSignalFilterRule_Window", "WindowSeconds >= 1", ["WindowSeconds"]),
      ck("CK_IotSignalFilterRule_Min", "MinSamples >= 1", ["MinSamples"]),
      ck("CK_IotSignalFilterRule_Alpha", "EmaAlpha IS NULL OR (EmaAlpha > 0 AND EmaAlpha <= 1)", ["EmaAlpha"]),
    ],
  },

  /* 10 — آستانهٔ چندسطحی (Warning / Critical) با پایداری زمانی، هیسترزیس و
   * دورهٔ سکوت. سه ستون `DurationSeconds`، `MinSamples` و `CooldownSeconds`
   * همان مکانیزم ضد هشدار کاذب‌اند: یک نمونهٔ گذرا آلارم نمی‌سازد.
   * `DetectKind` الگوریتم تشخیص را تعیین می‌کند — آستانهٔ ساده، نرخ تغییر،
   * Stick-Slip مته یا افت فشار پمپ گل. */
  {
    name: "IotThresholdRule", module: "iiot", title: { fa: "آستانهٔ هشدار چندسطحی", en: "Multi-level threshold rule" }, pk: "Id",
    columns: [
      id(), rig(), hardRef("ChannelId"), code("RuleCode"), req("NameFa", "text", { len: 240 }),
      req("Level", "text", { len: 12, comment: "warning|critical" }),
      req("DetectKind", "text", { len: 24, default: "'threshold'", comment: "threshold|rate-of-change|stick-slip|pump-drop|flatline|spike" }),
      req("Comparison", "text", { len: 16, default: "'gt'", comment: "gt|gte|lt|lte|band-out|rate" }),
      num("ThresholdValue", 18, 6), c("SecondaryValue", "decimal", { precision: 18, scale: 6, comment: "کرانهٔ دوم برای band-out یا سقف نرخ تغییر" }),
      req("DurationSeconds", "int", { default: "30", comment: "پایداری لازم پیش از اعلام — ضد هشدار کاذب" }),
      req("MinSamples", "int", { default: "10" }),
      pct("HysteresisPct"),
      req("CooldownSeconds", "int", { default: "600", comment: "دورهٔ سکوت پیش از هشدار تازهٔ همان قاعده" }),
      /* پارامترهای اختصاصی تشخیص Stick-Slip */
      pct("TorqueCvThreshold"), num("RpmSwingPctThreshold", 9, 4),
      /* پارامتر افت فشار پمپ گل */
      pct("PressureDropPctThreshold"),
      req("AutoDispatch", "bool", { default: "0", comment: "ارسال خودکار به CMMS/MES/PMIS" }),
      c("DispatchTargets", "text", { len: 120, comment: "فهرست مقصد با کاما: cmms,mes,pmis" }),
      c("CmmsPriority", "int"), c("CmmsSiteRef", "text", { len: 60 }), c("CmmsAssetRef", "text", { len: 60 }),
      c("MesWorkCenterRef", "text", { len: 60 }), c("MesPlantRef", "text", { len: 60 }),
      c("PmisProjectRef", "text", { len: 60 }),
      c("NptCode", "text", { len: 40, comment: "کد IADC NPT برای ثبت خودکار توقف" }),
      c("EscalationNoteFa", "text", { len: 1000 }),
      req("Version", "int", { default: "1" }),
      req("IsActive", "bool", { default: "1" }),
      c("EffectiveFrom", "datetime"),
      modelVersion(), note(),
    ],
    indexes: [
      { name: "UX_IotThresholdRule_Code", columns: ["RigId", "RuleCode"], unique: true },
      { name: "IX_IotThresholdRule_Channel", columns: ["ChannelId", "Level", "IsActive"] },
      { name: "IX_IotThresholdRule_Kind", columns: ["RigId", "DetectKind", "IsActive"] },
    ],
    foreignKeys: [
      { column: "ChannelId", refTable: "IotDasChannel", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_IotThresholdRule_Level", "Level IN ('warning','critical')", ["Level"]),
      ck("CK_IotThresholdRule_Kind", "DetectKind IN ('threshold','rate-of-change','stick-slip','pump-drop','flatline','spike')", ["DetectKind"]),
      ck("CK_IotThresholdRule_Comparison", "Comparison IN ('gt','gte','lt','lte','band-out','rate')", ["Comparison"]),
      ck("CK_IotThresholdRule_Duration", "DurationSeconds >= 0", ["DurationSeconds"]),
      ck("CK_IotThresholdRule_MinSamples", "MinSamples >= 1", ["MinSamples"]),
      ck("CK_IotThresholdRule_Cooldown", "CooldownSeconds >= 0", ["CooldownSeconds"]),
      ck("CK_IotThresholdRule_Targets", "AutoDispatch = 0 OR DispatchTargets IS NOT NULL", ["AutoDispatch", "DispatchTargets"]),
    ],
  },

  /* ═══════════════ ه) هشدار، توقف/NPT و صف خروجی ═══════════════ */

  /* 11 — هشدار تولیدشده. `TriggerValue` مقدار خام و `FilteredValue` مقدار
   * فیلترشده در لحظهٔ اعلام است؛ `BaselineValue` مبنای مقایسه. با این سه عدد،
   * هر هشدار قابل بازبینی و ردّ به‌عنوان «هشدار کاذب» است. */
  {
    name: "IotTelemetryAlert", module: "iiot", title: { fa: "هشدار تله‌متری", en: "Telemetry alert" }, pk: "Id",
    columns: [
      id(), rig(), hardRef("ChannelId"), hardRef("RuleId"),
      req("AlertCode", "text", { len: 80 }),
      req("DetectionKind", "text", { len: 24, comment: "threshold|rate-of-change|stick-slip|pump-drop|flatline|spike" }),
      req("Level", "text", { len: 12, comment: "warning|critical" }),
      req("TitleFa", "text", { len: 300 }), c("MessageFa", "text", { len: 2000 }),
      req("DetectedAt", "datetime"), c("TriggeredAt", "datetime"), c("ResolvedAt", "datetime"),
      num("TriggerValue", 18, 6), num("FilteredValue", 18, 6), num("BaselineValue", 18, 6),
      pct("DeviationPct"),
      req("SampleCount", "int", { default: "0" }),
      req("DurationSeconds", "int", { default: "0" }),
      c("MetricsJson", "json", { comment: "شاخص‌های تشخیص (TorqueCv، RpmSwing، DropPct …)" }),
      req("Status", "text", { len: 20, default: "'active'", comment: "active|acknowledged|resolved|suppressed|false-positive" }),
      c("AcknowledgedAt", "datetime"), c("AcknowledgedById", "text", { len: 60 }), c("AckNoteFa", "text", { len: 1000 }),
      c("ResolvedById", "text", { len: 60 }), c("ResolutionNoteFa", "text", { len: 1000 }),
      c("SuppressedReasonFa", "text", { len: 600 }),
      req("DispatchStatus", "text", { len: 16, default: "'none'", comment: "none|pending|partial|dispatched|failed" }),
      c("CmmsWorkOrderRef", "text", { len: 80 }), c("MesDowntimeRef", "text", { len: 80 }), c("PmisEventRef", "text", { len: 80 }),
      modelVersion(), note(),
    ],
    indexes: [
      { name: "UX_IotAlert_Code", columns: ["RigId", "AlertCode", "DetectedAt"], unique: true },
      { name: "IX_IotAlert_Status", columns: ["RigId", "Status", "Level"] },
      { name: "IX_IotAlert_Channel", columns: ["ChannelId", "DetectedAt"] },
      { name: "IX_IotAlert_Dispatch", columns: ["RigId", "DispatchStatus"] },
    ],
    foreignKeys: [
      { column: "ChannelId", refTable: "IotDasChannel", refColumn: "Id", onDelete: "CASCADE" },
      { column: "RuleId", refTable: "IotThresholdRule", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_IotAlert_Level", "Level IN ('warning','critical')", ["Level"]),
      ck("CK_IotAlert_Status", "Status IN ('active','acknowledged','resolved','suppressed','false-positive')", ["Status"]),
      ck("CK_IotAlert_Kind", "DetectionKind IN ('threshold','rate-of-change','stick-slip','pump-drop','flatline','spike')", ["DetectionKind"]),
      ck("CK_IotAlert_Dispatch", "DispatchStatus IN ('none','pending','partial','dispatched','failed')", ["DispatchStatus"]),
      ck("CK_IotAlert_Resolve", "Status <> 'resolved' OR ResolvedAt IS NOT NULL", ["Status", "ResolvedAt"]),
    ],
  },

  /* 12 — توقف دکل و زمان نامولّد (NPT). دسته‌بندی بر پایهٔ ساختار IADC NPT.
   * این ردیف، هم خوراک گزارش پیشرفت پمیس است و هم شاهد ادعا (Claim). */
  {
    name: "IotRigDowntime", module: "iiot", title: { fa: "توقف دکل و زمان نامولّد", en: "Rig downtime / NPT" }, pk: "Id",
    columns: [
      id(), rig(), req("DowntimeCode", "text", { len: 60 }),
      req("Category", "text", { len: 32, comment: "equipment|mud|directional|wellbore|weather|power|logistics|cementing|waiting-on-decision|other" }),
      req("DowntimeType", "text", { len: 24, default: "'non-productive'", comment: "productive|non-productive|planned" }),
      c("NptCode", "text", { len: 40, comment: "کد IADC NPT" }),
      req("CauseFa", "text", { len: 1000 }), c("EffectFa", "text", { len: 1000 }),
      req("StartedAt", "datetime"), c("EndedAt", "datetime"),
      num("DurationMinutes", 12, 3),
      req("IsNpt", "bool", { default: "1" }),
      num("RecoverableMinutes", 12, 3),
      c("ResponsibilityFa", "text", { len: 240, comment: "کارفرما|پیمانکار|فورس‌ماژور — ورودی لایهٔ ادعا" }),
      hardRef("AlertId"),
      req("DetectedBy", "text", { len: 16, default: "'auto'", comment: "auto|manual" }),
      c("ShiftName", "text", { len: 80 }),
      c("RecordedById", "text", { len: 60 }), c("VerifiedById", "text", { len: 60 }), c("VerifiedAt", "datetime"),
      req("ReportedToMes", "bool", { default: "0" }), req("ReportedToPmis", "bool", { default: "0" }),
      c("MesDowntimeRef", "text", { len: 80 }), c("PmisEventRef", "text", { len: 80 }), c("PmisClaimRef", "text", { len: 80 }),
      modelVersion(), note(),
    ],
    indexes: [
      { name: "UX_IotRigDowntime_Code", columns: ["RigId", "DowntimeCode"], unique: true },
      { name: "IX_IotRigDowntime_Window", columns: ["RigId", "StartedAt", "IsNpt"] },
      { name: "IX_IotRigDowntime_Category", columns: ["RigId", "Category", "StartedAt"] },
    ],
    foreignKeys: [
      { column: "AlertId", refTable: "IotTelemetryAlert", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_IotRigDowntime_Window", "EndedAt IS NULL OR EndedAt >= StartedAt", ["StartedAt", "EndedAt"]),
      ck("CK_IotRigDowntime_Duration", "DurationMinutes IS NULL OR DurationMinutes >= 0", ["DurationMinutes"]),
      ck("CK_IotRigDowntime_Type", "DowntimeType IN ('productive','non-productive','planned')", ["DowntimeType"]),
      ck("CK_IotRigDowntime_Category",
        "Category IN ('equipment','mud','directional','wellbore','weather','power','logistics','cementing','waiting-on-decision','other')",
        ["Category"]),
      ck("CK_IotRigDowntime_Npt", "IsNpt = 0 OR DowntimeType = 'non-productive'", ["IsNpt", "DowntimeType"]),
    ],
  },

  /* 13 — صف خروجی رویداد به CMMS / MES / PMIS. الگو همان صندوق خروجی
   * `CmmsIntegrationEvent` است: رویداد اول در صف می‌نشیند، بعد تحویل می‌شود،
   * و تحویل ناموفق با خطای دسته‌بندی‌شده ثبت می‌شود — هیچ «موفق»ی بی‌شاهد
   * ثبت نمی‌شود. `IdempotencyKey` یکتا جلوی نوشتن دوباره در سامانهٔ مقصد را
   * می‌گیرد. */
  {
    name: "IotIntegrationEvent", module: "iiot", title: { fa: "رویداد یکپارچگی بین‌بخشی", en: "Cross-module integration event" }, pk: "Id",
    columns: [
      id(), rig(),
      req("EventType", "text", { len: 60, comment: "alert.critical|alert.resolved|downtime.npt|downtime.closed|condition.reading" }),
      req("TargetSystem", "text", { len: 16, comment: "cmms|mes|pmis" }),
      c("TargetRef", "text", { len: 120 }),
      req("Contract", "text", { len: 40, comment: "iiot-cmms-v1|iiot-mes-v1|iiot-pmis-v1" }),
      req("IdempotencyKey", "text", { len: 160 }),
      c("CorrelationId", "text", { len: 120 }),
      c("SourceTable", "text", { len: 60 }), c("SourceId", "text", { len: 120 }),
      req("OccurredAt", "datetime"),
      req("PayloadJson", "json"),
      req("Status", "text", { len: 16, default: "'pending'", comment: "pending|dispatched|failed|dead-letter" }),
      req("Attempts", "int", { default: "0" }), req("MaxAttempts", "int", { default: "5" }),
      c("LastAttemptAt", "datetime"), c("DeliveredAt", "datetime"), c("AckRef", "text", { len: 120 }),
      c("ErrorCode", "text", { len: 60 }), c("ErrorFa", "text", { len: 600 }),
      req("EmittedBy", "text", { len: 60 }),
      modelVersion(),
    ],
    indexes: [
      { name: "UX_IotIntegrationEvent_Key", columns: ["IdempotencyKey"], unique: true },
      { name: "IX_IotIntegrationEvent_Queue", columns: ["Status", "OccurredAt"] },
      { name: "IX_IotIntegrationEvent_Target", columns: ["RigId", "TargetSystem", "EventType"] },
    ],
    checks: [
      ck("CK_IotIntegrationEvent_Target", "TargetSystem IN ('cmms','mes','pmis')", ["TargetSystem"]),
      ck("CK_IotIntegrationEvent_Status", "Status IN ('pending','dispatched','failed','dead-letter')", ["Status"]),
      ck("CK_IotIntegrationEvent_Contract", "Contract IN ('iiot-cmms-v1','iiot-mes-v1','iiot-pmis-v1')", ["Contract"]),
      ck("CK_IotIntegrationEvent_Attempts", "Attempts >= 0 AND Attempts <= MaxAttempts", ["Attempts", "MaxAttempts"]),
    ],
  },

  /* 14 — عکس وضعیت تجهیزات/محیطی برای نگهداری مبتنی بر وضعیت (CBM).
   * خوراک `CmmsConditionReading` است؛ `CmmsAssetRef` و `CmmsReadingRef` ارجاع
   * نرم‌اند، پس این جدول هیچ FK به CMMS ندارد. مناطق A تا D مطابق ISO 10816. */
  {
    name: "IotConditionSnapshot", module: "iiot", title: { fa: "عکس پایش وضعیت", en: "Condition monitoring snapshot" }, pk: "Id",
    columns: [
      id(), rig(),
      c("CmmsAssetRef", "text", { len: 60, comment: "ارجاع نرم به CmmsAsset — بدون FK" }),
      c("SensorTag", "text", { len: 60 }),
      req("ReadingType", "text", { len: 24, comment: "vibration|temperature|humidity|pressure|current|gas|flow" }),
      reqNum("Value", 18, 6), req("Uom", "text", { len: 24 }),
      c("Zone", "text", { len: 12, comment: "A|B|C|D — منطقهٔ ISO 10816" }),
      req("MeasuredAt", "datetime"), req("MeasuredOn", "date"),
      pct("HealthIndex"), c("TrendDirection", "text", { len: 16, comment: "rising|falling|stable" }),
      num("RateOfChange", 18, 6),
      req("Source", "text", { len: 16, default: "'iiot'", comment: "iiot|manual|scada|portable" }),
      req("ReportedToCmms", "bool", { default: "0" }), c("CmmsReadingRef", "text", { len: 80 }),
      hardRef("AlertId"),
      note(),
    ],
    indexes: [
      { name: "IX_IotConditionSnapshot_Rig", columns: ["RigId", "MeasuredOn"] },
      { name: "IX_IotConditionSnapshot_Asset", columns: ["CmmsAssetRef", "MeasuredAt"] },
      { name: "IX_IotConditionSnapshot_Zone", columns: ["RigId", "Zone", "MeasuredOn"] },
    ],
    foreignKeys: [
      { column: "AlertId", refTable: "IotTelemetryAlert", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_IotConditionSnapshot_Zone", "Zone IS NULL OR Zone IN ('A','B','C','D')", ["Zone"]),
      ck("CK_IotConditionSnapshot_Trend", "TrendDirection IS NULL OR TrendDirection IN ('rising','falling','stable')", ["TrendDirection"]),
      ck("CK_IotConditionSnapshot_Source", "Source IN ('iiot','manual','scada','portable')", ["Source"]),
      ck("CK_IotConditionSnapshot_Type", "ReadingType IN ('vibration','temperature','humidity','pressure','current','gas','flow')", ["ReadingType"]),
    ],
  },
];

/** نام جدول‌های IIoT — قفل آزمون اسکیمای ۰۰۵۹ و تولید مهاجرت. */
export const IIOT_TABLE_NAMES: string[] = IIOT_TABLES.map((t) => t.name);

/**
 * سه موجودیت هسته‌ای که پوستهٔ UI از فاز پیش آن‌ها را «برنامه‌ریزی‌شده»
 * نشان می‌داد و اکنون ساخته شده‌اند. برای آزمون و مستندسازی.
 */
export const IIOT_CORE_ENTITIES = Object.freeze([
  "IotDrillingRigStream",
  "IotDasChannel",
  "IotTelemetrySample",
] as const);
