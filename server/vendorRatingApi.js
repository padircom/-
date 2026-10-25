import { RatingError, fail, text, dateOnly, isoDate, scoreEvaluation, ratingHistory, improvementTransition, RATING_AXES } from './vendorEvaluationLogic.js';
export const RATING_DEDICATED_ROUTES = { VendorEvaluation: '/api/cnt-rating/:projectId', VendorImprovement: '/api/cnt-rating/:projectId/actions' };
export function registerVendorRatingRoutes(app, { repo, subjects, evaluate }) {
  const base = '/api/cnt-rating/:projectId';
  const permission = (user, p, pid) => evaluate(user, p, { projectId: pid }).allow;
  const need = p => (req, res, next) => {
    const user = subjects.find(u => u.id === req.headers['x-user-id'] && u.active);
    if (!user) return res.status(401).json({ ok: false, error: { code: 'AUTH', message: 'ورود الزامی است' } });
    if (!permission(user, p, req.params.projectId)) return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'مجوز اقدام یا دسترسی به پروژه ندارید' } });
    req.ratingActor = user; next();
  };
  const route = fn => async (req, res, next) => {
    try {
      if (![req.params.projectId, ...(req.params.id ? [req.params.id] : [])].every(s => /^[\w-]{1,60}$/.test(s))) fail(400, 'شناسه نامعتبر است');
      const data = await fn(req, await repo());
      res.status(req.method === 'POST' && !req.params.id ? 201 : 200).json({ ok: true, data });
    } catch (e) {
      if (e instanceof RatingError) return res.status(e.status).json({ ok: false, error: { code: e.code, message: e.message } });
      const n = e?.number ?? e?.originalError?.info?.number;
      if (['UNIQUE_VIOLATION', 'DUPLICATE_KEY'].includes(e?.code) || [2601, 2627, 1205].includes(n)) return res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'ارزیابی این دوره قبلاً ثبت شده یا تداخل هم‌زمان رخ داده است؛ بازخوانی کنید' } });
      next(e);
    }
  };
  const body = (req, keys) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(k => !keys.includes(k))) fail(422, 'فیلد ورودی غیرمجاز است');
    return req.body;
  };
  const list = async (r, table, pid) => {
    const rows = await r.list(table, { where: [{ column: 'ProjectId', op: 'eq', value: pid }], limit: 2001 });
    if (rows.length > 2000) fail(409, 'تعداد سوابق بیش از ظرفیت این نما است؛ گزارش ناقص نمایش داده نمی‌شود');
    return rows;
  };
  const scoped = async (r, table, id, pid) => {
    if (typeof id !== 'string' || !/^[\w-]{1,60}$/.test(id)) fail(422, 'شناسه نامعتبر است');
    const row = await r.get(table, id);
    if (!row || row.ProjectId !== pid) fail(404, 'رکورد در این پروژه یافت نشد');
    return row;
  };
  const patch = async (r, table, row, b, changes, actor) => {
    if (!Number.isInteger(b.RowVersion) || b.RowVersion !== row.RowVersion) fail(409, 'نسخهٔ رکورد تغییر کرده است؛ بازخوانی کنید');
    const result = await r.patch(table, row.Id, changes, actor, b.RowVersion);
    if (!result?.ok) fail(409, 'تداخل هم‌زمان؛ بازخوانی کنید');
    return result;
  };
  const audit = (r, req, action, table, row) => r.create('AuditLog', { At: new Date().toISOString(), SubjectId: req.ratingActor.id, Action: action, ProjectCode: req.params.projectId, EntityName: table, EntityId: row.Id, Severity: 'info', Details: { record: row, traceId: req.requestId } }, req.ratingActor.id);
  const owners = pid => subjects.filter(u => u.active && permission(u, 'cnt.rating.view', pid));
  const source = async (r, pid, kind, id) => {
    if (!['contract', 'purchase_order'].includes(kind)) fail(422, 'نوع طرف قرارداد نامعتبر است');
    const row = await scoped(r, kind === 'contract' ? 'ContractMaster' : 'PurchaseOrder', id, pid);
    if (['draft', 'cancelled'].includes(row.Status)) fail(422, 'پیمان یا سفارش پیش‌نویس و لغوشده قابل ارزیابی نیست');
    return { SourceKind: kind, SourceId: row.Id, PartyName: text(kind === 'contract' ? row.ContractorName : row.VendorName, 200), SourceCode: kind === 'contract' ? row.Code : row.PoNo };
  };
  app.get(base, need('cnt.rating.view'), route(async (req, r) => {
    const pid = req.params.projectId;
    const [evaluations, actions, contracts, orders] = await Promise.all(['VendorEvaluation', 'VendorImprovement', 'ContractMaster', 'PurchaseOrder'].map(t => list(r, t, pid)));
    const sources = [...contracts.filter(c => c.ContractorName && !['draft', 'cancelled'].includes(c.Status)).map(c => ({ SourceKind: 'contract', SourceId: c.Id, PartyName: c.ContractorName, SourceCode: c.Code })), ...orders.filter(c => c.VendorName && !['draft', 'cancelled'].includes(c.Status)).map(c => ({ SourceKind: 'purchase_order', SourceId: c.Id, PartyName: c.VendorName, SourceCode: c.PoNo }))];
    return { evaluations, actions, sources, history: ratingHistory(evaluations), owners: owners(pid).map(u => ({ id: u.id, name: u.name?.fa ?? u.displayName ?? u.id })), permissions: { edit: permission(req.ratingActor, 'cnt.rating.edit', pid), approve: permission(req.ratingActor, 'cnt.rating.approve', pid) }, today: new Date().toISOString().slice(0, 10) };
  }));
  app.post(`${base}/evaluations`, need('cnt.rating.edit'), route(async (req, r) => {
    const b = body(req, ['SourceKind', 'SourceId', 'PeriodDate', 'Scores', 'DocumentRef']);
    const fields = { PeriodDate: dateOnly(b.PeriodDate), ...scoreEvaluation(b.Scores), DocumentRef: text(b.DocumentRef, 200) };
    if (fields.PeriodDate > new Date().toISOString().slice(0, 10)) fail(422, 'تاریخ دورهٔ ارزیابی نمی‌تواند آینده باشد');
    return r.transaction(async tx => {
      const src = await source(tx, req.params.projectId, b.SourceKind, b.SourceId);
      const item = await tx.create('VendorEvaluation', { ...src, ...fields, ProjectId: req.params.projectId, Status: 'submitted' }, req.ratingActor.id);
      await audit(tx, req, 'CNT_RATING_SUBMIT', 'VendorEvaluation', item); return { item };
    });
  }));
  app.post(`${base}/evaluations/:id/resubmit`, need('cnt.rating.edit'), route(async (req, r) => {
    const b = body(req, ['RowVersion', 'Scores', 'DocumentRef']);
    const fields = { ...scoreEvaluation(b.Scores), DocumentRef: text(b.DocumentRef, 200) };
    return r.transaction(async tx => {
      const row = await scoped(tx, 'VendorEvaluation', req.params.id, req.params.projectId);
      if (row.CreatedBy !== req.ratingActor.id) fail(403, 'اصلاح ارزیابی فقط توسط ثبت‌کننده ممکن است');
      if (row.Status !== 'rejected') fail(409, 'فقط ارزیابی ردشده قابل اصلاح است');
      const item = await patch(tx, 'VendorEvaluation', row, b, { ...fields, Status: 'submitted', DecidedBy: null, DecidedAt: null, DecisionNote: null }, req.ratingActor.id);
      await audit(tx, req, 'CNT_RATING_RESUBMIT', 'VendorEvaluation', item); return { item };
    });
  }));
  app.post(`${base}/evaluations/:id/decision`, need('cnt.rating.approve'), route(async (req, r) => {
    const b = body(req, ['RowVersion', 'action', 'note']);
    if (!['approve', 'reject'].includes(b.action)) fail(422, 'تصمیم نامعتبر است');
    const note = text(b.note, 2000);
    return r.transaction(async tx => {
      const row = await scoped(tx, 'VendorEvaluation', req.params.id, req.params.projectId);
      if (!row.CreatedBy || row.CreatedBy === req.ratingActor.id) fail(403, 'ارزیاب نمی‌تواند ارزیابی خودش را تأیید یا رد کند');
      if (row.Status !== 'submitted') fail(409, 'تصمیم قبلاً ثبت شده است');
      const item = await patch(tx, 'VendorEvaluation', row, b, { Status: b.action === 'approve' ? 'approved' : 'rejected', DecidedBy: req.ratingActor.id, DecidedAt: new Date().toISOString(), DecisionNote: note }, req.ratingActor.id);
      await audit(tx, req, 'CNT_RATING_DECISION', 'VendorEvaluation', item); return { item };
    });
  }));
  app.post(`${base}/actions`, need('cnt.rating.edit'), route(async (req, r) => {
    const b = body(req, ['EvaluationId', 'Axis', 'TitleFa', 'OwnerId', 'DueDate']);
    if (!RATING_AXES.some(a => a.code === b.Axis)) fail(422, 'محور بهبود نامعتبر است');
    if (!owners(req.params.projectId).some(u => u.id === b.OwnerId)) fail(422, 'مسئول باید کاربر فعال همین پروژه باشد');
    const fields = { Axis: b.Axis, TitleFa: text(b.TitleFa, 400), OwnerId: b.OwnerId, DueDate: dateOnly(b.DueDate) };
    return r.transaction(async tx => {
      const row = await scoped(tx, 'VendorEvaluation', b.EvaluationId, req.params.projectId);
      if (row.Status !== 'approved') fail(409, 'اقدام بهبود فقط بر اساس ارزیابی تأییدشده ثبت می‌شود');
      if (fields.DueDate < isoDate(row.PeriodDate)) fail(422, 'موعد نمی‌تواند قبل از دورهٔ ارزیابی باشد');
      const item = await tx.create('VendorImprovement', { ...fields, EvaluationId: row.Id, ProjectId: req.params.projectId, Status: 'open' }, req.ratingActor.id);
      await audit(tx, req, 'CNT_IMPROVEMENT_CREATE', 'VendorImprovement', item); return { item };
    });
  }));
  app.post(`${base}/actions/:id/transitions`, (req, res, next) => need(['verify', 'reopen'].includes(req.body?.action) ? 'cnt.rating.approve' : 'cnt.rating.edit')(req, res, next), route(async (req, r) => {
    const b = body(req, ['RowVersion', 'action', 'evidence']);
    return r.transaction(async tx => {
      const row = await scoped(tx, 'VendorImprovement', req.params.id, req.params.projectId);
      const item = await patch(tx, 'VendorImprovement', row, b, improvementTransition(row, b.action, req.ratingActor.id, b.evidence), req.ratingActor.id);
      await audit(tx, req, 'CNT_IMPROVEMENT_TRANSITION', 'VendorImprovement', item); return { item };
    });
  }));
}
