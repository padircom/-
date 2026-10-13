/**
 * بخش ۷ سازمان: مدیریت اسناد، بایگانی دیجیتال و مدیریت دانش (Enterprise EDMS / KMS Workspace API)
 * منطبق با ISO 15489 (مدیریت اسناد و سوابق)، ISO 30301 (سیستم‌های مدیریت سوابق)،
 * ISO 9001 (کنترل مدارک) و ISO 30401 (سیستم‌های مدیریت دانش سازمانی KMS).
 * ═══════════════════════════════════════════════════════════════════════════
 * شامل ۵ زیرماژول اصلی:
 * ۱. کنترل مدارک و فراداده‌ها (DMI) و الگوی شماره‌گذاری خودکار اسناد
 * ۲. کنترل نسخه‌ها (Draft, Rev-A, Rev-B, Approved, IFC, As-Built)، Check-In/Check-Out و مقایسه تغییرات
 * ۳. گردش‌کار بررسی و تأیید (Review & Approval Workflow) و ترانسمیتال‌ها (Transmittals)
 * ۴. زون‌بندی بایگانی دیجیتال، اسکن/OCR و موتور جستجوی تمام‌متن (Full-Text Search)
 * ۵. مدیریت دانش سازمانی (KMS): ثبت دروس آموخته‌شده (Lessons Learned) و پایگاه دانش / ویکی فنی
 */

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function wrapRepo(r, actorId = "system") {
  return {
    async list(table, filter = {}) {
      const where = Object.entries(filter).map(([column, value]) => ({ column, op: "eq", value }));
      return r.list(table, { where, limit: 5000 });
    },
    async get(table, id) {
      return r.get(table, id);
    },
    async insert(table, row) {
      const clean = r.pickWritable ? r.pickWritable(table, row) : row;
      return r.create(table, clean, actorId);
    },
    async update(table, id, patch) {
      const clean = r.pickWritable ? r.pickWritable(table, patch) : patch;
      await r.patch(table, id, clean, actorId);
      return r.get(table, id);
    },
    async remove(table, id) {
      return r.remove(table, id);
    },
  };
}

export async function seedEdmsWorkspaceData(db, projectId = "c1-p1") {
  const existingDocs = await db.list("EdmsMasterDocument", { ProjectId: projectId });
  if (existingDocs.length > 0) {
    return { seeded: false, projectId, masterDocs: existingDocs.length };
  }

  /* ── ۱. الگوهای شماره‌گذاری خودکار اسناد (EdmsNumberingRule) ── */
  const numberingRules = [
    {
      Id: `enr-${projectId}-01`, ProjectId: projectId, RuleCode: "NUM-ENG-MECH",
      TitleFa: "الگوی کدینگ نقشه‌ها و مدارک مهندسی مکانیک و تجهیزات دوار",
      DocCategory: "engineering", PrefixPattern: "AZD-ENG-ME-DWG",
      DisciplineCode: "ME", DocTypeCode: "DWG", Separator: "-",
      SeqDigits: 4, CurrentSeq: 105, ExampleDocCode: "AZD-ENG-ME-DWG-0105",
      Status: "active", NoteFa: "منطبق با استاندارد کدینگ اسناد مهندسی ISO 9001 و MDR پروژه",
    },
    {
      Id: `enr-${projectId}-02`, ProjectId: projectId, RuleCode: "NUM-ENG-PROC",
      TitleFa: "الگوی کدینگ نمودارهای فرآیندی PFD / P&ID و دیتاشیت‌ها",
      DocCategory: "engineering", PrefixPattern: "AZD-ENG-PR-PID",
      DisciplineCode: "PR", DocTypeCode: "PID", Separator: "-",
      SeqDigits: 4, CurrentSeq: 204, ExampleDocCode: "AZD-ENG-PR-PID-0204",
      Status: "active", NoteFa: "شماره‌گذاری یکپارچه مدارک فرآیندی و پایپینگ",
    },
    {
      Id: `enr-${projectId}-03`, ProjectId: projectId, RuleCode: "NUM-QMS-SOP",
      TitleFa: "الگوی کدینگ روش‌های اجرایی و دستورالعمل‌های کیفیت و نت (SOP / ITP)",
      DocCategory: "quality", PrefixPattern: "AZD-QMS-QA-PRC",
      DisciplineCode: "QA", DocTypeCode: "PRC", Separator: "-",
      SeqDigits: 4, CurrentSeq: 312, ExampleDocCode: "AZD-QMS-QA-PRC-0312",
      Status: "active", NoteFa: "کنترل مدارک سیستم مدیریت کیفیت ISO 9001:2015",
    },
    {
      Id: `enr-${projectId}-04`, ProjectId: projectId, RuleCode: "NUM-CNT-ADM",
      TitleFa: "الگوی کدینگ قراردادها، الحاقیه‌ها و مکاتبات رسمی قراردادی",
      DocCategory: "contractual", PrefixPattern: "AZD-CNT-CM-CTR",
      DisciplineCode: "CM", DocTypeCode: "CTR", Separator: "-",
      SeqDigits: 4, CurrentSeq: 408, ExampleDocCode: "AZD-CNT-CM-CTR-0408",
      Status: "active", NoteFa: "مخصوص اسناد پیمان، صورت‌وضعیت و مکاتبات رسمی کارفرما",
    },
  ];
  for (const row of numberingRules) await db.insert("EdmsNumberingRule", row);

  /* ── ۲. شناسنامه جامع اسناد (Document Master Index - EdmsMasterDocument) ── */
  const masterDocs = [
    {
      Id: `emd-${projectId}-01`, ProjectId: projectId, DocCode: "AZD-ENG-ME-DWG-0101",
      TitleFa: "نقشه جانمایی و فونداسیون توربوکمپرسورهای گاز ترش واحد ۱۰۰",
      TitleEn: "Unit 100 Sour Gas Turbo-Compressor GA & Foundation Drawing",
      DocCategory: "engineering", Discipline: "mechanical", DocType: "drawing",
      NumberingRuleCode: "NUM-ENG-MECH", CurrentRevision: "As-Built",
      LifecycleStage: "As-Built", Confidentiality: "confidential",
      OwnerDepartmentFa: "معاونت مهندسی و طراحی — دیسیپلین مکانیک",
      OriginatorFa: "مهندس سهراب کاظمی", CheckedOutBy: null,
      ArchiveZoneCode: "ZON-ENG-01", LinkedAssetOrWbsRef: "AST-COMP-101A",
      Status: "active", NoteFa: "نسخه چون‌ساخت (As-Built) نهایی‌شده پس از تست راه‌اندازی گرم",
    },
    {
      Id: `emd-${projectId}-02`, ProjectId: projectId, DocCode: "AZD-ENG-PR-PID-0201",
      TitleFa: "نمودار لوله‌کشی و ابزار دقیق (P&ID) سیستم جداسازی پرفشار سرچاهی",
      TitleEn: "High-Pressure Wellhead Separation System P&ID",
      DocCategory: "engineering", Discipline: "process", DocType: "drawing",
      NumberingRuleCode: "NUM-ENG-PROC", CurrentRevision: "IFC",
      LifecycleStage: "IFC", Confidentiality: "confidential",
      OwnerDepartmentFa: "معاونت مهندسی — دیسیپلین فرآیند و پایپینگ",
      OriginatorFa: "مهندس نیما شریفی", CheckedOutBy: null,
      ArchiveZoneCode: "ZON-ENG-01", LinkedAssetOrWbsRef: "WBS-100-PROC",
      Status: "active", NoteFa: "صادرشده برای ساخت (Issued for Construction) با تأیید مشاور و کارفرما",
    },
    {
      Id: `emd-${projectId}-03`, ProjectId: projectId, DocCode: "AZD-QMS-QA-PRC-0309",
      TitleFa: "دستورالعمل جامع جوشکاری و عملیات حرارتی مخازن فولاد دوبلکس (WPS/PQR)",
      TitleEn: "Duplex Stainless Steel Pressure Vessel Welding & PWHT Procedure",
      DocCategory: "quality", Discipline: "quality", DocType: "procedure",
      NumberingRuleCode: "NUM-QMS-SOP", CurrentRevision: "Rev-B",
      LifecycleStage: "In-Review", Confidentiality: "internal",
      OwnerDepartmentFa: "مدیریت تضمین کیفیت و کارگاه ساخت (MES)",
      OriginatorFa: "استادکار فرهاد نادری", CheckedOutBy: "u-doc",
      ArchiveZoneCode: "ZON-QMS-02", LinkedAssetOrWbsRef: "WC-WLD-01",
      Status: "checked-out", NoteFa: "در حال بازنگری Rev-B برای افزودن پارامترهای گاز محافظ نیتروژن/آرگون",
    },
    {
      Id: `emd-${projectId}-04`, ProjectId: projectId, DocCode: "AZD-CNT-CM-CTR-0402",
      TitleFa: "سند پیمان اصلی EPCF احداث واحد فرآورش مرکزی و خطوط جریانی",
      TitleEn: "Master EPCF Contract for Central Processing Facility & Flowlines",
      DocCategory: "contractual", Discipline: "commercial", DocType: "contract",
      NumberingRuleCode: "NUM-CNT-ADM", CurrentRevision: "Approved",
      LifecycleStage: "Approved", Confidentiality: "restricted",
      OwnerDepartmentFa: "مدیریت امور پیمان‌ها و حقوقی",
      OriginatorFa: "مهندس بهرام فرهمند", CheckedOutBy: null,
      ArchiveZoneCode: "ZON-LEG-03", LinkedAssetOrWbsRef: "CNT-EPCF-1404",
      Status: "active", NoteFa: "سند با طبقه‌بندی سری در خزانه دیجیتال رمزنگاری‌شده AES-256",
    },
    {
      Id: `emd-${projectId}-05`, ProjectId: projectId, DocCode: "AZD-ENG-ME-DWG-0104",
      TitleFa: "مدارک فنی و دفترچه تعمیرات فورانگیر دکل حفاری (BOP Stack Manual)",
      TitleEn: "15,000 PSI Blowout Preventer (BOP) Operation & Maintenance Manual",
      DocCategory: "operation", Discipline: "mechanical", DocType: "manual",
      NumberingRuleCode: "NUM-ENG-MECH", CurrentRevision: "Approved",
      LifecycleStage: "Approved", Confidentiality: "internal",
      OwnerDepartmentFa: "عملیات حفاری و نگهداری و تعمیرات دکل (IIoT / CMMS)",
      OriginatorFa: "مهندس سامان درخشانی", CheckedOutBy: null,
      ArchiveZoneCode: "ZON-OPS-04", LinkedAssetOrWbsRef: "RIG-DEMO",
      Status: "active", NoteFa: "متصل به برنامه PM فورانگیر در CMMS و تله‌متری فشار BOP در IIoT",
    },
  ];
  for (const row of masterDocs) await db.insert("EdmsMasterDocument", row);

  /* ── ۳. تاریخچه نسخه‌ها و مقایسه تغییرات (EdmsRevisionRecord) ── */
  const revisions = [
    {
      Id: `err-${projectId}-01`, ProjectId: projectId, RevisionNo: "REV-0101-A",
      DocCode: "AZD-ENG-ME-DWG-0101", RevisionCode: "Rev-A",
      ChangeSummaryFa: "صدور اولیه نقشه جانمایی توربوکمپرسور برای بررسی بین‌دیسیپلینی (IDC)",
      ComparedToRev: "Draft",
      DiffHighlightsFa: "+ افزودن جدول بارهای دینامیکی شاسی | + تعیین تراز رقوم انکربولت‌ها",
      FileUri: "/vault/eng/AZD-ENG-ME-DWG-0101_RevA.pdf",
      FileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      PageCount: 6, PreparedBy: "u-engmgr", CheckedBy: "u-qa", ApprovedBy: "u-pm",
      IssueDate: "2026-04-12", Status: "superseded",
      NoteFa: "جایگزین‌شده با ویرایش IFC و As-Built",
    },
    {
      Id: `err-${projectId}-02`, ProjectId: projectId, RevisionNo: "REV-0101-ASB",
      DocCode: "AZD-ENG-ME-DWG-0101", RevisionCode: "As-Built",
      ChangeSummaryFa: "اعمال تغییرات کارگاهی Red-Line پس از هم‌محوری لیزری شفت و گروت‌ریزی اپوکسی",
      ComparedToRev: "IFC",
      DiffHighlightsFa: "Δ اصلاح ضخامت شیم‌پلیت‌های یاتاقان عقب (+1.2mm) | + ثبت مختصات سنسورهای ارتعاش‌سنجی VT-101A/B",
      FileUri: "/vault/eng/AZD-ENG-ME-DWG-0101_AsBuilt.pdf",
      FileHashSha256: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
      PageCount: 8, PreparedBy: "u-engmgr", CheckedBy: "u-qa", ApprovedBy: "u-pm",
      IssueDate: "2026-09-25", Status: "as-built",
      NoteFa: "تأیید نهایی کارفرما و ثبت در پرونده قطعی تحویل (Final Dossier)",
    },
    {
      Id: `err-${projectId}-03`, ProjectId: projectId, RevisionNo: "REV-0201-IFC",
      DocCode: "AZD-ENG-PR-PID-0201", RevisionCode: "IFC",
      ChangeSummaryFa: "بستن تمامی کامنت‌های HAZOP و صدور نسخه اجرایی ساخت (Issued for Construction)",
      ComparedToRev: "Rev-B",
      DiffHighlightsFa: "+ افزودن شیر اطمینان دوگانه PSV-201A/B | Δ ارتقای کلاس فلنج خط خروجی به ANSI 900#",
      FileUri: "/vault/eng/AZD-ENG-PR-PID-0201_IFC.pdf",
      FileHashSha256: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
      PageCount: 4, PreparedBy: "u-engmgr", CheckedBy: "u-qa", ApprovedBy: "u-pm",
      IssueDate: "2026-08-18", Status: "ifc",
      NoteFa: "ابلاغ‌شده به پیمانکار نصب و کارگاه پیش‌ساخت پایپینگ",
    },
    {
      Id: `err-${projectId}-04`, ProjectId: projectId, RevisionNo: "REV-0309-B",
      DocCode: "AZD-QMS-QA-PRC-0309", RevisionCode: "Rev-B",
      ChangeSummaryFa: "بازنگری محدوده حرارت ورودی (Heat Input) جوشکاری فولاد دوبلکس",
      ComparedToRev: "Rev-A",
      DiffHighlightsFa: "Δ کاهش حداکثر دمای بین‌پاسی به ۱۵۰ درجه سانتی‌گراد | + الزام تست فریت‌سنجی در ۵ نقطه هر سرجوش",
      FileUri: "/vault/qms/AZD-QMS-QA-PRC-0309_RevB.pdf",
      FileHashSha256: "4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce",
      PageCount: 19, PreparedBy: "u-doc", CheckedBy: "u-qa", ApprovedBy: null,
      IssueDate: "2026-10-10", Status: "under-review",
      NoteFa: "در گردش‌کار تأیید مدیر تضمین کیفیت",
    },
  ];
  for (const row of revisions) await db.insert("EdmsRevisionRecord", row);

  /* ── ۴. قفل‌های Check-Out / Check-In اسناد (EdmsCheckoutLock) ── */
  const locks = [
    {
      Id: `ecl-${projectId}-01`, ProjectId: projectId, LockNo: "LCK-1405-001",
      DocCode: "AZD-QMS-QA-PRC-0309", BaseRevision: "Rev-A",
      CheckedOutBy: "u-doc", CheckedOutAt: "2026-10-10T08:30:00Z",
      ExpectedReturnDate: "2026-10-15",
      CheckOutReasonFa: "اعمال اصلاحات بازرس کیفیت روی جدول پارامترهای جوشکاری GTAW فولاد دوبلکس",
      CheckedInAt: null, ResultingRevision: "Rev-B",
      CheckInDiffNotesFa: null, Status: "checked-out",
      NoteFa: "سند برای جلوگیری از ویرایش همزمان (Overwriting) توسط سایر کاربران قفل شده است",
    },
    {
      Id: `ecl-${projectId}-02`, ProjectId: projectId, LockNo: "LCK-1405-002",
      DocCode: "AZD-ENG-ME-DWG-0101", BaseRevision: "IFC",
      CheckedOutBy: "u-engmgr", CheckedOutAt: "2026-09-20T09:15:00Z",
      ExpectedReturnDate: "2026-09-25",
      CheckOutReasonFa: "ثبت اندازه‌برداری‌های نهایی هم‌محوری و صدور نقشه چون‌ساخت (As-Built)",
      CheckedInAt: "2026-09-25T16:40:00Z", ResultingRevision: "As-Built",
      CheckInDiffNotesFa: "تمام تغییرات Red-Line کارگاهی در لایه As-Built ثبت و قفل آزاد شد",
      Status: "checked-in",
      NoteFa: "چرخه Check-Out / Check-In با موفقیت تکمیل شد",
    },
  ];
  for (const row of locks) await db.insert("EdmsCheckoutLock", row);

  /* ── ۵. گردش‌کار بررسی و تأیید (EdmsWorkflowInstance) و ترانسمیتال‌ها (EdmsTransmittalPackage) ── */
  const workflows = [
    {
      Id: `ewi-${projectId}-01`, ProjectId: projectId, WorkflowNo: "WFL-1405-041",
      DocCode: "AZD-QMS-QA-PRC-0309", RevisionCode: "Rev-B",
      WorkflowType: "iso-procedure", CurrentStep: "qa-control",
      ReviewResultCode: "pending", InitiatedBy: "u-doc",
      AssignedReviewer: "u-qa", FinalApprover: "u-pm",
      DueDate: "2026-10-18", CompletedDate: null,
      ReviewCommentsFa: "منتظر تأیید نهایی درصد فریت مجاز توسط مدیر تضمین کیفیت",
      Status: "in-review", NoteFa: "گردش‌کار ۴ مرحله‌ای کنترل مدارک ISO 9001",
    },
    {
      Id: `ewi-${projectId}-02`, ProjectId: projectId, WorkflowNo: "WFL-1405-038",
      DocCode: "AZD-ENG-PR-PID-0201", RevisionCode: "IFC",
      WorkflowType: "ifc-release", CurrentStep: "completed",
      ReviewResultCode: "Code-1-Approved", InitiatedBy: "u-engmgr",
      AssignedReviewer: "u-qa", FinalApprover: "u-pm",
      DueDate: "2026-08-20", CompletedDate: "2026-08-18",
      ReviewCommentsFa: "تصویب بدون کامنت باز — مجاز جهت ابلاغ ساخت (IFC)",
      Status: "approved", NoteFa: "تأیید سه‌جانبه مهندسی، کیفیت و مدیر پروژه",
    },
    {
      Id: `ewi-${projectId}-03`, ProjectId: projectId, WorkflowNo: "WFL-1405-039",
      DocCode: "AZD-ENG-ME-DWG-0101", RevisionCode: "As-Built",
      WorkflowType: "as-built-handover", CurrentStep: "completed",
      ReviewResultCode: "Code-1-Approved", InitiatedBy: "u-engmgr",
      AssignedReviewer: "u-qa", FinalApprover: "u-pm",
      DueDate: "2026-09-28", CompletedDate: "2026-09-25",
      ReviewCommentsFa: "تطابق کامل با وضعیت نصب‌شده در سایت تأیید گردید",
      Status: "approved", NoteFa: "تحویل قطعی به آرشیو فنی بهره‌برداری",
    },
  ];
  for (const row of workflows) await db.insert("EdmsWorkflowInstance", row);

  const transmittals = [
    {
      Id: `etp-${projectId}-01`, ProjectId: projectId, TransmittalNo: "TRN-OUT-1405-088",
      SubjectFa: "ارسال رسمی نقشه‌های اجرایی IFC سیستم جداسازی پرفشار و فونداسیون کمپرسور",
      Direction: "outgoing",
      SenderOrgFa: "کنسرسیوم پیمانکاری عمومی و مهندسی (DCC)",
      ReceiverOrgFa: "دستگاه نظارت عالیه و مدیریت مهندسی کارفرما",
      IssuePurpose: "for-construction",
      IncludedDocCodes: "AZD-ENG-PR-PID-0201 (IFC), AZD-ENG-ME-DWG-0101 (As-Built)",
      DeliveryChannel: "edms-portal", IssueDate: "2026-09-26",
      AcknowledgedDate: "2026-09-27", ReceiptRefNo: "ACK-CLI-9941",
      IssuedBy: "u-doc", Status: "acknowledged",
      NoteFa: "رسید دیجیتال امضاشده توسط کنترل مدارک کارفرما ثبت شد",
    },
    {
      Id: `etp-${projectId}-02`, ProjectId: projectId, TransmittalNo: "TRN-IN-1405-042",
      SubjectFa: "دریافت مدارک فنی سازنده (Vendor Data Book) و دفترچه نت فورانگیر BOP",
      Direction: "incoming",
      SenderOrgFa: "شرکت مهندسی سازنده تجهیزات سرچاهی و حفاری",
      ReceiverOrgFa: "مرکز کنترل مدارک مهندسی و آرشیو فنی نت (DCC)",
      IssuePurpose: "for-approval",
      IncludedDocCodes: "AZD-ENG-ME-DWG-0104 (Approved)",
      DeliveryChannel: "encrypted-media", IssueDate: "2026-10-02",
      AcknowledgedDate: "2026-10-03", ReceiptRefNo: "ACK-DCC-4510",
      IssuedBy: "u-doc", Status: "closed",
      NoteFa: "مدارک پس از کنترل کیفیت در زون بایگانی عملیات حفاری نمایه‌سازی شد",
    },
  ];
  for (const row of transmittals) await db.insert("EdmsTransmittalPackage", row);

  /* ── ۶. زون‌بندی بایگانی دیجیتال و رکوردهای اسکن و OCR (EdmsArchiveZone, EdmsOcrSearchIndex) ── */
  const archiveZones = [
    {
      Id: `eaz-${projectId}-01`, ProjectId: projectId, ZoneCode: "ZON-ENG-01",
      TitleFa: "خزانه دیجیتال نقشه‌های مهندسی، P&ID و پرونده‌های As-Built",
      Classification: "engineering-drawings", StorageTier: "hot-nvme",
      RetentionYears: 30, DispositionPolicy: "permanent-keep",
      EncryptionAes256: true, StoredDocsCount: 142, Status: "active",
      NoteFa: "نگهداری دائم در طول چرخه عمر دارایی فیزیکی منطبق با ISO 15489",
    },
    {
      Id: `eaz-${projectId}-02`, ProjectId: projectId, ZoneCode: "ZON-QMS-02",
      TitleFa: "آرشیو استانداردهای کیفیت، دستورالعمل‌های جوشکاری WPS/PQR و گواهی‌های NDT",
      Classification: "quality-iso-records", StorageTier: "warm-object",
      RetentionYears: 15, DispositionPolicy: "committee-review",
      EncryptionAes256: true, StoredDocsCount: 86, Status: "active",
      NoteFa: "ممیزی‌پذیر بر اساس استاندارد ISO 9001 و ASME Sec IX",
    },
    {
      Id: `eaz-${projectId}-03`, ProjectId: projectId, ZoneCode: "ZON-LEG-03",
      TitleFa: "گاوصندوق دیجیتال غیرقابل‌تغییر (WORM) قراردادها، ضمانت‌نامه‌ها و اسناد حقوقی",
      Classification: "contracts-legal", StorageTier: "cold-worm-vault",
      RetentionYears: 25, DispositionPolicy: "permanent-keep",
      EncryptionAes256: true, StoredDocsCount: 34, Status: "active",
      NoteFa: "ذخیره‌سازی Write-Once-Read-Many منطبق با ISO 30301",
    },
    {
      Id: `eaz-${projectId}-04`, ProjectId: projectId, ZoneCode: "ZON-OPS-04",
      TitleFa: "بایگانی فنی دفترچه‌های بهره‌برداری، کاتالوگ‌های سازندگان و دستورالعمل‌های دکل",
      Classification: "as-built-vault", StorageTier: "hot-nvme",
      RetentionYears: 20, DispositionPolicy: "permanent-keep",
      EncryptionAes256: true, StoredDocsCount: 64, Status: "active",
      NoteFa: "دسترسی سریع تکنسین‌های CMMS و سرپرستان دکل حفاری",
    },
  ];
  for (const row of archiveZones) await db.insert("EdmsArchiveZone", row);

  const ocrRecords = [
    {
      Id: `eoi-${projectId}-01`, ProjectId: projectId, IndexNo: "OCR-1405-101",
      DocCode: "AZD-ENG-ME-DWG-0101", RevisionCode: "As-Built",
      ArchiveZoneCode: "ZON-ENG-01", ScanDpi: 600, OcrLang: "fa+en",
      OcrConfidencePct: 98.4,
      ExtractedTextFa: "نقشه چون‌ساخت فونداسیون و هم‌محوری لیزری توربوکمپرسور گاز ترش واحد ۱۰۰. حد مجاز ارتعاش یاتاقان طبق استاندارد ISO 10816 برابر 2.8 mm/s RMS است. ضخامت شیم‌پلیت تراز نهایی 1.2mm ثبت گردید.",
      KeywordsTagsFa: "توربوکمپرسور, هم‌محوری لیزری, ارتعاشات, شیم‌پلیت, As-Built, ISO 10816",
      PhysicalBoxRef: "BOX-ENG-A12", IndexedBy: "u-doc", IndexedDate: "2026-09-26",
      Status: "verified", NoteFa: "نمایه‌سازی تمام‌متن با دقت ۹۸.۴٪ انجام شد",
    },
    {
      Id: `eoi-${projectId}-02`, ProjectId: projectId, IndexNo: "OCR-1405-102",
      DocCode: "AZD-QMS-QA-PRC-0309", RevisionCode: "Rev-B",
      ArchiveZoneCode: "ZON-QMS-02", ScanDpi: 400, OcrLang: "fa+en",
      OcrConfidencePct: 97.9,
      ExtractedTextFa: "دستورالعمل جوشکاری فولاد زنگ‌نزن دوبلکس UNS S31803 به روش GTAW و SMAW. دمای بین‌پاسی حداکثر ۱۵۰ درجه سانتی‌گراد، گاز محافظ پشت‌بند نیتروژن خلوص ۹۹.۹۹٪ و درصد فریت مجاز بین ۳۵ تا ۵۵ درصد.",
      KeywordsTagsFa: "جوشکاری, فولاد دوبلکس, WPS, GTAW, فریت‌سنجی, مخازن تحت فشار",
      PhysicalBoxRef: "BOX-QMS-B04", IndexedBy: "u-doc", IndexedDate: "2026-10-10",
      Status: "indexed", NoteFa: "قابل جستجو در موتور جستجوی یکپارچه EDMS/KMS",
    },
    {
      Id: `eoi-${projectId}-03`, ProjectId: projectId, IndexNo: "OCR-1405-103",
      DocCode: "AZD-ENG-ME-DWG-0104", RevisionCode: "Approved",
      ArchiveZoneCode: "ZON-OPS-04", ScanDpi: 300, OcrLang: "fa+en",
      OcrConfidencePct: 99.1,
      ExtractedTextFa: "دفترچه بهره‌برداری و تعمیرات فورانگیر BOP دکل حفاری ۱۵۰۰۰ PSI. تست فشار هیدرولیک Ram Preventer و Annular Preventer هر ۱۴ روز یک‌بار الزامی است. حداقل فشار کاری سیستم انباشتگر Accumulator برابر 3000 PSI می‌باشد.",
      KeywordsTagsFa: "فورانگیر, BOP, دکل حفاری, تست فشار, Accumulator, کنترل فوران",
      PhysicalBoxRef: "BOX-RIG-D02", IndexedBy: "u-doc", IndexedDate: "2026-10-03",
      Status: "verified", NoteFa: "متصل به پایگاه دانش تعمیرات دکل",
    },
  ];
  for (const row of ocrRecords) await db.insert("EdmsOcrSearchIndex", row);

  /* ── ۷. مدیریت دانش سازمانی (KMS: KmsLessonRecord & KmsKnowledgeBaseArticle) ── */
  const lessons = [
    {
      Id: `klr-${projectId}-01`, ProjectId: projectId, LessonCode: "LL-1405-001",
      TitleFa: "جلوگیری از ترک گرم و افت مقاومت به خوردگی در جوشکاری لوله‌های دوبلکس",
      DomainPillar: "manufacturing-mes",
      SourceContextFa: "کارگاه ساخت مخازن و مبدل‌های حرارتی (MES — مرکز کاری WC-WLD-01)",
      ProblemOrEventFa: "در تست اولیه رادیوگرافی و فریت‌سنجی سرجوش‌های نازل مبدل، عدم توازن فاز آستنیت-فریت در ناحیه متأثر از حرارت (HAZ) مشاهده شد.",
      RootCauseFa: "حرارت ورودی بیش از ۲.۲ کیلوژول بر میلی‌متر و دمای بین‌پاسی بالای ۱۸۰ درجه در پاس دوم و سوم.",
      ActionAndLessonFa: "محدودسازی دمای بین‌پاسی به زیر ۱۵۰ درجه با پایش پیرومتر لیزری و تزریق گاز پشت‌بند آرگون+نیتروژن تا خنک شدن کامل زیر ۱۰۰ درجه؛ ضایعات دوباره‌کاری به صفر رسید.",
      SeverityImpact: "high", EstimatedSavingRials: 1850000000,
      AuthorBy: "EMP-1006", ValidatedBy: "u-qa", AppliedCount: 9,
      Status: "published", NoteFa: "ثبت‌شده در ویرایش Rev-B سند AZD-QMS-QA-PRC-0309",
    },
    {
      Id: `klr-${projectId}-02`, ProjectId: projectId, LessonCode: "LL-1405-002",
      TitleFa: "تشخیص زودهنگام رزونانس پایه توربوکمپرسور پیش از تخریب مکانیکال سیل",
      DomainPillar: "maintenance-cmms",
      SourceContextFa: "سایت بهره‌برداری واحد ۱۰۰ — کمپرسور گاز ترش (CMMS — AST-COMP-101A)",
      ProblemOrEventFa: "افزایش ناگهانی دامنه ارتعاش در فرکانس 2X RPM پس از بارگیری ۸۵٪ کمپرسور.",
      RootCauseFa: "پایه لق (Soft Foot) به میزان 0.18mm در تکیه‌گاه سمت کوپلینگ در اثر نشست جزئی گروت.",
      ActionAndLessonFa: "الزام به تست Soft Foot لیزری در چک‌لیست تحویل دستورکارهای اورهال CMMS پیش از بستن کوپلینگ؛ جلوگیری از توقف ۷۲ ساعته خط تولید.",
      SeverityImpact: "strategic", EstimatedSavingRials: 4200000000,
      AuthorBy: "EMP-1003", ValidatedBy: "u-engmgr", AppliedCount: 14,
      Status: "published", NoteFa: "تبدیل‌شده به رویه استاندارد در خانواده تجهیز توربوکمپرسورها",
    },
    {
      Id: `klr-${projectId}-03`, ProjectId: projectId, LessonCode: "LL-1405-003",
      TitleFa: "پایدارسازی تله‌متری لبه دکل در زمان قطع ارتباط ماهواره‌ای با بافر Store-and-Forward",
      DomainPillar: "drilling-iiot",
      SourceContextFa: "میدان آزادگان — دکل حفاری RIG-DEMO (سامانه IIoT & DAS)",
      ProblemOrEventFa: "قطع ۴۰ دقیقه‌ای لینک ارتباطی دکل در طوفان گردوغبار در حین عملیات لولهگذاری.",
      RootCauseFa: "اشباع حافظه موقت گیت‌وی لبه در نرخ نمونه‌برداری ۱۰۰ هرتز کانال‌های ارتعاش رشته حفاری.",
      ActionAndLessonFa: "فعال‌سازی فشرده‌سازی تطبیقی (Adaptive Downsampling) روی گیت‌وی لبه برای کانال‌های غیربحرانی و حفظ نرخ کامل روی فشار لوله ایستاده (SPP) و حجم گل؛ صفر شدن ریزش داده.",
      SeverityImpact: "high", EstimatedSavingRials: 1100000000,
      AuthorBy: "EMP-1004", ValidatedBy: "u-pm", AppliedCount: 6,
      Status: "published", NoteFa: "اعمال‌شده روی تمامی گیت‌وی‌های لبه ناوگان حفاری",
    },
  ];
  for (const row of lessons) await db.insert("KmsLessonRecord", row);

  const wikiArticles = [
    {
      Id: `kka-${projectId}-01`, ProjectId: projectId, ArticleCode: "WIKI-CMMS-101",
      TitleFa: "راهنمای جامع هم‌محوری لیزری (Laser Shaft Alignment) و رفع Soft Foot در پمپ‌ها و کمپرسورها",
      ArticleType: "best-practice",
      KnowledgeAreaFa: "نگهداری و تعمیرات و قابلیت اطمینان (CMMS)",
      SummaryFa: "روش گام‌به‌گام کنترل لقی پایه، محاسبه انبساط حرارتی (Thermal Growth) و تلرانس‌های مجاز هم‌محوری بر اساس دور موتور.",
      BodyMarkdownFa: "۱. پیش از هرگونه هم‌محوری، مقدار Soft Foot هر چهار پایه الکتروموتور را با ساعت اندیکاتور یا سنسور لیزری بسنجید (حداکثر مجاز 0.05mm).\n۲. مقادیر انبساط حرارتی عمودی و افقی را از دفترچه سازنده (سند AZD-ENG-ME-DWG-0101) استخراج و در دستگاه لیزر وارد نمایید.\n۳. از شیم‌پلیت‌های استنلس‌استیل پیش‌برش‌خورده استفاده کنید و هرگز بیش از ۴ شیم زیر یک پایه قرار ندهید.",
      TagsCsv: "هم‌محوری لیزری, Soft Foot, توربوکمپرسور, پمپ سانتریفیوژ, CMMS",
      RefDocCode: "AZD-ENG-ME-DWG-0101", AuthorBy: "EMP-1003", ReviewedBy: "u-engmgr",
      ViewCount: 148, HelpfulVotes: 42, VersionNo: 3, Status: "featured",
      NoteFa: "مقاله برگزیده پایگاه دانش فنی نت",
    },
    {
      Id: `kka-${projectId}-02`, ProjectId: projectId, ArticleCode: "WIKI-MES-202",
      TitleFa: "پروتکل انتخاب پارامترهای برشی و فیکسچربندی در ماشین‌کاری ۵ محور قطعات سوپرآلیاژ Inconel 718",
      ArticleType: "sop-procedure",
      KnowledgeAreaFa: "ساخت و تولید صنعتی (MES)",
      SummaryFa: "بهینه‌سازی سرعت برشی، نرخ پیشروی و فشار خنک‌کاری از داخل ابزار (Through-Spindle Coolant) برای افزایش عمر ابزار کاربیدی.",
      BodyMarkdownFa: "۱. در خشن‌کاری Inconel 718 از استراتژی Trochoidal Milling با درگیری شعاعی حداکثر ۱۰٪ قطر ابزار استفاده شود.\n۲. فشار مایع خنک‌کننده داخلی اسپیندل باید حداقل ۷۰ بار تنظیم گردد تا از کارسختی (Work Hardening) سطح جلوگیری شود.\n۳. سایش لبه ابزار در پایان هر عملیات OP-020-CNC بررسی و در سامانه MES ثبت گردد.",
      TagsCsv: "ماشین‌کاری CNC, اینکونل, فرز ۵ محور, Trochoidal, MES",
      RefDocCode: "AZD-QMS-QA-PRC-0309", AuthorBy: "EMP-1002", ReviewedBy: "u-qa",
      ViewCount: 112, HelpfulVotes: 35, VersionNo: 2, Status: "published",
      NoteFa: "استاندارد داخلی سالن ماشین‌کاری سنگین",
    },
    {
      Id: `kka-${projectId}-03`, ProjectId: projectId, ArticleCode: "WIKI-RIG-305",
      TitleFa: "چک‌لیست عملیاتی تشخیص زودهنگام جریان‌یابی چاه (Kick Detection) و بستن فورانگیر BOP",
      ArticleType: "troubleshooting-guide",
      KnowledgeAreaFa: "عملیات حفاری و پایش میدانی (IIoT / Rig)",
      SummaryFa: "تفسیر همزمان افزایش دبی خروجی گل، افزایش حجم مخازن (Pit Gain) و افت فشار لوله ایستاده در داشبورد تله‌متری.",
      BodyMarkdownFa: "۱. به محض مشاهده افزایش حجم مخزن فعال بیش از ۵ بشکه یا افزایش دبی برگشتی، پمپ‌های گل را متوقف و Flow Check انجام دهید.\n۲. در صورت مثبت بودن جریان، مطابق روش Hard Shut-In فورانگیر حلقوی (Annular BOP) را بسته و فشار SITPP و SICP را قرائت و در لاگ IIoT ثبت نمایید.",
      TagsCsv: "کنترل فوران, Kick, فورانگیر BOP, حفاری, تله‌متری IIoT",
      RefDocCode: "AZD-ENG-ME-DWG-0104", AuthorBy: "EMP-1004", ReviewedBy: "u-pm",
      ViewCount: 96, HelpfulVotes: 29, VersionNo: 1, Status: "featured",
      NoteFa: "دستورالعمل حیاتی ایمنی عملیات حفاری",
    },
  ];
  for (const row of wikiArticles) await db.insert("KmsKnowledgeBaseArticle", row);

  return { seeded: true, projectId, masterDocs: masterDocs.length, lessons: lessons.length };
}

function registerCrudTable(app, { getDb, requirePerm, basePath, table, idPrefix, viewPerm, writePerm, codeField }) {
  app.get(`/api/edms/:projectId/${basePath}`, requirePerm(viewPerm), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId } = req.params;
      await seedEdmsWorkspaceData(db, projectId);
      const rows = await db.list(table, { ProjectId: projectId });
      res.json({ projectId, items: rows, count: rows.length });
    } catch (e) { next(e); }
  });

  app.post(`/api/edms/:projectId/${basePath}`, requirePerm(writePerm), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId } = req.params;
      const body = req.body || {};
      if (codeField && (!body[codeField] || !String(body[codeField]).trim())) {
        return res.status(400).json({ error: "MISSING_CODE", messageFa: `فیلد «${codeField}» الزامی است.` });
      }
      const id = body.Id || `${idPrefix}-${projectId}-${Date.now().toString(36)}`;
      const row = { ...body, Id: id, ProjectId: projectId };
      const inserted = await db.insert(table, row);
      res.status(201).json(inserted);
    } catch (e) { next(e); }
  });

  app.put(`/api/edms/:projectId/${basePath}/:id`, requirePerm(writePerm), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId, id } = req.params;
      const existing = await db.get(table, id);
      if (!existing || existing.ProjectId !== projectId) {
        return res.status(404).json({ error: "NOT_FOUND", messageFa: "رکورد مورد نظر یافت نشد." });
      }
      const patch = { ...req.body };
      delete patch.Id;
      delete patch.ProjectId;
      const updated = await db.update(table, id, patch);
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete(`/api/edms/:projectId/${basePath}/:id`, requirePerm(writePerm), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId, id } = req.params;
      const existing = await db.get(table, id);
      if (!existing || existing.ProjectId !== projectId) {
        return res.status(404).json({ error: "NOT_FOUND", messageFa: "رکورد مورد نظر یافت نشد." });
      }
      await db.remove(table, id);
      res.json({ ok: true, id });
    } catch (e) { next(e); }
  });
}

export function registerEdmsWorkspaceRoutes(app, { repo, subjects = [], evaluate }) {
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
  const getDb = async (req) => wrapRepo(await repo(), actor(req));
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const requirePerm = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-EDMS-AUTH-REQUIRED", message: "شناسهٔ کاربر (x-user-id) الزامی است", permission } });
    }
    req.user = subject;
    const verdict = evaluate(subject, permission, { projectId: undefined });
    if (!verdict.allow && enforce) {
      return res.status(403).json({ ok: false, error: { code: "E-EDMS-FORBIDDEN", message: "مجوز دسترسی به این عملیات اسناد و دانش را ندارید", permission } });
    }
    return next();
  };

  /* ── خلاصهٔ جامع فضای کاری EDMS / KMS ── */
  app.get("/api/edms/:projectId/workspace", requirePerm("edms.document.view"), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId } = req.params;
      await seedEdmsWorkspaceData(db, projectId);

      const [
        numberingRules,
        masterDocs,
        revisions,
        locks,
        workflows,
        transmittals,
        archiveZones,
        ocrRecords,
        lessons,
        wikiArticles,
      ] = await Promise.all([
        db.list("EdmsNumberingRule", { ProjectId: projectId }),
        db.list("EdmsMasterDocument", { ProjectId: projectId }),
        db.list("EdmsRevisionRecord", { ProjectId: projectId }),
        db.list("EdmsCheckoutLock", { ProjectId: projectId }),
        db.list("EdmsWorkflowInstance", { ProjectId: projectId }),
        db.list("EdmsTransmittalPackage", { ProjectId: projectId }),
        db.list("EdmsArchiveZone", { ProjectId: projectId }),
        db.list("EdmsOcrSearchIndex", { ProjectId: projectId }),
        db.list("KmsLessonRecord", { ProjectId: projectId }),
        db.list("KmsKnowledgeBaseArticle", { ProjectId: projectId }),
      ]);

      const avgOcrConfidence = ocrRecords.length > 0
        ? Number((ocrRecords.reduce((s, r) => s + toNum(r.OcrConfidencePct), 0) / ocrRecords.length).toFixed(1))
        : 0;
      const totalEstimatedSavingsRials = lessons.reduce((s, l) => s + toNum(l.EstimatedSavingRials), 0);

      res.json({
        projectId,
        standards: [
          "ISO 15489-1:2016 Records Management",
          "ISO 30301:2019 Management Systems for Records",
          "ISO 9001:2015 Documented Information Control",
          "ISO 30401:2018 Knowledge Management Systems (KMS)",
        ],
        kpis: {
          numberingRulesCount: numberingRules.length,
          masterDocumentsCount: masterDocs.length,
          approvedOrIfcDocsCount: masterDocs.filter((d) => ["Approved", "IFC", "As-Built"].includes(d.LifecycleStage)).length,
          asBuiltDocsCount: masterDocs.filter((d) => d.LifecycleStage === "As-Built").length,
          revisionsCount: revisions.length,
          activeCheckoutLocksCount: locks.filter((l) => l.Status === "checked-out").length,
          activeWorkflowsCount: workflows.filter((w) => w.Status === "in-review").length,
          transmittalsCount: transmittals.length,
          archiveZonesCount: archiveZones.length,
          totalArchivedDocsCount: archiveZones.reduce((s, z) => s + toNum(z.StoredDocsCount), 0),
          ocrIndexedCount: ocrRecords.length,
          avgOcrConfidencePct: avgOcrConfidence,
          lessonsLearnedCount: lessons.length,
          knowledgeArticlesCount: wikiArticles.length,
          totalKnowledgeSavingsRials: totalEstimatedSavingsRials,
        },
      });
    } catch (e) { next(e); }
  });

  /* ── اقدام ۱: تولید خودکار کد استاندارد سند از روی الگوی شماره‌گذاری ── */
  app.post("/api/edms/:projectId/numbering-rules/:id/generate-code", requirePerm("edms.document.manage"), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId, id } = req.params;
      const rule = await db.get("EdmsNumberingRule", id);
      if (!rule || rule.ProjectId !== projectId) {
        return res.status(404).json({ error: "NOT_FOUND", messageFa: "الگوی شماره‌گذاری یافت نشد." });
      }
      const nextSeq = toNum(rule.CurrentSeq, 100) + 1;
      const digits = Math.max(2, toNum(rule.SeqDigits, 4));
      const sep = rule.Separator || "-";
      const generatedCode = `${rule.PrefixPattern}${sep}${String(nextSeq).padStart(digits, "0")}`;
      const updated = await db.update("EdmsNumberingRule", id, {
        CurrentSeq: nextSeq,
        ExampleDocCode: generatedCode,
      });
      res.json({ ok: true, generatedCode, rule: updated });
    } catch (e) { next(e); }
  });

  /* ── اقدام ۲: قفل کردن سند برای ویرایش (Check-Out) و آزادسازی با ثبت نسخه جدید (Check-In) ── */
  app.post("/api/edms/:projectId/master-documents/:id/checkout", requirePerm("edms.revision.manage"), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId, id } = req.params;
      const doc = await db.get("EdmsMasterDocument", id);
      if (!doc || doc.ProjectId !== projectId) {
        return res.status(404).json({ error: "NOT_FOUND", messageFa: "سند مورد نظر یافت نشد." });
      }
      if (doc.Status === "checked-out") {
        return res.status(409).json({
          error: "ALREADY_CHECKED_OUT",
          messageFa: `سند «${doc.DocCode}» هم‌اکنون توسط «${doc.CheckedOutBy}» قفل (Check-Out) شده است.`,
        });
      }
      const actorId = req.user?.id || "u-doc";
      const reasonFa = String(req.body?.reasonFa || "ویرایش فنی و ارتقای ریویژن سند").trim();
      const updatedDoc = await db.update("EdmsMasterDocument", id, {
        CheckedOutBy: actorId,
        Status: "checked-out",
      });
      const lock = await db.insert("EdmsCheckoutLock", {
        Id: `ecl-${projectId}-${Date.now().toString(36)}`,
        ProjectId: projectId,
        LockNo: `LCK-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        DocCode: doc.DocCode,
        BaseRevision: doc.CurrentRevision || "Rev-A",
        CheckedOutBy: actorId,
        CheckedOutAt: new Date().toISOString(),
        ExpectedReturnDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        CheckOutReasonFa: reasonFa,
        CheckedInAt: null,
        ResultingRevision: null,
        CheckInDiffNotesFa: null,
        Status: "checked-out",
        NoteFa: `Check-Out ثبت‌شده روی سند ${doc.DocCode}`,
      });
      res.status(201).json({ ok: true, document: updatedDoc, lock });
    } catch (e) { next(e); }
  });

  app.post("/api/edms/:projectId/master-documents/:id/checkin", requirePerm("edms.revision.manage"), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId, id } = req.params;
      const doc = await db.get("EdmsMasterDocument", id);
      if (!doc || doc.ProjectId !== projectId) {
        return res.status(404).json({ error: "NOT_FOUND", messageFa: "سند مورد نظر یافت نشد." });
      }
      const nextRev = String(req.body?.newRevision || "Approved").trim();
      const diffNotesFa = String(req.body?.diffHighlightsFa || "اعمال اصلاحات فنی، بازبینی نهایی و رفع قفل ویرایش").trim();
      const actorId = req.user?.id || "u-doc";

      const updatedDoc = await db.update("EdmsMasterDocument", id, {
        CurrentRevision: nextRev,
        LifecycleStage: ["Approved", "IFC", "As-Built"].includes(nextRev) ? nextRev : "In-Review",
        CheckedOutBy: null,
        Status: "active",
      });

      const locks = await db.list("EdmsCheckoutLock", { ProjectId: projectId });
      const activeLock = locks.find((l) => l.DocCode === doc.DocCode && l.Status === "checked-out");
      if (activeLock) {
        await db.update("EdmsCheckoutLock", activeLock.Id, {
          CheckedInAt: new Date().toISOString(),
          ResultingRevision: nextRev,
          CheckInDiffNotesFa: diffNotesFa,
          Status: "checked-in",
        });
      }

      const revRecord = await db.insert("EdmsRevisionRecord", {
        Id: `err-${projectId}-${Date.now().toString(36)}`,
        ProjectId: projectId,
        RevisionNo: `REV-${doc.DocCode.slice(-4)}-${nextRev}-${Date.now().toString(36).slice(-2).toUpperCase()}`,
        DocCode: doc.DocCode,
        RevisionCode: nextRev,
        ChangeSummaryFa: `Check-In نسخه جدید ${nextRev} پس از تکمیل ویرایش`,
        ComparedToRev: doc.CurrentRevision || "Rev-A",
        DiffHighlightsFa: diffNotesFa,
        FileUri: `/vault/edms/${doc.DocCode}_${nextRev}.pdf`,
        FileHashSha256: `sha256-${Date.now().toString(16)}`,
        PageCount: 10,
        PreparedBy: actorId,
        CheckedBy: "u-qa",
        ApprovedBy: "u-pm",
        IssueDate: new Date().toISOString().slice(0, 10),
        Status: nextRev === "As-Built" ? "as-built" : "approved",
        NoteFa: "ثبت خودکار ریویژن در هنگام Check-In سند",
      });

      res.json({ ok: true, document: updatedDoc, revision: revRecord });
    } catch (e) { next(e); }
  });

  /* ── اقدام ۳: موتور جستجوی تمام‌متن (Full-Text Search Engine) روی متادیتا، متن OCR، دروس آموخته و ویکی ── */
  app.get("/api/edms/:projectId/fulltext-search", requirePerm("edms.archive.view"), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId } = req.params;
      await seedEdmsWorkspaceData(db, projectId);
      const q = String(req.query.q || "").trim().toLowerCase();
      const sourceFilter = String(req.query.source || "all").trim();

      const [masterDocs, ocrRecords, lessons, wikiArticles] = await Promise.all([
        db.list("EdmsMasterDocument", { ProjectId: projectId }),
        db.list("EdmsOcrSearchIndex", { ProjectId: projectId }),
        db.list("KmsLessonRecord", { ProjectId: projectId }),
        db.list("KmsKnowledgeBaseArticle", { ProjectId: projectId }),
      ]);

      const hits = [];

      if (sourceFilter === "all" || sourceFilter === "dmi") {
        for (const d of masterDocs) {
          const text = `${d.DocCode} ${d.TitleFa} ${d.TitleEn || ""} ${d.Discipline} ${d.OwnerDepartmentFa} ${d.NoteFa || ""}`;
          if (!q || text.toLowerCase().includes(q)) {
            hits.push({
              id: d.Id,
              sourceType: "dmi",
              sourceLabelFa: "شناسنامه سند (DMI)",
              code: d.DocCode,
              titleFa: d.TitleFa,
              revisionOrCategory: `${d.CurrentRevision} · ${d.Discipline}`,
              snippetFa: `${d.OwnerDepartmentFa} — ${d.NoteFa || d.TitleEn || ""}`,
              confidenceOrScore: 100,
            });
          }
        }
      }

      if (sourceFilter === "all" || sourceFilter === "ocr") {
        for (const o of ocrRecords) {
          const text = `${o.DocCode} ${o.ExtractedTextFa} ${o.KeywordsTagsFa} ${o.ArchiveZoneCode}`;
          if (!q || text.toLowerCase().includes(q)) {
            hits.push({
              id: o.Id,
              sourceType: "ocr",
              sourceLabelFa: "متن استخراج‌شده اسکن (OCR)",
              code: `${o.DocCode} (${o.IndexNo})`,
              titleFa: `متن OCR سند ${o.DocCode} — زون ${o.ArchiveZoneCode}`,
              revisionOrCategory: `${o.RevisionCode} · دقت OCR: ${o.OcrConfidencePct}٪`,
              snippetFa: o.ExtractedTextFa,
              confidenceOrScore: toNum(o.OcrConfidencePct, 98),
            });
          }
        }
      }

      if (sourceFilter === "all" || sourceFilter === "lessons") {
        for (const l of lessons) {
          const text = `${l.LessonCode} ${l.TitleFa} ${l.ProblemOrEventFa} ${l.RootCauseFa} ${l.ActionAndLessonFa}`;
          if (!q || text.toLowerCase().includes(q)) {
            hits.push({
              id: l.Id,
              sourceType: "lessons",
              sourceLabelFa: "درس‌آموخته (Lessons Learned)",
              code: l.LessonCode,
              titleFa: l.TitleFa,
              revisionOrCategory: `${l.DomainPillar} · اثر: ${l.SeverityImpact}`,
              snippetFa: `ریشه: ${l.RootCauseFa} | اقدام و درس‌آموخته: ${l.ActionAndLessonFa}`,
              confidenceOrScore: 95,
            });
          }
        }
      }

      if (sourceFilter === "all" || sourceFilter === "wiki") {
        for (const w of wikiArticles) {
          const text = `${w.ArticleCode} ${w.TitleFa} ${w.SummaryFa} ${w.BodyMarkdownFa} ${w.TagsCsv}`;
          if (!q || text.toLowerCase().includes(q)) {
            hits.push({
              id: w.Id,
              sourceType: "wiki",
              sourceLabelFa: "پایگاه دانش و ویکی (KMS Wiki)",
              code: w.ArticleCode,
              titleFa: w.TitleFa,
              revisionOrCategory: `${w.ArticleType} · نسخه ${w.VersionNo}`,
              snippetFa: `${w.SummaryFa} — ${w.BodyMarkdownFa}`,
              confidenceOrScore: 96,
            });
          }
        }
      }

      res.json({
        projectId,
        query: q,
        sourceFilter,
        count: hits.length,
        items: hits,
      });
    } catch (e) { next(e); }
  });

  /* ── ثبت CRUD کامل هر ۱۰ جدول بخش ۷ ── */
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "numbering-rules", table: "EdmsNumberingRule",
    idPrefix: "enr", viewPerm: "edms.document.view", writePerm: "edms.document.manage", codeField: "RuleCode",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "master-documents", table: "EdmsMasterDocument",
    idPrefix: "emd", viewPerm: "edms.document.view", writePerm: "edms.document.manage", codeField: "DocCode",
  });

  registerCrudTable(app, {
    getDb, requirePerm, basePath: "revisions", table: "EdmsRevisionRecord",
    idPrefix: "err", viewPerm: "edms.revision.view", writePerm: "edms.revision.manage", codeField: "RevisionNo",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "checkout-locks", table: "EdmsCheckoutLock",
    idPrefix: "ecl", viewPerm: "edms.revision.view", writePerm: "edms.revision.manage", codeField: "LockNo",
  });

  registerCrudTable(app, {
    getDb, requirePerm, basePath: "workflows", table: "EdmsWorkflowInstance",
    idPrefix: "ewi", viewPerm: "edms.workflow.view", writePerm: "edms.workflow.approve", codeField: "WorkflowNo",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "transmittals", table: "EdmsTransmittalPackage",
    idPrefix: "etp", viewPerm: "edms.workflow.view", writePerm: "edms.transmittal.manage", codeField: "TransmittalNo",
  });

  registerCrudTable(app, {
    getDb, requirePerm, basePath: "archive-zones", table: "EdmsArchiveZone",
    idPrefix: "eaz", viewPerm: "edms.archive.view", writePerm: "edms.archive.manage", codeField: "ZoneCode",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "ocr-index", table: "EdmsOcrSearchIndex",
    idPrefix: "eoi", viewPerm: "edms.archive.view", writePerm: "edms.archive.manage", codeField: "IndexNo",
  });

  registerCrudTable(app, {
    getDb, requirePerm, basePath: "lessons-learned", table: "KmsLessonRecord",
    idPrefix: "klr", viewPerm: "edms.kms.view", writePerm: "edms.kms.manage", codeField: "LessonCode",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "knowledge-articles", table: "KmsKnowledgeBaseArticle",
    idPrefix: "kka", viewPerm: "edms.kms.view", writePerm: "edms.kms.manage", codeField: "ArticleCode",
  });
}
