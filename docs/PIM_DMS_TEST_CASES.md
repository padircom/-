# PIM/EDMS — Test Cases
پوشش: Numbering, Excel A/B/C, Workflow C1–4, Document/Revision, ABAC, Search, Transmittal, Audit.
قرارداد: Excel ظرف است. ظاهر سایدبار اصلی نباید در E2E عوض شود.

شناسه: `U` واحد · `I` یکپارچه · `E` انتهابه‌انتها · `P` کارایی · `S` امنیت · `X` لبه/خطا

---

## A) Unit Tests (۵۸)

### Numbering (U01–U12)
| ID | Case | Expected |
|---|---|---|
| U01 | pad(7,3) | `007` |
| U02 | pad(1000,3) | بدون برش خاموش؛ خطا یا pad پویا طبق Rule |
| U03 | token PROJ از Project.Code | `OG-2401` |
| U04 | DISC Civil → CIV | از lookup |
| U05 | TYPE Drawing → DR | |
| U06 | pattern `{PROJ}-{DISC}-{TYPE}-{SEQ:3}` + seq 1 | `OG-2401-CIV-DR-001` |
| U07 | توکن ناشناخته `{FOO}` | throw `BAD_PATTERN` |
| U08 | SEQ عقب نرود بعد از expire reserve | next_value همان |
| U09 | consume شماره ≠ reserved | `RESERVE_MISMATCH` |
| U10 | cancel consumed | reject |
| U11 | scope_key Project\|Rule\|CIV\|DR | پایدار |
| U12 | YEAR شمسی تنظیم پروژه | `1403` نه Gregorian اگر calendar=jalali |

### Excel validateCell (U13–U28)
| ID | Case | Expected |
|---|---|---|
| U13 | required empty | REQUIRED |
| U14 | type number on "x" | TYPE |
| U15 | pattern Doc No | PATTERN |
| U16 | enum Disc=HVAC | ENUM |
| U17 | status IFA without migration | ENUM or map |
| U18 | unique dup in batch two rows | DUP_BATCH |
| U19 | META A1 ≠ PMIS_META | META_TAMPER/MISSING |
| U20 | version 2 without map | MIGRATION_FAILED |
| U21 | renameHeader DocNo→Doc No | cell binds |
| U22 | mapEnum IFA→Issued | Issued |
| U23 | partialAllowed false + 1 error | batch not committable |
| U24 | writeValueKeepStyle leaves merge | style object unchanged (mock) |
| U25 | checksum META mismatch | META_TAMPER |
| U26 | extra unmapped column ignored | no error |
| U27 | bilingual error codes in catalog | fa+en present |
| U28 | JSON MappingSchema missing columns | VALIDATION |

### Workflow (U29–U40)
| ID | Case | Expected |
|---|---|---|
| U29 | C1 → Approved | status Approved |
| U30 | C2 without comment | invalid |
| U31 | C3 → new rev path Issued | |
| U32 | C4 → Void | |
| U33 | Parallel All + one C4 | short-circuit cancel others |
| U34 | Sequential step 2 before 1 Done | reject |
| U35 | SLA 8h Fri 15:00 calendar 8–16 | due next workday 15:00 |
| U36 | holiday skip | |
| U37 | proxy one level | assignee B |
| U38 | proxy chain B→C | reject |
| U39 | escalate Open past due+buffer | EscalationRole |
| U40 | escalate Done | no-op |

### Document/ABAC helpers (U41–U50)
| ID | Case | Expected |
|---|---|---|
| U41 | clearance Internal vs Secret | deny |
| U42 | project not in scope | deny |
| U43 | disc MEC vs ELE resource | deny |
| U44 | DC bypass disc | allow per matrix |
| U45 | Secret list filter hides row | |
| U46 | watermark string format | name\|id\|code\|ts\|docNo |
| U47 | sha256 stable | same bytes same hash |
| U48 | envelope error bilingual | messageFa/En |
| U49 | page clamp limit>200 → 200 | |
| U50 | offset<0 → 0 | |

### Misc unit (U51–U58)
| ID | Case | Expected |
|---|---|---|
| U51 | tsvector title_fa weight A | search ranks title first |
| U52 | reportKey 0 | VALIDATION |
| U53 | reportKey 16 | VALIDATION |
| U54 | transmittal Ack from Sent | Ack |
| U55 | Ack from Draft | invalid |
| U56 | lesson requires lessonFa/En | |
| U57 | hash chain first prev=0×00 | |
| U58 | hash(payload) changes if payload mutates | verify fail |

---

## B) Integration Tests (۲۴)

| ID | Scenario | Given / When / Then |
|---|---|---|
| I01 | Reserve race | Two tx UPDLOCK same scope When both commit Then numbers consecutive unique |
| I02 | Create+consume | Reserve 001 When create doc with 001 Then Consumed and Draft |
| I03 | Issue path | Draft When POST issue Then Issued + audit |
| I04 | Revision upload | MIME pdf When POST multipart Then checksum stored virus Pending/Clean |
| I05 | Blocked virus | EICAR When scanned Then cannot GET file |
| I06 | Start IFA | Issued doc When start def IFA-ENG Then task for consultant |
| I07 | Act C2 | Task + comment When act Then status C2 comment_sheet row |
| I08 | IDOR project | Token project A When GET doc of B Then 403/404 |
| I09 | Import fail all | 1 bad cell partialAllowed=false When import Then Failed no Document insert |
| I10 | Import commit | valid MDR When import Then N documents + Evidence file |
| I11 | Export roundtrip | export then import same META When no edits Then 0 errors |
| I12 | STALE | export, then new rev in DB, import old When Then 409 STALE |
| I13 | TR send ack | POST TR + revisions When ack Then AckAt set |
| I14 | Letter action | actionRequired When list action report Then due visible |
| I15 | Search facet | disc=CIV When search Then only CIV |
| I16 | KPI reject | 1 C4 of 4 issued When kpis Then rejectRate=0.25 |
| I17 | /me/tasks overdue | due yesterday When overdue=true Then included |
| I18 | Delegate | act as proxy B When Then Audit on-behalf A |
| I19 | Webhook issued | endpoint up When issue Then delivery Delivered HMAC ok |
| I20 | Webhook retry | endpoint 500 When Then attempts 3 Failed |
| I21 | Audit append | UPDATE audit Then fail at DB privilege |
| I22 | Excel template A | upload xlsx+schema When Then _META writable version=1 |
| I23 | Pagination | 120 docs limit 50 When offset 50 Then 50 rows total 120 |
| I24 | Seed 33 types | migrate V013 When count document_type Then 33 |

---

## C) E2E Tests Playwright (۱۲)
baseURL فرانت؛ پروژه OG-2401؛ کاربر DC.

| ID | Scenario | Steps / Then |
|---|---|---|
| E01 | سایدبار اصلی | باز d1 Then فقط ۵ سرتیتر؛ اکسل/شماره در سایدبار اصلی نیست |
| E02 | ورود حوزه | صنعت+پروژه+ورود Then صفحه d1 DocumentWorkspace |
| E03 | زیرماژول EDMS | کلیک شماره‌گذاری در سایدبار داخلی Then UI رزرو |
| E04 | ثبت MDR | فرم کد/عنوان/ثبت Then ردیف در جدول |
| E05 | مکاتبات | زیرفرآیند مکاتبات Then نامه نمونه |
| E06 | ترانسمیتال | Then وضعیت ارسال/رسید |
| E07 | درس‌آموخته | Then کارت دانش |
| E08 | گردش کار | Engineering → Code 1–4 Then تسک‌ها |
| E09 | زبان EN | سوییچ EN Then برچسب‌ها انگلیسی فونت Vazirmatn |
| E10 | Access denied | نقش بدون project.view Then 🔒 دسترسی غیرمجاز |
| E11 | تم dark/light | سوییچ Then data-theme عوض، حلقه PMBOK نشکند |
| E12 | IDOR UI | دستکاری URL پروژه غریبه Then عدم داده/403 نه MDR دیگران |

---

## D) Edge & Error Handling (۲۰) — علاوه بر واحد

| ID | Case | Then |
|---|---|---|
| X01 | فایل 0 بایت | 400 |
| X02 | MIME exe | 400 allowlist |
| X03 | over MAX_FILE_MB | 400 |
| X04 | JWT expired | 401 TOKEN_EXPIRED |
| X05 | missing Bearer | 401 |
| X06 | limit=0 | 400 or clamp |
| X07 | UUID malformed | 400 |
| X08 | concurrent issue twice | 409 |
| X09 | act on others' task | 403 |
| X10 | C1 then another act | 409 |
| X11 | import without _META admin override | only admin else META_MISSING |
| X12 | duplicate letter_no | 409 |
| X13 | TR empty revisionIds | 400 |
| X14 | reserve type without rule | 400 |
| X15 | DB deadlock SEQ | retry 3 then 500 SEQ_LOCK_TIMEOUT |
| X16 | OCR fail | metadata search still works |
| X17 | SMTP down | assign still 201 |
| X18 | Secret GET | 404 not 403 |
| X19 | raw file as Viewer | 403 |
| X20 | comment only whitespace C2 | 400 |

---

## E) Performance (۱۰)

| ID | Target |
|---|---|
| P01 | GET MDR 50k rows paged 50: p95 < 1.5s |
| P02 | Search q trigram p95 < 1.5s |
| P03 | 50 parallel reserve same scope: unique monotonic, p95 < 500ms |
| P04 | Import 10k rows validate < 60s |
| P05 | Export 10k keep-style < 60s |
| P06 | Upload 25MB p95 < 8s excluding virus |
| P07 | KPI aggregate p95 < 1s with indexes |
| P08 | Audit insert 100/s no block API |
| P09 | FTS comment 50k p95 < 2s |
| P10 | Soak 30min 20 RPS list+get error rate < 0.1% |

---

## F) Security Tests (۱۸)

| ID | Case | Then |
|---|---|---|
| S01 | SQLi in `q` | parameterized, 200 empty or results not dump |
| S02 | path traversal original_name | stored sanitized |
| S03 | IDOR UUID guess | 403/404 |
| S04 | JWT tamper role=admin | 401 |
| S05 | CSRF cookie-only | Bearer required |
| S06 | XSS titleFa in UI | escaped, no script |
| S07 | rate 21 upload/min | 429 Retry-After |
| S08 | watermark bypass via static URL | no static expose |
| S09 | raw download Viewer | 403 + no file |
| S10 | Secret enumeration | 404 |
| S11 | mass assignment status=Approved on PATCH | ignored |
| S12 | HMAC webhook forged | reject consumer-side; server still signs canonical |
| S13 | audit UPDATE as app role | denied |
| S14 | file content-type sniff mismatch | 400 |
| S15 | SSRF in webhook URL file:// | reject on register |
| S16 | open redirect n/a | N/A API JSON |
| S17 | privilege escalate via body projectId | JWT project wins |
| S18 | verbose 500 stack to client | no stack in envelope |

---

## جمع
| لایه | تعداد |
|---|---|
| Unit | 58 |
| Integration | 24 |
| E2E | 12 |
| Edge/Error | 20 |
| Performance | 10 |
| Security | 18 |
| **کل** | **142** |

ابزار پیشنهادی: Vitest/Jest واحد · API integration روی Express+DB تست · Playwright `tests/e2e` موجود · k6/Artillery برای P · OWASP ZAP سبک برای S.

اولویت اتوماسیون MVP: U01–U11, U13–U23, U29–U32, I01, I08, I09, E01, E02, S01, S03, S17.
