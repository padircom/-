# RCC Deliverable 13 — Cross-Module Integration + Traceability

خلاصه ۳ خطی: ماتریس PEX × PMA × RCC با جریان خواندنی. هشت قاعده Auto-Suggest در SQL. گراف Risk→Issue→CR→Claim→Evidence. سناریوی ده مرحله‌ای OG-2401. Webhook رویدادی؛ اعداد موتور مشترک فقط خوانده می‌شوند.

---

## 1. ماتریس 3×3

| از \ به | PEX | PMA | RCC |
|---|---|---|---|
| **PEX** | — | پیشرفت Approved → EV | TF/BL قفل → تأخیر/ادعا |
| **PMA** | اکشن‌پلن نگاه‌به‌جلو | — | VAR/EWS/PHI → پیشنهاد CR |
| **RCC** | پیشنهاد اسنپ‌شات پس از CCB | Action_ref / قفل گزارش اگر Major | زنجیره داخلی |

API منطقی (نه پیاده‌سازی کامل):  
`GET /rcc/suggests?project=` · `POST /rcc/chain` · `POST /hooks/rcc/notice-due`

Webhook: Notice Time-Bar، CR Decision، Claim TimeBarred.

---

## 2. Auto-Suggest (۸) — جدول `auto_suggest_rule`

| کد | شرط | عمل |
|---|---|---|
| AS-01 | SPI &lt; 0.85 | CR بازیابی |
| AS-02 | CPI &lt; 0.85 اگر SO نباشد | CR هزینه |
| AS-03 | ریسک رخ‌داده بحرانی | Issue + CR |
| AS-04 | CR رد + زیان طرف | Claim event |
| AS-05 | لغزش مایلستون &gt; ۱۵ روز | Claim EOT |
| AS-06 | ۵۰٪ مهلت Notice بدون متن | هشدار + پیش‌نویس |
| AS-07 | تهی ذخیره &gt; پیشرفت+۱۰٪ | ریسک جدید |
| AS-08 | NCR بحرانی &gt; ۳۰ روز | Issue → CR |

SPI/CPI از `computeEvm()` موجود.

---

## 3. Traceability

`rcc_chain_link` rel: risk_to_issue, issue_to_cr, cr_to_claim, claim_to_evidence, risk_to_cr, var_to_cr.

UI 👁️: گراف ساده SVG در صفحه داخلی d4 (نه سایدبار) — گره‌ها شیشه، یال رنگ d4 `#FF9F9F`.

---

## 4. سناریوی E2E (۱۰ مرحله)

1. PEX: TF=0 روی CIV-001 قفل.  
2. PMA: SPI 0.82 → AS-01 پیشنهاد CR.  
3. RCC: ریسک Long Lead (موجود در seed) سطح high.  
4. رخداد → Issue (D6).  
5. CR با ۱۲ بُعد (D7) → CCB (D8) رد جزئی.  
6. AS-04 رویداد ادعا EOT.  
7. بند ۲۰/ماده۲۹ + Notice اولیه (D9–10).  
8. نگهبان ۷روزه chip هدر.  
9. TIA ۱۲ روز (D11) + Quantum prolongation.  
10. تسویه با `via_cr_id`؛ تراکنش ذخیره؛ زنجیره کامل در گراف.

---

## 5. DDL

`db/postgres/rcc/migrations/V012__integration_trace.sql`

---

## 6. Loop D13

| Loop | |
|---|---|
| 6 | 3×3، ۸ قاعده، گراف، E2E، API/hook |
| 7 | AS-06 با Guardian |
| 9 | کدهای AS با EWS-CLM |
| 10 | بدون جدول 📌 جدید اجباری |

**Gap باقی:** RBAC، ۲۰ قاعده، KPI، گزارش، MVP F1+F5، نقشه راه → D14.

منتظر **Deliverable 14**.
