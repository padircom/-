# RCC Deliverable 7 — Change Request + Impact Analysis (۱۲ بُعد)

خلاصه ۳ خطی: CR روی `change_request` 📌 با origin، نوع، اضطراری/پس‌ازوقوع، revision. تحلیل اثر در JSONB دوازده‌بُعدی قبل از CCB (D8). به‌روزرسانی Baseline فقط پیشنهاد به PEX پس از تصویب — RCC عدد قفل را نمی‌نویسد.

---

## 1. انواع تغییر (۱۴)

Scope, Schedule, Cost, Quality, Resource, Contract, Design, Method, Sequence, Quantity, HSE, Interface, ClientInstruction, Emergency.

Origin: Client, Contractor, Risk, Issue, VAR, PIM, Other.

Emergency + Post-Facto: `emergency_flag` / `post_facto`؛ CCB بعدی اجباری (D8).

UI 👁️: ویزارد شیشه‌ای روی تب change موجود؛ زیرفرایند داخلی 08.1–08.2 زیر d4-p3.

---

## 2. دوازده بُعد اثر (`impact` jsonb)

1. Scope  
2. Schedule (days + critical_path bool)  
3. Cost (direct / indirect / contingency)  
4. Quality  
5. Risk (new / existing ids)  
6. Resource  
7. Contract (+ amendment_need)  
8. Stakeholder  
9. Cash flow  
10. EAC (خواندن از موتور؛ ذخیره اثر پیشنهادی نه CPI)  
11. HSE  
12. Procurement  

Overall rating: max وزن‌دار ابعاد پرشده → low/med/high.  
Recommended action: approve_ccb / more_info / reject_draft.

قانون ضدالگو: **بدون Impact، رفتن به CCB ممنوع.**

شبه‌کد:

```ts
function overall(impact: Record<string, number | null>) {
  const vals = Object.values(impact).filter((v): v is number => typeof v === "number");
  const m = Math.max(0, ...vals);
  return m >= 4 ? "high" : m >= 3 ? "med" : "low";
}
```

چند بازبین: در D8 با CCB؛ اینجا فقط فیلد `recommended_action`.

---

## 3. Baseline tracking

Before/After = ارجاع `baseline_version` (D8) نه کپی SPI.  
فرم فعلی timeImpact/costImpact متنی 🔧 به jsonb نگاشت می‌شود (مهاجرت داده: رشته → کلید schedule_days / cost_direct اگر parse شد، وگرنه null + متن در note).

---

## 4. DDL

`db/postgres/rcc/migrations/V006__change_impact.sql` — ADD COLUMN روی 📌.

---

## 5. Loop D7

| Loop | |
|---|---|
| 1 | ICC 4.6 مقدماتی |
| 4 | ۱۴ نوع + ۱۲ بُعد + emergency |
| 6 | origin از VAR/Risk/Issue |
| 8 | KPI چرخه CR در D14 |
| 10 | 📌 حفظ |

**Gap باقی:** CCB + Authority + BL immutable → D8.

منتظر **Deliverable 8**.
