# RCC Deliverable 6 — Issue Management + Early Warning

خلاصه ۳ خطی: Issue از هستهٔ RegisterItem با منبع realized_risk / NCR / VAR. تحلیل ریشه 5Whys/Fishbone و سه لایه اقدام. EWS جدا ولی هم‌خوان با قفل PMA موجود (`majorVarianceBlocksReport`). تبدیل Issue → CR یا Claim بدون بازنویسی اعداد.

---

## 1. Issue ✨ (extends RegisterItem)

`item_type = issue`. جدول فرزند `issue`:

| فیلد | نقش |
|---|---|
| source_type | realized_risk, unforeseen, ncr, variance, notice, other |
| root_method | 5whys / fishbone |
| immediate / corrective / preventive | اقدامات |
| convert_to | cr \| claim |

قانون: ریسک با status occurred + level high → spawn issue + پیشنهاد CR (D13 rule 3).

UI 👁️: زیرفرایند داخلی 07.6 زیر d4-p1. لیست شیشه‌ای مثل ثبت ریسک.

---

## 2. Early Warning ✨

جدول `early_warning` — Ack و escalation سه‌سطحی (warn → critical → emergency).

منابع تریگر (خواندنی):

| منبع | شرط نمونه |
|---|---|
| PMA | SPI/CPI/PHI آستانه؛ Major VAR بدون اکشن (قفل گزارش موجود) |
| PEX | TF&lt;0، لغزش مایلستون |
| مالی | رشد EAC |
| قرارداد | موعد Notice (D10) |
| کیفیت | NCR بحرانی |
| تدارکات | تأخیر کالا |
| ذخیره | تهی‌شدن D5 |

هم‌پوشانی با MON: RCC رویداد می‌سازد؛ PMA قانون EWS خود را نگه می‌دارد. تکراری‌سازی عدد ممنوع — `source_ref` کافی است.

Ack ۲۴س مانند PMA؛ اگر نه → escalate.

UI 👁️: chip روی هدر d4 (کنار قفل PMA).

---

## 3. DDL

`db/postgres/rcc/migrations/V005__issue_ews.sql`

---

## 4. Loop D6

| Loop | |
|---|---|
| 1 | Monitor risks + communications |
| 2 | Issue TPT |
| 3 | Convert occurred → issue |
| 5 | Notice deadline به‌عنوان منبع EWS (اجرا D10) |
| 6 | منبع VAR/SPI |
| 7 | Ack/escalate زیرساخت Time-Bar |
| 10 | 📌 حفظ |

**Gap باقی:** CR + ۱۲ بُعد → D7.

منتظر **Deliverable 7**.
