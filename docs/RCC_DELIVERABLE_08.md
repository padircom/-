# RCC Deliverable 8 — CCB Workflow + Baseline Configuration Control

خلاصه ۳ خطی: CCB با رأی و justification اجباری؛ ماتریس اختیار نقش (سقف هزینه/روز). BaselineVersion اسنپ‌شات غیرقابل ویرایش با ارجاع به PEX — RCC برنامه را بازنویسی نمی‌کند. Change Log الحاقی. CR اضطراری بدون Impact همچنان ممنوع است مگر post-facto با justification.

---

## 1. CCB

موجودیت‌ها ✨: `ccb_meeting`, `ccb_decision`, `approval_authority`.

رأی: Unanimous / Majority / Split / Deferred.  
تصمیم: approved / rejected / more_info.  
`justification` NOT NULL.

ماتریس اختیار (نمونه):

| نقش | max_cost | max_days | اضطراری |
|---|---|---|---|
| PM | 50k | 7 | خیر |
| PMO | 250k | 21 | خیر |
| Sponsor | null | null | بله |
| CCB | null | null | بله |

اگر اثر CR از سقف نقش پیشنهاددهنده بیشتر → escalate.

صورتجلسه → ارجاع مدرک PIM (`minutes_doc`).

UI 👁️: 08.3 در aside داخلی d4-p3. تب change موجود + پنل تصمیم.

---

## 2. Baseline sacred

`baseline_version`: kind schedule/cost/scope/integrated، `snapshot_ref` به قفل PEX، `frozen_at`.  
Immutability: UPDATE/DELETE ممنوع (تریگر پیشنهادی):

```sql
CREATE OR REPLACE FUNCTION baseline_no_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'baseline_version is immutable';
END $$ LANGUAGE plpgsql;
-- APPLY on UPDATE OR DELETE
```

فرآیند به‌روزرسانی: CCB approved → PEX سرویس اسنپ‌شات جدید می‌سازد → RCC فقط ردیف version می‌نویسد. **pctApproved دست نخورده.**

مقایسه Initial vs Current: دو `snapshot_ref`.

Implementation: `change_implementation` + `action_refs` به PMA.

Change Log: append-only jsonb.

---

## 3. DDL

`db/postgres/rcc/migrations/V007__ccb_baseline.sql`

---

## 4. Loop D8

| Loop | |
|---|---|
| 1 | 4.6 ICC |
| 4 | Voting + authority + emergency + immutable BL + log |
| 6 | ارجاع snapshot PEX |
| 10 | 📌 change_request حفظ |

**Gap باقی:** بند قرارداد + رویداد ادعا → D9.

منتظر **Deliverable 9**.
