/**
 * P9 / ITG-1..3 — خروجی و یکپارچه‌سازی بیرونی (زنده).
 *
 * ITG-1: XER پریماورا و XML مایکروسافت پروجکت از دادهٔ زندهٔ پروژه.
 * ITG-2: اتصال REST پریماورا (آزمون اتصال + ارسال) و بازرسی صادقانهٔ `.mpp`.
 * ITG-3: تقویم iCalendar و فرستادن با Graph/EWS.
 *
 * هر تلاش در «دفتر اجرا» ثبت می‌شود؛ نبودِ تنظیمات ۴۰۹ صادقانه است، نه موفقیت.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import { OutboundClient, type ItgWorkspace, type MppInspection, type P6Status } from "../services/outboundApi";

const chipCls = "rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] font-light transition disabled:opacity-40";
const fx = (n: number | null | undefined) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US"));
const RUN_TONE: Record<string, string> = { succeeded: "text-emerald-300", failed: "text-rose-300", queued: "text-amber-300" };

export default function OutboundPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const T = (fa: string, en: string) => (rtl ? fa : en);
  const { projectScope } = useSystem();
  const { user } = useAuth();
  const projectId = projectScope?.projectId ?? "";
  const client = useMemo(() => new OutboundClient(projectId, user?.id ?? null), [projectId, user?.id]);

  const [ws, setWs] = useState<ItgWorkspace | null>(null);
  const [p6, setP6] = useState<P6Status | null>(null);
  const [mpp, setMpp] = useState<MppInspection | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [w, p] = await Promise.all([client.workspace(), client.p6()]);
    if (w.ok) { setWs(w.data); setErr(null); } else setErr(`${w.message} (${w.code})`);
    if (p.ok) setP6(p.data);
  }, [client, projectId]);
  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (fn: () => Promise<{ ok: true; note?: string } | { ok: false; message: string; code?: string }>) => {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    if (r.ok) { setErr(null); if (r.note) setMsg(r.note); }
    else { setErr(`${r.message} (${r.code ?? "?"})`); setMsg(null); }
    await load();
    setBusy(false);
  }, [load]);

  const allowed = (key: string) => ws?.connectors.find((c) => c.key === key)?.allowed ?? false;

  const inspect = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary);
    setBusy(true);
    const r = await client.mppInspect(file.name, base64);
    setBusy(false);
    if (r.ok) { setMpp(r.data); setErr(null); } else { setMpp(null); setErr(`${r.message} (${r.code})`); }
  }, [client]);

  if (!projectId) return <div className="p-4 text-[10.5px] font-light tx3">{T("پروژه‌ای انتخاب نشده است.", "No project selected.")}</div>;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-light tx2">{T("خروجی پروژه و نوشتن در سامانهٔ بیرونی — با دفتر اجرا", "Project export & outbound writes — with run ledger")}</span>
        <span className="ms-auto text-[9px] tx4" dir="ltr">{ws?.metrics.modelVersion}</span>
        <button onClick={() => void load()} className="rounded-lg px-2.5 py-1 text-[9.5px] font-light tx3 transition hover:tx1">↻ {T("بازخوانی", "Refresh")}</button>
      </div>
      {err && <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-200">{err}</div>}
      {msg && !err && <div className="rounded-lg border b-line-soft px-3 py-2 text-[10px] tx3">{msg}</div>}
      {ws?.projectSource === "unresolved" && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[10px] text-amber-200">
          {T("ردیف پروژه در جدول Project نیست؛ خروجی با شناسهٔ مسیر ساخته می‌شود.", "No Project row: exports are built from the path id.")}
        </div>
      )}

      <section className="glass-dark rounded-2xl p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-normal tx1">{T("۱) خروجی فایل (ITG-1 / ITG-3)", "1) File export (ITG-1 / ITG-3)")}</h4>
          <span className="text-[8.5px] font-extralight tx3">
            {ws ? `${T("فعالیت", "activities")}: ${fx(ws.counts.activities)} · WBS: ${fx(ws.counts.wbs)}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button disabled={busy || !allowed("xer")} onClick={() => void act(async () => { const r = await client.xerSummary(); return r.ok ? { ok: true, note: T(`XER آماده است — ${r.data.counts.activities} فعالیت، ${r.data.counts.wbs} گره WBS`, `XER ready — ${r.data.counts.activities} activities, ${r.data.counts.wbs} WBS nodes`) } : r; })} className={`${chipCls} tx2`}>
            {T("آزمون XER", "Check XER")}
          </button>
          <button disabled={busy || !allowed("xer")} onClick={() => void act(async () => { const r = await client.download("xer"); return r.ok ? { ok: true, note: T("فایل XER دانلود شد", "XER downloaded") } : { ok: false, message: r.message }; })} className={`${chipCls} toggle-on tx1`}>
            ⬇ XER
          </button>
          <button disabled={busy || !allowed("msp")} onClick={() => void act(async () => { const r = await client.download("msp.xml"); return r.ok ? { ok: true, note: T("فایل XML مایکروسافت پروجکت دانلود شد", "MS Project XML downloaded") } : { ok: false, message: r.message }; })} className={`${chipCls} toggle-on tx1`}>
            ⬇ MS Project XML
          </button>
          <button disabled={busy || !allowed("msp")} onClick={() => void act(async () => { const r = await client.mspSummary(); return r.ok ? { ok: true, note: T(`XML آماده است — ${r.data.counts.tasks} تکلیف، ${r.data.counts.links} رابطه`, `XML ready — ${r.data.counts.tasks} tasks, ${r.data.counts.links} links`) } : r; })} className={`${chipCls} tx2`}>
            {T("آزمون XML", "Check XML")}
          </button>
          <button disabled={busy || !allowed("calendar")} onClick={() => void act(async () => { const r = await client.download("calendar.ics"); return r.ok ? { ok: true, note: T("فایل تقویم دانلود شد", "Calendar downloaded") } : { ok: false, message: r.message }; })} className={`${chipCls} toggle-on tx1`}>
            ⬇ تقویم ICS
          </button>
        </div>
      </section>

      <section className="glass-dark rounded-2xl p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-normal tx1">{T("۲) پریماورا P6 (ITG-2)", "2) Primavera P6 (ITG-2)")}</h4>
          <span className={`text-[8.5px] font-extralight ${p6?.configured ? "text-emerald-300" : "text-amber-300"}`}>
            {p6?.configured ? T("تنظیم‌شده", "configured") : T("تنظیم‌نشده", "not configured")}
          </span>
        </div>
        <div className="grid gap-1 text-[9.5px] tx3 sm:grid-cols-2">
          <div>{T("پایگاه", "Database")}: <span dir="ltr">{p6?.database ?? "—"}</span></div>
          <div>{T("نشانی", "Base URL")}: <span dir="ltr">{p6?.baseUrl ?? "—"}</span></div>
          <div>{T("کاربر", "User")}: <span dir="ltr">{p6?.user ?? "—"}</span></div>
          <div>{T("احراز هویت", "Auth")}: <span dir="ltr">{p6?.authMode ?? "—"}</span></div>
          <div>{T("فعالیت‌های آماده", "Activities ready")}: <span className="tabular-nums tx1" dir="ltr">{fx(p6?.activityCount)}</span></div>
          <div>{T("سقف هر ارسال", "Max per push")}: <span className="tabular-nums tx1" dir="ltr">{fx(p6?.maxPerPush)}</span></div>
        </div>
        {p6 && !p6.configured && p6.missing.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[9.5px] text-amber-200">
            {T("متغیرهای لازم", "Required variables")}: <span dir="ltr">{p6.missing.join(", ")}</span>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button disabled={busy || !allowed("p6")} onClick={() => void act(async () => { const r = await client.p6Probe(); return r.ok ? { ok: true, note: T("اتصال P6 برقرار است", "P6 reachable") } : r; })} className={`${chipCls} tx2`}>
            {T("آزمون اتصال", "Probe")}
          </button>
          <button disabled={busy || !allowed("p6")} onClick={() => void act(async () => { const r = await client.p6Push(); return r.ok ? { ok: true, note: T(`${r.data.sent} فعالیت به P6 رفت`, `${r.data.sent} activities pushed`) } : r; })} className={`${chipCls} toggle-on tx1`}>
            {T("ارسال فعالیت‌ها", "Push activities")}
          </button>
        </div>
      </section>

      <section className="glass-dark rounded-2xl p-3">
        <div className="mb-2 text-[11px] font-normal tx1">{T("۳) بازرسی .mpp (ITG-2)", "3) .mpp inspection (ITG-2)")}</div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".mpp" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void inspect(f); }} />
          <button disabled={busy} onClick={() => fileRef.current?.click()} className={`${chipCls} tx2`}>{T("انتخاب فایل .mpp", "Choose .mpp")}</button>
          {mpp && (
            <span className="text-[9.5px] tx3">
              <b className="tx1" dir="ltr">{mpp.fileName}</b> · {mpp.container} · {fx(mpp.bytes)} B ·{" "}
              <span className={mpp.supported ? "text-emerald-300" : "text-amber-300"}>{mpp.supported ? T("پشتیبانی‌شده", "supported") : T("پشتیبانی‌نشده", "not supported")}</span>
            </span>
          )}
        </div>
        {mpp && <div className="mt-2 rounded-lg border b-line-soft px-2.5 py-1.5 text-[9.5px] tx3">{mpp.guidanceFa}</div>}
      </section>

      <section className="glass-dark rounded-2xl p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-normal tx1">{T("۴) Outlook / Exchange (ITG-3)", "4) Outlook / Exchange (ITG-3)")}</h4>
          <span className={`text-[8.5px] font-extralight ${ws?.exchange.configured ? "text-emerald-300" : "text-amber-300"}`} dir="ltr">
            {ws?.exchange.mode} · {ws?.exchange.configured ? T("تنظیم‌شده", "configured") : T("تنظیم‌نشده", "not configured")}
          </span>
        </div>
        {ws && !ws.exchange.configured && (
          <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[9.5px] text-amber-200">
            {T("متغیرهای لازم", "Required variables")}: <span dir="ltr">{ws.exchange.missing.join(", ")}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <button disabled={busy || !allowed("exchange")} onClick={() => void act(async () => { const r = await client.exchangeDryRun(); return r.ok ? { ok: true, note: T(`آزمون خشک: ${r.data.count} رویداد، ${r.data.bytes} بایت — چیزی فرستاده نشد`, `Dry run: ${r.data.count} events, ${r.data.bytes} bytes — nothing sent`) } : r; })} className={`${chipCls} tx2`}>
            {T("آزمون خشک محموله", "Dry-run payload")}
          </button>
          <button disabled={busy || !allowed("exchange")} onClick={() => void act(async () => { const r = await client.exchangeSend(); return r.ok ? { ok: true, note: T(`تقویم فرستاده شد (${r.data.count} رویداد)`, `Calendar sent (${r.data.count} events)`) } : r; })} className={`${chipCls} toggle-on tx1`}>
            {T("فرستادن تقویم", "Send calendar")}
          </button>
        </div>
      </section>

      <section className="glass-dark rounded-2xl p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-normal tx1">{T("۵) دفتر اجرا", "5) Run ledger")}</h4>
          <span className="text-[8.5px] font-extralight tx3">
            {ws ? `${ws.metrics.runs} ${T("اجرا", "runs")} · ${ws.metrics.failed} ${T("ناموفق", "failed")}` : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-light">
            <thead className="tx3">
              <tr>
                <th className="px-1.5 py-1 text-start">{T("زمان", "Time")}</th>
                <th className="px-1.5 py-1 text-start">{T("اتصال‌دهنده", "Connector")}</th>
                <th className="px-1.5 py-1 text-start">{T("وضعیت", "Status")}</th>
                <th className="px-1.5 py-1 text-start">{T("اقلام", "Items")}</th>
                <th className="px-1.5 py-1 text-start">{T("بایت", "Bytes")}</th>
                <th className="px-1.5 py-1 text-start">{T("کاربر", "Actor")}</th>
                <th className="px-1.5 py-1 text-start">{T("خطا", "Error")}</th>
              </tr>
            </thead>
            <tbody>
              {(ws?.runs ?? []).map((r) => (
                <tr key={r.Id} className="border-t b-line-soft">
                  <td className="px-1.5 py-1 tabular-nums tx3" dir="ltr">{String(r.StartedAt).replace("T", " ").slice(0, 19)}</td>
                  <td className="px-1.5 py-1 tx2" dir="ltr">{r.Connector}</td>
                  <td className={`px-1.5 py-1 ${RUN_TONE[r.Status] ?? "tx3"}`}>{r.Status}</td>
                  <td className="px-1.5 py-1 tabular-nums tx3" dir="ltr">{r.ItemCount === null ? "—" : fx(r.ItemCount)}</td>
                  <td className="px-1.5 py-1 tabular-nums tx3" dir="ltr">{r.PayloadBytes === null ? "—" : fx(r.PayloadBytes)}</td>
                  <td className="px-1.5 py-1 tx3" dir="ltr">{r.ActorId}</td>
                  <td className="px-1.5 py-1 tx3" dir="ltr">{r.ErrorCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ws && ws.runs.length === 0 && <div className="text-[10px] tx4">{T("هنوز اجرایی ثبت نشده است.", "No run recorded yet.")}</div>}
        </div>
      </section>
    </div>
  );
}
