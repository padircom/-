/**
 * اسکیمای بخش ۷ سازمان: مدیریت اسناد، بایگانی دیجیتال و مدیریت دانش (Enterprise EDMS / KMS)
 * منطبق با ISO 15489 (مدیریت اسناد و سوابق)، ISO 30301 (سیستم‌های مدیریت سوابق)،
 * ISO 9001 (کنترل مدارک و نسخه‌ها) و ISO 30401 (سیستم‌های مدیریت دانش KMS).
 * ═══════════════════════════════════════════════════════════════════════════
 * اصول معماری:
 * ۱) استقلال منطقی پایگاه‌داده: همهٔ جداول با پیشوند `Edms` و `Kms` و `module: "edms"`
 *    تعریف شده‌اند و بدون کلید خارجی فیزیکی به سایر ستون‌های سازمانی عمل می‌کنند.
 * ۲) پوشش کامل ۵ زیرماژول:
 *    - کنترل مدارک، شناسنامه اسناد (DMI) و شماره‌گذاری استاندارد خودکار
 *      (`EdmsNumberingRule`, `EdmsMasterDocument`)
 *    - مدیریت نسخه‌ها (Draft, Rev A, Rev B, Approved, As-Built)، قفل Check-In/Check-Out
 *      و مقایسهٔ تغییرات (`EdmsRevisionRecord`, `EdmsCheckoutLock`)
 *    - گردش‌کار بررسی و تأیید (Review & Approval Workflow) و مرسولات/مکاتبات رسمی
 *      (`EdmsWorkflowInstance`, `EdmsTransmittalPackage`)
 *    - دسته‌بندی و زون‌بندی بایگانی دیجیتال، اسکن، استخراج متن (OCR) و موتور جستجوی
 *      متنی (`EdmsArchiveZone`, `EdmsOcrSearchIndex`)
 *    - مدیریت دانش سازمانی (KMS): ثبت دروس آموخته‌شده (Lessons Learned) و پایگاه
 *      دانش/ویکی دستورالعمل‌ها و Best Practices (`KmsLessonRecord`, `KmsKnowledgeBaseArticle`)
 */
import type { ColumnDef, TableDef } from "./persistence";

const c = (name: string, kind: ColumnDef["kind"], extra: Partial<ColumnDef> = {}): ColumnDef => ({
  name,
  kind,
  nullable: true,
  ...extra,
});
const req = (name: string, kind: ColumnDef["kind"], extra: Partial<ColumnDef> = {}): ColumnDef => ({
  name,
  kind,
  nullable: false,
  ...extra,
});
const id = (): ColumnDef => req("Id", "text", { len: 60 });
const proj = (): ColumnDef => req("ProjectId", "text", { len: 60, comment: "دامنهٔ پروژه/سازمان" });
const note = (): ColumnDef => c("NoteFa", "text", { len: 1000 });

export const EDMS_ENTERPRISE_TABLES: TableDef[] = [
  /* ── ۱. کنترل مدارک، شناسنامه اسناد (DMI) و شماره‌گذاری استاندارد ── */
  {
    name: "EdmsNumberingRule",
    module: "edms",
    title: { fa: "الگوی شماره‌گذاری و کدینگ خودکار اسناد", en: "Document Auto-Numbering & Coding Rule" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("RuleCode", "text", { len: 40 }),
      req("TitleFa", "text", { len: 240 }),
      req("DocCategory", "text", { len: 30, comment: "engineering|administrative|contractual|quality|operation|vendor" }),
      req("PrefixPattern", "text", { len: 60, comment: "مثلاً PRJ-ENG-ME-DWG" }),
      req("DisciplineCode", "text", { len: 20, default: "'GEN'", comment: "ME|EL|IN|PR|CV|QA|ADM|CNT" }),
      req("DocTypeCode", "text", { len: 20, default: "'DOC'", comment: "DWG|SPC|CAL|PRC|CTR|LTR|MAN" }),
      req("Separator", "text", { len: 5, default: "'-'" }),
      req("SeqDigits", "int", { default: "4" }),
      req("CurrentSeq", "int", { default: "1" }),
      c("ExampleDocCode", "text", { len: 80 }),
      req("Status", "text", { len: 20, default: "'active'", comment: "active|retired" }),
      note(),
    ],
    indexes: [
      { name: "UX_EdmsNumberingRule_Code", columns: ["ProjectId", "RuleCode"], unique: true },
    ],
  },
  {
    name: "EdmsMasterDocument",
    module: "edms",
    title: { fa: "شناسنامهٔ جامع اسناد (Document Master Index - DMI)", en: "Document Master Index (DMI)" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("DocCode", "text", { len: 80 }),
      req("TitleFa", "text", { len: 300 }),
      c("TitleEn", "text", { len: 300 }),
      req("DocCategory", "text", { len: 30, default: "'engineering'", comment: "engineering|administrative|contractual|quality|operation|vendor" }),
      req("Discipline", "text", { len: 30, default: "'mechanical'", comment: "process|mechanical|piping|electrical|instrumentation|civil|quality|commercial|general" }),
      req("DocType", "text", { len: 30, default: "'drawing'", comment: "drawing|datasheet|calculation|procedure|specification|contract|letter|manual" }),
      c("NumberingRuleCode", "text", { len: 40 }),
      req("CurrentRevision", "text", { len: 20, default: "'Rev-A'", comment: "Draft|Rev-0|Rev-A|Rev-B|Approved|IFC|As-Built" }),
      req("LifecycleStage", "text", { len: 24, default: "'Approved'", comment: "Draft|In-Review|Approved|IFC|As-Built|Superseded" }),
      req("Confidentiality", "text", { len: 20, default: "'internal'", comment: "public|internal|confidential|restricted" }),
      req("OwnerDepartmentFa", "text", { len: 160 }),
      c("OriginatorFa", "text", { len: 160 }),
      c("CheckedOutBy", "text", { len: 60 }),
      c("ArchiveZoneCode", "text", { len: 40 }),
      c("LinkedAssetOrWbsRef", "text", { len: 80, comment: "ارجاع نرم به WBS، تجهیز CMMS یا سفارش MES" }),
      req("Status", "text", { len: 20, default: "'active'", comment: "active|checked-out|archived|obsolete" }),
      note(),
    ],
    indexes: [
      { name: "UX_EdmsMasterDoc_Code", columns: ["ProjectId", "DocCode"], unique: true },
      { name: "IX_EdmsMasterDoc_Disc", columns: ["ProjectId", "DocCategory", "Discipline", "LifecycleStage"] },
    ],
  },

  /* ── ۲. مدیریت نسخه‌ها، Check-In / Check-Out و مقایسه تغییرات ── */
  {
    name: "EdmsRevisionRecord",
    module: "edms",
    title: { fa: "سابقهٔ ویرایش و نسخهٔ سند (Revision History & Diff)", en: "Document Revision & Change Comparison" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("RevisionNo", "text", { len: 40 }),
      req("DocCode", "text", { len: 80 }),
      req("RevisionCode", "text", { len: 20, comment: "Draft|Rev-0|Rev-A|Rev-B|Rev-C|Approved|IFC|As-Built" }),
      req("ChangeSummaryFa", "text", { len: 600 }),
      c("ComparedToRev", "text", { len: 20 }),
      c("DiffHighlightsFa", "text", { len: 800, comment: "مقایسهٔ تغییرات فنی/متنی نسبت به ویرایش قبل" }),
      c("FileUri", "text", { len: 300 }),
      c("FileHashSha256", "text", { len: 80 }),
      req("PageCount", "int", { default: "1" }),
      req("PreparedBy", "text", { len: 60 }),
      c("CheckedBy", "text", { len: 60 }),
      c("ApprovedBy", "text", { len: 60 }),
      req("IssueDate", "date"),
      req("Status", "text", { len: 20, default: "'approved'", comment: "draft|under-review|approved|ifc|as-built|superseded" }),
      note(),
    ],
    indexes: [
      { name: "UX_EdmsRevision_No", columns: ["ProjectId", "RevisionNo"], unique: true },
      { name: "IX_EdmsRevision_Doc", columns: ["ProjectId", "DocCode", "RevisionCode"] },
    ],
  },
  {
    name: "EdmsCheckoutLock",
    module: "edms",
    title: { fa: "قفل رزرو و ویرایش سند (Check-Out / Check-In)", en: "Document Check-Out / Check-In Lock" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("LockNo", "text", { len: 40 }),
      req("DocCode", "text", { len: 80 }),
      req("BaseRevision", "text", { len: 20 }),
      req("CheckedOutBy", "text", { len: 60 }),
      req("CheckedOutAt", "datetime"),
      c("ExpectedReturnDate", "date"),
      req("CheckOutReasonFa", "text", { len: 400 }),
      c("CheckedInAt", "datetime"),
      c("ResultingRevision", "text", { len: 20 }),
      c("CheckInDiffNotesFa", "text", { len: 600 }),
      req("Status", "text", { len: 20, default: "'checked-out'", comment: "checked-out|checked-in|force-unlocked" }),
      note(),
    ],
    indexes: [
      { name: "UX_EdmsCheckoutLock_No", columns: ["ProjectId", "LockNo"], unique: true },
      { name: "IX_EdmsCheckoutLock_Doc", columns: ["ProjectId", "DocCode", "Status"] },
    ],
  },

  /* ── ۳. گردش‌کار بررسی و تأیید (Review & Approval) و ترانسمیتال‌ها ── */
  {
    name: "EdmsWorkflowInstance",
    module: "edms",
    title: { fa: "گردش‌کار بررسی و تأیید سند (Review & Approval Workflow)", en: "Document Review & Approval Workflow" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("WorkflowNo", "text", { len: 40 }),
      req("DocCode", "text", { len: 80 }),
      req("RevisionCode", "text", { len: 20 }),
      req("WorkflowType", "text", { len: 32, comment: "technical-review|ifc-release|client-approval|iso-procedure|as-built-handover" }),
      req("CurrentStep", "text", { len: 30, default: "'lead-engineer'", comment: "initiator|checker|lead-engineer|qa-control|client-rep|completed" }),
      req("ReviewResultCode", "text", { len: 32, default: "'pending'", comment: "pending|Code-1-Approved|Code-2-ApprovedAsNoted|Code-3-ReviseResubmit|Code-4-InfoOnly" }),
      req("InitiatedBy", "text", { len: 60 }),
      req("AssignedReviewer", "text", { len: 60 }),
      c("FinalApprover", "text", { len: 60 }),
      req("DueDate", "date"),
      c("CompletedDate", "date"),
      c("ReviewCommentsFa", "text", { len: 800 }),
      req("Status", "text", { len: 20, default: "'in-review'", comment: "in-review|approved|approved-with-comments|rejected|closed" }),
      note(),
    ],
    indexes: [
      { name: "UX_EdmsWorkflow_No", columns: ["ProjectId", "WorkflowNo"], unique: true },
      { name: "IX_EdmsWorkflow_Doc", columns: ["ProjectId", "DocCode", "Status"] },
    ],
  },
  {
    name: "EdmsTransmittalPackage",
    module: "edms",
    title: { fa: "برگهٔ ارسال مدارک و مکاتبات مهندسی/اداری (Transmittal)", en: "Document Transmittal & Official Correspondence" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("TransmittalNo", "text", { len: 40 }),
      req("SubjectFa", "text", { len: 300 }),
      req("Direction", "text", { len: 16, default: "'outgoing'", comment: "outgoing|incoming" }),
      req("SenderOrgFa", "text", { len: 200 }),
      req("ReceiverOrgFa", "text", { len: 200 }),
      req("IssuePurpose", "text", { len: 30, default: "'for-approval'", comment: "for-approval|for-review|for-construction|for-information|as-built-dossier" }),
      req("IncludedDocCodes", "text", { len: 600, comment: "فهرست کد اسناد و ویرایش‌های ضمیمه" }),
      req("DeliveryChannel", "text", { len: 30, default: "'edms-portal'", comment: "edms-portal|encrypted-media|official-courier|email-signed" }),
      req("IssueDate", "date"),
      c("AcknowledgedDate", "date"),
      c("ReceiptRefNo", "text", { len: 60 }),
      req("IssuedBy", "text", { len: 60 }),
      req("Status", "text", { len: 20, default: "'issued'", comment: "draft|issued|acknowledged|responded|closed" }),
      note(),
    ],
    indexes: [
      { name: "UX_EdmsTransmittal_No", columns: ["ProjectId", "TransmittalNo"], unique: true },
      { name: "IX_EdmsTransmittal_Date", columns: ["ProjectId", "Direction", "IssueDate"] },
    ],
  },

  /* ── ۴. بایگانی دیجیتال، اسکن، استخراج متن (OCR) و موتور جستجو ── */
  {
    name: "EdmsArchiveZone",
    module: "edms",
    title: { fa: "زون‌بندی و طبقه‌بندی بایگانی دیجیتال و فیزیکی", en: "Digital & Physical Archive Zone" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("ZoneCode", "text", { len: 40 }),
      req("TitleFa", "text", { len: 240 }),
      req("Classification", "text", { len: 32, comment: "engineering-drawings|contracts-legal|hr-dossiers|quality-iso-records|as-built-vault" }),
      req("StorageTier", "text", { len: 24, default: "'hot-nvme'", comment: "hot-nvme|warm-object|cold-worm-vault|physical-fireproof" }),
      req("RetentionYears", "int", { default: "15", comment: "مدت نگهداری قانونی بر حسب سال (ISO 15489)" }),
      req("DispositionPolicy", "text", { len: 30, default: "'permanent-keep'", comment: "permanent-keep|committee-review|secure-shred" }),
      req("EncryptionAes256", "bool", { default: "1" }),
      req("StoredDocsCount", "int", { default: "0" }),
      req("Status", "text", { len: 20, default: "'active'", comment: "active|near-capacity|sealed" }),
      note(),
    ],
    indexes: [
      { name: "UX_EdmsArchiveZone_Code", columns: ["ProjectId", "ZoneCode"], unique: true },
    ],
  },
  {
    name: "EdmsOcrSearchIndex",
    module: "edms",
    title: { fa: "رکورد اسکن، استخراج متن (OCR) و نمایهٔ جستجوی تمام‌متن", en: "Document Scan, OCR & Full-Text Search Index" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("IndexNo", "text", { len: 40 }),
      req("DocCode", "text", { len: 80 }),
      req("RevisionCode", "text", { len: 20 }),
      req("ArchiveZoneCode", "text", { len: 40 }),
      req("ScanDpi", "int", { default: "300" }),
      req("OcrLang", "text", { len: 20, default: "'fa+en'", comment: "fa+en|fa|en" }),
      req("OcrConfidencePct", "decimal", { precision: 5, scale: 2, default: "97.5" }),
      req("ExtractedTextFa", "text", { len: 2000, comment: "متن استخراج‌شده توسط موتور OCR برای جستجوی تمام‌متن" }),
      req("KeywordsTagsFa", "text", { len: 400 }),
      c("PhysicalBoxRef", "text", { len: 60, comment: "کد زونکن/باکس بایگانی فیزیکی" }),
      req("IndexedBy", "text", { len: 60 }),
      req("IndexedDate", "date"),
      req("Status", "text", { len: 20, default: "'indexed'", comment: "queued|indexed|verified|re-scan-needed" }),
      note(),
    ],
    indexes: [
      { name: "UX_EdmsOcrIndex_No", columns: ["ProjectId", "IndexNo"], unique: true },
      { name: "IX_EdmsOcrIndex_Doc", columns: ["ProjectId", "DocCode", "ArchiveZoneCode"] },
    ],
  },

  /* ── ۵. مدیریت دانش سازمانی (KMS: Lessons Learned & Knowledge Base Wiki) ── */
  {
    name: "KmsLessonRecord",
    module: "edms",
    title: { fa: "درس‌آموختهٔ پروژه و تولید (Lessons Learned)", en: "Project & Operations Lesson Learned" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("LessonCode", "text", { len: 40 }),
      req("TitleFa", "text", { len: 300 }),
      req("DomainPillar", "text", { len: 30, comment: "project-pmis|manufacturing-mes|maintenance-cmms|supply-scm|drilling-iiot|hrm-safety|edms-quality" }),
      req("SourceContextFa", "text", { len: 200, comment: "پروژه، کارگاه یا دکل منشأ تجربه" }),
      req("ProblemOrEventFa", "text", { len: 800 }),
      req("RootCauseFa", "text", { len: 600 }),
      req("ActionAndLessonFa", "text", { len: 800 }),
      req("SeverityImpact", "text", { len: 20, default: "'high'", comment: "low|medium|high|strategic" }),
      req("EstimatedSavingRials", "decimal", { precision: 18, scale: 0, default: "0" }),
      req("AuthorBy", "text", { len: 60 }),
      c("ValidatedBy", "text", { len: 60 }),
      req("AppliedCount", "int", { default: "1" }),
      req("Status", "text", { len: 20, default: "'published'", comment: "draft|validated|published|archived" }),
      note(),
    ],
    indexes: [
      { name: "UX_KmsLesson_Code", columns: ["ProjectId", "LessonCode"], unique: true },
      { name: "IX_KmsLesson_Domain", columns: ["ProjectId", "DomainPillar", "Status"] },
    ],
  },
  {
    name: "KmsKnowledgeBaseArticle",
    module: "edms",
    title: { fa: "مقالهٔ پایگاه دانش، ویکی فنی و Best Practice", en: "Knowledge Base Wiki & Best Practice Article" },
    pk: "Id",
    columns: [
      id(),
      proj(),
      req("ArticleCode", "text", { len: 40 }),
      req("TitleFa", "text", { len: 300 }),
      req("ArticleType", "text", { len: 30, default: "'best-practice'", comment: "best-practice|sop-procedure|troubleshooting-guide|engineering-standard|onboarding-wiki" }),
      req("KnowledgeAreaFa", "text", { len: 160 }),
      req("SummaryFa", "text", { len: 500 }),
      req("BodyMarkdownFa", "text", { len: 2000 }),
      req("TagsCsv", "text", { len: 300 }),
      c("RefDocCode", "text", { len: 80, comment: "ارجاع نرم به سند مرجع در DMI" }),
      req("AuthorBy", "text", { len: 60 }),
      c("ReviewedBy", "text", { len: 60 }),
      req("ViewCount", "int", { default: "12" }),
      req("HelpfulVotes", "int", { default: "5" }),
      req("VersionNo", "int", { default: "1" }),
      req("Status", "text", { len: 20, default: "'published'", comment: "draft|published|featured|obsolete" }),
      note(),
    ],
    indexes: [
      { name: "UX_KmsArticle_Code", columns: ["ProjectId", "ArticleCode"], unique: true },
      { name: "IX_KmsArticle_Type", columns: ["ProjectId", "ArticleType", "Status"] },
    ],
  },
];
