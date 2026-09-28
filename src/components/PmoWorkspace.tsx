/**
 * P8 / PMO-1..3 — میز کار دفتر مدیریت پروژه (d6).
 *
 * سه بخش: منشور پروژه، فرم‌ساز مصوب و کارت سلامت. هیچ محاسبه‌ای این‌جا
 * «تصمیم» نمی‌گیرد: امتیاز سلامت، نسخهٔ فرم و گردش تأیید سمت سرور است و
 * این پنل فقط ورودی می‌فرستد و پاسخ را نشان می‌دهد.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import { PmoClient } from "../services/pmoApi";
import {
  HEALTH_BANDS,
  HEALTH_CRITERIA,
  type PmoFormEntryRow,
  type PmoFormRow,
  type PmoHealthRow,
  type PmoCharterRow,
  type PmoWorkspacePayload,
} from "../services/pmoWorkspace";

export type PmoTab = "charter" | "forms" | "health";

const STATUS_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  approved: "مصوب",
  returned: "برگشتی",
  superseded: "جایگزین‌شده",
  published: "منتشرشده",
  retired: "بازنشسته",
};
const STATUS_EN: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  returned: "Returned",
  superseded: "Superseded",
  published: "Published",
  retired: "Retired",
};
const statusLabel = (s: string, rtl: boolean) => (rtl ? STATUS_FA[s] : STATUS_EN[s]) ?? s;
const STATUS_TONE: Record<string, string> = {
  approved: "text-emerald-300",
  published: "text-emerald-300",
  submitted: "text-sky-300",
  returned: "text-rose-300",
  superseded: "text-amber-300",
  retired: "text-amber-300",
  draft: "tx3",
};

const inputCls =
  "glass-row w-full rounded-lg border b-line-soft px-2.5 py-1.5 text-[10.5px] font-light tx1 outline-none focus:b-line";
const chipCls = "rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] font-light transition disabled:opacity-40";

const today = () => new Date().toISOString().slice(0, 10);
const fx = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: digits });

/* خطوط ساده → ساختار؛ کاربر «عنوان | مقدار» می‌نویسد. */
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function Section({ lang, title, hint, children }: { lang: Lang; title: string; hint?: string; children: React.ReactNode }) {
  const rtl = lang === "fa";
  return (
    <section className="glass-dark rounded-2xl p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-normal tx1">{title}</h4>
        {hint && <span className="text-[8.5px] font-extralight tx3">{hint}</span>}
      </div>
      <div dir={rtl ? "rtl" : "ltr"}>{children}</div>
    </section>
  );
}

function StatusChip({ lang, status }: { lang: Lang; status: string }) {
  const rtl = lang === "fa";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[8.5px] font-light ${STATUS_TONE[status] ?? "tx3"} border b-line-soft`}>
      {statusLabel(status, rtl)}
    </span>
  );
}

function usePmo(projectId: string | undefined) {
  const { user } = useAuth();
  const client = useMemo(() => new PmoClient(projectId ?? "", user?.id ?? null), [projectId, user?.id]);
  const [data, setData] = useState<PmoWorkspacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!projectId) return;
    const r = await client.workspace();
    if (r.ok) { setData(r.data); setError(null); }
    else setError(`${r.message ?? "خواندن میز کار ناموفق بود"} (${r.code ?? "?"})`);
  }, [client, projectId]);
  useEffect(() => { void load(); }, [load]);
  /** هر اقدام: یک درخواست، یک بازخوانی؛ پیام خطا همان پیام سرور است. */
  const run = useCallback(async (fn: () => Promise<{ ok: boolean; message?: string; code?: string }>, okMsg: string) => {
    setBusy(true);
    const r = await fn();
    if (!r.ok) setError(`${r.message ?? "اقدام ناموفق بود"} (${r.code ?? "?"})`);
    else setError(null);
    await load();
    setBusy(false);
    return { ok: r.ok, okMsg, message: r.message, code: r.code };
  }, [load]);
  return { client, data, error, busy, run, reload: load };
}

export default function PmoWorkspace({
  lang,
  initialTab = "charter",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: PmoTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const { projectScope } = useSystem();
  const { data, error, busy, run, client, reload } = usePmo(projectScope?.projectId);
  const [tab, setTab] = useState<PmoTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const TABS: { id: PmoTab; fa: string; en: string; icon: string }[] = [
    { id: "charter", fa: "منشور پروژه (PMO-1)", en: "Project charter (PMO-1)", icon: "📜" },
    { id: "forms", fa: "فرم‌ساز مصوب (PMO-2)", en: "Approved forms (PMO-2)", icon: "🧾" },
    { id: "health", fa: "کارت سلامت پروژه (PMO-3)", en: "Project health (PMO-3)", icon: "💚" },
  ];

  if (!projectScope?.projectId) {
    return <div className="p-4 text-[10.5px] font-light tx3">{rtl ? "پروژه‌ای انتخاب نشده است." : "No project selected."}</div>;
  }

  const metrics = data?.metrics;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition ${tab === t.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
            >
              <span>{t.icon}</span>
              <span>{rtl ? t.fa : t.en}</span>
            </button>
          ))}
          <button onClick={() => void reload()} className="ms-auto rounded-lg px-2.5 py-1 text-[9.5px] font-light tx3 transition hover:tx1">
            ↻ {rtl ? "بازخوانی" : "Refresh"}
          </button>
        </nav>
      )}

      {metrics && (
        <div className="grid shrink-0 grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { fa: "منشور مصوب", en: "Approved charter", v: metrics.charters.hasApprovedCharter ? (rtl ? "دارد" : "yes") : (rtl ? "ندارد" : "no") },
            { fa: "منشور", en: "Charters", v: `${metrics.charters.total}` },
            { fa: "فرم منتشرشده", en: "Published forms", v: `${metrics.forms.published}` },
            { fa: "رکورد فرم", en: "Form entries", v: `${metrics.entries.total}` },
            { fa: "سلامت", en: "Health", v: metrics.health.score === null ? "—" : `${fx(metrics.health.score, 1)} (${metrics.health.band})` },
          ].map((k) => (
            <div key={k.en} className="glass-row rounded-xl px-2.5 py-1.5">
              <div className="text-[8.5px] font-extralight tx3">{rtl ? k.fa : k.en}</div>
              <div className="text-[13px] font-normal tabular-nums tx1" dir="ltr">{k.v}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="shrink-0 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[10px] font-light text-rose-200">
          {error}
        </div>
      )}

      <div className="thin-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto pe-1">
        {!data && !error && <div className="p-3 text-[10.5px] font-light tx3">{rtl ? "در حال خواندن…" : "Loading…"}</div>}
        {data && tab === "charter" && <CharterTab lang={lang} data={data} busy={busy} run={run} client={client} />}
        {data && tab === "forms" && <FormsTab lang={lang} data={data} busy={busy} run={run} client={client} />}
        {data && tab === "health" && <HealthTab lang={lang} data={data} busy={busy} run={run} client={client} />}
      </div>
    </div>
  );
}

/* ═══════════════════════ PMO-1 منشور ═══════════════════════ */

type Run = (fn: () => Promise<{ ok: boolean; message?: string; code?: string }>, okMsg: string) => Promise<{ ok: boolean; okMsg: string }>;

function CharterTab({ lang, data, busy, run, client }: { lang: Lang; data: PmoWorkspacePayload; busy: boolean; run: Run; client: PmoClient }) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const can = data.can;
  const [form, setForm] = useState({
    CharterNo: "", TitleFa: "", SponsorFa: "", ManagerFa: "", ScopeInFa: "", ScopeOutFa: "",
    objectives: "", milestones: "", risks: "", BudgetAmount: "", Currency: "IRR", NoteFa: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canCreate = can.charterEdit && form.CharterNo.trim() && form.TitleFa.trim() && form.SponsorFa.trim() && form.ScopeInFa.trim() && lines(form.objectives).length > 0;

  const create = () =>
    client.createCharter({
      CharterNo: form.CharterNo.trim(),
      TitleFa: form.TitleFa.trim(),
      SponsorFa: form.SponsorFa.trim(),
      ManagerFa: form.ManagerFa.trim() || null,
      ObjectivesFa: lines(form.objectives),
      ScopeInFa: form.ScopeInFa.trim(),
      ScopeOutFa: form.ScopeOutFa.trim() || null,
      Milestones: lines(form.milestones).map((l) => {
        const [title, date, deliverable] = l.split("|").map((x) => x.trim());
        return { TitleFa: title, TargetDate: date, DeliverableFa: deliverable || null };
      }),
      BudgetAmount: form.BudgetAmount.trim() ? Number(form.BudgetAmount) : null,
      Currency: form.Currency,
      Risks: lines(form.risks).map((l) => {
        const [title, severity, mitigation] = l.split("|").map((x) => x.trim());
        return { TitleFa: title, Severity: severity || "medium", MitigationFa: mitigation || null };
      }),
      NoteFa: form.NoteFa.trim() || null,
    });

  const askNote = (msg: string) => window.prompt(msg) ?? null;

  return (
    <div className="space-y-2.5">
      {can.charterEdit && (
        <Section lang={lang} title={rtl ? "ثبت منشور تازه" : "New charter"} hint={rtl ? "هر هدف/نقطهٔ عطف/ریسک در یک خط؛ بخش‌ها با | جدا می‌شوند" : "one per line; parts separated by |"}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input className={inputCls} placeholder={rtl ? "شمارهٔ منشور" : "Charter no."} dir="ltr" value={form.CharterNo} onChange={(e) => set("CharterNo", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "عنوان" : "Title"} value={form.TitleFa} onChange={(e) => set("TitleFa", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "حامی/کارفرما" : "Sponsor"} value={form.SponsorFa} onChange={(e) => set("SponsorFa", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "مدیر پروژه" : "Manager"} value={form.ManagerFa} onChange={(e) => set("ManagerFa", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "بودجه" : "Budget"} dir="ltr" value={form.BudgetAmount} onChange={(e) => set("BudgetAmount", e.target.value)} />
            <select className={inputCls} value={form.Currency} onChange={(e) => set("Currency", e.target.value)}>
              {["IRR", "EUR", "USD"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            <textarea className={`${inputCls} h-24`} placeholder={rtl ? "اهداف (هر خط یک هدف، حداقل یکی)" : "Objectives (one per line)"} value={form.objectives} onChange={(e) => set("objectives", e.target.value)} />
            <textarea className={`${inputCls} h-24`} placeholder={rtl ? "نقاط عطف: عنوان | 2026-10-01 | تحویل‌دادنی" : "Milestones: title | YYYY-MM-DD | deliverable"} value={form.milestones} onChange={(e) => set("milestones", e.target.value)} />
            <textarea className={`${inputCls} h-24`} placeholder={rtl ? "ریسک‌ها: عنوان | high | کاهش" : "Risks: title | high | mitigation"} value={form.risks} onChange={(e) => set("risks", e.target.value)} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            <textarea className={inputCls} rows={2} placeholder={rtl ? "دامنهٔ داخل پروژه" : "Scope in"} value={form.ScopeInFa} onChange={(e) => set("ScopeInFa", e.target.value)} />
            <textarea className={inputCls} rows={2} placeholder={rtl ? "خارج از دامنه (اختیاری)" : "Scope out"} value={form.ScopeOutFa} onChange={(e) => set("ScopeOutFa", e.target.value)} />
            <input className={inputCls} placeholder={rtl ? "یادداشت" : "Note"} value={form.NoteFa} onChange={(e) => set("NoteFa", e.target.value)} />
          </div>
          <button
            disabled={busy || !canCreate}
            onClick={() => void run(create, rtl ? "منشور پیش‌نویس ثبت شد" : "Charter draft saved")}
            className={`${chipCls} mt-2 text-sky-300 hover:tx1`}
          >
            ＋ {rtl ? "ثبت پیش‌نویس منشور" : "Save charter draft"}
          </button>
        </Section>
      )}

      <Section lang={lang} title={rtl ? "منشورها" : "Charters"} hint={rtl ? "فقط یک منشور می‌تواند مصوب باشد؛ تصویب تازه، قبلی را جایگزین می‌کند" : "only one approved at a time"}>
        <div className="space-y-2">
          {data.charters.length === 0 && <div className="text-[10px] font-light tx3">{rtl ? "منشوری ثبت نشده است." : "No charters."}</div>}
          {data.charters.map((c) => (
            <CharterRow key={c.Id} lang={lang} row={c} can={data.can} busy={busy} run={run} client={client} self={user?.id ?? null} askNote={askNote} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function CharterRow({
  lang, row, can, busy, run, client, self, askNote,
}: {
  lang: Lang; row: PmoCharterRow; can: PmoWorkspacePayload["can"]; busy: boolean; run: Run; client: PmoClient;
  self: string | null; askNote: (m: string) => string | null;
}) {
  const rtl = lang === "fa";
  const editable = row.Status === "draft" || row.Status === "returned";
  const mine = row.CreatedBy === self;
  return (
    <div className="glass-row rounded-xl p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9.5px] tx3" dir="ltr">{row.CharterNo}</span>
        <span className="text-[11px] font-normal tx1">{row.TitleFa}</span>
        <StatusChip lang={lang} status={row.Status} />
        <span className="text-[9px] font-extralight tx3">{row.SponsorFa}</span>
        {row.ManagerFa && <span className="text-[9px] font-extralight tx3">{rtl ? "مدیر" : "PM"}: {row.ManagerFa}</span>}
        {row.BudgetAmount !== null && <span className="text-[9px] font-light tx2 tabular-nums" dir="ltr">{fx(row.BudgetAmount)} {row.Currency}</span>}
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          {can.charterEdit && editable && (
            <button disabled={busy} className={`${chipCls} text-sky-300`}
              onClick={() => void run(() => client.charterTransition(row.CharterNo, "submit"), rtl ? "منشور ارسال شد" : "Submitted")}>
              ↑ {rtl ? "ارسال" : "Submit"}
            </button>
          )}
          {can.charterApprove && row.Status === "submitted" && (
            <>
              <button disabled={busy} className={`${chipCls} text-emerald-300`}
                onClick={() => void run(() => client.charterTransition(row.CharterNo, "approve"), rtl ? "منشور مصوب شد" : "Approved")}>
                ✓ {rtl ? "تصویب" : "Approve"}
              </button>
              <button disabled={busy} className={`${chipCls} text-amber-300`}
                onClick={() => {
                  const note = askNote(rtl ? "دلیل برگشت منشور:" : "Return reason:");
                  if (note) void run(() => client.charterTransition(row.CharterNo, "return", note), rtl ? "منشور برگشت خورد" : "Returned");
                }}>
                ↩ {rtl ? "برگشت با دلیل" : "Return"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1.5 text-[9.5px] font-light tx2 md:grid-cols-2">
        <div><b className="tx1">{rtl ? "اهداف" : "Objectives"}:</b> {row.ObjectivesFa.join(" · ") || "—"}</div>
        <div><b className="tx1">{rtl ? "دامنه" : "Scope"}:</b> {row.ScopeInFa}</div>
        {row.Milestones.length > 0 && (
          <div className="md:col-span-2">
            <b className="tx1">{rtl ? "نقاط عطف" : "Milestones"}:</b>{" "}
            {row.Milestones.map((m, i) => <span key={i} className="me-2 inline-block" dir="ltr">{m.TitleFa} · {m.TargetDate}</span>)}
          </div>
        )}
        {row.Risks.length > 0 && (
          <div className="md:col-span-2">
            <b className="tx1">{rtl ? "ریسک‌ها" : "Risks"}:</b>{" "}
            {row.Risks.map((r, i) => (
              <span key={i} className={`me-2 inline-block ${r.Severity === "high" ? "text-rose-300" : r.Severity === "medium" ? "text-amber-300" : "tx3"}`}>
                {r.TitleFa} ({r.Severity})
              </span>
            ))}
          </div>
        )}
        {row.ReturnNoteFa && <div className="md:col-span-2 text-amber-200">{rtl ? "دلیل برگشت" : "Return note"}: {row.ReturnNoteFa}</div>}
        {row.SupersededByCharterNo && (
          <div className="md:col-span-2 text-[9px] tx3">
            {rtl ? "جایگزین‌شده با" : "Superseded by"}: <span className="font-mono" dir="ltr">{row.SupersededByCharterNo}</span>
          </div>
        )}
        {row.Status === "submitted" && can.charterApprove && mine && (
          <div className="md:col-span-2 text-[9px] text-amber-300">
            {rtl ? "شما تحریرکنندهٔ این منشور هستید؛ تصویب آن وظیفهٔ دیگری است (SOD-30)." : "You authored this charter; approval belongs to someone else (SOD-30)."}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ PMO-2 فرم‌ساز ═══════════════════════ */

type FieldDraft = { Key: string; LabelFa: string; Type: string; Required: boolean; Options: string; Min: string; Max: string; MaxLen: string };
const emptyField = (): FieldDraft => ({ Key: "", LabelFa: "", Type: "text", Required: true, Options: "", Min: "", Max: "", MaxLen: "200" });
const FIELD_TYPES = ["text", "textarea", "number", "date", "select", "checkbox"];

function FormsTab({ lang, data, busy, run, client }: { lang: Lang; data: PmoWorkspacePayload; busy: boolean; run: Run; client: PmoClient }) {
  const rtl = lang === "fa";
  const can = data.can;
  const [def, setDef] = useState({ Code: "", TitleFa: "", PurposeFa: "", NoteFa: "" });
  const [fields, setFields] = useState<FieldDraft[]>([emptyField()]);
  const setField = (i: number, patch: Partial<FieldDraft>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const canCreate = can.formManage && def.Code.trim() && def.TitleFa.trim() && def.PurposeFa.trim() && fields.every((f) => f.Key.trim() && f.LabelFa.trim());

  const create = () =>
    client.createForm({
      Code: def.Code.trim(), TitleFa: def.TitleFa.trim(), PurposeFa: def.PurposeFa.trim(),
      NoteFa: def.NoteFa.trim() || null,
      Fields: fields.map((f) => ({
        Key: f.Key.trim().toUpperCase(), LabelFa: f.LabelFa.trim(), Type: f.Type, Required: f.Required,
        Options: f.Type === "select" ? f.Options.split(",").map((x) => x.trim()).filter(Boolean) : [],
        Min: f.Type === "number" && f.Min.trim() ? Number(f.Min) : null,
        Max: f.Type === "number" && f.Max.trim() ? Number(f.Max) : null,
        MaxLen: (f.Type === "text" || f.Type === "textarea") && f.MaxLen.trim() ? Number(f.MaxLen) : null,
        HelpFa: null,
      })),
    });

  const published = data.forms.filter((f) => f.Status === "published");
  const [entryForm, setEntryForm] = useState<string>("");
  const activeForm = data.forms.find((f) => f.Code === entryForm && f.Status === "published") ?? published[0] ?? null;
  const [subject, setSubject] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const submitEntry = () => {
    if (!activeForm) return Promise.resolve({ ok: false, message: rtl ? "فرم منتشرشده‌ای نیست" : "no published form", code: "E-UI-NO-FORM" });
    const payload: Record<string, unknown> = {};
    for (const f of activeForm.Fields) {
      const raw = values[f.Key] ?? "";
      if (f.Type === "checkbox") payload[f.Key] = raw === "true";
      else if (f.Type === "number") payload[f.Key] = raw.trim() === "" ? null : Number(raw);
      else payload[f.Key] = raw.trim() === "" ? null : raw.trim();
    }
    return client.createEntry({ FormCode: activeForm.Code, SubjectFa: subject.trim(), Data: payload });
  };

  return (
    <div className="space-y-2.5">
      {can.formManage && (
        <Section lang={lang} title={rtl ? "تعریف فرم تازه" : "New form definition"} hint={rtl ? "کلید فیلد با حروف بزرگ/رقم/زیرخط" : "keys: A-Z, 0-9, _"}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input className={inputCls} placeholder={rtl ? "کد فرم" : "Code"} dir="ltr" value={def.Code} onChange={(e) => setDef((d) => ({ ...d, Code: e.target.value }))} />
            <input className={inputCls} placeholder={rtl ? "عنوان" : "Title"} value={def.TitleFa} onChange={(e) => setDef((d) => ({ ...d, TitleFa: e.target.value }))} />
            <input className={inputCls} placeholder={rtl ? "هدف فرم" : "Purpose"} value={def.PurposeFa} onChange={(e) => setDef((d) => ({ ...d, PurposeFa: e.target.value }))} />
            <input className={inputCls} placeholder={rtl ? "یادداشت" : "Note"} value={def.NoteFa} onChange={(e) => setDef((d) => ({ ...d, NoteFa: e.target.value }))} />
          </div>
          <div className="mt-2 space-y-1.5">
            {fields.map((f, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <input className={`${inputCls} w-28`} placeholder="KEY" dir="ltr" value={f.Key} onChange={(e) => setField(i, { Key: e.target.value })} />
                <input className={`${inputCls} w-40`} placeholder={rtl ? "برچسب" : "Label"} value={f.LabelFa} onChange={(e) => setField(i, { LabelFa: e.target.value })} />
                <select className={`${inputCls} w-28`} value={f.Type} onChange={(e) => setField(i, { Type: e.target.value })}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {f.Type === "select" && (
                  <input className={`${inputCls} w-48`} placeholder={rtl ? "گزینه‌ها با کاما" : "options, comma"} value={f.Options} onChange={(e) => setField(i, { Options: e.target.value })} />
                )}
                {f.Type === "number" && (
                  <>
                    <input className={`${inputCls} w-20`} placeholder="min" dir="ltr" value={f.Min} onChange={(e) => setField(i, { Min: e.target.value })} />
                    <input className={`${inputCls} w-20`} placeholder="max" dir="ltr" value={f.Max} onChange={(e) => setField(i, { Max: e.target.value })} />
                  </>
                )}
                {(f.Type === "text" || f.Type === "textarea") && (
                  <input className={`${inputCls} w-24`} placeholder="maxLen" dir="ltr" value={f.MaxLen} onChange={(e) => setField(i, { MaxLen: e.target.value })} />
                )}
                <label className="flex items-center gap-1 text-[9.5px] font-light tx2">
                  <input type="checkbox" checked={f.Required} onChange={(e) => setField(i, { Required: e.target.checked })} />
                  {rtl ? "الزامی" : "required"}
                </label>
                <button className={`${chipCls} tx3`} disabled={fields.length === 1} onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className={`${chipCls} tx3`} onClick={() => setFields((fs) => [...fs, emptyField()])}>＋ {rtl ? "فیلد" : "Field"}</button>
          </div>
          <button disabled={busy || !canCreate} className={`${chipCls} mt-2 text-sky-300`} onClick={() => void run(create, rtl ? "فرم پیش‌نویس ثبت شد" : "Form draft saved")}>
            ＋ {rtl ? "ثبت فرم پیش‌نویس" : "Save form draft"}
          </button>
        </Section>
      )}

      <Section lang={lang} title={rtl ? "فرم‌ها و نسخه‌ها" : "Forms & versions"} hint={rtl ? "نسخهٔ منتشرشده تغییرناپذیر است؛ برای تغییر، فرم جدید با همان کد بسازید" : "published versions are immutable"}>
        <div className="space-y-2">
          {data.forms.length === 0 && <div className="text-[10px] font-light tx3">{rtl ? "فرمی تعریف نشده است." : "No forms."}</div>}
          {data.forms.map((f) => (
            <div key={f.Id} className="glass-row rounded-xl p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[9.5px] tx3" dir="ltr">{f.Code}</span>
                <span className="text-[11px] font-normal tx1">{f.TitleFa}</span>
                <StatusChip lang={lang} status={f.Status} />
                <span className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[9px] tx2" dir="ltr">v{f.Version}</span>
                {can.formManage && f.Status === "draft" && (
                  <button disabled={busy} className={`${chipCls} ms-auto text-emerald-300`}
                    onClick={() => void run(() => client.formTransition(f.Code, "publish"), rtl ? "فرم منتشر شد" : "Published")}>
                    ↑ {rtl ? "انتشار" : "Publish"}
                  </button>
                )}
                {can.formManage && f.Status === "published" && (
                  <button disabled={busy} className={`${chipCls} ms-auto text-amber-300`}
                    onClick={() => void run(() => client.formTransition(f.Code, "retire"), rtl ? "فرم بازنشسته شد" : "Retired")}>
                    ↓ {rtl ? "بازنشستگی" : "Retire"}
                  </button>
                )}
              </div>
              <div className="mt-1.5 text-[9px] font-light tx3">{f.PurposeFa}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {f.Fields.map((fl) => (
                  <span key={fl.Key} className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] font-light tx2" dir="ltr">
                    {fl.Key}:{fl.Type}{fl.Required ? "*" : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {can.formSubmit && (
        <Section lang={lang} title={rtl ? "ثبت رکورد فرم" : "Form entry"} hint={rtl ? "داده با نسخهٔ منتشرشده اعتبارسنجی می‌شود" : "validated against the published version"}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <select className={inputCls} value={activeForm?.Code ?? ""} onChange={(e) => { setEntryForm(e.target.value); setValues({}); }}>
              {published.length === 0 && <option value="">{rtl ? "فرم منتشرشده‌ای نیست" : "no published form"}</option>}
              {published.map((f) => <option key={f.Code} value={f.Code}>{f.Code} — {f.TitleFa} (v{f.Version})</option>)}
            </select>
            <input className={`${inputCls} md:col-span-2`} placeholder={rtl ? "موضوع رکورد" : "Subject"} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          {activeForm && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              {activeForm.Fields.map((f) => (
                <label key={f.Key} className="block">
                  <span className="mb-1 block text-[9px] font-light tx3">{f.LabelFa}{f.Required ? " *" : ""}</span>
                  {f.Type === "select" ? (
                    <select className={inputCls} value={values[f.Key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.Key]: e.target.value }))}>
                      <option value="">—</option>
                      {f.Options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.Type === "checkbox" ? (
                    <input type="checkbox" checked={values[f.Key] === "true"} onChange={(e) => setValues((v) => ({ ...v, [f.Key]: e.target.checked ? "true" : "false" }))} />
                  ) : (
                    <input
                      className={inputCls}
                      type={f.Type === "number" ? "number" : f.Type === "date" ? "date" : "text"}
                      dir="ltr"
                      value={values[f.Key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.Key]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
          )}
          <button disabled={busy || !activeForm || !subject.trim()} className={`${chipCls} mt-2 text-sky-300`}
            onClick={() => void run(submitEntry, rtl ? "رکورد پیش‌نویس ثبت شد" : "Entry draft saved")}>
            ＋ {rtl ? "ثبت پیش‌نویس رکورد" : "Save entry draft"}
          </button>
        </Section>
      )}

      <Section lang={lang} title={rtl ? "رکوردهای فرم" : "Form entries"} hint={rtl ? "با نسخهٔ فرم زمان ثبت گره خورده‌اند" : "pinned to the form version"}>
        <div className="space-y-2">
          {data.entries.length === 0 && <div className="text-[10px] font-light tx3">{rtl ? "رکوردی ثبت نشده است." : "No entries."}</div>}
          {data.entries.map((en) => <EntryRow key={en.Id} lang={lang} row={en} form={data.forms.find((f) => f.Code === en.FormCode && f.Version === en.FormVersion)} can={data.can} busy={busy} run={run} client={client} />)}
        </div>
      </Section>
    </div>
  );
}

function EntryRow({ lang, row, form, can, busy, run, client }: { lang: Lang; row: PmoFormEntryRow; form?: PmoFormRow; can: PmoWorkspacePayload["can"]; busy: boolean; run: Run; client: PmoClient }) {
  const rtl = lang === "fa";
  const label = (key: string) => form?.Fields.find((f) => f.Key === key)?.LabelFa ?? key;
  return (
    <div className="glass-row rounded-xl p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9px] tx3" dir="ltr">{row.FormCode}@v{row.FormVersion}</span>
        <span className="text-[10.5px] font-normal tx1">{row.SubjectFa}</span>
        <StatusChip lang={lang} status={row.Status} />
        <div className="ms-auto flex gap-1.5">
          {can.formSubmit && (row.Status === "draft" || row.Status === "returned") && (
            <button disabled={busy} className={`${chipCls} text-sky-300`}
              onClick={() => void run(() => client.entryTransition(row.Id, "submit"), rtl ? "رکورد ارسال شد" : "Submitted")}>
              ↑ {rtl ? "ارسال" : "Submit"}
            </button>
          )}
          {can.formApprove && row.Status === "submitted" && (
            <>
              <button disabled={busy} className={`${chipCls} text-emerald-300`}
                onClick={() => void run(() => client.entryTransition(row.Id, "approve"), rtl ? "رکورد تأیید شد" : "Approved")}>
                ✓ {rtl ? "تأیید" : "Approve"}
              </button>
              <button disabled={busy} className={`${chipCls} text-amber-300`}
                onClick={() => {
                  const note = window.prompt(rtl ? "دلیل برگشت رکورد:" : "Return reason:");
                  if (note) void run(() => client.entryTransition(row.Id, "return", note), rtl ? "رکورد برگشت خورد" : "Returned");
                }}>
                ↩ {rtl ? "برگشت" : "Return"}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-2 text-[9px] font-light tx2">
        {Object.entries(row.Data ?? {}).map(([k, v]) => (
          <span key={k}>{label(k)}: <b className="tx1">{typeof v === "boolean" ? (rtl ? (v ? "بله" : "خیر") : String(v)) : v === null || v === "" ? "—" : String(v)}</b></span>
        ))}
      </div>
      {row.ReturnNoteFa && <div className="mt-1 text-[9px] font-light text-amber-200">{rtl ? "دلیل برگشت" : "Return note"}: {row.ReturnNoteFa}</div>}
    </div>
  );
}

/* ═══════════════════════ PMO-3 کارت سلامت ═══════════════════════ */

function HealthTab({ lang, data, busy, run, client }: { lang: Lang; data: PmoWorkspacePayload; busy: boolean; run: Run; client: PmoClient }) {
  const rtl = lang === "fa";
  const can = data.can;
  const model = data.criteriaModel.length ? data.criteriaModel : HEALTH_CRITERIA.map((c) => ({ ...c }));
  const [asOf, setAsOf] = useState(today());
  const [periodNo, setPeriodNo] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Record<string, { Score: string; EvidenceFa: string }>>(
    Object.fromEntries(model.map((c) => [c.Code, { Score: "", EvidenceFa: "" }])),
  );
  const setRow = (code: string, patch: Partial<{ Score: string; EvidenceFa: string }>) =>
    setRows((r) => ({ ...r, [code]: { ...r[code], ...patch } }));
  const complete = model.every((c) => rows[c.Code]?.Score.trim() !== "" && rows[c.Code]?.EvidenceFa.trim());

  const create = () =>
    client.createAssessment({
      AsOfDate: asOf,
      PeriodNo: periodNo.trim() ? Number(periodNo) : null,
      NoteFa: note.trim() || null,
      Criteria: model.map((c) => ({ Code: c.Code, Weight: c.Weight, Score: Number(rows[c.Code].Score), EvidenceFa: rows[c.Code].EvidenceFa.trim() })),
    });

  return (
    <div className="space-y-2.5">
      {can.healthRecord && (
        <Section
          lang={lang}
          title={rtl ? "ارزیابی سلامت پروژه" : "Project health assessment"}
          hint={rtl ? `وزن‌ها ثابت است (جمع ۱۰۰)؛ سبز ≥ ${HEALTH_BANDS.green} · کهربایی ≥ ${HEALTH_BANDS.amber}` : `fixed weights; green ≥ ${HEALTH_BANDS.green}`}
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[9px] font-light tx3">{rtl ? "تاریخ ارزیابی" : "As-of date"}</span>
              <input className={inputCls} type="date" dir="ltr" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[9px] font-light tx3">{rtl ? "شمارهٔ دوره (اختیاری)" : "Period (optional)"}</span>
              <input className={inputCls} dir="ltr" value={periodNo} onChange={(e) => setPeriodNo(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[9px] font-light tx3">{rtl ? "یادداشت" : "Note"}</span>
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <div className="mt-2 space-y-1.5">
            {model.map((c) => (
              <div key={c.Code} className="flex flex-wrap items-center gap-2">
                <span className="w-44 text-[10px] font-light tx2">
                  {rtl ? c.TitleFa : c.TitleEn} <span className="tx3">({c.Weight}٪)</span>
                </span>
                <input className={`${inputCls} w-20`} dir="ltr" placeholder={rtl ? "امتیاز" : "score"} value={rows[c.Code]?.Score ?? ""} onChange={(e) => setRow(c.Code, { Score: e.target.value })} />
                <input className={`${inputCls} flex-1`} placeholder={rtl ? "شاهد عددی/مدرکی" : "evidence"} value={rows[c.Code]?.EvidenceFa ?? ""} onChange={(e) => setRow(c.Code, { EvidenceFa: e.target.value })} />
              </div>
            ))}
          </div>
          <button disabled={busy || !complete} className={`${chipCls} mt-2 text-sky-300`} onClick={() => void run(create, rtl ? "کارت سلامت ثبت شد" : "Assessment saved")}>
            ＋ {rtl ? "ثبت ارزیابی" : "Save assessment"}
          </button>
        </Section>
      )}

      <Section lang={lang} title={rtl ? "کارت‌های سلامت" : "Health cards"} hint={rtl ? "امتیاز و نوار از سرور" : "score & band from server"}>
        <div className="space-y-2">
          {data.assessments.length === 0 && <div className="text-[10px] font-light tx3">{rtl ? "ارزیابی‌ای ثبت نشده است." : "No assessments."}</div>}
          {data.assessments.map((a) => <HealthRow key={a.Id} lang={lang} row={a} model={model} can={can} busy={busy} run={run} client={client} />)}
        </div>
      </Section>
    </div>
  );
}

function HealthRow({
  lang, row, model, can, busy, run, client,
}: {
  lang: Lang; row: PmoHealthRow; model: { Code: string; Weight: number; TitleFa: string; TitleEn: string }[];
  can: PmoWorkspacePayload["can"]; busy: boolean; run: Run; client: PmoClient;
}) {
  const rtl = lang === "fa";
  const tone = row.Band === "green" ? "text-emerald-300" : row.Band === "amber" ? "text-amber-300" : row.Band === "red" ? "text-rose-300" : "tx3";
  return (
    <div className="glass-row rounded-xl p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9.5px] tx3" dir="ltr">{row.AsOfDate}</span>
        {row.PeriodNo !== null && <span className="text-[9px] font-light tx3">{rtl ? "دوره" : "period"} <span dir="ltr">{row.PeriodNo}</span></span>}
        <span className={`text-[12px] font-normal tabular-nums ${tone}`} dir="ltr">{fx(row.ScoreTotal, 1)} · {row.Band ?? "—"}</span>
        <StatusChip lang={lang} status={row.Status} />
        <div className="ms-auto flex gap-1.5">
          {can.healthRecord && (row.Status === "draft" || row.Status === "returned") && (
            <button disabled={busy} className={`${chipCls} text-sky-300`} onClick={() => void run(() => client.assessmentTransition(row.Id, "submit"), rtl ? "ارزیابی ارسال شد" : "Submitted")}>
              ↑ {rtl ? "ارسال" : "Submit"}
            </button>
          )}
          {can.healthApprove && row.Status === "submitted" && (
            <>
              <button disabled={busy} className={`${chipCls} text-emerald-300`} onClick={() => void run(() => client.assessmentTransition(row.Id, "approve"), rtl ? "ارزیابی مصوب شد" : "Approved")}>
                ✓ {rtl ? "تصویب" : "Approve"}
              </button>
              <button disabled={busy} className={`${chipCls} text-amber-300`}
                onClick={() => {
                  const note = window.prompt(rtl ? "دلیل برگشت ارزیابی:" : "Return reason:");
                  if (note) void run(() => client.assessmentTransition(row.Id, "return", note), rtl ? "ارزیابی برگشت خورد" : "Returned");
                }}>
                ↩ {rtl ? "برگشت" : "Return"}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-2 text-[9px] font-light tx2">
        {row.Criteria.map((c) => (
          <span key={c.Code} className="rounded border b-line-soft px-1.5 py-0.5">
            {model.find((m) => m.Code === c.Code)?.[rtl ? "TitleFa" : "TitleEn"] ?? c.Code} · {c.Score}
          </span>
        ))}
      </div>
      {row.NoteFa && <div className="mt-1 text-[9px] font-light tx3">{row.NoteFa}</div>}
      {row.ReturnNoteFa && <div className="mt-1 text-[9px] font-light text-amber-200">{rtl ? "دلیل برگشت" : "Return note"}: {row.ReturnNoteFa}</div>}
    </div>
  );
}
