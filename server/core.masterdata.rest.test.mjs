/**
 * آزمون REST دادهٔ پایهٔ سامانه — `/api/industries` و `/api/projects`.
 *
 * چرا این فایل لازم شد: این دو منبع تا پیش از این فقط نسخهٔ SQL Server
 * داشتند (`getPool(req)` + `dbo.Industry_Master` / `dbo.Project_Master`).
 * در استقرار بدون SQL Server، خواندن ۵۰۰ می‌داد و نوشتن بی‌صدا به فروشگاه
 * دیگری می‌رفت؛ یعنی مرورگر یک چیز می‌گفت و سرور چیز دیگری داشت. حالا هر دو
 * روی لایهٔ ماندگاری مشترک‌اند و همین آزمون چهار چیز را قفل می‌کند:
 *
 *   ۱) قرارداد مسیرها: هرچه اعلام شده ثبت شده باشد.
 *   ۲) مجوز و محدوده: چه کسی می‌تواند بخواند/بسازد/ویرایش کند.
 *   ۳) قواعد کسب‌وکار: کد تکراری، خوشهٔ دارای پروژه، تاریخ‌های ناسازگار.
 *   ۴) صداقت داده: پیشرفتِ محاسبه‌شده (نه صفرِ ساختگی) و اعلام فیلدهای
 *      نادیده‌گرفته‌شده به‌جای دور ریختن بی‌صدای آن‌ها.
 *
 * این آزمون ریاضیِ پیشرفت را نمی‌سنجد؛ فقط بررسی می‌کند که HTTP همان عددی
 * را برمی‌گرداند که از ردیف‌های `Activity` درمی‌آید.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { MASTER_DATA_ROUTES, MASTER_DATA_VERSION, registerMasterDataRoutes } from "./masterDataApi.js";
import { DEMO_SUBJECTS, evaluate } from "./rbacLogic.js";

const ADMIN = "u-admin";            // sys.config.manage و core.project.edit (دامنهٔ ستاره)
const PM = "u-pm";                  // core.project.edit با دامنهٔ c1-p1 و c1-p2
const COST = "u-cost";              // فقط خواندن، دامنهٔ c1-p1
/** کاربر ساختگیِ خوشهٔ دیگر — برای آزمودن محدودهٔ پروژه. */
const OTHER = "u-core-other-test";

function makeRepo() {
  const tables = new Map();
  let next = 1;
  const rows = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  const matches = (row, where = []) => where.every((w) => {
    const actual = row[w.column];
    if (w.op === "in") return Array.isArray(w.value) && w.value.includes(actual);
    if (w.op === "gte") return actual >= w.value;
    if (w.op === "lte") return actual <= w.value;
    return actual === w.value;
  });
  const repo = {
    tables,
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
      return out;
    },
    async count(table, where = []) { return rows(table).filter((row) => matches(row, (where))).length; },
    async patch(table, id, data, userId, expectedRowVersion) {
      const row = rows(table).find((item) => item.Id === id);
      if (!row) return { affected: 0, ok: false, code: "NOT_FOUND" };
      if (expectedRowVersion !== undefined && row.RowVersion !== expectedRowVersion) {
        return { affected: 0, ok: false, code: "CONCURRENCY_CONFLICT" };
      }
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

/** اجرای زنجیرهٔ میان‌افزارها مثل Express: هر لایه با `next()` بعدی را صدا می‌زند. */
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
  const handlers = new Map();
  const app = Object.fromEntries(["get", "post", "patch", "delete"].map((method) => [
    method, (path, ...middlewares) => handlers.set(`${method.toUpperCase()} ${path}`, middlewares),
  ]));
  const repo = makeRepo();
  const subjects = [...DEMO_SUBJECTS, {
    id: OTHER, displayName: "مدیر پروژهٔ خوشهٔ دیگر (آزمایشی)",
    roles: ["project_manager"], projectIds: ["c3-p1"], active: true, party: "contractor",
  }];
  registerMasterDataRoutes(app, { repo: async () => repo, subjects, evaluate });
  const call = async (method, path, { params = {}, query = {}, body = {}, headers = {}, requestId = "core-md-test" } = {}) => {
    const stack = handlers.get(`${method} ${path}`);
    assert.ok(stack, `مسیر ثبت نشده است: ${method} ${path}`);
    const req = { params, query, body, headers, requestId };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
      end() { return this; },
    };
    await runStack(stack, req, res);
    return res;
  };
  return { repo, handlers, call };
}

/** فراخوانی و بررسی کد وضعیت. */
async function expect(call, method, path, options = {}) {
  const res = await call(method, path, {
    params: options.params ?? {},
    query: options.query,
    body: options.body,
    headers: { ...(options.as === null ? {} : { "x-user-id": options.as ?? ADMIN }), ...options.headers },
  });
  assert.equal(res.statusCode, options.status ?? 200,
    `انتظار ${options.status ?? 200} بود ولی ${res.statusCode} برگشت: ${JSON.stringify(res.body?.error ?? res.body)}`);
  if (options.status === undefined || options.status < 400) {
    assert.equal(res.body.ok, true);
    return { data: res.body.data, meta: res.body.meta };
  }
  assert.equal(res.body.ok, false);
  if (options.code) assert.equal(res.body.error.code, options.code, JSON.stringify(res.body.error));
  return res.body.error;
}

/**
 * خوشه + دو پروژهٔ پایه، همه از مسیر REST واقعی.
 *
 * خوشه را `u-admin` می‌سازد (`sys.config.manage`) و پروژه‌ها را `u-pm`
 * (`core.project.edit`) — همان تفکیک نقشی که در سامانه هست.
 */
async function seedBase(call) {
  await expect(call, "POST", "/api/industries", {
    status: 201, body: { Id: "c1", code: "c1", titleFa: "نفت و گاز", titleEn: "Oil & Gas", icon: "🛢", color: "#7FB2FF", isActive: true },
  });
  for (const [index, code] of ["OG-2401", "OG-2402"].entries()) {
    await expect(call, "POST", "/api/projects", {
      as: PM, status: 201,
      body: {
        Id: `c1-p${index + 1}`, industryId: "c1", code,
        nameFa: `پروژهٔ نمونهٔ ${index + 1}`, status: "active",
        startDate: "2026-01-01", finishDate: "2027-06-30",
      },
    });
  }
}

/** خوشهٔ دوم با یک پروژه — برای آزمودن محدوده و صافی خوشه. */
async function seedCluster3(call) {
  await expect(call, "POST", "/api/industries", { status: 201, body: { Id: "c3", code: "c3", titleFa: "نیرو و انرژی" } });
  await expect(call, "POST", "/api/projects", {
    as: OTHER, status: 201,
    body: { Id: "c3-p1", industryId: "c3", code: "PE-2401", nameFa: "نیروگاه" },
  });
}

/* ─────────────────────── ۱) قرارداد مسیرها ─────────────────────── */

test("قرارداد مسیرها: همهٔ مسیرهای اعلام‌شده ثبت شده‌اند", () => {
  const { handlers } = makeApi();
  for (const route of MASTER_DATA_ROUTES) {
    assert.ok(handlers.has(route), `مسیر اعلام‌شده ثبت نشده است: ${route}`);
  }
  assert.equal(handlers.size, MASTER_DATA_ROUTES.length, "مسیر ثبت‌شدهٔ اضافه‌ای هست که اعلام نشده است");
  assert.equal(MASTER_DATA_VERSION, "core-masterdata-v1");
});

/* ─────────────────────── ۲) هویت و مجوز ─────────────────────── */

test("بدون هویت: خواندن دادهٔ پایه ۴۰۱ می‌دهد", async () => {
  const { call } = makeApi();
  await expect(call, "GET", "/api/industries", { as: null, status: 401, code: "CORE_AUTH_REQUIRED" });
  await expect(call, "GET", "/api/projects", { as: null, status: 401, code: "CORE_AUTH_REQUIRED" });
  await expect(call, "POST", "/api/industries", { as: null, status: 401, body: { code: "cx", titleFa: "x" } });
});

test("هویت ناموجود یا غیرفعال ۴۰۱ می‌گیرد", async () => {
  const { call } = makeApi();
  await expect(call, "GET", "/api/industries", { as: "u-nobody", status: 401, code: "CORE_AUTH_REQUIRED" });
  await expect(call, "GET", "/api/industries", { as: "u-left", status: 401, code: "CORE_AUTH_REQUIRED" });
});

test("ساخت خوشه بدون sys.config.manage ممنوع است", async () => {
  const { call } = makeApi();
  await expect(call, "POST", "/api/industries", {
    as: PM, status: 403, code: "CORE_FORBIDDEN", body: { code: "c9", titleFa: "خوشهٔ آزمون" },
  });
  await expect(call, "PATCH", "/api/industries/:id", {
    as: PM, params: { id: "c1" }, status: 403, code: "CORE_FORBIDDEN", body: { titleFa: "تغییر" },
  });
});

/* ─────────────────────── ۳) خوشه‌ها ─────────────────────── */

test("ساخت خوشه: ۲۰۱ با DTO کامل + جلوگیری از کد تکراری و کد نامعتبر", async () => {
  const { call } = makeApi();
  const { data } = await expect(call, "POST", "/api/industries", {
    status: 201,
    body: { Id: "c1", code: "c1", titleFa: "نفت و گاز", titleEn: "Oil & Gas", icon: "🛢", color: "#7FB2FF", isActive: true },
  });
  assert.deepEqual(Object.keys(data).sort(), ["code", "color", "icon", "id", "isActive", "titleEn", "titleFa"].sort());
  assert.equal(data.id, "c1");
  assert.equal(data.isActive, true);

  await expect(call, "POST", "/api/industries", {
    status: 409, code: "CORE_DUPLICATE", body: { code: "c1", titleFa: "تکراری" },
  });
  await expect(call, "POST", "/api/industries", {
    status: 400, code: "CORE_VALIDATION_FAILED", body: { code: "خوشهٔ بد", titleFa: "نامعتبر" },
  });
  await expect(call, "POST", "/api/industries", {
    status: 400, code: "CORE_VALIDATION_FAILED", body: { code: "c7" },
  });
});

test("ویرایش خوشه با «کد» خوشه انجام می‌شود، نه فقط کلید فنی ردیف", async () => {
  const { call } = makeApi();
  await seedBase(call);
  const { data } = await expect(call, "PATCH", "/api/industries/:id", {
    params: { id: "c1" }, body: { titleEn: "Oil & Gas Upstream", color: "#38BDF8" },
  });
  assert.equal(data.titleEn, "Oil & Gas Upstream");
  assert.equal(data.color, "#38BDF8");
  assert.equal(data.titleFa, "نفت و گاز", "فیلدهای به‌روزنشده نباید پاک شوند");

  await expect(call, "PATCH", "/api/industries/:id", {
    params: { id: "c1" }, status: 400, code: "CORE_VALIDATION_FAILED", body: { code: "c2" },
  });
  await expect(call, "PATCH", "/api/industries/:id", {
    params: { id: "c9" }, status: 404, code: "CORE_NOT_FOUND", body: { titleFa: "نیست" },
  });
  await expect(call, "PATCH", "/api/industries/:id", {
    params: { id: "c1" }, status: 400, code: "CORE_VALIDATION_FAILED", body: {},
  });
});

test("خوشهٔ دارای پروژه حذف نمی‌شود؛ خالی فقط غیرفعال می‌شود", async () => {
  const { call, repo } = makeApi();
  await seedBase(call);
  await expect(call, "DELETE", "/api/industries/:id", {
    params: { id: "c1" }, status: 409, code: "CORE_INDUSTRY_HAS_PROJECTS",
  });
  const projects = await repo.list("Project", {});
  assert.equal(projects.length, 2, "حذف ناموفق نباید پروژه‌ها را دست بزند");

  await expect(call, "POST", "/api/industries", { status: 201, body: { Id: "c2", code: "c2", titleFa: "پتروشیمی" } });
  const { data } = await expect(call, "DELETE", "/api/industries/:id", { params: { id: "c2" } });
  assert.equal(data.isActive, false);
  assert.equal(data.deactivated, true);
  assert.equal(data.deleted, false, "حذف فیزیکی انجام نمی‌شود؛ رکوردهای تاریخی به خوشه ارجاع دارند");
  const still = await repo.get("Industry", "c2");
  assert.ok(still, "ردیف خوشه باید بماند");
  assert.equal(still.IsActive, false);
});

/* ─────────────────────── ۴) پروژه‌ها ─────────────────────── */

test("ساخت پروژه: خوشهٔ ناشناخته، فیلد ناقص و تاریخ ناسازگار ۴۰۰ می‌گیرند", async () => {
  const { call } = makeApi();
  await seedBase(call);
  await expect(call, "POST", "/api/projects", {
    as: PM, status: 400, code: "CORE_UNKNOWN_INDUSTRY",
    body: { industryId: "cX", code: "XX-1", nameFa: "پروژه" },
  });
  await expect(call, "POST", "/api/projects", {
    as: PM, status: 400, code: "CORE_VALIDATION_FAILED",
    body: { industryId: "c1", code: "OG-2409" },
  });
  await expect(call, "POST", "/api/projects", {
    as: PM, status: 400, code: "CORE_VALIDATION_FAILED",
    body: { industryId: "c1", code: "OG-2409", nameFa: "پروژه", startDate: "2026-06-01", finishDate: "2026-01-01" },
  });
  await expect(call, "POST", "/api/projects", {
    as: PM, status: 400, code: "CORE_VALIDATION_FAILED",
    body: { industryId: "c1", code: "OG-2409", nameFa: "پروژه", startDate: "1405/01/01" },
  });
});

test("ساخت پروژه: کد تکراری ۴۰۹ و ثبت موفق ۲۰۱ با پیشرفت اعلام‌شده", async () => {
  const { call } = makeApi();
  await seedBase(call);
  await expect(call, "POST", "/api/projects", {
    as: PM, status: 409, code: "CORE_DUPLICATE",
    body: { industryId: "c1", code: "OG-2401", nameFa: "تکراری" },
  });
  const { data, meta } = await expect(call, "POST", "/api/projects", {
    as: PM, status: 201,
    body: {
      Id: "c1-p9", industryId: "c1", code: "OG-2409", nameFa: "پروژهٔ نهم",
      budget: 1_500_000_000, status: "tender", startDate: "2026-03-01", finishDate: "2027-03-01",
    },
  });
  assert.equal(data.id, "c1-p9");
  assert.equal(data.industryId, "c1", "industryId در پاسخ باید کد خوشه باشد، نه کلید فنی جدول");
  assert.equal(data.status, "tender");
  assert.equal(data.budget, 1_500_000_000);
  assert.equal(data.progress, null, "بدون فعالیت، پیشرفت باید null باشد نه صفر");
  assert.equal(data.progressBasis, "none");
  assert.equal(meta.version, MASTER_DATA_VERSION);
});

test("محدودهٔ پروژه: نقش محدود فقط در خوشهٔ خودش پروژه می‌سازد", async () => {
  const { call } = makeApi();
  await seedBase(call);
  await expect(call, "POST", "/api/projects", {
    as: PM, status: 201,
    body: { Id: "c1-p3", industryId: "c1", code: "OG-2403", nameFa: "پروژهٔ سوم" },
  });
  await expect(call, "POST", "/api/projects", {
    as: OTHER, status: 403, code: "CORE_PROJECT_SCOPE",
    body: { Id: "c1-p4", industryId: "c1", code: "OG-2404", nameFa: "بیرون از محدوده" },
  });
});

test("سازندهٔ پروژه پس از راه‌اندازی خوشه، اجازهٔ ویرایش همان پروژه را دارد", async () => {
  const { call } = makeApi();
  await seedBase(call);
  await expect(call, "POST", "/api/industries", { status: 201, body: { Id: "c4", code: "c4", titleFa: "حفاری و اکتشاف" } });
  await expect(call, "POST", "/api/projects", {
    as: PM, status: 201,
    body: { Id: "c4-p1", industryId: "c4", code: "DR-2401", nameFa: "پروژهٔ حفاری" },
  });
  const { data } = await expect(call, "PATCH", "/api/projects/:id", {
    as: PM, params: { id: "c4-p1" }, body: { status: "active" },
  });
  assert.equal(data.status, "active");
});

test("خوشهٔ خالی: نخستین پروژه از راه REST ساخته می‌شود، پروژهٔ بعدی فقط در محدوده", async () => {
  const { call } = makeApi();
  await seedBase(call);
  await expect(call, "POST", "/api/industries", { status: 201, body: { Id: "c4", code: "c4", titleFa: "حفاری و اکتشاف" } });

  /* خوشهٔ تازه پروژه ندارد؛ پس اولین پروژه مجاز است (وگرنه راه‌اندازی
   * خوشه فقط از در پشتیِ جدول ممکن بود). */
  await expect(call, "POST", "/api/projects", {
    as: PM, status: 201,
    body: { Id: "c4-p1", industryId: "c4", code: "DR-2401", nameFa: "پروژهٔ حفاری" },
  });
  /* حالا که خوشه پروژه دارد و آن پروژه بیرون از محدودهٔ این کاربر است،
   * پروژهٔ دوم رد می‌شود. */
  await expect(call, "POST", "/api/projects", {
    as: OTHER, status: 403, code: "CORE_PROJECT_SCOPE",
    body: { Id: "c4-p2", industryId: "c4", code: "DR-2402", nameFa: "پروژهٔ دوم حفاری" },
  });
});

test("فهرست پروژه‌ها: فیلتر خوشه + محدودهٔ مشاهدهٔ کاربر", async () => {
  const { call } = makeApi();
  await seedBase(call);
  await seedCluster3(call);

  const all = await expect(call, "GET", "/api/projects", { query: { pageSize: "50" } });
  assert.equal(all.data.total, 3);
  assert.ok(all.data.items.every((row) => typeof row.id === "string"));

  const onlyC1 = await expect(call, "GET", "/api/projects", { query: { industryId: "c1" } });
  assert.equal(onlyC1.data.total, 2);
  assert.ok(onlyC1.data.items.every((row) => row.industryId === "c1"));

  const unknown = await expect(call, "GET", "/api/projects", { query: { industryId: "cZ" } });
  assert.equal(unknown.data.total, 0);
  assert.equal(unknown.data.items.length, 0);

  /* مدیر پروژهٔ c1-p1 فقط همان را می‌بیند؛ حسابدار هزینه هم. */
  const scoped = await expect(call, "GET", "/api/projects", { as: "u-cost" });
  assert.equal(scoped.data.total, 1);
  assert.equal(scoped.data.items[0].id, "c1-p1");

  const search = await expect(call, "GET", "/api/projects", { query: { search: "OG-2402" } });
  assert.equal(search.data.total, 1);
  assert.equal(search.data.items[0].code, "OG-2402");
});

test("فهرست خوشه‌ها: کاربر محدود فقط خوشه‌های در محدودهٔ خودش را می‌بیند", async () => {
  const { call } = makeApi();
  await seedBase(call);
  await seedCluster3(call);

  const admin = await expect(call, "GET", "/api/industries");
  assert.equal(admin.data.total, 2);

  const scoped = await expect(call, "GET", "/api/industries", { as: "u-cost" });
  assert.equal(scoped.data.total, 1);
  assert.equal(scoped.data.items[0].code, "c1");

  /* خوشهٔ غیرفعال به‌طور پیش‌فرض نمی‌آید ولی با includeInactive می‌آید. */
  await expect(call, "POST", "/api/industries", { status: 201, body: { Id: "c5", code: "c5", titleFa: "زیرساخت" } });
  await expect(call, "DELETE", "/api/industries/:id", { params: { id: "c5" } });
  const active = await expect(call, "GET", "/api/industries");
  assert.equal(active.data.total, 2);
  const withInactive = await expect(call, "GET", "/api/industries", { query: { includeInactive: "1" } });
  assert.equal(withInactive.data.total, 3);
});

test("ویرایش پروژه: خارج از محدوده ۴۰۳، کد تکراری/تغییر کد ۴۰۰", async () => {
  const { call } = makeApi();
  await seedBase(call);
  const { data } = await expect(call, "PATCH", "/api/projects/:id", {
    as: PM, params: { id: "c1-p1" }, body: { status: "completed", budget: 123 },
  });
  assert.equal(data.status, "completed");
  assert.equal(data.budget, 123);

  await expect(call, "PATCH", "/api/projects/:id", {
    as: PM, params: { id: "c1-p1" }, status: 400, code: "CORE_VALIDATION_FAILED", body: { code: "OG-9999" },
  });
  await expect(call, "PATCH", "/api/projects/:id", {
    params: { id: "c1-p2" }, as: "u-over", status: 403, code: "CORE_PROJECT_SCOPE",
    body: { status: "stopped" },
  });
  await expect(call, "PATCH", "/api/projects/:id", {
    params: { id: "c1-p1" }, as: "u-consultant", status: 403, code: "CORE_FORBIDDEN",
    body: { status: "stopped" },
  });
  await expect(call, "PATCH", "/api/projects/:id", {
    as: PM, params: { id: "c1-p9" }, status: 404, code: "CORE_NOT_FOUND", body: { status: "active" },
  });
  await expect(call, "PATCH", "/api/projects/:id", {
    as: PM, params: { id: "c1-p1" }, status: 400, code: "CORE_VALIDATION_FAILED", body: { status: "archived" },
  });
  await expect(call, "PATCH", "/api/projects/:id", {
    params: { id: "c1-p1" }, status: 403, code: "CORE_FORBIDDEN", as: "u-cost", body: { status: "active" },
  });
});

/* ─────────────────────── ۵) صداقت داده ─────────────────────── */

test("پیشرفت پروژه از فعالیت‌های خودش و به وزن BudgetMh محاسبه می‌شود", async () => {
  const { call, repo } = makeApi();
  await seedBase(call);
  await repo.create("Activity", { Id: "A1", ProjectId: "c1-p1", Code: "A1", PhysicalPct: 40, BudgetMh: 2400 });
  await repo.create("Activity", { Id: "A2", ProjectId: "c1-p1", Code: "A2", PhysicalPct: 25, BudgetMh: 1800 });

  const { data } = await expect(call, "GET", "/api/projects", { query: { industryId: "c1" } });
  const first = data.items.find((row) => row.id === "c1-p1");
  /* (40×2400 + 25×1800) ÷ (2400+1800) = 33.57 */
  assert.equal(first.progress, 33.57);
  assert.equal(first.progressBasis, "activity_mh_weighted");

  const second = data.items.find((row) => row.id === "c1-p2");
  assert.equal(second.progress, null, "پروژهٔ بدون فعالیت نباید صفرِ ساختگی بگیرد");
  assert.equal(second.progressBasis, "none");
});

test("بدون وزن‌ها، میانگین ساده گرفته می‌شود و مبنا هم اعلام می‌شود", async () => {
  const { call, repo } = makeApi();
  await seedBase(call);
  await repo.create("Activity", { Id: "A1", ProjectId: "c1-p1", PhysicalPct: 10 });
  await repo.create("Activity", { Id: "A2", ProjectId: "c1-p1", PhysicalPct: 32 });

  const { data } = await expect(call, "GET", "/api/projects", { query: { industryId: "c1" } });
  const first = data.items.find((row) => row.id === "c1-p1");
  assert.equal(first.progress, 21);
  assert.equal(first.progressBasis, "activity_average");
});

test("فیلدهای نادیده‌گرفته‌شده اعلام می‌شوند، نه اینکه بی‌صدا دور ریخته شوند", async () => {
  const { call } = makeApi();
  await seedBase(call);
  const { data, meta } = await expect(call, "POST", "/api/projects", {
    as: PM, status: 201,
    body: {
      Id: "c1-p5", industryId: "c1", code: "OG-2405", nameFa: "پروژهٔ پنجم",
      progress: 55, currency: "USD",
    },
  });
  assert.deepEqual(meta.ignoredFields.sort(), ["currency", "progress"]);
  assert.equal(data.progress, null, "پیشرفتِ دستیِ کلاینت پذیرفته نمی‌شود؛ از فعالیت‌ها می‌آید");
});

test("خطای داخلی همیشه ۵۰۰ تمیز برمی‌گرداند (بدون افشای جزئیات)", async () => {
  const handlers = new Map();
  const app = Object.fromEntries(["get", "post", "patch", "delete"].map((method) => [
    method, (path, ...middlewares) => handlers.set(`${method.toUpperCase()} ${path}`, middlewares),
  ]));
  registerMasterDataRoutes(app, {
    repo: async () => { throw new Error("DB exploded"); },
    subjects: DEMO_SUBJECTS,
    evaluate,
  });
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  await runStack(handlers.get("GET /api/industries"), { params: {}, query: {}, body: {}, headers: { "x-user-id": ADMIN }, requestId: "t" }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error.code, "CORE_INTERNAL_ERROR");
  assert.ok(!JSON.stringify(res.body).includes("exploded"), "جزئیات خطای داخلی نباید در پاسخ بیاید");
});
