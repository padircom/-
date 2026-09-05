import { useRef, useState } from "react";
import { useSystem, type MasterDataBackup, type SyncResult } from "../context/SystemContext";
import { useAuth } from "../context/AuthContext";
import { type Lang } from "../data/framework";
import { loadSqlConfig, testConnection } from "../services/sqlServer";
import { pmisApiClient } from "../services/pmisApiClient";

type Action = "pull" | "push" | "backup" | "restore" | null;

export default function MasterDataSyncPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster, pullMasterData, pushMasterData, createBackup, restoreBackup } = useSystem();
  const { can, audit } = useAuth();
  const [busy, setBusy] = useState<Action>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [remoteSummary, setRemoteSummary] = useState<{ industries: number; projects: number } | null>(null);
  const restoreRef = useRef<HTMLInputElement | null>(null);

  const localIndustries = clusters.length;
  const localProjects = Object.values(projectsByCluster).reduce((sum, rows) => sum + rows.length, 0);

  const verifyApi = async () => {
    const connection = await testConnection(loadSqlConfig());
    if (!connection.ok) throw new Error(connection.message);
  };

  const previewRemote = async () => {
    setBusy("backup"); setMessage(null); setResult(null);
    try {
      await verifyApi();
      const industries = await pmisApiClient.getIndustries({ pageSize: 500 });
      let projectCount = 0;
      for (const industry of industries.items) {
        const projects = await pmisApiClient.getProjects(industry.code, { pageSize: 1000 });
        projectCount += projects.total;
      }
      setRemoteSummary({ industries: industries.total, projects: projectCount });
      audit("PREVIEW_MASTER_SYNC", { entity: "MasterData", entityId: "dry-run" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setRemoteSummary(null);
    } finally {
      setBusy(null);
    }
  };

  const runPull = async () => {
    if (!confirmed || !can("system.manage")) return;
    setBusy("pull"); setMessage(null); setResult(null);
    try {
      await verifyApi();
      // Keep a recoverable local snapshot before replacing state.
      localStorage.setItem("pmis:last-pre-pull-backup:v1", JSON.stringify(createBackup()));
      const next = await pullMasterData();
      setResult(next);
      audit("SYNC_MASTER_PULL", { entity: "MasterData", entityId: "industries-projects" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null); setConfirmed(false);
    }
  };

  const runPush = async () => {
    if (!confirmed || !can("system.manage")) return;
    setBusy("push"); setMessage(null); setResult(null);
    try {
      await verifyApi();
      const next = await pushMasterData();
      setResult(next);
      audit("SYNC_MASTER_PUSH", { entity: "MasterData", entityId: "industries-projects" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null); setConfirmed(false);
    }
  };

  const downloadBackup = () => {
    const backup = createBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PMIS_MasterData_${backup.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setResult({ direction: "restore", industries: backup.clusters.length, projects: Object.values(backup.projectsByCluster).reduce((sum, rows) => sum + rows.length, 0), warnings: ["Backup exported; no data was changed"], completedAt: backup.exportedAt });
    audit("EXPORT_MASTER_BACKUP", { entity: "MasterData", entityId: "backup" });
  };

  const uploadBackup = (files: FileList | null) => {
    if (!files?.length || !can("system.manage")) return;
    setBusy("restore"); setMessage(null); setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(String(reader.result)) as MasterDataBackup;
        localStorage.setItem("pmis:last-pre-restore-backup:v1", JSON.stringify(createBackup()));
        const next = restoreBackup(backup);
        setResult(next);
        audit("RESTORE_MASTER_BACKUP", { entity: "MasterData", entityId: files[0].name });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(null);
      }
    };
    reader.onerror = () => { setMessage("Unable to read backup file"); setBusy(null); };
    reader.readAsText(files[0]);
  };

  return (
    <div className="fade-rise space-y-3.5" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3 border-b b-line-soft pb-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-[17px]">↕</span>
          <div>
            <h3 className="text-[12.5px] font-medium tx1">{rtl ? "همگام‌سازی داده‌های پایه" : "Master Data Synchronization"}</h3>
            <p className="text-[8.5px] font-extralight tx3">{rtl ? "انتقال امن صنایع و پروژه‌ها بین localStorage و SQL Server" : "Safely move industries and projects between localStorage and SQL Server"}</p>
          </div>
          <div className="ms-auto flex gap-2">
            <Stat label={rtl ? "صنعت محلی" : "Local industries"} value={localIndustries} color="#7FB2FF" />
            <Stat label={rtl ? "پروژه محلی" : "Local projects"} value={localProjects} color="#8FE3C8" />
            {remoteSummary && <Stat label={rtl ? "صنعت Backend" : "Remote industries"} value={remoteSummary.industries} color="#C9A7FF" />}
            {remoteSummary && <Stat label={rtl ? "پروژه Backend" : "Remote projects"} value={remoteSummary.projects} color="#FFD48A" />}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border b-line-soft bg-black/10 px-3 py-2">
          <span className="text-[9px] font-extralight tx3">{rtl ? "قبل از انتقال، تعداد رکوردهای Backend را بدون تغییر داده بررسی کنید." : "Inspect backend record counts without changing data before transfer."}</span>
          <button onClick={() => void previewRemote()} disabled={Boolean(busy)} className="ms-auto rounded-lg border border-fuchsia-400/45 bg-fuchsia-400/10 px-2.5 py-1 text-[9px] text-fuchsia-200 disabled:opacity-40">
            {busy === "backup" ? (rtl ? "در حال بررسی…" : "Checking…") : (rtl ? "پیش‌بررسی Backend" : "Backend dry run")}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <ActionCard
            title={rtl ? "دریافت از SQL Server" : "Pull from SQL Server"}
            description={rtl ? "داده محلی صنایع و پروژه‌ها با داده Backend جایگزین می‌شود. قبل از جایگزینی، نسخه پشتیبان خودکار ساخته می‌شود." : "Local industries/projects are replaced by backend data. An automatic recovery backup is created first."}
            button={busy === "pull" ? (rtl ? "در حال دریافت…" : "Pulling…") : (rtl ? "دریافت و جایگزینی" : "Pull & replace")}
            color="#7FB2FF"
            disabled={!confirmed || Boolean(busy) || !can("system.manage")}
            onClick={runPull}
          />
          <ActionCard
            title={rtl ? "ارسال داده محلی به SQL Server" : "Push local data to SQL Server"}
            description={rtl ? "فقط کدهای صنعت و پروژه‌ای که در Backend وجود ندارند درج می‌شوند؛ رکوردهای موجود بازنویسی نمی‌شوند." : "Only missing industry/project codes are inserted; existing records are not overwritten."}
            button={busy === "push" ? (rtl ? "در حال ارسال…" : "Pushing…") : (rtl ? "ارسال رکوردهای جدید" : "Push new records")}
            color="#8FE3C8"
            disabled={!confirmed || Boolean(busy) || !can("system.manage")}
            onClick={runPush}
          />
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/7 p-2.5 text-[9.5px] font-light tx2">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-400" />
          <span>{rtl ? "تایید می‌کنم اثر عملیات Pull/Push را بررسی کرده‌ام و Backend صحیح را انتخاب کرده‌ام." : "I confirm that I reviewed the pull/push impact and selected the correct backend environment."}</span>
        </label>
      </section>

      <section className="glass-dark rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h4 className="text-[11.5px] font-medium tx1">{rtl ? "نسخه پشتیبان و بازیابی" : "Backup & Restore"}</h4>
            <p className="text-[8.5px] font-extralight tx3">{rtl ? "فایل JSON شامل صنایع، پروژه‌ها، تنظیمات غیرمحرمانه و کانتکست فعال" : "JSON includes industries, projects, non-secret settings, and active scope"}</p>
          </div>
          <div className="ms-auto flex gap-1.5">
            <button onClick={downloadBackup} className="rounded-lg border border-sky-400/45 bg-sky-400/10 px-3 py-1.5 text-[9.5px] text-sky-200">⬇ {rtl ? "دریافت نسخه پشتیبان" : "Download backup"}</button>
            <input ref={restoreRef} type="file" hidden accept=".json,application/json" onChange={(e) => uploadBackup(e.target.files)} />
            <button onClick={() => restoreRef.current?.click()} disabled={Boolean(busy) || !can("system.manage")} className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-1.5 text-[9.5px] text-amber-200 disabled:opacity-40">⬆ {rtl ? "بازیابی فایل" : "Restore file"}</button>
          </div>
        </div>
      </section>

      {message && <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-300">✕ {message}</div>}
      {result && (
        <section className="glass-dark rounded-2xl p-3">
          <div className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-[10.5px] font-medium tx1">{rtl ? "نتیجه عملیات" : "Operation result"}</span><span className="ms-auto text-[8.5px] tx4" dir="ltr">{result.completedAt}</span></div>
          <div className="mt-2 flex flex-wrap gap-2 text-[9.5px] tx2"><span>{rtl ? "جهت:" : "Direction:"} {result.direction}</span><span>·</span><span>{result.industries} {rtl ? "صنعت" : "industries"}</span><span>·</span><span>{result.projects} {rtl ? "پروژه" : "projects"}</span></div>
          {result.warnings.map((warning) => <div key={warning} className="mt-1 text-[8.5px] text-amber-300">⚠ {warning}</div>)}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="rounded-lg border px-2.5 py-1 text-center" style={{ borderColor: `${color}55`, background: `${color}12` }}><div className="text-[13px] font-light tx1">{value}</div><div className="text-[7.5px] tx4">{label}</div></div>;
}

function ActionCard({ title, description, button, color, disabled, onClick }: { title: string; description: string; button: string; color: string; disabled: boolean; onClick: () => void }) {
  return <div className="rounded-2xl border p-3" style={{ borderColor: `${color}44`, background: `${color}08` }}><h4 className="text-[11px] font-medium" style={{ color }}>{title}</h4><p className="mt-1 min-h-10 text-[9px] font-light leading-5 tx3">{description}</p><button onClick={onClick} disabled={disabled} className="mt-2 w-full rounded-lg border px-3 py-1.5 text-[9.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35" style={{ borderColor: `${color}66`, background: `${color}14`, color }}>{button}</button></div>;
}