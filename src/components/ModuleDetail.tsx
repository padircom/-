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
    { id: "d2-p2-dash", title: { fa: "داشبورد مدیر پروژه", en: "PM Dashboard" }, tab: "dashboard", sql: ["pex_evm_snapshot"] },
    { id: "d2-p2-gantt", title: { fa: "گانت تعاملی", en: "Interactive Gantt" }, tab: "gantt", sql: ["pex_activity"] },
    { id: "d2-p2-ms", title: { fa: "ردیابی مایلستون", en: "Milestone Tracking" }, tab: "milestone", sql: ["pex_milestone"] },
    { id: "d2-p2-cp", title: { fa: "تحلیل مسیر بحرانی", en: "Critical Path" }, tab: "cp", sql: ["pex_cp_snapshot"] },
    { id: "d2-p2-la", title: { fa: "نگاه‌به‌جلو", en: "Look-ahead" }, tab: "lookahead", sql: ["pex_lookahead"] },
  ],
  "d2-p4": [
    { id: "d2-p4-roc", title: { fa: "کتابخانه Rule of Credit", en: "RoC Library" }, tab: "roc", sql: ["pex_rule_of_credit"] },
  ],
  "d2-p6": [
    { id: "d2-p6-rep", title: { fa: "تولید گزارش", en: "Report Generator" }, tab: "reports", sql: ["pex_report_template"] },
    { id: "d2-p6-tpl", title: { fa: "طراح قالب + AI", en: "Template Designer" }, tab: "template", sql: ["pex_report_template"] },
    { id: "d2-p6-al", title: { fa: "مرکز هشدار", en: "Alert Center" }, tab: "alerts", sql: ["pex_alert_rule"] },
  ],
};

const D2_TAB_BY_SUB: Record<string, PexTab> = {
  "d2-p2-s0": "wbs",
  "d2-p2-s1": "baseline",
  "d2-p2-dash": "dashboard",
  "d2-p2-gantt": "gantt",
  "d2-p2-ms": "milestone",
  "d2-p2-cp": "cp",
  "d2-p2-la": "lookahead",
  "d2-p4-s1": "dpr",
  "d2-p4-roc": "roc",
  "d2-p5-s1": "weekly",
  "d2-p6-s1": "mpr",
  "d2-p6-rep": "reports",
  "d2-p6-tpl": "template",
  "d2-p6-al": "alerts",
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
    { id: "d3-p6-14", title: { fa: "۱۴ نوع گزارش", en: "14 report types" }, tab: "reports", sql: ["pma_report_def"] },
    { id: "d3-p6-exec", title: { fa: "گزارش یک‌صفحه EXEC", en: "RPT-EXEC" }, tab: "exec", sql: ["pma_report_instance"] },
    { id: "d3-p6-dash", title: { fa: "داشبورد نقش‌محور", en: "Role dashboard" }, tab: "dash", sql: ["pma_dash_config"] },
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
};

export default function ModuleDetail({ lang, target, onBack, onOpenFlowNet }: Props) {
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

        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <DocumentWorkspace lang={lang} initialTab={d1Tab} hideTabs />
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
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {s.sql.map((tbl) => (
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

  const d2Tab = ((): PexTab => {
    const sid = selected?.sId ?? target.subId;
    if (sid && D2_TAB_BY_SUB[sid]) return D2_TAB_BY_SUB[sid];
    return "dashboard";
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

        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <PlanningWorkspace lang={lang} initialTab={d2Tab} hideTabs />
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
                    {[
                      ...p.subs.map((s) => ({ id: s.id, title: s.title, sql: s.sql })),
                      ...(D2_PAGE_SUBS[p.id] ?? []),
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
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {s.sql.map((tbl) => (
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
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <PmaWorkspace lang={lang} initialTab={d3Tab} hideTabs />
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
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {s.sql.map((tbl) => (
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
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <div className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
            <RiskClaimsWorkspace lang={lang} initialTab={d4Tab} hideTabs />
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
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {s.sql.map((tbl) => (
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

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Main workspace */}
        <div className="glass flex flex-1 items-center justify-center rounded-2xl text-[11px] font-extralight tx3">
          {rtl
            ? "برای مشاهده جزئیات، از سایدبار سمت راست یک زیرفرآیند را انتخاب کنید."
            : "Pick a sub-process from the right sidebar to view details."}
        </div>

        {/* Right in-page sidebar: processes → subs */}
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
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {s.sql.map((tbl) => (
                            <span key={tbl} className="rounded bg-sky-400/10 px-1 py-[1px] text-[7.5px] font-light text-sky-300" dir="ltr">🗄 {tbl}</span>
                          ))}
                          <span className="rounded bg-fuchsia-400/10 px-1 py-[1px] text-[7.5px] font-light text-fuchsia-300" dir="ltr">✨ {s.ai}</span>
                        </div>
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
