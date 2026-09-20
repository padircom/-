/**
 * MOD-10 / HRM D5 — آزمون REST بهره‌وری و ریشه‌یابی.
 *
 * تمرکز روی مرزها: فقط برگهٔ تأییدشده وارد شاخص می‌شود، ایدمپوتنت بودن
 * بازمحاسبه، تفکیک وظیفهٔ ثبت علت از ساخت ادعا، و تغییرناپذیری دورهٔ
 * نهایی‌شده.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4732;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
const PERIOD = "2026-05";
let child, dir;

async function req(path, { user = "u-planner", method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (user) headers["x-user-id"] = user;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* غیر JSON */ }
  return { status: res.status, json, text };
}

/** ساخت فعالیت با بودجهٔ نفر-ساعت روی جدول عمومی. */
async function makeActivity(id, budgetMh, physicalPct, code) {
  return req("/api/data/Activity", {
    user: "u-admin", method: "POST",
    body: {
      Id: id, ProjectId: PROJECT, Code: code ?? id, NameFa: `فعالیت ${id}`,
      PlannedStart: "2026-05-01", PlannedFinish: "2026-05-31",
      PhysicalPct: physicalPct, BudgetMh: budgetMh,
    },
  });
}

/** برگهٔ کارکرد تأییدشده تا مرحلهٔ مدیر پروژه. */
async function approvedSheet(crewId, workDate, entries) {
  const c = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, crewId, workDate, entries },
  });
  assert.equal(c.status, 201, `ساخت برگه ${crewId}: ${c.text.slice(0, 200)}`);
  const id = c.json.data.id;
  const steps = [
    ["submitted", "u-site", {}],
    ["foreman_approved", "u-hr", { foremanSignatureRef: "sig-x" }],
    ["qc_verified", "u-qc", {}],
    ["pm_approved", "u-pm", {}],
  ];
  for (const [to, user, extra] of steps) {
    const t = await req(`/api/hrm/timesheets/${id}/transition`, {
      user, method: "POST", body: { projectId: PROJECT, to, ...extra },
    });
    assert.equal(t.status, 200, `گذار ${to}: ${t.text.slice(0, 200)}`);
  }
  return id;
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "hrm-prd-"));
  /* `server/data` در .gitignore است و در محیط تازه ممکن است اصلاً
   * وجود نداشته باشد؛ نبودش خطا نیست چون درایور JSON جدول نبوده را
   * فهرست خالی می‌گیرد. بدون این محافظ، کل آزمون REST روی یک
   * checkout تمیز می‌افتاد. */
  await cp("server/data", dir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dir, RATE_LIMIT_PER_MINUTE: "100000" },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch { /* بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 150));
  }

  /* سه فعالیت: یکی سبز، یکی قرمز، یکی بدون بودجه. */
  await makeActivity("PA-GREEN", 1000, 100);
  await makeActivity("PA-RED", 1000, 30);
  await makeActivity("PA-NOBUD", 0, 50);

  await approvedSheet("PC-1", "2026-05-04", [
    { personId: "PP-1", tradeCode: "CIV-FRM", activityId: "PA-GREEN", cbsId: "CBS-1", hoursRaw: 8, qtyDone: 6, qtyUom: "m²" },
    { personId: "PP-2", tradeCode: "CIV-FRM", activityId: "PA-GREEN", cbsId: "CBS-1", hoursRaw: 8, qtyDone: 6, qtyUom: "m²" },
  ]);
  await approvedSheet("PC-2", "2026-05-05", [
    { personId: "PP-3", tradeCode: "STR-FIT", activityId: "PA-RED", cbsId: "CBS-2", hoursRaw: 8 },
    { personId: "PP-4", tradeCode: "STR-FIT", activityId: "PA-RED", cbsId: "CBS-2", hoursRaw: 8, attendanceCode: "weather_delay", isProductive: false },
  ]);
});

after(async () => {
  child?.kill();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/* ═══════════ ۱. دسترسی و کاتالوگ ═══════════ */

test("بدون شناسهٔ کاربر، بهره‌وری ۴۰۱ می‌دهد", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`, { user: null });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-HRM-AUTH-REQUIRED");
});

test("نقش بدون مجوز بهره‌وری ۴۰۳ می‌گیرد", async () => {
  /* پیمانکار جزء ساعت خودش را ثبت می‌کند ولی شاخص عملکرد پروژه را
   * نمی‌بیند — این عدد مبنای ارزیابی خودِ اوست. */
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`, { user: "u-sub" });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.productivity.view");
});

test("۴۰۱ و ۴۰۳ دو کد متفاوت‌اند نه یک پیام مبهم", async () => {
  const a = await req(`/api/hrm/rca?projectId=${PROJECT}`, { user: null });
  const b = await req(`/api/hrm/rca?projectId=${PROJECT}`, { user: "u-sub" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 403);
  assert.notEqual(a.json.error.code, b.json.error.code);
});

test("کاتالوگ علت: شانزده علت با دستهٔ فارسی", async () => {
  const r = await req("/api/hrm/rca-catalog");
  assert.equal(r.status, 200);
  assert.equal(r.json.data.reasons.length, 16);
  assert.equal(r.json.data.categories.length, 10);
  assert.ok(r.json.data.reasons.every((x) => x.categoryFa && x.categoryFa.length > 1));
  assert.equal(r.json.data.piThreshold.red, 0.85);
  assert.equal(r.json.data.calibrationMinPeriods, 3);
  assert.equal(r.json.meta.engine, "hrm-v1");
});

test("کاتالوگ متریک با ترجمهٔ فارسی هر شش شاخص", async () => {
  const r = await req("/api/hrm/rca-catalog");
  assert.equal(r.json.data.metrics.length, 6);
  assert.ok(r.json.data.metrics.every((m) => m.fa && m.fa.length > 2));
});

test("پارامتر دوره اجباری است", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}`);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-NO-PERIOD");
});

test("پارامتر پروژه اجباری است", async () => {
  const r = await req(`/api/hrm/productivity?periodCode=${PERIOD}`);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-NO-PROJECT");
});

/* ═══════════ ۲. نمای بهره‌وری ═══════════ */

test("شاخص از برگه‌های تأییدشده ساخته می‌شود", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`);
  assert.equal(r.status, 200);
  const green = r.json.data.items.find((x) => x.activityId === "PA-GREEN");
  assert.ok(green, "فعالیت سبز در خروجی نیست");
  assert.equal(green.budgetMh, 1000);
  assert.equal(green.earnedMh, 1000);
  assert.equal(green.actualMh, 16);
  assert.equal(green.status, "green");
});

test("ساعت غیرمولد جدا گزارش می‌شود ولی از مخرج حذف نمی‌شود", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const red = r.json.data.items.find((x) => x.activityId === "PA-RED");
  assert.equal(red.actualMh, 16);
  assert.equal(red.lostMh, 8, "توقف جوی باید جدا شمرده شود");
  assert.equal(red.earnedMh, 300);
});

test("نام فارسی فعالیت همراه عدد برمی‌گردد", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`);
  assert.ok(r.json.data.items.every((x) => x.activityNameFa && x.activityNameFa.length > 0));
});

test("جمع دوره میانگین وزنی است", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const s = r.json.data.summary;
  assert.equal(s.earnedMh, 1300);
  assert.equal(s.actualMh, 32);
  assert.equal(s.lostMh, 8);
  assert.equal(s.lostPct, 25);
  assert.equal(s.activityCount, 2);
});

test("تجمیع رسته‌ای با نام فارسی رسته", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const t = r.json.data.byTrade;
  assert.equal(t.length, 2);
  assert.ok(t.every((x) => x.tradeFa && x.tradeFa.length > 1));
  assert.ok(t[0].pi <= t[1].pi, "بدترین رسته باید اول باشد");
});

test("سهم اضافه‌کاری دوره محاسبه می‌شود", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`);
  assert.equal(typeof r.json.data.otPct, "number");
  assert.equal(r.json.data.otPct, 0, "همهٔ برگه‌ها هشت ساعته‌اند");
});

test("دورهٔ بدون داده خالی برمی‌گردد نه خطا", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=2019-01`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.items.length, 0);
  assert.equal(r.json.data.summary.pi, 0);
});

test("برگهٔ تأییدنشده وارد شاخص نمی‌شود", async () => {
  /* هستهٔ صداقت این ماژول: عددی که هنوز کسی امضا نکرده نباید در
   * گزارش عملکرد ظاهر شود. */
  const c = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, crewId: "PC-DRAFT", workDate: "2026-05-06",
      entries: [{ personId: "PP-9", tradeCode: "CIV-FRM", activityId: "PA-GREEN", cbsId: "CBS-1", hoursRaw: 8 }],
    },
  });
  assert.equal(c.status, 201);

  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const green = r.json.data.items.find((x) => x.activityId === "PA-GREEN");
  assert.equal(green.actualMh, 16, "ساعت پیش‌نویس نباید اضافه شود");
  assert.equal(r.json.data.timesheet.pending, 1);
  assert.equal(r.json.data.isComplete, false, "پرچم ناکامل باید روشن باشد");
});

test("برگهٔ پروژهٔ دیگر وارد شاخص این پروژه نمی‌شود", async () => {
  const r = await req(`/api/hrm/productivity?projectId=p2&periodCode=${PERIOD}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.items.length, 0);
  assert.equal(r.json.data.summary.actualMh, 0);
});

/* ═══════════ ۳. اجرای محاسبه ═══════════ */

test("نقش فاقد مجوز محاسبه نمی‌تواند اجرا کند", async () => {
  const r = await req("/api/hrm/productivity/compute", {
    user: "u-qc", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.productivity.compute");
});

test("محاسبه سیاهه می‌سازد", async () => {
  const r = await req("/api/hrm/productivity/compute", {
    user: "u-planner", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(r.status, 201, r.text.slice(0, 300));
  assert.equal(r.json.data.created, 2);
  assert.equal(r.json.data.updated, 0);
  assert.ok(r.json.data.messageFa.includes(PERIOD));
});

test("اجرای دوباره با دادهٔ یکسان چیزی را عوض نمی‌کند", async () => {
  /* بدون ایدمپوتنت بودن، هر بار زدن دکمه زمان محاسبه را جابه‌جا
   * می‌کرد و ممیز فکر می‌کرد عدد تغییر کرده است. */
  const r = await req("/api/hrm/productivity/compute", {
    user: "u-planner", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.data.created, 0);
  assert.equal(r.json.data.updated, 0);
  assert.equal(r.json.data.unchanged, 2);
});

test("دورهٔ بدون برگهٔ تأییدشده محاسبه نمی‌شود", async () => {
  const r = await req("/api/hrm/productivity/compute", {
    user: "u-planner", method: "POST", body: { projectId: PROJECT, periodCode: "2019-01" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-151");
});

test("محاسبه بدون پارامتر دوره رد می‌شود", async () => {
  const r = await req("/api/hrm/productivity/compute", {
    user: "u-planner", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 400);
});

/* ═══════════ ۴. ریشه‌یابی ═══════════ */

test("نقش فاقد مجوز ثبت علت ۴۰۳ می‌گیرد", async () => {
  const r = await req("/api/hrm/rca", {
    user: "u-cost", method: "POST",
    body: { projectId: PROJECT, activityId: "PA-RED", periodCode: PERIOD, reasonCode: "RCA-DWG-01", lostMh: 8, noteFa: "نقشهٔ اجرایی نرسیده بود" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.rca.record");
});

test("ثبت علت معتبر", async () => {
  const r = await req("/api/hrm/rca", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, activityId: "PA-RED", periodCode: PERIOD, reasonCode: "RCA-DWG-01", sharePct: 60, lostMh: 8, noteFa: "نقشهٔ سازهٔ فونداسیون تا پایان هفته صادر نشد" },
  });
  assert.equal(r.status, 201, r.text.slice(0, 300));
  assert.equal(r.json.data.isClaimable, true);
  assert.equal(r.json.data.remainingSharePct, 40);
});

test("علت غیرادعاپذیر با پیام صریح ثبت می‌شود", async () => {
  const r = await req("/api/hrm/rca", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, activityId: "PA-RED", periodCode: PERIOD, reasonCode: "RCA-SKL-01", sharePct: 40, lostMh: 4, noteFa: "اکیپ جوشکاری تازه‌وارد بود و سرعت پایین داشت" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.data.isClaimable, false);
  assert.ok(r.json.data.messageFa.includes("ادعای قراردادی نیست"));
  assert.equal(r.json.data.remainingSharePct, 0);
});

test("جمع سهم بیش از صد درصد رد می‌شود", async () => {
  const r = await req("/api/hrm/rca", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, activityId: "PA-RED", periodCode: PERIOD, reasonCode: "RCA-MAT-01", sharePct: 10, lostMh: 1, noteFa: "کمبود میلگرد در انبار کارگاه" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-VALIDATION");
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-142"));
});

test("شرح کوتاه رد می‌شود و شمارهٔ ایراد برمی‌گردد", async () => {
  const r = await req("/api/hrm/rca", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, activityId: "PA-GREEN", periodCode: PERIOD, reasonCode: "RCA-MAT-01", lostMh: 1, noteFa: "دیر" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-143" && i.field === "noteFa"));
});

test("کد علت ناشناخته رد می‌شود", async () => {
  const r = await req("/api/hrm/rca", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, activityId: "PA-GREEN", periodCode: PERIOD, reasonCode: "RCA-FAKE-99", lostMh: 1, noteFa: "علتی که وجود ندارد" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-140"));
});

test("فهرست ریشه‌یابی با تجمیع دسته‌ای", async () => {
  const r = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.count, 2);
  assert.ok(r.json.data.items.every((x) => x.reasonFa && x.categoryFa));
  const dwg = r.json.data.rollup.find((x) => x.category === "drawing");
  assert.equal(dwg.lostMh, 8);
  assert.equal(dwg.claimableMh, 8);
  const skl = r.json.data.rollup.find((x) => x.category === "manpower_skill");
  assert.equal(skl.claimableMh, 0);
});

test("پالایش فهرست بر اساس فعالیت", async () => {
  const r = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}&activityId=PA-RED`);
  assert.equal(r.json.data.count, 2);
  const none = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}&activityId=PA-GREEN`);
  assert.equal(none.json.data.count, 0);
});

test("پرچم ادعاپذیری در فهرست دیده می‌شود", async () => {
  const r = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const dwg = r.json.data.items.find((x) => x.ReasonCode === "RCA-DWG-01");
  assert.equal(dwg.isClaimable, true);
  assert.equal(dwg.claimEligible, true);
  const skl = r.json.data.items.find((x) => x.ReasonCode === "RCA-SKL-01");
  assert.equal(skl.claimEligible, false);
});

/* ═══════════ ۵. پل به ادعا و تفکیک وظیفه ═══════════ */

test("ثبت‌کنندهٔ علت نمی‌تواند خودش ادعا بسازد", async () => {
  /* SOD-20 روی کاغذ است؛ این آزمون ثابت می‌کند در زمان اجرا هم
   * برقرار است. سرپرست کارگاه علت را ثبت کرد، اما پیوند به ادعا
   * مجوز سطح سری می‌خواهد. */
  const list = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const dwg = list.json.data.items.find((x) => x.ReasonCode === "RCA-DWG-01");
  const r = await req(`/api/hrm/rca/${dwg.Id}/claim`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, claimRef: "CLM-1" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.claim.link");
});

test("مدیر پیمان علت ادعاپذیر را به ادعا پیوند می‌زند", async () => {
  const list = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const dwg = list.json.data.items.find((x) => x.ReasonCode === "RCA-DWG-01");
  const r = await req(`/api/hrm/rca/${dwg.Id}/claim`, {
    user: "u-contracts", method: "POST", body: { projectId: PROJECT, claimRef: "CLM-2026-07" },
  });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.json.data.claimRef, "CLM-2026-07");
  assert.equal(r.json.data.lostMh, 8);
});

test("ادعای دوباره روی همان رویداد بسته است", async () => {
  const list = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const dwg = list.json.data.items.find((x) => x.ReasonCode === "RCA-DWG-01");
  const r = await req(`/api/hrm/rca/${dwg.Id}/claim`, {
    user: "u-contracts", method: "POST", body: { projectId: PROJECT, claimRef: "CLM-DUP" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-149");
  assert.ok(r.json.error.message.includes("CLM-2026-07"));
});

test("علت غیرادعاپذیر به ادعا وصل نمی‌شود", async () => {
  const list = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const skl = list.json.data.items.find((x) => x.ReasonCode === "RCA-SKL-01");
  const r = await req(`/api/hrm/rca/${skl.Id}/claim`, {
    user: "u-contracts", method: "POST", body: { projectId: PROJECT, claimRef: "CLM-X" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-147");
});

test("شمارهٔ ادعای خالی رد می‌شود", async () => {
  const list = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const skl = list.json.data.items.find((x) => x.ReasonCode === "RCA-SKL-01");
  const r = await req(`/api/hrm/rca/${skl.Id}/claim`, {
    user: "u-contracts", method: "POST", body: { projectId: PROJECT, claimRef: " " },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-154");
});

test("ریشه‌یابی پروژهٔ دیگر ۴۰۴ می‌دهد نه ۴۰۳", async () => {
  /* وجود یا نبود ردیف در پروژهٔ دیگر هم اطلاعات است. */
  const list = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}`);
  const skl = list.json.data.items.find((x) => x.ReasonCode === "RCA-SKL-01");
  const r = await req(`/api/hrm/rca/${skl.Id}/claim`, {
    user: "u-contracts", method: "POST", body: { projectId: "p2", claimRef: "CLM-Y" },
  });
  assert.equal(r.status, 404);
});

test("شمارش ادعاشده در فهرست درست است", async () => {
  const r = await req(`/api/hrm/rca?projectId=${PROJECT}&periodCode=${PERIOD}`);
  assert.equal(r.json.data.claimedCount, 1);
  const dwg = r.json.data.rollup.find((x) => x.category === "drawing");
  assert.equal(dwg.claimedMh, 8);
});

/* ═══════════ ۶. کالیبراسیون نرخ ═══════════ */

test("نرخ کالیبره‌نشده با پیام هشدار برمی‌گردد", async () => {
  const r = await req(`/api/hrm/rates/calibration?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.minPeriods, 3);
  assert.ok(r.json.data.noteFa.includes("کالیبره‌نشده"));
  const frm = r.json.data.items.find((x) => x.tradeCode === "CIV-FRM");
  assert.ok(frm, "رستهٔ قالب‌بند باید مشاهده داشته باشد");
  assert.equal(frm.isCalibrated, false, "یک دوره برای کالیبراسیون کافی نیست");
  assert.equal(frm.periodCount, 1);
  assert.equal(frm.catalogRate, 0.8);
});

test("نرخ مؤثر تا کالیبره شدن همان نرخ کاتالوگ است", async () => {
  const r = await req(`/api/hrm/rates/calibration?projectId=${PROJECT}`);
  const frm = r.json.data.items.find((x) => x.tradeCode === "CIV-FRM");
  assert.equal(frm.effectiveRate, frm.catalogRate);
  assert.notEqual(frm.observedRate, frm.effectiveRate);
});

test("کالیبراسیون هم مجوز مشاهدهٔ بهره‌وری می‌خواهد", async () => {
  const r = await req(`/api/hrm/rates/calibration?projectId=${PROJECT}`, { user: "u-sub" });
  assert.equal(r.status, 403);
});

/* ═══════════ ۷. نهایی‌سازی متریک ═══════════ */

test("نقش فاقد مجوز نهایی‌سازی ۴۰۳ می‌گیرد", async () => {
  const r = await req("/api/hrm/metrics/finalize", {
    user: "u-planner", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.metric.finalize");
});

test("SOD-19: اجراکنندهٔ محاسبه نهایی‌کننده نیست", async () => {
  /* برنامه‌ریز محاسبه را اجرا می‌کند ولی نهایی‌سازی دست مدیر پروژه
   * است؛ همان کاربر هر دو کار را نمی‌کند. */
  const compute = await req("/api/hrm/productivity/compute", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(compute.status, 403, "مدیر پروژه نباید محاسبه را اجرا کند");
});

test("برگهٔ تأییدنشده جلوی نهایی شدن را می‌گیرد", async () => {
  const r = await req("/api/hrm/metrics/finalize", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-152");
  assert.ok(r.json.error.detailsFa.some((d) => d.includes("تأیید نشده")));
});

test("پس از تعیین تکلیف برگه‌ها، دوره نهایی می‌شود", async () => {
  /* برگهٔ پیش‌نویس باقی‌مانده را تا تأیید مدیر پروژه پیش می‌بریم. */
  const list = await req(`/api/hrm/timesheets?projectId=${PROJECT}`, { user: "u-hr" });
  const draft = list.json.data.items.find((x) => x.CrewId === "PC-DRAFT");
  for (const [to, user, extra] of [
    ["submitted", "u-site", {}],
    ["foreman_approved", "u-hr", { foremanSignatureRef: "sig-z" }],
    ["qc_verified", "u-qc", {}],
    ["pm_approved", "u-pm", {}],
  ]) {
    const t = await req(`/api/hrm/timesheets/${draft.Id}/transition`, {
      user, method: "POST", body: { projectId: PROJECT, to, ...extra },
    });
    assert.equal(t.status, 200, `${to}: ${t.text.slice(0, 150)}`);
  }

  const r = await req("/api/hrm/metrics/finalize", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(r.status, 200, r.text.slice(0, 400));
  assert.ok(r.json.data.snapshotCount >= 4);
  assert.ok(r.json.data.lockedLogCount >= 2);
  assert.ok(r.json.data.messageFa.includes("تغییرناپذیر"));
});

test("عکس متریک ذخیره و با نام فارسی خوانده می‌شود", async () => {
  const r = await req(`/api/hrm/metrics?projectId=${PROJECT}&periodCode=${PERIOD}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.count >= 4);
  assert.equal(r.json.data.finalCount, r.json.data.count);
  assert.ok(r.json.data.items.every((x) => x.metricFa && x.metricFa.length > 2));
  const pi = r.json.data.items.find((x) => x.MetricCode === "PI" && x.Dimension === "project");
  assert.ok(pi, "شاخص بهره‌وری پروژه ذخیره نشده");
  assert.equal(Number(pi.Target), 1);
});

test("پالایش متریک بر اساس کد", async () => {
  const r = await req(`/api/hrm/metrics?projectId=${PROJECT}&periodCode=${PERIOD}&metricCode=PI`);
  assert.ok(r.json.data.count >= 1);
  assert.ok(r.json.data.items.every((x) => x.MetricCode === "PI"));
});

test("نهایی‌سازی دوباره ۴۰۹ می‌دهد", async () => {
  const r = await req("/api/hrm/metrics/finalize", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-150");
});

test("بازمحاسبهٔ دورهٔ نهایی‌شده ۴۰۹ می‌دهد", async () => {
  /* اگر این باز بود، عدد قفل‌شدهٔ گزارش رسمی بی‌سروصدا عوض می‌شد. */
  const r = await req("/api/hrm/productivity/compute", {
    user: "u-planner", method: "POST", body: { projectId: PROJECT, periodCode: PERIOD },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-153");
});

test("ثبت علت جدید در دورهٔ نهایی‌شده ۴۰۹ می‌دهد", async () => {
  const r = await req("/api/hrm/rca", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, activityId: "PA-GREEN", periodCode: PERIOD, reasonCode: "RCA-MAT-01", lostMh: 2, noteFa: "این علت دیر رسید و نباید پذیرفته شود" },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-153");
});

test("پرچم نهایی بودن در نمای بهره‌وری دیده می‌شود", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`);
  assert.equal(r.json.data.isFinal, true);
  assert.equal(r.json.data.isComplete, true);
  assert.equal(r.json.data.timesheet.pending, 0);
});

test("دورهٔ دیگر همچنان باز است — قفل به همهٔ دوره‌ها سرایت نمی‌کند", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=2026-06`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.isFinal, false);
});

/* ═══════════ ۸. قرارداد پاسخ ═══════════ */

test("همهٔ پاسخ‌ها شناسهٔ ردیابی و نسخهٔ موتور دارند", async () => {
  for (const p of [
    `/api/hrm/productivity?projectId=${PROJECT}&periodCode=${PERIOD}`,
    `/api/hrm/rca?projectId=${PROJECT}`,
    `/api/hrm/metrics?projectId=${PROJECT}`,
    `/api/hrm/rates/calibration?projectId=${PROJECT}`,
    "/api/hrm/rca-catalog",
  ]) {
    const r = await req(p);
    assert.equal(r.status, 200, p);
    assert.equal(r.json.ok, true, p);
    assert.match(r.json.meta.traceId, /^req-/, p);
    assert.equal(r.json.meta.engine, "hrm-v1", p);
  }
});

test("خطاها هم شناسهٔ ردیابی دارند", async () => {
  const r = await req(`/api/hrm/productivity?projectId=${PROJECT}`);
  assert.equal(r.json.ok, false);
  assert.match(r.json.error.traceId, /^req-/);
});
