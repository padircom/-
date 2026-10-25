import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { can as allowed } from '../services/accessControl';
import { normalizeQuantityChange, normalizeExtraWork } from '../services/contractVariations';
import { ContractVariationClient, type VariationKind, type VariationRow, type VariationWorkspace } from '../services/contractVariationApi';

const inputCls = 'glass-row w-full rounded-lg border b-line-soft px-2.5 py-1.5 text-[10.5px] font-normal tx1 outline-none';
const buttonCls = 'rounded-lg border b-line-soft px-3 py-1.5 text-[10px] font-normal tx2 disabled:opacity-40';
const statusFa: Record<string, string> = { draft: 'پیش‌نویس', proposed: 'پیش‌نویس کار جدید', submitted: 'در انتظار تصمیم', rate_pending: 'در انتظار توافق نرخ', approved: 'مصوب', agreed: 'توافق‌شده', rejected: 'ردشده', cancelled: 'لغوشده' };

export default function ContractVariationsPanel({ lang, projectId, contractId, onDone }: {
  lang: Lang; projectId: string; contractId: string; onDone: () => void;
}) {
  const tr = (fa: string, en: string) => lang === 'fa' ? fa : en;
  const fmt = (n?: number) => n == null ? '—' : n.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 3 });
  const { user } = useAuth();
  const subject = user ? { id: user.id, displayName: user.displayName, roles: [user.role], projectIds: user.projectIds, active: user.active } : null;
  const canEdit = allowed(subject, 'cnt.boq.edit', { projectId });
  const canApprove = allowed(subject, 'cnt.variation.approve', { projectId });
  const client = useMemo(() => new ContractVariationClient(projectId, contractId, user?.id ?? null), [projectId, contractId, user?.id]);
  const [data, setData] = useState<VariationWorkspace | null>(null);
  const [kind, setKind] = useState<VariationKind>('quantity');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<VariationRow>();
  const [form, setForm] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void client.list().then(r => { if (active) { if (r.ok) setData(r.data); else setError(r.message); } });
    return () => { active = false; };
  }, [client]);
  const load = async () => { const r = await client.list(); if (r.ok) setData(r.data); else setError(r.message); };
  const run = async (fn: () => ReturnType<typeof client.save>, saved = false) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await fn();
      if (!r.ok) { setError(r.message); if (r.status === 409) await load(); return; }
      if (saved) { setForm({}); setEditing(undefined); }
      await load(); onDone(); setMessage(tr('اقدام با موفقیت ثبت شد.', 'Action saved.'));
    } finally { setBusy(false); }
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    try { const fields = kind === 'quantity' ? normalizeQuantityChange(form) : normalizeExtraWork(form); void run(() => client.save(kind, fields, editing), true); }
    catch (err) { setError(err instanceof Error ? err.message : tr('ورودی نامعتبر است', 'Invalid input')); }
  };
  const field = (key: string, label: string, type = 'text', max?: number, required = true, step?: string) => <label key={key} className="text-[10px] tx3">
    {label}<input name={key} type={type} maxLength={max} required={required} step={step} value={form[key] ?? ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className={inputCls} />
  </label>;
  const items = data?.boq ?? [];
  const eligible = items.filter(b => b.PricingBasis === 'unit_price' && b.Status === 'active' && b.RateStatus === 'agreed' && !items.some(c => c.ParentItemNo === b.ItemNo && c.Status === 'active'));
  const target = eligible.find(b => b.Id === form.BoqItemId);
  const rows = kind === 'quantity' ? data?.quantities : data?.extras;
  const edit = (row: VariationRow) => {
    setEditing(row); setError(''); setMessage('');
    const keys = kind === 'quantity' ? ['BoqItemId', 'ChangeNo', 'NewQty'] : ['Code', 'TitleFa', 'Unit', 'Quantity', 'ProposedRate', 'AnalysisMethod'];
    const values: Record<string, string> = {};
    for (const key of [...keys, 'ReasonFa', 'DocumentRef', 'LinkedCrCode']) values[key] = String(row[key as keyof VariationRow] ?? '');
    setForm(values);
  };
  return <section aria-label={tr('تغییر مقادیر و کار جدید', 'Quantity changes and extra work')} className="glass-dark rounded-2xl p-3">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-[11px] font-semibold tx1">{tr('تغییر مقادیر و کار جدید پیمان انتخاب‌شده', 'Selected contract variations')}</h4>
      <button type="button" disabled={busy} onClick={() => void load()} className={buttonCls}>{tr('بازخوانی تغییرات', 'Refresh variations')}</button>
    </div>
    <p className="mb-2 text-[10px] tx3">{tr('درخواست مصوب روی فهرست بها اعمال می‌شود؛ مبلغ جاری پیمان فقط از مسیر الحاقیهٔ مصوب تغییر می‌کند. صورت‌وضعیت‌های قبلی بازنویسی نمی‌شوند.', 'Approval updates the BOQ, not the contract amount. The latter changes only via approved amendments. Prior IPCs are not rewritten.')}</p>
    <div className="mb-3 flex gap-2">{(['quantity', 'extra'] as const).map(k => <button type="button" key={k} disabled={busy} aria-pressed={kind === k} className={`${buttonCls} ${kind === k ? 'toggle-on tx1' : ''}`} onClick={() => { setKind(k); setForm({}); setEditing(undefined); setError(''); setMessage(''); }}>{k === 'quantity' ? tr('تغییر مقدار ردیف', 'Quantity change') : tr('کار جدید و توافق نرخ', 'Extra work and rate agreement')}</button>)}</div>
    {error && <p role="alert" className="mb-2 text-[10px] text-rose-300">{error}</p>}
    {message && <p role="status" className="mb-2 text-[10px] text-emerald-300">{message}</p>}
    {!data && !error && <p className="text-[10px] tx3">{tr('در حال بارگذاری…', 'Loading…')}</p>}
    {data && (!rows?.length ? <p className="mb-3 text-[10px] tx3">{tr('هنوز درخواستی ثبت نشده است.', 'No requests recorded.')}</p> : <div className="thin-scroll mb-3 overflow-x-auto"><table className="w-full text-[10px]">
      <thead><tr>{[tr('درخواست / ردیف', 'Request / item'), tr('مقدار و مبلغ (ریال)', 'Quantity and amount (IRR)'), tr('سند و علت', 'Evidence and reason'), tr('وضعیت / تصمیم', 'Status / decision'), tr('اقدام', 'Action')].map(h => <th key={h} className="p-2 text-start font-semibold tx3">{h}</th>)}</tr></thead>
      <tbody className="font-normal tx2">{rows?.map(row => {
        const draft = ['draft', 'proposed'].includes(row.Status);
        const submitted = ['submitted', 'rate_pending'].includes(row.Status);
        const independent = row.CreatedBy && row.SubmittedBy && ![row.CreatedBy, row.SubmittedBy].includes(user?.id ?? '');
        const item = items.find(b => b.Id === row.BoqItemId);
        const code = kind === 'quantity' ? `${item?.ItemNo ?? '—'} / ${row.ChangeNo ?? '—'}` : row.Code ?? '—';
        return <tr key={row.Id} className="border-b b-line-soft">
          <td className="p-2 align-top"><span dir="ltr">{code}</span><div>{kind === 'quantity' ? item?.TitleFa ?? '—' : row.TitleFa}</div></td>
          <td className="p-2 align-top">{kind === 'quantity' ? <>{tr('قبلی: ', 'Previous: ')}{fmt(row.PreviousQty)} / {tr('جدید: ', 'New: ')}{fmt(row.NewQty)}<div>{tr('تغییر مبلغ: ', 'Amount delta: ')}{fmt(row.DeltaAmount)}</div></> : <>{fmt(row.Quantity)} {row.Unit}<div>{tr('نرخ پیشنهادی: ', 'Proposed rate: ')}{fmt(row.ProposedRate)}</div><div>{tr('نرخ توافقی: ', 'Agreed rate: ')}{fmt(row.AgreedRate)}</div></>}</td>
          <td className="p-2 align-top">{row.DocumentRef || '—'}<div>{row.ReasonFa || '—'}</div><div>{row.LinkedCrCode || '—'}</div></td>
          <td className="p-2 align-top">{lang === 'fa' ? statusFa[row.Status] ?? row.Status : row.Status}<div>{row.DecisionNote || '—'}</div><span dir="ltr">{row.DecidedBy || '—'}</span></td>
          <td className="min-w-48 p-2 align-top">{((draft && canEdit) || (submitted && canApprove)) && <>
            <input aria-label={`${tr('شرح تصمیم تغییر', 'Variation decision')} ${row.Id}`} maxLength={2000} className={inputCls} value={notes[row.Id] ?? ''} onChange={e => setNotes(p => ({ ...p, [row.Id]: e.target.value }))} />
            {kind === 'extra' && submitted && <label className="text-[10px] tx3">{tr('نرخ توافق‌شده (ریال)', 'Agreed rate (IRR)')}<input type="number" min="0.01" step="0.01" aria-label={`${tr('نرخ توافق‌شده', 'Agreed rate')} ${row.Id}`} className={inputCls} value={rates[row.Id] ?? ''} onChange={e => setRates(p => ({ ...p, [row.Id]: e.target.value }))} /></label>}
            <div className="mt-1 flex flex-wrap gap-1">
              {draft && <button type="button" disabled={busy} className={buttonCls} onClick={() => edit(row)}>{tr('ویرایش درخواست', 'Edit request')}</button>}
              {(draft ? ['submit', 'cancel'] : ['approve', 'reject']).map(action => <button type="button" key={action} disabled={busy || (submitted && !independent)} className={buttonCls}
                title={submitted && !independent ? tr('تصمیم‌گیرندهٔ مستقل الزامی است', 'Independent decision maker required') : undefined}
                onClick={() => void run(() => client.transition(kind, row, action, notes[row.Id] ?? '', rates[row.Id]))}>
                {({ submit: tr('ارسال درخواست', 'Submit request'), cancel: tr('لغو درخواست', 'Cancel request'), approve: tr('تصویب درخواست', 'Approve request'), reject: tr('رد درخواست', 'Reject request') } as Record<string, string>)[action]}
              </button>)}
            </div>
          </>}</td>
        </tr>;
      })}</tbody>
    </table></div>)}
    {canEdit && <form onSubmit={save} aria-label={tr('فرم تغییرات پیمان', 'Contract variation form')}>
      <h5 className="mb-2 text-[11px] font-semibold tx1">{editing ? tr('ویرایش پیش‌نویس درخواست', 'Edit draft request') : tr('ثبت پیش‌نویس درخواست', 'New draft request')}</h5>
      <fieldset disabled={busy} className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {kind === 'quantity' ? <>
          <label className="text-[10px] tx3">{tr('ردیف فهرست بها', 'BOQ item')}<select required name="BoqItemId" className={inputCls} value={form.BoqItemId ?? ''} onChange={e => setForm(p => ({ ...p, BoqItemId: e.target.value }))}><option value="">—</option>{eligible.map(b => <option key={b.Id} value={b.Id}>{b.ItemNo} — {b.TitleFa}</option>)}</select></label>
          {field('ChangeNo', tr('شماره تغییر', 'Change number'), 'number', undefined, true, '1')}
          {field('NewQty', tr('مقدار جدید', 'New quantity'), 'number', undefined, true, '0.001')}
          <div className="text-[10px] tx3">{tr('مقدار فعلی: ', 'Current quantity: ')}{fmt(target?.ContractQty ?? undefined)}<div>{tr('نرخ فعلی: ', 'Current rate: ')}{fmt(target?.UnitRate ?? undefined)}</div></div>
        </> : <>
          {field('Code', tr('کد کار جدید / شماره ردیف', 'Extra work code / item number'), 'text', 40)}
          {field('TitleFa', tr('شرح کار جدید', 'Extra work description'), 'text', 600)}
          {field('Unit', tr('واحد', 'Unit'), 'text', 20)}
          {field('Quantity', tr('مقدار کار جدید', 'Extra work quantity'), 'number', undefined, true, '0.001')}
          {field('ProposedRate', tr('نرخ پیشنهادی (ریال)', 'Proposed rate (IRR)'), 'number', undefined, true, '0.01')}
          <label className="text-[10px] tx3">{tr('روش تحلیل نرخ', 'Rate analysis method')}<select required name="AnalysisMethod" value={form.AnalysisMethod ?? ''} onChange={e => setForm(p => ({ ...p, AnalysisMethod: e.target.value }))} className={inputCls}><option value="">—</option>{Object.entries({ similar_item: tr('ردیف مشابه', 'Similar item'), rate_analysis: tr('تجزیه‌بهای نرخ', 'Rate analysis'), daywork: tr('روزکاری', 'Daywork') }).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </>}
        {field('ReasonFa', tr('علت و توجیه درخواست', 'Request justification'), 'text', 1000)}
        {field('DocumentRef', tr('مرجع سند پشتیبان', 'Supporting document reference'), 'text', 200)}
        {field('LinkedCrCode', tr('کد تغییر مرتبط (اختیاری)', 'Linked change code (optional)'), 'text', 40, false)}
      </fieldset>
      {kind === 'quantity' && data && !eligible.length && <p className="mt-2 text-[10px] tx3">{tr('ردیف فعال فهرست‌بهایی با نرخ توافق‌شده در این پیمان موجود نیست.', 'No eligible active unit-price BOQ item is available.')}</p>}
      <div className="mt-2 flex gap-2"><button disabled={busy} className={buttonCls}>{tr('ذخیرهٔ درخواست', 'Save request')}</button>{editing && <button type="button" disabled={busy} className={buttonCls} onClick={() => { setEditing(undefined); setForm({}); }}>{tr('انصراف از ویرایش', 'Discard edits')}</button>}</div>
    </form>}
  </section>;
}
