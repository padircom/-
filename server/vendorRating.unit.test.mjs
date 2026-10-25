import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreEvaluation, dateOnly, ratingHistory, improvementTransition } from './vendorEvaluationLogic.js';
import { DEMO_SUBJECTS, evaluate } from './rbacLogic.js';
const scores = { hse: 90, quality: 80, time: 70, price: 60, docs: 50, coop: 40 };
test('six axes preserve existing weighted formula and grade', () => {
  assert.deepEqual(scoreEvaluation(scores), { Scores: scores, Weighted: 69, Grade: 'C', Weakest: 'coop' });
  for (const [score, grade] of [[85,'A'],[70,'B'],[55,'C'],[54,'D'],[0,'D'],[100,'A']]) assert.equal(scoreEvaluation(Object.fromEntries(Object.keys(scores).map(k=>[k,score]))).Grade,grade);
});
for (const bad of [null, [], {}, {...scores,hse:-1}, {...scores,hse:101}, {...scores,hse:'80'}, {...scores,hse:Infinity}, {...scores,hse:NaN}, {...scores,x:1}]) test('reject invalid scores '+JSON.stringify(bad),()=>assert.throws(()=>scoreEvaluation(bad),{status:422}));
test('validates real calendar date',()=>{assert.equal(dateOnly('2024-02-29'),'2024-02-29');for(const d of ['2026-02-29','2026-02-30','2026-01-01T00:00:00Z','',true]) assert.throws(()=>dateOnly(d),{status:422});});
test('history ignores unapproved data; chronological insertion and isolated source groups',()=>{
  const row=(SourceId,PeriodDate,Weighted,Status='approved',SourceKind='contract')=>({SourceId,PeriodDate,Weighted,Status,SourceKind});
  const h=ratingHistory([row('a','2026-02-01',80),row('a','2026-01-01',50),row('a','2026-03-01',99,'submitted'),row('b','2026-02-01',90),row('a','2026-02-01',30,'approved','purchase_order')]);
  assert.equal(h.length,4);assert.equal(h.find(r=>r.Weighted===80).Trend,30);assert.equal(h.find(r=>r.Weighted===50).Latest,false);assert.equal(h.filter(r=>r.Trend===null).length,3);
});
test('improvement state machine evidence and independent verification',()=>{
  assert.equal(improvementTransition({Status:'open'},'start','author').Status,'in_progress');
  assert.throws(()=>improvementTransition({Status:'open'},'complete','author','proof'),{status:409});
  assert.throws(()=>improvementTransition({Status:'in_progress'},'complete','author',''),{status:422});
  assert.equal(improvementTransition({Status:'in_progress'},'complete','author','proof').CompletedBy,'author');
  assert.throws(()=>improvementTransition({Status:'completed',CompletedBy:'author'},'verify','author'),{status:403});
  assert.equal(improvementTransition({Status:'completed',CompletedBy:'author'},'verify','approver').Status,'verified');
  assert.equal(improvementTransition({Status:'completed'},'reopen','approver','not effective').Status,'in_progress');
  for(const Status of ['verified','cancelled']) for(const action of ['start','complete','verify','cancel']) assert.throws(()=>improvementTransition({Status},action,'x','proof'),{status:409});
});
test('authoring and approval permissions are separate and project-scoped',()=>{
  const can=(id,p,projectId='c1-p1')=>evaluate(DEMO_SUBJECTS.find(u=>u.id===id),p,{projectId}).allow;
  assert(can('u-contracts','cnt.rating.edit'));assert(!can('u-contracts','cnt.rating.approve'));
  assert(can('u-pm','cnt.rating.approve'));assert(!can('u-pm','cnt.rating.edit'));
  assert(!can('u-planner','cnt.rating.edit'));assert(!can('u-planner','cnt.rating.approve'));
  assert(!can('u-contracts','cnt.rating.edit','c9-p9'));
});
