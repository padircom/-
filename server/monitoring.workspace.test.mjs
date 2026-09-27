import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonitoring, evmPoint, monitorDay, monitorNumber, MONITOR_SOURCES } from './monitoringWsLogic.js';
import { createEvmSnapshot } from './finLogic.js';
import { registerMonitoringWorkspaceRoutes } from './monitoringWorkspaceApi.js';
import { DEMO_SUBJECTS, evaluate, PERMISSION_CATALOG } from './rbacLogic.js';
const TODAY='2026-09-27';
function snapshot(id,date,inputs={bac:200,pv:100,ev:80,ac:100}) {
  const snap=createEvmSnapshot('c1-p1',date,inputs);
  return {Id:id,ProjectId:'c1-p1',DataDate:date,Pv:inputs.pv,Ev:inputs.ev,Ac:inputs.ac,Bac:inputs.bac,Eac:snap.result.eac.cpi,Inputs:inputs,Hash:snap.hash,FormulaVersion:snap.formulaVersion};
}
const source=(table,rows=[],state=rows.length?'ready':'empty')=>({table,rows,state});
const projection=(...sources)=>buildMonitoring(sources,TODAY,30);
test('LIVE-5: valid calendar dates and finite numeric values; missing is not zero',()=>{
  assert.equal(monitorDay('2026-02-31'),null);assert.equal(monitorDay('nonsense'),null);assert.equal(monitorDay(new Date(TODAY)),TODAY);
  for(const v of [null,undefined,'',' ',true,NaN,Infinity,'NaN'])assert.equal(monitorNumber(v),null);
  assert.equal(monitorNumber('0'),0);
});
test('LIVE-5: true persisted PV/EV/AC, ratios and stored forecast use verified finance inputs',()=>{
  const p=evmPoint(snapshot('s',TODAY),TODAY);
  assert.equal(p.state,'ready');assert.equal(p.spi,.8);assert.equal(p.cpi,.8);assert.equal(p.sv,-20);assert.equal(p.cv,-20);assert.equal(p.eac,250);assert.equal(p.etc,150);assert.equal(p.vac,-50);
});
test('LIVE-5: zero denominators are unknown, never Infinity, zero health or made-up ratios',()=>{
  const p=evmPoint(snapshot('s',TODAY,{bac:200,pv:0,ev:0,ac:0}),TODAY);
  assert.equal(p.state,'ready');assert.equal(p.spi,null);assert.equal(p.cpi,null);assert.equal(p.eac,null);assert.equal(p.etc,null);
});
test('LIVE-5: snapshot hash and output-column tampering do not become current KPIs',()=>{
  const valid=snapshot('s',TODAY);
  for(const patch of [{Pv:200},{Ac:400},{Eac:999},{Hash:'wrong'},{Inputs:{bac:200,pv:90,ev:80,ac:100}}]){
    const p=evmPoint({...valid,...patch},TODAY);assert.equal(p.state,'invalid');assert.equal(p.pv,null);assert.equal(p.cpi,null);
  }
  const unverified=evmPoint({...valid,Inputs:null},TODAY);assert.equal(unverified.state,'unverified');assert.equal(unverified.ev,null);
});
test('LIVE-5: missing, negative, non-finite and future EVM inputs are not silently replaced',()=>{
  for(const patch of [{Pv:null},{Pv:NaN},{Ac:-1},{Ev:Infinity},{DataDate:'2026-09-28'}])assert.notEqual(evmPoint({...snapshot('s',TODAY),...patch},TODAY).state,'ready');
});
test('LIVE-5: latest dated snapshot wins, including invalid latest; no fallback to a healthy past',()=>{
  const m=projection(source('EvmSnapshot',[snapshot('old','2026-09-01'),snapshot('future','2026-09-28'),{...snapshot('bad',TODAY),Pv:null}]));
  assert.equal(m.evm.latest.id,'bad');assert.equal(m.evm.state,'invalid');assert.equal(m.evm.history.length,2);assert.equal(m.evm.excludedUndatedOrFuture,1);assert.equal(m.evm.latest.spi,null);
});
test('LIVE-5: freshness uses actual data date, not fetch time; empty PHI/EVM are unknown',()=>{
  const m=projection(source('EvmSnapshot',[snapshot('s','2026-08-01')]));assert.equal(m.evm.latest.stale,true);
  const empty=projection(source('EvmSnapshot'));assert.equal(empty.evm.latest,null);assert.equal(empty.evm.state,'empty');assert.equal(empty.phi.value,null);
});
test('LIVE-5: restricted and unavailable source KPIs are null while a known empty source is zero',()=>{
  const m=projection(source('Risk',[],'restricted'),source('Claim',[],'unavailable'),source('Ncr'));
  assert.equal(m.summaries.find(k=>k.table==='Risk').value,null);assert.equal(m.summaries.find(k=>k.table==='Claim').value,null);assert.equal(m.summaries.find(k=>k.table==='Ncr').value,0);
  assert.equal(m.sources.find(s=>s.table==='Risk').rowCount,null);assert.equal(m.alerts.length,0);
});
test('LIVE-5: bounded lookahead uses real dates and critical flags, never draft physical % as approved EV',()=>{
  const activities=[{Id:'a',Code:'A',NameFa:'work',PlannedStart:'2026-09-01',PlannedFinish:'2026-09-20',PhysicalPct:99,TotalFloat:0}, {Id:'b',PlannedStart:'2026-12-01',PlannedFinish:'2026-12-20'}, {Id:'c',PlannedStart:'2026-09-01',PlannedFinish:'2026-09-28',ActualFinish:TODAY}];
  const entries=[{Id:'1',ActivityId:'a',EntryDate:'2026-09-20',PhysicalPct:20,AcceptedIntoEv:true,ApprovedBy:'p',ApprovedAt:'2026-09-21'}, {Id:'2',ActivityId:'a',EntryDate:TODAY,PhysicalPct:99,AcceptedIntoEv:false}, {Id:'3',ActivityId:'a',EntryDate:TODAY,PhysicalPct:100,AcceptedIntoEv:true,ApprovedBy:'p',ApprovedAt:'2026-09-28'}];
  const m=projection(source('Activity',activities),source('ProgressEntry',entries));assert.equal(m.lookahead.length,1);assert.equal(m.lookahead[0].approvedPct,20);assert.equal(m.lookahead[0].critical,true);assert.equal(m.lookahead[0].status,'overdue');
});
test('LIVE-5: overdue meeting actions come from CKM records; done/cancelled excluded, today is not overdue',()=>{
  const m=projection(source('MeetingAction',[{Id:'a',Status:'open',DueDate:'2026-09-20'},{Id:'b',Status:'done',DueDate:'2026-09-20'},{Id:'c',Status:'cancelled',DueDate:'2026-09-20'},{Id:'d',Status:'in_progress',DueDate:TODAY}]));
  assert.equal(m.actions.length,2);assert.equal(m.summaries.find(s=>s.table==='MeetingAction').value,1);assert.equal(m.actions[1].critical,false);
});
test('LIVE-5: alert rules are deterministic and monitoring does not mutate its input',()=>{
  const sources=[source('Risk',[{Id:'r',Status:'open',Probability:4,Impact:4}]),source('EvmSnapshot',[snapshot('s',TODAY)])];const before=JSON.stringify(sources);
  const a=buildMonitoring(sources,TODAY,30),b=buildMonitoring(sources,TODAY,30);
  assert.deepEqual(a,b);assert.equal(JSON.stringify(sources),before);assert.equal(a.alerts.length,3);
});
test('LIVE-5: each source permission exists; EVM requires finance permission as well as EVM view',()=>{
  const codes=new Set(PERMISSION_CATALOG.map(p=>p.code));for(const s of MONITOR_SOURCES)for(const p of s.permissions)assert.ok(codes.has(p),p);
  const evm=MONITOR_SOURCES.find(s=>s.table==='EvmSnapshot');assert.equal(evm.all,true);assert.ok(evm.permissions.includes('fin.cost.view'));
});
async function invoke({user='u-pmo',project='c1-p1',list=async()=>[],horizonDays,subjects=DEMO_SUBJECTS,authorize=evaluate}={}) {
  let handler;const calls=[];registerMonitoringWorkspaceRoutes({get:(_,h)=>{handler=h;}},{repo:async()=>({list:async(table,query)=>{calls.push({table,query});return list(table,query);}}),subjects,evaluate:authorize});
  let status=200,body;const headers={};const response={status(n){status=n;return this;},set(k,v){headers[k]=v;return this;},json(b){body=b;return this;}};
  await handler({params:{projectId:project},query:horizonDays===undefined?{}:{horizonDays},headers:user?{'x-user-id':user}:{},requestId:'monitor-test'},response,e=>{throw e;});
  return {status,body,calls,headers};
}
test('LIVE-5 API: identity, inactive users, invalid project, project membership and horizon are guarded',async()=>{
  for(const [opts,status] of [[{user:null},401],[{user:'u-left'},401],[{user:'u-admin'},403],[{user:'u-pm',project:'foreign'},403],[{project:'bad.id'},400],[{horizonDays:'31'},400]])assert.equal((await invoke(opts)).status,status);
});
test('LIVE-5 API: restricted sources are not even queried and responses never contain raw secret rows',async()=>{
  const r=await invoke({user:'u-planner',list:async table=>table==='Activity'?[{Id:'a',ProjectId:'c1-p1',NameFa:'valid',PlannedStart:'2026-01-01',PlannedFinish:'2026-01-10',BudgetCost:999999,Private:'secret'}]:[]});
  assert.equal(r.status,200);assert.ok(!r.calls.some(c=>['Claim','EvmSnapshot','Correspondence','MeetingAction'].includes(c.table)));
  assert.equal(r.body.data.evm.latest,null);assert.equal(r.body.data.evm.state,'restricted');assert.ok(!JSON.stringify(r.body).includes('999999'));assert.ok(!JSON.stringify(r.body).includes('secret'));assert.equal(r.headers['Cache-Control'],'no-store');
  for(const c of r.calls){assert.equal(c.query.limit,5001);assert.deepEqual(c.query.where[0],{column:'ProjectId',op:'eq',value:'c1-p1'});}
});
test('LIVE-5 API: one failed source and oversized datasets do not yield fabricated zero or partial totals',async()=>{
  const r=await invoke({list:async table=>{if(table==='Risk')throw Object.assign(new Error('secret details'),{code:'TEST_SOURCE'});if(table==='Activity')return Array.from({length:5001},(_,i)=>({Id:String(i)}));return [];}});
  assert.equal(r.status,200);assert.equal(r.body.data.sources.find(s=>s.table==='Risk').state,'unavailable');assert.equal(r.body.data.sources.find(s=>s.table==='Activity').state,'too_large');assert.equal(r.body.data.summaries.find(s=>s.table==='Activity').value,null);assert.ok(!JSON.stringify(r.body).includes('secret details'));
});
test('LIVE-5 API: classification is filtered before counts and discipline is passed to the repository',async()=>{
  const r=await invoke({user:'u-site',list:async table=>table==='Document'?[{Id:'ok',Classification:'internal',Status:'draft'},{Id:'secret',Classification:'restricted',Status:'draft'},{Id:'bad',Classification:'unknown',Status:'draft'}]:[]});
  assert.equal(r.body.data.summaries.find(s=>s.table==='Document').value,1);
  const q=r.calls.find(c=>c.table==='Activity').query;assert.ok(q.where.some(w=>w.column==='Discipline'&&w.op==='in'&&w.value.includes('civil')));
});
test('LIVE-5 API: progress source metadata cannot leak invisible/orphan activities',async()=>{
  const r=await invoke({list:async table=>table==='Activity'?[{Id:'visible'}]:table==='ProgressEntry'?[{ActivityId:'visible'},{ActivityId:'other'}]:[]});
  assert.equal(r.body.data.sources.find(s=>s.table==='ProgressEntry').rowCount,1);
});
test('LIVE-5: persisted decimal rounding is accepted but cent-level output tampering is rejected',()=>{
  const s=snapshot('round',TODAY,{bac:200,pv:100,ev:77,ac:100});
  const rounded={...s,Eac:Number(s.Eac.toFixed(2))};assert.equal(evmPoint(rounded,TODAY).state,'ready');
  assert.equal(evmPoint({...rounded,Eac:rounded.Eac+.01},TODAY).state,'invalid');
});
test('LIVE-5: SQL-style Date objects preserve provenance and invalid dates do not crash projections',()=>{
  const m=projection(source('EvmSnapshot',[{...snapshot('sql',TODAY),DataDate:new Date(TODAY),UpdatedAt:new Date(TODAY)}]));
  assert.equal(m.evm.latest.dataDate,TODAY);assert.equal(m.evm.latest.integrity,'verified');assert.equal(m.sources[0].lastUpdatedAt,new Date(TODAY).toISOString());
  assert.equal(monitorDay(new Date('invalid')),null);assert.equal(monitorDay('2026-09-27invalid'),null);
});
