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
export type SubProcess = {
  id: string;
  title: Bi;
  activity: Bi;
  source: string;
  sql: string[];
  output: string;
  connectsTo: string;
  ai: string;
};

export type Process = {
  id: string;
  title: Bi;
  subs: SubProcess[];
};

export type Domain = {
  id: string;
  icon: string;
  accent: string;
  title: Bi;
  processes: Process[];
};

export const domains: Domain[] = [
  {
    id: "d1",
    icon: "🗂",
    accent: "#7FB2FF",
    title: { fa: "مدیریت اطلاعات و مستندات پروژه", en: "Project Information & Document Management" },
    processes: [
      {
        id: "d1-p1",
        title: { fa: "EDMS", en: "EDMS" },
        subs: [
          { id: "d1-p1-s1", title: { fa: "کنترل مدارک", en: "Document Control" }, activity: { fa: "ثبت و گردش مدارک", en: "Register & workflow" }, source: "EDMS, Excel, Upload", sql: ["Document_Master", "Document_Transaction", "Document_Status"], output: "Document Status Report", connectsTo: "Engineering, Dashboard", ai: "AI Document Review" },
        ],
      },
      {
        id: "d1-p2",
        title: { fa: "مدارک مهندسی", en: "Engineering Documents" },
        subs: [
          { id: "d1-p2-s1", title: { fa: "کنترل نسخه (Revision)", en: "Revision Control" }, activity: { fa: "کنترل نسخه‌ها", en: "Version control" }, source: "EDMS", sql: ["Document_Revision"], output: "Revision History", connectsTo: "Change Management", ai: "AI Compare Revision" },
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
          { id: "d1-p4-s1", title: { fa: "ارسال مدارک", en: "Document Transmit" }, activity: { fa: "کنترل ارسال و دریافت", en: "In/out control" }, source: "EDMS", sql: ["Transmittal_Register"], output: "Transmittal Status", connectsTo: "EDMS", ai: "AI Delay Detection" },
        ],
      },
      {
        id: "d1-p5",
        title: { fa: "مدیریت دانش", en: "Knowledge Management" },
        subs: [
          { id: "d1-p5-s1", title: { fa: "درس‌آموخته‌ها", en: "Lessons Learned" }, activity: { fa: "ثبت تجربه", en: "Experience capture" }, source: "User Entry", sql: ["Knowledge_Base"], output: "Knowledge Report", connectsTo: "PMO Database", ai: "AI Knowledge Search" },
        ],
      },
    ],
  },
  {
    id: "d2",
    icon: "🧭",
    accent: "#8FE3C8",
    title: { fa: "مدیریت برنامه‌ریزی و اجرای عملیات پروژه", en: "Planning & Execution" },
    processes: [
      {
        id: "d2-p2",
        title: { fa: "مدیریت برنامه زمان‌بندی", en: "Schedule Management" },
        subs: [
          { id: "d2-p2-s0", title: { fa: "ساختار شکست کار (WBS)", en: "Work Breakdown Structure (WBS)" }, activity: { fa: "تعریف فعالیت‌ها و ساختار کار", en: "Activity & work structure definition" }, source: "Primavera, MSP", sql: ["Project_WBS", "WBS_Activity"], output: "WBS Report", connectsTo: "Schedule Engine", ai: "AI WBS Generator" },
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
    id: "d3",
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






















































































































































































































































    ],
  },
  {
    id: "d5",
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
    ],
  },
  {
    id: "d6",
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
    id: "d7",
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