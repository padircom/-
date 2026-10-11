# بخش ۳ — سامانهٔ مدیریت نگهداری و تعمیرات و دارایی‌ها (CMMS / EAM / APM)

**نقشهٔ راه اجرایی و ثبت وضعیت پیاده‌سازی**
تاریخ تنظیم: ۲۰۲۶-۱۰-۰۹ · آخرین به‌روزرسانی: ۲۰۲۶-۱۰-۱۱ · مخزن: `padircom/-` · شاخه: `arena/3967ddf6-repo`
مبنای سبز پیش از شروع: `npm test` → **۴۶۵۶ تست، ۰ خطا**
وضعیت کنونی: `npm test` → **۴۸۴۵ تست، ۰ خطا** (۱۷۸ تست CMMS + ۱۱ تست پل CMMS↔MES؛ `tsc --noEmit` پاک)
**سه قلم باقی‌ماندهٔ فاز ۲/۳/۴ در ۲۰۲۶-۱۰-۱۱ تکمیل شد** — بخش ۸.

---

## ۱. اصول معماری (غیرقابل مذاکره)

| # | اصل | نحوهٔ اجرا در کد |
|---|-----|------------------|
| ۱ | استقلال منطقی دیتابیس | همهٔ جداول با پیشوند `Cmms` و `module: "cmms"`؛ `foreignKeys` فقط به `Cmms*`. تست `cmms.schema.test.mjs` این را **اجبار** می‌کند. |
| ۲ | افزودنی بودن، بدون تغییر شکننده | هیچ جدول/ستون موجودی تغییر نمی‌کند. تنها مهاجرت `0057` اضافه می‌شود. |
| ۳ | لایه‌بندی | منطق خالص در `src/services/cmmsDomain.ts` و `src/services/cmmsAi.ts` (بدون I/O) → با esbuild به `server/cmmsLogic.js` / `server/cmmsAiLogic.js` → لایهٔ HTTP در `server/cmmsApi.js`. همان الگوی MES (`manufacturingPlanning.ts` → `mfgPlanLogic.js` → `manufacturingApi.js`). |
| ۴ | RBAC بر پایهٔ `cmms.*` | مجوزها در `PERMISSION_CATALOG` با `module: "cmms"`، دامنه‌بندی با `plantIds` (مثل `mfg`)، نه `projectIds`. |
| ۵ | حسابرسی | هر جدول ستون‌های `AUDIT_COLUMNS` + `RowVersion` را خودکار می‌گیرد؛ هر فرمان REST رکورد ممیزی می‌نویسد. |
| ۶ | قابلیت تست | منطق دامنه تابع خالص است؛ REST با مخزن و Express ساختگی آزموده می‌شود (بدون دیتابیس واقعی). |

### الگوی مرجع
ماژول MES (بخش ۲) که ۱۰۰٪ کامل است:
`src/services/manufacturingSchema.ts` + `manufacturingPlanning.ts` + `server/manufacturingApi.js`.
CMMS همان سه‌لایه را بازتولید می‌کند تا نگهداری دو ماژول یک‌شکل بماند.

---

## ۲. فازبندی اجرایی

### فاز ۱ — هستهٔ دامنه و خانوادهٔ تجهیز (✅ انجام شد در این نشست)
**هدف:** اسکیمای مستقل + موتورهای استانداردها + RBAC + REST برای منابع پایه + اتصال فرانت‌اند.

- اسکیمای `CMMS_TABLES` (۶۵ جدول) با پوشش ساختار ۱۳گانهٔ PMworks
- مهاجرت `0057 — cmms_asset_maintenance_foundation`
- موتورهای استاندارد: ISO 14224 (تاکسونومی و کدینگ)، IEC 60812 (FMEA/RPN/Criticality)، IEC 60300-3-11 (درخت تصمیم RCM)، ISO 17359 (CBM و منطقه‌بندی)، IEEE 1366 (SAIDI/SAIFI/CAIDI/ASAI/MAIFI)، OEE v2 (شش اتلاف بزرگ + TEEP)، قابلیت اطمینان (MTBF/MTTF/MTTR/λ/R(t)/Availability)، IEC 60300-3-3 (LCC با NPV)، EN 15341 (مدل KPI)
- گردش‌کار قابل پیکربندی (Workflow Engine) با ماشین وضعیت
- پنج ماژول AI به‌صورت موتور قطعی و قابل‌توضیح (نه فراخوانی LLM)
- **۷۶** مجوز `cmms.*` + ۷ نقش نگهداری (کل کاتالوگ ۳۷۲ مجوز / ۳۵ نقش)
- REST زیر `/api/cmms/sites/:siteId/...` با **۱۰۵ مسیر** (۴۴ × 201 و ۶۰ × 200)
- ارتقای `CmmsWorkspaceShell.tsx` از پوستهٔ خالی به فضای کاری متصل

### فاز ۲ — اجرای عملیاتی کامل دستورکار (✅ بخش اصلی انجام شد)
- بستن چرخهٔ کامل Work Request → Work Order → Task → Labor → Material → Cost → Close
- صدور قطعات از انبار نت و کسری/رزرو
- کارتابل کاربر (Workbench) با صف‌های کاری و SLA
- PWA/وب‌موبایل اپراتور + اسکن بارکد/QR به‌عنوان ورودی واقعی
**انجام شد:** `release / start / complete / close`، منابع `labor / materials / costs`،
`work-requests` با `review`، `technicians` با `skills`، `vendors`، `locations` + `tree`،
`condition-readings` و `condition-thresholds`، `alerts` با `acknowledge / resolve`،
و `POST /assets/:assetId/barcodes`.

**انجام شد (۲۰۲۶-۱۰-۱۱):** `hold / resume` روی دستورکار — مسیرهای
`POST /work-orders/:id/hold`، `POST /work-orders/:id/resume` و `GET /work-orders/:id/holds`
با کاتالوگ بستهٔ علل، ردیف توقف باز، بازگشت به وضعیت پیش از توقف و انتشار رویداد برای MES.

**باقی‌مانده:** کارتابل کاربر (Workbench) و لایهٔ PWA/موبایل اپراتور، و اتصال واقعی
اسکنر بارکد به‌عنوان ورودی (الان فقط ثبت بارکد روی تجهیز وجود دارد).

**خروجی:** `POST /work-orders/:id/{release,start,complete,close}` و REST منابع کار

### فاز ۳ — قابلیت اطمینان پیشرفته و APM (🔶 بخشی انجام شد)
- اجرای کامل RCM روی خانواده و تولید خودکار `CmmsMaintenancePlan`
- تحلیل RCFA تعاملی (5-Why + Fishbone) با اتصال به اقدام اصلاحی
- Weibull/Bath-curve و بهینه‌سازی فاصلهٔ PM با دادهٔ واقعی خرابی
- استراتژی Zero Breakdown و نقشهٔ بحرانی‌بودن (Criticality Matrix)

**انجام شد:** `POST /rcm` و `POST /rcm/:rcmId/entries` (منطق هفت‌گامی IEC 60300-3-11)،
`optimizePmInterval` و برآورد Weibull در `POST /ai/pm-optimization`، و
`computeAssetCriticality` با وزن‌های .35/.30/.15/.15/.05.

**انجام شد (۲۰۲۶-۱۰-۱۱):** RCFA تعاملی — `GET /rca-cases`، `GET /rca-cases/:id`
(زنجیرهٔ ۵ چرا + استخوان‌ماهی ۶M + پارتو وزنی + ارزیابی آمادگی)، `POST /rca-cases/:id/causes`،
چرخهٔ کامل CAPA (`capas`، `implement`، `verify`، `refer` به مالک یا تبدیل به دستورکار، `close`).
جدول‌های `CmmsRcfaCause` و `CmmsRcfaCapa` در مهاجرت `0058` افزوده شدند.

**باقی‌مانده:** تولید خودکار `CmmsMaintenancePlan` از خروجی RCM هنوز دستی است.

### فاز ۴ — یکپارچگی بین‌بخشی (⏳ انجام نشد — عمداً)
- CMMS ↔ MES: تبادل پنجرهٔ PM با تقویم تولید و توقف ماشین
- CMMS ↔ SCM: تأمین قطعات یدکی (درخواست خرید از کسری انبار)
- CMMS ↔ IIoT: خوراک دادهٔ CBM از سنسورها و تولید آلارم بلادرنگ
- CMMS ↔ Finance: انتقال هزینهٔ نت به مراکز هزینه

**انجام شد (۲۰۲۶-۱۰-۱۱) — CMMS ↔ MES:** با حفظ کامل استقلال دیتابیس، فقط رویدادمحور:
- **صف خروجی رویداد** (`CmmsIntegrationEvent`): توقف دستورکار و رزرو/آزادسازی ظرفیت به‌صورت
  رویدادهای قرارداد `cmms-mes-v1` ثبت می‌شوند؛ هر رویداد `IdempotencyKey` دارد و
  `POST /integration/events/:id/dispatch` تحویل را با تلاش و خطای دسته‌بندی‌شده ثبت می‌کند.
- **بلوکهٔ نرم ظرفیت** (`CmmsCapacityBlock`): هنگام آزادسازی دستورکار دارای پنجرهٔ زمانی و
  ارجاع نرم به مرکز کاری، ظرفیت MES رزرو می‌شود و با اتمام/لغو آزاد می‌گردد.
- **پل سمت مقصد** (`server/cmmsMesBridge.js`): رویدادها را روی ردیف‌های خودِ MES اعمال
  می‌کند — توقف‌ها در `MfgDowntimeLog` (ناخواسته/برنامه‌ریزی‌شده، مبنای OEE Availability)
  و رزرو PM به‌صورت توقف برنامه‌ریزی‌شده‌ای که موتور زمان‌بندی از ظرفیت کم می‌کند.
- در استقرار تک‌فرآیندی، `server/index.js` پل را به‌صورت درون‌فرآیندی تزریق می‌کند و
  `POST /api/mfg/integration/cmms/events` مسیر REST همان قرارداد برای استقرار جداست.

**باقی‌مانده در فاز ۴:** CMMS ↔ SCM (تأمین قطعات)، CMMS ↔ IIoT و CMMS ↔ Finance.
ارجاع‌های نرم همچنان بدون FK هستند: `CmmsAsset.MfgWorkCenterId`،
`CmmsAsset.ScmWarehouseId`، `CmmsSparePart.ScmWarehouseId` و
`CmmsWorkOrderCost.CostCenterRef`.


### فاز ۵ — هوش و بهینه‌سازی (✅ موتورهای AI انجام شد؛ گزارش‌ساز باقی است)
- آموزش مدل‌ها روی تاریخچهٔ واقعی (جایگزینی پیش‌فرض‌های قطعی با برآورد آماری)
- AI Smart Scheduler با بهینه‌سازی ترکیبی واقعی (ظرفیت × بار خط × اولویت)
- داشبورد مدیریتی گرافیکی کامل و گزارش‌ساز اختصاصی نت

**انجام شد:** هر پنج موتور به‌صورت مسیر REST — `failure-analysis`، `pm-optimization`،
`repair-guidance`، `tree-generator`، `smart-scheduler` — به‌همراه `GET /ai/recommendations`
و `POST /ai/recommendations/:id/decide` با تفکیک `cmms.ai.view / run / apply`.
`GET /dashboard` و `kpi-targets / kpi-results` نیز فعال‌اند.

**باقی‌مانده:** موتورهای AI قطعی و قابل‌توضیح‌اند و روی دادهٔ واقعی **آموزش نمی‌بینند**؛
برآورد آماری Weibull تنها جایی است که از تاریخچه استفاده می‌شود. گزارش‌ساز اختصاصی نت
و نمودارهای گرافیکی کامل داشبورد نیز هنوز در محدودهٔ کار است.

---

## ۳. نگاشت ۱۴ استاندارد به کد

| استاندارد | پیاده‌سازی |
|-----------|------------|
| ISO 55000/55001/55002 | `CmmsAsset` (دارایی‌محوری)، `CmmsAssetLifecycleEvent`، `CmmsKpiTarget/Result`، خط‌مشی در `CmmsSite` |
| ISO 14224 | `ISO14224_*` در `cmmsDomain.ts`؛ `CmmsFailureMode`، `CmmsFailureRecord`، `classifyIso14224()` |
| BS EN 15341 | `CmmsKpiTarget`/`CmmsKpiResult` با دسته‌بندی Technical/Economic/Organizational |
| EN 13306 | واژگان دامنه در `CMMS_VOCABULARY` و نام‌گذاری موجودیت‌ها |
| IEC 60812 | `computeRiskPriorityNumber()`, `computeCriticality()`, `CmmsFmea*` |
| ISO 17359 | `evaluateCondition()`, `vibrationZoneIso10816()`, `CmmsCondition*` |
| IEEE 1366 | `computeSupplyReliability()` → SAIDI/SAIFI/CAIDI/ASAI/MAIFI |
| OEE v2 | `computeOee()` → شش اتلاف بزرگ + TEEP |
| IEC 60300-1 / 3-11 | `decideRcmTask()` (منطق هفت‌گامی)، `CmmsRcmAnalysis`، `CmmsMaintenancePlan` |
| IEC 60300-3-3 | `computeLifeCycleCost()` (NPV تفکیکی)، `CmmsLccRecord` |
| PMO Study | `optimizePmInterval()` (کمینه‌سازی نرخ هزینه) |
| ISO 14224 (کدینگ مرز) | `buildAssetBoundaryPath()` |
| RCM / Zero Breakdown | `CmmsPmStrategy.StrategyType` شامل `run-to-failure` |
| KPI پایش | `CmmsReliabilitySnapshot` |

---

## ۴. ساختار ۱۳گانهٔ خانوادهٔ تجهیز (PMworks) → موجودیت

| # | بخش | جدول |
|---|------|------|
| ۱ | مدیریت گروه خانواده | `CmmsFamilyGroup` |
| ۲ | الگوی خانواده | `CmmsFamily` |
| ۳ | ساختار درختی خانواده | `CmmsFamilyNode` |
| ۴ | پروفایل جامع خانواده | `CmmsFamilyProfile` |
| ۵ | پارامترهای کارکردی | `CmmsFamilyOperatingParam` |
| ۶ | پارامترهای CM | `CmmsFamilyConditionParam` |
| ۷ | حالات خرابی استاندارد | `CmmsFamilyFailureMode` |
| ۸ | آرشیو فنی خانواده | `CmmsFamilyDocument` |
| ۹ | فعالیت‌های نگهداشت و چک‌لیست PM | `CmmsFamilyPmTask` + `CmmsPmChecklistItem` |
| ۱۰ | فهرست تجهیزات فیزیکی | `CmmsAssetFamilyAssignment` |
| ۱۱ | آرشیو فنی اختصاصی تجهیز | `CmmsAssetDocument` |
| ۱۲ | داده‌های ویژه و پویا | `CmmsFamilyCustomField` + `CmmsAssetCustomValue` |
| ۱۳ | مدیریت کلان و تغییرات همگانی | `CmmsFamilyBulkChange` |

---

## ۵. تغییرات روی فایل‌های موجود (صرفاً افزودنی)

| فایل | تغییر |
|------|-------|
| `src/services/persistence.ts` | import `CMMS_TABLES`، الحاق به `SCHEMA`، افزودن مهاجرت `0057` |
| `src/services/accessControl.ts` | افزودن ۴۸ مجوز `cmms.*` و ۷ نقش نگهداری |
| `src/services/cmmsApi.ts` | **جدید** — کلاینت `CmmsClient` (۷۳ متد روی ۱۲۱ مسیر)، `CmmsRequestError`، کاربران نمونه و پیش‌نمایش RBAC سمت کلاینت |
| `src/components/CmmsWorkspaceShell.tsx` | فضای کاری متصل به API (۱۱ زیرماژول؛ توقف/ادامه در تب دستورکار) |
| `src/components/CmmsRcfaPanel.tsx` | **جدید** — پنل تعاملی ۵ چرا/استخوان‌ماهی/پارتو و چرخهٔ CAPA |
| `src/components/CmmsIntegrationPanel.tsx` | **جدید** — صف رویداد و بلوکهٔ نرم ظرفیت |
| `server/cmmsMesBridge.js` | **جدید** — پل CMMS→MES (سمت مقصد، بدون FK) + مسیرهای `/api/mfg/integration/cmms/*` |
| `src/components/RightSidebar.tsx` | بازتعریف آیتم‌های سایدبار CMMS هم‌راستا با زیرماژول‌های جدید |
| `src/App.tsx` | فقط انتقال `activeSub` (امضا بدون تغییر) |
| `package.json` | افزودن `build:cmms`, `build:cmmsai` و الحاق به زنجیرهٔ `test` |
| `server/index.js` | ثبت `registerCmmsRoutes` |
| `server/ai.assistant.test.mjs` | به‌روزرسانی شمار نقش‌ها ۲۸ ← ۳۵ (شمارندهٔ ثبتی — دلیل در بخش ۷) |
| `server/rbac.test.mjs` | به‌روزرسانی شمار مجوزها ۲۹۶ ← ۳۷۲ (شمارندهٔ ثبتی — دلیل در بخش ۷) |
| `.gitignore` | افزودن `server/cmmsLogic.js` و `server/cmmsAiLogic.js` طبق قرارداد باندل‌های esbuild |

---

## ۶. تست‌ها

| فایل | پوشش |
|------|------|
| `server/cmms.schema.test.mjs` | شمار جدول‌ها، استقلال FK، ستون‌های حسابرسی، مهاجرت ۰۰۵۷ |
| `server/cmms.domain.test.mjs` | ISO 14224، FMEA/RPN، RCM، CBM، IEEE 1366، OEE، قابلیت اطمینان، LCC، PM، گردش‌کار |
| `server/cmms.ai.test.mjs` | هر ۵ ماژول AI + قطعیت و توضیح‌پذیری |
| `server/cmms.rest.test.mjs` | ۶۸ تست: ۱۲۱ مسیر REST، RBAC (۴۰۱/۴۰۳)، اعتبارسنجی (۴۰۰)، تکراری (۴۰۹)، قواعد تجاری (۴۲۲)، توقف/ادامه، RCFA/CAPA و یکپارچگی |
| `server/cmms.mesBridge.test.mjs` | **جدید** — ۱۱ تست: اِعمال قرارداد `cmms-mes-v1`، تکرارناپذیری، ترجمهٔ بلوکه به توقف برنامه‌ریزی‌شده، RBAC سمت MES |

---

## ۷. تکمیل سه قلم باقی‌مانده (۲۰۲۶-۱۰-۱۱)

| قلم | خروجی |
|-----|-------|
| توقف/ادامهٔ دستورکار | ۳ مسیر REST + `cmms.wo.hold` / `cmms.wo.resume` (سطوح داخلی، حسابرسی‌شده) + ردیف `CmmsWorkOrderHold` + رویداد توقف |
| RCFA تعاملی و CAPA | ۸ مسیر REST + `CmmsRcfaCause` / `CmmsRcfaCapa` در مهاجرت `0058` + پنل تعاملی در فضای کاری |
| یکپارچگی CMMS ↔ MES | `CmmsIntegrationEvent` + `CmmsCapacityBlock` + پل سمت MES + مسیرهای `/api/mfg/integration/cmms/*` — بدون هیچ کلید خارجی تازه |

شمارنده‌های به‌روزشده: مجوزها ۳۷۲ → **۳۸۰** (۸ مجوز تازهٔ `cmms.wo.hold/resume`,
`cmms.capa.*`, `cmms.integration.*`, `cmms.capacity.*`)، جدول‌ها ۶۵ → **۷۰**،
مسیرها ۱۰۵ → **۱۲۱**، تست‌ها ۴۸۱۱ → **۴۸۴۵** (همه سبز).

## ۸. ریسک پذیرفته‌شده و صریح

**تنها خطوط تست موجود که تغییر کرد** دو شمارندهٔ ثبتی است، نه رفتار:

1. `assert.equal(ROLE_CATALOG.length, 28)` در `server/ai.assistant.test.mjs` → ۳۵.
2. `assert.equal(PERMISSION_CATALOG.length, 296)` در `server/rbac.test.mjs` → ۳۷۲.

هر دو با افزودن ۷ نقش نگهداری و ۷۶ مجوز `cmms.*` تغییر می‌کنند؛ دقیقاً همان کاری که
خودِ MES در زمان افزودن ۷ نقش تولیدی کرد. گزینهٔ دیگر (دادن `cmms.*` به نقش‌های
tولیدی) تفکیک وظایف نت را از بین می‌برد و عمداً رد شد.

**نکتهٔ فرآیندی:** زنجیرهٔ `npm test` در این مخزن `tsc` را اجرا **نمی‌کند**. هر تغییر در
`src/**/*.ts` باید جداگانه با `npx tsc --noEmit -p tsconfig.json` و `npm run build`
آزموده شود؛ چون `noUnusedLocals` روشن است، تابع بی‌استفاده خطای سخت است.
