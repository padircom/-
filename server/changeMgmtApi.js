/**
 * PMO-INTEGRATED-CHANGE-MANAGEMENT-V1.0 — API ماژول «مدیریت یکپارچهٔ تغییرات
 * پروژه و قراردادها».
 *
 * مسیر اختصاصی /api/change-mgmt/:projectId — همهٔ جدول‌های PmisChange* فقط
 * از همین مسیر خوانده/نوشته می‌شوند (DEDICATED_TABLE_ROUTES). پیوند با
 * تأخیر، ضرر، ریسک قرارداد، کارشناسی دعاوی و EDMS نرم است (Code/ID)؛ هیچ
 * دادهٔ ماژول دیگری بازنویسی یا بازمحاسبه نمی‌شود و هیچ تغییر تأییدنشده‌ای
 * خودکار در مبنا اعمال نمی‌شود.
 *
 * SoD زمان اجرا:
 *  - تصمیم (approved|approved_conditional|rejected) فقط با change.approve و
 *    تصمیم‌گیرنده ≠ کسی که درخواست را به pending_decision برد.
 *  - لایهٔ approved/paid مبلغ فقط با change.review و تأییدکننده ≠ تهیه‌کننده.
 *  - تمدید تأییدشده (ApprovedEotDays) فقط با مبنای استحقاق + change.review.
 */
import {
  CHANGE_MODULE_ID,
  analyzeTimeImpact,
  analyzeCostImpact,
  verifyModuleLinks,
  CHANGE_MODULE_VERSION,
  CHANGE_LLM_CONNECTED,
  CHANGE_TABLES,
  CHANGE_CHILD_TABLES,
  CHANGE_TYPES,
  CHANGE_ROLES,
  CHANGE_STATUSES,
  CHANGE_STATUS_FA,
  CHANGE_TRANSITIONS,
  CHANGE_STATUS_PERM,
  CHANGE_APPROVAL_STATUSES,
  changeTransitionIsDecision,
  canTransitionChange,
  isTerminalChange,
  COST_LAYERS,
  COST_LAYER_FA,
  REVIEW_STATUSES,
  newChangeCode,
  newRecordCode,
  validateChangeInput,
  validateChildRow,
  computeChangeDashboard,
  LINK_KINDS,
  CHANGE_MGMT_KINDS,
  buildChangeManagementReport,
  CHANGE_DOC_KINDS,
  CHANGE_DOC_KIND_FA,
  validateChangeUploadPayload,
  changeSafeDocFileName,
  publicChangeDocRow,
} from "./changeMgmtLogic.js";
import { buildChangeReport, CHANGE_REPORT_CHAPTERS, CHANGE_REPORT_TABLES } from "./changeDocLogic.js";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const locks = new Map();
async function serial(key, work) {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  locks.set(key, current);
  try { return await current; } finally { if (locks.get(key) === current) locks.delete(key); }
}
function error(status, code, message) { return Object.assign(new Error(message), { status, code }); }

const CHILD_SET = new Set(CHANGE_CHILD_TABLES);

export function registerChangeMgmtRoutes(app, { repo, subjects, evaluate, storageRoot, acceptedMimeTypes, maxFileBytes } = {}) {
  /* فاز ۶ — ذخیرهٔ بدنهٔ سند روی دیسک؛ متادیتاهای کامل یافته در PmisChangeDocuments (Zero-Regression). */
  const docDir = path.join(path.resolve(storageRoot || path.join(process.cwd(), "server", "storage")), "change");
  fs.mkdirSync(docDir, { recursive: true });
  const docUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, docDir),
      filename: (_req, _file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}.bin`),
    }),
    limits: { fileSize: Number(maxFileBytes) > 0 ? Number(maxFileBytes) : 25 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (acceptedMimeTypes instanceof Set && !acceptedMimeTypes.has(file.mimetype)) {
        const e = new Error(`نوع فایل مجاز نیست: ${file.mimetype}`); e.code = "UNSUPPORTED_FILE_TYPE"; return cb(e);
      }
      cb(null, true);
    },
  });
  const sha256File = (fp) => crypto.createHash("sha256").update(fs.readFileSync(fp)).digest("hex");
  const fixUtf8 = (n) => { try { return Buffer.from(String(n || ""), "latin1").toString("utf8"); } catch { return String(n || ""); } };
  const apiFail = (res, req, status, code, message) => res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });
  const base = "/api/change-mgmt/:projectId";
  const can = (req, permission) => evaluate(req.chgSubject, permission, { projectId: req.params.projectId }).allow;
  const need = (perms) => (req, res, next) => {
    const fail = (status, code, message) => res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(req.params.projectId)) return fail(400, "CHG_PROJECT", "شناسهٔ پروژه نامعتبر است");
    req.chgSubject = subjects.find((s) => s.id === String(req.headers["x-user-id"] || "").trim() && s.active);
    if (!req.chgSubject) return fail(401, "CHG_AUTH", "هویت معتبر الزامی است");
    if (!(Array.isArray(perms) ? perms : [perms]).some((p) => can(req, p))) return fail(403, "CHG_FORBIDDEN", "مجوز اقدام یا دسترسی به پروژه را ندارید");
    next();
  };
  const where = (projectId) => [{ column: "ProjectId", op: "eq", value: projectId }];
  const childWhere = (projectId, changeCode) => [...where(projectId), { column: "ChangeCode", op: "eq", value: changeCode }];
  const listChild = (r, table, projectId, changeCode) => r.list(table, { where: childWhere(projectId, changeCode), limit: 5000 }).catch(() => []);
  const findRequest = async (r, req) => {
    const row = await r.findOne("PmisChangeRequests", [...where(req.params.projectId), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw error(404, "CHG_NOT_FOUND", "درخواست تغییر در این پروژه یافت نشد");
    return row;
  };
  const run = (handler) => async (req, res, next) => {
    try {
      const work = async () => handler(await repo(), req);
      const out = req.method === "GET" ? await work() : await serial(`change-mgmt:${req.params.projectId}`, work);
      res.json({ ok: true, data: out });
    } catch (e) {
      if (e?.status) return res.status(e.status).json({ ok: false, error: { code: e.code, message: e.message, traceId: req.requestId } });
      next(e);
    }
  };
  const audit = async (r, projectId, changeCode, action, actor, detailFa, fromValue, toValue) => {
    try {
      await r.create("PmisChangeAuditTrail", {
        Code: newRecordCode("audit"), ChangeCode: changeCode, ProjectId: projectId,
        Action: action, Actor: actor, DetailFa: detailFa ?? null,
        FromValue: fromValue ?? null, ToValue: toValue ?? null, OccurredAt: new Date().toISOString(),
      }, actor, "change");
    } catch { /* ممیزی فرعی شکستش جریان اصلی را متوقف نمی‌کند */ }
  };

  /* ── فاز ۶: آپلود سند واقعی (multipart، متادیتا در PmisChangeDocuments، کنترل sha256) ── */
  app.post(base + "/requests/:id/documents/upload", need("change.edit"), (req, res) => {
    docUpload.single("file")(req, res, async (err) => {
      const trace = () => req.requestId;
      const cleanup = () => { if (req.file) fs.promises.unlink(req.file.path).catch(() => {}); };
      if (err) {
        const tooBig = err.code === "LIMIT_FILE_SIZE";
        const badType = err.code === "UNSUPPORTED_FILE_TYPE";
        return apiFail(res, req, tooBig ? 413 : badType ? 415 : 400,
          tooBig ? "CHG_DOC_TOO_LARGE" : badType ? "CHG_DOC_TYPE" : "CHG_DOC_UPLOAD", err.message);
      }
      if (!req.file) return apiFail(res, req, 400, "CHG_DOC_NO_FILE", "فایلی در فیلد file ارسال نشده است");
      try {
        const checked = validateChangeUploadPayload(req.body ?? {});
        if (!checked.ok) { cleanup(); return apiFail(res, req, 422, "CHG_DOC_VALIDATION", checked.error); }
        const pid = req.params.projectId;
        await serial(`change-mgmt:${pid}`, async () => {
          const r = await repo();
          const request = await findRequest(r, req); /* 404 CHG_NOT_FOUND */
          const actor = String(req.chgSubject.id);
          const fileNameFa = changeSafeDocFileName(fixUtf8(req.file.originalname));
          const sha256 = sha256File(req.file.path);
          const row = await r.create("PmisChangeDocuments", {
            Code: newRecordCode("doc"), ChangeCode: request.Code, ProjectId: pid,
            TitleFa: checked.fields.titleFa, Kind: checked.fields.kind,
            DocNo: checked.fields.docNo, DocDate: checked.fields.docDate, NoteFa: checked.fields.noteFa,
            FileRef: req.file.filename, FileNameFa: fileNameFa,
            MimeType: req.file.mimetype, SizeBytes: req.file.size, Sha256: sha256,
            UploadedBy: actor, UploadedAt: new Date().toISOString(),
          }, actor, "change");
          await audit(r, pid, request.Code, "document_uploaded", actor,
            `بارگذاری فایل «${fileNameFa}» (${req.file.size} B, sha256 ${sha256.slice(0, 12)}…) به سند ${row.Code}`, null, checked.fields.kind);
          res.status(201).json({ ok: true, data: { document: publicChangeDocRow(row) }, meta: { traceId: trace() } });
        });
      } catch (e) {
        cleanup();
        if (e?.status) return apiFail(res, req, e.status, e.code, e.message);
        return apiFail(res, req, 500, "CHG_DOC_STORE", e.message);
      }
    });
  });

  /* ── فاز ۶: دانلود سند با راستی‌آزمایی sha256 — فایل دست‌نخورده پاس داده می‌شود ── */
  app.get(base + "/requests/:id/documents/:docId/download", need("change.view"), async (req, res) => {
    try {
      const r = await repo();
      const request = await findRequest(r, req); /* 404 CHG_NOT_FOUND */
      const doc = (await listChild(r, "PmisChangeDocuments", req.params.projectId, request.Code))
        .find((d) => String(d.Id) === String(req.params.docId));
      if (!doc) return apiFail(res, req, 404, "CHG_DOC_NOT_FOUND", "سند در این پرونده یافت نشد");
      if (!doc.FileRef || !doc.Sha256) return apiFail(res, req, 404, "CHG_DOC_NO_FILE", "این سند فقط متادیتا ثبت دارد و فایل بارگذاری‌شده‌ای ندارد");
      const fp = path.join(docDir, path.basename(String(doc.FileRef)));
      if (!fp.startsWith(docDir + path.sep) || !fs.existsSync(fp)) return apiFail(res, req, 404, "CHG_DOC_MISSING", "فایل سند روی دیسک نیست");
      if (sha256File(fp) !== String(doc.Sha256)) return apiFail(res, req, 409, "CHG_DOC_CORRUPT", "یکپارچگی فایل سند با اثر ثبت‌شده تطابق ندارد — دانلود متوقف شد");
      res.setHeader("x-doc-sha256", String(doc.Sha256));
      res.type(String(doc.MimeType || "application/octet-stream"));
      return res.download(fp, String(doc.FileNameFa || "document.bin"));
    } catch (e) {
      if (e?.status) return apiFail(res, req, e.status, e.code, e.message);
      return apiFail(res, req, 500, "CHG_DOC_DOWNLOAD", e.message);
    }
  });

  /* ── کاتالوگ (فقط‌خواندنی) ── */
  app.get(base + "/catalog", (req, res) => {
    res.json({ ok: true, data: {
      module: CHANGE_MODULE_ID, version: CHANGE_MODULE_VERSION, llmConnected: CHANGE_LLM_CONNECTED,
      tables: CHANGE_TABLES, childTables: CHANGE_CHILD_TABLES,
      types: CHANGE_TYPES, roles: CHANGE_ROLES,
      statuses: CHANGE_STATUSES.map((code) => ({ code, fa: CHANGE_STATUS_FA[code], perm: CHANGE_STATUS_PERM[code], to: CHANGE_TRANSITIONS[code] })),
      approvalStatuses: CHANGE_APPROVAL_STATUSES, costLayers: COST_LAYERS, costLayerFa: COST_LAYER_FA,
      reviewStatuses: REVIEW_STATUSES, linkKinds: LINK_KINDS,
      layersRuleFa: "مبالغ برآوردی/پیشنهادی/مذاکره/مصوب/پرداخت جدا و هرگز برابر پیش‌فرض نیستند؛ مبلغ مصوب قراردادی فقط پس از تأیید مرجع و مستند معتبر. مدت اثرگذاری تغییر با تمدید قراردادی یکی نیست — استحقاق جداگانه بررسی می‌شود.",
    } });
  });

  /* ── داشبورد مدیریتی — فقط از ردیف‌های واقعی + drill-down با فیلتر ── */
  app.get(base + "/dashboard", need("change.view"), run(async (r, req) => {
    const pid = req.params.projectId;
    const full = (t) => r.list(t, { where: where(pid), limit: 10000 }).catch(() => []);
    let [requests, costs, schedLinks, riskLinks, claimLinks] = await Promise.all([
      full("PmisChangeRequests"), full("PmisChangeCostEstimates"), full("PmisChangeScheduleImpacts"),
      full("PmisChangeRiskLinks"), full("PmisChangeClaimLinks"),
    ]);
    /* فیلترهای drill-down (اختیاری) — اعمال بر همهٔ جدول‌ها با ChangeCode است */
    const fStatus = String(req.query.status ?? "").trim();
    const fType = String(req.query.type ?? "").trim();
    const fFrom = String(req.query.from ?? "").trim();
    const fTo = String(req.query.to ?? "").trim();
    const fContract = String(req.query.contract ?? "").trim();
    const activeFilters = { status: fStatus || null, type: fType || null, from: fFrom || null, to: fTo || null, contract: fContract || null };
    if (fStatus) requests = requests.filter((x) => String(x.Status) === fStatus);
    if (fType) requests = requests.filter((x) => String(x.ChangeType) === fType);
    if (fFrom) requests = requests.filter((x) => String(x.RequestDate ?? "") >= fFrom);
    if (fTo) requests = requests.filter((x) => String(x.RequestDate ?? "") <= fTo);
    if (fContract) requests = requests.filter((x) => String(x.ContractCode ?? "") === fContract);
    if (fStatus || fType || fFrom || fTo || fContract) {
      const codes = new Set(requests.map((x) => String(x.Code)));
      const pick = (rows) => rows.filter((x) => codes.has(String(x.ChangeCode)));
      costs = pick(costs); schedLinks = pick(schedLinks); riskLinks = pick(riskLinks); claimLinks = pick(claimLinks);
    }
    const summary = computeChangeDashboard(requests, costs, schedLinks, riskLinks, claimLinks, new Date().toISOString().slice(0, 10));
    /* drill-down: همان فیلد کلیدی هر کادر، برای الفبیشی/کمتری در UI */
    return {
      ...summary,
      filters: activeFilters,
      drilldown: {
        requests: requests
          .slice()
          .sort((a, b) => String(b.RequestDate ?? "").localeCompare(String(a.RequestDate ?? "")))
          .slice(0, 200)
          .map((x) => ({ Id: x.Id, Code: x.Code, TitleFa: x.TitleFa, Status: x.Status, ChangeType: x.ChangeType, Priority: x.Priority, RequestDate: x.RequestDate, ContractCode: x.ContractCode ?? null, InitialCostEstimate: x.InitialCostEstimate ?? null, InitialTimeImpactDays: x.InitialTimeImpactDays ?? null, ReviewDueDate: x.ReviewDueDate ?? null })),
      },
    };
  }));

  /* ── فاز ۵: ۱۴ گزارش مدیریتی (فقط‌خواندنی از رکوردهای واقعی، با مجوز مشاهدهٔ تغییر) ── */
  app.get(base + "/management-reports", need("change.view"), run(async (r, req) => {
    const kind = String(req.query.kind ?? "");
    if (!CHANGE_MGMT_KINDS.includes(kind)) throw error(400, "CHG_MGMT_KIND", `گزارش مدیریتی نامعتبر است — مقادیر مجاز: ${CHANGE_MGMT_KINDS.join(", ")}`);
    const pid = req.params.projectId;
    const full = async (table) => r.list(table, { where: where(pid), limit: 10000 }).catch(() => []);
    const [requests, costs, schedules, moduleLinks, riskLinks, claimLinks, documents, implementation, audits] = await Promise.all([
      full("PmisChangeRequests"), full("PmisChangeCostEstimates"), full("PmisChangeScheduleImpacts"),
      full("PmisChangeModuleLinks"), full("PmisChangeRiskLinks"), full("PmisChangeClaimLinks"),
      full("PmisChangeDocuments"), full("PmisChangeImplementation"), full("PmisChangeAuditTrail"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const report = buildChangeManagementReport(kind, { requests, costs, schedules, moduleLinks, riskLinks, claimLinks, documents, implementation, audits, today });
    return { kind, ...report, llmConnected: CHANGE_LLM_CONNECTED };
  }));

  /* ── فهرست درخواست‌ها ── */
  app.get(base + "/requests", need("change.view"), run(async (r, req) => {
    const rows = await r.list("PmisChangeRequests", { where: where(req.params.projectId), limit: 5000 });
    return { requests: rows.sort((a, b) => String(b.Code).localeCompare(String(a.Code))) };
  }));

  /* ── ثبت درخواست (درخواست‌کننده با change.edit؛ وضعیت draft + ممیزی) ── */
  app.post(base + "/requests", need("change.edit"), run(async (r, req) => {
    const b = req.body ?? {};
    const v = validateChangeInput(b);
    if (!v.ok) throw error(400, "CHG_VALIDATION", v.errors.join("؛ "));
    const actor = req.chgSubject.id;
    const now = new Date().toISOString();
    const code = String(b.Code ?? "").trim() || newChangeCode();
    const exists = await r.findOne("PmisChangeRequests", [...where(req.params.projectId), { column: "Code", op: "eq", value: code }]);
    if (exists) throw error(409, "CHG_DUP", `کد ${code} در پروژه تکراری است`);
    const row = await r.create("PmisChangeRequests", {
      ProjectId: req.params.projectId, Code: code, TitleFa: String(b.TitleFa).trim(),
      ContractCode: b.ContractCode ?? null, DescriptionFa: b.DescriptionFa ?? null,
      RequestedBy: actor, RequestedByRoleCode: b.RequestedByRoleCode ?? null,
      RequestDate: b.RequestDate ?? now.slice(0, 10), ChangeType: b.ChangeType ?? "other",
      ReasonFa: b.ReasonFa ?? null, NecessityFa: b.NecessityFa ?? null,
      AffectedScopeFa: b.AffectedScopeFa ?? null, WbsRefs: b.WbsRefs ?? null,
      ActivityRefs: b.ActivityRefs ?? null, SupportDocRefs: b.SupportDocRefs ?? null,
      ClauseRefs: b.ClauseRefs ?? null, OptionsJson: b.OptionsJson ?? null,
      InitialCostEstimate: b.InitialCostEstimate ?? null, Currency: b.Currency ?? "IRR",
      InitialTimeImpactDays: b.InitialTimeImpactDays ?? null, InitialRisksJson: b.InitialRisksJson ?? null,
      Priority: b.Priority ?? "normal", ReviewOwnerFa: b.ReviewOwnerFa ?? null,
      ReviewDueDate: b.ReviewDueDate ?? null,
      Status: "draft", CreatedBy: actor, StatusChangedBy: actor, StatusChangedAt: now,
    }, actor, "change");
    await audit(r, req.params.projectId, code, "change_created", actor, "درخواست تغییر ایجاد شد", null, "draft");
    return { request: row };
  }));

  /* ── جزئیات درخواست + تمام فرزندان ── */
  app.get(base + "/requests/:id", need("change.view"), run(async (r, req) => {
    const row = await findRequest(r, req);
    const pid = req.params.projectId, cc = row.Code;
    const [impacts, costs, schedules, approvals, riskLinks, claimLinks, documents, implementation, audits, links] = await Promise.all([
      listChild(r, "PmisChangeImpacts", pid, cc), listChild(r, "PmisChangeCostEstimates", pid, cc),
      listChild(r, "PmisChangeScheduleImpacts", pid, cc), listChild(r, "PmisChangeApprovals", pid, cc),
      listChild(r, "PmisChangeRiskLinks", pid, cc), listChild(r, "PmisChangeClaimLinks", pid, cc),
      listChild(r, "PmisChangeDocuments", pid, cc), listChild(r, "PmisChangeImplementation", pid, cc),
      listChild(r, "PmisChangeAuditTrail", pid, cc), listChild(r, "PmisChangeModuleLinks", pid, cc),
    ]);
    return { request: row, children: {
      PmisChangeImpacts: impacts, PmisChangeCostEstimates: costs, PmisChangeScheduleImpacts: schedules,
      PmisChangeApprovals: approvals, PmisChangeRiskLinks: riskLinks, PmisChangeClaimLinks: claimLinks,
      PmisChangeDocuments: documents, PmisChangeImplementation: implementation,
      PmisChangeAuditTrail: audits, PmisChangeModuleLinks: links,
    } };
  }));

  /* ── ویرایش فیلدهای پرونده (نه وضعیت) ── */
  app.patch(base + "/requests/:id", need("change.edit"), run(async (r, req) => {
    const row = await findRequest(r, req);
    if (isTerminalChange(row.Status)) throw error(409, "CHG_STATUS", "درخواست بایگانی‌شده تغییر نمی‌پذیرد");
    const merged = { ...row, ...(req.body ?? {}), Id: row.Id, ProjectId: row.ProjectId, Code: row.Code, Status: row.Status, RequestedBy: row.RequestedBy, CreatedBy: row.CreatedBy };
    const v = validateChangeInput(merged);
    if (!v.ok) throw error(400, "CHG_VALIDATION", v.errors.join("؛ "));
    const patch = { ...(req.body ?? {}) };
    delete patch.Id; delete patch.ProjectId; delete patch.Code; delete patch.Status;
    delete patch.RequestedBy; delete patch.CreatedBy; delete patch.StatusChangedBy; delete patch.StatusChangedAt; delete patch.DecidedBy; delete patch.DecidedAt;
    const updated = await r.patch("PmisChangeRequests", row.Id, patch, req.chgSubject.id, row.RowVersion);
    await audit(r, req.params.projectId, row.Code, "change_updated", req.chgSubject.id, "ویرایش فیلدهای درخواست", null, null);
    return { request: updated };
  }));

  /* ── گذر وضعیت — با مجوز مرحله، یادداشت و SoD تصمیم ── */
  app.post(base + "/requests/:id/transition", need(["change.edit", "change.analyze", "change.review", "change.approve", "change.implement"]), run(async (r, req) => {
    const row = await findRequest(r, req);
    const to = String(req.body?.to ?? "");
    const noteFa = String(req.body?.noteFa ?? "").trim();
    if (!CHANGE_STATUSES.includes(to)) throw error(400, "CHG_VALIDATION", "وضعیت مقصد نامعتبر است");
    const from = String(row.Status);
    if (!canTransitionChange(from, to)) throw error(409, "CHG_STATUS", `گذر «${CHANGE_STATUS_FA[from] ?? from} → ${CHANGE_STATUS_FA[to] ?? to}» مجاز نیست`);
    const perm = CHANGE_STATUS_PERM[to];
    if (!can(req, perm)) throw error(403, "CHG_FORBIDDEN", `ورود به «${CHANGE_STATUS_FA[to]}» نیازمند مجوز ${perm} است`);
    const actor = req.chgSubject.id;
    if (changeTransitionIsDecision(to)) {
      /* SoD: تصمیم با مرجع مجاز ≠ کسی که درخواست را برای تصمیم آماده کرد */
      if (!String(noteFa)) throw error(400, "CHG_VALIDATION", "ثبت یادداشت تصمیم (دلیل/شرط‌ها) برای تصمیم نهایی الزامی است");
      if (String(row.StatusChangedBy) === actor) throw error(403, "CHG_SOD", "کسی که درخواست را برای تصمیم آماده کرده نمی‌تواند خودش تصمیم بگیرد (جدایی وظایف)");
    }
    if (!noteFa) throw error(400, "CHG_VALIDATION", "یادداشت گذر وضعیت الزامی است");
    const now = new Date().toISOString();
    const patch = { Status: to, StatusChangedBy: actor, StatusChangedAt: now, StatusNoteFa: noteFa };
    if (changeTransitionIsDecision(to)) {
      patch.DecidedBy = actor; patch.DecidedAt = now;
      patch.DecisionFa = String(req.body?.decisionFa ?? noteFa);
      if (to === "rejected") patch.RejectionReasonFa = String(req.body?.reasonFa ?? noteFa);
    }
    const updated = await r.patch("PmisChangeRequests", row.Id, patch, actor, row.RowVersion);
    await r.create("PmisChangeApprovals", {
      ChangeCode: row.Code, ProjectId: req.params.projectId, Code: newRecordCode("step"),
      StepCode: to, Stage: changeTransitionIsDecision(to) ? "approval" : "review",
      Decision: to === "rejected" ? "rejected" : (to === "approved" ? "approved" : (to === "approved_conditional" ? "approved_conditionally" : "pending")),
      DecidedBy: actor, DecidedAt: now, NoteFa: noteFa,
    }, actor, "change");
    await audit(r, req.params.projectId, row.Code, "status_changed", actor, noteFa || `گذر به ${CHANGE_STATUS_FA[to]}`, from, to);
    return { request: updated };
  }));

  /* محاسبهٔ مشترک تحلیل زمانی (بین endpoint تحلیل و سند گزارش) */
  const computeTimeAnalysis = async (r, pid, row, sched) => {
    let activities = [], relations = [];
    let requestForAnalysis = row;
    if (row.ActivityRefs || row.WbsRefs || sched.length) {
      activities = await r.list("Activity", { where: where(pid), limit: 10000 }).catch(() => []);
      const wbsNodes = await r.list("WbsNode", { where: where(pid), limit: 10000 }).catch(() => []);
      /* نگاشت «کد WBS → Id» (برنامه‌ریزی با WbsId کار می‌کند) */
      const wbsByCode = new Map(wbsNodes.map((w) => [String(w.Code), String(w.Id)]));
      const wbsRefs = Array.isArray(row.WbsRefs) ? row.WbsRefs : (typeof row.WbsRefs === "string" ? (() => { try { return JSON.parse(row.WbsRefs); } catch { return []; } })() : []);
      const resolvedWbs = wbsRefs.map((c) => wbsByCode.get(String(c))).filter(Boolean);
      requestForAnalysis = { ...row, WbsRefs: resolvedWbs };
      /* رابطه‌ها بدون ستون ProjectId — از Id فعالیت‌های همین پروژه صافی می‌شود */
      const actIds = new Set(activities.map((a) => String(a.Id)));
      relations = (await r.list("ActivityRelation", { limit: 20000 }).catch(() => []))
        .filter((rel) => actIds.has(String(rel.SuccessorId)));
    }
    return analyzeTimeImpact(requestForAnalysis, sched, activities, relations);
  };

  /* ─────────── فاز ۲: موتور تحلیل اثر زمانی (فقط‌خواندنی از d2) ─────────── */
  app.get(base + "/requests/:id/analysis/time", need("change.view"), run(async (r, req) => {
    const row = await findRequest(r, req);
    const pid = req.params.projectId;
    const sched = await listChild(r, "PmisChangeScheduleImpacts", pid, row.Code);
    const analysis = await computeTimeAnalysis(r, pid, row, sched);
    return { analysis, llmConnected: CHANGE_LLM_CONNECTED };
  }));

  /* ─────────── فاز ۲: موتور تحلیل اثر هزینه (از ردیف‌های واقعی) ─────────── */
  app.get(base + "/requests/:id/analysis/cost", need("change.view"), run(async (r, req) => {
    const row = await findRequest(r, req);
    const costs = await listChild(r, "PmisChangeCostEstimates", req.params.projectId, row.Code);
    const analysis = analyzeCostImpact(costs, String(row.Currency ?? "IRR"));
    return { analysis, llmConnected: CHANGE_LLM_CONNECTED };
  }));

  /* ─────────── فاز ۲: راستی‌آزمایی پیوندهای نرم در برابر ماژول‌های مبنأ ─────────── */
  /* راستی‌آزمایی پیوندها (بین endpoint تحلیل و سند گزارش) */
  const verifyLinksFor = async (r, pid, row) => {
    const links = await listChild(r, "PmisChangeModuleLinks", pid, row.Code);
    const codes = (rows, c = "Code") => new Set(rows.map((x) => String(x[c] ?? "")));
    const ids = (rows) => new Set(rows.map((x) => String(x.Id ?? "")));
    const [delays, claims, risks, disputes, docs, legacy, baselines, losses] = await Promise.all([
      r.list("DelayEvent", { where: where(pid), limit: 5000 }).catch(() => []),
      r.list("Claim", { where: where(pid), limit: 5000 }).catch(() => []),
      r.list("ContractRiskRegister", { where: where(pid), limit: 5000 }).catch(() => []),
      r.list("PmisDisputeCases", { where: where(pid), limit: 5000 }).catch(() => []),
      r.list("Document", { where: where(pid), limit: 10000 }).catch(() => []),
      r.list("ChangeRequest", { where: where(pid), limit: 5000 }).catch(() => []),
      r.list("Baseline", { where: where(pid), limit: 2000 }).catch(() => []),
      r.list("DelayCostItem", { where: where(pid), limit: 5000 }).catch(() => []),
    ]);
    const sets = {
      delayEventCodes: codes(delays), lossCaseCodes: ids(losses),
      contractRiskCodes: codes(risks), claimCodes: codes(claims),
      disputeCaseCodes: codes(disputes), documentIds: ids(docs),
      legacyChangeCodes: codes(legacy), baselineIds: ids(baselines),
    };
    const verified = verifyModuleLinks(links, sets);
    return { links: verified, totals: { verified: verified.filter((l) => l.verified === true).length, missing: verified.filter((l) => l.verified === false).length } };
  };

  app.get(base + "/requests/:id/analysis/links-verify", need("change.view"), run(async (r, req) => {
    const row = await findRequest(r, req);
    const { links, totals } = await verifyLinksFor(r, req.params.projectId, row);
    return { links, totals, llmConnected: CHANGE_LLM_CONNECTED };
  }));

  /* ─────────── فاز ۴: سند گزارش چرخهٔ تغییر — ۱۲ فصل / ۲۸ جدول + Auto-Cleanup ─────────── */
  app.get(base + "/requests/:id/report", need("change.view"), async (req, res, next) => {
    try {
      const r = await repo();
      const row = await findRequest(r, req);
      const pid = req.params.projectId, cc = row.Code;
      const [impacts, costs, schedules, approvals, riskLinks, claimLinks, documents, implementation, audits, moduleLinks] = await Promise.all([
        listChild(r, "PmisChangeImpacts", pid, cc), listChild(r, "PmisChangeCostEstimates", pid, cc),
        listChild(r, "PmisChangeScheduleImpacts", pid, cc), listChild(r, "PmisChangeApprovals", pid, cc),
        listChild(r, "PmisChangeRiskLinks", pid, cc), listChild(r, "PmisChangeClaimLinks", pid, cc),
        listChild(r, "PmisChangeDocuments", pid, cc), listChild(r, "PmisChangeImplementation", pid, cc),
        listChild(r, "PmisChangeAuditTrail", pid, cc), listChild(r, "PmisChangeModuleLinks", pid, cc),
      ]);
      const timeAnalysis = await computeTimeAnalysis(r, pid, row, schedules);
      const costAnalysis = analyzeCostImpact(costs, String(row.Currency ?? "IRR"));
      const { totals: verifyTotals } = await verifyLinksFor(r, pid, row);
      const format = req.query.format === "pdf" ? "pdf" : "word";
      const doc = buildChangeReport({
        projectId: pid, request: row, impacts, costs, schedules, approvals, riskLinks, claimLinks,
        documents, implementation, audits, moduleLinks,
        timeAnalysis, costAnalysis, linksVerify: verifyTotals,
        generatedAt: new Date().toISOString(), generatedBy: req.chgSubject.id, format,
      });
      if (doc.issues.length) return res.status(422).json({ ok: false, error: { code: "CHG_REPORT_GATE", message: doc.issues.join("؛ "), traceId: req.requestId } });
      await audit(r, pid, cc, format === "pdf" ? "report_pdf_generated" : "report_word_generated", req.chgSubject.id, `تولید ${doc.filename} — ۱۲ فصل/۲۸ جدول`, null, null);
      if (format === "pdf") {
        let pdf;
        try { const { htmlToPdf } = await import("./pdfRenderer.js"); pdf = await htmlToPdf(doc.body); }
        catch { return res.status(501).json({ ok: false, error: { code: "CHG_PDF_UNAVAILABLE", message: "موتور تولید PDF واقعی روی این سرور در دسترس نیست؛ خروجی Word در دسترس است", traceId: req.requestId } }); }
        res.setHeader("content-type", "application/pdf");
        res.setHeader("content-disposition", `attachment; filename="${doc.filename.replace(/\.html$/, ".pdf")}"`);
        return res.send(pdf);
      }
      res.setHeader("content-type", doc.contentType);
      res.setHeader("content-disposition", `attachment; filename="${doc.filename}"`);
      return res.send(doc.body);
    } catch (e) { next(e); }
  });

  /* ─────────── فاز ۲: پیشنهاد نسخهٔ مبنای نامستقر — اعتبارش دهندهٔ baselines_updated ─────────── */
  app.post(base + "/requests/:id/baseline-proposal", need(["change.implement", "change.review"]), run(async (r, req) => {
    const row = await findRequest(r, req);
    if (!["implementing", "baselines_updated", "execution_monitoring", "approved", "approved_conditional", "notified"].includes(String(row.Status)))
      throw error(409, "CHG_STATUS", "پیشنهاد نسخهٔ مبنا فقط پس از ورود به مسیر تصویب/اجرای تغییر ممکن است");
    if (!can(req, "change.implement")) throw error(403, "CHG_FORBIDDEN", "ساخت نسخهٔ مبنای نامستقر نیازمند مجوز اجرای تغییر است");
    const note = String(req.body?.noteFa ?? "").trim();
    if (!note || note.length > 1000) throw error(400, "CHG_VALIDATION", "یادداشت پیشنهاد مبنا الزامی است (حداکثر ۱۰۰۰ حرف)");
    const sourceBaselineId = String(req.body?.sourceBaselineId ?? "").trim();
    const pid = req.params.projectId;
    let source = null;
    if (sourceBaselineId) {
      source = await r.get("Baseline", sourceBaselineId);
      if (!source || source.ProjectId !== pid || !source.IsCurrent) throw error(422, "CHG_BASELINE", "مبنای مبدأ باید برنامهٔ مبنای جاری همین پروژه باشد");
    } else {
      const all = await r.list("Baseline", { where: where(pid), limit: 1000 }).catch(() => []);
      source = all.find((b) => b.IsCurrent === true || Number(b.IsCurrent) === 1) ?? null;
      if (!source) throw error(422, "CHG_BASELINE", "هیچ مبنای جاری در ماژول برنامه‌ریزی برای این پروژه وجود ندارد");
    }
    /* تکراری: اگر نسخهٔ پیوندشدهٔ همین تغییر وجود دارد، دوباره نساز */
    const existing = await listChild(r, "PmisChangeModuleLinks", pid, row.Code);
    const dup = existing.find((l) => String(l.LinkKind) === "baseline_revision");
    if (dup) throw error(409, "CHG_BASELINE", "برای این درخواست یک پیشنهاد نسخهٔ مبنا ثبت شده است (نسخهٔ جدید بدون ابطال قبلی نمی‌سازیم)");
    const actor = req.chgSubject.id;
    const now = new Date().toISOString();
    let snapshot = source.Snapshot ?? {};
    if (typeof snapshot === "string") { try { snapshot = JSON.parse(snapshot); } catch { snapshot = { raw: snapshot }; } }
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) snapshot = { value: snapshot };
    const candidateId = `chg-${String(row.Id).replace(/[^A-Za-z0-9_-]/g, "").slice(-32)}`;
    let candidate = await r.get("Baseline", candidateId);
    if (!candidate) {
      candidate = await r.create("Baseline", {
        Id: candidateId, ProjectId: pid,
        Name: `${String(source.Name ?? source.Id).slice(0, 70)} + ${row.Code}`.slice(0, 120),
        SetAt: now, SetBy: actor, IsCurrent: false,
        Snapshot: { ...snapshot, sourceBaselineId: source.Id, appliedChange: { changeId: row.Id, changeCode: row.Code, costImpact: null, timeImpactDays: null, appliedBy: actor, appliedAt: now, note } },
      }, actor, "baseline");
    }
    await r.create("PmisChangeModuleLinks", {
      ChangeCode: row.Code, ProjectId: pid, Code: newRecordCode("link"),
      LinkKind: "baseline_revision", TargetCode: candidate.Id, TargetTitleFa: String(candidate.Name ?? candidate.Id),
      DescriptionFa: note, EstablishedBy: actor, EstablishedAt: now, CreatedBy: actor, CreatedAt: now,
    }, actor, "change");
    await r.create("PmisChangeImplementation", {
      ChangeCode: row.Code, ProjectId: pid, Code: newRecordCode("impl"),
      Step: "baselines_updated", Status: "planned",
      BaselineUpdateRef: candidate.Id, ExecutionResultFa: note, UpdatedBy: actor, UpdatedAt: now,
    }, actor, "change");
    await audit(r, pid, row.Code, "baseline_proposal_created", actor, note, null, candidate.Id);
    return { baseline: candidate, linkKind: "baseline_revision", sourceBaselineId: source.Id };
  }));

  /* ── حذف پیش‌نویس بدون فرزند ── */
  app.delete(base + "/requests/:id", need("change.edit"), run(async (r, req) => {
    const row = await findRequest(r, req);
    if (row.Status !== "draft") throw error(409, "CHG_STATUS", "فقط پیش‌نویس حذف می‌شود");
    for (const t of CHANGE_CHILD_TABLES) {
      const rows = await listChild(r, t, req.params.projectId, row.Code);
      if (rows.length > 0) throw error(409, "CHG_CHILDREN", "درخواست دارای رکورد فرزند است و حذف نمی‌شود");
    }
    await r.remove("PmisChangeRequests", row.Id);
    await audit(r, req.params.projectId, row.Code, "change_deleted", req.chgSubject.id, "پیش‌نویس حذف شد", row.Code, null);
    return { deleted: true, code: row.Code };
  }));

  /* ── ثبت رکورد فرزند با اعتبارسنجی + قواعد لایه‌بندی ── */
  app.post(base + "/requests/:id/rows/:table", need(["change.edit", "change.analyze", "change.review"]), run(async (r, req) => {
    const table = String(req.params.table);
    if (!CHILD_SET.has(table) || table === "PmisChangeAuditTrail" || table === "PmisChangeApprovals") throw error(400, "CHG_TABLE", "جدول فرزند در این مسیر ثبت نمی‌شود");
    const row = await findRequest(r, req);
    if (isTerminalChange(row.Status) || row.Status === "closed") throw error(409, "CHG_STATUS", "درخواست بسته/بایگانی تغییر نمی‌پذیرد");
    const b = { ...(req.body ?? {}) };
    const actor = req.chgSubject.id;
    /* تزریق سمت سرور هویت تهیه‌کننده — هرگز از کلاینت پذیرفته نمی‌شود */
    /* تزریق هویت تهیه‌کننده — هر جدول فقط ستون‌های تعریف‌شدهٔ خودش */
    if (table === "PmisChangeImpacts") { b.AnalyzedBy = actor; b.AnalyzedAt = new Date().toISOString(); }
    if (table === "PmisChangeScheduleImpacts") { b.PreparedBy = actor; b.PreparedAt = new Date().toISOString(); }
    if (table === "PmisChangeCostEstimates") { b.PreparedBy = actor; b.PreparedAt = new Date().toISOString(); }
    if (table === "PmisChangeRiskLinks" || table === "PmisChangeClaimLinks" || table === "PmisChangeModuleLinks") { b.CreatedBy = actor; b.CreatedAt = new Date().toISOString(); b.EstablishedBy = actor; b.EstablishedAt = new Date().toISOString(); }
    if (table === "PmisChangeDocuments") { b.UploadedBy = actor; b.UploadedAt = new Date().toISOString(); }
    if (table === "PmisChangeImplementation") { b.UpdatedBy = actor; b.UpdatedAt = new Date().toISOString(); }
    /* مجوز تخصصی هر جدول */
    const permFor = {
      PmisChangeImpacts: "change.analyze", PmisChangeScheduleImpacts: "change.analyze", PmisChangeCostEstimates: "change.analyze",
      PmisChangeRiskLinks: "change.review", PmisChangeClaimLinks: "change.review", PmisChangeImplementation: "change.implement",
      PmisChangeDocuments: "change.edit", PmisChangeModuleLinks: "change.edit",
    }[table];
    if (!can(req, permFor)) throw error(403, "CHG_FORBIDDEN", `ثبت در این جدول نیازمند مجوز ${permFor} است`);
    /* قواعد لایهٔ approved/paid: مبلغ مصوب فقط با مستند معتبر */
    if (table === "PmisChangeCostEstimates" && ["approved", "paid"].includes(String(b.Layer)) && !String(b.SourceFa ?? "").trim())
      throw error(422, "CHG_AMOUNT_SOURCE", "مبلغ مصوب/پرداخت‌شده بدون منبع و مستند معتبر ثبت نمی‌شود");
    const v = validateChildRow(table, b);
    if (!v.ok) throw error(400, "CHG_VALIDATION", v.errors.join("؛ "));
    const code = String(b.Code ?? "").trim() || newRecordCode(table.slice(10, 14));
    b.Code = code; b.ChangeCode = row.Code; b.ProjectId = req.params.projectId;
    const created = await r.create(table, b, actor, "change");
    await audit(r, req.params.projectId, row.Code, `${table.replace("PmisChange", "").toLowerCase()}_added`, actor, `ثبت ${code}`, null, code);
    return { row: created };
  }));

  /* ── ویرایش رکورد فرزند + SoD لایه‌های مبلغ ── */
  app.patch(base + "/requests/:id/rows/:table/:rowId", need(["change.edit", "change.analyze", "change.review"]), run(async (r, req) => {
    const table = String(req.params.table);
    if (!CHILD_SET.has(table) || table === "PmisChangeAuditTrail" || table === "PmisChangeApprovals") throw error(400, "CHG_TABLE", "جدول قابل ویرایش نیست");
    const row = await findRequest(r, req);
    if (isTerminalChange(row.Status) || row.Status === "closed") throw error(409, "CHG_STATUS", "درخواست بسته/بایگانی تغییر نمی‌پذیرد");
    const existing = await r.findOne(table, [...childWhere(req.params.projectId, row.Code), { column: "Id", op: "eq", value: req.params.rowId }]);
    if (!existing) throw error(404, "CHG_NOT_FOUND", "رکورد یافت نشد");
    const merged = { ...existing, ...(req.body ?? {}), Id: existing.Id };
    const v = validateChildRow(table, merged);
    if (!v.ok) throw error(400, "CHG_VALIDATION", v.errors.join("؛ "));
    const patch = { ...(req.body ?? {}) };
    delete patch.Id; delete patch.ProjectId; delete patch.ChangeCode; delete patch.Code;
    const actor = req.chgSubject.id;
    /* تغییر وضعیت بازبینی (draft/under_review/approved/rejected) فقط با change.review
     * و SoD: تأییدکننده ≠ تهیه‌کنندهٔ رکورد */
    if (patch.ReviewStatus !== undefined) {
      if (!REVIEW_STATUSES.includes(String(patch.ReviewStatus))) throw error(400, "CHG_VALIDATION", "وضعیت بازبینی نامعتبر است");
      if (!can(req, "change.review")) throw error(403, "CHG_FORBIDDEN", "تغییر وضعیت بازبینی نیازمند مجوز بازبینی است");
      if (String(patch.ReviewStatus) === "approved") {
        const prepared = String(existing.PreparedBy ?? existing.AnalyzedBy ?? existing.CreatedBy ?? "");
        if (prepared && prepared === actor) throw error(403, "CHG_SOD", "تهیه‌کنندهٔ رکورد نمی‌تواند همان را تأیید کند (جدایی وظایف)");
        patch.ReviewedBy = actor; patch.ReviewedAt = new Date().toISOString();
      } else { patch.ReviewedBy = null; patch.ReviewedAt = null; }
    }
    /* لایهٔ approved/paid فقط با change.review و تأییدکننده ≠ تهیه‌کننده */
    if (table === "PmisChangeCostEstimates" && ["approved", "paid"].includes(String(merged.Layer ?? ""))) {
      if (!can(req, "change.review")) throw error(403, "CHG_FORBIDDEN", "تغییر لایهٔ مصوب/پرداخت نیازمند مجوز بازبینی است");
      if (String(existing.Layer) !== String(merged.Layer) && String(existing.PreparedBy ?? "") === actor)
        throw error(403, "CHG_SOD", "تهیه‌کنندهٔ مبلغ نمی‌تواند همان را به لایهٔ مصوب/پرداخت ارتقا دهد");
      patch.ApprovedBy = actor; patch.ApprovedAt = new Date().toISOString();
    }
    const updated = await r.patch(table, existing.Id, patch, actor, existing.RowVersion);
    await audit(r, req.params.projectId, row.Code, `${table.replace("PmisChange", "").toLowerCase()}_updated`, actor, `ویرایش ${existing.Code}`, null, null);
    return { row: updated };
  }));

  /* ── حذف رکورد فرزند: فقط رکوردهای پیش‌نویس و بدون مرجع تأیید ── */
  app.delete(base + "/requests/:id/rows/:table/:rowId", need("change.edit"), run(async (r, req) => {
    const table = String(req.params.table);
    if (!CHILD_SET.has(table) || table === "PmisChangeAuditTrail" || table === "PmisChangeApprovals") throw error(400, "CHG_TABLE", "جدول قابل حذف نیست");
    const row = await findRequest(r, req);
    if (isTerminalChange(row.Status) || row.Status === "closed") throw error(409, "CHG_STATUS", "درخواست بسته/بایگانی تغییر نمی‌پذیرد");
    const existing = await r.findOne(table, [...childWhere(req.params.projectId, row.Code), { column: "Id", op: "eq", value: req.params.rowId }]);
    if (!existing) throw error(404, "CHG_NOT_FOUND", "رکورد یافت نشد");
    if (["approved"].includes(String(existing.ReviewStatus ?? ""))) throw error(409, "CHG_REVIEW_LOCKED", "رکورد تأییدشده حذف نمی‌شود");
    await r.remove(table, existing.Id);
    await audit(r, req.params.projectId, row.Code, `${table.replace("PmisChange", "").toLowerCase()}_deleted`, req.chgSubject.id, `حذف ${existing.Code}`, existing.Code, null);
    return { deleted: true, code: existing.Code };
  }));
}
