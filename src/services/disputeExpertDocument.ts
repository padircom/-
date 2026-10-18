/**
 * ExpertReportGenerationService — گزارش کارشناسی موضوع اختلاف ساخت.
 * استاندارد سند: دقیقاً ۲۰ فصل (REPORT_SECTIONS) و ۳۴ جدول در ساختار کامل.
 * Auto-Cleanup هنگام صدور: صفحات/بخش‌های راهنمای داخلی حذف، برچسب‌های
 * «الزامی/اختیاری» پاک، هایلایت‌های زرد شفاف و فونت رسمی B Nazanin اعمال می‌شود.
 * هر نسخه تا صدور (issued) «پیش‌نویس» است؛ دادهٔ ناقص «—» چاپ می‌شود و هیچ
 * ابزار/خلاصه‌ای بدون منبع در جدول‌ها ثبت و عددی حدس زده نمی‌شود. هیچ مادهٔ
 * قانونی/رأیی فراتر از رکوردهای پرونده درج نمی‌شود؛ صدور رأی در صلاحیت نیست.
 * الگو: src/services/claimLossDocument.ts (۱۸/۵۱) — ساختار اینجا ۲۰/۳۴ است.
 */
import {
  REPORT_SECTIONS, REPORT_SECTION_FA, CASE_STATUS_FA,
  disputeSubjectFa, partyRoleFa, claimBasisFa, LINK_KIND_FA,
  ANALYSIS_APPROVAL_FA, HEARING_MINUTES_FA,
  OPINION_REVIEW_FA, REPORT_STATUS_FA,
  type AnalysisFinding, type CaseStatus,
} from './disputeExpert';

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

/** فصل‌بندی رسمی گزارش کارشناسی — دقیقاً ۲۰ فصل، ممیز‌شده با REPORT_SECTIONS. */
export const DISPUTE_REPORT_CHAPTERS: { no: number; key: (typeof REPORT_SECTIONS)[number]; fa: string }[] =
  REPORT_SECTIONS.map((key, i) => ({ no: i + 1, key, fa: REPORT_SECTION_FA[key] }));

/* ── فهرست استاندارد ۳۴ جدول سند (chapter = شمارهٔ فصل بالا) ── */
export const DISPUTE_REPORT_TABLES: { no: number; chapter: number; fa: string; dataset: string }[] = [
  { no: 1, chapter: 1, fa: 'مشخصات سند', dataset: 'docMeta' }, { no: 2, chapter: 1, fa: 'مشخصات پرونده', dataset: 'caseIdentity' },
  { no: 3, chapter: 2, fa: 'مرجع ارجاع و حدود مأموریت', dataset: 'referral' },
  { no: 4, chapter: 3, fa: 'فهرست طرفین', dataset: 'partiesTable' }, { no: 5, chapter: 3, fa: 'پیوندهای ادعای ثبت‌شده برای طرفین', dataset: 'partyNoteTable' },
  { no: 6, chapter: 4, fa: 'شرح موضوع اختلاف', dataset: 'subjectInfo' }, { no: 7, chapter: 4, fa: 'شرح خواسته‌ها', dataset: 'claimStatement' },
  { no: 8, chapter: 5, fa: 'پرسش‌های موضوع ارجاع/کارشناسی', dataset: 'expertQuestions' }, { no: 9, chapter: 5, fa: 'پرسش‌های مطرح در جلسات', dataset: 'hearingQuestions' },
  { no: 10, chapter: 6, fa: 'فهرست اسناد بررسی‌شده', dataset: 'evidenceTable' },
  { no: 11, chapter: 7, fa: 'فهرست ادعاها', dataset: 'claimsTable' }, { no: 12, chapter: 7, fa: 'پاسخ‌ها و دفاعیات طرفین', dataset: 'responsesTable' },
  { no: 13, chapter: 8, fa: 'ارجاعات قراردادی/قانونی ثبت‌شده', dataset: 'clauseRefs' }, { no: 14, chapter: 8, fa: 'بیانیهٔ صداقت منابع', dataset: 'legalHonesty' },
  { no: 15, chapter: 9, fa: 'روش بررسی', dataset: 'methodsTable' }, { no: 16, chapter: 9, fa: 'مفروضات', dataset: 'assumptionsTable' },
  { no: 17, chapter: 10, fa: 'یافته‌های تحلیل' , dataset: 'analysesTable' },
  { no: 18, chapter: 11, fa: 'ارجاعات/پیوندهای زمانی', dataset: 'delayRefsTable' }, { no: 19, chapter: 11, fa: 'مدت‌های مطالبه‌شده', dataset: 'delayDaysTable' },
  { no: 20, chapter: 12, fa: 'لایه‌های سه‌گانهٔ مبالغ ادعاها', dataset: 'amountLayers' }, { no: 21, chapter: 12, fa: 'جمع مبالغ پرونده', dataset: 'totalsTable' },
  { no: 22, chapter: 13, fa: 'وضعیت اصالت اسناد', dataset: 'authenticityTable' }, { no: 23, chapter: 13, fa: 'ارزیابی کفایت اسناد', dataset: 'sufficiencyTable' },
  { no: 24, chapter: 14, fa: 'محاسبات مستقل کارشناسی (مقایسه)', dataset: 'calcTable' },
  { no: 25, chapter: 15, fa: 'موارد توافق/اختلاف طرفین (بر اساس پاسخ‌ها)', dataset: 'agreementsTable' }, { no: 26, chapter: 15, fa: 'پیوندهای ماژولی', dataset: 'linksSummary' },
  { no: 27, chapter: 16, fa: 'محدودیت‌ها و عدم‌قطعیت‌ها', dataset: 'uncertaintiesTable' }, { no: 28, chapter: 16, fa: 'اطلاعات ناقص/شکاف‌ها', dataset: 'gapsTable' },
  { no: 29, chapter: 17, fa: 'پاسخ مستدل به پرسش‌ها', dataset: 'answersTable' },
  { no: 30, chapter: 18, fa: 'جمع‌بندی کارشناسی (پیش‌نویس)', dataset: 'conclusionTable' }, { no: 31, chapter: 18, fa: 'وضعیت کنترل کیفیت/تأیید تحلیل‌ها', dataset: 'reviewStatusTable' },
  { no: 32, chapter: 19, fa: 'منابع پیوست (پیوندهای مرجع)', dataset: 'linksTable' }, { no: 33, chapter: 19, fa: 'زنجیرهٔ نسخه‌های همین گزارش', dataset: 'versionTable' },
  { no: 34, chapter: 20, fa: 'تهیه‌کننده، بازبین و صادرکننده', dataset: 'creatorsTable' },
];

/** Auto-Cleanup خروجی رسمی — همان قاعدهٔ الگوی لایحهٔ خسارت. */
export function sanitizeExpertReportHtml(html: string): string {
  return html
    .replace(/<div class="internal-guide"[\s\S]*?<\/div>/g, '')
    .replace(/<section[^>]*data-internal="true"[\s\S]*?<\/section>/g, '')
    .replace(/<p[^>]*>[^<]*(?:راهنمای داخلی|Internal guide)[^<]*<\/p>/g, '')
    .replace(/\s*[\[(【](الزامی|اختیاری|Required|Optional)[\])】]/g, '')
    .replace(/background(?:-color)?\s*:\s*(?:#ff0(?:000)?|#ffff00|yellow)\s*;?/gi, '')
    .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1')
    .replace(/\sclass="hl"/g, '');
}

export type ExpertReportInput = {
  projectId: string; projectTitleFa?: string | null;
  caseRow: Row; parties: Row[]; claims: Row[]; responses: Row[]; evidence: Row[];
  analyses: Row[]; calculations: Row[]; hearings: Row[]; opinions: Row[];
  links: Row[]; deadlines: Row[]; reportRow: Row; reportVersions: Row[];
  generatedAt: string; generatedBy: string; format: 'word' | 'pdf';
};

export function buildExpertReport(input: ExpertReportInput) {
  const issues: string[] = [];
  const c = input.caseRow;
  if (!c?.Code) issues.push('پروندهٔ معتبری برای ساخت گزارش انتخاب نشده است');
  const cds = (field: string) => {
    const v = c[field];
    return v === null || v === undefined || v === '' ? '—' : esc(String(v));
  };
  const enabled = ((): string[] => {
    const arr = input.reportRow?.EnabledSectionsJson;
    if (Array.isArray(arr) && arr.length && arr.every(x => typeof x === 'string')) return arr as string[];
    return [...REPORT_SECTIONS];
  })();
  const analyses = input.analyses;
  const summaryAnalysis = analyses.find((a) => String(a.Code) === 'ANA-SUMMARY');
  /* یافته‌های ساختاریافتهٔ آخرین تحلیل‌ها — فقط داخل گزارش؛ عین منطق قاعده‌محور */
  const findingsOf = (a: Row | undefined): AnalysisFinding[] => {
    const f = (a?.InputDataJson as Row | undefined)?.findings;
    return Array.isArray(f) ? (f as AnalysisFinding[]) : [];
  };
  const agreements = input.responses.filter((r) => ['accepted', 'partial'].includes(String(r.Verdict ?? '')));
  const disagreements = input.responses.filter((r) => String(r.Verdict ?? '') === 'rejected');
  const delayLinks = input.links.filter((l) => String(l.LinkKind) === 'delay_case');
  const lossLinks = input.links.filter((l) => String(l.LinkKind) === 'loss_case');
  const riskLinks = input.links.filter((l) => String(l.LinkKind) === 'contract_risk');
  const edmsLinks = input.links.filter((l) => String(l.LinkKind) === 'edms_document');
  const calcRows = input.calculations.filter((x) => String(x.Status ?? '') !== 'superseded');

  const layerRow = (cl: Row) => [
    esc(cl.Code), esc(cl.TitleFa), esc(cl.ClaimantPartyCode),
    faNum(cl.ClaimedAmount), faNum(cl.ReviewedAmount), faNum(cl.ApprovedAmount),
  ];
  const D: Record<string, { heads: string[]; rows: string[][] }> = {
    docMeta: { heads: ['مورد', 'مقدار'], rows: [['عنوان سند', 'گزارش کارشناسی موضوع اختلاف ساخت'], ['وضعیت سند', esc(REPORT_STATUS_FA[String(input.reportRow?.Status ?? 'draft')] ?? 'پیش‌نویس')], ['نسخهٔ گزارش', faNum(input.reportRow?.Version)], ['تاریخ تولید', faDateTime(input.generatedAt)], ['تولیدکننده', esc(input.generatedBy ?? '—')], ['نسخهٔ داده', esc(String(input.reportRow?.DataVersionNoteFa ?? '—'))]] },
    caseIdentity: { heads: ['مورد', 'مقدار'], rows: [['کد پرونده', esc(c.Code)], ['عنوان پرونده', esc(c.TitleFa)], ['پروژه', esc(input.projectTitleFa ?? input.projectId)], ['کد پروژه', esc(input.projectId)], ['وضعیت پرونده', esc(CASE_STATUS_FA[String(c.Status) as CaseStatus] ?? c.Status)]] },
    referral: { heads: ['مورد', 'مقدار'], rows: [['مرجع ارجاع/رسیدگی', cds('CourtRefFa')], ['حدود مأموریت کارشناسی', cds('ExpertScopeFa')], ['تاریخ ثبت', faDate(c.RegistrationDate)], ['مهلت پاسخ', faDate(c.ResponseDeadline)], ['مهلت تحویل', faDate(c.DeliveryDeadline)], ['مالک داخلی', cds('InternalOwnerFa')]] },
    partiesTable: { heads: ['#', 'کد', 'نقش', 'نام', 'نماینده'], rows: input.parties.map((p, i) => [String(i + 1), esc(p.Code), esc(partyRoleFa(String(p.Role ?? ''))), esc(p.NameFa), esc(p.RepresentativeFa)]) },
    partyNoteTable: { heads: ['#', 'طرف', 'یادداشت پیوند ادعا'], rows: input.parties.map((p, i) => [String(i + 1), esc(p.NameFa), esc(p.ClaimLinkNoteFa)]) },
    subjectInfo: { heads: ['مورد', 'شرح'], rows: [['موضوع اختلاف', esc(disputeSubjectFa(String(c.SubjectCode ?? '')))], ['شرح موضوع', cds('DescriptionFa')], ['تاریخ رویداد', faDate(c.IncidentDate)], ['کد قرارداد', cds('ContractCode')], ['کد ادعای مرجع', cds('ClaimCode')]] },
    claimStatement: { heads: ['مورد', 'شرح'], rows: [['شرح خواسته‌ها', cds('ClaimDescriptionFa')], ['مبلغ مورد مطالبه', faNum(c.ClaimedAmount)], ['ارز', cds('Currency')], ['مدت مطالبه‌شده (روز)', faNum(c.ClaimedDelayDays)]] },
    expertQuestions: { heads: ['#', 'پرسش کارشناسی (از تحلیل‌های ثبت‌شده)', 'کد تحلیل'], rows: analyses.map((a, i) => [String(i + 1), esc(a.QuestionFa ?? '—'), esc(a.Code)]) },
    hearingQuestions: { heads: ['#', 'جلسه', 'عنوان جلسه', 'پرسش‌های مطرح‌شده', 'وضعیت صورت‌جلسه'], rows: input.hearings.map((h, i) => [String(i + 1), esc(h.Code), esc(h.TitleFa), escLines(Array.isArray(h.QuestionsJson) ? (h.QuestionsJson as unknown[]).map(x => String(x)).join('\n') : (h.QuestionsJson ?? '—')), esc(HEARING_MINUTES_FA[String(h.MinutesStatus ?? 'draft')] ?? h.MinutesStatus)]) },
    evidenceTable: { heads: ['#', 'کد', 'نوع', 'عنوان', 'شماره/نسخه', 'اصالت', 'کفایت', 'تاریخ دریافت'], rows: input.evidence.map((e, i) => [String(i + 1), esc(e.Code), esc(e.DocType), esc(e.TitleFa), esc(e.DocNo ?? '—') + (e.Revision ? '/' + esc(e.Revision) : ''), esc(e.AuthenticityStatus ?? 'pending'), esc(e.SufficiencyStatus ?? 'unchecked'), faDate(e.ReceivedAt)]) },
    claimsTable: { heads: ['#', 'کد', 'عنوان', 'مدعی', 'مبنا', 'مدت (روز)', 'مبلغ', 'بند قرارداد'], rows: input.claims.map((cl, i) => [String(i + 1), esc(cl.Code), esc(cl.TitleFa), esc(cl.ClaimantPartyCode), esc(claimBasisFa(String(cl.BasisKind ?? ''))), faNum(cl.ClaimedDelayDays), faNum(cl.ClaimedAmount), esc(cl.ContractClauseRef ?? '—')]) },
    responsesTable: { heads: ['#', 'ادعا', 'پاسخگو', 'پاسخ', 'رأی طرف', 'تاریخ دریافت'], rows: input.responses.map((r, i) => [String(i + 1), esc(r.ClaimCode), esc(r.ResponderPartyCode), escLines(r.BodyFa), esc(r.Verdict ?? '—'), faDate(r.ReceivedAt)]) },
    clauseRefs: { heads: ['#', 'بند/منبع', 'مرجع ثبت‌شدهٔ مرتبط'], rows: [...new Set([...input.claims.map(x => String(x.ContractClauseRef ?? '')), ...input.evidence.map(x => String(x.ContractClauseRef ?? ''))].filter(Boolean))].map((ref, i) => [String(i + 1), esc(ref), 'از رکوردهای ادعا/مستندات استخراج شد — احراز متن بند با کارشناس است']) },
    legalHonesty: { heads: ['بیانیه'], rows: [['هیچ مادهٔ قانونی، رأی دادگاه، نظریهٔ فقهی یا منبع کتابخانه‌ای فراتر از آنچه کاربران در پرونده ثبت کرده‌اند در این سند نیامده است.'], ['هر مرجع احرازنشده با برچسب «تأییدنشده» آمده و مبنای استدلال قطعی قرار نگرفته است.'], ['بخشنامهٔ ۱۳۰۰ (اصلاحیه‌ای) به‌تنهایی مبنای تمدید مدت پیمان نیست و دلالت آن نسبت به موضوع در فصل تحلیل زمانی بررسی شده است.'], ['این سند رأی داوری/قضاوت نیست؛ صدور نظر نهایی کارشناسی خارج از صلاحیت خودکار سامانه است.']] },
    methodsTable: { heads: ['#', 'عنوان تحلیل', 'روش'], rows: analyses.map((a, i) => [String(i + 1), esc(a.TopicFa), escLines(a.MethodFa)]) },
    assumptionsTable: { heads: ['#', 'تحلیل', 'مفروضات'], rows: analyses.map((a, i) => [String(i + 1), esc(a.Code), escLines(a.AssumptionsFa)]) },
    analysesTable: { heads: ['#', 'کد', 'موضوع', 'یافته‌ها (✖ بحرانی / ⚠ هشدار / ℹ اطلاع)', 'وضعیت تأیید'], rows: analyses.map((a, i) => {
      const fs = findingsOf(a);
      const line = fs.length ? fs.map(f => `${f.severity === 'critical' ? '✖' : f.severity === 'warning' ? '⚠' : 'ℹ'} ${f.text}`).join('<br/>') : escLines(a.ResultsFa ?? '—');
      return [String(i + 1), esc(a.Code), esc(a.TopicFa), line, esc(ANALYSIS_APPROVAL_FA[String(a.ApprovalStatus ?? 'draft')] ?? a.ApprovalStatus)];
    }) },
    delayRefsTable: { heads: ['#', 'نوع پیوند', 'کد هدف', 'عنوان هدف', 'وضعیت'], rows: [...delayLinks, ...lossLinks, ...riskLinks].map((l, i) => [String(i + 1), esc(LINK_KIND_FA[String(l.LinkKind) as keyof typeof LINK_KIND_FA] ?? l.LinkKind), esc(l.TargetCode), esc(l.TargetTitleFa), esc(l.Status ?? 'active')]) },
    delayDaysTable: { heads: ['#', 'ادعا', 'مدت مطالبه‌شده (روز)'], rows: input.claims.map((cl, i) => [String(i + 1), esc(cl.Code), faNum(cl.ClaimedDelayDays)]) },
    amountLayers: { heads: ['کد ادعا', 'عنوان', 'مدعی', 'مبلغ مطالبه‌شده', 'مبلغ بررسی‌شده', 'مبلغ تأییدشده'], rows: input.claims.map(layerRow) },
    totalsTable: { heads: ['شاخص', 'مقدار'], rows: [
      ['تعداد ادعاها', faNum(input.claims.length)],
      ['جمع مبلغ مطالبه‌شده', faNum(input.claims.reduce((a, x) => a + (Number(x.ClaimedAmount) || 0), 0))],
      ['جمع مبلغ بررسی‌شده', faNum(input.claims.reduce((a, x) => a + (Number(x.ReviewedAmount) || 0), 0))],
      ['جمع مبلغ تأییدشده', faNum(input.claims.reduce((a, x) => a + (Number(x.ApprovedAmount) || 0), 0))],
      ['جمع مدت مطالبه‌شده (روز)', faNum(input.claims.reduce((a, x) => a + (Number(x.ClaimedDelayDays) || 0), 0))],
    ] },
    authenticityTable: { heads: ['وضعیت اصالت', 'تعداد'], rows: (() => { const m = new Map<string, number>(); for (const e of input.evidence) { const k = String(e.AuthenticityStatus ?? 'pending'); m.set(k, (m.get(k) ?? 0) + 1); } return [...m.entries()].map(([k, n]) => [esc(k), faNum(n)]); })() },
    sufficiencyTable: { heads: ['وضعیت کفایت', 'تعداد'], rows: (() => { const m = new Map<string, number>(); for (const e of input.evidence) { const k = String(e.SufficiencyStatus ?? 'unchecked'); m.set(k, (m.get(k) ?? 0) + 1); } return [...m.entries()].map(([k, n]) => [esc(k), faNum(n)]); })() },
    calcTable: { heads: ['#', 'کد', 'عنوان', 'نتیجه', 'وضعیت', 'محاسبه‌گر/تاریخ'], rows: calcRows.map((x, i) => [String(i + 1), esc(x.Code), esc(x.TitleFa), faNum(x.ResultAmount), esc(x.Status ?? 'draft'), esc(x.CalculatedBy ?? '—') + (x.CalculatedAt ? ' · ' + faDateTime(x.CalculatedAt) : '')]) },
    agreementsTable: { heads: ['#', 'ادعا', 'طرف', 'رأی', 'خلاصه'], rows: [
      ...agreements.map((r, i) => [String(i + 1), esc(r.ClaimCode), esc(r.ResponderPartyCode), 'پذیرش/جزئی', escLines(r.BodyFa)]),
      ...disagreements.map((r, i) => [String(agreements.length + i + 1), esc(r.ClaimCode), esc(r.ResponderPartyCode), 'رد/اختلاف', escLines(r.BodyFa)]),
    ] },
    linksSummary: { heads: ['#', 'کد پیوند', 'نوع', 'هدف', 'وضعیت'], rows: input.links.map((l, i) => [String(i + 1), esc(l.Code), esc(LINK_KIND_FA[String(l.LinkKind) as keyof typeof LINK_KIND_FA] ?? l.LinkKind), esc(l.TargetCode), esc(l.Status ?? 'active')]) },
    uncertaintiesTable: { heads: ['#', 'تحلیل', 'عدم‌قطعیت/محدودیت روش'], rows: analyses.map((a, i) => [String(i + 1), esc(a.Code), escLines([a.UncertaintiesFa, a.MethodLimitsFa].filter(Boolean).join('\n— — —\n'))]) },
    gapsTable: { heads: ['#', 'نوع', 'شرح شکاف'], rows: [
      ...input.evidence.filter(e => ['insufficient', 'unchecked'].includes(String(e.SufficiencyStatus ?? 'unchecked'))).map((e, i) => [String(i + 1), 'کفایت سند', `سند ${esc(e.Code)} — ${esc(e.TitleFa)}: ${esc(e.SufficiencyStatus ?? 'unchecked')}${e.DeficiencyNoteFa ? ' — ' + esc(e.DeficiencyNoteFa) : ''}`]),
      ...input.claims.filter(cl => !String(cl.ContractClauseRef ?? '').trim()).map((cl, i) => [String(input.evidence.filter(e => ['insufficient', 'unchecked'].includes(String(e.SufficiencyStatus ?? 'unchecked'))).length + i + 1), 'استناد قراردادی', `ادعای ${esc(cl.Code)} — ${esc(cl.TitleFa)}: ارجاع بند قرارداد ثبت نشده است`]),
    ] },
    answersTable: { heads: ['#', 'ادعا/تحلیل', 'پاسخ مستدل (پیش‌نویس قاعده‌محور — رأی نیست)'], rows: analyses.filter(a => a.SuggestedConclusionFa).map((a, i) => [String(i + 1), esc(a.TopicFa), escLines(a.SuggestedConclusionFa)]) },
    conclusionTable: { heads: ['مورد', 'شرح'], rows: [
      ['جمع‌بندی پرونده (از جدول تحلیل‌ها)', summaryAnalysis ? escLines(summaryAnalysis.SuggestedConclusionFa ?? '—') : 'این پرونده فاقد جمع‌بندی تحلیل است — «—»'],
      ['یادداشت کارشناس پرونده', escLines(c.ExpertNoteFa ?? '—')],
      ...input.opinions.map((o) => [`نظریهٔ کارشناسی «${esc(String(o.TitleFa))}» (v${esc(String(o.Version ?? 1))})`, escLines(o.BodyFa)] as string[]),
      ['وضعیت سند نسبت به صدور', esc(REPORT_STATUS_FA[String(input.reportRow?.Status ?? 'draft')] ?? 'پیش‌نویس') + ' — تا صدور رسمی نهایی نیست'],
    ] },
    reviewStatusTable: { heads: ['نمونه', 'کد', 'عنوان', 'وضعیت تأیید/بازبینی', 'ضمانت SoD'], rows: [
      ...analyses.map((a) => ['تحلیل', esc(a.Code), esc(a.TopicFa), esc(ANALYSIS_APPROVAL_FA[String(a.ApprovalStatus ?? 'draft')] ?? a.ApprovalStatus), a.ApprovedBy ? esc(String(a.ApprovedBy)) + ' ≠ ' + esc(String(a.AnalyzedBy ?? '')) : 'تأیید نشده']),
      ...input.opinions.map((o) => ['نظریه', esc(o.Code) + ' v' + esc(o.Version ?? 1), esc(o.TitleFa), esc(OPINION_REVIEW_FA[String(o.ReviewStatus ?? 'draft')] ?? o.ReviewStatus), o.ReviewedBy ? esc(String(o.ReviewedBy)) + ' ≠ ' + esc(String(o.AuthoredBy ?? '')) : 'بازبینی نشده']),
    ] },
    linksTable: { heads: ['#', 'کد', 'نوع', 'کد هدف', 'عنوان هدف', 'ایجادکننده'], rows: [...delayLinks, ...lossLinks, ...riskLinks, ...edmsLinks].map((l, i) => [String(i + 1), esc(l.Code), esc(LINK_KIND_FA[String(l.LinkKind) as keyof typeof LINK_KIND_FA] ?? l.LinkKind), esc(l.TargetCode), esc(l.TargetTitleFa), esc(l.EstablishedBy ?? '—')]) },
    versionTable: { heads: ['#', 'کد', 'نسخه', 'وضعیت', 'تولید/صدور'], rows: input.reportVersions.map((v, i) => [String(i + 1), esc(v.Code), faNum(v.Version), esc(REPORT_STATUS_FA[String(v.Status)] ?? v.Status), faDateTime(v.GeneratedAt) + (v.IssuedAt ? ' · صدور: ' + faDateTime(v.IssuedAt) : '')]) },
    creatorsTable: { heads: ['مورد', 'کاربر', 'تاریخ'], rows: [
      ['تهیه‌کننده (تولید فایل)', esc(input.reportRow?.GeneratedBy ?? input.generatedBy), faDateTime(input.reportRow?.GeneratedAt ?? input.generatedAt)],
      ['بازبین/تأییدکننده', esc(cds_reportRow(input.reportRow, 'ApprovedBy')), faDateTime(input.reportRow?.ApprovedAt)],
      ['صادرکننده', esc(cds_reportRow(input.reportRow, 'IssuedBy')), faDateTime(input.reportRow?.IssuedAt)],
      ['صندلی رأی نهایی', 'سامانه رأی صادر نمی‌کند — نتیجهٔ نهایی کارشناسی با کارشناس انسانی است', '—'],
    ] },
  };
  function cds_reportRow(r: Row | undefined, f: string): string { return r?.[f] ? String(r[f]) : '—'; }

  const chapterIntro: Record<number, string> = {
    3: 'مشخصات طرفین دقیقاً از دفتر طرفین پرونده خوانده می‌شود؛ هیچ شخص/طرفی غافل‌مانده/جعل نشده است.',
    6: 'فهرست اسناد = رکوردهای واقعی جدول مستندات؛ اصالت نامعلوم «در انتظار» گزارش می‌شود و معادل احراز نیست.',
    8: 'استنادهای حقوقی صرفاً همان ارجاعات ثبت‌شدهٔ پرونده‌اند؛ هیچ مادهٔ خلاف ثبت کاربر درج نشده است.',
    10: 'تحلیل‌ها حاصل سرویس قاعده‌محور + یادداشت‌های کارشناس‌اند و تا «تأییدشده» نشوند پیش‌نویس‌اند.',
    12: 'مبالغ در سه لایهٔ مجزا گزارش می‌شوند؛ «تأییدشدهٔ صفر/خالی» یعنی تأیید انجام نشده، نه رد.',
    14: 'محاسبات مستقل کارشناسی فقط «برای مقایسه» است و جای محاسبهٔ طرفین را نمی‌گیرد؛ مقادیر ماژول‌های دیگر بازمحاسبه نمی‌شوند.',
    18: 'نتیجهٔ کارشناسی رأی داوری نیست؛ قضاوت نهایی با کارشناس انسانی/مرجع صالح است.',
    20: 'هرگونه تناقض گزارش پس از امضا، نسخهٔ جدید و جایگزینی نسخهٔ قبلی می‌طلبد.',
  };

  const parts: string[] = [];
  for (const chapter of DISPUTE_REPORT_CHAPTERS) {
    if (!enabled.includes(chapter.key)) continue; // انتخاب فصل‌ها بر مبنای نسخهٔ گزارش
    const tables = DISPUTE_REPORT_TABLES.filter(t => t.chapter === chapter.no);
    const body = [
      chapter.no === 1 ? `<div class="cover"><h1>گزارش کارشناسی موضوع اختلاف ساخت</h1><p>پرونده: <b>${esc(c.Code)}</b> — ${esc(c.TitleFa)}</p><p>نسخهٔ <b>${faNum(input.reportRow?.Version)}</b> · وضعیت: <b>${esc(REPORT_STATUS_FA[String(input.reportRow?.Status ?? 'draft')] ?? 'پیش‌نویس')}</b></p></div>` : '',
      chapterIntro[chapter.no] ? `<p>${esc(chapterIntro[chapter.no])}</p>` : '',
      ...tables.map(t => `<h3>جدول ${t.no} ـ ${esc(t.fa)} [الزامی]</h3>` + table(D[t.dataset]?.heads ?? ['مورد'], D[t.dataset]?.rows ?? [])),
    ].join('\n');
    parts.push(`<h2>فصل ${chapter.no} ـ ${esc(chapter.fa)}</h2>${body}`);
  }
  // راهنمای داخلی — با Auto-Cleanup از خروجی حذف می‌شود.
  parts.push('<section data-internal="true"><h2>راهنمای داخلی تنظیم گزارش</h2><p>راهنمای داخلی: این بخش فقط برای تنظیم‌کننده است و نباید در نسخهٔ صادرشده بماند. [اختیاری]</p></section>');

  const rawBody = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="fa">
<head><meta charset="utf-8"><title>گزارش کارشناسی ${esc(c.Code)} v${esc(String(input.reportRow?.Version ?? 1))}</title>
<style>@page{size:A4;margin:18mm}body{font-family:'B Nazanin',Tahoma,sans-serif;font-size:12pt;line-height:1.9;color:#111}h1{font-size:19pt}h2{font-size:14pt;border-bottom:2px solid #1f4e79;padding-bottom:4px;margin-top:22px}h3{font-size:12pt;color:#1f4e79}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #666;padding:5px 7px;font-size:10.5pt;text-align:right;vertical-align:top}th{background:#dbe7f3}.cover{border:2px solid #1f4e79;padding:24px;text-align:center;margin-top:60px}</style></head>
<body>${parts.join('\n')}</body></html>`;

  const finalize = (html: string): string => sanitizeExpertReportHtml(
    html.replace('</head>', `<style>body{font-family:'B Nazanin',Tahoma,sans-serif}table td,table th{font-family:inherit}</style></head>`),
  );
  const filename = `ExpertReport-${String(c.Code ?? 'case')}-v${Number(input.reportRow?.Version ?? 1)}.${input.format === 'pdf' ? 'html' : 'doc'}`;
  return { body: finalize(rawBody), issues, notices: [] as string[], filename, contentType: 'application/msword; charset=utf-8' };
}
