/**
 * MOD-10 / HRM D8 — آزمون REST تحلیل، هیستوگرام و گزارش.
 *
 * تمرکز روی سه چیز که یک داشبورد را دروغگو می‌کند: شمردن ساعتِ
 * تأییدنشده، پر کردن جای خالیِ برنامه با صفر، و نشت داده بین پروژه‌ها.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4736;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
const OTHER = "p2";
let child, dir;

async function req(path, { user = "u-pm", method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (user) headers["x-user-id"] = user;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* غیر JSON */ }
  return { status: res.status, json, text };
}

/** ثبت مبنا با کاربر برنامه‌ریز (مدیر پروژه این حق را ندارد — SOD-27). */
async function plan(lines, over = {}) {
  return req("/api/hrm/manpower-plan", {
    user: "u-planner", method: "POST",
    body: { projectId: PROJECT, lines, ...over },
  });
}

/** برگهٔ کارکرد ساخته و تا وضعیت دلخواه جلو می‌برد. */
async function sheet(crewId, workDate, entries, { approve = true, projectId = PROJECT } = {}) {
  const c = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: { projectId, crewId, workDate, entries },
  });
  assert.equal(c.status, 201, `برگهٔ ${crewId}/${workDate}: ${c.text.slice(0, 250)}`);
  const id = c.json.data.id;
  if (!approve) return id;
  /* زنجیرهٔ کامل تأیید: حالت «تأییدشده» در این ماشین `pm_approved`
   * است و سه امضای پیش از آن لازم دارد. */
  for (const [to, user, extra] of [
    ["submitted", "u-site", {}],
    ["foreman_approved", "u-hr", { foremanSignatureRef: `sig-${crewId}` }],
    ["qc_verified", "u-qc", {}],
    ["pm_approved", "u-pm", {}],
  ]) {
    const t = await req(`/api/hrm/timesheets/${id}/transition`, {
      user, method: "POST", body: { projectId, to, ...extra },
    });
    assert.equal(t.status, 200, `گذار ${to} برای ${id}: ${t.text.slice(0, 250)}`);
  }
  return id;
}

/**
 * سیاههٔ ممیزی از فایل خوانده می‌شود؛ `AuditLog` عمداً مسیر عمومی ندارد.
 *
 * ستون `Details` از نوع json است و درایور آن را رشته ذخیره می‌کند،
 * پس اینجا باز می‌شود تا آزمون روی ساختار ادعا کند نه روی متن.
 */
async function auditRows() {
  try {
    const raw = JSON.parse(await readFile(join(dir, "AuditLog.json"), "utf8"));
    return raw.map((x) => ({
      ...x,
      Details: typeof x.Details === "string" ? JSON.parse(x.Details) : (x.Details ?? {}),
    }));
  } catch {
    return [];
  }
}

const E = (over = {}) => ({
  personId: "PER-A", tradeCode: "CIV-RBR", activityId: "A-100", cbsId: "CBS-1", hoursRaw: 8, ...over,
});

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "hrm-ana-"));
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

  /* حضور گروهی مقصد شارژ را استعلام می‌کند (TD-HRM-03)، پس فعالیت و
   * حساب باید واقعاً وجود داشته باشند. */
  for (const [table, row] of [
    ["CostAccount", {
      Id: "CBS-1", ProjectId: PROJECT, Code: "CBS-1", TitleFa: "هزینهٔ مستقیم نیرو",
      Budget: 1000000, Committed: 0, Actual: 0, Currency: "IRR",
    }],
    ["Activity", {
      Id: "A-100", ProjectId: PROJECT, Code: "A-100", NameFa: "فعالیت آزمون تحلیل",
      BudgetMh: 5000, PlannedStart: "2026-01-01", PlannedFinish: "2026-12-31", PercentComplete: 0,
    }],
  ]) {
    const res = await fetch(`${BASE}/api/data/${table}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": "u-admin" },
      body: JSON.stringify(row),
    });
    assert.ok(res.ok || res.status === 409, `${table}: ${res.status}`);
  }
});

after(async () => {
  child?.kill();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/* ═══════════ ۱. دسترسی ═══════════ */

test("بدون شناسهٔ کاربر، تحلیل ۴۰۱ می‌دهد", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}`, { user: null });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-HRM-AUTH-REQUIRED");
});

test("۴۰۱ و ۴۰۳ دو کد متفاوت‌اند", async () => {
  const a = await req(`/api/hrm/analytics?projectId=${PROJECT}`, { user: null });
  const b = await req(`/api/hrm/analytics?projectId=${PROJECT}`, { user: "u-sub" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 403);
  assert.notEqual(a.json.error.code, b.json.error.code);
  assert.equal(b.json.error.permission, "hrm.analytics.view");
});

test("کارگاه تحلیل را می‌بیند ولی گزارش رسمی صادر نمی‌کند", async () => {
  /* تصمیم تخصیص در کارگاه است، ولی سند مُهردار مبنای مطالبه است. */
  const see = await req(`/api/hrm/analytics?projectId=${PROJECT}`, { user: "u-site" });
  assert.equal(see.status, 200);
  const exp = await req(`/api/hrm/analytics/report?projectId=${PROJECT}`, { user: "u-site" });
  assert.equal(exp.status, 403);
  assert.equal(exp.json.error.permission, "hrm.analytics.export");
});

test("دیدن تحلیل حق نوشتن مبنا نمی‌دهد", async () => {
  const r = await req("/api/hrm/manpower-plan", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, lines: [{ periodCode: "2026-01", plannedMh: 100 }] },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.plan.baseline");
});

test("امضاکنندهٔ گزارش رسمی نمی‌تواند مبنا را بنویسد", async () => {
  /* SOD-27: وگرنه می‌شد مبنا را پایین آورد تا انحراف ناپدید شود،
   * بی‌آنکه هیچ عددی جعل شده باشد. */
  const exp = await req(`/api/hrm/analytics/report?projectId=${PROJECT}`, { user: "u-pm" });
  assert.equal(exp.status, 200, "مدیر پروژه گزارش را امضا می‌کند");
  const w = await req("/api/hrm/manpower-plan", {
    user: "u-pm", method: "POST",
    body: { projectId: PROJECT, lines: [{ periodCode: "2026-01", plannedMh: 1 }] },
  });
  assert.equal(w.status, 403, "ولی مبنا را نمی‌نویسد");
  assert.equal(w.json.error.permission, "hrm.plan.baseline");
});

test("برنامه‌ریز مبنا را می‌نویسد ولی گزارش رسمی صادر نمی‌کند", async () => {
  const exp = await req(`/api/hrm/analytics/report?projectId=${PROJECT}`, { user: "u-planner" });
  assert.equal(exp.status, 403);
  assert.equal(exp.json.error.permission, "hrm.analytics.export");
});

test("کنترل هزینه تحلیل می‌بیند ولی مبنا را دست نمی‌زند", async () => {
  const see = await req(`/api/hrm/analytics?projectId=${PROJECT}`, { user: "u-cost" });
  assert.equal(see.status, 200);
  const w = await req("/api/hrm/manpower-plan", {
    user: "u-cost", method: "POST",
    body: { projectId: PROJECT, lines: [{ periodCode: "2026-01", plannedMh: 1 }] },
  });
  assert.equal(w.status, 403);
});

test("بدون شناسهٔ پروژه درخواست رد می‌شود", async () => {
  const r = await req("/api/hrm/analytics");
  assert.equal(r.status, 400);
});

/* ═══════════ ۲. کاتالوگ ═══════════ */

test("کاتالوگ شش شاخص با آستانه و آستانهٔ انحراف می‌دهد", async () => {
  const r = await req(`/api/hrm/analytics-meta?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.kpis.length, 6);
  assert.ok(r.json.data.kpis.every((k) => k.fa && k.fa.length > 2));
  assert.equal(r.json.data.varianceThreshold, 10);
  assert.deepEqual(r.json.data.groupBy.map((g) => g.code), ["trade", "cbs", "obs"]);
  assert.equal(r.json.meta.engine, "hrm-v1");
});

/* ═══════════ ۳. مبنای نیرو ═══════════ */

test("مبنا ثبت و خوانده می‌شود", async () => {
  const w = await plan([
    { periodCode: "2026-01", tradeCode: "CIV-RBR", plannedMh: 1000, plannedHeadcount: 10 },
    { periodCode: "2026-02", tradeCode: "CIV-RBR", plannedMh: 1200, plannedHeadcount: 12 },
  ]);
  assert.equal(w.status, 200, w.text.slice(0, 250));
  assert.equal(w.json.data.created, 2);

  const r = await req(`/api/hrm/manpower-plan?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.rows.length >= 2);
  assert.ok(r.json.data.revisions.includes("baseline"));
});

test("ارسال دوبارهٔ همان برنامه مبنا را دو برابر نمی‌کند", async () => {
  /* بارگذاری مجدد فایل برنامه اتفاق روزمره است؛ اگر هر بار ردیف تازه
   * می‌ساخت، انحراف بی‌صدا نصف می‌شد. */
  const before = await req(`/api/hrm/manpower-plan?projectId=${PROJECT}`);
  const again = await plan([{ periodCode: "2026-01", tradeCode: "CIV-RBR", plannedMh: 1100, plannedHeadcount: 11 }]);
  assert.equal(again.json.data.created, 0);
  assert.equal(again.json.data.updated, 1);

  const after = await req(`/api/hrm/manpower-plan?projectId=${PROJECT}`);
  assert.equal(after.json.data.rows.length, before.json.data.rows.length);
  const row = after.json.data.rows.find((x) => x.PeriodCode === "2026-01");
  assert.equal(Number(row.PlannedMh), 1100, "مقدار به‌روز شد");
});

test("بازنگری جدا از مبنا نگه داشته می‌شود", async () => {
  /* ادعای تأخیر معمولاً به مبنای اولیه استناد می‌کند؛ بازنگری نباید
   * روی آن بنویسد. */
  const rev = await plan([{ periodCode: "2026-01", tradeCode: "CIV-RBR", plannedMh: 2000, plannedHeadcount: 20 }], { revision: "rev-1" });
  assert.equal(rev.json.data.created, 1, "بازنگری ردیف تازه است نه به‌روزرسانی");

  const base = await req(`/api/hrm/manpower-plan?projectId=${PROJECT}&revision=baseline`);
  const only = base.json.data.rows.find((x) => x.PeriodCode === "2026-01" && x.TradeCode === "CIV-RBR");
  assert.equal(Number(only.PlannedMh), 1100, "مبنای اولیه دست‌نخورده ماند");

  const all = await req(`/api/hrm/manpower-plan?projectId=${PROJECT}`);
  assert.ok(all.json.data.revisions.includes("rev-1"));
});

test("ردیف تکراری داخل یک درخواست، مبنای موازی نمی‌سازد", async () => {
  /* یافتهٔ لوپ ۳: با نمایهٔ درون‌حافظه‌ای، ردیف دومِ همان کلید باید
   * روی ردیف اول بنویسد نه اینکه ردیف تازه بسازد. */
  const r = await plan([
    { periodCode: "2026-11", tradeCode: "DUP", plannedMh: 100, plannedHeadcount: 1 },
    { periodCode: "2026-11", tradeCode: "DUP", plannedMh: 300, plannedHeadcount: 3 },
  ]);
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.json.data.created, 1);
  assert.equal(r.json.data.updated, 1);

  const list = await req(`/api/hrm/manpower-plan?projectId=${PROJECT}`);
  const rows = list.json.data.rows.filter((x) => x.PeriodCode === "2026-11" && x.TradeCode === "DUP");
  assert.equal(rows.length, 1, "فقط یک ردیف باید باشد");
  assert.equal(Number(rows[0].PlannedMh), 300, "آخرین مقدار برنده است");
});

test("برنامهٔ خالی رد می‌شود", async () => {
  const r = await plan([]);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-PLAN-EMPTY");
});

test("کد دورهٔ بدقالب با ایراد ردیفی رد می‌شود", async () => {
  const r = await plan([{ periodCode: "1405/01", plannedMh: 10 }]);
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-PLAN-PERIOD"));
});

test("نفر-ساعت منفی پذیرفته نمی‌شود", async () => {
  const r = await plan([{ periodCode: "2026-01", plannedMh: -5 }]);
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-PLAN-NEGATIVE"));
});

test("ردیف نامعتبر کل دسته را رد می‌کند", async () => {
  /* ثبت نیمه‌کاره یعنی مبنایی که نه کامل است نه غایب — بدترین حالت. */
  const r = await plan([
    { periodCode: "2026-09", tradeCode: "X", plannedMh: 500 },
    { periodCode: "بد", plannedMh: 500 },
  ]);
  assert.equal(r.status, 422);
  const list = await req(`/api/hrm/manpower-plan?projectId=${PROJECT}`);
  assert.equal(list.json.data.rows.filter((x) => x.PeriodCode === "2026-09").length, 0, "ردیف سالم هم ثبت نشد");
});

/* ═══════════ ۴. هیستوگرام از دادهٔ واقعی ═══════════ */

test("فقط برگهٔ تأییدشده در هیستوگرام می‌آید", async () => {
  /* برگهٔ پیش‌نویس هنوز ادعاست، و ادعا در سندی که مبنای مطالبه است
   * جایی ندارد. */
  await sheet("CR-A1", "2026-01-05", [E({ hoursRaw: 8 })]);
  await sheet("CR-A2", "2026-01-06", [E({ personId: "PER-B", hoursRaw: 8 })], { approve: false });

  const r = await req(`/api/hrm/histogram?projectId=${PROJECT}&from=2026-01&to=2026-01`);
  assert.equal(r.status, 200);
  const bar = r.json.data.bars.find((b) => b.periodCode === "2026-01");
  assert.equal(bar.directMh, 8, "فقط هشت ساعت تأییدشده");
});

test("انحراف از مبنای ثبت‌شده محاسبه می‌شود", async () => {
  const r = await req(`/api/hrm/histogram?projectId=${PROJECT}&from=2026-01&to=2026-01`);
  const bar = r.json.data.bars.find((b) => b.periodCode === "2026-01");
  assert.equal(bar.plannedMh, 1100);
  assert.equal(bar.status, "under", "۸ ساعت در برابر ۱۱۰۰ یعنی کسری شدید");
  assert.ok(bar.variancePct < -90);
});

test("ماه بدون برنامه انحرافش نامعلوم است نه صفر", async () => {
  await sheet("CR-B1", "2026-05-04", [E({ personId: "PER-C", hoursRaw: 8 })]);
  const r = await req(`/api/hrm/histogram?projectId=${PROJECT}&from=2026-05&to=2026-05`);
  const bar = r.json.data.bars.find((b) => b.periodCode === "2026-05");
  assert.equal(bar.plannedMh, null);
  assert.equal(bar.variancePct, null);
  assert.equal(bar.status, "no_plan");
});

test("بازه ماه‌های خالی را حذف نمی‌کند", async () => {
  /* شکاف باید دیده شود؛ حذف ماه یعنی خواننده فکر کند داده پیوسته است. */
  const r = await req(`/api/hrm/histogram?projectId=${PROJECT}&from=2026-01&to=2026-05`);
  assert.deepEqual(
    r.json.data.bars.map((b) => b.periodCode),
    ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]
  );
  const empty = r.json.data.bars.find((b) => b.periodCode === "2026-03");
  assert.equal(empty.actualMh, 0);
  assert.equal(empty.actualHeadcount, null, "ماه بی‌داده سرشماری‌اش نامعلوم است");
});

test("منحنی S روی همان بازه ساخته می‌شود", async () => {
  const r = await req(`/api/hrm/histogram?projectId=${PROJECT}&from=2026-01&to=2026-05`);
  assert.equal(r.json.data.sCurve.points.length, 5);
  assert.equal(r.json.data.sCurve.hasBaseline, true);
  const last = r.json.data.sCurve.points[4];
  assert.ok(last.cumActualMh > 0);
  assert.ok(last.deltaPct < 0, "پروژه عقب است");
});

test("بازهٔ وارونه رد می‌شود", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-05&to=2026-01`);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-RANGE-ORDER");
});

test("بازهٔ نیمه رد می‌شود", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01`);
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-RANGE");
});

/* ═══════════ ۵. نیروی پیمانکاری ═══════════ */

test("ساعت پیمانکاری در جمع می‌آید ولی جدا هم قابل دیدن است", async () => {
  const c = await req("/api/hrm/subcontracts", {
    user: "u-contracts", method: "POST",
    body: {
      projectId: PROJECT, contractNo: "SUB-ANA-1", contractorName: "پیمانکار تحلیل",
      startDate: "2026-01-01", endDate: "2026-12-31", pricingModel: "hourly",
      status: "active", scopeTrades: ["CIV-RBR"],
      agreedRates: [{ tradeCode: "CIV-RBR", rate: 100 }],
    },
  });
  assert.equal(c.status, 201, c.text.slice(0, 250));

  const a = await req("/api/hrm/sub-attendance", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, subContractId: c.json.data.id, workDate: "2026-02-10",
      tradeCode: "CIV-RBR", headcount: 5, hoursPerPerson: 8, activityId: "A-100", cbsId: "CBS-1",
    },
  });
  assert.equal(a.status, 201, a.text.slice(0, 250));

  const r = await req(`/api/hrm/histogram?projectId=${PROJECT}&from=2026-02&to=2026-02`);
  const bar = r.json.data.bars.find((b) => b.periodCode === "2026-02");
  assert.equal(bar.subMh, 40);
  assert.equal(bar.directMh, 0);
  assert.equal(bar.actualMh, 40, "در جمع هست");
});

test("سهم پیمانکاری شاخص جدا دارد", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-05`);
  const share = r.json.data.kpis.find((k) => k.code === "SUB_SHARE_PCT");
  assert.ok(share.value > 0, "چهل ساعت پیمانکاری دیده می‌شود");
  assert.ok(share.value <= 100);
  /* سهم از جمع همان بازه است، نه از کل عمر پروژه. */
  const t = r.json.data.histogram.totals;
  assert.equal(share.value, Math.round((t.subMh / (t.subMh + t.directMh)) * 10000) / 100);
});

/* ═══════════ ۶. تجمیع ═══════════ */

test("تجمیع رسته‌ای برچسب فارسی دارد و جمع صد می‌شود", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-05&groupBy=trade`);
  assert.equal(r.json.data.groupBy, "trade");
  const bd = r.json.data.breakdown;
  assert.ok(bd.length >= 1);
  assert.ok(bd.every((x) => x.nameFa));
  assert.ok(Math.abs(bd.reduce((s, x) => s + x.sharePct, 0) - 100) < 0.5);
});

test("تجمیع بر شکست هزینه نمای دیگری می‌دهد", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-05&groupBy=cbs`);
  assert.equal(r.json.data.groupBy, "cbs");
  assert.ok(r.json.data.breakdown.some((x) => x.key === "CBS-1"));
});

test("نمای ناشناخته به رسته برمی‌گردد نه خطا", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&groupBy=زرشک`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.groupBy, "trade");
});

/* ═══════════ ۷. شاخص و هشدار ═══════════ */

test("شش شاخص با وضعیت رنگی برمی‌گردد", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-05`);
  assert.equal(r.json.data.kpis.length, 6);
  for (const k of r.json.data.kpis) {
    assert.ok(["green", "amber", "red", "na"].includes(k.status), `${k.code}: ${k.status}`);
    assert.ok(k.nameFa);
  }
});

test("شاخصِ بی‌داده null است و دلیلش را می‌گوید", async () => {
  /* پروژه‌ای بدون پرونده نباید صفرِ سبز نشان بدهد. */
  const r = await req(`/api/hrm/analytics?projectId=${OTHER}`);
  assert.equal(r.status, 200);
  const comp = r.json.data.kpis.find((k) => k.code === "COMPLIANCE_PCT");
  assert.equal(comp.value, null);
  assert.equal(comp.status, "na");
  assert.ok(comp.caveatFa);
});

test("هشدارها مرتب بر اساس شدت می‌آیند", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-05`);
  const rank = { high: 0, medium: 1, low: 2 };
  const seq = r.json.data.alerts.map((a) => rank[a.severity]);
  assert.deepEqual(seq, [...seq].sort((a, b) => a - b));
  assert.ok(r.json.data.alerts.every((a) => a.code.startsWith("EWS-HRA-")));
});

test("کسری شدید تجهیز هشدار می‌سازد", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-02`);
  assert.ok(r.json.data.alerts.some((a) => a.code === "EWS-HRA-MOB"));
});

test("ماه‌های بی‌برنامه خودشان هشدار می‌شوند", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-05`);
  assert.ok(r.json.data.alerts.some((a) => a.code === "EWS-HRA-NOPLAN"));
});

test("پروژهٔ بی‌مبنا کمبود مبنا را اعلام می‌کند", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${OTHER}`);
  assert.ok(r.json.data.alerts.some((a) => a.code === "EWS-HRA-NOBASE"));
});

test("کارکرد بدون پروندهٔ پرسنلی، سرشماری را صفر جا نمی‌زند", async () => {
  /* یافتهٔ آزمون زنده: «۰ نفر فعال» کنار صدها ساعت ثبت‌شده. */
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-05`);
  assert.ok(r.json.data.histogram.totals.actualMh > 0, "کارکرد وجود دارد");
  const hc = r.json.data.kpis.find((k) => k.code === "HEADCOUNT");
  assert.equal(hc.value, null);
  assert.ok(hc.caveatFa);
  assert.ok(r.json.data.alerts.some((a) => a.code === "EWS-HRA-NOREG"));
});

test("نرخ استفاده روی ظرفیت حساب می‌شود نه ساعت ثبت‌شده", async () => {
  /* یافتهٔ آزمون زنده: پروژه‌ای ۹۳٪ عقب، نرخ استفادهٔ ۱۰۰٪ سبز داشت. */
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-05`);
  const u = r.json.data.kpis.find((k) => k.code === "UTILIZATION_PCT");
  assert.notEqual(u.value, 100, "مخرج نباید همان صورت باشد");
});

test("ظرفیت بی‌سرشماری نامعلوم می‌ماند و نرخ استفاده را خاموش می‌کند", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-05`);
  assert.equal(r.json.data.capacityMh, null);
  const u = r.json.data.kpis.find((k) => k.code === "UTILIZATION_PCT");
  assert.equal(u.value, null);
  assert.equal(u.status, "na");
  assert.ok(u.caveatFa.includes("ظرفیت"));
});

test("نرخ انطباق هرگز از صد بیشتر نمی‌شود", async () => {
  /* یافتهٔ آزمون زنده: صورتْ همهٔ پرونده‌ها را می‌شمرد (از جمله
   * نامزدها) و مخرج فقط نفرات فعال را. */
  for (const p of [PROJECT, OTHER]) {
    const r = await req(`/api/hrm/analytics?projectId=${p}`);
    const c = r.json.data.kpis.find((k) => k.code === "COMPLIANCE_PCT");
    if (c.value !== null) assert.ok(c.value <= 100, `${p}: ${c.value}٪`);
  }
});

test("نامزدِ ثبت‌شده در نرخ انطباقِ نیروی فعال شمرده نمی‌شود", async () => {
  const id = await req("/api/hrm/people", {
    user: "u-hr", method: "POST",
    body: {
      projectId: OTHER, personnelNo: "CAND-1", fullNameFa: "نامزد",
      primaryTradeCode: "CIV-RBR", nationalId: "0011122233", mobile: "09121112233",
    },
  });
  assert.equal(id.status, 201, id.text.slice(0, 200));

  const r = await req(`/api/hrm/analytics?projectId=${OTHER}`);
  assert.equal(r.json.data.compliance.byStatus.candidate, 1);
  assert.equal(r.json.data.compliance.activeCount, 0);
  const c = r.json.data.kpis.find((k) => k.code === "COMPLIANCE_PCT");
  assert.equal(c.value, null, "بدون نیروی فعال، نرخ انطباق تعریف ندارد");
});

/* ═══════════ ۸. مرز پروژه ═══════════ */

test("دادهٔ پروژهٔ دیگر در تحلیل نشت نمی‌کند", async () => {
  await sheet("CR-X1", "2026-01-07", [E({ personId: "PER-Z", hoursRaw: 8 })], { projectId: OTHER });
  const a = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-01`);
  const b = await req(`/api/hrm/analytics?projectId=${OTHER}&from=2026-01&to=2026-01`);
  assert.equal(a.json.data.histogram.bars[0].directMh, 8);
  assert.equal(b.json.data.histogram.bars[0].directMh, 8);
  assert.equal(b.json.data.histogram.bars[0].plannedMh, null, "مبنای p1 به p2 نرسید");
});

test("مبنای پروژهٔ دیگر در فهرست نمی‌آید", async () => {
  const r = await req(`/api/hrm/manpower-plan?projectId=${OTHER}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.rows.length, 0);
});

/* ═══════════ ۹. گزارش رسمی ═══════════ */

test("گزارش سربرگ کامل A4 دارد", async () => {
  const r = await req(`/api/hrm/analytics/report?projectId=${PROJECT}&from=2026-01&to=2026-05`, { user: "u-hr" });
  assert.equal(r.status, 200, r.text.slice(0, 250));
  const h = r.json.data.header;
  assert.equal(h.pageSize, "A4");
  assert.equal(h.projectId, PROJECT);
  assert.ok(h.titleFa.length > 5);
  assert.ok(h.issuedAt);
  assert.equal(h.issuedBy, "u-hr");
  assert.ok(h.headlineFa.length > 10);
});

test("شمارهٔ ردیابی سربرگ با ردیاب پاسخ یکی است", async () => {
  /* اگر کسی بعداً به عدد این برگه استناد کرد، باید همان اجرا پیدا شود. */
  const r = await req(`/api/hrm/analytics/report?projectId=${PROJECT}`, { user: "u-hr" });
  assert.equal(r.json.data.header.traceId, r.json.meta.traceId);
});

test("گزارش مبنای محاسبه را صریح می‌گوید", async () => {
  /* خواننده باید بداند ساعت تأییدنشده حساب نشده، وگرنه فرض می‌کند
   * همهٔ کارکرد را می‌بیند. */
  const r = await req(`/api/hrm/analytics/report?projectId=${PROJECT}`, { user: "u-hr" });
  assert.ok(r.json.data.header.basisFa.includes("تأییدشده"));
});

test("عدد گزارش با عدد تحلیل یکی است", async () => {
  /* دو مسیر، یک حقیقت — وگرنه جلسه سر اینکه کدام درست است می‌گذرد. */
  const q = `projectId=${PROJECT}&from=2026-01&to=2026-05`;
  const a = await req(`/api/hrm/analytics?${q}`, { user: "u-hr" });
  const b = await req(`/api/hrm/analytics/report?${q}`, { user: "u-hr" });
  assert.deepEqual(b.json.data.histogram.totals, a.json.data.histogram.totals);
  assert.deepEqual(
    b.json.data.kpis.map((k) => [k.code, k.value]),
    a.json.data.kpis.map((k) => [k.code, k.value])
  );
});

test("گزارش بازهٔ وارونه را رد می‌کند", async () => {
  const r = await req(`/api/hrm/analytics/report?projectId=${PROJECT}&from=2026-05&to=2026-01`, { user: "u-hr" });
  assert.equal(r.status, 400);
});

test("سربرگ نبود داده را پنهان نمی‌کند", async () => {
  const r = await req(`/api/hrm/analytics/report?projectId=${OTHER}`, { user: "u-hr" });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.header.headlineFa.includes("نامعلوم"), r.json.data.header.headlineFa);
});

test("سربرگ پروژهٔ بی‌پرونده «۰ نفر» نمی‌گوید", async () => {
  const r = await req(`/api/hrm/analytics/report?projectId=${PROJECT}&from=2026-01&to=2026-05`, { user: "u-hr" });
  assert.ok(r.json.data.header.headlineFa.includes("سرشماری نامعلوم"), r.json.data.header.headlineFa);
});

/* ═══════════ ۱۰. یکپارچگی با همسایه ═══════════ */

test("ساعت تحلیل با ساعت بهره‌وری همان دوره یکی است", async () => {
  /* D5 و D8 هر دو از تایم‌شیت تأییدشده می‌خوانند؛ اگر آستانهٔ تأیید
   * یکی نباشد، دو عدد متفاوت از یک ماه بیرون می‌آید و جلسه سر اینکه
   * کدام درست است می‌گذرد. */
  const prod = await req(`/api/hrm/productivity?projectId=${PROJECT}&periodCode=2026-01`, { user: "u-pm" });
  assert.equal(prod.status, 200, prod.text.slice(0, 200));
  const ana = await req(`/api/hrm/analytics?projectId=${PROJECT}&from=2026-01&to=2026-01`);
  assert.equal(
    ana.json.data.histogram.bars[0].directMh,
    prod.json.data.summary.actualMh,
    "نفر-ساعت مستقیم دو ماژول نمی‌خواند"
  );
});

test("تحلیل و پنل انطباق یک سرشماری می‌دهند", async () => {
  const people = await req(`/api/hrm/people?projectId=${PROJECT}`, { user: "u-hr" });
  const ana = await req(`/api/hrm/analytics?projectId=${PROJECT}`);
  assert.equal(ana.json.data.compliance.headcount, people.json.data.headcount);
  assert.equal(ana.json.data.compliance.activeCount, people.json.data.activeCount);
});

/* ═══════════ ۱۱. سیاههٔ ممیزی ═══════════ */

test("صدور گزارش رسمی رد سمت سرور می‌گذارد", async () => {
  /* ممیزی سمت مرورگر برای سندی که مبنای مطالبه می‌شود کافی نیست:
   * کلاینت می‌تواند چیزی نفرستد و هیچ ردی نماند. */
  const before = (await auditRows()).length;
  const r = await req(`/api/hrm/analytics/report?projectId=${PROJECT}&from=2026-01&to=2026-05`, { user: "u-hr" });
  assert.equal(r.status, 200);

  const rows = await auditRows();
  assert.ok(rows.length > before, "ردیف ممیزی افزوده نشد");
  const hit = rows.find((x) => x.Details?.traceId === r.json.meta.traceId);
  assert.ok(hit, "ردیف با همان شناسهٔ ردیابی پیدا نشد");
  assert.equal(hit.Action, "HRM_ANALYTICS_REPORT_EXPORT");
  assert.equal(hit.SubjectId, "u-hr");
  assert.equal(hit.ProjectCode, PROJECT);
});

test("تلاش ناموفق برای صدور رد ممیزی نمی‌گذارد", async () => {
  /* ۴۰۳ پیش از هندلر برگردانده می‌شود؛ ردیف ممیزی برای کاری که
   * اصلاً انجام نشده، سیاهه را با نویز پر می‌کند. */
  const before = (await auditRows()).length;
  const r = await req(`/api/hrm/analytics/report?projectId=${PROJECT}`, { user: "u-site" });
  assert.equal(r.status, 403);
  assert.equal((await auditRows()).length, before);
});

test("تغییر مبنا رد ممیزی با شدت بالاتر می‌گذارد", async () => {
  /* تغییر مبنا می‌تواند انحراف دیروز را محو کند؛ باید ردیابی شود. */
  await plan([{ periodCode: "2026-12", tradeCode: "AUD", plannedMh: 100, plannedHeadcount: 1 }]);
  const first = (await auditRows()).filter((x) => x.Action === "HRM_MANPOWER_BASELINE_SET").at(-1);
  assert.equal(first.Severity, "info", "ثبت تازه");
  assert.equal(first.SubjectId, "u-planner");

  await plan([{ periodCode: "2026-12", tradeCode: "AUD", plannedMh: 999, plannedHeadcount: 9 }]);
  const second = (await auditRows()).filter((x) => x.Action === "HRM_MANPOWER_BASELINE_SET").at(-1);
  assert.equal(second.Severity, "warning", "بازنویسی مبنا هشدار است");
  assert.equal(second.Details.updated, 1);
});

/* ═══════════ ۱۲. قرارداد پاسخ ═══════════ */

test("همهٔ مسیرها قالب پاسخ مشترک دارند", async () => {
  for (const p of ["/api/hrm/analytics-meta", "/api/hrm/analytics", "/api/hrm/histogram", "/api/hrm/manpower-plan"]) {
    const r = await req(`${p}?projectId=${PROJECT}`);
    assert.equal(r.status, 200, `${p}: ${r.text.slice(0, 150)}`);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.meta.engine, "hrm-v1");
    assert.ok(r.json.meta.traceId);
  }
});

test("تحلیل بدون بازه هم کار می‌کند و بازهٔ واقعی را برمی‌گرداند", async () => {
  const r = await req(`/api/hrm/analytics?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.from);
  assert.ok(r.json.data.to);
  assert.ok(r.json.data.from <= r.json.data.to);
});
