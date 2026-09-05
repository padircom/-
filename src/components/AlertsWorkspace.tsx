import { useMemo, useState } from "react";
import { type Bi, type Lang, t } from "../data/framework";
import { useSystem } from "../context/SystemContext";

type AlertStatus = "open" | "acknowledged" | "resolved";
type Severity = "critical" | "warning" | "info";

type AlertItem = {
  id: string;
  title: Bi;
  source: string;
  time: string;
  severity: Severity;
  status: AlertStatus;
};

const seedAlerts: AlertItem[] = [
  {
    id: "alt-01",
    title: { fa: "تأخیر تامین اقلام Long Lead از آستانه هشدار عبور کرد", en: "Long-lead procurement delay crossed the warning threshold" },
    source: "Procurement / Schedule",
    time: "12m",
    severity: "critical",
    status: "open",
  },
  {
    id: "alt-02",
    title: { fa: "SPI برنامه پایه کمتر از ۱ ثبت شده است", en: "Baseline SPI is recorded below 1.00" },
    source: "EVM_Transaction",
    time: "35m",
    severity: "warning",
    status: "open",
  },
  {
    id: "alt-03",
    title: { fa: "گزارش روزانه کارگاه نیازمند بازبینی ناظر است", en: "Daily site report requires resident engineer review" },
    source: "Daily_Report",
    time: "1h",
    severity: "warning",
    status: "acknowledged",
  },
  {
    id: "alt-04",
    title: { fa: "همگام سازی Primavera P6 با موفقیت تکمیل شد", en: "Primavera P6 synchronization completed successfully" },
    source: "Primavera P6",
    time: "2h",
    severity: "info",
    status: "resolved",
  },
  {
    id: "alt-05",
    title: { fa: "موجودی یکی از مصالح کلیدی به سطح کنترل رسید", en: "One critical material inventory item reached its control level" },
    source: "Material_Register",
    time: "3h",
    severity: "critical",
    status: "open",
  },
];

const severityMeta: Record<Severity, { color: string; label: Bi }> = {
  critical: { color: "#F87171", label: { fa: "بحرانی", en: "Critical" } },
  warning: { color: "#FBBF24", label: { fa: "هشدار", en: "Warning" } },
  info: { color: "#7FB2FF", label: { fa: "اطلاعی", en: "Informational" } },
};

const statusMeta: Record<AlertStatus, Bi> = {
  open: { fa: "باز", en: "Open" },
  acknowledged: { fa: "مشاهده شد", en: "Acknowledged" },
  resolved: { fa: "بسته شده", en: "Resolved" },
};

export default function AlertsWorkspace({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster, projectScope } = useSystem();
  const [alerts, setAlerts] = useState(seedAlerts);
  const [filter, setFilter] = useState<AlertStatus | "all">("all");

  const visibleAlerts = useMemo(
    () => (filter === "all" ? alerts : alerts.filter((alert) => alert.status === filter)),
    [alerts, filter]
  );
  const openCount = alerts.filter((alert) => alert.status === "open").length;
  const criticalCount = alerts.filter((alert) => alert.status === "open" && alert.severity === "critical").length;
  const scopeCluster = clusters.find((cluster) => cluster.id === projectScope?.clusterId);
  const scopeProject = projectScope ? projectsByCluster[projectScope.clusterId]?.find((project) => project.id === projectScope.projectId) : undefined;

  const move = (id: string, status: AlertStatus) => {
    setAlerts((current) => current.map((alert) => (alert.id === id ? { ...alert, status } : alert)));
  };

  return (
    <div className="glass flex h-full min-h-0 flex-col rounded-2xl p-4" dir={rtl ? "rtl" : "ltr"}>
      <header className="mb-3 flex flex-wrap items-center gap-2 border-b b-line-soft pb-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-rose-400/40 bg-rose-400/10 text-[17px]">⚠</span>
        <div>
          <h2 className="text-[14px] font-medium tx1">{rtl ? "مرکز هشدارها و اعلان‌ها" : "Alerts & Notifications Center"}</h2>
          <p className="text-[9px] font-extralight tx3">{rtl ? "هشدارهای نمونه از برنامه، منابع و گزارش‌های پروژه" : "Demo alerts from schedule, sources, and project reports"}</p>
          {scopeCluster && scopeProject && (
            <p className="mt-0.5 truncate text-[8.5px] font-light text-rose-200">
              {t(scopeCluster.title, lang)} · <span dir="ltr">{scopeProject.code}</span> · {t(scopeProject.name, lang)}
            </p>
          )}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <span className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-2.5 py-1 text-[10px] font-light text-rose-300">
            {criticalCount} {rtl ? "بحرانی" : "critical"}
          </span>
          <span className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-light text-amber-200">
            {openCount} {rtl ? "باز" : "open"}
          </span>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", "open", "acknowledged", "resolved"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-lg border px-2.5 py-1 text-[10px] font-light transition ${
              filter === key ? "toggle-on tx1" : "b-line-soft tx3 hover:tx2"
            }`}
          >
            {key === "all" ? (rtl ? "همه" : "All") : t(statusMeta[key], lang)}
          </button>
        ))}
      </div>

      <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto">
        {visibleAlerts.map((alert) => {
          const meta = severityMeta[alert.severity];
          return (
            <div key={alert.id} className="glass-row flex flex-wrap items-center gap-3 rounded-xl border-s-2 p-3" style={{ borderInlineStartColor: meta.color }}>
              <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
              <div className="min-w-[240px] flex-1">
                <div className="text-[11px] font-light tx1">{t(alert.title, lang)}</div>
                <div className="mt-1 flex items-center gap-2 text-[8.5px] font-extralight tx3" dir="ltr">
                  <span>{alert.source}</span><span>·</span><span>{alert.time}</span>
                </div>
              </div>
              <span className="rounded-md px-2 py-0.5 text-[9px] font-light" style={{ background: `${meta.color}16`, color: meta.color }}>
                {t(meta.label, lang)}
              </span>
              <span className="rounded-md border b-line-soft px-2 py-0.5 text-[9px] font-light tx3">
                {t(statusMeta[alert.status], lang)}
              </span>
              {alert.status === "open" && (
                <button onClick={() => move(alert.id, "acknowledged")} className="rounded-lg border border-sky-400/45 bg-sky-400/10 px-2.5 py-1 text-[9.5px] text-sky-200">
                  {rtl ? "مشاهده شد" : "Acknowledge"}
                </button>
              )}
              {alert.status !== "resolved" && (
                <button onClick={() => move(alert.id, "resolved")} className="rounded-lg border border-emerald-400/45 bg-emerald-400/10 px-2.5 py-1 text-[9.5px] text-emerald-300">
                  {rtl ? "بستن" : "Resolve"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <footer className="mt-3 flex items-center gap-2 border-t b-line-soft pt-2">
        <span className="pulse-dot h-[7px] w-[7px] rounded-full bg-emerald-400" />
        <span className="text-[9px] font-extralight tx3">{rtl ? "داده‌های نمایشی از" : "Demo data from"}</span>
        <span className="text-[9px] font-light ok-dim-t" dir="ltr">Alert_Register · Schedule · Daily_Report · Material_Register</span>
      </footer>
    </div>
  );
}