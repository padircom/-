# انتقال به چت جدید — Arena Platform
تاریخ به‌روزرسانی: 2026-09-08
دستور کاربر: از این پوشه ادامه بده. فایل‌های چت قبلی را دوباره لود نکن مگر فایل جدید بفرستد.
پاسخ‌ها: کوتاه فارسی. ظاهر/فونت Vazirmatn، `src/index.css` و سایدبار اصلی (domains) را تغییر نده.

## قانون UI
- سایدبار اصلی: ساختار domains دست‌نخورده برای آیتم جدید.
- زیرماژول‌های جدید فقط داخل صفحه حوزه (الگوی d1 DocumentWorkspace).
- Excel ظرف است نه SoT.
- `vite.config.ts` فقط `server.host: true` و `allowedHosts: true`.

## وضعیت ماژول‌ها

| دامنه | ماژول | اسناد | UI | موتور/تست |
|---|---|---|---|---|
| d1 | PIM/EDMS | D1–D9 + F2 + TEST_CASES + کیفیت | DocumentWorkspace | — |
| d2 | PEX برنامه‌ریزی و اجرا | D1–D12 + UIUX + RoC + کیفیت | PlanningWorkspace | pex/cpm |
| d3 | PMA/MON پایش | D1، D2 + کیفیت (D3–D14 نوشته نشده) | PmaWorkspace | projectControls |
| d4 | RCC ریسک/ادعا | DELIVERABLE_01–14 + کیفیت | RiskClaimsWorkspace | rccLogic + rcc.test |
| **d6** | **GOV حاکمیت — بسته شد ✅** | **D1–D10 + کیفیت + openapi/gov-v1.yaml** | **GovernanceWorkspace (۵ تب) + بلوک d6 در ModuleDetail** | **governance.ts / govLogic.js + gov.test.mjs (۱۲ تست)** |
| d5 | هزینه و تدارکات | ندارد | — | — |
| d7 | مدیریت سامانه | — | AdminWorkspace | — |

## GOV (d6) — جزئیات بستن
- اسناد: `docs/GOV_D1_Architecture.md` … `docs/GOV_D10_API_MVP.md` + `docs/GOV_FINAL_QUALITY_REPORT.md`
- قرارداد API: `docs/openapi/gov-v1.yaml`
- موتور: `src/services/governance.ts` (SLA/تشدید L0–L3، DoA، دروازه تصمیم، CAPA، سلامت کانکتور، زنجیره ممیزی)
- بک‌اند: `server/govLogic.js` + مسیرهای `/api/gov/*` در `server/index.js` (in-memory؛ SQL اختیاری)
- کلاینت: `src/services/govApiClient.ts` — مسیر نسبی `/api/gov`؛ اگر بک‌اند نبود UI روی داده نمونه می‌ماند (چیپ «داده زنده / داده نمونه»)
- تست: `npm test` → ۱۹/۱۹ سبز (۷ تست RCC + ۱۲ تست GOV)
- زمان‌بند اختیاری: `GOV_SLA_TICK_MS` (میلی‌ثانیه) برای پایش دوره‌ای SLA

### باقیمانده GOV (برآورد ~۱۲۸ نفر-ساعت، در گزارش کیفیت)
G1 اجرای Migration روی SQL Server · G2 جایگزینی in-memory با جداول `gov_*` · G4 گزارش‌های GOV-R01…R07 · G5 آشتی‌دهی سه‌طرفه d2/d3/d5 · G6 seed چک‌لیست استانداردها.

## PEX (d2) — تحویل‌شده در این نشست
- **کد:** `src/services/planning.ts` (موتور `pex-v1`: تقویم ایران، CPM چهار رابطه + Lag، Data Date و Progress Override، شناوری کل از LF−EF، ۹ قاعده CP، DCMA 14، ۷ قاعده مایلستون با جریمه/پاداش و تشدید، وزن‌دهی Cost/MH/Hybrid، RoC با گیت IR، Roll-up، Period Close).
- `src/data/pexProject.ts` (پروژه نمونه OG-2401 — ظرف داده) · `src/services/pexModel.ts` (ترکیب داده و موتور، Baseline از شبکه بدون تاریخ واقعی) · `src/services/pexApiClient.ts`.
- **UI:** `src/components/PlanningWorkspace.tsx` — ۱۴ تب، صفر عدد hard-code، نشانگر «داده زنده / محاسبه محلی».
- **API:** هفت روت `/api/pex/*` در `server/index.js` با `ownedFields=["progress","baseline"]`؛ POST پیشرفت با ۴۰۹ روی دوره بسته و `acceptedIntoEv=false` روی گام بدون IR.
- **تست:** `server/pex.test.mjs` (۲۶ تست) → مجموع `npm test` = ۸۸ سبز. اسکریپت‌ها: `build:pex`, `build:pexdata` (آینه esbuild؛ `server/pexLogic.js` و `server/pexModelBundle.js` تولیدی‌اند).
- **مستند:** `docs/PEX_D13_Implementation.md` (نگاشت طراحی→کد) و `docs/PEX_FINAL_QUALITY_REPORT_V2.md` (گزارش نهایی کیفیت ۷ بخشی؛ نسخه ۱ بایگانی شد).
- **شکاف‌های باز PEX:** G1 داده در فایل TS به‌جای SQL · G2 ثبت DPR ذخیره نمی‌شود · G3 خروجی Excel/Word/PDF · G4 RBAC · G5 Parser XER · G6 ابلاغ ایمیل/SMS · G7 OpenAPI · G8 منابع · G9 گانت تعاملی. (G1+G2 یک برش دوهفته‌ای مشترک.)

## اجرا
- مسیر پروژه: `/home/user/-`
- شاخه نشست: `arena/01a07ee6-repo` (روی GitHub؛ PR #1 در main مرج شد)
- فرانت: `npx vite --host 0.0.0.0` (پورت 5173)
- بک‌اند: `PORT=4000 node server/index.js` (پورت 4000؛ nginx مسیر `/api` را پراکسی می‌کند)
- `node_modules` در snapshot نیست → `npm ci`
- `.gitignore` اضافه شد: `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, `.env`

## نکات فنی باز
- `src/ForensicClaimsHub.tsx:1424` خطای نحوی از قبل دارد؛ هیچ‌جا import نشده (خارج از دامنه کار GOV).
- `jalaali-js` فقط CJS است؛ در `server/index.js` با interop امن import می‌شود.
- سازنده محصول در هدر App: محمدرضا هاشمی‌پور

## بعدی پیشنهادی
۱) فاز F5 پایداری داده PEX: جداول `pex_*` + ثبت واقعی DPR (G1+G2).
۲) یا اتصال GOV به SQL Server واقعی (G1+G2 حاکمیت).
۳) یا ماژول بعدی بدون سند.
