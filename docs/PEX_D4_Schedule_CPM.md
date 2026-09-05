# PEX Deliverable 4 — Schedule / CPM Engine
خلاصه ۳ خط: تقویم‌آگاه. Forward/Backward + Float. CP و Near-CP. Baseline قفل با CR. >20k فعالیت Job async. What-if فقط Sandbox.

D3 بدون بازخورد.

---

## Activity Register
انواع: Task, Milestone, LOE, WBSSummary, FinishMilestone.  
فیلدها مطابق D2 + RemainingDuration، ActualStart/Finish، CalendarId، Constraint، ExternalIdP6/Msp.

## Relationships
FS/SS/FF/SF + LagHours (منفی=Lead). ممنوع حلقه. DCMA: Lead و Missing Logic گزارش می‌شود نه همیشه بلاک.

## Calendar
WorkWeek JSONB روز/شیفت. Exception: تعطیلات ایران + ExtraWork.  
`addWorking(start, hours)` از روی شیفت نه 24h.

## CPM — الگوریتم
توپولوژیک Kahn. اگر cycle → `CPM_CYCLE` لیست یال.

**Forward (ES, EF):**  
- بدون pred: ES = max(DataDate constraint, Calendar start)  
- FS: ES = addWorking(pred.EF, lag)  
- SS: ES = addWorking(pred.ES, lag)  
- FF: EF = addWorking(pred.EF, lag)؛ ES = subWorking(EF, dur)  
- SF: ES = addWorking(pred.ES - wait via EF of pred? SF: succ.ES from pred.EF inverse)  
  SF: succ.ES = addWorking(pred.ES, lag) wait standard: SF successor start from pred finish...  
  Standard: SF: successor finish-to-pred start: ES_s = addWorking(pred.ES, lag) - dur handled via EF link: EF_s = addWorking(pred.ES, lag); ES_s = subWorking(EF_s, dur).

Constraint: SNET max(ES, date), SNLT min, Must overwrite با پرچم Hard، ALAP در backward.

**Backward (LS, LF):** از sink LF=max EF یا MustFinish.  
TF = LS-ES (working). FF = min(succ.ES) - EF.

**Critical:** TF <= 0 (یا آستانه 0). Near-Critical: 0 < TF ≤ NearCriticalConfig.Warning (پیش‌فرض ۱۰ روز کاری).

**Async:** N>20000 → queue `cpm.compute`؛ نتیجه در Activity + CriticalPathSnapshot (D6 جزئیات هشدار).

### شبه‌کد
```
function computeCPM(project, dataDate):
  G = topo(activities, rels) or fail CYCLE
  for n in G:
    es = calendarMax(preds, relType, lag, constraints, dataDate)
    n.ES, n.EF = es, addWorking(es, n.duration)
  for n in reverse(G):
    lf = calendarMin(succs, ...)
    n.LF, n.LS = lf, subWorking(lf, n.duration)
    n.TF = workingDiff(n.LS, n.ES)
    n.FF = freeFloat(n)
    n.IsCritical = n.TF <= 0
    n.IsNearCritical = n.TF > 0 and n.TF <= threshold
  persist snapshot
```

## Gantt
میله Baseline زیر Actual، Data Date خط، Progress line از Approved % فقط. رنگ P6. در iframe/صفحه d2 نه سایدبار اصلی.

## Baseline
چند نسخه. Approved→Locked. تغییر تاریخ BL فقط CR + Workflow 1. کپی از current activities.

## Update & Period Close
ScheduleUpdate.DataDate. Close → ProgressPeriod lock (D10). گذشته فقط Adjustment.

## Look-ahead
1/2/3/4/6 هفته. PPC = completed planned / planned. هشدار PPC<80% از AlertService.

## DCMA 14-Point (امتیاز 0–100 میانگین)
1 Missing Logic  2 Negative Lag  3 High Float>44d  4 High Duration>44d  
5 Hard Constraints  6 Relationship Density  7 Lags count  8 Invalid Dates  
9 Resources missing on CP  10 Missed Tasks  11 CPLI  12 BEI  
13 Critical Path Test  14 TF distribution  
هر مورد Pass/Fail وزن‌دار؛ HealthScore روی Snapshot.

## What-if Sandbox
کپی Project slice → تغییرات آزاد → CPM مقایسه EndDate/TF. Commit به live ممنوع مگر CR.

## Self-Validation D4
| Loop | نتیجه |
|---|---|
| 1 Schedule PMBOK | Define, sequence, duration, develop, control, float |
| 2 Milestone | IsMilestone فعالیت؛ ForecastDate از EF در D5 |
| 3 CP | شناسه CP اینجا؛ هشدار ۹قاعده D6 |
| 4 Alert | HealthDrop/PPC می‌تواند fire |
| 5 PMS | % گانت فقط Approved |
| 6 Report | Gantt تصویر در D11 |
| 7 Consistency | Constraint enum = D2 |
| 8 Feasibility | async 50k؛ تقویم ایران Exception |
| 9 Security | Baseline lock permission؛ sandbox جدا |

**Gap:** جزئیات ۹ هشدار CP → D6. موتور واقعی کد F1. XER parser F1 ImportExport. Lead منفی: DCMA fail نه منع سخت (قابل پیکربندی).
