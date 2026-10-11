/**
 * پنل یکپارچگی بین‌بخشی CMMS ↔ MES.
 *
 * دو چیز را نشان می‌دهد و هر دو بدون کلید خارجی کار می‌کنند:
 *   ۱) صف خروجی رویدادها: هر توقف/رزرو ظرفیت یک ردیف با کلید تکرارناپذیری
 *      می‌گیرد و وضعیت تحویل آن (در انتظار/تحویل‌شده/ناموفق) دیده می‌شود.
 *   ۲) بلوکه‌های نرم ظرفیت: پنجره‌ای که CMMS در MES برای PM رزرو می‌کند.
 *
 * «نرم» یعنی رزرو در موتور زمان‌بندی MES، نه قید پایگاه‌داده‌ای بین دو ماژول.
 */
import { useCallback, useEffect, useState } from "react";
import type { Lang } from "../data/framework";
import { canCmmsAccess, CmmsClient, CmmsRequestError } from "../services/cmmsApi";

interface Props {
  siteId: string;
  userId: string;
  lang: Lang;
}

const errorText = (error: unknown): string =>
  error instanceof CmmsRequestError
    ? `${error.message} (${error.code})`
    : error instanceof Error ? error.message : "خطای ناشناخته";

const STATUS_STYLE: Record<string, string> = {
  acknowledged: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  published: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  failed: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  cancelled: "border-slate-500/40 bg-slate-500/10 tx3",
};

export default function CmmsIntegrationPanel({ siteId, userId, lang }: Props) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);

  const canView = canCmmsAccess(userId, "cmms.integration.view", siteId);
  const canDispatch = canCmmsAccess(userId, "cmms.integration.dispatch", siteId);
  const canViewCapacity = canCmmsAccess(userId, "cmms.capacity.view", siteId);
  const canBlock = canCmmsAccess(userId, "cmms.capacity.block", siteId);

  const [events, setEvents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [blockSummary, setBlockSummary] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const [filter, setFilter] = useState({ status: "", eventType: "" });
  const [newBlock, setNewBlock] = useState({
    WorkCenterRef: "", SourceType: "manual", WindowStart: "", WindowEnd: "", ReasonFa: "",
  });

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    CmmsClient.listIntegrationEvents(siteId, userId, {
      status: filter.status || undefined,
      eventType: filter.eventType || undefined,
      limit: 100,
    })
      .then((data) => { if (!cancelled) { setEvents(data.events); setSummary(data.summary); } })
      .catch((err: unknown) => { if (!cancelled) setError(errorText(err)); });
    return () => { cancelled = true; };
  }, [siteId, userId, nonce, filter.status, filter.eventType, canView]);

  useEffect(() => {
    if (!canViewCapacity) return;
    let cancelled = false;
    CmmsClient.listCapacityBlocks(siteId, userId, { limit: 100 })
      .then((data) => { if (!cancelled) { setBlocks(data.blocks); setBlockSummary(data.summary); } })
      .catch((err: unknown) => { if (!cancelled) setError(errorText(err)); });
    return () => { cancelled = true; };
  }, [siteId, userId, nonce, canViewCapacity]);

  const run = async (key: string, work: () => Promise<unknown>, doneFa: string, doneEn: string) => {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      await work();
      setNote(tr(doneFa, doneEn));
      refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const canSubmitBlock = newBlock.WorkCenterRef.trim() && newBlock.WindowStart && newBlock.WindowEnd && newBlock.ReasonFa.trim().length >= 5;

  return (
    <div className="space-y-4">
      {(error || note) && (
        <div className={`rounded-xl border p-3 text-[11px] ${error ? "border-rose-500/30 bg-rose-500/10 tx1" : "border-emerald-500/30 bg-emerald-500/10 tx1"}`}>
          {error ?? note}
        </div>
      )}

      {canView && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={tr("کل رویدادها", "Total events")} value={summary.total} />
          <Stat label={tr("تحویل‌شده", "Acknowledged")} value={summary.acknowledged} />
          <Stat label={tr("در انتظار", "Pending")} value={summary.pending} />
          <Stat label={tr("ناموفق", "Failed")} value={summary.failed} />
        </div>
      )}

      {canView && summary?.interpretationFa && (
        <p className="tx3 text-[11px]">{summary.interpretationFa}</p>
      )}

      {canView && (
        <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="tx2 text-xs font-medium">{tr("صف خروجی رویدادها (قرارداد cmms-mes-v1)", "Integration outbox (cmms-mes-v1)")}</h4>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={filter.status}
                onChange={(event) => setFilter({ ...filter, status: event.target.value })}
                className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                dir="ltr"
              >
                <option value="">{tr("همهٔ وضعیت‌ها", "all statuses")}</option>
                {["pending", "acknowledged", "failed", "cancelled"].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select
                value={filter.eventType}
                onChange={(event) => setFilter({ ...filter, eventType: event.target.value })}
                className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                dir="ltr"
              >
                <option value="">{tr("همهٔ رویدادها", "all events")}</option>
                {["downtime.started", "downtime.finished", "downtime.reported", "capacity.block.requested", "capacity.block.released"].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <button type="button" onClick={refresh} className="rounded-lg border b-line-soft px-2 py-1 text-[11px] tx2 hover:tx1">
                {tr("به‌روزرسانی", "Refresh")}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border b-line-soft">
            <table className="w-full text-xs">
              <thead className="bg-black/25">
                <tr>
                  {[tr("نوع", "Type"), tr("مقصد", "Target"), tr("وضعیت", "Status"), tr("تلاش", "Attempts"), tr("شناسهٔ بیرونی", "External ref"), tr("خطا", "Error"), ""].map((header, index) => (
                    <th key={`${header}-${index}`} className="px-3 py-2 tx3 font-medium whitespace-nowrap text-start">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((row) => (
                  <tr key={row.Id} className="border-t b-line-soft">
                    <td className="px-3 py-1.5 font-mono tx2 whitespace-nowrap" dir="ltr">{row.EventType}</td>
                    <td className="px-3 py-1.5 font-mono tx2 whitespace-nowrap" dir="ltr">{row.TargetRef ?? "—"}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${STATUS_STYLE[row.Status] ?? "border-slate-500/40 bg-slate-500/10 tx3"}`} dir="ltr">
                        {row.Status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 tx2" dir="ltr">{row.Attempts}</td>
                    <td className="px-3 py-1.5 font-mono tx2" dir="ltr">{row.ExternalRef ?? "—"}</td>
                    <td className="px-3 py-1.5 tx3 text-[10px]" dir="ltr">{row.LastErrorCode ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      {canDispatch && row.Status !== "acknowledged" && row.Status !== "cancelled" && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => run(`dispatch-${row.Id}`, () => CmmsClient.dispatchIntegrationEvent(siteId, userId, row.Id),
                            "رویداد دوباره فرستاده شد", "Event dispatched")}
                          className="rounded-lg border b-line-soft px-2 py-0.5 text-[11px] tx2 hover:tx1 disabled:opacity-40"
                        >
                          {tr("ارسال دوباره", "Dispatch")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {events.length === 0 && <p className="tx3 text-[11px] p-3">{tr("رویدادی در این فیلتر نیست.", "No events for this filter.")}</p>}
          </div>
        </div>
      )}

      {canViewCapacity && (
        <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="tx2 text-xs font-medium">{tr("بلوکهٔ نرم ظرفیت مراکز کاری", "Soft work-center capacity blocks")}</h4>
            {blockSummary && (
              <span className="tx3 text-[11px]" dir="auto">
                {tr("فعال: ", "active: ")}{blockSummary.active} · {tr("آزادشده: ", "released: ")}{blockSummary.released} · {tr("دقیقهٔ رزرو: ", "reserved minutes: ")}{blockSummary.reservedMinutes}
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border b-line-soft">
            <table className="w-full text-xs">
              <thead className="bg-black/25">
                <tr>
                  {[tr("شماره", "No."), tr("مرکز کاری", "Work center"), tr("منبع", "Source"), tr("پنجره", "Window"), tr("دقیقه", "Minutes"), tr("وضعیت", "Status"), ""].map((header, index) => (
                    <th key={`${header}-${index}`} className="px-3 py-2 tx3 font-medium whitespace-nowrap text-start">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blocks.map((row) => (
                  <tr key={row.Id} className="border-t b-line-soft">
                    <td className="px-3 py-1.5 font-mono tx2 whitespace-nowrap" dir="ltr">{row.BlockNo}</td>
                    <td className="px-3 py-1.5 font-mono tx2 whitespace-nowrap" dir="ltr">{row.WorkCenterRef}</td>
                    <td className="px-3 py-1.5 tx2 whitespace-nowrap" dir="ltr">{row.SourceType}</td>
                    <td className="px-3 py-1.5 tx2 whitespace-nowrap text-[10px]" dir="ltr">
                      {String(row.WindowStart).slice(0, 16)} → {String(row.WindowEnd).slice(0, 16)}
                    </td>
                    <td className="px-3 py-1.5 tx2" dir="ltr">{row.ReservedMinutes}</td>
                    <td className="px-3 py-1.5 tx2" dir="ltr">{row.Status}</td>
                    <td className="px-3 py-1.5">
                      {canBlock && (row.Status === "requested" || row.Status === "active") && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => run(`release-${row.Id}`, () => CmmsClient.releaseCapacityBlock(siteId, userId, row.Id, { ReleaseReasonFa: tr("آزادسازی از میز کار", "Released from workspace") }),
                            "رزرو آزاد شد", "Reservation released")}
                          className="rounded-lg border b-line-soft px-2 py-0.5 text-[11px] tx2 hover:tx1 disabled:opacity-40"
                        >
                          {tr("آزادسازی", "Release")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {blocks.length === 0 && <p className="tx3 text-[11px] p-3">{tr("رزروی ثبت نشده است.", "No reservations yet.")}</p>}
          </div>

          {canBlock && (
            <div className="grid grid-cols-1 md:grid-cols-[auto_auto_auto_auto_1fr_auto] gap-2 border-t b-line-soft pt-2">
              <input
                value={newBlock.WorkCenterRef}
                onChange={(event) => setNewBlock({ ...newBlock, WorkCenterRef: event.target.value })}
                placeholder={tr("مرکز کاری", "Work center")}
                className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                dir="ltr"
              />
              <select
                value={newBlock.SourceType}
                onChange={(event) => setNewBlock({ ...newBlock, SourceType: event.target.value })}
                className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                dir="ltr"
              >
                {["manual", "pm-schedule", "work-order", "shutdown"].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <input
                type="datetime-local"
                value={newBlock.WindowStart}
                onChange={(event) => setNewBlock({ ...newBlock, WindowStart: event.target.value })}
                className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                dir="ltr"
              />
              <input
                type="datetime-local"
                value={newBlock.WindowEnd}
                onChange={(event) => setNewBlock({ ...newBlock, WindowEnd: event.target.value })}
                className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                dir="ltr"
              />
              <input
                value={newBlock.ReasonFa}
                onChange={(event) => setNewBlock({ ...newBlock, ReasonFa: event.target.value })}
                placeholder={tr("علت رزرو (PM، توقف اساسی…)", "Reason (PM, shutdown…)")}
                className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
              />
              <button
                type="button"
                disabled={busy !== null || !canSubmitBlock}
                onClick={() => run("block", async () => {
                  const from = new Date(newBlock.WindowStart).toISOString();
                  const to = new Date(newBlock.WindowEnd).toISOString();
                  await CmmsClient.createCapacityBlock(siteId, userId, {
                    WorkCenterRef: newBlock.WorkCenterRef.trim(), SourceType: newBlock.SourceType,
                    WindowStart: from, WindowEnd: to, ReasonFa: newBlock.ReasonFa,
                  });
                  setNewBlock({ ...newBlock, ReasonFa: "" });
                }, "رزرو ثبت و به MES فرستاده شد", "Reservation created and sent to MES")}
                className="rounded-lg border b-line-soft px-3 py-1 text-[11px] tx2 hover:tx1 disabled:opacity-40"
              >
                {busy === "block" ? "…" : tr("رزرو ظرفیت", "Reserve")}
              </button>
            </div>
          )}
          <p className="tx3 text-[10px]">
            {tr(
              "رزرو فقط در موتور زمان‌بندی MES اعمال می‌شود؛ هیچ کلید خارجی بین جدول‌های CMMS و MES ساخته نمی‌شود.",
              "The reservation applies only inside the MES scheduling engine; no foreign key is created between CMMS and MES tables.",
            )}
          </p>
        </div>
      )}

      {!canView && !canViewCapacity && (
        <div className="rounded-xl border b-line-soft bg-black/15 p-4 tx3 text-[11px]">
          {tr("مجوز مشاهدهٔ رویدادها یا ظرفیت را ندارید.", "You have no permission to view events or capacity.")}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 p-3 space-y-0.5">
      <div className="tx3 text-[11px]">{label}</div>
      <div className="tx1 text-lg font-semibold" dir="ltr">{value}</div>
    </div>
  );
}
