import { VariationError, normalizeQuantityChange, normalizeExtraWork, quantityEffect, assertQuantityBase, variationTransition, variationNumber } from './contractVariationLogic.js';

export const VARIATION_DEDICATED_ROUTES = {
  BOQ_QuantityChange: '/api/cnt-variations/:projectId/contracts/:contractId/quantity',
  ExtraWorkItem: '/api/cnt-variations/:projectId/contracts/:contractId/extra',
};
const error = (status, code, message) => { throw new VariationError(status, code, message); };
const tableOf = req => req.params.kind === 'quantity' ? 'BOQ_QuantityChange' : 'ExtraWorkItem';
const fieldsOf = kind => kind === 'quantity'
  ? ['BoqItemId', 'ChangeNo', 'NewQty', 'ReasonFa', 'DocumentRef', 'LinkedCrCode']
  : ['Code', 'TitleFa', 'Unit', 'Quantity', 'ProposedRate', 'AnalysisMethod', 'ReasonFa', 'DocumentRef', 'LinkedCrCode'];
const byContract = req => [{ column: 'ProjectId', op: 'eq', value: req.params.projectId }, { column: 'ContractId', op: 'eq', value: req.params.contractId }];
const draftOf = req => req.params.kind === 'quantity' ? 'draft' : 'proposed';

export function registerContractVariationRoutes(app, { repo, subjects, evaluate }) {
  const base = '/api/cnt-variations/:projectId/contracts/:contractId';
  const need = permission => (req, res, next) => {
    const user = subjects.find(u => u.id === req.headers['x-user-id'] && u.active);
    if (!user) return res.status(401).json({ ok: false, error: { code: 'E-CNT-VARIATION-AUTH', message: 'ورود با کاربر معتبر الزامی است' } });
    if (!evaluate(user, permission, { projectId: req.params.projectId }).allow) return res.status(403).json({ ok: false, error: { code: 'E-CNT-VARIATION-FORBIDDEN', message: 'مجوز این اقدام یا دسترسی به پروژه را ندارید' } });
    req.variationActor = user.id;
    next();
  };
  const route = fn => async (req, res, next) => {
    try {
      if (![req.params.projectId, req.params.contractId, ...(req.params.id ? [req.params.id] : [])].every(id => /^[\w-]{1,60}$/.test(id))) error(400, 'E-CNT-VARIATION-ID', 'شناسه نامعتبر است');
      if (req.params.kind && !['quantity', 'extra'].includes(req.params.kind)) error(400, 'E-CNT-VARIATION-KIND', 'نوع درخواست معتبر نیست');
      const r = await repo();
      const contract = await r.get('ContractMaster', req.params.contractId);
      if (!contract || contract.ProjectId !== req.params.projectId) error(404, 'E-CNT-VARIATION-CONTRACT', 'پیمان در این پروژه یافت نشد');
      const data = await fn(req, r, contract);
      res.status(req.method === 'POST' && !req.params.id ? 201 : 200).json({ ok: true, data, meta: { traceId: req.requestId } });
    } catch (err) {
      if (err instanceof VariationError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
      if (['UNIQUE_VIOLATION', 'DUPLICATE_KEY'].includes(err?.code) || [2601, 2627].includes(err?.number ?? err?.originalError?.info?.number)) return res.status(409).json({ ok: false, error: { code: 'E-CNT-VARIATION-DUPLICATE', message: 'شماره درخواست یا ردیف در این پیمان تکراری است' } });
      if ((err?.number ?? err?.originalError?.info?.number) === 1205) return res.status(409).json({ ok: false, error: { code: 'E-CNT-VARIATION-VERSION', message: 'تداخل هم‌زمان؛ بازخوانی و دوباره تلاش کنید' } });
      next(err);
    }
  };
  const body = (req, allowed) => {
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).some(k => !allowed.includes(k))) error(422, 'E-CNT-VARIATION-FIELDS', 'فیلدهای ورودی نامعتبر یا غیرقابل نوشتن هستند');
    return b;
  };
  const getRow = async (r, req, version) => {
    const row = await r.get(tableOf(req), req.params.id);
    if (!row || row.ProjectId !== req.params.projectId || row.ContractId !== req.params.contractId) error(404, 'E-CNT-VARIATION-NOT-FOUND', 'درخواست در این پیمان یافت نشد');
    if (!Number.isInteger(version) || version !== row.RowVersion) error(409, 'E-CNT-VARIATION-VERSION', 'نسخهٔ رکورد عوض شده است؛ بازخوانی کنید');
    return row;
  };
  const patch = async (r, table, row, data, actor) => {
    const result = await r.patch(table, row.Id, data, actor, row.RowVersion);
    if (!result?.ok) error(409, 'E-CNT-VARIATION-VERSION', 'رکورد هم‌زمان تغییر کرده است؛ بازخوانی کنید');
    return result;
  };
  const audit = (r, req, action, row) => r.create('AuditLog', {
    At: new Date().toISOString(), SubjectId: req.variationActor, Action: action,
    ProjectCode: req.params.projectId, EntityName: tableOf(req), EntityId: row.Id,
    Severity: 'info', Details: { status: row.Status, code: row.Code, contractId: row.ContractId, newQty: row.NewQty, previousQty: row.PreviousQty, deltaAmount: row.DeltaAmount, agreedRate: row.AgreedRate, boqItemId: row.BoqItemId, documentRef: row.DocumentRef, decisionNote: row.DecisionNote ?? null, traceId: req.requestId },
  }, req.variationActor);

  const list = async (r, table, where, limit = 2000) => {
    const rows = await r.list(table, { where, limit: limit + 1 });
    if (rows.length > limit) error(409, 'E-CNT-VARIATION-LIMIT', 'تعداد رکوردها از سقف این نما بیشتر است؛ فهرست ناقص نمایش داده نمی‌شود');
    return rows;
  };
  const baseItem = async (tx, req, id) => {
    const item = await tx.get('ContractBOQ_Item', id);
    if (!item || item.ProjectId !== req.params.projectId || item.ContractId !== req.params.contractId) error(404, 'E-CNT-VARIATION-BOQ', 'ردیف در این پیمان یافت نشد');
    const child = await tx.findOne('ContractBOQ_Item', [...byContract(req), { column: 'ParentItemNo', op: 'eq', value: item.ItemNo }, { column: 'Status', op: 'eq', value: 'active' }]);
    if (child) error(422, 'E-CNT-VARIATION-PARENT', 'تغییر مقدار باید روی ردیف اجرایی باشد، نه ردیف تجمیعی');
    return item;
  };
  const prepare = async (tx, req, b) => {
    if (req.params.kind === 'quantity') {
      const fields = normalizeQuantityChange(b);
      const item = await baseItem(tx, req, fields.BoqItemId);
      const { LineAmount, ...snapshot } = quantityEffect(item, fields.NewQty);
      return { ...fields, ...snapshot };
    }
    const fields = normalizeExtraWork(b);
    if (await tx.findOne('ContractBOQ_Item', [...byContract(req), { column: 'ItemNo', op: 'eq', value: fields.Code }])) error(409, 'E-CNT-VARIATION-DUPLICATE', 'کد کار جدید با شمارهٔ یک ردیف موجود یکسان است');
    if (fields.Quantity * fields.ProposedRate > 1e15) error(422, 'E-CNT-VARIATION-AMOUNT', 'مبلغ پیشنهادی بیش از حد مجاز است');
    return fields;
  };
  app.get(base, need('cnt.contract.view'), route(async (req, r) => {
    const [quantities, extras, boq] = await Promise.all([
      list(r, 'BOQ_QuantityChange', byContract(req)), list(r, 'ExtraWorkItem', byContract(req)), list(r, 'ContractBOQ_Item', byContract(req), 20000),
    ]);
    return { quantities, extras, boq };
  }));
  app.post(`${base}/:kind`, need('cnt.boq.edit'), route(async (req, r) => {
    const b = body(req, fieldsOf(req.params.kind));
    return r.transaction(async tx => {
      const fields = await prepare(tx, req, b);
      const item = await tx.create(tableOf(req), { ...fields, ProjectId: req.params.projectId, ContractId: req.params.contractId,
        Status: draftOf(req), ...(req.params.kind === 'quantity' ? { RequestedAt: new Date().toISOString().slice(0, 10) } : {}),
      }, req.variationActor);
      await audit(tx, req, 'CNT_VARIATION_CREATE', item);
      return { item };
    });
  }));
  app.patch(`${base}/:kind/:id`, need('cnt.boq.edit'), route(async (req, r) => {
    const b = body(req, [...fieldsOf(req.params.kind), 'RowVersion']);
    return r.transaction(async tx => {
      const row = await getRow(tx, req, b.RowVersion);
      if (row.Status !== draftOf(req)) error(409, 'E-CNT-VARIATION-LOCKED', 'فقط پیش‌نویس قابل ویرایش است');
      const fields = await prepare(tx, req, b);
      const item = await patch(tx, tableOf(req), row, fields, req.variationActor);
      await audit(tx, req, 'CNT_VARIATION_EDIT', item);
      return { item };
    });
  }));
  app.post(`${base}/:kind/:id/transitions`, (req, res, next) => need(['approve', 'reject'].includes(req.body?.action) ? 'cnt.variation.approve' : 'cnt.boq.edit')(req, res, next), route(async (req, r) => {
    const b = body(req, ['action', 'RowVersion', 'note', 'AgreedRate']);
    if (typeof b.action !== 'string' || (b.note != null && typeof b.note !== 'string')) error(422, 'E-CNT-VARIATION-VALIDATION', 'نوع اقدام یا شرح تصمیم نامعتبر است');
    if ('AgreedRate' in b && !(req.params.kind === 'extra' && b.action === 'approve')) error(422, 'E-CNT-VARIATION-FIELDS', 'نرخ توافقی فقط در تصویب کار جدید قابل ارسال است');
    return r.transaction(async tx => {
      const row = await getRow(tx, req, b.RowVersion);
      const status = variationTransition(req.params.kind, row, b.action, req.variationActor, b.note ?? '');
      let effect = {};
      if (['submit', 'approve'].includes(b.action)) {
        if (req.params.kind === 'quantity') {
          normalizeQuantityChange(row);
          const target = await baseItem(tx, req, row.BoqItemId);
          assertQuantityBase(row, target);
          const calculated = quantityEffect(target, Number(row.NewQty));
          if (b.action === 'approve') {
            const measurements = await list(tx, 'MeasurementSheet', [...byContract(req), { column: 'BoqItemId', op: 'eq', value: target.Id }], 20000);
            const verified = measurements.filter(m => m.Status === 'verified').reduce((sum, m) => sum + Number(m.Quantity || 0), 0);
            const ipcLines = await list(tx, 'IPC_LineItem', [{ column: 'ProjectId', op: 'eq', value: req.params.projectId }, { column: 'BoqItemId', op: 'eq', value: target.Id }], 20000);
            const certified = ipcLines.filter(l => ['verified', 'approved'].includes(l.Status)).reduce((max, l) => Math.max(max, Number(l.CumQty || 0), Number(l.ApprovedQty || 0), Number(l.VerifiedQty || 0)), 0);
            if (Number(row.NewQty) + 0.000001 < Math.max(verified, certified)) error(422, 'E-CNT-VARIATION-EXECUTED', 'مقدار جدید کمتر از کارکرد تأییدشده است');
            await patch(tx, 'ContractBOQ_Item', target, { ContractQty: Number(row.NewQty), LineAmount: calculated.LineAmount }, req.variationActor);
          }
        } else {
          normalizeExtraWork(row);
          if (b.action === 'approve') {
            const rate = variationNumber(b.AgreedRate, 'نرخ توافق‌شده', 2, 0.01);
            const amount = Math.round(Number(row.Quantity) * rate * 100) / 100;
            if (amount > 1e15) error(422, 'E-CNT-VARIATION-AMOUNT', 'مبلغ کار جدید بیش از حد مجاز است');
            const boq = await tx.create('ContractBOQ_Item', { ProjectId: req.params.projectId, ContractId: req.params.contractId,
              ItemNo: row.Code, TitleFa: row.TitleFa, Unit: row.Unit, PricingBasis: 'unit_price', ContractQty: Number(row.Quantity), UnitRate: rate,
              LineAmount: amount, IsStarred: true, RateStatus: 'agreed', Status: 'active',
            }, req.variationActor);
            effect = { AgreedRate: rate, BoqItemId: boq.Id };
          }
        }
      }
      const now = new Date().toISOString();
      const item = await patch(tx, tableOf(req), row, { Status: status, ...effect,
        ...(b.action === 'submit' ? { SubmittedBy: req.variationActor, SubmittedAt: now } : { DecidedBy: req.variationActor, DecidedAt: now, DecisionNote: b.note.trim() }),
      }, req.variationActor);
      await audit(tx, req, `CNT_VARIATION_${b.action.toUpperCase()}`, item);
      return { item };
    });
  }));
}
