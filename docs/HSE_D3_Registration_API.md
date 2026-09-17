# HSE D3 — ثبت حادثه/PTW/بازرسی + گیت WO

**نسخه:** 1.0 · مبنا: `HSE_D1_Architecture.md` ‏(§۶) + `HSE_D2_DataModel.md`
**محدوده:** اعتبارسنجی موتور + API ثبت/فهرست/گذار PTW + گیت advisory + اتصال UI.
گیت hard، فرم بازرسی در UI و اتصال DPR/GOV/RCC در D4.

---

## ۱) موتور (تک‌منبع `hse.ts` + آینه `hseLogic.js`)

| تابع | خروجی |
|---|---|
| `validateIncident` | کدهای `DATE_INVALID` ‏`TYPE_UNKNOWN` ‏`LOSTDAYS_INVALID` ‏`AREA_REQUIRED` ‏`DESC_REQUIRED` ‏`STATUS_UNKNOWN` ‏`VOLUME_REQUIRED` ‏(spill) ‏`CODE_EMPTY` |
| `validatePermit` | ‏`TYPE_UNKNOWN` ‏`DATE_INVALID` ‏`AREA_REQUIRED` ‏`RISK_UNKNOWN` ‏`NO_EMPTY` |
| `validateInspection` | ‏`AREA_REQUIRED` ‏`DATE_INVALID` ‏`ITEMS_REQUIRED` ‏`ITEMS_TOO_MANY` ‏`In:ITEM_TEXT_REQUIRED` |
| `woPermitGate(req, permits, mode)` | ‏`{ok, verdict, reason, permitNo?, pending?}` |
| `nextInspectionDue(dateISO, band)` | قاعده A:+۹۰ B:+۳۰ C:+۱۴ D:+۷ |

تطبیق گیت: هم‌نوعِ پرخطر + وضعیت `active` + هم‌روز + (هم‌ناحیه اگر داده شود).
کار `cold`/`general` نیاز به PTW ندارد (`NO_PERMIT_NEEDED`).

## ۲) API (`server/index.js`)

| متد و مسیر | ورودی | خروجی |
|---|---|---|
| `GET /api/hse/projects/:code/incidents` | ‏`?status=&type=` | ۲۰۰ ردیف آخر |
| `POST .../incidents` | ‏`HseIncidentInput` ‏(code اختیاری/خودکار) | ۲۰۱ + `SeverityW` محاسبه‌شده |
| `GET /api/hse/projects/:code/permits` | ‏`?status=` | ۲۰۰ ردیف آخر |
| `POST .../permits` | ‏`HsePermitInput` ‏(no خودکار، flags اختیاری) | ۲۰۱ + `warnings` پیش‌شرط‌های جامانده |
| `POST /api/hse/permits/:id/actions` | ‏`{action, role}` طبق `PTW_TRANSITIONS` | ردیف به‌روز + ثبت audit |
| `GET /api/hse/projects/:code/inspections` | — | items پارس‌شده + score/band |
| `POST .../inspections` | ‏`{area, dateISO, items[]}` | ۲۰۱ + score/band/nextDue محاسبه‌شده |
| `GET /api/hse/projects/:code/wo-gate` | ‏`?workType=&area=&workDate=` | ‏`WoGateDto` ‏(فعلاً advisory) |

خطاها: `VALIDATION` ‏(۴۰۰) · `ROLE_NOT_ALLOWED` ‏(۴۰۳) · `INVALID_TRANSITION`/`HSE_DUPLICATE` ‏(۴۰۹).
گذار PTW در audit سراسری (`HSE_PERMIT_ACTION`) ثبت می‌شود؛ جدول رویداد اختصاصی نداریم (Gap).

## ۳) UI (`HseWorkspace` + `hseApi.ts`)

- فهرست هر سه موجودیت از SQL با fallback به seed + بج `● SQL / ○ Seed`.
- فرم ثبت حادثه (نوع/تاریخ/ناحیه/شرح/روز ازدست‌رفته/حجم نشت).
- فرم ثبت PTW (نوع/تاریخ/ناحیه/ریسک + چک‌باکس پیش‌شرط‌ها) و دکمه‌های گذار هر ردیف با انتخاب نقش.
- کارت «سنجش گیت WO» در داشبورد (نوع کار + ناحیه + تاریخ ← verdict).
- KPIها از داده زنده (SQL یا seed) محاسبه می‌شوند، نه هاردکد.

## ۴) خوداعتبارسنجی D3

| Loop | نتیجه |
|---|---|
| ۱ Engine‑parity | ۹ تست تازه سبز؛ رفتار TS/JS یکسان (۲۳/۲۳ HSE) |
| ۲ Server‑derive | SeverityW/Score/Band/NextDue فقط سرور می‌سازد، نه کلاینت |
| ۳ Gate‑matrix | cold→allow · تطبیق کامل→allow+permitNo · نامتجانس→warn+pending · hard→block |
| ۴ Audit | هر گذار PTW یک `writeAudit` دارد |
| ۵ UI‑honesty | حالت آفلاین بنر دارد؛ ثبت واقعی بدون اتصال ممکن نیست |

**Gap → D4:** فرم ثبت بازرسی در UI؛ `hse_permit_event` اختصاصی؛ گیت hard در جریان WO؛
تغذیه `DPR.SafetyEvents ←→ hse_incident`؛ ارجاع `hse_action[critical] → gov CAPA`؛
اتصال TRIR به `KPI_SEED` و `computePhi.hse`.
