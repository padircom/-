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
import { disputeApi, type DisputeCase, type DisputeCatalog, type DisputeDashboard, type DisputeRow, CASE_STATUS_FA, PRIORITY_FA, CLAIM_BASIS_FA, REVIEW_STATUS_FA, EVIDENCE_STATUS_FA, EMPTY } from '../services/disputeExpertClient';
import JalaliDateInput from './JalaliDateInput';

const btn = 'rounded-lg border b-line-soft px-2.5 py-1 text-[11px] transition hover:opacity-80 disabled:opacity-40';
const btnP = 'rounded-lg bg-[#1f4e79] px-3 py-1 text-[11px] text-white transition hover:opacity-90 disabled:opacity-40';
const card = 'rounded-xl border b-line-soft bg-white/60 p-3';
const kpi = 'rounded-xl border b-line-soft bg-white/70 p-3 text-center';
const inputClass = 'w-full rounded-lg border b-line-soft bg-transparent px-2 py-1 text-xs tx1';

type Tab = 'dashboard' | 'cases' | 'parties' | 'evidence' | 'claims';

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
  const generation = useRef(0);
  const mounted = useRef(true);

  const can = (p: string) => catalog?.permissions.includes(p) ?? false;
  const parties = children.PmisDisputeParties ?? [];
  const claims = children.PmisDisputeClaims ?? [];
  const evidence = children.PmisDisputeEvidence ?? [];
  const responses = children.PmisDisputeResponses ?? [];
  const auditTrail = children.PmisDisputeAuditTrail ?? [];
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

  if (loading && !catalog) return <p className="tx3 p-4">{label('در حال بارگذاری…', 'Loading…')}</p>;
  if (!catalog) return <p className="tx3 p-4">{label('دسترسی انجام نشد — مجوز dispute.view لازم است.', 'No access — dispute.view required.')}</p>;

  const TABS: { id: Tab; fa: string; en: string }[] = [
    { id: 'dashboard', fa: 'داشبورد مدیریتی', en: 'Executive dashboard' },
    { id: 'cases', fa: 'مدیریت پرونده‌ها', en: 'Cases' },
    { id: 'parties', fa: 'طرفین و نمایندگان', en: 'Parties' },
    { id: 'evidence', fa: 'مستندات و ادله', en: 'Evidence' },
    { id: 'claims', fa: 'ادعاها و دفاعیات', en: 'Claims & defenses' },
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
