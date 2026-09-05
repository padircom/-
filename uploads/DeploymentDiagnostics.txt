import { useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import { getSyncQueueStats } from "../services/syncQueue";
import { loadSqlConfig, testConnection, type ConnectionStatus } from "../services/sqlServer";
import { logAudit } from "../services/auditLogger";

type CheckStatus = "ready" | "attention" | "blocked" | "running";
type Check = { id: string; title: string; detail: string; status: CheckStatus };

export default function DeploymentDiagnostics({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const staticChecks = useMemo<Check[]>(() => {
    let storage = "ready" as CheckStatus;
    try {
      const key = "pmis:diagnostic-write";
      localStorage.setItem(key, "ok");
      localStorage.removeItem(key);
    } catch {
      storage = "blocked";
    }
    const queue = getSyncQueueStats();
    return [
      { id: "storage", title: "Browser storage", detail: storage === "ready" ? "localStorage read/write available" : "localStorage unavailable", status: storage },
      { id: "transport", title: "Secure transport", detail: window.isSecureContext ? "HTTPS secure context" : "Use HTTPS in production (localhost is acceptable for development)", status: window.isSecureContext ? "ready" : "attention" },
      { id: "queue", title: "Offline sync queue", detail: `${queue.pending} pending · ${queue.failed} failed · ${queue.synced} synced`, status: queue.failed > 0 ? "attention" : "ready" },
      { id: "api-config", title: "API configuration", detail: `${loadSqlConfig().apiBaseUrl} · ${loadSqlConfig().database}`, status: loadSqlConfig().apiBaseUrl ? "ready" : "blocked" },
    ];
  }, []);

  const run = async () => {
    setRunning(true);
    setChecks(staticChecks.map((x) => ({ ...x, status: x.id === "api-config" ? "running" : x.status })));
    const cfg = loadSqlConfig();
    let sqlStatus: ConnectionStatus = "offline";
    try {
      sqlStatus = (await testConnection(cfg)).status;
    } catch {
      sqlStatus = "error";
    }
    const aiReady = cfg.apiBaseUrl.length > 0;
    const queue = getSyncQueueStats();
    const next: Check[] = [
      ...staticChecks.filter((x) => x.id !== "api-config"),
      { id: "sql", title: rtl ? "اتصال SQL Server" : "SQL Server channel", detail: sqlStatus === "connected" ? (rtl ? "اتصال واقعی برقرار است" : "Live connection established") : (rtl ? "API یا SQL در دسترس نیست؛ حالت آفلاین فعال است" : "API/SQL unavailable; offline mode is active"), status: sqlStatus === "connected" ? "ready" : "attention" },
      { id: "ai", title: rtl ? "درگاه AI" : "AI gateway", detail: aiReady ? (rtl ? "مسیر API آماده تست است" : "API route is configured for testing") : (rtl ? "مسیر API تعریف نشده" : "API route is not configured"), status: aiReady ? "ready" : "blocked" },
      { id: "queue-live", title: rtl ? "صف همگام‌سازی" : "Sync queue", detail: `${queue.pending} pending · ${queue.failed} failed`, status: queue.failed ? "attention" : "ready" },
    ];
    setChecks(next);
    setLastRun(new Date().toLocaleTimeString(rtl ? "fa-IR" : "en-GB"));
    logAudit("DEPLOYMENT_DIAGNOSTICS", "Security & Deployment", `SQL=${sqlStatus}; QueuePending=${queue.pending}`);
    setRunning(false);
  };

  const tone = (s: CheckStatus) => s === "ready" ? "#34D399" : s === "blocked" ? "#F87171" : s === "running" ? "#7FB2FF" : "#FBBF24";

  return (
    <section className="glass-dark shrink-0 rounded-2xl p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div>
          <h4 className="text-[11px] font-normal tx1">{rtl ? "تست عملیاتی و آمادگی استقرار" : "Operational & Deployment Diagnostics"}</h4>
          <p className="text-[8.5px] font-extralight tx3">{rtl ? "تست runtime، اتصال API/SQL و وضعیت صف آفلاین" : "Runtime, API/SQL channel and offline queue checks"}</p>
        </div>
        <button onClick={run} disabled={running} className="ms-auto rounded-lg border border-sky-400/50 bg-sky-400/10 px-3 py-1.5 text-[9.5px] text-sky-200 disabled:opacity-50">⚡ {running ? (rtl ? "در حال بررسی…" : "Checking…") : (rtl ? "اجرای تست‌ها" : "Run checks")}</button>
      </div>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        {(checks.length ? checks : staticChecks).map((check) => (
          <div key={check.id} className="glass-row flex items-start gap-2 rounded-xl px-2.5 py-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: tone(check.status) }} />
            <div className="min-w-0 flex-1"><div className="text-[9.5px] font-light tx1">{check.title}</div><div className="truncate text-[8px] font-extralight tx3">{check.detail}</div></div>
            <span className="text-[8px] font-light" style={{ color: tone(check.status) }}>{check.status === "ready" ? (rtl ? "آماده" : "Ready") : check.status === "blocked" ? (rtl ? "مسدود" : "Blocked") : check.status === "running" ? (rtl ? "در حال تست" : "Running") : (rtl ? "نیازمند اقدام" : "Attention")}</span>
          </div>
        ))}
      </div>
      {lastRun && <div className="mt-2 text-end text-[8px] font-extralight tx4">{rtl ? "آخرین تست:" : "Last check:"} {lastRun}</div>}
    </section>
  );
}