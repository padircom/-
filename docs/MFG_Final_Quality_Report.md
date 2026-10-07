# گزارش نهایی کیفیت — سامانهٔ مستقل برنامه‌ریزی و کنترل تولید (Standalone MES · `mfg-api-v1`)

**تاریخ تحویل:** ۲۰۲۶-۱۰-۰۳  
**نسخهٔ قرارداد REST:** `mfg-api-v1`  
**دامنهٔ عملیاتی:** کارخانه‌محور (`PlantId` — کارخانهٔ نمونه: `PLANT-DEMO`)

---

## ۱. معماری مستقل سامانهٔ برنامه‌ریزی و کنترل تولید (Standalone MES)

این سامانه به‌عنوان یک **نرم‌افزار کاملاً مستقل برنامه‌ریزی و کنترل تولید کارگاهی (Standalone MES)** طراحی و ممیزی شده است و وابستگی ساختاری به سامانهٔ کنترل پروژه (PMIS/WBS/CPM) ندارد:

1. **دیتابیس مستقل (`src/services/manufacturingSchema.ts` و `database/manufacturing-schema.sql`):**
   - شامل **۲۶ جدول مستقل** با پیشوند `Mfg*` در ماژول `mfg` و دامنهٔ اجباری `PlantId`.
   - هرگونه کلید خارجی فیزیکی (Foreign Key) به جداول بیرونی (`Project`، `ContractMaster` و `Equipment`) از اسکیما و خروجی `database/manufacturing-schema.sql` حذف شده و مهاجرت افزایشی **`0049` (`manufacturing_standalone_decouple_external_fks`)** نیز برای حذف آن‌ها روی دیتابیس‌های ارتقایافته ثبت شده است (در حالی که مهاجرت‌های تثبیت‌شدهٔ `0046`، `0047` و `0048` دست‌نخورده مانده‌اند).
   - فیلدهای `ProjectId`، `ContractId` و `EquipmentId` صرفاً کلیدهای متنی نرم (Soft External References) برای یکپارچگی از طریق REST API با سامانه‌های بیرونی هستند.
2. **بک‌اند مستقل (`server/manufacturingApi.js` و `server/manufacturingScheduler.js`):**
   - هر ۶۵ مسیر REST زیر پیشوند `/api/mfg/plants/:plantId` و با موتور RBAC کارخانه‌محور (`mfg.*` و `Subject.plantIds`) اجرا می‌شوند.
   - بک‌اند MES هیچ کوئری مستقیمی به جداول بیرونی (`Project` یا `ContractMaster`) نمی‌زند و هیچ مجوز بیرونی (`core.project.view`) را پیش‌نیاز عملیات تولید قرار نمی‌دهد.
3. **فرانت‌اند مستقل (`src/components/ManufacturingWorkspace.tsx` و `src/services/manufacturingApi.ts`):**
   - قابل اجرا به‌صورت **برنامهٔ تمام‌صفحهٔ مستقل MES** از طریق آدرس `/?app=mes` یا `#mes` (بدون هیچ نوار کناری یا انتخابگر پروژهٔ PMIS) و همچنین قابل دسترس از داخل نمای دامنهٔ `d9` در `ModuleDetail.tsx` (بدون تغییر فایل حفاظت‌شدهٔ `src/data/framework.ts`).

---

## ۲. تفکیک ۶۵ مسیر REST API (`mfg-api-v1`)

> **به‌روزرسانی فاز ۵:** این گزارش وضعیت فازهای ۱ تا ۴ را ثبت می‌کند. با فاز ۵ (MES پیشرفته)
> بیست‌ویک مسیر تازه اضافه شد و شمار مسیرهای قرارداد از ۶۵ به ۸۶ رسید. سپس با بخش ۱۱
> (مفاهیم APICS / ISA-95 / MRP II) شانزده مسیر دیگر اضافه شد: مسیرهای قرارداد **۱۰۲**،
> جدول‌ها **۳۵** و مجوزهای `mfg.*` **۵۶** (از ۳۷ در پایان فاز ۴). مهاجرت‌ها تا `0054`
> پیش رفته‌اند. جزئیات در `docs/MFG_Phase5_Advanced_MES.md` و بخش‌های ۵.۱۱ و ۵.۱۲
> `docs/manufacturing-api.md` آمده است.


تمامی **۶۵/۶۵ مسیر** قرارداد `docs/manufacturing-api.md` در `server/manufacturingApi.js` پیاده‌سازی و فعال شده‌اند:

| بخش قرارداد | حوزهٔ عملیاتی | تعداد مسیر | مسیرهای کلیدی |
|---|---|---:|---|
| **۵.۳ (الف)** | قطعه، برنامه‌ریزی مادهٔ افتتاحیه (`Planning`) و BOM | ۱۴ | `GET/POST /parts`, `GET/PATCH /parts/:partId`, `GET/POST /bom-headers`, `GET/PATCH /bom-headers/:bomId`, `GET/POST /bom-headers/:bomId/items`, `PATCH/DELETE /bom-items/:itemId`, `POST /bom-headers/:bomId/release`, `POST /bom-headers/:bomId/explosions` |
| **۵.۳ (ب)** | مسیر ساخت (Routing) و توالی عملیات | ۹ | `GET/POST /routings`, `GET/PATCH /routings/:routingId`, `GET/POST /routings/:routingId/operations`, `PATCH/DELETE /routing-operations/:routingOperationId`, `POST /routings/:routingId/release` |
| **۵.۳ (ج)** | مراکز کاری (همراه با نرخ هزینه `Rates`)، منابع و تقویم شیفت | ۱۰ | `GET/POST /work-centers`, `GET/PATCH /work-centers/:workCenterId`, `GET/POST /work-centers/:workCenterId/resources`, `PATCH /work-center-resources/:resourceId`, `GET/POST /work-centers/:workCenterId/calendars`, `PATCH /work-center-calendars/:calendarId` |
| **۵.۴** | سفارش‌های تولید، اولویت‌دهی، آزادسازی اتمیک و بستن دوگیتی | ۶ | `GET/POST /orders`, `GET /orders/:orderId`, `PATCH /orders/:orderId/priority`, `POST /orders/:orderId/release`, `POST /orders/:orderId/close` |
| **۵.۵** | زمان‌بندی ظرفیت محدود، باززمان‌بندی (Diff)، گانت و گلوگاه ظرفیت | ۵ | `POST /scheduling/runs`, `POST /scheduling/reschedules`, `GET /scheduling/gantt`, `GET /capacity/load`, `GET /capacity/bottlenecks` |
| **۵.۶** | صف عملیات کارگاهی، اجرای عملیات، توقف، ضایعات، دوباره‌کاری و انحراف | ۸ | `GET /operation-queue`, `POST /operations/:operationId/executions`, `POST /executions/:executionId/reports`, `POST /executions/:executionId/finish`, `POST /downtime`, `POST /scrap`, `POST /rework`, `GET /operations/:operationId/variance` |
| **۵.۷** | مواد برنامه‌ریزی، محاسبهٔ MRP، کمبودها، مصرف واقعی و پیشنهاد تأمین | ۵ | `GET /materials`, `POST /mrp/calculate`, `GET /mrp/shortages`, `POST /material-consumptions`, `POST /material-procurement-proposals` |
| **۵.۸** | رول‌آپ هزینهٔ سفارش/عملیات، تطبیق نهایی، داشبورد، OEE و هشدارها | ۸ | `GET /cost/orders/:orderId`, `GET /cost/operations/:operationId`, `POST /cost/orders/:orderId/reconcile`, `GET /dashboard/overview`, `GET /dashboard/work-center-load`, `GET /dashboard/oee`, `GET /alerts`, `POST /alerts/:alertId/acknowledgements` |
| **جمع کل** | **کل مسیرهای فعال در `MANUFACTURING_IMPLEMENTED_ROUTES`** | **۶۵** | **پوشش ۱۰۰٪ قرارداد `mfg-api-v1`** |

---

## ۳. پوشش آزمون‌ها و کنترل کیفیت کد

| مجموعهٔ آزمون / بررسی | دستور اجرا | نتیجه | جزئیات |
|---|---|---:|---|
| آزمون‌های REST API تولید | `node --test server/manufacturing.api.test.mjs` | **۲۹ / ۲۹ سبز** | پوشش کامل ۶۵ مسیر، RBAC، Plant-scope، UoW، `Planning`، `Rates`، رول‌آپ هزینه و بستن سفارش |
| آزمون‌های موتور زمان‌بندی | `node --test server/manufacturing.scheduler.test.mjs` | **۹ / ۹ سبز** | زمان‌بندی `forward/backward`، `finite/semi-finite`، `WSPT`، استراحت شیفت، توقف و `reschedule` |
| آزمون‌های آزادسازی تراکنشی | `node --test server/manufacturing.release.test.mjs` | **۴ / ۴ سبز** | آزادسازی اتمیک روی `JsonFileDriver`، تفکیک وظایف (SOD)، rollback در خطای میانی و چرخهٔ BOM |
| آزمون‌های اسکیما و مهاجرت تولید | `node --test server/manufacturing.schema.test.mjs` | **۷ / ۷ سبز** | ۲۶ جدول مستقل بدون FK بیرونی، ستون‌های ممیزی، مهاجرت‌های `0046` تا `0049` و تولید DDL |
| **جمع آزمون‌های تخصصی MFG** | ۴ فایل آزمون فوق | **۴۹ / ۴۹ سبز** | ۰ خطا، ۰ ردشده |
| کنترل تایپ TypeScript | `./node_modules/.bin/tsc --noEmit` | **سبز (Exit 0)** | بدون خطای تایپ در کل مخزن و کلاینت/UI جدید |
| بیلد نهایی فرانت‌اند | `npm run build` | **سبز (Exit 0)** | تولید باندل تک‌فایلی محصول (`dist/index.html`) |

---

## ۴. نتیجهٔ اجرای Seed روی دادهٔ خالی (`server/rundata`)

اجرای `rm -rf server/rundata && node server/seed.mjs` در برابر سرور زنده (`DATA_DIR=server/rundata PORT=4000 node server/index.js`):

- **خروجی کل:** `95 ساخته شد · 0 از قبل بود · 7 ناموفق`
- **تحلیل ۷ مورد ناموفق:** هر ۷ مورد مربوط به بخش قدیمی «پایه» (`Project p1`، سه `CostAccount` و سه `Activity`) هستند که به دلیل سیاست امنیتی `403 DATA_FORBIDDEN` روی CRUD عمومی جداول PMIS رد می‌شوند و **کاملاً بی‌ربط به سامانهٔ تولید (MES)** هستند.
- **وضعیت بخش تولید (`PLANT-DEMO`):** **۱۰۰٪ سبز (بدون حتی یک خطا)** شامل:
  - ساخت ۳ مرکز کاری (`WC-CNC`، `WC-ASM`، `WC-QC`) به‌همراه نرخ‌های ساعت‌کار (`Rates: machine/labor/overhead`)، منابع و ۱۸ ردیف تقویم شیفت هفتگی.
  - ساخت ۶ قطعه (`FG-GEARBOX-01`، `SA-HOUSING-01`، `RM-ST37-PLATE`، `RM-BEARING-6208`، `RM-BOLT-M12`، `RM-SEAL-NBR`) همراه با بلوک `Planning` و موجودی افتتاحیه.
  - ساخت و آزادسازی ۲ ساختار BOM (پوسته و گیربکس کامل) و ۱ مسیر ساخت (`RT-GEARBOX-01` شامل `OP-10`، `OP-20`، `OP-30`).
  - چرخهٔ کامل سفارش اول **`MO-DEMO-0001`** (۲۰ عدد گیربکس): ایجاد → آزادسازی → زمان‌بندی → اجرای کامل `OP-10`، `OP-20` و `OP-30` → اجرای MRP → ثبت مصرف واقعی هر ۵ جزء → تطبیق نهایی هزینه (`reconcile`) → **بستن نهایی سفارش (`Status = "closed"`, `ClosedBy = "u-mfg-manager"`)**.
  - چرخهٔ سفارش دوم **`MO-DEMO-0002`** (۴۰ عدد گیربکس در جریان): ایجاد → آزادسازی → زمان‌بندی → اجرای `OP-10` → ثبت توقف، ضایعات و دوباره‌کاری → اجرای MRP → شناسایی **۴ ردیف کمبود مواد** → صدور پیشنهاد تأمین (`POST /material-procurement-proposals`).

---

## ۵. شواهد رول‌آپ بهای تمام‌شده و دو گیت بستن سفارش

در دادهٔ بذرگذاری‌شدهٔ `PLANT-DEMO` برای سفارش بسته‌شدهٔ **`MO-DEMO-0001`**:

```json
{
  "OrderNo": "MO-DEMO-0001",
  "Status": "closed",
  "ClosedBy": "u-mfg-manager",
  "RowVersion": 4,
  "CostSummary": {
    "CostVersion": 1,
    "Currency": "IRR",
    "StandardMaterialCost": 628238808,
    "ActualMaterialCost": 628238808,
    "StandardMachineCost": 11875000,
    "ActualMachineCost": 12187500,
    "StandardLaborCost": 8387550,
    "ActualLaborCost": 8599950,
    "StandardOverheadCost": 4560000,
    "ActualOverheadCost": 4680000,
    "StandardTotalCost": 653061358,
    "ActualTotalCost": 653706258,
    "Variance": 644900,
    "Reconciled": true
  }
}
```

- برای هر عملیات (مانند `OP-10`)، چهار ردیف هزینه (`material`, `machine`, `labor`, `overhead`) با `SourceRef: "derived-from-actuals"` در تراکنش `POST /cost/orders/:orderId/reconcile` تولید و ذخیره شده‌اند:
  - عنصر `material`: مقدار استاندارد و واقعی `762.96`، مبلغ استاندارد و واقعی `628,238,808 IRR`.
  - عنصر `machine`: ساعت استاندارد `3.417` (`4,271,250 IRR`)، ساعت واقعی `3.5` (`4,375,000 IRR`) با نرخ `1,250,000 IRR/h`.
  - عنصر `labor`: ساعت استاندارد `3.417` (`3,075,300 IRR`)، ساعت واقعی `3.5` (`3,150,000 IRR`) با نرخ `900,000 IRR/h`.
  - عنصر `overhead`: ساعت استاندارد `3.417` (`1,640,160 IRR`)، ساعت واقعی `3.5` (`1,680,000 IRR`) با نرخ `480,000 IRR/h`.
- بستن سفارش در `POST /orders/:orderId/close` تنها پس از عبور از هر دو گیت الزامی (۱: تطبیق کامل نیازمندی‌ها و مصرف مواد بدون کسری باز؛ ۲: ثبت `MfgOrderCost.Reconciled = true`) انجام می‌شود.

---

## ۶. محدودیت‌های فعلی و کارهای آینده

1. **مدیریت مستقل مراکز هزینه (`MfgCostCenter`):** در نسخهٔ فعلی `mfg-api-v1`، ساخت نرخ‌های هزینه از طریق بلوک اختیاری `Rates` روی `POST /work-centers` انجام می‌شود و مسیر CRUD مستقل برای ویرایش یا غیرفعال‌سازی مستقیم `MfgCostCenter` در کاتالوگ ۶۵ مسیر تعریف نشده است.
2. **دامنهٔ نمایشی تک‌کارخانه (`PLANT-DEMO`):** کاربران نمایشی `u-mfg-*` به کارخانهٔ `PLANT-DEMO` تخصیص دارند؛ در محیط عملیاتی چندکارخانه‌ای، تخصیص `plantIds` باید از سرویس هویت مرکزی (IdP/SSO) خوانده شود.
3. **تبادل برون‌سیستمی (ERP/SCM/PM):** ارتباط با سامانه‌های تدارکات (تبدیل پیشنهاد تأمین به سفارش خرید قطعی PO) یا سامانه‌های بیرونی صرفاً از طریق REST API و کلیدهای نرم انجام می‌شود و نیازمند پیاده‌سازی Webhook/Outbox در لایهٔ یکپارچه‌سازی بیرونی در فازهای آتی است.
4. **آزمون یکپارچگی روی SQL Server واقعی:** در محیط سندباکس فعلی، اجرای زنده و تراکنش‌ها روی `JsonFileDriver` واقعی راستی‌آزمایی شده‌اند و اسکریپت کامل `database/manufacturing-schema.sql` (بدون هیچ وابستگی به جداول بیرونی) برای استقرار مستقیم روی SQL Server آماده است.
