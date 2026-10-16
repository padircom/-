/**
 * ClaimLossDocumentGenerator — لایحهٔ ضرر و زیان پیمان (PMO-CLAIMS-LOSS-ENGINE-V1.0).
 * سند تا تأیید مسئول مربوط «پیش‌نویس» است. همهٔ اعداد از دادهٔ واقعی پرونده،
 * اجراهاى محاسبه و قواعد تأییدشده می‌آیند؛ قلم بدون محاسبهٔ نهایی با «—» و
 * برچسب «نیازمند بررسی کارشناسی» چاپ می‌شود، نه با عدد حدسی.
 */
import { LOSS_CATEGORIES, lossCategoryFa, type LossSummary } from './claimLoss';

export const LOSS_DOC_SECTIONS = [
  'صفحه عنوان', 'مشخصات پروژه و قرارداد', 'خلاصه مدیریتی', 'موضوع و مبنای ادعا',
  'شرح رویدادهای خسارت', 'خط زمانی رویدادها', 'مبانی قراردادی', 'روش محاسبه هر دسته خسارت',
  'جداول تفصیلی محاسبات', 'اسناد و شواهد پشتیبان', 'ارتباط خسارت با تأخیرات',
  'محاسبات صورت‌وضعیت‌ها', 'کنترل هم‌پوشانی و جلوگیری از مطالبه تکراری', 'جمع‌بندی مبالغ',
  'محدودیت‌ها و فرضیات', 'مبلغ پیشنهادی مطالبه', 'نتیجه بررسی کارشناسی', 'فهرست پیوست‌ها',
] as const;

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
  try {
    const j = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s + 'T00:00:00'));
    return j;
  } catch { return s; }
};
const table = (heads: string[], rows: string[][]): string =>
  `<table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}">—</td></tr>`}</tbody></table>`;

export type LossDocInput = {
  projectId: string; claim: Row; delayEvents: Row[]; costItems: Row[];
  runs: Row[]; rules: Row[]; allocations: Row[]; overlapWarnings: { kind: string; severity: string; messageFa: string }[];
  lossSummary: LossSummary | null; documentById: Map<string, Row>;
  version: number; format: 'word' | 'pdf'; generatedAt: string; generatedBy?: string;
};

export function buildClaimLossDocument(input: LossDocInput) {
  const issues: string[] = [];
  const claim = input.claim;
  if (!claim?.Code) issues.push('ادعای معتبر برای تهیهٔ لایحه انتخاب نشده است');
  if (!input.costItems.length) issues.push('برای این پرونده هیچ قلم خسارتی ثبت نشده است؛ لایحه بدون جدول محاسبات صادر نمی‌شود');
  const caseAmounts = input.lossSummary?.cases.find(c => c.claimCode === String(claim?.Code ?? ''));
  const latestRunByItem = new Map<string, Row>();
  for (const run of [...input.runs].sort((a, b) => String(a.CalculatedAt ?? '').localeCompare(String(b.CalculatedAt ?? '')))) latestRunByItem.set(String(run.ClaimCostItemId), run);
  const ruleByCode = new Map(input.rules.map(r => [String(r.Code), r]));
  const eventById = new Map(input.delayEvents.map(e => [String(e.Id), e]));

  const itemRows = input.costItems.map((item, i) => {
    const run = latestRunByItem.get(String(item.Id));
    const calculated = run && run.FinalAmount !== null && run.FinalAmount !== undefined ? faNum(run.FinalAmount) : 'نیازمند بررسی کارشناسی';
    const docs = (Array.isArray(item.DocumentRefs) ? item.DocumentRefs : []).map(id => { const d = input.documentById.get(String(id)); return d ? `${esc(d.DocNo)}@${esc(d.Revision)}` : esc(id); }).join('، ') || '—';
    return [String(i + 1), esc(item.TitleFa), esc(lossCategoryFa(item.LossCategory ?? item.CostType)), esc(item.CostNature === 'direct' ? 'مستقیم' : item.CostNature === 'indirect' ? 'غیرمستقیم' : '—'), faDate(item.PeriodFrom) + ' تا ' + faDate(item.PeriodTo), faNum(item.Amount), calculated, faNum(item.DocumentedAmount), faNum(item.ApprovedAmount), docs];
  });
  const eventRows = input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), esc(e.TitleFa), faDate(e.StartDate), faDate(e.FinishDate), esc(e.Status), faNum(e.CompletionImpactDays)]);
  const runRows = input.costItems.map((item, i) => {
    const run = latestRunByItem.get(String(item.Id));
    if (!run) return [String(i + 1), esc(item.TitleFa), '—', '—', 'اجرا نشده؛ نیازمند بررسی کارشناسی'];
    const rule = ruleByCode.get(String(run.RuleCode ?? ''));
    return [String(i + 1), esc(item.TitleFa), esc(run.RuleCode ?? '—') + ' v' + esc(run.RuleVersion ?? rule?.Version ?? '—'), esc(run.Status === 'calculated' ? 'محاسبه‌شده' : 'نیازمند بررسی'), faNum(run.FinalAmount)];
  });
  const allocRows = input.allocations.map((a, i) => [String(i + 1), esc(input.costItems.find(x => String(x.Id) === String(a.ClaimCostItemId))?.TitleFa ?? a.ClaimCostItemId), esc(eventById.get(String(a.DelayEventId))?.Code ?? a.DelayEventId), faNum(a.AllocationPct) + '٪', esc(a.Basis ?? '—')]);
  const docRows: string[][] = [];
  let docIndex = 0;
  for (const item of input.costItems) for (const id of (Array.isArray(item.DocumentRefs) ? item.DocumentRefs : [])) {
    const d = input.documentById.get(String(id));
    docRows.push([String(++docIndex), esc(d?.DocNo ?? id), esc(d?.Revision ?? '—'), esc(d?.TitleFa ?? '—'), esc(d?.Status ?? '—'), esc(item.TitleFa)]);
  }
  const categoryRows = [...new Set(input.costItems.map(i => String(i.LossCategory ?? i.CostType)))].map(code => [esc(lossCategoryFa(code)), esc(LOSS_CATEGORIES.find(c => c.code === code)?.en ?? code), esc(input.costItems.filter(i => String(i.LossCategory ?? i.CostType) === code).map(i => String(ruleByCode.get(String(i.RuleCode ?? ''))?.FormulaFa ?? '')).filter(Boolean)[0] ?? 'قاعدهٔ تأییدشدهٔ ثبت‌شده برای اقلام این دسته در جدول محاسبات آمده است')]);

  const s: string[] = [];
  const sec = (n: number, title: string, body: string) => s.push(`<h2>${n}. ${esc(title)}</h2>${body}`);
  sec(1, LOSS_DOC_SECTIONS[0], `<div class="cover"><h1>لایحهٔ ضرر و زیان پیمان</h1><p>پرونده: <b>${esc(claim.Code)}</b> — ${esc(claim.TitleFa)}</p><p>وضعیت سند: <b>پیش‌نویس</b> — تا تأیید مسئول مربوط، سند نهایی محسوب نمی‌شود.</p><p>نسخهٔ لایحه: ${faNum(input.version)} · تاریخ تولید: ${faDate(input.generatedAt)}</p></div>`);
  sec(2, LOSS_DOC_SECTIONS[1], table(['مورد', 'مقدار'], [['پروژه', esc(input.projectId)], ['کد ادعا', esc(claim.Code)], ['عنوان', esc(claim.TitleFa)], ['بند قراردادی', esc(claim.Clause)], ['وضعیت پرونده', esc(claim.Status)], ['تاریخ رویداد', faDate(claim.EventDate)]]));
  sec(3, LOSS_DOC_SECTIONS[2], `<p>این لایحه بر مبنای داده‌های واقعی پرونده، محاسبات نسخه‌دار و اسناد EDMS پیوندشده تولید شده است. هرجا محاسبهٔ تأییدشده یا مدرک کافی وجود ندارد، مقدار با «—» و برچسب «نیازمند بررسی کارشناسی» مشخص شده و هیچ عددی حدس زده نشده است.</p>` + (caseAmounts ? table(['شاخص', 'مبلغ'], [['برآورد اولیه', faNum(caseAmounts.estimated)], ['محاسبه‌شده', faNum(caseAmounts.calculated)], ['مستندشده', faNum(caseAmounts.documented)], ['پیشنهادی مطالبه', faNum(caseAmounts.proposed)], ['تأییدشدهٔ داخلی', faNum(caseAmounts.approvedInternal)]]) : '<p>—</p>'));
  sec(4, LOSS_DOC_SECTIONS[3], `<p>${esc(claim.Entitlement ?? '—')}</p><p>${esc(claim.Causation ?? '—')}</p>`);
  sec(5, LOSS_DOC_SECTIONS[4], table(['#', 'کد رویداد', 'عنوان', 'شروع', 'پایان', 'وضعیت', 'اثر بر اتمام (روز)'], eventRows));
  sec(6, LOSS_DOC_SECTIONS[5], table(['#', 'رویداد', 'تاریخ'], input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code) + ' — ' + esc(e.TitleFa), faDate(e.StartDate) + ' تا ' + faDate(e.FinishDate)])));
  sec(7, LOSS_DOC_SECTIONS[6], `<p>بند قراردادی: ${esc(claim.Clause ?? '—')}</p><p>مبنای استحقاق: ${esc(claim.Entitlement ?? '—')}</p>`);
  sec(8, LOSS_DOC_SECTIONS[7], table(['دستهٔ خسارت', 'Category', 'روش/فرمول'], categoryRows));
  sec(9, LOSS_DOC_SECTIONS[8], table(['#', 'قلم خسارت', 'دسته', 'ماهیت', 'دوره', 'مبلغ ثبت‌شده', 'مبلغ محاسبه‌شده', 'مستند', 'تأییدشده', 'اسناد'], itemRows) + '<h3>اجراهای محاسبه</h3>' + table(['#', 'قلم', 'قاعده و نسخه', 'وضعیت', 'مبلغ نهایی'], runRows));
  sec(10, LOSS_DOC_SECTIONS[9], table(['پیوست', 'شماره سند', 'نسخه', 'عنوان', 'وضعیت', 'قلم مرتبط'], docRows));
  sec(11, LOSS_DOC_SECTIONS[10], `<p>مدت تأخیر، مدت تمدید قابل استحقاق و مبلغ خسارت سه خروجی متفاوت‌اند و در این لایحه جداگانه گزارش شده‌اند؛ هیچ‌کدام خودکار معادل دیگری فرض نشده است.</p>` + table(['#', 'رویداد', 'اثر بر اتمام (روز)', 'وضعیت'], input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), faNum(e.CompletionImpactDays), esc(e.Status)])));
  sec(12, LOSS_DOC_SECTIONS[11], `<p>${esc(claim.QuantumNote ?? 'در صورت ارتباط با صورت‌وضعیت‌ها، محاسبات از نتایج تأییدشدهٔ بخشنامه‌های ۱۳۰۰/۵۰۹۰ ماژول تأخیرات استفاده می‌کند؛ فرمول در دو ماژول تکرار نشده است.')}</p>`);
  sec(13, LOSS_DOC_SECTIONS[12], (input.overlapWarnings.length ? table(['#', 'شدت', 'هشدار'], input.overlapWarnings.map((w, i) => [String(i + 1), esc(w.severity === 'violation' ? 'نقض' : 'هشدار'), esc(w.messageFa)])) : '<p>هشدار هم‌پوشانی ثبت نشده است.</p>') + table(['#', 'قلم', 'رویداد مقصد', 'درصد تخصیص', 'مبنا'], allocRows));
  sec(14, LOSS_DOC_SECTIONS[13], caseAmounts ? table(['مبلغ', 'مقدار'], [['برآورد اولیه', faNum(caseAmounts.estimated)], ['محاسبه‌شده', faNum(caseAmounts.calculated)], ['مستندشده', faNum(caseAmounts.documented)], ['تأییدشدهٔ داخلی', faNum(caseAmounts.approvedInternal)], ['پذیرفته‌شدهٔ طرف مقابل', faNum(caseAmounts.accepted)], ['نهایی تعیین‌شده', faNum(caseAmounts.finalDetermined)]]) : '<p>—</p>');
  sec(15, LOSS_DOC_SECTIONS[14], '<p>فرضیات هر محاسبه در اجرای محاسبهٔ مربوط ثبت شده است. قواعد تأییدنشده مبنای قطعی مطالبه نیستند و نتایج آن‌ها «نیازمند بررسی کارشناسی» گزارش می‌شوند.</p>');
  sec(16, LOSS_DOC_SECTIONS[15], `<p>مبلغ پیشنهادی مطالبه: <b>${faNum(caseAmounts?.proposed)}</b> (جدا از مبلغ برآوردی و تأییدشده؛ بدون سابقه به آن‌ها تبدیل نشده است).</p>`);
  sec(17, LOSS_DOC_SECTIONS[16], '<p>نتیجهٔ بررسی کارشناسی پس از تأیید مسئول مربوط در سامانه ثبت می‌شود؛ این سند تا آن زمان پیش‌نویس است.</p>');
  sec(18, LOSS_DOC_SECTIONS[17], table(['پیوست', 'شماره سند', 'نسخه', 'عنوان'], docRows.map(r => r.slice(0, 4))));

  const body = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="fa">
<head><meta charset="utf-8"><title>لایحه ضرر و زیان ${esc(claim.Code)}</title>
<style>@page{size:A4;margin:18mm}body{font-family:'B Nazanin',Tahoma,sans-serif;font-size:12pt;line-height:1.9;color:#111}h1{font-size:19pt}h2{font-size:14pt;border-bottom:2px solid #1f4e79;padding-bottom:4px;margin-top:22px}h3{font-size:12.5pt}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #666;padding:5px 7px;font-size:10.5pt;text-align:right;vertical-align:top}th{background:#dbe7f3}.cover{border:2px solid #1f4e79;padding:24px;text-align:center;margin-top:60px}</style></head>
<body>${s.join('\n')}</body></html>`;
  return { body, issues, filename: `LossClaim-${String(claim.Code ?? 'claim')}-v${input.version}.${input.format === 'pdf' ? 'html' : 'doc'}`, contentType: 'application/msword; charset=utf-8' };
}
