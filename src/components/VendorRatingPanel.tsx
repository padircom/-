import { useEffect, useRef, useState, type FormEvent } from 'react';
import { type Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { jsonRequest } from '../services/apiClient';
import { RATING_AXES, type Evaluation, type Improvement } from '../services/vendorEvaluation';
import JalaliDateInput from './JalaliDateInput';

type Source = { SourceKind: string; SourceId: string; PartyName: string; SourceCode: string };
type Workspace = { sources: Source[]; evaluations: Evaluation[]; history: (Evaluation & { Trend: number | null; Latest: boolean })[]; actions: Improvement[]; owners: { id: string; name: string }[]; permissions: { edit: boolean; approve: boolean }; today: string };
const input = 'w-full rounded-lg border b-line-soft bg-[var(--panel2)] px-2 py-1.5 text-[11px] font-normal tx1';
const button = 'rounded-lg border b-line-soft px-2 py-1 text-[10px] tx2 disabled:opacity-40';
const statuses: Record<string, string> = { submitted: 'در انتظار تأیید', approved: 'تأییدشده', rejected: 'ردشده', open: 'تعریف‌شده', in_progress: 'در حال اجرا', completed: 'در انتظار بررسی اثربخشی', verified: 'اثربخشی تأییدشده', cancelled: 'لغوشده' };
export default function VendorRatingPanel({ lang, projectId, section }: { lang: Lang; projectId: string; section: 'scoring' | 'monitoring' }) {
  const { user } = useAuth();
  const fa = lang === 'fa';
  const tr = (a: string, b: string) => fa ? a : b;
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [period, setPeriod] = useState('');
  const [due, setDue] = useState('');
  const [evaluationId, setEvaluationId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const base = `/api/cnt-rating/${encodeURIComponent(projectId)}`;
  const load = async () => {
    const n = ++generation.current;
    const res = await jsonRequest<Workspace>(base, user?.id ?? null, 'GET');
    if (generation.current !== n) return;
    if (res.ok) { setWs(res.data); } else { setWs(null); setError(res.message); }
  };
  useEffect(() => { void load(); return () => { generation.current++; }; }, [base, user?.id]);
  useEffect(() => { setNotice(''); setError(''); setNotes({}); setEditing(null); setPeriod(''); setDue(''); setEvaluationId(''); }, [section]);
  const mutate = async (path: string, body: unknown, onSuccess?: () => void) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const res = await jsonRequest(base + path, user?.id ?? null, 'POST', body);
      if (!res.ok) { setError(res.message); return; }
      onSuccess?.(); setNotice(tr('ثبت شد.', 'Saved.')); await load();
    } finally { lock.current = false; setBusy(false); }
  };
  const num = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString(fa ? 'fa-IR' : 'en-US');
  const date = (v: string) => new Date(String(v).slice(0, 10) + 'T12:00:00Z').toLocaleDateString(fa ? 'fa-IR' : 'en-GB');
  const axis = (v: string) => { const a = RATING_AXES.find(a => a.code === v); return a ? (fa ? a.label.fa : a.label.en) : '—'; };
  const status = (v: string) => fa ? statuses[v] ?? v : v.replace(/_/g, ' ');
  const scoring = section === 'scoring';
  const history = ws?.history ?? [];
  const latest = history.filter(e => e.Latest);
  const approved = ws?.evaluations.filter(e => e.Status === 'approved') ?? [];
  const submitScore = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    if (editing) {
      void mutate(`/evaluations/${editing.Id}/resubmit`, { RowVersion: editing.RowVersion, DocumentRef: f.get('DocumentRef'), Scores: Object.fromEntries(RATING_AXES.map(a => [a.code, Number(f.get(a.code))])) }, () => { setEditing(null); setPeriod(''); });
      return;
    }
    const src = ws?.sources.find(s => `${s.SourceKind}:${s.SourceId}` === f.get('source'));
    if (!src || !period) { setError(tr('طرف قرارداد و تاریخ دوره را انتخاب کنید.', 'Select a source and period date.')); return; }
    void mutate('/evaluations', { SourceKind: src.SourceKind, SourceId: src.SourceId, PeriodDate: period, DocumentRef: f.get('DocumentRef'), Scores: Object.fromEntries(RATING_AXES.map(a => [a.code, Number(f.get(a.code))])) }, () => { form.reset(); setPeriod(''); });
  };
  const submitAction = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    if (!due) { setError(tr('موعد اقدام را انتخاب کنید.', 'Choose a due date.')); return; }
    void mutate('/actions', { EvaluationId: evaluationId, Axis: f.get('Axis'), TitleFa: f.get('TitleFa'), OwnerId: f.get('OwnerId'), DueDate: due }, () => { form.reset(); setEvaluationId(''); setDue(''); });
  };
  return <section dir={fa ? 'rtl' : 'ltr'} className="flex h-full min-h-0 flex-col gap-2 overflow-hidden" aria-label={tr(scoring ? 'امتیازدهی وزنی' : 'روند، پایش و فهرست بهبود', scoring ? 'Weighted scoring' : 'Trend and improvement')}>
    <header className="shrink-0 flex items-center justify-between gap-2"><h3 className="text-[12px] font-semibold tx1">{tr(scoring ? 'امتیازدهی وزنی' : 'روند، پایش و فهرست بهبود', scoring ? 'Weighted scoring' : 'Trend and improvement')}</h3><button className={button} disabled={busy} onClick={() => { setError(''); void load(); }}>{tr('بازخوانی', 'Refresh')}</button></header>
    {error && <p role="alert" className="shrink-0 text-[11px] text-red-500">{error}</p>}
    {notice && <p role="status" className="shrink-0 text-[11px] tx2">{notice}</p>}
    {!ws ? <p className="text-[11px] tx3">{error ? '—' : tr('در حال دریافت…', 'Loading…')}</p> : <div className="thin-scroll min-h-0 flex-1 overflow-auto space-y-3" key={section} data-rating-content={section}>
      {scoring ? <>
        <p className="text-[10px] tx3">{tr('وزن‌ها: ایمنی، کیفیت و زمان هرکدام ۲۰؛ قیمت و مستندات هرکدام ۱۵؛ همکاری ۱۰. رتبه‌ها: A از ۸۵، B از ۷۰، C از ۵۵ و D کمتر از ۵۵. فقط ارزیابی تأییدشده وارد روند می‌شود.', 'Weights: HSE, quality and time 20 each; price and documentation 15 each; cooperation 10. Grades: A ≥85, B ≥70, C ≥55, D <55. Only approved evaluations enter the trend.')}</p>
        {ws.permissions.edit && <form key={editing?.Id ?? "new"} aria-label="ثبت ارزیابی دوره‌ای" onSubmit={submitScore} className="space-y-2 rounded-xl border b-line-soft p-3">
          <h4 className="text-[11px] font-semibold tx1">{tr('ثبت ارزیابی دوره‌ای', 'Record periodic evaluation')}</h4>
          <fieldset disabled={busy} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <label className="col-span-2 text-[10px] tx3">{tr('طرف قرارداد / پیمان یا سفارش واقعی', 'Party / real contract or purchase order')}<select required name="source" className={input} disabled={!!editing} defaultValue={editing ? `${editing.SourceKind}:${editing.SourceId}` : ""}><option value="">—</option>{ws.sources.map(s => <option key={`${s.SourceKind}:${s.SourceId}`} value={`${s.SourceKind}:${s.SourceId}`}>{s.PartyName} · {s.SourceCode} · {tr(s.SourceKind === 'contract' ? 'پیمان' : 'سفارش خرید', s.SourceKind)}</option>)}</select></label>
            <label className="text-[10px] tx3">{tr('تاریخ دوره', 'Period date')}<JalaliDateInput ariaLabel="تاریخ دوره ارزیابی" className={input} value={period} onChange={setPeriod} disabled={busy || !!editing} /></label>
            <label className="text-[10px] tx3">{tr('مرجع سند ارزیابی', 'Evaluation document reference')}<input required name="DocumentRef" defaultValue={editing?.DocumentRef ?? ""} maxLength={200} className={input} /></label>
            {RATING_AXES.map(a => <label key={a.code} className="text-[10px] tx3">{fa ? a.label.fa : a.label.en} ({num(a.weight)}٪)<input required name={a.code} defaultValue={editing?.Scores[a.code] ?? ""} type="number" min="0" max="100" step="0.1" className={input} /></label>)}
          </fieldset>
          {!ws.sources.length && <p className="text-[10px] tx3">{tr('پیمان یا سفارش خرید قابل ارزیابی در این پروژه ثبت نشده است.', 'No eligible contract or purchase order is registered in this project.')}</p>}
          <button disabled={busy || (!editing && !ws.sources.length)} className={button}>{tr(editing ? 'ارسال مجدد برای تأیید' : 'ثبت و ارسال برای تأیید', 'Submit for approval')}</button>{editing && <button type="button" className={button} disabled={busy} onClick={() => { setEditing(null); setPeriod(''); }}>{tr('انصراف از اصلاح', 'Cancel revision')}</button>}
        </form>}
        <div className="overflow-x-auto"><table className="w-full text-[10px] text-start"><thead><tr>{[tr('طرف قرارداد / دوره', 'Party / period'), tr('امتیاز / رتبه', 'Score / grade'), tr('امتیاز محورها', 'Axis scores'), tr('وضعیت / سند', 'Status / evidence'), tr('تصمیم', 'Decision')].map(t => <th key={t} className="p-2 text-start font-semibold tx3">{t}</th>)}</tr></thead><tbody>
          {ws.evaluations.map(e => <tr key={e.Id} className="border-t b-line-soft font-normal tx2"><td className="p-2">{e.PartyName} · {e.SourceCode}<div>{date(e.PeriodDate)}</div></td><td className="p-2">{num(e.Weighted)} / {e.Grade}</td><td className="p-2">{RATING_AXES.map(a => `${axis(a.code)}: ${num(e.Scores[a.code])}`).join(' · ')}</td><td className="p-2">{status(e.Status)}<div>{e.DocumentRef}</div></td><td className="p-2">
            {ws.permissions.approve && e.Status === 'submitted' && e.CreatedBy !== user?.id ? <div className="space-y-1"><input aria-label={`شرح تصمیم ${e.SourceCode}`} placeholder={tr('شرح تصمیم الزامی', 'Decision note required')} maxLength={2000} value={notes[e.Id] ?? ''} onChange={v => setNotes(n => ({ ...n, [e.Id]: v.target.value }))} className={input} />{['approve', 'reject'].map(action => <button key={action} disabled={busy || !notes[e.Id]?.trim()} className={button} onClick={() => void mutate(`/evaluations/${e.Id}/decision`, { action, RowVersion: e.RowVersion, note: notes[e.Id] })}>{tr(action === 'approve' ? 'تأیید' : 'رد', action)}</button>)}</div> : <>{e.DecisionNote ?? '—'}{ws.permissions.edit && e.Status === 'rejected' && e.CreatedBy === user?.id && <button className={button} disabled={busy} onClick={() => { setEditing(e); setPeriod(String(e.PeriodDate).slice(0, 10)); document.querySelector('[data-rating-content]')?.scrollTo({ top: 0 }); }}>{tr('اصلاح و ارسال مجدد', 'Revise and resubmit')}</button>}</>}
          </td></tr>)}
        </tbody></table></div>
        {!ws.evaluations.length && <p className="text-[11px] tx3">{tr('هنوز ارزیابی ثبت نشده است.', 'No evaluations recorded yet.')}</p>}
      </> : <>
        <p className="text-[11px] tx2">{tr('ارزیابی‌های جاری تأییدشده', 'Latest approved evaluations')}: {latest.length ? num(latest.length) : '—'} · {tr('نیازمند پایش (C/D)', 'Watchlist (C/D)')}: {latest.length ? num(latest.filter(e => ['C', 'D'].includes(e.Grade)).length) : '—'}</p>
        <p className="text-[10px] tx3">{tr('میانگین امتیاز جاری', 'Average current score')}: {latest.length ? num(Math.round(latest.reduce((sum, e) => sum + e.Weighted, 0) / latest.length)) : '—'} · {tr('توزیع رتبه', 'Grade mix')}: {['A', 'B', 'C', 'D'].map(g => `${g}: ${latest.length ? num(latest.filter(e => e.Grade === g).length) : '—'}`).join(' · ')}</p>
        <p className="text-[10px] tx3">{tr('روند بر اساس دوره‌های تأییدشدهٔ همان پیمان یا سفارش خرید محاسبه می‌شود؛ آخرین دوره با «جاری» مشخص است.', 'Trend compares approved periods of the same contract or purchase order. The latest period is marked current.')}</p>
        <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr>{[tr('طرف قرارداد / دوره', 'Party / period'), tr('امتیاز / رتبه', 'Score / grade'), tr('روند', 'Trend'), tr('محور هدف بهبود', 'Improvement target')].map(t => <th key={t} className="p-2 text-start font-semibold tx3">{t}</th>)}</tr></thead><tbody>{history.map(e => <tr key={e.Id} className="border-t b-line-soft font-normal tx2"><td className="p-2">{e.PartyName} · {e.SourceCode} · {date(e.PeriodDate)} {e.Latest && tr('· جاری', '· current')}</td><td className="p-2">{num(e.Weighted)} / {e.Grade}</td><td className="p-2" dir="ltr">{e.Trend != null && e.Trend > 0 ? '+' : ''}{num(e.Trend)}</td><td className="p-2">{axis(e.Weakest)}</td></tr>)}</tbody></table></div>
        {!history.length && <p className="text-[11px] tx3">{tr('هنوز ارزیابی تأییدشده‌ای برای نمایش روند وجود ندارد.', 'No approved evaluation history yet.')}</p>}
        {ws.permissions.edit && <form aria-label="ثبت اقدام بهبود" onSubmit={submitAction} className="space-y-2 rounded-xl border b-line-soft p-3"><h4 className="text-[11px] font-semibold tx1">{tr('ثبت اقدام بهبود', 'Create improvement action')}</h4><fieldset disabled={busy} className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <label className="text-[10px] tx3">{tr('ارزیابی مبنا', 'Reference evaluation')}<select required className={input} value={evaluationId} onChange={e => setEvaluationId(e.target.value)}><option value="">—</option>{approved.map(e => <option key={e.Id} value={e.Id}>{e.PartyName} · {e.SourceCode} · {date(e.PeriodDate)}</option>)}</select></label>
          <label className="text-[10px] tx3">{tr('محور بهبود', 'Improvement axis')}<select key={evaluationId} name="Axis" required className={input} defaultValue={approved.find(e => e.Id === evaluationId)?.Weakest ?? ''}><option value="">—</option>{RATING_AXES.map(a => <option key={a.code} value={a.code}>{axis(a.code)}</option>)}</select></label>
          <label className="text-[10px] tx3">{tr('مسئول اقدام', 'Action owner')}<select name="OwnerId" required className={input} defaultValue=""><option value="">—</option>{ws.owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label className="col-span-2 text-[10px] tx3">{tr('شرح اقدام', 'Action description')}<input name="TitleFa" required maxLength={400} className={input} /></label>
          <label className="text-[10px] tx3">{tr('موعد اقدام', 'Due date')}<JalaliDateInput ariaLabel="موعد اقدام" value={due} onChange={setDue} className={input} disabled={busy} /></label>
        </fieldset><button className={button} disabled={busy || !approved.length}>{tr('ثبت اقدام بهبود', 'Create improvement action')}</button></form>}
        <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr>{[tr('اقدام / مبنا', 'Action / reference'), tr('مسئول / موعد', 'Owner / due date'), tr('وضعیت', 'Status'), tr('پیگیری و مستندات', 'Tracking and evidence')].map(t => <th key={t} className="p-2 text-start font-semibold tx3">{t}</th>)}</tr></thead><tbody>{ws.actions.map(a => {
          const ref = ws.evaluations.find(e => e.Id === a.EvaluationId);
          const actions = [...(ws.permissions.edit ? a.Status === 'open' ? ['start', 'cancel'] : a.Status === 'in_progress' ? ['complete', 'cancel'] : [] : []), ...(ws.permissions.approve && a.Status === 'completed' ? a.CompletedBy !== user?.id ? ['verify', 'reopen'] : ['reopen'] : [])];
          return <tr key={a.Id} className="border-t b-line-soft font-normal tx2"><td className="p-2">{a.TitleFa}<div>{ref ? `${ref.PartyName} · ${ref.SourceCode} · ${date(ref.PeriodDate)}` : '—'} · {axis(a.Axis)}</div></td><td className="p-2">{ws.owners.find(o => o.id === a.OwnerId)?.name ?? a.OwnerId}<div>{date(a.DueDate)}</div></td><td className="p-2">{status(a.Status)}{String(a.DueDate).slice(0, 10) < ws.today && ['open', 'in_progress', 'completed'].includes(a.Status) && <div className="text-red-500">{tr('عقب‌افتاده', 'Overdue')}</div>}</td><td className="p-2"><div>{a.Evidence ?? '—'}</div>{actions.length > 0 && <><input aria-label={`مستند اقدام ${a.TitleFa}`} placeholder={tr('مستند انجام / علت بازگشایی یا لغو', 'Completion evidence / reopen or cancel reason')} maxLength={2000} value={notes[a.Id] ?? ''} onChange={e => setNotes(n => ({ ...n, [a.Id]: e.target.value }))} className={input} />{actions.map(action => <button className={button} key={action} disabled={busy || (['complete', 'cancel', 'reopen'].includes(action) && !notes[a.Id]?.trim())} onClick={() => void mutate(`/actions/${a.Id}/transitions`, { action, RowVersion: a.RowVersion, evidence: notes[a.Id] })}>{tr(({ start: 'شروع', complete: 'ثبت انجام', verify: 'تأیید اثربخشی', reopen: 'بازگشایی', cancel: 'لغو' } as Record<string, string>)[action], action)}</button>)}</>}</td></tr>;
        })}</tbody></table></div>
        {!ws.actions.length && <p className="text-[11px] tx3">{tr('هنوز اقدام بهبود ثبت نشده است.', 'No improvement actions recorded yet.')}</p>}
      </>}
    </div>}
  </section>;
}
