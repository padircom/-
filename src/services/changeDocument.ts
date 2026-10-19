/**
 * ChangeReportGenerationService — سند گزارش چرخهٔ تغییر (PMO-INTEGRATED-CHANGE-MANAGEMENT-V1.0).
 * ساختار: ۱۲ فصل و ۲۸ جدول (CHANGE_REPORT_CHAPTERS/CHANGE_REPORT_TABLES) از دادهٔ واقعی جدول‌های
 * PmisChange* پر می‌شود؛ هر سلول یا مقدار واقعی است یا «—». هیچ مبلغ/استحقاق/مادهٔ حقوقی حدس
 * زده نمی‌شود؛ llmConnected:false در متن سند درج می‌گردد. قواعد کلیدی پرونده: پنج لایهٔ مبلغ
 * جدا و منفاوت؛ اثر زمانی تغییر با تمدید قراردادی یکی نیست؛ مبلغ مصوب فقط با منبع/سند معتبر؛
 * تصمیم نهایی با SoD (تصمیم‌گیرنده ≠ آماده‌کننده)؛ مبنای جاری برنامه‌ریزی هرگز بازنویسی
 * نمی‌شود و پیشنهاد نسخهٔ نامستقر «پیش‌نویس» است.
 * Auto-Cleanup هنگام صدور: صفحات/بخش‌های راهنمای داخلی حذف، برچسب‌های «الزامی/اختیاری» پاک،
 * هایلایت‌های زرد شفاف و فونت رسمی B Nazanin اعمال می‌شود.
 * الگو: src/services/disputeExpertDocument.ts (گزارش ۲۰/۳۴) و src/services/claimLossDocument.ts.
 */
import {
  CHANGE_STATUSES, CHANGE_STATUS_FA, CHANGE_STATUS_PERM, CHANGE_TYPE_FA,
  COST_LAYERS, COST_LAYER_FA, LINK_KIND_FA, IMPLEMENTATION_STEPS,
  IMPLEMENTATION_STEP_FA, CHANGE_LLM_CONNECTED,
} from './changeManagement';

type Row = Record<string, unknown>;
const esc = (v: unknown): string => String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escLines = (v: unknown): string => esc(v).replace(/\n/g, '<br/>');
const faNum = (v: unknown): string => {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
};
const faDate = (v: unknown): string => {
  const s = String(v ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  try { return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s + 'T00:00:00')); } catch { return s; }
};
const faDateTime = (v: unknown): string => {
  const s = String(v ?? '');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) return '—';
  return faDate(s) + ' ' + s.slice(11, 16);
};
const table = (heads: string[], rows: string[][]): string =>
  `<table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}">—</td></tr>`}</tbody></table>`;
const kv = (pairs: [string, string][]): string => table(['عنوان', 'مقدار'], pairs.map(([k, v]) => [esc(k), v]));
const jsonList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) { try { const j = JSON.parse(v); if (Array.isArray(j)) return j.map(String).filter(Boolean); } catch { return v.split(/[,،]/).map(s => s.trim()).filter(Boolean); } }
  return [];
};

/** فصل‌بندی رسمی سند گزارش تغییر — دقیقاً ۱۲ فصل. */
export const CHANGE_REPORT_CHAPTERS: { no: number; key: string; fa: string }[] = [
  { no: 1, key: 'identity', fa: 'مشخصات سند، پرونده و داده‌ها' },
  { no: 2, key: 'description', fa: 'شرح، علت و ضرورت تغییر' },
  { no: 3, key: 'workflow', fa: 'چرخهٔ تصویب و وضعیت فعلی' },
  { no: 4, key: 'time', fa: 'تحلیل اثر تغییر بر زمان‌بندی' },
  { no: 5, key: 'cost', fa: 'لایه‌های هزینهٔ تغییر (پنج لایهٔ منفاوت)' },
  { no: 6, key: 'contract', fa: 'بررسی قراردادی و مبنای استحقاق' },
  { no: 7, key: 'module-links', fa: 'پیوندهای نرم با ماژول‌های مرتبط' },
  { no: 8, key: 'risk-claim', fa: 'پیوندهای ریسک، ادعا و اختلاف' },
  { no: 9, key: 'implementation', fa: 'مسیر اجرای پس از تصویب' },
  { no: 10, key: 'baseline', fa: 'پیشنهاد نسخهٔ نامستقر مبنا' },
  { no: 11, key: 'documents', fa: 'مستندات و مدارک پشتیبان' },
  { no: 12, key: 'audit', fa: 'ردپای ممیزی و بیانیهٔ صدق داده' },
];

/* ── فهرست استاندارد ۲۸ جدول سند (chapter = شمارهٔ فصل) ── */
export const CHANGE_REPORT_TABLES: { no: number; chapter: number; fa: string; dataset: string }[] = [
  { no: 1, chapter: 1, fa: 'مشخصات سند', dataset: 'docMeta' },
  { no: 2, chapter: 1, fa: 'شناسنامهٔ درخواست تغییر', dataset: 'identity' },
  { no: 3, chapter: 1, fa: 'اطلاعات قرارداد/اولویت/زمان‌بندی درخواست', dataset: 'contract' },
  { no: 4, chapter: 2, fa: 'شرح، علت، ضرورت و محدودهٔ متأثر', dataset: 'descTable' },
  { no: 5, chapter: 3, fa: 'مسیر گذر وضعیت (زنجیرهٔ تصویب)', dataset: 'trailTable' },
  { no: 6, chapter: 3, fa: 'تصمیم مرجع مجاز و جدایی وظایف', dataset: 'decisionTable' },
  { no: 7, chapter: 3, fa: 'دسترسی لازم هر مرحله (Perm)', dataset: 'permTable' },
  { no: 8, chapter: 4, fa: 'ردیف‌های تحلیل اثر زمانی', dataset: 'schedRows' },
  { no: 9, chapter: 4, fa: 'خروجی موتور تحلیل اثر زمانی', dataset: 'timeEngine' },
  { no: 10, chapter: 4, fa: 'مسیر بحرانی/نقاط عطف/کدهای ناشناخته', dataset: 'cpTable' },
  { no: 11, chapter: 5, fa: 'جمع پنج لایهٔ مبلغ', dataset: 'layerTotals' },
  { no: 12, chapter: 5, fa: 'ردیف‌های برآورد هزینه', dataset: 'costRows' },
  { no: 13, chapter: 5, fa: 'دلتاهای زنجیرهٔ لایه', dataset: 'layerDeltas' },
  { no: 14, chapter: 5, fa: 'هشدارهای قواعد هزینه', dataset: 'costWarnings' },
  { no: 15, chapter: 6, fa: 'ارجاعات قراردادی (ClauseRefs)', dataset: 'clauseRefs' },
  { no: 16, chapter: 6, fa: 'مبنای استحقاق تمدید (EOT) هر ردیف', dataset: 'eotBasis' },
  { no: 17, chapter: 6, fa: 'بیانیهٔ صداقت قراردادی', dataset: 'contractHonesty' },
  { no: 18, chapter: 7, fa: 'پیوندهای نرم ماژول‌ها', dataset: 'moduleLinks' },
  { no: 19, chapter: 7, fa: 'نتیجهٔ راستی‌آزمایی پیوندها', dataset: 'verifyTotals' },
  { no: 20, chapter: 8, fa: 'پیوندهای ریسک مرتبط', dataset: 'riskLinks' },
  { no: 21, chapter: 8, fa: 'پیوندهای ادعا/اختلاف مرتبط', dataset: 'claimLinks' },
  { no: 22, chapter: 9, fa: 'ردیف‌های ردیابی اجرای تصویب', dataset: 'implRows' },
  { no: 23, chapter: 9, fa: 'شش گام مسیر اجرا', dataset: 'implSteps' },
  { no: 24, chapter: 10, fa: 'پیشنهاد نسخهٔ نامستقر مبنا', dataset: 'baselineProposal' },
  { no: 25, chapter: 11, fa: 'فهرست اسناد پیوست‌شدهٔ پرونده', dataset: 'documents' },
  { no: 26, chapter: 11, fa: 'ارجاعات اسناد پشتیبان خام (SupportDocRefs)', dataset: 'supportRefs' },
  { no: 27, chapter: 12, fa: 'ردپای ممیزی (تا ۵۰ رویداد اخیر)', dataset: 'auditTrail' },
  { no: 28, chapter: 12, fa: 'بیانیهٔ صدق داده و محدودیت‌ها', dataset: 'honesty' },
];

/** Auto-Cleanup رسمی سند — مطابق الگوی گزارش‌های ضرر/کارشناسی. */
export function sanitizeChangeReportHtml(html: string): string {
  return html
    .replace(/<div class="internal-guide"[\s\S]*?<\/div>/g, '')
    .replace(/<section[^>]*data-internal="true"[\s\S]*?<\/section>/g, '')
    .replace(/<p[^>]*>[^<]*(?:راهنمای داخلی|Internal guide)[^<]*<\/p>/g, '')
    .replace(/\s*[\[(【](الزامی|اختیاری|Required|Optional)[\])】]/g, '')
    .replace(/background(?:-color)?\s*:\s*(?:#ff0(?:000)?|#ffff00|yellow)\s*;?/gi, '')
    .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1')
    .replace(/\sclass="hl"/g, '');
}

export type ChangeTimeAnalysisLite = {
  estimatedDeltaDays?: number | null; approvedEotDays?: number | null; criticalPathEffect?: string;
  affectedActivities?: Row[]; unknownCodes?: string[]; milestoneCount?: number; basisNoteFa?: string | null;
  criticalCount?: number; baselineFinish?: string | null;
};
export type ChangeCostAnalysisLite = {
  layers?: Record<string, number>; layerDeltas?: Record<string, number | null>;
  directTotal?: number; indirectTotal?: number; timeRelatedTotal?: number; rowCount?: number; warningsFa?: string[];
};

export type ChangeReportInput = {
  projectId: string; projectTitleFa?: string | null;
  request: Row;
  impacts: Row[]; costs: Row[]; schedules: Row[]; approvals: Row[];
  riskLinks: Row[]; claimLinks: Row[]; documents: Row[];
  implementation: Row[]; audits: Row[]; moduleLinks: Row[];
  timeAnalysis?: ChangeTimeAnalysisLite | null;
  costAnalysis?: ChangeCostAnalysisLite | null;
  linksVerify?: { verified: number; missing: number } | null;
  generatedAt: string; generatedBy: string; format: 'word' | 'pdf';
};

const CP_FA: Record<string, string> = { none: 'بدون اثر بر مسیر بحرانی', partial: 'اثر جزئی بر مسیر بحرانی', critical: 'اثر بر مسیر بحرانی', unknown: 'نامشخص (دادهٔ برنامه ناقص)' };

export function buildChangeReport(input: ChangeReportInput) {
  const req = input.request;
  const issues: string[] = [];
  if (!req || !req.Code) issues.push('شناسنامهٔ درخواست تغییر معتبر نیست');
  if (issues.length === 0 && String(req.Status) === 'draft') {
    const childTotal = input.impacts.length + input.costs.length + input.schedules.length + input.moduleLinks.length + input.documents.length;
    if (childTotal === 0) issues.push('صدور گزارش برای پیش‌نویسِ فاقد هرگونه ردیف تحلیل/هزینه/پیوند/سند مجاز نیست — ابتدا دادهٔ واقعی ثبت کنید');
  }

  const statusFa = (st: unknown): string => (CHANGE_STATUS_FA as Record<string, string>)[String(st)] ?? (st ? String(st) : '—');
  const typeFa = (t: unknown): string => (CHANGE_TYPE_FA as Record<string, string>)[String(t)] ?? (t ? String(t) : '—');
  const reqCode = String(req?.Code ?? 'change');
  const sortedAudits = [...input.audits].sort((a, b) => String(b.OccurredAt ?? '').localeCompare(String(a.OccurredAt ?? ''))).slice(0, 50);
  const approvalsSorted = [...input.approvals].sort((a, b) => String(a.DecidedAt ?? '').localeCompare(String(b.DecidedAt ?? '')));

  const parts: string[] = [];
  parts.push(`<div class="cover">
    <h1>گزارش چرخهٔ مدیریت تغییر</h1>
    <p>درخواست تغییر <b>${esc(reqCode)}</b> — ${esc(req?.TitleFa ?? '—')}</p>
    <p>پروژه: ${esc(input.projectTitleFa ?? input.projectId)} · استاندارد: PMO-INTEGRATED-CHANGE-MANAGEMENT-V1.0</p>
    <p>تولید: ${faDateTime(input.generatedAt)} · توسط: ${esc(input.generatedBy)} · قالب: ${input.format === 'pdf' ? 'PDF' : 'Word'}</p>
  </div>`);
  parts.push('<div class="internal-guide"><p>راهنمای داخلی: این بلوک فقط تنظیمی است [الزامی]</p></div>');

  /* فصل ۱ — مشخصات */
  parts.push('<h2>فصل ۱ — مشخصات سند، پرونده و داده‌ها</h2>');
  parts.push(kv([
    ['عنوان سند', esc(`گزارش چرخهٔ تغییر ${reqCode}`)], ['نسخهٔ داده', esc(String(input.generatedAt).replace('T', ' ').slice(0, 19))],
    ['استاندارد', 'PMO-INTEGRATED-CHANGE-MANAGEMENT-V1.0 (۱.۰.۰)'], ['قالب خروجی', esc(input.format)],
  ]));
  parts.push(kv([
    ['کد درخواست', esc(req?.Code)], ['عنوان', esc(req?.TitleFa)], ['نوع تغییر', esc(typeFa(req?.ChangeType))],
    ['وضعیت فعلی', esc(statusFa(req?.Status))], ['درخواست‌کننده', esc(req?.RequestedBy)],
    ['تاریخ درخواست', faDate(req?.RequestDate)], ['مهلت بررسی', faDate(req?.ReviewDueDate)],
  ]));
  parts.push(kv([
    ['کد قرارداد', esc(req?.ContractCode ?? '—')], ['واحد پول', esc(req?.Currency ?? 'IRR')],
    ['اولویت', esc(req?.Priority ?? '—')], ['مالک بررسی', esc(req?.ReviewOwnerFa ?? '—')],
    ['برآورد نخست', faNum(req?.InitialCostEstimate)], ['اثر زمان نخست (روز)', faNum(req?.InitialTimeImpactDays)],
  ]));

  /* فصل ۲ — شرح */
  parts.push('<h2>فصل ۲ — شرح، علت و ضرورت تغییر</h2>');
  parts.push(kv([
    ['شرح تغییر', escLines(req?.DescriptionFa ?? '—')], ['علت', escLines(req?.ReasonFa ?? '—')],
    ['ضرورت', escLines(req?.NecessityFa ?? '—')], ['محدودهٔ متأثر', escLines(req?.AffectedScopeFa ?? '—')],
    ['کدهای WBS', esc(jsonList(req?.WbsRefs).join('، ') || '—')], ['کدهای فعالیت', esc(jsonList(req?.ActivityRefs).join('، ') || '—')],
  ]));

  /* فصل ۳ — چرخهٔ تصویب */
  parts.push('<h2>فصل ۳ — چرخهٔ تصویب و وضعیت فعلی</h2>');
  parts.push(table(['وضعیت', 'مجوز لازم', 'زمان آخرین گذر', 'مجری آخرین گذر'],
    CHANGE_STATUSES.slice(0, 16).map((s) => {
      const hit = approvalsSorted.find((a) => String(a.StepCode) === s);
      const isCurrent = String(req?.Status) === s;
      return [esc(statusFa(s) + (isCurrent ? ' (جاری)' : '')), esc((CHANGE_STATUS_PERM as Record<string, string>)[s] ?? '—'),
        hit ? faDateTime(hit.DecidedAt) : (isCurrent ? faDateTime(req?.StatusChangedAt) : '—'),
        hit ? esc(hit.DecidedBy) : (isCurrent ? esc(req?.StatusChangedBy) : '—')];
    })));
  parts.push(kv([
    ['تصمیم‌گیرنده', esc(req?.DecidedBy ?? '—')], ['زمان تصمیم', faDateTime(req?.DecidedAt)],
    ['متن تصمیم', escLines(req?.DecisionFa ?? '—')],
    ['جدایی وظایف', 'تصمیم‌گیرنده با آماده‌کنندهٔ نهایی تصمیم یکی نیست (SoD سمت سرور)'],
    ['علت رد (اگر رد شده)', escLines(req?.RejectionReasonFa ?? '—')],
  ]));
  parts.push(table(['گام ثبت‌شده', 'نوع', 'تصمیم', 'تصمیم‌گیرنده', 'زمان', 'یادداشت'],
    approvalsSorted.map((a) => [esc(statusFa(a.StepCode)), esc(String(a.Stage ?? '—')), esc(String(a.Decision ?? '—')), esc(a.DecidedBy), faDateTime(a.DecidedAt), escLines(a.NoteFa ?? '—')])));

  /* فصل ۴ — اثر زمانی */
  parts.push('<h2>فصل ۴ — تحلیل اثر تغییر بر زمان‌بندی</h2>');
  parts.push(table(['کد', 'روش', 'مفروضات', 'Σ اثر تخمینی (روز)', 'اثر پایان (روز)', 'تمدید مصوب (روز)', 'مبنای استحقاق'],
    input.schedules.map((s) => [esc(s.Code), esc(s.MethodFa), esc(s.AssumptionsFa), faNum(s.EstimatedDurationDeltaDays),
      faNum(s.CompletionEffectDays), faNum(s.ApprovedEotDays), escLines(s.EotEntitlementFa ?? '—')])));
  const ta = input.timeAnalysis;
  parts.push(kv([
    ['اثر بر مسیر بحرانی', esc(CP_FA[String(ta?.criticalPathEffect ?? 'unknown')] ?? '—')],
    ['Σ اثر تخمینی (روز)', faNum(ta?.estimatedDeltaDays ?? null)],
    ['تمدید تأییدشدهٔ مصوب (روز)', faNum(ta?.approvedEotDays ?? null)],
    ['فعالیت بحرانی متأثر', faNum(ta?.criticalCount ?? null)], ['شمار نقاط عطف', faNum(ta?.milestoneCount ?? null)],
    ['پایان مبنا', esc(ta?.baselineFinish ?? '—')], ['توضیح مبنا', esc(ta?.basisNoteFa ?? '—')],
  ]));
  parts.push(kv([
    ['کدهای ناشناخته در برنامه', esc((ta?.unknownCodes ?? []).join('، ') || '—')],
    ['فعالیت‌های متأثر شناخته‌شده', faNum((ta?.affectedActivities ?? []).length) === '—' ? '—' : faNum((ta?.affectedActivities ?? []).length)],
    ['قاعدهٔ صدق', 'اثر زمانی تغییر با تمدید قراردادی (EOT) یکی نیست؛ تمدید نیازمند مبنای استحقاق و تأیید مستقل است'],
  ]));

  /* فصل ۵ — هزینه */
  parts.push('<h2>فصل ۵ — لایه‌های هزینهٔ تغییر (پنج لایهٔ منفاوت)</h2>');
  const ca = input.costAnalysis;
  parts.push(table(['لایه', 'توضیح', 'جمع (واحد پول پرونده)'],
    COST_LAYERS.map((l) => [esc(COST_LAYER_FA[l]), esc(l === 'estimated' ? 'برآورد مهندسی/کارشناسی' : l === 'proposed' ? 'پیشنهاد طرف مقابل/پیمانکار' : l === 'negotiated' ? 'توافق مذاکره تا پیش از تصویب' : l === 'approved' ? 'مصوب مرجع مجاز با سند معتبر' : 'پرداخت واقعی ثبت‌شده'), faNum(ca?.layers?.[l] ?? null)])));
  parts.push(table(['کد', 'لایه', 'مبلغ', 'مستقیم', 'غیرمستقیم', 'زمان‌وابسته', 'فرمول', 'منبع', 'تاریخ مبنا', 'تهیه‌کننده'],
    input.costs.map((c) => [esc(c.Code), esc((COST_LAYER_FA as Record<string, string>)[String(c.Layer)] ?? String(c.Layer ?? '—')), faNum(c.Amount),
      faNum(c.DirectAmount), faNum(c.IndirectAmount), faNum(c.TimeRelatedAmount),
      escLines(c.FormulaFa), escLines(c.SourceFa), faDate(c.BasisDate), esc(c.PreparedBy ?? '—')])));
  parts.push(table(['گذر لایه', 'مقدار'],
    [['برآورد→پیشنهاد', ca?.layerDeltas?.['proposed-estimated']], ['پیشنهاد→مذاکره', ca?.layerDeltas?.['negotiated-proposed']], ['مذاکره→مصوب', ca?.layerDeltas?.['approved-negotiated']], ['مصوب→پرداخت', ca?.layerDeltas?.['paid-approved']]]
      .map(([k, v]) => [esc(String(k)), (v as number | null | undefined) == null ? '—' : faNum(v as number)])));
  parts.push(table(['هشدار قاعده'], (ca?.warningsFa ?? []).map((w) => [esc(w)])));
  parts.push(`<p>۵ لایه هیچ‌وقت مکملِ هم نیستند؛ مبلغ «مصوب» فقط با منبع/سند معتبر ثبت می‌شود و «پرداخت» بدون «مصوب» معنای قراردادی ندارد. (این جمله بخشی از قاعدهٔ ماژول است، نه دادهٔ جدید)</p>`);

  /* فصل ۶ — قرارداد و استحقاق */
  parts.push('<h2>فصل ۶ — بررسی قراردادی و مبنای استحقاق</h2>');
  parts.push(table(['ارجاع قراردادی ثبت‌شده'], jsonList(req?.ClauseRefs).map((c) => [esc(c)])));
  parts.push(table(['کد ردیف تحلیل', 'تمدید مصوب (روز)', 'متن مبنای استحقاق'],
    input.schedules.filter((s) => Number(s.ApprovedEotDays)).map((s) => [esc(s.Code), faNum(s.ApprovedEotDays), escLines(s.EotEntitlementFa ?? '—')])));
  parts.push(kv([
    ['قاعدهٔ استحقاق', 'تمدید قراردادی فقط با مبنای استحقاق مستند و تأیید مرجع قابل ثبت است؛ تعریف «استحقاق» از متن درخواست حدس زده نمی‌شود'],
    ['قاعدهٔ مبلغ', 'مبالغ مصوب/پرداخت فقط با منبع معتبر ثبت می‌شوند (قاعدهٔ سرور: CHG_AMOUNT_SOURCE)'],
    ['صداقت حقوقی', 'هیچ مادهٔ قانونی/شرط قراردادی فراتر از ارجاعات ثبت‌شدهٔ پرونده در سند درج نشده است'],
  ]));

  /* فصل ۷ — پیوندهای نرم */
  parts.push('<h2>فصل ۷ — پیوندهای نرم با ماژول‌های مرتبط</h2>');
  parts.push(table(['کد', 'نوع پیوند', 'کد هدف', 'عنوان هدف', 'توضیح', 'ثبت‌کننده'],
    input.moduleLinks.map((l) => [esc(l.Code), esc(LINK_KIND_FA[String(l.LinkKind)] ?? String(l.LinkKind ?? '—')),
      esc(l.TargetCode), esc(l.TargetTitleFa), escLines(l.DescriptionFa ?? '—'), esc(l.EstablishedBy ?? l.CreatedBy ?? '—')])));
  parts.push(kv([
    ['پیوندهای تأییدشده با ماژول‌های مبنأ (راستی‌آزمایی)', faNum(input.linksVerify?.verified ?? null)],
    ['پیوندهای مفقود/بی‌مقصد در ماژول مبنأ', faNum(input.linksVerify?.missing ?? null)],
    ['قاعدهٔ پیوند', 'همهٔ پیوندها نرم‌اند (Code/ID منطقی) و هیچ کلید خارجی فیزیکی بین ماژول‌ها وجود ندارد'],
  ]));

  /* فصل ۸ — ریسک و ادعا */
  parts.push('<h2>فصل ۸ — پیوندهای ریسک، ادعا و اختلاف</h2>');
  parts.push(table(['کد', 'نوع پیوند', 'علت ریسک', 'امتیاز', 'توضیح', 'پیوند بین‌ماژولی'],
    input.riskLinks.map((l) => [esc(l.Code), esc(String(l.LinkType ?? '—')), esc(String(l.RiskCauseRef ?? l.CauseFa ?? '—')), faNum(l.Score), escLines(l.DescriptionFa ?? '—'), esc(String(l.ModuleLinkRef ?? '—'))])));
  parts.push(table(['کد', 'نوع پیوند', 'ارجاع ادعا/اختلاف', 'ارجاع پروندهٔ کارشناسی', 'توضیح'],
    input.claimLinks.map((l) => [esc(l.Code), esc(String(l.LinkType ?? '—')), esc(String(l.ClaimRef ?? '—')), esc(String(l.ExpertCaseRef ?? '—')), escLines(l.DescriptionFa ?? '—')])));

  /* فصل ۹ — اجرا */
  parts.push('<h2>فصل ۹ — مسیر اجرای پس از تصویب</h2>');
  parts.push(table(['کد', 'مرحله', 'وضعیت', 'ارجاع مبنا', 'نتیجهٔ اجرا', 'به‌روزرساننده'],
    input.implementation.map((m) => [esc(m.Code), esc(IMPLEMENTATION_STEP_FA[String(m.Step)] ?? String(m.Step ?? '—')),
      esc(String(m.Status ?? '—')), esc(m.BaselineUpdateRef ?? '—'), escLines(m.ExecutionResultFa ?? '—'), esc(m.UpdatedBy ?? '—')] )));
  parts.push(table(['گام مسیر اجرا', 'توضیح'],
    IMPLEMENTATION_STEPS.map((s) => [esc(IMPLEMENTATION_STEP_FA[s]), esc(s === 'baselines_updated' ? 'نسخهٔ نامستقر مبنا پیشنهاد می‌شود؛ هرگز مبنای جاری بازنویسی نمی‌شود' : 'ردیف اجرای واقعی از ماژول اجرا ثبت می‌شود، نه حدس')])));

  /* فصل ۱۰ — مبنا */
  parts.push('<h2>فصل ۱۰ — پیشنهاد نسخهٔ نامستقر مبنا</h2>');
  const blLinks = input.moduleLinks.filter((l) => String(l.LinkKind) === 'baseline_revision');
  parts.push(table(['نسخهٔ نامستقر مبنا (IsCurrent=false)', 'توضیح پیشنهاد', 'ثبت‌کننده/زمان'],
    blLinks.map((l) => [esc(l.TargetCode), escLines(l.DescriptionFa ?? '—'), esc(l.EstablishedBy ?? '—') + ' · ' + faDateTime(l.EstablishedAt)])));
  parts.push(kv([
    ['قاعدهٔ مبنا', 'مبنای جاری ماژول برنامه‌ریزی (d2) هرگز توسط این موتور بازنویسی نمی‌شود'],
    ['اعتبار پیشنهاد', 'نسخهٔ نامستقر «پیش‌نویس» است و تا تصویب/بهره‌برداری، مبنای عملیات محسوب نمی‌شود'],
  ]));

  /* فصل ۱۱ — مستندات */
  parts.push('<h2>فصل ۱۱ — مستندات و مدارک پشتیبان</h2>');
  parts.push(table(['کد', 'عنوان', 'نوع', 'ارجاع فایل', 'بحث', 'بارگذار'],
    input.documents.map((d) => [esc(d.Code), esc(d.TitleFa), esc(String(d.Kind ?? '—')), esc(d.FileRef ?? '—'), escLines(d.DescriptionFa ?? '—'), esc(d.UploadedBy ?? '—')] )));
  parts.push(table(['ارجاع پشتیبان خام'], jsonList(req?.SupportDocRefs).map((d) => [esc(d)])));

  /* فصل ۱۲ — ممیزی و صدق داده */
  parts.push('<h2>فصل ۱۲ — ردپای ممیزی و بیانیهٔ صدق داده</h2>');
  parts.push(table(['زمان', 'اقدام', 'مجری', 'جزئیات', 'از → به'],
    sortedAudits.map((a) => [faDateTime(a.OccurredAt), esc(a.Action), esc(a.Actor), escLines(a.DetailFa ?? '—'), esc((a.FromValue ?? '—') + ' → ' + String(a.ToValue ?? '—'))])) );
  parts.push(kv([
    ['صدق داده', 'همهٔ اعداد/متون سند از ردیف‌های واقعی PmisChange* استخراج شده‌اند؛ دادهٔ ناقص با «—» آمده است'],
    ['دستیار', CHANGE_LLM_CONNECTED ? 'متصل' : 'بدون اتصال LLM (قاعده‌محور) — خروجی قواعد ثابت از دادهٔ واقعی'],
    ['محدودیت‌ها', 'این سند ماهیت تصمیم‌گیری قراردادی ندارد؛ هر تصمیم در مسیر گردش‌کار سمت سرور و با SoD اعتبار می‌یابد'],
  ]));

  const rawBody = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="fa">
<head><meta charset="utf-8"><title>گزارش تغییر ${esc(reqCode)}</title>
<style>@page{size:A4;margin:18mm}body{font-family:'B Nazanin',Tahoma,sans-serif;font-size:12pt;line-height:1.9;color:#111}h1{font-size:19pt}h2{font-size:14pt;border-bottom:2px solid #1f4e79;padding-bottom:4px;margin-top:22px}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #666;padding:5px 7px;font-size:10.5pt;text-align:right;vertical-align:top}th{background:#dbe7f3}.cover{border:2px solid #1f4e79;padding:24px;text-align:center;margin-top:60px}</style></head>
<body>${parts.join('\n')}</body></html>`;

  const finalize = (html: string): string => sanitizeChangeReportHtml(
    html.replace('</head>', "<style>body{font-family:'B Nazanin',Tahoma,sans-serif}table td,table th{font-family:inherit}</style></head>"),
  );
  const filename = `ChangeReport-${reqCode}.${input.format === 'pdf' ? 'html' : 'doc'}`;
  return { body: finalize(rawBody), issues, notices: [] as string[], filename, contentType: 'application/msword; charset=utf-8', chapters: CHANGE_REPORT_CHAPTERS.length, tables: CHANGE_REPORT_TABLES.length };
}
