import { useCallback, useEffect, useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import { useAuth } from "../context/AuthContext";
import { DEMO_SUBJECTS, can as rbacCan } from "../services/accessControl";
import { DEFAULT_RESPONSE_DAYS, isTimeBarred, type EngagementLevel, type Letter, type LessonCategory } from "../services/communication";
import {
  CHANNELS,
  ENGAGEMENT_LEVELS,
  EVENT_CATALOG,
  EVENT_CODES,
  FREQUENCIES,
  LESSON_CATEGORIES,
  LETTER_CLASSES,
  MEETING_TYPES,
  buildCkmView,
  type CkmView,
  type EventCode,
} from "../services/ckmWorkspace";
import { CkmClient, type CkmResult, type CkmWorkspacePayload } from "../services/ckmApi";

/* ═══════════════ میز کار ارتباطات و دانش (d11) ═══════════════
 * LIVE-2: همهٔ داده‌ها از `/api/ckm/:projectId` می‌آید و ماندگار است.
 * پیش از این آرایه‌های ثابت درون همین فایل بود، «امروز» ثابت ۲۰۲۶-۰۹-۰۸
 * بود و سطح تشدید قواعد با عدد ساختگی «۹۶ ساعت» حساب می‌شد.
 * محاسبه در `services/ckmWorkspace.ts` (مشترک با سرور) و موتور
 * `communication.ts` است؛ این فایل فقط نمایش و فرم است. کنترل‌ها
 * (مجوز، محرمانگی مکاتبات، تفکیک وظیفه، قفل صورت‌جلسه) سمت سرور اجرا
 * می‌شود؛ پنهان کردن دکمه فقط برای راحتی است. */

/* شش تب = دقیقاً شش زیرماژول ماژول ارتباطات و دانش */
export type CkmTab = "correspondence" | "meetings" | "stakeholders" | "notifications" | "knowledge" | "analytics";

const TABS: { id: CkmTab; fa: string; en: string; icon: string; proc: string }[] = [
  { id: "correspondence", fa: "مکاتبات و اعلان قراردادی", en: "Correspondence & Notices", icon: "✉️", proc: "d11-p1" },
  { id: "meetings", fa: "جلسات و مصوبات", en: "Meetings & Actions", icon: "🗓", proc: "d11-p2" },
  { id: "stakeholders", fa: "ذی‌نفعان و برنامه ارتباطات", en: "Stakeholders & Comms Plan", icon: "🤝", proc: "d11-p3" },
  { id: "notifications", fa: "اطلاع‌رسانی و تشدید", en: "Notification & Escalation", icon: "🔔", proc: "d11-p4" },
  { id: "knowledge", fa: "دانش و درس‌آموخته", en: "Knowledge & Lessons Learned", icon: "💡", proc: "d11-p5" },
  { id: "analytics", fa: "تحلیل و گزارش ارتباطات", en: "Communication Analytics", icon: "📊", proc: "d11-p6" },
];


/** پروژهٔ جاری؛ همان شناسهٔ دامنهٔ RBAC. */
const PROJECT_ID = "c1-p1";

const ALL_CATEGORIES: LessonCategory[] = LESSON_CATEGORIES;

const CATEGORY_LABEL: Record<LessonCategory, { fa: string; en: string }> = {
  technical: { fa: "فنی", en: "Technical" },
  schedule: { fa: "زمان", en: "Schedule" },
  cost: { fa: "هزینه", en: "Cost" },
  quality: { fa: "کیفیت", en: "Quality" },
  hse: { fa: "ایمنی", en: "HSE" },
  contract: { fa: "قرارداد", en: "Contract" },
  procurement: { fa: "تدارکات", en: "Procurement" },
  hr: { fa: "منابع انسانی", en: "HR" },
  stakeholder: { fa: "ذی‌نفعان", en: "Stakeholder" },
};

const CLASS_LABEL: Record<Letter["letterClass"], { fa: string; en: string }> = {
  general: { fa: "عادی", en: "General" },
  instruction: { fa: "دستور کار", en: "Instruction" },
  notice: { fa: "اعلان قراردادی", en: "Notice" },
  claim_notice: { fa: "اعلان ادعا", en: "Claim notice" },
  submittal: { fa: "ارسال مدرک", en: "Submittal" },
  rfi: { fa: "استعلام", en: "RFI" },
  ncr_related: { fa: "عدم انطباق", en: "NCR related" },
};

const ENGAGEMENT_LABEL: Record<EngagementLevel, { fa: string; en: string }> = {
  unaware: { fa: "ناآگاه", en: "Unaware" },
  resistant: { fa: "مقاوم", en: "Resistant" },
  neutral: { fa: "خنثی", en: "Neutral" },
  supportive: { fa: "حامی", en: "Supportive" },
  leading: { fa: "پیشران", en: "Leading" },
};

const QUADRANT_LABEL = {
  manage_closely: { fa: "مدیریت نزدیک", en: "Manage closely", tone: "bg-rose-400/15 text-rose-300" },
  keep_satisfied: { fa: "راضی نگه دار", en: "Keep satisfied", tone: "bg-amber-400/15 text-amber-200" },
  keep_informed: { fa: "مطلع نگه دار", en: "Keep informed", tone: "bg-sky-400/15 text-sky-300" },
  monitor: { fa: "پایش", en: "Monitor", tone: "bg-white/5 tx3" },
} as const;


const MEETING_TYPE_LABEL: Record<string, { fa: string; en: string }> = {
  kickoff: { fa: "آغازین", en: "Kickoff" },
  weekly: { fa: "هفتگی", en: "Weekly" },
  monthly: { fa: "ماهانه", en: "Monthly" },
  technical: { fa: "فنی", en: "Technical" },
  client: { fa: "کارفرما", en: "Client" },
  hse: { fa: "ایمنی", en: "HSE" },
  claim: { fa: "ادعا", en: "Claim" },
};

const LETTER_STATUS_LABEL: Record<string, { fa: string; en: string; cls: string }> = {
  draft: { fa: "پیش‌نویس", en: "Draft", cls: "border b-line-soft tx3" },
  registered: { fa: "ثبت‌شده", en: "Registered", cls: "bg-sky-400/15 text-sky-200" },
  under_review: { fa: "در بررسی", en: "Under review", cls: "bg-sky-400/15 text-sky-200" },
  responded: { fa: "پاسخ‌داده", en: "Responded", cls: "bg-emerald-400/15 text-emerald-300" },
  closed: { fa: "بسته", en: "Closed", cls: "bg-white/5 tx4" },
};

const FREQ_LABEL: Record<string, { fa: string; en: string }> = {
  daily: { fa: "روزانه", en: "Daily" },
  weekly: { fa: "هفتگی", en: "Weekly" },
  biweekly: { fa: "دوهفته‌ای", en: "Biweekly" },
  monthly: { fa: "ماهانه", en: "Monthly" },
  on_event: { fa: "رویدادمحور", en: "On event" },
};

/* ─────────────── اجزای نمایشی ─────────────── */

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

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-2 py-1 text-start font-normal">{children}</th>;
}


const inputCls = "rounded-lg border b-line-soft bg-black/20 px-2 py-1 text-[9.5px] tx1 placeholder:text-[9px] placeholder:tx4";
const btnCls = "rounded-lg border px-2.5 py-1 text-[9.5px] transition disabled:opacity-40";
const btnPrimary = `${btnCls} border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20`;
const btnOk = `${btnCls} border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`;
const btnWarn = `${btnCls} border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20`;
const rowBtn = "glass-row rounded-lg px-2 py-0.5 text-[8.5px] font-light tx2 transition hover:tx1 disabled:opacity-40";

const splitList = (s: string) => s.split(/[،,\n]/).map((x) => x.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** فرم کوچک با وضعیت محلی؛ بعد از ثبت موفق خالی می‌شود. */
function useForm<T extends Record<string, string | boolean>>(init: T) {
  const [v, setV] = useState<T>(init);
  const set = (k: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((p) => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  return { v, set, reset: () => setV(init), setV };
}

type Perm = { letters: boolean; draft: boolean; sign: boolean; meeting: boolean; lesson: boolean; stakeholder: boolean; notify: boolean };
type Act = (fn: () => Promise<CkmResult<unknown>>, okText: string, auditCode?: string) => Promise<boolean>;

/* ══════════════════════════ کامپوننت اصلی ══════════════════════════ */

export default function CommunicationWorkspace({
  lang,
  initialTab = "correspondence",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: CkmTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const client = useMemo(() => new CkmClient(PROJECT_ID, userId), [userId]);
  const subject = useMemo(() => DEMO_SUBJECTS.find((s) => s.id === userId) ?? null, [userId]);

  const [tab, setTab] = useState<CkmTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const [ws, setWs] = useState<CkmWorkspacePayload | null>(null);
  const [loadErr, setLoadErr] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const perm: Perm = useMemo(
    () => ({
      letters: Boolean(ws && !ws.lettersHidden),
      draft: rbacCan(subject, "ckm.letter.draft"),
      sign: rbacCan(subject, "ckm.letter.sign"),
      meeting: rbacCan(subject, "ckm.meeting.record"),
      lesson: rbacCan(subject, "ckm.lesson.publish"),
      stakeholder: rbacCan(subject, "ckm.stakeholder.edit"),
      notify: rbacCan(subject, "ckm.notify.manage"),
    }),
    [subject, ws],
  );

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
  const act: Act = async (fn, okText, auditCode) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      setMsg({ tone: "ok", text: okText });
      if (auditCode) logAudit(auditCode, "Communication", okText);
      await reload();
      return true;
    }
    setMsg({ tone: "err", text: r.message });
    return false;
  };

  const view = useMemo(() => (ws ? buildCkmView(ws, ws.today) : null), [ws]);
  const fmt = (n: number) => n.toLocaleString(rtl ? "fa-IR" : "en-US");

  let body: React.ReactNode = null;
  if (loading && !ws) {
    body = <p className="p-4 text-[10px] tx3">{rtl ? "در حال خواندن داده از سرور…" : "Loading from server…"}</p>;
  } else if (loadErr) {
    body = (
      <Section title={rtl ? "داده در دسترس نیست" : "Data unavailable"}>
        <p className="text-[10px] text-rose-200">{loadErr.message}</p>
        <p className="mt-1 text-[9px] tx3">
          {loadErr.status === 401
            ? rtl ? "ابتدا وارد سامانه شوید." : "Please sign in."
            : loadErr.status === 403
              ? rtl ? "نقش فعلی هیچ مجوزی در ارتباطات و دانش ندارد؛ با نقشی مثل کنترل مدارک (دبیرخانه) یا مدیر پروژه وارد شوید." : "Your role has no d11 permission."
              : rtl ? "اتصال به سرور API برقرار نیست." : "API server unreachable."}
        </p>
        <button onClick={() => void reload()} className={`${btnPrimary} mt-2`}>{rtl ? "تلاش دوباره" : "Retry"}</button>
      </Section>
    );
  } else if (ws && view) {
    body = view.empty ? (
      <Section title={rtl ? "هنوز داده‌ای برای این پروژه ثبت نشده" : "No data for this project yet"} note={rtl ? "هیچ عدد ساختگی نمایش داده نمی‌شود" : "no fabricated numbers"}>
        <p className="text-[9.5px] tx2">
          {rtl
            ? "با ثبت نامه، صورت‌جلسه یا ذی‌نفع در تب‌های بالا شروع کنید، یا برای آشنایی دادهٔ نمونهٔ پروژهٔ OG-2401 را بارگذاری کنید. نمونه فقط روی پروژهٔ خالی و فقط با همین دکمه بارگذاری می‌شود و تاریخ‌هایش نسبت به امروز تنظیم می‌شود."
            : "Start from the tabs above, or load the OG-2401 sample (empty project only; dates aligned to today)."}
        </p>
        <div className="mt-2">
          {perm.draft ? (
            <button onClick={() => void act(() => client.seed(), rtl ? "دادهٔ نمونه بارگذاری شد" : "Sample data loaded", "CKM_SAMPLE_SEEDED")} disabled={busy} className={btnWarn}>
              {rtl ? "بارگذاری دادهٔ نمونه" : "Load sample data"}
            </button>
          ) : (
            <span className="text-[9px] tx4">{rtl ? "بارگذاری نمونه مجوز «تنظیم پیش‌نویس نامه» می‌خواهد (دبیرخانه یا مدیر پروژه)." : "Seeding requires ckm.letter.draft."}</span>
          )}
        </div>
      </Section>
    ) : null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* هدر */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet-400/40 bg-violet-400/10 text-[15px]">📡</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">{rtl ? "مدیریت ارتباطات و دانش" : "Communications & Knowledge Management"}</h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "اعلان قراردادی مهلت‌دار است · مصوبه بدون مالک و موعد پذیرفته نمی‌شود · دانش با استفاده مجدد سنجیده می‌شود"
                : "notices are time-barred · no action without owner and due date · knowledge measured by reuse"}
            </p>
          </div>
          {view && !view.empty && (
            <>
              {perm.letters && (
                <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums ${view.timeBarBreaches ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/15 text-emerald-300"}`}>
                  {rtl ? "نقض مهلت قراردادی" : "Time-bar breach"} {fmt(view.timeBarBreaches)}
                </span>
              )}
              <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">{rtl ? "پاسخ" : "Resp"} {view.avgResponse ?? "—"}{view.avgResponse !== null ? "d" : ""}</span>
              <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">{rtl ? "دانش" : "Reuse"} {view.utilization ?? "—"}{view.utilization !== null ? "%" : ""}</span>
            </>
          )}
          <span className={`rounded-lg px-2 py-1 text-[8.5px] ${loadErr ? "bg-rose-400/15 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {loading ? (rtl ? "در حال بارگذاری…" : "loading…") : loadErr ? (rtl ? "قطع از سرور" : "offline") : rtl ? "دادهٔ زنده · سرور" : "live · server"}
          </span>
          {view && <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[9px] tx3" dir="ltr">{view.formulaVersion} · {view.today}</span>}
        </div>
        {view && view.alerts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {view.alerts.map((a) => (
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

      {!hideTabs && (
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
      )}

      <div className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {body}
        {ws && view && <Tabs rtl={rtl} me={userId} tab={tab} ws={ws} v={view} perm={perm} busy={busy} client={client} act={act} fmt={fmt} />}
      </div>
    </div>
  );
}

/* ══════════════════════════ تب‌ها ══════════════════════════ */

function Tabs({ rtl, me, tab, ws, v, perm, busy, client, act, fmt }: {
  rtl: boolean; me: string | null; tab: CkmTab; ws: CkmWorkspacePayload; v: CkmView; perm: Perm; busy: boolean; client: CkmClient; act: Act; fmt: (n: number) => string;
}) {
  const L = (b: { fa: string; en: string }) => (rtl ? b.fa : b.en);
  const [classFilter, setClassFilter] = useState<"all" | Letter["letterClass"]>("all");
  const [selectedMeeting, setSelectedMeeting] = useState<string>(ws.meetings[0]?.Code ?? "");
  useEffect(() => {
    if (!ws.meetings.some((m) => m.Code === selectedMeeting)) setSelectedMeeting(ws.meetings[0]?.Code ?? "");
  }, [ws.meetings, selectedMeeting]);

  const letterF = useForm({ LetterNo: "", Direction: "incoming", Kind: "general", SubjectFa: "", FromParty: "", ToParty: "", IssuedAt: "", ReceivedAt: ws.today, Links: "", OwnerRole: "", ResponseDays: "", RefLetterNo: "" });
  const [ownerDraft, setOwnerDraft] = useState<Record<string, string>>({});
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [closing, setClosing] = useState<{ no: string; reason: string } | null>(null);
  const meetingF = useForm({ Code: "", TitleFa: "", MeetingType: "weekly", HeldAt: ws.today, Chair: "", Invited: "", Attendees: "" });
  const actionF = useForm({ TitleFa: "", OwnerRole: "", DueDate: "", Links: "" });
  const [cancelling, setCancelling] = useState<{ code: string; reason: string } | null>(null);
  const stF = useForm({ Code: "", NameFa: "", Org: "", RoleFa: "", Power: "3", Interest: "3", CurrentLevel: "neutral", DesiredLevel: "supportive", Channels: "", Frequency: "monthly", OwnerRole: "" });
  const lessonF = useForm({ Code: "", TitleFa: "", Category: "technical", Impact: "medium", SourceRef: "", SituationFa: "", RecommendationFa: "", Tags: "" });
  const [reusing, setReusing] = useState<{ code: string; note: string } | null>(null);
  const ruleF = useForm({ Code: "", EventCode: "notice_due", NameFa: "", Channels: "in_app,email", AudienceRoles: "", EscalateAfterHours: "24", EscalateToRole: "" });

  const filteredLetters = classFilter === "all" ? v.letterRows : v.letterRows.filter((r) => r.l.letterClass === classFilter);
  const selected = v.meetingRows.find((m) => m.row.Code === selectedMeeting) ?? null;
  const meetingActions = v.actionRows.filter((a) => a.row.MeetingCode === selectedMeeting);
  const maxCat = Math.max(...v.coverageByCat.map((c) => c.count), 1);
  const escalating = v.ruleRows.filter((r) => r.level > 0).length;
  const myReuses = new Set(ws.reuses.map((r) => `${r.LessonCode}|${r.UsedBy}`));

  const stateLabel = (st: string) =>
    st === "done" ? (rtl ? "انجام‌شده" : "Done")
      : st === "overdue" ? (rtl ? "معوق" : "Overdue")
      : st === "in_progress" ? (rtl ? "در جریان" : "In progress")
      : st === "cancelled" ? (rtl ? "لغوشده" : "Cancelled") : rtl ? "باز" : "Open";

  return (
    <>
      {/* ═══ تب ۱: مکاتبات ═══ */}
      {tab === "correspondence" && !perm.letters && (
        <Section title={rtl ? "مکاتبات محرمانه است" : "Correspondence is confidential"}>
          <p className="text-[9.5px] tx3">{rtl ? "نقش فعلی مجوز «مشاهده مکاتبات» ندارد؛ سرور نامه‌ها را برای این نقش ارسال نمی‌کند." : "Your role lacks ckm.letter.view; the server does not send letters."}</p>
        </Section>
      )}
      {tab === "correspondence" && perm.letters && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Kpi label={rtl ? "نامه باز" : "Open letters"} value={fmt(v.openLetters)} hint={`${fmt(ws.letters.length)} ${rtl ? "کل" : "total"}${v.drafts ? ` · ${fmt(v.drafts)} ${rtl ? "پیش‌نویس" : "drafts"}` : ""}`} />
            <Kpi label={rtl ? "نقض مهلت قراردادی" : "Time-bar breached"} value={fmt(v.timeBarBreaches)} tone={v.timeBarBreaches ? "text-rose-300" : "text-emerald-300"} hint={rtl ? "حق ادعا در خطر" : "claim right at risk"} />
            <Kpi label={rtl ? "از مهلت گذشته" : "Overdue"} value={fmt(v.overdueLetters)} tone={v.overdueLetters ? "text-amber-300" : "text-emerald-300"} />
            <Kpi label={rtl ? "نزدیک مهلت" : "Due soon"} value={fmt(v.dueSoon)} hint={rtl ? "سه روز کاری" : "3 working days"} />
            <Kpi label={rtl ? "میانگین پاسخ" : "Avg response"} value={v.avgResponse === null ? "—" : `${v.avgResponse}`} tone={(v.avgResponse ?? 0) > 10 ? "text-amber-300" : "tx1"} hint={rtl ? "روز کاری" : "working days"} />
          </div>

          <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1">
            {(["all", "claim_notice", "notice", "instruction", "rfi", "submittal", "ncr_related", "general"] as const).map((c) => (
              <button key={c} onClick={() => setClassFilter(c)} className={`rounded-lg px-2.5 py-1 text-[9px] font-light transition ${classFilter === c ? "toggle-on tx1" : "tx3 hover:tx2"}`}>
                {c === "all" ? (rtl ? "همه" : "All") : L(CLASS_LABEL[c])}
                {c !== "all" && isTimeBarred(c) && <span className="ms-1 text-rose-300">•</span>}
              </button>
            ))}
          </nav>

          <Section title={rtl ? "دفتر مکاتبات" : "Correspondence register"} note={rtl ? "مهلت‌ها بر پایه روز کاری تقویم پروژه، از تاریخ ثبت دبیرخانه · نامهٔ ثبت‌شده حذف نمی‌شود" : "deadlines in project working days · registered letters are never deleted"}>
            <div className="thin-scroll max-h-[460px] overflow-auto">
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>{rtl ? "شماره" : "Ref"}</Th><Th>{rtl ? "نوع" : "Class"}</Th><Th>{rtl ? "موضوع" : "Subject"}</Th><Th>{rtl ? "طرف" : "Party"}</Th>
                    <Th>{rtl ? "مالک پاسخ" : "Owner"}</Th><Th>{rtl ? "مهلت" : "Due"}</Th><Th>{rtl ? "باقی‌مانده" : "Left"}</Th><Th>{rtl ? "ارجاع" : "Links"}</Th><Th>{rtl ? "وضعیت" : "Status"}</Th><Th>{rtl ? "اقدام" : "Action"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLetters.map(({ row, l, due, issues }) => {
                    const st = LETTER_STATUS_LABEL[row.Status] ?? LETTER_STATUS_LABEL.registered;
                    const editable = perm.draft && row.Status !== "closed";
                    return (
                      <tr key={row.LetterNo} className="border-b b-line-soft/50 align-top">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{row.LetterNo}{row.RefLetterNo && <div className="text-[7.5px] tx4">↩ {row.RefLetterNo}</div>}</td>
                        <td className="px-2 py-1">
                          <span className={`rounded px-1.5 py-[1px] text-[8px] ${isTimeBarred(l.letterClass) ? "bg-rose-400/15 text-rose-300" : "bg-white/5 tx3"}`}>{L(CLASS_LABEL[l.letterClass])}</span>
                        </td>
                        <td className="max-w-[260px] px-2 py-1 tx1">
                          <div className="truncate" title={l.subject}>{l.subject}</div>
                          {issues.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {issues.map((i, k) => <span key={k} className={`text-[7.5px] ${i.severity === "error" ? "text-rose-300" : "text-amber-200"}`} title={i.message} dir="ltr">{i.code}</span>)}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1 tx3"><span className="text-[8.5px]">{l.direction === "incoming" ? `← ${l.from}` : `${l.to} →`}</span></td>
                        <td className="px-2 py-1">
                          {editable ? (
                            <input className={`${inputCls} w-24`} value={ownerDraft[row.LetterNo] ?? row.OwnerRole ?? ""} placeholder={rtl ? "بدون مالک" : "unowned"}
                              onChange={(e) => setOwnerDraft((d) => ({ ...d, [row.LetterNo]: e.target.value }))}
                              onBlur={() => {
                                const val = ownerDraft[row.LetterNo];
                                if (val === undefined || val === (row.OwnerRole ?? "")) return;
                                void act(() => client.updateLetter(row.LetterNo, { OwnerRole: val }), rtl ? `مالک ${row.LetterNo} ثبت شد` : "Owner saved").then(() =>
                                  setOwnerDraft((d) => { const { [row.LetterNo]: _x, ...rest } = d; return rest; }));
                              }} />
                          ) : <span className="text-[8.5px] tx2">{row.OwnerRole ?? "—"}</span>}
                        </td>
                        <td className="px-2 py-1 font-mono tx3" dir="ltr">{due ? due.dueDate : "—"}</td>
                        <td className={`px-2 py-1 tabular-nums ${!due ? "tx4" : due.severity === "critical" ? "text-rose-300 font-semibold" : due.severity === "overdue" ? "text-rose-300" : due.severity === "due_soon" ? "text-amber-300" : "text-emerald-300"}`} dir="ltr">
                          {!due ? "—" : l.respondedAt ? "✓" : `${due.daysRemaining}d`}
                        </td>
                        <td className="px-2 py-1 font-mono text-[8px] tx4" dir="ltr">
                          {editable && row.Status === "draft" ? (
                            <input className={`${inputCls} w-20`} value={linkDraft[row.LetterNo] ?? (row.Links ?? []).join(",")} placeholder="CLM-1"
                              onChange={(e) => setLinkDraft((d) => ({ ...d, [row.LetterNo]: e.target.value }))}
                              onBlur={() => {
                                const val = linkDraft[row.LetterNo];
                                if (val === undefined || val === (row.Links ?? []).join(",")) return;
                                void act(() => client.updateLetter(row.LetterNo, { Links: splitList(val) }), rtl ? "ارجاع ثبت شد" : "Links saved").then(() =>
                                  setLinkDraft((d) => { const { [row.LetterNo]: _x, ...rest } = d; return rest; }));
                              }} />
                          ) : (row.Links ?? []).join(" ") || "—"}
                        </td>
                        <td className="px-2 py-1"><span className={`rounded px-1.5 py-[1px] text-[8px] ${st.cls}`}>{L(st)}</span>{row.SignedBy && <div className="text-[7.5px] tx4" dir="ltr">✍ {row.SignedBy}</div>}</td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {closing?.no === row.LetterNo ? (
                            <span className="flex items-center gap-1">
                              <input className={`${inputCls} w-28`} placeholder={rtl ? "دلیل بستن" : "reason"} value={closing.reason} onChange={(e) => setClosing({ no: row.LetterNo, reason: e.target.value })} />
                              <button disabled={busy} className={rowBtn} onClick={async () => { if (await act(() => client.closeLetter(row.LetterNo, { reasonFa: closing.reason }), rtl ? `${row.LetterNo} بسته شد` : "Closed")) setClosing(null); }}>{rtl ? "بستن" : "Close"}</button>
                              <button className="text-[9px] tx4" onClick={() => setClosing(null)}>✕</button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              {row.Status === "draft" && perm.sign && <button disabled={busy} className={rowBtn} onClick={() => void act(() => client.issueLetter(row.LetterNo), rtl ? `${row.LetterNo} امضا و صادر شد` : "Issued", "CKM_LETTER_ISSUED")}>{rtl ? "امضا و صدور" : "Sign & issue"}</button>}
                              {row.Status === "draft" && perm.draft && <button disabled={busy} className="text-[9px] text-rose-300" onClick={() => void act(() => client.deleteLetter(row.LetterNo), rtl ? "پیش‌نویس حذف شد" : "Draft deleted")}>✕</button>}
                              {(row.Status === "registered" || row.Status === "under_review") && perm.draft && (
                                <button disabled={busy} className={rowBtn} onClick={() => void act(() => client.respondLetter(row.LetterNo), rtl ? `پاسخ ${row.LetterNo} ثبت شد` : "Response recorded", "CKM_LETTER_RESPOND")}>{rtl ? "ثبت پاسخ" : "Respond"}</button>
                              )}
                              {row.Status === "responded" && perm.draft && <button disabled={busy} className={rowBtn} onClick={() => void act(() => client.closeLetter(row.LetterNo), rtl ? `${row.LetterNo} بسته شد` : "Closed")}>{rtl ? "بستن" : "Close"}</button>}
                              {(row.Status === "registered" || row.Status === "under_review") && perm.draft && !isTimeBarred(row.Kind) && (
                                <button className="text-[8.5px] tx4 hover:tx2" onClick={() => setClosing({ no: row.LetterNo, reason: "" })}>{rtl ? "بستن بی‌پاسخ" : "close"}</button>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {perm.draft && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5 rounded-xl border b-line-soft bg-black/10 p-2">
                <span className="w-full text-[9px] tx3">
                  {rtl ? "ثبت نامه — وارده مستقیم در دبیرخانه ثبت می‌شود؛ صادره پیش‌نویس است تا فرد دیگری با مجوز امضا صادرش کند" : "Register letter — incoming is registered at once; outgoing stays draft until signed by someone else"}
                </span>
                <input className={`${inputCls} w-36`} placeholder={rtl ? "شماره نامه" : "letter no"} value={letterF.v.LetterNo} onChange={letterF.set("LetterNo")} dir="ltr" />
                <select className={inputCls} value={letterF.v.Direction} onChange={letterF.set("Direction")}>
                  <option value="incoming">{rtl ? "وارده" : "incoming"}</option>
                  <option value="outgoing">{rtl ? "صادره" : "outgoing"}</option>
                </select>
                <select className={inputCls} value={letterF.v.Kind} onChange={letterF.set("Kind")}>
                  {LETTER_CLASSES.map((c) => <option key={c} value={c}>{L(CLASS_LABEL[c])}</option>)}
                </select>
                <input className={`${inputCls} w-56`} placeholder={rtl ? "موضوع" : "subject"} value={letterF.v.SubjectFa} onChange={letterF.set("SubjectFa")} />
                <input className={`${inputCls} w-24`} placeholder={rtl ? "فرستنده" : "from"} value={letterF.v.FromParty} onChange={letterF.set("FromParty")} />
                <input className={`${inputCls} w-24`} placeholder={rtl ? "گیرنده" : "to"} value={letterF.v.ToParty} onChange={letterF.set("ToParty")} />
                <label className="flex flex-col gap-0.5 text-[8px] tx4">{rtl ? "تاریخ نامه" : "issued"}<input className={inputCls} type="date" value={letterF.v.IssuedAt} onChange={letterF.set("IssuedAt")} dir="ltr" /></label>
                {letterF.v.Direction === "incoming" && (
                  <label className="flex flex-col gap-0.5 text-[8px] tx4">{rtl ? "ثبت دبیرخانه" : "received"}<input className={inputCls} type="date" value={letterF.v.ReceivedAt} onChange={letterF.set("ReceivedAt")} dir="ltr" /></label>
                )}
                <input className={`${inputCls} w-28`} placeholder={isTimeBarred(letterF.v.Kind as Letter["letterClass"]) ? (rtl ? "ارجاع (الزامی) CLM-…" : "links (required)") : rtl ? "ارجاع" : "links"} value={letterF.v.Links} onChange={letterF.set("Links")} dir="ltr" />
                <input className={`${inputCls} w-24`} placeholder={rtl ? "مالک پاسخ" : "owner"} value={letterF.v.OwnerRole} onChange={letterF.set("OwnerRole")} />
                <input className={`${inputCls} w-20`} type="number" min={1} placeholder={`${rtl ? "مهلت" : "days"} ${DEFAULT_RESPONSE_DAYS[letterF.v.Kind as Letter["letterClass"]] ?? ""}`} value={letterF.v.ResponseDays} onChange={letterF.set("ResponseDays")} dir="ltr" />
                <input className={`${inputCls} w-28`} placeholder={rtl ? "پیرو/عطف" : "ref letter"} value={letterF.v.RefLetterNo} onChange={letterF.set("RefLetterNo")} dir="ltr" />
                <button disabled={busy || !letterF.v.LetterNo || !letterF.v.SubjectFa} className={btnPrimary}
                  onClick={async () => {
                    const f = letterF.v;
                    const body = {
                      ...f, Links: splitList(f.Links), ResponseDays: num(f.ResponseDays), IssuedAt: f.IssuedAt || undefined,
                      ReceivedAt: f.Direction === "incoming" ? f.ReceivedAt : undefined, RefLetterNo: f.RefLetterNo || undefined,
                    };
                    if (await act(() => client.createLetter(body), rtl ? `نامهٔ ${f.LetterNo} ثبت شد` : "Letter registered", "CKM_LETTER_CREATED")) letterF.reset();
                  }}>
                  {letterF.v.Direction === "incoming" ? (rtl ? "ثبت در دبیرخانه" : "Register") : rtl ? "ذخیرهٔ پیش‌نویس" : "Save draft"}
                </button>
              </div>
            )}
          </Section>

          <Section title={rtl ? "مهلت پیش‌فرض پاسخ بر حسب نوع نامه" : "Default response window by letter class"} note={rtl ? "روز کاری · موارد نشان‌دار مهلت قراردادی الزام‌آور دارند · قابل تغییر برای هر نامه" : "working days · flagged classes are time-barred"}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
              {(Object.keys(DEFAULT_RESPONSE_DAYS) as Letter["letterClass"][]).map((c) => (
                <div key={c} className={`rounded-xl border px-2.5 py-2 ${isTimeBarred(c) ? "border-rose-400/30 bg-rose-400/5" : "b-line-soft bg-black/15"}`}>
                  <div className="text-[8.5px] font-extralight tx3">{L(CLASS_LABEL[c])}</div>
                  <div className="text-[13px] font-semibold tabular-nums tx1" dir="ltr">{fmt(DEFAULT_RESPONSE_DAYS[c])}</div>
                  {isTimeBarred(c) && <div className="text-[7.5px] text-rose-300">{rtl ? "مهلت الزام‌آور" : "time-barred"}</div>}
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* ═══ تب ۲: جلسات و مصوبات ═══ */}
      {tab === "meetings" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label={rtl ? "جلسات ثبت‌شده" : "Meetings"} value={fmt(ws.meetings.length)} />
            <Kpi label={rtl ? "مصوبات باز" : "Open actions"} value={fmt(v.openActions)} />
            <Kpi label={rtl ? "مصوبات معوق" : "Overdue actions"} value={fmt(v.overdueActions)} tone={v.overdueActions ? "text-rose-300" : "text-emerald-300"} />
            <Kpi label={rtl ? "صورت‌جلسه تصویب‌نشده" : "Unapproved minutes"} value={fmt(v.unapprovedMinutes)} tone={v.unapprovedMinutes ? "text-amber-300" : "text-emerald-300"} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            <Section title={rtl ? "جلسات" : "Meetings"} note={rtl ? "برای دیدن مصوبات انتخاب کنید" : "select to view actions"}>
              <div className="space-y-1.5">
                {v.meetingRows.length === 0 && <p className="text-[9px] tx4">{rtl ? "هنوز جلسه‌ای ثبت نشده." : "No meetings yet."}</p>}
                {v.meetingRows.map(({ row, m, h }) => (
                  <button key={m.id} onClick={() => setSelectedMeeting(m.id)} className={`glass-row w-full rounded-lg px-2.5 py-2 text-start transition ${selectedMeeting === m.id ? "row-on" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${h.status === "green" ? "bg-emerald-400" : h.status === "amber" ? "bg-amber-400" : "bg-rose-400"}`} />
                      <span className="min-w-0 flex-1 truncate text-[10px] font-light tx1">{m.title}</span>
                      <span className="shrink-0 rounded bg-white/5 px-1 text-[7.5px] tx4">{L(MEETING_TYPE_LABEL[m.type] ?? { fa: m.type, en: m.type })}</span>
                      <span className="shrink-0 font-mono text-[8px] tx4" dir="ltr">{m.heldAt}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 ps-3.5">
                      <span className="text-[8px] tx3">{rtl ? "حضور" : "Attend"} {h.attendanceRate}%</span>
                      <span className="text-[8px] tx3">·</span>
                      <span className="text-[8px] tx3">{rtl ? "مصوبه" : "Actions"} {fmt(h.actions)}</span>
                      {h.overdue > 0 && <span className="rounded bg-rose-400/15 px-1 py-[1px] text-[7.5px] text-rose-300">{fmt(h.overdue)} {rtl ? "معوق" : "overdue"}</span>}
                      {!m.minutesApproved && <span className="rounded bg-amber-400/15 px-1 py-[1px] text-[7.5px] text-amber-200">{rtl ? "تصویب‌نشده" : "unapproved"}</span>}
                      {!m.distributedAt && <span className="rounded bg-white/5 px-1 py-[1px] text-[7.5px] tx4">{rtl ? "توزیع‌نشده" : "not distributed"}</span>}
                      {row.ApprovedBy && <span className="text-[7.5px] tx4" dir="ltr">✓ {row.ApprovedBy}</span>}
                    </div>
                  </button>
                ))}
              </div>

              {perm.meeting && (
                <div className="mt-2 flex flex-wrap items-end gap-1.5 rounded-xl border b-line-soft bg-black/10 p-2">
                  <span className="w-full text-[9px] tx3">{rtl ? "ثبت صورت‌جلسهٔ جدید — تصویب با فرد دیگری جز ثبت‌کننده" : "Record minutes — approval by someone other than the recorder"}</span>
                  <input className={`${inputCls} w-20`} placeholder={rtl ? "کد" : "code"} value={meetingF.v.Code} onChange={meetingF.set("Code")} dir="ltr" />
                  <input className={`${inputCls} w-44`} placeholder={rtl ? "عنوان جلسه" : "title"} value={meetingF.v.TitleFa} onChange={meetingF.set("TitleFa")} />
                  <select className={inputCls} value={meetingF.v.MeetingType} onChange={meetingF.set("MeetingType")}>
                    {MEETING_TYPES.map((t) => <option key={t} value={t}>{L(MEETING_TYPE_LABEL[t])}</option>)}
                  </select>
                  <input className={inputCls} type="date" value={meetingF.v.HeldAt} onChange={meetingF.set("HeldAt")} dir="ltr" />
                  <input className={`${inputCls} w-28`} placeholder={rtl ? "رئیس جلسه" : "chair"} value={meetingF.v.Chair} onChange={meetingF.set("Chair")} />
                  <input className={`${inputCls} w-full`} placeholder={rtl ? "دعوت‌شدگان (با ویرگول جدا)" : "invited (comma separated)"} value={meetingF.v.Invited} onChange={meetingF.set("Invited")} />
                  <input className={`${inputCls} w-full`} placeholder={rtl ? "حاضران (با ویرگول جدا)" : "attendees"} value={meetingF.v.Attendees} onChange={meetingF.set("Attendees")} />
                  <button disabled={busy || !meetingF.v.Code || !meetingF.v.TitleFa} className={btnPrimary}
                    onClick={async () => {
                      const f = meetingF.v;
                      if (await act(() => client.createMeeting({ ...f, Invited: splitList(f.Invited), Attendees: splitList(f.Attendees) }), rtl ? "صورت‌جلسه ثبت شد" : "Minutes recorded", "CKM_MEETING_RECORDED")) {
                        setSelectedMeeting(f.Code);
                        meetingF.reset();
                      }
                    }}>
                    {rtl ? "ثبت جلسه" : "Record"}
                  </button>
                </div>
              )}
            </Section>

            <Section title={rtl ? "مصوبات جلسه" : "Meeting actions"} note={rtl ? "مصوبه بدون مالک و موعد اصلاً مصوبه نیست · صورت‌جلسهٔ تصویب‌شده قفل است" : "no action without owner and due date · approved minutes are locked"}>
              {selected && (
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[9px]">
                  <span className="tx2">{selected.m.title}</span>
                  <span className="tx4">· {rtl ? "رئیس" : "chair"}: {selected.m.chair}</span>
                  {perm.meeting && !selected.m.minutesApproved && (
                    <>
                      <button disabled={busy} className={btnOk} onClick={() => void act(() => client.approveMeeting(selected.m.id), rtl ? "صورت‌جلسه تصویب شد" : "Minutes approved", "CKM_MINUTES_APPROVED")}>{rtl ? "تصویب صورت‌جلسه" : "Approve"}</button>
                      <button disabled={busy} className="text-[9px] text-rose-300" onClick={() => void act(() => client.deleteMeeting(selected.m.id), rtl ? "جلسه حذف شد" : "Meeting deleted")}>{rtl ? "حذف" : "delete"}</button>
                    </>
                  )}
                  {perm.meeting && selected.m.minutesApproved && !selected.m.distributedAt && (
                    <button disabled={busy} className={btnPrimary} onClick={() => void act(() => client.distributeMeeting(selected.m.id), rtl ? "صورت‌جلسه توزیع شد" : "Distributed", "CKM_MINUTES_DISTRIBUTED")}>{rtl ? "توزیع صورت‌جلسه" : "Distribute"}</button>
                  )}
                  {selected.distGap && selected.distGap.length > 0 && <span className="rounded bg-amber-400/15 px-1.5 text-[8px] text-amber-200">{rtl ? "بی‌نسخه" : "missing"}: {selected.distGap.join("، ")}</span>}
                </div>
              )}
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft"><Th>{rtl ? "مصوبه" : "Action"}</Th><Th>{rtl ? "مالک" : "Owner"}</Th><Th>{rtl ? "موعد" : "Due"}</Th><Th>{rtl ? "وضعیت" : "Status"}</Th><Th /></tr>
                </thead>
                <tbody>
                  {meetingActions.map(({ row, a, state: st }) => (
                    <tr key={a.id} className="border-b b-line-soft/50">
                      <td className="max-w-[240px] px-2 py-1 tx1">
                        <div className="truncate" title={a.title}>{a.title}</div>
                        {a.links && <div className="font-mono text-[7.5px] tx4" dir="ltr">{a.links.join(" ")}</div>}
                        {row.CancelReasonFa && <div className="text-[7.5px] tx4">{row.CancelReasonFa}</div>}
                      </td>
                      <td className="px-2 py-1 tx2">{a.ownerRole}</td>
                      <td className="px-2 py-1 font-mono tx3" dir="ltr">{a.dueDate}</td>
                      <td className="px-2 py-1">
                        <span className={`rounded px-1.5 py-[1px] text-[8px] ${st === "done" ? "bg-emerald-400/15 text-emerald-300" : st === "overdue" ? "bg-rose-400/15 text-rose-300" : st === "in_progress" ? "bg-sky-400/15 text-sky-300" : "bg-white/5 tx3"}`}>{stateLabel(st)}</span>
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {perm.meeting && a.status !== "done" && a.status !== "cancelled" && (
                          cancelling?.code === a.id ? (
                            <span className="flex items-center gap-1">
                              <input className={`${inputCls} w-28`} placeholder={rtl ? "دلیل لغو" : "reason"} value={cancelling.reason} onChange={(e) => setCancelling({ code: a.id, reason: e.target.value })} />
                              <button disabled={busy} className={rowBtn} onClick={async () => { if (await act(() => client.updateAction(a.id, { Status: "cancelled", reasonFa: cancelling.reason }), rtl ? "مصوبه لغو شد" : "Cancelled")) setCancelling(null); }}>{rtl ? "لغو" : "Cancel"}</button>
                              <button className="text-[9px] tx4" onClick={() => setCancelling(null)}>✕</button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              {a.status === "open" && <button disabled={busy} className={rowBtn} onClick={() => void act(() => client.updateAction(a.id, { Status: "in_progress" }), rtl ? "مصوبه در جریان" : "Started")}>{rtl ? "شروع" : "Start"}</button>}
                              <button disabled={busy} className={rowBtn} onClick={() => void act(() => client.updateAction(a.id, { Status: "done" }), rtl ? `مصوبه ${a.id} بسته شد` : "Closed", "CKM_ACTION_CLOSE")}>{rtl ? "بستن" : "Close"}</button>
                              <button className="text-[8.5px] tx4 hover:tx2" onClick={() => setCancelling({ code: a.id, reason: "" })}>{rtl ? "لغو" : "cancel"}</button>
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selected && perm.meeting && !selected.m.minutesApproved && (
                <div className="mt-2 flex flex-wrap items-end gap-1.5">
                  <input className={`${inputCls} w-52`} placeholder={rtl ? "شرح مصوبه (قابل پیگیری)" : "action"} value={actionF.v.TitleFa} onChange={actionF.set("TitleFa")} />
                  <input className={`${inputCls} w-28`} placeholder={rtl ? "مالک" : "owner"} value={actionF.v.OwnerRole} onChange={actionF.set("OwnerRole")} />
                  <input className={inputCls} type="date" value={actionF.v.DueDate} onChange={actionF.set("DueDate")} dir="ltr" />
                  <input className={`${inputCls} w-24`} placeholder={rtl ? "ارجاع" : "links"} value={actionF.v.Links} onChange={actionF.set("Links")} dir="ltr" />
                  <button disabled={busy || !actionF.v.TitleFa} className={btnPrimary}
                    onClick={async () => { if (await act(() => client.createAction(selected.m.id, { ...actionF.v, Links: splitList(actionF.v.Links) }), rtl ? "مصوبه ثبت شد" : "Action added")) actionF.reset(); }}>
                    {rtl ? "افزودن مصوبه" : "Add action"}
                  </button>
                </div>
              )}
            </Section>
          </div>
        </>
      )}

      {/* ═══ تب ۳: ذی‌نفعان ═══ */}
      {tab === "stakeholders" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label={rtl ? "ذی‌نفعان ثبت‌شده" : "Stakeholders"} value={fmt(ws.stakeholders.length)} />
            <Kpi label={rtl ? "ذی‌نفع بحرانی" : "Critical gaps"} value={fmt(v.critical.length)} tone={v.critical.length ? "text-rose-300" : "text-emerald-300"} hint={rtl ? "قدرت بالا + شکاف تعامل" : "high power + gap"} />
            <Kpi label={rtl ? "پوشش برنامه ارتباطات" : "Comms plan coverage"} value={v.coverage === null ? "—" : `${v.coverage}%`} tone={(v.coverage ?? 100) < 90 ? "text-amber-300" : "text-emerald-300"} />
            <Kpi label={rtl ? "کانال ارتباطی بالقوه" : "Potential channels"} value={fmt(v.channels)} hint="n(n−1)/2" />
          </div>

          <Section title={rtl ? "شبکه قدرت — علاقه" : "Power–interest grid"} note={rtl ? "محور افقی علاقه، محور عمودی قدرت" : "x: interest, y: power"}>
            <div className="relative h-64 rounded-xl border b-line-soft bg-black/20">
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                {(["keep_satisfied", "manage_closely", "monitor", "keep_informed"] as const).map((q) => (
                  <div key={q} className="border b-line-soft/40 p-1.5"><span className="text-[7.5px] font-extralight tx4">{L(QUADRANT_LABEL[q])}</span></div>
                ))}
              </div>
              {v.stakeholderRows.map(({ s, gap }, i) => {
                const left = ((s.interest - 1) / 4) * 88 + 4;
                const bottom = ((s.power - 1) / 4) * 84 + 6;
                return (
                  <div key={s.id} className="absolute -translate-x-1/2" style={{ insetInlineStart: `${left}%`, bottom: `${bottom}%` }} title={`${s.name} · ${L(ENGAGEMENT_LABEL[s.current])} → ${L(ENGAGEMENT_LABEL[s.desired])}`}>
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] font-semibold ${gap > 1 ? "bg-rose-400/80 text-black" : gap === 1 ? "bg-amber-400/80 text-black" : "bg-emerald-400/70 text-black"}`}>{i + 1}</span>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title={rtl ? "ماتریس ارتباطات" : "Communication matrix"} note={rtl ? "ذی‌نفع بدون کانال، تناوب یا مالک یعنی برنامه ارتباطات ناقص است" : "missing channel, frequency or owner = incomplete plan"}>
            <div className="thin-scroll max-h-80 overflow-auto">
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft"><Th>#</Th><Th>{rtl ? "ذی‌نفع" : "Stakeholder"}</Th><Th>{rtl ? "قدرت/علاقه" : "P/I"}</Th><Th>{rtl ? "راهبرد" : "Strategy"}</Th><Th>{rtl ? "تعامل فعلی ← مطلوب" : "Engagement"}</Th><Th>{rtl ? "کانال" : "Channels"}</Th><Th>{rtl ? "تناوب" : "Freq."}</Th><Th>{rtl ? "مسئول" : "Owner"}</Th><Th /></tr>
                </thead>
                <tbody>
                  {v.stakeholderRows.map(({ row, s, quadrant: q, gap }, i) => (
                    <tr key={s.id} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 font-mono text-[8px] tx4" dir="ltr">{i + 1}</td>
                      <td className="px-2 py-1"><div className="tx1">{s.name}</div><div className="text-[8px] tx4">{s.org} · {s.role}</div></td>
                      <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{s.power}/{s.interest}</td>
                      <td className="px-2 py-1"><span className={`rounded px-1.5 py-[1px] text-[8px] ${QUADRANT_LABEL[q].tone}`}>{L(QUADRANT_LABEL[q])}</span></td>
                      <td className="px-2 py-1 text-[8.5px]">
                        {perm.stakeholder ? (
                          <select className={`${inputCls} py-0`} value={row.CurrentLevel} onChange={(e) => void act(() => client.updateStakeholder(row.Code, { CurrentLevel: e.target.value }), rtl ? "سطح تعامل به‌روز شد" : "Engagement updated")}>
                            {ENGAGEMENT_LEVELS.map((lv) => <option key={lv} value={lv}>{L(ENGAGEMENT_LABEL[lv])}</option>)}
                          </select>
                        ) : <span className="tx3">{L(ENGAGEMENT_LABEL[s.current])}</span>}
                        <span className="tx4"> → </span>
                        <span className="tx1">{L(ENGAGEMENT_LABEL[s.desired])}</span>
                        {gap > 0 && <span className="ms-1 rounded bg-rose-400/15 px-1 py-[1px] text-[7.5px] text-rose-300" dir="ltr">+{gap}</span>}
                      </td>
                      <td className="px-2 py-1 text-[8.5px] tx3">{s.channel.length ? s.channel.join("، ") : <span className="text-rose-300">{rtl ? "ندارد" : "none"}</span>}</td>
                      <td className="px-2 py-1 text-[8.5px] tx3">{s.frequency ? L(FREQ_LABEL[s.frequency] ?? { fa: s.frequency, en: s.frequency }) : <span className="text-rose-300">—</span>}</td>
                      <td className="px-2 py-1 text-[8.5px] tx2">{s.ownerRole || <span className="text-rose-300">—</span>}</td>
                      <td className="px-2 py-1">{perm.stakeholder && <button disabled={busy} className="text-[9px] text-rose-300" onClick={() => void act(() => client.deleteStakeholder(row.Code), rtl ? "ذی‌نفع حذف شد" : "Deleted")}>✕</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {perm.stakeholder && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5 rounded-xl border b-line-soft bg-black/10 p-2">
                <span className="w-full text-[9px] tx3">{rtl ? "افزودن ذی‌نفع" : "Add stakeholder"}</span>
                <input className={`${inputCls} w-16`} placeholder={rtl ? "کد" : "code"} value={stF.v.Code} onChange={stF.set("Code")} dir="ltr" />
                <input className={`${inputCls} w-44`} placeholder={rtl ? "نام" : "name"} value={stF.v.NameFa} onChange={stF.set("NameFa")} />
                <input className={`${inputCls} w-24`} placeholder={rtl ? "سازمان" : "org"} value={stF.v.Org} onChange={stF.set("Org")} />
                <input className={`${inputCls} w-24`} placeholder={rtl ? "نقش" : "role"} value={stF.v.RoleFa} onChange={stF.set("RoleFa")} />
                <label className="flex flex-col gap-0.5 text-[8px] tx4">{rtl ? "قدرت" : "power"}<input className={`${inputCls} w-12`} type="number" min={1} max={5} value={stF.v.Power} onChange={stF.set("Power")} dir="ltr" /></label>
                <label className="flex flex-col gap-0.5 text-[8px] tx4">{rtl ? "علاقه" : "interest"}<input className={`${inputCls} w-12`} type="number" min={1} max={5} value={stF.v.Interest} onChange={stF.set("Interest")} dir="ltr" /></label>
                <select className={inputCls} value={stF.v.CurrentLevel} onChange={stF.set("CurrentLevel")}>{ENGAGEMENT_LEVELS.map((lv) => <option key={lv} value={lv}>{L(ENGAGEMENT_LABEL[lv as EngagementLevel])}</option>)}</select>
                <select className={inputCls} value={stF.v.DesiredLevel} onChange={stF.set("DesiredLevel")}>{ENGAGEMENT_LEVELS.map((lv) => <option key={lv} value={lv}>{L(ENGAGEMENT_LABEL[lv as EngagementLevel])}</option>)}</select>
                <input className={`${inputCls} w-32`} placeholder={rtl ? "کانال‌ها (ویرگول)" : "channels"} value={stF.v.Channels} onChange={stF.set("Channels")} />
                <select className={inputCls} value={stF.v.Frequency} onChange={stF.set("Frequency")}>{FREQUENCIES.map((f) => <option key={f} value={f}>{L(FREQ_LABEL[f])}</option>)}</select>
                <input className={`${inputCls} w-24`} placeholder={rtl ? "مسئول ارتباط" : "owner"} value={stF.v.OwnerRole} onChange={stF.set("OwnerRole")} />
                <button disabled={busy || !stF.v.Code || !stF.v.NameFa} className={btnPrimary}
                  onClick={async () => { if (await act(() => client.createStakeholder({ ...stF.v, Power: Number(stF.v.Power), Interest: Number(stF.v.Interest), Channels: splitList(stF.v.Channels) }), rtl ? "ذی‌نفع ثبت شد" : "Stakeholder added")) stF.reset(); }}>
                  {rtl ? "ثبت" : "Add"}
                </button>
              </div>
            )}
          </Section>
        </>
      )}

      {/* ═══ تب ۴: اطلاع‌رسانی ═══ */}
      {tab === "notifications" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label={rtl ? "قواعد فعال" : "Active rules"} value={fmt(ws.rules.filter((r) => r.Active).length)} hint={`${fmt(ws.rules.length)} ${rtl ? "کل" : "total"}`} />
            <Kpi label={rtl ? "قاعدهٔ در حال تشدید" : "Escalating now"} value={fmt(escalating)} tone={escalating ? "text-amber-300" : "text-emerald-300"} hint={rtl ? "از موارد معلق واقعی" : "from live pending items"} />
            <Kpi label={rtl ? "رویداد بدون قاعدهٔ فعال" : "Uncovered events"} value={fmt(v.uncoveredEvents.length)} tone={v.uncoveredEvents.length ? "text-amber-300" : "text-emerald-300"} />
            <Kpi label={rtl ? "کانال‌های پیکربندی‌شده" : "Configured channels"} value={fmt(new Set(ws.rules.flatMap((r) => r.Channels ?? [])).size)} />
          </div>

          <Section title={rtl ? "قواعد اطلاع‌رسانی و تشدید" : "Notification & escalation rules"} note={rtl ? `سطح تشدید = قدیمی‌ترین مورد معلق همان رویداد ÷ آستانه (تا امروز ${ws.today})` : "level = oldest pending item ÷ threshold"}>
            <table className="w-full text-[9.5px]">
              <thead className="tx3">
                <tr className="border-b b-line-soft"><Th>{rtl ? "رویداد" : "Event"}</Th><Th>{rtl ? "کانال" : "Channels"}</Th><Th>{rtl ? "مخاطب" : "Audience"}</Th><Th>{rtl ? "تشدید پس از" : "Escalate after"}</Th><Th>{rtl ? "تشدید به" : "Escalate to"}</Th><Th>{rtl ? "معلق" : "Pending"}</Th><Th>{rtl ? "سطح" : "Level"}</Th><Th /></tr>
              </thead>
              <tbody>
                {v.ruleRows.map(({ row, rule, items, maxHours, level }) => (
                  <tr key={row.Code} className="border-b b-line-soft/50">
                    <td className="px-2 py-1 tx1">
                      {rule.event}
                      <div className="text-[7.5px] tx4">{L(EVENT_CATALOG[row.EventCode] ?? { fa: row.EventCode, en: row.EventCode })}</div>
                      {!rule.active && <span className="rounded bg-white/5 px-1 py-[1px] text-[7.5px] tx4">{rtl ? "غیرفعال" : "off"}</span>}
                    </td>
                    <td className="px-2 py-1 tx3" dir="ltr">{rule.channels.join(" · ")}</td>
                    <td className="px-2 py-1 tx2">{rule.audienceRoles.join("، ")}</td>
                    <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{fmt(rule.escalateAfterHours)}h</td>
                    <td className="px-2 py-1 tx2">{rule.escalateToRole || "—"}</td>
                    <td className="px-2 py-1 tabular-nums tx3" title={items.map((x) => x.ref).join("، ")} dir="ltr">{items.length ? `${fmt(items.length)} · ${fmt(maxHours)}h` : "—"}</td>
                    <td className="px-2 py-1">
                      <span className={`rounded px-1.5 py-[1px] text-[8px] ${level === 3 ? "bg-rose-400/15 text-rose-300" : level === 2 ? "bg-amber-400/15 text-amber-200" : level === 1 ? "bg-sky-400/15 text-sky-300" : "bg-white/5 tx4"}`} dir="ltr">L{level}</span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {perm.notify && (
                        <span className="flex items-center gap-1">
                          <button disabled={busy} className={rowBtn} onClick={() => void act(() => client.updateRule(row.Code, { Active: !row.Active }), rtl ? "قاعده به‌روز شد" : "Rule updated")}>{row.Active ? (rtl ? "غیرفعال" : "Disable") : rtl ? "فعال" : "Enable"}</button>
                          <button disabled={busy} className="text-[9px] text-rose-300" onClick={() => void act(() => client.deleteRule(row.Code), rtl ? "قاعده حذف شد" : "Deleted")}>✕</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {v.uncoveredEvents.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[8.5px]">
                <span className="tx3">{rtl ? "رویداد معلق بدون قاعدهٔ فعال:" : "Pending without an active rule:"}</span>
                {v.uncoveredEvents.map((e) => <span key={e} className="rounded-lg bg-amber-400/15 px-2 py-0.5 text-amber-200">{L(EVENT_CATALOG[e])} ({fmt(v.pending[e].length)})</span>)}
              </div>
            )}
            {perm.notify && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5 rounded-xl border b-line-soft bg-black/10 p-2">
                <span className="w-full text-[9px] tx3">{rtl ? "قاعدهٔ جدید — ارسال واقعی ایمیل/پیامک در فاز یکپارچه‌سازی (P9)" : "New rule — actual email/SMS delivery arrives in P9"}</span>
                <input className={`${inputCls} w-16`} placeholder={rtl ? "کد" : "code"} value={ruleF.v.Code} onChange={ruleF.set("Code")} dir="ltr" />
                <select className={inputCls} value={ruleF.v.EventCode} onChange={ruleF.set("EventCode")}>{EVENT_CODES.map((e) => <option key={e} value={e}>{L(EVENT_CATALOG[e as EventCode])}</option>)}</select>
                <input className={`${inputCls} w-44`} placeholder={rtl ? "عنوان قاعده" : "name"} value={ruleF.v.NameFa} onChange={ruleF.set("NameFa")} />
                <input className={`${inputCls} w-28`} placeholder={CHANNELS.join(",")} value={ruleF.v.Channels} onChange={ruleF.set("Channels")} dir="ltr" />
                <input className={`${inputCls} w-32`} placeholder={rtl ? "مخاطبان (ویرگول)" : "audience"} value={ruleF.v.AudienceRoles} onChange={ruleF.set("AudienceRoles")} />
                <label className="flex flex-col gap-0.5 text-[8px] tx4">{rtl ? "ساعت تا تشدید" : "hours"}<input className={`${inputCls} w-16`} type="number" min={1} value={ruleF.v.EscalateAfterHours} onChange={ruleF.set("EscalateAfterHours")} dir="ltr" /></label>
                <input className={`${inputCls} w-28`} placeholder={rtl ? "تشدید به" : "escalate to"} value={ruleF.v.EscalateToRole} onChange={ruleF.set("EscalateToRole")} />
                <button disabled={busy || !ruleF.v.Code || !ruleF.v.NameFa} className={btnPrimary}
                  onClick={async () => { if (await act(() => client.createRule({ ...ruleF.v, Channels: splitList(ruleF.v.Channels), AudienceRoles: splitList(ruleF.v.AudienceRoles), EscalateAfterHours: Number(ruleF.v.EscalateAfterHours) }), rtl ? "قاعده ثبت شد" : "Rule added")) ruleF.reset(); }}>
                  {rtl ? "ثبت قاعده" : "Add rule"}
                </button>
              </div>
            )}
          </Section>

          <Section title={rtl ? "شکاف توزیع صورت‌جلسات" : "Minutes distribution gaps"} note={rtl ? "دعوت‌شدگانی که نسخهٔ صورت‌جلسهٔ توزیع‌شده به آن‌ها نرسیده" : "invited recipients not covered by distribution"}>
            {v.meetingRows.length === 0 ? <p className="text-[9px] tx4">—</p> : (
              <div className="space-y-1">
                {v.meetingRows.map(({ m, distGap }) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-1.5 text-[8.5px]">
                    <span className="tx2">{m.title}</span>
                    {distGap === null ? <span className="rounded bg-white/5 px-1.5 tx4">{rtl ? "توزیع‌نشده" : "not distributed"}</span>
                      : distGap.length === 0 ? <span className="text-emerald-300">{rtl ? "پوشش کامل" : "fully covered"}</span>
                      : distGap.map((d) => <span key={d} className="rounded-lg bg-amber-400/15 px-2 py-0.5 text-amber-200">{d}</span>)}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      {/* ═══ تب ۵: دانش و درس‌آموخته ═══ */}
      {tab === "knowledge" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label={rtl ? "درس‌آموخته ثبت‌شده" : "Lessons captured"} value={fmt(ws.lessons.length)} />
            <Kpi label={rtl ? "تأییدشده" : "Validated"} value={fmt(ws.lessons.filter((l) => l.Validated).length)} />
            <Kpi label={rtl ? "نرخ استفاده مجدد" : "Utilization"} value={v.utilization === null ? "—" : `${v.utilization}%`} tone={(v.utilization ?? 100) < 40 ? "text-amber-300" : "text-emerald-300"} hint={rtl ? "آستانه ۴۰٪" : "threshold 40%"} />
            <Kpi label={rtl ? "کل دفعات استفاده" : "Total reuse"} value={fmt(v.totalReuse)} />
          </div>

          <Section title={rtl ? "پوشش دانش بر حسب حوزه" : "Knowledge coverage by category"} note={rtl ? "ستون کوتاه یعنی حوزه کور سازمانی" : "a short bar = organisational blind spot"}>
            <div className="flex h-32 items-end gap-2">
              {v.coverageByCat.map((c) => (
                <div key={c.category} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end justify-center">
                    <div className={`w-full rounded-t ${c.count === 0 ? "bg-rose-400/30" : "bg-violet-400/60"}`} style={{ height: `${Math.max(4, (c.count / maxCat) * 100)}%` }} />
                  </div>
                  <span className="truncate text-[7.5px] tx4">{L(CATEGORY_LABEL[c.category])}</span>
                  <span className="text-[8px] tabular-nums tx3" dir="ltr">{fmt(c.count)}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title={rtl ? "بانک درس‌آموخته — مرتب‌شده بر پایه ارزش" : "Lessons register — ranked by value"} note={rtl ? "ارزش = اثر + تأیید + استفاده مجدد + منشأ · تأییدکننده ≠ ثبت‌کننده" : "value = impact + validation + reuse + traceable source"}>
            <div className="space-y-2">
              {v.rankedLessons.map(({ row, l, v: val, issues }) => (
                <div key={l.id} className="rounded-xl border b-line-soft bg-black/15 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[8.5px] tx4" dir="ltr">{l.id}</span>
                    <span className="rounded bg-violet-400/15 px-1.5 py-[1px] text-[8px] text-violet-300">{L(CATEGORY_LABEL[l.category])}</span>
                    <span className={`rounded px-1.5 py-[1px] text-[8px] ${l.impact === "high" ? "bg-rose-400/15 text-rose-300" : l.impact === "medium" ? "bg-amber-400/15 text-amber-200" : "bg-white/5 tx3"}`}>
                      {l.impact === "high" ? (rtl ? "اثر بالا" : "High") : l.impact === "medium" ? (rtl ? "اثر متوسط" : "Medium") : rtl ? "اثر کم" : "Low"}
                    </span>
                    {l.validated ? (
                      <span className="rounded bg-emerald-400/15 px-1.5 py-[1px] text-[8px] text-emerald-300">{rtl ? "تأییدشده" : "Validated"}{row.ValidatedBy && <span className="tx4" dir="ltr"> · {row.ValidatedBy}</span>}</span>
                    ) : perm.lesson ? (
                      <button disabled={busy} onClick={() => void act(() => client.validateLesson(l.id), rtl ? "درس تأیید شد" : "Validated", "CKM_LESSON_VALIDATE")} className="glass-row rounded px-1.5 py-[1px] text-[8px] tx2 transition hover:tx1">{rtl ? "تأیید شورای دانش" : "Validate"}</button>
                    ) : <span className="rounded bg-white/5 px-1.5 py-[1px] text-[8px] tx4">{rtl ? "در انتظار تأیید" : "pending"}</span>}
                    {!l.validated && perm.lesson && <button disabled={busy} className="text-[9px] text-rose-300" onClick={() => void act(() => client.deleteLesson(l.id), rtl ? "درس حذف شد" : "Deleted")}>✕</button>}
                    <span className="ms-auto flex items-center gap-1.5">
                      <span className="text-[8px] tx4" dir="ltr">{rtl ? "استفاده" : "reuse"} {fmt(l.reuseCount)}</span>
                      <span className="rounded-lg border b-line-soft px-1.5 py-[1px] text-[9px] font-semibold tabular-nums tx1" dir="ltr">{fmt(val)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 text-[10px] font-light tx1">{l.title}</div>
                  <div className="mt-1 text-[8.5px] font-extralight tx3">{l.situation}</div>
                  <div className="mt-1 rounded-lg bg-emerald-400/5 px-2 py-1 text-[9px] tx2"><span className="text-emerald-300">{rtl ? "توصیه: " : "Recommendation: "}</span>{l.recommendation}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[7.5px] tx4" dir="ltr">← {l.sourceRef || "—"}</span>
                    {l.capturedBy && <span className="text-[7.5px] tx4" dir="ltr">✎ {l.capturedBy} · {l.capturedAt}</span>}
                    {l.tags.map((tg) => <span key={tg} className="rounded bg-white/5 px-1.5 py-[1px] text-[7.5px] tx4">{tg}</span>)}
                    {issues.map((i, k) => <span key={k} className={`text-[7.5px] ${i.severity === "error" ? "text-rose-300" : "text-amber-200"}`}><span dir="ltr">{i.code}</span> {i.message}</span>)}
                    {l.validated && (
                      me && myReuses.has(`${l.id}|${me}`) ? <span className="ms-auto text-[8px] text-emerald-300">{rtl ? "استفادهٔ شما ثبت شده" : "you applied this"}</span> : reusing?.code === l.id ? (
                        <span className="ms-auto flex items-center gap-1">
                          <input className={`${inputCls} w-56`} placeholder={rtl ? "کجا و چگونه به کار رفت؟" : "where/how was it applied?"} value={reusing.note} onChange={(e) => setReusing({ code: l.id, note: e.target.value })} />
                          <button disabled={busy || reusing.note.trim().length < 10} className={rowBtn} onClick={async () => { if (await act(() => client.reuseLesson(l.id, reusing.note), rtl ? "استفادهٔ مجدد ثبت شد" : "Reuse recorded", "CKM_LESSON_REUSE")) setReusing(null); }}>{rtl ? "ثبت" : "Save"}</button>
                          <button className="text-[9px] tx4" onClick={() => setReusing(null)}>✕</button>
                        </span>
                      ) : (
                        <button onClick={() => setReusing({ code: l.id, note: "" })} className="glass-row ms-auto rounded-lg px-2 py-0.5 text-[8.5px] font-light tx2 transition hover:tx1">{rtl ? "استفاده در پروژه جاری" : "Apply here"}</button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
            {perm.lesson && (
              <div className="mt-2 flex flex-wrap items-end gap-1.5 rounded-xl border b-line-soft bg-black/10 p-2">
                <span className="w-full text-[9px] tx3">{rtl ? "ثبت درس‌آموخته — منشأ (NCR، ادعا، ریسک، حادثه یا جلسه) و توصیهٔ اجرایی الزامی است" : "Capture lesson — source and actionable recommendation required"}</span>
                <input className={`${inputCls} w-16`} placeholder={rtl ? "کد" : "code"} value={lessonF.v.Code} onChange={lessonF.set("Code")} dir="ltr" />
                <input className={`${inputCls} w-64`} placeholder={rtl ? "عنوان" : "title"} value={lessonF.v.TitleFa} onChange={lessonF.set("TitleFa")} />
                <select className={inputCls} value={lessonF.v.Category} onChange={lessonF.set("Category")}>{ALL_CATEGORIES.map((c) => <option key={c} value={c}>{L(CATEGORY_LABEL[c])}</option>)}</select>
                <select className={inputCls} value={lessonF.v.Impact} onChange={lessonF.set("Impact")}>
                  <option value="low">{rtl ? "اثر کم" : "low"}</option><option value="medium">{rtl ? "اثر متوسط" : "medium"}</option><option value="high">{rtl ? "اثر بالا" : "high"}</option>
                </select>
                <input className={`${inputCls} w-24`} placeholder={rtl ? "منشأ مثلاً NCR-338" : "source"} value={lessonF.v.SourceRef} onChange={lessonF.set("SourceRef")} dir="ltr" />
                <input className={`${inputCls} w-full`} placeholder={rtl ? "شرح وضعیت" : "situation"} value={lessonF.v.SituationFa} onChange={lessonF.set("SituationFa")} />
                <input className={`${inputCls} w-full`} placeholder={rtl ? "توصیهٔ اجرایی (مشخص و قابل اقدام)" : "actionable recommendation"} value={lessonF.v.RecommendationFa} onChange={lessonF.set("RecommendationFa")} />
                <input className={`${inputCls} w-40`} placeholder={rtl ? "برچسب‌ها (ویرگول)" : "tags"} value={lessonF.v.Tags} onChange={lessonF.set("Tags")} />
                <button disabled={busy || !lessonF.v.Code || !lessonF.v.TitleFa} className={btnPrimary}
                  onClick={async () => { if (await act(() => client.createLesson({ ...lessonF.v, Tags: splitList(lessonF.v.Tags) }), rtl ? "درس‌آموخته ثبت شد — در انتظار تأیید فرد دیگر" : "Lesson captured", "CKM_LESSON_CAPTURED")) lessonF.reset(); }}>
                  {rtl ? "ثبت درس" : "Capture"}
                </button>
              </div>
            )}
          </Section>
        </>
      )}

      {/* ═══ تب ۶: تحلیل ═══ */}
      {tab === "analytics" && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label={rtl ? "میانگین زمان پاسخ" : "Avg response time"} value={perm.letters && v.avgResponse !== null ? `${v.avgResponse}` : "—"} hint={rtl ? "روز کاری · آستانه ۱۰" : "working days · threshold 10"} tone={(v.avgResponse ?? 0) > 10 ? "text-amber-300" : "tx1"} />
            <Kpi label={rtl ? "نرخ بستن مصوبات" : "Action closure"} value={v.closureRate === null ? "—" : `${v.closureRate}%`} hint={rtl ? "بدون لغوشده‌ها" : "excl. cancelled"} />
            <Kpi label={rtl ? "پوشش برنامه ارتباطات" : "Comms coverage"} value={v.coverage === null ? "—" : `${v.coverage}%`} />
            <Kpi label={rtl ? "نرخ استفاده از دانش" : "Knowledge utilization"} value={v.utilization === null ? "—" : `${v.utilization}%`} tone={(v.utilization ?? 100) < 40 ? "text-amber-300" : "text-emerald-300"} />
          </div>

          {perm.letters && (
            <Section title={rtl ? "توزیع مکاتبات بر حسب نوع و وضعیت مهلت" : "Correspondence by class and deadline status"} note={rtl ? "پیش‌نویس‌ها شمرده نمی‌شوند" : "drafts excluded"}>
              {v.byClass.length === 0 ? <p className="text-[9px] tx4">—</p> : (
                <table className="w-full text-[9.5px]">
                  <thead className="tx3">
                    <tr className="border-b b-line-soft"><Th>{rtl ? "نوع" : "Class"}</Th><Th>{rtl ? "تعداد" : "Count"}</Th><Th>{rtl ? "پاسخ‌داده" : "Answered"}</Th><Th>{rtl ? "معوق" : "Overdue"}</Th><Th>{rtl ? "نقض مهلت" : "Breach"}</Th></tr>
                  </thead>
                  <tbody>
                    {v.byClass.map((c) => (
                      <tr key={c.cls} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 tx1">{L(CLASS_LABEL[c.cls])}{isTimeBarred(c.cls) && <span className="ms-1 text-[7.5px] text-rose-300">•</span>}</td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmt(c.total)}</td>
                        <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{fmt(c.answered)}</td>
                        <td className={`px-2 py-1 tabular-nums ${c.overdue ? "text-amber-300" : "tx3"}`} dir="ltr">{fmt(c.overdue)}</td>
                        <td className={`px-2 py-1 tabular-nums ${c.breach ? "text-rose-300 font-semibold" : "tx3"}`} dir="ltr">{fmt(c.breach)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          )}

          <Section title={rtl ? "سلامت جلسات" : "Meeting health"}>
            <table className="w-full text-[9.5px]">
              <thead className="tx3">
                <tr className="border-b b-line-soft"><Th>{rtl ? "جلسه" : "Meeting"}</Th><Th>{rtl ? "حضور" : "Attendance"}</Th><Th>{rtl ? "مصوبه" : "Actions"}</Th><Th>{rtl ? "نرخ بستن" : "Closure"}</Th><Th>{rtl ? "ایراد" : "Issues"}</Th></tr>
              </thead>
              <tbody>
                {v.meetingRows.map(({ m, h }) => (
                  <tr key={m.id} className="border-b b-line-soft/50">
                    <td className="px-2 py-1 tx1">{m.title}</td>
                    <td className={`px-2 py-1 tabular-nums ${h.attendanceRate < 70 ? "text-amber-300" : "tx2"}`} dir="ltr">{h.attendanceRate}%</td>
                    <td className="px-2 py-1 tabular-nums tx3" dir="ltr">{fmt(h.actions)}</td>
                    <td className={`px-2 py-1 tabular-nums ${h.closureRate < 50 ? "text-rose-300" : "tx2"}`} dir="ltr">{h.closureRate}%</td>
                    <td className="px-2 py-1 text-[8.5px] tx3">{h.issues.length ? h.issues.join(" · ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title={rtl ? "مرزهای مالکیت داده" : "Data ownership boundaries"} note={rtl ? "این ماژول چه چیزی را می‌نویسد و چه چیزی را فقط می‌خواند" : "what this module writes versus reads"}>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-2.5">
                <div className="text-[9px] font-semibold text-emerald-300">{rtl ? "مالک (می‌نویسد) — فقط از /api/ckm" : "Owns (writes) — only via /api/ckm"}</div>
                <ul className="mt-1 space-y-0.5 text-[8.5px] font-light tx2">
                  <li>{rtl ? "دفتر مکاتبات و مهلت پاسخ" : "Correspondence register and response deadlines"}</li>
                  <li>{rtl ? "صورت‌جلسه و مصوبات" : "Minutes and action register"}</li>
                  <li>{rtl ? "ثبت ذی‌نفعان و برنامه ارتباطات" : "Stakeholder register and comms plan"}</li>
                  <li>{rtl ? "بانک درس‌آموخته و شمارنده استفاده مجدد" : "Lessons register and reuse counter"}</li>
                  <li>{rtl ? "قواعد اطلاع‌رسانی و تشدید" : "Notification & escalation rules"}</li>
                </ul>
              </div>
              <div className="rounded-xl border b-line-soft bg-black/15 p-2.5">
                <div className="text-[9px] font-semibold tx2">{rtl ? "فقط می‌خواند" : "Reads only"}</div>
                <ul className="mt-1 space-y-0.5 text-[8.5px] font-light tx3">
                  <li>{rtl ? "فایل مدرک و نسخه‌ها ← مدیریت مستندات" : "Document files and revisions ← Document module"}</li>
                  <li>{rtl ? "ادعا، تغییر و ریسک ← ریسک و ادعا" : "Claims, changes and risks ← RCC module"}</li>
                  <li>{rtl ? "عدم انطباق ← کیفیت" : "Non-conformance ← Quality module"}</li>
                  <li>{rtl ? "ماتریس اختیار و سطوح تأیید ← حاکمیت" : "Authority matrix ← Governance module"}</li>
                  <li>{rtl ? "تقویم کاری پروژه ← برنامه‌ریزی" : "Project work calendar ← Planning module"}</li>
                </ul>
              </div>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
