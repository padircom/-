# GOV D10 — API و دامنه MVP

خلاصه ۳ خط: قرارداد REST ماژول حاکمیت در `docs/openapi/gov-v1.yaml` تعریف شده است (پایه `/api/v1/gov`). MVP شامل گردش‌کار+SLA، ممیزی+CAPA، تصمیم+DoA و سلامت یکپارچگی است؛ ذی‌نفعان در فاز دوم به مکاتبات d1 وصل می‌شود. احراز هویت Bearer JWT با ABAC روی `projectId`.

## ۱) گروه‌های API

| مسیر | متد | کار |
|---|---|---|
| `/projects/{projectId}/workflows` | GET | فهرست نمونه‌های گردش‌کار |
| `/projects/{projectId}/workflow-tasks` | GET | گام‌های باز + SLA + سطح تشدید |
| `/workflow-tasks/{taskId}/approve` | POST | تأیید گام + append در زنجیره |
| `/projects/{projectId}/connectors` | GET | رجیستری اتصال + سلامت |
| `/projects/{projectId}/audit/findings` | GET/POST | یافته‌ها |
| `/audit/findings/{id}/capa` | POST | ثبت اقدام اصلاحی |
| `/audit/plans/{id}/close` | POST | بستن ممیزی (مسدود اگر CAPA لازم باشد) |
| `/projects/{projectId}/decisions` | GET/POST | دفتر تصمیم؛ POST از دروازه عبور می‌کند |
| `/projects/{projectId}/stakeholders` | GET | رجیستر ذی‌نفع |
| `/projects/{projectId}/audit-trail` | GET | زنجیره append-only + وضعیت صحت |

## ۲) کدهای خطای اختصاصی

| کد | معنا |
|---|---|
| `GOV-403-DOA` | اختیار ناکافی نسبت به اثر هزینه/زمان |
| `GOV-409-CAPA` | بستن ممیزی به دلیل CAPA باز |
| `GOV-409-EVIDENCE` | تصمیم بدون شاهد عددی |
| `GOV-409-BASELINE` | تلاش برای بازنویسی Baseline بدون CR |
| `GOV-423-TRAIL` | تلاش برای تغییر/حذف رکورد زنجیره |

## ۳) دامنه MVP

| قلم | MVP | فاز ۲ |
|---|---|---|
| گردش‌کار + SLA + تشدید | ✅ | تقویم کاری و تعطیلات |
| ممیزی + CAPA | ✅ | ممیزی دوره‌ای خودکار |
| تصمیم + DoA + شاهد | ✅ | امضای دیجیتال |
| سلامت یکپارچگی | ✅ | آشتی‌دهی خودکار سه‌طرفه |
| ذی‌نفعان | نمایش | اتصال به مکاتبات d1 |
| زنجیره ممیزی | ✅ | آرشیو خارج از پایگاه |

## ۴) غیرکارکردی
Rate limit ۱۲۰ req/min/IP · پاسخ فهرست‌ها زیر ۱ ثانیه تا ۱۰k ردیف · ثبت هر نوشتن در `gov_audit_trail` · Idempotency-Key روی POSTهای تأیید.
