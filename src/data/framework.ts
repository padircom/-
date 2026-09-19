export type Lang = "fa" | "en";
export type Bi = { fa: string; en: string };

export const t = (v: Bi, lang: Lang) => v[lang];

/* ============================================================
   RIGHT SIDEBAR — Comprehensive Project Management Framework
   Flat rows, ZERO dropdowns, ZERO numeric prefixes.
   ============================================================ */
export type Module = {
  id: string;
  icon: string;
  accent: string;
  title: Bi;
  items: Bi[];
};

/* ============================================================
   Detailed process taxonomy — 6 domains / 30+ processes
   Each sub-process carries: SQL table, data source, AI function
   ============================================================ */
/** پیوندِ ناوبری به یک زیرفرآیندِ دیگر (ارجاع میان‌دامنه‌ای). */
export type SubLink = {
  /** شناسهٔ زیرفرآیند مقصد، مثل `"d1-p2-s1"`. */
  to: string;
  label: Bi;
};

export type SubProcess = {
  id: string;
  title: Bi;
  activity: Bi;
  source: string;
  sql: string[];
  output: string;
  connectsTo: string;
  ai: string;
  /** پیوندهای ناوبری مرتبط (اختیاری) — در صفحهٔ قابلیت به صورت چیپ دیده می‌شود. */
  links?: SubLink[];
};

export type Process = {
  id: string;
  title: Bi;
  subs: SubProcess[];
};

export type SidebarGroupId = "pg1" | "pg2" | "pg3" | "pg4" | "pg5" | "support" | "field";

export type Domain = {
  id: string;
  icon: string;
  accent: string;
  title: Bi;
  /** گروه چرخهٔ حیات PMBOK در سایدبار؛ `field` یعنی میان‌بر اقدام سریع (بدون گروه). */
  group: SidebarGroupId;
  processes: Process[];
};

/* ============================================================
   SIDEBAR — گروه‌بندی دامنه‌ها بر چرخهٔ حیات PMBOK
   رنگ و کد کوتاه هر گروه عمداً همان حلقهٔ PMBOK (`processGroups`)
   است تا سایدبار و حلقه یک زبان داشته باشند.
   ============================================================ */
export type SidebarGroup = {
  id: Exclude<SidebarGroupId, "field">;
  title: Bi;
  short: string;
  color: string;
  /** گروه سنجاق‌شدهٔ انتهای سایدبار (مستقل از آکاردئون فازها). */
  pinned?: boolean;
};

export const sidebarGroups: SidebarGroup[] = [
  { id: "pg1", title: { fa: "آغازین", en: "Initiating" }, short: "IN", color: "#7FB2FF" },
  { id: "pg2", title: { fa: "برنامه‌ریزی", en: "Planning" }, short: "PL", color: "#8FE3C8" },
  { id: "pg3", title: { fa: "اجرا", en: "Executing" }, short: "EX", color: "#FFD48A" },
  { id: "pg4", title: { fa: "پایش و کنترل", en: "Monitoring & Controlling" }, short: "MC", color: "#FF9F9F" },
  { id: "pg5", title: { fa: "اختتامیه", en: "Closing" }, short: "CL", color: "#C9A7FF" },
  { id: "support", title: { fa: "پشتیبان", en: "Supporting" }, short: "SP", color: "#94A3B8", pinned: true },
];

export const domains: Domain[] = [
  {
    id: "d6",
    group: "pg1",
    icon: "🏛",
    accent: "#B8D4FF",
    title: { fa: "مدیریت حاکمیت و فرآیندهای PMBOK", en: "Governance & PMBOK Processes" },
    processes: [
      {
        id: "d6-p1",
        title: { fa: "حاکمیت (Governance)", en: "Governance" },
        subs: [
          { id: "d6-p1-s1", title: { fa: "گردش فرآیند", en: "Process Workflow" }, activity: { fa: "گردش فرآیند سازمانی", en: "Org workflow" }, source: "PMBOK, سازمان / Org", sql: ["Process_Master", "Workflow_Instance"], output: "Process Report", connectsTo: "PMO", ai: "AI Process Advisor" },
        ],
      },
      {
        id: "d6-p2",
        title: { fa: "مدیریت یکپارچگی", en: "Integration Management" },
        subs: [
          { id: "d6-p2-s1", title: { fa: "تجمیع داده‌ها", en: "Data Integration" }, activity: { fa: "تجمیع داده‌ها", en: "Data consolidation" }, source: "API, ERP, Primavera", sql: ["Project_Master", "Integration_Log"], output: "Executive Report", connectsTo: "BI Platform", ai: "AI Project Advisor" },
        ],
      },
      {
        id: "d6-p3",
        title: { fa: "مدیریت ذی‌نفعان", en: "Stakeholder Management" },
        subs: [
          { id: "d6-p3-s1", title: { fa: "ذی‌نفعان", en: "Stakeholders" }, activity: { fa: "مدیریت ارتباط", en: "Relation management" }, source: "User Entry", sql: ["Stakeholder_Register"], output: "Stakeholder Report", connectsTo: "Communication", ai: "AI Stakeholder Analysis" },
        ],
      },
      {
        id: "d6-p4",
        title: { fa: "ممیزی (Audit)", en: "Audit" },
        subs: [
          { id: "d6-p4-s1", title: { fa: "کنترل انطباق", en: "Compliance Control" }, activity: { fa: "کنترل انطباق", en: "Compliance check" }, source: "EDMS, Process Data", sql: ["Audit_Register"], output: "Audit Report", connectsTo: "PMO", ai: "AI Compliance Check" },
        ],
      },
      {
        id: "d6-p5",
        title: { fa: "پشتیبان تصمیم‌گیری", en: "Decision Support" },
        subs: [
          { id: "d6-p5-s1", title: { fa: "تصمیم‌یار مدیریتی", en: "Executive Decision Aid" }, activity: { fa: "تحلیل کل پروژه", en: "Whole-project analysis" }, source: "Data Warehouse", sql: ["AI_Model_Input", "Decision_Log"], output: "Decision Report", connectsTo: "CEO Dashboard", ai: "AI Executive Assistant" },
        ],
      },
    ],
  },
  {
    /* مدیریت پیمان (MOD-14).
     *
     * این حوزه ۲۴ جدول، ۵۷ مسیر REST و ۷۴۰ آزمون داشت ولی در نقشهٔ
     * فرایندی ثبت نشده بود — یعنی کاربر راهی برای رسیدن به آن نداشت.
     * شمارهٔ d13 عمداً خالی است و به کسی تخصیص نیافته.
     */
    id: "d14",
    group: "pg3",
    icon: "📜",
    accent: "#D97706",
    title: { fa: "مدیریت پیمان و صورت‌وضعیت", en: "Contract & Payment Management" },
    processes: [
      {
        id: "d14-p1",
        title: { fa: "شناسنامه پیمان و فهرست بها", en: "Contract Register & BOQ" },
        subs: [
          { id: "d14-p1-s1", title: { fa: "ثبت شناسنامه و الحاقیه‌ها", en: "Contract Master & Amendments" }, activity: { fa: "ثبت مشخصات پیمان، مبلغ اولیه، مدت و الحاقیه‌های بعدی با سطح اختیار تأیید", en: "Register contract terms, original value, duration and subsequent amendments with approval authority" }, source: "Contract Document, Employer", sql: ["ContractMaster", "ContractAmendment", "ApprovalAuthority"], output: "Contract Register", connectsTo: "Cost, Governance", ai: "AI Clause Extractor" },
          { id: "d14-p1-s2", title: { fa: "فهرست بها و مراحل مقطوع", en: "BOQ Items & Lump-Sum Milestones" }, activity: { fa: "بارگذاری ردیف‌های فهرست بها با مقدار و نرخ، یا تعریف مراحل پرداخت مقطوع", en: "Load BOQ lines with quantity and rate, or define lump-sum payment milestones" }, source: "Tender BOQ, Excel", sql: ["ContractBOQ_Item", "LumpSumMilestone"], output: "Priced BOQ", connectsTo: "Cost, Planning", ai: "AI Rate Benchmark" },
        ],
      },
      {
        id: "d14-p2",
        title: { fa: "ریزمتره و صورت‌وضعیت موقت", en: "Measurement & Interim Payment" },
        subs: [
          { id: "d14-p2-s1", title: { fa: "برگه ریزمتره و تأیید مقدار", en: "Measurement Sheet & Quantity Approval" }, activity: { fa: "ثبت متره کارکرد دوره با ارجاع به ردیف فهرست بها و تأیید ناظر", en: "Record period measurement against BOQ lines with supervisor verification" }, source: "Site Measurement, As-Built", sql: ["MeasurementSheet"], output: "Approved Measurement", connectsTo: "Quality, Planning", ai: "AI Quantity Anomaly",
            links: [
              { to: "d5-p7-s2", label: { fa: "مبنای مقداری: برداشتِ احجام در d5", en: "Quantity basis: measurement in d5" } }
            ] },
          { id: "d14-p2-s2", title: { fa: "تهیه و گردش صورت‌وضعیت", en: "IPC Preparation & Workflow" }, activity: { fa: "تولید صورت‌وضعیت از متره تأییدشده و گذر از گام‌های تأیید تا ابلاغ", en: "Generate IPC from approved measurement and route through approval steps" }, source: "Measurement, Contract", sql: ["InterimPaymentCertificate", "IPC_LineItem", "IPC_WorkflowStep"], output: "Certified IPC", connectsTo: "Cost, Governance", ai: "AI Workflow Bottleneck" },
        ],
      },
      {
        id: "d14-p3",
        title: { fa: "تغییر مقادیر و کار جدید", en: "Variation & Extra Work" },
        subs: [
          { id: "d14-p3-s1", title: { fa: "تغییر مقادیر و کار جدید", en: "Quantity Change & New Items" }, activity: { fa: "ثبت افزایش یا کاهش مقادیر و قیمت‌گذاری ردیف‌های کار جدید خارج از فهرست بها", en: "Record quantity variation and price extra-work items outside the original BOQ" }, source: "Site Instruction, Change Order", sql: ["BOQ_QuantityChange", "ExtraWorkItem"], output: "Variation Order", connectsTo: "Claims, Cost", ai: "AI Price Analysis" },
        ],
      },
      {
        id: "d14-p4",
        title: { fa: "تعدیل و مابه‌التفاوت", en: "Price Adjustment & Material Differential" },
        subs: [
          { id: "d14-p4-s1", title: { fa: "محاسبه تعدیل بر پایه شاخص", en: "Index-Based Price Adjustment" }, activity: { fa: "اعمال شاخص دوره‌ای بر کارکرد و محاسبه مبلغ تعدیل بر اساس فرمول پیمان", en: "Apply periodic index to progress and compute adjustment per contract formula" }, source: "Statistical Center Index", sql: ["AdjustmentIndexCatalog", "PriceAdjustmentCalculation"], output: "Adjustment Statement", connectsTo: "Cost, Finance", ai: "AI Index Forecast" },
          { id: "d14-p4-s2", title: { fa: "مابه‌التفاوت مصالح", en: "Material Price Differential" }, activity: { fa: "محاسبه اختلاف قیمت مصالح شاخص نسبت به مبنای پیمان", en: "Compute differential for indexed materials against contract baseline" }, source: "Invoice, Market Price", sql: ["MaterialDiffCalc"], output: "Material Differential", connectsTo: "Procurement, Cost", ai: "AI Market Trend" },
        ],
      },
      {
        id: "d14-p5",
        title: { fa: "کسورات، پیش‌پرداخت و سپرده", en: "Deductions, Advance & Retention" },
        subs: [
          { id: "d14-p5-s1", title: { fa: "کسور صورت‌وضعیت", en: "IPC Deductions" }, activity: { fa: "اعمال کسور قانونی و قراردادی شامل بیمه، مالیات، جریمه و استرداد پیش‌پرداخت", en: "Apply statutory and contractual deductions including insurance, tax, penalty and advance recovery" }, source: "Contract Terms, Regulation", sql: ["IPC_Deduction"], output: "Net Payable", connectsTo: "Finance, Governance", ai: "AI Deduction Check" },
          { id: "d14-p5-s2", title: { fa: "پیش‌پرداخت و سپرده حسن انجام کار", en: "Advance Payment & Retention Ledger" }, activity: { fa: "پایش مانده پیش‌پرداخت و دفتر سپرده تا آزادسازی در تحویل موقت و قطعی", en: "Track advance balance and retention ledger through provisional and final release" }, source: "Contract, Guarantee", sql: ["AdvancePaymentSchedule", "RetainageLedger"], output: "Advance & Retention Position", connectsTo: "Finance, Commissioning", ai: "AI Release Reminder" },
        ],
      },
      {
        id: "d14-p6",
        title: { fa: "ضمانت‌نامه و پیمانکار جزء", en: "Guarantees & Subcontractors" },
        subs: [
          { id: "d14-p6-s1", title: { fa: "ضمانت‌نامه و پایش انقضا", en: "Guarantee Register & Expiry Watch" }, activity: { fa: "ثبت ضمانت‌نامه‌های شرکت در مناقصه، انجام تعهدات و پیش‌پرداخت با هشدار انقضا", en: "Register bid, performance and advance guarantees with expiry alerts" }, source: "Bank Guarantee", sql: ["ContractGuarantee"], output: "Guarantee Status", connectsTo: "Finance, Risk", ai: "AI Expiry Predictor" },
          { id: "d14-p6-s2", title: { fa: "صورت‌وضعیت پیمانکار جزء و کسور متقابل", en: "Subcontractor IPC & Back-to-Back" }, activity: { fa: "تهیه صورت‌وضعیت پیمانکار جزء و اعمال کسور متقابل هم‌راستا با پیمان اصلی", en: "Prepare subcontractor IPC and apply back-to-back deductions aligned with the main contract" }, source: "Subcontract, Site Record", sql: ["SubcontractorIPC", "SubcontractorIPC_LineItem", "BackToBackDeduction"], output: "Subcontractor Payment", connectsTo: "Workforce, Finance", ai: "AI Overbilling Detection" },
        ],
      },
      {
        id: "d14-p7",
        title: { fa: "شاخص پیمان و انطباق مالی", en: "Contract KPIs & Financial Reconciliation" },
        subs: [
          { id: "d14-p7-s1", title: { fa: "شاخص‌های کلیدی و هشدار زودهنگام", en: "Contract KPIs & Early Warning" }, activity: { fa: "پنج شاخص پیمان و قواعد هشدار انحراف مبلغ، تأخیر پرداخت و انقضای ضمانت", en: "Five contract KPIs with alert rules for value variance, payment delay and guarantee expiry" }, source: "IPC, Guarantee, Schedule", sql: ["ContractMetricsSnapshot", "ContractAlertRule"], output: "Contract KPI Report", connectsTo: "Dashboard, Risk", ai: "AI Trend Analysis" },
          { id: "d14-p7-s2", title: { fa: "انطباق صورت‌وضعیت با دفتر مالی", en: "IPC to Finance Reconciliation" }, activity: { fa: "ثبت صورت‌وضعیت ابلاغی در دفتر مالی و آشتی دو دفتر برای کشف شکاف", en: "Post certified IPC to the finance ledger and reconcile both books to surface gaps" }, source: "Certified IPC", sql: ["ContractFinPosting"], output: "Reconciliation Report", connectsTo: "Finance", ai: "AI Gap Detection" },
        ],
      },
      {
        id: "d14-p8",
        title: { fa: "ارزیابی پیمانکاران و تأمین‌کنندگان", en: "Contractor & Supplier Rating" },
        subs: [
          { id: "d14-p8-s1", title: { fa: "امتیازدهی وزنی", en: "Weighted Scoring" }, activity: { fa: "امتیازِ شش‌محوره (ایمنی، کیفیت، زمان، قیمت، مستندات، همکاری) با وزن‌های متمرکز و رتبهٔ A تا D", en: "Six-axis scoring (HSE, quality, schedule, price, documentation, cooperation) with central weights and A–D grading" }, source: "Inspection, Site Reports, Procurement", sql: ["Contractor_Performance", "Vendor_Score"], output: "Rating Card", connectsTo: "Procurement, Quality, HSE", ai: "AI Performance Predictor" },
          { id: "d14-p8-s2", title: { fa: "روند، پایش و فهرستِ بهبود", en: "Trend, Watchlist & Improvement" }, activity: { fa: "مقایسه با دورهٔ قبل، نشان‌دار کردنِ رتبه‌های C و D و تعیین ضعیف‌ترین محور به‌عنوان هدفِ بهبود", en: "Compare with previous period, flag C/D grades and pick the weakest axis as improvement target" }, source: "Rating History", sql: ["Vendor_Score_History"], output: "Watchlist & Improvement Plan", connectsTo: "Governance, Procurement", ai: "AI Improvement Coach" },
        ],
      },
    ],
  },
  {
    id: "d1",
    group: "support",
    icon: "🗂",
    accent: "#7FB2FF",
    title: { fa: "مدیریت اطلاعات و مستندات پروژه", en: "Project Information & Document Management" },
    processes: [
      {
        id: "d1-p1",
        title: { fa: "EDMS", en: "EDMS" },
        subs: [
          { id: "d1-p1-s1", title: { fa: "کنترل مدارک", en: "Document Control" }, activity: { fa: "ثبت و گردش مدارک", en: "Register & workflow" }, source: "EDMS, Excel, Upload", sql: ["Document_Master", "Document_Transaction", "Document_Status"], output: "Document Status Report", connectsTo: "Engineering, Dashboard", ai: "AI Document Review",
            links: [
              { to: "d12-p1-s1", label: { fa: "منشأ مدرک: فهرست اصلی (MDR) در d12", en: "Source: Master Document Register in d12" } }
            ] },
        ],
      },
      {
        id: "d1-p2",
        title: { fa: "کنترل نسخه و گردش", en: "Revision & Circulation" },
        subs: [
          { id: "d1-p2-s1", title: { fa: "کنترل نسخه (Revision)", en: "Revision Control" }, activity: { fa: "کنترل نسخه‌ها", en: "Version control" }, source: "EDMS", sql: ["Document_Revision"], output: "Revision History", connectsTo: "Change Management", ai: "AI Compare Revision",
            links: [
              { to: "d12-p2-s1", label: { fa: "منشأ نسخه: تأیید کد ۴ در d12", en: "Source: Code 4 approval in d12" } }
            ] },
        ],
      },
      {
        id: "d1-p3",
        title: { fa: "مکاتبات", en: "Correspondence" },
        subs: [
          { id: "d1-p3-s1", title: { fa: "مدیریت مکاتبات", en: "Correspondence Management" }, activity: { fa: "ثبت نامه‌ها", en: "Letter registry" }, source: "Outlook, Excel", sql: ["Correspondence_Master", "Action_Register"], output: "Correspondence Report", connectsTo: "Communication Module", ai: "AI Summarization" },
        ],
      },
      {
        id: "d1-p4",
        title: { fa: "Transmittal", en: "Transmittal" },
        subs: [
          { id: "d1-p4-s1", title: { fa: "ارسال مدارک", en: "Document Transmit" }, activity: { fa: "کنترل ارسال و دریافت", en: "In/out control" }, source: "EDMS", sql: ["Transmittal_Register"], output: "Transmittal Status", connectsTo: "EDMS", ai: "AI Delay Detection",
            links: [
              { to: "d12-p5-s1", label: { fa: "منشأ ارسال: کدگذاری مدرک سازنده در d12", en: "Source: vendor document coding in d12" } }
            ] },
        ],
      },
      {
        id: "d1-p5",
        title: { fa: "مدیریت دانش", en: "Knowledge Management" },
        subs: [
          { id: "d1-p5-s1", title: { fa: "درس‌آموخته‌ها", en: "Lessons Learned" }, activity: { fa: "ثبت تجربه", en: "Experience capture" }, source: "User Entry", sql: ["Knowledge_Base"], output: "Knowledge Report", connectsTo: "PMO Database", ai: "AI Knowledge Search",
            links: [
              { to: "d11-p5-s1", label: { fa: "ثبت در بانکِ دانش و درس‌آموخته (d11)", en: "Register in the lessons-learned bank (d11)" } }
            ] },
        ],
      },
    ],
  },
  {
    id: "d2",
    group: "pg2",
    icon: "🧭",
    accent: "#8FE3C8",
    title: { fa: "مدیریت برنامه‌ریزی و اجرای عملیات پروژه", en: "Planning & Execution" },
    processes: [
      {
        id: "d2-p2",
        title: { fa: "مدیریت برنامه زمان‌بندی", en: "Schedule Management" },
        subs: [
          /* قرارداد و ساختار شکست پیش از برنامه پایه می‌آید: برنامه از
           * دل همین ساختار ساخته می‌شود، پس ترتیب سایدبار باید همان
           * ترتیب کار باشد. */
          { id: "d2-p2-ws", title: { fa: "قرارداد و ساختار شکست", en: "Contract & Breakdown" }, activity: { fa: "بارگذاری قرارداد، استخراج ساختار و وزن‌دهی", en: "Contract intake, extraction and weighting" }, source: "PDF / DOCX", sql: ["CtrDocument", "BreakdownNode"], output: "WBS / CBS / WPA / PMS", connectsTo: "Schedule Engine", ai: "AI WBS Extraction" },
          { id: "d2-p2-s1", title: { fa: "برنامه پایه (Baseline)", en: "Baseline Schedule" }, activity: { fa: "برنامه پایه", en: "Baseline plan" }, source: "Primavera P6", sql: ["Schedule_Master", "Schedule_Activity"], output: "Baseline Report", connectsTo: "Primavera Integration", ai: "AI Schedule Optimization" },
        ],
      },
      {
        id: "d2-p4",
        title: { fa: "برنامه‌ریزی روزانه", en: "Daily Planning" },
        subs: [
          { id: "d2-p4-s1", title: { fa: "گزارش روزانه و ثبت پیشرفت واقعی", en: "Daily Report & Actual Progress" }, activity: { fa: "فعالیت روزانه و پیشرفت واقعی", en: "Daily activities & actual progress" }, source: "Mobile, Excel, Field Data", sql: ["Daily_Report", "Progress_Transaction"], output: "DPR / Progress Curve", connectsTo: "Weekly Report, KPI Dashboard", ai: "AI Auto Report + AI Progress Prediction" },
        ],
      },
      {
        id: "d2-p5",
        title: { fa: "برنامه‌ریزی هفتگی", en: "Weekly Planning" },
        subs: [
          { id: "d2-p5-s1", title: { fa: "گزارش هفتگی", en: "Weekly Report" }, activity: { fa: "تحلیل هفته", en: "Weekly analysis" }, source: "Daily_Report", sql: ["Weekly_Report"], output: "Weekly Report", connectsTo: "Management Dashboard", ai: "AI Weekly Analysis" },
        ],
      },
      {
        id: "d2-p6",
        title: { fa: "برنامه‌ریزی ماهانه", en: "Monthly Planning" },
        subs: [
          { id: "d2-p6-s1", title: { fa: "گزارش ماهانه (MPR)", en: "Monthly Progress Report" }, activity: { fa: "MPR", en: "MPR" }, source: "KPI, Cost, Schedule", sql: ["Monthly_Report"], output: "MPR", connectsTo: "Executive Dashboard", ai: "AI Executive Summary" },
        ],
      },
    ],
  },
  {
    id: "d12",
    group: "pg2",
    icon: "📐",
    accent: "#A78BFA",
    title: { fa: "مدیریت مهندسی و طراحی", en: "Engineering & Design Management" },
    processes: [
      {
        id: "d12-p1",
        title: { fa: "فهرست و برنامه‌ریزی مدارک", en: "MDR Planning" },
        subs: [
          { id: "d12-p1-s1", title: { fa: "تدوین فهرست اصلی مدارک", en: "Master Document Register" }, activity: { fa: "ثبت مدارک به تفکیک دیسیپلین و نوع، با وزن برنامه‌ای و نفرساعت برآوردی", en: "Register deliverables by discipline and type with planned weight and manhours" }, source: "Contract Scope, Discipline Leads", sql: ["MdrDeliverable"], output: "MDR Status Matrix", connectsTo: "Planning, Documents", ai: "AI Weight Advisor",
            links: [
              { to: "d1-p1-s1", label: { fa: "ثبت مدرک در EDMS (d1)", en: "Register document in EDMS (d1)" } }
            ] },
          { id: "d12-p1-s2", title: { fa: "تاریخ‌های هدف IFA و IFC", en: "Target IFA & IFC Dates" }, activity: { fa: "تعیین سررسید ارسال برای تأیید و صدور برای ساخت، هم‌راستا با گره WBS", en: "Set approval and construction issue targets aligned with WBS nodes" }, source: "Master Schedule", sql: ["MdrDeliverable", "WbsNode"], output: "Engineering Schedule", connectsTo: "Planning", ai: "AI Date Conflict Detector" },
        ],
      },
      {
        id: "d12-p2",
        title: { fa: "بررسی، کدگذاری و پاسخ نظرات", en: "Review & CRS" },
        subs: [
          { id: "d12-p2-s1", title: { fa: "چرخه کدهای بررسی ۱ تا ۴", en: "Review Codes 1-4" }, activity: { fa: "ثبت کد بررسی کارفرما و پایش مهلت قراردادی با محاسبه تأخیر", en: "Record client review code and track contractual deadline with aging" }, source: "Client, Consultant", sql: ["EngineeringRevision"], output: "Review Aging Report", connectsTo: "Claims, Documents", ai: "AI Review Delay Predictor",
            links: [
              { to: "d1-p2-s1", label: { fa: "پس از کد ۴ → صدور نسخه در d1", en: "After Code 4 → Issue revision in d1" } }
            ] },
          { id: "d12-p2-s2", title: { fa: "شیت ثبت و پاسخ نظرات", en: "Comment Resolution Sheet" }, activity: { fa: "ثبت نظر بازبین، پاسخ طراح و صحه‌گذاری ناظر در یک برگه یکپارچه", en: "Capture reviewer comment, designer response and supervisor verification" }, source: "Review Meetings", sql: ["CrsComment"], output: "CRS Report", connectsTo: "Quality, Documents", ai: "AI Comment Clusterer" },
        ],
      },
      {
        id: "d12-p3",
        title: { fa: "هماهنگی بین‌دیسیپلینی", en: "Inter-Discipline Coordination" },
        subs: [
          { id: "d12-p3-s1", title: { fa: "بررسی داخلی و Squad Check", en: "Internal Squad Check" }, activity: { fa: "گردش بررسی میان دیسیپلین‌ها پیش از ارسال بیرونی و ثبت اعتراض‌ها", en: "Route review across disciplines before external issue and log objections" }, source: "Discipline Leads", sql: ["SquadCheck"], output: "IDC Status Report", connectsTo: "Quality", ai: "AI Reviewer Assigner" },
          { id: "d12-p3-s2", title: { fa: "ثبت تداخل مدل سه‌بعدی", en: "3D Clash Log" }, activity: { fa: "ورود خروجی ابزار تشخیص تداخل و پیگیری رفع آن به تفکیک جفت دیسیپلین", en: "Import clash detection output and track resolution by discipline pair" }, source: "Navisworks, Solibri", sql: ["InterfaceClashLog"], output: "Clash Report", connectsTo: "Planning, Quality", ai: "AI Clash Prioritizer" },
        ],
      },
      {
        id: "d12-p4",
        title: { fa: "تغییرات کارگاهی و چون‌ساخت", en: "Field Changes & As-Built" },
        subs: [
          { id: "d12-p4-s1", title: { fa: "استعلام فنی و تغییر کارگاهی", en: "TQ & Field Change Request" }, activity: { fa: "ثبت استعلام کارگاه و درخواست تغییر با تشخیص خودکار اثر مالی و زمانی", en: "Log site query and change request with automatic cost and time impact detection" }, source: "Site Engineering", sql: ["TechnicalQuery"], output: "TQ/FCR Register", connectsTo: "Claims, Cost", ai: "AI Impact Estimator" },
          { id: "d12-p4-s2", title: { fa: "نقشه قرمز و چون‌ساخت", en: "Red-Line & As-Built" }, activity: { fa: "ثبت اصلاحات قرمز کارگاه و پیگیری تبدیل به نقشه چون‌ساخت تأییدشده", en: "Record site red-line markups and track conversion to approved as-built" }, source: "Site, Resident Engineer", sql: ["TechnicalQuery", "EngineeringRevision"], output: "As-Built Status", connectsTo: "Documents, Commissioning", ai: "AI As-Built Gap Finder",
            links: [
              { to: "d1-p1-s1", label: { fa: "بایگانی نسخهٔ چون‌ساخت در EDMS (d1)", en: "Archive as-built revision in EDMS (d1)" } }
            ] },
        ],
      },
      {
        id: "d12-p5",
        title: { fa: "مدارک سازندگان", en: "Vendor Print Review" },
        subs: [
          { id: "d12-p5-s1", title: { fa: "بررسی و کدگذاری مدرک سازنده", en: "Vendor Document Review" }, activity: { fa: "دریافت مدرک فنی سازنده، نگاشت به سفارش خرید و صدور کد بررسی", en: "Receive vendor document, map to purchase order and issue review code" }, source: "Vendors, Procurement", sql: ["VendorPrintReview"], output: "VPR Register", connectsTo: "Cost, Quality", ai: "AI Vendor Doc Classifier",
            links: [
              { to: "d1-p4-s1", label: { fa: "گردش مدرک سازنده با ترانسمیتال (d1)", en: "Circulate vendor document via transmittal (d1)" } }
            ] },
        ],
      },
      {
        id: "d12-p6",
        title: { fa: "پیشرفت و شاخص‌های مهندسی", en: "Engineering Progress & KPIs" },
        subs: [
          { id: "d12-p6-s1", title: { fa: "پیشرفت پله‌ای مبتنی بر شاهد", en: "Evidence-Based Rule of Credit" }, activity: { fa: "محاسبه پیشرفت از شش پله مصوب؛ پله بدون شاهد در مخزن باز نمی‌شود", en: "Derive progress from six approved steps; a step without evidence stays locked" }, source: "Revisions, Document Repository", sql: ["EngineeringRevision", "EngineeringProgressSnapshot"], output: "Engineering S-Curve", connectsTo: "Monitoring, Planning", ai: "AI Progress Validator" },
          { id: "d12-p6-s2", title: { fa: "شاخص‌ها و هشدار زودهنگام", en: "KPIs & Early Warning" }, activity: { fa: "شش شاخص مهندسی و پنج قاعده هشدار شامل قفل ساخت تا صدور نقشه IFC", en: "Six engineering KPIs and five alert rules including construction lock until IFC" }, source: "Engine Computation", sql: ["EngineeringProgressSnapshot", "Activity"], output: "Engineering Dashboard", connectsTo: "Monitoring, Planning", ai: "AI Early Warning Engine" },
        ],
      },
    ],
  },
  {
    id: "d5",
    group: "pg4",
    icon: "💠",
    accent: "#C9A7FF",


























































    title: { fa: "مدیریت هزینه، تأمین و لجستیک پروژه", en: "Cost, Procurement & Logistics" },
    processes: [








































































































































      {
        id: "d5-p1",
        title: { fa: "مدیریت هزینه", en: "Cost Management" },
        subs: [
          { id: "d5-p1-s1", title: { fa: "کنترل بودجه", en: "Budget Control" }, activity: { fa: "بودجه پروژه", en: "Project budget" }, source: "ERP, Excel", sql: ["Project_Budget"], output: "Budget Report", connectsTo: "Finance Dashboard", ai: "AI Cost Forecast" },
        ],
      },
      {
        id: "d5-p2",
        title: { fa: "کنترل هزینه", en: "Cost Control" },
        subs: [
          { id: "d5-p2-s1", title: { fa: "هزینه واقعی", en: "Actual Cost" }, activity: { fa: "ثبت هزینه واقعی", en: "Actual cost entry" }, source: "ERP, SAP", sql: ["Cost_Transaction"], output: "Cost Report", connectsTo: "EVM", ai: "AI Cost Prediction" },
        ],
      },
      {
        id: "d5-p3",
        title: { fa: "جریان نقدینگی", en: "Cash Flow" },
        subs: [
          { id: "d5-p3-s1", title: { fa: "دریافت و پرداخت", en: "Receipt & Payment" }, activity: { fa: "دریافت و پرداخت", en: "In / out" }, source: "Finance System", sql: ["Cash_Flow"], output: "Cash Flow Report", connectsTo: "Executive Dashboard", ai: "AI Cash Forecast" },
        ],
      },
      {
        id: "d5-p4",
        title: { fa: "درخواست خرید", en: "Purchase Request" },
        subs: [
          { id: "d5-p4-s1", title: { fa: "مدیریت PR", en: "PR Management" }, activity: { fa: "درخواست خرید", en: "Purchase requisition" }, source: "ERP", sql: ["Purchase_Request"], output: "PR Status", connectsTo: "Procurement", ai: "AI Procurement Analysis" },
        ],
      },
      {
        id: "d5-p5",
        title: { fa: "سفارش خرید", en: "Purchase Order" },
        subs: [
          { id: "d5-p5-s1", title: { fa: "مدیریت PO", en: "PO Management" }, activity: { fa: "سفارش خرید", en: "Purchase order" }, source: "ERP", sql: ["Purchase_Order"], output: "PO Status", connectsTo: "Supply Chain", ai: "AI Vendor Risk" },
        ],
      },
      {
        id: "d5-p6",
        title: { fa: "مدیریت کالا و انبار", en: "Material & Warehouse" },
        subs: [
          { id: "d5-p6-s1", title: { fa: "کنترل موجودی", en: "Inventory Control" }, activity: { fa: "کنترل موجودی", en: "Stock control" }, source: "Warehouse", sql: ["Material_Register"], output: "Material Status", connectsTo: "Logistics", ai: "AI Shortage Prediction" },
        ],
      },
      {
        id: "d5-p7",
        title: { fa: "مدیریت احجام و مقادیر فیزیکی", en: "Quantity & Physical Progress" },
        subs: [
          { id: "d5-p7-s1", title: { fa: "فهرست بها و اقلام احجامی", en: "BOQ & Measured Items" }, activity: { fa: "نگهداری ردیف‌های فهرست بها با مقدار کل، مقدار برنامه‌ای تجمعی و نرخ واحد برای ارزش‌گذاری پیشرفت فیزیکی", en: "Maintain BOQ rows with total qty, cumulative planned qty and unit rate for physical progress valuation" }, source: "Contract BOQ, Engineering MTO", sql: ["Boq_Item", "Boq_Measurement"], output: "Quantity Variance Report", connectsTo: "Planning, Contracts", ai: "AI Quantity Forecaster",
            links: [
              { to: "d14-p1-s1", label: { fa: "فهرست بها و نرخ‌های قرارداد در d14", en: "Contract BOQ and rates in d14" } }
            ] },
          { id: "d5-p7-s2", title: { fa: "برداشت و صورت‌برداری دوره‌ای", en: "Periodic Measurement" }, activity: { fa: "ثبت برداشت ماهانه به تفکیک دوره و ردیف و مقایسه با برنامه تا تاریخ داده", en: "Record periodic measurements per row and compare with plan to data date" }, source: "Site Survey, DPR", sql: ["Boq_Measurement", "Measurement_Approval"], output: "Measurement Certificate", connectsTo: "Contracts, Monitoring", ai: "AI Measurement Auditor",
            links: [
              { to: "d14-p2-s1", label: { fa: "تبدیلِ برداشت به ریزمتره و صورت‌وضعیت (d14)", en: "Convert measurement to IPC in d14" } }
            ] },
        ],
      },
      {
        id: "d5-p8",
        title: { fa: "بالانس مصالح و کنترل ضایعات", en: "Material Balance & Waste" },
        subs: [
          { id: "d5-p8-s1", title: { fa: "تراز مقداری مصالح", en: "Material Balance" }, activity: { fa: "محاسبه ماندهٔ هر قلم: ابتدای دوره + دریافت − مصرف + برگشتی، با ردیابی انحراف از نرم", en: "Compute closing per item: opening + receipts − issues + returns, tracking variance vs norm" }, source: "Warehouse Ledger, GRN", sql: ["Material_Ledger", "Material_Issue"], output: "Material Balance Sheet", connectsTo: "Warehouse, Cost", ai: "AI Balance Anomaly Detector" },
          { id: "d5-p8-s2", title: { fa: "نرم مصرف و تحلیل ضایعات", en: "Consumption Norm & Waste" }, activity: { fa: "مقایسه مصرف واقعی با نرم×تولید و تفکیک ضایعات قابل‌قبول از انحراف غیرعادی", en: "Compare actual use with norm × production and separate acceptable waste from abnormal variance" }, source: "Norms Library, Production Log", sql: ["Material_Norm", "Production_Log"], output: "Waste & Variance Report", connectsTo: "Quality, Cost", ai: "AI Waste Root-Cause" },
        ],
      },
      {
        id: "d5-p9",
        title: { fa: "سود و زیان پروژه", en: "Project Profit & Loss" },
        subs: [
          { id: "d5-p9-s1", title: { fa: "صورت سود و زیان", en: "P&L Statement" }, activity: { fa: "درآمدِ شناسایی‌شده در برابر بهای تمام‌شده، با تفکیک سودِ تا امروز از سودِ انتهای کار", en: "Recognised revenue against cost of sales, separating to-date profit from at-complete profit" }, source: "Contracts IPC, Cost Ledger", sql: ["Ipc_Certificate", "Cost_Transaction"], output: "Project P&L", connectsTo: "Contracts, Governance", ai: "AI Margin Forecaster" },
          { id: "d5-p9-s2", title: { fa: "حاشیه، پیش‌دریافت و وصولی", en: "Margin, Advance & Receivable" }, activity: { fa: "محاسبهٔ حاشیهٔ تحقق‌یافته، قابلِ وصول پس از کسورات و پیش‌پرداخت، و هشدارِ پیش‌صورت‌وضعیت‌گیری", en: "Compute earned margin, net receivable after retention and advance, and over-billing warning" }, source: "Finance, Contract", sql: ["Ipc_Certificate", "Advance_Ledger", "Retention_Ledger"], output: "Margin & Receivable Report", connectsTo: "Cash, Governance", ai: "AI Overbilling Detector" },
        ],
      },
    ],
  },
  {
    /* ماژول منابع انسانی — پس از HSE و پیش از مدیریت سامانه (ADR-13 بازنگری‌شده).
       کد دامنه در src/services/workforce.ts → HRM_DOMAIN_ID متمرکز است (ADR-15). */
    id: "d10",
    group: "pg3",
    icon: "👷",
    accent: "#F59E0B",
    title: { fa: "مدیریت منابع انسانی و بهره‌وری نیروی کار", en: "Human Resources & Workforce Productivity" },
    processes: [
      {
        id: "d10-p1",
        title: { fa: "برنامه‌ریزی نیرو، OBS و تجهیز", en: "Workforce Planning, OBS & Mobilization" },
        subs: [
          { id: "d10-p1-s1", title: { fa: "ساختار شکست سازمانی و ماتریس مسئولیت", en: "OBS & Responsibility Matrix" }, activity: { fa: "تعریف سازمان شش‌سطحی و پیوند آن به WBS", en: "Define six-level org and link to WBS" }, source: "PMO, Site Org Chart", sql: ["hrm_obs_node", "hrm_crew"], output: "OBS & RAM Report", connectsTo: "Planning, Governance", ai: "AI Span-of-Control Advisor" },
          { id: "d10-p1-s2", title: { fa: "برنامه نیرو و هیستوگرام", en: "Manpower Plan & Histogram" }, activity: { fa: "تبدیل نفر-ساعت برنامه به نفرات دوره‌ای و ترازسازی", en: "Convert planned man-hours to periodic headcount and level" }, source: "Primavera, Excel", sql: ["hrm_manpower_plan", "hrm_manpower_plan_line"], output: "Manpower Histogram", connectsTo: "Planning, Cost", ai: "AI Resource Leveling" },
          { id: "d10-p1-s3", title: { fa: "درخواست تجهیز و تخلیه نیرو", en: "Mobilization & Demobilization" }, activity: { fa: "گردش درخواست نیرو با پنج گیت انطباق", en: "Request workflow with five compliance gates" }, source: "Site Request", sql: ["hrm_mobilization_request"], output: "Mobilization Status", connectsTo: "HSE, Procurement", ai: "AI Demand Forecast" },
        ],
      },
      {
        id: "d10-p2",
        title: { fa: "تایم‌شیت و حضور و غیاب", en: "Timesheet & Attendance" },
        subs: [
          { id: "d10-p2-s1", title: { fa: "ثبت کارکرد و تفکیک ساعت", en: "Timesheet Entry & Hours Split" }, activity: { fa: "ثبت میدانی ساعت و تفکیک عادی، اضافه‌کاری، شب و تعطیل", en: "Field capture and split into normal, overtime, night and holiday" }, source: "Mobile PWA, Excel", sql: ["hrm_timesheet_header", "hrm_timesheet_entry", "hrm_leave_log"], output: "Approved Timesheet", connectsTo: "Cost, Planning", ai: "AI Anomaly Detection" },
        ],
      },
      {
        id: "d10-p3",
        title: { fa: "بهره‌وری و عملکرد نیرو", en: "Workforce Productivity & Performance" },
        subs: [
          { id: "d10-p3-s1", title: { fa: "شاخص بهره‌وری و ریشه‌یابی افت", en: "Productivity Index & Root Cause" }, activity: { fa: "محاسبه شاخص بهره‌وری از پیشرفت تأییدشده و ریشه‌یابی انحراف", en: "Compute PI from approved progress and analyse variance" }, source: "Timesheet, Progress", sql: ["hrm_productivity_log", "hrm_rca_reason"], output: "Productivity Report", connectsTo: "Planning, Claims", ai: "AI Productivity Forecast" },
        ],
      },
      {
        id: "d10-p4",
        title: { fa: "اکیپ و نیروی پیمانکاری", en: "Crews & Subcontracted Labor" },
        subs: [
          { id: "d10-p4-s1", title: { fa: "مدیریت اکیپ و صورت‌کارکرد پیمانکار", en: "Crew Management & Subcontractor Certificates" }, activity: { fa: "ترکیب اکیپ، حضور دست‌مزدی و کنترل صورت‌کارکرد", en: "Crew mix, daily-wage attendance and payment certificate control" }, source: "Site, Gate Pass", sql: ["hrm_crew", "hrm_sub_contract", "hrm_sub_attendance"], output: "Subcontractor Payment Certificate", connectsTo: "Cost, Contracts", ai: "AI Overbilling Detection" },
        ],
      },
      {
        id: "d10-p5",
        title: { fa: "پذیرش، احکام و انطباق", en: "Onboarding, Assignment & Compliance" },
        subs: [
          { id: "d10-p5-s1", title: { fa: "پرونده پرسنلی و پایش مدارک", en: "Personnel File & Document Watch" }, activity: { fa: "پذیرش نیرو، صدور حکم و پایش انقضای مدارک و صلاحیت", en: "Onboard, assign and monitor document and competency expiry" }, source: "HR, HSE, Medical", sql: ["hrm_person", "hrm_assignment", "hrm_document", "hrm_skill_matrix"], output: "Compliance Dashboard", connectsTo: "HSE, Governance", ai: "AI Expiry Predictor" },
        ],
      },
      {
        id: "d10-p6",
        title: { fa: "تحلیل، هیستوگرام و گزارش", en: "Analytics, Histogram & Reporting" },
        subs: [
          { id: "d10-p6-s1", title: { fa: "شاخص‌های کلیدی و هشدار زودهنگام", en: "KPIs & Early Warning" }, activity: { fa: "شش شاخص کلیدی نیرو و چهار قاعده هشدار زودهنگام", en: "Six workforce KPIs and four early-warning rules" }, source: "Timesheet, Plan", sql: ["hrm_metric_snapshot", "hrm_alert_rule", "hrm_alert"], output: "Workforce KPI Report", connectsTo: "Dashboard, Cost", ai: "AI Trend Analysis" },
        ],
      },
    ],
  },
  {
    /* ماژول ماشین‌آلات و تجهیزات — ناوگان، ساعت کارکرد، اجاره، تعمیرات و بهره‌وری.
       کد دامنه در src/services/equipment.ts → EQM_DOMAIN_ID متمرکز است (ADR-02). */
    id: "d9",
    group: "pg3",
    icon: "🚜",
    accent: "#38BDF8",
    title: { fa: "مدیریت ماشین‌آلات و تجهیزات", en: "Machinery & Equipment Management" },
    processes: [
      {
        id: "d9-p1",
        title: { fa: "ناوگان و ثبت ماشین‌آلات", en: "Fleet Registry" },
        subs: [
          { id: "d9-p1-s1", title: { fa: "ثبت ناوگان و مشخصات فنی", en: "Equipment Registry & Specs" }, activity: { fa: "ثبت ماشین، مالکیت، ظرفیت و سال ساخت با اعتبارسنجی دسته‌بندی", en: "Register machine, ownership, capacity and year with category validation" }, source: "Site, Procurement", sql: ["Equipment"], output: "Fleet Inventory Report", connectsTo: "Finance, HRM", ai: "AI Replacement Advisor" },
          { id: "d9-p1-s2", title: { fa: "تاکسونومی ISO 14224 و شناسه اسکن", en: "ISO 14224 Taxonomy & Scan ID" }, activity: { fa: "کدگذاری استاندارد دارایی و تولید شناسه یکتای اسکن برای هر ماشین", en: "Standard asset taxonomy coding and unique scan identifier per machine" }, source: "OEM Catalog, ISO 14224", sql: ["Equipment"], output: "Equipment ID Card", connectsTo: "Documents, HSE", ai: "AI Taxonomy Mapper" },
        ],
      },
      {
        id: "d9-p6",
        title: { fa: "دیسپچ روزانه", en: "Daily Dispatch" },
        subs: [
          { id: "d9-p6-s1", title: { fa: "برگه دیسپچ و دروازه‌های پیش‌نیاز", en: "Dispatch Sheet & Precondition Gates" }, activity: { fa: "تخصیص ماشین و اپراتور به فعالیت با کنترل وضعیت، سرویس، گواهی‌نامه و ایمنی", en: "Assign machine and operator to activity with status, PM, licence and safety gates" }, source: "Site Supervisor", sql: ["EquipmentDispatch"], output: "Daily Dispatch Sheet", connectsTo: "Planning, HRM, HSE", ai: "AI Dispatch Optimizer" },
        ],
      },
      {
        id: "d9-p2",
        title: { fa: "ساعت کارکرد", en: "Working Hours" },
        subs: [
          { id: "d9-p2-s1", title: { fa: "قرائت ساعت‌شمار و بهره‌برداری", en: "Meter Reading & Utilization" }, activity: { fa: "ثبت صعودی ساعت‌شمار و محاسبه بهره‌برداری از کارکرد دوره", en: "Monotonic meter reading and utilization from period hours" }, source: "Manual, Telemetry", sql: ["EquipmentMeter"], output: "Utilization Report", connectsTo: "Planning, Cost", ai: "AI Idle Detection" },
        ],
      },
      {
        id: "d9-p7",
        title: { fa: "سوخت و مواد مصرفی", en: "Fuel & Consumables" },
        subs: [
          { id: "d9-p7-s1", title: { fa: "دفتر مصرف و شاخص مصرف ویژه", en: "Consumption Log & Specific Fuel Consumption" }, activity: { fa: "ثبت گازوئیل، روغن، گریس و لاستیک و محاسبه لیتر بر ساعت کارکرد", en: "Log diesel, oil, grease and tires; compute litres per work hour" }, source: "Fuel Store", sql: ["EquipmentFuelLog"], output: "Fuel Consumption Report", connectsTo: "Finance, Dashboard", ai: "AI Fuel Anomaly Detection" },
        ],
      },
      {
        id: "d9-p3",
        title: { fa: "اجاره", en: "Rental" },
        subs: [
          { id: "d9-p3-s1", title: { fa: "قرارداد اجاره و هزینه تعهدی", en: "Rental Contracts & Accruals" }, activity: { fa: "ثبت نرخ و دوره و محاسبه هزینه تعهدی تا امروز", en: "Rate, term and accrued cost to date" }, source: "Contracts, Excel", sql: ["EquipmentRental"], output: "Rental Accrual Report", connectsTo: "Finance, Contracts", ai: "AI Rate Benchmark" },
        ],
      },
      {
        id: "d9-p4",
        title: { fa: "تعمیرات", en: "Maintenance" },
        subs: [
          { id: "d9-p4-s1", title: { fa: "دستورکار تعمیر و قابلیت اطمینان", en: "Work Orders & Reliability" }, activity: { fa: "ثبت توقف، هزینه و پیشبرد وضعیت؛ محاسبه MTBF/MTTR و بک‌لاگ", en: "Downtime, cost, status flow; MTBF/MTTR and backlog" }, source: "Site, CMMS", sql: ["MaintenanceOrder"], output: "Reliability Report", connectsTo: "HSE, Cost", ai: "AI Failure Predictor" },
          { id: "d9-p4-s2", title: { fa: "نگهداری پیشگیرانه چهارپایه", en: "Four-Basis Preventive Maintenance" }, activity: { fa: "سررسید سرویس بر پایه ساعت کارکرد، کیلومتر، روز تقویمی یا سیکل و پایش انطباق", en: "Service due on run hours, kilometers, calendar days or cycles with compliance tracking" }, source: "OEM Manual", sql: ["PmSchedule"], output: "PM Schedule & Compliance", connectsTo: "Dispatch, Cost", ai: "AI Interval Tuner" },
          { id: "d9-p4-s3", title: { fa: "تحلیل ریشه‌ای خرابی (ISO 14224)", en: "Failure Root-Cause Analysis (ISO 14224)" }, activity: { fa: "طبقه‌بندی علل خرابی و توزیع پارتو برای کاهش توقف", en: "Classify failure causes and build a Pareto distribution to cut downtime" }, source: "Maintenance Team", sql: ["MaintenanceOrder"], output: "RCA Pareto Report", connectsTo: "Risk, Quality", ai: "AI Cause Classifier" },
        ],
      },
      {
        id: "d9-p8",
        title: { fa: "انبار قطعات یدکی", en: "Spare Parts Inventory" },
        subs: [
          { id: "d9-p8-s1", title: { fa: "موجودی، نقطه سفارش و درخواست خرید", en: "Stock, Reorder Point & Requisition" }, activity: { fa: "پایش موجودی، محاسبه نقطه سفارش از مصرف و زمان تأمین و تولید پیش‌نویس درخواست خرید", en: "Track stock, compute ROP from usage and lead time, draft purchase requisitions" }, source: "Warehouse", sql: ["SparePart", "PartTransaction"], output: "Reorder & Requisition Report", connectsTo: "Finance, Procurement", ai: "AI Demand Forecast" },
        ],
      },
      {
        id: "d9-p5",
        title: { fa: "بهره‌وری و هشدار", en: "Productivity & EWS" },
        subs: [
          { id: "d9-p5-s1", title: { fa: "شاخص بهره‌وری و هشدار زودهنگام", en: "Productivity KPIs & Early Warning" }, activity: { fa: "بهره‌برداری، دسترس‌پذیری، هزینه/ساعت و هفت قاعده هشدار", en: "Utilization, availability, cost/hour and seven warning rules" }, source: "All EQM tables", sql: ["Equipment", "EquipmentMeter", "MaintenanceOrder"], output: "Fleet KPI & EWS", connectsTo: "Dashboard, Cost", ai: "AI Fleet Optimization" },
          { id: "d9-p5-s2", title: { fa: "تابلوی هشت شاخص و OEE", en: "Eight-KPI Board & OEE" }, activity: { fa: "دسترس‌پذیری، بهره‌برداری، OEE، MTBF، MTTR، نسبت هزینه نگهداری، انطباق PM و مصرف ویژه سوخت", en: "Availability, utilization, OEE, MTBF, MTTR, maintenance cost ratio, PM compliance and specific fuel consumption" }, source: "All EQP tables", sql: ["Equipment", "EquipmentMeter", "EquipmentFuelLog", "PmSchedule", "MaintenanceOrder"], output: "Fleet Performance Report", connectsTo: "Dashboard, Finance", ai: "AI Fleet Benchmark" },
          { id: "d9-p5-s3", title: { fa: "هزینه کل مالکیت و خرید در برابر اجاره", en: "TCO & Buy-vs-Rent" }, activity: { fa: "محاسبه هزینه کل مالکیت، هزینه ساعتی و نقطه سربه‌سر خرید در برابر اجاره", en: "Total cost of ownership, hourly cost and buy-versus-rent break-even" }, source: "Finance, Contracts", sql: ["Equipment", "EquipmentRental"], output: "TCO Analysis", connectsTo: "Finance, Governance", ai: "AI Investment Advisor" },
        ],
      },
    ],
  },
  {
    id: "d8",
    group: "pg4",
    icon: "🔬",
    accent: "#34D399",
    title: { fa: "مدیریت کیفیت و بازرسی", en: "Quality & Inspection Management" },
    processes: [
      {
        id: "d8-p1",
        title: { fa: "برنامه‌ریزی کیفیت و ITP", en: "Quality Planning & ITP" },
        subs: [
          { id: "d8-p1-s1", title: { fa: "برنامه کیفیت و نقاط بازرسی", en: "Quality Plan & Inspection Points" }, activity: { fa: "تدوین QMP و ITP با نقاط توقف و شاهد", en: "Author QMP and ITP with hold/witness points" }, source: "QMP, Specification, Code", sql: ["Quality_Plan", "ITP_Master", "ITP_Point"], output: "Approved ITP", connectsTo: "Engineering, Construction", ai: "AI ITP Generator" },
        ],
      },
      {
        id: "d8-p2",
        title: { fa: "بازرسی و آزمون", en: "Inspection & Testing" },
        subs: [
          { id: "d8-p2-s1", title: { fa: "درخواست بازرسی و نتیجه آزمون", en: "Inspection Request & Test Result" }, activity: { fa: "صدور IR، اجرای بازرسی و ثبت نتیجه", en: "Raise IR, inspect and record result" }, source: "Site, Lab, TPI", sql: ["Inspection_Request", "Inspection_Result", "Test_Report"], output: "Inspection Record", connectsTo: "Construction, Handover", ai: "AI Defect Classifier" },
        ],
      },
      {
        id: "d8-p3",
        title: { fa: "عدم انطباق و اقدام اصلاحی", en: "Non-Conformance & CAPA" },
        subs: [
          { id: "d8-p3-s1", title: { fa: "ثبت NCR و ریشه‌یابی", en: "NCR Registration & Root Cause" }, activity: { fa: "ثبت عدم انطباق، تعیین تکلیف و اقدام اصلاحی", en: "Log NCR, disposition and corrective action" }, source: "Inspection, Audit, Site", sql: ["NCR_Register", "CAPA_Action"], output: "NCR & CAPA Report", connectsTo: "Governance, Claims", ai: "AI Root Cause Advisor" },
        ],
      },
      {
        id: "d8-p4",
        title: { fa: "کنترل مواد و گواهی‌ها", en: "Material Control & Certificates" },
        subs: [
          { id: "d8-p4-s1", title: { fa: "گواهی مواد و ردیابی ذوب", en: "Material Certificate & Heat Traceability" }, activity: { fa: "کنترل MTC، انطباق گرید و ردیابی شماره ذوب", en: "Verify MTC, grade match and heat traceability" }, source: "Vendor, Lab, Warehouse", sql: ["Material_Certificate", "Heat_Trace_Link"], output: "Material Release Note", connectsTo: "Procurement, Warehouse", ai: "AI Certificate Reader" },
        ],
      },
      {
        id: "d8-p5",
        title: { fa: "ممیزی کیفیت و انطباق", en: "Quality Audit & Compliance" },
        subs: [
          { id: "d8-p5-s1", title: { fa: "ممیزی داخلی و انطباق ISO 9001", en: "Internal Audit & ISO 9001 Compliance" }, activity: { fa: "برنامه ممیزی، یافته‌ها و امتیاز انطباق", en: "Audit program, findings and compliance score" }, source: "ISO 9001, Procedures", sql: ["Quality_Audit", "Audit_Finding"], output: "Audit Report", connectsTo: "Governance, PMO", ai: "AI Compliance Analyzer" },
        ],
      },
      {
        id: "d8-p6",
        title: { fa: "تحویل، پانچ و راه‌اندازی", en: "Handover, Punch & Commissioning" },
        subs: [
          { id: "d8-p6-s1", title: { fa: "پانچ‌لیست و تحویل مکانیکی", en: "Punch List & Mechanical Completion" }, activity: { fa: "پانچ کلاس A/B، داکیومنت کیفیت و دروازه MC", en: "Class A/B punch, quality dossier and MC gate" }, source: "Site, Commissioning", sql: ["Punch_List", "Completion_Certificate", "Quality_Dossier"], output: "MC / RFC Certificate", connectsTo: "Client, Operations", ai: "AI Punch Prioritizer" },
        ],
      },
    ],
  },
  {
    id: "d16",
    group: "pg3",
    icon: "🦺",
    accent: "#DC2626",
    title: { fa: "مدیریت ایمنی، بهداشت و محیط‌زیست", en: "Health, Safety & Environment" },
    processes: [
      {
        id: "d16-p1",
        title: { fa: "برنامه‌ریزی و ارزیابی خطرات ایمنی", en: "HSE Planning & Risk Assessment" },
        subs: [
          { id: "d16-p1-s1", title: { fa: "ارزیابی ریسک شغلی و تفکیک گام‌های کار", en: "Job Safety Analysis & Job Steps" }, activity: { fa: "تفکیک هر فعالیت پرخطر به گام‌های کاری و شناسایی خطر هر گام با نمره احتمال در شدت", en: "Break each high-risk activity into job steps and score likelihood times severity per hazard" }, source: "Activity, JSA Templates", sql: ["HSE_RiskAssessment", "JSA_JobStep", "JSA_Hazard"], output: "Approved JSA", connectsTo: "Planning, Commissioning", ai: "AI Hazard Identifier" },
          { id: "d16-p1-s2", title: { fa: "سلسله‌مراتب کنترل خطر و ریسک باقیمانده", en: "Hierarchy of Controls & Residual Risk" }, activity: { fa: "اعمال پنج سطح کنترل از حذف تا تجهیزات حفاظت فردی و هشدار در اتکای صرف به حفاظت فردی برای خطر بالا", en: "Apply five control levels from elimination to PPE and warn when high risk relies on PPE alone" }, source: "JSA Hazards", sql: ["JSA_Control", "JSA_Hazard"], output: "Residual Risk Matrix", connectsTo: "Quality, Planning", ai: "AI Control Advisor" },
          { id: "d16-p1-s3", title: { fa: "جنبه‌ها و اثرات محیط‌زیستی", en: "Environmental Aspects & Impacts" }, activity: { fa: "ماتریس جنبه در اثر بر پایه ایزو ۱۴۰۰۱ با نمره اهمیت مشتق از شدت، احتمال، دامنه و الزام قانونی", en: "Aspect-impact matrix per ISO 14001 with significance derived from severity, likelihood, scope and legal duty" }, source: "Environmental Register", sql: ["EnvironmentalAspect", "AspectImpact"], output: "Significant Aspects", connectsTo: "Governance", ai: "AI Impact Assessor" },
        ],
      },
      {
        id: "d16-p2",
        title: { fa: "سامانه مجوزهای انجام کار", en: "Permit to Work Engine" },
        subs: [
          { id: "d16-p2-s1", title: { fa: "صدور و گردش هشت نوع پروانه کار", en: "Issue & Workflow of Eight Permit Types" }, activity: { fa: "صدور پروانه کار گرم، سرد، فضای بسته، ارتفاع، برقی، گودبرداری، بالابری و پرتوکاری با پیش‌نیاز ارزیابی ریسک مصوب", en: "Issue hot, cold, confined space, height, electrical, excavation, lifting and radiation permits gated on an approved JSA" }, source: "Field Request", sql: ["WorkPermit", "PTW_Precaution"], output: "Active Permit", connectsTo: "Planning, Commissioning", ai: "AI Permit Validator" },
          { id: "d16-p2-s2", title: { fa: "گازسنجی و ایزولاسیون انرژی", en: "Gas Testing & Energy Isolation" }, activity: { fa: "ثبت عددی گاز قابل اشتعال، اکسیژن، سولفید هیدروژن و مونوکسید کربن با ابطال خودکار پروانه در خروج از محدوده و ثبت قفل و برچسب", en: "Record LEL, oxygen, H2S and CO numerically with automatic permit suspension out of range, plus lock-out tag-out logging" }, source: "Gas Detector, LOTO", sql: ["GasTestLog", "IsolationLog"], output: "Safe to Work", connectsTo: "Equipment", ai: "AI Gas Trend Monitor" },
          { id: "d16-p2-s3", title: { fa: "امضای سه سطحی و اعتبارسنجی میدانی", en: "Three-Level Signature & Field Validation" }, activity: { fa: "امضای ترتیبی سرپرست اجرا، افسر ایمنی و مدیر منطقه به همراه کد پاسخ سریع برای اعتبارسنجی پروانه در کارگاه", en: "Sequential supervisor, HSE officer and area manager signatures with a QR token for on-site permit validation" }, source: "Digital Signature", sql: ["PTW_Approval", "WorkPermit"], output: "Validated Permit", connectsTo: "Documents", ai: "AI Signature Auditor" },
        ],
      },
      {
        id: "d16-p3",
        title: { fa: "مدیریت حوادث و شبه‌حوادث", en: "Incident & Near-Miss Management" },
        subs: [
          { id: "d16-p3-s1", title: { fa: "ثبت فوری حادثه و گزارش آنی", en: "Incident Capture & Flash Report" }, activity: { fa: "ثبت هشت طبقه از شبه‌حادثه تا فوت با گزارش آنی حداکثر پانزده دقیقه و فراخوان تیم واکنش اضطراری در موارد بحرانی", en: "Log eight categories from near-miss to fatality with a flash report within fifteen minutes and emergency team activation for critical cases" }, source: "Field Report, Mobile", sql: ["SafetyIncident", "InjuredPerson"], output: "Flash Incident Report", connectsTo: "Risk, Communications", ai: "AI Severity Classifier" },
          { id: "d16-p3-s2", title: { fa: "کمیته حقیقت‌یاب و تحلیل علت ریشه‌ای", en: "Investigation Committee & Root Cause Analysis" }, activity: { fa: "تحلیل پنج چرا به‌صورت درخت چندشاخه با تفکیک علل بی‌واسطه، زمینه‌ای و ریشه‌ای و محاسبه هزینه مستقیم و غیرمستقیم حادثه", en: "Multi-branch five-whys tree separating immediate, underlying and root causes with direct and indirect incident cost" }, source: "Committee Minutes", sql: ["HSE_Investigation", "RootCauseNode"], output: "Investigation Report", connectsTo: "Knowledge, Risk", ai: "AI Root Cause Assistant" },
          { id: "d16-p3-s3", title: { fa: "اقدامات اصلاحی و پیشگیرانه", en: "Corrective & Preventive Actions" }, activity: { fa: "تعریف اقدام با مسئول و مهلت؛ تحقیق تا نداشتن دست‌کم یک اقدام پیشگیرانه بسته نمی‌شود", en: "Define actions with owner and due date; an investigation cannot close without at least one preventive action" }, source: "CAPA Plan", sql: ["CapaAction", "HSE_Investigation"], output: "CAPA Register", connectsTo: "Quality, Governance", ai: "AI Action Tracker" },
        ],
      },
      {
        id: "d16-p4",
        title: { fa: "بازرسی، تخلفات و دستور توقف کار", en: "Inspection, Violations & Stop Work Order" },
        subs: [
          { id: "d16-p4-s1", title: { fa: "بازرسی میدانی و یافته‌ها", en: "Field Inspection & Findings" }, activity: { fa: "ثبت بازدید میدانی، جلسه ایمنی روزانه، ممیزی و مانور با یافته‌های قابل پیگیری و نمره بازرسی", en: "Record walkthroughs, toolbox talks, audits and drills with trackable findings and an inspection score" }, source: "Mobile Checklist", sql: ["SafetyInspection", "InspectionFinding"], output: "Inspection Report", connectsTo: "Quality", ai: "AI Checklist Generator" },
          { id: "d16-p4-s2", title: { fa: "دستور توقف کار و قفل فعالیت", en: "Stop Work Order & Activity Lock" }, activity: { fa: "صدور دستور توقف کار با موقعیت جغرافیایی و عکس؛ فعالیت زمان‌بندی قفل می‌شود نه حذف تا مبنای ادعای تمدید حفظ شود", en: "Issue a stop work order with GPS and photo; the schedule activity is locked rather than deleted so the EOT claim basis survives" }, source: "Field Observation", sql: ["HSE_Violation", "Activity"], output: "Stop Work Order", connectsTo: "Planning, Claims", ai: "AI Violation Detector" },
          { id: "d16-p4-s3", title: { fa: "رفع تخلف و بازرسی مجدد", en: "Violation Closure & Re-Inspection" }, activity: { fa: "آزادسازی توقف کار تنها با بازرسی مجدد و امضای مدیر ایمنی، نه سرپرست اجرایی که عامل تخلف بوده", en: "Release a stop work order only after re-inspection and HSE manager signature, never by the supervisor who caused it" }, source: "Re-Inspection", sql: ["ViolationClosure", "HSE_Violation"], output: "Closure Certificate", connectsTo: "Contracts", ai: "AI Closure Verifier" },
        ],
      },
      {
        id: "d16-p5",
        title: { fa: "آموزش، بهداشت و محیط‌زیست", en: "Training, Health & Environment" },
        subs: [
          { id: "d16-p5-s1", title: { fa: "آموزش ایمنی و اعتبار گواهی‌نامه", en: "Safety Training & Certificate Validity" }, activity: { fa: "ثبت آموزش ورودی، جلسه روزانه و دوره‌های تخصصی با کنترل انقضای گواهی؛ گیت آموزش منابع انسانی از این منبع خوانده می‌شود", en: "Record induction, toolbox and specialist courses with expiry control; the HR training gate reads from this source" }, source: "Training Session", sql: ["TrainingSession", "TrainingAttendee", "SafetyTrainingRecord"], output: "Training Matrix", connectsTo: "Human Resources", ai: "AI Training Planner" },
          { id: "d16-p5-s2", title: { fa: "پسماند، پساب و آلاینده‌ها", en: "Waste, Effluent & Emissions" }, activity: { fa: "ثبت پسماند خطرناک، غیرخطرناک و قابل بازیافت با شماره مانیفست حمل و پایش پساب و آلاینده در برابر حد مجاز", en: "Log hazardous, non-hazardous and recyclable waste with manifest numbers, and monitor effluent and emissions against limits" }, source: "Waste Manifest", sql: ["WasteLog", "EnvironmentalMonitoring"], output: "Environmental Log", connectsTo: "Governance, Cost", ai: "AI Compliance Checker" },
          { id: "d16-p5-s3", title: { fa: "طب کار و تجهیزات حفاظت فردی", en: "Occupational Health & PPE" }, activity: { fa: "معاینات بدو استخدام، دوره‌ای و خروج در برابر عوامل زیان‌آور و مدیریت تحویل و موجودی تجهیزات حفاظت فردی", en: "Pre-employment, periodic and exit examinations against occupational hazards, plus PPE issuance and stock control" }, source: "Medical Records", sql: ["HealthExamination", "OccupationalHazard", "PpeIssuance"], output: "Fitness Register", connectsTo: "Human Resources, Cost", ai: "AI Exposure Analyzer" },
        ],
      },
      {
        id: "d16-p6",
        title: { fa: "پایش، شاخص‌ها و هشدار زودهنگام", en: "HSE Analytics, KPIs & Early Warning" },
        subs: [
          { id: "d16-p6-s1", title: { fa: "نفرساعت ایمن و شاخص‌های حادثه", en: "Safe Man-Hours & Incident Rates" }, activity: { fa: "محاسبه نفرساعت از برگه ساعت‌کارکرد موجود و شاخص‌های حادثه؛ بدون نفرساعت شاخص تهی می‌ماند نه صفر", en: "Derive man-hours from existing timesheets and compute incident rates; without man-hours the metric stays null, never zero" }, source: "Timesheet, Incidents", sql: ["HSE_ManHourLog", "HSE_MetricSnapshot"], output: "LTIFR & TRIR", connectsTo: "Monitoring", ai: "AI Trend Forecaster" },
          { id: "d16-p6-s2", title: { fa: "شش شاخص ایمنی و پنج قاعده هشدار", en: "Six HSE KPIs & Five Alert Rules" }, activity: { fa: "پایش انطباق پروانه، ساعت آموزش سرانه و نرخ رفع تخلف با هشدار گازسنجی ناایمن، دستور توقف کار و پروانه منقضی", en: "Track permit compliance, training hours per worker and closure rate with alerts for unsafe gas readings, stop work orders and expired permits" }, source: "Engine Computation", sql: ["HSE_MetricSnapshot", "HSE_AlertRule"], output: "HSE Dashboard", connectsTo: "Monitoring, Governance", ai: "AI Early Warning Engine" },
          { id: "d16-p6-s3", title: { fa: "نمره ایمنی و تغذیه شاخص سلامت پروژه", en: "HSE Score & Project Health Feed" }, activity: { fa: "تولید نمره ایمنی و تزریق آن به شاخص سلامت ترکیبی پروژه به‌جای مقدار ثابت پیشین", en: "Produce the HSE score and feed it into the composite project health index, replacing the former fixed value" }, source: "Metric Snapshot", sql: ["HSE_MetricSnapshot", "KpiSnapshot"], output: "HSE Score", connectsTo: "Monitoring, Portfolio", ai: "AI Health Scorer" },
        ],
      },
    ],
  },
  {
    id: "d3",
    group: "pg4",
    icon: "📈",
    accent: "#FFD48A",
    title: { fa: "مدیریت پایش و کنترل عملکرد پروژه", en: "Performance Monitoring & Control" },
    processes: [
      {
        id: "d3-p1",
        title: { fa: "مدیریت KPI", en: "KPI Management" },
        subs: [
          { id: "d3-p1-s1", title: { fa: "شاخص‌های عملکرد", en: "Performance Indicators" }, activity: { fa: "محاسبه KPI", en: "KPI calculation" }, source: "تمام سیستم‌ها / All systems", sql: ["KPI_Master", "KPI_Value"], output: "KPI Dashboard", connectsTo: "Power BI", ai: "AI KPI Analysis" },
        ],
      },
      {
        id: "d3-p2",
        title: { fa: "ارزش کسب‌شده (EVM)", en: "Earned Value Management" },
        subs: [
          { id: "d3-p2-s1", title: { fa: "PV / EV / AC", en: "PV / EV / AC" }, activity: { fa: "محاسبه ارزش کسب‌شده", en: "EVM calculation" }, source: "Schedule + Cost", sql: ["EVM_Transaction"], output: "SPI / CPI / EAC", connectsTo: "Cost Control", ai: "AI Forecast" },
        ],
      },
      {
        id: "d3-p3",
        title: { fa: "تحلیل انحراف", en: "Variance Analysis" },
        subs: [
          { id: "d3-p3-s1", title: { fa: "انحراف برنامه/هزینه", en: "Schedule / Cost Variance" }, activity: { fa: "مقایسه برنامه و عملکرد", en: "Plan vs actual" }, source: "Baseline + Actual", sql: ["Variance_Log"], output: "Variance Report", connectsTo: "Risk Module", ai: "AI Root Cause" },
        ],
      },
      {
        id: "d3-p4",
        title: { fa: "هشدار زودهنگام", en: "Early Warning" },
        subs: [
          { id: "d3-p4-s1", title: { fa: "تشخیص مشکل", en: "Issue Detection" }, activity: { fa: "تشخیص هشدار", en: "Alert detection" }, source: "KPI Engine", sql: ["Alert_Register"], output: "Warning Report", connectsTo: "Executive Dashboard", ai: "AI Prediction" },
        ],
      },
      {
        id: "d3-p5",
        title: { fa: "برنامه کارگاهی / اکشن‌پلن", en: "Site Action Plan" },
        subs: [
          { id: "d3-p5-s1", title: { fa: "اکشن‌پلن ۱ / ۲ / ۳ ماهه", en: "1 / 2 / 3-Month Action Plan" }, activity: { fa: "برنامه کارگاهی سازمانی", en: "Organizational site plan" }, source: "Policy Engine + Schedule Output", sql: ["Action_Plan", "Action_Item"], output: "Lookahead Plan", connectsTo: "Management Report", ai: "AI Action Prioritizer" },
        ],
      },
      {
        id: "d3-p6",
        title: { fa: "گزارش مدیریتی", en: "Management Report" },
        subs: [
          { id: "d3-p6-s1", title: { fa: "گزارش مدیریتی زنده", en: "Live Management Report" }, activity: { fa: "ادغام KPI / EVM / انحراف / هشدار + اهم اکشن‌پلن", en: "Merge KPI / EVM / Variance / Alert + Action Plan highlights" }, source: "KPI, EVM, Variance, Alert, Action_Plan", sql: ["KPI_Value", "EVM_Transaction", "Variance_Log", "Alert_Register", "Action_Item"], output: "Live Executive Report", connectsTo: "CEO Dashboard", ai: "AI Executive Assistant" },
        ],
      },
    ],
  },
  {
    id: "d4",
    group: "pg4",
    icon: "⚠️",
    accent: "#FF9F9F",
    title: { fa: "مدیریت ریسک، تغییرات و ادعاها", en: "Risk, Change & Claims" },
    processes: [
      {
        id: "d4-p1",

        title: { fa: "ثبت و تحلیل ریسک (ادغام‌شده)", en: "Integrated Risk Registration & Analysis" },
        subs: [


















          {
            id: "d4-p1-s1",
            title: { fa: "ثبت و احتمال اثر ریسک", en: "Risk Registration & Probability/Impact" },
            activity: { fa: "ثبت جامع ریسک و تحلیل احتمال/اثر", en: "Unified risk entry & P&I analysis" },
            source: "Excel, User Entry",
            sql: ["Risk_Register", "Risk_Assessment"],
            output: "Risk Matrix & Score",
            connectsTo: "Management Dashboard",
            ai: "AI Risk Prediction"
          },
        ],
      },
      {


        id: "d4-p3",
        title: { fa: "مدیریت تغییرات", en: "Change Management" },
        subs: [

          { id: "d4-p3-s1", title: { fa: "درخواست تغییر", en: "Change Request" }, activity: { fa: "درخواست تغییر", en: "Change request" }, source: "Contract, Correspondence", sql: ["Change_Request"], output: "Change Report", connectsTo: "Contract System", ai: "AI Change Impact" },
        ],
      },











      {
        id: "d4-p4",
        title: { fa: "مدیریت تأخیرات", en: "Delay Management" },
        subs: [

          { id: "d4-p4-s1", title: { fa: "تحلیل تأخیر", en: "Delay Analysis" }, activity: { fa: "تحلیل تأخیر", en: "Delay analysis" }, source: "Primavera, Reports", sql: ["Delay_Register"], output: "Delay Report", connectsTo: "Claims Module", ai: "AI Delay Analysis" },
        ],
      },
      {


        id: "d4-p5",
        title: { fa: "مدیریت ادعاها", en: "Claims Management" },
        subs: [

          { id: "d4-p5-s1", title: { fa: "بسته ادعا", en: "Claim Package" }, activity: { fa: "تنظیم ادعا", en: "Claim preparation" }, source: "Contract Data", sql: ["Claim_Register"], output: "Claim Report", connectsTo: "Client Portal", ai: "AI Claim Review" },
        ],
      },






















































































































































































































































      {
        id: "d4-p6",
        title: { fa: "تحلیل سرمایه‌گذاری و ریسک مالی", en: "Investment & Financial Risk" },
        subs: [
          { id: "d4-p6-s1", title: { fa: "NPV/IRR و صرفِ ریسک", en: "NPV/IRR & Risk Premium" }, activity: { fa: "محاسبهٔ NPV و IRR و اعمالِ صرفِ ریسکِ برآمده از ثبت ریسک برای رسیدن به NPVِ تعدیل‌شده", en: "Compute NPV and IRR, then apply a risk premium derived from the risk register to reach risk-adjusted NPV" }, source: "Risk Register, Finance", sql: ["Risk_Register", "Cashflow_Plan"], output: "Risk-Adjusted NPV", connectsTo: "Cost, Governance", ai: "AI Risk Premium Calibrator" },
          { id: "d4-p6-s2", title: { fa: "سناریو، حساسیت و گیتِ تصمیم", en: "Scenarios, Sensitivity & Gate" }, activity: { fa: "تحلیلِ سه سناریو با احتمال، نمودارِ تورنادو روی محرک‌ها و صدورِ تصمیمِ گیت (تأیید/مشروط/عدم تأیید)", en: "Analyse three probability-weighted scenarios, tornado sensitivity on drivers and issue a gate decision" }, source: "Finance, PMO", sql: ["Scenario_Model", "Sensitivity_Run"], output: "Investment Gate Decision", connectsTo: "Governance, Portfolio", ai: "AI Decision Advisor" },
        ],
      },
    ],
  },
  {
    /* ماژول ارتباطات و دانش — مالک گردش مکاتبات، جلسات، ذی‌نفعان و درس‌آموخته.
       مالک فایل مدرک همچنان d1 است و ماتریس اختیار همچنان d6. */
    id: "d11",
    group: "support",
    icon: "📡",
    accent: "#A78BFA",
    title: { fa: "مدیریت ارتباطات و دانش", en: "Communications & Knowledge Management" },
    processes: [
      {
        id: "d11-p1",
        title: { fa: "مکاتبات و اعلان قراردادی", en: "Correspondence & Contractual Notices" },
        subs: [
          { id: "d11-p1-s1", title: { fa: "دفتر مکاتبات و مهلت پاسخ", en: "Correspondence Register & Response Deadline" }, activity: { fa: "ثبت نامه وارده و صادره با مهلت پاسخ بر پایه روز کاری", en: "Register letters with working-day response deadlines" }, source: "Outlook, Secretariat, Upload", sql: ["ckm_letter", "ckm_letter_link"], output: "Correspondence & Overdue Report", connectsTo: "Documents, Claims", ai: "AI Letter Summarization" },
          { id: "d11-p1-s2", title: { fa: "اعلان قراردادی و پایش Time-Bar", en: "Contractual Notice & Time-Bar Watch" }, activity: { fa: "پایش مهلت اعلان ادعا و هشدار پیش از سقوط حق", en: "Track notice windows and warn before the right lapses" }, source: "Contract, Claim Register", sql: ["ckm_letter", "ckm_notice_watch"], output: "Time-Bar Status", connectsTo: "Risk & Claims", ai: "AI Notice Drafter" },
        ],
      },
      {
        id: "d11-p2",
        title: { fa: "جلسات و مصوبات", en: "Meetings & Action Register" },
        subs: [
          { id: "d11-p2-s1", title: { fa: "صورت‌جلسه و پیگیری مصوبات", en: "Minutes & Action Follow-up" }, activity: { fa: "ثبت صورت‌جلسه، تصویب، توزیع و پیگیری مصوبات دارای مالک و موعد", en: "Record, approve, distribute minutes and track owned actions" }, source: "Meeting, User Entry", sql: ["ckm_meeting", "ckm_action_item"], output: "Minutes & Action Status", connectsTo: "Governance, Planning", ai: "AI Minutes Generator" },
        ],
      },
      {
        id: "d11-p3",
        title: { fa: "ذی‌نفعان و برنامه ارتباطات", en: "Stakeholders & Communication Plan" },
        subs: [
          { id: "d11-p3-s1", title: { fa: "ثبت ذی‌نفعان و شبکه قدرت-علاقه", en: "Stakeholder Register & Power-Interest Grid" }, activity: { fa: "تحلیل قدرت و علاقه و سنجش شکاف سطح تعامل", en: "Assess power, interest and engagement gap" }, source: "PMO, Interviews", sql: ["ckm_stakeholder", "ckm_engagement_log"], output: "Stakeholder Engagement Report", connectsTo: "Governance", ai: "AI Engagement Advisor" },
          { id: "d11-p3-s2", title: { fa: "ماتریس ارتباطات و ابلاغ", en: "Communication & Distribution Matrix" }, activity: { fa: "تعیین کانال، تناوب و مالک ارتباط با هر ذی‌نفع", en: "Define channel, cadence and owner per stakeholder" }, source: "Comms Plan", sql: ["ckm_comm_matrix"], output: "Communication Matrix", connectsTo: "All Modules", ai: "AI Channel Optimizer" },
        ],
      },
      {
        id: "d11-p4",
        title: { fa: "اطلاع‌رسانی و تشدید", en: "Notification & Escalation" },
        subs: [
          { id: "d11-p4-s1", title: { fa: "قواعد اعلان و سطوح تشدید", en: "Notification Rules & Escalation Levels" }, activity: { fa: "تعریف رویداد، کانال، مخاطب و زمان تشدید", en: "Define event, channel, audience and escalation timing" }, source: "System Events", sql: ["ckm_notification_rule", "ckm_notification_log"], output: "Escalation Log", connectsTo: "Alerts, Governance", ai: "AI Alert Deduplication" },
        ],
      },
      {
        id: "d11-p5",
        title: { fa: "دانش و درس‌آموخته", en: "Knowledge & Lessons Learned" },
        subs: [
          { id: "d11-p5-s1", title: { fa: "بانک درس‌آموخته و استفاده مجدد", en: "Lessons Register & Reuse Tracking" }, activity: { fa: "ثبت درس با منشأ الزامی، تأیید شورای دانش و ردیابی استفاده مجدد", en: "Capture lessons with mandatory source, validate and track reuse" }, source: "NCR, Claim, Incident, Meeting", sql: ["ckm_lesson", "ckm_lesson_reuse"], output: "Knowledge Value Report", connectsTo: "Quality, Risk, HSE", ai: "AI Knowledge Recommender",
            links: [
              { to: "d1-p5-s1", label: { fa: "بایگانی و نسخه در EDMS (d1)", en: "Archive and revision in EDMS (d1)" } }
            ] },
        ],
      },
      {
        id: "d11-p6",
        title: { fa: "تحلیل و گزارش ارتباطات", en: "Communication Analytics & Reporting" },
        subs: [
          { id: "d11-p6-s1", title: { fa: "شاخص‌های ارتباطی و هشدار زودهنگام", en: "Communication KPIs & Early Warning" }, activity: { fa: "زمان پاسخ، نرخ بستن مصوبه، پوشش ارتباطات و نرخ استفاده از دانش", en: "Response time, action closure, comms coverage and knowledge utilization" }, source: "CKM Data", sql: ["ckm_metric_snapshot", "ckm_alert"], output: "Communication KPI Report", connectsTo: "Dashboard", ai: "AI Trend Analysis" },
        ],
      },
    ],
  },
  {
    id: "d15",
    group: "pg5",
    icon: "🏁",
    accent: "#F97316",
    title: { fa: "مدیریت راه‌اندازی، تحویل و اختتام نهایی", en: "Commissioning, Handover & Project Closure" },
    processes: [
      {
        id: "d15-p1",
        title: { fa: "تفکیک سیستمی و برنامه‌ریزی تحویل", en: "Systemization & Completion Planning" },
        subs: [
          { id: "d15-p1-s1", title: { fa: "درخت سیستم‌ها و زیرسیستم‌ها", en: "Systems & Subsystems Breakdown" }, activity: { fa: "تعریف ساختار درختی سیستم‌ها مستقل از WBS و نگاشت دوطرفه به بسته‌های کاری", en: "Define a system tree independent of the WBS with two-way mapping to work packages" }, source: "P&ID, WBS", sql: ["SystemSubsystem", "SystemBoundaryMapping"], output: "Systemization Matrix", connectsTo: "Planning, Engineering", ai: "AI System Boundary Advisor" },
          { id: "d15-p1-s2", title: { fa: "اولویت‌بندی و تاریخ‌های هدف تحویل", en: "Commissioning Priority & Target Dates" }, activity: { fa: "تعیین اولویت راه‌اندازی و تاریخ هدف چهار دروازه تکمیل مکانیکی، آمادگی راه‌اندازی، تحویل موقت و قطعی", en: "Set commissioning priority and target dates for the four completion gates" }, source: "Commissioning Plan", sql: ["SystemSubsystem"], output: "Completion Schedule", connectsTo: "Planning", ai: "AI Priority Optimizer" },
        ],
      },
      {
        id: "d15-p2",
        title: { fa: "پیش‌راه‌اندازی و آزمون‌های سرد", en: "Pre-Commissioning & Cold Testing" },
        subs: [
          { id: "d15-p2-s1", title: { fa: "بسته‌های آزمون و برگه‌های سرد", en: "Test Packs & A-Check Sheets" }, activity: { fa: "ثبت هیدروتست، فلاشینگ، لوپ چک ابزار دقیق و مگر تست برق به تفکیک دیسیپلین", en: "Record hydrotest, flushing, instrument loop check and megger test by discipline" }, source: "Field Test Records", sql: ["CheckRecordPack", "CheckSheet"], output: "Cold Test Clearance", connectsTo: "Quality", ai: "AI Test Pack Validator" },
          { id: "d15-p2-s2", title: { fa: "کنترل پیش‌نیاز ساخت و کیفیت", en: "Construction & Quality Prerequisites" }, activity: { fa: "کنترل تکمیل ساخت فیزیکی و بسته‌بودن عدم انطباق‌ها پیش از شروع آزمون سرد", en: "Verify physical completion and closed non-conformances before cold testing" }, source: "Activity, NCR", sql: ["Activity", "Ncr"], output: "Readiness Check", connectsTo: "Planning, Quality", ai: "AI Prerequisite Checker" },
        ],
      },
      {
        id: "d15-p3",
        title: { fa: "راه‌اندازی، تست گرم و آزمون عملکرد", en: "Commissioning, Hot Test & PGTR" },
        subs: [
          { id: "d15-p3-s1", title: { fa: "برگه‌های آزمون گرم", en: "B-Check Sheets & Hot Testing" }, activity: { fa: "ثبت آزمون‌های گرم پس از صدور گواهی تکمیل مکانیکی و کنترل مجوز کار گرم", en: "Record hot tests after mechanical completion and check hot work permits" }, source: "Commissioning Records", sql: ["CheckSheet"], output: "Hot Test Log", connectsTo: "HSE, Quality", ai: "AI Hot Test Monitor" },
          { id: "d15-p3-s2", title: { fa: "آزمون عملکرد ۷۲ ساعته", en: "Performance Guarantee Test Run" }, activity: { fa: "مقایسه مقادیر طراحی با مقادیر واقعی بهره‌برداری و اعتبارسنجی خودکار قبولی", en: "Compare design values with actual operating data and validate pass or fail" }, source: "Operating Data", sql: ["PerformanceTestRun", "PerformanceTestReading"], output: "PGTR Result Sheet", connectsTo: "Quality, Monitoring", ai: "AI Performance Analyzer" },
        ],
      },
      {
        id: "d15-p4",
        title: { fa: "گواهی‌های تحویل و دروازه‌های تکمیل", en: "Handover Certificates & Gate Locks" },
        subs: [
          { id: "d15-p4-s1", title: { fa: "صدور چهار گواهی تحویل", en: "MC, RFSU, PAC & FAC Certificates" }, activity: { fa: "گردش امضای سه سطحی پیمانکار، مشاور و کارفرما برای گواهی‌های زنجیره‌ای تحویل", en: "Three-level signature workflow across contractor, consultant and client" }, source: "Handover Committee", sql: ["CompletionCertificate"], output: "Signed Certificates", connectsTo: "Contracts, Finance", ai: "AI Certificate Drafter" },
          { id: "d15-p4-s2", title: { fa: "قفل کیفی دروازه‌ها و نواقص", en: "Quality Gate Locks & Punch List" }, activity: { fa: "نقص دسته الف مانع تکمیل مکانیکی، دسته ب مانع تحویل موقت و دسته ج مانع تحویل قطعی است", en: "Category A blocks mechanical completion, B blocks provisional and C blocks final acceptance" }, source: "Punch Inspection", sql: ["PunchListItem", "GateRule"], output: "Gate Lock Status", connectsTo: "Quality", ai: "AI Gate Advisor" },
        ],
      },
      {
        id: "d15-p5",
        title: { fa: "پرونده تحویل و اسناد بهره‌برداری", en: "Handover Dossier & O&M Documents" },
        subs: [
          { id: "d15-p5-s1", title: { fa: "تجمیع پرونده تحویل دیجیتال", en: "Digital Handover Dossier Index" }, activity: { fa: "فهرست‌کردن نقشه‌های چون‌ساخت، برگه‌های بازرسی و کتابچه‌های بهره‌برداری بدون کپی فایل", en: "Index as-built drawings, inspection sheets and O&M manuals without copying files" }, source: "Documents, Deliverables", sql: ["HandoverDossier", "DossierItem"], output: "Dossier Index", connectsTo: "Documents, Engineering", ai: "AI Dossier Assembler" },
          { id: "d15-p5-s2", title: { fa: "درصد آمادگی پرونده تحویل", en: "Dossier Readiness Percentage" }, activity: { fa: "محاسبه نسبت اقلام تأمین‌شده به اقلام الزامی و نمایش فهرست مدارک غایب", en: "Compute supplied versus required items and list the missing documents" }, source: "Engine Computation", sql: ["DossierItem"], output: "Readiness Report", connectsTo: "Documents", ai: "AI Gap Detector" },
        ],
      },
      {
        id: "d15-p6",
        title: { fa: "دوران تضمین، رفع عیوب و اختتام نهایی", en: "Defects Liability & Final Closure" },
        subs: [
          { id: "d15-p6-s1", title: { fa: "پایش دوران تضمین و ادعای گارانتی", en: "DLP Tracking & Warranty Claims" }, activity: { fa: "ثبت عیوب دوران تضمین، تعیین مسئولیت پیمانکار یا سازنده و صدور دستور کار تعمیر", en: "Log defects, assign liability to contractor or vendor and raise repair work orders" }, source: "Warranty Log", sql: ["WarrantyClaim", "MaintenanceOrder"], output: "DLP Register", connectsTo: "Equipment, Contracts", ai: "AI Defect Classifier" },
          { id: "d15-p6-s2", title: { fa: "آزادسازی سپرده و اختتام رسمی پروژه", en: "Retention Release & Project Closure" }, activity: { fa: "پیشنهاد آزادسازی پنجاه درصدی سپرده بر مبنای گواهی‌ها و ثبت درس‌آموخته‌های اختتام", en: "Propose staged retention release from certificates and capture closure lessons learned" }, source: "Certificates, Ledger", sql: ["ProjectClosureRecord", "RetainageLedger", "LessonLearned"], output: "Closure Record", connectsTo: "Finance, Knowledge", ai: "AI Closure Auditor" },
        ],
      },
    ],
  },
  {
    id: "d17",
    group: "field",
    icon: "⛑️",
    accent: "#A3E635",
    title: { fa: "ثبت سریع میدانی HSE", en: "HSE Quick Field Register" },
    processes: [
      {
        id: "d17-p1",
        title: { fa: "داشبورد و پایش HSE", en: "HSE Dashboard & Monitoring" },
        subs: [
          { id: "d17-p1-s1", title: { fa: "شاخص‌های TRIR/LTIFR و امتیاز HSE", en: "TRIR/LTIFR & HSE score" }, activity: { fa: "پایش نرخ OSHA از من‌اور واقعی", en: "OSHA rates from real man-hours" }, source: "DPR, hse_manhour", sql: ["hse_incident", "hse_manhour"], output: "HSE Dashboard", connectsTo: "PMA / KPI", ai: "AI TRIR Forecast" },
        ],
      },
      {
        id: "d17-p2",
        title: { fa: "مدیریت حوادث", en: "Incident Management" },
        subs: [
          { id: "d17-p2-s1", title: { fa: "ثبت و رجیستر حوادث", en: "Incident registry" }, activity: { fa: "طبقه‌بندی OSHA و ثبت حادثه", en: "OSHA classification & reporting" }, source: "Field Report, DPR", sql: ["hse_incident"], output: "Incident Register", connectsTo: "CAPA, Claims", ai: "AI Severity Triage" },
        ],
      },
      {
        id: "d17-p3",
        title: { fa: "پروانه کار (PTW)", en: "Permit to Work (PTW)" },
        subs: [
          { id: "d17-p3-s1", title: { fa: "چرخه صدور و گیت WO", en: "Permit cycle & WO gate" }, activity: { fa: "صدور PTW و کنترل کار پرخطر", en: "PTW issue & high-risk control" }, source: "Work Order", sql: ["hse_permit"], output: "PTW Status", connectsTo: "Work Orders", ai: "AI Permit Risk Check" },
        ],
      },
      {
        id: "d17-p4",
        title: { fa: "بازرسی‌ها", en: "Inspections" },
        subs: [
          { id: "d17-p4-s1", title: { fa: "چک‌لیست و نمره A–D", en: "Checklist & A-D score" }, activity: { fa: "ثبت بازرسی و سررسید بعدی", en: "Inspection log & next due" }, source: "HSE Walkdown", sql: ["hse_inspection"], output: "Inspection Score", connectsTo: "Actions", ai: "AI Finding Detector" },
        ],
      },
      {
        id: "d17-p5",
        title: { fa: "بهداشت و محیط‌زیست", en: "Health & Environment" },
        subs: [
          { id: "d17-p5-s1", title: { fa: "TBT، معاینات، پسماند و نشت", en: "TBT, checkups, waste & spills" }, activity: { fa: "پایش بهداشت و محیط‌زیست", en: "Health & env monitoring" }, source: "Clinic, Waste Log", sql: ["hse_tbt"], output: "Health/Env Report", connectsTo: "Governance", ai: "AI Spill Tiering" },
        ],
      },
      {
        id: "d17-p6",
        title: { fa: "اقدامات اصلاحی", en: "Corrective Actions" },
        subs: [
          { id: "d17-p6-s1", title: { fa: "SLA و ارجاع CAPA", en: "SLA & CAPA tracking" }, activity: { fa: "پیگیری اقدام و ارجاع CAPA", en: "Action follow-up & CAPA referral" }, source: "Inspection, Audit", sql: ["hse_action"], output: "Action Closure", connectsTo: "GOV CAPA", ai: "AI Escalation Watch" },
        ],
      },
    ],
  },
  {
    id: "d7",
    group: "support",
    icon: "⚙️",
    accent: "#38BDF8",
    title: { fa: "مدیریت سامانه و پیکربندی پایه", en: "System Administration & Base Config" },
    processes: [
      {
        id: "d7-p1",
        title: { fa: "مدیریت صنایع و خوشه‌های پورتفولیو", en: "Industries & Clusters Management" },
        subs: [
          { id: "d7-p1-s1", title: { fa: "ویرایش و تعریف خوشه‌های صنعتی", en: "Industry Cluster Definition & Edit" }, activity: { fa: "مدیریت خوشه‌های صنعتی و صنایع هدف", en: "Manage target industries" }, source: "System Settings", sql: ["Industry_Master"], output: "Cluster Config", connectsTo: "Portfolio Hub", ai: "AI Cluster Optimizer" },
        ],
      },
      {
        id: "d7-p2",
        title: { fa: "مدیریت و ویرایش پروژه‌ها", en: "Project Master Management" },
        subs: [
          { id: "d7-p2-s1", title: { fa: "ثبت، ویرایش و وضعیت پروژه‌ها", en: "Project CRUD & Status Editor" }, activity: { fa: "تعریف پروژه‌ها، بودجه، کارفرما و موقعیت", en: "Define projects, budgets, clients and locations" }, source: "System Master", sql: ["Project_Master", "Project_Budget"], output: "Project Portfolio Register", connectsTo: "All Modules", ai: "AI Project Classifier" },
        ],
      },
      {
        id: "d7-p3",
        title: { fa: "تنظیمات متادیتا و اسکیمای پایگاه‌داده", en: "Metadata & Database Schema" },
        subs: [
          { id: "d7-p3-s1", title: { fa: "پیکربندی جداول SQL و قوانین کدگذاری", en: "SQL Mapping & Numbering Rules" }, activity: { fa: "تنظیمات کانکشن استرینگ، جداول و کدها", en: "Configure connection strings and tables" }, source: "SQL Engine", sql: ["Schema_Config", "Connection_Strings"], output: "Schema Registry", connectsTo: "Database Engine", ai: "AI Schema Validator" },
        ],
      },
      {
        id: "d7-p4",
        title: { fa: "تنظیمات ظاهری، قلم و فونت", en: "UI, Typography & Font Scaling" },
        subs: [
          { id: "d7-p4-s1", title: { fa: "اندازه فونت، قلم و تمپلیت رنگ", en: "Font Family, Sizing & Theme" }, activity: { fa: "سفارشی‌سازی قلم‌ها و مقیاس متون", en: "Customize fonts and text scaling" }, source: "UI Settings", sql: ["Theme_Config"], output: "Active UI Theme", connectsTo: "UI Layout", ai: "AI Layout Adaptor" },
        ],
      },
      {
        id: "d7-p5",
        title: { fa: "تنظیمات هوش مصنوعی و یکپارچگی", en: "AI Engine & Integrations" },
        subs: [
          { id: "d7-p5-s1", title: { fa: "پیکربندی APIها و مدل‌های هوش مصنوعی", en: "AI Model & API Gateway Config" }, activity: { fa: "مدیریت کلیدها، اندپوینت‌ها و اتصالات زنده", en: "Manage keys, endpoints & integrations" }, source: "API Gateway", sql: ["AI_Config", "Integration_Log"], output: "Integration Status", connectsTo: "AI Assistant", ai: "AI Model Health Check" },
        ],
      },
      {
        id: "d7-p6",
        title: { fa: "آمادگی استقرار و عملیات", en: "Deployment & Operations Readiness" },
        subs: [
          { id: "d7-p6-s1", title: { fa: "کنترل سلامت، امنیت و بکاپ", en: "Health, Security & Backup Checks" }, activity: { fa: "ممیزی آمادگی Frontend، API، SQL و اتصالات", en: "Audit frontend, API, SQL and integration readiness" }, source: "Diagnostics API", sql: ["Schema_Version", "Audit_Log", "Portfolio_Snapshot"], output: "Readiness Report", connectsTo: "Operations", ai: "AI Operations Advisor" },
        ],
      },
      {
        id: "d7-p7",
        title: { fa: "همگام‌سازی داده‌های پایه", en: "Master Data Synchronization" },
        subs: [
          { id: "d7-p7-s1", title: { fa: "انتقال صنایع و پروژه‌ها", en: "Industries & Projects Transfer" }, activity: { fa: "Pull / Push / Backup / Restore", en: "Pull / Push / Backup / Restore" }, source: "PMIS REST API", sql: ["Industry_Master", "Project_Master"], output: "Synchronized Master Data", connectsTo: "SystemContext", ai: "AI Conflict Advisor" },
        ],
      },
      {
        id: "d7-p8",
        title: { fa: "استقرار نهایی و تحویل تولید", en: "Production Deployment & Go-Live" },
        subs: [
          { id: "d7-p8-s1", title: { fa: "Runbook استقرار و بازیابی", en: "Deployment & Recovery Runbook" }, activity: { fa: "Docker / CI / Backup / Monitoring / Release Checklist", en: "Docker / CI / Backup / Monitoring / Release Checklist" }, source: "Deployment Config", sql: ["Schema_Version", "Notification_Queue", "Audit_Log"], output: "Go-Live Runbook", connectsTo: "Operations", ai: "AI Deployment Advisor" },
        ],
      },
    ],
  },
  {
    id: "d18",
    group: "pg3",
    icon: "🛰",
    accent: "#22D3EE",
    title: { fa: "مدیریت موقعیت مکانی پروژه‌ها (GIS)", en: "Project Geo-Location (GIS)" },
    processes: [
      {
        id: "d18-p1",
        title: { fa: "نقشه و پراکندگی پروژه‌ها", en: "Project Map & Spread" },
        subs: [
          { id: "d18-p1-s1", title: { fa: "مختصات و مرکزِ ثقل پروژه", en: "Site Coordinates" }, activity: { fa: "نگهداری مختصاتِ هر سایت و نمایشِ پراکندگی پروژه‌ها روی نمودارِ برداری با فاصله از مرجع", en: "Maintain site coordinates and show project spread on a vector plot with distance from origin" }, source: "Project Charter, Survey", sql: ["Project_Site", "Project_Master"], output: "Project Geo Map", connectsTo: "Portfolio, Planning", ai: "AI Site Cluster Advisor" },
          { id: "d18-p1-s2", title: { fa: "خوشه‌بندی و تحلیلِ فاصله", en: "Clustering & Distance" }, activity: { fa: "خوشه‌بندیِ سایت‌ها بر پایهٔ آستانهٔ فاصله و برآوردِ پوششِ لجستیکی و استقرار نیرو", en: "Cluster sites by distance threshold and assess logistical coverage and crew deployment" }, source: "Logistics, HRM", sql: ["Project_Site", "Logistics_Route"], output: "Cluster & Coverage Report", connectsTo: "Logistics, Workforce", ai: "AI Route Optimizer" },
        ],
      },
    ],
  },
  {
    id: "d19",
    group: "support",
    icon: "🏅",
    accent: "#FBBF24",
    title: { fa: "مدیریت تعالی سازمانی (EFQM)", en: "Organisational Excellence (EFQM)" },
    processes: [
      {
        id: "d19-p1",
        title: { fa: "خودارزیابی مدل EFQM", en: "EFQM Self-Assessment" },
        subs: [
          { id: "d19-p1-s1", title: { fa: "نُه معیار و منطق RADAR", en: "Nine Criteria & RADAR" }, activity: { fa: "امتیازدهیِ پنج معیارِ توانمندساز و چهار معیارِ نتایج با دو بُعدِ RADAR و محاسبهٔ امتیاز تا ۱۰۰۰", en: "Score five enabler and four result criteria on two RADAR axes and compute a 0–1000 total" }, source: "Self-Assessment Workshops", sql: ["Efqm_Assessment", "Efqm_Score"], output: "EFQM Scorecard", connectsTo: "Governance, Quality", ai: "AI Evidence Mapper" },
          { id: "d19-p1-s2", title: { fa: "برنامهٔ بهبود و سطح‌بندی", en: "Improvement Plan & Levels" }, activity: { fa: "تعیین ضعیف‌ترین معیار، تدوین برنامهٔ بهبود و پایشِ پیشرفتِ سطح از «در مسیر» تا «پنج ستاره»", en: "Identify the weakest criterion, build an improvement plan and track level progression" }, source: "Excellence Office", sql: ["Efqm_Improvement"], output: "Improvement Roadmap", connectsTo: "Governance, Audit", ai: "AI Improvement Prioritiser" },
        ],
      },
    ],
  },
  {
    id: "d20",
    group: "pg1",
    icon: "🎯",
    accent: "#F472B6",
    title: { fa: "مدیریت استراتژیک", en: "Strategic Management" },
    processes: [
      {
        id: "d20-p1",
        title: { fa: "نقشه‌ی استراتژی و اهداف", en: "Strategy Map & Objectives" },
        subs: [
          { id: "d20-p1-s1", title: { fa: "چشم‌انداز و محورهای استراتژیک", en: "Vision & Strategic Themes" }, activity: { fa: "تدوین چشم‌انداز، محورهای استراتژیک و منظرهای کارت امتیازی متوازن", en: "Define vision, strategic themes and balanced scorecard perspectives" }, source: "Board, Strategy Office", sql: ["Strategy_Theme", "Bsc_Perspective"], output: "Strategy Map", connectsTo: "Governance, Portfolio", ai: "AI Theme Synthesizer" },
          { id: "d20-p1-s2", title: { fa: "درخت هدف و شاخص", en: "Objective & KPI Tree" }, activity: { fa: "تعریف هدف به تفکیک منظر، با شاخص‌های وزن‌دار، مبنا، هدف کمّی و جهتِ مطلوب", en: "Define objectives per perspective with weighted KPIs, baselines, quantitative targets and direction" }, source: "BSC Workshops", sql: ["Strategy_Objective", "Strategy_Kpi"], output: "Objective & KPI Tree", connectsTo: "Monitoring, Governance", ai: "AI KPI Designer" },
        ],
      },
      {
        id: "d20-p2",
        title: { fa: "ابتکارات و پایش عملکرد استراتژیک", en: "Initiatives & Strategic Performance" },
        subs: [
          { id: "d20-p2-s1", title: { fa: "سبد ابتکارات و تخصیص منابع", en: "Initiative Portfolio" }, activity: { fa: "ثبت ابتکارات، پیوند به اهداف، بودجه و پیشرفت، و اولویت‌بندی بر پایهٔ اثرِ وزنی", en: "Register initiatives, link to objectives, budget and progress, and prioritise by weighted impact" }, source: "PMO, Finance", sql: ["Strategy_Initiative", "Initiative_Link"], output: "Initiative Portfolio", connectsTo: "Portfolio, Cost", ai: "AI Portfolio Optimiser" },
          { id: "d20-p2-s2", title: { fa: "پایش تحقق و هشدار انحراف", en: "Attainment Monitoring & Alerts" }, activity: { fa: "محاسبهٔ تحققِ شاخص، هدف، منظر و کلِ استراتژی با هشدارِ انحراف و پیشنهادِ مداخله", en: "Compute attainment for KPI, objective, perspective and overall strategy with deviation alerts" }, source: "KPI Feeds", sql: ["Strategy_Kpi_Value"], output: "Strategy Scorecard", connectsTo: "Monitoring, Governance", ai: "AI Intervention Advisor" },
        ],
      },
    ],
  },
];
/* ============================================================

   Export format catalog — per domain
   ============================================================ */
















export type FormatKind = "word" | "excel" | "pdf" | "xml" | "csv" | "json" | "mpp" | "xer" | "png";

export const formatMeta: Record<FormatKind, { icon: string; label: string; color: string; ext: string }> = {
  word:  { icon: "📄", label: "Word",       color: "#2B5AA8", ext: ".docx" },
  excel: { icon: "📊", label: "Excel",      color: "#217346", ext: ".xlsx" },
  pdf:   { icon: "📕", label: "PDF",        color: "#DC2626", ext: ".pdf"  },
  xml:   { icon: "🔖", label: "XML",        color: "#8B5CF6", ext: ".xml"  },
  csv:   { icon: "📋", label: "CSV",        color: "#0EA5E9", ext: ".csv"  },
  json:  { icon: "🧾", label: "JSON",       color: "#F59E0B", ext: ".json" },
  mpp:   { icon: "🗓", label: "MS Project", color: "#185ABD", ext: ".mpp"  },
  xer:   { icon: "📅", label: "Primavera",  color: "#FF6B00", ext: ".xer"  },
  png:   { icon: "🖼", label: "PNG",        color: "#10B981", ext: ".png"  },
};

/** Which export formats each domain supports */
export const domainExportFormats: Record<string, FormatKind[]> = {
  d1: ["word", "pdf", "excel", "xml"],                     // Documents
  d2: ["mpp", "xer", "excel", "pdf", "xml"],               // Planning
  d3: ["excel", "pdf", "png", "csv", "json"],              // Performance / KPI
  d4: ["excel", "word", "pdf", "csv"],                     // Risk / Claims
  d5: ["excel", "pdf", "csv", "xml"],                      // Cost / Procurement
  d6: ["pdf", "word", "excel", "json"],                    // Governance
  d8: ["excel", "pdf", "word", "csv"],                     // Quality & Inspection
  d17: ["excel", "pdf", "csv"],                              // HSE field register
};

/* Legacy module shape — derived from domains for backward compatibility */
export const modules: Module[] = [
  {
    id: "m1",
    icon: "🗂",
    accent: "#7FB2FF",
    title: {
      fa: "مدیریت اطلاعات و مستندات",
      en: "Information & Document Management",
    },
    items: [
      { fa: "سیستم مدیریت الکترونیکی مستندات (EDMS)", en: "Electronic Document Management System (EDMS)" },
      { fa: "مدیریت مدارک مهندسی", en: "Engineering Document Management" },
      { fa: "گردش مکاتبات و نامه‌ها", en: "Correspondence & Letter Workflow" },
      { fa: "کنترل نسخه‌ها و Revision Control", en: "Version & Revision Control" },
      { fa: "فرآیند بررسی و تأیید مدارک", en: "Document Review & Approval Process" },
      { fa: "ثبت و مدیریت Transmittalها", en: "Transmittal Registration & Management" },
      { fa: "مدیریت تغییرات مدارک", en: "Document Change Management" },
      { fa: "آرشیو و بایگانی دیجیتال پروژه", en: "Digital Project Archive & Filing" },
      { fa: "مدیریت دانش پروژه (Lessons Learned)", en: "Project Knowledge Management (Lessons Learned)" },
      { fa: "مدیریت گزارش‌ها و سوابق پروژه", en: "Project Reports & Records Management" },
    ],
  },
  {
    id: "m2",
    icon: "🧭",
    accent: "#8FE3C8",
    title: { fa: "برنامه‌ریزی و اجرا", en: "Planning & Execution" },
    items: [
      { fa: "تعریف ساختار شکست کار (WBS)", en: "Work Breakdown Structure (WBS) Definition" },
      { fa: "ساختار شکست سازمانی (OBS)", en: "Organizational Breakdown Structure (OBS)" },
      { fa: "برنامه زمان‌بندی پایه (Baseline)", en: "Baseline Schedule" },
      { fa: "برنامه اجرایی پروژه (PEP)", en: "Project Execution Plan (PEP)" },
      { fa: "برنامه تفصیلی فعالیت‌ها", en: "Detailed Activity Schedule" },
      { fa: "برنامه‌های روزانه، هفتگی و ماهانه", en: "Daily, Weekly & Monthly Plans" },
      { fa: "کنترل پیشرفت فیزیکی پروژه", en: "Physical Progress Control" },
      { fa: "مدیریت Milestoneها", en: "Milestone Management" },
      { fa: "مدیریت منابع پروژه", en: "Project Resource Management" },
      { fa: "مدیریت فعالیت‌های مهندسی، خرید، ساخت و راه‌اندازی (E/P/C/C)", en: "Engineering, Procurement, Construction & Commissioning (E/P/C/C)" },
    ],
  },
  {
    id: "m3",
    icon: "📈",
    accent: "#FFD48A",
    title: { fa: "پایش و عملکرد", en: "Monitoring & Performance" },
    items: [
      { fa: "داشبورد مدیریتی پروژه", en: "Executive Project Dashboard" },
      { fa: "شاخص‌های کلیدی عملکرد (KPI Management)", en: "Key Performance Indicators (KPI Management)" },
      { fa: "مدیریت ارزش کسب‌شده (EVM)", en: "Earned Value Management (EVM)" },
      { fa: "تحلیل PV / EV / AC", en: "PV / EV / AC Analysis" },
      { fa: "شاخص عملکرد زمان (SPI)", en: "Schedule Performance Index (SPI)" },
      { fa: "شاخص عملکرد هزینه (CPI)", en: "Cost Performance Index (CPI)" },
      { fa: "منحنی S-Curve پیشرفت", en: "Progress S-Curve" },
      { fa: "گزارش وضعیت پروژه", en: "Project Status Reporting" },
      { fa: "تحلیل انحرافات برنامه و هزینه", en: "Schedule & Cost Variance Analysis" },
      { fa: "سیستم هشدار زودهنگام", en: "Early Warning System" },
    ],
  },
  {
    id: "m4",
    icon: "⚠️",
    accent: "#FF9F9F",
    title: { fa: "ریسک و ادعاها", en: "Risk & Claims" },
    items: [
      { fa: "ثبت ریسک‌ها (Risk Register)", en: "Risk Register" },
      { fa: "شناسایی و تحلیل ریسک", en: "Risk Identification & Analysis" },
      { fa: "ارزیابی احتمال و اثر ریسک", en: "Probability & Impact Assessment" },
      { fa: "برنامه پاسخ به ریسک", en: "Risk Response Planning" },
      { fa: "پایش ریسک‌های بحرانی", en: "Critical Risk Monitoring" },
      { fa: "مدیریت تغییرات پروژه", en: "Project Change Management" },
      { fa: "کنترل درخواست‌های تغییر (Change Request)", en: "Change Request Control" },
      { fa: "مدیریت تأخیرات پروژه", en: "Project Delay Management" },
      { fa: "تحلیل تأخیرات (Delay Analysis)", en: "Delay Analysis" },
      { fa: "مدیریت ادعاهای قراردادی", en: "Contractual Claims Management" },
      { fa: "مدیریت تمدید مدت پیمان (EOT Management)", en: "Extension of Time (EOT Management)" },
    ],
  },
  {
    id: "m5",
    icon: "💠",
    accent: "#C9A7FF",
    title: { fa: "هزینه و زنجیره تأمین", en: "Cost & Supply Chain" },
    items: [
      { fa: "مدیریت بودجه پروژه", en: "Project Budget Management" },
      { fa: "ساختار شکست هزینه (CBS)", en: "Cost Breakdown Structure (CBS)" },
      { fa: "کنترل هزینه واقعی", en: "Actual Cost Control" },
      { fa: "پیش‌بینی هزینه نهایی", en: "Estimate at Completion Forecasting" },
      { fa: "جریان نقدینگی پروژه", en: "Project Cash Flow" },
      { fa: "مدیریت درخواست‌های خرید", en: "Purchase Requisition Management" },
      { fa: "مدیریت سفارشات خرید", en: "Purchase Order Management" },
      { fa: "کنترل اقلام Long Lead", en: "Long Lead Item Control" },
      { fa: "ارزیابی عملکرد تأمین‌کنندگان", en: "Supplier Performance Evaluation" },
      { fa: "مدیریت قراردادهای خرید", en: "Procurement Contract Management" },
      { fa: "مدیریت حمل‌ونقل و لجستیک", en: "Transportation & Logistics Management" },
      { fa: "کنترل موجودی و انبار پروژه", en: "Project Inventory & Warehouse Control" },
    ],
  },
];

/* ============================================================
   LEFT SIDEBAR — 8 data integration sources
   ============================================================ */
export type Source = {
  id: string;
  name: string;
  icon: string;
  color: string;
  connected: boolean;
  kind: Bi;
  latency: string;
};

export const dataSources: Source[] = [
  { id: "p6", name: "Primavera P6", icon: "📊", color: "#F97316", connected: true, kind: { fa: "زمان‌بندی", en: "Scheduling" }, latency: "12ms" },
  { id: "msp", name: "Microsoft Project", icon: "🗓", color: "#3B82F6", connected: true, kind: { fa: "زمان‌بندی", en: "Scheduling" }, latency: "18ms" },
  { id: "sap", name: "ERP / SAP", icon: "🏛", color: "#22D3EE", connected: true, kind: { fa: "مالی و منابع", en: "Finance & Resources" }, latency: "24ms" },
  { id: "pbi", name: "Power BI", icon: "📶", color: "#FACC15", connected: true, kind: { fa: "تحلیل داده", en: "Analytics" }, latency: "9ms" },
  { id: "cmms", name: "CMMS", icon: "🔧", color: "#A78BFA", connected: true, kind: { fa: "نگهداری و تعمیرات", en: "Maintenance" }, latency: "31ms" },
  { id: "das", name: "Drilling DAS", icon: "🛢", color: "#34D399", connected: true, kind: { fa: "داده حفاری", en: "Drilling Data" }, latency: "7ms" },
  { id: "iot", name: "IoT Sensors", icon: "📡", color: "#F472B6", connected: true, kind: { fa: "پایش میدانی", en: "Field Telemetry" }, latency: "4ms" },
  { id: "dms", name: "DMS", icon: "📁", color: "#94A3B8", connected: false, kind: { fa: "مستندات", en: "Documents" }, latency: "—" },
];

/* ============================================================
   CENTER TOP — 5 PMBOK process groups (fixed nodes, 72° apart)
   ============================================================ */
export type ProcessGroup = {
  id: string;
  label: Bi;
  short: string;
  color: string;
  metric: Bi;
  value: string;
  processes: Bi[];
};

export const processGroups: ProcessGroup[] = [
  {
    id: "pg1", label: { fa: "گروه آغازین", en: "Initiating Group" }, short: "IN", color: "#7FB2FF", metric: { fa: "منشور و ذی‌نفعان", en: "Charter & Stakeholders" }, value: "100%",
    processes: [
      { fa: "توسعه منشور پروژه", en: "Develop Project Charter" },
      { fa: "شناسایی ذی‌نفعان", en: "Identify Stakeholders" }
    ]
  },
  {
    id: "pg2", label: { fa: "گروه برنامه‌ریزی", en: "Planning Group" }, short: "PL", color: "#8FE3C8", metric: { fa: "بسته‌های برنامه پایه", en: "Baseline Packages" }, value: "92%",
    processes: [
      { fa: "برنامه‌ریزی محدوده و WBS", en: "Scope & WBS Planning" },
      { fa: "توسعه زمان‌بندی", en: "Schedule Development" },
      { fa: "برآورد هزینه و بودجه", en: "Cost & Budget Estimating" },
      { fa: "برنامه‌ریزی ریسک", en: "Risk Planning" },
      { fa: "برنامه‌ریزی منابع و تدارکات", en: "Resource & Procurement Planning" }
    ]
  },
  {
    id: "pg3", label: { fa: "گروه اجرا", en: "Executing Group" }, short: "EX", color: "#FFD48A", metric: { fa: "پیشرفت فیزیکی", en: "Physical Progress" }, value: "64%",
    processes: [
      { fa: "هدایت و مدیریت کار پروژه", en: "Direct & Manage Project Work" },
      { fa: "تضمین کیفیت", en: "Quality Assurance" },
      { fa: "تأمین منابع و تدارکات", en: "Procurement & Resource Acquisition" },
      { fa: "مدیریت ارتباطات و ذی‌نفعان", en: "Communications & Stakeholder Mgt" }
    ]
  },
  {
    id: "pg4", label: { fa: "گروه پایش و کنترل", en: "Monitoring & Controlling Group" }, short: "MC", color: "#FF9F9F", metric: { fa: "شاخص SPI / CPI", en: "SPI / CPI Index" }, value: "0.97",
    processes: [
      { fa: "پایش و کنترل کار پروژه", en: "Monitor & Control Project Work" },
      { fa: "کنترل زمان‌بندی و EVM", en: "Schedule Control & EVM" },
      { fa: "کنترل هزینه‌ها", en: "Cost Control" },
      { fa: "کنترل تغییرات یکپارچه", en: "Integrated Change Control" },
      { fa: "پایش ریسک‌ها", en: "Risk Monitoring" }
    ]
  },
  {
    id: "pg5", label: { fa: "گروه اختتامیه", en: "Closing Group" }, short: "CL", color: "#C9A7FF", metric: { fa: "تحویل و تسویه", en: "Handover & Settlement" }, value: "18%",
    processes: [
      { fa: "اختتام فاز یا پروژه", en: "Close Project or Phase" },
      { fa: "مدیریت ادعا و تسویه حساب", en: "Claims & Settlement" },
      { fa: "ثبت درس‌آموخته‌ها (Lessons Learned)", en: "Lessons Learned Register" }
    ]
  },
];

/* ============================================================
   CENTER BOTTOM — 5 industrial clusters × 4 project states
   ============================================================ */
export type Cluster = {
  id: string;
  icon: string;
  color: string;
  title: Bi;
  progress: number;
  active: number;
  tender: number;
  stopped: number;
  completed: number;
};

export const clusters: Cluster[] = [
  { id: "c1", icon: "🛢", color: "#7FB2FF", title: { fa: "نفت و گاز", en: "Oil & Gas" }, progress: 72, active: 18, tender: 6, stopped: 2, completed: 24 },
  { id: "c2", icon: "⚗️", color: "#8FE3C8", title: { fa: "پتروشیمی", en: "Petrochemical" }, progress: 58, active: 12, tender: 4, stopped: 1, completed: 15 },
  { id: "c3", icon: "⚡", color: "#FFD48A", title: { fa: "نیرو و انرژی", en: "Power & Energy" }, progress: 46, active: 9, tender: 7, stopped: 3, completed: 11 },
  { id: "c4", icon: "🪨", color: "#FF9F9F", title: { fa: "حفاری و اکتشاف", en: "Drilling & Exploration" }, progress: 81, active: 14, tender: 3, stopped: 1, completed: 20 },
  { id: "c5", icon: "🏗", color: "#C9A7FF", title: { fa: "زیرساخت و ساختمان", en: "Infrastructure & Construction" }, progress: 63, active: 21, tender: 8, stopped: 4, completed: 29 },
];

export const stateLegend: { key: keyof Pick<Cluster, "active" | "tender" | "stopped" | "completed">; dot: string; label: Bi }[] = [
  { key: "active", dot: "#34D399", label: { fa: "فعال", en: "Active" } },
  { key: "tender", dot: "#FBBF24", label: { fa: "مناقصه / مطالعه", en: "Tender / Study" } },
  { key: "stopped", dot: "#F87171", label: { fa: "متوقف", en: "Stopped" } },
  { key: "completed", dot: "#94A3B8", label: { fa: "خاتمه‌یافته", en: "Completed" } },
];

/* ============================================================
   Portfolio projects — grouped by industrial cluster
   ============================================================ */
export type ProjectStatus = "active" | "tender" | "stopped" | "completed";

export type Project = {
  id: string;
  code: string;
  name: Bi;
  client: Bi;
  status: ProjectStatus;
  progress: number; // 0..100
  budget: string;   // display-ready
  location: Bi;
};

export const projectsByCluster: Record<string, Project[]> = {
  c1: [
    { id: "c1-p1", code: "OG-2401", name: { fa: "توسعه میدان نفتی آزادگان جنوبی", en: "South Azadegan Oilfield Development" }, client: { fa: "شرکت ملی نفت", en: "NIOC" }, status: "active", progress: 62, budget: "$4.2B", location: { fa: "خوزستان", en: "Khuzestan" } },
    { id: "c1-p2", code: "OG-2402", name: { fa: "طرح جمع‌آوری گازهای همراه", en: "Associated Gas Gathering Plan" }, client: { fa: "شرکت نفت مناطق مرکزی", en: "ICOFC" }, status: "active", progress: 41, budget: "$1.1B", location: { fa: "اصفهان", en: "Isfahan" } },
    { id: "c1-p3", code: "OG-2403", name: { fa: "خط انتقال نفت خام گوره–جاسک", en: "Goreh–Jask Crude Pipeline" }, client: { fa: "شرکت خطوط لوله", en: "IOPTC" }, status: "completed", progress: 100, budget: "$2.0B", location: { fa: "هرمزگان", en: "Hormozgan" } },
    { id: "c1-p4", code: "OG-2404", name: { fa: "مطالعه فاز ۱۴ پارس جنوبی توسعه‌ای", en: "Phase 14 South Pars Study" }, client: { fa: "پارس جنوبی", en: "POGC" }, status: "tender", progress: 8, budget: "$780M", location: { fa: "بوشهر", en: "Bushehr" } },
    { id: "c1-p5", code: "OG-2405", name: { fa: "بازسازی سکوی SPD-19", en: "SPD-19 Platform Refit" }, client: { fa: "شرکت نفت فلات قاره", en: "IOOC" }, status: "stopped", progress: 27, budget: "$310M", location: { fa: "خلیج فارس", en: "Persian Gulf" } },
    { id: "c1-p6", code: "OG-2406", name: { fa: "ایستگاه تقویت فشار گاز شانول", en: "Shanul Gas Compressor Station" }, client: { fa: "شرکت گاز", en: "NIGC" }, status: "active", progress: 74, budget: "$260M", location: { fa: "فارس", en: "Fars" } },
  ],
  c2: [
    { id: "c2-p1", code: "PC-2401", name: { fa: "پتروشیمی الفین بندر امام (بازآرایی)", en: "Bandar Imam Olefin Revamp" }, client: { fa: "پتروشیمی بندر امام", en: "BIPC" }, status: "active", progress: 58, budget: "$690M", location: { fa: "خوزستان", en: "Khuzestan" } },
    { id: "c2-p2", code: "PC-2402", name: { fa: "واحد متانول کاوه ۲", en: "Kaveh Methanol #2 Unit" }, client: { fa: "کاوه متانول", en: "Kaveh Methanol" }, status: "active", progress: 33, budget: "$1.3B", location: { fa: "بندر دیر", en: "Bandar Dayyer" } },
    { id: "c2-p3", code: "PC-2403", name: { fa: "مطالعه امکان‌سنجی PTA خاورمیانه", en: "Middle-East PTA Feasibility" }, client: { fa: "هلدینگ خلیج فارس", en: "PGPIC" }, status: "tender", progress: 12, budget: "$540M", location: { fa: "عسلویه", en: "Asaluyeh" } },
    { id: "c2-p4", code: "PC-2404", name: { fa: "پروپیلن جم — فاز نهایی", en: "Jam Propylene — Final Phase" }, client: { fa: "پتروشیمی جم", en: "JPC" }, status: "completed", progress: 100, budget: "$820M", location: { fa: "بوشهر", en: "Bushehr" } },
    { id: "c2-p5", code: "PC-2405", name: { fa: "واحد پلی‌اتیلن ایلام", en: "Ilam Polyethylene Unit" }, client: { fa: "پتروشیمی ایلام", en: "IPC" }, status: "stopped", progress: 44, budget: "$470M", location: { fa: "ایلام", en: "Ilam" } },
  ],
  c3: [
    { id: "c3-p1", code: "PE-2401", name: { fa: "نیروگاه سیکل ترکیبی دالاهو", en: "Dalaho CCGT Power Plant" }, client: { fa: "توانیر", en: "TAVANIR" }, status: "active", progress: 51, budget: "$920M", location: { fa: "کرمانشاه", en: "Kermanshah" } },
    { id: "c3-p2", code: "PE-2402", name: { fa: "مزرعه بادی ۱۰۰ مگاواتی منجیل", en: "Manjil 100MW Wind Farm" }, client: { fa: "ساتبا", en: "SATBA" }, status: "active", progress: 68, budget: "$140M", location: { fa: "گیلان", en: "Gilan" } },
    { id: "c3-p3", code: "PE-2403", name: { fa: "نیروگاه خورشیدی رفسنجان", en: "Rafsanjan Solar Plant" }, client: { fa: "بخش خصوصی", en: "Private IPP" }, status: "tender", progress: 5, budget: "$95M", location: { fa: "کرمان", en: "Kerman" } },
    { id: "c3-p4", code: "PE-2404", name: { fa: "توسعه پست ۴۰۰ کیلوولت اهواز", en: "Ahvaz 400kV Substation Expansion" }, client: { fa: "برق منطقه‌ای خوزستان", en: "KHZ REC" }, status: "completed", progress: 100, budget: "$60M", location: { fa: "اهواز", en: "Ahvaz" } },
    { id: "c3-p5", code: "PE-2405", name: { fa: "خط انتقال ۲۳۰ کیلوولت زاهدان", en: "Zahedan 230kV Transmission Line" }, client: { fa: "برق منطقه‌ای سیستان", en: "SBC REC" }, status: "stopped", progress: 22, budget: "$48M", location: { fa: "سیستان و بلوچستان", en: "Sistan" } },
  ],
  c4: [
    { id: "c4-p1", code: "DR-2401", name: { fa: "حفاری چاه‌های توسعه‌ای پارس شمالی", en: "North Pars Development Drilling" }, client: { fa: "شرکت ملی حفاری", en: "NIDC" }, status: "active", progress: 77, budget: "$610M", location: { fa: "خلیج فارس", en: "Persian Gulf" } },
    { id: "c4-p2", code: "DR-2402", name: { fa: "پروژه تعمیر و تکمیل چاه SP-9", en: "SP-9 Well Workover" }, client: { fa: "NIOC", en: "NIOC" }, status: "active", progress: 44, budget: "$110M", location: { fa: "بوشهر", en: "Bushehr" } },
    { id: "c4-p3", code: "DR-2403", name: { fa: "مطالعات اکتشافی بلوک ۲۹ زاگرس", en: "Zagros Block 29 Exploration Study" }, client: { fa: "دایرکتوریت اکتشاف", en: "Exploration Dir." }, status: "tender", progress: 15, budget: "$70M", location: { fa: "لرستان", en: "Lorestan" } },
    { id: "c4-p4", code: "DR-2404", name: { fa: "پایان‌بندی چاه‌های اهواز-۴", en: "Ahvaz-4 Well Completion" }, client: { fa: "NISOC", en: "NISOC" }, status: "completed", progress: 100, budget: "$95M", location: { fa: "خوزستان", en: "Khuzestan" } },
    { id: "c4-p5", code: "DR-2405", name: { fa: "سایت اکتشافی جنوب کرمان", en: "South Kerman Exploration Site" }, client: { fa: "شرکت ملی نفت", en: "NIOC" }, status: "stopped", progress: 18, budget: "$52M", location: { fa: "کرمان", en: "Kerman" } },
  ],
  c5: [
    { id: "c5-p1", code: "IC-2401", name: { fa: "آزادراه تهران–شمال، قطعه ۲", en: "Tehran-North Freeway, Sec. 2" }, client: { fa: "وزارت راه", en: "MRUD" }, status: "active", progress: 63, budget: "$1.6B", location: { fa: "مازندران", en: "Mazandaran" } },
    { id: "c5-p2", code: "IC-2402", name: { fa: "مترو خط ۷ توسعه غرب", en: "Metro Line 7 West Extension" }, client: { fa: "شهرداری تهران", en: "Tehran Muni." }, status: "active", progress: 39, budget: "$980M", location: { fa: "تهران", en: "Tehran" } },
    { id: "c5-p3", code: "IC-2403", name: { fa: "برج اداری مرکزی شهر مشهد", en: "Mashhad Central Office Tower" }, client: { fa: "توسعه‌گران خصوصی", en: "Private Dev." }, status: "tender", progress: 6, budget: "$210M", location: { fa: "خراسان رضوی", en: "Razavi Khorasan" } },
    { id: "c5-p4", code: "IC-2404", name: { fa: "سد و نیروگاه تنگاب فیروزآباد", en: "Tangab Dam & Hydro Plant" }, client: { fa: "وزارت نیرو", en: "MoE" }, status: "completed", progress: 100, budget: "$310M", location: { fa: "فارس", en: "فارس" } },
    { id: "c5-p5", code: "IC-2405", name: { fa: "بازآفرینی بافت فرسوده اهواز", en: "Ahvaz Urban Regeneration" }, client: { fa: "شرکت بازآفرینی", en: "UDRC" }, status: "stopped", progress: 21, budget: "$140M", location: { fa: "خوزستان", en: "Khuzestan" } },
    { id: "c5-p6", code: "IC-2406", name: { fa: "پل کابلی خلیج فارس", en: "Persian Gulf Cable-Stayed Bridge" }, client: { fa: "وزارت راه", en: "MRUD" }, status: "active", progress: 55, budget: "$720M", location: { fa: "هرمزگان", en: "Hormozgan" } },
  ],
};

export const statusMeta: Record<ProjectStatus, { color: string; label: Bi }> = {
  active:    { color: "#34D399", label: { fa: "فعال",             en: "Active" } },
  tender:    { color: "#FBBF24", label: { fa: "مناقصه / مطالعه",  en: "Tender / Study" } },
  stopped:   { color: "#F87171", label: { fa: "متوقف",            en: "Stopped" } },
  completed: { color: "#94A3B8", label: { fa: "خاتمه‌یافته",       en: "Completed" } },
};

/* ============================================================
   UI strings
   ============================================================ */
export const ui = {
  hubTitle: { fa: "پلتفرم جامع مدیریت و کنترل پروژه", en: "Comprehensive Project Management & Control Platform" },
  hubSub: { fa: "رینگ ۵ فرآیندی PMBOK — بتا ۱.۱.۰", en: "PMBOK 5-Process Ring — Beta 1.1.0" },
  frameworkTitle: { fa: "چارچوب جامع مدیریت پروژه", en: "Comprehensive Project Management Framework" },
  frameworkSub: { fa: "۵ ماژول · نمای سرتیترها", en: "5 Modules · Header Overview" },
  sourcesTitle: { fa: "منابع داده", en: "Data Sources" },
  sourcesSub: { fa: "۷ اتصال فعال از ۸ منبع", en: "7 of 8 integrations live" },
  connect: { fa: "+ اتصال منبع جدید", en: "+ Connect New Source" },
  connected: { fa: "متصل", en: "Connected" },
  disconnected: { fa: "قطع", en: "Disconnected" },
  clustersTitle: { fa: "خوشه‌های صنعتی پورتفولیو", en: "Portfolio Industrial Clusters" },
  footnote: { fa: "منبع داده پورتفولیو: SQL Server (.\\SQL2008EXPRESS)", en: "Portfolio data source: SQL Server (.\\SQL2008EXPRESS)" },
  selected: { fa: "انتخاب فعال", en: "Active selection" },
  all: { fa: "کل پورتفولیو", en: "Full portfolio" },
  projects: { fa: "پروژه", en: "projects" },
  live: { fa: "همگام‌سازی زنده", en: "Live sync" },
};