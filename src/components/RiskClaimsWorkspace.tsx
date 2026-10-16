import { useEffect, useRef, useState } from 'react';
import { type Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { jsonRequest } from '../services/apiClient';
import { DELAY_METHODS, IMPACT_DIMS, RBS, scoreColor } from '../services/rcc';
import { type ClaimLifecycleAction, type RccKind, type RccRow, type RccWorkspace } from '../services/rccWorkspace';
import { buildConcurrencyTimeline } from '../services/delayAnalysis';
import { LOSS_CATEGORIES, lossCategoryFa } from '../services/claimLoss';
import JalaliDateInput from './JalaliDateInput';

export type D4Tab = 'matrix' | 'register' | 'reserve' | 'issue' | 'change' | 'ccb' | 'delay' | 'claim' | 'notice' | 'dispute' | 'invest' | 'exec' | 'loss';
type Props = { lang: Lang; projectId: string; subId?: string; initialTab?: D4Tab; hideTabs?: boolean };
const TABS: [D4Tab, string, string][] = [
  ['matrix', 'ماتریس', 'Matrix'], ['register', 'ثبت ریسک', 'Risks'], ['reserve', 'ذخیره و پایش', 'Reserve & monitor'], ['issue', 'مسئله و هشدار زود', 'Issues & EWS'],
  ['change', 'تغییر', 'Changes'], ['ccb', 'تصویب تغییر', 'CCB'],
  ['claim', 'ادعا', 'Claims'], ['notice', 'اعلان قراردادی', 'Notices'], ['delay', 'تحلیل تأخیر', 'Delay analysis'], ['loss', 'خسارات و لایحه ضرر و زیان', 'Loss & damages'], ['exec', 'خلاصه', 'Summary'],
];
function tabFromSub(sub = ''): D4Tab {
  const explicit: Record<string, D4Tab> = { 'd4-p1-rsv': 'reserve', 'd4-p1-iss': 'issue', 'd4-p1-mx': 'matrix', 'd4-p3-ccb': 'ccb', 'd4-p5-ntc': 'notice', 'd4-p5-tb': 'notice', 'd4-p5-dsp': 'dispute', 'd4-p5-exe': 'exec', 'd4-p5-loss': 'loss' };
  return explicit[sub] ?? (sub.startsWith('d4-p3') ? 'change' : sub.startsWith('d4-p4') ? 'delay' : sub.startsWith('d4-p5') ? 'claim' : 'register');
}
const FIELDS: Record<RccKind, [string, string, string, string?][]> = {
  risks: [['Code', 'کد', 'Code'], ['TitleFa', 'عنوان', 'Title'], ['Owner', 'مالک', 'Owner'], ['Probability', 'احتمال ۱ تا ۵', 'Probability 1–5', 'number'], ['Impact', 'اثر ۱ تا ۵', 'Impact 1–5', 'number'], ['Cause', 'علت', 'Cause'], ['Event', 'رویداد', 'Event'], ['Effect', 'پیامد', 'Effect'], ['Response', 'پاسخ / اقدام', 'Response'], ['SourceRef', 'مرجع', 'Source reference']],
  changes: [['Code', 'کد', 'Code'], ['TitleFa', 'عنوان', 'Title'], ['Reason', 'دلیل تغییر', 'Reason'], ['CostImpact', 'اثر مالی (واحد پول پروژه)', 'Cost impact (project currency)', 'number'], ['TimeImpactDays', 'اثر زمانی (روز)', 'Time impact (days)', 'number']],
  claims: [['Code', 'کد', 'Code'], ['TitleFa', 'عنوان', 'Title'], ['EventDate', 'تاریخ رویداد', 'Event date', 'date'], ['NoticeDays', 'مهلت قراردادی ابلاغ (روز)', 'Contract notice period (days)', 'number'], ['Clause', 'بند قرارداد', 'Contract clause'], ['Amount', 'مبلغ (واحد پول پروژه)', 'Amount (project currency)', 'number'], ['ExtensionDays', 'تمدید خواسته‌شده (روز)', 'Requested EOT days', 'number'], ['Entitlement', 'مبنای استحقاق', 'Entitlement'], ['Causation', 'رابطهٔ سببیت', 'Causation'], ['QuantumNote', 'مبنای محاسبهٔ مبلغ / مدت', 'Quantum basis'], ['EvidenceRef', 'مرجع مستندات', 'Evidence reference'], ['BaselineId', 'شناسهٔ برنامهٔ مبنای جاری', 'Current baseline ID'], ['DataDate', 'تاریخ دادهٔ تحلیل', 'Analysis data date', 'date']],
  issues: [['Code', 'کد', 'Code'], ['TitleFa', 'عنوان', 'Title'], ['Owner', 'مالک', 'Owner'], ['DueDate', 'مهلت اقدام', 'Due date', 'date'], ['Description', 'شرح مسئله', 'Description'], ['SourceRef', 'مرجع', 'Source reference']],
  delays: [['Code', 'کد', 'Code'], ['TitleFa', 'عنوان', 'Title'], ['StartDate', 'تاریخ شروع', 'Start date', 'date'], ['FinishDate', 'تاریخ پایان', 'Finish date', 'date'], ['NoticedDate', 'تاریخ اعلان', 'Notice date', 'date'], ['SourceParty', 'طرف ایجادکننده', 'Source party'], ['ClaimCode', 'کد ادعا', 'Claim code'], ['RiskCode', 'کد ریسک', 'Risk code'], ['IssueCode', 'کد مسئله', 'Issue code'], ['ClauseRef', 'بند قرارداد', 'Contract clause'], ['EvidenceRef', 'مرجع مستندات آزاد', 'Free-text evidence reference'], ['RootCauseFa', 'علت ریشه‌ای', 'Root cause'], ['EstimatedDelayDays', 'تخمین تأخیر (روز)', 'Estimated delay (days)', 'number'], ['CompletionImpactDays', 'اثر بر اتمام (روز)', 'Completion impact (days)', 'number']],
};
const fresh = (kind: RccKind, today: string): Record<string, unknown> => kind === 'risks'
  ? { Category: 'PM', Probability: 3, Impact: 3, Status: 'open', WbsCode: '', ActivityCode: '', BaselineId: '', ReserveAmount: '', ReserveUsedAmount: '', ReserveStatus: 'none', NextReviewDate: '', MonitoringNote: '' }
  : kind === 'changes' ? { CostImpact: 0, TimeImpactDays: 0, Assessment: {}, WbsCode: '', ActivityCode: '', BaselineId: '' }
  : kind === 'issues' ? { Severity: 'medium', DueDate: '', RiskCode: '', WbsCode: '', ActivityCode: '' }
  : kind === 'delays' ? { Category: 'employer', Status: 'under_review', StartDate: today, FinishDate: today, ContractCode: '', ClaimCode: '', RiskCode: '', IssueCode: '', WbsCode: '', ActivityCode: '', BaselineId: '', IpcId: '', EvidenceRefs: [], EstimatedDelayDays: '', CompletionImpactDays: '', IsCritical: false }
  : { EventDate: today, NoticeDays: 28, Amount: 0, ExtensionDays: 0, DataDate: today };
const EDIT = { risks: 'rcc.risk.edit', changes: 'rcc.change.raise', claims: 'rcc.claim.edit', issues: 'rcc.issue.edit', delays: 'rcc.delay.edit' };
type NoticeInfo = { dueAt?: string | null; daysLeft?: number | null; timeBarred?: boolean | null };
const CLAIM_STATUS: Record<string, [string, string]> = {
  draft: ['پیش‌نویس', 'Draft'], submitted: ['ارسال‌شده', 'Submitted'], under_review: ['در بررسی', 'Under review'],
  negotiation: ['در مذاکره', 'In negotiation'], determined: ['تعیین‌شده', 'Determined'], settled: ['تسویه‌شده', 'Settled'],
  rejected: ['ردشده', 'Rejected'], disputed: ['مورد اختلاف', 'Disputed'], withdrawn: ['پس‌گرفته‌شده', 'Withdrawn'], closed: ['بسته', 'Closed'],
};
const CLAIM_ACTIONS: { id: ClaimLifecycleAction; from: string[]; fa: string; en: string; actor: 'decide' | 'edit'; values?: 'determined' | 'settlement' }[] = [
  { id: 'start_review', from: ['submitted'], fa: 'شروع بررسی', en: 'Start review', actor: 'decide' },
  { id: 'negotiate', from: ['under_review', 'determined', 'disputed'], fa: 'ثبت مذاکره', en: 'Record negotiation', actor: 'decide' },
  { id: 'determine', from: ['under_review', 'negotiation'], fa: 'تعیین مبلغ و مدت', en: 'Determine amount/days', actor: 'decide', values: 'determined' },
  { id: 'reject', from: ['submitted', 'under_review', 'negotiation'], fa: 'رد ادعا', en: 'Reject claim', actor: 'decide' },
  { id: 'settle', from: ['negotiation', 'determined', 'disputed'], fa: 'ثبت تسویه', en: 'Record settlement', actor: 'decide', values: 'settlement' },
  { id: 'dispute', from: ['determined', 'rejected'], fa: 'ثبت اختلاف', en: 'Record dispute', actor: 'edit' },
  { id: 'withdraw', from: ['draft', 'submitted', 'under_review', 'negotiation', 'determined', 'disputed'], fa: 'پس‌گرفتن ادعا', en: 'Withdraw claim', actor: 'edit' },
  { id: 'close', from: ['settled', 'rejected', 'withdrawn'], fa: 'بستن پرونده', en: 'Close claim', actor: 'decide' },
];
const DELAY_CATEGORY: Record<string, [string, string]> = {
  employer: ['کارفرما', 'Employer'], contractor: ['پیمانکار', 'Contractor'], concurrent: ['هم‌زمان', 'Concurrent'], neutral: ['خنثی', 'Neutral'], force_majeure: ['قوهٔ قهریه', 'Force majeure'],
  change_order: ['دستور تغییر', 'Change order'], procurement: ['تدارکات', 'Procurement'], engineering_approval: ['تصویب مهندسی', 'Engineering approval'], payment: ['پرداخت', 'Payment'], site_access: ['تحویل/دسترسی زمین', 'Site access'], unknown: ['نامشخص', 'Unknown'],
};
const DELAY_STATUS: Record<string, [string, string]> = {
  draft: ['پیش‌نویس', 'Draft'], under_review: ['در بررسی', 'Under review'], accepted: ['پذیرفته‌شده', 'Accepted'], rejected: ['ردشده', 'Rejected'], closed: ['بسته', 'Closed'], calculated: ['محاسبه‌شده', 'Calculated'], approved: ['تأییدشده', 'Approved'],
};
const ISSUE_STATUS: Record<string, [string, string]> = {
  open: ['باز', 'Open'], in_progress: ['در حال پیگیری', 'In progress'], escalated: ['تشدیدشده', 'Escalated'], resolved: ['رفع‌شده', 'Resolved'], closed: ['بسته', 'Closed'],
};
const ISSUE_ACTIONS: { id: 'start' | 'escalate' | 'resolve' | 'reopen' | 'close'; from: string[]; fa: string; en: string; actor: 'edit' | 'escalate' }[] = [
  { id: 'start', from: ['open', 'escalated'], fa: 'شروع پیگیری', en: 'Start work', actor: 'edit' },
  { id: 'escalate', from: ['open', 'in_progress'], fa: 'تشدید', en: 'Escalate', actor: 'escalate' },
  { id: 'resolve', from: ['in_progress', 'escalated'], fa: 'ثبت رفع مسئله', en: 'Resolve', actor: 'edit' },
  { id: 'reopen', from: ['resolved'], fa: 'بازگشایی', en: 'Reopen', actor: 'edit' },
  { id: 'close', from: ['resolved'], fa: 'بستن مسئله', en: 'Close', actor: 'escalate' },
];

/** Key by real project AND actor so a late response cannot leak the previous user's data. */
export default function RiskClaimsWorkspace(props: Props) {
  const { user } = useAuth();
  return <LiveRcc key={`${props.projectId}:${user?.id ?? ''}`} {...props} userId={user?.id ?? null} />;
}
function LiveRcc({ lang, projectId, subId, initialTab, hideTabs, userId }: Props & { userId: string | null }) {
  const fa = lang === 'fa';
  const label = (a: string, b: string) => fa ? a : b;
  const [tab, setTab] = useState<D4Tab>(initialTab ?? tabFromSub(subId));
  const [workspace, setWorkspace] = useState<RccWorkspace | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [editing, setEditing] = useState<RccRow | null>(null);
  const [reason, setReason] = useState('');
  const [noticeRef, setNoticeRef] = useState('');
  const [noticeDate, setNoticeDate] = useState('');
  const [noticeFilter, setNoticeFilter] = useState<'all' | 'urgent' | 'delivered' | 'barred' | 'unknown'>('all');
  const [lifecycleNote, setLifecycleNote] = useState('');
  const [lifecycleAmount, setLifecycleAmount] = useState('');
  const [lifecycleDays, setLifecycleDays] = useState('');
  const [applicationNote, setApplicationNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const [delayCalc, setDelayCalc] = useState<Record<string, string>>({ engine: 'circular5090', statementKind: 'interim' });
  const [delayApprovalNote, setDelayApprovalNote] = useState('');
  const [delayReviewNote, setDelayReviewNote] = useState('');
  const [costForm, setCostForm] = useState<Record<string, unknown>>({ CostType: 'overhead', TitleFa: '', Amount: '', Currency: '', Basis: '', PeriodFrom: '', PeriodTo: '', DocumentRefs: [], CostNature: '', Quantity: '', Rate: '', UnitFa: '', DocumentedAmount: '', ApprovedAmount: '', ResourceKind: '', ResourceNameFa: '', WorkedUnits: '', IdleUnits: '' });
  const [eotBusy, setEotBusy] = useState<'word' | 'pdf' | null>(null);
  const [eotNotice, setEotNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [lossClaimCode, setLossClaimCode] = useState('');
  const [lossBusy, setLossBusy] = useState<'word' | 'pdf' | null>(null);
  const [lossNotice, setLossNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [ruleForm, setRuleForm] = useState<Record<string, string>>({ Code: '', NameFa: '', Category: 'overhead', Kind: 'rate_qty_period', FormulaFa: '', SourceFa: '', Version: '1.0' });
  const [calcForm, setCalcForm] = useState<Record<string, string>>({ itemId: '', ruleId: '', rate: '', quantity: '', periodUnits: '', baseAmount: '', pct: '', dailyRate: '', days: '', directAmount: '', indirectAmount: '', manualAdjustment: '', manualReason: '' });
  const [allocForm, setAllocForm] = useState<Record<string, string>>({ itemId: '', eventId: '', pct: '', basis: '' });
  const generation = useRef(0);
  const mounted = useRef(true);
  const kind: RccKind = tab === 'issue' ? 'issues' : tab === 'delay' ? 'delays' : ['claim', 'notice', 'dispute'].includes(tab) ? 'claims' : ['change', 'ccb'].includes(tab) ? 'changes' : 'risks';
  const base = `/api/rcc/${encodeURIComponent(projectId)}`;
  const has = (p: string) => workspace?.permissions.includes(p) ?? false;
  async function load() {
    const seq = ++generation.current;
    setLoading(true);
    const result = await jsonRequest<RccWorkspace>(base + '/workspace', userId, 'GET');
    if (!mounted.current || seq !== generation.current) return;
    setLoading(false);
    if (result.ok) { setWorkspace(result.data); setError(''); }
    else { setWorkspace(null); setError(result.message); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; generation.current++; }; }, [projectId, userId]); // scope key also remounts the component
  useEffect(() => { setTab(initialTab ?? tabFromSub(subId)); }, [subId, initialTab]);
  useEffect(() => { setEditing(null); setForm(fresh(kind, workspace?.today ?? '')); }, [kind, workspace?.today]);
  async function mutate(path: string, method: string, body: unknown) {
    if (busy) return;
    setBusy(true); setError('');
    const result = await jsonRequest<RccRow>(base + path, userId, method, body);
    if (!mounted.current) return;
    if (!result.ok) { setError(result.message); setBusy(false); return; }
    setEditing(null); setForm(fresh(kind, workspace?.today ?? '')); setReason(''); setNoticeRef(''); setNoticeDate(''); setLifecycleNote(''); setLifecycleAmount(''); setLifecycleDays(''); setApplicationNote(''); setReviewNote(''); setReviewDate(''); setIssueNote('');
    await load();
    if (mounted.current) setBusy(false);
  }
  function select(row: RccRow) {
    setEditing(row);
    let assessment = row.Assessment;
    if (typeof assessment === 'string') { try { assessment = JSON.parse(assessment); } catch { assessment = {}; } }
    let evidenceRefs = row.EvidenceRefs;
    if (typeof evidenceRefs === 'string') { try { evidenceRefs = JSON.parse(evidenceRefs); } catch { evidenceRefs = []; } }
    setForm({ ...row, Assessment: assessment ?? {}, EvidenceRefs: Array.isArray(evidenceRefs) ? evidenceRefs : [], DataDate: String(row.DataDate ?? '').slice(0, 10), EventDate: String(row.EventDate ?? '').slice(0, 10), DueDate: String(row.DueDate ?? '').slice(0, 10), NextReviewDate: String(row.NextReviewDate ?? '').slice(0, 10) });
    setNoticeDate(workspace?.today ?? '');
    setLifecycleNote('');
    setLifecycleAmount(String(row.SettlementAmount ?? row.DeterminedAmount ?? row.Amount ?? ''));
    setLifecycleDays(String(row.SettlementDays ?? row.DeterminedDays ?? row.ExtensionDays ?? ''));
    setApplicationNote(String(row.ApplicationNote ?? ''));
    setReviewNote(String(row.MonitoringNote ?? ''));
    setReviewDate(String(row.NextReviewDate ?? '').slice(0, 10));
    setIssueNote('');
  }
  async function downloadEot(claimId: string, format: 'word' | 'pdf') {
    if (eotBusy) return;
    setEotBusy(format); setEotNotice(null); setError('');
    try {
      const response = await fetch(`${base}/claims/${encodeURIComponent(claimId)}/eot-document?format=${format}`, { headers: { ...(userId ? { 'x-user-id': userId } : {}) } });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message || label('تولید لایحه انجام نشد', 'EOT generation failed'));
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error(label('فایل خروجی خالی است', 'Generated file is empty'));
      const disposition = response.headers.get('content-disposition') ?? '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `EOT.${format === 'word' ? 'doc' : 'pdf'}`;
      const url = URL.createObjectURL(blob);
      /* اتصال به DOM و آزادسازی با تأخیر؛ حذف فوری URL یا کلیک روی عنصر
         جداشده در برخی مرورگرها دانلود را بی‌صدا لغو می‌کند. */
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      window.setTimeout(() => anchor.remove(), 1000);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (mounted.current) setEotNotice({ ok: true, text: label(`دانلود آغاز شد: ${filename}`, `Download started: ${filename}`) });
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : label('تولید لایحه انجام نشد', 'EOT generation failed');
      if (mounted.current) { setEotNotice({ ok: false, text: message }); setError(message); }
    } finally {
      if (mounted.current) setEotBusy(null);
    }
  }
  async function downloadLoss(claimId: string, format: 'word' | 'pdf') {
    if (lossBusy) return;
    setLossBusy(format); setLossNotice(null);
    try {
      const response = await fetch(`${base}/claims/${encodeURIComponent(claimId)}/loss-document?format=${format}`, { headers: { ...(userId ? { 'x-user-id': userId } : {}) } });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message || label('تولید لایحهٔ ضرر و زیان انجام نشد', 'Loss document generation failed'));
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error(label('فایل خروجی خالی است', 'Generated file is empty'));
      const filename = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `LossClaim.${format === 'word' ? 'doc' : 'pdf'}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
      document.body.appendChild(anchor); anchor.click();
      window.setTimeout(() => anchor.remove(), 1000);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (mounted.current) setLossNotice({ ok: true, text: label(`دانلود آغاز شد: ${filename} (نسخهٔ پیش‌نویس لایحه ثبت شد)`, `Download started: ${filename}`) });
      void load();
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : label('تولید لایحهٔ ضرر و زیان انجام نشد', 'Loss document generation failed');
      if (mounted.current) setLossNotice({ ok: false, text: message });
    } finally {
      if (mounted.current) setLossBusy(null);
    }
  }
  function runIssue(action: (typeof ISSUE_ACTIONS)[number]) {
    if (!editing) return;
    void mutate(`/issues/${encodeURIComponent(editing.Id)}/transition`, 'POST', { action: action.id, note: issueNote, RowVersion: editing.RowVersion });
  }
  function runLifecycle(action: (typeof CLAIM_ACTIONS)[number]) {
    if (!editing) return;
    void mutate(`/claims/${encodeURIComponent(editing.Id)}/lifecycle`, 'POST', {
      action: action.id,
      note: lifecycleNote,
      ...(action.values ? { amount: lifecycleAmount === '' ? undefined : Number(lifecycleAmount), days: lifecycleDays === '' ? undefined : Number(lifecycleDays) } : {}),
      RowVersion: editing.RowVersion,
    });
  }
  const rows = workspace?.[kind] ?? [];
  const reserveOf = (row: RccRow) => (row.reserve ?? {}) as { allocated?: number | null; used?: number | null; remaining?: number | null; usedPct?: number | null; reviewDate?: string | null; reviewDaysLeft?: number | null; reviewOverdue?: boolean; depleted?: boolean };
  const ewsOf = (row: RccRow) => (row.ews ?? {}) as { code?: string | null; severity?: string; dueDate?: string | null; daysLeft?: number | null };
  const noticeOf = (row: RccRow): NoticeInfo => (row.notice ?? {}) as NoticeInfo;
  const noticeText = (row: RccRow) => {
    const info = noticeOf(row);
    if (row.NoticeDeliveredAt) return `${label('ابلاغ‌شده در', 'Delivered on')} ${String(row.NoticeDeliveredAt).slice(0, 10)}${info.timeBarred ? label(' — خارج از مهلت', ' — late') : label(' — به‌موقع', ' — on time')}`;
    if (!info.dueAt || info.daysLeft === null || info.daysLeft === undefined) return label('مهلت ابلاغ نامشخص است', 'Notice deadline is unknown');
    if (info.daysLeft < 0) return `${Math.abs(info.daysLeft)} ${label('روز از مهلت گذشته است', 'days overdue')}`;
    if (info.daysLeft === 0) return label('مهلت ابلاغ امروز است', 'Notice is due today');
    return `${info.daysLeft} ${label('روز تا پایان مهلت ابلاغ', 'days left to notify')}`;
  };
  const noticeRows = [...(workspace?.claims ?? [])]
    .filter(row => !['withdrawn', 'closed'].includes(row.Status))
    .sort((a, b) => {
      const ad = noticeOf(a).dueAt ?? '9999-12-31'; const bd = noticeOf(b).dueAt ?? '9999-12-31';
      const aRank = a.NoticeDeliveredAt ? 2 : noticeOf(a).timeBarred ? 0 : 1;
      const bRank = b.NoticeDeliveredAt ? 2 : noticeOf(b).timeBarred ? 0 : 1;
      return aRank - bRank || ad.localeCompare(bd) || a.Code.localeCompare(b.Code);
    });
  const filteredNoticeRows = noticeRows.filter(row => {
    const info = noticeOf(row);
    if (noticeFilter === 'urgent') return !row.NoticeDeliveredAt && info.daysLeft !== null && info.daysLeft !== undefined && info.daysLeft <= 7;
    if (noticeFilter === 'delivered') return Boolean(row.NoticeDeliveredAt);
    if (noticeFilter === 'barred') return Boolean(info.timeBarred);
    if (noticeFilter === 'unknown') return !info.dueAt;
    return true;
  });
  const reserveRows = [...(workspace?.risks ?? [])].sort((a, b) => String(reserveOf(a).reviewDate ?? '9999-12-31').localeCompare(String(reserveOf(b).reviewDate ?? '9999-12-31')) || Number(b.Score ?? 0) - Number(a.Score ?? 0));
  const issueRows = [...rows].sort((a, b) => String(ewsOf(a).dueDate ?? '9999-12-31').localeCompare(String(ewsOf(b).dueDate ?? '9999-12-31')) || a.Code.localeCompare(b.Code));
  const displayRows = tab === 'notice' ? filteredNoticeRows : tab === 'dispute' ? rows.filter(row => ['negotiation', 'determined', 'rejected', 'disputed'].includes(row.Status)) : tab === 'reserve' ? reserveRows : tab === 'issue' ? issueRows : rows;
  const selectedCalculations = editing && kind === 'delays' ? (workspace?.delayCalculations ?? []).filter(row => row.DelayEventId === editing.Id) : [];
  const hidden = workspace?.[`${kind}Hidden`];
  const inputClass = 'rounded-lg border b-line-soft bg-[var(--row)] px-2 py-2 text-[11px] tx1 w-full';
  const btn = 'rounded-lg border b-line-soft px-3 py-2 text-[11px] tx1 disabled:opacity-40';
  const locked = Boolean(editing && ((kind === 'issues' && editing.Status === 'closed') || (kind === 'delays' && editing.Status === 'closed') || (kind !== 'risks' && kind !== 'issues' && kind !== 'delays' && !['draft', 'pending'].includes(editing.Status))));
  return <div dir={fa ? 'rtl' : 'ltr'} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
    <header className="glass-dark rounded-xl p-3 flex flex-wrap items-center gap-3">
      <h3 className="tx1 font-semibold">{label('ریسک، تغییر و ادعا — دادهٔ ماندگار', 'Risk, change & claims — persisted data')}</h3>
      <span className="tx3 text-xs" dir="ltr">{projectId}</span>
      <button className={btn} disabled={busy || loading} onClick={() => void load()}>{label('تازه‌سازی', 'Refresh')}</button>
      <span className="tx3 text-xs">{label('این بخش برنامه و بودجهٔ مصوب را بازنویسی نمی‌کند.', 'Approved schedule and budget are not overwritten.')}</span>
    </header>
    {!hideTabs && <nav className="flex flex-wrap gap-2">{TABS.map(([id, a, b]) => <button key={id} className={`${btn} ${tab === id ? 'toggle-on' : ''}`} onClick={() => setTab(id)}>{label(a, b)}</button>)}</nav>}
    {error && <p role="alert" className="rounded-xl bg-rose-500/10 text-rose-400 p-3 text-sm">{error}</p>}
    {loading && <p className="tx3">{label('در حال بارگذاری…', 'Loading…')}</p>}
    {!loading && workspace && <>
      {tab === 'invest' ? <section className="glass-dark rounded-xl p-4 tx2 text-sm">
        {label('این ابزار هنوز به گردش‌کار ماندگار متصل نیست. اعداد و دکمه‌های نمونهٔ قبلی حذف شده‌اند؛ برای ثبت عملیاتی از ریسک، تغییر و ادعا استفاده کنید.', 'This tool is not yet connected to a persisted workflow. Previous demo values and actions have been removed. Use risks, changes and claims for operational records.')}
      </section> : tab === 'exec' ? <section className="grid grid-cols-2 gap-3 md:grid-cols-4">{(['risks', 'changes', 'claims', 'issues'] as const).map(k => <div className="glass-dark rounded-xl p-4 tx1" key={k}>{k}: {workspace[`${k}Hidden`] ? label('بدون مجوز', 'Restricted') : workspace[k].length}</div>)}</section> : <>
        {tab === 'matrix' && !workspace.risksHidden && <section className="glass-dark rounded-xl p-3 grid grid-cols-5 gap-2">{[5, 4, 3, 2, 1].flatMap(p => [1, 2, 3, 4, 5].map(i => <div key={`${p}-${i}`} className="rounded-lg p-3 text-center text-sm" style={{ border: `1px solid ${scoreColor(p * i)}`, color: scoreColor(p * i) }}><div>P{p} × I{i}</div>{workspace.risks.filter(r => r.Probability === p && r.Impact === i).length}</div>))}</section>}
        {tab === 'notice' && !workspace.claimsHidden && workspace.noticeSummary && <section className="glass-dark rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="tx1 text-sm font-semibold">{label('داشبورد اعلان و Time-Bar', 'Notice & Time-Bar dashboard')}</h4>
            <span className="tx3 text-xs">{label('نزدیک‌ترین مهلت:', 'Next deadline:')} <span dir="ltr">{workspace.noticeSummary.nextDueAt ?? '—'}</span></span>
            <div className="ms-auto flex flex-wrap gap-1.5">
              {([['all', 'همه', 'All'], ['urgent', 'فوری', 'Urgent'], ['delivered', 'ابلاغ‌شده', 'Delivered'], ['barred', 'سقوط‌کرده', 'Time-barred'], ['unknown', 'نامشخص', 'Unknown']] as const).map(([id, a, b]) => <button key={id} className={`${btn} ${noticeFilter === id ? 'toggle-on' : ''}`} onClick={() => setNoticeFilter(id)}>{label(a, b)}</button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              [label('کل ادعاهای فعال', 'Active claims'), workspace.noticeSummary.total],
              [label('ابلاغ‌شده', 'Delivered'), workspace.noticeSummary.delivered],
              [label('از مهلت گذشته', 'Overdue'), workspace.noticeSummary.overdue],
              [label('تا ۷ روز آینده', 'Due within 7 days'), workspace.noticeSummary.dueWithin7Days],
              [label('۸ تا ۳۰ روز آینده', 'Due in 8–30 days'), workspace.noticeSummary.dueWithin30Days],
              [label('سقوط‌کرده / Time-Barred', 'Time-barred'), workspace.noticeSummary.timeBarred],
              [label('مهلت نامشخص', 'Unknown deadline'), workspace.noticeSummary.unknownDeadline],
              [label('نزدیک‌ترین مهلت', 'Next deadline'), workspace.noticeSummary.nextDueAt ?? '—'],
            ].map(([title, value]) => <div key={String(title)} className="rounded-lg border b-line-soft p-3"><div className="tx3 text-[11px]">{title}</div><div className="tx1 mt-1 text-base font-semibold" dir="ltr">{value}</div></div>)}
          </div>
          <p className="tx3 text-xs">{label('فهرست زیر بر اساس فوریت مهلت مرتب شده است؛ رکورد را انتخاب کنید تا ابلاغ یا چرخهٔ ادعا را ثبت کنید.', 'The list below is sorted by deadline urgency; select a record to record notice or claim lifecycle actions.')}</p>
        </section>}
        {tab === 'reserve' && !workspace.risksHidden && workspace.reserveSummary && <section className="glass-dark rounded-xl p-3 space-y-3">
          <h4 className="tx1 text-sm font-semibold">{label('ذخیره و پایش ریسک', 'Risk reserve & monitoring')}</h4>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[
            [label('ذخیره تخصیص‌یافته', 'Allocated reserve'), workspace.reserveSummary.allocated],
            [label('مصرف ذخیره', 'Used reserve'), workspace.reserveSummary.used],
            [label('مانده ذخیره', 'Remaining reserve'), workspace.reserveSummary.remaining],
            [label('بازبینی‌شده', 'Reviewed'), workspace.reserveSummary.monitored],
            [label('بازبینی عقب‌افتاده', 'Overdue reviews'), workspace.reserveSummary.reviewOverdue],
            [label('بازبینی تا ۷ روز آینده', 'Review within 7 days'), workspace.reserveSummary.reviewDueWithin7Days],
            [label('ذخیره تمام‌شده', 'Depleted'), workspace.reserveSummary.depleted],
            [label('نزدیک‌ترین بازبینی', 'Next review'), workspace.reserveSummary.nextReviewAt ?? '—'],
          ].map(([title, value]) => <div key={String(title)} className="rounded-lg border b-line-soft p-3"><div className="tx3 text-[11px]">{title}</div><div className="tx1 mt-1 text-base font-semibold" dir="ltr">{value}</div></div>)}</div>
          <p className="tx3 text-xs">{label('مبلغ ذخیره فقط از ثبت و بازبینی ریسک به‌روز می‌شود و بودجهٔ مصوب پروژه را تغییر نمی‌دهد.', 'Reserve values change only through risk records and reviews; approved project budget is not changed.')}</p>
        </section>}
        {tab === 'delay' && !workspace.delaysHidden && workspace.delaySummary && <section className="glass-dark rounded-xl p-3 space-y-3">
          <h4 className="tx1 text-sm font-semibold">{label('داشبورد تأخیر و تمدید مدت', 'Delay & EOT dashboard')}</h4>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[
            [label('رویدادهای ثبت‌شده', 'Recorded events'), workspace.delaySummary.total],
            [label('رویدادهای بحرانی', 'Critical events'), workspace.delaySummary.critical],
            [label('محاسبات تأییدشده', 'Approved calculations'), workspace.delaySummary.approvedCalculations],
            [label('تمدید تأییدشده (روز)', 'Approved EOT (days)'), workspace.delaySummary.approvedExtensionDays],
          ].map(([title, value]) => <div key={String(title)} className="rounded-lg border b-line-soft p-3"><div className="tx3 text-[11px]">{title}</div><div className="tx1 mt-1 text-base font-semibold" dir="ltr">{value}</div></div>)}</div>
          <p className="tx3 text-xs">{label('فقط آخرین محاسبهٔ مؤثر هر رویداد/صورت‌وضعیت که کارشناس مستقل تأیید کرده در شاخص تمدید شمرده می‌شود؛ نتیجهٔ خام و خروجی ۱۳۰۰ «مدت مجاز پرداخت» تمدید مدت محسوب نمی‌شود.', 'Only the latest effective approved calculation per event/statement counts as EOT; raw results and Circular 1300 allowed payment days are not EOT.')}</p>
          <div className="grid gap-2 md:grid-cols-2">{DELAY_METHODS.map(m => <p key={m.code} className="rounded-lg border b-line-soft p-2 text-xs tx3">{label(m.fa, m.en)}</p>)}</div>
          {workspace.monetarySummary && <p className="tx3 text-xs">{label('ادعای مالی (Prolongation):', 'Monetary claim:')} {workspace.monetarySummary.items} {label('آیتم', 'items')} · {label('جمع:', 'Total:')} <span dir="ltr">{workspace.monetarySummary.totalAmount}</span></p>}
          {(() => { const timeline = buildConcurrencyTimeline(workspace.delays); return timeline.bars.length ? <div className="space-y-1">
            <h5 className="tx1 text-xs font-semibold">{label('تایم‌لاین هم‌زمانی تأخیرات', 'Concurrent delay timeline')} <span className="tx3" dir="ltr">{timeline.minDate} → {timeline.maxDate}</span></h5>
            <div className="relative" dir="ltr">
              {timeline.overlaps.map((o, i) => <div key={i} title={`${o.aCode} × ${o.bCode}`} className="absolute top-0 bottom-0 bg-amber-400/20 border-x border-amber-400/50" style={{ left: `calc(150px + (100% - 160px) * ${o.leftPct / 100})`, width: `calc((100% - 160px) * ${o.widthPct / 100})` }} />)}
              {timeline.bars.map(bar => <div key={bar.code} className="relative flex items-center gap-2 py-0.5">
                <span className="tx3 text-[10px] w-[150px] shrink-0 truncate" dir="rtl">{bar.code} — {bar.title}</span>
                <span className="relative h-3.5 flex-1 rounded bg-[var(--row)] border b-line-soft"><span className={`absolute top-0 h-full rounded ${bar.critical ? 'ring-2 ring-red-700' : 'opacity-80'}`} style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, background: bar.color }} /></span>
                <span className="tx3 text-[10px] w-[90px] shrink-0">{bar.critical ? label('بحرانی', 'Critical') : label('غیربحرانی', 'Non-critical')}</span>
              </div>)}
            </div>
            <p className="tx3 text-[10px]">{label('آبی: کارفرما · قرمز: پیمانکار · بنفش: هم‌زمان · نوار زرد: هم‌پوشانی · قاب قرمز تیره: بحرانی', 'Blue: employer · Red: contractor · Purple: concurrent · Yellow band: overlap · Dark red ring: critical')}</p>
          </div> : null; })()}
        </section>}
        {tab === 'delay' && !workspace.claimsHidden && <section className="glass-dark rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><h4 className="tx1 text-sm font-semibold">{label('مهلت‌های حیاتی قراردادی', 'Critical contractual deadlines')}</h4>
          <button className={btn} disabled={busy || !workspace.deadlineAlerts.length} onClick={() => void mutate('/deadline-alerts/notify', 'POST', { withinDays: 7 })}>{label('ارسال هشدار به مسئول پرونده', 'Notify case owners')}</button></div>
          {workspace.deadlineAlerts.length ? <div className="space-y-1">{workspace.deadlineAlerts.map(alert => <p key={alert.claimId} className={`rounded-lg border b-line-soft p-2 text-xs ${alert.daysLeft < 0 ? 'text-rose-400' : alert.daysLeft <= 7 ? 'text-amber-400' : 'tx2'}`}>{alert.claimCode} — {alert.titleFa} · {label('سررسید:', 'Due:')} <span dir="ltr">{alert.dueAt}</span> · {alert.daysLeft < 0 ? `${Math.abs(alert.daysLeft)} ${label('روز گذشته است', 'days overdue')}` : `${alert.daysLeft} ${label('روز باقی مانده است', 'days left')}`}{alert.owner ? ` · ${label('مسئول:', 'Owner:')} ${alert.owner}` : ''}</p>)}</div>
          : <p className="tx3 text-xs">{label('در ۳۰ روز آینده مهلت ابلاغی نزدیک نیست.', 'No notice deadline within the next 30 days.')}</p>}
          <p className="tx3 text-[10px]">{label('هشدار داخلی در کارتابل مسئول پرونده ثبت می‌شود و در صورت پیکربندی SMTP و وجود ایمیل کاربر، ایمیل نیز ارسال می‌شود.', 'Internal alerts land in the case owner inbox; email is sent when SMTP is configured and the user has an email.')}</p>
        </section>}
        {tab === 'issue' && !workspace.issuesHidden && workspace.issueSummary && <section className="glass-dark rounded-xl p-3 space-y-3">
          <h4 className="tx1 text-sm font-semibold">{label('مسئله و هشدار زودهنگام (EWS)', 'Issues & early warning (EWS)')}</h4>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[
            [label('مسائل فعال', 'Active issues'), workspace.issueSummary.total],
            [label('باز', 'Open'), workspace.issueSummary.open],
            [label('عقب‌افتاده', 'Overdue'), workspace.issueSummary.overdue],
            [label('تا ۷ روز آینده', 'Due within 7 days'), workspace.issueSummary.dueWithin7Days],
            [label('شدت بالا/بحرانی', 'High/critical'), workspace.issueSummary.critical],
            [label('تشدیدشده', 'Escalated'), workspace.issueSummary.escalated],
            [label('نزدیک‌ترین مهلت', 'Next due'), workspace.issueSummary.nextDueAt ?? '—'],
          ].map(([title, value]) => <div key={String(title)} className="rounded-lg border b-line-soft p-3"><div className="tx3 text-[11px]">{title}</div><div className="tx1 mt-1 text-base font-semibold" dir="ltr">{value}</div></div>)}</div>
        </section>}
        {tab === 'loss' && !workspace.delaysHidden && (() => {
          const s = (workspace.lossSummary ?? {}) as { totals?: Record<string, number>; cases?: { claimCode: string; estimated: number; calculated: number; documented: number; proposed: number; approvedInternal: number; accepted: number | null; finalDetermined: number | null; itemsCount: number; itemsWithoutDocs: number; itemsNeedingReview: number; readyForDocument: boolean }[]; activeCases?: number; incompleteDocs?: number; needsReview?: number; readyForDocument?: number; pendingApproval?: number };
          const selectedClaim = workspace.claims.find(c => c.Code === lossClaimCode) ?? workspace.claims[0];
          const caseRow = s.cases?.find(c => c.claimCode === selectedClaim?.Code);
          const claimEventIds = new Set(workspace.delays.filter(d => d.ClaimCode === selectedClaim?.Code).map(d => d.Id));
          const items = workspace.claimCostItems.filter(i => i.ClaimCode === selectedClaim?.Code || claimEventIds.has(i.DelayEventId));
          const latestRun = (itemId: string) => [...workspace.lossRuns].filter(r => r.ClaimCostItemId === itemId).sort((a, b) => String(b.CalculatedAt ?? '').localeCompare(String(a.CalculatedAt ?? '')))[0];
          const versions = workspace.lossDocumentVersions.filter(v => v.ClaimId === selectedClaim?.Id);
          const warnings = (workspace.overlapWarnings ?? []) as { kind: string; severity: string; messageFa: string }[];
          const nums = (v: unknown) => v === '' || v === undefined ? undefined : Number(v);
          return <section className="glass-dark rounded-xl p-3 space-y-3">
            <h4 className="tx1 text-sm font-semibold">{label('مدیریت هوشمند خسارات و دعاوی مالی پیمان — مرکز کنترل ضرر و زیان', 'Smart contract losses & financial claims — loss control centre')}</h4>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">{[
              [label('مجموع ثبت‌شده (برآورد)', 'Estimated total'), s.totals?.estimated ?? 0],
              [label('مجموع محاسبه‌شده', 'Calculated total'), s.totals?.calculated ?? 0],
              [label('مجموع مستند', 'Documented total'), s.totals?.documented ?? 0],
              [label('پیشنهادی مطالبه', 'Proposed total'), s.totals?.proposed ?? 0],
              [label('تأییدشدهٔ داخلی', 'Internally approved'), s.totals?.approvedInternal ?? 0],
              [label('پرونده‌های فعال', 'Active cases'), s.activeCases ?? 0],
              [label('مدارک ناقص', 'Incomplete documents'), s.incompleteDocs ?? 0],
              [label('نیازمند بررسی کارشناسی', 'Needs expert review'), s.needsReview ?? 0],
              [label('آمادهٔ تهیه لایحه', 'Ready for document'), s.readyForDocument ?? 0],
              [label('سوابق تولید لایحه', 'Document versions'), workspace.lossDocumentVersions.length],
            ].map(([title, value]) => <div key={String(title)} className="rounded-lg border b-line-soft p-3"><div className="tx3 text-[11px]">{title}</div><div className="tx1 mt-1 text-base font-semibold" dir="ltr">{String(value)}</div></div>)}</div>
            <div className="flex flex-wrap gap-1.5">{workspace.claims.map(c => <button key={c.Id} className={`${btn} ${selectedClaim?.Id === c.Id ? 'toggle-on' : ''}`} onClick={() => setLossClaimCode(c.Code)}>{c.Code}</button>)}</div>
            {selectedClaim && <>
              <p className="tx2 text-xs"><strong className="tx1">{selectedClaim.Code} — {selectedClaim.TitleFa}</strong> · {label('تفکیک مبالغ (تبدیل بدون سابقه انجام نمی‌شود):', 'Separated amounts:')} {label('برآورد', 'Est.')} <span dir="ltr">{caseRow?.estimated ?? '—'}</span> · {label('محاسبه‌شده', 'Calc.')} <span dir="ltr">{caseRow?.calculated ?? '—'}</span> · {label('مستند', 'Doc.')} <span dir="ltr">{caseRow?.documented ?? '—'}</span> · {label('تأیید داخلی', 'Appr.')} <span dir="ltr">{caseRow?.approvedInternal ?? '—'}</span> · {label('پذیرش طرف مقابل', 'Accepted')} <span dir="ltr">{caseRow?.accepted ?? '—'}</span> · {label('نهایی', 'Final')} <span dir="ltr">{caseRow?.finalDetermined ?? '—'}</span></p>
              <div className="space-y-1">{items.length ? items.map(item => { const run = latestRun(item.Id); return <p key={item.Id} className="rounded-lg border b-line-soft p-2 text-xs tx2">{label(lossCategoryFa(item.LossCategory ?? item.CostType), item.CostType)} — {item.TitleFa} · {label('ثبت‌شده', 'Recorded')} <span dir="ltr">{String(item.Amount)}</span> · {label('محاسبه', 'Calc')} <span dir="ltr">{run ? (run.FinalAmount ?? label('نیازمند بررسی', 'Needs review')) : '—'}</span> · {label('اسناد', 'Docs')} {Array.isArray(item.DocumentRefs) ? item.DocumentRefs.length : 0}{has('rcc.delay.calculate') && <button className={btn} disabled={busy} onClick={() => setCalcForm(f => ({ ...f, itemId: item.Id }))}>{label('انتخاب برای محاسبه', 'Select to calculate')}</button>}{has('rcc.delay.edit') && <button className={btn} disabled={busy} onClick={() => setAllocForm(f => ({ ...f, itemId: item.Id }))}>{label('تخصیص', 'Allocate')}</button>}</p>; }) : <span className="tx3 text-xs">{label('برای این پرونده قلم خسارتی ثبت نشده است؛ از تب تحلیل تأخیر، رویداد پیوندشده را باز و آیتم هزینه ثبت کنید.', 'No loss item for this case; open the linked delay event and add a cost item.')}</span>}</div>
              {has('rcc.delay.calculate') && <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="text-[11px] tx3">{label('قلم خسارت', 'Loss item')}<select aria-label={label('قلم خسارت', 'Loss item')} className={inputClass} value={calcForm.itemId} onChange={e => setCalcForm(f => ({ ...f, itemId: e.target.value }))}><option value="">—</option>{items.map(i => <option key={i.Id} value={i.Id}>{i.TitleFa}</option>)}</select></label>
                <label className="text-[11px] tx3">{label('قاعدهٔ محاسبه', 'Rule')}<select aria-label={label('قاعدهٔ محاسبه', 'Rule')} className={inputClass} value={calcForm.ruleId} onChange={e => setCalcForm(f => ({ ...f, ruleId: e.target.value }))}><option value="">—</option>{workspace.lossRules.map(r => <option key={r.Id} value={r.Id}>{r.Code} v{r.Version ?? '1.0'} — {r.NameFa} ({r.Status === 'approved' ? label('تأییدشده', 'approved') : label('تأییدنشده', 'not approved')})</option>)}</select></label>
                {(['rate', 'quantity', 'periodUnits', 'baseAmount', 'pct', 'dailyRate', 'days', 'directAmount', 'indirectAmount'] as const).map(k => <label key={k} className="text-[11px] tx3">{label({ rate: 'نرخ', quantity: 'تعداد/مقدار', periodUnits: 'دوره', baseAmount: 'مبلغ مبنا', pct: 'درصد', dailyRate: 'نرخ روزانه', days: 'روز', directAmount: 'مستقیم', indirectAmount: 'غیرمستقیم' }[k], k)}<input aria-label={k} className={inputClass} type="number" step="any" value={calcForm[k]} onChange={e => setCalcForm(f => ({ ...f, [k]: e.target.value }))} /></label>)}
                <label className="text-[11px] tx3">{label('اصلاح دستی (با دلیل)', 'Manual adjustment (with reason)')}<span className="flex gap-1"><input aria-label={label('اصلاح دستی', 'Adjustment')} className={inputClass} type="number" step="any" value={calcForm.manualAdjustment} onChange={e => setCalcForm(f => ({ ...f, manualAdjustment: e.target.value }))} /><input aria-label={label('دلیل اصلاح', 'Reason')} className={inputClass} value={calcForm.manualReason} onChange={e => setCalcForm(f => ({ ...f, manualReason: e.target.value }))} /></span></label>
                <button className={btn} disabled={busy || !calcForm.itemId || !calcForm.ruleId} onClick={() => void mutate(`/cost-items/${encodeURIComponent(calcForm.itemId)}/calculate`, 'POST', { ruleId: calcForm.ruleId, inputs: { rate: nums(calcForm.rate), quantity: nums(calcForm.quantity), periodUnits: nums(calcForm.periodUnits), baseAmount: nums(calcForm.baseAmount), pct: nums(calcForm.pct), dailyRate: nums(calcForm.dailyRate), days: nums(calcForm.days), directAmount: nums(calcForm.directAmount), indirectAmount: nums(calcForm.indirectAmount) }, manualAdjustment: nums(calcForm.manualAdjustment) ?? 0, manualReason: calcForm.manualReason })}>{label('اجرای محاسبه (ثبت نسخه‌دار)', 'Run calculation')}</button>
              </div>}
              {has('rcc.delay.edit') && <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="text-[11px] tx3">{label('رویداد مقصد تخصیص', 'Target event')}<select aria-label={label('رویداد مقصد تخصیص', 'Target event')} className={inputClass} value={allocForm.eventId} onChange={e => setAllocForm(f => ({ ...f, eventId: e.target.value }))}><option value="">—</option>{workspace.delays.map(d => <option key={d.Id} value={d.Id}>{d.Code} — {d.TitleFa}</option>)}</select></label>
                <label className="text-[11px] tx3">{label('درصد تخصیص', 'Allocation %')}<input aria-label={label('درصد تخصیص', 'Allocation %')} className={inputClass} type="number" step="any" value={allocForm.pct} onChange={e => setAllocForm(f => ({ ...f, pct: e.target.value }))} /></label>
                <label className="text-[11px] tx3">{label('مبنای تخصیص (برای بیش از ۱۰۰٪ الزامی)', 'Basis (required above 100%)')}<input aria-label={label('مبنای تخصیص', 'Basis')} className={inputClass} value={allocForm.basis} onChange={e => setAllocForm(f => ({ ...f, basis: e.target.value }))} /></label>
                <button className={btn} disabled={busy || !allocForm.itemId || !allocForm.eventId || !allocForm.pct} onClick={() => void mutate(`/cost-items/${encodeURIComponent(allocForm.itemId)}/allocations`, 'POST', { DelayEventId: allocForm.eventId, AllocationPct: Number(allocForm.pct), Basis: allocForm.basis })}>{label('ثبت تخصیص', 'Add allocation')}</button>
              </div>}
              {warnings.length > 0 && <div className="space-y-1"><h5 className="tx1 text-xs font-semibold">{label('کنترل هم‌پوشانی (نامزد بررسی کارشناسی، نه حکم قطعی)', 'Overlap control (candidates, not verdicts)')}</h5>{warnings.map((w, i) => <p key={i} className={`rounded-lg p-2 text-xs ${w.severity === 'violation' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>{w.messageFa}</p>)}</div>}
              <div className="flex flex-wrap items-center gap-2">
                <span className="tx1 text-xs font-semibold">{label('لایحهٔ ضرر و زیان (پیش‌نویس تا تأیید مسئول)', 'Loss document (draft until approved)')}</span>
                {(['word', 'pdf'] as const).map(format => <button type="button" key={format} className={btn} disabled={lossBusy !== null} onClick={() => void downloadLoss(selectedClaim.Id, format)}>{lossBusy === format ? label('در حال تولید…', 'Generating…') : format === 'word' ? label('دانلود Word', 'Download Word') : label('دانلود / چاپ PDF', 'Download / print PDF')}</button>)}
                <span className="tx3 text-xs">{label('نسخه‌های تولیدشده:', 'Versions:')} <span dir="ltr">{versions.map(v => 'v' + String(v.Version)).join('، ') || '—'}</span></span>
              </div>
              {lossNotice && <p role={lossNotice.ok ? 'status' : 'alert'} className={`rounded-xl p-3 text-xs ${lossNotice.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{lossNotice.text}</p>}
            </>}
            <div className="space-y-2">
              <h5 className="tx1 text-xs font-semibold">{label('کتابخانهٔ قواعد محاسبه (ClaimCalculationRules) — قاعدهٔ تأییدنشده مبنای قطعی نیست', 'Calculation rules library — unapproved rules are not final basis')}</h5>
              <div className="space-y-1">{workspace.lossRules.length ? workspace.lossRules.map(r => <p key={r.Id} className="rounded-lg border b-line-soft p-2 text-xs tx2"><span dir="ltr">{r.Code} v{r.Version ?? '1.0'}</span> — {r.NameFa} · {label(lossCategoryFa(r.Category), r.Category)} · {r.Status}{r.Status !== 'approved' && has('rcc.delay.approve') && <button className={btn} disabled={busy} onClick={() => void mutate(`/loss-rules/${encodeURIComponent(r.Id)}/approve`, 'POST', { note: label('قاعده و منبع بررسی شد', 'Rule and source reviewed') })}>{label('تأیید قاعده', 'Approve rule')}</button>}</p>) : <span className="tx3 text-xs">{label('قاعده‌ای ثبت نشده است.', 'No rule recorded.')}</span>}</div>
              {has('rcc.delay.edit') && <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="text-[11px] tx3">{label('کد قاعده', 'Rule code')}<input aria-label={label('کد قاعده', 'Rule code')} className={inputClass} value={ruleForm.Code} onChange={e => setRuleForm(f => ({ ...f, Code: e.target.value }))} /></label>
                <label className="text-[11px] tx3">{label('نام قاعده', 'Rule name')}<input aria-label={label('نام قاعده', 'Rule name')} className={inputClass} value={ruleForm.NameFa} onChange={e => setRuleForm(f => ({ ...f, NameFa: e.target.value }))} /></label>
                <label className="text-[11px] tx3">{label('دسته', 'Category')}<select aria-label={label('دسته', 'Category')} className={inputClass} value={ruleForm.Category} onChange={e => setRuleForm(f => ({ ...f, Category: e.target.value }))}>{LOSS_CATEGORIES.map(c => <option key={c.code} value={c.code}>{label(c.fa, c.en)}</option>)}</select></label>
                <label className="text-[11px] tx3">{label('نوع فرمول', 'Formula kind')}<select aria-label={label('نوع فرمول', 'Formula kind')} className={inputClass} value={ruleForm.Kind} onChange={e => setRuleForm(f => ({ ...f, Kind: e.target.value }))}><option value="rate_qty_period">{label('نرخ × مقدار × دوره', 'Rate × qty × period')}</option><option value="amount_pct">{label('درصد از مبلغ مبنا', 'Percent of base')}</option><option value="daily_rate_days">{label('نرخ روزانه × روز', 'Daily rate × days')}</option><option value="actual_sum">{label('جمع هزینهٔ واقعی مستقیم+غیرمستقیم', 'Actual direct+indirect')}</option></select></label>
                <label className="text-[11px] tx3">{label('شرح فرمول', 'Formula')}<input aria-label={label('شرح فرمول', 'Formula')} className={inputClass} value={ruleForm.FormulaFa} onChange={e => setRuleForm(f => ({ ...f, FormulaFa: e.target.value }))} /></label>
                <label className="text-[11px] tx3">{label('منبع قراردادی/ضابطه‌ای (الزامی)', 'Source (required)')}<input aria-label={label('منبع', 'Source')} className={inputClass} value={ruleForm.SourceFa} onChange={e => setRuleForm(f => ({ ...f, SourceFa: e.target.value }))} /></label>
                <label className="text-[11px] tx3">{label('نسخه', 'Version')}<input aria-label={label('نسخه', 'Version')} className={inputClass} value={ruleForm.Version} onChange={e => setRuleForm(f => ({ ...f, Version: e.target.value }))} /></label>
                <button className={btn} disabled={busy || !ruleForm.Code.trim() || !ruleForm.NameFa.trim() || !ruleForm.SourceFa.trim()} onClick={() => void mutate('/loss-rules', 'POST', ruleForm)}>{label('ثبت قاعده (نیازمند تأیید)', 'Add rule (needs approval)')}</button>
              </div>}
            </div>
          </section>;
        })()}
        {tab !== 'loss' && (hidden ? <p className="tx3 text-sm">{label('مجوز مشاهدهٔ این داده‌ها را ندارید.', 'You do not have permission to view these records.')}</p> : <section className="space-y-2">
          {!displayRows.length && <p className="tx3 text-sm p-3">{label('رکوردی برای این نما ثبت نشده؛ دادهٔ نمونه خودکار درج نمی‌شود.', 'No records in this view. Sample data is never inserted automatically.')}</p>}
          {displayRows.map(row => <article key={row.Id} className="glass-dark rounded-xl p-3 space-y-2 text-xs tx2">
            <div className="flex flex-wrap items-center gap-3"><strong className="tx1">{row.Code} — {row.TitleFa}</strong><span>{kind === 'claims' ? label(CLAIM_STATUS[row.Status]?.[0] ?? row.Status, CLAIM_STATUS[row.Status]?.[1] ?? row.Status) : kind === 'issues' ? label(ISSUE_STATUS[row.Status]?.[0] ?? row.Status, ISSUE_STATUS[row.Status]?.[1] ?? row.Status) : kind === 'delays' ? label(DELAY_STATUS[row.Status]?.[0] ?? row.Status, DELAY_STATUS[row.Status]?.[1] ?? row.Status) : row.Status}</span><span dir="ltr">v{row.RowVersion}</span><button className={btn} onClick={() => select(row)}>{label('جزئیات / انتخاب', 'Details / select')}</button></div>
            {kind === 'risks' && <><p>{label('امتیاز / مالک / پاسخ: ', 'Score / owner / response: ')}{String(row.Score)} · {String(row.Owner ?? '')} · {String(row.Response ?? '')}</p><p>{label('پیوند برنامه:', 'Planning link:')} WBS {String(row.WbsCode ?? '—')} · {label('فعالیت', 'Activity')} {String(row.ActivityCode ?? '—')} · Baseline {String(row.BaselineId ?? '—')}</p></>}
            {kind === 'changes' && <><p>{label('اثر مالی / روز / تصمیم: ', 'Cost / days / decision: ')}{String(row.CostImpact ?? '—')} · {String(row.TimeImpactDays ?? '—')} · {String(row.DecisionReason ?? '—')}</p><p>{label('پیوند برنامه:', 'Planning link:')} WBS {String(row.WbsCode ?? '—')} · {label('فعالیت', 'Activity')} {String(row.ActivityCode ?? '—')} · Baseline {String(row.BaselineId ?? '—')}</p>{row.ApplicationStatus === 'applied' && <p>{label('اعمال‌شده در نسخهٔ Baseline:', 'Applied to baseline revision:')} <span dir="ltr">{String(row.AppliedBaselineId ?? '—')}</span></p>}</>}
            {kind === 'risks' && tab === 'reserve' && <p>{label('ذخیره:', 'Reserve:')} {String(reserveOf(row).allocated ?? '—')} · {label('مصرف:', 'Used:')} {String(reserveOf(row).used ?? '—')} · {label('مانده:', 'Remaining:')} {String(reserveOf(row).remaining ?? '—')} · {label('بازبینی:', 'Review:')} <span dir="ltr">{reserveOf(row).reviewDate ?? '—'}</span>{reserveOf(row).reviewOverdue ? label(' (عقب‌افتاده)', ' (overdue)') : ''}{row.LastReviewedAt ? ` · ${label('آخرین بازبینی:', 'Last review:')} ${String(row.LastReviewedAt).slice(0, 10)}` : ''}</p>}
            {kind === 'issues' && <><p>{label('شدت / مالک / مهلت:', 'Severity / owner / due:')} {String(row.Severity ?? '—')} · {String(row.Owner ?? '')} · <span dir="ltr">{ewsOf(row).dueDate ?? '—'}</span>{ewsOf(row).code ? ` · ${ewsOf(row).code}` : ''}</p><p>{label('پیوند:', 'Links:')} {label('ریسک', 'Risk')} {String(row.RiskCode ?? '—')} · WBS {String(row.WbsCode ?? '—')} · {label('فعالیت', 'Activity')} {String(row.ActivityCode ?? '—')}</p>{row.ResolutionNote && <p>{label('رفع مسئله:', 'Resolution:')} {String(row.ResolutionNote)}</p>}{row.EscalationNote && <p>{label('تشدید:', 'Escalation:')} {String(row.EscalationNote)} · {label('سطح', 'Level')} {String(row.EscalationLevel ?? 0)}</p>}</>}
            {kind === 'delays' && <>
              <p>{label('طبقه‌بندی / بازه:', 'Category / window:')} {label(DELAY_CATEGORY[String(row.Category)]?.[0] ?? String(row.Category ?? '—'), DELAY_CATEGORY[String(row.Category)]?.[1] ?? String(row.Category ?? '—'))} · <span dir="ltr">{String(row.StartDate ?? '').slice(0, 10)} → {String(row.FinishDate ?? '').slice(0, 10)}</span>{row.IsCritical ? label(' · مسیر بحرانی', ' · critical path') : ''}</p>
              <p>{label('پیوند:', 'Links:')} {label('ادعا', 'Claim')} {String(row.ClaimCode ?? '—')} · {label('ریسک', 'Risk')} {String(row.RiskCode ?? '—')} · {label('مسئله', 'Issue')} {String(row.IssueCode ?? '—')} · WBS {String(row.WbsCode ?? '—')} · {label('فعالیت', 'Activity')} {String(row.ActivityCode ?? '—')}</p>
              <p>{label('برآورد / اثر بر اتمام:', 'Estimate / completion impact:')} {String(row.EstimatedDelayDays ?? '—')} · {String(row.CompletionImpactDays ?? '—')} {label('روز', 'days')} · {label('صورت‌وضعیت:', 'IPC:')} {(() => { const ipc = workspace.financialRefs.ipcs.find(item => item.id === row.IpcId); return ipc ? `${ipc.contractCode} #${ipc.serialNo ?? '—'}` : (String(row.IpcId ?? '—') || '—'); })()} · {label('اسناد EDMS:', 'EDMS documents:')} {(() => { const refs = Array.isArray(row.EvidenceRefs) ? row.EvidenceRefs : []; return refs.map(id => workspace.documentRefs.find(doc => doc.id === id)).filter(Boolean).map(doc => `${doc!.docNo}@${doc!.revision}`).join('؛ ') || '—'; })()} · {label('مرجع آزاد:', 'Free reference:')} {String(row.EvidenceRef ?? '—') || '—'}</p>
            </>}
            {kind === 'claims' && <>
              <p>{label('مبلغ / تمدید خواسته‌شده: ', 'Amount / requested EOT: ')}{String(row.Amount ?? '—')} · {String(row.ExtensionDays ?? '—')} {label('روز', 'days')} · {label('بند:', 'Clause:')} {String(row.Clause ?? '—')}</p>
              <p>{label('مهلت ابلاغ: ', 'Notice deadline: ')}<span dir="ltr">{noticeOf(row).dueAt ?? '—'}</span> · {noticeText(row)}{row.NoticeRef ? ` · ${label('مرجع:', 'Ref:')} ${String(row.NoticeRef)}` : ''}</p>
              {row.DeterminedAmount !== undefined && row.DeterminedAmount !== null && <p>{label('تعیین‌شده:', 'Determined:')} {String(row.DeterminedAmount)} · {String(row.DeterminedDays ?? '—')} {label('روز', 'days')}</p>}
              {row.SettlementAmount !== undefined && row.SettlementAmount !== null && <p>{label('تسویه‌شده:', 'Settled:')} {String(row.SettlementAmount)} · {String(row.SettlementDays ?? '—')} {label('روز', 'days')}</p>}
              {row.Status === 'draft' && Array.isArray(row.submissionIssues) && row.submissionIssues.length > 0 && <p className="text-amber-400">{label('موارد ناقص برای نهایی‌سازی:', 'Missing before finalization:')} {row.submissionIssues.length}</p>}
            </>}
          </article>)}
        </section>)}
        {tab !== 'loss' && (has(EDIT[kind]) || editing) && <form className="glass-dark rounded-xl p-4 space-y-3" onSubmit={e => { e.preventDefault(); void mutate(`/${kind}${editing ? '/' + encodeURIComponent(editing.Id) : ''}`, editing ? 'PATCH' : 'POST', { ...form, ...(editing ? { RowVersion: editing.RowVersion } : {}) }); }}>
          <div className="flex gap-3 tx1 text-sm"><h4>{editing ? label('رکورد انتخاب‌شده', 'Selected record') : label('ثبت جدید', 'Create record')}</h4><button type="button" className={btn} onClick={() => { setEditing(null); setForm(fresh(kind, workspace.today)); }}>{label('فرم جدید', 'New form')}</button></div>
          <fieldset disabled={busy || locked || !has(EDIT[kind])} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELDS[kind].map(([key, a, b, type]) => <label key={key} className="text-[11px] tx3">{label(a, b)}{kind === 'claims' && key === 'BaselineId'
              ? <select aria-label={label(a, b)} className={inputClass} value={String(form[key] ?? '')} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}><option value="">{label('— انتخاب Baseline —', '— Select baseline —')}</option>{workspace.planningRefs.baselines.map(base => <option key={base.id} value={base.id}>{base.name} · {base.id}{base.isCurrent ? label(' · جاری', ' · current') : ''}</option>)}{form[key] && !workspace.planningRefs.baselines.some(base => base.id === form[key]) && <option value={String(form[key])}>{String(form[key])}</option>}</select>
              : type === 'date'
                ? <JalaliDateInput ariaLabel={label(a, b)} className={inputClass} disabled={Boolean(editing && (key === 'Code' || (editing.NoticeDeliveredAt && ['EventDate', 'NoticeDays', 'Clause'].includes(key))))} value={String(form[key] ?? '')} onChange={v => setForm(f => ({ ...f, [key]: v }))} />
                : <input aria-label={label(a, b)} className={inputClass} type={type ?? 'text'} step={type === 'number' ? 'any' : undefined} disabled={Boolean(editing && (key === 'Code' || (editing.NoticeDeliveredAt && ['EventDate', 'NoticeDays', 'Clause'].includes(key))))} value={String(form[key] ?? '')} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value }))} />}</label>)}
            {(kind === 'risks' || kind === 'changes' || kind === 'issues' || kind === 'delays') && <>
              <label className="text-[11px] tx3">{label('گره WBS', 'WBS node')}<select aria-label={label('گره WBS', 'WBS node')} className={inputClass} value={String(form.WbsCode ?? '')} onChange={e => { const wbsCode = e.target.value; setForm(f => { const act = workspace.planningRefs.activities.find(a => a.code === f.ActivityCode); return { ...f, WbsCode: wbsCode, ActivityCode: act && act.wbsCode && act.wbsCode !== wbsCode ? '' : f.ActivityCode }; }); }}><option value="">{label('— بدون پیوند —', '— No link —')}</option>{workspace.planningRefs.wbs.map(w => <option key={w.code} value={w.code}>{w.code} — {w.nameFa}</option>)}</select></label>
              <label className="text-[11px] tx3">{label('فعالیت', 'Activity')}<select aria-label={label('فعالیت', 'Activity')} className={inputClass} value={String(form.ActivityCode ?? '')} onChange={e => { const activityCode = e.target.value; const act = workspace.planningRefs.activities.find(a => a.code === activityCode); setForm(f => ({ ...f, ActivityCode: activityCode, WbsCode: act?.wbsCode ?? f.WbsCode })); }}><option value="">{label('— بدون پیوند —', '— No link —')}</option>{workspace.planningRefs.activities.filter(a => !form.WbsCode || a.wbsCode === form.WbsCode).map(a => <option key={a.code} value={a.code}>{a.code} — {a.nameFa}</option>)}</select></label>
              {kind !== 'issues' && <label className="text-[11px] tx3">{label('برنامهٔ مبنا (Baseline)', 'Baseline')}<select aria-label={label('برنامهٔ مبنا (Baseline)', 'Baseline')} className={inputClass} value={String(form.BaselineId ?? '')} onChange={e => setForm(f => ({ ...f, BaselineId: e.target.value }))}><option value="">{label('— بدون پیوند —', '— No link —')}</option>{workspace.planningRefs.baselines.map(base => <option key={base.id} value={base.id}>{base.name} · {base.id}{base.isCurrent ? label(' · جاری', ' · current') : ''}</option>)}</select></label>}
            </>}
            {kind === 'risks' && <><select aria-label="Category" className={inputClass} value={String(form.Category ?? 'PM')} onChange={e => setForm(f => ({ ...f, Category: e.target.value }))}>{RBS.map(r => <option key={r.code} value={r.code}>{label(r.fa, r.en)}</option>)}</select><select aria-label="Status" className={inputClass} value={String(form.Status ?? 'open')} onChange={e => setForm(f => ({ ...f, Status: e.target.value }))}>{['open', 'mitigated', 'accepted'].map(s => <option key={s}>{s}</option>)}</select></>}
            {kind === 'changes' && <div className="col-span-full flex flex-wrap gap-3 tx2 text-xs">{IMPACT_DIMS.map(k => <label key={k}><input type="checkbox" checked={(form.Assessment as Record<string, boolean> | undefined)?.[k] === true} onChange={e => setForm(f => ({ ...f, Assessment: { ...(f.Assessment as object), [k]: e.target.checked } }))} /> {k}</label>)}</div>}
            {kind === 'risks' && <>
              <label className="text-[11px] tx3">{label('مبلغ ذخیره', 'Reserve amount')}<input aria-label={label('مبلغ ذخیره', 'Reserve amount')} className={inputClass} type="number" min="0" step="any" value={String(form.ReserveAmount ?? '')} onChange={e => setForm(f => ({ ...f, ReserveAmount: e.target.value === '' ? '' : Number(e.target.value) }))} /></label>
              <label className="text-[11px] tx3">{label('مصرف ذخیره', 'Used reserve')}<input aria-label={label('مصرف ذخیره', 'Used reserve')} className={inputClass} type="number" min="0" step="any" value={String(form.ReserveUsedAmount ?? '')} onChange={e => setForm(f => ({ ...f, ReserveUsedAmount: e.target.value === '' ? '' : Number(e.target.value) }))} /></label>
              <label className="text-[11px] tx3">{label('وضعیت ذخیره', 'Reserve status')}<select aria-label={label('وضعیت ذخیره', 'Reserve status')} className={inputClass} value={String(form.ReserveStatus ?? 'none')} onChange={e => setForm(f => ({ ...f, ReserveStatus: e.target.value }))}>{['none', 'allocated', 'partially_used', 'depleted', 'released'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <label className="text-[11px] tx3">{label('تاریخ بازبینی بعدی', 'Next review date')}<JalaliDateInput ariaLabel={label('تاریخ بازبینی بعدی', 'Next review date')} className={inputClass} value={String(form.NextReviewDate ?? '')} onChange={v => setForm(f => ({ ...f, NextReviewDate: v }))} /></label>
            </>}
            {kind === 'issues' && <>
              <label className="text-[11px] tx3">{label('شدت', 'Severity')}<select aria-label={label('شدت', 'Severity')} className={inputClass} value={String(form.Severity ?? 'medium')} onChange={e => setForm(f => ({ ...f, Severity: e.target.value }))}>{['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <label className="text-[11px] tx3">{label('ریسک مرتبط', 'Linked risk')}<select aria-label={label('ریسک مرتبط', 'Linked risk')} className={inputClass} value={String(form.RiskCode ?? '')} onChange={e => setForm(f => ({ ...f, RiskCode: e.target.value }))}><option value="">{label('— بدون پیوند —', '— No link —')}</option>{workspace.risks.map(r => <option key={r.Id} value={r.Code}>{r.Code} — {r.TitleFa}</option>)}{form.RiskCode && !workspace.risks.some(r => r.Code === form.RiskCode) && <option value={String(form.RiskCode)}>{String(form.RiskCode)}</option>}</select></label>
            </>}
            {kind === 'delays' && <>
              <label className="text-[11px] tx3">{label('طبقه‌بندی تأخیر', 'Delay category')}<select aria-label={label('طبقه‌بندی تأخیر', 'Delay category')} className={inputClass} value={String(form.Category ?? 'employer')} onChange={e => setForm(f => ({ ...f, Category: e.target.value }))}>{Object.entries(DELAY_CATEGORY).map(([code, title]) => <option key={code} value={code}>{label(title[0], title[1])}</option>)}</select></label>
              <label className="text-[11px] tx3">{label('وضعیت بررسی', 'Review status')}<input aria-label={label('وضعیت بررسی', 'Review status')} className={inputClass} disabled value={label(DELAY_STATUS[String(form.Status ?? 'under_review')]?.[0] ?? String(form.Status ?? 'under_review'), DELAY_STATUS[String(form.Status ?? 'under_review')]?.[1] ?? String(form.Status ?? 'under_review'))} /></label>
              <label className="text-[11px] tx3">{label('پیمان', 'Contract')}<select aria-label={label('پیمان', 'Contract')} className={inputClass} value={String(form.ContractCode ?? '')} onChange={e => setForm(f => ({ ...f, ContractCode: e.target.value, IpcId: '' }))}><option value="">{label('— بدون پیوند —', '— No link —')}</option>{workspace.financialRefs.contracts.map(contract => <option key={contract.id} value={contract.code}>{contract.code} — {contract.titleFa}</option>)}{form.ContractCode && !workspace.financialRefs.contracts.some(contract => contract.code === form.ContractCode) && <option value={String(form.ContractCode)}>{String(form.ContractCode)}</option>}</select></label>
              <label className="text-[11px] tx3">{label('صورت‌وضعیت', 'IPC')}<select aria-label={label('صورت‌وضعیت', 'IPC')} className={inputClass} value={String(form.IpcId ?? '')} onChange={e => { const ipc = workspace.financialRefs.ipcs.find(item => item.id === e.target.value); setForm(f => ({ ...f, IpcId: e.target.value, ContractCode: ipc?.contractCode || f.ContractCode })); }}><option value="">{label('— بدون پیوند —', '— No link —')}</option>{workspace.financialRefs.ipcs.filter(ipc => !form.ContractCode || ipc.contractCode === form.ContractCode).map(ipc => <option key={ipc.id} value={ipc.id}>{ipc.contractCode} · #{ipc.serialNo ?? '—'} · {ipc.periodCode} · {ipc.workflowState}</option>)}{form.IpcId && !workspace.financialRefs.ipcs.some(ipc => ipc.id === form.IpcId) && <option value={String(form.IpcId)}>{String(form.IpcId)}</option>}</select></label>
              <label className="text-[11px] tx3">{label('اسناد EDMS پیوندشده', 'Linked EDMS documents')}<select aria-label={label('اسناد EDMS پیوندشده', 'Linked EDMS documents')} className={inputClass} multiple size={4} value={Array.isArray(form.EvidenceRefs) ? form.EvidenceRefs.map(String) : []} onChange={e => setForm(f => ({ ...f, EvidenceRefs: Array.from(e.target.selectedOptions, option => option.value) }))}>{workspace.documentRefs.map(doc => <option key={doc.id} value={doc.id}>{doc.docNo}@{doc.revision} — {doc.titleFa}</option>)}</select><span className="tx3">{label('برای انتخاب چند سند، Ctrl/Cmd را نگه دارید.', 'Hold Ctrl/Cmd to select multiple documents.')}</span></label>
              <label className="text-[11px] tx3">{label('ادعای مرتبط', 'Linked claim')}<select aria-label={label('ادعای مرتبط', 'Linked claim')} className={inputClass} value={String(form.ClaimCode ?? '')} onChange={e => setForm(f => ({ ...f, ClaimCode: e.target.value }))}><option value="">{label('— بدون پیوند —', '— No link —')}</option>{workspace.claims.map(r => <option key={r.Id} value={r.Code}>{r.Code} — {r.TitleFa}</option>)}{form.ClaimCode && !workspace.claims.some(r => r.Code === form.ClaimCode) && <option value={String(form.ClaimCode)}>{String(form.ClaimCode)}</option>}</select></label>
              <label className="text-[11px] tx3">{label('ریسک مرتبط', 'Linked risk')}<select aria-label={label('ریسک مرتبط', 'Linked risk')} className={inputClass} value={String(form.RiskCode ?? '')} onChange={e => setForm(f => ({ ...f, RiskCode: e.target.value }))}><option value="">{label('— بدون پیوند —', '— No link —')}</option>{workspace.risks.map(r => <option key={r.Id} value={r.Code}>{r.Code} — {r.TitleFa}</option>)}{form.RiskCode && !workspace.risks.some(r => r.Code === form.RiskCode) && <option value={String(form.RiskCode)}>{String(form.RiskCode)}</option>}</select></label>
              <label className="text-[11px] tx3">{label('مسئله مرتبط', 'Linked issue')}<select aria-label={label('مسئله مرتبط', 'Linked issue')} className={inputClass} value={String(form.IssueCode ?? '')} onChange={e => setForm(f => ({ ...f, IssueCode: e.target.value }))}><option value="">{label('— بدون پیوند —', '— No link —')}</option>{workspace.issues.map(r => <option key={r.Id} value={r.Code}>{r.Code} — {r.TitleFa}</option>)}{form.IssueCode && !workspace.issues.some(r => r.Code === form.IssueCode) && <option value={String(form.IssueCode)}>{String(form.IssueCode)}</option>}</select></label>
              <label className="text-[11px] tx3"><span>{label('روی مسیر بحرانی است', 'On critical path')}</span><input aria-label={label('روی مسیر بحرانی است', 'On critical path')} type="checkbox" checked={form.IsCritical === true || form.IsCritical === 1 || form.IsCritical === '1'} onChange={e => setForm(f => ({ ...f, IsCritical: e.target.checked }))} /></label>
            </>}
            <button className={btn} type="submit">{label('ذخیره در سرور', 'Save to server')}</button>
          </fieldset>
          {locked && <p className="text-amber-400 text-xs">{label('رکورد قفل است؛ تغییر مشخصات مجاز نیست.', 'Record is locked; editing is not allowed.')}</p>}
          {kind === 'claims' && <p className="tx3 text-xs">{label('مهلت ۲۸ روز فقط مقدار اولیهٔ فرم است؛ طبق بند قرارداد اصلاح کنید. پس از ابلاغ، تاریخ، مهلت و بند قفل می‌شود؛ مستندات تا نهایی‌سازی قابل تکمیل است.', '28 days is only a form default; adjust to the contract. Notice date, period and clause are locked after recording; complete evidence before finalization.')}</p>}
        </form>}
        {editing && kind === 'delays' && <section className="glass-dark rounded-xl p-3 space-y-3">
          <h4 className="tx1 text-sm font-semibold">{label('محاسبات بخشنامه و برنامهٔ زمان‌بندی', 'Circular and schedule calculations')}</h4>
          <p className="tx3 text-xs">{label('محاسبه خام قطعی نیست؛ تأیید نهایی فقط توسط کاربر دیگری با مجوز تأیید انجام می‌شود. برای صورت‌وضعیت پیوندشده، داده‌های IPC و پیمان روی سرور خوانده می‌شود.', 'Raw output is not final; approval must be by another authorized user. Linked IPC and contract values are read by the server.')}</p>
          {editing.ReviewedBy && <p className="tx3 text-xs">{label('آخرین بررسی رویداد:', 'Latest event review:')} {String(editing.ReviewedBy)} · <span dir="ltr">{String(editing.ReviewedAt ?? '').slice(0, 10)}</span>{editing.ReviewNote ? ` · ${String(editing.ReviewNote)}` : ''}</p>}
          {has('rcc.delay.approve') && editing.CreatedBy !== userId && ['under_review', 'draft'].includes(editing.Status) && <div className="flex flex-wrap gap-2"><input className={inputClass} placeholder={label('یادداشت بررسی رویداد', 'Event review note')} value={delayReviewNote} onChange={e => setDelayReviewNote(e.target.value)} /><button className={btn} disabled={busy || !delayReviewNote.trim()} onClick={() => void mutate(`/delays/${encodeURIComponent(editing.Id)}/review`, 'POST', { reviewStatus: 'accepted', note: delayReviewNote, RowVersion: editing.RowVersion })}>{label('پذیرش رویداد', 'Accept event')}</button><button className={btn} disabled={busy || !delayReviewNote.trim()} onClick={() => void mutate(`/delays/${encodeURIComponent(editing.Id)}/review`, 'POST', { reviewStatus: 'rejected', note: delayReviewNote, RowVersion: editing.RowVersion })}>{label('رد رویداد', 'Reject event')}</button></div>}
          <div className="grid gap-2 md:grid-cols-3">
            <label className="text-[11px] tx3">{label('موتور', 'Engine')}<select aria-label={label('موتور', 'Engine')} className={inputClass} value={delayCalc.engine} onChange={e => setDelayCalc(v => ({ ...v, engine: e.target.value }))}><option value="circular5090">5090</option><option value="circular1300">1300</option><option value="schedule">{label('برنامهٔ زمان‌بندی', 'Schedule')}</option></select></label>
            {delayCalc.engine === 'circular5090' && <>
              <label className="text-[11px] tx3">{label('نوع صورت‌وضعیت', 'Statement type')}<select aria-label={label('نوع صورت‌وضعیت', 'Statement type')} className={inputClass} value={delayCalc.statementKind ?? 'interim'} onChange={e => setDelayCalc(v => ({ ...v, statementKind: e.target.value }))}><option value="interim">{label('موقت', 'Interim')}</option><option value="advance_first">{label('قسط اول پیش‌پرداخت', 'First advance')}</option><option value="advance_subsequent">{label('اقساط بعدی پیش‌پرداخت', 'Later advance')}</option></select></label>
              {(['submittedAt', 'actualPaidAt'] as const).map(k => <label key={k} className="text-[11px] tx3">{k === 'submittedAt' ? label('تاریخ تسلیم', 'Submission date') : label('تاریخ پرداخت واقعی', 'Actual payment date')}<JalaliDateInput ariaLabel={k} className={inputClass} value={delayCalc[k] ?? ''} onChange={v => setDelayCalc(prev => ({ ...prev, [k]: v }))} /></label>)}
              {([['contractPaymentDays', 'مهلت پرداخت طبق پیمان (روز)'], ['statementGrossAmount', 'مبلغ ناخالص صورت‌وضعیت'], ['statementPeriodDays', 'دوره صورت‌وضعیت (روز)'], ['initialContractDurationDays', 'مدت اولیه پیمان (روز)'], ['initialContractAmount', 'مبلغ اولیه پیمان'], ['latestStatementCumulativeAmount', 'مبلغ تجمعی آخرین صورت‌وضعیت']] as const).map(([k, title]) => <label key={k} className="text-[11px] tx3">{label(title, k)}<input aria-label={title} className={inputClass} type="number" min="0" step="any" value={delayCalc[k] ?? ''} onChange={e => setDelayCalc(v => ({ ...v, [k]: e.target.value }))} /></label>)}
              {delayCalc.statementKind === 'advance_subsequent' && <>
                <label className="text-[11px] tx3">{label('تاریخ دریافت قسط اول پیش‌پرداخت', 'First advance receipt date')}<JalaliDateInput ariaLabel="firstAdvanceReceivedDate" className={inputClass} value={delayCalc.firstAdvanceReceivedDate ?? ''} onChange={v => setDelayCalc(prev => ({ ...prev, firstAdvanceReceivedDate: v }))} /></label>
                <label className="text-[11px] tx3">{label('تاریخ آخرین صورت‌وضعیت', 'Latest statement date')}<JalaliDateInput ariaLabel="latestStatementDate" className={inputClass} value={delayCalc.latestStatementDate ?? ''} onChange={v => setDelayCalc(prev => ({ ...prev, latestStatementDate: v }))} /></label>
              </>}
            </>}
            {delayCalc.engine === 'circular1300' && <>
              <label className="text-[11px] tx3">{label('دوره صورت‌وضعیت (روز)', 'Statement period (days)')}<input aria-label="periodDays" className={inputClass} type="number" min="0" step="1" value={delayCalc.periodDays ?? ''} onChange={e => setDelayCalc(v => ({ ...v, periodDays: e.target.value }))} /></label>
              <label className="text-[11px] tx3"><span>{label('ماده ۳۷ دقیقاً رعایت شده است', 'Article 37 exactly complied')}</span><input aria-label="article37" type="checkbox" checked={delayCalc.article37ExactlyComplied === 'true'} onChange={e => setDelayCalc(v => ({ ...v, article37ExactlyComplied: String(e.target.checked) }))} /></label>
            </>}
            {delayCalc.engine === 'schedule' && <>
              <label className="text-[11px] tx3">{label('روش تحلیل', 'Analysis method')}<select aria-label="method" className={inputClass} value={delayCalc.method ?? 'impacted_as_planned'} onChange={e => setDelayCalc(v => ({ ...v, method: e.target.value }))}><option value="impacted_as_planned">Impacted As-Planned</option><option value="as_planned_as_built">As-Planned vs As-Built</option><option value="time_impact_analysis">TIA</option><option value="windows">Windows</option><option value="collapsed_as_built">Collapsed As-Built</option></select></label>
              <label className="text-[11px] tx3">{label('تاریخ داده', 'Data date')}<JalaliDateInput ariaLabel="dataDate" className={inputClass} value={delayCalc.dataDate ?? workspace.today} onChange={v => setDelayCalc(prev => ({ ...prev, dataDate: v }))} /></label>
              <label className="text-[11px] tx3">{label('مدت اثر رویداد (روز)', 'Event delay (days)')}<input aria-label="eventDelayDays" className={inputClass} type="number" min="0" step="1" value={delayCalc.eventDelayDays ?? String(editing.EstimatedDelayDays ?? '')} onChange={e => setDelayCalc(v => ({ ...v, eventDelayDays: e.target.value }))} /></label>
              {delayCalc.method === 'windows' && <label className="text-[11px] tx3 md:col-span-3">{label('Snapshot پنجره‌ها (JSON)', 'Window snapshots (JSON)')}<textarea aria-label="windowsJson" className={inputClass} dir="ltr" rows={7} placeholder='[{"label":"W1","dataDate":"2026-01-31","baselineActivities":[{"id":"A","nameFa":"...","duration":10}],"updatedActivities":[{"id":"A","nameFa":"...","duration":12}]}]' value={delayCalc.windowsJson ?? ''} onChange={e => setDelayCalc(v => ({ ...v, windowsJson: e.target.value }))} /><span>{label('هر پنجره باید Snapshot مبنا و به‌روز صریح داشته باشد؛ بدون آن نتیجه قطعی تولید نمی‌شود.', 'Each window needs explicit baseline and updated snapshots; otherwise no final result is produced.')}</span></label>}
            </>}
          </div>
          <button className={btn} disabled={busy || !has('rcc.delay.calculate')} onClick={() => {
            const numberKeys = ['contractPaymentDays', 'statementGrossAmount', 'statementPeriodDays', 'initialContractDurationDays', 'initialContractAmount', 'latestStatementCumulativeAmount', 'periodDays', 'eventDelayDays'];
            const body: Record<string, unknown> = { engine: delayCalc.engine, RowVersion: editing.RowVersion };
            for (const [key, value] of Object.entries(delayCalc)) if (key !== 'windowsJson' && value !== '') body[key] = numberKeys.includes(key) ? Number(value) : key === 'article37ExactlyComplied' ? value === 'true' : value;
            if (body.engine === 'schedule' && !body.method) body.method = 'impacted_as_planned';
            if (body.engine === 'schedule' && body.method === 'windows') {
              try { body.windows = JSON.parse(delayCalc.windowsJson || '[]'); } catch { setError(label('JSON Snapshot پنجره‌ها معتبر نیست', 'Window snapshot JSON is invalid')); return; }
              if (!Array.isArray(body.windows) || !body.windows.length) { setError(label('برای Windows، Snapshot صریح هر پنجره لازم است', 'Explicit snapshots are required for Windows')); return; }
            }
            void mutate(`/delays/${encodeURIComponent(editing.Id)}/calculate`, 'POST', body);
          }}>{label('محاسبه و ثبت نتیجهٔ خام', 'Calculate and store raw result')}</button>
          {selectedCalculations.length ? <div className="space-y-2">{selectedCalculations.map(calc => <article key={calc.Id} className="rounded-lg border b-line-soft p-3 text-xs tx2 space-y-2">
            <div className="flex flex-wrap gap-2"><strong className="tx1">{calc.Engine}{calc.Method ? ` · ${calc.Method}` : ''}</strong><span>{label(DELAY_STATUS[calc.Status]?.[0] ?? calc.Status, DELAY_STATUS[calc.Status]?.[1] ?? calc.Status)}</span><span dir="ltr">{calc.RuleVersion}</span><span>{label('خام:', 'Raw:')} <span dir="ltr">{calc.RawValueDays ?? '—'}</span></span><span>{label('نهایی:', 'Final:')} <span dir="ltr">{calc.FinalValueDays ?? '—'}</span></span></div>
            {(() => { let result: Record<string, unknown> = {}; try { result = typeof calc.Result === 'string' ? JSON.parse(calc.Result) as Record<string, unknown> : (calc.Result as Record<string, unknown> ?? {}); } catch { result = {}; }
              const issues = Array.isArray(result.issues) ? result.issues.map(String) : [];
              const limitations = Array.isArray(result.limitations) ? result.limitations.map(String) : [];
              const windows = Array.isArray(result.windowResults) ? result.windowResults as Record<string, unknown>[] : [];
              return <>{result.formula ? <p dir="ltr" className="tx3">{String(result.formula)}</p> : null}{issues.length ? <p className="text-amber-400">{label('نقص داده:', 'Data issues:')} {issues.join('؛ ')}</p> : null}{limitations.length ? <p className="tx3">{label('محدودیت روش:', 'Method limitations:')} {limitations.join('؛ ')}</p> : null}{windows.length ? <div className="space-y-1">{windows.map((window, index) => <p key={index} className="tx3">{String(window.label ?? '')}: <span dir="ltr">{String(window.baselineFinish ?? '—')} → {String(window.updatedFinish ?? '—')}</span> · {String(window.shiftDays ?? '—')} {label('روز', 'days')}</p>)}</div> : null}</>;
            })()}
            {calc.ApprovedBy && <p className="tx3">{label('تأیید:', 'Approval:')} {String(calc.ApprovedBy)} · <span dir="ltr">{String(calc.ApprovedAt ?? '').slice(0, 10)}</span>{calc.ApprovalNote ? ` · ${String(calc.ApprovalNote)}` : ''}</p>}
            {calc.Status !== 'approved' && has('rcc.delay.approve') && editing.CreatedBy !== userId && calc.CalculatedBy !== userId && <div className="flex flex-wrap gap-2"><input className={inputClass} placeholder={label('یادداشت تأیید کارشناسی', 'Expert approval note')} value={delayApprovalNote} onChange={e => setDelayApprovalNote(e.target.value)} /><button className={btn} disabled={busy || !delayApprovalNote.trim()} onClick={() => void mutate(`/delay-calculations/${encodeURIComponent(calc.Id)}/approve`, 'POST', { note: delayApprovalNote, RowVersion: calc.RowVersion })}>{label('تأیید محاسبه', 'Approve calculation')}</button></div>}
          </article>)}</div> : <p className="tx3 text-xs">{label('برای این رویداد هنوز محاسبه‌ای ثبت نشده است.', 'No calculation has been stored for this event yet.')}</p>}
          <div className="space-y-2 border-t b-line-soft pt-3">
            <h5 className="tx1 text-xs font-semibold">{label('ادعای مالی و هزینه‌های تمدید (Prolongation Costs)', 'Monetary / prolongation cost items')}</h5>
            {(() => { const items = (workspace.claimCostItems ?? []).filter(item => item.DelayEventId === editing.Id); return items.length ? <div className="space-y-1">{items.map(item => <p key={item.Id} className="rounded-lg border b-line-soft p-2 text-xs tx2">{label(({ guarantee_extension: 'تمدید ضمانت‌نامه‌ها', site_facilities: 'تجهیز کارگاه', overhead: 'پرسنل ثابت/سربار', suspension: 'هزینهٔ تعلیق', other: 'سایر' } as Record<string, string>)[item.CostType] ?? item.CostType, item.CostType)} — {item.TitleFa} · <span dir="ltr">{String(item.Amount)}</span>{item.Currency ? ` ${String(item.Currency)}` : ''} · {String(item.Status)}{has('rcc.delay.edit') && <button className={btn} disabled={busy} onClick={() => void mutate(`/cost-items/${encodeURIComponent(item.Id)}`, 'DELETE', undefined)}>{label('حذف', 'Delete')}</button>}</p>)}</div> : <p className="tx3 text-xs">{label('آیتم هزینه‌ای برای این رویداد ثبت نشده است.', 'No cost item recorded for this event.')}</p>; })()}
            {has('rcc.delay.edit') && <div className="grid gap-2 md:grid-cols-3">
              <label className="text-[11px] tx3">{label('دستهٔ خسارت', 'Loss category')}<select aria-label={label('دستهٔ خسارت', 'Loss category')} className={inputClass} value={String(costForm.CostType ?? 'overhead')} onChange={e => setCostForm(f => ({ ...f, CostType: e.target.value }))}>{LOSS_CATEGORIES.map(c => <option key={c.code} value={c.code}>{label(c.fa, c.en)}</option>)}</select></label>
              <label className="text-[11px] tx3">{label('ماهیت هزینه', 'Cost nature')}<select aria-label={label('ماهیت هزینه', 'Cost nature')} className={inputClass} value={String(costForm.CostNature ?? '')} onChange={e => setCostForm(f => ({ ...f, CostNature: e.target.value }))}><option value="">{label('نامشخص', 'Unspecified')}</option><option value="direct">{label('مستقیم', 'Direct')}</option><option value="indirect">{label('غیرمستقیم', 'Indirect')}</option></select></label>
              <label className="text-[11px] tx3">{label('مبلغ مستندشده', 'Documented amount')}<input aria-label={label('مبلغ مستندشده', 'Documented amount')} className={inputClass} type="number" min="0" step="any" value={String(costForm.DocumentedAmount ?? '')} onChange={e => setCostForm(f => ({ ...f, DocumentedAmount: e.target.value === '' ? '' : Number(e.target.value) }))} /></label>
              <label className="text-[11px] tx3">{label('مبلغ تأییدشدهٔ داخلی', 'Internally approved amount')}<input aria-label={label('مبلغ تأییدشدهٔ داخلی', 'Internally approved amount')} className={inputClass} type="number" min="0" step="any" value={String(costForm.ApprovedAmount ?? '')} onChange={e => setCostForm(f => ({ ...f, ApprovedAmount: e.target.value === '' ? '' : Number(e.target.value) }))} /></label>
              <label className="text-[11px] tx3">{label('مقدار / نرخ', 'Quantity / rate')}<span className="flex gap-1"><input aria-label={label('مقدار', 'Quantity')} className={inputClass} type="number" min="0" step="any" value={String(costForm.Quantity ?? '')} onChange={e => setCostForm(f => ({ ...f, Quantity: e.target.value === '' ? '' : Number(e.target.value) }))} /><input aria-label={label('نرخ', 'Rate')} className={inputClass} type="number" min="0" step="any" value={String(costForm.Rate ?? '')} onChange={e => setCostForm(f => ({ ...f, Rate: e.target.value === '' ? '' : Number(e.target.value) }))} /></span></label>
              <label className="text-[11px] tx3">{label('واحد / منبع', 'Unit / resource')}<span className="flex gap-1"><input aria-label={label('واحد', 'Unit')} className={inputClass} value={String(costForm.UnitFa ?? '')} onChange={e => setCostForm(f => ({ ...f, UnitFa: e.target.value }))} /><select aria-label={label('نوع منبع', 'Resource kind')} className={inputClass} value={String(costForm.ResourceKind ?? '')} onChange={e => setCostForm(f => ({ ...f, ResourceKind: e.target.value }))}><option value="">{label('بدون منبع', 'No resource')}</option><option value="labor">{label('نیروی انسانی', 'Labour')}</option><option value="machinery">{label('ماشین‌آلات', 'Machinery')}</option><option value="other">{label('سایر', 'Other')}</option></select></span></label>
              <label className="text-[11px] tx3">{label('نام منبع / کارکرد و توقف', 'Resource name / worked & idle')}<span className="flex gap-1"><input aria-label={label('نام منبع', 'Resource name')} className={inputClass} value={String(costForm.ResourceNameFa ?? '')} onChange={e => setCostForm(f => ({ ...f, ResourceNameFa: e.target.value }))} /><input aria-label={label('کارکرد', 'Worked units')} className={inputClass} type="number" min="0" step="any" value={String(costForm.WorkedUnits ?? '')} onChange={e => setCostForm(f => ({ ...f, WorkedUnits: e.target.value === '' ? '' : Number(e.target.value) }))} /><input aria-label={label('توقف', 'Idle units')} className={inputClass} type="number" min="0" step="any" value={String(costForm.IdleUnits ?? '')} onChange={e => setCostForm(f => ({ ...f, IdleUnits: e.target.value === '' ? '' : Number(e.target.value) }))} /></span></label>
              <label className="text-[11px] tx3">{label('عنوان هزینه', 'Cost title')}<input aria-label={label('عنوان هزینه', 'Cost title')} className={inputClass} value={String(costForm.TitleFa ?? '')} onChange={e => setCostForm(f => ({ ...f, TitleFa: e.target.value }))} /></label>
              <label className="text-[11px] tx3">{label('مبلغ', 'Amount')}<input aria-label={label('مبلغ', 'Amount')} className={inputClass} type="number" min="0" step="any" value={String(costForm.Amount ?? '')} onChange={e => setCostForm(f => ({ ...f, Amount: e.target.value === '' ? '' : Number(e.target.value) }))} /></label>
              <label className="text-[11px] tx3">{label('واحد پول', 'Currency')}<input aria-label={label('واحد پول', 'Currency')} className={inputClass} value={String(costForm.Currency ?? '')} onChange={e => setCostForm(f => ({ ...f, Currency: e.target.value }))} /></label>
              <label className="text-[11px] tx3">{label('از تاریخ', 'From')}<JalaliDateInput ariaLabel={label('از تاریخ', 'From')} className={inputClass} value={String(costForm.PeriodFrom ?? '')} onChange={v => setCostForm(f => ({ ...f, PeriodFrom: v }))} /></label>
              <label className="text-[11px] tx3">{label('تا تاریخ', 'To')}<JalaliDateInput ariaLabel={label('تا تاریخ', 'To')} className={inputClass} value={String(costForm.PeriodTo ?? '')} onChange={v => setCostForm(f => ({ ...f, PeriodTo: v }))} /></label>
              <label className="text-[11px] tx3 md:col-span-2">{label('مبنای محاسبه', 'Calculation basis')}<input aria-label={label('مبنای محاسبه', 'Calculation basis')} className={inputClass} value={String(costForm.Basis ?? '')} onChange={e => setCostForm(f => ({ ...f, Basis: e.target.value }))} /></label>
              <label className="text-[11px] tx3">{label('مستندات پشتیبان (EDMS)', 'Supporting documents')}<select aria-label={label('مستندات پشتیبان (EDMS)', 'Supporting documents')} className={inputClass} multiple size={4} value={Array.isArray(costForm.DocumentRefs) ? (costForm.DocumentRefs as string[]) : []} onChange={e => setCostForm(f => ({ ...f, DocumentRefs: Array.from(e.target.selectedOptions, o => o.value) }))}>{workspace.documentRefs.map(doc => <option key={doc.id} value={doc.id}>{doc.docNo}@{doc.revision} — {doc.titleFa}</option>)}</select></label>
              <button className={btn} disabled={busy || !String(costForm.TitleFa ?? '').trim() || costForm.Amount === ''} onClick={() => void mutate(`/delays/${encodeURIComponent(editing.Id)}/cost-items`, 'POST', { ...costForm, Amount: Number(costForm.Amount) })}>{label('ثبت آیتم هزینه', 'Add cost item')}</button>
            </div>}
          </div>
        </section>}
        {editing && kind === 'changes' && has('rcc.change.approve') && ['draft', 'pending'].includes(editing.Status) && <section className="glass-dark rounded-xl p-3 flex flex-wrap gap-2"><input className={inputClass} placeholder={label('دلیل تصمیم', 'Decision reason')} value={reason} onChange={e => setReason(e.target.value)} />{['approved', 'rejected'].map(decision => <button disabled={busy} key={decision} className={btn} onClick={() => void mutate(`/changes/${encodeURIComponent(editing.Id)}/decision`, 'POST', { decision, reason, RowVersion: editing.RowVersion })}>{decision}</button>)}</section>}
        {editing && kind === 'changes' && editing.Status === 'approved' && <section className="glass-dark rounded-xl p-3 space-y-3">
          <h4 className="tx1 text-sm font-semibold">{label('اعمال کنترل‌شدهٔ تغییر مصوب', 'Controlled application of approved change')}</h4>
          {editing.ApplicationStatus === 'applied'
            ? <p className="tx3 text-xs">{label('در نسخهٔ جدید Baseline اعمال شده است:', 'Applied to a new baseline revision:')} <span dir="ltr">{String(editing.AppliedBaselineId ?? '—')}</span> · {String(editing.AppliedBy ?? '')} · <span dir="ltr">{String(editing.AppliedAt ?? '').slice(0, 10)}</span>{editing.ApplicationNote ? ` · ${String(editing.ApplicationNote)}` : ''}</p>
            : <><p className="tx3 text-xs">{label('اعمال، یک نسخهٔ جدید و غیرجاری از Baseline مبدأ می‌سازد و Baseline جاری را بازنویسی نمی‌کند. برای اعمال، پیوند WBS یا فعالیت و Baseline جاری لازم است.', 'Application creates a new non-current revision from the source baseline and never overwrites the current baseline. A WBS/activity link and the current source baseline are required.')}</p>
              <div className="flex flex-wrap gap-2"><input className={inputClass} placeholder={label('یادداشت اعمال', 'Application note')} value={applicationNote} onChange={e => setApplicationNote(e.target.value)} /><button className={btn} disabled={busy || !has('rcc.change.approve') || !applicationNote.trim() || !(editing.WbsCode || editing.ActivityCode) || !editing.BaselineId} onClick={() => void mutate(`/changes/${encodeURIComponent(editing.Id)}/apply`, 'POST', { note: applicationNote, RowVersion: editing.RowVersion })}>{label('ساخت نسخهٔ Baseline و ثبت اعمال', 'Create baseline revision and record application')}</button></div></>}
        </section>}
        {editing && kind === 'risks' && tab === 'reserve' && <section className="glass-dark rounded-xl p-3 space-y-3">
          <h4 className="tx1 text-sm font-semibold">{label('ثبت بازبینی و پایش ذخیره', 'Record reserve review')}</h4>
          <div className="grid gap-2 md:grid-cols-3">
            <input className={inputClass} placeholder={label('یادداشت بازبینی', 'Review note')} value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
            <label className="text-[11px] tx3">{label('بازبینی بعدی', 'Next review')}<JalaliDateInput ariaLabel={label('بازبینی بعدی', 'Next review')} className={inputClass} value={reviewDate} onChange={v => setReviewDate(v)} /></label>
            <button className={btn} disabled={busy || !has('rcc.risk.edit') || !reviewNote.trim()} onClick={() => void mutate(`/risks/${encodeURIComponent(editing.Id)}/review`, 'POST', { note: reviewNote, nextReviewDate: reviewDate || null, reserveAmount: form.ReserveAmount === '' ? null : form.ReserveAmount, reserveUsedAmount: form.ReserveUsedAmount === '' ? null : form.ReserveUsedAmount, reserveStatus: form.ReserveStatus, RowVersion: editing.RowVersion })}>{label('ثبت بازبینی', 'Record review')}</button>
          </div>
          {editing.LastReviewedAt && <p className="tx3 text-xs">{label('آخرین بازبینی:', 'Last review:')} {String(editing.LastReviewedBy ?? '')} · <span dir="ltr">{String(editing.LastReviewedAt).slice(0, 10)}</span>{editing.MonitoringNote ? ` · ${String(editing.MonitoringNote)}` : ''}</p>}
        </section>}
        {editing && kind === 'issues' && (() => {
          const actions = ISSUE_ACTIONS.filter(action => action.from.includes(editing.Status) && has(action.actor === 'edit' ? 'rcc.issue.edit' : 'rcc.issue.escalate') && (action.actor === 'edit' || editing.CreatedBy !== userId));
          return <section className="glass-dark rounded-xl p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2"><h4 className="tx1 text-sm font-semibold">{label('گردش‌کار مسئله', 'Issue workflow')}</h4><span className="tx3 text-xs">{label(ISSUE_STATUS[editing.Status]?.[0] ?? editing.Status, ISSUE_STATUS[editing.Status]?.[1] ?? editing.Status)}</span>{ewsOf(editing).code && <span className="tx3 text-xs" dir="ltr">{ewsOf(editing).code}</span>}</div>
            {actions.length ? <><input className={inputClass} placeholder={label('یادداشت اقدام', 'Action note')} value={issueNote} onChange={e => setIssueNote(e.target.value)} /><div className="flex flex-wrap gap-2">{actions.map(action => <button key={action.id} className={btn} disabled={busy} onClick={() => runIssue(action)}>{label(action.fa, action.en)}</button>)}</div><p className="tx3 text-xs">{label('تشدید و بستن مسئله توسط ایجادکننده انجام نمی‌شود.', 'The creator cannot escalate or close their own issue.')}</p></> : <p className="tx3 text-xs">{label('برای وضعیت فعلی، با مجوز شما اقدامی در دسترس نیست.', 'No issue action is available for this status with your permissions.')}</p>}
          </section>;
        })()}
        {!editing && kind === 'claims' && <section className="glass-dark rounded-xl p-3 space-y-2">
          <h4 className="tx1 text-sm font-semibold">{label('چاپ لایحهٔ تمدید مدت (EOT)', 'Print the EOT claim document')}</h4>
          <p className="tx3 text-xs">{label('برای چاپ گزارش: ابتدا یک ادعا را از فهرست بالا با دکمهٔ «جزئیات / انتخاب» باز کنید؛ دکمه‌های «دانلود Word» و «دانلود / چاپ PDF» در بخش «لایحهٔ تمدید مدت (EOT)» پایین همان صفحه نمایش داده می‌شود. شرط تولید لایحه: حداقل یک رویداد تأخیر پیوندشده به ادعا و یک محاسبهٔ تأییدشده.', 'To print: open a claim from the list above with “Details / select”; the Word and PDF download buttons appear in the “Extension of Time document” section below. A linked delay event and an approved calculation are required.')}</p>
        </section>}
        {editing && kind === 'claims' && <section className="glass-dark rounded-xl p-3 space-y-3">
          <h4 className="tx1 text-sm font-semibold">{label('لایحهٔ تمدید مدت (EOT)', 'Extension of Time document')}</h4>
          <p className="tx3 text-xs">{label('خروجی فقط با رویداد تأخیر پیوندشده و محاسبهٔ تأییدشده ساخته می‌شود؛ دانلود از سرور انجام می‌شود. خروجی PDF، فایل باینری واقعی است که روی سرور تولید می‌شود.', 'Generated only from linked delay events and approved calculations; download is served by the server. PDF is a real binary PDF rendered on the server.')}</p>
          <div className="flex flex-wrap gap-2">
            {(['word', 'pdf'] as const).map(format => <button type="button" key={format} className={btn} disabled={eotBusy !== null} onClick={() => void downloadEot(editing.Id, format)}>{eotBusy === format ? label('در حال تولید…', 'Generating…') : format === 'word' ? label('دانلود Word', 'Download Word') : label('دانلود / چاپ PDF', 'Download / print PDF')}</button>)}
          </div>
          {eotNotice && <p role={eotNotice.ok ? 'status' : 'alert'} className={`rounded-xl p-3 text-xs ${eotNotice.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{eotNotice.text}</p>}
        </section>}
        {editing && kind === 'claims' && editing.Status === 'draft' && <section className="glass-dark rounded-xl p-3 space-y-3">
          {has('rcc.claim.edit') && !editing.NoticeDeliveredAt && <div className="grid gap-2 md:grid-cols-3">
            <input className={inputClass} placeholder={label('شماره / مرجع ابلاغ انجام‌شده', 'Reference of delivered notice')} value={noticeRef} onChange={e => setNoticeRef(e.target.value)} />
            <label className="text-[11px] tx3">{label('تاریخ واقعی ابلاغ', 'Actual delivery date')}<JalaliDateInput ariaLabel={label('تاریخ واقعی ابلاغ', 'Actual delivery date')} className={inputClass} value={noticeDate} onChange={v => setNoticeDate(v)} /></label>
            <button className={btn} disabled={busy || !noticeRef.trim() || !noticeDate} onClick={() => void mutate(`/claims/${encodeURIComponent(editing.Id)}/notice`, 'POST', { NoticeRef: noticeRef, DeliveredDate: noticeDate, RowVersion: editing.RowVersion })}>{label('ثبت ابلاغ انجام‌شده', 'Record delivered notice')}</button>
          </div>}
          {editing.NoticeDeliveredAt && <p className="tx3 text-xs">{label('ابلاغ ثبت شده است:', 'Notice recorded:')} <span dir="ltr">{String(editing.NoticeDeliveredAt).slice(0, 10)}</span> · {String(editing.NoticeRef ?? '')}</p>}
          {has('rcc.claim.submit') && <button className={btn} disabled={busy} onClick={() => void mutate(`/claims/${encodeURIComponent(editing.Id)}/submit`, 'POST', { RowVersion: editing.RowVersion })}>{label('نهایی‌سازی بستهٔ ادعا', 'Finalize claim package')}</button>}
          <p className="tx3 text-xs">{label('تاریخ واقعی ابلاغ ثبت می‌شود؛ ارسال نامه یا تحویل حقوقی به طرف قرارداد خودکار انجام نمی‌شود.', 'The actual delivery date is recorded; legal service or external delivery is not automated.')}</p>
        </section>}
        {editing && kind === 'claims' && (() => {
          const isClaimOwner = [editing.CreatedBy, editing.SubmittedBy].includes(userId);
          const actions = CLAIM_ACTIONS.filter(action => action.from.includes(editing.Status) && has(action.actor === 'edit' ? 'rcc.claim.edit' : 'rcc.claim.decide') && (action.actor === 'edit' ? isClaimOwner : !isClaimOwner));
          const needsValues = actions.some(action => action.values);
          return <section className="glass-dark rounded-xl p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2"><h4 className="tx1 text-sm font-semibold">{label('چرخهٔ تعیین تکلیف ادعا', 'Claim lifecycle')}</h4><span className="tx3 text-xs">{label(CLAIM_STATUS[editing.Status]?.[0] ?? editing.Status, CLAIM_STATUS[editing.Status]?.[1] ?? editing.Status)}</span></div>
            <div className="space-y-1 text-xs tx3">
              {editing.SubmittedBy && <p>{label('ارسال‌کننده:', 'Submitted by:')} {String(editing.SubmittedBy)} · <span dir="ltr">{String(editing.SubmittedAt ?? '').slice(0, 10)}</span></p>}
              {editing.ReviewBy && <p>{label('بررسی:', 'Review:')} {String(editing.ReviewBy)} · <span dir="ltr">{String(editing.ReviewAt ?? '').slice(0, 10)}</span>{editing.ReviewNote ? ` · ${String(editing.ReviewNote)}` : ''}</p>}
              {editing.DeterminedBy && <p>{label('تعیین:', 'Determination:')} {String(editing.DeterminedAmount ?? '—')} · {String(editing.DeterminedDays ?? '—')} {label('روز', 'days')} · {String(editing.DeterminationNote ?? '')}</p>}
              {editing.SettledBy && <p>{label('تسویه:', 'Settlement:')} {String(editing.SettlementAmount ?? '—')} · {String(editing.SettlementDays ?? '—')} {label('روز', 'days')} · {String(editing.SettlementNote ?? '')}</p>}
              {editing.DisputedBy && <p>{label('اختلاف:', 'Dispute:')} {String(editing.DisputeNote ?? '')}</p>}
              {editing.RejectedBy && <p>{label('رد:', 'Rejection:')} {String(editing.RejectionNote ?? '')}</p>}
              {editing.ClosedBy && <p>{label('بسته‌شدن:', 'Closure:')} {String(editing.ClosureNote ?? '')}</p>}
            </div>
            {actions.length ? <>
              <div className="grid gap-2 md:grid-cols-3">
                <input className={inputClass} placeholder={label('یادداشت / دلیل اقدام', 'Action note / reason')} value={lifecycleNote} onChange={e => setLifecycleNote(e.target.value)} />
                {needsValues && <><input aria-label={label('مبلغ تعیین یا تسویه', 'Determined/settled amount')} className={inputClass} type="number" min="0" step="any" placeholder={label('مبلغ', 'Amount')} value={lifecycleAmount} onChange={e => setLifecycleAmount(e.target.value)} /><input aria-label={label('مدت تعیین یا تسویه', 'Determined/settled days')} className={inputClass} type="number" min="0" step="1" placeholder={label('مدت (روز)', 'Days')} value={lifecycleDays} onChange={e => setLifecycleDays(e.target.value)} /></>}
              </div>
              <div className="flex flex-wrap gap-2">{actions.map(action => <button key={action.id} className={btn} disabled={busy} onClick={() => runLifecycle(action)}>{label(action.fa, action.en)}</button>)}</div>
              <p className="tx3 text-xs">{label('تفکیک تنظیم‌کننده/ارسال‌کننده از تعیین‌تکلیف‌کننده روی سرور هم کنترل می‌شود.', 'Separation between claim preparer/submitter and decision-maker is also enforced by the server.')}</p>
            </> : <p className="tx3 text-xs">{label('برای وضعیت فعلی، با مجوز شما اقدامی در دسترس نیست.', 'No lifecycle action is available for this status with your permissions.')}</p>}
          </section>;
        })()}
      </>}
    </>}
  </div>;
}
