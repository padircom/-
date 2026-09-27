/** LIVE-4. Persistent machinery forms backed by existing equipment validators and reports. */
import * as logic from './eqmLogic.js';
import { tableDef, validateRow } from './sqlLogic.js';
export const EQM_TABLES = ['Equipment', 'EquipmentMeter', 'EquipmentRental', 'MaintenanceOrder', 'EquipmentDispatch', 'EquipmentFuelLog', 'PmSchedule', 'SparePart'];
const validators = [logic.validateEquipment, logic.validateMeter, logic.validateRental, logic.validateMaintenanceOrder, logic.validateDispatch, logic.validateFuelLog, logic.validatePmSchedule, logic.validateSparePart];
const defaults = {
  Equipment: { Status: 'active', Ownership: 'owned' }, EquipmentMeter: { Source: 'manual', WorkHours: 0, HourMeter: 0 },
  EquipmentRental: { Status: 'active', Currency: 'IRR' }, MaintenanceOrder: { Status: 'open', Cost: 0 },
  EquipmentDispatch: { Status: 'draft', Shift: 'day', SafetyCheck: false, PlannedHours: 8 },
  EquipmentFuelLog: { Kind: 'diesel' }, PmSchedule: { Active: true, Basis: 'run_hours' }, SparePart: { OnHand: 0, MinLevel: 0, Critical: false },
};
const fault = (status, code, message) => Object.assign(new Error(message), { status, code });
const queues = new Map();
async function serial(pid, work) {
  const p = (queues.get(pid) ?? Promise.resolve()).catch(() => {}).then(work); queues.set(pid, p);
  try { return await p; } finally { if (queues.get(pid) === p) queues.delete(pid); }
}
export function registerEqmWorkspaceRoutes(app, { repo, subjects, evaluate }) {
  const allows = (req, permission) => evaluate(req.eqmSubject, permission, { projectId: req.eqmProject }).allow;
  const fail = (req, res, err) => res.status(err.status ?? 400).json({ ok: false, error: { code: err.code ?? 'EQM_VALIDATION', message: err.message, traceId: req.requestId } });
  // Protect existing KPI, reports and operational routes as well as the new workspace.
  app.use(['/api/eqp', '/api/eqm'], async (req, res, next) => {
    try {
      if (['/catalog', '/status'].includes(req.path)) return next();
      const subject = subjects.find(s => s.id === String(req.headers['x-user-id'] || '').trim() && s.active);
      if (!subject) throw fault(401, 'EQM_AUTH', 'هویت معتبر لازم است');
      req.eqmSubject = subject;
      const pieces = req.path.split('/').filter(Boolean);
      const newRoute = ['workspace', 'rows', 'dispatch'].includes(pieces[1]);
      let pid = newRoute ? pieces[0] : String(req.query.projectId || req.body?.projectId || '');
      const r = await repo();
      const equipmentId = !newRoute && (pieces[0] === 'equipment' ? pieces[1] : req.body?.equipmentId);
      if (equipmentId) {
        const e = await r.get('Equipment', equipmentId);
        if (!e) throw fault(404, 'EQM_NOT_FOUND', 'ماشین یافت نشد');
        if (pid && pid !== e.ProjectId) throw fault(404, 'EQM_NOT_FOUND', 'ماشین در پروژه نیست');
        pid = e.ProjectId;
      }
      if (!pid || !/^[A-Za-z0-9_-]{1,50}$/.test(pid)) throw fault(400, 'EQM_PROJECT', 'پروژهٔ معتبر لازم است');
      req.eqmProject = pid;
      if (!allows(req, 'eqm.workspace.view')) throw fault(403, 'EQM_FORBIDDEN', 'مجوز مشاهدهٔ ماشین‌آلات یا پروژه را ندارید');
      if (!newRoute && req.method !== 'GET' && !['/dispatch/precheck', '/validate', '/tco'].includes(req.path)) {
        throw fault(410, 'EQM_DEDICATED_ACTION', 'این اقدام خام بسته است؛ از گردش‌کار پروژه‌ای استفاده کنید. اتصال نوشتاری مالی/برنامه فعلاً در رابط فعال نیست');
      }
      next();
    } catch (err) { fail(req, res, err); }
  });
  const route = (permission, handler, status = 200) => async (req, res, next) => {
    try {
      if (!allows(req, permission)) throw fault(403, 'EQM_FORBIDDEN', 'مجوز این اقدام را ندارید');
      const data = await serial(req.eqmProject, async () => handler(await repo(), req));
      res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
    } catch (err) {
      if (['UNIQUE_VIOLATION', 'DUPLICATE_KEY'].includes(err.code)) err = fault(409, 'EQM_DUPLICATE', 'کد یا قرائت تکراری است');
      if (err.code === 'ROW_VALIDATION_FAILED') err.status = 400;
      if (err.status) return fail(req, res, err);
      next(err);
    }
  };
  const scope = req => [{ column: 'ProjectId', op: 'eq', value: req.eqmProject }];
  async function own(r, req, table, id) {
    const row = await r.get(table, id);
    if (!row || row.ProjectId !== req.eqmProject) throw fault(404, 'EQM_NOT_FOUND', 'رکورد در این پروژه یافت نشد');
    return row;
  }
  const audit = (r, req, table, row, action) => r.create('AuditLog', { At: new Date().toISOString(), SubjectId: req.eqmSubject.id, Action: action, ProjectCode: req.eqmProject, EntityName: table, EntityId: row.Id, Severity: 'info', Details: { code: row.Code ?? row.PartNo, traceId: req.requestId } }, req.eqmSubject.id);
  const root = '/api/eqp/:projectId';
  app.get(root + '/workspace', route('eqm.workspace.view', async (r, req) => {
    const rows = {};
    for (const table of EQM_TABLES) rows[table] = await r.list(table, { where: scope(req) });
    return { projectId: req.eqmProject, today: new Date().toISOString().slice(0, 10), rows, permissions: ['eqm.workspace.manage', 'eqm.dispatch.approve'].filter(p => allows(req, p)) };
  }));
  for (const method of ['post', 'patch']) app[method](root + '/rows/:table' + (method === 'patch' ? '/:id' : ''), route('eqm.workspace.manage', async (r, req) => {
    const table = req.params.table;
    if (!EQM_TABLES.includes(table)) throw fault(404, 'EQM_TABLE', 'جدول نامعتبر است');
    const existing = method === 'patch' ? await own(r, req, table, req.params.id) : null;
    if (existing && (req.body?.RowVersion !== existing.RowVersion || !Number.isInteger(req.body.RowVersion))) throw fault(409, 'EQM_VERSION', 'رکورد تغییر کرده؛ تازه‌سازی کنید');
    if (existing && table === 'EquipmentDispatch' && !['draft', 'rejected'].includes(existing.Status)) throw fault(409, 'EQM_LOCKED', 'دیسپچ ارسالی یا مصوب قابل ویرایش نیست');
    const values = {};
    for (const col of tableDef(table).columns) {
      if (['Id', 'ProjectId', 'ApprovedBy', 'EnteredBy', 'IssuedBy'].includes(col.name)) continue;
      if (Object.hasOwn(req.body ?? {}, col.name)) values[col.name] = req.body[col.name];
    }
    const row = { ...defaults[table], ...existing, ...values, ProjectId: req.eqmProject };
    if (table === 'EquipmentDispatch') row.Status = existing?.Status ?? 'draft';
    if (existing && ['EquipmentId', 'Code', 'PartNo'].some(k => existing[k] !== undefined && row[k] !== existing[k])) throw fault(400, 'EQM_IDENTITY', 'هویت رکورد قابل تغییر نیست');
    for (const [key, ref] of Object.entries({ EquipmentId: 'Equipment', OperatorId: 'WorkforceMember', ActivityId: 'Activity', CostAccountId: 'CostAccount' })) if (row[key]) await own(r, req, ref, row[key]);
    const check = validators[EQM_TABLES.indexOf(table)](row);
    if (!check.ok) throw fault(400, 'EQM_VALIDATION', check.issues.map(i => i.message).join('؛ '));
    // Strict numeric/date checks complement the legacy coercing validators.
    for (const col of tableDef(table).columns) {
      const value = row[col.name]; if (value === undefined || value === null) continue;
      if (['int', 'decimal'].includes(col.kind) && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (col.kind === 'int' && !Number.isInteger(value)))) throw fault(400, 'EQM_NUMBER', `عدد ${col.name} نامعتبر است`);
      if (col.kind === 'date' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) throw fault(400, 'EQM_DATE', `تاریخ ${col.name} نامعتبر است`);
    }
    if (table === 'EquipmentMeter') {
      if (row.WorkHours > 24 || row.ReadAt > new Date().toISOString().slice(0,10)) throw fault(400, 'EQM_METER', 'ساعت روز بیش از ۲۴ یا تاریخ آینده مجاز نیست');
      const meters = await r.list(table, { where: [...scope(req), { column: 'EquipmentId', op: 'eq', value: row.EquipmentId }] });
      if (meters.some(m => m.Id !== existing?.Id && ((m.ReadAt < row.ReadAt && m.HourMeter > row.HourMeter) || (m.ReadAt > row.ReadAt && m.HourMeter < row.HourMeter)))) throw fault(409, 'EQM_METER_ORDER', 'ساعت‌شمار باید در ترتیب تاریخ صعودی باشد');
      row.EnteredBy = req.eqmSubject.id;
    }
    if (table === 'EquipmentRental' && !['active', 'expired', 'terminated'].includes(row.Status)) throw fault(400, 'EQM_STATUS', 'وضعیت اجاره نامعتبر است');
    if (table === 'EquipmentFuelLog') row.IssuedBy = req.eqmSubject.id;
    // Remove immutable audit fields before update/create.
    const data = r.pickWritable(table, row); delete data.Id;
    const issues = validateRow(tableDef(table), { ...data, Id: existing?.Id ?? 'pending' }, 'insert');
    if (issues.length) throw fault(400, 'EQM_VALIDATION', issues.map(i => i.message).join('؛ '));
    let saved;
    if (existing) {
      const result = await r.patch(table, existing.Id, data, req.eqmSubject.id, existing.RowVersion);
      if (!result.ok) throw fault(409, 'EQM_VERSION', 'تعارض نسخه');
      saved = await r.get(table, existing.Id);
    } else saved = await r.create(table, data, req.eqmSubject.id);
    await audit(r, req, table, saved, 'EQM_SAVE'); return saved;
  }, method === 'post' ? 201 : 200));
  app.post(root + '/dispatch/:id/advance', route('eqm.workspace.view', async (r, req) => {
    const row = await own(r, req, 'EquipmentDispatch', req.params.id);
    const to = req.body?.to;
    if (!allows(req, ['approved','rejected'].includes(to) ? 'eqm.dispatch.approve' : 'eqm.workspace.manage')) throw fault(403, 'EQM_FORBIDDEN', 'مجوز تغییر وضعیت را ندارید');
    if (req.body?.RowVersion !== row.RowVersion) throw fault(409, 'EQM_VERSION', 'تعارض نسخه');
    if (!logic.canAdvanceDispatch(row.Status, to)) throw fault(409, 'EQM_FLOW', 'گذار وضعیت مجاز نیست');
    if (['approved','rejected'].includes(to) && row.CreatedBy === req.eqmSubject.id) throw fault(403, 'EQM_SOD', 'تهیه‌کننده نمی‌تواند تصویب کند');
    if (['submitted','approved','executed'].includes(to)) {
      const e = await own(r, req, 'Equipment', row.EquipmentId);
      const operator = row.OperatorId ? await own(r, req, 'WorkforceMember', row.OperatorId) : null;
      const today = new Date().toISOString().slice(0,10);
      if (!operator?.LicenseExpiry || operator.LicenseExpiry < row.DispatchDate || operator.LicenseExpiry < today) throw fault(422, 'EQM_OPERATOR', 'گواهی معتبر اپراتور در HRM لازم است');
      const w = [...scope(req), { column: 'EquipmentId', op: 'eq', value: e.Id }];
      const orders = await r.list('MaintenanceOrder', { where: w });
      const rentals = await r.list('EquipmentRental', { where: w });
      const pm = await r.list('PmSchedule', { where: w });
      const meters = await r.list('EquipmentMeter', { where: w });
      const latest = meters.sort((a,b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];
      if (pm.some(sc => sc.Active && (['kilometers','cycles'].includes(sc.Basis) || logic.pmDueByBasis(sc, today, latest?.HourMeter ?? 0).overdue))) throw fault(422, 'EQM_PM', 'PM معوق یا قرائت مبنای PM نامعلوم است');
      const check = logic.dispatchPrecheck({ nowIso: today, equipment: e, openCriticalOrders: orders.filter(o => o.Priority === 'critical' && ['open','in_progress'].includes(o.Status)).length, pmOverdueDays: 0, operatorAssigned: true, operatorLicenseExpiry: operator.LicenseExpiry, safetyCheckDone: row.SafetyCheck === true, rentalActive: rentals.some(x => x.Status === 'active' && x.StartDate <= row.DispatchDate && (!x.EndDate || x.EndDate >= row.DispatchDate)) });
      if (!check.allowed) throw fault(422, 'EQM_GATE', 'دروازهٔ آماده‌به‌کاری یا ایمنی ماشین رد شد');
    }
    const result = await r.patch('EquipmentDispatch', row.Id, { Status: to, ...(['approved','rejected'].includes(to) ? { ApprovedBy: req.eqmSubject.id } : {}) }, req.eqmSubject.id, row.RowVersion);
    if (!result.ok) throw fault(409, 'EQM_VERSION', 'تعارض نسخه');
    const saved = await r.get('EquipmentDispatch', row.Id); await audit(r, req, 'EquipmentDispatch', saved, 'EQM_ADVANCE'); return saved;
  }));
}
