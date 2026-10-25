import test from 'node:test';
import assert from 'node:assert/strict';
import { contractActualCurve, currentMetricPeriod, validMetricPeriod, kpiTrend, progressSnapshot, buildCntReport, contractKpis, contractScorecard } from './cntLogic.js';
const row=(PeriodCode,CeilingUsedPct,other={})=>({PeriodCode,CeilingUsedPct,...other});
test('early warning uses customized thresholds and disabled rules',()=>{
 const snapshots=[row('2026-01',85),row('2026-02',88)];
 assert(kpiTrend({snapshots}).emergingFa.some(s=>s.includes('سقف')));
 assert(!kpiTrend({snapshots,overrides:[{RuleCode:'EWS-03',ThresholdValue:95}]}).emergingFa.some(s=>s.includes('سقف')));
 for(const IsEnabled of [false,0,'0']) assert(!kpiTrend({snapshots,overrides:[{RuleCode:'EWS-03',IsEnabled}]}).emergingFa.some(s=>s.includes('سقف')));
});
test('lower-bound gap warning is detected even if generic KPI direction calls decrease improving',()=>{
 const trend=kpiTrend({snapshots:[row('2026-01',null,{VariancePct:-8}),row('2026-02',null,{VariancePct:-12})]});
 assert(trend.emergingFa.some(s=>s.includes('تأییدنشده')));
});
test('expiring guarantees participate in stored trends; unreliable gap does not',()=>{
 const trend=kpiTrend({snapshots:[row('2026-01',null,{ExpiringGuaranteeCount:1,VariancePct:2,IsGapReliable:true}),row('2026-02',null,{ExpiringGuaranteeCount:3,VariancePct:30,IsGapReliable:false})]});
 assert.equal(trend.trends.find(x=>x.code==='expiring_guarantee_count').current,3);
 assert.equal(trend.trends.find(x=>x.code==='progress_gap_pct').current,null);
});
test('current-period snapshots reject past, future, malformed, and alternate-calendar labels',()=>{
 const now=new Date('2026-10-25T12:00:00Z');assert.equal(currentMetricPeriod(now),'2026-10');assert(validMetricPeriod('2026-10',now));
 for(const p of ['2026-09','2026-11','1405-08','2026-13','2026-1',null]) assert(!validMetricPeriod(p,now));
});
test('curve agrees with approved financial progress and never treats snapshots as a baseline',()=>{
 const ipcs=[{PeriodCode:'2026-01',WorkflowState:'approved',GrossCumulative:100},{PeriodCode:'2026-02',WorkflowState:'paid',GrossCumulative:250},{PeriodCode:'2026-02',WorkflowState:'approved',GrossCumulative:900,Status:'cancelled'},{PeriodCode:'2026-03',WorkflowState:'draft',GrossCumulative:999}];
 const c=contractActualCurve(1000,ipcs);assert.equal(c.latest.actualPct,25);assert.equal(c.points.length,2);assert.equal(c.latest.plannedPct,null);assert.equal(c.latest.variancePct,null);assert.equal(c.maxLagPct,null);assert.equal(c.hasPlan,false);assert(c.warningsFa.some(s=>s.includes('برنامه')));
});
test('empty curve is explicitly empty',()=>{const c=contractActualCurve(1000,[]);assert.deepEqual(c.points,[]);assert.equal(c.latest,null);});
test('no physical source or incomplete BOQ is not a reliable payment gap',()=>{
 assert.equal(progressSnapshot({contractAmount:1000}).isGapReliable,false);
 const p=progressSnapshot({contractAmount:1000,boq:[{Id:'b',LineAmount:100,ContractQty:10,UnitRate:10,Status:'active'}]});assert.equal(p.isGapReliable,false);
 const paid=progressSnapshot({contractAmount:1000,boq:[{Id:'b',LineAmount:100,ContractQty:10,UnitRate:10,Status:'active'}],ipcs:[{WorkflowState:'approved',GrossCumulative:500}]});assert(!paid.warningsFa.some(w=>w.includes('اضافه‌پرداخت محتمل')));
});
test('progress report reads nested gap and ceiling consistently with live snapshot',()=>{
 const report=buildCntReport('RPT-CNT-PRG',{contract:{Code:'C',TitleFa:'پیمان'},progress:{physicalPct:20,financialPct:30,gap:{gapPct:10},financial:{ceilingUsedPct:24},isGapReliable:true},sCurve:[{periodCode:'2026-01',plannedPct:null,actualPct:30,isForecast:false}]});
 const cells=report.sections.find(s=>s.kind==='kpi'&&s.title.fa==='پیشرفت').cells;assert(cells.some(c=>String(c.value).includes('10')));assert(cells.some(c=>String(c.value).includes('24')));
 assert(report.sections.some(s=>s.kind==='text'&&s.title.fa==='محدودیت منحنی'));
 const curve=report.sections.find(s=>s.kind==='table');assert.equal(curve.rows[0].physical,'—');
});
