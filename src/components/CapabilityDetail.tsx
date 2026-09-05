import { useRef, useState } from "react";
import {
  domains,
  domainExportFormats,
  formatMeta,
  t,
  type FormatKind,
  type Lang,
} from "../data/framework";
import { useSystem } from "../context/SystemContext";
import { pmisApiClient } from "../services/pmisApiClient";
import DailyReportWorkspace from "./DailyReportWorkspace";
import PeriodicReportWorkspace from "./PeriodicReportWorkspace";
import MonitoringWorkspace from "./MonitoringWorkspace";
import RiskClaimsWorkspace from "./RiskClaimsWorkspace";
import AdminWorkspace from "./AdminWorkspace";

type Props = {
  lang: Lang;
  domainId: string;
  clusterId: string;
  projectId: string;
  processId: string;
  subId: string;
  onBack: () => void;
};

type Template = {
  id: string;
  name: string;
  version: string;
  size: string;
  format: FormatKind;
  updated: string;
  locked?: boolean;
};

type Activity = {
  id: string;
  name: { fa: string; en: string };
  startDay: number;
  duration: number;
  progress: number;
  critical: boolean;
  resource: string;
};

const initialActivities: Activity[] = [
  { id: "act1", name: { fa: "مطالعات مقدماتی و تجهیز کارگاه", en: "Mobilization & Site Prep" }, startDay: 1, duration: 8, progress: 90, critical: true, resource: "Eng. Team" },
  { id: "act2", name: { fa: "طراحی تفصیلی فونداسیون", en: "Foundation Detailed Design" }, startDay: 9, duration: 12, progress: 65, critical: true, resource: "Civil Dept" },
  { id: "act3", name: { fa: "خرید لوله‌ها و اقلام پایپینگ", en: "Piping Material Procurement" }, startDay: 14, duration: 20, progress: 30, critical: false, resource: "Procurement" },
  { id: "act4", name: { fa: "گودبرداری و بتن‌ریزی فونداسیون", en: "Excavation & Concreting" }, startDay: 21, duration: 15, progress: 10, critical: true, resource: "Civil Contractor" },
  { id: "act5", name: { fa: "نصب تجهیزات مکانیکی و پایپینگ", en: "Mechanical Installation" }, startDay: 36, duration: 18, progress: 0, critical: true, resource: "Mech. Contractor" },
  { id: "act6", name: { fa: "راه‌اندازی و تست سرد سیستم", en: "Cold Commissioning & Testing" }, startDay: 54, duration: 7, progress: 0, critical: false, resource: "Commissioning Team" },
];

const seedInternal = (subId: string): Template[] => [
  { id: `${subId}-i1`, name: "Internal_Master_Template_v3", version: "v3.2", size: "128 KB", format: "excel", updated: "1403/02/14" },
  { id: `${subId}-i2`, name: "Internal_Report_Skeleton",    version: "v2.0", size: "84 KB",  format: "word",  updated: "1403/02/10" },
];

const seedClient = (subId: string): Template[] => [
  { id: `${subId}-c1`, name: "Client_Mandatory_Form_A",  version: "Rev-04", size: "210 KB", format: "pdf",   updated: "1403/02/11", locked: true },
];

export default function CapabilityDetail({
  lang, domainId, clusterId, projectId, processId, subId, onBack,
}: Props) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster } = useSystem();
  const dom = domains.find((d) => d.id === domainId);
  const cluster = clusters.find((c) => c.id === clusterId);
  const project = (projectsByCluster[clusterId] ?? []).find((p) => p.id === projectId);
  const proc = dom?.processes.find((p) => p.id === processId);
  const sub = proc?.subs.find((s) => s.id === subId);

  const [internal, setInternal] = useState<Template[]>(() => seedInternal(subId));
  const [client, setClient] = useState<Template[]>(() => seedClient(subId));
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiThread, setAiThread] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const [planMethod, setPlanMethod] = useState<"ai-contract" | "import">("ai-contract");
  const [contractText, setContractText] = useState("");
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);
  const [docLang, setDocLang] = useState<"en" | "fa">("en");
  const [isTranslated, setIsTranslated] = useState(false);
  const [importedFile, setImportedFile] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);

  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const clientInputRef = useRef<HTMLInputElement | null>(null);
  const docUploadRef = useRef<HTMLInputElement | null>(null);
  const scheduleUploadRef = useRef<HTMLInputElement | null>(null);

  if (!dom || !proc || !sub) return null;
  const formats = domainExportFormats[dom.id] ?? ["excel", "pdf"];

  const handleImport = (kind: "internal" | "client", files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    const added: Template = {
      id: `${subId}-${kind}-${Date.now()}`,
      name: f.name.replace(/\.[^.]+$/, ""),
      version: kind === "client" ? "Rev-01" : "v1.0",
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      format: f.name.toLowerCase().endsWith(".xer") ? "xer" : "excel",
      updated: new Date().toLocaleDateString(rtl ? "fa-IR" : "en-GB"),
      locked: kind === "client",
    };
    if (kind === "internal") setInternal((prev) => [added, ...prev]);
    else setClient((prev) => [added, ...prev]);
  };

  const handleExport = (fmt: FormatKind) => {
    const info = formatMeta[fmt];
    const filename = `${dom.id}_${proc.id}_${sub.id}_${cluster?.id ?? "cluster"}_${project?.code ?? "prj"}${info.ext}`;
    const blob = new Blob(
      [
        `Export\n`,
        `Domain: ${t(dom.title, lang)}\n`,
        `Process: ${t(proc.title, lang)}\n`,
        `Sub-process: ${t(sub.title, lang)}\n`,
        `SQL: ${sub.sql.join(", ")}\n`,
      ],
      { type: "text/plain;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  };

  const askAI = async () => {
    const q = aiInput.trim();
    if (!q || busy) return;
    setAiThread((p) => [...p, { role: "user", text: q }]);
    setAiInput(""); setBusy(true);
    try {
      const result = await pmisApiClient.runAi({ prompt: q, context: { domainId, clusterId, projectId, processId, subId } });
      const answer = (result.message as string) || (rtl ? "پاسخ AI دریافت شد." : "AI response received.");
      setAiThread((p) => [...p, { role: "ai", text: answer }]);
    } catch {
      const answer =
        rtl
          ? `بر اساس اسناد بارگذاری‌شده و جدول‌های ${sub.sql.join(", ")}، خط بحرانی پروژه تحلیل شد و قالب مربوطه آماده انطباق است.`
          : `Based on the uploaded contract and ${sub.sql.join(", ")} tables, the critical path was analyzed and templates are synced.`;
      setAiThread((p) => [...p, { role: "ai", text: answer }]);
    } finally {
      setBusy(false);
    }
  };

  const handleDocUpload = (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    setUploadedDocName(file.name);
    setIsTranslated(false);
    
    // Simulate auto-detecting language (english as default mock)
    const isEn = !file.name.match(/[\u0600-\u06FF]/);
    setDocLang(isEn ? "en" : "fa");

    // mock seed content based on standard templates
    if (isEn) {
      setContractText(
        `CONSTRUCTION CONTRACT - SECTION 4:\n` +
        `The Contractor shall mobilize on site within 10 days of sign-off. Detailed Foundation design and engineering must be delivered in civil format within 14 days. Pipeline procurement starts in week 3. Phase 1 cold commissioning is scheduled for day 54.`
      );
    } else {
      setContractText(
        `پیمان ساخت و تجهیز کارگاه - بند ۴:\n` +
        `پیمانکار مکلف به تجهیز کارگاه ظرف ۱۰ روز است. نقشه‌های فونداسیون تفصیلی باید ظرف ۱۴ روز ارائه شود. خرید لوله‌ها از هفته ۳ آغاز شده و راه‌اندازی آزمایشی فاز ۱ در روز ۵۴ زمان‌بندی شده است.`
      );
    }
  };

  const handleTranslate = () => {
    if (!contractText.trim() || busy) return;
    setBusy(true);
    setTimeout(() => {
      if (docLang === "en") {
        setDocLang("fa");
        setContractText(
          `[ترجمه تخصصی شده به فارسی]:\n` +
          `قرارداد احداث - بخش ۴:\n` +
          `پیمانکار باید ظرف ۱۰ روز پس از امضا، در کارگاه تجهیز کند. طراحی تفصیلی و مهندسی فونداسیون باید در فرمت سیویل ظرف ۱۴ روز تحویل داده شود. تامین لوله‌کشی از هفته سوم آغاز می‌شود. راه‌اندازی آزمایشی سرد فاز ۱ برای روز ۵۴ برنامه‌ریزی شده است.`
        );
      } else {
        setDocLang("en");
        setContractText(
          `[Expert Translation to English]:\n` +
          `Construction & Mobilization Contract - Clause 4:\n` +
          `The contractor is obliged to mobilize the workshop within 10 days. Detailed foundation designs must be provided within 14 days. Pipe procurement starts from week 3 and phase 1 cold commissioning is scheduled for day 54.`
        );
      }
      setIsTranslated(true);
      setBusy(false);
    }, 1100);
  };

  const handleAIBalance = () => {
    setBusy(true);
    setTimeout(() => {
      setActivities((prev) =>
        prev.map((act) => {
          if (act.critical && act.duration > 10) {
            return { ...act, duration: act.duration - 2, progress: Math.min(100, act.progress + 5), resource: `${act.resource} (Balanced)` };
          }
          return act;
        })
      );
      setAiThread((p) => [
        ...p,
        {
          role: "ai",
          text: rtl
            ? "نمودار زمان‌بندی بر اساس محدودیت منابع و خط بحرانی تحلیل شد. فعالیت‌های بحرانی فونداسیون و دپارتمان سیویل متعادل و مدت زمان آنها ۲ روز کاهش یافت."
            : "Schedule successfully balanced. Critical civil activities adjusted to level resource allocation and reduce critical path by 2 days.",
        },
      ]);
      setBusy(false);
    }, 1200);
  };

  const generateWbsFromContract = () => {
    if (!contractText.trim()) return;
    setBusy(true);
    setTimeout(() => {
      const generated: Activity[] = [
        { id: "g1", name: { fa: "مطالعه اسناد پیمان و تحلیل ریسک اولیه", en: "Contract Document Review & Risk Analysis" }, startDay: 1, duration: 5, progress: 10, critical: true, resource: "PMO" },
        { id: "g2", name: { fa: "طراحی تفصیلی مطابق بند ۴.۲ قرارداد", en: "Detailed Design per Clause 4.2" }, startDay: 6, duration: 14, progress: 0, critical: true, resource: "Engineering" },
        { id: "g3", name: { fa: "خرید تجهیزات موضوع الحاقیه الف", en: "Procurement of Annex A Equipment" }, startDay: 20, duration: 25, progress: 0, critical: false, resource: "Supply Chain" },
        { id: "g4", name: { fa: "ساخت و راه‌اندازی آزمایشی فاز ۱", en: "Phase 1 Construction & Pilot Commissioning" }, startDay: 45, duration: 20, progress: 0, critical: true, resource: "Operations" },
      ];
      setActivities(generated);
      setAiThread((p) => [
        ...p,
        {
          role: "ai",
          text: rtl
            ? "قرارداد با موفقیت تحلیل شد. ساختار شکست کار (WBS) در ۴ فعالیت کلیدی با مشورت استانداردهای PMBOK استخراج و روی نمودار گنجانده شد."
            : "Contract parsed. WBS successfully generated with 4 key milestones based on clause rules and integrated onto the online Gantt chart.",
        },
      ]);
      setBusy(false);
    }, 1500);
  };

  const simulateScheduleImport = async (filename: string) => {
    setImportedFile(filename);
    setBusy(true);
    try {
      await pmisApiClient.importSchedule(projectId || "PRJ-01", {
        sourceSystem: filename.endsWith(".mpp") ? "msp" : "primavera",
        fileName: filename,
      });
    } catch {
      // ignore
    }
    setActivities([
      { id: "imp1", name: { fa: "تجهیز کارگاه - ایمپورت شده از Primavera", en: "Site Mobilization - Imported from P6" }, startDay: 1, duration: 10, progress: 100, critical: false, resource: "Subcontractor" },
      { id: "imp2", name: { fa: "عملیات بتن‌ریزی مخازن ذخیره", en: "Storage Tank Concrete Operations" }, startDay: 11, duration: 18, progress: 40, critical: true, resource: "Civil Contractor" },
      { id: "imp3", name: { fa: "نصب هدرهای اصلی لوله‌کشی", en: "Main Piping Headers Erection" }, startDay: 29, duration: 22, progress: 5, critical: true, resource: "Piping Team" },
      { id: "imp4", name: { fa: "تست هیدرو استاتیک و بازرسی فنی", en: "Hydrostatic Testing & Inspection" }, startDay: 51, duration: 6, progress: 0, critical: false, resource: "QC Team" },
    ]);
    setBusy(false);
  };

  const importScheduleFile = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    setImportedFile(file.name);
    setBusy(true);
    try {
      const result = await pmisApiClient.uploadScheduleFile(projectId || "PRJ-01", file);
      const preview = Array.isArray(result.preview) ? result.preview : [];
      if (preview.length) {
        setActivities(preview.slice(0, 12).map((row: any, index: number) => ({
          id: `api-${index}`,
          name: { fa: row.name || row.code || `فعالیت ${index + 1}`, en: row.name || row.code || `Activity ${index + 1}` },
          startDay: Math.max(1, index * 5 + 1),
          duration: Number(row.durationDays || 5),
          progress: Number(row.progress || 0),
          critical: Boolean(row.isCritical),
          resource: row.wbsCode || "Schedule Import",
        })));
      }
      setAiThread((p) => [...p, {
        role: "ai",
        text: rtl
          ? `برنامه ${file.name} از طریق Backend تحلیل شد و ${result.importedActivities ?? preview.length} فعالیت استخراج شد.`
          : `Schedule ${file.name} parsed via backend and ${result.importedActivities ?? preview.length} activities were extracted.`,
      }]);
    } catch (error) {
      setAiThread((p) => [...p, {
        role: "ai",
        text: error instanceof Error ? error.message : (rtl ? "خطای ایمپورت برنامه" : "Schedule import error"),
      }]);
    } finally {
      setBusy(false);
    }
  };

  const updateActivityDuration = (id: string, dur: number) => {
    setActivities((prev) =>
      prev.map((act) => (act.id === id ? { ...act, duration: Math.max(1, dur) } : act))
    );
  };

  return (
    <div className="glass flex h-full min-h-0 flex-col rounded-2xl p-5" dir={rtl ? "rtl" : "ltr"}>
      {/* Top bar */}
      <header className="b-line-soft mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-3">
        <button onClick={onBack} className="glass-row flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10.5px] font-light tx2 transition hover:tx1">
          <span className={rtl ? "" : "rotate-180"}>→</span>
          {rtl ? "بازگشت به حوزه" : "Back to domain"}
        </button>
        {cluster && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px]"
                style={{ background: `${cluster.color}1f`, border: `1px solid ${cluster.color}55` }}>
            {cluster.icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            {cluster && (
              <h1 className="truncate text-[20px] font-semibold leading-tight" style={{ color: cluster.color }}>
                {t(cluster.title, lang)}
              </h1>
            )}
            <span className="text-[16px] font-light tx4">/</span>
            {project && (
              <h2 className="truncate text-[19px] font-semibold leading-tight tx1">{t(project.name, lang)}</h2>
            )}
          </div>
          {project && (
            <p className="mt-1 truncate text-[10px] font-extralight tx3">
              <span dir="ltr">{project.code}</span> · {t(project.client, lang)} · {t(project.location, lang)}
            </p>
          )}
        </div>
      </header>

      {/* 4 metadata cards */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
          <div className="text-[8.5px] font-extralight tx4">{rtl ? "منبع داده" : "Data Source"}</div>
          <div className="mt-1 text-[10.5px] font-light tx1" dir="ltr">{sub.source}</div>
        </div>
        <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-3">
          <div className="text-[8.5px] font-extralight text-sky-300/70">🗄 SQL Server Tables</div>
          <div className="mt-1 space-y-0.5" dir="ltr">
            {sub.sql.map((tbl) => (<div key={tbl} className="text-[10.5px] font-light text-sky-300">{tbl}</div>))}
          </div>
        </div>
        <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
          <div className="text-[8.5px] font-extralight tx4">{rtl ? "خروجی → اتصال" : "Output → Connect"}</div>
          <div className="mt-1 text-[10.5px] font-light tx1" dir="ltr">{sub.output}</div>
          <div className="mt-0.5 text-[9px] font-extralight tx3" dir="ltr">→ {sub.connectsTo}</div>
        </div>
        <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/5 p-3">
          <div className="text-[8.5px] font-extralight text-fuchsia-300/70">✨ AI Function</div>
          <div className="mt-1 text-[10.5px] font-light text-fuchsia-300" dir="ltr">{sub.ai}</div>
          <button onClick={() => setAiOpen(true)} className="mt-2 w-full rounded-md border border-fuchsia-400/40 bg-fuchsia-400/10 px-2 py-1 text-[9.5px] font-light text-fuchsia-200 transition hover:bg-fuchsia-400/20">
            {rtl ? "اجرای AI" : "Run AI"}
          </button>
        </div>
      </div>

      {domainId === "d2" && subId !== "d2-p4-s1" && subId !== "d2-p5-s1" && subId !== "d2-p6-s1" ? (
        /* SPECIAL GANTT & SCHEDULING STUDIO WITH INTEGRATED TRANSLATION & UPLOAD */
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">

          {/* ═══ Workspace tools bar (also available in planning) ═══ */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border b-line-soft bg-[var(--row)] px-3 py-2">
            <span className="text-[10px] font-normal tx2">{rtl ? "ابزار محیط کاری:" : "Workspace tools:"}</span>

            <input ref={internalInputRef} type="file" hidden multiple onChange={(e) => handleImport("internal", e.target.files)} />
            <input ref={clientInputRef}   type="file" hidden multiple onChange={(e) => handleImport("client",   e.target.files)} />
            <button onClick={() => internalInputRef.current?.click()}
                    className="glass-row flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-light tx1 transition hover:-translate-y-px">
              ⬆ {rtl ? "ایمپورت به قالب داخلی" : "Import → Internal"}
            </button>
            <button onClick={() => clientInputRef.current?.click()}
                    className="glass-row flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-light tx1 transition hover:-translate-y-px">
              ⬆ {rtl ? "ایمپورت قالب ابلاغی" : "Import → Client"}
            </button>

            <span className="mx-1 h-5 w-px hline" />

            <span className="text-[9.5px] font-extralight tx3">{rtl ? "خروجی:" : "Export:"}</span>
            {formats.map((f) => {
              const m = formatMeta[f];
              return (
                <button key={f} onClick={() => handleExport(f)}
                        title={`${m.label} ${m.ext}`}
                        className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-light transition hover:-translate-y-px"
                        style={{ borderColor: `${m.color}66`, background: `${m.color}12`, color: m.color }}>
                  {m.icon} {m.label}
                </button>
              );
            })}

            <span className="mx-1 h-5 w-px hline" />

            <button onClick={() => setAiOpen((o) => !o)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-light transition ${aiOpen ? "border-fuchsia-400 bg-fuchsia-400/15 text-fuchsia-200" : "border-fuchsia-400/40 bg-fuchsia-400/8 text-fuchsia-300 hover:bg-fuchsia-400/15"}`}>
              ✨ {rtl ? "مشاوره هوش مصنوعی" : "AI Advisor"}
            </button>

            {/* quick jump to contract upload */}
            <button onClick={() => { setPlanMethod("ai-contract"); docUploadRef.current?.click(); }}
                    className="ms-auto flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-400/12 px-2.5 py-1.5 text-[10px] font-light text-amber-300 transition hover:bg-amber-400/20">
              📄 {rtl ? "بارگذاری مدارک قراردادی" : "Upload Contract Docs"}
            </button>
          </div>

          <div className="glass-dark flex shrink-0 flex-col gap-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b b-line-soft pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px]">⏱</span>
                <span className="text-[12px] font-medium tx1">
                  {rtl ? "کارگاه کنترل پروژه" : "Project Control Workshop"}
                </span>
              </div>
              
              <div className="toggle-shell flex items-center gap-1 rounded-xl p-[3px]">
                <button
                  onClick={() => setPlanMethod("ai-contract")}
                  className={`rounded-lg px-3 py-1 text-[10.5px] font-light transition ${
                    planMethod === "ai-contract" ? "toggle-on tx1" : "tx3"
                  }`}
                >
                  {rtl ? "۱. بارگذاری قرارداد و طراحی WBS با هوش مصنوعی" : "1. Contract File to WBS with AI"}
                </button>
                <button
                  onClick={() => setPlanMethod("import")}
                  className={`rounded-lg px-3 py-1 text-[10.5px] font-light transition ${
                    planMethod === "import" ? "toggle-on tx1" : "tx3"
                  }`}
                >
                  {rtl ? "۲. واردات برنامه از Primavera P6 / MSP" : "2. Import from P6 / MSP"}
                </button>
              </div>
            </div>

            {planMethod === "ai-contract" ? (
              <div className="fade-rise flex flex-col gap-3">

                {/* ── Contract document upload box (per screenshot) ── */}
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-3">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-400/50 bg-amber-400/15 text-[15px]">📄</span>
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-normal text-amber-300">
                        {rtl ? "بارگذاری مدارک قراردادی" : "Contract Document Upload"}
                      </div>
                      <div className="text-[8.5px] font-extralight tx3">
                        {rtl ? "فایل قرارداد PDF / DOCX با ترجمه تخصصی" : "PDF / DOCX contract file with expert translation"}
                      </div>
                    </div>

                    {/* file name field */}
                    <input
                      readOnly
                      value={uploadedDocName ?? ""}
                      placeholder={rtl ? "نام فایل قراردادی…" : "Contract file name…"}
                      onClick={() => docUploadRef.current?.click()}
                      className="ms-2 h-8 min-w-[160px] flex-1 cursor-pointer rounded-lg border b-line-soft bg-black/25 px-2.5 text-[10px] font-light tx1 outline-none"
                    />

                    {/* target language switch */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[9px] font-extralight tx3">{rtl ? "زبان مقصد:" : "Target:"}</span>
                      <div className="toggle-shell flex items-center gap-1 rounded-lg p-[2px]">
                        <button onClick={() => setDocLang("fa")}
                                className={`rounded-md px-2 py-1 text-[9.5px] font-light transition ${docLang === "fa" ? "toggle-on tx1" : "tx3"}`}>
                          فارسی
                        </button>
                        <button onClick={() => setDocLang("en")}
                                className={`rounded-md px-2 py-1 text-[9.5px] font-light transition ${docLang === "en" ? "toggle-on tx1" : "tx3"}`}>
                          English
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* drag & drop + translate + send */}
                  <input
                    ref={docUploadRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    hidden
                    onChange={(e) => handleDocUpload(e.target.files)}
                  />
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleDocUpload(e.dataTransfer.files); }}
                    onClick={() => docUploadRef.current?.click()}
                    className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-amber-400/40 bg-gradient-to-l from-amber-500/25 to-amber-600/25 text-[11px] font-light text-amber-100 transition hover:from-amber-500/40 hover:to-amber-600/40"
                  >
                    {rtl ? "درگ فایل  +  ترجمه تخصصی و ارسال" : "Drag file  +  expert translation & send"}
                  </div>

                  {/* status strip */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[8.5px] font-extralight tx3">
                    <span className="pulse-dot h-[6px] w-[6px] rounded-full bg-emerald-400" />
                    <span dir="ltr">🗄 SQL Server (.\SQL2008EXPRESS)</span>
                    <span className="tx4">·</span>
                    <span>
                      {uploadedDocName
                        ? <span className="text-emerald-400">✓ {uploadedDocName}</span>
                        : (rtl ? "هیچ فایلی انتخاب نشده" : "No file selected")}
                    </span>
                    <span className="tx4">·</span>
                    <span>{rtl ? "زبان مقصد" : "target"}: <b>{docLang === "fa" ? "فارسی" : "English"}</b></span>
                    {isTranslated && (
                      <span className="text-emerald-400">✓ {rtl ? "ترجمه و همگام‌سازی شد" : "Translated & synced"}</span>
                    )}
                  </div>
                </div>

                {/* ── Contract text + actions ── */}
                <div className="flex flex-col gap-3 lg:flex-row">
                  <div className="flex flex-1 flex-col gap-2">
                    <textarea
                      value={contractText}
                      onChange={(e) => setContractText(e.target.value)}
                      placeholder={
                        rtl
                          ? "متن قرارداد به هر زبانی (انگلیسی یا فارسی) را بارگذاری یا کپی کنید. برای ترجمه تخصصی دکمه‌ی مترجم را بزنید..."
                          : "Paste or upload the contract text. Use the Translator button for bilingual translation..."
                      }
                      className="h-16 w-full resize-none rounded-xl border b-line-soft bg-black/20 p-2 text-[10.5px] font-light tx1 outline-none focus:border-[var(--accent)]"
                    />
                    {contractText.trim() && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[8.5px] tx4">
                          {rtl ? "زبان شناسایی شده:" : "Detected:"} <b>{docLang.toUpperCase()}</b>
                        </span>
                        <button
                          onClick={handleTranslate}
                          disabled={busy}
                          className="rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-1 text-[9.5px] font-normal text-sky-200 transition hover:bg-sky-400/25 disabled:opacity-40"
                        >
                          🔄 {rtl ? "مترجم تخصصی دو زبانه (FA ⇄ EN)" : "Bilingual Translator (FA ⇄ EN)"}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={generateWbsFromContract}
                    disabled={busy || !contractText.trim()}
                    className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-fuchsia-400/50 bg-fuchsia-400/10 px-4 py-3 text-center text-[11px] font-light text-fuchsia-300 transition hover:bg-fuchsia-400/20 disabled:opacity-40"
                  >
                    <span>✨</span>
                    <span>{rtl ? "استخراج WBS با AI" : "Extract WBS via AI"}</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="fade-rise flex flex-wrap items-center gap-3">
                <input ref={scheduleUploadRef} type="file" hidden accept=".xer,.xml,.xlsx,.xls,.csv,.mpp" onChange={(e) => importScheduleFile(e.target.files)} />
                <button
                  onClick={() => scheduleUploadRef.current?.click()}
                  className="glass-row flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-light text-emerald-300 hover:border-emerald-400"
                >
                  <span>⬆</span>
                  {rtl ? "ایمپورت واقعی فایل برنامه (XER/XLSX/CSV/MPP)" : "Import real schedule file (XER/XLSX/CSV/MPP)"}
                </button>
                <button
                  onClick={() => simulateScheduleImport("Baseline_SouthAzadegan_Rev12.xer")}
                  className="glass-row flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-light text-sky-300 hover:border-sky-400"
                >
                  <span>📂</span>
                  {rtl ? "بارگذاری فایل Primavera P6 (.xer)" : "Import Primavera P6 (.xer)"}
                </button>
                <button
                  onClick={() => simulateScheduleImport("Schedule_Phase3_MSP.mpp")}
                  className="glass-row flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-light text-sky-300 hover:border-sky-400"
                >
                  <span>📂</span>
                  {rtl ? "بارگذاری فایل MS Project (.mpp)" : "Import MS Project (.mpp)"}
                </button>
                {importedFile && (
                  <span className="text-[10px] text-emerald-400 font-normal">
                    ✓ {rtl ? "فایل بارگذاری شد:" : "File loaded:"} {importedFile}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
            
            <div className="glass-dark flex w-full flex-col rounded-2xl p-3 lg:w-[280px]">
              <div className="mb-2.5 flex items-center justify-between border-b b-line-soft pb-2">
                <span className="text-[10.5px] font-normal tx1">{rtl ? "تعدیل دستی و تراز هوشمند" : "Manual & AI Adjustments"}</span>
                <button
                  onClick={handleAIBalance}
                  disabled={busy}
                  className="rounded-lg border border-emerald-400 bg-emerald-400/10 px-2 py-1 text-[9.5px] font-medium text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40"
                >
                  {rtl ? "تراز هوشمند AI" : "AI Stabilize & Level"}
                </button>
              </div>

              <div className="thin-scroll flex-1 space-y-2.5 overflow-y-auto pr-1">
                {activities.map((act) => (
                  <div key={act.id} className="rounded-xl border b-line-soft bg-black/10 p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate text-[10px] font-normal tx1">{t(act.name, lang)}</span>
                      {act.critical && (
                        <span className="rounded bg-rose-500/20 px-1 text-[7.5px] text-rose-400">
                          {rtl ? "بحرانی" : "Critical"}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[8.5px] font-extralight tx3">{rtl ? "مدت زمان:" : "Duration:"}</span>
                      <input
                        type="range"
                        min="2"
                        max="40"
                        value={act.duration}
                        onChange={(e) => updateActivityDuration(act.id, parseInt(e.target.value))}
                        className="h-1 flex-1 cursor-ew-resize rounded-lg bg-[var(--ring-track)] accent-[var(--accent)]"
                      />
                      <span className="w-8 text-end text-[9.5px] font-normal tabular-nums tx2">{act.duration} {rtl ? "روز" : "d"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-normal tx2">{rtl ? "نمودار گانت زمان‌بندی تعاملی" : "Live Interactive Gantt Chart"}</span>
              </div>

              <div className="thin-scroll flex-1 overflow-auto">
                <div className="min-w-[600px] space-y-2">
                  <div className="flex border-b b-line-soft pb-1 text-[8.5px] font-extralight tx3">
                    <div className="w-[180px] shrink-0">{rtl ? "نام فعالیت" : "Activity Name"}</div>
                    <div className="flex-1 grid grid-cols-6 gap-1 text-center">
                      <div>{rtl ? "دهه ۱" : "Day 1-10"}</div>
                      <div>{rtl ? "دهه ۲" : "Day 11-20"}</div>
                      <div>{rtl ? "دهه ۳" : "Day 21-30"}</div>
                      <div>{rtl ? "دهه ۴" : "Day 31-40"}</div>
                      <div>{rtl ? "دهه ۵" : "Day 41-50"}</div>
                      <div>{rtl ? "دهه ۶" : "Day 51-60+"}</div>
                    </div>
                  </div>

                  {activities.map((act) => {
                    const startPct = Math.min(90, (act.startDay / 60) * 100);
                    const durPct = Math.min(100 - startPct, (act.duration / 60) * 100);
                    return (
                      <div key={act.id} className="flex items-center text-[10px] py-1 hover:bg-white/[0.02] rounded">
                        <div className="w-[180px] shrink-0 truncate pr-2 font-light tx1" title={t(act.name, lang)}>
                          {t(act.name, lang)}
                        </div>
                        <div className="flex-1 relative h-6 rounded-lg bg-black/15 overflow-hidden">
                          <div
                            className="absolute h-full rounded transition-all duration-300"
                            style={{
                              left: `${startPct}%`,
                              width: `${durPct}%`,
                              background: act.critical
                                ? "linear-gradient(90deg, #F87171 0%, #EF4444 100%)"
                                : "linear-gradient(90deg, #60A5FA 0%, #3B82F6 100%)",
                            }}
                          >
                            <div className="h-0.5 bg-white/40" style={{ width: `${act.progress}%` }} />
                            <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-medium text-white px-1 truncate">
                              {act.duration} {rtl ? "روز" : "d"} ({act.progress}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
          </div>
        </div>
      ) : domainId === "d2" && subId === "d2-p4-s1" ? (
        <DailyReportWorkspace lang={lang} />
      ) : domainId === "d2" && subId === "d2-p5-s1" ? (
        <PeriodicReportWorkspace lang={lang} kind="weekly" />
      ) : domainId === "d2" && subId === "d2-p6-s1" ? (
        <PeriodicReportWorkspace lang={lang} kind="monthly" />
      ) : domainId === "d3" ? (
        <MonitoringWorkspace lang={lang} />
      ) : domainId === "d4" ? (
        <RiskClaimsWorkspace lang={lang} subId={subId} />
      ) : domainId === "d7" ? (
        <AdminWorkspace lang={lang} subId={subId} onBack={onBack} />
      ) : (
        /* STANDARD DOCUMENT WORKSPACE FOR ALL OTHER DOMAINS */
        <>
          <div className="mt-4 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border b-line-soft bg-[var(--row)] px-3 py-2">
            <span className="text-[10px] font-normal tx2">{rtl ? "ابزار محیط کاری:" : "Workspace tools:"}</span>

            <input ref={internalInputRef} type="file" hidden multiple onChange={(e) => handleImport("internal", e.target.files)} />
            <input ref={clientInputRef}   type="file" hidden multiple onChange={(e) => handleImport("client",   e.target.files)} />
            <button onClick={() => internalInputRef.current?.click()}
                    className="glass-row flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-light tx1 transition hover:-translate-y-px">
              ⬆ {rtl ? "ایمپورت به قالب داخلی" : "Import → Internal"}
            </button>
            <button onClick={() => clientInputRef.current?.click()}
                    className="glass-row flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-light tx1 transition hover:-translate-y-px">
              ⬆ {rtl ? "ایمپورت قالب ابلاغی" : "Import → Client"}
            </button>

            <span className="mx-1 h-5 w-px hline" />

            <span className="text-[9.5px] font-extralight tx3">{rtl ? "خروجی:" : "Export:"}</span>
            {formats.map((f) => {
              const m = formatMeta[f];
              return (
                <button key={f} onClick={() => handleExport(f)}
                        title={`${m.label} ${m.ext}`}
                        className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-light transition hover:-translate-y-px"
                        style={{ borderColor: `${m.color}66`, background: `${m.color}12`, color: m.color }}>
                  {m.icon} {m.label}
                </button>
              );
            })}

            <span className="mx-1 h-5 w-px hline" />

            <button onClick={() => setAiOpen((o) => !o)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-light transition ${aiOpen ? "border-fuchsia-400 bg-fuchsia-400/15 text-fuchsia-200" : "border-fuchsia-400/40 bg-fuchsia-400/8 text-fuchsia-300 hover:bg-fuchsia-400/15"}`}>
              ✨ {rtl ? "مشاوره هوش مصنوعی" : "AI Advisor"}
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-2">
            <TemplateBox
              lang={lang}
              title={rtl ? "قالب‌های داخلی برنامه" : "Internal Application Templates"}
              subtitle={rtl ? "قالب‌های استاندارد سازمانی — قابل ویرایش" : "Standard organizational templates — editable"}
              accent="#7FB2FF"
              icon="🏢"
              items={internal}
              onRemove={(id) => setInternal((p) => p.filter((x) => x.id !== id))}
              rtl={rtl}
            />
            <TemplateBox
              lang={lang}
              title={rtl ? "قالب‌های ابلاغی مشاور / کارفرما" : "Client / Consultant Mandated Templates"}
              subtitle={rtl ? "قفل‌شده — تغییرات مطابق ابلاغیه ممکن نیست" : "Locked — modifications outside brief not allowed"}
              accent="#F59E0B"
              icon="📌"
              items={client}
              onRemove={(id) => setClient((p) => p.filter((x) => x.id !== id))}
              rtl={rtl}
              locked
            />
          </div>
        </>
      )}

      {/* AI advisor drawer */}
      {aiOpen && (
        <div className="fade-rise mt-3 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-400/8 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[13px]">✨</span>
            <span className="text-[10.5px] font-normal text-fuchsia-200">
              {rtl ? `مشاوره AI برای «${t(sub.title, lang)}»` : `AI Advisor — "${t(sub.title, lang)}"`}
            </span>
            <span className="ms-auto rounded bg-fuchsia-400/15 px-1.5 py-[1px] text-[8.5px] font-light text-fuchsia-200" dir="ltr">
              model: {sub.ai}
            </span>
            <button onClick={() => setAiOpen(false)} className="text-fuchsia-200/70 hover:text-fuchsia-100">✕</button>
          </div>
          <div className="thin-scroll mb-2 max-h-40 space-y-1.5 overflow-y-auto rounded-lg bg-black/25 p-2">
            {aiThread.length === 0 && (
              <div className="text-[9.5px] font-extralight tx4">
                {rtl ? "سؤال خود را درباره‌ی این زیرفرآیند بپرسید." : "Ask a question about this sub-process."}
              </div>
            )}
            {aiThread.map((m, i) => (
              <div key={i} className={`rounded-lg px-2 py-1.5 text-[10px] font-light ${m.role === "user" ? "bg-white/5 tx1" : "bg-fuchsia-400/12 text-fuchsia-100"}`}>
                <span className="me-1 text-[8.5px] font-medium opacity-70">{m.role === "user" ? (rtl ? "شما:" : "You:") : "AI:"}</span>
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="rounded-lg bg-fuchsia-400/10 px-2 py-1 text-[9.5px] font-extralight text-fuchsia-200">
                {rtl ? "در حال تحلیل…" : "Analyzing…"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askAI()}
              placeholder={rtl ? "سؤال خود را بنویسید…" : "Type your question…"}
              className="flex-1 rounded-lg border b-line-soft bg-black/25 px-2.5 py-1.5 text-[10.5px] font-light tx1 outline-none focus:border-fuchsia-400"
            />
            <button onClick={askAI} disabled={busy || !aiInput.trim()}
                    className="rounded-lg border border-fuchsia-400/60 bg-fuchsia-400/20 px-3 py-1.5 text-[10px] font-normal text-fuchsia-100 transition hover:bg-fuchsia-400/30 disabled:opacity-40">
              {rtl ? "ارسال" : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* footer */}
      <div className="b-line-soft mt-3 flex items-center gap-2 border-t pt-2">
        <span className="pulse-dot h-[7px] w-[7px] rounded-full bg-emerald-400" />
        <span className="text-[9px] font-extralight tx3">{rtl ? "محل ذخیره‌سازی:" : "Storage:"}</span>
        <span className="text-[9px] font-light ok-dim-t" dir="ltr">SQL Server (.\SQL2008EXPRESS)</span>
        <span className="ms-auto truncate text-[9px] font-extralight tx4">
          {t(dom.title, lang)} · {t(proc.title, lang)} · {t(sub.title, lang)}
        </span>
      </div>
    </div>
  );
}

function TemplateBox({
  lang, title, subtitle, accent, icon, items, onRemove, rtl, locked,
}: {
  lang: Lang;
  title: string;
  subtitle: string;
  accent: string;
  icon: string;
  items: Template[];
  onRemove: (id: string) => void;
  rtl: boolean;
  locked?: boolean;
}) {
  return (
    <section className="glass-dark flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <header className="flex items-center gap-2 border-b b-line-soft px-3 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px]"
              style={{ background: `${accent}20`, border: `1px solid ${accent}55`, color: accent }}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11.5px] font-normal" style={{ color: accent }}>{title}</div>
          <div className="truncate text-[9px] font-extralight tx3">{subtitle}</div>
        </div>
        <span className="rounded-md px-1.5 py-0.5 text-[9px] font-light tabular-nums"
              style={{ background: `${accent}15`, border: `1px solid ${accent}44`, color: accent }}>
          {items.length.toLocaleString(rtl ? "fa-IR" : "en")}
        </span>
        {locked && (
          <span className="rounded-md border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-[8.5px] font-light text-amber-300">
            🔒 {rtl ? "قفل" : "Locked"}
          </span>
        )}
      </header>
      <div className="thin-scroll flex-1 space-y-1.5 overflow-y-auto p-2">
        {items.length === 0 && (
          <div className="flex h-full items-center justify-center text-[10px] font-extralight tx4">
            {rtl ? "هیچ قالبی موجود نیست — ایمپورت کنید." : "No templates — import files."}
          </div>
        )}
        {items.map((it) => {
          const m = formatMeta[it.format];
          return (
            <div key={it.id} className="glass-row flex items-center gap-2 rounded-xl px-2.5 py-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[14px]"
                    style={{ background: `${m.color}18`, border: `1px solid ${m.color}55`, color: m.color }}>
                {m.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[10.5px] font-light tx1" dir="ltr">{it.name}{m.ext}</span>
                  <span className="rounded px-1 py-[1px] text-[8px] font-light" style={{ background: `${m.color}18`, color: m.color }} dir="ltr">
                    {it.version}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[8.5px] font-extralight tx4">
                  <span dir="ltr">{m.label}</span><span>·</span>
                  <span dir="ltr">{it.size}</span><span>·</span>
                  <span dir="ltr">{it.updated}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded border b-line-soft px-1.5 py-0.5 text-[9px] font-light tx2 transition hover:tx1" title={rtl ? "دانلود" : "Download"}>⬇</button>
                {!locked ? (
                  <button className="rounded border b-line-soft px-1.5 py-0.5 text-[9px] font-light tx2 transition hover:tx1" title={rtl ? "ویرایش" : "Edit"}>✏</button>
                ) : (
                  <span className="rounded border border-amber-400/30 px-1.5 py-0.5 text-[9px] font-light text-amber-300/80" title={rtl ? "قفل‌شده" : "Locked"}>🔒</span>
                )}
                <button onClick={() => onRemove(it.id)} className="rounded border border-rose-400/40 px-1.5 py-0.5 text-[9px] font-light text-rose-300 transition hover:bg-rose-400/15" title={rtl ? "حذف" : "Remove"}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
      <footer className="border-t b-line-soft px-3 py-1.5 text-[8.5px] font-extralight tx4" dir="ltr">
        {locked
          ? (lang === "fa" ? "قالب‌های ابلاغی · تغییرات فقط توسط کارفرما مجاز است" : "Client-mandated · changes only via client")
          : (lang === "fa" ? "قالب‌های داخلی · نسخه‌بندی خودکار در SQL Server" : "Internal · auto-versioned in SQL Server")}
      </footer>
    </section>
  );
}
