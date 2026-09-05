# Deliverable 4 — Document Numbering Engine
خلاصه: شماره از Rule پیکربندی‌پذیر ساخته می‌شود؛ SEQ فقط در SQL با قفل ردیف. رزرو قبل از ثبت مدرک. هم‌تراز D2: NumberRule, NumberSequence, NumberReservation.

وضعیت پس از رزرو: `Reserved` تا مصرف یا انقضا.

---

## Rule Builder — توکن‌ها
الگو نمونه: `{PROJ}-{DISC}-{TYPE}-{SEQ:3}`

| توکن | منبع | مثال |
|---|---|---|
| PROJ | Project.Code | OG-2401 |
| DISC | Document.Discipline کد ۳حرفی | CIV |
| TYPE | DocumentType.Code | DR |
| SEQ:n | NumberSequence.NextValue zero-pad n | 001 |
| YEAR | تقویم پروژه (شمسی یا میلادی طبق تنظیم) | 1403 |
| ORIG | Originator (CON/CLT/PMC) | CON |
| WBS | کد بسته کاری اختیاری | 2.1 |
| LITERAL | متن ثابت در الگو | - |

قانون در NumberRule.Pattern. توکن ناشناخته → ذخیره قالب Fail.

---

## جداول مرجع توکن
**DisciplineCode:** Civil=CIV, Mechanical=MEC, Piping=PIP, Electrical=ELE, Instrumentation=INS, Process=PRO  
**TypeCode:** DR, DS, ISO, SLD, LTR, TR, NCR, MOM, SPC, ITP  
**OriginatorCode:** CLT, CON, PMC, VEN  
ScopeKey برای SEQ = `ProjectId|RuleId|DISC|TYPE` (قابل پیکربندی روی Rule.Scope = Project / Disc / Type).

---

## الگوریتم SEQ (Race-safe)
```
function nextSeq(ruleId, scopeKey, n):
  BEGIN TRAN
    row = SELECT NextValue FROM NumberSequence
          WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          WHERE RuleId=@ruleId AND ScopeKey=@scopeKey
    if not row:
      INSERT (RuleId, ScopeKey, NextValue=1)
      seq = 1
    else:
      seq = row.NextValue
      UPDATE NumberSequence SET NextValue = seq+1 WHERE ...
  COMMIT
  return pad(seq, n)
```
بدون UPDLOCK دو کاربر همان 001 می‌گیرند. در SQL Server این الگو اجباری است.

خطا: timeout قفل → `SEQ_LOCK_TIMEOUT` retry 3.

---

## Reserve Number
1. Document Control «رزرو» می‌زند (قبل از وجود فایل).
2. `nextSeq` مصرف می‌شود؛ ردیف NumberReservation: Number, ExpiresAt (پیش‌فرض ۴۸h), ConsumedByDocumentId null.
3. سند با همان شماره ثبت → Consumed، Status از Reserved به Draft.
4. انقضا بدون مصرف → Job آزادسازی؛ **SEQ عقب نمی‌رود** (جلوگیری از برخورد با شماره صادرشده).
5. Cancel دستی فقط اگر Consumed نباشد.

خطا: رزرو تکراری همان Number → `RESERVE_DUP`. مصرف شماره دیگری → `RESERVE_MISMATCH`.

---

## پنج نمونه

**1. نقشه مهندسی**  
Rule: `{PROJ}-{DISC}-{TYPE}-{SEQ:3}`  
→ `OG-2401-CIV-DR-001`

**2. Data Sheet**  
→ `OG-2401-MEC-DS-004`

**3. نامه**  
Rule: `{PROJ}-LTR-{YEAR}-{SEQ:4}`  
→ `OG-2401-LTR-1403-0104`

**4. ترانسمیتال**  
Rule: `TR-{PROJ}-{SEQ:3}`  
→ `TR-OG-2401-042`

**5. NCR کیفیت**  
Rule: `{PROJ}-{DISC}-NCR-{SEQ:3}`  
→ `OG-2401-ELE-NCR-007`

همه TYPEها از DocumentType D2 (از جمله ۳۳ سند PMBOK) به یک NumberRule وصل می‌شوند.

---

## UI صفحه d1
زیرماژول «شماره‌گذاری مدارک» زیر EDMS (نه سایدبار اصلی). دکمه Reserve next فقط شبیه‌سازی UI است؛ تولید واقعی در API+SQL.

---

## Self-Validation D4
Loop1: انواع سند از D2 قابل شماره‌گذاری ✓ آفلاین: رزرو قبلی روی کاغذ/اکسل بعداً Consume با همان Number ✓  
Loop2: نام NumberRule/Sequence با D2 ✓ DocumentType با TYPE یکی است ✓ Status Reserved در مجموعه D2 است ✓  
Loop3: Race با UPDLOCK حل شد ✓ SEQ عقب نمی‌رود ✓  
Loop4: رزرو فقط نقش Document Control؛ IDOR با ProjectId در ScopeKey  
Loop5: نقشه/نامه/NCR/ترانسمیتال/DS برای Quality, Communications, Procurement قابل گسترش است  

Gap: Job انقضای رزرو باید در server cron فاز MVP بیاید.
