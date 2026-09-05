# Deliverable 6 — امنیت و دسترسی
خلاصه: RBAC + ABAC. محرمانگی در API نه فقط UI. Watermark پویا. Audit زنجیره هش. Retention. هم‌تراز D2 (AppUser, Role, Permission, UserProjectScope, AuditLog) و D5 (نقش‌های گردش کار).

---

## RBAC
نقش‌های پایه:
`admin | document_controller | discipline_lead | consultant | pmc | originator | viewer | project_manager`

نگاشت به AuthContext فعلی Arena: admin, project_manager, planner — نقش‌های EDMS به‌صورت RoleCode گسترش یا claim جدا.

Permission نمونه:
`document.view | document.create | document.issue | document.reserve | workflow.act | transmittal.send | excel.import | excel.export | audit.view | security.manage`

---

## ABAC (روی هر درخواست)
صفات: user.role, user.projects[], user.disciplines[], user.clearance, resource.projectId, resource.discipline, resource.confidentiality, resource.status.

قانون: اجازه = RBAC AND project-in-scope AND (discipline خالی یا match) AND clearance >= confidentiality.

بدون این‌ها UI دکمه را مخفی می‌کند ولی API هم 403 می‌دهد (ضد IDOR).

---

## Permission Matrix (خلاصه)
| | view | create | reserve | issue | act WF | import | send TR |
|---|---|---|---|---|---|---|---|
| viewer | Y* | — | — | — | — | — | — |
| originator | Y* | Y* | — | Y* own | Y assigned | — | — |
| document_controller | Y | Y | Y | Y | Y | Y | Y |
| discipline_lead | Y* | Y* | — | — | Y* | — | — |
| consultant / pmc | Y* | — | — | — | Y assigned | — | — |
| admin | Y | Y | Y | Y | Y | Y | Y |

\* محدود به ABAC پروژه/دیسپلین/محرمانگی.

---

## Confidentiality
Public < Internal < Restricted < Secret  
پیش‌فرض از DocumentType. کاربر با clearance پایین‌تر حتی وجود Secret را در لیست نمی‌بیند (not found نه 403 enumeration برای Secret).

---

## Dynamic Watermark
روی PDF/تصویر پیش‌نمایش و دانلود:
`{user.displayName} | {user.id} | {project.code} | {timestamp} | {docNumber}`
قطر صفحه، تکرار. فایل Evidence اصلی بدون واترمارک فقط برای DC/admin با Audit `FILE_RAW_DOWNLOAD`.
UI هرگز لینک خام بدون API نمی‌دهد.

---

## Audit Hash Chain
AuditLog: PayloadJson, PrevHash, Hash = SHA256(PrevHash + canonical(payload)).
رکورد اول PrevHash = 0×00.
کاربر نمی‌تواند UPDATE/DELETE (جدول فقط INSERT؛ نقش SQL جدا).
Verify job شبانه زنجیره را چک می‌کند → `AUDIT_BREAK` critical.

---

## Retention
RetentionPolicy per DocumentType: Years, LegalHold bit.
Hold = حذف ممنوع. پس از Years: وضعیت Archived؛ فایل به cold storage. حذف فیزیکی فقط admin + دو تأیید.

---

## API Security
- Auth: همان نشست Arena / Bearer (جزئیات D8).
- هر endpoint: project scope از JWT نه از body قابل جعل.
- Rate limit موجود express-rate-limit.
- Upload: MIME allowlist + max MB (موجود server) + checksum؛ VirusScanStatus فیلد D2 (موتور فاز۲).
- SQL parameterized (mssql). جستجو بدون concatenation.
- CORS محدود به origin فرانت.

---

## Self-Validation D6
Loop1: Audit کامل و immutable ✓ محرمانگی ✓ آفلاین: اقدام در syncQueue با همان actor ✓ دوزبانه پیام 403  
Loop2: Role با D5 Step.Role هم‌نام ✓ Permission با API D8 هم‌نام می‌ماند ✓  
Loop3: ABAC روی query predicate ساده است ✓  
Loop4: IDOR، checksum، rate limit، session expiry (توکن) ✓ ویروس فاز۲ Gap شناخته‌شده  
Loop5: Stakeholder access از طریق UserProjectScope  

Gap باقی: ClamAV؛ گسترش RoleCode در AuthContext بدون شکستن ظاهر.
