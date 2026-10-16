/**
 * PMO-CONTRACT-RISK-ENGINE-V1.0 — API ماژول «مدیریت ریسک قراردادها و بهبود قرارداد».
 *
 * مسیر اختصاصی پروژه‌ای /api/cnt-risk/:projectId — جدول‌های Contract* فقط
 * از همین مسیر خوانده/نوشته می‌شوند (DEDICATED_TABLE_ROUTES).
 * پیوند با قرارداد، EDMS، تأخیر و خسارت نرم است (کد/شناسه)؛ هیچ داده‌ای
 * از ماژول‌های دیگر بازنویسی نمی‌شود و امتیاز ریسک هرگز مبلغ یا مدت
 * تمدید تولید نمی‌کند. پیشنهاد اصلاح تا تصویب مجاز، متن پیمان را تغییر
 * نمی‌دهد؛ تصویب‌ها با تفکیک وظیفه (SoD) از سازنده جدا هستند.
 */
import { evaluateContractRisk, summarizeContractRiskPortfolio, DEFAULT_SCORING_CONFIG, CONTRACT_RISK_CATEGORIES } from "./contractRiskLogic.js";
import { analyzeContractText, compareContractVersions } from "./contractClauseLogic.js";
import { buildContractRiskReport } from "./contractRiskDocLogic.js";

const locks = new Map();
async function serial(key, work) {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  locks.set(key, current);
  try { return await current; } finally { if (locks.get(key) === current) locks.delete(key); }
}
function error(status, code, message) { return Object.assign(new Error(message), { status, code }); }
const day = () => new Date().toISOString().slice(0, 10);
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

const RISK_STATUSES = ["identified", "assessed", "responding", "monitoring", "closed"];
const IMPROVEMENT_STATUSES = ["draft", "needs_review", "pending_approval", "approved", "rejected", "superseded", "obsolete"];
const ACTION_STATUSES = ["defined", "in_progress", "done", "ineffective", "cancelled"];
const STRATEGIES = ["avoid", "mitigate", "transfer", "accept", "exploit"];

export function registerContractRiskRoutes(app, { repo, subjects, evaluate }) {
  const base = "/api/cnt-risk/:projectId";
  const can = (req, permission) => evaluate(req.cntSubject, permission, { projectId: req.params.projectId }).allow;
  const need = (perms) => (req, res, next) => {
    const fail = (status, code, message) => res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(req.params.projectId)) return fail(400, "CNTRISK_PROJECT", "شناسهٔ پروژه نامعتبر است");
    req.cntSubject = subjects.find((s) => s.id === String(req.headers["x-user-id"] || "").trim() && s.active);
    if (!req.cntSubject) return fail(401, "CNTRISK_AUTH", "هویت معتبر الزامی است");
    if (!(Array.isArray(perms) ? perms : [perms]).some((p) => can(req, p))) return fail(403, "CNTRISK_FORBIDDEN", "مجوز اقدام یا دسترسی به پروژه را ندارید");
    next();
  };
  const where = (projectId) => [{ column: "ProjectId", op: "eq", value: projectId }];
  const findById = async (r, req, table) => {
    const row = await r.findOne(table, [...where(req.params.projectId), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw error(404, "CNTRISK_NOT_FOUND", "رکورد در این پروژه یافت نشد");
    return row;
  };
  const run = (handler) => async (req, res, next) => {
    try {
      const work = async () => handler(await repo(), req);
      const out = req.method === "GET" ? await work() : await serial(`cnt-risk:${req.params.projectId}`, work);
      if (out && out.__send) return out.__send(res);
      res.json({ ok: true, data: out });
    } catch (e) { next(e); }
  };
  const scoringConfig = async (r, req) => {
    const rules = await r.list("ContractRiskScoringRule", { where: where(req.params.projectId), limit: 200 }).catch(() => []);
    const approved = rules.filter((x) => x.Status === "approved").sort((a, b) => String(b.ApprovedAt ?? "").localeCompare(String(a.ApprovedAt ?? "")))[0];
    if (!approved) return { config: DEFAULT_SCORING_CONFIG, approved: false, rules };
    try { return { config: { ...DEFAULT_SCORING_CONFIG, ...JSON.parse(approved.Config ?? "{}") }, approved: true, rules }; }
    catch { return { config: DEFAULT_SCORING_CONFIG, approved: false, rules }; }
  };
  const scoreRisk = async (r, req, row, subjectId) => {
    const { config, approved } = await scoringConfig(r, req);
    const result = evaluateContractRisk({
      probability: num(row.Probability), impactTime: num(row.ImpactTime), impactFinancial: num(row.ImpactFinancial),
      impactLegal: num(row.ImpactLegal), impactOperational: num(row.ImpactOperational), impactQuality: num(row.ImpactQuality),
      controlEffectiveness: row.ControlEffectiveness, controlEvidenceRefs: row.ControlEvidenceRefs,
    }, config, approved);
    return result;
  };
  const snapshot = async (r, req, riskRow, result, subjectId) => {
    await r.create("ContractRiskAssessment", {
      RiskCode: riskRow.Code, Inputs: result, InherentScore: result.inherentScore, InherentBand: result.inherentBand,
      ResidualScore: result.residualScore, ResidualBand: result.residualBand, ScoringVersion: result.scoringVersion,
      AssessedBy: subjectId, AssessedAt: new Date().toISOString(), ProjectId: req.params.projectId,
    }, subjectId, "contractRiskAssessment");
  };
  const validateRiskValues = (b) => {
    const values = {
      TitleFa: String(b.TitleFa ?? "").trim(), Category: String(b.Category ?? "other"),
      DescriptionFa: b.DescriptionFa ?? null, ContractCode: b.ContractCode || null, ClauseRef: b.ClauseRef || null,
      DocumentId: b.DocumentId || null, CauseFa: b.CauseFa ?? null, EventFa: b.EventFa ?? null, ConsequenceFa: b.ConsequenceFa ?? null,
      Owner: b.Owner || null, IdentifiedAt: b.IdentifiedAt || day(),
      Probability: num(b.Probability), ImpactTime: num(b.ImpactTime), ImpactFinancial: num(b.ImpactFinancial),
      ImpactLegal: num(b.ImpactLegal), ImpactOperational: num(b.ImpactOperational), ImpactQuality: num(b.ImpactQuality),
      ExistingControlsFa: b.ExistingControlsFa ?? null, ControlEffectiveness: b.ControlEffectiveness || "none",
      ControlEvidenceRefs: Array.isArray(b.ControlEvidenceRefs) ? b.ControlEvidenceRefs : [],
      Status: RISK_STATUSES.includes(b.Status) ? b.Status : "identified",
      NextReviewDate: b.NextReviewDate || null, DelayEventCode: b.DelayEventCode || null, ClaimCode: b.ClaimCode || null,
    };
    if (!values.TitleFa) throw error(400, "CNTRISK_TITLE", "عنوان ریسک الزامی است");
    for (const k of ["Probability", "ImpactTime", "ImpactFinancial", "ImpactLegal", "ImpactOperational", "ImpactQuality"]) {
      const v = values[k];
      if (v !== null && (v < 1 || v > 5)) throw error(400, "CNTRISK_SCALE", "مقیاس احتمال و اثر باید بین ۱ تا ۵ باشد");
    }
    return values;
  };

  /* ── Workspace مرکز کنترل ── */
  app.get(base + "/workspace", need("cnt.risk.view"), run(async (r, req) => {
    const w = where(req.params.projectId);
    const [risks, actions, obligations, improvements, findings, rules, assessments, contracts, amendments] = await Promise.all([
      r.list("ContractRiskRegister", { where: w, limit: 5000 }).catch(() => []),
      r.list("ContractRiskAction", { where: w, limit: 5000 }).catch(() => []),
      r.list("ContractObligation", { where: w, limit: 5000 }).catch(() => []),
      r.list("ContractImprovement", { where: w, limit: 5000 }).catch(() => []),
      r.list("ContractClauseFinding", { where: w, limit: 5000 }).catch(() => []),
      r.list("ContractRiskScoringRule", { where: w, limit: 500 }).catch(() => []),
      r.list("ContractRiskAssessment", { where: w, limit: 5000 }).catch(() => []),
      r.list("ContractMaster", { where: w, limit: 500 }).catch(() => []),
      r.list("ContractAmendment", { where: w, limit: 1000 }).catch(() => []),
    ]);
    /* پیوند نرم خواندنی با RCC: فقط نمایش وضعیت/مبلغ موجود، بدون انتقال خودکار. */
    const [delayEvents, claims] = await Promise.all([
      r.list("DelayEvent", { where: w, limit: 2000 }).catch(() => []),
      r.list("Claim", { where: w, limit: 2000 }).catch(() => []),
    ]);
    const today = day();
    const summary = summarizeContractRiskPortfolio(risks, actions, obligations, improvements, findings.filter((f) => f.ReviewStatus === "pending").length, today);
    const trend = assessments
      .filter((a) => a.InherentScore !== null && a.InherentScore !== undefined)
      .sort((a, b) => String(a.AssessedAt).localeCompare(String(b.AssessedAt)))
      .slice(-60)
      .map((a) => ({ at: a.AssessedAt, riskCode: a.RiskCode, inherent: a.InherentScore, residual: a.ResidualScore }));
    return {
      categories: CONTRACT_RISK_CATEGORIES, riskStatuses: RISK_STATUSES, improvementStatuses: IMPROVEMENT_STATUSES,
      actionStatuses: ACTION_STATUSES, strategies: STRATEGIES, defaultScoringConfig: DEFAULT_SCORING_CONFIG,
      risks, actions, obligations, improvements, findings, scoringRules: rules, assessments: assessments.slice(-500),
      contracts, amendments, trend, summary, today,
      links: {
        delayEvents: delayEvents.map((d) => ({ code: d.Code, titleFa: d.TitleFa, status: d.Status })),
        claims: claims.map((c) => ({ code: c.Code, titleFa: c.SubjectFa ?? c.TitleFa ?? "", status: c.Status, amount: c.ClaimAmount ?? c.EstimatedAmount ?? null, approvedAmount: c.ApprovedAmount ?? null })),
      },
    };
  }));

  /* ── دفتر ثبت ریسک ── */
  app.post(base + "/risks", need("cnt.risk.edit"), run(async (r, req) => {
    const values = validateRiskValues(req.body ?? {});
    const code = String(req.body.Code ?? "").trim() || `CR-${Date.now().toString(36).toUpperCase()}`;
    const result = await scoreRisk(r, req, values);
    const row = await r.create("ContractRiskRegister", {
      ...values, Code: code, InherentScore: result.inherentScore, InherentBand: result.inherentBand,
      ResidualScore: result.residualScore, ResidualBand: result.residualBand, ScoringVersion: result.scoringVersion,
      Status: values.Status === "identified" && result.status === "scored" ? "assessed" : values.Status,
      ProjectId: req.params.projectId,
    }, req.cntSubject.id, "contractRisk");
    await snapshot(r, req, row, result, req.cntSubject.id);
    return { risk: row, scoring: result };
  }));

  app.patch(base + "/risks/:id", need("cnt.risk.edit"), run(async (r, req) => {
    const row = await findById(r, req, "ContractRiskRegister");
    const merged = { ...row, ...(req.body ?? {}) };
    const values = validateRiskValues(merged);
    const result = await scoreRisk(r, req, values);
    const updated = await r.patch("ContractRiskRegister", row.Id, {
      ...values, InherentScore: result.inherentScore, InherentBand: result.inherentBand,
      ResidualScore: result.residualScore, ResidualBand: result.residualBand, ScoringVersion: result.scoringVersion,
    }, req.cntSubject.id, row.RowVersion);
    await snapshot(r, req, updated, result, req.cntSubject.id);
    return { risk: updated, scoring: result };
  }));

  app.post(base + "/risks/:id/reassess", need("cnt.risk.edit"), run(async (r, req) => {
    const row = await findById(r, req, "ContractRiskRegister");
    const result = await scoreRisk(r, req, row);
    const updated = await r.patch("ContractRiskRegister", row.Id, {
      InherentScore: result.inherentScore, InherentBand: result.inherentBand,
      ResidualScore: result.residualScore, ResidualBand: result.residualBand, ScoringVersion: result.scoringVersion,
    }, req.cntSubject.id, row.RowVersion);
    await snapshot(r, req, updated, result, req.cntSubject.id);
    return { risk: updated, scoring: result };
  }));

  /* ── قواعد امتیازدهی (کتابخانهٔ تنظیمات) ── */
  app.post(base + "/scoring-rules", need("cnt.risk.edit"), run(async (r, req) => {
    const b = req.body ?? {};
    const code = String(b.Code ?? "").trim();
    if (!code) throw error(400, "CNTRISK_RULE_CODE", "کد قاعدهٔ امتیازدهی الزامی است");
    let config = DEFAULT_SCORING_CONFIG;
    if (b.Config) { try { config = { ...DEFAULT_SCORING_CONFIG, ...JSON.parse(JSON.stringify(b.Config)) }; } catch { throw error(400, "CNTRISK_RULE_CONFIG", "پیکربندی قاعده نامعتبر است"); } }
    const wSum = Object.values(config.impactWeights).reduce((s, v) => s + Number(v || 0), 0);
    if (Math.abs(wSum - 1) > 0.001) throw error(400, "CNTRISK_WEIGHTS", "مجموع وزن ابعاد اثر باید دقیقاً ۱ باشد");
    const row = await r.create("ContractRiskScoringRule", {
      Code: code, NameFa: String(b.NameFa ?? code), Version: String(b.Version ?? "1.0"),
      Config: config, Status: "needs_review", ProjectId: req.params.projectId,
    }, req.cntSubject.id, "contractRiskScoringRule");
    return { rule: row };
  }));

  app.post(base + "/scoring-rules/:id/approve", need("cnt.risk.approve"), run(async (r, req) => {
    const row = await findById(r, req, "ContractRiskScoringRule");
    if (row.Status === "approved") throw error(409, "CNTRISK_RULE_STATE", "این نسخه قبلاً تصویب شده است");
    if (row.CreatedBy && row.CreatedBy === req.cntSubject.id) throw error(403, "CNTRISK_SOD", "سازندهٔ قاعده نمی‌تواند خودش آن را تصویب کند (تفکیک وظایف)");
    const updated = await r.patch("ContractRiskScoringRule", row.Id, { Status: "approved", ApprovedBy: req.cntSubject.id, ApprovedAt: new Date().toISOString() }, req.cntSubject.id, row.RowVersion);
    return { rule: updated };
  }));

  /* ── تحلیل بندهای قرارداد ── */
  app.post(base + "/analyze", need("cnt.risk.edit"), run(async (r, req) => {
    const b = req.body ?? {};
    const result = analyzeContractText(String(b.Text ?? ""), String(b.SourceLabel ?? "متن قرارداد"));
    const stored = [];
    if (result.extractable) {
      for (const f of result.findings) {
        stored.push(await r.create("ContractClauseFinding", {
          DocumentId: b.DocumentId || null, ContractCode: b.ContractCode || null, ClauseNo: f.clauseNo, ClauseText: f.clauseText,
          Kind: f.kind, FindingFa: f.findingFa, ReasonFa: f.reasonFa, Confidence: f.confidence, SourceRef: f.sourceRef,
          SuggestedCategory: f.suggestedCategory, ReviewStatus: "pending", ProjectId: req.params.projectId,
        }, req.cntSubject.id, "contractClauseFinding"));
      }
    }
    return { analysis: result, findings: stored };
  }));

  app.patch(base + "/findings/:id/review", need("cnt.risk.edit"), run(async (r, req) => {
    const row = await findById(r, req, "ContractClauseFinding");
    const status = req.body?.ReviewStatus;
    if (!["accepted", "rejected", "pending"].includes(status)) throw error(400, "CNTRISK_REVIEW", "وضعیت بررسی نامعتبر است");
    /* یافتهٔ تحلیل هرگز خودش «تأیید کارشناسیِ» ریسک محسوب نمی‌شود؛ فقط وضعیت بررسی عوض می‌شود. */
    const updated = await r.patch("ContractClauseFinding", row.Id, { ReviewStatus: status, ReviewedBy: req.cntSubject.id, ReviewedAt: new Date().toISOString() }, req.cntSubject.id, row.RowVersion);
    return { finding: updated };
  }));

  /* ── گزارش جامع/بحرانی ریسک قراردادی (Word/PDF از دادهٔ واقعی) ── */
  app.get(base + "/report", need("cnt.risk.view"), async (req, res, next) => {
    try {
      const r = await repo();
      const w = where(req.params.projectId);
      const [risks, actions, obligations, improvements, findings, assessments, contracts, amendments, delayEvents, claims] = await Promise.all([
        r.list("ContractRiskRegister", { where: w, limit: 5000 }).catch(() => []),
        r.list("ContractRiskAction", { where: w, limit: 5000 }).catch(() => []),
        r.list("ContractObligation", { where: w, limit: 5000 }).catch(() => []),
        r.list("ContractImprovement", { where: w, limit: 5000 }).catch(() => []),
        r.list("ContractClauseFinding", { where: w, limit: 5000 }).catch(() => []),
        r.list("ContractRiskAssessment", { where: w, limit: 5000 }).catch(() => []),
        r.list("ContractMaster", { where: w, limit: 500 }).catch(() => []),
        r.list("ContractAmendment", { where: w, limit: 1000 }).catch(() => []),
        r.list("DelayEvent", { where: w, limit: 2000 }).catch(() => []),
        r.list("Claim", { where: w, limit: 2000 }).catch(() => []),
      ]);
      const { config, approved } = await scoringConfig(r, req);
      const doc = buildContractRiskReport({
        projectId: req.params.projectId,
        scope: req.query.scope === "critical" ? "critical" : "all",
        contractCode: req.query.contract ? String(req.query.contract) : null,
        category: req.query.category ? String(req.query.category) : null,
        risks, actions, obligations, improvements, findings, assessments, contracts, amendments,
        links: {
          delayEvents: delayEvents.map((d) => ({ code: d.Code, titleFa: d.TitleFa, status: d.Status })),
          claims: claims.map((c) => ({ code: c.Code, titleFa: c.SubjectFa ?? c.TitleFa ?? "", status: c.Status, amount: c.ClaimAmount ?? c.EstimatedAmount ?? null, approvedAmount: c.ApprovedAmount ?? null })),
        },
        generatedAt: new Date().toISOString(), generatedBy: req.cntSubject.id, categories: CONTRACT_RISK_CATEGORIES,
        scoringVersionNote: `${config.version}${approved ? " (قاعدهٔ سازمانی مصوب)" : " (روش پیش‌فرض — نیازمند تصویب قاعدهٔ سازمانی)"}`,
      });
      const format = req.query.format === "pdf" ? "pdf" : "word";
      if (format === "pdf") {
        let pdf;
        try { const { htmlToPdf } = await import("./pdfRenderer.js"); pdf = await htmlToPdf(doc.body); }
        catch { return res.status(501).json({ ok: false, error: { code: "CNTRISK_PDF_UNAVAILABLE", message: "موتور تولید PDF واقعی روی این سرور در دسترس نیست؛ خروجی Word در دسترس است", traceId: req.requestId } }); }
        res.setHeader("content-type", "application/pdf");
        res.setHeader("content-disposition", `attachment; filename="${doc.filename.replace(/\.doc$/, ".pdf")}"`);
        return res.send(pdf);
      }
      res.setHeader("content-type", doc.contentType);
      res.setHeader("content-disposition", `attachment; filename="${doc.filename}"`);
      return res.send(doc.body);
    } catch (e) { next(e); }
  });

  app.post(base + "/compare", need("cnt.risk.view"), run(async (r, req) => {
    const b = req.body ?? {};
    return { diff: compareContractVersions(String(b.TextBefore ?? ""), String(b.TextAfter ?? "")) };
  }));

  /* ── تعهدات و مهلت‌ها ── */
  app.post(base + "/obligations", need("cnt.risk.edit"), run(async (r, req) => {
    const b = req.body ?? {};
    if (!String(b.TitleFa ?? "").trim()) throw error(400, "CNTRISK_OBLIGATION", "شرح تعهد الزامی است");
    const row = await r.create("ContractObligation", {
      Code: String(b.Code ?? "").trim() || `OB-${Date.now().toString(36).toUpperCase()}`,
      ContractCode: b.ContractCode || null, ClauseRef: b.ClauseRef || null, TitleFa: String(b.TitleFa).trim(),
      ResponsibleParty: b.ResponsibleParty || "contractor", BeneficiaryParty: b.BeneficiaryParty || null,
      StartDate: b.StartDate || null, DueDate: b.DueDate || null, PreconditionFa: b.PreconditionFa ?? null,
      EvidenceDocumentId: b.EvidenceDocumentId || null, Status: "pending", NoteFa: b.NoteFa ?? null,
      RiskCode: b.RiskCode || null, ProjectId: req.params.projectId,
    }, req.cntSubject.id, "contractObligation");
    return { obligation: row };
  }));

  app.patch(base + "/obligations/:id", need("cnt.risk.edit"), run(async (r, req) => {
    const row = await findById(r, req, "ContractObligation");
    const b = req.body ?? {};
    const allowed = {};
    for (const k of ["TitleFa", "ResponsibleParty", "BeneficiaryParty", "StartDate", "DueDate", "PreconditionFa", "EvidenceDocumentId", "Status", "NoteFa", "RiskCode", "ClauseRef", "ContractCode"]) if (k in b) allowed[k] = b[k];
    if (allowed.Status && !["pending", "done", "waived", "cancelled"].includes(allowed.Status)) throw error(400, "CNTRISK_OBLIGATION_STATUS", "وضعیت تعهد نامعتبر است");
    const updated = await r.patch("ContractObligation", row.Id, allowed, req.cntSubject.id, row.RowVersion);
    return { obligation: updated };
  }));

  /* ── پیشنهاد اصلاح و بهبود قرارداد ── */
  app.post(base + "/improvements", need("cnt.risk.edit"), run(async (r, req) => {
    const b = req.body ?? {};
    if (!String(b.ClauseRef ?? "").trim() && !String(b.CurrentText ?? "").trim()) throw error(400, "CNTRISK_IMPROVEMENT", "ارجاع بند یا متن فعلی الزامی است");
    const row = await r.create("ContractImprovement", {
      Code: String(b.Code ?? "").trim() || `CI-${Date.now().toString(36).toUpperCase()}`,
      ContractCode: b.ContractCode || null, ClauseRef: b.ClauseRef || null, CurrentText: b.CurrentText ?? null,
      ProblemFa: b.ProblemFa ?? null, RiskFa: b.RiskFa ?? null, ConsequenceFa: b.ConsequenceFa ?? null,
      ProposedText: b.ProposedText ?? null, ReasonFa: b.ReasonFa ?? null, EffectEmployerFa: b.EffectEmployerFa ?? null,
      EffectContractorFa: b.EffectContractorFa ?? null, EffectCostTimeFa: b.EffectCostTimeFa ?? null, BasisFa: b.BasisFa ?? null,
      Confidence: num(b.Confidence), Status: "draft", RiskCode: b.RiskCode || null, ProjectId: req.params.projectId,
    }, req.cntSubject.id, "contractImprovement");
    return { improvement: row };
  }));

  app.patch(base + "/improvements/:id", need("cnt.risk.edit"), run(async (r, req) => {
    const row = await findById(r, req, "ContractImprovement");
    if (row.Status === "approved") throw error(409, "CNTRISK_IMPROVEMENT_LOCKED", "پیشنهاد تصویب‌شده قابل ویرایش نیست؛ نسخهٔ جایگزین بسازید");
    const b = req.body ?? {};
    const allowed = {};
    for (const k of ["ClauseRef", "ContractCode", "CurrentText", "ProblemFa", "RiskFa", "ConsequenceFa", "ProposedText", "ReasonFa", "EffectEmployerFa", "EffectContractorFa", "EffectCostTimeFa", "BasisFa", "Confidence", "RiskCode"]) if (k in b) allowed[k] = b[k];
    if (b.Status) {
      if (!IMPROVEMENT_STATUSES.includes(b.Status)) throw error(400, "CNTRISK_IMPROVEMENT_STATUS", "وضعیت پیشنهاد نامعتبر است");
      if (["approved", "rejected"].includes(b.Status)) throw error(403, "CNTRISK_DECIDE", "تصمیم نهایی فقط از مسیر تصویب مجاز است");
      allowed.Status = b.Status;
    }
    const updated = await r.patch("ContractImprovement", row.Id, allowed, req.cntSubject.id, row.RowVersion);
    return { improvement: updated };
  }));

  app.post(base + "/improvements/:id/decide", need("cnt.risk.approve"), run(async (r, req) => {
    const row = await findById(r, req, "ContractImprovement");
    const decision = req.body?.Decision;
    if (!["approved", "rejected"].includes(decision)) throw error(400, "CNTRISK_DECISION", "تصمیم باید approved یا rejected باشد");
    if (!["pending_approval", "needs_review", "draft"].includes(row.Status)) throw error(409, "CNTRISK_IMPROVEMENT_STATE", "این پیشنهاد در وضعیت قابل تصمیم نیست");
    if (row.CreatedBy && row.CreatedBy === req.cntSubject.id) throw error(403, "CNTRISK_SOD", "پیشنهاددهنده نمی‌تواند پیشنهاد خودش را تصویب کند (تفکیک وظایف)");
    /* تصویب اینجا فقط گردش داخلی است و متن ContractMaster را دست نمی‌زند؛
     * تغییر رسمی قرارداد از مسیر الحاقیهٔ ماژول پیمان انجام می‌شود. */
    const updated = await r.patch("ContractImprovement", row.Id, { Status: decision, ReviewerBy: req.cntSubject.id, ReviewedAt: new Date().toISOString() }, req.cntSubject.id, row.RowVersion);
    return { improvement: updated };
  }));

  /* ── برنامهٔ پاسخ به ریسک ── */
  app.post(base + "/actions", need("cnt.risk.edit"), run(async (r, req) => {
    const b = req.body ?? {};
    if (!String(b.RiskCode ?? "").trim()) throw error(400, "CNTRISK_ACTION_RISK", "اقدام باید به یک ریسک متصل باشد");
    if (!STRATEGIES.includes(b.Strategy)) throw error(400, "CNTRISK_STRATEGY", "راهبرد پاسخ نامعتبر است");
    const risk = await r.findOne("ContractRiskRegister", [...where(req.params.projectId), { column: "Code", op: "eq", value: String(b.RiskCode) }]);
    if (!risk) throw error(400, "CNTRISK_RISK_LINK", `ریسک «${b.RiskCode}» در این پروژه نیست`);
    const row = await r.create("ContractRiskAction", {
      Code: String(b.Code ?? "").trim() || `RA-${Date.now().toString(36).toUpperCase()}`,
      RiskCode: String(b.RiskCode), Strategy: b.Strategy, TitleFa: String(b.TitleFa ?? "اقدام پاسخ").trim(),
      Owner: b.Owner || null, StartDate: b.StartDate || null, DueDate: b.DueDate || null, Cost: num(b.Cost),
      ProgressPct: 0, Status: "defined", EffectivenessMetricFa: b.EffectivenessMetricFa ?? null,
      EvidenceDocumentId: b.EvidenceDocumentId || null, EffectivenessNoteFa: b.EffectivenessNoteFa ?? null,
      ProjectId: req.params.projectId,
    }, req.cntSubject.id, "contractRiskAction");
    return { action: row };
  }));

  app.patch(base + "/actions/:id", need("cnt.risk.edit"), run(async (r, req) => {
    const row = await findById(r, req, "ContractRiskAction");
    const b = req.body ?? {};
    const allowed = {};
    for (const k of ["TitleFa", "Owner", "StartDate", "DueDate", "Cost", "EffectivenessMetricFa", "EvidenceDocumentId", "EffectivenessNoteFa"]) if (k in b) allowed[k] = b[k];
    if (b.ProgressPct !== undefined) {
      const p = num(b.ProgressPct);
      if (p === null || p < 0 || p > 100) throw error(400, "CNTRISK_PROGRESS", "پیشرفت باید بین ۰ تا ۱۰۰ باشد");
      allowed.ProgressPct = p;
    }
    if (b.Status) {
      if (!ACTION_STATUSES.includes(b.Status)) throw error(400, "CNTRISK_ACTION_STATUS", "وضعیت اقدام نامعتبر است");
      /* «اقدام اجراشده» با «کنترل اثربخش» یکی نیست: done بدون شاهد/یادداشت اثربخشی پذیرفته نمی‌شود. */
      if (b.Status === "done" && !(b.EvidenceDocumentId || row.EvidenceDocumentId)) throw error(400, "CNTRISK_ACTION_EVIDENCE", "برای بستن اقدام، مدرک اجرای اقدام (سند EDMS) الزامی است");
      allowed.Status = b.Status;
    }
    const updated = await r.patch("ContractRiskAction", row.Id, allowed, req.cntSubject.id, row.RowVersion);
    return { action: updated };
  }));
}
