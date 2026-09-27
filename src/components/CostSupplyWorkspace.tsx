import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import { useAuth } from "../context/AuthContext";
import { DEMO_SUBJECTS, can as rbacCan } from "../services/accessControl";
import ContractsPanel from "./ContractsPanel";
import { FIN_FORMULA_VERSION, agingBucket, needsAutoCr, progressInvoice, varianceSeverity, type CurveType } from "../services/finance";
import { buildFinView, type FinView, type PrStatus } from "../services/finWorkspace";
import { FinClient, type FinResult, type FinWorkspacePayload } from "../services/finApi";
import QuantityBalancePanel from "./QuantityBalancePanel";
import ProfitLossPanel from "./ProfitLossPanel";

/* ═══════════════ میز کار هزینه، تأمین و لجستیک (d5) ═══════════════
 * LIVE-1: همهٔ داده‌ها از `/api/fin/:projectId` می‌آید و ماندگار است.
 * پیش از این آرایه‌های ثابت درون همین فایل بود و چند عدد کلیدی ساختگی
 * (EV = PV×0.92، بودجهٔ PR = بودجه − AC×0.2، DIO=۳۴، تأخیر PO=۱۱).
 * محاسبه در `services/finWorkspace.ts` است (مشترک با سرور)؛ این فایل
 * فقط نمایش و فرم است. کنترل‌ها (مجوز، بودجه، تفکیک وظیفه، دروازهٔ
 * پرداخت) سمت سرور اجرا می‌شود؛ پنهان کردن دکمه فقط برای راحتی است. */

/* نه تب = نه زیرماژول d5؛ نام‌ها تغییرناپذیرند (BC). */
export type FinTab = "cost" | "control" | "cash" | "pr" | "po" | "inventory" | "quantities" | "balance" | "pnl";

const TABS: { id: FinTab; fa: string; en: string; icon: string; proc: string }[] = [
  { id: "cost", fa: "مدیریت هزینه", en: "Cost Management", icon: "💰", proc: "d5-p1" },
  { id: "control", fa: "کنترل هزینه", en: "Cost Control", icon: "📊", proc: "d5-p2" },
  { id: "cash", fa: "جریان نقدی", en: "Cash Flow", icon: "💵", proc: "d5-p3" },
  { id: "pr", fa: "درخواست خرید", en: "Purchase Request", icon: "📝", proc: "d5-p4" },
  { id: "po", fa: "سفارش خرید", en: "Purchase Order", icon: "📦", proc: "d5-p5" },
  { id: "inventory", fa: "مدیریت کالا و انبار", en: "Material & Warehouse", icon: "🏗", proc: "d5-p6" },
  { id: "quantities", fa: "احجام و مقادیر فیزیکی", en: "Quantities", icon: "📐", proc: "d5-p7" },
  { id: "balance", fa: "بالانس مصالح", en: "Material Balance", icon: "⚖️", proc: "d5-p8" },
  { id: "pnl", fa: "سود و زیان پروژه", en: "Project P&L", icon: "📈", proc: "d5-p9" },
];

/** پروژهٔ جاری؛ همان شناسهٔ دامنهٔ RBAC. */
const PROJECT_ID = "c1-p1";

const PR_STATUS: Record<PrStatus, { fa: string; en: string; cls: string }> = {
  draft: { fa: "پیش‌نویس", en: "draft", cls: "border b-line-soft tx3" },
  submitted: { fa: "در انتظار تأیید", en: "submitted", cls: "bg-sky-400/15 text-sky-200" },
  approved: { fa: "تأییدشده", en: "approved", cls: "bg-emerald-400/15 text-emerald-300" },
  rejected: { fa: "ردشده", en: "rejected", cls: "bg-rose-400/15 text-rose-300" },
  converted: { fa: "تبدیل به PO", en: "converted", cls: "bg-violet-400/15 text-violet-200" },
  cancelled: { fa: "لغوشده", en: "cancelled", cls: "border b-line-soft tx4" },
};

const PO_STATUS: Record<string, { fa: string; en: string }> = {
  draft: { fa: "پیش‌نویس", en: "draft" },
  issued: { fa: "صادرشده", en: "issued" },
  acknowledged: { fa: "تأیید فروشنده", en: "acknowledged" },
  partially_received: { fa: "رسید جزئی", en: "partial" },
  received: { fa: "رسید کامل", en: "received" },
  closed: { fa: "بسته", en: "closed" },
  cancelled: { fa: "لغوشده", en: "cancelled" },
};

/* ─────────────── اجزای کوچک ─────────────── */

function Kpi({ label, value, hint, tone = "tx1" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
      <div className="text-[8.5px] font-extralight tx3">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums ${tone}`} dir="ltr">{value}</div>
      {hint && <div className="text-[8px] font-extralight tx4">{hint}</div>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h4 className="text-[11px] font-semibold tx1">{title}</h4>
        {note && <span className="text-[8.5px] font-extralight tx3">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Bars({ values, colors }: { values: number[]; colors?: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-20 items-end gap-1">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(3, (v / max) * 100)}%`, background: colors?.[i] ?? "rgba(56,189,248,0.55)" }} title={String(Math.round(v))} />
      ))}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-2 py-1 text-start font-normal">{children}</th>;
}

const inputCls = "rounded-lg border b-line-soft bg-black/20 px-2 py-1 text-[9.5px] tx1 placeholder:text-[9px] placeholder:tx4";
const btnCls = "rounded-lg border px-2.5 py-1 text-[9.5px] transition disabled:opacity-40";
const btnPrimary = `${btnCls} border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20`;
const btnOk = `${btnCls} border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`;
const btnWarn = `${btnCls} border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20`;

const fmtB = (n: number | null | undefined, rtl: boolean) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : `${(n / 1_000_000_000).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}${rtl ? " میلیارد" : "B"}`;
const pct = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(1)}%`);
const days = (n: number | null, rtl: boolean) => (n === null ? "—" : `${n.toFixed(0)} ${rtl ? "روز" : "d"}`);
const qty = (n: number | null | undefined) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 }));
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

/** فرم کوچک با وضعیت محلی؛ بعد از ثبت موفق خالی می‌شود. */
function useForm<T extends Record<string, string | boolean>>(init: T) {
  const [v, setV] = useState<T>(init);
  const set = (k: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  return { v, set, reset: () => setV(init), setV };
}

/* ══════════════════════════ کامپوننت اصلی ══════════════════════════ */

export default function CostSupplyWorkspace({
  lang,
  initialTab = "cost",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: FinTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const client = useMemo(() => new FinClient(PROJECT_ID, userId), [userId]);
  const subject = useMemo(() => DEMO_SUBJECTS.find((s) => s.id === userId) ?? null, [userId]);
  const perm = useMemo(
    () => ({
      post: rbacCan(subject, "fin.cost.post"),
      budget: rbacCan(subject, "fin.budget.edit"),
      procure: rbacCan(subject, "fin.procure.edit"),
      approve: rbacCan(subject, "fin.procure.approve"),
      reserve: rbacCan(subject, "fin.reserve.draw"),
    }),
    [subject],
  );

  const [tab, setTab] = useState<FinTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const [ws, setWs] = useState<FinWorkspacePayload | null>(null);
  const [loadErr, setLoadErr] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await client.workspace();
    if (r.ok) {
      setWs(r.data);
      setLoadErr(null);
    } else {
      setWs(null);
      setLoadErr({ status: r.status, message: r.message });
    }
    setLoading(false);
  }, [client]);
  useEffect(() => {
    void reload();
  }, [reload]);

  /** اجرای یک اقدام نوشتنی: پیام سرور نمایش داده می‌شود و داده دوباره خوانده می‌شود. */
  const act = async (fn: () => Promise<FinResult<unknown>>, okText: string, auditCode?: string): Promise<boolean> => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      setMsg({ tone: "ok", text: okText });
      if (auditCode) logAudit(auditCode, "Cost", okText);
      await reload();
      return true;
    }
    setMsg({ tone: "err", text: r.message });
    return false;
  };

  const view = useMemo(() => (ws ? buildFinView(ws) : null), [ws]);

  /* ─────────── وضعیت‌های بدون داده ─────────── */
  const header = (v: FinView | null) => (
    <section className="glass-dark shrink-0 rounded-2xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-[15px]">💰</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12px] font-semibold tx1">{rtl ? "مدیریت هزینه، تأمین و لجستیک" : "Cost, Supply & Logistics"}</h3>
          <p className="text-[8.5px] font-extralight tx3">
            {rtl
              ? "تعهد پیش از هزینه · Snapshot تغییرناپذیر · تطابق سه‌جانبه پیش از پرداخت · چندارزی بومی"
              : "Commitment first · immutable snapshots · 3-way match before payment · multi-currency native"}
          </p>
        </div>
        {v && !v.empty && (
          <>
            <span className="rounded-lg bg-amber-400/15 px-2 py-1 text-[10px] font-semibold tabular-nums text-amber-200" dir="ltr">BAC {fmtB(v.bac, rtl)}</span>
            <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums ${!v.evKnown ? "border b-line-soft tx3" : (v.evm.cpi ?? 1) < 1 ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/15 text-emerald-300"}`} dir="ltr">
              CPI {v.evKnown ? v.evm.cpi?.toFixed(3) ?? "—" : "—"}
            </span>
            <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums ${!v.evKnown ? "border b-line-soft tx3" : v.evm.spi < 1 ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/15 text-emerald-300"}`} dir="ltr">
              SPI {v.evKnown ? v.evm.spi.toFixed(3) : "—"}
            </span>
          </>
        )}
        {v && (
          <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[9px] tx3" dir="ltr">
            {FIN_FORMULA_VERSION} · {v.settings.DataDate} · P{v.period}/{v.settings.PeriodCount}
          </span>
        )}
        {ws && (
          <button onClick={() => setShowSettings((s) => !s)} className={`${btnCls} border-transparent tx3 hover:tx1 ${showSettings ? "toggle-on" : ""}`} title={rtl ? "تنظیمات مالی پروژه" : "Finance settings"}>
            ⚙ {rtl ? "تنظیمات" : "Settings"}
          </button>
        )}
        <span className={`rounded-lg px-2 py-1 text-[8.5px] ${loadErr ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
          {loading ? (rtl ? "در حال بارگذاری…" : "loading…") : loadErr ? (rtl ? "قطع از سرور" : "offline") : rtl ? "دادهٔ زنده · سرور" : "live · server"}
        </span>
      </div>
      {v && v.alerts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {v.alerts.map((a) => (
            <span key={a.code} className={`rounded-lg px-2 py-0.5 text-[8.5px] ${a.severity === "critical" ? "bg-rose-400/15 text-rose-300" : a.severity === "high" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>
              <span dir="ltr">{a.code}</span> · {a.message}
            </span>
          ))}
        </div>
      )}
      {msg && (
        <div className={`mt-2 flex items-center gap-2 rounded-lg px-2 py-1 text-[9.5px] ${msg.tone === "ok" ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)} className="tx3 hover:tx1" aria-label="close">✕</button>
        </div>
      )}
    </section>
  );

  const tabsNav = !hideTabs && (
    <nav className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
      {TABS.map((it) => (
        <button
          key={it.id}
          onClick={() => setTab(it.id)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition ${tab === it.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
          title={it.proc}
        >
          <span>{it.icon}</span>
          <span>{rtl ? it.fa : it.en}</span>
        </button>
      ))}
    </nav>
  );

  /* تب‌های ۷ تا ۹ پنل مستقل خودشان را دارند و به دادهٔ این میز کار وابسته نیستند. */
  const independent = tab === "quantities" || tab === "balance" || tab === "pnl";

  let body: React.ReactNode;
  if (independent) {
    body = (
      <>
        {tab === "quantities" && <QuantityBalancePanel lang={lang} mode="quantities" />}
        {tab === "balance" && <QuantityBalancePanel lang={lang} mode="balance" />}
        {tab === "pnl" && <ProfitLossPanel lang={lang} />}
      </>
    );
  } else if (loading && !ws) {
    body = <p className="p-4 text-[10px] tx3">{rtl ? "در حال خواندن داده از سرور…" : "Loading from server…"}</p>;
  } else if (loadErr) {
    body = (
      <Section title={rtl ? "داده در دسترس نیست" : "Data unavailable"}>
        <p className="text-[10px] text-rose-200">{loadErr.message}</p>
        <p className="mt-1 text-[9px] tx3">
          {loadErr.status === 401
            ? rtl ? "ابتدا وارد سامانه شوید." : "Please sign in."
            : loadErr.status === 403
              ? rtl ? "نقش فعلی مجوز «مشاهده هزینه» ندارد؛ با نقشی مثل کنترل هزینه یا مدیر پروژه وارد شوید." : "Your role lacks fin.cost.view."
              : rtl ? "اتصال به سرور API برقرار نیست." : "API server unreachable."}
        </p>
        <button onClick={() => void reload()} className={`${btnPrimary} mt-2`}>{rtl ? "تلاش دوباره" : "Retry"}</button>
      </Section>
    );
  } else if (ws && view) {
    body = (
      <>
        {showSettings && <SettingsPanel rtl={rtl} ws={ws} canEdit={perm.post} busy={busy} onSave={(s) => act(() => client.saveSettings(s), rtl ? "تنظیمات ذخیره شد" : "Settings saved", "FIN_SETTINGS_SET")} />}
        {view.empty ? (
          <EmptyState rtl={rtl} canSeed={perm.post} busy={busy} onSeed={() => act(() => client.seed(), rtl ? "دادهٔ نمونه بارگذاری شد" : "Sample data loaded", "FIN_SAMPLE_SEEDED")}>
            {perm.budget && <AccountForm rtl={rtl} ws={ws} busy={busy} onCreate={(a) => act(() => client.createAccount(a), rtl ? "حساب هزینه ثبت شد" : "Cost account created")} />}
          </EmptyState>
        ) : (
          <Tabs rtl={rtl} lang={lang} tab={tab} ws={ws} v={view} perm={perm} busy={busy} client={client} act={act} />
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {header(independent ? null : view)}
      {tabsNav}
      <div className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">{body}</div>
    </div>
  );
}

/* ══════════════════════════ حالت خالی و تنظیمات ══════════════════════════ */

function EmptyState({ rtl, canSeed, busy, onSeed, children }: { rtl: boolean; canSeed: boolean; busy: boolean; onSeed: () => void; children?: React.ReactNode }) {
  return (
    <Section title={rtl ? "هنوز داده‌ای برای این پروژه ثبت نشده" : "No data for this project yet"} note={rtl ? "هیچ عدد ساختگی نمایش داده نمی‌شود" : "no fabricated numbers"}>
      <p className="text-[9.5px] tx2">
        {rtl
          ? "با تعریف ساختار شکست هزینه (CBS) شروع کنید، یا برای آشنایی دادهٔ نمونهٔ پروژهٔ آزادگان را بارگذاری کنید. دادهٔ نمونه فقط روی پروژهٔ خالی و فقط با همین دکمه بارگذاری می‌شود."
          : "Start by defining the CBS, or load the Azadegan sample. Sample data loads only into an empty project and only via this button."}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canSeed ? (
          <button onClick={onSeed} disabled={busy} className={btnWarn}>{rtl ? "بارگذاری دادهٔ نمونه" : "Load sample data"}</button>
        ) : (
          <span className="text-[9px] tx4">{rtl ? "بارگذاری نمونه مجوز «ثبت هزینه» می‌خواهد (نقش کنترل هزینه)." : "Seeding requires fin.cost.post."}</span>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </Section>
  );
}

function SettingsPanel({ rtl, ws, canEdit, busy, onSave }: { rtl: boolean; ws: FinWorkspacePayload; canEdit: boolean; busy: boolean; onSave: (s: unknown) => Promise<boolean> }) {
  const s = ws.settings;
  const rates = s.Rates ?? {};
  const f = useForm({
    DataDate: s.DataDate, CurrentPeriod: String(s.CurrentPeriod), PeriodCount: String(s.PeriodCount),
    USD: String(rates.USD ?? ""), EUR: String(rates.EUR ?? ""), CNY: String(rates.CNY ?? ""),
    BillingMarkupPct: String(s.BillingMarkupPct ?? ""), CollectionLagPeriods: String(s.CollectionLagPeriods ?? ""),
    RetentionPct: String(s.RetentionPct ?? ""), AdvanceRecoveryPct: String(s.AdvanceRecoveryPct ?? ""), LegalDeductionPct: String(s.LegalDeductionPct ?? ""),
    MrpHorizonDays: String(s.MrpHorizonDays ?? ""),
  });
  const field = (k: keyof typeof f.v, fa: string, en: string, type = "number") => (
    <label className="flex flex-col gap-0.5 text-[8.5px] tx3">
      {rtl ? fa : en}
      <input type={type} value={String(f.v[k])} onChange={f.set(k)} disabled={!canEdit} className={inputCls} dir="ltr" />
    </label>
  );
  const save = () => {
    const r: Record<string, number> = { IRR: 1 };
    for (const c of ["USD", "EUR", "CNY"] as const) if (String(f.v[c]).trim()) r[c] = Number(f.v[c]);
    void onSave({
      DataDate: f.v.DataDate, CurrentPeriod: Number(f.v.CurrentPeriod), PeriodCount: Number(f.v.PeriodCount), Curve: s.Curve, Rates: r,
      BillingMarkupPct: numOrNull(f.v.BillingMarkupPct), CollectionLagPeriods: numOrNull(f.v.CollectionLagPeriods),
      RetentionPct: numOrNull(f.v.RetentionPct), AdvanceRecoveryPct: numOrNull(f.v.AdvanceRecoveryPct), LegalDeductionPct: numOrNull(f.v.LegalDeductionPct),
      MrpHorizonDays: numOrNull(f.v.MrpHorizonDays),
    });
  };
  return (
    <Section title={rtl ? "تنظیمات مالی پروژه" : "Project finance settings"} note={rtl ? (ws.settingsSaved ? "ذخیره‌شده روی سرور" : "هنوز ذخیره نشده — مقادیر پیش‌فرض") : ws.settingsSaved ? "saved" : "defaults (not saved)"}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {field("DataDate", "تاریخ داده", "Data date", "date")}
        {field("CurrentPeriod", "دورهٔ جاری", "Current period")}
        {field("PeriodCount", "تعداد دوره‌ها (ماه)", "Periods (months)")}
        {field("USD", "نرخ دلار (ریال)", "USD rate")}
        {field("EUR", "نرخ یورو (ریال)", "EUR rate")}
        {field("CNY", "نرخ یوان (ریال)", "CNY rate")}
        {field("BillingMarkupPct", "حاشیهٔ صورت‌وضعیت ٪", "Billing markup %")}
        {field("CollectionLagPeriods", "تأخیر وصول (دوره)", "Collection lag")}
        {field("RetentionPct", "حسن انجام کار ٪", "Retention %")}
        {field("AdvanceRecoveryPct", "استهلاک پیش‌پرداخت ٪", "Advance recovery %")}
        {field("LegalDeductionPct", "کسور قانونی ٪", "Legal deductions %")}
        {field("MrpHorizonDays", "افق MRP (روز)", "MRP horizon (days)")}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {canEdit ? (
          <button onClick={save} disabled={busy} className={btnPrimary}>{rtl ? "ذخیرهٔ تنظیمات" : "Save settings"}</button>
        ) : (
          <span className="text-[9px] tx4">{rtl ? "فقط نمایش — ویرایش مجوز «ثبت هزینه» می‌خواهد" : "read-only"}</span>
        )}
        <span className="text-[8.5px] tx4">{rtl ? "این فرض‌ها مستقیماً در پیش‌بینی نقدینگی و MRP استفاده می‌شوند." : "These assumptions drive the cash forecast and MRP."}</span>
      </div>
    </Section>
  );
}

function AccountForm({ rtl, ws, busy, onCreate }: { rtl: boolean; ws: FinWorkspacePayload; busy: boolean; onCreate: (a: unknown) => Promise<boolean> }) {
  const f = useForm({ Code: "", ParentCode: "", TitleFa: "", Kind: "direct", Category: "labor", Budget: "" });
  const submit = async () => {
    if (await onCreate({ ...f.v, ParentCode: f.v.ParentCode || null, Budget: Number(f.v.Budget || 0) })) f.reset();
  };
  return (
    <div className="flex flex-wrap items-end gap-1.5 rounded-xl border b-line-soft bg-black/10 p-2">
      <span className="w-full text-[9px] tx3">{rtl ? "افزودن حساب هزینه (CBS)" : "Add cost account"}</span>
      <input className={`${inputCls} w-20`} placeholder={rtl ? "کد مثلاً 1.2.3" : "code"} value={f.v.Code} onChange={f.set("Code")} dir="ltr" />
      <select className={inputCls} value={f.v.ParentCode} onChange={f.set("ParentCode")}>
        <option value="">{rtl ? "— ریشه —" : "— root —"}</option>
        {ws.accounts.map((a) => <option key={a.Code} value={a.Code}>{a.Code} · {a.TitleFa}</option>)}
      </select>
      <input className={`${inputCls} w-40`} placeholder={rtl ? "عنوان" : "title"} value={f.v.TitleFa} onChange={f.set("TitleFa")} />
      <select className={inputCls} value={f.v.Kind} onChange={f.set("Kind")}>
        <option value="direct">{rtl ? "مستقیم" : "direct"}</option>
        <option value="indirect">{rtl ? "غیرمستقیم" : "indirect"}</option>
        <option value="reserve">{rtl ? "ذخیره" : "reserve"}</option>
      </select>
      <select className={inputCls} value={f.v.Category} onChange={f.set("Category")}>
        {["labor", "material", "equipment", "subcontract", "overhead"].map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input className={`${inputCls} w-32`} type="number" placeholder={rtl ? "بودجه (ریال)" : "budget (IRR)"} value={f.v.Budget} onChange={f.set("Budget")} dir="ltr" />
      <button onClick={submit} disabled={busy || !f.v.Code || !f.v.TitleFa} className={btnPrimary}>{rtl ? "ثبت" : "Add"}</button>
    </div>
  );
}

/* ══════════════════════════ تب‌ها ══════════════════════════ */

type Perm = { post: boolean; budget: boolean; procure: boolean; approve: boolean; reserve: boolean };
type Act = (fn: () => Promise<FinResult<unknown>>, okText: string, auditCode?: string) => Promise<boolean>;

function Tabs({ rtl, lang, tab, ws, v, perm, busy, client, act }: { rtl: boolean; lang: Lang; tab: FinTab; ws: FinWorkspacePayload; v: FinView; perm: Perm; busy: boolean; client: FinClient; act: Act }) {
  const currencies = Object.keys(v.settings.Rates);
  const accountOptions = ws.accounts.map((a) => <option key={a.Code} value={a.Code}>{a.Code} · {a.TitleFa}</option>);
  const sev = varianceSeverity(v.evKnown && v.evm.cpi ? (v.evm.cpi - 1) * 100 : 0);

  /* فرم‌ها */
  const reserveF = useForm({ amount: "", toCode: "", reasonFa: "" });
  const txF = useForm({ CostAccountCode: "", DescriptionFa: "", Amount: "", Currency: "IRR", PeriodNo: String(v.period) });
  const arF = useForm({ PartyFa: "", Amount: "", DueDate: "" });
  const prF = useForm({ TitleFa: "", Quantity: "", Unit: "", EstimatedAmount: "", Currency: "IRR", CostAccountCode: "", NeedByDate: "", IsUrgent: false as boolean });
  const poF = useForm({ PrCode: "", VendorName: "", TitleFa: "", Quantity: "", Unit: "", UnitPrice: "", Currency: "IRR", CostAccountCode: "", PromisedDate: "" });
  const stF = useForm({ Code: "", NameFa: "", Unit: "", OnHand: "", AvgDailyUse: "", MaxDailyUse: "", LeadTimeDays: "", UnitCost: "", OnOrder: "" });
  const [ipcGross, setIpcGross] = useState("");
  const [poEdit, setPoEdit] = useState<string | null>(null);
  const poEditF = useForm({ ReceivedQty: "", InvoicedQty: "", InvoiceUnitPrice: "", PaidAmount: "", DeliveredDate: "" });
  const [progressDraft, setProgressDraft] = useState<Record<string, string>>({});

  const openPoEdit = (poNo: string) => {
    const p = ws.pos.find((x) => x.PoNo === poNo);
    if (!p) return;
    setPoEdit(poNo);
    poEditF.setV({
      ReceivedQty: String(p.ReceivedQty ?? 0), InvoicedQty: String(p.InvoicedQty ?? 0),
      InvoiceUnitPrice: String(p.InvoiceUnitPrice ?? p.UnitPrice ?? ""), PaidAmount: String(p.PaidAmount ?? 0),
      DeliveredDate: p.DeliveredDate ? String(p.DeliveredDate).slice(0, 10) : "",
    });
  };

  const prFromApproved = (code: string) => {
    const pr = ws.prs.find((p) => p.Code === code);
    if (!pr) return;
    poF.setV({
      PrCode: pr.Code, VendorName: "", TitleFa: pr.TitleFa, Quantity: String(pr.Quantity ?? ""), Unit: pr.Unit ?? "",
      UnitPrice: pr.Quantity && pr.EstimatedAmount ? String(Math.round(pr.EstimatedAmount / pr.Quantity)) : "",
      Currency: pr.Currency ?? "IRR", CostAccountCode: pr.CostAccountCode ?? "", PromisedDate: pr.NeedByDate ? String(pr.NeedByDate).slice(0, 10) : "",
    });
  };

  const setCurve = (c: CurveType) =>
    act(() => client.saveSettings({ ...v.settings, Curve: c }), rtl ? `منحنی توزیع PMB: ${c}` : `PMB curve: ${c}`);

  return (
    <>
      {/* ═══ تب ۱: مدیریت هزینه ═══ */}
      {tab === "cost" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Kpi label={rtl ? "بودجه کل (BAC)" : "BAC"} value={fmtB(v.bac, rtl)} hint="CBS rollup" />
            <Kpi label={rtl ? "مبنای اندازه‌گیری (PMB)" : "PMB"} value={fmtB(v.bac - v.reserve, rtl)} hint={rtl ? "بدون ذخیره" : "excl. reserve"} />
            <Kpi label={rtl ? "ذخیره احتیاطی" : "Reserve"} value={fmtB(v.reserve, rtl)} tone="text-amber-200" hint="DoA guarded" />
            <Kpi label={rtl ? "سهم هزینهٔ مستقیم" : "Direct share"} value={v.directPct === null ? "—" : `${Math.round(v.directPct)}%`} />
            <Kpi label={rtl ? "نرخ دلار مبنا" : "USD rate"} value={v.settings.Rates.USD ? v.settings.Rates.USD.toLocaleString("en-US") : "—"} hint={rtl ? "از تنظیمات" : "from settings"} />
          </div>

          <Section title={rtl ? "ساختار شکست هزینه (CBS) — جمع چندسطحی" : "Cost Breakdown Structure"} note={rtl ? "تعهد و واقعی از دفتر مشترک (d5 + EQP + HRM)" : "committed & actual from shared ledger"}>
            <div className="overflow-x-auto">
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>{rtl ? "کد" : "Code"}</Th><Th>{rtl ? "عنوان" : "Name"}</Th><Th>{rtl ? "نوع" : "Kind"}</Th>
                    <Th>{rtl ? "بودجه گره" : "Own"}</Th><Th>{rtl ? "جمع با فرزندان" : "Rolled up"}</Th>
                    <Th>{rtl ? "تعهد" : "Committed"}</Th><Th>{rtl ? "واقعی" : "Actual"}</Th><Th>{rtl ? "پیشرفت ٪" : "Progress %"}</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {ws.accounts.map((n) => (
                    <tr key={n.Code} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{n.Code}</td>
                      <td className="px-2 py-1 tx1" style={{ paddingInlineStart: `${(n.Code.split(".").length - 1) * 12 + 8}px` }}>{n.TitleFa}</td>
                      <td className="px-2 py-1 tx3">{n.Kind === "reserve" ? (rtl ? "ذخیره" : "reserve") : n.Kind === "indirect" ? (rtl ? "غیرمستقیم" : "indirect") : rtl ? "مستقیم" : "direct"}</td>
                      <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmtB(Number(n.Budget), rtl)}</td>
                      <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{fmtB(v.roll[n.Code] ?? 0, rtl)}</td>
                      <td className="px-2 py-1 tabular-nums text-sky-300" dir="ltr">{fmtB(Number(n.Committed ?? 0), rtl)}</td>
                      <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmtB(Number(n.Actual ?? 0), rtl)}</td>
                      <td className="px-2 py-1">
                        {n.Kind === "reserve" ? (
                          <span className="tx4">—</span>
                        ) : perm.post ? (
                          <input
                            className={`${inputCls} w-14`} type="number" min={0} max={100} dir="ltr"
                            value={progressDraft[n.Code] ?? (n.ProgressPct ?? "").toString()}
                            onChange={(e) => setProgressDraft((d) => ({ ...d, [n.Code]: e.target.value }))}
                            onBlur={() => {
                              const raw = progressDraft[n.Code];
                              if (raw === undefined || raw === (n.ProgressPct ?? "").toString()) return;
                              void act(() => client.setProgress(n.Code, numOrNull(raw)), rtl ? `پیشرفت ${n.Code} ثبت شد` : `Progress ${n.Code} saved`).then(() =>
                                setProgressDraft((d) => { const { [n.Code]: _drop, ...rest } = d; return rest; }));
                            }}
                          />
                        ) : (
                          <span className="tabular-nums tx2" dir="ltr">{n.ProgressPct ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {perm.budget && Number(n.Actual ?? 0) === 0 && Number(n.Committed ?? 0) === 0 && !ws.accounts.some((c) => c.ParentCode === n.Code) && (
                          <button onClick={() => void act(() => client.deleteAccount(n.Code), rtl ? `حساب ${n.Code} حذف شد` : `Deleted ${n.Code}`)} disabled={busy} className="text-[9px] text-rose-300 hover:text-rose-200">✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {perm.budget && <div className="mt-2"><AccountForm rtl={rtl} ws={ws} busy={busy} onCreate={(a) => act(() => client.createAccount(a), rtl ? "حساب هزینه ثبت شد" : "Cost account created")} /></div>}
          </Section>

          <Section title={rtl ? "مبنای اندازه‌گیری عملکرد (PMB) — منحنی توزیع" : "Performance Measurement Baseline"} note={rtl ? `${v.settings.PeriodCount} دوره · مجموع = PMB` : `${v.settings.PeriodCount} periods`}>
            <div className="mb-2 flex flex-wrap gap-1">
              {(["linear", "bell", "front", "back", "scurve"] as CurveType[]).map((c) => (
                <button key={c} onClick={() => perm.post && void setCurve(c)} disabled={!perm.post || busy}
                  className={`rounded-lg px-2 py-1 text-[9px] transition ${v.settings.Curve === c ? "toggle-on tx1" : "border b-line-soft tx3 hover:tx2"}`} dir="ltr">
                  {c}
                </button>
              ))}
            </div>
            <Bars values={v.pmb} />
            <div className="mt-1 flex justify-between text-[8px] tx4" dir="ltr">
              <span>P1</span>
              <span>P{v.settings.PeriodCount} · Σ {fmtB(v.pmb.reduce((a, b) => a + b, 0), rtl)}</span>
            </div>
          </Section>

          <Section title={rtl ? "ذخیره احتیاطی — آزادسازی فقط با اختیار (DoA)" : "Reserve — DoA guarded"} note={rtl ? "جابه‌جایی بودجه از حساب ذخیره به حساب مقصد، با دلیل و ثبت" : "budget transfer with reason"}>
            {perm.reserve ? (
              <div className="flex flex-wrap items-end gap-1.5">
                <input className={`${inputCls} w-32`} type="number" placeholder={rtl ? "مبلغ (ریال)" : "amount"} value={reserveF.v.amount} onChange={reserveF.set("amount")} dir="ltr" />
                <select className={inputCls} value={reserveF.v.toCode} onChange={reserveF.set("toCode")}>
                  <option value="">{rtl ? "حساب مقصد…" : "to account…"}</option>
                  {ws.accounts.filter((a) => a.Kind !== "reserve").map((a) => <option key={a.Code} value={a.Code}>{a.Code} · {a.TitleFa}</option>)}
                </select>
                <input className={`${inputCls} w-56`} placeholder={rtl ? "دلیل (الزامی)" : "reason (required)"} value={reserveF.v.reasonFa} onChange={reserveF.set("reasonFa")} />
                <button disabled={busy || !reserveF.v.amount || !reserveF.v.toCode || !reserveF.v.reasonFa} className={btnWarn}
                  onClick={async () => {
                    if (await act(() => client.reserveDraw({ amount: Number(reserveF.v.amount), toCode: reserveF.v.toCode, reasonFa: reserveF.v.reasonFa }), rtl ? "آزادسازی ذخیره ثبت شد" : "Reserve released", "RESERVE_DRAW")) reserveF.reset();
                  }}>
                  {rtl ? "آزادسازی" : "Release"}
                </button>
                <span className="text-[9.5px] tx2">{rtl ? "مانده ذخیره:" : "Remaining:"} <span dir="ltr">{fmtB(v.reserve, rtl)}</span></span>
              </div>
            ) : (
              <p className="text-[9px] tx4">{rtl ? `مانده ذخیره: ${fmtB(v.reserve, rtl)} · آزادسازی فقط با نقش مدیر پروژه یا مدیر ارشد.` : "Release requires PM or executive."}</p>
            )}
            {ws.transfers.length > 0 && (
              <ul className="mt-2 space-y-1">
                {ws.transfers.map((t) => (
                  <li key={t.Code} className="flex flex-wrap gap-2 rounded-lg border b-line-soft bg-black/15 px-2 py-1 text-[9px]">
                    <span className="font-mono tx2" dir="ltr">{t.Code}</span>
                    <span className="tx3" dir="ltr">{t.FromCode} → {t.ToCode}</span>
                    <span className="tabular-nums text-amber-200" dir="ltr">{fmtB(Number(t.Amount), rtl)}</span>
                    <span className="tx2">{t.ReasonFa}</span>
                    <span className="tx4" dir="ltr">{t.ApprovedBy} · {String(t.ApprovedAt).slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ماژول پیمان و فهرست بها (d14) — دادهٔ خودش را از REST می‌گیرد. */}
          <ContractsPanel lang={lang} />
        </>
      )}

      {/* ═══ تب ۲: کنترل هزینه (EVM) ═══ */}
      {tab === "control" && (
        <>
          {!v.evKnown && (
            <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-[9.5px] text-amber-200">
              {rtl ? "پیشرفت فیزیکی هیچ حسابی ثبت نشده؛ EV، CPI و SPI نامعلوم‌اند. درصد پیشرفت را در تب «مدیریت هزینه» وارد کنید." : "No physical progress recorded — EV/CPI/SPI unknown."}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <Kpi label="PV" value={fmtB(v.pvCum, rtl)} hint={`P${v.period}`} />
            <Kpi label="EV" value={v.evKnown ? fmtB(v.ev, rtl) : "—"} hint={rtl ? "Σ بودجه × پیشرفت" : "Σ budget × progress"} />
            <Kpi label={rtl ? "AC (دفتر مشترک)" : "AC (ledger)"} value={fmtB(v.ac, rtl)} />
            <Kpi label="CV" value={v.evKnown ? fmtB(v.evm.cv ?? 0, rtl) : "—"} tone={v.evKnown && (v.evm.cv ?? 0) < 0 ? "text-rose-300" : "text-emerald-300"} />
            <Kpi label="SV" value={v.evKnown ? fmtB(v.evm.sv, rtl) : "—"} tone={v.evKnown && v.evm.sv < 0 ? "text-rose-300" : "text-emerald-300"} />
            <Kpi label="SPI(t)" value={v.evKnown ? v.evm.spiT?.toFixed(3) ?? "—" : "—"} hint={`ES ${v.evKnown ? v.evm.es?.toFixed(2) ?? "—" : "—"}`} />
          </div>

          {v.evKnown && (
            <Section title={rtl ? "پنج روش برآورد هزینه نهایی (EAC)" : "Five EAC methods"} note={`TCPI(BAC) ${v.evm.tcpiBac?.toFixed(3) ?? "—"}`}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Kpi label="AC + (BAC−EV)" value={fmtB(v.evm.eac.ate ?? 0, rtl)} hint={rtl ? "روند غیرتکراری" : "atypical"} />
                <Kpi label="BAC / CPI" value={fmtB(v.evm.eac.cpi ?? 0, rtl)} hint={rtl ? "روند تکراری" : "typical"} />
                <Kpi label="AC + rem/(CPI×SPI)" value={fmtB(v.evm.eac.cpiSpi ?? 0, rtl)} />
                <Kpi label="0.8CPI + 0.2SPI" value={fmtB(v.evm.eac.weighted ?? 0, rtl)} />
                <Kpi label={rtl ? "با ذخیره ریسک" : "Risk-adjusted"} value={fmtB(v.evm.eac.riskAdj ?? 0, rtl)} tone="text-amber-200" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Kpi label="ETC" value={fmtB(v.evm.etc ?? 0, rtl)} />
                <Kpi label="VAC" value={fmtB(v.evm.vac ?? 0, rtl)} tone={(v.evm.vac ?? 0) < 0 ? "text-rose-300" : "text-emerald-300"} />
                <Kpi label="VAC %" value={v.vacPct !== null ? `${v.vacPct.toFixed(1)}%` : "—"} />
                <Kpi label="TCPI(EAC)" value={v.evm.tcpiEac?.toFixed(3) ?? "—"} />
              </div>
            </Section>
          )}

          {v.evKnown && (
            <Section title={rtl ? "انحراف و مسیر اقدام" : "Variance & action routing"}>
              <div className="flex flex-wrap items-center gap-2 text-[9.5px]">
                <span className={`rounded-lg px-2 py-1 ${sev === "critical" ? "bg-rose-400/15 text-rose-300" : sev === "major" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>
                  {rtl ? "شدت انحراف هزینه:" : "Cost variance severity:"} {sev}
                </span>
                {needsAutoCr(sev) ? (
                  <span className="rounded-lg bg-rose-400/10 px-2 py-1 text-rose-200">{rtl ? "الزام: صدور درخواست تغییر (RCC) + اقدام اصلاحی (MON)" : "Auto-route: Change Request (RCC) + corrective action (MON)"}</span>
                ) : (
                  <span className="rounded-lg border b-line-soft px-2 py-1 tx3">{rtl ? "در محدوده مجاز" : "Within tolerance"}</span>
                )}
              </div>
            </Section>
          )}

          <Section title={rtl ? "Snapshot تغییرناپذیر EVM" : "Immutable EVM snapshots"} note={rtl ? "سرور از دادهٔ ذخیره‌شده می‌سازد، با هش مهر می‌کند؛ هر تاریخ داده یک بار" : "server-built, hashed, one per data date"}>
            {perm.post && (
              <button onClick={() => void act(() => client.snapshot(), rtl ? `Snapshot تاریخ ${v.settings.DataDate} ثبت شد` : "Snapshot frozen", "EVM_SNAPSHOT")} disabled={busy || !v.evKnown} className={`${btnPrimary} mb-2`}>
                {rtl ? `ثبت Snapshot تاریخ ${v.settings.DataDate}` : `Freeze snapshot at ${v.settings.DataDate}`}
              </button>
            )}
            {ws.snapshots.length === 0 ? (
              <p className="text-[9px] tx4">{rtl ? "هنوز Snapshot ثبت نشده است." : "No snapshot yet."}</p>
            ) : (
              <ul className="space-y-1">
                {ws.snapshots.map((s) => {
                  const ok = (s as { valid?: boolean }).valid;
                  return (
                    <li key={s.Id} className="flex flex-wrap items-center gap-2 rounded-lg border b-line-soft bg-black/15 px-2 py-1 text-[9px]">
                      <span className="font-mono tx2" dir="ltr">{String(s.DataDate).slice(0, 10)}</span>
                      <span className="font-mono tx4" dir="ltr">#{s.Hash}</span>
                      <span className="tx3" dir="ltr">CPI {s.Cpi != null ? Number(s.Cpi).toFixed(3) : "—"} · SPI {s.Spi != null ? Number(s.Spi).toFixed(3) : "—"}</span>
                      <span className="font-mono tx4" dir="ltr">{s.FormulaVersion}</span>
                      <span className={ok ? "text-emerald-300" : "text-rose-300"}>{ok ? (rtl ? "معتبر" : "valid") : rtl ? "نامعتبر — دستکاری یا تغییر فرمول" : "INVALID"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title={rtl ? "هزینه‌های واقعی ثبت‌شده در d5" : "Actual cost transactions (d5)"} note={rtl ? "فاکتور PO خودکار ثبت می‌شود؛ تبدیل به ارز پایه با نرخ لحظهٔ ثبت" : "PO invoices auto-post; FX at posting rate"}>
            <div className="overflow-x-auto">
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft"><Th>{rtl ? "شناسه" : "ID"}</Th><Th>CBS</Th><Th>{rtl ? "شرح" : "Description"}</Th><Th>{rtl ? "مبلغ ارزی" : "FX amount"}</Th><Th>{rtl ? "ارز پایه" : "Base"}</Th><Th>{rtl ? "دوره" : "Period"}</Th><Th>{rtl ? "منشأ" : "Source"}</Th><Th /></tr>
                </thead>
                <tbody>
                  {ws.transactions.map((x) => (
                    <tr key={x.Code} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{x.Code}</td>
                      <td className="px-2 py-1 font-mono tx3" dir="ltr">{x.CostAccountCode}</td>
                      <td className="px-2 py-1 tx1">{x.DescriptionFa}</td>
                      <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{Number(x.Amount).toLocaleString("en-US")} {x.Currency}</td>
                      <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{fmtB(Number(x.BaseAmount), rtl)}</td>
                      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">P{x.PeriodNo}</td>
                      <td className="px-2 py-1 tx3">{x.SourceType === "po_invoice" ? <span dir="ltr">PO {x.SourceRef}</span> : rtl ? "دستی" : "manual"}</td>
                      <td className="px-2 py-1">
                        {perm.post && x.SourceType === "manual" && (
                          <button onClick={() => void act(() => client.reverseCost(x.Code), rtl ? `هزینهٔ ${x.Code} برگشت خورد` : `Reversed ${x.Code}`)} disabled={busy} className="text-[9px] text-rose-300 hover:text-rose-200" title={rtl ? "برگشت" : "reverse"}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {perm.post && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5">
                <select className={inputCls} value={txF.v.CostAccountCode} onChange={txF.set("CostAccountCode")}><option value="">{rtl ? "حساب…" : "account…"}</option>{accountOptions}</select>
                <input className={`${inputCls} w-48`} placeholder={rtl ? "شرح" : "description"} value={txF.v.DescriptionFa} onChange={txF.set("DescriptionFa")} />
                <input className={`${inputCls} w-32`} type="number" placeholder={rtl ? "مبلغ" : "amount"} value={txF.v.Amount} onChange={txF.set("Amount")} dir="ltr" />
                <select className={inputCls} value={txF.v.Currency} onChange={txF.set("Currency")} dir="ltr">{currencies.map((c) => <option key={c}>{c}</option>)}</select>
                <input className={`${inputCls} w-14`} type="number" min={1} max={v.settings.PeriodCount} title={rtl ? "دوره" : "period"} value={txF.v.PeriodNo} onChange={txF.set("PeriodNo")} dir="ltr" />
                <button disabled={busy || !txF.v.CostAccountCode || !txF.v.DescriptionFa || !txF.v.Amount} className={btnPrimary}
                  onClick={async () => {
                    if (await act(() => client.postCost({ ...txF.v, Amount: Number(txF.v.Amount), PeriodNo: Number(txF.v.PeriodNo) }), rtl ? "هزینه ثبت شد" : "Cost posted", "FIN_COST_POSTED")) txF.reset();
                  }}>
                  {rtl ? "ثبت هزینه" : "Post cost"}
                </button>
              </div>
            )}
          </Section>
        </>
      )}

      {/* ═══ تب ۳: جریان نقدی ═══ */}
      {tab === "cash" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Kpi label="DSO" value={days(v.dso, rtl)} hint={rtl ? "مطالبات باز ÷ صورت‌وضعیت تا امروز" : "open AR ÷ billed"} />
            <Kpi label="DPO" value={days(v.dpo, rtl)} hint={rtl ? "پرداخت معوق PO ÷ AC" : "PO payables ÷ AC"} />
            <Kpi label="CCC" value={days(v.ccc, rtl)} tone="text-amber-200" hint={`DIO ${days(v.dio, rtl)}`} />
            <Kpi label="NPV @18%" value={fmtB(v.cash.npv, rtl)} hint={rtl ? "نرخ سالانه، دوره ماهانه" : "annual rate, monthly"} />
            <Kpi label="IRR" value={pct(v.cash.irrAnnual)} hint={`payback ${v.cash.paybackPeriods?.toFixed(1) ?? "—"}`} />
          </div>

          <Section title={rtl ? "منحنی نقدینگی — مانده تجمعی" : "Cash curve — cumulative"} note={rtl ? `خروجی گذشته = هزینهٔ ثبت‌شده؛ آینده = PMB · ورودی = PMB با تأخیر ${v.settings.CollectionLagPeriods} دوره و حاشیهٔ ${v.settings.BillingMarkupPct}٪ (فرض قابل‌تنظیم)` : "past = posted cost; future = PMB; inflow = lagged PMB + markup (editable)"}>
            <Bars values={v.cash.netCum.map((x) => Math.abs(x))} colors={v.cash.netCum.map((x) => (x < 0 ? "rgba(244,63,94,0.55)" : "rgba(52,211,153,0.55)"))} />
            <div className="mt-1 text-[8.5px] tx4" dir="ltr">
              min {fmtB(v.cash.netCum.length ? Math.min(...v.cash.netCum) : null, rtl)} · max {fmtB(v.cash.netCum.length ? Math.max(...v.cash.netCum) : null, rtl)}
            </div>
          </Section>

          <Section title={rtl ? "سن مطالبات (AR Aging)" : "AR aging"} note={rtl ? "تأخیر = تاریخ داده − سررسید" : "overdue = data date − due"}>
            <div className="overflow-x-auto">
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft"><Th>{rtl ? "شناسه" : "ID"}</Th><Th>{rtl ? "طرف حساب" : "Party"}</Th><Th>{rtl ? "مبلغ" : "Amount"}</Th><Th>{rtl ? "سررسید" : "Due"}</Th><Th>{rtl ? "تأخیر" : "Overdue"}</Th><Th>{rtl ? "سطل" : "Bucket"}</Th><Th /></tr>
                </thead>
                <tbody>
                  {v.ar.map(({ row: r, base, overdue }) => {
                    const b = agingBucket(overdue);
                    return (
                      <tr key={r.Code} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{r.Code}</td>
                        <td className="px-2 py-1 tx1">{r.PartyFa}</td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmtB(base, rtl)}</td>
                        <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{String(r.DueDate).slice(0, 10)}</td>
                        <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{r.Status === "open" ? overdue : "—"}</td>
                        <td className="px-2 py-1">
                          {r.Status === "collected" ? (
                            <span className="rounded px-1.5 py-0.5 text-[8.5px] bg-emerald-400/15 text-emerald-300">{rtl ? "وصول شد" : "collected"}</span>
                          ) : (
                            <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${b === "90+" ? "bg-rose-400/15 text-rose-300" : b === "61-90" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>{b}</span>
                          )}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {perm.post && r.Status === "open" && (
                            <>
                              <button onClick={() => void act(() => client.collectReceivable(r.Code), rtl ? `مطالبهٔ ${r.Code} وصول شد` : `Collected ${r.Code}`)} disabled={busy} className="text-[9px] text-emerald-300 hover:text-emerald-200">{rtl ? "وصول" : "collect"}</button>
                              <button onClick={() => void act(() => client.deleteReceivable(r.Code), rtl ? `مطالبهٔ ${r.Code} حذف شد` : `Deleted ${r.Code}`)} disabled={busy} className="ms-2 text-[9px] text-rose-300 hover:text-rose-200">✕</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {perm.post && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5">
                <input className={`${inputCls} w-52`} placeholder={rtl ? "طرف حساب" : "party"} value={arF.v.PartyFa} onChange={arF.set("PartyFa")} />
                <input className={`${inputCls} w-32`} type="number" placeholder={rtl ? "مبلغ (ریال)" : "amount"} value={arF.v.Amount} onChange={arF.set("Amount")} dir="ltr" />
                <input className={inputCls} type="date" title={rtl ? "سررسید" : "due"} value={arF.v.DueDate} onChange={arF.set("DueDate")} dir="ltr" />
                <button disabled={busy || !arF.v.PartyFa || !arF.v.Amount || !arF.v.DueDate} className={btnPrimary}
                  onClick={async () => { if (await act(() => client.createReceivable({ ...arF.v, Amount: Number(arF.v.Amount) }), rtl ? "مطالبه ثبت شد" : "Receivable added")) arF.reset(); }}>
                  {rtl ? "ثبت مطالبه" : "Add receivable"}
                </button>
              </div>
            )}
          </Section>

          <Section title={rtl ? "ماشین‌حساب صورت‌وضعیت (خالص پرداختنی)" : "Progress invoice calculator"} note={rtl ? `حسن انجام ${v.settings.RetentionPct}٪ · استهلاک پیش‌پرداخت ${v.settings.AdvanceRecoveryPct}٪ · کسور ${v.settings.LegalDeductionPct}٪ (از تنظیمات) — صورت‌وضعیت رسمی در ماژول پیمان` : "percentages from settings; official IPCs live in the contracts module"}>
            <input className={`${inputCls} mb-2 w-44`} type="number" placeholder={rtl ? "مبلغ ناخالص (ریال)" : "gross (IRR)"} value={ipcGross} onChange={(e) => setIpcGross(e.target.value)} dir="ltr" />
            {(() => {
              const ipc = progressInvoice(Number(ipcGross) || 0, v.settings.RetentionPct, v.settings.AdvanceRecoveryPct, v.settings.LegalDeductionPct);
              return (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  <Kpi label={rtl ? "ناخالص" : "Gross"} value={fmtB(ipc.gross, rtl)} />
                  <Kpi label={rtl ? "حسن انجام کار" : "Retention"} value={fmtB(ipc.retention, rtl)} />
                  <Kpi label={rtl ? "استهلاک پیش‌پرداخت" : "Advance recovery"} value={fmtB(ipc.advanceRecovery, rtl)} />
                  <Kpi label={rtl ? "کسور قانونی" : "Legal"} value={fmtB(ipc.legalDeductions, rtl)} />
                  <Kpi label={rtl ? "خالص پرداختنی" : "Net payable"} value={fmtB(ipc.netPayable, rtl)} tone="text-emerald-300" />
                </div>
              );
            })()}
          </Section>
        </>
      )}

      {/* ═══ تب ۴: درخواست خرید ═══ */}
      {tab === "pr" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label={rtl ? "PR باز" : "Open PRs"} value={String(v.openPrCount)} />
            <Kpi label={rtl ? "PR اضطراری" : "Emergency"} value={v.emergencyPct === null ? "—" : `${Math.round(v.emergencyPct)}%`} tone="text-amber-200" />
            <Kpi label={rtl ? "پیشنهاد MRP" : "MRP suggestions"} value={String(v.mrp.length)} />
            <Kpi label={rtl ? "بودجهٔ متعهدنشده" : "Uncommitted budget"} value={fmtB(v.uncommitted, rtl)} />
          </div>

          <Section title={rtl ? "کنترل بودجه پیش از تأیید PR" : "Budget verification before PR approval"} note={rtl ? "در دسترس = Σبودجه − تعهد − واقعیِ زیردرخت CBS؛ فراتر از بودجه = رد مگر با override و دلیل" : "available = subtree budget − committed − actual"}>
            <div className="overflow-x-auto">
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft"><Th>PR</Th><Th>{rtl ? "کالا" : "Item"}</Th><Th>{rtl ? "مقدار" : "Qty"}</Th><Th>{rtl ? "برآورد" : "Estimate"}</Th><Th>CBS</Th><Th>{rtl ? "در دسترس" : "Available"}</Th><Th>{rtl ? "تاریخ نیاز" : "Need date"}</Th><Th>{rtl ? "کنترل بودجه" : "Budget"}</Th><Th>{rtl ? "مرجع DoA" : "DoA"}</Th><Th>{rtl ? "وضعیت" : "Status"}</Th><Th /></tr>
                </thead>
                <tbody>
                  {v.prs.map(({ row: p, estimateBase, available, check, approver }) => {
                    const st = PR_STATUS[p.Status] ?? PR_STATUS.draft;
                    return (
                      <tr key={p.Code} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{p.Code}</td>
                        <td className="px-2 py-1 tx1">{p.TitleFa} {p.IsUrgent && <span className="rounded bg-rose-400/15 px-1 text-[8px] text-rose-300">{rtl ? "اضطراری" : "urgent"}</span>} {p.MrCode && <span className="tx4 text-[8px]" dir="ltr">MR {p.MrCode}</span>}</td>
                        <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{qty(p.Quantity)} {p.Unit ?? ""}</td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmtB(estimateBase, rtl)}</td>
                        <td className="px-2 py-1 font-mono tx3" dir="ltr">{p.CostAccountCode ?? "—"}</td>
                        <td className={`px-2 py-1 tabular-nums ${available !== null && available < 0 ? "text-rose-300" : "tx3"}`} dir="ltr">{fmtB(available, rtl)}</td>
                        <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{p.NeedByDate ? String(p.NeedByDate).slice(0, 10) : "—"}</td>
                        <td className="px-2 py-1">
                          {check === null ? (
                            <span className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] tx4">{rtl ? "نامعلوم" : "unknown"}</span>
                          ) : (
                            <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${check.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>{check.ok ? (rtl ? "در بودجه" : "pass") : rtl ? "فراتر از بودجه" : "over budget"}</span>
                          )}
                          {p.BudgetStatus === "over_budget" && <span className="ms-1 text-[8px] text-amber-200" title={p.RemarksFa ?? ""}>override</span>}
                        </td>
                        <td className="px-2 py-1 tx2" dir="ltr">{approver ?? "—"}</td>
                        <td className="px-2 py-1"><span className={`rounded px-1.5 py-0.5 text-[8.5px] ${st.cls}`}>{rtl ? st.fa : st.en}</span></td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          <PrActions rtl={rtl} code={p.Code} status={p.Status} over={check !== null && !check.ok} perm={perm} busy={busy} client={client} act={act} onMakePo={() => prFromApproved(p.Code)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {perm.procure && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5 rounded-xl border b-line-soft bg-black/10 p-2">
                <span className="w-full text-[9px] tx3">{rtl ? "درخواست خرید جدید" : "New purchase requisition"}</span>
                <input className={`${inputCls} w-44`} placeholder={rtl ? "کالا" : "item"} value={prF.v.TitleFa} onChange={prF.set("TitleFa")} />
                <input className={`${inputCls} w-20`} type="number" placeholder={rtl ? "مقدار" : "qty"} value={prF.v.Quantity} onChange={prF.set("Quantity")} dir="ltr" />
                <input className={`${inputCls} w-16`} placeholder={rtl ? "واحد" : "unit"} value={prF.v.Unit} onChange={prF.set("Unit")} />
                <input className={`${inputCls} w-32`} type="number" placeholder={rtl ? "برآورد" : "estimate"} value={prF.v.EstimatedAmount} onChange={prF.set("EstimatedAmount")} dir="ltr" />
                <select className={inputCls} value={prF.v.Currency} onChange={prF.set("Currency")} dir="ltr">{currencies.map((c) => <option key={c}>{c}</option>)}</select>
                <select className={inputCls} value={prF.v.CostAccountCode} onChange={prF.set("CostAccountCode")}><option value="">{rtl ? "حساب…" : "account…"}</option>{accountOptions}</select>
                <input className={inputCls} type="date" title={rtl ? "تاریخ نیاز" : "need by"} value={prF.v.NeedByDate} onChange={prF.set("NeedByDate")} dir="ltr" />
                <label className="flex items-center gap-1 text-[9px] tx3"><input type="checkbox" checked={Boolean(prF.v.IsUrgent)} onChange={prF.set("IsUrgent")} />{rtl ? "اضطراری" : "urgent"}</label>
                <button disabled={busy || !prF.v.TitleFa || !prF.v.Quantity || !prF.v.EstimatedAmount || !prF.v.CostAccountCode} className={btnPrimary}
                  onClick={async () => {
                    if (await act(() => client.createPr({ ...prF.v, Quantity: Number(prF.v.Quantity), EstimatedAmount: Number(prF.v.EstimatedAmount), NeedByDate: prF.v.NeedByDate || null }), rtl ? "درخواست خرید ثبت شد" : "PR created", "FIN_PR_CREATED")) prF.reset();
                  }}>
                  {rtl ? "ثبت PR" : "Create PR"}
                </button>
              </div>
            )}
          </Section>

          <Section title={rtl ? "اجرای MRP — پیشنهاد درخواست خرید" : "MRP run — PR suggestions"} note={rtl ? `کسری = نیاز ${v.settings.MrpHorizonDays} روزه (مصرف میانگین) + ذخیره ایمنی − موجودی − در راه` : `shortage over ${v.settings.MrpHorizonDays}-day horizon`}>
            {v.mrp.length === 0 ? (
              <p className="text-[9px] tx4">{rtl ? "کسری‌ای شناسایی نشد." : "No shortage."}</p>
            ) : (
              <table className="w-full text-[9.5px]">
                <thead className="tx3"><tr className="border-b b-line-soft"><Th>{rtl ? "کد کالا" : "Material"}</Th><Th>{rtl ? "مقدار سفارش" : "Order qty"}</Th><Th>{rtl ? "تاریخ نیاز" : "Need date"}</Th><Th>{rtl ? "آخرین مهلت صدور PR" : "Release by"}</Th></tr></thead>
                <tbody>
                  {v.mrp.map((m) => (
                    <tr key={m.materialCode} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{m.materialCode}</td>
                      <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{m.orderQty.toLocaleString("en-US")}</td>
                      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{m.needDate}</td>
                      <td className={`px-2 py-1 tabular-nums ${m.releaseDate < v.settings.DataDate ? "text-rose-300" : "text-amber-200"}`} dir="ltr">{m.releaseDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}

      {/* ═══ تب ۵: سفارش خرید ═══ */}
      {tab === "po" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label={rtl ? "تعهد باز (Committed)" : "Open commitment"} value={fmtB(v.committedTotal, rtl)} tone="text-sky-300" />
            <Kpi label={rtl ? "تحویل‌شده بدون فاکتور (Accrued)" : "Accrued"} value={fmtB(v.accruedTotal, rtl)} />
            <Kpi label={rtl ? "پرداخت معوق" : "Outstanding payment"} value={fmtB(v.outstandingTotal, rtl)} />
            <Kpi label={rtl ? "بودجهٔ متعهدنشده" : "Uncommitted budget"} value={fmtB(v.uncommitted, rtl)} />
          </div>

          <Section title={rtl ? "زنجیره تعهد: PR ← PO ← رسید ← فاکتور ← پرداخت" : "Commitment chain"} note={rtl ? "فاکتور = هزینهٔ واقعی خودکار؛ پرداخت فقط با تطابق سه‌جانبه" : "invoice auto-posts actual; payment gated by 3-way match"}>
            <div className="overflow-x-auto">
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft"><Th>PO</Th><Th>{rtl ? "تأمین‌کننده" : "Vendor"}</Th><Th>{rtl ? "رسید/فاکتور" : "Recv/Inv"}</Th><Th>Committed</Th><Th>Accrued</Th><Th>Actual</Th><Th>{rtl ? "امتیاز" : "Score"}</Th><Th>{rtl ? "تأخیر" : "Delay"}</Th><Th>{rtl ? "وضعیت" : "Status"}</Th><Th /></tr>
                </thead>
                <tbody>
                  {v.commitments.map(({ row, view: cv, score, delay, delayOpen, rateMissing }) => (
                    <tr key={row.PoNo} className={`border-b b-line-soft/50 ${row.Status === "cancelled" ? "opacity-50" : ""}`}>
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{row.PoNo}{row.PrCode && <div className="text-[8px] tx4">{row.PrCode}</div>}</td>
                      <td className="px-2 py-1 tx1">{row.VendorName} <span className="tx4" dir="ltr">({row.Currency ?? "IRR"})</span><div className="text-[8px] tx3">{row.TitleFa}</div></td>
                      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{qty(row.ReceivedQty)}/{qty(row.InvoicedQty)} of {qty(row.Quantity)}</td>
                      <td className="px-2 py-1 tabular-nums text-sky-300" dir="ltr">{rateMissing ? "—" : fmtB(cv.committed, rtl)}</td>
                      <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmtB(cv.accrued, rtl)}</td>
                      <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{fmtB(cv.actual, rtl)}</td>
                      <td className="px-2 py-1">
                        {score ? (
                          <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${score.grade === "A" ? "bg-emerald-400/15 text-emerald-300" : score.grade === "D" ? "bg-rose-400/15 text-rose-300" : "bg-amber-400/15 text-amber-200"}`} dir="ltr">{score.grade} · {score.score}</span>
                        ) : <span className="tx4">—</span>}
                      </td>
                      <td className={`px-2 py-1 tabular-nums ${delay !== null && delay > 0 ? "text-rose-300" : "tx3"}`} dir="ltr">
                        {delay === null ? (rtl ? "در موعد" : "on time") : `${delay}d${delayOpen ? (rtl ? " (باز)" : " open") : ""}`}
                      </td>
                      <td className="px-2 py-1 tx3">{rtl ? PO_STATUS[row.Status]?.fa : PO_STATUS[row.Status]?.en}</td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {perm.procure && row.Status !== "cancelled" && row.Status !== "closed" && (
                          <>
                            <button onClick={() => openPoEdit(row.PoNo)} className="text-[9px] text-sky-300 hover:text-sky-200">{rtl ? "ثبت رسید/فاکتور" : "update"}</button>
                            {!Number(row.ReceivedQty) && !Number(row.InvoicedQty) && (
                              <button onClick={() => void act(() => client.cancelPo(row.PoNo), rtl ? `سفارش ${row.PoNo} لغو شد` : `Cancelled ${row.PoNo}`)} disabled={busy} className="ms-2 text-[9px] text-rose-300 hover:text-rose-200">{rtl ? "لغو" : "cancel"}</button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {poEdit && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5 rounded-xl border border-sky-400/30 bg-sky-400/5 p-2">
                <span className="w-full text-[9px] text-sky-200">{rtl ? `به‌روزرسانی ${poEdit} — فاکتور کم نمی‌شود؛ قیمت فاکتور پس از اولین فاکتور قفل است` : `Update ${poEdit}`}</span>
                {([["ReceivedQty", "مقدار رسید تجمعی", "received qty"], ["InvoicedQty", "مقدار فاکتور تجمعی", "invoiced qty"], ["InvoiceUnitPrice", "قیمت واحد فاکتور", "invoice unit price"], ["PaidAmount", "پرداخت تجمعی", "paid amount"]] as const).map(([k, fa, en]) => (
                  <label key={k} className="flex flex-col gap-0.5 text-[8.5px] tx3">{rtl ? fa : en}<input className={`${inputCls} w-28`} type="number" value={poEditF.v[k]} onChange={poEditF.set(k)} dir="ltr" /></label>
                ))}
                <label className="flex flex-col gap-0.5 text-[8.5px] tx3">{rtl ? "تاریخ تحویل" : "delivered"}<input className={inputCls} type="date" value={poEditF.v.DeliveredDate} onChange={poEditF.set("DeliveredDate")} dir="ltr" /></label>
                <button disabled={busy} className={btnOk}
                  onClick={async () => {
                    const p = ws.pos.find((x) => x.PoNo === poEdit);
                    const patch: Record<string, unknown> = {};
                    const numF = ["ReceivedQty", "InvoicedQty", "InvoiceUnitPrice", "PaidAmount"] as const;
                    for (const k of numF) {
                      const nv = numOrNull(poEditF.v[k]);
                      const old = p ? (p[k] ?? (k === "InvoiceUnitPrice" ? p.UnitPrice : 0)) : null;
                      if (nv !== null && Number(old) !== nv) patch[k] = nv;
                    }
                    const oldD = p?.DeliveredDate ? String(p.DeliveredDate).slice(0, 10) : "";
                    if (poEditF.v.DeliveredDate !== oldD) patch.DeliveredDate = poEditF.v.DeliveredDate || null;
                    if (!Object.keys(patch).length) { setPoEdit(null); return; }
                    if (await act(() => client.updatePo(poEdit, patch), rtl ? `سفارش ${poEdit} به‌روز شد` : `Updated ${poEdit}`, "FIN_PO_UPDATED")) setPoEdit(null);
                  }}>
                  {rtl ? "ذخیره" : "Save"}
                </button>
                <button onClick={() => setPoEdit(null)} className={`${btnCls} border-transparent tx3`}>{rtl ? "انصراف" : "Cancel"}</button>
              </div>
            )}

            {perm.procure && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5 rounded-xl border b-line-soft bg-black/10 p-2">
                <span className="w-full text-[9px] tx3">{rtl ? "صدور سفارش خرید — از PR تأییدشده (پیشنهادی) یا مستقیم" : "Issue PO — from an approved PR or direct"}</span>
                <select className={inputCls} value={poF.v.PrCode} onChange={(e) => (e.target.value ? prFromApproved(e.target.value) : poF.reset())}>
                  <option value="">{rtl ? "بدون PR (مستقیم)" : "no PR (direct)"}</option>
                  {ws.prs.filter((p) => p.Status === "approved").map((p) => <option key={p.Code} value={p.Code}>{p.Code} · {p.TitleFa}</option>)}
                </select>
                <input className={`${inputCls} w-40`} placeholder={rtl ? "تأمین‌کننده" : "vendor"} value={poF.v.VendorName} onChange={poF.set("VendorName")} />
                <input className={`${inputCls} w-36`} placeholder={rtl ? "شرح" : "title"} value={poF.v.TitleFa} onChange={poF.set("TitleFa")} />
                <input className={`${inputCls} w-20`} type="number" placeholder={rtl ? "مقدار" : "qty"} value={poF.v.Quantity} onChange={poF.set("Quantity")} dir="ltr" />
                <input className={`${inputCls} w-28`} type="number" placeholder={rtl ? "قیمت واحد" : "unit price"} value={poF.v.UnitPrice} onChange={poF.set("UnitPrice")} dir="ltr" />
                <select className={inputCls} value={poF.v.Currency} onChange={poF.set("Currency")} dir="ltr">{currencies.map((c) => <option key={c}>{c}</option>)}</select>
                <select className={inputCls} value={poF.v.CostAccountCode} onChange={poF.set("CostAccountCode")}><option value="">{rtl ? "حساب…" : "account…"}</option>{accountOptions}</select>
                <input className={inputCls} type="date" title={rtl ? "تاریخ قول تحویل" : "promised"} value={poF.v.PromisedDate} onChange={poF.set("PromisedDate")} dir="ltr" />
                <button disabled={busy || !poF.v.VendorName || !poF.v.UnitPrice || !poF.v.PromisedDate || !poF.v.Quantity || !poF.v.CostAccountCode} className={btnPrimary}
                  onClick={async () => {
                    if (await act(() => client.createPo({ ...poF.v, PrCode: poF.v.PrCode || null, Quantity: Number(poF.v.Quantity), UnitPrice: Number(poF.v.UnitPrice) }), rtl ? "سفارش خرید صادر شد" : "PO issued", "FIN_PO_ISSUED")) poF.reset();
                  }}>
                  {rtl ? "صدور PO" : "Issue PO"}
                </button>
              </div>
            )}
          </Section>

          <Section title={rtl ? "تطابق سه‌جانبهٔ تجمعی پیش از پرداخت" : "Cumulative 3-way match gate"} note={rtl ? "تلورانس ۵٪؛ فاکتور بیش از رسید یا سفارش، یا انحراف قیمت = پرداخت مسدود" : "5% tolerance"}>
            {v.commitments.filter((c) => c.match).length === 0 ? (
              <p className="text-[9px] tx4">{rtl ? "هنوز فاکتوری برای تطبیق ثبت نشده." : "No invoices to match yet."}</p>
            ) : (
              <div className="space-y-1">
                {v.commitments.filter((c) => c.match).map(({ row, match }) => (
                  <div key={row.PoNo} className="flex flex-wrap items-center gap-2 rounded-lg border b-line-soft bg-black/15 px-2 py-1 text-[9px]">
                    <span className="font-mono tx2" dir="ltr">{row.PoNo}</span>
                    <span className="tx3" dir="ltr">PO {qty(row.Quantity)}×{qty(row.UnitPrice)} · GRN {qty(row.ReceivedQty)} · INV {qty(row.InvoicedQty)}×{qty(row.InvoiceUnitPrice ?? row.UnitPrice)}</span>
                    <span className={`rounded px-1.5 py-0.5 ${match!.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>{match!.ok ? (rtl ? "مجاز پرداخت" : "payable") : rtl ? "پرداخت مسدود" : "payment blocked"}</span>
                    {match!.reasons.map((r) => <span key={r} className="rounded bg-rose-400/10 px-1.5 py-0.5 text-[8px] text-rose-200" dir="ltr">{r}</span>)}
                    <span className="tx4" dir="ltr">max dev {match!.maxDeviationPct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      {/* ═══ تب ۶: مدیریت کالا و انبار ═══ */}
      {tab === "inventory" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label={rtl ? "ارزش موجودی" : "Inventory value"} value={fmtB(v.inventoryValue, rtl)} />
            <Kpi label={rtl ? "اقلام زیر نقطه سفارش" : "Below ROP"} value={String(v.stock.filter((s) => s.reorder).length)} tone="text-amber-200" />
            <Kpi label={rtl ? "ریسک کسری" : "Stockout risk"} value={String(v.stock.filter((s) => s.risk).length)} tone="text-rose-300" />
            <Kpi label={rtl ? "اقلام کلاس A" : "Class A items"} value={String(Object.values(v.abc).filter((x) => x === "A").length)} />
          </div>

          <Section title={rtl ? "کنترل موجودی — ذخیره ایمنی، نقطه سفارش و EOQ" : "Inventory control"} note={rtl ? "موجودی را مستقیم ویرایش کنید؛ اسناد رسمی انبار در فاز P6" : "edit on-hand directly; formal warehouse docs in P6"}>
            <div className="overflow-x-auto">
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft"><Th>{rtl ? "کد" : "Code"}</Th><Th>{rtl ? "کالا" : "Item"}</Th><Th>{rtl ? "موجودی" : "On hand"}</Th><Th>{rtl ? "در راه" : "On order"}</Th><Th>SS</Th><Th>ROP</Th><Th>EOQ</Th><Th>ABC</Th><Th>{rtl ? "بچ" : "Batch"}</Th><Th>{rtl ? "وضعیت" : "Status"}</Th><Th /></tr>
                </thead>
                <tbody>
                  {v.stock.map((s) => (
                    <StockRowView key={s.row.Code} rtl={rtl} s={s} abc={v.abc[s.row.Code]} canEdit={perm.procure} busy={busy}
                      onSave={(onHand) => act(() => client.updateStock(s.row.Code, { OnHand: onHand }), rtl ? `موجودی ${s.row.Code} به‌روز شد` : `Stock ${s.row.Code} updated`)}
                      onDelete={() => act(() => client.deleteStock(s.row.Code), rtl ? `کالای ${s.row.Code} حذف شد` : `Deleted ${s.row.Code}`)} />
                  ))}
                </tbody>
              </table>
            </div>
            {perm.procure && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5 rounded-xl border b-line-soft bg-black/10 p-2">
                <span className="w-full text-[9px] tx3">{rtl ? "افزودن کالا" : "Add stock item"}</span>
                <input className={`${inputCls} w-20`} placeholder={rtl ? "کد" : "code"} value={stF.v.Code} onChange={stF.set("Code")} dir="ltr" />
                <input className={`${inputCls} w-40`} placeholder={rtl ? "نام کالا" : "name"} value={stF.v.NameFa} onChange={stF.set("NameFa")} />
                <input className={`${inputCls} w-14`} placeholder={rtl ? "واحد" : "unit"} value={stF.v.Unit} onChange={stF.set("Unit")} />
                {([["OnHand", "موجودی", "on hand"], ["AvgDailyUse", "مصرف میانگین/روز", "avg/day"], ["MaxDailyUse", "حداکثر مصرف/روز", "max/day"], ["LeadTimeDays", "لیدتایم (روز)", "lead days"], ["UnitCost", "قیمت واحد", "unit cost"], ["OnOrder", "در راه", "on order"]] as const).map(([k, fa, en]) => (
                  <input key={k} className={`${inputCls} w-24`} type="number" placeholder={rtl ? fa : en} value={stF.v[k]} onChange={stF.set(k)} dir="ltr" />
                ))}
                <button disabled={busy || !stF.v.Code || !stF.v.NameFa} className={btnPrimary}
                  onClick={async () => {
                    const body = { ...stF.v, OnHand: Number(stF.v.OnHand || 0), AvgDailyUse: Number(stF.v.AvgDailyUse || 0), MaxDailyUse: Number(stF.v.MaxDailyUse || 0), LeadTimeDays: Number(stF.v.LeadTimeDays || 0), UnitCost: Number(stF.v.UnitCost || 0), OnOrder: numOrNull(stF.v.OnOrder) };
                    if (await act(() => client.createStock(body), rtl ? "کالا ثبت شد" : "Stock item added")) stF.reset();
                  }}>
                  {rtl ? "ثبت کالا" : "Add"}
                </button>
              </div>
            )}
          </Section>

          <Section title={rtl ? "گردش انبار" : "Warehouse flow"} note={rtl ? "شمارش‌ها از دادهٔ واقعی؛ اسناد رسید (MRS)، حواله (MIV) و عودت (MRV) در فاز P6" : "counts from live data; formal docs in P6"}>
            <div className="grid gap-2 md:grid-cols-3">
              {[
                { fa: "POهای در انتظار رسید کامل", en: "POs awaiting full receipt", v: String(ws.pos.filter((p) => p.Status === "issued" || p.Status === "acknowledged" || p.Status === "partially_received").length), icon: "📥" },
                { fa: "اقلام در راه", en: "Items on order", v: String(ws.stock.filter((s) => Number(s.OnOrder ?? 0) > 0).length), icon: "🚚" },
                { fa: "پیشنهاد سفارش مجدد (MRP)", en: "Reorder suggestions", v: String(v.mrp.length), icon: "🔁" },
              ].map((c) => (
                <div key={c.en} className="rounded-xl border b-line-soft bg-black/15 p-2">
                  <div className="text-[10px] tx1">{c.icon} {rtl ? c.fa : c.en}</div>
                  <div className="mt-1 text-[12px] font-semibold tabular-nums tx2" dir="ltr">{c.v}</div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </>
  );
}

function PrActions({ rtl, code, status, over, perm, busy, client, act, onMakePo }: {
  rtl: boolean; code: string; status: PrStatus; over: boolean; perm: Perm; busy: boolean; client: FinClient; act: Act; onMakePo: () => void;
}) {
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState<null | "override" | "reject">(null);
  const link = "text-[9px] hover:opacity-80";
  if (asking) {
    return (
      <span className="flex items-center gap-1">
        <input className={`${inputCls} w-32`} placeholder={rtl ? "دلیل" : "reason"} value={reason} onChange={(e) => setReason(e.target.value)} />
        <button disabled={busy || !reason} className={`${link} text-amber-200`}
          onClick={async () => {
            const ok = asking === "override"
              ? await act(() => client.prAction(code, "approve", { override: true, reasonFa: reason }), rtl ? `${code} فراتر از بودجه تأیید شد` : `${code} approved (override)`, "FIN_PR_APPROVE")
              : await act(() => client.prAction(code, "reject", { reasonFa: reason }), rtl ? `${code} رد شد` : `${code} rejected`);
            if (ok) { setAsking(null); setReason(""); }
          }}>
          {rtl ? "تأیید" : "ok"}
        </button>
        <button className={`${link} tx3`} onClick={() => setAsking(null)}>✕</button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      {status === "draft" && perm.procure && <button disabled={busy} className={`${link} text-sky-300`} onClick={() => void act(() => client.prAction(code, "submit"), rtl ? `${code} ارسال شد` : `${code} submitted`)}>{rtl ? "ارسال" : "submit"}</button>}
      {status === "submitted" && perm.approve && (
        <>
          <button disabled={busy} className={`${link} text-emerald-300`} onClick={() => (over ? setAsking("override") : void act(() => client.prAction(code, "approve"), rtl ? `${code} تأیید شد` : `${code} approved`, "FIN_PR_APPROVE"))}>
            {over ? (rtl ? "تأیید با override" : "approve (override)") : rtl ? "تأیید" : "approve"}
          </button>
          <button disabled={busy} className={`${link} text-rose-300`} onClick={() => setAsking("reject")}>{rtl ? "رد" : "reject"}</button>
        </>
      )}
      {status === "approved" && perm.procure && <button className={`${link} text-violet-200`} onClick={onMakePo}>{rtl ? "صدور PO ↓" : "make PO ↓"}</button>}
      {(status === "draft" || status === "submitted" || status === "approved") && perm.procure && (
        <button disabled={busy} className={`${link} tx4`} onClick={() => void act(() => client.prAction(code, "cancel"), rtl ? `${code} لغو شد` : `${code} cancelled`)}>{rtl ? "لغو" : "cancel"}</button>
      )}
    </span>
  );
}

function StockRowView({ rtl, s, abc, canEdit, busy, onSave, onDelete }: {
  rtl: boolean; s: FinView["stock"][number]; abc: string | undefined; canEdit: boolean; busy: boolean;
  onSave: (onHand: number) => Promise<boolean>; onDelete: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const r = s.row;
  return (
    <tr className="border-b b-line-soft/50">
      <td className="px-2 py-1 font-mono tx2" dir="ltr">{r.Code}</td>
      <td className="px-2 py-1 tx1">{r.NameFa} <span className="tx4">{r.Unit ?? ""}</span></td>
      <td className="px-2 py-1 tabular-nums tx1" dir="ltr">
        {canEdit ? (
          <input className={`${inputCls} w-20`} type="number" min={0} value={draft ?? String(r.OnHand)} onChange={(e) => setDraft(e.target.value)}
            onBlur={async () => { if (draft !== null && Number(draft) !== Number(r.OnHand)) await onSave(Number(draft)); setDraft(null); }} />
        ) : qty(r.OnHand)}
      </td>
      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{qty(r.OnOrder ?? 0)}</td>
      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{Math.round(s.ss)}</td>
      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{Math.round(s.rop)}</td>
      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{Math.round(s.eoq)}</td>
      <td className="px-2 py-1">
        <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${abc === "A" ? "bg-rose-400/15 text-rose-300" : abc === "B" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>{abc ?? "—"}</span>
      </td>
      <td className="px-2 py-1 font-mono tx4" dir="ltr">{r.BatchNo ? `▮▯▮ ${r.BatchNo}` : "—"}</td>
      <td className="px-2 py-1">
        {s.risk ? (
          <span className="rounded bg-rose-400/15 px-1.5 py-0.5 text-[8.5px] text-rose-300">{rtl ? "کسری قریب‌الوقوع" : "stockout"}</span>
        ) : s.reorder ? (
          <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[8.5px] text-amber-200">{rtl ? "سفارش مجدد" : "reorder"}</span>
        ) : (
          <span className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] tx3">{rtl ? "نرمال" : "ok"}</span>
        )}
      </td>
      <td className="px-2 py-1">
        {canEdit && Number(r.OnHand) === 0 && <button onClick={() => void onDelete()} disabled={busy} className="text-[9px] text-rose-300 hover:text-rose-200">✕</button>}
      </td>
    </tr>
  );
}
