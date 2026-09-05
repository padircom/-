import { useMemo, useRef, useState } from "react";
import { type Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import { getAuditLogs, logAudit } from "../services/auditLogger";
import { BACKUP_VERSION, downloadJson, getSecurityChecks, validateBackup, type BackupPayload } from "../services/security";
import DeploymentDiagnostics from "./DeploymentDiagnostics";

export default function SecurityWorkspace({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { user, isAuthenticated, logout } = useAuth();
  const { clusters, projectsByCluster, settings, sqlStatus, restoreSystemData, syncQueueStats, flushPendingSync } = useSystem();
  const restoreRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");
  const [lastBackupAt, setLastBackupAt] = useState(() => localStorage.getItem("pmis:last-backup-at"));
  const [confirmRestore, setConfirmRestore] = useState<BackupPayload | null>(null);

  const totalProjects = Object.values(projectsByCluster).reduce((sum, items) => sum + items.length, 0);
  const auditLogs = getAuditLogs();
  const checks = useMemo(() => getSecurityChecks({
    authenticated: isAuthenticated,
    role: user?.role ?? "none",
    sqlConfigured: Boolean(settings.sqlConnectionString && settings.databaseName),
    sqlStatus,
    hasBackup: Boolean(lastBackupAt),
  }), [isAuthenticated, lastBackupAt, settings.databaseName, settings.sqlConnectionString, sqlStatus, user?.role]);

  const snapshot = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    clusters,
    projectsByCluster,
    settings,
    auditLogs,
  };

  const exportBackup = () => {
    downloadJson(snapshot, `PMIS_FullBackup_${new Date().toISOString().slice(0, 10)}.json`);
    localStorage.setItem("pmis:last-backup-at", snapshot.exportedAt);
    setLastBackupAt(snapshot.exportedAt);
    logAudit("BACKUP_EXPORT", "Security & Deployment", `Exported ${clusters.length} clusters and ${totalProjects} projects`, "security");
    setMessageTone("ok");
    setMessage(rtl ? "پشتیبان معتبر با موفقیت ایجاد شد." : "Validated backup exported successfully.");
  };

  const loadBackup = async (file: File) => {
    try {
      const parsed = validateBackup(JSON.parse(await file.text()));
      if (!parsed.ok) {
        setMessageTone("error");
        setMessage(rtl ? `فایل پشتیبان معتبر نیست: ${parsed.error}` : `Invalid backup: ${parsed.error}`);
        return;
      }
      setConfirmRestore(parsed.data);
    } catch {
      setMessageTone("error");
      setMessage(rtl ? "خواندن فایل پشتیبان ممکن نیست." : "Backup file could not be read.");
    }
  };

  const doRestore = () => {
    if (!confirmRestore) return;
    restoreSystemData(confirmRestore);
    setConfirmRestore(null);
    setLastBackupAt(confirmRestore.exportedAt);
    setMessageTone("ok");
    setMessage(rtl ? "بازیابی با موفقیت انجام شد." : "Restore completed successfully.");
  };

  const flushQueue = async () => {
    await flushPendingSync();
    setMessageTone("ok");
    setMessage(rtl ? "درخواست ارسال صف همگام‌سازی انجام شد." : "Sync queue flush requested.");
  };

  const statusTone = (status: "ready" | "attention" | "blocked") =>
    status === "ready" ? "#34D399" : status === "blocked" ? "#F87171" : "#FBBF24";

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-rose-400/40 bg-rose-400/10 text-[15px]">🛡</span>
          <div>
            <h3 className="text-[12px] font-semibold tx1">{rtl ? "امنیت، پشتیبان‌گیری و استقرار" : "Security, Backup & Deployment"}</h3>
            <p className="text-[8.5px] font-extralight tx3">{rtl ? "کنترل نشست، سطح دسترسی، Snapshot معتبر و چک‌لیست محیط تولید" : "Session control, RBAC, validated snapshots and production readiness"}</p>
          </div>
          <span className="ms-auto rounded-lg border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-[9px] font-light text-sky-200" dir="ltr">{BACKUP_VERSION}</span>
        </div>
      </section>

      <DeploymentDiagnostics lang={lang} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <section className="glass-dark flex min-h-0 flex-col overflow-hidden rounded-2xl p-3">
          <div className="mb-2 flex items-center justify-between border-b b-line-soft pb-2">
            <div>
              <h4 className="text-[11px] font-normal tx1">{rtl ? "چک‌لیست آمادگی تولید" : "Production Readiness Checklist"}</h4>
              <p className="text-[8px] font-extralight tx3">{rtl ? "موارد آماده و موارد نیازمند اقدام" : "Ready checks and required actions"}</p>
            </div>
            <span className="text-[9px] font-light tx3">{checks.filter((x) => x.status === "ready").length}/{checks.length}</span>
          </div>
          <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto">
            {checks.map((check) => (
              <div key={check.id} className="glass-row flex items-start gap-2.5 rounded-xl p-2.5">
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: statusTone(check.status) }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-light tx1">{check.title}</div>
                  <div className="mt-0.5 text-[9px] font-extralight tx3">{check.detail}</div>
                </div>
                <span className="rounded px-2 py-0.5 text-[8.5px] font-light" style={{ color: statusTone(check.status), background: `${statusTone(check.status)}18` }}>
                  {check.status === "ready" ? (rtl ? "آماده" : "Ready") : check.status === "blocked" ? (rtl ? "مسدود" : "Blocked") : (rtl ? "نیازمند اقدام" : "Attention")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="glass-dark shrink-0 rounded-2xl p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12px]">💾</span>
              <h4 className="text-[11px] font-normal tx1">{rtl ? "Snapshot و بازیابی" : "Snapshot & Recovery"}</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border b-line-soft bg-black/10 p-2.5"><div className="text-[8.5px] tx3">{rtl ? "خوشه‌ها" : "Clusters"}</div><div className="mt-1 text-[17px] font-light tx1">{clusters.length}</div></div>
              <div className="rounded-xl border b-line-soft bg-black/10 p-2.5"><div className="text-[8.5px] tx3">{rtl ? "پروژه‌ها" : "Projects"}</div><div className="mt-1 text-[17px] font-light tx1">{totalProjects}</div></div>
            </div>
            <button onClick={exportBackup} className="mt-2 w-full rounded-lg border border-emerald-400/50 bg-emerald-400/12 px-3 py-2 text-[10px] font-light text-emerald-300 hover:bg-emerald-400/22">⬇ {rtl ? "خروجی پشتیبان معتبر" : "Export validated backup"}</button>
            <input ref={restoreRef} type="file" hidden accept="application/json,.json" onChange={(e) => e.target.files?.[0] && loadBackup(e.target.files[0])} />
            <button onClick={() => restoreRef.current?.click()} className="mt-2 w-full rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-[10px] font-light text-amber-300 hover:bg-amber-400/20">⬆ {rtl ? "انتخاب فایل برای بازیابی" : "Select backup to restore"}</button>
            <p className="mt-2 text-[8.5px] leading-4 tx4">{rtl ? "قبل از بازیابی، نسخه فایل و ساختار خوشه‌ها/پروژه‌ها اعتبارسنجی می‌شود." : "Backup version and cluster/project structure are validated before restore."}</p>
          </div>

          <div className="glass-dark shrink-0 rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[11px] font-normal tx1">{rtl ? "نشست فعال" : "Active Session"}</h4>
              <span className="text-[9px] text-emerald-300">● {isAuthenticated ? (rtl ? "معتبر" : "Valid") : (rtl ? "نامعتبر" : "Invalid")}</span>
            </div>
            <div className="space-y-1.5 text-[9.5px] tx3">
              <div className="flex justify-between"><span>{rtl ? "کاربر" : "User"}</span><b className="tx1">{user?.name ?? "-"}</b></div>
              <div className="flex justify-between"><span>{rtl ? "نقش" : "Role"}</span><b className="tx1" dir="ltr">{user?.role ?? "-"}</b></div>
              <div className="flex justify-between"><span>{rtl ? "انقضا" : "Expires"}</span><b className="tx1" dir="ltr">{user ? new Date(user.expiresAt).toLocaleString() : "-"}</b></div>
            </div>
            <button onClick={logout} className="mt-3 w-full rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-[9.5px] text-rose-300">{rtl ? "خروج از نشست" : "End session"}</button>
          </div>

          <div className="glass-dark shrink-0 rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[11px] font-normal tx1">{rtl ? "صف همگام‌سازی SQL" : "SQL Sync Queue"}</h4>
              <span className="rounded bg-sky-400/10 px-2 py-0.5 text-[8.5px] text-sky-200" dir="ltr">offline-first</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <QueueMetric label={rtl ? "کل" : "Total"} value={syncQueueStats.total} tone="#7FB2FF" />
              <QueueMetric label={rtl ? "منتظر" : "Pending"} value={syncQueueStats.pending} tone="#FBBF24" />
              <QueueMetric label={rtl ? "ارسال" : "Synced"} value={syncQueueStats.synced} tone="#34D399" />
              <QueueMetric label={rtl ? "خطا" : "Failed"} value={syncQueueStats.failed} tone="#F87171" />
            </div>
            <button onClick={flushQueue} className="mt-2 w-full rounded-lg border border-sky-400/50 bg-sky-400/10 px-3 py-1.5 text-[9.5px] text-sky-200">
              🔄 {rtl ? "ارسال صف به SQL Server" : "Flush queue to SQL Server"}
            </button>
          </div>

          {message && <div className={`shrink-0 rounded-xl border px-3 py-2 text-[9.5px] ${messageTone === "ok" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-rose-400/40 bg-rose-400/10 text-rose-300"}`}>{message}</div>}
        </section>
      </div>

      {confirmRestore && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="glass-dark w-full max-w-md rounded-2xl p-4" dir={rtl ? "rtl" : "ltr"}>
            <h3 className="text-[13px] font-medium tx1">{rtl ? "تأیید بازیابی" : "Confirm Restore"}</h3>
            <p className="mt-2 text-[10.5px] leading-5 tx2">{rtl ? "بازیابی، صنایع، پروژه‌ها و تنظیمات فعلی را با Snapshot انتخاب‌شده جایگزین می‌کند. ادامه می‌دهید؟" : "Restore will replace current clusters, projects and settings with the selected snapshot. Continue?"}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setConfirmRestore(null)} className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2">{rtl ? "انصراف" : "Cancel"}</button>
              <button onClick={doRestore} className="rounded-lg border border-amber-400/50 bg-amber-400/15 px-3 py-1.5 text-[10px] text-amber-300">{rtl ? "تأیید بازیابی" : "Confirm Restore"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QueueMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/10 p-2">
      <div className="text-[13px] font-light tabular-nums" style={{ color: tone }}>{value}</div>
      <div className="mt-0.5 truncate text-[8px] font-extralight tx3">{label}</div>
    </div>
  );
}