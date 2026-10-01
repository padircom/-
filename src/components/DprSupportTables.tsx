import { Fragment, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { DPR_MANPOWER, DPR_MANPOWER_GROUPS } from "../data/dprManpower";
import { DPR_MACHINERY, DPR_MACHINERY_GROUPS } from "../data/dprMachinery";
import {
  DPR_SITE_STATUSES,
  DPR_WEATHERS,
  activityCalc,
  activityHistoryKey,
  changeCalc,
  emptyReport,
  jalaliMonthNameFa,
  machineryTotals,
  manpowerTotals,
  normalizeReport,
  splitReportDate,
  type DprChangeRow,
  type DprHistory,
  type DprMainActivityRow,
  type DprMaterialRow,
  type DprReportStatus,
  type DprTablesReport,
  MATERIAL_CATALOG,
} from "../services/dprTables";
import {
  DprTablesError,
  dprReportAction,
  getDprReport,
  listDprReports,
  saveDprReport,
  type DprReportSummary,
} from "../services/dprTablesApi";

export interface DprIdentityInfo {
  reportNo: string;
  reportDate: string;
}

export interface DprGeneralInfo {
  siteStatus: string;
  weather: string;
  avgTemp: number | null;
  humidity: number | null;
}

type TabId = "site" | "narrative" | "manpower" | "machinery" | "materials" | "changes" | "activities";

const TABS: Array<{ id: TabId; fa: string; en: string }> = [
  { id: "site", fa: "وضعیت کارگاه", en: "Site status" },
  { id: "narrative", fa: "شرح تشریحی", en: "Narrative" },
  { id: "manpower", fa: "نیروی انسانی", en: "Manpower" },
  { id: "machinery", fa: "ماشین‌آلات", en: "Machinery" },
  { id: "materials", fa: "متریال وارده", en: "Materials" },
  { id: "changes", fa: "تغییرات و فعالیت", en: "Changes" },
  { id: "activities", fa: "فعالیت‌های اصلی", en: "Main activities" },
];

const STATUS_FA: Record<DprReportStatus, string> = { draft: "پیش‌نویس", submitted: "ارسال‌شده", approved: "تأییدشده" };
const STATUS_COLOR: Record<DprReportStatus, string> = { draft: "#9AA4B2", submitted: "#7FB2FF", approved: "#8FE3C8" };

/** نرمال‌سازی ارقام فارسی/عربی به لاتین. */
function faDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

function todayJalali(): string {
  try {
    const parts = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const g = (t: string) => faDigits(parts.find((p) => p.type === t)?.value ?? "");
    return `${g("year")}/${g("month")}/${g("day")}`;
  } catch {
    return "";
  }
}

function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${Math.round(v * 100) / 100}%`;
}

function fmtQty(v: number | null): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US");
}

function groupOrder(codes: Array<{ code: string; group: string }>): string[] {
  const out: string[] = [];
  for (const r of codes) if (!out.includes(r.group)) out.push(r.group);
  return out;
}

/* ── سلول عددی با حالت محلی: تایپ روان بدون بازرندر کل جدول ──────── */
function CellNum({
  value,
  onCommit,
  disabled,
  resetKey,
  wide,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  disabled: boolean;
  resetKey: string;
  wide?: boolean;
}) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  useEffect(() => {
    setText(value === null || value === undefined ? "" : String(value));
  }, [value, resetKey]);
  const commit = () => {
    const t = faDigits(text).trim();
    if (t === "") {
      onCommit(null);
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      setText(value === null || value === undefined ? "" : String(value));
      return;
    }
    onCommit(n);
  };
  return (
    <input
      value={text}
      disabled={disabled}
      dir="ltr"
      inputMode="decimal"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`${wide ? "w-24" : "w-16"} rounded-md border b-line-soft bg-black/20 px-1 py-0.5 text-center tabular-nums tx1 outline-none focus:border-[var(--accent)] disabled:opacity-50`}
    />
  );
}

/* ── سلول متنی کوتاه با حالت محلی ───────────────────────────────── */
function CellText({
  value,
  onCommit,
  disabled,
  resetKey,
  listId,
  placeholder,
  align,
}: {
  value: string;
  onCommit: (v: string) => void;
  disabled: boolean;
  resetKey: string;
  listId?: string;
  placeholder?: string;
  align?: "start" | "center";
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => {
    setText(value ?? "");
  }, [value, resetKey]);
  return (
    <input
      value={text}
      disabled={disabled}
      list={listId}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`w-full min-w-16 rounded-md border b-line-soft bg-black/20 px-1.5 py-0.5 tx1 outline-none placeholder:text-[8px] focus:border-[var(--accent)] disabled:opacity-50 ${align === "center" ? "text-center" : "text-start"}`}
    />
  );
}

const th = "border-e border-b b-line-soft px-1.5 py-2 text-center font-normal whitespace-nowrap";
const td = "border-e b-line-soft px-1.5 py-1 text-center";
const tdL = "border-e b-line-soft px-1.5 py-1 text-start";
const calc = "bg-black/10 tx2 tabular-nums";

export default function DprSupportTables({
  lang,
  projectCode,
  canEdit,
  onIdentity,
  onGeneralStatus,
}: {
  lang: Lang;
  projectCode: string;
  canEdit: boolean;
  onIdentity?: (info: DprIdentityInfo) => void;
  onGeneralStatus?: (info: DprGeneralInfo) => void;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<TabId>("site");
  const [dateText, setDateText] = useState(todayJalali());
  const [date, setDate] = useState(todayJalali());
  const [report, setReport] = useState<DprTablesReport | null>(null);
  const [history, setHistory] = useState<DprHistory>({ changes: {}, activities: {} });
  const [summaries, setSummaries] = useState<DprReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [localOnly, setLocalOnly] = useState(false);
  const [filter, setFilter] = useState("");
  const [changeFilter, setChangeFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [materialCatalog, setMaterialCatalog] = useState<Array<[string, string]>>([...MATERIAL_CATALOG]);
  const [newMaterialCode, setNewMaterialCode] = useState("");
  const [newMaterialDesc, setNewMaterialDesc] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // جدول‌های روزانه در وضعیت پیش‌نویس برای ورود و محاسبهٔ محلی قابل ویرایش‌اند؛
  // مجوز همچنان فقط ذخیره/ارسال را کنترل می‌کند.
  const locked = !report || report.status !== "draft";
  const canPersist = canEdit;
  const resetKey = `${projectCode}:${date}:${report?.updatedAt ?? "new"}`;
  const draftKey = `dpr-tables-draft:${projectCode}:${date}`;

  const manGroups = useMemo(() => groupOrder(DPR_MANPOWER), []);
  const macGroups = useMemo(() => groupOrder(DPR_MACHINERY), []);
  const manTotals = useMemo(() => manpowerTotals(report?.manpower ?? {}), [report?.manpower]);
  const macTotals = useMemo(() => machineryTotals(report?.machinery ?? {}), [report?.machinery]);
  const owners = useMemo(() => {
    const s = new Set<string>();
    for (const e of Object.values(report?.machinery ?? {})) {
      if (e?.owner?.trim()) s.add(e.owner.trim());
    }
    return [...s];
  }, [report?.machinery]);
  const knownChangeIds = useMemo(() => Object.keys(history.changes), [history]);
  const monthInfo = useMemo(() => {
    const p = splitReportDate(date);
    return p ? { label: `${jalaliMonthNameFa(p.month)} ${p.year}`, month: p.month, year: p.year } : null;
  }, [date]);

  useEffect(() => {
    if (!projectCode) return;
    listDprReports(projectCode).then(setSummaries).catch(() => {});
  }, [projectCode]);

  useEffect(() => {
    if (!projectCode || !splitReportDate(date)) return;
    setLoading(true);
    setError("");
    getDprReport(projectCode, date)
      .then((payload) => {
        setHistory(payload.history);
        if (payload.exists) {
          setReport(normalizeReport(payload.report));
          setLocalOnly(false);
          try {
            localStorage.removeItem(draftKey);
          } catch { /* ignore */ }
        } else {
          let draft: DprTablesReport | null = null;
          try {
            const raw = localStorage.getItem(draftKey);
            if (raw) draft = JSON.parse(raw) as DprTablesReport;
          } catch { /* ignore */ }
          if (draft && draft.reportDate === date) {
            setReport(normalizeReport(draft));
            setLocalOnly(true);
          } else {
            const shell = emptyReport(projectCode, date, payload.suggestedNo);
            setReport(shell);
            setLocalOnly(false);
          }
        }
      })
      .catch((e) => {
        let draft: DprTablesReport | null = null;
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) draft = JSON.parse(raw) as DprTablesReport;
        } catch { /* ignore */ }
        if (draft && draft.reportDate === date) {
          setReport(normalizeReport(draft));
          setHistory({ changes: {}, activities: {} });
          setLocalOnly(true);
          setError("");
        } else {
          setReport(emptyReport(projectCode, date, ""));
          setError(e instanceof Error ? e.message : "خطا");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, date]);

  /* سربرگ گزارش روزانه آینهٔ همین هویت و وضعیت عمومی است (تک‌منبعی). */
  useEffect(() => {
    onIdentity?.({ reportNo: report?.reportNo ?? "", reportDate: date });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.reportNo, date]);
  useEffect(() => {
    onGeneralStatus?.({
      siteStatus: report?.site.siteStatus ?? "",
      weather: report?.site.weather ?? "",
      avgTemp: report?.site.avgTemp ?? null,
      humidity: report?.site.humidity ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.site.siteStatus, report?.site.weather, report?.site.avgTemp, report?.site.humidity]);

  if (!projectCode) {
    return (
      <section className="glass-dark rounded-2xl p-4" dir={rtl ? "rtl" : "ltr"}>
        <p className="text-[11px] tx3">{rtl ? "برای ثبت جداول پشتیبان، ابتدا یک پروژه انتخاب کنید." : "Select a project first."}</p>
      </section>
    );
  }

  const commitDate = () => {
    const t = faDigits(dateText).trim();
    if (splitReportDate(t)) {
      setDate(t);
      setError("");
    } else {
      setError(rtl ? "تاریخ باید شمسی YYYY/MM/DD باشد (مثل 1403/08/26)" : "Date must be YYYY/MM/DD");
    }
  };

  const patch = (fn: (r: DprTablesReport) => DprTablesReport) => setReport((r) => (r ? fn(r) : r));

  const save = async () => {
    if (!report || locked || !canPersist) return;
    setSaving(true);
    setError("");
    const payload: DprTablesReport = {
      ...report,
      reportNo: report.reportNo.trim(),
      site: { ...report.site, reportDate: date, reportNo: report.reportNo.trim() },
    };
    try {
      const res = await saveDprReport(projectCode, date, payload);
      setReport(res.report);
      setHistory(res.history);
      setLocalOnly(false);
      try {
        localStorage.removeItem(draftKey);
      } catch { /* ignore */ }
      listDprReports(projectCode).then(setSummaries).catch(() => {});
    } catch (e) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch { /* ignore */ }
      setLocalOnly(true);
      setError(e instanceof DprTablesError ? e.message : rtl ? "سرور در دسترس نیست — پیش‌نویس محلی ذخیره شد" : "Server unreachable — local draft saved");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: "submit" | "approve" | "return") => {
    if (!report || !canEdit) return;
    setActing(true);
    setError("");
    try {
      const res = await dprReportAction(projectCode, date, action);
      patch((r) => ({ ...r, status: res.status }));
      listDprReports(projectCode).then(setSummaries).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setActing(false);
    }
  };

  const setMan = (code: string, k: "pd" | "ad" | "pn" | "an", v: number | null) => {
    patch((r) => {
      const next = { ...r.manpower };
      const cur = next[code] ?? { pd: 0, ad: 0, pn: 0, an: 0 };
      const e = { ...cur, [k]: v ?? 0 };
      if (!e.pd && !e.ad && !e.pn && !e.an) delete next[code];
      else next[code] = e;
      return { ...r, manpower: next };
    });
  };

  const setMac = (code: string, k: "active" | "ready" | "repair", v: number | null) => {
    patch((r) => {
      const next = { ...r.machinery };
      const cur = next[code] ?? { active: 0, ready: 0, repair: 0, owner: "" };
      const e = { ...cur, [k]: v ?? 0 };
      if (!e.active && !e.ready && !e.repair && !e.owner.trim()) delete next[code];
      else next[code] = e;
      return { ...r, machinery: next };
    });
  };

  const setMacOwner = (code: string, v: string) => {
    patch((r) => {
      const next = { ...r.machinery };
      const cur = next[code] ?? { active: 0, ready: 0, repair: 0, owner: "" };
      const e = { ...cur, owner: v.slice(0, 120) };
      if (!e.active && !e.ready && !e.repair && !e.owner.trim()) delete next[code];
      else next[code] = e;
      return { ...r, machinery: next };
    });
  };

  const patchChange = (i: number, fn: (c: DprChangeRow) => DprChangeRow) => {
    patch((r) => ({ ...r, changes: r.changes.map((c, j) => (j === i ? fn(c) : c)) }));
  };

  const patchActivity = (i: number, fn: (a: DprMainActivityRow) => DprMainActivityRow) => {
    patch((r) => ({ ...r, activities: r.activities.map((a, j) => (j === i ? fn(a) : a)) }));
  };

  const patchMaterial = (i: number, fn: (m: DprMaterialRow) => DprMaterialRow) => {
    patch((r) => ({ ...r, materials: r.materials.map((m, j) => (j === i ? fn(m) : m)) }));
  };

  const matchFilter = (title: string, code: string) => {
    const f = filter.trim().toLowerCase();
    if (!f) return true;
    return title.toLowerCase().includes(f) || code.toLowerCase().includes(f);
  };

  const statusChip = (st: DprReportStatus) => (
    <span className="rounded px-2 py-0.5 text-[8.5px]" style={{ background: `${STATUS_COLOR[st]}22`, color: STATUS_COLOR[st] }}>
      {rtl ? STATUS_FA[st] : st}
    </span>
  );

  const toggleGroup = (key: string) => setOpenGroups((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  return (
    <section id="dpr-support-tables" className="glass-dark scroll-mt-4 space-y-3 rounded-2xl p-3" dir={rtl ? "rtl" : "ltr"}>
      <div>
        <h3 className="text-sm font-semibold tx1">{rtl ? "پشتیبان گزارش روزانه" : "Daily report support"}</h3>
        <p className="mt-1 text-[10px] tx3">
          {rtl
            ? "وضعیت کارگاه، شرح تشریحی، نیروی انسانی، ماشین‌آلات، متریال وارده، تغییرات و فعالیت‌های اصلی — با کلید مشترک تاریخ و شماره گزارش."
            : "Site status, narrative, manpower, machinery, materials, changes and main activities — keyed by date and report number."}
        </p>
      </div>

      {/* ── نوار گزارش ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border b-line-soft bg-black/10 p-2 text-[10px]">
        <span className="tx3">{rtl ? "تاریخ" : "Date"}</span>
        <input
          value={dateText}
          dir="ltr"
          onChange={(e) => setDateText(e.target.value)}
          onBlur={commitDate}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitDate();
          }}
          placeholder="1403/08/26"
          className="w-28 rounded-lg border b-line-soft bg-black/20 px-2 py-1 text-center tabular-nums tx1 outline-none focus:border-[var(--accent)]"
        />
        <button onClick={() => { const t = todayJalali(); setDateText(t); if (splitReportDate(t)) setDate(t); }} className="rounded-lg border b-line-soft px-2 py-1 tx2">
          {rtl ? "امروز" : "Today"}
        </button>
        <span className="tx3">{rtl ? "شماره گزارش" : "Report no"}</span>
        <input
          value={report?.reportNo ?? ""}
          dir="ltr"
          disabled={locked}
          onChange={(e) => patch((r) => ({ ...r, reportNo: e.target.value })) }
          placeholder="DRT-…"
          className="w-44 rounded-lg border b-line-soft bg-black/20 px-2 py-1 font-mono tx1 outline-none focus:border-[var(--accent)] disabled:opacity-50"
        />
        {monthInfo && <span className="tx3">{monthInfo.label}</span>}
        {report && statusChip(report.status)}
        {summaries.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                setDateText(e.target.value);
                setDate(e.target.value);
              }
            }}
            className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1"
            style={{ colorScheme: "dark" }}
          >
            <option value="">{rtl ? "گزارش‌های قبلی…" : "Previous…"}</option>
            {summaries.map((s) => (
              <option key={s.date} value={s.date} dir="ltr">
                {s.date} · {s.reportNo} · {rtl ? STATUS_FA[s.status] : s.status}
              </option>
            ))}
          </select>
        )}
        <span className="ms-auto flex items-center gap-1.5">
          {report?.status === "draft" && (
            <button onClick={() => void save()} disabled={locked || !canPersist || saving || loading} className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200 disabled:opacity-40">
              💾 {saving ? "…" : rtl ? "ذخیره" : "Save"}
            </button>
          )}
          {report?.status === "draft" && canEdit && (
            <button onClick={() => void runAction("submit")} disabled={acting || loading} className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-sky-200 disabled:opacity-40">
              {rtl ? "ارسال برای تأیید" : "Submit"}
            </button>
          )}
          {report?.status === "submitted" && canEdit && (
            <>
              <button onClick={() => void runAction("approve")} disabled={acting} className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200 disabled:opacity-40">
                {rtl ? "تأیید" : "Approve"}
              </button>
              <button onClick={() => void runAction("return")} disabled={acting} className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-amber-200 disabled:opacity-40">
                {rtl ? "برگشت به پیش‌نویس" : "Return"}
              </button>
            </>
          )}
        </span>
      </div>

      {localOnly && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-2.5 text-[10px] text-amber-200">
          {rtl ? "سرور در دسترس نیست — این گزارش فعلاً فقط در همین مرورگر ذخیره شده است." : "Server unreachable — this report is stored in this browser only."}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-2.5 text-[10px] text-rose-200">{error}</div>
      )}
      {report && report.status !== "draft" && (
        <div className="rounded-xl border b-line-soft bg-black/10 p-2.5 text-[10px] tx3">
          {rtl ? "این گزارش قفل است؛ برای ویرایش ابتدا آن را به پیش‌نویس برگردانید." : "This report is locked; return it to draft to edit."}
        </div>
      )}

      {/* ── تب‌ها ── */}
      <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-[10.5px] transition ${tab === t.id ? "toggle-on tx1" : "tx3 hover:tx1"}`}
          >
            {rtl ? t.fa : t.en}
          </button>
        ))}
        {loading && <span className="ms-auto text-[9px] tx4">{rtl ? "در حال بارگذاری…" : "Loading…"}</span>}
      </nav>

      {/* ═══ تب ۱: وضعیت کارگاه ═══ */}
      {tab === "site" && report && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "وضعیت کارگاه" : "Site status"}</span>
            <select
              value={report.site.siteStatus}
              disabled={locked}
              onChange={(e) => patch((r) => ({ ...r, site: { ...r.site, siteStatus: e.target.value as DprTablesReport["site"]["siteStatus"] } }))}
              className="rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] tx1 outline-none disabled:opacity-50"
              style={{ colorScheme: "dark" }}
              dir="ltr"
            >
              <option value="">—</option>
              {DPR_SITE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "وضعیت هوا" : "Weather"}</span>
            <select
              value={report.site.weather}
              disabled={locked}
              onChange={(e) => patch((r) => ({ ...r, site: { ...r.site, weather: e.target.value } }))}
              className="rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] tx1 outline-none disabled:opacity-50"
              style={{ colorScheme: "dark" }}
              dir="ltr"
            >
              <option value="">—</option>
              {DPR_WEATHERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "میانگین رطوبت (٪)" : "Avg humidity (%)"}</span>
            <div dir="ltr">
              <CellNum wide value={report.site.humidity} disabled={locked} resetKey={resetKey} onCommit={(v) => patch((r) => ({ ...r, site: { ...r.site, humidity: v } }))} />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "میانگین دما" : "Avg temp"}</span>
            <div dir="ltr">
              <CellNum wide value={report.site.avgTemp} disabled={locked} resetKey={resetKey} onCommit={(v) => patch((r) => ({ ...r, site: { ...r.site, avgTemp: v } }))} />
            </div>
          </label>
          <p className="text-[9px] tx4 sm:col-span-2 lg:col-span-4">
            {rtl ? "ماه و سال از روی تاریخ گزارش می‌آیند و سربرگ گزارش همین مقادیر را نمایش می‌دهد." : "Month/year derive from the report date; the cover mirrors these values."}
          </p>
        </div>
      )}

      {/* ═══ تب ۲: شرح تشریحی ═══ */}
      {tab === "narrative" && report && (
        <div className="grid grid-cols-1 gap-2.5">
          {([
            ["siteActivities", rtl ? "فعالیت‌های سایت (Site Activities)" : "Site Activities"],
            ["workFront", rtl ? "جبهه کاری (Work Front)" : "Work Front"],
            ["areaOfConcerns", rtl ? "نگرانی‌ها (Area of concerns)" : "Area of concerns"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-[9px] font-extralight tx3">{label}</span>
              <textarea
                value={report.narrative[key]}
                disabled={locked}
                rows={4}
                onChange={(e) => patch((r) => ({ ...r, narrative: { ...r.narrative, [key]: e.target.value.slice(0, 4000) } }))}
                className="w-full rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] leading-5 tx1 outline-none focus:border-[var(--accent)] disabled:opacity-50"
              />
            </label>
          ))}
        </div>
      )}

      {/* ═══ تب ۳: نیروی انسانی ═══ */}
      {tab === "manpower" && report && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={rtl ? "جست‌وجوی شغل یا کد…" : "Search…"}
              className="w-52 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 outline-none placeholder:text-[9px] focus:border-[var(--accent)]"
            />
            <label className="flex items-center gap-1.5 tx3">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
              {rtl ? "فقط پرشده‌ها" : "Non-empty only"}
            </label>
            <span className="ms-auto tx4">{rtl ? `${DPR_MANPOWER.length} ردیف ثابت` : `${DPR_MANPOWER.length} fixed rows`}</span>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-xl border b-line-soft">
            <table className="w-full border-separate border-spacing-0 text-[10px]">
              <thead className="sticky top-0 z-10 bg-[var(--bg-c)] tx1">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>{rtl ? "کد" : "Code"}</th>
                  <th className={th}>{rtl ? "مستقیم / غیرمستقیم" : "Direct / Indirect"}</th>
                  <th className={th}>{rtl ? "شغل" : "Craft"}</th>
                  <th className={th}>{rtl ? "حاضر روز" : "Present (day)"}</th>
                  <th className={th}>{rtl ? "غایب روز" : "Absent (day)"}</th>
                  <th className={th}>{rtl ? "حاضر شب" : "Present (night)"}</th>
                  <th className={th}>{rtl ? "غایب شب" : "Absent (night)"}</th>
                  <th className={th}>{rtl ? "جمع روز" : "Day total"}</th>
                  <th className={th}>{rtl ? "جمع شب" : "Night total"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {manGroups.map((g) => {
                  const rows = DPR_MANPOWER.filter((m) => m.group === g && matchFilter(m.title, m.code)).filter((m) => {
                    if (!hideEmpty) return true;
                    const t = manTotals.rows[m.code];
                    return (t?.total ?? 0) > 0;
                  });
                  if (!rows.length) return null;
                  const open = openGroups[`man:${g}`] ?? true;
                  const sub = manTotals.byGroup[g] ?? { pd: 0, ad: 0, pn: 0, an: 0, total: 0 };
                  return (
                    <Fragment key={g}>
                      <tr className="bg-black/15">
                        <td colSpan={10} className="px-2 py-1.5">
                          <button onClick={() => toggleGroup(`man:${g}`)} className="flex w-full items-center gap-2 text-[10px] font-medium tx1">
                            <span className="tx3">{open ? "▾" : "▸"}</span>
                            <span dir="ltr">{rtl ? DPR_MANPOWER_GROUPS[g]?.fa : DPR_MANPOWER_GROUPS[g]?.en}</span>
                            <span className="ms-auto font-normal tabular-nums tx3" dir="ltr">
                              {sub.pd + sub.ad + sub.pn + sub.an > 0 ? `${sub.total}` : "—"}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {open &&
                        rows.map((m, i) => {
                          const e = report.manpower[m.code];
                          const t = manTotals.rows[m.code];
                          return (
                            <tr key={m.code} className="bg-[var(--bg-b)]">
                              <td className={`${td} tx4 tabular-nums`} dir="ltr">{i + 1}</td>
                              <td className={`${td} font-mono text-[8.5px] tx4`} dir="ltr">{m.code}</td>
                              <td className={`${td} whitespace-nowrap text-[9px] tx3`}>{m.kind === "direct" ? (rtl ? "مستقیم" : "Direct") : (rtl ? "غیرمستقیم" : "Indirect")}</td>
                              <td className={tdL}>
                                <span className="tx1" dir="ltr">{m.title}</span>
                              </td>
                              <td className={td}><CellNum value={e?.pd ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMan(m.code, "pd", v)} /></td>
                              <td className={td}><CellNum value={e?.ad ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMan(m.code, "ad", v)} /></td>
                              <td className={td}><CellNum value={e?.pn ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMan(m.code, "pn", v)} /></td>
                              <td className={td}><CellNum value={e?.an ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMan(m.code, "an", v)} /></td>
                              <td className={`${td} ${calc}`} dir="ltr">{t.day}</td>
                              <td className={`${td} ${calc}`} dir="ltr">{t.night}</td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[var(--bg-c)] tx1">
                <tr className="border-t b-line-soft text-[10px] font-semibold">
                  <td className="px-2 py-2 text-start">{rtl ? "جمع کل" : "Total"}</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.pd}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.ad}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.pn}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.an}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.pd + manTotals.grand.ad}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{manTotals.grand.pn + manTotals.grand.an}</td>
                </tr>
                <tr className="text-[9px] font-normal tx3">
                  <td className="px-2 py-1 text-start">{rtl ? "مستقیم / غیرمستقیم" : "Direct / indirect"}</td>
                  <td colSpan={6} className="px-2 py-1 text-center tabular-nums" dir="ltr">
                    {manTotals.direct.total} / {manTotals.indirect.total}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[9px] tx4">{rtl ? "خانهٔ خالی صفر حساب می‌شود؛ جمع‌ها لحظه‌ای‌اند." : "Empty cells count as zero; totals update live."}</p>
        </div>
      )}

      {/* ═══ تب ۴: ماشین‌آلات ═══ */}
      {tab === "machinery" && report && (
        <div className="space-y-2">
          <datalist id="dpr-owners">
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={rtl ? "جست‌وجوی دستگاه یا کد…" : "Search…"}
              className="w-52 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 outline-none placeholder:text-[9px] focus:border-[var(--accent)]"
            />
            <label className="flex items-center gap-1.5 tx3">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
              {rtl ? "فقط پرشده‌ها" : "Non-empty only"}
            </label>
            <span className="ms-auto tx4">{rtl ? `${DPR_MACHINERY.length} قلم ثابت` : `${DPR_MACHINERY.length} fixed items`}</span>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-xl border b-line-soft">
            <table className="w-full border-separate border-spacing-0 text-[10px]">
              <thead className="sticky top-0 z-10 bg-[var(--bg-c)] tx1">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>{rtl ? "کد" : "Code"}</th>
                  <th className={th}>{rtl ? "دستگاه" : "Machine"}</th>
                  <th className={th}>{rtl ? "فعال" : "Active"}</th>
                  <th className={th}>{rtl ? "آماده" : "Ready"}</th>
                  <th className={th}>{rtl ? "تعمیر" : "Repair"}</th>
                  <th className={th}>{rtl ? "مالکیت" : "Owner"}</th>
                  <th className={th}>{rtl ? "جمع" : "Total"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {macGroups.map((g) => {
                  const rows = DPR_MACHINERY.filter((m) => m.group === g && matchFilter(m.title, m.code)).filter((m) => {
                    if (!hideEmpty) return true;
                    return (macTotals.rows[m.code] ?? 0) > 0 || Boolean(report.machinery[m.code]?.owner?.trim());
                  });
                  if (!rows.length) return null;
                  const open = openGroups[`mac:${g}`] ?? true;
                  const sub = macTotals.byGroup[g] ?? { active: 0, ready: 0, repair: 0, total: 0 };
                  return (
                    <Fragment key={g}>
                      <tr className="bg-black/15">
                        <td colSpan={8} className="px-2 py-1.5">
                          <button onClick={() => toggleGroup(`mac:${g}`)} className="flex w-full items-center gap-2 text-[10px] font-medium tx1">
                            <span className="tx3">{open ? "▾" : "▸"}</span>
                            <span dir="ltr">{rtl ? DPR_MACHINERY_GROUPS[g]?.fa : DPR_MACHINERY_GROUPS[g]?.en}</span>
                            <span className="ms-auto font-normal tabular-nums tx3" dir="ltr">{sub.total > 0 ? sub.total : "—"}</span>
                          </button>
                        </td>
                      </tr>
                      {open &&
                        rows.map((m, i) => {
                          const e = report.machinery[m.code];
                          return (
                            <tr key={m.code} className="bg-[var(--bg-b)]">
                              <td className={`${td} tx4 tabular-nums`} dir="ltr">{i + 1}</td>
                              <td className={`${td} font-mono text-[8.5px] tx4`} dir="ltr">{m.code}</td>
                              <td className={tdL}>
                                <span className="tx1" dir="ltr">{m.title}</span>
                              </td>
                              <td className={td}><CellNum value={e?.active ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMac(m.code, "active", v)} /></td>
                              <td className={td}><CellNum value={e?.ready ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMac(m.code, "ready", v)} /></td>
                              <td className={td}><CellNum value={e?.repair ?? null} disabled={locked} resetKey={resetKey} onCommit={(v) => setMac(m.code, "repair", v)} /></td>
                              <td className={td}>
                                <CellText value={e?.owner ?? ""} disabled={locked} resetKey={resetKey} listId="dpr-owners" align="center" onCommit={(v) => setMacOwner(m.code, v)} />
                              </td>
                              <td className={`${td} ${calc}`} dir="ltr">{macTotals.rows[m.code] ?? 0}</td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[var(--bg-c)] tx1">
                <tr className="border-t b-line-soft text-[10px] font-semibold">
                  <td className="px-2 py-2 text-start">{rtl ? "جمع کل" : "Total"}</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{macTotals.active}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{macTotals.ready}</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{macTotals.repair}</td>
                  <td className="px-1 py-2 text-center tx4">—</td>
                  <td className="px-1 py-2 text-center tabular-nums" dir="ltr">{macTotals.grand}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[9px] tx4">{rtl ? "فعال/آماده/تعمیر تعداد دستگاه است؛ مالکیت متن کوتاه با حافظهٔ پیشنهاد." : "Active/ready/repair are unit counts; owner is short text with memory."}</p>
        </div>
      )}

      {/* ═══ تب ۵: متریال وارده به کارگاه ═══ */}
      {tab === "materials" && report && (
        <div className="space-y-2">
          <datalist id="dpr-material-codes">
            {materialCatalog.map(([code, desc]) => <option key={code} value={code}>{code} — {desc}</option>)}
          </datalist>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <label className="tx3">{rtl ? "کد کالای ثابت:" : "Fixed material code:"}</label>
            <select className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1" onChange={(e) => {
              const code = e.target.value; if (!code) return;
              const desc = materialCatalog.find(([c]) => c === code)?.[1] ?? "";
              patch((r) => ({ ...r, materials: [...r.materials, { group: "", itemCode: code, desc, truckNo: "", ticketNo: "", grade: "", unit: "", gross: null, tare: null, net: null, qtyVcn: null, tonnage: null, entryDate: date, entryTime: "", contractor: "", usage: "" }] })); e.currentTarget.value = "";
            }}>
              <option value="">{rtl ? "انتخاب کد برای افزودن ردیف…" : "Choose code to add a row…"}</option>
              {materialCatalog.map(([code, desc]) => <option key={code} value={code}>{code} — {desc}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <input value={newMaterialCode} onChange={(e) => setNewMaterialCode(e.target.value)} placeholder={rtl ? "کد جدید" : "New code"} className="w-24 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1" />
            <input value={newMaterialDesc} onChange={(e) => setNewMaterialDesc(e.target.value)} placeholder={rtl ? "شرح کد جدید" : "New description"} className="w-44 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1" />
            <button disabled={!newMaterialCode.trim() || !newMaterialDesc.trim()} onClick={() => { const code = newMaterialCode.trim(); const desc = newMaterialDesc.trim(); setMaterialCatalog((prev) => [...prev.filter(([c]) => c !== code), [code, desc]]); setNewMaterialCode(""); setNewMaterialDesc(""); }} className="rounded-lg border b-line-soft px-2 py-1 tx2 disabled:opacity-40">+ {rtl ? "افزودن کد" : "Add code"}</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <input value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} placeholder={rtl ? "فیلتر کد، شرح، گروه یا پیمانکار…" : "Filter code, description, group or contractor…"} className="w-72 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 outline-none focus:border-[var(--accent)]" />
            <span className="tx4">{report.materials.filter((m) => !materialFilter || [m.itemCode,m.desc,m.group,m.contractor,m.usage].join(" ").toLowerCase().includes(materialFilter.toLowerCase())).length} / {report.materials.length}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border b-line-soft">
            <table className="w-full min-w-max border-separate border-spacing-0 text-[10px]">
              <thead className="bg-[var(--bg-c)] tx1">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>{rtl ? "گروه" : "Group"}</th>
                  <th className={th}>{rtl ? "کد کالا" : "Item code"}</th>
                  <th className={th}>{rtl ? "شرح" : "Description"}</th>
                  <th className={th}>{rtl ? "شماره کامیون/تراک" : "Truck no."}</th>
                  <th className={th}>{rtl ? "قبض انبار/باسکول" : "Ticket no."}</th>
                  <th className={th}>{rtl ? "رده" : "Grade"}</th>
                  <th className={th}>{rtl ? "واحد" : "Unit"}</th>
                  <th className={th}>{rtl ? "پر" : "Gross"}</th>
                  <th className={th}>{rtl ? "خالی" : "Tare"}</th>
                  <th className={th}>{rtl ? "خالص" : "Net"}</th>
                  <th className={th}>{rtl ? "(حجم/تعداد/وزن)" : "(Vol/Cnt/Wt)"}</th>
                  <th className={th}>{rtl ? "تناز" : "Tonnage"}</th>
                  <th className={th}>{rtl ? "تاریخ ورود" : "Entry date"}</th>
                  <th className={th}>{rtl ? "ساعت ورود" : "Entry time"}</th>
                  <th className={th}>{rtl ? "پیمانکار/شخص" : "Contractor"}</th>
                  <th className={th}>{rtl ? "موقعیت مصرف" : "Usage"}</th>
                  <th className={th}>—</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {report.materials.map((m, originalIndex) => ({ m, originalIndex })).filter(({ m }) => !materialFilter || [m.itemCode,m.desc,m.group,m.contractor,m.usage].join(" ").toLowerCase().includes(materialFilter.toLowerCase())).map(({ m, originalIndex: i }) => (
                  <tr key={i} className="bg-[var(--bg-b)]">
                    <td className={`${td} tx4 tabular-nums`} dir="ltr">{i + 1}</td>
                    <td className={td}><CellText value={m.group} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, group: v }))} /></td>
                    <td className={td}><CellText value={m.itemCode} disabled={locked} resetKey={resetKey} listId="dpr-material-codes" align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, itemCode: v }))} /></td>
                    <td className={td}><CellText value={m.desc} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, desc: v }))} /></td>
                    <td className={td}><CellText value={m.truckNo} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, truckNo: v }))} /></td>
                    <td className={td}><CellText value={m.ticketNo} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, ticketNo: v }))} /></td>
                    <td className={td}><CellText value={m.grade} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, grade: v }))} /></td>
                    <td className={td}><CellText value={m.unit} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, unit: v }))} /></td>
                    <td className={td}><CellNum wide value={m.gross} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, gross: v }))} /></td>
                    <td className={td}><CellNum wide value={m.tare} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, tare: v }))} /></td>
                    <td className={td}><CellNum wide value={m.net} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, net: v }))} /></td>
                    <td className={td}><CellNum wide value={m.qtyVcn} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, qtyVcn: v }))} /></td>
                    <td className={td}><CellNum wide value={m.tonnage} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, tonnage: v }))} /></td>
                    <td className={td}><CellText value={m.entryDate} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, entryDate: v }))} /></td>
                    <td className={td}><CellText value={m.entryTime} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, entryTime: v }))} /></td>
                    <td className={td}><CellText value={m.contractor} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchMaterial(i, (x) => ({ ...x, contractor: v }))} /></td>
                    <td className={td}><CellText value={m.usage} disabled={locked} resetKey={resetKey} onCommit={(v) => patchMaterial(i, (x) => ({ ...x, usage: v }))} /></td>
                    <td className={td}>
                      <button disabled={locked} onClick={() => patch((r) => ({ ...r, materials: r.materials.filter((_, j) => j !== i) }))} className="px-1 text-rose-300 disabled:opacity-40">✕</button>
                    </td>
                  </tr>
                ))}
                {!report.materials.length && (
                  <tr className="bg-[var(--bg-b)]">
                    <td colSpan={18} className="px-2 py-3 text-center tx4">{rtl ? "ردیفی ثبت نشده — «+ ردیف»" : "No rows — press + row"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={locked}
              onClick={() =>
                patch((r) => ({
                  ...r,
                  materials: [...r.materials, { group: "", itemCode: "", desc: "", truckNo: "", ticketNo: "", grade: "", unit: "", gross: null, tare: null, net: null, qtyVcn: null, tonnage: null, entryDate: date, entryTime: "", contractor: "", usage: "" }],
                }))
              }
              className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2 disabled:opacity-40"
            >
              + {rtl ? "ردیف" : "Row"}
            </button>
            <p className="text-[9px] tx4">{rtl ? `تعداد ردیف: ${report.materials.length} · سرستون «(حجم/تعداد/وزن)» از روی عکس خوانده شد؛ اگر دقیق نیست اعلام کنید.` : `Rows: ${report.materials.length} · The "(Vol/Cnt/Wt)" header was read from the photo; report if inaccurate.`}</p>
          </div>
        </div>
      )}

      {/* ═══ تب ۶: تغییرات و فعالیت تشریحی ═══ */}
      {tab === "changes" && report && (
        <div className="space-y-2">
          <datalist id="dpr-change-ids">
            {knownChangeIds.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          <div className="overflow-x-auto rounded-xl border b-line-soft">
            <table className="w-full min-w-max border-separate border-spacing-0 text-[10px]">
              <thead className="bg-[var(--bg-c)] tx1">
                <tr>
                  <th className={th}>ID</th>
                  <th className={th}>Location</th>
                  <th className={th}>Unit</th>
                  <th className={th}>Discipline</th>
                  <th className={th}>Activity</th>
                  <th className={th}>{rtl ? "مقدار کل" : "Total"}</th>
                  <th className={th}>{rtl ? "این دوره" : "This period"}</th>
                  <th className={th}>{rtl ? "تجمعی" : "Cumulative"}</th>
                  <th className={th}>{rtl ? "باقیمانده" : "Remaining"}</th>
                  <th className={th}>{rtl ? "درصد" : "%"}</th>
                  <th className={th}>Contractor</th>
                  <th className={th}>{rtl ? "شرح عملیات" : "شرح عملیات"}</th>
                  <th className={th}>{rtl ? "توضیحات" : "توضیحات"}</th>
                  <th className={th}>—</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {report.changes.map((c, originalIndex) => ({ c, originalIndex })).filter(({ c }) => !changeFilter || [c.refId,c.location,c.unit,c.discipline,c.activity,c.contractor].join(" ").toLowerCase().includes(changeFilter.toLowerCase())).map(({ c, originalIndex: i }) => {
                  // اگر یک فعالیت در همان گزارش بیش از یک بار آمده باشد، هر ردیف ادامهٔ
                  // ردیف قبلی همان شناسه است؛ بنابراین تجمعی و درصد از صفر شروع نمی‌شود.
                  const ref = c.refId.trim();
                  const sameActivityToday = report.changes
                    .slice(0, i)
                    .filter((x) => x.refId.trim() === ref)
                    .reduce((sum, x) => sum + (Number(x.thisQty) || 0), 0);
                  const prev = (history.changes[ref] ?? 0) + sameActivityToday;
                  const calcR = changeCalc(c.totalQty, prev, c.thisQty);
                  return (
                    <tr key={i} className="bg-[var(--bg-b)]">
                      <td className={td}><CellText value={c.refId} disabled={locked} resetKey={resetKey} listId="dpr-change-ids" align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, refId: v }))} /></td>
                      <td className={td}><CellText value={c.location} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, location: v }))} /></td>
                      <td className={td}><CellText value={c.unit} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, unit: v }))} /></td>
                      <td className={td}><CellText value={c.discipline} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, discipline: v }))} /></td>
                      <td className={td}><CellText value={c.activity} disabled={locked} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, activity: v }))} /></td>
                      <td className={td}><CellNum wide value={c.totalQty} disabled={locked} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, totalQty: v }))} /></td>
                      <td className={td}><CellNum wide value={c.thisQty} disabled={locked} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, thisQty: v }))} /></td>
                      <td className={`${td} ${calc}`} dir="ltr" title={rtl ? `سابقه: ${fmtQty(prev)}` : `History: ${fmtQty(prev)}`}>{fmtQty(calcR.cum)}</td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtQty(calcR.remaining)}</td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtPct(calcR.pct)}</td>
                      <td className={td}><CellText value={c.contractor} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchChange(i, (x) => ({ ...x, contractor: v }))} /></td>
                      <td className={td}><CellText value={c.opsFa} disabled={locked} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, opsFa: v }))} /></td>
                      <td className={td}><CellText value={c.noteFa} disabled={locked} resetKey={resetKey} onCommit={(v) => patchChange(i, (x) => ({ ...x, noteFa: v }))} /></td>
                      <td className={td}>
                        <button disabled={locked} onClick={() => patch((r) => ({ ...r, changes: r.changes.filter((_, j) => j !== i) }))} className="px-1 text-rose-300 disabled:opacity-40">✕</button>
                      </td>
                    </tr>
                  );
                })}
                {!report.changes.length && (
                  <tr className="bg-[var(--bg-b)]">
                    <td colSpan={14} className="px-2 py-3 text-center tx4">{rtl ? "ردیفی ثبت نشده — «+ ردیف»" : "No rows — press + row"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={locked}
              onClick={() =>
                patch((r) => ({
                  ...r,
                  changes: [...r.changes, { date, refId: "", location: "", unit: "", discipline: "", activity: "", totalQty: null, thisQty: null, contractor: "", opsFa: "", noteFa: "" }],
                }))
              }
              className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2 disabled:opacity-40"
            >
              + {rtl ? "ردیف" : "Row"}
            </button>
            <p className="text-[9px] tx4">{rtl ? "تجمعی هر شناسه = جمع «این دوره» همان شناسه در گزارش‌های قبلی + امروز." : "Cumulative per ID = prior history + today."}</p>
          </div>
        </div>
      )}

      {/* ═══ تب ۷: فعالیت‌های اصلی ═══ */}
      {tab === "activities" && report && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <input value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} placeholder={rtl ? "فیلتر کد، فعالیت، فاز، ناحیه یا مجری…" : "Filter code, activity, phase, area or executor…"} className="w-72 rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 outline-none focus:border-[var(--accent)]" />
            <span className="tx4">{report.activities.filter((a) => !activityFilter || [a.acCode,a.activity,a.subPhase,a.dis,a.area,a.workPackage,a.subPackage,a.executor].join(" ").toLowerCase().includes(activityFilter.toLowerCase())).length} / {report.activities.length}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border b-line-soft">
            <table className="w-full min-w-max border-separate border-spacing-0 text-[10px]">
              <thead className="bg-[var(--bg-c)] tx1">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Ac.Code</th>
                  <th className={th}>{rtl ? "فعالیت" : "Activity"}</th>
                  <th className={th}>{rtl ? "واحد" : "Unit"}</th>
                  <th className={th}>{rtl ? "برآورد" : "Estimated"}</th>
                  <th className={th}>{rtl ? "دیروز" : "Last"}</th>
                  <th className={th}>{rtl ? "امروز" : "Today"}</th>
                  <th className={th}>{rtl ? "تجمعی" : "Cum"}</th>
                  <th className={th}>{rtl ? "باقیمانده" : "Rem"}</th>
                  <th className={th}>{rtl ? "٪دیروز" : "Last %"}</th>
                  <th className={th}>{rtl ? "٪امروز" : "Today %"}</th>
                  <th className={th}>{rtl ? "٪تجمعی" : "Cum %"}</th>
                  <th className={th}>Sub Phase</th>
                  <th className={th}>Dis</th>
                  <th className={th}>Area</th>
                  <th className={th}>Work Package</th>
                  <th className={th}>Sub Package</th>
                  <th className={th}>{rtl ? "شروع" : "Start"}</th>
                  <th className={th}>{rtl ? "پایان" : "End"}</th>
                  <th className={th}>{rtl ? "مجری" : "Executor"}</th>
                  <th className={th}>{rtl ? "توضیحات" : "Note"}</th>
                  <th className={th}>—</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {report.activities.map((a, originalIndex) => ({ a, originalIndex })).filter(({ a }) => !activityFilter || [a.acCode,a.activity,a.subPhase,a.dis,a.area,a.workPackage,a.subPackage,a.executor].join(" ").toLowerCase().includes(activityFilter.toLowerCase())).map(({ a, originalIndex: i }) => {
                  const last = history.activities[activityHistoryKey(a.acCode, a.activity)] ?? 0;
                  const calcR = activityCalc(a.estimated, last, a.todayQty);
                  return (
                    <tr key={i} className="bg-[var(--bg-b)]">
                      <td className={`${td} tx4 tabular-nums`} dir="ltr">{i + 1}</td>
                      <td className={td}><CellText value={a.acCode} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchActivity(i, (x) => ({ ...x, acCode: v }))} /></td>
                      <td className={td}><CellText value={a.activity} disabled={locked} resetKey={resetKey} onCommit={(v) => patchActivity(i, (x) => ({ ...x, activity: v }))} /></td>
                      <td className={td}><CellText value={a.unit} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchActivity(i, (x) => ({ ...x, unit: v }))} /></td>
                      <td className={td}><CellNum wide value={a.estimated} disabled={locked} resetKey={resetKey} onCommit={(v) => patchActivity(i, (x) => ({ ...x, estimated: v }))} /></td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtQty(calcR.lastCum)}</td>
                      <td className={td}><CellNum wide value={a.todayQty} disabled={locked} resetKey={resetKey} onCommit={(v) => patchActivity(i, (x) => ({ ...x, todayQty: v }))} /></td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtQty(calcR.cum)}</td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtQty(calcR.rem)}</td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtPct(calcR.lastPct)}</td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtPct(calcR.todayPct)}</td>
                      <td className={`${td} ${calc}`} dir="ltr">{fmtPct(calcR.cumPct)}</td>
                      <td className={td}><CellText value={a.subPhase} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchActivity(i, (x) => ({ ...x, subPhase: v }))} /></td>
                      <td className={td}><CellText value={a.dis} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchActivity(i, (x) => ({ ...x, dis: v }))} /></td>
                      <td className={td}><CellText value={a.area} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchActivity(i, (x) => ({ ...x, area: v }))} /></td>
                      <td className={td}><CellText value={a.workPackage} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchActivity(i, (x) => ({ ...x, workPackage: v }))} /></td>
                      <td className={td}><CellText value={a.subPackage} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchActivity(i, (x) => ({ ...x, subPackage: v }))} /></td>
                      <td className={td}><CellText value={a.startDate} disabled={locked} resetKey={resetKey} align="center" placeholder="1403/.." onCommit={(v) => patchActivity(i, (x) => ({ ...x, startDate: v }))} /></td>
                      <td className={td}><CellText value={a.endDate} disabled={locked} resetKey={resetKey} align="center" placeholder="1403/.." onCommit={(v) => patchActivity(i, (x) => ({ ...x, endDate: v }))} /></td>
                      <td className={td}><CellText value={a.executor} disabled={locked} resetKey={resetKey} align="center" onCommit={(v) => patchActivity(i, (x) => ({ ...x, executor: v }))} /></td>
                      <td className={td}><CellText value={a.note} disabled={locked} resetKey={resetKey} onCommit={(v) => patchActivity(i, (x) => ({ ...x, note: v }))} /></td>
                      <td className={td}>
                        <button disabled={locked} onClick={() => patch((r) => ({ ...r, activities: r.activities.filter((_, j) => j !== i) }))} className="px-1 text-rose-300 disabled:opacity-40">✕</button>
                      </td>
                    </tr>
                  );
                })}
                {!report.activities.length && (
                  <tr className="bg-[var(--bg-b)]">
                    <td colSpan={22} className="px-2 py-3 text-center tx4">{rtl ? "ردیفی ثبت نشده — «+ ردیف»" : "No rows — press + row"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={locked}
              onClick={() =>
                patch((r) => ({
                  ...r,
                  activities: [...r.activities, { acCode: "", subPhase: "", dis: "", area: "", workPackage: "", subPackage: "", activity: "", unit: "", estimated: null, todayQty: null, startDate: "", endDate: "", executor: "", note: "" }],
                }))
              }
              className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2 disabled:opacity-40"
            >
              + {rtl ? "ردیف" : "Row"}
            </button>
            <p className="text-[9px] tx4">
              {rtl
                ? `تاریخ/ماه/سال هر ردیف همان گزارش جاری است${monthInfo ? ` (${monthInfo.label})` : ""}؛ «دیروز» = تجمعی همان کد+فعالیت در آخرین گزارش قبلی.`
                : "Row date/month/year follow the current report; Last = prior cumulative of the same code+activity."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
