import { useEffect, useMemo, useState } from "react";
import { t, type Bi, type Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import { useAuth } from "../context/AuthContext";
import {
  DOA,
  ESCALATION_ROLE,
  appendTrail,
  auditCloseBlocked,
  authorityFor,
  bandColor,
  capaRequired,
  complianceBand,
  complianceScore,
  connectorHealth,
  daysLeft,
  decisionGate,
  escalationLevel,
  slaLevel,
  verifyTrail,
  type Authority,
  type Finding,
  type TrailEntry,
} from "../services/governance";
import { govApi } from "../services/govApiClient";

export type GovTab = "workflow" | "integration" | "stakeholders" | "audit" | "decision";

type WorkflowRow = {
  id: string;
  code: string;
  processName: Bi;
  currentStep: Bi;
  assignee: Bi;
  dueAt: string; // ISO date — مبنای SLA
  closedAt?: string;
};

type StakeholderRow = {
  id: string;
  name: Bi;
  role: Bi;
  power: "High" | "Medium" | "Low";
  interest: "High" | "Medium" | "Low";
  strategy: Bi;
};

type AuditRow = Finding & {
  code: string;
  item: Bi;
  standard: string;
  finding: Bi;
};

type IntegrationRow = {
  id: string;
  system: string;
  domain: Bi;
  direction: "Pull" | "Push" | "Two-way";
  lastSync: string;
  slaHours: number;
  records: number;
};

type DecisionRow = {
  id: string;
  code: string;
  subject: Bi;
  authority: Authority;
  evidenceRef: string;
  basis: Bi;
  cost: number;
  days: number;
  due: string;
  rewritesBaseline?: boolean;
  crId?: string;
  approved?: boolean;
};

const sampleWorkflows: WorkflowRow[] = [
  { id: "wf1", code: "WF-MDR-084", processName: { fa: "تأیید نقشه شاپ فونداسیون", en: "Shop Drawing Approval" }, currentStep: { fa: "بررسی دستگاه نظارت", en: "Supervision Review" }, assignee: { fa: "مهندس ناظر مقیم", en: "Resident Engineer" }, dueAt: "2026-09-14" },
  { id: "wf2", code: "WF-CR-012", processName: { fa: "درخواست تغییر قیمت الحاقیه", en: "Change Order Price Review" }, currentStep: { fa: "تأیید کارفرما", en: "Employer Approval" }, assignee: { fa: "مدیر پروژه کارفرما", en: "Project Director" }, dueAt: "2026-09-03" },
  { id: "wf3", code: "WF-CLM-007", processName: { fa: "دروازه ادعا (Notice / Time-Bar)", en: "Claim Notice Gate" }, currentStep: { fa: "بررسی حقوقی PMO", en: "PMO Legal Review" }, assignee: { fa: "کمیته ادعا", en: "Claims Committee" }, dueAt: "2026-09-09" },
];

const sampleStakeholders: StakeholderRow[] = [
  { id: "sh1", name: { fa: "سازمان محیط زیست", en: "Environmental Protection Agency" }, role: { fa: "دستگاه مجوزدهنده", en: "Regulatory Body" }, power: "High", interest: "High", strategy: { fa: "مدیریت نزدیک و پاسخگویی شفاف", en: "Manage Closely & Transparent Reports" } },
  { id: "sh2", name: { fa: "پیمانکار دست دوم سیویل", en: "Civil Subcontractor" }, role: { fa: "بازوی اجرایی", en: "Executing Partner" }, power: "Medium", interest: "High", strategy: { fa: "همکاری پیوسته و تراز منابع", en: "Keep Informed & Level Resources" } },
  { id: "sh3", name: { fa: "کارفرما — مدیریت طرح", en: "Employer — Program Management" }, role: { fa: "تصمیم‌گیر اصلی", en: "Key Decision Maker" }, power: "High", interest: "Medium", strategy: { fa: "گزارش ماهانه EXEC و تصمیم‌های دارای شاهد عددی", en: "Monthly EXEC report with numeric evidence" } },
];

const sampleAudits: AuditRow[] = [
  { id: "au1", code: "AUD-PMBOK-01", item: { fa: "انطباق فرآیند کنترل تغییرات با استاندارد PMBOK", en: "Integrated Change Control Alignment" }, standard: "PMBOK 7th Ed.", compliance: 92, weight: 2, severity: "minor", finding: { fa: "کامل و بدون انحراف با ثبت در اسکیما", en: "Fully compliant with DB logging" } },
  { id: "au2", code: "AUD-HSE-04", item: { fa: "ممیزی چک‌لیست‌های HSE کارگاه", en: "Site HSE Audit Checklist" }, standard: "ISO 45001", compliance: 85, weight: 1, severity: "major", capaId: "CAPA-118", finding: { fa: "لزوم تکمیل استفاده از تجهیزات حفاظت فردی در زون B", en: "Enforce PPE compliance in Zone B" } },
  { id: "au3", code: "AUD-DOC-11", item: { fa: "انطباق شماره‌گذاری و گردش مدارک (PIM/EDMS)", en: "Document Numbering & Workflow Compliance" }, standard: "ISO 9001 / EDMS", compliance: 68, weight: 1, severity: "critical", finding: { fa: "۳ مدرک بدون Transmittal ثبت‌شده؛ نیاز به اقدام اصلاحی", en: "3 documents lack transmittal record; CAPA required" } },
];

const sampleIntegrations: IntegrationRow[] = [
  { id: "in1", system: "Primavera P6", domain: { fa: "برنامه‌ریزی و اجرا (d2)", en: "Planning & Execution (d2)" }, direction: "Pull", lastSync: "2026-09-08 08:20", slaHours: 24, records: 4820 },
  { id: "in2", system: "ERP / SAP", domain: { fa: "هزینه و تدارکات (d5)", en: "Cost & Procurement (d5)" }, direction: "Pull", lastSync: "2026-09-08 06:05", slaHours: 24, records: 1290 },
  { id: "in3", system: "EDMS", domain: { fa: "مدارک (d1)", en: "Documents (d1)" }, direction: "Two-way", lastSync: "2026-09-06 22:40", slaHours: 24, records: 7315 },
  { id: "in4", system: "Power BI Gateway", domain: { fa: "پایش و گزارش (d3)", en: "Monitoring & Reports (d3)" }, direction: "Push", lastSync: "2026-09-01 19:10", slaHours: 24, records: 0 },
];

const sampleDecisions: DecisionRow[] = [
  { id: "de1", code: "DEC-2026-041", subject: { fa: "تخصیص ذخیره احتیاطی به بسته سیویل", en: "Contingency release to civil package" }, authority: "PM", evidenceRef: "PMA:EVM#1405-06", basis: { fa: "EVM: CPI=0.91 · انحراف Major ثبت‌شده", en: "EVM: CPI=0.91 · Major variance logged" }, cost: 180_000, days: 10, due: "2026-09-20" },
  { id: "de2", code: "DEC-2026-038", subject: { fa: "تمدید زمان ۱۴ روزه ناشی از تأخیر کارفرما", en: "14-day EOT for employer delay" }, authority: "PMO", evidenceRef: "RCC:CLM-007", basis: { fa: "Delay Analysis · ماده ۳۰ شرایط عمومی", en: "Delay analysis · GC clause 30" }, cost: 0, days: 14, due: "2026-09-05" },
  { id: "de3", code: "DEC-2026-035", subject: { fa: "تأیید بازنگری برنامه پایه (Rebaseline)", en: "Approve schedule rebaseline" }, authority: "STEERING", evidenceRef: "PEX:BL#3", basis: { fa: "CCB مصوب · Baseline نسخه ۳", en: "CCB approved · Baseline rev 3" }, cost: 0, days: 45, due: "2026-08-24", rewritesBaseline: true, crId: "CR-2026-19", approved: true },
];

const TABS: { id: GovTab; fa: string; en: string; icon: string }[] = [
  { id: "workflow", fa: "گردش فرآیندها (Workflow)", en: "Workflows", icon: "⚡" },
  { id: "integration", fa: "یکپارچگی داده", en: "Integration", icon: "🔗" },
  { id: "stakeholders", fa: "مدیریت ذی‌نفعان", en: "Stakeholders", icon: "👥" },
  { id: "audit", fa: "ممیزی و انطباق", en: "Audit & Compliance", icon: "📋" },
  { id: "decision", fa: "پشتیبان تصمیم", en: "Decision Support", icon: "🧭" },
];

const POWER = ["High", "Medium", "Low"] as const;

export default function GovernanceWorkspace({
  lang,
  initialTab = "workflow",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: GovTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const activeRole = user?.role ?? "guest";
  const [tab, setTab] = useState<GovTab>(initialTab);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>(sampleWorkflows);
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [source, setSource] = useState<"sample" | "api">("sample");
  useEffect(() => setTab(initialTab), [initialTab]);

  /* داده زنده در صورت در دسترس بودن سرویس؛ در غیر این‌صورت همان داده نمونه می‌ماند. */
  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await govApi.workflowTasks();
      if (!alive || !rows?.length) return;
      setWorkflows(
        rows.map((r) => ({
          id: r.id,
          code: r.code,
          processName: { fa: r.processFa, en: r.processFa },
          currentStep: r.closedAt ? { fa: "تأییدشده و نهایی", en: "Fully Approved" } : { fa: "در جریان بررسی", en: "In review" },
          assignee: { fa: r.assignee, en: r.assignee },
          dueAt: r.dueAt,
          closedAt: r.closedAt,
        }))
      );
      setSource("api");
      const tr = await govApi.trail();
      if (alive && tr) setTrail(tr.entries);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const approveWorkflow = async (id: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setWorkflows((prev) => prev.map((wf) => (wf.id === id ? { ...wf, closedAt: today, currentStep: { fa: "تأییدشده و نهایی", en: "Fully Approved" } } : wf)));
    setTrail((prev) => appendTrail(prev, `APPROVE:${id}:${activeRole}`));
    logAudit("WORKFLOW_APPROVE", "Governance", `Approved workflow ${id} under role ${activeRole}`);
    if (source === "api") {
      await govApi.approveTask(id, String(activeRole));
      const tr = await govApi.trail();
      if (tr) setTrail(tr.entries);
    }
  };

  const score = useMemo(() => complianceScore(sampleAudits), []);
  const band = complianceBand(score);
  const color = bandColor(band);
  const blocked = auditCloseBlocked(sampleAudits);

  const gates = useMemo(() => sampleDecisions.map((d) => ({ id: d.id, res: decisionGate(d) })), []);
  const openDecisions = sampleDecisions.filter((d) => !d.approved).length;
  const breaches = workflows.filter((w) => !w.closedAt && slaLevel(daysLeft(w.dueAt)) === "breach").length;
  const trailOk = verifyTrail(trail);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* Top Header */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-indigo-400/40 bg-indigo-400/10 text-[15px]">🏛</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">{rtl ? "مدیریت حاکمیت و فرآیندهای PMBOK" : "Governance & PMBOK Process Management"}</h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "ارجاع بدون بازنویسی · Baseline مقدس · هر تصمیم = شاهد + اختیار · ثبت فقط افزودنی"
                : "Reference not rewrite · Baseline sacred · every decision = evidence + authority · append-only trail"}
            </p>
          </div>
          <span className="rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums" style={{ background: `${color}22`, color }}>
            {rtl ? "انطباق" : "Compliance"} {score}%
          </span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3">
            {rtl ? "نقض SLA" : "SLA breach"} {breaches.toLocaleString(rtl ? "fa-IR" : "en-US")}
          </span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3">
            {rtl ? "تصمیم باز" : "Open decisions"} {openDecisions.toLocaleString(rtl ? "fa-IR" : "en-US")}
          </span>
          <span
            className={`rounded-lg px-2 py-1 text-[9px] ${source === "api" ? "bg-emerald-400/15 text-emerald-300" : "border b-line-soft tx3"}`}
            title={source === "api" ? "/api/gov" : "mock"}
          >
            {source === "api" ? (rtl ? "داده زنده" : "Live data") : rtl ? "داده نمونه" : "Sample data"}
          </span>
          <span className="font-mono text-[9px] text-indigo-300" dir="ltr">dbo.Process_Master · dbo.Audit_Register</span>
        </div>
      </section>

      {/* Tabs */}
      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
          {TABS.map((tItem) => (
            <button
              key={tItem.id}
              onClick={() => setTab(tItem.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition ${
                tab === tItem.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"
              }`}
            >
              <span>{tItem.icon}</span>
              <span>{rtl ? tItem.fa : tItem.en}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Main Tab View */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {/* TAB 1: WORKFLOWS */}
        {tab === "workflow" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark overflow-x-auto rounded-2xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b b-line-soft pb-2">
                <span className="text-[11px] font-normal tx1">{rtl ? "پایش گردش فرآیند، SLA و تشدید" : "Workflow, SLA & escalation tracker"}</span>
                <span className="font-mono text-[8.5px] tx3" dir="ltr">Process_Master · Workflow_Instance</span>
              </div>
              <table className="w-full min-w-[720px] border-collapse text-[10px]">
                <thead>
                  <tr className="border-b b-line-soft bg-black/25 text-[9px] font-extralight tx3">
                    <th className="px-2 py-2 text-start">{rtl ? "کد گردش" : "Code"}</th>
                    <th className="px-2 py-2 text-start">{rtl ? "نام فرآیند" : "Process"}</th>
                    <th className="px-2 py-2 text-center">{rtl ? "گام فعلی" : "Current Step"}</th>
                    <th className="px-2 py-2 text-center">{rtl ? "مسئول بررسی" : "Assignee"}</th>
                    <th className="px-2 py-2 text-center">{rtl ? "مهلت / SLA" : "Due / SLA"}</th>
                    <th className="px-2 py-2 text-center">{rtl ? "وضعیت" : "Status"}</th>
                    <th className="px-2 py-2 text-center">{rtl ? "سطح تشدید" : "Escalation"}</th>
                    <th className="px-2 py-2 text-end">{rtl ? "اقدام" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {workflows.map((wf) => {
                    const left = daysLeft(wf.dueAt);
                    const lvl = wf.closedAt ? "ok" : slaLevel(left);
                    const esc = escalationLevel(left < 0 && !wf.closedAt ? -left : 0);
                    const chip =
                      wf.closedAt
                        ? { c: "bg-emerald-400/15 text-emerald-300", fa: "بسته‌شده", en: "Closed" }
                        : lvl === "breach"
                        ? { c: "bg-rose-400/15 text-rose-300", fa: "⚠️ نقض SLA", en: "SLA breach" }
                        : lvl === "due_soon"
                        ? { c: "bg-amber-400/15 text-amber-300", fa: "نزدیک مهلت", en: "Due soon" }
                        : { c: "bg-emerald-400/15 text-emerald-300", fa: "مطابق برنامه", en: "On track" };
                    return (
                      <tr key={wf.id} className="hover:bg-white/[0.02]">
                        <td className="px-2 py-1.5 font-mono text-[9.5px] tx2" dir="ltr">{wf.code}</td>
                        <td className="px-2 py-1.5 font-normal tx1">{t(wf.processName, lang)}</td>
                        <td className="px-2 py-1.5 text-center tx3">{t(wf.currentStep, lang)}</td>
                        <td className="px-2 py-1.5 text-center font-light tx1">{t(wf.assignee, lang)}</td>
                        <td className="px-2 py-1.5 text-center font-mono text-[9.5px] text-sky-300" dir="ltr">
                          {wf.dueAt} · {left >= 0 ? `+${left}d` : `${left}d`}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`rounded px-2 py-0.5 text-[8.5px] ${chip.c}`}>{rtl ? chip.fa : chip.en}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center text-[9px] tx3">
                          <span className="font-mono text-indigo-300" dir="ltr">{esc}</span> · {t(ESCALATION_ROLE[esc], lang)}
                        </td>
                        <td className="px-2 py-1.5 text-end">
                          <button
                            onClick={() => void approveWorkflow(wf.id)}
                            disabled={!!wf.closedAt}
                            className="rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[8.5px] text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-40"
                          >
                            ✓ {rtl ? "تأیید گام" : "Approve"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Immutable trail */}
            <div className="glass-dark rounded-2xl p-3 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10.5px] font-normal tx1">{rtl ? "زنجیره ثبت غیرقابل تغییر (Audit Trail)" : "Immutable audit trail"}</span>
                <span className={`rounded px-2 py-0.5 text-[8.5px] ${trailOk ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
                  {trailOk ? (rtl ? "زنجیره سالم" : "Chain valid") : (rtl ? "دستکاری‌شده" : "Tampered")}
                </span>
              </div>
              {trail.length === 0 ? (
                <p className="text-[9px] font-extralight tx3">{rtl ? "هنوز تأییدی ثبت نشده — با «تأیید گام» رکورد append می‌شود." : "No approvals yet — approving a step appends a record."}</p>
              ) : (
                <ul className="space-y-1">
                  {trail.map((e) => (
                    <li key={e.seq} className="rounded-lg border b-line-soft bg-black/15 px-2 py-1 font-mono text-[9px] tx2" dir="ltr">
                      #{e.seq} · {e.payload} · sha:{e.hash}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: INTEGRATION */}
        {tab === "integration" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b b-line-soft pb-2">
              <span className="text-[11px] font-normal tx1">{rtl ? "یکپارچگی و تجمیع داده بین‌ماژولی" : "Cross-module data integration"}</span>
              <span className="font-mono text-[8.5px] tx3" dir="ltr">Project_Master · Integration_Log</span>
            </div>
            <table className="w-full min-w-[680px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft bg-black/25 text-[9px] font-extralight tx3">
                  <th className="px-2 py-2 text-start">{rtl ? "سامانه مبدأ" : "System"}</th>
                  <th className="px-2 py-2 text-start">{rtl ? "حوزه مالک داده" : "Owning domain"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "جهت" : "Direction"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "آخرین همگام‌سازی" : "Last sync"}</th>
                  <th className="px-2 py-2 text-center">SLA</th>
                  <th className="px-2 py-2 text-center">{rtl ? "رکورد" : "Records"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "سلامت" : "Health"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {sampleIntegrations.map((it) => {
                  const h = connectorHealth(it.lastSync, it.slaHours);
                  const c = h === "ok" ? "bg-emerald-400/15 text-emerald-300" : h === "warn" ? "bg-amber-400/15 text-amber-300" : "bg-rose-400/15 text-rose-300";
                  const label = h === "ok" ? (rtl ? "سالم" : "Healthy") : h === "warn" ? (rtl ? "هشدار" : "Warning") : (rtl ? "قطع" : "Failed");
                  return (
                    <tr key={it.id} className="hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 font-mono text-[9.5px] tx2" dir="ltr">{it.system}</td>
                      <td className="px-2 py-1.5 font-normal tx1">{t(it.domain, lang)}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-[9px] text-sky-300" dir="ltr">{it.direction}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-[9px] tx3" dir="ltr">{it.lastSync}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-[9px] tx3" dir="ltr">{it.slaHours}h</td>
                      <td className="px-2 py-1.5 text-center font-mono text-[9.5px] tabular-nums tx2">{it.records.toLocaleString("en-US")}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`rounded px-2 py-0.5 text-[8.5px] ${c}`}>{label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "مالکیت داده: پیشرفت/Baseline → d2 · EVM/KPI/انحراف → d3 · ریسک/ادعا → d4 · هزینه → d5 · مدرک → d1. حاکمیت فقط می‌خواند."
                : "Data ownership: progress/baseline → d2 · EVM/KPI/variance → d3 · risk/claim → d4 · cost → d5 · docs → d1. Governance reads only."}
            </p>
          </div>
        )}

        {/* TAB 3: STAKEHOLDERS */}
        {tab === "stakeholders" && (
          <div className="fade-rise space-y-2.5">
            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <div className="mb-2 border-b b-line-soft pb-2 text-[11px] font-normal tx1">{rtl ? "ماتریس قدرت × علاقه" : "Power × Interest matrix"}</div>
              <table className="w-full min-w-[420px] border-collapse text-[9.5px]">
                <thead>
                  <tr className="text-[9px] font-extralight tx3">
                    <th className="px-2 py-1.5 text-start">{rtl ? "قدرت \\ علاقه" : "Power \\ Interest"}</th>
                    {POWER.map((i) => (
                      <th key={i} className="px-2 py-1.5 text-center">{i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {POWER.map((p) => (
                    <tr key={p}>
                      <td className="px-2 py-1.5 font-light tx3">{p}</td>
                      {POWER.map((i) => {
                        const cell = sampleStakeholders.filter((s) => s.power === p && s.interest === i);
                        const hot = p === "High" && i === "High";
                        return (
                          <td key={i} className={`rounded px-2 py-1.5 text-center align-top ${hot ? "bg-rose-400/10" : "bg-black/15"}`}>
                            {cell.length === 0 ? <span className="tx4">—</span> : cell.map((s) => <div key={s.id} className="truncate text-[9px] tx1">{t(s.name, lang)}</div>)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sampleStakeholders.map((sh) => (
              <div key={sh.id} className="glass-dark rounded-2xl border border-indigo-400/30 p-3.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11.5px] font-medium text-indigo-300">🏢 {t(sh.name, lang)}</span>
                  <span className="rounded bg-indigo-400/10 px-2 py-0.5 text-[8.5px] text-indigo-200">{t(sh.role, lang)}</span>
                </div>
                <div className="flex items-center gap-3 text-[9.5px] tx3">
                  <span>Power: <b className="text-amber-300">{sh.power}</b></span>
                  <span>Interest: <b className="text-emerald-300">{sh.interest}</b></span>
                </div>
                <div className="rounded-xl border b-line-soft bg-black/15 p-2 text-[10px] font-light tx1">
                  <b className="text-sky-300">{rtl ? "استراتژی ارتباطی:" : "Strategy:"}</b> {t(sh.strategy, lang)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: AUDIT */}
        {tab === "audit" && (
          <div className="fade-rise space-y-2">
            {blocked && (
              <div className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-200">
                {rtl
                  ? "بستن ممیزی مسدود است: یافته Major/Critical بدون اقدام اصلاحی (CAPA) ثبت شده."
                  : "Audit close is blocked: a major/critical finding has no CAPA assigned."}
              </div>
            )}
            <div className="glass-dark overflow-x-auto rounded-2xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b b-line-soft pb-2">
                <span className="text-[11px] font-normal tx1">{rtl ? "نتایج ممیزی، عدم‌انطباق و CAPA" : "Audit findings, non-conformity & CAPA"}</span>
                <span className="rounded px-2 py-0.5 text-[9px] font-semibold" style={{ background: `${color}22`, color }}>
                  {rtl ? "امتیاز وزنی" : "Weighted score"} {score}% · {band}
                </span>
              </div>
              <table className="w-full min-w-[720px] border-collapse text-[10px]">
                <thead>
                  <tr className="border-b b-line-soft bg-black/25 text-[9px] font-extralight tx3">
                    <th className="px-2 py-2 text-start">{rtl ? "کد ممیزی" : "Audit code"}</th>
                    <th className="px-2 py-2 text-start">{rtl ? "موضوع ممیزی" : "Audit item"}</th>
                    <th className="px-2 py-2 text-center">{rtl ? "مرجع استاندارد" : "Standard"}</th>
                    <th className="px-2 py-2 text-center">{rtl ? "وزن" : "Weight"}</th>
                    <th className="px-2 py-2 text-center">{rtl ? "انطباق" : "Compliance"}</th>
                    <th className="px-2 py-2 text-center">CAPA</th>
                    <th className="px-2 py-2 text-start">{rtl ? "یافته" : "Finding"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {sampleAudits.map((au) => {
                    const cls = au.compliance >= 90 ? "text-emerald-300" : au.compliance >= 75 ? "text-amber-300" : "text-rose-300";
                    const need = capaRequired(au);
                    return (
                      <tr key={au.id} className="hover:bg-white/[0.02]">
                        <td className="px-2 py-1.5 font-mono text-[9.5px] tx2" dir="ltr">{au.code}</td>
                        <td className="px-2 py-1.5 font-normal tx1">{t(au.item, lang)}</td>
                        <td className="px-2 py-1.5 text-center font-mono text-[9px] text-sky-300" dir="ltr">{au.standard}</td>
                        <td className="px-2 py-1.5 text-center font-mono text-[9px] tx3">{au.weight ?? 1}</td>
                        <td className={`px-2 py-1.5 text-center font-mono text-[10px] ${cls}`}>{au.compliance}%</td>
                        <td className="px-2 py-1.5 text-center">
                          {au.capaId ? (
                            <span className="rounded bg-emerald-400/15 px-2 py-0.5 font-mono text-[8.5px] text-emerald-300" dir="ltr">{au.capaId}</span>
                          ) : need ? (
                            <span className="rounded bg-rose-400/15 px-2 py-0.5 text-[8.5px] text-rose-300">{rtl ? "لازم" : "Required"}</span>
                          ) : (
                            <span className="text-[8.5px] tx4">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-[9.5px] tx3">{t(au.finding, lang)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: DECISION SUPPORT */}
        {tab === "decision" && (
          <div className="fade-rise space-y-2.5">
            <div className="glass-dark rounded-2xl p-3 text-[9px] font-extralight tx3">
              {rtl ? "سقف اختیار (DoA): " : "Delegation of authority: "}
              {(["PM", "PMO", "STEERING"] as Authority[]).map((a) => (
                <span key={a} className="me-2 rounded bg-black/20 px-2 py-0.5 font-mono text-indigo-200" dir="ltr">
                  {a} ≤ {DOA[a].cost.toLocaleString("en-US")}$ / {DOA[a].days}d
                </span>
              ))}
              <span className="rounded bg-black/20 px-2 py-0.5 font-mono text-indigo-200" dir="ltr">BOARD ∞</span>
            </div>
            {sampleDecisions.map((de) => {
              const gate = gates.find((g) => g.id === de.id)!.res;
              const required = authorityFor(de.cost, de.days);
              const chip = de.approved
                ? { c: "bg-emerald-400/15 text-emerald-300", fa: "تأییدشده", en: "Approved" }
                : gate.ok
                ? { c: "bg-amber-400/15 text-amber-300", fa: "در انتظار تصمیم", en: "Open" }
                : { c: "bg-rose-400/15 text-rose-300", fa: "رد دروازه", en: "Gate rejected" };
              return (
                <div key={de.id} className="glass-dark rounded-2xl border border-indigo-400/30 p-3.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11.5px] font-medium text-indigo-300">🧭 {t(de.subject, lang)}</span>
                    <span className={`rounded px-2 py-0.5 text-[8.5px] ${chip.c}`}>{rtl ? chip.fa : chip.en}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[9.5px] tx3">
                    <span className="font-mono" dir="ltr">{de.code}</span>
                    <span>{rtl ? "اختیار فعلی:" : "Authority:"} <b className="tx1" dir="ltr">{de.authority}</b></span>
                    <span>{rtl ? "اختیار لازم:" : "Required:"} <b className={required === de.authority ? "text-emerald-300" : "text-rose-300"} dir="ltr">{required}</b></span>
                    <span dir="ltr">{de.cost.toLocaleString("en-US")}$ / {de.days}d</span>
                    <span>{rtl ? "مهلت:" : "Due:"} <b className="text-sky-300" dir="ltr">{de.due}</b></span>
                  </div>
                  <div className="rounded-xl border b-line-soft bg-black/15 p-2 text-[10px] font-light tx1">
                    <b className="text-sky-300">{rtl ? "شاهد عددی:" : "Evidence:"}</b> <span dir="ltr" className="font-mono text-[9px]">{de.evidenceRef}</span> — {t(de.basis, lang)}
                  </div>
                  {!gate.ok && (
                    <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-2 text-[9px] text-rose-200" dir="ltr">
                      gate: {gate.reasons.join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "هر تصمیم باید به شاهد عددی (EVM / انحراف / ادعا) و مرجع اختیار متصل باشد؛ بازنویسی Baseline فقط با CR مصوب مجاز است."
                : "Every decision binds to numeric evidence and an authority level; baseline rewrite requires an approved CR."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
