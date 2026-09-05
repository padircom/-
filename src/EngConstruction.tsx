import { useState, useMemo, useRef } from 'react';
import {
  X, ChevronDown, Lightbulb, UploadCloud, Download, AlertTriangle, Sparkles,
  FileText, FileSpreadsheet, FileType2, DraftingCompass, HardHat, MessageSquare,
  GitPullRequestArrow, Network, Users, Wrench, Gauge, ShieldAlert, RefreshCw,
} from 'lucide-react';

/* ==========================================================================
   SHARED TYPES + HELPERS
   ========================================================================== */
export type Lang = 'fa' | 'en';
const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

export interface SectorOption {
  key: string;
  name: string;
  nameEn: string;
  projects: { id: string; name: string; nameEn: string }[];
}

export type EngConKind = 'engineering' | 'construction';

const FORMAT_META = {
  xlsx: { label: 'XLSX', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: FileSpreadsheet },
  docx: { label: 'DOCX', cls: 'bg-blue-50 text-blue-700 border-blue-300', Icon: FileText },
  pdf: { label: 'PDF', cls: 'bg-rose-50 text-rose-700 border-rose-300', Icon: FileType2 },
} as const;
type Fmt = keyof typeof FORMAT_META;

const KIND_META: Record<EngConKind, {
  Icon: any; fa: string; en: string;
  workspaceFa: string; workspaceEn: string;
  submitFa: string; submitEn: string;
}> = {
  engineering: {
    Icon: DraftingCompass,
    fa: 'بخش مهندسی و مدیریت مدارک', en: 'Engineering & Document Control',
    workspaceFa: 'سامانه مهندسی و مدیریت مدارک', workspaceEn: 'Engineering & Document Control Workspace',
    submitFa: 'ورود به محیط مهندسی', submitEn: 'Enter Engineering Workspace',
  },
  construction: {
    Icon: HardHat,
    fa: 'بخش ساخت، اجرا و مدیریت HSE', en: 'Construction, Execution & HSE',
    workspaceFa: 'سامانه ساخت، اجرا و مدیریت HSE', workspaceEn: 'Construction, Execution & HSE Workspace',
    submitFa: 'ورود به محیط ساخت و اجرا', submitEn: 'Enter Construction Workspace',
  },
};

/* ==========================================================================
   CLEAN 2-FIELD SELECTOR MODAL
   ========================================================================== */
export function EngConSelectorModal({
  lang, kind, sectors, onClose, onSubmit,
}: {
  lang: Lang;
  kind: EngConKind;
  sectors: SectorOption[];
  onClose: () => void;
  onSubmit: (sectorKey: string, projectId: string) => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const [sector, setSector] = useState('');
  const [project, setProject] = useState('');
  const activeSector = sectors.find((s) => s.key === sector);
  const canSubmit = !!sector && !!project;
  const meta = KIND_META[kind];
  const Icon = meta.Icon;

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
        <div className="px-4 py-3.5 bg-gradient-to-l from-cyan-50 via-white to-blue-50 border-b border-slate-200 flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Icon className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-black text-[#0f172a] leading-tight">
              {lang === 'fa' ? meta.fa : meta.en}
            </h3>
            <p className="text-[10px] text-blue-700 font-medium mt-0.5">
              {lang === 'fa' ? 'صنعت و پروژه هدف را انتخاب کنید' : 'Select the target sector and project'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
              {lang === 'fa' ? 'انتخاب صنعت' : 'Select Sector'}
            </span>
            <div className="relative">
              <select value={sector} onChange={(e) => { setSector(e.target.value); setProject(''); }} className={selectCls}>
                <option value="">{lang === 'fa' ? '— انتخاب کنید —' : '— Choose —'}</option>
                {sectors.map((s) => (
                  <option key={s.key} value={s.key}>{lang === 'fa' ? s.name : s.nameEn}</option>
                ))}
              </select>
              <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none`} />
            </div>
          </label>

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

          <button
            disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit(sector, project)}
            className={`w-full py-2.5 rounded-xl text-[12px] font-black transition shadow-md ${
              canSubmit
                ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 shadow-blue-500/25'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {lang === 'fa' ? meta.submitFa : meta.submitEn}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   SHARED WORKSPACE PIECES
   ========================================================================== */
type Template = 'base' | 'client';

function DualTemplateToggle({
  lang, template, onChange, onCustomFile, customFile, downloadFormats,
}: {
  lang: Lang; template: Template; onChange: (t: Template) => void;
  onCustomFile: (name: string | null) => void; customFile: string | null; downloadFormats: Fmt[];
}) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  const uploadRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      <div dir="ltr" className="inline-flex w-full rounded-xl bg-slate-100 p-1 border border-slate-200">
        <button
          onClick={() => onChange('base')}
          className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-black transition ${template === 'base' ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-cyan-700'}`}
        >
          {label('قالب بیس و داخلی سازمان', 'Base Template')}
        </button>
        <button
          onClick={() => onChange('client')}
          className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-black transition ${template === 'client' ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-cyan-700'}`}
        >
          {label('قالب ابلاغی کارفرما / مشاور', 'Client Template')}
        </button>
      </div>

      {template === 'base' ? (
        <div>
          <p className="text-[10px] text-slate-500 mb-2">
            {label('قالب اختصاصی سازمان خود را بارگذاری کنید تا متریک‌ها در ساختار شما نگاشت شوند.',
                   'Upload your organization\'s custom template — metrics will be mapped into your structure.')}
          </p>
          <div
            onClick={() => uploadRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onCustomFile(e.dataTransfer.files?.[0]?.name ?? null); }}
            className={`cursor-pointer rounded-xl border-2 border-dashed transition p-4 text-center ${customFile ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50' : 'border-cyan-300 bg-cyan-50/40 hover:bg-cyan-50 hover:border-cyan-500'}`}
          >
            <UploadCloud className={`w-7 h-7 mx-auto mb-1.5 ${customFile ? 'text-emerald-600' : 'text-cyan-600'}`} />
            <div className={`text-[11px] font-black ${customFile ? 'text-emerald-800' : 'text-cyan-900'} truncate`}>
              {customFile ?? label('فایل قالب خود را اینجا رها کنید', 'Drop your custom template here')}
            </div>
            <div className="text-[9px] text-slate-500 mt-1">.xlsx · .docx · .pdf</div>
            <input ref={uploadRef} type="file" accept=".xls,.xlsx,.doc,.docx,.pdf" className="hidden" onChange={(e) => onCustomFile(e.target.files?.[0]?.name ?? null)} />
          </div>
          {customFile && (
            <button onClick={() => onCustomFile(null)} className="mt-1.5 w-full text-[9px] text-rose-600 hover:underline">
              {label('حذف فایل', 'Remove file')}
            </button>
          )}
        </div>
      ) : (
        <div>
          <p className="text-[10px] text-slate-500 mb-2">
            {label('قالب رسمی ابلاغی کارفرما یا مشاور را دانلود و در همان چارچوب گزارش‌گیری کنید.',
                   'Download the official Client- or Consultant-mandated template and report within it.')}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {downloadFormats.map((f) => {
              const meta = FORMAT_META[f];
              const FIcon = meta.Icon;
              return (
                <button key={f} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-black transition hover:opacity-80 ${meta.cls}`}>
                  <Download className="w-3 h-3" />
                  <FIcon className="w-3 h-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AIAlertPanel({
  lang, severity, headlineFa, headlineEn, insightsFa, insightsEn, onAdvice,
}: {
  lang: Lang; severity: 'high' | 'medium' | 'low';
  headlineFa: string; headlineEn: string; insightsFa: string[]; insightsEn: string[];
  onAdvice: (title: string) => void;
}) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  const sevMap = {
    high: { bg: 'from-rose-50 to-white', border: 'border-rose-300', chip: 'bg-rose-500 text-white', text: 'text-rose-900', dot: 'bg-rose-500' },
    medium: { bg: 'from-amber-50 to-white', border: 'border-amber-300', chip: 'bg-amber-500 text-white', text: 'text-amber-900', dot: 'bg-amber-500' },
    low: { bg: 'from-emerald-50 to-white', border: 'border-emerald-300', chip: 'bg-emerald-500 text-white', text: 'text-emerald-900', dot: 'bg-emerald-500' },
  }[severity];
  return (
    <div className={`rounded-2xl bg-gradient-to-l ${sevMap.bg} border ${sevMap.border} shadow-sm p-3.5`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${sevMap.chip} flex items-center justify-center flex-shrink-0 shadow`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className={`text-[12px] font-black ${sevMap.text} leading-tight`}>
              {label('هشدار هوشمند پیش‌بینی تأخیر مهندسی و ساخت', 'AI Engineering & Construction Delay Alert')}
            </h3>
            <span className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-black ${sevMap.chip}`}>
              {severity === 'high' ? label('بحرانی', 'HIGH') : severity === 'medium' ? label('هشدار', 'MEDIUM') : label('پایدار', 'LOW')}
            </span>
            <span className="ms-auto inline-flex items-center gap-1 text-[9px] text-slate-500 font-bold">
              <Sparkles className="w-3 h-3 text-cyan-600" />
              {label('موتور AI', 'AI Engine')}
            </span>
          </div>
          <p className={`text-[11px] font-bold ${sevMap.text} leading-snug`}>
            {lang === 'fa' ? headlineFa : headlineEn}
          </p>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-1.5">
            {(lang === 'fa' ? insightsFa : insightsEn).map((it) => (
              <div key={it} className="flex items-start gap-1.5 text-[10px] text-slate-700">
                <span className={`w-1.5 h-1.5 rounded-full ${sevMap.dot} flex-shrink-0 mt-1`} />
                <span>{it}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5">
            <button
              onClick={() => onAdvice(label('راهکار تعدیل تأخیر مهندسی و ساخت', 'Eng./Construction Mitigation Advice'))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 text-[10px] font-bold transition"
            >
              <Lightbulb className="w-3 h-3" />
              {label('مشاوره فنی', 'Consult')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WidgetFrame({
  title, icon: Icon, onAdvice, lang, children,
}: { title: string; icon: any; onAdvice: () => void; lang: Lang; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
          <h4 className="text-[11px] font-black text-[#212529] truncate">{title}</h4>
        </div>
        <button
          onClick={onAdvice}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition flex-shrink-0"
        >
          <Lightbulb className="w-3 h-3" />
          {lang === 'fa' ? 'مشاوره فنی' : 'Consult'}
        </button>
      </div>
      <div className="flex-1 min-h-[110px]">{children}</div>
    </div>
  );
}

function AdvisorDrawer({ lang, title, onClose }: { lang: Lang; title: string; onClose: () => void }) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm" style={{ zIndex: 10000 }} onClick={onClose}>
      <div dir={dir} className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 bg-gradient-to-l from-amber-50 to-white border-b border-slate-200 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[12px] font-black text-[#0f172a]">{lang === 'fa' ? 'مشاوره فنی' : 'Technical Consultation'}</h4>
            <p className="text-[10px] text-slate-500 truncate">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 text-[11px] text-[#212529] leading-relaxed">
          {lang === 'fa'
            ? 'راهنمای مهندسی این ویجت شامل منطق محاسبات، شاخص‌های تفسیری و توصیه‌های اقدام است. با تغییر ورودی‌ها، هشدار هوشمند به‌روزرسانی می‌شود.'
            : 'This widget\'s engineering guidance covers calculation logic, interpretive metrics and recommended actions. Adjusting inputs updates the AI alert live.'}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   UNIVERSAL ENG/CONSTRUCTION WORKSPACE
   ========================================================================== */
export function EngConWorkspacePage({
  lang, kind, sectorName, projectName, onClose,
}: {
  lang: Lang; kind: EngConKind; sectorName: string; projectName: string; onClose: () => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const fmt = (n: number | string) => (lang === 'fa' ? toFa(n) : String(n));
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  const meta = KIND_META[kind];
  const HeaderIcon = meta.Icon;

  const [template, setTemplate] = useState<Template>('base');
  const [customFile, setCustomFile] = useState<string | null>(null);
  const [advisor, setAdvisor] = useState<string | null>(null);
  const advise = useMemo(() => (t: string) => setAdvisor(t), []);

  return (
    <div dir={dir} className="scada-workspace fixed inset-0 bg-[#F8F9FA] flex flex-col" style={{ zIndex: 9998 }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
          <HeaderIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-black text-[#0f172a] leading-tight">
              {lang === 'fa' ? meta.workspaceFa : meta.workspaceEn}
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 text-[9px] font-bold">
              {kind === 'engineering' ? label('کنترل مهندسی', 'Engineering Control') : label('کنترل ساخت و HSE', 'Construction & HSE Control')}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[9px] font-black">
              v4.0.0-beta
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
          {label('بازگشت به داشبورد', 'Back to Dashboard')}
        </button>
      </header>

      {/* Top region: toggle + AI alert */}
      <div className="scada-fluid-two-col gap-2 p-2 flex-shrink-0">
        <DualTemplateToggle
          lang={lang} template={template} onChange={setTemplate}
          onCustomFile={setCustomFile} customFile={customFile} downloadFormats={['xlsx', 'docx', 'pdf']}
        />
        <AIAlertPanel
          lang={lang}
          {...(kind === 'engineering'
            ? {
                severity: 'high' as const,
                headlineFa: 'انباشت ۲۴ نقشه IFC معلق می‌تواند شروع فرانت ساخت را ۱۹ روز به تعویق بیندازد.',
                headlineEn: 'A backlog of 24 pending IFC drawings may delay construction front start by 19 days.',
                insightsFa: ['نرخ بسته‌شدن RFI کمتر از هدف', 'ضریب پیش‌بینی: ۰.۸۷', 'گلوگاه: بازبینی مشاور'],
                insightsEn: ['RFI close-out rate below target', 'Forecast confidence: 0.87', 'Bottleneck: Consultant review'],
              }
            : {
                severity: 'medium' as const,
                headlineFa: 'افت ۱۴٪ شاخص بهره‌وری نیروی انسانی در فرانت مکانیکال؛ خطر لغزش مبنای ساخت.',
                headlineEn: '14% productivity drop on the mechanical front; construction baseline slippage risk.',
                insightsFa: ['کمبود نیروی مستقیم ماهر', 'نرخ دوباره‌کاری ۶.۲٪', 'اقدام: تقویت شیفت شب'],
                insightsEn: ['Shortage of skilled direct labor', 'Rework rate 6.2%', 'Action: reinforce night shift'],
              })}
          onAdvice={advise}
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-2 pt-0 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 auto-rows-[minmax(180px,auto)]">
        {kind === 'engineering'
          ? <EngineeringWidgets lang={lang} advise={advise} fmt={fmt} label={label} />
          : <ConstructionWidgets lang={lang} advise={advise} fmt={fmt} label={label} />}
      </div>

      {advisor && <AdvisorDrawer lang={lang} title={advisor} onClose={() => setAdvisor(null)} />}
    </div>
  );
}

/* ---- Page 1 — Engineering widgets --------------------------------------- */
function EngineeringWidgets({ lang, advise, fmt, label }: {
  lang: Lang; advise: (t: string) => void;
  fmt: (n: number | string) => string; label: (fa: string, en: string) => string;
}) {
  const designStages = [
    { l: 'IFR', full: label('صادر برای بازبینی', 'Issued For Review'), pct: 92, color: 'from-emerald-400 to-emerald-600' },
    { l: 'IFA', full: label('صادر برای تأیید', 'Issued For Approval'), pct: 74, color: 'from-cyan-400 to-cyan-600' },
    { l: 'IFC', full: label('صادر برای ساخت', 'Issued For Construction'), pct: 58, color: 'from-blue-400 to-blue-600' },
  ];
  const drawings = [
    { l: label('صادرشده', 'Issued'), v: 486, c: 'text-emerald-700', bg: 'from-emerald-50' },
    { l: label('در انتظار', 'Pending'), v: 132, c: 'text-amber-700', bg: 'from-amber-50' },
    { l: label('بازنگری', 'Under Revision'), v: 48, c: 'text-blue-700', bg: 'from-blue-50' },
    { l: label('کل', 'Total'), v: 666, c: 'text-slate-700', bg: 'from-slate-50' },
  ];
  const rfi = [
    { l: label('باز', 'Open'), v: 37, color: 'bg-amber-500' },
    { l: label('بسته‌شده', 'Closed'), v: 214, color: 'bg-emerald-500' },
    { l: label('معوق', 'Overdue'), v: 12, color: 'bg-rose-500' },
  ];
  const ecr = [
    { id: 'ECR-041', desc: label('تغییر مسیر لوله', 'Pipe re-routing'), status: 'approved' },
    { id: 'ECR-042', desc: label('ارتقای متریال', 'Material upgrade'), status: 'review' },
    { id: 'ECR-043', desc: label('اصلاح فونداسیون', 'Foundation revision'), status: 'pending' },
    { id: 'ECR-044', desc: label('بازطراحی سازه', 'Structure redesign'), status: 'rejected' },
  ];
  const interfaces = [
    { l: label('مکانیک ↔ سازه', 'Mech ↔ Civil'), state: 'closed' },
    { l: label('برق ↔ ابزار دقیق', 'Elec ↔ Instr'), state: 'open' },
    { l: label('فرآیند ↔ مکانیک', 'Process ↔ Mech'), state: 'open' },
    { l: label('سازه ↔ محوطه', 'Civil ↔ Yard'), state: 'closed' },
  ];

  return (
    <>
      <WidgetFrame lang={lang} icon={DraftingCompass} title={label('پیشرفت طراحی (IFR / IFA / IFC)', 'Design Progress (IFR / IFA / IFC)')} onAdvice={() => advise('Design Progress')}>
        <div className="space-y-3 h-full flex flex-col justify-center">
          {designStages.map((s) => (
            <div key={s.l}>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="font-black text-slate-700">{s.l} <span className="font-normal text-slate-400 text-[9px]">· {s.full}</span></span>
                <span className="font-mono font-bold text-blue-700">{fmt(s.pct)}٪</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden" dir="ltr">
                <div className={`h-full rounded-full bg-gradient-to-r ${s.color}`} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={FileText} title={label('شمارش نقشه‌ها', 'Drawings Count')} onAdvice={() => advise('Drawings')}>
        <div className="grid grid-cols-2 gap-2 h-full">
          {drawings.map((d) => (
            <div key={d.l} className={`rounded-xl bg-gradient-to-b ${d.bg} to-white border border-slate-200 p-2 text-center flex flex-col justify-center`}>
              <div className="text-lg font-black font-mono ${d.c}" style={{ color: undefined }}>
                <span className={d.c}>{fmt(d.v)}</span>
              </div>
              <div className="text-[9px] text-slate-500">{d.l}</div>
            </div>
          ))}
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={MessageSquare} title={label('پیگیری RFI (باز / بسته)', 'RFI Tracking (Open / Close)')} onAdvice={() => advise('RFI')}>
        <div className="space-y-2 h-full flex flex-col justify-center">
          {rfi.map((r) => (
            <div key={r.l} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className={`w-2.5 h-2.5 rounded-full ${r.color} flex-shrink-0`} />
              <span className="flex-1 text-[11px] font-bold text-slate-700">{r.l}</span>
              <span className="text-[13px] font-black font-mono text-slate-800">{fmt(r.v)}</span>
            </div>
          ))}
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={GitPullRequestArrow} title={label('درخواست‌های تغییر مهندسی (ECR)', 'Engineering Change Requests (ECR)')} onAdvice={() => advise('ECR')}>
        <div className="overflow-auto max-h-[180px]">
          <table className="w-full text-[9.5px]">
            <thead>
              <tr className="text-slate-500">
                <th className="text-right py-1 px-1 font-bold">ECR#</th>
                <th className="text-right py-1 px-1 font-bold">{label('شرح', 'Description')}</th>
                <th className="text-right py-1 px-1 font-bold">{label('وضعیت', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {ecr.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-1 px-1 font-mono font-bold text-slate-600" dir="ltr">{r.id}</td>
                  <td className="py-1 px-1 text-slate-700 truncate">{r.desc}</td>
                  <td className="py-1 px-1">
                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[8.5px] ${
                      r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      r.status === 'review' ? 'bg-cyan-100 text-cyan-700' :
                      r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {r.status === 'approved' ? label('تأیید', 'Approved') :
                        r.status === 'review' ? label('بازبینی', 'Review') :
                        r.status === 'pending' ? label('در انتظار', 'Pending') :
                        label('رد', 'Rejected')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetFrame>

      <div className="lg:col-span-2 2xl:col-span-2">
        <WidgetFrame lang={lang} icon={Network} title={label('وضعیت مدیریت اینترفیس', 'Interface Management Status')} onAdvice={() => advise('Interface')}>
          <div className="grid grid-cols-2 gap-2">
            {interfaces.map((it) => (
              <div key={it.l} className={`flex items-center gap-2 p-2.5 rounded-xl border ${it.state === 'closed' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${it.state === 'closed' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'} flex-shrink-0`} />
                <span className="flex-1 text-[10.5px] font-bold text-slate-700 truncate" dir="ltr">{it.l}</span>
                <span className={`text-[9px] font-black ${it.state === 'closed' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {it.state === 'closed' ? label('بسته', 'Closed') : label('باز', 'Open')}
                </span>
              </div>
            ))}
          </div>
        </WidgetFrame>
      </div>
    </>
  );
}

/* ---- Page 2 — Construction widgets --------------------------------------- */
function ConstructionWidgets({ lang, advise, fmt, label }: {
  lang: Lang; advise: (t: string) => void;
  fmt: (n: number | string) => string; label: (fa: string, en: string) => string;
}) {
  const workFronts = [
    { l: label('فونداسیون واحد ۱', 'Unit 1 Foundation'), pct: 88 },
    { l: label('اسکلت واحد ۲', 'Unit 2 Steel Structure'), pct: 64 },
    { l: label('لوله‌کشی محوطه', 'Yard Piping'), pct: 41 },
    { l: label('نصب تجهیزات', 'Equipment Erection'), pct: 27 },
  ];
  const manpower = [
    { m: 'M1', direct: 220, indirect: 60 },
    { m: 'M2', direct: 320, indirect: 80 },
    { m: 'M3', direct: 410, indirect: 95 },
    { m: 'M4', direct: 480, indirect: 110 },
    { m: 'M5', direct: 440, indirect: 105 },
  ];
  const equipment = [
    { l: label('کرین', 'Cranes'), active: 4, total: 5 },
    { l: label('بیل مکانیکی', 'Excavators'), active: 3, total: 3 },
    { l: label('لودر', 'Loaders'), active: 2, total: 4 },
    { l: label('کمپکتور', 'Compactors'), active: 1, total: 2 },
  ];
  const productivity = [
    { l: label('مکانیکال', 'Mechanical'), idx: 0.86 },
    { l: label('سازه', 'Civil'), idx: 1.04 },
    { l: label('برق', 'Electrical'), idx: 0.92 },
  ];
  const hse = [
    { l: 'LTI', v: 2, good: false },
    { l: label('نرخ حادثه', 'Incident Rate'), v: 0.6, good: true },
    { l: label('روز بدون حادثه', 'Days w/o Incident'), v: 48, good: true },
    { l: label('بازرسی ایمنی', 'Safety Audits'), v: 26, good: true },
  ];

  return (
    <>
      <WidgetFrame lang={lang} icon={HardHat} title={label('فرانت‌های کاری فیزیکی سایت', 'Physical Site Work Fronts')} onAdvice={() => advise('Work fronts')}>
        <div className="space-y-2.5 h-full flex flex-col justify-center">
          {workFronts.map((w) => (
            <div key={w.l}>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="font-bold text-slate-700 truncate">{w.l}</span>
                <span className="font-mono font-bold text-blue-700">{fmt(w.pct)}٪</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden" dir="ltr">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${w.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={Users} title={label('هیستوگرام نیروی انسانی', 'Manpower Histogram')} onAdvice={() => advise('Manpower')}>
        <svg viewBox="0 0 200 100" className="w-full h-full" preserveAspectRatio="none">
          {[20, 40, 60, 80].map((y) => <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="#e2e8f0" strokeWidth="0.6" strokeDasharray="3 3" />)}
          {manpower.map((d, i) => {
            const x = 12 + i * 38;
            const total = d.direct + d.indirect;
            const th = (total / 600) * 88;
            const dh = (d.direct / 600) * 88;
            return (
              <g key={i}>
                <rect x={x} y={95 - th} width="22" height={th - dh} fill="#94a3b8" rx="1" />
                <rect x={x} y={95 - dh} width="22" height={dh} fill="#0891b2" rx="1" />
                <text x={x + 11} y="99" textAnchor="middle" fontSize="5" fill="#64748b" fontFamily="monospace">{d.m}</text>
              </g>
            );
          })}
        </svg>
        <div className="flex items-center gap-3 mt-1.5 text-[8.5px] text-slate-500 flex-shrink-0">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-600" />{label('مستقیم', 'Direct')}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-400" />{label('غیرمستقیم', 'Indirect')}</span>
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={Wrench} title={label('ردیابی تجهیزات فعال', 'Active Equipment Tracking')} onAdvice={() => advise('Equipment')}>
        <div className="space-y-1.5">
          {equipment.map((e) => (
            <div key={e.l} className="flex items-center gap-2 text-[10px]">
              <span className="flex-1 truncate text-slate-700">{e.l}</span>
              <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden" dir="ltr">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${(e.active / e.total) * 100}%` }} />
              </div>
              <span className="font-mono font-bold text-blue-700 w-10 text-right">{fmt(e.active)}/{fmt(e.total)}</span>
            </div>
          ))}
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={Gauge} title={label('شاخص‌های بهره‌وری', 'Productivity Indices')} onAdvice={() => advise('Productivity')}>
        <div className="space-y-2 h-full flex flex-col justify-center">
          {productivity.map((p) => {
            const good = p.idx >= 1;
            return (
              <div key={p.l} className={`flex items-center gap-2 p-2 rounded-lg border ${good ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <span className="flex-1 text-[11px] font-bold text-slate-700">{p.l}</span>
                <span className={`text-[14px] font-black font-mono ${good ? 'text-emerald-700' : 'text-amber-700'}`}>{fmt(p.idx.toFixed(2))}</span>
              </div>
            );
          })}
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={ShieldAlert} title={label('شاخص‌های ایمنی (HSE KPIs)', 'Safety Metrics (HSE KPIs)')} onAdvice={() => advise('HSE')}>
        <div className="grid grid-cols-2 gap-2 h-full">
          {hse.map((h) => (
            <div key={h.l} className={`rounded-xl border p-2 text-center flex flex-col justify-center ${h.good ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <div className={`text-lg font-black font-mono ${h.good ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(h.v)}</div>
              <div className="text-[9px] text-slate-500 leading-tight">{h.l}</div>
            </div>
          ))}
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={RefreshCw} title={label('تحلیل نرخ دوباره‌کاری', 'Rework Rate Analysis')} onAdvice={() => advise('Rework')}>
        <div className="h-full flex flex-col justify-center gap-2">
          <div className="flex items-end gap-1.5 justify-around">
            {[4.1, 5.8, 6.2, 4.9, 3.7].map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[9px] font-mono font-bold text-rose-700">{fmt(v)}٪</div>
                <div className="w-full max-w-[24px] rounded-t-md bg-gradient-to-t from-rose-500 to-rose-400" style={{ height: `${v * 8}px` }} />
                <div className="text-[8px] text-slate-500 font-mono">M{fmt(i + 1)}</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-center text-slate-500">
            {label('میانگین ۵ ماهه: ۴.۹٪', '5-month average: 4.9%')}
          </div>
        </div>
      </WidgetFrame>
    </>
  );
}
