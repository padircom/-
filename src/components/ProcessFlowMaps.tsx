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
  subtitleFa: 'شناسایی سرفصل‌های خسارت، ارائه فرمول‌های پیشنهادی و محاسبه دقیق ضرر و زیان',
  subtitleEn: 'Loss-head identification, suggested formulas & precise loss and damages calculation',
  steps: [
    {
      n: 1, fa: 'بارگذاری اسناد بنیاد پروژه', en: 'Upload underlying documents', tab: 'loss',
      side: {
        titleFa: 'اسناد قابل بارگذاری', titleEn: 'Uploadable documents',
        itemsFa: ['قرارداد، الحاقیه و متمم', 'برنامه‌های به‌روزرسانی‌شده', 'درخواست چون‌ساخت', 'اسناد مالی پروژه', 'ادعاها و اعتراضات', 'گزارش‌های دوره‌ای', 'سایر اسناد مرتبط', 'صورت‌جلسات', 'دستورکارها', 'مکاتبات', 'برنامه اولیه'],
        itemsEn: ['Contract, amendments & annexes', 'Schedule updates', 'As-built program', 'Project financial records', 'Claims & objections', 'Periodic reports', 'Other related documents', 'Minutes', 'Work orders', 'Correspondence', 'Baseline program'],
        noteFa: 'فرمت‌ها: MSP ,Primavera P6, Word, PDF, تصویر', noteEn: 'Formats: MSP, Primavera P6, Word, PDF, image',
      },
    },
    {
      n: 2, fa: 'تحلیل هوشمند اسناد', en: 'Document analysis', tab: 'loss',
      side: {
        titleFa: 'سرفصل‌های خسارت شناسایی‌شده', titleEn: 'Identified loss heads',
        itemsFa: ['دوباره‌کاری‌ها', 'تغییرات', 'کارهای جدید', 'هزینه‌های منابع', 'نیروی انسانی', 'ماشین‌آلات', 'سایر خسارات', 'کاهش بهره‌وری', 'هزینه‌های مستقیم کارگاه', 'هزینه‌های بالاسری', 'توقف کار', 'تأخیر در پرداخت صورت‌وضعیت', 'تأخیر در پرداخت تعدیل', 'عدم آزادسازی تضامین'],
        itemsEn: ['Re-work', 'Variations', 'New works', 'Resource costs', 'Labour', 'Equipment', 'Other losses', 'Loss of productivity', 'Site direct costs', 'Overheads', 'Suspension', 'Late IPC payment', 'Late price-adjustment payment', 'Non-release of guarantees'],
      },
    },
    {
      n: 3, fa: 'ارائه فرمول‌های پیشنهادی', en: 'Suggested formulas', tab: 'loss',
      side: {
        titleFa: 'ویرایش فرمول توسط کاربر', titleEn: 'User formula editing',
        itemsFa: ['فرمول پیشنهادی برای هر سرفصل', 'تعریف و ویرایش متغیرها و مقادیر', 'اعمال تغییرات و ثبت تاریخچه تغییرات'],
        itemsEn: ['Suggested formula per loss head', 'Define & edit variables and values', 'Apply changes with change history'],
      },
    },
    {
      n: 4, fa: 'محاسبات دقیق ضرر و زیان', en: 'Precise loss calculation', tab: 'loss',
      dashedBackFa: 'نیاز به بررسی', dashedBackEn: 'Needs review',
      side: {
        titleFa: 'مبنای محاسبه', titleEn: 'Calculation basis',
        itemsFa: ['قوانین ایران', 'مستندات بین‌المللی', 'منابع معتبر برای فرمول‌ها'],
        itemsEn: ['Iranian law', 'International references', 'Authoritative formula sources'],
      },
    },
    {
      n: 5, fa: 'بررسی و نهایی‌سازی', en: 'Review & finalization', tab: 'loss',
      noteFa: 'تأیید شده', noteEn: 'Approved',
      side: {
        titleFa: 'نتایج بررسی', titleEn: 'Review results',
        itemsFa: ['وضعیت هر سرفصل: تأیید شده / نیاز به بررسی (ریال)', 'جمع کل ضرر و زیان (ریال)'],
        itemsEn: ['Status per loss head: approved / needs review', 'Total loss & damages (IRR)'],
      },
    },
    { n: 6, fa: 'تولید لایحه ضرر و زیان', en: 'Generate loss dossier', tab: 'loss' },
  ],
  finalFa: 'لایحه ضرر و زیان', finalEn: 'Loss & damages dossier', finalKind: 'output',
  finalItemsFa: ['Word قابل ویرایش', 'PDF آماده ارائه'], finalItemsEn: ['Editable Word', 'Presentation-ready PDF'],
  dashedLegendFa: 'مسیر بازگشت برای اصلاح', dashedLegendEn: 'Return path for correction',
};

/* ————— نقشهٔ ۳: مدیریت ریسک قراردادها و بهبود قرارداد ————— */
const MAP_RISK: MapDef = {
  id: 'risk',
  titleFa: 'فلوچارت مدیریت ریسک قراردادها و بهبود قرارداد',
  titleEn: 'Contract risk & improvement workflow',
  subtitleFa: 'تحلیل هوشمند قرارداد برای شناسایی ریسک‌ها و ارائه پیشنهادهای اصلاحی',
  subtitleEn: 'In-depth contract analysis for risk identification & improvement suggestions',
  steps: [
    {
      n: 1, fa: 'بارگذاری قرارداد', en: 'Upload contract', tab: 'contracts',
      side: {
        titleFa: 'اسناد قابل بارگذاری', titleEn: 'Uploadable documents',
        itemsFa: ['قرارداد', 'الحاقیه و متمم', 'صورت‌جلسات', 'مکاتبات', 'اسناد پشتیبان', 'دستورکارها'],
        itemsEn: ['Contract', 'Amendments & annexes', 'Minutes', 'Correspondence', 'Supporting records', 'Work orders'],
        noteFa: 'فرمت: Word, PDF, تصویر', noteEn: 'Formats: Word, PDF, image',
      },
    },
    { n: 2, fa: 'دریافت اطلاعات اولیه', en: 'Initial data intake', tab: 'contracts' },
    {
      n: 3, fa: 'تحلیل هوشمند قرارداد', en: 'Contract analysis', tab: 'clauses',
      side: {
        titleFa: 'بندهای تحلیل‌شده قرارداد', titleEn: 'Analysed contract clauses',
        itemsFa: ['قلمرو کار', 'مدت و برنامه زمانی', 'پرداخت‌ها', 'تضامین و ضمانت‌نامه‌ها', 'مسئولیت‌ها و تعهدات', 'تغییرات و تعدیل', 'فسخ و خاتمه', 'حل اختلاف'],
        itemsEn: ['Scope of work', 'Duration & schedule', 'Payments', 'Guarantees & bonds', 'Liabilities & obligations', 'Variations & adjustments', 'Termination', 'Dispute resolution'],
      },
    },
    {
      n: 4, fa: 'شناسایی ریسک‌ها', en: 'Risk identification', tab: 'register',
      side: {
        titleFa: 'ریسک‌های قابل شناسایی', titleEn: 'Identifiable risks',
        itemsFa: ['تضامین', 'تأخیرات', 'تغییرات', 'خسارات', 'مسئولیت‌ها', 'حل اختلاف', 'پرداخت', 'فسخ', 'خاتمه', 'سطح ریسک: بالا / متوسط / پایین / بدون ریسک', 'اولویت‌بندی بر اساس احتمال وقوع و تأثیر'],
        itemsEn: ['Guarantees', 'Delays', 'Variations', 'Damages', 'Liabilities', 'Disputes', 'Payment', 'Termination', 'Closure', 'Risk level: high / medium / low / none', 'Prioritised by likelihood & impact'],
      },
    },
    {
      n: 5, fa: 'پیشنهاد اصلاحات', en: 'Improvement suggestions', tab: 'improve',
      dashedBackFa: 'بازبینی و اصلاح', dashedBackEn: 'Review & amend',
      side: {
        titleFa: 'نمونه پیشنهادهای اصلاحی', titleEn: 'Sample improvements',
        itemsFa: ['تعدیل شرایط پرداخت‌ها و تأخیر', 'اصلاح شرایط فسخ یک‌طرفه', 'تکمیل و شفاف‌سازی بند تغییرات', 'تعیین دقیق مسئولیت‌ها و حدود تعهدات', 'بازنگری در سازوکار حل اختلاف', 'پیش‌نمایش بند اصلاح‌شده (پیشنهادی)'],
        itemsEn: ['Adjust payment & delay terms', 'Amend unilateral termination terms', 'Clarify variation clause', 'Precise liabilities & limits', 'Review dispute-resolution mechanics', 'Preview amended clause (suggested)'],
      },
    },
    { n: 6, fa: 'بهبود قرارداد', en: 'Contract improvement', tab: 'improve' },
  ],
  finalFa: 'خروجی این بخش', finalEn: 'This section\u2019s outputs', finalKind: 'section',
  finalItemsFa: ['فهرست ریسک‌ها', 'تحلیل بندهای قرارداد', 'پیشنهادهای اصلاحی برای بهبود قرارداد'],
  finalItemsEn: ['Risk register', 'Contract clause analysis', 'Suggestions to improve the contract'],
  dashedLegendFa: 'مسیر بازگشت برای بازبینی و اصلاح', dashedLegendEn: 'Return path for review & amendment',
};

/* ————— نقشهٔ ۴: کارشناسی، داوری و قضاوت دعوای ساخت ————— */
const MAP_DISPUTE: MapDef = {
  id: 'dispute',
  titleFa: 'فلوچارت کارشناسی، داوری و قضاوت دعوای ساخت',
  titleEn: 'Construction dispute expert, arbitration & adjudication workflow',
  subtitleFa: 'تحلیل منصفانه و ساختارمند دعوای ساخت بر اساس قوانین ایران، اسناد پروژه و مستندات طرفین',
  subtitleEn: 'Impartial, structured analysis of construction disputes based on Iranian law, project documents and parties\u2019 evidence',
  steps: [
    {
      n: 1, fa: 'بارگذاری اسناد طرفین', en: 'Upload parties\u2019 documents', tab: 'dexp',
      side: {
        titleFa: 'اسناد قابل بارگذاری', titleEn: 'Uploadable documents',
        itemsFa: ['قرارداد، الحاقیه و متمم', 'صورت‌جلسات و دستورکارها', 'مکاتبات، ادعاها و اعتراضات', 'اسناد مالی و صورت‌وضعیت', 'برنامه‌های زمان‌بندی', 'درخواست چون‌ساخت', 'گزارش‌های دوره‌ای', 'سایر مستندات مرتبط'],
        itemsEn: ['Contract, amendments & annexes', 'Minutes & work orders', 'Correspondence, claims & objections', 'Financial records & IPCs', 'Schedules', 'As-built program', 'Periodic reports', 'Other related documents'],
        noteFa: 'فرمت‌ها: MSP ,Primavera P6, Word, PDF, تصویر', noteEn: 'Formats: MSP, Primavera P6, Word, PDF, image',
      },
    },
    {
      n: 2, fa: 'استخراج اطلاعات و رویدادها', en: 'Information & event extraction', tab: 'dexp',
      side: {
        titleFa: 'نتایج استخراج', titleEn: 'Extraction results',
        itemsFa: ['موضوع دعوا', 'رویدادها و اطلاعات کلیدی', 'اسناد هر طرف (خواهان / خوانده)'],
        itemsEn: ['Dispute subject', 'Key events & information', 'Each party\u2019s documents (claimant / respondent)'],
      },
    },
    {
      n: 3, fa: 'تحلیل قوانین و دستورالعمل‌ها', en: 'Legal & guideline analysis', tab: 'dexp',
      side: {
        titleFa: 'مبانی تحلیل', titleEn: 'Analysis basis',
        itemsFa: ['قوانین و قواعد ایران', 'اسناد پروژه و قرارداد', 'مستندات طرفین دعوا', 'دستورالعمل‌های معتبر داخلی و بین‌المللی'],
        itemsEn: ['Iranian laws & regulations', 'Project & contractual documents', 'Parties\u2019 evidence', 'Authoritative national & international guidelines'],
      },
    },
    {
      n: 4, fa: 'تحلیل استدلال‌ها و مستندات', en: 'Arguments & evidence analysis', tab: 'dexp',
      side: {
        titleFa: 'تحلیل ساختارمند', titleEn: 'Structured analysis',
        itemsFa: ['استدلال‌های طرف خواهان و خوانده', 'نقاط توافق و اختلاف', 'مسائل کلیدی دعوا:', 'تأخیرات مجاز و غیرمجاز', 'قابلیت جبران خسارت', 'اثر تغییرات بر مدت و هزینه', 'مسئولیت‌های قراردادی'],
        itemsEn: ['Claimant & respondent arguments', 'Points of agreement & dispute', 'Key dispute issues:', 'Excusable / non-excusable delays', 'Compensability of loss', 'Time & cost effect of variations', 'Contractual liabilities'],
      },
    },
    {
      n: 5, fa: 'جمع‌بندی و ارائه پیشنهادها', en: 'Conclusion & recommendations', tab: 'dexp',
      side: {
        titleFa: 'نتایج جمع‌بندی', titleEn: 'Conclusion results',
        itemsFa: ['نتیجه‌گیری تحلیلی', 'پیشنهادهای تخصصی'],
        itemsEn: ['Analytical conclusion', 'Expert recommendations'],
      },
    },
    { n: 6, fa: 'گزارش تحلیل و خروجی نهایی', en: 'Analysis report & final output', tab: 'dexp' },
  ],
  finalFa: 'خروجی‌های نرم‌افزار', finalEn: 'Software outputs', finalKind: 'output',
  finalItemsFa: ['گزارش تحلیل دعوا', 'جدول مقایسه استدلال‌ها', 'نقاط توافق و اختلاف', 'پیش‌نویس استدلال‌های تحلیلی', 'خروجی Word و PDF'],
  finalItemsEn: ['Dispute analysis report', 'Arguments comparison table', 'Points of agreement & dispute', 'Draft analytical reasoning', 'Word & PDF output'],
  footerFa: 'مناسب برای: پیمانکاران، کارفرمایان، مشاوران، وکلا، داوران، کارشناسان — این بخش ابزار کمک تحلیلی است و جایگزین قضاوت انسانی نیست',
  footerEn: 'For contractors, employers, consultants, counsel, arbitrators & experts — an analytical aid, not a substitute for human judgement',
};

export const PROCESS_MAP_IDS = ['delay', 'loss', 'risk', 'dispute'] as const;
const MAPS: MapDef[] = [MAP_DELAY, MAP_LOSS, MAP_RISK, MAP_DISPUTE];

/* ————— سبک‌ها ————— */
const stepBox = 'w-full rounded-xl border border-[#b8c0ea] bg-[#edeff8] px-4 py-3 text-center text-[12.5px] font-bold leading-6 text-[#3d4270] shadow-sm cursor-pointer transition hover:bg-[#e2e6f6] hover:border-[#8f99d8] focus:outline-none focus:ring-2 focus:ring-[#8f99d8]/40';
const sideBox = 'rounded-xl border border-[#9ecfbe] bg-[#e3f3ec] px-4 py-3 text-[11px] text-[205f4a]';
const finalBoxOut = 'rounded-xl border border-[#e6c98f] bg-[#fdf3de] px-4 py-3 text-center font-bold text-[#8a5a10] shadow-sm';
const finalBoxSec = 'rounded-xl border border-[#9ecfbe] bg-[#e3f3ec] px-4 py-3 text-[12px] text-[#205f4a]';
const itemLi = 'leading-6';

function SideCard({ s, fa, dir }: { s: SideBlock; fa: boolean; dir: 'rtl' | 'ltr' }) {
  const cols = s.itemsFa.length > 8;
  return (
    <div className={sideBox} dir={dir}>
      <div className="mb-1.5 text-center text-[12px] font-bold">{fa ? s.titleFa : s.titleEn}</div>
      <ul dir={dir} className={cols ? 'grid grid-cols-2 gap-x-3' : ''}>
        {(fa ? s.itemsFa : s.itemsEn).map((it, i) => (
          <li key={i} className={itemLi}>· {it}</li>
        ))}
      </ul>
      {s.noteFa && <div className="mt-1.5 text-center text-[10px] text-[#467a63]" dir={s.noteFa.includes('MSP') ? 'ltr' : dir}>{fa ? s.noteFa : s.noteEn}</div>}
    </div>
  );
}

function FlowChart({ map, fa, onNavigate }: { map: MapDef; fa: boolean; onNavigate: (tab: string) => void }) {
  const L = (a: string, b: string) => (fa ? a : b);
  return (
    <section className="rounded-2xl border border-[#e4ddd0] bg-[#fffdf8] p-4 shadow-sm" dir="rtl">
      <h3 className="text-center text-[17px] font-extrabold text-[#3d4270]">{L(map.titleFa, map.titleEn)}</h3>
      <p className="mt-1 text-center text-[11px] text-[#7d8098]">{L(map.subtitleFa, map.subtitleEn)}</p>
      <div className="mt-4 flex flex-col items-stretch gap-0">
        {map.steps.map((st, i) => (
          <div key={i} className="flex flex-col">
            {/* ردیف مرحله: کارت کناری (سمت راست در RTL) | فلش | باکس مرحله */}
            <div className="grid items-center gap-2" dir="ltr" style={{ gridTemplateColumns: st.side ? '1fr 30px 1.05fr' : '1fr' }}>
              {st.side ? (
                <>
                  <SideCard s={st.side} fa={fa} dir="rtl" />
                  <div className="text-center text-[16px] text-[#8b93c0]" dir="ltr">→</div>
                </>
              ) : null}
              <button
                className={stepBox + (st.side ? '' : ' mx-auto max-w-[46%]')}
                onClick={() => onNavigate(st.tab)}
                title={fa ? 'رفتن به تب عملیاتی' : 'Open operational tab'}
                type="button"
              >
                {st.n != null && <div className="text-[10px] font-normal text-[#8b93c0]">{fa ? `مرحله ${faNum(st.n)}` : `Step ${st.n}`}</div>}
                {L(st.fa, st.en)}
              </button>
            </div>
            {st.noteFa && (
              <div className="mt-1 mr-auto ml-auto w-[46%] text-left text-[10px] text-[#8b93c0]">{L(st.noteFa, st.noteEn ?? '')}</div>
            )}
            {st.dashedBackFa && (
              <div className="my-1 mr-auto ml-auto w-[46%] rounded-lg border border-dashed border-[#a9b0d0] px-3 py-1.5 text-center text-[10px] text-[#6d759c]">
                ↩ {L(st.dashedBackFa, st.dashedBackEn ?? '')}
              </div>
            )}
            {i < map.steps.length - 1 && <div className="mx-auto py-0.5 text-[17px] leading-5 text-[#8b93c0]">↓</div>}
          </div>
        ))}
        <div className="mx-auto py-0.5 text-[17px] leading-5 text-[#c9a25e]">↓</div>
        {map.finalItemsFa ? (
          map.finalKind === 'section' ? (
            <div className={`${finalBoxSec} mx-auto w-[46%]`} dir="rtl">
              <div className="mb-1 text-center font-bold text-[#1c6b4b]">{L(map.finalFa, map.finalEn)}</div>
              <ul>{(fa ? map.finalItemsFa! : map.finalItemsEn!).map((it, i) => <li key={i} className={itemLi}>· {it}</li>)}</ul>
            </div>
          ) : (
            <div className="mx-auto w-[46%]">
              <div className={finalBoxOut}>
                <div>{L(map.finalFa, map.finalEn)}</div>
                <div className="mt-0.5 text-[10px] font-normal text-[#b48a35]">{fa ? 'خروجی نهایی' : 'Final output'}</div>
              </div>
              <ul className="mt-1 rounded-xl border border-[#e6c98f] bg-[#fdf8ec] px-4 py-2 text-[11px] text-[#7a5f27]" dir="rtl">
                {(fa ? map.finalItemsFa! : map.finalItemsEn!).map((it, i) => <li key={i} className={itemLi}>· {it}</li>)}
              </ul>
            </div>
          )
        ) : (
          <div className="mx-auto w-[46%]">
            <div className={finalBoxOut}>
              <div>{L(map.finalFa, map.finalEn)}</div>
              <div className="mt-0.5 text-[10px] font-normal text-[#b48a35]">{fa ? 'خروجی نهایی' : 'Final output'}</div>
            </div>
          </div>
        )}
      </div>
      {map.footerFa && (
        <div className="mt-4 rounded-xl border border-[#e4ddd0] bg-[#f8f6f0] px-4 py-2.5 text-center text-[10.5px] leading-5 text-[#77705f]">
          {L(map.footerFa, map.footerEn ?? '')}
        </div>
      )}
      <Legend fa={fa} dashed={map.dashedLegendFa ? L(map.dashedLegendFa, map.dashedLegendEn ?? '') : undefined}
        greenLabel={fa ? 'ورودی‌ها و نتایج هر مرحله' : 'Step inputs / outputs'} />
    </section>
  );
}

function Legend({ fa, dashed, greenLabel }: { fa: boolean; dashed?: string; greenLabel: string }) {
  const chip = 'inline-flex items-center gap-1.5 text-[10px] text-[#6d759c]';
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[#eee7d8] pt-3" dir="rtl">
      <span className={chip}><i className="inline-block h-3.5 w-3.5 rounded-md border border-[#b8c0ea] bg-[#edeff8]" />{fa ? 'مراحل فرایند' : 'Process steps'}</span>
      <span className={chip}><i className="inline-block h-3.5 w-3.5 rounded-md border border-[#9ecfbe] bg-[#e3f3ec]" />{greenLabel}</span>
      <span className={chip}><i className="inline-block h-3.5 w-3.5 rounded-md border border-[#e6c98f] bg-[#fdf3de]" />{fa ? 'خروجی نهایی' : 'Final output'}</span>
      {dashed && <span className={chip}><i className="inline-block h-1 w-5 border-t-2 border-dashed border-[#a9b0d0]" />{dashed}</span>}
    </div>
  );
}

function faNum(n: number) { return '۰۱۲۳۴۵۶۷۸۹'[n] ?? String(n); }

/* ————— نقشهٔ یکپارچهٔ فرایند ادعا در چرخهٔ قرارداد ————— */
function IntegratedMap({ fa, onSelect, allowed }: { fa: boolean; onSelect: (id: MapDef['id']) => void; allowed?: (MapDef['id'] | 'integrated')[] }) {
  const L = (a: string, b: string) => (fa ? a : b);
  const phaseHead = 'text-center text-[13px] font-extrabold text-[#3d4270]';
  const secBox = 'w-full rounded-xl border border-[#b8c0ea] bg-[#edeff8] px-3 py-3 text-center text-[12px] font-bold leading-6 text-[#3d4270] shadow-sm transition hover:bg-[#e2e6f6] hover:border-[#8f99d8] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8f99d8]/40';
  const outCard = 'rounded-xl border border-[#9ecfbe] bg-[#e3f3ec] px-3 py-2.5 text-[10.5px] text-[#205f4a]';
  const finCard = 'rounded-xl border border-[#e6c98f] bg-[#fdf3de] px-3 py-2.5 text-[10.5px] text-[#7a5f27]';
  const outHead = 'mb-1 text-center text-[11px] font-bold text-[#1c6b4b]';
  const finHead = 'mb-1 text-center text-[11px] font-bold text-[#8a5a10]';

  const Row = ({ box, card, cardNode }: { box: React.ReactNode; card?: 'out' | 'fin'; cardNode: React.ReactNode }) => (
    <div className="grid items-stretch gap-2" style={{ gridTemplateColumns: '1fr 22px 1.05fr' }} dir="ltr">
      {card ? <div className={card === 'out' ? outCard : finCard} dir="rtl">{cardNode}</div> : <div />}
      <div className="flex items-center justify-center text-[15px] text-[#8b93c0]">←</div>
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
        <div className="text-[10px] font-normal text-[#8b93c0]">{fa ? `بخش ${num}` : enT}</div>
      </button>
    );
  };
  const li = 'leading-5';

  return (
    <section className="rounded-2xl border border-[#e4ddd0] bg-[#fffdf8] p-4 shadow-sm" dir="rtl">
      <h3 className="text-center text-[17px] font-extrabold text-[#3d4270]">{L('نقشهٔ یکپارچهٔ فرایند ادعا در چرخهٔ قرارداد', 'Integrated claims map across the contract lifecycle')}</h3>
      <p className="mt-1 text-center text-[11px] text-[#7d8098]">{L('بخش ۳ در ابتدای قرارداد · بخش‌های ۱ و ۲ هنگام ادعا · بخش ۴ در مرحله داوری', 'Section 3 at contract start · sections 1–2 at claim time · section 4 at arbitration')}</p>

      <div className="relative mt-4 flex flex-col gap-2">
        {/* فاز ۱ */}
        <div className="rounded-2xl border border-[#ece5d6] bg-[#faf8f2] p-3">
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
        <div className="rounded-2xl border border-[#ece5d6] bg-[#faf8f2] p-3">
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
              cardNode={<><div className={outHead}>{fa ? 'خروجی‌های لایحه ضرر و زیان' : 'Loss & damages outputs'}</div><ul>{[fa ? 'سرفصل‌های خسارت و فرمول‌ها' : 'Loss heads & formulas', fa ? 'محاسبه دقیق ضرر و زیان' : 'Precise calculation', fa ? 'جمع کل ضرر و زیان (ریال)' : 'Total loss (IRR)'].map((t, i) => <li key={i} className={li}>· {t}</li>)}</ul></>}
            />
          </div>
        </div>
        <ConnectorEdge left={fa ? 'لوایح و مستندات' : 'Dossiers & records'} right={fa ? 'ارجاع اختلاف' : 'Dispute referral'} />
        {/* فاز ۳ */}
        <div className="rounded-2xl border border-[#ece5d6] bg-[#faf8f2] p-3">
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

      <div className="mt-4 rounded-xl border border-[#e4ddd0] bg-[#f8f6f0] px-4 py-2.5 text-center text-[10.5px] leading-6 text-[#77705f]" dir="rtl">
        {fa ? 'ورودی مشترک: قرارداد، الحاقیه، صورت‌جلسات، مکاتبات، برنامه‌های زمان‌بندی، گزارش‌های دوره‌ای و اسناد مالی' : 'Shared inputs: contract, annexes, minutes, correspondence, schedules, period reports & financial records'}
        <br />{fa ? 'فرمت‌های پشتیبانی: MSP ,Primavera P6, Word, PDF' : 'Supported: MSP, Primavera P6, Word, PDF'}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[#eee7d8] pt-3" dir="rtl">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#6d759c]"><i className="inline-block h-3.5 w-3.5 rounded-md border border-[#b8c0ea] bg-[#edeff8]" />{fa ? 'بخش‌های نرم‌افزار' : 'Software sections'}</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#6d759c]"><i className="inline-block h-3.5 w-3.5 rounded-md border border-[#9ecfbe] bg-[#e3f3ec]" />{fa ? 'خروجی هر بخش' : 'Section outputs'}</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#6d759c]"><i className="inline-block h-3.5 w-3.5 rounded-md border border-[#e6c98f] bg-[#fdf3de]" />{fa ? 'خروجی نهایی' : 'Final output'}</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#6d759c]"><i className="inline-block h-1 w-5 border-t-2 border-[#8b93c0]" />{fa ? 'ترتیب فازها' : 'Phase order'}</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#6d759c]"><i className="inline-block h-1 w-5 border-t-2 border-dashed border-[#a9b0d0]" />{fa ? 'جریان دادهٔ پیشنهادی' : 'Suggested data flow'}</span>
      </div>
    </section>
  );
}

function ConnectorEdge({ left, right, short }: { left: string; right?: string; short?: boolean }) {
  /* لبهٔ اتصال میان فازها: خط ممتد (ترتیب) یا خط‌چین (جریان داده) با برچسب لبه */
  return (
    <div className={`relative flex items-center justify-between px-6 ${short ? 'h-8' : 'h-12'}`} dir="rtl">
      <div className="flex h-full flex-col items-center">
        <span className="w-px flex-1 border-r-2 border-dashed border-[#b3b9d6]" />
        <span className="text-[10px] text-[#8b93c0]">▼</span>
        <span className="text-[10px] text-[#6d759c]">{left}</span>
      </div>
      {right && (
        <div className="flex h-full flex-col items-center">
          <span className="w-px flex-1 border-r-2 border-[#8b93c0]" />
          <span className="text-[10px] text-[#8b93c0]">▼</span>
          <span className="text-[10px] font-semibold text-[#5a6288]">{right}</span>
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
  const pill = (on: boolean) => `rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition ${on ? 'border-[#8f99d8] bg-[#edeff8] text-[#3d4270] shadow-sm' : 'border-[#d8dce8] bg-[#f6f7fb] text-[#7d8098] hover:border-[#b8c0ea] hover:text-[#575f86]'}`;
  const NAME_FA: Record<ProcessMapId, string> = { integrated: 'نقشهٔ یکپارچه', delay: 'تهیه لایحه تأخیرات', loss: 'تهیه لایحه ضرر و زیان', risk: 'مدیریت ریسک و بهبود قرارداد', dispute: 'کارشناسی و داوری دعوا' };
  const NAME_EN: Record<ProcessMapId, string> = { integrated: 'Integrated map', delay: 'Delay dossier', loss: 'Loss dossier', risk: 'Contract risk', dispute: 'Dispute expert' };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-[#e4ddd0] bg-[#fffaf1]/40 p-3" dir={fa ? 'rtl' : 'ltr'}>
      {allowed.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {allowed.map((id) => (
            <button key={id} type="button" className={pill(active === id)} onClick={() => setSel(id)}>
              {fa ? NAME_FA[id] : NAME_EN[id]}
            </button>
          ))}
        </div>
      )}
      {...MAPS.filter((m) => m.id === active).map((m) => <FlowChart key={m.id} map={m} fa={fa} onNavigate={onNavigate} />)}
      {active === 'integrated' && <IntegratedMap fa={fa} allowed={allowed} onSelect={(id) => { if (allowed.includes(id)) setSel(id); }} />}
    </div>
  );
}
