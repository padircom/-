# PEX فاز F5 — گزارش G1 و G2

تاریخ: 2026-09-08 · شاخه: `arena/01a0811c-repo`

## G1 — انتقال داده PEX از `src/data/pexProject.ts` به جداول SQL

| لایه | فایل |
|---|---|
| داده انتقالی (seed) | `src/data/pexProject.ts` — پروژه OG-2401: ۸ گره WBS، ۴ فعالیت + ۲۱ گام RoC، ۳ مایلستون، ۴ RoC |
| DDL (SQL Server 2008 سازگار) | `db/mssql/V001__pex_core.sql` — `pex_project` · `pex_wbs` · `pex_roc` · `pex_activity` · `pex_activity_step` · `pex_milestone` |
| سید idempotent | `db/mssql/seed__pex_og2401.sql` (آینه seed؛ `ApprovedQty = Target × pct`) |
| راهنما | `db/mssql/README.md` |
| خوانش API | `GET /api/pex/projects/:code/{wbs,activities,milestones,roc}` در `server/index.js` |
| کلاینت + fallback | `src/services/pexApi.ts` — `loadPexSnapshot()` ‏(SQL وگرنه seed)؛ بج `● SQL / ○ Seed` در هدر PEX |

تب‌های WBS/گانت/CP/نگاه‌به‌جلو/مایلستون/RoC از اسنپ‌شات تغذیه می‌شوند؛
شکل ظاهری و فونت بدون تغییر.

## G2 — ثبت واقعی DPR در `pex_progress_line` با گردش تأیید

| لایه | فایل |
|---|---|
| DDL | `db/mssql/V002__pex_dpr.sql` — `pex_dpr` · `pex_progress_line` · `pex_dpr_event` |
| منطق خالص | `server/pexLogic.js` — اعتبارسنجی، گذارها، roll-up، تعارض، هشدار ۲۴ساعته |
| API | `POST/GET /api/pex/projects/:code/dpr` · `GET /api/pex/dpr/:id` · `POST /api/pex/dpr/:id/actions` · `GET …/dpr/conflicts` |
| UI | `src/components/PexDprPanel.tsx` — فرم ثبت، فهرست، جزئیات، دکمه‌های گردش، تعارض‌ها |
| تست | `server/pex.test.mjs` — ۱۴ تست (مجموع سوئیت: rcc + gov + pex) |

گردش: `draft → submitted → approved | rejected | revision_required`
(نقش‌ها طبق `DPR_TRANSITIONS`). با approve، خطوط `approved` شده و مقادیر
به `pex_activity_step.ApprovedQty` و سپس `pex_activity.PctApproved` غلت می‌خورد
(تراکنش واحد). فقط Approved وارد PMS می‌شود (PEX_D9).

## اجرا

```bat
sqlcmd -S localhost\SQL2008EXPRESS -d PMO_Dashboard_DB -i db\mssql\V001__pex_core.sql
sqlcmd -S localhost\SQL2008EXPRESS -d PMO_Dashboard_DB -i db\mssql\V002__pex_dpr.sql
sqlcmd -S localhost\SQL2008EXPRESS -d PMO_Dashboard_DB -i db\mssql\seed__pex_og2401.sql
```

```bash
npm test          # rcc + gov + pex
npm run build     # vite single-file
```

## Gap / بعدی

- اتصال EVM/PPC داشبورد به اسنپ‌شات SQL (فعلاً از `projectControls`).
- Conflict UX کامل (انتخاب برنده توسط reviewer) در F6.
- مایلستون Forecast = CPM EF پس از اتصال موتور CPM به SQL.
- پاک‌سازی فایل‌های اضافی ریشه (بقایای `objects/` گیتِ آپلودشده توسط کاربر) در PR جدا.
