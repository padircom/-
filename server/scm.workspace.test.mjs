/**
 * آزمون REST میز کار خرید، بازرگانی و انبار — `/api/scm/:projectId/...`.
 * ═══════════════════════════════════════════════════════════════════════
 * چرا این فایل لازم شد: در PR #8 (P5+P6) این حوزه با ۲۶ جدول و ۵۱ مسیر افزوده شد
 * ولی هیچ فایل آزمونی به `/api/scm` ارجاع نداشت؛ اعتبارسنجی‌اش دستی بود و همان‌جا
 * به‌عنوان بدهی فنی ثبت شد. تا پیش از UI تعاملی خطری نداشت (صفحه فقط می‌خواند)،
 * ولی از لحظه‌ای که فرم‌های ثبت/ویرایش/حذف به این مسیرها وصل شدند، قرارداد مسیر و
 * قواعد کسب‌وکار باید قفل شود — وگرنه اولین تغییر سرور بی‌صدا فرم‌ها را می‌شکند.
 *
 * این آزمون پنج چیز را نگه می‌دارد:
 *   ۱) قرارداد مسیرها: هر ۵۱ مسیری که UI صدا می‌زند واقعاً ثبت شده است.
 *   ۲) هویت و مجوز: ۴۰۱ بی‌هویت/ناشناخته، ۴۰۳ نقش بی‌مجوز، و ماتریس مجوز
 *      `scm.*` که «آینهٔ کلاینت‌سوی» `canScmAccess` از همان تقلید می‌کند.
 *   ۳) قواعد کسب‌وکار: یکتایی، وابستگی‌ها (AVL برای SBL، MR برای پیوند،
 *      PO برای رسید)، منع حذف رکورد در حال استفاده و اعلان تکراری.
 *   ۴) اثر انبار: حواله موجودی را کم می‌کند، انتقال جابه‌جا می‌کند و
 *      «مرجوعی» عمداً روی موجودی اثر ندارد (رفتار فعلی سرور، نه تصور ما).
 *   ۵) ممیزی: هر تغییر مهم در `AuditLog` ثبت می‌شود.
 *
 * اجرا: بخشی از `npm test` است؛ روی repo شبیه‌ساز درون‌حافظه‌ای بدون شبکه.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { registerScmWorkspaceRoutes } from "./scmWorkspaceApi.js";
import { DEMO_SUBJECTS, evaluate } from "./rbacLogic.js";

const PROJECT = "c1-p1";
const BASE = `/api/scm/:projectId`;

/** کاربران نمونهٔ همین ماژول (ماتریس واقعی RBAC، نه فهرست دستی). */
const PM = "u-pm";           // project_manager — همهٔ ده مجوز SCM
const COST = "u-cost";       // cost_controller — همهٔ ده مجوز SCM
const ADMIN = "u-admin";     // admin — نه مجوز (بدون scm.mr.manage)
const PLANNER = "u-planner"; // planner — هیچ مجوز SCM
const LEFT = "u-left";       // کاربر غیرفعال

/** همان ده مجوزی که سرور روی این مسیرها بررسی می‌کند. */
const SCM_PERMISSIONS = [
  "scm.vendor.view", "scm.vendor.manage", "scm.package.view", "scm.package.edit",
  "scm.bidder.view", "scm.bidder.manage", "scm.mr.view", "scm.mr.manage",
  "scm.mrr.view", "scm.mrr.post",
];

/**
 * فهرست کامل مسیرهای اعلام‌شده — دستی از همان فایل سرور استخراج شده است؛
 * اگر مسیری اضافه/حذف شود، آزمون قرارداد می‌شکند تا UI بی‌خبر نماند.
 */
const SCM_ROUTES = [
  "GET /api/scm/:projectId/workspace",
  "POST /api/scm/:projectId/mrs",
  "POST /api/scm/:projectId/vendors", "PATCH /api/scm/:projectId/vendors/:code", "DELETE /api/scm/:projectId/vendors/:code",
  "POST /api/scm/:projectId/avl", "DELETE /api/scm/:projectId/avl/:id",
  "POST /api/scm/:projectId/packages", "PATCH /api/scm/:projectId/packages/:code", "DELETE /api/scm/:projectId/packages/:code",
  "POST /api/scm/:projectId/packages/:code/mrs", "DELETE /api/scm/:projectId/packages/:code/mrs/:mrCode",
  "POST /api/scm/:projectId/inquiries", "PATCH /api/scm/:projectId/inquiries/:code",
  "POST /api/scm/:projectId/inquiries/:code/bidders", "POST /api/scm/:projectId/inquiries/:code/bidders/:vendorCode/ack",
  "DELETE /api/scm/:projectId/inquiries/:code/bidders/:vendorCode",
  "POST /api/scm/:projectId/invitations", "POST /api/scm/:projectId/invitations/:invNo/ack",
  "GET /api/scm/:projectId/mr-changes", "POST /api/scm/:projectId/mr-changes", "POST /api/scm/:projectId/mr-changes/:id/notify",
  "GET /api/scm/:projectId/mrrs", "POST /api/scm/:projectId/mrrs", "PATCH /api/scm/:projectId/mrrs/:code",
  "GET /api/scm/:projectId/proposals", "POST /api/scm/:projectId/proposals",
  "POST /api/scm/:projectId/proposals/:proposalNo/clarifications",
  "GET /api/scm/:projectId/evaluations", "POST /api/scm/:projectId/evaluations",
  "GET /api/scm/:projectId/bid-reports", "POST /api/scm/:projectId/bid-reports",
  "GET /api/scm/:projectId/koms", "POST /api/scm/:projectId/koms",
  "GET /api/scm/:projectId/inspections", "POST /api/scm/:projectId/inspections",
  "GET /api/scm/:projectId/shipments", "POST /api/scm/:projectId/shipments",
  "GET /api/scm/:projectId/psrs", "POST /api/scm/:projectId/psrs",
  "GET /api/scm/:projectId/warehouses", "POST /api/scm/:projectId/warehouses",
  "GET /api/scm/:projectId/catalog", "POST /api/scm/:projectId/catalog",
  "GET /api/scm/:projectId/mrcs", "POST /api/scm/:projectId/mrcs",
  "GET /api/scm/:projectId/mivs", "POST /api/scm/:projectId/mivs",
  "POST /api/scm/:projectId/mrvs",
  "POST /api/scm/:projectId/transfers",
  "GET /api/scm/:projectId/stock-balances", "POST /api/scm/:projectId/stock-balances",
];

/* ───────────────────────────── repo شبیه‌ساز ───────────────────────────── */

function makeRepo() {
  const tables = new Map();
  let next = 1;
  const rows = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  const matches = (row, where = []) => where.every((condition) => {
    const actual = row[condition.column];
    if (condition.op === "in") return Array.isArray(condition.value) && condition.value.includes(actual);
    if (condition.op === "gte") return actual >= condition.value;
    if (condition.op === "lte") return actual <= condition.value;
    return actual === condition.value;
  });
  const repo = {
    rows,
    async create(table, data, userId = "system") {
      const row = { ...data, Id: data.Id ?? `${table}-${next++}`, CreatedAt: new Date().toISOString(), CreatedBy: userId, RowVersion: 1 };
      rows(table).push(row);
      return row;
    },
    async get(table, id) { return rows(table).find((row) => row.Id === id) ?? null; },
    async findOne(table, where) { return rows(table).find((row) => matches(row, where)) ?? null; },
    async list(table, spec = {}) {
      const out = rows(table).filter((row) => matches(row, spec.where));
      for (const order of [...(spec.orderBy ?? [])].reverse()) {
        out.sort((a, b) => {
          const cmp = a[order.column] === b[order.column] ? 0 : a[order.column] < b[order.column] ? -1 : 1;
          return order.dir === "desc" ? -cmp : cmp;
        });
      }
      return typeof spec.limit === "number" ? out.slice(0, spec.limit) : out;
    },
    async count(table, where = []) { return rows(table).filter((row) => matches(row, where)).length; },
    async patch(table, id, data, userId) {
      const row = rows(table).find((item) => item.Id === id);
      if (!row) return { affected: 0, ok: false, code: "NOT_FOUND" };
      Object.assign(row, data, { UpdatedAt: new Date().toISOString(), UpdatedBy: userId, RowVersion: row.RowVersion + 1 });
      return { affected: 1, ok: true };
    },
    async remove(table, id) {
      const list = rows(table);
      const index = list.findIndex((item) => item.Id === id);
      if (index === -1) return { affected: 0 };
      list.splice(index, 1);
      return { affected: 1 };
    },
  };
  return repo;
}

/** اجرای زنجیرهٔ میان‌افزارها مثل Express. */
async function runStack(stack, req, res) {
  const step = async (index) => {
    const middleware = stack[index];
    if (!middleware) return res;
    let advanced = false;
    const next = () => { advanced = true; return step(index + 1); };
    await middleware(req, res, next);
    return advanced ? res : res;
  };
  return step(0);
}

function makeApi() {
  /* `need()` پیش‌فرض اجرا می‌کند؛ این خط تضمین می‌کند env بیرونی آزمون را شُل نکند. */
  process.env.FIN_RBAC_ENFORCE = "1";
  const handlers = new Map();
  const app = Object.fromEntries(["get", "post", "patch", "delete"].map((method) => [
    method, (path, ...middlewares) => handlers.set(`${method.toUpperCase()} ${path}`, middlewares),
  ]));
  const repo = makeRepo();
  registerScmWorkspaceRoutes(app, { repo: async () => repo, subjects: DEMO_SUBJECTS, evaluate });
  const call = async (method, path, { params = {}, body = {}, headers = {}, requestId = "scm-test" } = {}) => {
    const stack = handlers.get(`${method} ${path}`);
    assert.ok(stack, `مسیر ثبت نشده است: ${method} ${path}`);
    const req = { params, query: {}, body, headers, requestId };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
    await runStack(stack, req, res);
    return res;
  };
  return { repo, handlers, call };
}

/** فراخوانی با بررسی کد وضعیت؛ `projectId` پیش‌فرض c1-p1 است. */
async function expect(call, method, path, options = {}) {
  const res = await call(method, path, {
    params: { projectId: options.projectId ?? PROJECT, ...(options.params ?? {}) },
    body: options.body ?? {},
    headers: options.as === null ? {} : { "x-user-id": options.as ?? PM },
  });
  const want = options.status ?? 200;
  assert.equal(res.statusCode, want,
    `انتظار ${want} بود ولی ${res.statusCode} برگشت: ${JSON.stringify(res.body?.error ?? res.body)}`);
  if (want < 400) {
    assert.equal(res.body.ok, true);
    return res.body.data;
  }
  assert.equal(res.body.ok, false);
  if (options.code) assert.equal(res.body.error.code, options.code, JSON.stringify(res.body.error));
  return res.body.error;
}

/* ═══════════════════════ ۱) قرارداد مسیرها ═══════════════════════ */

test("قرارداد مسیرها: هر ۵۱ مسیر اعلام‌شده ثبت شده است", () => {
  const { handlers } = makeApi();
  assert.equal(handlers.size, SCM_ROUTES.length, `تعداد مسیرها عوض شده: ${handlers.size}`);
  for (const route of SCM_ROUTES) assert.ok(handlers.has(route), `مسیر اعلام‌شده ثبت نشده است: ${route}`);
});

/* ═══════════════════════ ۲) هویت، پروژه و مجوز ═══════════════════════ */

test("بی‌هویت: خواندن و نوشتن SCM ۴۰۱ می‌دهد", async () => {
  const { call } = makeApi();
  await expect(call, "GET", `${BASE}/workspace`, { as: null, status: 401, code: "E-SCM-AUTH-REQUIRED" });
  await expect(call, "POST", `${BASE}/vendors`, { as: null, status: 401, code: "E-SCM-AUTH-REQUIRED", body: { Code: "V1", NameFa: "x" } });
});

test("هویت ناشناخته یا غیرفعال ۴۰۱ می‌گیرد", async () => {
  const { call } = makeApi();
  await expect(call, "GET", `${BASE}/workspace`, { as: "u-nobody", status: 401, code: "E-SCM-AUTH-REQUIRED" });
  await expect(call, "GET", `${BASE}/workspace`, { as: LEFT, status: 401, code: "E-SCM-AUTH-REQUIRED" });
});

test("شناسهٔ پروژهٔ نامعتبر ۴۰۰ می‌گیرد", async () => {
  const { call } = makeApi();
  await expect(call, "GET", `${BASE}/workspace`, { projectId: "bad project!", status: 400, code: "E-SCM-BAD-PROJECT" });
});

test("نقش بی‌مجوز (برنامه‌ریز) ۴۰۳ می‌گیرد", async () => {
  const { call } = makeApi();
  await expect(call, "GET", `${BASE}/workspace`, { as: PLANNER, status: 403, code: "E-SCM-FORBIDDEN" });
  await expect(call, "POST", `${BASE}/warehouses`, { as: PLANNER, status: 403, code: "E-SCM-FORBIDDEN", body: { Code: "W1", NameFa: "x" } });
});

test("ماتریس مجوز SCM — همان که آینهٔ کلاینت (`canScmAccess`) تقلید می‌کند", () => {
  const allowed = (id) => SCM_PERMISSIONS.filter((code) => {
    const subject = DEMO_SUBJECTS.find((item) => item.id === id);
    return subject ? evaluate(subject, code, {}).allow : false;
  });
  assert.deepEqual(allowed(PM), SCM_PERMISSIONS);
  assert.deepEqual(allowed(COST), SCM_PERMISSIONS);
  /* مدیر سامانه مجوز مدیریت MR ندارد؛ رابط کاربری هم دکمهٔ ثبت MR را برایش
   * غیرفعال نشان می‌دهد — همین واگرایی عمدی در اینجا قفل می‌شود. */
  assert.equal(allowed(ADMIN).length, 9);
  assert.ok(!allowed(ADMIN).includes("scm.mr.manage"));
  assert.deepEqual(allowed(PLANNER), []);
});

test("مدیر سامانه بدون scm.mr.manage نمی‌تواند MR بسازد", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/mrs`, {
    as: ADMIN, status: 403, code: "E-SCM-FORBIDDEN", body: { Code: "MR-X", TitleFa: "بدون مجوز" },
  });
});

/* ═══════════════════════ ۳) میز کار تجمیعی ═══════════════════════ */

test("میز کار همهٔ ۲۷ کلید داده را برمی‌گرداند", async () => {
  const { call } = makeApi();
  const data = await expect(call, "GET", `${BASE}/workspace`);
  assert.equal(data.projectId, PROJECT);
  for (const key of [
    "vendors", "avls", "packages", "links", "inquiries", "bidders", "invitations", "mrChanges",
    "mrrs", "mrs", "proposals", "clarifications", "evaluations", "bidReports", "koms",
    "inspections", "shipments", "psrs", "warehouses", "catalog", "mrcs", "mrcLines",
    "mivs", "mivLines", "mrvs", "transfers", "balances",
  ]) {
    assert.ok(Array.isArray(data[key]), `کلید ${key} در پاسخ workspace نیست`);
  }
});

/* ═══════════════════════ ۴) فروشنده و AVL ═══════════════════════ */

test("فروشنده: یکتایی کد، آرایهٔ دیسیپلین و ویرایش وضعیت", async () => {
  const { call, repo } = makeApi();
  await expect(call, "POST", `${BASE}/vendors`, {
    status: 201,
    body: { Code: "V-1", NameFa: "پمپ‌سازی", Disciplines: ["rotating"], MaterialCategories: ["mechanical"], Status: "active" },
  });
  const vendor = repo.rows("ScmVendor")[0];
  assert.deepEqual(vendor.Disciplines, ["rotating"], "آرایهٔ دیسیپلین باید همان‌طور ذخیره شود");
  await expect(call, "POST", `${BASE}/vendors`, { status: 409, code: "E-SCM-DUPLICATE", body: { Code: "V-1", NameFa: "تکراری" } });
  await expect(call, "POST", `${BASE}/vendors`, { status: 400, code: "E-SCM-REQUIRED", body: { Code: "V-2" } });
  await expect(call, "PATCH", `${BASE}/vendors/:code`, {
    params: { code: "V-1" }, status: 400, code: "E-SCM-INVALID-ENUM", body: { Status: "weird" },
  });
  const patched = await expect(call, "PATCH", `${BASE}/vendors/:code`, {
    params: { code: "V-1" }, body: { Status: "blacklisted", NoteFa: "دلیل" },
  });
  assert.equal(patched.Status, "blacklisted");
  assert.equal(patched.NoteFa, "دلیل");
});

test("فروشندهٔ در حال استفاده حذف نمی‌شود؛ پس از حذف AVL حذف می‌شود", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/vendors`, { status: 201, body: { Code: "V-1", NameFa: "پمپ‌سازی" } });
  const avl = await expect(call, "POST", `${BASE}/avl`, {
    status: 201, body: { VendorCode: "V-1", Discipline: "rotating", Status: "approved" },
  });
  await expect(call, "DELETE", `${BASE}/vendors/:code`, { params: { code: "V-1" }, status: 409, code: "E-SCM-VENDOR-IN-USE" });
  await expect(call, "DELETE", `${BASE}/avl/:id`, { params: { id: avl.Id } });
  await expect(call, "DELETE", `${BASE}/vendors/:code`, { params: { code: "V-1" } });
  await expect(call, "DELETE", `${BASE}/vendors/:code`, { params: { code: "V-1" }, status: 404, code: "E-SCM-NOT-FOUND" });
});

test("AVL: فروشندهٔ ناموجود و ردیف تکراری رد می‌شود", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/avl`, {
    status: 400, code: "E-SCM-NO-VENDOR", body: { VendorCode: "V-NOPE", Discipline: "piping" },
  });
  await expect(call, "POST", `${BASE}/vendors`, { status: 201, body: { Code: "V-1", NameFa: "پمپ‌سازی" } });
  await expect(call, "POST", `${BASE}/avl`, { status: 201, body: { VendorCode: "V-1", Discipline: "rotating", MaterialCategory: "mechanical" } });
  await expect(call, "POST", `${BASE}/avl`, {
    status: 409, code: "E-SCM-DUPLICATE", body: { VendorCode: "V-1", Discipline: "rotating", MaterialCategory: "mechanical" },
  });
});

/* ═══════════════════════ ۵) MR، بسته و پیوند ═══════════════════════ */

test("MR: عنوان الزامی و کد یکتا", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/mrs`, { status: 400, code: "E-SCM-REQUIRED", body: { Code: "MR-1" } });
  await expect(call, "POST", `${BASE}/mrs`, {
    status: 201, body: { Code: "MR-1", TitleFa: "لوله", Discipline: "piping", Quantity: 10, Unit: "m" },
  });
  await expect(call, "POST", `${BASE}/mrs`, { status: 409, code: "E-SCM-DUPLICATE", body: { Code: "MR-1", TitleFa: "تکراری" } });
});

test("بستهٔ خرید: وضعیت نامعتبر رد، حذف با پیوند MR مسدود", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/packages`, { status: 201, body: { Code: "PKG-1", TitleFa: "بستهٔ لوله", Currency: "IRR" } });
  await expect(call, "PATCH", `${BASE}/packages/:code`, {
    params: { code: "PKG-1" }, status: 400, code: "E-SCM-INVALID-ENUM", body: { Status: "nowhere" },
  });
  await expect(call, "PATCH", `${BASE}/packages/:code`, { params: { code: "PKG-1" }, body: { Status: "inquiry" } });

  await expect(call, "POST", `${BASE}/mrs`, { status: 201, body: { Code: "MR-1", TitleFa: "لوله" } });
  await expect(call, "POST", `${BASE}/packages/:code/mrs`, {
    params: { code: "PKG-1" }, status: 400, code: "E-SCM-NO-MR", body: { MrCode: "MR-NOPE" },
  });
  await expect(call, "POST", `${BASE}/packages/:code/mrs`, { params: { code: "PKG-1" }, status: 201, body: { MrCode: "MR-1" } });
  await expect(call, "POST", `${BASE}/packages/:code/mrs`, { params: { code: "PKG-1" }, status: 409, code: "E-SCM-DUPLICATE", body: { MrCode: "MR-1" } });
  await expect(call, "DELETE", `${BASE}/packages/:code`, { params: { code: "PKG-1" }, status: 409, code: "E-SCM-PACKAGE-IN-USE" });
  await expect(call, "DELETE", `${BASE}/packages/:code/mrs/:mrCode`, { params: { code: "PKG-1", mrCode: "MR-1" } });
  await expect(call, "DELETE", `${BASE}/packages/:code`, { params: { code: "PKG-1" } });
});

/* ═══════════════════════ ۶) استعلام، مناقصه‌گر و دعوت‌نامه ═══════════════════════ */

/** زنجیرهٔ پایه: فروشنده + AVL + MR + بسته + استعلام. */
async function seedTender(call) {
  await expect(call, "POST", `${BASE}/vendors`, { status: 201, body: { Code: "V-1", NameFa: "پمپ‌سازی" } });
  await expect(call, "POST", `${BASE}/avl`, { status: 201, body: { VendorCode: "V-1", Discipline: "rotating" } });
  await expect(call, "POST", `${BASE}/mrs`, { status: 201, body: { Code: "MR-1", TitleFa: "پمپ" } });
  await expect(call, "POST", `${BASE}/packages`, { status: 201, body: { Code: "PKG-1", TitleFa: "بستهٔ پمپ", Discipline: "rotating" } });
  await expect(call, "POST", `${BASE}/packages/:code/mrs`, { params: { code: "PKG-1" }, status: 201, body: { MrCode: "MR-1" } });
  await expect(call, "POST", `${BASE}/inquiries`, {
    status: 201, body: { Code: "INQ-1", PackageCode: "PKG-1", TitleFa: "استعلام پمپ", InquiryType: "rfq" },
  });
}

test("استعلام: بستهٔ ناموجود رد می‌شود؛ ویرایش وضعیت کار می‌کند", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/inquiries`, {
    status: 400, code: "E-SCM-NO-PACKAGE", body: { Code: "INQ-X", PackageCode: "PKG-NOPE", TitleFa: "x" },
  });
  await seedTender(call);
  await expect(call, "POST", `${BASE}/inquiries`, { status: 409, code: "E-SCM-DUPLICATE", body: { Code: "INQ-1", PackageCode: "PKG-1", TitleFa: "تکراری" } });
  const patched = await expect(call, "PATCH", `${BASE}/inquiries/:code`, { params: { code: "INQ-1" }, body: { Status: "closed" } });
  assert.equal(patched.Status, "closed");
});

test("مناقصه‌گر: SBL نیازمند AVL است، LBL با هشدار سرور عبور می‌کند", async () => {
  const { call } = makeApi();
  await seedTender(call);
  /* فروشندهٔ دوم بدون AVL: در LBL می‌آید، در SBL نه. */
  await expect(call, "POST", `${BASE}/vendors`, { status: 201, body: { Code: "V-2", NameFa: "بدون AVL" } });
  await expect(call, "POST", `${BASE}/inquiries/:code/bidders`, {
    params: { code: "INQ-1" }, status: 400, code: "E-SCM-NOT-AVL", body: { VendorCode: "V-2", ListType: "sbl" },
  });
  await expect(call, "POST", `${BASE}/inquiries/:code/bidders`, {
    params: { code: "INQ-1" }, status: 201, body: { VendorCode: "V-2", ListType: "lbl" },
  });
  await expect(call, "DELETE", `${BASE}/inquiries/:code/bidders/:vendorCode`, { params: { code: "INQ-1", vendorCode: "V-2" } });
  await expect(call, "POST", `${BASE}/inquiries/:code/bidders`, {
    params: { code: "INQ-1" }, status: 201, body: { VendorCode: "V-1", ListType: "sbl" },
  });
  await expect(call, "POST", `${BASE}/inquiries/:code/bidders`, {
    params: { code: "INQ-1" }, status: 409, code: "E-SCM-DUPLICATE", body: { VendorCode: "V-1", ListType: "sbl" },
  });
  await expect(call, "POST", `${BASE}/inquiries/:code/bidders/:vendorCode/ack`, {
    params: { code: "INQ-1", vendorCode: "V-1" }, status: 400, code: "E-SCM-INVALID-ENUM", body: { AckStatus: "maybe" },
  });
  const acked = await expect(call, "POST", `${BASE}/inquiries/:code/bidders/:vendorCode/ack`, {
    params: { code: "INQ-1", vendorCode: "V-1" }, body: { AckStatus: "declined", DeclineReasonFa: "ظرفیت" },
  });
  assert.equal(acked.Status, "declined");
  assert.equal(acked.DeclineReasonFa, "ظرفیت");
});

test("دعوت‌نامه: بدون مناقصه‌گر ثبت نمی‌شود و اعلان تکراری یکتاست", async () => {
  const { call } = makeApi();
  await seedTender(call);
  await expect(call, "POST", `${BASE}/invitations`, {
    status: 400, code: "E-SCM-NO-BIDDER", body: { InquiryCode: "INQ-1", VendorCode: "V-1", InvitationNo: "INV-1" },
  });
  await expect(call, "POST", `${BASE}/inquiries/:code/bidders`, { params: { code: "INQ-1" }, status: 201, body: { VendorCode: "V-1", ListType: "sbl" } });
  await expect(call, "POST", `${BASE}/invitations`, {
    status: 400, code: "E-SCM-INVALID-DATE", body: { InquiryCode: "INQ-1", VendorCode: "V-1", InvitationNo: "INV-1", ValidUntil: "2026-02-30" },
  });
  await expect(call, "POST", `${BASE}/invitations`, {
    status: 201, body: { InquiryCode: "INQ-1", VendorCode: "V-1", InvitationNo: "INV-1", ValidUntil: "2026-12-01" },
  });
  await expect(call, "POST", `${BASE}/invitations`, {
    status: 409, code: "E-SCM-DUPLICATE", body: { InquiryCode: "INQ-1", VendorCode: "V-1", InvitationNo: "INV-1" },
  });
  const acked = await expect(call, "POST", `${BASE}/invitations/:invNo/ack`, {
    params: { invNo: "INV-1" }, body: { AckStatus: "accepted" },
  });
  assert.equal(acked.AckStatus, "accepted");
});

/* ═══════════════════════ ۷) لاگ تغییر MR ═══════════════════════ */

test("لاگ تغییر MR: اعلان تکراری ۴۰۹ و نوع تغییر نامعتبر ۴۰۰", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/mr-changes`, { status: 400, code: "E-SCM-NO-MR", body: { MrCode: "MR-NOPE", ChangeType: "quantity" } });
  await expect(call, "POST", `${BASE}/mrs`, { status: 201, body: { Code: "MR-1", TitleFa: "لوله" } });
  await expect(call, "POST", `${BASE}/mr-changes`, { status: 400, code: "E-SCM-INVALID-ENUM", body: { MrCode: "MR-1", ChangeType: "whatever" } });
  const change = await expect(call, "POST", `${BASE}/mr-changes`, {
    status: 201, body: { MrCode: "MR-1", ChangeType: "quantity", OldValue: "10", NewValue: "12" },
  });
  assert.equal(change.NotifyStatus, "pending");
  const notified = await expect(call, "POST", `${BASE}/mr-changes/:id/notify`, { params: { id: change.Id } });
  assert.equal(notified.NotifyStatus, "notified");
  await expect(call, "POST", `${BASE}/mr-changes/:id/notify`, { params: { id: change.Id }, status: 409, code: "E-SCM-ALREADY-NOTIFIED" });
  await expect(call, "POST", `${BASE}/mr-changes/:id/notify`, { params: { id: "nope" }, status: 404, code: "E-SCM-NOT-FOUND" });
});

/* ═══════════════════════ ۸) پیشنهاد، ارزیابی و گزارش مناقصه ═══════════════════════ */

test("پیشنهاد: استعلام/مناقصه‌گر ناموجود رد می‌شود و شفاف‌سازی پرسش الزامی دارد", async () => {
  const { call } = makeApi();
  await seedTender(call);
  await expect(call, "POST", `${BASE}/proposals`, {
    status: 400, code: "E-SCM-NO-INQ", body: { ProposalNo: "P-1", InquiryCode: "INQ-NOPE", VendorCode: "V-1", Type: "both" },
  });
  await expect(call, "POST", `${BASE}/proposals`, {
    status: 400, code: "E-SCM-NO-BIDDER", body: { ProposalNo: "P-1", InquiryCode: "INQ-1", VendorCode: "V-1", Type: "both" },
  });
  await expect(call, "POST", `${BASE}/inquiries/:code/bidders`, { params: { code: "INQ-1" }, status: 201, body: { VendorCode: "V-1", ListType: "sbl" } });
  await expect(call, "POST", `${BASE}/proposals`, {
    status: 201, body: { ProposalNo: "P-1", InquiryCode: "INQ-1", VendorCode: "V-1", Type: "both", Amount: 1000, Currency: "EUR" },
  });
  await expect(call, "POST", `${BASE}/proposals`, {
    status: 409, code: "E-SCM-DUPLICATE", body: { ProposalNo: "P-1", InquiryCode: "INQ-1", VendorCode: "V-1", Type: "both" },
  });
  await expect(call, "POST", `${BASE}/proposals/:proposalNo/clarifications`, {
    params: { proposalNo: "P-1" }, status: 400, code: "E-SCM-REQUIRED", body: { AnswerFa: "بدون پرسش" },
  });
  const clarification = await expect(call, "POST", `${BASE}/proposals/:proposalNo/clarifications`, {
    params: { proposalNo: "P-1" }, status: 201, body: { QuestionFa: "زمان تحویل؟", AnswerFa: "۶ هفته" },
  });
  assert.equal(clarification.Status, "answered");
});

test("ارزیابی: پیشنهاد ناموجود، امتیاز بیرون از بازه و نتیجهٔ نامعتبر", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/evaluations`, {
    status: 400, code: "E-SCM-NO-PROP", body: { EvalNo: "E-1", ProposalNo: "P-NOPE", Type: "tbe", Result: "pass" },
  });
  await seedTender(call);
  await expect(call, "POST", `${BASE}/inquiries/:code/bidders`, { params: { code: "INQ-1" }, status: 201, body: { VendorCode: "V-1", ListType: "sbl" } });
  await expect(call, "POST", `${BASE}/proposals`, { status: 201, body: { ProposalNo: "P-1", InquiryCode: "INQ-1", VendorCode: "V-1", Type: "both" } });
  await expect(call, "POST", `${BASE}/evaluations`, {
    status: 400, code: "E-SCM-INVALID-NUMBER", body: { EvalNo: "E-1", ProposalNo: "P-1", Type: "tbe", Score: 120, Result: "pass" },
  });
  await expect(call, "POST", `${BASE}/evaluations`, {
    status: 400, code: "E-SCM-INVALID-ENUM", body: { EvalNo: "E-1", ProposalNo: "P-1", Type: "tbe", Result: "banana" },
  });
  await expect(call, "POST", `${BASE}/evaluations`, {
    status: 201, body: { EvalNo: "E-1", ProposalNo: "P-1", Type: "tbe", Score: 85, Result: "pass" },
  });
  await expect(call, "POST", `${BASE}/bid-reports`, {
    status: 400, code: "E-SCM-NO-INQ", body: { ReportNo: "BR-1", InquiryCode: "INQ-NOPE" },
  });
  await expect(call, "POST", `${BASE}/bid-reports`, {
    status: 201, body: { ReportNo: "BR-1", InquiryCode: "INQ-1", WinnerVendorCode: "V-1", TotalAmount: 1000, Currency: "EUR" },
  });
});

/* ═══════════════════════ ۹) KOM و PSR ═══════════════════════ */

test("KOM و PSR: تاریخ و درصد پیشرفت اعتبارسنجی می‌شوند", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/koms`, { status: 400, code: "E-SCM-INVALID-DATE", body: { KomNo: "K-1", Type: "kom", MeetingDate: "2026-13-01" } });
  await expect(call, "POST", `${BASE}/koms`, { status: 400, code: "E-SCM-INVALID-ENUM", body: { KomNo: "K-1", Type: "party", MeetingDate: "2026-12-01" } });
  await expect(call, "POST", `${BASE}/koms`, { status: 201, body: { KomNo: "K-1", Type: "kom", MeetingDate: "2026-12-01", Status: "scheduled" } });
  await expect(call, "POST", `${BASE}/psrs`, { status: 400, code: "E-SCM-INVALID-NUMBER", body: { PsrNo: "PSR-1", ProgressPct: 140, ReportDate: "2026-12-31" } });
  await expect(call, "POST", `${BASE}/psrs`, { status: 201, body: { PsrNo: "PSR-1", ProgressPct: 40, ReportDate: "2026-12-31" } });
});

/* ═══════════════════════ ۱۰) انبار و اثر اسناد بر موجودی ═══════════════════════ */

/** انبار + کالا + ماندهٔ اولیه (۱۰ عدد در W1). */
async function seedStock(call) {
  await expect(call, "POST", `${BASE}/warehouses`, { status: 201, body: { Code: "W1", NameFa: "انبار مرکزی" } });
  await expect(call, "POST", `${BASE}/warehouses`, { status: 201, body: { Code: "W2", NameFa: "انبار پای‌خط" } });
  await expect(call, "POST", `${BASE}/catalog`, { status: 201, body: { Code: "M1", NameFa: "پمپ", Unit: "EA" } });
  await expect(call, "POST", `${BASE}/stock-balances`, {
    status: 201, body: { WarehouseCode: "W1", MaterialCode: "M1", OnHand: 10, Reserved: 2, OnOrder: 3 },
  });
}

test("انبار و کاتالوگ: کد یکتا و نام الزامی", async () => {
  const { call } = makeApi();
  await expect(call, "POST", `${BASE}/warehouses`, { status: 400, code: "E-SCM-REQUIRED", body: { Code: "W1" } });
  await expect(call, "POST", `${BASE}/warehouses`, { status: 201, body: { Code: "W1", NameFa: "انبار" } });
  await expect(call, "POST", `${BASE}/warehouses`, { status: 409, code: "E-SCM-DUPLICATE", body: { Code: "W1", NameFa: "تکراری" } });
  await expect(call, "POST", `${BASE}/catalog`, { status: 400, code: "E-SCM-INVALID-CODE", body: { Code: "کد فارسی", NameFa: "کالا" } });
  await expect(call, "POST", `${BASE}/catalog`, { status: 201, body: { Code: "M1", NameFa: "پمپ" } });
});

test("ماندهٔ موجودی: ردیف تکراری ساخته نمی‌شود و فقط «روی دست» به‌روز می‌شود", async () => {
  const { call, repo } = makeApi();
  await seedStock(call);
  await expect(call, "POST", `${BASE}/stock-balances`, {
    status: 200, body: { WarehouseCode: "W1", MaterialCode: "M1", OnHand: 25, Reserved: 9, OnOrder: 9 },
  });
  const rows = repo.rows("ScmStockBalance");
  assert.equal(rows.length, 1, "به‌روزرسانی نباید ردیف تازه بسازد");
  assert.equal(rows[0].OnHand, 25);
  assert.equal(rows[0].Reserved, 2, "سرور در ردیف موجود فقط OnHand را عوض می‌کند");
  assert.equal(rows[0].OnOrder, 3);
});

test("MRC سر و قلم را با هم می‌سازد", async () => {
  const { call, repo } = makeApi();
  await seedStock(call);
  await expect(call, "POST", `${BASE}/mrcs`, {
    status: 201,
    body: { MrcNo: "MRC-1", RequiredDate: "2026-11-05", Lines: [{ MaterialCode: "M1", Quantity: 2 }] },
  });
  assert.equal(repo.rows("ScmMrc").length, 1);
  assert.equal(repo.rows("ScmMrcLine").length, 1);
  assert.equal(repo.rows("ScmMrcLine")[0].ReservedQty, 0);
});

test("حوالهٔ مصرف موجودی را کم می‌کند و انبار ناموجود رد می‌شود", async () => {
  const { call, repo } = makeApi();
  await seedStock(call);
  await expect(call, "POST", `${BASE}/mivs`, {
    status: 400, code: "E-SCM-NO-WH", body: { MivNo: "MIV-1", WarehouseCode: "W-NOPE", IssuedAt: "2026-11-10" },
  });
  await expect(call, "POST", `${BASE}/mivs`, {
    status: 201,
    body: { MivNo: "MIV-1", WarehouseCode: "W1", IssuedAt: "2026-11-10", Lines: [{ MaterialCode: "M1", Quantity: 4 }] },
  });
  const balance = repo.rows("ScmStockBalance")[0];
  assert.equal(balance.OnHand, 6, "۴ عدد حواله باید از ۱۰ کم شود");
  assert.equal(repo.rows("ScmMivLine").length, 1);
  /* حوالهٔ بیش از موجودی، عدد منفی نمی‌سازد (سرور کف صفر می‌گذارد). */
  await expect(call, "POST", `${BASE}/mivs`, {
    status: 201, body: { MivNo: "MIV-2", WarehouseCode: "W1", IssuedAt: "2026-11-11", Lines: [{ MaterialCode: "M1", Quantity: 99 }] },
  });
  assert.equal(repo.rows("ScmStockBalance")[0].OnHand, 0);
});

test("مرجوعی عمداً روی موجودی اثر ندارد (رفتار فعلی سرور)", async () => {
  const { call, repo } = makeApi();
  await seedStock(call);
  await expect(call, "POST", `${BASE}/mrvs`, {
    status: 201, body: { MrvNo: "MRV-1", WarehouseCode: "W1", ReturnedAt: "2026-11-12" },
  });
  assert.equal(repo.rows("ScmStockBalance")[0].OnHand, 10, "MRV فقط سابقه است و موجودی را برنمی‌گرداند");
});

test("انتقال بین انبار: مبدأ کم، مقصد زیاد و ردیف مقصد در نبود ساخته می‌شود", async () => {
  const { call, repo } = makeApi();
  await seedStock(call);
  await expect(call, "POST", `${BASE}/transfers`, {
    status: 201,
    body: { TransferNo: "TR-1", FromWarehouse: "W1", ToWarehouse: "W2", MaterialCode: "M1", Quantity: 3, TransferredAt: "2026-11-13" },
  });
  const balances = repo.rows("ScmStockBalance");
  assert.equal(balances.find((row) => row.WarehouseCode === "W1").OnHand, 7);
  const target = balances.find((row) => row.WarehouseCode === "W2");
  assert.equal(target.OnHand, 3, "ردیف مقصد باید ساخته شود");
});

/* ═══════════════════════ ۱۱) رسید مواد (MRR/OPI) ═══════════════════════ */

test("رسید مواد: PO ناموجود، OPI خودکار، ویرایش وضعیت و ممیزی", async () => {
  const { call, repo } = makeApi();
  await expect(call, "POST", `${BASE}/mrrs`, {
    status: 400, code: "E-SCM-NO-PO", body: { Code: "MRR-1", PoNo: "PO-NOPE", ReceivedAt: "2026-12-01" },
  });
  /* پیش‌نیاز: سفارش خرید در میز کار هزینه (جدول همان پروژه). */
  await repo.create("PurchaseOrder", { ProjectId: PROJECT, PoNo: "PO-1" }, "u-cost");
  const receipt = await expect(call, "POST", `${BASE}/mrrs`, {
    status: 201,
    body: { Code: "MRR-1", PoNo: "PO-1", ReceivedAt: "2026-12-01", Quantity: 10, AcceptedQty: 8, DamageQty: 2, Status: "draft" },
  });
  assert.equal(receipt.OpiType, "damage", "OPI باید از مقادیر مغایرت درآید");
  await expect(call, "PATCH", `${BASE}/mrrs/:code`, {
    params: { code: "MRR-1" }, status: 400, code: "E-SCM-INVALID-ENUM", body: { Status: "half" },
  });
  const accepted = await expect(call, "PATCH", `${BASE}/mrrs/:code`, { params: { code: "MRR-1" }, body: { Status: "accepted" } });
  assert.equal(accepted.Status, "accepted");
  assert.ok(repo.rows("AuditLog").some((row) => row.Action === "SCM_MRR_CREATED"), "ثبت رسید باید ممیزی شود");
  assert.ok(repo.rows("AuditLog").some((row) => row.Action === "SCM_MRR_UPDATED"), "ویرایش رسید باید ممیزی شود");
});

/* ═══════════════════════ ۱۲) بازرسی و حمل ═══════════════════════ */

test("بازرسی و حمل: enum و تاریخ اعتبارسنجی می‌شوند", async () => {
  const { call, repo } = makeApi();
  await repo.create("PurchaseOrder", { ProjectId: PROJECT, PoNo: "PO-1" }, "u-cost");
  await expect(call, "POST", `${BASE}/inspections`, {
    status: 400, code: "E-SCM-INVALID-ENUM", body: { InspectionNo: "INS-1", Type: "holiday", InspectionDate: "2026-12-20", Result: "pass" },
  });
  await expect(call, "POST", `${BASE}/inspections`, {
    status: 400, code: "E-SCM-INVALID-DATE", body: { InspectionNo: "INS-1", Type: "factory", InspectionDate: "2026-02-30", Result: "pass" },
  });
  await expect(call, "POST", `${BASE}/inspections`, {
    status: 201, body: { InspectionNo: "INS-1", PoNo: "PO-1", Type: "factory", InspectionDate: "2026-12-20", Result: "pass", ReleaseNoteNo: "RN-1" },
  });
  await expect(call, "POST", `${BASE}/shipments`, {
    status: 400, code: "E-SCM-INVALID-ENUM", body: { ShipmentNo: "SHP-1", Mode: "teleport" },
  });
  await expect(call, "POST", `${BASE}/shipments`, {
    status: 201, body: { ShipmentNo: "SHP-1", Mode: "sea", OriginFa: "شانگهای", EtaDate: "2027-01-20" },
  });
});

/* ═══════════════════════ ۱۳) ماندگاری و مارک ممیزی ═══════════════════════ */

test("هر ردیف SCM به پروژهٔ همان مسیر گره می‌خورد", async () => {
  const { call, repo } = makeApi();
  await expect(call, "POST", `${BASE}/warehouses`, { status: 201, body: { Code: "W1", NameFa: "انبار" } });
  await expect(call, "POST", `${BASE}/mrs`, { status: 201, body: { Code: "MR-1", TitleFa: "لوله" } });
  for (const table of ["ScmWarehouse", "MaterialRequest"]) {
    assert.equal(repo.rows(table)[0].ProjectId, PROJECT, `ردیف ${table} باید ProjectId داشته باشد`);
  }
});
