# QMS Deliverable 2 — مدل داده و لایه سرویس

**ماژول:** QMS · **دامنه:** `d8` · **نسخه:** `qms-v1` · **تاریخ:** 2026-09-08

خلاصه سه‌خطی: یازده جدول `Quality_*`/`ITP_*`/`NCR_*` تعریف شد که هیچ‌کدام نام یا ستون جدول موجودی را تغییر نمی‌دهند. یازده اندپوینت `/api/qms/*` روی همان موتور مشترک `quality.ts` سوار شده‌اند و چهار دروازه سخت را در سطح HTTP اعمال می‌کنند. رابط کاربری اگر سرویس در دسترس نباشد بی‌صدا روی داده نمونه می‌ماند.

---

## ۱. جداول

| جدول | وضعیت | کلید | ستون‌های کلیدی |
|---|---|---|---|
| `Quality_Plan` | ✨ جدید | `plan_id` | `project_id`, `revision`, `approved_by`, `approved_at` |
| `ITP_Master` | ✨ جدید | `itp_id` | `plan_id`, `discipline`, `spec_ref`, `revision` |
| `ITP_Point` | ✨ جدید | `point_id` | `itp_id`, `activity_id`, `point_type` (`H`/`W`/`R`/`M`), `party`, `signed_at`, `signed_by`, `waived_by` |
| `Inspection_Request` | ✨ جدید | `ir_id` | `point_id`, `requested_at`, `inspection_at`, `notice_hours`, `state` |
| `Inspection_Result` | ✨ جدید | `result_id` | `ir_id`, `outcome`, `signature_hash`, `signer`, `signed_at`, `formula_version` |
| `Test_Report` | ✨ جدید | `test_id` | `ir_id`, `method` (`RT`/`UT`/`PT`/`MT`/`Hydro`/`Concrete`), `value`, `unit`, `acceptance` |
| `NCR_Register` | ✨ جدید | `ncr_id` | `project_id`, `severity`, `cause`, `disposition`, `concession_by`, `opened_at`, `closed_at`, `recurrence` |
| `CAPA_Action` | ✨ جدید | `capa_id` | `ncr_id`, `root_cause`, `owner`, `due_at`, `effectiveness_verified_at` |
| `Material_Certificate` | ✨ جدید | `cert_id` | `heat_no`, `cert_type` (EN 10204), `declared_grade`, `required_grade`, `lab_verified`, `expires_at` |
| `Heat_Trace_Link` | ✨ جدید | `link_id` | `from_node`, `to_node` (ذوب → اسپول → جوش → آزمون → داکیومنت) |
| `Quality_Audit` / `Audit_Finding` | ✨ جدید | `audit_id` / `finding_id` | `clause`, `severity`, `closed_at` |
| `Punch_List` | ✨ جدید | `punch_id` | `system_id`, `category` (`A`/`B`), `closed_at` |
| `Completion_Certificate` | ✨ جدید | `mc_id` | `system_id`, `issued_at`, `blockers_snapshot` |
| `Quality_Dossier` | ✨ جدید | `dossier_id` | `system_id`, `required_items`, `delivered_items` |

هیچ جدول موجودی تغییر نکرد؛ ارتباط با دامنه‌های دیگر فقط از راه کلید خارجی خواندنی است: `activity_id → PEX`, `po_id/grn_id → FIN`, `document_id → DMS`, `ncr_id → RCC`.

```sql
CREATE TABLE ITP_Point (
  point_id      NVARCHAR(32)  NOT NULL PRIMARY KEY,
  itp_id        NVARCHAR(32)  NOT NULL REFERENCES ITP_Master(itp_id),
  activity_id   NVARCHAR(32)  NULL,           -- ارجاع خواندنی به PEX
  point_type    CHAR(1)       NOT NULL CHECK (point_type IN ('H','W','R','M')),
  party         NVARCHAR(16)  NOT NULL CHECK (party IN ('contractor','consultant','client','tpi')),
  title_fa      NVARCHAR(256) NOT NULL,
  signed_at     DATE          NULL,
  signed_by     NVARCHAR(64)  NULL,
  waived_by     NVARCHAR(64)  NULL
);

CREATE TABLE NCR_Register (
  ncr_id        NVARCHAR(32)  NOT NULL PRIMARY KEY,
  project_id    NVARCHAR(32)  NOT NULL,
  title_fa      NVARCHAR(256) NOT NULL,
  severity      NVARCHAR(8)   NOT NULL CHECK (severity IN ('critical','major','minor')),
  cause         NVARCHAR(64)  NULL,
  disposition   NVARCHAR(16)  NOT NULL CHECK (disposition IN ('rework','repair','use_as_is','reject','scrap')),
  concession_by NVARCHAR(64)  NULL,
  opened_at     DATE          NOT NULL,
  closed_at     DATE          NULL,
  recurrence    INT           NOT NULL DEFAULT 1,
  -- دروازه ۲: تعیین تکلیف نرم‌کننده بدون ارفاق مهندسی مجاز نیست
  CONSTRAINT CK_NCR_Concession CHECK (disposition NOT IN ('use_as_is','repair') OR concession_by IS NOT NULL)
);

CREATE TABLE Inspection_Result (
  result_id       NVARCHAR(32) NOT NULL PRIMARY KEY,
  ir_id           NVARCHAR(32) NOT NULL REFERENCES Inspection_Request(ir_id),
  outcome         NVARCHAR(16) NOT NULL CHECK (outcome IN ('accepted','conditional','rejected')),
  signer          NVARCHAR(64) NOT NULL,
  signed_at       DATETIME2    NOT NULL,
  signature_hash  CHAR(8)      NOT NULL,   -- خروجی signRecord
  formula_version NVARCHAR(16) NOT NULL    -- qms-v1
);
```

---

## ۲. اندپوینت‌ها

| متد | مسیر | کار | کد خطای دروازه |
|---|---|---|---|
| GET | `/api/qms/itp` | نقاط کنترل، فهرست مسدودکننده‌ها، پوشش ITP | — |
| POST | `/api/qms/itp/:pointId/sign` | امضای نقطه توقف (idempotent) | `404` اگر نقطه نباشد |
| GET | `/api/qms/inspections` | درخواست‌های بازرسی + کنترل اعلان ۴۸ ساعته + FPY | — |
| POST | `/api/qms/inspections/:irId/sign` | امضای هش‌دار نتیجه بازرسی | `404` |
| GET | `/api/qms/ncr` | دفتر NCR + تأخیر + الزام CAPA + پارتو | — |
| POST | `/api/qms/ncr` | ثبت NCR با شدت خودکار | **`409 QMS-409-CONCESSION`** |
| GET | `/api/qms/certificates` | کنترل گواهی مواد (`?minType=3.2`) | — |
| GET | `/api/qms/audit` | یافته‌ها، امتیاز انطباق، ریسک گواهینامه | — |
| GET | `/api/qms/handover` | پانچ، داکیومنت، وضعیت دروازه MC | — |
| POST | `/api/qms/handover/mc` | صدور گواهی تحویل مکانیکی | **`409 QMS-409-MC-GATE`** |
| GET | `/api/qms/dashboard` | شش شاخص + هشدارهای EWS | — |

قالب پاسخ همان قرارداد سایر ماژول‌هاست: `{ ok, data, meta:{ traceId, timestamp, writesOwnedFigures:false } }`. پرچم `writesOwnedFigures:false` صریح می‌گوید QMS هیچ عدد متعلق به دامنه دیگری را نمی‌نویسد.

### شواهد اجرای واقعی

```
POST /api/qms/handover/mc     → 409 QMS-409-MC-GATE
   open_punch_class_a, open_critical_ncr, unsigned_hold_point, dossier_incomplete
POST /api/qms/ncr (use_as_is بدون ارفاق) → 409 QMS-409-CONCESSION
POST /api/qms/ncr (use_as_is + concessionBy) → 201 severity=critical, capaRequired=true
POST /api/qms/itp/ITP-03-H/sign → 200 signedBy=بازرس TPI
GET  /api/qms/dashboard → itpCoverage 83.3% · FPY 25% · COPQ 1.95% · compliance 87
```

---

## ۳. رفتار کلاینت

`src/services/qmsApiClient.ts` با مهلت ۲٫۵ ثانیه و بررسی `content-type` کار می‌کند: اگر سرویس بالا نباشد یا سرور توسعه HTML برگرداند، `null` می‌دهد و `QualityWorkspace` روی داده نمونه می‌ماند و نشان «داده نمونه» را نمایش می‌دهد. با سرویس فعال، برچسب به «داده زنده» تغییر می‌کند و امضاها و صدور MC از سرور می‌آیند.

> در حالت توسعه `vite.config.ts` پراکسی `/api` ندارد (طبق تصمیم پروژه دست‌نخورده مانده)؛ در استقرار، `nginx.conf` مسیر `/api` را به سرویس Node می‌فرستد.

---

## ۴. شکاف‌های باقی‌مانده

| کد | شکاف | برنامه |
|---|---|---|
| G1 | ذخیره‌سازی واقعی SQL (اکنون in-memory) | اجرای DDL بالا + لایه `mssql` مانند سایر ماژول‌ها |
| G2 | اپ موبایل بازرسی روی `syncQueue.ts` | بازرسی آفلاین با بارکد قطعه |
| G3 | نقش‌های QC/QA در RBAC | افزودن `quality.inspect` و `quality.approve` |
| G4 | خروجی Excel داکیومنت کیفیت | ظرف Excel، نه منبع حقیقت |
| G5 | رویداد خودکار NCR بحرانی → پیشنهاد CR در d4 | webhook داخلی |
