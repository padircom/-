import { useState } from "react";
import { domains, t, type Bi, type Lang } from "../data/framework";
import { useSystem } from "../context/SystemContext";
import { roleLabel, useAuth } from "../context/AuthContext";
import type { ModuleNavTarget } from "./RightSidebar";
import CapabilityDetail from "./CapabilityDetail";
import AdminWorkspace from "./AdminWorkspace";
import DocumentWorkspace, { type EdmsTab } from "./DocumentWorkspace";
import PlanningWorkspace, { type PexTab } from "./PlanningWorkspace";
import PmaWorkspace, { type PmaTab } from "./PmaWorkspace";
import RiskClaimsWorkspace, { type D4Tab } from "./RiskClaimsWorkspace";
import GovernanceWorkspace, { type GovTab } from "./GovernanceWorkspace";
import HseWorkspace, { type HseTab as HseFieldTab } from "./HseFieldWorkspace";
import ContractsPanel from "./ContractsPanel";
import CostSupplyWorkspace, { type FinTab } from "./CostSupplyWorkspace";
import QualityWorkspace, { type QmsTab } from "./QualityWorkspace";
import WorkforceWorkspace, { type HrmTab } from "./WorkforceWorkspace";
import CommunicationWorkspace, { type CkmTab } from "./CommunicationWorkspace";
import MachineryWorkspace, { type EqmTab } from "./MachineryWorkspace";
import EngineeringWorkspace from "./EngineeringWorkspace";
import HSEWorkspace, { type HseTab } from "./HSEWorkspace";
import VendorRatingPanel from "./VendorRatingPanel";

/** Extra submodules only on the d1 inner page — not in the main right sidebar. */
const D1_PAGE_SUBS: Record<string, { id: string; title: Bi; tab: EdmsTab; sql: string[] }[]> = {
  "d1-p1": [
    { id: "d1-p1-ov", title: { fa: "نمای کلی و KPI", en: "Overview & KPI" }, tab: "overview", sql: ["Document_Master"] },
    { id: "d1-p1-excel", title: { fa: "موتور اکسل (قالب / ورود / خروجی)", en: "Excel Interop" }, tab: "excel", sql: ["Excel_Template", "Import_Batch"] },
    { id: "d1-p1-num", title: { fa: "شماره‌گذاری مدارک", en: "Document Numbering" }, tab: "numbering", sql: ["Doc_Number_Rule"] },
  ],
  "d1-p2": [
    { id: "d1-p2-wf", title: { fa: "گردش کار تأیید Code 1–4", en: "Review Workflow Code 1–4" }, tab: "workflow", sql: ["Workflow_Task"] },
  ],
};

/** Extra submodules only on the d2 inner page — not in the main right sidebar. */
const D2_PAGE_SUBS: Record<string, { id: string; title: Bi; tab: PexTab; sql: string[] }[]> = {
  "d2-p2": [
    /* گانت تعاملی، ردیابی مایلستون، تحلیل مسیر بحرانی و نگاه‌به‌جلو
     * از اینجا حذف شدند و به تب‌های موازی داخل «برنامه پایه» رفتند.
     *
     * دلیل: هر چهار نما روی همان یک برنامهٔ زمان‌بندی کار می‌کنند.
     * وقتی چهار ورودی جدا در سایدبار بودند، کاربر برای مقایسهٔ مسیر
     * بحرانی با مایلستون باید دو بار از صفحه بیرون و تو می‌رفت و
     * زمینهٔ کارش را از دست می‌داد. */
  ],
  "d2-p4": [
    { id: "d2-p4-reg", title: { fa: "ثبت DPR (گردش تأیید)", en: "DPR Register" }, tab: "dprReg", sql: ["pex_dpr"] },
  ],
  "d2-p6": [
    { id: "d2-p6-rep", title: { fa: "تولید گزارش", en: "Report Generator" }, tab: "reports", sql: ["pex_report_template"] },
    { id: "d2-p6-tpl", title: { fa: "طراح قالب + AI", en: "Template Designer" }, tab: "template", sql: ["pex_report_template"] },
    { id: "d2-p6-al", title: { fa: "مرکز هشدار", en: "Alert Center" }, tab: "alerts", sql: ["pex_alert_rule"] },
  ],
};

const D2_TAB_BY_SUB: Record<string, PexTab> = {
  "d2-p2-ws": "workshop",
  /* ساختار شکست از سایدبار حذف شد و تبی داخل کارگاه است. نگاشت
   * می‌ماند تا پیوندهای قدیمی به تب درست هدایت شوند، نه صفحهٔ سفید. */
  "d2-p2-s0": "wbs",
  "d2-p2-s1": "baseline",
  "d2-p4-s1": "dpr",
  "d2-p4-reg": "dprReg",
  "d2-p5-s1": "weekly",
  "d2-p6-s1": "mpr",
  "d2-p6-rep": "reports",
  "d2-p6-tpl": "template",
  "d2-p6-al": "alerts",
};

/** Extra HSE submodules only on the d2 inner page — not in the main right sidebar. */
const HSE_PAGE_SUBS: Record<string, { id: string; title: Bi; tab: HseFieldTab; sql: string[] }[]> = {
  "d2-p4": [
    { id: "d2-p4-hse", title: { fa: "ایمنی، بهداشت و محیط‌زیست (HSE)", en: "HSE" }, tab: "dashboard", sql: ["hse_incident", "hse_permit", "hse_inspection"] },
    { id: "d2-p4-hse-inc", title: { fa: "HSE — رجیستر حوادث", en: "HSE Incidents" }, tab: "incidents", sql: ["hse_incident"] },
    { id: "d2-p4-hse-ptw", title: { fa: "HSE — پروانه کار", en: "HSE Permits" }, tab: "ptw", sql: ["hse_permit"] },
    { id: "d2-p4-hse-insp", title: { fa: "HSE — بازرسی‌ها", en: "HSE Inspections" }, tab: "inspections", sql: ["hse_inspection"] },
    { id: "d2-p4-hse-he", title: { fa: "HSE — بهداشت/محیط", en: "HSE Health/Env" }, tab: "healthenv", sql: ["hse_tbt"] },
    { id: "d2-p4-hse-act", title: { fa: "HSE — اقدامات اصلاحی", en: "HSE Actions" }, tab: "actions", sql: ["hse_action"] },
  ],
};
const HSE_TAB_BY_SUB: Record<string, HseFieldTab> = {
  "d2-p4-hse": "dashboard",
  "d2-p4-hse-inc": "incidents",
  "d2-p4-hse-ptw": "ptw",
  "d2-p4-hse-insp": "inspections",
  "d2-p4-hse-he": "healthenv",
  "d2-p4-hse-act": "actions",
};

const D3_PAGE_SUBS: Record<string, { id: string; title: Bi; tab: PmaTab; sql: string[] }[]> = {
  "d3-p1": [
    { id: "d3-p1-phi", title: { fa: "شاخص سلامت PHI", en: "PHI Health" }, tab: "phi", sql: ["pma_health_snapshot"] },
  ],
  "d3-p2": [
    { id: "d3-p2-wpd", title: { fa: "برداشت WPD", en: "WPD Harvester" }, tab: "wpd", sql: ["pma_wpd"] },
    { id: "d3-p2-fc", title: { fa: "پیش‌بینی ۵×۴", en: "Forecast 5×4" }, tab: "forecast", sql: ["pma_forecast"] },
  ],
  "d3-p4": [
    { id: "d3-p4-ews", title: { fa: "EWS سه لایه", en: "EWS 3-layer" }, tab: "ews", sql: ["pma_alert_rule"] },
  ],
  "d3-p6": [
    /* داشبورد مدیر پروژه از حوزهٔ برنامه‌ریزی به اینجا منتقل شد.
     *
     * آنجا میان ابزارهای ساخت برنامه نشسته بود، در حالی که کاری که
     * می‌کند گزارش وضعیت است نه ساختن زمان‌بندی. حوزهٔ پایش از قبل
     * همان تب `dash` را داشت، پس این انتقال جای ورودی را عوض می‌کند
     * نه اینکه نمای تازه‌ای بسازد. */
    { id: "d3-p6-dash", title: { fa: "داشبورد مدیر پروژه", en: "PM Dashboard" }, tab: "dash", sql: ["pma_dash_config"] },
    { id: "d3-p6-14", title: { fa: "۱۴ نوع گزارش", en: "14 report types" }, tab: "reports", sql: ["pma_report_def"] },
    { id: "d3-p6-exec", title: { fa: "گزارش یک‌صفحه EXEC", en: "RPT-EXEC" }, tab: "exec", sql: ["pma_report_instance"] },
  ],
};

const D3_TAB_BY_SUB: Record<string, PmaTab> = {
  "d3-p1-s1": "kpi",
  "d3-p1-phi": "phi",
  "d3-p2-s1": "evm",
  "d3-p2-wpd": "wpd",
  "d3-p2-fc": "forecast",
  "d3-p3-s1": "var",
  "d3-p4-s1": "ews",
  "d3-p4-ews": "ews",
  "d3-p5-s1": "action",
  "d3-p6-s1": "dash",
  "d3-p6-14": "reports",
  "d3-p6-exec": "exec",
  "d3-p6-dash": "dash",
};

const D4_PAGE_SUBS: Record<string, { id: string; title: Bi; tab: D4Tab; sql: string[] }[]> = {
  "d4-p1": [
    { id: "d4-p1-mx", title: { fa: "ماتریس احتمال × اثر", en: "P×I matrix" }, tab: "matrix", sql: ["Risk_Register", "Risk_Assessment"] },
    { id: "d4-p1-cee", title: { fa: "شناسایی Cause–Event–Effect", en: "C–E–E identification" }, tab: "register", sql: ["Risk_Register", "RBS"] },
    { id: "d4-p1-rsv", title: { fa: "ذخیره و پایش", en: "Reserve & monitor" }, tab: "reserve", sql: ["Reserve_Ledger"] },
    { id: "d4-p1-iss", title: { fa: "مسئله و هشدار زود", en: "Issue + EWS" }, tab: "issue", sql: ["Issue"] },
  ],
  "d4-p3": [
    { id: "d4-p3-imp", title: { fa: "اثر بر Baseline قفل", en: "Impact on locked BL" }, tab: "change", sql: ["Change_Request"] },
    { id: "d4-p3-ccb", title: { fa: "CCB و اختیار", en: "CCB + authority" }, tab: "ccb", sql: ["CCB_Meeting"] },
  ],
  "d4-p4": [
    { id: "d4-p4-tia", title: { fa: "تحلیل تأخیر ۵۰۹۰", en: "5090 delay analysis" }, tab: "delay", sql: ["Delay_Register"] },
  ],
  "d4-p5": [
    { id: "d4-p5-gate", title: { fa: "دروازه Baseline+DataDate", en: "BL + DataDate gate" }, tab: "claim", sql: ["Claim_Register"] },
    { id: "d4-p5-ntc", title: { fa: "Notice و نگهبان Time-Bar", en: "Notice + Time-Bar" }, tab: "notice", sql: ["Claim_Notice"] },
    { id: "d4-p5-dsp", title: { fa: "مذاکره و اختلاف", en: "Negotiation & dispute" }, tab: "dispute", sql: ["Claim_Settlement"] },
    { id: "d4-p5-exe", title: { fa: "گراف EXEC", en: "EXEC graph" }, tab: "exec", sql: ["Trace_Link"] },
  ],
};

const D4_TAB_BY_SUB: Record<string, D4Tab> = {
  "d4-p1-s1": "register",
  "d4-p1-mx": "matrix",
  "d4-p1-cee": "register",
  "d4-p1-rsv": "reserve",
  "d4-p1-iss": "issue",
  "d4-p3-s1": "change",
  "d4-p3-imp": "change",
  "d4-p3-ccb": "ccb",
  "d4-p4-s1": "delay",
  "d4-p4-tia": "delay",
  "d4-p5-s1": "claim",
  "d4-p5-gate": "claim",
  "d4-p5-ntc": "notice",
  "d4-p5-dsp": "dispute",
  "d4-p5-exe": "exec",
};

/* حوزهٔ d6 زیرماژول اضافی ندارد.
 *
 * پیش از این چهار ردیف اضافه در این صفحه نشان داده می‌شد:
 *   «پایش SLA و گام‌های معوق»      کنار «گردش فرآیند»
 *   «سلامت اتصال و آخرین همگام‌سازی» کنار «تجمیع داده‌ها»
 *   «یافته‌ها و اقدام اصلاحی»        کنار «کنترل انطباق»
 *   «دفتر تصمیم و مرجع اختیار»       کنار «تصمیم‌یار مدیریتی»
 *
 * هر چهار جفت به یک تب یکسان می‌رفتند (`workflow`، `integration`،
 * `audit`، `decision`) و هیچ پارامتر دیگری همراه نداشتند — یعنی دو
 * ردیف مختلف دقیقاً یک صفحه را باز می‌کردند.
 *
 * دلیلش این است که هر تب از ابتدا هر دو موضوع را با هم نشان می‌دهد:
 * تب گردش فرآیند ستون «مهلت / SLA» و شمارندهٔ «نقض SLA» دارد؛ تب
 * یکپارچگی ستون سلامت اتصال و آخرین همگام‌سازی؛ تب ممیزی ستون CAPA
 * و یافته‌ها؛ تب پشتیبان تصمیم، دفتر تصمیم و مرجع اختیار. پس ردیف
 * دوم چیزی اضافه نمی‌کرد و فقط کاربر را به تردید می‌انداخت.
 */

const D6_TAB_BY_SUB: Record<string, GovTab> = {
  "d6-p1-s1": "workflow",
  "d6-p2-s1": "integration",
  "d6-p3-s1": "stakeholders",
  "d6-p4-s1": "audit",
  "d6-p5-s1": "decision",
};

/** Extra submodules only on the d8 inner page — main sidebar keeps one row per domain. */
const D8_PAGE_SUBS: Record<string, { id: string; title: Bi; tab: QmsTab; sql: string[] }[]> = {
  "d8-p1": [
    { id: "d8-p1-hold", title: { fa: "نقاط توقف و شاهد", en: "Hold & witness points" }, tab: "plan", sql: ["ITP_Point"] },
  ],
  "d8-p2": [
    { id: "d8-p2-ir", title: { fa: "درخواست بازرسی و اعلان ۴۸ ساعته", en: "IR & 48h notice" }, tab: "inspection", sql: ["Inspection_Request"] },
    { id: "d8-p2-spc", title: { fa: "نمودار پایش و شش‌سیگما", en: "Control chart & six sigma" }, tab: "inspection", sql: ["Test_Report"] },
  ],
  "d8-p3": [
    { id: "d8-p3-capa", title: { fa: "اقدام اصلاحی و پارتو علل", en: "CAPA & Pareto" }, tab: "ncr", sql: ["CAPA_Action"] },
    { id: "d8-p3-coq", title: { fa: "هزینه کیفیت و COPQ", en: "Cost of quality" }, tab: "ncr", sql: ["NCR_Register"] },
  ],
  "d8-p4": [
    { id: "d8-p4-trace", title: { fa: "ردیابی شماره ذوب", en: "Heat traceability" }, tab: "material", sql: ["Heat_Trace_Link"] },
  ],
  "d8-p5": [
    { id: "d8-p5-iso", title: { fa: "امتیاز انطباق و ریسک گواهینامه", en: "Compliance score & cert risk" }, tab: "audit", sql: ["Audit_Finding"] },
  ],
  "d8-p6": [
    { id: "d8-p6-mc", title: { fa: "دروازه تحویل مکانیکی", en: "Mechanical completion gate" }, tab: "handover", sql: ["Completion_Certificate"] },
    { id: "d8-p6-dos", title: { fa: "داکیومنت کیفیت تحویل", en: "Quality dossier" }, tab: "handover", sql: ["Quality_Dossier"] },
  ],
};

const D8_TAB_BY_SUB: Record<string, QmsTab> = {
  "d8-p1-s1": "plan",
  "d8-p1-hold": "plan",
  "d8-p2-s1": "inspection",
  "d8-p2-ir": "inspection",
  "d8-p2-spc": "inspection",
  "d8-p3-s1": "ncr",
  "d8-p3-capa": "ncr",
  "d8-p3-coq": "ncr",
  "d8-p4-s1": "material",
  "d8-p4-trace": "material",
  "d8-p5-s1": "audit",
  "d8-p5-iso": "audit",
  "d8-p6-s1": "handover",
  "d8-p6-mc": "handover",
  "d8-p6-dos": "handover",
};

const D10_TAB_BY_SUB: Record<string, HrmTab> = {
  "d10-p1-s1": "planning",
  "d10-p1-s2": "planning",
  "d10-p1-s3": "planning",
  "d10-p2-s1": "timesheet",
  "d10-p3-s1": "productivity",
  "d10-p4-s1": "crew",
  "d10-p5-s1": "onboarding",
  "d10-p6-s1": "analytics",
};

/* هر فرایند d16 دقیقاً یک تب دارد؛ زیرمرحله‌ها همان تب را باز می‌کنند. */
const D16_TAB_BY_PROCESS: Record<string, HseTab> = {
  "d16-p1": "jsa",
  "d16-p2": "permit",
  "d16-p3": "incident",
  "d16-p4": "violation",
  "d16-p5": "training",
  "d16-p6": "dashboard",
};

const D9_TAB_BY_SUB: Record<string, EqmTab> = {
  "d9-p1-s1": "fleet",
  "d9-p1-s2": "fleet",
  "d9-p2-s1": "meter",
  "d9-p3-s1": "rental",
  "d9-p4-s1": "maintenance",
  "d9-p4-s2": "maintenance",
  "d9-p4-s3": "maintenance",
  "d9-p5-s1": "productivity",
  "d9-p5-s2": "productivity",
  "d9-p5-s3": "rental",
  "d9-p6-s1": "dispatch",
  "d9-p7-s1": "fuel",
  "d9-p8-s1": "parts",
};

const D11_TAB_BY_SUB: Record<string, CkmTab> = {
  "d11-p1-s1": "correspondence",
  "d11-p1-s2": "correspondence",
  "d11-p2-s1": "meetings",
  "d11-p3-s1": "stakeholders",
  "d11-p3-s2": "stakeholders",
  "d11-p4-s1": "notifications",
  "d11-p5-s1": "knowledge",
  "d11-p6-s1": "analytics",
};

/** Extra submodules only on the d5 inner page — main sidebar untouched. */
const D5_PAGE_SUBS: Record<string, { id: string; title: Bi; tab: FinTab; sql: string[] }[]> = {
  "d5-p1": [
    { id: "d5-p1-cbs", title: { fa: "ساختار شکست هزینه و PMB", en: "CBS & PMB" }, tab: "cost", sql: ["fin_cbs_node", "fin_pmb_period"] },
    { id: "d5-p1-res", title: { fa: "ذخیره احتیاطی و اختیار برداشت", en: "Reserve & DoA" }, tab: "cost", sql: ["fin_reserve_ledger"] },
  ],
  "d5-p2": [
    { id: "d5-p2-evm", title: { fa: "EVM و پنج روش EAC", en: "EVM & five EACs" }, tab: "control", sql: ["fin_evm_snapshot"] },
    { id: "d5-p2-snap", title: { fa: "Snapshot تغییرناپذیر و نسخه فرمول", en: "Immutable snapshots" }, tab: "control", sql: ["fin_evm_snapshot"] },
  ],
  "d5-p3": [
    { id: "d5-p3-age", title: { fa: "سن مطالبات و سرمایه در گردش", en: "AR aging & working capital" }, tab: "cash", sql: ["fin_receivable", "fin_payable"] },
    { id: "d5-p3-ipc", title: { fa: "صورت‌وضعیت و کسورات", en: "Progress invoice" }, tab: "cash", sql: ["fin_progress_invoice"] },
  ],
  "d5-p4": [
    { id: "d5-p4-mrp", title: { fa: "اجرای MRP و تاریخ نیاز کالا", en: "MRP & material need date" }, tab: "pr", sql: ["fin_mrp_run"] },
    { id: "d5-p4-bud", title: { fa: "کنترل بودجه و مسیر تأیید", en: "Budget check & approval route" }, tab: "pr", sql: ["fin_pr_line"] },
  ],
  "d5-p5": [
    { id: "d5-p5-com", title: { fa: "زنجیره تعهد و عملکرد تأمین‌کننده", en: "Commitment & vendor scoring" }, tab: "po", sql: ["fin_commitment", "fin_vendor_score"] },
    { id: "d5-p5-3wm", title: { fa: "تطابق سه‌جانبه پیش از پرداخت", en: "3-way match gate" }, tab: "po", sql: ["fin_invoice_match"] },
  ],
  "d5-p6": [
    { id: "d5-p6-rop", title: { fa: "نقطه سفارش، EOQ و طبقه‌بندی ABC", en: "ROP, EOQ & ABC" }, tab: "inventory", sql: ["fin_stock_balance"] },
    { id: "d5-p6-trc", title: { fa: "ردیابی بچ و گردش انبار", en: "Batch traceability & flow" }, tab: "inventory", sql: ["fin_grn", "fin_issuance"] },
  ],
};

const D5_TAB_BY_SUB: Record<string, FinTab> = {
  "d5-p1-s1": "cost",
  "d5-p1-cbs": "cost",
  "d5-p1-res": "cost",
  "d5-p2-s1": "control",
  "d5-p2-evm": "control",
  "d5-p2-snap": "control",
  "d5-p3-s1": "cash",
  "d5-p3-age": "cash",
  "d5-p3-ipc": "cash",
  "d5-p4-s1": "pr",
  "d5-p4-mrp": "pr",
  "d5-p4-bud": "pr",
  "d5-p5-s1": "po",
  "d5-p5-com": "po",
  "d5-p5-3wm": "po",
  "d5-p6-s1": "inventory",
  "d5-p6-rop": "inventory",
  "d5-p6-trc": "inventory",
  "d5-p7-s1": "quantities",
  "d5-p7-s2": "quantities",
  "d5-p8-s1": "balance",
  "d5-p8-s2": "balance",
  "d5-p9-s1": "pnl",
  "d5-p9-s2": "pnl",
};

const D17_TAB_BY_SUB: Record<string, HseFieldTab> = {
  "d17-p1-s1": "dashboard",
  "d17-p2-s1": "incidents",
  "d17-p3-s1": "ptw",
  "d17-p4-s1": "inspections",
  "d17-p5-s1": "healthenv",
  "d17-p6-s1": "actions",
};

const D1_TAB_BY_SUB: Record<string, EdmsTab> = {
  "d1-p1-s1": "mdr",
  "d1-p1-ov": "overview",
  "d1-p1-excel": "excel",
  "d1-p1-num": "numbering",
  "d1-p2-s1": "revision",
  "d1-p2-wf": "workflow",
  "d1-p3-s1": "correspondence",
  "d1-p4-s1": "transmittal",
  "d1-p5-s1": "lessons",
};

type Props = {
  lang: Lang;
  target: ModuleNavTarget;
  onBack: () => void;
  onOpenFlowNet?: () => void;
  /** پرش به دامنه/زیرفرآیند دیگر (برای پیوندهای میان‌دامنه‌ای). */
  onNavigate?: (target: ModuleNavTarget) => void;
};

export default function ModuleDetail({ lang, target, onBack, onOpenFlowNet, onNavigate }: Props) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster } = useSystem();
  const { user, can, audit } = useAuth();
  const dom = domains.find((d) => d.id === target.moduleId);
  const cluster = clusters.find((c) => c.id === target.clusterId);
  const project = (projectsByCluster[target.clusterId] ?? []).find((p) => p.id === target.projectId);
  const [selected, setSelected] = useState<{ pId: string; sId: string } | null>(
    target.processId && target.subId ? { pId: target.processId, sId: target.subId } : null
  );

  if (!dom) return null;

  const hasAccess = dom.id === "d7" ? can("system.manage") : can("project.view", target.projectId);
  if (!hasAccess) {
    return (
      <div className="glass flex h-full min-h-0 flex-col items-center justify-center rounded-2xl p-6 text-center" dir={rtl ? "rtl" : "ltr"}>
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-rose-400/40 bg-rose-400/10 text-[24px]">🔒</div>
        <h2 className="mt-4 text-[16px] font-semibold tx1">{rtl ? "دسترسی غیرمجاز" : "Access Denied"}</h2>
        <p className="mt-2 max-w-md text-[10.5px] font-light leading-6 tx3">
          {rtl
            ? "نقش فعلی شما اجازه ورود به این حوزه یا پروژه را ندارد. برای تغییر نقش از بخش کاربر در هدر استفاده کنید."
            : "Your current role cannot access this domain or project. Use the user menu in the header to switch demo role."}
        </p>
        {user && <p className="mt-2 text-[9.5px] tx4">{user.displayName} · {roleLabel(user.role, lang)}</p>}
        <button onClick={onBack} className="mt-4 rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2 hover:tx1">
          {rtl ? "بازگشت" : "Back"}
        </button>
      </div>
    );
  }

  // Direct render for System Administration if reached
  if (dom.id === "d7" && !selected) {
    return <AdminWorkspace lang={lang} onBack={onBack} onOpenFlowNet={onOpenFlowNet} />;
  }

  const d1Tab = ((): EdmsTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D1_TAB_BY_SUB[sid]) return D1_TAB_BY_SUB[sid];
    return "overview";
  })();

  if (dom.id === "d1") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "PIM / EDMS — Excel ظرف است" : "PIM / EDMS — Excel is a vessel"}
            </div>
          </div>
        </div>

        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <DocumentWorkspace lang={lang} initialTab={d1Tab} hideTabs />
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {[
                      ...p.subs.map((s) => ({ id: s.id, title: s.title, sql: s.sql })),
                      ...(D1_PAGE_SUBS[p.id] ?? []),
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const d2Tab = ((): PexTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D2_TAB_BY_SUB[sid]) return D2_TAB_BY_SUB[sid];
    /* داشبورد مدیر پروژه به حوزهٔ پایش رفت، پس دیگر نقطهٔ ورود معقولی
     * برای این حوزه نیست. کارگاه سرِ زنجیره است و پیش‌فرض درست همان. */
    return "workshop";
  })();

  const hseTab = ((): HseFieldTab | null => {
    const sid = selected?.sId ?? target.subId;
    if (sid && HSE_TAB_BY_SUB[sid]) return HSE_TAB_BY_SUB[sid];
    return null;
  })();

  if (dom.id === "d2") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "PEX — Excel/XER ظرف است" : "PEX — Excel/XER is a vessel"}
            </div>
          </div>
        </div>

        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            {hseTab ? (
              <HseWorkspace lang={lang} initialTab={hseTab} hideTabs />
            ) : (
              <PlanningWorkspace lang={lang} initialTab={d2Tab} hideTabs />
            )}
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {[
                      ...p.subs.map((s) => ({ id: s.id, title: s.title, sql: s.sql })),
                      ...(D2_PAGE_SUBS[p.id] ?? []),
                      ...(HSE_PAGE_SUBS[p.id] ?? []),
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const d3Tab = ((): PmaTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D3_TAB_BY_SUB[sid]) return D3_TAB_BY_SUB[sid];
    return "dash";
  })();

  if (dom.id === "d3") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "PMA — فقط Approved" : "PMA — Approved only"}
            </div>
          </div>
        </div>
        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <PmaWorkspace lang={lang} initialTab={d3Tab} hideTabs />
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {[
                      ...p.subs.map((s) => ({ id: s.id, title: s.title, sql: s.sql })),
                      ...(D3_PAGE_SUBS[p.id] ?? []),
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const d4Tab = ((): D4Tab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D4_TAB_BY_SUB[sid]) return D4_TAB_BY_SUB[sid];
    return "matrix";
  })();

  if (dom.id === "d4") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "d4 — ارجاع؛ بدون بازنویسی اعداد" : "d4 — reference only; no number rewrite"}
            </div>
          </div>
        </div>
        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <RiskClaimsWorkspace lang={lang} initialTab={d4Tab} hideTabs />
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {[
                      ...p.subs.map((s) => ({ id: s.id, title: s.title, sql: s.sql })),
                      ...(D4_PAGE_SUBS[p.id] ?? []),
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const d6Tab = ((): GovTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D6_TAB_BY_SUB[sid]) return D6_TAB_BY_SUB[sid];
    return "workflow";
  })();

  const [d14View, setD14View] = useState<"contract" | "rating">(
    target.processId === "d14-p8" ? "rating" : "contract",
  );

  const d5Tab = ((): FinTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D5_TAB_BY_SUB[sid]) return D5_TAB_BY_SUB[sid];
    return "cost";
  })();

  const d8Tab = ((): QmsTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D8_TAB_BY_SUB[sid]) return D8_TAB_BY_SUB[sid];
    return "plan";
  })();

  if (dom.id === "d8") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "QMS — نقطه توقف مسدودکننده؛ تحویل بدون پانچ کلاس A" : "QMS — hold points block; no MC with open class-A punch"}
            </div>
          </div>
        </div>
        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <QualityWorkspace lang={lang} initialTab={d8Tab} hideTabs />
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {[
                      ...p.subs.map((s) => ({ id: s.id, title: s.title, sql: s.sql })),
                      ...(D8_PAGE_SUBS[p.id] ?? []),
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const d10Tab = ((): HrmTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D10_TAB_BY_SUB[sid]) return D10_TAB_BY_SUB[sid];
    return "planning";
  })();

  const d9Tab = ((): EqmTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D9_TAB_BY_SUB[sid]) return D9_TAB_BY_SUB[sid];
    return "fleet";
  })();

  /* ماژول مهندسی و طراحی — کامپوننت خودش نوار بازگشت و تب‌ها را دارد. */
  if (dom.id === "d12") {
    return <EngineeringWorkspace lang={lang} onBack={onBack} />;
  }

  /* ماژول ایمنی، بهداشت و محیط‌زیست — شش تب برابر شش فرایند d16-p1..p6،
   * پس نگاشت روی سطح فرایند است نه زیرمرحله. */
  if (dom.id === "d16") {
    const sid = selected?.sId ?? target.subId ?? "";
    const pid = sid.split("-").slice(0, 2).join("-");
    return <HSEWorkspace lang={lang} onBack={onBack} initialTab={D16_TAB_BY_PROCESS[pid]} />;
  }

  /* مدیریت پیمان و صورت‌وضعیت (d14).
   *
   * `ContractsPanel` از قبل ساخته شده بود و داخل تب «مدیریت هزینه»
   * مونت می‌شد — یعنی ۲۴ جدول، ۵۷ مسیر و ۷۴۰ آزمون پشت یک تب فرعی
   * پنهان بود و کاربر راه مستقیمی به آن نداشت.
   *
   * پنل خودش نوار بازگشت ندارد (برای مونت درون تب ساخته شده بود)، پس
   * قاب اینجا ساخته می‌شود. جای قبلی‌اش در تب هزینه دست‌نخورده ماند:
   * کسی که از مسیر مالی می‌آمد نباید مسیرش بشکند. */
  if (dom.id === "d14") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "CNT — مالک پیمان و صورت‌وضعیت؛ ثبت مالی در FIN" : "CNT — owns contract & IPC; posting lives in FIN"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {([
            ["contract", rtl ? "پیمان و صورت‌وضعیت" : "Contract & IPC"],
            ["rating", rtl ? "ارزیابی پیمانکاران و تأمین‌کنندگان" : "Contractor & Supplier Rating"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setD14View(k)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-light transition ${
                d14View === k ? "toggle-on tx1" : "tx3 hover:tx2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
            {d14View === "rating" ? <VendorRatingPanel lang={lang} /> : <ContractsPanel lang={lang} />}
          </div>
        </div>
      </div>
    );
  }

  if (dom.id === "d9") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "EQM — مالک ساعت ماشین؛ نرخ و هزینه در FIN" : "EQM — owns machine hours; rates & cost live in FIN"}
            </div>
          </div>
        </div>
        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <MachineryWorkspace lang={lang} initialTab={d9Tab} hideTabs />
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {p.subs.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (dom.id === "d10") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "HRM — هر ساعت به یک فعالیت شارژ می‌شود؛ بهره‌وری از پیشرفت تأییدشده" : "HRM — every hour charged to an activity; productivity from approved progress"}
            </div>
          </div>
        </div>
        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <WorkforceWorkspace lang={lang} initialTab={d10Tab} hideTabs />
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {[
                      ...p.subs.map((s) => ({ id: s.id, title: s.title, sql: s.sql })),
                      
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const d11Tab = ((): CkmTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D11_TAB_BY_SUB[sid]) return D11_TAB_BY_SUB[sid];
    return "correspondence";
  })();

  if (dom.id === "d11") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "CKM — اعلان قراردادی مهلت‌دار است؛ مصوبه بدون مالک و موعد پذیرفته نمی‌شود" : "CKM — notices are time-barred; no action without an owner and a due date"}
            </div>
          </div>
        </div>
        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <CommunicationWorkspace lang={lang} initialTab={d11Tab} hideTabs />
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {[
                      ...p.subs.map((s) => ({ id: s.id, title: s.title, sql: s.sql })),
                      
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (dom.id === "d5") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "FIN — تعهد پیش از هزینه؛ Snapshot تغییرناپذیر" : "FIN — commitment first; immutable snapshots"}
            </div>
          </div>
        </div>
        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <CostSupplyWorkspace lang={lang} initialTab={d5Tab} hideTabs />
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {[
                      ...p.subs.map((s) => ({ id: s.id, title: s.title, sql: s.sql })),
                      ...(D5_PAGE_SUBS[p.id] ?? []),
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (dom.id === "d6") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "GOV — حاکمیت؛ ارجاع بدون بازنویسی" : "GOV — governance; reference, no rewrite"}
            </div>
          </div>
        </div>
        <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div dir={rtl ? "rtl" : "ltr"} className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <GovernanceWorkspace lang={lang} initialTab={d6Tab} hideTabs />
          </div>
          <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {p.subs.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                          setSelected({ pId: p.id, sId: s.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === s.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const d17Tab = ((): HseFieldTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D17_TAB_BY_SUB[sid]) return D17_TAB_BY_SUB[sid];
    return "dashboard";
  })();

  if (dom.id === "d17") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
          <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
            <span className={rtl ? "" : "rotate-180"}>→</span>
            {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
          </button>
          {cluster && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                  style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
              {cluster.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {cluster && (
                <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                  {t(cluster.title, lang)}
                </h1>
              )}
              <span className="text-[16px] font-light tx4">/</span>
              {project && (
                <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
              )}
            </div>
            {project && (
              <p className="mt-1 truncate text-[10px] font-extralight tx3">
                <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
            <div className="text-[11px] font-light tx1">
              {rtl ? "HSE — TRIR از من‌اور واقعی" : "HSE — real man-hour TRIR"}
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <HseWorkspace lang={lang} initialTab={d17Tab} hideTabs />
          </div>
          <aside className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
            <div className="b-line border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                      style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                  {dom.icon}
                </span>
                <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
              {dom.processes.map((p, i) => (
                <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <span className="text-[8px] font-light tabular-nums tx4">
                      {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                    </span>
                    <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {p.subs.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: sub.id });
                          setSelected({ pId: p.id, sId: sub.id });
                        }}
                        className={`group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row ${selected?.sId === sub.id ? "row-on" : ""}`}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-light tx1">{t(sub.title, lang)}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {sub.sql.map((tbl) => (
                              <span key={tbl} className="rounded bg-sky-400/10 px-1 py-[1px] text-[7.5px] font-light text-sky-300" dir="ltr">🗄 {tbl}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <CapabilityDetail
        lang={lang}
        domainId={dom.id}
        clusterId={target.clusterId}
        projectId={target.projectId}
        processId={selected.pId}
        subId={selected.sId}
        onBack={() => setSelected(null)}
        onNavigate={({ domainId, processId, subId }) => {
          if (!onNavigate) return;
          /* دامنهٔ یکسان → فقط انتخابِ داخلی عوض می‌شود؛
             دامنهٔ دیگر → کل صفحهٔ حوزه عوض می‌شود. */
          if (domainId === dom.id) setSelected({ pId: processId, sId: subId });
          else onNavigate({
            moduleId: domainId,
            clusterId: target.clusterId,
            projectId: target.projectId,
            processId,
            subId,
          });
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* Header: back + LARGE industry/project */}
      <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
        <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
          <span className={rtl ? "" : "rotate-180"}>→</span>
          {rtl ? "بازگشت به داشبورد" : "Back to dashboard"}
        </button>

        {cluster && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
            {cluster.icon}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            {cluster && (
              <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                {t(cluster.title, lang)}
              </h1>
            )}
            <span className="text-[16px] font-light tx4">/</span>
            {project && (
              <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
            )}
          </div>
          {project && (
            <p className="mt-1 truncate text-[10px] font-extralight tx3">
              <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
            </p>
          )}
        </div>

        <div className="shrink-0 text-end">
          <div className="text-[9px] font-extralight tx3">{t(dom.title, lang)}</div>
          <div className="text-[11px] font-light tx1">
            {rtl ? "فرآیندها و زیرفرآیندها" : "Processes & Sub-processes"}
          </div>
        </div>
      </div>

      <div dir="ltr" className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Main workspace */}
        <div dir={rtl ? "rtl" : "ltr"} className="glass flex flex-1 items-center justify-center rounded-2xl text-[11px] font-extralight tx3">
          {rtl
            ? "برای مشاهده جزئیات، از سایدبار سمت راست یک زیرفرآیند را انتخاب کنید."
            : "Pick a sub-process from the right sidebar to view details."}
        </div>

        {/* Right in-page sidebar: processes → subs */}
        <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl">
          <div className="b-line border-b px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md text-[12px]"
                    style={{ background: `${dom.accent}1a`, border: `1px solid ${dom.accent}55`, color: dom.accent }}>
                {dom.icon}
              </span>
              <div className="text-[10.5px] font-normal tx1">{t(dom.title, lang)}</div>
            </div>
          </div>
          <div className="thin-scroll flex-1 overflow-y-auto p-2 space-y-2">
            {dom.processes.map((p, i) => (
              <div key={p.id} className="rounded-xl border b-line-soft bg-black/10 p-1.5">
                <div className="flex items-center gap-1.5 px-1 py-1">
                  <span className="text-[8px] font-light tabular-nums tx4">
                    {(i + 1).toLocaleString(rtl ? "fa-IR" : "en-US")}
                  </span>
                  <span className="text-[10.5px] font-normal" style={{ color: dom.accent }}>{t(p.title, lang)}</span>
                </div>
                <div className="mt-1 space-y-1">
                  {p.subs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        audit("OPEN_SUBPROCESS", { projectId: target.projectId, entity: dom.id, entityId: s.id });
                        setSelected({ pId: p.id, sId: s.id });
                      }}
                      className="group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start transition hover:-translate-y-px glass-row"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dom.accent }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] font-light tx1">{t(s.title, lang)}</div>
                      </div>
                      <span className="text-[10px] tx4 transition group-hover:accent-t">{rtl ? "←" : "→"}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="b-line-soft mt-auto border-t px-3 py-2 text-[8.5px] font-extralight tx3" dir="ltr">
            Storage: SQL Server (.\SQL2008EXPRESS)
          </div>
        </aside>
      </div>
    </div>
  );
}
