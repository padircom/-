/** LIVE-6. Project-scoped, versioned aggregate records; no public raw writes. */
import { STRATEGY_MODEL, EXCELLENCE_MODEL, STRATEGY_FIELDS, EXCELLENCE_FIELDS, normalizeStrategy, normalizeExcellence, strategyMetrics, excellenceMetrics, WorkspaceValidationError } from './sxWsLogic.js';
const fault=(status,code,message)=>Object.assign(new Error(message),{status,code});
const queues=new Map();
async function serial(key,work){const next=(queues.get(key)??Promise.resolve()).catch(()=>{}).then(work);queues.set(key,next);try{return await next;}finally{if(queues.get(key)===next)queues.delete(key);}}
export const SX_POLICIES=[
  {path:'spm',resource:'plans',table:'StrategyPlan',view:'spm.plan.view',edit:'spm.plan.edit',version:STRATEGY_MODEL,fields:STRATEGY_FIELDS,normalize:normalizeStrategy,metrics:strategyMetrics},
  {path:'oex',resource:'assessments',table:'ExcellenceAssessment',view:'oex.assessment.view',edit:'oex.assessment.edit',version:EXCELLENCE_MODEL,fields:EXCELLENCE_FIELDS,normalize:normalizeExcellence,metrics:excellenceMetrics},
];
export function registerStrategyExcellenceRoutes(app,{repo,subjects,evaluate}) {
  for(const policy of SX_POLICIES){
    const base=`/api/${policy.path}/:projectId`;
    const where=req=>[{column:'ProjectId',op:'eq',value:req.params.projectId}];
    const can=(req,p)=>evaluate(req.sxSubject,p,{projectId:req.params.projectId}).allow;
    const editable=row=>Object.fromEntries(policy.fields.map(k=>[k,row[k]]));
    const decorate=row=>{
      if(row.ModelVersion!==policy.version)throw fault(409,'SX_MODEL_VERSION','نسخهٔ مدل رکورد پشتیبانی نمی‌شود؛ مهاجرت داده لازم است');
      let data;try{data=policy.normalize(editable(row));}catch{throw fault(409,'SX_STORED_INVALID','رکورد ذخیره‌شده با مدل سازگار نیست؛ از تولید امتیاز نامعتبر جلوگیری شد');}
      return {...row,...data,metrics:policy.metrics(data)};
    };
    const route=(write,handler,status=200)=>async(req,res,next)=>{
      try{
        if(!/^[A-Za-z0-9_-]{1,50}$/.test(req.params.projectId))throw fault(400,'SX_PROJECT','شناسهٔ پروژه نامعتبر است');
        req.sxSubject=subjects.find(s=>s.id===String(req.headers['x-user-id']||'').trim()&&s.active);
        if(!req.sxSubject)throw fault(401,'SX_AUTH','هویت معتبر لازم است');
        if(!can(req,policy.view)||(write&&!can(req,policy.edit)))throw fault(403,'SX_FORBIDDEN','مجوز این اقدام یا دسترسی به پروژه را ندارید');
        const data=await serial(`${policy.path}:${req.params.projectId}`,async()=>handler(await repo(),req));
        res.set('Cache-Control','no-store').status(status).json({ok:true,data,meta:{traceId:req.requestId}});
      }catch(err){
        if(err instanceof WorkspaceValidationError){err.status=400;err.code='SX_VALIDATION';}
        if(['DUPLICATE_KEY','UNIQUE_VIOLATION'].includes(err.code))err=fault(409,'SX_DUPLICATE','کد در همین پروژه تکراری است');
        if(err.status)return res.status(err.status).json({ok:false,error:{code:err.code,message:err.message,traceId:req.requestId}});
        next(err);
      }
    };
    const body=(req,old)=>{
      const b=req.body;
      if(!b||typeof b!=='object'||Array.isArray(b))throw fault(400,'SX_BODY','بدنهٔ رکورد لازم است');
      if(Buffer.byteLength(JSON.stringify(b),'utf8')>1000000)throw fault(413,'SX_SIZE','رکورد بیش از یک مگابایت است');
      const allowed=[...policy.fields,...(old?['RowVersion']:[])];
      const invalid=Object.keys(b).find(k=>!allowed.includes(k));
      if(invalid)throw fault(400,'SX_FIELD',`فیلد قابل نوشتن نیست: ${invalid}`);
      if(old&&(!Number.isInteger(b.RowVersion)||b.RowVersion!==old.RowVersion))throw fault(409,'SX_VERSION','نسخه تغییر کرده است؛ نسخهٔ جدید را بازخوانی و تغییرات را مقایسه کنید');
      const incoming={...b};delete incoming.RowVersion;
      const data=policy.normalize({...(old?editable(old):{}),...incoming});
      if(old&&data.Code!==old.Code)throw fault(409,'SX_CODE_IMMUTABLE','کد رکورد ذخیره‌شده قابل تغییر نیست');
      if(data.DataDate>new Date().toISOString().slice(0,10))throw fault(400,'SX_FUTURE_DATE','تاریخ اظهار داده نباید در آینده باشد');
      return data;
    };
    const capacity=async(r,req,data,old)=>{
      const rows=await r.list(policy.table,{where:where(req),limit:101});
      const proposed=[...rows.filter(row=>row.Id!==old?.Id),{...old,...data}];
      // Reject additions before they would make the bounded workspace unreadable.
      if(proposed.length>100||Buffer.byteLength(JSON.stringify(proposed),'utf8')>3900000)throw fault(409,'SX_CAPACITY','سقف این نما: ۱۰۰ رکورد و حدود ۴ مگابایت در هر پروژه/حوزه؛ ثبت انجام نشد');
    };
    const audit=async(r,req,row,action)=>{
      try{await r.create('AuditLog',{At:new Date().toISOString(),SubjectId:req.sxSubject.id,Action:`${policy.path.toUpperCase()}_${action}`,ProjectCode:req.params.projectId,EntityName:policy.table,EntityId:row.Id,Severity:'info',Details:{code:row.Code,rowVersion:row.RowVersion,modelVersion:row.ModelVersion,traceId:req.requestId}},req.sxSubject.id);}
      catch{throw fault(503,'SX_AUDIT_FAILED','ثبت ممیزی کامل نشد؛ رکورد ممکن است ذخیره شده باشد. پیش از تلاش مجدد بازخوانی کنید');}
    };
    app.get(base+'/workspace',route(false,async(r,req)=>{
      const rows=await r.list(policy.table,{where:where(req),orderBy:[{column:'DataDate',dir:'desc'},{column:'Code',dir:'asc'}],limit:101});
      if(rows.length>100||Buffer.byteLength(JSON.stringify(rows),'utf8')>4000000)throw fault(409,'SX_LIST_LIMIT','حجم فهرست از سقف این نما بیشتر است؛ گزارش ناقص نمایش داده نمی‌شود');
      return {projectId:req.params.projectId,canEdit:can(req,policy.edit),records:rows.map(decorate),generatedAt:new Date().toISOString(),modelVersion:policy.version};
    }));
    app.post(base+'/'+policy.resource,route(true,async(r,req)=>{
      const data=body(req);
      await capacity(r,req,data);
      const row=await r.create(policy.table,{...data,ProjectId:req.params.projectId,ModelVersion:policy.version},req.sxSubject.id,policy.path);
      await audit(r,req,row,'CREATE');return decorate(row);
    },201));
    app.patch(base+'/'+policy.resource+'/:id',route(true,async(r,req)=>{
      const row=await r.findOne(policy.table,[...where(req),{column:'Id',op:'eq',value:req.params.id}]);
      if(!row)throw fault(404,'SX_NOT_FOUND','رکورد در این پروژه یافت نشد');
      decorate(row); // Never silently reinterpret a saved model version.
      const data=body(req,row);
      await capacity(r,req,data,row);
      const result=await r.patch(policy.table,row.Id,data,req.sxSubject.id,row.RowVersion);
      if(!result.ok)throw fault(409,'SX_VERSION','نسخه هم‌زمان تغییر کرده است؛ بازخوانی کنید');
      const saved=await r.get(policy.table,row.Id);await audit(r,req,saved,'UPDATE');return decorate(saved);
    }));
  }
}
