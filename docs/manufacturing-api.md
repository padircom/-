# بخش ۵ — قرارداد REST API ماژول تولید عملیات‌محور

**نسخهٔ قرارداد:** `mfg-api-v1`

**دامنهٔ اصلی:** کارخانه (`PlantId`)؛ نه پروژه.

**وضعیت این تحویل:** قرارداد کامل طراحی شده و یازده مسیر در `server/manufacturingApi.js` پیاده و در `server/index.js` ثبت شده‌اند؛ شامل قطعه، سفارش، آزادسازی، زمان‌بندی، Gantt و ظرفیت. مسیرهای باقی‌ماندهٔ جدول‌های پایین همچنان قرارداد هستند و هنوز handler اجرایی ندارند. تغییرات واقعی RBAC و Plant-scope نیز در `src/services/accessControl.ts` انجام شده‌اند. فرمان‌های چندجدولی باید از Unit of Work اتمیک استفاده کنند و نباید با چند `repo.create/patch` مستقل منتشر شوند.

## ۵.۱ قواعد مشترک

پیشوند همهٔ مسیرها:

```text
/api/mfg/plants/{plantId}
```

`plantId` در هر درخواست اجباری است و با `Subject.plantIds` در موتور RBAC سنجیده می‌شود. نبود یا خالی‌بودن `plantIds` برای درخواست Plant-scoped به معنی **عدم دسترسی** است؛ فقط `plantIds: ["*"]` دسترسی همهٔ کارخانه‌ها را می‌دهد. `ProjectId` در سفارش، در صورت نیاز، تنها مرجع تجاری/گزارشی اختیاری است و هرگز دامنهٔ برنامه‌ریزی تولید را تعیین نمی‌کند. ارائهٔ `ProjectId` دسترسی Plant را ایجاد یا گسترش نمی‌دهد؛ نمایش/اعتبارسنجی جزئیات پروژه علاوه بر مجوز MFG به کنترل پروژهٔ متناظر نیاز دارد.

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
| `production_planner` | مشاهدهٔ قطعه/BOM/Routing/مرکز کاری؛ `mfg.order.view/create/priority.edit`, `mfg.schedule.view/run/resequence`, `mfg.capacity.view`, `mfg.material.view`, `mfg.mrp.view/run`, `mfg.requisition.create`, داشبورد و هشدار |
| `production_manager` | `mfg.order.view/release/close`, `mfg.schedule.view/run`, ظرفیت، مشاهدهٔ اجرا، داشبورد و رسیدگی به هشدار |
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
| `POST /parts` | `PartNo, NameFa, PartType, BaseUom, ...` → قطعهٔ ساخته‌شده با `Id/RowVersion` | `PartNo` و نام الزامی؛ نوع `manufactured/purchased/phantom/subcontract`; ارز/هزینه معتبر؛ یکتایی شماره در Plant | `mfg.part.edit` |
| `GET /parts/{partId}` | بدون body → یک `MfgPart` | رکورد باید به همان Plant تعلق داشته باشد | `mfg.part.view` |
| `PATCH /parts/{partId}` | فیلدهای قابل‌ویرایش + `If-Match` → `MfgPart` به‌روز | `Id/PlantId/PartNo` هویت‌اند و در PATCH تغییر نمی‌کنند؛ RowVersion الزامی | `mfg.part.edit` |
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
| `POST /work-centers` | `Code, NameFa, Kind, NominalCapacityMinutesPerDay, EfficiencyPct, TimeZoneId, ...` → Work Center | کد یکتا؛ ظرفیت مثبت؛ راندمان ۰..۱۰۰؛ timezone معتبر؛ Cost Center اختیاری ولی هم‌کارخانه | `mfg.workcenter.edit` |
| `GET /work-centers/{workCenterId}` | بدون body → Work Center | محدود به Plant | `mfg.workcenter.view` |
| `PATCH /work-centers/{workCenterId}` | فیلدهای قابل‌ویرایش + `If-Match` → Work Center | ظرفیت مثبت؛ وضعیت فقط `active/inactive/maintenance`; غیرفعال‌کردن مرکز دارای عملیات جاری رد می‌شود | `mfg.workcenter.edit` |
| `GET /work-centers/{workCenterId}/resources` | `activeOnly` → `{items: MfgWorkCenterResource[]}` | Work Center هم‌کارخانه | `mfg.workcenter.view` |
| `POST /work-centers/{workCenterId}/resources` | `ResourceCode, NameFa, ResourceKind, CapacityUnits, AvailabilityPct, ...` → منبع | ظرفیت > ۰؛ دسترس‌پذیری ۰..۱۰۰؛ Equipment/Cost Center در صورت وجود هم‌کارخانه | `mfg.workcenter.edit` |
| `PATCH /work-center-resources/{resourceId}` | فیلدهای منبع + `If-Match` → منبع | هویت و Plant ثابت؛ بازهٔ مؤثر معتبر | `mfg.workcenter.edit` |
| `GET /work-centers/{workCenterId}/calendars` | `from, to` → `{items: MfgWorkCenterCalendar[]}` | پنجرهٔ زمانی معتبر؛ Work Center هم‌کارخانه | `mfg.workcenter.view` |
| `POST /work-centers/{workCenterId}/calendars` | `RuleType, RuleKey, WeekdayIso/CalendarDate, ShiftCode, StartMinuteOfDay, EndMinuteOfDay, ...` → تقویم | الگوی هفتگی یا استثنای تاریخ دقیقاً یکی؛ دقیقهٔ شروع ۰..۱۴۳۹؛ پایان > شروع و ≤۲۸۷۹؛ استراحت داخل طول شیفت؛ کلید یکتا | `mfg.calendar.edit` |
| `PATCH /work-center-calendars/{calendarId}` | فیلدهای تقویم + `If-Match` → تقویم | قیدهای بازه/شیفت دوباره بررسی می‌شوند؛ رکورد مصرف‌شده در برنامهٔ firm بی‌اثرانه تغییر نمی‌کند | `mfg.calendar.edit` |

## ۵.۴ سفارش تولید

| متد و مسیر | درخواست → پاسخ داده | اعتبارسنجی اصلی | مجوز |
|---|---|---|---|
| `GET /orders` | فیلتر `status, partId, dueFrom, dueTo, projectId, contractId, priorityRule, q, limit, offset` → `{items: MfgProductionOrder[]}` | `projectId` فقط فیلتر/پیوند اختیاری است و Plant scope را عوض نمی‌کند؛ در صورت نمایش اطلاعات پروژه، کنترل scope پروژه هم لازم است | `mfg.order.view` |
| `POST /orders` | نمونهٔ زیر → سفارش با `Status=created` | شماره یکتا در Plant؛ Part فعال و هم‌کارخانه؛ مقدار و `DispatchWeight` > ۰ (وزن پیش‌فرض ۱)؛ DemandSource مجاز؛ منبع غیر manual به DemandRef نیاز دارد؛ contract به ContractId و ProjectId قابل‌دسترسی نیاز دارد؛ DueAt با timezone؛ شروع درخواستی ≤ موعد؛ BOM/Routing نمی‌تواند از کلاینت به‌عنوان Released اعلام شود | `mfg.order.create` |
| `GET /orders/{orderId}` | بدون body → سفارش و عملیات وابسته (در صورت وجود) | رکورد هم‌کارخانه؛ ProjectId فقط در صورت مجوز پروژه باز می‌شود | `mfg.order.view` |
| `POST /orders/{orderId}/release` | `If-Match`, body: `{BomHeaderId, RoutingId, EffectiveAt?}` → `{order, operations[]}` | سفارش `created` و نسخه مطابق؛ BOM و Routing آزادشده/مؤثر و متعلق به همان Part/Plant؛ انفجار BOM بدون چرخه (حداکثر ۳۲ سطح و ۵۰۰۰ ردیف)، Operationهای Routing معتبر و Work Center/منبع فعال؛ `CreatedBy` سفارش نباید همان آزادکننده باشد (SOD). snapshot عملیات، تغییر سفارش و AuditLog در یک UoW ثبت می‌شوند | `mfg.order.release` |
| `PATCH /orders/{orderId}/priority` | `{PriorityRule:"EDD"|"CR"|"MANUAL", ManualRank?, DispatchWeight?}` و `If-Match` → سفارش | `ManualRank >= 0` و فقط برای MANUAL؛ `DispatchWeight > 0`؛ سفارش بسته‌شده قابل تغییر نیست؛ این عمل Project schedule را تغییر نمی‌دهد | `mfg.order.reprioritize` |
| `POST /orders/{orderId}/close` | `{If-Match, closeReason?}` → سفارش بسته | همهٔ عملیات تمام؛ مقدار/ضایعات تطبیق؛ مصرف و هزینهٔ لازم تعیین تکلیف؛ `ClosedAt/By` فقط سمت سرور؛ بستن چندگیتی نیازمند تراکنش است | `mfg.order.close` |

## ۵.۵ برنامه‌ریزی ظرفیت و صف اعزام

| متد و مسیر | درخواست → پاسخ داده | اعتبارسنجی اصلی | مجوز |
|---|---|---|---|
| `POST /scheduling/runs` | `{Direction, CapacityMode, DispatchRule, From, To, OrderIds?, ExpectedScheduleVersion?}` → `{ScheduleVersion, assignments[], unscheduled[], capacity[]}` | `Direction=forward/backward`; `CapacityMode=finite/semi-finite`; Rule از EDD/SPT/CR/WSPT/FIFO/MANUAL؛ پنجره حداکثر ۳۶۵ روز؛ فقط سفارش‌های released/in-progress در همان Plant؛ `ExpectedScheduleVersion` با نسخهٔ جاری مقایسه می‌شود؛ run، قطعه‌های عملیات، تصویر ظرفیت و AuditLog در یک UoW ذخیره می‌شوند؛ نسخهٔ تکراری در رقابت هم‌زمان رد می‌شود | `mfg.schedule.run` |
| `GET /scheduling/gantt` | `from, to, workCenterId?, orderId?, scheduleVersion?` → `{scheduleVersion, lanes:[{workCenter,segments[]}]}` | `to > from`; پنجره حداکثر ۹۰ روز؛ خروجی فقط همان Plant | `mfg.schedule.view` |
| `POST /scheduling/reschedules` | `{ExpectedScheduleVersion, OperationIds, Reason, DispatchRule?}` → نسخهٔ جدید و diff | فقط عملیات قابل‌اعزام؛ predecessorها، firm blocks و ظرفیت دوباره ارزیابی می‌شوند؛ نسخهٔ ورودی باید هنوز جاری باشد | `mfg.schedule.resequence` |
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
| `GET /cost/orders/{orderId}` | `costVersion?` → مقادیر استاندارد/واقعی به تفکیک ماده، ماشین، نیروی کار، سربار؛ جمع و Gross Margin | سفارش همان Plant؛ نرخ/ارز همان نسخه؛ مقدار خالی به صفر ضمنی تبدیل نمی‌شود | `mfg.cost.view` |
| `GET /cost/operations/{operationId}` | `costVersion?` → `{items: MfgOperationCost[]}` | Operation همان Plant؛ نمایش `ActualRate` بر پایهٔ طبقه‌بندی هزینه | `mfg.cost.view` |
| `POST /cost/orders/{orderId}/reconcile` | `Idempotency-Key`, `If-Match`; `{CostVersion, ReconcileThrough}` → `MfgOrderCost` نهایی | اجرای عملیات/مصرف‌های لازم کامل؛ جمع اجزا با Total برابر؛ نسخهٔ هزینه فعال؛ ثبت Reconciled فقط سمت سرور و اتمیک | `mfg.cost.reconcile` |
| `GET /dashboard/overview` | `from, to, workCenterId?` → خلاصهٔ سفارش باز، تحویل به‌موقع، خروجی سالم، ضایعات و کمبود | پنجرهٔ حداکثر ۹۰ روز؛ فقط Plant جاری | `mfg.dashboard.view` |
| `GET /dashboard/work-center-load` | `from, to, bucket=day/week` → بار/ظرفیت هر مرکز و utilization | همان قواعد capacity/load | `mfg.dashboard.view` |
| `GET /dashboard/oee` | `from, to, workCenterId?` → Availability/Performance/Quality و OEE با شمارنده/مخرج | فقط با دادهٔ قابل‌ردیابی؛ مخرج صفر `null` می‌شود؛ downtime planned و unplanned مطابق تعریف مدل جدا می‌مانند | `mfg.dashboard.view` |
| `GET /alerts` | `status?, severity?, orderId?, workCenterId?, limit, offset` → `{items: MfgProductionAlert[]}` | Plant scope؛ فقط فیلترهای مجاز | `mfg.alert.view` |
| `POST /alerts/{alertId}/acknowledgements` | `If-Match`; `{NoteFa?}` → هشدار acknowledged | فقط هشدار open؛ `AcknowledgedBy/At` سمت سرور؛ وضعیت resolved با acknowledge عوض نمی‌شود | `mfg.alert.ack` |

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

- routeها در ماژول جداگانهٔ `server/manufacturingApi.js` با الگوی `registerManufacturingRoutes(app, { repo, subjects, evaluate })` پیاده می‌شوند و در `server/index.js` پس از middlewareهای `requestId` ثبت شده‌اند. یازده مسیر قطعه/سفارش/زمان‌بندی/ظرفیت فعال‌اند؛ از commandهای چندجدولی، آزادسازی و اجرای زمان‌بندی handler اجرایی دارند و مسیرهای Gantt و ظرفیت Snapshot ثبت‌شده را می‌خوانند.
- route guard از `subjects` و `evaluate(subject, permission, { plantId })` استفاده می‌کند؛ هیچ `projectId` ساختگی برای سفارش/رویداد MFG تولید نمی‌شود.
- پاسخ/خطا با الگوی `{ok,data,meta:{traceId}}` و `{ok:false,error:{code,message,traceId}}` است؛ شناسهٔ actor فقط از Subject احراز‌شده می‌آید.
- مسیرهای فعال: `GET/POST /parts`, `GET/POST /orders`, `GET /orders/{orderId}`, `PATCH /orders/{orderId}/priority`, `POST /orders/{orderId}/release`, `POST /scheduling/runs`, `GET /scheduling/gantt`, `GET /capacity/load` و `GET /capacity/bottlenecks`. آزادسازی، RowVersion سفارش را کنترل می‌کند، جداسازی وظایف سازنده/آزادکننده را enforce می‌کند، BOM چندسطحی را از نظر چرخه/مؤثربودن اعتبارسنجی می‌کند و Operationهای Routing را snapshot می‌کند. زمان‌بندی، نسخه را Plant-scoped کنترل می‌کند، تقویم/استراحت/توقف و پیش‌نیازی Operation را لحاظ می‌کند و گزارش ظرفیت را هم‌زمان می‌نویسد. Gantt بازهٔ حداکثر ۹۰روزه و فیلترهای اختیاری مرکز کاری/سفارش/نسخه را با کنترل Plant scope پشتیبانی می‌کند؛ گزارش‌های ظرفیت نیز از نسخهٔ جاری استفاده می‌کنند.
- migration افزایشی `0047`، جدول سربرگ `MfgScheduleRun` و ستون‌های `DispatchWeight`/`BreakStartMinuteOfDay` را می‌سازد؛ DDL تثبیت‌شدهٔ `0046` عمداً با schema جدید بازتولید نمی‌شود. DDL کامل MFG از `npm run db:mfg` ساخته می‌شود.
- repository اکنون `transaction(work)` دارد و callback را با repository محدود به همان تراکنش اجرا می‌کند. آزادسازی سفارش snapshot عملیات، تغییر سفارش و AuditLog؛ اجرای زمان‌بندی هم header نسخه، Segmentهای عملیات، تصویر ظرفیت و AuditLog را در یک UoW ثبت می‌کند. استفادهٔ تصادفی از repository بیرونی در callback رد می‌شود و nested transaction پشتیبانی نمی‌شود. ثبت MRP، مصرف هم‌زمان مواد/موجودی، بستن سفارش و تطبیق هزینه هنوز handler فعال ندارند. این قابلیت به معنی Outbox اتمیک نیست؛ Observer فعلی همچنان درون‌فرایندی است. در JSON، mutex فقط درون همان process تضمین می‌دهد و journal redo برای recovery استفاده می‌شود؛ در SQL Server از `sql.Transaction` استفاده می‌شود.
- SQL Server این محیط در دسترس نیست؛ آزمون مسیر release روی `JsonFileDriver` واقعی با Unit of Work اجرا شده و آزمون تراکنش SQL صرفاً از harness ساختگی استفاده می‌کند. این نتایج را نباید اجرای integration روی SQL Server تلقی کرد. محدودیت multi-process در JSON نیز پابرجاست.

### آنچه در کد این بخش تغییر کرده است

1. `Subject.plantIds` و `AccessContext.plantId` به موتور RBAC اضافه شده‌اند؛ Plant-scope با `DENY_PLANT_SCOPE` و سیاست fail-closed اعمال می‌شود، بدون آنکه ارزیابی‌های Project موجود تغییر کنند.
2. ۳۷ مجوز `mfg.*` و ۷ نقش تخصصی MFG به `ROLE_CATALOG` اضافه شده‌اند؛ `admin` به‌صورت ضمنی مجوز business تولید نمی‌گیرد.
3. آزمون‌های RBAC برای عدم عبور بین دو Plant، نبود Plant assignment و جداسازی نقش‌های تولید افزوده شده‌اند.
4. آزمون‌ها: Unit of Work تراکنش `13/13`، API تولید `12/12`، release `4/4`، scheduler خالص `7/7`، schema تولید `6/6` و persistence/SQL موجود `79/79` موفق‌اند. آزمون API، Gantt را با نسخهٔ جاری/صریح، مرتب‌سازی segmentها، بازهٔ نامعتبر/بیش از ۹۰ روز و فیلتر خارج از Plant؛ و گزارش ظرفیت را با Snapshot روزانه/هفتگی، آستانهٔ utilization و اضافه‌بار می‌پوشاند. API زمان‌بندی در mock تراکنشی و یک اجرای دستی با `JsonFileDriver` واقعی آزموده شد؛ SQL Server واقعی در دسترس نبود.
