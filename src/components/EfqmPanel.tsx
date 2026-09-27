import { type Lang } from '../data/framework';
import { useAuth } from '../context/AuthContext';
import PersistentBusinessWorkspace, { BusinessField as Field } from './PersistentBusinessWorkspace';
import { EFQM_CRITERIA, emptyCriterion, type ExcellenceInput, type excellenceMetrics } from '../services/strategyExcellenceWorkspace';
export default function EfqmPanel({lang,projectId}:{lang:Lang;projectId:string}) {
  const {user}=useAuth(),fa=lang==='fa',t=(a:string,b:string)=>fa?a:b;
  const fmt=(v:number|null)=>v===null?'—':v.toLocaleString(fa?'fa-IR':'en-US',{maximumFractionDigits:2});
  return <PersistentBusinessWorkspace<ExcellenceInput,ReturnType<typeof excellenceMetrics>> key={`${projectId}:${user?.id}`} lang={lang} projectId={projectId} userId={user?.id??null} path="oex" resource="assessments"
    title={t('تعالی — خودارزیابی داخلی ذخیره‌شده','Excellence — persisted internal self-assessment')}
    notice={t('مدل داخلی نه‌معیاره با دو بُعد ساده‌شده برای هر معیار؛ EFQM 2020 یا ارزیابی کامل RADAR نیست. امتیاز خوداظهاری، گواهی یا رتبهٔ رسمی تعالی محسوب نمی‌شود. مجموع فقط با تکمیل هر ۹ معیار و مرجع شاهد نمایش داده می‌شود.','Internal nine-criterion model with two simplified axes per criterion; not EFQM 2020 or full RADAR. Self-declared scores are not certification or an official excellence rating. A total requires all nine criteria and evidence references.')}
    newValue={()=>({Code:'',TitleFa:'',DataDate:new Date().toISOString().slice(0,10),Scores:Object.fromEntries(EFQM_CRITERIA.map(c=>[c.code,emptyCriterion()])),Notes:''})}
    editor={(v,set)=><div className="space-y-3">
      <p className="text-xs tx3">{t('خالی = ارزیابی نشده؛ صفر = امتیاز واقعی صفر. مرجع شاهد متنی است و بارگذاری یا تأیید اصالت سند نیست.','Blank = not assessed; zero = an actual zero score. Evidence is a textual reference, not a document upload or authenticity check.')}</p>
      {EFQM_CRITERIA.map(c=>{
        const s=v.Scores[c.code]??emptyCriterion();
        const change=(patch:Partial<typeof s>)=>set({...v,Scores:{...v.Scores,[c.code]:{...s,...patch}}});
        return <section key={c.code} className="border b-line-soft rounded-xl p-3 space-y-2"><h4 className="text-sm tx1">{c.code} · {c.label[lang]} · {t('وزن','Weight')} {c.weight}</h4>
          <div className="grid sm:grid-cols-2 gap-3"><Field type="number" optional min={0} max={100} label={c.kind==='enabler'?t('رویکرد (۰–۱۰۰)','Approach (0–100)'):t('ربط و کاربرد (۰–۱۰۰)','Relevance and usability (0–100)')} value={s.a} onChange={x=>change({a:x===''?null:Number(x)})}/><Field type="number" optional min={0} max={100} label={c.kind==='enabler'?t('استقرار (۰–۱۰۰)','Deployment (0–100)'):t('عملکرد (۰–۱۰۰)','Performance (0–100)')} value={s.b} onChange={x=>change({b:x===''?null:Number(x)})}/></div>
          <Field type="textarea" optional label={t('مرجع شاهد — لازم برای مجموع کامل','Evidence reference — required for a complete total')} value={s.evidence} onChange={x=>change({evidence:x})}/>
          <div className="grid sm:grid-cols-2 gap-3"><Field type="textarea" optional label={t('نقاط قوت','Strengths')} value={s.strengths} onChange={x=>change({strengths:x})}/><Field type="textarea" optional label={t('فرصت‌های بهبود','Improvement opportunities')} value={s.improvements} onChange={x=>change({improvements:x})}/></div>
        </section>;
      })}
      <Field type="textarea" optional label={t('یادداشت ارزیاب','Assessor notes')} value={v.Notes} onChange={Notes=>set({...v,Notes})}/>
    </div>}
    result={row=><>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{[[t('مجموع / ۱۰۰۰','Total / 1000'),fmt(row.metrics.total)],[t('توانمندسازها / ۵۰۰','Enablers / 500'),fmt(row.metrics.enablers)],[t('نتایج / ۵۰۰','Results / 500'),fmt(row.metrics.results)],[t('معیار امتیازدار / دارای شاهد','Scored / evidenced criteria'),`${row.metrics.scored}/9 · ${row.metrics.evidenced}/9`]].map(([label,value])=><article key={label} className="rounded-lg border b-line-soft p-3"><p className="text-xs tx3">{label}</p><p className="text-xl tx1">{value}</p></article>)}</div>
      <p className="text-xs tx3">{row.metrics.complete?t('خودارزیابی از نظر تکمیل فیلدها کامل است؛ این تأیید مستقل یا گواهی نیست.','All required fields are complete; this is not independent approval or certification.'):t('خودارزیابی ناقص است؛ معیارهای خالی یا بدون شاهد با صفر جایگزین نشده‌اند.','Incomplete self-assessment; missing axes or evidence have not been replaced with zero.')}</p>
      <p className="text-xs tx3">{t('امتیاز معیار = گردکردنِ میانگین دو بُعد × وزن ÷ ۱۰۰.','Criterion points = rounded mean of the two axes × weight ÷ 100.')}</p>
      {row.metrics.lines.map(line=>{const c=EFQM_CRITERIA.find(c=>c.code===line.code)!;const s=row.Scores[line.code];return <article key={line.code} className="rounded-xl border b-line-soft p-3 text-xs tx2 space-y-2"><h4 className="text-sm tx1">{line.code} · {c.label[lang]} — {fmt(line.points)} / {line.weight}</h4><p>{t('دو بُعد: ','Axes: ')}{fmt(s.a)} / {fmt(s.b)} · {line.hasEvidence?t('مرجع شاهد ثبت شده','Evidence reference entered'):t('فاقد مرجع شاهد','No evidence reference')}</p><p className="whitespace-pre-wrap">{t('شاهد: ','Evidence: ')}{s.evidence||'—'}</p><p className="whitespace-pre-wrap">{t('نقاط قوت: ','Strengths: ')}{s.strengths||'—'}</p><p className="whitespace-pre-wrap">{t('فرصت بهبود: ','Improvements: ')}{s.improvements||'—'}</p></article>;})}
      <p className="whitespace-pre-wrap text-xs tx3">{row.Notes}</p>
    </>}/>;
}
