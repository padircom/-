import { RATING_AXES, rateParty, type AxisCode } from './vendorRating';
export { RATING_AXES };
export class RatingError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const fail = (status: number, message: string): never => { throw new RatingError(status, `E-CNT-RATING-${status}`, message); };
export function text(v: unknown, max: number): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) fail(422, 'متن الزامی یا طول آن نامعتبر است');
  return (v as string).trim();
}
export function dateOnly(v: unknown): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) fail(422, 'تاریخ نامعتبر است');
  return v as string;
}
export const isoDate = (v: string | Date) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
export function scoreEvaluation(scores: unknown) {
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) fail(422, 'امتیاز شش محور الزامی است');
  const s = scores as Record<AxisCode, number>;
  if (Object.keys(s).length !== 6 || RATING_AXES.some(a => typeof s[a.code] !== 'number' || !Number.isFinite(s[a.code]) || s[a.code] < 0 || s[a.code] > 100)) fail(422, 'هر شش امتیاز باید عددی بین صفر و صد باشند');
  const result = rateParty({ id: '', name: { fa: '', en: '' }, kind: 'contractor', scores: s, contractValue: 0, active: true });
  return { Scores: s, Weighted: result.weighted, Grade: result.grade, Weakest: result.weakest };
}
export type Evaluation = { Id: string; SourceKind: string; SourceId: string; PartyName: string; SourceCode: string; PeriodDate: string; Weighted: number; Grade: string; Weakest: string; Status: string; CreatedBy: string; RowVersion: number; DocumentRef: string; Scores: Record<AxisCode, number>; DecisionNote?: string };
export function ratingHistory<T extends { SourceKind: string; SourceId: string; PeriodDate: string | Date; Status: string; Weighted: number }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) if (row.Status === 'approved') {
    const key = `${row.SourceKind}:${row.SourceId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].flatMap(group => group.sort((a, b) => isoDate(a.PeriodDate).localeCompare(isoDate(b.PeriodDate))).map((row, i, all) => ({ ...row, Trend: i ? row.Weighted - all[i - 1].Weighted : null, Latest: i === all.length - 1 }))).sort((a, b) => isoDate(b.PeriodDate).localeCompare(isoDate(a.PeriodDate)));
}
export type Improvement = { Id: string; EvaluationId: string; Axis: string; TitleFa: string; OwnerId: string; DueDate: string; Status: string; RowVersion: number; Evidence?: string; CompletedBy?: string };
export function improvementTransition(row: { Status: string; CompletedBy?: string }, action: unknown, actor: string, evidence: unknown) {
  if (action === 'start' && row.Status === 'open') return { Status: 'in_progress' };
  if (action === 'complete' && row.Status === 'in_progress') return { Status: 'completed', Evidence: text(evidence, 2000), CompletedBy: actor };
  if (action === 'verify' && row.Status === 'completed') {
    if (!row.CompletedBy || row.CompletedBy === actor) fail(403, 'تأییدکننده نباید ثبت‌کنندهٔ انجام اقدام باشد');
    return { Status: 'verified', VerifiedBy: actor, VerifiedAt: new Date().toISOString() };
  }
  if (action === 'reopen' && row.Status === 'completed') return { Status: 'in_progress', Evidence: text(evidence, 2000), CompletedBy: null };
  if (action === 'cancel' && ['open', 'in_progress'].includes(row.Status)) return { Status: 'cancelled', Evidence: text(evidence, 2000) };
  return fail(409, 'این تغییر وضعیت مجاز نیست');
}
