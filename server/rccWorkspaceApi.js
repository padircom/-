/** LIVE-3: project-scoped persistent RCC. No write to schedule, EVM or cost baselines. */
import { RCC_PERMISSIONS, RCC_TABLES, normalizeRcc, noticeState, summarizeNotices, riskReserveState, summarizeReserves, riskReviewPatch, issueEws, summarizeIssues, issueTransitionPatch, ISSUE_TRANSITIONS, claimLifecyclePatch, CLAIM_LIFECYCLE_TRANSITIONS, changeReady, claimIssues, isoDay, RccValidationError, summarizeDelays, normalizeClaimCostItem, summarizeMonetaryClaim, contractualDeadlineAlerts } from './rccWsLogic.js';
import { calculateCircular1300, calculateCircular5090, analyseDelay } from './delayLogic.js';
import { buildClaimDocument } from './claimDocLogic.js';
import { evaluateLossRule, evaluatePaymentDelayLoss, detectCostOverlaps, summarizeLossPortfolio, LOSS_CATEGORIES } from './claimLossLogic.js';
import { buildClaimLossDocument } from './claimLossDocLogic.js';
const locks = new Map();
async function serial(key, work) {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  locks.set(key, current);
  try { return await current; } finally { if (locks.get(key) === current) locks.delete(key); }
}
function error(status, code, message) { return Object.assign(new Error(message), { status, code }); }
const day = () => new Date().toISOString().slice(0, 10);
const editPerm = { risks: 'rcc.risk.edit', changes: 'rcc.change.raise', claims: 'rcc.claim.edit', issues: 'rcc.issue.edit', delays: 'rcc.delay.edit' };
const viewPerm = { risks: ['rcc.risk.view'], changes: ['rcc.change.raise', 'rcc.change.approve'], claims: ['rcc.claim.view'], issues: ['rcc.issue.view'], delays: ['rcc.delay.view'] };
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
  const validatePlanningLinks = async (r, req, values) => {
    let wbs = null;
    if (values.WbsCode) {
      wbs = await r.findOne('WbsNode', [...where(req.params.projectId), { column: 'Code', op: 'eq', value: values.WbsCode }]);
      if (!wbs) throw error(400, 'RCC_WBS_LINK', `گره WBS «${values.WbsCode}» در این پروژه نیست`);
    }
    if (values.ActivityCode) {
      const activity = await r.findOne('Activity', [...where(req.params.projectId), { column: 'Code', op: 'eq', value: values.ActivityCode }]);
      if (!activity) throw error(400, 'RCC_ACTIVITY_LINK', `فعالیت «${values.ActivityCode}» در این پروژه نیست`);
      if (activity.WbsId) {
        const activityWbs = await r.get('WbsNode', activity.WbsId);
        if (values.WbsCode && activityWbs?.Code !== values.WbsCode) throw error(400, 'RCC_LINK_MISMATCH', 'فعالیت انتخاب‌شده به WBS انتخاب‌شده تعلق ندارد');
        if (!values.WbsCode && activityWbs) values.WbsCode = activityWbs.Code;
      }
    }
    if (values.BaselineId) {
      const baseline = await r.get('Baseline', values.BaselineId);
      if (!baseline || baseline.ProjectId !== req.params.projectId) throw error(400, 'RCC_BASELINE_LINK', 'برنامهٔ مبنای انتخاب‌شده در این پروژه نیست');
    }
    return wbs;
  };
  const validateRiskLink = async (r, req, values) => {
    if (!values.RiskCode) return;
    const risk = await r.findOne('Risk', [...where(req.params.projectId), { column: 'Code', op: 'eq', value: values.RiskCode }]);
    if (!risk) throw error(400, 'RCC_RISK_LINK', `ریسک «${values.RiskCode}» در این پروژه نیست`);
  };
  const validateDelayLinks = async (r, req, values) => {
    await validatePlanningLinks(r, req, values);
    await validateRiskLink(r, req, values);
    if (values.ClaimCode) {
      const claim = await r.findOne('Claim', [...where(req.params.projectId), { column: 'Code', op: 'eq', value: values.ClaimCode }]);
      if (!claim) throw error(400, 'RCC_CLAIM_LINK', `ادعای «${values.ClaimCode}» در این پروژه نیست`);
    }
    if (values.IssueCode) {
      const issue = await r.findOne('RccIssue', [...where(req.params.projectId), { column: 'Code', op: 'eq', value: values.IssueCode }]);
      if (!issue) throw error(400, 'RCC_ISSUE_LINK', `مسئلهٔ «${values.IssueCode}» در این پروژه نیست`);
    }
    if (values.IpcId) {
      const ipc = await r.get('InterimPaymentCertificate', values.IpcId);
      if (!ipc || ipc.ProjectId !== req.params.projectId) throw error(400, 'RCC_IPC_LINK', 'صورت‌وضعیت انتخاب‌شده در این پروژه نیست');
      if (values.ContractCode && ipc.ContractId) {
        const ipcContract = await r.get('ContractMaster', ipc.ContractId).catch(() => null);
        if (ipcContract && ipcContract.Code !== values.ContractCode) throw error(400, 'RCC_LINK_MISMATCH', 'صورت‌وضعیت انتخاب‌شده به پیمان انتخاب‌شده تعلق ندارد');
        if (!ipcContract) throw error(400, 'RCC_IPC_LINK', 'پیمان صورت‌وضعیت انتخاب‌شده یافت نشد');
      }
    }
    if (values.ContractCode) {
      const contract = await r.findOne('ContractMaster', [...where(req.params.projectId), { column: 'Code', op: 'eq', value: values.ContractCode }]);
      if (!contract) throw error(400, 'RCC_CONTRACT_LINK', `پیمان «${values.ContractCode}» در این پروژه نیست`);
    }
    for (const documentId of values.EvidenceRefs ?? []) {
      const document = await r.get('Document', documentId).catch(() => null);
      if (!document || document.ProjectId !== req.params.projectId) throw error(400, 'RCC_DOCUMENT_LINK', 'یکی از اسناد EDMS انتخاب‌شده در این پروژه نیست');
    }
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
      result[kind] = kind === 'claims' ? rows.map(row => { for (const k of ['EventDate', 'DataDate', 'NoticeDeliveredAt']) if (row[k] instanceof Date) row[k] = row[k].toISOString().slice(0, k === 'NoticeDeliveredAt' ? 24 : 10); return { ...row, TimeBarred: noticeState(row, day()).timeBarred, notice: noticeState(row, day()), submissionIssues: claimIssues(row, day()) }; })
        : kind === 'risks' ? rows.map(row => ({ ...row, reserve: riskReserveState(row, day()) }))
        : kind === 'issues' ? rows.map(row => { if (row.DueDate instanceof Date) row.DueDate = row.DueDate.toISOString().slice(0, 10); return { ...row, ews: issueEws(row, day()) }; })
        : rows;
    }
    result.noticeSummary = result.claimsHidden ? null : summarizeNotices(result.claims, day());
    result.reserveSummary = result.risksHidden ? null : summarizeReserves(result.risks, day());
    result.issueSummary = result.issuesHidden ? null : summarizeIssues(result.issues, day());
    result.delayCalculations = result.delaysHidden ? [] : await r.list('DelayCalculation', { where: where(req.params.projectId), limit: 5000 }).catch(() => []);
    for (const row of [...result.delays, ...result.delayCalculations]) {
      for (const k of ['StartDate', 'FinishDate', 'NoticedDate']) if (row[k] instanceof Date) row[k] = row[k].toISOString().slice(0, 10);
      if (row.CalculatedAt instanceof Date) row.CalculatedAt = row.CalculatedAt.toISOString();
      if (row.ApprovedAt instanceof Date) row.ApprovedAt = row.ApprovedAt.toISOString();
    }
    result.delaySummary = result.delaysHidden ? null : summarizeDelays(result.delays, result.delayCalculations);
    result.claimCostItems = result.delaysHidden ? [] : await r.list('ClaimCostItem', { where: where(req.params.projectId), limit: 5000 }).catch(() => []);
    result.monetarySummary = result.delaysHidden ? null : summarizeMonetaryClaim(result.claimCostItems);
    result.deadlineAlerts = result.claimsHidden ? [] : contractualDeadlineAlerts(result.claims, day());
    // ماژول خسارت (PMO-CLAIMS-LOSS-ENGINE-V1.0): قواعد، اجراهای append-only، تخصیص‌ها و شاخص‌ها از دادهٔ واقعی.
    result.lossCategories = LOSS_CATEGORIES;
    result.lossRules = result.delaysHidden ? [] : await r.list('ClaimCalculationRule', { where: where(req.params.projectId), limit: 5000 }).catch(() => []);
    result.lossRuns = result.delaysHidden ? [] : await r.list('ClaimCalculationRun', { where: where(req.params.projectId), limit: 10000 }).catch(() => []);
    result.costAllocations = result.delaysHidden ? [] : await r.list('ClaimCostAllocation', { where: where(req.params.projectId), limit: 10000 }).catch(() => []);
    result.lossDocumentVersions = result.delaysHidden ? [] : await r.list('ClaimDocumentVersion', { where: where(req.params.projectId), limit: 5000 }).catch(() => []);
    result.overlapWarnings = result.delaysHidden ? [] : detectCostOverlaps(result.claimCostItems, result.costAllocations);
    result.lossSummary = result.delaysHidden ? null : summarizeLossPortfolio(result.claimsHidden ? [] : result.claims, result.claimCostItems, result.lossRuns, result.lossDocumentVersions);
    const [wbsRows, activityRows, baselineRows] = await Promise.all([
      r.list('WbsNode', { where: where(req.params.projectId), limit: 5000 }),
      r.list('Activity', { where: where(req.params.projectId), limit: 5000 }),
      r.list('Baseline', { where: where(req.params.projectId), limit: 500 }),
    ]);
    const wbsById = new Map(wbsRows.map(row => [row.Id, row]));
    result.planningRefs = {
      wbs: wbsRows.map(row => ({ code: row.Code, nameFa: row.NameFa, level: row.Level ?? null })).sort((a, b) => a.code.localeCompare(b.code)),
      activities: activityRows.map(row => ({ code: row.Code, nameFa: row.NameFa, wbsCode: wbsById.get(row.WbsId)?.Code ?? null })).sort((a, b) => a.code.localeCompare(b.code)),
      baselines: baselineRows.map(row => ({ id: row.Id, name: row.Name, isCurrent: Boolean(row.IsCurrent), setAt: row.SetAt instanceof Date ? row.SetAt.toISOString() : row.SetAt ?? null })).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || String(b.setAt ?? '').localeCompare(String(a.setAt ?? ''))),
    };
    const [documentRows, contractRows, ipcRows] = await Promise.all([
      r.list('Document', { where: where(req.params.projectId), limit: 5000 }).catch(() => []),
      r.list('ContractMaster', { where: where(req.params.projectId), limit: 500 }).catch(() => []),
      r.list('InterimPaymentCertificate', { where: where(req.params.projectId), limit: 5000 }).catch(() => []),
    ]);
    const contractById = new Map(contractRows.map(row => [row.Id, row]));
    result.documentRefs = documentRows.map(row => ({ id: row.Id, docNo: row.DocNo, revision: row.Revision, titleFa: row.TitleFa, status: row.Status })).sort((a, b) => String(a.docNo).localeCompare(String(b.docNo)) || String(a.revision).localeCompare(String(b.revision)));
    result.financialRefs = {
      contracts: contractRows.map(row => ({ id: row.Id, code: row.Code, titleFa: row.TitleFa })).sort((a, b) => String(a.code).localeCompare(String(b.code))),
      ipcs: ipcRows.map(row => ({ id: row.Id, serialNo: row.SerialNo ?? null, contractId: row.ContractId, contractCode: contractById.get(row.ContractId)?.Code ?? '', periodCode: row.PeriodCode ?? '', workflowState: row.WorkflowState ?? '' })).sort((a, b) => String(a.contractCode).localeCompare(String(b.contractCode)) || Number(a.serialNo ?? 0) - Number(b.serialNo ?? 0)),
    };
    return result;
  }));
  for (const [kind, table] of Object.entries(RCC_TABLES)) {
    app.post(base + '/' + kind, need(editPerm[kind]), route(async (r, req) => {
      const values = normalizeRcc(kind, req.body ?? {});
      if (kind === 'risks' || kind === 'changes') await validatePlanningLinks(r, req, values);
      if (kind === 'issues') { await validatePlanningLinks(r, req, values); await validateRiskLink(r, req, values); Object.assign(values, { Status: 'open', EscalationLevel: 0, EscalationNote: null, EscalatedBy: null, EscalatedAt: null, ResolutionNote: null, ResolvedBy: null, ResolvedAt: null, ClosedBy: null, ClosedAt: null }); }
      if (kind === 'delays') { await validateDelayLinks(r, req, values); Object.assign(values, { Status: 'under_review', ReviewNote: null, ReviewedBy: null, ReviewedAt: null }); }
      if (kind === 'changes') Object.assign(values, { Status: 'draft', RaisedBy: req.rccSubject.id, RaisedAt: day(), ApplicationStatus: 'not_applied', AppliedBaselineId: null, ApplicationNote: null, AppliedBy: null, AppliedAt: null });
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
      if ((kind === 'changes' || kind === 'claims') && !['draft', 'pending'].includes(row.Status)) throw error(409, 'RCC_LOCKED', 'رکورد نهایی قابل ویرایش نیست');
      if (kind === 'issues' && row.Status === 'closed') throw error(409, 'RCC_LOCKED', 'مسئلهٔ بسته‌شده قابل ویرایش نیست');
      if (kind === 'delays' && row.Status === 'closed') throw error(409, 'RCC_LOCKED', 'رویداد تأخیر بسته‌شده قابل ویرایش نیست');
      const values = normalizeRcc(kind, req.body ?? {});
      if (values.Code !== row.Code) throw error(400, 'RCC_CODE', 'کد رکورد قابل تغییر نیست');
      if (kind === 'risks' || kind === 'changes') await validatePlanningLinks(r, req, values);
      if (kind === 'issues') { await validatePlanningLinks(r, req, values); await validateRiskLink(r, req, values); }
      if (kind === 'delays') { await validateDelayLinks(r, req, values); Object.assign(values, { Status: row.Status, ReviewNote: row.ReviewNote ?? null, ReviewedBy: row.ReviewedBy ?? null, ReviewedAt: row.ReviewedAt ?? null }); }
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
  app.post(base + '/changes/:id/apply', need('rcc.change.approve'), route(async (r, req) => {
    const row = await find(r, req, 'ChangeRequest');
    if (row.Status !== 'approved') throw error(409, 'RCC_NOT_APPROVED', 'فقط تغییر تصویب‌شده قابل اعمال است');
    if (row.ApplicationStatus === 'applied') throw error(409, 'RCC_ALREADY_APPLIED', 'این تغییر قبلاً در یک نسخهٔ Baseline اعمال شده است');
    if ([row.RaisedBy, row.CreatedBy].includes(req.rccSubject.id)) throw error(403, 'RCC_SOD', 'تهیه‌کننده نمی‌تواند تغییر را اعمال کند');
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note || note.length > 1000) throw error(400, 'RCC_APPLICATION_NOTE', 'یادداشت اعمال تغییر لازم است');
    if (!row.WbsCode && !row.ActivityCode) throw error(422, 'RCC_LINK_REQUIRED', 'برای اعمال تغییر، پیوند WBS یا فعالیت لازم است');
    await validatePlanningLinks(r, req, row);
    if (!row.BaselineId) throw error(422, 'RCC_BASELINE_REQUIRED', 'برای اعمال تغییر، Baseline مبدأ لازم است');
    const source = await r.get('Baseline', row.BaselineId);
    if (!source || source.ProjectId !== req.params.projectId || !source.IsCurrent) throw error(422, 'RCC_SOURCE_BASELINE', 'Baseline مبدأ باید برنامهٔ مبنای جاری همین پروژه باشد');

    let snapshot = source.Snapshot ?? {};
    if (typeof snapshot === 'string') { try { snapshot = JSON.parse(snapshot); } catch { snapshot = { raw: snapshot }; } }
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) snapshot = { value: snapshot };
    const appliedAt = new Date().toISOString();
    const candidateId = `baseline-${String(row.Id).replace(/[^A-Za-z0-9_-]/g, '').slice(-32)}`;
    let candidate = await r.get('Baseline', candidateId);
    if (!candidate) {
      candidate = await r.create('Baseline', {
        Id: candidateId,
        ProjectId: req.params.projectId,
        Name: `${String(source.Name ?? source.Id).slice(0, 70)} + ${row.Code}`.slice(0, 120),
        SetAt: appliedAt,
        SetBy: req.rccSubject.id,
        IsCurrent: false,
        Snapshot: {
          ...snapshot,
          sourceBaselineId: source.Id,
          appliedChange: {
            changeId: row.Id, changeCode: row.Code, costImpact: row.CostImpact ?? null, timeImpactDays: row.TimeImpactDays ?? null,
            wbsCode: row.WbsCode || null, activityCode: row.ActivityCode || null, appliedBy: req.rccSubject.id, appliedAt, note,
          },
        },
      }, req.rccSubject.id, 'baseline');
    }
    const saved = await patch(r, req, 'ChangeRequest', row, { ApplicationStatus: 'applied', AppliedBaselineId: candidate.Id, ApplicationNote: note, AppliedBy: req.rccSubject.id, AppliedAt: appliedAt });
    await audit(r, req, 'ChangeRequest', saved, 'CHANGE_APPLIED');
    return { change: saved, baseline: candidate, sourceBaselineId: source.Id };
  }));
  const delayDay = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);
  const dayDiff = (from, to) => {
    const a = delayDay(from); const b = delayDay(to);
    return a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) : null;
  };
  const persistDelayCalculation = async (r, req, event, engine, ruleVersion, method, inputs, result, raw, finalValue) => {
    // محاسبات append-only هستند: بازبینی جدید هرگز محاسبهٔ تأییدشده یا تاریخچهٔ قبلی را بازنویسی نمی‌کند.
    const values = { DelayEventId: event.Id, Engine: engine, RuleVersion: ruleVersion, Method: method || null, Inputs: inputs, Result: result, Status: 'calculated', RawValueDays: raw, FinalValueDays: finalValue, CalculatedBy: req.rccSubject.id, CalculatedAt: new Date().toISOString(), ApprovedBy: null, ApprovedAt: null, ApprovalNote: null };
    const row = await r.create('DelayCalculation', { ...values, ProjectId: req.params.projectId }, req.rccSubject.id, 'delayCalculation');
    await audit(r, req, 'DelayCalculation', row, 'DELAY_CALCULATE');
    return row;
  };
  const loadDelayFinancials = async (r, req, event, input) => {
    let ipc = null;
    let contract = null;
    if (event.IpcId || input.ipcId) {
      ipc = await r.get('InterimPaymentCertificate', input.ipcId || event.IpcId);
      if (!ipc || ipc.ProjectId !== req.params.projectId) throw error(400, 'RCC_IPC_LINK', 'صورت‌وضعیت انتخاب‌شده در این پروژه نیست');
    }
    if (ipc?.ContractId) contract = await r.get('ContractMaster', ipc.ContractId);
    if (!contract && event.ContractCode) contract = await r.findOne('ContractMaster', [...where(req.params.projectId), { column: 'Code', op: 'eq', value: event.ContractCode }]);
    if (!contract && input.contractCode) contract = await r.findOne('ContractMaster', [...where(req.params.projectId), { column: 'Code', op: 'eq', value: String(input.contractCode) }]);
    return { ipc, contract };
  };
  const parseStoredObject = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
    return {};
  };
  const normalizeScheduleActivity = (row) => ({
    id: String(row.id ?? row.Code ?? row.code ?? ''),
    nameFa: String(row.nameFa ?? row.NameFa ?? row.name ?? row.Code ?? row.code ?? ''),
    duration: Number(row.duration ?? row.DurationDays ?? Math.max(0, (dayDiff(row.plannedStart ?? row.PlannedStart, row.plannedFinish ?? row.PlannedFinish) ?? -1) + 1)),
    remainingDuration: row.remainingDuration == null && row.RemainingDuration == null ? undefined : Number(row.remainingDuration ?? row.RemainingDuration),
    constraintStart: delayDay(row.constraintStart ?? row.ConstraintStart ?? row.plannedStart ?? row.PlannedStart) ?? undefined,
    constraintFinish: delayDay(row.constraintFinish ?? row.ConstraintFinish) ?? undefined,
    actualStart: delayDay(row.actualStart ?? row.ActualStart) ?? undefined,
    actualFinish: delayDay(row.actualFinish ?? row.ActualFinish) ?? undefined,
    isMilestone: Boolean(row.isMilestone ?? row.IsMilestone),
  });
  const normalizeScheduleActivities = (rows) => Array.isArray(rows) ? rows.map(normalizeScheduleActivity).filter(row => row.id) : [];
  const normalizeScheduleRelations = (rows) => Array.isArray(rows) ? rows.map(row => ({ pred: String(row.pred ?? row.PredecessorCode ?? row.predecessorCode ?? ''), succ: String(row.succ ?? row.SuccessorCode ?? row.successorCode ?? ''), type: String(row.type ?? row.RelType ?? 'FS'), lag: Number(row.lag ?? row.LagDays ?? 0) })).filter(row => row.pred && row.succ) : [];
  const loadDelaySchedule = async (r, req, event) => {
    const activityRows = await r.list('Activity', { where: where(req.params.projectId), limit: 5000 });
    const relRows = await r.list('ActivityRelation', { limit: 10000 }).catch(() => []);
    const byId = new Map(activityRows.map(a => [a.Id, a]));
    const currentActivities = normalizeScheduleActivities(activityRows);
    const currentRelations = relRows.map(rel => ({ pred: byId.get(rel.PredecessorId)?.Code, succ: byId.get(rel.SuccessorId)?.Code, type: rel.RelType || 'FS', lag: Number(rel.LagDays ?? 0) })).filter(rel => rel.pred && rel.succ);
    let baselineActivities = currentActivities;
    let updatedActivities = currentActivities;
    let relations = currentRelations;
    let scheduleSource = 'current_activity_register';
    if (event.BaselineId) {
      const baseline = await r.get('Baseline', event.BaselineId).catch(() => null);
      const snapshot = parseStoredObject(baseline?.Snapshot);
      const snapshotBaseline = normalizeScheduleActivities(snapshot.baselineActivities ?? snapshot.activities);
      const snapshotUpdated = normalizeScheduleActivities(snapshot.updatedActivities);
      const snapshotRelations = normalizeScheduleRelations(snapshot.relations ?? snapshot.links);
      if (snapshotBaseline.length) {
        baselineActivities = snapshotBaseline;
        relations = snapshotRelations;
        scheduleSource = 'baseline_snapshot';
      }
      if (snapshotUpdated.length) updatedActivities = snapshotUpdated;
    }
    return { baselineActivities, updatedActivities, relations, scheduleSource };
  };
  app.post(base + '/delays/:id/review', need('rcc.delay.approve'), route(async (r, req) => {
    const row = await find(r, req, 'DelayEvent');
    if (row.CreatedBy === req.rccSubject.id) throw error(403, 'RCC_SOD', 'ایجادکننده نمی‌تواند رویداد تأخیر را بررسی نهایی کند');
    const reviewStatus = String(req.body?.reviewStatus ?? '');
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!['accepted', 'rejected'].includes(reviewStatus) || !note || note.length > 1000) throw error(400, 'RCC_DELAY_REVIEW', 'نتیجهٔ بررسی و توضیح لازم است');
    const saved = await patch(r, req, 'DelayEvent', row, { Status: reviewStatus, ReviewNote: note, ReviewedBy: req.rccSubject.id, ReviewedAt: new Date().toISOString() });
    await audit(r, req, 'DelayEvent', saved, 'DELAY_REVIEW');
    return saved;
  }));
  app.post(base + '/delays/:id/calculate', need('rcc.delay.calculate'), route(async (r, req) => {
    const row = await find(r, req, 'DelayEvent');
    const input = req.body ?? {};
    const { ipc, contract } = await loadDelayFinancials(r, req, row, input);
    if (input.engine === 'circular1300') {
      const periodDays = Number(input.periodDays ?? (ipc ? (dayDiff(ipc.PeriodFrom, ipc.PeriodTo) ?? 0) + 1 : 0));
      const result = calculateCircular1300({
        periodDays,
        article37ExactlyComplied: typeof input.article37ExactlyComplied === 'boolean' ? input.article37ExactlyComplied : undefined,
      });
      return persistDelayCalculation(r, req, row, 'circular1300', result.ruleVersion, null, { ...input, periodDays, ipcId: ipc?.Id ?? null, contractId: contract?.Id ?? null }, result, result.rawAllowedPaymentDays, result.finalAllowedPaymentDays);
    }
    if (input.engine === 'circular5090') {
      const statementKind = ['interim', 'advance_first', 'advance_subsequent'].includes(String(input.statementKind)) ? String(input.statementKind) : (ipc?.IpcType === 'advance' ? 'advance_subsequent' : 'interim');
      const periodDays = ipc ? (dayDiff(ipc.PeriodFrom, ipc.PeriodTo) ?? 0) + 1 : null;
      const result = calculateCircular5090({
        statementKind,
        submittedAt: input.submittedAt || delayDay(ipc?.SubmittedAt) || undefined,
        actualPaidAt: input.actualPaidAt || delayDay(ipc?.PaidAt) || undefined,
        contractPaymentDays: Number(input.contractPaymentDays ?? (((contract?.ReviewDaysConsultant ?? 0) + (contract?.ReviewDaysEmployer ?? 0)) || 0)) || undefined,
        statementGrossAmount: Number(input.statementGrossAmount ?? ipc?.GrossCurrent ?? 0) || undefined,
        statementPeriodDays: Number(input.statementPeriodDays ?? periodDays ?? 0) || undefined,
        initialContractDurationDays: Number(input.initialContractDurationDays ?? contract?.DurationDays ?? 0) || undefined,
        initialContractAmount: Number(input.initialContractAmount ?? contract?.InitialAmount ?? 0) || undefined,
        latestStatementCumulativeAmount: Number(input.latestStatementCumulativeAmount ?? input.workAmount ?? ipc?.GrossCumulative ?? 0) || undefined,
        latestStatementDate: input.latestStatementDate || delayDay(ipc?.PeriodTo) || delayDay(ipc?.SubmittedAt) || undefined,
        firstAdvanceReceivedDate: input.firstAdvanceReceivedDate || undefined,
      });
      return persistDelayCalculation(r, req, row, 'circular5090', result.ruleVersion, null, { ...input, statementKind, ipcId: ipc?.Id ?? null, contractId: contract?.Id ?? null }, result, result.rawExtensionDays, result.finalExtensionDays);
    }
    if (input.engine === 'schedule') {
      const schedule = await loadDelaySchedule(r, req, row);
      const methodAliases = { time_impact: 'time_impact_analysis' };
      const requestedMethod = String(input.method ?? 'impacted_as_planned');
      const method = ['as_planned_as_built', 'impacted_as_planned', 'time_impact_analysis', 'windows', 'collapsed_as_built'].includes(requestedMethod) ? requestedMethod : (methodAliases[requestedMethod] ?? 'impacted_as_planned');
      const windows = Array.isArray(input.windows) ? input.windows.map(window => ({
        label: String(window?.label ?? ''),
        dataDate: delayDay(window?.dataDate) ?? undefined,
        baselineActivities: normalizeScheduleActivities(window?.baselineActivities),
        updatedActivities: normalizeScheduleActivities(window?.updatedActivities),
      })) : [];
      const result = analyseDelay({
        method,
        baselineActivities: schedule.baselineActivities,
        updatedActivities: schedule.updatedActivities,
        relations: schedule.relations,
        dataDate: input.dataDate || day(),
        eventActivityIds: Array.isArray(input.eventActivityIds) && input.eventActivityIds.length ? input.eventActivityIds.map(String) : (row.ActivityCode ? [String(row.ActivityCode)] : []),
        eventDelayDays: Number(input.eventDelayDays ?? row.EstimatedDelayDays ?? 0),
        windows,
      });
      return persistDelayCalculation(r, req, row, 'schedule', 'delay-analysis-v1', method, { ...input, method, activityCount: schedule.baselineActivities.length, relationCount: schedule.relations.length, baselineId: row.BaselineId || null, scheduleSource: schedule.scheduleSource, windowCount: windows.length }, result, result.completionShiftDays, result.status === 'calculated' ? result.completionShiftDays : null);
    }
    throw error(400, 'RCC_DELAY_ENGINE', 'موتور محاسبهٔ تأخیر معتبر نیست');
  }));
  app.post(base + '/delay-calculations/:id/approve', need('rcc.delay.approve'), route(async (r, req) => {
    const row = await r.findOne('DelayCalculation', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: req.params.id }]);
    if (!row) throw error(404, 'RCC_NOT_FOUND', 'محاسبه در این پروژه یافت نشد');
    if (row.CalculatedBy === req.rccSubject.id) throw error(403, 'RCC_SOD', 'محاسبه‌کننده نمی‌تواند محاسبه را تأیید کند');
    if (row.Status === 'approved') throw error(409, 'RCC_DELAY_APPROVED', 'محاسبه قبلاً تأیید شده است');
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note || note.length > 1000) throw error(400, 'RCC_DELAY_APPROVAL', 'یادداشت تأیید لازم است');
    let result = {};
    try { result = typeof row.Result === 'string' ? JSON.parse(row.Result) : (row.Result ?? {}); } catch { throw error(422, 'RCC_DELAY_RESULT', 'نتیجهٔ ذخیره‌شدهٔ محاسبه خوانا نیست'); }
    const raw = Number(result?.rawExtensionDays ?? result?.rawAllowedPaymentDays ?? result?.completionShiftDays ?? row.RawValueDays);
    if (!Number.isFinite(raw)) throw error(422, 'RCC_DELAY_INCOMPLETE', 'محاسبهٔ ناقص یا فاقد مقدار خام قابل تأیید نیست');
    if (result?.status === 'not_applicable') throw error(422, 'RCC_DELAY_NOT_APPLICABLE', 'نتیجهٔ «قابل اعمال نیست» قابل تأیید به‌عنوان تمدید نیست');
    if (row.Engine === 'schedule' && result?.status !== 'calculated') throw error(422, 'RCC_DELAY_INCOMPLETE', 'محاسبهٔ زمان‌بندی ناقص قابل تأیید نیست');
    if (row.Engine !== 'schedule' && result?.status === 'needs_review' && !Number.isFinite(Number(result?.rawExtensionDays ?? result?.rawAllowedPaymentDays))) throw error(422, 'RCC_DELAY_INCOMPLETE', 'محاسبهٔ بخشنامه‌ای ناقص قابل تأیید نیست');
    const finalValue = row.Engine === 'circular1300' ? Number(result?.finalAllowedPaymentDays ?? raw) : raw;
    const saved = await patch(r, req, 'DelayCalculation', row, { Status: 'approved', FinalValueDays: finalValue, ApprovedBy: req.rccSubject.id, ApprovedAt: new Date().toISOString(), ApprovalNote: note });
    const event = await r.get('DelayEvent', row.DelayEventId).catch(() => null);
    if (event && event.ProjectId === req.params.projectId) await r.patch('DelayEvent', event.Id, { Status: 'accepted', CompletionImpactDays: row.Engine === 'schedule' ? Math.round(finalValue) : event.CompletionImpactDays ?? null }, req.rccSubject.id, event.RowVersion).catch(() => null);
    await audit(r, req, 'DelayCalculation', saved, 'DELAY_CALCULATION_APPROVE');
    return saved;
  }));
  const validateCostDocuments = async (r, req, values) => {
    for (const documentId of values.DocumentRefs ?? []) {
      const document = await r.get('Document', documentId).catch(() => null);
      if (!document || document.ProjectId !== req.params.projectId) throw error(400, 'RCC_DOCUMENT_LINK', 'یکی از مستندات پشتیبان هزینه در این پروژه نیست');
    }
  };
  app.post(base + '/delays/:id/cost-items', need('rcc.delay.edit'), route(async (r, req) => {
    const event = await find(r, req, 'DelayEvent');
    const values = normalizeClaimCostItem(req.body ?? {});
    await validateCostDocuments(r, req, values);
    const row = await r.create('ClaimCostItem', { ...values, ClaimCode: values.ClaimCode || event.ClaimCode || null, DelayEventId: event.Id, ProjectId: req.params.projectId }, req.rccSubject.id, 'claimCostItem');
    await audit(r, req, 'ClaimCostItem', row, 'COST_ITEM_CREATE');
    return row;
  }, 201));
  app.patch(base + '/cost-items/:id', need('rcc.delay.edit'), route(async (r, req) => {
    const row = await r.findOne('ClaimCostItem', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: req.params.id }]);
    if (!row) throw error(404, 'RCC_NOT_FOUND', 'آیتم هزینه در این پروژه یافت نشد');
    const values = normalizeClaimCostItem(req.body ?? {});
    await validateCostDocuments(r, req, values);
    const saved = await patch(r, req, 'ClaimCostItem', row, { ...values, ClaimCode: values.ClaimCode || row.ClaimCode || null, DelayEventId: row.DelayEventId });
    await audit(r, req, 'ClaimCostItem', saved, 'COST_ITEM_EDIT');
    return saved;
  }));
  app.delete(base + '/cost-items/:id', need('rcc.delay.edit'), route(async (r, req) => {
    const row = await r.findOne('ClaimCostItem', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: req.params.id }]);
    if (!row) throw error(404, 'RCC_NOT_FOUND', 'آیتم هزینه در این پروژه یافت نشد');
    await audit(r, req, 'ClaimCostItem', row, 'COST_ITEM_DELETE');
    await r.remove('ClaimCostItem', row.Id);
    return { deleted: true, id: row.Id };
  }));
  // ── ماژول خسارت: کتابخانهٔ قواعد (ClaimCalculationRules) ──
  app.post(base + '/loss-rules', need('rcc.delay.edit'), route(async (r, req) => {
    const b = req.body ?? {};
    const code = String(b.Code ?? '').trim(); const nameFa = String(b.NameFa ?? '').trim();
    const category = String(b.Category ?? '').trim(); const kind = String(b.Kind ?? '').trim();
    if (!code || code.length > 60 || !nameFa || !LOSS_CATEGORIES.some(c => c.code === category) || !['rate_qty_period', 'amount_pct', 'daily_rate_days', 'actual_sum'].includes(kind)) throw error(400, 'RCC_LOSS_RULE', 'کد، عنوان، دسته و نوع فرمول قاعده معتبر لازم است');
    if (!String(b.SourceFa ?? '').trim()) throw error(400, 'RCC_LOSS_RULE_SOURCE', 'منبع قراردادی/ضابطه‌ای قاعده لازم است؛ فرمول بدون منبع ثبت نمی‌شود');
    const duplicate = await r.findOne('ClaimCalculationRule', [...where(req.params.projectId), { column: 'Code', op: 'eq', value: code }, { column: 'Version', op: 'eq', value: String(b.Version ?? '1.0') }]).catch(() => null);
    if (duplicate) throw error(409, 'RCC_LOSS_RULE_DUP', 'این کد و نسخهٔ قاعده قبلاً ثبت شده است');
    // قواعد هرگز تأییدشده ساخته نمی‌شوند؛ تأیید مسیر جدا و شخص جدا می‌خواهد.
    const row = await r.create('ClaimCalculationRule', { Code: code, NameFa: nameFa, Category: category, Kind: kind, FormulaFa: String(b.FormulaFa ?? ''), SourceFa: String(b.SourceFa ?? ''), Version: String(b.Version ?? '1.0'), Status: 'needs_review', EffectiveFrom: b.EffectiveFrom || null, ProjectId: req.params.projectId }, req.rccSubject.id, 'lossRule');
    await audit(r, req, 'ClaimCalculationRule', row, 'LOSS_RULE_CREATE');
    return row;
  }, 201));
  app.post(base + '/loss-rules/:id/approve', need('rcc.delay.approve'), route(async (r, req) => {
    const row = await r.findOne('ClaimCalculationRule', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: req.params.id }]);
    if (!row) throw error(404, 'RCC_NOT_FOUND', 'قاعده در این پروژه یافت نشد');
    if (row.CreatedBy === req.rccSubject.id) throw error(403, 'RCC_SOD', 'ایجادکننده نمی‌تواند قاعدهٔ خود را تأیید کند');
    if (row.Status === 'approved') throw error(409, 'RCC_LOSS_RULE_APPROVED', 'قاعده قبلاً تأیید شده است');
    if (!String(req.body?.note ?? '').trim()) throw error(400, 'RCC_LOSS_RULE_NOTE', 'یادداشت تأیید قاعده لازم است');
    const patched = await r.patch('ClaimCalculationRule', row.Id, { Status: 'approved', ApprovedBy: req.rccSubject.id, ApprovedAt: new Date().toISOString() }, req.rccSubject.id, row.RowVersion);
    if (!patched.ok) throw error(409, 'RCC_VERSION', 'رکورد هم‌زمان تغییر کرده است');
    const saved = await r.get('ClaimCalculationRule', row.Id);
    await audit(r, req, 'ClaimCalculationRule', saved, 'LOSS_RULE_APPROVE');
    return saved;
  }));
  // ── اجرای موتور محاسبه روی قلم خسارت (append-only) ──
  app.post(base + '/cost-items/:id/calculate', need('rcc.delay.calculate'), route(async (r, req) => {
    const item = await r.findOne('ClaimCostItem', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: req.params.id }]);
    if (!item) throw error(404, 'RCC_NOT_FOUND', 'قلم خسارت در این پروژه یافت نشد');
    const b = req.body ?? {};
    let result; let inputs = (b.inputs ?? {});
    if (b.mode === 'payment_delay') {
      // تأخیر زمانی فقط از محاسبهٔ تأییدشدهٔ ماژول تأخیرات خوانده می‌شود؛ فرمول تکرار نمی‌شود.
      const calc = await r.findOne('DelayCalculation', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: String(b.delayCalculationId ?? '') }]).catch(() => null);
      if (!calc || calc.Status !== 'approved') throw error(422, 'RCC_LOSS_DELAY_SOURCE', 'محاسبهٔ تأخیر تأییدشدهٔ معتبر برای مبنای زمانی لازم است');
      const rule = b.ruleId ? await r.get('ClaimCalculationRule', String(b.ruleId)).catch(() => null) : null;
      const evaluated = evaluatePaymentDelayLoss({ delayDays: Number(calc.FinalValueDays), financialRule: rule, dailyRate: Number(b.dailyRate), currency: item.Currency ?? undefined });
      result = { status: evaluated.status, rawAmount: evaluated.amount, finalAmount: evaluated.amount, ruleVersion: rule?.Version ?? null, issues: evaluated.issues, manualAdjustment: 0, manualReason: null, manualBy: null };
      inputs = { mode: 'payment_delay', delayCalculationId: calc.Id, delayDays: Number(calc.FinalValueDays), dailyRate: Number(b.dailyRate) || null };
      const run = await r.create('ClaimCalculationRun', { ClaimCostItemId: item.Id, RuleId: rule?.Id ?? null, RuleCode: rule?.Code ?? null, RuleVersion: result.ruleVersion, Engine: 'payment-delay-loss-v1', Inputs: inputs, Status: result.status, RawAmount: result.rawAmount, FinalAmount: result.finalAmount, ManualAdjustment: 0, ManualReason: null, Issues: result.issues, CalculatedBy: req.rccSubject.id, CalculatedAt: new Date().toISOString(), ProjectId: req.params.projectId }, req.rccSubject.id, 'lossRun');
      await audit(r, req, 'ClaimCalculationRun', run, 'LOSS_CALCULATE');
      return run;
    }
    const rule = b.ruleId ? await r.get('ClaimCalculationRule', String(b.ruleId)).catch(() => null) : null;
    if (!rule || rule.ProjectId !== req.params.projectId) throw error(400, 'RCC_LOSS_RULE_LINK', 'قاعدهٔ محاسبهٔ معتبر این پروژه لازم است');
    result = evaluateLossRule(rule, inputs, { manualAdjustment: Number(b.manualAdjustment ?? 0), manualReason: typeof b.manualReason === 'string' ? b.manualReason : undefined, manualBy: req.rccSubject.id, itemCurrency: item.Currency ?? undefined });
    const run = await r.create('ClaimCalculationRun', { ClaimCostItemId: item.Id, RuleId: rule.Id, RuleCode: rule.Code, RuleVersion: result.ruleVersion, Engine: 'claim-loss-v1', Inputs: inputs, Status: result.status, RawAmount: result.rawAmount, FinalAmount: result.finalAmount, ManualAdjustment: result.manualAdjustment, ManualReason: result.manualReason, Issues: result.issues, CalculatedBy: req.rccSubject.id, CalculatedAt: new Date().toISOString(), ProjectId: req.params.projectId }, req.rccSubject.id, 'lossRun');
    await audit(r, req, 'ClaimCalculationRun', run, 'LOSS_CALCULATE');
    return run;
  }, 201));
  // ── تخصیص هزینه میان رویدادها؛ سقف ۱۰۰٪ مگر با مبنای مستند ──
  app.post(base + '/cost-items/:id/allocations', need('rcc.delay.edit'), route(async (r, req) => {
    const item = await r.findOne('ClaimCostItem', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: req.params.id }]);
    if (!item) throw error(404, 'RCC_NOT_FOUND', 'قلم خسارت در این پروژه یافت نشد');
    const event = await r.findOne('DelayEvent', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: String(req.body?.DelayEventId ?? '') }]).catch(() => null);
    if (!event) throw error(400, 'RCC_LOSS_ALLOC_EVENT', 'رویداد مقصد تخصیص در این پروژه نیست');
    const pct = Number(req.body?.AllocationPct); const basis = String(req.body?.Basis ?? '').trim();
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw error(400, 'RCC_LOSS_ALLOC_PCT', 'درصد تخصیص باید بین ۰ و ۱۰۰ باشد');
    const existing = await r.list('ClaimCostAllocation', { where: [...where(req.params.projectId), { column: 'ClaimCostItemId', op: 'eq', value: item.Id }], limit: 1000 }).catch(() => []);
    const total = existing.reduce((s, a) => s + (Number(a.AllocationPct) || 0), 0) + pct;
    if (total > 100.0001 && !basis) throw error(422, 'RCC_LOSS_ALLOC_OVER', 'مجموع تخصیص از ۱۰۰٪ می‌گذرد؛ روش تخصیص مستند (مبنا) لازم است');
    const row = await r.create('ClaimCostAllocation', { ClaimCostItemId: item.Id, DelayEventId: event.Id, AllocationPct: pct, Basis: basis || null, ProjectId: req.params.projectId }, req.rccSubject.id, 'lossAllocation');
    await audit(r, req, 'ClaimCostAllocation', row, 'LOSS_ALLOCATE');
    return row;
  }, 201));
  // ── لایحهٔ ضرر و زیان نسخه‌دار (پیش‌نویس تا تأیید مسئول) ──
  app.get(base + '/claims/:id/loss-document', need(['rcc.claim.view', 'rcc.delay.view']), async (req, res, next) => {
    try {
      const r = await repo();
      const claim = await r.findOne('Claim', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: req.params.id }]);
      if (!claim) return res.status(404).json({ ok: false, error: { code: 'RCC_NOT_FOUND', message: 'ادعا در این پروژه یافت نشد', traceId: req.requestId } });
      const format = req.query.format === 'pdf' ? 'pdf' : 'word';
      const delayEvents = await r.list('DelayEvent', { where: [...where(req.params.projectId), { column: 'ClaimCode', op: 'eq', value: claim.Code }], limit: 500 });
      const eventIds = new Set(delayEvents.map(e => e.Id));
      const costItems = (await r.list('ClaimCostItem', { where: where(req.params.projectId), limit: 5000 }).catch(() => [])).filter(i => eventIds.has(i.DelayEventId) || i.ClaimCode === claim.Code);
      const runs = (await r.list('ClaimCalculationRun', { where: where(req.params.projectId), limit: 10000 }).catch(() => [])).filter(x => costItems.some(i => i.Id === x.ClaimCostItemId));
      const rules = await r.list('ClaimCalculationRule', { where: where(req.params.projectId), limit: 5000 }).catch(() => []);
      const allocations = (await r.list('ClaimCostAllocation', { where: where(req.params.projectId), limit: 10000 }).catch(() => [])).filter(a => costItems.some(i => i.Id === a.ClaimCostItemId));
      const versions = await r.list('ClaimDocumentVersion', { where: [...where(req.params.projectId), { column: 'ClaimId', op: 'eq', value: claim.Id }], limit: 5000 }).catch(() => []);
      const documentRows = await r.list('Document', { where: where(req.params.projectId), limit: 5000 }).catch(() => []);
      const documentById = new Map(documentRows.map(d => [d.Id, d]));
      const summary = summarizeLossPortfolio([claim], costItems, runs, versions);
      const caseAmounts = summary.cases.find(c => c.claimCode === claim.Code);
      const doc = buildClaimLossDocument({ projectId: req.params.projectId, claim, delayEvents, costItems, runs, rules, allocations, overlapWarnings: detectCostOverlaps(costItems, allocations), lossSummary: summary, documentById, version: versions.length + 1, format, generatedAt: new Date().toISOString(), generatedBy: req.rccSubject.id });
      if (doc.issues.length) return res.status(422).json({ ok: false, error: { code: 'RCC_LOSS_DOCUMENT_GATE', message: doc.issues.join('؛ '), traceId: req.requestId } });
      const versionRow = await r.create('ClaimDocumentVersion', { ClaimId: claim.Id, ClaimCode: claim.Code, Version: versions.length + 1, Format: format, Status: 'draft', Totals: caseAmounts ?? {}, GeneratedBy: req.rccSubject.id, GeneratedAt: new Date().toISOString(), ProjectId: req.params.projectId }, req.rccSubject.id, 'lossDocument');
      await audit(r, req, 'ClaimDocumentVersion', versionRow, 'LOSS_DOCUMENT');
      if (format === 'pdf') {
        let pdf;
        try { const { htmlToPdf } = await import('./pdfRenderer.js'); pdf = await htmlToPdf(doc.body); }
        catch { return res.status(501).json({ ok: false, error: { code: 'RCC_PDF_UNAVAILABLE', message: 'موتور تولید PDF واقعی روی این سرور در دسترس نیست؛ خروجی Word در دسترس است', traceId: req.requestId } }); }
        res.setHeader('content-type', 'application/pdf');
        res.setHeader('content-disposition', `attachment; filename="${doc.filename.replace(/\.html$/, '.pdf')}"`);
        return res.send(pdf);
      }
      res.setHeader('content-type', doc.contentType);
      res.setHeader('content-disposition', `attachment; filename="${doc.filename}"`);
      return res.send(doc.body);
    } catch (err) { return next(err); }
  });
  app.post(base + '/deadline-alerts/notify', need(['rcc.claim.view', 'rcc.delay.view']), route(async (r, req) => {
    const withinDays = Math.min(30, Math.max(0, Number(req.body?.withinDays ?? 7) || 0));
    const claims = await r.list('Claim', { where: where(req.params.projectId), limit: 5000 });
    const alerts = contractualDeadlineAlerts(claims, day(), 30).filter(alert => alert.daysLeft <= withinDays);
    let created = 0; let emailed = 0;
    const emailConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
    let transporter = null;
    for (const alert of alerts) {
      const recipient = alert.owner;
      if (!recipient) continue;
      const referenceId = `RCC-DEADLINE:${alert.claimId}:${alert.dueAt}`;
      const existing = await r.findOne('CkmInboxItem', [{ column: 'ProjectId', op: 'eq', value: req.params.projectId }, { column: 'RecipientUserId', op: 'eq', value: recipient }, { column: 'ReferenceId', op: 'eq', value: referenceId }]).catch(() => null);
      if (!existing) {
        await r.create('CkmInboxItem', { ProjectId: req.params.projectId, RecipientUserId: recipient, Type: 'action', ReferenceId: referenceId, TitleFa: `مهلت ابلاغ ادعای ${alert.claimCode} در ${alert.dueAt} به پایان می‌رسد (${alert.daysLeft} روز)`, DueAt: alert.dueAt, Status: 'unread', Priority: alert.severity === 'overdue' ? 'critical' : 'high' }, req.rccSubject.id, 'deadlineAlert');
        created++;
      }
      const subject = subjects.find(s => s.id === recipient);
      if (emailConfigured && subject?.email) {
        try {
          transporter ??= (await import('nodemailer')).default.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' } : undefined });
          await transporter.sendMail({ from: process.env.SMTP_FROM, to: subject.email, subject: `هشدار مهلت قراردادی — ${alert.claimCode}`, text: `مهلت ابلاغ ادعای ${alert.claimCode} (${alert.titleFa}) در تاریخ ${alert.dueAt} به پایان می‌رسد. روزهای باقی‌مانده: ${alert.daysLeft}.` });
          emailed++;
        } catch { /* ایمیل نباید اعلان داخلی را متوقف کند */ }
      }
    }
    const summaryRow = { Id: `deadline-alert-${Date.now()}`, Code: 'DEADLINE-ALERTS', Status: 'done' };
    await audit(r, req, 'Claim', summaryRow, 'DEADLINE_ALERT_RUN');
    return { alerts: alerts.length, created, emailed, emailConfigured, withinDays };
  }));
  app.get(base + '/claims/:id/eot-document', need(['rcc.claim.view', 'rcc.delay.view']), async (req, res, next) => {
    try {
      const r = await repo();
      const claim = await r.findOne('Claim', [...where(req.params.projectId), { column: 'Id', op: 'eq', value: req.params.id }]);
      if (!claim) return res.status(404).json({ ok: false, error: { code: 'RCC_NOT_FOUND', message: 'ادعا در این پروژه یافت نشد', traceId: req.requestId } });
      const format = req.query.format === 'pdf' ? 'pdf' : 'word';
      const delayEvents = await r.list('DelayEvent', { where: [...where(req.params.projectId), { column: 'ClaimCode', op: 'eq', value: claim.Code }], limit: 500 });
      const documentRows = await r.list('Document', { where: where(req.params.projectId), limit: 5000 }).catch(() => []);
      const documentById = new Map(documentRows.map(row => [row.Id, row]));
      for (const event of delayEvents) {
        const refs = Array.isArray(event.EvidenceRefs) ? event.EvidenceRefs : [];
        event.EvidenceRefs = refs.map(id => { const document = documentById.get(id); return document ? `${document.DocNo}@${document.Revision}` : String(id); });
      }
      const ids = new Set(delayEvents.map(row => row.Id));
      const calculations = (await r.list('DelayCalculation', { where: where(req.params.projectId), limit: 5000 }).catch(() => [])).filter(row => ids.has(row.DelayEventId));
      const costItems = (await r.list('ClaimCostItem', { where: where(req.params.projectId), limit: 5000 }).catch(() => []))
        .filter(row => ids.has(row.DelayEventId))
        .map(row => ({ ...row, DocumentRefs: (Array.isArray(row.DocumentRefs) ? row.DocumentRefs : []).map(id => { const document = documentById.get(id); return document ? `${document.DocNo}@${document.Revision}` : String(id); }) }));
      const doc = buildClaimDocument({ projectId: req.params.projectId, claim, delayEvents, calculations, costItems, format, generatedAt: new Date().toISOString() });
      if (doc.issues.length) return res.status(422).json({ ok: false, error: { code: 'RCC_EOT_DOCUMENT_GATE', message: doc.issues.join('؛ '), traceId: req.requestId } });
      if (format === 'pdf') {
        let pdf;
        try {
          const { htmlToPdf } = await import('./pdfRenderer.js');
          pdf = await htmlToPdf(doc.body);
        } catch {
          return res.status(501).json({ ok: false, error: { code: 'RCC_PDF_UNAVAILABLE', message: 'موتور تولید PDF واقعی روی این سرور در دسترس نیست؛ خروجی Word در دسترس است', traceId: req.requestId } });
        }
        await audit(r, req, 'Claim', claim, 'EOT_DOCUMENT');
        res.setHeader('content-type', 'application/pdf');
        res.setHeader('content-disposition', `attachment; filename="${doc.filename.replace(/\.html$/, '.pdf')}"`);
        return res.send(pdf);
      }
      await audit(r, req, 'Claim', claim, 'EOT_DOCUMENT');
      res.setHeader('content-type', doc.contentType);
      res.setHeader('content-disposition', `attachment; filename="${doc.filename}"`);
      return res.send(doc.body);
    } catch (err) { return next(err); }
  });
  app.post(base + '/risks/:id/review', need('rcc.risk.edit'), route(async (r, req) => {
    const row = await find(r, req, 'Risk');
    const values = riskReviewPatch(row, req.body ?? {}, req.rccSubject.id, new Date().toISOString());
    const saved = await patch(r, req, 'Risk', row, values);
    await audit(r, req, 'Risk', saved, 'RESERVE_REVIEW');
    return saved;
  }));
  app.post(base + '/issues/:id/transition', need(RCC_PERMISSIONS), route(async (r, req) => {
    const row = await find(r, req, 'RccIssue');
    const action = String(req.body?.action ?? '');
    const rule = ISSUE_TRANSITIONS[action];
    if (!rule) throw error(400, 'RCC_ISSUE_ACTION', 'اقدام مسئله معتبر نیست');
    const permission = rule.actor === 'edit' ? 'rcc.issue.edit' : 'rcc.issue.escalate';
    if (!can(req, permission)) throw error(403, 'RCC_FORBIDDEN', 'مجوز این اقدام مسئله را ندارید');
    if (rule.actor === 'escalate' && row.CreatedBy === req.rccSubject.id) throw error(403, 'RCC_SOD', 'ایجادکننده نمی‌تواند مسئله را تشدید یا ببندد');
    const values = issueTransitionPatch(row, req.body ?? {}, req.rccSubject.id, new Date().toISOString());
    const saved = await patch(r, req, 'RccIssue', row, values);
    await audit(r, req, 'RccIssue', saved, `ISSUE_${action.toUpperCase()}`);
    return saved;
  }));
  app.post(base + '/claims/:id/notice', need('rcc.claim.edit'), route(async (r, req) => {
    const row = await find(r, req, 'Claim');
    if (row.Status !== 'draft' || row.NoticeDeliveredAt) throw error(409, 'RCC_LOCKED', 'ابلاغ قبلاً ثبت شده یا ادعا نهایی است');
    const ref = req.body?.NoticeRef;
    if (typeof ref !== 'string' || !ref.trim() || ref.length > 200 || noticeState(row, day()).dueAt === null) throw error(400, 'RCC_NOTICE', 'مرجع ابلاغ، تاریخ رویداد و مهلت لازم است');
    const deliveredDate = req.body?.DeliveredDate ? isoDay(req.body.DeliveredDate) : day();
    if (deliveredDate > day()) throw error(400, 'RCC_NOTICE_DATE', 'تاریخ ابلاغ نمی‌تواند در آینده باشد');
    if (deliveredDate < String(row.EventDate).slice(0, 10)) throw error(400, 'RCC_NOTICE_DATE', 'تاریخ ابلاغ نمی‌تواند پیش از تاریخ رویداد باشد');
    const deliveredAt = `${deliveredDate}T00:00:00.000Z`;
    // This records the evidence reference and actual delivery date. It does not claim to send mail or perform legal service.
    const saved = await patch(r, req, 'Claim', row, { NoticeRef: ref.trim(), NoticeDate: deliveredDate, NoticeDeliveredAt: deliveredAt, TimeBarred: noticeState({ ...row, NoticeDeliveredAt: deliveredAt }, day()).timeBarred });
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
  app.post(base + '/claims/:id/lifecycle', need(RCC_PERMISSIONS), route(async (r, req) => {
    const row = await find(r, req, 'Claim');
    const action = String(req.body?.action ?? '');
    const rule = CLAIM_LIFECYCLE_TRANSITIONS[action];
    if (!rule) throw error(400, 'RCC_LIFECYCLE', 'اقدام چرخهٔ ادعا معتبر نیست');
    const permission = rule.actor === 'edit' ? 'rcc.claim.edit' : 'rcc.claim.decide';
    if (!can(req, permission)) throw error(403, 'RCC_FORBIDDEN', 'مجوز این اقدام در چرخهٔ ادعا را ندارید');
    if (rule.actor === 'edit' && ![row.CreatedBy, row.SubmittedBy].includes(req.rccSubject.id)) throw error(403, 'RCC_SOD', 'این اقدام فقط برای تنظیم‌کننده یا ارسال‌کنندهٔ ادعا است');
    if (rule.actor === 'decide' && [row.CreatedBy, row.SubmittedBy].includes(req.rccSubject.id)) throw error(403, 'RCC_SOD', 'تنظیم‌کننده یا ارسال‌کننده نمی‌تواند ادعا را تعیین تکلیف کند');
    const values = claimLifecyclePatch(row, req.body ?? {}, req.rccSubject.id, new Date().toISOString());
    const saved = await patch(r, req, 'Claim', row, values);
    await audit(r, req, 'Claim', saved, `LIFECYCLE_${action.toUpperCase()}`);
    return saved;
  }));
}
