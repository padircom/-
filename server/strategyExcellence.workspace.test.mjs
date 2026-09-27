import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStrategy,normalizeExcellence,strategyMetrics,excellenceMetrics,inputDate,STRATEGY_MODEL,EXCELLENCE_MODEL,EFQM_CRITERIA,PERSPECTIVES} from './sxWsLogic.js';
import {strategyInput,excellenceInput} from './sxTestFixtures.mjs';
import {SCHEMA,MIGRATIONS,validateSchema} from './sqlLogic.js';
import {TABLE_ACCESS} from './dataAccess.js';
import {DEMO_SUBJECTS,evaluate,PERMISSION_CATALOG} from './rbacLogic.js';
import {registerStrategyExcellenceRoutes,SX_POLICIES} from './strategyExcellenceWorkspaceApi.js';
const fails=f=>assert.throws(f,e=>e.code==='SX_VALIDATION');
test('LIVE-6: empty strategic plans have unknown attainment, no seeded objectives or initiatives',()=>{
  const p=normalizeStrategy({...strategyInput(),Objectives:[],Initiatives:[]});const m=strategyMetrics(p);
  assert.equal(m.attainment,null);assert.equal(m.activeInitiatives,0);assert.equal(m.objectives.length,0);assert.ok(m.perspectives.every(p=>p.attainment===null));
});
test('LIVE-6: upward and downward KPIs use baseline-to-target attainment and clamp to 0..1',()=>{
  const p=strategyInput();p.Objectives[0].Kpis[0]={...p.Objectives[0].Kpis[0],Baseline:100,Target:50,Actual:75,Direction:'down'};
  assert.equal(strategyMetrics(normalizeStrategy(p)).objectives[0].attainment,.5);
  p.Objectives[0].Kpis[0].Actual=0;assert.equal(strategyMetrics(normalizeStrategy(p)).objectives[0].attainment,1);
  p.Objectives[0].Kpis[0].Actual=150;assert.equal(strategyMetrics(normalizeStrategy(p)).objectives[0].attainment,0);
});
test('LIVE-6: missing actual is not zero and blocks an otherwise partial strategic total',()=>{
  const p=strategyInput();p.Objectives[0].Kpis[0].Actual=null;
  const m=strategyMetrics(normalizeStrategy(p));assert.equal(m.objectives[0].attainment,null);assert.equal(m.unknownObjectives,1);assert.equal(m.offTrack,0);assert.equal(m.attainment,null);
  p.Objectives[0].Kpis[0].Actual=0;assert.equal(strategyMetrics(normalizeStrategy(p)).objectives[0].attainment,0);
});
test('LIVE-6: all four perspectives are required; real objective/KPI weights are normalized',()=>{
  const p=strategyInput();p.Initiatives=[];const o=p.Objectives[0];p.Objectives=PERSPECTIVES.map((pers,n)=>({...structuredClone(o),Code:'O'+n,Perspective:pers.code}));
  assert.equal(strategyMetrics(normalizeStrategy(p)).attainment,.5);
  p.Objectives[0].Kpis.push({...o.Kpis[0],Code:'K2',Actual:100,Weight:3});
  const m=strategyMetrics(normalizeStrategy(p));assert.equal(m.objectives[0].attainment,.875);assert.equal(m.attainment,.6125);
});
test('LIVE-6: non-finite, string, zero-weight and contradictory direction/target inputs are rejected',()=>{
  for(const change of [{Actual:Infinity},{Baseline:'0'},{Weight:0},{Weight:-1},{Target:0},{Target:-20},{Direction:'sideways'}]){const p=strategyInput();Object.assign(p.Objectives[0].Kpis[0],change);fails(()=>normalizeStrategy(p));}
});
test('LIVE-6: initiative links are local to a plan; orphaned/deleted/duplicate objectives cannot be saved',()=>{
  for(const ObjectiveCodes of [[],['OTHER'],['O1','O1']]){const p=strategyInput();p.Initiatives[0].ObjectiveCodes=ObjectiveCodes;fails(()=>normalizeStrategy(p));}
  const p=strategyInput();p.Objectives.push(structuredClone(p.Objectives[0]));fails(()=>normalizeStrategy(p));
});
test('LIVE-6: initiative progress, money, currency and completed state are validated',()=>{
  for(const patch of [{Progress:101},{Budget:-1},{Spent:NaN},{Currency:'usd'},{Status:'completed'},{Status:'made_up'}]){const p=strategyInput();Object.assign(p.Initiatives[0],patch);fails(()=>normalizeStrategy(p));}
});
test('LIVE-6: currencies are never summed together; missing budgets and zero denominator remain unknown',()=>{
  const p=strategyInput();p.Initiatives.push({...p.Initiatives[0],Code:'I2',Currency:'USD',Budget:null,Spent:10});
  const m=strategyMetrics(normalizeStrategy(p));assert.equal(m.currencies.length,2);assert.equal(m.currencies[0].budget,100);assert.equal(m.currencies[0].utilisation,.25);assert.equal(m.currencies[1].budget,null);assert.equal(m.currencies[1].utilisation,null);
  p.Initiatives[0].Budget=0;assert.equal(strategyMetrics(normalizeStrategy(p)).currencies[0].utilisation,null);
});
test('LIVE-6: empty and partially assessed criteria do not manufacture a total of zero',()=>{
  const empty=excellenceMetrics(normalizeExcellence({...excellenceInput(),Scores:{}}));assert.equal(empty.total,null);assert.equal(empty.scored,0);assert.equal(empty.complete,false);
  const m=excellenceMetrics(normalizeExcellence(excellenceInput()));assert.equal(m.scored,1);assert.equal(m.total,null);assert.equal(m.lines[0].points,50);assert.equal(m.lines[1].points,null);
});
test('LIVE-6: complete evidenced zero scores yield genuine zero; complete 100 scores yield 1000',()=>{
  for(const value of [0,100]){const p=excellenceInput();p.Scores=Object.fromEntries(EFQM_CRITERIA.map(c=>[c.code,{a:value,b:value,evidence:'DOC',strengths:'',improvements:''}]));const m=excellenceMetrics(normalizeExcellence(p));assert.equal(m.complete,true);assert.equal(m.total,value*10);assert.equal(m.enablers,value*5);assert.equal(m.results,value*5);assert.equal('level' in m,false);}
});
test('LIVE-6: all numeric axes without evidence still do not produce a complete score',()=>{
  const p=excellenceInput();p.Scores=Object.fromEntries(EFQM_CRITERIA.map(c=>[c.code,{a:50,b:50,evidence:''}]));
  const m=excellenceMetrics(normalizeExcellence(p));assert.equal(m.scored,9);assert.equal(m.evidenced,0);assert.equal(m.total,null);
});
test('LIVE-6: EFQM axes, unknown criteria, extra fields and oversized evidence are rejected',()=>{
  for(const Scores of [{C1:{a:-1}},{C1:{b:101}},{C1:{a:NaN}},{C1:{a:'50'}},{C1:{a:0,approved:true}},{C10:{a:1}},{C1:{evidence:'x'.repeat(2001)}},[]])fails(()=>normalizeExcellence({...excellenceInput(),Scores}));
});
test('LIVE-6: canonical dates, text limits and unknown client-owned fields are validated',()=>{
  assert.equal(inputDate(new Date('2026-09-01')),'2026-09-01');
  for(const v of ['2026-02-31','2026-09-01garbage',new Date('invalid')])fails(()=>inputDate(v));
  for(const patch of [{ProjectId:'spoof'},{Code:'bad code'},{TitleFa:' '},{TitleFa:'x'.repeat(301)}])fails(()=>normalizeStrategy({...strategyInput(),...patch}));
});
test('LIVE-6: child collection limits are enforced before expensive persistence work',()=>{
  fails(()=>normalizeStrategy({...strategyInput(),Objectives:Array(31).fill({})}));
  fails(()=>normalizeStrategy({...strategyInput(),Initiatives:Array(101).fill({})}));
  const p=strategyInput();p.Objectives[0].Kpis=Array(21).fill(p.Objectives[0].Kpis[0]);fails(()=>normalizeStrategy(p));
});
test('LIVE-6: computations are deterministic and preserve the declared data',()=>{
  const raw=strategyInput(),before=JSON.stringify(raw),p=normalizeStrategy(raw);assert.deepEqual(strategyMetrics(p),strategyMetrics(p));assert.equal(JSON.stringify(raw),before);assert.equal(strategyMetrics(p).modelVersion,STRATEGY_MODEL);assert.equal(excellenceMetrics(normalizeExcellence(excellenceInput())).modelVersion,EXCELLENCE_MODEL);
});
test('LIVE-6: both aggregate tables have an additive migration and are not exposed through generic CRUD',()=>{
  assert.deepEqual(validateSchema(),[]);const m=MIGRATIONS.find(m=>m.version==='0037');assert.ok(m);
  for(const name of ['StrategyPlan','ExcellenceAssessment']){assert.ok(SCHEMA.some(t=>t.name===name));assert.ok(m.statements.some(s=>s.includes(`[dbo].[${name}]`)));assert.equal(TABLE_ACCESS[name],undefined);}
});
test('LIVE-6: explicit permissions let PMO edit and PM read, without widening system administrator access',()=>{
  const codes=new Set(PERMISSION_CATALOG.map(p=>p.code));
  for(const p of SX_POLICIES){assert.ok(codes.has(p.view));assert.ok(codes.has(p.edit));for(const [id,view,edit] of [['u-pmo',true,true],['u-pm',true,false],['u-admin',false,false],['u-planner',false,false]]){const s=DEMO_SUBJECTS.find(s=>s.id===id);assert.equal(evaluate(s,p.view,{projectId:'c1-p1'}).allow,view);assert.equal(evaluate(s,p.edit,{projectId:'c1-p1'}).allow,edit);}}
});
async function invoke(path,method,{user='u-pmo',project='c1-p1',body,repository}={}) {
  const handlers=new Map();registerStrategyExcellenceRoutes(Object.fromEntries(['get','post','patch'].map(m=>[m,(url,h)=>handlers.set(m+url,h)])),{repo:async()=>repository,subjects:DEMO_SUBJECTS,evaluate});
  const h=handlers.get(method+path);assert.ok(h);let status=200,response,nextError;
  const res={set(){return this;},status(n){status=n;return this;},json(v){response=v;return this;}};
  await h({params:{projectId:project,id:'test'},headers:user?{'x-user-id':user}:{},body,requestId:'test'},res,e=>{nextError=e;});return {status,response,nextError};
}
test('LIVE-6 API: a failed repository never looks like a successfully loaded empty workspace',async()=>{
  const e=new Error('storage offline');const r=await invoke('/api/spm/:projectId/workspace','get',{repository:{list:async()=>{throw e;}}});assert.equal(r.nextError,e);assert.equal(r.response,undefined);
});
test('LIVE-6 API: oversized workspaces fail explicitly instead of returning incomplete metrics',async()=>{
  const r=await invoke('/api/spm/:projectId/workspace','get',{repository:{list:async()=>Array(101).fill({})}});assert.equal(r.status,409);assert.equal(r.response.error.code,'SX_LIST_LIMIT');
});
test('LIVE-6 API: unsupported stored models and corrupted payloads never get silently re-scored',async()=>{
  for(const row of [{...strategyInput(),ModelVersion:'new-future-model'},{...strategyInput(),ModelVersion:STRATEGY_MODEL,Objectives:'bad'}]){const r=await invoke('/api/spm/:projectId/workspace','get',{repository:{list:async()=>[row]}});assert.equal(r.status,409);assert.ok(['SX_MODEL_VERSION','SX_STORED_INVALID'].includes(r.response.error.code));}
});
test('LIVE-6 API: a capacity rejection occurs before any write',async()=>{
  const r=await invoke('/api/spm/:projectId/plans','post',{body:strategyInput(),repository:{list:async()=>Array.from({length:100},(_,i)=>({Id:String(i)})),create:()=>assert.fail('must not write')}});assert.equal(r.status,409);assert.equal(r.response.error.code,'SX_CAPACITY');
});
test('LIVE-6 API: audit failure does not falsely acknowledge a fully successful save',async()=>{
  let writes=0;const r=await invoke('/api/spm/:projectId/plans','post',{body:strategyInput(),repository:{list:async()=>[],create:async(table,data)=>{if(table==='AuditLog')throw new Error('audit offline');writes++;return {...data,Id:'saved',RowVersion:1};}}});
  assert.equal(writes,1);assert.equal(r.status,503);assert.equal(r.response.error.code,'SX_AUDIT_FAILED');
});
test('LIVE-6: business codes are canonical across case-sensitive JSON and common SQL collations',()=>{
  const p=strategyInput('plan');p.Objectives[0].Code='o1';p.Initiatives[0].ObjectiveCodes=['o1'];const normalized=normalizeStrategy(p);
  assert.equal(normalized.Code,'PLAN');assert.equal(normalized.Objectives[0].Code,'O1');assert.deepEqual(normalized.Initiatives[0].ObjectiveCodes,['O1']);
  p.Objectives.push({...structuredClone(p.Objectives[0]),Code:'O1'});fails(()=>normalizeStrategy(p));
});
test('LIVE-6 API: over-size write payload is rejected before storage is read or modified',async()=>{
  const r=await invoke('/api/oex/:projectId/assessments','post',{body:{...excellenceInput(),Notes:'x'.repeat(1000001)},repository:{list:()=>assert.fail('must not read'),create:()=>assert.fail('must not write')}});
  assert.equal(r.status,413);assert.equal(r.response.error.code,'SX_SIZE');
});
