import { escapeHtml, toPrintHtml, toWordHtml, type Letterhead, type ReportDef, type Row } from './reporting';
import { selectApprovedExtensionCalculations, buildConcurrencyTimeline, concurrencyTimelineSvg } from './delayAnalysis';

export type ClaimDocumentInput = {
  projectId: string;
  claim: Record<string, unknown>;
  delayEvents: Record<string, unknown>[];
  calculations: Record<string, unknown>[];
  costItems?: Record<string, unknown>[];
  format: 'word' | 'pdf';
  generatedAt: string;
};

/* ── قالب استاندارد لایحه: ۱۷ فصل و ۵۱ جدول ── */
export const CLAIM_DOC_CHAPTERS: { no: number; fa: string; en: string }[] = [
  { no: 1, fa: 'کلیات و مشخصات پیمان', en: 'General and contract particulars' },
  { no: 2, fa: 'خلاصهٔ مدیریتی و درخواست', en: 'Executive summary and request' },
  { no: 3, fa: 'مبانی قراردادی و استحقاق', en: 'Contractual basis and entitlement' },
  { no: 4, fa: 'شرح رویدادها و وقایع', en: 'Events and facts' },
  { no: 5, fa: 'اعلان‌ها و مکاتبات', en: 'Notices and correspondence' },
  { no: 6, fa: 'برنامهٔ مبنا و برنامهٔ به‌روز', en: 'Baseline and updated programme' },
  { no: 7, fa: 'روش‌شناسی تحلیل تأخیر', en: 'Delay analysis methodology' },
  { no: 8, fa: 'نتایج تحلیل زمان‌بندی', en: 'Schedule analysis results' },
  { no: 9, fa: 'تأخیرات هم‌زمان و هم‌پوشانی', en: 'Concurrent delay and overlap' },
  { no: 10, fa: 'تایم‌لاین تصویری هم‌زمانی', en: 'Concurrency visual timeline' },
  { no: 11, fa: 'محاسبات بخشنامه‌ای', en: 'Circular calculations' },
  { no: 12, fa: 'تمدید مدت درخواستی و تأییدشده', en: 'Requested and approved EOT' },
  { no: 13, fa: 'ادعاهای مالی و هزینه‌های تمدید', en: 'Monetary and prolongation costs' },
  { no: 14, fa: 'مستندات و پیوست‌ها', en: 'Evidence and appendices' },
  { no: 15, fa: 'ریسک‌ها، مسائل و پیوندهای برنامه‌ای', en: 'Risks, issues and programme links' },
  { no: 16, fa: 'مهلت‌های حیاتی قراردادی', en: 'Critical contractual deadlines' },
  { no: 17, fa: 'جمع‌بندی، اظهار و امضا', en: 'Conclusion, declaration and signature' },
];
type TableDataset = 'claim' | 'summary' | 'events' | 'eventsPeriod' | 'calcs' | 'calcs5090' | 'calcs1300' | 'costs' | 'costTypes' | 'docs' | 'costDocs' | 'timeline' | 'overlaps' | 'notices' | 'links' | 'deadlines';
export const CLAIM_DOC_TABLES: { no: number; chapter: number; fa: string; dataset: TableDataset }[] = [
  { no: 1, chapter: 1, fa: 'مشخصات پیمان', dataset: 'claim' }, { no: 2, chapter: 1, fa: 'مشخصات ادعا', dataset: 'claim' }, { no: 3, chapter: 1, fa: 'اسناد مبنای پرونده', dataset: 'docs' },
  { no: 4, chapter: 2, fa: 'خلاصهٔ درخواست', dataset: 'summary' }, { no: 5, chapter: 2, fa: 'مدت و مبالغ کلیدی', dataset: 'summary' }, { no: 6, chapter: 2, fa: 'وضعیت پرونده', dataset: 'claim' },
  { no: 7, chapter: 3, fa: 'بندهای قراردادی مورد استناد', dataset: 'claim' }, { no: 8, chapter: 3, fa: 'مبنای استحقاق', dataset: 'claim' }, { no: 9, chapter: 3, fa: 'تشریفات و شرایط پیش‌نیاز', dataset: 'notices' },
  { no: 10, chapter: 4, fa: 'فهرست رویدادهای تأخیر', dataset: 'events' }, { no: 11, chapter: 4, fa: 'شرح وقایع و علت ریشه‌ای', dataset: 'events' }, { no: 12, chapter: 4, fa: 'طبقه‌بندی رویدادها', dataset: 'events' }, { no: 13, chapter: 4, fa: 'بازه‌های زمانی رویدادها', dataset: 'eventsPeriod' },
  { no: 14, chapter: 5, fa: 'سوابق اعلان قراردادی', dataset: 'notices' }, { no: 15, chapter: 5, fa: 'مهلت‌های ابلاغ و Time-Bar', dataset: 'deadlines' }, { no: 16, chapter: 5, fa: 'مکاتبات و مستندات اعلان', dataset: 'docs' },
  { no: 17, chapter: 6, fa: 'برنامه‌های مبنای مورد استناد', dataset: 'links' }, { no: 18, chapter: 6, fa: 'فعالیت‌های متأثر', dataset: 'links' }, { no: 19, chapter: 6, fa: 'تاریخ‌های دادهٔ تحلیل', dataset: 'links' },
  { no: 20, chapter: 7, fa: 'روش‌های تحلیل منتخب', dataset: 'calcs' }, { no: 21, chapter: 7, fa: 'داده‌های ورودی محاسبات', dataset: 'calcs' }, { no: 22, chapter: 7, fa: 'کنترل نقص داده', dataset: 'calcs' }, { no: 23, chapter: 7, fa: 'مفروضات و محدودیت‌های روش', dataset: 'calcs' },
  { no: 24, chapter: 8, fa: 'نتایج محاسبات زمان‌بندی', dataset: 'calcs' }, { no: 25, chapter: 8, fa: 'مسیر بحرانی و تغییرات آن', dataset: 'calcs' }, { no: 26, chapter: 8, fa: 'اثر بر تاریخ اتمام', dataset: 'calcs' }, { no: 27, chapter: 8, fa: 'مقایسهٔ روش‌های تحلیل', dataset: 'calcs' },
  { no: 28, chapter: 9, fa: 'جفت‌های هم‌پوشان', dataset: 'overlaps' }, { no: 29, chapter: 9, fa: 'سهم طرفین در هم‌پوشانی', dataset: 'overlaps' }, { no: 30, chapter: 9, fa: 'جمع‌بندی هم‌زمانی', dataset: 'timeline' },
  { no: 31, chapter: 10, fa: 'داده‌های تایم‌لاین هم‌زمانی', dataset: 'timeline' }, { no: 32, chapter: 10, fa: 'رویدادهای بحرانی و غیربحرانی', dataset: 'timeline' },
  { no: 33, chapter: 11, fa: 'نتایج بخشنامهٔ ۵۰۹۰', dataset: 'calcs5090' }, { no: 34, chapter: 11, fa: 'نتایج بخشنامهٔ ۱۳۰۰ (مدت مجاز پرداخت)', dataset: 'calcs1300' }, { no: 35, chapter: 11, fa: 'نسخهٔ ضوابط محاسبه', dataset: 'calcs' },
  { no: 36, chapter: 12, fa: 'تمدید درخواستی و محاسبهٔ تأییدشده', dataset: 'summary' }, { no: 37, chapter: 12, fa: 'مبنای جمع تمدید بدون دوباره‌شماری', dataset: 'calcs' },
  { no: 38, chapter: 13, fa: 'آیتم‌های هزینهٔ ادعای مالی', dataset: 'costs' }, { no: 39, chapter: 13, fa: 'جمع‌بندی هزینه بر حسب نوع', dataset: 'costTypes' }, { no: 40, chapter: 13, fa: 'دوره‌های هزینه', dataset: 'costs' }, { no: 41, chapter: 13, fa: 'مستندات پشتیبان هزینه‌ها', dataset: 'costDocs' },
  { no: 42, chapter: 14, fa: 'اسناد EDMS رویدادها', dataset: 'docs' }, { no: 43, chapter: 14, fa: 'اسناد پشتیبان هزینه‌ها', dataset: 'costDocs' }, { no: 44, chapter: 14, fa: 'فهرست پیوست‌های پرونده', dataset: 'docs' },
  { no: 45, chapter: 15, fa: 'ریسک‌های مرتبط', dataset: 'links' }, { no: 46, chapter: 15, fa: 'مسائل مرتبط', dataset: 'links' }, { no: 47, chapter: 15, fa: 'پیوندهای WBS و فعالیت', dataset: 'links' },
  { no: 48, chapter: 16, fa: 'روزشمار مهلت‌های قراردادی', dataset: 'deadlines' }, { no: 49, chapter: 16, fa: 'هشدارهای مهلت فعال', dataset: 'deadlines' },
  { no: 50, chapter: 17, fa: 'جمع‌بندی نهایی درخواست', dataset: 'summary' }, { no: 51, chapter: 17, fa: 'اظهار صحت و تعهد ارائهٔ مستندات', dataset: 'claim' },
];
export const CLAIM_DOC_TEMPLATE = { chapters: CLAIM_DOC_CHAPTERS, tables: CLAIM_DOC_TABLES } as const;

const TIMELINE_TOKEN = '[[CONCURRENCY_TIMELINE_IMAGE]]';
const COST_TYPE_FA: Record<string, string> = { guarantee_extension: 'تمدید ضمانت‌نامه‌ها', site_facilities: 'تجهیز و نگهداری کارگاه', overhead: 'پرسنل ثابت و سربار', suspension: 'هزینهٔ تعلیق', other: 'سایر' };
const PARTY_FA: Record<string, string> = { employer: 'کارفرما', contractor: 'پیمانکار', concurrent: 'هم‌زمان', other: 'سایر' };

const text = (value: unknown, fallback = '—'): string => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};
const parseObject = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
};
const refsText = (value: unknown): string => Array.isArray(value) ? value.map(v => text(v, '')).filter(Boolean).join('؛ ') : text(value, '');

/**
 * پاک‌سازی خروجی نهایی از اجزای داخلی قالب: صفحات/بندهای راهنمای داخلی،
 * برچسب‌های «الزامی/اختیاری» و هایلایت‌های زرد راهنما هرگز به سند ابلاغی نمی‌رسند.
 */
export function sanitizeClaimDocumentHtml(html: string): string {
  return html
    .replace(/<div class="internal-guide"[\s\S]*?<\/div>/g, '')
    .replace(/<section[^>]*data-internal="true"[\s\S]*?<\/section>/g, '')
    .replace(/<p[^>]*>[^<]*(?:راهنمای داخلی|Internal guide)[^<]*<\/p>/g, '')
    .replace(/\s*[\[(【](الزامی|اختیاری|Required|Optional)[\])】]/g, '')
    .replace(/background(?:-color)?\s*:\s*(?:#ff0(?:000)?|#ffff00|yellow)\s*;?/gi, '')
    .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1')
    .replace(/\sclass="hl"/g, '');
}

export function validateClaimDocumentInput(input: ClaimDocumentInput): string[] {
  const issues: string[] = [];
  if (!input.claim?.Code) issues.push('پروندهٔ ادعای انتخاب‌شده لازم است');
  const related = input.delayEvents.filter(event => String(event.ClaimCode ?? '') === String(input.claim.Code));
  if (!related.length) issues.push('برای تولید لایحه، حداقل یک رویداد تأخیر پیوندشده به ادعا لازم است');
  const relatedIds = new Set(related.map(event => String(event.Id)));
  const approved = selectApprovedExtensionCalculations(input.calculations.filter(calc => relatedIds.has(String(calc.DelayEventId)))).calculations;
  if (!approved.length) issues.push('برای تولید لایحه، حداقل یک محاسبهٔ تمدید تأییدشده لازم است؛ تأیید ۱۳۰۰ به‌تنهایی تمدید مدت نیست');
  return issues;
}

export function buildClaimDocument(input: ClaimDocumentInput): { filename: string; contentType: string; body: string; issues: string[] } {
  const issues = validateClaimDocumentInput(input);
  const claim = input.claim;
  const claimCode = text(claim.Code, 'CLAIM');
  const related = input.delayEvents.filter(event => String(event.ClaimCode ?? '') === claimCode);
  const relatedIds = new Set(related.map(event => String(event.Id)));
  const selected = selectApprovedExtensionCalculations(input.calculations.filter(calc => relatedIds.has(String(calc.DelayEventId))));
  const approved = selected.calculations;
  const approvedDays = selected.totalDays;
  const costItems = (input.costItems ?? []).filter(item => relatedIds.has(String(item.DelayEventId)));
  const costTotal = costItems.reduce((sum, item) => sum + (Number(item.Amount) || 0), 0);
  const timeline = buildConcurrencyTimeline(related);

  const kv = (pairs: [string, string][]): Row[] => pairs.map(([k, v]) => ({ key: k, value: v }));
  const datasets: Record<TableDataset, { columns: { key: string; title: { fa: string; en: string } }[]; rows: Row[] }> = {
    claim: { columns: [{ key: 'key', title: { fa: 'عنوان', en: 'Item' } }, { key: 'value', title: { fa: 'مقدار', en: 'Value' } }], rows: kv([
      ['کد ادعا', claimCode], ['عنوان', text(claim.TitleFa)], ['بند قرارداد', text(claim.Clause)], ['مبلغ ادعا', claim.Amount == null ? '—' : String(claim.Amount)],
      ['تمدید خواسته‌شده (روز)', text(claim.ExtensionDays)], ['وضعیت', text(claim.Status)], ['مبنای استحقاق', text(claim.Entitlement)], ['رابطهٔ سببیت', text(claim.Causation)],
    ]) },
    summary: { columns: [{ key: 'key', title: { fa: 'شاخص', en: 'Measure' } }, { key: 'value', title: { fa: 'مقدار', en: 'Value' } }], rows: kv([
      ['تمدید خواسته‌شده (روز)', text(claim.ExtensionDays)], ['تمدید محاسبه و تأییدشده (روز)', String(approvedDays)],
      ['رویدادهای پیوندشده', String(related.length)], ['محاسبات مؤثر تأییدشده', String(approved.length)],
      ['آیتم‌های هزینهٔ مالی', String(costItems.length)], ['جمع ادعای مالی', String(costTotal)],
    ]) },
    events: { columns: [{ key: 'code', title: { fa: 'کد', en: 'Code' } }, { key: 'title', title: { fa: 'عنوان', en: 'Title' } }, { key: 'category', title: { fa: 'طبقه‌بندی', en: 'Category' } }, { key: 'period', title: { fa: 'بازه', en: 'Period' } }, { key: 'cause', title: { fa: 'علت ریشه‌ای', en: 'Root cause' } }], rows: related.map(e => ({ code: text(e.Code), title: text(e.TitleFa), category: text(e.Category), period: `${text(e.StartDate).slice(0, 10)} → ${text(e.FinishDate).slice(0, 10)}`, cause: text(e.RootCauseFa) })) },
    eventsPeriod: { columns: [{ key: 'code', title: { fa: 'کد', en: 'Code' } }, { key: 'start', title: { fa: 'شروع', en: 'Start' } }, { key: 'finish', title: { fa: 'پایان', en: 'Finish' } }, { key: 'critical', title: { fa: 'بحرانی', en: 'Critical' } }], rows: related.map(e => ({ code: text(e.Code), start: text(e.StartDate).slice(0, 10), finish: text(e.FinishDate).slice(0, 10), critical: e.IsCritical ? 'بله' : 'خیر' })) },
    calcs: { columns: [{ key: 'engine', title: { fa: 'موتور', en: 'Engine' } }, { key: 'method', title: { fa: 'روش', en: 'Method' } }, { key: 'rule', title: { fa: 'نسخهٔ قاعده', en: 'Rule version' } }, { key: 'raw', title: { fa: 'خام', en: 'Raw' } }, { key: 'final', title: { fa: 'نهایی تأییدشده', en: 'Approved final' } }, { key: 'formula', title: { fa: 'فرمول/مبنای محاسبه', en: 'Formula' } }, { key: 'approvedBy', title: { fa: 'تأییدکننده', en: 'Approved by' } }], rows: approved.map(c => { const r = parseObject(c.Result); return { engine: text(c.Engine), method: text(c.Method), rule: text(c.RuleVersion), raw: c.RawValueDays == null ? '—' : String(c.RawValueDays), final: c.FinalValueDays == null ? '—' : String(c.FinalValueDays), formula: text(r.formula ?? (Array.isArray(r.limitations) ? r.limitations.join('؛ ') : '')), approvedBy: text(c.ApprovedBy) }; }) },
    calcs5090: { columns: [{ key: 'raw', title: { fa: 'خام (روز)', en: 'Raw (days)' } }, { key: 'final', title: { fa: 'نهایی (روز)', en: 'Final (days)' } }, { key: 'approvedBy', title: { fa: 'تأییدکننده', en: 'Approved by' } }], rows: approved.filter(c => c.Engine === 'circular5090').map(c => ({ raw: String(c.RawValueDays ?? '—'), final: String(c.FinalValueDays ?? '—'), approvedBy: text(c.ApprovedBy) })) },
    calcs1300: { columns: [{ key: 'raw', title: { fa: 'مدت مجاز پرداخت (روز)', en: 'Allowed payment days' } }, { key: 'note', title: { fa: 'توضیح', en: 'Note' } }], rows: input.calculations.filter(c => relatedIds.has(String(c.DelayEventId)) && c.Engine === 'circular1300' && c.Status === 'approved').map(c => ({ raw: c.RawValueDays == null ? '—' : String(c.RawValueDays), note: 'خروجی ۱۳۰۰ مدت مجاز پرداخت است و در جمع تمدید مدت منظور نشده است' })) },
    costs: { columns: [{ key: 'type', title: { fa: 'نوع هزینه', en: 'Cost type' } }, { key: 'title', title: { fa: 'عنوان', en: 'Title' } }, { key: 'amount', title: { fa: 'مبلغ', en: 'Amount' } }, { key: 'period', title: { fa: 'دوره', en: 'Period' } }, { key: 'basis', title: { fa: 'مبنای محاسبه', en: 'Basis' } }], rows: costItems.map(i => ({ type: COST_TYPE_FA[String(i.CostType)] ?? text(i.CostType), title: text(i.TitleFa), amount: i.Amount == null ? '—' : String(i.Amount), period: `${text(i.PeriodFrom).slice(0, 10)} → ${text(i.PeriodTo).slice(0, 10)}`, basis: text(i.Basis) })) },
    costTypes: { columns: [{ key: 'type', title: { fa: 'نوع هزینه', en: 'Cost type' } }, { key: 'total', title: { fa: 'جمع مبلغ', en: 'Total' } }], rows: Object.entries(costItems.reduce<Record<string, number>>((acc, i) => { const k = COST_TYPE_FA[String(i.CostType)] ?? String(i.CostType); acc[k] = (acc[k] ?? 0) + (Number(i.Amount) || 0); return acc; }, {})).map(([type, total]) => ({ type, total: String(total) })) },
    docs: { columns: [{ key: 'ref', title: { fa: 'مرجع سند', en: 'Document reference' } }, { key: 'source', title: { fa: 'منبع', en: 'Source' } }], rows: related.flatMap(e => [text(e.EvidenceRef, ''), ...((Array.isArray(e.EvidenceRefs) ? e.EvidenceRefs : []).map(v => text(v, '')))].filter(Boolean).map(ref => ({ ref, source: text(e.Code) }))) },
    costDocs: { columns: [{ key: 'item', title: { fa: 'آیتم هزینه', en: 'Cost item' } }, { key: 'ref', title: { fa: 'سند پشتیبان', en: 'Supporting document' } }], rows: costItems.flatMap(i => { const refs = refsText(i.DocumentRefs); return refs ? [{ item: text(i.TitleFa), ref: refs }] : []; }) },
    timeline: { columns: [{ key: 'code', title: { fa: 'رویداد', en: 'Event' } }, { key: 'party', title: { fa: 'طرف', en: 'Party' } }, { key: 'period', title: { fa: 'بازه', en: 'Period' } }, { key: 'critical', title: { fa: 'بحرانی', en: 'Critical' } }], rows: timeline.bars.map(b => ({ code: b.code, party: PARTY_FA[b.party] ?? b.party, period: `${b.startDate} → ${b.finishDate}`, critical: b.critical ? 'بحرانی' : 'غیربحرانی' })) },
    overlaps: { columns: [{ key: 'pair', title: { fa: 'جفت رویداد', en: 'Event pair' } }, { key: 'from', title: { fa: 'از', en: 'From' } }, { key: 'to', title: { fa: 'تا', en: 'To' } }], rows: timeline.overlaps.map(o => ({ pair: `${o.aCode} × ${o.bCode}`, from: o.from, to: o.to })) },
    notices: { columns: [{ key: 'key', title: { fa: 'عنوان', en: 'Item' } }, { key: 'value', title: { fa: 'مقدار', en: 'Value' } }], rows: kv([['تاریخ رویداد', text(claim.EventDate).slice(0, 10)], ['مهلت قراردادی ابلاغ (روز)', text(claim.NoticeDays)], ['تاریخ ابلاغ واقعی', text(claim.NoticeDeliveredAt).slice(0, 10)], ['مرجع ابلاغ', text(claim.NoticeRef)]]) },
    links: { columns: [{ key: 'code', title: { fa: 'رویداد', en: 'Event' } }, { key: 'claim', title: { fa: 'ادعا', en: 'Claim' } }, { key: 'risk', title: { fa: 'ریسک', en: 'Risk' } }, { key: 'issue', title: { fa: 'مسئله', en: 'Issue' } }, { key: 'wbs', title: { fa: 'WBS', en: 'WBS' } }, { key: 'activity', title: { fa: 'فعالیت', en: 'Activity' } }, { key: 'baseline', title: { fa: 'Baseline', en: 'Baseline' } }], rows: related.map(e => ({ code: text(e.Code), claim: text(e.ClaimCode), risk: text(e.RiskCode), issue: text(e.IssueCode), wbs: text(e.WbsCode), activity: text(e.ActivityCode), baseline: text(e.BaselineId) })) },
    deadlines: { columns: [{ key: 'item', title: { fa: 'مهلت', en: 'Deadline' } }, { key: 'due', title: { fa: 'سررسید', en: 'Due date' } }, { key: 'state', title: { fa: 'وضعیت', en: 'State' } }], rows: (() => { const ev = text(claim.EventDate).slice(0, 10); const days = Number(claim.NoticeDays); if (!/^\d{4}-\d{2}-\d{2}$/.test(ev) || !Number.isFinite(days)) return []; const due = new Date(ev + 'T00:00:00Z'); due.setUTCDate(due.getUTCDate() + days); return [{ item: 'مهلت ابلاغ ادعا', due: due.toISOString().slice(0, 10), state: claim.NoticeDeliveredAt ? 'ابلاغ‌شده' : 'در انتظار ابلاغ' }]; })() },
  };

  const sections: ReportDef['sections'] = [
    { kind: 'kpi', title: { fa: 'خلاصهٔ درخواست', en: 'Request summary' }, cells: [
      { label: { fa: 'ادعا', en: 'Claim' }, value: claimCode },
      { label: { fa: 'تمدید درخواستی', en: 'Requested EOT' }, value: `${text(claim.ExtensionDays)} روز` },
      { label: { fa: 'تمدید محاسبه و تأییدشده', en: 'Approved calculated EOT' }, value: `${approvedDays} روز` },
      { label: { fa: 'جمع ادعای مالی', en: 'Monetary claim total' }, value: String(costTotal) },
    ] },
  ];
  for (const chapter of CLAIM_DOC_CHAPTERS) {
    sections.push({ kind: 'text', title: { fa: `فصل ${chapter.no} ـ ${chapter.fa}`, en: `Chapter ${chapter.no} — ${chapter.en}` }, body: { fa: chapter.no === 10 ? `تایم‌لاین تصویری هم‌زمانی رویدادها (رنگ طرفین و قاب قرمز برای رویداد بحرانی): ${TIMELINE_TOKEN}` : `فصل ${chapter.no} از قالب استاندارد لایحهٔ تمدید مدت؛ جداول این فصل در ادامه آمده است.`, en: `Chapter ${chapter.no} of the standard claim template; tables follow.` } });
    for (const table of CLAIM_DOC_TABLES.filter(t => t.chapter === chapter.no)) {
      const data = datasets[table.dataset];
      sections.push({ kind: 'table', title: { fa: `جدول ${table.no} ـ ${table.fa}`, en: `Table ${table.no}` }, note: data.rows.length ? undefined : { fa: 'در پروندهٔ این ادعا داده‌ای برای این جدول ثبت نشده است.', en: 'No data recorded for this table.' }, columns: data.columns, rows: data.rows });
    }
  }
  sections.push({ kind: 'text', title: { fa: 'قید استفاده', en: 'Use limitation' }, body: { fa: issues.length ? `پیش‌نویس ناقص: ${issues.join('؛ ')}` : 'این سند فقط از رویدادها، محاسبات تأییدشده و آیتم‌های هزینهٔ ثبت‌شده ساخته شده است. نتیجهٔ خام یا محاسبهٔ تأییدنشده به‌عنوان تمدید قطعی ارائه نشده و خروجی ۱۳۰۰ در جمع تمدید منظور نشده است.', en: issues.length ? `Incomplete draft: ${issues.join('; ')}` : 'Built only from stored events, approved calculations and recorded cost items.' } });

  const letterhead: Letterhead = {
    projectName: input.projectId,
    projectCode: input.projectId,
    contractNo: text(claim.ContractCode ?? related[0]?.ContractCode),
    contractor: { name: 'پیمانکار', logoText: 'C', role: { fa: 'پیمانکار', en: 'Contractor' } },
    client: { name: 'کارفرما', logoText: 'E', role: { fa: 'کارفرما', en: 'Employer' } },
    consultant: { name: 'مشاور', logoText: 'S', role: { fa: 'مشاور', en: 'Consultant' } },
    docNo: `EOT-${claimCode}`,
    revision: 'R00',
    issueDate: input.generatedAt.slice(0, 10),
    periodLabel: 'لایحهٔ تمدید مدت',
    classification: 'confidential',
    distribution: ['کارفرما', 'مشاور', 'پروندهٔ ادعا'],
    preparedBy: text(claim.CreatedBy ?? claim.SubmittedBy),
    approvedBy: approved.map(calc => text(calc.ApprovedBy)).filter(Boolean).join('، ') || '—',
  };
  const report: ReportDef = {
    code: `EOT-${claimCode}`,
    title: { fa: `لایحهٔ درخواست تمدید مدت — ${claimCode}`, en: `Extension of Time claim — ${claimCode}` },
    periodicity: 'adhoc',
    sourceModule: 'd4-delay-claims',
    audiences: ['official'],
    sections,
  };
  const safeCode = claimCode.replace(/[^\w\u0600-\u06FF.-]+/g, '_');
  const svg = concurrencyTimelineSvg(related);
  const imageTag = svg ? `<div style="text-align:center;margin:4mm 0"><img alt="تایم‌لاین هم‌زمانی تأخیرات" src="data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}" style="max-width:100%"/></div>` : '<p>دادهٔ زمانی معتبر برای تایم‌لاین ثبت نشده است.</p>';
  const finalize = (html: string): string => sanitizeClaimDocumentHtml(
    html.replace(TIMELINE_TOKEN, imageTag).replace('</head>', `<style>body{font-family:'B Nazanin',Vazirmatn,Tahoma,sans-serif}table.grid td,table.grid th{font-family:inherit}</style></head>`),
  );
  if (input.format === 'word') {
    return { filename: `EOT-${safeCode}.doc`, contentType: 'application/msword; charset=utf-8', body: finalize(toWordHtml(report, letterhead, 'official', 'fa')), issues };
  }
  return { filename: `EOT-${safeCode}.html`, contentType: 'text/html; charset=utf-8', body: finalize(toPrintHtml(report, letterhead, 'official', 'fa')), issues };
}

export function claimDocumentEnvelopeNote(input: ClaimDocumentInput): string {
  const issues = validateClaimDocumentInput(input);
  return issues.length ? `لایحه قابل تولید نیست: ${issues.join('؛ ')}` : escapeHtml('لایحه از داده‌های واقعی و محاسبات تأییدشده ساخته می‌شود');
}
