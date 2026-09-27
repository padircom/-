/** LIVE-6: versioned internal BSC and nine-criterion self-assessment.
 * No sample observations, official EFQM award levels or implicit missing=zero scores.
 */
import { PERSPECTIVES } from './strategy';
import { EFQM_CRITERIA } from './efqm';
export { PERSPECTIVES, EFQM_CRITERIA };
export const STRATEGY_MODEL = 'bsc-internal-v1';
export const EXCELLENCE_MODEL = 'internal-9criteria-v1';
export type StrategyKpi = { Code:string; TitleFa:string; Unit:string; Baseline:number; Target:number; Actual:number|null; Direction:'up'|'down'; Weight:number };
export type StrategyObjective = { Code:string; TitleFa:string; Perspective:string; Weight:number; Kpis:StrategyKpi[] };
export type StrategyInitiative = { Code:string; TitleFa:string; ObjectiveCodes:string[]; Progress:number|null; Budget:number|null; Spent:number|null; Currency:string; Status:'on_track'|'at_risk'|'delayed'|'completed' };
export type StrategyInput = { Code:string; TitleFa:string; DataDate:string; Objectives:StrategyObjective[]; Initiatives:StrategyInitiative[] };
export type CriterionInput = { a:number|null; b:number|null; evidence:string; strengths:string; improvements:string };
export type ExcellenceInput = { Code:string; TitleFa:string; DataDate:string; Scores:Record<string,CriterionInput>; Notes:string };
export type Persisted<T> = T & { Id:string; ProjectId:string; RowVersion:number; ModelVersion:string; CreatedAt:string; CreatedBy:string; UpdatedAt?:string; UpdatedBy?:string };
export class WorkspaceValidationError extends Error { code='SX_VALIDATION'; status=400; }
function bad(message:string):never { throw new WorkspaceValidationError(message); }
function record(v:unknown):Record<string,unknown> {
  if(!v||typeof v!=='object'||Array.isArray(v))bad('ساختار رکورد نامعتبر است');
  return v as Record<string,unknown>;
}
function keys(v:Record<string,unknown>, allowed:string[]) {
  const unknown=Object.keys(v).find(k=>!allowed.includes(k));if(unknown)bad(`فیلد مجاز نیست: ${unknown}`);
}
function text(v:unknown,label:string,max=300,required=true):string {
  if(!required&&(v===undefined||v===null))return '';
  if(typeof v!=='string'||v.length>max||required&&!v.trim())bad(`${label}: متن معتبر حداکثر ${max} نویسه لازم است`);
  return v.trim();
}
function code(v:unknown):string {const s=text(v,'کد',40).toUpperCase();if(!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s))bad('کد باید با حرف یا رقم لاتین شروع شود');return s;}
function number(v:unknown,label:string,min=-1e12,max=1e12,nullable=false):number|null {
  if(nullable&&(v===null||v===undefined))return null;
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)bad(`${label}: عدد بین ${min} و ${max} لازم است`);
  return v;
}
function list(v:unknown,label:string,max:number):unknown[] {if(!Array.isArray(v)||v.length>max)bad(`${label}: آرایه با حداکثر ${max} مورد لازم است`);return v;}
function unique(values:string[],label:string) {if(new Set(values).size!==values.length)bad(`${label}: کد تکراری است`);}
function choice<T extends string>(v:unknown,allowed:readonly T[],label:string):T {if(typeof v!=='string'||!allowed.includes(v as T))bad(`${label}: مقدار مجاز نیست`);return v as T;}
export function inputDate(value:unknown):string {
  const s=value instanceof Date&&Number.isFinite(value.getTime())?value.toISOString().slice(0,10):value;
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)bad('تاریخ داده معتبر نیست');
  return s;
}
export const STRATEGY_FIELDS=['Code','TitleFa','DataDate','Objectives','Initiatives'];
export const EXCELLENCE_FIELDS=['Code','TitleFa','DataDate','Scores','Notes'];
export function normalizeStrategy(value:unknown):StrategyInput {
  const v=record(value);keys(v,STRATEGY_FIELDS);
  const Objectives=list(v.Objectives,'اهداف',30).map(value=>{
    const o=record(value);keys(o,['Code','TitleFa','Perspective','Weight','Kpis']);
    const Kpis=list(o.Kpis,'شاخص‌ها',20).map(value=>{
      const k=record(value);keys(k,['Code','TitleFa','Unit','Baseline','Target','Actual','Direction','Weight']);
      const Baseline=number(k.Baseline,'مبنا')!,Target=number(k.Target,'هدف')!;
      const Direction=choice(k.Direction,['up','down'] as const,'جهت');
      if(Direction==='up'?Target<=Baseline:Target>=Baseline)bad('هدف باید در جهت انتخاب‌شده از مبنا فاصله داشته باشد');
      return {Code:code(k.Code),TitleFa:text(k.TitleFa,'عنوان شاخص'),Unit:text(k.Unit,'واحد',40),Baseline,Target,Actual:number(k.Actual,'واقعی',-1e12,1e12,true),Direction,Weight:number(k.Weight,'وزن شاخص',0.001,100)!};
    });
    unique(Kpis.map(k=>k.Code),'شاخص‌های هر هدف');
    return {Code:code(o.Code),TitleFa:text(o.TitleFa,'عنوان هدف'),Perspective:choice(o.Perspective,PERSPECTIVES.map(p=>p.code),'منظر'),Weight:number(o.Weight,'وزن هدف',0.001,100)!,Kpis};
  });
  unique(Objectives.map(o=>o.Code),'اهداف');
  const codes=new Set(Objectives.map(o=>o.Code));
  const Initiatives=list(v.Initiatives,'ابتکارات',100).map(value=>{
    const i=record(value);keys(i,['Code','TitleFa','ObjectiveCodes','Progress','Budget','Spent','Currency','Status']);
    const ObjectiveCodes=list(i.ObjectiveCodes,'اهداف پشتیبانی‌شده',30).map(code);unique(ObjectiveCodes,'پیوند هدف');
    if(!ObjectiveCodes.length||ObjectiveCodes.some(c=>!codes.has(c)))bad('هر ابتکار باید به هدف موجود در همین برنامه پیوند داشته باشد');
    const Currency=text(i.Currency,'ارز',3);if(!/^[A-Z]{3}$/.test(Currency))bad('کد ارز سه حرف بزرگ لاتین است');
    const Progress=number(i.Progress,'پیشرفت',0,100,true),Status=choice(i.Status,['on_track','at_risk','delayed','completed'] as const,'وضعیت');
    if(Status==='completed'&&Progress!==100)bad('ابتکار تکمیل‌شده باید پیشرفت ۱۰۰ داشته باشد');
    return {Code:code(i.Code),TitleFa:text(i.TitleFa,'عنوان ابتکار'),ObjectiveCodes,Progress,Budget:number(i.Budget,'بودجه',0,1e12,true),Spent:number(i.Spent,'هزینه',0,1e12,true),Currency,Status};
  });
  unique(Initiatives.map(i=>i.Code),'ابتکارات');
  return {Code:code(v.Code),TitleFa:text(v.TitleFa,'عنوان برنامه'),DataDate:inputDate(v.DataDate),Objectives,Initiatives};
}
export function emptyCriterion():CriterionInput {return {a:null,b:null,evidence:'',strengths:'',improvements:''};}
export function normalizeExcellence(value:unknown):ExcellenceInput {
  const v=record(value);keys(v,EXCELLENCE_FIELDS);const scores=record(v.Scores);keys(scores,EFQM_CRITERIA.map(c=>c.code));
  const Scores=Object.fromEntries(EFQM_CRITERIA.map(c=>{
    const s=scores[c.code]===undefined?{}:record(scores[c.code]);keys(s,['a','b','evidence','strengths','improvements']);
    return [c.code,{a:number(s.a,'بُعد اول',0,100,true),b:number(s.b,'بُعد دوم',0,100,true),evidence:text(s.evidence,'مرجع شاهد',2000,false),strengths:text(s.strengths,'نقاط قوت',2000,false),improvements:text(s.improvements,'فرصت بهبود',2000,false)}];
  }));
  return {Code:code(v.Code),TitleFa:text(v.TitleFa,'عنوان ارزیابی'),DataDate:inputDate(v.DataDate),Scores,Notes:text(v.Notes,'یادداشت',6000,false)};
}
const mean=(values:{value:number|null;weight:number}[])=>!values.length||values.some(v=>v.value===null)?null:values.reduce((n,v)=>n+v.value!*v.weight,0)/values.reduce((n,v)=>n+v.weight,0);
export function strategyMetrics(plan:StrategyInput) {
  const objectives=plan.Objectives.map(o=>{
    const kpis=o.Kpis.map(k=>({code:k.Code,attainment:k.Actual===null?null:Math.max(0,Math.min(1,(k.Actual-k.Baseline)/(k.Target-k.Baseline)))}));
    const attainment=mean(kpis.map((k,n)=>({value:k.attainment,weight:o.Kpis[n].Weight})));
    return {code:o.Code,attainment,kpis};
  });
  const perspectives=PERSPECTIVES.map(p=>({code:p.code,weight:p.weight,attainment:mean(plan.Objectives.flatMap((o,n)=>o.Perspective===p.code?[{value:objectives[n].attainment,weight:o.Weight}]:[]))}));
  const currencies=[...new Set(plan.Initiatives.map(i=>i.Currency))].map(currency=>{
    const items=plan.Initiatives.filter(i=>i.Currency===currency);
    const budget=items.some(i=>i.Budget===null)?null:items.reduce((n,i)=>n+i.Budget!,0);
    const spent=items.some(i=>i.Spent===null)?null:items.reduce((n,i)=>n+i.Spent!,0);
    return {currency,budget,spent,utilisation:budget===null||spent===null||budget===0?null:spent/budget};
  });
  return {modelVersion:STRATEGY_MODEL,attainment:mean(perspectives.map(p=>({value:p.attainment,weight:p.weight}))),objectives,perspectives,currencies,
    offTrack:objectives.filter(o=>o.attainment!==null&&o.attainment<.9).length,unknownObjectives:objectives.filter(o=>o.attainment===null).length,
    activeInitiatives:plan.Initiatives.filter(i=>i.Status!=='completed').length};
}
export function excellenceMetrics(input:ExcellenceInput) {
  const lines=EFQM_CRITERIA.map(c=>{
    const s=input.Scores[c.code]??emptyCriterion();
    return {code:c.code,kind:c.kind,weight:c.weight,points:s.a===null||s.b===null?null:Math.round(((s.a+s.b)/2)*c.weight/100),hasEvidence:Boolean(s.evidence.trim())};
  });
  const complete=lines.every(l=>l.points!==null&&l.hasEvidence);
  const group=(kind:string)=>{const items=lines.filter(l=>l.kind===kind);return items.every(l=>l.points!==null&&l.hasEvidence)?items.reduce((n,l)=>n+l.points!,0):null;};
  return {modelVersion:EXCELLENCE_MODEL,lines,complete,total:complete?lines.reduce((n,l)=>n+l.points!,0):null,maxTotal:1000,enablers:group('enabler'),results:group('result'),scored:lines.filter(l=>l.points!==null).length,evidenced:lines.filter(l=>l.hasEvidence).length};
}
export type StrategyRecord = Persisted<StrategyInput> & { metrics:ReturnType<typeof strategyMetrics> };
export type ExcellenceRecord = Persisted<ExcellenceInput> & { metrics:ReturnType<typeof excellenceMetrics> };
export type SxWorkspace<T> = { projectId:string; canEdit:boolean; records:T[]; generatedAt:string; modelVersion:string };
