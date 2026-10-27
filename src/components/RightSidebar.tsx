import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  domains,
  sidebarGroups,
  performanceDomainsInGroup,
  ui,
  t,
  type Bi,
  type Domain,
  type Lang,
  type PerformanceDomain,
  type Process,
} from "../data/framework";
import { useSystem } from "../context/SystemContext";
import { useAuth } from "../context/AuthContext";
import { EDITABLE_TAXONOMY_DOMAINS, loadProcessTree } from "../services/taxonomyApi";
import type { MfgTab } from "./ManufacturingWorkspace";
import type { CmmsSubModuleId } from "./CmmsWorkspaceShell";
import type { ScmSubModuleId } from "./ScmWorkspaceShell";
import type { IiotSubModuleId } from "./IiotWorkspaceShell";
import type { HrmTabId } from "./HrmWorkspaceShell";
import type { EdmsTabId } from "./EdmsWorkspaceShell";

export type ModuleNavTarget = {
  moduleId: string;
  clusterId: string;
  projectId: string;
  processId?: string;
  subId?: string;
  /** پرش از نقشهٔ فرایندی (CTL) — نشانگر دکمهٔ بازگشت به نقشه. */
  fromMap?: boolean;
  /** بازگشت از ورودی‌های بین‌ماژولی به نقشهٔ برنامه‌ریزی. */
  fromPlanningMap?: boolean;
  /** نمای اولیهٔ ماژول d6 هنگام بازگشت از نقشه. */
  initialView?: "gov" | "pmo" | "ctl";
  pmoTab?: "charter" | "forms" | "health";
};

export type EnterpriseSystemView =
  | { system: "pmis" }
  | { system: "mes"; tab: MfgTab }
  | { system: "cmms"; sub: CmmsSubModuleId }
  | { system: "scm"; sub: ScmSubModuleId }
  | { system: "iiot"; sub: IiotSubModuleId }
  | { system: "hrm"; sub: HrmTabId }
  | { system: "edms"; sub: EdmsTabId };

type Props = {
  lang: Lang;
  quickAction: string;
  onQuickAction: (id: string) => void;
  onNavigate: (target: ModuleNavTarget) => void;
  activeSystemView?: EnterpriseSystemView;
  onSelectSystemView?: (view: EnterpriseSystemView) => void;
};

/* زیرماژول‌های سرگروه دوم: برنامه‌ریزی و کنترل تولید (MES) */
const MES_SIDEBAR_ITEMS: Array<{ id: MfgTab; icon: string; label: Bi }> = [
  { id: "engineering", icon: "🔩", label: { fa: "مهندسی تولید", en: "Manufacturing Engineering" } },
  { id: "orders", icon: "📋", label: { fa: "سفارشات تولید", en: "Production Orders" } },
  { id: "scheduling", icon: "📅", label: { fa: "زمان‌بندی و ظرفیت", en: "Scheduling & Capacity" } },
  { id: "execution", icon: "⚙️", label: { fa: "اجرای کارگاهی و پایش", en: "Shop-Floor Execution" } },
  { id: "mrp", icon: "📦", label: { fa: "مواد و MRP", en: "Materials & MRP" } },
  { id: "cost", icon: "💰", label: { fa: "هزینه‌یابی تولید", en: "Production Costing" } },
  { id: "overview", icon: "📊", label: { fa: "داشبورد و OEE", en: "Dashboard & OEE" } },
];

/* سرگروه سوم: نگهداری و تعمیرات (CMMS) — در سایدبار اصلی فقط ۵ ماژول
 * اصلی و روزمره می‌نشیند تا زیرمنو خلوت بماند. باقی زیرماژول‌ها حذف
 * نشده‌اند؛ در سایدبار داخلی خود ماژول CMMS، دسته‌بندی‌شده زیر
 * CMMS_GROUPS در CmmsWorkspaceShell در دسترس‌اند. */
const CMMS_SIDEBAR_ITEMS: Array<{ id: CmmsSubModuleId; icon: string; label: Bi }> = [
  { id: "dashboard", icon: "📊", label: { fa: "داشبورد مدیریت نت", en: "Maintenance Dashboard" } },
  { id: "workflow", icon: "🗺️", label: { fa: "نقشهٔ گردش‌کار نت", en: "Maintenance Workflow Map" } },
  { id: "assets", icon: "🏷️", label: { fa: "شناسنامه تجهیزات و دارایی‌ها", en: "Equipment & Asset Registry" } },
  { id: "pm", icon: "🗓️", label: { fa: "برنامه‌ریزی نت پیشگیرانه", en: "Preventive Maintenance Planning" } },
  { id: "work-orders", icon: "🛠️", label: { fa: "درخواست‌کار و دستورکار", en: "Work Requests & Orders" } },
];

/* زیرماژول‌های سرگروه چهارم: زنجیره تأمین، بازرگانی و مالی (SCM & Finance) */
const SCM_SIDEBAR_ITEMS: Array<{ id: ScmSubModuleId; icon: string; label: Bi }> = [
  { id: "inventory", icon: "🏬", label: { fa: "مدیریت انبارها و موجودی", en: "Warehouses & Inventory" } },
  { id: "purchasing", icon: "🧾", label: { fa: "درخواست و سفارشات خرید", en: "Purchase Requisitions & POs" } },
  { id: "crm", icon: "🤝", label: { fa: "فروش و مدیریت مشتریان (CRM)", en: "Sales & CRM" } },
  { id: "movements", icon: "🚚", label: { fa: "ورود و خروج کالا (رسید / حواله)", en: "Goods Receipt & Issue" } },
  { id: "finance", icon: "💳", label: { fa: "حسابداری و هزینه‌یابی مالی", en: "Financial Accounting & Costing" } },
];

/* زیرماژول‌های سرگروه پنجم: پایش میدانی و اینترنت اشیاء (IIoT & DAS) */
const IIOT_SIDEBAR_ITEMS: Array<{ id: IiotSubModuleId; icon: string; label: Bi }> = [
  { id: "dashboard", icon: "📊", label: { fa: "داشبورد IIoT", en: "IIoT Dashboard" } },
  { id: "drilling-das", icon: "📡", label: { fa: "پایش زنده حفاری و عملیات (Drilling DAS)", en: "Live Drilling & Operations (Drilling DAS)" } },
  { id: "iot-devices", icon: "🛰️", label: { fa: "مدیریت سنسورها و تجهیزات IoT", en: "IoT Sensors & Devices Management" } },
  { id: "condition-monitoring", icon: "🌡️", label: { fa: "پایش آنلاین شرایط محیطی و تجهیزات", en: "Online Environmental & Condition Monitoring" } },
  { id: "sensor-alerts", icon: "🚨", label: { fa: "سیستم هشدار بلادرنگ سنسورها", en: "Real-Time Sensor Alert System" } },
];

/* زیرماژول‌های سرگروه ششم: مدیریت جامع منابع انسانی (HRM — ISO 30414 & قوانین کار) */
const HRM_SIDEBAR_ITEMS: Array<{ id: HrmTabId; icon: string; label: Bi }> = [
  { id: "personnel", icon: "👥", label: { fa: "پرسنلی، چارت و ماتریس مهارت", en: "Personnel, Org Chart & Skill Matrix" } },
  { id: "attendance", icon: "⏱️", label: { fa: "حضور و غیاب و شیفت‌بندی", en: "Attendance & Shift Rosters" } },
  { id: "payroll", icon: "💵", label: { fa: "حقوق و دستمزد و تسهیم هزینه", en: "Payroll & Cost Allocation" } },
  { id: "training", icon: "🎓", label: { fa: "آموزش و توسعه صلاحیت (ISO 10015)", en: "Training & Competency" } },
  { id: "performance", icon: "🎯", label: { fa: "ارزیابی عملکرد ۳۶۰ درجه (KPI/OKR)", en: "360° Performance Management" } },
];

/* زیرماژول‌های سرگروه هفتم: مدیریت اسناد، بایگانی دیجیتال و مدیریت دانش (EDMS / KMS) */
const EDMS_SIDEBAR_ITEMS: Array<{ id: EdmsTabId; icon: string; label: Bi }> = [
  { id: "dmi", icon: "🗂️", label: { fa: "شناسنامه اسناد (DMI) و کدینگ", en: "Document Master Index & Coding" } },
  { id: "revisions", icon: "🔒", label: { fa: "کنترل نسخه‌ها و Check-In/Out", en: "Revision Control & Check-In/Out" } },
  { id: "workflows", icon: "📨", label: { fa: "گردش‌کار تأیید و ترانسمیتال", en: "Approval Workflows & Transmittals" } },
  { id: "archive", icon: "🔍", label: { fa: "بایگانی دیجیتال، OCR و جستجو", en: "Digital Archive, OCR & Search" } },
  { id: "kms", icon: "🧠", label: { fa: "مدیریت دانش و ویکی (KMS)", en: "Knowledge Management & Wiki" } },
];

type QuickAction = { id: string; label: Bi; alert?: string; icon: ReactNode };

const iconClass = "h-4 w-4";

const moduleDataGaps: Record<string, string[]> = {
  d1: ["c3"], d2: [], d3: ["c5"], d4: ["c2", "c3"], d5: ["c4"], d6: [], d8: [], d7: [], d17: [],
};

const quickActions: QuickAction[] = [
  { id: "home", label: { fa: "خانه", en: "Home" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></svg>) },
  { id: "portfolio", label: { fa: "پورتفولیو", en: "Portfolio" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></svg>) },
  { id: "reports", label: { fa: "گزارش عملکرد", en: "Reports" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={iconClass}><path d="M5 20V10M10 20V4M15 20v-7M20 20V7" /></svg>) },
  { id: "alerts", label: { fa: "هشدارها", en: "Alerts" }, alert: "7", icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>) },
  { id: "calendar", label: { fa: "تقویم و کارها", en: "Calendar & Tasks" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>) },
  { id: "calc", label: { fa: "محاسبات", en: "Calculations" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M13 11h4M13 15h4M13 7h4" /></svg>) },
  { id: "excellence", label: { fa: "تعالی", en: "Excellence" }, icon: <span className="text-[15px] leading-none">🏅</span> },
  { id: "specialty", label: { fa: "ماژول‌های تخصصی", en: "Specialty Modules" }, icon: <span className="text-[15px] leading-none">🧩</span> },
];

const selectClass =
  "w-full rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10.5px] font-light tx1 outline-none transition focus:border-[var(--accent)]";

/* گروه‌هایی که در فاز نمایشی، لایهٔ ۲ (حوزهٔ عملکردی) در سایدبار اصلی دارند:
 * «آغازین» (حاکمیت)، «برنامه‌ریزی» (زمان‌بندی/محدوده)، «اجرا»
 * (مالی/منابع/افزونه‌های صنعتی)، «پایش و کنترل» (مالی/ریسک/افزونه‌های صنعتی)،
 * «اختتامیه» (محدوده) و «پشتیبان» (ذی‌نفعان/افزونه‌های صنعتی). */
const PERF_NAV_GROUPS = new Set(["pg1", "pg2", "pg3", "pg4", "pg5", "support"]);

export default function RightSidebar({
  lang,
  quickAction,
  onQuickAction,
  onNavigate,
  activeSystemView = { system: "pmis" },
  onSelectSystemView,
}: Props) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster, projectScope } = useSystem();
  const { can, user } = useAuth();
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [selCluster, setSelCluster] = useState<string>(() => projectScope?.clusterId ?? "");
  const [selProject, setSelProject] = useState<string>(() => projectScope?.projectId ?? "");
  /* گروه‌های داخلی PMIS هم در هر نشست بسته شروع می‌شوند؛ وضعیت بازشدهٔ
   * قبلی ذخیره/بازیابی نمی‌شود تا رفرش، گروهی را خودکار باز نکند. */
  const [groupState, setGroupState] = useState<{ open: string | null; supportOpen: boolean }>({
    open: null,
    supportOpen: false,
  });
  const [query, setQuery] = useState("");
  /* لایهٔ ۲: کدام حوزهٔ عملکردی (زیر گروه فرایندی) باز است — فاز نمایشی روی «آغازین». */
  const [openPerf, setOpenPerf] = useState<string | null>(null);
  const [specialtyQuickOpen, setSpecialtyQuickOpen] = useState(false);
  const [taxonomyOverrides, setTaxonomyOverrides] = useState<Record<string, Process[]>>({});
  const [sectionsOpen, setSectionsOpen] = useState<{
    pmis: boolean;
    org: boolean;
    mes: boolean;
    cmms: boolean;
    scm: boolean;
    iiot: boolean;
    hrm: boolean;
    edms: boolean;
  }>({
    pmis: false,
    org: false,
    mes: false,
    cmms: false,
    scm: false,
    iiot: false,
    hrm: false,
    edms: false,
  });

  const toggleSection = (key: "pmis" | "org" | "mes" | "cmms" | "scm" | "iiot" | "hrm" | "edms") => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openGroup = groupState.open;
  const supportOpen = groupState.supportOpen;

  useEffect(() => {
    if (!projectScope) return;
    setSelCluster(projectScope.clusterId);
    setSelProject(projectScope.projectId);
  }, [projectScope]);

  useEffect(() => {
    let alive = true;
    const projectId = projectScope?.projectId;
    /* GOV-1: خواندن ساختار فرایند مجوز `gov.process.view` می‌خواهد و بی‌آن،
       سرور ۴۰۳ می‌دهد. پس فقط دارندهٔ مجوز ویرایش درخواست می‌فرستد. */
    if (!projectId || !can("gov.process.edit", projectId)) {
      setTaxonomyOverrides({});
      return () => { alive = false; };
    }
    (async () => {
      const entries = await Promise.all(
        EDITABLE_TAXONOMY_DOMAINS.map(async (domainId) => [domainId, await loadProcessTree(projectId, domainId, user?.id)] as const),
      );
      if (!alive) return;
      const next: Record<string, Process[]> = {};
      for (const [domainId, processes] of entries) if (processes) next[domainId] = processes;
      setTaxonomyOverrides(next);
    })();
    return () => { alive = false; };
  }, [projectScope?.projectId, can, user?.id]);

  useEffect(() => {
    const onTaxonomyUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; domainId?: string; processes?: Process[] }>).detail;
      if (!detail?.projectId || detail.projectId !== projectScope?.projectId || !detail.domainId || !Array.isArray(detail.processes)) return;
      setTaxonomyOverrides((prev) => ({ ...prev, [detail.domainId!]: detail.processes! }));
    };
    window.addEventListener("pmis:taxonomy-updated", onTaxonomyUpdated);
    return () => window.removeEventListener("pmis:taxonomy-updated", onTaxonomyUpdated);
  }, [projectScope?.projectId]);

  const toggleDomain = (id: string) => {
    onSelectSystemView?.({ system: "pmis" });
    // System administration is global; it never requires an industry/project context.
    if (id === "d7") {
      onNavigate({ moduleId: "d7", clusterId: "", projectId: "" });
      return;
    }
    setOpenDomain((prev) => (prev === id ? null : id));
    setSelCluster(projectScope?.clusterId ?? "");
    setSelProject(projectScope?.projectId ?? "");
  };

  const toggleGroup = (id: string, pinned?: boolean) => {
    onSelectSystemView?.({ system: "pmis" });
    if (pinned) {
      setGroupState((s) => ({ ...s, supportOpen: !s.supportOpen }));
    } else {
      setGroupState((s) => ({ ...s, open: s.open === id ? null : id }));
    }
  };

  const noData = openDomain && selCluster ? (moduleDataGaps[openDomain] ?? []).includes(selCluster) : false;
  const clusterProjects = selCluster && !noData ? projectsByCluster[selCluster] ?? [] : [];
  const canEnter = Boolean(openDomain && selCluster && selProject && !noData);

  /* مدیریت سامانه فقط برای نقش مجاز؛ گروه خالی‌شده خودبه‌خود پنهان می‌شود. */
  const visibleDomains = domains
    .filter((d) => d.id !== "d7" || can("system.manage"))
    .map((d) => taxonomyOverrides[d.id] ? { ...d, processes: taxonomyOverrides[d.id] } : d);
  const specialtyModules = visibleDomains.filter((d) => ["d8", "d16", "d17", "d18"].includes(d.id));

  const q = query.trim().toLowerCase();
  const matchesQuery = (d: Domain) => {
    if (!q) return true;
    const hay = [
      d.id,
      d.title.fa, d.title.en,
      ...(d.nav ? [d.nav.fa, d.nav.en] : []),
      ...d.processes.flatMap((p) => [p.id, p.title.fa, p.title.en, ...p.subs.flatMap((s) => [s.id, s.title.fa, s.title.en])]),
    ].join(" ").toLowerCase();
    return q.split(/\s+/).every((part) => hay.includes(part));
  };
  const searching = q.length > 0;
  const searchHits = searching ? visibleDomains.filter(matchesQuery) : [];

  /* سطر دامنه عمداً کارت نیست: فهرست فشرده با جداکنندهٔ مویی.
   * حالت باز فقط با ته‌مایهٔ رنگ دامنه مشخص می‌شود. */
  const renderDomain = (d: Domain) => {
    const domainOpen = openDomain === d.id;
    return (
      <div key={d.id} className="border-b b-line-soft last:border-b-0">
        {/* Domain row (level 1) */}
        <button
          type="button"
          onClick={() => toggleDomain(d.id)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition hover:bg-[var(--row-hover)]"
          style={domainOpen ? { background: `${d.accent}14` } : undefined}
          aria-expanded={d.id === "d7" ? undefined : domainOpen}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center text-[15px]">{d.icon}</span>
          <h3
            className="min-w-0 flex-1 truncate text-[11px] font-normal leading-4"
            style={{ color: d.accent }}
            title={t(d.title, lang)}
          >
            {t(d.nav ?? d.title, lang)}
          </h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
               className={`h-3 w-3 shrink-0 tx4 transition-transform ${domainOpen ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {domainOpen && (
          <div className="fade-rise mt-1 space-y-1">
            {/* Level 2 — processes */}
            <div className="rounded-xl border b-line-soft bg-black/10 p-2 space-y-1">
              {/* فرایندها فهرست می‌شوند ولی باز نمی‌شوند.
                *
                * زیرفرایندها در صفحهٔ بعد، در سایدبار فرعی
                * `ModuleDetail` انتخاب می‌شوند؛ باز کردن دوبارهٔ
                * همان درخت اینجا فقط یک کلیک اضافه بود. */}
              {d.processes.map((p) => (
                <div key={p.id}>
                  <div className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start">
                    <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: d.accent, opacity: 0.5 }} />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-light tx2">{t(p.title, lang)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mini navigation card */}
            <div className="glass rounded-xl p-3" style={{ borderColor: `${d.accent}55` }}>
              <div className="mb-2 flex items-center gap-1.5">
                <i className="h-1.5 w-1.5 rounded-full" style={{ background: d.accent }} />
                <span className="text-[9.5px] font-normal tx2">
                  {rtl ? "ورود سریع به این حوزه" : "Quick enter this domain"}
                </span>
              </div>

              <label className="mb-2 block">
                <span className="mb-1 block text-[9px] font-extralight tx3">
                  {rtl ? "۱) انتخاب صنعت" : "1) Industry"}
                </span>
                <select value={selCluster} onChange={(e) => { setSelCluster(e.target.value); setSelProject(""); }} className={selectClass} style={{ colorScheme: "dark" }}>
                  <option value="">{rtl ? "— انتخاب کنید —" : "— choose —"}</option>
                  {clusters.map((c) => (<option key={c.id} value={c.id}>{t(c.title, lang)}</option>))}
                </select>
              </label>

              {noData && (
                <div className="fade-rise mb-2 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-2">
                  <span className="text-[12px] leading-none">⚠️</span>
                  <span className="text-[9.5px] font-light leading-4 text-amber-400">
                    {rtl ? "این صنعت برای این حوزه اطلاعاتی ثبت‌شده ندارد." : "No data registered for this industry in this domain."}
                  </span>
                </div>
              )}

              <label className="mb-2.5 block">
                <span className="mb-1 block text-[9px] font-extralight tx3">
                  {rtl ? "۲) انتخاب پروژه" : "2) Project"}
                </span>
                <select value={selProject} onChange={(e) => setSelProject(e.target.value)} disabled={!selCluster || noData}
                        className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-40`} style={{ colorScheme: "dark" }}>
                  <option value="">
                    {!selCluster ? (rtl ? "ابتدا صنعت را انتخاب کنید" : "Pick an industry first")
                      : noData ? (rtl ? "اطلاعاتی موجود نیست" : "No data available")
                        : (rtl ? "— انتخاب کنید —" : "— choose —")}
                  </option>
                  {clusterProjects.map((p) => (<option key={p.id} value={p.id}>{p.code} · {t(p.name, lang)}</option>))}
                </select>
              </label>

              <button
                type="button"
                disabled={!canEnter}
                onClick={() => canEnter && onNavigate({ moduleId: d.id, clusterId: selCluster, projectId: selProject })}
                className="w-full rounded-lg px-3 py-2 text-[10.5px] font-normal transition disabled:cursor-not-allowed disabled:opacity-35"
                style={{ background: canEnter ? `${d.accent}22` : "var(--row)", border: `1px solid ${canEnter ? d.accent : "var(--line-soft)"}`, color: canEnter ? d.accent : "var(--ink4)" }}
              >
                {rtl ? "ورود به صفحه حوزه ←" : "Enter domain page →"}
              </button>

              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border b-line-soft bg-black/10 px-2 py-1.5">
                <span className="pulse-dot h-[6px] w-[6px] shrink-0 rounded-full bg-emerald-400" />
                <span className="text-[8.5px] font-extralight tx3">{rtl ? "محل ذخیره‌سازی:" : "Storage:"}</span>
                <span className="truncate text-[8.5px] font-light ok-dim-t" dir="ltr">SQL Server (.\SQL2008EXPRESS)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── لایهٔ ۲ — حوزهٔ عملکردی (زیر گروه فرایندی) ──
   * ماژول‌های این حوزه (لایهٔ ۳) در سایدبار فرعیِ صفحهٔ ماژول
   * فهرست می‌شوند؛ اینجا فقط انتخابِ ورود انجام می‌شود. */
  const renderPerfDomain = (pd: PerformanceDomain & { modules: Domain[] }, groupId?: string) => {
    const isOpen = openPerf === pd.id;
    const title = pd.id === "extension" && groupId === "pg3"
      ? { fa: "مدیریت ایمنی و بهداشت", en: "Health & Safety Management" }
      : pd.id === "extension" && groupId === "pg4"
        ? { fa: "مدیریت کیفیت و بازرسی", en: "Quality & Inspection Management" }
        : pd.id === "scope" && groupId === "pg5"
          ? { fa: "مدیریت راه‌اندازی", en: "Commissioning Management" }
          : pd.title;
    const first = pd.modules[0];
    const pdNoData = selCluster ? (moduleDataGaps[first.id] ?? []).includes(selCluster) : false;
    const canEnter = Boolean(selCluster && selProject && !pdNoData);
    return (
      <div key={pd.id} className="border-b b-line-soft pb-1 last:border-b-0 last:pb-0">
        <button
          type="button"
          onClick={() => { setOpenPerf(isOpen ? null : pd.id); onSelectSystemView?.({ system: "pmis" }); }}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition hover:bg-[var(--row-hover)]"
          style={isOpen ? { background: `${pd.color}14` } : undefined}
        >
          <span className="shrink-0 text-[12px] leading-none">{pd.icon}</span>
          <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium" style={{ color: pd.color }}>
            {t(title, lang)}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3 w-3 shrink-0 tx4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {isOpen && (
          <div className="fade-rise mt-1 space-y-1">
            <div className="glass rounded-xl p-3" style={{ borderColor: `${pd.color}55` }}>
              <div className="mb-2 flex items-center gap-1.5">
                <i className="h-1.5 w-1.5 rounded-full" style={{ background: pd.color }} />
                <span className="text-[9.5px] font-normal tx2">
                  {rtl ? "ورود به ماژول‌های این حوزه" : "Enter the modules of this domain"}
                </span>
              </div>

              <label className="mb-2 block">
                <span className="mb-1 block text-[9px] font-extralight tx3">
                  {rtl ? "۱) انتخاب صنعت" : "1) Industry"}
                </span>
                <select value={selCluster} onChange={(e) => { setSelCluster(e.target.value); setSelProject(""); }} className={selectClass} style={{ colorScheme: "dark" }}>
                  <option value="">{rtl ? "— انتخاب کنید —" : "— choose —"}</option>
                  {clusters.map((c) => (<option key={c.id} value={c.id}>{t(c.title, lang)}</option>))}
                </select>
              </label>

              {pdNoData && (
                <div className="fade-rise mb-2 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-2">
                  <span className="text-[12px] leading-none">⚠️</span>
                  <span className="text-[9.5px] font-light leading-4 text-amber-400">
                    {rtl ? "این صنعت برای این حوزه اطلاعاتی ثبت‌شده ندارد." : "No data registered for this industry in this domain."}
                  </span>
                </div>
              )}

              <label className="mb-2.5 block">
                <span className="mb-1 block text-[9px] font-extralight tx3">
                  {rtl ? "۲) انتخاب پروژه" : "2) Project"}
                </span>
                <select value={selProject} onChange={(e) => setSelProject(e.target.value)} disabled={!selCluster || pdNoData}
                        className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-40`} style={{ colorScheme: "dark" }}>
                  <option value="">
                    {!selCluster ? (rtl ? "ابتدا صنعت را انتخاب کنید" : "Pick an industry first")
                      : pdNoData ? (rtl ? "اطلاعاتی موجود نیست" : "No data available")
                        : (rtl ? "— انتخاب کنید —" : "— choose —")}
                  </option>
                  {clusterProjects.map((p) => (<option key={p.id} value={p.id}>{p.code} · {t(p.name, lang)}</option>))}
                </select>
              </label>

              <button
                type="button"
                disabled={!canEnter}
                onClick={() => canEnter && onNavigate({ moduleId: first.id, clusterId: selCluster, projectId: selProject })}
                className="w-full rounded-lg px-3 py-2 text-[10.5px] font-normal transition disabled:cursor-not-allowed disabled:opacity-35"
                style={{ background: canEnter ? `${pd.color}22` : "var(--row)", border: `1px solid ${canEnter ? pd.color : "var(--line-soft)"}`, color: canEnter ? pd.color : "var(--ink4)" }}
              >
                {rtl ? "ورود به صفحهٔ ماژول ←" : "Enter module page →"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sidebar-dock context-sidebar">
    <div className="sidebar-panel">
    <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex h-full min-h-0 w-full flex-col rounded-2xl">
      <header className="b-line border-b px-4 pb-3 pt-3.5">
        {/* لوگوتایپ خلوت بالای جست‌وجو: فقط نشان کوچک + نام برند، صرفاً انگلیسی،
            هم‌تراز با ابتدای سایدبار (نه وسط‌چین) و بدون هیچ tooltip/باکس
            شناوری روی هاور — آمار حوزه/فرآیند این‌جا نمایش داده نمی‌شود. */}
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="accent-t grid h-6 w-6 shrink-0 select-none place-items-center rounded-[7px] text-[11px] font-bold leading-none"
            style={{ background: "var(--accent-soft)", boxShadow: "inset 0 0 0 1px var(--line-soft)" }}
          >
            A
          </span>
          <h2 dir="ltr" className="whitespace-nowrap text-[12.5px] font-semibold leading-6 tracking-tight tx1">
            {t(ui.frameworkTitle, lang)}
          </h2>
        </div>

        {/* جست‌وجوی زندهٔ حوزه / فرآیند / زیرفرآیند */}
        <div className="relative mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={rtl ? "جست‌وجوی حوزه / فرآیند…" : "Search domains / processes…"}
            className="w-full rounded-lg border b-line-soft bg-black/20 px-2.5 py-1.5 pe-7 text-[10.5px] font-light tx1 outline-none transition placeholder:tx4 focus:border-[var(--accent)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={rtl ? "پاک کردن جست‌وجو" : "Clear search"}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded px-1 text-[11px] tx4 transition hover:tx1"
            >
              ✕
            </button>
          )}
        </div>

      </header>

      <div className="thin-scroll flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {searching ? (
          searchHits.length ? (
            searchHits.map(renderDomain)
          ) : (
            <div className="rounded-xl border b-line-soft bg-black/10 px-3 py-6 text-center text-[10.5px] font-light tx3">
              {rtl ? "نتیجه‌ای برای این جست‌وجو نیست." : "No results for this search."}
            </div>
          )
        ) : (
          <>
            {/* ── ۱. سرگروه اصلی اول: مدیریت و کنترل پروژه (PMIS) ── */}
            <section className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("pmis")}
                aria-expanded={sectionsOpen.pmis}
                className="sidebar-group-title flex w-full items-center gap-2 px-2 py-2 text-start tx2 transition hover:tx1"
              >
                <span className="text-[12px]">📐</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  {rtl ? "مدیریت و کنترل پروژه" : "Project Management & Control"}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3 w-3 shrink-0 tx4 transition-transform ${sectionsOpen.pmis ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {sectionsOpen.pmis && (
                <div className="fade-rise space-y-1 border-s-2 border-sky-500/30 ps-2 pt-0.5">
                  {sidebarGroups.filter((g) => g.id !== "org").map((g) => {
                    const members = visibleDomains.filter((d) => d.group === g.id);
                    if (!members.length) return null;
                    const isOpen = g.pinned ? supportOpen : openGroup === g.id;
                    return (
                      <div key={g.id} className="border-b b-line-soft pb-1 last:border-b-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.id, g.pinned)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition hover:bg-[var(--row-hover)]"
                          style={isOpen ? { background: `${g.color}14` } : undefined}
                        >
                          <span className="shrink-0 text-[12px] leading-none">{g.icon}</span>
                          <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium" style={{ color: g.color }}>
                            {t(g.title, lang)}
                          </span>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`h-3 w-3 shrink-0 tx4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>

                        {isOpen && (
                          <div className="fade-rise mt-1 border-s-2 ps-2" style={{ borderColor: `${g.color}33` }}>
                            {/* لایهٔ ۲ (حوزهٔ عملکردی) زیر گروه‌های فاز نمایشی */}
                            {PERF_NAV_GROUPS.has(g.id)
                              ? performanceDomainsInGroup(g.id)
                                /* ماژول‌هایی که کاربر حق دیدنشان را ندارد
                                 * (مثل d7 که فقط مدیر سامانه می‌بیند) از شمارش و
                                 * ورودِ حوزه کنار گذاشته می‌شوند. */
                                .map((pd) => ({
                                  ...pd,
                                  modules: pd.modules.filter((m) => visibleDomains.some((v) => v.id === m.id)),
                                }))
                                .filter((pd) => pd.modules.length > 0)
                                .map((pd) => renderPerfDomain(pd, g.id))
                              : members.map(renderDomain)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <div role="separator" aria-orientation="horizontal" className="my-2 flex items-center gap-2 px-1">
              <span className="hair h-px flex-1" />
              <span className="hair h-px flex-1" />
            </div>

            {/* ── ۲. سرگروه اصلی دوم: برنامه‌ریزی و کنترل تولید (MES) ── */}
            <section className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("mes")}
                aria-expanded={sectionsOpen.mes}
                className={`sidebar-group-title flex w-full items-center gap-2 px-2 py-2 text-start transition ${
                  activeSystemView.system === "mes" ? "is-active" : "tx2 hover:tx1"
                }`}
              >
                <span className="text-[12px]">🏭</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  {rtl ? "برنامه‌ریزی و کنترل تولید" : "Manufacturing Execution"}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3 w-3 shrink-0 tx4 transition-transform ${sectionsOpen.mes ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {sectionsOpen.mes && (
                <div className="fade-rise space-y-0.5 border-s-2 border-emerald-500/30 ps-2 pt-0.5">
                  {MES_SIDEBAR_ITEMS.map((item) => {
                    const active = activeSystemView.system === "mes" && activeSystemView.tab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectSystemView?.({ system: "mes", tab: item.id })}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[10.5px] transition ${
                          active
                            ? "row-on font-medium text-emerald-300"
                            : "tx2 hover:bg-[var(--row-hover)] hover:tx1"
                        }`}
                      >
                        <span className="text-[11px]">{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{t(item.label, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── خط جداکنندهٔ بصری (Divider) بین بخش ۲ و ۳ ── */}
            <div role="separator" aria-orientation="horizontal" className="my-2 flex items-center gap-2 px-1">
              <span className="hair h-px flex-1" />
              <span className="hair h-px flex-1" />
            </div>

            {/* ── ۳. سرگروه اصلی سوم: نگهداری و تعمیرات (CMMS) ── */}
            <section className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("cmms")}
                aria-expanded={sectionsOpen.cmms}
                className={`sidebar-group-title flex w-full items-center gap-2 px-2 py-2 text-start transition ${
                  activeSystemView.system === "cmms" ? "is-active" : "tx2 hover:tx1"
                }`}
              >
                <span className="text-[12px]">🔧</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  {rtl ? "نگهداری و تعمیرات" : "Maintenance Management"}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3 w-3 shrink-0 tx4 transition-transform ${sectionsOpen.cmms ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {sectionsOpen.cmms && (
                <div className="fade-rise space-y-0.5 border-s-2 border-amber-500/30 ps-2 pt-0.5">
                  {CMMS_SIDEBAR_ITEMS.map((item) => {
                    const active = activeSystemView.system === "cmms" && activeSystemView.sub === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectSystemView?.({ system: "cmms", sub: item.id })}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[10.5px] transition ${
                          active
                            ? "row-on font-medium text-amber-300"
                            : "tx2 hover:bg-[var(--row-hover)] hover:tx1"
                        }`}
                      >
                        <span className="text-[11px]">{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{t(item.label, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── خط جداکنندهٔ بصری (Divider) بین بخش ۳ و ۴ ── */}
            <div role="separator" aria-orientation="horizontal" className="my-2 flex items-center gap-2 px-1">
              <span className="hair h-px flex-1" />
              <span className="hair h-px flex-1" />
            </div>

            {/* ── ۴. سرگروه اصلی چهارم: زنجیره تأمین، بازرگانی و مالی (SCM & Finance) ── */}
            <section className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("scm")}
                aria-expanded={sectionsOpen.scm}
                className={`sidebar-group-title flex w-full items-center gap-2 px-2 py-2 text-start transition ${
                  activeSystemView.system === "scm" ? "is-active" : "tx2 hover:tx1"
                }`}
              >
                <span className="text-[12px]">📦</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  {rtl ? "زنجیره تأمین، بازرگانی و مالی" : "Supply Chain, Commercial & Finance"}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3 w-3 shrink-0 tx4 transition-transform ${sectionsOpen.scm ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {sectionsOpen.scm && (
                <div className="fade-rise space-y-0.5 border-s-2 border-teal-500/30 ps-2 pt-0.5">
                  {SCM_SIDEBAR_ITEMS.map((item) => {
                    const active = activeSystemView.system === "scm" && activeSystemView.sub === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectSystemView?.({ system: "scm", sub: item.id })}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[10.5px] transition ${
                          active
                            ? "row-on font-medium text-teal-300"
                            : "tx2 hover:bg-[var(--row-hover)] hover:tx1"
                        }`}
                      >
                        <span className="text-[11px]">{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{t(item.label, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── خط جداکنندهٔ بصری (Divider) بین بخش ۴ و ۵ ── */}
            <div role="separator" aria-orientation="horizontal" className="my-2 flex items-center gap-2 px-1">
              <span className="hair h-px flex-1" />
              <span className="hair h-px flex-1" />
            </div>

            {/* ── ۵. سرگروه اصلی پنجم: پایش میدانی و اینترنت اشیاء (IIoT & DAS) ── */}
            <section className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("iiot")}
                aria-expanded={sectionsOpen.iiot}
                className={`sidebar-group-title flex w-full items-center gap-2 px-2 py-2 text-start transition ${
                  activeSystemView.system === "iiot" ? "is-active" : "tx2 hover:tx1"
                }`}
              >
                <span className="text-[12px]">📡</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  {rtl ? "پایش میدانی و اینترنت اشیاء" : "Field Monitoring & Industrial IoT"}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3 w-3 shrink-0 tx4 transition-transform ${sectionsOpen.iiot ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {sectionsOpen.iiot && (
                <div className="fade-rise space-y-0.5 border-s-2 border-purple-500/30 ps-2 pt-0.5">
                  {IIOT_SIDEBAR_ITEMS.map((item) => {
                    const active = activeSystemView.system === "iiot" && activeSystemView.sub === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectSystemView?.({ system: "iiot", sub: item.id })}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[10.5px] transition ${
                          active
                            ? "row-on font-medium text-purple-300"
                            : "tx2 hover:bg-[var(--row-hover)] hover:tx1"
                        }`}
                      >
                        <span className="text-[11px]">{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{t(item.label, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── خط جداکنندهٔ بصری (Divider) بین بخش ۵ و ۶ (لایهٔ ۲ ستون پشتیبان ۵+۲) ── */}
            <div role="separator" aria-orientation="horizontal" className="my-2 flex items-center gap-2 px-1">
              <span className="hair h-px flex-1" />
              <span className="hair h-px flex-1" />
            </div>

            {/* ── ۶. سرگروه اصلی ششم: مدیریت جامع منابع انسانی (HRM — ISO 30414 & قوانین کار) ── */}
            <section className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("hrm")}
                aria-expanded={sectionsOpen.hrm}
                className={`sidebar-group-title flex w-full items-center gap-2 px-2 py-2 text-start transition ${
                  activeSystemView.system === "hrm" ? "is-active" : "tx2 hover:tx1"
                }`}
              >
                <span className="text-[12px]">👥</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  {rtl ? "مدیریت منابع انسانی و کارکرد" : "Human Resource Management"}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3 w-3 shrink-0 tx4 transition-transform ${sectionsOpen.hrm ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {sectionsOpen.hrm && (
                <div className="fade-rise space-y-0.5 border-s-2 border-teal-500/30 ps-2 pt-0.5">
                  {HRM_SIDEBAR_ITEMS.map((item) => {
                    const active = activeSystemView.system === "hrm" && activeSystemView.sub === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectSystemView?.({ system: "hrm", sub: item.id })}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[10.5px] transition ${
                          active
                            ? "row-on font-medium text-teal-300"
                            : "tx2 hover:bg-[var(--row-hover)] hover:tx1"
                        }`}
                      >
                        <span className="text-[11px]">{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{t(item.label, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── خط جداکنندهٔ بصری (Divider) بین بخش ۶ و ۷ ── */}
            <div role="separator" aria-orientation="horizontal" className="my-2 flex items-center gap-2 px-1">
              <span className="hair h-px flex-1" />
              <span className="hair h-px flex-1" />
            </div>

            {/* ── ۷. سرگروه اصلی هفتم: مدیریت اسناد، بایگانی دیجیتال و مدیریت دانش (EDMS / KMS) ── */}
            <section className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("edms")}
                aria-expanded={sectionsOpen.edms}
                className={`sidebar-group-title flex w-full items-center gap-2 px-2 py-2 text-start transition ${
                  activeSystemView.system === "edms" ? "is-active" : "tx2 hover:tx1"
                }`}
              >
                <span className="text-[12px]">🗂️</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  {rtl ? "مدیریت اسناد و دانش سازمانی" : "Document & Knowledge Management"}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3 w-3 shrink-0 tx4 transition-transform ${sectionsOpen.edms ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {sectionsOpen.edms && (
                <div className="fade-rise space-y-0.5 border-s-2 border-indigo-500/30 ps-2 pt-0.5">
                  {EDMS_SIDEBAR_ITEMS.map((item) => {
                    const active = activeSystemView.system === "edms" && activeSystemView.sub === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectSystemView?.({ system: "edms", sub: item.id })}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[10.5px] transition ${
                          active
                            ? "row-on font-medium text-indigo-300"
                            : "tx2 hover:bg-[var(--row-hover)] hover:tx1"
                        }`}
                      >
                        <span className="text-[11px]">{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{t(item.label, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
            {/* تعالی سازمانی خارج از گروه‌های PMIS و در سطح سازمان ارائه می‌شود. */}
            <div role="separator" aria-orientation="horizontal" className="my-2 flex items-center gap-2 px-1">
              <span className="hair h-px flex-1" />
              <span className="hair h-px flex-1" />
            </div>
            <section className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("org")}
                aria-expanded={sectionsOpen.org}
                className={`sidebar-group-title flex w-full items-center gap-2 px-2 py-2 text-start transition ${sectionsOpen.org ? "is-active" : "tx2 hover:tx1"}`}
              >
                <span className="text-[12px]">🏢</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{rtl ? "مدیریت سازمانی" : "Organizational Management"}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-3 w-3 shrink-0 tx4 transition-transform ${sectionsOpen.org ? "rotate-180" : ""}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {sectionsOpen.org && (
                <div className="fade-rise space-y-0.5 border-s-2 border-amber-400/30 ps-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const scope = projectScope ?? (selCluster && selProject ? { clusterId: selCluster, projectId: selProject } : null);
                      if (scope) onNavigate({ moduleId: "d19", clusterId: scope.clusterId, projectId: scope.projectId });
                      else onQuickAction("portfolio");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[10.5px] transition tx2 hover:bg-[var(--row-hover)] hover:tx1"
                  >
                    <span className="text-[11px]">🏅</span>
                    <span className="min-w-0 flex-1 truncate">{rtl ? "مدیریت تعالی سازمانی" : "Organizational Excellence"}</span>
                    <span className="text-[9px] tx4">←</span>
                  </button>
                </div>
              )}
            </section>
            <div role="separator" aria-orientation="horizontal" className="my-2 flex items-center gap-2 px-1">
              <span className="hair h-px flex-1" />
              <span className="hair h-px flex-1" />
            </div>

          </>
        )}
      </div>

      <nav aria-label={rtl ? "دسترسی سریع" : "Quick access"} className="shrink-0 b-line border-t px-3 pb-3 pt-2.5">
        {specialtyQuickOpen && (
          <div id="quick-specialty-modules" role="menu" aria-label={rtl ? "ماژول‌های تخصصی" : "Specialty modules"}
            className="mb-2 max-h-56 w-full overflow-y-auto rounded-xl border b-line-soft glass-dark p-2 shadow-xl"
            dir={rtl ? "rtl" : "ltr"}>
            <p className="mb-1.5 px-2 text-[9px] font-medium tx3">{rtl ? "ورود به ماژول تخصصی" : "Open a specialty module"}</p>
            <div className="space-y-0.5">
              {specialtyModules.map((module) => (
                <button key={module.id} type="button" role="menuitem"
                  onClick={() => {
                    const scope = projectScope ?? (selCluster && selProject ? { clusterId: selCluster, projectId: selProject } : null);
                    setSpecialtyQuickOpen(false);
                    if (scope) onNavigate({ moduleId: module.id, clusterId: scope.clusterId, projectId: scope.projectId });
                    else onQuickAction("portfolio");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[10px] tx2 transition hover:bg-[var(--row-hover)] hover:tx1">
                  <span className="shrink-0" style={{ color: module.accent }}>{module.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{t(module.nav ?? module.title, lang)}</span>
                  <span className="text-[9px] tx4">←</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mb-2 flex items-center gap-2 px-1">
          <h3 className="shrink-0 text-[10.5px] font-medium tx1">{rtl ? "دسترسی سریع" : "Quick Access"}</h3>
          <span className="hair h-px flex-1" />
        </div>
        <div className="grid grid-cols-4 gap-1" dir={rtl ? "rtl" : "ltr"}>
          {quickActions.map((action) => {
            const active = quickAction === action.id || (action.id === "specialty" && specialtyQuickOpen);
            const alert = action.alert ? Number(action.alert).toLocaleString(rtl ? "fa-IR" : "en-US") : undefined;
            return (
              <button key={action.id} type="button" onClick={() => {
                if (action.id === "specialty") {
                  setSpecialtyQuickOpen((open) => !open);
                  return;
                }
                setSpecialtyQuickOpen(false);
                if (action.id === "excellence") {
                  const scope = projectScope ?? (selCluster && selProject ? { clusterId: selCluster, projectId: selProject } : null);
                  if (scope) onNavigate({ moduleId: "d19", clusterId: scope.clusterId, projectId: scope.projectId });
                  else onQuickAction("portfolio");
                  return;
                }
                onQuickAction(action.id);
              }}
                title={t(action.label, lang)} aria-label={t(action.label, lang)} aria-current={active ? "page" : undefined}
                aria-expanded={action.id === "specialty" ? specialtyQuickOpen : undefined}
                aria-controls={action.id === "specialty" ? "quick-specialty-modules" : undefined}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 text-center transition ${active ? "row-on accent-t" : "tx3 hover:tx1"}`}
                style={active ? { boxShadow: "inset 0 -1px 0 var(--accent)" } : undefined}>
                <span className={action.id === "alerts" ? "text-rose-500" : active ? "accent-t" : ""}>{action.icon}</span>
                <span className={`w-full truncate text-[7.2px] font-light leading-3 ${action.id === "alerts" ? "text-rose-500" : ""}`}>{t(action.label, lang)}</span>
                {alert && (<span className="absolute end-0.5 top-0.5 min-w-3 rounded-full bg-rose-500 px-0.5 text-[7px] font-medium leading-3 text-white">{alert}</span>)}
              </button>
            );
          })}
        </div>

      </nav>
    </aside>
    </div>
    </div>
  );
}
