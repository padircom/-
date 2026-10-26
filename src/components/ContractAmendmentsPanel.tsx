import PersianDateInput from "./PersianDateInput";
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { can as allowed } from '../services/accessControl';
import { ContractAmendmentClient, type AmendmentRow, type AmendmentWorkspace } from '../services/contractAmendmentApi';
import { normalizeAmendment } from '../services/contractAmendments';

const inputCls = 'glass-row w-full rounded-lg border b-line-soft px-2.5 py-1.5 text-[10.5px] font-normal tx1 outline-none';
const buttonCls = 'rounded-lg border b-line-soft px-3 py-1.5 text-[10px] font-normal tx2 disabled:opacity-40';
const statusFa: Record<string, string> = { draft: 'پیش‌نویس', submitted: 'در انتظار تصمیم', approved: 'مصوب', rejected: 'ردشده', cancelled: 'لغوشده' };
const empty = { Code: '', TitleFa: '', AmendmentType: 'amount', EffectiveDate: '', AmountDelta: '', DurationDeltaDays: '', LinkedCrCode: '', DocumentRef: '' };

export default function ContractAmendmentsPanel({ lang, projectId, contractId, onDone }: {
  lang: Lang; projectId: string; contractId: string; onDone: () => void;
}) {
  const rtl = lang === 'fa';
  const tr = (fa: string, en: string) => rtl ? fa : en;
  const { user } = useAuth();
  const subject = user ? { id: user.id, displayName: user.displayName, roles: [user.role], projectIds: user.projectIds, active: user.active } : null;
  const canEdit = allowed(subject, 'cnt.contract.edit', { projectId });
  const canApprove = allowed(subject, 'cnt.amendment.approve', { projectId });
  const client = useMemo(() => new ContractAmendmentClient(projectId, contractId, user?.id ?? null), [projectId, contractId, user?.id]);
  const [data, setData] = useState<AmendmentWorkspace | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AmendmentRow | undefined>();
  const [form, setForm] = useState(empty);
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void client.list().then(r => { if (!active) return; if (r.ok) setData(r.data); else setError(r.message); });
    return () => { active = false; };
  }, [client]);
  const load = async () => {
    const r = await client.list();
    if (r.ok) setData(r.data); else setError(r.message);
  };
  const run = async (fn: () => ReturnType<typeof client.save>, saved = false) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await fn();
      if (!r.ok) { setError(r.message); if (r.status === 409) await load(); return; }
      if (saved) { setForm(empty); setEditing(undefined); }
      await load(); onDone();
      setMessage(tr('اقدام با موفقیت ثبت شد.', 'Action saved.'));
    } finally { setBusy(false); }
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    try { const fields = normalizeAmendment(form); void run(() => client.save(fields, editing), true); }
    catch (err) { setError(err instanceof Error ? err.message : tr('ورودی نامعتبر است', 'Invalid input')); }
  };
  const edit = (row: AmendmentRow) => {
    setEditing(row); setError(''); setMessage('');
    setForm({ Code: row.Code, TitleFa: row.TitleFa, AmendmentType: row.AmendmentType, EffectiveDate: row.EffectiveDate.slice(0, 10),
      AmountDelta: String(row.AmountDelta ?? 0), DurationDeltaDays: String(row.DurationDeltaDays ?? 0), LinkedCrCode: row.LinkedCrCode ?? '', DocumentRef: row.DocumentRef ?? '' });
  };
  const fmt = (n: number) => n.toLocaleString(rtl ? 'fa-IR' : 'en-US', { maximumFractionDigits: 2 });
  return (
    <section aria-label={tr('مدیریت الحاقیه‌ها', 'Contract amendments')} className="glass-dark rounded-2xl p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold tx1">{tr('الحاقیه‌های پیمان انتخاب‌شده', 'Selected contract amendments')}</h4>
        <button type="button" disabled={busy} onClick={() => void load()} className={buttonCls}>{tr('بازخوانی الحاقیه‌ها', 'Refresh amendments')}</button>
      </div>
      <p className="mb-2 text-[10px] tx3">{tr('فقط الحاقیهٔ مصوب بر مبلغ و مدت جاری اثر دارد. تأییدکننده باید مستقل از ثبت‌کننده و ارسال‌کننده باشد.', 'Only approved amendments affect the current amount and duration. The decision maker must be independent of the creator and submitter.')}</p>
      {error && <p role="alert" className="mb-2 text-[10px] text-rose-300">{error}</p>}
      {message && <p role="status" className="mb-2 text-[10px] text-emerald-300">{message}</p>}
      {!data && !error && <p className="text-[10px] tx3">{tr('در حال بارگذاری…', 'Loading…')}</p>}
      {data && <>
        <div className="mb-3 flex flex-wrap gap-4 text-[11px] tx2">
          <span>{tr('مبلغ جاری (ریال): ', 'Current amount (IRR): ')}{fmt(data.currentAmount)}</span>
          <span>{tr('مدت جاری (روز): ', 'Current duration (days): ')}{fmt(data.currentDurationDays)}</span>
        </div>
        {!data.items.length ? <p className="mb-3 text-[10px] tx3">{tr('هنوز الحاقیه‌ای ثبت نشده است.', 'No amendments recorded.')}</p> : <div className="thin-scroll mb-3 overflow-x-auto">
          <table className="w-full text-start text-[10px]">
            <thead className="font-semibold tx3"><tr>{[tr('کد / موضوع', 'Code / subject'), tr('تاریخ اثر / سند', 'Effective date / document'), tr('تغییر مبلغ / مدت', 'Amount / duration change'), tr('وضعیت و تصمیم', 'Status / decision'), tr('اقدام', 'Action')].map(h => <th key={h} className="p-2 text-start font-semibold">{h}</th>)}</tr></thead>
            <tbody className="font-normal tx2">{data.items.map(row => <tr key={row.Id} className="border-b b-line-soft">
              <td className="p-2 align-top"><span dir="ltr">{row.Code}</span><div>{row.TitleFa}</div><div className="tx3">{tr('تغییر مرتبط: ', 'Linked change: ')}{row.LinkedCrCode || '—'}</div></td>
              <td className="p-2 align-top"><div dir="ltr">{row.EffectiveDate.slice(0, 10)}</div><div>{row.DocumentRef || '—'}</div></td>
              <td className="p-2 align-top">{fmt(row.AmountDelta)} {tr('ریال', 'IRR')}<div>{fmt(row.DurationDeltaDays)} {tr('روز', 'days')}</div></td>
              <td className="p-2 align-top">{rtl ? statusFa[row.Status] ?? row.Status : row.Status}<div>{row.DecisionNote || '—'}</div><div dir="ltr" className="tx3">{row.DecidedBy || '—'} · {row.DecidedAt?.slice(0, 10) || '—'}</div></td>
              <td className="min-w-48 p-2 align-top">
                {((row.Status === 'draft' && canEdit) || (row.Status === 'submitted' && canApprove)) && <>
                  <input aria-label={`${tr('شرح تصمیم', 'Decision note')} ${row.Code}`} value={notes[row.Id] ?? ''} onChange={e => setNotes(p => ({ ...p, [row.Id]: e.target.value }))} maxLength={2000} className={inputCls} />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.Status === 'draft' && <button type="button" disabled={busy} className={buttonCls} onClick={() => edit(row)}>{tr('ویرایش', 'Edit')}</button>}
                    {(row.Status === 'draft' ? ['submit', 'cancel'] : ['approve', 'reject']).map(action => {
                      const independent = row.CreatedBy && row.SubmittedBy && ![row.CreatedBy, row.SubmittedBy].includes(user?.id ?? '');
                      return <button type="button" key={action} disabled={busy || (['approve', 'reject'].includes(action) && !independent)} className={buttonCls}
                        title={!independent && row.Status === 'submitted' ? tr('تصمیم‌گیرندهٔ مستقل الزامی است', 'Independent decision maker required') : undefined}
                        onClick={() => void run(() => client.transition(row, action, notes[row.Id] ?? ''))}>
                        {({ submit: tr('ارسال برای تأیید', 'Submit'), cancel: tr('لغو', 'Cancel'), approve: tr('تصویب', 'Approve'), reject: tr('رد', 'Reject') } as Record<string, string>)[action]}
                      </button>;
                    })}
                  </div>
                </>}
              </td>
            </tr>)}</tbody>
          </table>
        </div>}
      </>}
      {canEdit && <form onSubmit={save} aria-label={tr('فرم الحاقیه', 'Amendment form')}>
        <h5 className="mb-2 text-[11px] font-semibold tx1">{editing ? tr('ویرایش پیش‌نویس الحاقیه', 'Edit amendment draft') : tr('ثبت پیش‌نویس الحاقیه', 'New amendment draft')}</h5>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {([['Code', tr('کد الحاقیه', 'Amendment code'), 'text', 40], ['TitleFa', tr('موضوع الحاقیه', 'Amendment subject'), 'text', 400], ['EffectiveDate', tr('تاریخ اثر', 'Effective date'), 'date', undefined], ['DocumentRef', tr('مرجع سند پشتیبان', 'Supporting document reference'), 'text', 200], ['AmountDelta', tr('تغییر مبلغ (ریال؛ کاهش منفی)', 'Amount delta (IRR; negative for decrease)'), 'number', undefined], ['DurationDeltaDays', tr('تغییر مدت (روز؛ کاهش منفی)', 'Duration delta (days; negative for decrease)'), 'number', undefined], ['LinkedCrCode', tr('کد تغییر مرتبط (اختیاری)', 'Linked change code (optional)'), 'text', 40]] as const).map(([key, label, type, max]) => <label key={key} className="text-[10px] tx3">
            {label}{type === 'date' ? <PersianDateInput name={key} required={!['AmountDelta', 'DurationDeltaDays', 'LinkedCrCode'].includes(key)} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className={inputCls} /> : <input name={key} type={type} required={!['AmountDelta', 'DurationDeltaDays', 'LinkedCrCode'].includes(key)} maxLength={max} step={key === 'AmountDelta' ? '0.01' : '1'} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className={inputCls} /> }
          </label>)}
          <label className="text-[10px] tx3">{tr('نوع الحاقیه', 'Amendment type')}<select value={form.AmendmentType} onChange={e => setForm(p => ({ ...p, AmendmentType: e.target.value }))} className={inputCls}>
            {Object.entries({ amount: tr('مبلغ', 'Amount'), duration: tr('مدت', 'Duration'), scope: tr('دامنه', 'Scope'), rate: tr('نرخ', 'Rate') }).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        </div>
        <div className="mt-2 flex gap-2"><button disabled={busy} className={buttonCls}>{tr('ذخیرهٔ پیش‌نویس', 'Save draft')}</button>
          {editing && <button type="button" disabled={busy} className={buttonCls} onClick={() => { setEditing(undefined); setForm(empty); }}>{tr('انصراف از ویرایش', 'Discard edits')}</button>}</div>
      </form>}
    </section>
  );
}
