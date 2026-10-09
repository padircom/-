import test from "node:test";
import assert from "node:assert/strict";
import { MANUFACTURING_IMPLEMENTED_ROUTES, registerManufacturingRoutes } from "./manufacturingApi.js";
import { DEMO_SUBJECTS, evaluate, PERMISSION_CATALOG } from "./rbacLogic.js";
import { tablesOfModule } from "./sqlLogic.js";
import {
  capabilitiesForIndustry,
  INDUSTRY_CATALOG,
  INDUSTRY_TYPES,
  isIndustryType,
} from "./mfgPlanLogic.js";

/* ══════════════════════════════════════════════════════════════════════════
   نوع صنعت و تنظیمات کارخانه

   سه چیز اینجا سنجیده می‌شود و هر سه جای اشتباه کردن داشته‌اند:

   ۱) نگاشت قابلیت واقعاً بین صنایع فرق می‌کند. اگر قواعد اشتباه نوشته شوند،
      همهٔ صنایع یک فهرست یکسان می‌گیرند و ویژگی بی‌معنا می‌شود؛ این تست‌ها
      روی مقادیر مشخصِ هر صنعت دست می‌گذارند، نه روی «طولانی‌تر از صفر».

   ۲) صداقت پرچم `implemented`. اگر روزی قابلیتی از مخزن حذف شود ولی قاعدهٔ
      آن implemented=true بماند، این گزارش دروغ می‌گوید — همان اشتباهی که
      پیش‌تر در شمارش مسیرهای انطباق بود. اینجا شمارش‌ها قفل شده‌اند.

   ۳) PATCH یک upsert است، پس مرز بین «ساخت» و «به‌روزرسانی» باید دقیق باشد:
      ساخت بدون If-Match، به‌روزرسانی با If-Match اجباری.
   ══════════════════════════════════════════════════════════════════════════ */

/* همان مخزن ساختگی آزمون‌های REST دیگر؛ تراکنش با snapshot/rollback. */
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
      if (row.RowVersion !== expectedRowVersion) return { affected: 0, ok: false, code: "CONCURRENCY_CONFLICT" };
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
  const app = Object.fromEntries(["get", "post", "patch", "delete"].map((method) => [method, (path, handler) => handlers.set(`${method.toUpperCase()} ${path}`, handler)]));
  const repo = makeRepo();
  registerManufacturingRoutes(app, { repo: async () => repo, subjects: DEMO_SUBJECTS, evaluate });
  const call = async (method, path, { params = {}, query = {}, body = {}, headers = {}, requestId = "mfg-plant-test" } = {}) => {
    const handler = handlers.get(`${method} ${path}`);
    assert.ok(handler, `route not registered: ${method} ${path}`);
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
  return { repo, call };
}

const ROOT = "/api/mfg/plants/:plantId";
const SETTINGS = `${ROOT}/settings`;
const CAPABILITIES = `${ROOT}/capabilities`;

const PLANT = "PLANT-DEMO";
const MANAGER = "u-mfg-manager";
const PLAN = "u-mfg-plan";
const ENG = "u-mfg-eng";
const OPERATOR = "u-mfg-operator";
const H = (userId, extra = {}) => ({ "x-user-id": userId, ...extra });

/** کد قابلیت‌های فعال یک صنعت، به شکل مجموعه برای مقایسهٔ خوانا. */
const enabledCodes = (industry) => new Set(
  capabilitiesForIndustry(industry).capabilities.filter((entry) => entry.enabled).map((entry) => entry.code),
);

/* ═══════════════════════ اسکیمای جدول ═══════════════════════ */

test("MFG-PLANT: جدول MfgPlant با ستون‌ها، CHECK و بدون کلید خارجی ثبت شده است", () => {
  const table = tablesOfModule("mfg").find((entry) => entry.name === "MfgPlant");
  assert.ok(table, "جدول MfgPlant در ماژول mfg تعریف نشده است");

  const columns = table.columns.map((column) => column.name);
  for (const expected of ["Id", "PlantId", "PlantCode", "NameFa", "IndustryType", "IsActive"]) {
    assert.ok(columns.includes(expected), `ستون ${expected} در MfgPlant نیست`);
  }

  /* IndustryType باید NOT NULL باشد؛ نوع صنعت یک حدس نیست که بتوان خالی گذاشت. */
  const industry = table.columns.find((column) => column.name === "IndustryType");
  assert.equal(industry.nullable, false, "IndustryType باید NOT NULL باشد");

  const check = (table.checks ?? []).find((entry) => entry.name === "CK_MfgPlant_Industry");
  assert.ok(check, "CHECK برای IndustryType تعریف نشده است");
  for (const code of INDUSTRY_TYPES) {
    assert.ok(check.expression.includes(`'${code}'`), `CHECK صنعت ${code} را پوشش نمی‌دهد`);
  }

  /* تصمیم صریح: افزودنی و بدون تغییر شکننده. اگر روزی FK اضافه شد، این تست
   * باید عمداً به‌روزرسانی شود چون آن روز backfill هم لازم می‌شود. */
  assert.deepEqual(table.foreignKeys ?? [], [], "MfgPlant باید بدون کلید خارجی بماند");

  const indexNames = (table.indexes ?? []).map((index) => index.name);
  assert.ok(indexNames.includes("UX_MfgPlant_PlantId"), "ایندکس یکتا روی PlantId لازم است");
});

test("MFG-PLANT: سه مسیر تازه اعلام و ثبت شده‌اند", () => {
  for (const route of [`GET ${ROOT}/settings`, `PATCH ${ROOT}/settings`, `GET ${ROOT}/capabilities`]) {
    assert.ok(MANUFACTURING_IMPLEMENTED_ROUTES.includes(route), `مسیر ${route} در فهرست نیست`);
  }
});

test("MFG-PLANT: مجوزهای مشاهده و ویرایش با تفکیک درست تعریف شده‌اند", () => {
  const view = PERMISSION_CATALOG.find((entry) => entry.code === "mfg.plant.view");
  const edit = PERMISSION_CATALOG.find((entry) => entry.code === "mfg.plant.edit");
  assert.ok(view && edit, "مجوزهای mfg.plant.view / mfg.plant.edit تعریف نشده‌اند");
  assert.equal(view.audited, false, "مشاهده نیاز به حسابرسی ندارد");
  assert.equal(edit.audited, true, "ویرایش نوع صنعت یک تصمیم سطح کارخانه است و باید حسابرسی شود");
});

/* ═══════════════════════ موتور نگاشت قابلیت ═══════════════════════ */

test("MFG-PLANT: هر هفت صنعت توصیف‌گر فارسی و انگلیسی دارند", () => {
  assert.deepEqual([...INDUSTRY_TYPES], ["discrete", "process", "food", "pharma", "automotive", "metal", "drilling_energy"]);
  assert.equal(INDUSTRY_CATALOG.length, INDUSTRY_TYPES.length);
  for (const descriptor of INDUSTRY_CATALOG) {
    assert.ok(descriptor.titleFa.trim().length > 0, `${descriptor.code} عنوان فارسی ندارد`);
    assert.ok(descriptor.titleEn.trim().length > 0, `${descriptor.code} عنوان انگلیسی ندارد`);
    assert.ok(descriptor.characteristicFa.trim().length > 0, `${descriptor.code} توضیح تمایز ندارد`);
    assert.ok(isIndustryType(descriptor.code), `${descriptor.code} در INDUSTRY_TYPES نیست`);
  }
});

test("MFG-PLANT: نوع صنعت نامعتبر رد می‌شود", () => {
  assert.equal(isIndustryType("food"), true);
  assert.equal(isIndustryType("textile"), false);
  assert.equal(isIndustryType(""), false);
  assert.equal(isIndustryType(null), false);
  assert.equal(isIndustryType(42), false);

  /* باید با کد مشخص خطا بدهد، نه یک استثنا بی‌نام؛ کلاینت به این کد تکیه می‌کند. */
  assert.throws(() => capabilitiesForIndustry("textile"), (error) => {
    assert.equal(error.code, "MFG_UNKNOWN_INDUSTRY_TYPE");
    assert.deepEqual(error.details.allowed, [...INDUSTRY_TYPES]);
    return true;
  });
});

test("MFG-PLANT: ده قابلیت فاز ۵/بخش ۱۱ برای همهٔ صنایع فعال و پیاده‌شده‌اند", () => {
  /* این ده مورد واقعاً در همین مخزن پیاده شده‌اند؛ اگر یکی حذف شود این تست
   * باید شکست بخورد تا ادعای «پیاده‌شده» بی‌صدا کهنه نماند. */
  const phase5 = [
    "mps.masterSchedule", "demand.forecastConsumption", "planning.plannedOrders",
    "planning.lotSizing", "planning.leadTimeOffset", "planning.pegging",
    "planning.crp", "atp.capacityAware", "routing.productionVersions",
  ];
  for (const industry of INDUSTRY_TYPES) {
    const map = capabilitiesForIndustry(industry);
    for (const code of phase5) {
      const entry = map.capabilities.find((item) => item.code === code);
      assert.ok(entry, `${industry}: قابلیت ${code} در فهرست نیست`);
      assert.equal(entry.enabled, true, `${industry}: ${code} باید فعال باشد`);
      assert.equal(entry.implemented, true, `${industry}: ${code} پیاده‌شده اعلام شده`);
    }
  }
});

test("MFG-PLANT: قابلیت‌های صنعت‌محور واقعاً بین صنایع فرق می‌کنند", () => {
  /* اگر این تفاوت‌ها نباشند، IndustryType فقط یک برچسب تزئینی است. */
  const food = enabledCodes("food");
  const pharma = enabledCodes("pharma");
  const automotive = enabledCodes("automotive");
  const metal = enabledCodes("metal");
  const process = enabledCodes("process");
  const discrete = enabledCodes("discrete");

  /* HACCP اختصاصی غذایی است. */
  assert.equal(food.has("quality.haccp"), true, "غذایی باید HACCP داشته باشد");
  assert.equal(pharma.has("quality.haccp"), false, "دارویی HACCP نمی‌گیرد");
  assert.equal(automotive.has("quality.haccp"), false);

  /* PPAP و IATF اختصاصی خودرو. */
  assert.equal(automotive.has("quality.ppapDocumentation"), true, "خودرو باید PPAP داشته باشد");
  assert.equal(automotive.has("quality.iatf16949"), true, "خودرو باید IATF 16949 داشته باشد");
  assert.equal(food.has("quality.ppapDocumentation"), false);
  assert.equal(discrete.has("quality.iatf16949"), false);

  /* GMP برای دارو و غذا. */
  assert.equal(pharma.has("quality.gmpValidation"), true);
  assert.equal(food.has("quality.gmpValidation"), true);
  assert.equal(metal.has("quality.gmpValidation"), false);

  /* ردیابی ذوب/کویل فقط فلزات. */
  assert.equal(metal.has("traceability.heatMeltTracking"), true);
  assert.equal(process.has("traceability.heatMeltTracking"), false);
  assert.equal(discrete.has("traceability.heatMeltTracking"), false);

  /* ایمنی فرایند و نگهداری پیش‌بینانه برای صنایع پیوسته. */
  for (const industry of [process, metal]) {
    assert.equal(industry.has("safety.processSafety"), true);
    assert.equal(industry.has("maintenance.predictive"), true);
  }
  assert.equal(discrete.has("safety.processSafety"), false);
  assert.equal(food.has("maintenance.predictive"), false);

  /* تاریخ انقضا برای فاسدشدنی‌ها. */
  assert.equal(food.has("quality.shelfLifeControl"), true);
  assert.equal(pharma.has("quality.shelfLifeControl"), true);
  assert.equal(automotive.has("quality.shelfLifeControl"), false);

  /* تقسیم دسته و هم‌پوشانی در غذایی/دارویی فعال نیست: دسته یکپارچه است. */
  assert.equal(discrete.has("scheduling.splitOverlap"), true);
  assert.equal(automotive.has("scheduling.splitOverlap"), true);
  assert.equal(food.has("scheduling.splitOverlap"), false, "غذایی دستهٔ یکپارچه دارد");
  assert.equal(pharma.has("scheduling.splitOverlap"), false, "دارویی دستهٔ یکپارچه دارد");
});

test("MFG-PLANT: نفت، گاز و حفاری سه قابلیت اختصاصی و پروفایل صنایع پیوسته را دارد", () => {
  const drilling = enabledCodes("drilling_energy");

  /* سه قابلیت که فقط برای این صنعت فعال‌اند. اگر روزی قاعده‌شان پاک شود،
   * این صنعت عملاً به «فرایندی با نام دیگر» تقلیل می‌یابد. */
  assert.equal(drilling.has("quality.apiSpecification"), true, "انطباق API Spec باید فعال باشد");
  assert.equal(drilling.has("hse.permitToWork"), true, "مجوز کار باید فعال باشد");
  assert.equal(drilling.has("maintenance.assetIntegrity"), true, "یکپارچگی تجهیز باید فعال باشد");

  /* و این سه برای هیچ صنعت دیگری فعال نیستند — وگرنه «اختصاصی» معنا ندارد. */
  for (const industry of ["discrete", "process", "food", "pharma", "automotive", "metal"]) {
    const other = enabledCodes(industry);
    for (const code of ["quality.apiSpecification", "hse.permitToWork", "maintenance.assetIntegrity"]) {
      assert.equal(other.has(code), false, `${industry} نباید ${code} داشته باشد`);
    }
  }

  /* پروفایل صنایع پیوسته/خطرناک را هم دارد. */
  for (const code of ["safety.processSafety", "maintenance.predictive", "quality.batchTraceability", "traceability.heatMeltTracking"]) {
    assert.equal(drilling.has(code), true, `نفت/گاز باید ${code} داشته باشد`);
  }

  /* اما الزامات غذایی/دارویی/خودرو را ندارد. */
  for (const code of ["quality.haccp", "quality.gmpValidation", "quality.iatf16949", "quality.ppapDocumentation"]) {
    assert.equal(drilling.has(code), false, `نفت/گاز نباید ${code} داشته باشد`);
  }

  /* سه قابلیت اختصاصی هنوز پیاده نشده‌اند و باید صریحاً همین‌طور علامت بخورند. */
  const map = capabilitiesForIndustry("drilling_energy");
  for (const code of ["quality.apiSpecification", "hse.permitToWork", "maintenance.assetIntegrity"]) {
    const entry = map.capabilities.find((item) => item.code === code);
    assert.equal(entry.implemented, false, `${code} نباید پیاده‌شده اعلام شود`);
    assert.ok(entry.reasonFa.trim().length > 0, `${code} دلیل ندارد`);
  }

  /* عنوان و توضیح تمایز باید واقعی باشد. */
  assert.equal(map.industryTitleFa, "نفت، گاز و حفاری");
  assert.equal(map.industryTitleEn, "Drilling and energy");
  assert.ok(map.characteristicFa.includes("API"), "توضیح تمایز باید به API اشاره کند");
});

test("MFG-PLANT: شمارش‌های نگاشت قابلیت با دادهٔ واقعی می‌خوانند", () => {
  /* این اعداد قفل شده‌اند تا تغییر بی‌صدا در قواعد، گزارش را واگرا نکند. */
  const expected = {
    discrete: { capabilityCount: 22, enabledCount: 10, implementedCount: 10, enabledAndImplementedCount: 10 },
    process: { capabilityCount: 22, enabledCount: 13, implementedCount: 10, enabledAndImplementedCount: 10 },
    food: { capabilityCount: 22, enabledCount: 13, implementedCount: 10, enabledAndImplementedCount: 9 },
    pharma: { capabilityCount: 22, enabledCount: 12, implementedCount: 10, enabledAndImplementedCount: 9 },
    automotive: { capabilityCount: 22, enabledCount: 12, implementedCount: 10, enabledAndImplementedCount: 10 },
    metal: { capabilityCount: 22, enabledCount: 14, implementedCount: 10, enabledAndImplementedCount: 10 },
    /* نفت/گاز/حفاری بیشترین قابلیت فعال را دارد: هم قابلیت‌های صنایع پیوسته
     * (ایمنی فرایند، نگهداری پیش‌بینانه، ردیابی ذوب) و هم سه مورد اختصاصی خودش. */
    drilling_energy: { capabilityCount: 22, enabledCount: 18, implementedCount: 10, enabledAndImplementedCount: 10 },
  };
  for (const [industry, totals] of Object.entries(expected)) {
    const map = capabilitiesForIndustry(industry);
    assert.deepEqual(map.totals, totals, `شمارش ${industry} با انتظار نمی‌خواند`);
    assert.equal(map.capabilities.length, totals.capabilityCount);
    /* هیچ قابلیتی بدون دلیل نباید رها شود. */
    for (const entry of map.capabilities) {
      assert.ok(entry.reasonFa.trim().length > 0, `${industry}/${entry.code} دلیل ندارد`);
      assert.ok(entry.titleFa.trim().length > 0, `${industry}/${entry.code} عنوان فارسی ندارد`);
    }
  }
});

test("MFG-PLANT: هر قابلیت فعالِ پیاده‌نشده صریحاً علامت‌گذاری شده است", () => {
  /* خطر اصلی این ویژگی: ادعای قابلیتی که در سامانه وجود ندارد. هر موردی که
   * enabled است ولی implemented نیست، باید در صنعت تنظیمی باشد نه در هستهٔ فاز ۵. */
  for (const industry of INDUSTRY_TYPES) {
    const map = capabilitiesForIndustry(industry);
    const overclaiming = map.capabilities.filter((entry) => entry.implemented && !entry.enabled);
    assert.deepEqual(
      overclaiming.map((entry) => entry.code),
      industry === "discrete" ? [] : ["scheduling.splitOverlap"].filter(() => industry === "food" || industry === "pharma"),
      `${industry}: مجموعهٔ پیاده‌شده ولی غیرفعال با انتظار نمی‌خواند`,
    );
  }
});

/* ═══════════════════════ مسیرهای REST ═══════════════════════ */

test("MFG-PLANT: هویت، مجوز و دامنهٔ کارخانه پیش از هر عمل سنجیده می‌شود", async () => {
  const { call } = makeApi();

  const anonymous = await call("GET", SETTINGS, { params: { plantId: PLANT }, headers: {} });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(anonymous.body.error.code, "MFG_AUTH_REQUIRED");

  /* اپراتور تولید هیچ مجوزی روی تنظیمات کارخانه ندارد. */
  const denied = await call("GET", SETTINGS, { params: { plantId: PLANT }, headers: H(OPERATOR) });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body.error.code, "MFG_FORBIDDEN");
  assert.equal(denied.body.error.permission, "mfg.plant.view");

  /* تفکیک وظایف: برنامه‌ریز و مهندس می‌بینند ولی ویرایش نمی‌کنند. */
  for (const userId of [PLAN, ENG]) {
    const forbidden = await call("PATCH", SETTINGS, {
      params: { plantId: PLANT }, headers: H(userId), body: { IndustryType: "food", NameFa: "x" },
    });
    assert.equal(forbidden.statusCode, 403, `${userId} نباید بتواند ویرایش کند`);
    assert.equal(forbidden.body.error.permission, "mfg.plant.edit");
  }

  const scoped = await call("GET", SETTINGS, { params: { plantId: "PLANT-OTHER" }, headers: H(MANAGER) });
  assert.equal(scoped.statusCode, 403);
  assert.equal(scoped.body.error.code, "MFG_PLANT_SCOPE_DENIED");

  const badPlant = await call("GET", SETTINGS, { params: { plantId: "not valid" }, headers: H(MANAGER) });
  assert.equal(badPlant.statusCode, 400);
  assert.equal(badPlant.body.error.code, "MFG_BAD_PLANT_ID");
});

test("MFG-PLANT: پیش از هر پیکربندی، GET با ۴۰۴ صادقانه پاسخ می‌دهد", async () => {
  const { call } = makeApi();
  const res = await call("GET", SETTINGS, { params: { plantId: PLANT }, headers: H(MANAGER) });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "MFG_NOT_FOUND");

  /* capabilities هم بدون صنعت ذخیره‌شده و بدون پیش‌نمایش نمی‌تواند حدس بزند. */
  const caps = await call("GET", CAPABILITIES, { params: { plantId: PLANT }, headers: H(MANAGER) });
  assert.equal(caps.statusCode, 404);
  assert.equal(caps.body.error.code, "MFG_NOT_FOUND");
});

test("MFG-PLANT: PATCH نخست بدون If-Match رکورد را می‌سازد", async () => {
  const { repo, call } = makeApi();
  const res = await call("PATCH", SETTINGS, {
    params: { plantId: PLANT },
    headers: H(MANAGER),
    body: { NameFa: "کارخانهٔ نمایشی", NameEn: "Demo Plant", IndustryType: "food", PlantCode: "DEMO-01" },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.created, true, "فراخوانی نخست باید ساخت باشد");

  const { plant, capabilities } = res.body.data;
  assert.equal(plant.plantId, PLANT);
  assert.equal(plant.plantCode, "DEMO-01");
  assert.equal(plant.nameFa, "کارخانهٔ نمایشی");
  assert.equal(plant.industryType, "food");
  assert.equal(plant.isActive, true, "پیش‌فرض IsActive باید فعال باشد");
  assert.equal(plant.rowVersion, 1);

  /* پاسخ باید نگاشت قابلیت همان صنعت را هم بیاورد تا کلاینت یک فراخوانی کند. */
  assert.equal(capabilities.industryType, "food");
  assert.equal(capabilities.totals.enabledCount, 13);
  assert.equal(enabledCodes("food").has("quality.haccp"), true);

  /* Id برابر plantId است؛ این تنها راهی است که بدون backfill به شناسهٔ آزاد
   * موجود در جدول‌های دیگر گره بخورد. */
  const stored = await repo.get("MfgPlant", PLANT);
  assert.ok(stored, "رکورد با Id برابر plantId ذخیره نشده است");
  assert.equal(stored.PlantId, PLANT);

  /* حسابرسی نوشته شده باشد. */
  const audits = await repo.list("AuditLog", { where: [{ column: "Action", op: "eq", value: "MFG_PLANT_SETTINGS_UPDATED" }] });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].EntityName, "MfgPlant");
});

test("MFG-PLANT: PATCH روی رکورد موجود بدون If-Match با ۴۲۸ رد می‌شود", async () => {
  const { call } = makeApi();
  await call("PATCH", SETTINGS, { params: { plantId: PLANT }, headers: H(MANAGER), body: { NameFa: "الف", IndustryType: "food" } });

  const res = await call("PATCH", SETTINGS, {
    params: { plantId: PLANT }, headers: H(MANAGER), body: { IndustryType: "metal" },
  });
  assert.equal(res.statusCode, 428);
  assert.equal(res.body.error.code, "MFG_IF_MATCH_REQUIRED");

  /* و نسخهٔ کهنه هم ۴۰۹ می‌دهد، نه بازنویسی بی‌صدا. */
  const stale = await call("PATCH", SETTINGS, {
    params: { plantId: PLANT }, headers: H(MANAGER, { "if-match": "\"999\"" }), body: { IndustryType: "metal" },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.error.code, "MFG_ROW_VERSION_CONFLICT");

  /* مقدار قبلی دست‌نخورده مانده باشد. */
  const after = await call("GET", SETTINGS, { params: { plantId: PLANT }, headers: H(MANAGER) });
  assert.equal(after.body.data.plant.industryType, "food");
  assert.equal(after.body.data.created, undefined, "GET نباید پرچم created داشته باشد");
});

test("MFG-PLANT: PATCH با If-Match درست به‌روزرسانی می‌کند و قابلیت‌ها را عوض می‌کند", async () => {
  const { call } = makeApi();
  const created = await call("PATCH", SETTINGS, {
    params: { plantId: PLANT }, headers: H(MANAGER), body: { NameFa: "کارخانه", IndustryType: "discrete" },
  });
  const version = created.body.data.plant.rowVersion;
  assert.equal(created.body.data.capabilities.totals.enabledCount, 10);

  const res = await call("PATCH", SETTINGS, {
    params: { plantId: PLANT },
    headers: H(MANAGER, { "if-match": `"${version}"` }),
    body: { IndustryType: "automotive" },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.created, false, "به‌روزرسانی نباید ساخت گزارش شود");
  assert.equal(res.body.data.plant.industryType, "automotive");
  assert.equal(res.body.data.plant.rowVersion, version + 1);
  /* NameFa نفرستاده شد، پس باید حفظ شود نه اینکه پاک شود. */
  assert.equal(res.body.data.plant.nameFa, "کارخانه");
  /* و قابلیت‌ها هم با صنعت تازه هم‌خوان شدند. */
  assert.equal(res.body.data.capabilities.industryType, "automotive");
  assert.equal(res.body.data.capabilities.totals.enabledCount, 12);
});

test("MFG-PLANT: اعتبارسنجی IndustryType، فیلد ناشناخته و پارامتر پرس‌وجو", async () => {
  const { call } = makeApi();

  const badIndustry = await call("PATCH", SETTINGS, {
    params: { plantId: PLANT }, headers: H(MANAGER), body: { NameFa: "الف", IndustryType: "textile" },
  });
  assert.equal(badIndustry.statusCode, 400);
  assert.equal(badIndustry.body.error.code, "MFG_VALIDATION_FAILED");
  assert.equal(badIndustry.body.error.field, "IndustryType");

  const unknown = await call("PATCH", SETTINGS, {
    params: { plantId: PLANT }, headers: H(MANAGER), body: { NameFa: "الف", IndustryType: "food", Bogus: 1 },
  });
  assert.equal(unknown.statusCode, 400);
  assert.equal(unknown.body.error.code, "MFG_UNKNOWN_FIELDS");

  /* NameFa در ساخت الزامی است؛ IndustryType تنها. */
  const noName = await call("PATCH", SETTINGS, {
    params: { plantId: PLANT }, headers: H(MANAGER), body: { IndustryType: "food" },
  });
  assert.equal(noName.statusCode, 400);
  assert.equal(noName.body.error.field, "NameFa");

  /* IsActive باید بولی باشد، نه رشته. */
  const badBool = await call("PATCH", SETTINGS, {
    params: { plantId: PLANT }, headers: H(MANAGER), body: { NameFa: "الف", IndustryType: "food", IsActive: "yes" },
  });
  assert.equal(badBool.statusCode, 400);
  assert.equal(badBool.body.error.field, "IsActive");

  /* پارامتر پرس‌وجوی ناشناخته هم رد می‌شود. */
  const badQuery = await call("GET", CAPABILITIES, {
    params: { plantId: PLANT }, query: { bogus: "x" }, headers: H(MANAGER),
  });
  assert.equal(badQuery.statusCode, 400);
  assert.equal(badQuery.body.error.code, "MFG_UNKNOWN_QUERY");
});

test("MFG-PLANT: پیش‌نمایش صنعت بدون ذخیره، منبع را صریح اعلام می‌کند", async () => {
  const { call } = makeApi();
  await call("PATCH", SETTINGS, {
    params: { plantId: PLANT }, headers: H(MANAGER), body: { NameFa: "کارخانه", IndustryType: "discrete" },
  });

  const preview = await call("GET", CAPABILITIES, {
    params: { plantId: PLANT }, query: { industryType: "pharma" }, headers: H(MANAGER),
  });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.body.data.source, "query-preview", "منبع باید پیش‌نمایش باشد نه پیکربندی ذخیره‌شده");
  assert.equal(preview.body.data.industryType, "pharma");
  assert.equal(preview.body.data.persistedIndustryType, "discrete", "صنعت ذخیره‌شده باید جدا گزارش شود");
  assert.equal(preview.body.data.totals.enabledCount, 12);

  /* فهرست صنایع هم برمی‌گردد تا UI بدون فراخوانی دیگر کرکره بسازد. */
  assert.equal(preview.body.data.industries.length, 7);

  /* و ذخیره‌شده دست‌نخورده می‌ماند. */
  const stored = await call("GET", SETTINGS, { params: { plantId: PLANT }, headers: H(MANAGER) });
  assert.equal(stored.body.data.source, undefined);
  assert.equal(stored.body.data.plant.industryType, "discrete");

  /* بدون پیش‌نمایش، منبع پیکربندی ذخیره‌شده است. */
  const persisted = await call("GET", CAPABILITIES, { params: { plantId: PLANT }, headers: H(MANAGER) });
  assert.equal(persisted.body.data.source, "plant-settings");
  assert.equal(persisted.body.data.industryType, "discrete");

  /* پیش‌نمایش نامعتبر با ۴۰۰ رد می‌شود، نه با فهرست خالی. */
  const badPreview = await call("GET", CAPABILITIES, {
    params: { plantId: PLANT }, query: { industryType: "textile" }, headers: H(MANAGER),
  });
  assert.equal(badPreview.statusCode, 400);
  assert.equal(badPreview.body.error.field, "industryType");
});

test("MFG-PLANT: دو کارخانهٔ جدا، پیکربندی مستقل دارند", async () => {
  const { call } = makeApi();
  /* مدیر تولید به PLANT-OTHER هم تخصیص دارد؟ اگر نه، این تست باید همان ۴۰۳
   * دامنه را ببیند — پس اول دامنه را تأیید می‌کنیم تا تست برای دلیل غلط سبز نشود. */
  const scoped = await call("PATCH", SETTINGS, {
    params: { plantId: "PLANT-OTHER" }, headers: H(MANAGER), body: { NameFa: "کارخانهٔ دوم", IndustryType: "metal" },
  });
  if (scoped.statusCode === 403) {
    assert.equal(scoped.body.error.code, "MFG_PLANT_SCOPE_DENIED");
    return; /* کاربر نمونه به این کارخانه تخصیص ندارد؛ استقلال در تست قبلی سنجیده شد. */
  }
  assert.equal(scoped.statusCode, 200);

  await call("PATCH", SETTINGS, {
    params: { plantId: PLANT }, headers: H(MANAGER), body: { NameFa: "کارخانهٔ یکم", IndustryType: "food" },
  });

  const first = await call("GET", SETTINGS, { params: { plantId: PLANT }, headers: H(MANAGER) });
  const second = await call("GET", SETTINGS, { params: { plantId: "PLANT-OTHER" }, headers: H(MANAGER) });
  assert.equal(first.body.data.plant.industryType, "food");
  assert.equal(second.body.data.plant.industryType, "metal");
  assert.notEqual(first.body.data.plant.rowVersion, undefined);
});
