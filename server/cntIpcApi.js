/**
 * CNT — قالب‌پذیری صورت‌وضعیت (P8 / CNT-1) — سرور
 * ------------------------------------------------------------------
 * قالب: /api/cnt-ipc/:projectId/templates  (تعریف، انتشار، بازنشستگی)
 * دوره: /api/cnt-ipc/:projectId/certificates (تهیه، ارسال، تصویب، برگشت)
 *
 * قواعد:
 *  - محاسبه همیشه سمت سرور از ورودی معتبر و قالب منتشرشده انجام می‌شود و
 *    نتیجه در همان رکورد ذخیره می‌گردد؛ عدد محاسبه‌شده از بدنه پذیرفته نمی‌شود.
 *  - تفکیک وظیفه: تهیه‌کننده ≠ تصویب‌کننده (SOD-11).
 *  - دو جدول CNT-IPC از CRUD عمومی و ورود مستقیم Excel بسته‌اند.
 *  - هر رکورد RowVersion دارد؛ نوشتن با نسخهٔ کهنه ۴۰۹ می‌گیرد.
 */
import {
  CNT_MODEL,
  IPC_TEMPLATE_FIELDS,
  normalizeIpcTemplate,
  normalizeIpcInputs,
  computeIpc,
  ipcTransition,
  templateTransition,
  cntIpcMetrics,
  todayIso,
  CntValidationError,
} from "./cntIpcLogic.js";

export const CNT_IPC_TABLES = ["CntIpcTemplate", "CntIpcCertificate"];

/** جدول‌های قالب صورت‌وضعیت و مسیر اختصاصی‌شان. */
export const CNT_IPC_DEDICATED_ROUTES = {
  CntIpcTemplate: "/api/cnt-ipc/:projectId/templates",
  CntIpcCertificate: "/api/cnt-ipc/:projectId/certificates",
};

const PROJECT_RE = /^[A-Za-z0-9_-]{1,50}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const MAX_LIST = 300;

class CntError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new CntError(400, code, message, extra);
const conflict = (code, message, extra) => new CntError(409, code, message, extra);
const notFound = (message) => new CntError(404, "E-CNT-IPC-NOT-FOUND", message);

export function registerCntIpcRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app) throw new Error("registerCntIpcRoutes: app is required");

  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
  const fail = (req, res, err) => {
    if (err instanceof CntError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    if (err instanceof CntValidationError) return res.status(400).json({ ok: false, error: { code: "E-CNT-IPC-VALIDATION", message: err.message, traceId: req.requestId } });
    if (err?.code === "ROW_VALIDATION_FAILED") return res.status(400).json({ ok: false, error: { code: "E-CNT-IPC-VALIDATION", message: err.message, traceId: req.requestId } });
    if (err?.code === "UNIQUE_VIOLATION" || err?.code === "DUPLICATE_KEY") return res.status(409).json({ ok: false, error: { code: "E-CNT-IPC-DUPLICATE", message: "کد/دورهٔ تکراری در همین پروژه", traceId: req.requestId } });
    console.error("[%s] cnt-ipc error:", req.requestId, err);
    return res.status(500).json({ ok: false, error: { code: "E-CNT-IPC-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects?.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-CNT-IPC-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-CNT-IPC-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر و فعال الزامی است", permission, traceId: req.requestId } });
    }
    if (!evaluate(subject, permission, { projectId: req.params.projectId }).allow) {
      return res.status(403).json({ ok: false, error: { code: "E-CNT-IPC-FORBIDDEN", message: "مجوز این اقدام یا دسترسی به این پروژه را ندارید", permission, traceId: req.requestId } });
    }
    return next();
  };
  const needAny = (permissions) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-CNT-IPC-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-CNT-IPC-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر و فعال الزامی است", permission: permissions.join("|"), traceId: req.requestId } });
    }
    if (!permissions.some((p) => evaluate(subject, p, { projectId: req.params.projectId }).allow)) {
      return res.status(403).json({ ok: false, error: { code: "E-CNT-IPC-FORBIDDEN", message: "مجوز دیدن این بخش را ندارید", permission: permissions.join("|"), traceId: req.requestId } });
    }
    return next();
  };
  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      if (!r) throw new CntError(503, "E-CNT-IPC-NO-STORE", "لایهٔ ماندگاری در دسترس نیست");
      await handler(req, res, r, req.params.projectId);
    } catch (err) {
      fail(req, res, err);
    }
  };
  const audit = async (r, req, action, details) => {
    try {
      await r.create("AuditLog", {
        At: new Date().toISOString(),
        SubjectId: actor(req),
        Action: action,
        ProjectCode: req.params.projectId,
        EntityName: details.entityName ?? null,
        EntityId: details.entityId ?? null,
        Severity: details.severity ?? "info",
        Details: { traceId: req.requestId, ...details },
      }, actor(req));
    } catch {
      console.error("[%s] cnt-ipc audit failed %s", req.requestId, action);
    }
  };
  const bodyOf = (req) => {
    const b = req.body;
    if (!b || typeof b !== "object" || Array.isArray(b)) throw bad("E-CNT-IPC-BODY", "بدنهٔ JSON لازم است");
    return b;
  };
  const rejectForeign = (body, allowed) => {
    const invalid = Object.keys(body).find((k) => !allowed.includes(k));
    if (invalid) throw bad("E-CNT-IPC-FIELD", `فیلد قابل نوشتن نیست: ${invalid}`);
  };
  const requireVersion = (row, value) => {
    if (!Number.isInteger(value) || value !== row.RowVersion) throw conflict("E-CNT-IPC-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی و مقایسه کنید");
  };
  const modelGuard = (row) => {
    if (row.ModelVersion && row.ModelVersion !== CNT_MODEL) throw conflict("E-CNT-IPC-MODEL", "نسخهٔ مدل رکورد پشتیبانی نمی‌شود؛ مهاجرت داده لازم است");
    return row;
  };
  const cap = async (r, table, where, limit = MAX_LIST) => {
    const rows = await r.list(table, { where, limit: limit + 1 });
    if (rows.length > limit) throw conflict("E-CNT-IPC-CAPACITY", `سقف این نما ${limit} رکورد در هر پروژه است؛ فهرست ناقص نمایش داده نمی‌شود`);
    return rows;
  };
  const jsonOf = (v, fallback) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }
    return fallback;
  };
  const templateView = (row) => ({ ...row, Items: jsonOf(row.ItemsJson, []), Deductions: jsonOf(row.DeductionsJson, []) });
  const certificateView = (row) => ({
    ...row,
    Inputs: jsonOf(row.InputsJson, []),
    Computation: row.ComputationJson && typeof row.ComputationJson === "object" && !Array.isArray(row.ComputationJson) ? row.ComputationJson : null,
  });
  const publishedTemplateOrFail = async (r, pid, code) => {
    const row = await r.findOne("CntIpcTemplate", [...byProject(pid), { column: "Code", op: "eq", value: code }]);
    if (!row) throw notFound(`قالب صورت‌وضعیت «${code}» در این پروژه نیست`);
    modelGuard(row);
    if (row.Status !== "published") throw conflict("E-CNT-IPC-TEMPLATE", "صورت‌وضعیت فقط روی قالب منتشرشده ساخته می‌شود");
    return row;
  };

  const base = "/api/cnt-ipc/:projectId";

  /* ── نمای تجمیعی ── */
  app.get(`${base}/workspace`, needAny(["cnt.contract.view", "cnt.ipc.prepare", "cnt.ipc.approve", "cnt.ipc.review"]), route(async (req, res, r, pid) => {
    const can = (permission) => {
      const subject = subjectOf(req);
      return subject ? evaluate(subject, permission, { projectId: pid }).allow : false;
    };
    const [templates, certificates] = await Promise.all([
      cap(r, "CntIpcTemplate", byProject(pid)),
      cap(r, "CntIpcCertificate", byProject(pid)),
    ]);
    return ok(req, res, {
      projectId: pid,
      can: {
        templateEdit: can("cnt.ipctemplate.edit"),
        certificateRecord: can("cnt.ipc.prepare"),
        certificateApprove: can("cnt.ipc.approve"),
      },
      templates: templates.sort((a, b) => String(a.Code).localeCompare(String(b.Code))).map((row) => { modelGuard(row); return templateView(row); }),
      certificates: certificates.sort((a, b) => Number(b.PeriodNo) - Number(a.PeriodNo)).map((row) => { modelGuard(row); return certificateView(row); }),
      metrics: cntIpcMetrics({ templates, certificates }),
      generatedAt: new Date().toISOString(),
      modelVersion: CNT_MODEL,
    });
  }));

  /* ── قالب‌ها ── */
  app.post(`${base}/templates`, need("cnt.ipctemplate.edit"), route(async (req, res, r, pid) => {
    const data = normalizeIpcTemplate(bodyOf(req));
    if (await r.findOne("CntIpcTemplate", [...byProject(pid), { column: "Code", op: "eq", value: data.Code }])) {
      throw conflict("E-CNT-IPC-DUPLICATE", `قالب ${data.Code} تکراری است`);
    }
    if (data.ContractCode) {
      const contract = await r.findOne("ContractMaster", [...byProject(pid), { column: "Code", op: "eq", value: data.ContractCode }]);
      if (!contract) throw bad("E-CNT-IPC-CONTRACT", `پیمان «${data.ContractCode}» در این پروژه نیست`, { field: "ContractCode" });
    }
    const row = await r.create("CntIpcTemplate", {
      ProjectId: pid, Code: data.Code, TitleFa: data.TitleFa, ContractCode: data.ContractCode,
      ItemsJson: data.Items, DeductionsJson: data.Deductions, Status: "draft", Version: 0, NoteFa: data.NoteFa, ModelVersion: CNT_MODEL,
    }, actor(req), "cnttpl");
    await audit(r, req, "CNT_IPC_TEMPLATE_CREATE", { entityName: "CntIpcTemplate", entityId: row.Id, code: row.Code, items: data.Items.length, deductions: data.Deductions.length });
    return ok(req, res, templateView(row), 201);
  }));

  app.patch(`${base}/templates/:code`, need("cnt.ipctemplate.edit"), route(async (req, res, r, pid) => {
    const row = await r.findOne("CntIpcTemplate", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("قالب صورت‌وضعیت در این پروژه یافت نشد");
    modelGuard(row);
    if (row.Status !== "draft") throw conflict("E-CNT-IPC-LOCKED", "قالب منتشرشده ویرایش نمی‌شود؛ قالب تازه با همان کد بسازید");
    const body = bodyOf(req);
    rejectForeign(body, [...IPC_TEMPLATE_FIELDS.filter((f) => f !== "Code"), "RowVersion"]);
    /* RowVersion فقط برای کنترل هم‌زمانی است؛ نباید به اعتبارسنج میدان برود. */
    const { RowVersion, ...fields } = body;
    requireVersion(row, RowVersion);
    const merged = normalizeIpcTemplate({
      Code: row.Code, TitleFa: row.TitleFa, ContractCode: row.ContractCode,
      Items: jsonOf(row.ItemsJson, []), Deductions: jsonOf(row.DeductionsJson, []), NoteFa: row.NoteFa, ...fields,
    });
    const result = await r.patch("CntIpcTemplate", row.Id, {
      TitleFa: merged.TitleFa, ContractCode: merged.ContractCode, ItemsJson: merged.Items,
      DeductionsJson: merged.Deductions, NoteFa: merged.NoteFa,
    }, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-CNT-IPC-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("CntIpcTemplate", row.Id);
    await audit(r, req, "CNT_IPC_TEMPLATE_UPDATE", { entityName: "CntIpcTemplate", entityId: row.Id, code: row.Code });
    return ok(req, res, templateView(saved));
  }));

  app.post(`${base}/templates/:code/transition`, need("cnt.ipctemplate.edit"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    const row = await r.findOne("CntIpcTemplate", [...byProject(pid), { column: "Code", op: "eq", value: req.params.code }]);
    if (!row) throw notFound("قالب صورت‌وضعیت در این پروژه یافت نشد");
    modelGuard(row);
    /* نسخه در خود موتور تعیین می‌شود (پیش‌نویس ۰ → انتشار ۱). */
    const { Status, patch } = templateTransition(String(body.action || ""), templateView(row), actor(req), new Date().toISOString());
    const result = await r.patch("CntIpcTemplate", row.Id, patch, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-CNT-IPC-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("CntIpcTemplate", row.Id);
    await audit(r, req, `CNT_IPC_TEMPLATE_${String(body.action || "").toUpperCase()}`, { entityName: "CntIpcTemplate", entityId: row.Id, code: row.Code, status: Status });
    return ok(req, res, templateView(saved));
  }));

  /* ── صورت‌وضعیت دوره ── */
  app.post(`${base}/certificates`, need("cnt.ipc.prepare"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    rejectForeign(body, ["TemplateCode", "PeriodNo", "PeriodFrom", "PeriodTo", "Currency", "Inputs", "NoteFa"]);
    const templateCode = String(body.TemplateCode || "");
    const template = await publishedTemplateOrFail(r, pid, templateCode);
    const templateView2 = templateView(template);
    const periodNo = Number(body.PeriodNo);
    if (!Number.isInteger(periodNo) || periodNo < 1 || periodNo > 60) throw bad("E-CNT-IPC-VALIDATION", "شمارهٔ دوره باید عددی بین ۱ و ۶۰ باشد", { field: "PeriodNo" });
    const from = String(body.PeriodFrom || "");
    const to = String(body.PeriodTo || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw bad("E-CNT-IPC-VALIDATION", "بازهٔ دوره باید تاریخ YYYY-MM-DD باشد", { field: "PeriodFrom" });
    if (to < from) throw bad("E-CNT-IPC-VALIDATION", "پایان دوره نباید پیش از آغاز آن باشد", { field: "PeriodTo" });
    const currency = String(body.Currency || "IRR").toUpperCase();
    if (currency !== "IRR" && currency !== "EUR" && currency !== "USD") throw bad("E-CNT-IPC-VALIDATION", "ارز مجاز نیست", { field: "Currency" });
    if (await r.findOne("CntIpcCertificate", [...byProject(pid), { column: "TemplateCode", op: "eq", value: templateCode }, { column: "PeriodNo", op: "eq", value: periodNo }])) {
      throw conflict("E-CNT-IPC-DUPLICATE", `صورت‌وضعیت دورهٔ ${periodNo} برای قالب ${templateCode} قبلاً ثبت شده است`);
    }
    const inputs = normalizeIpcInputs(body.Inputs ?? []);
    const computation = computeIpc(templateView2, inputs);
    if (computation.flags.noRows) throw bad("E-CNT-IPC-VALIDATION", "صورت‌وضعیت بدون ردیف محاسبه‌شده معنا ندارد؛ ورودی حداقل یک ردیف لازم دارد");
    if (computation.flags.negativeNet) throw bad("E-CNT-IPC-VALIDATION", "ماندهٔ خالص منفی است؛ مبلغ کسورات بیش از کارکرد است");
    const row = await r.create("CntIpcCertificate", {
      ProjectId: pid, TemplateCode: templateCode, TemplateVersion: Math.max(0, Number(template.Version ?? 0)),
      ContractCode: templateView2.ContractCode ?? null,
      PeriodNo: periodNo, PeriodFrom: from, PeriodTo: to, Currency: currency,
      InputsJson: inputs, ComputationJson: computation,
      GrossAmount: computation.grossAmount, DeductionTotal: computation.deductionTotal, NetAmount: computation.netAmount,
      Status: "draft", NoteFa: typeof body.NoteFa === "string" ? body.NoteFa.slice(0, 1000) : null, ModelVersion: CNT_MODEL,
    }, actor(req), "cntipc");
    await audit(r, req, "CNT_IPC_CERT_CREATE", {
      entityName: "CntIpcCertificate", entityId: row.Id, templateCode, periodNo,
      gross: computation.grossAmount, deductions: computation.deductionTotal, net: computation.netAmount, currency,
    });
    return ok(req, res, certificateView(row), 201);
  }));

  app.post(`${base}/certificates/:id/transition`, route(async (req, res, r, pid) => {
    if (!ID_RE.test(String(req.params.id))) throw bad("E-CNT-IPC-FIELD", "شناسهٔ صورت‌وضعیت نامعتبر است");
    const body = bodyOf(req);
    const action = String(body.action || "");
    const permission = action === "submit" ? "cnt.ipc.prepare" : "cnt.ipc.approve";
    const subject = subjectOf(req);
    if (!subject) throw new CntError(401, "E-CNT-IPC-AUTH-REQUIRED", "شناسهٔ کاربر معتبر و فعال الزامی است");
    if (!evaluate(subject, permission, { projectId: pid }).allow) {
      throw new CntError(403, "E-CNT-IPC-FORBIDDEN", "مجوز این اقدام را ندارید", { permission });
    }
    const row = await r.findOne("CntIpcCertificate", [...byProject(pid), { column: "Id", op: "eq", value: req.params.id }]);
    if (!row) throw notFound("صورت‌وضعیت در این پروژه یافت نشد");
    modelGuard(row);
    /* سند مصوب باید همان محاسبهٔ سرور باشد؛ ورودی دوباره از قاعده می‌گذرد. */
    let recomputed = null;
    if (action === "submit" || action === "approve") {
      const template = await publishedTemplateOrFail(r, pid, row.TemplateCode);
      /* اگر قالب بعد از تهیهٔ سند تغییر کرده باشد، محاسبهٔ مبنا دیگر همان نیست. */
      if (Number(template.Version ?? 0) !== Number(row.TemplateVersion ?? 0)) {
        throw conflict("E-CNT-IPC-STALE", `نسخهٔ قالب از ${row.TemplateVersion} به ${template.Version} رفته است؛ صورت‌وضعیت را دوباره تهیه کنید`);
      }
      recomputed = computeIpc(templateView(template), normalizeIpcInputs(jsonOf(row.InputsJson, [])));
      if (recomputed.flags.noRows) throw conflict("E-CNT-IPC-EMPTY", "صورت‌وضعیت ردیف محاسبه‌شده ندارد؛ دوباره تهیه کنید");
      if (recomputed.netAmount !== Number(row.NetAmount)) {
        throw conflict("E-CNT-IPC-STALE", "مبلغ ذخیره‌شده با محاسبهٔ فعلی نمی‌خواند؛ صورت‌وضعیت را دوباره تهیه کنید");
      }
    }
    const note = typeof body.note === "string" ? body.note : null;
    const now = new Date().toISOString();
    const { Status, patch } = ipcTransition(action, row, actor(req), note, now);
    /* سند مصوب باید مهر تأیید داشته باشد؛ اگر تصویب‌کننده یادداشت نداده باشد،
       سرور مهر را از هویت و مبلغ محاسبه‌شده می‌سازد تا رد حسابرسی ناقص نماند. */
    const signedNote = Status === "approved"
      ? (note && note.trim() ? note.trim().slice(0, 500) : `تأیید ${actor(req)} در ${now} — خالص ${Number(row.NetAmount)} ${row.Currency ?? "IRR"} (نسخهٔ قالب ${Number(row.TemplateVersion ?? 0)})`).slice(0, 500)
      : null;
    const nextPatch = Status === "approved" ? { ...patch, SignedNoteFa: signedNote } : patch;
    const result = await r.patch("CntIpcCertificate", row.Id, nextPatch, actor(req), row.RowVersion);
    if (!result.ok) throw conflict("E-CNT-IPC-VERSION", "نسخهٔ رکورد عوض شده است؛ بازخوانی کنید");
    const saved = await r.get("CntIpcCertificate", row.Id);
    await audit(r, req, `CNT_IPC_CERT_${action.toUpperCase()}`, {
      entityName: "CntIpcCertificate", entityId: row.Id, templateCode: row.TemplateCode, periodNo: row.PeriodNo,
      status: Status, net: saved.NetAmount, currency: saved.Currency,
      severity: action === "return" ? "warn" : "info",
    });
    return ok(req, res, { ...certificateView(saved), computed: recomputed });
  }));

  /* ── پیش‌نمایش محاسبه بدون ذخیره (ورودی معتبر، قالب منتشرشده) ── */
  app.post(`${base}/preview`, need("cnt.ipc.prepare"), route(async (req, res, r, pid) => {
    const body = bodyOf(req);
    rejectForeign(body, ["TemplateCode", "Inputs"]);
    const template = await publishedTemplateOrFail(r, pid, String(body.TemplateCode || ""));
    const computation = computeIpc(templateView(template), normalizeIpcInputs(body.Inputs ?? []));
    /* قالب و نسخه‌اش هم برگردانده می‌شود: پیش‌نمایش باید بگوید با کدام نسخه
       محاسبه شده و همان نسخه مبنای سند ذخیره‌شده خواهد بود. */
    return ok(req, res, { computation, template: templateView(template), asOf: todayIso() });
  }));

  return { CNT_IPC_TABLES };
}
