# RCC Deliverable 12 — Negotiation + Settlement + Dispute

خلاصه ۳ خطی: پاسخ ادعا (قبول/رد/پیشنهاد متقابل)، جلسات مذاکره با صورتجلسه PIM، تسویه و مسیر اختلاف تا داوری/دادگاه. اثر مالی تأییدشده فقط از طریق CR مصوب به دفتر ذخیره (D5) می‌رود — BAC را RCC عوض نمی‌کند.

---

## 1. Response / Negotiation / Settlement ✨

`claim_response`: accepted, partial, rejected, counter + مبلغ/روز متقابل.  
`claim_negotiation`: مواضع jsonb، outcome، `mom_doc_id`.  
`claim_settlement`: نوع، مبلغ/تمدید نهایی، release، محرمانگی، `via_cr_id` الزامی برای اعمال در PEX/PMA.

قانون: Settlement بدون CR = ذخیره پیش‌نویس؛ Baseline مقدس.

UI 👁️: 09.6–09.7 زیر d4-p5.

---

## 2. Dispute path

سطح: Expert → Adjudication → DAB → DRB → Mediation → Arbitration (ICC / UNCITRAL / ایران) → Litigation.

`claim_escalation`: forum, counsel, hearing, award, costs.

بدون نماینده حقوقی در سطح arbitration/litigation = Incomplete.

---

## 3. Contingency impact

Claim تأیید → `reserve_transaction` consume روی ledger contingency (D5) با `register_item_id`.  
هشدار تهی‌شدن همان قاعده ۱۰٪.

---

## 4. DDL

`db/postgres/rcc/migrations/V011__negotiation_dispute.sql`

---

## 5. Loop D12

| Loop | |
|---|---|
| 5 | پاسخ، مذاکره، تسویه، اختلاف تا arbitration، counsel |
| 3/5 | اثر ذخیره از طریق تراکنش |
| 4 | اعمال از مسیر CR |
| 10 | 📌 حفظ |

**Gap باقی:** یکپارچگی 3×3 + Auto-Suggest + Traceability → D13.

منتظر **Deliverable 13**.
