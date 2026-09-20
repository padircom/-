/**
 * MOD-10 / HRM D6 — آزمون REST اکیپ و نیروی پیمانکاری.
 *
 * تمرکز روی مرزها: تعارض تخصیص میان اکیپ‌ها، دروازهٔ فعال‌سازی و
 * انحلال، جدایی ثبت از تأیید حضور گروهی، ماسک نرخ، و مهم‌تر از همه
 * جلوگیری از دوبار شمردن نفر-ساعت میان تایم‌شیت فردی و حضور گروهی.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4734;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
const OTHER = "p2";
let child, dir;

async function req(path, { user = "u-hr", method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (user) headers["x-user-id"] = user;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* غیر JSON */ }
  return { status: res.status, json, text };
}

/** ساخت اکیپ و برگرداندن شناسه. */
async function makeCrew(code, extra = {}, projectId = PROJECT) {
  const r = await req("/api/hrm/crews", {
    method: "POST",
    body: { projectId, code, nameFa: `اکیپ ${code}`, primaryTradeCode: "CIV-FRM", ...extra },
  });
  assert.equal(r.status, 201, `ساخت اکیپ ${code}: ${r.text.slice(0, 200)}`);
  return r.json.data.id;
}

async function addMember(crewId, personId, extra = {}, user = "u-hr") {
  return req(`/api/hrm/crews/${crewId}/members`, {
    user, method: "POST",
    body: { projectId: PROJECT, personId, fromDate: "2026-06-01", roleInCrew: "skilled", ...extra },
  });
}

/** قرارداد پیمانکاری فعال. */
async function makeSub(no, extra = {}, projectId = PROJECT) {
  const r = await req("/api/hrm/subcontracts", {
    user: "u-contracts", method: "POST",
    body: {
      projectId, contractNo: no, contractorName: `پیمانکار ${no}`,
      scopeTrades: ["CIV-FRM", "CIV-RBR"],
      agreedRates: { "CIV-FRM": 200000, "CIV-RBR": 180000 },
      pricingModel: "hourly", currency: "IRR",
      startDate: "2026-01-01", endDate: "2026-12-31",
      retentionPct: 10, status: "active", ...extra,
    },
  });
  assert.equal(r.status, 201, `ساخت قرارداد ${no}: ${r.text.slice(0, 200)}`);
  return r.json.data.id;
}

async function recordAtt(subId, workDate, extra = {}, user = "u-site") {
  return req("/api/hrm/sub-attendance", {
    user, method: "POST",
    body: {
      projectId: PROJECT, subContractId: subId, workDate,
      tradeCode: "CIV-FRM", headcount: 10, hoursPerPerson: 8,
      activityId: "CA-1", cbsId: "CBS-1", ...extra,
    },
  });
}

let SUB_MAIN, CREW_A, CREW_B;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "hrm-crew-"));
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

  /* مقصد شارژ باید واقعاً وجود داشته باشد (TD-HRM-03): حضور گروهی
   * حالا `activityId` و `cbsId` را استعلام می‌کند. پیش از این، ساعت
   * روی فعالیت ناموجود می‌نشست و تا گزارش رسمی می‌رفت. */
  for (const [table, row] of [
    ["CostAccount", {
      Id: "CBS-1", ProjectId: PROJECT, Code: "CBS-1", TitleFa: "هزینهٔ مستقیم نیرو",
      Budget: 1000000, Committed: 0, Actual: 0, Currency: "IRR",
    }],
    ["Activity", {
      Id: "CA-1", ProjectId: PROJECT, Code: "CA-1", NameFa: "فعالیت آزمون اکیپ",
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

  CREW_A = await makeCrew("CR-A", { targetSize: 4, foremanPersonId: "PR-FM" });
  CREW_B = await makeCrew("CR-B");
  SUB_MAIN = await makeSub("SC-100");
});

after(async () => {
  child?.kill();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/* ═══════════ ۱. دسترسی ═══════════ */

test("بدون شناسهٔ کاربر، تابلوی اکیپ ۴۰۱ می‌دهد", async () => {
  const r = await req(`/api/hrm/crews?projectId=${PROJECT}`, { user: null });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-HRM-AUTH-REQUIRED");
});

test("۴۰۱ و ۴۰۳ دو کد متفاوت‌اند", async () => {
  const a = await req(`/api/hrm/crews?projectId=${PROJECT}`, { user: null });
  const b = await req(`/api/hrm/crews?projectId=${PROJECT}`, { user: "u-sub" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 403);
  assert.notEqual(a.json.error.code, b.json.error.code);
  assert.equal(b.json.error.permission, "hrm.crew.view");
});

test("کارگاه اکیپ می‌سازد ولی منحل نمی‌کند", async () => {
  const make = await req("/api/hrm/crews", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, code: "CR-SITE", nameFa: "اکیپ کارگاه", primaryTradeCode: "CIV-FRM" },
  });
  assert.equal(make.status, 201);
  const kill = await req(`/api/hrm/crews/${make.json.data.id}/disband`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, reasonFa: "دلیل کافی برای انحلال اکیپ" },
  });
  assert.equal(kill.status, 403);
  assert.equal(kill.json.error.permission, "hrm.crew.disband");
});

test("قرارداد پیمانکاری را فقط مدیر پیمان ثبت می‌کند", async () => {
  const r = await req("/api/hrm/subcontracts", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, contractNo: "SC-X", contractorName: "الف", startDate: "2026-01-01", endDate: "2026-12-31" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.sub.manage");
});

test("کاتالوگ ثابت‌ها با ترجمهٔ فارسی برمی‌گردد", async () => {
  const r = await req(`/api/hrm/crew-meta?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.crewRoles.length, 4);
  assert.equal(r.json.data.crewStatuses.length, 3);
  assert.equal(r.json.data.pricingModels.length, 4);
  assert.equal(r.json.data.subAttStates.length, 5);
  assert.ok(r.json.data.crewRoles.every((x) => x.fa && x.fa.length > 1));
  assert.equal(r.json.data.maxSpan, 25);
});

/* ═══════════ ۲. ساخت اکیپ ═══════════ */

test("اکیپ تازه در حال تشکیل است نه فعال", async () => {
  const id = await makeCrew("CR-NEW");
  const r = await req(`/api/hrm/crews/${id}?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.status, "forming");
  assert.equal(r.json.data.statusFa, "در حال تشکیل");
});

test("کد تکراری اکیپ ۴۰۹ می‌گیرد", async () => {
  const r = await req("/api/hrm/crews", {
    method: "POST",
    body: { projectId: PROJECT, code: "CR-A", nameFa: "تکراری", primaryTradeCode: "CIV-FRM" },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-CREW-DUP");
});

test("اکیپ بدون نام و رسته ۴۲۲ با فهرست ایرادها می‌گیرد", async () => {
  const r = await req("/api/hrm/crews", { method: "POST", body: { projectId: PROJECT, code: "" } });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-VALIDATION");
  assert.equal(r.json.error.issues.length, 3);
  assert.ok(r.json.error.issues.every((i) => i.messageFa.length > 3));
});

test("اکیپ ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await req(`/api/hrm/crews/NOPE?projectId=${PROJECT}`);
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HRM-CREW-NOT-FOUND");
});

/* ═══════════ ۳. عضویت و تعارض تخصیص ═══════════ */

test("افزودن عضو ترکیب به‌روزشده را برمی‌گرداند", async () => {
  const r = await addMember(CREW_A, "PR-1", { roleInCrew: "foreman" });
  assert.equal(r.status, 201, r.text.slice(0, 200));
  assert.equal(r.json.data.composition.headcount, 1);
  assert.equal(r.json.data.composition.foremanCount, 1);
  assert.equal(r.json.data.composition.fte, 1);
});

test("عضویت هم‌زمان در دو اکیپ ۴۲۲ می‌گیرد (T-4)", async () => {
  /* همان نفر در اکیپ دوم ⇒ ساعتش در دو برگه ثبت می‌شد. */
  const r = await addMember(CREW_B, "PR-1");
  assert.equal(r.status, 422);
  const e = r.json.error.issues.find((i) => i.code === "E-HRM-165");
  assert.ok(e, r.text.slice(0, 300));
  assert.equal(e.personId, "PR-1");
});

test("جمع تخصیص بیش از صد درصد ۴۲۲ می‌گیرد (T-1)", async () => {
  const a = await addMember(CREW_A, "PR-HALF", { allocationPct: 60 });
  assert.equal(a.status, 201);
  const b = await addMember(CREW_A, "PR-HALF", { allocationPct: 60 });
  assert.equal(b.status, 422);
  assert.ok(b.json.error.issues.some((i) => i.code === "E-HRM-166"));
});

test("تخصیص جزئی مکمل روی همان اکیپ مجاز است و هشدار می‌دهد", async () => {
  const r = await addMember(CREW_A, "PR-HALF", { allocationPct: 40 });
  assert.equal(r.status, 201);
  assert.ok(r.json.data.warnings.some((w) => w.code === "W-HRM-508"));
});

test("درصد تخصیص نامعتبر ۴۲۲ می‌گیرد", async () => {
  const r = await addMember(CREW_A, "PR-BAD", { allocationPct: 150 });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-164"));
});

test("پایان عضویت رکورد را نگه می‌دارد و فقط تاریخ خروج می‌زند", async () => {
  const add = await addMember(CREW_B, "PR-LEAVE");
  assert.equal(add.status, 201);
  const end = await req(`/api/hrm/crews/${CREW_B}/members/${add.json.data.id}/end`, {
    method: "POST", body: { projectId: PROJECT, toDate: "2026-06-30", reasonFa: "انتقال به پروژهٔ دیگر" },
  });
  assert.equal(end.status, 200);

  const view = await req(`/api/hrm/crews/${CREW_B}?projectId=${PROJECT}&onDate=2026-07-15`);
  const m = view.json.data.members.find((x) => x.personId === "PR-LEAVE");
  assert.ok(m, "رکورد عضویت نباید حذف شود");
  assert.equal(m.toDate, "2026-06-30");
  assert.equal(m.isActiveOn, false);
});

test("پس از خروج، همان نفر در اکیپ دیگر پذیرفته می‌شود", async () => {
  const r = await addMember(CREW_A, "PR-LEAVE", { fromDate: "2026-07-01" });
  assert.equal(r.status, 201, r.text.slice(0, 200));
});

test("بستن دوبارهٔ یک عضویت ۴۰۹ می‌گیرد", async () => {
  const add = await addMember(CREW_B, "PR-TWICE");
  const p = { method: "POST", body: { projectId: PROJECT, toDate: "2026-06-20" } };
  const first = await req(`/api/hrm/crews/${CREW_B}/members/${add.json.data.id}/end`, p);
  assert.equal(first.status, 200);
  const second = await req(`/api/hrm/crews/${CREW_B}/members/${add.json.data.id}/end`, p);
  assert.equal(second.status, 409);
  assert.equal(second.json.error.code, "E-HRM-173");
});

test("تاریخ خروج پیش از ورود ۴۲۲ می‌گیرد", async () => {
  const add = await addMember(CREW_B, "PR-BACK");
  const r = await req(`/api/hrm/crews/${CREW_B}/members/${add.json.data.id}/end`, {
    method: "POST", body: { projectId: PROJECT, toDate: "2026-01-01" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-163");
});

test("عضویت ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await req(`/api/hrm/crews/${CREW_B}/members/NOPE/end`, {
    method: "POST", body: { projectId: PROJECT, toDate: "2026-06-30" },
  });
  assert.equal(r.status, 404);
});

/* ═══════════ ۴. گذار حالت اکیپ ═══════════ */

test("اکیپ خالی فعال نمی‌شود و دلیل را می‌گوید", async () => {
  const id = await makeCrew("CR-EMPTY");
  const r = await req(`/api/hrm/crews/${id}/activate`, { method: "POST", body: { projectId: PROJECT, onDate: "2026-06-10" } });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-169");
  assert.ok(r.json.error.detailsFa.some((d) => d.includes("عضو")));
});

test("اکیپ بدون سرپرست فعال نمی‌شود", async () => {
  const id = await makeCrew("CR-NOFM");
  await addMember(id, "PR-NF1", { roleInCrew: "helper" });
  const r = await req(`/api/hrm/crews/${id}/activate`, { method: "POST", body: { projectId: PROJECT, onDate: "2026-06-10" } });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.detailsFa.some((d) => d.includes("سرپرست")));
});

test("اکیپ دارای سرپرست و عضو فعال می‌شود", async () => {
  const r = await req(`/api/hrm/crews/${CREW_A}/activate`, { method: "POST", body: { projectId: PROJECT, onDate: "2026-06-10" } });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.json.data.status, "active");
  assert.ok(r.json.data.composition.headcount >= 1);
});

test("اکیپ فعال دوباره فعال نمی‌شود", async () => {
  const r = await req(`/api/hrm/crews/${CREW_A}/activate`, { method: "POST", body: { projectId: PROJECT } });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-168");
});

test("انحلال بدون دلیل کافی ۴۲۲ می‌گیرد", async () => {
  const r = await req(`/api/hrm/crews/${CREW_A}/disband`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, reasonFa: "تمام" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-171");
});

test("اکیپ دارای عضو فعال منحل نمی‌شود", async () => {
  const r = await req(`/api/hrm/crews/${CREW_A}/disband`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, reasonFa: "پایان عملیات قالب‌بندی منطقهٔ یک" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-172");
  assert.ok(r.json.error.detailsFa.some((d) => d.includes("عضو فعال")));
});

test("اکیپ خالی با دلیل کافی منحل می‌شود و دوباره منحل نمی‌شود", async () => {
  const id = await makeCrew("CR-GONE");
  const body = { projectId: PROJECT, reasonFa: "ادغام با اکیپ مجاور پس از پایان جبهه" };
  const first = await req(`/api/hrm/crews/${id}/disband`, { user: "u-pm", method: "POST", body });
  assert.equal(first.status, 200, first.text.slice(0, 200));
  assert.equal(first.json.data.status, "disbanded");
  const second = await req(`/api/hrm/crews/${id}/disband`, { user: "u-pm", method: "POST", body });
  assert.equal(second.status, 409);
  assert.equal(second.json.error.code, "E-HRM-170");
});

test("اکیپ منحل‌شده عضو تازه نمی‌پذیرد", async () => {
  const id = await makeCrew("CR-DEAD");
  await req(`/api/hrm/crews/${id}/disband`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, reasonFa: "لغو جبههٔ کاری پیش از شروع" },
  });
  const r = await addMember(id, "PR-ZOMBIE");
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-170");
});

/* ═══════════ ۵. تابلوی اکیپ و نرخ استفاده ═══════════ */

test("تابلو ترکیب و خلاصه را می‌دهد", async () => {
  const r = await req(`/api/hrm/crews?projectId=${PROJECT}&onDate=2026-06-10&workingDays=20`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.items.length >= 3);
  assert.equal(r.json.data.utilizationAvailable, true);
  const a = r.json.data.items.find((x) => x.code === "CR-A");
  assert.ok(a.composition.headcount >= 1);
  assert.ok(a.utilization.availableHours > 0);
  assert.equal(typeof r.json.data.summary.crewCount, "number");
});

test("بدون روز کاری، نرخ استفاده نامشخص است نه صفر", async () => {
  /* صفر نشان دادن یعنی «هیچ‌کس کار نکرد» که دروغ است. */
  const r = await req(`/api/hrm/crews?projectId=${PROJECT}&onDate=2026-06-10`);
  assert.equal(r.json.data.utilizationAvailable, false);
  const a = r.json.data.items.find((x) => x.code === "CR-A");
  assert.equal(a.utilization.utilizationPct, null);
  assert.equal(a.utilization.flag, "na");
});

test("ساعت اکیپ پیمانکاری هم در نرخ استفاده دیده می‌شود", async () => {
  /* لوپ ۴: اکیپی که با حضور گروهی کار می‌کند ساعتش در دفتر دیگری
   * است؛ اگر تابلو فقط تایم‌شیت را بخواند، اکیپِ سرِ کار «۰٪ قرمز»
   * دیده می‌شود — هشدار کاذبی که مدیر را به اکیپ سالم می‌فرستد. */
  const crew = await makeCrew("CR-UTIL", { foremanPersonId: "PR-UF" });
  await addMember(crew, "PR-UTIL1", { fromDate: "2026-08-01", roleInCrew: "foreman" });

  const before = await req(`/api/hrm/crews?projectId=${PROJECT}&onDate=2026-08-10&workingDays=1`);
  assert.equal(before.json.data.items.find((x) => x.code === "CR-UTIL").utilization.chargedHours, 0);

  const att = await recordAtt(SUB_MAIN, "2026-08-10", { crewId: crew, headcount: 1, hoursPerPerson: 8 });
  assert.equal(att.status, 201, att.text.slice(0, 200));

  const after = await req(`/api/hrm/crews?projectId=${PROJECT}&onDate=2026-08-10&workingDays=1`);
  const u = after.json.data.items.find((x) => x.code === "CR-UTIL").utilization;
  assert.equal(u.chargedHours, 8, "ساعت حضور گروهی باید شمرده شود");
  assert.equal(u.utilizationPct, 100);
  assert.equal(u.flag, "green", "اکیپ سرِ کار نباید قرمز دیده شود");
});

test("ردیف حضور برگشتی در نرخ استفاده شمرده نمی‌شود", async () => {
  const list = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}&periodCode=2026-08`);
  const row = list.json.data.items.find((x) => x.workDate === "2026-08-10");
  await req(`/api/hrm/sub-attendance/${row.id}/verify`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, reject: true, reasonFa: "نفرات در دروازه ثبت نشده بودند" },
  });
  const after = await req(`/api/hrm/crews?projectId=${PROJECT}&onDate=2026-08-10&workingDays=1`);
  assert.equal(after.json.data.items.find((x) => x.code === "CR-UTIL").utilization.chargedHours, 0);
});

test("کسری نسبت به اندازهٔ هدف در ترکیب گزارش می‌شود", async () => {
  const r = await req(`/api/hrm/crews/${CREW_A}?projectId=${PROJECT}&onDate=2026-06-10`);
  assert.ok(r.json.data.composition.issues.some((i) => i.code === "W-HRM-505"));
});

/* ═══════════ ۶. قرارداد پیمانکاری و ماسک نرخ ═══════════ */

test("فهرست قرارداد نرخ و ترجمهٔ مدل قیمت را می‌دهد", async () => {
  const r = await req(`/api/hrm/subcontracts?projectId=${PROJECT}`, { user: "u-hr" });
  assert.equal(r.status, 200);
  const c = r.json.data.items.find((x) => x.contractNo === "SC-100");
  assert.equal(c.agreedRates["CIV-FRM"], 200000);
  assert.equal(c.pricingModelFa, "ساعتی");
});

test("کارگاه حضور ثبت می‌کند ولی نرخ قرارداد را اصلاً نمی‌بیند", async () => {
  /* مرز واقعی دسترسی است نه ماسک: `hrm.sub.record` باز است و
   * `hrm.sub.view` بسته، پس مبلغ هرگز به کارگاه نمی‌رسد. */
  const denied = await req(`/api/hrm/subcontracts?projectId=${PROJECT}`, { user: "u-site" });
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.permission, "hrm.sub.view");

  const allowed = await req(`/api/hrm/subcontracts?projectId=${PROJECT}`, { user: "u-cost" });
  assert.equal(allowed.status, 200, "کنترل هزینه باید مبنای هزینه را ببیند");
  assert.equal(allowed.json.data.items.find((x) => x.contractNo === "SC-100").agreedRates["CIV-FRM"], 200000);
});

test("قرارداد با تاریخ پایان پیش از شروع ۴۲۲ می‌گیرد", async () => {
  const r = await req("/api/hrm/subcontracts", {
    user: "u-contracts", method: "POST",
    body: { projectId: PROJECT, contractNo: "SC-BAD", contractorName: "الف", startDate: "2026-06-01", endDate: "2026-01-01" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-163"));
});

test("شمارهٔ قرارداد تکراری ۴۰۹ می‌گیرد", async () => {
  const r = await req("/api/hrm/subcontracts", {
    user: "u-contracts", method: "POST",
    body: { projectId: PROJECT, contractNo: "SC-100", contractorName: "پیمانکار رقیب", startDate: "2026-01-01", endDate: "2026-12-31" },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-SUB-DUP");
});

test("مدل قیمت‌گذاری نامعتبر رد می‌شود", async () => {
  const r = await req("/api/hrm/subcontracts", {
    user: "u-contracts", method: "POST",
    body: { projectId: PROJECT, contractNo: "SC-PM", contractorName: "ج", startDate: "2026-01-01", endDate: "2026-12-31", pricingModel: "barter" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-184"));
});

/* ═══════════ ۷. حضور گروهی ═══════════ */

test("قرارداد ویرایش می‌شود و نرخ جاافتاده اضافه می‌شود", async () => {
  /* رفع TD-HRM-04. بن‌بست زنده اثبات شد: قراردادی با نرخ جاافتاده،
   * حضور آن رسته را با `W-HRM-510` می‌پذیرفت، صورت‌کارکرد با ساعت
   * بی‌نرخ در `draft` قفل می‌ماند — و هیچ راهی برای افزودن نرخ نبود.
   * کار انجام شده بود ولی پول هرگز پرداخت نمی‌شد. */
  const sub = await makeSub("SC-PATCH", { agreedRates: { "CIV-FRM": 200000 } });
  const r = await req(`/api/hrm/subcontracts/${sub}`, {
    user: "u-contracts", method: "PATCH",
    body: { projectId: PROJECT, agreedRates: { "CIV-RBR": 190000 } },
  });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.json.data.ratesChanged.length, 1);
  assert.equal(r.json.data.ratesChanged[0].trade, "CIV-RBR");
  assert.equal(r.json.data.ratesChanged[0].from, null, "نرخ تازه بود، نه تغییر");
});

test("نرخ‌ها ادغام می‌شوند نه جایگزین", async () => {
  /* ارسال یک رسته نباید بقیه را پاک کند؛ وگرنه هر ویرایش جزئی باید
   * کل جدول را دوباره بفرستد و دیر یا زود یکی جا می‌افتد. */
  const list = await req(`/api/hrm/subcontracts?projectId=${PROJECT}`, { user: "u-contracts" });
  /* مسیر فهرست میدان‌ها را camelCase می‌دهد، نه نام ستون. */
  const row = list.json.data.items.find((x) => x.contractNo === "SC-PATCH");
  assert.ok(row, "قرارداد پیدا نشد");
  const rates = typeof row.agreedRates === "string" ? JSON.parse(row.agreedRates) : row.agreedRates;
  assert.equal(Number(rates["CIV-FRM"]), 200000, "نرخ قبلی پاک شد");
  assert.equal(Number(rates["CIV-RBR"]), 190000);
});

test("شمارهٔ قرارداد هویت سند است و عوض نمی‌شود", async () => {
  /* عوض کردنش یعنی ساختن قرارداد دیگری زیر پوست همین رکورد، و
   * ارجاع‌های بیرونی بی‌صدا به سند اشتباه اشاره می‌کنند. */
  const sub = await makeSub("SC-ID");
  const r = await req(`/api/hrm/subcontracts/${sub}`, {
    user: "u-contracts", method: "PATCH",
    body: { projectId: PROJECT, contractNo: "SC-ID-NEW" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-165"));
});

test("قرارداد از پروژهٔ دیگر قابل ویرایش نیست", async () => {
  /* `hrmProjectOf` پروژه را از بدنه می‌خواند، پس قرارداد در دامنهٔ
   * پروژهٔ دیگر اصلاً پیدا نمی‌شود — نشت بین پروژه‌ای بسته است. */
  const sub = await makeSub("SC-MOVE");
  const ok = await req(`/api/hrm/subcontracts/${sub}`, {
    user: "u-contracts", method: "PATCH",
    body: { projectId: PROJECT, contractorName: "نام تازه" },
  });
  assert.equal(ok.status, 200);

  const bad = await req(`/api/hrm/subcontracts/${sub}`, {
    user: "u-contracts", method: "PATCH",
    body: { projectId: OTHER, contractorName: "تلاش از پروژهٔ دیگر" },
  });
  assert.equal(bad.status, 404, "قرارداد نباید از پروژهٔ دیگر دیده شود");
});

test("نرخ صفر یا منفی رد می‌شود", async () => {
  const sub = await makeSub("SC-ZERO");
  const r = await req(`/api/hrm/subcontracts/${sub}`, {
    user: "u-contracts", method: "PATCH",
    body: { projectId: PROJECT, agreedRates: { "CIV-RBR": 0 } },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-168"));
});

test("بدنهٔ بدون تغییر رد می‌شود", async () => {
  /* «ذخیره شد» بدون اینکه چیزی ذخیره شود، بدترین بازخورد است. */
  const sub = await makeSub("SC-NOOP");
  const r = await req(`/api/hrm/subcontracts/${sub}`, {
    user: "u-contracts", method: "PATCH", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-170");
});

test("ویرایش قرارداد مجوز مدیریت می‌خواهد", async () => {
  const sub = await makeSub("SC-PERM");
  const r = await req(`/api/hrm/subcontracts/${sub}`, {
    user: "u-site", method: "PATCH",
    body: { projectId: PROJECT, contractorName: "تلاش بی‌مجوز" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.sub.manage");
});

test("تغییر نرخ رد ممیزی با شدت هشدار می‌گذارد", async () => {
  /* تغییر نرخ مستقیماً مبلغ صورت‌کارکرد را عوض می‌کند. */
  const rows = JSON.parse(await readFile(join(dir, "AuditLog.json"), "utf8")).map((x) => ({
    ...x, Details: typeof x.Details === "string" ? JSON.parse(x.Details) : (x.Details ?? {}),
  }));
  const hit = rows.find((x) => x.Action === "HRM_SUBCONTRACT_UPDATED" && x.Details.ratesChanged?.length);
  assert.ok(hit, "رد ممیزی تغییر نرخ ثبت نشد");
  assert.equal(hit.Severity, "warning");
});

test("حضور گروهی روی فعالیت ناموجود ثبت نمی‌شود", async () => {
  /* رفع TD-HRM-03. زنده اثبات شد: ۱۰۸ نفر-ساعت روی `GHOST-ACT` ثبت
   * شد، در هیستوگرام D8 نشست، در تجمیع CBS ظاهر شد و راهی گزارش
   * رسمی می‌شد — بی‌آنکه آن فعالیت هرگز وجود داشته باشد. */
  const r = await recordAtt(SUB_MAIN, "2026-05-20", { activityId: "GHOST-ACT" });
  assert.equal(r.status, 422, r.text.slice(0, 200));
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-190"), JSON.stringify(r.json.error.issues));
});

test("حضور گروهی روی حساب هزینهٔ ناموجود ثبت نمی‌شود", async () => {
  /* یک غلط تایپی در کد حساب کافی بود تا ساعت واقعی روی حسابی بنشیند
   * که نه در بودجه دیده می‌شود نه در انحراف. */
  const r = await recordAtt(SUB_MAIN, "2026-05-21", { cbsId: "GHOST-CBS" });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-191"));
});

test("حساب هزینهٔ پروژهٔ دیگر پذیرفته نمی‌شود", async () => {
  /* وجود داشتن کافی نیست — باید به همین پروژه تعلق داشته باشد. */
  const res = await fetch(`${BASE}/api/data/CostAccount`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": "u-admin" },
    body: JSON.stringify({
      Id: "CBS-OTHER-CREW", ProjectId: OTHER, Code: "CBS-OTHER-CREW",
      TitleFa: "حساب پروژهٔ دیگر", Budget: 999, Committed: 0, Actual: 0, Currency: "IRR",
    }),
  });
  assert.ok(res.ok || res.status === 409);

  const r = await recordAtt(SUB_MAIN, "2026-05-22", { cbsId: "CBS-OTHER-CREW" });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-191"));
});

test("مقصد شارژ واقعی پذیرفته می‌شود", async () => {
  const r = await recordAtt(SUB_MAIN, "2026-05-23");
  assert.equal(r.status, 201, r.text.slice(0, 200));
});

test("ثبت حضور گروهی جمع را از نفر×ساعت می‌سازد نه از ورودی کاربر", async () => {
  const r = await recordAtt(SUB_MAIN, "2026-05-10", { totalHours: 9999 });
  assert.equal(r.status, 201, r.text.slice(0, 200));
  assert.equal(r.json.data.totalHours, 80);
  assert.equal(r.json.data.status, "submitted");
  assert.equal(r.json.data.periodCode, "2026-05");
});

test("رستهٔ خارج از دامنهٔ قرارداد رد می‌شود", async () => {
  const r = await recordAtt(SUB_MAIN, "2026-05-11", { tradeCode: "ELE-CBL" });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-185"));
});

test("تاریخ بیرون بازهٔ قرارداد رد می‌شود", async () => {
  const r = await recordAtt(SUB_MAIN, "2025-11-01");
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-181"));
});

test("سقف ساعت per-person است: بیست نفر چهارده ساعت مجاز، یک نفر بیست ساعت نه", async () => {
  /* ۲۸۰ نفر-ساعت در یک ردیف مجاز است چون سقف روی «هر نفر» است؛
   * ۱۴ ساعتِ هر نفر فراتر از عادی+اضافه‌کاری (۱۲) است پس هشدار
   * می‌گیرد ولی زیر سقف مطلق (۱۶) است پس بسته نمی‌شود. */
  const many = await recordAtt(SUB_MAIN, "2026-05-12", { headcount: 20, hoursPerPerson: 14 });
  assert.equal(many.status, 201);
  assert.equal(many.json.data.totalHours, 280);
  assert.ok(many.json.data.warnings.some((w) => w.code === "W-HRM-509"));

  const one = await recordAtt(SUB_MAIN, "2026-05-13", { headcount: 1, hoursPerPerson: 20 });
  assert.equal(one.status, 422);
  assert.ok(one.json.error.issues.some((i) => i.code === "E-HRM-188"));
});

test("ساعت درست زیر سقف هشدار نمی‌گیرد", async () => {
  const r = await recordAtt(SUB_MAIN, "2026-05-16", { headcount: 6, hoursPerPerson: 12 });
  assert.equal(r.status, 201);
  assert.equal(r.json.data.warnings.filter((w) => w.code === "W-HRM-509").length, 0);
});

test("ساعت بی‌فعالیت یا بی‌حساب هزینه رد می‌شود", async () => {
  const r = await recordAtt(SUB_MAIN, "2026-05-14", { activityId: "", cbsId: "" });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-189"));
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-190"));
});

test("ردیف تکراری همان روز-رسته-فعالیت ۴۰۹ می‌گیرد", async () => {
  const r = await recordAtt(SUB_MAIN, "2026-05-10");
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-SUBATT-DUP");
});

test("قرارداد ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await recordAtt("NOPE", "2026-05-20");
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HRM-SUB-NOT-FOUND");
});

test("قرارداد غیرفعال حضور نمی‌پذیرد", async () => {
  const id = await makeSub("SC-DRAFT", { status: "draft" });
  const r = await recordAtt(id, "2026-05-15");
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-183"));
});

test("فهرست حضور خلاصهٔ وضعیت‌ها را می‌دهد", async () => {
  const r = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}&periodCode=2026-05`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.summary.rowCount >= 2);
  assert.ok(r.json.data.summary.pendingCount >= 1);
  assert.ok(r.json.data.items.every((x) => x.statusFa && x.statusFa.length > 1));
  const dates = r.json.data.items.map((x) => x.workDate);
  assert.deepEqual(dates, [...dates].sort(), "ردیف‌ها باید بر اساس تاریخ مرتب باشند");
});

/* ═══════════ ۸. دوبار شمردن ═══════════ */

test("حضور گروهی با اکیپی که همان روز برگهٔ فردی دارد رد می‌شود", async () => {
  /* این تنها جایی است که دو دنیای مستقیم و پیمانکاری به هم می‌رسند؛
   * اگر اینجا باز بماند، نفر-ساعت دو بار وارد هزینه می‌شود. */
  const crew = await makeCrew("CR-DBL", { foremanPersonId: "PR-DF" });
  await addMember(crew, "PR-DBL1", { fromDate: "2026-05-01", roleInCrew: "foreman" });
  await req(`/api/hrm/crews/${crew}/activate`, { method: "POST", body: { projectId: PROJECT, onDate: "2026-05-01" } });

  const ts = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, crewId: crew, workDate: "2026-05-18",
      entries: [{ personId: "PR-DBL1", tradeCode: "CIV-FRM", activityId: "CA-1", cbsId: "CBS-1", hoursRaw: 8 }],
    },
  });
  assert.equal(ts.status, 201, ts.text.slice(0, 200));

  const att = await recordAtt(SUB_MAIN, "2026-05-18", { crewId: crew });
  assert.equal(att.status, 422);
  const e = att.json.error.issues.find((i) => i.code === "E-HRM-191");
  assert.ok(e, att.text.slice(0, 300));
  assert.ok(e.messageFa.includes("PR-DBL1"));
});

test("همان اکیپ در روزی بدون برگهٔ فردی مشکلی ندارد", async () => {
  const list = await req(`/api/hrm/crews?projectId=${PROJECT}`);
  const crew = list.json.data.items.find((x) => x.code === "CR-DBL").id;
  const r = await recordAtt(SUB_MAIN, "2026-05-19", { crewId: crew });
  assert.equal(r.status, 201, r.text.slice(0, 200));
});

/* ═══════════ ۹. تأیید حضور ═══════════ */

test("ثبت‌کننده نمی‌تواند تأیید کند (SOD-21)", async () => {
  const list = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}`);
  const row = list.json.data.items.find((x) => x.workDate === "2026-05-10");
  const r = await req(`/api/hrm/sub-attendance/${row.id}/verify`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.sub.verify");
});

test("تأییدکننده امضای خود را روی ردیف می‌گذارد", async () => {
  const list = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}`);
  for (const d of ["2026-05-10", "2026-05-12"]) {
    const row = list.json.data.items.find((x) => x.workDate === d);
    const r = await req(`/api/hrm/sub-attendance/${row.id}/verify`, {
      user: "u-hr", method: "POST", body: { projectId: PROJECT },
    });
    assert.equal(r.status, 200, r.text.slice(0, 200));
    assert.equal(r.json.data.status, "verified");
  }
  const after = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}`);
  const row = after.json.data.items.find((x) => x.workDate === "2026-05-10");
  assert.equal(row.verifiedBy, "u-hr");
  assert.ok(row.verifiedAt);
});

test("تأیید دوبارهٔ یک ردیف ۴۰۹ می‌گیرد", async () => {
  const list = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}`);
  const row = list.json.data.items.find((x) => x.workDate === "2026-05-10");
  const r = await req(`/api/hrm/sub-attendance/${row.id}/verify`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-197");
});

test("رد ردیف بدون دلیل کافی ۴۲۲ می‌گیرد", async () => {
  const list = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}`);
  const row = list.json.data.items.find((x) => x.workDate === "2026-05-19");
  const r = await req(`/api/hrm/sub-attendance/${row.id}/verify`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, reject: true, reasonFa: "بد" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-198");
});

test("رد ردیف با دلیل، آن را برگشتی می‌کند", async () => {
  const list = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}`);
  const row = list.json.data.items.find((x) => x.workDate === "2026-05-19");
  const r = await req(`/api/hrm/sub-attendance/${row.id}/verify`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, reject: true, reasonFa: "برگهٔ ورود دروازه ضمیمه نشده است" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.status, "rejected");
});

/* ═══════════ ۱۰. صورت‌کارکرد ═══════════ */

test("پیش‌نمایش فقط ردیف تأییدشده را می‌شمارد", async () => {
  const r = await req(`/api/hrm/sub-ipc?projectId=${PROJECT}&subContractId=${SUB_MAIN}&periodCode=2026-05`, { user: "u-contracts" });
  assert.equal(r.status, 200);
  const d = r.json.data.draft;
  assert.equal(d.totalHours, 360, "۸۰ + ۲۸۰ از دو ردیف تأییدشده");
  assert.equal(d.grossAmount, 72_000_000);
  assert.equal(d.retentionAmount, 7_200_000);
  assert.equal(d.isComplete, true);
  assert.ok(d.issues.some((i) => i.code === "W-HRM-511"), "ردیف تأییدنشده باید هشدار بدهد");
});

test("صورت‌کارکرد پشت مجوز دیدن قرارداد است، نه مجوز ثبت حضور", async () => {
  const denied = await req(`/api/hrm/sub-ipc?projectId=${PROJECT}&subContractId=${SUB_MAIN}&periodCode=2026-05`, { user: "u-site" });
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.permission, "hrm.sub.view");

  const allowed = await req(`/api/hrm/sub-ipc?projectId=${PROJECT}&subContractId=${SUB_MAIN}&periodCode=2026-05`, { user: "u-cost" });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.json.data.draft.totalHours, 360);
});

test("تهیهٔ صورت‌کارکرد ردیف‌ها را مهر می‌زند", async () => {
  const r = await req("/api/hrm/sub-ipc/prepare", {
    user: "u-contracts", method: "POST",
    body: { projectId: PROJECT, subContractId: SUB_MAIN, periodCode: "2026-05" },
  });
  assert.equal(r.status, 201, r.text.slice(0, 300));
  assert.equal(r.json.data.totalHours, 360);
  assert.equal(r.json.data.serialNo, 1);
  assert.equal(r.json.data.stampedRows, 2);
  assert.equal(r.json.data.isComplete, true);

  const att = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}&periodCode=2026-05`);
  const row = att.json.data.items.find((x) => x.workDate === "2026-05-10");
  assert.equal(row.status, "invoiced");
  assert.ok(row.subIpcId);
});

test("ردیف مهرخورده دیگر تغییر نمی‌کند", async () => {
  const att = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}&periodCode=2026-05`);
  const row = att.json.data.items.find((x) => x.status === "invoiced");
  const r = await req(`/api/hrm/sub-attendance/${row.id}/verify`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, reject: true, reasonFa: "پشیمان شدم و می‌خواهم برگردانم" },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-196");
});

test("صورت‌کارکرد دوم برای همان دوره ۴۰۹ می‌گیرد", async () => {
  const r = await req("/api/hrm/sub-ipc/prepare", {
    user: "u-contracts", method: "POST",
    body: { projectId: PROJECT, subContractId: SUB_MAIN, periodCode: "2026-05" },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-SUBIPC-DUP");
});

test("دورهٔ بدون ردیف تأییدشده صورت‌کارکرد نمی‌سازد", async () => {
  const r = await req("/api/hrm/sub-ipc/prepare", {
    user: "u-contracts", method: "POST",
    body: { projectId: PROJECT, subContractId: SUB_MAIN, periodCode: "2026-09" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-192"));
});

test("تهیه‌کننده نمی‌تواند تأیید کند (SOD-22)", async () => {
  const list = await req(`/api/hrm/sub-ipc?projectId=${PROJECT}&subContractId=${SUB_MAIN}`, { user: "u-contracts" });
  const ipc = list.json.data.issued[0];
  const r = await req(`/api/hrm/sub-ipc/${ipc.id}/approve`, {
    user: "u-contracts", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.subipc.approve");
});

test("مدیر پروژه صورت‌کارکرد را تأیید می‌کند", async () => {
  const list = await req(`/api/hrm/sub-ipc?projectId=${PROJECT}&subContractId=${SUB_MAIN}`, { user: "u-contracts" });
  const ipc = list.json.data.issued[0];
  const r = await req(`/api/hrm/sub-ipc/${ipc.id}/approve`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.json.data.status, "approved");

  const again = await req(`/api/hrm/sub-ipc/${ipc.id}/approve`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(again.status, 409);
  assert.equal(again.json.error.code, "E-HRM-193");
});

test("صورت‌کارکرد دارای ساعت بی‌نرخ تأیید نمی‌شود", async () => {
  /* نرخ رستهٔ آرماتوربندی عمداً در قرارداد نیامده. */
  const sub = await makeSub("SC-NORATE", {
    scopeTrades: ["CIV-RBR"], agreedRates: { "CIV-FRM": 200000 },
  });
  const att = await recordAtt(sub, "2026-06-05", { tradeCode: "CIV-RBR", headcount: 5, hoursPerPerson: 8 });
  assert.equal(att.status, 201);
  assert.ok(att.json.data.warnings.some((w) => w.code === "W-HRM-510"));

  const list = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${sub}`);
  await req(`/api/hrm/sub-attendance/${list.json.data.items[0].id}/verify`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT },
  });

  const prep = await req("/api/hrm/sub-ipc/prepare", {
    user: "u-contracts", method: "POST",
    body: { projectId: PROJECT, subContractId: sub, periodCode: "2026-06" },
  });
  assert.equal(prep.status, 201, prep.text.slice(0, 300));
  assert.equal(prep.json.data.unpricedHours, 40);
  assert.equal(prep.json.data.isComplete, false);
  assert.equal(prep.json.data.grossAmount, 0);

  const ok = await req(`/api/hrm/sub-ipc/${prep.json.data.id}/approve`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(ok.status, 422);
  assert.equal(ok.json.error.code, "E-HRM-195");
  assert.ok(ok.json.error.detailsFa.some((d) => d.includes("نرخ")));
});

/* ═══════════ ۱۱. نشت بین پروژه‌ها ═══════════ */

test("اکیپ پروژهٔ دیگر در این پروژه پیدا نمی‌شود", async () => {
  const other = await makeCrew("CR-OTHER", {}, OTHER);
  const r = await req(`/api/hrm/crews/${other}?projectId=${PROJECT}`);
  assert.equal(r.status, 404, "دسترسی بین‌پروژه‌ای باید ۴۰۴ بدهد نه ۲۰۰");

  const list = await req(`/api/hrm/crews?projectId=${PROJECT}`);
  assert.equal(list.json.data.items.some((x) => x.code === "CR-OTHER"), false);
});

test("قرارداد پروژهٔ دیگر حضور نمی‌پذیرد", async () => {
  const other = await makeSub("SC-OTHER", {}, OTHER);
  const r = await recordAtt(other, "2026-05-25");
  assert.equal(r.status, 404);
});

test("صورت‌کارکرد پروژهٔ دیگر تأیید نمی‌شود", async () => {
  const list = await req(`/api/hrm/sub-ipc?projectId=${PROJECT}&subContractId=${SUB_MAIN}`, { user: "u-contracts" });
  const ipc = list.json.data.issued[0];
  const r = await req(`/api/hrm/sub-ipc/${ipc.id}/approve`, {
    user: "u-pm", method: "POST", body: { projectId: OTHER },
  });
  assert.equal(r.status, 404);
});

/* ═══════════ ۱۲. قرارداد پاسخ ═══════════ */

test("پارامتر اجباری نبود ⇒ ۴۰۰ با کد گویا", async () => {
  const a = await req("/api/hrm/crews");
  assert.equal(a.status, 400);
  assert.equal(a.json.error.code, "E-HRM-NO-PROJECT");
  const b = await req(`/api/hrm/sub-attendance?projectId=${PROJECT}`);
  assert.equal(b.status, 400);
  assert.equal(b.json.error.code, "E-HRM-NO-SUB");
});

test("همهٔ پاسخ‌های موفق قالب یکسان دارند", async () => {
  for (const [p, u] of [
    [`/api/hrm/crews?projectId=${PROJECT}`, "u-hr"],
    [`/api/hrm/crew-meta?projectId=${PROJECT}`, "u-hr"],
    [`/api/hrm/subcontracts?projectId=${PROJECT}`, "u-contracts"],
    [`/api/hrm/sub-attendance?projectId=${PROJECT}&subContractId=${SUB_MAIN}`, "u-hr"],
    [`/api/hrm/sub-ipc?projectId=${PROJECT}&subContractId=${SUB_MAIN}`, "u-contracts"],
  ]) {
    const r = await req(p, { user: u });
    assert.equal(r.status, 200, p);
    assert.equal(r.json.ok, true, p);
    assert.match(r.json.meta.traceId, /^req-/, p);
    assert.equal(r.json.meta.engine, "hrm-v1", p);
  }
});

test("خطاها هم شناسهٔ ردیابی دارند", async () => {
  const r = await req("/api/hrm/crews");
  assert.equal(r.json.ok, false);
  assert.match(r.json.error.traceId, /^req-/);
});
