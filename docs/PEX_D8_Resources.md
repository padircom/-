# PEX Deliverable 8 — Resource Management
خلاصه ۳ خط: استخر Labor/Equipment/Material/Subcon. تخصیص Activity×Curve. Timesheet با Approve تا وارد AC شود. کمبود مصالح قبل از Need Date. Leveling فقط در Sandbox مگر CR.

D7 بدون بازخورد.

---

## Resource Pool
نوع، Trade، واحد، نرخ، تقویم، موجودی/تعداد. ExternalId برای P6.

## Assignment
Activity × Resource × Qty × Curve JSONB (linear, front, back, bell). Remaining = f(Approved progress). Over-allocation: Σ assigned hours در تقویم > MaxUnits → Alert Resource.

## Timesheet
ورود ساعت per Activity/Day. Workflow Submit→Approve. فقط Approved به CostActual و Manhour EV. آفلاین صف syncQueue با تداخل زمان (نه LWW): اگر دو Approve مختلف → Conflict.

## Equipment Log
Work/Idle/Down/Fuel per day. Utilization = Work/(Work+Idle+Down). هشدار Utilization<60% یا Down>آستانه.

## Material
Requirement: NeedDate از ES−lead.  
Transaction: Receipt/Issue/Return/Transfer.  
Balance = Receipt−Issue+Return±Transfer.  
Look-ahead: اگر Balance@NeedDate < Required → Alert Shortage (N روز قبل، پیکربندی).

Status Report فیلدها: Required, Ordered (Commitment), Delivered, Issued, Balance, NeedDate, Activity.

## Manpower Plan
Trade × Period Headcount Plan vs Actual (از Timesheet). Histogram P6-like.

## Productivity
Actual units / MH vs estimate. <80% نرم → Alert Productivity.

## Leveling
Smoothing در What-if Sandbox (D4). اعمال به live فقط CR. الگوریتم: شیفت در TotalFloat؛ اگر TF ناکافی fail.

## Self-Validation D8
L1 Resource ✓ · L2 OwnerOrg جدا از Resource ✓ · L3 CP بدون تخصیص = DCMA#9 ✓ · L4 دسته Resource alerts ✓ · L5 MH وزن PMS از همین نرخ/ساعت ✓ · L6 Histogram گزارش D11 · L7 نام جداول=D2 · L8 هیستوگرام ۵۰k assignment تجمیع SQL نه UI · L9 Timesheet approve permission.

**Gap:** Leveling heuristic ساده F6. GPS تجهیزات فاز بعد. واحد مصالح چندواحدی — Conversion JSONB روی Resource.
