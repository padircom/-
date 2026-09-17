import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import type { PexActivity } from "../data/pexProject";
import {
  createDpr,
  dprAction,
  dprConflicts,
  getDpr,
  listDpr,
  type DprAction,
  type DprConflict,
  type DprLineInput,
  type PexDpr,
  type PexDprDetail,
} from "../services/pexApi";

const STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "تأییدشده",
  rejected: "ردشده",
  revision_required: "نیاز به اصلاح",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "#9AA4B2",
  submitted: "#7FB2FF",
  approved: "#8FE3C8",
  rejected: "#FF9F9F",
  revision_required: "#FFD48A",
};

const ROLES = ["site_engineer", "planner", "consultant", "project_manager", "admin"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PexDprPanel({
  lang,
  projectCode,
  activities,
}: {
  lang: Lang;
  projectCode: string;
  activities: PexActivity[];
}) {
  const rtl = lang === "fa";
  const [items, setItems] = useState<PexDpr[]>([]);
  const [detail, setDetail] = useState<PexDprDetail | null>(null);
  const [conflicts, setConflicts] = useState<DprConflict[]>([]);
  const [role, setRole] = useState("site_engineer");
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [apiOk, setApiOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");

  // فرم ساخت
  const [fDate, setFDate] = useState(todayIso());
  const [fShift, setFShift] = useState("A");
  const [fWeather, setFWeather] = useState("");
  const [fLines, setFLines] = useState<DprLineInput[]>([]);

  const actMap = useMemo(() => {
    const m: Record<string, PexActivity> = {};
    for (const a of activities) m[a.code] = a;
    return m;
  }, [activities]);

  const refresh = useCallback(async () => {
    try {
      const [list, conf] = await Promise.all([listDpr(projectCode, filter || undefined), dprConflicts(projectCode)]);
      setItems(list);
      setConflicts(conf);
      setApiOk(true);
    } catch {
      setApiOk(false);
    }
  }, [projectCode, filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDetail = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      setDetail(await getDpr(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (actionCode: DprAction) => {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const next = await dprAction(detail.id, actionCode, role, comment || undefined);
      setDetail(next);
      setComment("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  const addLine = () => {
    const first = activities[0];
    if (!first) return;
    const step = first.steps[0];
    setFLines((p) => [...p, { activityCode: first.code, stepSeq: step?.seq ?? 1, qty: 1, uom: step?.uom ?? "", locationCode: "" }]);
  };

  const saveDraft = async () => {
    setBusy(true);
    setError("");
    try {
      const dpr = await createDpr(projectCode, {
        reportDate: fDate,
        shift: fShift,
        weather: fWeather || undefined,
        lines: fLines.map((l) => ({ ...l, qty: Number(l.qty) })),
      });
      setCreating(false);
      setFLines([]);
      await refresh();
      await openDetail(dpr.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  const statusChip = (st: string) => (
    <span
      className="rounded px-2 py-0.5 text-[8.5px]"
      style={{ background: `${STATUS_COLOR[st] ?? "#999"}22`, color: STATUS_COLOR[st] ?? "#999" }}
    >
      {rtl ? STATUS_FA[st] ?? st : st}
    </span>
  );

  return (
    <div className="fade-rise space-y-2">
      {!apiOk && (
        <div className="glass-dark rounded-xl border border-amber-400/30 p-3 text-[10px] text-amber-200">
          {rtl
            ? "سرور/SQL در دسترس نیست — ثبت DPR واقعی نیاز به اتصال دارد. داده نمایشی از seed خوانده می‌شود."
            : "Server/SQL unreachable — real DPR needs a connection. Read-only data falls back to seed."}
        </div>
      )}
      {error && (
        <div className="glass-dark rounded-xl border border-rose-400/30 p-3 text-[10px] text-rose-200" dir="ltr">
          {error}
        </div>
      )}

      {/* نوار ابزار */}
      <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-2.5 text-[10px]">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
          style={{ colorScheme: "dark" }}
          dir="ltr"
        >
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
          style={{ colorScheme: "dark" }}
        >
          <option value="">{rtl ? "همه وضعیت‌ها" : "All"}</option>
          {Object.keys(STATUS_FA).map((s) => (
            <option key={s} value={s}>
              {rtl ? STATUS_FA[s] : s}
            </option>
          ))}
        </select>
        <button onClick={() => void refresh()} className="rounded-lg border b-line-soft px-2.5 py-1 tx2" disabled={busy}>
          {rtl ? "تازه‌سازی" : "Refresh"}
        </button>
        <button
          onClick={() => setCreating((v) => !v)}
          className="ms-auto rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200"
        >
          + {rtl ? "گزارش روزانه" : "DPR"}
        </button>
      </div>

      {/* تعارض‌ها */}
      {conflicts.length > 0 && (
        <div className="glass-dark rounded-2xl border border-rose-400/25 p-3">
          <div className="text-[10px] font-normal text-rose-300">
            {rtl ? `تعارض مقادیر (${conflicts.length}) — نیاز به داوری reviewer` : `Value conflicts (${conflicts.length})`}
          </div>
          {conflicts.slice(0, 5).map((c, i) => (
            <div key={i} className="mt-1 text-[9.5px] tx2" dir="ltr">
              {c.activityCode} · {c.reportDate} · step {c.stepSeq} → {c.lines.map((l) => `${l.reportNo}:${l.qty}`).join(" ⇆ ")}
            </div>
          ))}
        </div>
      )}

      {/* فرم ساخت */}
      {creating && (
        <div className="glass-dark space-y-2 rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="tx3">{rtl ? "تاریخ" : "Date"}</span>
            <input
              type="date"
              value={fDate}
              onChange={(e) => setFDate(e.target.value)}
              className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
              style={{ colorScheme: "dark" }}
              dir="ltr"
            />
            <span className="tx3">{rtl ? "شیفت" : "Shift"}</span>
            <select
              value={fShift}
              onChange={(e) => setFShift(e.target.value)}
              className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
              style={{ colorScheme: "dark" }}
              dir="ltr"
            >
              {["A", "B", "C", "N"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input
              value={fWeather}
              onChange={(e) => setFWeather(e.target.value)}
              placeholder={rtl ? "هوا…" : "Weather…"}
              className="min-w-[120px] flex-1 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 placeholder:text-[9px]"
            />
          </div>
          {fLines.map((ln, i) => {
            const act = actMap[ln.activityCode];
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border b-line-soft p-2 text-[10px]">
                <select
                  value={ln.activityCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    const st = actMap[code]?.steps[0];
                    setFLines((p) => p.map((x, j) => (j === i ? { ...x, activityCode: code, stepSeq: st?.seq ?? 1, uom: st?.uom ?? "" } : x)));
                  }}
                  className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 font-mono tx1"
                  style={{ colorScheme: "dark" }}
                  dir="ltr"
                >
                  {activities.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code}
                    </option>
                  ))}
                </select>
                <select
                  value={ln.stepSeq}
                  onChange={(e) => {
                    const seq = Number(e.target.value);
                    const st = act?.steps.find((s) => s.seq === seq);
                    setFLines((p) => p.map((x, j) => (j === i ? { ...x, stepSeq: seq, uom: st?.uom ?? x.uom } : x)));
                  }}
                  className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
                  style={{ colorScheme: "dark" }}
                >
                  {(act?.steps ?? []).map((s) => (
                    <option key={s.seq} value={s.seq}>
                      {s.seq} · {rtl ? s.nameFa : s.nameEn}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={ln.qty}
                  onChange={(e) => setFLines((p) => p.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))}
                  className="w-20 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
                  dir="ltr"
                />
                <span className="tx3" dir="ltr">{ln.uom}</span>
                <input
                  value={ln.locationCode ?? ""}
                  onChange={(e) => setFLines((p) => p.map((x, j) => (j === i ? { ...x, locationCode: e.target.value } : x)))}
                  placeholder={rtl ? "لوکیشن" : "Location"}
                  className="w-24 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 placeholder:text-[9px]"
                  dir="ltr"
                />
                {act?.locked && (
                  <input
                    value={ln.crId ?? ""}
                    onChange={(e) => setFLines((p) => p.map((x, j) => (j === i ? { ...x, crId: e.target.value } : x)))}
                    placeholder="CR"
                    title={rtl ? "فعالیت قفل — شماره CR لازم است" : "Locked activity — CR required"}
                    className="w-20 rounded-lg border border-amber-400/40 bg-black/20 px-2 py-1 tx1 placeholder:text-[9px]"
                    dir="ltr"
                  />
                )}
                <button onClick={() => setFLines((p) => p.filter((_, j) => j !== i))} className="ms-auto px-2 text-rose-300">
                  ✕
                </button>
              </div>
            );
          })}
          <div className="flex gap-2">
            <button onClick={addLine} className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2">
              + {rtl ? "خط پیشرفت" : "Progress line"}
            </button>
            <button
              onClick={() => void saveDraft()}
              disabled={busy || fLines.length === 0}
              className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-[10px] text-emerald-200 disabled:opacity-40"
            >
              {rtl ? "ثبت پیش‌نویس" : "Save draft"}
            </button>
          </div>
        </div>
      )}

      {/* فهرست */}
      <div className="space-y-1.5">
        {items.map((d) => (
          <button
            key={d.id}
            onClick={() => void openDetail(d.id)}
            className={`glass-dark flex w-full flex-wrap items-center gap-2 rounded-xl p-2.5 text-start text-[10px] transition hover:-translate-y-px ${detail?.id === d.id ? "row-on" : ""}`}
          >
            <span className="font-mono tx2" dir="ltr">{d.reportNo}</span>
            <span className="tx3" dir="ltr">{d.reportDate} · {d.shift}</span>
            {statusChip(d.status)}
            <span className="ms-auto tx3">{d.lineCount ?? ""} ⏎</span>
          </button>
        ))}
        {items.length === 0 && apiOk && (
          <div className="glass-dark rounded-xl p-3 text-center text-[10px] tx3">
            {rtl ? "گزارشی ثبت نشده — «گزارش روزانه +»" : "No DPR yet — press + DPR"}
          </div>
        )}
      </div>

      {/* جزئیات + گردش تأیید */}
      {detail && (
        <div className="glass-dark space-y-2 rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
            <span className="font-mono tx1" dir="ltr">{detail.reportNo}</span>
            <span className="tx3" dir="ltr">{detail.reportDate} · {detail.shift}</span>
            {statusChip(detail.status)}
            <button onClick={() => setDetail(null)} className="ms-auto px-2 tx3">✕</button>
          </div>
          <table className="w-full border-collapse text-[9.5px]">
            <thead>
              <tr className="border-b b-line-soft text-[8.5px] tx3">
                <th className="px-1 py-1 text-start">Activity</th>
                <th className="px-1 py-1 text-center">{rtl ? "گام" : "Step"}</th>
                <th className="px-1 py-1 text-center">{rtl ? "مقدار" : "Qty"}</th>
                <th className="px-1 py-1 text-center">{rtl ? "وضعیت خط" : "Line"}</th>
              </tr>
            </thead>
            <tbody className="divide-y b-line-soft">
              {detail.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-1 py-1.5 font-mono tx2" dir="ltr">{l.activityCode}</td>
                  <td className="px-1 py-1.5 text-center tx1">{l.stepSeq}</td>
                  <td className="px-1 py-1.5 text-center tx1" dir="ltr">{l.qty} {l.uom ?? ""}</td>
                  <td className="px-1 py-1.5 text-center">
                    <span style={{ color: l.lineStatus === "approved" ? "#8FE3C8" : "#9AA4B2" }}>{l.lineStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={rtl ? "توضیح داور…" : "Review comment…"}
              className="min-w-[140px] flex-1 rounded-lg border b-line-soft bg-black/20 px-2 py-1.5 text-[10px] tx1 placeholder:text-[9px]"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            {(detail.status === "draft" || detail.status === "revision_required" || detail.status === "rejected") && (
              <button
                onClick={() => void runAction("submit")}
                disabled={busy}
                className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-sky-200 disabled:opacity-40"
              >
                {rtl ? "ارسال برای تأیید" : "Submit"}
              </button>
            )}
            {detail.status === "submitted" && (
              <>
                <button
                  onClick={() => void runAction("approve")}
                  disabled={busy}
                  className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-emerald-200 disabled:opacity-40"
                >
                  {rtl ? "تأیید (ورود به PMS)" : "Approve (→ PMS)"}
                </button>
                <button
                  onClick={() => void runAction("revise")}
                  disabled={busy}
                  className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-amber-200 disabled:opacity-40"
                >
                  {rtl ? "درخواست اصلاح" : "Request revision"}
                </button>
                <button
                  onClick={() => void runAction("reject")}
                  disabled={busy}
                  className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-rose-200 disabled:opacity-40"
                >
                  {rtl ? "رد" : "Reject"}
                </button>
              </>
            )}
          </div>
          {detail.events.length > 0 && (
            <div className="space-y-1 border-t b-line-soft pt-2">
              {detail.events.map((ev) => (
                <div key={ev.id} className="flex flex-wrap gap-2 text-[9px] tx3" dir="ltr">
                  <span className="font-mono tx2">{ev.actionCode}</span>
                  <span>{ev.fromStatus} → {ev.toStatus}</span>
                  <span>{ev.actorRole}</span>
                  <span className="ms-auto">{ev.createdAt}</span>
                  {ev.comment && <span className="w-full tx2" dir={rtl ? "rtl" : "ltr"}>{ev.comment}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
