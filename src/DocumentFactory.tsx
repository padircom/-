import { useState, useRef } from 'react';
import {
  X, UploadCloud, FileSpreadsheet, FileText, FileType2, Download,
  Lightbulb, CheckCircle2, ChevronDown, Factory, ShieldAlert, Sparkles,
} from 'lucide-react';

/* ==========================================================================
   TYPES + DATA (self-contained so the workspace stays isolated from control)
   ========================================================================== */
export type Lang = 'fa' | 'en';
export type DocFormat = 'xlsx' | 'docx' | 'pdf';

const toFa = (n: number | string) =>
  String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

export interface Deliverable {
  id: number;
  fa: string;
  en: string;
  formats: DocFormat[];
  logicFa: string;
  logicEn: string;
}

export const DELIVERABLES: Deliverable[] = [
  { id: 1, fa: 'ساختار شکست کار (WBS)', en: 'Work Breakdown Structure (WBS)', formats: ['xlsx'],
    logicFa: 'تجزیه سلسله‌مراتبی محدوده قرارداد تا سطح بسته کاری قابل تحویل و قابل تخصیص.', logicEn: 'Hierarchical decomposition of contract scope down to assignable deliverable work packages.' },
  { id: 2, fa: 'ساختار شکست هزینه (CBS)', en: 'Cost Breakdown Structure (CBS)', formats: ['xlsx'],
    logicFa: 'نگاشت اقلام هزینه به عناصر WBS جهت ایجاد حساب‌های کنترلی (Control Accounts).', logicEn: 'Maps cost items onto WBS elements to establish Control Accounts.' },
  { id: 3, fa: 'دیکشنری ساختار شکست', en: 'WBS Dictionary', formats: ['docx', 'pdf'],
    logicFa: 'تعریف دقیق محدوده، معیار پذیرش، ورودی و مرزهای هر بسته کاری.', logicEn: 'Precise scope, acceptance criteria, inputs and boundaries per work package.' },
  { id: 4, fa: 'منشور پروژه', en: 'Project Charter', formats: ['docx', 'pdf'],
    logicFa: 'تثبیت اهداف، ذی‌نفعان، مفروضات، محدودیت‌ها و اختیارات مدیر پروژه.', logicEn: 'Formalizes objectives, stakeholders, assumptions, constraints and PM authority.' },
  { id: 5, fa: 'ماتریس مسئولیت (RACI)', en: 'RACI Responsibility Matrix', formats: ['xlsx'],
    logicFa: 'تخصیص نقش‌های Responsible / Accountable / Consulted / Informed به هر بسته کاری.', logicEn: 'Assigns Responsible / Accountable / Consulted / Informed roles to each work package.' },
  { id: 6, fa: 'ثبت اولیه ریسک‌ها', en: 'Initial Risk Register', formats: ['xlsx', 'docx'],
    logicFa: 'شناسایی ریسک‌های قراردادی با امتیاز احتمال × اثر و راهبرد پاسخ اولیه.', logicEn: 'Identifies contractual risks with probability × impact scoring and initial response strategy.' },
  { id: 7, fa: 'ساختار زمان‌بندی مبنا (Baseline)', en: 'Baseline Schedule Layout', formats: ['xlsx'],
    logicFa: 'چیدمان فعالیت‌ها، مدت‌ها و روابط پیش‌نیازی به‌عنوان مبنای تأییدشده برنامه.', logicEn: 'Activity, duration and predecessor-relationship layout forming the approved plan baseline.' },
  { id: 8, fa: 'منطق هسته مسیر بحرانی (CPM)', en: 'Critical Path Method (CPM) Core Logic', formats: ['docx', 'pdf'],
    logicFa: 'محاسبه رفت و برگشت (Forward/Backward Pass) جهت تعیین طولانی‌ترین زنجیره بدون شناوری.', logicEn: 'Forward/backward pass computation determining the longest zero-float chain.' },
  { id: 9, fa: 'گزارش فعالیت‌های نزدیک‌بحرانی', en: 'Near Critical Activities Logs', formats: ['docx', 'pdf'],
    logicFa: 'فهرست فعالیت‌های با شناوری کل پایین که مستعد تبدیل‌شدن به مسیر بحرانی هستند.', logicEn: 'Lists low-total-float activities at risk of migrating onto the critical path.' },
  { id: 10, fa: 'ماتریس تحلیل شناوری (Float)', en: 'Float Analysis Matrix', formats: ['xlsx'],
    logicFa: 'محاسبه شناوری کل و آزاد برای سنجش انعطاف زمانی شبکه برنامه‌ریزی.', logicEn: 'Total and free float computation measuring planning-network schedule flexibility.' },
  { id: 11, fa: 'فهرست نقاط عطف و تعهدات', en: 'Milestone Tracking & Commitments List', formats: ['docx', 'pdf'],
    logicFa: 'استخراج نقاط عطف قراردادی و تعهدات تحویل به همراه تاریخ‌های الزام‌آور.', logicEn: 'Extracts contractual milestones and delivery commitments with binding dates.' },
];

const FORMAT_META: Record<DocFormat, { label: string; cls: string; Icon: any }> = {
  xlsx: { label: 'XLSX', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: FileSpreadsheet },
  docx: { label: 'DOCX', cls: 'bg-blue-50 text-blue-700 border-blue-300', Icon: FileText },
  pdf: { label: 'PDF', cls: 'bg-rose-50 text-rose-700 border-rose-300', Icon: FileType2 },
};

export interface SectorOption {
  key: string;
  name: string;
  nameEn: string;
  projects: { id: string; name: string; nameEn: string }[];
}

/* ==========================================================================
   1. CENTERED SELECTOR MODAL  (کارت کوچک) — z-index 9999
   ========================================================================== */
export function DocSelectorModal({
  lang, sectors, onClose, onSubmit,
}: {
  lang: Lang;
  sectors: SectorOption[];
  onClose: () => void;
  onSubmit: (sectorKey: string, projectId: string) => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const [sector, setSector] = useState('');
  const [project, setProject] = useState('');

  const activeSector = sectors.find((s) => s.key === sector);
  const canSubmit = !!sector && !!project;

  const selectCls =
    'w-full appearance-none bg-slate-50 border border-slate-300 focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 rounded-xl px-3 py-2.5 text-[12px] text-[#212529] font-medium outline-none transition cursor-pointer';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        dir={dir}
        className="relative w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-gradient-to-l from-cyan-50 via-white to-blue-50 border-b border-slate-200 flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Factory className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-black text-[#0f172a] leading-tight">
              {lang === 'fa' ? 'ماژول برنامه‌ریزی و کنترل مستندات' : 'Planning & Document Control Module'}
            </h3>
            <p className="text-[10px] text-blue-700 font-medium mt-0.5">
              {lang === 'fa' ? 'صنعت و پروژه هدف را انتخاب کنید' : 'Select the target sector and project'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: two dropdowns */}
        <div className="p-4 space-y-3.5">
          {/* Sector */}
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
              {lang === 'fa' ? 'انتخاب صنعت' : 'Select Sector'}
            </span>
            <div className="relative">
              <select
                value={sector}
                onChange={(e) => { setSector(e.target.value); setProject(''); }}
                className={selectCls}
              >
                <option value="">{lang === 'fa' ? '— انتخاب کنید —' : '— Choose —'}</option>
                {sectors.map((s) => (
                  <option key={s.key} value={s.key}>{lang === 'fa' ? s.name : s.nameEn}</option>
                ))}
              </select>
              <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none`} />
            </div>
          </label>

          {/* Project */}
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
              {lang === 'fa' ? 'انتخاب پروژه' : 'Select Project'}
            </span>
            <div className="relative">
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                disabled={!activeSector}
                className={`${selectCls} ${!activeSector ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="">
                  {activeSector
                    ? (lang === 'fa' ? '— انتخاب کنید —' : '— Choose —')
                    : (lang === 'fa' ? 'ابتدا صنعت را انتخاب کنید' : 'Select a sector first')}
                </option>
                {activeSector?.projects.map((p) => (
                  <option key={p.id} value={p.id}>{lang === 'fa' ? p.name : p.nameEn}</option>
                ))}
              </select>
              <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none`} />
            </div>
          </label>

          {/* Submit */}
          <button
            disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit(sector, project)}
            className={`w-full py-2.5 rounded-xl text-[12px] font-black transition shadow-md ${
              canSubmit
                ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 shadow-blue-500/25'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {lang === 'fa' ? 'ورود به محیط برنامه‌ریزی مستندات' : 'Enter Document Planning Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. FULLSCREEN DEDICATED WORKSPACE PAGE
   ========================================================================== */
export function DocumentFactoryPage({
  lang, sectorName, projectName, onClose,
}: {
  lang: Lang;
  sectorName: string;
  projectName: string;
  onClose: () => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const fmt = (n: number | string) => (lang === 'fa' ? toFa(n) : String(n));

  const [contractFiles, setContractFiles] = useState<string[]>([]);
  const [scheduleFile, setScheduleFile] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [advisorFor, setAdvisorFor] = useState<Deliverable | null>(null);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<number>(1);
  const contractRef = useRef<HTMLInputElement>(null);
  const scheduleRef = useRef<HTMLInputElement>(null);

  // Condition 1 = no schedule; Condition 2 = schedule provided. BOTH emit all 11.
  const condition: 1 | 2 = scheduleFile ? 2 : 1;
  const canGenerate = contractFiles.length > 0;
  const selected = DELIVERABLES.find((d) => d.id === selectedDeliverableId) ?? DELIVERABLES[0];

  const addContracts = (files: FileList | null) => {
    if (!files) return;
    setContractFiles((prev) => [...prev, ...Array.from(files).map((f) => f.name)]);
  };

  // Preview synthesis — deterministic AI-style summary text and tree items,
  // shaped by the currently selected deliverable and the active condition.
  const buildPreview = (d: Deliverable) => {
    const base = lang === 'fa' ? d.fa : d.en;
    const src = condition === 1
      ? (lang === 'fa' ? 'استخراج مستقیم از قرارداد و شرح کار' : 'Extracted directly from Contract + SOW')
      : (lang === 'fa' ? `هم‌تراز شده با شیت زمان‌بندی (${scheduleFile})` : `Aligned with schedule sheet (${scheduleFile})`);
    const treeMap: Record<number, string[]> = {
      1: ['1. Project', '1.1 Engineering', '1.1.1 Basic Design', '1.1.2 Detailed Design', '1.2 Procurement', '1.3 Construction', '1.4 Commissioning'],
      2: ['CA-100 Direct Costs', 'CA-110 Labor', 'CA-120 Materials', 'CA-200 Indirect', 'CA-210 Overhead', 'CA-300 Contingency'],
      3: ['WP-1.1 – Basic Design', 'Scope: Concept + FEED', 'Acceptance: Client Sign-off', 'WP-1.2 – Detailed Design', 'Scope: Issued For Construction'],
      4: ['Purpose', 'Objectives', 'Stakeholders', 'PM Authority', 'High-level Risks', 'Assumptions & Constraints', 'Success Criteria'],
      5: ['Task ↔ Role Matrix', 'PM = A', 'Engineering Lead = R', 'Client = C', 'QA/QC = I'],
      6: ['R-01 Permit Delay – High', 'R-02 FX Volatility – Medium', 'R-03 Vendor Default – High', 'R-04 Weather Window – Low'],
      7: ['Activity List', 'Duration Estimates', 'Predecessor Logic', 'Calendars', 'Baseline Dates'],
      8: ['Forward Pass', 'Backward Pass', 'Zero-Float Chain', 'Critical Activities Set', 'Length = Project Duration'],
      9: ['Near-Critical (TF ≤ 5d)', 'Watchlist Activities', 'Migration Risk Flags'],
      10: ['Total Float', 'Free Float', 'Independent Float', 'Path Slack Distribution'],
      11: ['M1 Notice To Proceed', 'M2 FEED Complete', 'M3 PO Placement', 'M4 Mechanical Completion', 'M5 First Oil / Handover'],
    };
    const tree = treeMap[d.id] ?? [];
    const summary =
      lang === 'fa'
        ? `این خروجی «${base}» به‌صورت خودکار از ${src} تولید شده است. ساختار زیر منطبق بر استاندارد PMBOK و مطابق با محدوده قراردادی پروژه چیدمان شده و آماده صادر شدن به فرمت‌های ${d.formats.map((f) => f.toUpperCase()).join(' / ')} است.`
        : `The "${base}" deliverable is auto-composed from ${src}. The structure below follows PMBOK convention, aligns with the project's contractual scope, and is ready for export as ${d.formats.map((f) => f.toUpperCase()).join(' / ')}.`;
    return { summary, tree };
  };
  const preview = buildPreview(selected);

  return (
    <div dir={dir} className="scada-workspace fixed inset-0 bg-[#F8F9FA] flex flex-col" style={{ zIndex: 9998 }}>
      {/* ---- Page header ---- */}
      <header className="bg-white border-b border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
          <Factory className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-black text-[#0f172a] leading-tight">
              {lang === 'fa' ? 'سامانه پیشرفته برنامه‌ریزی و کنترل مستندات' : 'Advanced Planning & Document Control System'}
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 text-[9px] font-bold">
              {lang === 'fa' ? 'برنامه‌ریزی ایزوله' : 'Isolated Planning'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            <span className="font-bold text-blue-700">{sectorName}</span>
            <span className="mx-1.5 text-slate-300">/</span>
            <span className="font-bold text-slate-700">{projectName}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 transition flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          {lang === 'fa' ? 'بازگشت به داشبورد' : 'Back to Dashboard'}
        </button>
      </header>

      {/* ---- INPUT BAR (top full-width) ---- */}
      <section className="bg-white border-b border-slate-200 shadow-sm px-4 py-3 flex-shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_320px] gap-3 items-stretch">
          {/* Primary dropzone: Contracts / SOW */}
          <div
            onClick={() => contractRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addContracts(e.dataTransfer.files); }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-cyan-300 bg-cyan-50/40 hover:bg-cyan-50 hover:border-cyan-500 transition px-3 py-2.5 flex items-center gap-3"
          >
            <UploadCloud className="w-6 h-6 text-cyan-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black text-cyan-900 truncate">
                {lang === 'fa' ? 'قرارداد و شرح کار (SOW)' : 'Contract & Statement of Work (SOW)'}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">
                {lang === 'fa' ? 'فرمت‌های مجاز: .docx / .pdf' : 'Accepted: .docx / .pdf'}
                {contractFiles.length > 0 && (
                  <span className="ms-2 text-emerald-600 font-bold">· {fmt(contractFiles.length)} {lang === 'fa' ? 'فایل بارگذاری شد' : 'files loaded'}</span>
                )}
              </div>
            </div>
            <input
              ref={contractRef}
              type="file"
              multiple
              accept=".doc,.docx,.pdf"
              className="hidden"
              onChange={(e) => addContracts(e.target.files)}
            />
          </div>

          {/* Secondary dropzone: MPP / XER / XLSX timelines */}
          <div
            onClick={() => scheduleRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setScheduleFile(e.dataTransfer.files?.[0]?.name ?? null); }}
            className={`cursor-pointer rounded-xl border-2 border-dashed transition px-3 py-2.5 flex items-center gap-3 ${
              scheduleFile
                ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50'
                : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-emerald-400'
            }`}
          >
            <FileSpreadsheet className={`w-6 h-6 flex-shrink-0 ${scheduleFile ? 'text-emerald-600' : 'text-slate-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black truncate">
                {lang === 'fa'
                  ? 'بارگذاری شیت زمان‌بندی (mpp, xer, xlsx)'
                  : 'Upload Schedule Sheet (mpp, xer, xlsx)'}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5 truncate">
                {scheduleFile
                  ? (lang === 'fa' ? `فایل بارگذاری شد: ${scheduleFile}` : `Loaded: ${scheduleFile}`)
                  : (lang === 'fa' ? 'Microsoft Project · Primavera P6 · Excel' : 'Microsoft Project · Primavera P6 · Excel')}
              </div>
            </div>
            {scheduleFile && (
              <button
                onClick={(e) => { e.stopPropagation(); setScheduleFile(null); }}
                className="text-[9px] text-rose-600 hover:underline flex-shrink-0"
              >
                {lang === 'fa' ? 'حذف' : 'Remove'}
              </button>
            )}
            <input
              ref={scheduleRef}
              type="file"
              accept=".xls,.xlsx,.mpp,.xer"
              className="hidden"
              onChange={(e) => setScheduleFile(e.target.files?.[0]?.name ?? null)}
            />
          </div>

          {/* Generate control — static condition wording removed here (v1.3.3);
              the live condition state now surfaces exclusively as the dynamic
              badge directly above the 11-part cascading sidebar. */}
          <div className="rounded-xl border px-3 py-2 flex items-center gap-3 bg-slate-50 border-slate-200">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black text-slate-700">
                {lang === 'fa' ? 'تولید بسته برنامه‌ریزی' : 'Planning Package Generation'}
              </div>
              <div className="text-[8.5px] mt-0.5 text-slate-500">
                {lang === 'fa' ? 'هر ۱۱ خروجی تولید می‌شود' : 'All 11 outputs will be produced'}
              </div>
            </div>
            <button
              disabled={!canGenerate}
              onClick={() => setGenerated(true)}
              className={`px-3 py-2 rounded-lg text-[10px] font-black transition shadow-sm ${
                canGenerate
                  ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {generated
                ? (lang === 'fa' ? 'تولید مجدد' : 'Regenerate')
                : (lang === 'fa' ? 'تولید بسته' : 'Generate')}
            </button>
          </div>
        </div>
      </section>

      {/* ---- 80% LEFT preview / 20% RIGHT cascading sidebar ---- */}
      <div className="scada-viewer-split flex-1 gap-2 p-2">
        {/* ==================== LEFT — Preview canvas (80%) ==================== */}
        <main className="rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
          {/* Preview header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-l from-cyan-50 via-white to-blue-50 flex items-center gap-3 flex-shrink-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-[13px] flex-shrink-0 ${generated ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {fmt(selected.id)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[13px] font-black text-[#0f172a] leading-tight truncate">
                {lang === 'fa' ? selected.fa : selected.en}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {selected.formats.map((f) => {
                  const meta = FORMAT_META[f];
                  const FIcon = meta.Icon;
                  return (
                    <span key={f} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8.5px] font-black ${meta.cls}`}>
                      <FIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  );
                })}
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8.5px] font-bold ${generated ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                  <CheckCircle2 className="w-3 h-3" />
                  {generated ? (lang === 'fa' ? 'آماده' : 'Ready') : (lang === 'fa' ? 'در انتظار تولید' : 'Awaiting Generation')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                disabled={!generated}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${
                  generated
                    ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Download className="w-3 h-3" />
                {lang === 'fa' ? 'دانلود' : 'Download'}
              </button>
              <button
                onClick={() => setAdvisorFor(selected)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold transition"
              >
                <Lightbulb className="w-3 h-3" />
                {lang === 'fa' ? 'مشاوره فنی' : 'Consult'}
              </button>
            </div>
          </div>

          {/* Preview body */}
          <div className="flex-1 min-h-0 overflow-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* AI summary block (spans 2 columns on wide) */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col">
              <div className="text-[10px] font-bold text-slate-500 mb-2">
                {lang === 'fa' ? 'خلاصه استخراج‌شده توسط هوش مصنوعی' : 'AI-Extracted Summary'}
              </div>
              <p className="text-[12px] leading-relaxed text-[#212529]">
                {generated
                  ? preview.summary
                  : (lang === 'fa'
                      ? 'برای مشاهده پیش‌نمایش زنده این خروجی، ابتدا اسناد قرارداد را بارگذاری و دکمه «تولید بسته» را بزنید.'
                      : 'To view a live preview of this deliverable, first upload contract documents and press "Generate".')}
              </p>

              {/* Mock rendered doc frame */}
              <div className="mt-3 flex-1 min-h-[180px] rounded-xl border border-dashed border-slate-300 bg-white/90 p-3 overflow-auto">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
                  {lang === 'fa' ? 'پیش‌نمایش سند' : 'Document Preview'}
                </div>
                {generated ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-2 rounded-full bg-gradient-to-l from-cyan-100 to-blue-100"
                        style={{ width: `${60 + (i * 4) % 40}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-[10px] text-slate-400">
                    {lang === 'fa' ? 'محتوایی برای نمایش وجود ندارد.' : 'Nothing to display yet.'}
                  </div>
                )}
              </div>
            </div>

            {/* Raw data tree */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col min-h-0">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5 text-cyan-600" />
                <div className="text-[10px] font-bold text-slate-500">
                  {lang === 'fa' ? 'درخت داده خام' : 'Raw Data Tree'}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto space-y-1">
                {generated ? (
                  preview.tree.map((node, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10.5px] font-mono text-slate-700"
                      style={{ paddingInlineStart: `${8 + (node.split('.').length - 1) * 10}px` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0" />
                      <span className="truncate" dir="ltr">{node}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-400 py-6 text-center">
                    {lang === 'fa' ? 'درخت داده پس از تولید نمایش داده می‌شود.' : 'Tree will appear after generation.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scope-exclusion strip — kept as a visible reminder, no charts */}
          <div className="border-t border-slate-200 bg-rose-50/60 px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <div className="text-[9.5px] text-rose-800 font-medium leading-snug">
              {lang === 'fa'
                ? 'نمودارهای رهگیری عملیاتی، منحنی S واقعی و توزیع تأخیر لحظه‌ای (E/P/C/C) در این محیط ممنوع هستند.'
                : 'Operational tracking graphs, actual S-Curves and real-time E/P/C/C delay distributions are barred from this workspace.'}
            </div>
          </div>
        </main>

        {/* ==================== RIGHT — Cascading sidebar (20%) ==================== */}
        <aside className="rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-200 bg-gradient-to-l from-cyan-50 via-white to-blue-50 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
              <h3 className="text-[11px] font-black text-[#0f172a] truncate">
                {lang === 'fa' ? 'کارخانه ۱۱-بخشی اسناد' : 'AI 11-Part Factory'}
              </h3>
            </div>
            <span className={`px-1.5 py-0.5 rounded-md border text-[8.5px] font-bold flex-shrink-0 ${generated ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
              {fmt(DELIVERABLES.length)}/{fmt(11)}
            </span>
          </div>

          {/* ---- v1.3.3: Dynamic condition status badge — the single source of
              truth for Condition 1 / Condition 2, replacing the old static
              "شرط 1 - تولید از صفر" label. Auto-swaps teal → blue the instant
              scheduleFile is populated, with zero refresh required. ---- */}
          <div
            className={`mx-2.5 mt-2.5 mb-1 rounded-xl border px-3 py-2 flex items-center gap-2 transition-colors ${
              condition === 1
                ? 'bg-teal-50 border-teal-300'
                : 'bg-blue-50 border-blue-400 shadow-sm shadow-blue-200/60'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                condition === 1 ? 'bg-teal-500' : 'bg-blue-600 animate-pulse'
              }`}
            />
            <p className={`text-[10px] font-black leading-snug ${condition === 1 ? 'text-teal-800' : 'text-blue-800'}`}>
              {condition === 1
                ? (lang === 'fa'
                    ? 'وضعیت پلتفرم: شرط 1 (مهندسی و تولید پکیج مدارک از متن قرارداد)'
                    : 'Platform State: Condition 1 (Engineering & document package generation from contract text)')
                : (lang === 'fa'
                    ? 'وضعیت پلتفرم: شرط 2 (تراز و بازسازی پکیج مدارک بر اساس فایل زمان‌بندی وارد شده)'
                    : 'Platform State: Condition 2 (Aligning & rebuilding the document package from the uploaded schedule file)')}
            </p>
          </div>

          {/* Cascading row list */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {DELIVERABLES.map((d) => {
              const isActive = d.id === selectedDeliverableId;
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDeliverableId(d.id)}
                  className={`cursor-pointer rounded-xl border transition p-2 ${
                    isActive
                      ? 'border-cyan-400 bg-cyan-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40'
                  }`}
                >
                  {/* Row header */}
                  <div className="flex items-start gap-1.5 mb-1.5">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[9px] flex-shrink-0 ${
                      isActive ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {fmt(d.id)}
                    </div>
                    <h4 className={`flex-1 text-[10.5px] font-black leading-tight ${isActive ? 'text-cyan-900' : 'text-[#212529]'}`}>
                      {lang === 'fa' ? d.fa : d.en}
                    </h4>
                  </div>

                  {/* Format chips */}
                  <div className="flex items-center gap-1 flex-wrap mb-1.5">
                    {d.formats.map((f) => {
                      const meta = FORMAT_META[f];
                      const FIcon = meta.Icon;
                      return (
                        <span key={f} className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[8px] font-black ${meta.cls}`}>
                          <FIcon className="w-2.5 h-2.5" />
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      disabled={!generated}
                      onClick={(e) => e.stopPropagation()}
                      title={lang === 'fa' ? 'دانلود' : 'Download'}
                      className={`flex-1 flex items-center justify-center gap-0.5 py-1 rounded text-[8.5px] font-bold transition ${
                        generated
                          ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Download className="w-2.5 h-2.5" />
                      {lang === 'fa' ? 'دانلود' : 'DL'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAdvisorFor(d); }}
                      title={lang === 'fa' ? 'مشاوره فنی' : 'Technical Consultation'}
                      className="flex-1 flex items-center justify-center gap-0.5 py-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[8.5px] font-bold transition"
                    >
                      <Lightbulb className="w-2.5 h-2.5" />
                      {lang === 'fa' ? 'مشاوره' : 'Consult'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* ---- Technical consultation drawer ---- */}
      {advisorFor && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
          style={{ zIndex: 10000 }}
          onClick={() => setAdvisorFor(null)}
        >
          <div
            dir={dir}
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-gradient-to-l from-amber-50 to-white border-b border-slate-200 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[12px] font-black text-[#0f172a]">
                  {lang === 'fa' ? 'مشاوره فنی' : 'Technical Consultation'}
                </h4>
                <p className="text-[10px] text-slate-500 truncate">{lang === 'fa' ? advisorFor.fa : advisorFor.en}</p>
              </div>
              <button onClick={() => setAdvisorFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <div className="text-[10px] font-bold text-slate-500 mb-1">
                  {lang === 'fa' ? 'منطق مهندسی' : 'Engineering Logic'}
                </div>
                <p className="text-[11px] text-[#212529] leading-relaxed">
                  {lang === 'fa' ? advisorFor.logicFa : advisorFor.logicEn}
                </p>
              </div>
              <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-3">
                <div className="text-[10px] font-bold text-cyan-700 mb-1">
                  {lang === 'fa' ? 'روش تولید در حالت فعلی' : 'Generation Method (current mode)'}
                </div>
                <p className="text-[11px] text-cyan-900 leading-relaxed">
                  {condition === 1
                    ? (lang === 'fa'
                        ? 'استخراج مستقیم از متن قرارداد و شرح کار، سپس ساخت الگوی استاندارد از صفر.'
                        : 'Direct extraction from contract/SOW text, then standard template construction from scratch.')
                    : (lang === 'fa'
                        ? 'تطبیق فعالیت‌های شیت زمان‌بندی با اقلام قرارداد و بازسازی ساختار هم‌تراز.'
                        : 'Reconciles schedule-sheet activities against contract items and rebuilds an aligned structure.')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {advisorFor.formats.map((f) => {
                  const meta = FORMAT_META[f];
                  const FIcon = meta.Icon;
                  return (
                    <span key={f} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] font-black ${meta.cls}`}>
                      <FIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
