import { useMemo, useState } from "react";
import {
  statusMeta,
  ui,
  t,
  type Lang,
  type ProjectStatus,
} from "../data/framework";
import { useSystem } from "../context/SystemContext";
import {
  KpiRingBar,
  StatusDonut,
  BudgetBarChart,
  ClusterStatusHeatmap,
} from "./PortfolioCharts";

type Props = {
  lang: Lang;
  selected: string | null;
  onSelect: (id: string | null) => void;
  activeProjectId: string | null;
  onOpenProject: (clusterId: string, projectId: string) => void;
};

function MiniRing({ value, color }: { value: number; color: string }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 -rotate-90">
      <circle className="s-track" cx="20" cy="20" r={r} fill="none" strokeWidth="2" />
      <circle
        cx="20" cy="20" r={r}
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
      <text
        className="f-ink rotate-90"
        style={{ transformOrigin: "20px 20px" }}
        x="20" y="20"
        textAnchor="middle" dominantBaseline="central"
        fontSize="9"
      >
        {value}
      </text>
    </svg>
  );
}

export default function PortfolioPanel({ lang, selected, onSelect, activeProjectId, onOpenProject }: Props) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster } = useSystem();
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");

  const activeCluster = clusters.find((c) => c.id === selected) ?? null;
  const projects = useMemo(() => {
    const list = activeCluster ? projectsByCluster[activeCluster.id] ?? [] : [];
    return filter === "all" ? list : list.filter((p) => p.status === filter);
  }, [activeCluster, filter, projectsByCluster]);

  return (
    <section dir={rtl ? "rtl" : "ltr"} className="flex h-full min-h-0 w-full flex-col gap-2">
      {/* ═══ Analytics strip: KPI dials + status donut + budget bars ═══ */}
      <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)_minmax(0,1.3fr)]">
        <KpiRingBar lang={lang} />
        <StatusDonut lang={lang} />
        <BudgetBarChart lang={lang} selected={selected} onPick={(id) => { onSelect(selected === id ? null : id); setFilter("all"); }} />
      </div>

      {/* ═══ Cluster × Status heatmap + compact cluster strip ═══ */}
      <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <ClusterStatusHeatmap lang={lang} />

        <div className="glass-dark rounded-2xl px-2 py-2">
          <div className="mb-1 flex items-center gap-2 px-1">
            <span className="text-[10px] font-normal tx1">{t(ui.clustersTitle, lang)}</span>
            <span className="text-[8.5px] font-extralight tx4">{rtl ? "برای مشاهده پروژه‌ها انتخاب کنید" : "Pick a cluster to see projects"}</span>
          </div>
          <div className="grid grid-cols-1 gap-1 md:grid-cols-2 xl:grid-cols-3">
            {clusters.map((c) => {
              const on = selected === c.id;
              const total = c.active + c.tender + c.stopped + c.completed;
              return (
                <button
                  key={c.id}
                  onClick={() => { onSelect(on ? null : c.id); setFilter("all"); }}
                  className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-start transition ${on ? "ring-1" : ""}`}
                  style={{
                    background: on ? `${c.color}18` : "var(--row)",
                    borderColor: on ? c.color : "var(--line-soft)",
                    ["--tw-ring-color" as string]: `${c.color}88`,
                  }}
                >
                  <MiniRing value={c.progress} color={c.color} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] font-light tx1">{t(c.title, lang)}</div>
                    <div className="text-[8px] font-extralight tx3">{total} {t(ui.projects, lang)}</div>
                  </div>
                  <span className="text-[12px] opacity-60">{c.icon}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Projects call-out panel */}
      <div className="glass-dark flex min-h-0 flex-1 flex-col rounded-2xl">
        <div className="b-line-soft flex flex-wrap items-center gap-2 border-b px-3 py-2">
          {activeCluster ? (
            <>
              <span
                className="grid h-6 w-6 place-items-center rounded-md text-[13px]"
                style={{ background: `${activeCluster.color}20`, border: `1px solid ${activeCluster.color}66` }}
              >
                {activeCluster.icon}
              </span>
              <span className="text-[11.5px] font-normal tx1">
                {rtl ? "پروژه‌های خوشه:" : "Cluster projects:"} {t(activeCluster.title, lang)}
              </span>
              <span className="text-[9px] font-extralight tx3">
                · {projects.length} / {(projectsByCluster[activeCluster.id] ?? []).length} {t(ui.projects, lang)}
              </span>

              {/* status filter chips */}
              <div className="ms-auto flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded-md border px-2 py-0.5 text-[9.5px] font-light transition ${
                    filter === "all" ? "b-line tx1 chip-bg" : "b-line-soft tx3 hover:tx2"
                  }`}
                >
                  {rtl ? "همه" : "All"}
                </button>
                {(Object.keys(statusMeta) as ProjectStatus[]).map((k) => {
                  const on = filter === k;
                  const meta = statusMeta[k];
                  return (
                    <button
                      key={k}
                      onClick={() => setFilter(on ? "all" : k)}
                      className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9.5px] font-light transition"
                      style={{
                        borderColor: on ? meta.color : "var(--line-soft)",
                        background: on ? `${meta.color}1a` : "transparent",
                        color: on ? meta.color : "var(--ink3)",
                      }}
                    >
                      <i className="h-[6px] w-[6px] rounded-full" style={{ background: meta.color }} />
                      {t(meta.label, lang)}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <span className="text-[10.5px] font-extralight tx3">
              {rtl
                ? "برای مشاهده لیست پروژه‌ها، یکی از خوشه‌های صنعتی بالا را انتخاب کنید."
                : "Select an industrial cluster above to load its portfolio projects."}
            </span>
          )}
        </div>

        {/* Project rows — 2-column grid to avoid vertical scroll */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {activeCluster && projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
              {projects.map((p) => {
                const meta = statusMeta[p.status];
                const isActiveProject = activeProjectId === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => onOpenProject(activeCluster.id, p.id)}
                    aria-pressed={isActiveProject}
                    className={`glass-row grid w-full grid-cols-12 items-center gap-2 rounded-xl px-3 py-2 text-start ${isActiveProject ? "row-on" : ""}`}
                    style={{
                      borderInlineStartWidth: 2,
                      borderInlineStartColor: meta.color,
                      boxShadow: isActiveProject ? `inset 0 0 0 1px ${meta.color}66` : undefined,
                    }}
                  >
                    <div className="col-span-2 flex items-center gap-1.5">
                      <span className="text-[9px] font-extralight tracking-wider tx4" dir="ltr">
                        {p.code}
                      </span>
                    </div>
                    <div className="col-span-5 min-w-0">
                      <div className="truncate text-[11px] font-light tx1">{t(p.name, lang)}</div>
                      <div className="mt-0.5 truncate text-[9px] font-extralight tx3">
                        {t(p.client, lang)} · {t(p.location, lang)}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5">
                      <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: meta.color }} />
                      <span className="text-[10px] font-light" style={{ color: meta.color }}>
                        {t(meta.label, lang)}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--ring-track)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${p.progress}%`, background: meta.color }}
                        />
                      </div>
                      <span className="w-8 text-end text-[10px] font-light tabular-nums tx2">
                        {p.progress.toLocaleString(rtl ? "fa-IR" : "en-US")}٪
                      </span>
                    </div>
                    <div className="col-span-1 text-end text-[10px] font-light tabular-nums tx2" dir="ltr">
                      {p.budget}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : activeCluster ? (
            <div className="flex h-full items-center justify-center text-[10px] font-extralight tx4">
              {rtl ? "پروژه‌ای با این فیلتر یافت نشد." : "No projects match this filter."}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] font-extralight tx4">
              {rtl ? "یک خوشه صنعتی انتخاب کنید…" : "Pick a cluster…"}
            </div>
          )}
        </div>

        {/* Footnote */}
        <div className="b-line-soft flex items-center gap-2 border-t px-3 py-1.5">
          <span className="pulse-dot h-[7px] w-[7px] rounded-full bg-emerald-400" />
          <span className="text-[9.5px] font-extralight tx3" dir="ltr">
            {t(ui.footnote, lang)}
          </span>
          <span className="ms-auto text-[9px] font-extralight ok-dim-t">{t(ui.live, lang)}</span>
        </div>
      </div>
    </section>
  );
}
