# انتقال به چت جدید — Arena Platform
تاریخ: 2026-09-04
دستور کاربر: از این پوشه ادامه بده. فایل‌های چت قبلی را دوباره لود نکن مگر فایل جدید بفرستد.
پاسخ‌ها: کوتاه فارسی. ظاهر/فونت Vazirmatn و سایدبار اصلی را تغییر نده.

## قانون UI
- سایدبار اصلی: ساختار domains دست‌نخورده برای آیتم جدید.
- زیرماژول‌های جدید فقط صفحه حوزه (الگوی d1 DocumentWorkspace).
- Excel ظرف است نه SoT.

## PIM/EDMS (d1) — تمام شده
- UI صفحه d1 بازطراحی شده (DocumentWorkspace + زیرماژول داخلی).
- docs/PIM_DMS_D1 … D9 + FINAL_QUALITY_REPORT + F2 stories + TEST_CASES
- OpenAPI: docs/openapi/pim-edms-v1.yaml
- Postgres migrations: db/postgres/V001–V013 (محصول Arena همچنان SQL Server)

## PEX برنامه‌ریزی و اجرا (d2) — در جریان طراحی
تأییدشده بدون بازخورد: D1 تا D10
- docs/PEX_D1_Architecture.md
- docs/PEX_D2_DataModel.md
- docs/PEX_D3_Scope_WBS_AI.md
- docs/PEX_D4_Schedule_CPM.md
- docs/PEX_D5_Milestone.md
- docs/PEX_D6_CriticalPath.md
- docs/PEX_D7_Cost_EVM.md
- docs/PEX_D8_Resources.md
- docs/PEX_D9_SiteOps.md
- docs/PEX_D10_PMS.md
**بعدی: Deliverable 11 Reporting & Templates** (سپس D12 Alert/API/MVP)
پرامپت اصلی کاربر: uploads بود 1.txt ؛ ادامه با قالب 2.txt حالت الف.

ایراد d2 در UI: صفحه حوزه خالی است؛ ProjectControl/ActionPlan به App وصل نیست — بازطراحی بعد از اتمام اسناد یا وقتی کاربر بگوید پیاده کن.

## اجرا
- مسیر پروژه: /home/user/arena-platform
- Vite: npx vite --host 0.0.0.0 (allowedHosts در vite.config)
- node_modules در snapshot نیست → npm ci

## سایر
- BASELINE.md نسخه قدیمی‌تر PIM؛ این فایل جدیدتر است.
- سازنده محصول در هدر App: محمدرضا هاشمی‌پور
