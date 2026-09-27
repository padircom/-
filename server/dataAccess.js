/** SEC-1: explicit, deny-by-default policy shared by generic CRUD and Excel commit.
 * Identity uses the application's existing trusted x-user-id adapter. Production
 * gateways must strip client-supplied identity headers and authenticate upstream.
 * Raw writes to workflow tables require system configuration permission: a raw
 * row must not bypass approval/SoD by merely having permission to draft it.
 */
import { DEMO_SUBJECTS, evaluate } from './rbacLogic.js';
const raw = 'sys.config.manage';
export const TABLE_ACCESS = Object.freeze({
  Industry: ['core.portfolio.view', raw],
  Project: ['core.project.view', 'core.project.edit'],
  Document: ['doc.document.view', raw],
  Transmittal: ['doc.document.view', raw],
  WbsNode: ['plan.schedule.view', 'plan.schedule.edit'],
  Activity: ['plan.schedule.view', 'plan.schedule.edit'],
  ActivityRelation: ['plan.schedule.view', 'plan.schedule.edit'],
  Baseline: ['plan.schedule.view', 'plan.baseline.set'],
  Period: ['plan.schedule.view', raw],
  ProgressEntry: ['plan.schedule.view', raw],
  EvmSnapshot: ['pex.evm.view', raw],
  KpiSnapshot: ['pex.dashboard.view', raw],
  CostAccount: ['fin.cost.view', 'fin.budget.edit'],
  PaymentCertificate: ['fin.cost.view', raw],
  Ncr: ['qms.itp.view', raw],
  InspectionRecord: ['qms.itp.view', raw],
  WorkforceMember: ['hrm.personal.view', raw],
  Timesheet: ['hrm.personal.view', raw],
  ReportIssue: ['report.internal.generate', raw],
  ProcessTree: ['core.project.view', raw],
});

export function dataSubject(req) {
  const id = String(req.headers['x-user-id'] || '').trim();
  return DEMO_SUBJECTS.find(s => s.id === id && s.active) ?? null;
}
export function authorizeData(req, res, table, write, projectId) {
  const subject = dataSubject(req);
  const permission = Object.hasOwn(TABLE_ACCESS, table) ? TABLE_ACCESS[table][write ? 1 : 0] : null;
  // ActivityRelation has no ProjectId; without a join-backed scope resolver it
  // is available only to globally scoped schedule users (never leak all links).
  const unscopedRelation = table === 'ActivityRelation' && subject && !subject.projectIds.includes('*');
  const status = !subject ? 401 : unscopedRelation || !permission || !evaluate(subject, permission, { projectId }).allow ? 403 : 0;
  if (!status) return true;
  res.status(status).json({ ok: false, error: {
    code: status === 401 ? 'DATA_AUTH_REQUIRED' : 'DATA_FORBIDDEN',
    message: status === 401 ? 'هویت معتبر کاربر الزامی است' : 'مجوز دسترسی به این جدول یا پروژه وجود ندارد',
    table, permission, traceId: req.requestId,
  } });
  return false;
}

/** Limit collection queries too; query parameters never expand project access. */
export function scopeData(req, table, spec) {
  const subject = dataSubject(req);
  if (subject.projectIds.includes('*')) return spec;
  const column = table.name === 'Project' ? 'Id' : table.columns.some(c => c.name === 'ProjectId') ? 'ProjectId' : null;
  if (column) spec.where = [...(spec.where || []), { column, op: 'in', value: subject.projectIds }];
  return spec;
}
