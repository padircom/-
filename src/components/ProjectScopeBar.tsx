import { useSystem } from "../context/SystemContext";
import { t, type Lang } from "../data/framework";

type Props = {
  lang: Lang;
  onScopeChange?: (clusterId: string, projectId: string) => void;
};

export default function ProjectScopeBar({ lang, onScopeChange }: Props) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster, projectScope, setProjectScope } = useSystem();
  const activeClusterId = projectScope?.clusterId ?? clusters[0]?.id ?? "";
  const projects = projectsByCluster[activeClusterId] ?? [];
  const activeProjectId = projectScope?.projectId ?? projects[0]?.id ?? "";

  const applyScope = (clusterId: string, projectId: string) => {
    if (!clusterId || !projectId) return;
    setProjectScope({ clusterId, projectId });
    onScopeChange?.(clusterId, projectId);
  };

  return (
    <div className="glass-dark flex shrink-0 flex-wrap items-center gap-2 rounded-xl px-3 py-1.5" dir={rtl ? "rtl" : "ltr"}>
      <span className="flex items-center gap-1.5 text-[9.5px] font-light tx3">
        <i className="pulse-dot h-[6px] w-[6px] rounded-full bg-emerald-400" />
        {rtl ? "کانتکست کاری:" : "Working scope:"}
      </span>
      <select
        value={activeClusterId}
        onChange={(e) => {
          const nextCluster = e.target.value;
          const nextProject = projectsByCluster[nextCluster]?.[0]?.id ?? "";
          applyScope(nextCluster, nextProject);
        }}
        className="max-w-[150px] rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1 text-[9.5px] font-light tx1 outline-none focus:border-[var(--accent)]"
        style={{ colorScheme: "dark" }}
      >
        {clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.icon} {t(cluster.title, lang)}</option>)}
      </select>
      <select
        value={activeProjectId}
        onChange={(e) => applyScope(activeClusterId, e.target.value)}
        disabled={projects.length === 0}
        className="min-w-[180px] flex-1 rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1 text-[9.5px] font-light tx1 outline-none focus:border-[var(--accent)] disabled:opacity-40"
        style={{ colorScheme: "dark" }}
      >
        {projects.length === 0 ? (
          <option value="">{rtl ? "پروژه‌ای تعریف نشده" : "No projects defined"}</option>
        ) : (
          projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {t(project.name, lang)}</option>)
        )}
      </select>
    </div>
  );
}