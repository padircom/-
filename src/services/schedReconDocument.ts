/**
 * SchedReconReportGenerator — گزارش کارشناسی بازسازی و تحلیل زمان‌بندی ادعا
 * (PMO-FORENSIC-SCHEDULE-ENGINE-V1.0).
 * استاندارد صنعتی سند: دقیقاً ۱۸ فصل و ۵۱ جدول (RECON_DOC_TABLES).
 * Auto-Cleanup هنگام صدور: بخش‌های راهنمای داخلی حذف، برچسب‌های
 * «الزامی/اختیاری» پاک، هایلایت‌های زرد شفاف و فونت رسمی B Nazanin اعمال می‌شود.
 * سند تا تأیید مسئول مربوط «پیش‌نویس» است؛ دادهٔ ناقص «—» چاپ می‌شود، عددی
 * حدس زده نمی‌شود و این سند هرگز مبلغ خسارت یا مدت تمدید گزارش نمی‌کند —
 * خروجی فقط «زمان‌بندی بازسازی‌شده» است که جداول ۱۱ تا ۲۵ لایحهٔ ۵۱ جدولیِ
 * ادعا را تغذیه می‌کند.
 */
import { MIP_PROTOCOLS, mipProtocolByCode, NETWORK_VALIDATION_THRESHOLDS, CLAIM_DOC_SCHEDULE_TABLE_RANGE, RECON_STEPS } from './forensicScheduleRecon';

export const RECON_DOC_CHAPTERS: { no: number; fa: string; en: string }[] = [
  { no: 1, fa: 'صفحه عنوان', en: 'Cover page' }, { no: 2, fa: 'مشخصات مأموریت و پروژه', en: 'Mission & project' },
  { no: 3, fa: 'خلاصه مدیریتی', en: 'Executive summary' }, { no: 4, fa: 'گام ۱ ـ تعریف مأموریت و بازه ادعا', en: 'Step 1 — mission definition' },
  { no: 5, fa: 'گام ۲ ـ مستندات استخراج‌شده از واقعیت', en: 'Step 2 — evidence extraction' }, { no: 6, fa: 'گام ۳ ـ ارزیابی فایل زمان‌بندی و تصمیم بازسازی', en: 'Step 3 — file evaluation' },
  { no: 7, fa: 'گام ۴ ـ همسان‌سازی WBS', en: 'Step 4 — WBS mapping' }, { no: 8, fa: 'گام ۵ ـ دیکشنری فعالیت‌های بازسازی‌شده', en: 'Step 5 — activity dictionary' },
  { no: 9, fa: 'گام ۶ ـ تقویم‌ها و مدت‌ها', en: 'Step 6 — calendars & durations' }, { no: 10, fa: 'گام ۷ ـ منطق شبکهٔ بازسازی‌شده', en: 'Step 7 — network logic' },
  { no: 11, fa: 'گام ۷ ـ مسیر بحرانی بازسازی‌شده', en: 'Step 7 — critical path' }, { no: 12, fa: 'گام ۷ ـ مقاطع زمانی و ردیابی مسیر بحرانی', en: 'Cut-off snapshots' },
  { no: 13, fa: 'گام ۸ ـ اعتبارسنجی مدل زمان‌بندی', en: 'Step 8 — model validation' }, { no: 14, fa: 'تطبیق با پروتکل‌های AACE 29R-03 (MIP)', en: 'MIP protocol mapping' },
  { no: 15, fa: 'پیوند با تحلیل تأخیر و لایحهٔ ادعا', en: 'Feed to delay analysis & claim document' }, { no: 16, fa: 'فروض و محدودیت‌ها', en: 'Assumptions & limitations' },
  { no: 17, fa: 'تعیین‌تکلیف کارشناسی', en: 'Expert disposition' }, { no: 18, fa: 'پیوست‌ها', en: 'Annexes' },
];

type TableDataset = string;
export const RECON_DOC_TABLES: { no: number; chapter: number; fa: string; dataset: TableDataset }[] = [
  { no: 1, chapter: 1, fa: 'مشخصات سند', dataset: 'docMeta' }, { no: 2, chapter: 1, fa: 'جایگاه مأموریت', dataset: 'missionCover' },
  { no: 3, chapter: 2, fa: 'مشخصات مأموریت', dataset: 'mission' }, { no: 4, chapter: 2, fa: 'پیوندهای نرم به پرونده‌های دیگر', dataset: 'softLinks' }, { no: 5, chapter: 2, fa: 'سوابق ثبت و تأیید', dataset: 'auditTrail' },
  { no: 6, chapter: 3, fa: 'شاخص‌های کلیدی مأموریت', dataset: 'kpis' }, { no: 7, chapter: 3, fa: 'موجودیت داده به تفکیک مرحله', dataset: 'dataInventory' }, { no: 8, chapter: 3, fa: 'وضعیت آمادگی گزارش', dataset: 'readiness' },
  { no: 9, chapter: 4, fa: 'هدف داوری/کارشناسی', dataset: 'purpose' }, { no: 10, chapter: 4, fa: 'بازه ادعا', dataset: 'periodRange' }, { no: 11, chapter: 4, fa: 'استانداردهای مبنا', dataset: 'standards' },
  { no: 12, chapter: 5, fa: 'فهرست مستندات استخراج‌شده', dataset: 'extractions' }, { no: 13, chapter: 5, fa: 'وضعیت احراز مستندات', dataset: 'extractionVerification' }, { no: 14, chapter: 5, fa: 'انواع اسناد واقعیت', dataset: 'docKinds' },
  { no: 15, chapter: 6, fa: 'ارزیابی‌های فایل زمان‌بندی', dataset: 'evaluations' }, { no: 16, chapter: 6, fa: 'شاخص‌های آسیب‌دیدگی فایل', dataset: 'damageMetrics' }, { no: 17, chapter: 6, fa: 'تصمیم Repair در برابر Reconstruction', dataset: 'decision' },
  { no: 18, chapter: 7, fa: 'نقشهٔ تطبیق WBS', dataset: 'wbsMaps' }, { no: 19, chapter: 7, fa: 'انواع نگاشت WBS', dataset: 'wbsKinds' }, { no: 20, chapter: 7, fa: 'وضعیت تأیید نگاشت‌ها', dataset: 'wbsStatus' },
  { no: 21, chapter: 8, fa: 'دیکشنری فعالیت‌ها', dataset: 'activities' }, { no: 22, chapter: 8, fa: 'تاریخ‌های برنامه‌ای در برابر واقعی', dataset: 'activityDates' }, { no: 23, chapter: 8, fa: 'انواع و پرچم وضعیت فعالیت‌ها', dataset: 'activityFlags' },
  { no: 24, chapter: 9, fa: 'تقویم‌های کاری بازسازی‌شده', dataset: 'calendars' }, { no: 25, chapter: 9, fa: 'مدت‌های واقعی در برابر برنامه‌ای', dataset: 'durations' }, { no: 26, chapter: 9, fa: 'روش و مدرک مدت‌ها', dataset: 'durationEvidence' },
  { no: 27, chapter: 10, fa: 'روابط پیش‌نیازی شبکه', dataset: 'logic' }, { no: 28, chapter: 10, fa: 'Lag/Leadهای ساختاری', dataset: 'lagLead' }, { no: 29, chapter: 10, fa: 'مبنای بازسازی روابط', dataset: 'relBasis' }, { no: 30, chapter: 10, fa: 'روابط پرچم‌دار (مشکوک/شکسته)', dataset: 'relFlags' },
  { no: 31, chapter: 11, fa: 'مسیرهای بحرانی ثبت‌شده', dataset: 'criticalPaths' }, { no: 32, chapter: 11, fa: 'شناوری فعالیت‌ها در آخرین محاسبه', dataset: 'latestFloats' }, { no: 33, chapter: 11, fa: 'مشخصات محاسبهٔ CPM', dataset: 'durationMeta' },
  { no: 34, chapter: 12, fa: 'مقاطع زمانی (Cut-Off Dates)', dataset: 'snapshots' }, { no: 35, chapter: 12, fa: 'تغییرات مسیر بحرانی در طول زمان', dataset: 'pathChanges' },
  { no: 36, chapter: 13, fa: 'یافته‌های اعتبارسنجی', dataset: 'validations' }, { no: 37, chapter: 13, fa: 'یافته‌ها به تفکیک شدت و نوع', dataset: 'severityMatrix' }, { no: 38, chapter: 13, fa: 'تعیین‌تکلیف یافته‌ها', dataset: 'resolutionState' }, { no: 39, chapter: 13, fa: 'آستانه‌های قاعده‌محور اعتبارسنجی', dataset: 'thresholds' },
  { no: 40, chapter: 14, fa: 'فهرست پروتکل‌های MIP 3.1 تا 3.9', dataset: 'protocols' }, { no: 41, chapter: 14, fa: 'امکان‌سنجی روش‌ها بر اساس دادهٔ موجود', dataset: 'mipAssessment' }, { no: 42, chapter: 14, fa: 'پیش‌نیازهای داده‌ای هر روش', dataset: 'mipPrerequisites' }, { no: 43, chapter: 14, fa: 'روش منتخب کارشناس', dataset: 'mipSelection' },
  { no: 44, chapter: 15, fa: 'پیوند نرم با رویدادهای تأخیر و ادعا', dataset: 'delayClaims' }, { no: 45, chapter: 15, fa: 'تغذیهٔ جداول لایحهٔ ۵۱ جدولی ادعا', dataset: 'docTablesFeed' }, { no: 46, chapter: 15, fa: 'منشأ داده و عدم بازنویسی', dataset: 'provenance' },
  { no: 47, chapter: 16, fa: 'فرضیات', dataset: 'assumptions' }, { no: 48, chapter: 16, fa: 'محدودیت‌ها', dataset: 'limitations' },
  { no: 49, chapter: 17, fa: 'وضعیت تعیین‌تکلیف کارشناسی', dataset: 'expertState' }, { no: 50, chapter: 17, fa: 'تصمیم‌های لازم', dataset: 'decisions' },
  { no: 51, chapter: 18, fa: 'فهرست پیوست‌ها و منابع', dataset: 'annexes' },
];
export const RECON_DOC_TEMPLATE = { chapters: RECON_DOC_CHAPTERS, tables: RECON_DOC_TABLES } as const;

/** Auto-Cleanup خروجی رسمی: حذف راهنمای داخلی، برچسب‌های الزامی/اختیاری، هایلایت زرد و تثبیت فونت B Nazanin. */
export function sanitizeReconDocumentHtml(html: string): string {
  return html
    .replace(/<div class="internal-guide"[\s\S]*?<\/div>/g, '')
    .replace(/<section[^>]*data-internal="true"[\s\S]*?<\/section>/g, '')
    .replace(/<p[^>]*>[^<]*(?:راهنمای داخلی|Internal guide)[^<]*<\/p>/g, '')
    .replace(/\s*[\[(【](الزامی|اختیاری|Required|Optional)[\])】]/g, '')
    .replace(/background(?:-color)?\s*:\s*(?:#ff0(?:000)?|#ffff00|yellow)\s*;?/gi, '')
    .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1')
    .replace(/\sclass="hl"/g, '');
}

type Row = Record<string, unknown>;
const esc = (v: unknown): string => String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const faNum = (v: unknown): string => {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
};
const faDate = (v: unknown): string => {
  const s = String(v ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  return esc(s);
};
const faBool = (v: unknown): string => (v === true ? 'بله' : v === false ? 'خیر' : '—');
const CHECK_FA: Record<string, string> = { negative_float: 'شناوری منفی', open_end: 'انتهای باز', loop: 'حلقهٔ منطقی', lag_abuse: 'سوء‌استفادهٔ Lag', out_of_sequence: 'ترتیب نامتعارف', dangling_logic: 'منطق معلق/شکسته', constraint_abuse: 'سوء‌استفادهٔ قید', missing_calendar: 'فقدان تقویم' };
const SEV_FA: Record<string, string> = { info: 'اطلاع', minor: 'جزئی', major: 'عمده', critical: 'بحرانی' };
const RES_FA: Record<string, string> = { open: 'باز', accepted_risk: 'ریسک پذیرفته‌شده', fixed: 'رفع‌شده', not_applicable: 'مصداق ندارد' };
const FEAS_FA: Record<string, string> = { feasible: 'امکان‌پذیر', partial: 'نیمه‌امکان‌پذیر', not_feasible: 'غیرممکن با دادهٔ فعلی' };
const jsonList = (v: unknown): string => { try { const x = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(x) ? x.join('، ') : String(x ?? '—'); } catch { return String(v ?? '—'); } };

const table = (heads: string[], rows: string[][]): string =>
  `<table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}">—</td></tr>`}</tbody></table>`;

export type ReconDocInput = {
  projectId: string;
  mission: Row;
  children: Record<string, Row[]>;
  format: 'word' | 'pdf';
  generatedAt: string;
  generatedBy?: string;
};

export function buildSchedReconReport(input: ReconDocInput) {
  const issues: string[] = [];
  const m = input.mission;
  if (!m?.Code) issues.push('مأموریت معتبر برای تهیهٔ گزارش انتخاب نشده است');
  const ch = input.children;
  const get = (t: string): Row[] => ch[t] ?? [];
  const extractions = get('PmisSchedReconExtractions');
  const evaluations = get('PmisSchedReconEvaluations');
  const wbsMaps = get('PmisSchedReconWbsMaps');
  const activities = get('PmisSchedReconActivities');
  const calendars = get('PmisSchedReconCalendars');
  const durations = get('PmisSchedReconDurations');
  const logic = get('PmisSchedReconLogic');
  const criticalPaths = get('PmisSchedReconCriticalPaths');
  const snapshots = get('PmisSchedReconSnapshots');
  const validations = get('PmisSchedReconValidations');
  const mipMaps = get('PmisSchedReconMipMappings');
  if (!activities.length) issues.push('برای این مأموریت دیکشنری فعالیت (گام ۵) ثبت نشده است؛ گزارش کارشناسی بدون شبکهٔ بازسازی‌شده صادر نمی‌شود');
  const latestCp = [...criticalPaths].sort((a, b) => String(b.Code ?? '').localeCompare(String(a.Code ?? '')))[0] ?? null;
  let latestFloats: Row[] = [];
  try { latestFloats = latestCp?.DrivingLogic ? (typeof latestCp.DrivingLogic === 'string' ? JSON.parse(String(latestCp.DrivingLogic)) : latestCp.DrivingLogic) as Row[] : []; } catch { latestFloats = []; }
  const selectedMip = mipMaps.find(x => x.SelectedFlag === true) ?? null;
  const EVAL_DEC_FA: Record<string, string> = { pending: 'تعیین‌نشده', repair: 'تعمیر فایل موجود', reconstruction: 'بازسازی از مستندات' };
  const REL_BASIS_FA: Record<string, string> = { file_record: 'سند فایل', inferred_physical: 'استنباط فیزیکی', inferred_documented: 'استنباط مستندی', assumed: 'فرضی' };
  const count = <T>(arr: T[], pred: (x: T) => boolean) => arr.filter(pred).length;

  const D: Record<string, { heads: string[]; rows: string[][] }> = {
    docMeta: { heads: ['مورد', 'مقدار'], rows: [['عنوان سند', 'گزارش کارشناسی بازسازی و تحلیل زمان‌بندی ادعا'], ['شناسهٔ نظام', 'PMO-FORENSIC-SCHEDULE-ENGINE-V1.0'], ['وضعیت سند', 'پیش‌نویس — تا تأیید مسئول مربوط سند نهایی نیست'], ['تاریخ تولید', faDate(input.generatedAt)], ['تولیدکننده', esc(input.generatedBy ?? '—')]] },
    missionCover: { heads: ['مورد', 'مقدار'], rows: [['کد مأموریت', esc(m.Code)], ['عنوان', esc(m.TitleFa)], ['وضعیت مأموریت', esc(m.Status)], ['گام جاری دستورالعمل', faNum(m.CurrentStep) + ' از ۸']] },
    mission: { heads: ['مورد', 'مقدار'], rows: [['کد', esc(m.Code)], ['عنوان', esc(m.TitleFa)], ['بازه ادعا', faDate(m.PeriodFrom) + ' تا ' + faDate(m.PeriodTo)], ['استاندارد تحلیل', esc(m.AnalysisStandard)], ['وضعیت', esc(m.Status)], ['یادداشت کارشناس', esc(m.ExpertNoteFa ?? '—')]] },
    softLinks: { heads: ['نوع پیوند', 'کد'], rows: [['کد ادعا (نرم)', esc(m.ClaimCode ?? '—')], ['رویداد تأخیر (نرم)', esc(m.DelayEventCode ?? '—')], ['کد قرارداد (نرم)', esc(m.ContractCode ?? '—')], ['مرجع فایل‌های زمان‌بندی', esc(m.ScheduleFileRefs ?? '—')]] },
    auditTrail: { heads: ['مورد', 'مقدار'], rows: [['سازندهٔ مأموریت', esc(m.CreatedBy ?? '—')], ['آغاز', faDate(m.StartedAt)], ['تکمیل', faDate(m.CompletedAt)], ['تأییدکنندهٔ تکمیل (≠ سازنده)', esc(m.ApprovedBy ?? '—')]] },
    kpis: { heads: ['شاخص', 'مقدار'], rows: [['تعداد فعالیت‌های بازسازی‌شده', faNum(activities.length)], ['تعداد روابط شبکه', faNum(logic.length)], ['تعداد مقاطع زمانی', faNum(snapshots.length)], ['مسیر بحرانی (آخرین محاسبه)', latestCp ? faNum(latestCp.TotalDuration) + ' روز' : '—'], ['یافته‌های باز اعتبارسنجی', faNum(count(validations, v => v.Resolution === 'open'))], ['روش منتخب MIP', selectedMip ? esc(selectedMip.MipCode) : 'منتخب نشده']] },
    dataInventory: { heads: ['مرحله', 'جدول', 'تعداد'], rows: RECON_STEPS.filter(s => s.n > 1).flatMap(s => s.tables.map(t => [`گام ${s.n}`, esc(t.replace('PmisSchedRecon', '')), faNum(get(t).length)])) },
    readiness: { heads: ['کنترل', 'وضعیت'], rows: [['دیکشنری فعالیت ثبت شده', activities.length ? 'بله' : 'خیر'], ['منطق شبکه ثبت شده', logic.length ? 'بله' : 'خیر'], ['مسیر بحرانی محاسبه شده', criticalPaths.length ? 'بله' : 'خیر'], ['اعتبارسنجی اجرا شده', validations.length ? 'بله' : 'خیر'], ['امکان‌سنجی MIP اجرا شده', mipMaps.length ? 'بله' : 'خیر'], ['وضعیت سند', 'پیش‌نویس']] },
    purpose: { heads: ['هدف داوری/کارشناسی'], rows: [[esc(m.PurposeFa ?? '—')]] },
    periodRange: { heads: ['مورد', 'مقدار'], rows: [['شروع بازه ادعا', faDate(m.PeriodFrom)], ['پایان بازه ادعا', faDate(m.PeriodTo)], ['فاصلهٔ تقویمی بازه (روز)', (() => { const a = Date.parse(faDate(m.PeriodFrom)), b = Date.parse(faDate(m.PeriodTo)); return Number.isFinite(a) && Number.isFinite(b) ? faNum(Math.round((b - a) / 86400000) + 1) : '—'; })()]] },
    standards: { heads: ['استاندارد', 'نقش در این پرونده'], rows: [['AACE International Recommended Practice 29R-03 (Forensic Schedule Analysis)', 'رده‌بندی روش تحلیل در قالب MIP 3.1 تا 3.9 — داده‌محور'], ['SCL Delay and Disruption Protocol (ویرایش دوم)', 'چارچوب مستندسازی رویدادها و سببیت'], ['بخشنامه‌های ۱۳۰۰ و ۵۰۹۰', 'مبنای محاسبه در موتور تحلیل تأخیر (ماژول جداگانه)؛ این سند هیچ مدت تمدیدی محاسبه نمی‌کند']] },
    extractions: { heads: ['#', 'کد', 'نوع سند', 'تاریخ رویداد', 'بازه', 'مرجع', 'وضعیت'], rows: extractions.map((e, i) => [String(i + 1), esc(e.Code), esc(e.DocType), faDate(e.EventDate), faDate(e.PeriodFrom) + ' تا ' + faDate(e.PeriodTo), esc(e.SourceRef ?? e.DocumentId ?? '—'), esc(e.Status)]) },
    extractionVerification: { heads: ['#', 'کد', 'احرازشده', 'احرازکننده'], rows: extractions.map((e, i) => [String(i + 1), esc(e.Code), e.Status === 'verified' ? 'بله' : 'خیر', esc(e.VerifiedBy ?? '—')]) },
    docKinds: { heads: ['نوع سند', 'تعداد'], rows: [...new Set(extractions.map(e => String(e.DocType)))].map(k => [esc(k), faNum(count(extractions, e => String(e.DocType) === k))]) },
    evaluations: { heads: ['#', 'کد', 'نوع فایل', 'تاریخ مبنا/داده', 'کلاس آسیب', 'تصمیم', 'وضعیت'], rows: evaluations.map((e, i) => [String(i + 1), esc(e.Code), esc(e.FileKind), faDate(e.BaselineDate) + ' / ' + faDate(e.DataDate), esc(e.DamageClass ?? '—'), esc(EVAL_DEC_FA[String(e.Decision)] ?? e.Decision), esc(e.Status)]) },
    damageMetrics: { heads: ['شاخص فایل', 'مقدار (آخرین ارزیابی تأییدشده/آخرین)'], rows: (() => { const e = [...evaluations].sort((a, b) => String(b.EvaluatedAt ?? '').localeCompare(String(a.EvaluatedAt ?? '')))[0]; return e ? [['تعداد فعالیت‌ها', faNum(e.ActivityCount)], ['تعداد روابط', faNum(e.RelationshipCount)], ['انتهای باز', faNum(e.OpenEndsCount)], ['شناوری منفی', faNum(e.NegativeFloatCount)], ['حلقه', faNum(e.LoopCount)], ['خارج از ترتیب', faNum(e.OutOfSequenceCount)], ['فقدان تقویم', faNum(e.MissingCalendarCount)]] : []; })() },
    decision: { heads: ['تصمیم', 'دلیل', 'وضعیت تأیید'], rows: evaluations.filter(e => e.Decision && e.Decision !== 'pending').map(e => [esc(EVAL_DEC_FA[String(e.Decision)] ?? e.Decision), esc(e.DecisionReasonFa ?? '—'), esc(e.Status)]) },
    wbsMaps: { heads: ['#', 'کد', 'WBS مصوب', 'WBS واقعیت', 'نوع نگاشت', 'اطمینان', 'وضعیت'], rows: wbsMaps.map((w, i) => [String(i + 1), esc(w.Code), esc(w.BaselineWbsCode) + (w.BaselineWbsTitleFa ? ' — ' + esc(w.BaselineWbsTitleFa) : ''), esc(w.ActualWbsCode ?? '—'), esc(w.MapKind), faNum(w.Confidence), esc(w.Status)]) },
    wbsKinds: { heads: ['نوع نگاشت', 'تعداد'], rows: [...new Set(wbsMaps.map(w => String(w.MapKind)))].map(k => [esc(k), faNum(count(wbsMaps, w => String(w.MapKind) === k))]) },
    wbsStatus: { heads: ['وضعیت', 'تعداد'], rows: [['تأییدشده (confirmed)', faNum(count(wbsMaps, w => w.Status === 'confirmed'))], ['پیش‌نویس', faNum(count(wbsMaps, w => w.Status !== 'confirmed'))]] },
    activities: { heads: ['#', 'کد', 'عنوان', 'نوع', 'مدت اصلی', 'مدت واقعی', 'پیشرفت٪', 'پرچم'], rows: activities.map((a, i) => [String(i + 1), esc(a.Code), esc(a.TitleFa), esc(a.ActivityType ?? 'task'), faNum(a.OriginalDuration), faNum(a.ActualDuration), faNum(a.PctComplete), esc(a.StatusFlag)]) },
    activityDates: { heads: ['#', 'کد', 'شروع/پایان برنامه‌ای', 'شروع/پایان واقعی'], rows: activities.map((a, i) => [String(i + 1), esc(a.Code), faDate(a.PlannedStart) + ' → ' + faDate(a.PlannedFinish), faDate(a.ActualStart) + ' → ' + faDate(a.ActualFinish)]) },
    activityFlags: { heads: ['پرچم وضعیت', 'تعداد'], rows: [...new Set(activities.map(a => String(a.StatusFlag ?? 'not_started')))].map(k => [esc(k), faNum(count(activities, a => String(a.StatusFlag ?? 'not_started') === k))]) },
    calendars: { heads: ['#', 'کد', 'نام', 'نوع', 'روز/هفته', 'ساعت/روز', 'اعتبار', 'وضعیت'], rows: calendars.map((c, i) => [String(i + 1), esc(c.Code), esc(c.NameFa), esc(c.BaseKind), faNum(c.DaysPerWeek), faNum(c.HoursPerDay), faDate(c.ValidFrom) + ' → ' + faDate(c.ValidTo), esc(c.Status)]) },
    durations: { heads: ['#', 'فعالیت', 'برنامه‌ای', 'مشاهده‌شده', 'انحراف', 'روش', 'وضعیت'], rows: durations.map((d, i) => [String(i + 1), esc(d.ActivityCode), faNum(d.PlannedDuration), faNum(d.ObservedDuration), faNum(d.Deviation), esc(d.Method), esc(d.Status)]) },
    durationEvidence: { heads: ['#', 'فعالیت', 'مدارک مدت'], rows: durations.map((d, i) => [String(i + 1), esc(d.ActivityCode), jsonList(d.EvidenceRefs)]) },
    logic: { heads: ['#', 'کد', 'پیش‌نیاز', 'رابطه', 'پس‌نیاز', 'Lag', 'مبنا', 'پرچم'], rows: logic.map((l, i) => [String(i + 1), esc(l.Code), esc(l.PredecessorCode), esc(l.RelType), esc(l.SuccessorCode), faNum(l.Lag) + (l.LagUnit ? ' ' + esc(l.LagUnit) : ''), esc(REL_BASIS_FA[String(l.ReconstructionBasis)] ?? l.ReconstructionBasis), esc(l.Flag)]) },
    lagLead: { heads: ['#', 'رابطه', 'Lag/Lead', 'واحد'], rows: logic.filter(l => Number(l.Lag ?? 0) !== 0).map((l, i) => [String(i + 1), esc(l.PredecessorCode) + '→' + esc(l.SuccessorCode), faNum(l.Lag), esc(l.LagUnit ?? 'd')]) },
    relBasis: { heads: ['مبنای بازسازی', 'تعداد روابط'], rows: [...new Set(logic.map(l => String(l.ReconstructionBasis)))].map(k => [esc(REL_BASIS_FA[k] ?? k), faNum(count(logic, l => String(l.ReconstructionBasis) === k))]) },
    relFlags: { heads: ['#', 'کد رابطه', 'پرچم', 'یادداشت'], rows: logic.filter(l => l.Flag && l.Flag !== 'normal').map((l, i) => [String(i + 1), esc(l.Code), esc(l.Flag), esc(l.NoteFa ?? '—')]) },
    criticalPaths: { heads: ['#', 'کد', 'مقطع', 'رتبه', 'مدت مسیر', 'تغییر نسبت به قبل', 'فعالیت‌های بحرانی'], rows: criticalPaths.map((p, i) => [String(i + 1), esc(p.Code), esc(p.SnapshotCode ?? '—'), faNum(p.PathRank), faNum(p.TotalDuration), esc(p.ChangeKind ?? '—'), jsonList(p.ActivityCodes)]) },
    latestFloats: { heads: ['فعالیت', 'مدت', 'ES', 'EF', 'شناوری کل', 'بحرانی'], rows: latestFloats.map(f => [esc(f.code), faNum(f.duration), faNum(f.es), faNum(f.ef), faNum(f.float), faBool(f.critical)]) },
    durationMeta: { heads: ['مورد', 'مقدار'], rows: [['موتور محاسبه', 'CriticalPathReconstructionEngine — CPM دوگره‌ای با FS/SS/FF/SF و Lag'], ['وضعیت خروجی', latestCp ? 'پیش‌نویس محاسباتی — نیازمند تأیید کارشناس' : 'محاسبه نشده'], ['مقطع مقایسه', esc(latestCp?.SnapshotCode ?? '—')], ['تعداد فعالیت‌های بحرانی', faNum(count(latestFloats, f => f.critical === true))]] },
    snapshots: { heads: ['#', 'کد', 'عنوان', 'تاریخ قطع', 'نوع', 'وضعیت'], rows: snapshots.map((s, i) => [String(i + 1), esc(s.Code), esc(s.LabelFa), faDate(s.CutoffDate), esc(s.DataKind ?? '—'), esc(s.Status)]) },
    pathChanges: { heads: ['#', 'مسیر', 'مقطع', 'نوع تغییر'], rows: criticalPaths.map((p, i) => [String(i + 1), esc(p.Code), esc(p.SnapshotCode ?? '—'), esc(p.ChangeKind ?? '—')]) },
    validations: { heads: ['#', 'کد', 'نوع کنترل', 'شدت', 'فعالیت', 'شرح', 'تشخیص', 'تعیین‌تکلیف'], rows: validations.map((v, i) => [String(i + 1), esc(v.Code), esc(CHECK_FA[String(v.CheckKind)] ?? v.CheckKind), esc(SEV_FA[String(v.Severity)] ?? v.Severity), esc(v.ActivityCode ?? '—'), esc(v.DetailFa), v.AutoDetected ? 'خودکار' : 'کارشناس', esc(RES_FA[String(v.Resolution)] ?? v.Resolution)]) },
    severityMatrix: { heads: ['نوع کنترل', 'اطلاع', 'جزئی', 'عمده', 'بحرانی'], rows: Object.keys(CHECK_FA).map(k => [esc(CHECK_FA[k]), faNum(count(validations, v => v.CheckKind === k && v.Severity === 'info')), faNum(count(validations, v => v.CheckKind === k && v.Severity === 'minor')), faNum(count(validations, v => v.CheckKind === k && v.Severity === 'major')), faNum(count(validations, v => v.CheckKind === k && v.Severity === 'critical'))]) },
    resolutionState: { heads: ['تعیین‌تکلیف', 'تعداد'], rows: Object.keys(RES_FA).map(k => [esc(RES_FA[k]), faNum(count(validations, v => String(v.Resolution) === k))]) },
    thresholds: { heads: ['آستانهٔ قاعده‌محور', 'مقدار'], rows: [['سقف کسری Lag از مدت پیش‌نیاز', faNum(NETWORK_VALIDATION_THRESHOLDS.lagFractionOfPredDuration)], ['سقف مطلق Lag (روز)', faNum(NETWORK_VALIDATION_THRESHOLDS.lagAbsoluteLimitDays)], ['منطق', 'آستانه‌ها شفاف و بازبینی‌پذیرند و در کد موتور ثابت‌اند؛ تغییر آن‌ها مستندسازی می‌خواهد']] },
    protocols: { heads: ['کد', 'خانواده', 'منطق', 'واحد تحلیل', 'نام رایج', 'شرح'], rows: MIP_PROTOCOLS.map(p => [esc(p.code), esc(p.family === 'observational' ? 'مشاهده‌ای' : 'مدل‌سازی'), esc(p.logicTreatment), esc(p.unitOfAnalysis === 'gross' ? 'کلی' : 'دوره‌ای'), esc(p.commonNameEn ?? '—'), esc(p.titleFa)]) },
    mipAssessment: { heads: ['کد', 'خانواده', 'امکان‌سنجی', 'دلیل'], rows: mipMaps.map(a => [esc(a.MipCode), esc(a.Family ?? '—'), esc(FEAS_FA[String(a.Feasibility)] ?? '—'), esc(a.FeasibilityReasonFa ?? '—')]) },
    mipPrerequisites: { heads: ['کد', 'پیش‌نیازهای موردنیاز', 'موجود در پرونده'], rows: mipMaps.map(a => [esc(a.MipCode), jsonList(a.RequiredDataJson), jsonList(a.ProvidedDataJson)]) },
    mipSelection: { heads: ['روش منتخب', 'انتخاب‌کننده', 'تاریخ انتخاب'], rows: selectedMip ? [[esc(selectedMip.MipCode) + (mipProtocolByCode(String(selectedMip.MipCode) as never)?.commonNameEn ? ' — ' + esc(mipProtocolByCode(String(selectedMip.MipCode) as never)!.commonNameEn) : ''), esc(selectedMip.SelectedBy ?? '—'), faDate(selectedMip.SelectedAt)]] : [['هنوز روشی توسط کارشناس انتخاب نشده است', '—', '—']] },
    delayClaims: { heads: ['پیوند', 'کد', 'نوع'], rows: [['ادعای مرتبط', esc(m.ClaimCode ?? '—'), 'نرم'], ['رویداد تأخیر مرتبط', esc(m.DelayEventCode ?? '—'), 'نرم'], ['قرارداد مرجع', esc(m.ContractCode ?? '—'), 'نرم']] },
    docTablesFeed: { heads: ['مورد', 'شرح'], rows: [['محدودهٔ جداول لایحهٔ ادعا که از این موتور تغذیه می‌شود', `جداول ${CLAIM_DOC_SCHEDULE_TABLE_RANGE.from} تا ${CLAIM_DOC_SCHEDULE_TABLE_RANGE.to} موتور خروجی ۵۱ جدولی ادعا`], ['ماهیت تغذیه', 'خواندنی و نرم: لایحهٔ ادعا خروجی تأییدشدهٔ کارشناس این پرونده را به‌عنوان «زمان‌بندی بازسازی‌شده» نقل می‌کند'], ['سقف مسئولیت', 'این سند هیچ مبلغ خسارت یا مدت تمدید محاسبه نمی‌کند؛ تمدید مدت فقط در موتور تأخیرات (۱۳۰۰/۵۰۹۰) و مبلغ فقط در موتور خسارات محاسبه می‌شود']] },
    provenance: { heads: ['اصل', 'شرح'], rows: [['تک‌منبعی', 'همهٔ داده‌ها از جدول‌های اختصاصی PmisSchedRecon همین مأموریت خوانده شده‌اند'], ['عدم بازنویسی', 'هیچ داده‌ای از برنامهٔ مصوب، ادعا یا پرونده‌های دیگر در این گزارش بازنویسی نشده است'], ['پیوند نرم', 'ارجاع به سایر ماژول‌ها فقط با کد/شناسه است']] },
    assumptions: { heads: ['فرض'], rows: [['واحد محاسبهٔ CPM «روز» است و اثر تقویم‌های پویا در این نسخه با تأیید کارشناس کنترل می‌شود'], ['روابط با مبنای «فرضی» (assumed) تا استناد مدرک، ضعیف‌ترین حلقهٔ استدلال‌اند'], ['قت تاریخ‌دار واقعی در صورت عدم ثبت، «—» گزارش می‌شود و درون‌یابی نمی‌شود مگر با روش مستند']] },
    limitations: { heads: ['محدودیت'], rows: [['خروجی‌های موتور «پیش‌نویس محاسباتی»‌اند و بدون تأیید کارشناس قطعی نیستند'], ['این سند مبلغ خسارت یا مدت تمدید محاسبه نمی‌کند و نباید مبنای آن‌ها قرار گیرد'], ['بخشنامهٔ ۱۳۰۰ به‌تنهایی مبنای تمدید نیست؛ تصمیم تمدید فقط در ماژول تأخیرات'], ['یافته‌های خودکار اعتبارسنجی تا تعیین‌تکلیف کارشناس «باز» باقی می‌مانند']] },
    expertState: { heads: ['مورد', 'مقدار'], rows: [['یافته‌های باز', faNum(count(validations, v => v.Resolution === 'open'))], ['یافته‌های رفع‌شده', faNum(count(validations, v => v.Resolution === 'fixed'))], ['روش منتخب MIP', selectedMip ? esc(selectedMip.MipCode) : '—'], ['تکمیل مأموریت', m.Status === 'completed' ? `تأییدشده توسط ${esc(m.ApprovedBy)} در ${faDate(m.CompletedAt)}` : 'در جریان — تکمیل با تأیید مستقل (≠ سازنده)']] },
    decisions: { heads: ['تصمیم لازم'], rows: [['تعیین‌تکلیف یافته‌های باز اعتبارسنجی (رفع/پذیرش ریسک/مصداق ندارد)'], ['انتخاب و ثبت روش نهایی تحلیل (MIP) توسط کارشناس'], ['تأیید صحت روابط با مبنای «فرضی» پیش از استناد در لایحهٔ ادعا'], ['تأیید نهایی این پیش‌نویس توسط مسئول مربوط پیش از صدور رسمی']] },
    annexes: { heads: ['پیوست', 'منبع'], rows: [['کاتالوگ پروتکل‌های MIP (فصل ۱۴)', 'AACE 29R-03'], ['آستانه‌های اعتبارسنجی (فصل ۱۳)', NETWORK_VALIDATION_THRESHOLDS.lagAbsoluteLimitDays + ' روز'], ['منبع متدولوژی', 'مدیر ادعا | Claim Manager — claimanager.ir']] },
  };

  const chapterIntro: Record<number, string> = {
    3: 'این گزارش بر مبنای داده‌های واقعی مأموریت تولید شده است؛ هرجا داده یا تأیید کافی نباشد «—» درج شده و عددی حدس زده نشده است.',
    11: 'مسیر بحرانی گزارش‌شده حاصل محاسبهٔ CPM روی شبکهٔ بازسازی‌شده است و تا تأیید کارشناس «پیش‌نویس محاسباتی» محسوب می‌شود.',
    14: 'امکان‌سنجی روش‌ها صرفاً بر اساس موجودیت واقعی دادهٔ پرونده است؛ انتخاب نهایی روش (MIP) فقط با کارشناس است.',
    15: 'این گزارش زمان‌بندی بازسازی‌شده را برای تغذیهٔ جداول ۱۱ تا ۲۵ لایحهٔ ادعا آماده می‌کند و هرگز مبلغ یا مدت تمدید تولید نمی‌کند.',
    17: 'نتیجهٔ بررسی کارشناسی پس از تأیید مسئول مربوط در سامانه ثبت می‌شود؛ این سند تا آن زمان پیش‌نویس است.',
  };

  const parts: string[] = [];
  for (const chapter of RECON_DOC_CHAPTERS) {
    const tables = RECON_DOC_TABLES.filter(t => t.chapter === chapter.no);
    const body = [
      chapter.no === 1 ? `<div class="cover"><h1>گزارش کارشناسی بازسازی و تحلیل زمان‌بندی ادعا</h1><p>مأموریت: <b>${esc(m.Code)}</b> — ${esc(m.TitleFa)}</p><p>وضعیت سند: <b>پیش‌نویس</b></p></div>` : '',
      chapterIntro[chapter.no] ? `<p>${esc(chapterIntro[chapter.no])}</p>` : '',
      ...tables.map(t => `<h3>جدول ${t.no} ـ ${esc(t.fa)} [الزامی]</h3>` + table(D[t.dataset]?.heads ?? ['مورد'], D[t.dataset]?.rows ?? [])),
    ].join('\n');
    parts.push(`<h2>فصل ${chapter.no} ـ ${esc(chapter.fa)}</h2>${body}`);
  }
  // راهنمای داخلی تولید سند؛ در خروجی رسمی با Auto-Cleanup حذف می‌شود.
  parts.push('<section data-internal="true"><h2>راهنمای داخلی تنظیم گزارش</h2><p>راهنمای داخلی: این بخش فقط برای تنظیم‌کننده است و نباید در نسخهٔ صادرشده بماند. [اختیاری]</p></section>');

  const rawBody = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="fa">
<head><meta charset="utf-8"><title>گزارش بازسازی زمان‌بندی ${esc(m.Code)}</title>
<style>@page{size:A4;margin:18mm}body{font-family:'B Nazanin',Tahoma,sans-serif;font-size:12pt;line-height:1.9;color:#111}h1{font-size:19pt}h2{font-size:14pt;border-bottom:2px solid #1f4e79;padding-bottom:4px;margin-top:22px}h3{font-size:12pt;color:#1f4e79}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #666;padding:5px 7px;font-size:10.5pt;text-align:right;vertical-align:top}th{background:#dbe7f3}.cover{border:2px solid #1f4e79;padding:24px;text-align:center;margin-top:60px}</style></head>
<body>${parts.join('\n')}</body></html>`;

  const finalize = (html: string): string => sanitizeReconDocumentHtml(
    html.replace('</head>', `<style>body{font-family:'B Nazanin',Tahoma,sans-serif}table td,table th{font-family:inherit}</style></head>`),
  );
  return { body: finalize(rawBody), issues, filename: `SchedRecon-${String(m.Code ?? 'mission')}.${input.format === 'pdf' ? 'html' : 'doc'}`, contentType: 'application/msword; charset=utf-8' };
}
