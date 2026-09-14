import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { type Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../services/auditLogger";
import {
  DISCIPLINE_FA,
  DISCIPLINES,
  ENG_REPORT_CATALOG,
  ENG_VERSION,
  PURPOSE_FA,
  REVIEW_CODE_FA,
  ROC_STEPS,
  TQ_KIND_FA,
} from "../services/engineering";

/* شش تب = شش زیرماژول «مدیریت مهندسی و طراحی» */
export type EngTab = "mdr" | "review" | "idc" | "field" | "vendor" | "dashboard";

const TABS: { id: EngTab; fa: string; en: string; icon: string }[] = [
  { id: "mdr", fa: "فهرست مدارک", en: "Document Register", icon: "📋" },
  { id: "review", fa: "بررسی و نظرات", en: "Review & CRS", icon: "✍️" },
  { id: "idc", fa: "بین‌دیسیپلینی", en: "Inter-Discipline", icon: "🔗" },
  { id: "field", fa: "تغییرات کارگاهی", en: "Field Changes", icon: "🏗" },
  { id: "vendor", fa: "مدارک سازندگان", en: "Vendor Prints", icon: "🏭" },
  { id: "dashboard", fa: "پیشرفت و شاخص‌ها", en: "Progress & KPIs", icon: "📈" },
];

const PROJECT_ID = "p1";

/* قالب‌های خروجی گزارش A4 — سریال‌سازهای rpt-v1 روی سرور. */
const ENG_EXPORTS: { format: string; fa: string; en: string }[] = [
  { format: "html", fa: "چاپ", en: "Print" },
  { format: "word", fa: "ورد", en: "Word" },
  { format: "excel", fa: "اکسل", en: "Excel" },
  { format: "csv", fa: "CSV", en: "CSV" },
];

/* گزارش در زبانهٔ تازه باز می‌شود تا وضعیت میز کار حفظ شود.
 * فرمت چاپی HTML است و PDF از مسیر چاپ مرورگر گرفته می‌شود؛ این کار
 * وابستگی npm به موتور PDF را حذف می‌کند و سربرگ سه‌لوگو را دست‌نخورده نگه می‌دارد. */
function openEngReport(code: string, format: string, audience: string): void {
  const url = `/api/eng/reports/${code}/render?projectId=${PROJECT_ID}&format=${format}&audience=${audience}`;
  logAudit("ENG_REPORT_EXPORT", "Engineering", `${code} · ${format} · ${audience}`);
  window.open(url, "_blank", "noopener");
}

type Props = { lang: Lang; onBack: () => void };

type Json = Record<string, any>;

/** فراخوان API با مدیریت خطا؛ در dev ممکن است HTML برگردد پس نوع پاسخ بررسی می‌شود. */
async function fetchJson(path: string): Promise<Json | null> {
  try {
    const res = await fetch(path, { headers: { accept: "application/json" } });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null;
    const body = await res.json();
    return body?.ok ? body.data : null;
  } catch {
    return null;
  }
}

/* ═══════════ زیرساخت فرم‌های ورود داده ═══════════
 * تا پیش از این کارگاه فقط خواندنی بود و ثبت از راه اکسل انجام می‌شد.
 * سرور همان اعتبارسنجی را دوباره انجام می‌دهد؛ آنچه اینجاست فقط برای
 * کوتاه کردن رفت‌وبرگشت کاربر است، نه جای کنترل سمت سرور. */

/* گزینه‌های آماده — از خود موتور می‌آیند تا با اسکیما یکی بمانند. */
const DISCIPLINE_OPTIONS = DISCIPLINES.map((d) => ({ value: d, fa: DISCIPLINE_FA[d] }));

const PURPOSE_OPTIONS = [
  { value: "DRAFT", fa: "پیش‌نویس" },
  { value: "IDC", fa: "بررسی بین‌دیسیپلینی" },
  { value: "IFA", fa: "ارسال برای تأیید" },
  { value: "IFC", fa: "صدور برای اجرا" },
  { value: "ASBUILT", fa: "چون‌ساخت" },
];

const SEVERITY_OPTIONS = [
  { value: "editorial", fa: "ویرایشی" },
  { value: "minor", fa: "جزئی" },
  { value: "major", fa: "عمده" },
  { value: "critical", fa: "بحرانی" },
];

const TQ_KIND_OPTIONS = [
  { value: "TQ", fa: "استعلام فنی" },
  { value: "FCR", fa: "درخواست تغییر کارگاهی" },
  { value: "DCN", fa: "ابلاغیه تغییر طراحی" },
];

type FieldKind = "text" | "number" | "date" | "select" | "textarea";

type FieldSpec = {
  name: string;
  fa: string;
  kind: FieldKind;
  required?: boolean;
  options?: { value: string; fa: string }[];
  placeholder?: string;
  hintFa?: string;
  span2?: boolean;
};

type SubmitState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "ok"; messageFa: string }
  | { phase: "error"; messageFa: string; issues?: { field: string; messageFa: string }[] };

/** POST با هویت کاربر؛ خطای اعتبارسنجی سرور به میدان‌ها بازگردانده می‌شود. */
async function postEng(
  path: string,
  body: Record<string, unknown>,
  userId: string,
): Promise<{ ok: true; data: Json } | { ok: false; messageFa: string; issues?: { field: string; messageFa: string }[] }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-user-id": userId },
      body: JSON.stringify(body),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return { ok: false, messageFa: "پاسخ سرور قابل خواندن نبود" };
    }
    const j = await res.json();
    if (j?.ok) return { ok: true, data: j.data };

    const err = j?.error ?? {};
    /* پیام ۴۰۳ باید بگوید «اجازه نداری»، نه «خطای ناشناخته». */
    if (res.status === 401) return { ok: false, messageFa: "برای ثبت باید وارد شوید" };
    if (res.status === 403) return { ok: false, messageFa: err.detail || "نقش شما اجازهٔ این ثبت را ندارد" };
    if (res.status === 409) return { ok: false, messageFa: err.message || "رکورد تکراری است" };
    return { ok: false, messageFa: err.message || "ثبت انجام نشد", issues: err.issues };
  } catch {
    return { ok: false, messageFa: "ارتباط با سرور برقرار نشد" };
  }
}

/* ═══════════ اقدام‌های یکپارچه‌سازی ═══════════
 * هر اقدام دو مرحله دارد: نخست پیش‌نمایش بدون اثر (dry-run) و سپس اعمال
 * با تأیید صریح. دلیلش این است که این اقدام‌ها به ماژول‌های دیگر می‌نویسند —
 * قفل فعالیت، ادعای تمدید مدت علیه کارفرما، درخواست خرید — و برگرداندنشان
 * از راه رابط کاربری ممکن نیست. */

type EngAction = {
  code: string;
  titleFa: string;
  descFa: string;
  path: string;
  /** خلاصهٔ آنچه اجرا خواهد کرد، از پاسخ dry-run ساخته می‌شود. */
  summarize: (plan: Json, data: Json) => string;
  /** اقدام‌هایی که خارج از ماژول اثر دائمی دارند، تأیید سخت‌تری می‌گیرند. */
  heavy?: boolean;
};

const ENG_ACTIONS: EngAction[] = [
  {
    code: "sync-ifc-locks",
    titleFa: "همگام‌سازی قفل فعالیت با صدور IFC",
    descFa: "فعالیت‌های وابسته به مدرکِ صادرنشده را قفل و آزادشده‌ها را باز می‌کند",
    path: "/api/eng/pex/sync-ifc-locks",
    heavy: true,
    summarize: (p) =>
      `${(p.lock as Json[])?.length ?? 0} قفل تازه · ${(p.release as Json[])?.length ?? 0} آزادسازی · ${p.unchanged ?? 0} بدون تغییر`,
  },
  {
    code: "draft-crs",
    titleFa: "پیش‌نویس درخواست تغییر از استعلام‌ها",
    descFa: "استعلام‌های دارای اثر زمان یا هزینه را به درخواست تغییر تبدیل می‌کند",
    path: "/api/eng/rcc/draft-crs",
    heavy: true,
    summarize: (p) =>
      `${(p.drafts as Json[])?.length ?? 0} پیش‌نویس · ${Number(p.skippedNoImpact ?? 0)} استعلام بدون اثر`,
  },
  {
    code: "draft-eot",
    titleFa: "پیش‌نویس ادعای تمدید مدت",
    descFa: "تأخیر بررسی کارفرما را به ادعای تمدید مدت با مستند تبدیل می‌کند",
    path: "/api/eng/rcc/draft-eot",
    heavy: true,
    summarize: (p) => {
      const d = (p.drafts as Json[]) ?? [];
      const days = d.reduce((s, x) => s + Number(x.extensionDays ?? 0), 0);
      return `${d.length} ادعا · مجموع ${days} روز تمدید`;
    },
  },
  {
    code: "draft-dcn",
    titleFa: "پیش‌نویس ابلاغیه تغییر طراحی از عدم انطباق",
    descFa: "عدم انطباق‌های با ریشهٔ طراحی را به ابلاغیه تغییر تبدیل می‌کند",
    path: "/api/eng/qms/draft-dcn",
    summarize: (p) =>
      `${(p.drafts as Json[])?.length ?? 0} ابلاغیه · ${Number(p.skippedNotDesign ?? 0)} عدم انطباق بدون ریشهٔ طراحی`,
  },
  {
    code: "draft-mr",
    titleFa: "پیش‌نویس درخواست کالا از مدارک صادرشده",
    descFa: "فقط از مدرک با وضعیت IFC درخواست کالا می‌سازد",
    path: "/api/eng/fin/draft-mr",
    heavy: true,
    summarize: (p) =>
      `${(p.drafts as Json[])?.length ?? 0} درخواست کالا · ${Number(p.skippedNotIfc ?? 0)} مدرک هنوز صادر نشده`,
  },
  {
    code: "draft-pr",
    titleFa: "پیش‌نویس درخواست خرید از درخواست کالا",
    descFa: "درخواست‌های کالای تأییدشده را به درخواست خرید تبدیل می‌کند",
    path: "/api/eng/fin/draft-pr",
    heavy: true,
    summarize: (p) => `${(p.drafts as Json[])?.length ?? 0} درخواست خرید`,
  },
  {
    code: "publish-kpi",
    titleFa: "انتشار شاخص‌ها به داشبورد پایش",
    descFa: "عکس شاخص‌های مهندسی را برای داشبورد مدیریتی ثبت می‌کند",
    path: "/api/eng/mon/publish-kpi",
    summarize: (p) => `${(p.snapshots as Json[])?.length ?? 0} شاخص در دورهٔ ${p.periodCode ?? "—"}`,
  },
  {
    code: "snapshot-progress",
    titleFa: "ثبت عکس پیشرفت دوره",
    descFa: "پیشرفت جاری مهندسی را برای مقایسهٔ دوره‌ای ذخیره می‌کند",
    path: "/api/eng/snapshot/progress",
    summarize: (p) => `${(p.snapshots as Json[])?.length ?? 0} عکس دیسیپلینی در دورهٔ ${p.periodCode ?? "—"}`,
  },
  {
    code: "backfill-roc",
    titleFa: "بازنویسی درصد پیشرفت فعالیت‌ها",
    descFa: "درصد پیشرفت فعالیت‌های مهندسی را از پلهٔ مدارک بازمحاسبه می‌کند",
    path: "/api/eng/pex/backfill-roc",
    heavy: true,
    summarize: (p) => {
      const rows = (p.rows as Json[]) ?? [];
      const unlinked = Number(p.unlinked ?? 0);
      /* فعالیت بدون مدرکِ متصل هرگز به‌روز نمی‌شود؛ سکوت دربارهٔ آن
       * کاربر را به این باور می‌رساند که همه‌چیز پوشش داده شده است. */
      return `${rows.length} فعالیت به‌روز می‌شود${unlinked ? ` · ${unlinked} فعالیت بدون مدرک متصل` : ""}`;
    },
  },
];

type ActionPhase =
  | { kind: "idle" }
  | { kind: "previewing" }
  | { kind: "preview"; summaryFa: string; raw: Json }
  | { kind: "applying" }
  | { kind: "done"; messageFa: string }
  | { kind: "failed"; messageFa: string };

/** یک کارت اقدام: پیش‌نمایش، تأیید، اعمال. */
function ActionCard({ rtl, action, userId, onApplied }: {
  rtl: boolean; action: EngAction; userId: string; onApplied: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<ActionPhase>({ kind: "idle" });

  const run = async (apply: boolean) => {
    setPhase({ kind: apply ? "applying" : "previewing" });
    const url = `${action.path}?projectId=${PROJECT_ID}${apply ? "&apply=1" : ""}`;
    const r = await postEng(url, {}, userId);

    if (!r.ok) {
      setPhase({ kind: "failed", messageFa: r.messageFa });
      return;
    }
    const plan = (r.data.plan ?? r.data) as Json;

    if (!apply) {
      setPhase({ kind: "preview", summaryFa: action.summarize(plan, r.data), raw: r.data });
      return;
    }
    logAudit(`ENG_ACTION_${action.code.toUpperCase().replace(/-/g, "_")}`, "Engineering", "apply");
    await onApplied();
    setPhase({ kind: "done", messageFa: action.summarize(plan, r.data) });
  };

  return (
    <div className="glass rounded-xl px-3 py-2.5">
      <div className="text-[10.5px] font-light tx1">{action.titleFa}</div>
      <div className="mt-0.5 text-[9px] font-light tx3">{action.descFa}</div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(phase.kind === "idle" || phase.kind === "failed" || phase.kind === "done") && (
          <button
            onClick={() => run(false)}
            disabled={!userId}
            className="rounded-lg border b-line-soft bg-black/15 px-2.5 py-1 text-[9.5px] font-light tx2 transition hover:border-[var(--accent)] hover:tx1 disabled:opacity-40"
          >
            پیش‌نمایش بدون اثر
          </button>
        )}

        {phase.kind === "previewing" && <span className="text-[9.5px] font-light tx3">در حال محاسبه…</span>}
        {phase.kind === "applying" && <span className="text-[9.5px] font-light tx3">در حال اعمال…</span>}

        {phase.kind === "preview" && (
          <>
            <span className="text-[9.5px] font-light tx2">{phase.summaryFa}</span>
            <button
              onClick={() => run(true)}
              className={`rounded-lg border px-2.5 py-1 text-[9.5px] font-light transition ${
                action.heavy
                  ? "border-amber-400/50 bg-amber-400/12 text-amber-200 hover:bg-amber-400/20"
                  : "border-[var(--accent)]/50 bg-[var(--accent)]/12 tx1 hover:bg-[var(--accent)]/20"
              }`}
            >
              {action.heavy ? "تأیید و اعمال دائمی" : "اعمال"}
            </button>
            <button
              onClick={() => setPhase({ kind: "idle" })}
              className="rounded-lg px-2 py-1 text-[9.5px] font-light tx3 transition hover:tx1"
            >
              انصراف
            </button>
          </>
        )}

        {phase.kind === "done" && (
          <span className="text-[9.5px] font-light text-emerald-300">✓ اعمال شد — {phase.messageFa}</span>
        )}
        {phase.kind === "failed" && (
          <span className="text-[9.5px] font-light text-rose-300">✕ {phase.messageFa}</span>
        )}
      </div>

      {phase.kind === "preview" && action.heavy && (
        <div className="mt-1.5 text-[9px] font-light text-amber-300/80">
          {rtl ? "این اقدام به ماژول‌های دیگر می‌نویسد و از این صفحه برگشت‌پذیر نیست." : ""}
        </div>
      )}
    </div>
  );
}

/** بخش اقدام‌ها در داشبورد. */
function ActionsPanel({ rtl, userId, onApplied }: {
  rtl: boolean; userId: string; onApplied: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="glass rounded-xl px-3 py-2">
        <div className="text-[10.5px] font-light tx1">{rtl ? "اقدام‌های یکپارچه‌سازی" : "Integration actions"}</div>
        <div className="mt-0.5 text-[9px] font-light tx3">
          {userId
            ? "هر اقدام نخست بدون اثر پیش‌نمایش می‌شود؛ اعمال دائمی تأیید جداگانه می‌خواهد."
            : "برای اجرای اقدام‌ها ابتدا وارد شوید."}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {ENG_ACTIONS.map((a) => (
          <ActionCard key={a.code} rtl={rtl} action={a} userId={userId} onApplied={onApplied} />
        ))}
      </div>
    </div>
  );
}

/** نوار ثبت بالای هر تب؛ وقتی کاربر وارد نشده راهنما نشان می‌دهد. */
function FormBar({ rtl, userId, children }: { rtl: boolean; userId: string; children: ReactNode }) {
  if (!userId) {
    return (
      <div className="glass rounded-xl px-3 py-2 text-[9.5px] font-light tx3">
        {rtl ? "برای ثبت رکورد تازه ابتدا وارد شوید." : "Sign in to add records."}
      </div>
    );
  }
  return <div className="flex flex-wrap items-start gap-2">{children}</div>;
}

/** فرم عمومی: چیدمان، اعتبارسنجی سبک، نمایش خطای هر میدان. */
function EngForm({
  rtl,
  titleFa,
  fields,
  submitFa,
  onSubmit,
  initial,
}: {
  rtl: boolean;
  titleFa: string;
  fields: FieldSpec[];
  submitFa: string;
  onSubmit: (values: Record<string, string>) => Promise<{ ok: boolean; messageFa: string; issues?: { field: string; messageFa: string }[] }>;
  initial?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const [state, setState] = useState<SubmitState>({ phase: "idle" });

  const issueOf = (name: string): string | null => {
    if (state.phase !== "error" || !state.issues) return null;
    return state.issues.find((i) => i.field === name)?.messageFa ?? null;
  };

  const set = (name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    if (state.phase === "error" || state.phase === "ok") setState({ phase: "idle" });
  };

  const submit = async () => {
    const missing = fields.filter((f) => f.required && !String(values[f.name] ?? "").trim());
    if (missing.length) {
      setState({
        phase: "error",
        messageFa: `${missing.length} میدان الزامی پر نشده است`,
        issues: missing.map((f) => ({ field: f.name, messageFa: `${f.fa} الزامی است` })),
      });
      return;
    }
    setState({ phase: "sending" });
    const r = await onSubmit(values);
    if (r.ok) {
      setState({ phase: "ok", messageFa: r.messageFa });
      setValues(initial ?? {});
    } else {
      setState({ phase: "error", messageFa: r.messageFa, issues: r.issues });
    }
  };

  const inputCls = (name: string): string =>
    `w-full rounded-lg border ${issueOf(name) ? "border-rose-400/60" : "b-line-soft"} bg-black/15 px-2.5 py-1.5 text-[11px] font-light tx1 outline-none transition focus:border-[var(--accent)]`;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass-row flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1"
      >
        <span>＋</span>
        <span>{titleFa}</span>
      </button>
    );
  }

  return (
    <div className="glass rounded-2xl p-3" dir={rtl ? "rtl" : "ltr"}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="text-[11px] font-light tx1">{titleFa}</div>
        <button
          onClick={() => { setOpen(false); setState({ phase: "idle" }); }}
          className="rounded-lg px-2 py-1 text-[10px] font-light tx3 transition hover:tx1"
        >
          بستن ✕
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => {
          const err = issueOf(f.name);
          return (
            <label key={f.name} className={`flex flex-col gap-1 ${f.span2 ? "sm:col-span-2" : ""}`}>
              <span className="text-[9.5px] font-light tx3">
                {f.fa}
                {f.required && <span className="text-rose-400"> *</span>}
              </span>

              {f.kind === "select" ? (
                <select
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  className={inputCls(f.name)}
                >
                  <option value="">— انتخاب کنید —</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.fa}</option>
                  ))}
                </select>
              ) : f.kind === "textarea" ? (
                <textarea
                  rows={2}
                  value={values[f.name] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                  className={inputCls(f.name)}
                />
              ) : (
                <input
                  type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
                  value={values[f.name] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                  className={inputCls(f.name)}
                />
              )}

              {err
                ? <span className="text-[9px] font-light text-rose-300">{err}</span>
                : f.hintFa
                  ? <span className="text-[9px] font-light tx3">{f.hintFa}</span>
                  : null}
            </label>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={submit}
          disabled={state.phase === "sending"}
          className="rounded-lg border border-[var(--accent)]/50 bg-[var(--accent)]/12 px-3 py-1.5 text-[10.5px] font-light tx1 transition hover:bg-[var(--accent)]/20 disabled:opacity-50"
        >
          {state.phase === "sending" ? "در حال ثبت…" : submitFa}
        </button>

        {state.phase === "ok" && (
          <span className="text-[10px] font-light text-emerald-300">✓ {state.messageFa}</span>
        )}
        {state.phase === "error" && (
          <span className="text-[10px] font-light text-rose-300">✕ {state.messageFa}</span>
        )}
      </div>
    </div>
  );
}

const fmt = (v: unknown, digits = 1): string =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits).replace(/\.0+$/, "") : "—";

const pct = (v: unknown): string => (typeof v === "number" ? `${fmt(v)}٪` : "—");

const money = (v: unknown): string =>
  typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("fa-IR") : "—";

/* رنگ وضعیت شاخص — هم‌راستا با پالت موجود، بدون افزودن کلاس تازه به index.css */
const STATUS_TONE: Record<string, string> = {
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-rose-400",
  unknown: "tx3",
};

const SEVERITY_TONE: Record<string, string> = {
  high: "text-rose-400",
  medium: "text-amber-400",
  low: "tx3",
  critical: "text-rose-400",
  major: "text-amber-400",
  minor: "tx3",
  editorial: "tx3",
};

export default function EngineeringWorkspace({ lang, onBack }: Props) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  /* هویت ثبت‌کننده؛ سرور با همین سرآیند مجوز را ارزیابی می‌کند. */
  const userId = user?.id ?? "";
  const [tab, setTab] = useState<EngTab>("mdr");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Json | null>(null);
  const [mdr, setMdr] = useState<Json | null>(null);
  const [aging, setAging] = useState<Json | null>(null);
  const [crs, setCrs] = useState<Json | null>(null);
  const [idc, setIdc] = useState<Json | null>(null);
  const [tq, setTq] = useState<Json | null>(null);
  const [vpr, setVpr] = useState<Json | null>(null);
  const [coverage, setCoverage] = useState<Json | null>(null);
  const [poAudit, setPoAudit] = useState<Json | null>(null);
  const [procurement, setProcurement] = useState<Json | null>(null);

  /* پس از هر ثبت موفق دوباره صدا زده می‌شود تا جدول‌ها کهنه نمانند. */
  const loadAll = useCallback(async () => {
    setLoading(true);
    const q = `projectId=${PROJECT_ID}`;
    const [o, m, a, c, i, t, v, cv, pa, pr] = await Promise.all([
      fetchJson(`/api/eng/overview?${q}`),
      fetchJson(`/api/eng/mdr?${q}`),
      fetchJson(`/api/eng/review/aging?${q}`),
      fetchJson(`/api/eng/crs?${q}`),
      fetchJson(`/api/eng/idc?${q}`),
      fetchJson(`/api/eng/tq?${q}`),
      fetchJson(`/api/eng/vpr?${q}`),
      fetchJson(`/api/eng/pex/lock-coverage?${q}`),
      fetchJson(`/api/eng/vpr/po-audit?${q}`),
      fetchJson(`/api/eng/mr?${q}`),
    ]);
    setOverview(o); setMdr(m); setAging(a); setCrs(c); setIdc(i); setTq(t); setVpr(v);
    setCoverage(cv); setPoAudit(pa); setProcurement(pr);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
    logAudit("ENG_WORKSPACE_OPEN", "Engineering", `domain d12 · engine ${ENG_VERSION}`);
  }, [loadAll]);

  const kpis = useMemo(() => (overview?.kpis ?? []) as Json[], [overview]);
  const alerts = useMemo(() => (overview?.alerts ?? []) as Json[], [overview]);

  const headline = useMemo(() => {
    const p = overview?.progress;
    return [
      { fa: "پیشرفت واقعی", value: pct(p?.actualPct) },
      { fa: "پیشرفت برنامه‌ای", value: pct(p?.plannedPct) },
      { fa: "SPI مهندسی", value: fmt(p?.spi, 2) },
      { fa: "بررسی از مهلت گذشته", value: overview ? String(overview.reviewOverdue ?? 0) : "—" },
      { fa: "استعلام باز", value: overview ? String(overview.openQueries ?? 0) : "—" },
      { fa: "هشدار فعال", value: String(alerts.length) },
    ];
  }, [overview, alerts]);

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
          <span className="text-lg">📐</span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-light tx1">
              {rtl ? "مدیریت مهندسی و طراحی" : "Engineering & Design Management"}
            </div>
            <div className="truncate text-[9.5px] font-light tx3">
              {rtl ? `موتور ${ENG_VERSION} · دامنه d12` : `${ENG_VERSION} · domain d12`}
            </div>
          </div>
        </div>
        {loading && <span className="text-[10px] font-light tx3">{rtl ? "در حال بارگذاری…" : "Loading…"}</span>}
      </div>

      {/* شاخص‌های سرصفحه */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {headline.map((h) => (
          <div key={h.fa} className="glass rounded-xl px-3 py-2.5">
            <div className="text-[9px] font-light tx3">{h.fa}</div>
            <div className="mt-0.5 text-[15px] font-light tx1">{h.value}</div>
          </div>
        ))}
      </div>

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
      <div className="min-h-0 flex-1 overflow-auto pb-4">
        {tab === "mdr" && <MdrTab rtl={rtl} data={mdr} userId={userId} onSaved={loadAll} />}
        {tab === "review" && <ReviewTab rtl={rtl} aging={aging} crs={crs} mdr={mdr} userId={userId} onSaved={loadAll} />}
        {tab === "idc" && <IdcTab rtl={rtl} data={idc} />}
        {tab === "field" && <FieldTab rtl={rtl} data={tq} userId={userId} onSaved={loadAll} />}
        {tab === "vendor" && <VendorTab rtl={rtl} data={vpr} procurement={procurement} />}
        {tab === "dashboard" && <DashboardTab rtl={rtl} overview={overview} kpis={kpis} alerts={alerts} coverage={coverage} poAudit={poAudit} userId={userId} onApplied={loadAll} />}
      </div>
    </div>
  );
}

/* ─────────────── تب ۱: ماتریس MDR ─────────────── */

function MdrTab({ rtl, data, userId, onSaved }: {
  rtl: boolean; data: Json | null; userId: string; onSaved: () => Promise<void>;
}) {
  const items = (data?.items ?? []) as Json[];
  const validation = data?.validation as Json | undefined;

  const mdrForm = (
    <FormBar rtl={rtl} userId={userId}>
      <EngForm
        rtl={rtl}
        titleFa="ثبت مدرک تازه در فهرست"
        submitFa="ثبت مدرک"
        fields={[
          { name: "docNo", fa: "شمارهٔ مدرک", kind: "text", required: true, placeholder: "PI-ISO-021" },
          { name: "titleFa", fa: "عنوان مدرک", kind: "text", required: true, span2: true },
          { name: "discipline", fa: "دیسیپلین", kind: "select", required: true,
            options: DISCIPLINE_OPTIONS },
          { name: "docType", fa: "نوع مدرک", kind: "text", required: true, placeholder: "ISO / PID / SLD" },
          { name: "plannedWeight", fa: "وزن برنامه‌ای", kind: "number", required: true, hintFa: "جمع وزن همهٔ مدارک باید ۱۰۰ شود" },
          { name: "estimatedManhours", fa: "نفرساعت برآوردی", kind: "number" },
          { name: "wbsId", fa: "شناسهٔ WBS", kind: "text", hintFa: "بدون آن، قفل IFC روی فعالیت اثر ندارد" },
          { name: "targetIfaDate", fa: "تاریخ هدف ارسال", kind: "date" },
          { name: "targetIfcDate", fa: "تاریخ هدف صدور", kind: "date" },
        ]}
        onSubmit={async (v) => {
          const r = await postEng(`/api/eng/mdr?projectId=${PROJECT_ID}`, v, userId);
          if (!r.ok) return { ok: false, messageFa: r.messageFa, issues: r.issues };
          logAudit("ENG_MDR_CREATE", "Engineering", String(v.docNo));
          await onSaved();
          const warn = r.data.weightWarningFa;
          return { ok: true, messageFa: warn ? `ثبت شد — ${warn}` : "مدرک ثبت شد" };
        }}
      />
    </FormBar>
  );

  if (!items.length) {
    return <div className="flex flex-col gap-3">{mdrForm}<Empty rtl={rtl} /></div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {mdrForm}
      {validation && !validation.ok && (
        <div className="glass rounded-xl px-3 py-2.5">
          <div className="text-[10.5px] font-light text-amber-400">
            {rtl ? `اعتبارسنجی فهرست: ${validation.issues.length} مورد · مجموع وزن ${fmt(validation.totalWeight, 2)}` : "MDR validation issues"}
          </div>
          {(validation.issues as Json[]).slice(0, 4).map((i, k) => (
            <div key={k} className="mt-1 text-[9.5px] font-light tx3">
              {i.severity === "error" ? "⛔" : "⚠"} {i.docNo ? `${i.docNo} — ` : ""}{i.messageFa}
            </div>
          ))}
        </div>
      )}

      <div className="glass overflow-x-auto rounded-2xl p-3">
        <div className="mb-2 text-[10.5px] font-light tx2">
          {rtl ? `ماتریس وضعیت مدارک — ${items.length} مدرک` : `MDR matrix — ${items.length} items`}
        </div>
        <table className="w-full text-[9.5px] font-light">
          <thead>
            <tr className="tx3">
              <th className="p-1.5 text-start">{rtl ? "شماره مدرک" : "Doc No"}</th>
              <th className="p-1.5 text-start">{rtl ? "عنوان" : "Title"}</th>
              <th className="p-1.5 text-start">{rtl ? "دیسیپلین" : "Discipline"}</th>
              <th className="p-1.5 text-center">{rtl ? "وزن" : "Weight"}</th>
              {ROC_STEPS.map((s) => (
                <th key={s.code} className="p-1.5 text-center" title={s.titleFa}>{s.pct}٪</th>
              ))}
              <th className="p-1.5 text-center">{rtl ? "پیشرفت" : "Progress"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="glass-row">
                <td className="p-1.5 tx1">{it.docNo}</td>
                <td className="max-w-[220px] truncate p-1.5 tx2" title={it.titleFa}>{it.titleFa}</td>
                <td className="p-1.5 tx3">{it.disciplineFa}</td>
                <td className="p-1.5 text-center tx2">{fmt(it.weight, 2)}</td>
                {ROC_STEPS.map((s) => {
                  const step = (it.trail as Json[] | undefined)?.find((t) => t.step === s.code);
                  return (
                    <td key={s.code} className="p-1.5 text-center" title={step?.evidence ?? (rtl ? "بدون شاهد" : "no evidence")}>
                      {step?.reached ? <span className="text-emerald-400">●</span> : <span className="tx3">○</span>}
                    </td>
                  );
                })}
                <td className="p-1.5 text-center tx1">{pct(it.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-[9px] font-light tx3">
          {rtl
            ? "● پلهٔ باز با شاهد · ○ پلهٔ قفل. پیشرفت از شاهد مشتق می‌شود و دستی وارد نمی‌شود."
            : "● step with evidence · ○ locked. Progress is derived, never entered."}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── تب ۲: بررسی و CRS ─────────────── */

function ReviewTab({ rtl, aging, crs, mdr, userId, onSaved }: {
  rtl: boolean; aging: Json | null; crs: Json | null; mdr: Json | null;
  userId: string; onSaved: () => Promise<void>;
}) {
  /* گزینه‌های مدرک و ریویژن از همان داده‌ای می‌آید که جدول را می‌سازد،
   * پس کاربر شناسه را دستی تایپ نمی‌کند و خطای کلید خارجی رخ نمی‌دهد. */
  const docOptions = ((mdr?.items ?? []) as Json[]).map((d) => ({
    value: String(d.id ?? d.Id ?? ""),
    fa: `${d.docNo ?? d.DocNo} — ${d.titleFa ?? d.TitleFa ?? ""}`.slice(0, 60),
  })).filter((o) => o.value);

  const revOptions = ((crs?.rows ?? crs?.items ?? []) as Json[])
    .map((c) => ({ value: String(c.revisionId ?? c.RevisionId ?? ""), fa: String(c.revCode ?? c.RevCode ?? c.revisionId ?? "") }))
    .filter((o, i, arr) => o.value && arr.findIndex((x) => x.value === o.value) === i);

  const rows = (aging?.rows ?? []) as Json[];
  const comments = (crs?.items ?? []) as Json[];
  const gate = crs?.gate as Json | undefined;
  const summary = crs?.summary as Json | undefined;

  return (
    <div className="flex flex-col gap-3">
      <FormBar rtl={rtl} userId={userId}>
        <EngForm
          rtl={rtl}
          titleFa="صدور ریویژن"
          submitFa="ثبت صدور"
          fields={[
            { name: "deliverableId", fa: "مدرک", kind: "select", required: true, options: docOptions, span2: true },
            { name: "revCode", fa: "کد ریویژن", kind: "text", required: true, placeholder: "A1 / B2 / C1" },
            { name: "purpose", fa: "هدف صدور", kind: "select", required: true, options: PURPOSE_OPTIONS },
            { name: "issuedAt", fa: "تاریخ صدور", kind: "date", required: true },
            { name: "idcCompletedAt", fa: "اتمام بررسی بین‌دیسیپلینی", kind: "date", hintFa: "بدون آن پلهٔ IFA باز نمی‌شود" },
            { name: "documentId", fa: "شناسهٔ فایل مدرک", kind: "text", hintFa: "برای IFC و چون‌ساخت الزامی است" },
            { name: "reviewDueAt", fa: "مهلت بررسی", kind: "date" },
          ]}
          onSubmit={async (v) => {
            const r = await postEng(`/api/eng/revision?projectId=${PROJECT_ID}`, v, userId);
            if (!r.ok) return { ok: false, messageFa: r.messageFa, issues: r.issues };
            logAudit("ENG_REVISION_ISSUE", "Engineering", `${v.revCode} · ${v.purpose}`);
            await onSaved();
            return { ok: true, messageFa: String(r.data.noteFa ?? "ریویژن ثبت شد") };
          }}
        />

        <EngForm
          rtl={rtl}
          titleFa="ثبت نظر بررسی"
          submitFa="ثبت نظر"
          fields={[
            { name: "revisionId", fa: "ریویژن", kind: revOptions.length ? "select" : "text", required: true,
              options: revOptions, span2: true, hintFa: revOptions.length ? undefined : "شناسهٔ ریویژن را وارد کنید" },
            { name: "severity", fa: "شدت", kind: "select", required: true, options: SEVERITY_OPTIONS },
            { name: "raisedAt", fa: "تاریخ ثبت", kind: "date", required: true },
            { name: "discipline", fa: "دیسیپلین", kind: "select", options: DISCIPLINE_OPTIONS },
            { name: "commentText", fa: "متن نظر", kind: "textarea", required: true, span2: true },
          ]}
          onSubmit={async (v) => {
            const r = await postEng(`/api/eng/crs?projectId=${PROJECT_ID}`, v, userId);
            if (!r.ok) return { ok: false, messageFa: r.messageFa, issues: r.issues };
            logAudit("ENG_CRS_COMMENT", "Engineering", `${v.severity} · rev ${v.revisionId}`);
            await onSaved();
            return { ok: true, messageFa: `نظر شمارهٔ ${r.data.commentNo} ثبت شد — ${r.data.noteFa}` };
          }}
        />
      </FormBar>

      {gate && (
        <div className="glass rounded-xl px-3 py-2.5">
          <div className={`text-[11px] font-light ${gate.passed ? "text-emerald-400" : "text-rose-400"}`}>
            {gate.passed
              ? (rtl ? "✓ دروازهٔ صدور IFC باز است" : "✓ IFC gate open")
              : (rtl ? "⛔ دروازهٔ صدور IFC بسته است" : "⛔ IFC gate blocked")}
          </div>
          {(gate.blockers as Json[]).map((b, k) => (
            <div key={k} className="mt-1 text-[9.5px] font-light tx3">— {b.messageFa}</div>
          ))}
          {summary && (
            <div className="mt-1.5 text-[9.5px] font-light tx3">
              {rtl
                ? `کل ${summary.total} · باز ${summary.open} · توافق ${summary.agreed} · اختلاف ${summary.disagreed} · صحه‌خورده ${summary.verified} · نرخ بسته‌شدن ${fmt(summary.closureRate)}٪`
                : `total ${summary.total} · open ${summary.open}`}
            </div>
          )}
        </div>
      )}

      <div className="glass overflow-x-auto rounded-2xl p-3">
        <div className="mb-2 text-[10.5px] font-light tx2">{rtl ? "سن بررسی کارفرما" : "Client review aging"}</div>
        {rows.length === 0 ? <Empty rtl={rtl} inline /> : (
          <table className="w-full text-[9.5px] font-light">
            <thead>
              <tr className="tx3">
                <th className="p-1.5 text-start">{rtl ? "ریویژن" : "Revision"}</th>
                <th className="p-1.5 text-start">{rtl ? "صدور" : "Issued"}</th>
                <th className="p-1.5 text-start">{rtl ? "سررسید" : "Due"}</th>
                <th className="p-1.5 text-center">{rtl ? "روز" : "Days"}</th>
                <th className="p-1.5 text-start">{rtl ? "وضعیت" : "Status"}</th>
                <th className="p-1.5 text-start">{rtl ? "کد بررسی" : "Code"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.revisionId} className="glass-row">
                  <td className="p-1.5 tx1">{r.revisionId}</td>
                  <td className="p-1.5 tx3">{r.issuedAt}</td>
                  <td className="p-1.5 tx3">{r.dueAt ?? "—"}</td>
                  <td className={`p-1.5 text-center ${r.status === "overdue" ? "text-rose-400" : "tx2"}`}>
                    {r.overdueDays ?? "—"}
                  </td>
                  <td className="p-1.5 tx2">{r.status}</td>
                  <td className="p-1.5 tx2">
                    {r.reviewCode ? `${r.reviewCode} — ${REVIEW_CODE_FA[r.reviewCode as "1"] ?? ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass overflow-x-auto rounded-2xl p-3">
        <div className="mb-2 text-[10.5px] font-light tx2">{rtl ? "شیت ثبت و پاسخ نظرات" : "Comment resolution sheet"}</div>
        {comments.length === 0 ? <Empty rtl={rtl} inline /> : (
          <table className="w-full text-[9.5px] font-light">
            <thead>
              <tr className="tx3">
                <th className="p-1.5 text-center">#</th>
                <th className="p-1.5 text-start">{rtl ? "شدت" : "Severity"}</th>
                <th className="p-1.5 text-start">{rtl ? "نظر" : "Comment"}</th>
                <th className="p-1.5 text-start">{rtl ? "پاسخ طراح" : "Response"}</th>
                <th className="p-1.5 text-start">{rtl ? "وضعیت" : "Status"}</th>
                <th className="p-1.5 text-center">{rtl ? "صحه" : "Verified"}</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((c) => (
                <tr key={c.Id} className="glass-row">
                  <td className="p-1.5 text-center tx3">{c.CommentNo}</td>
                  <td className={`p-1.5 ${SEVERITY_TONE[c.Severity] ?? "tx2"}`}>{c.Severity}</td>
                  <td className="max-w-[240px] truncate p-1.5 tx2" title={c.CommentText}>{c.CommentText}</td>
                  <td className="max-w-[240px] truncate p-1.5 tx3" title={c.ResponseText ?? ""}>{c.ResponseText ?? "—"}</td>
                  <td className={`p-1.5 ${c.ResponseStatus === "open" ? "text-amber-400" : "tx2"}`}>{c.ResponseStatus}</td>
                  <td className="p-1.5 text-center">{c.VerifiedBy ? <span className="text-emerald-400">✓</span> : <span className="tx3">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─────────────── تب ۳: IDC و تداخل ─────────────── */

function IdcTab({ rtl, data }: { rtl: boolean; data: Json | null }) {
  const checks = (data?.squadChecks ?? []) as Json[];
  const clashes = data?.clashes as Json | undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="glass rounded-2xl p-3">
        <div className="mb-2 text-[10.5px] font-light tx2">{rtl ? "وضعیت بررسی بین‌دیسیپلینی" : "Squad check status"}</div>
        {checks.length === 0 ? <Empty rtl={rtl} inline /> : (
          <div className="flex flex-col gap-1.5">
            {checks.map((c) => (
              <div key={c.revisionId} className="glass-row flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2.5 py-2 text-[9.5px] font-light">
                <span className="tx1">{c.revisionId}</span>
                <span className="tx3">{rtl ? `درخواست ${c.requested}` : `requested ${c.requested}`}</span>
                <span className="text-emerald-400">{rtl ? `تأیید ${c.cleared}` : `cleared ${c.cleared}`}</span>
                {c.objected > 0 && <span className="text-rose-400">{rtl ? `اعتراض ${c.objected}` : `objected ${c.objected}`}</span>}
                {c.pending > 0 && <span className="text-amber-400">{rtl ? `معلق ${c.pending}` : `pending ${c.pending}`}</span>}
                {c.complete && <span className="text-emerald-400">{rtl ? "✓ تکمیل" : "✓ complete"}</span>}
                {(c.overdue as string[])?.length > 0 && (
                  <span className="text-rose-400">{rtl ? `تأخیر: ${(c.overdue as string[]).join("، ")}` : `overdue`}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {clashes && (
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 text-[10.5px] font-light tx2">
            {rtl
              ? `تداخل مدل — کل ${clashes.total} · باز ${clashes.open} · بحرانی ${clashes.critical} · نرخ رفع ${fmt(clashes.resolutionRate)}٪`
              : `Clashes — ${clashes.total}`}
          </div>
          {(clashes.byPair as Json[]).length === 0 ? <Empty rtl={rtl} inline /> : (
            <div className="flex flex-col gap-1.5">
              {(clashes.byPair as Json[]).map((p) => (
                <div key={p.pair} className="glass-row flex items-center justify-between rounded-lg px-2.5 py-2 text-[9.5px] font-light">
                  <span className="tx2">
                    {String(p.pair).split("↔").map((d) => DISCIPLINE_FA[d as "civil"] ?? d).join(" ↔ ")}
                  </span>
                  <span className="tx3">
                    {rtl ? `${p.count} مورد · ${p.open} باز` : `${p.count} total · ${p.open} open`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── تب ۴: تغییرات کارگاهی ─────────────── */

function FieldTab({ rtl, data, userId, onSaved }: {
  rtl: boolean; data: Json | null; userId: string; onSaved: () => Promise<void>;
}) {
  const aging = (data?.aging ?? []) as Json[];
  const crPlan = data?.crPlan as Json | undefined;
  const asBuilt = data?.asBuilt as Json | undefined;

  return (
    <div className="flex flex-col gap-3">
      <FormBar rtl={rtl} userId={userId}>
        <EngForm
          rtl={rtl}
          titleFa="ثبت استعلام فنی یا تغییر کارگاهی"
          submitFa="ثبت استعلام"
          fields={[
            { name: "code", fa: "کد استعلام", kind: "text", required: true, placeholder: "TQ-041" },
            { name: "kind", fa: "نوع", kind: "select", required: true, options: TQ_KIND_OPTIONS },
            { name: "discipline", fa: "دیسیپلین", kind: "select", required: true, options: DISCIPLINE_OPTIONS },
            { name: "titleFa", fa: "عنوان", kind: "text", required: true, span2: true },
            { name: "raisedAt", fa: "تاریخ طرح", kind: "date", required: true },
            { name: "dueAt", fa: "مهلت پاسخ", kind: "date" },
            { name: "timeImpactDays", fa: "اثر زمان (روز)", kind: "number", hintFa: "اثر زمان یا هزینه، نامزد درخواست تغییر می‌سازد" },
            { name: "costImpact", fa: "اثر هزینه (ریال)", kind: "number" },
          ]}
          onSubmit={async (v) => {
            const r = await postEng(`/api/eng/tq?projectId=${PROJECT_ID}`, v, userId);
            if (!r.ok) return { ok: false, messageFa: r.messageFa, issues: r.issues };
            logAudit("ENG_TQ_RAISE", "Engineering", `${v.code} · ${v.kind}`);
            await onSaved();
            return { ok: true, messageFa: String(r.data.noteFa ?? "استعلام ثبت شد") };
          }}
        />
      </FormBar>

      {asBuilt && (
        <div className="glass rounded-xl px-3 py-2.5 text-[9.5px] font-light tx3">
          {rtl
            ? `چون‌ساخت — تأییدشده ${asBuilt.approved} · پیش‌نویس ${asBuilt.drafted} · در انتظار ${asBuilt.pending} · نرخ تکمیل ${fmt(asBuilt.completionRate)}٪`
            : `As-built completion ${fmt(asBuilt.completionRate)}%`}
        </div>
      )}

      <div className="glass overflow-x-auto rounded-2xl p-3">
        <div className="mb-2 text-[10.5px] font-light tx2">{rtl ? "استعلام و تغییر فنی کارگاهی" : "Technical queries & field changes"}</div>
        {aging.length === 0 ? <Empty rtl={rtl} inline /> : (
          <table className="w-full text-[9.5px] font-light">
            <thead>
              <tr className="tx3">
                <th className="p-1.5 text-start">{rtl ? "کد" : "Code"}</th>
                <th className="p-1.5 text-start">{rtl ? "نوع" : "Kind"}</th>
                <th className="p-1.5 text-start">{rtl ? "ثبت" : "Raised"}</th>
                <th className="p-1.5 text-center">{rtl ? "سن (روز)" : "Age"}</th>
                <th className="p-1.5 text-start">{rtl ? "وضعیت" : "Status"}</th>
                <th className="p-1.5 text-center">{rtl ? "اثر" : "Impact"}</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((q) => (
                <tr key={q.code} className="glass-row">
                  <td className="p-1.5 tx1">{q.code}</td>
                  <td className="p-1.5 tx2">{TQ_KIND_FA[q.kind as "TQ"] ?? q.kind}</td>
                  <td className="p-1.5 tx3">{q.raisedAt}</td>
                  <td className={`p-1.5 text-center ${q.overdue ? "text-rose-400" : "tx2"}`}>{q.ageDays ?? "—"}</td>
                  <td className="p-1.5 tx2">{q.status}</td>
                  <td className="p-1.5 text-center">{q.hasImpact ? <span className="text-amber-400">⚠</span> : <span className="tx3">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {crPlan && (crPlan.drafts as Json[]).length > 0 && (
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 text-[10.5px] font-light tx2">
            {rtl ? `پیش‌نویس درخواست تغییر — ${(crPlan.drafts as Json[]).length} مورد` : `Draft change requests`}
          </div>
          {(crPlan.drafts as Json[]).map((d) => (
            <div key={d.code} className="glass-row mt-1.5 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-light tx1">{d.code}</div>
              <div className="text-[9.5px] font-light tx3">{d.reasonFa}</div>
              <div className="mt-0.5 text-[9px] font-light tx3">
                {rtl ? `هزینه ${money(d.costImpact)} · زمان ${d.timeImpactDays} روز` : `cost ${money(d.costImpact)}`}
              </div>
            </div>
          ))}
          <div className="mt-2 text-[9px] font-light tx3">
            {rtl
              ? "ساخت CR ایدمپوتنت است — اجرای دوباره رکورد تکراری نمی‌سازد."
              : "CR creation is idempotent."}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── تب ۵: مدارک سازندگان ─────────────── */

function VendorTab({ rtl, data, procurement }: { rtl: boolean; data: Json | null; procurement: Json | null }) {
  const items = (data?.items ?? []) as Json[];
  const s = data?.summary as Json | undefined;
  const mrItems = (procurement?.items ?? []) as Json[];
  const mrSummary = procurement?.summary as Json | undefined;
  const mrAlerts = (procurement?.alerts ?? []) as Json[];

  return (
    <div className="flex flex-col gap-3">
      {mrSummary && (
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10.5px] font-light tx2">
              {rtl ? "چرخهٔ تدارکات — درخواست کالا" : "Procurement — material requests"}
            </span>
            <span className="text-[9.5px] font-light tx3">
              {rtl
                ? `کل ${mrSummary.total} · منتظر خرید ${mrSummary.awaitingPr}`
                : `total ${mrSummary.total} · awaiting PR ${mrSummary.awaitingPr}`}
            </span>
            {Number(mrSummary.windowClosed) > 0 && (
              <span className="text-[9.5px] font-light text-rose-300">
                {rtl ? `🔴 پنجرهٔ سفارش بسته: ${mrSummary.windowClosed}` : `🔴 window closed: ${mrSummary.windowClosed}`}
              </span>
            )}
          </div>

          {mrItems.length === 0 ? (
            <Empty rtl={rtl} inline />
          ) : (
            <div className="flex flex-col gap-1.5">
              {mrItems.map((m, k) => (
                <div key={`${m.code}-${k}`} className="glass-row flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2.5 py-2 text-[9.5px] font-light">
                  <span className="tx1">{String(m.code)}</span>
                  <span className="tx3">{DISCIPLINE_FA[m.discipline as "civil"] ?? String(m.discipline)}</span>
                  <span className="tx2">{rtl ? `نیاز ${m.needByDate ?? "—"}` : `need ${m.needByDate ?? "—"}`}</span>
                  <span className="tx3">{rtl ? `سفارش تا ${m.releaseByDate ?? "—"}` : `order by ${m.releaseByDate ?? "—"}`}</span>
                  <span className="ms-auto tx3">{String(m.status)}</span>
                  {m.linkedPrCode ? (
                    <span className="text-emerald-300">{String(m.linkedPrCode)}</span>
                  ) : (
                    <span className="text-amber-300">{rtl ? "بدون خرید" : "no PR"}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {mrAlerts.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {mrAlerts.slice(0, 4).map((a, k) => (
                <div
                  key={`${a.mrCode}-${k}`}
                  className={`text-[9px] font-light ${a.severity === "critical" ? "text-rose-300" : a.severity === "high" ? "text-amber-300" : "tx3"}`}
                >
                  {String(a.code)} — {String(a.detailFa)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {s && (
        <div className="glass rounded-xl px-3 py-2.5">
          <div className="text-[9.5px] font-light tx3">
            {rtl
              ? `کل ${s.total} · در بررسی ${s.underReview} · تأیید ساخت ${s.approvedForMfg} · مردود ${s.rejected} · از مهلت گذشته ${s.overdue}`
              : `total ${s.total}`}
          </div>
          {(s.unmappedToPo as string[])?.length > 0 && (
            <div className="mt-1 text-[9.5px] font-light text-amber-400">
              {rtl
                ? `⚠ بدون نگاشت سفارش خرید: ${(s.unmappedToPo as string[]).join("، ")}`
                : `⚠ unmapped to PO`}
            </div>
          )}
        </div>
      )}

      <div className="glass overflow-x-auto rounded-2xl p-3">
        {items.length === 0 ? <Empty rtl={rtl} inline /> : (
          <table className="w-full text-[9.5px] font-light">
            <thead>
              <tr className="tx3">
                <th className="p-1.5 text-start">{rtl ? "شماره مدرک" : "Doc No"}</th>
                <th className="p-1.5 text-start">{rtl ? "سازنده" : "Vendor"}</th>
                <th className="p-1.5 text-start">{rtl ? "سفارش خرید" : "PO"}</th>
                <th className="p-1.5 text-start">{rtl ? "تگ" : "Tag"}</th>
                <th className="p-1.5 text-center">{rtl ? "ریو" : "Rev"}</th>
                <th className="p-1.5 text-start">{rtl ? "کد بررسی" : "Code"}</th>
                <th className="p-1.5 text-start">{rtl ? "وضعیت" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.Id} className="glass-row">
                  <td className="p-1.5 tx1">{v.VendorDocNo}</td>
                  <td className="p-1.5 tx2">{v.VendorName}</td>
                  <td className={`p-1.5 ${v.PoNo ? "tx3" : "text-amber-400"}`}>{v.PoNo ?? (rtl ? "بدون PO" : "no PO")}</td>
                  <td className="p-1.5 tx3">{v.TagNo ?? "—"}</td>
                  <td className="p-1.5 text-center tx3">{v.RevCode}</td>
                  <td className="p-1.5 tx2">{v.ReviewCode ?? "—"}</td>
                  <td className={`p-1.5 ${v.Status === "approved_for_mfg" ? "text-emerald-400" : "tx2"}`}>{v.Status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─────────────── تب ۶: داشبورد ─────────────── */

function DashboardTab({ rtl, overview, kpis, alerts, coverage, poAudit, userId, onApplied }: {
  rtl: boolean; overview: Json | null; kpis: Json[]; alerts: Json[];
  coverage: Json | null; poAudit: Json | null;
  userId: string; onApplied: () => Promise<void>;
}) {
  const byDiscipline = (overview?.progress?.byDiscipline ?? []) as Json[];

  return (
    <div className="flex flex-col gap-3">
      {/* گزارش مدیریتی بالای صفحه: پرمصرف‌ترین خروجی برای جلسهٔ هفتگی است
          و نباید ته کاتالوگ هشت‌تایی گم شود. */}
      <div className="glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-light tx1">
            {rtl ? "گزارش تک‌صفحه‌ای مدیریتی" : "Executive one-pager"}
          </div>
          <div className="mt-0.5 text-[9px] font-light tx3">
            {rtl
              ? "قضاوت کلی، اثر بر ساخت و قرارداد، و سه قلم نیازمند تصمیم — یک صفحهٔ A4، فقط داخلی"
              : "Verdict, impact, top three decisions — one A4 page, internal only"}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {ENG_EXPORTS.map((x) => (
            <button
              key={x.format}
              type="button"
              onClick={() => openEngReport("RPT-ENG-EXEC", x.format, "internal")}
              className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-1 text-[9px] font-light tx1 transition hover:bg-[var(--accent)]/20"
            >
              {rtl ? x.fa : x.en}
            </button>
          ))}
        </div>
      </div>

      <ActionsPanel rtl={rtl} userId={userId} onApplied={onApplied} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.code} className="glass rounded-xl px-3 py-2.5">
            <div className="text-[9px] font-light tx3">{k.title?.fa ?? k.code}</div>
            <div className={`mt-0.5 text-[15px] font-light ${STATUS_TONE[k.status] ?? "tx1"}`}>
              {k.value === null ? "—" : `${fmt(k.value, 2)}${k.unit ?? ""}`}
            </div>
            <div className="text-[9px] font-light tx3">
              {rtl ? `هدف ${k.target}${k.unit ?? ""}` : `target ${k.target}`}
            </div>
          </div>
        ))}
      </div>

      {byDiscipline.length > 0 && (
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 text-[10.5px] font-light tx2">{rtl ? "پیشرفت به تفکیک دیسیپلین" : "Progress by discipline"}</div>
          <div className="flex flex-col gap-1.5">
            {byDiscipline.map((d) => (
              <div key={d.discipline} className="flex items-center gap-2 text-[9.5px] font-light">
                <span className="w-20 shrink-0 tx2">{DISCIPLINE_FA[d.discipline as "civil"] ?? d.discipline}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-violet-400/60" style={{ width: `${Math.min(100, Number(d.actualPct) || 0)}%` }} />
                </div>
                <span className="w-24 shrink-0 text-end tx3">
                  {pct(d.actualPct)} / {pct(d.plannedPct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-3">
        <div className="mb-2 text-[10.5px] font-light tx2">
          {rtl ? `هشدارهای زودهنگام — ${alerts.length} مورد` : `Early warnings — ${alerts.length}`}
        </div>
        {alerts.length === 0 ? (
          <div className="text-[9.5px] font-light text-emerald-400">{rtl ? "هشدار فعالی نیست" : "No active alerts"}</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {alerts.map((a, k) => (
              <div key={`${a.code}-${k}`} className="glass-row rounded-lg px-2.5 py-2">
                <div className={`text-[10px] font-light ${SEVERITY_TONE[a.severity] ?? "tx2"}`}>
                  {a.code} — {a.titleFa}
                </div>
                <div className="text-[9.5px] font-light tx3">{a.detailFa}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(coverage || poAudit) && (
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 text-[10.5px] font-light tx2">
            {rtl ? "سلامت یکپارچگی و پوشش محافظ‌ها" : "Integration health & guard coverage"}
          </div>
          <div className="flex flex-col gap-1.5">
            {coverage && (
              <div className="glass-row rounded-lg px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] font-light">
                  <span className="tx2">{rtl ? "پوشش محافظ IFC" : "IFC guard coverage"}</span>
                  <span className={Number(coverage.unmappedActivities) > 0 ? "text-amber-300" : "text-emerald-300"}>
                    {fmt(coverage.coveragePct)}٪
                  </span>
                  <span className="tx3">
                    {rtl
                      ? `${coverage.mappedActivities} از ${coverage.totalActivities} فعالیت نگاشت‌شده`
                      : `${coverage.mappedActivities} of ${coverage.totalActivities} mapped`}
                  </span>
                </div>
                {Number(coverage.unmappedActivities) > 0 && (
                  <div className="mt-1 text-[9px] font-light text-amber-300">
                    {rtl
                      ? `⚠️ ${coverage.unmappedActivities} فعالیت به هیچ مدرکی نگاشت نشده و محافظ IFC روی آن اعمال نمی‌شود`
                      : `⚠️ ${coverage.unmappedActivities} activities bypass the IFC guard`}
                  </div>
                )}
                {Array.isArray(coverage.unmapped) &&
                  coverage.unmapped.slice(0, 4).map((u: Json, k: number) => (
                    <div key={`${u.activityId}-${k}`} className="mt-0.5 text-[9px] font-light tx3">
                      {u.code ?? u.activityId} — {u.nameFa ?? "—"}
                    </div>
                  ))}
              </div>
            )}
            {poAudit && (
              <div className="glass-row rounded-lg px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] font-light">
                  <span className="tx2">{rtl ? "ارجاع مدارک سازنده به سفارش خرید" : "Vendor doc PO refs"}</span>
                  <span className="tx1">{poAudit.linked}/{poAudit.total}</span>
                  {Number(poAudit.missing) > 0 && (
                    <span className="text-amber-300">{rtl ? `${poAudit.missing} بی‌ارجاع` : `${poAudit.missing} missing`}</span>
                  )}
                  {Number(poAudit.orphan) > 0 && (
                    <span className="text-rose-300">{rtl ? `${poAudit.orphan} یتیم` : `${poAudit.orphan} orphan`}</span>
                  )}
                </div>
                {poAudit.noteFa && <div className="mt-1 text-[9px] font-light tx3">{poAudit.noteFa}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-3">
        <div className="mb-2 text-[10.5px] font-light tx2">{rtl ? "کاتالوگ گزارش‌ها" : "Report catalog"}</div>
        <div className="flex flex-col gap-1.5">
          {ENG_REPORT_CATALOG.map((r) => (
            <div key={r.code} className="glass-row flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2.5 py-2 text-[9.5px] font-light">
              <span className="tx1">{r.code}</span>
              <span className="tx2">{rtl ? r.title.fa : r.title.en}</span>
              <span className="tx3">{r.audiences.join(" · ")}</span>
              <span className="ms-auto flex items-center gap-1.5">
                {ENG_EXPORTS.map((x) => (
                  <button
                    key={x.format}
                    type="button"
                    onClick={() => openEngReport(r.code, x.format, r.audiences.includes("official") ? "official" : "internal")}
                    className="glass-row rounded-md px-1.5 py-0.5 text-[9px] font-light tx2 transition hover:tx1"
                    title={`${rtl ? r.title.fa : r.title.en} — ${rtl ? x.fa : x.en}`}
                  >
                    {rtl ? x.fa : x.en}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[9px] font-light tx3">
          {rtl
            ? "خروجی A4 با سربرگ سه‌لوگو تولید می‌شود؛ برای PDF از گزینهٔ چاپ مرورگر استفاده کنید."
            : "A4 output carries the three-logo letterhead; use browser print for PDF."}
        </div>
      </div>

      <div className="glass rounded-2xl p-3">
        <div className="mb-2 text-[10.5px] font-light tx2">{rtl ? "پله‌های پیشرفت مصوب" : "Rule of credit steps"}</div>
        <div className="flex flex-wrap gap-2">
          {ROC_STEPS.map((s) => (
            <div key={s.code} className="glass-row rounded-lg px-2.5 py-1.5 text-[9.5px] font-light">
              <span className="tx1">{s.pct}٪</span> <span className="tx3">{s.titleFa}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[9px] font-light tx3">
          {rtl
            ? `هدف صدور: ${Object.entries(PURPOSE_FA).map(([k, v]) => `${k}=${v}`).join(" · ")}`
            : Object.keys(PURPOSE_FA).join(" · ")}
        </div>
      </div>
    </div>
  );
}

function Empty({ rtl, inline }: { rtl: boolean; inline?: boolean }) {
  return (
    <div className={`${inline ? "" : "glass rounded-2xl"} px-3 py-6 text-center text-[10px] font-light tx3`}>
      {rtl ? "داده‌ای برای نمایش نیست" : "No data to display"}
    </div>
  );
}
