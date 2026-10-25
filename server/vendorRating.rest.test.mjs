import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createRepository,JsonFileDriver} from './persistence/driver.mjs';
const PORT=4797, BASE=`http://127.0.0.1:${PORT}`, url='/api/cnt-rating/c1-p1';
let dir,files,child,r;
async function api(method,p,user='u-contracts',body){const res=await fetch(BASE+p,{method,headers:{'content-type':'application/json',...(user?{'x-user-id':user}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,...await res.json()};}
before(async()=>{
 dir=await mkdtemp(path.join(tmpdir(),'vendor-rating-'));files=await mkdtemp(path.join(tmpdir(),'vendor-rating-files-'));r=createRepository(new JsonFileDriver(dir));
 for(const [Id,ProjectId] of [['rating-contract','c1-p1'],['other-contract','c2-p1']]) await r.create('ContractMaster',{Id,ProjectId,Code:'RATING-C',TitleFa:'پیمان آزمون',ContractType:'unit_price',Party:'main',EmployerName:'آزمون',ContractorName:'طرف واقعی آزمون',SignDate:'2026-01-01',StartDate:'2026-01-01',DurationDays:100,InitialAmount:1000,CurrentAmount:1000,Currency:'IRR',CeilingPct:25,RetainagePct:10,AdjustmentEnabled:false,Status:'active'},'u-contracts');
 await r.create('PurchaseOrder',{Id:'rating-po',ProjectId:'c1-p1',PoNo:'PO-TEST',VendorName:'تأمین‌کننده واقعی آزمون',TitleFa:'خرید آزمون',IssuedAt:'2026-01-01',Status:'issued'},'u-contracts');
 child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(PORT),PERSIST_DRIVER:'json',DATA_DIR:dir,FILE_STORAGE_PATH:files},stdio:'ignore'});
 for(let i=0;i<100;i++){try{await fetch(BASE+'/api/health');return;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('rating API not ready');
});
after(async()=>{if(child&&child.exitCode===null){const exit=once(child,'exit');child.kill('SIGTERM');await exit;}if(dir)await rm(dir,{recursive:true,force:true});if(files)await rm(files,{recursive:true,force:true});});
const scores=n=>({hse:n,quality:n,time:n,price:n,docs:n,coop:n});
const evaluation=(PeriodDate='2026-01-01',n=50)=>({SourceKind:'contract',SourceId:'rating-contract',PeriodDate,Scores:scores(n),DocumentRef:'DOC-TEST'});
const create=async(body)=>{const out=await api('POST',url+'/evaluations','u-contracts',body);assert.equal(out.status,201,JSON.stringify(out));return out.data.item;};
const decide=(row,action='approve',user='u-pm',more={})=>api('POST',`${url}/evaluations/${row.Id}/decision`,user,{RowVersion:row.RowVersion,action,note:'تصمیم مستند',...more});
let first,second,action;
test('empty workspace, real scoped sources and RBAC / generic guards',async()=>{
 assert.equal((await api('GET',url,null)).status,401);
 assert.equal((await api('GET',url.replace('c1-p1','c9-p9'))).status,403);
 const ws=(await api('GET',url)).data;assert.equal(ws.sources.length,2);assert.deepEqual(ws.evaluations,[]);assert.deepEqual(ws.history,[]);
 assert.deepEqual(ws.permissions,{edit:true,approve:false});
 assert.equal((await api('POST',url+'/evaluations','u-planner',evaluation())).status,403);
 for(const table of ['VendorEvaluation','VendorImprovement']) for(const method of ['POST','PATCH','DELETE']) assert.equal((await api(method,`/api/data/${table}${method==='POST'?'':'/x'}`,'u-admin',{})).status,403);
});
test('server validates evidence, score fields, future dates, scope and spoofed computed fields',async()=>{
 for(const patch of [{DocumentRef:''},{Scores:scores(101)},{PeriodDate:'2026-02-30'},{PeriodDate:'2099-01-01'},{SourceId:'other-contract'},{SourceKind:'vendor'},{Weighted:100},{Status:'approved'},{PartyName:'forged'}]){
  const out=await api('POST',url+'/evaluations','u-contracts',{...evaluation(),...patch});assert([422,404].includes(out.status),JSON.stringify(out));
 }
});
test('create immutable submitted evaluation; duplicate period blocked and only approved data enters trend',async()=>{
 first=await create(evaluation());assert.equal(first.Weighted,50);assert.equal(first.Grade,'D');assert.equal(first.Status,'submitted');
 assert.equal((await api('POST',url+'/evaluations','u-contracts',evaluation())).status,409);
 assert.equal((await api('GET',url)).data.history.length,0);
 assert.equal((await decide(first,'approve','u-contracts')).status,403);
 assert.equal((await decide(first,'approve','u-pm',{note:''})).status,422);
 const collisions=await Promise.all([decide(first),decide(first)]);assert.deepEqual(collisions.map(x=>x.status).sort(),[200,409]);
 first=collisions.find(x=>x.status===200).data.item;
 assert.equal(first.Status,'approved');
 assert.equal((await decide(first)).status,409);
 assert.equal((await api('GET',url)).data.history[0].Trend,null);
});
test('chronological trend independent of insertion; real purchase order source',async()=>{
 second=await create(evaluation('2026-03-01',80));second=(await decide(second)).data.item;
 const middle=await create(evaluation('2026-02-01',60));await decide(middle);
 const po=await create({...evaluation('2026-01-01',90),SourceKind:'purchase_order',SourceId:'rating-po'});await decide(po);
 const h=(await api('GET',url)).data.history;assert.equal(h.find(e=>e.Id===second.Id).Trend,20);assert.equal(h.find(e=>e.Id===middle.Id).Trend,10);assert.equal(h.find(e=>e.Id===po.Id).Trend,null);assert.equal(h.filter(e=>e.Latest).length,2);
});
test('rejection excluded from history and actions; enforce approved reference and valid owner',async()=>{
 const pending=await create(evaluation('2026-04-01',20));
 const body={EvaluationId:pending.Id,Axis:'hse',TitleFa:'اقدام آزمون',OwnerId:'u-contracts',DueDate:'2026-05-01'};
 assert.equal((await api('POST',url+'/actions','u-contracts',body)).status,409);
 await decide(pending,'reject');assert(!(await api('GET',url)).data.history.some(e=>e.Id===pending.Id));
 for(const patch of [{OwnerId:'unknown'},{Axis:'invalid'},{DueDate:'2025-01-01'},{TitleFa:''},{Status:'verified'}]) assert.equal((await api('POST',url+'/actions','u-contracts',{...body,EvaluationId:first.Id,...patch})).status,422);
 const out=await api('POST',url+'/actions','u-contracts',{...body,EvaluationId:first.Id});assert.equal(out.status,201);action=out.data.item;
});
const transition=(a,user='u-contracts',evidence='مستند آزمون',version=action.RowVersion)=>api('POST',`${url}/actions/${action.Id}/transitions`,user,{RowVersion:version,action:a,evidence});
test('improvement start, completion proof, stale versions, independent verification and reopen',async()=>{
 assert.equal((await transition('verify','u-pm')).status,409);
 assert.equal((await transition('start','u-planner')).status,403);
 const old=action.RowVersion;action=(await transition('start')).data.item;
 assert.equal((await transition('complete','u-contracts','proof',old)).status,409);
 assert.equal((await transition('complete','u-contracts','')).status,422);
 action=(await transition('complete')).data.item;assert.equal(action.Status,'completed');assert.equal(action.CompletedBy,'u-contracts');
 assert.equal((await transition('verify')).status,403);
 action=(await transition('reopen','u-pm','نیازمند اصلاح')).data.item;assert.equal(action.Status,'in_progress');
 action=(await transition('complete')).data.item;action=(await transition('verify','u-pm')).data.item;assert.equal(action.Status,'verified');
 assert.equal((await transition('start')).status,409);
});
test('rejected evaluation can be corrected by its author without duplicate period or changing source',async()=>{
 let row=await create(evaluation('2026-05-01',30));row=(await decide(row,'reject')).data.item;
 const body={RowVersion:row.RowVersion,Scores:scores(75),DocumentRef:'DOC-CORRECTED'};
 assert.equal((await api('POST',`${url}/evaluations/${row.Id}/resubmit`,'u-planner',body)).status,403);
 assert.equal((await api('POST',`${url}/evaluations/${row.Id}/resubmit`,'u-contracts',{...body,SourceId:'rating-po'})).status,422);
 let out=await api('POST',`${url}/evaluations/${row.Id}/resubmit`,'u-contracts',body);assert.equal(out.status,200);row=out.data.item;assert.equal(row.Weighted,75);assert.equal(row.Status,'submitted');assert.equal(row.DecisionNote,null);
 assert.equal((await api('POST',`${url}/evaluations/${row.Id}/resubmit`,'u-contracts',body)).status,409);
 out=await decide(row);assert.equal(out.status,200);
 assert.equal((await api('GET',url)).data.history.find(e=>e.Id===row.Id).Grade,'B');
});
test('persistence and audit survive independent repository read, no financial effects',async()=>{
 const fresh=createRepository(new JsonFileDriver(dir));assert.equal((await fresh.get('VendorImprovement',action.Id)).Status,'verified');
 assert.equal((await fresh.get('ContractMaster','rating-contract')).CurrentAmount,1000);
 const audit=await fresh.list('AuditLog',{limit:200});assert(audit.some(e=>e.Action==='CNT_RATING_DECISION'));assert(audit.some(e=>e.Action==='CNT_IMPROVEMENT_TRANSITION'));
});
