import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  domains,
  sidebarGroups,
  ui,
  t,
  type Bi,
  type Domain,
  type Lang,
  type Process,
} from "../data/framework";
import { useSystem } from "../context/SystemContext";
import { useAuth } from "../context/AuthContext";
import { EDITABLE_TAXONOMY_DOMAINS, loadProcessTree } from "../services/taxonomyApi";

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
  d1: ["c3"], d2: [], d3: ["c5"], d4: ["c2", "c3"], d5: ["c4"], d6: [], d8: [], d7: [], d17: [],
};

const quickActions: QuickAction[] = [
  { id: "home", label: { fa: "خانه", en: "Home" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></svg>) },
  { id: "portfolio", label: { fa: "پورتفولیو", en: "Portfolio" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></svg>) },
  { id: "reports", label: { fa: "گزارش عملکرد", en: "Reports" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={iconClass}><path d="M5 20V10M10 20V4M15 20v-7M20 20V7" /></svg>) },
  { id: "alerts", label: { fa: "هشدارها", en: "Alerts" }, alert: "7", icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>) },
  { id: "calendar", label: { fa: "تقویم و کارها", en: "Calendar & Tasks" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>) },
  { id: "calc", label: { fa: "محاسبات", en: "Calculations" }, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={iconClass}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M13 11h4M13 15h4M13 7h4" /></svg>) },
];

/* میان‌بر حوزه‌ها — پرکاربردترین‌ها. این‌ها جایگزینِ فهرست نیستند؛
 * همان حوزه‌ها در گروهِ خودشان هم پیدا می‌شوند. */
const domainShortcuts = [
  { id: "d1", icon: "🗂" },
  { id: "d2", icon: "📅" },
  { id: "d17", icon: "⚡" },
];

const selectClass =
  "w-full rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10.5px] font-light tx1 outline-none transition focus:border-[var(--accent)]";

const GROUP_STORE_KEY = "arena.sidebar.groups";

function loadGroupState(): { open: string | null; supportOpen: boolean } {
  try {
    const raw = localStorage.getItem(GROUP_STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { open?: unknown; supportOpen?: unknown };
      return {
        open: typeof p.open === "string" ? p.open : "pg2",
        supportOpen: typeof p.supportOpen === "boolean" ? p.supportOpen : true,
      };
    }
  } catch {
    /* حافظه در دسترس نیست — پیش‌فرض */
  }
  return { open: "pg2", supportOpen: true };
}

export default function RightSidebar({ lang, quickAction, onQuickAction, onNavigate }: Props) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster, projectScope } = useSystem();
  const { can } = useAuth();
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [selCluster, setSelCluster] = useState<string>(() => projectScope?.clusterId ?? "");
  const [selProject, setSelProject] = useState<string>(() => projectScope?.projectId ?? "");
  const [groupState, setGroupState] = useState(loadGroupState);
  const [query, setQuery] = useState("");
  const [taxonomyOverrides, setTaxonomyOverrides] = useState<Record<string, Process[]>>({});

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
    if (!projectId) {
      setTaxonomyOverrides({});
      return () => { alive = false; };
    }
    (async () => {
      const entries = await Promise.all(
        EDITABLE_TAXONOMY_DOMAINS.map(async (domainId) => [domainId, await loadProcessTree(projectId, domainId)] as const),
      );
      if (!alive) return;
      const next: Record<string, Process[]> = {};
      for (const [domainId, processes] of entries) if (processes) next[domainId] = processes;
      setTaxonomyOverrides(next);
    })();
    return () => { alive = false; };
  }, [projectScope?.projectId]);

  useEffect(() => {
    const onTaxonomyUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; domainId?: string; processes?: Process[] }>).detail;
      if (!detail?.projectId || detail.projectId !== projectScope?.projectId || !detail.domainId || !Array.isArray(detail.processes)) return;
      setTaxonomyOverrides((prev) => ({ ...prev, [detail.domainId!]: detail.processes! }));
    };
    window.addEventListener("pmis:taxonomy-updated", onTaxonomyUpdated);
    return () => window.removeEventListener("pmis:taxonomy-updated", onTaxonomyUpdated);
  }, [projectScope?.projectId]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_STORE_KEY, JSON.stringify(groupState));
    } catch {
      /* حافظه در دسترس نیست — نادیده */
    }
  }, [groupState]);

  const toggleDomain = (id: string) => {
    // System administration is global; it never requires an industry/project context.
    if (id === "d7") {
      onNavigate({ moduleId: "d7", clusterId: "", projectId: "" });
      return;
    }
    setOpenDomain((prev) => (prev === id ? null : id));
    setSelCluster(projectScope?.clusterId ?? "");
    setSelProject(projectScope?.projectId ?? "");
  };

  /* پرش میان‌بر: گروه میزبان باز می‌شود و فرم ورود همان حوزه باز می‌ماند. */
  const jumpToDomain = (id: string) => {
    const d = domains.find((x) => x.id === id);
    if (!d) return;
    if (d.group === "support") {
      setGroupState((s) => ({ ...s, supportOpen: true }));
    } else {
      setGroupState((s) => ({ ...s, open: d.group }));
    }
    setOpenDomain(id);
    setSelCluster(projectScope?.clusterId ?? "");
    setSelProject(projectScope?.projectId ?? "");
  };

  const toggleGroup = (id: string, pinned?: boolean) => {
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

  /* شمارندهٔ چارچوب از خودِ داده مشتق می‌شود، نه متن ثابت — و فقط همانی را
   * می‌شمارد که کاربر اجازهٔ دیدنش را دارد تا عدد با فهرست یکی باشد. */
  const domainCount = visibleDomains.length;
  const processCount = visibleDomains.reduce((n, d) => n + d.processes.length, 0);
  const subCount = visibleDomains.reduce(
    (n, d) => n + d.processes.reduce((m, p) => m + p.subs.length, 0),
    0,
  );
  const faDigits = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });


  const q = query.trim().toLowerCase();
  const matchesQuery = (d: Domain) => {
    if (!q) return true;
    const hay = [
      d.id,
      d.title.fa, d.title.en,
      ...d.processes.flatMap((p) => [p.id, p.title.fa, p.title.en, ...p.subs.flatMap((s) => [s.id, s.title.fa, s.title.en])]),
    ].join(" ").toLowerCase();
    return q.split(/\s+/).every((part) => hay.includes(part));
  };
  const searching = q.length > 0;
  const searchHits = searching ? visibleDomains.filter(matchesQuery) : [];

  const groupCounts = (ids: Domain[]) => ({
    dc: ids.length,
    pc: ids.reduce((n, d) => n + d.processes.length, 0),
  });

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
          <h3 className="min-w-0 flex-1 truncate text-[11px] font-normal leading-4" style={{ color: d.accent }}>
            {t(d.title, lang)}
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

  return (
    <aside dir={rtl ? "rtl" : "ltr"} className="glass-dark flex h-full w-[320px] shrink-0 flex-col rounded-2xl">
      <header className="b-line border-b px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="chip-bg grid h-7 w-7 place-items-center rounded-lg text-[13px]">🧩</span>
          <div className="min-w-0">
            <h2 className="truncate text-[12.5px] font-normal tx1">{t(ui.frameworkTitle, lang)}</h2>
            <p className="mt-0.5 text-[9.5px] font-extralight tx3">
{rtl
                ? `${faDigits(domainCount)} حوزه · ${faDigits(processCount)} فرآیند · ${faDigits(subCount)} زیرفرآیند`
                : `${domainCount} Domains · ${processCount} Processes · ${subCount} Sub-processes`}
            </p>
          </div>
        </div>

        {/* جست‌وجوی زندهٔ حوزه / فرآیند / زیرفرآیند */}
        <div className="relative mt-2.5">
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

        {/* میان‌بر حوزه‌ها */}
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {domainShortcuts.map((s) => {
            const d = domains.find((x) => x.id === s.id);
            if (!d) return null;
            const active = openDomain === d.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpToDomain(s.id)}
                title={t(d.title, lang)}
                className={`flex min-w-0 items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[9px] font-light transition ${active ? "row-on" : "b-line-soft bg-black/10 tx2 hover:tx1"}`}
                style={active ? { borderColor: d.accent, color: d.accent } : undefined}
              >
                <span className="text-[12px] leading-none">{s.icon}</span>
                <span className="truncate">{t(d.title, lang).split(" ").slice(0, 2).join(" ")}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto px-3 py-3">
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
            {sidebarGroups.map((g) => {
              const members = visibleDomains.filter((d) => d.group === g.id);
              if (!members.length) return null;
              const isOpen = g.pinned ? supportOpen : openGroup === g.id;
              const { dc, pc } = groupCounts(members);
              return (
                <div key={g.id} className="border-b b-line-soft pb-1.5 last:border-b-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.id, g.pinned)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition hover:bg-[var(--row-hover)]"
                    style={isOpen ? { background: `${g.color}14` } : undefined}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: g.color }} />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium" style={{ color: g.color }}>
                      {t(g.title, lang)}
                    </span>
                    <span className="shrink-0 text-[8.5px] font-extralight tabular-nums tx4">
                      {rtl ? `${faDigits(dc)} حوزه · ${faDigits(pc)} فرآیند` : `${dc} · ${pc}`}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                         className={`h-3 w-3 shrink-0 tx4 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="fade-rise mt-1 border-s-2 ps-2" style={{ borderColor: `${g.color}33` }}>
                      {members.map(renderDomain)}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
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
