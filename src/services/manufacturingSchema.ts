/**
 * اسکیمای ماژول تولید عملیات‌محور.
 * نام فیزیکی جدول‌ها با پیشوند Mfg است تا با جداول قدیمی SCM/Finance تداخل نکند.
 * ستون‌های حسابرسی از AUDIT_COLUMNS در persistence.ts به‌طور خودکار افزوده می‌شوند.
 */
import type { ColumnDef, TableDef } from "./persistence";

const c = (name: string, kind: ColumnDef["kind"], extra: Partial<ColumnDef> = {}): ColumnDef => ({ name, kind, nullable: true, ...extra });
const req = (name: string, kind: ColumnDef["kind"], extra: Partial<ColumnDef> = {}): ColumnDef => ({ name, kind, nullable: false, ...extra });
const id = (): ColumnDef => req("Id", "text", { len: 60 });
const qty = (name: string, nullable = false): ColumnDef => ({ name, kind: "decimal", precision: 18, scale: 4, nullable });
const mins = (name: string, nullable = false): ColumnDef => ({ name, kind: "decimal", precision: 12, scale: 3, nullable });
const money = (name: string, nullable = true): ColumnDef => ({ name, kind: "decimal", precision: 18, scale: 2, nullable });
const pct = (name: string, nullable = true): ColumnDef => ({ name, kind: "decimal", precision: 7, scale: 3, nullable });
const ck = (name: string, expression: string, columns: string[]) => ({ name, expression, columns });
const plant = () => req("PlantId", "text", { len: 60, comment: "دامنهٔ اصلی تولید؛ مستقل از ProjectId" });
const code = (name = "Code") => req(name, "text", { len: 60 });
const status = (comment: string, initial = "'draft'") => req("Status", "text", { len: 24, default: initial, comment });

/** ۲۶ جدول منطقی تولید؛ همه در ماژول مستقل `mfg` ثبت می‌شوند. */
export const MANUFACTURING_TABLES: TableDef[] = [
  /* 01 — قطعه/محصول؛ شناسهٔ یکتا در محدودهٔ کارخانه. */
  {
    name: "MfgPart", module: "mfg", title: { fa: "قطعه و محصول", en: "Part and product" }, pk: "Id",
    columns: [
      id(), plant(), code("PartNo"), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("PartType", "text", { len: 20, comment: "manufactured|purchased|phantom|subcontract" }),
      req("BaseUom", "text", { len: 16 }), c("DescriptionFa", "text", { len: 1200 }),
      money("StandardUnitCost"), req("Currency", "text", { len: 8, default: "'IRR'" }),
      req("IsLotTracked", "bool", { default: "0" }), req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_MfgPart_PlantNo", columns: ["PlantId", "PartNo"], unique: true },
      { name: "IX_MfgPart_Type", columns: ["PlantId", "PartType", "IsActive"] },
    ],
    checks: [
      ck("CK_MfgPart_Type", "PartType IN ('manufactured','purchased','phantom','subcontract')", ["PartType"]),
      ck("CK_MfgPart_Cost", "StandardUnitCost IS NULL OR StandardUnitCost >= 0", ["StandardUnitCost"]),
    ],
  },

  /* 02 — سربرگ نسخه‌دار BOM. چرخهٔ BOM با پیمایش گراف در منطق دامنه کنترل می‌شود. */
  {
    name: "MfgBomHeader", module: "mfg", title: { fa: "نسخهٔ BOM", en: "BOM header" }, pk: "Id",
    columns: [
      id(), plant(), req("PartId", "text", { len: 60 }), code("Revision"), status("draft|released|obsolete"),
      req("BaseQuantity", "decimal", { precision: 18, scale: 4, default: "1" }), req("BaseUom", "text", { len: 16 }),
      req("EffectiveFrom", "date"), c("EffectiveTo", "date"), req("IsDefault", "bool", { default: "0" }),
      c("ReleasedAt", "datetime"), c("ReleasedBy", "text", { len: 60 }), c("NoteFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "UX_MfgBomHeader_Revision", columns: ["PlantId", "PartId", "Revision"], unique: true },
      { name: "IX_MfgBomHeader_Effective", columns: ["PlantId", "PartId", "Status", "EffectiveFrom"] },
    ],
    foreignKeys: [{ column: "PartId", refTable: "MfgPart", refColumn: "Id" }],
    checks: [
      ck("CK_MfgBomHeader_Status", "Status IN ('draft','released','obsolete')", ["Status"]),
      ck("CK_MfgBomHeader_BaseQty", "BaseQuantity > 0", ["BaseQuantity"]),
      ck("CK_MfgBomHeader_Dates", "EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom", ["EffectiveFrom", "EffectiveTo"]),
      ck("CK_MfgBomHeader_Release", "Status <> 'released' OR (ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL)", ["Status", "ReleasedAt", "ReleasedBy"]),
    ],
  },

  /* 03 — ردیف BOM؛ چندسطحی با ارجاع به Part فرزند. */
  {
    name: "MfgBomItem", module: "mfg", title: { fa: "ردیف BOM", en: "BOM item" }, pk: "Id",
    columns: [
      id(), plant(), req("BomHeaderId", "text", { len: 60 }), req("LineNo", "int"), req("ComponentPartId", "text", { len: 60 }),
      qty("QuantityPer"), req("Uom", "text", { len: 16 }), pct("ScrapPct", false),
      c("IssueAtOperationCode", "text", { len: 40, comment: "کد Operation محل مصرف؛ تطبیق با Routing در لایهٔ دامنه" }),
      req("IssueMethod", "text", { len: 16, default: "'manual'", comment: "manual|backflush|kit" }),
      req("IsPhantom", "bool", { default: "0" }), c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_MfgBomItem_Line", columns: ["BomHeaderId", "LineNo"], unique: true },
      { name: "IX_MfgBomItem_Component", columns: ["PlantId", "ComponentPartId"] },
    ],
    foreignKeys: [
      { column: "BomHeaderId", refTable: "MfgBomHeader", refColumn: "Id" },
      { column: "ComponentPartId", refTable: "MfgPart", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgBomItem_Line", "LineNo > 0", ["LineNo"]),
      ck("CK_MfgBomItem_Qty", "QuantityPer > 0", ["QuantityPer"]),
      ck("CK_MfgBomItem_Scrap", "ScrapPct >= 0 AND ScrapPct <= 100", ["ScrapPct"]),
      ck("CK_MfgBomItem_Issue", "IssueMethod IN ('manual','backflush','kit')", ["IssueMethod"]),
    ],
  },

  /* 21 — مرکز هزینه پیش از Work Center می‌آید تا FK در نصب تازه برقرار باشد. */
  {
    name: "MfgCostCenter", module: "mfg", title: { fa: "مرکز هزینهٔ تولید", en: "Manufacturing cost center" }, pk: "Id",
    columns: [
      id(), plant(), code(), req("NameFa", "text", { len: 240 }),
      req("CostElement", "text", { len: 16, comment: "machine|labor|overhead" }),
      req("HourlyRate", "decimal", { precision: 18, scale: 4 }), req("Currency", "text", { len: 8, default: "'IRR'" }),
      req("AllocationBasis", "text", { len: 20, default: "'machine_hours'", comment: "machine_hours|labor_hours|units|percent" }),
      req("EffectiveFrom", "date"), c("EffectiveTo", "date"), req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_MfgCostCenter_Rate", columns: ["PlantId", "Code", "EffectiveFrom"], unique: true },
      { name: "IX_MfgCostCenter_Element", columns: ["PlantId", "CostElement", "IsActive"] },
    ],
    checks: [
      ck("CK_MfgCostCenter_Element", "CostElement IN ('machine','labor','overhead')", ["CostElement"]),
      ck("CK_MfgCostCenter_Rate", "HourlyRate >= 0", ["HourlyRate"]),
      ck("CK_MfgCostCenter_Basis", "AllocationBasis IN ('machine_hours','labor_hours','units','percent')", ["AllocationBasis"]),
      ck("CK_MfgCostCenter_Dates", "EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom", ["EffectiveFrom", "EffectiveTo"]),
    ],
  },

  /* 04 — مرکز کاری؛ ظرفیت اسمی راهنماست و ظرفیت قابل‌استفاده از تقویم/منابع محاسبه می‌شود. */
  {
    name: "MfgWorkCenter", module: "mfg", title: { fa: "مرکز کاری", en: "Work center" }, pk: "Id",
    columns: [
      id(), plant(), code(), req("NameFa", "text", { len: 240 }), c("NameEn", "text", { len: 240 }),
      req("Kind", "text", { len: 20, comment: "machine|labor|assembly|inspection" }),
      req("NominalCapacityMinutesPerDay", "int", { default: "480" }), pct("EfficiencyPct", false),
      c("CostCenterId", "text", { len: 60 }), req("TimeZoneId", "text", { len: 80, comment: "مثلاً Asia/Tehran" }),
      status("active|inactive|maintenance", "'active'"), c("DescriptionFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "UX_MfgWorkCenter_Code", columns: ["PlantId", "Code"], unique: true },
      { name: "IX_MfgWorkCenter_Status", columns: ["PlantId", "Status", "Kind"] },
    ],
    foreignKeys: [{ column: "CostCenterId", refTable: "MfgCostCenter", refColumn: "Id" }],
    checks: [
      ck("CK_MfgWorkCenter_Kind", "Kind IN ('machine','labor','assembly','inspection')", ["Kind"]),
      ck("CK_MfgWorkCenter_Capacity", "NominalCapacityMinutesPerDay > 0", ["NominalCapacityMinutesPerDay"]),
      ck("CK_MfgWorkCenter_Efficiency", "EfficiencyPct >= 0 AND EfficiencyPct <= 100", ["EfficiencyPct"]),
      ck("CK_MfgWorkCenter_Status", "Status IN ('active','inactive','maintenance')", ["Status"]),
    ],
  },

  /* 05 — منابع فیزیکی/نیروی انسانی تخصیص‌پذیر به مرکز کاری. */
  {
    name: "MfgWorkCenterResource", module: "mfg", title: { fa: "منبع مرکز کاری", en: "Work center resource" }, pk: "Id",
    columns: [
      id(), plant(), req("WorkCenterId", "text", { len: 60 }), code("ResourceCode"), req("NameFa", "text", { len: 200 }),
      req("ResourceKind", "text", { len: 12, comment: "machine|labor" }), qty("CapacityUnits"), pct("AvailabilityPct", false),
      c("EquipmentId", "text", { len: 60, comment: "کلید نرم تجهیز بیرونی برای تبادل REST API؛ بدون وابستگی FK" }),
      c("CostCenterId", "text", { len: 60 }), req("IsActive", "bool", { default: "1" }),
      c("EffectiveFrom", "date"), c("EffectiveTo", "date"),
    ],
    indexes: [
      { name: "UX_MfgWcResource_Code", columns: ["WorkCenterId", "ResourceCode"], unique: true },
      { name: "IX_MfgWcResource_Active", columns: ["PlantId", "WorkCenterId", "IsActive"] },
    ],
    foreignKeys: [
      { column: "WorkCenterId", refTable: "MfgWorkCenter", refColumn: "Id" },
      { column: "CostCenterId", refTable: "MfgCostCenter", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgWcResource_Kind", "ResourceKind IN ('machine','labor')", ["ResourceKind"]),
      ck("CK_MfgWcResource_Capacity", "CapacityUnits > 0", ["CapacityUnits"]),
      ck("CK_MfgWcResource_Availability", "AvailabilityPct >= 0 AND AvailabilityPct <= 100", ["AvailabilityPct"]),
      ck("CK_MfgWcResource_Dates", "EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom", ["EffectiveFrom", "EffectiveTo"]),
    ],
  },

  /* 06 — الگوی هفتگی و استثنای روزانهٔ تقویم/شیفت. ساعت به دقیقه از نیمه‌شب محلی ذخیره می‌شود؛ پایانِ روز بعد تا ۲۸۷۹ مجاز است. */
  {
    name: "MfgWorkCenterCalendar", module: "mfg", title: { fa: "تقویم و شیفت مرکز کاری", en: "Work center calendar" }, pk: "Id",
    columns: [
      id(), plant(), req("WorkCenterId", "text", { len: 60 }),
      req("RuleType", "text", { len: 16, comment: "weekly|date-override" }), req("RuleKey", "text", { len: 100 }),
      c("WeekdayIso", "int", { comment: "۱=دوشنبه تا ۷=یکشنبه" }), c("CalendarDate", "date"), code("ShiftCode"),
      c("StartMinuteOfDay", "int"), c("EndMinuteOfDay", "int"), req("BreakMinutes", "int", { default: "0" }),
      c("BreakStartMinuteOfDay", "int", { comment: "nullable؛ برای BreakMinutes > 0 نقطهٔ شروع استراحت در شیفت محلی" }),
      req("IsWorking", "bool", { default: "1" }), pct("AvailabilityPct", false), req("EffectiveFrom", "date"), c("EffectiveTo", "date"),
    ],
    indexes: [
      { name: "UX_MfgWcCalendar_Rule", columns: ["WorkCenterId", "RuleKey"], unique: true },
      { name: "IX_MfgWcCalendar_Date", columns: ["PlantId", "WorkCenterId", "CalendarDate"] },
    ],
    foreignKeys: [{ column: "WorkCenterId", refTable: "MfgWorkCenter", refColumn: "Id" }],
    checks: [
      ck("CK_MfgWcCalendar_Type", "RuleType IN ('weekly','date-override')", ["RuleType"]),
      ck("CK_MfgWcCalendar_KeyShape", "(RuleType = 'weekly' AND WeekdayIso IS NOT NULL AND WeekdayIso BETWEEN 1 AND 7 AND CalendarDate IS NULL) OR (RuleType = 'date-override' AND WeekdayIso IS NULL AND CalendarDate IS NOT NULL)", ["RuleType", "WeekdayIso", "CalendarDate"]),
      ck("CK_MfgWcCalendar_Shift", "(IsWorking = 1 AND StartMinuteOfDay IS NOT NULL AND EndMinuteOfDay IS NOT NULL AND StartMinuteOfDay BETWEEN 0 AND 1439 AND EndMinuteOfDay > StartMinuteOfDay AND EndMinuteOfDay <= 2879 AND BreakMinutes >= 0 AND BreakMinutes <= EndMinuteOfDay - StartMinuteOfDay) OR (IsWorking = 0 AND StartMinuteOfDay IS NULL AND EndMinuteOfDay IS NULL)", ["IsWorking", "StartMinuteOfDay", "EndMinuteOfDay", "BreakMinutes"]),
      ck("CK_MfgWcCalendar_BreakStart", "BreakStartMinuteOfDay IS NULL OR (IsWorking = 1 AND BreakMinutes > 0 AND BreakStartMinuteOfDay >= StartMinuteOfDay AND BreakStartMinuteOfDay + BreakMinutes <= EndMinuteOfDay)", ["BreakStartMinuteOfDay", "IsWorking", "BreakMinutes", "StartMinuteOfDay", "EndMinuteOfDay"]),
      ck("CK_MfgWcCalendar_Break", "BreakMinutes >= 0", ["BreakMinutes"]),
      ck("CK_MfgWcCalendar_Availability", "AvailabilityPct >= 0 AND AvailabilityPct <= 100", ["AvailabilityPct"]),
      ck("CK_MfgWcCalendar_Dates", "EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom", ["EffectiveFrom", "EffectiveTo"]),
    ],
  },

  /* 07 — سربرگ نسخه‌دار Routing. */
  {
    name: "MfgRouting", module: "mfg", title: { fa: "مسیر تولید", en: "Routing" }, pk: "Id",
    columns: [
      id(), plant(), req("PartId", "text", { len: 60 }), code("RoutingCode"), code("Revision"), status("draft|released|obsolete"),
      req("BaseQuantity", "decimal", { precision: 18, scale: 4, default: "1" }), req("BaseUom", "text", { len: 16 }),
      req("EffectiveFrom", "date"), c("EffectiveTo", "date"), req("IsDefault", "bool", { default: "0" }),
      c("ReleasedAt", "datetime"), c("ReleasedBy", "text", { len: 60 }), c("NoteFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "UX_MfgRouting_Revision", columns: ["PlantId", "PartId", "RoutingCode", "Revision"], unique: true },
      { name: "IX_MfgRouting_Effective", columns: ["PlantId", "PartId", "Status", "EffectiveFrom"] },
    ],
    foreignKeys: [{ column: "PartId", refTable: "MfgPart", refColumn: "Id" }],
    checks: [
      ck("CK_MfgRouting_Status", "Status IN ('draft','released','obsolete')", ["Status"]),
      ck("CK_MfgRouting_BaseQty", "BaseQuantity > 0", ["BaseQuantity"]),
      ck("CK_MfgRouting_Dates", "EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom", ["EffectiveFrom", "EffectiveTo"]),
      ck("CK_MfgRouting_Release", "Status <> 'released' OR (ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL)", ["Status", "ReleasedAt", "ReleasedBy"]),
    ],
  },

  /* 08 — Operation الگوی Routing؛ Queue/Move lead time هستند، Setup/Run ظرفیت مصرف می‌کنند. */
  {
    name: "MfgRoutingOperation", module: "mfg", title: { fa: "عملیات مسیر تولید", en: "Routing operation" }, pk: "Id",
    columns: [
      id(), plant(), req("RoutingId", "text", { len: 60 }), req("SequenceNo", "int"), code("OperationCode"),
      req("OperationNameFa", "text", { len: 240 }), c("OperationNameEn", "text", { len: 240 }),
      req("WorkCenterId", "text", { len: 60 }), mins("SetupMinutes"), mins("RunMinutesPerUnit"),
      mins("QueueMinutes"), mins("MoveMinutes"), req("OverlapAllowed", "bool", { default: "0" }),
      qty("TransferBatchQty", true), c("PredecessorSequence", "int"), req("InspectionRequired", "bool", { default: "0" }),
      c("CostCenterId", "text", { len: 60 }), c("WorkInstructionRef", "text", { len: 120 }), c("NoteFa", "text", { len: 800 }),
    ],
    indexes: [
      { name: "UX_MfgRoutingOp_Seq", columns: ["RoutingId", "SequenceNo"], unique: true },
      { name: "IX_MfgRoutingOp_WorkCenter", columns: ["PlantId", "WorkCenterId", "OperationCode"] },
    ],
    foreignKeys: [
      { column: "RoutingId", refTable: "MfgRouting", refColumn: "Id" },
      { column: "WorkCenterId", refTable: "MfgWorkCenter", refColumn: "Id" },
      { column: "CostCenterId", refTable: "MfgCostCenter", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgRoutingOp_Sequence", "SequenceNo > 0", ["SequenceNo"]),
      ck("CK_MfgRoutingOp_Times", "SetupMinutes >= 0 AND RunMinutesPerUnit >= 0 AND QueueMinutes >= 0 AND MoveMinutes >= 0", ["SetupMinutes", "RunMinutesPerUnit", "QueueMinutes", "MoveMinutes"]),
      ck("CK_MfgRoutingOp_Overlap", "OverlapAllowed = 0 OR (TransferBatchQty IS NOT NULL AND TransferBatchQty > 0)", ["OverlapAllowed", "TransferBatchQty"]),
      ck("CK_MfgRoutingOp_Predecessor", "PredecessorSequence IS NULL OR (PredecessorSequence > 0 AND PredecessorSequence < SequenceNo)", ["PredecessorSequence", "SequenceNo"]),
    ],
  },

  /* 09 — سفارش تولید؛ Project/Contract مرجع اختیاری‌اند و PlantId دامنهٔ اجباری است. */
  {
    name: "MfgProductionOrder", module: "mfg", title: { fa: "سفارش تولید", en: "Production order" }, pk: "Id",
    columns: [
      id(), plant(), code("OrderNo"), req("PartId", "text", { len: 60 }), qty("OrderQuantity"), req("Uom", "text", { len: 16 }),
      req("DueAt", "datetime"), c("RequestedStartAt", "datetime"), status("created|released|in-progress|completed|closed", "'created'"),
      req("PriorityRule", "text", { len: 12, default: "'EDD'", comment: "EDD|CR|MANUAL" }), c("ManualRank", "int"),
      req("DispatchWeight", "decimal", { precision: 12, scale: 4, default: "1", comment: "وزن سفارش برای WSPT؛ بزرگ‌تر یعنی اولویت بیشتر" }),
      req("DemandSource", "text", { len: 16, comment: "sales-order|contract|forecast|manual" }), c("DemandRef", "text", { len: 80 }),
      c("CustomerRef", "text", { len: 80, comment: "کلید نرم؛ جدول مشتری در مخزن فعلی وجود ندارد" }), c("CustomerNameSnapshot", "text", { len: 240 }),
      c("ContractId", "text", { len: 60, comment: "کلید نرم قرارداد بیرونی برای تبادل REST API؛ بدون وابستگی FK" }),
      c("ProjectId", "text", { len: 60, comment: "کلید نرم مرجع بیرونی برای تبادل REST API؛ بدون وابستگی FK" }),
      c("BomHeaderId", "text", { len: 60 }), c("RoutingId", "text", { len: 60 }),
      c("BomRevisionSnapshot", "text", { len: 40 }), c("RoutingRevisionSnapshot", "text", { len: 40 }),
      c("ReleasedAt", "datetime"), c("ReleasedBy", "text", { len: 60 }), c("CompletedAt", "datetime"), c("ClosedAt", "datetime"),
      /* بستن سفارش با «چه کسی» معنا دارد؛ قرارداد ۵.۴ ستون ClosedBy را سمت
       * سرور الزام می‌کند و AuditLog به‌تنهایی پاسخ گزارش‌های بستن نیست. */
      c("ClosedBy", "text", { len: 60 }),
      req("AllowOverrun", "bool", { default: "0" }), c("NoteFa", "text", { len: 1200 }),
    ],
    indexes: [
      { name: "UX_MfgProdOrder_No", columns: ["PlantId", "OrderNo"], unique: true },
      { name: "IX_MfgProdOrder_Dispatch", columns: ["PlantId", "Status", "DueAt", "PriorityRule"] },
      { name: "IX_MfgProdOrder_Part", columns: ["PlantId", "PartId", "Status"] },
      { name: "IX_MfgProdOrder_Contract", columns: ["ContractId", "Status"] },
    ],
    foreignKeys: [
      { column: "PartId", refTable: "MfgPart", refColumn: "Id" },
      { column: "BomHeaderId", refTable: "MfgBomHeader", refColumn: "Id" },
      { column: "RoutingId", refTable: "MfgRouting", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgProdOrder_Qty", "OrderQuantity > 0", ["OrderQuantity"]),
      ck("CK_MfgProdOrder_Status", "Status IN ('created','released','in-progress','completed','closed')", ["Status"]),
      ck("CK_MfgProdOrder_Priority", "PriorityRule IN ('EDD','CR','MANUAL')", ["PriorityRule"]),
      ck("CK_MfgProdOrder_DispatchWeight", "DispatchWeight > 0", ["DispatchWeight"]),
      ck("CK_MfgProdOrder_Demand", "DemandSource IN ('sales-order','contract','forecast','manual')", ["DemandSource"]),
      ck("CK_MfgProdOrder_Rank", "ManualRank IS NULL OR ManualRank >= 0", ["ManualRank"]),
      ck("CK_MfgProdOrder_Release", "Status = 'created' OR (BomHeaderId IS NOT NULL AND RoutingId IS NOT NULL AND ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL)", ["Status", "BomHeaderId", "RoutingId", "ReleasedAt", "ReleasedBy"]),
    ],
  },

  /* 10 — نمونهٔ برنامه‌ریزی‌شدهٔ هر Operation برای یک سفارش؛ مقادیر Routing هنگام Release کپی می‌شوند. */
  {
    name: "MfgProductionOrderOperation", module: "mfg", title: { fa: "عملیات سفارش تولید", en: "Production order operation" }, pk: "Id",
    columns: [
      id(), plant(), req("ProductionOrderId", "text", { len: 60 }), c("RoutingOperationId", "text", { len: 60 }),
      req("SequenceNo", "int"), code("OperationCode"), req("OperationNameFa", "text", { len: 240 }),
      req("WorkCenterId", "text", { len: 60 }), c("PredecessorOperationId", "text", { len: 60 }),
      status("pending|queued|ready|setup|running|blocked|completed", "'pending'"), qty("PlannedQuantity"),
      mins("PlannedSetupMinutes"), mins("PlannedRunMinutesPerUnit"), mins("PlannedQueueMinutes"), mins("PlannedMoveMinutes"),
      mins("PlannedCapacityMinutes"), req("OverlapAllowed", "bool", { default: "0" }), qty("TransferBatchQty", true),
      req("InspectionRequired", "bool", { default: "0" }), c("BlockedReasonFa", "text", { len: 500 }),
    ],
    indexes: [
      { name: "UX_MfgOrderOp_Sequence", columns: ["ProductionOrderId", "SequenceNo"], unique: true },
      { name: "IX_MfgOrderOp_Queue", columns: ["PlantId", "WorkCenterId", "Status", "SequenceNo"] },
      { name: "IX_MfgOrderOp_OrderStatus", columns: ["ProductionOrderId", "Status"] },
    ],
    foreignKeys: [
      { column: "ProductionOrderId", refTable: "MfgProductionOrder", refColumn: "Id" },
      { column: "RoutingOperationId", refTable: "MfgRoutingOperation", refColumn: "Id" },
      { column: "WorkCenterId", refTable: "MfgWorkCenter", refColumn: "Id" },
      { column: "PredecessorOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgOrderOp_Sequence", "SequenceNo > 0", ["SequenceNo"]),
      ck("CK_MfgOrderOp_Status", "Status IN ('pending','queued','ready','setup','running','blocked','completed')", ["Status"]),
      ck("CK_MfgOrderOp_Qty", "PlannedQuantity > 0", ["PlannedQuantity"]),
      ck("CK_MfgOrderOp_Times", "PlannedSetupMinutes >= 0 AND PlannedRunMinutesPerUnit >= 0 AND PlannedQueueMinutes >= 0 AND PlannedMoveMinutes >= 0 AND PlannedCapacityMinutes >= 0", ["PlannedSetupMinutes", "PlannedRunMinutesPerUnit", "PlannedQueueMinutes", "PlannedMoveMinutes", "PlannedCapacityMinutes"]),
      ck("CK_MfgOrderOp_Overlap", "OverlapAllowed = 0 OR (TransferBatchQty IS NOT NULL AND TransferBatchQty > 0)", ["OverlapAllowed", "TransferBatchQty"]),
    ],
  },

  /* 11 — قطعهٔ زمان‌بندی؛ چند Segment در یک ScheduleVersion مجاز است. */
  {
    name: "MfgOperationSchedule", module: "mfg", title: { fa: "قطعهٔ زمان‌بندی عملیات", en: "Operation schedule segment" }, pk: "Id",
    columns: [
      id(), plant(), req("ProductionOrderOperationId", "text", { len: 60 }), req("ScheduleVersion", "int"), req("SegmentNo", "int"),
      req("WorkCenterId", "text", { len: 60 }), c("ResourceId", "text", { len: 60 }),
      req("PlannedStartAt", "datetime"), req("PlannedEndAt", "datetime"), mins("PlannedCapacityMinutes"),
      mins("QueueMinutes"), mins("MoveMinutes"), req("CapacityMode", "text", { len: 16, comment: "finite|semi-finite" }),
      req("Direction", "text", { len: 12, comment: "forward|backward" }), req("DispatchRule", "text", { len: 12 }),
      status("tentative|firm|cancelled", "'tentative'"), c("CommittedAt", "datetime"), c("CommittedBy", "text", { len: 60 }),
    ],
    indexes: [
      { name: "UX_MfgOpSchedule_Segment", columns: ["ProductionOrderOperationId", "ScheduleVersion", "SegmentNo"], unique: true },
      { name: "IX_MfgOpSchedule_WcWindow", columns: ["PlantId", "WorkCenterId", "PlannedStartAt", "PlannedEndAt", "Status"] },
    ],
    foreignKeys: [
      { column: "ProductionOrderOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "WorkCenterId", refTable: "MfgWorkCenter", refColumn: "Id" },
      { column: "ResourceId", refTable: "MfgWorkCenterResource", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgOpSchedule_Version", "ScheduleVersion > 0 AND SegmentNo > 0", ["ScheduleVersion", "SegmentNo"]),
      ck("CK_MfgOpSchedule_Window", "PlannedEndAt > PlannedStartAt", ["PlannedStartAt", "PlannedEndAt"]),
      ck("CK_MfgOpSchedule_Times", "PlannedCapacityMinutes >= 0 AND QueueMinutes >= 0 AND MoveMinutes >= 0", ["PlannedCapacityMinutes", "QueueMinutes", "MoveMinutes"]),
      ck("CK_MfgOpSchedule_Mode", "CapacityMode IN ('finite','semi-finite')", ["CapacityMode"]),
      ck("CK_MfgOpSchedule_Direction", "Direction IN ('forward','backward')", ["Direction"]),
      ck("CK_MfgOpSchedule_Status", "Status IN ('tentative','firm','cancelled')", ["Status"]),
    ],
  },

  /* 12 — تصویر ظرفیت برای هر بازه و نسخهٔ برنامه؛ Load بیش از ۱۰۰٪ مجاز است تا اضافه‌بار دیده شود. */
  {
    name: "MfgCapacityPlan", module: "mfg", title: { fa: "برنامهٔ ظرفیت مرکز کاری", en: "Work center capacity plan" }, pk: "Id",
    columns: [
      id(), plant(), req("WorkCenterId", "text", { len: 60 }), req("ScheduleVersion", "int"),
      req("PeriodStart", "datetime"), req("PeriodEnd", "datetime"), mins("AvailableMinutes"), mins("PlannedLoadMinutes"),
      mins("ReservedMinutes"), pct("UtilizationPct"), mins("OverloadMinutes"), req("IsBottleneck", "bool", { default: "0" }),
      req("CalculatedAt", "datetime"), c("ModelVersion", "text", { len: 40 }),
    ],
    indexes: [
      { name: "UX_MfgCapacityPlan_Bucket", columns: ["PlantId", "WorkCenterId", "ScheduleVersion", "PeriodStart", "PeriodEnd"], unique: true },
      { name: "IX_MfgCapacityPlan_Bottleneck", columns: ["PlantId", "IsBottleneck", "PeriodStart"] },
    ],
    foreignKeys: [{ column: "WorkCenterId", refTable: "MfgWorkCenter", refColumn: "Id" }],
    checks: [
      ck("CK_MfgCapacityPlan_Period", "PeriodEnd > PeriodStart", ["PeriodStart", "PeriodEnd"]),
      ck("CK_MfgCapacityPlan_Load", "ScheduleVersion > 0 AND AvailableMinutes >= 0 AND PlannedLoadMinutes >= 0 AND ReservedMinutes >= 0 AND OverloadMinutes >= 0 AND ((AvailableMinutes = 0 AND UtilizationPct IS NULL) OR (AvailableMinutes > 0 AND UtilizationPct IS NOT NULL AND UtilizationPct >= 0))", ["ScheduleVersion", "AvailableMinutes", "PlannedLoadMinutes", "ReservedMinutes", "OverloadMinutes", "UtilizationPct"]),
    ],
  },

  /* 13 — رخداد اجرای واقعی؛ چند نشست/اپراتور برای یک Operation مجاز است. */
  {
    name: "MfgOperationExecution", module: "mfg", title: { fa: "اجرای واقعی عملیات", en: "Operation execution" }, pk: "Id",
    columns: [
      id(), plant(), req("ProductionOrderOperationId", "text", { len: 60 }), req("ExecutionNo", "int"),
      status("running|completed|cancelled", "'running'"), c("ResourceId", "text", { len: 60 }), c("OperatorId", "text", { len: 60 }),
      req("StartedAt", "datetime"), c("FinishedAt", "datetime"), mins("SetupActualMinutes", false), mins("RunActualMinutes", false),
      qty("InputQuantity"), qty("GoodQuantity"), qty("ReworkQuantity"), qty("ScrapQuantity"),
      req("IdempotencyKey", "text", { len: 160 }), c("NoteFa", "text", { len: 800 }),
    ],
    indexes: [
      { name: "UX_MfgExecution_No", columns: ["ProductionOrderOperationId", "ExecutionNo"], unique: true },
      { name: "UX_MfgExecution_Idempotency", columns: ["IdempotencyKey"], unique: true },
      { name: "IX_MfgExecution_Started", columns: ["PlantId", "StartedAt", "Status"] },
    ],
    foreignKeys: [
      { column: "ProductionOrderOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "ResourceId", refTable: "MfgWorkCenterResource", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgExecution_No", "ExecutionNo > 0", ["ExecutionNo"]),
      ck("CK_MfgExecution_Status", "Status IN ('running','completed','cancelled')", ["Status"]),
      ck("CK_MfgExecution_Times", "SetupActualMinutes >= 0 AND RunActualMinutes >= 0", ["SetupActualMinutes", "RunActualMinutes"]),
      ck("CK_MfgExecution_Qty", "InputQuantity >= 0 AND GoodQuantity >= 0 AND ReworkQuantity >= 0 AND ScrapQuantity >= 0 AND GoodQuantity + ReworkQuantity + ScrapQuantity <= InputQuantity", ["InputQuantity", "GoodQuantity", "ReworkQuantity", "ScrapQuantity"]),
      ck("CK_MfgExecution_Finish", "FinishedAt IS NULL OR FinishedAt >= StartedAt", ["StartedAt", "FinishedAt"]),
      ck("CK_MfgExecution_Completed", "Status <> 'completed' OR FinishedAt IS NOT NULL", ["Status", "FinishedAt"]),
    ],
  },

  /* 14 — توقف برنامه‌ریزی‌شده یا ناخواسته، با قابلیت پیوند به نشست اجرا. */
  {
    name: "MfgDowntimeLog", module: "mfg", title: { fa: "ثبت توقف", en: "Downtime log" }, pk: "Id",
    columns: [
      id(), plant(), req("WorkCenterId", "text", { len: 60 }), c("ProductionOrderOperationId", "text", { len: 60 }),
      c("ExecutionId", "text", { len: 60 }), c("ResourceId", "text", { len: 60 }), req("StartedAt", "datetime"), c("FinishedAt", "datetime"),
      mins("DurationMinutes"), req("DowntimeType", "text", { len: 16, comment: "planned|unplanned" }),
      code("ReasonCode"), req("RecordedBy", "text", { len: 60 }), c("NoteFa", "text", { len: 800 }),
    ],
    indexes: [
      { name: "IX_MfgDowntime_WcTime", columns: ["PlantId", "WorkCenterId", "StartedAt"] },
      { name: "IX_MfgDowntime_Operation", columns: ["ProductionOrderOperationId", "StartedAt"] },
    ],
    foreignKeys: [
      { column: "WorkCenterId", refTable: "MfgWorkCenter", refColumn: "Id" },
      { column: "ProductionOrderOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "ExecutionId", refTable: "MfgOperationExecution", refColumn: "Id" },
      { column: "ResourceId", refTable: "MfgWorkCenterResource", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgDowntime_Type", "DowntimeType IN ('planned','unplanned')", ["DowntimeType"]),
      ck("CK_MfgDowntime_Duration", "DurationMinutes IS NULL OR DurationMinutes >= 0", ["DurationMinutes"]),
      ck("CK_MfgDowntime_Window", "FinishedAt IS NULL OR FinishedAt >= StartedAt", ["StartedAt", "FinishedAt"]),
    ],
  },

  /* 15 — ضایعات مقداری؛ ثبت ضایعات بخشی، وضعیت کل Operation را تغییر نمی‌دهد. */
  {
    name: "MfgScrapRecord", module: "mfg", title: { fa: "ثبت ضایعات", en: "Scrap record" }, pk: "Id",
    columns: [
      id(), plant(), req("ProductionOrderOperationId", "text", { len: 60 }), c("ExecutionId", "text", { len: 60 }),
      qty("Quantity"), req("Uom", "text", { len: 16 }), code("ReasonCode"),
      req("Disposition", "text", { len: 20, comment: "scrapped|returned-to-stock|use-as-is" }),
      money("CostAmount"), req("Currency", "text", { len: 8, default: "'IRR'" }),
      req("RecordedAt", "datetime"), req("RecordedBy", "text", { len: 60 }), c("NoteFa", "text", { len: 800 }),
    ],
    indexes: [
      { name: "IX_MfgScrap_Operation", columns: ["PlantId", "ProductionOrderOperationId", "RecordedAt"] },
      { name: "IX_MfgScrap_Reason", columns: ["PlantId", "ReasonCode", "RecordedAt"] },
    ],
    foreignKeys: [
      { column: "ProductionOrderOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "ExecutionId", refTable: "MfgOperationExecution", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgScrap_Qty", "Quantity > 0", ["Quantity"]),
      ck("CK_MfgScrap_Disposition", "Disposition IN ('scrapped','returned-to-stock','use-as-is')", ["Disposition"]),
      ck("CK_MfgScrap_Cost", "CostAmount IS NULL OR CostAmount >= 0", ["CostAmount"]),
    ],
  },

  /* 16 — چرخهٔ دوباره‌کاری؛ به Operation منبع و در صورت نیاز Operation مقصد پیوند دارد. */
  {
    name: "MfgReworkRecord", module: "mfg", title: { fa: "ثبت دوباره‌کاری", en: "Rework record" }, pk: "Id",
    columns: [
      id(), plant(), code("ReworkNo"), req("SourceOperationId", "text", { len: 60 }), c("ExecutionId", "text", { len: 60 }),
      c("TargetOperationId", "text", { len: 60 }), c("ScrapRecordId", "text", { len: 60 }), qty("Quantity"), req("Uom", "text", { len: 16 }),
      code("ReasonCode"), status("open|in-progress|completed|cancelled", "'open'"), c("StartedAt", "datetime"), c("FinishedAt", "datetime"),
      c("Disposition", "text", { len: 20 }), money("ActualCost"), c("NoteFa", "text", { len: 800 }),
    ],
    indexes: [
      { name: "UX_MfgRework_No", columns: ["PlantId", "ReworkNo"], unique: true },
      { name: "IX_MfgRework_Source", columns: ["PlantId", "SourceOperationId", "Status"] },
    ],
    foreignKeys: [
      { column: "SourceOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "TargetOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "ExecutionId", refTable: "MfgOperationExecution", refColumn: "Id" },
      { column: "ScrapRecordId", refTable: "MfgScrapRecord", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgRework_Qty", "Quantity > 0", ["Quantity"]),
      ck("CK_MfgRework_Status", "Status IN ('open','in-progress','completed','cancelled')", ["Status"]),
      ck("CK_MfgRework_Window", "FinishedAt IS NULL OR (StartedAt IS NOT NULL AND FinishedAt >= StartedAt)", ["StartedAt", "FinishedAt"]),
      ck("CK_MfgRework_Cost", "ActualCost IS NULL OR ActualCost >= 0", ["ActualCost"]),
    ],
  },

  /* 17 — ویژگی‌های برنامه‌ریزی ماده؛ هویت کالا از MfgPart می‌آید تا تکرار Part ساخته نشود. */
  {
    name: "MfgMaterial", module: "mfg", title: { fa: "مادهٔ قابل برنامه‌ریزی", en: "Material planning master" }, pk: "Id",
    columns: [
      id(), plant(), req("PartId", "text", { len: 60 }), req("ProcurementType", "text", { len: 8, comment: "make|buy" }),
      req("LeadTimeDays", "int", { default: "0" }), qty("SafetyStockQty"), qty("LotSize", false), qty("OrderMultiple", false),
      c("ShelfLifeDays", "int"), money("StandardUnitCost"), req("Currency", "text", { len: 8, default: "'IRR'" }),
      c("DefaultWarehouseCode", "text", { len: 40 }), req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_MfgMaterial_Part", columns: ["PlantId", "PartId"], unique: true },
      { name: "IX_MfgMaterial_Replenish", columns: ["PlantId", "ProcurementType", "IsActive"] },
    ],
    foreignKeys: [{ column: "PartId", refTable: "MfgPart", refColumn: "Id" }],
    checks: [
      ck("CK_MfgMaterial_Type", "ProcurementType IN ('make','buy')", ["ProcurementType"]),
      ck("CK_MfgMaterial_Lead", "LeadTimeDays >= 0 AND (ShelfLifeDays IS NULL OR ShelfLifeDays >= 0)", ["LeadTimeDays", "ShelfLifeDays"]),
      ck("CK_MfgMaterial_Quantities", "SafetyStockQty >= 0 AND LotSize > 0 AND OrderMultiple > 0", ["SafetyStockQty", "LotSize", "OrderMultiple"]),
      ck("CK_MfgMaterial_Cost", "StandardUnitCost IS NULL OR StandardUnitCost >= 0", ["StandardUnitCost"]),
    ],
  },

  /* 18 — نیاز زمان‌مند مواد؛ قابل ردیابی تا ردیف BOM و Operation محل مصرف. */
  {
    name: "MfgMaterialRequirement", module: "mfg", title: { fa: "نیاز مواد", en: "Material requirement" }, pk: "Id",
    columns: [
      id(), plant(), req("ProductionOrderId", "text", { len: 60 }), c("ProductionOrderOperationId", "text", { len: 60 }),
      req("BomItemId", "text", { len: 60 }), req("MaterialId", "text", { len: 60 }), req("RequirementKey", "text", { len: 180 }),
      req("RequiredAt", "datetime"), qty("GrossQuantity"), qty("ScrapAllowanceQty"), qty("NetQuantity"),
      qty("AvailableQuantity"), qty("ReservedQuantity"), qty("ShortageQuantity"), req("Uom", "text", { len: 16 }),
      status("planned|shortage|reserved|issued|closed|cancelled", "'planned'"), req("ScheduleVersion", "int", { default: "1" }),
    ],
    indexes: [
      { name: "UX_MfgMatReq_Key", columns: ["PlantId", "RequirementKey"], unique: true },
      { name: "IX_MfgMatReq_Shortage", columns: ["PlantId", "Status", "RequiredAt", "MaterialId"] },
      { name: "IX_MfgMatReq_Order", columns: ["ProductionOrderId", "RequiredAt"] },
    ],
    foreignKeys: [
      { column: "ProductionOrderId", refTable: "MfgProductionOrder", refColumn: "Id" },
      { column: "ProductionOrderOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "BomItemId", refTable: "MfgBomItem", refColumn: "Id" },
      { column: "MaterialId", refTable: "MfgMaterial", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgMatReq_Status", "Status IN ('planned','shortage','reserved','issued','closed','cancelled')", ["Status"]),
      ck("CK_MfgMatReq_Qty", "GrossQuantity >= 0 AND ScrapAllowanceQty >= 0 AND NetQuantity >= 0 AND AvailableQuantity >= 0 AND ReservedQuantity >= 0 AND ShortageQuantity >= 0", ["GrossQuantity", "ScrapAllowanceQty", "NetQuantity", "AvailableQuantity", "ReservedQuantity", "ShortageQuantity"]),
      ck("CK_MfgMatReq_Version", "ScheduleVersion > 0", ["ScheduleVersion"]),
    ],
  },

  /* 19 — مصرف واقعی مواد با کلید ایدمپوتنسی برای جلوگیری از ثبت دوباره. */
  {
    name: "MfgMaterialConsumption", module: "mfg", title: { fa: "مصرف واقعی مواد", en: "Material consumption" }, pk: "Id",
    columns: [
      id(), plant(), req("ProductionOrderOperationId", "text", { len: 60 }), c("RequirementId", "text", { len: 60 }),
      c("ExecutionId", "text", { len: 60 }), req("MaterialId", "text", { len: 60 }), qty("Quantity"), req("Uom", "text", { len: 16 }),
      c("LotNo", "text", { len: 60 }), money("UnitCost", false), req("Currency", "text", { len: 8, default: "'IRR'" }),
      req("ConsumptionMethod", "text", { len: 12, comment: "manual|backflush|issue" }), req("ConsumedAt", "datetime"),
      req("IdempotencyKey", "text", { len: 160 }), req("PostedBy", "text", { len: 60 }),
    ],
    indexes: [
      { name: "UX_MfgMatConsumption_Idem", columns: ["IdempotencyKey"], unique: true },
      { name: "IX_MfgMatConsumption_Operation", columns: ["PlantId", "ProductionOrderOperationId", "ConsumedAt"] },
      { name: "IX_MfgMatConsumption_Material", columns: ["PlantId", "MaterialId", "ConsumedAt"] },
    ],
    foreignKeys: [
      { column: "ProductionOrderOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "RequirementId", refTable: "MfgMaterialRequirement", refColumn: "Id" },
      { column: "ExecutionId", refTable: "MfgOperationExecution", refColumn: "Id" },
      { column: "MaterialId", refTable: "MfgMaterial", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgMatConsumption_Qty", "Quantity > 0", ["Quantity"]),
      ck("CK_MfgMatConsumption_Cost", "UnitCost >= 0", ["UnitCost"]),
      ck("CK_MfgMatConsumption_Method", "ConsumptionMethod IN ('manual','backflush','issue')", ["ConsumptionMethod"]),
    ],
  },

  /* 20 — موجودی قابل برنامه‌ریزی به تفکیک انبار/مکان/بچ. */
  {
    name: "MfgInventoryLevel", module: "mfg", title: { fa: "سطح موجودی مواد", en: "Material inventory level" }, pk: "Id",
    columns: [
      id(), plant(), req("MaterialId", "text", { len: 60 }), req("WarehouseCode", "text", { len: 40 }),
      req("LocationCode", "text", { len: 40, default: "''" }), req("LotNo", "text", { len: 60, default: "''" }),
      req("InventoryKey", "text", { len: 240 }), qty("OnHandQty"), qty("ReservedQty"), qty("BlockedQty"), qty("InTransitQty"), qty("SafetyStockQty"),
      req("AsOfAt", "datetime"), c("LastCountedAt", "datetime"),
    ],
    indexes: [
      { name: "UX_MfgInventory_Key", columns: ["PlantId", "InventoryKey"], unique: true },
      { name: "IX_MfgInventory_Material", columns: ["PlantId", "MaterialId", "WarehouseCode"] },
    ],
    foreignKeys: [{ column: "MaterialId", refTable: "MfgMaterial", refColumn: "Id" }],
    checks: [
      ck("CK_MfgInventory_Qty", "OnHandQty >= 0 AND ReservedQty >= 0 AND BlockedQty >= 0 AND InTransitQty >= 0 AND SafetyStockQty >= 0 AND ReservedQty + BlockedQty <= OnHandQty", ["OnHandQty", "ReservedQty", "BlockedQty", "InTransitQty", "SafetyStockQty"]),
    ],
  },

  /* 22 — هزینهٔ عملیات به تفکیک عنصر و نسخهٔ نرخ؛ مقدار استاندارد/واقعی کنار هم نگه داشته می‌شود. */
  {
    name: "MfgOperationCost", module: "mfg", title: { fa: "هزینهٔ عملیات", en: "Operation cost" }, pk: "Id",
    columns: [
      id(), plant(), req("ProductionOrderOperationId", "text", { len: 60 }), c("CostCenterId", "text", { len: 60 }),
      req("CostElement", "text", { len: 16, comment: "material|machine|labor|overhead" }), req("CostVersion", "int"),
      qty("StandardQuantity"), qty("ActualQuantity"), req("StandardRate", "decimal", { precision: 18, scale: 4, default: "0" }),
      req("ActualRate", "decimal", { precision: 18, scale: 4, default: "0" }), money("StandardAmount", false), money("ActualAmount", false),
      req("Currency", "text", { len: 8, default: "'IRR'" }), req("CalculatedAt", "datetime"), c("SourceRef", "text", { len: 100 }),
    ],
    indexes: [
      { name: "UX_MfgOperationCost_Element", columns: ["ProductionOrderOperationId", "CostElement", "CostVersion"], unique: true },
      { name: "IX_MfgOperationCost_Center", columns: ["PlantId", "CostCenterId", "CalculatedAt"] },
    ],
    foreignKeys: [
      { column: "ProductionOrderOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "CostCenterId", refTable: "MfgCostCenter", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgOperationCost_Element", "CostElement IN ('material','machine','labor','overhead')", ["CostElement"]),
      ck("CK_MfgOperationCost_Version", "CostVersion > 0", ["CostVersion"]),
      ck("CK_MfgOperationCost_Amounts", "StandardQuantity >= 0 AND ActualQuantity >= 0 AND StandardRate >= 0 AND ActualRate >= 0 AND StandardAmount >= 0 AND ActualAmount >= 0", ["StandardQuantity", "ActualQuantity", "StandardRate", "ActualRate", "StandardAmount", "ActualAmount"]),
    ],
  },

  /* 23 — تجمیع هزینهٔ سفارش؛ ریزمبنای واقعی در OperationCost/MaterialConsumption می‌ماند. */
  {
    name: "MfgOrderCost", module: "mfg", title: { fa: "هزینهٔ تجمیعی سفارش", en: "Production order cost summary" }, pk: "Id",
    columns: [
      id(), plant(), req("ProductionOrderId", "text", { len: 60 }), req("CostVersion", "int"), req("Currency", "text", { len: 8, default: "'IRR'" }),
      money("StandardMaterialCost", false), money("ActualMaterialCost", false), money("StandardMachineCost", false), money("ActualMachineCost", false),
      money("StandardLaborCost", false), money("ActualLaborCost", false), money("StandardOverheadCost", false), money("ActualOverheadCost", false),
      money("StandardTotalCost", false), money("ActualTotalCost", false), money("ContractRevenue"), money("GrossMargin"),
      req("Reconciled", "bool", { default: "0" }), c("ReconciledAt", "datetime"), c("ModelVersion", "text", { len: 40 }),
    ],
    indexes: [
      { name: "UX_MfgOrderCost_Version", columns: ["ProductionOrderId", "CostVersion"], unique: true },
      { name: "IX_MfgOrderCost_Reconcile", columns: ["PlantId", "Reconciled", "ReconciledAt"] },
    ],
    foreignKeys: [{ column: "ProductionOrderId", refTable: "MfgProductionOrder", refColumn: "Id" }],
    checks: [
      ck("CK_MfgOrderCost_Version", "CostVersion > 0", ["CostVersion"]),
      ck("CK_MfgOrderCost_Amounts", "StandardMaterialCost >= 0 AND ActualMaterialCost >= 0 AND StandardMachineCost >= 0 AND ActualMachineCost >= 0 AND StandardLaborCost >= 0 AND ActualLaborCost >= 0 AND StandardOverheadCost >= 0 AND ActualOverheadCost >= 0 AND StandardTotalCost >= 0 AND ActualTotalCost >= 0", ["StandardMaterialCost", "ActualMaterialCost", "StandardMachineCost", "ActualMachineCost", "StandardLaborCost", "ActualLaborCost", "StandardOverheadCost", "ActualOverheadCost", "StandardTotalCost", "ActualTotalCost"]),
      ck("CK_MfgOrderCost_Reconciled", "Reconciled = 0 OR ReconciledAt IS NOT NULL", ["Reconciled", "ReconciledAt"]),
    ],
  },

  /* 24 — هشدارهای دامنه؛ AlertKey برای deduplication پایدار است. */
  {
    name: "MfgProductionAlert", module: "mfg", title: { fa: "هشدار تولید", en: "Production alert" }, pk: "Id",
    columns: [
      id(), plant(), code("AlertKey"), code("AlertCode"), req("Severity", "text", { len: 12, comment: "critical|high|medium|low" }),
      status("open|acknowledged|resolved|suppressed", "'open'"), c("ProductionOrderId", "text", { len: 60 }),
      c("ProductionOrderOperationId", "text", { len: 60 }), c("WorkCenterId", "text", { len: 60 }),
      req("TitleFa", "text", { len: 240 }), c("DetailFa", "text", { len: 1200 }),
      req("FirstRaisedAt", "datetime"), req("LastRaisedAt", "datetime"), c("AcknowledgedAt", "datetime"),
      c("AcknowledgedBy", "text", { len: 60 }), c("ResolvedAt", "datetime"), c("ResolvedBy", "text", { len: 60 }),
      req("OccurrenceCount", "int", { default: "1" }), c("ThresholdValue", "decimal", { precision: 18, scale: 4 }),
      c("ActualValue", "decimal", { precision: 18, scale: 4 }), c("SourceEventKey", "text", { len: 160 }),
    ],
    indexes: [
      { name: "UX_MfgAlert_Dedup", columns: ["PlantId", "AlertKey"], unique: true },
      { name: "IX_MfgAlert_Open", columns: ["PlantId", "Status", "Severity", "LastRaisedAt"] },
      { name: "IX_MfgAlert_Order", columns: ["ProductionOrderId", "Status"] },
    ],
    foreignKeys: [
      { column: "ProductionOrderId", refTable: "MfgProductionOrder", refColumn: "Id" },
      { column: "ProductionOrderOperationId", refTable: "MfgProductionOrderOperation", refColumn: "Id" },
      { column: "WorkCenterId", refTable: "MfgWorkCenter", refColumn: "Id" },
    ],
    checks: [
      ck("CK_MfgAlert_Severity", "Severity IN ('critical','high','medium','low')", ["Severity"]),
      ck("CK_MfgAlert_Status", "Status IN ('open','acknowledged','resolved','suppressed')", ["Status"]),
      ck("CK_MfgAlert_Count", "OccurrenceCount > 0", ["OccurrenceCount"]),
      ck("CK_MfgAlert_Resolved", "Status <> 'resolved' OR ResolvedAt IS NOT NULL", ["Status", "ResolvedAt"]),
    ],
  },

  /* 25 — قاعدهٔ Dispatching برای کارخانه یا Work Center. RuleScopeKey از مقادیر NULL مستقل است. */
  {
    name: "MfgDispatchingRule", module: "mfg", title: { fa: "قاعدهٔ اعزام عملیات", en: "Dispatching rule" }, pk: "Id",
    columns: [
      id(), plant(), req("ScopeType", "text", { len: 12, comment: "plant|work-center" }), req("RuleScopeKey", "text", { len: 100 }),
      c("WorkCenterId", "text", { len: 60 }), req("RuleCode", "text", { len: 12, comment: "EDD|SPT|CR|WSPT|FIFO|MANUAL" }),
      req("PriorityOrder", "int", { default: "1" }), req("PriorityWeight", "decimal", { precision: 12, scale: 4, default: "1" }),
      req("IsActive", "bool", { default: "1" }), req("EffectiveFrom", "date"), c("EffectiveTo", "date"), c("ParametersJson", "json"),
    ],
    indexes: [
      { name: "UX_MfgDispatchRule_Scope", columns: ["PlantId", "RuleScopeKey", "PriorityOrder", "EffectiveFrom"], unique: true },
      { name: "IX_MfgDispatchRule_Active", columns: ["PlantId", "IsActive", "ScopeType", "RuleCode"] },
    ],
    foreignKeys: [{ column: "WorkCenterId", refTable: "MfgWorkCenter", refColumn: "Id" }],
    checks: [
      ck("CK_MfgDispatchRule_Scope", "ScopeType IN ('plant','work-center')", ["ScopeType"]),
      ck("CK_MfgDispatchRule_Rule", "RuleCode IN ('EDD','SPT','CR','WSPT','FIFO','MANUAL')", ["RuleCode"]),
      ck("CK_MfgDispatchRule_Order", "PriorityOrder > 0 AND PriorityWeight > 0", ["PriorityOrder", "PriorityWeight"]),
      ck("CK_MfgDispatchRule_ScopeLink", "(ScopeType = 'plant' AND WorkCenterId IS NULL) OR (ScopeType = 'work-center' AND WorkCenterId IS NOT NULL)", ["ScopeType", "WorkCenterId"]),
      ck("CK_MfgDispatchRule_Dates", "EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom", ["EffectiveFrom", "EffectiveTo"]),
    ],
  },

  /* 26 — سربرگ نسخهٔ برنامهٔ ظرفیت؛ مرجع سراسری optimistic versioning و تاریخچهٔ run است. */
  {
    name: "MfgScheduleRun", module: "mfg", title: { fa: "اجرای زمان‌بندی", en: "Manufacturing schedule run" }, pk: "Id",
    columns: [
      id(), plant(), req("ScheduleVersion", "int"),
      req("Direction", "text", { len: 12, comment: "forward|backward" }),
      req("CapacityMode", "text", { len: 16, comment: "finite|semi-finite" }),
      req("DispatchRule", "text", { len: 12, comment: "EDD|SPT|CR|WSPT|FIFO|MANUAL" }),
      req("WindowStart", "datetime"), req("WindowEnd", "datetime"), c("ExpectedScheduleVersion", "int"),
      req("ScheduledOperationCount", "int", { default: "0" }), req("UnscheduledOperationCount", "int", { default: "0" }),
      req("CalculatedAt", "datetime"), req("ModelVersion", "text", { len: 40, default: "'mfg-scheduler-v1'" }),
      c("SummaryJson", "json"),
    ],
    indexes: [
      { name: "UX_MfgScheduleRun_Version", columns: ["PlantId", "ScheduleVersion"], unique: true },
      { name: "IX_MfgScheduleRun_Created", columns: ["PlantId", "CreatedAt"] },
    ],
    checks: [
      ck("CK_MfgScheduleRun_Version", "ScheduleVersion > 0 AND (ExpectedScheduleVersion IS NULL OR ExpectedScheduleVersion >= 0)", ["ScheduleVersion", "ExpectedScheduleVersion"]),
      ck("CK_MfgScheduleRun_Window", "WindowEnd > WindowStart", ["WindowStart", "WindowEnd"]),
      ck("CK_MfgScheduleRun_Mode", "CapacityMode IN ('finite','semi-finite')", ["CapacityMode"]),
      ck("CK_MfgScheduleRun_Direction", "Direction IN ('forward','backward')", ["Direction"]),
      ck("CK_MfgScheduleRun_Rule", "DispatchRule IN ('EDD','SPT','CR','WSPT','FIFO','MANUAL')", ["DispatchRule"]),
      ck("CK_MfgScheduleRun_Counts", "ScheduledOperationCount >= 0 AND UnscheduledOperationCount >= 0", ["ScheduledOperationCount", "UnscheduledOperationCount"]),
    ],
  },
];
