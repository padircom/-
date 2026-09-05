# PEX Deliverable 7 — Cost / EVM Engine
خلاصه ۳ خط: PMB از Baseline قفل. EV فقط از Progress Approved (PMS). Snapshot پس از Period Close غیرقابل ویرایش. چهار روش EAC + Earned Schedule. Excel ظرف است.

D6 بدون بازخورد.

---

## Budget / PMB
TimePhasedBudget: Activity × Resource × Period × Rate × Qty → PV(t).  
BAC = Σ PMB. Class estimate 1–5 جدا از Budget مصوب. ارز چندگانه + شاخص Escalation JSONB روی CostEstimate.

## Actual / Commitment
CostActual از Timesheet (نرخ×ساعت Approved)، Invoice، Material Issue، Equipment، Subcon.  
Commitment = PO/Subcon باز. Accrual اختیاری در Ledger.

## فرمول EVM (Data Date)
- PV = Σ PMB تا DataDate (تقویم)
- EV = Σ (BAC_i × Physical%_i_Approved)  یا earned qty × rate طبق PMS
- AC = Σ Actual تا DataDate
- SV = EV−PV ، CV = EV−AC
- SPI = EV/PV (PV=0 → null) ، CPI = EV/AC
- VAC = BAC−EAC ، ETC = EAC−AC
- TCPI_BAC = (BAC−EV)/(BAC−AC) ، TCPI_EAC = (BAC−EV)/(EAC−AC)

### Earned Schedule
ES = t + (EV−PV_t)/(PV_{t+1}−PV_t) در واحد دوره.  
SPI(t) = ES / AT  (AT = زمان واقعی از شروع تا DataDate)

### EAC چهار روش
1. `EAC_cpi = BAC / CPI`  
2. `EAC_cpi_spi = AC + (BAC−EV)/(CPI×SPI)`  
3. `EAC_manual` ورود CAM  
4. `EAC_bottomup = AC + Σ ETC_activity`  
ForecastMethod پروژه روش پیش‌فرض را قفل می‌کند؛ تغییر با Audit.

Snapshot Immutable: INSERT فقط؛ اصلاح با Adjustment دوره بعد.

## Variance Workflow
|ΔSPI or |CV| > آستانه ProjectConfig → CAM توضیح → PMO → در صورت نیاز CR (Workflow 3). Auto-Alert EVM: SPI<0.9، CPI<0.9، EAC>BAC.

## Ledger
ستون‌ها: Budget, Committed, Actual, Accrued, Forecast per CA/WBS.

## Cash Flow
In/Out Plan vs Actual per period. اتصال IPC (صورت‌وضعیت) به CostActual Source=Invoice + DMS.

## Reserve
Contingency (CAM) و Management (PMO). Draw با دلیل + CR برای Management.

## شبه‌کد دوره
```
if period.closed: reject mutate actuals
ev = pms.approvedEarnedValue(dataDate)
pv = pmb.cumulative(dataDate)
ac = ledger.actual(dataDate)
es = earnedSchedule(ev, pvCurve)
insert EVMSnapshot(...) immutable
if spi<0.9 or cpi<0.9: alert
```

## Self-Validation D7
L1 Cost کامل ✓ · L2 جریمه Milestone پول جدا از EAC ✓ · L3 EndDateSlip ≠ CV ✓ · L4 EVM alerts ✓ · L5 EV از PMS Approved ✓ SPI_t ✓ immutable ✓ · L6 S-curve هزینه در D11 · L7 نام Snapshot=D2 · L8 محاسبه async اگر N بزرگ · L9 Period Close + Snapshot lock.

**Gap:** نرخ ارز روزانه — جدول FxRate F3. IPC کامل با Finance ماژول — رابط. آستانه 0.9 پیکربندی JSON AlertRule.
