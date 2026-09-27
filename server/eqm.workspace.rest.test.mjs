import { lockRuntimeTests } from './runtimeTestLock.mjs';
let releaseRuntimeLock;
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRepository, JsonFileDriver } from './persistence/driver.mjs';
const DIR='./server/rundata', BASE='http://127.0.0.1:4799', PID=`eqm-test-${Date.now()}`, DAY=new Date().toISOString().slice(0,10);
let child; const fixtures=()=>createRepository(new JsonFileDriver(DIR));
async function start(){child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'4799',PERSIST_DRIVER:'json',DATA_DIR:DIR},stdio:'ignore'});for(let i=0;i<150;i++){try{if((await fetch(BASE+'/api/integration/status')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Server startup failed');}
async function stop(){if(!child)return;const p=once(child,'exit');child.kill('SIGTERM');await p;child=null;}
async function req(path,user='u-pmo',method='GET',body){const res=await fetch(BASE+path,{method,headers:{'content-type':'application/json',...(user?{'x-user-id':user}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:res.status,body:await res.json()};}
const root=`/api/eqp/${PID}`;
async function create(table,body){const r=await req(root+'/rows/'+table,'u-pmo','POST',body);assert.equal(r.status,201,JSON.stringify(r));return r.body.data;}
let equipment,meter,dispatch;
before(async()=>{releaseRuntimeLock=await lockRuntimeTests();await fixtures().create('WorkforceMember',{Id:PID+'-operator',ProjectId:PID,PersonnelNo:PID,FullName:'آزمون',TradeCode:'operator',Active:true,IsSubcontracted:false,LicenseExpiry:'2099-01-01'});await start();});
after(async()=>{if(!releaseRuntimeLock)return;try{await stop();const r=fixtures();for(const table of ['Equipment','EquipmentMeter','EquipmentRental','MaintenanceOrder','EquipmentDispatch','EquipmentFuelLog','PmSchedule','SparePart','WorkforceMember','AuditLog']){for(const row of await r.list(table))if(row.ProjectId===PID||row.ProjectCode===PID)await r.remove(table,row.Id);}}finally{await releaseRuntimeLock();}});
test('LIVE-4: no identity/no permission/project isolation enforced on old and new endpoints',async()=>{
  assert.equal((await req(root+'/workspace',null)).status,401);
  assert.equal((await req(root+'/workspace','u-admin')).status,403);
  assert.equal((await req(root+'/workspace','u-pm')).status,403);
  assert.equal((await req('/api/eqp/kpi?projectId='+PID,null)).status,401);
  assert.equal((await req('/api/eqp/reports?projectId='+PID,'u-site')).status,403);
});
test('LIVE-4: persisted fleet uses server project/actor and validates enums/numbers',async()=>{
  equipment=await create('Equipment',{Code:'EXC-1',NameFa:'بیل آزمون',Category:'EXC',Ownership:'owned',Status:'active',ProjectId:'spoof',CreatedBy:'spoof'});
  assert.equal(equipment.ProjectId,PID);assert.equal(equipment.CreatedBy,'u-pmo');
  assert.equal((await req(root+'/rows/Equipment','u-pmo','POST',{Code:'bad',NameFa:'بد',Category:'INVALID',Ownership:'owned'})).status,400);
  assert.equal((await req('/api/data/Equipment','u-admin','POST',{})).status,403);
  assert.equal((await req(`/api/eqm/equipment/${equipment.Id}/kpi?projectId=other`)).status,404);
});
test('LIVE-4: meter persisted, daily hours and chronological rollback are guarded',async()=>{
  meter=await create('EquipmentMeter',{EquipmentId:equipment.Id,ReadAt:DAY,HourMeter:100,WorkHours:8});
  assert.equal((await req(root+'/rows/EquipmentMeter','u-pmo','POST',{EquipmentId:equipment.Id,ReadAt:'2000-01-01',HourMeter:120,WorkHours:8})).status,409);
  assert.equal((await req(root+'/rows/EquipmentMeter','u-pmo','POST',{EquipmentId:equipment.Id,ReadAt:'2000-01-01',HourMeter:10,WorkHours:25})).status,400);
  assert.equal((await req(root+'/rows/EquipmentMeter','u-pmo','POST',{EquipmentId:equipment.Id,ReadAt:'2026-02-31',HourMeter:10,WorkHours:1})).status,400);
  assert.equal((await req(root+'/rows/EquipmentMeter','u-pmo','POST',{EquipmentId:'foreign',ReadAt:DAY,HourMeter:10,WorkHours:1})).status,404);
});
test('LIVE-4: fuel, rental, maintenance, PM and inventory are real rows, not browser state',async()=>{
  await create('EquipmentFuelLog',{EquipmentId:equipment.Id,LogDate:DAY,Kind:'diesel',Quantity:30,UnitCost:20});
  await create('EquipmentRental',{EquipmentId:equipment.Id,ContractNo:PID,RateType:'daily',Rate:100,StartDate:DAY});
  await create('MaintenanceOrder',{EquipmentId:equipment.Id,Code:'WO-1',Kind:'inspection',Priority:'low',ReportedAt:DAY,DescriptionFa:'بررسی'});
  await create('PmSchedule',{EquipmentId:equipment.Id,Code:'PM-1',TitleFa:'سرویس',Basis:'run_hours',IntervalValue:1000,LastDoneAt:DAY,LastDoneReading:100,Active:true});
  await create('SparePart',{PartNo:'P-1',NameFa:'فیلتر',OnHand:10,MinLevel:2,Critical:true});
  const w=await req(root+'/workspace');for(const table of ['EquipmentFuelLog','EquipmentRental','MaintenanceOrder','PmSchedule','SparePart'])assert.equal(w.body.data.rows[table].length,1);
});
test('LIVE-4: stale versions fail and current update is persisted',async()=>{
  const path=root+'/rows/Equipment/'+equipment.Id;
  assert.equal((await req(path,'u-pmo','PATCH',{NameFa:'اصلاح',RowVersion:0})).status,409);
  const r=await req(path,'u-pmo','PATCH',{NameFa:'اصلاح',RowVersion:1});assert.equal(r.status,200);assert.equal(r.body.data.NameFa,'اصلاح');
});
test('LIVE-4: dispatch defaults draft; approval spoofing and retired bypass are blocked',async()=>{
  dispatch=await create('EquipmentDispatch',{EquipmentId:equipment.Id,DispatchDate:DAY,OperatorId:PID+'-operator',PlannedHours:8,SafetyCheck:true,Status:'approved',ApprovedBy:'spoof'});
  assert.equal(dispatch.Status,'draft');assert.ok(!dispatch.ApprovedBy);
  assert.equal((await req(`/api/eqp/dispatch/${dispatch.Id}/advance?projectId=${PID}`,'u-pmo','POST',{to:'approved'})).status,410);
  const r=await req(root+`/dispatch/${dispatch.Id}/advance`,'u-pmo','POST',{to:'submitted',RowVersion:1});assert.equal(r.status,200,JSON.stringify(r));
  assert.equal((await req(root+`/dispatch/${dispatch.Id}/advance`,'u-pmo','POST',{to:'approved',RowVersion:2})).status,403);
  assert.equal((await req(root+'/rows/EquipmentDispatch/'+dispatch.Id,'u-pmo','PATCH',{SafetyCheck:false,RowVersion:2})).status,409);
});
test('LIVE-4: independent approval locks dispatch and execution rechecks gates',async()=>{
  const path=root+`/dispatch/${dispatch.Id}/advance`;
  const r=await req(path,'u-ceo','POST',{to:'approved',RowVersion:2});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.data.ApprovedBy,'u-ceo');
  assert.equal((await req(path,'u-pmo','POST',{to:'executed',RowVersion:3})).status,200);
  assert.equal((await req(path,'u-ceo','POST',{to:'rejected',RowVersion:2})).status,409);
});
test('LIVE-4: missing HRM operator cannot pass dispatch gate',async()=>{
  const d=await create('EquipmentDispatch',{EquipmentId:equipment.Id,DispatchDate:DAY,Shift:'night',PlannedHours:8,SafetyCheck:true});
  const r=await req(root+`/dispatch/${d.Id}/advance`,'u-pmo','POST',{to:'submitted',RowVersion:1});assert.equal(r.status,422);assert.equal(r.body.error.code,'EQM_OPERATOR');
});
test('LIVE-4: existing summary, KPI, PM, reorder, board and report routes read persisted data',async()=>{
  for(const path of ['/api/eqm/summary','/api/eqp/kpi','/api/eqp/pm/due','/api/eqp/parts/reorder','/api/eqp/dispatch/board','/api/eqp/reports']){const r=await req(path+'?projectId='+PID);assert.equal(r.status,200,JSON.stringify(r));}
  const csv=await fetch(BASE+'/api/eqp/reports/RPT-EQP-PART?projectId='+PID+'&format=csv',{headers:{'x-user-id':'u-pmo'}});assert.equal(csv.status,200);assert.match(await csv.text(),/P-1/);
  const r=await req(`/api/eqm/equipment/${equipment.Id}/kpi?projectId=${PID}`);assert.equal(r.status,200);assert.equal(r.body.data.equipment.NameFa,'اصلاح');
});
test('LIVE-4: restart retains records and actor audit trail',async()=>{
  await stop();await start();const r=await req(root+'/workspace');assert.equal(r.status,200);assert.equal(r.body.data.rows.EquipmentMeter[0].Id,meter.Id);assert.equal(r.body.data.rows.EquipmentDispatch.find(d=>d.Id===dispatch.Id).Status,'executed');
  assert.ok((await fixtures().list('AuditLog')).some(a=>a.ProjectCode===PID&&a.Action==='EQM_ADVANCE'));
});
