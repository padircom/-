# PEX Deliverable 6 — Critical Path Analysis & Alerts (مستقل)
خلاصه ۳ خط: هر Data Date یک Snapshot. FloatTrend per Activity. Near-CP آستانه پروژه. ۹ قاعده هشدار. DCMA 14 امتیاز HealthScore. ۱۰ گزارش جدا از Milestone.

D5 بدون بازخورد. CPM اعداد از D4؛ اینجا پایش و هشدار.

---

## مدل عملیاتی
پس از `computeCPM`:
1. Insert CriticalPathSnapshot (طول CP، BL طول، Drift، End dates، HealthScore)
2. Insert CriticalPathActivity برای TF≤threshold یا IsCritical
3. Upsert FloatTrend نسبت به Snapshot قبلی
4. ارزیابی ۹ قاعده → CriticalPathAlert در صورت تغییر وضعیت (idempotent)

**نمونه OG-2401 DataDate 2026-09-04**  
CPLength 412 روز کاری | BL 400 | Drift +12 | End_CP 1404/04/20 vs BL 1404/04/02  
PIP-ISO-012 TF=0 OnCPSince 1403/10/01 | ELE-SLD-007 TF=6 Near | FloatChange -4 Declining

NearCriticalConfig پیش‌فرض: Warn TF≤10، Crit≤5، Emerg≤0؛ Drift Warn 5 / Crit 10.

---

## ۹ قاعده هشدار
| # | شرط | Type | Severity |
|---|---|---|---|
| 1 | TF < 0 | FloatNegative | Critical |
| 2 | ΔTF < −Threshold | FloatDecreasing | Warning |
| 3 | CPDrift > DriftThreshold | CPDrift | Warning/Critical |
| 4 | فعالیت جدید در CP | NewCritical | Warning |
| 5 | End_CP > End_BL | EndDateSlip | Critical |
| 6 | HealthScore < 80 | HealthDrop | Warning |
| 7 | Near و TF < Warn | (Near warning) | Warning |
| 8 | Near → Critical | Escalation | Critical |
| 9 | Contractual Milestone روی CP و TF<0 | Emergency | Emergency + Auto-Escalate به Milestone Rule 4/5 |

تضاد با D5: یک رویداد دو Alert جدا (دسته CP و Milestone) با LinkedActions متقابل — تکرار پیام با همان severity مجاز؛ Dashboard ادغام می‌کند.

SuggestedAction نمونه Rule1: «فشرده‌سازی مسیر / منابع / CR مدت».

---

## DCMA 14 — امتیاز
هر بند 0 یا 100 (یا نمره نسبی 0–100). HealthScore = میانگین وزن‌دار (وزن پیش‌فرض برابر).

| # | آزمون | Fail اگر |
|---|---|---|
| 1 Missing Logic | >5% فعالیت بدون Pred یا Succ (به‌جز start/end) |
| 2 Negative Lag | هر Lead |
| 3 High Float | TF>44d بیش از 5% |
| 4 High Duration | Dur>44d بیش از 5% |
| 5 Hard Constraints | Must/SNLT… >10% |
| 6 Rel Density | rels/activities خارج 0.5–2.0 (پیکربندی) |
| 7 Lags | lags >5% rels |
| 8 Invalid Dates | Actual > DataDate یا ES<DataDate inconsistent |
| 9 Resources | CP بدون ResourceAssignment |
| 10 Missed Tasks | Should-have-finish < DataDate و incomplete |
| 11 CPLI | CP_BL / CP_now < 0.95 |
| 12 BEI | #completed BL-on-or-before DD / #BL-should-complete |
| 13 CP Test | وجود مسیر TF≤0 از start تا end |
| 14 TF hist | تمرکز غیرعادی (مثلاً >40% در یک سطل) |

---

## ۱۰ گزارش مستقل
1. CP Report: ActId, Name, Dur, ES/EF, TF/FF, OnCPSince  
2. Near-Critical: TF < threshold  
3. Float Trend: نمودار TF در زمان per Act  
4. CP Drift Chart: CPLength vs BL per period  
5. End Date Forecast Trend  
6. CP Gantt: فقط CP+Near  
7. Schedule Health DCMA 14 با نمره  
8. Float histogram تمام فعالیت‌ها  
9. Change Log: وارد/خارج CP vs snapshot قبل  
10. Emergency Alert Report: Unacked Critical+

فرمت: Excel/Word/PDF A4 + PNG/SVG. دو قالب Internal/External (جزئیات D11).

---

## Self-Validation D6
Loop1 Schedule control ✓ · Loop2 Rule9 به Milestone ✓ · Loop3 ★ هر ۱۰ مورد چک‌لیست پرامپت ✓ · Loop4 دسته CP در AlertRule ✓ · Loop5 پیشرفت Approved در گانت نه در شناسه CP ✓ · Loop6 گزارش‌ها ✓ · Loop7 نام Snapshot=D2 ✓ · Loop8 Job بعد CPM ✓ · Loop9 Alert ack + RBAC.

**Gap:** وزن DCMA سفارشی در ProjectConfig. محاسبه BEI نیاز BL dates (D4). SMS در D12.
