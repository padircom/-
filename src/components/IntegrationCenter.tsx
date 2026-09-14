import { useMemo, useRef, useState } from "react";
import { type Lang } from "../data/framework";
import { SCHEMA, allColumns } from "../services/persistence";
import {
  CONNECTORS,
  INTEGRATION_VERSION,
  TEMPLATE_CATALOG,
  diffRows,
  ACTIVITY_COMPARE_FIELDS,
  extractXer,
  generateOpenApi,
  integrationStats,
  parseImport,
  parseXer,
  templateByCode,
  templateCsv,
  templateGuide,
  toYaml,
  type ImportIssue,
  type ParsedImport,
  type TemplateDef,
  type XerExtract,
} from "../services/integration";

type Pane = "overview" | "xer" | "templates" | "openapi";

const PANES: { key: Pane; icon: string; label: { fa: string; en: string } }[] = [
  { key: "overview", icon: "🔌", label: { fa: "اتصال‌دهنده‌ها", en: "Connectors" } },
  { key: "xer", icon: "📅", label: { fa: "ورود XER پریماورا", en: "Primavera XER" } },
  { key: "templates", icon: "📄", label: { fa: "قالب‌های ورود داده", en: "Import templates" } },
  { key: "openapi", icon: "🧩", label: { fa: "مشخصات OpenAPI", en: "OpenAPI spec" } },
];

const STATUS_META: Record<string, { fa: string; en: string; cls: string }> = {
  ready: { fa: "آماده", en: "Ready", cls: "bg-emerald-500/15 text-emerald-300" },
  partial: { fa: "ناقص", en: "Partial", cls: "bg-amber-500/15 text-amber-300" },
  planned: { fa: "برنامه‌ریزی‌شده", en: "Planned", cls: "bg-slate-500/15 text-slate-300" },
};

const DIRECTION_META: Record<string, { fa: string; en: string }> = {
  inbound: { fa: "ورودی", en: "Inbound" },
  outbound: { fa: "خروجی", en: "Outbound" },
  both: { fa: "دوطرفه", en: "Two-way" },
};

/** دانلود متنی با BOM تا اکسل فارسی درست باز شود. */
function download(name: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob(["\uFEFF", text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** فقط پاسخ JSON معتبر است — در dev سرور Vite مسیر /api صفحهٔ HTML می‌دهد. */
async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.headers.get("content-type")?.includes("application/json")) return null;
    const json = await res.json();
    return (json?.data ?? json) as T;
  } catch {
    return null;
  }
}

function IssueList({ issues, rtl }: { issues: ImportIssue[]; rtl: boolean }) {
  if (!issues.length) {
    return <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-300">{rtl ? "هیچ خطا یا هشداری گزارش نشد." : "No issues reported."}</p>;
  }
  return (
    <div className="thin-scroll max-h-44 space-y-1 overflow-y-auto">
      {issues.map((i, idx) => (
        <div
          key={`${i.code}-${idx}`}
          className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[10px] ${i.severity === "error" ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-300"}`}
        >
          <span className="font-mono text-[9px] opacity-70" dir="ltr">{i.code}</span>
          <span className="flex-1">{i.message}</span>
          {i.row !== undefined && <span className="opacity-60">{rtl ? `سطر ${i.row}` : `row ${i.row}`}</span>}
        </div>
      ))}
    </div>
  );
}

export default function IntegrationCenter({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const T = (b: { fa: string; en: string }) => (rtl ? b.fa : b.en);

  const [pane, setPane] = useState<Pane>("overview");
  const stats = useMemo(() => integrationStats(), []);

  /* ── ورود XER ── */
  const xerInput = useRef<HTMLInputElement>(null);
  const [xerName, setXerName] = useState("");
  const [xerRaw, setXerRaw] = useState("");
  const [projectId, setProjectId] = useState("prj-1");
  const [busy, setBusy] = useState(false);
  const [commitMsg, setCommitMsg] = useState<string | null>(null);

  const xer = useMemo<XerExtract | null>(() => {
    if (!xerRaw.trim()) return null;
    try {
      const file = parseXer(xerRaw);
      if (!file.tableNames.length) return null;
      return extractXer(file, projectId || "import");
    } catch {
      return null;
    }
  }, [xerRaw, projectId]);

  /** تفاوت‌گیری ورود دوباره: بدون پایگاه داده هم منطق آشتی‌دهی قابل نمایش است. */
  const selfDiff = useMemo(() => (xer ? diffRows([], xer.activities, "Code", ACTIVITY_COMPARE_FIELDS) : null), [xer]);

  const readFile = (file: File, onText: (text: string, name: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result ?? ""), file.name);
    reader.readAsText(file, "utf-8");
  };

  const commitXer = async () => {
    if (!xer || !xerRaw) return;
    setBusy(true);
    setCommitMsg(null);
    const res = await postJson<{ committed: boolean; written: Record<string, number> }>(
      `/api/integration/xer?projectId=${encodeURIComponent(projectId)}&commit=1`,
      { content: xerRaw, fileName: xerName },
    );
    setBusy(false);
    setCommitMsg(
      res?.committed
        ? rtl
          ? `نوشته شد — ${res.written.activities} فعالیت، ${res.written.wbs} گره WBS، ${res.written.relations} رابطه`
          : `Committed — ${res.written.activities} activities, ${res.written.wbs} WBS nodes, ${res.written.relations} relations`
        : rtl
        ? "سرویس API در دسترس نیست؛ پیش‌نمایش محلی معتبر است ولی چیزی نوشته نشد."
        : "API unavailable; local preview is valid but nothing was written.",
    );
  };

  /* ── قالب‌ها ── */
  const [templateCode, setTemplateCode] = useState("TPL-ACT");
  const template = useMemo<TemplateDef>(() => templateByCode(templateCode) ?? TEMPLATE_CATALOG[0], [templateCode]);
  const guide = useMemo(() => templateGuide(template, lang), [template, lang]);
  const tplInput = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ParsedImport | null>(null);
  const [importName, setImportName] = useState("");

  /* ── OpenAPI ── */
  const [format, setFormat] = useState<"yaml" | "json">("yaml");
  const spec = useMemo(
    () =>
      generateOpenApi(
        SCHEMA.map((t) => ({
          name: t.name,
          title: t.title,
          pk: t.pk,
          columns: allColumns(t).map((c) => ({ name: c.name, kind: c.kind, len: c.len, nullable: c.nullable })),
        })),
      ),
    [],
  );
  const specText = useMemo(() => (format === "yaml" ? toYaml(spec) : JSON.stringify(spec, null, 2)), [spec, format]);
  const pathCount = Object.keys(spec.paths).length;

  const card = "glass-dark rounded-2xl p-4";
  const chip = "rounded-lg bg-black/20 px-2.5 py-1 text-[10px] tx2";

  return (
    <div className="fade-rise space-y-3.5">
      {/* سربرگ */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h3 className="flex items-center gap-2 text-[12px] font-medium tx1">
            <span>🔗</span>
            {rtl ? "مرکز یکپارچه‌سازی" : "Integration Center"}
            <span className="font-mono text-[9px] tx3" dir="ltr">{INTEGRATION_VERSION}</span>
          </h3>
          <p className="mt-1 text-[10px] font-extralight tx3">
            {rtl
              ? "ورود برنامه پریماورا، قالب‌های استاندارد اکسل و مشخصات API — همه بر پایهٔ اسکیمای قانونی sql-v1."
              : "Primavera intake, standard Excel templates and the API contract — all on the canonical sql-v1 schema."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={chip}>{rtl ? `${stats.connectors} اتصال‌دهنده` : `${stats.connectors} connectors`}</span>
          <span className={chip}>{rtl ? `${stats.ready} آماده` : `${stats.ready} ready`}</span>
          <span className={chip}>{rtl ? `${stats.templates} قالب` : `${stats.templates} templates`}</span>
          <span className={chip}>{rtl ? `${stats.templateFields} ستون قالب` : `${stats.templateFields} template fields`}</span>
        </div>
      </div>

      {/* ناوبری داخلی */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-black/15 p-1">
        {PANES.map((p) => (
          <button
            key={p.key}
            onClick={() => setPane(p.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-light transition ${pane === p.key ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
          >
            <span>{p.icon}</span>
            <span>{T(p.label)}</span>
          </button>
        ))}
      </div>

      {/* ═════ اتصال‌دهنده‌ها ═════ */}
      {pane === "overview" && (
        <div className={`${card} space-y-2`}>
          <h4 className="text-[11px] font-medium tx1">{rtl ? "رجیستری اتصال‌دهنده‌ها" : "Connector registry"}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="tx3">
                <tr className="border-b b-line-soft text-start">
                  <th className="px-2 py-1.5 text-start">{rtl ? "کد" : "Code"}</th>
                  <th className="px-2 py-1.5 text-start">{rtl ? "عنوان" : "Title"}</th>
                  <th className="px-2 py-1.5 text-start">{rtl ? "جهت" : "Direction"}</th>
                  <th className="px-2 py-1.5 text-start">{rtl ? "قالب" : "Format"}</th>
                  <th className="px-2 py-1.5 text-start">{rtl ? "جدول هدف" : "Target tables"}</th>
                  <th className="px-2 py-1.5 text-start">{rtl ? "وضعیت" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {CONNECTORS.map((c) => (
                  <tr key={c.code} className="border-b b-line-soft/40 align-top">
                    <td className="px-2 py-1.5 font-mono text-[9.5px] tx2" dir="ltr">{c.code}</td>
                    <td className="px-2 py-1.5 tx1">
                      {T(c.title)}
                      <div className="text-[9px] font-extralight tx3">{T(c.note)}</div>
                    </td>
                    <td className="px-2 py-1.5 tx2">{T(DIRECTION_META[c.direction])}</td>
                    <td className="px-2 py-1.5 font-mono text-[9.5px] tx2" dir="ltr">{c.format}</td>
                    <td className="px-2 py-1.5 font-mono text-[9px] tx3" dir="ltr">{c.targetTables.join(", ") || "—"}</td>
                    <td className="px-2 py-1.5">
                      <span className={`rounded-md px-2 py-0.5 text-[9px] ${STATUS_META[c.status].cls}`}>{T(STATUS_META[c.status])}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═════ ورود XER ═════ */}
      {pane === "xer" && (
        <div className="space-y-3">
          <div className={`${card} space-y-3`}>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-[9.5px] font-extralight tx3">{rtl ? "شناسه پروژه مقصد" : "Target project id"}</label>
                <input
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  dir="ltr"
                  className="rounded-lg border b-line-soft bg-[var(--row)] px-3 py-2 font-mono text-[11px] tx1 outline-none focus:border-sky-400"
                />
              </div>
              <button
                onClick={() => xerInput.current?.click()}
                className="rounded-lg bg-sky-500/15 px-3 py-2 text-[11px] text-sky-300 transition hover:bg-sky-500/25"
              >
                {rtl ? "انتخاب فایل XER" : "Choose XER file"}
              </button>
              <input
                ref={xerInput}
                type="file"
                accept=".xer,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f, (text, name) => { setXerRaw(text); setXerName(name); setCommitMsg(null); });
                }}
              />
              {xerName && <span className="text-[10px] tx2" dir="ltr">{xerName}</span>}
            </div>

            <textarea
              value={xerRaw}
              onChange={(e) => { setXerRaw(e.target.value); setXerName(e.target.value ? xerName || "inline" : ""); }}
              dir="ltr"
              rows={4}
              placeholder="%T&#9;TASK ..."
              className="thin-scroll w-full rounded-lg border b-line-soft bg-[var(--row)] px-3 py-2 font-mono text-[10px] tx2 outline-none focus:border-sky-400"
            />

            {xerRaw.trim() && !xer && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[10px] text-rose-300">
                {rtl ? "ساختار XER شناسایی نشد — فایل باید شامل بلوک‌های %T/%F/%R باشد." : "No XER structure detected — the file must contain %T/%F/%R blocks."}
              </p>
            )}
          </div>

          {xer && (
            <>
              <div className={`${card} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[11px] font-medium tx1">
                    {rtl ? "پیش‌نمایش پیش از نوشتن" : "Pre-write preview"}
                    {xer.projectName && <span className="ms-2 font-mono text-[9.5px] tx3" dir="ltr">{xer.projectName}</span>}
                  </h4>
                  {xer.dataDate && <span className={chip}>{rtl ? `تاریخ داده: ${xer.dataDate}` : `Data date: ${xer.dataDate}`}</span>}
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {[
                    { k: "activities", fa: "فعالیت", en: "Activities" },
                    { k: "relations", fa: "رابطه", en: "Relations" },
                    { k: "wbs", fa: "گره WBS", en: "WBS nodes" },
                    { k: "calendars", fa: "تقویم", en: "Calendars" },
                    { k: "errors", fa: "خطا", en: "Errors" },
                  ].map((m) => (
                    <div key={m.k} className="rounded-xl bg-black/20 p-2.5 text-center">
                      <div className={`text-[16px] font-light ${m.k === "errors" && xer.counts.errors ? "text-rose-300" : "tx1"}`}>{xer.counts[m.k] ?? 0}</div>
                      <div className="text-[9px] font-extralight tx3">{rtl ? m.fa : m.en}</div>
                    </div>
                  ))}
                </div>

                {selfDiff && (
                  <p className="text-[10px] font-extralight tx3">
                    {rtl
                      ? `آشتی‌دهی با پایگاه داده هنگام نوشتن انجام می‌شود؛ در حالت پایگاه خالی ${selfDiff.added.length} ردیف افزوده خواهد شد.`
                      : `Reconciliation happens at commit; against an empty database ${selfDiff.added.length} rows would be added.`}
                  </p>
                )}

                <IssueList issues={xer.issues} rtl={rtl} />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={commitXer}
                    disabled={busy || xer.counts.errors > 0}
                    className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[11px] text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40"
                  >
                    {busy ? (rtl ? "در حال نوشتن…" : "Committing…") : rtl ? "نوشتن در پایگاه داده" : "Commit to database"}
                  </button>
                  <button
                    onClick={() => download(`${projectId}-activities.csv`, ["Code,NameFa,PlannedStart,PlannedFinish,DurationDays,TotalFloat,PhysicalPct", ...xer.activities.map((a) => [a.Code, `"${a.NameFa.replace(/"/g, '""')}"`, a.PlannedStart ?? "", a.PlannedFinish ?? "", a.DurationDays ?? "", a.TotalFloat ?? "", a.PhysicalPct ?? ""].join(","))].join("\r\n"), "text/csv;charset=utf-8")}
                    className="rounded-lg bg-black/20 px-3 py-2 text-[11px] tx2 transition hover:bg-black/30"
                  >
                    {rtl ? "خروجی CSV فعالیت‌ها" : "Export activities CSV"}
                  </button>
                  {xer.counts.errors > 0 && (
                    <span className="text-[10px] text-rose-300">{rtl ? "تا رفع خطاها نوشتن مجاز نیست." : "Commit blocked until errors are fixed."}</span>
                  )}
                  {commitMsg && <span className="text-[10px] tx2">{commitMsg}</span>}
                </div>
              </div>

              <div className={`${card} space-y-2`}>
                <h4 className="text-[11px] font-medium tx1">{rtl ? "فعالیت‌های استخراج‌شده" : "Extracted activities"}</h4>
                <div className="thin-scroll max-h-72 overflow-auto">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-[var(--row)] tx3">
                      <tr className="border-b b-line-soft">
                        <th className="px-2 py-1.5 text-start">{rtl ? "کد" : "Code"}</th>
                        <th className="px-2 py-1.5 text-start">{rtl ? "شرح" : "Name"}</th>
                        <th className="px-2 py-1.5 text-start">{rtl ? "شروع" : "Start"}</th>
                        <th className="px-2 py-1.5 text-start">{rtl ? "پایان" : "Finish"}</th>
                        <th className="px-2 py-1.5 text-start">{rtl ? "مدت" : "Dur."}</th>
                        <th className="px-2 py-1.5 text-start">{rtl ? "شناوری" : "Float"}</th>
                        <th className="px-2 py-1.5 text-start">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {xer.activities.map((a) => (
                        <tr key={a.Id} className={`border-b b-line-soft/40 ${a.IsCritical ? "bg-rose-500/5" : ""}`}>
                          <td className="px-2 py-1 font-mono text-[9.5px] tx2" dir="ltr">{a.Code}</td>
                          <td className="px-2 py-1 tx1">{a.NameFa}</td>
                          <td className="px-2 py-1 font-mono text-[9.5px] tx3" dir="ltr">{a.PlannedStart ?? "—"}</td>
                          <td className="px-2 py-1 font-mono text-[9.5px] tx3" dir="ltr">{a.PlannedFinish ?? "—"}</td>
                          <td className="px-2 py-1 tx2">{a.DurationDays ?? "—"}</td>
                          <td className={`px-2 py-1 ${a.IsCritical ? "text-rose-300" : "tx2"}`}>{a.TotalFloat ?? "—"}</td>
                          <td className="px-2 py-1 tx2">{a.PhysicalPct ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═════ قالب‌ها ═════ */}
      {pane === "templates" && (
        <div className="space-y-3">
          <div className={`${card} space-y-3`}>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_CATALOG.map((t) => (
                <button
                  key={t.code}
                  onClick={() => { setTemplateCode(t.code); setImportResult(null); setImportName(""); }}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] transition ${templateCode === t.code ? "bg-sky-500/20 text-sky-200" : "bg-black/20 tx3 hover:tx2"}`}
                >
                  {T(t.title)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] tx3">
              <span className={chip} dir="ltr">{template.code}</span>
              <span>{rtl ? "جدول هدف:" : "Target table:"}</span>
              <span className="font-mono tx2" dir="ltr">{template.targetTable}</span>
              <span>{rtl ? "کلید یکتا:" : "Natural key:"}</span>
              <span className="font-mono tx2" dir="ltr">{template.keyFields.join(" + ")}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => download(`${template.code}-fa.csv`, templateCsv(template, "fa"), "text/csv;charset=utf-8")}
                className="rounded-lg bg-sky-500/15 px-3 py-2 text-[11px] text-sky-300 transition hover:bg-sky-500/25"
              >
                {rtl ? "دانلود قالب فارسی" : "Download FA template"}
              </button>
              <button
                onClick={() => download(`${template.code}-en.csv`, templateCsv(template, "en"), "text/csv;charset=utf-8")}
                className="rounded-lg bg-black/20 px-3 py-2 text-[11px] tx2 transition hover:bg-black/30"
              >
                {rtl ? "دانلود قالب انگلیسی" : "Download EN template"}
              </button>
              <button
                onClick={() => tplInput.current?.click()}
                className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[11px] text-emerald-300 transition hover:bg-emerald-500/25"
              >
                {rtl ? "بارگذاری فایل تکمیل‌شده" : "Upload filled file"}
              </button>
              <input
                ref={tplInput}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f, (text, name) => { setImportResult(parseImport(template, text)); setImportName(name); });
                }}
              />
              {importName && <span className="text-[10px] tx2" dir="ltr">{importName}</span>}
            </div>
          </div>

          <div className={`${card} space-y-2`}>
            <h4 className="text-[11px] font-medium tx1">{rtl ? "راهنمای ستون‌ها" : "Column guide"}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <th className="px-2 py-1.5 text-start">{rtl ? "ستون" : "Column"}</th>
                    <th className="px-2 py-1.5 text-start">{rtl ? "اجباری" : "Required"}</th>
                    <th className="px-2 py-1.5 text-start">{rtl ? "نوع" : "Type"}</th>
                    <th className="px-2 py-1.5 text-start">{rtl ? "قاعده" : "Rule"}</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.map((g) => (
                    <tr key={g.column} className="border-b b-line-soft/40">
                      <td className="px-2 py-1 tx1">{g.column}</td>
                      <td className="px-2 py-1">{g.required ? <span className="text-rose-300">{rtl ? "بله" : "Yes"}</span> : <span className="tx3">{rtl ? "خیر" : "No"}</span>}</td>
                      <td className="px-2 py-1 font-mono text-[9.5px] tx2" dir="ltr">{g.kind}</td>
                      <td className="px-2 py-1 tx3">{g.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {importResult && (
            <div className={`${card} space-y-3`}>
              <h4 className="text-[11px] font-medium tx1">{rtl ? "گزارش اعتبارسنجی" : "Validation report"}</h4>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {[
                  { k: "total" as const, fa: "کل سطرها", en: "Rows" },
                  { k: "valid" as const, fa: "معتبر", en: "Valid" },
                  { k: "invalid" as const, fa: "نامعتبر", en: "Invalid" },
                  { k: "duplicates" as const, fa: "تکراری", en: "Duplicate" },
                  { k: "warnings" as const, fa: "هشدار", en: "Warnings" },
                ].map((m) => (
                  <div key={m.k} className="rounded-xl bg-black/20 p-2.5 text-center">
                    <div className={`text-[16px] font-light ${m.k === "invalid" && importResult.counts.invalid ? "text-rose-300" : "tx1"}`}>{importResult.counts[m.k]}</div>
                    <div className="text-[9px] font-extralight tx3">{rtl ? m.fa : m.en}</div>
                  </div>
                ))}
              </div>
              <IssueList issues={importResult.issues} rtl={rtl} />
              {importResult.rows.length > 0 && (
                <div className="thin-scroll max-h-60 overflow-auto">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-[var(--row)] tx3">
                      <tr className="border-b b-line-soft">
                        {Object.keys(importResult.rows[0]).map((k) => (
                          <th key={k} className="px-2 py-1.5 text-start font-mono text-[9px]" dir="ltr">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.rows.slice(0, 30).map((row, i) => (
                        <tr key={i} className="border-b b-line-soft/40">
                          {Object.keys(importResult.rows[0]).map((k) => (
                            <td key={k} className="px-2 py-1 tx2">{row[k] === null || row[k] === undefined ? "—" : String(row[k])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═════ OpenAPI ═════ */}
      {pane === "openapi" && (
        <div className="space-y-3">
          <div className={`${card} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-[11px] font-medium tx1">{rtl ? "قرارداد API تولیدشده از اسکیما" : "Schema-generated API contract"}</h4>
                <p className="mt-1 text-[10px] font-extralight tx3">
                  {rtl
                    ? `${pathCount} مسیر و ${Object.keys(spec.components.schemas).length} مدل، مستقیماً از ${SCHEMA.length} جدول sql-v1 — پس هرگز با کد واگرا نمی‌شود.`
                    : `${pathCount} paths and ${Object.keys(spec.components.schemas).length} models straight from ${SCHEMA.length} sql-v1 tables — so it cannot drift.`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(["yaml", "json"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] uppercase transition ${format === f ? "bg-sky-500/20 text-sky-200" : "bg-black/20 tx3 hover:tx2"}`}
                    dir="ltr"
                  >
                    {f}
                  </button>
                ))}
                <button
                  onClick={() => download(`arena-openapi.${format}`, specText, format === "json" ? "application/json;charset=utf-8" : "text/yaml;charset=utf-8")}
                  className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[10px] text-emerald-300 transition hover:bg-emerald-500/25"
                >
                  {rtl ? "دانلود" : "Download"}
                </button>
                <button
                  onClick={() => void navigator.clipboard?.writeText(specText)}
                  className="rounded-lg bg-black/20 px-3 py-1.5 text-[10px] tx2 transition hover:bg-black/30"
                >
                  {rtl ? "کپی" : "Copy"}
                </button>
              </div>
            </div>
            <pre className="thin-scroll max-h-[420px] overflow-auto rounded-xl bg-black/30 p-3 text-[9.5px] leading-relaxed tx2" dir="ltr">
              {specText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
