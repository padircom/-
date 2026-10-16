/**
 * دستیار هوشمند خسارت (بخش ۱۴ پرامپت PMO-CLAIMS-LOSS-ENGINE-V1.0).
 *
 * صادقانه و قاعده‌محور: این سرویس «پیشنهاد» تولید می‌کند، نه نتیجهٔ قطعی.
 * - هیچ مبلغی تولید یا حدس نمی‌زند؛ مبالغ فقط از متن/دادهٔ واقعی استخراج می‌شوند.
 * - استحقاق حقوقی اعلام نمی‌کند؛ هر پیشنهاد برچسب «نیازمند بازبینی کارشناس» دارد.
 * - اگر provider زبانی (Claude/OpenAI/DeepSeek) در «مدیریت سامانه ← هوش مصنوعی»
 *   پیکربندی شود، لایهٔ فراخوان آن جداست؛ تا آن زمان provider = rule است و
 *   وضعیت اتصال در خروجی صریح گزارش می‌شود.
 */
import { LOSS_CATEGORIES, detectCostOverlaps } from './claimLoss';

export const LOSS_ASSIST_VERSION = 'loss-assist-v1';

export type LossSuggestion = {
  kind: 'missing_document' | 'missing_basis' | 'date_contradiction' | 'overlap_candidate' | 'category_suggestion' | 'document_link_suggestion' | 'extraction';
  severity: 'info' | 'warning';
  refId: string | null; messageFa: string; sourceFa: string;
  needsExpertReview: true;
};

const sug = (kind: LossSuggestion['kind'], severity: 'info' | 'warning', refId: string | null, messageFa: string, sourceFa: string): LossSuggestion =>
  ({ kind, severity, refId, messageFa, sourceFa, needsExpertReview: true });

/** استخراج مبلغ/تاریخ/شماره‌ها از متن سند (Regex قطعی؛ بدون حدس). */
export function extractFromDocumentText(text: string): { amounts: { value: number; unit: string; raw: string }[]; dates: string[]; statementNos: string[]; contractNos: string[] } {
  // ارقام فارسی/عربی به لاتین تا الگوهای عددی یکدست کار کنند.
  const t = String(text ?? '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const amounts: { value: number; unit: string; raw: string }[] = [];
  for (const m of t.matchAll(/([\d][\d,.\s]{2,})\s*(ریال|تومان|IRR|میليون|میلیون|میلیارد)/g)) {
    const value = Number(m[1].replace(/[,\s]/g, ''));
    if (Number.isFinite(value) && value > 0) amounts.push({ value, unit: m[2], raw: m[0].trim() });
  }
  const dates = [...new Set([...t.matchAll(/\b(1[34]\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{4}-\d{2}-\d{2})\b/g)].map(m => m[1]))];
  const statementNos = [...new Set([...t.matchAll(/صورت\s*وضعیت[^0-9]{0,12}(\d{1,3})/g)].map(m => m[1]))];
  const contractNos = [...new Set([...t.matchAll(/(?:قرارداد|پیمان)[^0-9A-Za-z]{0,12}([A-Za-z]{0,4}[-/]?\d{2,})/g)].map(m => m[1]))];
  return { amounts: amounts.slice(0, 20), dates, statementNos, contractNos };
}

const CATEGORY_KEYWORDS: [string, string[]][] = [
  ['payment_delay', ['پرداخت', 'صورت‌وضعیت', 'صورت وضعیت', '۵۰۹۰', '5090']],
  ['adjustment_delay', ['تعدیل']],
  ['overhead', ['سربار', 'بالاسری', 'پرسنل ثابت', 'هزینه ثابت']],
  ['guarantee_extension', ['ضمانت‌نامه', 'ضمانت نامه']],
  ['suspension', ['تعلیق', 'توقف کار', 'توقف عملیات']],
  ['machinery', ['ماشین‌آلات', 'ماشین الات', 'تجهیزات', 'جرثقیل', 'کمپرسی']],
  ['labor', ['نیروی انسانی', 'پرسنل', 'کارگر', 'نفر']],
  ['change_work', ['دستور تغییر', 'کار جدید', 'تغییر مقادیر', 'الحاقیه']],
  ['site_access_delay', ['تحویل زمین', 'جبهه کار', 'دسترسی به کارگاه']],
  ['approval_delay', ['تأیید نقشه', 'تایید نقشه', 'مدارک', 'تأییدیه']],
  ['procurement_extra', ['تدارکات', 'خرید', 'تأمین کالا', 'تامین کالا']],
  ['remobilization', ['برچیدن', 'تجهیز مجدد']],
  ['site_running_costs', ['هزینه جاری', 'نگهداری کارگاه', 'هزینه مستمر']],
  ['changed_conditions', ['شرایط اجرایی', 'شرایط پیش‌بینی‌نشده']],
];

/** پیشنهاد دسته بر اساس کلیدواژه‌های عنوان/مبنا؛ فقط پیشنهاد است. */
export function suggestLossCategory(text: string): { code: string; fa: string; matched: string[] } | null {
  const t = String(text ?? '');
  let best: { code: string; matched: string[] } | null = null;
  for (const [code, words] of CATEGORY_KEYWORDS) {
    const matched = words.filter(w => t.includes(w));
    if (matched.length && (!best || matched.length > best.matched.length)) best = { code, matched };
  }
  if (!best) return null;
  return { code: best.code, fa: LOSS_CATEGORIES.find(c => c.code === best.code)?.fa ?? best.code, matched: best.matched };
}

type Row = Record<string, unknown>;
const day = (v: unknown): string => String(v ?? '').slice(0, 10);

export function buildLossSuggestions(input: {
  claim: Row; costItems: Row[]; delayEvents: Row[]; runs: Row[]; allocations: Row[];
  documents: Row[]; documentText?: string;
}): { provider: 'rule'; llmConnected: false; version: string; suggestions: LossSuggestion[]; extracted: ReturnType<typeof extractFromDocumentText> | null; draftDescriptionFa: string } {
  const suggestions: LossSuggestion[] = [];
  const claim = input.claim;
  // نقص مدارک و مبنا
  for (const item of input.costItems) {
    const refs = Array.isArray(item.DocumentRefs) ? item.DocumentRefs : [];
    if (!refs.length) suggestions.push(sug('missing_document', 'warning', String(item.Id), `قلم «${String(item.TitleFa)}» سند پشتیبان EDMS ندارد؛ مبلغ آن مستند محسوب نمی‌شود`, 'کنترل نقص مدارک'));
    if (!String(item.Basis ?? '').trim()) suggestions.push(sug('missing_basis', 'warning', String(item.Id), `قلم «${String(item.TitleFa)}» مبنای محاسبه ثبت‌شده ندارد`, 'کنترل مبنای محاسباتی'));
    const cat = suggestLossCategory(`${String(item.TitleFa ?? '')} ${String(item.Basis ?? '')}`);
    if (cat && cat.code !== String(item.LossCategory ?? item.CostType)) suggestions.push(sug('category_suggestion', 'info', String(item.Id), `برای قلم «${String(item.TitleFa)}» دستهٔ «${cat.fa}» پیشنهاد می‌شود (کلیدواژه: ${cat.matched.join('، ')})؛ دستهٔ فعلی متفاوت است`, 'پیشنهاد دسته از متن'));
    // تناقض دوره با رویداد پیوندشده
    const event = input.delayEvents.find(e => String(e.Id) === String(item.DelayEventId));
    if (event && item.PeriodFrom && item.PeriodTo && (day(item.PeriodFrom) < day(event.StartDate) || day(item.PeriodTo) > day(event.FinishDate))) {
      suggestions.push(sug('date_contradiction', 'warning', String(item.Id), `دورهٔ قلم «${String(item.TitleFa)}» (${day(item.PeriodFrom)} تا ${day(item.PeriodTo)}) بیرون از بازهٔ رویداد «${String(event.Code)}» است؛ بررسی شود`, 'کنترل سازگاری تاریخ‌ها'));
    }
  }
  if (!input.costItems.length) suggestions.push(sug('missing_document', 'warning', null, 'برای این پرونده هنوز قلم خسارتی ثبت نشده است', 'کنترل کامل‌بودن پرونده'));
  if (!String(claim.Entitlement ?? '').trim() || !String(claim.Causation ?? '').trim()) suggestions.push(sug('missing_basis', 'warning', null, 'مبنای استحقاق یا رابطهٔ سببیت پرونده کامل نیست؛ لایحه بدون آن قطعی نیست', 'کنترل مبانی قراردادی'));
  // هم‌پوشانی (نامزد کارشناسی)
  for (const w of detectCostOverlaps(input.costItems, input.allocations)) suggestions.push(sug('overlap_candidate', w.severity === 'violation' ? 'warning' : 'info', w.itemIds[0] ?? null, w.messageFa, 'کنترل هم‌پوشانی'));
  // پیشنهاد پیوند سند: اسناد پیوندنشده‌ای که عنوانشان با رویدادها هم‌خوان است
  const linked = new Set(input.costItems.flatMap(i => (Array.isArray(i.DocumentRefs) ? i.DocumentRefs.map(String) : [])));
  for (const doc of input.documents) {
    if (linked.has(String(doc.Id))) continue;
    const cat = suggestLossCategory(String(doc.TitleFa ?? ''));
    if (cat) suggestions.push(sug('document_link_suggestion', 'info', String(doc.Id), `سند «${String(doc.DocNo)}@${String(doc.Revision)}» (${String(doc.TitleFa)}) پیوند نشده و با دستهٔ «${cat.fa}» هم‌خوان است؛ پیوند آن بررسی شود`, 'پیشنهاد ارتباط سند و رویداد'));
  }
  const extracted = input.documentText ? extractFromDocumentText(input.documentText) : null;
  if (extracted && (extracted.amounts.length || extracted.dates.length || extracted.statementNos.length)) {
    suggestions.push(sug('extraction', 'info', null, `از متن سند: ${extracted.amounts.length} مبلغ، ${extracted.dates.length} تاریخ و ${extracted.statementNos.length} شمارهٔ صورت‌وضعیت استخراج شد؛ پیش از ثبت با اصل سند تطبیق شود`, 'استخراج از متن سند'));
  }
  // پیش‌نویس شرح خسارت از دادهٔ واقعی (قابل ویرایش؛ بدون عدد حدسی)
  const totalItems = input.costItems.length;
  const draftDescriptionFa = totalItems
    ? `پیش‌نویس: در پروندهٔ «${String(claim.TitleFa)}» (${String(claim.Code)}) تعداد ${totalItems} قلم خسارت در دسته‌های ${[...new Set(input.costItems.map(i => String(i.LossCategory ?? i.CostType)))].join('، ')} ثبت شده است. مبنای قراردادی اعلام‌شده: ${String(claim.Clause ?? '—')}. مبالغ محاسبه‌شده فقط از اجراهای نسخه‌دار قواعد تأییدشده گرفته می‌شوند و اقلام فاقد محاسبه یا سند، «نیازمند بررسی کارشناسی» هستند. این متن پیش‌نویس است و پیش از استفاده در لایحه باید بازبینی و تأیید شود.`
    : `پیش‌نویس: برای پروندهٔ «${String(claim.TitleFa)}» هنوز قلم خسارتی ثبت نشده است؛ شرح خسارت پس از ثبت اقلام و مدارک قابل تهیه است.`;
  return { provider: 'rule', llmConnected: false, version: LOSS_ASSIST_VERSION, suggestions, extracted, draftDescriptionFa };
}
