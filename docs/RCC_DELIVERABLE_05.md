# RCC Deliverable 5 — Risk Response + Reserve Management

خلاصه ۳ خطی: ده استراتژی (۵ تهدید + ۵ فرصت)، برنامه پاسخ/احتیاط/بازگشت، امتیاز باقیمانده و ریسک ثانویه. دفتر ذخیره Contingency/Management با تراکنش consume/commit/release. هشدار تهی‌شدن اگر Reserve% − Progress% > ۱۰. اکشن به PMA فقط ارجاع `action_ref` — بدون نوشتن SPI.

---

## 1. Response strategies

| تهدید | فرصت |
|---|---|
| Avoid, Transfer, Mitigate, Accept, Escalate | Exploit, Share, Enhance, Accept, Escalate |

هر پاسخ: Response Plan + Contingency Plan + Fallback Plan.  
Residual Score پس از اجرا. Secondary risk = `register_item` جدید type=risk.  
Occurred + critical → Issue (D6) و پیشنهاد CR (D13).

Auto-create ActionItem در MON: درج شناسه در `action_ref`؛ موتور `projectControls` را mutate نمی‌کند.

UI 👁️: کارت استراتژی زیر ماتریس موجود (نه صفحه جدید سایدبار). زیرفرایند داخلی 07.4 / 07.5.

---

## 2. Reserve Ledger ✨

`reserve_ledger`: kind ∈ {contingency, management}, multi-currency، `opening` / `balance`.  
`reserve_transaction`: consume | commit | release، مبلغ > 0، اختیاری پیوند ریسک/ادعا.

شبه‌کد نرخ مصرف:

```ts
function depletionAlert(progressPct: number, ledger: { opening: number; balance: number }) {
  const usedPct = ledger.opening === 0 ? 0 : (1 - ledger.balance / ledger.opening) * 100;
  return usedPct - progressPct > 10; // EWS reserve
}
```

Progress% از PMA/PEX **خواندنی** (مثلاً EV/BAC). هشدار → EarlyWarning D6.

Dashboard سلامت: مانده، تعهد، نرخ، پرچم تهی‌شدن. 👁️ نوار ساده در هدر d4.

---

## 3. Monitoring

| فیلد روی `risk_response` | نقش |
|---|---|
| next_review_at | تناوب از پلن |
| effectiveness 1–5 | اثربخشی |
| — | Trigger از EWS PMA موجود |

بازنشستگی: status هسته = closed + audit.

---

## 4. DDL

`db/postgres/rcc/migrations/V004__response_reserve.sql`

Rollback: DROP فقط جداول ✨ این نسخه.

---

## 5. Loop D5

| Loop | |
|---|---|
| 1 | 11.5–11.7 |
| 2 | response/ledger به هسته FK |
| 3 | ۱۰ استراتژی + ledger + residual + secondary |
| 4 | CR از occurred → D7 |
| 8 | KPI تهی‌شدن ذخیره |
| 10 | 📌 بدون DROP |

**Gap باقی:** Issue + EWS RCC → D6.

منتظر **Deliverable 6**.
