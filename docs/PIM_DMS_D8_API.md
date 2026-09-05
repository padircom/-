# Deliverable 8 — API Design
خلاصه: REST روی Express موجود. مرورگر SQL نمی‌بیند. نام Entity با D2 یکی است. Auth + ABAC از D6. Rate limit موجود.

Base: `/api/v1`  (PORT فعلی server `.env` = 5000)
Envelope: `{ ok, data, error: { code, messageFa, messageEn }, page?: { offset, limit, total } }`

---

## Authentication Flow
1. Login موجود Arena → session/JWT شامل `sub, role, projects[], disciplines[], clearance`.
2. Header `Authorization: Bearer`.
3. هر درخواست: ABAC (D6). منبع project از JWT نه body.
4. Expiry؛ 401 `TOKEN_EXPIRED`. Refresh جدا اگر در AuthContext اضافه شود.

---

## Endpoints (≥30)

### Documents
1. `GET /projects/:projectId/documents` query: disc,type,status,q,offset,limit
2. `GET /documents/:id`
3. `POST /projects/:projectId/documents` body: typeId,titleFa,titleEn,discipline,docNumber?
4. `PATCH /documents/:id` titles/confidentiality
5. `POST /documents/:id/issue`
6. `GET /documents/:id/revisions`
7. `POST /documents/:id/revisions` multipart file + revCode + changeNote
8. `GET /revisions/:id/file` watermarked
9. `GET /revisions/:id/file/raw` DC only + audit

### Numbering
10. `GET /projects/:projectId/number-rules`
11. `POST /projects/:projectId/number-rules`
12. `POST /number-rules/:id/reserve` body: discipline,typeId → `{ number, expiresAt }`
13. `POST /reservations/:id/consume` body: documentId
14. `POST /reservations/:id/cancel`

### Workflow
15. `GET /workflow-defs`
16. `POST /documents/:id/workflow/start` body: defId
17. `GET /workflow-instances/:id`
18. `POST /workflow-tasks/:id/act` body: code C1–C4, comment
19. `POST /workflow-tasks/:id/delegate` body: toUserId
20. `GET /me/tasks` query: overdue,offset,limit

### Excel
21. `POST /excel/templates` file + mappingSchema
22. `POST /excel/templates/:id/import` file → batch
23. `GET /excel/batches/:id`
24. `GET /excel/batches/:id/errors`
25. `POST /excel/export` body: projectId,filters,templateId → file

### Transmittal / Correspondence / Knowledge
26. `GET /projects/:projectId/transmittals`
27. `POST /projects/:projectId/transmittals` body: purpose,recipient,revisionIds[]
28. `POST /transmittals/:id/ack`
29. `GET /projects/:projectId/correspondence`
30. `POST /projects/:projectId/correspondence`
31. `GET /projects/:projectId/lessons`
32. `POST /projects/:projectId/lessons`

### Search / Reports / Audit
33. `GET /projects/:projectId/search` q,facets
34. `GET /projects/:projectId/reports/:reportKey` reportKey=1..15 D7
35. `GET /projects/:projectId/kpis`
36. `GET /audit` admin/audit.view

خطای استاندارد: 400 VALIDATION, 401, 403 FORBIDDEN, 404 (Secret→404), 409 STALE/DUP, 429 RATE, 500.

نمونه پاسخ GET document:
```json
{
  "ok": true,
  "data": {
    "id": "...",
    "docNumber": "OG-2401-CIV-DR-001",
    "titleFa": "نقشه تفصیلی فونداسیون",
    "status": "Approved",
    "currentRev": "Rev-02"
  }
}
```

نمونه act:
```json
{ "code": "C2", "comment": "اصلاح تراز فونداسیون" }
```

---

## Webhooks
رویداد: `document.issued`, `workflow.code`, `workflow.escalated`, `transmittal.sent`, `import.committed`, `audit.break`
POST JSON امضاشده HMAC `X-PMIS-Signature`. Retry 3. Failure در جدول WebhookDelivery.

---

## Rate Limiting
موجود express-rate-limit: پیش‌فرض 120/min/IP؛ upload 20/min؛ export 30/min.
429 با Retry-After.

---

## Self-Validation D8
Loop1: CRUD سند/نسخه/TR/نامه/درس/اکسل/رزرو/گزارش ✓ آفلاین بعداً همان API از syncQueue  
Loop2: مسیرها با Entity D2 ✓ Status/Code با D5 ✓ Permission names با D6 ✓ گزارش با D7  
Loop3: صفحه‌بندی روی list ✓  
Loop4: IDOR projectId، raw file محدود، parameterized، rate limit، watermark endpoint جدا ✓  
Loop5: typeId هر ۱۰ حوزه  

Gap: OpenAPI yaml هنوز تولید نشده — فاز پیاده‌سازی.
