# Deliverable 3 — Excel Interop Engine
خلاصه: Excel ظرف است. داده در SQL. سه سناریو A قالب، B ورود انبوه، C بازتولید. Round-Trip فرمت را نگه می‌دارد.

وضعیت هم‌تراز D2: Draft…Archived. Entityها: ExcelTemplate, ExcelColumnMap, ImportBatch, ImportError, FormTemplate, FormField, FileObject.

---

## سناریو A — Template Onboarding
1. کاربر قالب `.xlsx` سازمان را آپلود می‌کند (Evidence در FileObject).
2. Parser شیت‌ها و ردیف هدر را می‌خواند؛ پیشنهاد Mapping به FormField (دیسپلین، DocNumber، TitleFa…).
3. کاربر Mapping را تأیید می‌کند → ExcelTemplate.Version++ و MappingSchemaJson.
4. موتور شیت مخفی `_META` می‌نویسد: templateId, version, projectCode, checksum.
5. خروجی: قالب «نسخه‌دار» که سایت می‌تواند آفلاین پر کند.

خطا: هدر تکراری / شیت خالی → ImportError سطح قالب، Commit نمی‌شود.

---

## سناریو B — Bulk Import
1. فایل پرشده آپلود. `_META` خوانده می‌شود؛ اگر نباشد → خطا `META_MISSING` (قابل Override فقط Admin).
2. Version قالب با ExcelTemplate فعال مقایسه؛ اگر قدیمی → Migration Map.
3. هر سلول: نوع، اجباری، enum، یکتایی DocNumber در Project.
4. Batch Status = Validated؛ اگر خطا → Failed و ردیف‌ها در ImportError (RowNo, Column, Code).
5. Commit اتمی: Document / Revision / FieldValue. فایل اصلی Evidence است نه منبع بعدی.

خطا: ردیف ۵۰ از ۵۰۰ خراب → بقیه Commit نمی‌شوند مگر حالت `partialAllowed` در قالب (پیش‌فرض false).

---

## سناریو C — Render / Export
1. کوئری DB (فیلتر پروژه/دیسپلین/وضعیت).
2. Renderer قالب نسخه N را باز می‌کند، فقط سلول‌های mapped را پر می‌کند؛ استایل/مرژ/عرض ستون دست نخورده.
3. `_META` به‌روز می‌شود (exportedAt, rowCount, checksum).
4. دانلود. این فایل دوباره در B قابل Round-Trip است.

---

## MappingSchema (نمونه واقعی MDR)
```json
{
  "templateId": "tpl-mdr-v3",
  "version": 3,
  "documentType": "MDR",
  "headerRow": 4,
  "dataStartRow": 5,
  "sheet": "MDR",
  "metaSheet": "_META",
  "partialAllowed": false,
  "columns": [
    { "key": "docNumber", "header": "Doc No", "col": "A", "field": "Document.DocNumber", "required": true, "type": "string", "pattern": "^[A-Z0-9-]+$" },
    { "key": "titleFa", "header": "عنوان", "col": "B", "field": "Document.TitleFa", "required": true, "type": "string" },
    { "key": "titleEn", "header": "Title", "col": "C", "field": "Document.TitleEn", "required": true, "type": "string" },
    { "key": "discipline", "header": "Disc.", "col": "D", "field": "Document.Discipline", "required": true, "type": "enum", "enum": ["Civil","Mechanical","Piping","Electrical","Instrumentation","Process"] },
    { "key": "rev", "header": "Rev", "col": "E", "field": "DocumentRevision.RevCode", "required": true, "type": "string" },
    { "key": "status", "header": "Status", "col": "F", "field": "Document.Status", "required": true, "type": "enum", "enum": ["Draft","Issued","C1","C2","C3","C4","Approved","IFC"] },
    { "key": "reviewCode", "header": "Code", "col": "G", "field": "DocumentRevision.ReviewCode", "required": false, "type": "enum", "enum": ["C1","C2","C3","C4"] }
  ],
  "unique": ["docNumber"],
  "checksumCells": ["A1"]
}
```

سازگاری: هر `field` باید FormFieldDefinition یا ستون Document/Revision باشد (Loop2).

---

## اعتبارسنجی سلول‌محور
ترتیب: required → type → pattern/enum → unique در Batch → unique در DB.
کد خطا: `REQUIRED`, `TYPE`, `PATTERN`, `ENUM`, `DUP_BATCH`, `DUP_DB`, `META_MISSING`, `VERSION_MISMATCH`, `MIGRATION_FAILED`.
پیام دوزبانه در ImportError.MessageFa/En.

---

## Round-Trip
Export(C) → ویرایش آفلاین → Import(B):
- کلید پایدار: DocNumber + Project از `_META`.
- سلول غیرmapped دست نخورده می‌ماند (فرمت).
- تداخل: اگر Revision در DB جدیدتر از exportedAt → خطا `STALE` مگر Force با نقش Document Control.

---

## نسخه قالب و Migration Map
```json
{
  "from": 2,
  "to": 3,
  "ops": [
    { "op": "renameHeader", "from": "DocNo", "to": "Doc No" },
    { "op": "addColumn", "key": "reviewCode", "default": null },
    { "op": "mapEnum", "key": "status", "map": { "IFA": "Issued" } }
  ]
}
```
اگر Map نباشد Import متوقف.

---

## شیت مخفی `_META`
| Cell | مقدار |
|---|---|
| A1 | PMIS_META |
| B1 | templateId |
| C1 | version |
| D1 | projectCode |
| E1 | exportedAt ISO |
| F1 | sha256 |

کاربر عادی Hide. دستکاری → `META_TAMPER`.

---

## شبه‌کد Parser
```
function parse(file, template):
  wb = openXlsx(file)
  meta = readSheet(wb, "_META")
  assert meta.A1 == "PMIS_META" else error META_MISSING
  if meta.version != template.version: applyMigration or fail
  sheet = wb[template.sheet]
  errors = []
  rows = []
  for r in dataStartRow..lastRow:
    rec = {}
    for col in template.columns:
      raw = sheet[col.col + r]
      v, err = validateCell(raw, col)
      if err: errors.push(row=r, column=col.key, code=err)
      else rec[col.key] = v
    rows.push(rec)
  if unique dup in rows: errors DUP_BATCH
  return { rows, errors }
```

## شبه‌کد Renderer
```
function render(query, template):
  wb = openXlsx(template.file)  // keep styles
  rows = db.fetch(query)
  r = template.dataStartRow
  for rec in rows:
    for col in template.columns:
      writeValueKeepStyle(wb, col.col + r, rec[col.field])
    r++
  writeMeta(wb)
  return wb.bytes
```

کتابخانه فعلی Arena: `xlsx` در API (نه مرورگر به‌عنوان SoT).

---

## Self-Validation D3
Loop1: سه سناریو A/B/C ✓ آفلاین با قالب نسخه‌دار ✓ دوزبانه خطا ✓ Evidence فایل ✓  
Loop2: MappingSchema.field با D2 FormField/Document ✓ Status enum با Workflow D2 ✓ ImportError کدها با Validation ✓  
Loop3: xlsx/ExcelJS عملی ✓ Round-Trip با keep style ✓  
Loop4: آپلود API؛ فایل checksum؛ IDOR با project در META در برابر JWT scope (D8)  
Loop5: قالب MDR می‌تواند سندهای ۱۰ حوزه را در Type جدا ثبت کند  

Gap: موتور واقعی هنوز UI دمو است نه Commit SQL — پیاده‌سازی فاز MVP پس از D9.
