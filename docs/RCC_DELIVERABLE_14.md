# RCC Deliverable 14 — RBAC + Rules + API + Reports + MVP + Migration

خلاصه ۳ خطی: نقش‌ها روی Auth فعلی سوار می‌شوند نه سایدبار جدید. ۲۰ قاعده کسب‌وکار. MVP = F1 ثبت ریسک+اکسل و F5 نگهبان Notice. مهاجرت V001–V012 بدون DROP جداول 📌. پس از این تحویل، پیاده‌سازی UI فقط با دستور جدا.

---

## 1. RBAC (ماتریسی)

نقش‌ها نسبت به `AuthContext` موجود (گسترش کد بعداً): Sponsor, PMO, PM, RiskMgr, ContractMgr, Legal, CAM, ChangeCoord, CCB, Site, ClientRep, Auditor.

حوزه: Risk / Change / Claim / Reports — CRUD اتمی.

نمونه: Site = Risk identify + Issue؛ CCB = decide CR؛ Legal = dispute؛ Auditor = read-all + audit_log.

👁️ منوی کاربر هدر موجود؛ بدون آیتم سایدبار.

---

## 2. بیست قاعده

**Risk (6):** Owner اجباری قبل از close؛ Response قبل از accept؛ Occurred→Issue؛ Secondary ثبت جدا؛ Reserve tx فقط با ledger؛ Score از پلن.

**Change (5):** Impact قبل از CCB؛ Justification رأی؛ Emergency post-facto ظرف N روز؛ BL immutable؛ سقف اختیار.

**Claim (7):** بند قبل از Notice؛ سه محور قبل از بسته؛ Guardian روزانه؛ TimeBarred قفل ارسال؛ روش تأخیر صریح؛ Quantum با docs؛ Settlement با CR.

**Cross (2):** RCC ننوشتن SPI/Approved؛ Auto-Suggest فقط پیش‌نویس.

---

## 3. API (گروهی — ۴۵+)

| گروه | نمونه |
|---|---|
| Items | GET/POST `/rcc/items` |
| Risk | `/rcc/risks` assess, respond |
| Reserve | `/rcc/ledgers` `/transactions` |
| Change | `/rcc/crs` impact ccb |
| Claim | `/rcc/claims` notices guardian/run |
| Clause | `/rcc/clauses?q=` FTS |
| Chain | `/rcc/chain` |
| Suggest | `/rcc/suggests` |
| Reports | `/rcc/reports/:code` |
| Excel | `/rcc/excel/import` preview confirm |

JWT از پشته موجود. Rate-limit مثل API فعلی. Webhook: notice-due, cr-decision, time-barred.

---

## 4. ۱۸ KPI (کد / ایده فرمول)

RSK-01 Open high count · RSK-02 Mean score · RSK-03 Response coverage% · RSK-04 Reserve health · RSK-05 Review overdue%  
CHG-01 Cycle days · CHG-02 Approval rate · CHG-03 Emergency% · CHG-04 Cost delta vs BAC (read) · CHG-05 BL versions  
CLM-01 Open claims · CLM-02 Time-bar watch · CLM-03 Notice on-time% · CLM-04 Quantum vs settled · CLM-05 EOT days  
RCC-01 Chain completeness · RCC-02 Suggest accept% · RCC-03 Cross-module lag

## ۱۲ EWS

علاوه بر EWS-CLM-00/01/02/05: RSK depletion، CHG authority breach، SPI/CPI AS-01/02، NCR-30d، milestone-15d، review overdue، unacked issue، concurrent delay.

---

## 5. ۱۷ گزارش + Excel

Risk×4، Change×5، Claim×5 (شامل Watchlist روزانه)، Integrated: RPT-RCC-01 دوهفتگی ۱۰بخش، RPT-RCC-02 Chain، RPT-EXEC یک‌صفحه.

Excel ظرف: ۲۱ قالب (۵+۵+۷+۴). Pipeline Load→Map→Validate→Preview→Confirm مثل PIM.

---

## 6. MVP — User stories (فشرده)

**F1:** ثبت ریسک C-E-E، RBS، ماتریس از پلن، Excel import، Owner اجباری.  
**F5:** Notice از بند، Guardian دکمه+لیست ۱۴/۷/۳/۱، TimeBarred، پیش‌نویس نامه.

AC نمونه: Guardian با due دیروز → EWS-CLM-05 و `time_barred=true`.  
DoD: بدون نوشتن projectControls؛ آزمون دستی روی OG-2401؛ سایدبار اصلی بدون آیتم جدید.

۲۵+ استوری در بک‌لاگ فازها (F1–F8) پوشش داده می‌شود؛ اولویت اجرا فقط F1 و F5 تا دستور UI.

---

## 7. نقشه راه ۸ فاز (۳۸ هفته)

| فاز | هفته | محتوا |
|---|---|---|
| F1 | 1–5 | Risk foundation + Excel |
| F2 | 6–9 | Monitor + Reserve |
| F3 | 10–15 | Change + ۱۲ بُعد |
| F4 | 16–19 | CCB + BL |
| F5 | 20–24 | Notice ★ Guardian |
| F6 | 25–30 | Delay + Quantum |
| F7 | 31–34 | Dispute |
| F8 | 35–38 | گراف + داشبورد + EXEC |

---

## 8. Migration / Rollback

اعمال‌شده در repo:

| V | محتوا |
|---|---|
| 001 | register_item + audit + FK روی 📌 |
| 002 | RMP + RBS + C-E-E |
| 003 | Qual/Quant assessment |
| 004 | response + reserve |
| 005 | issue + ews |
| 006 | CR impact jsonb |
| 007 | CCB + baseline_version + log |
| 008 | clause + calendar + claim fields |
| 009 | claim_notice |
| 010 | delay method + quantum |
| 011 | negotiation/dispute |
| 012 | chain + auto_suggest |

Rollback هر V: DROP اشیاء ✨ همان فایل. **DROP جدول 📌 ممنوع.** داده موجود NULL می‌ماند.

UI transition: تب‌های فعلی matrix/register/change/delay/claim حفظ؛ زیرآیتم‌ها فقط aside داخلی.

---

## 9. Loop D14 (بسته شدن پرامپت)

| Loop | |
|---|---|
| 1 | نگاشت فرآیندی در D1–D13 |
| 2 | TPT + V001 |
| 3 | RBS تا Reserve |
| 4 | ۱۲بُعد + CCB + BL |
| 5 | بند، Guardian، ۸ روش، ۱۴ quantum، dispute |
| 6 | 3×3 + AS-8 + گراف + E2E |
| 7 | Python Guardian D10 |
| 8 | ۱۸ KPI، ۱۲ EWS، ۱۷ گزارش، ۲۰ قاعده |
| 9 | کدها یکنواخت AS-/EWS-CLM-/RSK- |
| 10 | وضعیت 📌/🔧/✨ در هر D؛ V001–012؛ rollback |

**Gap باز برای اجرا (نه سند):** اتصال UI `RiskClaimsWorkspace` به سرویس‌ها — فقط با دستور پیاده‌سازی.

---

بستهٔ RCC طراحی کامل شد. اسناد: `docs/RCC_DELIVERABLE_01.md` … `_14.md` و `db/postgres/rcc/migrations/`.
