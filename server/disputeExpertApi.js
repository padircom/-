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
  LINK_KINDS,
  LINK_KIND_FA,
  ANALYSIS_APPROVAL_FA,
  analyzeClaim,
  summarizeCaseFindings,
  renderFindingsLines,
  CLAIM_ANALYSIS_METHOD_FA,
  CALC_TOTALS_METHOD_FA,
  REPORT_STATUS_FA,
  canTransitionReport,
  validateOpinionSources,
  MANAGEABLE_KINDS,
  buildManagementReport,
} from "./disputeExpertLogic.js";
import { buildExpertReport } from "./disputeExpertDocLogic.js";

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
    /* صداقت منابع نظریه: هر منبع باید رکوردی واقعی در همین پرونده باشد */
    if (table === "PmisDisputeOpinions" && req.body?.SourcesJson !== undefined) {
      const sv = validateOpinionSources(req.body.SourcesJson, await sourceCodeSets(r, req.params.projectId, row.Code));
      if (!sv.ok) throw error(400, "DSP_SOURCES", sv.errors.join("؛ "));
    }
    const code = String(req.body?.Code ?? "").trim() || newRecordCode(table.replace("PmisDispute", ""));
    const dup = await r.findOne(table, [...where(req.params.projectId), { column: "CaseCode", op: "eq", value: row.Code }, { column: "Code", op: "eq", value: code }]);
    if (dup) throw error(409, "DSP_DUP", "کد رکورد در این پرونده تکراری است");
    const body = { ...(req.body ?? {}) };
    delete body.Id; delete body.ProjectId; delete body.CaseCode;
    /* اعتبار نویسندگی سمت سرور: نظریهٔ دستی به نام نویسندهٔ فعلی ثبت شود تا SoD بگیرد */
    if (table === "PmisDisputeOpinions") { body.AuthoredBy = req.disputeSubject.id; body.AuthoredAt = new Date().toISOString(); }
    if (table === "PmisDisputeAnalyses" && !String(body.AnalyzedBy ?? "").trim()) { body.AnalyzedBy = req.disputeSubject.id; body.AnalyzedAt = new Date().toISOString(); }
    const created = await r.create(table, { Code: code, CaseCode: row.Code, ProjectId: req.params.projectId, ...body }, req.disputeSubject.id, "dispute");
    await audit(r, req.params.projectId, row.Code, `${table.replace("PmisDispute", "").toLowerCase()}_added`, req.disputeSubject.id, `ثبت ${code}`, null, code);
    /* جلسه با مهلت پاسخ پرسش → مهلت خودکار (قاعده‌محور، شفاف در حسابرسی) */
    if (table === "PmisDisputeHearings" && req.body?.QuestionDeadline) {
      const dlCode = newRecordCode("Deadlines");
      try {
        await r.create("PmisDisputeDeadlines", {
          Code: dlCode, CaseCode: row.Code, ProjectId: req.params.projectId,
          TitleFa: `مهلت پاسخ به پرسش‌های جلسهٔ ${code}`, Kind: "question",
          DueDate: String(req.body.QuestionDeadline), RelatedCode: code, Status: "open",
        }, req.disputeSubject.id, "dispute");
        await audit(r, req.params.projectId, row.Code, "deadline_auto_created", req.disputeSubject.id, `مهلت خودکار ${dlCode} بر پایهٔ QuestionDeadline جلسهٔ ${code}`, null, dlCode);
      } catch { /* ایجاد مهلت فرعی شکستش جریان جلسه را متوقف نمی‌کند */ }
    }
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
    /* صداقت منابع نظریه در ویرایش */
    if (table === "PmisDisputeOpinions" && patch.SourcesJson !== undefined) {
      const sv = validateOpinionSources(patch.SourcesJson, await sourceCodeSets(r, req.params.projectId, row.Code));
      if (!sv.ok) throw error(400, "DSP_SOURCES", sv.errors.join("؛ "));
    }
    /* تحلیل: هر تغییر ApprovalStatus فقط با dispute.review؛ تأیید با SoD (تأییدکننده ≠ تحلیل‌گر) */
    if (table === "PmisDisputeAnalyses" && patch.ApprovalStatus !== undefined) {
      if (!can(req, "dispute.review")) throw error(403, "DSP_FORBIDDEN", "تغییر وضعیت تأیید تحلیل نیازمند مجوز بازبینی است");
      if (patch.ApprovalStatus === "approved") {
        if (String(existing.AnalyzedBy ?? "") === req.disputeSubject.id) throw error(403, "DSP_SOD", "تحلیل‌گر نمی‌تواند تحلیل خود را تأیید کند");
        patch.ApprovedBy = req.disputeSubject.id;
        patch.ApprovedAt = new Date().toISOString();
      } else { patch.ApprovedBy = null; patch.ApprovedAt = null; }
    }
    /* نظریه (گام بعدی): نهایی‌سازی فقط با dispute.review؛ مؤلف ≠ نهایی‌کننده */
    if (table === "PmisDisputeOpinions" && patch.ReviewStatus !== undefined) {
      if (!can(req, "dispute.review")) throw error(403, "DSP_FORBIDDEN", "تغییر وضعیت نظریه نیازمند مجوز بازبینی است");
      if (["final", "approved"].includes(String(patch.ReviewStatus)) && String(existing.AuthoredBy ?? "") === req.disputeSubject.id)
        throw error(403, "DSP_SOD", "مؤلف نظریه نمی‌تواند همان را نهایی کند");
      if (["final", "approved"].includes(String(patch.ReviewStatus))) patch.ReviewedBy = req.disputeSubject.id;
    }
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

  /* ═══════════ فاز ۳ — سرویس‌های قاعده‌محور (تحلیل/محاسبه/پیوند) ═══════════ */

  const childWhere = (projectId, caseCode) => [...where(projectId), { column: "CaseCode", op: "eq", value: caseCode }];
  const listChild = (r, table, projectId, caseCode) => r.list(table, { where: childWhere(projectId, caseCode), limit: 5000 }).catch(() => []);
  /** مجموعهٔ کدهای موجود هر نوع منبع در پرونده — برای کنترل صداقت منابع نظریه */
  const sourceCodeSets = async (r, projectId, caseCode) => ({
    evidence: new Set((await listChild(r, "PmisDisputeEvidence", projectId, caseCode)).map((x) => String(x.Code))),
    analysis: new Set((await listChild(r, "PmisDisputeAnalyses", projectId, caseCode)).map((x) => String(x.Code))),
    claim: new Set((await listChild(r, "PmisDisputeClaims", projectId, caseCode)).map((x) => String(x.Code))),
    module_link: new Set((await listChild(r, "PmisDisputeModuleLinks", projectId, caseCode)).map((x) => String(x.Code))),
    hearing: new Set((await listChild(r, "PmisDisputeHearings", projectId, caseCode)).map((x) => String(x.Code))),
    deadline: new Set((await listChild(r, "PmisDisputeDeadlines", projectId, caseCode)).map((x) => String(x.Code))),
  });
  /** upsert در ستون ثابت Code داخل پرونده؛ بازتولیدِ تحلیل، تأیید انسانی قبلی را باطل می‌کند. */
  const upsertChild = async (r, table, projectId, caseCode, code, payload, actor) => {
    const existing = await r.findOne(table, [...childWhere(projectId, caseCode), { column: "Code", op: "eq", value: code }]);
    if (!existing) return { row: await r.create(table, { ...payload, Code: code, CaseCode: caseCode, ProjectId: projectId }, actor, "dispute"), created: true, invalidatedApproval: false };
    const patch = { ...payload };
    delete patch.Code; delete patch.CaseCode; delete patch.ProjectId;
    const invalidated = existing.ApprovalStatus === "approved";
    if (table === "PmisDisputeAnalyses" || table === "PmisDisputeOpinions") {
      if (invalidated) { patch.ApprovedBy = null; patch.ApprovedAt = null; }
    }
    return { row: await r.patch(table, existing.Id, patch, actor, existing.RowVersion), created: false, invalidatedApproval: invalidated };
  };

  /* ── اجرای تحلیل قاعده‌محور: برای هر ادعا یک رکورد تحلیل + یک جمع‌بندی پرونده ── */
  app.post(base + "/cases/:id/analysis/run", need("dispute.review"), run(async (r, req) => {
    const row = await findCase(r, req);
    if (["closed", "archived"].includes(row.Status)) throw error(409, "DSP_STATUS", "پرونده مختومه/بایگانی است");
    const pid = req.params.projectId, cc = row.Code, actor = req.disputeSubject.id;
    const [claims, evidence, responses, links, parties, deadlines] = await Promise.all([
      listChild(r, "PmisDisputeClaims", pid, cc), listChild(r, "PmisDisputeEvidence", pid, cc),
      listChild(r, "PmisDisputeResponses", pid, cc), listChild(r, "PmisDisputeModuleLinks", pid, cc),
      listChild(r, "PmisDisputeParties", pid, cc), listChild(r, "PmisDisputeDeadlines", pid, cc),
    ]);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const results = [];
    let invalidated = 0;
    for (const c of claims) {
      const findings = analyzeClaim(c, evidence, responses, links);
      const crit = findings.filter((f) => f.severity === "critical").length;
      const warn = findings.filter((f) => f.severity === "warning").length;
      const suggestion = crit > 0
        ? `${crit} یافتهٔ بحرانی شناسایی شد؛ پیش از اتکای این ادعا در گزارش کارشناسی، موارد بحرانی رفع یا در گزارش صریحاً محدودیت اعلام شود. (پیش‌نویس قاعده‌محور — صدور رأی در صلاحیت سامانه نیست)`
        : warn > 0
          ? `${warn} هشدار؛ تکمیل داده توصیه می‌شود. هیچ یافتهٔ بحرانی‌ای توسط کنترل‌های قاعده‌محور ثبت نشد. (پیش‌نویس قاعده‌محور — نیازمند بازبینی و تأیید کارشناس)`
          : "کنترل‌های قاعده‌محور مورد بحرانی/هشداری ثبت نکردند. این نتیجه صرفاً بر داده‌های ثبت‌شده تکیه دارد و معادل نظر کارشناسی نهایی نیست.";
      const up = await upsertChild(r, "PmisDisputeAnalyses", pid, cc, `ANA-${c.Code}`, {
        TopicFa: `تحلیل خودکار ادعای «${c.TitleFa ?? c.Code}»`,
        QuestionFa: "جایگاه این ادعا در داده‌های ثبت‌شدهٔ پرونده چیست؟ (مبالغ، استناد، مدارک، دفاع، پیوندها)",
        MethodFa: CLAIM_ANALYSIS_METHOD_FA,
        InputDataJson: { claimCode: c.Code, basisKind: c.BasisKind, findings, generatedAt: now },
        EvidenceRefs: evidence.map((e) => e.Code).slice(0, 200),
        AssumptionsFa: "فرض تحلیل: فقط داده‌های ثبت‌شده در پرونده معتبرند؛ هیچ سند/رسیدی خارج از پرونده فرض نشده است.",
        ResultsFa: renderFindingsLines(findings),
        UncertaintiesFa: "هر آیتم «اصالت در انتظار/احرازنشده» حکم قطعی ندارد؛ اعتبارسنجی اسناد مسئولیت کارشناس انسانی است.",
        InfoGapsFa: renderFindingsLines(findings.filter((f) => f.severity !== "info")),
        MethodLimitsFa: "تحلیل خودکار محتوای متن اسناد را نمی‌خواند و سوابق خارج از این پرونده را ندارد؛ چارچوب زمانی‌اش هنگام اجراست.",
        SuggestedConclusionFa: suggestion,
        AnalyzedBy: "DisputeClaimAnalysisService/v1.0",
        AnalyzedAt: now,
        ApprovalStatus: "draft",
      }, actor);
      if (up.invalidatedApproval) invalidated += 1;
      results.push({ code: up.row.Code, claimCode: c.Code, findings: findings.length, critical: crit });
    }
    /* جمع‌بندی سطح پرونده */
    const agg = summarizeCaseFindings(claims, links, deadlines, today);
    const aggCrit = agg.findings.filter((f) => f.severity === "critical").length;
    const up2 = await upsertChild(r, "PmisDisputeAnalyses", pid, cc, "ANA-SUMMARY", {
      TopicFa: `جمع‌بندی خودکار پرونده ${cc}`,
      QuestionFa: "وضعیت کلی داده‌های پرونده برای تهیهٔ گزارش کارشناسی چیست؟",
      MethodFa: CLAIM_ANALYSIS_METHOD_FA,
      InputDataJson: { totals: agg.totals, findings: agg.findings, generatedAt: now, partyCount: parties.length, linkCount: links.length },
      EvidenceRefs: evidence.map((e) => e.Code).slice(0, 200),
      ResultsFa: renderFindingsLines(agg.findings),
      AssumptionsFa: "جمع‌بندی صرفاً بر رکوردهای این پرونده است؛ لایهٔ «تأییدشدهٔ صفر» یعنی تأییدی انجام نشده — نه رد.",
      InfoGapsFa: renderFindingsLines(agg.findings.filter((f) => f.severity !== "info")),
      MethodLimitsFa: "مقادیر ماژول‌های دیگر (تأخیر/خسارت/ریسک قراردادی) فقط‌خواندنی و نمایشی‌اند و در این سرویس بازمحاسبه نمی‌شوند.",
      SuggestedConclusionFa: aggCrit > 0
        ? `${aggCrit} موضوع بحرانی در سطح پرونده — پیش از تدوین گزارش کارشناسی رفع/ابلاغ شود. صدور نظر نهایی با کارشناس انسانی است.`
        : "از منظر کنترل‌های قاعده‌محور، مانع داده‌ای بحرانی در سطح پرونده ثبت نشد؛ کارشناس همچنان باید محتوا را قضاوت کند.",
      AnalyzedBy: "DisputeExpertAnalysisEngine/v1.0",
      AnalyzedAt: now,
      ApprovalStatus: "draft",
    }, actor);
    if (up2.invalidatedApproval) invalidated += 1;
    await audit(r, pid, cc, "analysis_run", actor, `اجرای تحلیل قاعده‌محور: ${results.length} ادعا + جمع‌بندی${invalidated ? ` (ابطال ${invalidated} تأیید پیشین به سبب بازتولید)` : ""}`, null, null);
    return { generated: results.length + 1, summary: up2.row.Code, analyses: results, invalidatedApprovalCount: invalidated, llmConnected: DISPUTE_LLM_CONNECTED };
  }));

  /* ── بازمحاسبهٔ شاخص‌های جمع (محاسبهٔ مستقل «برای مقایسه» — نه جایگزینی) ── */
  app.post(base + "/cases/:id/calculations/recalc", need("dispute.review"), run(async (r, req) => {
    const row = await findCase(r, req);
    if (["closed", "archived"].includes(row.Status)) throw error(409, "DSP_STATUS", "پرونده مختومه/بایگانی است");
    const pid = req.params.projectId, cc = row.Code, actor = req.disputeSubject.id;
    const claims = await listChild(r, "PmisDisputeClaims", pid, cc);
    const now = new Date().toISOString();
    const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
    const sumOf = (f) => claims.reduce((a, c) => a + (c[f] === null || c[f] === undefined || c[f] === "" ? 0 : n(c[f])), 0);
    const items = claims.map((c) => ({ code: c.Code, title: c.TitleFa ?? null, claimed: c.ClaimedAmount ?? null, reviewed: c.ReviewedAmount ?? null, approved: c.ApprovedAmount ?? null, days: c.ClaimedDelayDays ?? null }));
    const defs = [
      ["CALC-TOTAL-CLAIMED", "جمع مبالغ مورد مطالبهٔ ادعاهای پرونده", sumOf("ClaimedAmount")],
      ["CALC-TOTAL-REVIEWED", "جمع مبالغ بررسی‌شدهٔ ادعاهای پرونده", sumOf("ReviewedAmount")],
      ["CALC-TOTAL-APPROVED", "جمع مبالغ تأییدشدهٔ ادعاهای پرونده", sumOf("ApprovedAmount")],
      ["CALC-TOTAL-DELAY-DAYS", "جمع مدت مطالبه‌شده (روز) ادعاهای پرونده", sumOf("ClaimedDelayDays")],
    ];
    const out = [];
    for (const [code, titleFa, total] of defs) {
      const up = await upsertChild(r, "PmisDisputeCalculations", pid, cc, code, {
        TitleFa: titleFa,
        PurposeFa: "محاسبهٔ مستقل کارشناسی برای مقایسه با اعداد مدعی/پاسخگو — جایگزین محاسبهٔ اصلی نیست و وارد گزارش فقط به‌عنوان مقایسه می‌شود.",
        MethodFa: CALC_TOTALS_METHOD_FA,
        InputsJson: { claims: items, computedAt: now },
        ResultAmount: claims.length ? total : null,
        Currency: null,
        ResultBaseDate: today(),
        DataSourceFa: "ردیف‌های ادعای همین پرونده (PmisDisputeClaims). مقادیر ماژول‌های دیگر بدون بازمحاسبه و فقط‌خواندنی‌اند.",
        VarianceNoteFa: claims.length ? null : "ادعایی در پرونده ثبت نشده است — مجموع معنادار نیست.",
        CalculatedBy: "DisputeCalculationsService/v1.0",
        CalculatedAt: now,
        ReviewedBy: null,
        Status: "draft",
      }, actor);
      out.push({ code: up.row.Code, amount: claims.length ? total : null });
    }
    await audit(r, pid, cc, "calculations_recalc", actor, `بازمحاسبهٔ ${out.length} شاخص جمع ادعاها`, null, null);
    return { recalculated: out.length, totals: out, note: "مقادیر ماژول‌های دیگر در این بازمحاسبه دخالت ندارند (فقط‌خواندنی)." };
  }));

  /* ── نامزدهای پیوند نرم از ماژول‌های دیگر (فقط‌خواندنی — حذف/تغییری ندارد) ── */
  app.get(base + "/cases/:id/link-suggestions", need("dispute.view"), run(async (r, req) => {
    const row = await findCase(r, req);
    const existingLinks = new Set((await listChild(r, "PmisDisputeModuleLinks", req.params.projectId, row.Code)).map((l) => `${l.LinkKind}:${l.TargetCode}`));
    const pick = async (table, kind, codeOf, titleOf, extraOf) => {
      try {
        const rows = await r.list(table, { where: where(req.params.projectId), limit: 200 });
        return rows.map((x) => {
          const code = String(codeOf(x) ?? "");
          return code ? { code, titleFa: String(titleOf(x) ?? code), alreadyLinked: existingLinks.has(`${kind}:${code}`), ...((extraOf && extraOf(x)) ?? {}) } : null;
        }).filter(Boolean);
      } catch { return []; }
    };
    const [delay, loss, risk, claim, docs] = await Promise.all([
      pick("DelayEvent", "delay_case", (x) => x.Code, (x) => x.TitleFa, (x) => ({ status: x.Status ?? null })),
      pick("ClaimCostItem", "loss_case", (x) => x.Id, (x) => x.TitleFa, (x) => ({ status: x.Status ?? null, amount: x.Amount ?? null })),
      pick("ContractRiskRegister", "contract_risk", (x) => x.Code, (x) => x.TitleFa, (x) => ({ status: x.Status ?? null })),
      pick("Claim", "claim", (x) => x.Code, (x) => x.TitleFa, (x) => ({ status: x.Status ?? null })),
      pick("Document", "edms_document", (x) => x.DocNo, (x) => x.TitleFa, (x) => ({ revision: x.Revision ?? null })),
    ]);
    return { delay_case: delay, loss_case: loss, contract_risk: risk, claim, edms_document: docs, noteFa: "هدف ماژول فقط‌خواندنی است؛ این فهرست فقط نامزد اتصال است." };
  }));

  /* ── بازیابی زندهٔ هدف پیوند (خواندنی — تغییری در ماژول مقصد نمی‌دهد) ── */
  app.get(base + "/cases/:id/links/:rowId/resolve", need("dispute.view"), run(async (r, req) => {
    const row = await findCase(r, req);
    const pid = req.params.projectId;
    const link = await r.findOne("PmisDisputeModuleLinks", [...childWhere(pid, row.Code), { column: "Id", op: "eq", value: req.params.rowId }]);
    if (!link) throw error(404, "DSP_NOT_FOUND", "رکورد پیوند یافت نشد");
    const kind = String(link.LinkKind ?? "");
    const code = String(link.TargetCode ?? "");
    const res = { link, resolvable: true, found: false, target: null, related: [], noteFa: null, readOnly: true };
    const byCode = async (table) => {
      try { return await r.findOne(table, [...where(pid), { column: "Code", op: "eq", value: code }]); } catch { return null; }
    };
    if (kind === "delay_case") {
      const ev = await byCode("DelayEvent");
      if (ev) {
        res.found = true; res.target = ev;
        try { res.related = (await r.list("DelayCalculation", { where: [...where(pid), { column: "DelayEventId", op: "eq", value: ev.Id }], limit: 50 })).map((x) => ({ Id: x.Id, Engine: x.Engine, RuleVersion: x.RuleVersion, FinalValueDays: x.FinalValueDays, Status: x.Status, CalculatedAt: x.CalculatedAt })); } catch { /* ignore */ }
        res.noteFa = "مقادیر محاسبهٔ تأخیر فقط نمایشی‌اند و در ماژول اختلاف بازمحاسبه نمی‌شوند; بخشنامهٔ ۱۳۰۰ به‌خودی‌خود مبنای تمدید نیست.";
      } else res.noteFa = "رویداد تأخیر با این کد یافت نشد — ممکن است حذف/تغییر یافته باشد؛ پیوند نیازمند اصلاح است.";
    } else if (kind === "loss_case") {
      let item = null;
      try { item = await r.findOne("ClaimCostItem", [...where(pid), { column: "Id", op: "eq", value: code }]); } catch { item = null; }
      if (!item) item = await byCode("ClaimCostItem");
      if (item) {
        res.found = true; res.target = item;
        try { res.related = (await r.list("ClaimCalculationRun", { where: [...where(pid), { column: "ClaimCostItemId", op: "eq", value: item.Id }], limit: 50 })).map((x) => ({ Id: x.Id, Engine: x.Engine, RuleCode: x.RuleCode, FinalAmount: x.FinalAmount, Status: x.Status, CalculatedAt: x.CalculatedAt })); } catch { /* ignore */ }
        res.noteFa = "مبالغ محاسبهٔ خسارت فقط‌خواندنی‌اند؛ این ماژول هیچ بازمحاسبه‌ای انجام نمی‌دهد.";
      } else res.noteFa = "آیتم خسارت/لایحه با این کد یافت نشد؛ پیوند نیازمند اصلاح است.";
    } else if (kind === "contract_risk") {
      const rk = await byCode("ContractRiskRegister");
      if (rk) { res.found = true; res.target = rk; res.noteFa = "امتیاز ریسک قراردادی تصویر وضعیت است؛ به‌خودی‌خود مبنای محاسبهٔ خسارت یا تمدید مدت نیست."; }
      else res.noteFa = "ریسک قراردادی با این کد یافت نشد؛ پیوند نیازمند اصلاح است.";
    } else if (kind === "claim") {
      const cl = await byCode("Claim");
      if (cl) { res.found = true; res.target = cl; res.noteFa = "وضعیت ادعای مرجع فقط‌خواندنی است."; }
      else res.noteFa = "ادعای مرجع با این کد یافت نشد؛ پیوند نیازمند اصلاح است.";
    } else if (kind === "edms_document") {
      let doc = await byCode("Document");
      if (!doc) { try { doc = await r.findOne("Document", [...where(pid), { column: "DocNo", op: "eq", value: code }]); } catch { doc = null; } }
      if (!doc) { try { doc = await r.findOne("Document", [...where(pid), { column: "Id", op: "eq", value: code }]); } catch { doc = null; } }
      if (doc) { res.found = true; res.target = doc; res.noteFa = "سند EDMS فقط به‌صورت پیوند مرجع استفاده می‌شود؛ محتوای فایل در این ماژول نگهداری نمی‌شود."; }
      else res.noteFa = "سند با این کد/شماره یافت نشد؛ پیوند نیازمند اصلاح است.";
    } else if (kind === "contract") {
      res.resolvable = false; res.noteFa = "پیوند قرارداد از نوع مرجع‌نماست؛ اطلاعات قرارداد در ستون‌های پرونده/ادعا نگهداری می‌شود و دریافت زندهٔ آن در این نسخه پیش‌بینی نشده است.";
    } else {
      res.resolvable = false; res.noteFa = `نوع پیوند «${LINK_KIND_FA[kind] ?? kind}» در این نسخه قابل بازیابی زنده نیست.`;
    }
    return res;
  }));

  /* ═══════════ فاز ۴ — نسخه‌های گزارش کارشناسی، تولید Word/PDF و گردش تأیید ═══════════ */

  const loadCaseBundle = async (r, projectId, caseCode) => {
    const [parties, claims, responses, evidence, analyses, calculations, hearings, opinions, links, deadlines, reports] = await Promise.all([
      listChild(r, "PmisDisputeParties", projectId, caseCode), listChild(r, "PmisDisputeClaims", projectId, caseCode),
      listChild(r, "PmisDisputeResponses", projectId, caseCode), listChild(r, "PmisDisputeEvidence", projectId, caseCode),
      listChild(r, "PmisDisputeAnalyses", projectId, caseCode), listChild(r, "PmisDisputeCalculations", projectId, caseCode),
      listChild(r, "PmisDisputeHearings", projectId, caseCode), listChild(r, "PmisDisputeOpinions", projectId, caseCode),
      listChild(r, "PmisDisputeModuleLinks", projectId, caseCode), listChild(r, "PmisDisputeDeadlines", projectId, caseCode),
      listChild(r, "PmisDisputeReports", projectId, caseCode),
    ]);
    return { parties, claims, responses, evidence, analyses, calculations, hearings, opinions, links, deadlines, reports };
  };

  /* ── ثبت نسخهٔ گزارش (draft — تا تأیید/صدور انسانی نهایی نیست) ── */
  app.post(base + "/cases/:id/reports", need("dispute.edit"), run(async (r, req) => {
    const row = await findCase(r, req);
    if (["closed", "archived"].includes(row.Status)) throw error(409, "DSP_STATUS", "پروندهٔ مختومه/بایگانی تغییر نمی‌پذیرد");
    const pid = req.params.projectId, cc = row.Code, actor = req.disputeSubject.id;
    const titleFa = String(req.body?.TitleFa ?? "").trim();
    if (!titleFa) throw error(400, "DSP_VALIDATION", "فیلد «TitleFa» الزامی است");
    const existing = await listChild(r, "PmisDisputeReports", pid, cc);
    const version = existing.reduce((mx, v) => Math.max(mx, Number(v.Version) || 0), 0) + 1;
    let enabled = req.body?.EnabledSectionsJson;
    if (enabled !== undefined && (!Array.isArray(enabled) || enabled.some((x) => !REPORT_SECTIONS.includes(x)))) throw error(400, "DSP_VALIDATION", "EnabledSectionsJson نامعتبر است");
    if (!Array.isArray(enabled) || enabled.length === 0) enabled = [...REPORT_SECTIONS];
    const code = newRecordCode("Reports");
    const created = await r.create("PmisDisputeReports", {
      Code: code, CaseCode: cc, ProjectId: pid, TitleFa: titleFa,
      Version: version, PreviousVersionCode: req.body?.PreviousVersionCode ?? null,
      EnabledSectionsJson: enabled, Status: "draft",
    }, actor, "dispute");
    await audit(r, pid, cc, "report_created", actor, `نسخهٔ گزارش ${code} (v${version}) ثبت شد — پیش‌نویس`, null, code);
    return { row: created };
  }));

  /* ── گردش وضعیت نسخهٔ گزارش: draft→in_review→approved→issued (SoD) ── */
  app.post(base + "/cases/:id/reports/:rowId/status", need(["dispute.edit", "dispute.review", "dispute.approve"]), run(async (r, req) => {
    const row = await findCase(r, req);
    if (["closed", "archived"].includes(row.Status)) throw error(409, "DSP_STATUS", "پروندهٔ مختومه/بایگانی تغییر نمی‌پذیرد");
    const pid = req.params.projectId, cc = row.Code, actor = req.disputeSubject.id;
    const rep = await r.findOne("PmisDisputeReports", [...childWhere(pid, cc), { column: "Id", op: "eq", value: req.params.rowId }]);
    if (!rep) throw error(404, "DSP_NOT_FOUND", "نسخهٔ گزارش یافت نشد");
    const from = String(rep.Status ?? "draft");
    const to = String(req.body?.to ?? "");
    if (!canTransitionReport(from, to)) throw error(409, "DSP_STATUS", `گذر «${REPORT_STATUS_FA[from] ?? from} → ${REPORT_STATUS_FA[to] ?? to}» مجاز نیست`);
    const now = new Date().toISOString();
    const patch = { Status: to };
    if (to === "approved") {
      if (!can(req, "dispute.review")) throw error(403, "DSP_FORBIDDEN", "تأیید محتوای گزارش نیازمند مجوز بازبینی است");
      if (!String(rep.GeneratedBy ?? "").trim() || !rep.GeneratedAt) throw error(409, "DSP_NOT_GENERATED", "پیش از تأیید محتوا، حداقل یک خروجی (Word/PDF) از نسخه تولید کنید تا قابل‌بازبینی باشد");
      if (String(rep.GeneratedBy ?? "") === actor) throw error(403, "DSP_SOD", "تولیدکنندهٔ نسخه نمی‌تواند همان را تأیید کند (جدایی وظایف)");
      patch.ApprovedBy = actor; patch.ApprovedAt = now;
    }
    if (to === "issued") {
      if (!can(req, "dispute.approve")) throw error(403, "DSP_FORBIDDEN", "صدور نسخه نیازمند مجوز تأیید نهایی است");
      if (!String(rep.GeneratedBy ?? "").trim() || !rep.GeneratedAt) throw error(409, "DSP_NOT_GENERATED", "نسخهٔ فاقد خروجی قابل‌بازبینی صادر نمی‌شود");
      if (String(rep.GeneratedBy ?? "") === actor) throw error(403, "DSP_SOD", "تولیدکنندهٔ نسخه نمی‌تواند همان را صادر کند (جدایی وظایف)");
      patch.IssuedBy = actor; patch.IssuedAt = now;
    }
    if (to === "draft") { patch.ApprovedBy = null; patch.ApprovedAt = null; }
    const updated = await r.patch("PmisDisputeReports", rep.Id, patch, actor, rep.RowVersion);
    /* صدور نسخهٔ جدید ← نسخه‌های صادرشدهٔ قبلی به «جایگزین‌شده» (superseded) می‌روند */
    if (to === "issued") {
      const others = await listChild(r, "PmisDisputeReports", pid, cc);
      for (const o of others) {
        if (o.Id !== rep.Id && String(o.Status) === "issued") {
          await r.patch("PmisDisputeReports", o.Id, { Status: "superseded" }, actor, o.RowVersion).catch(() => {});
          await audit(r, pid, cc, "report_superseded", actor, `نسخهٔ ${o.Code} به سبب صدور ${rep.Code} جایگزین شد`, o.Code, rep.Code);
        }
      }
    }
    await audit(r, pid, cc, "report_status_changed", actor, `گذر وضعیت نسخهٔ ${rep.Code}`, from, to);
    return { row: updated };
  }));

  /* ── تولید Word/PDF از دادهٔ واقعی پرونده (۲۰ فصل/۳۴ جدول + Auto-Cleanup) ── */
  app.get(base + "/cases/:id/reports/:rowId/document", need("dispute.view"), async (req, res, next) => {
    try {
      const r = await repo();
      const row = await findCase(r, req);
      const rep = await r.findOne("PmisDisputeReports", [...childWhere(req.params.projectId, row.Code), { column: "Id", op: "eq", value: req.params.rowId }]);
      if (!rep) return res.status(404).json({ ok: false, error: { code: "DSP_NOT_FOUND", message: "نسخهٔ گزارش یافت نشد", traceId: req.requestId } });
      const format = req.query.format === "pdf" ? "pdf" : "word";
      const bundle = await loadCaseBundle(r, req.params.projectId, row.Code);
      const now = new Date().toISOString();
      const dataNote = `اسنپ‌شات دادهٔ ${now} — وضعیت پرونده ${String(row.Status)} · ${bundle.claims.length} ادعا · ${bundle.evidence.length} سند · ${bundle.analyses.length} تحلیل`;
      const doc = buildExpertReport({
        projectId: req.params.projectId, caseRow: row, ...bundle, reportVersions: bundle.reports.filter((v) => v.Id !== rep.Id),
        reportRow: { ...rep, DataVersionNoteFa: dataNote },
        generatedAt: now, generatedBy: req.disputeSubject.id, format,
      });
      if (doc.issues.length) return res.status(422).json({ ok: false, error: { code: "DSP_REPORT_GATE", message: doc.issues.join("؛ "), traceId: req.requestId } });
      /* ثبت مرجع خروجی روی ردیف نسخه (حافظهٔ نسخه‌دار فایل‌ها) */
      const refPatch = format === "pdf" ? { PdfFileRef: doc.filename.replace(/\.html$/, ".pdf") } : { WordFileRef: doc.filename };
      await r.patch("PmisDisputeReports", rep.Id, { ...refPatch, GeneratedAt: now, GeneratedBy: req.disputeSubject.id, DataVersionNoteFa: dataNote }, req.disputeSubject.id, rep.RowVersion).catch(() => {});
      await audit(r, req.params.projectId, row.Code, format === "pdf" ? "report_pdf_generated" : "report_word_generated", req.disputeSubject.id, `تولید ${doc.filename} برای نسخهٔ ${rep.Code}`, null, rep.Code);
      if (format === "pdf") {
        let pdf;
        try { const { htmlToPdf } = await import("./pdfRenderer.js"); pdf = await htmlToPdf(doc.body); }
        catch { return res.status(501).json({ ok: false, error: { code: "DSP_PDF_UNAVAILABLE", message: "موتور تولید PDF واقعی روی این سرور در دسترس نیست؛ خروجی Word در دسترس است", traceId: req.requestId } }); }
        res.setHeader("content-type", "application/pdf");
        res.setHeader("content-disposition", `attachment; filename="${doc.filename.replace(/\.html$/, ".pdf")}"`);
        return res.send(pdf);
      }
      res.setHeader("content-type", doc.contentType);
      res.setHeader("content-disposition", `attachment; filename="${doc.filename}"`);
      return res.send(doc.body);
    } catch (e) { next(e); }
  });

  /* ═══════════ فاز ۴ — ۱۴ گزارش مدیریتی پروژه (فقط‌خواندنی از دادهٔ واقعی) ═══════════ */
  app.get(base + "/management-reports", need("dispute.view"), run(async (r, req) => {
    const kind = String(req.query.kind ?? "");
    if (!MANAGEABLE_KINDS.includes(kind)) throw error(400, "DSP_MGMT_KIND", `گزارش مدیریتی نامعتبر است — مقادیر مجاز: ${MANAGEABLE_KINDS.join(", ")}`);
    const pid = req.params.projectId;
    const full = async (table) => r.list(table, { where: where(pid), limit: 10000 }).catch(() => []);
    const [cases, claims, parties, evidence, analyses, calculations, hearings, opinions, links, deadlines, reports] = await Promise.all([
      full("PmisDisputeCases"), full("PmisDisputeClaims"), full("PmisDisputeParties"), full("PmisDisputeEvidence"),
      full("PmisDisputeAnalyses"), full("PmisDisputeCalculations"), full("PmisDisputeHearings"), full("PmisDisputeOpinions"),
      full("PmisDisputeModuleLinks"), full("PmisDisputeDeadlines"), full("PmisDisputeReports"),
    ]);
    return buildManagementReport(kind, { cases, claims, parties, evidence, analyses, calculations, hearings, opinions, links, deadlines, reports, today: new Date().toISOString().slice(0, 10) });
  }));
}
