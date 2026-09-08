# GOV D3 — موتور گردش‌کار، SLA و تشدید

خلاصه ۳ خط: هر گام باز با `due_at` سنجیده می‌شود؛ `daysLeft < 0` نقض SLA است و نردبان تشدید L0→L3 را فعال می‌کند. موتور فقط رویداد تولید می‌کند و هیچ عدد ماژول دیگری را نمی‌نویسد. پیاده‌سازی مرجع: `src/services/governance.ts` + `server/govLogic.js` (تست: `server/gov.test.mjs`).

## ۱) قواعد

| قاعده | تعریف |
|---|---|
| SLA level | `left > 1 → ok` · `0 ≤ left ≤ 1 → due_soon` · `left < 0 → breach` |
| نردبان تشدید | تأخیر ۰ → `L0` مسئول گام · ۱–۳ → `L1` مدیر پروژه · ۴–۷ → `L2` PMO · >۷ → `L3` کمیته راهبری |
| اقدام | `ok → none` · `due_soon → notify` · `breach → escalate` |
| گام بسته | `closedAt` دارد → از پایش خارج |
| Idempotency | یک تشدید در هر سطح برای هر task فقط یک‌بار ثبت می‌شود (`UNIQUE(task_id, level)`) |

## ۲) API موتور

```ts
workflowTick(tasks: WfTask[], now?: Date): WfEvent[]
slaLevel(left: number): "ok" | "due_soon" | "breach"
escalationLevel(daysOverdue: number): "L0" | "L1" | "L2" | "L3"
```

`WfEvent = { taskId, daysLeft, level, escalation, action }`

## ۳) زمان‌بندی

| کار | تناوب | خروجی |
|---|---|---|
| `workflowTick` | هر ۱ ساعت (cron) | درج در `gov_escalation` + صف اعلان |
| بستن خودکار | ندارد — بستن فقط با اقدام کاربر و ثبت در trail | — |
| گزارش نقض SLA | روزانه ۰۷:۰۰ | ورودی گزارش EXEC (D9) |

## ۴) اتصال به UI
تب «گردش فرآیندها» ستون‌های مهلت/وضعیت/سطح تشدید را از همین توابع می‌گیرد؛ «تأیید گام» یک رکورد append در زنجیره ممیزی ایجاد می‌کند (`appendTrail`).

## ۵) تست‌های پذیرش (پیاده‌شده)
- گام معوق ۴ روزه → `breach` + `escalate` + `L2` ✔
- مهلت فردا → `due_soon` + `notify` ✔
- گام بسته → نادیده ✔
- نردبان L0..L3 ✔
