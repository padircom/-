# RCC Deliverable 10 — Notice Engine + Time-Bar Guardian ★

خلاصه ۳ خطی: هر ادعا Notice چندمرحله‌ای با مهلت از بند+تقویم. نگهبان روزانه چهار سطح ۱۴/۷/۳/۱ روز، تشدید اضطراری &lt;۱، علامت TimeBarred ≤۰. نامه دو زبانه → PIM + ترانسمیتال. در پیش‌نمایش دکمه «اجرای نگهبان» به‌جای Cron سیستم.

---

## 1. ClaimNotice ✨

انواع: Initial, Preliminary, Detailed, Followup, Final.  
Reservation of Rights پیش‌فرض true.  
Delivery + Ack. Response deadline از `response_period_days` بند.

بدون `clause_id` ارسال Notice قفل است (D9).

UI 👁️: 09.2 زیر d4-p5؛ نوار هدر d4 برای نزدیک‌ترین due.

---

## 2. Time-Bar Guardian — Python (اجرایی‌نما)

فرض: job روزانه 08:00 به وقت پروژه. محیط Arena: همان تابع از دکمه UI.

```python
from datetime import datetime, timezone, timedelta
from typing import Iterable

LEVELS = ((14, "info"), (7, "warn"), (3, "critical"), (1, "emergency"))

def working_days_left(now: datetime, due: datetime, holidays: set[str], mode: str) -> int:
    if mode == "calendar":
        return (due.date() - now.date()).days
    n, d = 0, now.date()
    end = due.date()
    sign = 1 if end >= d else -1
    cur = d
    while cur != end:
        cur = cur + timedelta(days=sign)
        iso = cur.isoformat()
        if cur.weekday() < 5 and iso not in holidays:
            n += sign
    return n

def guardian_tick(notices: Iterable[dict], now: datetime | None = None) -> list[dict]:
    """Returns EWS events + mutations (time_barred / escalate)."""
    now = now or datetime.now(timezone.utc)
    out = []
    for n in notices:
        if n.get("delivered_at") or n.get("time_barred"):
            continue
        left = working_days_left(now, n["due_at"], set(n.get("holidays") or []), n.get("cal_mode") or "working")
        ev = {"notice_id": n["id"], "claim_id": n["claim_id"], "days_left": left}
        if left < 0:
            ev.update(action="mark_time_barred", ews="EWS-CLM-05", severity="emergency")
        elif left < 1:
            ev.update(action="auto_escalate", ews="EWS-CLM-02", severity="emergency")
        else:
            sev = None
            for thr, s in LEVELS:
                if left <= thr:
                    sev = s
            if sev:
                ev.update(action="warn", ews="EWS-CLM-01" if left <= 3 else "EWS-CLM-00", severity=sev)
            else:
                continue
        out.append(ev)
    return out

# Auto-draft if 50% of notice period elapsed and no body (rule 6 D13):
def maybe_autodraft(n: dict, period_days: int, now: datetime) -> bool:
    used = period_days - working_days_left(now, n["due_at"], set(), n.get("cal_mode") or "calendar")
    return used >= 0.5 * period_days and not n.get("body_fa")
```

EWS:

| کد | شرط |
|---|---|
| EWS-CLM-00 | ≤۱۴ یا ≤۷ |
| EWS-CLM-01 | ≤۳ Critical |
| EWS-CLM-02 | ≤۱ Emergency |
| EWS-CLM-05 | Time-barred + chain of custody audit |

---

## 3. قالب نامه 👁️

تولید دو زبانه: شماره بند، رویداد، Reservation of Rights، امضا.  
ذخیره `dms_doc_id` + `transmittal_id` (PIM موجود — Excel ظرف).

---

## 4. DDL

`db/postgres/rcc/migrations/V009__claim_notice.sql`  
ایندکس جزئی روی `due_at` برای نگهبان.

MVP F5: همین Guardian + لیست Watchlist روزانه.

---

## 5. Loop D10

| Loop | |
|---|---|
| 5 ★ | Notice types + clause + time-bar |
| 7 ★ | Cronنما، ۱۴/۷/۳/۱، escalate&lt;1، barred&lt;0، تقویم، قالب، DMS، شبه‌کد |
| 8 | Watchlist = گزارش روزانه |
| 10 | 📌 claim_register حفظ |

**Gap باقی:** جزئیات Quantum و ۸ روش تأخیر → D11.

منتظر **Deliverable 11**.
