import { useState } from "react";
import { t, type Bi, type Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import { useSystem } from "../context/SystemContext";

type GovTab = "workflow" | "stakeholders" | "audit";

type WorkflowRow = {
  id: string;
  code: string;
  processName: Bi;
  currentStep: Bi;
  assignee: Bi;
  slaDays: number;
  status: "on_track" | "delayed";
};

type StakeholderRow = {
  id: string;
  name: Bi;
  role: Bi;
  power: "High" | "Medium" | "Low";
  interest: "High" | "Medium" | "Low";
  strategy: Bi;
};

type AuditRow = {
  id: string;
  code: string;
  item: Bi;
  standard: string;
  compliance: number; // %
  finding: Bi;
};

const sampleWorkflows: WorkflowRow[] = [
  { id: "wf1", code: "WF-MDR-084", processName: { fa: "تأیید نقشه شاپ فونداسیون", en: "Shop Drawing Approval" }, currentStep: { fa: "بررسی دستگاه نظارت", en: "Supervision Review" }, assignee: { fa: "مهندس ناظر مقیم", en: "Resident Engineer" }, slaDays: 3, status: "on_track" },
  { id: "wf2", code: "WF-CR-012", processName: { fa: "درخواست تغییر قیمت الحاقیه", en: "Change Order Price Review" }, currentStep: { fa: "تأیید کارفرما", en: "Employer Approval" }, assignee: { fa: "مدیر پروژه کارفرما", en: "Project Director" }, slaDays: 12, status: "delayed" },
];

const sampleStakeholders: StakeholderRow[] = [
  { id: "sh1", name: { fa: "سازمان محیط زیست", en: "Environmental Protection Agency" }, role: { fa: "دستگاه مجوزدهنده", en: "Regulatory Body" }, power: "High", interest: "High", strategy: { fa: "مدیریت نزدیک و پاسخگویی شفاف", en: "Manage Closely & Transparent Reports" } },
  { id: "sh2", name: { fa: "پیمانکار دست دوم سیویل", en: "Civil Subcontractor" }, role: { fa: "بازوی اجرایی", en: "Executing Partner" }, power: "Medium", interest: "High", strategy: { fa: "همکاری پیوسته و تراز منابع", en: "Keep Informed & Level Resources" } },
];

const sampleAudits: AuditRow[] = [
  { id: "au1", code: "AUD-PMBOK-01", item: { fa: "انطباق فرآیند کنترل تغییرات با استاندارد PMBOK", en: "Integrated Change Control Alignment" }, standard: "PMBOK 7th Ed.", compliance: 92, finding: { fa: "کامل و بدون انحراف با ثبت در اسکیما", en: "Fully compliant with DB logging" } },
  { id: "au2", code: "AUD-HSE-04", item: { fa: "ممیزی چک‌لیست‌های HSE کارگاه", en: "Site HSE Audit Checklist" }, standard: "ISO 45001", compliance: 85, finding: { fa: "لزوم تکمیل استفاده از تجهیزات حفاظت فردی در زون B", en: "Enforce PPE compliance in Zone B" } },
];

export default function GovernanceWorkspace({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { settings } = useSystem();
  const [tab, setTab] = useState<GovTab>("workflow");
  const [workflows, setWorkflows] = useState<WorkflowRow[]>(sampleWorkflows);

  const approveWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((wf) =>
        wf.id === id
          ? { ...wf, status: "on_track", currentStep: { fa: "تأییدشده و نهایی", en: "Fully Approved" } }
          : wf
      )
    );
    logAudit("WORKFLOW_APPROVE", "Governance", `Approved workflow ${id} under role ${settings.activeRole}`);
  };

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* Top Header */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-indigo-400/40 bg-indigo-400/10 text-[15px]">🏛</span>
          <div>
            <h3 className="text-[12px] font-semibold tx1">{rtl ? "مدیریت حاکمیت و فرآیندهای PMBOK" : "Governance & PMBOK Process Management"}</h3>
            <p className="text-[8.5px] font-extralight tx3">{rtl ? "گردش فرآیندها، مدیریت ذی‌نفعان، ممیزی انطباق و یکپارچگی" : "Workflows, stakeholder management, compliance audits & integration"}</p>
          </div>
          <span className="ms-auto font-mono text-[9px] text-indigo-300">dbo.Process_Master · dbo.Audit_Register</span>
        </div>
      </section>

      {/* Tabs */}
      <nav className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
        {[
          { id: "workflow" as const, fa: "گردش فرآیندها (Workflow)", en: "Workflows", icon: "⚡" },
          { id: "stakeholders" as const, fa: "مدیریت ذی‌نفعان", en: "Stakeholders", icon: "👥" },
          { id: "audit" as const, fa: "ممیزی و کنترل انطباق", en: "Audit & Compliance", icon: "📋" },
        ].map((tItem) => (
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

      {/* Main Tab View */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {/* TAB 1: WORKFLOWS */}
        {tab === "workflow" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between border-b b-line-soft pb-2">
              <span className="text-[11px] font-normal tx1">{rtl ? "پایش گردش فرآیندهای سازمانی و کارگاهی" : "Process Workflow Tracker"}</span>
            </div>
            <table className="w-full min-w-[650px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft bg-black/25 text-[9px] font-extralight tx3">
                  <th className="px-2 py-2 text-start">{rtl ? "کد گردش" : "Code"}</th>
                  <th className="px-2 py-2 text-start">{rtl ? "نام فرآیند" : "Process"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "گام فعلی" : "Current Step"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "مسئول بررسی" : "Assignee"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "زمان باقی" : "SLA"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "وضعیت" : "Status"}</th>
                  <th className="px-2 py-2 text-end">{rtl ? "اقدام" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="hover:bg-white/[0.02]">
                    <td className="px-2 py-1.5 font-mono text-[9.5px] tx2" dir="ltr">{wf.code}</td>
                    <td className="px-2 py-1.5 font-normal tx1">{t(wf.processName, lang)}</td>
                    <td className="px-2 py-1.5 text-center tx3">{t(wf.currentStep, lang)}</td>
                    <td className="px-2 py-1.5 text-center font-light tx1">{t(wf.assignee, lang)}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-[9.5px] text-sky-300">{wf.slaDays} days</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`rounded px-2 py-0.5 text-[8.5px] ${wf.status === "on_track" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
                        {wf.status === "on_track" ? (rtl ? "مطابق برنامه" : "On Track") : (rtl ? "⚠️ تأخیر در بررسی" : "Delayed")}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-end">
                      <button
                        onClick={() => approveWorkflow(wf.id)}
                        className="rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[8.5px] text-emerald-300 hover:bg-emerald-400/20"
                      >
                        ✓ {rtl ? "تأیید گام" : "Approve"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: STAKEHOLDERS */}
        {tab === "stakeholders" && (
          <div className="fade-rise space-y-2.5">
            {sampleStakeholders.map((sh) => (
              <div key={sh.id} className="glass-dark rounded-2xl p-3.5 space-y-1.5 border border-indigo-400/30">
                <div className="flex items-center justify-between">
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

        {/* TAB 3: AUDIT */}
        {tab === "audit" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between border-b b-line-soft pb-2">
              <span className="text-[11px] font-normal tx1">{rtl ? "نتایج ممیزی و کنترل انطباق فرآیندی" : "Compliance Audit Results"}</span>
            </div>
            <table className="w-full min-w-[620px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft bg-black/25 text-[9px] font-extralight tx3">
                  <th className="px-2 py-2 text-start">{rtl ? "کد ممیزی" : "Audit Code"}</th>
                  <th className="px-2 py-2 text-start">{rtl ? "موضوع ممیزی" : "Audit Item"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "مرجع مرجع" : "Standard"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "درصد انطباق" : "Compliance"}</th>
                  <th className="px-2 py-2 text-start">{rtl ? "نتیجه و یافته" : "Finding"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {sampleAudits.map((au) => (
                  <tr key={au.id} className="hover:bg-white/[0.02]">
                    <td className="px-2 py-1.5 font-mono text-[9.5px] tx2" dir="ltr">{au.code}</td>
                    <td className="px-2 py-1.5 font-normal tx1">{t(au.item, lang)}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-[9px] text-sky-300" dir="ltr">{au.standard}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-[10px] text-emerald-300">{au.compliance}%</td>
                    <td className="px-2 py-1.5 text-[9.5px] tx3">{t(au.finding, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
