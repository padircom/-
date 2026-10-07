# بخش ۵ — قرارداد REST API سامانهٔ مستقل برنامه‌ریزی و کنترل تولید (Standalone MES)

**نسخهٔ قرارداد:** `mfg-api-v1`

**دامنهٔ اصلی:** کارخانه (`PlantId`)؛ سامانهٔ کاملاً مستقل تولید کارگاهی (Standalone MES) با دیتابیس، بک‌اند و فرانت‌اند مستقل و بدون وابستگی به جداول یا ماژول‌های سامانهٔ کنترل پروژه.

**وضعیت این تحویل:** قرارداد کامل طراحی شده و هر **۶۵/۶۵ مسیر** (۱۰۰٪ بخش‌های ۵.۳ تا ۵.۸) در `server/manufacturingApi.js` پیاده و در `server/index.js` ثبت شده‌اند؛ شامل داده‌های پایه (قطعه همراه با بلوک اختیاری `Planning`، BOM، مسیر ساخت و عملیات آن، مراکز کاری همراه با بلوک اختیاری `Rates`، منابع و تقویم)، سفارش تولید، زمان‌بندی ظرفیت محدود، باززمان‌بندی، Gantt و ظرفیت، اجرای کارگاهی، توقف، ضایعات، دوباره‌کاری و انحراف، مواد، MRP، مصرف و پیشنهاد تأمین، و رول‌آپ بهای تمام‌شده، تطبیق نهایی هزینه، بستن دوگیتی سفارش، داشبورد، OEE و هشدارها. تغییرات واقعی RBAC و Plant-scope نیز در `src/services/accessControl.ts` انجام شده‌اند و فرمان‌های چندجدولی از Unit of Work اتمیک استفاده می‌کنند.

## ۵.۱ قواعد مشترک

پیشوند همهٔ مسیرها:

```text
/api/mfg/plants/{plantId}
```

`plantId` در هر درخواست اجباری است و با `Subject.plantIds` در موتور RBAC سنجیده می‌شود. نبود یا خالی‌بودن `plantIds` برای درخواست Plant-scoped به معنی **عدم دسترسی** است؛ فقط `plantIds: ["*"]` دسترسی همهٔ کارخانه‌ها را می‌دهد. دیتابیس تولید (`Mfg*`) هیچ کلید خارجی (FK) به جداول سامانهٔ کنترل پروژه (`Project`، `ContractMaster`، `Equipment`) ندارد؛ فیلدهای `ProjectId`، `ContractId` و `EquipmentId` صرفاً کلیدهای نرم بیرونی (Soft External References) برای تبادل داده از طریق REST API با سامانه‌های دیگر هستند و بک‌اند MES هیچ کوئری یا وابستگی به جداول بیرونی ندارد.

در توسعه، هویت با آداپتور فعلی `x-user-id` شناخته می‌شود. در استقرار واقعی، دروازهٔ مورداعتماد باید کاربر را احراز هویت و سربرگ ارسالی از کلاینت را حذف/بازنویسی کند. این سربرگ به‌تنهایی سازوکار احراز هویت تولیدی نیست.

### پاسخ موفق و خطا

```json
{
  "ok": true,
  "data": { "Id": "...", "PlantId": "PLANT-01" },
  "meta": { "traceId": "req-...", "version": "mfg-api-v1" }
}
```

```json
{
  "ok": false,
  "error": {
    "code": "MFG_ROW_VERSION_CONFLICT",
    "message": "رکورد از زمان خواندن تغییر کرده است",
    "traceId": "req-..."
  }
}
```

| وضعیت | کد متداول | معنی |
|---|---|---|
| `400` | `MFG_VALIDATION_FAILED` | ورودی نامعتبر، فیلد ناشناخته یا تاریخ/عدد نامعتبر |
| `401` | `MFG_AUTH_REQUIRED` | هویت معتبر ارائه نشده است |
| `403` | `MFG_FORBIDDEN` / `MFG_PLANT_SCOPE_DENIED` | مجوز عمل یا تخصیص به کارخانه وجود ندارد |
| `404` | `MFG_NOT_FOUND` | رکورد در کارخانهٔ جاری یافت نشد؛ شناسهٔ کارخانهٔ دیگر افشا نمی‌شود |
| `409` | `MFG_ROW_VERSION_CONFLICT` / `MFG_STATE_CONFLICT` / `MFG_DUPLICATE` | تعارض نسخه، وضعیت گردش‌کار یا کلید یکتا |
| `422` | `MFG_BUSINESS_RULE_FAILED` | قاعدهٔ دامنه/دروازهٔ تولید برقرار نیست |
| `428` | `MFG_IF_MATCH_REQUIRED` | درخواست تغییر بدون `If-Match` نسخه‌دار |
| `500` | `MFG_INTERNAL_ERROR` | خطای داخلی؛ جزئیات پایگاه داده به کلاینت برگردانده نمی‌شود |

### هم‌زمانی، صفحه‌بندی و تاریخ

- منابع فهرستی از `limit` (پیش‌فرض ۵۰، حداکثر ۲۰۰) و `offset` (پیش‌فرض صفر) استفاده می‌کنند؛ نام مرتب‌سازی فقط از allow-list همان endpoint پذیرفته می‌شود.
- در `PATCH`، نسخهٔ خوانده‌شده با `If-Match: "<RowVersion>"` فرستاده می‌شود. سرور آن را به `repo.patch(..., expectedRowVersion)` می‌دهد. تغییر نسخه، `409` است؛ کلاینت باید رکورد را تازه‌خوانی کند.
- همهٔ timestampها ISO-8601 UTC هستند؛ تاریخ تقویم شیفت در تقویم محلی Work Center نگه‌داری می‌شود. API زمان محلی بدون offset را نمی‌پذیرد. فیلدهای روز-مؤثر مانند `EffectiveAt` تاریخ خالص `YYYY-MM-DD` می‌گیرند و به ساعت/منطقهٔ زمانی تبدیل نمی‌شوند.
- `CreatedAt/By`, `UpdatedAt/By`, `RowVersion`, `ReleasedBy`, `RecordedBy`, `PostedBy` و وضعیت‌های گردش‌کار از ورودی آزاد CRUD پذیرفته نمی‌شوند؛ سرور آن‌ها را تعیین می‌کند.
- حذف فیزیکی سفارش، عملیات اجراشده، مصرف مواد یا هزینه ممنوع است. دادهٔ مرجع غیرفعال/منسوخ می‌شود؛ حذف ردیف BOM/Routing فقط در پیش‌نویس و با ثبت ممیزی مجاز است.
- درخواست‌های `start`, `finish`, `scrap`, `rework` و `material-consumptions` باید `Idempotency-Key` داشته باشند. اجرای مجدد همان کلید همان نتیجه را برمی‌گرداند یا `409` می‌دهد، نه یک ثبت دوم. برای ثبت تجمعی گزارش عملیات، `If-Match` و `RowVersion` مانع افزایش تکراری پس از retry می‌شوند.

## ۵.۲ کاتالوگ مجوزها و نقش‌ها

پیشوند مجوزهای این بخش `mfg.*` است. ارزیابی هر endpoint باید هم‌زمان **مجوز عمل** و **Plant scope** را بررسی کند؛ مجوز `sys.config.manage` به‌تنهایی نقش business-superuser برای ثبت/اجرای تولید نیست.

| نقش | مجوزهای اصلی |
|---|---|
| `manufacturing_engineer` | `mfg.part.view/edit`, `mfg.bom.view/edit/release`, `mfg.routing.view/edit/release`, `mfg.workcenter.view/edit`, `mfg.calendar.edit`, `mfg.capacity.view`, `mfg.alert.view` |
| `production_planner` | مشاهدهٔ قطعه/BOM/Routing/مرکز کاری؛ `mfg.order.view/create/priority.edit`, `mfg.schedule.view/run/resequence`, `mfg.capacity.view`, `mfg.material.view`, `mfg.mrp.view/run`, `mfg.requisition.create`, داشبورد و هشدار؛ **فاز ۵:** `mfg.demand.view/edit`, `mfg.lotsize.view/edit`, `mfg.mps.view/run/firm`, `mfg.atp.view/check`, `mfg.split.edit`؛ **بخش ۱۱:** `mfg.plannedorder.view/edit/approve/convert`, `mfg.version.view`, `mfg.crp.view`, `mfg.mps.approve`, `mfg.conformance.view` |
| `production_manager` | `mfg.order.view/release/close`, `mfg.schedule.view/run`, ظرفیت، مشاهدهٔ اجرا، داشبورد و رسیدگی به هشدار؛ **فاز ۵:** همهٔ مجوزهای فاز ۵ برنامه‌ریزی |
| `shop_floor_supervisor` | مشاهدهٔ صف/سفارش/ظرفیت، شروع/گزارش/اتمام عملیات، توقف، ضایعات، دوباره‌کاری، مصرف مواد و رسیدگی به هشدار |
| `production_operator` | فقط اقتدار اجرایی: مشاهده/شروع/گزارش/اتمام عملیات، ثبت توقف/ضایعات/دوباره‌کاری و مصرف مواد؛ بدون آزادسازی سفارش یا ویرایش Engineering master |
| `material_planner` | مشاهدهٔ سفارش/ماده، MRP، ایجاد پیشنهاد تأمین و داشبورد مواد |
| `industrial_accountant` | مشاهدهٔ سفارش، `mfg.cost.view/reconcile` و داشبورد مالی تولید؛ بدون تغییر Routing یا برنامهٔ ظرفیت |
| `qc_inspector` موجود | `mfg.execution.view` برای مشاهدهٔ وضعیت عملیات؛ آزادسازی کیفی از گردش‌کار QC جداگانه می‌آید |

نقش‌های جدید در `ROLE_CATALOG` ثبت شده‌اند. هفت Subject نمایشی `u-mfg-*` فقط برای توسعه/آزمون هستند و همگی به `PLANT-DEMO` محدودند؛ در استقرار واقعی، نقش و `plantIds` باید از IdP/دایرکتوری کاربر تأمین شوند.

## ۵.۳ Engineering و دادهٔ پایه

`{partId}`, `{bomId}`, `{itemId}`, `{routingId}`, `{routingOperationId}`, `{workCenterId}`, `{resourceId}` و `{calendarId}` در این جدول شناسهٔ مسیرند. پاسخ‌ها رکورد PascalCase متناظر با schema را برمی‌گردانند؛ فهرست‌ها داخل `{items, page}` هستند.

| متد و مسیر | درخواست → پاسخ داده | اعتبارسنجی اصلی | مجوز |
|---|---|---|---|
| `GET /parts` | فیلتر `q, partType, isActive, limit, offset` → `{items: MfgPart[], page}` | فقط فیلترهای allow-list؛ محدود به Plant | `mfg.part.view` |
| `POST /parts` | `PartNo, NameFa, PartType, BaseUom, ..., Planning?` → قطعهٔ ساخته‌شده با `Id/RowVersion` (و در صورت ارسال `Planning`: `+ Material, Inventory`) | `PartNo` و نام الزامی؛ نوع `manufactured/purchased/phantom/subcontract`; ارز/هزینه معتبر؛ یکتایی شماره در Plant (`409 MFG_DUPLICATE`)؛ ساخت اتمیک `MfgMaterial` و `MfgInventoryLevel` در صورت ارسال `Planning` | `mfg.part.edit` |
| `GET /parts/{partId}` | بدون body → یک `MfgPart` | رکورد باید به همان Plant تعلق داشته باشد | `mfg.part.view` |
| `PATCH /parts/{partId}` | فیلدهای قابل‌ویرایش + `Planning?` + `If-Match` → `MfgPart` به‌روز (و در صورت ارسال `Planning`: `+ Material, Inventory`) | `Id/PlantId/PartNo` هویت‌اند و در PATCH تغییر نمی‌کنند؛ RowVersion الزامی؛ درج/به‌روزرسانی اتمیک `MfgMaterial` و موجودی افتتاحیهٔ `MfgInventoryLevel` در همان تراکنش | `mfg.part.edit` |
| `GET /bom-headers` | فیلتر `partId, status, effectiveAt` → `{items: MfgBomHeader[]}` | قطعه باید در همان Plant باشد؛ تاریخ ISO | `mfg.bom.view` |
| `POST /bom-headers` | `PartId, Revision, BaseQuantity, BaseUom, EffectiveFrom, ...` → سربرگ پیش‌نویس | Part هم‌کارخانه؛ `BaseQuantity > 0`; بازهٔ تاریخ معتبر؛ وضعیت/فیلد انتشار از بدنه حذف می‌شود | `mfg.bom.edit` |
| `GET /bom-headers/{bomId}` | بدون body → سربرگ | محدود به Plant | `mfg.bom.view` |
| `PATCH /bom-headers/{bomId}` | فیلدهای پیش‌نویس + `If-Match` → سربرگ | فقط `draft`; پس از release تغییر نمی‌کند | `mfg.bom.edit` |
| `GET /bom-headers/{bomId}/items` | `limit, offset` → `{items: MfgBomItem[]}` | سربرگ در Plant؛ ترتیب `LineNo` | `mfg.bom.view` |
| `POST /bom-headers/{bomId}/items` | `LineNo, ComponentPartId, QuantityPer, Uom, ScrapPct, IssueMethod, ...` → ردیف | سربرگ draft؛ جزء در همان Plant؛ مقدار مثبت؛ درصد ضایعات ۰..۱۰۰؛ شماره ردیف یکتا؛ `IssueMethod` مجاز | `mfg.bom.edit` |
| `PATCH /bom-items/{itemId}` | فیلدهای ردیف + `If-Match` → ردیف | BOM والد draft؛ جلوگیری از تغییر Plant/والد؛ اعتبارسنجی مجدد مقدار و درصد | `mfg.bom.edit` |
| `DELETE /bom-items/{itemId}` | بدون body → `204` | فقط BOM draft؛ ردیفِ استفاده‌شده در سفارش released حذف نمی‌شود؛ ثبت AuditLog | `mfg.bom.edit` |
| `POST /bom-headers/{bomId}/release` | `If-Match`, اختیاری `EffectiveAt` → سربرگ released | دست‌کم یک ردیف؛ بدون چرخه در انفجار؛ قطعات فعال؛ تاریخ مؤثر؛ کنترل هم‌پوشانی نسخهٔ پیش‌فرض | `mfg.bom.release` |
| `POST /bom-headers/{bomId}/explosions` | `{Quantity, At}` → `{lines:[{PartId, GrossQuantity, ScrapAllowanceQty, NetQuantity, Depth}]}` | `Quantity > 0`; BOM released و مؤثر؛ عمق/تعداد node سقف‌دار؛ چرخه باعث `422` | `mfg.bom.view` |
| `GET /routings` | فیلتر `partId, status, effectiveAt` → `{items: MfgRouting[]}` | محدود به Plant | `mfg.routing.view` |
| `POST /routings` | `PartId, RoutingCode, Revision, BaseQuantity, BaseUom, EffectiveFrom` → Routing draft | قطعه هم‌کارخانه؛ `BaseQuantity > 0`; کد/Revision یکتا برای Plant و Part | `mfg.routing.edit` |
| `GET /routings/{routingId}` | بدون body → Routing | محدود به Plant | `mfg.routing.view` |
| `PATCH /routings/{routingId}` | فیلدهای پیش‌نویس + `If-Match` → Routing | فقط draft؛ هویت و Plant ثابت | `mfg.routing.edit` |
| `GET /routings/{routingId}/operations` | بدون body → `{items: MfgRoutingOperation[]}` | ترتیب صعودی `SequenceNo` | `mfg.routing.view` |
| `POST /routings/{routingId}/operations` | `SequenceNo, OperationCode, OperationNameFa, WorkCenterId, SetupMinutes, RunMinutesPerUnit, ...` → Operation | والد draft؛ Work Center و Cost Center هم‌کارخانه؛ زمان‌ها نامنفی؛ پیش‌نیاز فقط توالی پایین‌تر؛ قواعد overlap/transfer batch | `mfg.routing.edit` |
| `PATCH /routing-operations/{routingOperationId}` | فیلدهای Operation + `If-Match` → Operation | Routing والد draft؛ RowVersion؛ کنترل یکتایی توالی و ارجاعات | `mfg.routing.edit` |
| `DELETE /routing-operations/{routingOperationId}` | بدون body → `204` | فقط در Routing draft و وقتی Routing در سفارش released مصرف نشده باشد | `mfg.routing.edit` |
| `POST /routings/{routingId}/release` | `If-Match`, اختیاری `EffectiveAt` → Routing released | حداقل یک Operation؛ Work Center فعال و هم‌کارخانه؛ توالی معتبر؛ تاریخ/نسخهٔ پیش‌فرض بدون تعارض | `mfg.routing.release` |
| `GET /work-centers` | فیلتر `kind, status, q, limit, offset` → `{items: MfgWorkCenter[]}` | فقط فیلترهای مجاز؛ Plant | `mfg.workcenter.view` |
| `POST /work-centers` | `Code, NameFa, Kind, NominalCapacityMinutesPerDay, EfficiencyPct, TimeZoneId, ..., Rates?` → Work Center (و در صورت ارسال `Rates`: `+ CostCenters[]`) | کد یکتا؛ ظرفیت مثبت؛ راندمان ۰..۱۰۰؛ timezone معتبر؛ Cost Center اختیاری ولی هم‌کارخانه؛ در صورت ارسال `Rates` حداکثر ۳ ردیف نرخ (`machine/labor/overhead`) در همان تراکنش ساخته می‌شود | `mfg.workcenter.edit` |
| `GET /work-centers/{workCenterId}` | بدون body → Work Center | محدود به Plant | `mfg.workcenter.view` |
| `PATCH /work-centers/{workCenterId}` | فیلدهای قابل‌ویرایش + `If-Match` → Work Center | ظرفیت مثبت؛ وضعیت فقط `active/inactive/maintenance`; غیرفعال‌کردن مرکز دارای عملیات جاری رد می‌شود | `mfg.workcenter.edit` |
| `GET /work-centers/{workCenterId}/resources` | `activeOnly` → `{items: MfgWorkCenterResource[]}` | Work Center هم‌کارخانه | `mfg.workcenter.view` |
| `POST /work-centers/{workCenterId}/resources` | `ResourceCode, NameFa, ResourceKind, CapacityUnits, AvailabilityPct, ...` → منبع | ظرفیت > ۰؛ دسترس‌پذیری ۰..۱۰۰؛ `EquipmentId` کلید نرم اختیاری؛ Cost Center در صورت وجود هم‌کارخانه | `mfg.workcenter.edit` |
| `PATCH /work-center-resources/{resourceId}` | فیلدهای منبع + `If-Match` → منبع | هویت و Plant ثابت؛ بازهٔ مؤثر معتبر | `mfg.workcenter.edit` |
| `GET /work-centers/{workCenterId}/calendars` | `from, to` → `{items: MfgWorkCenterCalendar[]}` | پنجرهٔ زمانی معتبر؛ Work Center هم‌کارخانه | `mfg.workcenter.view` |
| `POST /work-centers/{workCenterId}/calendars` | `RuleType, RuleKey, WeekdayIso/CalendarDate, ShiftCode, StartMinuteOfDay, EndMinuteOfDay, ...` → تقویم | الگوی هفتگی یا استثنای تاریخ دقیقاً یکی؛ دقیقهٔ شروع ۰..۱۴۳۹؛ پایان > شروع و ≤۲۸۷۹؛ استراحت داخل طول شیفت؛ کلید یکتا | `mfg.calendar.edit` |
| `PATCH /work-center-calendars/{calendarId}` | فیلدهای تقویم + `If-Match` → تقویم | قیدهای بازه/شیفت دوباره بررسی می‌شوند؛ رکورد مصرف‌شده در برنامهٔ firm بی‌اثرانه تغییر نمی‌کند | `mfg.calendar.edit` |

### ۵.۳.۱ بلوک اختیاری `Planning` روی `POST /parts` و `PATCH /parts/{partId}`

هر دو مسیر ایجاد و ویرایش قطعه یک شیء اختیاری `Planning` می‌پذیرند تا در همان تراکنش (Unit of Work) رکورد برنامه‌ریزی ماده (`MfgMaterial`) و در صورت ارسال، موجودی افتتاحیه (`MfgInventoryLevel`) نیز ثبت یا به‌روز شود:

```json
{
  "Planning": {
    "ProcurementType": "make | buy",
    "LeadTimeDays": 0,
    "SafetyStockQty": 0,
    "LotSize": 1,
    "OrderMultiple": 1,
    "ShelfLifeDays": null,
    "StandardUnitCost": 450000,
    "Currency": "IRR",
    "DefaultWarehouseCode": "WH-MAIN",
    "IsActive": true,
    "OpeningInventory": {
      "WarehouseCode": "WH-MAIN",
      "LocationCode": "RACK-A1",
      "LotNo": "LOT-2026-01",
      "OnHandQty": 500,
      "ReservedQty": 0,
      "BlockedQty": 0,
      "InTransitQty": 0,
      "SafetyStockQty": 0
    }
  }
}
```

- اگر `ProcurementType` ارسال نشود، به‌صورت پیش‌فرض برای `PartType = "purchased"` مقدار `"buy"` و برای سایر انواع `"make"` استخراج می‌شود.
- **سازگاری عقب‌رو در پاسخ:** در صورت ارسال `Planning`، پاسخ شامل فیلدهای ردیف `MfgPart` به‌همراه دو کلید `Material` و `Inventory` است؛ بدون ارسال `Planning`، پاسخ دقیقاً همان ردیف قطعه باقی می‌ماند.
- **ایدمپوتنسی موجودی افتتاحیه:** درج `OpeningInventory` بر پایهٔ کلید یکتا (`InventoryKey = MaterialId|WarehouseCode|LocationCode|LotNo`) انجام می‌شود؛ تکرار همان درج موجودی عمداً no-op است و ردیف موجود را بدون دوبرابر کردن موجودی برمی‌گرداند.
- خطاها: `PartNo` تکراری در کارخانه → `409 MFG_DUPLICATE`؛ کلید ناشناخته → `400 MFG_UNKNOWN_FIELDS`؛ مقدار نامعتبر (مثلاً `ReservedQty + BlockedQty > OnHandQty` یا `LotSize <= 0`) → `400 MFG_VALIDATION_FAILED`.

### ۵.۳.۲ بلوک اختیاری `Rates` روی `POST /work-centers`

تنها مسیر REST برای ساخت ردیف‌های نرخ مرکز هزینه (`MfgCostCenter`)، ارسال آرایهٔ اختیاری `Rates` در بدنهٔ `POST /work-centers` است:

```json
{
  "Rates": [
    {
      "CostElement": "machine",
      "HourlyRate": 1800000,
      "Currency": "IRR",
      "AllocationBasis": "machine_hours",
      "Code": "WC-CNC-MACHINE",
      "NameFa": "نرخ ماشین CNC",
      "EffectiveFrom": "2026-01-01",
      "EffectiveTo": null
    }
  ]
}
```

- حداکثر ۳ ردیف، بدون تکرار `CostElement` (`"machine" | "labor" | "overhead"`). فیلد `HourlyRate` الزامی و نامنفی (`>= 0`) است؛ `Currency` پیش‌فرض `"IRR"` و `AllocationBasis` از مجموعهٔ `machine_hours | labor_hours | units | percent` است.
- در صورت ارسال `Rates`، پاسخ شامل فیلدهای ردیف `MfgWorkCenter` به‌علاوهٔ آرایهٔ `CostCenters` است (بدون `Rates` همان ردیف مرکز کاری برگردانده می‌شود).
- اگر `CostCenterId` صریح در بدنهٔ مرکز کاری داده نشود، سرور آن را روی شناسهٔ مرکز هزینهٔ عنصر `"machine"` (و در نبود آن اولین عنصر ساخته‌شده) تنظیم می‌کند.
- تکرار کد مرکز هزینه (`Code`) در همان کارخانه و تاریخ `EffectiveFrom` با `409 MFG_DUPLICATE` رد می‌شود.

## ۵.۴ سفارش تولید

| متد و مسیر | درخواست → پاسخ داده | اعتبارسنجی اصلی | مجوز |
|---|---|---|---|
| `GET /orders` | فیلتر `status, partId, dueFrom, dueTo, projectId, contractId, priorityRule, q, limit, offset` → `{items: MfgProductionOrder[], page}` | `projectId` و `contractId` صرفاً فیلتر روی کلید نرم بیرونی‌اند و Plant scope را عوض نمی‌کنند | `mfg.order.view` |
| `POST /orders` | نمونهٔ زیر → سفارش با `Status=created` | شماره یکتا در Plant؛ Part فعال و هم‌کارخانه؛ مقدار و `DispatchWeight` > ۰ (وزن پیش‌فرض ۱)؛ DemandSource مجاز؛ منبع غیر manual به DemandRef نیاز دارد؛ `ContractId` و `ProjectId` کلیدهای نرم بیرونی بدون وابستگی به دیتابیس PMIS هستند؛ DueAt با timezone؛ شروع درخواستی ≤ موعد؛ BOM/Routing نمی‌تواند از کلاینت به‌عنوان Released اعلام شود | `mfg.order.create` |
| `GET /orders/{orderId}` | بدون body → ردیف سفارش + `Operations[]` | رکورد هم‌کارخانه؛ عملیات به ترتیب صعودی `SequenceNo` | `mfg.order.view` |
| `POST /orders/{orderId}/release` | `If-Match`, body: `{BomHeaderId, RoutingId, EffectiveAt?}` → `{order, operations[]}` | سفارش `created` و نسخه مطابق؛ BOM و Routing آزادشده/مؤثر و متعلق به همان Part/Plant؛ انفجار BOM بدون چرخه (حداکثر ۳۲ سطح و ۵۰۰۰ ردیف)، Operationهای Routing معتبر و Work Center/منبع فعال؛ `CreatedBy` سفارش نباید همان آزادکننده باشد (SOD). snapshot عملیات، تغییر سفارش و AuditLog در یک UoW ثبت می‌شوند | `mfg.order.release` |
| `PATCH /orders/{orderId}/priority` | `{PriorityRule:"EDD"|"CR"|"MANUAL", ManualRank?, DispatchWeight?}` و `If-Match` → سفارش | `ManualRank >= 0` و فقط برای MANUAL؛ `DispatchWeight > 0`؛ سفارش بسته‌شده قابل تغییر نیست | `mfg.order.reprioritize` |
| `POST /orders/{orderId}/close` | `If-Match`, body: `{CloseReasonFa?}` → سفارش بسته (`Status="closed"`, `ClosedAt`, `ClosedBy`) | همهٔ عملیات `completed`؛ مجموع خروجی سالم + ضایعات با مقدار سفارش منطبق؛ دو گیت بستن: ۱) گیت مواد (`MFG_MATERIALS_NOT_RECONCILED` در صورت نیازمندی مصرف‌نشده) و ۲) گیت هزینه (`MFG_COST_NOT_RECONCILED` در صورت نبود `MfgOrderCost` با `Reconciled=true`)؛ `ClosedAt/ClosedBy` فقط سمت سرور و در یک UoW اتمیک ثبت می‌شوند | `mfg.order.close` |

## ۵.۵ برنامه‌ریزی ظرفیت و صف اعزام

| متد و مسیر | درخواست → پاسخ داده | اعتبارسنجی اصلی | مجوز |
|---|---|---|---|
| `POST /scheduling/runs` | `{Direction, CapacityMode, DispatchRule, From, To, OrderIds?, ExpectedScheduleVersion?}` → `{ScheduleVersion, assignments[], unscheduled[], capacity[]}` | `Direction=forward/backward`; `CapacityMode=finite/semi-finite`; Rule از EDD/SPT/CR/WSPT/FIFO/MANUAL؛ پنجره حداکثر ۳۶۵ روز؛ فقط سفارش‌های released/in-progress در همان Plant؛ `ExpectedScheduleVersion` با نسخهٔ جاری مقایسه می‌شود؛ run، قطعه‌های عملیات، تصویر ظرفیت و AuditLog در یک UoW ذخیره می‌شوند؛ نسخهٔ تکراری در رقابت هم‌زمان رد می‌شود | `mfg.schedule.run` |
| `GET /scheduling/gantt` | `from, to, workCenterId?, orderId?, scheduleVersion?` → `{scheduleVersion, lanes:[{workCenter,segments[]}]}` | `to > from`; پنجره حداکثر ۹۰ روز؛ خروجی فقط همان Plant | `mfg.schedule.view` |
| `POST /scheduling/reschedules` | `{ExpectedScheduleVersion, OperationIds, Reason, DispatchRule?}` → `{ScheduleVersion, PreviousScheduleVersion, assignments[], unscheduled[], capacity[], diff}` | `ExpectedScheduleVersion` باید با نسخهٔ جاری همان Plant برابر باشد؛ فقط عملیات موجود در همان Plant، متعلق به سفارش `released/in-progress` و در وضعیت قابل‌اعزام (`pending/queued/ready`) پذیرفته می‌شود؛ فقط عملیات هدف و زنجیرهٔ وابستگی لازم برای حفظ پیش‌نیازها دوباره برنامه‌ریزی می‌شوند و قطعات خارج از دامنه و `firm` حفظ می‌شوند؛ نسخهٔ جدید، Segmentها، ظرفیت و AuditLog اتمیک ثبت می‌شوند | `mfg.schedule.resequence` |
| `GET /capacity/load` | `from, to, bucket=day/week, workCenterId?` → `{scheduleVersion, bucket, buckets:[{WorkCenterId, PeriodStart, PeriodEnd, AvailableMinutes, PlannedLoadMinutes, UtilizationPct}]}` | آخرین Snapshot همان Plant؛ bucket پیش‌فرض `day` و هفته بر پایهٔ دوشنبهٔ محلی هر Work Center؛ بازهٔ معتبر و مرکز کاری هم‌کارخانه؛ `AvailableMinutes=0` یعنی utilization نامعین (`null`) | `mfg.capacity.view` |
| `GET /capacity/bottlenecks` | `from, to, minUtilizationPct?` → `{scheduleVersion, items:[{WorkCenterId, PeriodStart, PeriodEnd, OverloadMinutes, UtilizationPct, scheduleVersion}]}` | آخرین Snapshot همان Plant؛ حد درصد ۰..۱۰۰ و پیش‌فرض ۱۰۰؛ bucket با بار غیرصفر و utilization مساوی/بالاتر از حد یا دارای اضافه‌بار گزارش می‌شود؛ بازهٔ معتبر | `mfg.capacity.view` |

## ۵.۶ اجرای عملیات، توقف، ضایعات و دوباره‌کاری

| متد و مسیر | درخواست → پاسخ داده | اعتبارسنجی اصلی | مجوز |
|---|---|---|---|
| `GET /operation-queue` | `workCenterId?, status?, shiftDate?, limit, offset` → `{items: MfgProductionOrderOperation[]}` | مرکز کاری هم‌کارخانه؛ فقط عملیات مجاز به اپراتور/سرپرست نمایش داده می‌شود | `mfg.execution.view` |
| `POST /operations/{operationId}/executions` | `Idempotency-Key`; body `{ResourceId?, OperatorId?}` → `MfgOperationExecution` | سفارش Released/In-progress؛ predecessor کامل؛ منبع فعال در Work Center؛ اجرای تکراری با همان کلید یک نشست جدید نمی‌سازد | `mfg.execution.start` |
| `POST /executions/{executionId}/reports` | `If-Match`; body `{InputQuantity, GoodQuantity, ReworkQuantity, ScrapQuantity, SetupActualMinutes, RunActualMinutes, NoteFa?}` → نشست با مقادیر تجمعی | مقادیر نامنفی؛ `Good + Rework + Scrap <= Input`; نشست running؛ مجموع از مقدار مجاز سفارش عبور نکند، مگر AllowOverrun؛ RowVersion جلوی double-add در retry را می‌گیرد | `mfg.execution.report` |
| `POST /executions/{executionId}/finish` | `Idempotency-Key`, `If-Match`; `{FinishedAt?}` → نشست completed و وضعیت عملیات | نشست running؛ پایان ≥ شروع؛ همهٔ مقدارها تطبیق؛ دروازهٔ بازرسی اگر `InspectionRequired` باشد؛ وضعیت فقط سمت سرور تغییر می‌کند | `mfg.execution.finish` |
| `POST /downtime` | `Idempotency-Key`; `{WorkCenterId, OperationId?, ExecutionId?, ResourceId?, StartedAt, FinishedAt?, DowntimeType, ReasonCode, NoteFa?}` → `MfgDowntimeLog` | مرکز کاری هم‌کارخانه؛ زمان پایان ≥ شروع؛ نوع planned/unplanned؛ کد علت معتبر؛ مدت محاسبه‌شده توسط سرور | `mfg.downtime.report` |
| `POST /scrap` | `Idempotency-Key`; `{OperationId, ExecutionId?, Quantity, Uom, ReasonCode, Disposition, CostAmount?, Currency}` → `MfgScrapRecord` | مقدار مثبت؛ نشست/عملیات همان Plant؛ Disposition از فهرست schema؛ مبلغ نامنفی؛ ثبت‌کننده از هویت معتبر | `mfg.scrap.report` |
| `POST /rework` | `Idempotency-Key`; `{SourceOperationId, TargetOperationId?, ExecutionId?, Quantity, Uom, ReasonCode, NoteFa?}` → `MfgReworkRecord` | مقدار مثبت؛ هر دو عملیات متعلق به سفارش/Plant سازگار؛ Target به‌صورت مستقل قابل ردیابی؛ شمارهٔ Rework سمت سرور یکتا | `mfg.rework.report` |
| `GET /operations/{operationId}/variance` | `from?, to?` → استاندارد در برابر Setup/Run واقعی، مقدار سالم/ضایعات/دوباره‌کاری و انحراف زمانی | Operation همان Plant؛ نرخ/هزینه فقط در صورت `mfg.cost.view` پوشش داده می‌شود | `mfg.execution.view` |

## ۵.۷ مواد و MRP

| متد و مسیر | درخواست → پاسخ داده | اعتبارسنجی اصلی | مجوز |
|---|---|---|---|
| `GET /materials` | فیلتر `q, procurementType, isActive, limit, offset` → `{items: MfgMaterial[]}` | Part مرجع هم‌کارخانه؛ فیلتر allow-list | `mfg.material.view` |
| `POST /mrp/calculate` | `{OrderIds?, ThroughDate, ScheduleVersion?, PreviewOnly?}` → `{calculationAt, requirements[], shortages[], proposals[]}` | افق معتبر و محدود؛ فقط سفارش Released؛ BOM چندسطحی بدون چرخه؛ موجودی/رزرو و Lead Time در همان Plant؛ در حالت ثبت، جایگزینی requirements با نسخهٔ جدید باید اتمیک باشد | `mfg.mrp.run` |
| `GET /mrp/shortages` | `requiredBefore?, materialId?, orderId?, scheduleVersion?, limit, offset` → `{items: MfgMaterialRequirement[]}` | مقادیر و تاریخ معتبر؛ ردیف Plant جاری؛ فیلتر نسخه برای snapshot صحیح | `mfg.mrp.view` |
| `POST /material-consumptions` | `Idempotency-Key`; `{OperationId, RequirementId?, ExecutionId?, MaterialId, Quantity, Uom, LotNo?, UnitCost, Currency, ConsumptionMethod}` → `MfgMaterialConsumption` و موجودی/نیاز به‌روز | مقدار > ۰؛ UOM سازگار؛ Requirement در Plant و قابل‌مصرف؛ `UnitCost >= 0`; کلید idempotency یکتا؛ مصرف و کاهش موجودی باید اتمیک باشد | `mfg.material.consume` |
| `POST /material-procurement-proposals` | `{ThroughDate, RequirementIds[]}` → پیشنهاد خرید/تأمین، نه PO قطعی | فقط shortage باز؛ اقلام تکراری حذف؛ تبدیل به PR رسمی از API مالک SCM و مجوز SCM انجام می‌شود؛ در این مسیر PO صادر نمی‌شود | `mfg.requisition.create` |

`MfgMaterialRequirement` نسخه/نیاز را نگه می‌دارد، اما schema فعلی جدول header مستقل برای تاریخچهٔ اجرای MRP ندارد؛ بنابراین `calculationAt`/`ScheduleVersion` مرجع snapshot است و API نباید `GET /mrp/runs/{id}` یا تاریخچهٔ run پایدار را وانمود کند.

## ۵.۸ هزینه، داشبورد و هشدار

| متد و مسیر | درخواست → پاسخ داده | اعتبارسنجی اصلی | مجوز |
|---|---|---|---|
| `GET /cost/orders/{orderId}` | `costVersion?` → استاندارد/برنامه‌ریزی‌شده/واقعی برای ماده، ماشین، دستمزد، سربار و ضایعات؛ انحراف مبلغ/درصد، `ByElement` و `OperationBreakdown` | سفارش و همهٔ ردیف‌ها در Plant جاری؛ ارزهای ناسازگار بدون تبدیل رد می‌شوند؛ نسخهٔ ذخیره‌شده با عناصر مشتق‌شدهٔ جاافتاده کامل می‌شود | `mfg.cost.view` |
| `GET /cost/operations/{operationId}` | `costVersion?` → `{items: MfgOperationCost[], derived: boolean}` شامل پنج عنصر و مقادیر planned/standard/actual و variance | Operation همان Plant؛ ردیف ذخیره‌شده مقدم است و عناصر غایب از دادهٔ واقعی کارگاه مشتق می‌شوند | `mfg.cost.view` |
| `POST /cost/orders/{orderId}/reconcile` | `Idempotency-Key`, `If-Match`; `{CostVersion, ReconcileThrough, ContractRevenue?, ModelVersion?}` → `MfgOrderCost` نهایی با تفکیک هزینه و عملیات | همهٔ عملیات تکمیل‌شده، نشست اجرای باز و کمبود مواد باز نداشته باشد؛ در همان تراکنش ردیف‌های جاافتادهٔ `MfgOperationCost` ساخته و جمع سه مبنا در `MfgOrderCost` ثبت می‌شود؛ RowVersion سفارش و ردیف هزینه کنترل می‌شود | `mfg.cost.reconcile` |
| `GET /dashboard/overview` | `from, to, workCenterId?` → شمارش وضعیت سفارش‌ها، OTD و عقب‌افتادگی، کمبودهای باز MRP، هشدارهای باز به تفکیک شدت و خلاصهٔ هزینه | پنجرهٔ حداکثر ۹۰ روز؛ فقط Plant جاری؛ فیلد هزینه فقط برای دارندهٔ `mfg.cost.view` | `mfg.dashboard.view` |
| `GET /dashboard/work-center-load` | `from, to, bucket=day/week` → بار/ظرفیت هر مرکز و utilization | همان قواعد capacity/load | `mfg.dashboard.view` |
| `GET /dashboard/oee` | `from, to, workCenterId?` → OEE کل و به‌تفکیک Work Center، تقویم مؤثر، توقف برنامه‌ریزی‌شده/ناخواسته و خروجی سالم/ضایعات/دوباره‌کاری | حداکثر ۹۰ روز؛ تقویم با timezone محلی مرکز، روزهای هفتگی/override، break و `AvailabilityPct`؛ توقف‌ها در تقویم clip و هم‌پوشانی‌شان دوباره‌شماری نمی‌شود؛ مخرج صفر `null` | `mfg.dashboard.view` |
| `GET /alerts` | `status?, severity?, orderId?, workCenterId?, limit, offset` → `{items: MfgProductionAlert[], page}` | Plant scope؛ فقط فیلترهای مجاز | `mfg.alert.view` |
| `POST /alerts/{alertId}/acknowledgements` | `If-Match`; `{NoteFa?}` → هشدار acknowledged | فقط هشدار open؛ `AcknowledgedBy/At` سمت سرور؛ وضعیت resolved با acknowledge عوض نمی‌شود | `mfg.alert.ack` |

### ۵.۸.۱ قرارداد رول‌آپ هزینه و دو گیت بستن سفارش

- **مشاهدهٔ هزینهٔ عملیات (`GET /cost/operations/{operationId}`):** خروجی `{items, derived}` است و همواره پنج عنصر `material | machine | labor | overhead | scrap` را کامل می‌کند. ردیف ذخیره‌شده برای همان عنصر/نسخه مقدم است؛ فقط عنصرهای جاافتاده مشتق می‌شوند. `derived` زمانی `true` است که دست‌کم یک عنصر مشتق شده باشد.
- **مشاهدهٔ هزینهٔ سفارش (`GET /cost/orders/{orderId}`):** علاوه بر جمع‌های `Standard*`, `Planned*`, `Actual*`، خروجی `ByElement` (مبالغ و انحراف هر پنج عنصر) و `OperationBreakdown` (جمع و انحراف هر عملیات) دارد. جمع سفارش نسخهٔ `costVersion` را می‌گیرد؛ در نبود خلاصه، روی ردیف‌های عملیات کامل‌شده محاسبه می‌شود. `ContractRevenue`/`GrossMargin` تا وقتی درآمد قرارداد ثبت نشده `null` می‌مانند.
- **تطبیق نهایی هزینه (`POST /cost/orders/{orderId}/reconcile`):** در یک تراکنش اتمیک، ردیف‌های ذخیره‌شده حفظ و عنصرهای مفقود `MfgOperationCost` با `SourceRef: "derived-from-actuals"` درج می‌شوند؛ سپس سه مبنای استاندارد، برنامه‌ریزی‌شده و واقعی برای پنج عنصر در `MfgOrderCost` جمع می‌خورد. اگر خلاصهٔ موجود با جمع جزئیات همان نسخه اختلاف بیش از ۰٫۰۱ داشته باشد، تطبیق با `MFG_COST_TOTAL_MISMATCH` رد می‌شود؛ برای مبنای تازه باید نسخهٔ هزینهٔ تازه ساخت. `Idempotency-Key` تکراری با fingerprint یکسان همان نتیجه را می‌دهد و استفادهٔ متفاوت رد می‌شود؛ `If-Match` روی RowVersion سفارش اجباری است.
- **انحراف:** `CostVariance = Actual − Standard` و `CostVariancePct = (Actual − Standard) / Standard × 100`; مبنای برنامه نیز در `PlannedCostVariance` و `PlannedCostVariancePct` ارائه می‌شود. وقتی مبنا صفر باشد، درصد `null` است و مقدار خالی به صفر پنهان تبدیل نمی‌شود.
- **فرمول عنصر ماده (`material`):**
  - مقدار/مبلغ استاندارد از `GrossQuantity` نسخهٔ آخر نیاز مواد (با fallback به `NetQuantity`) و `StandardUnitCost` ماده/قطعهٔ جزء محاسبه می‌شود.
  - مقدار/مبلغ برنامه‌ریزی‌شده از `NetQuantity × StandardUnitCost` محاسبه می‌شود؛ مقدار واقعی از `MfgMaterialConsumption.Quantity` و مبلغ واقعی از `Quantity × UnitCost` است.
- **فرمول ماشین، دستمزد و سربار (`machine` | `labor` | `overhead`):** مقدار استاندارد از زمان تنظیم و چرخهٔ استاندارد عملیات؛ برنامه از ظرفیت برنامهٔ زمان‌بندی آخر (یا `PlannedCapacityMinutes`/استاندارد به‌عنوان fallback)؛ واقعی از زمان Setup/Run گزارش‌شده در نشست‌های اجراست. هر سه مبلغ برابر ساعت × نرخ مؤثر همان عنصر در `MfgCostCenter` است؛ نرخ/ارز در تاریخ مؤثر همان نسخه انتخاب می‌شود و در نبود نرخ، مبلغ صفر است (نرخ حدسی ساخته نمی‌شود).
- **فرمول ضایعات (`scrap`):** استاندارد و برنامه از `ScrapAllowanceQty` و بهای استاندارد مواد می‌آید؛ واقعی از مقدار ضایعات execution و `MfgScrapRecord` به‌دست می‌آید. ردیف دارای `CostAmount` همان مبلغ ثبت‌شده را به‌کار می‌برد؛ در نبود آن، ارزش‌گذاری از هزینهٔ واحد عملیات برآورد می‌شود. ضایعات متصل به execution برای جلوگیری از دوباره‌شماری تجمیع می‌شوند.
- **داشبورد OEE:** تقویم مؤثر هر مرکز در timezone محلی‌اش به بازه‌های ظرفیت تبدیل می‌شود؛ date-override بر قاعدهٔ هفتگی مقدم است، break حذف می‌شود و `AvailabilityPct` وزن ظرفیت است. توقف‌های planned ابتدا از زمان برنامه کم می‌شوند؛ توقف‌های unplanned پس از حذف هم‌پوشانی از زمان تولید کسر می‌شوند. Performance از چرخه/Setup استاندارد در برابر زمان Setup/Run واقعی و Quality از خروجی سالم در برابر سالم+ضایعات+دوباره‌کاری محاسبه می‌شود؛ Performance برای OEE حداکثر ۱۰۰٪ است.
- **داشبورد کارخانه:** وضعیت سفارش‌ها برای scope کارخانه/مرکز کاری شمارش می‌شود؛ OTD بر سفارش‌های موعددار در بازه محاسبه می‌شود؛ کمبودهای باز MRP و هشدارهای `open` به تفکیک `critical/high/medium/low` می‌آیند. جمع هزینه فقط در صورت مجوز `mfg.cost.view` برگردانده می‌شود.
- **دو گیت بستن سفارش (`POST /orders/{orderId}/close`):** علاوه بر تکمیل تمام عملیات (`completed`) و برابری خروجی تجمعی با مقدار سفارش:
  1. گیت مواد: نیازمندی باز یا بدون مصرف معتبر باقی نماند (`422 MFG_MATERIALS_NOT_RECONCILED`).
  2. گیت هزینه: رکورد `MfgOrderCost` همان سفارش با `Reconciled = true` ثبت شده باشد (`422 MFG_COST_NOT_RECONCILED`).

## ۵.۹ نمونهٔ Request/Response

### ایجاد سفارش تولید

```http
POST /api/mfg/plants/PLANT-01/orders
X-User-Id: u-mfg-plan
Content-Type: application/json
```

```json
{
  "OrderNo": "MO-2026-0042",
  "PartId": "part-ax17",
  "OrderQuantity": 120,
  "Uom": "ea",
  "DueAt": "2026-11-10T12:00:00Z",
  "PriorityRule": "EDD",
  "DispatchWeight": 1,
  "DemandSource": "contract",
  "DemandRef": "SO-2187",
  "ContractId": "contract-17",
  "ProjectId": "project-az-01",
  "CustomerRef": "CUST-12",
  "CustomerNameSnapshot": "مشتری نمونه",
  "AllowOverrun": false
}
```

```json
{
  "ok": true,
  "data": {
    "Id": "mfgorder-...",
    "PlantId": "PLANT-01",
    "OrderNo": "MO-2026-0042",
    "Status": "created",
    "OrderQuantity": 120,
    "DispatchWeight": 1,
    "RowVersion": 1
  },
  "meta": { "traceId": "req-...", "version": "mfg-api-v1" }
}
```

### آزادسازی سفارش و ساخت snapshot عملیات

```http
POST /api/mfg/plants/PLANT-01/orders/mfgorder-42/release
X-User-Id: u-mfg-manager
If-Match: "1"
Content-Type: application/json
```

```json
{
  "BomHeaderId": "bom-ax17-a",
  "RoutingId": "routing-ax17-a",
  "EffectiveAt": "2026-10-03"
}
```

```json
{
  "ok": true,
  "data": {
    "order": {
      "Id": "mfgorder-42",
      "Status": "released",
      "BomHeaderId": "bom-ax17-a",
      "RoutingId": "routing-ax17-a",
      "BomRevisionSnapshot": "A",
      "RoutingRevisionSnapshot": "A",
      "ReleasedBy": "u-mfg-manager",
      "RowVersion": 2
    },
    "operations": [
      {
        "Id": "mfgop-...",
        "ProductionOrderId": "mfgorder-42",
        "SequenceNo": 10,
        "OperationCode": "OP-10",
        "Status": "pending",
        "PlannedQuantity": 120,
        "PlannedCapacityMinutes": 185
      }
    ]
  },
  "meta": { "traceId": "req-...", "version": "mfg-api-v1" }
}
```

در این command همهٔ ساخت Operationها، تغییر وضعیت/نسخهٔ سفارش و AuditLog یا با هم commit می‌شوند یا هیچ‌کدام؛ `If-Match` الزامی است و آزادکننده باید از سازندهٔ سفارش متفاوت باشد.

### اجرای زمان‌بندی کارخانه‌محور

```http
POST /api/mfg/plants/PLANT-01/scheduling/runs
X-User-Id: u-mfg-plan
Content-Type: application/json
```

```json
{
  "Direction": "forward",
  "CapacityMode": "finite",
  "DispatchRule": "EDD",
  "From": "2026-10-05T04:30:00Z",
  "To": "2026-10-19T20:30:00Z",
  "OrderIds": ["mfgorder-42", "mfgorder-43"],
  "ExpectedScheduleVersion": 6
}
```

پاسخ شامل نسخهٔ جدید و قطعه‌های تخصیص است؛ تخصیص ناممکن در `unscheduled[]` و اضافه‌بار در ظرفیت گزارش می‌شود و عملیات به‌طور خام حذف نمی‌شود. برنامه‌ریز از تقویم شیفت و منطقهٔ زمانی هر Work Center استفاده می‌کند، استراحت را با `BreakStartMinuteOfDay` می‌شکند، توقف‌های ثبت‌شده و پیش‌نیازی Operation را در هر دو جهت رعایت می‌کند. `finite` تداخل منبع را محدود می‌کند؛ `semi-finite` اجازهٔ هم‌پوشانی سفارش‌ها را می‌دهد ولی توقف‌های firm را حفظ می‌کند و اضافه‌بار را در تصویر ظرفیت نگه می‌دارد. در `WSPT` ترتیب بر پایهٔ `DispatchWeight / PlannedCapacityMinutes` نزولی است؛ وزن سفارش از API سفارش قابل تنظیم و به‌صورت پیش‌فرض ۱ است. نسخه، assignmentها، ظرفیت روزانه و AuditLog همگی داخل یک Unit of Work ثبت می‌شوند؛ ارسال `ExpectedScheduleVersion` برابر ۰ برای اولین اجرا مجاز است.

### باززمان‌بندی هدفمند عملیات و دریافت Diff

```http
POST /api/mfg/plants/PLANT-01/scheduling/reschedules
X-User-Id: u-mfg-plan
Content-Type: application/json
```

```json
{
  "ExpectedScheduleVersion": 7,
  "OperationIds": ["operation-20"],
  "Reason": "توقف ناخواسته در مرکز تراشکاری",
  "DispatchRule": "WSPT"
}
```

این مسیر نسخهٔ مورد انتظار را با آخرین نسخهٔ همان Plant مقایسه می‌کند و نسخهٔ کهنه را با `409 MFG_SCHEDULE_VERSION_CONFLICT` رد می‌کند. شناسه‌های ناموجود یا متعلق به کارخانهٔ دیگر با `404 MFG_NOT_FOUND`، عملیات سفارش‌های غیرفعال با `422 MFG_ORDER_NOT_RELEASED` و عملیات غیرقابل‌اعزام (`setup/running/blocked/completed`) با `422 MFG_OPERATION_NOT_DISPATCHABLE` رد می‌شوند. به‌جای بازبرنامه‌ریزی بی‌دلیل کل سفارش، فقط عملیات هدف و زنجیرهٔ وابستگی لازم برای حفظ پیش‌نیازها دوباره برنامه‌ریزی می‌شوند، Segmentهای خارج از دامنه و بلوک‌های `firm` حفظ می‌شوند، و نسخهٔ جدید همراه با diff ساختاری نسبت به نسخهٔ قبلی داخل یک تراکنش اتمیک ثبت می‌گردد.

```json
{
  "ok": true,
  "data": {
    "ScheduleVersion": 8,
    "PreviousScheduleVersion": 7,
    "RunId": "MfgScheduleRun-...",
    "Reason": "توقف ناخواسته در مرکز تراشکاری",
    "RequestedOperationIds": ["operation-20"],
    "RescheduledOperationIds": ["operation-20", "operation-30"],
    "diff": {
      "fromScheduleVersion": 7,
      "toScheduleVersion": 8,
      "changedOperationCount": 2,
      "unchangedOperationCount": 1,
      "movedCount": 2,
      "changedOperations": [
        {
          "ProductionOrderOperationId": "operation-20",
          "ChangeType": "moved",
          "Changed": true,
          "PreviousPlannedStartAt": "2026-10-05T10:30:00.000Z",
          "CurrentPlannedStartAt": "2026-10-05T11:30:00.000Z",
          "StartDeltaMinutes": 60,
          "EndDeltaMinutes": 60
        }
      ]
    }
  },
  "meta": { "traceId": "req-...", "version": "mfg-api-v1" }
}
```

### خواندن Gantt نسخهٔ برنامه

```http
GET /api/mfg/plants/PLANT-01/scheduling/gantt?from=2026-10-05T04:30:00Z&to=2026-10-12T20:30:00Z&workCenterId=wc-01&orderId=mfgorder-42&scheduleVersion=7
X-User-Id: u-mfg-plan
```

`from` و `to` الزامی‌اند و باید تاریخ‌زمان معتبر با `to > from` باشند؛ پنجرهٔ بیش از ۹۰ روز رد می‌شود. `workCenterId`، `orderId` و `scheduleVersion` اختیاری‌اند. با حذف نسخه، آخرین نسخهٔ ثبت‌شدهٔ همان Plant انتخاب می‌شود؛ نسخهٔ صریحِ ناموجود در Plant جاری `404 MFG_SCHEDULE_VERSION_NOT_FOUND` می‌دهد. شناسهٔ مرکز کاری یا سفارشِ متعلق به Plant دیگر نیز `404 MFG_NOT_FOUND` می‌دهد. قطعه‌هایی که با بازهٔ نیمه‌باز `[from,to)` هم‌پوشانی دارند در خروجی می‌آیند؛ قطعهٔ لغوشده حذف می‌شود. Lane فقط برای مرکزهای کاری دارای قطعه برگردانده می‌شود و Laneها بر پایهٔ کد مرکز و قطعه‌ها به‌ترتیب زمان شروع مرتب‌اند.

```json
{
  "ok": true,
  "data": {
    "scheduleVersion": 7,
    "from": "2026-10-05T04:30:00.000Z",
    "to": "2026-10-12T20:30:00.000Z",
    "lanes": [
      {
        "workCenter": {
          "Id": "wc-01",
          "Code": "WC-01",
          "NameFa": "مرکز تراشکاری",
          "NameEn": "Turning",
          "Kind": "machine",
          "TimeZoneId": "Asia/Tehran",
          "Status": "active"
        },
        "segments": [
          {
            "Id": "schedule-101",
            "ScheduleVersion": 7,
            "SegmentNo": 1,
            "ProductionOrderId": "mfgorder-42",
            "OrderNo": "MO-42",
            "ProductionOrderOperationId": "operation-10",
            "SequenceNo": 10,
            "OperationCode": "TURN",
            "OperationNameFa": "تراشکاری",
            "WorkCenterId": "wc-01",
            "ResourceId": "resource-01",
            "PlannedStartAt": "2026-10-05T08:00:00.000Z",
            "PlannedEndAt": "2026-10-05T10:00:00.000Z",
            "PlannedCapacityMinutes": 120,
            "QueueMinutes": 0,
            "MoveMinutes": 0,
            "CapacityMode": "finite",
            "Direction": "forward",
            "DispatchRule": "EDD",
            "Status": "tentative"
          }
        ]
      }
    ]
  },
  "meta": { "traceId": "req-...", "version": "mfg-api-v1" }
}
```

### خواندن بار و گلوگاه ظرفیت

```http
GET /api/mfg/plants/PLANT-01/capacity/load?from=2026-10-05T00:00:00Z&to=2026-10-12T00:00:00Z&bucket=week
X-User-Id: u-mfg-plan
```

هر دو endpoint از Snapshot نسخهٔ جاری برنامه در همان Plant می‌خوانند؛ اگر هنوز schedule run ثبت نشده باشد، `scheduleVersion=0` و فهرست خالی برمی‌گردد. `capacity/load`، `bucket=day` را در صورت حذف انتخاب می‌کند و برای `week` روزها را بر اساس هفتهٔ ISO (شروع دوشنبه) در timezone هر Work Center جمع می‌زند. بازهٔ درخواست، bucketهایی را که با آن هم‌پوشانی دارند انتخاب می‌کند؛ مقدارها همان مقدار Snapshot روزانه/هفتگی‌اند و برای بازهٔ جزئی درون یک روز prorate نمی‌شوند. اگر ظرفیت در دسترس صفر باشد، `UtilizationPct` برابر `null` است.

```json
{
  "ok": true,
  "data": {
    "scheduleVersion": 7,
    "bucket": "week",
    "buckets": [
      {
        "WorkCenterId": "wc-01",
        "PeriodStart": "2026-10-05T00:00:00.000Z",
        "PeriodEnd": "2026-10-12T00:00:00.000Z",
        "AvailableMinutes": 2400,
        "PlannedLoadMinutes": 2160,
        "UtilizationPct": 90,
        "ScheduleVersion": 7
      }
    ]
  },
  "meta": { "traceId": "req-...", "version": "mfg-api-v1" }
}
```

```http
GET /api/mfg/plants/PLANT-01/capacity/bottlenecks?from=2026-10-05T00:00:00Z&to=2026-10-12T00:00:00Z&minUtilizationPct=85
X-User-Id: u-mfg-plan
```

حد پیش‌فرض `minUtilizationPct` برابر ۱۰۰ است؛ bucketهای دارای بار برنامه‌ریزی‌شدهٔ غیرصفر با utilization مساوی/بالاتر از حد یا دارای اضافه‌بار برگردانده می‌شوند. اضافه‌بار حتی با utilization نامعین (ظرفیت صفر) در فهرست می‌ماند.

### گزارش اجرا با کنترل RowVersion

```http
POST /api/mfg/plants/PLANT-01/executions/exec-85/reports
X-User-Id: u-mfg-operator
If-Match: "3"
Content-Type: application/json
```

```json
{
  "InputQuantity": 40,
  "GoodQuantity": 36,
  "ReworkQuantity": 2,
  "ScrapQuantity": 1,
  "SetupActualMinutes": 18,
  "RunActualMinutes": 95,
  "NoteFa": "یک قطعه در کنترل ابعادی قرنطینه شد"
}
```

```json
{
  "ok": true,
  "data": {
    "Id": "exec-85",
    "Status": "running",
    "GoodQuantity": 36,
    "ReworkQuantity": 2,
    "ScrapQuantity": 1,
    "RowVersion": 4
  },
  "meta": { "traceId": "req-...", "version": "mfg-api-v1" }
}
```

### اجرای MRP (پیش‌نمایش)

```http
POST /api/mfg/plants/PLANT-01/mrp/calculate
X-User-Id: u-mfg-material
Content-Type: application/json
```

```json
{
  "OrderIds": ["mfgorder-42"],
  "ThroughDate": "2026-12-31T20:30:00Z",
  "ScheduleVersion": 7,
  "PreviewOnly": true
}
```

```json
{
  "ok": true,
  "data": {
    "calculationAt": "2026-10-03T12:00:00Z",
    "previewOnly": true,
    "requirements": [
      { "MaterialId": "mat-steel-01", "GrossQuantity": 240, "AvailableQuantity": 180, "ShortageQuantity": 60, "RequiredAt": "2026-10-09T08:00:00Z" }
    ],
    "proposals": [
      { "MaterialId": "mat-steel-01", "SuggestedQuantity": 60, "NeedBy": "2026-10-09T08:00:00Z" }
    ]
  },
  "meta": { "traceId": "req-...", "version": "mfg-api-v1" }
}
```

### پاسخ هزینهٔ سفارش

```json
{
  "ok": true,
  "data": {
    "ProductionOrderId": "mfgorder-42",
    "CostVersion": 2,
    "Currency": "IRR",
    "StandardTotalCost": 128000000,
    "ActualTotalCost": 133500000,
    "Variance": 5500000,
    "ByElement": {
      "material": { "standard": 70000000, "actual": 73500000 },
      "machine": { "standard": 28000000, "actual": 29000000 },
      "labor": { "standard": 18000000, "actual": 18500000 },
      "overhead": { "standard": 12000000, "actual": 12500000 }
    },
    "Reconciled": false
  },
  "meta": { "traceId": "req-...", "version": "mfg-api-v1" }
}
```

## ۵.۱۰ پیاده‌سازی در ساختار فعلی پروژه

- routeها در ماژول جداگانهٔ `server/manufacturingApi.js` با الگوی `registerManufacturingRoutes(app, { repo, subjects, evaluate })` پیاده می‌شوند و در `server/index.js` پس از middlewareهای `requestId` ثبت شده‌اند. هر صدودو مسیر قرارداد (۱۰۰٪ بخش‌های ۵.۳ تا ۵.۸، بخش ۵.۱۱ و بخش ۵.۱۲ فاز ۵: قطعه، BOM، مسیر ساخت و عملیات آن، مراکز کاری، منابع و تقویم، سفارش تولید، زمان‌بندی/باززمان‌بندی/Gantt/ظرفیت، اجرای کارگاهی/توقف/ضایعات/دوباره‌کاری/انحراف، مواد/MRP/مصرف/پیشنهاد تأمین، و هزینه/داشبورد/OEE/هشدارها) فعال‌اند.
- route guard از `subjects` و `evaluate(subject, permission, { plantId })` استفاده می‌کند؛ هیچ `projectId` ساختگی برای سفارش/رویداد MFG تولید نمی‌شود.
- پاسخ/خطا با الگوی `{ok,data,meta:{traceId}}` و `{ok:false,error:{code,message,traceId}}` است؛ شناسهٔ actor فقط از Subject احراز‌شده می‌آید.
- مسیرهای فعال: `GET/POST /parts`, `GET/PATCH /parts/{partId}`, `GET/POST /bom-headers`, `GET/PATCH /bom-headers/{bomId}`, `GET/POST /bom-headers/{bomId}/items`, `PATCH/DELETE /bom-items/{itemId}`, `POST /bom-headers/{bomId}/release`, `POST /bom-headers/{bomId}/explosions`, `GET/POST /routings`, `GET/PATCH /routings/{routingId}`, `GET/POST /routings/{routingId}/operations`, `PATCH/DELETE /routing-operations/{routingOperationId}`, `POST /routings/{routingId}/release`, `GET/POST /work-centers`, `GET/PATCH /work-centers/{workCenterId}`, `GET/POST /work-centers/{workCenterId}/resources`, `PATCH /work-center-resources/{resourceId}`, `GET/POST /work-centers/{workCenterId}/calendars`, `PATCH /work-center-calendars/{calendarId}`, `GET/POST /orders`, `GET /orders/{orderId}`, `PATCH /orders/{orderId}/priority`, `POST /orders/{orderId}/release`, `POST /orders/{orderId}/close`, `POST /scheduling/runs`, `POST /scheduling/reschedules`, `GET /scheduling/gantt`, `GET /capacity/load`, `GET /capacity/bottlenecks`, `GET /operation-queue`, `POST /operations/{operationId}/executions`, `POST /executions/{executionId}/reports`, `POST /executions/{executionId}/finish`, `POST /downtime`, `POST /scrap`, `POST /rework`, `GET /operations/{operationId}/variance`, `GET /materials`, `POST /mrp/calculate`, `GET /mrp/shortages`, `POST /material-consumptions`, `POST /material-procurement-proposals`, `GET /cost/orders/{orderId}`, `GET /cost/operations/{operationId}`, `POST /cost/orders/{orderId}/reconcile`, `GET /dashboard/overview`, `GET /dashboard/work-center-load`, `GET /dashboard/oee`, `GET /alerts` و `POST /alerts/{alertId}/acknowledgements`؛ به‌علاوهٔ ۲۱ مسیر فاز ۵ (بخش ۵.۱۱) و ۱۶ مسیر بخش ۱۱ (بخش ۵.۱۲) که فهرست شده‌اند.
- مهاجرت‌های افزایشی: `0051` (`manufacturing_mps_lotsizing_atp_overlap`) شش جدول فاز ۵ را می‌سازد و به هر دو جدول عملیات ستون‌های `SplitLotCount` و `OverlapPct` را اضافه می‌کند؛ `0052` (`manufacturing_planned_order_version_pegging`) سه جدول `MfgProductionVersion`، `MfgPlannedOrder` و `MfgRequirementPegging` را به همان ترتیب وابستگی می‌سازد؛ `0053` (`manufacturing_order_demand_source_mrp`) مقدار `mrp` را به `CK_MfgProdOrder_Demand` اضافه می‌کند؛ `0054` (`manufacturing_mps_run_approval`) ستون‌های `Status`/`ApprovedBy`/`ApprovedAt`/`NoteFa` را به `MfgMasterScheduleRun` می‌افزاید. مهاجرت `0046` منجمد و بدون هیچ جدول یا ستون فاز ۵ باقی مانده است.
- migration افزایشی `0047`، جدول سربرگ `MfgScheduleRun` و ستون‌های `DispatchWeight`/`BreakStartMinuteOfDay` را می‌سازد؛ migration افزایشی `0048` ستون `ClosedBy` را به `MfgProductionOrder` اضافه می‌کند (بدون آن `POST /orders/{id}/close` با `ROW_VALIDATION_FAILED` رد می‌شد)؛ و migration افزایشی `0049` کلیدهای خارجی به جداول بیرونی را حذف می‌کند تا دیتابیس تولید ۱۰۰٪ مستقل (Standalone MES) باشد. قاعدهٔ مهاجرت: هر ستون یا قید تازهٔ MFG باید در `manufacturingTablesFor0046()` در `src/services/persistence.ts` فیلتر شود و در مهاجرت جدید بیاید تا `0046/0047/0048` دست‌نخورده بمانند. پس از هر تغییر اسکیما باید `npm run db:mfg` اجرا شود تا `database/manufacturing-schema.sql` بازتولید گردد.
- repository اکنون `transaction(work)` دارد و callback را با repository محدود به همان تراکنش اجرا می‌کند. ایجاد/ویرایش قطعه همراه با `Planning`، ایجاد مرکز کاری همراه با `Rates`، آزادسازی BOM و Routing، آزادسازی و بستن سفارش، اجرای زمان‌بندی و باززمان‌بندی، رخدادهای اجرایی کارگاه (شروع/گزارش/اتمام نشست، توقف، ضایعات و دوباره‌کاری)، ثبت MRP، مصرف هم‌زمان مواد و کاهش موجودی، تطبیق نهایی هزینه و رسیدگی به هشدارها تغییرات جدول‌ها و AuditLog را در یک UoW ثبت می‌کنند. استفادهٔ تصادفی از repository بیرونی در callback رد می‌شود و nested transaction پشتیبانی نمی‌شود. این قابلیت به معنی Outbox اتمیک نیست؛ Observer فعلی همچنان درون‌فرایندی است. در JSON، mutex فقط درون همان process تضمین می‌دهد و journal redo برای recovery استفاده می‌شود؛ در SQL Server از `sql.Transaction` استفاده می‌شود.
- SQL Server این محیط در دسترس نیست؛ آزمون مسیر release روی `JsonFileDriver` واقعی با Unit of Work اجرا شده و آزمون تراکنش SQL صرفاً از harness ساختگی استفاده می‌کند. این نتایج را نباید اجرای integration روی SQL Server تلقی کرد. محدودیت multi-process در JSON نیز پابرجاست.

### آنچه در کد این بخش تغییر کرده است

1. `Subject.plantIds` و `AccessContext.plantId` به موتور RBAC اضافه شده‌اند؛ Plant-scope با `DENY_PLANT_SCOPE` و سیاست fail-closed اعمال می‌شود، بدون آنکه وابستگی به جداول یا مجوزهای سامانهٔ کنترل پروژه وجود داشته باشد.
2. ۳۷ مجوز `mfg.*` و ۷ نقش تخصصی MFG به `ROLE_CATALOG` اضافه شده‌اند؛ `admin` به‌صورت ضمنی مجوز business تولید نمی‌گیرد.
3. آزمون‌های RBAC برای عدم عبور بین دو Plant، نبود Plant assignment و جداسازی نقش‌های تولید افزوده شده‌اند.
4. آزمون‌ها: API تولید `29/29`، scheduler خالص `9/9`، release تراکنشی `4/4`، و schema مستقل تولید `7/7` (جمعاً **۴۹/۴۹** در مجموعهٔ تولید) به‌همراه Unit of Work تراکنش `13/13` و persistence/SQL موجود موفق‌اند. آزمون API، مدیریت قطعه (همراه با بلوک اتمیک `Planning` برای ماده و موجودی افتتاحیه) و نسخه‌های BOM پیش‌نویس/آزادشده و انفجار چندسطحی BOM؛ مدیریت Routing پیش‌نویس، عملیات آن و آزادسازی Routing؛ مدیریت مراکز کاری (همراه با بلوک `Rates` برای ساخت نرخ هزینه)، منابع و تقویم شیفت (با کنترل `BreakStartMinuteOfDay` و قفل تقویم در برنامهٔ `firm`)؛ باززمان‌بندی هدفمند با زنجیرهٔ وابستگی، حفظ بلوک `firm`، تولید `diff`، رد نسخهٔ کهنه/خارج از Plant/عملیات غیرقابل‌اعزام و rollback تراکنش؛ Gantt و گزارش ظرفیت؛ اجرای کارگاهی با صف عملیات، شروع/گزارش تجمعی/اتمام نشست اجرا، کنترل پیش‌نیاز و گیت بازرسی، Idempotency، توقف، ضایعات، دوباره‌کاری و انحراف عملیات (با تفکیک دسترسی هزینه)؛ مواد، محاسبهٔ MRP (پیش‌نمایش و ثبت اتمیک)، کمبودها، پیشنهاد خرید و مصرف واقعی مواد (با کنترل LotNo و کسر اتمیک موجودی)؛ و رول‌آپ هزینهٔ سفارش/عملیات از داده‌های واقعی کارگاه، تطبیق نهایی هزینه، بستن دوگیتی سفارش (`MFG_MATERIALS_NOT_RECONCILED` و `MFG_COST_NOT_RECONCILED`)، داشبورد خلاصه/OEE و رسیدگی به هشدارها را می‌پوشاند. API زمان‌بندی در mock تراکنشی و یک اجرای واقعی با `JsonFileDriver` آزموده شد؛ SQL Server واقعی در دسترس نبود.

## ۵.۱۱ فاز ۵ — MES پیشرفته (MPS، اندازه‌گذاری لات، ATP، تقسیم و هم‌پوشانی)

بیست‌ویک مسیر تازه، همگی زیر همان ریشهٔ `/api/mfg/plants/{plantId}` و با همان قرارداد `{ok,data,meta}`، Plant scope، `If-Match` و Audit. موتور محاسبات در `src/services/manufacturingPlanning.ts` است و با `npm run build:mfgplan` به `server/mfgPlanLogic.js` بسته‌بندی می‌شود؛ ویرایش دستی فایل بسته‌بندی‌شده ممنوع است.

### ۵.۱۱.۱ تقاضا و پیش‌بینی (۵ مسیر)

| مسیر | مجوز | توضیح |
|---|---|---|
| `GET /demand-forecasts` | `mfg.demand.view` | فیلتر با `partId`, `demandType`, `from`, `to`, `status` |
| `POST /demand-forecasts` | `mfg.demand.edit` | کلید یکتا `(PlantId, DemandType, DemandRef, RequiredAt)` |
| `PATCH /demand-forecasts/{demandId}` | `mfg.demand.edit` | `If-Match` الزامی؛ کاهش زیر `ConsumedQuantity` رد می‌شود |
| `DELETE /demand-forecasts/{demandId}` | `mfg.demand.edit` | ردیف `consumed` حذف نمی‌شود (`MFG_STATE_CONFLICT`) |
| `GET /demand/time-phased` | `mfg.demand.view` | تقاضا روی سطل‌های زمانی؛ `outsideHorizonQty` تقاضای بیرون افق را جدا گزارش می‌کند |

قاعدهٔ دامنه: `DemandType=forecast` بدون `ConfidencePct` با `MFG_DEMAND_CONFIDENCE_REQUIRED` رد می‌شود. وقتی اجرای MPS بخشی از یک پیش‌بینی را با سفارش فروش مصرف کرده باشد، ویرایش بعدی روی آن ردیف با `MFG_DEMAND_CONSUMED_LOCK` و کاهش مقدار با `MFG_DEMAND_BELOW_CONSUMED` رد می‌شود.

### ۵.۱۱.۲ اندازه‌گذاری لات (۴ مسیر)

| مسیر | مجوز | توضیح |
|---|---|---|
| `GET /lot-sizing-policies` | `mfg.lotsize.view` | هر ردیف با `eoq` و `periodOrderQuantity` محاسبه‌شده غنی می‌شود |
| `POST /lot-sizing-policies` | `mfg.lotsize.edit` | `PartId` فقط هنگام ثبت پذیرفته می‌شود؛ جابه‌جایی سیاست بین قطعه‌ها مجاز نیست |
| `PATCH /lot-sizing-policies/{policyId}` | `mfg.lotsize.edit` | `If-Match` الزامی |
| `POST /lot-sizing/evaluate` | `mfg.lotsize.view` | ارزیابی خشک؛ هیچ رکوردی نمی‌نویسد |

چهار قاعده پشتیبانی می‌شود: `L4L` (lot-for-lot)، `FOQ` (مقدار ثابت)، `EOQ` و `POQ` (دورهٔ زمانی).

- `EOQ = √(2·D·S / H)` از `AnnualDemandQty`، `OrderingCost` و `HoldingCostPerUnitPerYear`؛ وقتی داده ناکافی باشد `eoq` تهی است و قاعدهٔ EOQ با `MFG_LOT_POLICY_INVALID` رد می‌شود.
- `POQ` از `PeriodOrderQuantity` می‌آید و اگر تهی باشد از نسبت `EOQ` به تقاضای هر سطل مشتق می‌شود.
- قیدهای لات همیشه اعمال می‌شوند: `applyLotConstraints` هرگز از `MaxOrderQty` عبور نمی‌کند و `OrderMultiple` با سقف `MaxOrderQty` گرد می‌شود (`{max:40, multiple:15}` روی ۱۰۰ می‌شود ۳۰).
- `OrderMultiple` تعیین‌نشده یعنی ۱، نه صفر.
- در `POST /lot-sizing/evaluate` بلوک `Demand` اختیاری است: وقتی فرستاده نشود همان رجیستر تقاضایی خوانده می‌شود که MPS می‌خواند، تا ارزیابی خشک با اجرای واقعی قابل مقایسه باشد. بقیهٔ ورودی‌ها (`OnHandQty`, `SafetyStockQty`, `LeadTimeDays`) نیز در نبود، از رکورد قطعه/ماده گرفته می‌شوند.

### ۵.۱۱.۳ برنامهٔ اصلی تولید (۵ مسیر)

| مسیر | مجوز | توضیح |
|---|---|---|
| `POST /mps/runs` | `mfg.mps.run` | `PreviewOnly:true` هیچ چیز نمی‌نویسد؛ در غیر این صورت اجرا، سطرها و مصرف پیش‌بینی در یک تراکنش ثبت می‌شوند |
| `GET /mps/runs` | `mfg.mps.view` | تاریخچه با `RunNo` نزولی |
| `GET /mps/runs/{runId}` | `mfg.mps.view` | هدر اجرا |
| `GET /mps/runs/{runId}/lines` | `mfg.mps.view` | سطرهای زمان‌بندی‌شده |
| `POST /mps/runs/{runId}/firm` | `mfg.mps.firm` | `If-Match` روی هدر اجرا الزامی |

معادلات هر سطل:

```
consumedForecast = min(forecast, salesOrder)
gross            = forecastLeft + salesOrder + contract + manual
projectedBefore  = projectedAfter(سطل قبل) + scheduledReceipts
net              = max(0, gross + safetyStock − projectedBefore)
releaseBucket    = receiptBucket − round(leadTimeDays / daysOfBucket)
```

- **حصار زمان تقاضا (DTF):** در سطل‌های `bucketIndex < DTF` رسید برنامه‌ریزی‌شده سرکوب می‌شود — تقاضای آن بازه فقط با موجودی/رسید واقعی پاسخ داده می‌شود.
- **حصار برنامهٔ قطعی (FPTF):** سطری که `receiptQty > 0` و `bucketIndex < FPTF` دارد `IsFirm=true` می‌شود. قید `FPTF ≥ DTF` در سطح جدول هم کنترل می‌شود.
- `POST /mps/runs/{runId}/firm` وقتی `ThroughBucketIndex` فرستاده نشود از حصار خود اجرا استفاده می‌کند؛ اگر آن حصار صفر باشد با `MFG_MPS_FENCE_EMPTY` رد می‌شود و سطل صفر بی‌سروصدا قطعی نمی‌شود.
- خروجی پیش‌نمایش و خروجی پایدار **شکل یکسانی** دارند (همان کلیدهای `MfgMasterScheduleLine`) تا کلاینت مجبور نباشد دو قرارداد را بفهمد.
- مصرف پیش‌بینی: روی هر ردیف پیش‌بینی `ConsumedQuantity` و `MpsRunId` ثبت می‌شود تا اجرای بعدی همان مقدار را دوباره نشمرد.

### ۵.۱۱.۴ قابل‌تعهد بودن — ATP (۳ مسیر)

| مسیر | مجوز | توضیح |
|---|---|---|
| `POST /atp/checks` | `mfg.atp.check` | `Persist:false` ثبت نمی‌کند |
| `GET /atp/checks` | `mfg.atp.view` | تاریخچهٔ تعهدها |
| `GET /atp/summary` | `mfg.atp.view` | پروفایل ATP یک قطعه بدون ثبت |

دو حالت: `discrete` (قابل‌تعهد هر سطل تا رسید بعدی) و `cumulative` (موجودی جاری، کف صفر). نتیجهٔ تعهد یکی از سه حالت است:

- `available` — سقف تعهد از سطل‌های **تاریخ درخواست به بعد** گرفته می‌شود، نه از موجودی آغازین؛ موجودی آغازین پیش از تقاضای متعهدشدهٔ همان سطل وجود دارد و شمردنش تعهد را بزرگ‌تر از واقع نشان می‌دهد.
- `delayed` — `promisedAt` = آغاز سطل بعدی + `leadTimeDays` و `delayBuckets` = فاصلهٔ سطلی.
- `unavailable` — همراه با `shortageQty` و `promisedQty` (بیشترین مقدار قابل تعهد در افق).

پیش‌بینی فقط وقتی کسر می‌شود که `includeForecast` صریحاً `true` باشد.

### ۵.۱۱.۵ تقسیم لات و هم‌پوشانی عملیات (۴ مسیر)

| مسیر | مجوز | توضیح |
|---|---|---|
| `GET /orders/{orderId}/operations/{operationId}/splits` | `mfg.schedule.view` | لات‌های جاری + `effectiveTransferBatchQty` |
| `POST /orders/{orderId}/operations/{operationId}/splits` | `mfg.split.edit` | جایگزینی کامل لات‌ها در یک فراخوانی |
| `DELETE /operation-splits/{splitLotId}` | `mfg.split.edit` | حذف یک لات |
| `GET /orders/{orderId}/lead-time-analysis` | `mfg.schedule.view` | زمان تحویل با و بدون هم‌پوشانی |

- لات انتقال: `TransferBatchQty` اولویت دارد و در نبود، از `OverlapPct` روی مقدار سفارش مشتق می‌شود. لات انتقال برابر کل مقدار، هم‌پوشانی نمی‌سازد.
- `computeSplitLots` وقتی `TransferBatchQty` تعیین شده باشد دست‌کم ۲ لات می‌سازد؛ با `MinLotQty` تعداد لات به `floor(orderQty / minLotQty)` کاهش می‌یابد و باقی‌ماندهٔ کسری به لات آخر می‌رود (`10/3 → 3.333, 3.333, 3.334`).
- گیت وضعیت: فقط عملیات `pending`/`queued`/`ready` قابل تقسیم است؛ غیر آن `MFG_STATE_CONFLICT`.
- اثر هم‌پوشانی در زمان‌بند: عملیات بعدی از `transferReadyAt` پیش‌نیاز شروع می‌شود (نه از پایان کامل آن) و در زمان‌بندی رو‌به‌عقب، انتهای پیش‌نیاز به همان اندازهٔ `processingMinutes − transferReadyMinutes` دیرتر می‌رود.
- `analyzeLeadTimeOverlap` برای هر پیش‌نیاز هم‌پوشان `overlapTailMinutes = capacityMinutes − (setup + run × transferBatch)` را حساب می‌کند و `baseline*`/`overlapped*` را برای ظرفیت و زمان تحویل، به‌همراه `scheduledSpanMinutes` اندازه‌گیری‌شده گزارش می‌دهد (وقتی پنجرهٔ زمان‌بندی نباشد تهی است).

## ۵.۱۲ فاز ۵ بخش ۱۱ — مفاهیم APICS / ISA-95 / MRP II

شانزده مسیر تازه روی همان ریشه و همان قرارداد. سه جدول جدید (`MfgProductionVersion`, `MfgPlannedOrder`, `MfgRequirementPegging`) با مهاجرت `0052` و ستون‌های تأیید MPS با مهاجرت `0054` ساخته می‌شوند؛ `0046` و `0051` دست‌نخورده و منجمد مانده‌اند.

### ۵.۱۲.۱ MPS جدا از MRP و تأیید دستی آن (۱۱.۱)

| مسیر | مجوز | توضیح |
|---|---|---|
| `POST /mps/runs/{runId}/approve` | `mfg.mps.approve` | `If-Match` الزامی. اجرای `PreviewOnly` با `MFG_MPS_PREVIEW_NOT_APPROVABLE` رد می‌شود |

اجرای MPS در ستون تازهٔ `Status` مقدار `draft` می‌گیرد و با تأیید به `approved` می‌رود؛ `ApprovedBy`/`ApprovedAt`/`NoteFa` همراهش ثبت می‌شود. قید `CK_MfgMpsRun_Approval` تضمین می‌کند `ApprovedAt` بدون `ApprovedBy` ممکن نیست.

### ۵.۱۲.۲ سفارش برنامه‌ریزی‌شده در برابر سفارش تولید (۱۱.۳)

| مسیر | مجوز | توضیح |
|---|---|---|
| `GET /planned-orders` | `mfg.plannedorder.view` | فیلتر با `partId`, `status`, `source`, `dueFrom`, `dueTo` |
| `GET /planned-orders/{plannedOrderId}` | `mfg.plannedorder.view` | ردیف به‌همراه `pegging` |
| `PATCH /planned-orders/{plannedOrderId}` | `mfg.plannedorder.edit` | ویرایش پیش از تبدیل؛ `OriginalQuantity` پیشنهاد موتور را نگه می‌دارد و ویرایش، تأیید قبلی را به `proposed` برمی‌گرداند |
| `POST /planned-orders/{plannedOrderId}/approve` | `mfg.plannedorder.approve` | `proposed → approved` |
| `POST /planned-orders/{plannedOrderId}/reject` | `mfg.plannedorder.approve` | `RejectReasonFa` الزامی است |
| `POST /planned-orders/{plannedOrderId}/convert` | `mfg.plannedorder.convert` | `approved → converted`؛ سفارش تولید در وضعیت `created` ساخته می‌شود تا آزادسازی گیت جدا بماند |

- خروجی MRP **پیشنهاد** است نه تعهد: `POST /mrp/calculate` ردیف‌های `MfgPlannedOrder` را با `Status='proposed'` می‌سازد و اجرای دوبارهٔ همان `MrpRunNo` فقط پیشنهادهای بازبینی‌نشده را جایگزین می‌کند؛ آنچه تأیید یا تبدیل شده دست‌نخورده می‌ماند.
- تبدیل تنها از وضعیت `approved` ممکن است (`MFG_PLANNED_ORDER_NOT_APPROVED`) و تبدیل دوباره با `MFG_PLANNED_ORDER_CONVERTED` رد می‌شود.
- قطعهٔ خریدنی (`PartType='purchased'` یا `ProcurementType='buy'`) به سفارش تولید تبدیل نمی‌شود: `MFG_PLANNED_ORDER_NOT_MAKE` با اشاره به `POST /material-procurement-proposals`. دلیلش این است که چنین سفارشی بی‌عملیات ساخته می‌شد و نه زمان‌بندی می‌شد نه اجرا.
- تفکیک وظایف: مهندس ساخت `mfg.version.edit` دارد ولی `mfg.plannedorder.convert` ندارد؛ مدیر تولید برعکس.

### ۵.۱۲.۳ نسخهٔ تولید (۱۱.۹)

| مسیر | مجوز | توضیح |
|---|---|---|
| `GET /production-versions` | `mfg.version.view` | فیلتر با `partId`, `isActive` |
| `POST /production-versions` | `mfg.version.edit` | فقط با BOM و Routing **آزادشدهٔ همان قطعه**؛ وگرنه `MFG_VERSION_BOM_NOT_RELEASED` |
| `PATCH /production-versions/{versionId}` | `mfg.version.edit` | `If-Match` الزامی؛ انتقال نسخه به قطعهٔ دیگر رد می‌شود |
| `GET /parts/{partId}/production-version` | `mfg.version.view` | resolve نسخهٔ فعال با `workCenterId`, `at`, `versionId` |

ترتیب resolve: شناسهٔ صریح ← نسخهٔ فعال ← بازهٔ اثر (`EffectiveFrom`/`EffectiveTo`) ← مرکز کاری ← `IsDefault` ← `Priority` صعودی و سپس `VersionCode`. نسخهٔ غیرفعال `null` برمی‌گرداند. `VersionCode` در هر قطعه یکتاست و نسخهٔ پیش‌فرض تازه، بقیه را از حالت پیش‌فرض خارج می‌کند.

### ۵.۱۲.۴ CRP — ظرفیت موردنیاز (۱۱.۷)

| مسیر | مجوز | توضیح |
|---|---|---|
| `POST /crp/calculate` | `mfg.crp.view` | کلیدها: `Bucket`, `BucketCount`, `HorizonStart`, `OverloadPct`, `UnderloadPct`, `IncludePlannedOrders` |
| `GET /crp/summary` | `mfg.crp.view` | همان خروجی بدون `buckets` هر مرکز کاری؛ queryها `bucket`, `bucketCount`, `horizonStart`, `overloadPct`, `underloadPct`, `includePlannedOrders` |

خروجی برای هر مرکز کاری `loadMinutes` در برابر `capacityMinutes` را در هر سطل، `utilizationPct`، `surplusMinutes` و `status` (`overload`/`underload`/`idle`/`balanced`) می‌دهد، به‌همراه `levelingSuggestions` که نزدیک‌ترین سطل کم‌بار و `suggestedMinutes` قابل جابه‌جایی را پیشنهاد می‌کند. عملیات زمان‌بندی‌نشده در سطل صفر شمرده می‌شود تا مرکز کاری کم‌بارتر از واقع به نظر نرسد.

### ۵.۱۲.۵ Lead Time Offset و Pegging در گزارش MRP (۱۱.۵ و ۱۱.۶)

| مسیر | مجوز | توضیح |
|---|---|---|
| `GET /mrp/lead-time-offset` | `mfg.mrp.view` | فیلتر با `partId`, `maxLevels` |
| `GET /mrp/pegging` | `mfg.mrp.view` | فیلتر با `partId`, `level` (`single`/`multi`), `rootPartId`, `productionOrderId` |

`POST /mrp/calculate` حالا سه بخش تازه هم برمی‌گرداند:

- `leadTimeOffset` — `cumulativeLeadTimeDays` (پایین‌به‌بالا: ساخت این قطعه با همهٔ زیرمجموعه‌اش) و `availabilityOffsetDays` (بالا‌به‌پایین: این قطعه چند روز پیش از سررسید محصول نهایی باید دم دست باشد)، به‌همراه `finishedGoodsLeadTimeDays` و `levelOffsets`.
- `pegging` — از نیازهای مواد واقعیِ همان اجرا ساخته می‌شود، نه از گراف تئوری BOM؛ زنجیره از جزء به ریشه می‌رود و `quantityPer` روی گام **والد** می‌نشیند (گام مبدأ نسبت به خودش ۱ است). ردیف‌های `MfgRequirementPegging` هم ثبت می‌شوند.
- `plannedOrders` — کمبودها با سیاست لات قطعه و offset آزادسازی تجمیعی به پیشنهاد تبدیل می‌شوند؛ `PlannedReleaseAt` به اندازهٔ `CumulativeLeadTimeDays` پیش از `PlannedDueAt` است.

### ۵.۱۲.۶ ATP ظرفیت‌آگاه (۱۱.۸)

`POST /atp/checks` کلید تازهٔ `IncludeCapacity` (پیش‌فرض `true`) را می‌پذیرد و بخش `capacity` را برمی‌گرداند: برای هر مرکز کاریِ Routing قطعه، `requiredMinutes` در برابر `availableMinutes − loadedMinutes` هر سطل. وعدهٔ نهایی در فیلد `promisedAt` **دیرترِ** وعدهٔ موجودی و وعدهٔ ظرفیت است و `promiseConstrainedByCapacity` می‌گوید کدام قید تعیین‌کننده بوده. ظرفیت فقط وقتی مقید شمرده می‌شود که سطل درخواستی جا نداشته باشد؛ اگر ظرفیت کافی باشد وعدهٔ موجودی دست‌نخورده می‌ماند. قطعهٔ بدون Routing آزادشده `capacity.considered=false` می‌گیرد نه خطا.

### ۵.۱۲.۷ انطباق ISA-95 / MESA-11 (۱۱.۱۱)

| مسیر | مجوز | توضیح |
|---|---|---|
| `GET /conformance/isa95` | `mfg.conformance.view` | سطح ۳ در برابر سطح ۴ و پوشش یازده عملکرد MESA با مسیر واقعی |

خروجی `mesa11.functions` را با `coveredRouteCount`/`totalRouteCount`/`coveragePct` و `routes[].implemented` می‌دهد تا ادعای پوشش قابل سنجش باشد نه ادعای دستی. `isa95.level4.foreignKeysToLevel4` شمار کلیدهای خارجی از جداول `Mfg*` به جداول سطح ۴ است و باید صفر بماند — استقلال منطقی دیتابیس با همین عدد سنجیده می‌شود.

### ۵.۱۲.۸ کدهای قاعدهٔ کسب‌وکار بخش ۱۱

`MFG_VERSION_BOM_NOT_RELEASED`, `MFG_PLANNED_ORDER_NOT_APPROVED`, `MFG_PLANNED_ORDER_CONVERTED`, `MFG_PLANNED_ORDER_NOT_MAKE`, `MFG_MPS_PREVIEW_NOT_APPROVABLE`, `MFG_PART_UNAVAILABLE` — با `422 MFG_BUSINESS_RULE_FAILED`. رویدادهای ممیزی: `MFG_PRODUCTION_VERSION_CREATED/UPDATED`, `MFG_PLANNED_ORDER_UPDATED/APPROVED/REJECTED/CONVERTED`, `MFG_MPS_RUN_APPROVED`. مجوزهای تازه (۹): `mfg.plannedorder.view/edit/approve/convert`, `mfg.version.view/edit`, `mfg.crp.view`, `mfg.mps.approve`, `mfg.conformance.view`.

### ۵.۱۱.۶ کدهای قاعدهٔ کسب‌وکار فاز ۵

`MFG_DEMAND_CONFIDENCE_REQUIRED`, `MFG_DEMAND_CONSUMED_LOCK`, `MFG_DEMAND_BELOW_CONSUMED`, `MFG_LOT_POLICY_INVALID`, `MFG_MPS_FENCE_INVALID`, `MFG_MPS_NO_DEMAND`, `MFG_MPS_FENCE_EMPTY`, `MFG_MPS_NOTHING_TO_FIRM`, `MFG_SPLIT_OVERLAP_INPUT_MISSING`, `MFG_SPLIT_TRANSFER_BATCH_TOO_LARGE` — همگی با `422 MFG_BUSINESS_RULE_FAILED`. رویدادهای ممیزی: `MFG_DEMAND_CREATED/UPDATED/DELETED`, `MFG_LOT_POLICY_CREATED/UPDATED`, `MFG_MPS_RUN_CREATED`, `MFG_MPS_LINES_FIRMED`, `MFG_ATP_CHECKED`, `MFG_OPERATION_SPLIT`, `MFG_OPERATION_SPLIT_DELETED`.
