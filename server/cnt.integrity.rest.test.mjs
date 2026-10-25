import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createRepository,JsonFileDriver} from './persistence/driver.mjs';
const PORT=4798, BASE=`http://127.0.0.1:${PORT}`, pid='c1-p1', cid='integrity-contract', q=`?projectId=${pid}&contractId=${cid}`;
let dir,files,child,repo;
async function api(p,{method='GET',body,user='u-contracts',raw=false}={}){const res=await fetch(BASE+p,{method,headers:{'content-type':'application/json',...(user?{'x-user-id':user}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,...(raw?{text:await res.text(),headers:res.headers}:await res.json())};}
before(async()=>{
 dir=await mkdtemp(path.join(tmpdir(),'cnt-integrity-'));files=await mkdtemp(path.join(tmpdir(),'cnt-integrity-files-'));repo=createRepository(new JsonFileDriver(dir));
 for(const [Id,InitialAmount] of [[cid,1000],['incomplete-contract',10000]]){
 await repo.create('ContractMaster',{Id,ProjectId:pid,Code:Id,TitleFa:'پیمان آزمون',ContractType:'unit_price',Party:'main',EmployerName:'کارفرما واقعی',ContractorName:'پیمانکار واقعی',ConsultantName:'مشاور واقعی',SignDate:'2026-01-01',StartDate:'2026-01-01',DurationDays:365,InitialAmount,CurrentAmount:InitialAmount,Currency:'IRR',CeilingPct:25,RetainagePct:10,AdjustmentEnabled:false,Status:'active'},'u-contracts');
 await repo.create('ContractBOQ_Item',{Id:`boq-${Id}`,ProjectId:pid,ContractId:Id,ItemNo:'1',TitleFa:'ردیف واقعی',PricingBasis:'unit_price',Unit:'متر',ContractQty:100,UnitRate:10,LineAmount:1000,IsStarred:false,RateStatus:'agreed',Status:'active'},'u-contracts');
 }
 for(const [Id,SerialNo,PeriodCode,GrossCumulative,Status] of [['ipc-1',1,'2026-01',100,'open'],['ipc-2',2,'2026-02',300,'open'],['ipc-cancelled',3,'2026-03',999,'cancelled']]){
 await repo.create('InterimPaymentCertificate',{Id,ProjectId:pid,ContractId:cid,SerialNo,IpcType:'interim',PeriodCode,PeriodFrom:'2026-01-01',PeriodTo:'2026-01-31',GrossCurrent:100,GrossCumulative,SubtotalAmount:GrossCumulative,TotalDeductions:0,NetPayable:100,WorkflowState:'approved',PostedToFin:false,Status},'u-contracts');
 await repo.create('IPC_LineItem',{ProjectId:pid,IpcId:Id,BoqItemId:`boq-${cid}`,PricingBasis:'unit_price',CumQty:GrossCumulative/10,CurrentQty:10,UnitRate:10,EarnedCurrent:100,EarnedCumulative:GrossCumulative,QualityGateStatus:'passed',Status:'approved'},'u-contracts');
 }
 const expiry=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
 for(const [Code,Status] of [['G-LIVE','active'],['G-RELEASED','released']]) await repo.create('ContractGuarantee',{ProjectId:pid,ContractId:cid,Code,GuaranteeType:'performance',BankName:'بانک آزمون',GuaranteeNo:Code,Amount:100,IssueDate:'2026-01-01',ExpiryDate:expiry,Status},'u-contracts');
 await repo.create('ContractMetricsSnapshot',{ProjectId:pid,ContractId:cid,PeriodCode:'2025-12',PhysicalPct:90,FinancialPct:10,SnapshotAt:'2025-12-31T12:00:00Z',IsGapReliable:true},'u-contracts');
 child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(PORT),PERSIST_DRIVER:'json',DATA_DIR:dir,FILE_STORAGE_PATH:files},stdio:'ignore'});
 for(let i=0;i<100;i++){try{await fetch(BASE+'/api/health');return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('API not ready');
});
after(async()=>{if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}if(dir)await rm(dir,{recursive:true,force:true});if(files)await rm(files,{recursive:true,force:true});});
test('dashboard and report share physical, financial, gap and curve inputs; cancelled IPC excluded',async()=>{
 const p=(await api('/api/cnt/progress'+q)).data;assert.equal(p.physicalPct,30);assert.equal(p.financialPct,30);
 const curve=(await api('/api/cnt/progress/scurve'+q)).data;assert.equal(curve.latest.actualPct,p.financialPct);assert.equal(curve.latest.actualAmount,300);assert.equal(curve.points.length,2);assert.equal(curve.latest.plannedPct,null);assert(!curve.points.some(x=>x.plannedPct===90));
 const report=(await api('/api/cnt/reports/RPT-CNT-PRG'+q)).data;const cells=report.sections.find(s=>s.title.fa==='پیشرفت').cells;
 assert.equal(cells.find(c=>c.label.fa==='مالی').value,'30');assert.equal(cells.find(c=>c.label.fa==='فاصله').value,'0');assert.equal(cells.find(c=>c.label.fa==='مصرف سقف').value,'24');
 const table=report.sections.find(s=>s.kind==='table');assert.equal(table.rows.at(-1).financial,'30');assert.equal(table.rows.at(-1).physical,'—');
});
test('unreliable gap is excluded from KPI alerts and health, not merely annotated',async()=>{
 const out=await api(`/api/cnt/kpi?projectId=${pid}&contractId=incomplete-contract`);assert.equal(out.status,200);
 assert.equal(out.data.isGapReliable,false);assert.equal(out.data.kpis.byCode.progress_gap_pct,null);assert(!out.data.health.contributions.some(c=>c.code==='progress_gap_pct'));assert(out.data.alerts.skipped.some(c=>c.code==='EWS-01'));assert(out.data.dataQualityFa.length>0);
});
test('current snapshot records quality and expiring guarantee count, immutable past periods',async()=>{
 const card=(await api('/api/cnt/kpi'+q)).data;assert.equal(card.kpis.byCode.open_guarantee_count,1);assert.equal(card.kpis.byCode.expiring_guarantee_count,1);assert(card.alerts.fired.some(x=>x.code==='EWS-07'));assert.equal(card.permissions.snapshot,true);assert.equal(card.permissions.manageRules,false);
 for(const periodCode of ['2020-01','2099-01','1405-08']) assert.equal((await api('/api/cnt/kpi/snapshot'+q,{method:'POST',body:{periodCode}})).status,422);
 const created=await api('/api/cnt/kpi/snapshot'+q,{method:'POST',body:{periodCode:card.currentPeriod}});assert.equal(created.status,200);assert.equal(created.data.item.IsGapReliable,true);assert.equal(created.data.item.ExpiringGuaranteeCount,1);
 const out=await api('/api/cnt/kpi/snapshot'+q,{method:'POST',body:{periodCode:card.currentPeriod}});assert.equal(out.status,409);
 const version=created.data.item.RowVersion;
 const collisions=await Promise.all([1,2].map(()=>api('/api/cnt/kpi/snapshot'+q,{method:'POST',body:{periodCode:card.currentPeriod,RowVersion:version}})));assert.deepEqual(collisions.map(x=>x.status).sort(),[200,409]);
 const fresh=createRepository(new JsonFileDriver(dir));assert.equal((await fresh.list('ContractMetricsSnapshot',{where:[{column:'PeriodCode',op:'eq',value:'2025-12'}]}))[0].PhysicalPct,90);assert((await fresh.list('AuditLog',{limit:100})).some(x=>x.Action==='CNT_KPI_SNAPSHOT'&&x.Details.after));
});
test('role and project access precede reading, writing or exporting data',async()=>{
 for(const p of ['/api/cnt/progress','/api/cnt/progress/scurve','/api/cnt/progress/breakdown','/api/cnt/kpi','/api/cnt/kpi/trend','/api/cnt/alert-rule','/api/cnt/reports/RPT-CNT-PRG','/api/cnt/reports/RPT-CNT-PRG/render']) assert.equal((await api(p+'?projectId=c9-p9&contractId='+cid)).status,403,p);
 assert.equal((await api('/api/cnt/kpi/snapshot'+q,{method:'POST',user:'u-planner',body:{periodCode:new Date().toISOString().slice(0,7)}})).status,403);
 for(const table of ['ContractMetricsSnapshot','ContractAlertRule']) assert.equal((await api(`/api/data/${table}`,{method:'POST',user:'u-admin',body:{}})).status,403);
});
test('rule updates retain omitted values and create persistent audit',async()=>{
 let out=await api('/api/cnt/alert-rule?projectId='+pid,{method:'POST',user:'u-pm',body:{ruleCode:'EWS-03',thresholdValue:97,severity:'info',isEnabled:false}});assert.equal(out.status,200);
 out=await api('/api/cnt/alert-rule?projectId='+pid,{method:'POST',user:'u-pm',body:{ruleCode:'EWS-03',thresholdValue:98}});assert.equal(out.status,200);assert.equal(out.data.item.Severity,'info');assert.equal(out.data.item.IsEnabled,false);
 const fresh=createRepository(new JsonFileDriver(dir));assert((await fresh.list('AuditLog',{limit:100})).some(x=>x.Action==='CNT_ALERT_RULE_SET'));
});
test('official report requires all header values; real complete header exports successfully',async()=>{
 const base='/api/cnt/reports/RPT-CNT-BOQ/render'+q+'&audience=official';
 assert.equal((await api(base,{user:'u-pm'})).status,422);
 const lh=new URLSearchParams({projectName:'پروژه واقعی',projectCode:'ACTUAL',contractorLogo:'نشان پیمانکار',clientLogo:'نشان کارفرما',consultantLogo:'نشان مشاور',preparedBy:'تهیه کننده',approvedBy:'مدیر پروژه',distribution:'کارفرما',docNo:'ACTUAL-CNT-001',revision:'00',format:'word'});
 const result=await api(base+'&'+lh,{user:'u-pm',raw:true});assert.equal(result.status,200);assert(result.headers.get('content-type').includes('msword'));assert(result.text.includes('ACTUAL-CNT-001'));
 lh.set('projectName','—'); const missing=await api(base+'&'+lh,{user:'u-pm'});assert.equal(missing.status,422);
});
