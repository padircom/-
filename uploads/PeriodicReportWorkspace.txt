import { useState } from "react";
import { type Lang } from "../data/framework";

type ReportKind = "weekly" | "monthly";
type TemplateKind = "internal" | "mandated";

type ReportTemplate = {
  id: string;
  name: { fa: string; en: string };
  format: string;
  revision: string;
  locked?: boolean;
};

type AnalysisItem = {
  label: { fa: string; en: string };
  value: string;
  tone: string;
};

const reportTemplates = (kind: ReportKind): Record<TemplateKind, ReportTemplate[]> => ({
  internal: [
    {
      id: `${kind}-int-1`,
      name: {
        fa: kind === "weekly" ? "قالب داخلی گزارش هفتگی" : "قالب داخلی گزارش ماهانه",
        en: kind === "weekly" ? "Internal Weekly Report Template" : "Internal Monthly Report Template",
      },
      format: "DOCX / XLSX",
      revision: "v2.1",
    },
    {
      id: `${kind}-int-2`,
      name: {
        fa: kind === "weekly" ? "قالب داشبورد هفتگی داخلی" : "قالب داشبورد ماهانه داخلی",
        en: kind === "weekly" ? "Internal Weekly Dashboard" : "Internal Monthly Dashboard",
      },
      format: "XLSX",
      revision: "v1.7",
    },
  ],
  mandated: [
    {
      id: `${kind}-mand-1`,
      name: {
        fa: kind === "weekly" ? "قالب ابلاغی گزارش هفتگی کارفرما" : "قالب ابلاغی گزارش ماهانه کارفرما",
        en: kind === "weekly" ? "Client Weekly Report Format" : "Client Monthly Report Format",
      },
      format: "DOCX / PDF",
      revision: "Rev-04",
      locked: true,
    },
    {
      id: `${kind}-mand-2`,
      name: {
        fa: kind === "weekly" ? "پیوست ابلاغی جداول هفتگی" : "پیوست ابلاغی جداول ماهانه",
        en: kind === "weekly" ? "Mandated Weekly Table Annex" : "Mandated Monthly Table Annex",
      },
      format: "XLSX",
      revision: "Rev-02",
      locked: true,
    },
  ],
});

const analysisItems = (kind: ReportKind): AnalysisItem[] => [
  {
    label: { fa: kind === "weekly" ? "پیشرفت هفته" : "پیشرفت ماه", en: kind === "weekly" ? "Weekly Progress" : "Monthly Progress" },
    value: kind === "weekly" ? "4.8%" : "17.5%",
    tone: "#34D399",
  },
  {
    label: { fa: "انحراف برنامه", en: "Schedule Variance" },
    value: kind === "weekly" ? "-2d" : "-8d",
    tone: "#FBBF24",
  },
  {
    label: { fa: "ریسک‌های باز", en: "Open Risks" },
    value: kind === "weekly" ? "6" : "14",
    tone: "#F87171",
  },
  {
    label: { fa: "اقلام نیازمند تصمیم", en: "Decision Items" },
    value: kind === "weekly" ? "3" : "7",
    tone: "#7FB2FF",
  },
];

const fmt = {
  word: { label: "Word", icon: "📄", color: "#2B5AA8", ext: ".docx" },
  excel: { label: "Excel", icon: "📊", color: "#217346", ext: ".xlsx" },
  pdf: { label: "PDF", icon: "📕", color: "#DC2626", ext: ".pdf" },
};

export default function PeriodicReportWorkspace({ lang, kind }: { lang: Lang; kind: ReportKind }) {
  const rtl = lang === "fa";
  const templates = reportTemplates(kind);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKind>("internal");
  const [files, setFiles] = useState<Record<string, string>>({});
  const [aiText, setAiText] = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState(kind === "weekly" ? "هفته ۱۸ / Week 18" : "اردیبهشت ۱۴۰۳ / May 2024");

  const title = rtl
    ? kind === "weekly" ? "گزارش هفتگی پروژه" : "گزارش ماهانه پروژه"
    : kind === "weekly" ? "Weekly Project Report" : "Monthly Project Report";
  const subtitle = rtl
    ? kind === "weekly" ? "قالب داخلی یا ابلاغی، تحلیل AI و خروجی مدیریتی" : "همان ساختار گزارش هفتگی با سربرگ ماهانه"
    : kind === "weekly" ? "Internal or mandated template, AI analysis and management export" : "Same weekly report flow with monthly headers";

  const importTemplate = (id: string, fileList: FileList | null) => {
    if (!fileList?.length) return;
    setFiles((prev) => ({ ...prev, [id]: fileList[0].name }));
  };

  const exportReport = (type: keyof typeof fmt) => {
    const f = fmt[type];
    const body = [
      `${title}`,
      `Period: ${period}`,
      `Template: ${selectedTemplate}`,
      `AI Analysis: ${aiResult ?? "not generated"}`,
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}_report${f.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const runAnalysis = () => {
    setBusy(true);
    window.setTimeout(() => {
      setAiResult(
        rtl
          ? kind === "weekly"
            ? "تحلیل هفتگی نشان می‌دهد عقب‌ماندگی اصلی مربوط به تأمین مصالح و محدودیت ماشین‌آلات است. پیشنهاد می‌شود منابع روزهای پایانی هفته بازتخصیص شوند."
            : "تحلیل ماهانه نشان می‌دهد روند تجمعی پیشرفت کمتر از برنامه پایه است. تمرکز اصلاحی باید روی فعالیت‌های بحرانی و ادعاهای تأخیر احتمالی باشد."
          : kind === "weekly"
            ? "Weekly analysis indicates the main delay drivers are material supply and equipment constraints. Reallocate resources in the final working days."
            : "Monthly analysis indicates cumulative progress is below baseline. Corrective focus should target critical activities and potential delay claims."
      );
      setBusy(false);
    }, 800);
  };

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark shrink-0 rounded-2xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10 text-[15px]">📑</span>
          <div>
            <h3 className="text-[12px] font-normal tx1">{title}</h3>
            <p className="text-[8.5px] font-extralight tx3">{subtitle}</p>
          </div>
          <label className="ms-auto flex items-center gap-1.5 text-[9px] font-extralight tx3">
            {rtl ? "دوره گزارش:" : "Report period:"}
            <input value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44 rounded-md border b-line-soft bg-[var(--row)] px-2 py-1 text-[9.5px] font-light tx1 outline-none focus:border-[var(--accent)]" />
          </label>
          <div className="toggle-shell flex items-center gap-1 rounded-lg p-[2px]">
            <button onClick={() => setSelectedTemplate("internal")} className={`rounded-md px-2 py-0.5 text-[9.5px] font-light transition ${selectedTemplate === "internal" ? "toggle-on tx1" : "tx3"}`}>
              {rtl ? "قالب داخلی" : "Internal"}
            </button>
            <button onClick={() => setSelectedTemplate("mandated")} className={`rounded-md px-2 py-0.5 text-[9.5px] font-light transition ${selectedTemplate === "mandated" ? "toggle-on tx1" : "tx3"}`}>
              {rtl ? "قالب ابلاغی" : "Mandated"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(340px,.9fr)_minmax(0,1.4fr)]">
        <section className="glass-dark flex min-h-0 flex-col rounded-2xl overflow-hidden">
          <header className="border-b b-line-soft px-3 py-2.5">
            <h4 className="text-[11px] font-normal tx1">{rtl ? "قالب‌های گزارش" : "Report Templates"}</h4>
            <p className="text-[8.5px] font-extralight tx3">{rtl ? "دو مدل قالب: داخلی و ابلاغی کارفرما" : "Two template models: internal and client-mandated"}</p>
          </header>
          <div className="thin-scroll flex-1 space-y-2 overflow-y-auto p-2">
            {(["internal", "mandated"] as TemplateKind[]).map((group) => (
              <div key={group} className="rounded-2xl border p-2" style={{ borderColor: group === "mandated" ? "rgba(245,158,11,.35)" : "rgba(127,178,255,.35)", background: group === "mandated" ? "rgba(245,158,11,.06)" : "rgba(127,178,255,.06)" }}>
                <div className="mb-2 flex items-center gap-2">
                  <span>{group === "mandated" ? "📌" : "🏢"}</span>
                  <span className="text-[10px] font-medium" style={{ color: group === "mandated" ? "#FBBF24" : "#7FB2FF" }}>
                    {group === "mandated" ? (rtl ? "قالب ابلاغی کارفرما" : "Client-Mandated") : (rtl ? "قالب داخلی" : "Internal Template")}
                  </span>
                  {group === "mandated" && <span className="ms-auto text-[8px] text-amber-300">🔒 {rtl ? "قفل" : "Locked"}</span>}
                </div>
                <div className="space-y-1.5">
                  {templates[group].map((tpl) => (
                    <label key={tpl.id} className="glass-row flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2">
                      <input type="file" hidden accept=".docx,.doc,.xlsx,.xls,.pdf" onChange={(e) => importTemplate(tpl.id, e.target.files)} />
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/5 text-[13px]">{tpl.locked ? "🔒" : "📄"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] font-light tx1">{tpl.name[lang]}</div>
                        <div className="mt-0.5 text-[8px] font-extralight tx4" dir="ltr">{tpl.format} · {tpl.revision}</div>
                        {files[tpl.id] && <div className="mt-0.5 truncate text-[8px] font-light text-emerald-300" dir="ltr">✓ {files[tpl.id]}</div>}
                      </div>
                      <span className="rounded border b-line-soft px-1.5 py-0.5 text-[8px] font-light tx2">{rtl ? "ایمپورت" : "Import"}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="glass-dark shrink-0 rounded-2xl p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-normal tx1">✨ {rtl ? "تحلیل هوش مصنوعی" : "AI Analysis"}</span>
              <span className="text-[8.5px] font-extralight tx3">{rtl ? "خلاصه مدیریتی، ریسک‌ها و پیشنهاد اصلاحی" : "Executive summary, risks and corrective actions"}</span>
              <div className="ms-auto flex items-center gap-1.5">
                {(Object.keys(fmt) as (keyof typeof fmt)[]).map((key) => {
                  const f = fmt[key];
                  return (
                    <button key={key} onClick={() => exportReport(key)} className="rounded-lg border px-2 py-1 text-[9.5px] font-light transition hover:-translate-y-px" style={{ borderColor: `${f.color}66`, background: `${f.color}12`, color: f.color }}>
                      {f.icon} {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder={rtl ? "نکات خام گزارش، رخدادها، انحرافات و توضیحات مدیریتی را وارد کنید…" : "Enter raw report notes, events, variances and management comments…"} className="h-20 w-full resize-none rounded-xl border b-line-soft bg-[var(--row)] px-3 py-2 text-[10.5px] font-light tx1 outline-none focus:border-[var(--accent)]" />
            <div className="mt-2 flex items-center gap-2">
              <button onClick={runAnalysis} disabled={busy} className="rounded-lg border border-fuchsia-400/55 bg-fuchsia-400/10 px-3 py-1.5 text-[10px] font-light text-fuchsia-300 transition hover:bg-fuchsia-400/20 disabled:opacity-45">
                {busy ? (rtl ? "در حال تحلیل…" : "Analyzing…") : (rtl ? "اجرای تحلیل AI" : "Run AI Analysis")}
              </button>
              <span className="text-[8.5px] font-extralight tx4">{rtl ? "خروجی‌ها: Word / Excel / PDF" : "Exports: Word / Excel / PDF"}</span>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-4 gap-2">
            {analysisItems(kind).map((item) => (
              <div key={item.label.en} className="glass-dark rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full" style={{ background: item.tone }} />
                  <span className="truncate text-[9px] font-extralight tx3">{item.label[lang]}</span>
                </div>
                <div className="mt-2 text-[18px] font-light tabular-nums tx1" dir="ltr">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-4">
            <h4 className="text-[11px] font-normal tx1">{rtl ? "خروجی تحلیل" : "Analysis Output"}</h4>
            <div className="mt-3 min-h-0 flex-1 rounded-xl border b-line-soft bg-black/10 p-4 text-[11px] font-light leading-6 tx2">
              {aiResult ?? (rtl ? "هنوز تحلیلی اجرا نشده است. قالب را انتخاب و نکات گزارش را وارد کنید." : "No analysis has been generated yet. Select a template and enter report notes.")}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}