/** LIVE-3: shared validation/calculations. No synthetic schedule or monetary data. */
import { IMPACT_DIMS, RBS } from './rcc';
export type RccKind = 'risks' | 'changes' | 'claims';
export type RccRow = { Id: string; Code: string; TitleFa: string; Status: string; RowVersion: number; [key: string]: unknown };
export type RccWorkspace = { projectId: string; today: string; risks: RccRow[]; changes: RccRow[]; claims: RccRow[]; claimsHidden: boolean; risksHidden: boolean; changesHidden: boolean; permissions: string[] };
export const RCC_PERMISSIONS = ['rcc.risk.view', 'rcc.risk.edit', 'rcc.change.raise', 'rcc.change.approve', 'rcc.claim.view', 'rcc.claim.edit', 'rcc.claim.submit'];
export const RCC_TABLES = { risks: 'Risk', changes: 'ChangeRequest', claims: 'Claim' } as const;
export class RccValidationError extends Error {}
const bad = (message: string): never => { throw new RccValidationError(message); };
export function isoDay(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return bad('تاریخ میلادی معتبر لازم است');
  return value;
}
function text(input: Record<string, unknown>, key: string, max: number, required = false): string {
  const v = input[key] ?? '';
  if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim())) return bad(`فیلد ${key} نامعتبر یا خالی است`);
  return v.trim();
}
function number(input: Record<string, unknown>, key: string, min: number, max: number, integer = false): number {
  const v = input[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) return bad(`عدد ${key} نامعتبر است`);
  return v;
}
export function normalizeRcc(kind: RccKind, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { Code: text(b, 'Code', 40, true), TitleFa: text(b, 'TitleFa', 400, true) };
  if (!/^[\p{L}\p{N}_.\-/]+$/u.test(String(out.Code))) bad('کد باید بدون فاصله باشد');
  if (kind === 'risks') {
    out.Category = text(b, 'Category', 40, true);
    if (!RBS.some(r => r.code === out.Category)) bad('دستهٔ ریسک معتبر نیست');
    out.Probability = number(b, 'Probability', 1, 5, true);
    out.Impact = number(b, 'Impact', 1, 5, true);
    out.Score = Number(out.Probability) * Number(out.Impact);
    out.Owner = text(b, 'Owner', 120, true);
    for (const k of ['Cause', 'Event', 'Effect', 'Response']) out[k] = text(b, k, 1000);
    out.SourceRef = text(b, 'SourceRef', 200);
    out.Status = b.Status ?? 'open';
    if (!['open', 'mitigated', 'accepted'].includes(String(out.Status))) bad('وضعیت ریسک نامعتبر است');
  } else if (kind === 'changes') {
    out.Reason = text(b, 'Reason', 1000, true);
    out.CostImpact = number(b, 'CostImpact', -1e15, 1e15);
    out.TimeImpactDays = number(b, 'TimeImpactDays', -36500, 36500, true);
    const assessment = b.Assessment;
    if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) bad('ارزیابی اثر لازم است');
    out.Assessment = Object.fromEntries(IMPACT_DIMS.map(k => [k, (assessment as Record<string, unknown>)[k] === true]));
  } else {
    out.EventDate = isoDay(b.EventDate);
    out.NoticeDays = number(b, 'NoticeDays', 1, 3650, true);
    out.Amount = number(b, 'Amount', 0, 1e15);
    out.ExtensionDays = number(b, 'ExtensionDays', 0, 36500, true);
    for (const k of ['Entitlement', 'Causation', 'QuantumNote', 'EvidenceRef']) out[k] = text(b, k, 1000);
    out.Clause = text(b, 'Clause', 200, true);
    out.BaselineId = text(b, 'BaselineId', 60);
    out.DataDate = b.DataDate ? isoDay(b.DataDate) : null;
  }
  return out;
}
export function noticeState(row: Record<string, unknown>, today: string) {
  if (!row.EventDate || !row.NoticeDays) return { dueAt: null, daysLeft: null, timeBarred: null };
  const event = isoDay(row.EventDate);
  const due = new Date(event + 'T00:00:00Z');
  due.setUTCDate(due.getUTCDate() + Number(row.NoticeDays));
  const dueAt = due.toISOString().slice(0, 10);
  const delivered = row.NoticeDeliveredAt ? String(row.NoticeDeliveredAt).slice(0, 10) : null;
  return { dueAt, daysLeft: Math.round((Date.parse(dueAt) - Date.parse(isoDay(today))) / 86400000), timeBarred: (delivered ?? today) > dueAt };
}
export function changeReady(row: Record<string, unknown>): boolean {
  let a = row.Assessment;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return false; } }
  return Boolean(a) && IMPACT_DIMS.every(k => (a as Record<string, unknown>)[k] === true);
}
export function claimIssues(row: Record<string, unknown>, today: string): string[] {
  const issues: string[] = [];
  for (const k of ['Entitlement', 'Causation', 'QuantumNote', 'EvidenceRef', 'BaselineId', 'DataDate', 'NoticeRef', 'NoticeDeliveredAt']) if (!row[k]) issues.push(k);
  const state = noticeState(row, today);
  if (state.timeBarred !== false) issues.push('NoticeDeadline');
  if (row.DataDate && String(row.DataDate) > today) issues.push('FutureDataDate');
  return issues;
}
