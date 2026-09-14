/**
 * میز کار ایمنی، بهداشت و محیط‌زیست — دامنهٔ d16.
 *
 * تا پیش از این، کل موتور HSE (پنج بخش، ۱۱۸ صادرات، ۵۱ اندپوینت) فقط
 * از راه REST قابل استفاده بود و برای کاربر نهایی نامرئی می‌ماند.
 *
 * شش تب دقیقاً برابر شش زیرماژول تعریف‌شده در `framework.ts` است تا
 * نگاشت منو به صفحه یک‌به‌یک بماند.
 *
 * قاعدهٔ حاکم بر این صفحه: هیچ عددی از خودِ UI ساخته نمی‌شود. هر سنجه
 * و هر متن فارسیِ وضعیت از موتور می‌آید، چون در ماژول ایمنی یک عدد
 * بازمحاسبه‌شده در لایهٔ نمایش می‌تواند با عددی که دروازه‌ها بر پایهٔ آن
 * تصمیم می‌گیرند فرق کند.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { type Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../services/auditLogger";

export type HseTab = "jsa" | "permit" | "incident" | "violation" | "training" | "dashboard";

const TABS: { id: HseTab; fa: string; en: string; icon: string }[] = [
  { id: "jsa", fa: "ارزیابی ریسک", en: "Risk Assessment", icon: "🧭" },
  { id: "permit", fa: "پروانهٔ کار", en: "Work Permits", icon: "📄" },
  { id: "incident", fa: "حوادث و تحقیق", en: "Incidents", icon: "🚨" },
  { id: "violation", fa: "بازرسی و توقف کار", en: "Inspections & SWO", icon: "🛑" },
  { id: "training", fa: "آموزش و محیط‌زیست", en: "Training & Environment", icon: "🎓" },
  { id: "dashboard", fa: "شاخص‌ها", en: "KPIs", icon: "📊" },
];

const PROJECT_ID = "p1";
const ACCENT = "#DC2626";

type Props = { lang: Lang; onBack: () => void; initialTab?: HseTab };
type Json = Record<string, any>;

/* ═════════════════════ ارتباط با سرور ═════════════════════ */

/**
 * نتیجهٔ خواندن.
 *
 * `denied` عمداً از `null` جدا شده است. هر پنج اندپوینت خواندن مجوز
 * جدا دارند (`hse.violation.issue` فقط دست افسر ایمنی است) و اگر ۴۰۳
 * را مثل «داده‌ای نیست» نشان می‌دادیم، مدیر پروژه روی کارت «توقف کار
 * فعال: ۰» می‌دید در حالی که کارگاه متوقف بود. این بدترین حالت ممکن
 * در یک داشبورد ایمنی است.
 */
type Fetched = { data: Json | null; denied: boolean; unauth: boolean };

async function fetchJson(path: string, userId: string): Promise<Fetched> {
  try {
    const res = await fetch(path, { headers: { accept: "application/json", "x-user-id": userId } });
    /* ۴۰۱ «وارد نشده‌ای» است و ۴۰۳ «نقشت اجازه ندارد» — دو کار متفاوت
     * از کاربر می‌خواهند، پس یک پیام برای هر دو گمراه‌کننده است. */
    if (res.status === 401) return { data: null, denied: true, unauth: true };
    if (res.status === 403) return { data: null, denied: true, unauth: false };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return { data: null, denied: false, unauth: false };
    const body = await res.json();
    return { data: body?.ok ? body.data : null, denied: false, unauth: false };
  } catch {
    return { data: null, denied: false, unauth: false };
  }
}

type PostResult =
  | { ok: true; data: Json }
  | { ok: false; messageFa: string; detailsFa?: string[] };

/**
 * POST با هویت کاربر.
 *
 * `detailsFa` فهرست موانعی است که موتور برگردانده (`cntBad` آن را در
 * پاسخ می‌گذارد). جایگزین‌کردنش با «عملیات انجام نشد» کل ارزش
 * دروازه‌ها را از بین می‌برد، چون کاربر نمی‌فهمد چه چیزی را باید رفع کند.
 */
async function postHse(path: string, body: Json, userId: string): Promise<PostResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-user-id": userId },
      body: JSON.stringify(body),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return { ok: false, messageFa: "پاسخ سرور قابل خواندن نبود" };

    const j = await res.json();
    if (j?.ok) return { ok: true, data: j.data };

    const err = j?.error ?? {};
    if (res.status === 401) return { ok: false, messageFa: "برای این عملیات باید وارد شوید" };
    if (res.status === 403) return { ok: false, messageFa: err.message || "نقش شما اجازهٔ این عملیات را ندارد" };

    const details = Array.isArray(err.detailsFa)
      ? err.detailsFa
      : Array.isArray(err.issues)
        ? err.issues.map((i: Json) => i.messageFa ?? i.message ?? String(i))
        : undefined;
    return { ok: false, messageFa: err.message || "عملیات انجام نشد", detailsFa: details };
  } catch {
    return { ok: false, messageFa: "ارتباط با سرور برقرار نشد" };
  }
}

/* ═════════════════════ اجزای مشترک ═════════════════════ */

function Card({ title, sub, children, accent }: {
  title: string;
  sub?: string | null;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate text-[11px] font-light tx1">{title}</div>
        {sub && <div className="shrink-0 text-[9px] font-light tx3">{sub}</div>}
      </div>
      <div className="mt-2" style={accent ? { borderTop: `1px solid ${accent}33`, paddingTop: 8 } : undefined}>
        {children}
      </div>
    </div>
  );
}

type Tone = "danger" | "warn" | "ok" | "mute";

const toneColor = (t?: Tone) =>
  t === "danger" ? "#DC2626" : t === "warn" ? "#D97706" : t === "ok" ? "#059669" : undefined;

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  const c = toneColor(tone);
  return (
    <div className="glass rounded-xl px-3 py-2.5">
      <div className="text-[9px] font-light tx3">{label}</div>
      <div className="mt-0.5 text-[15px] font-light tx1" style={c ? { color: c } : undefined}>{value}</div>
    </div>
  );
}

function Pill({ text, tone }: { text: string; tone?: Tone }) {
  const c = toneColor(tone);
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[9px] font-light"
      style={{ background: c ? `${c}22` : "#88888818", color: c }}
    >
      {text}
    </span>
  );
}

/** فهرست موانع/هشدارها — همان متن موتور، بدون بازنویسی. */
function Notes({ items, tone = "danger" }: { items?: string[] | null; tone?: "danger" | "warn" }) {
  if (!items?.length) return null;
  const c = toneColor(tone);
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((b, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[9.5px] font-light">
          <span className="shrink-0" style={{ color: c }}>{tone === "danger" ? "⛔" : "⚠"}</span>
          <span className="tx2">{b}</span>
        </li>
      ))}
    </ul>
  );
}

function Empty({ fa }: { fa: string }) {
  return <div className="py-6 text-center text-[10px] font-light tx3">{fa}</div>;
}

/** حالت «اجازهٔ دیدن نداری» هرگز نباید شبیه «داده‌ای نیست» باشد. */
function Denied({ rtl, permission, unauth }: { rtl: boolean; permission: string; unauth?: boolean }) {
  return (
    <div className="glass rounded-2xl px-3 py-4 text-center" style={{ borderInlineStart: `3px solid #D97706` }}>
      <div className="text-[11px] font-light tx1">
        {unauth
          ? (rtl ? "برای دیدن این بخش باید وارد شوید" : "Sign in to view this section")
          : (rtl ? "دسترسی به این بخش برای نقش شما تعریف نشده است" : "Your role cannot view this section")}
      </div>
      {!unauth && <div className="mt-1 font-mono text-[9px] font-light tx3">{permission}</div>}
      <div className="mt-1 text-[9px] font-light tx3">
        {rtl ? "اعداد پنهان‌اند، نه صفر." : "Figures are hidden, not zero."}
      </div>
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="glass-row rounded-lg px-2.5 py-1.5 text-[9.5px] font-light tx2 transition hover:tx1"
    >
      {children}
    </button>
  );
}

const num = (n: unknown, d = 2): string =>
  typeof n === "number" && Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(d)) : "—";

/* ═════════════════════ کامپوننت اصلی ═════════════════════ */

export default function HSEWorkspace({ lang, onBack, initialTab }: Props) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [tab, setTab] = useState<HseTab>(initialTab ?? "jsa");

  /* کلیک روی زیرماژول در منو باید تب را عوض کند حتی وقتی کامپوننت
   * از قبل مونت است — بدون این، کاربر روی «حوادث» می‌زند و همان تب
   * قبلی را می‌بیند. */
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const [jsa, setJsa] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [permits, setPermits] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [incidents, setIncidents] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [violations, setViolations] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [training, setTraining] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [ppe, setPpe] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [waste, setWaste] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [env, setEnv] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [vocab, setVocab] = useState<Json | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const q = `?projectId=${PROJECT_ID}`;
    /* همهٔ خواندن‌ها موازی‌اند: نُه درخواست پشت سر هم، صفحه را در
     * شبکهٔ کارگاهی چند ثانیه سفید نگه می‌داشت. */
    const [j, p, i, v, tr, pp, ws, ev, vv] = await Promise.all([
      fetchJson(`/api/hse/jsa${q}`, userId),
      fetchJson(`/api/hse/permit${q}`, userId),
      fetchJson(`/api/hse/incident${q}`, userId),
      fetchJson(`/api/hse/violation${q}`, userId),
      fetchJson(`/api/hse/training/session${q}`, userId),
      fetchJson(`/api/hse/ppe${q}`, userId),
      fetchJson(`/api/hse/waste${q}`, userId),
      fetchJson(`/api/hse/env/reading${q}`, userId),
      fetchJson(`/api/hse/violation-vocab`, userId),
    ]);
    setJsa(j);
    setPermits(p);
    setIncidents(i);
    setViolations(v);
    setTraining(tr);
    setPpe(pp);
    setWaste(ws);
    setEnv(ev);
    setVocab(vv.data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  /* پیام موفقیت خودکار پاک می‌شود؛ پیام خطا می‌ماند تا خوانده شود. */
  useEffect(() => {
    if (notice?.kind !== "ok") return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const act = useCallback(
    async (path: string, body: Json, okFa: string, auditAction: string) => {
      const r = await postHse(path, body, userId);
      if (r.ok) {
        logAudit(auditAction, "HSE", okFa, "info", user ? { name: user.displayName, role: user.role } : undefined);
        setNotice({ kind: "ok", text: okFa });
        await reload();
      } else {
        /* تلاش ناموفق هم ثبت می‌شود: رد شدن یک آزادسازی به همان اندازهٔ
         * پذیرفتنش برای بازرس بیرونی معنا دارد. */
        logAudit(`${auditAction}_DENIED`, "HSE", r.messageFa, "warning",
          user ? { name: user.displayName, role: user.role } : undefined);
        setNotice({ kind: "err", text: r.messageFa, details: r.detailsFa });
      }
      return r;
    },
    [reload, user, userId],
  );

  /* ── شاخص‌های سرصفحه؛ مستقل از تب فعال ── */
  const headline = useMemo(() => {
    const m = incidents.data?.metrics ?? {};
    const ps = permits.data?.summary ?? {};
    const vs = violations.data?.summary ?? {};
    const hidden = "🔒";
    return [
      {
        fa: rtl ? "پروانهٔ معتبر" : "Valid permits",
        value: permits.denied ? hidden : num(ps.activeNow, 0),
        tone: undefined as Tone | undefined,
      },
      {
        fa: rtl ? "پروانهٔ منقضی باز" : "Expired open",
        value: permits.denied ? hidden : num(ps.expiredNotClosed, 0),
        tone: ps.expiredNotClosed > 0 ? ("danger" as Tone) : undefined,
      },
      {
        fa: rtl ? "رویداد باز" : "Open incidents",
        value: incidents.denied ? hidden : num(m.openCount, 0),
        tone: m.openCount > 0 ? ("warn" as Tone) : undefined,
      },
      /* دامنهٔ زمانی در برچسب می‌آید: این LTIFR کل عمر پروژه است، اما
       * تب شاخص‌ها همین نام را برای دورهٔ ماهانه به کار می‌برد. بدون
       * قید، دو عدد متفاوت زیر یک نام روی یک صفحه دیده می‌شود و
       * کاربر یکی را «غلط» می‌پندارد. */
      {
        fa: rtl ? "LTIFR (کل پروژه)" : "LTIFR (life-to-date)",
        value: incidents.denied ? hidden : num(m.ltifr),
        tone: undefined,
      },
      {
        fa: rtl ? "توقف کار فعال" : "Active SWO",
        value: violations.denied ? hidden : num(vs.stopWorkActive, 0),
        tone: violations.denied ? undefined : vs.stopWorkActive > 0 ? ("danger" as Tone) : ("ok" as Tone),
      },
      {
        fa: rtl ? "تخلف معوق" : "Overdue",
        value: violations.denied ? hidden : num(vs.overdue, 0),
        tone: vs.overdue > 0 ? ("warn" as Tone) : undefined,
      },
    ];
  }, [incidents, permits, violations, rtl]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* نوار بالا */}
      <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5">
        <button
          onClick={onBack}
          className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1"
        >
          {rtl ? "→ بازگشت" : "← Back"}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-lg">🦺</span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-light tx1">
              {rtl ? "مدیریت ایمنی، بهداشت و محیط‌زیست" : "Health, Safety & Environment"}
            </div>
            <div className="truncate text-[9.5px] font-light tx3">
              {rtl ? `دامنهٔ d16 · پروژهٔ ${PROJECT_ID}` : `Domain d16 · project ${PROJECT_ID}`}
            </div>
          </div>
        </div>
        {loading && <span className="text-[10px] font-light tx3">{rtl ? "در حال بارگذاری…" : "Loading…"}</span>}
        <button
          onClick={() => void reload()}
          className="glass-row shrink-0 rounded-lg px-3 py-2 text-[10px] font-light tx2 transition hover:tx1"
        >
          {rtl ? "بازخوانی" : "Refresh"}
        </button>
      </div>

      {/* شاخص‌های سرصفحه */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {headline.map((h) => <Stat key={h.fa} label={h.fa} value={h.value} tone={h.tone} />)}
      </div>

      {/* پیام */}
      {notice && (
        <div
          className="glass rounded-2xl px-3 py-2.5"
          style={{ borderInlineStart: `3px solid ${notice.kind === "ok" ? "#059669" : ACCENT}` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10.5px] font-light tx1">{notice.text}</div>
              <Notes items={notice.details} />
            </div>
            <button onClick={() => setNotice(null)} className="shrink-0 text-[11px] font-light tx3 hover:tx1">✕</button>
          </div>
        </div>
      )}

      {/* تب‌ها */}
      <div className="glass flex flex-wrap gap-1 rounded-2xl p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light transition ${
              tab === t.id ? "glass-row tx1" : "tx3 hover:tx2"
            }`}
          >
            <span>{t.icon}</span>
            <span>{rtl ? t.fa : t.en}</span>
          </button>
        ))}
      </div>

      {/* محتوا */}
      <div className="min-h-0 flex-1 overflow-y-auto pe-1">
        {tab === "jsa" && <JsaTab f={jsa} rtl={rtl} />}
        {tab === "permit" && <PermitTab f={permits} rtl={rtl} onAct={act} />}
        {tab === "incident" && <IncidentTab f={incidents} rtl={rtl} onAct={act} />}
        {tab === "violation" && <ViolationTab f={violations} vocab={vocab} rtl={rtl} onAct={act} userId={userId} />}
        {tab === "training" && (
          <TrainingTab training={training} ppe={ppe} waste={waste} env={env} rtl={rtl} userId={userId} />
        )}
        {tab === "dashboard" && (
          <DashboardTab incidents={incidents} violations={violations} permits={permits} rtl={rtl} userId={userId} />
        )}
      </div>
    </div>
  );
}

type ActFn = (p: string, b: Json, ok: string, a: string) => Promise<PostResult>;

/* ═════════════════════ تب ۱ — ارزیابی ریسک ═════════════════════ */

function JsaTab({ f, rtl }: { f: Fetched; rtl: boolean }) {
  if (f.denied) return <Denied rtl={rtl} permission="hse.jsa.view" unauth={f.unauth} />;
  const items: Json[] = f.data?.items ?? [];
  if (!items.length) return <Empty fa={rtl ? "هنوز ارزیابی ریسکی ثبت نشده است" : "No risk assessments"} />;

  return (
    <div className="space-y-2">
      {items.map((j) => {
        const s: Json = j.summary ?? {};
        /* «ریسک بالای باقیمانده» جمع دو باند high و extreme است — هر دو
         * در استاندارد نیازمند تأیید سطح بالاترند. */
        const highResidual = (s.byBand?.high ?? 0) + (s.byBand?.extreme ?? 0);
        return (
          <Card key={j.Id} title={`${j.JsaNo} — ${j.TitleFa}`} sub={j.statusFa} accent={ACCENT}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Pill
                text={j.isUsable ? (rtl ? "قابل استناد" : "Usable") : (rtl ? "غیرقابل استناد" : "Not usable")}
                tone={j.isUsable ? "ok" : "danger"}
              />
              {typeof j.expiresInDays === "number" && (
                <Pill
                  text={
                    j.expiresInDays < 0
                      ? (rtl ? `${Math.abs(j.expiresInDays)} روز منقضی` : `Expired ${Math.abs(j.expiresInDays)}d`)
                      : (rtl ? `${j.expiresInDays} روز تا انقضا` : `${j.expiresInDays}d left`)
                  }
                  tone={j.expiresInDays < 0 ? "danger" : j.expiresInDays <= 7 ? "warn" : "mute"}
                />
              )}
              {j.LocationFa && <Pill text={j.LocationFa} tone="mute" />}
              {/* رنگ باند ریسک از موتور می‌آید تا با ماتریس ریسک یکی بماند. */}
              {s.maxResidualBand && (
                <span
                  className="rounded-md px-1.5 py-0.5 text-[9px] font-light"
                  style={{ background: `${s.maxResidualBand.color}22`, color: s.maxResidualBand.color }}
                >
                  {rtl ? `بیشینهٔ ریسک باقیمانده: ${s.maxResidualBand.fa}` : `Max residual: ${s.maxResidualBand.code}`}
                  {s.maxResidualRisk != null ? ` (${s.maxResidualRisk})` : ""}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label={rtl ? "گام کاری" : "Steps"} value={num(s.steps, 0)} />
              <Stat label={rtl ? "خطر" : "Hazards"} value={num(s.hazards, 0)} />
              <Stat label={rtl ? "کنترل" : "Controls"} value={num(s.controls, 0)} />
              <Stat
                label={rtl ? "ریسک بالای باقیمانده" : "High residual"}
                value={highResidual}
                tone={highResidual > 0 ? "danger" : "ok"}
              />
              <Stat
                label={rtl ? "خطر بدون کنترل" : "Uncontrolled"}
                value={num(s.hazardsWithoutControl, 0)}
                tone={s.hazardsWithoutControl > 0 ? "danger" : "ok"}
              />
            </div>
            {/* اتکای صرف به تجهیزات حفاظت فردی برای ریسک بالا — پایین‌ترین
                ردهٔ سلسله‌مراتب کنترل؛ موتور آن را هشدار می‌دهد. */}
            <Notes items={s.warningsFa} tone="warn" />
          </Card>
        );
      })}
    </div>
  );
}

/* ═════════════════════ تب ۲ — پروانهٔ کار ═════════════════════ */

function PermitTab({ f, rtl, onAct }: { f: Fetched; rtl: boolean; onAct: ActFn }) {
  if (f.denied) return <Denied rtl={rtl} permission="hse.permit.view" unauth={f.unauth} />;
  const items: Json[] = f.data?.items ?? [];
  const s: Json = f.data?.summary ?? {};

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={rtl ? "کل" : "Total"} value={num(s.total, 0)} />
        <Stat label={rtl ? "معتبر اکنون" : "Valid now"} value={num(s.activeNow, 0)} tone="ok" />
        <Stat
          label={rtl ? "کمتر از ۴ ساعت" : "Expiring <4h"}
          value={num(s.expiringSoon, 0)}
          tone={s.expiringSoon > 0 ? "warn" : undefined}
        />
        <Stat
          label={rtl ? "منقضی بسته‌نشده" : "Expired open"}
          value={num(s.expiredNotClosed, 0)}
          tone={s.expiredNotClosed > 0 ? "danger" : "ok"}
        />
        <Stat
          label={rtl ? "گازسنجی ناایمن" : "Unsafe gas"}
          value={num(s.unsafeGasTests, 0)}
          tone={s.unsafeGasTests > 0 ? "danger" : "ok"}
        />
      </div>
      <Notes items={s.warningsFa} tone="warn" />

      {!items.length && <Empty fa={rtl ? "پروانهٔ کاری ثبت نشده است" : "No work permits"} />}

      {items.map((p) => {
        const eff = p.effectiveStatus;
        const tone: Tone = eff === "active" ? "ok" : eff === "expired" ? "danger" : "mute";
        const gas: Json | null = p.gasTest;
        return (
          <Card key={p.Id} title={`${p.PermitNo} — ${p.TitleFa}`} sub={p.typeFa} accent={ACCENT}>
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill text={p.statusFa} tone={tone} />
              {p.isHighRisk && <Pill text={rtl ? "پرخطر" : "High risk"} tone="danger" />}
              {p.isValidNow === false && eff === "active" && (
                <Pill text={rtl ? "خارج از بازهٔ اعتبار" : "Outside window"} tone="warn" />
              )}
              {typeof p.expiresInHours === "number" && (
                <Pill
                  text={rtl ? `${p.expiresInHours} ساعت باقی` : `${p.expiresInHours}h left`}
                  tone={p.expiresInHours < 0 ? "danger" : p.expiresInHours <= 4 ? "warn" : "mute"}
                />
              )}
              {p.SystemId && <Pill text={`${rtl ? "سیستم" : "System"} ${p.SystemId}`} tone="mute" />}
              {gas && (
                <Pill
                  text={
                    gas.isSafe === false
                      ? (rtl ? "گازسنجی ناایمن" : "Gas unsafe")
                      : gas.isFresh === false
                        ? (rtl ? `گازسنجی کهنه (${gas.ageMinutes}′)` : `Gas stale (${gas.ageMinutes}′)`)
                        : (rtl ? "گازسنجی ایمن" : "Gas safe")
                  }
                  tone={gas.isSafe === false ? "danger" : gas.isFresh === false ? "warn" : "ok"}
                />
              )}
              {p.isolation?.applied > 0 && (
                <Pill
                  text={rtl ? `${p.isolation.applied} قفل اعمال‌شده` : `${p.isolation.applied} locks applied`}
                  tone={p.isolation.allApplied ? "ok" : "warn"}
                />
              )}
            </div>

            {/* قفل برنامه‌ریزی‌شده‌ای که اعمال نشده یعنی انرژی هنوز زنده است. */}
            <Notes items={p.isolation?.missingLockFa} />

            {/* دکمه‌ها بر پایهٔ وضعیت مؤثر نشان داده می‌شوند، ولی تصمیم
                نهایی با موتور است (canSuspendPermit / canResumePermit). */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {eff === "active" && (
                <Btn
                  onClick={() => {
                    const reasonFa = window.prompt(rtl ? "دلیل تعلیق پروانه:" : "Suspension reason:")?.trim();
                    if (!reasonFa) return; /* دلیل الزامی است؛ درخواست بی‌دلیل نمی‌فرستیم. */
                    void onAct(
                      `/api/hse/permit/${p.Id}/suspend`,
                      { reasonFa },
                      rtl ? `پروانهٔ ${p.PermitNo} معلق شد` : "Permit suspended",
                      "HSE_PERMIT_SUSPEND",
                    );
                  }}
                >
                  {rtl ? "تعلیق" : "Suspend"}
                </Btn>
              )}
              {eff === "suspended" && (
                <Btn
                  onClick={() =>
                    void onAct(
                      `/api/hse/permit/${p.Id}/resume`,
                      {},
                      rtl ? `پروانهٔ ${p.PermitNo} از سر گرفته شد` : "Permit resumed",
                      "HSE_PERMIT_RESUME",
                    )
                  }
                >
                  {rtl ? "ازسرگیری" : "Resume"}
                </Btn>
              )}
            </div>
            {p.SuspendReasonFa && (
              <div className="mt-1.5 text-[9.5px] font-light tx3">
                {rtl ? "دلیل تعلیق: " : "Reason: "}{p.SuspendReasonFa}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ═════════════════════ تب ۳ — حوادث ═════════════════════ */

function IncidentTab({ f, rtl, onAct }: { f: Fetched; rtl: boolean; onAct: ActFn }) {
  if (f.denied) return <Denied rtl={rtl} permission="hse.incident.record" unauth={f.unauth} />;
  const items: Json[] = f.data?.items ?? [];
  if (!items.length) return <Empty fa={rtl ? "رویداد ایمنی ثبت نشده است" : "No safety incidents"} />;

  return (
    <div className="space-y-2">
      {items.map((i) => {
        const flash: Json = i.flashReport ?? {};
        const inv: Json = i.requiresInvestigation ?? {};
        return (
          <Card key={i.Id} title={`${i.IncidentNo} — ${i.TitleFa}`} sub={i.typeFa} accent={ACCENT}>
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill
                text={i.severityFa}
                tone={i.Severity === "critical" || i.Severity === "high" ? "danger" : "warn"}
              />
              <Pill
                text={i.Status === "closed" ? (rtl ? "بسته" : "Closed") : (rtl ? "باز" : "Open")}
                tone={i.Status === "closed" ? "ok" : "warn"}
              />
              {i.injuredCount > 0 && (
                <Pill text={rtl ? `${i.injuredCount} مصدوم` : `${i.injuredCount} injured`} tone="danger" />
              )}
              {/* مهلت گزارش فوری ۱۵ دقیقه است؛ تأخیر خودش یک عدم‌انطباق است. */}
              <Pill
                text={flash.statusFa ?? (rtl ? "نامشخص" : "Unknown")}
                tone={!flash.reported ? "danger" : flash.withinSla === false ? "warn" : "ok"}
              />
              {i.investigationStatus && (
                <Pill text={`${rtl ? "تحقیق" : "Investigation"}: ${i.investigationStatus}`} tone="mute" />
              )}
              {i.LocationFa && <Pill text={i.LocationFa} tone="mute" />}
            </div>

            {/* رویدادی که تحقیق لازم دارد و تحقیق ندارد = بدهی باز. */}
            {inv.required && !i.investigationStatus && <Notes items={[inv.reasonFa]} tone="warn" />}

            {flash.reported === false && (
              <div className="mt-2">
                <Btn
                  onClick={() =>
                    void onAct(
                      `/api/hse/incident/${i.Id}/flash-report`,
                      {},
                      rtl ? `گزارش فوری ${i.IncidentNo} ثبت شد` : "Flash report recorded",
                      "HSE_FLASH_REPORT",
                    )
                  }
                >
                  {rtl ? "ثبت گزارش فوری" : "Record flash report"}
                </Btn>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ═════════════════════ تب ۴ — بازرسی و توقف کار ═════════════════════ */

function ViolationTab({
  f, vocab, rtl, onAct, userId,
}: { f: Fetched; vocab: Json | null; rtl: boolean; onAct: ActFn; userId: string }) {
  const [onlyStopWork, setOnlyStopWork] = useState(false);
  /* نتیجهٔ بررسی خشک به‌ازای هر تخلف، تا موانع در خود کارت بمانند و
   * کاربر بتواند بخواندشان — پنجرهٔ alert متن فارسی چندسطری را بد
   * نشان می‌دهد و با بستنش همه‌چیز از دست می‌رود. */
  const [checked, setChecked] = useState<Record<string, { ok: boolean; blockersFa: string[] }>>({});

  /* بررسی خشک عمداً نه پیام موفقیت می‌دهد و نه در سیاههٔ ممیزی ثبت
   * می‌شود: چیزی را تغییر نداده است. فقط آزادسازی واقعی ثبت می‌شود. */
  const onRelease = async (v: Json) => {
    const probe = await postHse(`/api/hse/violation/${v.Id}/release`, { dryRun: true }, userId);
    if (!probe.ok) {
      setChecked((c) => ({ ...c, [v.Id]: { ok: false, blockersFa: [probe.messageFa, ...(probe.detailsFa ?? [])] } }));
      return;
    }
    const verdict = (probe.data as Json)?.verdict ?? {};
    if (!verdict.ok) {
      setChecked((c) => ({ ...c, [v.Id]: { ok: false, blockersFa: verdict.blockersFa ?? [] } }));
      return;
    }
    setChecked((c) => ({ ...c, [v.Id]: { ok: true, blockersFa: [] } }));
    if (!window.confirm(rtl ? `تخلف ${v.ViolationNo} آزاد و بسته شود؟` : "Release and close?")) return;
    await onAct(
      `/api/hse/violation/${v.Id}/release`,
      {},
      rtl ? `تخلف ${v.ViolationNo} آزاد شد` : "Violation released",
      "HSE_VIOLATION_RELEASE",
    );
  };

  if (f.denied) return <Denied rtl={rtl} permission="hse.violation.issue" unauth={f.unauth} />;
  const items: Json[] = f.data?.items ?? [];
  const s: Json = f.data?.summary ?? {};
  const shown = onlyStopWork ? items.filter((v) => v.state?.isBlocking) : items;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={rtl ? "کل تخلف" : "Total"} value={num(s.total, 0)} />
        <Stat label={rtl ? "باز" : "Open"} value={num(s.open, 0)} tone={s.open > 0 ? "warn" : "ok"} />
        <Stat
          label={rtl ? "توقف کار فعال" : "Active SWO"}
          value={num(s.stopWorkActive, 0)}
          tone={s.stopWorkActive > 0 ? "danger" : "ok"}
        />
        <Stat label={rtl ? "معوق" : "Overdue"} value={num(s.overdue, 0)} tone={s.overdue > 0 ? "warn" : undefined} />
        <Stat
          label={rtl ? "جریمه" : "Fines"}
          value={typeof s.totalFine === "number" ? s.totalFine.toLocaleString(rtl ? "fa-IR" : "en-US") : "—"}
        />
      </div>

      {/* دستور توقفی که دامنه‌اش ناقص است در آمار «فعال» شمرده می‌شود ولی
          هیچ فعالیتی را قفل نمی‌کند — یافتهٔ لوپ ۵ خودارزیابی D6. */}
      {s.stopWorkUnenforceable > 0 && (
        <Card title={rtl ? "دستور توقف کار بی‌اثر" : "Unenforceable stop-work"} accent="#D97706">
          <Notes items={s.unenforceableFa} tone="warn" />
        </Card>
      )}

      {s.repeatOffendersFa?.length > 0 && (
        <Card title={rtl ? "پیمانکار با تخلف تکراری" : "Repeat offenders"} accent="#D97706">
          <div className="flex flex-wrap gap-1.5">
            {s.repeatOffendersFa.map((t: string, i: number) => <Pill key={i} text={t} tone="warn" />)}
          </div>
        </Card>
      )}
      <Notes items={s.warningsFa} tone="warn" />

      <label className="flex cursor-pointer items-center gap-2 px-1 text-[10px] font-light tx2">
        <input type="checkbox" checked={onlyStopWork} onChange={(e) => setOnlyStopWork(e.target.checked)} />
        {rtl ? "فقط دستورهای توقف کار" : "Stop-work only"}
      </label>

      {!shown.length && <Empty fa={rtl ? "موردی برای نمایش نیست" : "Nothing to show"} />}

      {shown.map((v) => {
        const st: Json = v.state ?? {};
        return (
          <Card key={v.Id} title={`${v.ViolationNo} — ${v.TitleFa}`} sub={v.typeFa} accent={ACCENT}>
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill text={st.statusFa ?? v.statusFa} tone={st.isOpen ? "warn" : "ok"} />
              <Pill text={v.severityFa} tone={v.Severity === "critical" ? "danger" : "mute"} />
              {st.isBlocking && (
                <Pill
                  text={`${rtl ? "توقف کار" : "SWO"}${v.scopeFa ? ` · ${v.scopeFa}` : ""}`}
                  tone={st.isEnforceable === false ? "warn" : "danger"}
                />
              )}
              {st.isBlocking && st.isEnforceable === false && (
                <Pill text={rtl ? "بی‌اثر" : "Unenforceable"} tone="warn" />
              )}
              {st.isOverdue && <Pill text={st.slaFa} tone="warn" />}
              {v.ContractorFa && <Pill text={v.ContractorFa} tone="mute" />}
              {v.AreaFa && <Pill text={v.AreaFa} tone="mute" />}
            </div>

            {st.enforcementIssueFa && <Notes items={[st.enforcementIssueFa]} tone="warn" />}

            {/* آزادسازی مجوز جدا دارد (`hse.violation.release`، دست تضمین
                کیفیت) و صادرکنندهٔ تخلف نمی‌تواند خودش آزاد کند. دکمه را
                نشان می‌دهیم و پیام ۴۰۳ سرور تفکیک وظیفه را توضیح می‌دهد. */}
            {st.isOpen && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Btn
                  onClick={() => {
                    const evidenceFa = window.prompt(rtl ? "شرح مستند بازبینی:" : "Re-inspection evidence:")?.trim();
                    if (!evidenceFa) return;
                    void onAct(
                      `/api/hse/violation/${v.Id}/re-inspect`,
                      { isSatisfactory: true, evidenceFa },
                      rtl ? `بازبینی ${v.ViolationNo} ثبت شد` : "Re-inspection recorded",
                      "HSE_VIOLATION_REINSPECT",
                    );
                  }}
                >
                  {rtl ? "ثبت بازبینی موفق" : "Record re-inspection"}
                </Btn>
                {/* پیش از آزادسازی، حالت خشک را می‌پرسیم تا کاربر فهرست
                    موانع را ببیند بدون آنکه چیزی تغییر کند. */}
                <Btn onClick={() => void onRelease(v)}>
                  {rtl ? "بررسی و آزادسازی" : "Check & release"}
                </Btn>
              </div>
            )}

            {checked[v.Id] && !checked[v.Id].ok && (
              <div className="mt-1.5">
                <div className="text-[9.5px] font-light" style={{ color: "#DC2626" }}>
                  {rtl ? "آزادسازی ممکن نیست:" : "Cannot release:"}
                </div>
                <Notes items={checked[v.Id].blockersFa} />
              </div>
            )}
          </Card>
        );
      })}

      {/* راهنمای الزام — از واژگان سرور خوانده می‌شود، هاردکد نیست. */}
      {vocab?.violationTypes && (
        <Card title={rtl ? "انواع تخلف · قرمز = توقف کار اجباری" : "Violation types · red = mandatory SWO"}>
          <div className="flex flex-wrap gap-1.5">
            {vocab.violationTypes.map((t: Json) => (
              <Pill key={t.code} text={t.titleFa} tone={t.mandatoryStopWork ? "danger" : "mute"} />
            ))}
          </div>
          {vocab.slaDays && (
            <div className="mt-2 text-[9px] font-light tx3">
              {rtl
                ? `مهلت رفع بر پایهٔ شدت — بحرانی: ${vocab.slaDays.critical} روز · بالا: ${vocab.slaDays.high} · متوسط: ${vocab.slaDays.medium} · پایین: ${vocab.slaDays.low}`
                : `SLA days — critical: ${vocab.slaDays.critical}, high: ${vocab.slaDays.high}, medium: ${vocab.slaDays.medium}, low: ${vocab.slaDays.low}`}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ═════════════════════ تب ۵ — آموزش و محیط‌زیست ═════════════════════ */

/**
 * زیرماژول ۰۸٫۵ — آموزش، بهداشت شغلی و محیط‌زیست.
 *
 * چهار حوزه در یک تب جمع شده‌اند چون هر چهار، ورودیِ یک تصمیم واحدند:
 * آیا این فرد می‌تواند وارد جبههٔ کاری شود و آیا کارگاه از نظر
 * محیط‌زیستی منطبق است.
 *
 * دسترسی هر بخش جداست (`hse.training.view`, `hse.ppe.issue`,
 * `hse.env.view`)، پس هر بخش ۴۰۳ خودش را جدا نشان می‌دهد؛ اگر همه را
 * یکجا پنهان می‌کردیم، مدیر پروژه که فقط اجازهٔ محیط‌زیست دارد صفحه را
 * خالی می‌دید.
 */
function TrainingTab({
  training, ppe, waste, env, rtl, userId,
}: {
  training: Fetched; ppe: Fetched; waste: Fetched; env: Fetched; rtl: boolean; userId: string;
}) {
  type Sub = "training" | "ppe" | "waste" | "env" | "clearance";
  const [sub, setSub] = useState<Sub>("training");

  const SUBS: { id: Sub; fa: string; en: string }[] = [
    { id: "training", fa: "جلسات آموزش", en: "Training" },
    { id: "ppe", fa: "تجهیزات حفاظت فردی", en: "PPE" },
    { id: "clearance", fa: "مجوز ورود فرد", en: "Site clearance" },
    { id: "waste", fa: "پسماند", en: "Waste" },
    { id: "env", fa: "پایش زیست‌محیطی", en: "Monitoring" },
  ];

  return (
    <div className="space-y-2">
      <div className="glass flex flex-wrap gap-1 rounded-xl p-1">
        {SUBS.map((x) => (
          <button
            key={x.id}
            onClick={() => setSub(x.id)}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-light transition ${
              sub === x.id ? "glass-row tx1" : "tx3 hover:tx2"
            }`}
          >
            {rtl ? x.fa : x.en}
          </button>
        ))}
      </div>

      {sub === "training" && <TrainingSessions f={training} rtl={rtl} />}
      {sub === "ppe" && <PpeSection f={ppe} rtl={rtl} />}
      {sub === "clearance" && <ClearanceProbe rtl={rtl} userId={userId} />}
      {sub === "waste" && <WasteSection f={waste} rtl={rtl} />}
      {sub === "env" && <EnvSection f={env} rtl={rtl} />}
    </div>
  );
}

function TrainingSessions({ f, rtl }: { f: Fetched; rtl: boolean }) {
  if (f.denied) return <Denied rtl={rtl} permission="hse.training.view" unauth={f.unauth} />;
  const items: Json[] = f.data?.items ?? [];
  const s: Json = f.data?.summary ?? {};

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={rtl ? "جلسه" : "Sessions"} value={num(s.totalSessions, 0)} />
        <Stat label={rtl ? "برگزارشده" : "Held"} value={num(s.heldSessions, 0)} />
        <Stat label={rtl ? "نفرساعت آموزش" : "Training man-hours"} value={num(s.totalManHours, 0)} />
        <Stat label={rtl ? "افراد آموزش‌دیده" : "Persons"} value={num(s.uniquePersons, 0)} />
        {/* گواهی منقضی یعنی فرد امروز حق ورود ندارد — پس قرمز، نه خاکستری. */}
        <Stat
          label={rtl ? "گواهی منقضی" : "Expired certs"}
          value={num(s.expiredCertificates, 0)}
          tone={s.expiredCertificates > 0 ? "danger" : "ok"}
        />
      </div>

      {s.expiringSoonCertificates > 0 && (
        <Card title={rtl ? "گواهی‌های نزدیک به انقضا" : "Certificates expiring soon"} accent="#D97706">
          <div className="text-[10px] font-light tx2">
            {rtl
              ? `${num(s.expiringSoonCertificates, 0)} گواهی تا ۳۰ روز آینده منقضی می‌شود.`
              : `${num(s.expiringSoonCertificates, 0)} certificates expire within 30 days.`}
          </div>
          <Notes items={s.warningsFa} tone="warn" />
        </Card>
      )}

      {!items.length ? (
        <Empty fa={rtl ? "هنوز جلسهٔ آموزشی ثبت نشده است" : "No training sessions"} />
      ) : (
        <div className="space-y-2">
          {items.map((t) => {
            const st: Json = t.state ?? {};
            return (
              <Card
                key={t.Id}
                title={`${t.SessionNo} — ${t.TitleFa}`}
                sub={st.statusFa ?? t.Status}
                accent={st.isExpired ? ACCENT : undefined}
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Stat label={rtl ? "ثبت‌نام" : "Registered"} value={num(st.registered, 0)} />
                  <Stat label={rtl ? "حاضر" : "Attended"} value={num(st.attended, 0)} />
                  <Stat
                    label={rtl ? "نرخ حضور" : "Attendance"}
                    value={`${num(st.attendanceRatePct, 1)}٪`}
                    tone={st.attendanceRatePct < 70 ? "warn" : undefined}
                  />
                  {/* نرخ قبولی روی حاضران است نه ثبت‌نام‌شدگان: غایب را
                      مردود حساب‌کردن آمار آموزش را بی‌معنا می‌کند. */}
                  <Stat
                    label={rtl ? "نرخ قبولی" : "Pass rate"}
                    value={`${num(st.passRatePct, 1)}٪`}
                    tone={st.passRatePct < 70 ? "warn" : "ok"}
                  />
                  <Stat label={rtl ? "نفرساعت" : "Man-hours"} value={num(st.manHours, 1)} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill text={st.typeFa ?? t.TrainingType} />
                  {t.CourseCode && <Pill text={t.CourseCode} tone="mute" />}
                  {st.certificateExpiry && (
                    <Pill
                      text={rtl ? `اعتبار تا ${st.certificateExpiry}` : `Valid to ${st.certificateExpiry}`}
                      tone={st.isExpired ? "danger" : st.isExpiringSoon ? "warn" : "ok"}
                    />
                  )}
                  {!t.ValidityMonths && <Pill text={rtl ? "بدون انقضا" : "No expiry"} tone="mute" />}
                </div>
                <Notes items={st.warningsFa} tone="warn" />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PpeSection({ f, rtl }: { f: Fetched; rtl: boolean }) {
  if (f.denied) return <Denied rtl={rtl} permission="hse.ppe.view" unauth={f.unauth} />;
  const items: Json[] = f.data?.items ?? [];
  const s: Json = f.data?.summary ?? {};

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={rtl ? "کل تحویل" : "Issuances"} value={num(s.totalIssuances, 0)} />
        <Stat label={rtl ? "در اختیار" : "Active"} value={num(s.activeIssuances, 0)} />
        <Stat
          label={rtl ? "تعویض معوق" : "Overdue"}
          value={num(s.overdueReplacement, 0)}
          tone={s.overdueReplacement > 0 ? "danger" : "ok"}
        />
        <Stat
          label={rtl ? "تعویض نزدیک" : "Due soon"}
          value={num(s.dueSoonReplacement, 0)}
          tone={s.dueSoonReplacement > 0 ? "warn" : undefined}
        />
        <Stat
          label={rtl ? "هزینهٔ تجهیزات" : "PPE cost"}
          value={typeof s.totalPpeCost === "number" ? s.totalPpeCost.toLocaleString(rtl ? "fa-IR" : "en-US") : "—"}
        />
      </div>

      {/* وضعیت سلامت از همان خلاصه می‌آید چون معاینه و تجهیز هر دو
          شرط ورودند و جدا نشان‌دادنشان کاربر را وادار می‌کرد دو صفحه را
          کنار هم بگذارد. */}
      <Card title={rtl ? "طب کار" : "Occupational health"}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={rtl ? "معاینه" : "Exams"} value={num(s.totalExams, 0)} />
          <Stat label={rtl ? "مجاز به کار" : "Fit"} value={num(s.byFitness?.fit, 0)} tone="ok" />
          <Stat
            label={rtl ? "مشروط" : "Restricted"}
            value={num(s.byFitness?.fit_with_restriction, 0)}
            tone={s.byFitness?.fit_with_restriction > 0 ? "warn" : undefined}
          />
          <Stat
            label={rtl ? "غیرمجاز" : "Unfit"}
            value={num(s.byFitness?.unfit, 0)}
            tone={s.byFitness?.unfit > 0 ? "danger" : "ok"}
          />
        </div>
        {/* معاینهٔ معوق یعنی فرد امروز روی کاغذ سالم است ولی سنجهٔ
            پشتش کهنه شده — این با «غیرمجاز» فرق دارد و باید جدا دیده شود. */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat
            label={rtl ? "معاینهٔ معوق" : "Overdue exams"}
            value={num(s.overdueExams, 0)}
            tone={s.overdueExams > 0 ? "danger" : "ok"}
          />
          <Stat
            label={rtl ? "معاینهٔ نزدیک" : "Exams due soon"}
            value={num(s.dueSoonExams, 0)}
            tone={s.dueSoonExams > 0 ? "warn" : undefined}
          />
        </div>
        {/* نام فرد غیرمجاز باید دیده شود، وگرنه عدد «۱ نفر غیرمجاز»
            کسی را از جبههٔ کاری بیرون نمی‌آورد. */}
        <Notes items={s.unfitPersons?.length ? [
          (rtl ? "افراد غیرمجاز به کار: " : "Unfit persons: ") + s.unfitPersons.join("، "),
        ] : null} />
        <Notes items={s.warningsFa} tone="warn" />
      </Card>

      {!items.length ? (
        <Empty fa={rtl ? "هنوز تجهیزی تحویل نشده است" : "No PPE issued"} />
      ) : (
        <Card title={rtl ? "آخرین تحویل‌ها" : "Recent issuances"}>
          <div className="space-y-1">
            {items.slice(-25).reverse().map((i) => (
              <div key={i.Id} className="glass-row flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] font-light tx1">{i.PersonNameFa}</span>
                <Pill text={i.typeFa ?? i.PpeType} tone={i.isCritical ? "danger" : "mute"} />
                <Pill text={i.statusFa ?? i.Status} tone={i.Status === "issued" ? "ok" : "mute"} />
                <span className="font-mono text-[9px] font-light tx3">{i.IssueNo}</span>
                {i.ReplaceDueDate && (
                  <span className="text-[9px] font-light tx3">
                    {rtl ? `تعویض تا ${i.ReplaceDueDate}` : `Replace by ${i.ReplaceDueDate}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * استعلام دروازهٔ ورود.
 *
 * نتیجه سه بُعدی است و همان چیزی است که گیت `hseTraining` در ماژول
 * منابع انسانی می‌خواند. عمداً هیچ جزئیات پزشکی نشان داده نمی‌شود —
 * فقط «مجاز/غیرمجاز» و علت.
 */
function ClearanceProbe({ rtl, userId }: { rtl: boolean; userId: string }) {
  const { user } = useAuth();
  const [person, setPerson] = useState("");
  const [res, setRes] = useState<Fetched | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const ref = person.trim();
    if (!ref) return;
    setBusy(true);
    const out = await fetchJson(
      `/api/hse/clearance/${encodeURIComponent(ref)}?projectId=${PROJECT_ID}`,
      userId,
    );
    setRes(out);
    setBusy(false);

    /* استعلام دروازه تصمیمی دربارهٔ ورود یک انسان به محیط پرخطر است.
     * اگر بعداً حادثه‌ای رخ دهد، باید معلوم باشد چه کسی چه زمانی چه
     * پاسخی گرفته — پس هم پاسخ مثبت و هم منفی ثبت می‌شود. */
    if (out.denied) return;
    const verdict = (out.data as Json | null)?.clearance;
    if (!verdict) return;
    logAudit(
      verdict.ok ? "HSE_CLEARANCE_PASS" : "HSE_CLEARANCE_BLOCK",
      "HSE",
      verdict.ok
        ? `استعلام مجوز ورود ${ref}: مجاز`
        : `استعلام مجوز ورود ${ref}: غیرمجاز — ${(verdict.blockersFa ?? []).join("؛ ")}`,
      verdict.ok ? "info" : "warning",
      user ? { name: user.displayName, role: user.role } : undefined,
    );
  };

  const c: Json = res?.data?.clearance ?? {};

  return (
    <div className="space-y-2">
      <Card title={rtl ? "استعلام مجوز ورود به کارگاه" : "Site entry clearance"}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void run(); }}
            placeholder={rtl ? "شناسهٔ فرد" : "Person ref"}
            className="glass-row min-w-40 flex-1 rounded-lg px-2.5 py-1.5 text-[10px] font-light tx1 outline-none"
          />
          <Btn onClick={() => void run()}>{busy ? (rtl ? "…" : "…") : rtl ? "استعلام" : "Check"}</Btn>
        </div>
        <div className="mt-1.5 text-[9px] font-light tx3">
          {rtl
            ? "سه شرط آموزش، تجهیزات و سلامت با «و» ترکیب می‌شوند؛ افتادن یکی، ورود را می‌بندد."
            : "Training, PPE and health are ANDed; failing one blocks entry."}
        </div>
      </Card>

      {res?.denied && <Denied rtl={rtl} permission="hse.clearance.check" unauth={res.unauth} />}

      {res && !res.denied && res.data && (
        <Card
          title={c.ok ? (rtl ? "مجاز به ورود" : "Cleared") : rtl ? "غیرمجاز — ورود مسدود" : "Not cleared"}
          accent={c.ok ? "#059669" : ACCENT}
        >
          <div className="grid grid-cols-3 gap-2">
            <Stat label={rtl ? "آموزش" : "Training"} value={c.training?.ok ? "✓" : "✕"} tone={c.training?.ok ? "ok" : "danger"} />
            <Stat label={rtl ? "تجهیزات" : "PPE"} value={c.ppe?.ok ? "✓" : "✕"} tone={c.ppe?.ok ? "ok" : "danger"} />
            <Stat label={rtl ? "سلامت" : "Health"} value={c.health?.ok ? "✓" : "✕"} tone={c.health?.ok ? "ok" : "danger"} />
          </div>
          <Notes items={c.blockersFa} />
          <Notes items={c.warningsFa} tone="warn" />
        </Card>
      )}
    </div>
  );
}

function WasteSection({ f, rtl }: { f: Fetched; rtl: boolean }) {
  if (f.denied) return <Denied rtl={rtl} permission="hse.env.view" unauth={f.unauth} />;
  const items: Json[] = f.data?.items ?? [];
  const s: Json = f.data?.summary ?? {};
  const byUnit: Record<string, number> = s.quantityByUnit ?? {};
  const recycledByUnit: Record<string, number> = s.recycledQuantityByUnit ?? {};

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={rtl ? "سیاههٔ پسماند" : "Waste logs"} value={num(s.total, 0)} />
        <Stat label={rtl ? "دفع‌شده" : "Disposed"} value={num(s.byStatus?.disposed, 0)} />
        <Stat
          label={rtl ? "بدون مانیفست" : "Missing manifest"}
          value={num(s.missingManifest, 0)}
          tone={s.missingManifest > 0 ? "danger" : "ok"}
        />
        <Stat
          label={rtl ? "کهنه (بیش از ۹۰ روز)" : "Stale"}
          value={num(s.staleCount, 0)}
          tone={s.staleCount > 0 ? "warn" : undefined}
        />
      </div>

      {/* مقادیر به تفکیک واحد می‌مانند: جمع‌کردن لیتر و تن یک عدد
          بی‌معنا می‌سازد که در گزارش محیط‌زیستی قابل دفاع نیست. */}
      <Card title={rtl ? "مقدار به تفکیک واحد" : "Quantity by unit"}>
        {Object.keys(byUnit).length === 0 ? (
          <div className="text-[10px] font-light tx3">{rtl ? "—" : "—"}</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(byUnit).map(([u, q]) => (
              <Stat
                key={u}
                label={u}
                value={`${num(q, 1)}${recycledByUnit[u] ? ` · ${rtl ? "بازیافت" : "rec."} ${num(recycledByUnit[u], 1)}` : ""}`}
              />
            ))}
          </div>
        )}
        <Notes items={s.warningsFa} tone="warn" />
      </Card>

      {/* فهرست نامنطبق‌ها بالای صفحه می‌آید: در سیاههٔ بلند، ردیف
          نامنطبق پایین فهرست گم می‌شود و همان چیزی است که بازرس
          محیط‌زیست اول سراغش می‌آید. */}
      {Array.isArray(s.nonCompliantFa) && s.nonCompliantFa.length > 0 && (
        <Card title={rtl ? "ردیف‌های نامنطبق" : "Non-compliant logs"} accent={ACCENT}>
          <Notes items={s.nonCompliantFa} />
        </Card>
      )}

      {!items.length ? (
        <Empty fa={rtl ? "هنوز پسماندی ثبت نشده است" : "No waste logs"} />
      ) : (
        <Card title={rtl ? "سیاهه‌ها" : "Logs"}>
          <div className="space-y-1">
            {items.slice(-25).reverse().map((w) => {
              const st: Json = w.state ?? {};
              return (
                <div key={w.Id} className="glass-row rounded-lg px-2.5 py-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] font-light tx3">{w.WasteNo}</span>
                    <span className="text-[10px] font-light tx1">{w.DescriptionFa}</span>
                    <Pill text={st.typeFa ?? w.WasteType} tone={st.needsManifest ? "warn" : "mute"} />
                    <Pill text={st.statusFa ?? w.Status} />
                    <span className="text-[9px] font-light tx3">{num(w.Quantity, 1)} {w.Unit}</span>
                    {!st.isCompliant && <Pill text={rtl ? "نامنطبق" : "Non-compliant"} tone="danger" />}
                  </div>
                  <Notes items={st.issuesFa} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function EnvSection({ f, rtl }: { f: Fetched; rtl: boolean }) {
  if (f.denied) return <Denied rtl={rtl} permission="hse.env.view" unauth={f.unauth} />;
  const items: Json[] = f.data?.items ?? [];
  const s: Json = f.data?.summary ?? {};

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={rtl ? "اندازه‌گیری" : "Readings"} value={num(s.total, 0)} />
        <Stat
          label={rtl ? "فراتر از حد" : "Exceeded"}
          value={num(s.exceeded, 0)}
          tone={s.exceeded > 0 ? "danger" : "ok"}
        />
        <Stat
          label={rtl ? "بدون اقدام اصلاحی" : "No action"}
          value={num(s.exceededWithoutAction, 0)}
          tone={s.exceededWithoutAction > 0 ? "danger" : "ok"}
        />
        <Stat
          label={rtl ? "نرخ انطباق" : "Compliance"}
          value={s.complianceRatePct == null ? "—" : `${num(s.complianceRatePct, 1)}٪`}
          tone={s.complianceRatePct != null && s.complianceRatePct < 90 ? "warn" : "ok"}
        />
      </div>

      {s.worstFa && (
        <Card title={rtl ? "بدترین اندازه‌گیری" : "Worst reading"} accent={ACCENT}>
          <div className="text-[10px] font-light tx2">{s.worstFa}</div>
          <Notes items={s.warningsFa} tone="warn" />
        </Card>
      )}

      {!items.length ? (
        <Empty fa={rtl ? "هنوز اندازه‌گیری زیست‌محیطی ثبت نشده است" : "No environmental readings"} />
      ) : (
        <Card title={rtl ? "اندازه‌گیری‌ها" : "Readings"}>
          <div className="space-y-1">
            {items.slice(-25).reverse().map((r) => {
              const st: Json = r.state ?? {};
              return (
                <div key={r.Id} className="glass-row flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5">
                  <span className="font-mono text-[9px] font-light tx3">{r.ReadingNo}</span>
                  <span className="text-[10px] font-light tx1">{r.ParameterFa}</span>
                  <Pill text={st.mediumFa ?? r.Medium} tone="mute" />
                  <span className="text-[9px] font-light tx3">
                    {num(r.MeasuredValue, 2)} / {num(r.LimitValue, 2)} {r.Unit}
                  </span>
                  <Pill
                    text={st.verdictFa ?? (st.isExceeded ? (rtl ? "فراتر از حد" : "Exceeded") : rtl ? "منطبق" : "OK")}
                    tone={st.isExceeded ? "danger" : st.isNearLimit ? "warn" : "ok"}
                  />
                  {st.needsAction && <Pill text={rtl ? "نیازمند اقدام" : "Action needed"} tone="danger" />}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}


/* ═════════════════════ تب ۶ — شاخص‌ها ═════════════════════ */

/**
 * داشبورد شاخص، نمرهٔ ایمنی و هشدار زودهنگام (زیرماژول ۰۸٫۶).
 *
 * برخلاف پنج تب دیگر، این تب دادهٔ خودش را جدا می‌گیرد و نه از
 * `reload()` مشترک. دلیلش این است که `/api/hse/metrics` و
 * `/api/hse/alerts` مجوز جدا دارند (`hse.metrics.view`) و دورهٔ
 * انتخابی کاربر پارامتر ورودی‌شان است؛ اگر می‌خواستیم داخل بار
 * اولیهٔ صفحه بیاورند، هر بار عوض‌کردن دوره کل نُه درخواست تب‌های
 * دیگر را هم دوباره می‌زد.
 *
 * قاعدهٔ سخت این صفحه: `null` هرگز صفر نمایش داده نمی‌شود. در یک
 * داشبورد ایمنی «نمی‌دانیم» و «هیچ حادثه‌ای نبود» دو تصمیم کاملاً
 * متفاوت از مدیر می‌خواهند.
 */
function DashboardTab({
  incidents, violations, permits, rtl, userId,
}: { incidents: Fetched; violations: Fetched; permits: Fetched; rtl: boolean; userId: string }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState("");
  const [headCount, setHeadCount] = useState("");
  const [met, setMet] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [alerts, setAlerts] = useState<Fetched>({ data: null, denied: false, unauth: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const q = new URLSearchParams({ projectId: PROJECT_ID });
    if (period.trim()) q.set("period", period.trim());
    if (headCount.trim()) q.set("headCount", headCount.trim());
    const [m, a] = await Promise.all([
      fetchJson(`/api/hse/metrics?${q}`, userId),
      fetchJson(`/api/hse/alerts?projectId=${PROJECT_ID}`, userId),
    ]);
    setMet(m);
    setAlerts(a);
    setBusy(false);
  }, [period, headCount, userId]);

  useEffect(() => { void load(); }, [load]);

  /**
   * انتشار عکس دوره و سکوت هشدار هر دو در کاتالوگ RBAC
   * `audited: true` هستند: پس تلاش موفق و ناموفق هر دو باید در سیاههٔ
   * سمت مرورگر هم بیفتد، نه فقط در سرور. رد شدن یک سکوت به همان
   * اندازهٔ پذیرفتنش برای بازرس بیرونی معنا دارد.
   */
  const run = useCallback(async (path: string, body: Json, okFa: string) => {
    const who = user ? { name: user.displayName, role: user.role } : undefined;
    const action = path.includes("/publish")
      ? "HSE_METRIC_PUBLISH"
      : path.includes("/unmute") ? "HSE_ALERT_UNMUTE"
        : path.includes("/mute") ? "HSE_ALERT_MUTE" : "HSE_ALERT_CONFIGURE";

    const r = await postHse(path, body, userId);
    if (r.ok) {
      logAudit(action, "HSE", okFa, "info", who);
      setMsg({ kind: "ok", text: okFa });
      await load();
    } else {
      logAudit(`${action}_DENIED`, "HSE", r.messageFa, "warning", who);
      setMsg({ kind: "err", text: r.messageFa, details: r.detailsFa });
    }
    return r;
  }, [load, user, userId]);

  if (met.denied) {
    return <Denied rtl={rtl} permission="hse.metrics.view" unauth={met.unauth} />;
  }

  const d: Json = met.data ?? {};
  const score: Json = d.score ?? {};
  const health: Json = d.health ?? {};
  const al: Json = alerts.data ?? {};
  const alertItems: Json[] = al.items ?? [];
  const metrics: Json[] = d.metrics ?? [];
  const trends: Json[] = d.trends ?? [];
  const mh: Json = d.manHours ?? {};

  return (
    <div className="space-y-2">
      {/* ── انتخاب دوره ── */}
      <Card
        title={rtl ? "دورهٔ محاسبه" : "Reporting period"}
        sub={d.periodCode ? `${d.from} … ${d.to}` : undefined}
        accent={ACCENT}
      >
        <div className="flex flex-wrap items-end gap-2">
          <Field label={rtl ? "دوره (YYYY-MM)" : "Period"} value={period} onChange={setPeriod} ph={d.periodCode ?? "2026-09"} />
          {/* شمار کارکنان از HRM نمی‌آید: مرز دامنه‌ها شکسته نمی‌شود.
              بدون آن، سرانهٔ آموزش از افراد حاضر در کلاس‌ها برآورد
              می‌شود که کف واقعی نیست — پس عدد صریح ارجح است. */}
          <Field
            label={rtl ? "شمار کارکنان (اختیاری)" : "Head count"}
            value={headCount}
            onChange={setHeadCount}
            ph={rtl ? "مثلاً ۱۲۰" : "e.g. 120"}
          />
          <Btn onClick={() => void load()}>{busy ? (rtl ? "…" : "…") : (rtl ? "محاسبه" : "Compute")}</Btn>
          <Btn onClick={() => void run(`/api/hse/metrics/publish?projectId=${PROJECT_ID}`,
            { periodCode: d.periodCode, headCount: headCount.trim() ? Number(headCount) : undefined },
            rtl ? "عکس شاخص‌های دوره منتشر شد" : "Snapshot published")}>
            {rtl ? "انتشار عکس دوره" : "Publish snapshot"}
          </Btn>
        </div>
        <Notes items={d.warningsFa} tone="warn" />
      </Card>

      {msg && (
        <div
          className="glass rounded-2xl px-3 py-2.5"
          style={{ borderInlineStart: `3px solid ${msg.kind === "ok" ? "#059669" : ACCENT}` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10.5px] font-light tx1">{msg.text}</div>
              <Notes items={msg.details} />
            </div>
            <button onClick={() => setMsg(null)} className="shrink-0 text-[11px] font-light tx3 hover:tx1">✕</button>
          </div>
        </div>
      )}

      {/* ── نمرهٔ ایمنی ── */}
      <Card
        title={rtl ? "نمرهٔ ایمنی پروژه" : "Project safety score"}
        sub={score.coveragePct != null ? (rtl ? `پوشش داده ${score.coveragePct}٪` : `${score.coveragePct}% coverage`) : undefined}
        accent={ACCENT}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="rounded-2xl px-4 py-2.5 text-center"
            style={{ background: `${score.band?.color ?? "#6B7280"}18`, minWidth: 104 }}
          >
            <div className="text-[22px] font-light" style={{ color: score.band?.color }}>
              {score.score == null ? "—" : num(score.score, 1)}
            </div>
            <div className="text-[9.5px] font-light" style={{ color: score.band?.color }}>
              {score.band?.fa ?? (rtl ? "نامعلوم" : "Unknown")}
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {(score.contributions ?? []).map((c: Json) => (
              <ContribBar key={c.code} c={c} rtl={rtl} />
            ))}
          </div>
        </div>
        {/* سقف‌خوردن نمره باید دیده شود، وگرنه مدیر عدد ۵۵ را
            «نمرهٔ واقعی» می‌خواند در حالی که یک هشدار بحرانی باز است. */}
        {score.isCapped && <Notes items={score.capReasonFa} tone="danger" />}
        <Notes items={score.warningsFa} tone="warn" />
        {health.summaryFa && (
          <div className="mt-1.5 flex items-center gap-2">
            <Pill
              text={health.summaryFa}
              tone={health.status === "red" ? "danger" : health.status === "amber" ? "warn" : "ok"}
            />
            {health.isReliable === false && (
              <Pill text={rtl ? "غیرقابل اتکا" : "Not reliable"} tone="warn" />
            )}
          </div>
        )}
      </Card>

      {/* ── جدول شاخص‌ها ── */}
      <Card
        title={rtl ? "شاخص‌های کلیدی دوره (نه کل پروژه)" : "Period KPIs (not life-to-date)"}
        sub={mh.totalHours != null ? (rtl ? `${num(mh.totalHours, 0)} نفرساعت` : `${num(mh.totalHours, 0)} man-hours`) : undefined}
      >
        {metrics.length === 0 ? (
          <Empty fa={rtl ? "شاخصی محاسبه نشد" : "No metrics"} />
        ) : (
          <div className="space-y-1">
            {metrics.map((m) => {
              const tr = trends.find((t: Json) => t.metricCode === m.code);
              return <MetricRow key={m.code} m={m} trend={tr} rtl={rtl} />;
            })}
          </div>
        )}
      </Card>

      {/* ── هشدار زودهنگام ── */}
      {alerts.denied ? (
        <Denied rtl={rtl} permission="hse.metrics.view" unauth={alerts.unauth} />
      ) : (
        <Card
          title={rtl ? "هشدار زودهنگام" : "Early warnings"}
          sub={rtl
            ? `${num(al.triggeredCount, 0)} فعال · ${num(al.criticalCount, 0)} بحرانی · ${num(al.mutedCount, 0)} خاموش`
            : `${num(al.triggeredCount, 0)} active`}
          accent={ACCENT}
        >
          {alertItems.length === 0 ? (
            <Empty fa={rtl ? "قاعده‌ای تعریف نشده" : "No rules"} />
          ) : (
            <div className="space-y-1">
              {alertItems.map((a) => <AlertRow key={a.ruleCode} a={a} rtl={rtl} onRun={run} />)}
            </div>
          )}
          <Notes items={al.blockingFa} tone="danger" />
          <Notes items={al.warningsFa} tone="warn" />
        </Card>
      )}

      {/* ── زمینهٔ عملیاتی: همان اعداد تب‌های دیگر، بدون بازمحاسبه ── */}
      {!incidents.denied && (
        <Card title={rtl ? "زمینهٔ رویداد" : "Incident context"}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={rtl ? "کل رویداد" : "Total"} value={num(incidents.data?.metrics?.total, 0)} />
            <Stat
              label={rtl ? "باز" : "Open"}
              value={num(incidents.data?.metrics?.openCount, 0)}
              tone={incidents.data?.metrics?.openCount > 0 ? "warn" : "ok"}
            />
            <Stat label={rtl ? "ثبت‌پذیر" : "Recordable"} value={num(incidents.data?.metrics?.recordable, 0)} />
            <Stat
              label={rtl ? "با روز از دست‌رفته" : "Lost time"}
              value={num(incidents.data?.metrics?.lostTime, 0)}
              tone={incidents.data?.metrics?.lostTime > 0 ? "danger" : "ok"}
            />
          </div>
          <div className="mt-2">
            <TypeBars byType={incidents.data?.metrics?.byType} total={incidents.data?.metrics?.total} rtl={rtl} />
          </div>
        </Card>
      )}

      {(!violations.denied || !permits.denied) && (
        <Card title={rtl ? "زمینهٔ اجرایی" : "Enforcement context"}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {!violations.denied && (
              <>
                <Stat
                  label={rtl ? "توقف کار فعال" : "SWO active"}
                  value={num(violations.data?.summary?.stopWorkActive, 0)}
                  tone={violations.data?.summary?.stopWorkActive > 0 ? "danger" : "ok"}
                />
                <Stat label={rtl ? "تخلف معوق" : "Overdue"} value={num(violations.data?.summary?.overdue, 0)} />
              </>
            )}
            {!permits.denied && (
              <>
                <Stat label={rtl ? "پروانهٔ معتبر" : "Valid permits"} value={num(permits.data?.summary?.activeNow, 0)} />
                <Stat
                  label={rtl ? "منقضی بسته‌نشده" : "Expired open"}
                  value={num(permits.data?.summary?.expiredNotClosed, 0)}
                  tone={permits.data?.summary?.expiredNotClosed > 0 ? "danger" : "ok"}
                />
              </>
            )}
          </div>
        </Card>
      )}

      <RfsuProbe rtl={rtl} userId={userId} />
    </div>
  );
}

/** ورودی متنی کوتاه — بدون وابستگی به فرم‌های تب‌های دیگر. */
function Field({ label, value, onChange, ph }: {
  label: string; value: string; onChange: (v: string) => void; ph?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[9px] font-light tx3">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        className="glass-row w-32 rounded-lg px-2.5 py-1.5 text-[10px] font-light tx1 outline-none"
      />
    </label>
  );
}

/** سهم یک شاخص در نمره — شاخص بی‌داده خط خاکستری می‌شود نه نوار صفر. */
function ContribBar({ c, rtl }: { c: Json; rtl: boolean }) {
  const has = c.normalized != null;
  return (
    <div className="flex items-center gap-2">
      <div className="w-40 shrink-0 truncate text-[9px] font-light tx2">{c.titleFa}</div>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "#88888818" }}>
        {has && (
          <div
            className="h-full rounded-full"
            style={{ width: `${c.normalized}%`, background: c.normalized >= 70 ? "#059669" : c.normalized >= 40 ? "#D97706" : ACCENT }}
          />
        )}
      </div>
      <div className="w-16 shrink-0 text-end text-[9px] font-light tx3">
        {has ? `${num(c.normalized, 0)} · ${c.weight}٪` : (rtl ? `بی‌داده · ${c.weight}٪` : `n/a · ${c.weight}%`)}
      </div>
    </div>
  );
}

/** یک ردیف شاخص با حکم موتور و جهت روند. */
function MetricRow({ m, trend, rtl }: { m: Json; trend?: Json; rtl: boolean }) {
  return (
    <div className="glass-row rounded-xl px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="min-w-0 flex-1 truncate text-[10px] font-light tx1">{m.titleFa}</div>
        <div className="text-[13px] font-light tx1" style={m.verdict?.color ? { color: m.verdict.color } : undefined}>
          {m.value == null ? "—" : num(m.value, m.unit === "pct" || m.unit === "hours" ? 1 : 2)}
        </div>
        <div className="text-[9px] font-light tx3">
          {rtl ? "هدف" : "target"} {num(m.target, 2)}
        </div>
        {m.verdict?.fa && (
          <Pill
            text={m.verdict.fa}
            tone={m.verdict.isMet === true ? "ok" : m.verdict.isMet === false ? "danger" : "mute"}
          />
        )}
        {trend?.directionFa && <Pill text={trend.directionFa} tone="mute" />}
      </div>
      {m.detailFa && <div className="mt-0.5 text-[9px] font-light tx3">{m.detailFa}</div>}
    </div>
  );
}

/**
 * یک قاعدهٔ هشدار.
 *
 * سکوت‌کردن یک هشدار بحرانی یک تصمیم مدیریتی است، نه پنهان‌کردن:
 * پس ردیف سکوت‌شده حذف نمی‌شود، فقط برچسب می‌گیرد و دلیلش کنارش
 * می‌ماند.
 */
function AlertRow({ a, rtl, onRun }: {
  a: Json; rtl: boolean; onRun: (p: string, b: Json, ok: string) => Promise<PostResult>;
}) {
  const tone: Tone = a.isMuted ? "mute" : a.isTriggered ? (a.severity === "critical" ? "danger" : "warn") : "ok";
  const c = toneColor(tone);
  return (
    <div className="glass-row rounded-xl px-2.5 py-2" style={{ borderInlineStart: `3px solid ${c ?? "#88888840"}` }}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="min-w-0 flex-1 truncate text-[10px] font-light tx1">{a.titleFa}</div>
        <Pill
          text={a.isMuted
            ? (rtl ? "خاموش‌شده" : "Muted")
            : a.isTriggered ? (rtl ? "فعال" : "Triggered") : (rtl ? "عادی" : "Normal")}
          tone={tone}
        />
        {!a.isConfigured && <Pill text={rtl ? "پیش‌فرض" : "Default"} tone="mute" />}
        <div className="text-[9px] font-light tx3">
          {num(a.observed, 0)} / {num(a.threshold, 0)}
        </div>
        {a.isMuted ? (
          <Btn onClick={() => void onRun(
            `/api/hse/alerts/${a.ruleCode}/unmute?projectId=${PROJECT_ID}`, {},
            rtl ? "سکوت هشدار برداشته شد" : "Unmuted",
          )}>
            {rtl ? "بازگرداندن" : "Unmute"}
          </Btn>
        ) : (
          <Btn onClick={() => {
            /* TD-UI-04: هنوز از prompt مرورگر استفاده می‌شود؛ دلیل
               سکوت اجباری است و موتور بدون آن رد می‌کند. */
            const reason = window.prompt(rtl ? "دلیل خاموش‌کردن هشدار:" : "Reason to mute:");
            if (!reason) return;
            void onRun(
              `/api/hse/alerts/${a.ruleCode}/mute?projectId=${PROJECT_ID}`,
              /* سرور تاریخ پایان می‌خواهد نه شمار روز؛ هفت روز پیش‌فرض
                 است چون سقف سی روز موتور را نمی‌شکند و کاربر را وادار
                 به تصمیم دوباره می‌کند. */
              { reasonFa: reason, until: new Date(Date.now() + 7 * 86_400_000).toISOString() },
              rtl ? "هشدار موقتاً خاموش شد" : "Muted",
            );
          }}>
            {rtl ? "خاموش‌کردن" : "Mute"}
          </Btn>
        )}
      </div>
      {a.detailFa && <div className="mt-0.5 text-[9px] font-light tx3">{a.detailFa}</div>}
      {a.isTriggered && !a.isMuted && a.actionFa && (
        <div className="mt-1 text-[9px] font-light tx2">↩ {a.actionFa}</div>
      )}
      {a.isMuted && a.muteReasonFa && (
        <div className="mt-1 text-[9px] font-light tx3">
          {rtl ? "دلیل سکوت: " : "Mute reason: "}{a.muteReasonFa}
        </div>
      )}
    </div>
  );
}

function TypeBars({ byType, total, rtl }: { byType?: Record<string, number>; total?: number; rtl: boolean }) {
  const entries = Object.entries(byType ?? {}).filter(([, n]) => n > 0);
  if (!entries.length) return <Empty fa={rtl ? "رویدادی ثبت نشده" : "No incidents"} />;
  const max = Math.max(1, ...entries.map(([, n]) => n), total ?? 0);
  return (
    <div className="space-y-1.5">
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => (
          <div key={k} className="flex items-center gap-2">
            <div className="w-36 shrink-0 truncate text-[9.5px] font-light tx2">{k}</div>
            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "#88888818" }}>
              <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: ACCENT }} />
            </div>
            <div className="w-8 shrink-0 text-end text-[9.5px] font-light tx1">{n}</div>
          </div>
        ))}
    </div>
  );
}

/**
 * استعلام آمادگی ایمنی یک سیستم برای RFSU.
 *
 * این تنها نقطه‌ای در کل پلتفرم است که دروازهٔ ایمنیِ راه‌اندازی دیده
 * می‌شود: دامنهٔ d15 هنوز پنل ندارد، پس اگر HSE آن را نشان ندهد، تیم
 * راه‌اندازی تا لحظهٔ رد شدن درخواست نمی‌فهمد چه چیزی مانع است.
 */
function RfsuProbe({ rtl, userId }: { rtl: boolean; userId: string }) {
  const [systemId, setSystemId] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Json | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    const id = systemId.trim();
    if (!id) return;
    setBusy(true);
    setErr(null);
    const f = await fetchJson(`/api/hse/rfsu-clearance/${encodeURIComponent(id)}?projectId=${PROJECT_ID}`, userId);
    setBusy(false);
    if (f.denied) {
      setRes(null);
      setErr(rtl ? "دسترسی به استعلام آمادگی ندارید" : "Not permitted");
      return;
    }
    if (!f.data) {
      setRes(null);
      setErr(rtl ? "سیستم یافت نشد یا پاسخی نرسید" : "No response");
      return;
    }
    setRes(f.data);
  };

  const c: Json = res?.clearance ?? {};

  return (
    <Card title={rtl ? "استعلام آمادگی ایمنی برای RFSU" : "RFSU safety clearance"} accent={ACCENT}>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={systemId}
          onChange={(e) => setSystemId(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void run(); }}
          placeholder={rtl ? "شناسهٔ سیستم، مثلاً SYS-77" : "System id, e.g. SYS-77"}
          className="glass-row min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-[10px] font-light tx1 outline-none"
        />
        <Btn onClick={() => void run()}>{busy ? (rtl ? "…" : "…") : (rtl ? "استعلام" : "Check")}</Btn>
      </div>

      {err && <div className="mt-1.5 text-[9.5px] font-light" style={{ color: "#D97706" }}>{err}</div>}

      {res && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill
              text={c.ok ? (rtl ? "آمادهٔ RFSU" : "Clear for RFSU") : (rtl ? "مسدود" : "Blocked")}
              tone={c.ok ? "ok" : "danger"}
            />
            <Pill text={rtl ? `پروانهٔ باز: ${c.openPermits ?? 0}` : `Open permits: ${c.openPermits ?? 0}`} tone={c.openPermits > 0 ? "warn" : "mute"} />
            <Pill text={rtl ? `منقضی: ${c.expiredPermits ?? 0}` : `Expired: ${c.expiredPermits ?? 0}`} tone={c.expiredPermits > 0 ? "danger" : "mute"} />
            <Pill
              text={rtl ? `رویداد شدید باز: ${c.openHighSeverityIncidents ?? 0}` : `High-sev open: ${c.openHighSeverityIncidents ?? 0}`}
              tone={c.openHighSeverityIncidents > 0 ? "danger" : "mute"}
            />
            <Pill
              text={rtl ? `توقف کار فعال: ${c.activeStopWorkOrders ?? 0}` : `Active SWO: ${c.activeStopWorkOrders ?? 0}`}
              tone={c.activeStopWorkOrders > 0 ? "danger" : "mute"}
            />
          </div>

          <Notes items={c.blockersFa} />
          <Notes items={c.warningsFa} tone="warn" />

          {/* فهرست دقیق موانع: «۳ پروانهٔ باز» بدون شماره‌ها یعنی کاربر
              باید کل فهرست را دستی بگردد. */}
          <BlockerList
            titleFa={rtl ? "پروانه‌های مانع" : "Blocking permits"}
            rows={(res.blockingPermits ?? []).map((b: Json) => `${b.permitNo} — ${b.titleFa} (${b.typeFa} · ${b.statusFa})`)}
          />
          <BlockerList
            titleFa={rtl ? "رویدادهای مانع" : "Blocking incidents"}
            rows={(res.blockingIncidents ?? [])
              .filter((b: Json) => b.isBlocker)
              .map((b: Json) => `${b.incidentNo} — ${b.titleFa} (${b.severityFa})`)}
          />
          <BlockerList
            titleFa={rtl ? "دستورهای توقف کار مانع" : "Blocking stop-work"}
            rows={(res.blockingStopWork ?? []).map((b: Json) => `${b.violationNo} — ${b.titleFa} (${b.typeFa} · ${b.scopeFa})`)}
          />
        </div>
      )}
    </Card>
  );
}

function BlockerList({ titleFa, rows }: { titleFa: string; rows: string[] }) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="text-[9.5px] font-light tx3">{titleFa}</div>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r, i) => (
          <li key={i} className="text-[9.5px] font-light tx2">• {r}</li>
        ))}
      </ul>
    </div>
  );
}
