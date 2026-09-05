# RCC Deliverable 11 — Claim Detail + Delay Analysis + Quantum

خلاصه ۳ خطی: ادعا سه‌محوری Entitlement / Causation / Quantum روی 📌 `claim_register`. تأخیر با ۸ روش روی 📌 `delay_register`؛ نمونه TIA و Windows. ۱۴ سرفصل هزینه در JSONB. ورودی زمان از Baseline قفل PEX — درصد Approved تغییر نمی‌کند.

---

## 1. Claim detail 🔧

فیلدها: factual_bg, chronology jsonb, entitlement, causation, quantum jsonb, legal_basis.  
ارسال بسته بدون هر سه محور = مسدود (هم‌ارز دروازه BL+DataDate موجود).

UI 👁️: سه ستون شیشه‌ای در تب claim.

---

## 2. هشت روش تأخیر

| کد | روش |
|---|---|
| apab | As-Planned vs As-Built |
| iap | Impacted As-Planned |
| tia | Time Impact Analysis (رایج FIDIC) |
| cab | Collapsed As-Built |
| windows | Windows Analysis |
| snapshot | Snapshot |
| cpa | Critical Path |
| float | Float Analysis |

`concurrent_flag` برای تأخیر هم‌زمان.  
`result_days` خروجی روش انتخاب‌شده.

### شبه‌کد TIA

```python
def tia(fragnet_days: float, tf_before: float, cp_affected: bool) -> float:
    """EOT days on locked baseline. tf_before from PEX read-only."""
    if not cp_affected:
        return max(0.0, fragnet_days - max(tf_before, 0))
    return max(0.0, fragnet_days)  # CP hit: full fragnet on critical

# Sample OG-2401: fragnet 12d, TF=0 on CIV-001 locked → EOT = 12d
```

نمونه: فعالیت `CIV-001` قفل، TF=0، قطعه تأخیر ۱۲ روز → TIA = ۱۲ روز EOT. اگر TF=۱۶ و غیربحرانی → max(0, 12-16)=0.

### شبه‌کد Windows

```python
def windows(slices: list[tuple[str, float, float]]) -> dict:
    """Each window: (label, planned_cp_days, actual_cp_days)."""
    rows = [{"w": w, "slip": act - pln} for w, pln, act in slices]
    return {"windows": rows, "total_slip": sum(r["slip"] for r in rows)}

# Example 4 windows of 4w: slips 3, 0, 5, 2 → total 10d (then concurrent split)
```

گزارش هر روش: قالب جدا در Excel ظرف (D14).

---

## 3. Quantum — ۱۴ سرفصل (`quantum` jsonb)

1 Prolongation 2 Site OH 3 HO OH 4 Idle labour 5 Idle plant 6 Disruption  
7 Acceleration 8 Escalation 9 Financing 10 Productivity 11 Extra material  
12 Extra subcontract 13 Delay damages 14 Profit/markup  

هر کلید: `{amount, currency, method, docs[]}`. بدون docs = Incomplete.

چند ارز: جمع نمی‌شود مگر نرخ صریح در پلن مالی (خارج RCC).

---

## 4. DDL

`db/postgres/rcc/migrations/V010__claim_detail_delay_quantum.sql`

---

## 5. Loop D11

| Loop | |
|---|---|
| 5 | سه محور + ۸ روش + ۱۴ سرفصل + نمونه TIA/Windows |
| 6 | TF/BL از PEX خواندنی |
| 10 | 📌 حفظ |

**Gap باقی:** مذاکره/داوری → D12.

منتظر **Deliverable 12**.
