import { useState, useMemo, useRef } from 'react';
import {
  X, ChevronDown, Lightbulb, UploadCloud, Sparkles,
  FileText, FileSpreadsheet, FileType2, BarChart3, CheckCircle2,
  ShieldAlert, Calendar, Layout, Printer, FileDown, BookOpen
} from 'lucide-react';

/* ==========================================================================
   SHARED TYPES & HELPERS
   ========================================================================== */
export type Lang = 'fa' | 'en';

export interface SectorOption {
  key: string;
  name: string;
  nameEn: string;
  projects: { id: string; name: string; nameEn: string }[];
}

const FORMAT_META = {
  xlsx: { label: 'XLSX', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: FileSpreadsheet },
  docx: { label: 'DOCX', cls: 'bg-blue-50 text-blue-700 border-blue-300', Icon: FileText },
  pdf: { label: 'PDF', cls: 'bg-rose-50 text-rose-700 border-rose-300', Icon: FileType2 },
} as const;
type Fmt = keyof typeof FORMAT_META;

type ReportPeriod = 'weekly' | 'biweekly' | 'monthly' | 'executive';

/* ==========================================================================
   SHARED CHROME BUILDING BLOCKS (Hoisted to top to fix compilation)
   ========================================================================== */
function WorkspaceHeader({
  lang, icon: Icon, titleFa, titleEn, badgeFa, badgeEn, sectorName, projectName, onClose,
}: {
  lang: Lang; icon: any; titleFa: string; titleEn: string; badgeFa: string; badgeEn: string;
  sectorName: string; projectName: string; onClose: () => void;
}) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3 flex-shrink-0">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-black text-[#0f172a] leading-tight">
            {lang === 'fa' ? titleFa : titleEn}
          </h1>
          <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 text-[9px] font-bold">
            {lang === 'fa' ? badgeFa : badgeEn}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[9px] font-black">
            v6.0.0-beta
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
   1. CLEAN 2-FIELD CENTER SELECTOR MODAL (z-index: 9999)
   Strictly TWO dropdowns: [انتخاب صنعت] & [انتخاب پروژه] + Submit
   ========================================================================== */
export function AnalyticsSelectorModal({
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
            <BarChart3 className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-black text-[#0f172a] leading-tight">
              {lang === 'fa' ? 'ماژول تحلیل و گزارش‌گیری' : 'Analytics & Reporting Module'}
            </h3>
            <p className="text-[10px] text-blue-700 font-medium mt-0.5">
              {lang === 'fa' ? 'صنعت و پروژه هدف را انتخاب کنید' : 'Select target sector and project'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Strictly 2 fields */}
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
            {lang === 'fa' ? 'ورود به محیط گزارش‌گیری هوشمند' : 'Enter Reporting Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. FULLSCREEN REPORTING WORKSPACE (v6.0.0-beta)
   ========================================================================== */
export function AnalyticsReportingPage({
  lang, sectorName, projectName, onClose,
}: {
  lang: Lang; sectorName: string; projectName: string; onClose: () => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);

  const [template, setTemplate] = useState<'base' | 'client'>('base');
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [customFile, setCustomFile] = useState<string | null>(null);
  const [advisor, setAdvisor] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const adv = useMemo(() => (t: string) => setAdvisor(t), []);

  const clientTemplates = {
    weekly: [
      { fa: 'گزارش هفتگی یکپارچه پیشرفت عملیات کارگاه (DPR)', en: 'Mandated Weekly DPR Operations Progress Report', formats: ['xlsx', 'pdf'] as Fmt[] },
      { fa: 'صورت‌جلسه مغایرت‌های هفتگی زمان‌بندی', en: 'Weekly Schedule Variance MoM Template', formats: ['docx'] as Fmt[] },
    ],
    biweekly: [
      { fa: 'گزارش دوهفتگی تحلیل انحراف و مسیر بحرانی (Look-Ahead)', en: 'Mandated Bi-Weekly Look-Ahead & CPM Variance Report', formats: ['xlsx', 'pdf'] as Fmt[] },
      { fa: 'خلاصه هشدارهای حقوقی دوهفتگی', en: 'Bi-Weekly Legal Claim Risk Alerts Summary', formats: ['docx', 'pdf'] as Fmt[] },
    ],
    monthly: [
      { fa: 'کتابچه جامع گزارش ماهانه پیشرفت پورتفولیو (PMS)', en: 'Comprehensive Monthly Progress Report Booklet (PMS)', formats: ['xlsx', 'docx', 'pdf'] as Fmt[] },
      { fa: 'گزارش ماهانه تحلیل تأخیرات و ادعاهای قراردادی', en: 'Monthly Forensic Delay & Claims Analysis Report', formats: ['docx', 'pdf'] as Fmt[] },
    ],
    executive: [
      { fa: 'گزارش مدیریتی کلان پورتفولیو هیات مدیره (Executive Summary)', en: 'Executive Board Level Portfolio Performance Summary', formats: ['pdf', 'docx'] as Fmt[] },
      { fa: 'تحلیل استراتژیک ریسک و جریان نقدینگی', en: 'Strategic Risk & Cash Flow Strategic Brief', formats: ['docx'] as Fmt[] },
    ],
  }[period];

  const periodLabels = {
    weekly: label('گزارش هفتگی', 'Weekly Report'),
    biweekly: label('گزارش دوهفتگی', 'Bi-Weekly Report'),
    monthly: label('گزارش ماهانه', 'Monthly Report'),
    executive: label('گزارش مدیریتی کلان', 'Executive Summary'),
  };

  return (
    <div dir={dir} className="scada-workspace fixed inset-0 bg-[#F8F9FA] flex flex-col" style={{ zIndex: 9998 }}>
      {/* Header */}
      <WorkspaceHeader
        lang={lang} icon={BarChart3}
        titleFa="سامانه پیشرفته تحلیل و گزارش‌گیری" titleEn="Advanced Analytics & Reporting System"
        badgeFa="پایش و تلفیق داده" badgeEn="Analytics & Report Compilation"
        sectorName={sectorName} projectName={projectName} onClose={onClose}
      />

      {/* Top Region: Dual-Format PMS Toggle + Periodic timeline filter bar */}
      <div className="scada-fluid-two-col gap-2 p-2 flex-shrink-0">
        
        {/* Dual Format Toggle */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col gap-2.5">
          <div dir="ltr" className="inline-flex w-full rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setTemplate('base')}
              className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-black transition ${
                template === 'base' ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-cyan-700'
              }`}
            >
              {label('قالب بیس و داخلی سازمان', 'Base Template')}
            </button>
            <button
              onClick={() => setTemplate('client')}
              className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-black transition ${
                template === 'client' ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-cyan-700'
              }`}
            >
              {label('قالب ابلاغی کارفرما / مشاور', 'Client Template')}
            </button>
          </div>

          {template === 'base' ? (
            <div>
              <p className="text-[10px] text-slate-500 mb-2">
                {label('فایل گزارش خام یا قالب سازمان خود را بارگذاری کنید؛ هوش مصنوعی داده‌ها را در قالب شما می‌نشاند.',
                       'Upload your custom organization sheet; the AI synthesizes progress data into your custom layout.')}
              </p>
              <div
                onClick={() => uploadRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); setCustomFile(e.dataTransfer.files?.[0]?.name ?? null); }}
                className={`cursor-pointer rounded-xl border-2 border-dashed transition p-3.5 text-center ${
                  customFile ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50' : 'border-cyan-300 bg-cyan-50/20'
                }`}
              >
                <UploadCloud className={`w-6 h-6 mx-auto mb-1 ${customFile ? 'text-emerald-600' : 'text-cyan-600'}`} />
                <div className={`text-[11px] font-black ${customFile ? 'text-emerald-800' : 'text-cyan-900'} truncate`}>
                  {customFile ?? label('قالب گزارش‌گیری سازمان (.xlsx / .docx) را رها کنید', 'Drop your reporting template here')}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">.xlsx · .docx · .pdf</div>
                <input ref={uploadRef} type="file" accept=".xls,.xlsx,.doc,.docx,.pdf" className="hidden" onChange={(e) => setCustomFile(e.target.files?.[0]?.name ?? null)} />
              </div>
              {customFile && (
                <button onClick={() => setCustomFile(null)} className="mt-1 w-full text-[9px] text-rose-600 hover:underline">
                  {label('حذف فایل', 'Remove file')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-500">
                {label('قالب‌های ابلاغی کارفرما برای دانلود و استفاده سریع:', 'Official mandated templates for instant download:')}
              </p>
              {clientTemplates.map((t, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-slate-700 truncate">{label(t.fa, t.en)}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {t.formats.map((f) => {
                      const meta = FORMAT_META[f];
                      return (
                        <button key={f} className={`px-1.5 py-0.5 rounded border text-[8px] font-black ${meta.cls}`}>
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Periodic Reporting Timeline Filter Bar */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="w-4 h-4 text-cyan-600 flex-shrink-0" />
              <h3 className="text-[12px] font-black text-[#212529]">
                {label('فیلتر زمان‌بندی دوره گزارش‌گیری', 'Periodic Reporting Timeline Filter')}
              </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { key: 'weekly', fa: 'هفتگی (Weekly)', en: 'Weekly' },
                { key: 'biweekly', fa: 'دوهفتگی (Bi-Weekly)', en: 'Bi-Weekly' },
                { key: 'monthly', fa: 'ماهانه (Monthly)', en: 'Monthly' },
                { key: 'executive', fa: 'مدیریتی کلان (Exec Summary)', en: 'Executive Management' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setPeriod(item.key as any)}
                  className={`px-3 py-2 rounded-xl border text-[11px] font-black text-center transition ${
                    period === item.key
                      ? 'bg-cyan-50 border-cyan-400 text-cyan-800 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {lang === 'fa' ? item.fa : item.en}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2 flex-wrap text-[10px] text-slate-500">
            <span>
              {label(`دوره فعال جهت ترکیب و گزارش‌گیری: ${periodLabels[period]}`,
                     `Active compilation interval: ${periodLabels[period]}`)}
            </span>
            <span className="font-mono font-bold text-slate-700">
              {lang === 'fa' ? 'پیکج مدارک آماده استخراج' : 'Document package ready'}
            </span>
          </div>
        </div>

      </div>

      {/* Main Grid: AI Compilation Core & Document Factory Output */}
      <div className="scada-viewer-split flex-1 p-3 pt-0 gap-2">
        
        {/* Left Side: Document Factory (PDF Booklet, Word summary, Excel matrix) */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3.5 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-[14px] font-black text-[#212529] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-600" />
                {label(`کارخانه تلفیق و صدور گزارش‌های ${periodLabels[period]}`, `AI ${periodLabels[period]} Compilation & Export`)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {label('تلفیق خودکار داده‌های خام انبار، S-Curve، تاخیرات و ریسک‌های حقوقی',
                       'Automatic synthesis of warehouse logs, S-Curves, delays and legal claim risks')}
              </p>
            </div>
            <button
              onClick={() => adv(label('مشاوره فنی روش تلفیق داده‌ها', 'Data Synthesis Technical Consultation'))}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold transition flex-shrink-0"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              {label('مشاوره فنی', 'Consult')}
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* 1. PDF Booklet */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center">
                    <Printer className="w-4.5 h-4.5" />
                  </div>
                  <span className="px-2 py-0.5 rounded border border-rose-300 text-rose-700 bg-rose-50 text-[9px] font-black">PDF Booklet</span>
                </div>
                <h4 className="text-[13px] font-black text-[#212529]">
                  {label('کتابچه رسمی و مصور گزارش', 'Official Graphic PDF Booklet')}
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  {label('پکیج کامل گزارش شامل روندهای مصور، دیاگرام‌های CPM، چراغ‌های نقاط عطف و تحلیل انحرافات به همراه تفاسیر متنی.',
                         'Full reporting package with embedded trend graphics, CPM path charts, milestone status lights and formatted commentary.')}
                </p>
              </div>
              <button className="w-full mt-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black shadow-md shadow-rose-500/20 flex items-center justify-center gap-1.5 transition">
                <FileDown className="w-3.5 h-3.5" />
                {label('دانلود کتابچه PDF', 'Download PDF Booklet')}
              </button>
            </div>

            {/* 2. Word Summary */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/20 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center">
                    <BookOpen className="w-4.5 h-4.5" />
                  </div>
                  <span className="px-2 py-0.5 rounded border border-blue-300 text-blue-700 bg-blue-50 text-[9px] font-black">Word DOCX</span>
                </div>
                <h4 className="text-[13px] font-black text-[#212529]">
                  {label('سند متنی و ویرایش‌پذیر خلاصه مدیریتی', 'Editable Word Executive Summary')}
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  {label('متن ویرایش‌پذیر خلاصه عملکرد دوره، موانع کارگاهی ثبت‌شده کارفرما/مشاور، و برنامه‌های نگاه به آینده بازآرایی شده.',
                         'Fully editable text summary of period performance, logged site bottlenecks, and realigned look-ahead recovery plans.')}
                </p>
              </div>
              <button className="w-full mt-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition">
                <FileDown className="w-3.5 h-3.5" />
                {label('دانلود فایل Word', 'Download Word Doc')}
              </button>
            </div>

            {/* 3. Excel Tabular */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                    <FileSpreadsheet className="w-4.5 h-4.5" />
                  </div>
                  <span className="px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 bg-emerald-50 text-[9px] font-black">Excel XLSX</span>
                </div>
                <h4 className="text-[13px] font-black text-[#212529]">
                  {label('شیت محاسباتی وزن‌ها و مقادیر فیزیکی', 'Tabular Weights & Volumes Sheet')}
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  {label('داده‌های جدولی اوزان پروژه، مقادیر فیزیکی محقق‌شده بر اساس DPR روزانه، و ماتریس انحراف احجام مصرفی انبار.',
                         'Tabular weights data, actual physical volumes computed off daily DPR logs, and warehouse material consumption variance matrix.')}
                </p>
              </div>
              <button className="w-full mt-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition">
                <FileDown className="w-3.5 h-3.5" />
                {label('دانلود فایل Excel', 'Download Excel Sheet')}
              </button>
            </div>

          </div>
        </div>

        {/* Right Side: Data Ingestion & Live Sources Hooks */}
        <aside className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-200">
            <Layout className="w-4 h-4 text-cyan-600 flex-shrink-0" />
            <h3 className="text-[12px] font-black text-[#0f172a]">
              {label('اتصالات داده‌های زنده جهت تلفیق', 'Live Progress Ingestion Sources')}
            </h3>
          </div>
          
          <div className="flex-1 space-y-2 overflow-auto text-[10px] leading-relaxed">
            <p className="text-slate-500">
              {label('گزارش‌های تولیدی به‌صورت هوشمند داده‌های خام زیر را برای این دوره با هم ادغام می‌کنند:',
                     'The compiled reports automatically merge the following live data feeds for the selected period:')}
            </p>
            {[
              { l: label('گزارش روزانه (DPR انبار و نیروی انسانی)', 'Daily DPR Manpower & Warehouse logs'), done: true },
              { l: label('منحنی پیشرفت انحراف S (کنترل)', 'Control S-Curve variance'), done: true },
              { l: label('منطق هسته مسیر بحرانی (CPM)', 'CPM Critical Path Method logic'), done: true },
              { l: label('هشدارهای حقوقی و ادعاهای معلق', 'Legal claim & EOT pending risks'), done: true },
            ].map((src, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="flex-1 text-slate-700 font-medium">{src.l}</span>
              </div>
            ))}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[9.5px] text-amber-800 font-medium">
              {label('پس از تغییر دوره در نوار بالا، پورتفولیو و شیت خروجی بلافاصله بازسازی و هم‌تراز می‌گردد.',
                     'Changing the period instantly rebuilds the compiled report, aligned to target reporting guidelines.')}
            </div>
          </div>
        </aside>
      </div>

      {/* STRICT EXCLUSION REMINDER STRIP */}
      <div className="bg-rose-50 border-t border-rose-200 px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
        <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
        <span className="text-[9.5px] text-rose-800 font-medium leading-snug">
          {label('کنترل اسناد ادعا — کلیه نمودارهای پیشرفت کارگاهی زنده، منحنی‌های پیشرفت اجرایی واقعی (S-Curve) و زمان‌بندی فیزیکی پویا از این صفحه حذف شده‌اند تا تمرکز کارخانه گزارش‌گیری صرفاً روی استخراج و صادر کردن پکیج‌های گزارش دوره مبنا باشد.',
                 'Reporting Hub Isolation — Live progress charts, actual S-Curves and dynamic physical scheduling are barred from this view to keep periodic report package compilation and document export fully isolated.')}
        </span>
      </div>

      {advisor && <AdvisorDrawer lang={lang} title={advisor} onClose={() => setAdvisor(null)} />}
    </div>
  );
}
