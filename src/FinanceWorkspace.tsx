import { useState, useMemo, useRef } from 'react';
import {
  X, ChevronDown, Lightbulb, UploadCloud, Download, AlertTriangle,
  FileText, FileSpreadsheet, FileType2, ReceiptText, HardHat, ShoppingCart,
  CircleDollarSign, Banknote, Landmark, TrendingUp, ShieldCheck, Handshake,
  Calculator,
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

export type FinanceKind = 'invoices' | 'siteCosts' | 'procurement';

const FORMAT_META = {
  xlsx: { label: 'XLSX', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: FileSpreadsheet },
  docx: { label: 'DOCX', cls: 'bg-blue-50 text-blue-700 border-blue-300', Icon: FileText },
  pdf: { label: 'PDF', cls: 'bg-rose-50 text-rose-700 border-rose-300', Icon: FileType2 },
} as const;
type Fmt = keyof typeof FORMAT_META;

const KIND_META: Record<FinanceKind, {
  Icon: any;
  fa: string; en: string;
  workspaceFa: string; workspaceEn: string;
  submitFa: string; submitEn: string;
}> = {
  invoices: {
    Icon: ReceiptText,
    fa: 'بخش صورت‌وضعیت‌ها', en: 'Invoices Section',
    workspaceFa: 'سامانه مدیریت صورت‌وضعیت‌ها', workspaceEn: 'Invoice Management Workspace',
    submitFa: 'ورود به محیط صورت‌وضعیت', submitEn: 'Enter Invoice Workspace',
  },
  siteCosts: {
    Icon: HardHat,
    fa: 'بخش هزینه‌های کارگاهی', en: 'Site Costs Section',
    workspaceFa: 'سامانه هزینه‌های کارگاهی', workspaceEn: 'Site Costs Workspace',
    submitFa: 'ورود به محیط هزینه‌های کارگاهی', submitEn: 'Enter Site Costs Workspace',
  },
  procurement: {
    Icon: ShoppingCart,
    fa: 'بخش مالی خرید کالا', en: 'Procurement Financials Section',
    workspaceFa: 'سامانه مالی خرید کالا', workspaceEn: 'Procurement Financials Workspace',
    submitFa: 'ورود به محیط مالی خرید', submitEn: 'Enter Procurement Financials',
  },
};

/* ==========================================================================
   CLEAN 2-FIELD SELECTOR MODAL — shared by all 3 finance rows
   ========================================================================== */
export function FinanceSelectorModal({
  lang, kind, sectors, onClose, onSubmit,
}: {
  lang: Lang;
  kind: FinanceKind;
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
   SHARED UNIVERSAL WORKSPACE PIECES
   ========================================================================== */
type Template = 'base' | 'client';

/** 1. Dual PMS format toggle (Base / Client) */
function DualTemplateToggle({
  lang, template, onChange, onCustomFile, customFile, downloadFormats,
}: {
  lang: Lang;
  template: Template;
  onChange: (t: Template) => void;
  onCustomFile: (name: string | null) => void;
  customFile: string | null;
  downloadFormats: Fmt[];
}) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  const uploadRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      {/* Toggle switch */}
      <div dir="ltr" className="inline-flex w-full rounded-xl bg-slate-100 p-1 border border-slate-200">
        <button
          onClick={() => onChange('base')}
          className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-black transition ${
            template === 'base' ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-cyan-700'
          }`}
        >
          {label('قالب بیس و داخلی سازمان', 'Base Template')}
        </button>
        <button
          onClick={() => onChange('client')}
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
            {label('قالب اختصاصی سازمان خود را بارگذاری کنید تا داده‌های مالی در ساختار شما نگاشت شوند.',
                   'Upload your organization\'s custom template — financial data will be mapped into your structure.')}
          </p>
          <div
            onClick={() => uploadRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onCustomFile(e.dataTransfer.files?.[0]?.name ?? null); }}
            className={`cursor-pointer rounded-xl border-2 border-dashed transition p-4 text-center ${
              customFile
                ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50'
                : 'border-cyan-300 bg-cyan-50/40 hover:bg-cyan-50 hover:border-cyan-500'
            }`}
          >
            <UploadCloud className={`w-7 h-7 mx-auto mb-1.5 ${customFile ? 'text-emerald-600' : 'text-cyan-600'}`} />
            <div className={`text-[11px] font-black ${customFile ? 'text-emerald-800' : 'text-cyan-900'} truncate`}>
              {customFile ?? label('فایل قالب خود را اینجا رها کنید', 'Drop your custom template here')}
            </div>
            <div className="text-[9px] text-slate-500 mt-1">.xlsx · .docx · .pdf</div>
            <input
              ref={uploadRef}
              type="file"
              accept=".xls,.xlsx,.doc,.docx,.pdf"
              className="hidden"
              onChange={(e) => onCustomFile(e.target.files?.[0]?.name ?? null)}
            />
          </div>
          {customFile && (
            <button
              onClick={() => onCustomFile(null)}
              className="mt-1.5 w-full text-[9px] text-rose-600 hover:underline"
            >
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
                <button
                  key={f}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-black transition hover:opacity-80 ${meta.cls}`}
                >
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

/* ==========================================================================
   v2.3.1-Alpha — CIRCULAR 5090 EXTENSION CALCULATOR (Invoices workspace)
   Implements t = (A * V) / B for delay extensions due to payment delays.
   ========================================================================== */
function Circular5090Widget({
  lang, onAdvice,
}: {
  lang: Lang; onAdvice: (title: string, body?: string) => void;
}) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  const fmt = (n: number | string) => (lang === 'fa' ? toFa(n) : String(n));

  const [amountA, setAmountA] = useState(980); // delayed payment amount (B IRR)
  const [periodV, setPeriodV] = useState(30);   // claim period (days)
  const [contractB, setContractB] = useState(12400); // total contract value (B IRR)

  const safeB = Math.max(contractB, 1);
  const tDays = Number(((amountA * periodV) / safeB).toFixed(2));

  const build5090Letter = () => {
    return lang === 'fa'
      ? `لایحه رسمی درخواست تمدید مدت پیمان بر مبنای بخشنامه شماره ۵۰۹۰ سازمان برنامه و بودجه و ماده ۳۰ شرایط عمومی پیمان:\n\nموضوع: درخواست تمدید مدت پیمان به دلیل تأخیرات تأدیه وجوه صورت‌وضعیت‌ها\n\nبا سلام و احترام،\nپیرو قرارداد فی‌مابین به مبلغ کل ${fmt(contractB)} میلیارد ریال و با توجه به تأخیرات ایجادشده در پرداخت مبلغ ${fmt(amountA)} میلیارد ریال در دوره صورت‌وضعیت ${fmt(periodV)} روزه، مستند به فرمول صریح بخشنامه ۵۰۹۰ (t = A × V / B)، مدت زمان مستحق تمدید پیمان معادل ${fmt(tDays)} روز تقویمی برآورد می‌گردد. خواهشمند است دستور فرمایید نسبت به بررسی و اعمال این تمدید مدت در راستای ماده ۳۰ شرایط عمومی پیمان اقدامات مقتضی مبذول فرمایند.\n\nبا تجدید احترام`
      : `Official EOT Claim Brief per PMO Circular No. 5090 & Article 30 of General Conditions of Contract:\n\nSubject: Request for Contract Extension Due to Payment Delays\n\nDear Sirs,\nReferring to the contract valued at ${contractB}B IRR and noting the delayed payment of ${amountA}B IRR over the ${periodV}-day claim period, pursuant to Circular 5090 formula (t = A × V / B), the entitled contract extension is computed as ${tDays} calendar days. Kindly review and apply this extension pursuant to Article 30 of the General Conditions of Contract.\n\nSincerely`;
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-300 p-3 mt-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h4 className="text-[11px] font-black text-teal-900 leading-tight">
            {label('محاسبه تمدید مدت پیمان — بخشنامه ۵۰۹۰ و ماده ۳۰', 'Contract Extension Calculator — Circular 5090 & Article 30')}
          </h4>
          <div className="text-[9px] font-mono text-cyan-800 mt-0.5" dir="ltr">t = (A × V) / B</div>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white font-mono text-[10px] font-black">
          t = {fmt(tDays)} {label('روز', 'days')}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <label className="block">
          <span className="block text-[8px] font-black text-slate-600 mb-0.5">{label('مبلغ تأخیر (A)', 'Delay Amount (A)')}</span>
          <input type="number" value={amountA} onChange={(e) => setAmountA(Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-mono outline-none" dir="ltr" />
        </label>
        <label className="block">
          <span className="block text-[8px] font-black text-slate-600 mb-0.5">{label('دوره (V - روز)', 'Period (V - days)')}</span>
          <input type="number" value={periodV} onChange={(e) => setPeriodV(Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-mono outline-none" dir="ltr" />
        </label>
        <label className="block">
          <span className="block text-[8px] font-black text-slate-600 mb-0.5">{label('مبلغ کل (B - BAC)', 'Total Contract (B)')}</span>
          <input type="number" value={contractB} onChange={(e) => setContractB(Number(e.target.value) || 1)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-mono outline-none" dir="ltr" />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-slate-600 leading-snug">
          {label('مبنا: ضوابط تمدید مدت پیمان به‌دلیل تأخیرات مالی کارفرما', 'Basis: Contract extension rules for client financial delays')}
        </span>
        <button
          onClick={() => onAdvice(
            label('لایحه رسمی تأخیرات — بخشنامه ۵۰۹۰ و ماده ۳۰', 'Official EOT Claim Brief — Circular 5090 & Article 30'),
            build5090Letter()
          )}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[9.5px] font-bold transition flex-shrink-0"
        >
          <Lightbulb className="w-3 h-3" />
          {label('لایحه رسمی ۵۰۹۰ / ماده ۳۰', 'Official 5090 / Art.30 Brief')}
        </button>
      </div>
    </div>
  );
}

/**
 * PHASE 2 HARDCODED INTERACTIVE AI PREDICTIVE FORMULA PANEL
 * Specific FAC equations per workspace:
 * - Invoices:     FAC = AC + ((BAC - EV) / CPI)
 * - Site Costs:   FAC = AC + ((BAC - EV) / (CPI * SPI))
 * - Procurement:  FAC = AC + (BAC - EV)
 */
function AIFACPredictivePanel({
  lang,
  kind,
  onAdvice,
}: {
  lang: Lang;
  kind: FinanceKind;
  onAdvice: (title: string) => void;
}) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  const fmt = (n: number | string) => (lang === 'fa' ? toFa(n) : String(n));

  // Default initial values per workspace
  const defaults = {
    invoices:    { bac: 12500, ev: 9800, ac: 10800, cpi: 0.91, spi: 0.94 },
    siteCosts:   { bac: 5000,  ev: 3600, ac: 4100,  cpi: 0.88, spi: 0.82 },
    procurement: { bac: 8500,  ev: 5320, ac: 5800,  cpi: 0.92, spi: 0.89 },
  }[kind];

  const [bac, setBac] = useState<number>(defaults.bac);
  const [ev, setEv] = useState<number>(defaults.ev);
  const [ac, setAc] = useState<number>(defaults.ac);
  const [spiInput, setSpiInput] = useState<number>(defaults.spi);

  // Derived CPI
  const calculatedCPI = useMemo(() => {
    if (!ac || ac === 0) return 1.0;
    return Number((ev / ac).toFixed(2));
  }, [ev, ac]);

  // Compute FAC according to the required mathematical formula
  const { fac, etc, overrun, overrunPct, formulaStr } = useMemo(() => {
    const cpi = calculatedCPI <= 0 ? 0.01 : calculatedCPI;
    const spi = spiInput <= 0 ? 0.01 : spiInput;
    let computedFac = 0;
    let fStr = '';

    if (kind === 'invoices') {
      // FAC = AC + ((BAC - EV) / CPI)
      fStr = 'FAC = AC + ((BAC - EV) / CPI)';
      computedFac = ac + (bac - ev) / cpi;
    } else if (kind === 'siteCosts') {
      // FAC = AC + ((BAC - EV) / (CPI * SPI))
      fStr = 'FAC = AC + ((BAC - EV) / (CPI × SPI))';
      computedFac = ac + (bac - ev) / (cpi * spi);
    } else {
      // procurement: FAC = AC + (BAC - EV)
      fStr = 'FAC = AC + (BAC - EV)';
      computedFac = ac + (bac - ev);
    }

    // Ensure finite numbers
    if (!isFinite(computedFac) || isNaN(computedFac)) computedFac = bac;

    const roundedFac = Math.round(computedFac);
    const calculatedEtc = Math.max(0, Math.round(roundedFac - ac));
    const calculatedOverrun = roundedFac - bac;
    const calculatedOverrunPct = bac > 0 ? Number(((calculatedOverrun / bac) * 100).toFixed(1)) : 0;

    return {
      fac: roundedFac,
      etc: calculatedEtc,
      overrun: calculatedOverrun,
      overrunPct: calculatedOverrunPct,
      formulaStr: fStr,
    };
  }, [kind, bac, ev, ac, calculatedCPI, spiInput]);

  const isOverrun = overrun > 0;
  const badgeCls = isOverrun
    ? 'bg-rose-500 text-white shadow-rose-500/30'
    : 'bg-emerald-500 text-white shadow-emerald-500/30';

  const workspaceTitle = {
    invoices: label('هوش مصنوعی صورت‌وضعیت‌ها — فرمول پیش‌بینی هزینه با شاخص CPI', 'AI Invoices FAC Predictor (Cost Index Formula)'),
    siteCosts: label('هوش مصنوعی هزینه‌های کارگاهی — فرمول تعاملی زمان/هزینه (CPI × SPI)', 'AI Site Costs FAC Predictor (Cumulative CPI × SPI)'),
    procurement: label('هوش مصنوعی مالی خرید — فرمول انحراف باقی‌مانده مبنا', 'AI Procurement FAC Predictor (Baseline Remaining Variance)'),
  }[kind];

  const logicExplanation = {
    invoices: label(
      'تحلیل انباشت صورت‌وضعیت‌ها و افت CPI: ادامه روند فعلی هزینه، بودجه را با انحراف مواجه می‌سازد.',
      'Scans invoice approval backlogs and CPI drops to project final overrun at completion.'
    ),
    siteCosts: label(
      'تحلیل اثر همزمان تأخیر زمان‌بندی (SPI) بر هزینه‌های ثابت کارگاه (اجاره ماشین‌آلات و دستمزد پرسنل).',
      'Calculates cumulative impact of site delays (SPI) on fixed machinery and wage operating costs.'
    ),
    procurement: label(
      'تحلیل اقلام Long-Lead و مراحل LC: فرض پایبندی باقی‌مانده تدارکات به بودجه اولیه مصوب.',
      'Parses long-lead LC stages & commitments, assuming remaining procurement strictly adheres to BAC.'
    ),
  }[kind];

  return (
    <div className={`rounded-2xl border shadow-sm p-3.5 transition-all ${
      isOverrun ? 'bg-gradient-to-l from-rose-50/90 via-white to-amber-50/40 border-rose-300' : 'bg-gradient-to-l from-cyan-50/80 via-white to-emerald-50/40 border-cyan-300'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow ${
            isOverrun ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-cyan-500 to-blue-600'
          }`}>
            <Calculator className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[12px] font-black text-[#0f172a] leading-tight">{workspaceTitle}</h3>
              <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black shadow-sm ${badgeCls}`}>
                {isOverrun
                  ? label(`هشدار مازاد: +${fmt(overrun.toLocaleString())} م.ریال (${fmt(overrunPct)}٪)`, `OVERRUN: +${overrun.toLocaleString()} M (${overrunPct}%)`)
                  : label('در محدوده بودجه (On Track)', 'ON TRACK')}
              </span>
            </div>
            <div className="text-[9.5px] text-cyan-800 font-mono font-bold mt-0.5" dir="ltr">
              {formulaStr}
            </div>
          </div>
        </div>

        <button
          onClick={() => onAdvice(label(`فرمول پیش‌بینی FAC (${workspaceTitle})`, `FAC Formula (${formulaStr})`))}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold transition flex-shrink-0"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          {label('مشاوره فنی', 'Consult')}
        </button>
      </div>

      {/* Logic explanation */}
      <p className="text-[10px] text-slate-600 font-medium mb-3 leading-snug">
        {logicExplanation}
      </p>

      {/* Interactive Controls & Live Calculation Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-white/80 rounded-xl p-3 border border-slate-200 shadow-inner">
        {/* Sliders / Numerical inputs */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <div>
            <span className="block text-slate-500 font-bold mb-1">BAC {label('(بودجه کل)', '(Budget)')}</span>
            <input
              type="number"
              value={bac}
              onChange={(e) => setBac(Number(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-[#212529] focus:bg-white focus:border-cyan-500 outline-none"
              dir="ltr"
            />
          </div>
          <div>
            <span className="block text-slate-500 font-bold mb-1">EV {label('(کسب‌شده)', '(Earned)')}</span>
            <input
              type="number"
              value={ev}
              onChange={(e) => setEv(Number(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-[#212529] focus:bg-white focus:border-cyan-500 outline-none"
              dir="ltr"
            />
          </div>
          <div>
            <span className="block text-slate-500 font-bold mb-1">AC {label('(واقعی)', '(Actual)')}</span>
            <input
              type="number"
              value={ac}
              onChange={(e) => setAc(Number(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-[#212529] focus:bg-white focus:border-cyan-500 outline-none"
              dir="ltr"
            />
          </div>
          {kind === 'siteCosts' ? (
            <div>
              <span className="block text-slate-500 font-bold mb-1">SPI {label('(شاخص زمان)', '(Schedule)')}</span>
              <input
                type="number"
                step="0.01"
                value={spiInput}
                onChange={(e) => setSpiInput(Number(e.target.value) || 0.01)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-[#212529] focus:bg-white focus:border-cyan-500 outline-none"
                dir="ltr"
              />
            </div>
          ) : (
            <div>
              <span className="block text-slate-500 font-bold mb-1">CPI {label('(محاسبه‌شده)', '(EV/AC)')}</span>
              <div className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-black text-cyan-800" dir="ltr">
                {fmt(calculatedCPI.toFixed(2))}
              </div>
            </div>
          )}
        </div>

        {/* FAC Readout Cards */}
        <div className="lg:col-span-5 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-2">
            <div className="text-[8.5px] font-bold text-cyan-700">ETC</div>
            <div className="text-sm font-black font-mono text-cyan-900">{fmt(etc.toLocaleString())}</div>
            <div className="text-[7.5px] text-slate-400">{label('میلیارد', 'M IRR')}</div>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-2">
            <div className="text-[8.5px] font-bold text-blue-700">FAC</div>
            <div className="text-sm font-black font-mono text-blue-900">{fmt(fac.toLocaleString())}</div>
            <div className="text-[7.5px] text-slate-400">{label('میلیارد', 'M IRR')}</div>
          </div>
          <div className={`rounded-xl border p-2 ${isOverrun ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className={`text-[8.5px] font-bold ${isOverrun ? 'text-rose-700' : 'text-emerald-700'}`}>
              {label('انحراف (VAC)', 'Variance')}
            </div>
            <div className={`text-sm font-black font-mono ${isOverrun ? 'text-rose-700' : 'text-emerald-700'}`}>
              {overrun > 0 ? '+' : ''}{fmt(overrun.toLocaleString())}
            </div>
            <div className="text-[7.5px] text-slate-400">{fmt(overrunPct)}٪</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WidgetFrame({
  title, icon: Icon, onAdvice, lang, children, facMetric,
}: {
  title: string; icon: any; onAdvice: () => void; lang: Lang; children: React.ReactNode; facMetric?: string;
}) {
  const fmt = (n: number | string) => (lang === 'fa' ? toFa(n) : String(n));
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
          <h4 className="text-[11px] font-black text-[#212529] truncate">{title}</h4>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {facMetric && (
            <span className="text-[9px] font-mono font-bold text-[#0891b2] bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded shadow-xs" title="Live FAC Metric">
              FAC: {fmt(facMetric)}
            </span>
          )}
          <button
            onClick={onAdvice}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold transition"
          >
            <Lightbulb className="w-3 h-3" />
            {lang === 'fa' ? 'مشاوره فنی' : 'Consult'}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-[110px]">{children}</div>
    </div>
  );
}

function AdvisorDrawer({ lang, title, onClose }: { lang: Lang; title: string; onClose: () => void }) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
      style={{ zIndex: 10000 }}
      onClick={onClose}
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
            <p className="text-[10px] text-slate-500 truncate">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 text-[11px] text-[#212529] leading-relaxed">
          {lang === 'fa'
            ? 'راهنمای مالی این ویجت شامل منطق محاسبات، شاخص‌های تفسیری و توصیه‌های اقدام است. با تغییر ورودی‌ها، پیش‌بینی هوشمند FAC به‌روزرسانی می‌شود.'
            : 'This widget\'s financial guidance covers calculation logic, interpretive metrics and recommended actions. Adjusting inputs updates the live AI FAC forecast.'}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   UNIVERSAL FINANCE WORKSPACE
   ========================================================================== */
export function FinanceWorkspacePage({
  lang, kind, sectorName, projectName, onClose,
}: {
  lang: Lang;
  kind: FinanceKind;
  sectorName: string;
  projectName: string;
  onClose: () => void;
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
              {label('کنترل مالی', 'Financial Control')}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[9px] font-black">
              v1.0.0-Alpha-P1
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

      {/* Top region: template toggle (left) + AI predictive FAC panel (right) */}
      <div className="scada-fluid-two-col gap-2 p-2 flex-shrink-0">
        <DualTemplateToggle
          lang={lang}
          template={template}
          onChange={setTemplate}
          onCustomFile={setCustomFile}
          customFile={customFile}
          downloadFormats={['xlsx', 'docx', 'pdf']}
        />
        <div className="space-y-2">
          {/* Phase 2 Interactive AI FAC Predictive Model */}
          <AIFACPredictivePanel
            lang={lang}
            kind={kind}
            onAdvice={advise}
          />
          {/* v2.3.1-Alpha: Circular 5090 Calculation Widget (Invoices workspace only) */}
          {kind === 'invoices' && <Circular5090Widget lang={lang} onAdvice={advise} />}
        </div>
      </div>

      {/* Body: kind-specific widgets */}
      <div className="flex-1 min-h-0 overflow-auto p-2 pt-0 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 auto-rows-[minmax(180px,auto)]">
        {kind === 'invoices' && <InvoiceWidgets lang={lang} advise={advise} fmt={fmt} label={label} />}
        {kind === 'siteCosts' && <SiteCostWidgets lang={lang} advise={advise} fmt={fmt} label={label} />}
        {kind === 'procurement' && <ProcurementFinancialWidgets lang={lang} advise={advise} fmt={fmt} label={label} />}
      </div>

      {advisor && <AdvisorDrawer lang={lang} title={advisor} onClose={() => setAdvisor(null)} />}
    </div>
  );
}

/* ---- Page 1 — Invoices widgets ------------------------------------------- */
function InvoiceWidgets({ lang, advise, fmt, label }: {
  lang: Lang; advise: (t: string) => void;
  fmt: (n: number | string) => string;
  label: (fa: string, en: string) => string;
}) {
  const invoices = [
    { id: 'IN-2201', submitted: 480, approved: 460, status: 'approved' },
    { id: 'IN-2202', submitted: 320, approved: 0, status: 'pending' },
    { id: 'IN-2203', submitted: 210, approved: 185, status: 'partial' },
    { id: 'IN-2204', submitted: 140, approved: 0, status: 'rejected' },
    { id: 'IN-2205', submitted: 610, approved: 590, status: 'approved' },
  ];
  const totalSubmitted = invoices.reduce((a, x) => a + x.submitted, 0);
  const totalApproved = invoices.reduce((a, x) => a + x.approved, 0);
  const deductions = [
    { l: label('کسورات قانونی (بیمه)', 'Statutory (Insurance)'), pct: 5, v: 78 },
    { l: label('مالیات', 'Tax'), pct: 9, v: 141 },
    { l: label('حسن انجام کار', 'Retention'), pct: 10, v: 156 },
    { l: label('پیش‌پرداخت', 'Advance Recovery'), pct: 6, v: 93 },
  ];

  return (
    <>
      <WidgetFrame lang={lang} icon={CircleDollarSign} title={label('صورت‌وضعیت‌ها — ارسال / تأیید', 'Invoices — Submitted / Approved')} onAdvice={() => advise('Invoices Grid')} facMetric="11,880M">
        <div className="overflow-auto max-h-[220px]">
          <table className="w-full text-[9.5px]">
            <thead>
              <tr className="text-slate-500">
                <th className="text-right py-1 px-1 font-bold">Inv#</th>
                <th className="text-right py-1 px-1 font-bold">{label('ارسال', 'Submitted')}</th>
                <th className="text-right py-1 px-1 font-bold">{label('تأیید', 'Approved')}</th>
                <th className="text-right py-1 px-1 font-bold">{label('وضعیت', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-1 px-1 font-mono font-bold text-slate-600" dir="ltr">{r.id}</td>
                  <td className="py-1 px-1 font-mono text-slate-700">{fmt(r.submitted)}</td>
                  <td className="py-1 px-1 font-mono font-bold text-blue-700">{fmt(r.approved)}</td>
                  <td className="py-1 px-1">
                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[8.5px] ${
                      r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      r.status === 'partial' ? 'bg-cyan-100 text-cyan-700' :
                      r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {r.status === 'approved' ? label('تأیید', 'Approved') :
                        r.status === 'partial' ? label('جزئی', 'Partial') :
                        r.status === 'pending' ? label('در انتظار', 'Pending') :
                        label('رد شده', 'Rejected')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={TrendingUp} title={label('ارزش کل ارسالی در برابر تأییدشده', 'Total Submitted vs Approved')} onAdvice={() => advise('Value comparison')} facMetric="13,769M">
        <div className="grid grid-cols-2 gap-2 h-full">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-center flex flex-col justify-center">
            <div className="text-[9px] font-bold text-slate-500">{label('ارزش ارسالی', 'Submitted')}</div>
            <div className="text-lg font-black font-mono text-slate-700">{fmt(totalSubmitted.toLocaleString())}</div>
            <div className="text-[8px] text-slate-400">{label('میلیارد ریال', 'B IRR')}</div>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-center flex flex-col justify-center">
            <div className="text-[9px] font-bold text-emerald-700">{label('ارزش تأییدی', 'Approved')}</div>
            <div className="text-lg font-black font-mono text-emerald-700">{fmt(totalApproved.toLocaleString())}</div>
            <div className="text-[8px] text-emerald-700/80">
              {label(`نسبت: ${toFa(Math.round((totalApproved/totalSubmitted)*100))}٪`,
                     `Ratio: ${Math.round((totalApproved/totalSubmitted)*100)}%`)}
            </div>
          </div>
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={ShieldCheck} title={label('کسورات قانونی', 'Statutory Deductions')} onAdvice={() => advise('Deductions')} facMetric="13,769M">
        <div className="space-y-1.5">
          {deductions.map((d) => (
            <div key={d.l} className="flex items-center gap-2 text-[10px]">
              <span className="flex-1 truncate text-slate-700">{d.l}</span>
              <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden" dir="ltr">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${d.pct * 6}%` }} />
              </div>
              <span className="font-mono font-bold text-blue-700 w-12 text-right">{fmt(d.pct)}٪</span>
              <span className="font-mono font-bold text-slate-500 w-14 text-right">{fmt(d.v)}</span>
            </div>
          ))}
        </div>
      </WidgetFrame>
    </>
  );
}

/* ---- Page 2 — Site Costs widgets ---------------------------------------- */
function SiteCostWidgets({ lang, advise, fmt, label }: {
  lang: Lang; advise: (t: string) => void;
  fmt: (n: number | string) => string;
  label: (fa: string, en: string) => string;
}) {
  const imprestRows = [
    { period: 'W1', budget: 120, actual: 118 },
    { period: 'W2', budget: 120, actual: 132 },
    { period: 'W3', budget: 120, actual: 145 },
    { period: 'W4', budget: 120, actual: 158 },
  ];
  const wages = [
    { role: label('اپراتور', 'Operator'), count: 42, wage: 380 },
    { role: label('جوشکار', 'Welder'), count: 18, wage: 620 },
    { role: label('برق‌کار', 'Electrician'), count: 12, wage: 540 },
    { role: label('کمکی', 'Helper'), count: 60, wage: 210 },
  ];
  const rentals = [
    { m: label('کرین ۵۰T', 'Crane 50T'), cost: 480, days: 22 },
    { m: label('بیل مکانیکی', 'Excavator'), cost: 260, days: 26 },
    { m: label('لودر', 'Loader'), cost: 180, days: 24 },
    { m: label('کمپکتور', 'Compactor'), cost: 90, days: 20 },
  ];
  const overruns = [
    { pkg: label('حفاری و خاکبرداری', 'Earthworks'), pct: 12 },
    { pkg: label('نصب مکانیکی', 'Mechanical Installation'), pct: -3 },
    { pkg: label('برق و ابزار دقیق', 'E&I'), pct: 8 },
    { pkg: label('ساختمانی', 'Civil'), pct: 5 },
  ];

  return (
    <>
      <WidgetFrame lang={lang} icon={Banknote} title={label('تنخواه — بودجه در برابر مصرف', 'Imprest — Budget vs Actual')} onAdvice={() => advise('Imprest')} facMetric="6,033M">
        <svg viewBox="0 0 200 100" className="w-full h-full" preserveAspectRatio="none">
          {[20, 40, 60, 80].map((y) => <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="#e2e8f0" strokeWidth="0.6" strokeDasharray="3 3" />)}
          {imprestRows.map((d, i) => {
            const x = 18 + i * 44;
            const bh = (d.budget / 200) * 90;
            const ah = (d.actual / 200) * 90;
            return (
              <g key={i}>
                <rect x={x} y={95 - bh} width="14" height={bh} fill="#94a3b8" rx="1" />
                <rect x={x + 16} y={95 - ah} width="14" height={ah} fill={d.actual > d.budget ? '#e11d48' : '#0891b2'} rx="1" />
                <text x={x + 15} y="99" textAnchor="middle" fontSize="5" fill="#64748b" fontFamily="monospace">{d.period}</text>
              </g>
            );
          })}
        </svg>
        <div className="flex items-center gap-3 mt-1.5 text-[8.5px] text-slate-500 flex-shrink-0">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-400" />{label('بودجه', 'Budget')}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-600" />{label('واقعی', 'Actual')}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500" />{label('مازاد', 'Overrun')}</span>
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={HardHat} title={label('دستمزد نیروی انسانی', 'Manpower Wages')} onAdvice={() => advise('Wages')} facMetric="6,033M">
        <div className="overflow-auto max-h-[220px]">
          <table className="w-full text-[9.5px]">
            <thead>
              <tr className="text-slate-500">
                <th className="text-right py-1 px-1 font-bold">{label('نقش', 'Role')}</th>
                <th className="text-right py-1 px-1 font-bold">{label('تعداد', 'Count')}</th>
                <th className="text-right py-1 px-1 font-bold">{label('دستمزد ماه', 'Monthly Wage')}</th>
                <th className="text-right py-1 px-1 font-bold">{label('کل', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              {wages.map((w) => (
                <tr key={w.role} className="border-t border-slate-100">
                  <td className="py-1 px-1 text-slate-700">{w.role}</td>
                  <td className="py-1 px-1 font-mono text-slate-700">{fmt(w.count)}</td>
                  <td className="py-1 px-1 font-mono text-blue-700">{fmt(w.wage)}</td>
                  <td className="py-1 px-1 font-mono font-black text-slate-800">{fmt(w.count * w.wage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={Landmark} title={label('اجاره ماشین‌آلات', 'Rental Machinery Costs')} onAdvice={() => advise('Machinery rental')} facMetric="6,033M">
        <div className="space-y-1.5">
          {rentals.map((r) => (
            <div key={r.m} className="flex items-center gap-2 text-[10px]">
              <span className="flex-1 truncate text-slate-700">{r.m}</span>
              <span className="font-mono font-bold text-slate-500 w-12 text-right">{fmt(r.days)}d</span>
              <span className="font-mono font-bold text-blue-700 w-16 text-right">{fmt(r.cost)}</span>
            </div>
          ))}
        </div>
      </WidgetFrame>

      <div className="lg:col-span-2 2xl:col-span-3">
        <WidgetFrame lang={lang} icon={AlertTriangle} title={label('تحلیل مازاد هزینه محلی بر حسب بسته کاری', 'Localized Cost Overrun Analysis by Work Package')} onAdvice={() => advise('Local overruns')} facMetric="6,033M">
          <div className="flex items-end justify-around h-full gap-3 pb-2">
            {overruns.map((o) => {
              const h = Math.min(80, Math.abs(o.pct) * 5);
              const positive = o.pct >= 0;
              return (
                <div key={o.pkg} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`text-[10px] font-black ${positive ? 'text-rose-700' : 'text-emerald-700'} font-mono`}>
                    {positive ? '+' : ''}{fmt(o.pct)}٪
                  </div>
                  <div
                    className={`w-full max-w-[36px] rounded-t-md ${positive ? 'bg-gradient-to-t from-rose-500 to-rose-400' : 'bg-gradient-to-t from-emerald-500 to-emerald-400'}`}
                    style={{ height: `${h}px` }}
                  />
                  <div className="text-[9px] text-slate-500 text-center truncate w-full">{o.pkg}</div>
                </div>
              );
            })}
          </div>
        </WidgetFrame>
      </div>
    </>
  );
}

/* ---- Page 3 — Procurement Financials widgets ---------------------------- */
function ProcurementFinancialWidgets({ lang, advise, fmt, label }: {
  lang: Lang; advise: (t: string) => void;
  fmt: (n: number | string) => string;
  label: (fa: string, en: string) => string;
}) {
  const poMilestones = [
    { id: 'PO-1001', desc: label('لوله فولادی', 'Steel Pipe'), stage: 'delivered' },
    { id: 'PO-1002', desc: label('پمپ گریز از مرکز', 'Centrifugal Pump'), stage: 'transit' },
    { id: 'PO-1003', desc: label('شیر توپی', 'Ball Valve'), stage: 'issued' },
    { id: 'PO-1004', desc: label('کابل MV', 'MV Cable'), stage: 'draft' },
    { id: 'PO-1005', desc: label('تابلو کنترل', 'Control Panel'), stage: 'transit' },
  ];
  const downPayments = [
    { vendor: label('شرکت الف', 'Vendor A'), pct: 30, amount: 620 },
    { vendor: label('شرکت ب', 'Vendor B'), pct: 20, amount: 240 },
    { vendor: label('شرکت ج', 'Vendor C'), pct: 25, amount: 405 },
  ];
  const lcStages = [
    { item: label('توربین گاز', 'Gas Turbine'), stage: 'issued', pct: 20 },
    { item: label('کمپرسور', 'Compressor'), stage: 'confirmed', pct: 40 },
    { item: label('ترانس', 'Transformer'), stage: 'negotiation', pct: 60 },
    { item: label('راکتور', 'Reactor'), stage: 'draft', pct: 10 },
  ];
  const commitments = [
    { l: label('تعهد فعال', 'Active Commitment'), v: 2540, color: 'text-blue-700' },
    { l: label('پرداخت شده', 'Paid to Date'), v: 1580, color: 'text-emerald-700' },
    { l: label('پیش‌پرداخت باز', 'Open Down-Payments'), v: 620, color: 'text-amber-700' },
    { l: label('باقی‌مانده', 'Remaining'), v: 960, color: 'text-slate-700' },
  ];

  return (
    <>
      <WidgetFrame lang={lang} icon={ShoppingCart} title={label('مایلستون سفارش‌های خرید (PO)', 'PO Milestones')} onAdvice={() => advise('PO milestones')} facMetric="8,980M">
        <div className="overflow-auto max-h-[220px]">
          <table className="w-full text-[9.5px]">
            <thead>
              <tr className="text-slate-500">
                <th className="text-right py-1 px-1 font-bold">PO#</th>
                <th className="text-right py-1 px-1 font-bold">{label('شرح', 'Description')}</th>
                <th className="text-right py-1 px-1 font-bold">{label('مرحله', 'Stage')}</th>
              </tr>
            </thead>
            <tbody>
              {poMilestones.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-1 px-1 font-mono font-bold text-slate-600" dir="ltr">{r.id}</td>
                  <td className="py-1 px-1 text-slate-700 truncate">{r.desc}</td>
                  <td className="py-1 px-1">
                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[8.5px] ${
                      r.stage === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                      r.stage === 'transit' ? 'bg-cyan-100 text-cyan-700' :
                      r.stage === 'issued' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {r.stage === 'delivered' ? label('تحویل', 'Delivered') :
                        r.stage === 'transit' ? label('در راه', 'Transit') :
                        r.stage === 'issued' ? label('صادر', 'Issued') :
                        label('پیش‌نویس', 'Draft')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={Handshake} title={label('پیش‌پرداخت به پیمانکاران', 'Vendor Down-Payments')} onAdvice={() => advise('Down-payments')} facMetric="8,980M">
        <div className="space-y-2">
          {downPayments.map((d) => (
            <div key={d.vendor} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="font-black text-slate-700 truncate">{d.vendor}</span>
                <span className="font-mono font-bold text-blue-700">{fmt(d.amount)} <span className="text-[8px] text-slate-500">B IRR</span></span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" dir="ltr">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${d.pct * 3}%` }} />
              </div>
              <div className="text-[8.5px] text-slate-500 mt-0.5">{fmt(d.pct)}٪ {label('پیش‌پرداخت', 'down-payment')}</div>
            </div>
          ))}
        </div>
      </WidgetFrame>

      <WidgetFrame lang={lang} icon={Landmark} title={label('مراحل LC اقلام Long-Lead', 'LC Stages — Long-Lead Items')} onAdvice={() => advise('LC stages')} facMetric="8,980M">
        <div className="space-y-2">
          {lcStages.map((l) => {
            const stageMeta =
              l.stage === 'confirmed' ? { l: label('تأیید بانک', 'Bank Confirmed'), c: 'bg-emerald-100 text-emerald-700' } :
              l.stage === 'issued' ? { l: label('صادر شده', 'Issued'), c: 'bg-blue-100 text-blue-700' } :
              l.stage === 'negotiation' ? { l: label('در حال مذاکره', 'Negotiation'), c: 'bg-amber-100 text-amber-700' } :
              { l: label('پیش‌نویس', 'Draft'), c: 'bg-slate-100 text-slate-700' };
            return (
              <div key={l.item} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="font-black text-slate-700 truncate">{l.item}</span>
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[8.5px] ${stageMeta.c}`}>{stageMeta.l}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" dir="ltr">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${l.pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </WidgetFrame>

      <div className="lg:col-span-2 2xl:col-span-3">
        <WidgetFrame lang={lang} icon={TrendingUp} title={label('نمای تعهدات مالی خرید', 'Procurement Commitments Overview')} onAdvice={() => advise('Commitments')} facMetric="8,980M">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 h-full">
            {commitments.map((c) => (
              <div key={c.l} className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center flex flex-col justify-center">
                <div className="text-[9.5px] font-bold text-slate-500 truncate">{c.l}</div>
                <div className={`text-lg font-black font-mono ${c.color}`}>{fmt(c.v.toLocaleString())}</div>
                <div className="text-[8.5px] text-slate-400">{label('میلیارد ریال', 'B IRR')}</div>
              </div>
            ))}
          </div>
        </WidgetFrame>
      </div>
    </>
  );
}
