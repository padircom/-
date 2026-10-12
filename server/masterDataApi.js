/**
 * Master data REST — خوشه‌های صنعتی و پروژه‌ها (core / P0).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * چرا این فایل لازم شد
 *
 * پیش از این `/api/industries` و `/api/projects` فقط نسخهٔ SQL Server را
 * داشتند: `getPool(req)` و جدول‌های `dbo.Industry_Master` / `dbo.Project_Master`.
 * در استقرار بدون SQL Server (یا با پایگاه خالی) این مسیرها ۵۰۰ می‌دادند و
 * تنها چیزی که کلاینت می‌دید «داده نیامد» بود؛ پس AdminWorkspace و
 * «همگام‌سازی دادهٔ پایه» بی‌صدا کار نمی‌کردند:
 *
 *   ۱) نوشتن خوشه/پروژه با `.catch(() => {})` رد می‌شد و کاربر پیام موفقیت
 *      می‌گرفت — یعنی مرورگر یک چیز می‌گفت و سرور چیز دیگری داشت.
 *   ۲) میان‌افزار تنزّل آرام نوشتن‌ها را به فروشگاه موازی دیگری
 *      (`Industry_Master.json` / `Project_Master.json`) می‌برد، در حالی که
 *      اسکیمای واقعی جدول‌های `Industry` و `Project` را دارد.
 *
 * این ماژول همان دو منبع را روی لایهٔ ماندگاری مشترک (`repo`) می‌آورد تا هم
 * با درایور JSON و هم با SQL Server کار کند، و مجوز/محدودهٔ پروژه/اعتبارسنجی
 * را واقعاً اعمال می‌کند. میان‌افزار تنزّل آرام فقط خطای *اتصال* را می‌گیرد و
 * این مسیرها هیچ‌وقت به آن نمی‌رسند؛ پس «۵۰۰ِ بی‌صدا» اینجا معنا ندارد.
 *
 * سه تصمیم صریح:
 *
 *   ۱) `industryId` در پاسخ، **کد** خوشه است (مثل `c1`) نه کلید فنی ردیف.
 *      رابط کاربری خوشه‌ها را با همین کد کلید می‌زند (`framework.ts` → `c1`)
 *      و مسیر `/api/projects?industryId=c1` هم همین را می‌فرستد.
 *   ۲) `progress` پروژه محاسبه‌شدهٔ سرور است، نه ورودی کاربر و نه صفرِ ثابت.
 *      جدول `Project` ستون پیشرفت ندارد؛ اگر فعالیتی ثبت نشده باشد مقدار
 *      `null` و `progressBasis: "none"` برمی‌گردد تا رابط کاربری «—» نشان
 *      دهد، نه «۰٪» ساختگی. وزن‌دهی با `BudgetMh` است و در نبود آن میانگین
 *      سادهٔ `PhysicalPct` فعالیت‌ها.
 *   ۳) خوشهٔ صنعتی دادهٔ پایهٔ سامانه است، پس ساخت/ویرایش/غیرفعال‌سازی آن
 *      مجوز `sys.config.manage` می‌خواهد (هم‌راستا با سیاست SEC-1 برای
 *      جدول‌های پایه). ساخت/ویرایش پروژه `core.project.edit` است.
 *
 * خطاها همه صریح‌اند: ۴۰۰ ورودی نامعتبر، ۴۰۱ بدون هویت، ۴۰۳ بدون مجوز یا
 * بیرون محدودهٔ پروژه، ۴۰۴ رکورد ناموجود، ۴۰۹ کد تکراری، ۵۰۳ نبود مخزن.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { tableDef } from "./sqlLogic.js";

export const MASTER_DATA_VERSION = "core-masterdata-v1";
export const MASTER_DATA_ROUTES = Object.freeze([
  "GET /api/industries",
  "POST /api/industries",
  "PATCH /api/industries/:id",
  "DELETE /api/industries/:id",
  "GET /api/projects",
  "POST /api/projects",
  "PATCH /api/projects/:id",
].sort());

const PROJECT_STATUSES = ["active", "tender", "stopped", "completed"];
/* فیلدهایی که هر مسیر واقعاً می‌نویسد. هر چیز دیگری در بدنه، «نادیده‌گرفته‌شده»
 * اعلام می‌شود (`meta.ignoredFields`) — نه اینکه بی‌صدا دور ریخته شود. */
const INDUSTRY_FIELDS = new Set(["id", "Id", "code", "Code", "titleFa", "TitleFa", "titleEn", "TitleEn", "icon", "Icon", "color", "Color", "isActive", "IsActive"]);
const PROJECT_FIELDS = new Set([
  "id", "Id", "industryId", "IndustryId", "code", "Code", "nameFa", "NameFa", "nameEn", "NameEn",
  "clientFa", "ClientFa", "consultantFa", "ConsultantFa", "contractorFa", "ContractorFa",
  "locationFa", "LocationFa", "contractNo", "ContractNo", "budget", "Budget",
  "startDate", "StartDate", "finishDate", "FinishDate", "status", "Status",
]);
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$/;

export class MasterDataError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = "MasterDataError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const bad = (field, message, extra = {}) => new MasterDataError(400, "CORE_VALIDATION_FAILED", message, { field, ...extra });
const notFound = (what) => new MasterDataError(404, "CORE_NOT_FOUND", `${what} یافت نشد`);

/* ───────────────────────── اعتبارسنجی ───────────────────────── */

function text(value, field, { required = false, max = 200, min = 1, pattern } = {}) {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) throw bad(field, `${field} الزامی است`);
    return null;
  }
  if (typeof value !== "string") throw bad(field, `${field} باید رشته باشد`);
  const trimmed = value.trim();
  if (trimmed.length < min && trimmed !== "") throw bad(field, `${field} باید دست‌کم ${min} نویسه باشد`);
  if (trimmed.length > max) throw bad(field, `${field} نمی‌تواند بیشتر از ${max} نویسه باشد`);
  if (pattern && !pattern.test(trimmed)) throw bad(field, `${field} قالب نامعتبر دارد (حرف/عدد، نقطه، خط تیره، زیرخط)`);
  return trimmed;
}

function code(value, field) {
  return text(value, field, { required: true, max: 50, pattern: CODE_RE });
}

function money(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw bad(field, `${field} باید عدد نامنفی باشد`);
  return n;
}

function date(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim();
  /* فقط تاریخ میلادی ISO پذیرفته می‌شود؛ نمایش شمسی کار رابط کاربری است. */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad(field, `${field} باید قالب YYYY-MM-DD داشته باشد`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw bad(field, `${field} تاریخ معتبر نیست`);
  return s;
}

function status(value, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw bad("Status", "Status الزامی است");
    return null;
  }
  const s = String(value).trim();
  if (!PROJECT_STATUSES.includes(s)) {
    throw bad("Status", `Status باید یکی از ${PROJECT_STATUSES.join(" | ")} باشد`, { allowed: PROJECT_STATUSES });
  }
  return s;
}

/* ───────────────────────── پیشرفت پروژه ───────────────────────── */

/**
 * پیشرفت پروژه از خودِ فعالیت‌های همان پروژه درمی‌آید.
 *
 * چرا این‌جا و نه در رابط کاربری: عدد پیشرفت باید یک جا محاسبه شود، وگرنه
 * هر صفحه رقم خودش را می‌سازد. مبنای محاسبه در خروجی اعلام می‌شود تا مصرف‌کننده
 * بداند عدد از چه چیزی آمده است:
 *   • `activity_mh_weighted` — میانگین وزنی با BudgetMh
 *   • `activity_average`     — میانگین سادهٔ فعالیت‌ها (وزن‌ها نامعلوم)
 *   • `none`                 — هیچ فعالیتی ثبت نشده؛ پیشرفت `null` است، نه صفر
 */
export async function projectProgress(repo, projectId) {
  const activities = await repo.list("Activity", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
  if (!activities.length) return { progress: null, basis: "none", activities: 0 };

  const rows = activities.filter((a) => a.PhysicalPct !== null && a.PhysicalPct !== undefined);
  if (!rows.length) return { progress: null, basis: "none", activities: activities.length };

  const weights = rows.map((a) => Number(a.BudgetMh));
  const usableWeights = weights.every((w) => Number.isFinite(w) && w > 0);
  const value = usableWeights
    ? rows.reduce((sum, a, i) => sum + (Number(a.PhysicalPct) || 0) * weights[i], 0) / weights.reduce((s, w) => s + w, 0)
    : rows.reduce((sum, a) => sum + (Number(a.PhysicalPct) || 0), 0) / rows.length;

  const progress = Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
  return { progress, basis: usableWeights ? "activity_mh_weighted" : "activity_average", activities: rows.length };
}

/* ───────────────────────── نگاشت به قرارداد کلاینت ───────────────────────── */

const industryDto = (row) => ({
  id: row.Id,
  code: row.Code,
  titleFa: row.TitleFa,
  titleEn: row.TitleEn ?? row.TitleFa,
  icon: row.Icon ?? "🏭",
  color: row.Color ?? "#38BDF8",
  isActive: row.IsActive === true || Number(row.IsActive) === 1,
});

const projectDto = (row, industryCode, progress) => ({
  id: row.Id,
  industryId: industryCode ?? row.IndustryId,
  code: row.Code,
  nameFa: row.NameFa,
  nameEn: row.NameEn ?? null,
  clientFa: row.ClientFa ?? null,
  consultantFa: row.ConsultantFa ?? null,
  contractorFa: row.ContractorFa ?? null,
  locationFa: row.LocationFa ?? null,
  contractNo: row.ContractNo ?? null,
  budget: row.Budget === null || row.Budget === undefined ? null : Number(row.Budget),
  status: row.Status ?? "active",
  startDate: row.StartDate ?? null,
  finishDate: row.FinishDate ?? null,
  progress: progress?.progress ?? null,
  progressBasis: progress?.basis ?? "none",
});

/* ───────────────────────── ثبت مسیرها ───────────────────────── */

export function registerMasterDataRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app || typeof app.get !== "function") throw new TypeError("Express-compatible app is required");
  if (typeof repo !== "function") throw new TypeError("Master-data repository is required");
  if (!Array.isArray(subjects) || typeof evaluate !== "function") throw new TypeError("Master-data RBAC dependencies are required");

  const fail = (req, res, err) => {
    if (err instanceof MasterDataError) {
      return res.status(err.status).json({
        ok: false,
        error: { code: err.code, message: err.message, ...err.details, traceId: req.requestId },
      });
    }
    if (err?.code === "ROW_VALIDATION_FAILED") {
      return res.status(400).json({
        ok: false,
        error: { code: "CORE_VALIDATION_FAILED", message: "رکورد اعتبارسنجی نشد", issues: err.issues, traceId: req.requestId },
      });
    }
    if (["UNIQUE_VIOLATION", "DUPLICATE_KEY"].includes(err?.code) || [2601, 2627].includes(err?.number)) {
      return res.status(409).json({
        ok: false,
        error: { code: "CORE_DUPLICATE", message: "کد این رکورد از قبل ثبت شده است", traceId: req.requestId },
      });
    }
    if (err?.code === "PERSISTENCE_UNAVAILABLE" || err?.code === "UNKNOWN_TABLE") {
      return res.status(503).json({
        ok: false,
        error: { code: "CORE_PERSISTENCE_UNAVAILABLE", message: "مخزن داده در دسترس نیست", traceId: req.requestId },
      });
    }
    console.error("[%s] master-data error:", req.requestId, err);
    return res.status(500).json({
      ok: false,
      error: { code: "CORE_INTERNAL_ERROR", message: "خطای داخلی سرور", traceId: req.requestId },
    });
  };

  /** هویت + مجوز؛ تصمیم با محدودهٔ پروژه هم سنجیده می‌شود. */
  const subjectOf = (req) => {
    const id = String(req.headers?.["x-user-id"] ?? "").trim();
    return id ? subjects.find((s) => s.id === id && s.active !== false) ?? null : null;
  };

  const gate = (permission, { projectId = null, allowAnonymousRead = false } = {}) => (req, res, next) => {
    const subject = subjectOf(req);
    if (!subject) {
      if (allowAnonymousRead) { req.coreSubject = null; return next(); }
      return fail(req, res, new MasterDataError(401, "CORE_AUTH_REQUIRED", "هویت کاربر معتبر و فعال الزامی است", { permission }));
    }
    const verdict = evaluate(subject, permission, { projectId: projectId ?? undefined });
    if (!verdict.allow) {
      return fail(req, res, new MasterDataError(403, "CORE_FORBIDDEN", "مجوز این اقدام روی دادهٔ پایه را ندارید", { permission, reason: verdict.code }));
    }
    req.coreSubject = subject;
    return next();
  };

  /** فیلدهای ناشناختهٔ بدنه را در پاسخ اعلام می‌کند تا سکوتِ داده‌ساز نباشد. */
  const noteIgnored = (req, body, accepted) => {
    const ignored = Object.keys(body ?? {}).filter((key) => !accepted.has(key));
    if (ignored.length) req.coreIgnored = ignored;
  };

  const write = (handler, status = 200) => async (req, res) => {
    try {
      const r = await repo();
      const data = await handler(r, req);
      const meta = { traceId: req.requestId, version: MASTER_DATA_VERSION, driver: r.driver?.kind ?? "unknown" };
      if (req.coreIgnored?.length) meta.ignoredFields = req.coreIgnored;
      return res.status(status).json({ ok: true, data, meta });
    } catch (err) {
      return fail(req, res, err);
    }
  };

  /* محدودهٔ پروژه: دامنهٔ ستاره یا پروژه‌ای که در فهرست کاربر است. سازندهٔ
   * رکورد هم استثناست — وگرنه کسی که خوشهٔ تازه را راه می‌اندازد (بند بالا،
   * «بوت‌استرپ») بلافاصله اجازهٔ ویرایش پروژهٔ خودش را از دست می‌دهد تا وقتی
   * محدودهٔ RBAC به‌روز شود. این استثنا محدود و قابل حسابرسی است. */
  const scopeAllows = (subject, projectId, createdBy) =>
    !subject
    || subject.projectIds?.includes("*")
    || subject.projectIds?.includes(projectId)
    || (createdBy !== undefined && createdBy === subject.id);

  const audit = (r, req, action, entityName, entityId, details = {}) =>
    r.create("AuditLog", {
      At: new Date().toISOString(),
      SubjectId: req.coreSubject?.id ?? "anonymous",
      Action: action,
      Permission: details.permission ?? null,
      Decision: "allow",
      ProjectCode: details.projectCode ?? null,
      EntityName: entityName,
      EntityId: entityId,
      Severity: "info",
      Details: { ...details, traceId: req.requestId, version: MASTER_DATA_VERSION },
    }, req.coreSubject?.id ?? "system");

  /* هویت خوشه در رابط کاربری «کد» است (`c1`)، ولی کلید فنی ردیف چیز دیگری
   * می‌تواند باشد. پس همیشه اول با کد جست‌وجو می‌کنیم و اگر نبود با کلید ردیف
   * — تا هم `PATCH /api/industries/c1` کار کند و هم مسیرهای قدیمی‌تر. */
  const industryByKey = async (r, key) => {
    const value = String(key ?? "").trim();
    if (!value) return null;
    return (await r.findOne("Industry", [{ column: "Code", op: "eq", value }])) ?? (await r.get("Industry", value));
  };
  const industryById = (r, id) => r.get("Industry", id);

  /* ───────────── خوشه‌های صنعتی ───────────── */

  app.get("/api/industries", gate("core.portfolio.view"), async (req, res) => {
    try {
      const r = await repo();
      const subject = req.coreSubject;
      const includeInactive = String(req.query.includeInactive ?? "") === "1";
      const search = String(req.query.search ?? "").trim().toLowerCase();
      let rows = await r.list("Industry", { orderBy: [{ column: "Code", dir: "asc" }] });
      if (!includeInactive) rows = rows.filter((row) => row.IsActive === true || Number(row.IsActive) === 1);

      /* محدودهٔ پروژه: کاربر تک‌پروژه‌ای فقط خوشه‌هایی را می‌بیند که
       * پروژه‌ای در محدودهٔ او دارند. پیش از این هیچ محدودیتی نبود و هر
       * کاربر همهٔ خوشه‌های سازمان را می‌دید. */
      if (subject && !subject.projectIds?.includes("*")) {
        const projects = await r.list("Project", { where: [{ column: "IndustryId", op: "in", value: rows.map((x) => x.Id) }] });
        const allowedIndustries = new Set(projects.filter((p) => subject.projectIds.includes(p.Id)).map((p) => p.IndustryId));
        rows = rows.filter((row) => allowedIndustries.has(row.Id));
      }
      if (search) {
        rows = rows.filter((row) =>
          [row.Code, row.TitleFa, row.TitleEn].some((v) => String(v ?? "").toLowerCase().includes(search)));
      }
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || rows.length || 50));
      const items = rows.slice((page - 1) * pageSize, page * pageSize).map(industryDto);
      return res.json({
        ok: true,
        data: { items, page, pageSize, total: rows.length },
        meta: { traceId: req.requestId, version: MASTER_DATA_VERSION, driver: r.driver?.kind ?? "unknown" },
      });
    } catch (err) {
      return fail(req, res, err);
    }
  });

  app.post("/api/industries", gate("sys.config.manage"), write(async (r, req) => {
    const body = req.body ?? {};
    noteIgnored(req, body, INDUSTRY_FIELDS);
    const payload = {
      Id: text(body.Id ?? body.id, "Id", { max: 60, pattern: ID_RE }) ?? undefined,
      Code: code(body.code ?? body.Code, "code"),
      TitleFa: text(body.titleFa ?? body.TitleFa, "titleFa", { required: true, max: 200 }),
      TitleEn: text(body.titleEn ?? body.TitleEn, "titleEn", { max: 200 }),
      Icon: text(body.icon ?? body.Icon, "icon", { max: 20 }) ?? "🏭",
      Color: text(body.color ?? body.Color, "color", { max: 20 }) ?? "#38BDF8",
      IsActive: body.isActive === undefined && body.IsActive === undefined
        ? true
        : Boolean(body.isActive ?? body.IsActive),
    };
    const dup = await industryByKey(r, payload.Code);
    if (dup) throw new MasterDataError(409, "CORE_DUPLICATE", `خوشهٔ ${payload.Code} از قبل ثبت شده است`);
    if (payload.Id && await industryById(r, payload.Id)) {
      throw new MasterDataError(409, "CORE_DUPLICATE", `شناسهٔ ${payload.Id} از قبل وجود دارد`);
    }
    if (payload.Id === undefined) delete payload.Id;
    const saved = await r.create("Industry", payload, req.coreSubject.id);
    await audit(r, req, "CORE_INDUSTRY_CREATE", "Industry", saved.Id, { permission: "sys.config.manage" });
    return industryDto(saved);
  }, 201));

  app.patch("/api/industries/:id", gate("sys.config.manage"), write(async (r, req) => {
    const row = await industryByKey(r, req.params.id);
    if (!row) throw notFound("خوشهٔ صنعتی");
    const body = req.body ?? {};
    noteIgnored(req, body, INDUSTRY_FIELDS);
    const patch = {};
    if (body.titleFa !== undefined) patch.TitleFa = text(body.titleFa, "titleFa", { required: true, max: 200 });
    if (body.titleEn !== undefined) patch.TitleEn = text(body.titleEn, "titleEn", { max: 200 });
    if (body.icon !== undefined) patch.Icon = text(body.icon, "icon", { max: 20 });
    if (body.color !== undefined) patch.Color = text(body.color, "color", { max: 20 });
    if (body.isActive !== undefined) patch.IsActive = Boolean(body.isActive);
    /* کد خوشه کلید رابط کاربری و محدودهٔ پروژه است؛ تغییر آن پنهانی مجاز نیست. */
    if (body.code !== undefined && String(body.code) !== row.Code) {
      throw bad("code", "کد خوشه پس از ثبت تغییرناپذیر است");
    }
    if (!Object.keys(patch).length) throw bad("body", "هیچ فیلد قابل ویرایشی در درخواست نیست");
    const saved = await r.patch("Industry", row.Id, patch, req.coreSubject.id, row.RowVersion);
    if (saved && saved.ok === false) throw new MasterDataError(409, "CORE_VERSION", "رکورد هم‌زمان تغییر کرده است");
    const fresh = await industryById(r, row.Id);
    await audit(r, req, "CORE_INDUSTRY_UPDATE", "Industry", row.Id, { permission: "sys.config.manage", fields: Object.keys(patch) });
    return industryDto(fresh ?? row);
  }));

  app.delete("/api/industries/:id", gate("sys.config.manage"), write(async (r, req) => {
    const row = await industryByKey(r, req.params.id);
    if (!row) throw notFound("خوشهٔ صنعتی");
    const children = await r.list("Project", { where: [{ column: "IndustryId", op: "eq", value: row.Id }] });
    const live = children.filter((p) => (p.Status ?? "active") !== "deleted");
    if (live.length) {
      throw new MasterDataError(409, "CORE_INDUSTRY_HAS_PROJECTS", `این خوشه ${live.length} پروژه دارد؛ نخست پروژه‌ها را جابه‌جا یا بسته کنید`);
    }
    /* حذف فیزیکی خوشه انجام نمی‌شود: نگاشت `IndustryId` در رکوردهای تاریخی
     * باقی می‌ماند و حذف سخت، آن‌ها را بی‌مرجع می‌کند. غیرفعال‌سازی صریح است. */
    const deactivated = await r.patch("Industry", row.Id, { IsActive: false }, req.coreSubject.id, row.RowVersion);
    if (deactivated && deactivated.ok === false) throw new MasterDataError(409, "CORE_VERSION", "رکورد هم‌زمان تغییر کرده است");
    await audit(r, req, "CORE_INDUSTRY_DEACTIVATE", "Industry", row.Id, { permission: "sys.config.manage" });
    return { id: row.Id, code: row.Code, isActive: false, deleted: false, deactivated: true };
  }));

  /* ───────────── پروژه‌ها ───────────── */

  app.get("/api/projects", gate("core.project.view"), async (req, res) => {
    try {
      const r = await repo();
      const subject = req.coreSubject;
      const search = String(req.query.search ?? "").trim().toLowerCase();
      const industryCode = String(req.query.industryId ?? "").trim();
      const statusFilter = String(req.query.status ?? "").trim();

      /* `?industryId=` کد خوشه است (مثل c1)؛ سازگاری با آنچه رابط کاربری
       * می‌فرستد. اگر کلید فنی ردیف هم داده شود، همان هم پذیرفته می‌شود. */
      let industry = null;
      if (industryCode) {
        industry = await industryByKey(r, industryCode);
        if (!industry) return res.json({ ok: true, data: { items: [], page: 1, pageSize: 0, total: 0 }, meta: { traceId: req.requestId, version: MASTER_DATA_VERSION, driver: r.driver?.kind ?? "unknown", reason: "industry-not-found" } });
      }

      const where = industry ? [{ column: "IndustryId", op: "eq", value: industry.Id }] : [];
      let rows = await r.list("Project", { where, orderBy: [{ column: "Code", dir: "asc" }] });
      if (subject && !subject.projectIds?.includes("*")) {
        rows = rows.filter((row) => subject.projectIds.includes(row.Id));
      }
      if (statusFilter) rows = rows.filter((row) => (row.Status ?? "active") === statusFilter);
      if (search) {
        rows = rows.filter((row) =>
          [row.Code, row.NameFa, row.NameEn, row.ClientFa, row.LocationFa].some((v) => String(v ?? "").toLowerCase().includes(search)));
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize) || rows.length || 50));
      const slice = rows.slice((page - 1) * pageSize, page * pageSize);
      const industries = await r.list("Industry", {});
      const codeById = new Map(industries.map((i) => [i.Id, i.Code]));
      const items = [];
      for (const row of slice) {
        const progress = await projectProgress(r, row.Id);
        items.push(projectDto(row, codeById.get(row.IndustryId), progress));
      }
      return res.json({
        ok: true,
        data: { items, page, pageSize, total: rows.length },
        meta: { traceId: req.requestId, version: MASTER_DATA_VERSION, driver: r.driver?.kind ?? "unknown" },
      });
    } catch (err) {
      return fail(req, res, err);
    }
  });

  app.post("/api/projects", gate("core.project.edit"), write(async (r, req) => {
    const body = req.body ?? {};
    noteIgnored(req, body, PROJECT_FIELDS);
    const industryCode = text(body.industryId ?? body.IndustryId, "industryId", { required: true, max: 60 });
    const industry = await industryByKey(r, industryCode);
    if (!industry) throw new MasterDataError(400, "CORE_UNKNOWN_INDUSTRY", `خوشهٔ ${industryCode} وجود ندارد`);

    /* محدودهٔ پروژه: کسی که دامنه‌اش ستاره نیست، فقط در خوشه‌ای پروژه
     * می‌سازد که خودش در آن پروژه دارد. یک استثنا عمدی هست: خوشهٔ خالی
     * (بی‌پروژه) تا اولین پروژه‌اش را از راه REST بگیرد، وگرنه هیچ راهی
     * برای راه‌اندازی خوشهٔ تازه نمی‌ماند و ناچار باید از در پشتیِ
     * `/api/data/*` نوشت — همان کاری که این تغییر می‌بندد. */
    if (req.coreSubject && !req.coreSubject.projectIds?.includes("*")) {
      const siblings = await r.list("Project", { where: [{ column: "IndustryId", op: "eq", value: industry.Id }] });
      const bootstrapping = siblings.length === 0;
      if (!bootstrapping && !siblings.some((row) => req.coreSubject.projectIds.includes(row.Id))) {
        throw new MasterDataError(403, "CORE_PROJECT_SCOPE", "در این خوشه پروژه‌ای در محدودهٔ شما نیست");
      }
    }

    const payload = {
      Id: text(body.Id ?? body.id, "Id", { max: 60, pattern: ID_RE }) ?? undefined,
      IndustryId: industry.Id,
      Code: code(body.code ?? body.Code, "code"),
      NameFa: text(body.nameFa ?? body.NameFa, "nameFa", { required: true, max: 400 }),
      NameEn: text(body.nameEn ?? body.NameEn, "nameEn", { max: 400 }),
      ClientFa: text(body.clientFa ?? body.ClientFa, "clientFa", { max: 200 }),
      ConsultantFa: text(body.consultantFa ?? body.ConsultantFa, "consultantFa", { max: 200 }),
      ContractorFa: text(body.contractorFa ?? body.ContractorFa, "contractorFa", { max: 200 }),
      LocationFa: text(body.locationFa ?? body.LocationFa, "locationFa", { max: 250 }),
      ContractNo: text(body.contractNo ?? body.ContractNo, "contractNo", { max: 60 }),
      Budget: money(body.budget ?? body.Budget, "budget"),
      StartDate: date(body.startDate ?? body.StartDate, "startDate"),
      FinishDate: date(body.finishDate ?? body.FinishDate, "finishDate"),
      Status: status(body.status ?? body.Status) ?? "active",
    };
    if (payload.StartDate && payload.FinishDate && payload.FinishDate < payload.StartDate) {
      throw bad("finishDate", "تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد");
    }
    const dup = await r.findOne("Project", [{ column: "Code", op: "eq", value: payload.Code }]);
    if (dup) throw new MasterDataError(409, "CORE_DUPLICATE", `پروژه با کد ${payload.Code} از قبل ثبت شده است`);
    if (payload.Id && await r.get("Project", payload.Id)) {
      throw new MasterDataError(409, "CORE_DUPLICATE", `شناسهٔ ${payload.Id} از قبل وجود دارد`);
    }
    if (payload.Id === undefined) delete payload.Id;
    const saved = await r.create("Project", payload, req.coreSubject.id);
    await audit(r, req, "CORE_PROJECT_CREATE", "Project", saved.Id, { permission: "core.project.edit", projectCode: saved.Code });
    /* `progress` محاسبه‌شدهٔ سرور است؛ همین DTO به کلاینت برمی‌گردد تا عدد
     * دستی کاربر جای پیشرفت واقعی ننشیند. */
    const progress = await projectProgress(r, saved.Id);
    return projectDto(saved, industry.Code, progress);
  }, 201));

  app.patch("/api/projects/:id", gate("core.project.edit"), write(async (r, req) => {
    const row = await r.get("Project", req.params.id);
    if (!row) throw notFound("پروژه");
    if (!scopeAllows(req.coreSubject, row.Id, row.CreatedBy)) {
      throw new MasterDataError(403, "CORE_PROJECT_SCOPE", "این پروژه در محدودهٔ شما نیست");
    }
    const body = req.body ?? {};
    noteIgnored(req, body, PROJECT_FIELDS);
    const patch = {};
    if (body.code !== undefined && String(body.code) !== row.Code) {
      /* کد پروژه در سندها و محدودهٔ RBAC ارجاع داده می‌شود؛ تغییر پنهانی‌اش مجاز نیست. */
      throw bad("code", "کد پروژه پس از ثبت تغییرناپذیر است");
    }
    if (body.nameFa !== undefined) patch.NameFa = text(body.nameFa, "nameFa", { required: true, max: 400 });
    if (body.nameEn !== undefined) patch.NameEn = text(body.nameEn, "nameEn", { max: 400 });
    if (body.clientFa !== undefined) patch.ClientFa = text(body.clientFa, "clientFa", { max: 200 });
    if (body.consultantFa !== undefined) patch.ConsultantFa = text(body.consultantFa, "consultantFa", { max: 200 });
    if (body.contractorFa !== undefined) patch.ContractorFa = text(body.contractorFa, "contractorFa", { max: 200 });
    if (body.locationFa !== undefined) patch.LocationFa = text(body.locationFa, "locationFa", { max: 250 });
    if (body.contractNo !== undefined) patch.ContractNo = text(body.contractNo, "contractNo", { max: 60 });
    if (body.budget !== undefined) patch.Budget = money(body.budget, "budget");
    if (body.startDate !== undefined) patch.StartDate = date(body.startDate, "startDate");
    if (body.finishDate !== undefined) patch.FinishDate = date(body.finishDate, "finishDate");
    if (body.status !== undefined) patch.Status = status(body.status, { required: true });
    if (body.industryId !== undefined) {
      const industry = await industryByKey(r, String(body.industryId));
      if (!industry) throw new MasterDataError(400, "CORE_UNKNOWN_INDUSTRY", `خوشهٔ ${body.industryId} وجود ندارد`);
      patch.IndustryId = industry.Id;
    }
    const start = patch.StartDate ?? row.StartDate;
    const finish = patch.FinishDate ?? row.FinishDate;
    if (start && finish && String(finish) < String(start)) throw bad("finishDate", "تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد");
    if (!Object.keys(patch).length) throw bad("body", "هیچ فیلد قابل ویرایشی در درخواست نیست");

    const result = await r.patch("Project", row.Id, patch, req.coreSubject.id, row.RowVersion);
    if (result && result.ok === false) throw new MasterDataError(409, "CORE_VERSION", "رکورد هم‌زمان تغییر کرده است");
    const fresh = await r.get("Project", row.Id);
    const industry = await industryById(r, fresh.IndustryId);
    await audit(r, req, "CORE_PROJECT_UPDATE", "Project", row.Id, { permission: "core.project.edit", projectCode: row.Code, fields: Object.keys(patch) });
    const progress = await projectProgress(r, row.Id);
    return projectDto(fresh ?? row, industry?.Code, progress);
  }));

  return { MASTER_DATA_VERSION, MASTER_DATA_ROUTES };
}

/** ستون قابل نوشتن نیست ولی برای تست‌ها و نگاشت لازم است. */
export const MASTER_DATA_TABLES = Object.freeze({
  Industry: Object.freeze(tableDef("Industry").columns.map((c) => c.name)),
  Project: Object.freeze(tableDef("Project").columns.map((c) => c.name)),
});
