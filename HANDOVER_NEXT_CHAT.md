# انتقال به چت جدید — Arena Platform
تاریخ به‌روزرسانی: 2026-09-27 — **گزارش مرجع جاری: `docs/GAP_ROADMAP.md`؛ بخش‌های پایین تاریخچه‌اند.**

## ادامهٔ نقشهٔ راه (۲۰۲۶-۰۹-۲۷)
- شاخهٔ نشست: `arena/01a0e2cf-repo`؛ SEC-1 و LIVE-3 تا LIVE-6 تکمیل شده‌اند؛ پیشرفت ۲۲/۱۳۵ ≈ ۱۶٪ (۱۳ مورد انجام‌شده، ۵۷ باز؛ P1: ۱۰۰٪). مرحلهٔ بعد **P2 / CSU-1** است.
- دروازهٔ فعلی: **۴۳۲۳/۴۳۲۳ آزمون**، `npx tsc --noEmit` و `npm run build` موفق.
- LIVE-3: `server/rccWorkspaceApi.js` + `src/services/rccWorkspace.ts` + صفحهٔ `RiskClaimsWorkspace`؛ مهاجرت 0036؛ جزئیات و محدودیت‌ها در نقشهٔ راه.
- فایل `ForensicClaimsHub.tsx` حفظ شد؛ مفاهیم اصلی به صفحهٔ فعال منتقل شد، نه موتور کامل تحلیل تأخیر/مونت‌کارلو و خروجی‌های نمایشی آن.
- راه‌اندازی از checkout تازه: `npm ci`، سپس `npm test` (ساخت bundleهای سرور، شامل `build:rccws`، `build:monitoring` و `build:sxws`)، سپس فقط `PERSIST_DRIVER=json DATA_DIR=./server/rundata PORT=4000 node server/index.js`.
- دستور قدیمی `node server/seed.mjs` را بی‌بررسی اجرا نکنید: پس از SEC-1 نقش admin مجوز نوشتن تمام جداول کسب‌وکار را ندارد. هیچ دادهٔ نمونه‌ای برای RCC خودکار درج نمی‌شود.
- LIVE-4: ماشین‌آلات روی API پروژه‌ای، فرم‌های ماندگار و گزارش احراز هویت‌شده؛ جزئیات و محدودیت‌ها در نقشهٔ راه. برای ثبت نقش PMO و برای تصویب دیسپچ مدیر پروژه را انتخاب کنید.
- LIVE-5: `server/monitoringWorkspaceApi.js` و `src/services/monitoringWorkspace.ts`؛ صفحهٔ مشترک همهٔ ورودی‌های پایش، مجوز هر منبع، EVM دارای مهر/ورودی سازگار، پیش‌نگر، مصوبات و هشدار واقعی، منشأ/تاریخ/وضعیت داده، خروجی داخلی JSON. PHI/پیش‌بینی تازه/ACK ماندگار/گزارش قراردادی ساخته نشده‌اند؛ جزئیات مرز تحویل در نقشهٔ راه.
- LIVE-6: `server/strategyExcellenceWorkspaceApi.js` و `src/services/strategyExcellenceWorkspace.ts`، فرم مشترک `PersistentBusinessWorkspace` و بازنویسی StrategyWorkspace/EfqmPanel؛ مهاجرت **0037** برای دو جدول، چهار مجوز مستقل، PMO/مدیر ارشد ویرایش و مدیر پروژه مشاهده. مدل تعالی داخلی نه‌معیاره است، نه EFQM 2020/گواهی رسمی؛ مرزها و ظرفیت و نبود تراکنش اتمی ممیزی در نقشهٔ راه ثبت‌اند.
- قبل از آزمون‌های runtime، API پیش‌نمایش را متوقف کنید. پنج suite مشترک قفل `server/rundata/.rest-test-lock` دارند؛ پس از kill اجباری آزمون، فقط با اطمینان از نبود آزمون فعال، قفل باقی‌مانده را پاک کنید. این راهکار مجوز چند API هم‌زمان با JSON نیست.
- پیش‌نمایش فعال: وب ۵۱۷۳، API ۴۰۰۰ با JSON و `server/rundata`. HTTP وب و API پراکسی بررسی شده؛ آزمون بصری مرورگر/SQL Server انجام نشده است.

---

## وضعیت نشست جاری (۲۰۲۶-۰۹-۱۴)

- **شاخه:** `arena/01a09fd7-repo` · **PR:** [#2](https://github.com/padircom/-/pull/2) به `main`
- کل کار نشست پیشین (`arena/01a07ee6-repo`) که روی گیت‌هاب نرفته بود، از بستهٔ
  `transfer/previous-chat-patch` بازیابی و روی همین شاخه سوار شد: ۲۱۴ فایل جدید، ۲۴ به‌روزشده.
- ریشه تمیز شد: حذف ۲۱۰ فایل بازماندهٔ یک `.git` رهاشده (`02/…`, `db/<sha>`, `index`).
- **دروازه: `npm test` → ۴۱۲۰/۴۱۲۰ سبز** روی هر ۹۰ فایل `server/*.test.mjs`.
  (پیش‌تر اسکریپت آزمون ۱۶ فایل CNT/HSE را جا انداخته بود و ۳۳۶۷ می‌شمرد — اصلاح شد.)
- بیلد تولیدی سالم: `npm run build` → `dist/index.html` تک‌فایل ۱٫۸ MB.

### اجرا (سه گام)
```bash
npm install --no-audit --no-fund                    # node_modules در snapshot نیست
PORT=4000 PERSIST_DRIVER=json DATA_DIR=./server/rundata node server/index.js
node server/seed.mjs                                # فقط بار اول
npm run dev -- --port 5173 --host 0.0.0.0
```
- `PERSIST_DRIVER=json` **اجباری**؛ بدون آن سرور به SQL Server واقعی (`.\SQL2008EXPRESS`) می‌رود.
- `DATA_DIR=./server/rundata` — **نه `server/data`**؛ آن مسیر نقطهٔ شروع ۲۹ آزمون REST است.
- `/api/health` عمداً ۵۰۰ می‌دهد (سلامت SQL واقعی)؛ نشانهٔ خرابی نیست.

### بعدی پیشنهادی
۱) فاز F5 پایداری PEX: جداول `pex_*` + ثبت واقعی DPR (G1+G2).
۲) اتصال GOV به SQL واقعی (G1+G2 حاکمیت).
۳) دامنهٔ بعدی بدون سند. → جزئیات هر ماژول در `docs/SESSION_HANDOFF.md` و `transfer/hrm/README.md`.

---

تاریخ بخش قدیمی: 2026-09-08
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
- `src/ForensicClaimsHub.tsx` (بازبینی FIX-4): خطای نحوی **ندارد** (esbuild و tsc آن را تجزیه می‌کنند). فایل میراثی است، در `tsconfig.exclude` است و import نشده؛ به `Widget` و `WorkspaceHeader` تعریف‌نشده و بستهٔ نصب‌نشدهٔ `lucide-react` ارجاع دارد (مثل ۷ فایل میراثی دیگر). طبق BASELINE حذف نمی‌شود؛ در LIVE-3 مفاهیم اصلی به ورک‌اسپیس جدید منتقل شد؛ مهاجرت کامل موتورهای نمایشی/خروجی‌ها انجام نشده است (جزئیات در نقشهٔ راه).
- `jalaali-js` فقط CJS است؛ در `server/index.js` با interop امن import می‌شود.
- سازنده محصول در هدر App: محمدرضا هاشمی‌پور

## بعدی پیشنهادی
۱) فاز F5 پایداری داده PEX: جداول `pex_*` + ثبت واقعی DPR (G1+G2).
۲) یا اتصال GOV به SQL Server واقعی (G1+G2 حاکمیت).
۳) یا ماژول بعدی بدون سند.
