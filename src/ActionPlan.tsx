import { useState, useRef } from 'react';
import {
  X, ChevronDown, UploadCloud, Download, Lightbulb, Target,
  FileText, FileSpreadsheet, FileType2, CheckCircle2, ShieldAlert,
  GitBranch, Layers, Zap, Telescope, Compass, Link2,
} from 'lucide-react';

/* ==========================================================================
   TYPES & HELPERS
   ========================================================================== */
export type Lang = 'fa' | 'en';
const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

export interface SectorOption {
  key: string;
  name: string;
  nameEn: string;
  projects: { id: string; name: string; nameEn: string }[];
}

type PlanHorizon = 1 | 2 | 3;

const FORMAT_META = {
  xlsx: { label: 'XLSX', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: FileSpreadsheet },
  docx: { label: 'DOCX', cls: 'bg-blue-50 text-blue-700 border-blue-300', Icon: FileText },
  pdf: { label: 'PDF', cls: 'bg-rose-50 text-rose-700 border-rose-300', Icon: FileType2 },
} as const;
type Fmt = keyof typeof FORMAT_META;

/* Standard system templates (Scenario B) */
const STANDARD_TEMPLATES: {
  horizon: PlanHorizon; fa: string; en: string; formats: Fmt[];
  icon: any; accent: string; descFa: string; descEn: string;
}[] = [
  {
    horizon: 1, icon: Zap, accent: 'from-rose-500 to-orange-500',
    fa: 'قالب خام برنامه اقدام ۱ ماهه ضربتی',
    en: '1-Month Rapid-Strike Action Plan Template',
    formats: ['docx', 'xlsx'],
    descFa: 'تمرکز بر رفع گلوگاه‌های بحرانی فوری و بازیابی سریع مسیر بحرانی.',
    descEn: 'Focused on clearing immediate critical bottlenecks and fast critical-path recovery.',
  },
  {
    horizon: 2, icon: Telescope, accent: 'from-cyan-500 to-blue-600',
    fa: 'قالب خام برنامه اقدام ۲ ماهه نگاه به آینده',
    en: '2-Month Look-Ahead Action Plan Template',
    formats: ['docx', 'xlsx'],
    descFa: 'هماهنگ‌سازی منابع و تدارکات برای پنجره پیش‌روی دو ماهه.',
    descEn: 'Aligns resources and procurement across the forward two-month window.',
  },
  {
    horizon: 3, icon: Compass, accent: 'from-blue-600 to-indigo-600',
    fa: 'قالب خام برنامه اقدام ۳ ماهه استراتژیک',
    en: '3-Month Strategic Action Plan Template',
    formats: ['docx', 'xlsx', 'pdf'],
    descFa: 'بازآرایی راهبردی مبنا، تعهدات نقاط عطف و برنامه جبرانی بلندتر.',
    descEn: 'Strategic baseline realignment, milestone commitments and extended recovery plan.',
  },
];

/* Upstream data hooks (Module 2 + Module 4) */
const UPSTREAM_FEEDS = [
  {
    src: 'M2', icon: Layers, cls: 'bg-cyan-50 border-cyan-200 text-cyan-800',
    fa: 'ماژول ۲ — زمان‌بندی مبنا و WBS',
    en: 'Module 2 — Baseline Schedule & WBS',
    itemsFa: ['ساختار شکست کار (WBS)', 'زمان‌بندی مبنا (Baseline)', 'روابط پیش‌نیازی فعالیت‌ها'],
    itemsEn: ['Work Breakdown Structure (WBS)', 'Baseline Schedule', 'Activity predecessor logic'],
  },
  {
    src: 'M4', icon: GitBranch, cls: 'bg-blue-50 border-blue-200 text-blue-800',
    fa: 'ماژول ۴ — انحراف و موانع کارگاهی',
    en: 'Module 4 — Variance & Site Impediments',
    itemsFa: ['انحراف منحنی S واقعی', 'گلوگاه‌های مسیر بحرانی', 'موانع ثبت‌شده کارفرما / مشاور'],
    itemsEn: ['Actual S-Curve variance', 'Critical-path bottlenecks', 'Logged Client / Consultant impediments'],
  },
];

/* ==========================================================================
   1. CENTERED SELECTOR MODAL (Sector + Project)
   ========================================================================== */
export function ActionPlanSelectorModal({
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
        <div className="px-4 py-3.5 bg-gradient-to-l from-cyan-50 via-white to-blue-50 border-b border-slate-200 flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Target className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-black text-[#0f172a] leading-tight">
              {lang === 'fa' ? 'ماژول برنامه‌های اقدام کوتاه‌مدت' : 'Short-Term Action Plan Module'}
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
            {lang === 'fa' ? 'ورود به محیط برنامه اقدام' : 'Enter Action Plan Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. FULLSCREEN ACTION PLAN WORKSPACE
   ========================================================================== */
export function ActionPlanPage({
  lang, sectorName, projectName, onClose,
}: {
  lang: Lang;
  sectorName: string;
  projectName: string;
  onClose: () => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const fmt = (n: number | string) => (lang === 'fa' ? toFa(n) : String(n));

  const [customTemplate, setCustomTemplate] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<PlanHorizon>(1);
  const [generated, setGenerated] = useState(false);
  const [advisorTitle, setAdvisorTitle] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Output blocks driven by selected horizon
  const outputBlocks = (() => {
    const common = {
      1: {
        fa: ['اقدامات ضربتی هفته ۱ تا ۴', 'تخصیص فوری منابع بحرانی', 'رفع موانع کارفرما / مشاور', 'بازیابی فعالیت‌های شناوری صفر'],
        en: ['Week 1–4 rapid strike actions', 'Immediate critical resource allocation', 'Client / Consultant blocker clearance', 'Zero-float activity recovery'],
      },
      2: {
        fa: ['برنامه نگاه به آینده ۸ هفته', 'هماهنگی تدارکات و اقلام Long-Lead', 'تراز منابع میان‌مدت', 'پایش فعالیت‌های نزدیک‌بحرانی'],
        en: ['8-week look-ahead plan', 'Procurement & long-lead coordination', 'Mid-term resource leveling', 'Near-critical activity watch'],
      },
      3: {
        fa: ['بازآرایی راهبردی مبنا', 'تعهدات نقاط عطف سه‌ماهه', 'برنامه جبرانی تجمیعی', 'سناریوهای فشرده‌سازی زمان‌بندی'],
        en: ['Strategic baseline realignment', 'Quarterly milestone commitments', 'Aggregate recovery program', 'Schedule compression scenarios'],
      },
    } as const;
    return (lang === 'fa' ? common[horizon].fa : common[horizon].en);
  })();

  const activeTpl = STANDARD_TEMPLATES.find((t) => t.horizon === horizon)!;

  return (
    <div dir={dir} className="scada-workspace fixed inset-0 bg-[#F8F9FA] flex flex-col" style={{ zIndex: 9998 }}>
      {/* ---- Header ---- */}
      <header className="bg-white border-b border-slate-200 shadow-sm px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
          <Target className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-black text-[#0f172a] leading-tight">
              {lang === 'fa' ? 'سامانه پیشرفته برنامه‌های اقدام کوتاه‌مدت (Action Plan)' : 'Advanced Short-Term Action Plan System'}
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200 text-[9px] font-bold">
              {lang === 'fa' ? 'بازآرایی و جبران کوتاه‌مدت' : 'Short-Term Realignment'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[9px] font-black">
              v2.2.0-beta
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

      {/* ---- Upstream data-hook strip (Module 2 + Module 4) ---- */}
      <section className="bg-white border-b border-slate-200 px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
          <h3 className="text-[11px] font-black text-[#212529]">
            {lang === 'fa' ? 'اتصال داده‌های ورودی (خودکار)' : 'Automatic Upstream Data Hooks'}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {UPSTREAM_FEEDS.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.src} className={`rounded-xl border px-3 py-2 flex items-start gap-2.5 ${f.cls}`}>
                <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-black leading-tight">{lang === 'fa' ? f.fa : f.en}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {(lang === 'fa' ? f.itemsFa : f.itemsEn).map((it) => (
                      <span key={it} className="inline-flex items-center gap-1 text-[8.5px] font-medium opacity-80">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Body: dual-scenario factory + outputs ---- */}
      <div className="flex-1 min-h-0 overflow-auto p-3 grid grid-cols-1 xl:grid-cols-2 gap-3 max-w-[2560px] w-full mx-auto">

        {/* ===== SCENARIO A — user custom template upload ===== */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center text-[10px] font-black flex-shrink-0">A</span>
            <h3 className="text-[13px] font-black text-[#212529]">
              {lang === 'fa' ? 'سناریو الف — قالب اختصاصی سازمان شما' : 'Scenario A — Your Organization\'s Custom Template'}
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 mb-3">
            {lang === 'fa'
              ? 'شیت برنامه اقدام سازمان خود را بارگذاری کنید؛ هوش مصنوعی معیارهای پیشرفت کارگاه را دقیقاً در همان ساختار شخصی شما نگاشت می‌کند.'
              : 'Upload your organization\'s Action Plan sheet; the AI maps site progress metrics into your exact personal format structure.'}
          </p>

          <div
            onClick={() => uploadRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setCustomTemplate(e.dataTransfer.files?.[0]?.name ?? null); }}
            className={`cursor-pointer rounded-xl border-2 border-dashed transition p-6 text-center ${
              customTemplate
                ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50'
                : 'border-cyan-300 bg-cyan-50/40 hover:bg-cyan-50 hover:border-cyan-500'
            }`}
          >
            <UploadCloud className={`w-9 h-9 mx-auto mb-2 ${customTemplate ? 'text-emerald-600' : 'text-cyan-600'}`} />
            <div className={`text-[11.5px] font-black ${customTemplate ? 'text-emerald-800' : 'text-cyan-900'}`}>
              {customTemplate ?? (lang === 'fa' ? 'قالب اختصاصی خود را اینجا رها کنید' : 'Drop your custom template here')}
            </div>
            <div className="text-[9px] text-slate-500 mt-1">.xlsx · .docx · .pdf</div>
            <input
              ref={uploadRef}
              type="file"
              accept=".xls,.xlsx,.doc,.docx,.pdf"
              className="hidden"
              onChange={(e) => setCustomTemplate(e.target.files?.[0]?.name ?? null)}
            />
          </div>

          {customTemplate && (
            <div className="mt-2.5 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="flex-1 text-[10px] font-bold text-emerald-800 truncate">
                {lang === 'fa' ? 'نگاشت داده در ساختار شخصی شما فعال شد' : 'Mapping into your personal structure is active'}
              </span>
              <button onClick={() => setCustomTemplate(null)} className="text-[9px] text-rose-600 hover:underline flex-shrink-0">
                {lang === 'fa' ? 'حذف' : 'Remove'}
              </button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
            <div className="text-[10px] font-bold text-slate-600">
              {lang === 'fa' ? 'نگاشت خودکار انجام‌شده:' : 'Auto-mapped into your template:'}
            </div>
            {(lang === 'fa'
              ? ['درصد پیشرفت فعالیت‌های کارگاهی', 'انحراف زمانی نسبت به مبنا', 'موانع تخصیص‌یافته به کارفرما / مشاور', 'اولویت اقدامات جبرانی']
              : ['Site activity progress %', 'Schedule variance vs baseline', 'Blockers attributed to Client / Consultant', 'Recovery action priority']
            ).map((x) => (
              <div key={x} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0" />
                {x}
              </div>
            ))}
          </div>
        </section>

        {/* ===== SCENARIO B — system standard templates ===== */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-black flex-shrink-0">B</span>
            <h3 className="text-[13px] font-black text-[#212529]">
              {lang === 'fa' ? 'سناریو ب — قالب استاندارد سامانه' : 'Scenario B — System Standard Templates'}
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 mb-3">
            {lang === 'fa'
              ? 'قالب‌های خام کارشناسی‌شده را دانلود و بلافاصله در کارگاه تکمیل کنید.'
              : 'Download expert-vetted blank templates for instant work-site fill-out.'}
          </p>

          <div className="space-y-2.5 flex-1">
            {STANDARD_TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              const isActive = horizon === tpl.horizon;
              return (
                <div
                  key={tpl.horizon}
                  onClick={() => setHorizon(tpl.horizon)}
                  className={`cursor-pointer rounded-2xl border p-3 transition ${
                    isActive ? 'border-cyan-400 bg-cyan-50/60 shadow-sm' : 'border-slate-200 bg-slate-50/60 hover:border-cyan-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tpl.accent} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <Icon className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11.5px] font-black text-[#212529] leading-snug">
                        {lang === 'fa' ? tpl.fa : tpl.en}
                      </h4>
                      <p className="text-[9.5px] text-slate-500 mt-0.5 leading-snug">
                        {lang === 'fa' ? tpl.descFa : tpl.descEn}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {tpl.formats.map((f) => {
                          const meta = FORMAT_META[f];
                          const FIcon = meta.Icon;
                          return (
                            <button
                              key={f}
                              onClick={(e) => e.stopPropagation()}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black transition hover:opacity-80 ${meta.cls}`}
                            >
                              <Download className="w-2.5 h-2.5" />
                              <FIcon className="w-2.5 h-2.5" />
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== OUTPUT SECTION — AI generated action plan ===== */}
        <section className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2 min-w-0">
              <activeTpl.icon className="w-4 h-4 text-cyan-600 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-[13px] font-black text-[#212529] truncate">
                  {lang === 'fa'
                    ? `خروجی برنامه اقدام ${fmt(horizon)} ماهه`
                    : `${horizon}-Month Action Plan Output`}
                </h3>
                <p className="text-[9.5px] text-slate-500">
                  {customTemplate
                    ? (lang === 'fa' ? `نگاشت‌شده در قالب: ${customTemplate}` : `Mapped into: ${customTemplate}`)
                    : (lang === 'fa' ? 'در قالب استاندارد سامانه' : 'In system standard template')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setGenerated(true)}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-l from-cyan-500 to-blue-600 text-white text-[10px] font-black hover:from-cyan-600 hover:to-blue-700 transition shadow-sm"
              >
                {generated ? (lang === 'fa' ? 'بهینه‌سازی مجدد' : 'Re-optimize') : (lang === 'fa' ? 'تولید برنامه بهینه' : 'Generate Optimized Plan')}
              </button>
              <button
                onClick={() => setAdvisorTitle(lang === 'fa' ? 'منطق کلی برنامه جبرانی' : 'Overall Recovery Plan Logic')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold transition"
              >
                <Lightbulb className="w-3 h-3" />
                {lang === 'fa' ? 'مشاوره فنی' : 'Consult'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2.5">
            {outputBlocks.map((blk, i) => (
              <div
                key={blk}
                className={`rounded-2xl border p-3 transition ${
                  generated ? 'border-cyan-200 bg-cyan-50/40' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                    generated ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {fmt(i + 1)}
                  </div>
                  <h4 className="flex-1 text-[11px] font-black text-[#212529] leading-snug">{blk}</h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={!generated}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold transition ${
                      generated
                        ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-2.5 h-2.5" />
                    {lang === 'fa' ? 'دانلود' : 'Download'}
                  </button>
                  <button
                    onClick={() => setAdvisorTitle(blk)}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition"
                  >
                    <Lightbulb className="w-2.5 h-2.5" />
                    {lang === 'fa' ? 'مشاوره' : 'Consult'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Scope exclusion notice */}
          <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="text-[9.5px] text-rose-800 leading-snug">
              {lang === 'fa'
                ? 'نمودارهای کنترل پروژه زنده و خطوط منحنی S اجرایی از این صفحه حذف شده‌اند. این محیط صرفاً به بازآرایی برنامه‌ریزی کوتاه‌مدت و بسته‌های سند جبرانی اختصاص دارد.'
                : 'Live project-control charts and execution S-Curve lines are excluded from this page. This workspace is dedicated solely to short-term planning realignment and recovery document packages.'}
            </div>
          </div>
        </section>
      </div>

      {/* ---- Advisor drawer ---- */}
      {advisorTitle && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
          style={{ zIndex: 10000 }}
          onClick={() => setAdvisorTitle(null)}
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
                <p className="text-[10px] text-slate-500 truncate">{advisorTitle}</p>
              </div>
              <button onClick={() => setAdvisorTitle(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <div className="text-[10px] font-bold text-slate-500 mb-1">
                  {lang === 'fa' ? 'منطق مهندسی برنامه جبرانی' : 'Recovery Plan Engineering Logic'}
                </div>
                <p className="text-[11px] text-[#212529] leading-relaxed">
                  {lang === 'fa'
                    ? 'اولویت‌بندی بر پایه شناوری کل صفر و بیشترین اثر بر مسیر بحرانی انجام می‌شود. ابتدا موانع تخصیص‌یافته به کارفرما و مشاور رفع و سپس فشرده‌سازی زمان‌بندی (Crashing / Fast-Tracking) روی فعالیت‌های بحرانی اعمال می‌گردد.'
                    : 'Prioritization is driven by zero total float and maximum critical-path impact. Client- and Consultant-attributed blockers are cleared first, then schedule compression (crashing / fast-tracking) is applied to critical activities.'}
                </p>
              </div>
              <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-3">
                <div className="text-[10px] font-bold text-cyan-700 mb-1">
                  {lang === 'fa' ? 'منابع داده‌ای ورودی' : 'Upstream Data Sources'}
                </div>
                <p className="text-[11px] text-cyan-900 leading-relaxed">
                  {lang === 'fa'
                    ? 'ماژول ۲ (WBS و زمان‌بندی مبنا) و ماژول ۴ (انحراف منحنی S، گلوگاه مسیر بحرانی و موانع کارگاهی ثبت‌شده).'
                    : 'Module 2 (WBS & baseline schedule) and Module 4 (S-Curve variance, critical-path bottlenecks and logged site impediments).'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
