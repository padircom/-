/**
 * PMO-CONSTRUCTION-DISPUTE-EXPERT-ENGINE-V1.0 — API ماژول «کارشناسی، داوری
 * و تحلیل دعاوی ساخت».
 *
 * مسیر اختصاصی /api/dispute-expert/:projectId — همهٔ جدول‌های PmisDispute* فقط
 * از همین مسیر خوانده/نوشته می‌شوند (DEDICATED_TABLE_ROUTES). پیوند با RCC,
 * تأخیرات، خسارات، ریسک قرارداد و EDMS نرم است (Code/ID)؛ هیچ داده‌ای از
 * ماژول‌های دیگر بازنویسی نمی‌شود و هیچ محاسبهٔ خسارت/تمدید تکراری انجام
 * نمی‌شود. صدور رأی داوری/حکم در صلاحیت سامانه نیست.
 *
 * SoD زمان اجرا:
 *  - گذر به ready_for_delivery پس از pending_review فقط با dispute.approve و
 *    تأییدکننده ≠ کسی که پرونده را به pending_review برد.
 *  - گذرهای delivered/closed/archived با dispute.approve و تأییدکننده ≠ سازنده.
 *  - ثبت ApprovedAmount با dispute.review و تأییدکننده ≠ ReviewedBy آن رکورد.
 */
import {
  DISPUTE_MODULE_ID,
  DISPUTE_MODULE_VERSION,
  DISPUTE_LLM_CONNECTED,
  DISPUTE_TABLES,
  DISPUTE_CHILD_TABLES,
  DISPUTE_SUBJECTS,
  CASE_STATUSES,
  CASE_STATUS_FA,
  CASE_TRANSITIONS,
  CASE_APPROVAL_TRANSITIONS,
  canTransitionCase,
  caseTransitionNeedsApproval,
  PARTY_ROLES,
  EVIDENCE_DOC_TYPES,
  EVIDENCE_AUTHENTICITY,
  EVIDENCE_SUFFICIENCY,
  CLAIM_REVIEW_STATUSES,
  CLAIM_BASIS_KINDS,
  REFERENCE_SOURCE_KINDS,
  REFERENCE_VERIFICATION,
  REPORT_SECTIONS,
  REPORT_SECTION_FA,
  REPORT_STATUSES,
  CHILD_TABLE_SPECS,
  validateCaseInput,
  validateChildRow,
  validateClaimAmounts,
  validateLegalReference,
  computeDisputeDashboard,
  newCaseCode,
  newRecordCode,
} from "./disputeExpertLogic.js";

const locks = new Map();
async function serial(key, work) {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  locks.set(key, current);
  try { return await current; } finally { if (locks.get(key) === current) locks.delete(key); }
}
function error(status, code, message) { return Object.assign(new Error(message), { status, code }); }

const CHILD_SET = new Set(DISPUTE_CHILD_TABLES);

export function registerDisputeExpertRoutes(app, { repo, subjects, evaluate }) {
  const base = "/api/dispute-expert/:projectId";
  const can = (req, permission) => evaluate(req.disputeSubject, permission, { projectId: req.params.projectId }).allow;
  const need = (perms) => (req, res, next) => {
    const fail = (status, code, message) => res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(req.params.projectId)) return fail(400, "DSP_PROJECT", "شناسهٔ پروژه نامعتبر است");
    req.disputeSubject = subjects.find((s) => s.id === String(req.headers["x-user-id"] || "").trim() && s.active);
    if (!req.disputeSubject) return fail(401, "DSP_AUTH", "هویت معتبر الزامی است");
    if (!(Array.isArray(perms) ? perms : [perms]).some((p) => can(req, p))) return fail(403, "DSP_FORBIDDEN", "مجوز اقدام یا دسترسی به پروژه را ندارید");
    next();
  };
  const where = (projectId) => [{ column: "ProjectId", op: "eq", value: projectId }];
  const findCase = async (r, req) => {
    const row = await r.findOne("PmisDisputeCases", [...where(req.params.projectId), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw error(404, "DSP_NOT_FOUND", "پرونده در این پروژه یافت نشد");
    return row;
  };
  const run = (handler) => async (req, res, next) => {
    try {
      const work = async () => handler(await repo(), req);
      const out = req.method === "GET" ? await work() : await serial(`dispute-expert:${req.params.projectId}`, work);
      res.json({ ok: true, data: out });
    } catch (e) {
      if (e?.status) return res.status(e.status).json({ ok: false, error: { code: e.code, message: e.message, traceId: req.requestId } });
      next(e);
    }
  };
  const audit = async (r, projectId, caseCode, action, actor, detailFa, fromValue, toValue) => {
    try {
      await r.create("PmisDisputeAuditTrail", {
        Code: newRecordCode("audit"), CaseCode: caseCode, ProjectId: projectId,
        Action: action, Actor: actor, DetailFa: detailFa ?? null,
        FromValue: fromValue ?? null, ToValue: toValue ?? null, OccurredAt: new Date().toISOString(),
      }, actor, "dispute");
    } catch { /* ممیزی فرعی شکستش جریان اصلی را متوقف نمی‌کند */ }
  };
  const today = () => new Date().toISOString().slice(0, 10);

  /* ── کاتالوگ قاعده‌محور (فقط‌خواندنی) ── */
  app.get(base + "/catalog", need("dispute.view"), run(async () => ({
    module: DISPUTE_MODULE_ID,
    version: DISPUTE_MODULE_VERSION,
    llmConnected: DISPUTE_LLM_CONNECTED,
    ruleBasedAssistanceNoteFa: "دستیار این ماژول قاعده‌محور است؛ اتصال مدل زبانی در این محیط فعال نیست و خروجی‌ها صریحاً پیش‌نویس انسانی‌اند. صدور رأی داوری/قضایی خارج از صلاحیت این سامانه است.",
    permissions: ["dispute.view", "dispute.edit", "dispute.review", "dispute.approve"],
    tables: DISPUTE_TABLES,
    childTables: DISPUTE_CHILD_TABLES,
    subjects: DISPUTE_SUBJECTS,
    caseStatuses: CASE_STATUSES.map((s) => ({ code: s, fa: CASE_STATUS_FA[s], to: CASE_TRANSITIONS[s] })),
    approvalTransitions: CASE_APPROVAL_TRANSITIONS,
    partyRoles: PARTY_ROLES,
    evidenceDocTypes: EVIDENCE_DOC_TYPES,
    evidenceRuleFa: "اصالت و کفایت مدرک مستقل از وجود فایل ثبت می‌شود؛ بارگذاری فایل به‌خودی‌خود اصالت حقوقی نمی‌سازد.",
    evidenceAuthenticity: EVIDENCE_AUTHENTICITY,
    evidenceSufficiency: EVIDENCE_SUFFICIENCY,
    claimBasisKinds: CLAIM_BASIS_KINDS,
    claimReviewStatuses: CLAIM_REVIEW_STATUSES,
    referenceSourceKinds: REFERENCE_SOURCE_KINDS,
    referenceVerification: REFERENCE_VERIFICATION,
    referenceRuleFa: "هیچ ماده قانونی/رأی/بخشنامه‌ای جعل نمی‌شود؛ منبع بدون متن معتبر «تأییدنشده» برچسب می‌خورد. هوش مصنوعی (در صورت فعال‌بودن) جایگزین بررسی حقوقی متخصص نیست.",
    reportSections: REPORT_SECTIONS.map((key) => ({ key, fa: REPORT_SECTION_FA[key] })),
    reportStatuses: REPORT_STATUSES,
    amountsRuleFa: "مبلغ مورد مطالبه، بررسی‌شده و تأییدشده سه لایهٔ جدا هستند؛ هیچ مبلغی بدون مبنا ثبت/نمایش داده نمی‌شود و محاسبهٔ خسارت تکراری نمی‌شود (ارجاع به ماژول ضرر و زیان).",
  })));

  /* ── داشبورد مدیریتی (دادهٔ واقعی) ── */
  app.get(base + "/dashboard", need("dispute.view"), run(async (r, req) => {
    const w = where(req.params.projectId);
    const cases = await r.list("PmisDisputeCases", { where: w, limit: 500 }).catch(() => []);
    const claims = await r.list("PmisDisputeClaims", { where: w, limit: 2000 }).catch(() => []);
    const reports = await r.list("PmisDisputeReports", { where: w, limit: 500 }).catch(() => []);
    const deadlines = await r.list("PmisDisputeDeadlines", { where: w, limit: 1000 }).catch(() => []);
    return computeDisputeDashboard(cases, claims, reports, deadlines, today());
  }));

  /* ── فهرست پرونده‌ها ── */
  app.get(base + "/cases", need("dispute.view"), run(async (r, req) => {
    const w = where(req.params.projectId);
    const cases = (await r.list("PmisDisputeCases", { where: w, limit: 500 }).catch(() => []))
      .sort((a, b) => String(b.Code).localeCompare(String(a.Code)));
    return { cases };
  }));

  /* ── ایجاد پرونده ── */
  app.post(base + "/cases", need("dispute.edit"), run(async (r, req) => {
    const b = req.body ?? {};
    const v = validateCaseInput(b);
    if (!v.ok) throw error(400, "DSP_VALIDATION", v.errors.join("؛ "));
    const code = String(b.Code ?? "").trim() || newCaseCode();
    const dup = await r.findOne("PmisDisputeCases", [...where(req.params.projectId), { column: "Code", op: "eq", value: code }]);
    if (dup) throw error(409, "DSP_DUP", "شمارهٔ پرونده در این پروژه تکراری است");
    const row = await r.create("PmisDisputeCases", {
      Code: code, TitleFa: String(b.TitleFa).trim(), SubjectCode: b.SubjectCode,
      DescriptionFa: b.DescriptionFa ?? null, EmployerFa: b.EmployerFa ?? null, ContractorFa: b.ContractorFa ?? null,
      ConsultantFa: b.ConsultantFa ?? null, CourtRefFa: b.CourtRefFa ?? null, ExpertScopeFa: b.ExpertScopeFa ?? null,
      ClaimDescriptionFa: b.ClaimDescriptionFa ?? null, ClaimedAmount: b.ClaimedAmount ?? null, Currency: b.Currency ?? "IRR",
      ClaimedDelayDays: b.ClaimedDelayDays ?? null, ContractCode: b.ContractCode ?? null, ClaimCode: b.ClaimCode ?? null,
      DelayEventCode: b.DelayEventCode ?? null, DelayCaseId: b.DelayCaseId ?? null, LossCaseId: b.LossCaseId ?? null,
      ContractRiskId: b.ContractRiskId ?? null, IncidentDate: b.IncidentDate ?? null, RegistrationDate: b.RegistrationDate ?? today(),
      ResponseDeadline: b.ResponseDeadline ?? null, DeliveryDeadline: b.DeliveryDeadline ?? null,
      Priority: b.Priority ?? "normal", InternalOwnerFa: b.InternalOwnerFa ?? null,
      Status: "draft", CreatedBy: req.disputeSubject.id, StatusChangedBy: req.disputeSubject.id,
      StatusChangedAt: new Date().toISOString(), ExpertNoteFa: b.ExpertNoteFa ?? null,
      ProjectId: req.params.projectId,
    }, req.disputeSubject.id, "dispute");
    await audit(r, req.params.projectId, code, "case_created", req.disputeSubject.id, "پرونده ایجاد شد", null, "draft");
    return { case: row };
  }));

  /* ── جزئیات یک پرونده + رکوردهای فرزند ── */
  app.get(base + "/cases/:id", need("dispute.view"), run(async (r, req) => {
    const row = await findCase(r, req);
    const children = {};
    for (const t of DISPUTE_CHILD_TABLES) {
      children[t] = await r.list(t, { where: [...where(req.params.projectId), { column: "CaseCode", op: "eq", value: row.Code }], limit: 5000 }).catch(() => []);
    }
    return { case: row, children };
  }));

  /* ── ویرایش پرونده (مادامی‌که نهایی نشده) ── */
  app.patch(base + "/cases/:id", need("dispute.edit"), run(async (r, req) => {
    const row = await findCase(r, req);
    if (["delivered", "closed", "archived"].includes(row.Status)) throw error(409, "DSP_STATUS", "پروندهٔ تحویل‌شده/مختومه/بایگانی قابل ویرایش نیست");
    const merged = { ...row, ...(req.body ?? {}) };
    delete merged.Id; delete merged.Code; delete merged.ProjectId; delete merged.CreatedBy; delete merged.StatusChangedBy; delete merged.StatusChangedAt; delete merged.Status;
    const v = validateCaseInput(merged);
    if (!v.ok) throw error(400, "DSP_VALIDATION", v.errors.join("؛ "));
    const allowed = ["TitleFa", "SubjectCode", "DescriptionFa", "EmployerFa", "ContractorFa", "ConsultantFa", "CourtRefFa", "ExpertScopeFa", "ClaimDescriptionFa", "ClaimedAmount", "Currency", "ClaimedDelayDays", "ContractCode", "ClaimCode", "DelayEventCode", "DelayCaseId", "LossCaseId", "ContractRiskId", "IncidentDate", "RegistrationDate", "ResponseDeadline", "DeliveryDeadline", "Priority", "InternalOwnerFa", "ExpertNoteFa"];
    const patch = {};
    for (const k of allowed) if (k in merged) patch[k] = merged[k] ?? null;
    const updated = await r.patch("PmisDisputeCases", row.Id, patch, req.disputeSubject.id, row.RowVersion);
    await audit(r, req.params.projectId, row.Code, "case_updated", req.disputeSubject.id, "اطلاعات پرونده ویرایش شد", null, null);
    return { case: updated };
  }));

  /* ── گذر وضعیت؛ gate تأیید و SoD ── */
  app.post(base + "/cases/:id/transition", need(["dispute.edit", "dispute.approve"]), run(async (r, req) => {
    const row = await findCase(r, req);
    const to = String(req.body?.to ?? "");
    const note = String(req.body?.noteFa ?? "").trim();
    if (!CASE_STATUSES.includes(to)) throw error(400, "DSP_VALIDATION", "وضعیت مقصد نامعتبر است");
    if (!canTransitionCase(row.Status, to)) throw error(409, "DSP_STATUS", `گذر از «${row.Status}» به «${to}» مجاز نیست`);
    const patch = { Status: to, StatusChangedBy: req.disputeSubject.id, StatusChangedAt: new Date().toISOString(), StatusNoteFa: note || null };
    if (caseTransitionNeedsApproval(to)) {
      if (!can(req, "dispute.approve")) throw error(403, "DSP_FORBIDDEN", "این گذر نیازمند مجوز تأیید است");
      /* SoD: تأییدکنندهٔ آماده تحویل نباید کسی باشد که پرونده را به بازبینی برده است. */
      if (to === "ready_for_delivery" && row.StatusChangedBy === req.disputeSubject.id) throw error(403, "DSP_SOD", "کسی که پرونده را به بازبینی ارجاع داده نمی‌تواند آماده‌بودن تحویل را تأیید کند");
      if (["delivered", "closed", "archived"].includes(to) && row.CreatedBy === req.disputeSubject.id) throw error(403, "DSP_SOD", "سازندهٔ پرونده اجازهٔ تأیید این گذر را ندارد");
    }
    const updated = await r.patch("PmisDisputeCases", row.Id, patch, req.disputeSubject.id, row.RowVersion);
    await audit(r, req.params.projectId, row.Code, "status_changed", req.disputeSubject.id, note || undefined, row.Status, to);
    return { case: updated };
  }));

  /* ── حذف پرونده: فقط draft و بدون رکورد فرزند ── */
  app.delete(base + "/cases/:id", need("dispute.edit"), run(async (r, req) => {
    const row = await findCase(r, req);
    if (row.Status !== "draft") throw error(409, "DSP_STATUS", "فقط پروندهٔ پیش‌نویس حذف می‌شود");
    for (const t of DISPUTE_CHILD_TABLES) {
      const rows = await r.list(t, { where: [...where(req.params.projectId), { column: "CaseCode", op: "eq", value: row.Code }], limit: 1 }).catch(() => []);
      if (rows.length > 0) throw error(409, "DSP_CHILDREN", "پرونده دارای رکورد فرزند است و حذف نمی‌شود");
    }
    await r.remove("PmisDisputeCases", row.Id);
    await audit(r, req.params.projectId, row.Code, "case_deleted", req.disputeSubject.id, "پروندهٔ پیش‌نویس حذف شد", row.Code, null);
    return { deleted: true, code: row.Code };
  }));

  /* ── ثبت رکورد فرزند با اعتبارسنجی + قاعدهٔ مبالغ ── */
  app.post(base + "/cases/:id/rows/:table", need("dispute.edit"), run(async (r, req) => {
    const table = String(req.params.table);
    if (!CHILD_SET.has(table)) throw error(400, "DSP_TABLE", "جدول فرزند نامعتبر است");
    const row = await findCase(r, req);
    if (["closed", "archived"].includes(row.Status)) throw error(409, "DSP_STATUS", "پروندهٔ مختومه/بایگانی تغییر نمی‌پذیرد");
    const specKey = table;
    const v = validateChildRow(specKey, req.body ?? {});
    if (!v.ok) throw error(400, "DSP_VALIDATION", v.errors.join("؛ "));
    /* قاعدهٔ مبالغ لایه‌بندی در ادعاها */
    if (table === "PmisDisputeClaims") {
      const av = validateClaimAmounts(req.body ?? {});
      if (!av.ok) throw error(400, "DSP_AMOUNTS", av.errors.join("؛ "));
    }
    if (table === "PmisDisputeModuleLinks") {
      const rv = validateLegalReference({ SourceKind: "contract_clause", TitleFa: req.body?.TargetTitleFa, Verification: "unverified" });
      if (!rv.ok) throw error(400, "DSP_LINK", rv.errors.join("؛ "));
    }
    const code = String(req.body?.Code ?? "").trim() || newRecordCode(table.replace("PmisDispute", ""));
    const dup = await r.findOne(table, [...where(req.params.projectId), { column: "CaseCode", op: "eq", value: row.Code }, { column: "Code", op: "eq", value: code }]);
    if (dup) throw error(409, "DSP_DUP", "کد رکورد در این پرونده تکراری است");
    const body = { ...(req.body ?? {}) };
    delete body.Id; delete body.ProjectId; delete body.CaseCode;
    const created = await r.create(table, { Code: code, CaseCode: row.Code, ProjectId: req.params.projectId, ...body }, req.disputeSubject.id, "dispute");
    await audit(r, req.params.projectId, row.Code, `${table.replace("PmisDispute", "").toLowerCase()}_added`, req.disputeSubject.id, `ثبت ${code}`, null, code);
    return { row: created };
  }));

  /* ── ویرایش رکورد فرزند ── */
  app.patch(base + "/cases/:id/rows/:table/:rowId", need("dispute.edit"), run(async (r, req) => {
    const table = String(req.params.table);
    if (!CHILD_SET.has(table)) throw error(400, "DSP_TABLE", "جدول فرزند نامعتبر است");
    const row = await findCase(r, req);
    if (["closed", "archived"].includes(row.Status)) throw error(409, "DSP_STATUS", "پروندهٔ مختومه/بایگانی تغییر نمی‌پذیرد");
    const existing = await r.findOne(table, [...where(req.params.projectId), { column: "CaseCode", op: "eq", value: row.Code }, { column: "Id", op: "eq", value: req.params.rowId }]);
    if (!existing) throw error(404, "DSP_NOT_FOUND", "رکورد یافت نشد");
    const merged = { ...existing, ...(req.body ?? {}), Id: existing.Id };
    const v = validateChildRow(table, merged);
    if (!v.ok) throw error(400, "DSP_VALIDATION", v.errors.join("؛ "));
    if (table === "PmisDisputeClaims") {
      const av = validateClaimAmounts(merged);
      if (!av.ok) throw error(400, "DSP_AMOUNTS", av.errors.join("؛ "));
    }
    const patch = { ...(req.body ?? {}) };
    delete patch.Id; delete patch.ProjectId; delete patch.CaseCode; delete patch.Code;
    /* SoD ادعا: ثبت ApprovedAmount با dispute.review و تأییدکننده ≠ ReviewedBy */
    if (table === "PmisDisputeClaims" && patch.ApprovedAmount !== undefined && patch.ApprovedAmount !== null && patch.ApprovedAmount !== "") {
      if (!can(req, "dispute.review")) throw error(403, "DSP_FORBIDDEN", "تأیید مبلغ نیازمند مجوز بازبینی است");
      if (existing.ReviewedBy && existing.ReviewedBy === req.disputeSubject.id) throw error(403, "DSP_SOD", "کسی که مبلغ را بررسی کرده نمی‌تواند تأییدش را هم بکند");
      patch.ApprovedBy = req.disputeSubject.id;
      patch.ApprovedAt = new Date().toISOString();
    }
    if (table === "PmisDisputeClaims" && patch.ReviewedAmount !== undefined && patch.ReviewedAmount !== null && patch.ReviewedAmount !== "") {
      if (!can(req, "dispute.review")) throw error(403, "DSP_FORBIDDEN", "بررسی مبلغ نیازمند مجوز بازبینی است");
      patch.ReviewedBy = req.disputeSubject.id;
      patch.ReviewedAt = new Date().toISOString();
    }
    const updated = await r.patch(table, existing.Id, patch, req.disputeSubject.id, existing.RowVersion);
    await audit(r, req.params.projectId, row.Code, `${table.replace("PmisDispute", "").toLowerCase()}_updated`, req.disputeSubject.id, `ویرایش ${existing.Code}`, null, null);
    return { row: updated };
  }));

  /* ── حذف رکورد فرزند: محدودبه draft/rejected و بدون مرجع نهایی ── */
  app.delete(base + "/cases/:id/rows/:table/:rowId", need("dispute.edit"), run(async (r, req) => {
    const table = String(req.params.table);
    if (!CHILD_SET.has(table)) throw error(400, "DSP_TABLE", "جدول فرزند نامعتبر است");
    const row = await findCase(r, req);
    if (["closed", "archived"].includes(row.Status)) throw error(409, "DSP_STATUS", "پروندهٔ مختومه/بایگانی تغییر نمی‌پذیرد");
    const existing = await r.findOne(table, [...where(req.params.projectId), { column: "CaseCode", op: "eq", value: row.Code }, { column: "Id", op: "eq", value: req.params.rowId }]);
    if (!existing) throw error(404, "DSP_NOT_FOUND", "رکورد یافت نشد");
    /* رکوردهای نهایی‌شده حذف نمی‌شوند — جلوگیری از حذف غیرمجاز مستندات */
    if (table === "PmisDisputeReports" && ["issued", "approved"].includes(existing.Status)) throw error(409, "DSP_ISSUED", "نسخهٔ گزارش صادرشده/تأییدشده حذف نمی‌شود؛ از جایگزینی نسخه استفاده کنید");
    if (table === "PmisDisputeOpinions" && ["final", "approved"].includes(existing.ReviewStatus)) throw error(409, "DSP_FINAL", "نظریهٔ نهایی‌شده حذف نمی‌شود؛ نسخهٔ اصلاح‌شده بسازید");
    if (table === "PmisDisputeClaims" && existing.ApprovedAmount !== null && existing.ApprovedAmount !== undefined) throw error(409, "DSP_APPROVED", "ادعای دارای مبلغ تأییدشده حذف نمی‌شود؛ ابتدا تصمیم تأیید برگردانده شود");
    if (table === "PmisDisputeAuditTrail") throw error(403, "DSP_AUDIT", "رویدادهای تاریخچه حذف نمی‌شوند");
    await r.remove(table, existing.Id);
    await audit(r, req.params.projectId, row.Code, `${table.replace("PmisDispute", "").toLowerCase()}_deleted`, req.disputeSubject.id, `حذف ${existing.Code}`, existing.Code, null);
    return { deleted: true, code: existing.Code };
  }));
}
