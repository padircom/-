/* آزمون اندپوینت‌های ماژول پیمان و صورت‌وضعیت (d14) — تحویلی D3.
 *
 * این اندپوینت‌ها تنها راه ورود پیمان و فهرست بها به سامانه‌اند و مستقیم بر
 * مبلغ صورت‌وضعیت اثر می‌گذارند. پس آزمون فقط «ذخیره شد یا نه» را نمی‌سنجد؛
 * می‌سنجد که ترکیب بی‌معنای دو حالت ارزش‌گذاری رد شود، مجوز مالی واقعاً
 * محافظ باشد، و دروازهٔ کیفی بدون مجوز صریح دور زده نشود.
 *
 * سرور اختصاصی روی پوشهٔ دادهٔ موقت بالا می‌آید چون درایور فایلی حافظهٔ
 * داخلی دارد و آزمون نباید دادهٔ نمونه را آلوده کند. */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4713;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";

/* مدیر پیمان پیمان و فهرست بها را می‌زند، سرپرست کارگاه ریزمتره، و مدیر
 * پروژه تنها کسی است که کلید دور زدن دروازهٔ کیفی را دارد. */
const CONTRACTS = "u-contracts";
const SITE = "u-site";
const PM = "u-pm";
const PLANNER = "u-planner";

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-forms-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});

  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/cnt/status`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون بالا نیامد");
});

after(async () => {
  if (child) child.kill("SIGTERM");
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function post(p, body, userId) {
  const res = await fetch(`${BASE}${p}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(userId ? { "x-user-id": userId } : {}) },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* بدون بدنه */ }
  return { status: res.status, body: json };
}

async function get(p, userId) {
  const res = await fetch(`${BASE}${p}`, { headers: userId ? { "x-user-id": userId } : {} });
  let json = null;
  try { json = await res.json(); } catch { /* بدون بدنه */ }
  return { status: res.status, body: json };
}

const tag = () => `T${Date.now().toString(36).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;

/** پیمان تازه می‌سازد و شناسه‌اش را می‌دهد — پایهٔ اکثر آزمون‌ها. */
async function makeContract(over = {}) {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`,
    titleFa: "پیمان آزمون",
    contractType: "mixed",
    employerName: "شرکت کارفرما",
    contractorName: "شرکت پیمانکار",
    initialAmount: 1_000_000_000,
    signDate: "2026-01-01",
    startDate: "2026-01-05",
    durationDays: 360,
    ...over,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

/** ردیف فهرست‌بهایی می‌سازد. */
async function makeUnitPriceItem(contractId, over = {}) {
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId,
    itemNo: `01${Math.floor(Math.random() * 9000 + 1000)}`,
    titleFa: "بتن‌ریزی فونداسیون",
    pricingBasis: "unit_price",
    chapterCode: "01",
    unit: "مترمکعب",
    contractQty: 100,
    unitRate: 5_000_000,
    ...over,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

/* ══════ دسترسی ══════ */

test("وضعیت ماژول بدون احراز هویت در دسترس است", async () => {
  const r = await get("/api/cnt/status");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.module, "d14");
  assert.equal(r.body.meta.engine, "cnt-v1");
});

test("ثبت پیمان بدون شناسهٔ کاربر ۴۰۱ می‌دهد", async () => {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, { code: "X", titleFa: "ی", contractType: "mixed", initialAmount: 1 }, null);
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, "E-CNT-AUTH-REQUIRED");
});

test("نقش بی‌ربط ۴۰۳ می‌گیرد و اعتبارسنجی حتی اجرا نمی‌شود", async () => {
  /* اگر ۴۲۲ برگردد یعنی محافظ بعد از اعتبارسنجی است و ساختار داده لو می‌رود. */
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {}, PLANNER);
  assert.equal(r.status, 403);
  assert.equal(r.body.error.permission, "cnt.contract.edit");
});

test("سرپرست کارگاه فهرست بها را ویرایش نمی‌کند ولی ریزمتره می‌زند", async () => {
  /* تفکیک اصلی ماژول: هر که در کارگاه متره می‌زند نباید نرخ را عوض کند. */
  const boq = await post(`/api/cnt/boq?projectId=${PROJECT}`, { contractId: "x" }, SITE);
  assert.equal(boq.status, 403);
  const ms = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {}, SITE);
  assert.notEqual(ms.status, 403);
});

test("خواندن فهرست پیمان‌ها بدون مجوز باز است", async () => {
  const r = await get(`/api/cnt/contracts?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.data.contracts));
});

/* ══════ ثبت پیمان ══════ */

test("ثبت پیمان: بدنهٔ تهی همهٔ میدان‌های الزامی را با هم گزارش می‌کند", async () => {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {}, CONTRACTS);
  assert.equal(r.status, 422);
  const fields = r.body.error.issues.map((i) => i.field);
  for (const f of ["code", "titleFa", "contractType", "initialAmount", "employerName", "contractorName", "signDate", "startDate", "durationDays"]) {
    assert.ok(fields.includes(f), `${f} گزارش نشده`);
  }
});

test("ثبت پیمان: نوع پیمان خارج از فهرست رد می‌شود", async () => {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`, titleFa: "الف", contractType: "بی‌نام", initialAmount: 1000,
    employerName: "ک", contractorName: "پ", signDate: "2026-01-01", startDate: "2026-01-01", durationDays: 100,
  }, CONTRACTS);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.issues.some((i) => i.field === "contractType" && i.code === "NOT_ALLOWED"));
});

test("ثبت پیمان: شروع پیش از انعقاد بدون تأیید صریح رد می‌شود", async () => {
  /* معمولاً یعنی دو تاریخ جابه‌جا وارد شده‌اند؛ ولی شروع به کار پیش از امضا
   * هم واقعی است، پس با پرچم صریح پذیرفته می‌شود. */
  const body = {
    code: `C-${tag()}`, titleFa: "الف", contractType: "mixed", initialAmount: 1000,
    employerName: "ک", contractorName: "پ", signDate: "2026-06-01", startDate: "2026-03-01", durationDays: 100,
  };
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, body, CONTRACTS);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.issues.some((i) => i.code === "BEFORE_SIGN"));

  const ok = await post(`/api/cnt/contracts?projectId=${PROJECT}`, { ...body, code: `C-${tag()}`, allowEarlyStart: true }, CONTRACTS);
  assert.equal(ok.status, 201);
});

test("ثبت پیمان: مبلغ منفی رد می‌شود", async () => {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`, titleFa: "الف", contractType: "mixed", initialAmount: -5,
    employerName: "ک", contractorName: "پ", signDate: "2026-01-01", startDate: "2026-01-01", durationDays: 100,
  }, CONTRACTS);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.issues.some((i) => i.field === "initialAmount"));
});

test("ثبت پیمان: نبود projectId خطای مشخص می‌دهد", async () => {
  const r = await post("/api/cnt/contracts", {
    code: "X", titleFa: "ی", contractType: "mixed", initialAmount: 1,
    employerName: "ک", contractorName: "پ", signDate: "2026-01-01", startDate: "2026-01-01", durationDays: 100,
  }, CONTRACTS);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "E-CNT-NO-PROJECT");
});

test("ثبت پیمان: رکورد ساخته می‌شود و مبلغ جاری برابر اولیه است", async () => {
  const c = await makeContract({ initialAmount: 2_000_000_000 });
  assert.equal(c.InitialAmount, 2_000_000_000);
  assert.equal(c.CurrentAmount, 2_000_000_000);
  /* پیش‌فرض‌های آیین‌نامه‌ای نباید هر بار دستی وارد شوند. */
  assert.equal(c.CeilingPct, 25);
  assert.equal(c.RetainagePct, 10);
  assert.equal(c.Status, "draft");
});

test("ثبت پیمان: شمارهٔ تکراری با ۴۰۹ رد می‌شود نه رکورد دوم", async () => {
  const code = `C-${tag()}`;
  const common = { employerName: "ک", contractorName: "پ", signDate: "2026-01-01", startDate: "2026-01-01", durationDays: 100 };
  const first = await post(`/api/cnt/contracts?projectId=${PROJECT}`, { code, titleFa: "الف", contractType: "mixed", initialAmount: 1000, ...common }, CONTRACTS);
  assert.equal(first.status, 201);
  const second = await post(`/api/cnt/contracts?projectId=${PROJECT}`, { code, titleFa: "ب", contractType: "mixed", initialAmount: 2000, ...common }, CONTRACTS);
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, "E-CNT-DUP-CODE");
});

test("ثبت پیمان: وضعیت سقف همراه پاسخ می‌آید", async () => {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`, titleFa: "الف", contractType: "unit_price", initialAmount: 1_000_000_000,
    employerName: "ک", contractorName: "پ", signDate: "2026-01-01", startDate: "2026-01-01", durationDays: 100,
  }, CONTRACTS);
  assert.equal(r.body.data.ceiling.ceilingAmount, 1_250_000_000);
  assert.equal(r.body.data.ceiling.status, "ok");
});

/* ══════ فهرست بها — دو حالت ══════ */

test("ثبت ردیف: پیمان ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: "ناموجود", itemNo: "01", titleFa: "الف", pricingBasis: "unit_price", unit: "متر", contractQty: 1, unitRate: 1,
  }, CONTRACTS);
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, "E-CNT-NOT-FOUND");
});

test("ثبت ردیف فهرست‌بهایی: مبلغ خودکار از مقدار و نرخ محاسبه می‌شود", async () => {
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  assert.equal(item.LineAmount, 500_000_000);
  assert.equal(item.pricingBasisFa, "فهرست بهایی");
});

test("ثبت ردیف فهرست‌بهایی بدون واحد و نرخ رد می‌شود", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0101", titleFa: "الف", pricingBasis: "unit_price", contractQty: 10,
  }, CONTRACTS);
  assert.equal(r.status, 422);
  const codes = r.body.error.issues.map((i) => i.code);
  assert.ok(codes.includes("CNT-BOQ-UNIT"));
  assert.ok(codes.includes("CNT-BOQ-RATE"));
});

test("ثبت ردیف مقطوع: مبلغ از مبلغ مقطوع می‌آید", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0201", titleFa: "مهندسی پایه", pricingBasis: "lump_sum",
    chapterCode: "02", lumpSumAmount: 800_000_000,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.item.LineAmount, 800_000_000);
  assert.equal(r.body.data.item.pricingBasisFa, "مقطوع");
});

test("ثبت ردیف مقطوع همراه مقدار و نرخ رد می‌شود", async () => {
  /* ترکیب دو حالت روی یک ردیف یعنی کارکرد دو بار شمرده می‌شود. */
  const c = await makeContract();
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0202", titleFa: "الف", pricingBasis: "lump_sum",
    lumpSumAmount: 1000, contractQty: 5, unitRate: 200, unit: "عدد",
  }, CONTRACTS);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.issues.some((i) => i.code === "CNT-BOQ-LS-MIXED"));
});

test("ثبت ردیف: مبنای ارزش‌گذاری ناشناخته رد می‌شود", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0301", titleFa: "الف", pricingBasis: "cost_plus",
  }, CONTRACTS);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.issues.some((i) => i.field === "pricingBasis"));
});

test("ثبت ردیف: شمارهٔ تکراری در همان پیمان ۴۰۹ می‌دهد", async () => {
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id, { itemNo: "070707" });
  assert.ok(item);
  const again = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "070707", titleFa: "دوباره", pricingBasis: "unit_price",
    unit: "متر", contractQty: 1, unitRate: 1,
  }, CONTRACTS);
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, "E-CNT-DUP-ITEM");
});

test("ثبت ردیف: همان شمارهٔ ردیف در پیمان دیگر مجاز است", async () => {
  /* شمارهٔ ردیف در دامنهٔ پیمان یکتاست نه در دامنهٔ پروژه — فهرست بهای
   * سازمان برنامه در همهٔ پیمان‌ها همان شماره‌ها را دارد. */
  const c1 = await makeContract();
  const c2 = await makeContract();
  await makeUnitPriceItem(c1.Id, { itemNo: "080808" });
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c2.Id, itemNo: "080808", titleFa: "همان ردیف", pricingBasis: "unit_price",
    unit: "متر", contractQty: 1, unitRate: 1,
  }, CONTRACTS);
  assert.equal(r.status, 201);
});

test("ثبت ردیف: اختلاف جمع فهرست بها با مبلغ پیمان اعلام می‌شود", async () => {
  const c = await makeContract({ initialAmount: 1_000_000_000 });
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0401", titleFa: "الف", pricingBasis: "unit_price",
    unit: "متر", contractQty: 10, unitRate: 1_000_000,
  }, CONTRACTS);
  assert.ok(r.body.data.varianceFa, "هشدار اختلاف نیامده");
  assert.match(r.body.data.varianceFa, /اختلاف/);
  assert.equal(r.body.data.boqTotal, 10_000_000);
});

test("ثبت ردیف: تفکیک جمع بر حسب حالت گزارش می‌شود", async () => {
  const c = await makeContract();
  await makeUnitPriceItem(c.Id, { itemNo: "0501", contractQty: 10, unitRate: 1_000_000 });
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0502", titleFa: "مقطوع", pricingBasis: "lump_sum", lumpSumAmount: 3_000_000,
  }, CONTRACTS);
  assert.equal(r.body.data.byBasis.unit_price, 10_000_000);
  assert.equal(r.body.data.byBasis.lump_sum, 3_000_000);
});

/* ══════ مرحلهٔ مقطوع ══════ */

test("مرحلهٔ مقطوع روی ردیف فهرست‌بهایی رد می‌شود", async () => {
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/milestone?projectId=${PROJECT}`, {
    boqItemId: item.Id, milestoneNo: 1, titleFa: "مرحله", weightPct: 50,
  }, CONTRACTS);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.issues.some((i) => i.code === "CNT-MS-NOT-LUMPSUM"));
});

test("مرحلهٔ تأییدنشده پیشرفت و مبلغ نمی‌سازد", async () => {
  const c = await makeContract();
  const ls = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0601", titleFa: "مقطوع", pricingBasis: "lump_sum", lumpSumAmount: 1_000_000,
  }, CONTRACTS);
  const itemId = ls.body.data.item.Id;

  const claimed = await post(`/api/cnt/milestone?projectId=${PROJECT}`, {
    boqItemId: itemId, milestoneNo: 1, titleFa: "الف", weightPct: 40, status: "claimed",
  }, CONTRACTS);
  assert.equal(claimed.status, 201);
  assert.equal(claimed.body.data.progress.cumPct, 0);
  assert.equal(claimed.body.data.earnedAmount, 0);

  const verified = await post(`/api/cnt/milestone?projectId=${PROJECT}`, {
    boqItemId: itemId, milestoneNo: 2, titleFa: "ب", weightPct: 60, status: "verified",
  }, CONTRACTS);
  assert.equal(verified.body.data.progress.cumPct, 60);
  assert.equal(verified.body.data.earnedAmount, 600_000);
});

test("جمع وزن مراحل غیر از صد هشدار می‌دهد", async () => {
  const c = await makeContract();
  const ls = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0602", titleFa: "مقطوع", pricingBasis: "lump_sum", lumpSumAmount: 500_000,
  }, CONTRACTS);
  const r = await post(`/api/cnt/milestone?projectId=${PROJECT}`, {
    boqItemId: ls.body.data.item.Id, milestoneNo: 1, titleFa: "تنها مرحله", weightPct: 70, status: "verified",
  }, CONTRACTS);
  assert.ok(r.body.data.progress.weightIssueFa);
});

/* ══════ ریزمتره و دروازهٔ کیفی ══════ */

test("ریزمتره روی ردیف مقطوع رد می‌شود", async () => {
  const c = await makeContract();
  const ls = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0701", titleFa: "مقطوع", pricingBasis: "lump_sum", lumpSumAmount: 500_000,
  }, CONTRACTS);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: ls.body.data.item.Id, sheetNo: 1, count: 1, length: 10,
  }, SITE);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.issues.some((i) => i.code === "CNT-MS-NOT-UNITPRICE"));
});

test("ریزمتره: مقدار از ابعاد محاسبه و تجمعی گزارش می‌شود", async () => {
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id, { contractQty: 1000 });

  const s1 = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 1, count: 2, length: 10, width: 3, height: 0.5,
  }, SITE);
  assert.equal(s1.status, 201, JSON.stringify(s1.body));
  assert.equal(s1.body.data.quantity, 30);

  const s2 = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 2, count: 1, length: 20, width: 1,
  }, SITE);
  assert.equal(s2.body.data.quantity, 20);
  assert.equal(s2.body.data.cumulativeQty, 50);
});

test("ریزمتره: ابعاد نانوشته مقدار را صفر نمی‌کنند", async () => {
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 9, length: 25,
  }, SITE);
  assert.equal(r.body.data.quantity, 25);
});

test("ریزمتره: عبور از مقدار پیمان هشدار می‌دهد ولی مانع نمی‌شود", async () => {
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id, { contractQty: 10, unitRate: 1000 });
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 1, count: 1, length: 25,
  }, SITE);
  assert.equal(r.status, 201);
  assert.ok(r.body.data.overrunFa);
  assert.match(r.body.data.overrunFa, /گذشته/);
});

test("ریزمتره با فعالیت بدون تأییدیهٔ بازرسی ۴۰۹ می‌گیرد", async () => {
  /* دروازهٔ کیفی نقطه‌ای است که کیفیت به پول وصل می‌شود؛ اگر باز بماند
   * کار تأییدنشده هم پول می‌گیرد. */
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 11, count: 1, length: 10, activityId: "فعالیت-بدون-بازرسی",
  }, SITE);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-NO-IR");
});

test("دور زدن دروازه بدون مجوز صریح ۴۰۳ می‌گیرد", async () => {
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 12, count: 1, length: 10,
    activityId: "فعالیت-بدون-بازرسی", override: true, overrideReasonFa: "عجله داریم",
  }, SITE);
  assert.equal(r.status, 403);
  assert.equal(r.body.error.permission, "cnt.ipc.override");
});

test("دور زدن دروازه بدون ذکر دلیل رد می‌شود حتی با مجوز", async () => {
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 13, count: 1, length: 10,
    activityId: "فعالیت-بدون-بازرسی", override: true,
  }, PM);
  assert.equal(r.status, 422);
  assert.ok(r.body.error.issues.some((i) => i.field === "overrideReasonFa"));
});

test("دور زدن دروازه با مجوز و دلیل ثبت می‌شود و در پاسخ پیداست", async () => {
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 14, count: 1, length: 10,
    activityId: "فعالیت-بدون-بازرسی", override: true, overrideReasonFa: "بازرسی با تأخیر ثبت می‌شود",
  }, PM);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.qualityGate.status, "overridden");
  assert.match(r.body.data.qualityGate.messageFa, /u-pm/);
});

/* ── پیمایش خودکار عدم انطباق (مهاجرت 0011) ──
 * پیش از افزوده شدن Ncr.ActivityId، دروازه نمی‌توانست بپرسد «عدم انطباق باز
 * روی این فعالیت هست؟» و فقط تأییدیهٔ بازرسی را می‌دید. این آزمون‌ها همان
 * حلقهٔ بسته را می‌سنجند: بازرسی قبول هست، ولی عدم انطباق باز جلوی پول را
 * می‌گیرد. */

/** رکورد واقعی در جدول عمومی می‌سازد تا پیمایش سرور همان را ببیند. */
async function seed(table, row) {
  const res = await fetch(`${BASE}/api/data/${table}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": CONTRACTS },
    body: JSON.stringify(row),
  });
  const j = await res.json();
  assert.ok(res.status < 300, `ساخت ${table} نشد: ${JSON.stringify(j)}`);
  return j.data ?? j;
}

test("بازرسی پذیرفته‌شده دروازه را باز می‌کند", async () => {
  const act = `ACT-${tag()}`;
  await seed("InspectionRecord", {
    ProjectId: PROJECT, Code: `IR-${tag()}`, ItpPointCode: "ITP-1",
    ActivityId: act, InspectedAt: "2026-06-01", Outcome: "accepted", InspectedBy: "u-qc",
  });
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 21, count: 1, length: 10, activityId: act,
  }, SITE);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.qualityGate.status, "passed");
});

test("عدم انطباق باز روی فعالیت، ثبت را می‌بندد حتی با بازرسی پذیرفته‌شده", async () => {
  /* قلب دروازه: کیفیت بر پول اولویت دارد. */
  const act = `ACT-${tag()}`;
  await seed("InspectionRecord", {
    ProjectId: PROJECT, Code: `IR-${tag()}`, ItpPointCode: "ITP-1",
    ActivityId: act, InspectedAt: "2026-06-01", Outcome: "accepted", InspectedBy: "u-qc",
  });
  await seed("Ncr", {
    ProjectId: PROJECT, Code: `NCR-${tag()}`, TitleFa: "کرمو بودن بتن",
    Severity: "major", Discipline: "civil", RaisedBy: "u-qc",
    RaisedAt: "2026-06-02", Status: "open", ActivityId: act,
  });
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 22, count: 1, length: 10, activityId: act,
  }, SITE);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "E-CNT-OPEN-NCR");
});

test("عدم انطباق بسته‌شده دیگر مانع نیست", async () => {
  const act = `ACT-${tag()}`;
  await seed("InspectionRecord", {
    ProjectId: PROJECT, Code: `IR-${tag()}`, ItpPointCode: "ITP-1",
    ActivityId: act, InspectedAt: "2026-06-01", Outcome: "accepted", InspectedBy: "u-qc",
  });
  await seed("Ncr", {
    ProjectId: PROJECT, Code: `NCR-${tag()}`, TitleFa: "رفع شده",
    Severity: "minor", Discipline: "civil", RaisedBy: "u-qc",
    RaisedAt: "2026-06-02", Status: "closed", ActivityId: act,
  });
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 23, count: 1, length: 10, activityId: act,
  }, SITE);
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test("عدم انطباق باز روی فعالیت دیگر بی‌اثر است", async () => {
  /* اگر همهٔ عدم انطباق‌های پروژه مسدود می‌کردند، یک NCR کل کارگاه را می‌خواباند. */
  const actOk = `ACT-${tag()}`;
  const actBad = `ACT-${tag()}`;
  await seed("InspectionRecord", {
    ProjectId: PROJECT, Code: `IR-${tag()}`, ItpPointCode: "ITP-1",
    ActivityId: actOk, InspectedAt: "2026-06-01", Outcome: "accepted", InspectedBy: "u-qc",
  });
  await seed("Ncr", {
    ProjectId: PROJECT, Code: `NCR-${tag()}`, TitleFa: "ایراد جای دیگر",
    Severity: "major", Discipline: "civil", RaisedBy: "u-qc",
    RaisedAt: "2026-06-02", Status: "open", ActivityId: actBad,
  });
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 24, count: 1, length: 10, activityId: actOk,
  }, SITE);
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test("عدم انطباق تاریخی بدون فعالیت مانع هیچ کارکردی نیست", async () => {
  /* ستون nullable است و رکوردهای پیش از مهاجرت آن را خالی دارند؛ نباید
   * همه را بی‌صدا مسدود کنند. */
  const act = `ACT-${tag()}`;
  await seed("InspectionRecord", {
    ProjectId: PROJECT, Code: `IR-${tag()}`, ItpPointCode: "ITP-1",
    ActivityId: act, InspectedAt: "2026-06-01", Outcome: "accepted", InspectedBy: "u-qc",
  });
  await seed("Ncr", {
    ProjectId: PROJECT, Code: `NCR-${tag()}`, TitleFa: "عدم انطباق قدیمی",
    Severity: "major", Discipline: "civil", RaisedBy: "u-qc",
    RaisedAt: "2025-01-01", Status: "open",
  });
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 25, count: 1, length: 10, activityId: act,
  }, SITE);
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test("مدیر پروژه می‌تواند دروازهٔ عدم انطباق را با دلیل دور بزند", async () => {
  const act = `ACT-${tag()}`;
  await seed("InspectionRecord", {
    ProjectId: PROJECT, Code: `IR-${tag()}`, ItpPointCode: "ITP-1",
    ActivityId: act, InspectedAt: "2026-06-01", Outcome: "accepted", InspectedBy: "u-qc",
  });
  await seed("Ncr", {
    ProjectId: PROJECT, Code: `NCR-${tag()}`, TitleFa: "ایراد جزئی",
    Severity: "minor", Discipline: "civil", RaisedBy: "u-qc",
    RaisedAt: "2026-06-02", Status: "open", ActivityId: act,
  });
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 26, count: 1, length: 10, activityId: act,
    override: true, overrideReasonFa: "عدم انطباق جزئی و در حال رفع است",
  }, PM);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.qualityGate.status, "overridden");
});

test("ریزمتره بدون ارجاع به فعالیت دروازه را اجرا نمی‌کند", async () => {
  /* متره‌های عمومی (مثل بسیج کارگاه) فعالیت ندارند و نباید قفل شوند. */
  const c = await makeContract();
  const item = await makeUnitPriceItem(c.Id);
  const r = await post(`/api/cnt/measurement?projectId=${PROJECT}`, {
    boqItemId: item.Id, sheetNo: 15, count: 1, length: 10,
  }, SITE);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.qualityGate, null);
});

/* ══════ خواندن و رول‌آپ ══════ */

test("شناسنامهٔ پیمان با فهرست بها و پوشش نگاشت خوانده می‌شود", async () => {
  const c = await makeContract({ initialAmount: 1_300_000_000 });
  await makeUnitPriceItem(c.Id, { itemNo: "0901", contractQty: 100, unitRate: 5_000_000, wbsId: "W-1" });
  await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "0902", titleFa: "مقطوع", pricingBasis: "lump_sum",
    chapterCode: "02", lumpSumAmount: 800_000_000,
  }, CONTRACTS);

  const r = await get(`/api/cnt/contracts/${c.Id}?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.items.length, 2);
  assert.equal(r.body.data.summary.boqTotal, 1_300_000_000);
  assert.equal(r.body.data.summary.boqVarianceFa, null);
  assert.equal(r.body.data.mapping.wbsCoveragePct, 50);
  assert.equal(r.body.data.milestones.length, 1);
});

test("شناسنامه با شمارهٔ پیمان هم قابل خواندن است", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/contracts/${c.Code}?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.contract.Id, c.Id);
});

test("پیمان ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await get(`/api/cnt/contracts/ناموجود?projectId=${PROJECT}`);
  assert.equal(r.status, 404);
});

test("رول‌آپ فصل‌ها با تفکیک حالت برمی‌گردد", async () => {
  const c = await makeContract();
  await makeUnitPriceItem(c.Id, { itemNo: "1001", chapterCode: "01", contractQty: 10, unitRate: 1_000_000 });
  await makeUnitPriceItem(c.Id, { itemNo: "1002", chapterCode: "01", contractQty: 5, unitRate: 1_000_000 });
  await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId: c.Id, itemNo: "1003", titleFa: "مقطوع", pricingBasis: "lump_sum", chapterCode: "02", lumpSumAmount: 30_000_000,
  }, CONTRACTS);

  const r = await get(`/api/cnt/boq/rollup?projectId=${PROJECT}&contractId=${c.Id}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.total, 45_000_000);
  const ch01 = r.body.data.chapters.find((x) => x.chapterCode === "01");
  assert.equal(ch01.amount, 15_000_000);
  assert.equal(ch01.itemCount, 2);
  assert.equal(r.body.data.validation.ok, true);
});

test("رول‌آپ بدون contractId خطای مشخص می‌دهد", async () => {
  const r = await get(`/api/cnt/boq/rollup?projectId=${PROJECT}`);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "E-CNT-NO-CONTRACT");
});

/* ══════ اعتبارسنجی دسته‌ای ══════ */

test("بررسی دسته‌ای ردیف‌ها ایرادها را جمعی گزارش می‌کند و چیزی نمی‌نویسد", async () => {
  const before = await get(`/api/cnt/contracts?projectId=${PROJECT}`);
  const r = await post("/api/cnt/boq/validate", {
    items: [
      { ItemNo: "01", TitleFa: "الف", PricingBasis: "unit_price", Unit: "متر", ContractQty: 10, UnitRate: 100, LineAmount: 1000, ChapterCode: "01" },
      { ItemNo: "01", TitleFa: "تکراری", PricingBasis: "unit_price", Unit: "متر", ContractQty: 1, UnitRate: 1, LineAmount: 1, ChapterCode: "01" },
      { ItemNo: "02", TitleFa: "بی‌مبنا", PricingBasis: "نامعلوم" },
    ],
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.ok, false);
  assert.equal(r.body.data.rowCount, 3);
  assert.equal(r.body.data.previewOnly, true);
  const codes = r.body.data.issues.map((i) => i.code);
  assert.ok(codes.includes("CNT-BOQ-DUP"));
  assert.ok(codes.includes("CNT-BOQ-BASIS"));

  const after = await get(`/api/cnt/contracts?projectId=${PROJECT}`);
  assert.equal(after.body.data.count, before.body.data.count, "پیش‌نمایش نباید رکورد بسازد");
});

test("بررسی دسته‌ای بدون ردیف خطای مشخص می‌دهد", async () => {
  const r = await post("/api/cnt/boq/validate", { items: [] });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "E-CNT-NO-ITEMS");
});

/* ══════ فهرست پیمان‌ها ══════ */

test("فهرست پیمان‌ها جمع و شمار پیمان‌های در معرض سقف را می‌دهد", async () => {
  const r = await get(`/api/cnt/contracts?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.data.count > 0);
  assert.ok(Number.isFinite(r.body.data.totals.initialAmount));
  assert.ok(Number.isFinite(r.body.data.totals.atCeilingRisk));
  for (const c of r.body.data.contracts) {
    assert.ok(c.contractTypeFa, `${c.code} عنوان فارسی نوع پیمان ندارد`);
    assert.ok(["ok", "warning", "exceeded"].includes(c.ceilingStatus));
  }
});

test("پروژهٔ ناموجود فهرست خالی می‌دهد نه خطا", async () => {
  const r = await get("/api/cnt/contracts?projectId=پروژه-ناموجود");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.count, 0);
});
