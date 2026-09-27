import { useEffect, useRef, useState, type ReactNode } from 'react';
import { type Lang } from '../data/framework';
import { jsonRequest } from '../services/apiClient';
import { type Persisted, type SxWorkspace } from '../services/strategyExcellenceWorkspace';

type Base = {Code:string;TitleFa:string;DataDate:string};
type Props<T extends Base,M> = {lang:Lang;projectId:string;userId:string|null;path:string;resource:string;title:string;notice:string;newValue:()=>T;editor:(value:T,setValue:(v:T)=>void)=>ReactNode;result:(row:Persisted<T>&{metrics:M})=>ReactNode};
/** Shared persistence UX: no optimistic success, stale response reuse, or localStorage substitute. */
export default function PersistentBusinessWorkspace<T extends Base,M>(p:Props<T,M>) {
  type Saved=Persisted<T>&{metrics:M};
  const fa=p.lang==='fa', t=(a:string,b:string)=>fa?a:b;
  const [data,setData]=useState<SxWorkspace<Saved>|null>(null);
  const [draft,setDraft]=useState<{value:T;id?:string;version?:number}|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const alive=useRef(true),sequence=useRef(0);
  const base=`/api/${p.path}/${encodeURIComponent(p.projectId)}`;
  async function load(select?:string) {
    const seq=++sequence.current;setBusy(true);setError('');
    const r=await jsonRequest<SxWorkspace<Saved>>(base+'/workspace',p.userId,'GET');
    if(!alive.current||seq!==sequence.current)return;
    setBusy(false);
    if(r.ok){setData(r.data);setSelected(select??r.data.records[0]?.Id??null);}
    else {setData(null);setSelected(null);setError(r.message);}
  }
  useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;sequence.current++;};},[base,p.userId]);
  useEffect(()=>{
    if(!draft)return;
    const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[draft]);
  const discard=()=>!draft||window.confirm(t('پیش‌نویس ذخیره نشده کنار گذاشته شود؟','Discard the unsaved draft?'));
  function edit(row?:Saved) {
    if(!discard())return;
    setError('');setSuccess('');
    const blank=p.newValue();
    const value=row?Object.fromEntries(Object.keys(blank).map(k=>[k,(row as unknown as Record<string,unknown>)[k]])) as T:blank;
    setDraft({value:structuredClone(value),id:row?.Id,version:row?.RowVersion});
  }
  async function save() {
    if(!draft||busy)return;setBusy(true);setError('');setSuccess('');
    const r=await jsonRequest<Saved>(base+'/'+p.resource+(draft.id?'/'+encodeURIComponent(draft.id):''),p.userId,draft.id?'PATCH':'POST',{...draft.value,...(draft.id?{RowVersion:draft.version}:{})});
    if(!alive.current)return;
    setBusy(false);
    if(!r.ok){setError(r.message);if(r.status===401||r.status===403){setData(null);setDraft(null);}return;}
    setDraft(null);setSuccess(t('ذخیره روی سرور انجام شد.','Saved on the server.'));await load(r.data.Id);
  }
  const current=data?.records.find(r=>r.Id===selected);
  const button='rounded-lg border b-line-soft px-3 py-2 text-xs tx1 disabled:opacity-40';
  return <div dir={fa?'rtl':'ltr'} className="min-h-0 flex-1 overflow-y-auto space-y-3 p-1">
    <header className="glass-dark rounded-xl p-3 flex flex-wrap gap-3 items-center"><div className="flex-1"><h3 className="tx1 font-semibold">{p.title}</h3><p className="text-xs tx3" dir="ltr">{p.projectId}</p></div>
      <button className={button} disabled={busy} onClick={()=>{if(discard()){setDraft(null);setSuccess('');void load(selected??undefined);}}}>{t('بازخوانی از سرور','Reload from server')}</button>
      {data?.canEdit&&<button className={button} disabled={busy} onClick={()=>edit()}>{t('رکورد جدید','New record')}</button>}
    </header>
    <p className="text-xs tx3 glass-dark rounded-xl p-3">{p.notice}</p>
    {error&&<p role="alert" className="text-sm text-rose-400 border border-rose-500/30 rounded-xl p-3">{error}</p>}
    {success&&<p role="status" className="text-xs text-emerald-400">{success}</p>}
    {busy&&<p role="status" className="text-xs tx3">{t('در حال ارتباط با سرور…','Contacting server…')}</p>}
    {data&&<>
      <p className="text-xs tx3">{t('دادهٔ اظهارشدهٔ پروژه، نه تجمیع خودکار سازمان. نسخهٔ مدل: ','Project-declared data, not an automatic organizational rollup. Model: ')}<span dir="ltr">{data.modelVersion}</span> · {data.canEdit?t('مجوز ویرایش','Editable'):t('فقط مشاهده','Read only')}</p>
      {!data.records.length&&<p className="glass-dark rounded-xl p-4 tx2 text-sm">{t('هنوز رکوردی ذخیره نشده است؛ دادهٔ نمونه درج نمی‌شود.','No saved records. No sample observations are inserted.')}</p>}
      {!!data.records.length&&<nav className="flex flex-wrap gap-2">{data.records.map(r=><button className={`${button} ${selected===r.Id?'toggle-on':''}`} disabled={busy} key={r.Id} onClick={()=>{if(discard()){setDraft(null);setSelected(r.Id);setError('');setSuccess('');}}}>{r.Code} · {r.TitleFa} · {r.DataDate}</button>)}</nav>}
      {draft?<form className="glass-dark rounded-xl p-3 space-y-3" onSubmit={e=>{e.preventDefault();void save();}}>
        <p className="text-xs text-amber-300">{t('پیش‌نویس ذخیره نشده؛ تعویض پروژه یا کاربر آن را کنار می‌گذارد. امتیاز پس از ذخیره از سرور محاسبه می‌شود.','Unsaved draft; changing project or user discards it. Scores are calculated by the server after saving.')}</p>
        <fieldset disabled={busy||!data.canEdit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3"><BusinessField label={t('کد لاتین','Code')} value={draft.value.Code} readOnly={Boolean(draft.id)} onChange={v=>setDraft({...draft,value:{...draft.value,Code:v}})}/><BusinessField label={t('عنوان','Title')} value={draft.value.TitleFa} onChange={v=>setDraft({...draft,value:{...draft.value,TitleFa:v}})}/><BusinessField label={t('تاریخ اظهار داده','Declared data date')} type="date" value={draft.value.DataDate} onChange={v=>setDraft({...draft,value:{...draft.value,DataDate:v}})}/></div>
          {p.editor(draft.value,value=>setDraft({...draft,value}))}
          <div className="flex flex-wrap gap-3"><button className={button} type="submit">{t('ذخیره روی سرور','Save to server')}</button><button className={button} type="button" onClick={()=>{if(discard())setDraft(null);}}>{t('انصراف','Cancel')}</button></div>
        </fieldset>
      </form>:current&&<section className="glass-dark rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap gap-3 items-center"><h4 className="text-sm tx1 flex-1">{current.TitleFa}</h4>{data.canEdit&&<button disabled={busy} className={button} onClick={()=>edit(current)}>{t('ویرایش رکورد','Edit record')}</button>}</div>
        <p className="text-xs tx3">{t('تاریخ اظهار: ','Declared date: ')}{current.DataDate} · {t('نسخه: ','Revision: ')}{current.RowVersion} · {t('آخرین ثبت: ','Latest write: ')}<span dir="ltr">{current.UpdatedAt??current.CreatedAt}</span> · {current.UpdatedBy??current.CreatedBy}</p>
        {p.result(current)}
      </section>}
    </>}
  </div>;
}
export function BusinessField({label,value,onChange,type='text',readOnly=false,optional=false,min,max}:{label:string;value:string|number|null;onChange:(v:string)=>void;type?:string;readOnly?:boolean;optional?:boolean;min?:number;max?:number}) {
  const cls='mt-1 w-full rounded-lg border b-line-soft bg-[var(--row)] px-2 py-2 tx1 disabled:opacity-50';
  return <label className="block min-w-0 text-xs tx3">{label}{type==='textarea'?<textarea className={cls} rows={2} value={value??''} required={!optional} onChange={e=>onChange(e.target.value)}/>:<input className={cls} type={type} step={type==='number'?'any':undefined} min={min} max={max} value={value??''} required={!optional} readOnly={readOnly} onChange={e=>onChange(e.target.value)}/>}</label>;
}
