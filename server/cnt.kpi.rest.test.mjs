/**
 * آزمون اندپوینت‌های سنجه و هشدار پیمان (CNT/D10) روی سرور واقعی.
 *
 * سؤال محوری: آیا تابلوی سلامت از دادهٔ واقعی پیمان ساخته می‌شود، و
 * آیا وقتی داده ندارد صادقانه سکوت می‌کند یا صفرهای دروغین می‌سازد؟
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4728;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";

const CONTRACTS = "u-contracts";
const PM = "u-pm";
const CONSULTANT = "u-consultant";
const CLIENT = "u-client";
const SITE = "u-site";

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-kpi-"));
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

async function makeContract(over = {}) {
  const r = await post(`/api/cnt/contracts?projectId=${PROJECT}`, {
    code: `C-${tag()}`, titleFa: "پیمان سنجه", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار",
    initialAmount: 1_000_000, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
    ...over,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

async function addBoq(contractId, over = {}) {
  const r = await post(`/api/cnt/boq?projectId=${PROJECT}`, {
    contractId, itemNo: `03${Math.floor(Math.random() * 9000 + 1000)}`, chapterCode: "03",
    titleFa: "بتن‌ریزی", pricingBasis: "unit_price", unit: "مترمکعب",
    contractQty: 100, unitRate: 1_000, ...over,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data.item;
}

async function addIpc(contractId, lines, { approve = false } = {}) {
  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId, periodCode: `P-${tag()}`,
    periodFrom: "2026-02-01", periodTo: "2026-02-28", lines,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.data.id;
  if (approve) {
    for (const [action, actor, user] of [
      ["submit", "contractor", CONTRACTS],
      ["approve", "consultant", CONSULTANT],
      ["approve", "employer", CLIENT],
    ]) {
      await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action, actor }, user);
    }
  }
  return id;
}

const Q = (c) => `?projectId=${PROJECT}&contractId=${c.Id ?? c}`;
const P = `?projectId=${PROJECT}`;

/* ══════════════ ۱) دروازهٔ ورودی ══════════════ */

test("بدون هویت، ۴۰۱", async () => {
  assert.equal((await get(`/api/cnt/kpi?projectId=${PROJECT}&contractId=x`)).status, 401);
});

test("نقش بی‌ربط، ۴۰۳", async () => {
  const c = await makeContract();
  assert.equal((await get(`/api/cnt/kpi${Q(c)}`, SITE)).status, 403);
});

test("تابلو برای هر چهار نقش ذی‌نفع باز است", async () => {
  const c = await makeContract();
  for (const u of [CONTRACTS, PM, CONSULTANT, CLIENT]) {
    assert.equal((await get(`/api/cnt/kpi${Q(c)}`, u)).status, 200, u);
  }
});

test("بدون contractId، ۴۰۰", async () => {
  const r = await get(`/api/cnt/kpi?projectId=${PROJECT}`, CONTRACTS);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "E-CNT-NO-CONTRACT");
});

test("پیمان ناموجود، ۴۰۴", async () => {
  const r = await get(`/api/cnt/kpi?projectId=${PROJECT}&contractId=ghost`, CONTRACTS);
  assert.equal(r.status, 404);
});

test("واژگان کامل برمی‌گردد", async () => {
  const r = await get("/api/cnt/kpi-vocab", CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.catalog.length, 10);
  assert.equal(r.body.data.rules.length, 7);
  assert.equal(r.body.data.severityFa.critical, "بحرانی");
  assert.equal(r.body.data.healthBandFa.good, "سالم");
});

/* ══════════════ ۲) صداقت در نبود داده ══════════════ */

test("پیمان خالی صفرهای دروغین نمی‌سازد", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  const d = r.body.data;
  assert.equal(d.kpis.byCode.advance_recovered_pct, null, "بدون پیش‌پرداخت = null نه صفر");
  assert.equal(d.kpis.byCode.open_guarantee_count, null, "بدون ضمانت‌نامه = null");
  assert.equal(d.kpis.byCode.avg_ipc_cycle_days, null, "بدون صورت‌وضعیت = null");
});

test("نمرهٔ سلامت با پوشش ناکافی داده نمی‌شود", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.health.score, null);
  assert.equal(r.body.data.health.band, "unknown");
});

test("قاعدهٔ بی‌داده کنار گذاشته می‌شود و گزارش می‌گردد", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  assert.ok(r.body.data.alerts.skipped.length > 0, "سکوت نباید با سلامت اشتباه شود");
  assert.ok(r.body.data.alerts.summaryFa.includes("سنجیده نشد"));
});

/* ══════════════ ۳) سنجه از دادهٔ واقعی ══════════════ */

test("پیشرفت و فاصله از صورت‌وضعیت تأییدشده می‌آید", async () => {
  /* فهرست‌بها باید کل مبلغ پیمان را پوشش دهد، وگرنه فیزیکی و مالی
     دو مخرج متفاوت دارند و «فاصله» چیزی را نشان می‌دهد که وجود
     ندارد. */
  const c = await makeContract({ initialAmount: 100_000 });
  const item = await addBoq(c.Id, { contractQty: 100, unitRate: 1_000 });
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 40 }], { approve: true });

  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  const k = r.body.data.kpis.byCode;
  assert.equal(k.physical_pct, 40);
  assert.equal(k.financial_pct, 40);
  assert.equal(k.progress_gap_pct, 0);
  assert.ok(k.ceiling_used_pct != null);
  assert.equal(r.body.data.isGapReliable, true);
  assert.deepEqual(r.body.data.dataQualityFa, []);
});

test("مشاور تابلو را می‌بیند ولی تاریخچه‌اش را نمی‌نویسد", async () => {
  /* عکس دوره‌ای upsert است: ثبت دوبارهٔ همان دوره، سطر قبلی را
     بازنویسی می‌کند. اگر طرف بیرونی بتواند این کار را بکند، روندی که
     مبنای هشدار است دیگر شاهد نیست. */
  const c = await makeContract();
  const q = `${Q(c)}`;

  const seen = await get(`/api/cnt/kpi${q}`, CONSULTANT);
  assert.equal(seen.status, 200, "مشاور باید تابلو را ببیند");

  const wrote = await post(`/api/cnt/kpi/snapshot${q}`, { periodCode: "1404-05" }, CONSULTANT);
  assert.equal(wrote.status, 403, JSON.stringify(wrote.body));
  assert.equal(wrote.body.error.permission, "cnt.kpi.snapshot");

  const mine = await post(`/api/cnt/kpi/snapshot${q}`, { periodCode: "1404-05" }, CONTRACTS);
  assert.equal(mine.status, 200, "مدیر پیمان باید بتواند ثبت کند");
});

test("فهرست‌بهای ناقص، بی‌اعتباری فاصله را اعلام می‌کند", async () => {
  /* مبلغ پیمان ۱٬۰۰۰٬۰۰۰ ولی فهرست‌بها فقط ۱۰۰٬۰۰۰: فاصلهٔ ۳۶ درصدی
     که در می‌آید، اضافه‌پرداخت نیست — فهرست‌بهای ناتمام است. */
  const c = await makeContract({ initialAmount: 1_000_000 });
  const item = await addBoq(c.Id, { contractQty: 100, unitRate: 1_000 });
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 40 }], { approve: true });

  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.boqCoveragePct, 10);
  assert.equal(r.body.data.isGapReliable, false);
  assert.ok(r.body.data.dataQualityFa.some((d) => d.includes("قابل اتکا نیست")),
    "عدد غلط با ظاهر معتبر، بدترین خروجی است");
});

test("چرخهٔ صورت‌وضعیت پس از تأیید محاسبه می‌شود", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id);
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 50 }], { approve: true });

  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  assert.ok(r.body.data.kpis.byCode.avg_ipc_cycle_days != null, "چرخه باید عدد بگیرد");
});

test("صورت‌وضعیت باز، چرخه را در میانگین می‌آورد", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id);
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 20 }]);  /* پیش‌نویس */
  await post(`/api/cnt/ipc/${await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 30 }])}/action?projectId=${PROJECT}`,
    { action: "submit", actor: "contractor" }, CONTRACTS);

  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  /* یکی ارسال شده و باز مانده: چرخه باید عدد داشته باشد نه null. */
  assert.ok(r.body.data.kpis.byCode.avg_ipc_cycle_days != null);
});

test("ردیف ستاره‌دار نسبت کار جدید را می‌سازد", async () => {
  const c = await makeContract({ initialAmount: 100_000 });
  await addBoq(c.Id, { contractQty: 100, unitRate: 1_000 });
  await addBoq(c.Id, { contractQty: 30, unitRate: 1_000, isStarred: true });

  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  const ratio = r.body.data.kpis.byCode.extra_work_ratio_pct;
  assert.ok(ratio != null, "نسبت باید محاسبه شود");
});

test("تیتر یک جمله است و مهم‌ترین چیز را می‌گوید", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id);
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 50 }], { approve: true });

  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  assert.equal(typeof r.body.data.headlineFa, "string");
  assert.ok(r.body.data.headlineFa.length > 10);
});

/* ══════════════ ۴) عکس دوره‌ای و روند ══════════════ */

test("عکس دوره‌ای ثبت و بازخوانی می‌شود", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id);
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 30 }], { approve: true });

  const s = await post(`/api/cnt/kpi/snapshot${Q(c)}`, { periodCode: "1405-01" }, CONTRACTS);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.data.action, "insert");
  assert.equal(s.body.data.item.PhysicalPct, 30);

  const t = await get(`/api/cnt/kpi/trend${Q(c)}`, CONTRACTS);
  assert.equal(t.body.data.snapshotCount, 1);
});

test("ثبت دوبارهٔ همان دوره، به‌روزرسانی است نه سطر تازه", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id);
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 20 }], { approve: true });
  await post(`/api/cnt/kpi/snapshot${Q(c)}`, { periodCode: "1405-02" }, CONTRACTS);

  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 60 }], { approve: true });
  const again = await post(`/api/cnt/kpi/snapshot${Q(c)}`, { periodCode: "1405-02" }, CONTRACTS);
  assert.equal(again.body.data.action, "update", "دو عکس از یک دوره یعنی دو حقیقت");
  assert.equal(again.body.data.item.PhysicalPct, 60);

  const t = await get(`/api/cnt/kpi/trend${Q(c)}`, CONTRACTS);
  assert.equal(t.body.data.snapshotCount, 1);
});

test("کد دوره برای عکس الزامی است", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/kpi/snapshot${Q(c)}`, {}, CONTRACTS);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-KPI-PERIOD");
});

test("دو دوره روند می‌سازد و جهت را درست می‌فهمد", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id, { contractQty: 100, unitRate: 1_000 });
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 20 }], { approve: true });
  await post(`/api/cnt/kpi/snapshot${Q(c)}`, { periodCode: "1405-01" }, CONTRACTS);

  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 60 }], { approve: true });
  await post(`/api/cnt/kpi/snapshot${Q(c)}`, { periodCode: "1405-02" }, CONTRACTS);

  const t = await get(`/api/cnt/kpi/trend${Q(c)}`, CONTRACTS);
  assert.deepEqual(t.body.data.periods, ["1405-01", "1405-02"]);
  const phys = t.body.data.trends.find((x) => x.code === "physical_pct");
  assert.equal(phys.previous, 20);
  assert.equal(phys.current, 60);
  assert.equal(phys.direction, "improving", "افزایش پیشرفت بهبود است");
});

test("روند بدون عکس، خطا نمی‌دهد", async () => {
  const c = await makeContract();
  const t = await get(`/api/cnt/kpi/trend${Q(c)}`, CONTRACTS);
  assert.equal(t.status, 200);
  assert.equal(t.body.data.snapshotCount, 0);
  assert.ok(t.body.data.summaryFa.includes("هیچ عکس"));
});

test("عکس پیمان دیگر در روند نمی‌آید", async () => {
  const a = await makeContract();
  const b = await makeContract();
  await post(`/api/cnt/kpi/snapshot${Q(a)}`, { periodCode: "1405-01" }, CONTRACTS);

  const t = await get(`/api/cnt/kpi/trend${Q(b)}`, CONTRACTS);
  assert.equal(t.body.data.snapshotCount, 0);
});

/* ══════════════ ۵) قواعد هشدار ══════════════ */

test("همهٔ قواعد پیش‌فرض فهرست می‌شوند، حتی بدون سفارشی‌سازی", async () => {
  const r = await get(`/api/cnt/alert-rule${P}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.items.length, 7);
  for (const it of r.body.data.items) {
    assert.equal(it.isEnabled, true);
    assert.equal(it.effectiveThreshold, it.threshold);
    assert.ok(it.actionFa.length > 20);
  }
});

test("مدیر پیمان نمی‌تواند آستانه را جابه‌جا کند", async () => {
  const r = await post(`/api/cnt/alert-rule${P}`, {
    ruleCode: "EWS-01", thresholdValue: 50,
  }, CONTRACTS);
  assert.equal(r.status, 403, "سنجه‌شونده نباید معیار سنجش خودش را بازتعریف کند");
  assert.equal(r.body.error.permission, "cnt.alertrule.manage");
});

test("مدیر پروژه آستانه را تنظیم می‌کند", async () => {
  const r = await post(`/api/cnt/alert-rule${P}`, {
    ruleCode: "EWS-05", thresholdValue: 60,
  }, PM);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.item.ThresholdValue, 60);
  assert.ok(r.body.data.noteFa.includes("60"));

  const list = await get(`/api/cnt/alert-rule${P}`, PM);
  const rule = list.body.data.items.find((x) => x.code === "EWS-05");
  assert.equal(rule.effectiveThreshold, 60);
  assert.equal(rule.isCustomized, true);
});

test("خاموش کردن قاعده بی‌سروصدا نیست", async () => {
  const r = await post(`/api/cnt/alert-rule${P}`, {
    ruleCode: "EWS-06", isEnabled: false,
  }, PM);
  assert.equal(r.status, 200);
  assert.ok(r.body.data.noteFa.includes("دیگر سنجیده نمی‌شود"));

  const list = await get(`/api/cnt/alert-rule${P}`, PM);
  assert.equal(list.body.data.items.find((x) => x.code === "EWS-06").isEnabled, false);
  assert.ok(list.body.data.disabledCount >= 1);
});

test("قاعدهٔ ناشناخته رد می‌شود", async () => {
  const r = await post(`/api/cnt/alert-rule${P}`, {
    ruleCode: "EWS-99", thresholdValue: 1,
  }, PM);
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, "E-CNT-RULE-NOT-FOUND");
});

test("شدت نامعتبر رد می‌شود", async () => {
  const r = await post(`/api/cnt/alert-rule${P}`, {
    ruleCode: "EWS-01", severity: "catastrophic",
  }, PM);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-RULE-SEVERITY");
});

test("آستانهٔ غیرعددی رد می‌شود", async () => {
  const r = await post(`/api/cnt/alert-rule${P}`, {
    ruleCode: "EWS-01", thresholdValue: "خیلی زیاد",
  }, PM);
  assert.equal(r.status, 422);
});

test("آستانهٔ سفارشی روی تابلو اثر می‌گذارد", async () => {
  /* پروژهٔ جدا تا آستانه‌های آزمون‌های قبلی دخالت نکنند. */
  const c = await makeContract();
  const item = await addBoq(c.Id, { contractQty: 100, unitRate: 1_000 });
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 40 }], { approve: true });

  /* آستانهٔ چرخهٔ صورت‌وضعیت را روی منفی می‌بریم: هر عددی از آن
     بیشتر است، پس هشدار باید حتماً روشن شود. */
  await post(`/api/cnt/alert-rule${P}`, {
    ruleCode: "EWS-05", thresholdValue: -1,
  }, PM);

  const r = await get(`/api/cnt/kpi${Q(c)}`, CONTRACTS);
  assert.ok(r.body.data.kpis.byCode.avg_ipc_cycle_days != null, "سنجه باید داده داشته باشد");
  assert.ok(r.body.data.alerts.fired.some((f) => f.code === "EWS-05"),
    "آستانهٔ سختگیرانه باید هشدار را روشن کند");

  /* برگرداندن به حالت عادی تا آزمون‌های بعدی آلوده نشوند. */
  await post(`/api/cnt/alert-rule${P}`, { ruleCode: "EWS-05", thresholdValue: 45 }, PM);
});

/* ══════════════ ۶) نشت بین پروژه‌ها ══════════════ */

test("تابلوی پیمان پروژهٔ دیگر، ۴۰۴", async () => {
  const c = await makeContract();
  for (const p of [
    `/api/cnt/kpi?projectId=p-other&contractId=${c.Id}`,
    `/api/cnt/kpi/trend?projectId=p-other&contractId=${c.Id}`,
  ]) {
    assert.equal((await get(p, CONTRACTS)).status, 404, p);
  }
});

test("عکس پیمان پروژهٔ دیگر ثبت نمی‌شود", async () => {
  const c = await makeContract();
  const r = await post(`/api/cnt/kpi/snapshot?projectId=p-other&contractId=${c.Id}`, {
    periodCode: "1405-01",
  }, CONTRACTS);
  assert.equal(r.status, 404);
});

test("سنجهٔ یک پیمان از پیمان دیگر نشت نمی‌کند", async () => {
  const a = await makeContract();
  const b = await makeContract();
  const item = await addBoq(a.Id, { contractQty: 100, unitRate: 1_000 });
  await addIpc(a.Id, [{ boqItemId: item.Id, cumQty: 100 }], { approve: true });

  const ra = await get(`/api/cnt/kpi${Q(a)}`, CONTRACTS);
  const rb = await get(`/api/cnt/kpi${Q(b)}`, CONTRACTS);
  assert.equal(ra.body.data.kpis.byCode.physical_pct, 100);
  assert.equal(rb.body.data.kpis.byCode.physical_pct, 0);
  assert.equal(rb.body.data.kpis.byCode.avg_ipc_cycle_days, null);
});
