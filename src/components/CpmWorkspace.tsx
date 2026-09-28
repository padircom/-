/**
 * P7 CPMS — میز کار زندهٔ ساخت و اجرا (d2: حوزهٔ کاری، DPR، دیسیپلینی؛ d8: بازرسی).
 * هیچ دادهٔ نمونه ندارد؛ همه از /api/cpm/:projectId/... می‌آید و اقدام‌ها
 * تابع مجوز واقعی کاربر (can) و گردش‌کار سمت سرور است.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import { CpmClient } from "../services/cpmApi";
import {
  ATTACHMENT_KINDS,
  ATTACHMENT_KIND_LABEL,
  DISCIPLINES,
  DISCIPLINE_ITEMS,
  DISCIPLINE_LABEL,
  ITEM_LABEL,
  ITEMS_WITH_RESULT,
  NDT_METHODS,
  NOTICE_HOURS,
  RESULT_CODES,
  RESULT_LABEL,
  SHIFT_CODES,
  STATUS_LABEL,
  WORK_AREA_STATUS,
  type CpmCan,
  type CpmDprRow,
  type CpmInspectionRow,
  type CpmWorkAreaRow,
  type CpmWorkspacePayload,
} from "../services/cpmWorkspace";

export type CpmTab = "areas" | "dpr" | "discipline" | "inspection";

const TABS: { id: CpmTab; fa: string; en: string }[] = [
  { id: "areas", fa: "حوزهٔ کاری پیمانکار", en: "Contractor work areas" },
  { id: "dpr", fa: "گزارش روزانه و پیوست", en: "Daily report & attachments" },
  { id: "discipline", fa: "گزارش‌های دیسیپلینی", en: "Discipline reports" },
  { id: "inspection", fa: "بازرسی (IR/RFI) و آزادسازی", en: "Inspection & QC release" },
];

const inputCls = "rounded-lg border b-line-soft bg-black/20 px-2.5 py-1.5 text-[11px] tx1 w-full";
const btnCls = "rounded-lg border px-2.5 py-1 text-[10.5px] transition disabled:opacity-40";
const btnPrimary = `${btnCls} border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20`;
const btnOk = `${btnCls} border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`;
const btnWarn = `${btnCls} border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20`;
const btnGhost = `${btnCls} border b-line-soft tx2 hover:bg-white/5`;

const todayIso = () => new Date().toISOString().slice(0, 10);
/** متن دوزبانه از دیکشنری‌های engine با بازگشت به خود کد در نبود کلید. */
const pick = (dict: Record<string, { fa: string; en: string }>, lang: Lang, code: string) => {
  const l = dict[code];
  return l ? (lang === "fa" ? l.fa : l.en) : code;
};
const fx = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: digits }));

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3 space-y-3">
      <div>
        <h4 className="text-[12px] font-semibold tx1">{title}</h4>
        {note && <p className="text-[10px] tx3 mt-1">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label: l, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 px-3 py-2">
      <div className="text-[9px] tx3">{l}</div>
      <div className={`text-[14px] font-semibold tabular-nums ${tone ?? "tx1"}`} dir="ltr">{value}</div>
    </div>
  );
}

function StatusChip({ lang, status }: { lang: Lang; status: string }) {
  const s = STATUS_LABEL[status];
  const tone =
    status === "approved" || status === "released" ? "border-emerald-400/40 text-emerald-200" :
    status === "returned" || status === "short" || status === "rejected" ? "border-rose-400/40 text-rose-200" :
    status === "submitted" ? "border-sky-400/40 text-sky-200" : "border b-line-soft tx3";
  return <span className={`rounded px-1.5 py-0.5 text-[9px] ${tone}`}>{s ? (lang === "fa" ? s.fa : s.en) : status}</span>;
}

export default function CpmWorkspace({
  lang,
  projectId: propProjectId,
  initialTab = "areas",
  hideTabs = false,
}: {
  lang: Lang;
  projectId?: string;
  initialTab?: CpmTab;
  hideTabs?: boolean;
}) {
  const { user } = useAuth();
  const { projectScope } = useSystem();
  const projectId = propProjectId ?? projectScope?.projectId ?? "";
  return (
    <LiveCpm
      key={`${projectId}:${user?.id ?? ""}`}
      lang={lang}
      projectId={projectId}
      initialTab={initialTab}
      hideTabs={hideTabs}
      userId={user?.id ?? null}
    />
  );
}

function LiveCpm({
  lang,
  projectId,
  initialTab,
  hideTabs,
  userId,
}: {
  lang: Lang;
  projectId: string;
  initialTab: CpmTab;
  hideTabs: boolean;
  userId: string | null;
}) {
  const rtl = lang === "fa";
  const client = useMemo(() => new CpmClient(projectId, userId), [projectId, userId]);
  const [tab, setTab] = useState<CpmTab>(initialTab);
  const [data, setData] = useState<CpmWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    const r = await client.workspace();
    if (r.ok) setData(r.data);
    else setError(`${r.message} (${r.code})`);
    setLoading(false);
  }, [client, projectId]);

  useEffect(() => { void load(); }, [load]);

  /** اجرای یک اقدام سرور با بازخوانی بعد از موفقیت و پیام خطای واقعی در غیر آن. */
  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; message?: string; code?: string }>, okMsg: string) => {
      setBusy(true);
      setFlash(null);
      const r = await fn();
      if (r.ok) {
        setFlash(okMsg);
        await load();
      } else {
        setFlash(`${r.message ?? "اقدام ناموفق بود"}${r.code ? ` (${r.code})` : ""}`);
      }
      setBusy(false);
    },
    [load],
  );

  if (!projectId) {
    return <div className="glass-dark rounded-2xl p-4 text-[11px] tx3">{rtl ? "پروژه‌ای انتخاب نشده است." : "No project selected."}</div>;
  }

  const can: CpmCan | undefined = data?.can;
  const m = data?.metrics;

  return (
    <div className="fade-rise flex min-h-0 flex-col gap-2.5" dir={rtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-2">
        {!hideTabs && TABS.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`rounded-lg border px-2.5 py-1 text-[10.5px] transition ${tab === x.id ? "border-sky-400/50 bg-sky-400/10 text-sky-200" : "border b-line-soft tx3 hover:tx1"}`}
          >
            {rtl ? x.fa : x.en}
          </button>
        ))}
        <button className={`${btnGhost} ms-auto`} onClick={() => void load()} disabled={loading || busy}>
          {rtl ? "بازخوانی" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[10.5px] text-rose-200">
          {rtl ? "دسترسی یا خواندن میز کار ممکن نشد" : "Cannot load workspace"} — {error}
        </div>
      )}
      {flash && <div className="rounded-xl border b-line-soft bg-black/20 px-3 py-2 text-[10.5px] tx2">{flash}</div>}

      {m && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label={rtl ? "حوزه‌های کاری" : "Work areas"} value={`${fx(m.workAreas.total)} · ${fx(m.workAreas.wbsCovered)} WBS`} />
          <Kpi label={rtl ? "آخرین گزارش روزانه" : "Last DPR"} value={m.dpr.lastReportDate ?? "—"} />
          <Kpi label={rtl ? "خطوط دیسیپلینی" : "Discipline lines"} value={`${fx(m.discipline.lines)} · ${fx(m.discipline.rejectedItems)} ${rtl ? "ردی" : "rej."}`} tone={m.discipline.rejectedItems ? "text-rose-300" : undefined} />
          <Kpi label={rtl ? "بازرسی باز / آزادشده" : "Open / released IR"} value={`${fx(m.inspection.open)} / ${fx(m.inspection.released)}`} tone={m.inspection.open ? "text-amber-200" : undefined} />
        </div>
      )}

      {data && tab === "areas" && <AreasTab lang={lang} data={data} can={can!} busy={busy} run={run} />}
      {data && tab === "dpr" && <DprTab lang={lang} data={data} can={can!} busy={busy} run={run} client={client} userId={userId} />}
      {data && tab === "discipline" && <DisciplineTab lang={lang} data={data} can={can!} busy={busy} run={run} />}
      {data && tab === "inspection" && <InspectionTab lang={lang} data={data} can={can!} busy={busy} run={run} />}
      {loading && !data && <div className="text-[11px] tx3">{rtl ? "در حال خواندن…" : "Loading…"}</div>}
      {data && <div className="text-[9px] tx4">{rtl ? "مدل" : "model"} <span dir="ltr">{data.modelVersion}</span></div>}
    </div>
  );
}

type RunFn = (fn: () => Promise<{ ok: boolean; message?: string; code?: string }>, okMsg: string) => Promise<void>;

/* ─────────────────────────── CPM-1 ─────────────────────────── */

function AreasTab({ lang, data, can, busy, run }: { lang: Lang; data: CpmWorkspacePayload; can: CpmCan; busy: boolean; run: RunFn }) {
  const rtl = lang === "fa";
  const client = useMemo(() => new CpmClient(data.projectId, null), [data.projectId]);
  const [form, setForm] = useState({ Code: "", WbsCode: "", ContractorCode: "", Discipline: "piping", ScopeFa: "", WeightPct: "", StartDate: "", EndDate: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-2.5">
      {can.workAreaEdit && (
        <Section title={rtl ? "تخصیص WBS به پیمانکار" : "Assign WBS to contractor"} note={rtl ? "کد WBS و کد پیمانکار باید در همین پروژه موجود باشند؛ جمع وزن هر WBS حداکثر ۱۰۰٪." : "WBS and contractor must exist in this project; weight per WBS ≤ 100%."}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <input className={inputCls} placeholder={rtl ? "کد حوزهٔ کاری" : "Code"} dir="ltr" value={form.Code} onChange={(e) => set("Code", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "کد WBS" : "WBS code"} dir="ltr" value={form.WbsCode} onChange={(e) => set("WbsCode", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "کد پیمانکار (قرارداد فرعی)" : "Contractor code"} dir="ltr" value={form.ContractorCode} onChange={(e) => set("ContractorCode", e.target.value)} />
            <select className={inputCls} value={form.Discipline} onChange={(e) => set("Discipline", e.target.value)}>
              {DISCIPLINES.map((d) => <option key={d} value={d}>{rtl ? DISCIPLINE_LABEL[d].fa : DISCIPLINE_LABEL[d].en}</option>)}
            </select>
            <input className={`${inputCls} md:col-span-2`} placeholder={rtl ? "شرح دامنه" : "Scope"} value={form.ScopeFa} onChange={(e) => set("ScopeFa", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "وزن ٪" : "Weight %"} dir="ltr" value={form.WeightPct} onChange={(e) => set("WeightPct", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} type="date" dir="ltr" value={form.StartDate} onChange={(e) => set("StartDate", e.target.value)} />
              <input className={inputCls} type="date" dir="ltr" value={form.EndDate} onChange={(e) => set("EndDate", e.target.value)} />
            </div>
          </div>
          <button
            className={btnPrimary}
            disabled={busy || !form.Code || !form.WbsCode || !form.ContractorCode || !form.ScopeFa}
            onClick={() => void run(
              () => client.createWorkArea({
                Code: form.Code, WbsCode: form.WbsCode, ContractorCode: form.ContractorCode, Discipline: form.Discipline,
                ScopeFa: form.ScopeFa, WeightPct: form.WeightPct === "" ? null : Number(form.WeightPct),
                StartDate: form.StartDate || null, EndDate: form.EndDate || null,
              }),
              rtl ? "حوزهٔ کاری ثبت شد" : "Work area created",
            )}
          >
            {rtl ? "ثبت حوزهٔ کاری" : "Create work area"}
          </button>
        </Section>
      )}

      <Section title={rtl ? "حوزه‌های کاری همین پروژه" : "Work areas"} note={`${data.workAreas.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[10.5px]">
            <thead className="tx3">
              <tr className="border-b b-line-soft">
                <th className="px-2 py-1 text-start">Code</th>
                <th className="px-2 py-1 text-start">WBS</th>
                <th className="px-2 py-1 text-start">{rtl ? "پیمانکار" : "Contractor"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "دیسیپلین" : "Discipline"}</th>
                <th className="px-2 py-1 text-center">{rtl ? "وزن" : "Weight"}</th>
                <th className="px-2 py-1 text-center">{rtl ? "وضعیت" : "Status"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "اقدام" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {data.workAreas.map((w: CpmWorkAreaRow) => (
                <tr key={w.Id} className="border-b b-line-soft/50">
                  <td className="px-2 py-1 font-mono tx2" dir="ltr">{w.Code}</td>
                  <td className="px-2 py-1 font-mono tx3" dir="ltr">{w.WbsCode}</td>
                  <td className="px-2 py-1 font-mono tx3" dir="ltr">{w.ContractorCode}</td>
                  <td className="px-2 py-1 tx2">{pick(DISCIPLINE_LABEL, lang, w.Discipline)}</td>
                  <td className="px-2 py-1 text-center tabular-nums tx2" dir="ltr">{w.WeightPct == null ? "—" : `${w.WeightPct}%`}</td>
                  <td className="px-2 py-1 text-center"><StatusChip lang={lang} status={w.Status} /></td>
                  <td className="px-2 py-1">
                    {can.workAreaEdit && (
                      <div className="flex flex-wrap gap-1">
                        {WORK_AREA_STATUS.filter((s) => s !== w.Status).slice(0, 2).map((s) => (
                          <button key={s} className={btnGhost} disabled={busy}
                            onClick={() => void run(() => client.updateWorkArea(w.Code, { Status: s, RowVersion: w.RowVersion }), rtl ? "وضعیت به‌روز شد" : "Status updated")}>
                            {rtl ? STATUS_LABEL[s]?.fa ?? s : STATUS_LABEL[s]?.en ?? s}
                          </button>
                        ))}
                        <button className={btnWarn} disabled={busy}
                          onClick={() => void run(() => client.deleteWorkArea(w.Code), rtl ? "حوزه حذف شد" : "Deleted")}>
                          {rtl ? "حذف" : "Delete"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {data.workAreas.length === 0 && <tr><td className="px-2 py-3 tx3" colSpan={7}>{rtl ? "موردی ثبت نشده است." : "No records."}</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ─────────────────────────── CPM-2 ─────────────────────────── */

function DprTab({ lang, data, can, busy, run, client, userId }: { lang: Lang; data: CpmWorkspacePayload; can: CpmCan; busy: boolean; run: RunFn; client: CpmClient; userId: string | null }) {
  const rtl = lang === "fa";
  const [form, setForm] = useState({ ReportNo: "", ReportDate: todayIso(), Shift: "day", ContractorCode: "", Discipline: "piping", WorkAreaCode: "", LocationFa: "", ManpowerCount: "", WorkDoneFa: "" });
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState("photo");
  const [note, setNote] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const attachmentsOf = (no: string) => (data.attachments as any[]).filter((a) => a.ReportNo === no);

  return (
    <div className="space-y-2.5">
      {can.dprRecord && (
        <Section title={rtl ? "ثبت گزارش روزانهٔ پیمانکار" : "New contractor daily report"} note={rtl ? "گزارش همیشه پیش‌نویس ساخته می‌شود؛ سپس ارسال و تأیید توسط غیرثبت‌کننده." : "Always created as draft; submit then approve by someone else."}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <input className={inputCls} placeholder={rtl ? "شمارهٔ گزارش" : "Report no."} dir="ltr" value={form.ReportNo} onChange={(e) => set("ReportNo", e.target.value)} />
            <input className={inputCls} type="date" dir="ltr" value={form.ReportDate} onChange={(e) => set("ReportDate", e.target.value)} />
            <select className={inputCls} value={form.Shift} onChange={(e) => set("Shift", e.target.value)}>
              {SHIFT_CODES.map((s) => <option key={s} value={s}>{rtl ? STATUS_LABEL[s]?.fa : STATUS_LABEL[s]?.en}</option>)}
            </select>
            <input className={inputCls} placeholder={rtl ? "کد پیمانکار" : "Contractor code"} dir="ltr" value={form.ContractorCode} onChange={(e) => set("ContractorCode", e.target.value)} />
            <select className={inputCls} value={form.Discipline} onChange={(e) => set("Discipline", e.target.value)}>
              {DISCIPLINES.map((dd) => <option key={dd} value={dd}>{rtl ? DISCIPLINE_LABEL[dd].fa : DISCIPLINE_LABEL[dd].en}</option>)}
            </select>
            <input className={inputCls} placeholder={rtl ? "کد حوزهٔ کاری (اختیاری)" : "Work area (optional)"} dir="ltr" value={form.WorkAreaCode} onChange={(e) => set("WorkAreaCode", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "موقعیت" : "Location"} value={form.LocationFa} onChange={(e) => set("LocationFa", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "نفرات" : "Manpower"} dir="ltr" value={form.ManpowerCount} onChange={(e) => set("ManpowerCount", e.target.value)} />
            <input className={`${inputCls} md:col-span-3`} placeholder={rtl ? "کار انجام‌شده" : "Work done"} value={form.WorkDoneFa} onChange={(e) => set("WorkDoneFa", e.target.value)} />
          </div>
          <button className={btnPrimary} disabled={busy || !form.ReportNo || !form.ContractorCode || !form.LocationFa || !form.WorkDoneFa}
            onClick={() => void run(
              () => client.createDpr({ ...form, ManpowerCount: Number(form.ManpowerCount || 0), WorkAreaCode: form.WorkAreaCode || null }),
              rtl ? "گزارش پیش‌نویس ثبت شد" : "Draft saved",
            )}>
            {rtl ? "ثبت پیش‌نویس" : "Save draft"}
          </button>
        </Section>
      )}

      <Section title={rtl ? "گزارش‌های روزانه" : "Daily reports"} note={`${data.dprEntries.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[10.5px]">
            <thead className="tx3">
              <tr className="border-b b-line-soft">
                <th className="px-2 py-1 text-start">{rtl ? "شماره" : "No"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "تاریخ" : "Date"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "پیمانکار" : "Contractor"}</th>
                <th className="px-2 py-1 text-center">{rtl ? "نفرات" : "Manpower"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "کار انجام‌شده" : "Work done"}</th>
                <th className="px-2 py-1 text-center">{rtl ? "پیوست" : "Files"}</th>
                <th className="px-2 py-1 text-center">{rtl ? "وضعیت" : "Status"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "اقدام" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {data.dprEntries.map((d: CpmDprRow) => (
                <tr key={d.Id} className="border-b b-line-soft/50 align-top">
                  <td className="px-2 py-1 font-mono tx2" dir="ltr">{d.ReportNo}</td>
                  <td className="px-2 py-1 tx3" dir="ltr">{d.ReportDate}</td>
                  <td className="px-2 py-1 font-mono tx3" dir="ltr">{d.ContractorCode}</td>
                  <td className="px-2 py-1 text-center tabular-nums tx2">{d.ManpowerCount}</td>
                  <td className="px-2 py-1 tx2 max-w-[220px] truncate" title={d.WorkDoneFa}>{d.WorkDoneFa}</td>
                  <td className="px-2 py-1 text-center">
                    <button className={btnGhost} onClick={() => setOpenRow(openRow === d.ReportNo ? null : d.ReportNo)}>
                      {attachmentsOf(d.ReportNo).length} {rtl ? "فایل" : "file(s)"}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-center"><StatusChip lang={lang} status={d.Status} /></td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {can.dprRecord && (d.Status === "draft" || d.Status === "returned") && (
                        <button className={btnPrimary} disabled={busy} onClick={() => void run(() => client.dprTransition(d.ReportNo, "submit"), rtl ? "ارسال شد" : "Submitted")}>
                          {rtl ? "ارسال" : "Submit"}
                        </button>
                      )}
                      {can.dprApprove && d.Status === "submitted" && d.SubmittedBy !== userId && (
                        <>
                          <button className={btnOk} disabled={busy} onClick={() => void run(() => client.dprTransition(d.ReportNo, "approve"), rtl ? "تأیید شد" : "Approved")}>
                            {rtl ? "تأیید" : "Approve"}
                          </button>
                          <button className={btnWarn} disabled={busy} onClick={() => {
                            const reason = window.prompt(rtl ? "دلیل برگشت:" : "Return reason:");
                            if (reason) void run(() => client.dprTransition(d.ReportNo, "return", reason), rtl ? "برگشت خورد" : "Returned");
                          }}>
                            {rtl ? "برگشت" : "Return"}
                          </button>
                        </>
                      )}
                    </div>
                    {openRow === d.ReportNo && (
                      <div className="mt-1.5 space-y-1.5 rounded-lg border b-line-soft bg-black/15 p-2">
                        {attachmentsOf(d.ReportNo).map((a: any) => (
                          <div key={a.Id} className="flex items-center gap-2 text-[9.5px]">
                            <span className="tx2">{rtl ? ATTACHMENT_KIND_LABEL[a.Kind]?.fa ?? a.Kind : ATTACHMENT_KIND_LABEL[a.Kind]?.en ?? a.Kind}</span>
                            <span className="font-mono tx3" dir="ltr">{a.FileName}</span>
                            <span className="tx4" dir="ltr">{a.SizeBytes}B</span>
                            <button className={btnGhost} onClick={() => void client.downloadDprAttachment(d.ReportNo, a.Id, a.FileName).then((r) => !r.ok && setNote(r.message))}>
                              {rtl ? "دانلود" : "Download"}
                            </button>
                            {can.dprRecord && d.Status !== "approved" && (
                              <button className={btnWarn} disabled={busy} onClick={() => void run(() => client.deleteDprAttachment(d.ReportNo, a.Id), rtl ? "پیوست حذف شد" : "Deleted")}>
                                {rtl ? "حذف" : "Delete"}
                              </button>
                            )}
                          </div>
                        ))}
                        {attachmentsOf(d.ReportNo).length === 0 && <div className="text-[9.5px] tx3">{rtl ? "پیوستی ندارد." : "No attachments."}</div>}
                        {can.dprRecord && d.Status !== "approved" && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <select className={`${inputCls} w-auto`} value={kind} onChange={(e) => setKind(e.target.value)}>
                              {ATTACHMENT_KINDS.map((k) => <option key={k} value={k}>{rtl ? ATTACHMENT_KIND_LABEL[k].fa : ATTACHMENT_KIND_LABEL[k].en}</option>)}
                            </select>
                            <input type="file" className="text-[9.5px] tx3" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                            <button className={btnPrimary} disabled={busy || !file} onClick={() => void run(async () => {
                              const r = await client.uploadDprAttachment(d.ReportNo, file!, kind, note);
                              return r.ok ? { ok: true } : { ok: false, message: r.message, code: r.code };
                            }, rtl ? "پیوست بارگذاری شد" : "Uploaded").then(() => { setFile(null); })}>
                              {rtl ? "بارگذاری" : "Upload"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {data.dprEntries.length === 0 && <tr><td className="px-2 py-3 tx3" colSpan={8}>{rtl ? "موردی ثبت نشده است." : "No records."}</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ─────────────────────────── CPM-3 ─────────────────────────── */

type LineDraft = { ItemRef: string; ItemType: string; SizeInch: string; Quantity: string; ResultCode: string; NdtMethod: string; NoteFa: string };

function DisciplineTab({ lang, data, can, busy, run }: { lang: Lang; data: CpmWorkspacePayload; can: CpmCan; busy: boolean; run: RunFn }) {
  const rtl = lang === "fa";
  const client = useMemo(() => new CpmClient(data.projectId, null), [data.projectId]);
  const [form, setForm] = useState({ ReportNo: "", ReportDate: todayIso(), Discipline: "piping", ContractorCode: "", WorkAreaCode: "" });
  const [lines, setLines] = useState<LineDraft[]>([{ ItemRef: "", ItemType: "weld", SizeInch: "", Quantity: "", ResultCode: "pending", NdtMethod: "RT", NoteFa: "" }]);
  const items = DISCIPLINE_ITEMS[form.Discipline as never] as readonly string[];
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (i: number, k: keyof LineDraft, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const linePayload = (l: LineDraft) => {
    const needsResult = ITEMS_WITH_RESULT.includes(l.ItemType);
    const pipingSize = ["fitup", "weld", "ndt"].includes(l.ItemType);
    return {
      ItemRef: l.ItemRef,
      ItemType: l.ItemType,
      SizeInch: l.SizeInch === "" ? null : Number(l.SizeInch),
      Quantity: Number(l.Quantity),
      ...(needsResult ? { ResultCode: l.ResultCode } : {}),
      ...(l.ItemType === "ndt" ? { NdtMethod: l.NdtMethod, ...(l.NoteFa ? { NoteFa: l.NoteFa } : {}), ...(l.ResultCode === "ok" || l.ResultCode === "rejected" ? { TestDate: form.ReportDate } : {}) } : {}),
      ...(needsResult && l.ResultCode === "rejected" ? { NoteFa: l.NoteFa } : {}),
      ...(!pipingSize && !needsResult && l.NoteFa ? { NoteFa: l.NoteFa } : {}),
    };
  };

  return (
    <div className="space-y-2.5">
      {can.disciplineRecord && (
        <Section title={rtl ? "ثبت گزارش دیسیپلینی" : "New discipline report"} note={rtl ? "آیتم‌های مجاز هر دیسیپلین محدود است؛ نتیجهٔ «رد» بدون دلیل ثبت نمی‌شود." : "Allowed items are per discipline; a rejected result needs a reason."}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <input className={inputCls} placeholder={rtl ? "شمارهٔ گزارش" : "Report no."} dir="ltr" value={form.ReportNo} onChange={(e) => set("ReportNo", e.target.value)} />
            <input className={inputCls} type="date" dir="ltr" value={form.ReportDate} onChange={(e) => set("ReportDate", e.target.value)} />
            <select className={inputCls} value={form.Discipline} onChange={(e) => { set("Discipline", e.target.value); setLines((ls) => ls.map((l) => ({ ...l, ItemType: DISCIPLINE_ITEMS[e.target.value as never][0] }))); }}>
              {DISCIPLINES.map((d) => <option key={d} value={d}>{rtl ? DISCIPLINE_LABEL[d].fa : DISCIPLINE_LABEL[d].en}</option>)}
            </select>
            <input className={inputCls} placeholder={rtl ? "کد پیمانکار" : "Contractor code"} dir="ltr" value={form.ContractorCode} onChange={(e) => set("ContractorCode", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "کد حوزهٔ کاری (اختیاری)" : "Work area (optional)"} dir="ltr" value={form.WorkAreaCode} onChange={(e) => set("WorkAreaCode", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            {lines.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <input className={`${inputCls} w-28`} placeholder={rtl ? "شناسهٔ آیتم" : "Item ref"} dir="ltr" value={l.ItemRef} onChange={(e) => setLine(i, "ItemRef", e.target.value)} />
                <select className={`${inputCls} w-36`} value={l.ItemType} onChange={(e) => setLine(i, "ItemType", e.target.value)}>
                  {items.map((it) => <option key={it} value={it}>{rtl ? ITEM_LABEL[it]?.fa ?? it : ITEM_LABEL[it]?.en ?? it}</option>)}
                </select>
                <input className={`${inputCls} w-20`} placeholder={rtl ? "اینچ" : "inch"} dir="ltr" value={l.SizeInch} onChange={(e) => setLine(i, "SizeInch", e.target.value)} />
                <input className={`${inputCls} w-20`} placeholder={rtl ? "مقدار" : "qty"} dir="ltr" value={l.Quantity} onChange={(e) => setLine(i, "Quantity", e.target.value)} />
                {ITEMS_WITH_RESULT.includes(l.ItemType) && (
                  <select className={`${inputCls} w-24`} value={l.ResultCode} onChange={(e) => setLine(i, "ResultCode", e.target.value)}>
                    {RESULT_CODES.map((rr) => <option key={rr} value={rr}>{rtl ? RESULT_LABEL[rr].fa : RESULT_LABEL[rr].en}</option>)}
                  </select>
                )}
                {l.ItemType === "ndt" && (
                  <select className={`${inputCls} w-20`} value={l.NdtMethod} onChange={(e) => setLine(i, "NdtMethod", e.target.value)}>
                    {NDT_METHODS.map((nm) => <option key={nm} value={nm}>{nm}</option>)}
                  </select>
                )}
                {ITEMS_WITH_RESULT.includes(l.ItemType) && l.ResultCode === "rejected" && (
                  <input className={`${inputCls} w-44`} placeholder={rtl ? "دلیل رد" : "reject reason"} value={l.NoteFa} onChange={(e) => setLine(i, "NoteFa", e.target.value)} />
                )}
                <button className={btnGhost} disabled={lines.length <= 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>−</button>
              </div>
            ))}
            <button className={btnGhost} onClick={() => setLines((ls) => [...ls, { ItemRef: "", ItemType: items[0], SizeInch: "", Quantity: "", ResultCode: "pending", NdtMethod: "RT", NoteFa: "" }])}>
              {rtl ? "افزودن خط" : "Add line"}
            </button>
          </div>
          <button className={btnPrimary} disabled={busy || !form.ReportNo || !form.ContractorCode || lines.some((l) => !l.ItemRef || !l.Quantity)}
            onClick={() => void run(
              () => client.createReport({
                ...form, WorkAreaCode: form.WorkAreaCode || null,
                Lines: lines.map(linePayload),
              }),
              rtl ? "گزارش ثبت شد" : "Report saved",
            )}>
            {rtl ? "ثبت گزارش" : "Save report"}
          </button>
        </Section>
      )}

      <Section title={rtl ? "گزارش‌های دیسیپلینی" : "Discipline reports"} note={`${data.reports.length}`}>
        <div className="space-y-2">
          {data.reports.map((r) => (
            <div key={r.Id} className="rounded-xl border b-line-soft bg-black/10 p-2">
              <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                <span className="font-mono tx1" dir="ltr">{r.ReportNo}</span>
                <span className="tx3" dir="ltr">{r.ReportDate}</span>
                <span className="tx2">{pick(DISCIPLINE_LABEL, lang, r.Discipline)}</span>
                <span className="font-mono tx4" dir="ltr">{r.ContractorCode}</span>
                <span className="tx3">{rtl ? "خط" : "lines"}: <b className="tx1 tabular-nums">{r.LineCount ?? r.Lines?.length ?? 0}</b></span>
                <span className="tx3">{rtl ? "ردی" : "rejected"}: <b className={r.RejectedCount ? "text-rose-300 tabular-nums" : "tx1 tabular-nums"}>{r.RejectedCount ?? 0}</b></span>
                <span className="tx3">NDT: <b className="tx1 tabular-nums" dir="ltr">{r.NdtPassRate == null ? "—" : `${Math.round(r.NdtPassRate * 100)}%`}</b></span>
                <StatusChip lang={lang} status={r.Status} />
                <div className="ms-auto flex gap-1">
                  {can.disciplineRecord && (r.Status === "draft" || r.Status === "returned") && (
                    <button className={btnPrimary} disabled={busy} onClick={() => void run(() => client.reportTransition(r.ReportNo, "submit"), rtl ? "ارسال شد" : "Submitted")}>{rtl ? "ارسال" : "Submit"}</button>
                  )}
                  {can.disciplineApprove && r.Status === "submitted" && r.CreatedBy !== undefined && (
                    <>
                      <button className={btnOk} disabled={busy} onClick={() => void run(() => client.reportTransition(r.ReportNo, "approve"), rtl ? "تأیید شد" : "Approved")}>{rtl ? "تأیید" : "Approve"}</button>
                      <button className={btnWarn} disabled={busy} onClick={() => {
                        const reason = window.prompt(rtl ? "دلیل برگشت:" : "Return reason:");
                        if (reason) void run(() => client.reportTransition(r.ReportNo, "return", reason), rtl ? "برگشت خورد" : "Returned");
                      }}>{rtl ? "برگشت" : "Return"}</button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(r.Lines ?? []).map((l) => (
                  <span key={l.Id ?? l.ItemRef} className={`rounded border px-1.5 py-0.5 text-[9px] ${l.ResultCode === "rejected" ? "border-rose-400/40 text-rose-200" : "border b-line-soft tx3"}`}>
                    <span className="font-mono" dir="ltr">{l.ItemRef}</span> · {rtl ? ITEM_LABEL[l.ItemType]?.fa ?? l.ItemType : ITEM_LABEL[l.ItemType]?.en ?? l.ItemType}
                    {l.SizeInch != null ? ` · ${l.SizeInch}"` : ""}
                    {ITEMS_WITH_RESULT.includes(l.ItemType) ? ` · ${rtl ? RESULT_LABEL[l.ResultCode]?.fa ?? l.ResultCode : RESULT_LABEL[l.ResultCode]?.en ?? l.ResultCode}` : ""}
                    {l.NdtMethod ? ` · ${l.NdtMethod}` : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {data.reports.length === 0 && <div className="text-[10.5px] tx3">{rtl ? "موردی ثبت نشده است." : "No records."}</div>}
        </div>
      </Section>
    </div>
  );
}

/* ─────────────────────────── CPM-4 ─────────────────────────── */

function InspectionTab({ lang, data, can, busy, run }: { lang: Lang; data: CpmWorkspacePayload; can: CpmCan; busy: boolean; run: RunFn }) {
  const rtl = lang === "fa";
  const client = useMemo(() => new CpmClient(data.projectId, null), [data.projectId]);
  const [form, setForm] = useState({ RequestNo: "", RequestType: "ir", ActivityCode: "", Discipline: "piping", ContractorCode: "", LocationFa: "", ScopeFa: "", RequestedAt: todayIso(), TargetDate: "", WitnessRequired: false });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-2.5">
      {can.inspectionRequest && (
        <Section title={rtl ? "درخواست بازرسی (IR/RFI)" : "Inspection request (IR/RFI)"} note={rtl ? `اعلان کمتر از ${NOTICE_HOURS} ساعت از تاریخ درخواست تا تاریخ بازرسی، «کوتاه» علامت می‌خورد. آزادسازی فقط توسط QC و توسط غیرثبت‌کننده.` : `Notice under ${NOTICE_HOURS}h is flagged; release only by QC and never by the requester.`}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <input className={inputCls} placeholder={rtl ? "شمارهٔ درخواست" : "Request no."} dir="ltr" value={form.RequestNo} onChange={(e) => set("RequestNo", e.target.value)} />
            <select className={inputCls} value={form.RequestType} onChange={(e) => set("RequestType", e.target.value)}>
              <option value="ir">{rtl ? STATUS_LABEL.ir.fa : STATUS_LABEL.ir.en}</option>
              <option value="rfi">{rtl ? STATUS_LABEL.rfi.fa : STATUS_LABEL.rfi.en}</option>
            </select>
            <input className={inputCls} placeholder={rtl ? "کد فعالیت" : "Activity code"} dir="ltr" value={form.ActivityCode} onChange={(e) => set("ActivityCode", e.target.value)} />
            <select className={inputCls} value={form.Discipline} onChange={(e) => set("Discipline", e.target.value)}>
              {DISCIPLINES.map((d) => <option key={d} value={d}>{rtl ? DISCIPLINE_LABEL[d].fa : DISCIPLINE_LABEL[d].en}</option>)}
            </select>
            <input className={inputCls} placeholder={rtl ? "کد پیمانکار" : "Contractor code"} dir="ltr" value={form.ContractorCode} onChange={(e) => set("ContractorCode", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "موقعیت" : "Location"} value={form.LocationFa} onChange={(e) => set("LocationFa", e.target.value)} />
            <input className={inputCls} type="date" dir="ltr" value={form.RequestedAt} onChange={(e) => set("RequestedAt", e.target.value)} />
            <input className={inputCls} type="date" dir="ltr" value={form.TargetDate} onChange={(e) => set("TargetDate", e.target.value)} />
            <input className={`${inputCls} md:col-span-3`} placeholder={rtl ? "شرح بازرسی" : "Scope"} value={form.ScopeFa} onChange={(e) => set("ScopeFa", e.target.value)} />
            <label className="flex items-center gap-1.5 text-[10.5px] tx2">
              <input type="checkbox" checked={form.WitnessRequired} onChange={(e) => set("WitnessRequired", e.target.checked)} />
              {rtl ? "نیاز به شاهد" : "Witness required"}
            </label>
          </div>
          <button className={btnPrimary} disabled={busy || !form.RequestNo || !form.ActivityCode || !form.ContractorCode || !form.LocationFa || !form.ScopeFa}
            onClick={() => void run(
              () => client.createInspection({ ...form, TargetDate: form.TargetDate || null }),
              rtl ? "درخواست ثبت شد" : "Request created",
            )}>
            {rtl ? "ثبت درخواست" : "Create request"}
          </button>
        </Section>
      )}

      <Section title={rtl ? "درخواست‌ها و آزادسازی" : "Requests & release"} note={`${data.requests.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[10.5px]">
            <thead className="tx3">
              <tr className="border-b b-line-soft">
                <th className="px-2 py-1 text-start">{rtl ? "شماره" : "No"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "نوع" : "Type"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "فعالیت" : "Activity"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "بازرسی" : "Target"}</th>
                <th className="px-2 py-1 text-center">{rtl ? "اعلان" : "Notice"}</th>
                <th className="px-2 py-1 text-center">{rtl ? "سن (روز)" : "Age"}</th>
                <th className="px-2 py-1 text-center">{rtl ? "وضعیت" : "Status"}</th>
                <th className="px-2 py-1 text-start">{rtl ? "اقدام" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((r: CpmInspectionRow) => (
                <tr key={r.Id} className="border-b b-line-soft/50">
                  <td className="px-2 py-1 font-mono tx2" dir="ltr">{r.RequestNo}</td>
                  <td className="px-2 py-1 tx3" dir="ltr">{r.RequestType.toUpperCase()}</td>
                  <td className="px-2 py-1 font-mono tx3" dir="ltr">{r.ActivityCode}</td>
                  <td className="px-2 py-1 tx3" dir="ltr">{r.TargetDate ?? "—"}</td>
                  <td className="px-2 py-1 text-center">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] ${r.notice?.status === "ok" ? "border b-line-soft tx3" : r.notice?.status === "short" ? "border-amber-400/40 text-amber-200" : "tx4"}`} dir="ltr">
                      {r.notice?.hours == null ? "—" : `${r.notice.hours}h`}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center tabular-nums tx3">{r.ageDays ?? "—"}</td>
                  <td className="px-2 py-1 text-center">
                    <StatusChip lang={lang} status={r.Status} />
                    {r.ReleasedBy && <div className="text-[8.5px] tx4" dir="ltr">{r.ReleasedBy}</div>}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {can.inspectionRequest && r.Status === "draft" && (
                        <button className={btnPrimary} disabled={busy} onClick={() => void run(() => client.inspectionTransition(r.RequestNo, "submit"), rtl ? "ارسال شد" : "Submitted")}>{rtl ? "ارسال" : "Submit"}</button>
                      )}
                      {can.inspectionRelease && r.Status === "submitted" && (
                        <>
                          <button className={btnOk} disabled={busy} onClick={() => void run(() => client.inspectionTransition(r.RequestNo, "release"), rtl ? "آزاد شد" : "Released")}>{rtl ? "آزادسازی" : "Release"}</button>
                          <button className={btnWarn} disabled={busy} onClick={() => {
                            const reason = window.prompt(rtl ? "دلیل رد بازرسی:" : "Reject reason:");
                            if (reason) void run(() => client.inspectionTransition(r.RequestNo, "reject", reason), rtl ? "رد شد" : "Rejected");
                          }}>{rtl ? "رد" : "Reject"}</button>
                        </>
                      )}
                      {r.InspectionRecordId && <span className="self-center text-[8.5px] tx4" dir="ltr">QMS: {r.InspectionRecordId}</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {data.requests.length === 0 && <tr><td className="px-2 py-3 tx3" colSpan={8}>{rtl ? "موردی ثبت نشده است." : "No records."}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-[9.5px] tx4">
          {rtl
            ? "آزادسازی/رد، سند InspectionRecord در QMS می‌سازد و تفکیک وظیفه (SOD-29) سمت سرور کنترل می‌شود."
            : "Release/reject creates the QMS InspectionRecord; SoD-29 is enforced server-side."}
        </p>
      </Section>
    </div>
  );
}
