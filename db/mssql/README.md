# مهاجرت‌های SQL Server — محصول Arena

> محصول Arena روی **SQL Server** است (نمونه: `localhost\SQL2008EXPRESS`,
> دیتابیس `PMO_Dashboard_DB`). پوشه `db/postgres/` فقط برای طراحی PIM/DMS
> است و مبنای اجرا نیست.

## ترتیب اجرا (تازه‌سازی کامل)

```bat
sqlcmd -S localhost\SQL2008EXPRESS -d PMO_Dashboard_DB -i V001__pex_core.sql
sqlcmd -S localhost\SQL2008EXPRESS -d PMO_Dashboard_DB -i V002__pex_dpr.sql
sqlcmd -S localhost\SQL2008EXPRESS -d PMO_Dashboard_DB -i seed__pex_og2401.sql
```

همه اسکریپت‌ها **idempotent** هستند (اجرای چندباره بی‌خطر).
نحو با **SQL Server 2008 R2** سازگار است: بدون `OFFSET/FETCH`،
بدون `FORMAT`، بدون `SEQUENCE`؛ تاریخ UTC با `GETUTCDATE()`.

## قرارداد نام‌گذاری

- جدول‌های PEX با پیشوند `pex_` و snake_case (مثل `pex_progress_line`).
- نسخه‌بندی: `V<nnn>__<topic>.sql` برای DDL و `seed__<scope>.sql` برای سید.
- هر فاز جدید یک `Vnnn` تازه می‌سازد؛ فایل تأییدشده قبلی ویرایش نمی‌شود.

## جدول‌ها

| فایل | جدول‌ها |
|---|---|
| `V001__pex_core.sql` | `pex_project` · `pex_wbs` · `pex_roc` · `pex_activity` · `pex_activity_step` · `pex_milestone` |
| `V002__pex_dpr.sql` | `pex_dpr` · `pex_progress_line` · `pex_dpr_event` |
| `seed__pex_og2401.sql` | سید پروژه OG-2401 (آینه `src/data/pexProject.ts`) |
