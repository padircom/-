import { AmendmentError, normalizeAmendment, amendmentTransition, amendmentTotals } from './contractAmendmentLogic.js';

export const AMENDMENT_DEDICATED_ROUTES = { ContractAmendment: '/api/cnt-amendments/:projectId/contracts/:contractId' };
const where = (projectId, contractId) => [
  { column: 'ProjectId', op: 'eq', value: projectId }, { column: 'ContractId', op: 'eq', value: contractId },
];
const error = (status, code, message) => { throw new AmendmentError(status, code, message); };
const FIELDS = ['Code', 'TitleFa', 'AmendmentType', 'EffectiveDate', 'AmountDelta', 'DurationDeltaDays', 'LinkedCrCode', 'DocumentRef'];

export function registerContractAmendmentRoutes(app, { repo, subjects, evaluate }) {
  const base = '/api/cnt-amendments/:projectId/contracts/:contractId';
  const need = permission => (req, res, next) => {
    const user = subjects.find(u => u.id === req.headers['x-user-id'] && u.active);
    if (!user) return res.status(401).json({ ok: false, error: { code: 'E-CNT-AMENDMENT-AUTH', message: 'ورود با کاربر معتبر الزامی است' } });
    if (!evaluate(user, permission, { projectId: req.params.projectId }).allow) return res.status(403).json({ ok: false, error: { code: 'E-CNT-AMENDMENT-FORBIDDEN', message: 'مجوز این اقدام یا دسترسی به پروژه را ندارید' } });
    req.amendmentActor = user.id;
    next();
  };
  const route = fn => async (req, res, next) => {
    try {
      if (![req.params.projectId, req.params.contractId, ...(req.params.id ? [req.params.id] : [])].every(id => /^[\w-]{1,60}$/.test(id))) error(400, 'E-CNT-AMENDMENT-ID', 'شناسه نامعتبر است');
      const r = await repo();
      const contract = await r.get('ContractMaster', req.params.contractId);
      if (!contract || contract.ProjectId !== req.params.projectId) error(404, 'E-CNT-AMENDMENT-CONTRACT', 'پیمان در این پروژه یافت نشد');
      const data = await fn(req, r, contract);
      res.status(req.method === 'POST' && !req.params.id ? 201 : 200).json({ ok: true, data, meta: { traceId: req.requestId } });
    } catch (err) {
      if (err instanceof AmendmentError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
      if (['UNIQUE_VIOLATION', 'DUPLICATE_KEY'].includes(err?.code) || [2601, 2627].includes(err?.number ?? err?.originalError?.info?.number)) return res.status(409).json({ ok: false, error: { code: 'E-CNT-AMENDMENT-DUPLICATE', message: 'کد الحاقیه در این پروژه تکراری است' } });
      if ((err?.number ?? err?.originalError?.info?.number) === 1205) return res.status(409).json({ ok: false, error: { code: 'E-CNT-AMENDMENT-VERSION', message: 'تداخل هم‌زمان؛ بازخوانی و دوباره تلاش کنید' } });
      next(err);
    }
  };
  const body = (req, allowed) => {
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).some(k => !allowed.includes(k))) error(422, 'E-CNT-AMENDMENT-FIELDS', 'فیلدهای ورودی نامعتبر یا غیرقابل نوشتن هستند');
    return b;
  };
  const list = async (r, pid, cid) => {
    const rows = await r.list('ContractAmendment', { where: where(pid, cid), limit: 2001 });
    if (rows.length > 2000) error(409, 'E-CNT-AMENDMENT-LIMIT', 'تعداد الحاقیه‌ها از سقف این نما بیشتر است؛ محاسبه ناقص انجام نمی‌شود');
    return rows;
  };
  const getRow = async (r, req, version) => {
    const row = await r.get('ContractAmendment', req.params.id);
    if (!row || row.ProjectId !== req.params.projectId || row.ContractId !== req.params.contractId) error(404, 'E-CNT-AMENDMENT-NOT-FOUND', 'الحاقیه در این پیمان یافت نشد');
    if (!Number.isInteger(version) || version !== row.RowVersion) error(409, 'E-CNT-AMENDMENT-VERSION', 'نسخهٔ رکورد عوض شده است؛ بازخوانی کنید');
    return row;
  };
  const patch = async (r, table, row, data, actor) => {
    const result = await r.patch(table, row.Id, data, actor, row.RowVersion);
    if (!result?.ok) error(409, 'E-CNT-AMENDMENT-VERSION', 'رکورد هم‌زمان تغییر کرده است؛ بازخوانی کنید');
    return result;
  };
  const audit = (r, req, action, row) => r.create('AuditLog', {
    At: new Date().toISOString(), SubjectId: req.amendmentActor, Action: action,
    ProjectCode: req.params.projectId, EntityName: 'ContractAmendment', EntityId: row.Id,
    Severity: 'info', Details: { status: row.Status, code: row.Code, contractId: row.ContractId, amountDelta: row.AmountDelta, durationDeltaDays: row.DurationDeltaDays, documentRef: row.DocumentRef, decisionNote: row.DecisionNote ?? null, traceId: req.requestId },
  }, req.amendmentActor);

  app.get(base, need('cnt.contract.view'), route(async (req, r, contract) => {
    const rows = await list(r, req.params.projectId, contract.Id);
    return { items: rows, ...amendmentTotals(Number(contract.InitialAmount), Number(contract.DurationDays), rows) };
  }));
  app.post(base, need('cnt.contract.edit'), route(async (req, r, contract) => {
    const fields = normalizeAmendment(body(req, FIELDS));
    return r.transaction(async tx => {
      const item = await tx.create('ContractAmendment', { ...fields, ProjectId: req.params.projectId, ContractId: contract.Id, Status: 'draft' }, req.amendmentActor);
      await audit(tx, req, 'CNT_AMENDMENT_CREATE', item);
      return { item };
    });
  }));
  app.patch(`${base}/:id`, need('cnt.contract.edit'), route(async (req, r) => {
    const b = body(req, [...FIELDS, 'RowVersion']);
    const fields = normalizeAmendment(b);
    return r.transaction(async tx => {
      const row = await getRow(tx, req, b.RowVersion);
      if (row.Status !== 'draft') error(409, 'E-CNT-AMENDMENT-LOCKED', 'فقط پیش‌نویس قابل ویرایش است');
      const item = await patch(tx, 'ContractAmendment', row, fields, req.amendmentActor);
      await audit(tx, req, 'CNT_AMENDMENT_EDIT', item);
      return { item };
    });
  }));
  app.post(`${base}/:id/transitions`, (req, res, next) => need(['approve', 'reject'].includes(req.body?.action) ? 'cnt.amendment.approve' : 'cnt.contract.edit')(req, res, next), route(async (req, r) => {
    const b = body(req, ['action', 'RowVersion', 'note']);
    if (typeof b.action !== 'string' || (b.note != null && typeof b.note !== 'string')) error(422, 'E-CNT-AMENDMENT-VALIDATION', 'نوع اقدام یا شرح تصمیم نامعتبر است');
    return r.transaction(async tx => {
      const contract = await tx.get('ContractMaster', req.params.contractId);
      if (!contract || contract.ProjectId !== req.params.projectId) error(404, 'E-CNT-AMENDMENT-CONTRACT', 'پیمان یافت نشد');
      const row = await getRow(tx, req, b.RowVersion);
      const status = amendmentTransition(row, b.action, req.amendmentActor, b.note ?? '');
      if (b.action === 'submit') normalizeAmendment({ ...row, EffectiveDate: row.EffectiveDate instanceof Date ? row.EffectiveDate.toISOString().slice(0, 10) : String(row.EffectiveDate).slice(0, 10) }); // سوابق قدیمی نیز بدون سند وارد تصویب نمی‌شوند.
      const now = new Date().toISOString();
      const item = await patch(tx, 'ContractAmendment', row, { Status: status,
        ...(b.action === 'submit' ? { SubmittedBy: req.amendmentActor, SubmittedAt: now } : { DecidedBy: req.amendmentActor, DecidedAt: now, DecisionNote: b.note.trim() }),
      }, req.amendmentActor);
      if (status === 'approved') {
        const rows = await list(tx, req.params.projectId, contract.Id);
        const totals = amendmentTotals(Number(contract.InitialAmount), Number(contract.DurationDays), rows);
        await patch(tx, 'ContractMaster', contract, { CurrentAmount: totals.currentAmount }, req.amendmentActor);
      }
      await audit(tx, req, `CNT_AMENDMENT_${b.action.toUpperCase()}`, item);
      return { item };
    });
  }));
}
