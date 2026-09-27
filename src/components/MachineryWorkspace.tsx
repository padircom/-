import { useEffect, useRef, useState } from 'react';
import { type Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { jsonRequest } from '../services/apiClient';
import { tableDef } from '../services/persistence';
import { EQUIPMENT_CATEGORY_CATALOG, EQP_REPORT_CATALOG, DISPATCH_FLOW } from '../services/equipment';
export type EqmTab = 'fleet' | 'dispatch' | 'meter' | 'fuel' | 'rental' | 'maintenance' | 'parts' | 'productivity';
type Row = { Id: string; RowVersion: number; [key: string]: unknown };
type Workspace = { projectId: string; today: string; rows: Record<string, Row[]>; permissions: string[] };
type Props = { lang: Lang; projectId: string; initialTab?: EqmTab; hideTabs?: boolean };
const TABS: [EqmTab, string, string][] = [['fleet','ناوگان','Fleet'],['dispatch','دیسپچ','Dispatch'],['meter','ساعت کارکرد','Meters'],['fuel','سوخت','Fuel'],['rental','اجاره','Rental'],['maintenance','تعمیرات / PM','Maintenance / PM'],['parts','قطعات','Parts'],['productivity','بهره‌وری / گزارش','KPIs / reports']];
const TABLES: Record<EqmTab, string> = { fleet:'Equipment', dispatch:'EquipmentDispatch', meter:'EquipmentMeter', fuel:'EquipmentFuelLog', rental:'EquipmentRental', maintenance:'MaintenanceOrder', parts:'SparePart', productivity:'Equipment' };
const LABELS: Record<string,string> = { Code:'کد',NameFa:'نام',TitleFa:'عنوان',Category:'دسته',Ownership:'مالکیت',BrandFa:'برند',Model:'مدل',Year:'سال ساخت',Capacity:'ظرفیت',CapacityUom:'واحد ظرفیت',Status:'وضعیت',CommissionedAt:'تاریخ بهره‌برداری',LocationFa:'محل',PurchaseValue:'ارزش خرید',SalvageValue:'ارزش اسقاط',EquipmentId:'ماشین',ReadAt:'تاریخ قرائت',HourMeter:'ساعت‌شمار',WorkHours:'کارکرد روز (ساعت)',Source:'منبع',Supplier:'تأمین‌کننده',ContractNo:'شماره قرارداد',RateType:'نوع نرخ',Rate:'نرخ',Currency:'ارز',StartDate:'شروع',EndDate:'پایان',Kind:'نوع',Priority:'اولویت',ReportedAt:'تاریخ گزارش',DownFrom:'آغاز توقف',DownTo:'پایان توقف',Cost:'هزینه',DescriptionFa:'شرح',AssignedTo:'مسئول',RootCause:'علت ریشه‌ای',DispatchDate:'تاریخ دیسپچ',Shift:'شیفت',OperatorId:'شناسه اپراتور در HRM',ActivityId:'شناسه فعالیت',CostAccountId:'شناسه حساب هزینه',SiteFa:'محل کار',PlannedHours:'ساعت برنامه',PlannedQty:'حجم برنامه',QtyUom:'واحد حجم',SafetyCheck:'کنترل ایمنی انجام شد',NoteFa:'یادداشت',LogDate:'تاریخ مصرف',Quantity:'مقدار',Uom:'واحد',UnitCost:'بهای واحد',Basis:'مبنای PM',IntervalValue:'فاصله سرویس',LastDoneAt:'آخرین سرویس',LastDoneReading:'قرائت آخرین سرویس',ChecklistFa:'چک‌لیست',Active:'فعال',PartNo:'کد قطعه',OnHand:'موجودی',MinLevel:'حداقل موجودی',LeadTimeDays:'زمان تأمین',AvgDailyUsage:'مصرف روزانه',Critical:'بحرانی',EquipmentCategory:'دسته ماشین' };
const ENUMS: Record<string,string[]> = { Ownership:['owned','rented','leased'],Source:['manual','telemetry'],RateType:['hourly','daily','monthly'],Priority:['low','medium','high','critical'],Shift:['day','night','full'],Basis:['run_hours','calendar_days','kilometers','cycles'] };
const initial = (table: string, today: string): Record<string,unknown> => ({ Equipment:{Category:'EXC',Ownership:'owned',Status:'active'},EquipmentMeter:{ReadAt:today,Source:'manual',HourMeter:0,WorkHours:0},EquipmentRental:{RateType:'daily',Currency:'IRR',Status:'active',StartDate:today},MaintenanceOrder:{Kind:'corrective',Priority:'medium',Status:'open',ReportedAt:today,Cost:0},EquipmentDispatch:{DispatchDate:today,Shift:'day',PlannedHours:8,SafetyCheck:false},EquipmentFuelLog:{LogDate:today,Kind:'diesel'},PmSchedule:{Basis:'run_hours',Active:true},SparePart:{OnHand:0,MinLevel:0,Critical:false} }[table] ?? {});
export default function MachineryWorkspace(props: Props) {
  const { user } = useAuth();
  return <LiveMachinery key={`${props.projectId}:${user?.id}`} {...props} userId={user?.id ?? null} />;
}
function LiveMachinery({lang,projectId,initialTab='fleet',hideTabs,userId}: Props & {userId:string|null}) {
  const fa=lang==='fa'; const text=(a:string,b:string)=>fa?a:b;
  const [tab,setTab]=useState<EqmTab>(initialTab);
  const [pm,setPm]=useState(false);
  const table=tab==='maintenance' && pm ? 'PmSchedule' : TABLES[tab];
  const [data,setData]=useState<Workspace|null>(null);
  const [form,setForm]=useState<Record<string,unknown>>({});
  const [selected,setSelected]=useState<Row|null>(null);
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true);
  const [reportEquipment,setReportEquipment]=useState('');
  const [metrics,setMetrics]=useState<Record<string,unknown>|null>(null);
  const alive=useRef(true); const sequence=useRef(0);
  const root=`/api/eqp/${encodeURIComponent(projectId)}`;
  const canManage=data?.permissions.includes('eqm.workspace.manage');
  const canApprove=data?.permissions.includes('eqm.dispatch.approve');
  async function load() {
    const id=++sequence.current; setLoading(true);
    const result=await jsonRequest<Workspace>(root+'/workspace',userId,'GET');
    if(!alive.current || sequence.current!==id)return;
    setLoading(false);
    if(result.ok){setData(result.data);setError('');}else{setData(null);setError(result.message);}
  }
  useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;sequence.current++;};},[projectId,userId]);
  useEffect(()=>setTab(initialTab),[initialTab]);
  useEffect(()=>{setForm(initial(table,data?.today??''));setSelected(null);setMetrics(null);},[table,data?.today,tab]);
  async function save(path:string,method:string,body:unknown) {
    if(busy)return; setBusy(true);setError('');
    const result=await jsonRequest<Row>(root+path,userId,method,body);
    if(!alive.current)return;
    if(result.ok){setSelected(null);setForm(initial(table,data?.today??''));await load();}else setError(result.message);
    if(alive.current)setBusy(false);
  }
  async function inspect(path:string) {
    setBusy(true);setError('');
    const result=await jsonRequest<Record<string,unknown>>(`${path}${path.includes('?')?'&':'?'}projectId=${encodeURIComponent(projectId)}`,userId,'GET');
    if(!alive.current)return;
    if(result.ok)setMetrics(result.data);else setError(result.message);
    setBusy(false);
  }
  async function download(code:string) {
    if(code==='RPT-EQP-CARD'&&!reportEquipment){setError(text('ماشین را برای کارت شناسنامه انتخاب کنید.','Select equipment for the ID card.'));return;}
    setBusy(true);setError('');
    try {
      const res=await fetch(`/api/eqp/reports/${code}?projectId=${encodeURIComponent(projectId)}&format=csv&equipmentId=${encodeURIComponent(reportEquipment)}`,{headers:userId?{'x-user-id':userId}:{}});
      if(!res.ok){const e=await res.json();throw new Error(e.error?.message??'Report failed');}
      const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download=`${projectId}-${code}.csv`;a.click();URL.revokeObjectURL(url);
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Report failed');}
    if(alive.current)setBusy(false);
  }
  const columns=tableDef(table)?.columns.filter(c=>!['Id','ProjectId','ApprovedBy','EnteredBy','IssuedBy'].includes(c.name) && !(table==='EquipmentDispatch'&&c.name==='Status'))??[];
  const input='w-full rounded-lg border b-line-soft bg-[var(--row)] p-2 text-xs tx1';
  const button='rounded-lg border b-line-soft px-3 py-2 text-xs tx1 disabled:opacity-40';
  const locked=table==='EquipmentDispatch'&&selected&&!['draft','rejected'].includes(String(selected.Status));
  const equipmentName=(id:unknown)=>data?.rows.Equipment.find(e=>e.Id===id)?.NameFa??id;
  return <div dir={fa?'rtl':'ltr'} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
    <header className="glass-dark rounded-xl p-3 flex flex-wrap items-center gap-3"><h3 className="tx1 font-semibold">{text('ماشین‌آلات — دادهٔ زنده','Machinery — live data')}</h3><span className="tx3 text-xs" dir="ltr">{projectId} · {data?.today}</span><button className={button} disabled={busy||loading} onClick={()=>void load()}>{text('تازه‌سازی','Refresh')}</button></header>
    {!hideTabs&&<nav className="flex flex-wrap gap-2">{TABS.map(([id,a,b])=><button key={id} className={`${button} ${tab===id?'toggle-on':''}`} onClick={()=>setTab(id)}>{text(a,b)}</button>)}</nav>}
    {error&&<p role="alert" className="rounded-xl p-3 bg-rose-500/10 text-rose-400 text-sm">{error}</p>}
    {loading&&<p className="tx3">{text('در حال بارگذاری…','Loading…')}</p>}
    {!loading&&data&&<>
      <p className="text-xs tx3">{text('PMO ثبت‌کنندهٔ عملیات و مدیر پروژه تصویب‌کنندهٔ دیسپچ است. دادهٔ نمونه خودکار درج نمی‌شود.','PMO records operations; project manager approves dispatch. No automatic sample data.')}</p>
      {tab==='maintenance'&&<button className={button} onClick={()=>setPm(!pm)}>{pm?text('نمایش تعمیرات','Work orders'):text('نمایش برنامه PM','PM schedules')}</button>}
      <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={()=>void inspect('/api/eqm/summary')}>{text('خلاصهٔ ناوگان','Fleet summary')}</button>{tab==='dispatch'&&<button className={button} disabled={busy} onClick={()=>void inspect('/api/eqp/dispatch/board')}>{text('تابلوی امروز','Today’s dispatch board')}</button>}{tab==='maintenance'&&<button className={button} disabled={busy} onClick={()=>void inspect('/api/eqp/pm/due')}>{text('سررسید PM','PM due')}</button>}{tab==='parts'&&<button className={button} disabled={busy} onClick={()=>void inspect('/api/eqp/parts/reorder')}>{text('پیشنهاد سفارش','Reorder suggestions')}</button>}{tab==='productivity'&&<button className={button} disabled={busy} onClick={()=>void inspect('/api/eqp/kpi')}>{text('شاخص‌های سرور','Server KPIs')}</button>}</div>
      {metrics&&<section className="glass-dark rounded-xl p-3 text-xs tx2"><DataView value={metrics}/></section>}
      {tab==='productivity'?<section className="space-y-2"><select className={input} aria-label="Report equipment" value={reportEquipment} onChange={e=>setReportEquipment(e.target.value)}><option value="">{text('ماشین برای کارت شناسنامه','Equipment for ID card')}</option>{data.rows.Equipment.map(e=><option key={e.Id} value={e.Id}>{String(e.Code)} — {String(e.NameFa)}</option>)}</select>{EQP_REPORT_CATALOG.map(r=><div className="glass-dark rounded-xl p-3 flex items-center justify-between tx2 text-sm" key={r.code}><span>{fa?r.title.fa:r.title.en}</span><button className={button} disabled={busy} onClick={()=>void download(r.code)}>CSV</button></div>)}<p className="tx3 text-xs">{text('خروجی از مسیر گزارش موجود سرور می‌آید. TCO و خروجی واقعی تولید از دادهٔ کافی تغذیه نشده‌اند؛ نتیجهٔ نمایشی جایگزین نمی‌شود.','Reports use the existing server. TCO and actual production need sufficient inputs; demo results are not substituted.')}</p></section>:<>
      {!data.rows[table]?.length&&<p className="tx3 p-3 text-sm">{text('هنوز رکوردی ثبت نشده است.','No records yet.')}</p>}
      <section className="space-y-2">{data.rows[table]?.map(row=><article key={row.Id} className="glass-dark rounded-xl p-3 flex flex-wrap gap-3 items-center tx2 text-xs"><strong>{String(row.Code??row.PartNo??row.ReadAt??row.LogDate??row.DispatchDate??row.ContractNo??row.Id)} · {String(row.NameFa??row.TitleFa??equipmentName(row.EquipmentId)??'')}</strong><span>{String(row.Status??'')} · v{row.RowVersion}</span><button className={button} onClick={()=>{setSelected(row);setForm({...row});}}>{text('جزئیات / ویرایش','Details / edit')}</button>{table==='Equipment'&&<button className={button} disabled={busy} onClick={()=>void inspect(`/api/eqm/equipment/${row.Id}/kpi`)}>KPI</button>}</article>)}</section>
      {(canManage||selected)&&<form className="glass-dark rounded-xl p-4 space-y-3" onSubmit={e=>{e.preventDefault();void save(`/rows/${table}${selected?'/'+selected.Id:''}`,selected?'PATCH':'POST',form);}}><div className="flex gap-3 tx1 text-sm"><h4>{selected?text('ویرایش رکورد','Edit record'):text('ثبت رکورد','Create record')}</h4><button type="button" className={button} onClick={()=>{setSelected(null);setForm(initial(table,data.today));}}>{text('فرم جدید','New form')}</button></div><fieldset disabled={busy||!canManage||Boolean(locked)} className="grid grid-cols-1 md:grid-cols-2 gap-3">{columns.map(c=>{
        let choices=ENUMS[c.name];
        if(c.name==='Category'||c.name==='EquipmentCategory')choices=EQUIPMENT_CATEGORY_CATALOG.map(x=>x.code);
        if(c.name==='Status')choices=table==='Equipment'?['active','idle','repair','disposed']:table==='EquipmentRental'?['active','expired','terminated']:['open','in_progress','done','closed'];
        if(c.name==='Kind')choices=table==='EquipmentFuelLog'?['diesel','gasoline','oil','grease','tire','other']:['corrective','preventive','inspection','overhaul'];
        const label=fa?(LABELS[c.name]??c.name):c.name;
        const set=(v:unknown)=>setForm(f=>({...f,[c.name]:v}));
        return <label key={c.name} className="tx3 text-xs">{label}{c.nullable===false?' *':''}{c.kind==='bool'?<input className="mx-2" type="checkbox" checked={form[c.name]===true||form[c.name]===1} onChange={e=>set(e.target.checked)}/>:c.name==='EquipmentId'?<select aria-label={label} className={input} value={String(form[c.name]??'')} onChange={e=>set(e.target.value)}><option value="">—</option>{data.rows.Equipment.map(e=><option key={e.Id} value={e.Id}>{String(e.Code)} — {String(e.NameFa)}</option>)}</select>:choices?<select aria-label={label} className={input} value={String(form[c.name]??'')} onChange={e=>set(e.target.value)}><option value="">—</option>{choices.map(v=><option key={v}>{v}</option>)}</select>:<input aria-label={label} className={input} type={c.kind==='date'?'date':c.kind==='datetime'?'datetime-local':['decimal','int'].includes(c.kind)?'number':'text'} step="any" value={String(form[c.name]??'')} onChange={e=>set(e.target.value===''?null:['decimal','int'].includes(c.kind)?Number(e.target.value):c.kind==='datetime'?new Date(e.target.value).toISOString():e.target.value)}/>}</label>;
      })}<button className={button} type="submit">{text('ذخیره در سرور','Save to server')}</button></fieldset></form>}
      {selected&&table==='EquipmentDispatch'&&<section className="flex flex-wrap gap-2">{(DISPATCH_FLOW[String(selected.Status) as keyof typeof DISPATCH_FLOW]??[]).filter(s=>['approved','rejected'].includes(s)?canApprove:canManage).map(to=><button key={to} className={button} disabled={busy} onClick={()=>void save(`/dispatch/${selected.Id}/advance`,'POST',{to,RowVersion:selected.RowVersion})}>{to}</button>)}<p className="tx3 text-xs">{text('گواهی اپراتور، آماده‌به‌کاری، PM و ایمنی از دادهٔ سرور کنترل می‌شود.','Server verifies operator license, readiness, PM and safety.')}</p></section>}
      </>}
    </>}
  </div>;
}
function DataView({value}:{value:unknown}) {
  if(value===null||value===undefined)return <span>—</span>;
  if(typeof value!=='object')return <span>{String(value)}</span>;
  return <div className="space-y-2">{Object.entries(value).map(([key,v])=><div key={key} className="border-b b-line-soft pb-1"><strong className="me-2">{LABELS[key]??key}</strong>{v&&typeof v==='object'?<details><summary className="cursor-pointer">{Array.isArray(v)?`${v.length} records`:'…'}</summary><div className="ps-4"><DataView value={v}/></div></details>:<DataView value={v}/>}</div>)}</div>;
}
