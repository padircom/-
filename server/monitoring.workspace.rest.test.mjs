import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRepository, JsonFileDriver } from './persistence/driver.mjs';
import { createEvmSnapshot } from './finLogic.js';
import { lockRuntimeTests } from './runtimeTestLock.mjs';
const DIR='./server/rundata',BASE='http://127.0.0.1:4800',PID=`mon-test-${Date.now()}`,DAY=new Date().toISOString().slice(0,10);
const fixtures=()=>createRepository(new JsonFileDriver(DIR));
let child,release,activity;
async function start(){child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'4800',PERSIST_DRIVER:'json',DATA_DIR:DIR},stdio:'ignore'});for(let i=0;i<150;i++){try{if((await fetch(BASE+'/api/integration/status')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Monitoring test server did not start');}
async function stop(){if(!child||child.exitCode!==null)return;const p=once(child,'exit');child.kill('SIGTERM');await p;child=null;}
async function req(user='u-pmo',path=`/api/monitoring/${PID}/workspace`,method='GET',body){const res=await fetch(BASE+path,{method,headers:{'content-type':'application/json',...(user?{'x-user-id':user}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,body:await res.json()};}
before(async()=>{
  release=await lockRuntimeTests();const r=fixtures();
  activity=await r.create('Activity',{Id:PID+'-a',ProjectId:PID,Code:'MON-A',NameFa:'فعالیت واقعی آزمون',PlannedStart:'2020-01-01',PlannedFinish:'2020-01-10',DurationDays:10,IsCritical:true,PhysicalPct:99});
  await r.create('Activity',{Id:PID+'-other',ProjectId:PID+'-other',Code:'FOREIGN-MON',NameFa:'نباید دیده شود',PlannedStart:'2020-01-01',PlannedFinish:'2020-01-10',DurationDays:10});
  await r.create('ProgressEntry',{Id:PID+'-p',ProjectId:PID,ActivityId:activity.Id,PeriodCode:'P1',EntryDate:DAY,PhysicalPct:25,EnteredBy:'u-planner',ApprovedBy:'u-pm',ApprovedAt:DAY,AcceptedIntoEv:true});
  const inputs={bac:200,pv:100,ev:80,ac:100},snap=createEvmSnapshot(PID,DAY,inputs);
  await r.create('EvmSnapshot',{Id:PID+'-s',ProjectId:PID,DataDate:DAY,Pv:100,Ev:80,Ac:100,Bac:200,Eac:snap.result.eac.cpi,Inputs:inputs,Hash:snap.hash,FormulaVersion:snap.formulaVersion});
  await r.create('Claim',{Id:PID+'-claim',ProjectId:PID,Code:'PRIVATE',TitleFa:'PRIVATE-MON-SECRET',NoticeDate:DAY,Status:'draft'});
  await start();
});
after(async()=>{
  if(!release)return;
  try{await stop();const r=fixtures();for(const table of ['Activity','ProgressEntry','EvmSnapshot','Claim','AuditLog'])for(const row of await r.list(table))if(String(row.Id).startsWith(PID)||row.ProjectId===PID||row.ProjectCode===PID)await r.remove(table,row.Id);}
  finally{await release();}
});
test('LIVE-5 REST: authentication and project scope on the real Express endpoint',async()=>{
  assert.equal((await req(null)).status,401);assert.equal((await req('u-left')).status,401);assert.equal((await req('u-admin')).status,403);assert.equal((await req('u-pm')).status,403);assert.equal((await req('u-pmo',`/api/monitoring/${PID}/workspace?horizonDays=5`)).status,400);
});
test('LIVE-5 REST: persisted verified EVM and accepted progress replace synthetic metrics',async()=>{
  const r=await req();assert.equal(r.status,200,JSON.stringify(r.body));const d=r.body.data;
  assert.equal(d.projectId,PID);assert.equal(d.evm.latest.id,PID+'-s');assert.equal(d.evm.latest.spi,.8);assert.equal(d.evm.latest.cpi,.8);assert.equal(d.evm.latest.integrity,'verified');assert.equal(d.lookahead.length,1);assert.equal(d.lookahead[0].approvedPct,25);assert.equal(d.lookahead[0].code,'MON-A');assert.equal(d.phi.value,null);
  assert.ok(!JSON.stringify(d).includes('FOREIGN-MON'));assert.ok(!JSON.stringify(d).includes('PRIVATE-MON-SECRET'));
});
test('LIVE-5 REST: permission-specific omissions never look like zero-valued complete KPIs',async()=>{
  const d=(await req()).body.data;assert.equal(d.sources.find(s=>s.table==='Claim').state,'restricted');assert.equal(d.sources.find(s=>s.table==='Claim').rowCount,null);assert.equal(d.summaries.find(s=>s.table==='Claim').value,null);
  const auditor=(await req('u-auditor')).body.data;assert.equal(auditor.evm.state,'restricted');assert.equal(auditor.evm.latest,null);assert.equal(auditor.summaries.find(s=>s.table==='Claim').value,1);
});
test('LIVE-5 REST: refresh does not mutate source rows or EVM values; no monitoring write route',async()=>{
  const before=await fixtures().get('EvmSnapshot',PID+'-s');const a=(await req()).body.data,b=(await req()).body.data;
  assert.deepEqual(a.evm,b.evm);assert.deepEqual(a.summaries,b.summaries);assert.deepEqual(await fixtures().get('EvmSnapshot',PID+'-s'),before);
  assert.equal((await req('u-pmo',`/api/monitoring/${PID}/workspace`,'POST',{})).status,404);
});
test('LIVE-5 REST: an empty project stays empty; no demo snapshots, health score or action plan',async()=>{
  const d=(await req('u-pmo',`/api/monitoring/${PID}-empty/workspace`)).body.data;
  assert.equal(d.evm.state,'empty');assert.equal(d.evm.latest,null);assert.equal(d.lookahead.length,0);assert.equal(d.actions.length,0);assert.equal(d.alerts.length,0);assert.equal(d.summaries.find(s=>s.table==='Activity').value,0);
});
test('LIVE-5 REST: updating the persisted schedule changes the next read and survives restart',async()=>{
  await stop();const r=fixtures();const old=await r.get('Activity',activity.Id);assert.equal((await r.patch('Activity',activity.Id,{ActualFinish:DAY},'monitor-test',old.RowVersion)).ok,true);await start();
  assert.equal((await req()).body.data.lookahead.length,0);assert.equal((await req()).body.data.evm.latest.spi,.8);
});
