# PEX D13 — پیاده‌سازی موتور و ورک‌اسپیس (d2)

> این تحویلی، طراحی D1–D12 را به کد اجرایی تبدیل می‌کند. منبع یگانه محاسبات `src/services/planning.ts` است؛
> هر مصرف‌کننده (UI، API، تست) از همان منبع تغذیه می‌شود. `PEX_FORMULA_VERSION = "pex-v1"`.

## ۱. نگاشت طراحی به کد

| سند طراحی | پیاده‌سازی | آزمون |
|---|---|---|
| D4 زمان‌بندی/CPM | `computeCpm`, `topoSort`, `CpmCycleError`, تقویم `IRAN_CALENDAR` | ۶ تست CPM |
| D5 مایلستون | `milestoneStatus`, `milestonePenalty`, `escalationLevel`, `milestoneAlerts` (MS-R1..R7) | ۴ تست |
| D6 مسیر بحرانی | `cpSnapshot`, `cpAlerts` (CP-R1..R9), `dcma14` + HealthScore | ۳ تست |
| D10 PMS | `computeWeights` (Cost/MH/Hybrid/BOQ/Manual)، `validateRoc`, `activityProgress`, `rollUp`, `canPostProgress`, `plannedPercentAt`, `progressVariance`, `ppc` | ۷ تست |
| کتابخانه RoC ایران (`pex/data/roc_iran.json`) | `PEX_ROC` در `src/data/pexProject.ts` (۱۰ دستور فعال، مقیاس درصد) | تست جمع وزن = ۱۰۰ |
| D11 گزارش‌ها | تب‌های `reports`/`mpr`/`weekly` با ۱۰ گزارش استاندارد و انتخاب قالب داخلی/ابلاغی | — |
| D12 هشدار/API | روت‌های `/api/pex/*` در `server/index.js` + `src/services/pexApiClient.ts` | آزمون دستی curl |

## ۲. لایه‌ها

```
src/data/pexProject.ts     داده پروژه نمونه OG-2401 (ظرف؛ بدون فرمول)
        ↓
src/services/planning.ts   موتور خالص PEX (بدون وابستگی به React/داده)
        ↓
src/services/pexModel.ts   ترکیب داده + موتور → مدل آماده نمایش
        ↓        ↓
   UI (PlanningWorkspace)   server/pexModelBundle.js → /api/pex/*
```

خروجی esbuild: `npm run build:pex` (موتور) و `npm run build:pexdata` (مدل + داده). آینه‌های `server/*.js` تولیدی‌اند و دستی ویرایش نمی‌شوند.

## ۳. تصمیم‌های الگوریتمی

1. **تقویم ایران**: جمعه تعطیل، فهرست تعطیلات قابل تزریق؛ همه Lagها و Durationها روز کاری‌اند.
2. **Data Date**: هیچ کار ناتمامی پیش از Data Date برنامه‌ریزی نمی‌شود؛ تاریخ‌های دیر (LS/LF) نیز کف Data Date دارند.
3. **Progress Override**: فعالیتی که واقعاً شروع شده، قید شروع (FS/SS) پیش‌نیاز را نادیده می‌گیرد؛ قرینه همین قاعده در گذر رو به عقب اعمال می‌شود تا شناوری منفی کاذب تولید نشود.
4. **مدت مؤثر**: خاتمه‌یافته = طول واقعی · در جریان = `remainingDuration` (در مدل از `ceil(duration × (1 − Physical%))`) · شروع‌نشده = مدت برنامه‌ای.
5. **شناوری کل** از `LF − EF` گرفته می‌شود (نه `LS − ES`) تا برای کار در جریان با ES قفل‌شده در گذشته معتبر بماند. **شناوری آزاد** = فاصله روز کاری تا شروع نزدیک‌ترین جانشین.
6. **بحرانی** = `TF ≤ 0` و فعالیت خاتمه‌نیافته؛ یعنی مسیر بحرانی همیشه «مسیر باقی‌مانده» است.
7. **Baseline** با اجرای همان شبکه بدون تاریخ‌های واقعی ساخته می‌شود؛ رانش = طول CP جاری − طول CP پایه.
8. **گیت بازرسی**: گام دارای `ir: true` بدون `irApproved` صفر حساب می‌شود و در `blockedSteps` گزارش می‌گردد — فقط پیشرفت Approved وارد EV می‌شود.
9. **Period Close**: `canPostProgress` ثبت در دوره بسته یا خارج از بازه را رد می‌کند (API کد ۴۰۹).

## ۴. API

| متد | مسیر | خروجی |
|---|---|---|
| GET | `/api/pex/schedule?mode=&alpha=` | شبکه، تاریخ‌های پایه/جاری، شناوری، درصدها |
| GET | `/api/pex/critical-path` | CP، Near-Critical، Snapshot/Drift، DCMA 14 |
| GET | `/api/pex/milestones` | وضعیت، پیش‌بینی=EF، لغزش، جریمه، سطح تشدید |
| GET | `/api/pex/progress` | پیشرفت وزنی WBS، برنامه‌ای، انحراف، PPC، دوره باز |
| GET | `/api/pex/alerts` | هشدارهای CP-R* و MS-R* با شدت |
| GET | `/api/pex/roc` | کتابخانه RoC با اعتبارسنجی Σ=۱۰۰ |
| POST | `/api/pex/progress` | ثبت پیشرفت با قفل دوره و گیت IR |

پاسخ‌ها `meta.writesOwnedFigures = true` و `ownedFields = ["progress","baseline"]` دارند — منطبق بر `DATA_OWNER` در حاکمیت (PEX هزینه واقعی نمی‌نویسد).

## ۵. وضعیت پروژه نمونه (Data Date 2026-09-04)

| شاخص | مقدار |
|---|---|
| پیشرفت واقعی / برنامه‌ای | ۷۵.۳٪ / ۸۵.۳٪ → عقب ۱۰ واحد |
| مسیر بحرانی | PIP-ERC → PSU-FLS → PSU-RFSU |
| پایان پایه / جاری | 2026-12-07 / 2026-12-20 (رانش +۱۱ روز کاری) |
| HealthScore (DCMA) | ۷۱ |
| RFSU | AtRisk · جریمه برآوردی ۱۲۵٬۰۰۰ دلار |
| گام‌های مسدود بابت نبود IR | ۲ (PIP-ERC/ndt، INS-LOOP/calibration) |

## ۶. ۹ Loop خودارزیابی

| # | حلقه | بررسی | نتیجه |
|---|---|---|---|
| 1 | PMBOK | WBS→فعالیت→رابطه→CPM→Baseline→پیشرفت→گزارش کامل و ترتیب استاندارد | ✅ |
| 2 | Milestone | ۴ نوع مایلستون، ۵ وضعیت، ۷ قاعده، جریمه/پاداش، ۳ سطح تشدید، پیش‌بینی=EF | ✅ |
| 3 | Critical Path | CPM چهار رابطه + Lag، Near-Critical، Drift، DCMA 14، HealthScore | ✅ |
| 4 | Alerts | ۹ قاعده CP + ۷ قاعده MS با شدت warning/critical/emergency و ACK در UI | ✅ |
| 5 | PMS | ۵ حالت وزن‌دهی، Σ وزن=۱، RoC با Σ=۱۰۰، Roll-up دوسطحی، گیت IR، Period Close | ✅ |
| 6 | Reports | ۱۰ گزارش استاندارد + DPR/Weekly/MPR + انتخاب قالب و فرمت | 🟡 خروجی فایل واقعی تولید نمی‌شود (G3) |
| 7 | Consistency | یک موتور برای UI/API/تست؛ نسخه فرمول در پاسخ و هدر؛ آینه‌های esbuild | ✅ |
| 8 | Feasibility | ۸۸ تست سبز، tsc پاک، پاسخ API < ۵۰ms، بدون وابستگی جدید | ✅ |
| 9 | Security | PEX فقط ارقام تحت مالکیت خود را می‌نویسد؛ ثبت پیشرفت با گیت دوره؛ Baseline بدون CR تغییر نمی‌کند | 🟡 RBAC واقعی ندارد (G4) |

## ۷. Gap Analysis

| کد | شکاف | اثر | راه‌حل پیشنهادی | اولویت |
|---|---|---|---|---|
| G1 | داده پروژه در فایل TS است، نه SQL | مقیاس‌پذیری چندپروژه‌ای | جدول‌های `pex_activity/relation/milestone/progress` و جایگزینی لایه داده در `pexModel` | بالا |
| G2 | ثبت پیشرفت فقط اعتبارسنجی می‌شود و ذخیره نمی‌گردد | DPR پایدار نیست | جدول `pex_progress_line` + WF تأیید دو مرحله‌ای | بالا |
| G3 | خروجی Excel/Word/PDF گزارش‌ها تولید نمی‌شود | تحویل ابلاغی دستی است | استفاده از `xlsx` موجود و قالب A4 سه‌لوگو در سرور | متوسط |
| G4 | نقش‌ها و مجوزها اعمال نمی‌شود | هر کاربر می‌تواند POST بزند | اتصال به RBAC مشترک با QMS/GOV | متوسط |
| G5 | ورود XER/Excel هنوز پیاده نشده | برنامه از P6 دستی وارد می‌شود | Parser XER → همان مدل `Activity/Relation` (Excel فقط ظرف) | متوسط |
| G6 | تحلیل منابع و هموارسازی نداریم | DCMA #9 تخمینی است | افزودن `resourceIds` واقعی و بار منابع | پایین |
| G7 | نمودار گانت تعاملی نیست (Zoom/Drag) | کاربرد اپراتوری محدود | کامپوننت گانت اختصاصی با مقیاس زمانی | پایین |
