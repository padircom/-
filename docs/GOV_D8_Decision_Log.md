# GOV D8 — دفتر تصمیم، ردیابی شاهد و ثبت غیرقابل تغییر

خلاصه ۳ خط: هیچ تصمیمی بدون «شاهد عددی» و «مرجع اختیار» ثبت نمی‌شود؛ بازنویسی Baseline بدون CR مصوب مطلقاً رد است. هر رویداد حاکمیتی در زنجیره hash-link ذخیره می‌شود و دستکاری آن قابل تشخیص است.

## ۱) دروازه تصمیم

```ts
decisionGate(d) → { ok, reasons[] }
```

| دلیل رد | شرط |
|---|---|
| `evidence_missing` | `evidenceRef` خالی |
| `authority_missing` | سطح اختیار تعیین نشده |
| `authority_insufficient` | `needsEscalation(authority, cost, days)` |
| `baseline_rewrite_without_cr` | `rewritesBaseline && !crId` |

## ۲) قالب شاهد
`MODULE:ENTITY#KEY` — نمونه: `PMA:EVM#1405-06` · `PEX:BL#3` · `RCC:CLM-007` · `PIM:DOC-1042`.
شاهد در لحظه ثبت **snapshot** می‌شود (تاریخ + مقدار) تا تصمیم بعداً با داده تغییر‌یافته قضاوت نشود.

## ۳) چرخه تصمیم
`open → (gate ok) → approved` · `open → (gate fail) → escalated/rejected`
تصمیم تأییدشده تنها با تصمیم جبرانی جدید لغو می‌شود؛ حذف وجود ندارد.

## ۴) زنجیره ممیزی

```ts
hash = FNV-1a(prev_hash + "|" + payload)
appendTrail(trail, payload) → [...trail, { seq, payload, hash }]
verifyTrail(trail) → boolean
```
- فقط `INSERT` (تریگر `INSTEAD OF UPDATE, DELETE` در D2).
- هر تأیید گردش‌کار در UI یک رکورد append می‌کند و چیپ «زنجیره سالم / دستکاری‌شده» را به‌روزرسانی می‌نماید.

## ۵) تست‌های پذیرش (پیاده‌شده)
تصمیم بدون شاهد و اختیار → دو دلیل رد ✔ · هزینه ۹۰۰k با اختیار PM → `authority_insufficient` ✔ · بازنویسی Baseline بدون CR → رد، با CR → قبول ✔ · دستکاری payload → `verifyTrail=false` ✔
