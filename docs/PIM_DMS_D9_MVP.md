# Deliverable 9 — فازبندی و MVP
خلاصه: فاز ۱ = EDMS قابل استفاده روی پوسته فعلی Arena بدون تغییر فونت/تم. Excel ظرف است. API نازک روی Express+SQL. ۶–۸ هفته.

---

## فازها
| فاز | مدت | محتوا |
|---|---|---|
| **1 MVP** | ۶–۸ هفته | MDR، شماره/رزرو، Revision+فایل، Workflow C1–4 ساده، Transmittal، نامه، Lessons، Excel A/B/C اولیه، جستجوی facet، ۴ KPI، ABAC پایه، Audit insert |
| **2** | ۴ هفته | OCR job، Watermark PDF، Escalation تقویم کاری، Webhook، OpenAPI، Virus scan |
| **3** | ۴ هفته | FTS سنگین، Retention cold، Proxy چندپروژه، گزارش ۱۵ کامل |

خارج از MVP: microservice، PostgreSQL، تغییر سایدبار اصلی.

---

## User Stories فاز ۱ (≥20) — SP نسبی

1. **ورود به حوزه d1**  
   به‌عنوان کاربر پروژه، از سایدبار اصلی فقط ۵ سرتیتر را می‌بینم و با «ورود به صفحه حوزه» صفحه بعد باز می‌شود.  
   AC: سایدبار اصلی بدون آیتم اکسل/شماره/WF. صفحه بعد زیرفرآیندها را نشان می‌دهد.  
   SP: 3

2. **مشاهده MDR**  
   AC: جدول کد/عنوان/دیسپلین/نسخه/وضعیت؛ فیلتر پروژه جاری. صفحه‌بندی.  
   SP: 5

3. **ثبت مدرک**  
   AC: TitleFa/En اجباری؛ شماره دستی یا از رزرو؛ Status=Draft؛ Audit.  
   SP: 5

4. **رزرو شماره**  
   AC: الگوی PROJ-DISC-TYPE-SEQ؛ بدون شماره تکراری زیر بار همزمان.  
   SP: 8

5. **مصرف رزرو**  
   AC: سند با همان شماره؛ رزرو Consumed؛ انقضا بدون برگشت SEQ.  
   SP: 3

6. **آپلود Revision**  
   AC: فایل Evidence+checksum؛ MIME allowlist؛ نسخه جدید.  
   SP: 5

7. **دانلود با Watermark ساده** (متن روی نام فایل/هدر اگر PDF کامل نرسید)  
   AC: raw فقط DC و Audit.  
   SP: 5

8. **شروع گردش IFA**  
   AC: Instance+Task برای Consultant طبق Def.  
   SP: 8

9. **ثبت Code 1–4**  
   AC: C2/C3 بدون CommentSheet رد؛ وضعیت سند مطابق D2/D5.  
   SP: 5

10. **لیست کارهای من**  
    AC: `/me/tasks`؛ overdue مشخص.  
    SP: 3

11. **ترانسمیتال**  
    AC: ایجاد با چند Revision؛ Sent؛ Ack.  
    SP: 5

12. **نامه اقدام‌دار**  
    AC: DueDate؛ گزارش باز.  
    SP: 5

13. **درس‌آموخته**  
    AC: ثبت/فهرست دوزبانه.  
    SP: 2

14. **Excel قالب (A)**  
    AC: آپلود قالب؛ MappingSchema ذخیره؛ `_META`.  
    SP: 8

15. **Excel ورود (B)**  
    AC: خطا سلول‌محور؛ بدون Commit اگر error و partialAllowed=false.  
    SP: 8

16. **Excel خروجی (C)**  
    AC: Round-trip هدر حفظ؛ داده از DB.  
    SP: 5

17. **جستجوی Facet**  
    AC: disc/status/q؛ ABAC؛ Secret دیده نشود.  
    SP: 5

18. **داشبورد KPI**  
    AC: Cycle, Reject, MDR count, S-curve نمونه.  
    SP: 5

19. **گزارش MDR Excel**  
    AC: ظرف از قالب؛ فیلتر پروژه.  
    SP: 3

20. **ABAC 403**  
    AC: پروژه خارج از scope حتی با UUID حدس‌زده 403/404.  
    SP: 5

21. **Audit append-only**  
    AC: INSERT فقط؛ Hash پر شود (chain کامل می‌تواند stub فاز1).  
    SP: 3

22. **آفلاین صف**  
    AC: اقدام UI در syncQueue اگر API قطع.  
    SP: 5

23. **دوزبانه Fa/En**  
    AC: همه برچسب‌های d1 از t()/Bi. فونت Vazirmatn.  
    SP: 2

24. **عدم شکست پوسته**  
    AC: index.css و سایدبار اصلی بدون آیتم جدید.  
    SP: 2

مجموع حدود **۱۰۸ SP** → با ۲ نفر ≈ ۷ هفته (velocity ~16 SP/w).

---

## Definition of Done
- AC داستان سبز
- ABAC روی API نه فقط UI
- Envelope خطا دوزبانه
- بدون تغییر ظاهر سراسری
- Audit برای create/issue/act/import
- تست حداقل: شماره همزمان، import خطادار، IDOR project

---

## Self-Validation D9
Loop1: MVP شامل MDR, Excel 3 سناریو، شماره، WF code، TR، lessons، bilingual، audit، آفلاین صف ✓ ۳۳ نوع سند = داده مرجع نه همه UI در فاز1  
Loop2: داستان‌ها با endpoint D8 و Entity D2 جورند ✓  
Loop3: ۶–۸ هفته با برش بالا واقع‌بینانه است ✓ موتور WF کامل تقویم فاز2 ✓  
Loop4: IDOR و upload در داستان ۲۰ و ۶ ✓ ویروس فاز2  
Loop5: فاز1 Communications/Quality از نامه و NCR type؛ بقیه حوزه از Type در MDR  

Gap صریح فاز1: OCR، ClamAV، hash-chain verify job، OpenAPI.

---

# گزارش نهایی کیفیت (پس از D1–D9)
| معیار | نتیجه |
|---|---|
| Completeness پرامپت | ۹ Deliverable در `docs/PIM_DMS_D*.md` |
| Excel SoT نشده | اصل طلایی در D1/D3/UI |
| سایدبار اصلی | بدون خدشه؛ زیرماژول فقط صفحه d1 |
| سازگاری Arena | SQL Server + Express + Vazirmatn |
| امنیت | RBAC+ABAC طراحی شد؛ ویروس/OCR عقب‌افتاده مستند |
| امکان MVP | ۱۰۸ SP / ۶–۸ هفته |

فایل‌ها: D1 Architecture … D9 MVP.
