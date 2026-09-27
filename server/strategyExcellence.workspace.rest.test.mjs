import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRepository,JsonFileDriver} from './persistence/driver.mjs';
import {lockRuntimeTests} from './runtimeTestLock.mjs';
import {strategyInput,excellenceInput} from './sxTestFixtures.mjs';
const DIR='./server/rundata',PID=`sx-test-${Date.now()}`,BASE='http://127.0.0.1:4801';
const fixtures=()=>createRepository(new JsonFileDriver(DIR));
let child,release,plan,assessment,logs='';
async function start(){
  child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'4801',PERSIST_DRIVER:'json',DATA_DIR:DIR},stdio:['ignore','pipe','pipe']});
  child.stderr.on('data',d=>{logs+=d;});child.stdout.on('data',d=>{logs+=d;});
  for(let i=0;i<150;i++){if(child.exitCode!==null)throw new Error(logs);try{if((await fetch(BASE+'/api/integration/status')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Server startup failed: '+logs);
}
async function stop(){if(!child||child.exitCode!==null)return;const exited=once(child,'exit');child.kill('SIGTERM');await exited;child=null;}
async function req(path,user='u-pmo',method='GET',body){const r=await fetch(BASE+path,{method,headers:{'content-type':'application/json',...(user?{'x-user-id':user}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
const spm=`/api/spm/${PID}`,oex=`/api/oex/${PID}`;
before(async()=>{release=await lockRuntimeTests();await start();});
after(async()=>{if(!release)return;try{await stop();const r=fixtures();for(const table of ['StrategyPlan','ExcellenceAssessment','AuditLog'])for(const row of await r.list(table))if(row.ProjectId===PID||row.ProjectCode===PID||row.ProjectId===PID+'-other'||row.ProjectCode===PID+'-other')await r.remove(table,row.Id);}finally{await release();}});
test('LIVE-6 REST: both domains reject anonymous, inactive, unauthorized and out-of-project identities',async()=>{
  for(const base of [spm,oex])for(const [user,status] of [[null,401],['u-left',401],['u-admin',403],['u-planner',403],['u-pm',403]])assert.equal((await req(base+'/workspace',user)).status,status);
});
test('LIVE-6 REST: a newly opened project is truly empty and does not insert any sample rows',async()=>{
  for(const base of [spm,oex]){const r=await req(base+'/workspace');assert.equal(r.status,200);assert.deepEqual(r.body.data.records,[]);assert.equal(r.body.data.canEdit,true);}
});
test('LIVE-6 REST: PMO persists strategic objectives, KPIs, links and initiative figures; metrics come from server',async()=>{
  const r=await req(spm+'/plans','u-pmo','POST',strategyInput());assert.equal(r.status,201,JSON.stringify(r.body));plan=r.body.data;
  assert.equal(plan.ProjectId,PID);assert.equal(plan.CreatedBy,'u-pmo');assert.equal(plan.ModelVersion,'bsc-internal-v1');assert.equal(plan.metrics.objectives[0].attainment,.5);assert.equal(plan.metrics.attainment,null);assert.equal(plan.metrics.currencies[0].utilisation,.25);
  assert.equal((await req(spm+'/workspace')).body.data.records[0].Id,plan.Id);
});
test('LIVE-6 REST: partial excellence assessment, evidence and improvement notes persist without invented total',async()=>{
  const r=await req(oex+'/assessments','u-pmo','POST',excellenceInput());assert.equal(r.status,201,JSON.stringify(r.body));assessment=r.body.data;
  assert.equal(assessment.metrics.total,null);assert.equal(assessment.metrics.lines[0].points,50);assert.equal(assessment.Scores.C1.evidence,'DOC-TEST');assert.equal(assessment.Scores.C2.a,null);assert.equal(assessment.ModelVersion,'internal-9criteria-v1');assert.equal(assessment.CreatedBy,'u-pmo');
});
test('LIVE-6 REST: raw generic CRUD remains closed even to system admin; schema marks both tables private',async()=>{
  const schema=(await req('/api/data/schema')).body.data;
  for(const table of ['StrategyPlan','ExcellenceAssessment']){assert.equal(schema.tables.find(t=>t.name===table).exposed,false);for(const method of ['GET','POST','PATCH','DELETE']){const path='/api/data/'+table+(['PATCH','DELETE'].includes(method)?'/'+plan.Id:'');assert.equal((await req(path,'u-admin',method,method==='POST'||method==='PATCH'?{}:undefined)).status,403);}}
});
test('LIVE-6 REST: read-only project manager can view own workspace but cannot create or modify records',async()=>{
  for(const [domain,resource] of [['spm','plans'],['oex','assessments']]){const base=`/api/${domain}/c1-p1`;const r=await req(base+'/workspace','u-pm');assert.equal(r.status,200);assert.equal(r.body.data.canEdit,false);assert.equal((await req(base+'/'+resource,'u-pm','POST',{})).status,403);assert.equal((await req(base+'/'+resource+'/any','u-pm','PATCH',{})).status,403);}
});
test('LIVE-6 REST: forged actor, project, model, score and version fields cannot bypass validation',async()=>{
  for(const extra of [{ProjectId:'foreign'},{CreatedBy:'u-ceo'},{ModelVersion:'official'},{metrics:{attainment:1}},{RowVersion:999}])assert.equal((await req(spm+'/plans','u-pmo','POST',{...strategyInput('BAD'),...extra})).status,400);
  assert.equal((await req(oex+'/assessments','u-pmo','POST',{...excellenceInput('BAD'),Scores:{C1:{a:101,b:0}}})).status,400);
  assert.equal((await req(spm+'/plans','u-pmo','POST',{...strategyInput('BAD'),DataDate:'2099-01-01'})).status,400);
  assert.equal((await req(spm+'/plans','u-pmo','POST',{...strategyInput('BAD'),DataDate:'2026-02-31'})).status,400);
});
test('LIVE-6 REST: duplicate codes conflict only within a project, and cross-project record writes are hidden',async()=>{
  assert.equal((await req(spm+'/plans','u-pmo','POST',strategyInput())).status,409);
  assert.equal((await req(oex+'/assessments','u-pmo','POST',excellenceInput())).status,409);
  assert.equal((await req(`/api/spm/${PID}-other/plans/${plan.Id}`,'u-pmo','PATCH',{TitleFa:'attack',RowVersion:plan.RowVersion})).status,404);
  assert.equal((await req(`/api/oex/${PID}-other/assessments/${assessment.Id}`,'u-pmo','PATCH',{Notes:'attack',RowVersion:assessment.RowVersion})).status,404);
  const other=await req(`/api/spm/${PID}-other/plans`,'u-pmo','POST',strategyInput());assert.equal(other.status,201);
  const rows=(await req(spm+'/workspace')).body.data.records;assert.equal(rows.length,1);assert.equal(rows[0].Id,plan.Id);
});
test('LIVE-6 REST: revision required, persistent code immutable, and orphaning an objective is rejected',async()=>{
  assert.equal((await req(spm+'/plans/'+plan.Id,'u-pmo','PATCH',{TitleFa:'missing version'})).status,409);
  assert.equal((await req(spm+'/plans/'+plan.Id,'u-pmo','PATCH',{Code:'RENAMED',RowVersion:plan.RowVersion})).status,409);
  assert.equal((await req(spm+'/plans/'+plan.Id,'u-pmo','PATCH',{Objectives:[],RowVersion:plan.RowVersion})).status,400);
});
test('LIVE-6 REST: concurrent plan edits cannot silently overwrite one another',async()=>{
  const results=await Promise.all(['first','second'].map(TitleFa=>req(spm+'/plans/'+plan.Id,'u-pmo','PATCH',{TitleFa,RowVersion:plan.RowVersion})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);plan=results.find(r=>r.status===200).body.data;assert.equal(plan.RowVersion,2);assert.equal(plan.UpdatedBy,'u-pmo');
  assert.equal((await req(spm+'/workspace')).body.data.records[0].TitleFa,plan.TitleFa);
});
test('LIVE-6 REST: updating evidence/scores is persisted, scored server-side and audited',async()=>{
  const Scores=Object.fromEntries(['C1','C2','C3','C4','C5','R1','R2','R3','R4'].map(code=>[code,{a:80,b:80,evidence:'DOC-'+code}]));
  const r=await req(oex+'/assessments/'+assessment.Id,'u-pmo','PATCH',{Scores,RowVersion:assessment.RowVersion});assert.equal(r.status,200,JSON.stringify(r.body));assessment=r.body.data;assert.equal(assessment.metrics.total,800);assert.equal(assessment.RowVersion,2);assert.equal(assessment.metrics.complete,true);
  const audit=(await fixtures().list('AuditLog')).filter(r=>r.ProjectCode===PID);assert.equal(audit.filter(r=>r.EntityId===plan.Id).length,2);assert.equal(audit.filter(r=>r.EntityId===assessment.Id).length,2);assert.ok(audit.every(r=>r.SubjectId==='u-pmo'));
});
test('LIVE-6 REST: persisted records, computed results and model versions survive an API restart',async()=>{
  await stop();await start();const p=(await req(spm+'/workspace')).body.data.records[0],a=(await req(oex+'/workspace')).body.data.records[0];
  assert.equal(p.Id,plan.Id);assert.equal(p.TitleFa,plan.TitleFa);assert.equal(p.RowVersion,2);assert.equal(p.metrics.objectives[0].attainment,.5);assert.equal(a.Id,assessment.Id);assert.equal(a.metrics.total,800);assert.equal(a.ModelVersion,'internal-9criteria-v1');
});
