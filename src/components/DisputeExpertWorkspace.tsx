/**
 * PMO-CONSTRUCTION-DISPUTE-EXPERT-ENGINE-V1.0 — داشبورد پرونده‌های اختلاف.
 * تب‌ها: داشبورد مدیریتی | پرونده‌ها | طرفین | مستندات/ادله | ادعاها/دفاعیات.
 * (تحلیل/گزارش/مهلت‌ها در فاز ۳–۴ تکمیل می‌شود؛ منوها به API واقعی متصل‌اند.)
 * تمام داده‌ها از API واقعی است؛ بدون تأیید مجوز dispute.* هیچ عمل صورت
 * نمی‌پذیرد و مبلغ تأییدشده با لایه‌های سه‌گانه (مطالبه/بررسی/تأیید) نمایش داده
 * می‌شود. LLM متصل نیست (کاتالوگ صادقانه اعلام می‌کند).
 */
import { useEffect, useRef, useState } from 'react';
import { type Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { disputeApi, type DisputeCase, type DisputeCatalog, type DisputeDashboard, type DisputeRow, type LinkSuggestions, type LinkResolution, type ManagementReportOut, CASE_STATUS_FA, PRIORITY_FA, CLAIM_BASIS_FA, REVIEW_STATUS_FA, EVIDENCE_STATUS_FA, LINK_KIND_CLIENT_FA, ANALYSIS_APPROVAL_CLIENT_FA, REPORT_STATUS_CLIENT_FA, HEARING_MINUTES_CLIENT_FA, OPINION_REVIEW_CLIENT_FA, OPINION_SOURCE_KIND_CLIENT_FA, MANAGEMENT_REPORTS_CLIENT, EMPTY } from '../services/disputeExpertClient';
import JalaliDateInput from './JalaliDateInput';

const btn = 'rounded-lg border b-line-soft px-2.5 py-1 text-[11px] transition hover:opacity-80 disabled:opacity-40';
const btnP = 'rounded-lg bg-[#1f4e79] px-3 py-1 text-[11px] text-white transition hover:opacity-90 disabled:opacity-40';
const card = 'rounded-xl border b-line-soft bg-white/60 p-3';
const kpi = 'rounded-xl border b-line-soft bg-white/70 p-3 text-center';
const inputClass = 'w-full rounded-lg border b-line-soft bg-transparent px-2 py-1 text-xs tx1';

type Tab = 'dashboard' | 'cases' | 'parties' | 'evidence' | 'claims' | 'analyses' | 'calculations' | 'links' | 'hearings' | 'opinions' | 'reports';

export default function DisputeExpertWorkspace(props: { lang: Lang; projectId: string }) {
  const { user } = useAuth();
  return <Live key={`${props.projectId}:${user?.id ?? ''}`} {...props} userId={user?.id ?? null} />;
}

function Live({ lang, projectId, userId }: { lang: Lang; projectId: string; userId: string | null }) {
  const fa = lang === 'fa';
  const label = (a: string, b: string) => (fa ? a : b);
  const [catalog, setCatalog] = useState<DisputeCatalog | null>(null);
  const [dashboard, setDashboard] = useState<DisputeDashboard | null>(null);
  const [cases, setCases] = useState<DisputeCase[]>([]);
  const [current, setCurrent] = useState<DisputeCase | null>(null);
  const [children, setChildren] = useState<Record<string, DisputeRow[]>>({});
  const [tab, setTab] = useState<Tab>('dashboard');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [caseForm, setCaseForm] = useState<Record<string, string>>({ TitleFa: '', SubjectCode: '', DescriptionFa: '', EmployerFa: '', ContractorFa: '', ConsultantFa: '', CourtRefFa: '', ExpertScopeFa: '', ClaimDescriptionFa: '', ClaimedAmount: '', Currency: 'IRR', ClaimedDelayDays: '', ContractCode: '', ClaimCode: '', IncidentDate: '', DeliveryDeadline: '', Priority: 'normal', InternalOwnerFa: '' });
  const [partyForm, setPartyForm] = useState<Record<string, string>>({ Role: 'contractor', NameFa: '', RepresentativeFa: '', ClaimLinkNoteFa: '' });
  const [docForm, setDocForm] = useState<Record<string, string>>({ DocType: 'correspondence', TitleFa: '', DocNo: '', Revision: '', SenderFa: '', ReceiverFa: '', ContractClauseRef: '', ExpertNoteFa: '' });
  const [claimForm, setClaimForm] = useState<Record<string, string>>({ TitleFa: '', ClaimantPartyCode: '', BasisKind: 'money', ClaimedAmount: '', ClaimedDelayDays: '', ContractClauseRef: '', DemandFa: '' });
  const [amountForm, setAmountForm] = useState<Record<string, string>>({ claimId: '', ReviewedAmount: '', ReviewBasisFa: '', ApprovedAmount: '', ApprovedBasisFa: '' });
  const [respForm, setRespForm] = useState<Record<string, string>>({ claimCode: '', ResponderPartyCode: '', BodyFa: '' });
  const [q, setQ] = useState('');
  /* فاز ۳ */
  const [suggestions, setSuggestions] = useState<LinkSuggestions | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [linkPick, setLinkPick] = useState<{ kind: string; target: string }>({ kind: 'delay_case', target: '' });
  const [resolutions, setResolutions] = useState<Record<string, LinkResolution>>({});
  const [resolvingId, setResolvingId] = useState('');
  /* فاز ۴ */
  const [heaForm, setHeaForm] = useState<Record<string, string>>({ TitleFa: '', MeetingDate: '', LocationFa: '', QuestionsFa: '', QuestionDeadline: '', MinutesBodyFa: '' });
  const [opiForm, setOpiForm] = useState<Record<string, string>>({ TitleFa: '', BodyFa: '', PreviousVersionCode: '', Version: '' });
  const [opiSources, setOpiSources] = useState<Record<string, boolean>>({});
  const [repTitle, setRepTitle] = useState('');
  const [docBusy, setDocBusy] = useState('');
  const [mgmtKind, setMgmtKind] = useState('cases_status');
  const [mgmt, setMgmt] = useState<ManagementReportOut | null>(null);
  const [mgmtBusy, setMgmtBusy] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(true);

  const can = (p: string) => catalog?.permissions.includes(p) ?? false;
  const parties = children.PmisDisputeParties ?? [];
  const claims = children.PmisDisputeClaims ?? [];
  const evidence = children.PmisDisputeEvidence ?? [];
  const responses = children.PmisDisputeResponses ?? [];
  const auditTrail = children.PmisDisputeAuditTrail ?? [];
  const analyses = children.PmisDisputeAnalyses ?? [];
  const calculations = children.PmisDisputeCalculations ?? [];
  const links = children.PmisDisputeModuleLinks ?? [];
  const hearings = children.PmisDisputeHearings ?? [];
  const opinions = children.PmisDisputeOpinions ?? [];
  const reportRows = children.PmisDisputeReports ?? [];
  const deadlines = children.PmisDisputeDeadlines ?? [];
  const caseLocked = current ? ['closed', 'archived'].includes(current.Status) : false;
  const fmtAmount = (v: unknown): string => { const n = Number(v); return Number.isFinite(n) && v !== null && v !== undefined && v !== '' ? n.toLocaleString('fa-IR') : EMPTY; };
  const subjectFa = (code: string | null | undefined): string => catalog?.subjects.find((s) => s.code === code)?.fa ?? (code || EMPTY);
  const statusFa = (s: string | null | undefined) => (s ? CASE_STATUS_FA[s] ?? s : EMPTY);

  async function loadAll() {
    const seq = ++generation.current;
    setLoading(true);
    const [cat, dash, list] = await Promise.all([
      disputeApi.catalog(projectId, userId), disputeApi.dashboard(projectId, userId), disputeApi.listCases(projectId, userId),
    ]);
    if (!mounted.current || seq !== generation.current) return;
    setLoading(false);
    if (!cat.ok) { setError(cat.message); return; }
    if (!dash.ok) { setError(dash.message); return; }
    if (!list.ok) { setError(list.message); return; }
    setCatalog(cat.data); setDashboard(dash.data); setCases(list.data.cases); setError('');
  }
  async function loadCase(id: string) {
    const seq = ++generation.current;
    const r = await disputeApi.case(projectId, userId, id);
    if (!mounted.current || seq !== generation.current) return;
    if (r.ok) { setCurrent(r.data.case); setChildren(r.data.children); setError(''); }
    else setError(r.message);
  }
  useEffect(() => { mounted.current = true; void loadAll(); return () => { mounted.current = false; generation.current++; }; }, [projectId, userId]);

  async function mutate(work: () => Promise<{ ok: boolean; message?: string; data?: unknown }>, after?: () => void) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    const r = await work();
    if (!mounted.current) return;
    if (!r.ok) { setError(r.message ?? label('خطای ناشناخته', 'Unknown error')); setBusy(false); return; }
    if (current) await loadCase(current.Id);
    await loadAll();
    after?.();
    if (mounted.current) setBusy(false);
  }

  const createCase = () => mutate(async () => {
    const body: Record<string, unknown> = { };
    for (const [k, v] of Object.entries(caseForm)) if (v !== '') body[k] = v;
    if (body.ClaimedAmount) body.ClaimedAmount = Number(body.ClaimedAmount);
    if (body.ClaimedDelayDays) body.ClaimedDelayDays = Number(body.ClaimedDelayDays);
    const r = await disputeApi.createCase(projectId, userId, body);
    if (r.ok) { setShowCreate(false); setNotice(label(`پروندهٔ ${r.data.case.Code} ایجاد شد.`, `Case ${r.data.case.Code} created.`)); void loadCase(r.data.case.Id); }
    return r;
  });
  const transition = (to: string, noteFa?: string) => current && mutate(() => disputeApi.transition(projectId, userId, current.Id, to, noteFa), () => setNotice(label('گذر وضعیت انجام شد.', 'Status changed.')));
  const deleteCase = () => current && mutate(() => disputeApi.deleteCase(projectId, userId, current.Id), () => { setCurrent(null); setChildren({}); setNotice(label('پروندهٔ پیش‌نویس حذف شد.', 'Draft case deleted.')); });
  const addParty = () => current && mutate(async () => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(partyForm)) if (v !== '') body[k] = v;
    const r = await disputeApi.addRow(projectId, userId, current.Id, 'PmisDisputeParties', body);
    if (r.ok) setPartyForm({ Role: 'contractor', NameFa: '', RepresentativeFa: '', ClaimLinkNoteFa: '' });
    return r;
  }, () => setNotice(label('طرف ثبت شد.', 'Party registered.')));
  const addDoc = () => current && mutate(async () => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(docForm)) if (v !== '') body[k] = v;
    const r = await disputeApi.addRow(projectId, userId, current.Id, 'PmisDisputeEvidence', body);
    if (r.ok) setDocForm({ DocType: 'correspondence', TitleFa: '', DocNo: '', Revision: '', SenderFa: '', ReceiverFa: '', ContractClauseRef: '', ExpertNoteFa: '' });
    return r;
  }, () => setNotice(label('مدرک ثبت شد.', 'Evidence registered.')));
  const addClaim = () => current && mutate(async () => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(claimForm)) if (v !== '') body[k] = v;
    if (body.ClaimedAmount) body.ClaimedAmount = Number(body.ClaimedAmount);
    if (body.ClaimedDelayDays) body.ClaimedDelayDays = Number(body.ClaimedDelayDays);
    const r = await disputeApi.addRow(projectId, userId, current.Id, 'PmisDisputeClaims', body);
    if (r.ok) setClaimForm({ TitleFa: '', ClaimantPartyCode: '', BasisKind: 'money', ClaimedAmount: '', ClaimedDelayDays: '', ContractClauseRef: '', DemandFa: '' });
    return r;
  }, () => setNotice(label('ادعا ثبت شد.', 'Claim registered.')));
  const addResponse = () => current && mutate(async () => {
    const body: Record<string, unknown> = { ClaimCode: respForm.claimCode, ResponderPartyCode: respForm.ResponderPartyCode, BodyFa: respForm.BodyFa };
    const r = await disputeApi.addRow(projectId, userId, current.Id, 'PmisDisputeResponses', body);
    if (r.ok) setRespForm({ claimCode: '', ResponderPartyCode: '', BodyFa: '' });
    return r;
  }, () => setNotice(label('پاسخ ثبت شد.', 'Response registered.')));
  const setAmounts = () => current && mutate(async () => {
    const body: Record<string, unknown> = { };
    if (amountForm.ReviewedAmount !== '') { body.ReviewedAmount = Number(amountForm.ReviewedAmount); body.ReviewBasisFa = amountForm.ReviewBasisFa; }
    if (amountForm.ApprovedAmount !== '') { body.ApprovedAmount = Number(amountForm.ApprovedAmount); body.ApprovedBasisFa = amountForm.ApprovedBasisFa; }
    const r = await disputeApi.patchRow(projectId, userId, current.Id, 'PmisDisputeClaims', amountForm.claimId, body);
    if (r.ok) setAmountForm({ claimId: '', ReviewedAmount: '', ReviewBasisFa: '', ApprovedAmount: '', ApprovedBasisFa: '' });
    return r;
  }, () => setNotice(label('مبالغ لایه‌بندی به‌روزرسانی شد.', 'Amount layers updated.')));
  const setEvidenceCheck = (rowId: string, field: 'AuthenticityStatus' | 'SufficiencyStatus', value: string) => current && mutate(() =>
    disputeApi.patchRow(projectId, userId, current.Id, 'PmisDisputeEvidence', rowId, { [field]: value }),
    () => setNotice(label('وضعیت اصالت/کفایت ثبت شد.', 'Evidence check recorded.')));
  const removeRow = (table: string, rowId: string) => current && mutate(() => disputeApi.deleteRow(projectId, userId, current.Id, table, rowId));

  /* ── فاز ۳: تحلیل/محاسبه/پیوند ── */
  const runAnalysis = () => current && mutate(() => disputeApi.runAnalysis(projectId, userId, current.Id),
    () => setNotice(label('تحلیل قاعده‌محور تولید/به‌روزرسانی شد؛ همهٔ خروجی‌ها پیش‌نویس‌اند و تا تأیید کارشناس انسانی مؤثر نیستند.', 'Rule-based analysis generated — drafts pending expert approval.')));
  const recalcCalcs = () => current && mutate(() => disputeApi.recalcCalculations(projectId, userId, current.Id),
    () => setNotice(label('شاخص‌های جمع بازمحاسبه شد (مقادیر ماژول‌های دیگر بازمحاسبه نمی‌شوند).', 'Totals recalculated (other modules never recomputed).')));
  const setAnalysisStatus = (rowId: string, status: string) => current && mutate(
    () => disputeApi.patchRow(projectId, userId, current.Id, 'PmisDisputeAnalyses', rowId, { ApprovalStatus: status }),
    () => setNotice(label(`وضعیت تأیید تحلیل → ${ANALYSIS_APPROVAL_CLIENT_FA[status] ?? status}`, `Analysis status → ${status}`)));
  async function loadSuggestions() {
    if (!current || suggestBusy) return;
    setSuggestBusy(true);
    const r = await disputeApi.linkSuggestions(projectId, userId, current.Id);
    if (mounted.current) { if (r.ok) setSuggestions(r.data); else setError(r.message); setSuggestBusy(false); }
  }
  const attachLink = () => {
    if (!current || !linkPick.target) { setError(label('ابتدا نامزدها را بارگذاری و هدف پیوند را انتخاب کنید.', 'Load candidates and pick a target first.')); return; }
    const kind = linkPick.kind;
    const pool = (suggestions as unknown as Record<string, { code: string; titleFa: string }[] | undefined>)?.[kind] ?? [];
    const cand = pool.find((c) => c.code === linkPick.target);
    mutate(async () => {
      const r = await disputeApi.addRow(projectId, userId, current.Id, 'PmisDisputeModuleLinks', {
        LinkKind: kind, TargetCode: linkPick.target, TargetTitleFa: cand?.titleFa || linkPick.target,
        TargetId: cand?.code || null, EstablishedBy: userId, EstablishedAt: new Date().toISOString(),
      });
      if (r.ok) { setLinkPick({ kind, target: '' }); void loadSuggestions(); }
      return r;
    }, () => setNotice(label('پیوند نرم برقرار شد (ماژول مقصد تغییری نمی‌کند).', 'Soft link attached (target module untouched).')));
  };
  async function toggleResolve(rowId: string) {
    if (!current) return;
    if (resolutions[rowId]) { setResolutions((m) => { const n = { ...m }; delete n[rowId]; return n; }); return; }
    setResolvingId(rowId);
    const r = await disputeApi.resolveLink(projectId, userId, current.Id, rowId);
    if (mounted.current) { if (r.ok) setResolutions((m) => ({ ...m, [rowId]: r.data })); else setError(r.message); setResolvingId(''); }
  }
  /** خلاصهٔ خواندنی هدف پیوند — فقط کلیدهای معنادار و تصویرشده. */
  function targetPairs(t: Record<string, unknown>): [string, unknown][] {
    const keys = ['Code', 'DocNo', 'Revision', 'TitleFa', 'Status', 'Category', 'SourceParty', 'StartDate', 'FinishDate', 'CompletionImpactDays', 'EstimatedDelayDays', 'IsCritical', 'Amount', 'DocumentedAmount', 'ApprovedAmount', 'CostType', 'DeterminedAmount', 'SettlementAmount', 'ResidualScore', 'ResidualBand', 'InherentBand', 'ContractCode', 'ClauseRef', 'IssuedAt', 'CalculatedAt'];
    return keys.filter((k) => t[k] !== null && t[k] !== undefined && t[k] !== '').map((k) => [k, t[k]]);
  }

  /* ── فاز ۴: جلسات / نظریات / گزارش‌ها ── */
  const addHearing = () => current && mutate(async () => {
    if (!heaForm.TitleFa.trim() || !heaForm.MeetingDate.trim()) return { ok: false, message: label('عنوان و تاریخ جلسه الزامی است', 'Title and date are required') };
    const questions = heaForm.QuestionsFa.split('\n').map((x) => x.trim()).filter(Boolean);
    const body: Record<string, unknown> = {
      TitleFa: heaForm.TitleFa.trim(), MeetingDate: heaForm.MeetingDate.trim(),
      LocationFa: heaForm.LocationFa || null, QuestionsJson: questions,
      QuestionDeadline: heaForm.QuestionDeadline || null, MinutesBodyFa: heaForm.MinutesBodyFa || null,
    };
    if (body.QuestionDeadline) body.QuestionDeadlineNoteFa = 'سررسید پاسخ → مهلت خودکار در تب ارجاعات ثبت می‌شود';
    const r = await disputeApi.addRow(projectId, userId, current.Id, 'PmisDisputeHearings', body);
    if (r.ok) setHeaForm({ TitleFa: '', MeetingDate: '', LocationFa: '', QuestionsFa: '', QuestionDeadline: '', MinutesBodyFa: '' });
    return r;
  }, () => setNotice(label(heaForm.QuestionDeadline ? 'جلسه ثبت شد؛ مهلت پاسخ پرسش‌ها به‌صورت خودکار در ارجاعات ایجاد شد.' : 'جلسه ثبت شد.', 'Hearing registered.')));
  const setMinutesStatus = (rowId: string, status: string) => current && mutate(async () => {
    const body: Record<string, unknown> = { MinutesStatus: status };
    if (status === 'signed') body.SignedAt = new Date().toISOString().slice(0, 10);
    return disputeApi.patchRow(projectId, userId, current.Id, 'PmisDisputeHearings', rowId, body);
  }, () => setNotice(label('وضعیت صورت‌جلسه به‌روزرسانی شد.', 'Minutes status updated.')));
  const addOpinion = () => current && mutate(async () => {
    if (!opiForm.TitleFa.trim() || !opiForm.BodyFa.trim()) return { ok: false, message: label('عنوان و متن نظریه الزامی است', 'Title and body are required') };
    const sources = Object.entries(opiSources).filter(([, on]) => on).map(([k]) => { const [kind, ...rest] = k.split('|'); return { kind, code: rest.join('|') }; });
    const body: Record<string, unknown> = {
      TitleFa: opiForm.TitleFa.trim(), BodyFa: opiForm.BodyFa.trim(),
      SourcesJson: sources, AuthoredBy: userId, AuthoredAt: new Date().toISOString(),
    };
    if (opiForm.PreviousVersionCode && opiForm.Version) { body.PreviousVersionCode = opiForm.PreviousVersionCode; body.Version = Number(opiForm.Version); }
    const r = await disputeApi.addRow(projectId, userId, current.Id, 'PmisDisputeOpinions', body);
    if (r.ok) { setOpiForm({ TitleFa: '', BodyFa: '', PreviousVersionCode: '', Version: '' }); setOpiSources({}); }
    return r;
  }, () => setNotice(label('نظریهٔ کارشناسی ثبت شد (پیش‌نویس — تا تأیید/نهایی انسانی مؤثر نیست).', 'Opinion saved (draft).')));
  const cloneOpinionVersion = (o: DisputeRow) => {
    setOpiForm({ TitleFa: String(o.TitleFa ?? ''), BodyFa: '', PreviousVersionCode: String(o.Code ?? ''), Version: String((Number(o.Version) || 1) + 1) });
    setNotice(label(`فرم «نسخهٔ ${String((Number(o.Version) || 1) + 1)}» نظریه آماده شد — متن جدید را بنویسید و ثبت کنید.`, 'New version form ready.'));
    setTab('opinions');
  };
  const setOpinionStatus = (rowId: string, status: string) => current && mutate(
    () => disputeApi.patchRow(projectId, userId, current.Id, 'PmisDisputeOpinions', rowId, { ReviewStatus: status }),
    () => setNotice(label(`وضعیت نظریه → ${OPINION_REVIEW_CLIENT_FA[status] ?? status}`, `Opinion → ${status}`)));
  const createReport = () => current && mutate(async () => {
    if (!repTitle.trim()) return { ok: false, message: label('عنوان نسخهٔ گزارش الزامی است', 'Report title required') };
    const r = await disputeApi.createReport(projectId, userId, current.Id, { TitleFa: repTitle.trim() });
    if (r.ok) setRepTitle('');
    return r;
  }, () => setNotice(label('نسخهٔ گزارش (پیش‌نویس) ثبت شد — تا تأیید و صدور نهایی نیست.', 'Report version registered (draft).')));
  const setReportStatus = (rowId: string, to: string) => current && mutate(
    () => disputeApi.setReportStatus(projectId, userId, current.Id, rowId, to),
    () => setNotice(label(`گذر وضعیت نسخهٔ گزارش → ${REPORT_STATUS_CLIENT_FA[to] ?? to}`, `Report → ${to}`)));
  async function downloadDoc(rowId: string, format: 'word' | 'pdf') {
    if (!current || docBusy) return;
    setDocBusy(rowId + ':' + format);
    try {
      const res = await fetch(disputeApi.reportDocumentUrl(projectId, current.Id, rowId, format), { headers: { ...(userId ? { 'x-user-id': userId } : {}) } });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message || label('تولید سند انجام نشد', 'Document generation failed'));
      }
      const blob = await res.blob();
      if (!blob.size) throw new Error(label('فایل خروجی خالی است', 'Empty file'));
      const filename = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `ExpertReport.${format === 'pdf' ? 'pdf' : 'doc'}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
      document.body.appendChild(anchor); anchor.click();
      window.setTimeout(() => anchor.remove(), 1000);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice(label(`دانلود آغاز شد: ${filename} (از دادهٔ واقعی پرونده — ۲۰ فصل)`, `Download started: ${filename}`));
      await loadCase(current.Id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : label('تولید سند انجام نشد', 'Generation failed');
      if (mounted.current) setError(msg);
    } finally {
      if (mounted.current) setDocBusy('');
    }
  }
  async function loadMgmt() {
    if (mgmtBusy) return;
    setMgmtBusy(true);
    const r = await disputeApi.managementReport(projectId, userId, mgmtKind);
    if (mounted.current) { if (r.ok) setMgmt(r.data); else setError(r.message); setMgmtBusy(false); }
  }

  if (loading && !catalog) return <p className="tx3 p-4">{label('در حال بارگذاری…', 'Loading…')}</p>;
  if (!catalog) return <p className="tx3 p-4">{label('دسترسی انجام نشد — مجوز dispute.view لازم است.', 'No access — dispute.view required.')}</p>;

  const TABS: { id: Tab; fa: string; en: string }[] = [
    { id: 'dashboard', fa: 'داشبورد مدیریتی', en: 'Executive dashboard' },
    { id: 'cases', fa: 'مدیریت پرونده‌ها', en: 'Cases' },
    { id: 'parties', fa: 'طرفین و نمایندگان', en: 'Parties' },
    { id: 'evidence', fa: 'مستندات و ادله', en: 'Evidence' },
    { id: 'claims', fa: 'ادعاها و دفاعیات', en: 'Claims & defenses' },
    { id: 'analyses', fa: 'تحلیل‌های کارشناسی', en: 'Analyses' },
    { id: 'calculations', fa: 'محاسبات مستقل (مقایسه)', en: 'Comparison calcs' },
    { id: 'links', fa: 'پیوندهای ماژولی', en: 'Module links' },
    { id: 'hearings', fa: 'جلسات و صورت‌جلسات', en: 'Hearings' },
    { id: 'opinions', fa: 'نظریات کارشناسی', en: 'Opinions' },
    { id: 'reports', fa: 'گزارش‌ها', en: 'Reports' },
  ];

  return (
    <div className="space-y-3 p-3" dir={fa ? 'rtl' : 'ltr'}>
      {/* سرخط + وضعیت اتصال */}
      <div className={`${card} flex flex-wrap items-center gap-2`}>
        <div className="flex-1 min-w-[220px]">
          <h2 className="tx1 text-sm font-bold">{label('کارشناسی، داوری و تحلیل دعاوی ساخت', 'Construction dispute expert engine')}</h2>
          <p className="tx3 text-[10px]">{catalog.module} — {label('دستیار قاعده‌محور؛ LLM متصل نیست.', 'Rule-based assistance; no LLM connection.')}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{label('خروجی: پیش‌نویس تا تأیید کارشناس', 'Draft until expert approval')}</span>
        {!catalog.llmConnected && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">llmConnected: false</span>}
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">{notice}</p> : null}

      {/* تب‌ها */}
      <div className="flex flex-wrap gap-1 border-b b-line-soft pb-1">
        {TABS.map((t) => <button key={t.id} className={`${btn} ${tab === t.id ? 'bg-[#1f4e79] text-white' : ''}`} onClick={() => setTab(t.id)}>{label(t.fa, t.en)}</button>)}
        <span className="flex-1" />
        <input className={`${inputClass} max-w-[200px] !w-auto`} placeholder={label('جست‌وجوی پرونده…', 'Search cases…')} value={q} onChange={(e) => setQ(e.target.value)} />
        {can('dispute.edit') && tab !== 'dashboard' && <button className={btnP} onClick={() => setShowCreate((v) => !v)}>{label('پروندهٔ جدید', 'New case')}</button>}
      </div>

      {/* فرم ایجاد پرونده */}
      {showCreate && (
        <div className={card}>
          <h3 className="tx1 mb-2 text-xs font-bold">{label('ایجاد پروندهٔ اختلاف', 'New dispute case')}</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <input className={inputClass} placeholder={label('عنوان پرونده *', 'Title *')} value={caseForm.TitleFa} onChange={(e) => setCaseForm((f) => ({ ...f, TitleFa: e.target.value }))} />
            <select className={inputClass} value={caseForm.SubjectCode} onChange={(e) => setCaseForm((f) => ({ ...f, SubjectCode: e.target.value }))}>
              <option value="">{label('موضوع اختلاف *', 'Subject *')}</option>
              {catalog.subjects.map((s) => <option key={s.code} value={s.code}>{s.fa}</option>)}
            </select>
            <input className={inputClass} placeholder={label('کارفرما', 'Employer')} value={caseForm.EmployerFa} onChange={(e) => setCaseForm((f) => ({ ...f, EmployerFa: e.target.value }))} />
            <input className={inputClass} placeholder={label('پیمانکار', 'Contractor')} value={caseForm.ContractorFa} onChange={(e) => setCaseForm((f) => ({ ...f, ContractorFa: e.target.value }))} />
            <input className={inputClass} placeholder={label('مشاور', 'Consultant')} value={caseForm.ConsultantFa} onChange={(e) => setCaseForm((f) => ({ ...f, ConsultantFa: e.target.value }))} />
            <input className={inputClass} placeholder={label('مرجع رسیدگی', 'Referring authority')} value={caseForm.CourtRefFa} onChange={(e) => setCaseForm((f) => ({ ...f, CourtRefFa: e.target.value }))} />
            <input className={inputClass} placeholder={label('کد قرارداد (نرم)', 'Contract code (soft)')} value={caseForm.ContractCode} onChange={(e) => setCaseForm((f) => ({ ...f, ContractCode: e.target.value }))} />
            <input className={inputClass} placeholder={label('کد ادعا (نرم)', 'Claim code (soft)')} value={caseForm.ClaimCode} onChange={(e) => setCaseForm((f) => ({ ...f, ClaimCode: e.target.value }))} />
            <input className={inputClass} placeholder={label('مبلغ مورد مطالبه', 'Claimed amount')} inputMode="numeric" value={caseForm.ClaimedAmount} onChange={(e) => setCaseForm((f) => ({ ...f, ClaimedAmount: e.target.value }))} />
            <input className={inputClass} placeholder={label('مدت ادعایی (روز)', 'Claimed days')} inputMode="numeric" value={caseForm.ClaimedDelayDays} onChange={(e) => setCaseForm((f) => ({ ...f, ClaimedDelayDays: e.target.value }))} />
            <div className="flex items-center gap-1"><span className="tx3 text-[10px]">{label('تاریخ وقوع:', 'Incident:')}</span><JalaliDateInput value={caseForm.IncidentDate} onChange={(v: string) => setCaseForm((f) => ({ ...f, IncidentDate: v }))} /></div>
            <div className="flex items-center gap-1"><span className="tx3 text-[10px]">{label('مهلت تحویل:', 'Delivery:')}</span><JalaliDateInput value={caseForm.DeliveryDeadline} onChange={(v: string) => setCaseForm((f) => ({ ...f, DeliveryDeadline: v }))} /></div>
            <select className={inputClass} value={caseForm.Priority} onChange={(e) => setCaseForm((f) => ({ ...f, Priority: e.target.value }))}>
              {Object.entries(PRIORITY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className={inputClass} placeholder={label('مسئول پیگیری', 'Internal owner')} value={caseForm.InternalOwnerFa} onChange={(e) => setCaseForm((f) => ({ ...f, InternalOwnerFa: e.target.value }))} />
          </div>
          <textarea className={`${inputClass} mt-2 h-16`} placeholder={label('شرح خواسته‌ها / حدود مأموریت', 'Claims description / expert scope')} value={caseForm.ClaimDescriptionFa} onChange={(e) => setCaseForm((f) => ({ ...f, ClaimDescriptionFa: e.target.value }))} />
          <div className="mt-2 flex gap-2">
            <button className={btnP} disabled={busy || !caseForm.TitleFa || !caseForm.SubjectCode} onClick={() => void createCase()}>{label('ثبت پرونده', 'Create case')}</button>
            <button className={btn} onClick={() => setShowCreate(false)}>{label('انصراف', 'Cancel')}</button>
          </div>
        </div>
      )}

      {/* بدنهٔ تب‌ها */}
      {tab === 'dashboard' && dashboard && (
        <div className="grid gap-3 lg:grid-cols-3">
          {/* KPI‌ها */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:col-span-3 xl:grid-cols-6">
            {[
              [label('کل پرونده‌ها', 'Total'), dashboard.totalCases],
              [label('باز', 'Open'), dashboard.openCases],
              [label('مختومه', 'Closed'), dashboard.closedCases],
              [label('در انتظار بررسی', 'Awaiting review'), dashboard.awaitingExpertReview],
              [label('در انتظار مدارک', 'Awaiting docs'), dashboard.awaitingDocuments],
              [label('نزدیک مهلت', 'Near deadline'), dashboard.nearDeadlines],
            ].map(([t, v]) => <div key={String(t)} className={kpi}><div className="tx3 text-[10px]">{t}</div><div className="tx1 text-lg font-bold">{Number(v).toLocaleString('fa-IR')}</div></div>)}
          </div>
          {/* مبالغ سه‌لایه */}
          <div className={card}>
            <h3 className="tx1 mb-2 text-xs font-bold">{label('لایه‌های مبلغ (سه‌لایهٔ جدا)', 'Amount layers')}</h3>
            <p className="tx3 mb-2 text-[10px]">{catalog.amountsRuleFa.split('؛')[0]}</p>
            {[
              [label('مورد مطالبه', 'Claimed'), dashboard.totalClaimedAmount, 'bg-blue-50 text-blue-800'],
              [label('بررسی‌شده', 'Reviewed'), dashboard.totalReviewedAmount, 'bg-amber-50 text-amber-800'],
              [label('تأییدشده', 'Approved'), dashboard.totalApprovedAmount, 'bg-emerald-50 text-emerald-800'],
            ].map(([t, v, cls]) => (
              <div key={String(t)} className={`mb-1 flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] ${cls}`}>
                <span>{t}</span><span className="font-bold">{fmtAmount(v || null) === EMPTY ? EMPTY : fmtAmount(v) + ' ' + label('ریال', 'IRR')}</span>
              </div>
            ))}
            {dashboard.claimsInsufficientEvidence > 0 && <p className="mt-1 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700">{label(`${dashboard.claimsInsufficientEvidence} ادعا مدارک ناکافی دارد`, `${dashboard.claimsInsufficientEvidence} claims lack evidence`)}</p>}
          </div>
          {/* وضعیت‌ها */}
          <div className={card}>
            <h3 className="tx1 mb-2 text-xs font-bold">{label('پرونده‌ها به تفکیک وضعیت', 'By status')}</h3>
            <div className="space-y-1">
              {catalog.caseStatuses.map((s) => {
                const n = dashboard.byStatus[s.code] ?? 0;
                const pct = dashboard.totalCases ? Math.round((n / dashboard.totalCases) * 100) : 0;
                return (
                  <div key={s.code} className="flex items-center gap-2 text-[11px]">
                    <span className="tx3 w-32 shrink-0">{s.fa}</span>
                    <div className="h-1.5 flex-1 rounded bg-slate-100"><div className="h-1.5 rounded bg-[#1f4e79]" style={{ width: `${pct}%` }} /></div>
                    <span className="tx1 w-8 text-left font-bold">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* توزیع موضوع + روند */}
          <div className={card}>
            <h3 className="tx1 mb-2 text-xs font-bold">{label('توزیع موضوع و روند ثبت', 'Subject & trend')}</h3>
            {Object.keys(dashboard.bySubject).length === 0 ? <p className="tx3 text-[11px]">{EMPTY}</p> : (
              <div className="space-y-1">
                {Object.entries(dashboard.bySubject).map(([k, n]) => (
                  <div key={k} className="flex items-center justify-between text-[11px]"><span className="tx3">{subjectFa(k)}</span><span className="tx1 font-bold">{n}</span></div>
                ))}
              </div>
            )}
            {Object.keys(dashboard.trend).length > 0 && (
              <div className="mt-3">
                <h4 className="tx3 mb-1 text-[10px]">{label('روند (ماه):', 'Trend (month):')}</h4>
                {Object.entries(dashboard.trend).sort().map(([k, n]) => (
                  <div key={k} className="flex items-center gap-2 text-[10px]"><span className="tx3 w-16">{k}</span><div className="h-1 rounded bg-indigo-300" style={{ width: `${n * 20}px` }} /><span className="tx1">{n}</span></div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'cases' && (
        <div className="grid gap-3 lg:grid-cols-3">
          {/* فهرست */}
          <div className={`${card} lg:col-span-1`}>
            <h3 className="tx1 mb-2 text-xs font-bold">{label('پرونده‌ها', 'Cases')} ({cases.length})</h3>
            <div className="max-h-[420px] space-y-1 overflow-y-auto">
              {cases.filter((c) => !q || c.TitleFa.includes(q) || c.Code.includes(q)).map((c) => (
                <button key={c.Id} className={`w-full rounded-lg border px-2 py-1.5 text-right text-[11px] transition ${current?.Id === c.Id ? 'border-[#1f4e79] bg-blue-50' : 'b-line-soft hover:bg-slate-50'}`} onClick={() => void loadCase(c.Id)}>
                  <div className="flex items-center justify-between gap-2"><span className="tx1 truncate font-medium">{c.TitleFa}</span><span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600 shrink-0">{statusFa(c.Status)}</span></div>
                  <div className="tx3 mt-0.5 text-[9px]">{c.Code} — {subjectFa(c.SubjectCode)}</div>
                </button>
              ))}
              {cases.length === 0 && <p className="tx3 py-4 text-center text-[11px]">{label('پرونده‌ای ثبت نشده است', 'No cases yet')}</p>}
            </div>
          </div>
          {/* جزئیات */}
          <div className={`${card} lg:col-span-2`}>
            {!current ? <p className="tx3 py-8 text-center text-[11px]">{label('پرونده‌ای انتخاب کنید', 'Select a case')}</p> : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex-1"><h3 className="tx1 text-sm font-bold">{current.TitleFa}</h3><p className="tx3 text-[10px]">{current.Code} — {subjectFa(current.SubjectCode)}</p></div>
                  <span className="rounded-full bg-[#1f4e79] px-2 py-0.5 text-[10px] text-white">{statusFa(current.Status)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                  <div><span className="tx3">{label('کارفرما:', 'Employer:')}</span> <span className="tx1">{current.EmployerFa ?? EMPTY}</span></div>
                  <div><span className="tx3">{label('پیمانکار:', 'Contractor:')}</span> <span className="tx1">{current.ContractorFa ?? EMPTY}</span></div>
                  <div><span className="tx3">{label('مشاور:', 'Consultant:')}</span> <span className="tx1">{current.ConsultantFa ?? EMPTY}</span></div>
                  <div><span className="tx3">{label('مرجع:', 'Authority:')}</span> <span className="tx1">{current.CourtRefFa ?? EMPTY}</span></div>
                  <div><span className="tx3">{label('مبلغ مطالبه:', 'Claimed:')}</span> <span className="tx1 font-bold">{fmtAmount(current.ClaimedAmount)} {current.Currency ?? ''}</span></div>
                  <div><span className="tx3">{label('مدت ادعایی:', 'Days:')}</span> <span className="tx1">{current.ClaimedDelayDays != null ? Number(current.ClaimedDelayDays).toLocaleString('fa-IR') : EMPTY}</span></div>
                  <div><span className="tx3">{label('مهلت تحویل:', 'Due:')}</span> <span className="tx1">{current.DeliveryDeadline ?? EMPTY}</span></div>
                  <div><span className="tx3">{label('اولویت:', 'Priority:')}</span> <span className="tx1">{PRIORITY_FA[current.Priority ?? 'normal'] ?? EMPTY}</span></div>
                </div>
                {current.ClaimDescriptionFa && <p className="tx2 rounded-lg bg-slate-50 p-2 text-[11px]">{current.ClaimDescriptionFa}</p>}
                {/* گذرها */}
                <div className="flex flex-wrap items-center gap-1 border-t b-line-soft pt-2">
                  <span className="tx3 text-[10px]">{label('گذرهای مجاز:', 'Transitions:')}</span>
                  {catalog.caseStatuses.find((s) => s.code === current.Status)?.to.map((to) => {
                    const needsApproval = catalog.approvalTransitions.includes(to);
                    if (needsApproval && !can('dispute.approve')) return null;
                    return <button key={to} className={`${btn} ${needsApproval ? 'border-amber-400 text-amber-800' : ''}`} disabled={busy} onClick={() => void transition(to)}>{needsApproval ? '✓ ' : ''}{CASE_STATUS_FA[to]}</button>;
                  })}
                  {can('dispute.edit') && current.Status === 'draft' && <button className={`${btn} border-red-300 text-red-600`} disabled={busy} onClick={deleteCase}>{label('حذف پیش‌نویس', 'Delete draft')}</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'parties' && current ? (
        <div className={card}>
          <h3 className="tx1 mb-2 text-xs font-bold">{label('طرفین و نمایندگان — ', 'Parties — ')}{current.TitleFa}</h3>
          {can('dispute.edit') && !['closed', 'archived'].includes(current.Status) && (
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
              <select className={inputClass} value={partyForm.Role} onChange={(e) => setPartyForm((f) => ({ ...f, Role: e.target.value }))}>
                {catalog.partyRoles.map((r) => <option key={r.code} value={r.code}>{r.fa}</option>)}
              </select>
              <input className={inputClass} placeholder={label('نام طرف *', 'Name *')} value={partyForm.NameFa} onChange={(e) => setPartyForm((f) => ({ ...f, NameFa: e.target.value }))} />
              <input className={inputClass} placeholder={label('نماینده', 'Representative')} value={partyForm.RepresentativeFa} onChange={(e) => setPartyForm((f) => ({ ...f, RepresentativeFa: e.target.value }))} />
              <input className={inputClass} placeholder={label('ارتباط با ادعاها', 'Link to claims')} value={partyForm.ClaimLinkNoteFa} onChange={(e) => setPartyForm((f) => ({ ...f, ClaimLinkNoteFa: e.target.value }))} />
              <button className={btnP} disabled={busy || !partyForm.NameFa} onClick={() => void addParty()}>{label('ثبت طرف', 'Add')}</button>
            </div>
          )}
          <table className="w-full text-[11px]"><thead><tr className="tx3 border-b b-line-soft text-right"><th className="p-1.5">{label('کد', 'Code')}</th><th className="p-1.5">{label('نقش', 'Role')}</th><th className="p-1.5">{label('نام', 'Name')}</th><th className="p-1.5">{label('نماینده', 'Rep.')}</th><th className="p-1.5">{label('ارتباط با ادعا', 'Claim link')}</th><th className="p-1.5" /></tr></thead>
            <tbody>{parties.map((p) => (
              <tr key={p.Id} className="border-b b-line-soft/50">
                <td className="p-1.5 tx1">{String(p.Code)}</td>
                <td className="p-1.5 tx1">{catalog.partyRoles.find((r) => r.code === p.Role)?.fa ?? String(p.Role)}</td>
                <td className="p-1.5 tx1">{String(p.NameFa)}</td>
                <td className="p-1.5 tx3">{String(p.RepresentativeFa ?? EMPTY)}</td>
                <td className="p-1.5 tx3">{String(p.ClaimLinkNoteFa ?? EMPTY)}</td>
                <td className="p-1.5">{can('dispute.edit') && !['closed', 'archived'].includes(current.Status) && <button className={btn} onClick={() => void removeRow('PmisDisputeParties', p.Id)}>✕</button>}</td>
              </tr>
            ))}</tbody></table>
          {parties.length === 0 && <p className="tx3 py-4 text-center text-[11px]">{label('طرفی ثبت نشده است', 'No parties yet')}</p>}
        </div>
      ) : (tab === 'parties' && <p className="tx3 py-8 text-center text-[11px]">{label('ابتدا از تب «مدیریت پرونده‌ها» پرونده‌ای انتخاب کنید', 'Select a case from Cases tab first')}</p>)}

      {tab === 'evidence' && current ? (
        <div className={card}>
          <h3 className="tx1 mb-1 text-xs font-bold">{label('مستندات و ادله — ', 'Evidence — ')}{current.TitleFa}</h3>
          <p className="tx3 mb-3 text-[10px]">{catalog.evidenceRuleFa}</p>
          {can('dispute.edit') && !['closed', 'archived'].includes(current.Status) && (
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <select className={inputClass} value={docForm.DocType} onChange={(e) => setDocForm((f) => ({ ...f, DocType: e.target.value }))}>
                {catalog.evidenceDocTypes.map((d) => <option key={d.code} value={d.code}>{d.fa}</option>)}
              </select>
              <input className={inputClass} placeholder={label('عنوان سند *', 'Title *')} value={docForm.TitleFa} onChange={(e) => setDocForm((f) => ({ ...f, TitleFa: e.target.value }))} />
              <input className={inputClass} placeholder={label('شماره سند', 'Doc no.')} value={docForm.DocNo} onChange={(e) => setDocForm((f) => ({ ...f, DocNo: e.target.value }))} />
              <input className={inputClass} placeholder={label('فرستنده', 'Sender')} value={docForm.SenderFa} onChange={(e) => setDocForm((f) => ({ ...f, SenderFa: e.target.value }))} />
              <input className={inputClass} placeholder={label('گیرنده', 'Receiver')} value={docForm.ReceiverFa} onChange={(e) => setDocForm((f) => ({ ...f, ReceiverFa: e.target.value }))} />
              <input className={inputClass} placeholder={label('بند قراردادی مرتبط', 'Clause ref')} value={docForm.ContractClauseRef} onChange={(e) => setDocForm((f) => ({ ...f, ContractClauseRef: e.target.value }))} />
              <input className={inputClass} placeholder={label('یادداشت کارشناسی', 'Expert note')} value={docForm.ExpertNoteFa} onChange={(e) => setDocForm((f) => ({ ...f, ExpertNoteFa: e.target.value }))} />
              <button className={btnP} disabled={busy || !docForm.TitleFa} onClick={() => void addDoc()}>{label('ثبت مدرک', 'Add evidence')}</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]"><thead><tr className="tx3 border-b b-line-soft text-right">
              <th className="p-1.5">{label('کد', 'Code')}</th><th className="p-1.5">{label('سند', 'Doc')}</th><th className="p-1.5">{label('نوع', 'Type')}</th>
              <th className="p-1.5">{label('اصالت', 'Authenticity')}<span className="tx3 block text-[8px]">{label('(مستقل از فایل)', '(≠ file)')}</span></th>
              <th className="p-1.5">{label('کفایت', 'Sufficiency')}</th><th className="p-1.5">{label('یادداشت کارشناسی', 'Note')}</th><th className="p-1.5" /></tr></thead>
              <tbody>{evidence.map((e) => (
                <tr key={e.Id} className="border-b b-line-soft/50">
                  <td className="p-1.5 tx1">{String(e.Code)}{e.DocNo ? <span className="tx3 block text-[9px]">ش:{String(e.DocNo)}</span> : null}</td>
                  <td className="p-1.5 tx1">{String(e.TitleFa)}</td>
                  <td className="p-1.5 tx3">{catalog.evidenceDocTypes.find((d) => d.code === e.DocType)?.fa ?? String(e.DocType)}</td>
                  <td className="p-1.5">
                    {can('dispute.review') && !['closed', 'archived'].includes(current.Status) ? (
                      <select className="rounded border b-line-soft bg-transparent px-1 py-0.5 text-[10px] tx1" value={String(e.AuthenticityStatus ?? 'pending')} onChange={(ev) => void setEvidenceCheck(e.Id, 'AuthenticityStatus', ev.target.value)}>
                        {catalog.evidenceAuthenticity.map((a) => <option key={a} value={a}>{EVIDENCE_STATUS_FA[a] ?? a}</option>)}
                      </select>
                    ) : <span className="tx3">{EVIDENCE_STATUS_FA[String(e.AuthenticityStatus ?? 'pending')] ?? String(e.AuthenticityStatus)}</span>}
                  </td>
                  <td className="p-1.5">
                    {can('dispute.review') && !['closed', 'archived'].includes(current.Status) ? (
                      <select className="rounded border b-line-soft bg-transparent px-1 py-0.5 text-[10px] tx1" value={String(e.SufficiencyStatus ?? 'unchecked')} onChange={(ev) => void setEvidenceCheck(e.Id, 'SufficiencyStatus', ev.target.value)}>
                        {catalog.evidenceSufficiency.map((a) => <option key={a} value={a}>{EVIDENCE_STATUS_FA[a] ?? a}</option>)}
                      </select>
                    ) : <span className="tx3">{EVIDENCE_STATUS_FA[String(e.SufficiencyStatus ?? 'unchecked')] ?? String(e.SufficiencyStatus)}</span>}
                  </td>
                  <td className="p-1.5 tx3 max-w-[200px] truncate" title={String(e.ExpertNoteFa ?? '')}>{String(e.ExpertNoteFa ?? EMPTY)}</td>
                  <td className="p-1.5">{can('dispute.edit') && !['closed', 'archived'].includes(current.Status) && <button className={btn} onClick={() => void removeRow('PmisDisputeEvidence', e.Id)}>✕</button>}</td>
                </tr>
              ))}</tbody></table>
            {evidence.length === 0 && <p className="tx3 py-4 text-center text-[11px]">{label('مدرکی ثبت نشده است', 'No evidence yet')}</p>}
          </div>
        </div>
      ) : (tab === 'evidence' && <p className="tx3 py-8 text-center text-[11px]">{label('ابتدا از تب «مدیریت پرونده‌ها» پرونده‌ای انتخاب کنید', 'Select a case first')}</p>)}

      {tab === 'claims' && current ? (
        <div className="space-y-3">
          {/* ثبت ادعا */}
          {can('dispute.edit') && !['closed', 'archived'].includes(current.Status) && (
            <div className={card}>
              <h3 className="tx1 mb-2 text-xs font-bold">{label('ثبت ادعای جدید', 'New claim')}</h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <input className={inputClass} placeholder={label('شرح ادعا *', 'Claim title *')} value={claimForm.TitleFa} onChange={(e) => setClaimForm((f) => ({ ...f, TitleFa: e.target.value }))} />
                <select className={inputClass} value={claimForm.ClaimantPartyCode} onChange={(e) => setClaimForm((f) => ({ ...f, ClaimantPartyCode: e.target.value }))}>
                  <option value="">{label('طرف مدعی *', 'Claimant *')}</option>
                  {parties.map((p) => <option key={String(p.Code)} value={String(p.Code)}>{String(p.NameFa)}</option>)}
                </select>
                <select className={inputClass} value={claimForm.BasisKind} onChange={(e) => setClaimForm((f) => ({ ...f, BasisKind: e.target.value }))}>
                  {catalog.claimBasisKinds.map((k) => <option key={k} value={k}>{CLAIM_BASIS_FA[k] ?? k}</option>)}
                </select>
                <input className={inputClass} placeholder={label('بند قراردادی', 'Clause ref')} value={claimForm.ContractClauseRef} onChange={(e) => setClaimForm((f) => ({ ...f, ContractClauseRef: e.target.value }))} />
                <input className={inputClass} placeholder={label('مبلغ مورد مطالبه', 'Claimed amount')} inputMode="numeric" value={claimForm.ClaimedAmount} onChange={(e) => setClaimForm((f) => ({ ...f, ClaimedAmount: e.target.value }))} />
                <input className={inputClass} placeholder={label('مدت ادعایی (روز)', 'Claimed days')} inputMode="numeric" value={claimForm.ClaimedDelayDays} onChange={(e) => setClaimForm((f) => ({ ...f, ClaimedDelayDays: e.target.value }))} />
                <input className={inputClass} placeholder={label('خواسته و مبنا', 'Demand & basis')} value={claimForm.DemandFa} onChange={(e) => setClaimForm((f) => ({ ...f, DemandFa: e.target.value }))} />
                <button className={btnP} disabled={busy || !claimForm.TitleFa || !claimForm.ClaimantPartyCode} onClick={() => void addClaim()}>{label('ثبت ادعا', 'Add claim')}</button>
              </div>
            </div>
          )}
          {/* کارت‌های ادعا */}
          {claims.map((c) => {
            const claimResponses = responses.filter((r) => r.ClaimCode === c.Code);
            return (
              <div key={c.Id} className={card}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-[200px] flex-1">
                    <h4 className="tx1 text-xs font-bold">{String(c.TitleFa)}</h4>
                    <p className="tx3 text-[10px]">{String(c.Code)} — {CLAIM_BASIS_FA[String(c.BasisKind)] ?? String(c.BasisKind)} | {parties.find((p) => p.Code === c.ClaimantPartyCode)?.NameFa ? String(parties.find((p) => p.Code === c.ClaimantPartyCode)?.NameFa) : String(c.ClaimantPartyCode)}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{REVIEW_STATUS_FA[String(c.ReviewStatus ?? 'open')] ?? String(c.ReviewStatus)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${c.EvidenceSufficiency === 'sufficient' ? 'bg-emerald-50 text-emerald-700' : c.EvidenceSufficiency === 'insufficient' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>مدارک: {EVIDENCE_STATUS_FA[String(c.EvidenceSufficiency ?? 'unchecked')] ?? '—'}</span>
                </div>
                {/* سه لایهٔ مبلغ */}
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  {([
                    [label('مطالبه', 'Claimed'), c.ClaimedAmount, 'bg-blue-50 text-blue-800'],
                    [label('بررسی‌شده', 'Reviewed'), c.ReviewedAmount, 'bg-amber-50 text-amber-800'],
                    [label('تأییدشده', 'Approved'), c.ApprovedAmount, 'bg-emerald-50 text-emerald-800'],
                  ] as [string, unknown, string][]).map(([t, v, cls]) => (
                    <div key={t} className={`rounded-lg px-1 py-1.5 ${cls}`}><span className="block">{t}</span><span className="mt-0.5 block font-bold">{fmtAmount(v)}</span></div>
                  ))}
                </div>
                {(c.ClaimedDelayDays != null || Boolean(c.ContractClauseRef)) && (
                  <p className="tx3 mt-1 text-[9px]">
                    {c.ClaimedDelayDays != null && <span>مدت: {Number(c.ClaimedDelayDays).toLocaleString('fa-IR')} روز</span>}
                    {Boolean(c.ContractClauseRef) && <span className="ms-2">بند: {String(c.ContractClauseRef)}</span>}
                  </p>
                )}
                {/* پاسخ‌ها */}
                {claimResponses.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {claimResponses.map((r) => (
                      <div key={r.Id} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] tx2">
                        <span className="tx3">پاسخ {parties.find((p) => p.Code === r.ResponderPartyCode)?.NameFa ? String(parties.find((p) => p.Code === r.ResponderPartyCode)?.NameFa) : String(r.ResponderPartyCode)} ({r.ReceivedAt ? String(r.ReceivedAt).slice(0, 10) : EMPTY})</span>
                        <p className="mt-0.5">{String(r.BodyFa)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {/* ثبت پاسخ + مبالغ */}
                {can('dispute.edit') && !['closed', 'archived'].includes(current.Status) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t b-line-soft pt-2">
                    {respForm.claimCode === String(c.Code) ? (
                      <>
                        <select className={`${inputClass} !w-auto text-[10px]`} value={respForm.ResponderPartyCode} onChange={(e) => setRespForm((f) => ({ ...f, ResponderPartyCode: e.target.value }))}>
                          <option value="">{label('طرف پاسخ‌دهنده', 'Responder')}</option>
                          {parties.filter((p) => p.Code !== c.ClaimantPartyCode).map((p) => <option key={String(p.Code)} value={String(p.Code)}>{String(p.NameFa)}</option>)}
                        </select>
                        <input className={`${inputClass} flex-1 !w-auto text-[10px]`} placeholder={label('متن دفاعیه…', 'Defense text…')} value={respForm.BodyFa} onChange={(e) => setRespForm((f) => ({ ...f, BodyFa: e.target.value }))} />
                        <button className={btnP} disabled={busy || !respForm.ResponderPartyCode || !respForm.BodyFa} onClick={() => void addResponse()}>{label('ثبت دفاعیه', 'Post')}</button>
                        <button className={btn} onClick={() => setRespForm({ claimCode: '', ResponderPartyCode: '', BodyFa: '' })}>✕</button>
                      </>
                    ) : <button className={btn} disabled={busy} onClick={() => setRespForm({ claimCode: String(c.Code), ResponderPartyCode: '', BodyFa: '' })}>{label('پاسخ/دفاعیه', 'Respond')}</button>}
                    {can('dispute.review') && amountForm.claimId !== c.Id && (
                      <button className={btn} disabled={busy} onClick={() => setAmountForm({ claimId: c.Id, ReviewedAmount: '', ReviewBasisFa: '', ApprovedAmount: '', ApprovedBasisFa: '' })}>{label('لایهٔ مبلغ', 'Amounts')}</button>
                    )}
                  </div>
                )}
                {can('dispute.review') && amountForm.claimId === c.Id && (
                  <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2">
                    <p className="text-[10px] text-amber-800">{label('لایه‌بندی مبلغ: همهٔ اعداد «ثبت‌شده با مبنا» — هرگز حدسی نیست.', 'Amount layers: all figures recorded with basis — never estimated.')}</p>
                    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                      <input className={`${inputClass} text-[10px]`} placeholder={label('مبلغ بررسی‌شده', 'Reviewed')} inputMode="numeric" value={amountForm.ReviewedAmount} onChange={(e) => setAmountForm((f) => ({ ...f, ReviewedAmount: e.target.value }))} />
                      <input className={`${inputClass} text-[10px]`} placeholder={label('مبنای بررسی *', 'Review basis *')} value={amountForm.ReviewBasisFa} onChange={(e) => setAmountForm((f) => ({ ...f, ReviewBasisFa: e.target.value }))} />
                      <input className={`${inputClass} text-[10px]`} placeholder={label('مبلغ تأییدشده', 'Approved')} inputMode="numeric" value={amountForm.ApprovedAmount} onChange={(e) => setAmountForm((f) => ({ ...f, ApprovedAmount: e.target.value }))} />
                      <input className={`${inputClass} text-[10px]`} placeholder={label('مبنای تأیید *', 'Approval basis *')} value={amountForm.ApprovedBasisFa} onChange={(e) => setAmountForm((f) => ({ ...f, ApprovedBasisFa: e.target.value }))} />
                    </div>
                    <div className="flex gap-1.5">
                      <button className={btnP} disabled={busy || !amountForm.ReviewBasisFa || (amountForm.ApprovedAmount !== '' && !amountForm.ApprovedBasisFa)} onClick={() => void setAmounts()}>{label('ثبت لایه‌ها', 'Save')}</button>
                      <button className={btn} onClick={() => setAmountForm({ claimId: '', ReviewedAmount: '', ReviewBasisFa: '', ApprovedAmount: '', ApprovedBasisFa: '' })}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {claims.length === 0 && <p className="tx3 py-6 text-center text-[11px]">{label('ادعایی ثبت نشده است', 'No claims yet')}</p>}
        </div>
      ) : (tab === 'claims' && <p className="tx3 py-8 text-center text-[11px]">{label('ابتدا از تب «مدیریت پرونده‌ها» پرونده‌ای انتخاب کنید', 'Select a case first')}</p>)}

      {/* فاز ۳ — تحلیل‌های کارشناسی */}
      {tab === 'analyses' && current ? (
        <div className="space-y-3">
          <div className={`${card} flex flex-wrap items-center gap-2`}>
            <div className="min-w-[240px] flex-1">
              <h3 className="tx1 text-xs font-bold">{label('تحلیل‌های کارشناسی', 'Expert analyses')}</h3>
              <p className="tx3 text-[10px]">{label('خروجی قاعده‌محور و یادداشت‌های کارشناس؛ هیچ‌کدام بدون تأیید انسانی مؤثر نیستند و هیچ منبع حقوقی/رأیی جعل نمی‌شود.', 'Rule-based drafts; none effective without human approval; no fabricated sources.')}</p>
            </div>
            {can('dispute.review') && !caseLocked && <button className={btnP} disabled={busy} onClick={runAnalysis}>{label('اجرای تحلیل قاعده‌محور', 'Run rule-based analysis')}</button>}
          </div>
          {analyses.length === 0 && <p className="tx3 py-6 text-center text-[11px]">{label('تحلیلی ثبت نشده است — «—»', 'No analysis yet — "—"')}</p>}
          {analyses.map((a) => {
            const approval = String(a.ApprovalStatus ?? 'draft');
            return (
              <div key={a.Id} className={card}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-[220px] flex-1">
                    <h4 className="tx1 text-xs font-bold">{String(a.TopicFa ?? EMPTY)}</h4>
                    <p className="tx3 text-[10px]">{String(a.Code)} — {label('تحلیل‌گر:', 'By:')} {String(a.AnalyzedBy ?? EMPTY)} {a.AnalyzedAt ? `· ${String(a.AnalyzedAt).slice(0, 16).replace('T', ' ')}` : ''}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${approval === 'approved' ? 'bg-emerald-100 text-emerald-800' : approval === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{label('وضعیت تأیید:', 'Approval:')} {ANALYSIS_APPROVAL_CLIENT_FA[approval] ?? approval}</span>
                  {approval === 'approved' && Boolean(a.ApprovedBy) && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">{label('تأییدکننده:', 'Approver:')} {String(a.ApprovedBy)}</span>}
                </div>
                <p className="tx3 mt-1 text-[10px]"><b>{label('سؤال کارشناسی:', 'Question:')}</b> {String(a.QuestionFa ?? EMPTY)}</p>
                <p className="tx3 mt-1 text-[10px]"><b>{label('روش:', 'Method:')}</b> {String(a.MethodFa ?? EMPTY)}</p>
                {Boolean(a.ResultsFa) ? <pre className="tx2 mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px]">{String(a.ResultsFa)}</pre> : null}
                {Boolean(a.InfoGapsFa) && String(a.InfoGapsFa).trim() !== '' && !String(a.InfoGapsFa).includes('— هیچ') ? <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900">{String(a.InfoGapsFa)}</pre> : null}
                {Boolean(a.SuggestedConclusionFa) && <p className="mt-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900">{label('پیشنهاد تحلیل (پیش‌نویس — رأی نیست):', 'Suggested conclusion (draft — not a verdict):')} {String(a.SuggestedConclusionFa)}</p>}
                {Boolean(a.UncertaintiesFa) && <p className="tx3 mt-1 text-[9px]">{label('عدم‌قطعیت‌ها:', 'Uncertainties:')} {String(a.UncertaintiesFa)}</p>}
                {Boolean(a.MethodLimitsFa) && <p className="tx3 mt-0.5 text-[9px]">{label('محدودیت‌های روش:', 'Method limits:')} {String(a.MethodLimitsFa)}</p>}
                {can('dispute.review') && !caseLocked && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {approval !== 'under_review' && <button className={btn} disabled={busy} onClick={() => setAnalysisStatus(a.Id, 'under_review')}>{label('ارسال به بازبینی', 'Send to review')}</button>}
                    {approval !== 'approved' && <button className={btn} disabled={busy} onClick={() => setAnalysisStatus(a.Id, 'approved')}>{label('تأیید کارشناسی', 'Approve')}</button>}
                    {approval !== 'rejected' && <button className={btn} disabled={busy} onClick={() => setAnalysisStatus(a.Id, 'rejected')}>{label('مرجوع', 'Reject')}</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (tab === 'analyses' && <p className="tx3 py-8 text-center text-[11px]">{label('ابتدا از تب «مدیریت پرونده‌ها» پرونده‌ای انتخاب کنید', 'Select a case first')}</p>)}

      {/* فاز ۳ — محاسبات مستقل (مقایسه) */}
      {tab === 'calculations' && current ? (
        <div className="space-y-3">
          <div className={`${card} flex flex-wrap items-center gap-2`}>
            <div className="min-w-[240px] flex-1">
              <h3 className="tx1 text-xs font-bold">{label('محاسبات مستقل کارشناسی — فقط «برای مقایسه»', 'Independent expert calculations — comparison only')}</h3>
              <p className="tx3 text-[10px]">{label('جایگزین محاسبهٔ مدعی/پاسخگو نیست؛ مقادیر ماژول‌های دیگر (تأخیر/خسارت/ریسک) فقط‌خواندنی‌اند و این‌جا بازمحاسبه نمی‌شوند.', 'Never a substitute; other modules’ values are read-only and never recomputed here.')}</p>
            </div>
            {can('dispute.review') && !caseLocked && <button className={btnP} disabled={busy} onClick={recalcCalcs}>{label('بازمحاسبهٔ شاخص‌های جمع', 'Recalculate totals')}</button>}
          </div>
          {calculations.length === 0 && <p className="tx3 py-6 text-center text-[11px]">{label('محاسبه‌ای ثبت نشده است — «—»', 'No calculations yet — "—"')}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {calculations.map((c) => (
              <div key={c.Id} className={card}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="tx1 text-xs font-bold">{String(c.TitleFa ?? EMPTY)}</h4>
                    <p className="tx3 text-[10px]">{String(c.Code)} · {label('وضعیت:', 'Status:')} {String(c.Status ?? EMPTY)}</p>
                  </div>
                  <span className="text-base font-bold text-[#1f4e79]">{fmtAmount(c.ResultAmount)}</span>
                </div>
                <p className="tx3 mt-1 text-[10px]">{String(c.MethodFa ?? EMPTY)}</p>
                <p className="tx3 text-[10px]">{label('منبع داده:', 'Source:')} {String(c.DataSourceFa ?? EMPTY)} · {label('محاسبه‌گر:', 'By:')} {String(c.CalculatedBy ?? EMPTY)}</p>
                {Boolean(c.VarianceNoteFa) && <p className="mt-1 rounded-lg bg-amber-50 p-1.5 text-[10px] text-amber-900">{String(c.VarianceNoteFa)}</p>}
                <div className="mt-1 flex justify-end">{can('dispute.edit') && !caseLocked && <button className={btn} disabled={busy} onClick={() => removeRow('PmisDisputeCalculations', c.Id)}>{label('حذف', 'Delete')}</button>}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (tab === 'calculations' && <p className="tx3 py-8 text-center text-[11px]">{label('ابتدا از تب «مدیریت پرونده‌ها» پرونده‌ای انتخاب کنید', 'Select a case first')}</p>)}

      {/* فاز ۳ — پیوندهای ماژولی (نرم — فقط‌خواندنی) */}
      {tab === 'links' && current ? (
        <div className="space-y-3">
          <div className={card}>
            <h3 className="tx1 mb-1 text-xs font-bold">{label('پیوندهای نرم به ماژول‌های دیگر', 'Soft links to other modules')}</h3>
            <p className="tx3 text-[10px]">{label('پیوند صرفاً مرجع است: هیچ رکوردی در ماژول مقصد ایجاد/تغییر/حذف نمی‌شود و بازیابی زنده فقط‌خواندنی است.', 'Links are references only — target modules are never written; live resolution is read-only.')}</p>
          </div>
          {can('dispute.edit') && !caseLocked && (
            <div className={`${card} space-y-2`}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="tx1 text-[11px] font-bold">{label('پیوند جدید', 'New link')}</h4>
                <button className={btn} disabled={suggestBusy || busy} onClick={() => void loadSuggestions()}>{suggestBusy ? label('در حال بارگذاری…', 'Loading…') : label('بارگذاری نامزدها از ماژول‌ها', 'Load candidates')}</button>
              </div>
              {suggestions && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-40">
                    <label className="tx3 text-[9px]">{label('نوع پیوند', 'Link kind')}</label>
                    <select className={inputClass} value={linkPick.kind} onChange={(e) => setLinkPick({ kind: e.target.value, target: '' })}>
                      {Object.entries(LINK_KIND_CLIENT_FA).map(([k, faTitle]) => <option key={k} value={k}>{faTitle}</option>)}
                    </select>
                  </div>
                  <div className="min-w-[260px] flex-1">
                    <label className="tx3 text-[9px]">{label('هدف (از دادهٔ واقعی ماژول مقصد)', 'Target (real data of target module)')}</label>
                    <select className={inputClass} value={linkPick.target} onChange={(e) => setLinkPick({ ...linkPick, target: e.target.value })}>
                      <option value="">{label('— انتخاب —', '— select —')}</option>
                      {((suggestions as unknown as Record<string, { code: string; titleFa: string; alreadyLinked: boolean; status?: string | null }[] | undefined>)[linkPick.kind] ?? []).map((c) => (
                        <option key={c.code} value={c.code} disabled={c.alreadyLinked}>{c.titleFa} — {c.code}{c.alreadyLinked ? label(' (پیوندشده)', ' (linked)') : ''}</option>
                      ))}
                    </select>
                    {((suggestions as unknown as Record<string, unknown[] | undefined>)[linkPick.kind] ?? []).length === 0 && <p className="tx3 mt-0.5 text-[9px]">{label('رکوردی از این نوع در ماژول مقصد/این پروژه موجود نیست — «—»', 'No records of this kind in the target module — "—"')}</p>}
                  </div>
                  <button className={btnP} disabled={busy || !linkPick.target} onClick={attachLink}>{label('برقراری پیوند', 'Attach')}</button>
                </div>
              )}
              {suggestions ? <p className="tx3 text-[9px]">{suggestions.noteFa}</p> : null}
            </div>
          )}
          {links.length === 0 && <p className="tx3 py-6 text-center text-[11px]">{label('پیوندی ثبت نشده است — «—»', 'No links yet — "—"')}</p>}
          {links.map((l) => {
            const res = resolutions[l.Id];
            return (
              <div key={l.Id} className={card}>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-800">{LINK_KIND_CLIENT_FA[String(l.LinkKind)] ?? String(l.LinkKind)}</span>
                  <div className="min-w-[200px] flex-1">
                    <p className="tx1 text-xs font-bold">{String(l.TargetTitleFa ?? EMPTY)}</p>
                    <p className="tx3 text-[10px]">{String(l.TargetCode)} · {label('ایجاد:', 'By:')} {String(l.EstablishedBy ?? EMPTY)} {l.EstablishedAt ? `· ${String(l.EstablishedAt).slice(0, 10)}` : ''} · {label('وضعیت:', 'Status:')} {String(l.Status ?? 'active')}</p>
                  </div>
                  <button className={btn} disabled={resolvingId === l.Id} onClick={() => void toggleResolve(l.Id)}>{resolutions[l.Id] ? label('بستن بازیابی', 'Hide') : resolvingId === l.Id ? label('…', '…') : label('بازیابی زندهٔ هدف (خواندنی)', 'Live resolve (read-only)')}</button>
                  {can('dispute.edit') && !caseLocked && <button className={btn} disabled={busy} onClick={() => removeRow('PmisDisputeModuleLinks', l.Id)}>{label('حذف پیوند', 'Remove')}</button>}
                </div>
                {res && (
                  <div className="mt-2 rounded-xl border b-line-soft bg-slate-50/70 p-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${res.found ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{res.resolvable ? (res.found ? label('هدف پیدا شد', 'Target found') : label('هدف یافت نشد', 'Target not found')) : label('غیرقابل بازیابی زنده', 'Not resolvable')}</span>
                      <span className="tx3 text-[9px]">readOnly: true</span>
                    </div>
                    {Boolean(res.noteFa) && <p className="tx3 mt-1 text-[10px]">{res.noteFa}</p>}
                    {res.target && (
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-3">
                        {targetPairs(res.target).map(([k, v]) => (
                          <p key={k} className="tx2 text-[10px]"><span className="tx3">{k}:</span> {typeof v === 'number' ? v.toLocaleString('fa-IR') : String(v)}</p>
                        ))}
                      </div>
                    )}
                    {res.related.length > 0 && (
                      <div className="mt-1">
                        <p className="tx3 text-[9px]">{label('رکوردهای مرتبط (فقط نمایشی — بازمحاسبه نمی‌شوند):', 'Related records (display-only — never recomputed):')}</p>
                        {res.related.map((rel) => <p key={String(rel.Id)} className="tx2 text-[10px]">{Object.entries(rel).filter(([k]) => k !== 'Id').map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (tab === 'links' && <p className="tx3 py-8 text-center text-[11px]">{label('ابتدا از تب «مدیریت پرونده‌ها» پرونده‌ای انتخاب کنید', 'Select a case first')}</p>)}

      {/* فاز ۴ — جلسات و صورت‌جلسات */}
      {tab === 'hearings' && current ? (
        <div className="space-y-3">
          <div className={card}>
            <h3 className="tx1 mb-1 text-xs font-bold">{label('جلسات و صورت‌جلسات', 'Hearings & minutes')}</h3>
            <p className="tx3 text-[10px]">{label('ثبت «مهلت پاسخ به پرسش‌ها» به‌طور خودکار یک رکورد در ارجاعات/مهلت‌ها می‌سازد.', 'Question deadline auto-creates a deadline record.')}( {String(deadlines.length)} {label('مهلت', 'deadlines')})</p>
          </div>
          {can('dispute.edit') && !caseLocked && (
            <div className={`${card} space-y-2`}>
              <h4 className="tx1 text-[11px] font-bold">{label('جلسهٔ جدید', 'New hearing')}</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input className={inputClass} placeholder={label('عنوان جلسه *', 'Title *')} value={heaForm.TitleFa} onChange={(e) => setHeaForm({ ...heaForm, TitleFa: e.target.value })} />
                <div className="flex items-center gap-1"><span className="tx3 text-[9px]">{label('تاریخ جلسه *', 'Date *')}</span><JalaliDateInput value={heaForm.MeetingDate} onChange={(v) => setHeaForm({ ...heaForm, MeetingDate: v })} ariaLabel={label('تاریخ جلسه', 'Hearing date')} /></div>
                <input className={inputClass} placeholder={label('محل تشکیل', 'Location')} value={heaForm.LocationFa} onChange={(e) => setHeaForm({ ...heaForm, LocationFa: e.target.value })} />
              </div>
              <textarea className={`${inputClass} min-h-[60px]`} placeholder={label('پرسش‌های مطرح‌شده (هر خط یک پرسش)', 'Questions (one per line)')} value={heaForm.QuestionsFa} onChange={(e) => setHeaForm({ ...heaForm, QuestionsFa: e.target.value })} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-1"><span className="tx3 text-[9px]">{label('مهلت پاسخ به پرسش‌ها (اختیاری → مهلت خودکار)', 'Question deadline (optional → auto)')}</span><JalaliDateInput value={heaForm.QuestionDeadline} onChange={(v) => setHeaForm({ ...heaForm, QuestionDeadline: v })} ariaLabel={label('مهلت پاسخ به پرسش‌ها', 'Question deadline')} /></div>
                <input className={inputClass} placeholder={label('نکتهٔ متن صورت‌جلسه (کوتاه)', 'Minutes note')} value={heaForm.MinutesBodyFa} onChange={(e) => setHeaForm({ ...heaForm, MinutesBodyFa: e.target.value })} />
              </div>
              <button className={btnP} disabled={busy || !heaForm.TitleFa.trim() || !heaForm.MeetingDate.trim()} onClick={addHearing}>{label('ثبت جلسه', 'Register')}</button>
            </div>
          )}
          {hearings.length === 0 && <p className="tx3 py-6 text-center text-[11px]">{label('جلسه‌ای ثبت نشده است — «—»', 'No hearings — "—"')}</p>}
          {hearings.map((h) => {
            const ms = String(h.MinutesStatus ?? 'draft');
            return (
              <div key={h.Id} className={card}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-[220px] flex-1">
                    <h4 className="tx1 text-xs font-bold">{String(h.TitleFa ?? EMPTY)}</h4>
                    <p className="tx3 text-[10px]">{String(h.Code)} · {label('تاریخ:', 'Date:')} {h.MeetingDate ? String(h.MeetingDate).slice(0, 10) : EMPTY} {Boolean(h.LocationFa) && `· ${label('محل:', 'Loc:')} ${String(h.LocationFa)}`} {Boolean(h.QuestionDeadline) && `· ${label('مهلت پاسخ:', 'Answer due:')} ${String(h.QuestionDeadline).slice(0, 10)}`}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${ms === 'signed' ? 'bg-emerald-100 text-emerald-800' : ms === 'awaiting_sign' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{label('صورت‌جلسه:', 'Minutes:')} {HEARING_MINUTES_CLIENT_FA[ms] ?? ms}</span>
                  {ms === 'signed' && Boolean(h.SignedAt) && <span className="tx3 text-[9px]">{label('امضا:', 'Signed:')} {String(h.SignedAt).slice(0, 10)}</span>}
                </div>
                {Boolean(h.MinutesBodyFa) && <p className="tx2 mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px]">{String(h.MinutesBodyFa)}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {can('dispute.edit') && !caseLocked && ms === 'draft' && <button className={btn} disabled={busy} onClick={() => setMinutesStatus(h.Id, 'awaiting_sign')}>{label('ارسال برای امضا', 'Send for signature')}</button>}
                  {can('dispute.review') && !caseLocked && ms === 'awaiting_sign' && <button className={btn} disabled={busy} onClick={() => setMinutesStatus(h.Id, 'signed')}>{label('ثبت امضا', 'Mark signed')}</button>}
                  {can('dispute.edit') && !caseLocked && <button className={btn} disabled={busy} onClick={() => removeRow('PmisDisputeHearings', h.Id)}>{label('حذف', 'Delete')}</button>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (tab === 'hearings' && <p className="tx3 py-8 text-center text-[11px]">{label('ابتدا از تب «مدیریت پرونده‌ها» پرونده‌ای انتخاب کنید', 'Select a case first')}</p>)}

      {/* فاز ۴ — نظریات کارشناسی */}
      {tab === 'opinions' && current ? (
        <div className="space-y-3">
          <div className={card}>
            <h3 className="tx1 mb-1 text-xs font-bold">{label('نظریات کارشناسی', 'Expert opinions')}</h3>
            <p className="tx3 text-[10px]">{label('منابع فقط می‌توانند اشاره به رکوردهای واقعی پرونده باشند؛ منبع ناموجود با برچسب «تأییدنشده» رد می‌شود. نهایی‌سازی نیازمند مجوز بازبینی و تأییدکننده‌ای متفاوت از مؤلف است.', 'Sources must reference real case records; finalization needs review permission and a different approver.')}</p>
          </div>
          {can('dispute.edit') && !caseLocked && (
            <div className={`${card} space-y-2`}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="tx1 text-[11px] font-bold">{opiForm.PreviousVersionCode ? label(`نسخهٔ جدید نظریه (v${opiForm.Version} ← ${opiForm.PreviousVersionCode})`, `New version (v${opiForm.Version})`) : label('نظریهٔ جدید', 'New opinion')}</h4>
                {Boolean(opiForm.PreviousVersionCode) && <button className={btn} onClick={() => setOpiForm({ TitleFa: '', BodyFa: '', PreviousVersionCode: '', Version: '' })}>{label('انصراف نسخه‌سازی', 'Cancel versioning')}</button>}
              </div>
              <input className={inputClass} placeholder={label('عنوان نظریه *', 'Title *')} value={opiForm.TitleFa} onChange={(e) => setOpiForm({ ...opiForm, TitleFa: e.target.value })} />
              <textarea className={`${inputClass} min-h-[70px]`} placeholder={label('متن نظریهٔ کارشناسی *', 'Opinion body *')} value={opiForm.BodyFa} onChange={(e) => setOpiForm({ ...opiForm, BodyFa: e.target.value })} />
              {/* منابع قابل اتکا — فقط از دادهٔ واقعی پرونده */}
              <div className="space-y-1">
                <p className="tx3 text-[9px]">{label('منابع نظریه (فقط رکوردهای واقعی پرونده):', 'Opinion sources (real records only):')}</p>
                {([
                  ['hearing', hearings.map((x) => String(x.Code))],
                  ['analysis', analyses.map((x) => String(x.Code))],
                  ['evidence', evidence.map((x) => String(x.Code))],
                  ['claim', claims.map((x) => String(x.Code))],
                  ['module_link', links.map((x) => String(x.Code))],
                  ['deadline', deadlines.map((x) => String(x.Code))],
                ] as [string, string[]][]).map(([kind, codes]) => codes.length > 0 && (
                  <div key={kind} className="flex flex-wrap items-center gap-1">
                    <span className="tx3 w-20 text-[9px]">{OPINION_SOURCE_KIND_CLIENT_FA[kind]}:</span>
                    {codes.map((code) => {
                      const key = `${kind}|${code}`;
                      return <label key={key} className={`${btn} cursor-pointer text-[9px] ${opiSources[key] ? 'bg-[#1f4e79] text-white' : ''}`}><input type="checkbox" className="me-1 hidden" checked={!!opiSources[key]} onChange={(e) => setOpiSources((m) => ({ ...m, [key]: e.target.checked }))} />{code}</label>;
                    })}
                  </div>
                ))}
                {hearings.length + analyses.length + evidence.length + claims.length + links.length + deadlines.length === 0 && <p className="tx3 text-[9px]">{label('رکوردی برای استناد در پرونده نیست — «—»', 'No source records yet — "—"')}</p>}
              </div>
              <button className={btnP} disabled={busy || !opiForm.TitleFa.trim() || !opiForm.BodyFa.trim()} onClick={addOpinion}>{label('ثبت نظریه', 'Register opinion')}</button>
            </div>
          )}
          {opinions.length === 0 && <p className="tx3 py-6 text-center text-[11px]">{label('نظریه‌ای ثبت نشده است — «—»', 'No opinions — "—"')}</p>}
          {opinions.map((o) => {
            const st = String(o.ReviewStatus ?? 'draft');
            const mine = String(o.AuthoredBy ?? '') === String(userId ?? '');
            return (
              <div key={o.Id} className={card}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-[220px] flex-1">
                    <h4 className="tx1 text-xs font-bold">{String(o.TitleFa ?? EMPTY)} <span className="tx3 text-[9px]">v{String(o.Version ?? 1)}</span></h4>
                    <p className="tx3 text-[10px]">{String(o.Code)} · {label('مؤلف:', 'Author:')} {String(o.AuthoredBy ?? EMPTY)} {Boolean(o.PreviousVersionCode) && `· ${label('نسخهٔ پیشین:', 'Prev:')} ${String(o.PreviousVersionCode)}`}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${st === 'final' ? 'bg-[#1f4e79] text-white' : st === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{OPINION_REVIEW_CLIENT_FA[st] ?? st}</span>
                </div>
                <p className="tx2 mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px]">{String(o.BodyFa ?? EMPTY)}</p>
                {Array.isArray(o.SourcesJson) && (o.SourcesJson as { kind: string; code: string }[]).length > 0 && (
                  <p className="tx3 mt-1 text-[9px]">{label('منابع:', 'Sources:')} {(o.SourcesJson as { kind: string; code: string }[]).map((s2) => `${OPINION_SOURCE_KIND_CLIENT_FA[s2.kind] ?? s2.kind}:${s2.code}`).join('، ')}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {can('dispute.review') && !caseLocked && st === 'draft' && <button className={btn} disabled={busy} onClick={() => setOpinionStatus(o.Id, 'in_review')}>{label('ارسال به بازبینی', 'Send to review')}</button>}
                  {can('dispute.review') && !caseLocked && !mine && st === 'in_review' && <button className={btn} disabled={busy} onClick={() => setOpinionStatus(o.Id, 'approved')}>{label('تأیید', 'Approve')}</button>}
                  {can('dispute.review') && !caseLocked && !mine && (st === 'approved' || st === 'in_review') && <button className={btn} disabled={busy} onClick={() => setOpinionStatus(o.Id, 'final')}>{label('نهایی‌سازی', 'Finalize')}</button>}
                  {mine && st === 'in_review' && <span className="tx3 text-[9px]">{label('SoD: بازبینی/نهایی‌سازی نظریهٔ خودتان مجاز نیست', 'SoD: cannot finalize your own')}</span>}
                  {can('dispute.edit') && !caseLocked && <button className={btn} disabled={busy} onClick={() => cloneOpinionVersion(o)}>{label('نسخهٔ اصلاح‌شده', 'New revision')}</button>}
                  {can('dispute.edit') && !caseLocked && ['draft'].includes(st) && <button className={btn} disabled={busy} onClick={() => removeRow('PmisDisputeOpinions', o.Id)}>{label('حذف', 'Delete')}</button>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (tab === 'opinions' && <p className="tx3 py-8 text-center text-[11px]">{label('ابتدا از تب «مدیریت پرونده‌ها» پرونده‌ای انتخاب کنید', 'Select a case first')}</p>)}

      {/* فاز ۴ — گزارش‌ها (نسخه‌های ۲۰-فصل کارشناسی + ۱۴ گزارش مدیریتی) */}
      {tab === 'reports' && current ? (
        <div className="space-y-3">
          <div className={card}>
            <h3 className="tx1 mb-1 text-xs font-bold">{label('نسخه‌های گزارش کارشناسی', 'Expert report versions')}</h3>
            <p className="tx3 text-[10px]">{label('هر خروجی از دادهٔ زندهٔ پرونده و با ساختار ۲۰ فصل/۳۴ جدول ساخته می‌شود (Auto-Cleanup + B Nazanin). گردش: پیش‌نویس → بازبینی → تأیید → صدور؛ صدور نسخهٔ جدید، نسخهٔ صادرشدهٔ قبلی را «جایگزین‌شده» می‌کند.', 'Each output is built live from real case data — 20 chapters/34 tables. Lifecycle draft→review→approved→issued; newer issuance supersedes the older issued version.')}</p>
          </div>
          {can('dispute.edit') && !caseLocked && (
            <div className={`${card} flex flex-wrap items-center gap-2`}>
              <input className={`${inputClass} min-w-[240px] flex-1`} placeholder={label('عنوان نسخهٔ گزارش *', 'Report version title *')} value={repTitle} onChange={(e) => setRepTitle(e.target.value)} />
              <button className={btnP} disabled={busy || !repTitle.trim()} onClick={createReport}>{label('ثبت نسخهٔ جدید', 'Register version')}</button>
            </div>
          )}
          {reportRows.length === 0 && <p className="tx3 py-6 text-center text-[11px]">{label('نسخه‌ای ثبت نشده است — «—»', 'No report versions — "—"')}</p>}
          {[...reportRows].sort((a, b) => (Number(b.Version) || 0) - (Number(a.Version) || 0)).map((r) => {
            const st = String(r.Status ?? 'draft');
            return (
              <div key={r.Id} className={card}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-[240px] flex-1">
                    <h4 className="tx1 text-xs font-bold">{String(r.TitleFa ?? EMPTY)} <span className="tx3 text-[9px]">v{String(r.Version ?? 1)}</span></h4>
                    <p className="tx3 text-[10px]">{String(r.Code)}{Boolean(r.GeneratedAt) && ` · ${label('تولید:', 'Gen:')} ${String(r.GeneratedBy ?? EMPTY)} ${String(r.GeneratedAt).slice(0, 16).replace('T', ' ')}`}{Boolean(r.ApprovedBy) && ` · ${label('تأیید:', 'Appr:')} ${String(r.ApprovedBy)}`}{Boolean(r.IssuedBy) && ` · ${label('صدور:', 'Issued:')} ${String(r.IssuedBy)} ${String(r.IssuedAt ?? '').slice(0, 10)}`}</p>
                    {Boolean(r.DataVersionNoteFa) && <p className="tx3 text-[9px]">{String(r.DataVersionNoteFa)}</p>}
                    {Boolean(r.WordFileRef) && <p className="tx3 text-[9px]">Word: {String(r.WordFileRef)}{Boolean(r.PdfFileRef) && ` · PDF: ${String(r.PdfFileRef)}`}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${st === 'issued' ? 'bg-[#1f4e79] text-white' : st === 'superseded' ? 'bg-slate-200 text-slate-500 line-through' : st === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{REPORT_STATUS_CLIENT_FA[st] ?? st}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button className={btn} disabled={!!docBusy} onClick={() => void downloadDoc(r.Id, 'word')}>{docBusy === r.Id + ':word' ? label('…', '…') : label('دانلود Word', 'Word')}</button>
                  <button className={btn} disabled={!!docBusy} onClick={() => void downloadDoc(r.Id, 'pdf')}>{docBusy === r.Id + ':pdf' ? label('…', '…') : label('دانلود PDF', 'PDF')}</button>
                  {can('dispute.edit') && !caseLocked && st === 'draft' && <button className={btn} disabled={busy} onClick={() => setReportStatus(r.Id, 'in_review')}>{label('ارسال به بازبینی', 'Send to review')}</button>}
                  {can('dispute.review') && !caseLocked && st === 'in_review' && <button className={btn} disabled={busy} onClick={() => setReportStatus(r.Id, 'approved')}>{label('تأیید محتوا', 'Approve content')}</button>}
                  {can('dispute.edit') && !caseLocked && st === 'in_review' && <button className={btn} disabled={busy} onClick={() => setReportStatus(r.Id, 'draft')}>{label('بازگشت به پیش‌نویس', 'Back to draft')}</button>}
                  {can('dispute.approve') && !caseLocked && st === 'approved' && <button className={`${btnP}`} disabled={busy} onClick={() => setReportStatus(r.Id, 'issued')}>{label('صدور نسخه', 'Issue')}</button>}
                </div>
              </div>
            );
          })}

          {/* ۱۴ گزارش مدیریتی */}
          <div className={card}>
            <h3 className="tx1 mb-1 text-xs font-bold">{label('گزارش‌های مدیریتی پروژه (۱۴)', 'Management reports (14)')}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select className={`${inputClass} max-w-xs`} value={mgmtKind} onChange={(e) => setMgmtKind(e.target.value)}>
                {MANAGEMENT_REPORTS_CLIENT.map((m2) => <option key={m2.code} value={m2.code}>{m2.fa}</option>)}
              </select>
              <button className={btnP} disabled={mgmtBusy} onClick={() => void loadMgmt()}>{mgmtBusy ? label('در حال بارگذاری…', 'Loading…') : label('نمایش گزارش', 'Show report')}</button>
            </div>
            {mgmt && (
              <div className="mt-2 overflow-x-auto">
                <h4 className="tx1 text-[11px] font-bold">{mgmt.title}</h4>
                <table className="mt-1 w-full border-collapse text-[10px]">
                  <thead><tr>{mgmt.heads.map((h3) => <th key={h3} className="border b-line-soft bg-slate-100 px-2 py-1 text-start font-bold">{h3}</th>)}</tr></thead>
                  <tbody>
                    {mgmt.rows.length === 0 && <tr><td colSpan={mgmt.heads.length} className="border b-line-soft px-2 py-3 text-center tx3">{EMPTY}</td></tr>}
                    {mgmt.rows.map((row, ri) => <tr key={ri} className={ri % 2 ? 'bg-slate-50' : ''}>{row.map((cell, ci) => <td key={ci} className="border b-line-soft px-2 py-1">{cell}</td>)}</tr>)}
                  </tbody>
                </table>
                {Boolean(mgmt.noteFa) && <p className="tx3 mt-1 rounded-lg bg-blue-50 p-1.5 text-[9px] text-blue-900">{mgmt.noteFa}</p>}
              </div>
            )}
          </div>
        </div>
      ) : (tab === 'reports' && <p className="tx3 py-8 text-center text-[11px]">{label('ابتدا از تب «مدیریت پرونده‌ها» پرونده‌ای انتخاب کنید', 'Select a case first')}</p>)}

      {/* تاریخچه (همیشه در پایین) */}
      {current && auditTrail.length > 0 && (
        <div className={card}>
          <h3 className="tx1 mb-2 text-xs font-bold">{label('تاریخچهٔ پرونده', 'Case history')} ({auditTrail.length})</h3>
          <div className="max-h-[180px] space-y-1 overflow-y-auto">
            {[...auditTrail].sort((a, b) => String(b.OccurredAt).localeCompare(String(a.OccurredAt))).map((a) => (
              <div key={a.Id} className="flex items-start gap-2 text-[10px] tx3">
                <span className="w-24 shrink-0 font-mono text-[8px]">{String(a.OccurredAt).slice(0, 16).replace('T', ' ')}</span>
                <span className="w-20 shrink-0 tx1">{String(a.Actor)}</span>
                <span>{String(a.DetailFa ?? a.Action)}{a.FromValue && a.ToValue ? ` (${a.FromValue} → ${a.ToValue})` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
