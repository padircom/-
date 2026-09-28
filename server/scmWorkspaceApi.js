/**
 * میز کار خرید و تدارکات — SCM/PPMS (P5)
 * ------------------------------------------------------------------
 * چرخه کامل: Vendor/AVL → بسته خرید → MR link → بسته استعلام → LBL/SBL → دعوت‌نامه
 * → تغییر MR لاگ → رسید مواد MRS/OPI
 *
 * اصول:
 * - Vendor Code یکتا در پروژه
 * - AVL یکتا Vendor+Discipline+Category
 * - Package Code یکتا
 * - Package-MR Link یکتا Package+MrCode و MR باید وجود داشته باشد
 * - InquiryPackage Code یکتا و PackageId باید وجود داشته باشد
 * - BidderList یکتا Inquiry+Vendor و Vendor باید در پروژه باشد و AVL فعال (هشدار اگر نباشد ولی مانع نیست در LBL، مانع در SBL)
 * - Invitation No یکتا و باید BidderList وجود داشته باشد
 * - MR Change Log هر تغییر MR ثبت می‌شود؛ اعلان خودکار (pending) و سپس تأیید ارسال
 * - MRR Code یکتا و PoNo باید وجود داشته باشد
 */

const PROJECT_RE = /^[A-Za-z0-9_-]{1,60}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-]{0,39}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class ScmError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new ScmError(400, code, message, extra);
const conflict = (code, message, extra) => new ScmError(409, code, message, extra);
const notFound = (message) => new ScmError(404, "E-SCM-NOT-FOUND", message);
const forbidden = (code, message) => new ScmError(403, code, message);

function text(v, field, { max = 1000, required = false } = {}) {
  const s = String(v ?? "").trim();
  if (!s) {
    if (required) throw bad("E-SCM-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  if (s.length > max) throw bad("E-SCM-TOO-LONG", `«${field}» حداکثر ${max} نویسه است`, { field });
  return s;
}
function code(v, field, { required = true } = {}) {
  const s = String(v ?? "").trim();
  if (!s) {
    if (required) throw bad("E-SCM-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  if (!CODE_RE.test(s)) throw bad("E-SCM-INVALID-CODE", `«${field}» فقط حروف لاتین، رقم، نقطه، خط تیره (حداکثر ۴۰)`, { field });
  return s;
}
function date(v, field, { required = false } = {}) {
  const s = String(v ?? "").trim();
  if (!s) {
    if (required) throw bad("E-SCM-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) throw bad("E-SCM-INVALID-DATE", `«${field}» تاریخ YYYY-MM-DD نیست`, { field });
  return s;
}
function num(v, field, { min = -Infinity, max = Infinity, int = false, required = false } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) throw bad("E-SCM-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  const x = Number(v);
  if (!Number.isFinite(x) || (int && !Number.isInteger(x)) || x < min || x > max) {
    throw bad("E-SCM-INVALID-NUMBER", `«${field}» عدد معتبر نیست`, { field });
  }
  return x;
}
function enumCheck(v, allowed, field) {
  const s = String(v ?? "").trim();
  if (!allowed.includes(s)) throw bad("E-SCM-INVALID-ENUM", `«${field}» باید یکی از ${allowed.join("/")} باشد`, { field });
  return s;
}

export function registerScmWorkspaceRoutes(app, { repo, subjects, evaluate }) {
  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
  const fail = (req, res, err) => {
    if (err instanceof ScmError) {
      return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    }
    if (err?.code === "ROW_VALIDATION_FAILED") {
      return res.status(400).json({ ok: false, error: { code: "E-SCM-VALIDATION", message: err.message, traceId: req.requestId } });
    }
    if (err?.code === "UNIQUE_VIOLATION" || err?.code === "DUPLICATE_KEY") {
      return res.status(409).json({ ok: false, error: { code: "E-SCM-DUPLICATE", message: "کد تکراری است", traceId: req.requestId } });
    }
    console.error(`[${req.requestId}] scm error:`, err);
    return res.status(500).json({ ok: false, error: { code: "E-SCM-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    const subject = subjectOf(req);
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-SCM-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-SCM-AUTH-REQUIRED", message: "شناسهٔ کاربر الزامی است", permission, traceId: req.requestId } });
    }
    const verdict = evaluate(subject, permission, { projectId: undefined });
    if (!verdict.allow && enforce) {
      return res.status(403).json({ ok: false, error: { code: "E-SCM-FORBIDDEN", message: "مجوز این اقدام را ندارید", permission, traceId: req.requestId } });
    }
    return next();
  };
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
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
      console.error(`[${req.requestId}] scm audit failed ${action}`);
    }
  };
  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  const byCode = (pid, col, val) => [...byProject(pid), { column: col, op: "eq", value: val }];

  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      await handler(req, res, r, req.params.projectId);
    } catch (err) {
      fail(req, res, err);
    }
  };

  const base = "/api/scm/:projectId";

  /* ── Workspace aggregated ── */
  app.get(`${base}/workspace`, need("scm.package.view"), route(async (req, res, r, pid) => {
    const w = { where: byProject(pid), limit: 5000 };
    const [vendors, avls, packages, links, inquiries, bidders, invitations, mrChanges, mrrs, mrs, proposals, clarifications, evaluations, bidReports, koms, inspections, shipments, psrs, warehouses, catalog, mrcs, mrcLines, mivs, mivLines, mrvs, transfers, balances] = await Promise.all([
      r.list("ScmVendor", w),
      r.list("ScmAvlEntry", w),
      r.list("ScmProcPackage", w),
      r.list("ScmPackageMrLink", w),
      r.list("ScmInquiryPackage", w),
      r.list("ScmBidderList", w),
      r.list("ScmInvitation", w),
      r.list("ScmMrChangeLog", { where: byProject(pid), limit: 5000, orderBy: [{ column: "ChangedAt", dir: "desc" }] }),
      r.list("ScmMrr", w),
      r.list("MaterialRequest", w),
      r.list("ScmProposal", w).catch(()=>[]),
      r.list("ScmClarification", w).catch(()=>[]),
      r.list("ScmEvaluation", w).catch(()=>[]),
      r.list("ScmBidReport", w).catch(()=>[]),
      r.list("ScmKom", w).catch(()=>[]),
      r.list("ScmInspection", w).catch(()=>[]),
      r.list("ScmShipment", w).catch(()=>[]),
      r.list("ScmPsr", w).catch(()=>[]),
      r.list("ScmWarehouse", w).catch(()=>[]),
      r.list("ScmMaterialCatalog", w).catch(()=>[]),
      r.list("ScmMrc", w).catch(()=>[]),
      r.list("ScmMrcLine", w).catch(()=>[]),
      r.list("ScmMiv", w).catch(()=>[]),
      r.list("ScmMivLine", w).catch(()=>[]),
      r.list("ScmMrv", w).catch(()=>[]),
      r.list("ScmStockTransfer", w).catch(()=>[]),
      r.list("ScmStockBalance", w).catch(()=>[]),
    ]);
    ok(req, res, {
      projectId: pid,
      vendors: vendors.sort((a, b) => String(a.Code).localeCompare(String(b.Code))),
      avls,
      packages: packages.sort((a, b) => String(a.Code).localeCompare(String(b.Code))),
      links,
      inquiries,
      bidders,
      invitations,
      mrChanges: mrChanges.slice(0, 200),
      mrrs,
      mrs,
      proposals: proposals || [],
      clarifications: clarifications || [],
      evaluations: evaluations || [],
      bidReports: bidReports || [],
      koms: koms || [],
      inspections: inspections || [],
      shipments: shipments || [],
      psrs: psrs || [],
      warehouses: warehouses || [],
      catalog: catalog || [],
      mrcs: mrcs || [],
      mrcLines: mrcLines || [],
      mivs: mivs || [],
      mivLines: mivLines || [],
      mrvs: mrvs || [],
      transfers: transfers || [],
      balances: balances || [],
    });
  }));

  /* ── MRs (MaterialRequest) — SCM-1a انواع خرید فاکتوری/مستقیم از طریق Package.PurchaseType ── */
  app.post(`${base}/mrs`, need("scm.mr.manage"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const Code = code(b.Code, "Code");
    if (await r.findOne("MaterialRequest", byCode(pid, "Code", Code))) throw conflict("E-SCM-DUPLICATE", `MR ${Code} تکراری است`);
    const row = {
      ProjectId: pid,
      Code,
      TitleFa: text(b.TitleFa, "TitleFa", { max: 400, required: true }),
      Discipline: text(b.Discipline, "Discipline", { max: 40 }) ?? "piping",
      Quantity: b.Quantity !== undefined ? num(b.Quantity, "Quantity", { min: 0 }) : null,
      Unit: text(b.Unit, "Unit", { max: 20 }),
      NeedByDate: b.NeedByDate ? date(b.NeedByDate, "NeedByDate") : null,
      RaisedBy: actor(req),
      RaisedAt: b.RaisedAt ? date(b.RaisedAt, "RaisedAt") : new Date().toISOString().slice(0,10),
      Status: text(b.Status, "Status", { max: 30 }) ?? "draft",
      RemarksFa: text(b.RemarksFa, "RemarksFa", { max: 1000 }),
    };
    const created = await r.create("MaterialRequest", row, actor(req));
    await audit(r, req, "SCM_MR_CREATED", { entityName: "MaterialRequest", entityId: Code });
    ok(req, res, created, 201);
  }));

  /* ── Vendors ── */
  app.post(`${base}/vendors`, need("scm.vendor.manage"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const Code = code(b.Code, "Code");
    const NameFa = text(b.NameFa, "NameFa", { max: 300, required: true });
    const row = {
      ProjectId: pid,
      Code,
      NameFa,
      NameEn: text(b.NameEn, "NameEn", { max: 300 }),
      ContactPerson: text(b.ContactPerson, "ContactPerson", { max: 200 }),
      Email: text(b.Email, "Email", { max: 200 }),
      Phone: text(b.Phone, "Phone", { max: 60 }),
      Country: text(b.Country, "Country", { max: 60 }),
      City: text(b.City, "City", { max: 80 }),
      Disciplines: b.Disciplines ?? null,
      MaterialCategories: b.MaterialCategories ?? null,
      Status: text(b.Status, "Status", { max: 20 }) ?? "active",
      NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }),
    };
    if (await r.findOne("ScmVendor", byCode(pid, "Code", Code))) throw conflict("E-SCM-DUPLICATE", `فروشنده ${Code} تکراری است`);
    const created = await r.create("ScmVendor", row, actor(req), "ven");
    await audit(r, req, "SCM_VENDOR_CREATED", { entityName: "ScmVendor", entityId: Code });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/vendors/:code`, need("scm.vendor.manage"), route(async (req, res, r, pid) => {
    const ven = await r.findOne("ScmVendor", byCode(pid, "Code", req.params.code));
    if (!ven) throw notFound("فروشنده یافت نشد");
    const b = req.body ?? {};
    const patch = {};
    if (b.NameFa !== undefined) patch.NameFa = text(b.NameFa, "NameFa", { max: 300, required: true });
    if (b.NameEn !== undefined) patch.NameEn = text(b.NameEn, "NameEn", { max: 300 });
    if (b.ContactPerson !== undefined) patch.ContactPerson = text(b.ContactPerson, "ContactPerson", { max: 200 });
    if (b.Email !== undefined) patch.Email = text(b.Email, "Email", { max: 200 });
    if (b.Phone !== undefined) patch.Phone = text(b.Phone, "Phone", { max: 60 });
    if (b.Country !== undefined) patch.Country = text(b.Country, "Country", { max: 60 });
    if (b.City !== undefined) patch.City = text(b.City, "City", { max: 80 });
    if (b.Disciplines !== undefined) patch.Disciplines = b.Disciplines;
    if (b.MaterialCategories !== undefined) patch.MaterialCategories = b.MaterialCategories;
    if (b.Status !== undefined) patch.Status = enumCheck(b.Status, ["active", "inactive", "blacklisted"], "Status");
    if (b.NoteFa !== undefined) patch.NoteFa = text(b.NoteFa, "NoteFa", { max: 1000 });
    await r.patch("ScmVendor", ven.Id, patch, actor(req));
    await audit(r, req, "SCM_VENDOR_UPDATED", { entityName: "ScmVendor", entityId: ven.Code });
    ok(req, res, await r.get("ScmVendor", ven.Id));
  }));

  app.delete(`${base}/vendors/:code`, need("scm.vendor.manage"), route(async (req, res, r, pid) => {
    const ven = await r.findOne("ScmVendor", byCode(pid, "Code", req.params.code));
    if (!ven) throw notFound("فروشنده یافت نشد");
    const used = await r.list("ScmAvlEntry", { where: [...byProject(pid), { column: "VendorId", op: "eq", value: ven.Id }], limit: 1 });
    const used2 = await r.list("ScmBidderList", { where: [...byProject(pid), { column: "VendorId", op: "eq", value: ven.Id }], limit: 1 });
    if (used.length || used2.length) throw conflict("E-SCM-VENDOR-IN-USE", "فروشنده در AVL یا مناقصه استفاده شده و حذف نمی‌شود");
    await r.remove("ScmVendor", ven.Id);
    await audit(r, req, "SCM_VENDOR_DELETED", { entityName: "ScmVendor", entityId: ven.Code, severity: "warning" });
    ok(req, res, { deleted: ven.Code });
  }));

  /* ── AVL ── */
  app.post(`${base}/avl`, need("scm.vendor.manage"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const VendorCode = code(b.VendorCode ?? b.VendorId, "VendorCode");
    const vendor = await r.findOne("ScmVendor", byCode(pid, "Code", VendorCode));
    if (!vendor) throw bad("E-SCM-NO-VENDOR", `فروشنده ${VendorCode} وجود ندارد`);
    const Discipline = text(b.Discipline, "Discipline", { max: 40, required: true });
    const MaterialCategory = text(b.MaterialCategory, "MaterialCategory", { max: 60 });
    const row = {
      ProjectId: pid,
      VendorId: vendor.Id,
      Discipline,
      MaterialCategory,
      ApprovedBy: actor(req),
      ApprovedAt: new Date().toISOString(),
      ExpiryAt: date(b.ExpiryAt, "ExpiryAt"),
      Status: text(b.Status, "Status", { max: 20 }) ?? "approved",
      NoteFa: text(b.NoteFa, "NoteFa", { max: 500 }),
    };
    // check unique
    const exists = await r.list("ScmAvlEntry", { where: [...byProject(pid), { column: "VendorId", op: "eq", value: vendor.Id }, { column: "Discipline", op: "eq", value: Discipline }], limit: 5000 });
    const sameCat = exists.find((x) => (x.MaterialCategory ?? null) === (MaterialCategory ?? null));
    if (sameCat) throw conflict("E-SCM-DUPLICATE", "این فروشنده برای این دیسیپلین/دسته قبلاً تأیید شده");
    const created = await r.create("ScmAvlEntry", row, actor(req), "avl");
    await audit(r, req, "SCM_AVL_CREATED", { entityName: "ScmAvlEntry", entityId: created.Id, vendor: VendorCode, discipline: Discipline });
    ok(req, res, created, 201);
  }));

  app.delete(`${base}/avl/:id`, need("scm.vendor.manage"), route(async (req, res, r, pid) => {
    const row = await r.get("ScmAvlEntry", req.params.id);
    if (!row || row.ProjectId !== pid) throw notFound("رکورد AVL یافت نشد");
    await r.remove("ScmAvlEntry", row.Id);
    await audit(r, req, "SCM_AVL_DELETED", { entityName: "ScmAvlEntry", entityId: row.Id, severity: "warning" });
    ok(req, res, { deleted: row.Id });
  }));

  /* ── ProcPackage ── */
  app.post(`${base}/packages`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const Code = code(b.Code, "Code");
    if (await r.findOne("ScmProcPackage", byCode(pid, "Code", Code))) throw conflict("E-SCM-DUPLICATE", `بسته خرید ${Code} تکراری است`);
    const row = {
      ProjectId: pid,
      Code,
      TitleFa: text(b.TitleFa, "TitleFa", { max: 400, required: true }),
      Discipline: text(b.Discipline, "Discipline", { max: 40 }),
      WbsId: text(b.WbsId, "WbsId", { max: 60 }),
      Status: text(b.Status, "Status", { max: 30 }) ?? "draft",
      PlannedIssueDate: date(b.PlannedIssueDate, "PlannedIssueDate"),
      TotalEstimatedAmount: num(b.TotalEstimatedAmount, "TotalEstimatedAmount", { min: 0 }),
      Currency: text(b.Currency, "Currency", { max: 10 }) ?? "IRR",
      NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }),
    };
    const created = await r.create("ScmProcPackage", row, actor(req), "pkg");
    await audit(r, req, "SCM_PACKAGE_CREATED", { entityName: "ScmProcPackage", entityId: Code });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/packages/:code`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const pkg = await r.findOne("ScmProcPackage", byCode(pid, "Code", req.params.code));
    if (!pkg) throw notFound("بسته خرید یافت نشد");
    const b = req.body ?? {};
    const patch = {};
    if (b.TitleFa !== undefined) patch.TitleFa = text(b.TitleFa, "TitleFa", { max: 400, required: true });
    if (b.Discipline !== undefined) patch.Discipline = text(b.Discipline, "Discipline", { max: 40 });
    if (b.WbsId !== undefined) patch.WbsId = text(b.WbsId, "WbsId", { max: 60 });
    if (b.Status !== undefined) patch.Status = enumCheck(b.Status, ["draft", "planned", "inquiry", "evaluation", "ordered", "closed", "cancelled"], "Status");
    if (b.PlannedIssueDate !== undefined) patch.PlannedIssueDate = date(b.PlannedIssueDate, "PlannedIssueDate");
    if (b.TotalEstimatedAmount !== undefined) patch.TotalEstimatedAmount = num(b.TotalEstimatedAmount, "TotalEstimatedAmount", { min: 0 });
    if (b.Currency !== undefined) patch.Currency = text(b.Currency, "Currency", { max: 10 });
    if (b.NoteFa !== undefined) patch.NoteFa = text(b.NoteFa, "NoteFa", { max: 1000 });
    await r.patch("ScmProcPackage", pkg.Id, patch, actor(req));
    await audit(r, req, "SCM_PACKAGE_UPDATED", { entityName: "ScmProcPackage", entityId: pkg.Code });
    ok(req, res, await r.get("ScmProcPackage", pkg.Id));
  }));

  app.delete(`${base}/packages/:code`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const pkg = await r.findOne("ScmProcPackage", byCode(pid, "Code", req.params.code));
    if (!pkg) throw notFound("بسته خرید یافت نشد");
    const links = await r.list("ScmPackageMrLink", { where: [...byProject(pid), { column: "PackageId", op: "eq", value: pkg.Id }], limit: 1 });
    const inqs = await r.list("ScmInquiryPackage", { where: [...byProject(pid), { column: "PackageId", op: "eq", value: pkg.Id }], limit: 1 });
    if (links.length || inqs.length) throw conflict("E-SCM-PACKAGE-IN-USE", "بسته دارای MR یا استعلام است و حذف نمی‌شود");
    await r.remove("ScmProcPackage", pkg.Id);
    await audit(r, req, "SCM_PACKAGE_DELETED", { entityName: "ScmProcPackage", entityId: pkg.Code, severity: "warning" });
    ok(req, res, { deleted: pkg.Code });
  }));

  /* ── Package-MR Link ── */
  app.post(`${base}/packages/:code/mrs`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const pkg = await r.findOne("ScmProcPackage", byCode(pid, "Code", req.params.code));
    if (!pkg) throw notFound("بسته خرید یافت نشد");
    const b = req.body ?? {};
    const MrCode = code(b.MrCode, "MrCode");
    const mr = await r.findOne("MaterialRequest", byCode(pid, "Code", MrCode));
    if (!mr) throw bad("E-SCM-NO-MR", `MR ${MrCode} وجود ندارد`);
    const existing = await r.findOne("ScmPackageMrLink", [{ column: "PackageId", op: "eq", value: pkg.Id }, { column: "MrCode", op: "eq", value: MrCode }]);
    if (existing) throw conflict("E-SCM-DUPLICATE", `MR ${MrCode} قبلاً به این بسته افزوده شده`);
    const row = {
      ProjectId: pid,
      PackageId: pkg.Id,
      MrCode,
      AddedBy: actor(req),
      AddedAt: new Date().toISOString(),
      NoteFa: text(b.NoteFa, "NoteFa", { max: 300 }),
    };
    const created = await r.create("ScmPackageMrLink", row, actor(req), "pml");
    await audit(r, req, "SCM_PACKAGE_MR_LINKED", { entityName: "ScmPackageMrLink", entityId: created.Id, package: pkg.Code, mr: MrCode });
    ok(req, res, created, 201);
  }));

  app.delete(`${base}/packages/:code/mrs/:mrCode`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const pkg = await r.findOne("ScmProcPackage", byCode(pid, "Code", req.params.code));
    if (!pkg) throw notFound("بسته خرید یافت نشد");
    const link = await r.findOne("ScmPackageMrLink", [{ column: "PackageId", op: "eq", value: pkg.Id }, { column: "MrCode", op: "eq", value: req.params.mrCode }]);
    if (!link) throw notFound("پیوند یافت نشد");
    await r.remove("ScmPackageMrLink", link.Id);
    await audit(r, req, "SCM_PACKAGE_MR_UNLINKED", { entityName: "ScmPackageMrLink", entityId: link.Id, severity: "warning" });
    ok(req, res, { deleted: link.Id });
  }));

  /* ── InquiryPackage ── */
  app.post(`${base}/inquiries`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const PackageCode = code(b.PackageCode ?? b.PackageId, "PackageCode");
    const pkg = await r.findOne("ScmProcPackage", byCode(pid, "Code", PackageCode));
    if (!pkg) throw bad("E-SCM-NO-PACKAGE", `بسته خرید ${PackageCode} وجود ندارد`);
    const Code = code(b.Code, "Code");
    if (await r.findOne("ScmInquiryPackage", byCode(pid, "Code", Code))) throw conflict("E-SCM-DUPLICATE", `بسته استعلام ${Code} تکراری است`);
    const row = {
      ProjectId: pid,
      PackageId: pkg.Id,
      Code,
      TitleFa: text(b.TitleFa, "TitleFa", { max: 400, required: true }),
      InquiryType: text(b.InquiryType, "InquiryType", { max: 20 }) ?? "rfq",
      IssueDate: date(b.IssueDate, "IssueDate"),
      DueDate: date(b.DueDate, "DueDate"),
      Status: text(b.Status, "Status", { max: 30 }) ?? "draft",
      NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }),
    };
    const created = await r.create("ScmInquiryPackage", row, actor(req), "inq");
    await audit(r, req, "SCM_INQUIRY_CREATED", { entityName: "ScmInquiryPackage", entityId: Code, package: PackageCode });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/inquiries/:code`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const inq = await r.findOne("ScmInquiryPackage", byCode(pid, "Code", req.params.code));
    if (!inq) throw notFound("بسته استعلام یافت نشد");
    const b = req.body ?? {};
    const patch = {};
    if (b.TitleFa !== undefined) patch.TitleFa = text(b.TitleFa, "TitleFa", { max: 400, required: true });
    if (b.IssueDate !== undefined) patch.IssueDate = date(b.IssueDate, "IssueDate");
    if (b.DueDate !== undefined) patch.DueDate = date(b.DueDate, "DueDate");
    if (b.Status !== undefined) patch.Status = enumCheck(b.Status, ["draft", "issued", "closed", "cancelled"], "Status");
    if (b.NoteFa !== undefined) patch.NoteFa = text(b.NoteFa, "NoteFa", { max: 1000 });
    await r.patch("ScmInquiryPackage", inq.Id, patch, actor(req));
    await audit(r, req, "SCM_INQUIRY_UPDATED", { entityName: "ScmInquiryPackage", entityId: inq.Code });
    ok(req, res, await r.get("ScmInquiryPackage", inq.Id));
  }));

  /* ── Bidder List LBL/SBL ── */
  app.post(`${base}/inquiries/:code/bidders`, need("scm.bidder.manage"), route(async (req, res, r, pid) => {
    const inq = await r.findOne("ScmInquiryPackage", byCode(pid, "Code", req.params.code));
    if (!inq) throw notFound("بسته استعلام یافت نشد");
    const b = req.body ?? {};
    const VendorCode = code(b.VendorCode, "VendorCode");
    const vendor = await r.findOne("ScmVendor", byCode(pid, "Code", VendorCode));
    if (!vendor) throw bad("E-SCM-NO-VENDOR", `فروشنده ${VendorCode} وجود ندارد`);
    const ListType = enumCheck(b.ListType ?? "sbl", ["lbl", "sbl"], "ListType");
    // SBL requires AVL
    if (ListType === "sbl") {
      const pkg = await r.get("ScmProcPackage", inq.PackageId);
      const discipline = pkg?.Discipline ?? null;
      const avlWhere = [...byProject(pid), { column: "VendorId", op: "eq", value: vendor.Id }, { column: "Status", op: "eq", value: "approved" }];
      const avls = await r.list("ScmAvlEntry", { where: avlWhere, limit: 100 });
      const okAvl = discipline ? avls.some((a) => a.Discipline === discipline) : avls.length > 0;
      if (!okAvl) throw new ScmError(400, "E-SCM-NOT-AVL", `فروشنده ${VendorCode} در AVL برای دیسیپلین ${discipline ?? "نامشخص"} تأیید نشده — افزودن به SBL مجاز نیست`);
    }
    const existing = await r.findOne("ScmBidderList", [{ column: "InquiryPackageId", op: "eq", value: inq.Id }, { column: "VendorId", op: "eq", value: vendor.Id }]);
    if (existing) throw conflict("E-SCM-DUPLICATE", `فروشنده ${VendorCode} قبلاً در این استعلام هست`);
    const row = {
      ProjectId: pid,
      InquiryPackageId: inq.Id,
      VendorId: vendor.Id,
      ListType,
      Status: "invited",
      InvitedAt: new Date().toISOString(),
      NoteFa: text(b.NoteFa, "NoteFa", { max: 300 }),
    };
    const created = await r.create("ScmBidderList", row, actor(req), "bdr");
    await audit(r, req, "SCM_BIDDER_ADDED", { entityName: "ScmBidderList", entityId: created.Id, inquiry: inq.Code, vendor: VendorCode, listType: ListType });
    ok(req, res, created, 201);
  }));

  app.post(`${base}/inquiries/:code/bidders/:vendorCode/ack`, need("scm.bidder.manage"), route(async (req, res, r, pid) => {
    const inq = await r.findOne("ScmInquiryPackage", byCode(pid, "Code", req.params.code));
    if (!inq) throw notFound("بسته استعلام یافت نشد");
    const vendor = await r.findOne("ScmVendor", byCode(pid, "Code", req.params.vendorCode));
    if (!vendor) throw notFound("فروشنده یافت نشد");
    const bidder = await r.findOne("ScmBidderList", [{ column: "InquiryPackageId", op: "eq", value: inq.Id }, { column: "VendorId", op: "eq", value: vendor.Id }]);
    if (!bidder) throw notFound("فروشنده در این استعلام نیست");
    const b = req.body ?? {};
    const ackStatus = enumCheck(b.AckStatus ?? b.Status ?? "acknowledged", ["acknowledged", "declined"], "AckStatus");
    const patch = {
      Status: ackStatus,
      AcknowledgedAt: new Date().toISOString(),
      DeclineReasonFa: ackStatus === "declined" ? text(b.DeclineReasonFa ?? b.ReasonFa, "DeclineReasonFa", { max: 500 }) : null,
    };
    await r.patch("ScmBidderList", bidder.Id, patch, actor(req));
    await audit(r, req, "SCM_BIDDER_ACK", { entityName: "ScmBidderList", entityId: bidder.Id, ack: ackStatus });
    ok(req, res, await r.get("ScmBidderList", bidder.Id));
  }));

  app.delete(`${base}/inquiries/:code/bidders/:vendorCode`, need("scm.bidder.manage"), route(async (req, res, r, pid) => {
    const inq = await r.findOne("ScmInquiryPackage", byCode(pid, "Code", req.params.code));
    if (!inq) throw notFound("بسته استعلام یافت نشد");
    const vendor = await r.findOne("ScmVendor", byCode(pid, "Code", req.params.vendorCode));
    if (!vendor) throw notFound("فروشنده یافت نشد");
    const bidder = await r.findOne("ScmBidderList", [{ column: "InquiryPackageId", op: "eq", value: inq.Id }, { column: "VendorId", op: "eq", value: vendor.Id }]);
    if (!bidder) throw notFound("رکورد یافت نشد");
    await r.remove("ScmBidderList", bidder.Id);
    await audit(r, req, "SCM_BIDDER_REMOVED", { entityName: "ScmBidderList", entityId: bidder.Id, severity: "warning" });
    ok(req, res, { deleted: bidder.Id });
  }));

  /* ── Invitation ── */
  app.post(`${base}/invitations`, need("scm.bidder.manage"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const InquiryCode = code(b.InquiryCode ?? b.InquiryPackageCode, "InquiryCode");
    const inq = await r.findOne("ScmInquiryPackage", byCode(pid, "Code", InquiryCode));
    if (!inq) throw bad("E-SCM-NO-INQUIRY", `بسته استعلام ${InquiryCode} وجود ندارد`);
    const VendorCode = code(b.VendorCode, "VendorCode");
    const vendor = await r.findOne("ScmVendor", byCode(pid, "Code", VendorCode));
    if (!vendor) throw bad("E-SCM-NO-VENDOR", `فروشنده ${VendorCode} وجود ندارد`);
    const bidder = await r.findOne("ScmBidderList", [{ column: "InquiryPackageId", op: "eq", value: inq.Id }, { column: "VendorId", op: "eq", value: vendor.Id }]);
    if (!bidder) throw bad("E-SCM-NO-BIDDER", `فروشنده ${VendorCode} در فهرست مناقصه‌گران این استعلام نیست`);
    const InvitationNo = code(b.InvitationNo, "InvitationNo");
    if (await r.findOne("ScmInvitation", byCode(pid, "InvitationNo", InvitationNo))) throw conflict("E-SCM-DUPLICATE", `دعوت‌نامه ${InvitationNo} تکراری است`);
    const row = {
      ProjectId: pid,
      InquiryPackageId: inq.Id,
      VendorId: vendor.Id,
      InvitationNo,
      SentAt: new Date().toISOString(),
      SentBy: actor(req),
      ValidUntil: date(b.ValidUntil, "ValidUntil"),
      NoteFa: text(b.NoteFa, "NoteFa", { max: 500 }),
    };
    const created = await r.create("ScmInvitation", row, actor(req), "inv");
    await audit(r, req, "SCM_INVITATION_SENT", { entityName: "ScmInvitation", entityId: InvitationNo, inquiry: InquiryCode, vendor: VendorCode });
    ok(req, res, created, 201);
  }));

  app.post(`${base}/invitations/:invNo/ack`, need("scm.bidder.manage"), route(async (req, res, r, pid) => {
    const inv = await r.findOne("ScmInvitation", byCode(pid, "InvitationNo", req.params.invNo));
    if (!inv) throw notFound("دعوت‌نامه یافت نشد");
    const b = req.body ?? {};
    const AckStatus = enumCheck(b.AckStatus, ["accepted", "declined", "acknowledged"], "AckStatus");
    const patch = {
      AckAt: new Date().toISOString(),
      AckStatus,
    };
    await r.patch("ScmInvitation", inv.Id, patch, actor(req));
    await audit(r, req, "SCM_INVITATION_ACK", { entityName: "ScmInvitation", entityId: inv.InvitationNo, ack: AckStatus });
    ok(req, res, await r.get("ScmInvitation", inv.Id));
  }));

  /* ── MR Change Log (auto notification) ── */
  app.get(`${base}/mr-changes`, need("scm.mr.view"), route(async (req, res, r, pid) => {
    const rows = await r.list("ScmMrChangeLog", { where: byProject(pid), limit: 500, orderBy: [{ column: "ChangedAt", dir: "desc" }] });
    ok(req, res, rows);
  }));

  app.post(`${base}/mr-changes`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const MrCode = code(b.MrCode, "MrCode");
    const mr = await r.findOne("MaterialRequest", byCode(pid, "Code", MrCode));
    if (!mr) throw bad("E-SCM-NO-MR", `MR ${MrCode} وجود ندارد`);
    const ChangeType = enumCheck(b.ChangeType, ["quantity", "spec", "date", "cancel", "other"], "ChangeType");
    const row = {
      ProjectId: pid,
      MrCode,
      ChangeType,
      OldValue: text(b.OldValue, "OldValue", { max: 2000 }),
      NewValue: text(b.NewValue, "NewValue", { max: 2000 }),
      ChangedBy: actor(req),
      ChangedAt: new Date().toISOString(),
      NotifyStatus: "pending",
    };
    const created = await r.create("ScmMrChangeLog", row, actor(req), "mrc");
    await audit(r, req, "SCM_MR_CHANGED", { entityName: "ScmMrChangeLog", entityId: created.Id, mr: MrCode, changeType: ChangeType });
    ok(req, res, created, 201);
  }));

  app.post(`${base}/mr-changes/:id/notify`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const row = await r.get("ScmMrChangeLog", req.params.id);
    if (!row || row.ProjectId !== pid) throw notFound("لاگ تغییر یافت نشد");
    if (row.NotifyStatus === "notified") throw conflict("E-SCM-ALREADY-NOTIFIED", "قبلاً اعلان شده");
    await r.patch("ScmMrChangeLog", row.Id, { NotifiedAt: new Date().toISOString(), NotifyStatus: "notified" }, actor(req));
    await audit(r, req, "SCM_MR_CHANGE_NOTIFIED", { entityName: "ScmMrChangeLog", entityId: row.Id });
    ok(req, res, await r.get("ScmMrChangeLog", row.Id));
  }));

  /* ── MRR / OPI ── */
  app.get(`${base}/mrrs`, need("scm.mrr.view"), route(async (req, res, r, pid) => {
    const rows = await r.list("ScmMrr", { where: byProject(pid), limit: 500 });
    ok(req, res, rows);
  }));

  app.post(`${base}/mrrs`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const Code = code(b.Code, "Code");
    if (await r.findOne("ScmMrr", byCode(pid, "Code", Code))) throw conflict("E-SCM-DUPLICATE", `رسید ${Code} تکراری است`);
    const PoNo = code(b.PoNo, "PoNo");
    const po = await r.findOne("PurchaseOrder", byCode(pid, "PoNo", PoNo));
    if (!po) throw bad("E-SCM-NO-PO", `سفارش خرید ${PoNo} وجود ندارد`);
    const row = {
      ProjectId: pid,
      Code,
      PoNo,
      ReceivedAt: date(b.ReceivedAt, "ReceivedAt", { required: true }),
      ReceivedBy: actor(req),
      Quantity: num(b.Quantity, "Quantity", { min: 0 }),
      AcceptedQty: num(b.AcceptedQty, "AcceptedQty", { min: 0 }),
      RejectedQty: num(b.RejectedQty, "RejectedQty", { min: 0 }),
      OverQty: num(b.OverQty, "OverQty", { min: 0 }),
      ShortageQty: num(b.ShortageQty, "ShortageQty", { min: 0 }),
      DamageQty: num(b.DamageQty, "DamageQty", { min: 0 }),
      OpiType: b.OpiType ? enumCheck(b.OpiType, ["over", "short", "damage", "none"], "OpiType") : null,
      Status: text(b.Status, "Status", { max: 20 }) ?? "draft",
      Warehouse: text(b.Warehouse, "Warehouse", { max: 60 }),
      NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }),
    };
    // auto-detect OPI if not given
    if (!row.OpiType) {
      if ((row.OverQty ?? 0) > 0) row.OpiType = "over";
      else if ((row.ShortageQty ?? 0) > 0) row.OpiType = "short";
      else if ((row.DamageQty ?? 0) > 0) row.OpiType = "damage";
      else row.OpiType = "none";
    }
    const created = await r.create("ScmMrr", row, actor(req), "mrr");
    await audit(r, req, "SCM_MRR_CREATED", { entityName: "ScmMrr", entityId: Code, po: PoNo, opi: row.OpiType });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/mrrs/:code`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const mrr = await r.findOne("ScmMrr", byCode(pid, "Code", req.params.code));
    if (!mrr) throw notFound("رسید یافت نشد");
    const b = req.body ?? {};
    const patch = {};
    if (b.AcceptedQty !== undefined) patch.AcceptedQty = num(b.AcceptedQty, "AcceptedQty", { min: 0 });
    if (b.RejectedQty !== undefined) patch.RejectedQty = num(b.RejectedQty, "RejectedQty", { min: 0 });
    if (b.OverQty !== undefined) patch.OverQty = num(b.OverQty, "OverQty", { min: 0 });
    if (b.ShortageQty !== undefined) patch.ShortageQty = num(b.ShortageQty, "ShortageQty", { min: 0 });
    if (b.DamageQty !== undefined) patch.DamageQty = num(b.DamageQty, "DamageQty", { min: 0 });
    if (b.Status !== undefined) patch.Status = enumCheck(b.Status, ["draft", "accepted", "rejected", "closed"], "Status");
    if (b.Warehouse !== undefined) patch.Warehouse = text(b.Warehouse, "Warehouse", { max: 60 });
    if (b.NoteFa !== undefined) patch.NoteFa = text(b.NoteFa, "NoteFa", { max: 1000 });
    await r.patch("ScmMrr", mrr.Id, patch, actor(req));
    await audit(r, req, "SCM_MRR_UPDATED", { entityName: "ScmMrr", entityId: mrr.Code });
    ok(req, res, await r.get("ScmMrr", mrr.Id));
  }));

  // ═══════════ 1e: پیشنهاد فنی/بازرگانی و شفاف‌سازی ═══════════
  app.get(`${base}/proposals`, need("scm.bidder.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmProposal", { where: [{ column: "ProjectId", op: "eq", value: pid }], orderBy: [{ column: "CreatedAt", desc: true }] }));
  }));
  app.post(`${base}/proposals`, need("scm.bidder.manage"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const ProposalNo = code(b.ProposalNo, "ProposalNo");
    if (await r.findOne("ScmProposal", byCode(pid, "ProposalNo", ProposalNo))) throw conflict("E-SCM-DUPLICATE", `پیشنهاد ${ProposalNo} تکراری`);
    const InquiryCode = code(b.InquiryCode, "InquiryCode");
    const inq = await r.findOne("ScmInquiryPackage", byCode(pid, "Code", InquiryCode));
    if (!inq) throw bad("E-SCM-NO-INQ", `استعلام ${InquiryCode} وجود ندارد`);
    const VendorCode = code(b.VendorCode, "VendorCode");
    const vendor = await r.findOne("ScmVendor", byCode(pid, "Code", VendorCode));
    if (!vendor) throw bad("E-SCM-NO-VENDOR", `فروشنده ${VendorCode} وجود ندارد`);
    const bidder = await r.findOne("ScmBidderList", [{ column: "InquiryPackageId", op: "eq", value: inq.Id }, { column: "VendorId", op: "eq", value: vendor.Id }]);
    if (!bidder) throw bad("E-SCM-NO-BIDDER", `فروشنده در فهرست مناقصه نیست`);
    const row = {
      ProjectId: pid,
      ProposalNo,
      InquiryPackageId: inq.Id,
      InquiryCode,
      VendorId: vendor.Id,
      VendorCode,
      Type: enumCheck(b.Type, ["technical","commercial","both"], "Type"),
      Status: text(b.Status, "Status", { max: 30 }) ?? "submitted",
      SubmittedAt: date(b.SubmittedAt, "SubmittedAt", { required: false }) ?? new Date().toISOString().slice(0,10),
      Amount: b.Amount !== undefined ? num(b.Amount, "Amount", { min: 0 }) : null,
      Currency: text(b.Currency, "Currency", { max: 10 }),
      ValidUntil: b.ValidUntil ? date(b.ValidUntil, "ValidUntil") : null,
      NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }),
    };
    const created = await r.create("ScmProposal", row, actor(req), "prop");
    await audit(r, req, "SCM_PROPOSAL_CREATED", { entityName: "ScmProposal", entityId: ProposalNo });
    ok(req, res, created, 201);
  }));
  app.post(`${base}/proposals/:proposalNo/clarifications`, need("scm.bidder.manage"), route(async (req, res, r, pid) => {
    const prop = await r.findOne("ScmProposal", byCode(pid, "ProposalNo", req.params.proposalNo));
    if (!prop) throw notFound("پیشنهاد یافت نشد");
    const b = req.body ?? {};
    const QuestionFa = text(b.QuestionFa, "QuestionFa", { required: true, max: 1000 });
    const AnswerFa = text(b.AnswerFa, "AnswerFa", { max: 1000 });
    const row = {
      ProjectId: pid,
      ProposalId: prop.Id,
      ProposalNo: prop.ProposalNo,
      QuestionFa,
      AnswerFa,
      AskedBy: actor(req),
      AskedAt: new Date().toISOString(),
      AnsweredAt: AnswerFa ? new Date().toISOString() : null,
      Status: AnswerFa ? "answered" : "open",
    };
    const created = await r.create("ScmClarification", row, actor(req), "clar");
    ok(req, res, created, 201);
  }));

  // ═══════════ 1f: ارزیابی TBE/TBA/CBE و Bid Report ═══════════
  app.get(`${base}/evaluations`, need("scm.bidder.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmEvaluation", { where: [{ column: "ProjectId", op: "eq", value: pid }], orderBy: [{ column: "CreatedAt", desc: true }] }));
  }));
  app.post(`${base}/evaluations`, need("scm.bidder.manage"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const EvalNo = code(b.EvalNo, "EvalNo");
    if (await r.findOne("ScmEvaluation", byCode(pid, "EvalNo", EvalNo))) throw conflict("E-SCM-DUPLICATE", `ارزیابی ${EvalNo} تکراری`);
    const ProposalNo = code(b.ProposalNo, "ProposalNo");
    const prop = await r.findOne("ScmProposal", byCode(pid, "ProposalNo", ProposalNo));
    if (!prop) throw bad("E-SCM-NO-PROP", `پیشنهاد ${ProposalNo} وجود ندارد`);
    const row = {
      ProjectId: pid,
      EvalNo,
      ProposalId: prop.Id,
      ProposalNo,
      Type: enumCheck(b.Type, ["tbe","tba","cbe"], "Type"),
      Score: b.Score !== undefined ? num(b.Score, "Score", { min: 0, max: 100 }) : null,
      Result: enumCheck(b.Result, ["pass","fail","conditional"], "Result"),
      EvaluatedBy: actor(req),
      EvaluatedAt: new Date().toISOString(),
      NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }),
    };
    const created = await r.create("ScmEvaluation", row, actor(req), "eval");
    await audit(r, req, "SCM_EVAL_CREATED", { entityName: "ScmEvaluation", entityId: EvalNo });
    ok(req, res, created, 201);
  }));
  app.get(`${base}/bid-reports`, need("scm.bidder.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmBidReport", { where: [{ column: "ProjectId", op: "eq", value: pid }], orderBy: [{ column: "CreatedAt", desc: true }] }));
  }));
  app.post(`${base}/bid-reports`, need("scm.bidder.manage"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const ReportNo = code(b.ReportNo, "ReportNo");
    if (await r.findOne("ScmBidReport", byCode(pid, "ReportNo", ReportNo))) throw conflict("E-SCM-DUPLICATE", `گزارش ${ReportNo} تکراری`);
    const InquiryCode = code(b.InquiryCode, "InquiryCode");
    const inq = await r.findOne("ScmInquiryPackage", byCode(pid, "Code", InquiryCode));
    if (!inq) throw bad("E-SCM-NO-INQ", `استعلام ${InquiryCode} وجود ندارد`);
    const row = {
      ProjectId: pid,
      ReportNo,
      InquiryPackageId: inq.Id,
      InquiryCode,
      WinnerVendorCode: b.WinnerVendorCode ? code(b.WinnerVendorCode, "WinnerVendorCode", { required: false }) : null,
      TotalAmount: b.TotalAmount !== undefined ? num(b.TotalAmount, "TotalAmount", { min: 0 }) : null,
      Currency: text(b.Currency, "Currency", { max: 10 }),
      RecommendationFa: text(b.RecommendationFa, "RecommendationFa", { max: 2000 }),
      Status: text(b.Status, "Status", { max: 20 }) ?? "draft",
      CreatedBy: actor(req),
    };
    const created = await r.create("ScmBidReport", row, actor(req), "bidr");
    ok(req, res, created, 201);
  }));

  // ═══════════ 1h: KOM/PIM و Expediting ═══════════
  app.get(`${base}/koms`, need("scm.package.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmKom", { where: [{ column: "ProjectId", op: "eq", value: pid }], orderBy: [{ column: "CreatedAt", desc: true }] }));
  }));
  app.post(`${base}/koms`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const KomNo = code(b.KomNo, "KomNo");
    if (await r.findOne("ScmKom", byCode(pid, "KomNo", KomNo))) throw conflict("E-SCM-DUPLICATE", `KOM ${KomNo} تکراری`);
    const PoNo = b.PoNo ? code(b.PoNo, "PoNo", { required: false }) : null;
    if (PoNo) {
      const po = await r.findOne("PurchaseOrder", byCode(pid, "PoNo", PoNo));
      if (!po) throw bad("E-SCM-NO-PO", `PO ${PoNo} وجود ندارد`);
    }
    const row = {
      ProjectId: pid,
      KomNo,
      PoNo,
      Type: enumCheck(b.Type, ["kom","pim","expediting"], "Type"),
      MeetingDate: date(b.MeetingDate, "MeetingDate", { required: true }),
      LocationFa: text(b.LocationFa, "LocationFa", { max: 200 }),
      Status: text(b.Status, "Status", { max: 20 }) ?? "scheduled",
      NoteFa: text(b.NoteFa, "NoteFa", { max: 2000 }),
    };
    const created = await r.create("ScmKom", row, actor(req), "kom");
    ok(req, res, created, 201);
  }));

  // ═══════════ 1i: بازرسی و Release Note ═══════════
  app.get(`${base}/inspections`, need("scm.mrr.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmInspection", { where: [{ column: "ProjectId", op: "eq", value: pid }], orderBy: [{ column: "CreatedAt", desc: true }] }));
  }));
  app.post(`${base}/inspections`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const InspectionNo = code(b.InspectionNo, "InspectionNo");
    if (await r.findOne("ScmInspection", byCode(pid, "InspectionNo", InspectionNo))) throw conflict("E-SCM-DUPLICATE", `بازرسی ${InspectionNo} تکراری`);
    const PoNo = b.PoNo ? code(b.PoNo, "PoNo", { required: false }) : null;
    const row = {
      ProjectId: pid,
      InspectionNo,
      PoNo,
      Type: enumCheck(b.Type, ["factory","site","third_party"], "Type"),
      Inspector: text(b.Inspector, "Inspector", { max: 100 }),
      InspectionDate: date(b.InspectionDate, "InspectionDate", { required: true }),
      Result: enumCheck(b.Result, ["pass","fail","conditional"], "Result"),
      ReleaseNoteNo: b.ReleaseNoteNo ? code(b.ReleaseNoteNo, "ReleaseNoteNo", { required: false }) : null,
      NoteFa: text(b.NoteFa, "NoteFa", { max: 2000 }),
    };
    const created = await r.create("ScmInspection", row, actor(req), "insp");
    ok(req, res, created, 201);
  }));

  // ═══════════ 1j: حمل و ترخیص ═══════════
  app.get(`${base}/shipments`, need("scm.mrr.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmShipment", { where: [{ column: "ProjectId", op: "eq", value: pid }], orderBy: [{ column: "CreatedAt", desc: true }] }));
  }));
  app.post(`${base}/shipments`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const ShipmentNo = code(b.ShipmentNo, "ShipmentNo");
    if (await r.findOne("ScmShipment", byCode(pid, "ShipmentNo", ShipmentNo))) throw conflict("E-SCM-DUPLICATE", `حمل ${ShipmentNo} تکراری`);
    const PoNo = b.PoNo ? code(b.PoNo, "PoNo", { required: false }) : null;
    const row = {
      ProjectId: pid,
      ShipmentNo,
      PoNo,
      Mode: enumCheck(b.Mode, ["road","sea","air","rail"], "Mode"),
      OriginFa: text(b.OriginFa, "OriginFa", { max: 200 }),
      DestinationFa: text(b.DestinationFa, "DestinationFa", { max: 200 }),
      EtaDate: b.EtaDate ? date(b.EtaDate, "EtaDate") : null,
      AtaDate: b.AtaDate ? date(b.AtaDate, "AtaDate") : null,
      CustomsStatus: text(b.CustomsStatus, "CustomsStatus", { max: 30 }) ?? "pending",
      NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }),
    };
    const created = await r.create("ScmShipment", row, actor(req), "ship");
    ok(req, res, created, 201);
  }));

  // ═══════════ 1k: پیشرفت خرید و PSR ═══════════
  app.get(`${base}/psrs`, need("scm.package.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmPsr", { where: [{ column: "ProjectId", op: "eq", value: pid }], orderBy: [{ column: "CreatedAt", desc: true }] }));
  }));
  app.post(`${base}/psrs`, need("scm.package.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const PsrNo = code(b.PsrNo, "PsrNo");
    if (await r.findOne("ScmPsr", byCode(pid, "PsrNo", PsrNo))) throw conflict("E-SCM-DUPLICATE", `PSR ${PsrNo} تکراری`);
    const PoNo = b.PoNo ? code(b.PoNo, "PoNo", { required: false }) : null;
    const row = {
      ProjectId: pid,
      PsrNo,
      PoNo,
      PackageCode: b.PackageCode ? code(b.PackageCode, "PackageCode", { required: false }) : null,
      ProgressPct: num(b.ProgressPct, "ProgressPct", { min: 0, max: 100 }),
      ReportDate: date(b.ReportDate, "ReportDate", { required: true }),
      StatusFa: text(b.StatusFa, "StatusFa", { max: 1000 }),
      NextActionFa: text(b.NextActionFa, "NextActionFa", { max: 1000 }),
      ReportedBy: actor(req),
    };
    const created = await r.create("ScmPsr", row, actor(req), "psr");
    ok(req, res, created, 201);
  }));

  // ═══════════ P6: انبار WHS-1..7 ═══════════
  app.get(`${base}/warehouses`, need("scm.mrr.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmWarehouse", { where: byProject(pid), orderBy: [{ column: "Code", desc: false }] }));
  }));
  app.post(`${base}/warehouses`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const Code = code(b.Code, "Code");
    if (await r.findOne("ScmWarehouse", byCode(pid, "Code", Code))) throw conflict("E-SCM-DUPLICATE", `انبار ${Code} تکراری`);
    const row = { ProjectId: pid, Code, NameFa: text(b.NameFa, "NameFa", { max: 200, required: true }), LocationFa: text(b.LocationFa, "LocationFa", { max: 200 }), Status: text(b.Status, "Status", { max: 20 }) ?? "active" };
    const created = await r.create("ScmWarehouse", row, actor(req), "wh");
    ok(req, res, created, 201);
  }));

  app.get(`${base}/catalog`, need("scm.mrr.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmMaterialCatalog", { where: byProject(pid), limit: 5000 }));
  }));
  app.post(`${base}/catalog`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const Code = code(b.Code, "Code");
    if (await r.findOne("ScmMaterialCatalog", byCode(pid, "Code", Code))) throw conflict("E-SCM-DUPLICATE", `کالا ${Code} تکراری`);
    const row = { ProjectId: pid, Code, NameFa: text(b.NameFa, "NameFa", { max: 400, required: true }), Category: text(b.Category, "Category", { max: 60 }), Unit: text(b.Unit, "Unit", { max: 20 }), SpecFa: text(b.SpecFa, "SpecFa", { max: 1000 }), Status: "active" };
    const created = await r.create("ScmMaterialCatalog", row, actor(req), "mat");
    ok(req, res, created, 201);
  }));

  app.get(`${base}/mrcs`, need("scm.mr.view"), route(async (req, res, r, pid) => {
    const mrcs = await r.list("ScmMrc", { where: byProject(pid), orderBy: [{ column: "CreatedAt", desc: true }] });
    const lines = await r.list("ScmMrcLine", { where: byProject(pid), limit: 5000 });
    ok(req, res, { mrcs, lines });
  }));
  app.post(`${base}/mrcs`, need("scm.mr.manage"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const MrcNo = code(b.MrcNo, "MrcNo");
    if (await r.findOne("ScmMrc", byCode(pid, "MrcNo", MrcNo))) throw conflict("E-SCM-DUPLICATE", `MRC ${MrcNo} تکراری`);
    const row = { ProjectId: pid, MrcNo, RequestedBy: actor(req), RequiredDate: date(b.RequiredDate, "RequiredDate", { required: true }), Status: text(b.Status, "Status", { max: 20 }) ?? "draft", NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }) };
    const created = await r.create("ScmMrc", row, actor(req), "mrc");
    if (Array.isArray(b.Lines)) {
      for (const ln of b.Lines) {
        const mc = code(ln.MaterialCode, "MaterialCode");
        const qty = num(ln.Quantity, "Quantity", { min: 0 });
        await r.create("ScmMrcLine", { ProjectId: pid, MrcId: created.Id, MrcNo, MaterialCode: mc, Quantity: qty, ReservedQty: 0 }, actor(req), "mrcl");
      }
    }
    ok(req, res, created, 201);
  }));

  app.get(`${base}/mivs`, need("scm.mrr.view"), route(async (req, res, r, pid) => {
    const mivs = await r.list("ScmMiv", { where: byProject(pid), orderBy: [{ column: "CreatedAt", desc: true }] });
    const lines = await r.list("ScmMivLine", { where: byProject(pid), limit: 5000 });
    ok(req, res, { mivs, lines });
  }));
  app.post(`${base}/mivs`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const MivNo = code(b.MivNo, "MivNo");
    if (await r.findOne("ScmMiv", byCode(pid, "MivNo", MivNo))) throw conflict("E-SCM-DUPLICATE", `MIV ${MivNo} تکراری`);
    const wh = await r.findOne("ScmWarehouse", byCode(pid, "Code", b.WarehouseCode));
    if (!wh && b.WarehouseCode) throw bad("E-SCM-NO-WH", `انبار ${b.WarehouseCode} وجود ندارد`);
    const row = { ProjectId: pid, MivNo, MrcNo: b.MrcNo ? code(b.MrcNo, "MrcNo", { required: false }) : null, WarehouseCode: code(b.WarehouseCode, "WarehouseCode"), IssuedBy: actor(req), IssuedAt: date(b.IssuedAt, "IssuedAt", { required: true }), Status: "issued", NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }) };
    const created = await r.create("ScmMiv", row, actor(req), "miv");
    if (Array.isArray(b.Lines)) {
      for (const ln of b.Lines) {
        await r.create("ScmMivLine", { ProjectId: pid, MivId: created.Id, MivNo, MaterialCode: code(ln.MaterialCode, "MaterialCode"), Quantity: num(ln.Quantity, "Quantity", { min: 0 }) }, actor(req), "mivl");
        // update stock balance: reduce OnHand
        const balWhere = [...byProject(pid), { column: "WarehouseCode", op: "eq", value: row.WarehouseCode }, { column: "MaterialCode", op: "eq", value: ln.MaterialCode }];
        const bal = await r.findOne("ScmStockBalance", balWhere);
        if (bal) {
          await r.patch("ScmStockBalance", bal.Id, { OnHand: Math.max(0, Number(bal.OnHand) - Number(ln.Quantity)) }, actor(req));
        }
      }
    }
    ok(req, res, created, 201);
  }));

  app.post(`${base}/mrvs`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const MrvNo = code(b.MrvNo, "MrvNo");
    if (await r.findOne("ScmMrv", byCode(pid, "MrvNo", MrvNo))) throw conflict("E-SCM-DUPLICATE", `MRV ${MrvNo} تکراری`);
    const row = { ProjectId: pid, MrvNo, MivNo: b.MivNo ? code(b.MivNo, "MivNo", { required: false }) : null, WarehouseCode: code(b.WarehouseCode, "WarehouseCode"), ReturnedBy: actor(req), ReturnedAt: date(b.ReturnedAt, "ReturnedAt", { required: true }), Status: "returned", NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }) };
    const created = await r.create("ScmMrv", row, actor(req), "mrv");
    ok(req, res, created, 201);
  }));

  app.post(`${base}/transfers`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const TransferNo = code(b.TransferNo, "TransferNo");
    if (await r.findOne("ScmStockTransfer", byCode(pid, "TransferNo", TransferNo))) throw conflict("E-SCM-DUPLICATE", `Transfer ${TransferNo} تکراری`);
    const row = { ProjectId: pid, TransferNo, FromWarehouse: code(b.FromWarehouse, "FromWarehouse"), ToWarehouse: code(b.ToWarehouse, "ToWarehouse"), MaterialCode: code(b.MaterialCode, "MaterialCode"), Quantity: num(b.Quantity, "Quantity", { min: 0 }), TransferredBy: actor(req), TransferredAt: date(b.TransferredAt, "TransferredAt", { required: true }), Status: "completed", NoteFa: text(b.NoteFa, "NoteFa", { max: 1000 }) };
    const created = await r.create("ScmStockTransfer", row, actor(req), "trf");
    // adjust balances
    const fromWhere = [...byProject(pid), { column: "WarehouseCode", op: "eq", value: row.FromWarehouse }, { column: "MaterialCode", op: "eq", value: row.MaterialCode }];
    const toWhere = [...byProject(pid), { column: "WarehouseCode", op: "eq", value: row.ToWarehouse }, { column: "MaterialCode", op: "eq", value: row.MaterialCode }];
    const fromBal = await r.findOne("ScmStockBalance", fromWhere);
    const toBal = await r.findOne("ScmStockBalance", toWhere);
    if (fromBal) await r.patch("ScmStockBalance", fromBal.Id, { OnHand: Math.max(0, Number(fromBal.OnHand) - Number(row.Quantity)) }, actor(req));
    if (toBal) await r.patch("ScmStockBalance", toBal.Id, { OnHand: Number(toBal.OnHand) + Number(row.Quantity) }, actor(req));
    else await r.create("ScmStockBalance", { ProjectId: pid, WarehouseCode: row.ToWarehouse, MaterialCode: row.MaterialCode, OnHand: row.Quantity, Reserved: 0, OnOrder: 0 }, actor(req), "bal");
    ok(req, res, created, 201);
  }));

  app.get(`${base}/stock-balances`, need("scm.mrr.view"), route(async (req, res, r, pid) => {
    ok(req, res, await r.list("ScmStockBalance", { where: byProject(pid), limit: 5000 }));
  }));
  app.post(`${base}/stock-balances`, need("scm.mrr.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const whCode = code(b.WarehouseCode, "WarehouseCode");
    const matCode = code(b.MaterialCode, "MaterialCode");
    const existing = await r.findOne("ScmStockBalance", [...byProject(pid), { column: "WarehouseCode", op: "eq", value: whCode }, { column: "MaterialCode", op: "eq", value: matCode }]);
    if (existing) {
      await r.patch("ScmStockBalance", existing.Id, { OnHand: num(b.OnHand, "OnHand", { min: 0 }) }, actor(req));
      ok(req, res, await r.get("ScmStockBalance", existing.Id));
    } else {
      const row = { ProjectId: pid, WarehouseCode: whCode, MaterialCode: matCode, OnHand: num(b.OnHand, "OnHand", { min: 0 }), Reserved: b.Reserved ? num(b.Reserved, "Reserved", { min: 0 }) : 0, OnOrder: b.OnOrder ? num(b.OnOrder, "OnOrder", { min: 0 }) : 0 };
      const created = await r.create("ScmStockBalance", row, actor(req), "bal");
      ok(req, res, created, 201);
    }
  }));
}

