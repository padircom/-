/** LIVE-3: project-scoped persistent RCC. No write to schedule, EVM or cost baselines. */
import { RCC_PERMISSIONS, RCC_TABLES, normalizeRcc, noticeState, changeReady, claimIssues, RccValidationError } from './rccWsLogic.js';
const locks = new Map();
async function serial(key, work) {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  locks.set(key, current);
  try { return await current; } finally { if (locks.get(key) === current) locks.delete(key); }
}
function error(status, code, message) { return Object.assign(new Error(message), { status, code }); }
const day = () => new Date().toISOString().slice(0, 10);
const editPerm = { risks: 'rcc.risk.edit', changes: 'rcc.change.raise', claims: 'rcc.claim.edit' };
const viewPerm = { risks: ['rcc.risk.view'], changes: ['rcc.change.raise', 'rcc.change.approve'], claims: ['rcc.claim.view'] };
export function registerRccWorkspaceRoutes(app, { repo, subjects, evaluate }) {
  const can = (req, permission) => evaluate(req.rccSubject, permission, { projectId: req.params.projectId }).allow;
  const need = perms => (req, res, next) => {
    const fail = (status, code, message) => res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(req.params.projectId)) return fail(400, 'RCC_PROJECT', 'شناسهٔ پروژه نامعتبر است');
    req.rccSubject = subjects.find(s => s.id === String(req.headers['x-user-id'] || '').trim() && s.active);
    if (!req.rccSubject) return fail(401, 'RCC_AUTH', 'هویت معتبر الزامی است');
    if (!(Array.isArray(perms) ? perms : [perms]).some(p => can(req, p))) return fail(403, 'RCC_FORBIDDEN', 'مجوز اقدام یا دسترسی به پروژه را ندارید');
    next();
  };
  const where = projectId => [{ column: 'ProjectId', op: 'eq', value: projectId }];
  const find = async (r, req, table) => {
    const row = await r.findOne(table, [...where(req.params.projectId), { column: 'Id', op: 'eq', value: req.params.id }]);
    if (!row) throw error(404, 'RCC_NOT_FOUND', 'رکورد در این پروژه یافت نشد');
    for (const [k, value] of Object.entries(row)) if (value instanceof Date) row[k] = value.toISOString().slice(0, ['EventDate', 'NoticeDate', 'DataDate', 'SubmittedAt', 'RaisedAt'].includes(k) ? 10 : 24);
    return row;
  };
  const audit = (r, req, table, row, action) => r.create('AuditLog', {
    At: new Date().toISOString(), SubjectId: req.rccSubject.id, Action: `RCC_${action}`,
    ProjectCode: req.params.projectId, EntityName: table, EntityId: row.Id, Severity: 'info',
    Details: { code: row.Code, status: row.Status, rowVersion: row.RowVersion, traceId: req.requestId },
  }, req.rccSubject.id);
  const patch = async (r, req, table, row, values) => {
    if (!Number.isInteger(req.body?.RowVersion) || req.body.RowVersion !== row.RowVersion) throw error(409, 'RCC_VERSION', 'نسخه تغییر کرده است؛ تازه‌سازی کنید');
    const result = await r.patch(table, row.Id, values, req.rccSubject.id, row.RowVersion);
    if (!result.ok) throw error(409, 'RCC_VERSION', 'رکورد هم‌زمان تغییر کرده است');
    return r.get(table, row.Id);
  };
  const route = (handler, status = 200) => async (req, res, next) => {
    try {
      const work = async () => handler(await repo(), req);
      const data = await serial(req.params.projectId, work);
      res.status(status).json({ ok: true, data, meta: { traceId: req.requestId, version: 'rcc-ws-v1' } });
    } catch (err) {
      if (err instanceof RccValidationError) { err.status = 400; err.code = 'RCC_VALIDATION'; }
      if (['UNIQUE_VIOLATION', 'DUPLICATE_KEY'].includes(err.code)) { err.status = 409; err.message = 'کد تکراری است'; }
      if (err.status) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
      next(err);
    }
  };
  const base = '/api/rcc/:projectId';
  app.get(base + '/workspace', need(RCC_PERMISSIONS), route(async (r, req) => {
    const result = { projectId: req.params.projectId, today: day(), permissions: RCC_PERMISSIONS.filter(p => can(req, p)) };
    for (const [kind, table] of Object.entries(RCC_TABLES)) {
      const visible = viewPerm[kind].some(p => can(req, p));
      result[kind + 'Hidden'] = !visible;
      const rows = visible ? await r.list(table, { where: where(req.params.projectId) }) : [];
      result[kind] = kind === 'claims' ? rows.map(row => { for (const k of ['EventDate', 'DataDate', 'NoticeDeliveredAt']) if (row[k] instanceof Date) row[k] = row[k].toISOString().slice(0, k === 'NoticeDeliveredAt' ? 24 : 10); return { ...row, TimeBarred: noticeState(row, day()).timeBarred, notice: noticeState(row, day()), submissionIssues: claimIssues(row, day()) }; }) : rows;
    }
    return result;
  }));
  for (const [kind, table] of Object.entries(RCC_TABLES)) {
    app.post(base + '/' + kind, need(editPerm[kind]), route(async (r, req) => {
      const values = normalizeRcc(kind, req.body ?? {});
      if (kind === 'changes') Object.assign(values, { Status: 'draft', RaisedBy: req.rccSubject.id, RaisedAt: day() });
      if (kind === 'claims') {
        if (values.EventDate > day()) throw error(400, 'RCC_FUTURE_EVENT', 'رویداد ادعا نمی‌تواند در آینده باشد');
        Object.assign(values, { Status: 'draft', NoticeDate: values.EventDate, TimeBarred: noticeState(values, day()).timeBarred });
      }
      const row = await r.create(table, { ...values, ProjectId: req.params.projectId }, req.rccSubject.id, kind);
      await audit(r, req, table, row, 'CREATE');
      return row;
    }, 201));
    app.patch(base + '/' + kind + '/:id', need(editPerm[kind]), route(async (r, req) => {
      const row = await find(r, req, table);
      if (kind !== 'risks' && !['draft', 'pending'].includes(row.Status)) throw error(409, 'RCC_LOCKED', 'رکورد نهایی قابل ویرایش نیست');
      const values = normalizeRcc(kind, req.body ?? {});
      if (values.Code !== row.Code) throw error(400, 'RCC_CODE', 'کد رکورد قابل تغییر نیست');
      if (kind === 'claims') {
        if (values.EventDate > day()) throw error(400, 'RCC_FUTURE_EVENT', 'رویداد ادعا نمی‌تواند در آینده باشد');
        if (row.NoticeDeliveredAt && ['EventDate', 'NoticeDays', 'Clause'].some(k => values[k] !== row[k])) throw error(409, 'RCC_NOTICE_LOCKED', 'تاریخ، مهلت و بند ابلاغ‌شده قابل تغییر نیست');
        values.TimeBarred = noticeState({ ...row, ...values }, day()).timeBarred;
        if (!row.NoticeDeliveredAt) values.NoticeDate = values.EventDate;
      }
      const saved = await patch(r, req, table, row, values);
      await audit(r, req, table, saved, 'EDIT');
      return saved;
    }));
  }
  app.post(base + '/changes/:id/decision', need('rcc.change.approve'), route(async (r, req) => {
    const row = await find(r, req, 'ChangeRequest');
    if (!['draft', 'pending'].includes(row.Status)) throw error(409, 'RCC_LOCKED', 'تغییر قبلاً تعیین تکلیف شده است');
    if ([row.RaisedBy, row.CreatedBy].includes(req.rccSubject.id)) throw error(403, 'RCC_SOD', 'تهیه‌کننده نمی‌تواند تغییر را تصویب کند');
    const { decision, reason } = req.body ?? {};
    if (!['approved', 'rejected'].includes(decision) || typeof reason !== 'string' || !reason.trim() || reason.length > 1000) throw error(400, 'RCC_DECISION', 'تصمیم و دلیل معتبر لازم است');
    if (decision === 'approved' && !changeReady(row)) throw error(422, 'RCC_ASSESSMENT', 'ارزیابی تمام ابعاد اثر باید تکمیل شود');
    const saved = await patch(r, req, 'ChangeRequest', row, { Status: decision, DecisionReason: reason.trim(), ApprovedBy: req.rccSubject.id, ApprovedAt: new Date().toISOString() });
    await audit(r, req, 'ChangeRequest', saved, 'DECISION');
    return saved;
  }));
  app.post(base + '/claims/:id/notice', need('rcc.claim.edit'), route(async (r, req) => {
    const row = await find(r, req, 'Claim');
    if (row.Status !== 'draft' || row.NoticeDeliveredAt) throw error(409, 'RCC_LOCKED', 'ابلاغ قبلاً ثبت شده یا ادعا نهایی است');
    const ref = req.body?.NoticeRef;
    if (typeof ref !== 'string' || !ref.trim() || ref.length > 200 || noticeState(row, day()).dueAt === null) throw error(400, 'RCC_NOTICE', 'مرجع ابلاغ، تاریخ رویداد و مهلت لازم است');
    // This records the evidence reference. It does not claim to send mail or perform legal service.
    const saved = await patch(r, req, 'Claim', row, { NoticeRef: ref.trim(), NoticeDate: day(), NoticeDeliveredAt: new Date().toISOString(), TimeBarred: noticeState(row, day()).timeBarred });
    await audit(r, req, 'Claim', saved, 'NOTICE_RECORDED');
    return saved;
  }));
  app.post(base + '/claims/:id/submit', need('rcc.claim.submit'), route(async (r, req) => {
    const row = await find(r, req, 'Claim');
    if (row.Status !== 'draft') throw error(409, 'RCC_LOCKED', 'ادعا قبلاً ارسال شده است');
    if (row.CreatedBy === req.rccSubject.id) throw error(403, 'RCC_SOD', 'تهیه‌کننده نمی‌تواند ادعا را ارسال کند');
    const issues = claimIssues(row, day());
    const baseline = row.BaselineId ? await r.get('Baseline', row.BaselineId) : null;
    if (!baseline || baseline.ProjectId !== req.params.projectId || !baseline.IsCurrent) issues.push('CurrentBaseline');
    if (issues.length) throw error(422, 'RCC_CLAIM_GATE', 'بستهٔ ادعا کامل نیست: ' + issues.join('، '));
    const saved = await patch(r, req, 'Claim', row, { Status: 'submitted', SubmittedAt: day(), SubmittedBy: req.rccSubject.id, TimeBarred: false });
    await audit(r, req, 'Claim', saved, 'SUBMIT');
    return saved;
  }));
}
