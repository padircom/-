# بخش ۳ — سامانهٔ مدیریت نگهداری و تعمیرات و دارایی‌ها (CMMS / EAM / APM)

**نقشهٔ راه اجرایی و ثبت وضعیت پیاده‌سازی**
تاریخ تنظیم: ۲۰۲۶-۱۰-۰۹ · مخزن: `padircom/-` · شاخه: `arena/bbd1daab-repo`
مبنای سبز پیش از شروع: `npm test` → **۴۶۵۶ تست، ۰ خطا**
وضعیت کنونی: `npm test` → **۴۸۱۱ تست، ۰ خطا** (۱۵۵ تست اختصاصی CMMS؛ `tsc --noEmit` پاک)

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

**باقی‌مانده:** `hold / resume` روی دستورکار (ماشین وضعیت دامنه آن را می‌شناسد اما مسیر
REST ندارد)، کارتابل کاربر (Workbench) و لایهٔ PWA/موبایل اپراتور، و اتصال واقعی
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

**باقی‌مانده:** RCFA تعاملی به‌عنوان ماژول مستقل (5-Why / Fishbone با اتصال به اقدام
اصلاحی) مسیر REST اختصاصی ندارد؛ امروز از طریق `POST /ai/failure-analysis` پوشش
داده می‌شود. تولید خودکار `CmmsMaintenancePlan` از خروجی RCM هم دستی است.

### فاز ۴ — یکپارچگی بین‌بخشی (⏳ انجام نشد — عمداً)
- CMMS ↔ MES: تبادل پنجرهٔ PM با تقویم تولید و توقف ماشین
- CMMS ↔ SCM: تأمین قطعات یدکی (درخواست خرید از کسری انبار)
- CMMS ↔ IIoT: خوراک دادهٔ CBM از سنسورها و تولید آلارم بلادرنگ
- CMMS ↔ Finance: انتقال هزینهٔ نت به مراکز هزینه

**وضعیت:** عمداً پیاده‌سازی نشد. الزام «استقلال منطقی دیتابیس» با یکپارچگی فیزیکی
در تضاد است؛ امروز فقط **ارجاع نرم** داریم: `CmmsAsset.MfgWorkCenterId`،
`CmmsAsset.ScmWarehouseId`، `CmmsSparePart.ScmWarehouseId` و
`CmmsWorkOrderCost.CostCenterRef` — همگی `text` بدون FK.


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
| `src/services/cmmsApi.ts` | **جدید** — کلاینت `CmmsClient` (۷۰ متد روی ۱۰۵ مسیر)، `CmmsRequestError`، کاربران نمونه و پیش‌نمایش RBAC سمت کلاینت |
| `src/components/CmmsWorkspaceShell.tsx` | تبدیل پوستهٔ خالی به فضای کاری متصل به API (۹ زیرماژول) |
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
| `server/cmms.rest.test.mjs` | ۴۸ تست: ۱۰۵ مسیر REST، RBAC (۴۰۱/۴۰۳)، اعتبارسنجی (۴۰۰)، تکراری (۴۰۹)، قواعد تجاری (۴۲۲) |

---

## ۷. ریسک پذیرفته‌شده و صریح

**تنها خطوط تست موجود که تغییر کرد** دو شمارندهٔ ثبتی است، نه رفتار:

1. `assert.equal(ROLE_CATALOG.length, 28)` در `server/ai.assistant.test.mjs` → ۳۵.
2. `assert.equal(PERMISSION_CATALOG.length, 296)` در `server/rbac.test.mjs` → ۳۷۲.

هر دو با افزودن ۷ نقش نگهداری و ۷۶ مجوز `cmms.*` تغییر می‌کنند؛ دقیقاً همان کاری که
خودِ MES در زمان افزودن ۷ نقش تولیدی کرد. گزینهٔ دیگر (دادن `cmms.*` به نقش‌های
tولیدی) تفکیک وظایف نت را از بین می‌برد و عمداً رد شد.

**نکتهٔ فرآیندی:** زنجیرهٔ `npm test` در این مخزن `tsc` را اجرا **نمی‌کند**. هر تغییر در
`src/**/*.ts` باید جداگانه با `npx tsc --noEmit -p tsconfig.json` و `npm run build`
آزموده شود؛ چون `noUnusedLocals` روشن است، تابع بی‌استفاده خطای سخت است.
