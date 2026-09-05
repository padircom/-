# فاز F2 — User Stories (پس از MVP)
پیش‌نیاز کلی: **F1 MVP Go-Live پایلوت** (D9). ظاهر/فونت سراسری Arena تغییر نمی‌کند.

نقش‌ها: Document Controller (DC), Originator, Discipline Lead, Consultant, PMC, Admin, DBA, Integrator, Viewer.

امتیاز: فیبوناچی ۱،۲،۳،۵،۸،۱۳،۲۱  
اولویت: Must / Should / Could / Won't

---

### F2-01 ClamAV on upload
**As a** Admin, **I want** every uploaded file scanned for malware **so that** evidence store is not a vector.
- **SP:** 8 · **Priority:** Must · **Deps:** F1-06 upload, G1
- **AC:**
  - Given a clean PDF, When uploaded, Then `virus_scan_status=Clean` and revision is usable.
  - Given an EICAR test file, When uploaded, Then status=`Blocked`, file not downloadable, Audit `FILE_BLOCKED`.

### F2-02 Async virus queue
**As a** Originator, **I want** upload to return immediately while scan runs **so that** UI does not hang.
- **SP:** 5 · **Priority:** Must · **Deps:** F2-01
- **AC:**
  - Given Pending scan, When I GET document, Then revision shows Pending and download of content is denied.
  - Given scan completes Clean, When I refresh, Then download is allowed.

### F2-03 PDF dynamic watermark
**As a** DC, **I want** preview/download PDFs stamped with user/project/time/docNumber **so that** leaks are traceable.
- **SP:** 8 · **Priority:** Must · **Deps:** F1-07, D6
- **AC:**
  - Given Viewer downloads watermarked PDF, When opened, Then stamp text includes displayName and docNumber.
  - Given DC downloads `/file/raw`, When audited, Then `FILE_RAW_DOWNLOAD` exists and file has no stamp.

### F2-04 Image watermark
**As a** Viewer, **I want** PNG/JPEG previews watermarked **so that** screenshots still carry identity.
- **SP:** 5 · **Priority:** Should · **Deps:** F2-03
- **AC:**
  - Given a PNG revision, When previewed, Then overlay is tiled and original bytes are not exposed.

### F2-05 OCR job after Clean scan
**As a** DC, **I want** scanned drawings OCR-indexed **so that** search finds text inside images/PDFs.
- **SP:** 13 · **Priority:** Must · **Deps:** F2-01, tesseract on API
- **AC:**
  - Given Clean PDF with text “P-101”, When OCR job finishes, Then search `q=P-101` returns the document.
  - Given OCR Pending, When search runs, Then only metadata matches, not body.

### F2-06 OCR language fa+en
**As a** Originator, **I want** OCR in Persian and English **so that** bilingual title blocks are searchable.
- **SP:** 5 · **Priority:** Should · **Deps:** F2-05
- **AC:**
  - Given a sheet with فارسی title, When indexed, Then `q` in fa returns it.
  - Given failure, When job errors, Then Audit `OCR_FAIL` and document remains searchable by metadata.

### F2-07 Working calendar SLA
**As a** PMC, **I want** task due dates using 08:00–16:00 project calendar **so that** SLA is not 24×7.
- **SP:** 8 · **Priority:** Must · **Deps:** F1-08/09, G5
- **AC:**
  - Given SLA 8h and submit Friday 15:00, When calendar is 08–16, Then due is next working day 15:00.
  - Given holiday list, When computing due, Then those dates are skipped.

### F2-08 Escalation on calendar
**As a** Discipline Lead, **I want** overdue tasks escalated after SLA+buffer **so that** stuck reviews move.
- **SP:** 5 · **Priority:** Must · **Deps:** F2-07
- **AC:**
  - Given Open task past DueAt+EscalationHours, When job runs, Then assignee becomes EscalationRole and Audit `WF_ESCALATED`.
  - Given task Done, When job runs, Then no escalate.

### F2-09 Holiday master
**As a** Admin, **I want** to maintain project holidays **so that** SLA calendar is accurate.
- **SP:** 3 · **Priority:** Should · **Deps:** F2-07
- **AC:**
  - Given I add 1403/01/01, When SLA computes, Then that day is excluded.
  - Given Viewer, When POST holiday, Then 403.

### F2-10 Webhook HMAC
**As a** Integrator, **I want** signed webhooks for issued/code/escalated/transmittal/import **so that** ERP can react.
- **SP:** 8 · **Priority:** Must · **Deps:** F1 issue/act/TR/import, D8
- **AC:**
  - Given endpoint registered, When document issued, Then POST JSON with `X-PMIS-Signature` HMAC.
  - Given wrong secret, When receiver verifies, Then signature fails (documented).

### F2-11 Webhook retry
**As a** Integrator, **I want** 3 retries recorded in WebhookDelivery **so that** transient outages are survived.
- **SP:** 5 · **Priority:** Must · **Deps:** F2-10
- **AC:**
  - Given 500 from consumer, When retries exhaust, Then status=Failed and attempts=3.
  - Given success on 2nd try, Then status=Delivered.

### F2-12 OpenAPI served
**As a** Integrator, **I want** `/api/v1/openapi.yaml` matching D8 **so that** clients generate SDKs.
- **SP:** 3 · **Priority:** Must · **Deps:** `docs/openapi/pim-edms-v1.yaml`
- **AC:**
  - Given unauthenticated GET of spec, When allowed (public spec), Then 200 YAML.
  - Given a listed path, When compared to running router, Then no missing Must endpoints from F1+F2.

### F2-13 FormTemplate API
**As a** DC, **I want** CRUD FormTemplate/Field **so that** Excel mapping binds to fields without SQL.
- **SP:** 8 · **Priority:** Should · **Deps:** D2/D8 gap G9
- **AC:**
  - Given DC, When POST template+fields, Then GET returns them with JSON validation.
  - Given Viewer, When POST, Then 403.

### F2-14 UserProxy API
**As a** Consultant, **I want** a dated proxy **so that** leave does not stall Code 1–4.
- **SP:** 5 · **Priority:** Should · **Deps:** F1-09, D5
- **AC:**
  - Given proxy A→B this week, When new task assigns, Then assignee is B and Audit shows on-behalf.
  - Given chained proxy B→C, When save, Then 400 (one level only).

### F2-15 Retention policy API
**As a** Admin, **I want** years+legalHold per DocumentType **so that** archive is controlled.
- **SP:** 5 · **Priority:** Could · **Deps:** G9, F3 also uses
- **AC:**
  - Given legalHold=true, When archive job runs, Then document is not deleted.
  - Given years elapsed and no hold, When job runs, Then status=Archived (no physical delete in F2).

### F2-16 Audit hash verify job
**As a** Admin, **I want** nightly hash-chain verification **so that** tampering is detected.
- **SP:** 5 · **Priority:** Must · **Deps:** F1-21 stub hash
- **AC:**
  - Given intact chain, When job runs, Then no alert.
  - Given altered payload, When job runs, Then `AUDIT_BREAK` critical notification.

### F2-17 Reservation expiry job
**As a** DC, **I want** expired unused reservations released **so that** inbox of reserves stays clean (SEQ does not rewind).
- **SP:** 3 · **Priority:** Must · **Deps:** F1-04/05, G7
- **AC:**
  - Given reservation past validity and not consumed, When job runs, Then it is expired and number is not reissued.
  - Given consumed reservation, When job runs, Then untouched.

### F2-18 Email on TASK_ASSIGNED
**As a** Assignee, **I want** email when a review task is assigned **so that** I do not live in the app.
- **SP:** 5 · **Priority:** Should · **Deps:** F1-08, nodemailer
- **AC:**
  - Given SMTP configured, When task created, Then one email with docNumber and dueAt.
  - Given SMTP down, When assign, Then API still 201 and queue retries.

### F2-19 Email overdue
**As a** Lead, **I want** overdue mails **so that** SLA breaches are visible outside UI.
- **SP:** 3 · **Priority:** Should · **Deps:** F2-08, F2-18
- **AC:**
  - Given overdue task, When escalation job runs, Then Lead email sent once per day max.

### F2-20 Secret 404 not 403
**As a** Security Officer, **I want** Secret documents to 404 for low clearance **so that** existence is not enumerated.
- **SP:** 3 · **Priority:** Must · **Deps:** F1-20 ABAC
- **AC:**
  - Given Secret doc and Viewer Internal, When GET by id, Then 404 NOT_FOUND.
  - Given same user list MDR, When filtered, Then row absent.

### F2-21 Full-text title+comment
**As a** DC, **I want** FTS across titles and comment sheets **so that** review remarks are findable before OCR.
- **SP:** 5 · **Priority:** Should · **Deps:** F1-17 facet search, PG GIN or SQL FTS
- **AC:**
  - Given comment “تراز فونداسیون”, When `q=تراز`, Then document appears.
  - Given offset/limit, When total>limit, Then page.total is correct.

### F2-22 Report pack 3-5-9-10
**As a** PMC, **I want** overdue, review-code, cycle-time, rejection reports **so that** F2 management works without waiting F3 all-15.
- **SP:** 8 · **Priority:** Must · **Deps:** F1-18 KPI, D7 #3 #4 #9 #10
- **AC:**
  - Given project filter, When GET reportKey=3, Then only that project’s overdue tasks.
  - Given empty set, When GET, Then 200 data=[] page.total=0.

### F2-23 Transmittal overdue state
**As a** DC, **I want** Sent transmittals without Ack past SLA marked Overdue **so that** distribution delays show.
- **SP:** 3 · **Priority:** Should · **Deps:** F1-11, F2-07
- **AC:**
  - Given Sent and SLA miss, When job runs, Then status=Overdue.
  - Given later Ack, When POST ack, Then status=Ack.

### F2-24 OpenAPI vs router CI
**As a** Tech Lead, **I want** CI to fail if router misses spec paths **so that** D8 does not drift.
- **SP:** 5 · **Priority:** Could · **Deps:** F2-12
- **AC:**
  - Given a path in YAML not in Express, When CI runs, Then job fails.
  - Given extra router path, When CI runs, Then warning only.

### F2-25 Rate limit headers documented live
**As a** Integrator, **I want** 429 with Retry-After on upload/export **so that** clients back off.
- **SP:** 2 · **Priority:** Should · **Deps:** existing limiter
- **AC:**
  - Given 21st upload in a minute, When POST revision, Then 429 error.code=RATE and Retry-After integer.

### F2-26 Discipline ABAC on act
**As a** Mechanical Lead, **I want** to be forbidden from acting ELE tasks **so that** ABAC matches RACI.
- **SP:** 5 · **Priority:** Must · **Deps:** F1-09, F1-20, G6 roles
- **AC:**
  - Given user disciplines=[MEC], When act on ELE task, Then 403.
  - Given DC, When act, Then allowed per matrix.

### F2-27 Mapping migration map
**As a** DC, **I want** v2 Excel files auto-migrated to v3 **so that** site workbooks still import.
- **SP:** 8 · **Priority:** Should · **Deps:** F1-15 import, D3
- **AC:**
  - Given template v3 and file META version=2 with map, When import, Then columns renamed and batch can Commit.
  - Given no map, When import, Then Failed code=MIGRATION_FAILED.

### F2-28 STALE round-trip
**As a** Originator, **I want** import rejected if DB revision newer than META exportedAt **so that** overwrites are safe.
- **SP:** 5 · **Priority:** Must · **Deps:** F1-16 export, F1-15
- **AC:**
  - Given exportedAt < current revision issuedAt, When import, Then 409 STALE.
  - Given DC Force flag, When import, Then Commit and Audit `IMPORT_FORCE`.

### F2-29 Notification in-app for escalate
**As a** EscalationRole, **I want** in-app notification plus email **so that** I see breaches in Arena alerts.
- **SP:** 3 · **Priority:** Should · **Deps:** F2-08, NotificationOpsPanel
- **AC:**
  - Given escalate, When I open alerts, Then an item with docNumber exists.
  - Given bilingual UI, When lang=en, Then message is English.

### F2-30 Won't: microservice split
**As a** Tech Lead, **I want** to keep modular monolith in F2 **so that** we do not pay distributed complexity yet.
- **SP:** 0 · **Priority:** Won't · **Deps:** D1 ADR
- **AC:**
  - Given F2 scope, When planning, Then no separate WF service deployment is scheduled.

### F2-31 Audit partition ops (PG/SQL)
**As a** DBA, **I want** a runbook to add next month audit partition **so that** inserts never fail default overflow unnoticed.
- **SP:** 2 · **Priority:** Should · **Deps:** V010 if PG; SQL equivalent if Arena SS
- **AC:**
  - Given month end, When runbook executed, Then new partition/filegroup exists before first insert.

### F2-32 Health of OCR/virus workers
**As a** Admin, **I want** readiness checks for scan/OCR workers **so that** ops see backlog.
- **SP:** 3 · **Priority:** Could · **Deps:** F2-02, F2-05
- **AC:**
  - Given queue depth>100, When GET health, Then status=degraded.
  - Given workers down, When GET health, Then 503 on that component not whole API.

### F2-33 Seed 33 types in prod-like
**As a** BA, **I want** all 33 DocumentTypes seeded **so that** MDR types are selectable without extra UI work.
- **SP:** 2 · **Priority:** Must · **Deps:** V013 / G12
- **AC:**
  - Given empty type table, When F2 migrate/seed, Then 33 codes exist including CHARTER..LESSON.
  - Given duplicate seed, When rerun, Then no unique error.

---

## جمع
| Priority | تعداد | SP (تقریبی) |
|---|---|---|
| Must | 14 | ~82 |
| Should | 13 | ~52 |
| Could | 4 | ~16 |
| Won't | 1 | 0 |

**جمع SP فعال (بدون Won't): ~۱۵۰** → با همان تیم MVP حدود **۴–۵ هفته F2** اگر Must اول انجام شود (هم‌راستا با گانت ~۲۱ روز هسته؛ Should بخشی به F3 می‌رود).

ترتیب پیشنهادی Must: F2-33 → F2-01/02 → F2-20/26 → F2-07/08 → F2-03 → F2-16/17 → F2-10/11 → F2-05 → F2-12 → F2-22 → F2-28.
