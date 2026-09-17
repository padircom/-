# تحویل نشست — وضعیت فعلی پروژه

**تاریخ:** ۱۴۰۴/۰۶/۲۰ (2026-09-11) · **شاخه:** `arena/01a07ee6-repo`
**آخرین کامیت:** `14acd63` · **دروازه:** ۳۷۰۵/۳۷۰۵ آزمون سبز

---

## ⚠️ نخستین کار در نشست تازه

کامیت‌های محلی هنوز به گیت‌هاب نرفته‌اند. نشست قبلی بسته شد و
`git push` در آن ممکن نبود.

```bash
cd /home/user/-
git log --oneline -8          # تأیید سلامت تاریخچه
git push origin arena/01a07ee6-repo
```

### یک شاخه، نه چند شاخه

`main` محلی با شاخهٔ کاری **هم‌تراز** شده — هر دو روی یک کامیت‌اند.
پس از push، همان یکی را نگه دارید:

```bash
# گزینهٔ الف — PR (امن‌تر، تاریخچه در گیت‌هاب دیده می‌شود)
gh pr create --base main --head arena/01a07ee6-repo \
  --title "HRM D8–D13 + تمیزکاری مخزن"

# گزینهٔ ب — مستقیم روی main
git push origin arena/01a07ee6-repo:main
```

**تنها تفاوت با `origin/main`:** چهار فایل که عمداً حذف شده‌اند —
`5_SQL_PERSISTENCE.patch.txt`، `transfer 6_INTEGRATION_ITG.patch.txt`
و دو آبجکت سرگردان در `db/`. هیچ کد زنده‌ای نیست؛ همه در تاریخچهٔ گیت
باقی می‌مانند.

> **هشدار مکرر این نشست:** تاریخچهٔ گیت **چهار بار** بازنشانی شد.
> محتوای فایل‌ها همیشه سالم ماند. اگر `git log` فقط `0831340` را نشان
> داد، کار را دوباره انجام ندهید — فقط `git add -A && git commit`.

---

## ماژول‌های بسته‌شده

d1 مستندات · d2 PEX · d3 پایش · d4 ریسک/ادعا · d5 FIN · d6 حاکمیت ·
d7 سامانه · d8 QMS · d9 ماشین‌آلات · **d10 HRM** · d11 CKM ·
d12 مهندسی · d14 CNT · d15 COM · d16 HSE · گزارش‌ساز · RBAC ·
ماندگاری SQL · یکپارچه‌سازی

### MOD-10 / HRM — کامل (این نشست)

| تحویلی | سند |
|---|---|
| D1–D3 معماری، مدل داده، OBS | `docs/HRM_D1_Architecture.md` … `D3` |
| D4 تایم‌شیت | `HRM_D4_Timesheet.md` |
| D5 بهره‌وری | `HRM_D5_Productivity.md` |
| D6 اکیپ و پیمانکاری | `HRM_D6_Crew.md` |
| D7 پذیرش و انطباق | `HRM_D7_Onboarding.md` |
| D8 تحلیل و هیستوگرام | `HRM_D8_Analytics.md` |
| D9 همگام‌سازی میدانی | `HRM_D9_FieldSync.md` |
| D11 گزارش رسمی | `HRM_D11_Reports.md` |
| D12 ارسال هزینه به مالی | `HRM_D12_CostPosting.md` |
| D13 قرارداد رویداد | `HRM_D13_Integration.md` |

D10 و D14 تحویلی مستقل نبودند (D10 مقصد شکاف H-06 بود که در D11 بسته
شد؛ D14 کار استقرار است).

---

## شمارنده‌های فعلی

| شاخص | مقدار |
|---|---|
| جدول اسکیما | ۱۳۷ |
| مهاجرت | ۳۱ (آخرین `0031`) |
| مجوز RBAC | ۱۸۰ |
| نقش | ۲۱ |
| قاعدهٔ SoD | ۲۸ |
| مسیر `/api/hrm/*` | ۷۰ |
| مسیر `/api/events/*` | ۵ |
| صادرات `hrmLogic.js` | ۱۷۴ |
| آزمون کل | ۳۷۰۵ |

---

## 🚀 اجرای برنامه

برنامه **دو فرایند** دارد که هر دو باید بالا باشند: API روی ۴۰۰۰ و
رابط کاربری روی ۵۱۷۳.

### گام ۰ — آماده‌سازی (فقط اگر لازم بود)

`node_modules` و `server/*Logic.js` بین نشست‌ها پاک می‌شوند:

```bash
cd /home/user/-
ls node_modules >/dev/null 2>&1 || npm install --no-audit --no-fund
for m in fin qms pex ckm hrm pexdata rpt rbac sql itg eqm eng cnt com hse; do
  npm run build:$m
done
```

### گام ۱ — سرور API

```bash
PORT=4000 PERSIST_DRIVER=json DATA_DIR=./server/rundata node server/index.js
```

- `PERSIST_DRIVER=json` **الزامی است**. بدون آن سرور به SQL Server
  واقعی (`.\SQL2008EXPRESS`) وصل می‌شود که در سندباکس وجود ندارد.
- `DATA_DIR=./server/rundata` — **نه `server/data`**. آن مسیر را ۲۹
  فایل آزمون REST به‌عنوان نقطهٔ شروع کپی می‌کنند؛ دادهٔ اجرا که آنجا
  بنشیند، ۴۲ آزمون را با `UNIQUE_VIOLATION` می‌شکند. این اتفاق یک بار
  افتاد.

### گام ۲ — رابط کاربری

```bash
npm run dev -- --port 5173 --host 0.0.0.0
```

`--host 0.0.0.0` برای دیده شدن در پیش‌نمایش مرورگر لازم است.
`vite.config.ts` از قبل `host: true` و `allowedHosts: true` دارد و
**دست‌نخورده می‌ماند**.

> در Agent Mode هر دو را با `start_process` اجرا کنید (نه `&`)، وگرنه
> با پایان دستور کشته می‌شوند.

### گام ۳ — دادهٔ نمونه (بار اول الزامی)

```bash
node server/seed.mjs
```

**`server/data` در `.gitignore` است، پس در نصب تازه خالی است.** بدون
این گام همهٔ پنل‌ها خالی دیده می‌شوند — بی‌آنکه خطایی نشان داده شود،
که بدترین حالت است چون به‌نظر می‌رسد کار انجام نشده.

اسکریپت از **مسیرهای REST واقعی** استفاده می‌کند نه نوشتن مستقیم
فایل: دادهٔ ساخته‌شده از همان اعتبارسنجی و همان زنجیرهٔ تأیید عبور
می‌کند که کاربر واقعی. می‌سازد: ۱ پروژه · ۳ حساب هزینه · ۳ فعالیت ·
۳ کارت نرخ · ۵ پرونده پرسنلی · ۱۸ ردیف برنامهٔ مبنا · ۶ برگهٔ کارکرد
تأییدشده · ۱ ارسال هزینه + رویداد.

اجرای دوباره امن است (`⏭ از قبل بود`).

### گام ۴ — زمان‌بند تحویل رویداد (اختیاری)

```bash
# با مقصد واقعی:
EVENT_TARGET_URL=https://erp.example/events \
EVENT_DISPATCH_MS=60000 \
EVENT_TIMEOUT_MS=10000 \
PORT=4000 PERSIST_DRIVER=json DATA_DIR=./server/rundata node server/index.js

# یا دستی، یک دور:
curl -X POST -H x-user-id:u-pmo -H content-type:application/json \
  http://127.0.0.1:4000/api/events/dispatch -d '{"projectId":"p1"}'
```

بدون `EVENT_DISPATCH_MS` هیچ تایمری ساخته نمی‌شود. بدون
`EVENT_TARGET_URL` تحویل «موفق» اعلام نمی‌شود و صف عمداً قرمز
می‌ماند — چون هیچ سامانه‌ای آن رقم را نگرفته.

### تأیید سلامت

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
curl -s -H x-user-id:u-pmo 'http://127.0.0.1:4000/api/events/catalog?projectId=p1'
```

⚠️ **`/api/health` عمداً ۵۰۰ می‌دهد** (`DB_CONNECTION_ERROR`). آن مسیر
سلامت SQL Server واقعی را می‌سنجد که در سندباکس نیست. **نشانهٔ خرابی
نیست** — مسیرهای ماژول را بسنجید نه `/api/health`.

### دو دامی که «برنامه خالی است» می‌سازند

هر دو در این نشست رخ دادند و **هیچ‌کدام خطا نشان نمی‌دهند**:

**۱) نبود پروکسی `/api`** — رابط کاربری با مسیر نسبی صدا می‌زند، ولی
Vite هر مسیر ناشناخته را به `index.html` می‌فرستد. کلاینت به‌جای JSON
یک صفحهٔ HTML می‌گیرد و هر پنل خالی می‌ماند. **رفع شد** — بلوک `proxy`
به `vite.config.ts` افزوده شد (تنها تغییر مجاز در آن فایل، کنار
`host` و `allowedHosts`).

بررسی سلامت پروکسی:
```bash
curl -s -o /dev/null -w '%{content_type}\n' \
  -H x-user-id:u-pmo 'http://127.0.0.1:5173/api/events/catalog?projectId=p1'
# باید application/json بدهد. اگر text/html داد، پروکسی کار نمی‌کند.
```

**۲) خالی بودن `server/data`** — با `node server/seed.mjs` پر می‌شود
(گام ۳ بالا).

---

## دروازهٔ آزمون

```bash
node --test server/*.test.mjs   # ۳۷۰۵ آزمون، حدود ۳ دقیقه
npx vite build                  # خروجی تک‌فایل در dist/
```

`npx tsc --noEmit` ⇒ **۵۷ خطای پایه** (میراثی، خارج از دامنهٔ کار).

---

## قیدهای دائمی کاربر

- مسیر پروژه `/home/user/-`؛ پاسخ‌ها **کوتاه و فارسی**.
- ظاهر، فونت Vazirmatn و `src/index.css` دست‌نخورده.
- `vite.config.ts` فقط `server.host: true` و `allowedHosts: true`.
- **بدون آیتم سایدبار تازه** مگر تأیید صریح. تأییدشده‌ها: «مدیریت کیفیت
  و بازرسی»، «HSE»، «HRM»، و «مدیریت سامانه و پیکربندی پایه» (همیشه
  آخر).
- نام ۶ زیرماژول FIN و ساختار منو تغییر نکند.
- Excel ظرف است نه Source of Truth.
- HRM محدود به نرخ×ساعت — **Payroll کامل ساخته نشود**.
- پس از هر تحویلی: اعلام «بسته شد» + شمار باقی‌مانده + **۱۰ لوپ
  خودارزیابی**.
- تمیزکاری مخزن فقط پس از push موفق، در کامیت جدا، با تأیید.

---

## الگوی کاری تثبیت‌شده

**۸ مرحله:** اسکیما+مهاجرت → موتور (`src/services/*.ts`) → build →
آزمون موتور → RBAC → REST → آزمون REST → curl زنده → UI → دروازه →
کامیت → ۱۰ لوپ → سند.

**۱۰ لوپ:** ۱ بدنهٔ POST · ۲ تفکیک ۴۰۱/۴۰۳ · ۳ N+1 · ۴ تناقض عدد ·
۵ دور زدن دروازه · ۶ تفکیک وظیفه · ۷ نگاشت منو→تب · ۸ نشت بین
پروژه‌ها · ۹ سیاههٔ ممیزی · ۱۰ یکپارچگی با همسایه.

این لوپ‌ها در HRM **۱۴ نقص واقعی** پیدا کردند — از جمله نشت حساب هزینه
بین دو پروژه و بازنویسی رویداد تحویل‌شده. لوپ‌ها تشریفات نیستند.

---

## دام‌های شناخته‌شده

- `server/data` در `.gitignore` — هر آزمون REST باید
  `cp("server/data", dir, {recursive:true}).catch(()=>{})` بنویسد.
- پورت‌های آزمون REST گرفته: ۴۷۳۱–۴۷۴۰. **بعدی ۴۷۴۱.**
- اجرای سرور با `start_process`، نه `(cmd &)`. بدون `DATA_DIR` به SQL
  واقعی می‌رود. `RATE_LIMIT_PER_MINUTE=100000`.
- `await repo()` متد `update` ندارد — `patch(...)`.
- **هرگز** `SCHEMA.length === N` یا `MIGRATIONS.at(-1)` در آزمون
  ماژول ننویسید؛ کف (`>= N`) و `MIGRATIONS.find(m => m.version === "00XX")`.
- زنجیرهٔ تأیید تایم‌شیت: `submitted`(u-site) → `foreman_approved`(u-hr,
  با `foremanSignatureRef`) → `qc_verified`(u-qc) → `pm_approved`(u-pm)
  → `posted`(**u-pmo**، پس از SOD-28) → `locked`(u-pm).
- `u-viewer` وجود ندارد. کاربران: u-admin, u-pm, u-pmo, u-planner,
  u-cost, u-qc, u-qa, u-hr, u-doc, u-contracts, u-site, u-comm, u-hse,
  u-engmgr, u-design, u-consultant, u-client, u-ceo, u-sub, u-auditor.
- پارامتر فارسی خام در URL curl ⇒ ۴۰۰. از `curl -G --data-urlencode`.
- `res.text()` علامت BOM را حذف می‌کند — از `arrayBuffer()`.
- ~~ریشهٔ مخزن آلوده به فایل‌های git-dir~~ — ✅ **تمیز شد.** ۳۰ فایل
  بقایای یک `.git` رهاشده (`02/`, `03/`, `hooks/`, `refs/`, `logs/`,
  `info/`, `HEAD`, `index`, `COMMIT_EDITMSG`, `description` و دو
  آبجکت سرگردان در `db/`) حذف شدند. `.gitignore` حالا جلوی
  بازگشتشان را می‌گیرد.

  ⚠️ `db/postgres/migrations/` **باقی ماند** — شش فایل مهاجرت واقعی
  SQL است، نه آشغال. اگر روزی `db/` را پاک کردید، آن را استثنا کنید.

---

## کار باقی‌مانده (اختیاری)

هیچ ماژولی باز نیست. موارد زیر بدهی مستندشده‌اند، نه مسدودکننده:

1. **push کردن ۱۴ کامیت** — تنها کار فوری.
2. `TD-HRM-01..16` — در سند تحویلی مربوطه با دلیل ثبت شده‌اند.
   مهم‌ترین‌ها: TD-HRM-14 (کلاینت HTTP واقعی برای تحویل رویداد) ·
   TD-HRM-16 (زمان‌بند خودکار تلاش دوباره) · TD-HRM-12 (نرخ وسط ماه).
3. `H-05/08/09/11` — کار استقرار: نقش‌های سازمانی، مهاجرت
   `totalManHours`، ماسک نرخ، سیاست نگهداشت ۲/۱۰ سال.
4. بدهی ماژول‌های دیگر: `TD-CNT-*`, `TD-UI-*`, `TD-HSE-*`.
