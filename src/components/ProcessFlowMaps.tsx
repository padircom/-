import { useState } from 'react';
import { type Lang } from '../data/framework';

/* نقشه‌های گردش‌کار تهیه و ارزیابی لوایح — بر اساس فلوچارت‌های مرجع تاییدشدهٔ کاربر
   (۵ نقشه: تأخیرات، ضرر و زیان، ریسک/بهبود قرارداد، کارشناسی دعوا، نقشهٔ یکپارچهٔ چرخهٔ ادعا).
   فقط بین‌رشته‌ای و بدون محاسبهٔ جدید؛ کلیک روی هر مرحله به تب عملیاتی واقعی می‌رود. */

type SideBlock = { titleFa: string; titleEn: string; itemsFa: string[]; itemsEn: string[]; noteFa?: string; noteEn?: string };
type StepDef = { n?: number; fa: string; en: string; tab: string; side?: SideBlock; dashedBackFa?: string; dashedBackEn?: string; noteFa?: string; noteEn?: string };
type MapDef = {
  id: 'delay' | 'loss' | 'risk' | 'dispute';
  titleFa: string; titleEn: string; subtitleFa: string; subtitleEn: string;
  steps: StepDef[];
  finalFa: string; finalEn: string; finalKind: 'output' | 'section';
  finalItemsFa?: string[]; finalItemsEn?: string[];
  footerFa?: string; footerEn?: string;
  dashedLegendFa?: string; dashedLegendEn?: string;
};

/* ————— نقشهٔ ۱: تهیه لایحه تأخیرات ————— */
const MAP_DELAY: MapDef = {
  id: 'delay',
  titleFa: 'فلوچارت تهیه لایحه تأخیرات',
  titleEn: 'Delay dossier workflow',
  subtitleFa: 'تحلیل اسناد و برنامه‌های زمان‌بندی برای تهیه لایحه‌های منسجم و قابل استناد',
  subtitleEn: 'Analysis of documents and schedules to prepare coherent, well-documented delay dossiers',
  steps: [
    {
      n: 1, fa: 'بارگذاری اسناد', en: 'Upload documents', tab: 'delay',
      side: {
        titleFa: 'اسناد قابل بارگذاری', titleEn: 'Uploadable documents',
        itemsFa: ['برنامه اولیه', 'برنامه‌های به‌روزرسانی‌شده', 'برنامه چون‌ساخت', 'گزارش‌های دوره‌ای', 'اسناد مالی پروژه', 'قرارداد', 'الحاقیه و متمم', 'صورت‌جلسات', 'مکاتبات', 'دستورکارها', 'ادعاها و اعتراضات'],
        itemsEn: ['Baseline program', 'Schedule updates', 'As-built program', 'Periodic reports', 'Project financial records', 'Contract', 'Amendments & annexes', 'Minutes', 'Correspondence', 'Work orders', 'Claims & objections'],
        noteFa: 'فرمت‌ها: MSP ,Primavera P6, Word, PDF, تصویر', noteEn: 'Formats: MSP, Primavera P6, Word, PDF, image',
      },
    },
    { n: 2, fa: 'تحلیل برنامه زمان‌بندی', en: 'Schedule analysis', tab: 'delay' },
    {
      n: 3, fa: 'انتخاب روش تحلیل', en: 'Select analysis method', tab: 'delay',
      side: {
        titleFa: 'روش‌های تحلیل تأخیرات', titleEn: 'Delay analysis methods',
        itemsFa: ['جمع جبری', 'گانت چارت', 'Time Impact Analysis', 'Impacted As-Planned', 'As-Planned vs As-Built', 'Window Analysis', 'Collapsed As-Built'],
        itemsEn: ['Arithmetical summation', 'Gantt chart', 'Time Impact Analysis', 'Impacted As-Planned', 'As-Planned vs As-Built', 'Window Analysis', 'Collapsed As-Built'],
      },
    },
    {
      n: 4, fa: 'بررسی تأخیرات', en: 'Delay review', tab: 'delay',
      side: {
        titleFa: 'خروجی‌های بررسی تأخیرات', titleEn: 'Delay review outputs',
        itemsFa: ['عوامل تأخیر', 'مدت تأخیرات', 'تأخیرات مجاز و غیرمجاز', 'تأخیرات همزمان', 'قابل جبران مالی / غیرقابل جبران مالی', 'تحلیل مالی بر اساس 1300 و 5090 FIDIC'],
        itemsEn: ['Delay factors', 'Delay durations', 'Excusable / non-excusable delays', 'Concurrent delays', 'Compensable / non-compensable', 'Financial analysis per FIDIC & Iranian law'],
      },
    },
    { n: 5, fa: 'تولید لایحه تأخیرات', en: 'Generate delay dossier', tab: 'delay' },
  ],
  finalFa: 'لایحه تأخیرات', finalEn: 'Delay dossier', finalKind: 'output',
};

/* ————— نقشهٔ ۲: تهیه لایحه ضرر و زیان ————— */
const MAP_LOSS: MapDef = {
  id: 'loss',
  titleFa: 'فلوچارت تهیه لایحه ضرر و زیان',
  titleEn: 'Loss & damages dossier workflow',
  subtitleFa: 'بر پایهٔ قرارداد، مستندات، شواهد و قواعد معتبر؛ هر سرفصل با مستندات کافی و قابل استناد',
  subtitleEn: 'Based on contract, records, evidence and valid rules; every head with sufficient citable evidence',
  steps: [
    {
      n: 1, fa: 'بارگذاری اسناد بنیاد پروژه', en: 'Upload project baseline records', tab: 'loss',
      side: {
        titleFa: 'اسناد قابل بارگذاری', titleEn: 'Uploadable documents',
        itemsFa: ['قرارداد', 'الحاقیه و متمم', 'صورت‌جلسات', 'دستورکارها', 'مکاتبات', 'برنامه اولیه', 'برنامه‌های به‌روزرسانی‌شده', 'برنامه چون‌ساخت', 'اسناد مالی پروژه', 'ادعاها و اعتراضات', 'گزارش‌های دوره‌ای', 'سایر اسناد مرتبط'],
        itemsEn: ['Contract', 'Amendments & annexes', 'Minutes', 'Work orders', 'Correspondence', 'Baseline program', 'Schedule updates', 'As-built program', 'Project financial records', 'Claims & objections', 'Periodic reports', 'Other related records'],
        noteFa: 'فرمت‌ها: MSP ,Primavera P6, Word, PDF, تصویر', noteEn: 'Formats: MSP, Primavera P6, Word, PDF, image',
      },
    },
    {
      n: 2, fa: 'تحلیل هوشمند اسناد', en: 'Document analysis', tab: 'loss',
      side: {
        titleFa: 'سرفصل‌های خسارت شناسایی‌شده', titleEn: 'Identified loss heads',
        itemsFa: ['دوباره‌کاری‌ها', 'تغییرات', 'کارهای جدید', 'هزینه‌های منابع', 'نیروی انسانی', 'ماشین‌آلات', 'سایر خسارات', 'کاهش بهره‌وری', 'هزینه‌های مستقیم کارگاه', 'هزینه‌های بالاسری', 'توقف کار', 'تأخیر در پرداخت صورت‌وضعیت', 'تأخیر در پرداخت تعدیل', 'عدم آزادسازی تضامین'],
        itemsEn: ['Rework', 'Variations', 'New work items', 'Resource costs', 'Manpower', 'Machinery', 'Other losses', 'Productivity reduction', 'Direct site running costs', 'Overheads', 'Work stoppage', 'Payment delay (IPC)', 'Escalation payment delay', 'Guarantee non-release'],
      },
    },
    {
      n: 3, fa: 'ارائه فرمول‌های پیشنهادی', en: 'Suggested formulae', tab: 'loss',
      side: {
        titleFa: 'ویرایش فرمول توسط کاربر', titleEn: 'User-editable formulae',
        itemsFa: ['فرمول پیشنهادی برای هر سرفصل', 'تعریف و ویرایش متغیرها و مقادیر', 'اعمال تغییرات و ثبت تاریخچه تغییرات'],
        itemsEn: ['Suggested formula per loss head', 'Define & edit variables and values', 'Apply changes with change history'],
      },
    },
    {
      n: 4, fa: 'محاسبات دقیق ضرر و زیان', en: 'Precise loss calculation', tab: 'loss',
      side: {
        titleFa: 'مبنای محاسبه', titleEn: 'Calculation basis',
        itemsFa: ['قوانین ایران', 'مستندات بین‌المللی', 'منابع معتبر برای فرمول‌ها'],
        itemsEn: ['Iranian law', 'International references', 'Credible formula sources'],
      },
    },
    {
      n: 5, fa: 'بررسی و نهایی‌سازی', en: 'Review & finalisation', tab: 'loss',
      dashedBackFa: 'نیاز به بررسی', dashedBackEn: 'Needs review',
      noteFa: 'وضعیت «نیاز به بررسی» به مرحلهٔ ۳ بازمی‌گردد تا فرمول‌ها اصلاح شوند.', noteEn: '“Needs review” loops back to step 3 so formulae can be adjusted.',
      side: {
        titleFa: 'نتایج بررسی', titleEn: 'Review results',
        itemsFa: ['وضعیت هر سرفصل: تأیید شده / نیاز به بررسی', 'جمع کل ضرر و زیان (ریال)'],
        itemsEn: ['Status per head: approved / needs review', 'Total loss (IRR)'],
        noteFa: 'تأیید شده مدت', noteEn: 'Approved',
      },
    },
    { n: 6, fa: 'تولید لایحه ضرر و زیان', en: 'Generate loss dossier', tab: 'loss' },
  ],
  finalFa: 'لایحه ضرر و زیان', finalEn: 'Loss dossier', finalKind: 'output',
  finalItemsFa: ['Word قابل ویرایش', 'PDF آماده ارائه'],
  finalItemsEn: ['Editable Word', 'Submission-ready PDF'],
  dashedLegendFa: 'مسیر بررسی و بازگشت برای اصلاح', dashedLegendEn: 'Review / rework loop',
};

/* ————— نقشهٔ ۳: مدیریت ریسک قراردادها (ماژول d14) ————— */
const MAP_RISK: MapDef = {
  id: 'risk',
  titleFa: 'فلوچارت مدیریت ریسک قراردادها',
  titleEn: 'Contract risk management workflow',
  subtitleFa: 'شناسایی، اولویت‌بندی ریسک‌ها و مسیر بهبود قرارداد',
  subtitleEn: 'Identify & prioritise contractual risks and the contract-improvement path',
  steps: [
    {
      n: 1, fa: 'بارگذاری قرارداد', en: 'Upload contract', tab: 'contracts',
      side: {
        titleFa: 'اسناد قابل بارگذاری', titleEn: 'Uploadable documents',
        itemsFa: ['قرارداد', 'الحاقیه و متمم', 'صورت‌جلسات', 'مکاتبات', 'اسناد پشتیبان', 'دستورکارها'],
        itemsEn: ['Contract', 'Amendments & annexes', 'Minutes', 'Correspondence', 'Supporting records', 'Work orders'],
        noteFa: 'فرمت‌ها: Word, PDF, تصویر', noteEn: 'Formats: Word, PDF, image',
      },
    },
    { n: 2, fa: 'دریافت اطلاعات اولیه', en: 'Collect initial data', tab: 'contracts' },
    {
      n: 3, fa: 'تحلیل هوشمند قرارداد', en: 'Contract analysis', tab: 'clauses',
      side: {
        titleFa: 'بندهای تحلیل‌شده قرارداد', titleEn: 'Analysed contract clauses',
        itemsFa: ['قلمرو کار', 'مدت و برنامه زمانی', 'پرداخت‌ها', 'تضامین و ضمانت‌نامه‌ها', 'مسئولیت‌ها و تعهدات', 'تغییرات و تعدیل', 'فسخ و خاتمه', 'حل اختلاف'],
        itemsEn: ['Scope of work', 'Time & schedule', 'Payments', 'Bonds & guarantees', 'Liabilities & obligations', 'Variations & escalation', 'Termination', 'Dispute resolution'],
      },
    },
    {
      n: 4, fa: 'شناسایی ریسک‌ها', en: 'Identify risks', tab: 'register',
      side: {
        titleFa: 'ریسک‌های قابل شناسایی', titleEn: 'Identifiable risks',
        itemsFa: ['تضامین', 'تأخیرات', 'تغییرات', 'خسارات', 'مسئولیت‌ها', 'حل اختلاف', 'پرداخت', 'فسخ', 'خاتمه', 'سطح ریسک: بالا / متوسط / پایین / بدون ریسک', 'اولویت‌بندی بر اساس احتمال وقوع و تأثیر'],
        itemsEn: ['Guarantees', 'Delays', 'Variations', 'Damages', 'Liabilities', 'Dispute resolution', 'Payment', 'Termination', 'Closure', 'Risk level: high / medium / low / none', 'Prioritised by likelihood & impact'],
      },
    },
    {
      n: 5, fa: 'پیشنهاد اصلاحات', en: 'Propose amendments', tab: 'improve',
      dashedBackFa: 'بازبینی و اصلاح', dashedBackEn: 'Review & amend',
      noteFa: 'بازبینی و اصلاح — چرخهٔ تکرار', noteEn: 'Review & amend — iterative loop',
      side: {
        titleFa: 'نمونه پیشنهادهای اصلاحی', titleEn: 'Sample improvement proposals',
        itemsFa: ['تعدیل شرایط پرداخت‌ها و تأخیر', 'اصلاح شرایط فسخ یک‌طرفه', 'تکمیل و شفاف‌سازی بند تغییرات', 'تعیین دقیق مسئولیت‌ها و حدود تعهدات', 'بازنگری در سازوکار حل اختلاف', 'پیش‌نمایش بند اصلاح‌شده (پیشنهادی)'],
        itemsEn: ['Adjust payment & delay terms', 'Amend unilateral termination conditions', 'Complete & clarify the variations clause', 'Define liabilities & obligation limits precisely', 'Rework the dispute-resolution mechanism', 'Amended clause preview (suggested)'],
      },
    },
    { n: 6, fa: 'بهبود قرارداد', en: 'Contract improvement', tab: 'improve' },
  ],
  finalFa: 'خروجی این بخش', finalEn: 'Section outputs', finalKind: 'section',
  finalItemsFa: ['فهرست ریسک‌ها', 'تحلیل بندهای قرارداد', 'پیشنهادهای اصلاحی برای بهبود قرارداد'],
  finalItemsEn: ['Risk register', 'Clause analysis', 'Contract improvement proposals'],
  dashedLegendFa: 'مسیر بازگشت برای اصلاح و بهبود', dashedLegendEn: 'Rework / improvement loop',
};

/* ————— نقشهٔ ۴: کارشناسی، داوری و قضاوت دعوای ساخت ————— */
const MAP_DISPUTE: MapDef = {
  id: 'dispute',
  titleFa: 'فلوچارت کارشناسی، داوری و قضاوت دعوای ساخت',
  titleEn: 'Construction dispute expert determination, arbitration & judgement workflow',
  subtitleFa: 'گردش‌کار تحلیل و مقایسهٔ استدلال طرفین از استخراج اطلاعات تا گزارش تحلیل دعوا',
  subtitleEn: 'From information extraction to the dispute analysis report — comparing both parties’ arguments',
  steps: [
    {
      n: 2, fa: 'بارگذاری اسناد طرفین', en: 'Upload parties’ records', tab: 'dexp',
      side: {
        titleFa: 'اسناد طرفین خواهان و خوانده', titleEn: 'Claimant & respondent records',
        itemsFa: ['قرارداد', 'الحاقیه و متمم', 'صورت‌جلسات و دستورکارها', 'مکاتبات', 'ادعاها و اعتراضات', 'اسناد مالی و صورت‌وضعیت', 'برنامه‌های زمان‌بندی', 'برنامه چون‌ساخت', 'گزارش‌های دوره‌ای', 'سایر مستندات مرتبط'],
        itemsEn: ['Contract', 'Amendments & annexes', 'Minutes & work orders', 'Correspondence', 'Claims & objections', 'Financial records & IPC', 'Schedules', 'As-built program', 'Periodic reports', 'Other related documents'],
        noteFa: 'فرمت‌ها: MSP ,Primavera P6, Word, PDF, تصویر', noteEn: 'Formats: MSP, Primavera P6, Word, PDF, image',
      },
    },
    {
      n: 1, fa: 'استخراج اطلاعات و رویدادها', en: 'Extract information & events', tab: 'dexp',
      side: {
        titleFa: 'نتایج استخراج', titleEn: 'Extraction results',
        itemsFa: ['موضوع دعوا', 'رویدادها و اطلاعات کلیدی', 'اسناد هر طرف (خواهان/خوانده)', 'استدلال‌های طرفین'],
        itemsEn: ['Dispute subject', 'Key events & information', 'Each party’s records', 'Parties’ arguments'],
      },
    },
    {
      n: 3, fa: 'تحلیل قوانین و دستورالعمل‌ها', en: 'Analyse laws & guidelines', tab: 'dexp',
      side: {
        titleFa: 'مبانی تحلیل', titleEn: 'Analysis basis',
        itemsFa: ['قوانین و قواعد ایران', 'اسناد پروژه و قرارداد', 'مستندات طرفین دعوا', 'دستورالعمل‌های معتبر داخلی و بین‌المللی'],
        itemsEn: ['Iranian laws & regulations', 'Project records & contract', 'Dispute parties’ records', 'Valid national & international guidelines'],
      },
    },
    {
      n: 4, fa: 'تحلیل استدلال‌ها و مستندات', en: 'Analyse arguments & evidence', tab: 'dexp',
      side: {
        titleFa: 'تحلیل ساختارمند استدلال‌ها و مستندات طرفین', titleEn: 'Structured analysis of parties’ arguments & evidence',
        itemsFa: ['استدلال‌های طرف خواهان و خوانده', 'نقاط توافق و اختلاف', 'مسائل کلیدی دعوا:', 'تأخیرات مجاز و غیرمجاز', 'قابلیت جبران خسارت', 'اثر تغییرات بر مدت و هزینه', 'مسئولیت‌های قراردادی'],
        itemsEn: ['Claimant & respondent arguments', 'Points of agreement & dispute', 'Key dispute issues:', 'Excusable / non-excusable delays', 'Compensability', 'Variation effect on time & cost', 'Contractual liabilities'],
      },
    },
    {
      n: 5, fa: 'جمع‌بندی و ارائه پیشنهادها', en: 'Conclude & propose', tab: 'dexp',
      side: {
        titleFa: 'نتایج جمع‌بندی', titleEn: 'Conclusions',
        itemsFa: ['نتیجه‌گیری تحلیلی', 'پیشنهادهای تخصصی'],
        itemsEn: ['Analytical conclusion', 'Expert proposals'],
      },
    },
    { n: 6, fa: 'گزارش تحلیل و خروجی نهایی', en: 'Analysis report & final output', tab: 'dexp' },
  ],
  finalFa: 'خروجی‌های نرم‌افزار', finalEn: 'Software outputs', finalKind: 'output',
  finalItemsFa: ['گزارش تحلیل دعوا', 'جدول مقایسه استدلال‌ها', 'نقاط توافق و اختلاف', 'پیش‌نویس استدلال‌های تحلیلی', 'خروجی Word و PDF'],
  finalItemsEn: ['Dispute analysis report', 'Argument comparison table', 'Agreement & dispute points', 'Draft analytical arguments', 'Word & PDF export'],
  footerFa: 'مناسب برای: پیمانکاران، کارفرمایان، مشاوران، وکلا، داوران، کارشناسان — این بخش ابزار کمک تحلیلی است و جایگزین قضاوت انسانی نیست.',
  footerEn: 'For contractors, employers, consultants, lawyers, arbitrators & experts — this section is an analytical aid, not a substitute for human judgement.',
};

const MAPS: MapDef[] = [MAP_DELAY, MAP_LOSS, MAP_RISK, MAP_DISPUTE];

/* ————— اجزای ترسیم (هماهنگ با نقشهٔ برنامه‌ریزی: کاپ‌ها، رنگ خردمند پاستیلی، فلش ممتد/خط‌چین) ————— */
const boxCls = {
  proc: 'border-[#57a773] bg-[#e2f2e7] text-[#17563a]',
  io: 'border-[#c9cfc9] bg-[#efeee9] text-[#26332e]',
  fin: 'border-[#b9a86a] bg-[#f7f4ec] text-[#6b5d24]',
  cross: 'border-[#d9c9a9] bg-[#faf8f2] border-dashed text-[#7a6a35]',
};
const sectionCls = 'rounded-2xl border border-[#d8ded8] bg-[#f6f8f6] px-4 py-3';
const colHead = 'text-center text-[11px] font-semibold text-[#55665f]';
const titleCls = 'text-center text-[15px] font-bold text-[#1c2b26]';
const subCls = 'mt-1 text-center text-[11px] font-light text-[#55665f]';
const arrowCls = 'flex items-center justify-center text-[13px] text-[#5c6f68]';
const vArrowCls = 'mx-auto py-0.5 text-[13px] leading-4 text-[#5c6f68]';
const stepCls = `flex w-full flex-col items-center justify-center rounded-[10px] border-[1.5px] px-3 py-2.5 text-center cursor-pointer transition hover:shadow-md hover:brightness-[1.03] focus:outline-none focus:ring-2 focus:ring-[#57a773] ${boxCls.proc}`;
const itemLi = 'leading-5 text-[10px] opacity-80';

function SideCard({ s, fa, dir }: { s: SideBlock; fa: boolean; dir: 'rtl' | 'ltr' }) {
  const cols = s.itemsFa.length > 8;
  return (
    <div className={`rounded-[10px] border-[1.5px] px-3 py-2.5 ${boxCls.io}`}>
      <div className="text-center text-[12px] font-bold leading-5" dir={dir}>{fa ? s.titleFa : s.titleEn}</div>
      <ul dir={dir} className={`mt-1 ${cols ? 'grid grid-cols-2 gap-x-3' : ''}`}>
        {(fa ? s.itemsFa : s.itemsEn).map((it, i) => (
          <li key={i} className={itemLi}>· {it}</li>
        ))}
      </ul>
      {s.noteFa && <div className="mt-1 text-center text-[9px] opacity-70" dir={s.noteFa.includes('MSP') ? 'ltr' : dir}>{fa ? s.noteFa : s.noteEn}</div>}
    </div>
  );
}

function FlowChart({ map, fa, onNavigate }: { map: MapDef; fa: boolean; onNavigate: (tab: string) => void }) {
  const L = (a: string, b: string) => (fa ? a : b);
  return (
    <section dir="ltr" className={sectionCls} aria-label={L(map.titleFa, map.titleEn)}>
      <h3 className={titleCls} dir="rtl">{L(map.titleFa, map.titleEn)}</h3>
      <p className={subCls} dir="rtl">{L(map.subtitleFa, map.subtitleEn)}</p>

      {/* سرستون‌ها — عین نقشهٔ برنامه‌ریزی */}
      <div className="mt-3 grid grid-cols-[1.15fr_22px_1fr]" >
        <div className={colHead} dir="rtl">{fa ? 'ورودی‌ها و خروجی‌های هر مرحله' : 'Step inputs / outputs'}</div>
        <div />
        <div className={colHead} dir="rtl">{fa ? 'مراحل فرایند' : 'Process steps'}</div>
      </div>

      <div className="mt-1.5 flex flex-col">
        {map.steps.map((st, i) => (
          <div key={i} className="flex flex-col">
            <div className="grid grid-cols-[1.15fr_22px_1fr] items-stretch">
              {st.side ? <SideCard s={st.side} fa={fa} dir="rtl" /> : <div />}
              <div className={arrowCls}>{st.side ? '→' : ''}</div>
              <button type="button" className={stepCls} dir="rtl"
                onClick={() => onNavigate(st.tab)}
                title={fa ? 'رفتن به تب عملیاتی' : 'Open operational tab'}>
                <span className="block text-[13px] font-bold leading-5">{L(st.fa, st.en)}</span>
                {st.n != null && (
                  <span className="mt-0.5 mx-auto w-fit rounded-full bg-[#cde8d7] px-2 py-px text-[8.5px] font-bold text-[#17563a]">
                    {fa ? `مرحله ${faNum(st.n)}` : `Step ${st.n}`}
                  </span>
                )}
              </button>
            </div>
            {st.noteFa && (
              <div className="grid grid-cols-[1.15fr_22px_1fr]">
                <div /><div />
                <div className="text-left text-[9.5px] leading-5 text-[#6b7a74]" dir="rtl">{L(st.noteFa, st.noteEn ?? '')}</div>
              </div>
            )}
            {st.dashedBackFa && (
              <div className="grid grid-cols-[1.15fr_22px_1fr] items-center">
                <div />
                <div />
                <div className={`my-1 mx-auto w-fit rounded-[10px] border-[1.5px] px-3 py-1 text-center text-[9.5px] ${boxCls.cross}`} dir="rtl">
                  ↩ {L(st.dashedBackFa, st.dashedBackEn ?? '')}
                </div>
              </div>
            )}
            {i < map.steps.length - 1 && (
              <div className="grid grid-cols-[1.15fr_22px_1fr]"><div /><div /><div className={vArrowCls}>↓</div></div>
            )}
          </div>
        ))}
        {/* خروجی نهایی */}
        <div className="grid grid-cols-[1.15fr_22px_1fr]"><div /><div /><div className={vArrowCls}>↓</div></div>
        <div className="grid grid-cols-[1.15fr_22px_1fr] items-stretch">
          <div />
          <div />
          <div className={`rounded-[10px] border-[1.5px] px-3 py-2.5 text-center ${map.finalKind === 'output' ? boxCls.fin : boxCls.io}`} dir="rtl">
            <span className="block text-[13px] font-bold leading-5">{L(map.finalFa, map.finalEn)}</span>
            <span className="mt-0.5 block text-[10px] font-normal leading-4 opacity-70">
              {map.finalKind === 'output' ? (fa ? 'خروجی نهایی' : 'Final output') : (fa ? 'خروجی‌های این بخش' : 'This section’s outputs')}
            </span>
            {map.finalItemsFa && (
              <ul className="mt-1 text-right">
                {(fa ? map.finalItemsFa : map.finalItemsEn!).map((it, i) => <li key={i} className={itemLi}>· {it}</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>

      {map.footerFa && (
        <div className="mt-3 rounded-[10px] border-[1.5px] border-[#e0e4e0] bg-[#fbfbfa] px-3 py-2 text-center text-[10px] leading-5 text-[#55665f]" dir="rtl">
          {L(map.footerFa, map.footerEn ?? '')}
        </div>
      )}
      <Legend fa={fa} dashed={map.dashedLegendFa ? L(map.dashedLegendFa, map.dashedLegendEn ?? '') : undefined}
        finLabel={fa ? 'خروجی نهایی' : 'Final output'} />
    </section>
  );
}

function Legend({ fa, dashed, finLabel }: { fa: boolean; dashed?: string; finLabel: string }) {
  const sw = 'ml-1 inline-block h-3 w-3 rounded-[4px] border-[1.5px] align-[-2px]';
  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-[#55665f]" dir="rtl">
      <span><i className={`${sw} ${boxCls.proc}`} />{fa ? 'مراحل فرایند / پردازش' : 'Process / processing'}</span>
      <span><i className={`${sw} ${boxCls.io}`} />{fa ? 'ورودی‌ها و خروجی‌های هر مرحله' : 'Step inputs & outputs'}</span>
      <span><i className={`${sw} ${boxCls.fin}`} />{finLabel}</span>
      {dashed && <span><i className={`${sw} ${boxCls.cross}`} />{dashed}</span>}
      <span className="opacity-70">{fa ? 'با کلیک روی هر مرحله به بخش عملیاتی آن می‌روید.' : 'Click a step to open its section.'}</span>
    </div>
  );
}

function faNum(n: number) { return '۰۱۲۳۴۵۶۷۸۹'[n] ?? String(n); }

/* ————— نقشهٔ یکپارچهٔ فرایند ادعا در چرخهٔ قرارداد ————— */
function IntegratedMap({ fa, onSelect, allowed }: { fa: boolean; onSelect: (id: MapDef['id']) => void; allowed?: (MapDef['id'] | 'integrated')[] }) {
  const L = (a: string, b: string) => (fa ? a : b);
  const phaseHead = 'text-center text-[13px] font-extrabold text-[#1c2b26]';
  const phaseBox = 'rounded-[14px] border-[1.5px] border-[#a9b6b0] bg-[#f8faF8] px-3 pb-3 pt-3';
  const secBox = `w-full flex flex-col items-center justify-center rounded-[10px] border-[1.5px] px-3 py-2.5 text-center cursor-pointer transition hover:shadow-md hover:brightness-[1.03] focus:outline-none focus:ring-2 focus:ring-[#57a773] ${boxCls.proc}`;
  const outCard = `rounded-[10px] border-[1.5px] px-3 py-2.5 ${boxCls.io}`;
  const finCard = `rounded-[10px] border-[1.5px] px-3 py-2.5 ${boxCls.fin}`;
  const outHead = 'mb-1 text-center text-[11px] font-bold text-[#26332e]';
  const finHead = 'mb-1 text-center text-[11px] font-bold text-[#6b5d24]';

  const Row = ({ box, card, cardNode }: { box: React.ReactNode; card?: 'out' | 'fin'; cardNode: React.ReactNode }) => (
    <div className="grid items-stretch gap-2" style={{ gridTemplateColumns: '1fr 22px 1.05fr' }} dir="ltr">
      {card ? <div className={card === 'out' ? outCard : finCard} dir="rtl">{cardNode}</div> : <div />}
      <div className={arrowCls}>←</div>
      <div>{box}</div>
    </div>
  );

  const B = (id: MapDef['id'], num: string, faT: string, enT: string) => {
    const enabled = !allowed || allowed.includes(id);
    return (
      <button type="button" className={secBox + (enabled ? '' : ' opacity-60 cursor-default')} disabled={!enabled}
        onClick={() => onSelect(id)}
        title={enabled ? (fa ? 'باز کردن فلوچارت این بخش' : 'Open this section’s flowchart') : (fa ? 'این بخش در ماژول دیگر است' : 'This section lives in another module')}>
        {faT}
        <span className="mt-0.5 mx-auto w-fit rounded-full bg-[#cde8d7] px-2 py-px text-[8.5px] font-bold text-[#17563a]">{fa ? `بخش ${num}` : enT}</span>
      </button>
    );
  };
  const li = 'leading-5';

  return (
    <section className={sectionCls} dir="rtl">
      <h3 className={titleCls}>{L('نقشهٔ یکپارچهٔ فرایند ادعا در چرخهٔ قرارداد', 'Integrated claims map across the contract lifecycle')}</h3>
      <p className={subCls}>{L('بخش ۳ در ابتدای قرارداد · بخش‌های ۱ و ۲ هنگام ادعا · بخش ۴ در مرحله داوری', 'Section 3 at contract start · sections 1–2 at claim time · section 4 at arbitration')}</p>

      <div className="relative mt-4 flex flex-col gap-2">
        {/* فاز ۱ */}
        <div className={phaseBox}>
          <div className={phaseHead}>{fa ? 'فاز ۱ · ابتدای قرارداد' : 'Phase 1 · Contract start'}</div>
          <div className="mt-2">
            <Row
              box={B('risk', '۳', 'مدیریت ریسک و بهبود قرارداد', 'Section 3')}
              card="out"
              cardNode={<><div className={outHead}>{fa ? 'خروجی‌های مدیریت ریسک قرارداد' : 'Contract risk outputs'}</div><ul>{[fa ? 'فهرست ریسک‌ها' : 'Risk register', fa ? 'تحلیل بندهای قرارداد' : 'Clause analysis', fa ? 'پیشنهادهای اصلاحی' : 'Improvement suggestions'].map((t, i) => <li key={i} className={li}>· {t}</li>)}</ul></>}
            />
          </div>
        </div>
        <ConnectorEdge left={fa ? 'بندها و مبنای قراردادی' : 'Clauses & contractual basis'} right={fa ? 'اجرای قرارداد' : 'Contract execution'} />
        {/* فاز ۲ */}
        <div className={phaseBox}>
          <div className={phaseHead}>{fa ? 'فاز ۲ · هنگام ادعا' : 'Phase 2 · At claim time'}</div>
          <div className="mt-2 flex flex-col gap-3">
            <Row
              box={B('delay', '۱', 'تهیه لایحه تأخیرات', 'Section 1')}
              card="out"
              cardNode={<><div className={outHead}>{fa ? 'خروجی‌های لایحه تأخیرات' : 'Delay dossier outputs'}</div><ul>{[fa ? 'عوامل و مدت تأخیرات' : 'Factors & durations', fa ? 'تأخیرات مجاز و غیرمجاز' : 'Excusable/non-excusable', fa ? 'تأخیرات همزمان' : 'Concurrent delays', fa ? 'قابل جبران مالی / غیرقابل جبران مالی' : 'Compensable/non-compensable'].map((t, i) => <li key={i} className={li}>· {t}</li>)}</ul></>}
            />
            <ConnectorEdge left={fa ? 'تأخیر قابل جبران مالی و مدت' : 'Compensable delay & time'} short />
            <Row
              box={B('loss', '۲', 'تهیه لایحه ضرر و زیان', 'Section 2')}
              card="out"
              cardNode={<><div className={outHead}>{fa ? 'خروجی‌های لایحه ضرر و زیان' : 'Loss & damages outputs'}</div><ul>{[fa ? 'سرفصل‌های خسارت و فرمول‌ها' : 'Loss heads & formulae', fa ? 'محاسبه دقیق ضرر و زیان' : 'Precise calculation', fa ? 'جمع کل ضرر و زیان (ریال)' : 'Total loss (IRR)'].map((t, i) => <li key={i} className={li}>· {t}</li>)}</ul></>}
            />
          </div>
        </div>
        <ConnectorEdge left={fa ? 'لوایح و مستندات' : 'Dossiers & records'} right={fa ? 'ارجاع اختلاف' : 'Dispute referral'} />
        {/* فاز ۳ */}
        <div className={phaseBox}>
          <div className={phaseHead}>{fa ? 'فاز ۳ · مرحله داوری' : 'Phase 3 · Arbitration'}</div>
          <div className="mt-2">
            <Row
              box={B('dispute', '۴', 'کارشناسی، داوری و قضاوت دعوا', 'Section 4')}
              card="fin"
              cardNode={<><div className={finHead}>{fa ? 'خروجی‌های کارشناسی و داوری' : 'Expert & arbitration outputs'}</div><ul>{[fa ? 'تحلیل استدلال‌ها و مستندات' : 'Arguments & evidence analysis', fa ? 'نقاط توافق و اختلاف' : 'Points of agreement & dispute', fa ? 'گزارش تحلیل دعوا (Word و PDF)' : 'Dispute analysis report (Word & PDF)'].map((t, i) => <li key={i} className={li}>· {t}</li>)}</ul></>}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[10px] border-[1.5px] border-[#e0e4e0] bg-[#fbfbfa] px-4 py-2.5 text-center text-[10px] leading-5 text-[#55665f]" dir="rtl">
        {fa ? 'ورودی مشترک: قرارداد، الحاقیه، صورت‌جلسات، مکاتبات، برنامه‌های زمان‌بندی، گزارش‌های دوره‌ای و اسناد مالی' : 'Shared inputs: contract, annexes, minutes, correspondence, schedules, period reports & financial records'}
        <br />{fa ? 'فرمت‌های پشتیبانی: MSP ,Primavera P6, Word, PDF' : 'Supported: MSP, Primavera P6, Word, PDF'}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-[#55665f]" dir="rtl">
        <span><i className="ml-1 inline-block h-3 w-3 rounded-[4px] border-[1.5px] border-[#57a773] bg-[#e2f2e7] align-[-2px]" />{fa ? 'بخش‌های نرم‌افزار' : 'Software sections'}</span>
        <span><i className="ml-1 inline-block h-3 w-3 rounded-[4px] border-[1.5px] border-[#c9cfc9] bg-[#efeee9] align-[-2px]" />{fa ? 'خروجی هر بخش' : 'Section outputs'}</span>
        <span><i className="ml-1 inline-block h-3 w-3 rounded-[4px] border-[1.5px] border-[#b9a86a] bg-[#f7f4ec] align-[-2px]" />{fa ? 'خروجی نهایی' : 'Final output'}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-5 border-t-2 border-[#57a773]" />{fa ? 'ترتیب فازها' : 'Phase order'}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-5 border-t-2 border-dashed border-[#b9a86a]" />{fa ? 'جریان دادهٔ پیشنهادی' : 'Suggested data flow'}</span>
        <span className="opacity-70">{fa ? 'با کلیک روی هر بخش، فلوچارت داخلی آن باز می‌شود.' : 'Click a section to open its internal flowchart.'}</span>
      </div>
    </section>
  );
}

function ConnectorEdge({ left, right, short }: { left: string; right?: string; short?: boolean }) {
  /* لبهٔ اتصال میان فازها: خط ممتد (ترتیب) یا خط‌چین (جریان داده) با برچسب لبه */
  return (
    <div className={`relative flex items-center justify-between px-6 ${short ? 'py-0.5' : 'py-1'}`} dir="rtl">
      <div className="flex flex-col items-center">
        <span className="h-4 w-px border-r-[1.5px] border-dashed border-[#b9a86a]" />
        <span className="text-[11px] leading-3 text-[#b9a86a]">▼</span>
        <span className="text-[9.5px] text-[#6b5d24]">{left}</span>
      </div>
      {right && (
        <div className="flex flex-col items-center">
          <span className="h-4 w-px border-r-[1.5px] border-[#57a773]" />
          <span className="text-[11px] leading-3 text-[#57a773]">▼</span>
          <span className="text-[9.5px] font-semibold text-[#17563a]">{right}</span>
        </div>
      )}
    </div>
  );
}

/* ————— کامپوننت اصلی ————— */
export type ProcessMapId = MapDef['id'] | 'integrated';

type Props = {
  lang: Lang;
  onNavigate: (tab: string) => void;
  /** نقشه‌های قابل نمایش در این ماژول؛ پیش‌فرض: همه */
  only?: ProcessMapId[];
  /** نقشهٔ پیش‌فرض هنگام باز شدن */
  defaultMap?: ProcessMapId;
};

/* هر نقشه متعلق به ماژول واقعی خودش است (only آن‌ها را محدود می‌کند)؛ نقشهٔ
   یکپارچه همهٔ مراحل را گرد می‌آورد و در هر دو ماژول d4 و d14 قابل مشاهده است. */
export default function ProcessFlowMaps({ lang, onNavigate, only, defaultMap }: Props) {
  const fa = lang === 'fa';
  const allowed: ProcessMapId[] = only ?? ['integrated', 'delay', 'loss', 'risk', 'dispute'];
  const first = defaultMap && allowed.includes(defaultMap) ? defaultMap : allowed[0];
  const [sel, setSel] = useState<ProcessMapId>(first);
  const active = allowed.includes(sel) ? sel : allowed[0];
  const pill = (on: boolean) => `rounded-full border-[1.5px] px-3.5 py-1.5 text-[11px] font-semibold transition ${on ? 'border-[#57a773] bg-[#e2f2e7] text-[#17563a] shadow-sm' : 'border-[#d8ded8] bg-[#f8faF8] text-[#6b7a74] hover:border-[#a9b6b0] hover:text-[#37473f]'}`;
  const NAME_FA: Record<ProcessMapId, string> = { integrated: 'نقشهٔ یکپارچه', delay: 'تهیه لایحه تأخیرات', loss: 'تهیه لایحه ضرر و زیان', risk: 'مدیریت ریسک و بهبود قرارداد', dispute: 'کارشناسی و داوری دعوا' };
  const NAME_EN: Record<ProcessMapId, string> = { integrated: 'Integrated map', delay: 'Delay dossier', loss: 'Loss dossier', risk: 'Contract risk', dispute: 'Dispute expert' };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-[#d8ded8] bg-[#f2f4f2]/60 p-3" dir={fa ? 'rtl' : 'ltr'}>
      {allowed.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {allowed.map((id) => (
            <button key={id} type="button" className={pill(active === id)} onClick={() => setSel(id)}>
              {fa ? NAME_FA[id] : NAME_EN[id]}
            </button>
          ))}
        </div>
      )}
      {MAPS.filter((m) => m.id === active).map((m) => <FlowChart key={m.id} map={m} fa={fa} onNavigate={onNavigate} />)}
      {active === 'integrated' && <IntegratedMap fa={fa} allowed={allowed} onSelect={(id) => { if (allowed.includes(id)) setSel(id); }} />}
    </div>
  );
}
