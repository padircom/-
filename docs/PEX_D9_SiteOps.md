# PEX Deliverable 9 — Site Operations
خلاصه ۳ خط: داده در نقطه تولید (سایت). DPR/IR آفلاین با تعارض‌سنج. پیشرفت DPR تا Approve وارد PMS نمی‌شود. Punch Cat A مانع Handover. لینک DMS برای Evidence ادعا.

D8 بدون بازخورد.

---

## Work Authorization → Work Order
CAM→PM: بازه WBS/Activity مجاز. WO به تیم/پیمانکار با Qty، Location، RoC steps. بدون WA نمی‌توان WO را Issue کرد (F4 hard؛ F1 هشدار).

## DPR
فیلدها: تاریخ، شیفت، هوا، Manpower by Trade، Equipment، مصالح دریافت/مصرف، خطوط پیشرفت Activity×Location×Qty×Step، توقف Cause×Hours×Responsible، ایمنی، عکس GPS JSONB، EvidenceDmsId.  
ثبت‌نشده بعد از ۲۴h → Alert DPR.  
تأخیرات → DelayRegister (ادعا).

## IR
ارجاع ITP/DMS. نتیجه Pass/Fail/Hold. Fail می‌تواند NCR (ماژول کیفیت رابط).

## Punch
A/B/C. Cat A باز نزدیک Handover → Alert Punch. بستن با IR.

## Site Instruction
دستور کارگاه؛ اگر اثر زمان/هزینه → لینک اجباری CR/Claim.

## PTW
رابط HSE: وضعیت Permit قبل از WO پرخطر.

## Handover
MC → Pre-Comm → Comm → Provisional → Final. چک‌لیست Deliverable + Punch A=0.

## Mobile PWA
فقط DPR + IR + Punch. صف local؛ syncQueue.  
تعارض: همان Activity+Date+Step دو Qty مختلف → Conflict UI (نه Last-Write-Wins). برنده = Reviewer سایت.

## جریان پیشرفت
```
DPR line Draft → Site Submit → Reviewer → Approved
Approved qty → ActivityStep → PMS roll-up
```
Unapproved در گانت/EVM نیست.

## Self-Validation D9
L1 Quality IR/Punch/ITP ✓ Comms DPR ✓ Integration WA ✓ · L2 Handover به Milestone Achieved می‌تواند لینک شود · L3 — · L4 DPR/Punch alerts ✓ · L5 فقط Approved ✓ · L6 عکس در گزارش روزانه D11 · L7 وضعیت WO با Workflow 4 · L8 PWA sync عملی با صف موجود · L9 PTW و WA permission.

**Gap:** GPS دوربین واقعی دستگاه. SMS. HSE کامل خارج PEX. Conflict UX F4.
