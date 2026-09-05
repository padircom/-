import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  domains,
  ui,
  t,
  type Bi,
  type Lang,
} from "../data/framework";
import { useSystem } from "../context/SystemContext";

export type ModuleNavTarget = {
  moduleId: string;
  clusterId: string;
  projectId: string;
  processId?: string;
  subId?: string;
};

type Props = {
  lang: Lang;
  quickAction: string;
  onQuickAction: (id: string) => void;
  onNavigate: (target: ModuleNavTarget) => void;
};

type QuickAction = { id: string; label: Bi; alert?: string; icon: ReactNode };

const iconClass = "h-4 w-4";

const moduleDataGaps: Record<string, string[]> = {
  d1: ["c3"], d2: [], d3: ["c5"], d4: ["c2", "c3"], d5: ["c4"], d6: [], d7: [],
};

const quickActions: QuickAction[] = [
  { id: "home", label: { fa: "خانه", en: "Home" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></svg>) },
  { id: "portfolio", label: { fa: "پورتفولیو", en: "Portfolio" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></svg>) },
  { id: "reports", label: { fa: "گزارش عملکرد", en: "Reports" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={iconClass}><path d="M5 20V10M10 20V4M15 20v-7M20 20V7" /></svg>) },
  { id: "alerts", label: { fa: "هشدارها", en: "Alerts" }, alert: "7", icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>) },
  { id: "calendar", label: { fa: "تقویم و کارها", en: "Calendar & Tasks" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>) },
  { id: "calc", label: { fa: "محاسبات", en: "Calculations" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M13 11h4M13 15h4M13 7h4" /></svg>) },
];

const selectClass =
  "w-full rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10.5px] font-light tx1 outline-none transition focus:border-[var(--accent)]";

export default function RightSidebar({ lang, quickAction, onQuickAction, onNavigate }: Props) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster, projectScope } = useSystem();
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [openProcess, setOpenProcess] = useState<string | null>(null);
  const [selCluster, setSelCluster] = useState<string>(() => projectScope?.clusterId ?? "");
  const [selProject, setSelProject] = useState<string>(() => projectScope?.projectId ?? "");

  useEffect(() => {
    if (!projectScope) return;
    setSelCluster(projectScope.clusterId);
    setSelProject(projectScope.projectId);
  }, [projectScope]);

  const toggleDomain = (id: string) => {
    // System administration is global; it never requires an industry/project context.
    if (id === "d7") {
      onNavigate({ moduleId: "d7", clusterId: "", projectId: "" });
      return;
    }
    setOpenDomain((prev) => (prev === id ? null : id));
    setOpenProcess(null);
    setSelCluster(projectScope?.clusterId ?? "");
    setSelProject(projectScope?.projectId ?? "");
  };

  const noData = openDomain && selCluster ? (moduleDataGaps[openDomain] ?? []).includes(selCluster) : false;
  const clusterProjects = selCluster && !noData ? projectsByCluster[selCluster] ?? [] : [];
  const canEnter = Boolean(openDomain && selCluster && selProject && !noData);
  const totalSubs = (dId: string) => domains.find(d => d.id === dId)?.processes.reduce((n, p) => n + p.subs.length, 0) ?? 0;

  return (
    <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex h-full w-[320px] shrink-0 flex-col rounded-2xl">
      <header className="b-line border-b px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="chip-bg grid h-7 w-7 place-items-center rounded-lg text-[13px]">🧩</span>
          <div className="min-w-0">
            <h2 className="truncate text-[12.5px] font-normal tx1">{t(ui.frameworkTitle, lang)}</h2>
            <p className="mt-0.5 text-[9.5px] font-extralight tx3">
              {rtl ? "۷ حوزه · ۳۸ فرآیند · مدیریت سامانه" : "7 Domains · 38 Processes · System Admin"}
            </p>
          </div>
        </div>
      </header>

      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {domains.map((d) => {
          const domainOpen = openDomain === d.id;
          return (
            <div key={d.id}>
              {/* Domain header (level 1) */}
              <button
                type="button"
                onClick={() => toggleDomain(d.id)}
                className={`glass-row flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition ${domainOpen ? "row-on" : ""}`}
                style={domainOpen ? { borderColor: d.accent } : undefined}
                aria-expanded={d.id === "d7" ? undefined : domainOpen}
              >
                <span className="chip-bg grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[14px]">{d.icon}</span>
                <h3 className="min-w-0 flex-1 truncate text-[11px] font-normal leading-4" style={{ color: d.accent }}>
                  {t(d.title, lang)}
                </h3>
                <span
                  className="rounded-md px-1.5 py-0.5 text-[9px] font-light tabular-nums"
                  style={{ color: d.accent, background: `${d.accent}1a`, border: `1px solid ${d.accent}44` }}
                >
                  {totalSubs(d.id).toLocaleString(rtl ? "fa-IR" : "en")}
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                     className={`h-3 w-3 shrink-0 tx4 transition-transform ${domainOpen ? "rotate-180" : ""}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {domainOpen && (
                <div className="fade-rise mt-1 space-y-1">
                  {/* Level 2 — processes */}
                  <div className="rounded-xl border b-line-soft bg-black/10 p-2 space-y-1">
                    {d.processes.map((p) => {
                      const pOpen = openProcess === p.id;
                      return (
                        <div key={p.id}>
                          <button
                            type="button"
                            onClick={() => setOpenProcess(pOpen ? null : p.id)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition hover:bg-[var(--row-hover)]"
                          >
                            <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: d.accent, opacity: pOpen ? 1 : 0.5 }} />
                            <span className="min-w-0 flex-1 truncate text-[10px] font-light tx2">{t(p.title, lang)}</span>
                            <span className="text-[8.5px] font-extralight tx4 tabular-nums">
                              {p.subs.length.toLocaleString(rtl ? "fa-IR" : "en")}
                            </span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                                 className={`h-2.5 w-2.5 shrink-0 tx4 transition-transform ${pOpen ? "rotate-180" : ""}`}>
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>

                          {/* Level 3 — sub-processes with SQL + AI */}
                          {pOpen && (
                            <div className="fade-rise mt-1 ms-3 space-y-1 border-s b-line-soft ps-2">
                              {p.subs.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() =>
                                    canEnter
                                      ? onNavigate({ moduleId: d.id, clusterId: selCluster, projectId: selProject, processId: p.id, subId: s.id })
                                      : undefined
                                  }
                                  disabled={!canEnter}
                                  title={canEnter ? (rtl ? "ورود به این زیرفرآیند" : "Open this sub-process") : (rtl ? "ابتدا صنعت و پروژه را انتخاب کنید" : "Pick industry & project first")}
                                  className="w-full rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-start transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  <div className="flex items-start gap-1.5">
                                    <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full" style={{ background: d.accent }} />
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-[9.5px] font-light tx1">{t(s.title, lang)}</div>
                                      <div className="mt-1 flex flex-wrap items-center gap-1">
                                        {s.sql.map((tbl) => (
                                          <span key={tbl} className="rounded bg-sky-400/10 px-1 py-[1px] text-[7.5px] font-light text-sky-300" dir="ltr" title="SQL Server table">
                                            🗄 {tbl}
                                          </span>
                                        ))}
                                        <span className="rounded bg-fuchsia-400/10 px-1 py-[1px] text-[7.5px] font-light text-fuchsia-300" dir="ltr" title="AI function">
                                          ✨ {s.ai}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 truncate text-[7.5px] font-extralight tx4" dir="ltr">
                                        src: {s.source} · out: {s.output}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
        })}
      </div>

      <nav aria-label={rtl ? "دسترسی سریع" : "Quick access"} className="b-line border-t px-3 pb-3 pt-2.5">
        <div className="mb-2 flex items-center gap-2 px-1">
          <h3 className="shrink-0 text-[10.5px] font-medium tx1">{rtl ? "دسترسی سریع" : "Quick Access"}</h3>
          <span className="hair h-px flex-1" />
        </div>
        <div className="grid grid-cols-6 gap-1" dir={rtl ? "rtl" : "ltr"}>
          {quickActions.map((action) => {
            const active = quickAction === action.id;
            const alert = action.alert ? Number(action.alert).toLocaleString(rtl ? "fa-IR" : "en-US") : undefined;
            return (
              <button key={action.id} type="button" onClick={() => onQuickAction(action.id)}
                title={t(action.label, lang)} aria-label={t(action.label, lang)} aria-current={active ? "page" : undefined}
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
  );
}
