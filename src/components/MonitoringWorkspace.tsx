import { useEffect, useRef, useState } from 'react';
import { type Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import { jsonRequest } from '../services/apiClient';
import { type MonitoringData, type MonitoringItem, type SourceState } from '../services/monitoringWorkspace';
import ReportBuilderPanel from './ReportBuilderPanel';
import DrillDownPanel from './DrillDownPanel';

export type MonitorTab = 'dash' | 'wpd' | 'evm' | 'kpi' | 'phi' | 'var' | 'ews' | 'action' | 'forecast' | 'reports' | 'builder' | 'drill' | 'scurve' | 'exec';
type Props = { lang: Lang; projectId: string; initialTab?: MonitorTab; subId?: string; hideTabs?: boolean };
const TABS: [MonitorTab, string, string][] = [['dash','داشبورد','Dashboard'],['wpd','منابع داده','Data sources'],['evm','ارزش کسب‌شده','EVM'],['kpi','شاخص‌ها','KPIs'],['phi','سلامت PHI','PHI'],['var','انحراف','Variance'],['ews','هشدار','Alerts'],['action','پیش‌نگر / مصوبات','Lookahead / actions'],['forecast','پیش‌بینی ثبت‌شده','Stored forecast'],['scurve','روند تصاویر','Snapshot trend'],['reports','خروجی داخلی','Internal export'],['builder','گزارش‌ساز سفارشی','Custom report builder'],['drill','پیمایش سلسله‌مراتبی','Drill-down'],['exec','خلاصهٔ مدیریتی','Executive summary']];
const SUB: Record<string,MonitorTab> = { 'd3-p1-s1':'kpi','d3-p1-phi':'phi','d3-p2-s1':'evm','d3-p2-wpd':'wpd','d3-p2-fc':'forecast','d3-p3-s1':'var','d3-p4-s1':'ews','d3-p4-ews':'ews','d3-p5-s1':'action','d3-p6-s1':'dash','d3-p6-14':'reports','d3-p6-builder':'builder','d3-p6-drill':'drill','d3-p6-exec':'exec','d3-p6-dash':'dash' };
const SOURCE_LABELS: Record<string,[string,string]> = { Activity:['برنامهٔ فعالیت‌ها','Activities'],ProgressEntry:['پیشرفت تأییدشده','Approved progress'],EvmSnapshot:['تصویر ارزش کسب‌شده','EVM snapshot'],Risk:['ریسک بازِ بالا','High open risks'],ChangeRequest:['تغییر در انتظار تصمیم','Pending changes'],Claim:['ادعای پیش‌نویس','Draft claims'],Document:['مدرک پیش‌نویس / در بازبینی','Draft / under-review documents'],Ncr:['عدم انطباق بسته‌نشده','Unclosed NCRs'],Equipment:['ماشین در تعمیر','Equipment in repair'],MaintenanceOrder:['تعمیرات باز','Open maintenance orders'],Correspondence:['مکاتبات معوق','Overdue correspondence'],MeetingAction:['مصوبات معوق','Overdue meeting actions'] };
const STATES: Record<SourceState|string,[string,string]> = { unverified:['تصویر فاقد ورودی یا مهر سازگاری','Snapshot lacks inputs or integrity stamp'],ready:['دادهٔ موجود','Available'],empty:['بدون داده','No data'],restricted:['بدون مجوز','Restricted'],unavailable:['منبع در دسترس نیست','Source unavailable'],too_large:['بیش از سقف پردازش؛ عدد کامل نمایش داده نمی‌شود','Over processing limit; no partial total'],invalid:['دادهٔ نامعتبر','Invalid data'] };
export default function MonitoringWorkspace(props: Props) {
  const { user } = useAuth();
  return <LiveMonitoring key={`${props.projectId}:${user?.id ?? ''}`} {...props} userId={user?.id ?? null} />;
}
function LiveMonitoring({lang,projectId,initialTab,subId,hideTabs,userId}:Props & {userId:string|null}) {
  const fa=lang==='fa'; const text=(a:string,b:string)=>fa?a:b;
  const [tab,setTab]=useState<MonitorTab>(initialTab??SUB[subId??'']??'dash');
  const [horizon,setHorizon]=useState(30);
  const [auto,setAuto]=useState(false);
  const [revision,setRevision]=useState(0);
  const [data,setData]=useState<MonitoringData|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [receivedHorizon,setReceivedHorizon]=useState<number|null>(null);
  const generation=useRef(0);
  useEffect(()=>setTab(initialTab??SUB[subId??'']??'dash'),[initialTab,subId]);
  useEffect(()=>{
    let cancelled=false; let timer:ReturnType<typeof setTimeout>|undefined;
    const seq=++generation.current;
    setData(null);setReceivedHorizon(null);setError('');
    async function refresh() {
      if(cancelled)return;
      setLoading(true);
      const result=await jsonRequest<MonitoringData>(`/api/monitoring/${encodeURIComponent(projectId)}/workspace?horizonDays=${horizon}`,userId,'GET');
      if(cancelled||seq!==generation.current)return;
      setLoading(false);
      if(result.ok){setData(result.data);setReceivedHorizon(horizon);setError('');}
      else{setData(null);setReceivedHorizon(null);setError(result.message);}
      // Real, serialized polling. It never changes a KPI locally or overlaps requests.
      if(auto)timer=setTimeout(()=>void refresh(),30000);
    }
    void refresh();
    return()=>{cancelled=true;generation.current++;if(timer)clearTimeout(timer);};
  },[projectId,userId,horizon,auto,revision]);
  const current=receivedHorizon===horizon?data:null;
  const fmt=(n:number|null|undefined)=>n===null||n===undefined?'—':n.toLocaleString(fa?'fa-IR':'en-US',{maximumFractionDigits:3});
  const state=(s:string)=>{const label=STATES[s];return label?text(...label):s;};
  const sourceName=(s:string)=>SOURCE_LABELS[s]?text(...SOURCE_LABELS[s]):s;
  const button='rounded-lg border b-line-soft px-3 py-2 text-xs tx1 disabled:opacity-40';
  const p=current?.evm.latest;
  const showEvm=['dash','evm','var','forecast','exec'].includes(tab);
  const showSummary=['dash','kpi','exec'].includes(tab);
  const exportData=()=>{
    if(!current)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`monitoring-${projectId}-${current.today}.json`;a.click();URL.revokeObjectURL(url);
  };
  return <div dir={fa?'rtl':'ltr'} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
    <header className="glass-dark rounded-xl p-3 flex flex-wrap items-center gap-3">
      <div className="flex-1"><h3 className="tx1 font-semibold">{text('پایش و کنترل — دادهٔ واقعی پروژه','Monitoring — persisted project data')}</h3><p className="text-xs tx3" dir="ltr">{projectId}</p></div>
      <button className={button} disabled={loading} onClick={()=>setRevision(v=>v+1)}>{text('تازه‌سازی','Refresh')}</button>
      <label className="text-xs tx2"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/> {text('بازخوانی واقعی هر ۳۰ ثانیه','Fetch every 30 seconds')}</label>
      <label className="text-xs tx3">{text('افق پیش‌نگر (روز)','Lookahead (days)')} <select className="bg-[var(--row)] tx1 rounded-lg border b-line-soft p-2" value={horizon} onChange={e=>setHorizon(Number(e.target.value))}>{[30,60,90].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    </header>
    {!hideTabs&&<nav className="flex flex-wrap gap-2">{TABS.map(([id,a,b])=><button key={id} className={`${button} ${tab===id?'toggle-on':''}`} onClick={()=>setTab(id)}>{text(a,b)}</button>)}</nav>}
    {error&&<p role="alert" className="rounded-xl p-3 bg-rose-500/10 text-rose-400 text-sm">{error} — {text('دادهٔ قبلی به‌عنوان دادهٔ زنده نمایش داده نمی‌شود.','Old data is not shown as live data.')}</p>}
    {loading&&<p role="status" className="tx3 text-xs">{text('در حال دریافت از سرور…','Fetching from server…')}</p>}
    {/* P9: گزارش‌ساز سفارشی و پیمایش سلسله‌مراتبی مستقل از تصویر EVM‌اند؛
      * نبود دادهٔ پایش، این دو را از کار نمی‌اندازد. */}
    {tab==='builder'&&<ReportBuilderPanel lang={lang}/>}
    {tab==='drill'&&<DrillDownPanel lang={lang}/>}
    {current&&<>
      <section className="glass-dark rounded-xl p-3 text-xs tx3 space-y-1">
        <p>{text('زمان بازخوانی سرور: ','Server read time: ')}<time dir="ltr">{current.generatedAt}</time></p>
        <p>{text('این نما فقط‌خواندنی است. شاخص‌های جاری حوزه‌ها لزوماً هم‌تاریخ با تصویر EVM نیستند؛ بازخوانی، تاریخ داده را جلو نمی‌برد.','Read-only. Domain counts and the EVM snapshot can have different data dates; refresh does not advance the source data date.')}</p>
        <p>{text('ارقام فقط محدودهٔ مجاز شما را پوشش می‌دهند؛ نبود مجوز با صفر برابر نیست.','Figures cover only your authorized scope; restricted is not zero.')}</p>
      </section>
      {showEvm&&<section className="glass-dark rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap gap-3 text-xs tx2"><h4>EVM · {state(current.evm.state)}</h4><span>{text('تاریخ داده: ','Data date: ')}{p?.dataDate??'—'}</span><span dir="ltr">{p?.formulaVersion??'—'} · {p?.id??'—'}</span></div>
        <p className="text-xs tx3">{text('سازگاری تصویر: ','Snapshot integrity: ')}{p?.integrity??'—'} · {text('ردیف بی‌تاریخ / آینده کنارگذاشته‌شده: ','Undated / future rows excluded: ')}{fmt(current.evm.excludedUndatedOrFuture)}</p>
        {p?.stale&&<p className="text-amber-400 text-xs">{text('این تصویر بیش از ۳۰ روز قدمت دارد.','This snapshot is over 30 days old.')}</p>}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{(tab==='forecast'?['eac','etc','vac']:tab==='var'?['spi','cpi','sv','cv']:['pv','ev','ac','bac','spi','cpi','sv','cv']).map(k=><div key={k} className="rounded-lg border b-line-soft p-3"><div className="text-xs tx3">{k.toUpperCase()}</div><div className="text-xl tx1 tabular-nums" dir="ltr">{fmt(p?.[k as 'pv'])}</div></div>)}</div>
        <p className="text-xs tx3">{text('منبع: EvmSnapshot؛ SPI=EV/PV و CPI=EV/AC. مخرج صفر یا دادهٔ ناقص → نامعلوم. مبالغ در واحد منبع‌اند؛ هیچ تبدیل ارز یا جمع دوباره با هزینهٔ جاری انجام نشده است.','Source: EvmSnapshot; SPI=EV/PV and CPI=EV/AC. Zero denominators or missing data → unknown. Amounts retain source units; no FX conversion or double counting with current costs.')}</p>
        {tab==='forecast'&&<p className="text-xs tx3">{text('EAC فقط مقدار ثبت‌شده است؛ ETC=EAC−AC و VAC=BAC−EAC. مدل پیش‌بینی تازه ساخته نمی‌شود.','EAC is the stored forecast only; ETC=EAC−AC and VAC=BAC−EAC. No new forecast model is fabricated.')}</p>}
      </section>}
      {showSummary&&<section className="grid grid-cols-2 xl:grid-cols-4 gap-3">{current.summaries.map(k=><article key={k.table} className="glass-dark rounded-xl p-3"><h4 className="text-xs tx2">{fa?k.label:sourceName(k.table)}</h4><p className="text-2xl tx1 mt-2">{fmt(k.value)}</p><p className="text-[10px] tx3 mt-2">{k.table} · {state(k.state)}</p></article>)}</section>}
      <details open={tab==='wpd'} className="glass-dark rounded-xl p-3 overflow-x-auto"><summary className="tx1 text-sm mb-2 cursor-pointer">{text('منشأ و پوشش داده — وضعیت هر منبع','Data provenance and coverage — per-source status')}</summary><table className="w-full text-xs text-start tx2"><thead><tr>{[text('منبع','Source'),text('وضعیت','State'),text('تعداد رکورد مجاز','Visible rows'),text('آخرین ثبت / ویرایش','Latest write')].map(v=><th key={v} className="p-2 text-start">{v}</th>)}</tr></thead><tbody>{current.sources.map(s=><tr key={s.table} className="border-t b-line-soft"><td className="p-2">{s.table}</td><td>{state(s.state)}</td><td>{fmt(s.rowCount)}</td><td dir="ltr">{s.lastUpdatedAt??'—'}</td></tr>)}</tbody></table></details>
      {['dash','ews','exec'].includes(tab)&&<section className="glass-dark rounded-xl p-3 space-y-2"><h4 className="text-sm tx1">{text('هشدارهای محاسبه‌شده از منابع مجاز','Rules evaluated from authorized sources')}</h4>{current.alerts.map(a=><div key={a.code} className="border b-line-soft rounded-lg p-2 text-xs text-amber-300"><strong>{fa?a.message:a.code}</strong> · {fmt(a.count)} <span className="tx3">{a.table}</span></div>)}{!current.alerts.length&&<p className="tx3 text-xs">{text('در داده‌های قابل مشاهده، قاعده‌ای فعال نشده؛ این به معنی سالم‌بودن منابع نامعلوم نیست.','No rule triggered in visible data; unknown sources are not certified healthy.')}</p>}<p className="tx3 text-xs">{text('هشدارها ثبت ACK یا قفل انتشار گزارش ایجاد نمی‌کنند. آستانه‌های EVM: SPI<۰٫۹۵ و CPI<۱.','Alerts do not create acknowledgements or report-release locks. EVM thresholds: SPI<0.95 and CPI<1.')}</p></section>}
      {['dash','action'].includes(tab)&&<section className="space-y-3"><Items title={text('فعالیت‌های همپوشان افق + معوقات برنامه','Activities overlapping the horizon + overdue work')} items={current.lookahead} lang={lang}/><Items title={text('مصوبات باز جلسه تا انتهای افق','Open meeting actions due within the horizon')} items={current.actions} lang={lang}/><p className="tx3 text-xs">{text('درصد پیشرفت فقط از آخرین ProgressEntry پذیرفته‌شده و امضاشده است؛ پیشرفت خام Activity به EV تبدیل نمی‌شود. تغییر یا بستن مصوبه در حوزهٔ مبدأ انجام می‌شود.','Progress is the latest accepted, signed ProgressEntry; raw Activity progress is not turned into EV. Edit/close actions in their source workspace.')}</p></section>}
      {tab==='phi'&&<section className="glass-dark rounded-xl p-4 tx2 text-sm">PHI: —<p className="mt-2">{text(current.phi.reason,'No calibrated health model with approved, synchronized inputs is stored. No synthetic composite score is shown.')}</p></section>}
      {tab==='scurve'&&<SnapshotTrend data={current} lang={lang}/>}
      {tab==='reports'&&<section className="glass-dark rounded-xl p-4 space-y-3 tx2 text-sm"><p>{text('خروجی JSON همین دادهٔ مجاز، همراه منشأ و زمان بازخوانی است؛ گزارش رسمی، قالب Excel یا مجوز انتشار قراردادی نیست.','JSON exports this authorized projection with provenance and read time. It is not an official report, Excel template, or contractual release.')}</p><button className={button} onClick={exportData}>{text('دریافت گزارش داخلی JSON','Download internal JSON')}</button></section>}
    </>}
  </div>;
}
function Items({title,items,lang}:{title:string;items:MonitoringItem[];lang:Lang}) {
  return <section className="glass-dark rounded-xl p-3 space-y-2"><h4 className="text-sm tx1">{title}</h4>{!items.length&&<p className="tx3 text-xs">{lang==='fa'?'مورد قابل مشاهده‌ای در این افق نیست؛ وضعیت منبع را در جدول پوشش بررسی کنید.':'No visible items in this horizon; check source coverage.'}</p>}{items.map(i=><article key={`${i.table}:${i.id}`} className="rounded-lg border b-line-soft p-2 flex flex-wrap gap-3 text-xs tx2"><strong>{i.code} — {i.title}</strong><span dir="ltr">{i.dueDate??'—'}</span><span className={i.status==='overdue'||i.critical?'text-amber-300':''}>{i.status}{i.critical?' · !':''}</span>{i.table==='Activity'&&<span>{lang==='fa'?'پیشرفت مصوب: ':'Approved: '}{i.approvedPct===null?'—':`${i.approvedPct}%`}</span>}<small className="tx3" dir="ltr">{i.table} · {i.id}</small></article>)}</section>;
}
function SnapshotTrend({data,lang}:{data:MonitoringData;lang:Lang}) {
  const points=data.evm.history.slice(-60);
  const values=points.flatMap(p=>[p.pv,p.ev,p.ac]).filter((v):v is number=>v!==null);
  const max=Math.max(1,...values);
  const first=Date.parse(points[0]?.dataDate??data.today), last=Date.parse(points[points.length-1]?.dataDate??data.today);
  const x=(p:typeof points[number])=>30+((Date.parse(p.dataDate??data.today)-first)/Math.max(86400000,last-first))*620;
  const y=(n:number)=>185-(n/max)*160;
  const colours={pv:'#7fb2ff',ev:'#34d399',ac:'#fbbf24'};
  return <section className="glass-dark rounded-xl p-3 space-y-3"><h4 className="text-sm tx1">{lang==='fa'?'روند حداکثر ۶۰ تصویر آخر؛ نه منحنی برنامهٔ ساخته‌شده':'Up to 60 latest snapshots; not an invented planned curve'}</h4>{!points.length?<p className="tx3 text-xs">{lang==='fa'?'تصویر قابل مشاهده‌ای وجود ندارد.':'No visible snapshots.'}</p>:<><svg viewBox="0 0 680 210" className="w-full max-h-64" role="img" aria-label="PV EV AC snapshot trend"><path d="M30 20 V185 H650" stroke="currentColor" fill="none" opacity=".3"/>{(['pv','ev','ac'] as const).map(key=><g key={key}>{points.map((p,i)=>{const value=p[key],prev=points[i-1];return value===null?null:<g key={p.id}><circle cx={x(p)} cy={y(value)} r="3" fill={colours[key]}/>{prev&&prev.formulaVersion===p.formulaVersion&&prev[key]!==null&&<line x1={x(prev)} y1={y(prev[key]!)} x2={x(p)} y2={y(value)} stroke={colours[key]}/>}</g>;})}</g>)}</svg><div className="flex gap-4 text-xs">{Object.entries(colours).map(([k,v])=><span key={k} style={{color:v}}>{k.toUpperCase()}</span>)}</div><div className="overflow-x-auto"><table className="w-full text-xs tx2"><thead><tr><th>DataDate</th><th>PV</th><th>EV</th><th>AC</th><th>Status</th></tr></thead><tbody>{points.map(p=><tr key={p.id}><td>{p.dataDate}</td><td>{p.pv??'—'}</td><td>{p.ev??'—'}</td><td>{p.ac??'—'}</td><td>{p.state}</td></tr>)}</tbody></table></div></>}</section>;
}
