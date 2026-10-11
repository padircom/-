/**
 * آزمون REST لایهٔ CMMS — `/api/cmms/sites/:siteId/...`.
 *
 * سه لایه را با هم می‌آزماید:
 *   ۱) قرارداد مسیرها: هرچه اعلام شده ثبت شده باشد و برعکس.
 *   ۲) RBAC و دامنهٔ سایت: چه کسی، در کدام سایت، چه کاری.
 *   ۳) قواعد کسب‌وکار: چیزهایی که دادهٔ «ظاهراً معتبر» ولی کسب‌وکاری غلط
 *      را رد می‌کنند — چون همین‌ها مرز بین یک CMMS و یک فرم‌سازند.
 *
 * ریاضی اینجا آزموده نمی‌شود؛ آن کار cmms.domain.test.mjs است. این فایل فقط
 * بررسی می‌کند که HTTP همان عدد موتور دامنه را برمی‌گرداند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { CMMS_API_VERSION, CMMS_IMPLEMENTED_ROUTES, registerCmmsRoutes } from "./cmmsApi.js";
import { DEMO_SUBJECTS, evaluate, subjectPermissions } from "./rbacLogic.js";

const SITE = "SITE-DEMO";
const ROOT = "/api/cmms/sites/:siteId";

/* نقش‌های نت. ماتریس مجوزشان در سرآییند accessControl.ts تعریف شده و
 * server/rbac.test.mjs ناوردایی‌هایش را قفل می‌کند. */
const MANAGER = "u-cmms-manager";
const PLANNER = "u-cmms-planner";
const RELIABILITY = "u-cmms-reliability";
const ENGINEER = "u-cmms-engineer";
const TECH = "u-cmms-tech";
const STORE = "u-cmms-store";
const CBM = "u-cmms-cbm";
/** مدیر منطقه — دامنهٔ ستاره، فقط در این آزمون تعریف می‌شود. */
const REGIONAL = "u-cmms-regional-test";

function makeRepo() {
  const tables = new Map();
  let next = 1;
  const rows = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };
  const matches = (row, where = []) => where.every((w) => {
    const actual = row[w.column];
    if (w.op === "like") {
      const pattern = String(w.value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
      return new RegExp(`^${pattern}$`, "i").test(String(actual ?? ""));
    }
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
      let out = rows(table).filter((row) => matches(row, spec.where));
      for (const order of [...(spec.orderBy ?? [])].reverse()) {
        out = [...out].sort((a, b) => {
          const cmp = a[order.column] === b[order.column] ? 0 : a[order.column] < b[order.column] ? -1 : 1;
          return order.dir === "desc" ? -cmp : cmp;
        });
      }
      const offset = spec.offset ?? 0;
      return out.slice(offset, spec.limit === undefined ? undefined : offset + spec.limit);
    },
    async count(table, where = []) { return rows(table).filter((row) => matches(row, where)).length; },
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
    async transaction(work) {
      const snapshot = new Map([...tables.entries()].map(([table, values]) => [table, structuredClone(values)]));
      const beforeNext = next;
      try {
        return await work(repo);
      } catch (error) {
        tables.clear();
        for (const [table, values] of snapshot) tables.set(table, values);
        next = beforeNext;
        throw error;
      }
    },
  };
  return repo;
}

function makeApi({ transport } = {}) {
  const handlers = new Map();
  const app = Object.fromEntries(["get", "post", "patch", "delete"].map((method) => [
    method, (path, handler) => handlers.set(`${method.toUpperCase()} ${path}`, handler),
  ]));
  const repo = makeRepo();
  /* یک سوژهٔ دامنه‌نامحدود اضافه می‌کنیم تا شاخهٔ `plantIds: ["*"]` در
   * فهرست سایت‌ها واقعاً آزموده شود — هیچ‌کدام از کاربران آزمایشی موجود
   * دامنهٔ ستاره ندارند. */
  const subjects = [...DEMO_SUBJECTS, {
    id: REGIONAL, displayName: "مدیر نت منطقه (آزمایشی)", roles: ["maintenance_manager"],
    projectIds: ["*"], plantIds: ["*"], active: true, party: "contractor",
  }];
  /* `subjectPermissions` همان چیزی است که لایهٔ HTTP در `server/index.js`
   * تزریق می‌کند؛ اگر اینجا نگذرانیم، تست‌ها شاخهٔ جایگزین را می‌آزمایند
   * و نه مسیر واقعی — یعنی خودِ اصلاح را اثبات نمی‌کنند. */
  /* «حمل‌ونقل یکپارچگی» در تست تزریق می‌شود تا تحویل واقعی رویداد به سامانهٔ
   * مقصد بدون شبکه آزموده شود؛ عدم تزریق یعنی رویداد در صف می‌ماند. */
  registerCmmsRoutes(app, { repo, subjects, evaluate, subjectPermissions, integrationTransport: transport });
  const call = async (method, path, { params = {}, query = {}, body = {}, headers = {}, requestId = "cmms-test" } = {}) => {
    const handler = handlers.get(`${method} ${path}`);
    assert.ok(handler, `مسیر ثبت نشده است: ${method} ${path}`);
    const req = { params, query, body, headers, requestId };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
      end() { return this; },
    };
    await handler(req, res);
    return res;
  };
  return { repo, handlers, call };
}

/** فراخوانی موفق با احراز هویت پیش‌فرض مدیر. */
async function ok(call, method, path, options = {}) {
  const res = await call(method, path, {
    params: { siteId: SITE, ...options.params },
    headers: { "x-user-id": options.as ?? MANAGER, ...options.headers },
    query: options.query, body: options.body, requestId: options.requestId,
  });
  assert.equal(res.statusCode, options.expectStatus ?? 200,
    `انتظار ${options.expectStatus ?? 200} بود ولی ${res.statusCode} برگشت: ${JSON.stringify(res.body?.error ?? res.body)}`);
  return res.body.data;
}

/** فراخوانی ساخت منبع — کد وضعیت ۲۰۱. */
async function created(call, path, options = {}) {
  return ok(call, "POST", path, { ...options, expectStatus: 201 });
}

/** فراخوانی ناموفق و بررسی کد خطا. */
async function fails(call, method, path, expectedStatus, expectedCode, options = {}) {
  const res = await call(method, path, {
    params: { siteId: SITE, ...options.params },
    headers: { "x-user-id": options.as ?? MANAGER, ...options.headers },
    query: options.query, body: options.body,
  });
  assert.equal(res.statusCode, expectedStatus, `کد وضعیت ${res.statusCode}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, expectedCode);
  assert.ok(res.body.error.message, "پیام خطا خالی است");
  return res.body.error;
}

/** ساخت زنجیرهٔ پایه: گروه خانواده → خانواده → تجهیز. */
async function seedFamilyAndAsset(call, { familyCode = "FAM-PUMP", assetTag = "P-101" } = {}) {
  const group = await created(call, `${ROOT}/family-groups`, {
    as: ENGINEER,
    body: { GroupCode: "GRP-ROT", NameFa: "تجهیزات دوار", EquipmentClass: "pump" },
  });
  const family = await created(call, `${ROOT}/families`, {
    as: ENGINEER,
    body: { FamilyGroupId: group.Id, FamilyCode: familyCode, NameFa: "پمپ سانتریفیوژ", CriticalityRank: "A" },
  });
  const asset = await created(call, `${ROOT}/assets`, {
    as: ENGINEER,
    body: { FamilyId: family.Id, AssetTag: assetTag, NameFa: "پمپ ۱۰۱", CriticalityRank: "A" },
  });
  return { group, family, asset };
}

/* ═══════════════════════ ۱. قرارداد مسیرها ═══════════════════════ */

test("همهٔ مسیرهای اعلام‌شده ثبت شده‌اند و هیچ مسیر ثبت‌نشده‌ای اعلام نشده", () => {
  const { handlers } = makeApi();
  const registered = [...handlers.keys()].sort();
  const declared = [...CMMS_IMPLEMENTED_ROUTES].sort();
  /* ۱۰۵ مسیر پیشین + ۱۶ مسیر فاز ۴: توقف/ادامه (۳)، RCFA تعاملی (۸) و
   * یکپارچگی بین‌بخشی (۵). هیچ مسیری حذف یا تغییر نکرده است. */
  assert.equal(registered.length, 121);
  assert.deepEqual(declared.filter((route) => !registered.includes(route)), [], "مسیر اعلام‌شده ولی ثبت‌نشده");
  assert.deepEqual(registered.filter((route) => !declared.includes(route)), [], "مسیر ثبت‌شده ولی اعلام‌نشده");
});

test("فهرست مسیرها یخ‌زده است و همه زیر /api/cmms قرار دارند", () => {
  assert.ok(Object.isFrozen(CMMS_IMPLEMENTED_ROUTES));
  for (const route of CMMS_IMPLEMENTED_ROUTES) {
    assert.ok(route.startsWith("GET /api/cmms") || route.startsWith("POST /api/cmms")
      || route.startsWith("PATCH /api/cmms") || route.startsWith("DELETE /api/cmms"), `مسیر بیرون از /api/cmms: ${route}`);
  }
  assert.equal(CMMS_API_VERSION, "cmms-api-v1");
});

test("وابستگی‌های ناقص هنگام ثبت مسیر استثنا می‌دهند", () => {
  assert.throws(() => registerCmmsRoutes(null, {}), TypeError);
  assert.throws(() => registerCmmsRoutes({ get() {}, post() {} }, {}), TypeError);
  assert.throws(() => registerCmmsRoutes({ get() {}, post() {} }, { repo: makeRepo() }), TypeError);
});

/* ═══════════════════════ ۲. احراز هویت، RBAC و دامنهٔ سایت ═══════════════════════ */

test("بدون هویت کاربر، ۴۰۱ برمی‌گردد نه ۴۰۳", () => {
  const { call } = makeApi();
  const res = call("GET", `${ROOT}/assets`, { params: { siteId: SITE }, headers: {}, body: {}, query: {} });
  return res.then((response) => {
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error.code, "CMMS_AUTH_REQUIRED");
  });
});

test("کاربر ناشناخته یا غیرفعال ۴۰۱ می‌گیرد", async () => {
  const { call } = makeApi();
  await fails(call, "GET", `${ROOT}/assets`, 401, "CMMS_AUTH_REQUIRED", { as: "u-ghost" });
  /* سوژهٔ موجود ولی خارج از دامنهٔ سایت — این ۴۰۳ است نه ۴۰۱. */
  await fails(call, "GET", `${ROOT}/assets`, 403, "CMMS_SITE_SCOPE_DENIED", { as: "u-mfg-plan" });
});

test("کاربر خارج از دامنهٔ سایت، حتی با مجوز درست، رد می‌شود", async () => {
  const { call } = makeApi();
  const error = await fails(call, "GET", `${ROOT}/assets`, 403, "CMMS_SITE_SCOPE_DENIED", { as: "u-mfg-plan" });
  assert.equal(error.reason, "DENY_PLANT_SCOPE");
  assert.ok(error.message.includes("سایت"));
});

test("شناسهٔ سایت نامعتبر ۴۰۰ می‌گیرد", async () => {
  const { call } = makeApi();
  await fails(call, "GET", `${ROOT}/assets`, 400, "CMMS_BAD_SITE_ID", { params: { siteId: "" } });
  await fails(call, "GET", `${ROOT}/assets`, 400, "CMMS_BAD_SITE_ID", { params: { siteId: "SITE DEMO; DROP" } });
});

test("مجوز ناکافی ۴۰۳ می‌گیرد و نام مجوز و دلیل را برمی‌گرداند", async () => {
  const { call } = makeApi();
  /* تکنسین مجوز ساخت دستورکار ندارد. */
  const error = await fails(call, "POST", `${ROOT}/work-orders`, 403, "CMMS_FORBIDDEN", {
    as: TECH, body: { WorkOrderNo: "WO-1", WorkOrderType: "cm", TitleFa: "تعمیر" },
  });
  assert.equal(error.permission, "cmms.wo.create");
  assert.ok(error.reason.startsWith("DENY_"));
});

test("تفکیک وظایف: آزادسازی با مدیر، اجرا با تکنسین، اتمام با مهندس، بستن با مدیر", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  const workOrder = await created(call, `${ROOT}/work-orders`, {
    as: PLANNER, body: { WorkOrderNo: "WO-SOD", WorkOrderType: "cm", AssetId: asset.Id, TitleFa: "آزمون SOD" },
  });
  const base = { params: { workOrderId: workOrder.Id } };
  /* تکنسین نمی‌تواند آزاد کند. */
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, 403, "CMMS_FORBIDDEN", { ...base, as: TECH });
  /* مهندس هم نمی‌تواند آزاد کند — آزادسازی تصمیم مدیر است. */
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, 403, "CMMS_FORBIDDEN", { ...base, as: ENGINEER });
  /* برنامه‌ریز نمی‌تواند ببندد. */
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/close`, 403, "CMMS_FORBIDDEN", { ...base, as: PLANNER });
  /* مدیر آزاد می‌کند. */
  const released = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, { ...base, as: MANAGER });
  assert.equal(released.Status, "released");
  /* مدیر نمی‌تواند اجرا کند — اجرا کار تکنسین است. */
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/start`, 403, "CMMS_FORBIDDEN", { ...base, as: MANAGER });
  const started = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/start`, { ...base, as: TECH });
  assert.equal(started.Status, "in-progress");
  /* تکنسین نمی‌تواند اتمام بزند. */
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/complete`, 403, "CMMS_FORBIDDEN", { ...base, as: TECH });
  const completed = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/complete`, { ...base, as: ENGINEER });
  assert.equal(completed.Status, "completed");
  /* مهندس نمی‌تواند ببندد. */
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/close`, 403, "CMMS_FORBIDDEN", { ...base, as: ENGINEER });
  const closed = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/close`, { ...base, as: MANAGER });
  assert.equal(closed.Status, "closed");
});

test("فهرست سایت‌ها به دامنهٔ کاربر محدود می‌شود", async () => {
  const { call, repo } = makeApi();
  await repo.create("CmmsSite", { SiteId: "SITE-DEMO", NameFa: "سایت آزمایشی" });
  await repo.create("CmmsSite", { SiteId: "SITE-OTHER", NameFa: "سایت دیگر" });
  const scoped = await ok(call, "GET", "/api/cmms/sites", { params: {}, as: MANAGER });
  assert.equal(scoped.total, 1);
  assert.equal(scoped.sites[0].SiteId, "SITE-DEMO");
  /* کاربر با دامنهٔ ستاره همه را می‌بیند. */
  const all = await ok(call, "GET", "/api/cmms/sites", { params: {}, as: REGIONAL });
  assert.equal(all.total, 2);
});

test("پاسخ موفق پوشش یکدست دارد و traceId را برمی‌گرداند", async () => {
  const { call } = makeApi();
  const res = await call("GET", `${ROOT}/assets`, {
    params: { siteId: SITE }, headers: { "x-user-id": MANAGER }, query: {}, body: {}, requestId: "trace-42",
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.meta.traceId, "trace-42");
  assert.equal(res.body.meta.version, "cmms-api-v1");
});

/* ═══════════════════════ ۳. خانوادهٔ تجهیز (ساختار PMworks) ═══════════════════════ */

test("گروه خانواده و خانواده ساخته می‌شوند و کد تکراری ۴۰۹ می‌گیرد", async () => {
  const { call } = makeApi();
  const group = await created(call, `${ROOT}/family-groups`, {
    as: ENGINEER, body: { GroupCode: "GRP-ROT", NameFa: "تجهیزات دوار", EquipmentClass: "pump" },
  });
  assert.equal(group.GroupCode, "GRP-ROT");
  const family = await created(call, `${ROOT}/families`, {
    as: ENGINEER, body: { FamilyGroupId: group.Id, FamilyCode: "FAM-PUMP", NameFa: "پمپ" },
      });
  assert.equal(family.Status, "draft");
  assert.equal(family.Version, 1);
  await fails(call, "POST", `${ROOT}/families`, 409, "CMMS_DUPLICATE", {
    as: ENGINEER, body: { FamilyGroupId: group.Id, FamilyCode: "FAM-PUMP", NameFa: "پمپ تکراری" },
  });
  /* ارجاع به گروه خانوادهٔ ناموجود ۴۰۴ می‌گیرد. */
  await fails(call, "POST", `${ROOT}/families`, 404, "CMMS_NOT_FOUND", {
    as: ENGINEER, body: { FamilyGroupId: "GHOST", FamilyCode: "FAM-X", NameFa: "ناموجود" },
  });
});

test("تأیید خانواده فقط با مدیر است و خانوادهٔ خالی تصویب نمی‌شود", async () => {
  const { call } = makeApi();
  const { family } = await seedFamilyAndAsset(call);
  const params = { familyId: family.Id };
  await fails(call, "POST", `${ROOT}/families/:familyId/approve`, 403, "CMMS_FORBIDDEN", {
    as: ENGINEER, params,
  });
  /* خانوادهٔ بدون ساختار، الگو نیست. تصویب آن یعنی هر تجهیزِ بی‌ربط بعداً به
   * این خانواده وصل شود و چک‌لیست و حالت خرابی‌اش بی‌معنا باشد. */
  await fails(call, "POST", `${ROOT}/families/:familyId/approve`, 422, "CMMS_FAMILY_EMPTY", {
    as: MANAGER, params,
  });
  await created(call, `${ROOT}/families/:familyId/nodes`, {
    as: ENGINEER, params, body: { NodeCode: "N-ROOT", NameFa: "پمپ", BoundaryLevel: "equipment" },
  });
  const approved = await ok(call, "POST", `${ROOT}/families/:familyId/approve`, { as: MANAGER, params });
  assert.equal(approved.Status, "approved");
});

test("فیلد ناشناخته در بدنه ۴۰۰ می‌گیرد — هیچ ستون دلخواهی پذیرفته نمی‌شود", async () => {
  const { call } = makeApi();
  const error = await fails(call, "POST", `${ROOT}/families`, 400, "CMMS_VALIDATION_FAILED", {
    as: ENGINEER, body: { FamilyCode: "FAM-1", NameFa: "پمپ", DropTable: "CmmsAsset" },
  });
  assert.equal(error.field, "DropTable");
});

test("درخت خانواده ساخته می‌شود و والد ناموجود رد می‌شود", async () => {
  const { call } = makeApi();
  const { family } = await seedFamilyAndAsset(call);
  const params = { familyId: family.Id };
  const parent = await created(call, `${ROOT}/families/:familyId/nodes`, {
    as: ENGINEER, params, body: { NodeCode: "N-PUMP", NameFa: "پمپ", BoundaryLevel: "equipment" },
      });
  const child = await created(call, `${ROOT}/families/:familyId/nodes`, {
    as: ENGINEER, params, body: { NodeCode: "N-SEAL", NameFa: "مکانیکال سیل", BoundaryLevel: "component", ParentNodeId: parent.Id },
      });
  assert.equal(child.ParentNodeId, parent.Id);
  await fails(call, "POST", `${ROOT}/families/:familyId/nodes`, 404, "CMMS_NOT_FOUND", {
    as: ENGINEER, params, body: { NodeCode: "N-X", NameFa: "ناموجود", ParentNodeId: "GHOST" },
  });
  const tree = await ok(call, "GET", `${ROOT}/families/:familyId/nodes`, { as: ENGINEER, params });
  /* پاسخ، درختِ ساخته‌شده است نه فهرست مسطح — همان خروجی buildTree دامنه. */
  assert.equal(tree.nodes.length, 2);
  assert.equal(tree.roots.length, 1);
  assert.equal(tree.maxDepth, 1);
  assert.deepEqual(tree.cycleMembers, []);
  const childInTree = tree.nodes.find((node) => node.id === child.Id);
  assert.equal(childInTree.depth, 1);
});

test("حالت خرابی خارج از فهرست بستهٔ ISO 14224 رد می‌شود", async () => {
  const { call } = makeApi();
  const { family } = await seedFamilyAndAsset(call);
  const params = { familyId: family.Id };
  const mode = await created(call, `${ROOT}/families/:familyId/failure-modes`, {
    as: ENGINEER, params,
    body: { FailureModeCode: "FM-LEAK", NameFa: "نشتی", FailureMode: "leakage", FailureMechanism: "wear" },
      });
  assert.equal(mode.FailureMode, "leakage");
  /* «broken» در فهرست ISO 14224 نیست. */
  await fails(call, "POST", `${ROOT}/families/:familyId/failure-modes`, 400, "CMMS_VALIDATION_FAILED", {
    as: ENGINEER, params, body: { FailureModeCode: "FM-X", NameFa: "خراب", FailureMode: "broken" },
  });
  await fails(call, "POST", `${ROOT}/families/:familyId/failure-modes`, 400, "CMMS_VALIDATION_FAILED", {
    as: ENGINEER, params, body: { FailureModeCode: "FM-Y", NameFa: "فرسایش با مکانیزم نامعتبر", FailureMode: "wear", FailureMechanism: "magic" },
  });
});

test("فعالیت PM و قلم چک‌لیست ساخته می‌شوند", async () => {
  const { call } = makeApi();
  const { family } = await seedFamilyAndAsset(call);
  const params = { familyId: family.Id };
  const task = await created(call, `${ROOT}/families/:familyId/pm-tasks`, {
    as: ENGINEER, params,
    body: { TaskCode: "PM-LUBE", NameFa: "روغن‌کاری", TaskType: "lubrication", TradeSkill: "mechanical", IntervalValue: 30, IntervalUnit: "days" },
      });
  const item = await created(call, `${ROOT}/families/:familyId/pm-tasks/:taskId/checklist-items`, {
    as: ENGINEER, params: { ...params, taskId: task.Id },
    body: { ItemCode: "CI-1", DescriptionFa: "سطح روغن", InputType: "numeric", MinValue: 2, MaxValue: 8, Uom: "litre", IsRequired: true },
      });
  assert.equal(item.MinValue, 2);
  assert.equal(item.MaxValue, 8);
});

test("تغییر همگانی خانواده: مجوز مستقل، اعمال روی همهٔ زمان‌بندی‌ها، و نوع پشتیبانی‌نشده رد می‌شود", async () => {
  const { call, repo } = makeApi();
  const { family, asset } = await seedFamilyAndAsset(call);
  const params = { familyId: family.Id };
  /* دو زمان‌بندی PM روی خانواده — هدف واقعی تغییر همگانی. */
  for (const scheduleCode of ["PM-A", "PM-B"]) {
    await created(call, `${ROOT}/pm-schedules`, {
      as: PLANNER,
      body: { AssetId: asset.Id, ScheduleCode: scheduleCode, TriggerType: "time", IntervalValue: 30, IntervalUnit: "days", Priority: 3 },
    });
  }
  /* زمان‌بندی‌ها باید به خانواده وصل شوند تا تغییر همگانی آن‌ها را ببیند. */
  for (const schedule of await repo.list("CmmsPmSchedule")) {
    await repo.patch("CmmsPmSchedule", schedule.Id, { FamilyId: family.Id }, "test", schedule.RowVersion);
  }

  /* تغییر همگانی روی همهٔ اعضای خانواده اثر می‌گذارد؛ پس مجوزش از ویرایش
   * معمولی خانواده جدا و سخت‌گیرانه‌تر است. */
  await fails(call, "POST", `${ROOT}/families/:familyId/bulk-changes`, 403, "CMMS_FORBIDDEN", {
    as: ENGINEER, params,
    body: { ChangeKind: "pm-interval", TargetField: "IntervalValue", NewValueJson: { IntervalValue: 45 }, ReasonFa: "تلاش مهندس" },
  });

  const change = await created(call, `${ROOT}/families/:familyId/bulk-changes`, {
    as: MANAGER, params,
    body: { ChangeKind: "pm-interval", TargetField: "IntervalValue", NewValueJson: { IntervalValue: 45, IntervalUnit: "days" }, ReasonFa: "بهینه‌سازی دورهٔ سرویس" },
  });
  assert.equal(change.Status, "pending");

  const applied = await ok(call, "POST", `${ROOT}/families/:familyId/bulk-changes/:changeId/apply`, {
    as: MANAGER, params: { ...params, changeId: change.Id },
  });
  assert.equal(applied.affectedRecords, 2, "هر دو زمان‌بندی باید به‌روز شده باشند");
  assert.equal(applied.status, "applied");
  for (const schedule of await repo.list("CmmsPmSchedule")) {
    assert.equal(schedule.IntervalValue, 45);
  }
  /* اعمال دوم باید رد شود تا یک تغییر دو بار اجرا نشود. */
  await fails(call, "POST", `${ROOT}/families/:familyId/bulk-changes/:changeId/apply`, 409, "CMMS_CHANGE_ALREADY_APPLIED", {
    as: MANAGER, params: { ...params, changeId: change.Id },
  });

  /* نوع پشتیبانی‌نشده صریحاً رد می‌شود — نه اینکه بی‌صدا «موفق» به نظر برسد. */
  const unsupported = await created(call, `${ROOT}/families/:familyId/bulk-changes`, {
    as: MANAGER, params,
    body: { ChangeKind: "document", TargetField: "NoteFa", NewValueJson: "x", ReasonFa: "نوع پشتیبانی‌نشده" },
  });
  const error = await fails(call, "POST", `${ROOT}/families/:familyId/bulk-changes/:changeId/apply`, 422, "CMMS_CHANGE_UNSUPPORTED", {
    as: MANAGER, params: { ...params, changeId: unsupported.Id },
  });
  assert.deepEqual(error.supported, ["pm-interval", "strategy"]);
});

/* ═══════════════════════ ۴. تجهیز و کنتور ═══════════════════════ */

test("تجهیز بدون خانواده ساخته نمی‌شود و برچسب تکراری ۴۰۹ می‌گیرد", async () => {
  const { call } = makeApi();
  const { family, asset } = await seedFamilyAndAsset(call);
  await fails(call, "POST", `${ROOT}/assets`, 404, "CMMS_NOT_FOUND", {
    as: ENGINEER, body: { FamilyId: "GHOST", AssetTag: "P-999", NameFa: "بی‌خانواده" },
  });
  await fails(call, "POST", `${ROOT}/assets`, 409, "CMMS_DUPLICATE", {
    as: ENGINEER, body: { FamilyId: family.Id, AssetTag: asset.AssetTag, NameFa: "تکراری" },
  });
  /* نام الزامی است. */
  await fails(call, "POST", `${ROOT}/assets`, 400, "CMMS_VALIDATION_FAILED", {
    as: ENGINEER, body: { FamilyId: family.Id, AssetTag: "P-998" },
  });
});

test("کنتور: قرائت رو به جلو قبول و رو به عقب بدون rollover رد می‌شود", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  const meter = await created(call, `${ROOT}/assets/:assetId/meters`, {
    as: ENGINEER, params: { assetId: asset.Id },
    body: { MeterCode: "M-HOUR", NameFa: "ساعت کارکرد", Uom: "hour", MeterType: "absolute", InitialValue: 0 },
      });
  const first = await created(call, `${ROOT}/meters/:meterId/readings`, {
    as: TECH, params: { meterId: meter.Id },
    body: { ReadAt: "2026-10-01T08:00:00Z", Value: 100 }, expectStatus: 201,
  });
  assert.equal(first.delta, 100);
  const second = await created(call, `${ROOT}/meters/:meterId/readings`, {
    as: TECH, params: { meterId: meter.Id },
    body: { ReadAt: "2026-10-02T08:00:00Z", Value: 150 }, expectStatus: 201,
  });
  assert.equal(second.delta, 50);
  /* قرائت عقب‌رفته بدون rollover یعنی دادهٔ غلط، نه مقدار منفی. */
  const error = await fails(call, "POST", `${ROOT}/meters/:meterId/readings`, 422, "CMMS_METER_BACKWARD", {
    as: TECH, params: { meterId: meter.Id }, body: { ReadAt: "2026-10-03T08:00:00Z", Value: 120 },
  });
  assert.equal(error.previousValue, 150);
});

test("کنتور با rollover تعریف‌شده، سرریز را درست محاسبه می‌کند", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  const meter = await created(call, `${ROOT}/assets/:assetId/meters`, {
    as: ENGINEER, params: { assetId: asset.Id },
    body: { MeterCode: "M-ODO", NameFa: "کیلومترشمار", Uom: "km", MeterType: "absolute", InitialValue: 0, RollOverAt: 1000 },
      });
  await created(call, `${ROOT}/meters/:meterId/readings`, {
    as: TECH, params: { meterId: meter.Id }, body: { ReadAt: "2026-10-01T08:00:00Z", Value: 990 }, expectStatus: 201,
  });
  const rolled = await created(call, `${ROOT}/meters/:meterId/readings`, {
    as: TECH, params: { meterId: meter.Id }, body: { ReadAt: "2026-10-02T08:00:00Z", Value: 30 }, expectStatus: 201,
  });
  /* 1000 − 990 + 30 = 40 */
  assert.equal(rolled.delta, 40);
});

/* ═══════════════════════ ۵. درخواست‌کار و دستورکار ═══════════════════════ */

test("دستورکار بدون تجهیز و بدون مکان ساخته نمی‌شود", async () => {
  const { call } = makeApi();
  await fails(call, "POST", `${ROOT}/work-orders`, 400, "CMMS_VALIDATION_FAILED", {
    as: PLANNER, body: { WorkOrderNo: "WO-ORPHAN", WorkOrderType: "cm", TitleFa: "کار شناور" },
  });
});

test("دستورکار با پایان پیش از شروع رد می‌شود", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  await fails(call, "POST", `${ROOT}/work-orders`, 400, "CMMS_VALIDATION_FAILED", {
    as: PLANNER,
    body: {
      WorkOrderNo: "WO-TIME", WorkOrderType: "cm", AssetId: asset.Id, TitleFa: "بازهٔ وارونه",
      PlannedStartAt: "2026-10-10T08:00:00Z", PlannedFinishAt: "2026-10-09T08:00:00Z",
    },
  });
});

test("گذار وضعیت نامعتبر ۴۲۲ می‌گیرد و وضعیت‌های مجاز را برمی‌گرداند", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  const workOrder = await created(call, `${ROOT}/work-orders`, {
    as: PLANNER, body: { WorkOrderNo: "WO-STATE", WorkOrderType: "cm", AssetId: asset.Id, TitleFa: "آزمون وضعیت" },
  });
  /* draft → start مستقیم مجاز نیست. */
  const error = await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/start`, 422, "CMMS_WO_STATE", {
    as: TECH, params: { workOrderId: workOrder.Id },
  });
  assert.deepEqual(error.allowedFrom, ["released", "on-hold"]);
  assert.equal(error.currentStatus, "draft");
});

test("چک‌لیست خانواده هنگام آزادسازی روی دستورکار ماده‌سازی می‌شود", async () => {
  const { call } = makeApi();
  const { family, asset } = await seedFamilyAndAsset(call);
  const task = await created(call, `${ROOT}/families/:familyId/pm-tasks`, {
    as: ENGINEER, params: { familyId: family.Id },
    body: { TaskCode: "PM-INS", NameFa: "بازرسی", TaskType: "inspection", TradeSkill: "mechanical", IntervalValue: 7, IntervalUnit: "days" },
  });
  await created(call, `${ROOT}/families/:familyId/pm-tasks/:taskId/checklist-items`, {
    as: ENGINEER, params: { familyId: family.Id, taskId: task.Id },
    body: { ItemCode: "CI-A", DescriptionFa: "بازدید چشمی", InputType: "passfail", IsRequired: true, SortOrder: 1 },
  });
  await created(call, `${ROOT}/families/:familyId/pm-tasks/:taskId/checklist-items`, {
    as: ENGINEER, params: { familyId: family.Id, taskId: task.Id },
    body: { ItemCode: "CI-B", DescriptionFa: "فشار discharge", InputType: "numeric", MinValue: 4, MaxValue: 9, IsRequired: true, SortOrder: 2 },
  });
  const workOrder = await created(call, `${ROOT}/work-orders`, {
    as: PLANNER,
    body: { WorkOrderNo: "WO-PM", WorkOrderType: "pm", AssetId: asset.Id, TitleFa: "سرویس دوره‌ای", FamilyPmTaskId: task.Id },
  });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, {
    as: MANAGER, params: { workOrderId: workOrder.Id },
  });
  const detail = await ok(call, "GET", `${ROOT}/work-orders/:workOrderId`, {
    as: MANAGER, params: { workOrderId: workOrder.Id },
  });
  assert.equal(detail.tasks.length, 2, "دو قلم چک‌لیست باید ماده‌سازی شده باشد");
  /* همه با وضعیت pending می‌آیند — نتیجه را تکنسین باید ثبت کند. */
  assert.deepEqual(detail.tasks.map((item) => item.ResultStatus), ["pending", "pending"]);
  assert.deepEqual(detail.tasks.map((item) => item.LineNo), [1, 2]);

  /* آزادسازی دوم چک‌لیست را دو برابر نمی‌کند. */
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/start`, { as: TECH, params: { workOrderId: workOrder.Id } });
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, 422, "CMMS_WO_STATE", {
    as: MANAGER, params: { workOrderId: workOrder.Id },
  });
});

test("دستورکار با چک‌لیست بی‌نتیجه کامل نمی‌شود", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  const workOrder = await created(call, `${ROOT}/work-orders`, {
    as: PLANNER, body: { WorkOrderNo: "WO-CHK", WorkOrderType: "cm", AssetId: asset.Id, TitleFa: "چک‌لیست ناتمام" },
  });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, { as: MANAGER, params: { workOrderId: workOrder.Id } });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/start`, { as: TECH, params: { workOrderId: workOrder.Id } });
  const task = await created(call, `${ROOT}/work-orders/:workOrderId/tasks`, {
    as: PLANNER, params: { workOrderId: workOrder.Id },
    body: { DescriptionFa: "بازدید نشتی", PlannedMinutes: 15 }, expectStatus: 201,
  });
  const error = await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/complete`, 422, "CMMS_WO_PENDING_TASKS", {
    as: ENGINEER, params: { workOrderId: workOrder.Id },
  });
  assert.deepEqual(error.pendingLineNos, [task.LineNo]);
});

test("ثبت نتیجهٔ چک‌لیست: ناموفق بدون شرح رد و مقدار بیرون بازه رد می‌شود", async () => {
  const { call } = makeApi();
  const { family, asset } = await seedFamilyAndAsset(call);
  const task = await created(call, `${ROOT}/families/:familyId/pm-tasks`, {
    as: ENGINEER, params: { familyId: family.Id },
    body: { TaskCode: "PM-P", NameFa: "فشار", TaskType: "inspection", TradeSkill: "mechanical", IntervalValue: 7, IntervalUnit: "days" },
  });
  const item = await created(call, `${ROOT}/families/:familyId/pm-tasks/:taskId/checklist-items`, {
    as: ENGINEER, params: { familyId: family.Id, taskId: task.Id },
    body: { ItemCode: "CI-P", DescriptionFa: "فشار", InputType: "numeric", MinValue: 4, MaxValue: 9, IsRequired: true },
  });
  const workOrder = await created(call, `${ROOT}/work-orders`, {
    as: PLANNER, body: { WorkOrderNo: "WO-RES", WorkOrderType: "pm", AssetId: asset.Id, TitleFa: "ثبت نتیجه", FamilyPmTaskId: task.Id },
  });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, { as: MANAGER, params: { workOrderId: workOrder.Id } });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/start`, { as: TECH, params: { workOrderId: workOrder.Id } });
  const [line] = (await ok(call, "GET", `${ROOT}/work-orders/:workOrderId`, { as: MANAGER, params: { workOrderId: workOrder.Id } })).tasks;
  const params = { workOrderId: workOrder.Id, taskId: line.Id };

  /* ردیف ناموفق بدون شرح یافته پذیرفته نمی‌شود. */
  await fails(call, "PATCH", `${ROOT}/work-orders/:workOrderId/tasks/:taskId`, 400, "CMMS_VALIDATION_FAILED", {
    as: TECH, params, body: { ResultStatus: "fail" },
  });
  /* مقدار بیرون بازهٔ مجاز چک‌لیست رد می‌شود. */
  const outOfRange = await fails(call, "PATCH", `${ROOT}/work-orders/:workOrderId/tasks/:taskId`, 422, "CMMS_WO_TASK_OUT_OF_RANGE", {
    as: TECH, params, body: { ResultStatus: "pass", MeasuredValueNumber: 12 },
  });
  assert.equal(outOfRange.itemCode, item.ItemCode);
  /* مقدار درون بازه قبول می‌شود. */
  const passed = await ok(call, "PATCH", `${ROOT}/work-orders/:workOrderId/tasks/:taskId`, {
    as: TECH, params, body: { ResultStatus: "pass", MeasuredValueNumber: 6.5, ActualMinutes: 10 },
  });
  assert.equal(passed.ResultStatus, "pass");
  assert.equal(passed.MeasuredValueNumber, 6.5);
  assert.equal(passed.PerformedBy, TECH);
  /* حالا اتمام مجاز است. */
  const completed = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/complete`, {
    as: ENGINEER, params: { workOrderId: workOrder.Id },
  });
  assert.equal(completed.Status, "completed");
});

test("ردیف نتیجه‌دار با Replace پاک نمی‌شود", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  const workOrder = await created(call, `${ROOT}/work-orders`, {
    as: PLANNER, body: { WorkOrderNo: "WO-REP", WorkOrderType: "cm", AssetId: asset.Id, TitleFa: "جایگزینی" },
  });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, { as: MANAGER, params: { workOrderId: workOrder.Id } });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/start`, { as: TECH, params: { workOrderId: workOrder.Id } });
  const task = await created(call, `${ROOT}/work-orders/:workOrderId/tasks`, {
    as: PLANNER, params: { workOrderId: workOrder.Id }, body: { DescriptionFa: "قلم اول" }, expectStatus: 201,
  });
  await ok(call, "PATCH", `${ROOT}/work-orders/:workOrderId/tasks/:taskId`, {
    as: TECH, params: { workOrderId: workOrder.Id, taskId: task.Id }, body: { ResultStatus: "pass" },
  });
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/tasks`, 422, "CMMS_WO_TASK_RESULT_LOCKED", {
    as: PLANNER, params: { workOrderId: workOrder.Id }, body: { DescriptionFa: "قلم تازه", Replace: true },
  });
});

test("بستن دستورکار هزینه و ساعت واقعی را از ردیف‌ها جمع می‌زند", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  const workOrder = await created(call, `${ROOT}/work-orders`, {
    as: PLANNER, body: { WorkOrderNo: "WO-COST", WorkOrderType: "cm", AssetId: asset.Id, TitleFa: "هزینه" },
  });
  const params = { workOrderId: workOrder.Id };
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, { as: MANAGER, params });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/start`, { as: TECH, params });
  const technician = await created(call, `${ROOT}/technicians`, {
    as: MANAGER, body: { TechnicianCode: "T-01", FullNameFa: "تکنسین مکانیک", PrimaryTrade: "mechanical" },
  });
  await created(call, `${ROOT}/work-orders/:workOrderId/labor`, {
    as: TECH, params, body: { TechnicianId: technician.Id, WorkDate: "2026-10-01", RegularHours: 6, OvertimeHours: 2 },
  });
  await created(call, `${ROOT}/work-orders/:workOrderId/costs`, {
    as: MANAGER, params, body: { CostElement: "labor", Amount: 1200, Currency: "IRR", PostedOn: "2026-10-01" }, expectStatus: 201,
  });
  await created(call, `${ROOT}/work-orders/:workOrderId/costs`, {
    as: MANAGER, params, body: { CostElement: "material", Amount: 800, Currency: "IRR", PostedOn: "2026-10-01" }, expectStatus: 201,
  });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/complete`, { as: ENGINEER, params });
  const closed = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/close`, { as: MANAGER, params });
  assert.equal(closed.ActualHours, 8);
  assert.equal(closed.ActualCost, 2000);
  const detail = await ok(call, "GET", `${ROOT}/work-orders/:workOrderId`, { as: MANAGER, params });
  assert.equal(detail.totals.labor, 1200);
  assert.equal(detail.totals.material, 800);
  assert.equal(detail.totals.total, 2000);
});

/* ═══════════════════════ ۶. انبار قطعات یدکی ═══════════════════════ */

test("رسید موجودی را زیاد و خروج کم می‌کند؛ کسری رد می‌شود", async () => {
  const { call } = makeApi();
  const part = await created(call, `${ROOT}/spare-parts`, {
    as: ENGINEER, body: { PartNumber: "SEAL-01", NameFa: "مکانیکال سیل", Category: "seal", Uom: "pcs", UnitCost: 1000, QtyOnHand: 0, MinStock: 2 },
  });
  const params = { partId: part.Id };
  const received = await created(call, `${ROOT}/spare-parts/:partId/transactions`, {
    as: STORE, params, body: { TransactionType: "receipt", Quantity: 10 }, expectStatus: 201,
  });
  assert.equal(received.qtyOnHand, 10);
  const issued = await created(call, `${ROOT}/spare-parts/:partId/transactions`, {
    as: STORE, params, body: { TransactionType: "issue", Quantity: 4 }, expectStatus: 201,
  });
  assert.equal(issued.qtyOnHand, 6);
  /* موجودی منفی ممنوع است — این همان خطایی است که انبار را برای همیشه خراب می‌کند. */
  const error = await fails(call, "POST", `${ROOT}/spare-parts/:partId/transactions`, 422, "CMMS_SPARE_SHORTAGE", {
    as: STORE, params, body: { TransactionType: "issue", Quantity: 100 },
  });
  assert.equal(error.onHand, 6);
  /* رزرو موجودی را تغییر نمی‌دهد. */
  const reserved = await created(call, `${ROOT}/spare-parts/:partId/transactions`, {
    as: STORE, params, body: { TransactionType: "reserve", Quantity: 3 }, expectStatus: 201,
  });
  assert.equal(reserved.qtyOnHand, 6);
  /* مقدار صفر بی‌معنا است. */
  await fails(call, "POST", `${ROOT}/spare-parts/:partId/transactions`, 400, "CMMS_VALIDATION_FAILED", {
    as: STORE, params, body: { TransactionType: "receipt", Quantity: 0 },
  });
});

test("شکست تراکنش، موجودی را نیمه‌کاره رها نمی‌کند", async () => {
  const { call, repo } = makeApi();
  const part = await created(call, `${ROOT}/spare-parts`, {
    as: ENGINEER, body: { PartNumber: "BRG-7", NameFa: "بلبرینگ", Category: "bearing", Uom: "pcs", UnitCost: 500, QtyOnHand: 5 },
  });
  /* خروج بیش از موجودی باید کل تراکنش را برگرداند، نه فقط ردیف تراکنش را نسازد. */
  await fails(call, "POST", `${ROOT}/spare-parts/:partId/transactions`, 422, "CMMS_SPARE_SHORTAGE", {
    as: STORE, params: { partId: part.Id }, body: { TransactionType: "issue", Quantity: 50 },
  });
  const after = await repo.get("CmmsSparePart", part.Id);
  assert.equal(after.QtyOnHand, 5, "موجودی نباید تغییر کرده باشد");
  assert.equal(await repo.count("CmmsSpareTransaction"), 0, "ردیف تراکنش نباید باقی مانده باشد");
});

/* ═══════════════════════ ۷. محاسبهٔ استانداردها از HTTP ═══════════════════════ */

test("قابلیت اطمینان از HTTP همان عدد موتور دامنه را برمی‌گرداند", async () => {
  const { call } = makeApi();
  const data = await ok(call, "POST", `${ROOT}/reliability/compute`, {
    as: RELIABILITY,
    body: {
      PeriodType: "yearly", PeriodStart: "2025-01-01", PeriodEnd: "2025-12-31",
      CalendarHours: 8760, OperatingHours: 8000, DowntimeHours: 760, RepairHours: 100,
      FailureCount: 10, MissionTimeHours: 500,
    },
  });
  assert.equal(data.result.mtbfHours, 800);
  assert.equal(data.result.mttrHours, 10);
  assert.equal(data.result.availabilityPct, 91.3242);
  /* بدون Persist هیچ ردیفی نوشته نمی‌شود. */
  assert.equal(data.persisted, null);
});

test("ذخیرهٔ تصویر قابلیت اطمینان بدون تجهیز و خانواده رد می‌شود", async () => {
  const { call, repo } = makeApi();
  await fails(call, "POST", `${ROOT}/reliability/compute`, 400, "CMMS_VALIDATION_FAILED", {
    as: RELIABILITY,
    body: {
      PeriodType: "yearly", PeriodStart: "2025-01-01", PeriodEnd: "2025-12-31",
      CalendarHours: 8760, OperatingHours: 8000, DowntimeHours: 760, FailureCount: 10, Persist: true,
    },
  });
  assert.equal(await repo.count("CmmsReliabilitySnapshot"), 0);
});

test("OEE از HTTP: همان اعداد موتور دامنه", async () => {
  const { call } = makeApi();
  const data = await ok(call, "POST", `${ROOT}/oee/compute`, {
    as: PLANNER,
    body: {
      PeriodType: "daily", PeriodStart: "2026-10-01", PeriodEnd: "2026-10-01",
      CalendarMinutes: 1440, PlannedProductionMinutes: 480, RunMinutes: 420,
      TotalUnits: 20000, GoodUnits: 19600, IdealCycleTimeSeconds: 1.1,
    },
  });
  assert.equal(data.result.availabilityPct, 87.5);
  assert.equal(data.result.performancePct, 87.3);
  assert.equal(data.result.qualityPct, 98);
  assert.equal(data.result.oeePct, 74.86);
});

test("ورودی نامعتبر موتور دامنه ۴۰۰ می‌گیرد نه ۵۰۰", async () => {
  const { call } = makeApi();
  /* run > planned باید RangeError بدهد که لایهٔ HTTP به ۴۰۰ نگاشت می‌کند. */
  const error = await fails(call, "POST", `${ROOT}/oee/compute`, 400, "CMMS_DOMAIN_VALIDATION_FAILED", {
    as: PLANNER,
    body: {
      PeriodType: "daily", PeriodStart: "2026-10-01", PeriodEnd: "2026-10-01",
      CalendarMinutes: 1440, PlannedProductionMinutes: 480, RunMinutes: 600,
      TotalUnits: 100, GoodUnits: 100, IdealCycleTimeSeconds: 1,
    },
  });
  assert.ok(error.message.includes("CMMS_OEE"));
});

test("LCC: محاسبه و انتخاب گزینهٔ بهینه", async () => {
  const { call, repo } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  const first = await ok(call, "POST", `${ROOT}/lcc/compute`, {
    as: ENGINEER,
    body: {
      AssetId: asset.Id, ScenarioName: "نگهداری فعلی", AnalysisDate: "2026-10-01",
      LifeYears: 10, DiscountRatePct: 10, AcquisitionCost: 1000, MaintenanceCostPerYear: 100,
      Persist: true,
    },
  });
  assert.equal(first.result.totalNpv, 1614.46);
  const second = await ok(call, "POST", `${ROOT}/lcc/compute`, {
    as: ENGINEER,
    body: {
      AssetId: asset.Id, ScenarioName: "نوسازی", AnalysisDate: "2026-10-01",
      LifeYears: 10, DiscountRatePct: 10, AcquisitionCost: 2000, MaintenanceCostPerYear: 30,
      Persist: true,
    },
  });
  assert.equal(second.result.totalNpv, 2184.34); /* 2000 + 30 × 6.144567 */
  assert.equal(await repo.count("CmmsLccRecord"), 2);
  const selected = await ok(call, "POST", `${ROOT}/lcc/select`, {
    as: RELIABILITY,
    body: { AssetId: asset.Id, ScenarioIds: [first.persisted.Id, second.persisted.Id] },
  });
  assert.equal(selected.selectedScenarioId, first.persisted.Id, "گزینهٔ ارزان‌تر باید انتخاب شود");
  assert.equal(selected.selected, "نگهداری فعلی");
});

/* ═══════════════════════ ۸. موتورهای AI ═══════════════════════ */

test("AI تحلیل خرابی: پیش‌فرض فقط پیشنهاد است و ردیفی نمی‌نویسد", async () => {
  const { call, repo } = makeApi();
  const data = await ok(call, "POST", `${ROOT}/ai/failure-analysis`, {
    as: ENGINEER,
    body: {
      Symptoms: ["نشتی روغن از مکانیکال سیل"],
      History: [
        { id: "f1", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", symptoms: ["نشتی روغن"], rootCauseFa: "فرسودگی سیل", resolved: true },
        { id: "f2", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", symptoms: ["نشتی روغن"], rootCauseFa: "فرسودگی سیل", resolved: true },
      ],
    },
  });
  assert.ok(data.suggestions.length > 0);
  assert.equal(data.persisted, null, "بدون Persist نباید ردیف AI نوشته شود");
  assert.equal(await repo.count("CmmsAiRun"), 0);
  assert.equal(await repo.count("CmmsAiRecommendation"), 0);
  assert.equal(data.engineVersion, "cmms-ai-v1");
});

test("AI تحلیل خرابی بدون علامت ۴۰۰ می‌گیرد", async () => {
  const { call } = makeApi();
  await fails(call, "POST", `${ROOT}/ai/failure-analysis`, 400, "CMMS_VALIDATION_FAILED", {
    as: ENGINEER, body: { Symptoms: [] },
  });
});

test("AI با Persist، اجرا و پیشنهادها را برای بازبینی ثبت می‌کند", async () => {
  const { call, repo } = makeApi();
  const data = await ok(call, "POST", `${ROOT}/ai/failure-analysis`, {
    as: ENGINEER,
    body: {
      Symptoms: ["نشتی روغن از مکانیکال سیل"],
      History: [
        { id: "f1", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", symptoms: ["نشتی روغن"], rootCauseFa: "فرسودگی سیل", resolved: true },
      ],
      Persist: true,
    },
  });
  assert.ok(data.persisted);
  assert.equal(await repo.count("CmmsAiRun"), 1);
  const runs = await repo.list("CmmsAiRun");
  assert.equal(runs[0].Engine, "failure-analysis");
  /* هر پیشنهاد باید «proposed» باشد — هیچ‌کدام خودکار اعمال نمی‌شود. */
  const recommendations = await repo.list("CmmsAiRecommendation");
  assert.ok(recommendations.length > 0);
  for (const recommendation of recommendations) {
    assert.equal(recommendation.Status, "proposed");
  }
});

test("تصمیم روی پیشنهاد AI: یک‌بار پذیرش، بار دوم ۴۰۹", async () => {
  const { call, repo } = makeApi();
  const data = await ok(call, "POST", `${ROOT}/ai/failure-analysis`, {
    as: ENGINEER,
    body: {
      Symptoms: ["نشتی روغن"],
      History: [{ id: "f1", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", symptoms: ["نشتی روغن"], rootCauseFa: "فرسودگی سیل", resolved: true }],
      Persist: true,
    },
  });
  const recommendations = await repo.list("CmmsAiRecommendation");
  const target = recommendations[0];
  const decided = await ok(call, "POST", `${ROOT}/ai/recommendations/:recommendationId/decide`, {
    as: MANAGER, params: { recommendationId: target.Id }, body: { Decision: "accept", DecisionNoteFa: "تأیید مهندس" },
  });
  assert.equal(decided.Status, "accepted");
  assert.equal(decided.DecidedById, MANAGER);
  await fails(call, "POST", `${ROOT}/ai/recommendations/:recommendationId/decide`, 409, "CMMS_AI_ALREADY_DECIDED", {
    as: MANAGER, params: { recommendationId: target.Id }, body: { Decision: "reject" },
  });
  assert.ok(data.suggestions.length > 0);
});

test("اعمال پیشنهاد AI مجوز مستقل می‌خواهد و تکنسین آن را ندارد", async () => {
  const { call, repo } = makeApi();
  await ok(call, "POST", `${ROOT}/ai/failure-analysis`, {
    as: ENGINEER,
    body: {
      Symptoms: ["نشتی روغن"],
      History: [{ id: "f1", assetId: "P-101", failureMode: "leakage", failureMechanism: "wear", symptoms: ["نشتی روغن"], rootCauseFa: "فرسودگی سیل", resolved: true }],
      Persist: true,
    },
  });
  const [target] = await repo.list("CmmsAiRecommendation");
  await fails(call, "POST", `${ROOT}/ai/recommendations/:recommendationId/decide`, 403, "CMMS_FORBIDDEN", {
    as: TECH, params: { recommendationId: target.Id }, body: { Decision: "apply" },
  });
});

test("AI بهینه‌سازی PM با دادهٔ ناکافی، پیشنهاد صریح «توصیه‌ای نیست» می‌دهد", async () => {
  const { call } = makeApi();
  const data = await ok(call, "POST", `${ROOT}/ai/pm-optimization`, {
    as: RELIABILITY,
    body: { PreventiveCost: 1000, FailureCost: 20000, MeanRepairHours: 20, TtfHours: [100, 200] },
  });
  assert.equal(data.suggestion.confidence, 0);
  assert.equal(data.suggestion.suggestedValue.recommendedInterval, null);
});

test("AI تولید درخت: پیش‌فرض گره نمی‌سازد و با CreateNodes می‌سازد", async () => {
  const { call, repo } = makeApi();
  const { family } = await seedFamilyAndAsset(call);
  const catalogText = ["1 پمپ P-101", "1.1 الکتروموتور", "1.2 پروانه"].join("\n");
  const preview = await ok(call, "POST", `${ROOT}/ai/tree-generator`, {
    as: ENGINEER, body: { CatalogText: catalogText, EquipmentCode: "P-101" },
  });
  assert.equal(preview.nodes.length, 3);
  assert.equal(preview.createdNodes, 0);
  assert.equal(await repo.count("CmmsFamilyNode"), 0);

  const created = await ok(call, "POST", `${ROOT}/ai/tree-generator`, {
    as: ENGINEER,
    body: { CatalogText: catalogText, EquipmentCode: "P-101", FamilyId: family.Id, Persist: true, CreateNodes: true },
  });
  assert.equal(created.createdNodes, 3);
  assert.equal(await repo.count("CmmsFamilyNode"), 3);
  /* گره‌ها باید والد درست داشته باشند. */
  const nodes = await repo.list("CmmsFamilyNode");
  const motor = nodes.find((node) => node.NameFa.includes("الکتروموتور"));
  const root = nodes.find((node) => node.ParentNodeId === null || node.PathLevel === 1);
  assert.ok(motor.ParentNodeId === root.Id, "الکتروموتور باید فرزند ریشه باشد");
});

test("AI زمان‌بند: کار بیش از سقف روز با دلیل برمی‌گردد", async () => {
  const { call } = makeApi();
  const data = await ok(call, "POST", `${ROOT}/ai/smart-scheduler`, {
    as: PLANNER,
    body: {
      WorkOrders: [
        { id: "wo1", estimatedHours: 8, requiredSkill: "mechanical", criticalityRank: "A", isAssetDown: true, productionImpact: "plant-stop", dueDate: "2026-10-05", safetyConcern: true },
        { id: "wo2", estimatedHours: 40, requiredSkill: "mechanical", criticalityRank: "B", isAssetDown: false, productionImpact: "partial", dueDate: "2026-10-05" },
      ],
      Technicians: [{ id: "t1", nameFa: "تکنسین", skills: [{ key: "mechanical", level: 4 }], dailyCapacityHours: 8 }],
      Calendar: Array.from({ length: 5 }, (_, index) => ({ date: `2026-10-0${index + 1}`, working: true, isProductionBreak: index === 2 })),
    },
  });
  assert.equal(data.assignments.length, 1);
  assert.equal(data.unassigned.length, 1);
  assert.ok(data.unassigned[0].reasonFa.length > 0);
  assert.equal(data.summary.assignedOrders, 1);
});

/* ═══════════════════════ ۹. داشبورد و ممیزی ═══════════════════════ */

test("داشبورد شمارش‌های سایت را برمی‌گرداند", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  await created(call, `${ROOT}/work-orders`, {
    as: PLANNER, body: { WorkOrderNo: "WO-DASH", WorkOrderType: "cm", AssetId: asset.Id, TitleFa: "داشبورد" },
  });
  const data = await ok(call, "GET", `${ROOT}/dashboard`, { as: MANAGER });
  assert.equal(data.counts.assets, 1);
  assert.equal(data.counts.criticalAssets, 1);
  assert.equal(data.counts.workOrders, 1);
  assert.equal(data.workOrdersByStatus.draft, 1);
  assert.equal(data.modelVersion, "cmms-domain-v1");
});

test("هر فرمان موفق یک ردیف ممیزی در همان تراکنش می‌نویسد", async () => {
  const { call, repo } = makeApi();
  await created(call, `${ROOT}/family-groups`, {
    as: ENGINEER, body: { GroupCode: "GRP-AUD", NameFa: "گروه ممیزی", EquipmentClass: "pump" },
  });
  const audits = await repo.list("AuditLog");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].Action, "CMMS_FAMILY_GROUP_CREATED");
  assert.equal(audits[0].Permission, "cmms.family.edit");
  assert.equal(audits[0].SubjectId, ENGINEER);
  assert.equal(audits[0].Details.siteId, SITE);
  assert.equal(audits[0].Details.traceId, "cmms-test");
});

test("خطای داخلی سرور ۵۰۰ می‌شود ولی جزئیات داخلی را لو نمی‌دهد", async () => {
  const { call, repo } = makeApi();
  /* مخزن را عمداً خراب می‌کنیم تا مسیر خطای ناشناخته آزموده شود. */
  repo.list = async () => { throw new Error("connection reset by peer at 10.0.0.7:1433"); };
  const res = await call("GET", `${ROOT}/assets`, {
    params: { siteId: SITE }, headers: { "x-user-id": MANAGER }, query: {}, body: {},
  });
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error.code, "CMMS_INTERNAL_ERROR");
  assert.ok(!res.body.error.message.includes("10.0.0.7"), "پیام خطا نباید جزئیات اتصال را لو بدهد");
});

test("خطای دسترسی به مخزن ۵۰۳ می‌شود", async () => {
  const { call, repo } = makeApi();
  const error = Object.assign(new Error("db down"), { code: "PERSISTENCE_UNAVAILABLE" });
  repo.list = async () => { throw error; };
  const res = await call("GET", `${ROOT}/assets`, {
    params: { siteId: SITE }, headers: { "x-user-id": MANAGER }, query: {}, body: {},
  });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, "CMMS_PERSISTENCE_UNAVAILABLE");
});

/* ─────────────────────── گردش‌کار (Workflow) ───────────────────────
 *
 * این سه آزمون یک نقص امنیتی واقعی را قفل می‌کنند. پیش از این، گذارهای
 * مشروط به مجوز مجوزهای کنش‌گر را از `req.cmmsSubjectPermissions` می‌خواندند
 * که هیچ‌کس هرگز مقدارش را تنظیم نمی‌کرد — یعنی همیشه فهرست خالی بود و
 * **هر** گذار مشروط به `CMMS_WF_FORBIDDEN` می‌رسید. اکنون مجوزها از
 * موتور RBAC و نقش‌های واقعی سوژهٔ احراز‌هویت‌شده مشتق می‌شوند.
 *
 * نقش‌ها عمداً این‌گونه انتخاب شده‌اند:
 *   مدیر   → `cmms.workflow.view` دارد و `cmms.wo.release` هم دارد  ⇒ گذار می‌کند
 *   برنامه‌ریز → `cmms.workflow.view` دارد ولی `cmms.wo.release` ندارد ⇒ رد می‌شود
 * هر دو از گارد خودِ مسیر عبور می‌کنند، پس تفاوت نتیجه فقط از مجوز گذار است.
 */

const WF_STEPS = [
  { StepCode: "draft", NameFa: "پیش‌نویس", StepKind: "task", OwnerRole: "maintenance_planner" },
  { StepCode: "approved", NameFa: "تصویب‌شده", StepKind: "approval", OwnerRole: "maintenance_manager" },
  { StepCode: "closed", NameFa: "بسته‌شده", StepKind: "end", OwnerRole: "maintenance_manager", IsTerminal: true },
];
const WF_TRANSITIONS = [
  { FromStepCode: "draft", ToStepCode: "approved", ActionCode: "approve", RequiredPermission: "cmms.wo.release" },
  { FromStepCode: "approved", ToStepCode: "closed", ActionCode: "complete", RequiredPermission: "cmms.wo.close" },
];

/** یک تعریف گردش‌کار و یک نمونهٔ در حال اجرا روی گام آغازین می‌سازد. */
async function seedWorkflowInstance(call) {
  const definition = await created(call, `${ROOT}/workflows`, {
    as: MANAGER,
    body: {
      WorkflowCode: "WF-WO-APPROVAL", NameFa: "تصویب دستورکار",
      AppliesTo: "work-order", StartStepCode: "draft",
      Steps: WF_STEPS, Transitions: WF_TRANSITIONS,
    },
  });
  const instance = await created(call, `${ROOT}/workflow-instances`, {
    as: MANAGER,
    body: { WorkflowDefinitionId: definition.Id, SubjectEntity: "CmmsWorkOrder", SubjectId: "WO-1" },
  });
  assert.equal(instance.CurrentStepCode, "draft");
  return instance;
}

test("گذار مشروط به مجوز برای دارندهٔ مجوز انجام می‌شود", async () => {
  const { call } = makeApi();
  const instance = await seedWorkflowInstance(call);
  const data = await ok(call, "POST", `${ROOT}/workflow-instances/:instanceId/advance`, {
    as: MANAGER,
    params: { instanceId: instance.Id },
    body: { ActionCode: "approve" },
  });
  assert.equal(data.advanced.nextStepCode, "approved");
  assert.equal(data.instance.CurrentStepCode, "approved");
  assert.equal(data.instance.State, "running");
  /* مالک گام بعدی باید از تعریف گام بیاید، نه از درخواست. */
  assert.equal(data.instance.CurrentOwnerId, "maintenance_manager");
});

test("گذار مشروط به مجوز برای کاربر بدون آن مجوز رد می‌شود", async () => {
  const { call, repo } = makeApi();
  const instance = await seedWorkflowInstance(call);
  /* نگاشت خطای لایه: `CMMS_WF_FORBIDDEN` تنها خطای گردش‌کاری است که ۴۰۳
   * می‌شود؛ بقیهٔ خطاهای CMMS_WF_* قواعد کسب‌وکارند و ۴۲۲. */
  const error = await fails(call, "POST", `${ROOT}/workflow-instances/:instanceId/advance`,
    403, "CMMS_WF_FORBIDDEN", { as: PLANNER, params: { instanceId: instance.Id }, body: { ActionCode: "approve" } });
  assert.match(error.message, /cmms\.wo\.release/);
  /* نمونه نباید جلو رفته باشد — ردشدن باید بی‌اثر بماند. مسیر فهرست
   * نمونه‌ها وجود ندارد، پس وضعیت را مستقیم از مخزن می‌خوانیم. */
  const still = await repo.get("CmmsWorkflowInstance", instance.Id);
  assert.equal(still.CurrentStepCode, "draft");
  assert.equal(still.State, "running");
  /* رویدادی هم نباید ثبت شده باشد، وگرنه ممیزی گذار ناموفق را موفق نشان می‌دهد. */
  const events = await repo.list("CmmsWorkflowEvent", []);
  assert.equal(events.length, 0);
});

test("کلاینت نمی‌تواند مجوز گذار را خودش در بدنهٔ درخواست اعلام کند", async () => {
  const { call } = makeApi();
  const instance = await seedWorkflowInstance(call);
  /* اگر این بدنه پذیرفته می‌شد، برنامه‌ریز می‌توانست با اعلام `cmms.wo.release`
   * هر تصویبی را برای خودش باز کند. پس باید پیش از ورود به موتور رد شود. */
  const error = await fails(call, "POST", `${ROOT}/workflow-instances/:instanceId/advance`,
    400, "CMMS_VALIDATION_FAILED", {
      as: PLANNER, params: { instanceId: instance.Id },
      body: { ActionCode: "approve", ActorPermissions: ["cmms.wo.release"] },
    });
  assert.equal(error.field, "ActorPermissions");
});

/* ═══════════════════ ۹. فاز ۴ — توقف/ادامهٔ دستورکار (Hold / Resume) ═══════════════════
 *
 * ماشین وضعیت دامنه از پیش `on-hold` را می‌شناخت، اما مسیر REST نداشت؛ این
 * بخش همان شکاف را می‌بندد: علت از کاتالوگ بسته، ردیف توقف باز، بازگشت به
 * وضعیت پیش از توقف، و رویداد توقف برای MES.
 */

/** یک دستورکار آزادشده می‌سازد؛ ورودی اختیاری برای گره‌زدن تجهیز به مرکز کاری. */
async function seedReleasedWorkOrder(call, { workOrderNo = "WO-HOLD", workCenterRef = null, planned = false } = {}) {
  const { asset } = await seedFamilyAndAsset(call, { assetTag: `P-${workOrderNo}` });
  if (workCenterRef) {
    await ok(call, "PATCH", `${ROOT}/assets/:assetId`, {
      as: ENGINEER, params: { assetId: asset.Id },
      body: { MfgWorkCenterId: workCenterRef, RowVersion: asset.RowVersion },
      /* مجوز ویرایش تجهیز با مهندس است؛ مقدار RowVersion از خود رکورد می‌آید. */
    });
  }
  const createdWorkOrder = await created(call, `${ROOT}/work-orders`, {
    as: PLANNER,
    body: {
      WorkOrderNo: workOrderNo, WorkOrderType: "cm", AssetId: asset.Id, TitleFa: "کار آزمون توقف",
      ...(planned ? { PlannedStartAt: "2026-11-02T08:00:00Z", PlannedFinishAt: "2026-11-02T12:00:00Z" } : {}),
    },
  });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/release`, { as: MANAGER, params: { workOrderId: createdWorkOrder.Id } });
  return { asset, workOrder: createdWorkOrder };
}

test("توقف با کد علت ناشناخته ۴۰۰ می‌گیرد و کاتالوگ علل را برمی‌گرداند", async () => {
  const { call } = makeApi();
  const { workOrder } = await seedReleasedWorkOrder(call, { workOrderNo: "WO-H1" });
  const error = await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, 400, "CMMS_VALIDATION_FAILED", {
    as: MANAGER, params: { workOrderId: workOrder.Id }, body: { HoldReasonCode: "why-not" },
  });
  assert.ok(Array.isArray(error.allowed) && error.allowed.includes("waiting-parts"));
  /* علت «سایر» شرح الزامی دارد — اثبات قاعده در همان مسیر. */
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, 400, "CMMS_VALIDATION_FAILED", {
    as: MANAGER, params: { workOrderId: workOrder.Id }, body: { HoldReasonCode: "other" },
  });
});

test("توقف، دستورکار را on-hold می‌کند و ردیف توقف باز و تاریخچه می‌سازد", async () => {
  const { call } = makeApi();
  const { workOrder } = await seedReleasedWorkOrder(call, { workOrderNo: "WO-H2" });
  const data = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, {
    as: TECH, params: { workOrderId: workOrder.Id },
    body: { HoldReasonCode: "waiting-parts", NoteFa: "قطعهٔ یدکی در انبار نیست" },
  });
  assert.equal(data.workOrder.Status, "on-hold");
  assert.equal(data.hold.HoldStatus, "open");
  assert.equal(data.hold.PreviousStatus, "released");
  assert.equal(data.hold.HoldCategory, "material");
  assert.equal(data.hold.DowntimeType, "unplanned");
  assert.equal(data.hold.HeldBy, TECH);
  /* بدون ارجاع تجهیز به مرکز کاری، رویداد بی‌مقصد ساخته نمی‌شود. */
  assert.equal(data.integration, null);

  const history = await ok(call, "GET", `${ROOT}/work-orders/:workOrderId/holds`, {
    as: MANAGER, params: { workOrderId: workOrder.Id },
  });
  assert.equal(history.total, 1);
  assert.equal(history.summary.count, 1);
  assert.equal(history.summary.openHold, true);
  assert.equal(history.summary.topReasonCode, "waiting-parts");
  /* دستورکار متوقف، در فهرست بازها با وضعیت on-hold دیده می‌شود. */
  const list = await ok(call, "GET", `${ROOT}/work-orders`, { as: MANAGER, query: { status: "on-hold" } });
  assert.deepEqual(list.workOrders.map((row) => row.Id), [workOrder.Id]);
});

test("توقف دوباره روی توقف باز ۴۲۲ می‌گیرد و شروع، توقف را با مسیر start می‌بندد", async () => {
  const { call } = makeApi();
  const { workOrder } = await seedReleasedWorkOrder(call, { workOrderNo: "WO-H3" });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, {
    as: TECH, params: { workOrderId: workOrder.Id }, body: { HoldReasonCode: "machine-breakdown" },
  });
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, 422, "CMMS_HOLD_ALREADY_OPEN", {
    as: TECH, params: { workOrderId: workOrder.Id }, body: { HoldReasonCode: "waiting-crew" },
  });
  /* شروع از وضعیت on-hold مجاز است و همان ردیف باز را می‌بندد. */
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/start`, { as: TECH, params: { workOrderId: workOrder.Id } });
  const history = await ok(call, "GET", `${ROOT}/work-orders/:workOrderId/holds`, {
    as: TECH, params: { workOrderId: workOrder.Id },
  });
  assert.equal(history.summary.openHold, false);
  assert.equal(history.holds[0].ResumedVia, "start");
  assert.equal(typeof history.holds[0].DurationMinutes, "number");
});

test("ادامه، دستورکار را به وضعیت پیش از توقف برمی‌گرداند — نه به in-progress همیشه", async () => {
  const { call } = makeApi();
  const { workOrder } = await seedReleasedWorkOrder(call, { workOrderNo: "WO-H4" });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, {
    as: TECH, params: { workOrderId: workOrder.Id }, body: { HoldReasonCode: "waiting-permit" },
  });
  const data = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/resume`, {
    as: TECH, params: { workOrderId: workOrder.Id }, body: { ResumeNoteFa: "مجوز صادر شد" },
  });
  /* وضعیت پیش از توقف released بود؛ ادامه باید همان را بازگرداند تا WO از
   * مسیر آزادسازی بیرون نزند. */
  assert.equal(data.workOrder.Status, "released");
  assert.equal(data.hold.HoldStatus, "resumed");
  assert.equal(data.hold.ResumedVia, "resume");
  assert.equal(data.hold.ResumedBy, TECH);
  /* توقف برنامه‌ریزی‌شده (انتظار مجوز) از زمان تولید کم می‌شود، نه از دسترس‌پذیری. */
  assert.equal(data.hold.DowntimeType, "planned");
  await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/resume`, 422, "CMMS_HOLD_NOT_OPEN", {
    as: TECH, params: { workOrderId: workOrder.Id }, body: {},
  });
});

test("توقف دستورکار draft مجاز نیست و وضعیت‌های مجاز را برمی‌گرداند", async () => {
  const { call } = makeApi();
  const { asset } = await seedFamilyAndAsset(call);
  const workOrder = await created(call, `${ROOT}/work-orders`, {
    as: PLANNER, body: { WorkOrderNo: "WO-H5", WorkOrderType: "cm", AssetId: asset.Id, TitleFa: "پیش‌نویس" },
  });
  const error = await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, 422, "CMMS_WO_STATE", {
    as: MANAGER, params: { workOrderId: workOrder.Id }, body: { HoldReasonCode: "waiting-parts" },
  });
  assert.deepEqual(error.allowedFrom, ["planned", "scheduled", "released", "in-progress"]);
});

test("ادامه مجوز مستقل می‌خواهد: برنامه‌ریز می‌تواند متوقف کند ولی نه ادامه دهد", async () => {
  const { call } = makeApi();
  const { workOrder } = await seedReleasedWorkOrder(call, { workOrderNo: "WO-H6" });
  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, {
    as: PLANNER, params: { workOrderId: workOrder.Id }, body: { HoldReasonCode: "waiting-production-window" },
  });
  const error = await fails(call, "POST", `${ROOT}/work-orders/:workOrderId/resume`, 403, "CMMS_FORBIDDEN", {
    as: PLANNER, params: { workOrderId: workOrder.Id }, body: {},
  });
  assert.equal(error.permission, "cmms.wo.resume");
});

/* ═══════════════════ ۱۰. RCFA تعاملی: ۵ چرا، استخوان‌ماهی، پارتو و CAPA ═══════════════════ */

/** پروندهٔ RCFA با زنجیرهٔ سه‌سطحی و ریشهٔ مستند می‌سازد. */
async function seedRcaCaseWithChain(call, { caseNo = "RCA-1" } = {}) {
  const { asset } = await seedFamilyAndAsset(call, { assetTag: `A-${caseNo}` });
  const rcaCase = await created(call, `${ROOT}/rca-cases`, {
    as: RELIABILITY,
    body: { CaseNo: caseNo, AssetId: asset.Id, Method: "combined", ProblemStatementFa: "نشتی مکرر پمپ در خط ۲" },
  });
  const statements = ["آب‌بند فرسوده شد", "آب‌بند در PM تعویض نشد", "فعالیت تعویض آب‌بند در برنامهٔ PM تعریف نشده بود"];
  for (let index = 0; index < statements.length; index += 1) {
    await created(call, `${ROOT}/rca-cases/:caseId/entries`, {
      as: RELIABILITY, params: { caseId: rcaCase.Id },
      body: {
        EntryType: "why", Sequence: index + 1, StatementFa: statements[index],
        IsRootCause: index === statements.length - 1,
        EvidencePath: index === statements.length - 1 ? "doc:PM-PROGRAM-REV7" : null,
      },
    });
  }
  return { asset, rcaCase };
}

test("RCFA: زنجیرهٔ ۵ چرا با پرسش سطح بعدی و ارزیابی پیوستگی برمی‌گردد", async () => {
  const { call } = makeApi();
  const { rcaCase } = await seedRcaCaseWithChain(call, { caseNo: "RCA-2" });
  const detail = await ok(call, "GET", `${ROOT}/rca-cases/:caseId`, { as: RELIABILITY, params: { caseId: rcaCase.Id } });
  assert.equal(detail.whys.length, 3);
  assert.equal(detail.analysis.whyChain.depth, 3);
  assert.equal(detail.analysis.whyChain.terminated, true);
  assert.equal(detail.analysis.whyChain.rootCauseLevel, 3);
  assert.equal(detail.analysis.whyChain.evidencedCount, 1);
  assert.deepEqual(detail.analysis.whyChain.issues, []);
  /* پرسش سطح بعد از سطح پیشین ساخته می‌شود؛ متن ثابت نیست. */
  assert.match(detail.analysis.nextWhy, /تعریف نشده بود/);
  /* بدون CAPA، پرونده «آماده» نیست — بستن بی‌اقدام ممنوع است. */
  assert.equal(detail.analysis.readiness.ready, false);
  assert.ok(detail.analysis.readiness.blockers.some((item) => item.includes("CAPA")));
});

test("RCFA: علت استخوان‌ماهی با دستهٔ نامعتبر رد و ریشهٔ بدون شاهد رد می‌شود", async () => {
  const { call } = makeApi();
  const { rcaCase } = await seedRcaCaseWithChain(call, { caseNo: "RCA-3" });
  await fails(call, "POST", `${ROOT}/rca-cases/:caseId/causes`, 400, "CMMS_VALIDATION_FAILED", {
    as: RELIABILITY, params: { caseId: rcaCase.Id },
    body: { Category: "weather", StatementFa: "شاخهٔ نامعتبر است" },
  });
  await fails(call, "POST", `${ROOT}/rca-cases/:caseId/causes`, 400, "CMMS_VALIDATION_FAILED", {
    as: RELIABILITY, params: { caseId: rcaCase.Id },
    body: { Category: "method", StatementFa: "روش بازرسی مبهم است", IsRootCause: true },
  });
  const causeRow = await created(call, `${ROOT}/rca-cases/:caseId/causes`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id },
    body: {
      Category: "method", StatementFa: "روش بازرسی آب‌بند مکتوب نشده است",
      OccurrenceCount: 5, ImpactScore: 9, DetectionScore: 6, IsRootCause: true, EvidenceRef: "audit:PROC-12",
    },
  });
  assert.equal(causeRow.cause.Category, "method");
  assert.equal(causeRow.cause.IsRootCause, true);
  assert.equal(causeRow.cause.VerifiedBy, RELIABILITY);
  assert.equal(causeRow.fishbone.byCategory.find((row) => row.category === "method").rootCauseCount, 1);
  /* پرونده باز، با نخستین علت به in-progress می‌رود. */
  const [caseRow] = await (async () => [await ok(call, "GET", `${ROOT}/rca-cases/:caseId`, { as: RELIABILITY, params: { caseId: rcaCase.Id } })] )();
  assert.equal(caseRow.case.Status, "in-progress");
});

test("RCFA: پارتو وزنی، سهم علت کم‌تکرار با اثر بالا را از حالت شمارشی بزرگ‌تر می‌کند", async () => {
  const { call } = makeApi();
  const { rcaCase } = await seedRcaCaseWithChain(call, { caseNo: "RCA-4" });
  for (const cause of [
    { Category: "machine", StatementFa: "لقی محور پمپ", OccurrenceCount: 9, ImpactScore: 3 },
    { Category: "method", StatementFa: "نبود دستورالعمل ایمنی بازرسی", OccurrenceCount: 1, ImpactScore: 10 },
  ]) {
    await created(call, `${ROOT}/rca-cases/:caseId/causes`, {
      as: RELIABILITY, params: { caseId: rcaCase.Id }, body: cause,
    });
  }
  const detail = await ok(call, "GET", `${ROOT}/rca-cases/:caseId`, { as: RELIABILITY, params: { caseId: rcaCase.Id } });
  const pareto = detail.analysis.pareto;
  assert.equal(pareto.mode, "weighted");
  assert.equal(pareto.rows.length, 2);
  /* علت با ۹ وقوع و شدت ۳ وزن ۲۷ و علت با ۱ وقوع و شدت ۱۰ وزن ۱۰ می‌گیرد؛
   * در حالت شمارشی سهم علت دوم فقط ۱۰٪ بود. `value` همان فراوانی خام است. */
  assert.equal(pareto.total, 37);
  assert.equal(pareto.rows[0].value, 9);
  assert.equal(pareto.rows[0].sharePct, 72.97);
  assert.equal(pareto.rows[1].sharePct, 27.03);
  assert.equal(pareto.rows[1].classification, "trivial-many");
  assert.deepEqual(pareto.issues, []);
});

test("CAPA: سررسید پیش‌فرض از اولویت، اجرای مستند و تأیید اثربخشی", async () => {
  const { call } = makeApi();
  const { rcaCase } = await seedRcaCaseWithChain(call, { caseNo: "RCA-5" });
  const capa = await created(call, `${ROOT}/rca-cases/:caseId/capas`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id },
    body: { ActionType: "preventive", StatementFa: "افزودن بازرسی آب‌بند به برنامهٔ PM", Priority: 1, OwnerUserId: "u-cmms-tech" },
  });
  assert.equal(capa.Status, "assigned");
  assert.equal(capa.ReferralKind, "owner");
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(capa.DueOn), "سررسید پیش‌فرض باید تاریخ باشد");
  /* اجرا بدون شاهد یعنی ممیزی بی‌ارزش. */
  await fails(call, "POST", `${ROOT}/rca-cases/:caseId/capas/:capaId/implement`, 400, "CMMS_VALIDATION_FAILED", {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id }, body: {},
  });
  const implemented = await ok(call, "POST", `${ROOT}/rca-cases/:caseId/capas/:capaId/implement`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id },
    body: { ImplementationEvidenceRef: "WO-PM-8821" },
  });
  assert.equal(implemented.Status, "implemented");
  /* اثربخشی ناکافی، اقدام را به جریان برمی‌گرداند تا بسته شمرده نشود. */
  const ineffective = await ok(call, "POST", `${ROOT}/rca-cases/:caseId/capas/:capaId/verify`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id },
    body: { VerificationResult: "ineffective", VerificationNoteFa: "نشتی تکرار شد" },
  });
  assert.equal(ineffective.capa.Status, "in-progress");
  assert.ok(ineffective.readiness.blockers.length > 0);
  await ok(call, "POST", `${ROOT}/rca-cases/:caseId/capas/:capaId/implement`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id },
    body: { ImplementationEvidenceRef: "WO-PM-9100" },
  });
  const effective = await ok(call, "POST", `${ROOT}/rca-cases/:caseId/capas/:capaId/verify`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id },
    body: { VerificationResult: "effective" },
  });
  assert.equal(effective.capa.Status, "verified");
  assert.equal(effective.capa.VerificationResult, "effective");
  /* بدون نقش مهندس قابلیت اطمینان، تأیید اثربخشی ممکن نیست. */
  await fails(call, "POST", `${ROOT}/rca-cases/:caseId/capas/:capaId/verify`, 403, "CMMS_FORBIDDEN", {
    as: TECH, params: { caseId: rcaCase.Id, capaId: capa.Id }, body: { VerificationResult: "effective" },
  });
});

test("CAPA: ارجاع به دستورکار جدید، و ارجاع دوباره ۴۰۹ می‌گیرد", async () => {
  const { call } = makeApi();
  const { rcaCase } = await seedRcaCaseWithChain(call, { caseNo: "RCA-6" });
  const capa = await created(call, `${ROOT}/rca-cases/:caseId/capas`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id },
    body: { ActionType: "corrective", StatementFa: "تعویض آب‌بند و بازسازی محور", Priority: 2 },
  });
  const referred = await created(call, `${ROOT}/rca-cases/:caseId/capas/:capaId/refer`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id },
    body: { ReferralKind: "work-order", WorkOrderType: "cm" },
  });
  assert.equal(referred.capa.AutoCreatedWorkOrder, true);
  assert.equal(referred.capa.ReferralKind, "work-order");
  assert.equal(referred.workOrder.WorkOrderNo, "CAPA-RCA-6-01");
  assert.equal(referred.workOrder.AssetId, rcaCase.AssetId);
  assert.equal(referred.workOrder.Status, "draft");
  await fails(call, "POST", `${ROOT}/rca-cases/:caseId/capas/:capaId/refer`, 409, "CMMS_CAPA_ALREADY_REFERRED", {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id },
    body: { ReferralKind: "work-order" },
  });
  /* ارجاع به مالک انسانی هم مسیر مستند دارد. */
  const assigned = await created(call, `${ROOT}/rca-cases/:caseId/capas/:capaId/refer`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id },
    body: { ReferralKind: "training", OwnerNameFa: "واحد آموزش فنی" },
  });
  assert.equal(assigned.capa.ReferralKind, "training");
  assert.equal(assigned.capa.OwnerNameFa, "واحد آموزش فنی");
  assert.equal(assigned.workOrder, null);
});

test("RCFA: بستن تا آماده‌نشدن شرایط، ۴۲۲ با فهرست موانع می‌گیرد", async () => {
  const { call } = makeApi();
  const { rcaCase } = await seedRcaCaseWithChain(call, { caseNo: "RCA-7" });
  const blocked = await fails(call, "POST", `${ROOT}/rca-cases/:caseId/close`, 422, "CMMS_RCA_NOT_READY", {
    as: RELIABILITY, params: { caseId: rcaCase.Id },
    body: { RootCauseFa: "نبود فعالیت تعویض آب‌بند در برنامهٔ PM" },
  });
  assert.ok(Array.isArray(blocked.blockers) && blocked.blockers.length > 0);
  assert.ok(blocked.blockers.some((item) => item.includes("CAPA")));

  const capa = await created(call, `${ROOT}/rca-cases/:caseId/capas`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id },
    body: { ActionType: "preventive", StatementFa: "بازبینی برنامهٔ PM برای آب‌بند", Priority: 2, OwnerUserId: "u-cmms-tech" },
  });
  await ok(call, "POST", `${ROOT}/rca-cases/:caseId/capas/:capaId/implement`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id }, body: { ImplementationEvidenceRef: "REV-7" },
  });
  await ok(call, "POST", `${ROOT}/rca-cases/:caseId/capas/:capaId/verify`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id, capaId: capa.Id }, body: { VerificationResult: "effective" },
  });
  const closed = await ok(call, "POST", `${ROOT}/rca-cases/:caseId/close`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id },
    body: { RootCauseFa: "نبود فعالیت تعویض آب‌بند در برنامهٔ PM" },
  });
  assert.equal(closed.case.Status, "closed");
  assert.equal(closed.readiness.ready, true);
  assert.equal(closed.case.RootCauseFa, "نبود فعالیت تعویض آب‌بند در برنامهٔ PM");
  /* پروندهٔ بسته با اثربخشی تأییدشده به verified می‌رود. */
  const verified = await ok(call, "POST", `${ROOT}/rca-cases/:caseId/close`, {
    as: RELIABILITY, params: { caseId: rcaCase.Id },
    body: { RootCauseFa: "نبود فعالیت تعویض آب‌بند در برنامهٔ PM" },
  });
  assert.equal(verified.case.Status, "verified");
  assert.ok(verified.case.EffectivenessVerifiedOn);
});

/* ═══════════════════ ۱۱. یکپارچگی بین‌بخشی: صف رویداد و بلوکهٔ نرم ظرفیت ═══════════════════ */

/** حمل‌ونقل آزمایشی — همان قرارداد `deliver` که سرور در استقرار واقعی تزریق می‌کند. */
function makeTransport({ fail = false } = {}) {
  const calls = [];
  return {
    calls,
    async deliver(event) {
      calls.push(event);
      if (fail) return { ok: false, code: "E-MES-REJECTED", messageFa: "MES رویداد را نپذیرفت" };
      return { ok: true, externalRef: `MES-DT-${calls.length}`, ack: { model: "cmms-mes-bridge-v1", applied: { duplicate: false } } };
    },
  };
}

test("توقف دستورکارِ گره‌خورده به مرکز کاری، رویداد downtime.started می‌سازد و تحویل می‌شود", async () => {
  const transport = makeTransport();
  const { call } = makeApi({ transport });
  const { workOrder } = await seedReleasedWorkOrder(call, { workOrderNo: "WO-I1", workCenterRef: "WC-LINE-2" });
  const data = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, {
    as: MANAGER, params: { workOrderId: workOrder.Id },
    body: { HoldReasonCode: "machine-breakdown", NoteFa: "یاتاقان داغ کرد" },
  });
  assert.equal(data.integration.delivered, true);
  assert.equal(data.integration.status, "acknowledged");
  assert.equal(data.integration.externalRef, "MES-DT-1");
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].eventType, "downtime.started");
  assert.equal(transport.calls[0].targetRef, "WC-LINE-2");
  assert.equal(transport.calls[0].payload.contract, "cmms-mes-v1");
  assert.equal(transport.calls[0].payload.downtimeType, "unplanned");
  assert.equal(transport.calls[0].payload.workCenterRef, "WC-LINE-2");

  /* ادامه، رویداد پایان را با همان زنجیرهٔ همبستگی می‌فرستد. */
  const resumed = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/resume`, {
    as: MANAGER, params: { workOrderId: workOrder.Id }, body: {},
  });
  assert.equal(transport.calls.length, 2);
  assert.equal(transport.calls[1].eventType, "downtime.finished");
  assert.ok(transport.calls[1].payload.durationMinutes >= 0);
  assert.equal(resumed.integration.delivered, true);

  const events = await ok(call, "GET", `${ROOT}/integration/events`, {
    as: MANAGER, query: { eventType: "downtime.finished" },
  });
  assert.equal(events.total, 1);
  assert.equal(events.events[0].Status, "acknowledged");
  /* خلاصهٔ صف، نمای کل سایت است نه نمای فیلترشده؛ هر دو رویداد تحویل شده‌اند. */
  assert.equal(events.summary.acknowledged, 2);
  assert.equal(events.summary.pending, 0);
  assert.equal(events.summary.total, 2);
});

test("تحویل ناموفق، رویداد را failed می‌کند و دوباره‌فرستادن خطا را برمی‌گرداند", async () => {
  const transport = makeTransport({ fail: true });
  const { call } = makeApi({ transport });
  const { workOrder } = await seedReleasedWorkOrder(call, { workOrderNo: "WO-I2", workCenterRef: "WC-LINE-3" });
  const data = await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/hold`, {
    as: MANAGER, params: { workOrderId: workOrder.Id }, body: { HoldReasonCode: "waiting-vendor" },
  });
  assert.equal(data.integration.delivered, false);
  assert.equal(data.integration.status, "failed");
  const events = await ok(call, "GET", `${ROOT}/integration/events`, {
    as: MANAGER, query: { status: "failed" },
  });
  assert.equal(events.total, 1);
  assert.equal(events.events[0].LastErrorCode, "E-MES-REJECTED");
  const error = await fails(call, "POST", `${ROOT}/integration/events/:eventId/dispatch`, 422, "E-MES-REJECTED", {
    as: MANAGER, params: { eventId: events.events[0].Id },
  });
  assert.equal(error.attempts, 2);
});

test("بلوکهٔ نرم ظرفیت: رزرو، هشدار هم‌پوشانی و آزادسازی یک‌باره", async () => {
  const { call } = makeApi();
  const block = await created(call, `${ROOT}/capacity-blocks`, {
    as: PLANNER,
    body: {
      WorkCenterRef: "WC-LINE-4", SourceType: "manual",
      WindowStart: "2026-11-05T08:00:00Z", WindowEnd: "2026-11-05T12:00:00Z",
      ReasonFa: "توقف برنامه‌ریزی‌شدهٔ تعویض گیربکس",
    },
  });
  assert.equal(block.block.Status, "requested");
  assert.equal(block.block.ReservedMinutes, 240);
  assert.equal(block.block.IsSoft, true);
  assert.equal(block.conflict.conflicts.length, 0);
  assert.equal(block.conflict.overlapMinutes, 0);

  const overlapping = await created(call, `${ROOT}/capacity-blocks`, {
    as: PLANNER,
    body: {
      WorkCenterRef: "WC-LINE-4", SourceType: "shutdown",
      WindowStart: "2026-11-05T10:00:00Z", WindowEnd: "2026-11-05T14:00:00Z",
      ReasonFa: "هم‌پوشانی عمدی برای سنجش هشدار",
    },
  });
  /* هم‌پوشانی هشدار است، نه خطا: تصمیم زمان‌بندی انسانی است. */
  assert.equal(overlapping.conflict.conflicts.length, 1);
  assert.equal(overlapping.conflict.conflicts[0].blockRef, block.block.Id);
  assert.equal(overlapping.conflict.overlapMinutes, 120);

  const released = await ok(call, "POST", `${ROOT}/capacity-blocks/:blockId/release`, {
    as: PLANNER, params: { blockId: block.block.Id }, body: { ReleaseReasonFa: "تعویض به تعطیلات موکول شد" },
  });
  assert.equal(released.block.Status, "released");
  assert.ok(released.block.ReleasedAt);
  await fails(call, "POST", `${ROOT}/capacity-blocks/:blockId/release`, 422, "CMMS_CAPACITY_NOT_ACTIVE", {
    as: PLANNER, params: { blockId: block.block.Id }, body: {},
  });
  const list = await ok(call, "GET", `${ROOT}/capacity-blocks`, { as: PLANNER, query: { workCenterRef: "WC-LINE-4" } });
  assert.equal(list.summary.total, 2);
  assert.equal(list.summary.active, 1);
  assert.equal(list.summary.released, 1);
  assert.equal(list.summary.reservedMinutes, 240);
});

test("آزادسازی دستورکار با پنجرهٔ زمان‌بندی، ظرفیت را رزرو و لغو، آن را آزاد می‌کند", async () => {
  const transport = makeTransport();
  const { call } = makeApi({ transport });
  const { workOrder } = await seedReleasedWorkOrder(call, {
    workOrderNo: "WO-I3", workCenterRef: "WC-LINE-5", planned: true,
  });
  const blocks = await ok(call, "GET", `${ROOT}/capacity-blocks`, { as: MANAGER, query: { sourceType: "work-order" } });
  assert.equal(blocks.total, 1);
  assert.equal(blocks.blocks[0].WorkCenterRef, "WC-LINE-5");
  assert.equal(blocks.blocks[0].ReservedMinutes, 240);
  assert.equal(blocks.blocks[0].SourceRef, workOrder.Id);
  /* رویداد رزرو هم به MES رفته است. */
  assert.equal(transport.calls.at(-1).eventType, "capacity.block.requested");
  assert.equal(transport.calls.at(-1).payload.windowStart, "2026-11-02T08:00:00.000Z");

  await ok(call, "POST", `${ROOT}/work-orders/:workOrderId/cancel`, { as: MANAGER, params: { workOrderId: workOrder.Id } });
  const after = await ok(call, "GET", `${ROOT}/capacity-blocks`, { as: MANAGER, query: { sourceType: "work-order" } });
  assert.equal(after.blocks[0].Status, "released");
  assert.equal(transport.calls.at(-1).eventType, "capacity.block.released");
  /* لغو دستورکار متوقف‌نشده هم رویداد توقف نمی‌فرستد. */
  assert.ok(transport.calls.every((item) => !item.eventType.startsWith("downtime.")));
});

test("صف رویداد و بلوکه‌های ظرفیت مجوز مستقل دارند", async () => {
  const { call } = makeApi();
  await fails(call, "GET", `${ROOT}/integration/events`, 403, "CMMS_FORBIDDEN", { as: TECH });
  await fails(call, "GET", `${ROOT}/capacity-blocks`, 403, "CMMS_FORBIDDEN", { as: TECH });
  await fails(call, "POST", `${ROOT}/capacity-blocks`, 403, "CMMS_FORBIDDEN", {
    as: RELIABILITY,
    body: { WorkCenterRef: "WC-X", SourceType: "manual", WindowStart: "2026-11-09T08:00:00Z", WindowEnd: "2026-11-09T10:00:00Z", ReasonFa: "آزمون مجوز" },
  });
});
