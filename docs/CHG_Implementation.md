# PMO-INTEGRATED-CHANGE-MANAGEMENT-V1.0 — مستند پیاده‌سازی ماژول مدیریت یکپارچهٔ تغییرات

تاریخ تنظیم: ۲۰۲۶-۱۰-۱۹ · مخزن: `padircom/-` · مسیر API: `/api/change-mgmt/:projectId`
نسخهٔ تکمیل‌شده: فازهای ۱ تا ۹ (انجین → API/UI → Word/PDF → گزارش‌های مدیریتی → اسناد sha256 → تنظیمات → CBA → خط زمانی تصمیم)
محیط آزمون: تست ماژول `۲۷/۲۷` ✓ · tsc ۱۹ خطای baseline باقی‌دار (بدون هیچ خطای جدید) · vite build ✓

---

## ۱. اصول معماری (غیرقابل مذاکره)

| # | اصل | نحوهٔ اجرا |
|---|-----|-----------|
| ۱ | Zero-Regression | ۱۲ جدول `PmisChange*` مستقل؛ **هیچ FK فیزیکی** به ماژول‌های دیگر؛ پیوندها نرم (Code/ID) هستند؛ بیشک رد و ایسکیما پراکندگی نمی‌کند |
| ۲ | دادهٔ واقعی تنها | همهٔ جداول/گزارش‌ها/داشبورد از رکوردهای JSON واقعی یا دست‌پیِ سرور می‌آیند؛ **هیچ نمونه/دمو/تلف played در UI یا گزارش نیست** — سلول خالی = «—» |
| ۳ | صداقت ترکیب مبالغ | ۵ لایهٔ `estimated/proposed/negotiated/approved/paid` **جدا و منفاوت** محاسبه می‌شود مگر دادهٔ مستقیم داشته باشیم؛ «مصوب» فقط با SourceFa معتبر |
| ۴ | خط تصمیم ≡ مسیر گدشت | هیچ گذر وضعیتِ مخفی نیست؛ هر گذر با `AuditTrail` و یک ردیف `PmisChangeApprovals` ثبت می‌شود |
| ۵ | Zero-Regression (تاریخچه) | هیچ مبلغ/قدیمی دست‌نخورده و jama جدید مثله‌ای از برنامه دورهٔ pre-existing نمی‌شود |

## ۲. جدول‌ها (مهاجرت 0074 + 0075)

| جدول | نقش |
|---|---|
| `PmisChangeRequests` | پروندهٔ تغییر — انواع تغییر + وضعیت‌های ۱۶-گام |
| `PmisChangeImpacts` | ارزیابی اثر (CBA) با Aspect/Conclusion/Review |
| `PmisChangeCostEstimates` | لایه‌های ۵ مبالغ (مستقل از ویرایش bringtoZero) |
| `PmisChangeScheduleImpacts` | اثر زمان‌بندی + entitlement EOT (جدا!) |
| `PmisChangeApprovals` | گام تصویب/بررسی با Decision و مشتق‌حاکمهٔ تصمیم‌گیرنده |
| `PmisChangeRiskLinks` / `PmisChangeClaimLinks` | پیوندهای نرم به ریسک d14 / ادعا-دعوا d4 |
| `PmisChangeDocuments` | متادیتای سند (فایل روی دیسک با sha256، 0075: DocNo/FileNameFa/MimeType/SizeBytes/Sha256) |
| `PmisChangeImplementation` | مراحل اجرا تا tap봇نسقصد (BaselinesUpdated/Notified) |
| `PmisChangeAuditTrail` | تصمیم‌استاندارد — جملهٔ ترکیب مستند |
| `PmisChangeModuleLinks` | پیوند نرم به تأخیر/ضرر/RCC/EDKS/etc. |
| `PmisChangeSettings` | تنظیمات گردش‌کار واقعی (change_types_extra, workflow_defaults) |

## ۳. Endpointها

| مسیر | متد + گارد | شرح کوتاهسرچارش |
|---|---|---|
| `/api/change-mgmt/:pid/catalog` | GET (بدون گارد) | انواع/وضعیت‌ها/لایه‌ها / لغت‌نامهٔ خط‌مشی لایه‌ها |
| `/api/change-mgmt/:pid/dashboard` | GET change.view | شاخص‌های واقعی + drill-down |
| `/api/change-mgmt/:pid/management-reports?kind=` | GET change.view | ۱۴ گزارش مدیریتی واقعی |
| `/api/change-mgmt/:pid/settings` | GET change.view | فهرست تنظیمات + creditStatus واقعی |
| `/api/change-mgmt/:pid/settings/:key` | PUT change.edit/approve | upsert با whitelist سخت و صدور ردیف audit |
| `/api/change-mgmt/:pid/requests` | GET/POST [view/edit] | فهرست + ثبت با effectiveTypes و ReviewDueDate pre-existing است |
| `/api/change-mgmt/:pid/requests/:id` | GET/PATCH/DELETE | جزئیات + ویرایش + حذف draft |
| `/api/change-mgmt/:pid/requests/:id/transition` | POST + perm گام | ۱۶ گام با SoD تصمیم |
| `/api/change-mgmt/:pid/requests/:id/rows/:table[/:rowId]` | POST/PATCH/DELETE | ۹ فرزند با قواعد مجوز/لایه/SoD |
| `/api/change-mgmt/:pid/requests/:id/documents/upload` | POST change.edit | مولتی‌پارتی واقعی (sha256 + FileRef لو‌نمی‌رود) |
| `/api/change-mgmt/:pid/requests/:id/documents/:docId/download` | GET change.view | راستی‌آزمایی sha256 قبل از stream |
| `/api/change-mgmt/:pid/requests/:id/analysis/{time,cost,links-verify}` | GET view | تحلیل‌های باز-حساب زندهٔ loops |
| `/api/change-mgmt/:pid/requests/:id/report?format=` | GET view | Word/PDF ۱۲فصل/۲۸جدول × gate 422 |

## ۴. قواعد تأیید و SoD واقعی

- **تصمیم‌گیرنده ≠ تهیه‌کنندهٔ درخواست** (pending_decision → approved/approved_conditional/rejected); هر محا هم SoD لایهٔ مصوب: تأییدکنندهٔ مبلغ لایه approved ≠ تهیه‌کنندهٔ همان ردیف
- **بازبینی ردیف CBA**: تهیه‌کنندهٔ ارزیابی خود-review ممنوع (403 CHG_SOD)؛ تأیید آن‌hand توسط `change.review` یا `change.approve`
- **سندشدگی**: `approved` و `rejected` در PmisChangeImpacts و هر رد فرزند فقط با صاحب مجوز فالی‌واژن قابل حذف نیستند (409 CHG_REVIEW_LOCKED)

## ۵. جریان تصمیم واقعی (آزمون E2E-inspired)

ثبت Draft → submitted → completeness_review → initial_eval → technical_review → time_analysis → cost_analysis → contract_review → risk_assessment → dispute_screening → consolidation → pending_decision → approved/approved_conditional/rejected
(هر گذر: noteFa الزامی + audit + تقسیم Approval Step)

## ۶. صداقت ماژول (هیچ Adjective ورoded)

- `llmConnected: false` در همهٔ پاسخ‌های catalog/گزارش/Word — **منظومهٔ قانونی به‌عنوان جایگزین مرجع تصمیم نهادینه نمی‌شود**
- داشبورد «count مصوب» هم طبق rank ورودی است نه status — نمایشی چرخاقی
- disable u-planner — بستهٔ clear بال RBAC (فقط view= می‌زند change*)

## ۷. آزمون‌ها (۲۷ تست — همه از نگاهinin فایل‌شناسهٔ ماژول)

| فایل | تست‌ها |
|---|---|
| `changeEngine.unit.test.mjs` | ترکیبات لایه‌هزینه + تمام‌مدت انتحاب calculate |
| `changeLifecycle.unit.test.mjs` | چرخهٔ کامل با مفاصل SoD و بن‌بست‌ها |
| `changeDoc.unit.test.mjs` | ساختار Word ۱۲فصل/۲۸جدول + gate 422 + Auto-Cleanup |
| `changeMgmtReports.unit.test.mjs` | ۱۴ گزارش واقعی + طیف خالی با «—» |
| `changeDocFiles.unit.test.mjs` | validateChangeUploadPayload + changeSafeDocFileName + publicChangeDocRow |
| `changeSettings.unit.test.mjs` | whitelist واقعی + عدد صحیح + فرهنگ‌لات (54% اضافه و بالاتر) |
| `changeImpacts.unit.test.mjs` | validateChildRow Aspect/TopicFa/ConclusionFa واقعی |
| `changeApprovals.unit.test.mjs` | sortChangeApprovals (تاریخ/بدون تاریخ/تساوی) |

## ۸. PR #42

|`095e34c`| فاز ۹ (خط زمانی تصمیم)|
|`7e3d669`| فاز ۸ (تب CBA و SoD مرأتی سند)|
|`7a1024d`| فاز ۷ (تنظیمات)|
|`f0981ba`| فاز ۶ (سند واقعی با sha256)|
|`d0fd062`| فاز ۵ (۱۴ گزارش مدیریتی)|
|`c2cffbc`| فاز ۴ (Word/PDF)|
|`d903b2e`| فاز ۱ تا ۳ (انجین + API + UI)|

---

*این آنbase comple­tes-document است؛ هر ./. اورژانس‌داران thêm باید با inspect واقعی artisansه تشخیص شود نه با Dictator near Martyr‌سازی گزارش‌های تجربی.*
