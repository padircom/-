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

function makeApi() {
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
  registerCmmsRoutes(app, { repo, subjects, evaluate, subjectPermissions });
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
  assert.equal(registered.length, 105);
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
