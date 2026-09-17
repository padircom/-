import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../services/auditLogger";
import type { Lang } from "../data/framework";

/* ═══════════════ پنل پیمان و فهرست بها (cnt-v1، دامنهٔ d14) ═══════════════
 * تحویلی D3 ماژول CONTRACT & IPC. این پنل داخل تب «مدیریت هزینه» میز کار
 * مالی سوار می‌شود و آیتم سایدبار جدید نمی‌سازد — قید ارتقای درون‌برنامه‌ای.
 *
 * دو حالت ارزش‌گذاری (فهرست بهایی و مقطوع) در فرم ثبت ردیف با یک کلید از هم
 * جدا می‌شوند و میدان‌های بی‌ربط اصلاً نمایش داده نمی‌شوند؛ چون تجربه نشان
 * داده کاربر هر میدانی را که ببیند پر می‌کند و ترکیب بی‌معنا می‌سازد.
 *
 * سرور همان اعتبارسنجی را دوباره انجام می‌دهد؛ آنچه اینجاست فقط برای کوتاه
 * کردن رفت‌وبرگشت کاربر است، نه جای کنترل سمت سرور. */

const PROJECT_ID = "p1";

type Json = Record<string, any>;

type BasisFilter = "all" | "unit_price" | "lump_sum";

/**
 * خواندن آگاه از مجوز.
 *
 * `getJson` معمولی ۴۰۳ را مثل «داده‌ای نیست» برمی‌گرداند؛ برای دفتر
 * ضمانت‌نامه که مجوز جداگانه دارد این یعنی کاربرِ بی‌دسترسی «هیچ
 * وثیقه‌ای ثبت نشده» می‌بیند — دقیقاً همان توهمی که این ماژول باید
 * از بین ببرد.
 */
async function getGuarded(path: string, userId: string): Promise<{
  data: Json | null; denied: boolean; unauth: boolean;
}> {
  try {
    const res = await fetch(path, {
      headers: { accept: "application/json", ...(userId ? { "x-user-id": userId } : {}) },
    });
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

async function getJson(path: string): Promise<Json | null> {
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

type PostResult =
  | { ok: true; data: Json }
  | { ok: false; messageFa: string; issues?: { field?: string; messageFa: string }[] };

async function postJson(path: string, body: Record<string, unknown>, userId: string): Promise<PostResult> {
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
    if (res.status === 401) return { ok: false, messageFa: "برای ثبت باید وارد شوید" };
    if (res.status === 403) return { ok: false, messageFa: err.message || "نقش شما اجازهٔ این ثبت را ندارد" };
    if (res.status === 409) return { ok: false, messageFa: err.message || "رکورد تکراری است" };
    return { ok: false, messageFa: err.message || "ثبت انجام نشد", issues: err.issues };
  } catch {
    return { ok: false, messageFa: "ارتباط با سرور برقرار نشد" };
  }
}

const fmt = (n: number) => Number(n || 0).toLocaleString("fa-IR", { maximumFractionDigits: 0 });
const fmtB = (n: number) => `${(Number(n || 0) / 1_000_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} میلیارد`;

const CEILING_TONE: Record<string, string> = {
  ok: "bg-emerald-400/15 text-emerald-300",
  warning: "bg-amber-400/15 text-amber-200",
  exceeded: "bg-rose-400/15 text-rose-300",
};
const CEILING_FA: Record<string, string> = { ok: "در محدوده", warning: "نزدیک سقف", exceeded: "عبور از سقف" };

/* ─────────────── اجزای کوچک (هم‌شکل میز کار مالی) ─────────────── */

function Metric({ label, value, hint, tone = "tx1" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
      <div className="text-[8.5px] font-extralight tx3">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums ${tone}`}>{value}</div>
      {hint && <div className="text-[8px] font-extralight tx4">{hint}</div>}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
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

type FieldSpec = {
  name: string;
  fa: string;
  kind: "text" | "number" | "date" | "select";
  required?: boolean;
  options?: { value: string; fa: string }[];
  hintFa?: string;
};

function Field({
  spec,
  value,
  error,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const base = `w-full rounded-lg border bg-black/25 px-2 py-1.5 text-[10px] tx1 outline-none transition ${
    error ? "border-rose-400/60" : "b-line-soft focus:border-sky-400/50"
  }`;
  return (
    <label className="block">
      <span className="mb-1 block text-[8.5px] font-extralight tx3">
        {spec.fa}
        {spec.required && <span className="text-rose-300"> *</span>}
      </span>
      {spec.kind === "select" ? (
        <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(spec.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.fa}</option>
          ))}
        </select>
      ) : (
        <input
          className={base}
          type={spec.kind === "number" ? "number" : spec.kind === "date" ? "date" : "text"}
          value={value}
          dir={spec.kind === "number" || spec.kind === "date" ? "ltr" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error ? (
        <span className="mt-0.5 block text-[8px] text-rose-300">{error}</span>
      ) : spec.hintFa ? (
        <span className="mt-0.5 block text-[8px] font-extralight tx4">{spec.hintFa}</span>
      ) : null}
    </label>
  );
}

/* ─────────────── فرم عمومی ─────────────── */

function EntryForm({
  titleFa,
  noteFa,
  fields,
  submitFa,
  disabledFa,
  onSubmit,
}: {
  titleFa: string;
  noteFa?: string;
  fields: FieldSpec[];
  submitFa: string;
  disabledFa?: string;
  onSubmit: (values: Record<string, string>) => Promise<PostResult & { successFa?: string }>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ phase: "idle" | "sending" | "ok" | "error"; messageFa?: string }>({ phase: "idle" });

  const set = (k: string, v: string) => {
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((p) => (p[k] ? { ...p, [k]: "" } : p));
  };

  const submit = async () => {
    setState({ phase: "sending" });
    setErrors({});
    const r = await onSubmit(values);
    if (r.ok) {
      setState({ phase: "ok", messageFa: (r as any).successFa ?? "ثبت شد" });
      setValues({});
      return;
    }
    /* ایراد میدانی کنار همان میدان می‌نشیند؛ ایراد کلی بالای فرم. */
    const fieldErrors: Record<string, string> = {};
    for (const i of r.issues ?? []) {
      if (i.field) fieldErrors[i.field] = i.messageFa;
    }
    setErrors(fieldErrors);
    const generic = (r.issues ?? []).filter((i) => !i.field).map((i) => i.messageFa);
    setState({ phase: "error", messageFa: generic.length ? generic.join(" · ") : r.messageFa });
  };

  return (
    <Panel title={titleFa} note={noteFa}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {fields.map((f) => (
          <Field key={f.name} spec={f} value={values[f.name] ?? ""} error={errors[f.name]} onChange={(v) => set(f.name, v)} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={submit}
          disabled={state.phase === "sending" || Boolean(disabledFa)}
          title={disabledFa}
          className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-[9.5px] text-sky-200 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.phase === "sending" ? "در حال ثبت…" : submitFa}
        </button>
        {disabledFa && <span className="text-[8.5px] tx4">{disabledFa}</span>}
        {state.phase === "ok" && <span className="rounded-lg bg-emerald-400/10 px-2 py-1 text-[9px] text-emerald-300">{state.messageFa}</span>}
        {state.phase === "error" && <span className="rounded-lg bg-rose-400/10 px-2 py-1 text-[9px] text-rose-300">{state.messageFa}</span>}
        {Object.keys(errors).length > 0 && (
          <span className="text-[8.5px] tx4">{Object.keys(errors).length} میدان نیازمند اصلاح است</span>
        )}
      </div>
    </Panel>
  );
}

/* ══════════════════════════ پنل اصلی ══════════════════════════ */

/* ═══════════════ دفتر ضمانت‌نامه و پیش‌پرداخت (D7) ═══════════════ */

const ALERT_TONE: Record<string, string> = {
  none: "tx1",
  d30: "text-amber-200",
  d10: "text-amber-200",
  d3: "text-red-300",
  overdue: "text-red-300",
};

const HEALTH_TONE: Record<string, string> = {
  green: "text-emerald-300",
  amber: "text-amber-200",
  red: "text-red-300",
};

/**
 * دفتر وثیقه‌های یک پیمان.
 *
 * دو چیز اینجا دیده می‌شود که در هیچ فهرست ردیفی دیده نمی‌شد:
 * «چه وثیقه‌ای باید می‌بود و نیست» (خلأ پوشش) و «کدام ضمانت‌نامه در
 * سامانه معتبر است ولی تاریخش گذشته» — نبودِ یک سطر و دروغ بودنِ یک
 * سطر، هر دو در جدول ساده نامرئی‌اند.
 */
function GuaranteeSection({
  contractId, userId, onDone,
}: { contractId: string; userId: string; onDone: () => void }) {
  const [reg, setReg] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const load = useCallback(async () => {
    if (!contractId) { setReg(null); return; }
    setBusy(true);
    const q = `?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`;
    const r = await getGuarded(`/api/cnt/guarantee${q}`, userId);
    setReg(r.data);
    setDenied(r.denied);
    setUnauth(r.unauth);
    setBusy(false);
  }, [contractId, userId]);

  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (path: string, body: Json, okFa: string, auditAction: string) => {
    const r = await postJson(path, body, userId);
    if (r.ok) {
      logAudit(auditAction, "Contracts", okFa);
      setMsg({ kind: "ok", text: okFa });
      await load();
      onDone();
    } else {
      /* تلاش ناموفق هم ثبت می‌شود: رد شدن یک آزادسازی وثیقه به همان
         اندازهٔ پذیرفتنش برای بازرس معنا دارد. */
      logAudit(`${auditAction}_DENIED`, "Contracts", r.messageFa);
      setMsg({
        kind: "err",
        text: r.messageFa,
        details: (r as Json).issues?.map((i: Json) => i.messageFa) ?? (r as Json).detailsFa,
      });
    }
    return r;
  }, [load, onDone, userId]);

  if (!contractId) return null;

  if (denied) {
    return (
      <Panel title="دفتر ضمانت‌نامه">
        <div className="py-4 text-center">
          <div className="text-[10px] tx2">
            {unauth ? "برای دیدن دفتر وثیقه باید وارد شوید" : "نقش شما اجازهٔ دیدن دفتر ضمانت‌نامه را ندارد"}
          </div>
          {!unauth && <div className="mt-1 font-mono text-[8.5px] tx4">cnt.guarantee.view</div>}
          <div className="mt-1 text-[8.5px] tx3">اعداد پنهان‌اند، نه صفر.</div>
        </div>
      </Panel>
    );
  }

  const items: Json[] = reg?.items ?? [];
  const health: Json = reg?.health ?? {};
  const advance: Json = reg?.advance ?? {};

  return (
    <div className="space-y-3">
      {/* ── سلامت وثیقه‌ای ── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Metric
          label="سلامت وثیقه"
          value={health.headlineFa ?? "—"}
          tone={HEALTH_TONE[health.status] ?? "tx1"}
        />
        <Metric label="جمع وثیقه" value={fmtB(reg?.totalAmount ?? 0)} hint={`${fmtB(reg?.liveAmount ?? 0)} معتبر`} />
        <Metric
          label="نزدیک انقضا"
          value={fmt(reg?.expiringSoon ?? 0)}
          tone={(reg?.expiringSoon ?? 0) > 0 ? "text-amber-200" : "tx1"}
          hint="کمتر از سی روز"
        />
        <Metric
          label="منقضی ثبت‌نشده"
          value={fmt(reg?.expiredSilently ?? 0)}
          tone={(reg?.expiredSilently ?? 0) > 0 ? "text-red-300" : "tx1"}
          hint="در سامانه معتبر، در واقعیت نه"
        />
        <Metric
          label="پیش‌پرداخت بازیافت‌نشده"
          value={fmtB(advance.outstanding ?? 0)}
          hint={advance.recoveredPct != null ? `${fmt(advance.recoveredPct)}٪ بازیافت‌شده` : "قسطی ثبت نشده"}
        />
      </div>

      {msg && (
        <div
          className="glass rounded-2xl px-3 py-2.5"
          style={{ borderInlineStart: `3px solid ${msg.kind === "ok" ? "#059669" : "#DC2626"}` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] tx1">{msg.text}</div>
              {msg.details?.length ? (
                <ul className="mt-1 space-y-0.5">
                  {msg.details.map((d, i) => (
                    <li key={i} className="text-[9px] tx2">⛔ {d}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button onClick={() => setMsg(null)} className="shrink-0 text-[10px] tx3 hover:tx1">✕</button>
          </div>
        </div>
      )}

      {/* ── خلأ پوشش ── */}
      {(reg?.coverageGapsFa?.length ?? 0) > 0 && (
        <Panel title="خلأ پوشش وثیقه" note="نبودِ یک سطر در جدول دیده نمی‌شود؛ اینجا دیده می‌شود">
          <ul className="space-y-1">
            {(reg?.coverageGapsFa ?? []).map((g: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-[9.5px]">
                <span className="shrink-0 text-red-300">⛔</span>
                <span className="tx2">{g}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {(reg?.warningsFa?.length ?? 0) > 0 && (
        <Panel title="هشدار دفتر وثیقه">
          <ul className="space-y-1">
            {(reg?.warningsFa ?? []).map((w: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-[9.5px]">
                <span className="shrink-0 text-amber-200">⚠</span>
                <span className="tx2">{w}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── فهرست ضمانت‌نامه‌ها ── */}
      <Panel
        title="دفتر ضمانت‌نامه"
        note={busy ? "در حال بارگذاری…" : "تاریخ مؤثر با تمدید محاسبه می‌شود؛ تاریخ اصلی سند بانکی پاک نمی‌شود"}
      >
        {items.length === 0 ? (
          <div className="py-4 text-center text-[9.5px] tx3">ضمانت‌نامه‌ای ثبت نشده است</div>
        ) : (
          <div className="space-y-1">
            {items.map((g) => (
              <div key={g.Id} className="glass-row rounded-xl px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="min-w-0 flex-1 truncate text-[10px] tx1">
                    {g.Code} · {g.typeFa}
                  </div>
                  <div className="text-[9px] tx3">{g.BankName} · {g.GuaranteeNo}</div>
                  <div className="text-[11px] tx1">{fmtB(g.Amount)}</div>
                  <div className={`text-[9px] ${ALERT_TONE[g.state?.alert] ?? "tx3"}`}>
                    {g.state?.statusFa}
                    {g.state?.daysToExpiry != null && ` · ${fmt(g.state.daysToExpiry)} روز`}
                  </div>
                  {g.state?.isLive && (
                    <>
                      <button
                        onClick={() => {
                          /* TD-UI-04: هنوز prompt مرورگر است. */
                          const d = window.prompt("تاریخ تمدید (YYYY-MM-DD):");
                          if (!d) return;
                          void act(
                            `/api/cnt/guarantee/${g.Id}/extend?projectId=${PROJECT_ID}&contractId=${contractId}`,
                            { newExpiry: d },
                            `ضمانت‌نامهٔ ${g.Code} تا ${d} تمدید شد`,
                            "CNT_GUARANTEE_EXTEND",
                          );
                        }}
                        className="glass-row rounded-lg px-2 py-1 text-[9px] tx2 transition hover:tx1"
                      >
                        تمدید
                      </button>
                      {/* آزادسازی و ضبط زیر مجوز دیگری‌اند (SOD-13)؛ دکمه
                          برای همه دیده می‌شود و سرور ۴۰۳ می‌دهد، چون
                          پنهان‌کردنش کاربر را از فهمیدن علت محروم می‌کند. */}
                      <button
                        onClick={() => {
                          if (!window.confirm(`آزادسازی ضمانت‌نامهٔ ${g.Code}؟ این عمل برگشت‌پذیر نیست.`)) return;
                          void act(
                            `/api/cnt/guarantee/${g.Id}/close?projectId=${PROJECT_ID}&contractId=${contractId}`,
                            { action: "release" },
                            `ضمانت‌نامهٔ ${g.Code} آزاد شد`,
                            "CNT_GUARANTEE_RELEASE",
                          );
                        }}
                        className="glass-row rounded-lg px-2 py-1 text-[9px] tx2 transition hover:tx1"
                      >
                        آزادسازی
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm(`ضبط ضمانت‌نامهٔ ${g.Code}؟ این عمل برگشت‌پذیر نیست.`)) return;
                          void act(
                            `/api/cnt/guarantee/${g.Id}/close?projectId=${PROJECT_ID}&contractId=${contractId}`,
                            { action: "forfeit" },
                            `ضمانت‌نامهٔ ${g.Code} ضبط شد`,
                            "CNT_GUARANTEE_FORFEIT",
                          );
                        }}
                        className="glass-row rounded-lg px-2 py-1 text-[9px] tx2 transition hover:tx1"
                      >
                        ضبط
                      </button>
                    </>
                  )}
                </div>
                {(g.state?.warningsFa?.length ?? 0) > 0 && (
                  <div className="mt-1 text-[8.5px] text-amber-200">⚠ {g.state.warningsFa.join(" · ")}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── ثبت ضمانت‌نامه ── */}
      <EntryForm
        titleFa="ثبت ضمانت‌نامهٔ تازه"
        noteFa="شمارهٔ سند بانکی الزامی است — بدون آن استعلام از بانک ممکن نیست"
        submitFa="ثبت ضمانت‌نامه"
        disabledFa={userId ? undefined : "برای ثبت باید وارد شوید"}
        fields={[
          { name: "code", fa: "کد ضمانت‌نامه", required: true, kind: "text" },
          {
            name: "guaranteeType", fa: "نوع", required: true, kind: "select",
            options: [
              { value: "performance", fa: "حسن انجام تعهدات" },
              { value: "advance", fa: "پیش‌پرداخت" },
              { value: "retention", fa: "حسن انجام کار" },
              { value: "bid", fa: "شرکت در مناقصه" },
              { value: "warranty", fa: "دورهٔ تضمین" },
            ],
          },
          { name: "bankName", fa: "بانک صادرکننده", required: true, kind: "text" },
          { name: "guaranteeNo", fa: "شمارهٔ سند بانکی", required: true, kind: "text" },
          { name: "amount", fa: "مبلغ (ریال)", required: true, kind: "number" },
          { name: "issueDate", fa: "تاریخ صدور", required: true, hintFa: "YYYY-MM-DD", kind: "text" },
          { name: "expiryDate", fa: "تاریخ انقضا", required: true, hintFa: "YYYY-MM-DD", kind: "text" },
        ]}
        onSubmit={async (v) => {
          const r = await act(
            `/api/cnt/guarantee?projectId=${PROJECT_ID}&contractId=${contractId}`,
            {
              code: v.code, guaranteeType: v.guaranteeType, bankName: v.bankName,
              guaranteeNo: v.guaranteeNo, amount: Number(v.amount),
              issueDate: v.issueDate, expiryDate: v.expiryDate,
            },
            `ضمانت‌نامهٔ ${v.code} ثبت شد`,
            "CNT_GUARANTEE_SAVE",
          );
          if (r.ok) {
            const w: string[] = (r.data as Json).warningsFa ?? [];
            return { ...r, successFa: w.length ? `ثبت شد — ${w.join(" · ")}` : `ضمانت‌نامهٔ ${v.code} ثبت شد` };
          }
          return r;
        }}
      />

      {/* ── پیش‌پرداخت ── */}
      <Panel
        title="دفتر پیش‌پرداخت"
        note="ماندهٔ بازیافت‌نشده از پرداخت منهای بازیافت محاسبه می‌شود، نه از ستون ذخیره‌شده"
      >
        {(advance.installments?.length ?? 0) === 0 ? (
          <div className="py-4 text-center text-[9.5px] tx3">قسطی ثبت نشده است</div>
        ) : (
          <div className="space-y-1">
            {advance.installments.map((a: Json) => (
              <div key={a.Id} className="glass-row flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-2.5 py-2">
                <div className="text-[10px] tx1">قسط {fmt(a.InstallmentNo)}</div>
                <div className="flex-1 text-[9px] tx3">{a.PaidAt}</div>
                <div className="text-[10px] tx1">{fmtB(a.PaidAmount)}</div>
                <div className="text-[9px] tx3">
                  بازیافت {a.recoveredPct != null ? `${fmt(a.recoveredPct)}٪` : "—"}
                </div>
                <div className={`text-[9px] ${a.outstanding > 0 ? "text-amber-200" : "text-emerald-300"}`}>
                  مانده {fmtB(a.outstanding)} · {a.statusFa}
                </div>
              </div>
            ))}
          </div>
        )}
        {(advance.warningsFa?.length ?? 0) > 0 && (
          <ul className="mt-2 space-y-0.5">
            {advance.warningsFa.map((w: string, i: number) => (
              <li key={i} className="text-[8.5px] text-amber-200">⚠ {w}</li>
            ))}
          </ul>
        )}
      </Panel>

      <EntryForm
        titleFa="ثبت قسط پیش‌پرداخت"
        noteFa="سقف مرسوم بیست و پنج درصد مبلغ پیمان است؛ عبور از آن ثبت را نمی‌بندد ولی هشدار می‌دهد"
        submitFa="ثبت قسط"
        disabledFa={userId ? undefined : "برای ثبت باید وارد شوید"}
        fields={[
          { name: "installmentNo", fa: "شمارهٔ قسط", required: true, kind: "number" },
          { name: "paidAmount", fa: "مبلغ پرداختی (ریال)", required: true, kind: "number" },
          { name: "recoveryPct", fa: "نرخ بازیافت (٪)", kind: "number", hintFa: "پیش‌فرض ۲۰" },
          { name: "paidAt", fa: "تاریخ پرداخت", hintFa: "YYYY-MM-DD", kind: "text" },
        ]}
        onSubmit={async (v) => {
          const r = await act(
            `/api/cnt/advance?projectId=${PROJECT_ID}&contractId=${contractId}`,
            {
              installmentNo: Number(v.installmentNo),
              paidAmount: Number(v.paidAmount),
              recoveryPct: v.recoveryPct ? Number(v.recoveryPct) : undefined,
              paidAt: v.paidAt || undefined,
            },
            `قسط ${v.installmentNo} ثبت شد`,
            "CNT_ADVANCE_SAVE",
          );
          if (r.ok) {
            const w: string[] = (r.data as Json).warningsFa ?? [];
            return { ...r, successFa: w.length ? `ثبت شد — ${w.join(" · ")}` : `قسط ${v.installmentNo} ثبت شد` };
          }
          return r;
        }}
      />

      {advance.outstanding > 0 && (
        <EntryForm
          titleFa="محاسبهٔ بازیافت از صورت‌وضعیت"
          noteFa="پیش‌فرض فقط محاسبه است؛ ثبت در دفتر باید صریح خواسته شود"
          submitFa="محاسبه (بدون ثبت)"
          disabledFa={userId ? undefined : "برای محاسبه باید وارد شوید"}
          fields={[
            { name: "grossAmount", fa: "کارکرد ناخالص صورت‌وضعیت (ریال)", required: true, kind: "number" },
          ]}
          onSubmit={async (v) => {
            const r = await postJson(
              `/api/cnt/advance/recover?projectId=${PROJECT_ID}&contractId=${contractId}`,
              { grossAmount: Number(v.grossAmount) },
              userId,
            );
            if (!r.ok) return r;
            const d = r.data as Json;
            const w = (d.warningsFa ?? []).join(" · ");
            return {
              ...r,
              successFa: `کسر بابت بازیافت: ${fmtB(d.recoverable)} (${fmt(d.appliedPct)}٪) · مانده پس از کسر ${fmtB(d.outstandingAfter)}${w ? ` — ${w}` : ""}`,
            };
          }}
        />
      )}
    </div>
  );
}

/* ─────────────── صورت‌وضعیت پیمانکار جزء (14.8) ─────────────── */

const SUB_STATE_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  submitted: "ارسال‌شده",
  reviewed: "بررسی‌شده",
  approved: "تأییدشده",
  rejected: "ردشده",
  paid: "پرداخت‌شده",
};

const SUB_STATE_TONE: Record<string, string> = {
  draft: "tx2",
  submitted: "text-sky-300",
  reviewed: "text-amber-300",
  approved: "text-emerald-300",
  rejected: "text-rose-300",
  paid: "text-emerald-200",
};

/**
 * دفتر صورت‌وضعیت‌های پیمانکار جزء یک پیمان.
 *
 * ستون «منتظر اصلی» عمداً بزرگ نمایش داده می‌شود: مبلغی که به جزء
 * تعهد شده ولی کارفرما هنوز به اصلی نپرداخته، همان چیزی است که
 * پیمانکار را از پا درمی‌آورد و در هیچ گزارش سنتی دیده نمی‌شود.
 */
function SubIpcSection({
  contractId, userId, onDone,
}: { contractId: string; userId: string; onDone: () => void }) {
  const [reg, setReg] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [openId, setOpenId] = useState<string>("");
  const [detail, setDetail] = useState<Json | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const load = useCallback(async () => {
    if (!contractId) { setReg(null); return; }
    const q = `?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`;
    const r = await getGuarded(`/api/cnt/subipc${q}`, userId);
    setReg(r.data);
    setDenied(r.denied);
    setUnauth(r.unauth);
  }, [contractId, userId]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) { setDetail(null); return; }
    const r = await getGuarded(`/api/cnt/subipc/${encodeURIComponent(id)}?projectId=${PROJECT_ID}`, userId);
    setDetail(r.data);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadDetail(openId); }, [openId, loadDetail]);

  /* پیمان که عوض شد، صورت‌وضعیت بازِ پیمان قبلی نباید روی صفحه بماند. */
  useEffect(() => { setOpenId(""); setDetail(null); setMsg(null); }, [contractId]);

  const act = useCallback(async (path: string, body: Json, okFa: string, auditAction: string) => {
    const r = await postJson(path, body, userId);
    if (r.ok) {
      logAudit(auditAction, "Contracts", okFa);
      setMsg({ kind: "ok", text: okFa });
      await load();
      if (openId) await loadDetail(openId);
      onDone();
    } else {
      logAudit(`${auditAction}_DENIED`, "Contracts", r.messageFa);
      setMsg({
        kind: "err",
        text: r.messageFa,
        details: (r as Json).issues?.map((i: Json) => i.messageFa) ?? (r as Json).detailsFa,
      });
    }
    return r;
  }, [load, loadDetail, onDone, openId, userId]);

  if (!contractId) return null;

  if (denied) {
    return (
      <Panel title="صورت‌وضعیت پیمانکار جزء">
        <div className="py-4 text-center">
          <div className="text-[10px] tx2">
            {unauth ? "برای دیدن صورت‌وضعیت جزء باید وارد شوید" : "نقش شما اجازهٔ دیدن صورت‌وضعیت پیمانکار جزء را ندارد"}
          </div>
          {!unauth && <div className="mt-1 font-mono text-[8.5px] tx4">cnt.subipc.view</div>}
          <div className="mt-1 text-[8.5px] tx3">اعداد پنهان‌اند، نه صفر.</div>
        </div>
      </Panel>
    );
  }

  const items: Json[] = reg?.items ?? [];
  const totals: Json = detail?.totals ?? {};
  const lines: Json[] = detail?.lines ?? [];
  const deductions: Json[] = detail?.deductions ?? [];
  const openRow = items.find((x) => x.Id === openId) ?? null;
  const isLocked = Boolean(openRow?.isLocked);
  const nextStates: string[] = detail?.nextStates ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Metric label="تعداد صورت‌وضعیت" value={fmt(reg?.count ?? 0)} />
        <Metric label="ناخالص کل" value={fmtB(reg?.grossTotal ?? 0)} hint="میلیارد ریال" />
        <Metric label="کسور کل" value={fmtB(reg?.deductionTotal ?? 0)} hint="میلیارد ریال" />
        <Metric label="خالص کل" value={fmtB(reg?.netTotal ?? 0)} hint="میلیارد ریال" />
        <Metric
          label="منتظر تأیید اصلی"
          value={fmt(reg?.awaitingMain ?? 0)}
          hint="ریسک نقدینگی"
          tone={(reg?.awaitingMain ?? 0) > 0 ? "text-amber-300" : "text-emerald-300"}
        />
      </div>

      {(reg?.warningsFa ?? []).length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-2.5 py-2">
          {(reg?.warningsFa ?? []).map((w: string, i: number) => (
            <div key={i} className="text-[9px] text-amber-200">{w}</div>
          ))}
        </div>
      )}

      {msg && (
        <div className={`rounded-xl border px-2.5 py-2 ${
          msg.kind === "ok" ? "border-emerald-400/30 bg-emerald-400/5" : "border-rose-400/30 bg-rose-400/5"
        }`}>
          <div className={`text-[9.5px] ${msg.kind === "ok" ? "text-emerald-200" : "text-rose-200"}`}>{msg.text}</div>
          {(msg.details ?? []).map((d, i) => (
            <div key={i} className="mt-0.5 text-[8.5px] tx3">• {d}</div>
          ))}
        </div>
      )}

      <Panel
        title="دفتر صورت‌وضعیت پیمانکار جزء"
        note="پرداخت به جزء پس از تأیید صورت‌وضعیت اصلی — اصل پشت‌به‌پشت"
      >
        {items.length === 0 ? (
          <div className="py-3 text-center text-[9px] tx3">صورت‌وضعیتی ثبت نشده است.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr className="tx3">
                  <th className="px-1.5 py-1 text-right font-extralight">ردیف</th>
                  <th className="px-1.5 py-1 text-right font-extralight">دوره</th>
                  <th className="px-1.5 py-1 text-left font-extralight">ناخالص</th>
                  <th className="px-1.5 py-1 text-left font-extralight">کسور</th>
                  <th className="px-1.5 py-1 text-left font-extralight">خالص</th>
                  <th className="px-1.5 py-1 text-right font-extralight">وضعیت</th>
                  <th className="px-1.5 py-1 text-right font-extralight">اصلی</th>
                  <th className="px-1.5 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.Id} className={`border-t b-line-soft ${openId === it.Id ? "bg-white/5" : ""}`}>
                    <td className="px-1.5 py-1 tabular-nums tx2">{fmt(it.SerialNo)}</td>
                    <td className="px-1.5 py-1 tx1">{it.PeriodCode ?? "—"}</td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx2" dir="ltr">{fmt(it.GrossCurrent)}</td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx3" dir="ltr">{fmt(it.TotalDeductions)}</td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx1" dir="ltr">{fmt(it.NetPayable)}</td>
                    <td className={`px-1.5 py-1 ${SUB_STATE_TONE[String(it.WorkflowState)] ?? "tx2"}`}>{it.stateFa}</td>
                    <td className="px-1.5 py-1 text-[8.5px]">
                      {it.isAwaitingMain
                        ? <span className="text-amber-300">منتظر</span>
                        : <span className="tx3">{it.mainIpcState ? "گره‌خورده" : "—"}</span>}
                    </td>
                    <td className="px-1.5 py-1 text-left">
                      <button
                        onClick={() => setOpenId(openId === it.Id ? "" : String(it.Id))}
                        className="rounded-lg border b-line-soft px-1.5 py-0.5 text-[8.5px] tx2 transition hover:border-sky-400/50"
                      >
                        {openId === it.Id ? "بستن" : "جزئیات"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <EntryForm
        titleFa="صورت‌وضعیت جزء تازه"
        noteFa="گره به صورت‌وضعیت اصلی، شرط تأیید بعدی است"
        fields={[
          { name: "periodCode", fa: "کد دوره", kind: "text", required: true, hintFa: "مثلاً 1405-06" },
          { name: "mainIpcId", fa: "شناسهٔ صورت‌وضعیت اصلی", kind: "text", hintFa: "بدون آن، تأیید ممکن نیست" },
        ]}
        submitFa="ایجاد"
        onSubmit={async (v) => {
          const q = `?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`;
          const r = await act(`/api/cnt/subipc${q}`, {
            periodCode: v.periodCode,
            mainIpcId: v.mainIpcId || undefined,
          }, "صورت‌وضعیت جزء ایجاد شد", "CNT_SUBIPC_CREATE");
          if (r.ok) {
            const d = r.data as Json;
            return { ...r, successFa: `صورت‌وضعیت ردیف ${fmt(d.item?.SerialNo)} ایجاد شد` };
          }
          return r;
        }}
      />

      {openRow && detail && (
        <div className="space-y-3">
          <Panel
            title={`جزئیات ردیف ${fmt(openRow.SerialNo)} — ${openRow.PeriodCode ?? "—"}`}
            note={isLocked ? "قفل: پس از ارسال، ویرایش ممکن نیست" : "قابل ویرایش"}
          >
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric label="ناخالص دوره" value={fmt(totals.gross ?? 0)} />
              <Metric label="کسور پشت‌به‌پشت" value={fmt(totals.backToBack ?? 0)} />
              <Metric
                label="خالص پرداختنی"
                value={fmt(totals.netPayable ?? 0)}
                tone={totals.isNegative ? "text-rose-300" : "tx1"}
                hint={totals.isNegative ? "منفی — انتقال به دورهٔ بعد" : undefined}
              />
              <Metric
                label="وضعیت اصلی"
                value={detail.mainIpcState ? (SUB_STATE_FA[String(detail.mainIpcState)] ?? String(detail.mainIpcState)) : "گره نخورده"}
                tone={detail.mainIpcState ? "tx1" : "text-amber-300"}
              />
            </div>

            {(totals.warningsFa ?? []).map((w: string, i: number) => (
              <div key={i} className="mt-1.5 text-[8.5px] text-amber-200">• {w}</div>
            ))}

            {lines.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="tx3">
                      <th className="px-1.5 py-1 text-right font-extralight">شرح</th>
                      <th className="px-1.5 py-1 text-left font-extralight">مقدار</th>
                      <th className="px-1.5 py-1 text-left font-extralight">نرخ</th>
                      <th className="px-1.5 py-1 text-left font-extralight">مبلغ</th>
                      <th className="px-1.5 py-1 text-left font-extralight">تأیید اصلی</th>
                      <th className="px-1.5 py-1 text-right font-extralight">انحراف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.Id} className="border-t b-line-soft">
                        <td className="px-1.5 py-1 tx1">{l.DescriptionFa}</td>
                        <td className="px-1.5 py-1 text-left tabular-nums tx2" dir="ltr">{fmt(l.Quantity)}</td>
                        <td className="px-1.5 py-1 text-left tabular-nums tx2" dir="ltr">{fmt(l.UnitRate)}</td>
                        <td className="px-1.5 py-1 text-left tabular-nums tx1" dir="ltr">{fmt(l.amount)}</td>
                        <td className="px-1.5 py-1 text-left tabular-nums tx3" dir="ltr">{fmt(l.MainApprovedQty)}</td>
                        <td className={`px-1.5 py-1 text-[8.5px] ${
                          l.varianceFlag === "ok" ? "text-emerald-300"
                            : l.varianceFlag === "exceeds_main" ? "text-rose-300" : "text-amber-300"
                        }`}>
                          {l.varianceFa}
                          {l.excessQty ? <span className="tx3"> ({fmt(l.excessQty)})</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {deductions.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <div className="mb-1 text-[8.5px] font-extralight tx3">کسور پشت‌به‌پشت</div>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="tx3">
                      <th className="px-1.5 py-1 text-right font-extralight">منشأ</th>
                      <th className="px-1.5 py-1 text-right font-extralight">شرح</th>
                      <th className="px-1.5 py-1 text-left font-extralight">مبلغ</th>
                      <th className="px-1.5 py-1 text-right font-extralight">سند</th>
                      <th className="px-1.5 py-1 text-right font-extralight">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductions.map((d) => (
                      <tr key={d.Id} className="border-t b-line-soft">
                        <td className="px-1.5 py-1 tx2">{d.sourceFa}</td>
                        <td className="px-1.5 py-1 tx1">{d.DescriptionFa}</td>
                        <td className={`px-1.5 py-1 text-left tabular-nums ${d.isCountable ? "tx1" : "tx4 line-through"}`} dir="ltr">
                          {fmt(d.Amount)}
                        </td>
                        <td className="px-1.5 py-1 text-[8.5px] tx3">{d.EvidenceDocNo ?? "—"}</td>
                        <td className={`px-1.5 py-1 text-[8.5px] ${d.isCountable ? "text-emerald-300" : "text-amber-300"}`}>
                          {d.statusFa}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-1 text-[8px] font-extralight tx4">
                  فقط کسر تأییدشده از خالص کم می‌شود؛ مورد اختلاف تا حل شدن، جدا نمایش می‌یابد.
                </div>
              </div>
            )}
          </Panel>

          {!isLocked && (
            <>
              <EntryForm
                titleFa="ردیف تازه"
                noteFa="مقدار تأییدشدهٔ اصلی خودکار از صورت‌وضعیت اصلی خوانده می‌شود"
                fields={[
                  { name: "descriptionFa", fa: "شرح", kind: "text", required: true },
                  { name: "boqItemId", fa: "شناسهٔ ردیف فهرست‌بها", kind: "text", hintFa: "برای تطبیق با اصلی" },
                  { name: "unit", fa: "واحد", kind: "text" },
                  { name: "quantity", fa: "مقدار", kind: "number" },
                  { name: "unitRate", fa: "نرخ واحد", kind: "number" },
                ]}
                submitFa="افزودن ردیف"
                onSubmit={async (v) => {
                  const r = await act(`/api/cnt/subipc/${encodeURIComponent(openId)}/line?projectId=${PROJECT_ID}`, {
                    descriptionFa: v.descriptionFa,
                    boqItemId: v.boqItemId || undefined,
                    unit: v.unit || undefined,
                    quantity: v.quantity ? Number(v.quantity) : undefined,
                    unitRate: v.unitRate ? Number(v.unitRate) : undefined,
                  }, "ردیف افزوده شد", "CNT_SUBIPC_LINE");
                  if (r.ok) {
                    const d = r.data as Json;
                    const va = d.varianceFa ? ` — ${d.varianceFa}` : "";
                    return { ...r, successFa: `ردیف ثبت شد · ناخالص ${fmt(d.totals?.gross)}${va}` };
                  }
                  return r;
                }}
              />

              <EntryForm
                titleFa="کسر پشت‌به‌پشت"
                noteFa="کسر بابت مصالح کارفرما، حادثه، دوباره‌کاری یا موارد دیگر"
                fields={[
                  {
                    name: "sourceModule", fa: "منشأ", kind: "select", required: true,
                    options: [
                      { value: "fin_material", fa: "مصالح تحویلی کارفرما" },
                      { value: "hse_incident", fa: "حادثهٔ ایمنی" },
                      { value: "qlt_rework", fa: "دوباره‌کاری کیفی" },
                      { value: "other", fa: "سایر" },
                    ],
                  },
                  { name: "descriptionFa", fa: "شرح", kind: "text", required: true, hintFa: "شرح مبهم هشدار می‌گیرد" },
                  { name: "amount", fa: "مبلغ", kind: "number", required: true },
                  { name: "evidenceDocNo", fa: "شمارهٔ سند", kind: "text", hintFa: "بی‌سند = هشدار" },
                  {
                    name: "status", fa: "وضعیت", kind: "select",
                    options: [
                      { value: "draft", fa: "پیش‌نویس" },
                      { value: "approved", fa: "تأییدشده" },
                      { value: "disputed", fa: "مورد اختلاف" },
                      { value: "waived", fa: "صرف‌نظر شده" },
                    ],
                  },
                ]}
                submitFa="ثبت کسر"
                onSubmit={async (v) => {
                  const r = await act(`/api/cnt/subipc/${encodeURIComponent(openId)}/deduction?projectId=${PROJECT_ID}`, {
                    sourceModule: v.sourceModule,
                    descriptionFa: v.descriptionFa,
                    amount: v.amount ? Number(v.amount) : undefined,
                    evidenceDocNo: v.evidenceDocNo || undefined,
                    status: v.status || undefined,
                  }, "کسر ثبت شد", "CNT_BACKTOBACK_ADD");
                  if (r.ok) {
                    const d = r.data as Json;
                    const w = (d.warningsFa ?? []).length ? ` — ${(d.warningsFa ?? []).join(" · ")}` : "";
                    return { ...r, successFa: `کسر ثبت شد · خالص ${fmt(d.totals?.netPayable)}${w}` };
                  }
                  return r;
                }}
              />
            </>
          )}

          {nextStates.length > 0 && (
            <Panel title="گردش وضعیت" note="تأیید با مدیر پروژه است، نه تهیه‌کننده — تفکیک وظایف">
              <div className="flex flex-wrap gap-1.5">
                {nextStates.map((st) => (
                  <button
                    key={st}
                    onClick={() => void act(
                      `/api/cnt/subipc/${encodeURIComponent(openId)}/transition?projectId=${PROJECT_ID}`,
                      { to: st },
                      `وضعیت به «${SUB_STATE_FA[st] ?? st}» تغییر کرد`,
                      "CNT_SUBIPC_TRANSITION",
                    )}
                    className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx2 transition hover:border-sky-400/50"
                  >
                    {SUB_STATE_FA[st] ?? st}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-[8px] font-extralight tx4">
                تأیید تا پیش از تأیید صورت‌وضعیت اصلی بسته است؛ رد شدن دکمه یعنی دروازه کار کرده.
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── پیشرفت پیمان (14.9) ─────────────── */

const GAP_TONE: Record<string, string> = {
  balanced: "text-emerald-300",
  overpaid: "text-rose-300",
  underpaid: "text-amber-300",
  unknown: "tx3",
};

/**
 * نوار مقایسهٔ فیزیکی و مالی.
 *
 * دو عدد کنار هم روی یک مقیاس: تنها راهی که فاصله‌شان بدون خواندن
 * جدول دیده شود. درصد بالای صد هم بریده نمی‌شود — بریدنش یعنی
 * پنهان کردن دقیقاً همان چیزی که باید دیده شود.
 */
function ProgressBar({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  const width = Math.max(0, Math.min(100, pct));
  const over = pct > 100;
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="text-[8.5px] font-extralight tx3">{label}</span>
        <span className={`text-[10px] font-semibold tabular-nums ${tone}`} dir="ltr">
          {fmt(pct)}٪
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
        <div
          className={`h-full rounded-full ${over ? "bg-rose-400/70" : "bg-sky-400/60"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/** منحنی S ساده با SVG — بدون کتابخانهٔ نمودار. */
function SCurveChart({ points }: { points: Json[] }) {
  if (!points.length) {
    return <div className="py-3 text-center text-[9px] tx3">داده‌ای برای رسم منحنی نیست.</div>;
  }

  const W = 320;
  const H = 90;
  const pad = 4;
  const maxPct = Math.max(100, ...points.map((p) => Math.max(p.plannedPct ?? 0, p.actualPct ?? 0)));
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / maxPct) * (H - pad * 2);

  const line = (key: string) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key] ?? 0).toFixed(1)}`).join(" ");

  /* بخش پیش‌بینی جدا کشیده می‌شود تا خطِ حمل‌شده با خط واقعی اشتباه
     نشود؛ وگرنه نمودار ادعا می‌کند دادهٔ آینده داریم. */
  const firstForecast = points.findIndex((p) => p.isForecast);
  const realCount = firstForecast === -1 ? points.length : firstForecast;

  const realLine = points
    .slice(0, realCount)
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.actualPct ?? 0).toFixed(1)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        <line x1={pad} y1={y(100)} x2={W - pad} y2={y(100)} className="stroke-white/10" strokeWidth="0.5" strokeDasharray="2 2" />
        <path d={line("plannedPct")} fill="none" className="stroke-white/25" strokeWidth="1.2" strokeDasharray="3 2" />
        {realCount > 0 && <path d={realLine} fill="none" className="stroke-sky-400/80" strokeWidth="1.6" />}
        {points.map((p, i) => (
          <circle
            key={p.periodCode}
            cx={x(i)}
            cy={y(p.actualPct ?? 0)}
            r={p.isForecast ? 1 : 1.8}
            className={p.isForecast ? "fill-white/20" : (p.variancePct ?? 0) < 0 ? "fill-rose-400" : "fill-emerald-400"}
          />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-2 text-[8px] tx4">
        <span>▬ واقعی</span>
        <span className="tx4">╌ برنامه</span>
        <span>نقطهٔ توخالی = دورهٔ آینده (واقعیِ حمل‌شده)</span>
      </div>
    </div>
  );
}

/* ─────────────── پل مالی (14.13 / G-03) ─────────────── */

const FIN_STATE_TONE: Record<string, string> = {
  in_sync: "text-emerald-300",
  not_posted: "text-amber-300",
  amount_drift: "text-rose-300",
  orphan_posting: "text-rose-300",
  reversed: "tx4",
};

/**
 * تطبیق پیمان با دفتر مالی و ارسال صورت‌وضعیت به حساب هزینه.
 *
 * دو نقش متفاوت این بخش را می‌بینند و کار متفاوتی می‌کنند: مدیر پیمان
 * و کنترل هزینه فقط مغایرت را می‌بینند، مدیر پروژه ارسال می‌کند
 * (SOD-15). پس دکمه‌ها بر اساس پاسخ سرور ظاهر می‌شوند، نه بر اساس
 * حدس سمت مرورگر.
 */
/* ─────────── ۱۴٫۱۱ گزارش‌های رسمی (D11 + D12) ─────────── */

const RPT_AUDIENCE_FA: Record<string, string> = { internal: "داخلی", official: "رسمی" };

/** قالب‌های خروجی. pdf عمداً «چاپ» نام دارد چون مرورگر چاپ می‌گیرد. */
const RPT_FORMATS: { key: string; fa: string }[] = [
  { key: "pdf", fa: "چاپ / PDF" },
  { key: "word", fa: "ورد" },
  { key: "excel", fa: "اکسل" },
  { key: "csv", fa: "CSV" },
];

function ReportsSection({
  contractId, userId,
}: { contractId: string; userId: string }) {
  const [catalog, setCatalog] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [code, setCode] = useState<string>("");
  const [audience, setAudience] = useState<"internal" | "official">("internal");
  const [preview, setPreview] = useState<Json | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);
  /* سربرگ سند رسمی. مقادیر خالی عمداً خالی می‌مانند تا دروازهٔ سرور
     خودش بگوید چه چیزی کم است، نه اینکه با مقدار ساختگی پر شود. */
  const [lh, setLh] = useState({
    projectName: "", projectCode: "", periodLabel: "",
    preparedBy: "", approvedBy: "", distribution: "",
  });

  const load = useCallback(async () => {
    const r = await getGuarded("/api/cnt/reports", userId);
    setCatalog(r.data);
    setDenied(r.denied);
    setUnauth(r.unauth);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPreview(null); setMsg(null); }, [contractId]);

  const items = ((catalog as Record<string, unknown> | null)?.items as Json[] | undefined) ?? [];
  const visible = items.filter((x) => {
    const auds = (x as Record<string, unknown>).audiences as string[] | undefined;
    return !auds || auds.includes(audience);
  });
  const active = visible.find((x) => (x as Record<string, unknown>).code === code) ?? null;

  /* وقتی مخاطب عوض می‌شود ممکن است گزارش انتخابی دیگر مجاز نباشد. */
  useEffect(() => {
    if (code && !visible.some((x) => (x as Record<string, unknown>).code === code)) {
      setCode("");
      setPreview(null);
    }
  }, [audience, code, visible]);

  const query = useCallback(() => {
    const p = new URLSearchParams({
      projectId: PROJECT_ID,
      contractId,
      audience,
    });
    for (const [k, v] of Object.entries(lh)) if (v.trim()) p.set(k, v.trim());
    return p.toString();
  }, [contractId, audience, lh]);

  const doPreview = useCallback(async () => {
    if (!code) return;
    setBusy(true);
    setMsg(null);
    const r = await getGuarded(`/api/cnt/reports/${code}?${query()}`, userId);
    setPreview(r.data);
    if (!r.data) {
      setMsg({ kind: "err", text: r.unauth ? "برای دیدن گزارش باید وارد شوید" : r.denied ? "مجوز دیدن این گزارش را ندارید" : "گزارش ساخته نشد" });
    }
    setBusy(false);
  }, [code, query, userId]);

  /* خروجی در زبانهٔ تازه باز می‌شود. دانلود مستقیم با fetch امکان‌پذیر
     است ولی هدر x-user-id را از دست می‌دهیم؛ اینجا سرور روی همان
     نشست کاربر تصمیم می‌گیرد. */
  const doRender = useCallback(async (format: string) => {
    if (!code) return;
    setBusy(true);
    setMsg(null);
    const url = `/api/cnt/reports/${code}/render?${query()}&format=${format}`;
    try {
      const res = await fetch(url, { headers: { "x-user-id": userId } });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = (body as Record<string, unknown> | null)?.error as Record<string, unknown> | undefined;
        setMsg({
          kind: "err",
          text: String(err?.message ?? "خروجی ساخته نشد"),
          details: (err?.detailsFa as string[] | undefined) ?? undefined,
        });
        setBusy(false);
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      if (format === "pdf") {
        /* چاپ به PDF کار مرورگر است؛ فایل را باز می‌کنیم نه دانلود. */
        window.open(href, "_blank", "noopener");
      } else {
        const cd = res.headers.get("content-disposition") ?? "";
        const m = /filename="?([^";]+)"?/.exec(cd);
        a.download = m?.[1] ?? `${code}.${format}`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(href), 30_000);
      setMsg({ kind: "ok", text: "خروجی آماده شد" });
      logAudit("CNT_REPORT_RENDER", "Contracts", `${code} · ${format} · ${RPT_AUDIENCE_FA[audience]}`);
    } catch {
      setMsg({ kind: "err", text: "ارتباط با سرور برقرار نشد" });
    }
    setBusy(false);
  }, [code, query, userId, audience]);

  if (unauth) {
    return (
      <section className="rounded-2xl b1 bg-white/[0.02] p-4">
        <h3 className="text-[13px] font-light tx1">گزارش‌های رسمی (۱۴٫۱۱)</h3>
        <p className="mt-2 text-[11px] font-light tx3">برای دیدن گزارش‌ها باید وارد شوید.</p>
      </section>
    );
  }
  if (denied) {
    return (
      <section className="rounded-2xl b1 bg-white/[0.02] p-4">
        <h3 className="text-[13px] font-light tx1">گزارش‌های رسمی (۱۴٫۱۱)</h3>
        <p className="mt-2 text-[11px] font-light tx3">مجوز «cnt.report.view» را ندارید.</p>
      </section>
    );
  }

  const sections = ((preview as Record<string, unknown> | null)?.sections as Json[] | undefined) ?? [];

  return (
    <section className="rounded-2xl b1 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-light tx1">گزارش‌های رسمی (۱۴٫۱۱)</h3>
        <div className="flex items-center gap-1 rounded-lg b1 p-0.5">
          {(["internal", "official"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAudience(a)}
              className={`rounded-md px-2 py-1 text-[10px] font-light transition ${
                audience === a ? "bg-white/10 tx1" : "tx3 hover:tx1"
              }`}
            >
              {RPT_AUDIENCE_FA[a]}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-[10px] font-extralight tx4">
        {audience === "official"
          ? "نسخهٔ رسمی سندی است که ممکن است پیوست نامهٔ اداری شود؛ سربرگ کامل و مجوز صدور لازم است."
          : "نسخهٔ داخلی ابزار کار است و بیرون از سازمان فرستاده نمی‌شود."}
      </p>

      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <select
          value={code}
          onChange={(e) => { setCode(e.target.value); setPreview(null); }}
          className="rounded-lg b1 bg-transparent px-2 py-1.5 text-[11px] font-light tx1"
        >
          <option value="">گزارش را انتخاب کنید…</option>
          {visible.map((x) => {
            const r = x as Record<string, unknown>;
            const t = r.title as Record<string, string> | undefined;
            return (
              <option key={String(r.code)} value={String(r.code)}>
                {t?.fa ?? String(r.code)}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          disabled={!code || busy}
          onClick={() => { void doPreview(); }}
          className="rounded-lg b1 px-3 py-1.5 text-[11px] font-light tx1 transition hover:bg-white/5 disabled:opacity-40"
        >
          پیش‌نمایش
        </button>
      </div>

      {active && (
        <p className="mt-2 text-[10px] font-extralight tx4">
          {String(((active as Record<string, unknown>).purpose as Record<string, string> | undefined)?.fa ?? "")}
        </p>
      )}

      {audience === "official" && (
        <div className="mt-3 rounded-xl b1 bg-white/[0.02] p-3">
          <p className="text-[10px] font-light tx2">سربرگ سند رسمی</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ["projectName", "نام پروژه"],
              ["projectCode", "کد پروژه"],
              ["periodLabel", "دوره"],
              ["preparedBy", "تهیه‌کننده"],
              ["approvedBy", "تأییدکننده"],
              ["distribution", "فهرست توزیع (با ویرگول)"],
            ] as const).map(([k, label]) => (
              <label key={k} className="block">
                <span className="text-[9px] font-extralight tx4">{label}</span>
                <input
                  value={lh[k]}
                  onChange={(e) => setLh((s) => ({ ...s, [k]: e.target.value }))}
                  className="mt-0.5 w-full rounded-lg b1 bg-transparent px-2 py-1 text-[11px] font-light tx1"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {RPT_FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            disabled={!code || busy}
            onClick={() => { void doRender(f.key); }}
            className="rounded-lg b1 px-3 py-1.5 text-[10px] font-light tx2 transition hover:bg-white/5 disabled:opacity-40"
          >
            {f.fa}
          </button>
        ))}
      </div>

      {msg && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-[10px] font-light ${
            msg.kind === "ok" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"
          }`}
        >
          {msg.text}
          {msg.details && msg.details.length > 0 && (
            <ul className="mt-1 list-disc pe-4">
              {msg.details.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      )}

      {preview && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-light tx3">
            {String((preview as Record<string, unknown>).title ?? "")} · دوره{" "}
            {String((preview as Record<string, unknown>).periodLabel ?? "—")}
          </p>
          {sections.map((sec, i) => {
            const s = sec as Record<string, unknown>;
            const title = (s.title as Record<string, string> | undefined)?.fa ?? "";
            if (s.kind === "kpi") {
              const cells = (s.cells as Json[] | undefined) ?? [];
              return (
                <div key={`${title}-${i}`} className="rounded-xl b1 p-3">
                  <p className="text-[10px] font-light tx2">{title}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {cells.map((c, j) => {
                      const cc = c as Record<string, unknown>;
                      const tone = String(cc.tone ?? "");
                      return (
                        <div key={`${String(cc.value)}-${j}`} className="rounded-lg b1 px-2 py-1.5">
                          <p className="text-[9px] font-extralight tx4">
                            {(cc.label as Record<string, string> | undefined)?.fa ?? ""}
                          </p>
                          <p
                            className={`text-[12px] font-light ${
                              tone === "bad" ? "text-rose-300"
                                : tone === "warn" ? "text-amber-200"
                                : tone === "good" ? "text-emerald-300" : "tx1"
                            }`}
                          >
                            {String(cc.value ?? "—")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (s.kind === "table") {
              const cols = (s.columns as Json[] | undefined) ?? [];
              const rows = (s.rows as Json[] | undefined) ?? [];
              return (
                <div key={`${title}-${i}`} className="rounded-xl b1 p-3">
                  <p className="text-[10px] font-light tx2">{title}</p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-[10px] font-light">
                      <thead className="tx4">
                        <tr>
                          {cols.map((c) => {
                            const cc = c as Record<string, unknown>;
                            return (
                              <th key={String(cc.key)} className="px-1.5 py-1 text-start font-extralight">
                                {(cc.title as Record<string, string> | undefined)?.fa ?? String(cc.key)}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="tx2">
                        {rows.slice(0, 20).map((r, ri) => (
                          <tr key={ri} className="border-t border-white/5">
                            {cols.map((c) => {
                              const key = String((c as Record<string, unknown>).key);
                              const v = (r as Record<string, unknown>)[key];
                              return (
                                <td key={key} className="px-1.5 py-1">
                                  {v == null || v === "" ? "—" : typeof v === "number" ? fmt(v) : String(v)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 20 && (
                      <p className="mt-1 text-[9px] font-extralight tx4">
                        {fmt(rows.length - 20)} ردیف دیگر در خروجی کامل
                      </p>
                    )}
                    {rows.length === 0 && (
                      <p className="mt-1 text-[9px] font-extralight tx4">ردیفی نیست.</p>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div key={`${title}-${i}`} className="rounded-xl b1 p-3">
                <p className="text-[10px] font-light tx2">{title}</p>
                <p className="mt-1 whitespace-pre-line text-[10px] font-extralight tx3">
                  {(s.body as Record<string, string> | undefined)?.fa ?? ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FinBridgeSection({
  contractId, userId, onDone,
}: { contractId: string; userId: string; onDone: () => void }) {
  const [rec, setRec] = useState<Json | null>(null);
  const [summary, setSummary] = useState<Json | null>(null);
  const [postable, setPostable] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [preview, setPreview] = useState<Json | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const load = useCallback(async () => {
    if (!contractId) { setRec(null); return; }
    const q = `?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`;
    const [r, s, p] = await Promise.all([
      getGuarded(`/api/cnt/fin/reconcile${q}`, userId),
      getGuarded(`/api/cnt/fin/summary${q}`, userId),
      getGuarded(`/api/cnt/fin/postable${q}`, userId),
    ]);
    setRec(r.data);
    setSummary(s.data);
    setPostable(p.data);
    setDenied(r.denied);
    setUnauth(r.unauth);
  }, [contractId, userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPreview(null); setMsg(null); }, [contractId]);

  const act = useCallback(async (path: string, body: Json, okFa: string, auditAction: string) => {
    const r = await postJson(path, body, userId);
    if (r.ok) {
      logAudit(auditAction, "Contracts", okFa);
      setMsg({ kind: "ok", text: (r.data as Json)?.noteFa ?? okFa });
      await load();
      onDone();
    } else {
      logAudit(`${auditAction}_DENIED`, "Contracts", r.messageFa);
      setMsg({
        kind: "err",
        text: r.messageFa,
        details: (r as Json).detailsFa ?? (r as Json).issues?.map((i: Json) => i.messageFa),
      });
    }
    return r;
  }, [load, onDone, userId]);

  if (!contractId) return null;

  if (denied) {
    return (
      <Panel title="پل مالی">
        <div className="py-4 text-center">
          <div className="text-[10px] tx2">
            {unauth ? "برای دیدن تطبیق مالی باید وارد شوید" : "نقش شما اجازهٔ دیدن دفتر مالی پیمان را ندارد"}
          </div>
          {!unauth && <div className="mt-1 font-mono text-[8.5px] tx4">cnt.fin.view</div>}
        </div>
      </Panel>
    );
  }

  const sm: Json = rec?.summary ?? {};
  const rows: Json[] = rec?.rows ?? [];
  const acc: Json | null = summary?.account ?? null;
  const items: Json[] = postable?.items ?? [];
  const ready = items.filter((i) => i.isPostable && !i.isPosted);

  return (
    <div className="space-y-3">
      <Panel
        title="تطبیق با دفتر مالی"
        note={rec?.costAccountCode
          ? `حساب هزینه: ${rec.costAccountCode}${rec.costAccountFound ? "" : " — در دفتر مالی پیدا نشد"}`
          : "حساب هزینه تعیین نشده"}
      >
        {/* وضعیت تطبیق پیش از هر عددی: اگر دو دفتر یک عدد نمی‌گویند،
            بقیهٔ اعداد این صفحه هم مشکوک‌اند. */}
        <div className={`mb-2 rounded-xl border px-2.5 py-2 ${
          sm.isClean
            ? "border-emerald-400/30 bg-emerald-400/5"
            : sm.amountDrift > 0 || sm.orphan > 0
              ? "border-rose-400/40 bg-rose-400/5"
              : "border-amber-400/30 bg-amber-400/5"
        }`}>
          <div className={`text-[10px] font-semibold ${
            sm.isClean ? "text-emerald-200" : sm.amountDrift > 0 ? "text-rose-200" : "text-amber-200"
          }`}>
            {sm.isClean
              ? "دفتر پیمان و دفتر مالی هم‌ترازند"
              : `${fmt(sm.total ?? 0)} ردیف بررسی شد و هم‌ترازی برقرار نیست`}
          </div>
          {(rec?.warningsFa ?? []).map((w: string, i: number) => (
            <div key={i} className="mt-0.5 text-[8.5px] tx2">• {w}</div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="هماهنگ" value={fmt(sm.inSync ?? 0)} tone="text-emerald-300" />
          <Metric
            label="ارسال‌نشده"
            value={fmt(sm.notPosted ?? 0)}
            hint={sm.notPostedAmount ? `${fmt(sm.notPostedAmount)} ریال` : undefined}
            tone={(sm.notPosted ?? 0) > 0 ? "text-amber-300" : "tx1"}
          />
          <Metric
            label="مغایرت مبلغ"
            value={fmt(sm.amountDrift ?? 0)}
            hint={sm.driftAmount ? `${fmt(sm.driftAmount)} ریال` : undefined}
            tone={(sm.amountDrift ?? 0) > 0 ? "text-rose-300" : "tx1"}
          />
          <Metric
            label="ثبت بی‌مرجع"
            value={fmt(sm.orphan ?? 0)}
            tone={(sm.orphan ?? 0) > 0 ? "text-rose-300" : "tx1"}
          />
        </div>

        {rows.length > 0 && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr className="tx3">
                  <th className="px-1.5 py-1 text-right font-extralight">شماره</th>
                  <th className="px-1.5 py-1 text-right font-extralight">دوره</th>
                  <th className="px-1.5 py-1 text-left font-extralight">خالص پیمان</th>
                  <th className="px-1.5 py-1 text-left font-extralight">ثبت مالی</th>
                  <th className="px-1.5 py-1 text-left font-extralight">اختلاف</th>
                  <th className="px-1.5 py-1 text-right font-extralight">وضعیت</th>
                  <th className="px-1.5 py-1 text-right font-extralight">اقدام</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ipcId} className="border-t b-line-soft">
                    <td className="px-1.5 py-1 tabular-nums tx1">{fmt(r.serialNo)}</td>
                    <td className="px-1.5 py-1 tx2">{r.periodCode || "—"}</td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx1" dir="ltr">{fmt(r.netAmount)}</td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx2" dir="ltr">
                      {r.postedAmount == null ? "—" : fmt(r.postedAmount)}
                    </td>
                    <td className={`px-1.5 py-1 text-left tabular-nums ${
                      r.driftAmount ? "text-rose-300" : "tx4"
                    }`} dir="ltr">
                      {r.driftAmount ? fmt(r.driftAmount) : "۰"}
                    </td>
                    <td className={`px-1.5 py-1 ${FIN_STATE_TONE[String(r.state)] ?? "tx2"}`}>{r.stateFa}</td>
                    <td className="px-1.5 py-1 text-[8px] font-extralight tx4">{r.needsActionFa ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {msg && (
        <div className={`rounded-xl border px-2.5 py-2 ${
          msg.kind === "ok" ? "border-emerald-400/30 bg-emerald-400/5" : "border-rose-400/30 bg-rose-400/5"
        }`}>
          <div className={`text-[9.5px] ${msg.kind === "ok" ? "text-emerald-200" : "text-rose-200"}`}>{msg.text}</div>
          {(msg.details ?? []).map((d, i) => (
            <div key={i} className="mt-0.5 text-[8.5px] tx3">• {d}</div>
          ))}
        </div>
      )}

      {summary && (
        <Panel title="خلاصهٔ مالی پیمان" note="تعهد بر ناخالص سنجیده می‌شود، هزینه بر خالص">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric label="مبلغ پیمان" value={fmtB(summary.contractAmount ?? 0)} />
            <Metric
              label="ناخالص تأییدشده"
              value={fmtB(summary.approvedGross ?? 0)}
              hint={summary.commitmentUsedPct == null ? undefined : `${fmt(summary.commitmentUsedPct)}٪ تعهد`}
            />
            <Metric label="خالص ارسال‌شده" value={fmtB(summary.postedNet ?? 0)} tone="text-emerald-300" />
            <Metric
              label="کسور نگه‌داشته"
              value={fmtB(summary.withheldAmount ?? 0)}
              hint="هنوز پول پروژه"
              tone="text-amber-300"
            />
          </div>

          {(summary.notesFa ?? []).length > 0 && (
            <div className="mt-2 space-y-0.5">
              {(summary.notesFa ?? []).map((n: string, i: number) => (
                <div key={i} className="text-[8.5px] tx3">• {n}</div>
              ))}
            </div>
          )}

          {acc && (
            <div className="mt-2 rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
              <div className="text-[8.5px] font-extralight tx3">حساب هزینهٔ مقصد</div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-2 text-[9px]">
                <span className="font-mono tx2" dir="ltr">{acc.code}</span>
                <span className="tx1">{acc.titleFa}</span>
                <span className="tx4">بودجه {fmtB(acc.budget)}</span>
                <span className={acc.actual > acc.budget ? "text-rose-300" : "tx2"}>
                  هزینه {fmtB(acc.actual)}
                </span>
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* تعیین حساب مقصد — پیش‌نیاز هر ارسالی. */}
      <Panel title="حساب هزینهٔ مقصد" note="بدون آن هیچ عددی از پیمان به مالی نمی‌رسد">
        <EntryForm
          titleFa="تعیین حساب"
          noteFa="کد باید در دفتر حساب‌های همین پروژه موجود باشد"
          fields={[
            { name: "costAccountCode", fa: "کد حساب هزینه", kind: "text", required: true, hintFa: "مثلاً CA-10" },
          ]}
          submitFa="اتصال به حساب"
          onSubmit={async (v) => act(
            `/api/cnt/fin/account?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`,
            { costAccountCode: v.costAccountCode },
            "حساب هزینهٔ پیمان تنظیم شد",
            "CNT_FIN_ACCOUNT",
          )}
        />
      </Panel>

      {/* ارسال — دومرحله‌ای. پیش‌نمایش اول، اعمال بعد. */}
      <Panel
        title="ارسال به مالی"
        note={`${fmt(postable?.readyCount ?? 0)} صورت‌وضعیت آمادهٔ ارسال · ${fmt(postable?.blockedCount ?? 0)} مسدود`}
      >
        {items.length === 0 && (
          <div className="py-2 text-center text-[9px] tx4">صورت‌وضعیتی برای این پیمان نیست</div>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr className="tx3">
                  <th className="px-1.5 py-1 text-right font-extralight">شماره</th>
                  <th className="px-1.5 py-1 text-right font-extralight">دوره</th>
                  <th className="px-1.5 py-1 text-left font-extralight">خالص</th>
                  <th className="px-1.5 py-1 text-right font-extralight">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.ipcId} className="border-t b-line-soft">
                    <td className="px-1.5 py-1 tabular-nums tx1">{fmt(i.serialNo)}</td>
                    <td className="px-1.5 py-1 tx2">{i.periodCode || "—"}</td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx1" dir="ltr">{fmt(i.netAmount)}</td>
                    <td className="px-1.5 py-1 text-[8.5px]">
                      {i.isPosted
                        ? <span className="text-emerald-300">ثبت شده</span>
                        : i.isPostable
                          ? <span className="text-sky-300">آمادهٔ ارسال</span>
                          : <span className="tx4">{i.blockFa}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* پیش‌نمایش نتیجه پیش از اعمال: کسی نباید با یک کلیک دفتر
            مالی را تغییر دهد. */}
        {preview && (
          <div className="mt-2 rounded-xl border border-sky-400/30 bg-sky-400/5 px-2.5 py-2">
            <div className="text-[9px] font-semibold text-sky-200">پیش‌نمایش ثبت — هنوز چیزی تغییر نکرده</div>
            <div className="mt-1 grid grid-cols-2 gap-1.5 text-[8.5px] md:grid-cols-4">
              <div><span className="tx4">خالص: </span><span className="tabular-nums tx1" dir="ltr">{fmt(preview.posting?.netAmount)}</span></div>
              <div><span className="tx4">مانده فعلی: </span><span className="tabular-nums tx2" dir="ltr">{fmt(preview.posting?.previousActual)}</span></div>
              <div><span className="tx4">مانده پس از ثبت: </span><span className="tabular-nums tx1" dir="ltr">{fmt(preview.posting?.nextActual)}</span></div>
              <div><span className="tx4">تفاوت: </span><span className="tabular-nums text-sky-200" dir="ltr">{fmt(preview.posting?.deltaAmount)}</span></div>
            </div>
            {preview.posting?.isRepost && (
              <div className="mt-1 text-[8.5px] text-amber-200">
                این صورت‌وضعیت قبلاً ثبت شده؛ فقط تفاوت اعمال می‌شود
              </div>
            )}
            {preview.budget?.warningFa && (
              <div className="mt-1 text-[8.5px] text-rose-200">⚠ {preview.budget.warningFa}</div>
            )}
          </div>
        )}

        <div className="mt-2">
          <EntryForm
            titleFa="ارسال صورت‌وضعیت"
            noteFa="اول پیش‌نمایش بگیرید، بعد اعمال کنید"
            fields={[
              {
                name: "ipcId", fa: "صورت‌وضعیت", kind: "select", required: true,
                options: ready.map((i: Json) => ({
                  value: String(i.ipcId),
                  fa: `شمارهٔ ${i.serialNo} — ${fmt(i.netAmount)} ریال`,
                })),
              },
              {
                name: "mode", fa: "حالت", kind: "select", required: true,
                options: [
                  { value: "preview", fa: "پیش‌نمایش (بدون اثر)" },
                  { value: "apply", fa: "اعمال دائمی در دفتر مالی" },
                ],
              },
              {
                name: "acceptOverBudget", fa: "پذیرش فراتر از بودجه", kind: "select",
                options: [{ value: "no", fa: "خیر" }, { value: "yes", fa: "بله — آگاهانه می‌پذیرم" }],
                hintFa: "فقط وقتی لازم است که ثبت، حساب را از بودجه رد کند",
              },
            ]}
            submitFa="اجرا"
            disabledFa={ready.length === 0 ? "صورت‌وضعیت آمادهٔ ارسالی نیست" : undefined}
            onSubmit={async (v) => {
              const apply = v.mode === "apply";
              const r = await act(
                `/api/cnt/fin/post?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`,
                {
                  ipcId: v.ipcId,
                  apply,
                  ...(v.acceptOverBudget === "yes" ? { acceptOverBudget: true } : {}),
                },
                apply ? "صورت‌وضعیت در دفتر مالی ثبت شد" : "پیش‌نمایش ساخته شد",
                apply ? "CNT_FIN_POST" : "CNT_FIN_PREVIEW",
              );
              setPreview(r.ok && !apply ? (r.data as Json) : null);
              return r;
            }}
          />
        </div>
      </Panel>

      {/* برگشت: سطر می‌ماند، فقط اثرش پس گرفته می‌شود. */}
      {items.some((i) => i.isPosted) && (
        <Panel title="برگشت ثبت" note="سطر ثبت حذف نمی‌شود؛ با دلیل و وضعیت برگشتی می‌ماند">
          <EntryForm
            titleFa="برگشت"
            noteFa="مبلغ از حساب هزینه پس گرفته می‌شود"
            fields={[
              {
                name: "ipcId", fa: "صورت‌وضعیت", kind: "select", required: true,
                options: items.filter((i: Json) => i.isPosted).map((i: Json) => ({
                  value: String(i.ipcId),
                  fa: `شمارهٔ ${i.serialNo} — ${fmt(i.postedAmount)} ریال`,
                })),
              },
              {
                name: "reasonFa", fa: "دلیل برگشت", kind: "text", required: true,
                hintFa: "دست‌کم ۱۰ نویسه — این متن در سیاههٔ ممیزی می‌ماند",
              },
            ]}
            submitFa="برگشت ثبت"
            onSubmit={async (v) => act(
              `/api/cnt/fin/reverse?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`,
              { ipcId: v.ipcId, reasonFa: v.reasonFa },
              "ثبت مالی برگشت خورد",
              "CNT_FIN_REVERSE",
            )}
          />
        </Panel>
      )}
    </div>
  );
}

/* ─────────────── تابلوی سلامت پیمان (14.10) ─────────────── */

const SEVERITY_TONE: Record<string, string> = {
  critical: "text-rose-300",
  warning: "text-amber-300",
  info: "text-sky-300",
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-rose-400/40 bg-rose-400/5",
  warning: "border-amber-400/30 bg-amber-400/5",
  info: "border-sky-400/30 bg-sky-400/5",
};

const BAND_TONE: Record<string, string> = {
  good: "text-emerald-300",
  watch: "text-amber-300",
  poor: "text-rose-300",
  unknown: "tx3",
};

const TREND_MARK: Record<string, string> = {
  improving: "▲",
  worsening: "▼",
  flat: "—",
  unknown: "؟",
};

const TREND_TONE: Record<string, string> = {
  improving: "text-emerald-300",
  worsening: "text-rose-300",
  flat: "tx3",
  unknown: "tx4",
};

/**
 * تابلوی سنجه، هشدار و روند یک پیمان.
 *
 * ترتیب اجزا عمدی است: تیتر، بعد هشدارهای بحرانی، بعد نمره، و آخر
 * جدول سنجه‌ها. مدیری که فقط سه ثانیه وقت دارد باید در همان سه ثانیه
 * بدترین خبر را ببیند، نه یک جدول مرتب از اعداد.
 */
function KpiSection({
  contractId, userId, onDone,
}: { contractId: string; userId: string; onDone: () => void }) {
  const [card, setCard] = useState<Json | null>(null);
  const [rules, setRules] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const load = useCallback(async () => {
    if (!contractId) { setCard(null); return; }
    const q = `?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`;
    const [k, r] = await Promise.all([
      getGuarded(`/api/cnt/kpi${q}`, userId),
      getGuarded(`/api/cnt/alert-rule?projectId=${PROJECT_ID}`, userId),
    ]);
    setCard(k.data);
    setRules(r.data);
    setDenied(k.denied);
    setUnauth(k.unauth);
  }, [contractId, userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setShowRules(false); setMsg(null); }, [contractId]);

  const act = useCallback(async (path: string, body: Json, okFa: string, auditAction: string) => {
    const r = await postJson(path, body, userId);
    if (r.ok) {
      logAudit(auditAction, "Contracts", okFa);
      setMsg({ kind: "ok", text: (r.data as Json)?.noteFa ?? okFa });
      await load();
      onDone();
    } else {
      logAudit(`${auditAction}_DENIED`, "Contracts", r.messageFa);
      setMsg({
        kind: "err",
        text: r.messageFa,
        details: (r as Json).issues?.map((i: Json) => i.messageFa) ?? (r as Json).detailsFa,
      });
    }
    return r;
  }, [load, onDone, userId]);

  if (!contractId) return null;

  if (denied) {
    return (
      <Panel title="تابلوی سلامت پیمان">
        <div className="py-4 text-center">
          <div className="text-[10px] tx2">
            {unauth ? "برای دیدن تابلوی سلامت باید وارد شوید" : "نقش شما اجازهٔ دیدن سنجه‌های پیمان را ندارد"}
          </div>
          {!unauth && <div className="mt-1 font-mono text-[8.5px] tx4">cnt.kpi.view</div>}
          <div className="mt-1 text-[8.5px] tx3">اعداد پنهان‌اند، نه صفر.</div>
        </div>
      </Panel>
    );
  }

  const health: Json = card?.health ?? {};
  const alerts: Json = card?.alerts ?? {};
  const trend: Json = card?.trend ?? {};
  const kpiValues: Json[] = card?.kpis?.values ?? [];
  const fired: Json[] = alerts.fired ?? [];
  const trendByCode = new Map<string, Json>((trend.trends ?? []).map((t: Json) => [t.code, t]));

  return (
    <div className="space-y-3">
      {/* تیتر: اگر فقط یک سطر خوانده شود، همین است. */}
      <div className={`rounded-2xl border px-3 py-2.5 ${
        alerts.criticalCount > 0 ? SEVERITY_BORDER.critical
          : (trend.emergingFa ?? []).length > 0 ? SEVERITY_BORDER.warning
            : "b-line-soft bg-black/15"
      }`}>
        <div className="text-[8.5px] font-extralight tx3">وضعیت پیمان در یک جمله</div>
        <div className={`mt-0.5 text-[11px] font-semibold ${
          alerts.criticalCount > 0 ? SEVERITY_TONE.critical : "tx1"
        }`}>
          {card?.headlineFa ?? "—"}
        </div>
      </div>

      {/* کیفیت داده پیش از هر عددی: تابلویی که نمی‌داند داده‌اش ناقص
          است، با اطمینان دروغ می‌گوید. */}
      {(card?.dataQualityFa ?? []).length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-2.5 py-2">
          <div className="text-[8.5px] font-extralight text-amber-200">کیفیت داده</div>
          {(card?.dataQualityFa ?? []).map((d: string, i: number) => (
            <div key={i} className="mt-0.5 text-[9px] text-amber-100">• {d}</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric
          label="نمرهٔ سلامت"
          value={health.score == null ? "—" : String(health.score)}
          hint={health.bandFa}
          tone={BAND_TONE[String(health.band)] ?? "tx1"}
        />
        <Metric
          label="هشدار بحرانی"
          value={fmt(alerts.criticalCount ?? 0)}
          tone={(alerts.criticalCount ?? 0) > 0 ? "text-rose-300" : "text-emerald-300"}
        />
        <Metric
          label="هشدار"
          value={fmt(alerts.warningCount ?? 0)}
          tone={(alerts.warningCount ?? 0) > 0 ? "text-amber-300" : "tx1"}
        />
        <Metric
          label="سنجهٔ بی‌داده"
          value={fmt((alerts.skipped ?? []).length)}
          hint="قاعدهٔ سنجیده‌نشده"
          tone={(alerts.skipped ?? []).length > 0 ? "text-amber-300" : "tx1"}
        />
      </div>

      {msg && (
        <div className={`rounded-xl border px-2.5 py-2 ${
          msg.kind === "ok" ? "border-emerald-400/30 bg-emerald-400/5" : "border-rose-400/30 bg-rose-400/5"
        }`}>
          <div className={`text-[9.5px] ${msg.kind === "ok" ? "text-emerald-200" : "text-rose-200"}`}>{msg.text}</div>
          {(msg.details ?? []).map((d, i) => (
            <div key={i} className="mt-0.5 text-[8.5px] tx3">• {d}</div>
          ))}
        </div>
      )}

      {/* هشدارهای فعال با اقدام — هشداری که نمی‌گوید چه باید کرد،
          فقط اضطراب تولید می‌کند. */}
      {fired.length > 0 && (
        <Panel title="هشدارهای فعال" note="به ترتیب شدت">
          <div className="space-y-1.5">
            {fired.map((f) => (
              <div key={f.code} className={`rounded-xl border px-2.5 py-2 ${SEVERITY_BORDER[String(f.severity)] ?? "b-line-soft"}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`text-[10px] font-semibold ${SEVERITY_TONE[String(f.severity)] ?? "tx1"}`}>
                    {f.titleFa}
                  </span>
                  <span className="font-mono text-[8px] tx4" dir="ltr">{f.code}</span>
                  <span className="text-[8.5px] tx3">{f.severityFa}</span>
                </div>
                <div className="mt-0.5 text-[9px] tx2">{f.messageFa}</div>
                <div className="mt-1 text-[8.5px] font-extralight tx3">◀ {f.actionFa}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* پیش‌بینی: تنها جای سامانه که پیش از وقوع حرف می‌زند. */}
      {(trend.emergingFa ?? []).length > 0 && (
        <Panel title="در مسیر هشدار" note="هنوز از آستانه رد نشده، ولی با همین شیب رد می‌کند">
          {(trend.emergingFa ?? []).map((e: string, i: number) => (
            <div key={i} className="text-[9px] text-amber-200">• {e}</div>
          ))}
        </Panel>
      )}

      <Panel
        title="سنجه‌ها"
        note={health.score == null ? String(health.messageFa ?? "") : `پوشش وزنی ${fmt(health.weightCovered)}٪`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[9px]">
            <thead>
              <tr className="tx3">
                <th className="px-1.5 py-1 text-right font-extralight">سنجه</th>
                <th className="px-1.5 py-1 text-left font-extralight">مقدار</th>
                <th className="px-1.5 py-1 text-left font-extralight">دورهٔ قبل</th>
                <th className="px-1.5 py-1 text-center font-extralight">روند</th>
                <th className="px-1.5 py-1 text-right font-extralight">توضیح</th>
              </tr>
            </thead>
            <tbody>
              {kpiValues.map((k) => {
                const t = trendByCode.get(String(k.code));
                return (
                  <tr key={k.code} className="border-t b-line-soft">
                    <td className="px-1.5 py-1 tx1">{k.titleFa}</td>
                    <td className={`px-1.5 py-1 text-left tabular-nums ${k.isComputable ? "tx1" : "tx4"}`} dir="ltr">
                      {k.displayFa}
                    </td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx4" dir="ltr">
                      {t?.previous == null ? "—" : fmt(t.previous)}
                    </td>
                    <td className={`px-1.5 py-1 text-center ${TREND_TONE[String(t?.direction ?? "unknown")]}`}>
                      {TREND_MARK[String(t?.direction ?? "unknown")]}
                    </td>
                    <td className="px-1.5 py-1 text-[8px] font-extralight tx4">
                      {k.isComputable
                        ? (CONTRACT_KPI_HINT[String(k.code)] ?? "")
                        : "داده‌ای برای این سنجه نیست"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(alerts.skipped ?? []).length > 0 && (
          <div className="mt-2 rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
            <div className="text-[8.5px] font-extralight tx3">قواعد سنجیده‌نشده — سکوت به‌معنای سلامت نیست</div>
            {(alerts.skipped ?? []).map((s: Json) => (
              <div key={s.code} className="mt-0.5 text-[8.5px] tx4">
                <span className="font-mono" dir="ltr">{s.code}</span> — {s.titleFa}: {s.reasonFa}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* سهم سنجه‌ها در نمره: نمره‌ای که نمی‌گوید از کجا آمده، جعبهٔ
          سیاه است و کسی بهش اعتماد نمی‌کند. */}
      {(health.contributions ?? []).length > 0 && (
        <Panel title="سهم سنجه‌ها در نمره" note="از ضعیف‌ترین به قوی‌ترین">
          <div className="space-y-1.5">
            {(health.contributions ?? []).map((c: Json) => (
              <div key={c.code} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-[9px] tx2">{c.titleFa}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
                  <div
                    className={`h-full rounded-full ${
                      c.normalized >= 75 ? "bg-emerald-400/60"
                        : c.normalized >= 50 ? "bg-amber-400/60" : "bg-rose-400/60"
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, c.normalized))}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-left text-[9px] tabular-nums tx1" dir="ltr">
                  {fmt(c.normalized)}
                </span>
                <span className="w-10 shrink-0 text-left text-[8px] tabular-nums tx4" dir="ltr">
                  ×{fmt(c.weight)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title="ثبت عکس دوره‌ای"
        note={`${fmt((trend.periods ?? []).length)} دوره ثبت شده — بدون عکس، روند وجود ندارد`}
      >
        <EntryForm
          titleFa="عکس سنجه‌ها"
          noteFa="ثبت دوبارهٔ همان دوره، به‌روزرسانی است نه سطر تازه"
          fields={[
            { name: "periodCode", fa: "کد دوره", kind: "text", required: true, hintFa: "مثلاً 1405-06" },
          ]}
          submitFa="ثبت عکس"
          onSubmit={async (v) => {
            const q = `?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`;
            return act(`/api/cnt/kpi/snapshot${q}`, { periodCode: v.periodCode },
              "عکس دوره‌ای ثبت شد", "CNT_KPI_SNAPSHOT");
          }}
        />
        {(trend.periods ?? []).length > 0 && (
          <div className="mt-1.5 text-[8px] font-extralight tx4" dir="ltr">
            {(trend.periods ?? []).join(" · ")}
          </div>
        )}
      </Panel>

      <Panel title="قواعد هشدار" note={`${fmt(rules?.customizedCount ?? 0)} قاعده سفارشی · ${fmt(rules?.disabledCount ?? 0)} خاموش`}>
        <button
          onClick={() => setShowRules(!showRules)}
          className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx2 transition hover:border-sky-400/50"
        >
          {showRules ? "بستن" : "نمایش قواعد و آستانه‌ها"}
        </button>

        {showRules && (
          <>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="tx3">
                    <th className="px-1.5 py-1 text-right font-extralight">کد</th>
                    <th className="px-1.5 py-1 text-right font-extralight">عنوان</th>
                    <th className="px-1.5 py-1 text-left font-extralight">آستانه</th>
                    <th className="px-1.5 py-1 text-right font-extralight">شدت</th>
                    <th className="px-1.5 py-1 text-right font-extralight">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {(rules?.items ?? []).map((r: Json) => (
                    <tr key={r.code} className="border-t b-line-soft">
                      <td className="px-1.5 py-1 font-mono text-[8px] tx3" dir="ltr">{r.code}</td>
                      <td className="px-1.5 py-1 tx1">{r.titleFa}</td>
                      <td className="px-1.5 py-1 text-left tabular-nums tx2" dir="ltr">
                        {r.op === "gt" ? ">" : "<"} {fmt(r.effectiveThreshold)}
                        {r.isCustomized && <span className="tx4"> (سفارشی)</span>}
                      </td>
                      <td className={`px-1.5 py-1 text-[8.5px] ${SEVERITY_TONE[String(r.effectiveSeverity)] ?? "tx2"}`}>
                        {r.severityFa}
                      </td>
                      <td className={`px-1.5 py-1 text-[8.5px] ${r.isEnabled ? "tx3" : "text-rose-300"}`}>
                        {r.isEnabled ? "فعال" : "خاموش"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-2">
              <EntryForm
                titleFa="تنظیم آستانه"
                noteFa="خاموش کردن قاعده یعنی این ریسک دیگر پایش نمی‌شود"
                fields={[
                  {
                    name: "ruleCode", fa: "قاعده", kind: "select", required: true,
                    options: (rules?.items ?? []).map((r: Json) => ({
                      value: String(r.code), fa: `${r.code} — ${r.titleFa}`,
                    })),
                  },
                  { name: "thresholdValue", fa: "آستانهٔ تازه", kind: "number" },
                  {
                    name: "severity", fa: "شدت", kind: "select",
                    options: [
                      { value: "info", fa: "اطلاعی" },
                      { value: "warning", fa: "هشدار" },
                      { value: "critical", fa: "بحرانی" },
                    ],
                  },
                  {
                    name: "isEnabled", fa: "فعال باشد", kind: "select",
                    options: [{ value: "yes", fa: "بله" }, { value: "no", fa: "خیر — خاموش" }],
                  },
                ]}
                submitFa="اعمال"
                onSubmit={async (v) => act(
                  `/api/cnt/alert-rule?projectId=${PROJECT_ID}`,
                  {
                    ruleCode: v.ruleCode,
                    thresholdValue: v.thresholdValue === "" ? undefined : Number(v.thresholdValue),
                    severity: v.severity || undefined,
                    isEnabled: v.isEnabled === "no" ? false : undefined,
                  },
                  "قاعدهٔ هشدار به‌روزرسانی شد",
                  "CNT_ALERT_RULE_SET",
                )}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

/** توضیح کوتاه هر سنجه، برای ستون آخر جدول. */
const CONTRACT_KPI_HINT: Record<string, string> = {
  physical_pct: "کارِ تأییدشده نسبت به کل",
  financial_pct: "پولِ تأییدشده نسبت به مبلغ پیمان",
  progress_gap_pct: "مثبت یعنی پول جلوتر از کار",
  ceiling_used_pct: "شامل ۲۵٪ ماده ۲۹",
  advance_recovered_pct: "سهم بازگشتهٔ پیش‌پرداخت",
  extra_work_ratio_pct: "سهم ردیف ستاره‌دار و تغییر مقادیر",
  avg_ipc_cycle_days: "با احتساب صورت‌وضعیت‌های باز",
  open_guarantee_count: "وثیقهٔ در جریان",
  expiring_guarantee_count: "کمتر از ۳۰ روز تا سررسید",
  retainage_balance: "سپردهٔ کسرشده و آزادنشده",
};

function ProgressSection({
  contractId, userId, onDone,
}: { contractId: string; userId: string; onDone: () => void }) {
  const [snap, setSnap] = useState<Json | null>(null);
  const [curve, setCurve] = useState<Json | null>(null);
  const [milestones, setMilestones] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [showLines, setShowLines] = useState(false);
  const [breakdown, setBreakdown] = useState<Json | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const load = useCallback(async () => {
    if (!contractId) { setSnap(null); return; }
    const q = `?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`;
    /* سه فراخوان موازی: هیچ‌کدام به دیگری وابسته نیست و سریال کردن
       فقط انتظار کاربر را سه برابر می‌کند. */
    const [s, c, m] = await Promise.all([
      getGuarded(`/api/cnt/progress${q}`, userId),
      getGuarded(`/api/cnt/progress/scurve${q}`, userId),
      getGuarded(`/api/cnt/milestone${q}`, userId),
    ]);
    setSnap(s.data);
    setCurve(c.data);
    setMilestones(m.data);
    setDenied(s.denied);
    setUnauth(s.unauth);
  }, [contractId, userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setShowLines(false); setBreakdown(null); setMsg(null); }, [contractId]);

  const loadBreakdown = useCallback(async () => {
    const q = `?projectId=${PROJECT_ID}&contractId=${encodeURIComponent(contractId)}`;
    const r = await getGuarded(`/api/cnt/progress/breakdown${q}`, userId);
    setBreakdown(r.data);
    setShowLines(true);
  }, [contractId, userId]);

  const act = useCallback(async (path: string, body: Json, okFa: string, auditAction: string) => {
    const r = await postJson(path, body, userId);
    if (r.ok) {
      logAudit(auditAction, "Contracts", okFa);
      setMsg({ kind: "ok", text: okFa });
      await load();
      onDone();
    } else {
      logAudit(`${auditAction}_DENIED`, "Contracts", r.messageFa);
      setMsg({
        kind: "err",
        text: r.messageFa,
        details: (r as Json).issues?.map((i: Json) => i.messageFa) ?? (r as Json).detailsFa,
      });
    }
    return r;
  }, [load, onDone, userId]);

  if (!contractId) return null;

  if (denied) {
    return (
      <Panel title="پیشرفت پیمان">
        <div className="py-4 text-center">
          <div className="text-[10px] tx2">
            {unauth ? "برای دیدن پیشرفت باید وارد شوید" : "نقش شما اجازهٔ دیدن پیشرفت پیمان را ندارد"}
          </div>
          {!unauth && <div className="mt-1 font-mono text-[8.5px] tx4">cnt.progress.view</div>}
          <div className="mt-1 text-[8.5px] tx3">اعداد پنهان‌اند، نه صفر.</div>
        </div>
      </Panel>
    );
  }

  const gap: Json = snap?.gap ?? {};
  const physical: Json = snap?.physical ?? {};
  const financial: Json = snap?.financial ?? {};
  const msItems: Json[] = milestones?.items ?? [];

  const SOURCE_FA: Record<string, string> = {
    boq: "فهرست‌بها",
    milestone: "نقاط عطف",
    none: "بدون منبع",
  };

  return (
    <div className="space-y-3">
      <Panel
        title="پیشرفت پیمان"
        note={`منبع پیشرفت فیزیکی: ${SOURCE_FA[String(snap?.physicalSource)] ?? "—"}`}
      >
        <div className="space-y-2">
          <ProgressBar label="پیشرفت فیزیکی — کارِ تأییدشده" pct={snap?.physicalPct ?? 0} tone="tx1" />
          <ProgressBar label="پیشرفت مالی — پولِ تأییدشده" pct={snap?.financialPct ?? 0} tone="tx1" />
        </div>

        <div className={`mt-2 rounded-xl border px-2.5 py-2 ${
          gap.verdict === "overpaid" ? "border-rose-400/30 bg-rose-400/5"
            : gap.verdict === "underpaid" ? "border-amber-400/30 bg-amber-400/5"
              : "b-line-soft bg-black/15"
        }`}>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={`text-[10px] font-semibold ${GAP_TONE[String(gap.verdict)] ?? "tx2"}`}>
              {gap.verdictFa}
            </span>
            <span className="text-[9px] tabular-nums tx3" dir="ltr">{fmt(gap.gapPct)}٪</span>
          </div>
          <div className="mt-0.5 text-[8.5px] font-extralight tx3">{gap.messageFa}</div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="مبلغ پیمان" value={fmtB(financial.contractAmount ?? 0)} hint="میلیارد ریال" />
        <Metric label="کارکرد تأییدشده" value={fmtB(financial.approvedGross ?? 0)} hint="میلیارد ریال" />
        <Metric
          label="در جریان بررسی"
          value={fmtB(financial.pendingGross ?? 0)}
          hint={`${fmt(financial.pendingCount ?? 0)} صورت‌وضعیت`}
          tone={(financial.pendingCount ?? 0) > 0 ? "text-amber-300" : "tx1"}
        />
        <Metric
          label="مصرف سقف"
          value={`${fmt(financial.ceilingUsedPct ?? 0)}٪`}
          tone={(financial.ceilingUsedPct ?? 0) > 90 ? "text-rose-300" : "tx1"}
        />
      </div>

      {(snap?.warningsFa ?? []).length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-2.5 py-2">
          {(snap?.warningsFa ?? []).map((w: string, i: number) => (
            <div key={i} className="text-[9px] text-amber-200">• {w}</div>
          ))}
        </div>
      )}

      {msg && (
        <div className={`rounded-xl border px-2.5 py-2 ${
          msg.kind === "ok" ? "border-emerald-400/30 bg-emerald-400/5" : "border-rose-400/30 bg-rose-400/5"
        }`}>
          <div className={`text-[9.5px] ${msg.kind === "ok" ? "text-emerald-200" : "text-rose-200"}`}>{msg.text}</div>
          {(msg.details ?? []).map((d, i) => (
            <div key={i} className="mt-0.5 text-[8.5px] tx3">• {d}</div>
          ))}
        </div>
      )}

      <Panel
        title="منحنی S"
        note={curve?.dataThroughPeriod ? `داده تا دورهٔ ${curve.dataThroughPeriod}` : "بدون دادهٔ واقعی"}
      >
        <SCurveChart points={curve?.points ?? []} />
        {(curve?.warningsFa ?? []).map((w: string, i: number) => (
          <div key={i} className="mt-1 text-[8.5px] text-amber-200">• {w}</div>
        ))}
      </Panel>

      <Panel title="تفکیک فصلی" note="سهم هر فصل از مبلغ پیمان و درصد پیشرفتش">
        {(physical.byChapter ?? []).length === 0 ? (
          <div className="py-3 text-center text-[9px] tx3">فهرست‌بهای مبلغ‌داری ثبت نشده است.</div>
        ) : (
          <div className="space-y-1.5">
            {(physical.byChapter ?? []).map((ch: Json) => (
              <div key={ch.chapterCode} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-[9px] tabular-nums tx2">{ch.chapterCode}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-full rounded-full bg-sky-400/50"
                    style={{ width: `${Math.min(100, ch.progressPct ?? 0)}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-left text-[9px] tabular-nums tx1" dir="ltr">
                  {fmt(ch.progressPct)}٪
                </span>
                <span className="w-14 shrink-0 text-left text-[8px] tabular-nums tx4" dir="ltr">
                  وزن {fmt(ch.weightPct)}٪
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2">
          <button
            onClick={() => (showLines ? setShowLines(false) : void loadBreakdown())}
            className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx2 transition hover:border-sky-400/50"
          >
            {showLines ? "بستن ردیف‌ها" : "نمایش ردیف‌به‌ردیف"}
          </button>
        </div>

        {showLines && breakdown && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr className="tx3">
                  <th className="px-1.5 py-1 text-right font-extralight">ردیف</th>
                  <th className="px-1.5 py-1 text-right font-extralight">شرح</th>
                  <th className="px-1.5 py-1 text-left font-extralight">وزن</th>
                  <th className="px-1.5 py-1 text-left font-extralight">پیشرفت</th>
                  <th className="px-1.5 py-1 text-left font-extralight">سهم</th>
                </tr>
              </thead>
              <tbody>
                {(breakdown.lines ?? []).slice(0, 40).map((l: Json) => (
                  <tr key={l.boqItemId} className="border-t b-line-soft">
                    <td className="px-1.5 py-1 tabular-nums tx2">{l.itemNo ?? "—"}</td>
                    <td className="px-1.5 py-1 tx1">{l.titleFa ?? "—"}</td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx3" dir="ltr">{fmt(l.weightPct)}٪</td>
                    <td className={`px-1.5 py-1 text-left tabular-nums ${l.isOverrun ? "text-rose-300" : "tx1"}`} dir="ltr">
                      {fmt(l.itemPct)}٪
                    </td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx2" dir="ltr">{fmt(l.contributionPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(breakdown.lines ?? []).length > 40 && (
              <div className="mt-1 text-[8px] tx4">
                ۴۰ ردیف پروزن‌تر نمایش داده شد از {fmt((breakdown.lines ?? []).length)} ردیف.
              </div>
            )}
          </div>
        )}
      </Panel>

      {msItems.length > 0 && (
        <Panel
          title="نقاط عطف"
          note={`جمع وزن ${fmt(milestones?.totalWeightPct ?? 0)}٪ · پیشرفت ${fmt(milestones?.progressPct ?? 0)}٪`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr className="tx3">
                  <th className="px-1.5 py-1 text-right font-extralight">#</th>
                  <th className="px-1.5 py-1 text-right font-extralight">عنوان</th>
                  <th className="px-1.5 py-1 text-left font-extralight">وزن</th>
                  <th className="px-1.5 py-1 text-right font-extralight">وضعیت</th>
                  <th className="px-1.5 py-1 text-right font-extralight">سند</th>
                  <th className="px-1.5 py-1 text-left font-extralight">تأخیر</th>
                  <th className="px-1.5 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {msItems.map((m) => (
                  <tr key={m.Id} className="border-t b-line-soft">
                    <td className="px-1.5 py-1 tabular-nums tx2">{fmt(m.MilestoneNo)}</td>
                    <td className="px-1.5 py-1 tx1">{m.TitleFa}</td>
                    <td className="px-1.5 py-1 text-left tabular-nums tx2" dir="ltr">{fmt(m.WeightPct)}٪</td>
                    <td className="px-1.5 py-1 text-[8.5px] tx2">{m.statusFa}</td>
                    <td className={`px-1.5 py-1 text-[8.5px] ${m.needsEvidence ? "text-amber-300" : "tx3"}`}>
                      {m.EvidenceDocNo ?? (m.needsEvidence ? "بی‌سند — نیم‌شمرده" : "—")}
                    </td>
                    <td className={`px-1.5 py-1 text-left tabular-nums text-[8.5px] ${m.isLate ? "text-rose-300" : "tx4"}`} dir="ltr">
                      {m.isLate ? `${fmt(m.lateDays)} روز` : "—"}
                    </td>
                    <td className="px-1.5 py-1 text-left">
                      {m.effectivePct < 100 && (
                        <button
                          onClick={() => void act(
                            `/api/cnt/milestone/${encodeURIComponent(String(m.Id))}/achieve?projectId=${PROJECT_ID}`,
                            { status: "achieved" },
                            `نقطهٔ عطف ${m.MilestoneNo} محقق ثبت شد`,
                            "CNT_MILESTONE_ACHIEVE",
                          )}
                          className="rounded-lg border b-line-soft px-1.5 py-0.5 text-[8.5px] tx2 transition hover:border-sky-400/50"
                        >
                          ثبت تحقق
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(milestones?.warningsFa ?? []).map((w: string, i: number) => (
            <div key={i} className="mt-1 text-[8.5px] text-amber-200">• {w}</div>
          ))}

          <div className="mt-2">
            <EntryForm
              titleFa="تأیید نقطهٔ عطف"
              noteFa="تأیید بدون سند پشتیبان ممکن نیست"
              fields={[
                {
                  name: "milestoneId", fa: "نقطهٔ عطف", kind: "select", required: true,
                  options: msItems.map((m) => ({ value: String(m.Id), fa: `${m.MilestoneNo} — ${m.TitleFa}` })),
                },
                { name: "evidenceDocNo", fa: "شمارهٔ سند", kind: "text", required: true },
                { name: "achievedDate", fa: "تاریخ تحقق", kind: "date" },
              ]}
              submitFa="تأیید"
              onSubmit={async (v) => act(
                `/api/cnt/milestone/${encodeURIComponent(v.milestoneId)}/achieve?projectId=${PROJECT_ID}`,
                { status: "verified", evidenceDocNo: v.evidenceDocNo, achievedDate: v.achievedDate || undefined },
                "نقطهٔ عطف تأیید شد",
                "CNT_MILESTONE_VERIFY",
              )}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}

export default function ContractsPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [list, setList] = useState<Json | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<Json | null>(null);
  const [basisFilter, setBasisFilter] = useState<BasisFilter>("all");
  const [loading, setLoading] = useState(true);
  /* حالت ردیف تازه: تعیین می‌کند کدام میدان‌ها اصلاً دیده شوند. */
  const [newItemBasis, setNewItemBasis] = useState<"unit_price" | "lump_sum">("unit_price");

  const reload = useCallback(async () => {
    setLoading(true);
    const d = await getJson(`/api/cnt/contracts?projectId=${PROJECT_ID}`);
    setList(d);
    setLoading(false);
    return d;
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  /* پیمان انتخاب‌شده در نبود انتخاب صریح، اولین پیمان فهرست است. */
  useEffect(() => {
    if (!list) return;
    const rows: Json[] = list.contracts ?? [];
    if (!rows.length) { setSelectedId(""); setDetail(null); return; }
    if (!rows.some((c) => c.id === selectedId)) setSelectedId(rows[0].id);
  }, [list, selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) { setDetail(null); return; }
    setDetail(await getJson(`/api/cnt/contracts/${encodeURIComponent(id)}?projectId=${PROJECT_ID}`));
  }, []);

  useEffect(() => { void loadDetail(selectedId); }, [selectedId, loadDetail]);

  const refreshAll = useCallback(async () => {
    await reload();
    await loadDetail(selectedId);
  }, [reload, loadDetail, selectedId]);

  if (loading && !list) {
    return <Panel title={rtl ? "پیمان و فهرست بها" : "Contracts & BOQ"}><div className="py-6 text-center text-[10px] tx3">در حال بارگذاری…</div></Panel>;
  }

  const contracts: Json[] = list?.contracts ?? [];
  const totals = list?.totals ?? { initialAmount: 0, currentAmount: 0, atCeilingRisk: 0 };
  const items: Json[] = detail?.items ?? [];
  const visibleItems = basisFilter === "all" ? items : items.filter((i) => i.PricingBasis === basisFilter);
  const summary = detail?.summary;
  const lumpSumItems = items.filter((i) => i.PricingBasis === "lump_sum");
  const unitPriceItems = items.filter((i) => i.PricingBasis === "unit_price");

  const noAuth = userId ? undefined : "برای ثبت باید وارد شوید";

  return (
    <div className="space-y-3">
      {/* ── شاخص‌های سبد پیمان ── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Metric label="تعداد پیمان" value={fmt(contracts.length)} />
        <Metric label="مبلغ اولیه (جمع)" value={fmtB(totals.initialAmount)} />
        <Metric label="مبلغ جاری (جمع)" value={fmtB(totals.currentAmount)} hint="با الحاقیه‌های مصوب" />
        <Metric
          label="در معرض سقف ۲۵٪"
          value={fmt(totals.atCeilingRisk)}
          tone={totals.atCeilingRisk > 0 ? "text-amber-200" : "tx1"}
          hint="مبنا: مبلغ اولیه"
        />
        <Metric label="ردیف فهرست بها" value={fmt(items.length)} hint={`${unitPriceItems.length} فهرست‌بهایی · ${lumpSumItems.length} مقطوع`} />
      </div>

      {/* ── فهرست پیمان‌ها ── */}
      <Panel title="سبد پیمان‌ها" note="سقف مجاز بر مبنای مبلغ اولیه سنجیده می‌شود، نه مبلغ جاری">
        {contracts.length === 0 ? (
          <div className="py-4 text-center text-[9.5px] tx3">هنوز پیمانی ثبت نشده است</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[9.5px]">
              <thead className="tx3">
                <tr className="border-b b-line-soft">
                  <th className="px-2 py-1 text-start">شماره</th>
                  <th className="px-2 py-1 text-start">موضوع</th>
                  <th className="px-2 py-1 text-start">نوع</th>
                  <th className="px-2 py-1 text-start">مبلغ اولیه</th>
                  <th className="px-2 py-1 text-start">جمع فهرست بها</th>
                  <th className="px-2 py-1 text-start">ردیف</th>
                  <th className="px-2 py-1 text-start">سقف</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`cursor-pointer border-b b-line-soft/50 transition ${c.id === selectedId ? "bg-sky-400/10" : "hover:bg-white/5"}`}
                  >
                    <td className="px-2 py-1 font-mono tx2" dir="ltr">{c.code}</td>
                    <td className="px-2 py-1 tx1">
                      {c.titleFa}
                      {c.boqVarianceFa && <span className="ms-1 text-[8px] text-amber-200">⚠ اختلاف با فهرست بها</span>}
                    </td>
                    <td className="px-2 py-1 tx3">{c.contractTypeFa}</td>
                    <td className="px-2 py-1 tabular-nums tx2">{fmtB(c.initialAmount)}</td>
                    <td className="px-2 py-1 tabular-nums tx2">{fmtB(c.boqTotal)}</td>
                    <td className="px-2 py-1 tabular-nums tx3">{fmt(c.itemCount)}</td>
                    <td className="px-2 py-1">
                      <span className={`rounded-lg px-2 py-0.5 text-[8.5px] ${CEILING_TONE[c.ceilingStatus] ?? "tx3"}`}>
                        {CEILING_FA[c.ceilingStatus] ?? c.ceilingStatus} · {c.ceilingUsedPct}٪
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── شناسنامهٔ پیمان انتخاب‌شده ── */}
      {detail && summary && (
        <>
          <Panel
            title={`شناسنامهٔ پیمان ${detail.contract.Code}`}
            note={`${detail.contract.contractTypeFa} · ${detail.contract.ContractorName ?? "—"}`}
          >
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Metric label="مبلغ اولیه" value={fmtB(summary.initialAmount)} />
              <Metric label="مبلغ جاری" value={fmtB(summary.currentAmount)} hint={`الحاقیهٔ مصوب ${fmtB(summary.amendmentDelta ?? 0)}`} />
              <Metric label="جمع فهرست بها" value={fmtB(summary.boqTotal)} tone={summary.boqVarianceFa ? "text-amber-200" : "tx1"} />
              <Metric
                label="مصرف سقف"
                value={`${summary.ceiling.usedPct}٪`}
                tone={summary.ceiling.status === "ok" ? "tx1" : summary.ceiling.status === "warning" ? "text-amber-200" : "text-rose-300"}
                hint={`سقف ${fmtB(summary.ceiling.ceilingAmount)}`}
              />
              <Metric
                label="پوشش نگاشت WBS"
                value={`${detail.mapping.wbsCoveragePct}٪`}
                hint={`CBS ${detail.mapping.cbsCoveragePct}٪`}
                tone={detail.mapping.wbsCoveragePct < 100 ? "text-amber-200" : "tx1"}
              />
            </div>
            {summary.boqVarianceFa && (
              <div className="mt-2 rounded-lg bg-amber-400/10 px-2 py-1 text-[9px] text-amber-200">{summary.boqVarianceFa}</div>
            )}
            {detail.mapping.noteFa && (
              <div className="mt-1 text-[8.5px] tx4">{detail.mapping.noteFa}</div>
            )}
          </Panel>

          {/* ── فهرست بها با تفکیک دو حالت ── */}
          <Panel
            title="فهرست بها"
            note="ردیف فهرست‌بهایی با مقدار و نرخ · ردیف مقطوع با مبلغ و مراحل"
          >
            <div className="mb-2 flex flex-wrap gap-1">
              {([
                { id: "all", fa: `همه (${items.length})` },
                { id: "unit_price", fa: `فهرست‌بهایی (${unitPriceItems.length})` },
                { id: "lump_sum", fa: `مقطوع (${lumpSumItems.length})` },
              ] as { id: BasisFilter; fa: string }[]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setBasisFilter(f.id)}
                  className={`rounded-lg px-2 py-1 text-[9px] transition ${basisFilter === f.id ? "toggle-on tx1" : "border b-line-soft tx3 hover:tx2"}`}
                >
                  {f.fa}
                </button>
              ))}
            </div>
            {visibleItems.length === 0 ? (
              <div className="py-4 text-center text-[9.5px] tx3">ردیفی برای نمایش نیست</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[9.5px]">
                  <thead className="tx3">
                    <tr className="border-b b-line-soft">
                      <th className="px-2 py-1 text-start">ردیف</th>
                      <th className="px-2 py-1 text-start">شرح</th>
                      <th className="px-2 py-1 text-start">مبنا</th>
                      <th className="px-2 py-1 text-start">واحد</th>
                      <th className="px-2 py-1 text-start">مقدار</th>
                      <th className="px-2 py-1 text-start">نرخ / مبلغ مقطوع</th>
                      <th className="px-2 py-1 text-start">مبلغ ردیف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((it) => (
                      <tr key={it.Id} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{it.ItemNo}</td>
                        <td className="px-2 py-1 tx1">
                          {it.TitleFa}
                          {it.RateStatus === "rate_pending" && (
                            <span className="ms-1 rounded bg-amber-400/15 px-1 text-[8px] text-amber-200">نرخ تصویب‌نشده</span>
                          )}
                        </td>
                        <td className="px-2 py-1 tx3">{it.pricingBasisFa}</td>
                        <td className="px-2 py-1 tx3">{it.Unit ?? "—"}</td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{it.ContractQty != null ? fmt(it.ContractQty) : "—"}</td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">
                          {it.PricingBasis === "lump_sum" ? fmt(it.LumpSumAmount) : it.UnitRate != null ? fmt(it.UnitRate) : "—"}
                        </td>
                        <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{fmt(it.computedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* ── مراحل ردیف‌های مقطوع ── */}
          {detail.milestones?.length > 0 && (
            <Panel title="مراحل ردیف‌های مقطوع" note="فقط مرحلهٔ تأییدشده پیشرفت مالی می‌سازد">
              <div className="overflow-x-auto">
                <table className="w-full text-[9.5px]">
                  <thead className="tx3">
                    <tr className="border-b b-line-soft">
                      <th className="px-2 py-1 text-start">ردیف</th>
                      <th className="px-2 py-1 text-start">شرح</th>
                      <th className="px-2 py-1 text-start">مبلغ مقطوع</th>
                      <th className="px-2 py-1 text-start">مراحل</th>
                      <th className="px-2 py-1 text-start">تحقق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.milestones.map((m: Json) => (
                      <tr key={m.boqItemId} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{m.itemNo}</td>
                        <td className="px-2 py-1 tx1">
                          {m.titleFa}
                          {m.weightIssueFa && <span className="ms-1 text-[8px] text-amber-200">⚠ {m.weightIssueFa}</span>}
                        </td>
                        <td className="px-2 py-1 tabular-nums tx2" dir="ltr">{fmt(m.lumpSumAmount)}</td>
                        <td className="px-2 py-1 tx3">{m.verifiedCount} تأییدشده · {m.claimedCount} ادعاشده</td>
                        <td className="px-2 py-1 tabular-nums tx1" dir="ltr">{m.cumPct}٪</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

      {/* ── فرم ۱: ثبت پیمان ── */}
      <EntryForm
        titleFa="ثبت شناسنامهٔ پیمان"
        noteFa="سقف مجاز و درصد حسن انجام کار در نبود مقدار، پیش‌فرض آیین‌نامه‌ای می‌گیرند"
        submitFa="ثبت پیمان"
        disabledFa={noAuth}
        fields={[
          { name: "code", fa: "شمارهٔ پیمان", kind: "text", required: true },
          { name: "titleFa", fa: "موضوع پیمان", kind: "text", required: true },
          {
            name: "contractType", fa: "نوع پیمان", kind: "select", required: true,
            options: [
              { value: "unit_price", fa: "فهرست بهایی" },
              { value: "lump_sum", fa: "مقطوع" },
              { value: "mixed", fa: "ترکیبی" },
              { value: "cost_plus", fa: "هزینه به‌علاوهٔ حق‌الزحمه" },
              { value: "epc", fa: "EPC" },
            ],
          },
          { name: "party", fa: "طرف پیمان", kind: "select", options: [{ value: "main", fa: "پیمانکار اصلی" }, { value: "subcontract", fa: "پیمانکار جزء" }] },
          { name: "employerName", fa: "نام کارفرما", kind: "text", required: true },
          { name: "contractorName", fa: "نام پیمانکار", kind: "text", required: true },
          { name: "consultantName", fa: "نام مشاور", kind: "text" },
          { name: "initialAmount", fa: "مبلغ اولیه (ریال)", kind: "number", required: true },
          { name: "signDate", fa: "تاریخ انعقاد", kind: "date", required: true },
          { name: "startDate", fa: "تاریخ شروع", kind: "date", required: true },
          { name: "durationDays", fa: "مدت (روز)", kind: "number", required: true },
          { name: "ceilingPct", fa: "سقف مجاز ٪", kind: "number", hintFa: "پیش‌فرض ۲۵" },
          { name: "retainagePct", fa: "حسن انجام کار ٪", kind: "number", hintFa: "پیش‌فرض ۱۰" },
          { name: "advancePct", fa: "پیش‌پرداخت ٪", kind: "number" },
        ]}
        onSubmit={async (v) => {
          const r = await postJson(`/api/cnt/contracts?projectId=${PROJECT_ID}`, {
            code: v.code,
            titleFa: v.titleFa,
            contractType: v.contractType,
            party: v.party || undefined,
            employerName: v.employerName,
            contractorName: v.contractorName,
            consultantName: v.consultantName || undefined,
            initialAmount: v.initialAmount ? Number(v.initialAmount) : undefined,
            signDate: v.signDate || undefined,
            startDate: v.startDate || undefined,
            durationDays: v.durationDays ? Number(v.durationDays) : undefined,
            ceilingPct: v.ceilingPct ? Number(v.ceilingPct) : undefined,
            retainagePct: v.retainagePct ? Number(v.retainagePct) : undefined,
            advancePct: v.advancePct ? Number(v.advancePct) : undefined,
          }, userId);
          if (r.ok) {
            logAudit("CNT_CONTRACT_SAVE", "Contracts", `${v.code} · ${v.titleFa}`);
            await refreshAll();
            return { ...r, successFa: `پیمان ${v.code} ثبت شد` };
          }
          return r;
        }}
      />

      {/* ── فرم ۲: ثبت ردیف فهرست بها (دوحالته) ── */}
      <Panel title="ثبت ردیف فهرست بها" note="ابتدا مبنای ارزش‌گذاری را انتخاب کنید؛ میدان‌های بی‌ربط نمایش داده نمی‌شوند">
        <div className="mb-2 flex flex-wrap gap-1">
          {([
            { id: "unit_price", fa: "ردیف فهرست‌بهایی (مقدار × نرخ)" },
            { id: "lump_sum", fa: "ردیف مقطوع (مبلغ و مراحل)" },
          ] as { id: "unit_price" | "lump_sum"; fa: string }[]).map((b) => (
            <button
              key={b.id}
              onClick={() => setNewItemBasis(b.id)}
              className={`rounded-lg px-2 py-1 text-[9px] transition ${newItemBasis === b.id ? "toggle-on tx1" : "border b-line-soft tx3 hover:tx2"}`}
            >
              {b.fa}
            </button>
          ))}
        </div>
        <EntryForm
          titleFa=""
          submitFa={newItemBasis === "unit_price" ? "ثبت ردیف فهرست‌بهایی" : "ثبت ردیف مقطوع"}
          disabledFa={noAuth ?? (selectedId ? undefined : "ابتدا یک پیمان انتخاب کنید")}
          fields={[
            { name: "itemNo", fa: "شمارهٔ ردیف", kind: "text", required: true },
            { name: "titleFa", fa: "شرح ردیف", kind: "text", required: true },
            { name: "chapterCode", fa: "کد فصل", kind: "text" },
            ...(newItemBasis === "unit_price"
              ? ([
                  { name: "unit", fa: "واحد سنجش", kind: "text", required: true },
                  { name: "contractQty", fa: "مقدار پیمان", kind: "number", required: true },
                  { name: "unitRate", fa: "نرخ واحد (ریال)", kind: "number", required: true },
                ] as FieldSpec[])
              : ([
                  { name: "lumpSumAmount", fa: "مبلغ مقطوع (ریال)", kind: "number", required: true, hintFa: "پیشرفت از مراحل تأییدشده می‌آید" },
                ] as FieldSpec[])),
            { name: "wbsId", fa: "شناسهٔ WBS", kind: "text", hintFa: "بدون آن ردیف در پیشرفت دیده نمی‌شود" },
            { name: "costAccountCode", fa: "کد حساب هزینه", kind: "text" },
          ]}
          onSubmit={async (v) => {
            const r = await postJson(`/api/cnt/boq?projectId=${PROJECT_ID}`, {
              contractId: selectedId,
              itemNo: v.itemNo,
              titleFa: v.titleFa,
              chapterCode: v.chapterCode || undefined,
              pricingBasis: newItemBasis,
              unit: newItemBasis === "unit_price" ? v.unit : undefined,
              contractQty: newItemBasis === "unit_price" && v.contractQty ? Number(v.contractQty) : undefined,
              unitRate: newItemBasis === "unit_price" && v.unitRate ? Number(v.unitRate) : undefined,
              lumpSumAmount: newItemBasis === "lump_sum" && v.lumpSumAmount ? Number(v.lumpSumAmount) : undefined,
              wbsId: v.wbsId || undefined,
              costAccountCode: v.costAccountCode || undefined,
            }, userId);
            if (r.ok) {
              logAudit("CNT_BOQ_SAVE", "Contracts", `${v.itemNo} · ${newItemBasis}`);
              await refreshAll();
              const warn = (r.data as Json).varianceFa;
              return { ...r, successFa: warn ? `ردیف ثبت شد — ${warn}` : `ردیف ${v.itemNo} ثبت شد` };
            }
            return r;
          }}
        />
      </Panel>

      {/* ── فرم ۳: ریزمتره ── */}
      <EntryForm
        titleFa="ثبت برگهٔ ریزمتره"
        noteFa="فقط برای ردیف فهرست‌بهایی · ابعاد نانوشته حذف می‌شوند نه صفر · با ارجاع به فعالیت، دروازهٔ کیفی اجرا می‌شود"
        submitFa="ثبت ریزمتره"
        disabledFa={noAuth}
        fields={[
          {
            name: "boqItemId", fa: "ردیف فهرست بها", kind: "select", required: true,
            options: unitPriceItems.map((i) => ({ value: i.Id, fa: `${i.ItemNo} — ${i.TitleFa}` })),
          },
          { name: "sheetNo", fa: "شمارهٔ برگه", kind: "number", required: true },
          { name: "locationFa", fa: "موقعیت", kind: "text" },
          { name: "drawingNo", fa: "شمارهٔ نقشه", kind: "text" },
          { name: "count", fa: "تعداد", kind: "number" },
          { name: "length", fa: "طول", kind: "number" },
          { name: "width", fa: "عرض", kind: "number" },
          { name: "height", fa: "ارتفاع", kind: "number" },
          { name: "factor", fa: "ضریب", kind: "number" },
          { name: "activityId", fa: "شناسهٔ فعالیت", kind: "text", hintFa: "برای اجرای دروازهٔ کیفی" },
          { name: "inspectionRecordCode", fa: "کد تأییدیهٔ بازرسی", kind: "text" },
        ]}
        onSubmit={async (v) => {
          const r = await postJson(`/api/cnt/measurement?projectId=${PROJECT_ID}`, {
            boqItemId: v.boqItemId,
            sheetNo: v.sheetNo ? Number(v.sheetNo) : undefined,
            locationFa: v.locationFa || undefined,
            drawingNo: v.drawingNo || undefined,
            count: v.count ? Number(v.count) : undefined,
            length: v.length ? Number(v.length) : undefined,
            width: v.width ? Number(v.width) : undefined,
            height: v.height ? Number(v.height) : undefined,
            factor: v.factor ? Number(v.factor) : undefined,
            activityId: v.activityId || undefined,
            inspectionRecordCode: v.inspectionRecordCode || undefined,
          }, userId);
          if (r.ok) {
            logAudit("CNT_MEASUREMENT_SAVE", "Contracts", `برگه ${v.sheetNo}`);
            await refreshAll();
            const d = r.data as Json;
            const warn = d.overrunFa ? ` — ${d.overrunFa}` : "";
            return { ...r, successFa: `مقدار ${fmt(d.quantity)} ثبت شد · تجمعی ${fmt(d.cumulativeQty)}${warn}` };
          }
          return r;
        }}
      />

      {/* دفتر وثیقه ذیل همان پیمان انتخاب‌شده می‌آید: ضمانت‌نامه بدون
          پیمانش معنا ندارد و صفحهٔ جدا، کاربر را وادار به انتخاب دوباره
          می‌کرد. */}
      {selectedId && (
        <GuaranteeSection
          contractId={selectedId}
          userId={userId}
          onDone={() => { void refreshAll(); }}
        />
      )}

      {/* صورت‌وضعیت جزء هم ذیل همان پیمان: بدون دیدن ضمانت‌نامه و
          پیش‌پرداختِ بالای صفحه، عدد خالص پرداختنی به جزء گمراه‌کننده
          است. */}
      {/* پیشرفت پیش از صورت‌وضعیت جزء می‌آید: تصمیم دربارهٔ پرداخت به
          جزء بدون دانستن پیشرفت کل پیمان، تصمیم در تاریکی است. */}
      {selectedId && (
        <ProgressSection
          contractId={selectedId}
          userId={userId}
          onDone={() => { void refreshAll(); }}
        />
      )}

      {/* پل مالی پیش از تابلوی سلامت: نمرهٔ سلامتی که روی اعدادی بنا
          شده که هنوز به دفتر مالی نرسیده‌اند، نیمی از واقعیت است. */}
      {selectedId && (
        <FinBridgeSection
          contractId={selectedId}
          userId={userId}
          onDone={() => { void refreshAll(); }}
        />
      )}

      {/* تابلوی سلامت آخرین بخش است چون خلاصهٔ همهٔ بالاست: خواندنش
          پیش از دیدن جزئیات، نمره را بی‌معنا می‌کند. */}
      {selectedId && (
        <KpiSection
          contractId={selectedId}
          userId={userId}
          onDone={() => { void refreshAll(); }}
        />
      )}

      {selectedId && (
        <SubIpcSection
          contractId={selectedId}
          userId={userId}
          onDone={() => { void refreshAll(); }}
        />
      )}

      {/* گزارش‌ها در انتها: سندی که بیرون می‌رود باید پس از دیدن همهٔ
          بخش‌های بالا صادر شود، نه پیش از آن. */}
      {selectedId && <ReportsSection contractId={selectedId} userId={userId} />}

      <div className="text-center text-[8px] font-extralight tx4" dir="ltr">
        cnt-v1 · d14 · 14.1 Contract &amp; BOQ · 14.7 Guarantees · 14.8 Subcontractor IPC · 14.9 Progress · 14.10 KPI &amp; EWS · 14.11 Reports · 14.13 FIN Bridge
      </div>
    </div>
  );
}
