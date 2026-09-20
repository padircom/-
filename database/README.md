# اتصال به پایگاه داده

برنامه در دو حالت کار می‌کند: **بدون پایگاه داده** (داده‌ی نمونهٔ درون‌برنامه) و **با SQL Server**.
این راهنما مسیرِ دوم است.

## ۱. پیش‌نیاز
- SQL Server 2012 یا بالاتر (نسخهٔ Express کافی است)
- یک کاربر با دسترسیِ `db_owner` روی پایگاهِ مقصد (برای اجرای شِما)

## ۲. ساختِ پایگاه و شِما

> **ترتیبِ اجرا**: ابتدا مهاجرت‌هایِ دستیِ موجود در `db/mssql/` را اجرا کنید
> (`V001__pex_core.sql` → `V002__pex_dpr.sql` → `V003__hse.sql` و سپس دو فایلِ
> `seed__*.sql`) که ۱۵ جدولِ عملیاتی را با نحوِ سازگار با SQL Server ۲۰۰۸ R2
> می‌سازند. شِمای تولیدشده در اینجا **مکملِ آن‌ها** است و جدول‌هایِ باقی‌مانده
> از ۲۲۴ جدولِ ارجاع‌شده در فریم‌ورک را می‌سازد. هر دو idempotent هستند و
> اجرایِ چندباره بی‌خطر است.
شِما به‌طور خودکار از روی خودِ کد تولید می‌شود تا همیشه با نسخهٔ برنامه هماهنگ بماند:

```bash
npm run db:schema
```

خروجی در `database/` نوشته می‌شود:

| فایل | کاربرد |
|---|---|
| `schema-mssql.sql` | شِمای SQL Server — ۲۲۴ جدول (مکملِ `db/mssql/`) |
| `schema-sqlite.sql` | همان شِما برای SQLite (تست و دموی سبک) |
| `seed-data-mssql.sql` | داده‌ی اولیه: خوشه‌ها، ۲۷ پروژه و مختصاتِ سایت |
| `seed-data-sqlite.sql` | همان برای SQLite |

سپس در SQL Server Management Studio (یا با `sqlcmd`):

```sql
CREATE DATABASE PMIS_MASTER_DB;
GO
USE PMIS_MASTER_DB;
GO
-- محتوای database/schema-mssql.sql را اجرا کنید
-- سپس محتوای database/seed-data-mssql.sql را اجرا کنید
```

```bash
sqlcmd -S localhost\SQL2008EXPRESS -U sa -P "<رمز>" -d PMIS_MASTER_DB -i database/schema-mssql.sql
sqlcmd -S localhost\SQL2008EXPRESS -U sa -P "<رمز>" -d PMIS_MASTER_DB -i database/seed-data-mssql.sql
```

> **دربارهٔ ستونِ Payload**: فریم‌ورک به ۲۲۴ جدول ارجاع می‌دهد و تنها بخشی از ستون‌ها از کد
> قابل استخراج هستند. جدول‌هایی که ستونِ شناخته‌شده ندارند با ستونِ `Payload NVARCHAR(MAX)`
> (JSON) ساخته می‌شوند تا از همان ابتدا قابلِ استفاده باشند. اگر شِمای واقعیِ سازمان را دارید،
> فایل `database/schema.custom.sql` را بسازید و به‌جای فایلِ تولیدشده اجرا کنید — برنامه تفاوتی
> نمی‌بیند، فقط باید نامِ جدول‌ها و ستون‌ها با همان قرارداد باشد.

## ۳. تنظیمِ اتصال
سرور با متغیرهای محیطی پیکربندی می‌شود (فایل `.env` در ریشهٔ پروژه):

```env
SQL_SERVER=localhost\SQL2008EXPRESS
SQL_DATABASE=PMIS_MASTER_DB
SQL_USER=sa
SQL_PASSWORD=رمز-عبور
SQL_ENCRYPT=false            # برای SQL Server قدیمی (۲۰۰۸/۲۰۱۲) روی false بماند
SQL_TRUST_CERT=true

PORT=4000                    # پورتِ API
DATA_DIR=server/data         # مسیرِ ذخیره در حالتِ بدونِ SQL
```

اتصال را می‌توان از داخل برنامه هم تنظیم کرد:
**تنظیمات ← اتصال پایگاه داده**، سپس «تست اتصال».

## ۴. اجرا
```bash
npm run build
node server/index.js          # API روی :4000
node scripts/serve-static.mjs # رابط روی :8080  (و پروکسی /api)
```

## ۵. رفتار در نبودِ پایگاه داده
- سرور با `PERSIST_DRIVER=json` داده‌ها را در `server/data/*.json` نگه می‌دارد (بدون نیاز به SQL).
- endpointهایی که مستقیماً SQL می‌زنند (مانند `/api/projects`) در این حالت ۵۰۰ می‌دهند؛
  رابط برنامه از داده‌ی نمونه استفاده می‌کند و پیامِ مناسب نشان می‌دهد — یعنی بدون پایگاه
  داده هم همهٔ صفحه‌ها بالا می‌آیند و قابلِ نمایش‌اند.

## ۶. به‌روزرسانیِ شِما پس از تغییرِ برنامه
هر بار که ماژولی اضافه یا تغییر کرد:

```bash
npm run db:schema
```

فایل‌های جدید با فایل‌های قبلی مقایسه و فقط جدول‌های تازه اضافه می‌شوند
(`IF OBJECT_ID … IS NULL`)، بنابراین اجرای مجدد، داده‌های موجود را پاک نمی‌کند.
