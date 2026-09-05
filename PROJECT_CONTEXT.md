# Arena Platform — زمینهی پروژه (Project Context)

> این فایل زمینهی پروژهی «Arena Platform» را نگه می‌دارد تا مبنای ادامه‌ی کار در این نشست باشد. با اضافه‌شدن اطلاعات، به‌روز می‌شود.

## نمای کلی

**Arena Platform** یک سامانه‌ی جامع مدیریت، برنامه‌سازی و کنترل پروژه است که به‌طور تخصصی برای مدیریت پروژه‌های بزرگ‌مقیاس در صنایع **نفت، گاز، پتروشیمی و پروژه‌های عمرانی** توسعه یافته است. هدف: یکپارچه‌سازی فرآیندهای **مهندسی، کنترل پروژه، مدیریت ریسک و حاکمیت شرکتی** در سطح کارفرمایی.

## معماری فنی و فناوری‌ها

- **فرانت‌اند:** React + TypeScript بر بستر Vite (رابط کاربری واکنش‌گرا، سریع، ماژولار)
- **بک‌اند و سرویس‌ها:** سرور اختصاصی Node.js + مدیریت پایگاه‌های داده و ارتباطات سیستمی
- **زیرساخت و استقرار:** کانتینرسازی Docker (`Dockerfile`, `docker-compose.yml`) + وب‌سرور Nginx
- **تست و کیفیت:** Jest، Vitest، Playwright

## ماژول‌ها و فضاهای کاری (Workspaces)

| نام ماژول | حوزه تخصصی | عملکرد اصلی |
|---|---|---|
| Project Control & EVM | کنترل پروژه و ارزش حاصله | محاسبه شاخص‌های عملکردی، `EarnedValueCalculator`، گزارش پیشرفت روزانه `DailyReportWorkspace` |
| Engineering & Construction | مهندسی و ساخت | `EngConstruction`، پایگاه دانش پروژه `ProjectKnowledgePanel`، کارخانه اسناد `DocumentFactory` |
| Risk & Claims Hub | مدیریت ریسک و ادعا | ارزیابی ریسک، مدیریت ادعاها، `RiskClaimsWorkspace`، مرکز ادعاهای مهندسی-حقوقی `ForensicClaimsHub` |
| Cost & Procurement | مدیریت هزینه و تامین کالا | کنترل هزینه‌، تدارکات، زنجیره تامین، `CostProcurementWorkspace` |
| Governance & Admin | حاکمیت و مدیریت سیستم | کنترل دسترسی `AccessControlPanel`، تنظیمات `SystemSettings`، یکپارچه‌سازی داده `DataIntegrationWorkspace` |
| Portfolio & Analytics | پورتفولیو و گزارش‌گیری پیشرفته | داشبورد پورتفولیو `PortfolioPanel` / `PortfolioCharts`، گزارش تحلیلی `AnalyticsReporting` |

## ویژگی‌های برجسته

- پشتیبانی از **نقش‌های مدیریتی سطح بالا (بخش کارفرمایی)** با دیدگاه کلان و ابزارهای مانیتورینگ برای تصمیم‌گیری استراتژیک داده‌محور.
- مدیریت تخصصی **ادعاهای مهندسی-حقوقی (Forensic Claims)** برای تحلیل تاخیرات، مستندسازی دعاوی و مدیریت ریسک‌های قراردادی.
- **اتصال و همگام‌سازی داده:** `SqlConnectionPanel` برای اتصال پایگاه‌های داده و `MasterDataSyncPanel` برای همگام‌سازی داده‌های کلان سازمانی.

# ساختار پوشه‌ی `src` (از اسکرین‌شات ریشه)

**📁 پوشه‌ها:** `components` · `context` · `data` · `platform` · `services` · `utils`

**📄 فایل‌های TypeScript در ریشه‌ی `src`:**

| فایل | اندازه |
|---|---|
| `main.tsx` | 1 KB |
| `App.tsx` | 14 KB |
| `index.css` | 10 KB |
| `InnovativeWorkspace.tsx` | 21 KB |
| `ActionPlan.tsx` | 25 KB |
| `EngConstruction.tsx` | 25 KB |
| `DocumentFactory.tsx` | 30 KB |
| `AnalyticsReporting.tsx` | 31 KB |
| `ForensicClaimsHub.tsx` | 32 KB |
| `FinanceWorkspace.tsx` | 35 KB |
| `SystemSettings.tsx` | 36 KB |
| `Communications.tsx` | 37 KB |
| `ProjectControl.tsx` | 50 KB |

جمعاً ۱۹ آیتم (۶ پوشه + ۱۳ فایل).

# ساختار ریشه‌ی پروژه `Arena_Platform` (از اسکرین‌شات)

**فایل‌های پیکربندی و استقرار:** `.env` · `database.json` · `docker-compose.yml` · `Dockerfile` · `nginx.conf`

**فایل‌های پروژه و dependencies:** `index.html` · `package.json` · `package-lock.json` · `playwright.config.ts` · `tsconfig.json` · `vite.config.ts` · `node_modules/` · `.gitignore`

**پوشه‌های سورس و تست:** `src/` · `server/` · `tests/` · `test-results/` · `playwright-report/`

**پوشه‌های دیگر:** `continue/` · `فرم های ارشد خلیج فارس/` (پوشه‌ی فارسی) · `.github/` · `vscode/` · `env.development`

# ساختار پوشه‌ی `src/components` (از اسکرین‌شات — ۳۹ آیتم)

- `AccessControlPanel.tsx` (5 KB)
- `AdminWorkspace.tsx` (45 KB)
- `AlertCenter.tsx` (5 KB)
- `AlertsWorkspace.tsx` (8 KB)
- `AppInfoBoundary.tsx` (9 KB)
- `ArrayRenderer.tsx` (13 KB)
- `CalcPanel.tsx` (2 KB)
- `CalendarView.tsx` (24 KB)
- `CapabilityDetails.tsx` (49 KB)
- `ClusterCards.tsx` (14 KB)
- `ConfigCommunicationsWorkspace.tsx` (6 KB)
- `DailyReportWorkspace.tsx` (3 KB)
- `DataIntegrationWorkspace.tsx` (19 KB)
- `DeploymentDiagnostics.tsx` (6 KB)
- `DocumentWorkspace.tsx` (18 KB)
- `EarnedValueCalculator.tsx` (7 KB)
- `GovernanceWorkspace.tsx` (9 KB)
- `import pandas as pd.py` (2 KB)
- `LeftSidebar.tsx` (4 KB)
- `LoginScreen.tsx` (5 KB)
- `MasterDataSyncPanel.tsx` (8 KB)
- `ModelDetails.tsx` (6 KB)
- `MonitoringWorkspace.tsx` (16 KB)
- `NotificationPanel.tsx` (9 KB)
- `OperationsReadinessPanel.tsx` (10 KB)
- `PeriodicReportWorkspace.tsx` (9 KB)
- `PortfolioCharts.tsx` (6 KB)
- `PortfolioPanel.tsx` (11 KB)
- `ProductionDeploymentPanel.tsx` (9 KB)
- `ProjectKnowledgePanel.tsx` (29 KB)
- `ProjectControl.tsx` (2 KB)
- `RegionalCatalogPanel.tsx` (9 KB)
- `ReportViewRowPanel.tsx` (8 KB)
- `RightSidebar.tsx` (17 KB)
- `RiskClaimsWorkspace.tsx` (27 KB)
- `SecurityWorkspace.tsx` (5 KB)
- `SplitVideos.tsx` (4 KB)
- `SqlConnectionPanel.tsx` (22 KB)
- *(۱ آیتم دیگر در ادامه‌ی لیست)*

---
**وضعیت دریافت اطلاعات:** بخش ۱ مقدمه ثبت شد ✅ · ساختار `src` ثبت شد ✅ · ساختار ریشه‌ی پروژه ثبت شد ✅ · ساختار `components` ثبت شد ✅ · در انتظار دریافت محتوای فایل‌ها برای ادامه‌ی بدون تغییر.
