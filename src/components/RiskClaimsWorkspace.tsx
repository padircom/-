import { useEffect, useRef, useState } from 'react';
import { type Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { jsonRequest } from '../services/apiClient';
import { DELAY_METHODS, IMPACT_DIMS, RBS, scoreColor } from '../services/rcc';
import { type RccKind, type RccRow, type RccWorkspace } from '../services/rccWorkspace';

export type D4Tab = 'matrix' | 'register' | 'reserve' | 'issue' | 'change' | 'ccb' | 'delay' | 'claim' | 'notice' | 'dispute' | 'invest' | 'exec';
type Props = { lang: Lang; projectId: string; subId?: string; initialTab?: D4Tab; hideTabs?: boolean };
const TABS: [D4Tab, string, string][] = [
  ['matrix', 'ماتریس', 'Matrix'], ['register', 'ثبت ریسک', 'Risks'], ['change', 'تغییر', 'Changes'], ['ccb', 'تصویب تغییر', 'CCB'],
  ['claim', 'ادعا', 'Claims'], ['notice', 'اعلان قراردادی', 'Notices'], ['delay', 'تحلیل تأخیر', 'Delay analysis'], ['exec', 'خلاصه', 'Summary'],
];
function tabFromSub(sub = ''): D4Tab {
  const explicit: Record<string, D4Tab> = { 'd4-p1-rsv': 'reserve', 'd4-p1-iss': 'issue', 'd4-p1-mx': 'matrix', 'd4-p3-ccb': 'ccb', 'd4-p5-ntc': 'notice', 'd4-p5-tb': 'notice', 'd4-p5-dsp': 'dispute', 'd4-p5-exe': 'exec' };
  return explicit[sub] ?? (sub.startsWith('d4-p3') ? 'change' : sub.startsWith('d4-p4') ? 'delay' : sub.startsWith('d4-p5') ? 'claim' : 'register');
}
const FIELDS: Record<RccKind, [string, string, string, string?][]> = {
  risks: [['Code', 'کد', 'Code'], ['TitleFa', 'عنوان', 'Title'], ['Owner', 'مالک', 'Owner'], ['Probability', 'احتمال ۱ تا ۵', 'Probability 1–5', 'number'], ['Impact', 'اثر ۱ تا ۵', 'Impact 1–5', 'number'], ['Cause', 'علت', 'Cause'], ['Event', 'رویداد', 'Event'], ['Effect', 'پیامد', 'Effect'], ['Response', 'پاسخ / اقدام', 'Response'], ['SourceRef', 'مرجع', 'Source reference']],
  changes: [['Code', 'کد', 'Code'], ['TitleFa', 'عنوان', 'Title'], ['Reason', 'دلیل تغییر', 'Reason'], ['CostImpact', 'اثر مالی (واحد پول پروژه)', 'Cost impact (project currency)', 'number'], ['TimeImpactDays', 'اثر زمانی (روز)', 'Time impact (days)', 'number']],
  claims: [['Code', 'کد', 'Code'], ['TitleFa', 'عنوان', 'Title'], ['EventDate', 'تاریخ رویداد', 'Event date', 'date'], ['NoticeDays', 'مهلت قراردادی ابلاغ (روز)', 'Contract notice period (days)', 'number'], ['Clause', 'بند قرارداد', 'Contract clause'], ['Amount', 'مبلغ (واحد پول پروژه)', 'Amount (project currency)', 'number'], ['ExtensionDays', 'تمدید خواسته‌شده (روز)', 'Requested EOT days', 'number'], ['Entitlement', 'مبنای استحقاق', 'Entitlement'], ['Causation', 'رابطهٔ سببیت', 'Causation'], ['QuantumNote', 'مبنای محاسبهٔ مبلغ / مدت', 'Quantum basis'], ['EvidenceRef', 'مرجع مستندات', 'Evidence reference'], ['BaselineId', 'شناسهٔ برنامهٔ مبنای جاری', 'Current baseline ID'], ['DataDate', 'تاریخ دادهٔ تحلیل', 'Analysis data date', 'date']],
};
const fresh = (kind: RccKind, today: string): Record<string, unknown> => kind === 'risks'
  ? { Category: 'PM', Probability: 3, Impact: 3, Status: 'open' }
  : kind === 'changes' ? { CostImpact: 0, TimeImpactDays: 0, Assessment: {} }
  : { EventDate: today, NoticeDays: 28, Amount: 0, ExtensionDays: 0, DataDate: today };
const EDIT = { risks: 'rcc.risk.edit', changes: 'rcc.change.raise', claims: 'rcc.claim.edit' };

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
  const generation = useRef(0);
  const mounted = useRef(true);
  const kind: RccKind = ['claim', 'notice', 'dispute', 'delay'].includes(tab) ? 'claims' : ['change', 'ccb'].includes(tab) ? 'changes' : 'risks';
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
    setEditing(null); setForm(fresh(kind, workspace?.today ?? '')); setReason(''); setNoticeRef('');
    await load();
    if (mounted.current) setBusy(false);
  }
  function select(row: RccRow) {
    setEditing(row);
    let assessment = row.Assessment;
    if (typeof assessment === 'string') { try { assessment = JSON.parse(assessment); } catch { assessment = {}; } }
    setForm({ ...row, Assessment: assessment ?? {}, DataDate: String(row.DataDate ?? '').slice(0, 10), EventDate: String(row.EventDate ?? '').slice(0, 10) });
  }
  const rows = workspace?.[kind] ?? [];
  const hidden = workspace?.[`${kind}Hidden`];
  const inputClass = 'rounded-lg border b-line-soft bg-[var(--row)] px-2 py-2 text-[11px] tx1 w-full';
  const btn = 'rounded-lg border b-line-soft px-3 py-2 text-[11px] tx1 disabled:opacity-40';
  const locked = Boolean(editing && kind !== 'risks' && !['draft', 'pending'].includes(editing.Status));
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
      {['reserve', 'issue', 'dispute', 'invest'].includes(tab) ? <section className="glass-dark rounded-xl p-4 tx2 text-sm">
        {label('این ابزار هنوز به گردش‌کار ماندگار متصل نیست. اعداد و دکمه‌های نمونهٔ قبلی حذف شده‌اند؛ برای ثبت عملیاتی از ریسک، تغییر و ادعا استفاده کنید.', 'This tool is not yet connected to a persisted workflow. Previous demo values and actions have been removed. Use risks, changes and claims for operational records.')}
      </section> : tab === 'delay' ? <section className="glass-dark rounded-xl p-4 space-y-3 tx2 text-sm">
        <h4>{label('روش‌های تحلیل تأخیر — راهنمای روش، نه محاسبهٔ خودکار', 'Delay analysis methods — reference, not an automatic calculation')}</h4>
        {DELAY_METHODS.map(m => <p key={m.code}>{label(m.fa, m.en)}</p>)}
        <p>{label('از محتوای مرجع کارگاه میراثی: برنامهٔ مبنا، دادهٔ واقعی، رابطهٔ سببیت و مستندات باید مبنای تحلیل باشند. عدد ثابت TF×۱۲ و ادعای محاسبهٔ مسیر بحرانی حذف شده است. مدت و مبنای تحلیل در پروندهٔ ادعا ثبت می‌شود.', 'Baseline, actual data, causation and evidence must underpin the analysis. The synthetic TF×12 calculation is removed. Record the requested duration and analysis basis in the claim.')}</p>
      </section> : tab === 'exec' ? <section className="grid grid-cols-3 gap-3">{(['risks', 'changes', 'claims'] as const).map(k => <div className="glass-dark rounded-xl p-4 tx1" key={k}>{k}: {workspace[`${k}Hidden`] ? label('بدون مجوز', 'Restricted') : workspace[k].length}</div>)}</section> : <>
        {tab === 'matrix' && !workspace.risksHidden && <section className="glass-dark rounded-xl p-3 grid grid-cols-5 gap-2">{[5, 4, 3, 2, 1].flatMap(p => [1, 2, 3, 4, 5].map(i => <div key={`${p}-${i}`} className="rounded-lg p-3 text-center text-sm" style={{ border: `1px solid ${scoreColor(p * i)}`, color: scoreColor(p * i) }}><div>P{p} × I{i}</div>{workspace.risks.filter(r => r.Probability === p && r.Impact === i).length}</div>))}</section>}
        {hidden ? <p className="tx3 text-sm">{label('مجوز مشاهدهٔ این داده‌ها را ندارید.', 'You do not have permission to view these records.')}</p> : <section className="space-y-2">
          {!rows.length && <p className="tx3 text-sm p-3">{label('هیچ رکوردی برای این پروژه ثبت نشده؛ دادهٔ نمونه خودکار درج نمی‌شود.', 'No records in this project. Sample data is never inserted automatically.')}</p>}
          {rows.map(row => <article key={row.Id} className="glass-dark rounded-xl p-3 space-y-2 text-xs tx2">
            <div className="flex flex-wrap items-center gap-3"><strong className="tx1">{row.Code} — {row.TitleFa}</strong><span>{row.Status}</span><span dir="ltr">v{row.RowVersion}</span><button className={btn} onClick={() => select(row)}>{label('جزئیات / انتخاب', 'Details / select')}</button></div>
            {kind === 'risks' && <p>{label('امتیاز / مالک / پاسخ: ', 'Score / owner / response: ')}{String(row.Score)} · {String(row.Owner ?? '')} · {String(row.Response ?? '')}</p>}
            {kind === 'changes' && <p>{label('اثر مالی / روز / تصمیم: ', 'Cost / days / decision: ')}{String(row.CostImpact ?? '—')} · {String(row.TimeImpactDays ?? '—')} · {String(row.DecisionReason ?? '—')}</p>}
            {kind === 'claims' && <><p>{label('مبلغ / روز: ', 'Amount / days: ')}{String(row.Amount ?? '—')} · {String(row.ExtensionDays ?? '—')}</p><p>{label('مهلت ابلاغ: ', 'Notice deadline: ')}{String((row.notice as { dueAt?: string })?.dueAt ?? '—')} · {(row.notice as { timeBarred?: boolean })?.timeBarred ? 'TIME-BARRED' : row.NoticeDeliveredAt ? label('مرجع ابلاغ ثبت شده', 'Notice reference recorded') : label('ابلاغ ثبت نشده', 'No notice recorded')}</p></>}
          </article>)}
        </section>}
        {(has(EDIT[kind]) || editing) && <form className="glass-dark rounded-xl p-4 space-y-3" onSubmit={e => { e.preventDefault(); void mutate(`/${kind}${editing ? '/' + encodeURIComponent(editing.Id) : ''}`, editing ? 'PATCH' : 'POST', { ...form, ...(editing ? { RowVersion: editing.RowVersion } : {}) }); }}>
          <div className="flex gap-3 tx1 text-sm"><h4>{editing ? label('رکورد انتخاب‌شده', 'Selected record') : label('ثبت جدید', 'Create record')}</h4><button type="button" className={btn} onClick={() => { setEditing(null); setForm(fresh(kind, workspace.today)); }}>{label('فرم جدید', 'New form')}</button></div>
          <fieldset disabled={busy || locked || !has(EDIT[kind])} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELDS[kind].map(([key, a, b, type]) => <label key={key} className="text-[11px] tx3">{label(a, b)}<input aria-label={label(a, b)} className={inputClass} type={type ?? 'text'} step={type === 'number' ? 'any' : undefined} disabled={Boolean(editing && (key === 'Code' || (editing.NoticeDeliveredAt && ['EventDate', 'NoticeDays', 'Clause'].includes(key))))} value={String(form[key] ?? '')} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value }))} /></label>)}
            {kind === 'risks' && <><select aria-label="Category" className={inputClass} value={String(form.Category ?? 'PM')} onChange={e => setForm(f => ({ ...f, Category: e.target.value }))}>{RBS.map(r => <option key={r.code} value={r.code}>{label(r.fa, r.en)}</option>)}</select><select aria-label="Status" className={inputClass} value={String(form.Status ?? 'open')} onChange={e => setForm(f => ({ ...f, Status: e.target.value }))}>{['open', 'mitigated', 'accepted'].map(s => <option key={s}>{s}</option>)}</select></>}
            {kind === 'changes' && <div className="col-span-full flex flex-wrap gap-3 tx2 text-xs">{IMPACT_DIMS.map(k => <label key={k}><input type="checkbox" checked={(form.Assessment as Record<string, boolean> | undefined)?.[k] === true} onChange={e => setForm(f => ({ ...f, Assessment: { ...(f.Assessment as object), [k]: e.target.checked } }))} /> {k}</label>)}</div>}
            <button className={btn} type="submit">{label('ذخیره در سرور', 'Save to server')}</button>
          </fieldset>
          {locked && <p className="text-amber-400 text-xs">{label('رکورد قفل است؛ تغییر مشخصات مجاز نیست.', 'Record is locked; editing is not allowed.')}</p>}
          {kind === 'claims' && <p className="tx3 text-xs">{label('مهلت ۲۸ روز فقط مقدار اولیهٔ فرم است؛ طبق بند قرارداد اصلاح کنید. پس از ابلاغ، تاریخ، مهلت و بند قفل می‌شود؛ مستندات تا نهایی‌سازی قابل تکمیل است.', '28 days is only a form default; adjust to the contract. Notice date, period and clause are locked after recording; complete evidence before finalization.')}</p>}
        </form>}
        {editing && kind === 'changes' && has('rcc.change.approve') && ['draft', 'pending'].includes(editing.Status) && <section className="glass-dark rounded-xl p-3 flex flex-wrap gap-2"><input className={inputClass} placeholder={label('دلیل تصمیم', 'Decision reason')} value={reason} onChange={e => setReason(e.target.value)} />{['approved', 'rejected'].map(decision => <button disabled={busy} key={decision} className={btn} onClick={() => void mutate(`/changes/${encodeURIComponent(editing.Id)}/decision`, 'POST', { decision, reason, RowVersion: editing.RowVersion })}>{decision}</button>)}</section>}
        {editing && kind === 'claims' && editing.Status === 'draft' && <section className="glass-dark rounded-xl p-3 space-y-2">
          {has('rcc.claim.edit') && !editing.NoticeDeliveredAt && <><input className={inputClass} placeholder={label('شماره / مرجع ابلاغ انجام‌شده', 'Reference of delivered notice')} value={noticeRef} onChange={e => setNoticeRef(e.target.value)} /><button className={btn} disabled={busy} onClick={() => void mutate(`/claims/${encodeURIComponent(editing.Id)}/notice`, 'POST', { NoticeRef: noticeRef, RowVersion: editing.RowVersion })}>{label('ثبت مرجع ابلاغ امروز (بدون ارسال ایمیل)', 'Record today’s notice reference (no email sent)')}</button></>}
          {has('rcc.claim.submit') && <button className={btn} disabled={busy} onClick={() => void mutate(`/claims/${encodeURIComponent(editing.Id)}/submit`, 'POST', { RowVersion: editing.RowVersion })}>{label('نهایی‌سازی بستهٔ ادعا', 'Finalize claim package')}</button>}
          <p className="tx3 text-xs">{label('ثبت وضعیت داخلی است؛ تحویل حقوقی یا ارسال به طرف قرارداد خودکار انجام نمی‌شود.', 'This records internal status; legal service or external delivery is not automated.')}</p>
        </section>}
      </>}
    </>}
  </div>;
}
