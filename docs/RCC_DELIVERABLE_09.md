# RCC Deliverable 9 — Contract Clause Engine + Claim Event

خلاصه ۳ خطی: بند قرارداد مستقل با FTS دو زبانه و کتابخانه FIDIC / نشریه ۴۳۱۱. تقویم کاری برای مهلت. رویداد ادعا روی `claim_register` 📌 با نوع رویداد، مهلت Notice، برآورد اولیه و ادله PIM. Time-Bar Guardian در D10 روی همین فیلدها می‌نشیند.

---

## 1. Clause engine ✨

`contract_clause`: multi-contract (`contract_id`)، book، category، شماره بند، متن fa/en، `notice_period_days` / `response_period_days`.

FTS: GIN `simple` روی بدنه.

کتابخانه قالب (seed بعدی F5): Red/Yellow/Silver — بندهای Notice (20.1/20.2 معادل)، Variation، EOT، Force Majeure؛ ۴۳۱۱ مواد ۲۹–۳۰ هم‌تراز UI فعلی.

`contract_calendar`: calendar | working | custom + holidays[]. محاسبه مهلت:

```ts
function addDays(start: Date, n: number, cal: { mode: string; holidays: string[] }) {
  if (cal.mode === "calendar") {
    const d = new Date(start);
    d.setDate(d.getDate() + n);
    return d;
  }
  let left = n, d = new Date(start);
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    const wk = d.getDay();
    if (wk !== 5 && wk !== 4 && !cal.holidays.includes(iso)) left--; // sample: Fri-Thu weekend configurable
  }
  return d;
}
```

UI 👁️: 09.3 زیر d4-p5؛ جستجوی بند شیشه‌ای. مراجع ثابت ۵۰۹۰/۲۹/۳۰ در تب delay **حفظ** می‌شوند (🔧 لینک به clause_id).

---

## 2. Claim event 🔧 روی 📌

۱۹ نوع (نمونه): EOT, Disruption, Acceleration, VariationUnpaid, LateDrawing, Access, ForceMajeure, Weather, Quantity, SpecChange, Suspension, Termination, PaymentLate, Prolongation, ClientDelay, ContractorDelay, Concurrent, Interest, Other.

فیلدها: event_type, notice_deadline, is_time_barred, clause_ids[], estimate_amount/days, evidence_refs[] (PIM).

ثبت بدون بند قراردادی = ضدالگو؛ UI هشدار، ذخیره پیش‌نویس مجاز، ارسال Notice خیر (D10).

دروازه موجود BL+DataDate **حفظ**.

---

## 3. DDL

`db/postgres/rcc/migrations/V008__clause_claim_event.sql`

---

## 4. Loop D9

| Loop | |
|---|---|
| 5 | Clause + calendar + event types + time-bar fields |
| 7 | deadline ستون آماده Guardian |
| 10 | 📌 claim_register حفظ |

**Gap باقی:** Notice Engine + Python Guardian → D10 ★

منتظر **Deliverable 10**.
