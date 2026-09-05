import { useState, useMemo, useRef } from 'react';
import {
  X, ChevronDown, Lightbulb, UploadCloud, AlertTriangle,
  FileText, FileSpreadsheet, FileType2,
  Clock, ShieldAlert, Layers, TrendingUp, BarChart3,

  Percent, Grid, Shield, ClipboardCheck, FileCheck2, RefreshCw,
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



































































































































































































































































































































































































// Mock Service for dynamic scoring
const riskService = {
  calculateScore: (p: number, i: number) => p * i,
  getSuggestedStrategy: (score: number) => score >= 16 ? 'Mitigate/Transfer' : score >= 10 ? 'Mitigate' : 'Acceptance'
};


































































































































   /* CLEAN 2-FIELD CENTER SELECTOR MODAL (z-index: 9999)
   Strictly TWO dropdowns: [انتخاب صنعت] & [انتخاب پروژه] + Submit
   ========================================================================== */





































































































































































































































































































































































































































































































































































































































































































































































































































































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
            ? 'این ویجت بر پایه تحلیل فنی تمدید پیمان (EOT) و مدل‌سازی انحرافات زمانی و ادعاها محاسبه می‌شود و به‌صورت خودکار به‌روزرسانی می‌گردد.'
            : 'This forensic claims and risk widget updates automatically off advanced baseline planning and CPM delay variance logic.'}
        </div>
      </div>
    </div>
  );
}

export function ForensicClaimsWorkspacePage({
  lang, sectorName, projectName, onClose,
}: {
  lang: Lang; sectorName: string; projectName: string; onClose: () => void;
}) {
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const fmt = (n: number | string) => (lang === 'fa' ? toFa(n) : String(n));
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);

  const [activeTab, setActiveTab] = useState<'delays' | 'risks' | 'changes'>('delays');
  const [template, setTemplate] = useState<'base' | 'client'>('base');
  const [customFile, setCustomFile] = useState<string | null>(null);
  const [advisor, setAdvisor] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const adv = useMemo(() => (t: string) => setAdvisor(t), []);

  const clientTemplates = {
    delays: [
      { fa: 'قالب رسمی گزارش آنالیز همپوشانی تأخیرات (As-Planned vs As-Built)', en: 'Official Delay Overlap Analysis Report', formats: ['xlsx', 'pdf'] as Fmt[] },
      { fa: 'شیت آنالیز مسیر بحرانی مبنا در برابر واقعی', en: 'Baseline vs Actual CPM Path Analysis Sheet', formats: ['xlsx', 'docx'] as Fmt[] },
    ],
    risks: [
      { fa: 'قالب رسمی ثبت ریسک‌های کیفی و کمی پروژه', en: 'Official Project Qualitative & Quantitative Risk Register', formats: ['xlsx', 'docx'] as Fmt[] },
      { fa: 'مدل ارزیابی مونت‌کارلو توزیع برنامه اقدام', en: 'Monte Carlo Assessment Model Template', formats: ['xlsx', 'pdf'] as Fmt[] },
    ],
    changes: [
      { fa: 'فرم رسمی بررسی ادعاهای قراردادی و تمدید تمدید پیمان (EOT)', en: 'Official Contractual Claims & EOT Evaluation Form', formats: ['docx', 'pdf'] as Fmt[] },
      { fa: 'شیت مغایرت ارزش اولیه پیمان با ساختار ثانویه', en: 'Original Contract vs Secondary Value Variance Sheet', formats: ['xlsx', 'pdf'] as Fmt[] },
    ],
  }[activeTab];

  return (
    <div dir={dir} className="scada-workspace fixed inset-0 bg-[#F8F9FA] flex flex-col" style={{ zIndex: 9998 }}>
      <WorkspaceHeader
        lang={lang} icon={Shield}
        titleFa="سامانه تخصصی آنالیز تأخیرات، ریسک و مدیریت تغییرات" titleEn="Forensic Delay, Risk & Change Claims Hub"
        badgeFa="آنالیز تأخیر و ادعا" badgeEn="Forensic Claims & Risk"
        sectorName={sectorName} projectName={projectName} onClose={onClose}
      />

      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex-shrink-0 flex items-center justify-between gap-4 flex-wrap">
        <div dir="ltr" className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-sm max-w-full">
          {[
            { key: 'delays', fa: 'آنالیز تأخیرات (Delay Analysis Engine)', en: 'Delay Analysis Engine' },
            { key: 'risks', fa: 'مدیریت ریسک پروژه (Risk Register)', en: 'Project Risk Register' },
            { key: 'changes', fa: 'تغییرات قرارداد و ادعاها (Change & Claim)', en: 'Change & Variation Orders' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-[11px] font-black transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-cyan-700'
              }`}
            >
              {lang === 'fa' ? tab.fa : tab.en}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-slate-500">{label('خروجی سریع گزارش:', 'Export Claim Report:')}</span>
          {[
            { fmt: 'DOCX', cls: 'bg-blue-50 text-blue-700 border-blue-300', Icon: FileText },
            { fmt: 'XLSX', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', Icon: FileSpreadsheet },
            { fmt: 'PDF', cls: 'bg-rose-50 text-rose-700 border-rose-300', Icon: FileType2 },
          ].map((x) => (
            <button
              key={x.fmt}
              onClick={() => adv(label(`دانلود خروجی ${x.fmt}`, `Download ${x.fmt} report`))}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-black transition hover:opacity-90 ${x.cls}`}
            >
              <x.Icon className="w-3.5 h-3.5" />
              {x.fmt}
            </button>
          ))}
        </div>
      </div>

      <div className="scada-fluid-two-col p-3 bg-white border-b border-slate-200 shadow-inner gap-3 flex-shrink-0">
        <div className="rounded-2xl bg-[#e6f7f7]/40 border border-cyan-300 p-2.5">
          <div dir="ltr" className="inline-flex w-full rounded-lg bg-white p-0.5 border border-slate-200">
            <button
              onClick={() => setTemplate('base')}
              className={`flex-1 py-1 rounded-md text-[10px] font-black transition ${
                template === 'base' ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white' : 'text-slate-500 hover:text-cyan-700'
              }`}
            >
              {label('قالب بیس و داخلی سازمان', 'Base Template')}
            </button>
            <button
              onClick={() => setTemplate('client')}
              className={`flex-1 py-1 rounded-md text-[10px] font-black transition ${
                template === 'client' ? 'bg-gradient-to-l from-cyan-500 to-blue-600 text-white' : 'text-slate-500 hover:text-cyan-700'
              }`}
            >
              {label('قالب ابلاغی کارفرما / مشاور', 'Client Template')}
            </button>
          </div>
        </div>

        {template === 'base' ? (
          <div
            onClick={() => uploadRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setCustomFile(e.dataTransfer.files?.[0]?.name ?? null); }}
            className={`cursor-pointer rounded-xl border-2 border-dashed transition px-3 py-1 flex items-center justify-center gap-2 ${
              customFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-cyan-200 bg-cyan-50/20'
            }`}
          >
            <UploadCloud className="w-5 h-5 text-cyan-600" />
            <span className="text-[10px] font-bold text-slate-600">
              {customFile ?? label('برای بارگذاری داده‌های تاریخی یا تمدید شیت ادعا، اینجا کلیک کنید یا فایل را رها کنید', 'Click or drop claim worksheets here')}
            </span>
            <input ref={uploadRef} type="file" accept=".xls,.xlsx,.doc,.docx,.pdf" className="hidden" onChange={(e) => setCustomFile(e.target.files?.[0]?.name ?? null)} />
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {clientTemplates.map((t, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1 flex items-center gap-2 flex-shrink-0">
                <span className="text-[9.5px] font-bold text-slate-700">{label(t.fa, t.en)}</span>
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

      <div className="flex-1 min-h-0 overflow-auto p-3">
        {activeTab === 'delays' && <DelayAnalysisTab lang={lang} adv={adv} fmt={fmt} />}
        {activeTab === 'risks' && <RiskRegisterTab lang={lang} adv={adv} fmt={fmt} />}
        {activeTab === 'changes' && <ChangeClaimTab lang={lang} adv={adv} fmt={fmt} />}
      </div>

      <div className="bg-rose-50 border-t border-rose-200 px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
        <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
        <span className="text-[9.5px] text-rose-800 font-medium leading-snug">
          {label('کنترل اسناد ادعا — کلیه نمودارهای پیشرفت کارگاهی زنده، منحنی‌های پیشرفت اجرایی واقعی (S-Curve) و زمان‌بندی فیزیکی پویا از این هاب حذف شده‌اند تا ساختار فنی ادعاها و مستندسازی حقوقی تمدید پیمان (EOT) به‌صورت کامل ایزوله باقی بماند.',
                 'Claims Hub Isolation — Live progress charts, execution S-Curves and dynamic physical scheduling are barred from this claim analysis view to keep forensic Claim & EOT documentation fully isolated.')}
        </span>
      </div>

      {advisor && <AdvisorDrawer lang={lang} title={advisor} onClose={() => setAdvisor(null)} />}
    </div>
  );
}

function DelayAnalysisTab({ lang, adv, fmt }: { lang: Lang; adv: (t: string, body?: string) => void; fmt: (n: number | string) => string }) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);

  const buildArticle30Brief = () => {
    return lang === 'fa'
      ? `لایحه دفاعیه و درخواست تمدید مدت پیمان مستند به ماده ۳۰ شرایط عمومی پیمان (تأخیرات مجاز):\n\nموضوع: درخواست رسیدگی و تصویب تأخیرات مجاز ناشی از تعلل کارفرما و مشاور\n\nبا سلام و احترام،\nپیرو قرارداد منعقده و مستند به مفاد ماده ۳۰ شرایط عمومی پیمان، به استحضار می‌رساند به دلیل بروز حوادث و موانع خارج از اراده پیمانکار من‌جمله تاخیر در ابلاغ نقشه‌ها، تاخیر در تحویل زمین و تعلل در موافقت با دستورکارها که مستقیماً توسط کارفرما و مهندس مشاور ایجاد گردیده، مجموعاً ۷۴ روز تأخیر مجاز (Excusable Delays) حادث شده است که مشمول استثنا از جرایم تأخیرات (Liquidated Damages) می‌باشد. لذا خواهشمند است دستور فرمایید کمیته تأخیرات نسبت به بررسی و تصویب روزهای فوق‌الذکر اقدام مقتضی مبذول فرمایند.\n\nبا تجدید احترام`
      : `Formal Defense Brief for EOT Claim per Article 30 of General Conditions of Contract (Excusable Delays):\n\nSubject: Request for Review and Approval of Excusable Delays Caused by Client & Consultant\n\nDear Sirs,\nReferring to the contract and pursuant to Article 30 of the General Conditions of Contract, we hereby submit that due to impediments beyond the contractor's control including drawing approval delays, site handover delays, and delayed instructions directly caused by the Employer and Engineer, a total of 74 excusable delay days have accrued, which are exempt from liquidated damages. Kindly instruct the delay committee to review and approve the aforementioned days.\n\nSincerely`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 auto-rows-max h-full">
      <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-300 p-3 lg:col-span-2 2xl:col-span-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              30
            </div>
            <div>
              <h4 className="text-[12px] font-black text-teal-900 leading-tight">
                {label('موتور تطبیق ماده ۳۰ شرایط عمومی پیمان (تأخیرات مجاز)', 'Article 30 Compliance Engine — Excusable Delay Validation')}
              </h4>
              <p className="text-[9.5px] text-teal-700 font-medium">
                {label('فیلترینگ خودکار تأخیرات مجاز کارفرما و مشاور جهت معافیت از جرایم تأخیر (Liquidated Damages)', 'Automatic filtering of Employer/Consultant excusable delays exempt from LD')}
              </p>
            </div>
          </div>
          <button
            onClick={() => adv(
              label('لایحه رسمی دفاعیه ماده ۳۰ شرایط عمومی پیمان', 'Official Article 30 Delay Defense Brief'),
              buildArticle30Brief()
            )}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold transition flex-shrink-0 shadow-sm"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {label('لایحه دفاعیه ماده ۳۰', 'Article 30 Brief')}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
          <div className="p-2 rounded-xl bg-white/90 border border-teal-200">
            <div className="text-[9px] font-bold text-slate-500">{label('تأخیرات مجاز ماده ۳۰ (Excusable)', 'Article 30 Excusable Delays')}</div>
            <div className="text-base font-black font-mono text-teal-800 mt-0.5">{fmt(74)} {label('روز', 'days')}</div>
          </div>
          <div className="p-2 rounded-xl bg-white/90 border border-teal-200">
            <div className="text-[9px] font-bold text-slate-500">{label('مفروضات معافیت از جرایم (LD Exemption)', 'LD Exemption Status')}</div>
            <div className="text-[11px] font-black text-emerald-700 mt-1">{label('تأییدشده در چارچوب ماده ۳۰', 'Approved under Art. 30')}</div>
          </div>
          <div className="p-2 rounded-xl bg-white/90 border border-teal-200">
            <div className="text-[9px] font-bold text-slate-500">{label('وضعیت فیلترینگ جریمه', 'Liquidated Damages Filter')}</div>
            <div className="text-[11px] font-black text-cyan-800 mt-1">{label('جداشده از خسارت تأخیرات', 'Isolated from penalty metrics')}</div>
          </div>
        </div>
      </div>
      <Widget title={label('ماتریس مانیتورینگ روزهای تأخیر پروژه', 'Delay Days Monitoring Matrices')} icon={Clock} onAdvice={() => adv('Delay Matrices')} lang={lang}>
        <div className="grid grid-cols-2 gap-2.5 h-full items-center">
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-center">
            <div className="text-[9px] font-bold text-rose-700">{label('کل روزهای تأخیر (Total)', 'Total Delay Days')}</div>
            <div className="text-2xl font-black font-mono text-rose-800 mt-1">{fmt(184)}</div>
            <div className="text-[8px] text-rose-700/70 mt-0.5">{label('روز تقویمی', 'calendar days')}</div>
          </div>
          <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 text-center">
            <div className="text-[9px] font-bold text-orange-700">{label('تأخیر مسیر بحرانی (CPM)', 'Critical Delay Days')}</div>
            <div className="text-2xl font-black font-mono text-orange-800 mt-1">{fmt(112)}</div>
            <div className="text-[8px] text-orange-700/70 mt-0.5">{label('روز روی بحرانی', 'critical-path days')}</div>
          </div>
        </div>
      </Widget>

      <Widget title={label('دسته‌بندی طبقه‌بندی‌شده تأخیرات (Delay Classification)', 'Delay Categorization & Legality')} icon={Grid} onAdvice={() => adv('Delay Categorization')} lang={lang}>
        <div className="grid grid-cols-2 gap-1.5 h-full text-[9.5px]">
          {[
            { l: label('مجاز با جبران مالی (Excusable Compensable)', 'Excusable Compensable'), v: 74, c: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
            { l: label('مجاز بدون جبران مالی (Excusable Non-Comp)', 'Excusable Non-Compensable'), v: 38, c: 'border-cyan-200 bg-cyan-50 text-cyan-800' },
            { l: label('غیرمجاز (Non-Excusable)', 'Non-Excusable'), v: 46, c: 'border-rose-200 bg-rose-50 text-rose-800' },
            { l: label('تأخیر همزمان (Concurrent)', 'Concurrent Delay'), v: 26, c: 'border-slate-200 bg-slate-100 text-slate-800' },
          ].map((x) => (
            <div key={x.l} className={`rounded-xl border p-2 flex flex-col justify-center ${x.c}`}>
              <div className="text-[12px] font-black font-mono">{fmt(x.v)}d</div>
              <div className="font-bold mt-0.5 leading-tight">{x.l}</div>
            </div>
          ))}
        </div>
      </Widget>

      <Widget title={label('سهم عوامل مؤثر در تأخیرات پروژه', 'Delay Source Attributes')} icon={Percent} onAdvice={() => adv('Delay Sources')} lang={lang}>
        <div className="space-y-2 h-full flex flex-col justify-center">
          {[
            { l: label('کارفرما (نقشه، پرداخت، مجوز)', 'Client (Drawings/Claims)'), v: 40, c: 'bg-rose-500' },
            { l: label('پیمانکار (تجهیزات، راندمان)', 'Contractor (Manpower/Rework)'), v: 25, c: 'bg-blue-500' },
            { l: label('مهندسی و طراحی (تأخیر بررسی مدارک)', 'Engineering & Design'), v: 15, c: 'bg-cyan-500' },
            { l: label('تدارکات و گمرک (LC)', 'Procurement & Customs'), v: 12, c: 'bg-amber-500' },
            { l: label('عوامل بیرونی و جوی', 'External & Force Majeure'), v: 8, c: 'bg-slate-400' },
          ].map((r) => (
            <div key={r.l}>
              <div className="flex items-center justify-between text-[9.5px] mb-0.5">
                <span className="font-bold text-slate-600 truncate">{r.l}</span>
                <span className="font-mono font-bold text-blue-700">{fmt(r.v)}٪</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" dir="ltr">
                <div className={`h-full rounded-full ${r.c}`} style={{ width: `${r.v}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Widget>

      <Widget title={label('ماتریس مسئولیت تمدید تمدید پیمان (RACI)', 'EOT Responsibility Matrix (RACI)')} icon={Layers} onAdvice={() => adv('EOT RACI')} lang={lang} className="lg:col-span-2 2xl:col-span-3">
        <div className="flex h-5 rounded-lg overflow-hidden border border-slate-200 mb-2.5" dir="ltr">
          <div className="bg-rose-500" style={{ width: '40%' }} title="Employer (Accountable)" />
          <div className="bg-blue-500" style={{ width: '25%' }} title="Contractor (Responsible)" />
          <div className="bg-cyan-500" style={{ width: '15%' }} title="Consultant (Consulted)" />
          <div className="bg-slate-400" style={{ width: '20%' }} title="Force Majeure" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
          {[
            { c: 'bg-rose-500', l: label('کارفرما (تأخیرات تاییدشده)', 'Employer / Client'), v: '۴۰٪' },
            { c: 'bg-blue-500', l: label('پیمانکار (تأخیرات غیرمجاز)', 'Contractor'), v: '۲۵٪' },
            { c: 'bg-cyan-500', l: label('مشاور فنی (تأخیر مهندسی)', 'Consultant'), v: '۱۵٪' },
            { c: 'bg-slate-400', l: label('فورس ماژور (حوادث خارجی)', 'Force Majeure'), v: '۲۰٪' },
          ].map((x) => (
            <div key={x.l} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${x.c} flex-shrink-0`} />
              <span className="flex-1 text-slate-600 truncate">{x.l}</span>
              <span className="font-mono font-bold text-slate-800">{x.v}</span>
            </div>
          ))}
        </div>
      </Widget>
    </div>
  );
}

function RiskRegisterTab({ lang, adv, fmt }: { lang: Lang; adv: (t: string) => void; fmt: (n: number | string) => string }) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);

  const risks = [
    { id: 'RSK-01', title: label('نوسانات ارزی و نرخ مواد اولیه', 'Currency & raw material volatility'), p: 5, i: 4 },
    { id: 'RSK-02', title: label('تأخیر در اخذ مجوزهای محیط‌زیست', 'Permits & environmental clearance delays'), p: 3, i: 3 },
    { id: 'RSK-03', title: label('تداخل فرانت‌های کاری پیمانکاران جزء', 'Subcontractor front coordinate conflict'), p: 4, i: 2 },
    { id: 'RSK-04', title: label('تحویل دیرهنگام اقلام Long-Lead', 'Long-lead equipment delivery delays'), p: 2, i: 5 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 auto-rows-max h-full">
      <Widget title={label('ماتریس ارزیابی ریسک (احتمال × اثر)', 'Risk Assessment Matrix')} icon={BarChart3} onAdvice={() => adv('Risk Matrix')} lang={lang}>
        <div className="flex flex-col items-center justify-center h-full">
          <div className="grid grid-cols-5 gap-[2px] w-full max-w-[140px]" dir="ltr">
            {Array.from({ length: 25 }).map((_, idx) => {
              const r = Math.floor(idx / 5);
              const c = idx % 5;
              const p = 5 - r;
              const i = c + 1;
              const cellVal = riskService.calculateScore(p, i);
              const color = cellVal >= 16 ? 'bg-rose-500' : cellVal >= 10 ? 'bg-amber-400' : 'bg-emerald-500';
              return (
                <div key={idx} className={`aspect-square rounded-[2px] flex items-center justify-center text-[8px] font-bold text-white shadow-sm ${color}`}>
                  {fmt(cellVal)}
                </div>
              );
            })}
          </div>
        </div>
      </Widget>

      <Widget title={label('ثبت کیفی و کمی ریسک‌های سایت', 'Qualitative & Quantitative Risk Register')} icon={Grid} onAdvice={() => adv('Risk Register')} lang={lang} className="lg:col-span-1 2xl:col-span-2">
        <div className="space-y-1.5 overflow-auto max-h-[180px] text-[9.5px]">
          {risks.map((r) => {
            const score = riskService.calculateScore(r.p, r.i);
            const strategy = riskService.getSuggestedStrategy(score);
            return (
              <div key={r.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                <span className="font-mono font-bold text-slate-800" dir="ltr">{r.id}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#212529] truncate">{r.title}</div>
                  <div className="text-[8.5px] text-slate-500 mt-0.5">
                    {label('امتیاز:', 'Score:')} <span className="font-mono font-bold text-cyan-700">{fmt(score)}</span> |
                    {label('استراتژی پیشنهادی:', 'Strategy:')} <span className="font-bold text-blue-700">{strategy}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                  score >= 16 ? 'bg-rose-100 text-rose-700' : score >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {fmt(score)}
                </span>
              </div>
            );
          })}
        </div>
      </Widget>
    </div>
  );
}

function ChangeClaimTab({ lang, adv, fmt }: { lang: Lang; adv: (t: string) => void; fmt: (n: number | string) => string }) {
  const label = (fa: string, en: string) => (lang === 'fa' ? fa : en);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 auto-rows-max h-full">
      <Widget title={label('تعداد و ارزش دستورکارهای تغییر (VO)', 'Variation Orders (VO) Counts & Values')} icon={FileCheck2} onAdvice={() => adv('VO Metrics')} lang={lang}>
        <div className="grid grid-cols-2 gap-2 h-full items-center">
          <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-2.5 text-center">
            <div className="text-[9px] font-bold text-cyan-700">{label('تعداد دستورکارها (Count)', 'Total VOs')}</div>
            <div className="text-xl font-black font-mono text-cyan-800 mt-1">{fmt(14)}</div>
            <div className="text-[8px] text-cyan-700/70 mt-0.5">{label('فقره', 'instructions')}</div>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-center">
            <div className="text-[9px] font-bold text-blue-700">{label('ارزش ریالی تغییرات (Value)', 'VO Total Value')}</div>
            <div className="text-xl font-black font-mono text-blue-800 mt-1">{fmt('1,860')}</div>
            <div className="text-[8px] text-blue-700/70 mt-0.5">{label('میلیون ریال', 'M IRR')}</div>
          </div>
        </div>
      </Widget>

      <Widget title={label('مغایرت مبلغ اولیه و ثانویه پیمان', 'Original vs Secondary Contract Value')} icon={TrendingUp} onAdvice={() => adv('Contract Value')} lang={lang}>
        <div className="space-y-3.5 h-full flex flex-col justify-center text-[10.5px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{label('مبلغ اولیه پیمان', 'Original value')}</span>
            <span className="font-mono font-black text-slate-800">{fmt('10,480')} {label('م.ریال', 'M IRR')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-cyan-700 font-bold">{label('مبلغ الحاقیه ثانویه', 'Secondary value')}</span>
            <span className="font-mono font-black text-cyan-800">{fmt('12,340')} {label('م.ریال', 'M IRR')}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" dir="ltr">
            <div className="h-full rounded-full bg-gradient-to-r from-slate-400 to-cyan-500" style={{ width: '85%' }} />
          </div>
        </div>
      </Widget>

      <Widget title={label('تحلیل اثر زمانی تغییرات طراحی مهندسی', 'Design Change Impact Analysis')} icon={RefreshCw} onAdvice={() => adv('Design Change Impact')} lang={lang}>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 h-full flex flex-col justify-center">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold text-amber-700">{label('اثر بر تاریخ اتمام پروژه', 'Impact on completion')}</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          </div>
          <div className="text-lg font-black font-mono text-amber-800">+{fmt('28')} {label('روز تقویمی', 'days')}</div>
          <p className="text-[8px] text-amber-700/80 mt-1 leading-snug">
            {label('ناشی از دستورکار SI-022 (تغییر لایوت پمپ‌ها).', 'Driven by SI-022 pump layout revision.')}
          </p>
        </div>
      </Widget>

      <Widget title={label('وضعیت ادعاهای ثبتی (Claims Tracking)', 'Registered Claims Status')} icon={ClipboardCheck} onAdvice={() => adv('Claims Status')} lang={lang} className="lg:col-span-2 2xl:col-span-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { l: label('تأییدشده', 'Approved'), v: 4, c: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { l: label('در دست بررسی', 'Pending'), v: 6, c: 'text-amber-700 bg-amber-50 border-amber-200' },
            { l: label('ردشده', 'Rejected'), v: 1, c: 'text-rose-700 bg-rose-50 border-rose-200' },
          ].map((x) => (
            <div key={x.l} className={`rounded-xl border p-2.5 flex flex-col justify-center ${x.c}`}>
              <div className="text-xl font-black font-mono">{fmt(x.v)}</div>
              <div className="text-[9px] font-bold mt-0.5 truncate">{x.l}</div>
            </div>
          ))}
        </div>
      </Widget>
    </div>
  );
}

