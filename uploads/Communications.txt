import { useState, useMemo, useRef } from 'react';
import {
  X, ChevronDown, Lightbulb, UploadCloud, Download,
  FileText, FileSpreadsheet, FileType2, Mail,
  Clock, ShieldAlert, FileCheck2, Scale, Send,
  CheckSquare, Layers, AlertCircle,
} from 'lucide-react';

/* ==========================================================================
   SHARED TYPES & HELPERS
   ========================================================================== */
export type Lang = 'fa' | 'en';
const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

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

/* ==========================================================================
   1. CLEAN 2-FIELD CENTER SELECTOR MODAL (z-index: 9999)
   Strictly TWO dropdowns: [انتخاب صنعت] & [انتخاب پروژه] + Submit
   ========================================================================== */
export function CommsSelectorModal({
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
            <Mail className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-black text-[#0f172a] leading-tight">
              {lang === 'fa' ? 'ماژول ارتباطات و اسناد' : 'Communications & Documents Module'}
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
            {lang === 'fa' ? 'ورود به محیط مدیریت ارتباطات' : 'Enter Communications Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. FULLSCREEN COMMUNICATIONS WORKSPACE (v5.0.0-beta)
   ========================================================================== */
export function CommunicationsWorkspacePage({
  lang, sectorName, projectName, onClose,
}: {
  lang: Lang; sectorName: string; projectName: string; onClose: () => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const fmt = (n: number | string) => (lang === 'fa' ? toFa(n) : String(n));
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);

  const [template, setTemplate] = useState<'base' | 'client'>('base');
  const [customFile, setCustomFile] = useState<string | null>(null);
  const [advisor, setAdvisor] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const adv = useMemo(() => (t: string) => setAdvisor(t), []);

  const clientTemplates = [
    { fa: 'قالب رسمی ترانسمیتال مدارک مهندسی', en: 'Official Document Transmittal Template', formats: ['xlsx', 'pdf'] as Fmt[] },
    { fa: 'فرم رسمی ابلاغ دستورکار کارگاه (SI)', en: 'Mandated Site Instruction (SI) Form', formats: ['docx', 'pdf'] as Fmt[] },
    { fa: 'قالب استاندارد صورت‌جلسه کارگاهی (MOM)', en: 'Standard Minutes of Meeting (MOM) Template', formats: ['docx', 'xlsx'] as Fmt[] },
  ];

  return (
    <div dir={dir} className="scada-workspace fixed inset-0 bg-[#F8F9FA] flex flex-col" style={{ zIndex: 9998 }}>
      {/* Page Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-black text-[#0f172a] leading-tight">
              {label('سامانه پیشرفته مدیریت ارتباطات و اسناد', 'Advanced Communications & Documents System')}
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 text-[9px] font-bold">
              {label('کنترل مکاتبات و ادعاها', 'Correspondence & Claim Control')}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[9px] font-black">
              v5.0.0-beta
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

      {/* Top Region: Dual-Format PMS Toggle + AI Legal & Claim Warning Panel */}
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
                {label('فایل لوگ مکاتبات داخلی را بارگذاری کنید تا هوش مصنوعی وضعیت پاسخ‌دهی را استخراج کند.',
                       'Upload internal correspondence log file for AI response-aging extraction.')}
              </p>
              <div
                onClick={() => uploadRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); setCustomFile(e.dataTransfer.files?.[0]?.name ?? null); }}
                className={`cursor-pointer rounded-xl border-2 border-dashed transition p-3.5 text-center ${
                  customFile ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50' : 'border-cyan-300 bg-cyan-50/40 hover:bg-cyan-50 hover:border-cyan-500'
                }`}
              >
                <UploadCloud className={`w-6 h-6 mx-auto mb-1 ${customFile ? 'text-emerald-600' : 'text-cyan-600'}`} />
                <div className={`text-[11px] font-black ${customFile ? 'text-emerald-800' : 'text-cyan-900'} truncate`}>
                  {customFile ?? label('فایل لوگ مکاتبات (.xlsx / .docx) را رها کنید', 'Drop correspondence log file here')}
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
                {label('قالب‌های ابلاغی کارفرما برای دانلود سریع:', 'Official mandated templates for instant download:')}
              </p>
              {clientTemplates.map((tpl) => (
                <div key={tpl.fa} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-slate-700 truncate">{label(tpl.fa, tpl.en)}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {tpl.formats.map((f) => {
                      const meta = FORMAT_META[f];
                      const FIcon = meta.Icon;
                      return (
                        <button key={f} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[8px] font-black ${meta.cls}`}>
                          <Download className="w-2.5 h-2.5" />
                          <FIcon className="w-2.5 h-2.5" />
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

        {/* AI-Driven Legal & Claim Warning Box */}
        <div className="rounded-2xl bg-gradient-to-l from-rose-50 via-white to-amber-50/60 border border-rose-300 shadow-sm p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow text-white flex-shrink-0">
                  <Scale className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-[12px] font-black text-rose-900 leading-tight">
                    {label('بخش هوشمند هشدارهای حقوقی اسناد و ادعاهای قراردادی', 'AI Legal Claim & Contractual Warning Panel')}
                  </h3>
                  <p className="text-[9.5px] text-rose-700/80 font-bold mt-0.5">
                    {label('تحلیل خودکار ریسک‌های حقوقی و مهلت‌های قانونی پاسخ به کارفرما', 'Automated legal risk analysis and response deadline exposure')}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-black text-[9px] shadow-sm flex-shrink-0">
                {label('هشدار حقوقی فعال', 'ACTIVE LEGAL ALERT')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              <div className="p-2 rounded-xl bg-white/80 border border-rose-200">
                <div className="flex items-center gap-1.5 text-rose-800 font-bold text-[10px]">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                  <span>{label('نامه L-302 معوق', 'Letter L-302 Pending')}</span>
                </div>
                <div className="text-[9px] text-slate-600 mt-1">
                  {label('تاخیر ۱۴ روزه کارفرما در ابلاغ پاسخ؛ ریسک زوال حق ادعای خسارت (Time-Bar)', '14-day client response delay; exposure to contractual Time-Bar')}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white/80 border border-amber-200">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[10px]">
                  <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>{label('مهلت اخطار تغییر (Notice of Variation)', 'Notice of Variation Window')}</span>
                </div>
                <div className="text-[9px] text-slate-600 mt-1">
                  {label('باقیمانده: ۳ روز جهت ارسال اخطار رسمی دستورکار SI-022', '3 days remaining to submit formal variation notice for SI-022')}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white/80 border border-blue-200">
                <div className="flex items-center gap-1.5 text-blue-800 font-bold text-[10px]">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>{label('محافظت در برابر خسارت تأخیر (LD)', 'Liquidated Damages Protection')}</span>
                </div>
                <div className="text-[9px] text-slate-600 mt-1">
                  {label('استناد به صورت‌جلسه MOM-102 جهت اثبات تأخیر کارفرما', 'Reference MOM-102 to substantiate Client-caused delay defense')}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-rose-200/60 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[9.5px] text-slate-600 font-medium">
              {label('پیشنهاد هوش مصنوعی: ارسال فوری اخطار رسمی حقوقی طبق ماده ۵۳ شرایط عمومی پیمان', 'AI Recommendation: Immediately dispatch formal legal notice per Clause 53')}
            </span>
            <button
              onClick={() => adv(label('مشاوره حقوقی و تاکتیکی ادعای قراردادی', 'Contractual Claim Tactical Consultation'))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-l from-rose-500 to-amber-500 text-white text-[10px] font-black shadow transition hover:opacity-90 flex-shrink-0"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              {label('مشاوره فنی حقوقی', 'Legal Consult')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: 4 Core Functional Dashboard Components */}
      <div className="flex-1 min-h-0 overflow-auto p-2 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-2">
        
        {/* Component 1: مدیریت مکاتبات (Correspondence Management) */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                <Send className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[12px] font-black text-[#212529]">
                  {label('۱. مدیریت مکاتبات (Inbound / Outbound Letters)', '1. Correspondence Management')}
                </h4>
                <p className="text-[9px] text-slate-500">
                  {label('لوگ نامه‌ها + شمارشگر قدمت پاسخ (Aging Tickers)', 'Letter logs + Response Aging Tickers')}
                </p>
              </div>
            </div>
            <button
              onClick={() => adv(label('مشاوره مدیریت مکاتبات و پاسخ‌دهی', 'Correspondence Management Consultation'))}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition"
            >
              <Lightbulb className="w-3 h-3" />
              {label('مشاوره فنی', 'Consult')}
            </button>
          </div>

          <div className="flex-1 overflow-auto space-y-1.5">
            {[
              { code: 'LTR-C-102', dir: 'out', subj: label('ارسال برآورد تأخیر زمانی دستورکار SI-022', 'Submission of EOT claim for SI-022'), date: '1403/03/10', age: 14, status: 'overdue' },
              { code: 'LTR-E-405', dir: 'in', subj: label('ابلاغ نظریه مشاور درباره نقشه‌های IFC واحد ۲', 'Consultant review on Unit 2 IFC drawings'), date: '1403/03/18', age: 6, status: 'pending' },
              { code: 'LTR-C-099', dir: 'out', subj: label('اخطار توقف کارگاه به دلیل عدم پرداخت صورت‌وضعیت', 'Standstill notice due to unpaid progress claim'), date: '1403/03/01', age: 23, status: 'critical' },
              { code: 'LTR-E-388', dir: 'in', subj: label('تأییدیه مشاور فنی درباره دستورکار تغییر متریال', 'Consultant approval on material substitution SI'), date: '1403/02/25', age: 0, status: 'closed' },
            ].map((item) => (
              <div key={item.code} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-[10px]">
                <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[8.5px] ${
                  item.dir === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'
                }`}>
                  {item.dir === 'in' ? label('ورودی', 'IN') : label('خروجی', 'OUT')}
                </span>
                <span className="font-mono font-bold text-slate-800" dir="ltr">{item.code}</span>
                <span className="flex-1 text-slate-700 truncate font-medium">{item.subj}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[9px] text-slate-500 font-mono">{fmt(item.date)}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[8.5px] ${
                    item.status === 'overdue' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                    item.status === 'critical' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                    item.status === 'closed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {item.status === 'closed' ? label('بسته', 'Closed') : `${fmt(item.age)} ${label('روز معوق', 'days aging')}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Component 2: وضعیت صورت‌جلسات (MOM Tracking) */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <CheckSquare className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[12px] font-black text-[#212529]">
                  {label('۲. وضعیت صورت‌جلسات (MOM Action Item Register)', '2. Minutes of Meeting (MOM) Tracking')}
                </h4>
                <p className="text-[9px] text-slate-500">
                  {label('پیگیری تعهدات، اقدام‌کنندگان و مهلت‌های مصوب جلسات', 'Action items, assigned parties and deadlines')}
                </p>
              </div>
            </div>
            <button
              onClick={() => adv(label('مشاوره پیگیری تعهدات صورت‌جلسات', 'MOM Commitments Tracking Consultation'))}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition"
            >
              <Lightbulb className="w-3 h-3" />
              {label('مشاوره فنی', 'Consult')}
            </button>
          </div>

          <div className="flex-1 overflow-auto space-y-1.5">
            {[
              { id: 'MOM-102/01', title: label('تحویل زمین فرانت دوم برق توسط کارفرما', 'Client site-handover for Elec Front 2'), party: label('کارفرما', 'Client'), due: '1403/03/15', status: 'overdue' },
              { id: 'MOM-102/02', title: label('ارائه برنامه جبرانی ۲ ماهه توسط پیمانکار', 'Contractor 2-month recovery plan submission'), party: label('پیمانکار', 'Contractor'), due: '1403/03/22', status: 'done' },
              { id: 'MOM-103/01', title: label('بررسی و تایید مدرک IFR لوله‌کشی توسط مشاور', 'Consultant review on Piping IFR doc'), party: label('مشاور', 'Consultant'), due: '1403/03/25', status: 'pending' },
              { id: 'MOM-103/02', title: label('اصلاح نقشه جانمایی پمپ‌های هیدرولیک', 'Hydraulic pump layout drawing revision'), party: label('پیمانکار', 'Contractor'), due: '1403/03/28', status: 'pending' },
            ].map((item) => (
              <div key={item.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-[10px]">
                <span className="font-mono font-bold text-slate-700" dir="ltr">{item.id}</span>
                <span className="flex-1 text-slate-800 font-medium truncate">{item.title}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[8.5px]">{item.party}</span>
                <span className="text-[9px] text-slate-500 font-mono">{fmt(item.due)}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[8.5px] ${
                  item.status === 'overdue' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                  item.status === 'done' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                  'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {item.status === 'overdue' ? label('معوق', 'Overdue') : item.status === 'done' ? label('انجام شد', 'Closed') : label('در جریان', 'In Progress')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Component 3: دستورکارها و ابلاغیه‌ها (Site Instructions) */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <FileCheck2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[12px] font-black text-[#212529]">
                  {label('۳. دستورکارها و ابلاغیه‌ها (Site Instructions & Variations)', '3. Site Instructions & Variations')}
                </h4>
                <p className="text-[9px] text-slate-500">
                  {label('پایش دستورکارهای تغییر کارفرما و اثرات مالی/زمانی', 'Client variations and time/cost impact tracking')}
                </p>
              </div>
            </div>
            <button
              onClick={() => adv(label('مشاوره تحلیل اثرات مالی و زمانی دستورکارها', 'Site Instructions Impact Consultation'))}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition"
            >
              <Lightbulb className="w-3 h-3" />
              {label('مشاوره فنی', 'Consult')}
            </button>
          </div>

          <div className="flex-1 overflow-auto space-y-1.5">
            {[
              { code: 'SI-022', title: label('تغییر متریال لوله‌های فولادی به زنگ‌نزن', 'Stainless steel pipe material change'), costImpact: '+۴۵۰ م.ریال', timeImpact: '+۱۲ روز', status: 'approved' },
              { code: 'SI-023', title: label('افزایش عمق گودبرداری بلوک B', 'Excavation depth increase for Block B'), costImpact: '+۱۸۰ م.ریال', timeImpact: '+۵ روز', status: 'pending' },
              { code: 'SI-024', title: label('جابجایی مسیر کابل‌کشی فشار قوی', 'High voltage cabling route shift'), costImpact: '+۳۲۰ م.ریال', timeImpact: '+۸ روز', status: 'pending' },
            ].map((item) => (
              <div key={item.code} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-[10px]">
                <span className="font-mono font-bold text-[#0f172a]" dir="ltr">{item.code}</span>
                <span className="flex-1 text-slate-800 font-medium truncate">{item.title}</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-mono font-bold text-[8.5px]">{item.costImpact}</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono font-bold text-[8.5px]">{item.timeImpact}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[8.5px] ${
                  item.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {item.status === 'approved' ? label('ابلاغ شده', 'Approved') : label('در بررسی', 'Under Review')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Component 4: گردش مدرک و تاییدات (Transmittal Tracking) */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[12px] font-black text-[#212529]">
                  {label('۴. گردش مدرک و تاییدات (Transmittal Tracking)', '4. Transmittal & Submittal Lineage Tracking')}
                </h4>
                <p className="text-[9px] text-slate-500">
                  {label('پایش خط سیر مدارک مهندسی و کدهای تایید A/B/C/D', 'Engineering document submittals & Code A/B/C/D approval states')}
                </p>
              </div>
            </div>
            <button
              onClick={() => adv(label('مشاوره بهینه‌سازی گردش ترانسمیتال‌ها', 'Transmittal Lineage Consultation'))}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition"
            >
              <Lightbulb className="w-3 h-3" />
              {label('مشاوره فنی', 'Consult')}
            </button>
          </div>

          <div className="flex-1 overflow-auto space-y-1.5">
            {[
              { code: 'TR-801', docName: label('نقشه فونداسیون مخزن T-101', 'Tank T-101 Foundation Drawing'), rev: 'Rev 02', codeClass: 'Code A', status: 'approved' },
              { code: 'TR-802', docName: label('دیاگرام تک‌خطی سیستم برق', 'Single Line Diagram Electrical'), rev: 'Rev 01', codeClass: 'Code B', status: 'review' },
              { code: 'TR-803', docName: label('دفترچه محاسبات هیدرولیک', 'Hydraulic Calculation Book'), rev: 'Rev 00', codeClass: 'Code C', status: 'rejected' },
              { code: 'TR-804', docName: label('مشخصات فنی پمپ‌های سانتریفیوژ', 'Centrifugal Pumps Specification'), rev: 'Rev 01', codeClass: 'Code A', status: 'approved' },
            ].map((item) => (
              <div key={item.code} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-[10px]">
                <span className="font-mono font-bold text-[#0f172a]" dir="ltr">{item.code}</span>
                <span className="flex-1 text-slate-800 font-medium truncate">{item.docName}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[8.5px]">{item.rev}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[8.5px] ${
                  item.codeClass === 'Code A' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                  item.codeClass === 'Code B' ? 'bg-cyan-100 text-cyan-800 border border-cyan-300' :
                  'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  {item.codeClass}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Technical Consultation Drawer */}
      {advisor && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
          style={{ zIndex: 10000 }}
          onClick={() => setAdvisor(null)}
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
                  {label('مشاوره فنی حقوقی و ادعایی', 'Legal & Claim Technical Consultation')}
                </h4>
                <p className="text-[10px] text-slate-500 truncate">{advisor}</p>
              </div>
              <button onClick={() => setAdvisor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-[11px] text-[#212529] leading-relaxed space-y-2">
              <p>
                {label(
                  'این ویجت بر پایه اصول حقوقی ادعاهای قراردادی (Claim Management) و شرایط عمومی پیمان محاسبه می‌شود. کلیه نامه‌های معوق، صورت‌جلسات بلاتکلیف و ابلاغیه‌ها برای حفظ دفاعیات تمدید پیمان (EOT) رهگیری می‌شوند.',
                  'This widget computes based on contractual claim management principles and FIDIC/Standard conditions. All aging letters, open MOM items, and SIs are tracked to preserve EOT defense claims.'
                )}
              </p>
              <div className="p-2 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 font-bold text-[10px]">
                {label('توصیه تاکتیکی: ثبت اخطار رسمی برای نامه‌های بالای ۱۴ روز معوق به همراه صورت‌جلسات مصوب.', 'Tactical advice: Issue formal notice for letters aging over 14 days with attached signed MOMs.')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
