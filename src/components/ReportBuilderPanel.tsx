/**
 * P9 / RPT-1 — گزارش‌ساز سفارشی (زنده).
 *
 * کاربر از مجموعه‌داده‌های مجاز، ستون/فیلتر/گروه/نمودار می‌سازد، پیش‌نمایش را
 * از سرور می‌گیرد و در صورت داشتن مجوز، قالب را ذخیره می‌کند. انتشار قالب سند
 * حاکمیتی است (SOD-31): سازنده ≠ منتشرکننده.
 *
 * هیچ محاسبه‌ای این‌جا انجام نمی‌شود؛ هر عدد خروجی سرور است.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import { ReportBuilderClient, type RbChart, type RbDatasetInfo, type RbResult, type RbTemplate, type RbWorkspace } from "../services/reportBuilderApi";

const e = encodeURIComponent;
const OPS: { key: string; fa: string; en: string }[] = [
  { key: "eq", fa: "برابر", en: "equals" },
  { key: "ne", fa: "نابرابر", en: "not equal" },
  { key: "contains", fa: "شامل", en: "contains" },
  { key: "starts", fa: "شروع با", en: "starts with" },
  { key: "gt", fa: "بزرگ‌تر", en: ">" },
  { key: "gte", fa: "بزرگ‌تر/مساوی", en: "≥" },
  { key: "lt", fa: "کوچک‌تر", en: "<" },
  { key: "lte", fa: "کوچک‌تر/مساوی", en: "≤" },
  { key: "in", fa: "در فهرست", en: "in list" },
  { key: "empty", fa: "خالی", en: "is empty" },
  { key: "notempty", fa: "پر", en: "not empty" },
];
const AGGS = ["count", "sum", "avg", "min", "max"] as const;
const CHART_KINDS = ["none", "bar", "line", "pie"] as const;
const TONE: Record<string, string> = { published: "text-emerald-300", draft: "text-amber-300", retired: "tx3" };
const inputCls = "glass-row w-full rounded-lg border b-line-soft px-2.5 py-1.5 text-[10.5px] font-light tx1 outline-none focus:b-line";
const chipCls = "rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] font-light transition disabled:opacity-40";
const fx = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: digits }));

type FilterDraft = { column: string; op: string; value: string };

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

function ResultTable({ lang, dataset, result }: { lang: Lang; dataset: RbDatasetInfo | null; result: RbResult }) {
  const rtl = lang === "fa";
  const labelOf = (key: string) => {
    const col = dataset?.columns.find((c) => c.name === key);
    return col ? (rtl ? col.label.fa : col.label.en) : key;
  };
  if (result.groups) {
    return (
      <table className="w-full text-[10px] font-light">
        <thead className="tx3">
          <tr>
            <th className="px-1.5 py-1 text-start">{labelOf(result.groupBy ?? "")}</th>
            <th className="px-1.5 py-1 text-start">{rtl ? "تعداد" : "count"}</th>
            {Object.keys(result.groups[0]?.aggs ?? {}).map((k) => (
              <th key={k} className="px-1.5 py-1 text-start">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.groups.map((g) => (
            <tr key={g.key} className="border-t b-line-soft">
              <td className="px-1.5 py-1 tx1">{g.key}</td>
              <td className="px-1.5 py-1 tabular-nums tx2" dir="ltr">{fx(g.count)}</td>
              {Object.entries(g.aggs).map(([k, v]) => (
                <td key={k} className="px-1.5 py-1 tabular-nums tx2" dir="ltr">{fx(v, 2)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] font-light">
        <thead className="tx3">
          <tr>
            {result.fields.map((f) => (
              <th key={f} className="whitespace-nowrap px-1.5 py-1 text-start">{labelOf(f)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={`${i}-${String(row[result.fields[0]] ?? "")}`} className="border-t b-line-soft">
              {result.fields.map((f) => (
                <td key={f} className="whitespace-nowrap px-1.5 py-1 tx2" dir="ltr">{row[f] === null ? "—" : String(row[f])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartView({ lang, chart }: { lang: Lang; chart: RbChart }) {
  const rtl = lang === "fa";
  if (!chart || chart.kind === "none") return null;
  const values = chart.points.map((p) => p.value ?? 0);
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  return (
    <div className="mt-2 space-y-1">
      <div className="text-[9.5px] tx3">{chart.kind} · {chart.measure} / {chart.category}</div>
      {chart.points.slice(0, 12).map((p, i) => (
        <div key={`${p.label}-${i}`} className="flex items-center gap-2 text-[9.5px]">
          <span className="w-32 truncate tx2">{p.label}</span>
          <span className="h-2 rounded bg-sky-400/50" style={{ width: `${Math.round((Math.abs(p.value ?? 0) / max) * 60)}%` }} />
          <span className="tabular-nums tx3" dir="ltr">{fx(p.value, 2)}</span>
        </div>
      ))}
      {chart.points.length > 12 && <div className="text-[8.5px] tx4">{rtl ? `… و ${chart.points.length - 12} نقطهٔ دیگر` : `… ${chart.points.length - 12} more`}</div>}
    </div>
  );
}

export default function ReportBuilderPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const T = (fa: string, en: string) => (rtl ? fa : en);
  const { projectScope } = useSystem();
  const { user } = useAuth();
  const projectId = projectScope?.projectId ?? "";
  const client = useMemo(() => new ReportBuilderClient(projectId, user?.id ?? null), [projectId, user?.id]);

  const [ws, setWs] = useState<RbWorkspace | null>(null);
  const [datasetKey, setDatasetKey] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterDraft[]>([]);
  const [groupBy, setGroupBy] = useState("");
  const [aggFn, setAggFn] = useState<string>("count");
  const [aggColumn, setAggColumn] = useState("");
  const [chartKind, setChartKind] = useState<string>("none");
  const [measure, setMeasure] = useState("");
  const [limit, setLimit] = useState(100);
  const [result, setResult] = useState<{ result: RbResult; chart: RbChart } | null>(null);
  const [templates, setTemplates] = useState<RbTemplate[]>([]);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const dataset = useMemo(() => ws?.datasets.find((d) => d.key === datasetKey) ?? null, [ws, datasetKey]);
  const numeric = useMemo(() => dataset?.columns.filter((c) => ["number", "money"].includes(c.kind)) ?? [], [dataset]);
  const can = ws?.can;

  const load = useCallback(async () => {
    if (!projectId) return;
    const r = await client.workspace();
    if (r.ok) {
      setWs(r.data);
      setTemplates(r.data.templates);
      setErr(null);
      setDatasetKey((k) => (k && r.data.datasets.some((d) => d.key === k) ? k : r.data.datasets[0]?.key ?? ""));
    } else setErr(`${r.message} (${r.code})`);
  }, [client, projectId]);
  useEffect(() => { void load(); }, [load]);

  /** با تغییر مجموعه‌داده، فیلدهای پیش‌فرض همان مجموعه و حالت‌ها بازنشانی می‌شوند. */
  useEffect(() => {
    if (!dataset) return;
    setFields(dataset.columns.slice(0, 5).map((c) => c.name));
    setFilters([]);
    setGroupBy("");
    setAggColumn(numeric[0]?.name ?? "");
    setMeasure(numeric[0]?.name ?? "");
    setResult(null);
  }, [dataset, numeric]);

  const spec = useMemo(
    () => ({
      dataset: datasetKey,
      fields,
      filters: filters
        .filter((f) => f.column)
        .map((f) => ({
          column: f.column,
          op: f.op,
          ...(["empty", "notempty"].includes(f.op) ? {} : f.op === "in" ? { values: f.value.split(",").map((v) => v.trim()).filter(Boolean) } : { value: f.value === "" ? null : (numeric.some((c) => c.name === f.column) && Number.isFinite(Number(f.value)) ? Number(f.value) : f.value) }),
        })),
      group: groupBy ? { by: groupBy, aggs: aggFn === "count" ? [{ column: aggColumn || groupBy, fn: "count" }] : [{ column: aggColumn, fn: aggFn }] } : null,
      chart: chartKind === "none" ? null : { kind: chartKind, category: groupBy || fields[0] || dataset?.columns[0]?.name || "", measure: groupBy ? `sum:${aggColumn}` : measure },
      limit,
    }),
    [datasetKey, fields, filters, groupBy, aggFn, aggColumn, chartKind, measure, limit, numeric, dataset],
  );

  const run = useCallback(async (fn: () => Promise<{ ok: true } | { ok: false; message: string; code?: string }>) => {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    if (!r.ok) setErr(`${r.message} (${r.code ?? "?"})`);
    else setErr(null);
    await load();
    setBusy(false);
  }, [load]);

  const preview = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const r = await client.preview(spec);
    setBusy(false);
    if (r.ok) { setResult({ result: r.data.result, chart: r.data.chart }); setMsg(rtl ? `${r.data.result.matched} ردیف مطابق، ${r.data.result.shown} ردیف نمایش` : `${r.data.result.matched} matched, ${r.data.result.shown} shown`); }
    else { setResult(null); setErr(`${r.message} (${r.code})`); }
  }, [client, spec, rtl]);

  const runSaved = useCallback(async (t: RbTemplate) => {
    setBusy(true);
    const r = await client.run(t.Code);
    setBusy(false);
    if (r.ok) { setResult({ result: r.data.result, chart: r.data.chart }); setMsg(rtl ? `اجرای «${t.TitleFa}» — نسخهٔ ${t.Version}` : `Ran “${t.TitleFa}” — v${t.Version}`); setErr(null); }
    else { setResult(null); setErr(`${r.message} (${r.code})`); }
  }, [client, rtl]);

  const save = useCallback(async () => {
    await run(async () => {
      const r = await client.createTemplate({
        Code: code.trim(),
        TitleFa: title.trim(),
        DatasetKey: datasetKey,
        Fields: fields,
        Filters: spec.filters,
        Group: spec.group,
        Chart: spec.chart,
        Limit: limit,
        ...(note.trim() ? { NoteFa: note.trim() } : {}),
      });
      if (!r.ok) return r;
      setCode(""); setTitle(""); setNote("");
      setMsg(rtl ? `قالب ${r.data.Code} پیش‌نویس شد` : `Template ${r.data.Code} drafted`);
      return { ok: true } as const;
    });
  }, [client, code, title, datasetKey, fields, spec, limit, note, run, rtl]);

  const csv = useCallback(async (t: RbTemplate) => {
    const r = await client.csv(t.Code);
    if (!r.ok) { setErr(r.message); return; }
    const blob = new Blob([r.text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.Code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [client]);

  if (!projectId) return <div className="p-4 text-[10.5px] font-light tx3">{T("پروژه‌ای انتخاب نشده است.", "No project selected.")}</div>;

  const downloadLink = (t: RbTemplate) => `/api/reports/${e(projectId)}/templates/${e(t.Code)}/csv`;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-light tx2">{T("گزارش‌ساز سفارشی — فیلد، فیلتر، گروه، نمودار، قالب ذخیره‌شده", "Custom report builder — fields, filters, groups, chart, saved template")}</span>
        <button onClick={() => void load()} className="ms-auto rounded-lg px-2.5 py-1 text-[9.5px] font-light tx3 transition hover:tx1">↻ {T("بازخوانی", "Refresh")}</button>
      </div>
      {err && <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-200">{err}</div>}
      {msg && !err && <div className="rounded-lg border b-line-soft px-3 py-2 text-[10px] tx3">{msg}</div>}
      {ws && (
        <div className="flex flex-wrap gap-2 text-[9.5px] tx3">
          <span className="rounded-lg border b-line-soft px-2 py-1">{T("مجموعه‌دادهٔ مجاز", "Allowed datasets")}: <b className="tx1">{ws.metrics.datasets}</b></span>
          <span className="rounded-lg border b-line-soft px-2 py-1">{T("پوشیده", "Restricted")}: <b className="tx1">{ws.restrictedDatasets}</b></span>
          <span className="rounded-lg border b-line-soft px-2 py-1">{T("قالب‌ها", "Templates")}: <b className="tx1">{ws.metrics.templates.total}</b> ({ws.metrics.templates.published} {T("منتشرشده", "published")})</span>
          <span className="rounded-lg border b-line-soft px-2 py-1 tx4" dir="ltr">{ws.metrics.modelVersion}</span>
        </div>
      )}

      <Section lang={lang} title={T("۱) مجموعه‌داده و ستون‌ها", "1) Dataset & columns")} hint={T("فقط ستون‌های مجاز سرور", "server allowlist only")}>
        <div className="flex flex-wrap items-center gap-2">
          <select value={datasetKey} onChange={(ev) => setDatasetKey(ev.target.value)} className={`${inputCls} max-w-64`} style={{ colorScheme: "dark" }}>
            {(ws?.datasets ?? []).map((d) => (
              <option key={d.key} value={d.key}>{rtl ? d.label.fa : d.label.en}</option>
            ))}
          </select>
          <span className="text-[9px] tx4" dir="ltr">{dataset?.table}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(dataset?.columns ?? []).map((c) => {
            const on = fields.includes(c.name);
            return (
              <button
                key={c.name}
                onClick={() => setFields((prev) => (on ? prev.filter((f) => f !== c.name) : [...prev, c.name]))}
                className={`${chipCls} ${on ? "toggle-on tx1" : "tx3"}`}
                title={c.name}
              >
                {rtl ? c.label.fa : c.label.en}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[9.5px] tx3">
          <span>{T("سقف ردیف", "Row limit")}</span>
          <input type="number" min={1} max={5000} value={limit} onChange={(ev) => setLimit(Math.max(1, Math.min(5000, Number(ev.target.value) || 1)))} className={`${inputCls} w-24`} dir="ltr" />
          <span className="tx4">{T("ستون‌های انتخابی", "selected")}: {fields.length}</span>
        </div>
      </Section>

      <Section lang={lang} title={T("۲) فیلترها", "2) Filters")} hint={T("حداکثر ۸ فیلتر، عملگر بسته", "≤8 filters, closed operators")}>
        <div className="space-y-1.5">
          {filters.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <select value={f.column} onChange={(ev) => setFilters((prev) => prev.map((x, j) => (j === i ? { ...x, column: ev.target.value } : x)))} className={`${inputCls} max-w-44`} style={{ colorScheme: "dark" }}>
                {(dataset?.columns ?? []).map((c) => (<option key={c.name} value={c.name}>{rtl ? c.label.fa : c.label.en}</option>))}
              </select>
              <select value={f.op} onChange={(ev) => setFilters((prev) => prev.map((x, j) => (j === i ? { ...x, op: ev.target.value } : x)))} className={`${inputCls} max-w-32`} style={{ colorScheme: "dark" }}>
                {OPS.map((o) => (<option key={o.key} value={o.key}>{rtl ? o.fa : o.en}</option>))}
              </select>
              {!["empty", "notempty"].includes(f.op) && (
                <input value={f.value} onChange={(ev) => setFilters((prev) => prev.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))} placeholder={f.op === "in" ? "a, b, c" : ""} className={`${inputCls} max-w-40`} dir="ltr" />
              )}
              <button onClick={() => setFilters((prev) => prev.filter((_, j) => j !== i))} className={`${chipCls} tx3 hover:text-rose-300`}>✕</button>
            </div>
          ))}
        </div>
        <button
          disabled={filters.length >= 8}
          onClick={() => setFilters((prev) => [...prev, { column: dataset?.columns[0]?.name ?? "", op: "eq", value: "" }])}
          className={`${chipCls} mt-2 tx2`}
        >＋ {T("افزودن فیلتر", "Add filter")}</button>
      </Section>

      <Section lang={lang} title={T("۳) گروه‌بندی و نمودار", "3) Grouping & chart")} hint={T("جمع/میانگین سمت سرور", "server-side aggregation")}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[9.5px] tx3">{T("گروه بر اساس", "Group by")}</label>
          <select value={groupBy} onChange={(ev) => { setGroupBy(ev.target.value); setAggColumn(numeric[0]?.name ?? ""); }} className={`${inputCls} max-w-40`} style={{ colorScheme: "dark" }}>
            <option value="">{T("بدون گروه‌بندی", "no grouping")}</option>
            {(dataset?.columns ?? []).map((c) => (<option key={c.name} value={c.name}>{rtl ? c.label.fa : c.label.en}</option>))}
          </select>
          {groupBy && (
            <>
              <select value={aggFn} onChange={(ev) => setAggFn(ev.target.value)} className={`${inputCls} max-w-28`} style={{ colorScheme: "dark" }}>
                {AGGS.map((a) => (<option key={a} value={a}>{a}</option>))}
              </select>
              {aggFn !== "count" && (
                <select value={aggColumn} onChange={(ev) => setAggColumn(ev.target.value)} className={`${inputCls} max-w-40`} style={{ colorScheme: "dark" }}>
                  {numeric.map((c) => (<option key={c.name} value={c.name}>{rtl ? c.label.fa : c.label.en}</option>))}
                </select>
              )}
            </>
          )}
          <label className="text-[9.5px] tx3">{T("نمودار", "Chart")}</label>
          <select value={chartKind} onChange={(ev) => setChartKind(ev.target.value)} className={`${inputCls} max-w-28`} style={{ colorScheme: "dark" }}>
            {CHART_KINDS.map((k) => (<option key={k} value={k}>{k}</option>))}
          </select>
          {chartKind !== "none" && !groupBy && numeric.length > 0 && (
            <select value={measure} onChange={(ev) => setMeasure(ev.target.value)} className={`${inputCls} max-w-40`} style={{ colorScheme: "dark" }}>
              {numeric.map((c) => (<option key={c.name} value={c.name}>{rtl ? c.label.fa : c.label.en}</option>))}
            </select>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button disabled={busy || !can?.run || fields.length === 0} onClick={() => void preview()} className={`${chipCls} toggle-on tx1`}>
            {busy ? T("در حال اجرا…", "Running…") : T("پیش‌نمایش از سرور", "Preview from server")}
          </button>
          {!can?.run && <span className="text-[9px] text-amber-300">{T("مجوز اجرای گزارش ندارید", "no run permission")}</span>}
        </div>
      </Section>

      {result && (
        <Section lang={lang} title={T("۴) نتیجهٔ سرور", "4) Server result")} hint={`${result.result.matched} / ${result.result.shown}${result.result.truncated ? T(" (بریده)", " (truncated)") : ""}`}>
          <ResultTable lang={lang} dataset={dataset} result={result.result} />
          <ChartView lang={lang} chart={result.chart} />
          <div className="mt-2 text-[9px] tx4" dir="ltr">{result.result.generatedAt} · {result.result.table}</div>
        </Section>
      )}

      <Section lang={lang} title={T("۵) ذخیره و انتشار قالب", "5) Save & publish template")} hint={T("نشر جدا از تحریر (SOD-31)", "publish ≠ author (SOD-31)")}>
        <div className="flex flex-wrap items-center gap-2">
          <input value={code} onChange={(ev) => setCode(ev.target.value.toUpperCase())} placeholder="RPT-…" className={`${inputCls} max-w-36`} dir="ltr" />
          <input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder={T("عنوان قالب", "template title")} className={`${inputCls} max-w-64`} />
          <input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={T("یادداشت", "note")} className={`${inputCls} max-w-56`} />
          <button disabled={busy || !can?.edit || !code.trim() || !title.trim()} onClick={() => void save()} className={`${chipCls} toggle-on tx1`}>{T("ذخیرهٔ پیش‌نویس", "Save draft")}</button>
          {!can?.edit && <span className="text-[9px] text-amber-300">{T("مجوز ساخت قالب ندارید", "no author permission")}</span>}
        </div>

        {templates.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[10px] font-light">
              <thead className="tx3">
                <tr>
                  <th className="px-1.5 py-1 text-start">{T("کد", "Code")}</th>
                  <th className="px-1.5 py-1 text-start">{T("عنوان", "Title")}</th>
                  <th className="px-1.5 py-1 text-start">{T("مجموعه‌داده", "Dataset")}</th>
                  <th className="px-1.5 py-1 text-start">{T("وضعیت", "Status")}</th>
                  <th className="px-1.5 py-1 text-start">v</th>
                  <th className="px-1.5 py-1 text-start" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.Id} className="border-t b-line-soft">
                    <td className="px-1.5 py-1 font-mono text-[9.5px] tx2" dir="ltr">{t.Code}</td>
                    <td className="px-1.5 py-1 tx1">{t.TitleFa}</td>
                    <td className="px-1.5 py-1 tx3" dir="ltr">{t.DatasetKey}</td>
                    <td className={`px-1.5 py-1 ${TONE[t.Status] ?? "tx3"}`}>{t.Status}</td>
                    <td className="px-1.5 py-1 tabular-nums tx3" dir="ltr">{t.Version}</td>
                    <td className="px-1.5 py-1">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button onClick={() => void runSaved(t)} disabled={busy || !can?.run} className={`${chipCls} tx2`}>{T("اجرا", "Run")}</button>
                        <button onClick={() => void csv(t)} disabled={busy} className={`${chipCls} tx2`}>{T("CSV", "CSV")}</button>
                        <a href={downloadLink(t)} className={`${chipCls} tx3`} download>{T("دانلود", "Download")}</a>
                        {t.Status === "draft" && (
                          <button onClick={() => void run(async () => await client.transition(t.Code, "publish"))} disabled={busy || !can?.publish} className={`${chipCls} text-emerald-300`}>{T("انتشار", "Publish")}</button>
                        )}
                        {t.Status === "published" && (
                          <button onClick={() => void run(async () => await client.transition(t.Code, "retire"))} disabled={busy || !can?.edit} className={`${chipCls} text-amber-300`}>{T("بازنشستگی", "Retire")}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
