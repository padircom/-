# Arena Platform — مبنا (آخرین نسخه تأییدشده)
تاریخ: 2026-09-03
وضعیت: کاربر تأیید کرد برنامه باز شد. ظاهر/فونت دست‌نخورده.

## قانون ادامه
- کار را از **همین پوشه** `/home/user/arena-platform` ادامه بده.
- فایل‌های قبلی چت / uploads را دوباره بارگذاری نکن مگر کاربر فایل جدید بفرستد.
- ظاهر، فونت Vazirmatn، و `src/index.css` را تغییر نده.

## تنها تغییر نسبت به سورس اصلی
- `vite.config.ts`: فقط `server.host` و `server.allowedHosts: true` برای پیش‌نمایش Arena.

## ریشه
- package.json, package-lock.json, index.html, tsconfig.json, vite.config.ts
- nginx.conf, Dockerfile, docker-compose.yml, playwright.config.ts, .gitignore
- dist/index.html (بیلد single-file، ظاهر همان)

## src
- main.tsx, App.tsx, index.css
- ActionPlan.tsx, AnalyticsReporting.tsx, Communications.tsx, DocumentFactory.tsx
- EngConstruction.tsx, FinanceWorkspace.tsx, ForensicClaimsHub.tsx
- ProjectControl.tsx, SystemSettings.tsx
- **نداریم:** InnovativeWorkspace.tsx (کاربر ندارد)

## src/context
- AuthContext.tsx, SystemContext.tsx

## src/data
- framework.ts (کاربر data دیگری ندارد)

## src/utils
- debounce.ts

## src/services
- pmisApiClient.ts, pmisContract.ts, pmisSchema.ts, sqlServer.ts
- security.ts, syncQueue.ts, auditLogger.ts

## src/components (منتقل‌شده)
AccessControlPanel, AdminWorkspace, AlertCenter, AlertsWorkspace, AppErrorBoundary,
AuthStatus, CalcPanel, CalendarView, CapabilityDetail, ClusterCards,
DailyReportWorkspace, DeploymentDiagnostics, DocumentWorkspace, EarnedValueCalculator,
GovernanceWorkspace, LeftSidebar, LoginScreen, MasterDataSyncPanel, ModuleDetail,
MonitoringWorkspace, NotificationOpsPanel, OperationsReadinessPanel,
PeriodicReportWorkspace, PmbokRing, PortfolioCharts, PortfolioPanel,
ProductionDeploymentPanel, ProjectKnowledgePanel, ProjectScopeBar, RegularCalculator,
ReportWorkflowPanel, RightSidebar, RiskClaimsWorkspace, SecurityWorkspace,
SqlConnectionPanel

## components که کاربر ندارد (رد شد)
ArrayRenderer, ConfigCommunicationsWorkspace, ModelDetails, NotificationPanel,
RegionalCatalogPanel, ReportViewRowPanel, SplitVideos

## server
- Dockerfile, index.js, package.json, .env
  PORT=5000, DB_SERVER=localhost\SQL2008EXPRESS, DB_NAME=PMO_Dashboard_DB
  DB_USER و DB_PASSWORD خالی

## اجرا
- `npm ci` انجام شده
- `npx vite --host 0.0.0.0` پورت 5173
- تب جدید e2b: Missing Traffic Access Token (محدودیت پلتفرم)
- فایل مستقل تمام‌صفحه: dist/index.html

## زبان
پاسخ کوتاه فارسی. بدون به‌هم‌ریختگی ظاهر.
