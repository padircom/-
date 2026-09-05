# PEX Deliverable 5 — Milestone Tracking (مستقل)
خلاصه ۳ خط: Milestone روی Activity پرچم‌دار است اما سرویس/گزارش/هشدار جدا دارد. ۷ قاعده هشدار. جریمه/پاداش تجمعی. تاریخ فقط با CR در History. ۱۰ گزارش A4.

D4 بدون بازخورد. ForecastDate = EF از CPM (D4).

---

## مدل (تکمیل D2)
نگاه D2. **EscalationLevels JSONB نمونه:**
```json
[
  { "level": 1, "afterDays": 0, "role": "planner" },
  { "level": 2, "afterDays": 3, "role": "project_manager" },
  { "level": 3, "afterDays": 7, "role": "client_pmc" }
]
```
تغییر Contractual/Baseline/Forecast بدون CR → 409؛ History اجباری با Reason + LinkedCRId.

وضعیت خودکار:
- Achieved اگر ActualDate پر باشد
- Delayed اگر امروز > Contractual و Actual تهی
- AtRisk اگر Forecast > Contractual یا روی CP با TF<0
- وگرنه OnTrack
- Cancelled دستی

## نمونه واقعی
پروژه OG-2401 | `MS-MECH-RFSU` Type=Contractual Priority=Critical  
Contractual 1403/11/15 | BL 1403/11/15 | Forecast از CPM 1403/11/28  
PenaltyPerDay 25,000 USD | BonusPerDay 10,000 | AlertDaysBefore [30,14,7,3,1]  
OwnerOrg=Contractor | Deliverable=Mechanical RFSU dossier (DMS).

اگر DataDate=1403/11/20 و Actual تهی → Overdue ۵ روز → Penalty = 5×25000 = 125,000 (تقویم قراردادی روز تقویمی مگر بند بگوید working).

---

## موتور هشدار ۷ قاعده
| # | شرط | AlertType | Severity |
|---|---|---|---|
| 1 | Contractual و Forecast > Contractual | AtRisk | Warning |
| 2 | DaysToTarget ≤ AlertDaysBefore[i] | Approaching | Info→Warning با i |
| 3 | Actual null و Contractual < TODAY | Overdue | Critical |
| 4 | روی CP و TF<0 | Critical | Emergency |
| 5 | Overdue روز > آستانه سطح | Escalated | level++ |
| 6 | PenaltyClause و Overdue | (محاسبه Ledger) + Critical | |
| 7 | Actual set | Achieved | Info |

Idempotent per (MilestoneId, Type, Level, Date). Ack اجباری برای Critical+.

جریمه تجمعی: `days = calendarDiff(Contractual, min(Actual, TODAY))` اگر مثبت؛ پاداش اگر Actual < Contractual و BonusPerDay.

---

## ۱۰ گزارش مستقل — فیلدها
خروجی هر کدام: Excel/Word/PDF A4 + در صورت نمودار PNG/SVG. Internal + External.

1. **Register:** Code, Name, Type, Owner, Priority, Contractual, BL, Forecast, Actual, Status, TF, OnCP, PenaltyEst, DMS link  
2. **Status Report:** شمارش OnTrack/AtRisk/Delayed/Achieved/Cancelled + لیست  
3. **Trend Chart:** زمان × Forecast vs Contractual per MS  
4. **Variance:** BL−Forecast، BL−Actual، Contractual−Forecast (روز)  
5. **Penalty/Bonus:** Days, Rate, Amount, ClauseId, YTD  
6. **Heat Map:** محور Priority × Status تعداد  
7. **Timeline Gantt:** فقط Milestones + DataDate  
8. **Overdue Alert Report:** Overdue, EscalationLevel, Unacked  
9. **Upcoming 30d:** DaysToTarget, Approaching level  
10. **Dashboard Widget:** KPI تعداد Delayed، مجموع Penalty برآوردی، next 5 upcoming — ویجت صفحه d2 نه سایدبار اصلی

---

## Self-Validation D5
| Loop | |
|---|---|
| 1 | Integration/Comms از طریق DMS و گزارش |
| 2 Milestone ★ | Types، Penalty/Bonus، AlertDays، Escalation، History+CR، ۱۰ گزارش، Widget، Forecast از CPM، Status خودکار، جریمه ✓ |
| 3 | Rule 4 لینک CP |
| 4 | ۷ قاعده زیرمجموعه AlertRule category=Milestone |
| 5–6 | پیشرفت Milestone از PMS جدا؛ گزارش دو قالب D11 |
| 7 | Status enum = D2 |
| 8 | Job روزانه rules 2–6 |
| 9 | تغییر تاریخ = permission + CR + Audit |

**Gap:** کانال SMS در D12. واحد روز جریمه تقویمی vs کاری — پیش‌فرض تقویمی؛ بند در Clause JSON. UI ویجت F2 PEX.
