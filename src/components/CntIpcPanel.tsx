/**
 * P8 / CNT-1 — قالب‌پذیری صورت‌وضعیت (d14).
 *
 * قالب = ردیف‌ها (اندازه‌گیری/مقطوع/درصدی) + کسورات (نوع × حالت × مبنا).
 * هیچ مبلغی این‌جا محاسبه و قطعی نمی‌شود: پیش‌نمایش و سند هر دو از محاسبهٔ
 * سرور می‌آیند تا سند مصوب همان چیزی باشد که سرور شهادت می‌دهد.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import { CntIpcClient, type IpcPreview } from "../services/cntIpcApi";
import {
  BASIS_LABEL,
  DEDUCTION_BASE_LABEL,
  DEDUCTION_KIND_LABEL,
  IPC_STATUS_LABEL,
  type CntCertificateRow,
  type CntTemplateRow,
  type CntWorkspacePayload,
  type IpcRowInput,
} from "../services/cntIpc";

const STATUS_TONE: Record<string, string> = {
  approved: "text-emerald-300",
  published: "text-emerald-300",
  submitted: "text-sky-300",
  returned: "text-rose-300",
  retired: "text-amber-300",
  draft: "tx3",
};
const statusFa = (s: string, rtl: boolean) => {
  const l = IPC_STATUS_LABEL[s];
  return l ? (rtl ? l.fa : l.en) : s;
};
const inputCls =
  "glass-row w-full rounded-lg border b-line-soft px-2.5 py-1.5 text-[10.5px] font-light tx1 outline-none focus:b-line";
const chipCls = "rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] font-light transition disabled:opacity-40";
const fx = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: digits });
const today = () => new Date().toISOString().slice(0, 10);

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
  return <span className={`rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] font-light ${STATUS_TONE[status] ?? "tx3"}`}>{statusFa(status, rtl)}</span>;
}

export default function CntIpcPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { projectScope } = useSystem();
  const { user } = useAuth();
  const projectId = projectScope?.projectId ?? "";
  const client = useMemo(() => new CntIpcClient(projectId, user?.id ?? null), [projectId, user?.id]);
  const [data, setData] = useState<CntWorkspacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    const r = await client.workspace();
    if (r.ok) { setData(r.data); setError(null); }
    else setError(`${r.message ?? "خواندن میز کار ناموفق بود"} (${r.code ?? "?"})`);
  }, [client, projectId]);
  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (fn: () => Promise<{ ok: boolean; message?: string; code?: string }>) => {
    setBusy(true);
    const r = await fn();
    if (!r.ok) setError(`${r.message ?? "اقدام ناموفق بود"} (${r.code ?? "?"})`);
    else setError(null);
    await load();
    setBusy(false);
  }, [load]);

  if (!projectId) return <div className="p-4 text-[10.5px] font-light tx3">{rtl ? "پروژه‌ای انتخاب نشده است." : "No project selected."}</div>;

  const metrics = data?.metrics;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-light tx2">
          {rtl ? "قالب صورت‌وضعیت و سند دوره — محاسبهٔ سرور" : "IPC template & period certificate — server computation"}
        </span>
        <button onClick={() => void load()} className="ms-auto rounded-lg px-2.5 py-1 text-[9.5px] font-light tx3 transition hover:tx1">
          ↻ {rtl ? "بازخوانی" : "Refresh"}
        </button>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { fa: "قالب منتشرشده", en: "Published templates", v: `${metrics.templates.published}` },
            { fa: "قالب", en: "Templates", v: `${metrics.templates.total}` },
            { fa: "آخرین دوره", en: "Latest period", v: `${metrics.certificates.latestPeriod ?? "—"}` },
            { fa: "مصوب", en: "Approved", v: `${metrics.certificates.approved}` },
            { fa: "خالص مصوب", en: "Approved net", v: metrics.certificates.approvedNet === null ? "—" : `${fx(metrics.certificates.approvedNet)} ${metrics.certificates.currency ?? ""}` },
          ].map((k) => (
            <div key={k.en} className="glass-row rounded-xl px-2.5 py-1.5">
              <div className="text-[8.5px] font-extralight tx3">{rtl ? k.fa : k.en}</div>
              <div className="text-[13px] font-normal tabular-nums tx1" dir="ltr">{k.v}</div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[10px] font-light text-rose-200">{error}</div>}

      <div className="thin-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto pe-1">
        {!data && <div className="p-3 text-[10.5px] font-light tx3">{rtl ? "در حال خواندن…" : "Loading…"}</div>}
        {data && <TemplatesTab lang={lang} data={data} busy={busy} run={run} client={client} />}
        {data && <CertificatesTab lang={lang} data={data} busy={busy} run={run} client={client} />}
      </div>
    </div>
  );
}

type Run = (fn: () => Promise<{ ok: boolean; message?: string; code?: string }>) => Promise<void>;

/* ═══════════════════ قالب‌ها ═══════════════════ */

type ItemDraft = { Code: string; TitleFa: string; Unit: string; Basis: string; PercentOf: string; Sign: string };
type DedDraft = { Code: string; TitleFa: string; Kind: string; Mode: string; Rate: string; Base: string; ItemCode: string };
const emptyItem = (): ItemDraft => ({ Code: "", TitleFa: "", Unit: "", Basis: "measured", PercentOf: "", Sign: "+" });
const emptyDed = (): DedDraft => ({ Code: "", TitleFa: "", Kind: "retention", Mode: "percent", Rate: "", Base: "gross", ItemCode: "" });

function TemplatesTab({ lang, data, busy, run, client }: { lang: Lang; data: CntWorkspacePayload; busy: boolean; run: Run; client: CntIpcClient }) {
  const rtl = lang === "fa";
  const can = data.can;
  const [head, setHead] = useState({ Code: "", TitleFa: "", ContractCode: "", NoteFa: "" });
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [deds, setDeds] = useState<DedDraft[]>([]);
  const setItem = (i: number, patch: Partial<ItemDraft>) => setItems((x) => x.map((y, j) => (j === i ? { ...y, ...patch } : y)));
  const setDed = (i: number, patch: Partial<DedDraft>) => setDeds((x) => x.map((y, j) => (j === i ? { ...y, ...patch } : y)));
  const itemCodes = items.map((i) => i.Code.trim()).filter(Boolean);
  const canCreate = can.templateEdit && head.Code.trim() && head.TitleFa.trim() && items.every((i) => i.Code.trim() && i.TitleFa.trim());

  const create = () =>
    client.createTemplate({
      Code: head.Code.trim(), TitleFa: head.TitleFa.trim(),
      ContractCode: head.ContractCode.trim() || null, NoteFa: head.NoteFa.trim() || null,
      Items: items.map((i) => ({
        Code: i.Code.trim(), TitleFa: i.TitleFa.trim(), Unit: i.Unit.trim() || "—", Basis: i.Basis,
        PercentOf: i.Basis === "percent" ? i.PercentOf : null, Sign: i.Sign,
      })),
      Deductions: deds.filter((d) => d.Code.trim() && d.TitleFa.trim()).map((d) => ({
        Code: d.Code.trim(), TitleFa: d.TitleFa.trim(), Kind: d.Kind, Mode: d.Mode,
        Rate: d.Rate.trim() ? Number(d.Rate) : 0, Base: d.Base, ItemCode: d.Base === "item" ? d.ItemCode || null : null,
      })),
    });

  return (
    <Section
      lang={lang}
      title={rtl ? "قالب صورت‌وضعیت (CNT-1)" : "IPC template (CNT-1)"}
      hint={rtl ? "ردیف درصدی روی ردیف دیگر بسته می‌شود؛ کسورات به ترتیب اجرا می‌شوند" : "percent rows reference a row; deductions apply in order"}
    >
      {can.templateEdit && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input className={inputCls} placeholder={rtl ? "کد قالب" : "Code"} dir="ltr" value={head.Code} onChange={(ev) => setHead((h) => ({ ...h, Code: ev.target.value }))} />
            <input className={inputCls} placeholder={rtl ? "عنوان قالب" : "Title"} value={head.TitleFa} onChange={(ev) => setHead((h) => ({ ...h, TitleFa: ev.target.value }))} />
            <input className={inputCls} placeholder={rtl ? "کد پیمان (اختیاری)" : "Contract code (optional)"} dir="ltr" value={head.ContractCode} onChange={(ev) => setHead((h) => ({ ...h, ContractCode: ev.target.value }))} />
            <input className={inputCls} placeholder={rtl ? "یادداشت" : "Note"} value={head.NoteFa} onChange={(ev) => setHead((h) => ({ ...h, NoteFa: ev.target.value }))} />
          </div>

          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <input className={`${inputCls} w-24`} placeholder={rtl ? "کد ردیف" : "code"} dir="ltr" value={it.Code} onChange={(ev) => setItem(i, { Code: ev.target.value })} />
                <input className={`${inputCls} w-44`} placeholder={rtl ? "عنوان ردیف" : "title"} value={it.TitleFa} onChange={(ev) => setItem(i, { TitleFa: ev.target.value })} />
                <input className={`${inputCls} w-20`} placeholder={rtl ? "واحد" : "unit"} value={it.Unit} onChange={(ev) => setItem(i, { Unit: ev.target.value })} />
                <select className={`${inputCls} w-44`} value={it.Basis} onChange={(ev) => setItem(i, { Basis: ev.target.value })}>
                  {Object.keys(BASIS_LABEL).map((k) => <option key={k} value={k}>{rtl ? BASIS_LABEL[k].fa : BASIS_LABEL[k].en}</option>)}
                </select>
                {it.Basis === "percent" && (
                  <select className={`${inputCls} w-32`} value={it.PercentOf} onChange={(ev) => setItem(i, { PercentOf: ev.target.value })}>
                    <option value="">{rtl ? "— ردیف مبنا —" : "— base row —"}</option>
                    {itemCodes.filter((c) => c !== it.Code.trim()).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <select className={`${inputCls} w-16`} value={it.Sign} onChange={(ev) => setItem(i, { Sign: ev.target.value })}>
                  <option value="+">+</option>
                  <option value="-">−</option>
                </select>
                <button className={`${chipCls} tx3`} disabled={items.length === 1} onClick={() => setItems((x) => x.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className={`${chipCls} tx3`} onClick={() => setItems((x) => [...x, emptyItem()])}>＋ {rtl ? "ردیف" : "Row"}</button>
          </div>

          <div className="space-y-1.5">
            {deds.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <input className={`${inputCls} w-24`} placeholder={rtl ? "کد کسر" : "code"} dir="ltr" value={d.Code} onChange={(ev) => setDed(i, { Code: ev.target.value })} />
                <input className={`${inputCls} w-40`} placeholder={rtl ? "عنوان کسر" : "title"} value={d.TitleFa} onChange={(ev) => setDed(i, { TitleFa: ev.target.value })} />
                <select className={`${inputCls} w-36`} value={d.Kind} onChange={(ev) => setDed(i, { Kind: ev.target.value })}>
                  {Object.keys(DEDUCTION_KIND_LABEL).map((k) => <option key={k} value={k}>{rtl ? DEDUCTION_KIND_LABEL[k].fa : DEDUCTION_KIND_LABEL[k].en}</option>)}
                </select>
                <select className={`${inputCls} w-28`} value={d.Mode} onChange={(ev) => setDed(i, { Mode: ev.target.value })}>
                  <option value="percent">{rtl ? "درصدی" : "percent"}</option>
                  <option value="fixed">{rtl ? "مبلغ ثابت" : "fixed"}</option>
                </select>
                <input className={`${inputCls} w-24`} placeholder={d.Mode === "percent" ? "٪" : rtl ? "مبلغ" : "amount"} dir="ltr" value={d.Rate} onChange={(ev) => setDed(i, { Rate: ev.target.value })} />
                <select className={`${inputCls} w-36`} value={d.Base} onChange={(ev) => setDed(i, { Base: ev.target.value })}>
                  {Object.keys(DEDUCTION_BASE_LABEL).map((k) => <option key={k} value={k}>{rtl ? DEDUCTION_BASE_LABEL[k].fa : DEDUCTION_BASE_LABEL[k].en}</option>)}
                </select>
                {d.Base === "item" && (
                  <select className={`${inputCls} w-28`} value={d.ItemCode} onChange={(ev) => setDed(i, { ItemCode: ev.target.value })}>
                    <option value="">{rtl ? "— ردیف —" : "— row —"}</option>
                    {itemCodes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <button className={`${chipCls} tx3`} onClick={() => setDeds((x) => x.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className={`${chipCls} tx3`} onClick={() => setDeds((x) => [...x, emptyDed()])}>＋ {rtl ? "کسر" : "Deduction"}</button>
          </div>

          <button disabled={busy || !canCreate} className={`${chipCls} text-sky-300`} onClick={() => void run(create)}>
            ＋ {rtl ? "ثبت قالب پیش‌نویس" : "Save draft template"}
          </button>
        </div>
      )}

      <div className="mt-2 space-y-2">
        {data.templates.length === 0 && <div className="text-[10px] font-light tx3">{rtl ? "قالبی ثبت نشده است." : "No templates."}</div>}
        {data.templates.map((t) => <TemplateRow key={t.Id} lang={lang} row={t} can={data.can} busy={busy} run={run} client={client} />)}
      </div>
    </Section>
  );
}

function TemplateRow({ lang, row, can, busy, run, client }: { lang: Lang; row: CntTemplateRow; can: CntWorkspacePayload["can"]; busy: boolean; run: Run; client: CntIpcClient }) {
  const rtl = lang === "fa";
  return (
    <div className="glass-row rounded-xl p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9.5px] tx3" dir="ltr">{row.Code}</span>
        <span className="text-[11px] font-normal tx1">{row.TitleFa}</span>
        <StatusChip lang={lang} status={row.Status} />
        <span className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[9px] tx2" dir="ltr">v{row.Version}</span>
        {row.ContractCode && <span className="text-[9px] font-extralight tx3" dir="ltr">{row.ContractCode}</span>}
        <div className="ms-auto flex gap-1.5">
          {can.templateEdit && row.Status === "draft" && (
            <button disabled={busy} className={`${chipCls} text-emerald-300`} onClick={() => void run(() => client.templateTransition(row.Code, "publish"))}>
              ↑ {rtl ? "انتشار" : "Publish"}
            </button>
          )}
          {can.templateEdit && row.Status === "published" && (
            <button disabled={busy} className={`${chipCls} text-amber-300`} onClick={() => void run(() => client.templateTransition(row.Code, "retire"))}>
              ↓ {rtl ? "بازنشستگی" : "Retire"}
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {row.Items.map((i) => (
          <span key={i.Code} className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] font-light tx2">
            <span className="font-mono" dir="ltr">{i.Code}</span> · {i.TitleFa} · {rtl ? BASIS_LABEL[i.Basis]?.fa : BASIS_LABEL[i.Basis]?.en}
            {i.PercentOf ? ` (${i.PercentOf})` : ""} {i.Sign}
          </span>
        ))}
        {row.Deductions.map((d) => (
          <span key={d.Code} className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] font-light text-amber-200">
            {d.TitleFa} · {d.Mode === "percent" ? `${d.Rate}٪` : fx(d.Rate)} × {rtl ? DEDUCTION_BASE_LABEL[d.Base]?.fa : DEDUCTION_BASE_LABEL[d.Base]?.en}
            {d.ItemCode ? ` (${d.ItemCode})` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════ صورت‌وضعیت دوره ═══════════════════ */

function CertificatesTab({ lang, data, busy, run, client }: { lang: Lang; data: CntWorkspacePayload; busy: boolean; run: Run; client: CntIpcClient }) {
  const rtl = lang === "fa";
  const can = data.can;
  const published = data.templates.filter((t) => t.Status === "published");
  const [templateCode, setTemplateCode] = useState("");
  useEffect(() => { if (!templateCode && published.length) setTemplateCode(published[0].Code); }, [published, templateCode]);
  const template = published.find((t) => t.Code === templateCode) ?? null;
  const [period, setPeriod] = useState({ No: "", From: today(), To: today(), Currency: "IRR", NoteFa: "" });
  const [rows, setRows] = useState<Record<string, { Quantity: string; UnitRate: string; Amount: string; Percent: string }>>({});
  const [preview, setPreview] = useState<IpcPreview | null>(null);
  const setRow = (code: string, patch: Partial<{ Quantity: string; UnitRate: string; Amount: string; Percent: string }>) =>
    setRows((r) => ({ ...r, [code]: { ...{ Quantity: "", UnitRate: "", Amount: "", Percent: "" }, ...r[code], ...patch } }));

  const inputs: IpcRowInput[] = (template?.Items ?? []).map((i) => {
    const v = rows[i.Code] ?? { Quantity: "", UnitRate: "", Amount: "", Percent: "" };
    const n = (s: string) => (s.trim() === "" ? null : Number(s));
    return { ItemCode: i.Code, Quantity: n(v.Quantity), UnitRate: n(v.UnitRate), Amount: n(v.Amount), Percent: n(v.Percent) };
  }).filter((r) => r.Quantity !== null || r.UnitRate !== null || r.Amount !== null || r.Percent !== null);

  const previewNow = async () => {
    if (!template) return;
    setPreview(null);
    const r = await client.preview(template.Code, inputs);
    if (r.ok) setPreview(r.data);
  };

  const create = () =>
    client.createCertificate({
      TemplateCode: template?.Code, PeriodNo: period.No.trim() ? Number(period.No) : 0,
      PeriodFrom: period.From, PeriodTo: period.To, Currency: period.Currency,
      Inputs: inputs, NoteFa: period.NoteFa.trim() || null,
    });

  const canCreate = can.certificateRecord && template && period.No.trim() !== "";

  return (
    <Section
      lang={lang}
      title={rtl ? "صورت‌وضعیت دوره" : "Period certificate"}
      hint={rtl ? "کارکرد را وارد کنید؛ سرور ناخالص/کسورات/خالص را حساب می‌کند و در سند می‌نشاند" : "server computes and stores gross/deductions/net"}
    >
      {can.certificateRecord && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <select className={inputCls} value={templateCode} onChange={(ev) => { setTemplateCode(ev.target.value); setRows({}); setPreview(null); }}>
              {published.length === 0 && <option value="">{rtl ? "قالب منتشرشده‌ای نیست" : "no published template"}</option>}
              {published.map((t) => <option key={t.Code} value={t.Code}>{t.Code} — {t.TitleFa} (v{t.Version})</option>)}
            </select>
            <input className={inputCls} placeholder={rtl ? "شمارهٔ دوره" : "period no."} dir="ltr" value={period.No} onChange={(ev) => setPeriod((p) => ({ ...p, No: ev.target.value }))} />
            <input className={inputCls} type="date" dir="ltr" value={period.From} onChange={(ev) => setPeriod((p) => ({ ...p, From: ev.target.value }))} />
            <input className={inputCls} type="date" dir="ltr" value={period.To} onChange={(ev) => setPeriod((p) => ({ ...p, To: ev.target.value }))} />
            <select className={inputCls} value={period.Currency} onChange={(ev) => setPeriod((p) => ({ ...p, Currency: ev.target.value }))}>
              {["IRR", "EUR", "USD"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {template && (
            <div className="space-y-1.5">
              {template.Items.map((i) => (
                <div key={i.Code} className="flex flex-wrap items-center gap-2">
                  <span className="w-56 text-[10px] font-light tx2">
                    <span className="font-mono" dir="ltr">{i.Code}</span> · {i.TitleFa}{" "}
                    <span className="tx3">({rtl ? BASIS_LABEL[i.Basis]?.fa : BASIS_LABEL[i.Basis]?.en}{i.PercentOf ? ` ← ${i.PercentOf}` : ""})</span>
                  </span>
                  {i.Basis === "measured" && (
                    <>
                      <input className={`${inputCls} w-24`} placeholder={rtl ? "مقدار" : "qty"} dir="ltr" value={rows[i.Code]?.Quantity ?? ""} onChange={(ev) => setRow(i.Code, { Quantity: ev.target.value })} />
                      <input className={`${inputCls} w-28`} placeholder={rtl ? "نرخ" : "rate"} dir="ltr" value={rows[i.Code]?.UnitRate ?? ""} onChange={(ev) => setRow(i.Code, { UnitRate: ev.target.value })} />
                    </>
                  )}
                  {i.Basis === "lump" && (
                    <input className={`${inputCls} w-28`} placeholder={rtl ? "مبلغ" : "amount"} dir="ltr" value={rows[i.Code]?.Amount ?? ""} onChange={(ev) => setRow(i.Code, { Amount: ev.target.value })} />
                  )}
                  {i.Basis === "percent" && (
                    <input className={`${inputCls} w-24`} placeholder={rtl ? "درصد" : "percent"} dir="ltr" value={rows[i.Code]?.Percent ?? ""} onChange={(ev) => setRow(i.Code, { Percent: ev.target.value })} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inputCls} w-56`} placeholder={rtl ? "یادداشت" : "note"} value={period.NoteFa} onChange={(ev) => setPeriod((p) => ({ ...p, NoteFa: ev.target.value }))} />
            <button className={`${chipCls} tx2`} disabled={!template || inputs.length === 0} onClick={() => void previewNow()}>
              🔍 {rtl ? "پیش‌نمایش محاسبه" : "Preview"}
            </button>
            <button className={`${chipCls} text-sky-300`} disabled={busy || !canCreate} onClick={() => void run(create)}>
              ＋ {rtl ? "ثبت سند پیش‌نویس" : "Save draft certificate"}
            </button>
          </div>

          {preview && (
            <div className="glass-row rounded-xl p-2.5">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[9px] font-light tx3">
                <span>{rtl ? "محاسبهٔ سرور (قالب" : "server computation (template"} <span className="font-mono" dir="ltr">v{preview.template.Version}</span>)</span>
                <span className="ms-auto" dir="ltr">{preview.asOf}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[9.5px] font-light">
                <span className="tx2">{rtl ? "ناخالص" : "gross"}: <b className="tx1 tabular-nums" dir="ltr">{fx(preview.computation.grossAmount)}</b></span>
                <span className="tx2">{rtl ? "کسورات" : "deductions"}: <b className="text-amber-200 tabular-nums" dir="ltr">{fx(preview.computation.deductionTotal)}</b></span>
                <span className="tx2">{rtl ? "خالص" : "net"}: <b className="text-emerald-300 tabular-nums" dir="ltr">{fx(preview.computation.netAmount)}</b></span>
                {preview.computation.flags.negativeNet && <span className="text-rose-300">{rtl ? "خالص منفی است" : "negative net"}</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {preview.computation.deductions.map((d) => (
                  <span key={d.Code} className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] font-light tx2">
                    {d.TitleFa} = {d.Mode === "percent" ? `${d.Rate}٪ × ${fx(d.BaseAmount)}` : fx(d.Rate)} → <b className="text-amber-200" dir="ltr">{fx(d.Amount)}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 space-y-2">
        {data.certificates.length === 0 && <div className="text-[10px] font-light tx3">{rtl ? "صورت‌وضعیتی ثبت نشده است." : "No certificates."}</div>}
        {data.certificates.map((c) => <CertificateRow key={c.Id} lang={lang} row={c} can={data.can} busy={busy} run={run} client={client} />)}
      </div>
    </Section>
  );
}

function CertificateRow({ lang, row, can, busy, run, client }: { lang: Lang; row: CntCertificateRow; can: CntWorkspacePayload["can"]; busy: boolean; run: Run; client: CntIpcClient }) {
  const rtl = lang === "fa";
  return (
    <div className="glass-row rounded-xl p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9.5px] tx3" dir="ltr">{row.TemplateCode}@v{row.TemplateVersion}</span>
        <span className="text-[10px] font-light tx2">{rtl ? "دوره" : "period"} <span dir="ltr">{row.PeriodNo}</span></span>
        <span className="text-[9px] font-extralight tx3" dir="ltr">{row.PeriodFrom} → {row.PeriodTo}</span>
        <span className="text-[9.5px] font-light tx2" dir="ltr">
          {fx(row.GrossAmount)} − {fx(row.DeductionTotal)} = <b className={row.NetAmount !== null && row.NetAmount < 0 ? "text-rose-300" : "text-emerald-300"}>{fx(row.NetAmount)}</b> {row.Currency}
        </span>
        <StatusChip lang={lang} status={row.Status} />
        <div className="ms-auto flex gap-1.5">
          {can.certificateRecord && (row.Status === "draft" || row.Status === "returned") && (
            <button disabled={busy} className={`${chipCls} text-sky-300`} onClick={() => void run(() => client.certificateTransition(row.Id, "submit"))}>
              ↑ {rtl ? "ارسال" : "Submit"}
            </button>
          )}
          {can.certificateApprove && row.Status === "submitted" && (
            <>
              <button disabled={busy} className={`${chipCls} text-emerald-300`} onClick={() => void run(() => client.certificateTransition(row.Id, "approve"))}>
                ✓ {rtl ? "تصویب" : "Approve"}
              </button>
              <button disabled={busy} className={`${chipCls} text-amber-300`} onClick={() => {
                const note = window.prompt(rtl ? "دلیل برگشت صورت‌وضعیت:" : "Return reason:");
                if (note) void run(() => client.certificateTransition(row.Id, "return", note));
              }}>
                ↩ {rtl ? "برگشت" : "Return"}
              </button>
            </>
          )}
        </div>
      </div>
      {row.SignedNoteFa && <div className="mt-1 text-[9px] font-light text-emerald-200">{rtl ? "مهر تصویب" : "signature"}: {row.SignedNoteFa}</div>}
      {row.ReturnNoteFa && <div className="mt-1 text-[9px] font-light text-amber-200">{rtl ? "دلیل برگشت" : "Return note"}: {row.ReturnNoteFa}</div>}
    </div>
  );
}
