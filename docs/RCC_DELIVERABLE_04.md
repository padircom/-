# RCC Deliverable 4 — Risk Analysis (Qualitative + Quantitative)

خلاصه ۳ خطی: امتیاز کیفی از max هفت بُعد اثر × احتمال؛ سطح از آستانهٔ پلن V002. کمی: EMV، PERT سه‌نقطه، مونت‌کارلو LHS ≥۱۰٬۰۰۰ برای P10/P50/P80. نتیجه در ستون‌های NULLable `risk_assessment` 📌 (V003). ماتریس فعلی 👁️ باید score چندبُعدی را نشان دهد؛ اعداد SPI موتور دست نخورده.

---

## 1. Qualitative

ابعاد اثر (1–5): Cost, Schedule, Scope, Quality, Safety, Environment, Reputation.

\[
I^* = \max(I_k),\quad Score = P \times I^*
\]

سطح از `risk_management_plan.thresholds` (پیش‌فرض 8 / 12 / 16): Low / Med / High.

Urgency 1–5؛ Proximity روز تا پنجرهٔ رخداد (`proximity_d`).

شبه‌کد ارزیابی:

```ts
function assess(p: number, impacts: number[], plan: { low: number; med: number; high: number }) {
  const iStar = Math.max(...impacts);
  const score = p * iStar;
  const level = score >= plan.high ? "high" : score >= plan.med ? "med" : "low";
  return { iStar, score, level };
}
```

UI 👁️: سلول ماتریس = شمارش بر اساس Score نه فقط P×I تک‌بعدی فعلی؛ کلیک → لیست ریسک.

---

## 2. Quantitative

**EMV**  
\[
EMV = P_{numeric} \times Impact_{money}
\]
\(P_{numeric}\) از مقیاس پلن (مثلاً P3 = 0.5).

**PERT (مدت یا هزینه)**  
\[
E = (O + 4ML + P)/6,\quad \sigma = (P-O)/6
\]
ستون‌ها: `pert_o`, `pert_ml`, `pert_p`, `pert_e`.

**Monte Carlo — Latin Hypercube** (حداقل ۱۰٬۰۰۰؛ ذخیره P10/P50/P80 + `mc_runs`)

```python
import numpy as np

def lhs_uniform(n, d, rng):
    cuts = np.linspace(0, 1, n + 1)
    u = rng.uniform(cuts[:-1], cuts[1:], size=(n, d))
    for j in range(d):
        rng.shuffle(u[:, j])
    return u

def mc_pert(o, ml, p, n=10_000, seed=42):
    rng = np.random.default_rng(seed)
    # PERT → Beta: mean E, sample via LHS on CDF
    e = (o + 4 * ml + p) / 6
    s = (p - o) / 6 or 1e-9
    a = ((e - o) / (p - o)) * 4 or 1e-6
    b = ((p - e) / (p - o)) * 4 or 1e-6
    u = lhs_uniform(n, 1, rng)[:, 0]
    samples = o + (p - o) * np.sort(np.clip(rng.beta(a, b, n) * 0 + u, 0, 1))
    # mix: map u through beta.ppf if scipy available; fallback linear PERT
    samples = o + (p - o) * u  # vessel; production: scipy.stats.beta.ppf(u, a, b)
    samples = np.sort(o + (p - o) * np.clip(samples, 0, 1))
    return dict(p10=float(np.percentile(samples, 10)),
                p50=float(np.percentile(samples, 50)),
                p80=float(np.percentile(samples, 80)),
                runs=n)

# Cost and Duration separately; never write to projectControls.spi
```

**Decision tree:** گره تصمیم × EMV شاخه؛ ذخیره jsonb اختیاری F2.

**Tornado (حساسیت):** Δ خروجی نسبت به Δ هر ریسک؛ UI F2.

RCC **نمی‌نویسد** `pctApproved` / SPI.

---

## 3. Visualization 👁️

| نما | وضعیت |
|---|---|
| Heat map | 📌 موجود — اتصال به Score چندبُعدی |
| Bubble P / I / EMV | ✨ بعداً روی همان canvas شیشه |
| Trend | ✨ از `rcc_audit_log` |

---

## 4. DDL

`db/postgres/rcc/migrations/V003__risk_assessment_quant.sql` — فقط ADD COLUMN روی 📌.

---

## 5. Loop D4

| Loop | |
|---|---|
| 1 | 11.3 Qual + 11.4 Quant |
| 2 | فیلدها روی assessment فرزند TPT |
| 3 | ۷ بُعد + EMV + PERT + MC LHS ۱۰k |
| 4–7 | n/a |
| 8 | KPI RSK-* از score/level در D14 |
| 9 | آستانه از پلن V002 |
| 10 | بدون DROP 📌 |

**Gap حل:** مدل Qual/Quant.  
**Gap باقی:** Response + Reserve → D5.

منتظر **Deliverable 5**.
