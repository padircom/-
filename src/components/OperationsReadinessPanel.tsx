import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { loadSqlConfig } from "../services/sqlServer";
import { type Lang } from "../data/framework";

type CheckStatus = "pass" | "warn" | "fail" | "blocked" | "running";

type Check = {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  group: "client" | "backend" | "database" | "integration" | "operations";
};

type RemoteReadiness = {
  status: string;
  service: string;
  version: string;
  uptimeSeconds: number;
  checks: Array<{ key: string; label: string; status: Exclude<CheckStatus, "running">; detail: string }>;
  summary: { total: number; passed: number; warnings: number; failures: number };
};

const statusStyle: Record<CheckStatus, { color: string; fa: string; en: string }> = {
  pass: { color: "#34D399", fa: "تایید", en: "Pass" },
  warn: { color: "#FBBF24", fa: "هشدار", en: "Warning" },
  fail: { color: "#F87171", fa: "ناموفق", en: "Failed" },
  blocked: { color: "#94A3B8", fa: "مسدود", en: "Blocked" },
  running: { color: "#7FB2FF", fa: "در حال بررسی", en: "Running" },
};

const groupLabel: Record<Check["group"], { fa: string; en: string }> = {
  client: { fa: "رابط کاربری", en: "Client" },
  backend: { fa: "Backend API", en: "Backend API" },
  database: { fa: "SQL Server", en: "SQL Server" },
  integration: { fa: "یکپارچگی‌ها", en: "Integrations" },
  operations: { fa: "عملیات و امنیت", en: "Operations & Security" },
};

export default function OperationsReadinessPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { user, can, audit } = useAuth();
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runChecks = async () => {
    const cfg = loadSqlConfig();
    setRunning(true);
    setChecks([
      { key: "browser", label: "React application runtime", status: "pass", detail: navigator.userAgent, group: "client" },
      { key: "storage", label: "Browser fallback storage", status: "pass", detail: "localStorage available", group: "client" },
      { key: "auth", label: "RBAC session", status: user ? "pass" : "fail", detail: user ? `${user.username} / ${user.role}` : "no active user", group: "operations" },
      { key: "tls", label: "HTTPS transport", status: location.protocol === "https:" || location.hostname === "localhost" ? "pass" : "warn", detail: location.protocol, group: "operations" },
      { key: "api", label: "PMIS Backend API", status: "running", detail: cfg.apiBaseUrl, group: "backend" },
    ]);

    try {
      const response = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}/diagnostics/readiness`, {
        headers: { "X-Sql-Server": cfg.server, "X-Sql-Database": cfg.database },
      });
      const payload = await response.json() as { data?: RemoteReadiness; error?: { message?: string } };
      if (!payload.data) throw new Error(payload.error?.message || `HTTP ${response.status}`);
      const remote = payload.data;
      const remoteChecks: Check[] = remote.checks.map((check) => ({
        ...check,
        group: check.key === "database" || check.key === "schema"
          ? "database"
          : check.key.startsWith("integration-")
            ? "integration"
            : check.key === "runtime"
              ? "backend"
              : "operations",
      }));
      setChecks((current) => [
        ...current.filter((check) => check.key !== "api"),
        { key: "api", label: "PMIS Backend API", status: "pass", detail: `${remote.service} v${remote.version} · uptime ${remote.uptimeSeconds}s`, group: "backend" },
        ...remoteChecks,
      ]);
    } catch (error) {
      setChecks((current) => current.map((check) => check.key === "api" ? { ...check, status: "fail", detail: error instanceof Error ? error.message : "backend unavailable" } : check));
    } finally {
      const now = new Date().toISOString();
      setLastRun(now);
      setRunning(false);
      audit("RUN_OPERATIONS_READINESS", { entity: "System", entityId: "readiness" });
    }
  };

  useEffect(() => { void runChecks(); }, []);

  const score = useMemo(() => {
    const finished = checks.filter((check) => check.status !== "running");
    if (!finished.length) return 0;
    const points = finished.reduce((sum, check) => sum + (check.status === "pass" ? 1 : check.status === "warn" ? 0.5 : 0), 0);
    return Math.round((points / finished.length) * 100);
  }, [checks]);

  const grouped = useMemo(() => (Object.keys(groupLabel) as Check["group"][]).map((group) => ({ group, items: checks.filter((check) => check.group === group) })), [checks]);

  const exportReport = () => {
    const report = { generatedAt: new Date().toISOString(), score, user: user?.username, checks };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `PMIS_Readiness_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    audit("EXPORT_READINESS_REPORT", { entity: "System", entityId: "readiness" });
  };

  const passed = checks.filter((check) => check.status === "pass").length;
  const warnings = checks.filter((check) => check.status === "warn" || check.status === "blocked").length;
  const failed = checks.filter((check) => check.status === "fail").length;

  return (
    <div className="fade-rise flex min-h-0 flex-col gap-3" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border text-[18px] font-semibold" style={{ borderColor: score >= 80 ? "#34D39988" : score >= 55 ? "#FBBF2488" : "#F8717188", color: score >= 80 ? "#34D399" : score >= 55 ? "#FBBF24" : "#F87171" }}>{score}%</div>
          <div>
            <h3 className="text-[13px] font-medium tx1">{rtl ? "آمادگی استقرار و بهره‌برداری" : "Deployment & Operations Readiness"}</h3>
            <p className="mt-0.5 text-[9px] font-extralight tx3">{rtl ? "بررسی Frontend، Backend، SQL Server، امنیت، اتصال‌ها و بکاپ" : "Checks client, backend, SQL Server, security, integrations, and backup"}</p>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[9px] text-emerald-300">{passed} {rtl ? "تایید" : "passed"}</span>
            <span className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[9px] text-amber-200">{warnings} {rtl ? "هشدار" : "warnings"}</span>
            <span className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-[9px] text-rose-300">{failed} {rtl ? "ناموفق" : "failed"}</span>
            <button onClick={() => void runChecks()} disabled={running || !can("system.manage")} className="rounded-lg border border-sky-400/50 bg-sky-400/10 px-2.5 py-1 text-[9.5px] text-sky-200 disabled:opacity-40">{running ? (rtl ? "در حال بررسی…" : "Checking…") : (rtl ? "اجرای مجدد" : "Run again")}</button>
            <button onClick={exportReport} className="rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] tx2 hover:tx1">⬇ {rtl ? "خروجی گزارش" : "Export"}</button>
          </div>
        </div>
        {lastRun && <div className="mt-2 text-[8px] font-extralight tx4" dir="ltr">Last check: {lastRun}</div>}
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {grouped.filter(({ items }) => items.length > 0).map(({ group, items }) => (
          <section key={group} className="glass-dark rounded-2xl p-3">
            <h4 className="mb-2 border-b b-line-soft pb-2 text-[11px] font-normal tx1">{groupLabel[group][lang]}</h4>
            <div className="space-y-1.5">
              {items.map((check) => {
                const meta = statusStyle[check.status];
                return (
                  <div key={check.key} className="glass-row flex items-center gap-2 rounded-xl px-2.5 py-2">
                    <i className={`h-2 w-2 shrink-0 rounded-full ${check.status === "running" ? "pulse-dot" : ""}`} style={{ background: meta.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[9.5px] font-light tx1">{check.label}</div>
                      <div className="mt-0.5 truncate text-[8px] font-extralight tx4" dir="ltr">{check.detail}</div>
                    </div>
                    <span className="rounded-md px-1.5 py-0.5 text-[8px] font-light" style={{ background: `${meta.color}18`, color: meta.color }}>{meta[lang]}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="glass-dark rounded-2xl p-3">
        <h4 className="text-[11px] font-normal tx1">{rtl ? "تفسیر نتیجه" : "Result Interpretation"}</h4>
        <p className="mt-1 text-[9.5px] font-light leading-5 tx3">{rtl ? "موفقیت Build فقط صحت کد Frontend را تایید می‌کند. موارد SQL Server، بکاپ، ذخیره فایل و اتصال‌های بیرونی زمانی تایید می‌شوند که Backend با فایل server/.env روی شبکه عملیاتی اجرا شود." : "A successful build verifies frontend code only. SQL Server, backup, file storage, and external connectors are verified only after the backend runs with server/.env on the target network."}</p>
      </section>
    </div>
  );
}
