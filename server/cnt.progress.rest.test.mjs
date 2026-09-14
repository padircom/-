/**
 * آزمون اندپوینت‌های پیشرفت پیمان (CNT/D9) روی سرور واقعی.
 *
 * سؤال محوری: آیا عددی که سرور به‌عنوان «پیشرفت» می‌دهد از کارِ
 * واقعاً تأییدشده می‌آید، یا از هر چیزی که کسی ادعا کرده؟
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4727;
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
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-prog-"));
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
    code: `C-${tag()}`, titleFa: "پیمان پیشرفت", contractType: "unit_price",
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

/** صورت‌وضعیت روی ردیف‌های داده‌شده، اختیاراً تا تأیید کامل جلو برده. */
async function addIpc(contractId, lines, { approve = false } = {}) {
  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId, periodCode: `P-${tag()}`,
    periodFrom: "2026-02-01", periodTo: "2026-02-28",
    lines,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.data.id;
  if (approve) {
    for (const [action, actor, user] of [
      ["submit", "contractor", CONTRACTS],
      ["approve", "consultant", CONSULTANT],
      ["approve", "employer", CLIENT],
    ]) {
      const a = await post(`/api/cnt/ipc/${id}/action?projectId=${PROJECT}`, { action, actor }, user);
      assert.equal(a.status, 200, `${action}: ${JSON.stringify(a.body)}`);
    }
  }
  return id;
}

const Q = (c) => `?projectId=${PROJECT}&contractId=${c.Id ?? c}`;
const P = `?projectId=${PROJECT}`;

/* ══════════════ ۱) دروازهٔ ورودی ══════════════ */

test("بدون هویت، ۴۰۱", async () => {
  assert.equal((await get(`/api/cnt/progress?projectId=${PROJECT}&contractId=x`)).status, 401);
});

test("نقش بی‌ربط، ۴۰۳", async () => {
  const c = await makeContract();
  assert.equal((await get(`/api/cnt/progress${Q(c)}`, SITE)).status, 403);
});

test("پیشرفت برای ناظر و کارفرما هم باز است", async () => {
  const c = await makeContract();
  for (const u of [CONSULTANT, CLIENT, PM, CONTRACTS]) {
    assert.equal((await get(`/api/cnt/progress${Q(c)}`, u)).status, 200, u);
  }
});

test("بدون contractId، ۴۰۰", async () => {
  const r = await get(`/api/cnt/progress?projectId=${PROJECT}`, CONTRACTS);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "E-CNT-NO-CONTRACT");
});

test("پیمان ناموجود، ۴۰۴", async () => {
  const r = await get(`/api/cnt/progress?projectId=${PROJECT}&contractId=ghost`, CONTRACTS);
  assert.equal(r.status, 404);
});

test("واژگان در دسترس است", async () => {
  const r = await get("/api/cnt/progress-vocab", CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.milestoneStatusFa.verified, "تأییدشده");
  assert.equal(r.body.data.gapVerdictFa.overpaid, "پرداخت جلوتر از کار");
});

/* ══════════════ ۲) پیشرفت از کارِ تأییدشده ══════════════ */

test("پیمان خالی، پیشرفت صفر با اعلام صریح منبع", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.physicalPct, 0);
  assert.equal(r.body.data.physicalSource, "none");
  assert.ok(r.body.data.warningsFa.some((w) => w.includes("صفر فرض شد")));
});

test("فهرست‌بها بدون کارکرد: منبع boq، پیشرفت صفر", async () => {
  const c = await makeContract();
  await addBoq(c.Id);
  const r = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.physicalSource, "boq");
  assert.equal(r.body.data.physicalPct, 0);
  assert.equal(r.body.data.physical.baseAmount, 100_000);
});

test("صورت‌وضعیت تأییدنشده پیشرفت نمی‌سازد", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id);
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 50 }]);  /* پیش‌نویس */

  const r = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.physicalPct, 0, "ادعای تأییدنشده پیشرفت نیست");
  assert.equal(r.body.data.financialPct, 0);
});

test("صورت‌وضعیت تأییدشده هر دو درصد را می‌سازد", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id);
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 50 }], { approve: true });

  const r = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  const d = r.body.data;
  assert.equal(d.physical.baseAmount, 100_000);
  assert.equal(d.physical.earnedAmount, 50_000);
  assert.equal(d.physicalPct, 50, "نصف ردیف اجرا شده");
  assert.ok(d.financial.approvedGross > 0, "مالی هم ثبت شد");
});

test("وزن ردیف بر مبلغ است، نه تعداد", async () => {
  const c = await makeContract();
  const small = await addBoq(c.Id, { contractQty: 100, unitRate: 100 });   /* ۱۰٬۰۰۰ */
  await addBoq(c.Id, { contractQty: 100, unitRate: 900 });                 /* ۹۰٬۰۰۰ */
  await addIpc(c.Id, [{ boqItemId: small.Id, cumQty: 100 }], { approve: true });

  const r = await get(`/api/cnt/progress/breakdown${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.physicalPct, 10, "ردیف کوچکِ کامل، ۱۰٪ نه ۵۰٪");
  assert.equal(r.body.data.lines[0].weightPct, 90, "بزرگ‌ترین اول");
});

test("تفکیک، ردیف‌ها و فصل‌ها را برمی‌گرداند", async () => {
  const c = await makeContract();
  await addBoq(c.Id, { chapterCode: "03", contractQty: 100, unitRate: 700 });
  await addBoq(c.Id, { chapterCode: "05", contractQty: 100, unitRate: 300 });

  const r = await get(`/api/cnt/progress/breakdown${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.lineCount, 2);
  assert.equal(r.body.data.byChapter[0].chapterCode, "03");
  assert.equal(r.body.data.byChapter[0].weightPct, 70);
});

test("فاصلهٔ فیزیکی و مالی سنجیده و نام‌گذاری می‌شود", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id);
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 50 }], { approve: true });

  const r = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  const g = r.body.data.gap;
  assert.ok(["balanced", "overpaid", "underpaid"].includes(g.verdict));
  assert.equal(typeof g.verdictFa, "string");
  assert.equal(g.gapPct, Number((g.financialPct - g.physicalPct).toFixed(2)));
});

/* ══════════════ ۳) منحنی S ══════════════ */

test("منحنی از صورت‌وضعیت‌های تأییدشده ساخته می‌شود", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id);
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 30 }], { approve: true });

  const r = await get(`/api/cnt/progress/scurve${Q(c)}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.points.length, 1);
  assert.ok(r.body.data.dataThroughPeriod);
  assert.ok(r.body.data.warningsFa.some((w) => w.includes("برنامهٔ زمانی")),
    "بدون برنامه باید صریح بگوید انحراف قابل سنجش نیست");
});

test("منحنی پیمان بی‌داده خالی است نه خطا", async () => {
  const c = await makeContract();
  const r = await get(`/api/cnt/progress/scurve${Q(c)}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.points, []);
  assert.equal(r.body.data.latest, null);
});

/* ══════════════ ۴) نقاط عطف ══════════════ */

/**
 * ردیف مقطوع + نقطهٔ عطف.
 *
 * مسیر ثبت مرحله از پیش وجود داشت و به ردیف مقطوع گره می‌خورد؛
 * ساختن نقطهٔ عطفِ بی‌ردیف ممکن نیست و نباید هم باشد.
 */
async function makeMilestone(contractId, over = {}) {
  const item = await addBoq(contractId, {
    pricingBasis: "lump_sum", contractQty: null, unitRate: null,
    lumpSumAmount: over.lumpSumAmount ?? 0,
  });
  const r = await post(`/api/cnt/milestone?projectId=${PROJECT}`, {
    boqItemId: item.Id, milestoneNo: over.milestoneNo ?? 1,
    titleFa: over.titleFa ?? "پی‌کنی", weightPct: over.weightPct ?? 100,
    plannedDate: over.plannedDate,
  }, CONTRACTS);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { boqItem: item, milestone: r.body.data.item };
}

test("ثبت نقطهٔ عطف روی ردیف مقطوع", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id, { weightPct: 30 });
  assert.equal(milestone.MilestoneNo, 1);
  assert.equal(milestone.WeightPct, 30);
});

test("مدیر پروژه نمی‌تواند تحقق نقطهٔ عطف ثبت کند", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id);
  const r = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "achieved",
  }, PM);
  assert.equal(r.status, 403);
});

test("تأیید بدون سند بسته است", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id);
  const bad = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "verified",
  }, CONTRACTS);
  assert.equal(bad.status, 409);
  assert.equal(bad.body.error.code, "E-CNT-MS-NO-EVIDENCE");
});

test("محقق‌شدهٔ بی‌سند نیم‌شمرده می‌شود، تأییدشدهٔ باسند کامل", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id, { weightPct: 100 });

  const half = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "achieved",
  }, CONTRACTS);
  assert.equal(half.status, 200, JSON.stringify(half.body));
  assert.equal(half.body.data.rollup.progressPct, 50, "بی‌سند = نیم");
  assert.equal(half.body.data.rollup.missingEvidence, 1);

  const full = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "verified", evidenceDocNo: "D-42",
  }, CONTRACTS);
  assert.equal(full.body.data.rollup.progressPct, 100);
  assert.equal(full.body.data.item.VerifiedBy, CONTRACTS);
});

test("واژگان نسل قدیم هم پذیرفته می‌شود", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id, { weightPct: 100 });

  /* «claimed» همان «محقق‌شده» است و سطرهای موجود همین را دارند. */
  const r = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "claimed",
  }, CONTRACTS);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.rollup.progressPct, 50);
});

test("مرحلهٔ ردشده از وزن‌دهی بیرون می‌رود", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id, { weightPct: 100 });
  const r = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "rejected",
  }, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.rollup.totalWeightPct, 0, "مرحلهٔ ردشده مخرج را بزرگ نمی‌کند");
});

test("وضعیت ناشناخته رد می‌شود", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id);
  const r = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "invented",
  }, CONTRACTS);
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, "E-CNT-MS-STATUS");
});

test("نقطهٔ عطف پروژهٔ دیگر، ۴۰۴", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id);
  const r = await post(`/api/cnt/milestone/${milestone.Id}/achieve?projectId=p-other`, {
    status: "achieved",
  }, CONTRACTS);
  assert.equal(r.status, 404);
});

test("دفتر نقاط عطف تجمیع‌شده است", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  await makeMilestone(c.Id, { weightPct: 40, titleFa: "الف" });
  await makeMilestone(c.Id, { weightPct: 60, titleFa: "ب" });

  const r = await get(`/api/cnt/milestone${Q(c)}`, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.items.length, 2);
  assert.equal(r.body.data.totalWeightPct, 100);
  assert.deepEqual(r.body.data.warningsFa, [], "وزن دقیقاً صد، بدون هشدار");
});

test("جمع وزن غیر از صد هشدار می‌دهد", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  await makeMilestone(c.Id, { weightPct: 40 });

  const r = await get(`/api/cnt/milestone${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.totalWeightPct, 40);
  assert.ok(r.body.data.warningsFa.some((w) => w.includes("۱۰۰")));
});

test("پیمان مقطوع بدون مبلغ ردیف، نقطهٔ عطف را منبع می‌کند", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id, { weightPct: 100 });
  await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "verified", evidenceDocNo: "D-7",
  }, CONTRACTS);

  const r = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.physicalSource, "milestone");
  assert.equal(r.body.data.physicalPct, 100);
});

test("فهرست‌بهای مبلغ‌دار بر نقطهٔ عطف اولویت دارد", async () => {
  const c = await makeContract();
  await addBoq(c.Id);
  const { milestone } = await makeMilestone(c.Id, { weightPct: 100 });
  await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "verified", evidenceDocNo: "D-7",
  }, CONTRACTS);

  const r = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.physicalSource, "boq", "فهرست‌بها دقیق‌تر است");
  assert.ok(r.body.data.milestones !== null, "ولی همچنان گزارش می‌شود");
});

/* ══════════════ ۵) نشت بین پروژه‌ها ══════════════ */

test("پیمان پروژهٔ دیگر دیده نمی‌شود", async () => {
  const c = await makeContract();
  for (const p of [
    `/api/cnt/progress?projectId=p-other&contractId=${c.Id}`,
    `/api/cnt/progress/breakdown?projectId=p-other&contractId=${c.Id}`,
    `/api/cnt/progress/scurve?projectId=p-other&contractId=${c.Id}`,
  ]) {
    assert.equal((await get(p, CONTRACTS)).status, 404, p);
  }
});

test("پیشرفت یک پیمان از پیمان دیگر نشت نمی‌کند", async () => {
  const a = await makeContract();
  const b = await makeContract();
  const item = await addBoq(a.Id);
  await addIpc(a.Id, [{ boqItemId: item.Id, cumQty: 100 }], { approve: true });

  const ra = await get(`/api/cnt/progress${Q(a)}`, CONTRACTS);
  const rb = await get(`/api/cnt/progress${Q(b)}`, CONTRACTS);
  assert.equal(ra.body.data.physicalPct, 100);
  assert.equal(rb.body.data.physicalPct, 0);
  assert.equal(rb.body.data.physicalSource, "none");
});

/* ══════════════ ۶) سازگاری اعداد ══════════════ */

/**
 * دو مسیر مختلف نباید دو عدد مختلف بدهند.
 *
 * `progress` و `progress/breakdown` هر دو از همان موتور می‌آیند ولی
 * از دو مسیر جدا؛ اگر یکی روزی فیلترش عوض شود، این آزمون می‌شکند.
 */
test("پیشرفت و تفکیک، عدد یکسان می‌دهند", async () => {
  const c = await makeContract();
  const a = await addBoq(c.Id, { contractQty: 100, unitRate: 300 });
  const b = await addBoq(c.Id, { contractQty: 100, unitRate: 700 });
  await addIpc(c.Id, [
    { boqItemId: a.Id, cumQty: 100 },
    { boqItemId: b.Id, cumQty: 50 },
  ], { approve: true });

  const p = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  const bd = await get(`/api/cnt/progress/breakdown${Q(c)}`, CONTRACTS);
  assert.equal(p.body.data.physicalPct, bd.body.data.physicalPct);
  assert.equal(p.body.data.physical.earnedAmount, bd.body.data.earnedAmount);
  assert.equal(p.body.data.physicalPct, 65, "۳۰٪ کامل + ۷۰٪ نیمه");
});

test("سهم ردیف‌ها با پیشرفت کل جمع می‌خورد", async () => {
  const c = await makeContract();
  const a = await addBoq(c.Id, { contractQty: 100, unitRate: 400 });
  const b = await addBoq(c.Id, { contractQty: 100, unitRate: 600 });
  await addIpc(c.Id, [
    { boqItemId: a.Id, cumQty: 25 },
    { boqItemId: b.Id, cumQty: 75 },
  ], { approve: true });

  const r = await get(`/api/cnt/progress/breakdown${Q(c)}`, CONTRACTS);
  const sum = r.body.data.lines.reduce((s, l) => s + l.contributionPct, 0);
  assert.ok(Math.abs(sum - r.body.data.physicalPct) < 0.05,
    `جمع سهم‌ها ${sum} در برابر کل ${r.body.data.physicalPct}`);
});

test("منحنی S با پیشرفت مالی سازگار است", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id, { contractQty: 100, unitRate: 1_000 });
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 40 }], { approve: true });

  const p = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  const s = await get(`/api/cnt/progress/scurve${Q(c)}`, CONTRACTS);
  assert.equal(s.body.data.latest.actualAmount, p.body.data.financial.approvedGross,
    "آخرین نقطهٔ منحنی همان کارکرد تأییدشده است");
});

test("افزودن صورت‌وضعیت دوم، تجمعی را دوبار نمی‌شمارد", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id, { contractQty: 100, unitRate: 1_000 });
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 30 }], { approve: true });
  const first = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  assert.equal(first.body.data.physicalPct, 30);

  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 70 }], { approve: true });
  const second = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  assert.equal(second.body.data.physicalPct, 70, "۷۰ نه ۱۰۰ — تجمعی است نه دوره‌ای");
  assert.equal(second.body.data.financial.approvedGross, 70_000);
});

test("پیشرفت بالای صد بریده نمی‌شود", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id, { contractQty: 100, unitRate: 1_000 });
  /* اضافه‌کاری فراتر از مقدار پیمان — با دستور صریح سقف‌شکنی. */
  const r = await post(`/api/cnt/ipc?projectId=${PROJECT}`, {
    contractId: c.Id, periodCode: `OVER-${tag()}`,
    periodFrom: "2026-04-01", periodTo: "2026-04-30",
    lines: [{ boqItemId: item.Id, cumQty: 130, allowOverrun: true }],
  }, CONTRACTS);
  if (r.status !== 201) return;  /* اگر سقف‌شکنی بسته باشد، این آزمون موضوعیت ندارد */

  for (const [action, actor, user] of [
    ["submit", "contractor", CONTRACTS],
    ["approve", "consultant", CONSULTANT],
    ["approve", "employer", CLIENT],
  ]) {
    await post(`/api/cnt/ipc/${r.body.data.id}/action?projectId=${PROJECT}`, { action, actor }, user);
  }

  const p = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  assert.ok(p.body.data.physicalPct > 100, `پیشرفت ${p.body.data.physicalPct} باید بالای صد بماند`);
  assert.equal(p.body.data.physical.overrunCount, 1);
  assert.ok(p.body.data.warningsFa.some((w) => w.includes("بیش از مقدار پیمان")));
});

/* ══════════════ ۷) دروازه و یکپارچگی ══════════════ */

test("تحقق نقطهٔ عطف نیازمند مجوز نوشتن است، نه دیدن", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id);
  /* کارفرما پیشرفت را می‌بیند ولی نباید بتواند تحققش را ثبت کند. */
  assert.equal((await get(`/api/cnt/milestone${Q(c)}`, CLIENT)).status, 200);
  const r = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "achieved",
  }, CLIENT);
  assert.equal(r.status, 403);
  assert.equal(r.body.error.permission, "cnt.milestone.manage");
});

test("سند خالی، تأیید را باز نمی‌کند", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id);
  for (const ev of ["", "   "]) {
    const r = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
      status: "verified", evidenceDocNo: ev,
    }, CONTRACTS);
    assert.equal(r.status, 409, `سند «${ev}»`);
  }
});

test("سند قبلی، تأیید بعدی را باز نگه می‌دارد", async () => {
  const c = await makeContract({ contractType: "lump_sum" });
  const { milestone } = await makeMilestone(c.Id);
  await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "achieved", evidenceDocNo: "D-1",
  }, CONTRACTS);
  /* سند از قبل روی سطر هست؛ تأیید نباید دوباره بخواهد. */
  const r = await post(`/api/cnt/milestone/${milestone.Id}/achieve${P}`, {
    status: "verified",
  }, CONTRACTS);
  assert.equal(r.status, 200);
  assert.equal(r.body.data.rollup.progressPct, 100);
});

test("پیشرفت با ضمانت‌نامه و پیش‌پرداخت روی یک پیمان همزیستی دارد", async () => {
  const c = await makeContract();
  const item = await addBoq(c.Id, { contractQty: 100, unitRate: 1_000 });
  await addIpc(c.Id, [{ boqItemId: item.Id, cumQty: 50 }], { approve: true });

  /* هر سه بخش پنل روی همان پیمان باید همزمان پاسخ بدهند. */
  const [prog, guar, sub] = await Promise.all([
    get(`/api/cnt/progress${Q(c)}`, CONTRACTS),
    get(`/api/cnt/guarantee${Q(c)}`, CONTRACTS),
    get(`/api/cnt/subipc${Q(c)}`, CONTRACTS),
  ]);
  assert.equal(prog.status, 200);
  assert.equal(guar.status, 200);
  assert.equal(sub.status, 200);
  assert.equal(prog.body.data.physicalPct, 50);
});

test("مبلغ پیمان در پیشرفت همان مبلغ جاری است", async () => {
  const c = await makeContract({ initialAmount: 1_000_000 });
  const r = await get(`/api/cnt/progress${Q(c)}`, CONTRACTS);
  assert.equal(r.body.data.financial.contractAmount, 1_000_000);
});
