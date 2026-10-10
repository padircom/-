/**
 * اسکیمای سامانهٔ نگهداری و تعمیرات و دارایی‌ها (CMMS / EAM / APM).
 *
 * سه تصمیم معماری که در سراسر این فایل رعایت شده‌اند:
 *
 * ۱) استقلال منطقی: نام فیزیکی همهٔ جدول‌ها با `Cmms` شروع می‌شود و
 *    `module: "cmms"` دارند. هیچ `foreignKeys` به جدول بیرونی (Mfg/Fin/Hrm/...)
 *    تعریف نمی‌شود؛ یکپارچگی بین‌بخشی با «شناسهٔ نرم» (ستون متنی آزاد) و در
 *    لایهٔ دامنه انجام می‌شود. آزمون `cmms.schema.test.mjs` این را اجبار می‌کند.
 *
 * ۲) افزودنی بودن: این فایل هیچ جدول یا ستون موجودی را تغییر نمی‌دهد؛ فقط
 *    آرایهٔ تازه‌ای صادر می‌کند که در `SCHEMA` الحاق می‌شود.
 *
 * ۳) انطباق با استاندارد: هر جدولی که ریشه در یک استاندارد بین‌المللی دارد،
 *    در کامنت خود نام آن استاندارد و بند مرتبط را می‌آورد (ISO 14224،
 *    IEC 60812، IEC 60300-3-3/-3-11، ISO 17359، IEEE 1366، BS EN 15341).
 *
 * ستون‌های حسابرسی (CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/RowVersion) از
 * `AUDIT_COLUMNS` در persistence.ts به‌طور خودکار افزوده می‌شوند و اینجا
 * اعلام نمی‌شوند — اعلام دستی‌شان خطای اعتبارسنجی اسکیما می‌دهد.
 */
import type { ColumnDef, TableDef } from "./persistence";

const c = (name: string, kind: ColumnDef["kind"], extra: Partial<ColumnDef> = {}): ColumnDef => ({ name, kind, nullable: true, ...extra });
const req = (name: string, kind: ColumnDef["kind"], extra: Partial<ColumnDef> = {}): ColumnDef => ({ name, kind, nullable: false, ...extra });
const id = (): ColumnDef => req("Id", "text", { len: 60 });
const hardRef = (name: string): ColumnDef => req(name, "text", { len: 60 });
const qty = (name: string, nullable = false): ColumnDef => ({ name, kind: "decimal", precision: 18, scale: 4, nullable });
const hrs = (name: string, nullable = false): ColumnDef => ({ name, kind: "decimal", precision: 12, scale: 3, nullable });
const money = (name: string, nullable = true): ColumnDef => ({ name, kind: "decimal", precision: 18, scale: 2, nullable });
const num = (name: string, precision = 18, scale = 6, nullable = true): ColumnDef => ({ name, kind: "decimal", precision, scale, nullable });
const ck = (name: string, expression: string, columns: string[]) => ({ name, expression, columns });

/**
 * دامنهٔ اصلی نت، «سایت/مجتمع» است نه پروژه. دلیلش این است که یک دارایی
 * فیزیکی عمری ده‌ساله دارد ولی ممکن است در عمرش زیر چند قرارداد و پروژهٔ
 * مختلف سرویس شود؛ پس کلید دامنه باید از چرخهٔ پروژه مستقل باشد.
 */
const site = () => req("SiteId", "text", { len: 60, comment: "دامنهٔ اصلی نت؛ مستقل از ProjectId و PlantId تولید" });
const code = (name = "Code") => req(name, "text", { len: 60 });
const note = (name = "NoteFa", len = 1000) => c(name, "text", { len });
/** نسخهٔ مدل دامنه؛ برای ردیابی تغییر الگوریتم در خروجی‌های محاسباتی. */
const modelVersion = () => c("ModelVersion", "text", { len: 40, comment: "cmms-v1" });

/** جدول‌های منطقی CMMS — همه در ماژول مستقل `cmms` ثبت می‌شوند. */
export const CMMS_TABLES: TableDef[] = [
  /* ═══════════════ الف) رجیستری سایت و مکان ═══════════════ */

  /* 01 — سایت/مجتمع. همان کاری برای CMMS می‌کند که MfgPlant برای تولید:
     مالکِ شناسهٔ دامنه می‌شود تا SiteId دیگر یک رشتهٔ بی‌صاحب نباشد. */
  {
    name: "CmmsSite", module: "cmms", title: { fa: "سایت و مجتمع بهره‌برداری", en: "Operating site" }, pk: "Id",
    columns: [
      id(), site(), code("SiteCode"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("SiteType", "text", { len: 24, comment: "plant|refinery|power|drilling|utility|workshop|office" }),
      c("PolicyStatementFa", "text", { len: 2000, comment: "خط‌مشی مدیریت دارایی — بند ۵.۲ ISO 55001" }),
      c("TimeZoneId", "text", { len: 80, default: "'Asia/Tehran'" }), c("Currency", "text", { len: 8, default: "'IRR'" }),
      c("BaseYear", "int", { comment: "سال مبنای محاسبهٔ LCC و شاخص‌ها" }),
      req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsSite_SiteId", columns: ["SiteId"], unique: true },
      { name: "UX_CmmsSite_Code", columns: ["SiteId", "SiteCode"], unique: true },
      { name: "IX_CmmsSite_Type", columns: ["SiteType", "IsActive"] },
    ],
    checks: [
      ck("CK_CmmsSite_Type", "SiteType IN ('plant','refinery','power','drilling','utility','workshop','office')", ["SiteType"]),
      ck("CK_CmmsSite_Year", "BaseYear IS NULL OR (BaseYear >= 1900 AND BaseYear <= 2200)", ["BaseYear"]),
    ],
  },

  /* 02 — ساختار درختی مکان و جانمایی جغرافیایی (ماژول ۵ و ۱۳ عملیاتی).
     ParentLocationId ارجاع به خود است؛ حلقه با پیمایش گراف در لایهٔ دامنه رد می‌شود. */
  {
    name: "CmmsLocation", module: "cmms", title: { fa: "مکان و ساختار درختی استقرار", en: "Location hierarchy" }, pk: "Id",
    columns: [
      id(), site(), code("LocationCode"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("Level", "int", { comment: "۱=سایت، ۲=ناحیه، ۳=واحد، ۴=بخش، ۵=محل نصب" }),
      c("ParentLocationId", "text", { len: 60 }), c("PathCode", "text", { len: 400, comment: "مسیر کد از ریشه؛ جداکننده '/'" }),
      num("Latitude", 12, 8), num("Longitude", 12, 8), c("GeoAccuracyMeters", "int"),
      c("ZoneClassification", "text", { len: 40, comment: "طبقه‌بندی ناحیه؛ مثلاً ATEX Zone 1 یا منطقهٔ بهداشتی" }),
      c("IsHazardousArea", "bool", { default: "0" }), req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsLocation_Code", columns: ["SiteId", "LocationCode"], unique: true },
      { name: "IX_CmmsLocation_Parent", columns: ["SiteId", "ParentLocationId"] },
      { name: "IX_CmmsLocation_Level", columns: ["SiteId", "Level", "IsActive"] },
    ],
    foreignKeys: [{ column: "ParentLocationId", refTable: "CmmsLocation", refColumn: "Id", onDelete: "NO ACTION" }],
    checks: [
      ck("CK_CmmsLocation_Level", "Level BETWEEN 1 AND 9", ["Level"]),
      ck("CK_CmmsLocation_Self", "ParentLocationId IS NULL OR ParentLocationId <> Id", ["ParentLocationId"]),
      ck("CK_CmmsLocation_Lat", "Latitude IS NULL OR (Latitude >= -90 AND Latitude <= 90)", ["Latitude"]),
      ck("CK_CmmsLocation_Lon", "Longitude IS NULL OR (Longitude >= -180 AND Longitude <= 180)", ["Longitude"]),
    ],
  },

  /* ═══════════════ ب) خانوادهٔ تجهیز — ساختار ۱۳گانهٔ PMworks ═══════════════ */

  /* 03 — (۱) گروه خانواده: بالاترین سطح دسته‌بندی (مثلاً «دوار»، «استاتیک»، «ابزار دقیق»). */
  {
    name: "CmmsFamilyGroup", module: "cmms", title: { fa: "گروه خانوادهٔ تجهیزات", en: "Equipment family group" }, pk: "Id",
    columns: [
      id(), site(), code("GroupCode"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("EquipmentClass", "text", { len: 40, comment: "کلاس تجهیز بر اساس ISO 14224 بند ۸ (مثلاً PUMP، COMPRESSOR)" }),
      c("Discipline", "text", { len: 40, comment: "mechanical|electrical|instrument|civil|rotating|static" }),
      req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsFamilyGroup_Code", columns: ["SiteId", "GroupCode"], unique: true },
      { name: "IX_CmmsFamilyGroup_Class", columns: ["SiteId", "EquipmentClass", "IsActive"] },
    ],
    checks: [
      ck("CK_CmmsFamilyGroup_Discipline",
        "Discipline IS NULL OR Discipline IN ('mechanical','electrical','instrument','civil','rotating','static')",
        ["Discipline"]),
    ],
  },

  /* 04 — (۲) الگوی خانوادهٔ تجهیز: قالب مشترکی که همهٔ تجهیزات هم‌خانواده از آن ارث می‌برند. */
  {
    name: "CmmsFamily", module: "cmms", title: { fa: "الگوی خانوادهٔ تجهیز", en: "Equipment family template" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyGroupId"), code("FamilyCode"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      c("Manufacturer", "text", { len: 240 }), c("ModelSeries", "text", { len: 160 }),
      req("CriticalityRank", "text", { len: 16, default: "'C'", comment: "A=بحرانی B=مهم C=عادی D=کم‌اهمیت" }),
      req("DefaultStrategy", "text", { len: 28, default: "'pm'", comment: "pm|cbm|predictive|risk-based|run-to-failure|zero-breakdown" }),
      req("Version", "int", { default: "1" }), req("IsTemplate", "bool", { default: "0", comment: "۱ یعنی الگوی والد برای کپی‌گرفتن" }),
      req("Status", "text", { len: 24, default: "'draft'", comment: "draft|approved|obsolete" }),
      c("ApprovedAt", "datetime"), c("ApprovedBy", "text", { len: 60 }), note(),
    ],
    indexes: [
      { name: "UX_CmmsFamily_Code", columns: ["SiteId", "FamilyCode"], unique: true },
      { name: "IX_CmmsFamily_Group", columns: ["SiteId", "FamilyGroupId", "Status"] },
      { name: "IX_CmmsFamily_Criticality", columns: ["SiteId", "CriticalityRank", "Status"] },
    ],
    foreignKeys: [{ column: "FamilyGroupId", refTable: "CmmsFamilyGroup", refColumn: "Id" }],
    checks: [
      ck("CK_CmmsFamily_Criticality", "CriticalityRank IN ('A','B','C','D')", ["CriticalityRank"]),
      ck("CK_CmmsFamily_Strategy",
        "DefaultStrategy IN ('pm','cbm','predictive','risk-based','run-to-failure','zero-breakdown')",
        ["DefaultStrategy"]),
      ck("CK_CmmsFamily_Status", "Status IN ('draft','approved','obsolete')", ["Status"]),
      ck("CK_CmmsFamily_Approve", "Status <> 'approved' OR ApprovedAt IS NOT NULL", ["Status", "ApprovedAt"]),
      ck("CK_CmmsFamily_Version", "Version >= 1", ["Version"]),
    ],
  },

  /* 05 — (۳) ساختار درختی خانواده: مرز تجهیز و اجزای آن، منطبق بر
     ISO 14224 بند ۶ (تجهیز ← زیرواحد ← قطعهٔ قابل نگهداری). */
  {
    name: "CmmsFamilyNode", module: "cmms", title: { fa: "گره درخت خانوادهٔ تجهیز", en: "Family tree node" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), code("NodeCode"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("BoundaryLevel", "text", { len: 24, comment: "equipment|sub-unit|component|maintenance-item — ISO 14224" }),
      c("ParentNodeId", "text", { len: 60 }), req("PathLevel", "int", { default: "1", comment: "عمق گره از ریشه" }),
      c("PathCode", "text", { len: 400 }), c("Iso14224Code", "text", { len: 120, comment: "کد تاکسونومی استاندارد" }),
      req("IsMaintainable", "bool", { default: "1", comment: "۱ یعنی قطعهٔ قابل نگهداری/تعویض است" }),
      req("IsCriticalPart", "bool", { default: "0" }), c("TechnicalSpecFa", "text", { len: 1200 }),
      req("SortOrder", "int", { default: "0" }),
    ],
    indexes: [
      { name: "UX_CmmsFamilyNode_Code", columns: ["FamilyId", "NodeCode"], unique: true },
      { name: "IX_CmmsFamilyNode_Parent", columns: ["FamilyId", "ParentNodeId"] },
      { name: "IX_CmmsFamilyNode_Boundary", columns: ["SiteId", "BoundaryLevel", "IsMaintainable"] },
    ],
    foreignKeys: [
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "ParentNodeId", refTable: "CmmsFamilyNode", refColumn: "Id", onDelete: "NO ACTION" },
    ],
    checks: [
      ck("CK_CmmsFamilyNode_Boundary",
        "BoundaryLevel IN ('equipment','sub-unit','component','maintenance-item')", ["BoundaryLevel"]),
      ck("CK_CmmsFamilyNode_Self", "ParentNodeId IS NULL OR ParentNodeId <> Id", ["ParentNodeId"]),
      ck("CK_CmmsFamilyNode_Level", "PathLevel >= 1", ["PathLevel"]),
    ],
  },

  /* 06 — (۴) پروفایل جامع خانواده: داده‌های فنی و بهره‌برداری یک‌جا. */
  {
    name: "CmmsFamilyProfile", module: "cmms", title: { fa: "پروفایل جامع خانوادهٔ تجهیز", en: "Family technical profile" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), req("ProfileKey", "text", { len: 80, comment: "کلید یکتای بخش پروفایل" }),
      req("CategoryFa", "text", { len: 160 }), c("ContentFa", "text", { len: 4000 }), c("ContentEn", "text", { len: 4000 }),
      c("ReferenceStandard", "text", { len: 200, comment: "استاندارد مرجع؛ مثلاً API 610 یا IEC 60034" }),
      c("Uom", "text", { len: 24 }), req("SortOrder", "int", { default: "0" }), req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_CmmsFamilyProfile_Key", columns: ["FamilyId", "ProfileKey"], unique: true },
      { name: "IX_CmmsFamilyProfile_Category", columns: ["SiteId", "IsActive", "SortOrder"] },
    ],
    foreignKeys: [{ column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" }],
  },

  /* 07 — (۵) پارامترهای کارکردی: ساعات کار، کیلومتر، تعداد ضربه، سیکل.
     مبنای PM کارکردمحور و محاسبهٔ MTBF واقعی (نه تقویمی). */
  {
    name: "CmmsFamilyOperatingParam", module: "cmms", title: { fa: "پارامتر کارکردی خانواده", en: "Family operating parameter" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), code("ParamCode"), req("NameFa", "text", { len: 240 }),
      req("ParamType", "text", { len: 28, comment: "running_hours|odometer|stroke_count|cycle_count|throughput|start_count" }),
      req("Uom", "text", { len: 24 }), qty("NominalRatePerHour", true), qty("WarnLimit", true), qty("AlarmLimit", true),
      req("IsPmDriver", "bool", { default: "0", comment: "۱ یعنی محرک برنامهٔ PM است" }),
      req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsFamilyOperatingParam_Code", columns: ["FamilyId", "ParamCode"], unique: true },
      { name: "IX_CmmsFamilyOperatingParam_Driver", columns: ["SiteId", "IsPmDriver", "IsActive"] },
    ],
    foreignKeys: [{ column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsFamilyOperatingParam_Type",
        "ParamType IN ('running_hours','odometer','stroke_count','cycle_count','throughput','start_count')", ["ParamType"]),
      ck("CK_CmmsFamilyOperatingParam_Limits",
        "AlarmLimit IS NULL OR WarnLimit IS NULL OR AlarmLimit > WarnLimit", ["WarnLimit", "AlarmLimit"]),
    ],
  },

  /* 08 — (۶) پارامترهای پایش وضعیت (CBM) — ISO 17359: دما، ارتعاش، روغن، جریان. */
  {
    name: "CmmsFamilyConditionParam", module: "cmms", title: { fa: "پارامتر پایش وضعیت خانواده", en: "Family condition parameter" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), code("ParamCode"), req("NameFa", "text", { len: 240 }),
      req("Technique", "text", { len: 28, comment: "vibration|thermal|oil_analysis|ultrasonic|motor_current|performance|visual" }),
      req("Uom", "text", { len: 24 }), c("MeasurementPoint", "text", { len: 120, comment: "نقطهٔ اندازه‌گیری؛ مثلاً بلبرینگ سمت درایو — عمودی" }),
      num("BaselineValue", 18, 4), num("AlertLimit", 18, 4), num("AlarmLimit", 18, 4), num("TripLimit", 18, 4),
      num("SamplingIntervalHours", 12, 2, true), req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsFamilyConditionParam_Code", columns: ["FamilyId", "ParamCode"], unique: true },
      { name: "IX_CmmsFamilyConditionParam_Tech", columns: ["SiteId", "Technique", "IsActive"] },
    ],
    foreignKeys: [{ column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsFamilyConditionParam_Tech",
        "Technique IN ('vibration','thermal','oil_analysis','ultrasonic','motor_current','performance','visual')", ["Technique"]),
      ck("CK_CmmsFamilyConditionParam_Limits",
        "AlarmLimit IS NULL OR AlertLimit IS NULL OR AlarmLimit >= AlertLimit", ["AlertLimit", "AlarmLimit"]),
      ck("CK_CmmsFamilyConditionParam_Trip",
        "TripLimit IS NULL OR AlarmLimit IS NULL OR TripLimit >= AlarmLimit", ["AlarmLimit", "TripLimit"]),
    ],
  },

  /* 09 — (۷) حالات خرابی استاندارد خانواده بر اساس ISO 14224 بند ۹.
     FailureMode از فهرست ۹گانهٔ استاندارد انتخاب می‌شود و Mechanism فهرست
     مکانیزم‌های فرسایش/خوردگی/خستگی و ... را می‌پوشاند. */
  {
    name: "CmmsFamilyFailureMode", module: "cmms", title: { fa: "حالت خرابی استاندارد خانواده", en: "Family failure mode (ISO 14224)" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), c("FamilyNodeId", "text", { len: 60 }), code("FailureModeCode"),
      req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("FailureMode", "text", { len: 40, comment: "ISO 14224: fail-to-start|fail-to-function|fail-to-stop|abnormal-start|abnormal-shutdown|erratic-output|reduced-output|excessive-output|spurious-output|leakage|structural" }),
      req("FailureMechanism", "text", { len: 40, comment: "wear|corrosion|fatigue|overload|fouling|misalignment|imbalance|lubrication|electrical|seal|thermal|vibration|other" }),
      c("DetectionMethod", "text", { len: 120, comment: "روش کشف — ISO 14224 بند ۹.۴" }),
      c("EffectDescriptionFa", "text", { len: 1200 }),
      req("SeverityClass", "int", { default: "2", comment: "۱..۵ — ورودی FMEA طبق IEC 60812" }),
      req("OccurrenceClass", "int", { default: "2" }), req("DetectionClass", "int", { default: "2" }),
      req("CriticalityRank", "text", { len: 16, default: "'C'" }),
      req("IsHiddenFailure", "bool", { default: "0", comment: "ورودی کلیدی منطق RCM — IEC 60300-3-11" }),
      req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsFamilyFailureMode_Code", columns: ["FamilyId", "FailureModeCode"], unique: true },
      { name: "IX_CmmsFamilyFailureMode_Mode", columns: ["SiteId", "FailureMode", "IsActive"] },
      { name: "IX_CmmsFamilyFailureMode_Node", columns: ["FamilyId", "FamilyNodeId"] },
    ],
    foreignKeys: [
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyNodeId", refTable: "CmmsFamilyNode", refColumn: "Id", onDelete: "NO ACTION" },
    ],
    checks: [
      ck("CK_CmmsFamilyFailureMode_Mode",
        "FailureMode IN ('fail-to-start','fail-to-function','fail-to-stop','abnormal-start','abnormal-shutdown','erratic-output','reduced-output','excessive-output','spurious-output','leakage','structural')",
        ["FailureMode"]),
      ck("CK_CmmsFamilyFailureMode_Mechanism",
        "FailureMechanism IN ('wear','corrosion','fatigue','overload','fouling','misalignment','imbalance','lubrication','electrical','seal','thermal','vibration','other')",
        ["FailureMechanism"]),
      ck("CK_CmmsFamilyFailureMode_Severity", "SeverityClass BETWEEN 1 AND 5", ["SeverityClass"]),
      ck("CK_CmmsFamilyFailureMode_Occurrence", "OccurrenceClass BETWEEN 1 AND 5", ["OccurrenceClass"]),
      ck("CK_CmmsFamilyFailureMode_Detection", "DetectionClass BETWEEN 1 AND 5", ["DetectionClass"]),
    ],
  },

  /* 10 — (۸) آرشیو فنی خانواده: نقشه‌ها، کاتالوگ‌ها و اسناد مرجع مشترک. */
  {
    name: "CmmsFamilyDocument", module: "cmms", title: { fa: "آرشیو فنی خانواده", en: "Family technical archive" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), code("DocCode"), req("TitleFa", "text", { len: 300 }),
      req("DocType", "text", { len: 28, comment: "drawing|catalog|manual|datasheet|certificate|sop|procedure|photo|other" }),
      c("Revision", "text", { len: 40 }), c("StoragePath", "text", { len: 600 }), c("FileFormat", "text", { len: 20 }),
      c("FileSizeBytes", "bigint"), c("IssuedBy", "text", { len: 240 }), c("IssuedOn", "date"),
      c("ExpiresOn", "date"), req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsFamilyDocument_Code", columns: ["FamilyId", "DocCode", "Revision"], unique: true },
      { name: "IX_CmmsFamilyDocument_Type", columns: ["SiteId", "DocType", "IsActive"] },
    ],
    foreignKeys: [{ column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsFamilyDocument_Type",
        "DocType IN ('drawing','catalog','manual','datasheet','certificate','sop','procedure','photo','other')", ["DocType"]),
      ck("CK_CmmsFamilyDocument_Size", "FileSizeBytes IS NULL OR FileSizeBytes >= 0", ["FileSizeBytes"]),
      ck("CK_CmmsFamilyDocument_Dates", "ExpiresOn IS NULL OR IssuedOn IS NULL OR ExpiresOn >= IssuedOn", ["IssuedOn", "ExpiresOn"]),
    ],
  },

  /* 11 — (۹) فعالیت‌های نگهداشت و چک‌لیست استاندارد PM تعریف‌شده در سطح خانواده. */
  {
    name: "CmmsFamilyPmTask", module: "cmms", title: { fa: "فعالیت نگهداشت خانواده", en: "Family PM task" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), c("FamilyNodeId", "text", { len: 60 }), code("TaskCode"), req("NameFa", "text", { len: 300 }),
      req("TaskType", "text", { len: 28, comment: "inspection|lubrication|adjustment|cleaning|replacement|overhaul|test|calibration" }),
      req("StrategyType", "text", { len: 24, default: "'pm'", comment: "pm|cbm|predictive|run-to-failure — خروجی RCM" }),
      qty("StandardMinutes", true), req("TradeSkill", "text", { len: 60, comment: "مهارت مورد نیاز؛ مثلاً mechanic|electrician|instrument" }),
      c("ToolRequired", "text", { len: 400 }), c("SafetyRequirementFa", "text", { len: 1000 }),
      num("IntervalValue", 18, 4), c("IntervalUnit", "text", { len: 24, comment: "hours|days|weeks|months|cycles|km" }),
      req("IsMandatory", "bool", { default: "1" }), req("SortOrder", "int", { default: "0" }), req("IsActive", "bool", { default: "1" }),
      note("InstructionFa", 2000),
    ],
    indexes: [
      { name: "UX_CmmsFamilyPmTask_Code", columns: ["FamilyId", "TaskCode"], unique: true },
      { name: "IX_CmmsFamilyPmTask_Strategy", columns: ["SiteId", "StrategyType", "IsActive"] },
    ],
    foreignKeys: [
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyNodeId", refTable: "CmmsFamilyNode", refColumn: "Id", onDelete: "NO ACTION" },
    ],
    checks: [
      ck("CK_CmmsFamilyPmTask_Type",
        "TaskType IN ('inspection','lubrication','adjustment','cleaning','replacement','overhaul','test','calibration')", ["TaskType"]),
      ck("CK_CmmsFamilyPmTask_Strategy",
        "StrategyType IN ('pm','cbm','predictive','run-to-failure')", ["StrategyType"]),
      ck("CK_CmmsFamilyPmTask_Interval", "IntervalValue IS NULL OR IntervalValue > 0", ["IntervalValue"]),
      ck("CK_CmmsFamilyPmTask_Unit",
        "IntervalUnit IS NULL OR IntervalUnit IN ('hours','days','weeks','months','cycles','km')", ["IntervalUnit"]),
      ck("CK_CmmsFamilyPmTask_Minutes", "StandardMinutes IS NULL OR StandardMinutes >= 0", ["StandardMinutes"]),
    ],
  },

  /* 12 — ردیف‌های چک‌لیست یک فعالیت PM؛ خروجی اجرایی بند ۹ ساختار PMworks. */
  {
    name: "CmmsPmChecklistItem", module: "cmms", title: { fa: "ردیف چک‌لیست PM", en: "PM checklist item" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyPmTaskId"), code("ItemCode"), req("DescriptionFa", "text", { len: 600 }),
      req("InputType", "text", { len: 24, default: "'passfail'", comment: "passfail|numeric|text|select|measurement" }),
      c("ExpectedValue", "text", { len: 200 }), num("MinValue", 18, 4), num("MaxValue", 18, 4),
      c("Uom", "text", { len: 24 }), req("IsRequired", "bool", { default: "1" }), req("SortOrder", "int", { default: "0" }),
    ],
    indexes: [
      { name: "UX_CmmsPmChecklistItem_Code", columns: ["FamilyPmTaskId", "ItemCode"], unique: true },
      { name: "IX_CmmsPmChecklistItem_Order", columns: ["SiteId", "SortOrder"] },
    ],
    foreignKeys: [{ column: "FamilyPmTaskId", refTable: "CmmsFamilyPmTask", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsPmChecklistItem_Input", "InputType IN ('passfail','numeric','text','select','measurement')", ["InputType"]),
      ck("CK_CmmsPmChecklistItem_Range", "MaxValue IS NULL OR MinValue IS NULL OR MaxValue >= MinValue", ["MinValue", "MaxValue"]),
    ],
  },

  /* 13 — (۱۲) داده‌های ویژه و پویا: تعریف فیلد سفارشی در سطح خانواده. */
  {
    name: "CmmsFamilyCustomField", module: "cmms", title: { fa: "فیلد سفارشی خانواده", en: "Family dynamic custom field" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), code("FieldKey"), req("LabelFa", "text", { len: 200 }), c("LabelEn", "text", { len: 200 }),
      req("FieldType", "text", { len: 24, comment: "text|number|date|boolean|select" }),
      c("Unit", "text", { len: 24 }), c("OptionsJson", "json", { comment: "گزینه‌های select" }),
      c("DefaultValue", "text", { len: 400 }), req("IsRequired", "bool", { default: "0" }),
      req("AppliesTo", "text", { len: 24, default: "'asset'", comment: "asset|node|both" }),
      req("SortOrder", "int", { default: "0" }), req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_CmmsFamilyCustomField_Key", columns: ["FamilyId", "FieldKey"], unique: true },
      { name: "IX_CmmsFamilyCustomField_Type", columns: ["SiteId", "FieldType", "IsActive"] },
    ],
    foreignKeys: [{ column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsFamilyCustomField_Type", "FieldType IN ('text','number','date','boolean','select')", ["FieldType"]),
      ck("CK_CmmsFamilyCustomField_Scope", "AppliesTo IN ('asset','node','both')", ["AppliesTo"]),
    ],
  },

  /* 14 — (۱۳) مدیریت کلان: اعمال تغییر همگانی روی اعضای خانواده با ثبت دامنهٔ اثر. */
  {
    name: "CmmsFamilyBulkChange", module: "cmms", title: { fa: "تغییر همگانی روی خانواده", en: "Family-wide bulk change" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), req("ChangeKind", "text", { len: 28, comment: "pm-interval|failure-mode|checklist|custom-field|node|document|strategy" }),
      req("TargetField", "text", { len: 120 }), req("NewValueJson", "json"),
      req("AffectedAssetCount", "int", { default: "0" }), c("ReasonFa", "text", { len: 1000 }),
      req("Status", "text", { len: 24, default: "'pending'", comment: "pending|approved|applied|rolled-back|rejected" }),
      c("RequestedBy", "text", { len: 60 }), c("ApprovedBy", "text", { len: 60 }),
      c("AppliedAt", "datetime"), c("RollbackOfId", "text", { len: 60 }),
    ],
    indexes: [
      { name: "IX_CmmsFamilyBulkChange_Family", columns: ["SiteId", "FamilyId", "Status"] },
      { name: "IX_CmmsFamilyBulkChange_Kind", columns: ["SiteId", "ChangeKind", "Status"] },
    ],
    foreignKeys: [{ column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsFamilyBulkChange_Kind",
        "ChangeKind IN ('pm-interval','failure-mode','checklist','custom-field','node','document','strategy')", ["ChangeKind"]),
      ck("CK_CmmsFamilyBulkChange_Status",
        "Status IN ('pending','approved','applied','rolled-back','rejected')", ["Status"]),
      ck("CK_CmmsFamilyBulkChange_Count", "AffectedAssetCount >= 0", ["AffectedAssetCount"]),
    ],
  },

  /* ═══════════════ ج) منابع: تأمین‌کننده، تکنسین، ابزار و قطعات ═══════════════ */

  /* 15 — تأمین‌کنندگان و پیمانکاران نت (ماژول ۱۲ عملیاتی). */
  {
    name: "CmmsVendor", module: "cmms", title: { fa: "تأمین‌کننده و پیمانکار نت", en: "Maintenance vendor" }, pk: "Id",
    columns: [
      id(), site(), code("VendorCode"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("VendorType", "text", { len: 24, comment: "oem|supplier|contractor|service|calibration-lab" }),
      c("ContactName", "text", { len: 160 }), c("ContactPhone", "text", { len: 60 }), c("ContactEmail", "text", { len: 200 }),
      c("NationalId", "text", { len: 40 }), req("Currency", "text", { len: 8, default: "'IRR'" }),
      req("IsApproved", "bool", { default: "0" }), c("ApprovedOn", "date"), c("QualificationExpiresOn", "date"),
      num("RatingScore", 6, 2, true), req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsVendor_Code", columns: ["SiteId", "VendorCode"], unique: true },
      { name: "IX_CmmsVendor_Type", columns: ["SiteId", "VendorType", "IsApproved"] },
    ],
    checks: [
      ck("CK_CmmsVendor_Type", "VendorType IN ('oem','supplier','contractor','service','calibration-lab')", ["VendorType"]),
      ck("CK_CmmsVendor_Rating", "RatingScore IS NULL OR (RatingScore >= 0 AND RatingScore <= 100)", ["RatingScore"]),
    ],
  },

  /* 16 — تجهیز فیزیکی (ماژول ۱ عملیاتی). ستون‌های FamilyId و LocationId
     ارجاع سخت درون‌ماژولی‌اند؛ ParentAssetId درخت تجهیز را می‌سازد و
     MfgWorkCenterId/ScmWarehouseId عمداً «ارجاع نرم» هستند تا استقلال حفظ شود. */
  {
    name: "CmmsAsset", module: "cmms", title: { fa: "تجهیز و دارایی فیزیکی", en: "Physical asset" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), code("AssetTag"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      c("ParentAssetId", "text", { len: 60 }), c("LocationId", "text", { len: 60 }),
      c("SerialNumber", "text", { len: 120 }), c("Manufacturer", "text", { len: 240 }), c("Model", "text", { len: 160 }),
      req("AssetState", "text", { len: 28, default: "'commissioned'", comment: "planned|installed|commissioned|operating|standby|under-maintenance|degraded|retired|disposed" }),
      req("CriticalityRank", "text", { len: 16, default: "'C'" }), c("VendorId", "text", { len: 60 }),
      c("CommissionedOn", "date"), c("InstalledOn", "date"), c("WarrantyExpiresOn", "date"),
      money("AcquisitionCost"), c("Currency", "text", { len: 8, default: "'IRR'" }),
      num("ExpectedLifeYears", 8, 2, true), c("MfgWorkCenterId", "text", { len: 60, comment: "ارجاع نرم به مرکز کاری تولید؛ بدون FK" }),
      c("ScmWarehouseId", "text", { len: 60, comment: "ارجاع نرم به انبار SCM؛ بدون FK" }),
      req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsAsset_Tag", columns: ["SiteId", "AssetTag"], unique: true },
      { name: "IX_CmmsAsset_Family", columns: ["SiteId", "FamilyId", "AssetState"] },
      { name: "IX_CmmsAsset_Parent", columns: ["SiteId", "ParentAssetId"] },
      { name: "IX_CmmsAsset_Location", columns: ["SiteId", "LocationId"] },
      { name: "IX_CmmsAsset_Criticality", columns: ["SiteId", "CriticalityRank", "IsActive"] },
    ],
    foreignKeys: [
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id" },
      { column: "ParentAssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "NO ACTION" },
      { column: "LocationId", refTable: "CmmsLocation", refColumn: "Id", onDelete: "SET NULL" },
      { column: "VendorId", refTable: "CmmsVendor", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsAsset_State",
        "AssetState IN ('planned','installed','commissioned','operating','standby','under-maintenance','degraded','retired','disposed')", ["AssetState"]),
      ck("CK_CmmsAsset_Criticality", "CriticalityRank IN ('A','B','C','D')", ["CriticalityRank"]),
      ck("CK_CmmsAsset_Self", "ParentAssetId IS NULL OR ParentAssetId <> Id", ["ParentAssetId"]),
      ck("CK_CmmsAsset_Cost", "AcquisitionCost IS NULL OR AcquisitionCost >= 0", ["AcquisitionCost"]),
      ck("CK_CmmsAsset_Life", "ExpectedLifeYears IS NULL OR ExpectedLifeYears > 0", ["ExpectedLifeYears"]),
    ],
  },

  /* 17 — (۱۰) انتساب تجهیز فیزیکی به خانواده با تاریخچهٔ تغییر خانواده. */
  {
    name: "CmmsAssetFamilyAssignment", module: "cmms", title: { fa: "انتساب تجهیز به خانواده", en: "Asset-to-family assignment" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), hardRef("AssetId"), req("EffectiveFrom", "date"), c("EffectiveTo", "date"),
      req("IsPrimary", "bool", { default: "1", comment: "۱ یعنی خانوادهٔ اصلی تجهیز برای ارث‌بری الگو" }),
      req("InheritPmTasks", "bool", { default: "1" }), req("InheritFailureModes", "bool", { default: "1" }),
      req("InheritCustomFields", "bool", { default: "1" }), c("ReasonFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_CmmsAssetFamilyAssignment_Pair", columns: ["AssetId", "FamilyId", "EffectiveFrom"], unique: true },
      { name: "IX_CmmsAssetFamilyAssignment_Family", columns: ["SiteId", "FamilyId", "IsPrimary"] },
    ],
    foreignKeys: [
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_CmmsAssetFamilyAssignment_Dates", "EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom", ["EffectiveFrom", "EffectiveTo"]),
    ],
  },

  /* 18 — (۱۱) آرشیو فنی اختصاصی هر تجهیز فیزیکی. */
  {
    name: "CmmsAssetDocument", module: "cmms", title: { fa: "آرشیو فنی تجهیز", en: "Asset technical archive" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), code("DocCode"), req("TitleFa", "text", { len: 300 }),
      req("DocType", "text", { len: 28, comment: "drawing|catalog|manual|datasheet|certificate|sop|procedure|photo|test-report|other" }),
      c("Revision", "text", { len: 40 }), c("StoragePath", "text", { len: 600 }), c("FileFormat", "text", { len: 20 }),
      c("FileSizeBytes", "bigint"), c("InheritedFromFamilyDocumentId", "text", { len: 60 }),
      c("IssuedOn", "date"), c("ExpiresOn", "date"), req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsAssetDocument_Code", columns: ["AssetId", "DocCode", "Revision"], unique: true },
      { name: "IX_CmmsAssetDocument_Type", columns: ["SiteId", "DocType", "IsActive"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "InheritedFromFamilyDocumentId", refTable: "CmmsFamilyDocument", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsAssetDocument_Type",
        "DocType IN ('drawing','catalog','manual','datasheet','certificate','sop','procedure','photo','test-report','other')", ["DocType"]),
      ck("CK_CmmsAssetDocument_Dates", "ExpiresOn IS NULL OR IssuedOn IS NULL OR ExpiresOn >= IssuedOn", ["IssuedOn", "ExpiresOn"]),
    ],
  },

  /* 19 — مقادیر فیلدهای پویای یک تجهیز؛ جفتِ تعریف در CmmsFamilyCustomField. */
  {
    name: "CmmsAssetCustomValue", module: "cmms", title: { fa: "مقدار فیلد پویای تجهیز", en: "Asset dynamic field value" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), hardRef("FamilyCustomFieldId"), c("AssetNodeId", "text", { len: 60 }),
      req("ValueText", "text", { len: 1000 }), num("ValueNumber", 18, 6), c("ValueDate", "date"), c("ValueBool", "bool"),
      c("MeasuredOn", "datetime"), c("Source", "text", { len: 40, comment: "manual|import|sensor|ai-tree-generator" }),
    ],
    indexes: [
      { name: "UX_CmmsAssetCustomValue_Key", columns: ["AssetId", "FamilyCustomFieldId", "AssetNodeId"], unique: true },
      { name: "IX_CmmsAssetCustomValue_Field", columns: ["SiteId", "FamilyCustomFieldId"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyCustomFieldId", refTable: "CmmsFamilyCustomField", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_CmmsAssetCustomValue_Source",
        "Source IS NULL OR Source IN ('manual','import','sensor','ai-tree-generator')", ["Source"]),
    ],
  },

  /* 20 — بارکد و QR تجهیز (ماژول ۲۰ عملیاتی). */
  {
    name: "CmmsAssetBarcode", module: "cmms", title: { fa: "بارکد و QR تجهیز", en: "Asset barcode and QR" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), req("BarcodeValue", "text", { len: 120 }),
      req("BarcodeType", "text", { len: 24, default: "'qr'", comment: "qr|code128|ean13|datamatrix|rfid" }),
      c("PrintedLabel", "text", { len: 120 }), c("PrintedOn", "date"), c("PrintedBy", "text", { len: 60 }),
      req("IsPrimary", "bool", { default: "0" }), req("IsActive", "bool", { default: "1" }),
      c("LastScannedAt", "datetime"), c("LastScannedBy", "text", { len: 60 }),
    ],
    indexes: [
      { name: "UX_CmmsAssetBarcode_Value", columns: ["SiteId", "BarcodeValue"], unique: true },
      { name: "IX_CmmsAssetBarcode_Asset", columns: ["AssetId", "IsActive"] },
    ],
    foreignKeys: [{ column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsAssetBarcode_Type", "BarcodeType IN ('qr','code128','ean13','datamatrix','rfid')", ["BarcodeType"]),
      /* طول BarcodeValue عمداً اینجا CHECK نشده: LEN یک تابع صرفاً T-SQL است و
       * در هیچ CHECK دیگری از این اسکیمای مشترک (mssql + sqlite) به کار نرفته.
       * کمینهٔ طول در لایهٔ HTTP (server/cmmsApi.js) با MIN_BARCODE_LEN الزام می‌شود. */
    ],
  },

  /* 21 — رویدادهای چرخهٔ عمر دارایی — الزام رهگیری چرخهٔ عمر در ISO 55001. */
  {
    name: "CmmsAssetLifecycleEvent", module: "cmms", title: { fa: "رویداد چرخهٔ عمر دارایی", en: "Asset lifecycle event" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), req("EventKind", "text", { len: 28, comment: "acquired|installed|commissioned|transferred|modified|major-overhaul|degraded|retired|disposed" }),
      req("OccurredOn", "date"), c("OccurredAt", "datetime"), c("PreviousState", "text", { len: 28 }), c("NewState", "text", { len: 28 }),
      c("LocationId", "text", { len: 60 }), money("EventCost"), c("ReferenceDocId", "text", { len: 60 }),
      c("DescriptionFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "IX_CmmsAssetLifecycleEvent_Asset", columns: ["AssetId", "OccurredOn"] },
      { name: "IX_CmmsAssetLifecycleEvent_Kind", columns: ["SiteId", "EventKind"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "LocationId", refTable: "CmmsLocation", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsAssetLifecycleEvent_Kind",
        "EventKind IN ('acquired','installed','commissioned','transferred','modified','major-overhaul','degraded','retired','disposed')", ["EventKind"]),
    ],
  },

  /* 22 — تعریف کنتور کارکرد تجهیز (ساعات کار، کیلومتر، ضربه). */
  {
    name: "CmmsMeterDefinition", module: "cmms", title: { fa: "تعریف کنتور کارکرد", en: "Meter definition" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), c("FamilyOperatingParamId", "text", { len: 60 }), code("MeterCode"),
      req("NameFa", "text", { len: 240 }), req("Uom", "text", { len: 24 }),
      req("MeterType", "text", { len: 24, default: "'absolute'", comment: "absolute|delta" }),
      qty("InitialValue", true), qty("RollOverAt", true), c("ReadingSource", "text", { len: 40, comment: "manual|scada|iiot|erp" }),
      req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_CmmsMeterDefinition_Code", columns: ["AssetId", "MeterCode"], unique: true },
      { name: "IX_CmmsMeterDefinition_Asset", columns: ["SiteId", "AssetId", "IsActive"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyOperatingParamId", refTable: "CmmsFamilyOperatingParam", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsMeterDefinition_Type", "MeterType IN ('absolute','delta')", ["MeterType"]),
      ck("CK_CmmsMeterDefinition_Rollover", "RollOverAt IS NULL OR RollOverAt > 0", ["RollOverAt"]),
    ],
  },

  /* 23 — قرائت کنتور؛ مبنای PM کارکردمحور و MTBF واقعی. */
  {
    name: "CmmsMeterReading", module: "cmms", title: { fa: "قرائت کنتور کارکرد", en: "Meter reading" }, pk: "Id",
    columns: [
      id(), site(), hardRef("MeterDefinitionId"), hardRef("AssetId"), req("ReadAt", "datetime"), req("ReadOn", "date"),
      qty("Value"), qty("Delta", true), c("ReadBy", "text", { len: 60 }),
      req("Source", "text", { len: 24, default: "'manual'", comment: "manual|scada|iiot|erp" }),
      c("IsEstimated", "bool", { default: "0" }), c("WorkOrderId", "text", { len: 60 }),
    ],
    indexes: [
      { name: "UX_CmmsMeterReading_Reading", columns: ["MeterDefinitionId", "ReadAt"], unique: true },
      { name: "IX_CmmsMeterReading_Asset", columns: ["SiteId", "AssetId", "ReadOn"] },
    ],
    foreignKeys: [
      { column: "MeterDefinitionId", refTable: "CmmsMeterDefinition", refColumn: "Id", onDelete: "CASCADE" },
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_CmmsMeterReading_Value", "Value >= 0", ["Value"]),
      ck("CK_CmmsMeterReading_Delta", "Delta IS NULL OR Delta >= 0", ["Delta"]),
      ck("CK_CmmsMeterReading_Source", "Source IN ('manual','scada','iiot','erp')", ["Source"]),
    ],
  },

  /* 24 — تکنسین و نیروی انسانی نت (ماژول ۱۱ عملیاتی). */
  {
    name: "CmmsTechnician", module: "cmms", title: { fa: "تکنسین نگهداری", en: "Maintenance technician" }, pk: "Id",
    columns: [
      id(), site(), code("TechnicianCode"), req("FullNameFa", "text", { len: 240 }), c("FullNameEn", "text", { len: 240 }),
      c("NationalCode", "text", { len: 40 }), req("PrimaryTrade", "text", { len: 60, comment: "mechanic|electrician|instrument|welder|operator|planner|engineer" }),
      req("Grade", "text", { len: 24, default: "'junior'", comment: "apprentice|junior|senior|expert|master" }),
      c("CrewId", "text", { len: 60 }), num("StandardHourlyRate", 18, 2), c("Currency", "text", { len: 8, default: "'IRR'" }),
      req("CapacityHoursPerWeek", "decimal", { precision: 8, scale: 2, default: "40" }),
      req("EmploymentType", "text", { len: 24, default: "'direct'", comment: "direct|contractor|oem" }),
      c("VendorId", "text", { len: 60 }), req("IsActive", "bool", { default: "1" }),
      c("UserId", "text", { len: 60, comment: "ارجاع نرم به کاربر سامانه برای RBAC؛ بدون FK" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsTechnician_Code", columns: ["SiteId", "TechnicianCode"], unique: true },
      { name: "IX_CmmsTechnician_Trade", columns: ["SiteId", "PrimaryTrade", "IsActive"] },
      { name: "IX_CmmsTechnician_Crew", columns: ["SiteId", "CrewId"] },
    ],
    foreignKeys: [{ column: "VendorId", refTable: "CmmsVendor", refColumn: "Id", onDelete: "SET NULL" }],
    checks: [
      ck("CK_CmmsTechnician_Grade", "Grade IN ('apprentice','junior','senior','expert','master')", ["Grade"]),
      ck("CK_CmmsTechnician_Employment", "EmploymentType IN ('direct','contractor','oem')", ["EmploymentType"]),
      ck("CK_CmmsTechnician_Capacity", "CapacityHoursPerWeek > 0 AND CapacityHoursPerWeek <= 168", ["CapacityHoursPerWeek"]),
      ck("CK_CmmsTechnician_Rate", "StandardHourlyRate IS NULL OR StandardHourlyRate >= 0", ["StandardHourlyRate"]),
    ],
  },

  /* 25 — مهارت‌های تکنسین؛ ورودی تطبیق مهارت در زمان‌بند هوشمند. */
  {
    name: "CmmsTechnicianSkill", module: "cmms", title: { fa: "مهارت تکنسین", en: "Technician skill" }, pk: "Id",
    columns: [
      id(), site(), hardRef("TechnicianId"), req("SkillKey", "text", { len: 80 }), req("SkillLevel", "int", { default: "1", comment: "۱..۵" }),
      c("CertifiedBy", "text", { len: 240 }), c("CertifiedOn", "date"), c("ExpiresOn", "date"),
      req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_CmmsTechnicianSkill_Key", columns: ["TechnicianId", "SkillKey"], unique: true },
      { name: "IX_CmmsTechnicianSkill_Skill", columns: ["SiteId", "SkillKey", "SkillLevel"] },
    ],
    foreignKeys: [{ column: "TechnicianId", refTable: "CmmsTechnician", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsTechnicianSkill_Level", "SkillLevel BETWEEN 1 AND 5", ["SkillLevel"]),
      ck("CK_CmmsTechnicianSkill_Dates", "ExpiresOn IS NULL OR CertifiedOn IS NULL OR ExpiresOn >= CertifiedOn", ["CertifiedOn", "ExpiresOn"]),
    ],
  },

  /* 26 — گروه کاری (Crew) و تقویم شیفت. */
  {
    name: "CmmsCrew", module: "cmms", title: { fa: "گروه کاری نت", en: "Maintenance crew" }, pk: "Id",
    columns: [
      id(), site(), code("CrewCode"), req("NameFa", "text", { len: 240 }),
      req("ShiftPattern", "text", { len: 60, comment: "مثلاً 4x12 یا 6x8 یا day-only" }),
      req("DailyCapacityHours", "decimal", { precision: 10, scale: 2, default: "8" }),
      c("SupervisorTechnicianId", "text", { len: 60 }), req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsCrew_Code", columns: ["SiteId", "CrewCode"], unique: true },
      { name: "IX_CmmsCrew_Active", columns: ["SiteId", "IsActive"] },
    ],
    foreignKeys: [{ column: "SupervisorTechnicianId", refTable: "CmmsTechnician", refColumn: "Id", onDelete: "SET NULL" }],
    checks: [ck("CK_CmmsCrew_Capacity", "DailyCapacityHours > 0", ["DailyCapacityHours"])],
  },

  /* 27 — تقویم شیفت و در دسترس‌بودن؛ ورودی ظرفیت برای زمان‌بند هوشمند. */
  {
    name: "CmmsShiftCalendar", module: "cmms", title: { fa: "تقویم شیفت نت", en: "Maintenance shift calendar" }, pk: "Id",
    columns: [
      id(), site(), c("CrewId", "text", { len: 60 }), req("CalendarDate", "date"),
      req("DayType", "text", { len: 24, default: "'working'", comment: "working|non-working|holiday|shutdown-window" }),
      req("CapacityMinutes", "int", { default: "480" }), c("WindowStart", "text", { len: 10 }), c("WindowEnd", "text", { len: 10 }),
      c("ReasonFa", "text", { len: 400 }),
    ],
    indexes: [
      { name: "UX_CmmsShiftCalendar_Date", columns: ["SiteId", "CrewId", "CalendarDate"], unique: true },
      { name: "IX_CmmsShiftCalendar_Type", columns: ["SiteId", "CalendarDate", "DayType"] },
    ],
    foreignKeys: [{ column: "CrewId", refTable: "CmmsCrew", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsShiftCalendar_Type", "DayType IN ('working','non-working','holiday','shutdown-window')", ["DayType"]),
      ck("CK_CmmsShiftCalendar_Capacity", "CapacityMinutes >= 0 AND CapacityMinutes <= 1440", ["CapacityMinutes"]),
    ],
  },

  /* 28 — ابزارهای ویژهٔ نت. */
  {
    name: "CmmsTool", module: "cmms", title: { fa: "ابزار نگهداری", en: "Maintenance tool" }, pk: "Id",
    columns: [
      id(), site(), code("ToolCode"), req("NameFa", "text", { len: 240 }),
      req("ToolType", "text", { len: 28, comment: "hand|power|special|calibrated|lifting|safety" }),
      req("Quantity", "int", { default: "1" }), c("CalibrationDueOn", "date"),
      req("IsReservedOnly", "bool", { default: "0" }), req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsTool_Code", columns: ["SiteId", "ToolCode"], unique: true },
      { name: "IX_CmmsTool_Type", columns: ["SiteId", "ToolType", "IsActive"] },
    ],
    checks: [
      ck("CK_CmmsTool_Type", "ToolType IN ('hand','power','special','calibrated','lifting','safety')", ["ToolType"]),
      ck("CK_CmmsTool_Qty", "Quantity > 0", ["Quantity"]),
    ],
  },

  /* 29 — قطعات یدکی MRO (ماژول ۲ عملیاتی). موجودی در همین جدول نگه داشته می‌شود
     تا CMMS از انبار SCM مستقل بماند؛ انبار فقط با شناسهٔ نرم ارجاع می‌شود. */
  {
    name: "CmmsSparePart", module: "cmms", title: { fa: "قطعهٔ یدکی MRO", en: "MRO spare part" }, pk: "Id",
    columns: [
      id(), site(), code("PartNumber"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("Category", "text", { len: 28, comment: "mechanical|electrical|instrument|consumable|lubricant|seal|bearing|filter" }),
      req("Uom", "text", { len: 24 }), c("Manufacturer", "text", { len: 240 }), c("OemPartNumber", "text", { len: 120 }),
      c("VendorId", "text", { len: 60 }), c("ScmWarehouseId", "text", { len: 60, comment: "ارجاع نرم؛ بدون FK" }),
      money("UnitCost"), req("Currency", "text", { len: 8, default: "'IRR'" }),
      qty("QtyOnHand", true), qty("MinStock", true), qty("MaxStock", true), qty("ReorderPoint", true),
      qty("SafetyStock", true), num("LeadTimeDays", 10, 2, true),
      req("IsCriticalSpare", "bool", { default: "0" }), req("IsConsumable", "bool", { default: "0" }),
      req("ShelfLifeMonths", "int", { default: "0" }), req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsSparePart_Number", columns: ["SiteId", "PartNumber"], unique: true },
      { name: "IX_CmmsSparePart_Category", columns: ["SiteId", "Category", "IsActive"] },
      { name: "IX_CmmsSparePart_Critical", columns: ["SiteId", "IsCriticalSpare", "IsActive"] },
    ],
    foreignKeys: [{ column: "VendorId", refTable: "CmmsVendor", refColumn: "Id", onDelete: "SET NULL" }],
    checks: [
      ck("CK_CmmsSparePart_Category",
        "Category IN ('mechanical','electrical','instrument','consumable','lubricant','seal','bearing','filter')", ["Category"]),
      ck("CK_CmmsSparePart_Cost", "UnitCost IS NULL OR UnitCost >= 0", ["UnitCost"]),
      ck("CK_CmmsSparePart_Qty", "QtyOnHand IS NULL OR QtyOnHand >= 0", ["QtyOnHand"]),
      ck("CK_CmmsSparePart_Levels", "MinStock IS NULL OR ReorderPoint IS NULL OR ReorderPoint >= MinStock", ["MinStock", "ReorderPoint"]),
      ck("CK_CmmsSparePart_Lead", "LeadTimeDays IS NULL OR LeadTimeDays >= 0", ["LeadTimeDays"]),
    ],
  },

  /* 30 — BOM تعمیراتی: اتصال قطعهٔ یدکی به تجهیز یا گرهٔ خانواده. */
  {
    name: "CmmsAssetSpareLink", module: "cmms", title: { fa: "BOM تعمیراتی تجهیز", en: "Maintenance BOM link" }, pk: "Id",
    columns: [
      id(), site(), c("AssetId", "text", { len: 60 }), c("FamilyNodeId", "text", { len: 60 }), hardRef("SparePartId"),
      qty("QuantityPerUnit"), c("Position", "text", { len: 120, comment: "محل نصب؛ مثلاً سمت درایو" }),
      req("IsMandatory", "bool", { default: "0" }), c("ReplacementIntervalHours", "decimal", { precision: 12, scale: 2 }),
      c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_CmmsAssetSpareLink_Pair", columns: ["AssetId", "FamilyNodeId", "SparePartId"], unique: true },
      { name: "IX_CmmsAssetSpareLink_Part", columns: ["SiteId", "SparePartId"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyNodeId", refTable: "CmmsFamilyNode", refColumn: "Id", onDelete: "CASCADE" },
      { column: "SparePartId", refTable: "CmmsSparePart", refColumn: "Id" },
    ],
    checks: [
      ck("CK_CmmsAssetSpareLink_Target", "AssetId IS NOT NULL OR FamilyNodeId IS NOT NULL", ["AssetId", "FamilyNodeId"]),
      ck("CK_CmmsAssetSpareLink_Qty", "QuantityPerUnit > 0", ["QuantityPerUnit"]),
    ],
  },

  /* 31 — تراکنش انبار نت: ورود، خروج، رزرو و آزادسازی. */
  {
    name: "CmmsSpareTransaction", module: "cmms", title: { fa: "تراکنش قطعات یدکی", en: "Spare parts transaction" }, pk: "Id",
    columns: [
      id(), site(), hardRef("SparePartId"), req("TransactionType", "text", { len: 24, comment: "receipt|issue|return|reserve|unreserve|adjust|scrap" }),
      req("OccurredAt", "datetime"), req("OccurredOn", "date"), qty("Quantity"),
      c("WorkOrderId", "text", { len: 60 }), c("AssetId", "text", { len: 60 }),
      c("TechnicianId", "text", { len: 60 }), money("TotalCost"), c("ReferenceNo", "text", { len: 120 }),
      c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "IX_CmmsSpareTransaction_Part", columns: ["SparePartId", "OccurredOn"] },
      { name: "IX_CmmsSpareTransaction_Wo", columns: ["SiteId", "WorkOrderId"] },
      { name: "IX_CmmsSpareTransaction_Type", columns: ["SiteId", "TransactionType", "OccurredOn"] },
    ],
    foreignKeys: [
      { column: "SparePartId", refTable: "CmmsSparePart", refColumn: "Id", onDelete: "CASCADE" },
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "SET NULL" },
      { column: "TechnicianId", refTable: "CmmsTechnician", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsSpareTransaction_Type",
        "TransactionType IN ('receipt','issue','return','reserve','unreserve','adjust','scrap')", ["TransactionType"]),
      ck("CK_CmmsSpareTransaction_Qty", "Quantity <> 0", ["Quantity"]),
    ],
  },

  /* ═══════════════ د) گردش‌کار مکانیزه (ماژول ۱۰ عملیاتی) ═══════════════ */

  /* 32 — تعریف گردش‌کار؛ یک تعریف برای هر نوع جریان (درخواست، دستورکار، RCFA). */
  {
    name: "CmmsWorkflowDefinition", module: "cmms", title: { fa: "تعریف گردش‌کار", en: "Workflow definition" }, pk: "Id",
    columns: [
      id(), site(), code("WorkflowCode"), req("NameFa", "text", { len: 240 }),
      req("AppliesTo", "text", { len: 28, comment: "work-request|work-order|rca|pm-schedule|bulk-change" }),
      req("StartStepCode", "text", { len: 60 }), req("Version", "int", { default: "1" }),
      req("IsActive", "bool", { default: "1" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsWorkflowDefinition_Code", columns: ["SiteId", "WorkflowCode", "Version"], unique: true },
      { name: "IX_CmmsWorkflowDefinition_Applies", columns: ["SiteId", "AppliesTo", "IsActive"] },
    ],
    checks: [
      ck("CK_CmmsWorkflowDefinition_Applies",
        "AppliesTo IN ('work-request','work-order','rca','pm-schedule','bulk-change')", ["AppliesTo"]),
      ck("CK_CmmsWorkflowDefinition_Version", "Version >= 1", ["Version"]),
    ],
  },

  /* 33 — گام گردش‌کار: وضعیت، نقش مسئول و SLA. */
  {
    name: "CmmsWorkflowStep", module: "cmms", title: { fa: "گام گردش‌کار", en: "Workflow step" }, pk: "Id",
    columns: [
      id(), site(), hardRef("WorkflowDefinitionId"), req("StepCode", "text", { len: 60 }), req("NameFa", "text", { len: 240 }),
      req("StepKind", "text", { len: 24, comment: "task|approval|notification|end" }),
      req("OwnerRole", "text", { len: 60, comment: "نقش مسئول؛ از کاتالوگ نقش‌های نت" }),
      num("SlaHours", 10, 2), req("IsTerminal", "bool", { default: "0" }),
      req("RequiresEvidence", "bool", { default: "0" }), req("SortOrder", "int", { default: "0" }),
    ],
    indexes: [
      { name: "UX_CmmsWorkflowStep_Code", columns: ["WorkflowDefinitionId", "StepCode"], unique: true },
      { name: "IX_CmmsWorkflowStep_Role", columns: ["SiteId", "OwnerRole"] },
    ],
    foreignKeys: [{ column: "WorkflowDefinitionId", refTable: "CmmsWorkflowDefinition", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsWorkflowStep_Kind", "StepKind IN ('task','approval','notification','end')", ["StepKind"]),
      ck("CK_CmmsWorkflowStep_Sla", "SlaHours IS NULL OR SlaHours > 0", ["SlaHours"]),
    ],
  },

  /* 34 — گذار مجاز بین گام‌ها؛ موتور گردش‌کار بدون گذار تعریف‌شده حرکت نمی‌کند. */
  {
    name: "CmmsWorkflowTransition", module: "cmms", title: { fa: "گذار گردش‌کار", en: "Workflow transition" }, pk: "Id",
    columns: [
      id(), site(), hardRef("WorkflowDefinitionId"), req("FromStepCode", "text", { len: 60 }), req("ToStepCode", "text", { len: 60 }),
      req("ActionCode", "text", { len: 60, comment: "submit|approve|reject|assign|complete|cancel|reopen" }),
      req("RequiredPermission", "text", { len: 80, comment: "مجوز RBAC لازم؛ مثلاً cmms.wo.approve" }),
      req("SortOrder", "int", { default: "0" }), req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_CmmsWorkflowTransition_Path", columns: ["WorkflowDefinitionId", "FromStepCode", "ToStepCode", "ActionCode"], unique: true },
      { name: "IX_CmmsWorkflowTransition_From", columns: ["WorkflowDefinitionId", "FromStepCode", "IsActive"] },
    ],
    foreignKeys: [{ column: "WorkflowDefinitionId", refTable: "CmmsWorkflowDefinition", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsWorkflowTransition_Action",
        "ActionCode IN ('submit','approve','reject','assign','complete','cancel','reopen')", ["ActionCode"]),
      ck("CK_CmmsWorkflowTransition_Self", "FromStepCode <> ToStepCode OR ActionCode IN ('reopen','assign')", ["FromStepCode", "ToStepCode", "ActionCode"]),
    ],
  },

  /* 35 — نمونهٔ در جریان یک گردش‌کار روی یک رکورد واقعی. */
  {
    name: "CmmsWorkflowInstance", module: "cmms", title: { fa: "نمونهٔ گردش‌کار", en: "Workflow instance" }, pk: "Id",
    columns: [
      id(), site(), hardRef("WorkflowDefinitionId"), req("SubjectEntity", "text", { len: 60, comment: "نام جدول موضوع؛ مثلاً CmmsWorkOrder" }),
      hardRef("SubjectId"), req("CurrentStepCode", "text", { len: 60 }),
      req("State", "text", { len: 24, default: "'running'", comment: "running|completed|cancelled" }),
      c("StartedAt", "datetime"), c("CompletedAt", "datetime"), c("CurrentOwnerId", "text", { len: 60 }),
      c("DueAt", "datetime", { comment: "سررسید SLA گام جاری" }),
    ],
    indexes: [
      { name: "IX_CmmsWorkflowInstance_Subject", columns: ["SiteId", "SubjectEntity", "SubjectId"] },
      { name: "IX_CmmsWorkflowInstance_State", columns: ["SiteId", "State", "CurrentStepCode"] },
      { name: "IX_CmmsWorkflowInstance_Owner", columns: ["SiteId", "CurrentOwnerId", "State"] },
    ],
    foreignKeys: [{ column: "WorkflowDefinitionId", refTable: "CmmsWorkflowDefinition", refColumn: "Id" }],
    checks: [
      ck("CK_CmmsWorkflowInstance_State", "State IN ('running','completed','cancelled')", ["State"]),
      ck("CK_CmmsWorkflowInstance_Done", "State <> 'completed' OR CompletedAt IS NOT NULL", ["State", "CompletedAt"]),
    ],
  },

  /* 36 — رویدادهای گردش‌کار؛ رد ممیزی غیرقابل‌حذف مسیر گردش. */
  {
    name: "CmmsWorkflowEvent", module: "cmms", title: { fa: "رویداد گردش‌کار", en: "Workflow event" }, pk: "Id",
    columns: [
      id(), site(), hardRef("WorkflowInstanceId"), req("FromStepCode", "text", { len: 60 }), req("ToStepCode", "text", { len: 60 }),
      req("ActionCode", "text", { len: 60 }), req("OccurredAt", "datetime"), c("ActorId", "text", { len: 60 }),
      c("CommentFa", "text", { len: 1000 }), c("EvidencePath", "text", { len: 600 }),
      num("ElapsedHours", 10, 3), num("SlaHours", 10, 2), c("IsSlaBreached", "bool", { default: "0" }),
    ],
    indexes: [
      { name: "IX_CmmsWorkflowEvent_Instance", columns: ["WorkflowInstanceId", "OccurredAt"] },
      { name: "IX_CmmsWorkflowEvent_Actor", columns: ["SiteId", "ActorId", "OccurredAt"] },
      { name: "IX_CmmsWorkflowEvent_Sla", columns: ["SiteId", "IsSlaBreached"] },
    ],
    foreignKeys: [{ column: "WorkflowInstanceId", refTable: "CmmsWorkflowInstance", refColumn: "Id", onDelete: "CASCADE" }],
  },

  /* ═══════════════ ه) برنامه‌ریزی نت ═══════════════ */

  /* 37 — استراتژی نگهداشت (خروجی RCM و APM). */
  {
    name: "CmmsPmStrategy", module: "cmms", title: { fa: "استراتژی نگهداشت", en: "Maintenance strategy" }, pk: "Id",
    columns: [
      id(), site(), c("FamilyId", "text", { len: 60 }), c("AssetId", "text", { len: 60 }),
      req("StrategyType", "text", { len: 28, comment: "pm|cbm|predictive|risk-based|run-to-failure|zero-breakdown" }),
      req("SourceAnalysis", "text", { len: 28, default: "'manual'", comment: "manual|rcm|fmea|ai-pm-optimization|pmo-study" }),
      c("RcmAnalysisId", "text", { len: 60 }), num("ReviewIntervalDays", 10, 2),
      req("Status", "text", { len: 24, default: "'draft'", comment: "draft|approved|obsolete" }),
      c("ApprovedAt", "datetime"), c("ApprovedBy", "text", { len: 60 }), note(),
    ],
    indexes: [
      { name: "IX_CmmsPmStrategy_Family", columns: ["SiteId", "FamilyId", "Status"] },
      { name: "IX_CmmsPmStrategy_Asset", columns: ["SiteId", "AssetId", "Status"] },
    ],
    foreignKeys: [
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_CmmsPmStrategy_Target", "FamilyId IS NOT NULL OR AssetId IS NOT NULL", ["FamilyId", "AssetId"]),
      ck("CK_CmmsPmStrategy_Type",
        "StrategyType IN ('pm','cbm','predictive','risk-based','run-to-failure','zero-breakdown')", ["StrategyType"]),
      ck("CK_CmmsPmStrategy_Source",
        "SourceAnalysis IN ('manual','rcm','fmea','ai-pm-optimization','pmo-study')", ["SourceAnalysis"]),
      ck("CK_CmmsPmStrategy_Status", "Status IN ('draft','approved','obsolete')", ["Status"]),
    ],
  },

  /* 38 — برنامهٔ PM: تعریف تناوب و تولید خودکار دستورکار. */
  {
    name: "CmmsPmSchedule", module: "cmms", title: { fa: "برنامهٔ نگهداشت پیشگیرانه", en: "PM schedule" }, pk: "Id",
    columns: [
      id(), site(), c("FamilyId", "text", { len: 60 }), hardRef("AssetId"), c("FamilyPmTaskId", "text", { len: 60 }),
      c("StrategyId", "text", { len: 60 }), code("ScheduleCode"),
      req("TriggerType", "text", { len: 24, comment: "time|meter|condition|combined" }),
      num("IntervalValue", 18, 4), c("IntervalUnit", "text", { len: 24 }), c("MeterDefinitionId", "text", { len: 60 }),
      c("LastDoneAt", "datetime"), num("LastMeterValue", 18, 4), c("NextDueAt", "datetime"), num("NextDueMeterValue", 18, 4),
      req("Priority", "int", { default: "3", comment: "۱=بحرانی .. ۵=کم" }),
      req("LeadTimeDays", "int", { default: "7" }), req("IsActive", "bool", { default: "1" }),
      c("OptimizedByAi", "bool", { default: "0" }), c("OptimizationReasonFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "UX_CmmsPmSchedule_Code", columns: ["SiteId", "AssetId", "ScheduleCode"], unique: true },
      { name: "IX_CmmsPmSchedule_Due", columns: ["SiteId", "NextDueAt", "IsActive"] },
      { name: "IX_CmmsPmSchedule_Family", columns: ["SiteId", "FamilyId", "IsActive"] },
      { name: "IX_CmmsPmSchedule_Meter", columns: ["SiteId", "MeterDefinitionId"] },
    ],
    foreignKeys: [
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyPmTaskId", refTable: "CmmsFamilyPmTask", refColumn: "Id", onDelete: "SET NULL" },
      { column: "StrategyId", refTable: "CmmsPmStrategy", refColumn: "Id", onDelete: "SET NULL" },
      { column: "MeterDefinitionId", refTable: "CmmsMeterDefinition", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsPmSchedule_Trigger", "TriggerType IN ('time','meter','condition','combined')", ["TriggerType"]),
      ck("CK_CmmsPmSchedule_Interval", "IntervalValue IS NULL OR IntervalValue > 0", ["IntervalValue"]),
      ck("CK_CmmsPmSchedule_Priority", "Priority BETWEEN 1 AND 5", ["Priority"]),
      ck("CK_CmmsPmSchedule_Lead", "LeadTimeDays >= 0", ["LeadTimeDays"]),
    ],
  },

  /* 39 — درخواست‌کار (ماژول ۹ عملیاتی). */
  {
    name: "CmmsWorkRequest", module: "cmms", title: { fa: "درخواست کار نت", en: "Maintenance work request" }, pk: "Id",
    columns: [
      id(), site(), code("RequestNo"), hardRef("AssetId"), c("LocationId", "text", { len: 60 }),
      req("RequestType", "text", { len: 28, comment: "breakdown|corrective|preventive|improvement|service|inspection" }),
      req("Priority", "int", { default: "3" }), req("Status", "text", { len: 24, default: "'submitted'", comment: "submitted|under-review|approved|converted|rejected|cancelled" }),
      req("ReportedOn", "date"), c("ReportedAt", "datetime"), c("ReporterId", "text", { len: 60 }),
      req("TitleFa", "text", { len: 300 }), c("DescriptionFa", "text", { len: 4000 }),
      c("SymptomFa", "text", { len: 1000, comment: "علامت مشاهده‌شده؛ ورودی تحلیل هوشمند خرابی" }),
      c("FamilyFailureModeId", "text", { len: 60 }), req("IsAssetStopped", "bool", { default: "0" }),
      c("ReviewedById", "text", { len: 60 }), c("ReviewedAt", "datetime"), c("RejectionReasonFa", "text", { len: 1000 }),
      c("ConvertedWorkOrderId", "text", { len: 60 }),
    ],
    indexes: [
      { name: "UX_CmmsWorkRequest_No", columns: ["SiteId", "RequestNo"], unique: true },
      { name: "IX_CmmsWorkRequest_Asset", columns: ["SiteId", "AssetId", "Status"] },
      { name: "IX_CmmsWorkRequest_Status", columns: ["SiteId", "Status", "Priority"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id" },
      { column: "LocationId", refTable: "CmmsLocation", refColumn: "Id", onDelete: "SET NULL" },
      { column: "FamilyFailureModeId", refTable: "CmmsFamilyFailureMode", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsWorkRequest_Type",
        "RequestType IN ('breakdown','corrective','preventive','improvement','service','inspection')", ["RequestType"]),
      ck("CK_CmmsWorkRequest_Priority", "Priority BETWEEN 1 AND 5", ["Priority"]),
      ck("CK_CmmsWorkRequest_Status",
        "Status IN ('submitted','under-review','approved','converted','rejected','cancelled')", ["Status"]),
      ck("CK_CmmsWorkRequest_Converted", "Status <> 'converted' OR ConvertedWorkOrderId IS NOT NULL", ["Status", "ConvertedWorkOrderId"]),
    ],
  },

  /* 40 — دستورکار نت؛ هستهٔ اجرای عملیاتی. */
  {
    name: "CmmsWorkOrder", module: "cmms", title: { fa: "دستورکار نت", en: "Maintenance work order" }, pk: "Id",
    columns: [
      id(), site(), code("WorkOrderNo"), req("WorkOrderType", "text", { len: 28, comment: "pm|cm|emergency|overhaul|project|calibration|inspection" }),
      c("AssetId", "text", { len: 60 }), c("LocationId", "text", { len: 60 }), c("WorkRequestId", "text", { len: 60 }),
      c("PmScheduleId", "text", { len: 60 }), c("FamilyPmTaskId", "text", { len: 60 }),
      req("TitleFa", "text", { len: 300 }), c("ScopeFa", "text", { len: 4000 }),
      req("Priority", "int", { default: "3" }), req("Status", "text", { len: 28, default: "'draft'", comment: "draft|planned|scheduled|released|in-progress|on-hold|completed|closed|cancelled" }),
      c("PlannedStartAt", "datetime"), c("PlannedFinishAt", "datetime"), c("ScheduledStartAt", "datetime"),
      c("ReleasedAt", "datetime"), c("StartedAt", "datetime"), c("CompletedAt", "datetime"), c("ClosedAt", "datetime"),
      hrs("EstimatedHours", true), hrs("ActualHours", true), money("EstimatedCost"), money("ActualCost"),
      c("CrewId", "text", { len: 60 }), c("PrimaryTechnicianId", "text", { len: 60 }), c("VendorId", "text", { len: 60 }),
      c("WorkflowInstanceId", "text", { len: 60 }), c("SafetyPermitNo", "text", { len: 80 }),
      req("IsAssetDown", "bool", { default: "0" }), req("ProductionImpact", "text", { len: 24, default: "'none'", comment: "none|partial|line-stop|plant-stop" }),
      c("CompletedById", "text", { len: 60 }), c("ClosedById", "text", { len: 60 }), modelVersion(),
    ],
    indexes: [
      { name: "UX_CmmsWorkOrder_No", columns: ["SiteId", "WorkOrderNo"], unique: true },
      { name: "IX_CmmsWorkOrder_Asset", columns: ["SiteId", "AssetId", "Status"] },
      { name: "IX_CmmsWorkOrder_Status", columns: ["SiteId", "Status", "Priority"] },
      { name: "IX_CmmsWorkOrder_Schedule", columns: ["SiteId", "ScheduledStartAt", "Status"] },
      { name: "IX_CmmsWorkOrder_Technician", columns: ["SiteId", "PrimaryTechnicianId", "Status"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "SET NULL" },
      { column: "LocationId", refTable: "CmmsLocation", refColumn: "Id", onDelete: "SET NULL" },
      { column: "WorkRequestId", refTable: "CmmsWorkRequest", refColumn: "Id", onDelete: "SET NULL" },
      { column: "PmScheduleId", refTable: "CmmsPmSchedule", refColumn: "Id", onDelete: "SET NULL" },
      { column: "CrewId", refTable: "CmmsCrew", refColumn: "Id", onDelete: "SET NULL" },
      { column: "PrimaryTechnicianId", refTable: "CmmsTechnician", refColumn: "Id", onDelete: "SET NULL" },
      { column: "VendorId", refTable: "CmmsVendor", refColumn: "Id", onDelete: "SET NULL" },
      { column: "WorkflowInstanceId", refTable: "CmmsWorkflowInstance", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsWorkOrder_Type",
        "WorkOrderType IN ('pm','cm','emergency','overhaul','project','calibration','inspection')", ["WorkOrderType"]),
      ck("CK_CmmsWorkOrder_Priority", "Priority BETWEEN 1 AND 5", ["Priority"]),
      ck("CK_CmmsWorkOrder_Status",
        "Status IN ('draft','planned','scheduled','released','in-progress','on-hold','completed','closed','cancelled')", ["Status"]),
      ck("CK_CmmsWorkOrder_Impact", "ProductionImpact IN ('none','partial','line-stop','plant-stop')", ["ProductionImpact"]),
      ck("CK_CmmsWorkOrder_Hours", "ActualHours IS NULL OR ActualHours >= 0", ["ActualHours"]),
      ck("CK_CmmsWorkOrder_Release", "Status NOT IN ('released','in-progress','completed','closed') OR ReleasedAt IS NOT NULL", ["Status", "ReleasedAt"]),
      ck("CK_CmmsWorkOrder_Close", "Status <> 'closed' OR ClosedAt IS NOT NULL", ["Status", "ClosedAt"]),
    ],
  },

  /* 41 — ردیف اجرایی چک‌لیست یک دستورکار. */
  {
    name: "CmmsWorkOrderTask", module: "cmms", title: { fa: "ردیف چک‌لیست دستورکار", en: "Work order task line" }, pk: "Id",
    columns: [
      id(), site(), hardRef("WorkOrderId"), c("FamilyPmTaskId", "text", { len: 60 }), c("ChecklistItemId", "text", { len: 60 }),
      req("LineNo", "int"), req("DescriptionFa", "text", { len: 600 }),
      req("ResultStatus", "text", { len: 24, default: "'pending'", comment: "pending|pass|fail|na|deferred" }),
      c("MeasuredValueText", "text", { len: 200 }), num("MeasuredValueNumber", 18, 6),
      hrs("PlannedMinutes", true), hrs("ActualMinutes", true), c("PerformedBy", "text", { len: 60 }), c("PerformedAt", "datetime"),
      c("FindingFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "UX_CmmsWorkOrderTask_Line", columns: ["WorkOrderId", "LineNo"], unique: true },
      { name: "IX_CmmsWorkOrderTask_Result", columns: ["SiteId", "ResultStatus"] },
    ],
    foreignKeys: [
      { column: "WorkOrderId", refTable: "CmmsWorkOrder", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyPmTaskId", refTable: "CmmsFamilyPmTask", refColumn: "Id", onDelete: "SET NULL" },
      { column: "ChecklistItemId", refTable: "CmmsPmChecklistItem", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsWorkOrderTask_Line", "LineNo > 0", ["LineNo"]),
      ck("CK_CmmsWorkOrderTask_Result", "ResultStatus IN ('pending','pass','fail','na','deferred')", ["ResultStatus"]),
    ],
  },

  /* 42 — نفرساعت دستورکار (ماژول ۱۱ عملیاتی). */
  {
    name: "CmmsWorkOrderLabor", module: "cmms", title: { fa: "نفرساعت دستورکار", en: "Work order labor" }, pk: "Id",
    columns: [
      id(), site(), hardRef("WorkOrderId"), hardRef("TechnicianId"), req("WorkDate", "date"),
      req("StartTime", "text", { len: 10 }), req("EndTime", "text", { len: 10 }),
      hrs("RegularHours"), hrs("OvertimeHours", true), req("LaborRate", "decimal", { precision: 18, scale: 4 }),
      money("LaborCost"), req("IsOvertime", "bool", { default: "0" }), c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "IX_CmmsWorkOrderLabor_Wo", columns: ["WorkOrderId", "WorkDate"] },
      { name: "IX_CmmsWorkOrderLabor_Tech", columns: ["SiteId", "TechnicianId", "WorkDate"] },
    ],
    foreignKeys: [
      { column: "WorkOrderId", refTable: "CmmsWorkOrder", refColumn: "Id", onDelete: "CASCADE" },
      { column: "TechnicianId", refTable: "CmmsTechnician", refColumn: "Id" },
    ],
    checks: [
      ck("CK_CmmsWorkOrderLabor_Hours", "RegularHours >= 0 AND RegularHours <= 24", ["RegularHours"]),
      ck("CK_CmmsWorkOrderLabor_OT", "OvertimeHours IS NULL OR (OvertimeHours >= 0 AND OvertimeHours <= 24)", ["OvertimeHours"]),
      ck("CK_CmmsWorkOrderLabor_Rate", "LaborRate >= 0", ["LaborRate"]),
    ],
  },

  /* 43 — قطعات مصرف‌شده در دستورکار. */
  {
    name: "CmmsWorkOrderMaterial", module: "cmms", title: { fa: "قطعات مصرفی دستورکار", en: "Work order material" }, pk: "Id",
    columns: [
      id(), site(), hardRef("WorkOrderId"), hardRef("SparePartId"), qty("Quantity"),
      req("IssuedOn", "date"), money("UnitCost"), money("TotalCost"),
      c("IssuedBy", "text", { len: 60 }), req("LineType", "text", { len: 24, default: "'planned'", comment: "planned|actual|returned" }),
      c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "IX_CmmsWorkOrderMaterial_Wo", columns: ["WorkOrderId", "IssuedOn"] },
      { name: "IX_CmmsWorkOrderMaterial_Part", columns: ["SiteId", "SparePartId"] },
    ],
    foreignKeys: [
      { column: "WorkOrderId", refTable: "CmmsWorkOrder", refColumn: "Id", onDelete: "CASCADE" },
      { column: "SparePartId", refTable: "CmmsSparePart", refColumn: "Id" },
    ],
    checks: [
      ck("CK_CmmsWorkOrderMaterial_Qty", "Quantity > 0", ["Quantity"]),
      ck("CK_CmmsWorkOrderMaterial_Line", "LineType IN ('planned','actual','returned')", ["LineType"]),
    ],
  },

  /* 44 — سرفصل هزینهٔ دستورکار (ماژول ۱۸ عملیاتی). */
  {
    name: "CmmsWorkOrderCost", module: "cmms", title: { fa: "هزینهٔ دستورکار", en: "Work order cost" }, pk: "Id",
    columns: [
      id(), site(), hardRef("WorkOrderId"), req("CostElement", "text", { len: 28, comment: "labor|material|contract|tool|overhead|downtime-loss" }),
      money("Amount"), req("Currency", "text", { len: 8, default: "'IRR'" }), req("PostedOn", "date"),
      c("CostCenterRef", "text", { len: 60, comment: "ارجاع نرم به مرکز هزینهٔ مالی؛ بدون FK" }),
      c("VendorId", "text", { len: 60 }), c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "IX_CmmsWorkOrderCost_Wo", columns: ["WorkOrderId", "PostedOn"] },
      { name: "IX_CmmsWorkOrderCost_Element", columns: ["SiteId", "CostElement", "PostedOn"] },
    ],
    foreignKeys: [
      { column: "WorkOrderId", refTable: "CmmsWorkOrder", refColumn: "Id", onDelete: "CASCADE" },
      { column: "VendorId", refTable: "CmmsVendor", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsWorkOrderCost_Element",
        "CostElement IN ('labor','material','contract','tool','overhead','downtime-loss')", ["CostElement"]),
      ck("CK_CmmsWorkOrderCost_Amount", "Amount IS NULL OR Amount >= 0", ["Amount"]),
    ],
  },

  /* ═══════════════ و) خرابی، توقف و پایش وضعیت ═══════════════ */

  /* 45 — ثبت خرابی با کدگذاری ISO 14224؛ خوراک اصلی MTBF و تحلیل هوشمند. */
  {
    name: "CmmsFailureRecord", module: "cmms", title: { fa: "ثبت خرابی (ISO 14224)", en: "Failure record (ISO 14224)" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), c("FamilyFailureModeId", "text", { len: 60 }), c("FamilyNodeId", "text", { len: 60 }),
      req("FailureMode", "text", { len: 40 }), req("FailureMechanism", "text", { len: 40 }),
      c("FailureSubMechanism", "text", { len: 120 }), c("Iso14224Code", "text", { len: 160 }),
      req("DetectedAt", "datetime"), req("DetectedOn", "date"), c("DetectedBy", "text", { len: 60 }),
      req("DetectionMethod", "text", { len: 28, comment: "operator|inspection|cbm|alarm|breakdown-report|other" }),
      c("RestoredAt", "datetime"), hrs("DowntimeHours", true), hrs("RepairHours", true), hrs("RunningHoursBefore", true),
      c("WorkOrderId", "text", { len: 60 }), c("RcaCaseId", "text", { len: 60 }),
      req("Consequence", "text", { len: 28, default: "'non-operational'", comment: "safety-environmental|operational|non-operational|hidden" }),
      c("DescriptionFa", "text", { len: 2000 }), modelVersion(),
    ],
    indexes: [
      { name: "IX_CmmsFailureRecord_Asset", columns: ["SiteId", "AssetId", "DetectedOn"] },
      { name: "IX_CmmsFailureRecord_Mode", columns: ["SiteId", "FailureMode", "FailureMechanism"] },
      { name: "IX_CmmsFailureRecord_Wo", columns: ["SiteId", "WorkOrderId"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyFailureModeId", refTable: "CmmsFamilyFailureMode", refColumn: "Id", onDelete: "SET NULL" },
      { column: "FamilyNodeId", refTable: "CmmsFamilyNode", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsFailureRecord_Detection",
        "DetectionMethod IN ('operator','inspection','cbm','alarm','breakdown-report','other')", ["DetectionMethod"]),
      ck("CK_CmmsFailureRecord_Consequence",
        "Consequence IN ('safety-environmental','operational','non-operational','hidden')", ["Consequence"]),
      ck("CK_CmmsFailureRecord_Downtime", "DowntimeHours IS NULL OR DowntimeHours >= 0", ["DowntimeHours"]),
      ck("CK_CmmsFailureRecord_Restore", "RestoredAt IS NULL OR RestoredAt >= DetectedAt", ["DetectedAt", "RestoredAt"]),
    ],
  },

  /* 46 — ثبت توقف؛ خوراک در دسترس‌بودن، OEE و SAIDI. */
  {
    name: "CmmsDowntimeRecord", module: "cmms", title: { fa: "ثبت توقف تجهیز", en: "Asset downtime record" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), req("StartedAt", "datetime"), c("EndedAt", "datetime"),
      req("DowntimeType", "text", { len: 28, comment: "planned|unplanned|standby|waiting-for-parts|waiting-for-crew|no-demand" }),
      hrs("DurationHours", true), req("CausedByMaintenance", "bool", { default: "1" }),
      req("ProductionImpact", "text", { len: 24, default: "'none'", comment: "none|partial|line-stop|plant-stop" }),
      num("CustomersAffected", 18, 0), c("WorkOrderId", "text", { len: 60 }), c("FailureRecordId", "text", { len: 60 }),
      c("ReasonFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "IX_CmmsDowntimeRecord_Asset", columns: ["SiteId", "AssetId", "StartedAt"] },
      { name: "IX_CmmsDowntimeRecord_Type", columns: ["SiteId", "DowntimeType", "StartedAt"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FailureRecordId", refTable: "CmmsFailureRecord", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsDowntimeRecord_Type",
        "DowntimeType IN ('planned','unplanned','standby','waiting-for-parts','waiting-for-crew','no-demand')", ["DowntimeType"]),
      ck("CK_CmmsDowntimeRecord_Impact", "ProductionImpact IN ('none','partial','line-stop','plant-stop')", ["ProductionImpact"]),
      ck("CK_CmmsDowntimeRecord_End", "EndedAt IS NULL OR EndedAt >= StartedAt", ["StartedAt", "EndedAt"]),
      ck("CK_CmmsDowntimeRecord_Duration", "DurationHours IS NULL OR DurationHours >= 0", ["DurationHours"]),
    ],
  },

  /* 47 — آستانه‌های پایش وضعیت؛ ISO 17359 و منطقه‌بندی ISO 10816. */
  {
    name: "CmmsConditionThreshold", module: "cmms", title: { fa: "آستانهٔ پایش وضعیت", en: "Condition monitoring threshold" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyConditionParamId"), c("AssetId", "text", { len: 60 }),
      req("MachineClass", "text", { len: 24, default: "'group2'", comment: "ISO 10816: group1|group2|group3|group4" }),
      req("RigidSupport", "bool", { default: "1" }),
      num("ZoneAUpper"), num("ZoneBUpper"), num("ZoneCUpper"),
      c("ZoneDefinitionRef", "text", { len: 200, comment: "مرجع منطقه‌بندی؛ مثلاً ISO 10816-3 Table 1" }),
      req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_CmmsConditionThreshold_Param", columns: ["FamilyConditionParamId", "AssetId"], unique: true },
      { name: "IX_CmmsConditionThreshold_Class", columns: ["SiteId", "MachineClass"] },
    ],
    foreignKeys: [
      { column: "FamilyConditionParamId", refTable: "CmmsFamilyConditionParam", refColumn: "Id", onDelete: "CASCADE" },
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_CmmsConditionThreshold_Class", "MachineClass IN ('group1','group2','group3','group4')", ["MachineClass"]),
      ck("CK_CmmsConditionThreshold_Zones",
        "ZoneBUpper IS NULL OR ZoneAUpper IS NULL OR ZoneBUpper > ZoneAUpper", ["ZoneAUpper", "ZoneBUpper"]),
      ck("CK_CmmsConditionThreshold_ZonesC",
        "ZoneCUpper IS NULL OR ZoneBUpper IS NULL OR ZoneCUpper > ZoneBUpper", ["ZoneBUpper", "ZoneCUpper"]),
    ],
  },

  /* 48 — قرائت پایش وضعیت (CBM). */
  {
    name: "CmmsConditionReading", module: "cmms", title: { fa: "قرائت پایش وضعیت", en: "Condition monitoring reading" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), hardRef("FamilyConditionParamId"), req("MeasuredAt", "datetime"), req("MeasuredOn", "date"),
      num("Value", 18, 6), req("Uom", "text", { len: 24 }),
      c("Zone", "text", { len: 12, comment: "A|B|C|D — منطقهٔ ISO 10816" }),
      c("Source", "text", { len: 24, default: "'manual'", comment: "manual|iiot|scada|portable|lab" }),
      c("AnalystId", "text", { len: 60 }), c("WorkOrderId", "text", { len: 60 }),
      c("TrendDirection", "text", { len: 16, comment: "rising|falling|stable" }), num("RateOfChange", 18, 6),
      c("NoteFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "IX_CmmsConditionReading_Asset", columns: ["SiteId", "AssetId", "MeasuredOn"] },
      { name: "IX_CmmsConditionReading_Param", columns: ["FamilyConditionParamId", "MeasuredAt"] },
      { name: "IX_CmmsConditionReading_Zone", columns: ["SiteId", "Zone", "MeasuredOn"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyConditionParamId", refTable: "CmmsFamilyConditionParam", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_CmmsConditionReading_Zone", "Zone IS NULL OR Zone IN ('A','B','C','D')", ["Zone"]),
      ck("CK_CmmsConditionReading_Source", "Source IS NULL OR Source IN ('manual','iiot','scada','portable','lab')", ["Source"]),
      ck("CK_CmmsConditionReading_Trend", "TrendDirection IS NULL OR TrendDirection IN ('rising','falling','stable')", ["TrendDirection"]),
    ],
  },

  /* ═══════════════ ز) تحلیل: FMEA، RCM، RCFA، برنامهٔ نت ═══════════════ */

  /* 49 — سربرگ تحلیل FMEA/FMECA طبق IEC 60812. */
  {
    name: "CmmsFmeaRecord", module: "cmms", title: { fa: "تحلیل FMEA/FMECA", en: "FMEA / FMECA analysis" }, pk: "Id",
    columns: [
      id(), site(), c("FamilyId", "text", { len: 60 }), c("AssetId", "text", { len: 60 }),
      code("AnalysisCode"), req("AnalysisType", "text", { len: 24, default: "'fmea'", comment: "fmea|fmeca" }),
      req("Methodology", "text", { len: 40, default: "'IEC 60812'", comment: "مرجع روش؛ پیش‌فرض IEC 60812" }),
      req("Status", "text", { len: 24, default: "'draft'", comment: "draft|in-review|approved|obsolete" }),
      c("TeamLeadId", "text", { len: 60 }), c("AnalyzedOn", "date"), c("ReviewedOn", "date"),
      num("MaxRpnThreshold", 10, 2), req("TotalRpn", "decimal", { precision: 18, scale: 2, default: "0" }),
      note(),
    ],
    indexes: [
      { name: "UX_CmmsFmeaRecord_Code", columns: ["SiteId", "AnalysisCode"], unique: true },
      { name: "IX_CmmsFmeaRecord_Family", columns: ["SiteId", "FamilyId", "Status"] },
    ],
    foreignKeys: [
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_CmmsFmeaRecord_Target", "FamilyId IS NOT NULL OR AssetId IS NOT NULL", ["FamilyId", "AssetId"]),
      ck("CK_CmmsFmeaRecord_Type", "AnalysisType IN ('fmea','fmeca')", ["AnalysisType"]),
      ck("CK_CmmsFmeaRecord_Status", "Status IN ('draft','in-review','approved','obsolete')", ["Status"]),
      ck("CK_CmmsFmeaRecord_Threshold", "MaxRpnThreshold IS NULL OR MaxRpnThreshold > 0", ["MaxRpnThreshold"]),
    ],
  },

  /* 50 — ردیف FMEA: حالت خرابی، اثر، علت، کنترل و RPN. */
  {
    name: "CmmsFmeaEntry", module: "cmms", title: { fa: "ردیف FMEA", en: "FMEA entry" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FmeaRecordId"), c("FamilyFailureModeId", "text", { len: 60 }), c("FamilyNodeId", "text", { len: 60 }),
      req("FunctionFa", "text", { len: 600 }), req("FailureModeText", "text", { len: 400 }), req("EffectFa", "text", { len: 800 }),
      req("CauseFa", "text", { len: 800 }), c("CurrentControlFa", "text", { len: 800 }),
      req("Severity", "int"), req("Occurrence", "int"), req("Detection", "int"),
      req("Rpn", "int", { comment: "محصول S×O×D — IEC 60812" }),
      c("ActionPriority", "text", { len: 12, comment: "high|medium|low" }),
      num("FailureRatePerHour", 18, 10), num("BetaFactor", 8, 4), num("MissionTimeHours", 12, 2),
      num("CriticalityNumber", 18, 10, true),
      req("RecommendedActionFa", "text", { len: 1200 }), c("ActionOwnerId", "text", { len: 60 }), c("ActionDueOn", "date"),
      req("SortOrder", "int", { default: "0" }),
    ],
    indexes: [
      { name: "IX_CmmsFmeaEntry_Record", columns: ["FmeaRecordId", "SortOrder"] },
      { name: "IX_CmmsFmeaEntry_Rpn", columns: ["SiteId", "Rpn", "ActionPriority"] },
    ],
    foreignKeys: [
      { column: "FmeaRecordId", refTable: "CmmsFmeaRecord", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyFailureModeId", refTable: "CmmsFamilyFailureMode", refColumn: "Id", onDelete: "SET NULL" },
      { column: "FamilyNodeId", refTable: "CmmsFamilyNode", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsFmeaEntry_Severity", "Severity BETWEEN 1 AND 10", ["Severity"]),
      ck("CK_CmmsFmeaEntry_Occurrence", "Occurrence BETWEEN 1 AND 10", ["Occurrence"]),
      ck("CK_CmmsFmeaEntry_Detection", "Detection BETWEEN 1 AND 10", ["Detection"]),
      ck("CK_CmmsFmeaEntry_Rpn", "Rpn BETWEEN 1 AND 1000", ["Rpn"]),
      ck("CK_CmmsFmeaEntry_AP", "ActionPriority IS NULL OR ActionPriority IN ('high','medium','low')", ["ActionPriority"]),
    ],
  },

  /* 51 — تحلیل RCM طبق IEC 60300-3-11: تابع، حالت خرابی، پیامد و تصمیم. */
  {
    name: "CmmsRcmAnalysis", module: "cmms", title: { fa: "تحلیل RCM", en: "RCM analysis (IEC 60300-3-11)" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), code("AnalysisCode"), req("NameFa", "text", { len: 240 }),
      req("Status", "text", { len: 24, default: "'draft'", comment: "draft|in-review|approved|obsolete" }),
      c("TeamLeadId", "text", { len: 60 }), c("AnalyzedOn", "date"),
      req("FunctionCount", "int", { default: "0" }), req("FailureModeCount", "int", { default: "0" }),
      note(),
    ],
    indexes: [
      { name: "UX_CmmsRcmAnalysis_Code", columns: ["SiteId", "AnalysisCode"], unique: true },
      { name: "IX_CmmsRcmAnalysis_Family", columns: ["SiteId", "FamilyId", "Status"] },
    ],
    foreignKeys: [{ column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsRcmAnalysis_Status", "Status IN ('draft','in-review','approved','obsolete')", ["Status"]),
      ck("CK_CmmsRcmAnalysis_Counts", "FunctionCount >= 0 AND FailureModeCount >= 0", ["FunctionCount", "FailureModeCount"]),
    ],
  },

  /* 52 — ردیف RCM: یک تابع و یک حالت خرابی و تصمیم انتخاب‌شده. */
  {
    name: "CmmsRcmEntry", module: "cmms", title: { fa: "ردیف تصمیم RCM", en: "RCM decision entry" }, pk: "Id",
    columns: [
      id(), site(), hardRef("RcmAnalysisId"), c("FamilyFailureModeId", "text", { len: 60 }),
      req("FunctionStatementFa", "text", { len: 600 }), req("FunctionalFailureFa", "text", { len: 600 }),
      req("FailureMode", "text", { len: 40 }), req("Consequence", "text", { len: 28, comment: "safety-environmental|operational|non-operational|hidden" }),
      req("IsHiddenFailure", "bool", { default: "0" }), req("IsConditionMonitorable", "bool", { default: "0" }),
      req("HasAgeRelatedPattern", "bool", { default: "0" }),
      req("SelectedTask", "text", { len: 32, comment: "condition-based|scheduled-restoration|scheduled-discard|failure-finding|run-to-failure|redesign" }),
      num("TaskInterval", 18, 4), c("TaskIntervalUnit", "text", { len: 24 }),
      c("DecisionPathJson", "json", { comment: "مسیر تصمیم هفت‌گامی برای توضیح‌پذیری" }),
      req("SortOrder", "int", { default: "0" }),
    ],
    indexes: [
      { name: "IX_CmmsRcmEntry_Analysis", columns: ["RcmAnalysisId", "SortOrder"] },
      { name: "IX_CmmsRcmEntry_Task", columns: ["SiteId", "SelectedTask", "Consequence"] },
    ],
    foreignKeys: [
      { column: "RcmAnalysisId", refTable: "CmmsRcmAnalysis", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyFailureModeId", refTable: "CmmsFamilyFailureMode", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsRcmEntry_Consequence",
        "Consequence IN ('safety-environmental','operational','non-operational','hidden')", ["Consequence"]),
      ck("CK_CmmsRcmEntry_Task",
        "SelectedTask IN ('condition-based','scheduled-restoration','scheduled-discard','failure-finding','run-to-failure','redesign')", ["SelectedTask"]),
      ck("CK_CmmsRcmEntry_Interval", "TaskInterval IS NULL OR TaskInterval > 0", ["TaskInterval"]),
    ],
  },

  /* 53 — برنامهٔ نت مصوب؛ خروجی RCM/FMEA که به PM Schedule تبدیل می‌شود. */
  {
    name: "CmmsMaintenancePlan", module: "cmms", title: { fa: "برنامهٔ نگهداشت مصوب", en: "Approved maintenance plan" }, pk: "Id",
    columns: [
      id(), site(), hardRef("FamilyId"), c("RcmAnalysisId", "text", { len: 60 }), c("FmeaRecordId", "text", { len: 60 }),
      code("PlanCode"), req("NameFa", "text", { len: 240 }),
      req("StrategyType", "text", { len: 28 }), req("Version", "int", { default: "1" }),
      req("Status", "text", { len: 24, default: "'draft'", comment: "draft|approved|active|obsolete" }),
      c("ApprovedAt", "datetime"), c("ApprovedBy", "text", { len: 60 }),
      c("EffectiveFrom", "date"), c("EffectiveTo", "date"), note(),
    ],
    indexes: [
      { name: "UX_CmmsMaintenancePlan_Code", columns: ["SiteId", "PlanCode", "Version"], unique: true },
      { name: "IX_CmmsMaintenancePlan_Family", columns: ["SiteId", "FamilyId", "Status"] },
    ],
    foreignKeys: [
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "RcmAnalysisId", refTable: "CmmsRcmAnalysis", refColumn: "Id", onDelete: "SET NULL" },
      { column: "FmeaRecordId", refTable: "CmmsFmeaRecord", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsMaintenancePlan_Strategy",
        "StrategyType IN ('pm','cbm','predictive','risk-based','run-to-failure','zero-breakdown')", ["StrategyType"]),
      ck("CK_CmmsMaintenancePlan_Status", "Status IN ('draft','approved','active','obsolete')", ["Status"]),
      ck("CK_CmmsMaintenancePlan_Dates", "EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom", ["EffectiveFrom", "EffectiveTo"]),
    ],
  },

  /* 54 — پروندهٔ تحلیل ریشه‌ای (ماژول ۴ عملیاتی). */
  {
    name: "CmmsRcaCase", module: "cmms", title: { fa: "پروندهٔ تحلیل ریشه‌ای", en: "Root cause analysis case" }, pk: "Id",
    columns: [
      id(), site(), code("CaseNo"), hardRef("AssetId"), c("FailureRecordId", "text", { len: 60 }), c("WorkOrderId", "text", { len: 60 }),
      req("Method", "text", { len: 28, default: "'five-why'", comment: "five-why|fishbone|apollo|fault-tree|combined" }),
      req("Status", "text", { len: 24, default: "'open'", comment: "open|in-progress|closed|verified" }),
      req("OpenedOn", "date"), c("OpenedById", "text", { len: 60 }), c("ClosedOn", "date"),
      req("ProblemStatementFa", "text", { len: 1000 }), c("RootCauseFa", "text", { len: 2000 }),
      req("WhyDepth", "int", { default: "0" }), c("CorrectiveActionFa", "text", { len: 2000 }),
      c("PreventiveActionFa", "text", { len: 2000 }), c("EffectivenessVerifiedOn", "date"),
      num("EstimatedAvoidedCost", 18, 2), modelVersion(),
    ],
    indexes: [
      { name: "UX_CmmsRcaCase_No", columns: ["SiteId", "CaseNo"], unique: true },
      { name: "IX_CmmsRcaCase_Asset", columns: ["SiteId", "AssetId", "Status"] },
      { name: "IX_CmmsRcaCase_Failure", columns: ["SiteId", "FailureRecordId"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FailureRecordId", refTable: "CmmsFailureRecord", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsRcaCase_Method", "Method IN ('five-why','fishbone','apollo','fault-tree','combined')", ["Method"]),
      ck("CK_CmmsRcaCase_Status", "Status IN ('open','in-progress','closed','verified')", ["Status"]),
      ck("CK_CmmsRcaCase_Depth", "WhyDepth >= 0 AND WhyDepth <= 10", ["WhyDepth"]),
    ],
  },

  /* 55 — ردیف‌های RCFA: چراها، شاخه‌های استخوان ماهی و اقدام‌ها در یک جدول. */
  {
    name: "CmmsRcaEntry", module: "cmms", title: { fa: "ردیف تحلیل ریشه‌ای", en: "RCA entry (why / cause / action)" }, pk: "Id",
    columns: [
      id(), site(), hardRef("RcaCaseId"), req("EntryType", "text", { len: 24, comment: "why|cause-branch|evidence|corrective-action|preventive-action" }),
      req("Sequence", "int"), c("ParentEntryId", "text", { len: 60 }),
      req("StatementFa", "text", { len: 1200 }),
      c("FishboneCategory", "text", { len: 28, comment: "man|machine|method|material|measurement|environment" }),
      req("IsRootCause", "bool", { default: "0" }), c("EvidencePath", "text", { len: 600 }),
      c("OwnerId", "text", { len: 60 }), c("DueOn", "date"), c("CompletedOn", "date"),
      c("AiSuggested", "bool", { default: "0" }), num("AiConfidence", 8, 4),
    ],
    indexes: [
      { name: "UX_CmmsRcaEntry_Seq", columns: ["RcaCaseId", "EntryType", "Sequence"], unique: true },
      { name: "IX_CmmsRcaEntry_Root", columns: ["SiteId", "IsRootCause"] },
    ],
    foreignKeys: [
      { column: "RcaCaseId", refTable: "CmmsRcaCase", refColumn: "Id", onDelete: "CASCADE" },
      { column: "ParentEntryId", refTable: "CmmsRcaEntry", refColumn: "Id", onDelete: "NO ACTION" },
    ],
    checks: [
      ck("CK_CmmsRcaEntry_Type",
        "EntryType IN ('why','cause-branch','evidence','corrective-action','preventive-action')", ["EntryType"]),
      ck("CK_CmmsRcaEntry_Seq", "Sequence >= 1", ["Sequence"]),
      ck("CK_CmmsRcaEntry_Fishbone",
        "FishboneCategory IS NULL OR FishboneCategory IN ('man','machine','method','material','measurement','environment')", ["FishboneCategory"]),
      ck("CK_CmmsRcaEntry_Confidence", "AiConfidence IS NULL OR (AiConfidence >= 0 AND AiConfidence <= 1)", ["AiConfidence"]),
      ck("CK_CmmsRcaEntry_Self", "ParentEntryId IS NULL OR ParentEntryId <> Id", ["ParentEntryId"]),
    ],
  },

  /* ═══════════════ ح) شاخص‌ها، هزینه و هشدار ═══════════════ */

  /* 56 — تصویر قابلیت اطمینان؛ MTBF/MTTF/MTTR و در دسترس‌بودن. */
  {
    name: "CmmsReliabilitySnapshot", module: "cmms", title: { fa: "تصویر قابلیت اطمینان", en: "Reliability snapshot" }, pk: "Id",
    columns: [
      id(), site(), c("AssetId", "text", { len: 60 }), c("FamilyId", "text", { len: 60 }), c("LocationId", "text", { len: 60 }),
      req("PeriodType", "text", { len: 16, comment: "daily|weekly|monthly|quarterly|yearly" }),
      req("PeriodStart", "date"), req("PeriodEnd", "date"),
      req("CalendarHours", "decimal", { precision: 12, scale: 2, default: "0" }),
      req("OperatingHours", "decimal", { precision: 12, scale: 2, default: "0" }),
      req("DowntimeHours", "decimal", { precision: 12, scale: 2, default: "0" }),
      req("FailureCount", "int", { default: "0" }),
      num("MtbfHours", 18, 4), num("MttfHours", 18, 4), num("MttrHours", 18, 4),
      num("FailureRateLambda", 18, 10), num("AvailabilityPct", 9, 4), num("InherentAvailabilityPct", 9, 4),
      num("ReliabilityAtMission", 9, 6), num("MissionTimeHours", 12, 2),
      num("MeanTimeBetweenPmHours", 18, 4), num("PmCompliancePct", 9, 4),
      modelVersion(),
    ],
    indexes: [
      { name: "UX_CmmsReliabilitySnapshot_Key", columns: ["SiteId", "AssetId", "FamilyId", "PeriodType", "PeriodStart"], unique: true },
      { name: "IX_CmmsReliabilitySnapshot_Period", columns: ["SiteId", "PeriodType", "PeriodEnd"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "LocationId", refTable: "CmmsLocation", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsReliabilitySnapshot_Period", "PeriodType IN ('daily','weekly','monthly','quarterly','yearly')", ["PeriodType"]),
      ck("CK_CmmsReliabilitySnapshot_Dates", "PeriodEnd >= PeriodStart", ["PeriodStart", "PeriodEnd"]),
      ck("CK_CmmsReliabilitySnapshot_Failures", "FailureCount >= 0", ["FailureCount"]),
      ck("CK_CmmsReliabilitySnapshot_Avail", "AvailabilityPct IS NULL OR (AvailabilityPct >= 0 AND AvailabilityPct <= 100)", ["AvailabilityPct"]),
      ck("CK_CmmsReliabilitySnapshot_Mtbf", "MtbfHours IS NULL OR MtbfHours > 0", ["MtbfHours"]),
    ],
  },

  /* 57 — تصویر OEE نسخهٔ ۲ با تفکیک شش اتلاف بزرگ. */
  {
    name: "CmmsOeeSnapshot", module: "cmms", title: { fa: "تصویر OEE", en: "OEE snapshot (v2)" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), req("PeriodType", "text", { len: 16 }), req("PeriodStart", "date"), req("PeriodEnd", "date"),
      req("PlannedProductionHours", "decimal", { precision: 12, scale: 2, default: "0" }),
      req("RunHours", "decimal", { precision: 12, scale: 2, default: "0" }),
      num("BreakdownHours", 12, 3), num("SetupHours", 12, 3), num("MinorStopHours", 12, 3),
      num("ReducedSpeedHours", 12, 3), num("StartupRejectUnits", 18, 4), num("ProductionRejectUnits", 18, 4),
      num("TotalUnits", 18, 4), num("IdealCycleTimeSeconds", 12, 4),
      num("AvailabilityPct", 9, 4), num("PerformancePct", 9, 4), num("QualityPct", 9, 4),
      num("OeePct", 9, 4), num("TeepPct", 9, 4), num("CalendarHours", 12, 2),
      modelVersion(),
    ],
    indexes: [
      { name: "UX_CmmsOeeSnapshot_Key", columns: ["SiteId", "AssetId", "PeriodType", "PeriodStart"], unique: true },
      { name: "IX_CmmsOeeSnapshot_Period", columns: ["SiteId", "PeriodType", "PeriodEnd"] },
    ],
    foreignKeys: [{ column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsOeeSnapshot_Period", "PeriodType IN ('daily','weekly','monthly','quarterly','yearly')", ["PeriodType"]),
      ck("CK_CmmsOeeSnapshot_Dates", "PeriodEnd >= PeriodStart", ["PeriodStart", "PeriodEnd"]),
      ck("CK_CmmsOeeSnapshot_Oee", "OeePct IS NULL OR (OeePct >= 0 AND OeePct <= 100)", ["OeePct"]),
      ck("CK_CmmsOeeSnapshot_Avail", "AvailabilityPct IS NULL OR (AvailabilityPct >= 0 AND AvailabilityPct <= 100)", ["AvailabilityPct"]),
      ck("CK_CmmsOeeSnapshot_Units", "TotalUnits IS NULL OR TotalUnits >= 0", ["TotalUnits"]),
    ],
  },

  /* 58 — شاخص‌های قابلیت اطمینان تأمین/شبکه طبق IEEE 1366. */
  {
    name: "CmmsSupplyReliability", module: "cmms", title: { fa: "شاخص قابلیت اطمینان IEEE 1366", en: "Supply reliability (IEEE 1366)" }, pk: "Id",
    columns: [
      id(), site(), c("LocationId", "text", { len: 60 }), req("PeriodType", "text", { len: 16 }),
      req("PeriodStart", "date"), req("PeriodEnd", "date"),
      req("CustomersServed", "int", { default: "0" }), req("TotalInterruptions", "int", { default: "0" }),
      req("CustomersInterrupted", "int", { default: "0" }),
      num("TotalCustomerInterruptionMinutes", 18, 2), num("TotalCustomerMinutesAffected", 18, 2),
      num("SaidiMinutes", 18, 4), num("SaifiCount", 18, 4), num("CaidiMinutes", 18, 4),
      num("AsaiPct", 12, 8), num("MaifiCount", 18, 4), num("EnrsCurrency", 18, 2),
      req("ExcludeMajorEvents", "bool", { default: "0", comment: "محاسبه با/بدون رویدادهای عمده — IEEE 1366 بند ۴" }),
      modelVersion(),
    ],
    indexes: [
      { name: "UX_CmmsSupplyReliability_Key", columns: ["SiteId", "LocationId", "PeriodType", "PeriodStart"], unique: true },
      { name: "IX_CmmsSupplyReliability_Period", columns: ["SiteId", "PeriodType", "PeriodEnd"] },
    ],
    foreignKeys: [{ column: "LocationId", refTable: "CmmsLocation", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsSupplyReliability_Period", "PeriodType IN ('daily','weekly','monthly','quarterly','yearly')", ["PeriodType"]),
      ck("CK_CmmsSupplyReliability_Customers", "CustomersServed >= 0", ["CustomersServed"]),
      ck("CK_CmmsSupplyReliability_Asai", "AsaiPct IS NULL OR (AsaiPct >= 0 AND AsaiPct <= 100)", ["AsaiPct"]),
    ],
  },

  /* 59 — هزینهٔ چرخهٔ عمر دارایی طبق IEC 60300-3-3. */
  {
    name: "CmmsLccRecord", module: "cmms", title: { fa: "هزینهٔ چرخهٔ عمر (LCC)", en: "Life cycle cost record" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AssetId"), c("ScenarioName", "text", { len: 200 }),
      req("AnalysisDate", "date"), req("LifeYears", "int"), num("DiscountRatePct", 9, 4),
      money("AcquisitionCost"), money("InstallationCost"), money("OperatingCostPerYear"),
      money("MaintenanceCostPerYear"), money("DowntimeLossPerYear"), money("EnergyCostPerYear"),
      money("DisposalCost"), money("ResidualValue"),
      money("NpvAcquisition"), money("NpvOperation"), money("NpvMaintenance"),
      money("NpvDowntime"), money("NpvDisposal"), money("TotalNpv"),
      num("CostPerOperatingHour", 18, 4), num("CostPerUnitProduced", 18, 4),
      req("IsSelectedOption", "bool", { default: "0" }), note(), modelVersion(),
    ],
    indexes: [
      { name: "IX_CmmsLccRecord_Asset", columns: ["SiteId", "AssetId", "AnalysisDate"] },
      { name: "IX_CmmsLccRecord_Selected", columns: ["SiteId", "IsSelectedOption"] },
    ],
    foreignKeys: [{ column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" }],
    checks: [
      ck("CK_CmmsLccRecord_Life", "LifeYears > 0", ["LifeYears"]),
      ck("CK_CmmsLccRecord_Rate", "DiscountRatePct IS NULL OR DiscountRatePct >= 0", ["DiscountRatePct"]),
    ],
  },

  /* 60 — ثبت هزینهٔ نت در سطح دارایی/دوره؛ خوراک داشبورد و EN 15341. */
  {
    name: "CmmsCostRecord", module: "cmms", title: { fa: "ثبت هزینهٔ نت", en: "Maintenance cost record" }, pk: "Id",
    columns: [
      id(), site(), c("AssetId", "text", { len: 60 }), c("FamilyId", "text", { len: 60 }),
      req("CostElement", "text", { len: 28, comment: "labor|material|contract|tool|overhead|downtime-loss|capital" }),
      req("PeriodType", "text", { len: 16 }), req("PeriodStart", "date"), req("PeriodEnd", "date"),
      money("Amount"), req("Currency", "text", { len: 8, default: "'IRR'" }),
      c("WorkOrderId", "text", { len: 60 }), c("VendorId", "text", { len: 60 }),
      num("CostPerReplacementAssetValue", 9, 4, true), note(),
    ],
    indexes: [
      { name: "IX_CmmsCostRecord_Asset", columns: ["SiteId", "AssetId", "PeriodStart"] },
      { name: "IX_CmmsCostRecord_Element", columns: ["SiteId", "CostElement", "PeriodType", "PeriodStart"] },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "VendorId", refTable: "CmmsVendor", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsCostRecord_Element",
        "CostElement IN ('labor','material','contract','tool','overhead','downtime-loss','capital')", ["CostElement"]),
      ck("CK_CmmsCostRecord_Period", "PeriodType IN ('daily','weekly','monthly','quarterly','yearly')", ["PeriodType"]),
      ck("CK_CmmsCostRecord_Dates", "PeriodEnd >= PeriodStart", ["PeriodStart", "PeriodEnd"]),
    ],
  },

  /* 61 — تعریف و هدف KPI طبق BS EN 15341 (سه دستهٔ فنی/اقتصادی/سازمانی). */
  {
    name: "CmmsKpiTarget", module: "cmms", title: { fa: "هدف شاخص عملکرد نت", en: "Maintenance KPI target (EN 15341)" }, pk: "Id",
    columns: [
      id(), site(), code("KpiCode"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("Category", "text", { len: 28, comment: "technical|economic|organizational — EN 15341" }),
      req("Uom", "text", { len: 24 }), req("Direction", "text", { len: 16, default: "'maximize'", comment: "maximize|minimize|target" }),
      num("TargetValue", 18, 4), num("WarnThreshold", 18, 4), num("AlarmThreshold", 18, 4),
      req("PeriodType", "text", { len: 16, default: "'monthly'" }), req("IsActive", "bool", { default: "1" }),
      c("FormulaFa", "text", { len: 800, comment: "تعریف محاسباتی شاخص برای شفافیت" }), note(),
    ],
    indexes: [
      { name: "UX_CmmsKpiTarget_Code", columns: ["SiteId", "KpiCode"], unique: true },
      { name: "IX_CmmsKpiTarget_Category", columns: ["SiteId", "Category", "IsActive"] },
    ],
    checks: [
      ck("CK_CmmsKpiTarget_Category", "Category IN ('technical','economic','organizational')", ["Category"]),
      ck("CK_CmmsKpiTarget_Direction", "Direction IN ('maximize','minimize','target')", ["Direction"]),
      ck("CK_CmmsKpiTarget_Period", "PeriodType IN ('daily','weekly','monthly','quarterly','yearly')", ["PeriodType"]),
    ],
  },

  /* 62 — نتیجهٔ دوره‌ای KPI. */
  {
    name: "CmmsKpiResult", module: "cmms", title: { fa: "نتیجهٔ شاخص عملکرد نت", en: "Maintenance KPI result" }, pk: "Id",
    columns: [
      id(), site(), hardRef("KpiTargetId"), c("AssetId", "text", { len: 60 }), c("FamilyId", "text", { len: 60 }),
      req("PeriodType", "text", { len: 16 }), req("PeriodStart", "date"), req("PeriodEnd", "date"),
      req("ActualValue", "decimal", { precision: 18, scale: 6 }), num("TargetValue", 18, 4),
      num("VariancePct", 9, 4), req("Health", "text", { len: 16, default: "'green'", comment: "green|amber|red" }),
      c("ComputedBy", "text", { len: 40, comment: "engine|manual" }), modelVersion(),
    ],
    indexes: [
      { name: "UX_CmmsKpiResult_Key", columns: ["KpiTargetId", "AssetId", "FamilyId", "PeriodType", "PeriodStart"], unique: true },
      { name: "IX_CmmsKpiResult_Health", columns: ["SiteId", "Health", "PeriodEnd"] },
    ],
    foreignKeys: [
      { column: "KpiTargetId", refTable: "CmmsKpiTarget", refColumn: "Id", onDelete: "CASCADE" },
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
    ],
    checks: [
      ck("CK_CmmsKpiResult_Health", "Health IN ('green','amber','red')", ["Health"]),
      ck("CK_CmmsKpiResult_Dates", "PeriodEnd >= PeriodStart", ["PeriodStart", "PeriodEnd"]),
    ],
  },

  /* 63 — هشدار و اعلان بلادرنگ (ماژول ۱۹ عملیاتی)؛ کانال‌ها در همین جدول. */
  {
    name: "CmmsAlert", module: "cmms", title: { fa: "هشدار و اعلان نت", en: "Maintenance alert and notification" }, pk: "Id",
    columns: [
      id(), site(), req("AlertCode", "text", { len: 60 }), req("Severity", "text", { len: 16, comment: "critical|high|medium|low" }),
      req("Category", "text", { len: 28, comment: "condition|pm-due|pm-overdue|spare-shortage|sla-breach|safety|reliability|ai-insight" }),
      req("TitleFa", "text", { len: 300 }), c("MessageFa", "text", { len: 2000 }),
      c("AssetId", "text", { len: 60 }), c("FamilyId", "text", { len: 60 }), c("WorkOrderId", "text", { len: 60 }),
      c("ConditionReadingId", "text", { len: 60 }), c("AiRecommendationId", "text", { len: 60 }),
      req("Status", "text", { len: 24, default: "'open'", comment: "open|acknowledged|resolved|suppressed" }),
      req("RaisedAt", "datetime"), c("AcknowledgedAt", "datetime"), c("AcknowledgedById", "text", { len: 60 }),
      c("ResolvedAt", "datetime"), c("ResolutionNoteFa", "text", { len: 1000 }),
      req("NotifyInApp", "bool", { default: "1" }), req("NotifyEmail", "bool", { default: "0" }), req("NotifySms", "bool", { default: "0" }),
      c("DeliveredToJson", "json", { comment: "فهرست گیرندگان و زمان تحویل" }),
    ],
    indexes: [
      { name: "IX_CmmsAlert_Status", columns: ["SiteId", "Status", "Severity"] },
      { name: "IX_CmmsAlert_Asset", columns: ["SiteId", "AssetId", "RaisedAt"] },
      { name: "IX_CmmsAlert_Category", columns: ["SiteId", "Category", "Status"] },
      { name: "UX_CmmsAlert_Code", columns: ["SiteId", "AlertCode", "RaisedAt"], unique: true },
    ],
    foreignKeys: [
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "FamilyId", refTable: "CmmsFamily", refColumn: "Id", onDelete: "CASCADE" },
      { column: "WorkOrderId", refTable: "CmmsWorkOrder", refColumn: "Id", onDelete: "CASCADE" },
      { column: "ConditionReadingId", refTable: "CmmsConditionReading", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsAlert_Severity", "Severity IN ('critical','high','medium','low')", ["Severity"]),
      ck("CK_CmmsAlert_Category",
        "Category IN ('condition','pm-due','pm-overdue','spare-shortage','sla-breach','safety','reliability','ai-insight')", ["Category"]),
      ck("CK_CmmsAlert_Status", "Status IN ('open','acknowledged','resolved','suppressed')", ["Status"]),
      ck("CK_CmmsAlert_Ack", "Status NOT IN ('acknowledged','resolved') OR AcknowledgedAt IS NOT NULL", ["Status", "AcknowledgedAt"]),
    ],
  },

  /* ═══════════════ ط) لایهٔ هوش مصنوعی ═══════════════ */

  /* 64 — اجرای یک موتور AI با ثبت ورودی/خروجی برای بازتولیدپذیری و ممیزی. */
  {
    name: "CmmsAiRun", module: "cmms", title: { fa: "اجرای موتور هوش مصنوعی نت", en: "CMMS AI engine run" }, pk: "Id",
    columns: [
      id(), site(), req("Engine", "text", { len: 32, comment: "failure-analysis|pm-optimization|repair-guidance|tree-generator|smart-scheduler" }),
      req("EngineVersion", "text", { len: 40 }), req("RanAt", "datetime"), c("RanById", "text", { len: 60 }),
      c("SubjectEntity", "text", { len: 60 }), c("SubjectId", "text", { len: 60 }),
      c("InputSnapshotJson", "json"), c("OutputSummaryJson", "json"),
      req("RecommendationCount", "int", { default: "0" }), num("ElapsedMilliseconds", 12, 2),
      req("Status", "text", { len: 24, default: "'succeeded'", comment: "succeeded|failed|partial" }),
      c("ErrorMessageFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "IX_CmmsAiRun_Engine", columns: ["SiteId", "Engine", "RanAt"] },
      { name: "IX_CmmsAiRun_Subject", columns: ["SiteId", "SubjectEntity", "SubjectId"] },
    ],
    checks: [
      ck("CK_CmmsAiRun_Engine",
        "Engine IN ('failure-analysis','pm-optimization','repair-guidance','tree-generator','smart-scheduler')", ["Engine"]),
      ck("CK_CmmsAiRun_Status", "Status IN ('succeeded','failed','partial')", ["Status"]),
      ck("CK_CmmsAiRun_Count", "RecommendationCount >= 0", ["RecommendationCount"]),
    ],
  },

  /* 65 — پیشنهاد تولیدشده توسط AI با دلیل و اطمینان؛ بدون «جعبهٔ سیاه». */
  {
    name: "CmmsAiRecommendation", module: "cmms", title: { fa: "پیشنهاد هوش مصنوعی نت", en: "CMMS AI recommendation" }, pk: "Id",
    columns: [
      id(), site(), hardRef("AiRunId"), req("Engine", "text", { len: 32 }),
      req("RecommendationType", "text", { len: 32, comment: "root-cause|pm-interval|repair-action|spare-needed|tree-node|schedule-slot" }),
      req("TitleFa", "text", { len: 300 }), c("ExplanationFa", "text", { len: 2000, comment: "دلیل قابل‌خواندن برای انسان" }),
      num("Confidence", 8, 4), req("Priority", "int", { default: "3" }),
      c("AssetId", "text", { len: 60 }), c("FamilyId", "text", { len: 60 }), c("WorkOrderId", "text", { len: 60 }),
      c("SparePartId", "text", { len: 60 }), c("TechnicianId", "text", { len: 60 }),
      c("SuggestedValueJson", "json", { comment: "مقدار پیشنهادی ساخت‌یافته؛ مثلاً فاصلهٔ جدید PM" }),
      c("EvidenceJson", "json", { comment: "شواهد و رکوردهای تاریخی پشت پیشنهاد" }),
      req("Status", "text", { len: 24, default: "'proposed'", comment: "proposed|accepted|rejected|applied" }),
      c("DecidedById", "text", { len: 60 }), c("DecidedAt", "datetime"), c("DecisionNoteFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "IX_CmmsAiRecommendation_Run", columns: ["AiRunId", "Priority"] },
      { name: "IX_CmmsAiRecommendation_Asset", columns: ["SiteId", "AssetId", "Status"] },
      { name: "IX_CmmsAiRecommendation_Engine", columns: ["SiteId", "Engine", "RecommendationType"] },
    ],
    foreignKeys: [
      { column: "AiRunId", refTable: "CmmsAiRun", refColumn: "Id", onDelete: "CASCADE" },
      { column: "AssetId", refTable: "CmmsAsset", refColumn: "Id", onDelete: "CASCADE" },
      { column: "SparePartId", refTable: "CmmsSparePart", refColumn: "Id", onDelete: "SET NULL" },
      { column: "TechnicianId", refTable: "CmmsTechnician", refColumn: "Id", onDelete: "SET NULL" },
    ],
    checks: [
      ck("CK_CmmsAiRecommendation_Confidence", "Confidence IS NULL OR (Confidence >= 0 AND Confidence <= 1)", ["Confidence"]),
      ck("CK_CmmsAiRecommendation_Priority", "Priority BETWEEN 1 AND 5", ["Priority"]),
      ck("CK_CmmsAiRecommendation_Status", "Status IN ('proposed','accepted','rejected','applied')", ["Status"]),
      ck("CK_CmmsAiRecommendation_Type",
        "RecommendationType IN ('root-cause','pm-interval','repair-action','spare-needed','tree-node','schedule-slot')", ["RecommendationType"]),
      ck("CK_CmmsAiRecommendation_Decide", "Status IN ('proposed','rejected') OR DecidedAt IS NOT NULL", ["Status", "DecidedAt"]),
    ],
  },
];

/** نام همهٔ جدول‌های CMMS — برای آزمون‌ها و تولید مهاجرت. */
export const CMMS_TABLE_NAMES: string[] = CMMS_TABLES.map((t) => t.name);
