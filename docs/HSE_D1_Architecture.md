# HSE D1 — تحلیل وضعیت موجود و معماری ماژول ایمنی، بهداشت و محیط‌زیست

**نسخه:** 1.0 · هم‌تراز با PIM (d1) / PEX (d2) / PMA (d3) / RCC (d4) / GOV (d6)
**محدوده:** میزبانی در صفحه دامنه `d2` (فرایند `d2-p4` برنامه‌ریزی روزانه/سایت) — PEX_D9 رابط HSE را همین‌جا تعریف کرده (PTW و SafetyEvents در DPR)
**اصل:** حفظ ساختار · افزودن قابلیت · **بدون آیتم جدید در سایدبار اصلی** · Excel ظرف است نه منبع حقیقت

خلاصه ۳ خطی: امروز هیچ موجودیت HSE در کد نیست؛ فقط ردپا داریم: `TRIR` در `KPI_SEED` (نمایشی)، ثابت `hse=90` در فرمول PHI، و دو وعده در PEX_D9 (گیت PTW برای WO پرخطر + SafetyEvents در DPR) که هیچ‌کدام پیاده نشده‌اند. شکاف اصلی: رجیستر حوادث با نرخ OSHA، چرخه عمر پروانه کار، چک‌لیست بازرسی امتیازی، TBT/بهداشت/محیط‌زیست، و اتصال اقدام اصلاحی به CAPA حاکمیت. بازطراحی با منبع یگانه `src/services/hse.ts`، آینه سرور، تست `node:test` و ورک‌اسپیس تب‌دار داخل همان صفحه d2 انجام می‌شود.

---

## ۱) موجودی واقعی (کد)

| لایه | مسیر | نقش |
|---|---|---|
| دامنه میزبان | `src/data/framework.ts` → `d2-p4` | برنامه‌ریزی روزانه؛ `d2-p4-s1` گزارش روزانه، `d2-p4-roc` کتابخانه RoC |
| پوسته | `src/components/ModuleDetail.tsx` | بلوک d2 + نگاشت `D2_PAGE_SUBS`؛ نقطه اتصال HSE همین‌جاست |
| فضای کاری PEX | `src/components/PlanningWorkspace.tsx` + `PexDprPanel.tsx` | DPR واقعی (F5)؛ SafetyEvents هنوز ندارد — ورودی آینده HSE |
| KPI نمایشی | `src/services/projectControls.ts` → `KPI_SEED` | `TRIR` با وزن ۸ (LowerBetter)؛ مقدار واقعی ندارد |
| فرمول سلامت | `computePhi` | ثابت `hse=90`؛ باید از موتور HSE تغذیه شود (D بعدی) |
| ادعا/ریسک | `src/components/RiskClaimsWorkspace.tsx` + `server/rccLogic.js` | حادثه شدید → ریسک/ادعا؛ لینک یک‌طرفه در D بعدی |
| اقدام حاکمیتی | `src/services/governance.ts` + `server/govLogic.js` | CAPA و تشدید SLA؛ اقدام HSE بحرانی به آن ارجاع می‌شود |
| قرارداد HSE | `docs/PEX_D9_SiteOps.md` | PTW قبل از WO پرخطر؛ SafetyEvents در DPR؛ تعارض‌محور نه LWW |

**نام‌های SQL آینده (رزرو، طرح D2):** `hse_incident`, `hse_permit`, `hse_inspection`, `hse_action`, `hse_manhour`, `hse_tbt`.

---

## ۲) Gap Analysis — زیرفرایندهای HSE

### HSE-1 رجیستر حوادث و نرخ‌ها
وضعیت: هیچی. نیاز: ثبت حادثه (near_miss تا fatality + spill)، نرخ OSHA (`TRIR`/`LTIFR` با ضریب ۲۰۰٬۰۰۰)، وزن شدت، وضعیت بررسی (open/investigating/closed). قانون: حادثه قابل‌ثبت (medical به بالا) بدون اقدام اصلاحی باز نمی‌ماند.

### HSE-2 پروانه کار (PTW)
وضعیت: فقط یک جمله در PEX_D9. نیاز: انواع hot/cold/confined/electrical/height/excavation/radiation، چرخه `draft→requested→approved→active→closed` با تعلیق/انقضا، نقش‌ها (requester/supervisor/area_authority/hse_officer/performing_authority)، پیش‌شرط‌های نوع‌کار (gas test، rescue plan، isolation، barricade). قانون: WO پرخطر بدون PTW فعال صادر نمی‌شود (گیت F4؛ فعلاً هشدار).

### HSE-3 بازرسی‌ها
وضعیت: هیچی. نیاز: چک‌لیست ناحیه‌محور با امتیاز و باند A/B/C/D، آیتم N/A، تاریخ بعدی بر اساس باند. قانون: باند D بازرسی فوق‌العاده می‌سازد.

### HSE-4 بهداشت و محیط‌زیست
وضعیت: هیچی. نیاز: TBT (برنامه‌ریزی/برگزاری)، معاینات دوره‌ای (پوشش ٪)، نشت (tier بر اساس حجم)، پسماند (نرخ بازیافت). قانون: spill بالای آستانه T3 حادثه محیط‌زیستی ثبت می‌کند.

### HSE-5 اقدامات اصلاحی
وضعیت: CAPA فقط در GOV. نیاز: اقدام با سررسید/شدت، SLA (overdue/due_soon/ok)، تشدید L0..L3، ارجاع اقدام بحرانی به CAPA حاکمیت. قانون: اقدام critical معوق >۷ روز → L3 و CAPA.

---

## ۳) ضعف UX و اقدام این فاز

- HSE هیچ صفحه‌ای ندارد؛ ورود از صفحه d2 (آیتم «HSE» زیر d2-p4) با ورک‌اسپیس ۶تبه: داشبورد، حوادث، PTW، بازرسی‌ها، بهداشت/محیط، اقدامات.
- اعداد داشبورد از موتور محاسبه می‌شوند (نه هاردکد): TRIR/LTIFR از سید حوادث+من‌اور، امتیاز HSE از ۴ مؤلفه.
- ظاهر/فونت/سایدبار اصلی بدون تغییر؛ بج SQL/Seed نداریم چون D1 آفلاین-اول با سید است (اتصال SQL در D بعدی).

---

## ۴) معماری بازطراحی

```
src/services/hse.ts  ── منبع یگانه (تایپ + موتور خالص + سید HSE_SEED)
   │ آینه یک‌به‌یک (نام تابع‌ها و خروجی‌ها یکسان)
server/hseLogic.js   ── مصرف سرور/تست (بدون I/O)
server/hse.test.mjs  ── node:test (۱۴ تست؛ به npm test اضافه می‌شود)
src/components/HseWorkspace.tsx ── ۶ تب، props: lang/initialTab
ModuleDetail (d2)    ── HSE_PAGE_SUBS زیر d2-p4 + رندر شرطی (بدون آیتم سایدبار)
```

رابط‌های تحویلی بعدی (فقط قرارداد، بدون پیاده‌سازی در D1):
DPR.SafetyEvents → پیش‌نویس `hse_incident` · WO پرخطر → گیت `hse_permit` ·
`hse_action[critical]` → `gov CAPA` · `TRIR` → `KPI_SEED` و `computePhi.hse` ·
حادثه lost_time+ → سیگنال `rcc` (ریسک).

---

## ۵) نگاشت SQL (طرح D2)

| جدول | کلید | ستون‌های اصلی |
|---|---|---|
| `hse_incident` | Id | ProjectCode, Code, DateISO, Type, SeverityW, LostDays, Area, Status, VolumeL? |
| `hse_permit` | Id | No UNIQUE, Type, Status, WorkDate, RiskLevel, FlagsJson, ExpiresAt |
| `hse_inspection` | Id | Area, DateISO, Score, Band, ItemsJson, NextDue |
| `hse_action` | Id | IncidentId?, Title, DueISO, ClosedAt?, Severity, Escalation |
| `hse_manhour` | Period | ProjectCode, Period, Hours (مبنای TRIR/LTIFR) |
| `hse_tbt` | Id | DateISO, Area, Attendees, Topic |

سازگاری SQL Server 2008 (بدون OFFSET/FETCH) و idempotent بودن سید، مثل `db/mssql`.

---

## ۶) نقشه راه تحویل‌شدنی‌ها

- **D1 (این فاز):** این سند + `hse.ts` + آینه + ۱۴ تست + ورک‌اسپیس ۶تبه + اتصال d2.
- **D2:** مدل داده و DDL `db/mssql/V003__hse.sql` + سید.
- **D3:** API ثبت حادثه/PTW/بازرسی + گیت WO پرخطر.
- **D4:** اتصال DPR.SafetyEvents، تغذیه TRIR/PHI، ارجاع CAPA/RCC، هشدارها.

---

## ۷) وضعیت پیاده‌سازی این فاز (صداقت فنی)

- [x] موتور خالص HSE با سید واقعی‌نما (۸ حادثه، ۵ PTW، ۴ بازرسی، ۵ اقدام، ۳ دوره من‌اور)
- [x] آینه سرور + ۱۴ تست سبز + اتصال به `npm test`
- [x] ورک‌اسپیس ۶تبه وصل به صفحه d2، بدون آیتم سایدبار
- [ ] جداول SQL، API واقعی، گیت WO، اتصال DPR/GOV/RCC (D2 به بعد)
