import { useEffect, useState } from "react";
import { useSystem } from "../context/SystemContext";
import { useAuth } from "../context/AuthContext";
import { pmisApiClient } from "../services/pmisApiClient";
import { type NotificationDto } from "../services/pmisContract";
import { type Lang } from "../data/framework";

const channelMeta = {
  in_app: { fa: "درون‌برنامه", en: "In-app", color: "#7FB2FF" },
  email: { fa: "ایمیل", en: "Email", color: "#34D399" },
  sms: { fa: "پیامک", en: "SMS", color: "#FBBF24" },
};

const statusColor: Record<string, string> = {
  pending: "#FBBF24",
  sent: "#34D399",
  failed: "#F87171",
  cancelled: "#94A3B8",
  read: "#7FB2FF",
};

export default function NotificationOpsPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { projectScope, projectsByCluster } = useSystem();
  const { can, audit } = useAuth();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState<"in_app" | "email" | "sms">("in_app");
  const [recipient, setRecipient] = useState("project-team");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = projectScope ? projectsByCluster[projectScope.clusterId]?.find((row) => row.id === projectScope.projectId) : undefined;
  const projectCode = project?.code ?? projectScope?.projectId ?? undefined;

  const load = async () => {
    setBusy(true); setError(null);
    try {
      const result = await pmisApiClient.getNotifications({ status: status === "all" ? undefined : status, projectCode });
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, [status, projectCode]);

  const sendTest = async () => {
    if (!can("system.manage") && !can("project.edit", projectScope?.projectId)) return;
    setBusy(true); setError(null);
    try {
      await pmisApiClient.sendTestNotification({ channel, recipient, body: body || "PMIS notification test", projectCode });
      audit("SEND_TEST_NOTIFICATION", { projectId: projectScope?.projectId, entity: "Notification_Queue", entityId: channel });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async (id: string) => {
    setBusy(true); setError(null);
    try {
      await pmisApiClient.sendNotification(id);
      audit("RESEND_NOTIFICATION", { projectId: projectScope?.projectId, entity: "Notification_Queue", entityId: id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const pending = items.filter((item) => item.status === "pending").length;
  const failed = items.filter((item) => item.status === "failed").length;

  return (
    <div className="glass flex h-full min-h-0 flex-col rounded-2xl p-4" dir={rtl ? "rtl" : "ltr"}>
      <header className="mb-3 flex flex-wrap items-center gap-2 border-b b-line-soft pb-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-[17px]">🔔</span>
        <div>
          <h2 className="text-[14px] font-medium tx1">{rtl ? "مرکز اعلان‌های عملیاتی" : "Operational Notification Center"}</h2>
          <p className="text-[9px] font-extralight tx3">{rtl ? "صف ایمیل، پیامک و اعلان‌های درون‌برنامه" : "Email, SMS, and in-app notification queue"}</p>
        </div>
        <span className="ms-auto rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[9px] text-amber-200">{pending} {rtl ? "در انتظار" : "pending"}</span>
        <span className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-[9px] text-rose-300">{failed} {rtl ? "ناموفق" : "failed"}</span>
        <button onClick={() => void load()} disabled={busy} className="rounded-lg border b-line-soft px-2.5 py-1 text-[9px] tx2 disabled:opacity-40">↻</button>
      </header>

      <section className="mb-3 rounded-2xl border b-line-soft bg-black/10 p-3">
        <div className="mb-2 text-[10px] font-normal tx1">{rtl ? "ارسال تست یا اعلان دستی" : "Send test/manual notification"}</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[150px_180px_minmax(0,1fr)_auto]">
          <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10px] tx1 outline-none" style={{ colorScheme: "dark" }}>
            {Object.entries(channelMeta).map(([key, meta]) => <option key={key} value={key}>{meta[lang]}</option>)}
          </select>
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={rtl ? "گیرنده" : "Recipient"} dir="ltr" className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10px] tx1 outline-none" />
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={rtl ? "متن اعلان…" : "Notification body…"} className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10px] tx1 outline-none" />
          <button onClick={sendTest} disabled={busy || !recipient.trim()} className="rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-3 py-1.5 text-[10px] text-emerald-300 disabled:opacity-40">{rtl ? "ارسال تست" : "Send test"}</button>
        </div>
        <div className="mt-2 text-[8px] font-extralight text-amber-300">{rtl ? "ایمیل نیازمند SMTP و پیامک نیازمند SMS_WEBHOOK_URL در Backend است." : "Email requires SMTP and SMS requires SMS_WEBHOOK_URL on the backend."}</div>
      </section>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {[
          { id: "all", fa: "همه", en: "All" },
          { id: "pending", fa: "در انتظار", en: "Pending" },
          { id: "sent", fa: "ارسال‌شده", en: "Sent" },
          { id: "failed", fa: "ناموفق", en: "Failed" },
        ].map((filter) => <button key={filter.id} onClick={() => setStatus(filter.id)} className={`rounded-lg border px-2.5 py-1 text-[9.5px] font-light ${status === filter.id ? "toggle-on tx1" : "b-line-soft tx3"}`}>{rtl ? filter.fa : filter.en}</button>)}
      </div>

      <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 ? <div className="grid h-36 place-items-center text-[10px] tx4">{busy ? (rtl ? "در حال خواندن…" : "Loading…") : (rtl ? "اعلانی موجود نیست." : "No notifications.")}</div> : items.map((item) => {
          const meta = channelMeta[item.channel] ?? channelMeta.in_app;
          return (
            <div key={item.id} className="glass-row rounded-xl border-s-2 p-3" style={{ borderInlineStartColor: meta.color }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md px-1.5 py-0.5 text-[8px] font-light" style={{ background: `${meta.color}18`, color: meta.color }}>{meta[lang]}</span>
                <span className="min-w-0 flex-1 truncate text-[10px] font-light tx1">{item.subject || item.body}</span>
                <span className="rounded-md px-1.5 py-0.5 text-[8px]" style={{ background: `${statusColor[item.status] || "#94A3B8"}18`, color: statusColor[item.status] || "#94A3B8" }}>{item.status}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[9px] font-extralight leading-4 tx3">{item.body}</p>
              <div className="mt-2 flex items-center gap-2 text-[8px] tx4" dir="ltr"><span>{item.recipient}</span><span>·</span><span>{item.createdAt}</span><span>·</span><span>{item.relatedEntity || "System"}</span>{item.status === "failed" && <button onClick={() => void resend(item.id)} className="ms-auto rounded border border-amber-400/40 px-2 py-0.5 text-amber-200">retry</button>}</div>
            </div>
          );
        })}
      </div>

      {error && <div className="mt-2 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-[9px] text-rose-300">✕ {error}</div>}
    </div>
  );
}