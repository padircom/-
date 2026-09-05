# PEX Deliverable 10 — PMS و اندازه‌گیری پیشرفت
خلاصه ۳ خط: وزن مرسوم ایران Cost یا Hybrid. هر WP یک RoC مصوب. Roll-up Step→…→Project. Period Close قفل. فقط پیشرفت Approved در S-Curve و EVM.

D9 بدون بازخورد.

---

## PMSConfig
`WeightMode`: Cost | MH | Hybrid | BOQ | Manual  
Hybrid: `α·Cost + β·MH` با `α+β=1` (پیش‌فرض ایران اغلب α=1 Cost-Based).  
Override دستی وزن: دلیل + نقش PMO + Audit.

کنترل Σ وزن فرزندان = ۱ (D3).

## فرمول وزن
Cost: `w = BAC_i / Σ BAC`  
MH: `w = MH_i / Σ MH`  
BOQ: مبلغ ردیف / جمع  
Hybrid: `w = α w_c + β w_h` سپس نرمال.

Physical%_activity = Σ (stepWeight × step%_approved) طبق RoC.  
Physical%_parent = Σ (w_child × Physical%_child).

Planned% at DataDate = EV-plan از PMB زمانی / BAC  یا qty plan early/late.

## Rule of Credit Library (نمونه)

**بتن (CIV-CONC):**  
1 قالب 15%  2 آرماتور 25%  3 بتن‌ریزی 40% (IR)  4 بازکردن قالب 10%  5 عمل‌آوری 10%  Σ=100

**فولاد سازه:**  
Shop 20 · حمل 10 · نصب 40 (IR) · پیچ/جوش 20 · رنگ 10

**پایپینگ:**  
Spool 15 · نصب 30 · جوش 25 (IR) · تست 20 (IR) · عایق/رنگ 10

**کابل:**  
کشش 40 · سرسیم 25 (IR) · تست 25 (IR) · ترتیبی 10

هر Step: InspectionRequired bool. بدون IR Pass نمی‌توان step را 100% Approved کرد.

روش پیشرفت فعالیت: Units | Steps(RoC) | Milestone | LOE | Apportioned | Manual(دلیل).

## Roll-up قطعی
```
step approved % 
  → activity physical %
    → WP (weight)
      → CA
        → WBS parents
          → Project
```
بدون پرش سطح. Summary WBS از فرزندان است نه ورود مستقیم.

## S-Curve
Planned Early, Planned Late, Actual Approved, Forecast. نقطه DataDate. خروجی Excel گروه‌بندی.

## Variance
Start/Finish var vs BL؛ % var = ActualApproved − Planned%_at_DD. آستانه → Alert Progress + Workflow 3.

## Period Close
Status Closed → ProgressSnapshot + EVMSnapshot immutable. تغییر گذشته فقط Adjustment با دلیل و نقش Admin/PMO. Open مجدد ممنوع بدون Admin.

## Workflow پیشرفت
Site Submit → Review → Approve (= Workflow 2).

## Self-Validation D10
L1 Scope/Schedule control ✓ · L2 Milestone method مجاز برای دروازه ✓ · L3 — · L4 Progress alerts ✓ · L5 ★ Cost/Hybrid، RoC بتن/فولاد/لوله/کابل، Roll-up، Period Close، Planned%@DD، EVM immutable، SPI_t در D7 ✓ · L6 PMS Excel · L7 RoC JSON=D2 · L8 roll-up SQL تجمیعی · L9 Close lock.

**Gap:** کتابخانه کامل‌تر (خاکی، رنگ، مکانیکال نصب) در seed F2. α پیش‌فرض کارگاه با PMO ایران.
