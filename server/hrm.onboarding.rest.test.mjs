/**
 * MOD-10 / HRM D7 — آزمون REST پذیرش، احکام و انطباق.
 *
 * تمرکز روی دروازه: نفر بدون پنج گیت سبز نباید فعال شود، مدرک منقضی
 * نباید نامرئی بماند، و نفری که ساعت تأییدنشده دارد نباید تخلیه شود.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4735;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
const OTHER = "p2";
const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = "2030-01-01";
const PAST = "2020-01-01";
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

async function makePerson(no, extra = {}, projectId = PROJECT) {
  const r = await req("/api/hrm/people", {
    method: "POST",
    body: {
      projectId, personnelNo: no, fullNameFa: `نیرو ${no}`,
      primaryTradeCode: "CIV-FRM", nationalId: "0012345678", mobile: "09120000000", ...extra,
    },
  });
  assert.equal(r.status, 201, `ساخت نفر ${no}: ${r.text.slice(0, 250)}`);
  return r.json.data.id;
}

async function addDoc(personId, docType, extra = {}, user = "u-site") {
  return req(`/api/hrm/people/${personId}/docs`, {
    user, method: "POST",
    body: { projectId: PROJECT, docType, docNo: `${docType}-1`, expiresAt: FUTURE, ...extra },
  });
}

/** نفری با هر دو مدرک لازم؛ گیت ایمنی جدا بررسی می‌شود. */
async function personWithDocs(no, extra = {}) {
  const id = await makePerson(no, extra);
  await addDoc(id, "contract");
  await addDoc(id, "medical");
  return id;
}

async function transition(personId, to, extra = {}, user = "u-hr") {
  return req(`/api/hrm/people/${personId}/transition`, {
    user, method: "POST", body: { projectId: PROJECT, to, ...extra },
  });
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "hrm-onb-"));
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
});

after(async () => {
  child?.kill();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/* ═══════════ ۱. دسترسی ═══════════ */

test("بدون شناسهٔ کاربر، تابلوی انطباق ۴۰۱ می‌دهد", async () => {
  const r = await req(`/api/hrm/people?projectId=${PROJECT}`, { user: null });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-HRM-AUTH-REQUIRED");
});

test("۴۰۱ و ۴۰۳ دو کد متفاوت‌اند", async () => {
  const a = await req(`/api/hrm/people?projectId=${PROJECT}`, { user: null });
  const b = await req(`/api/hrm/people?projectId=${PROJECT}`, { user: "u-sub" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 403);
  assert.notEqual(a.json.error.code, b.json.error.code);
  assert.equal(b.json.error.permission, "hrm.person.view");
});

test("کارگاه پرونده را می‌بیند ولی نمی‌سازد", async () => {
  const see = await req(`/api/hrm/people?projectId=${PROJECT}`, { user: "u-site" });
  assert.equal(see.status, 200);
  const make = await req("/api/hrm/people", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, personnelNo: "X-1", fullNameFa: "تست کارگاه", primaryTradeCode: "CIV-FRM" },
  });
  assert.equal(make.status, 403);
  assert.equal(make.json.error.permission, "hrm.person.manage");
});

test("کاتالوگ ثابت‌ها با ترجمه و گذارهای مجاز برمی‌گردد", async () => {
  const r = await req(`/api/hrm/onboarding-meta?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.personStatuses.length, 6);
  assert.equal(r.json.data.docTypes.length, 8);
  assert.equal(r.json.data.gates.length, 5);
  assert.equal(r.json.data.demobItems.length, 5);
  assert.equal(r.json.data.expiryWarnDays, 30);
  assert.ok(r.json.data.personStatuses.every((x) => x.fa && Array.isArray(x.next)));
  assert.equal(r.json.data.demobItems.filter((x) => x.optional).length, 1, "فقط مصاحبهٔ خروج اختیاری است");
});

/* ═══════════ ۲. ساخت پرونده ═══════════ */

test("نفر تازه داوطلب است، نه فعال", async () => {
  const id = await makePerson("2001");
  const r = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.status, "candidate");
  assert.equal(r.json.data.statusFa, "داوطلب");
  assert.deepEqual(r.json.data.nextStates, ["onboarding", "terminated"]);
});

test("شمارهٔ پرسنلی تکراری ۴۰۹ می‌گیرد", async () => {
  const r = await req("/api/hrm/people", {
    method: "POST",
    body: { projectId: PROJECT, personnelNo: "2001", fullNameFa: "تکراری", primaryTradeCode: "CIV-FRM" },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-PERSON-DUP");
});

test("پروندهٔ ناقص ۴۲۲ با فهرست ایرادها می‌گیرد", async () => {
  const r = await req("/api/hrm/people", { method: "POST", body: { projectId: PROJECT, personnelNo: "", fullNameFa: "ک" } });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-VALIDATION");
  assert.ok(r.json.error.issues.length >= 3);
});

test("نیروی پیمانکاری بدون قرارداد کارفرما رد می‌شود", async () => {
  /* بدون کارفرما، هزینهٔ او به هیچ صورت‌کارکردی وصل نمی‌شود و در
   * دستمزد مستقیم گم می‌شود. */
  const r = await req("/api/hrm/people", {
    method: "POST",
    body: { projectId: PROJECT, personnelNo: "2099", fullNameFa: "نیروی پیمانکار", primaryTradeCode: "CIV-FRM", employmentType: "subcontractor" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-244"));
});

test("نوع استخدام نامعتبر رد می‌شود", async () => {
  const r = await req("/api/hrm/people", {
    method: "POST",
    body: { projectId: PROJECT, personnelNo: "2098", fullNameFa: "نوع نامعتبر", primaryTradeCode: "CIV-FRM", employmentType: "برده" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-243"));
});

test("پروندهٔ ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await req(`/api/hrm/people/NOPE?projectId=${PROJECT}`);
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HRM-PERSON-NOT-FOUND");
});

/* ═══════════ ۳. ماسک اطلاعات فردی ═══════════ */

test("کد ملی برای دارندهٔ مجوز دیده و برای کارگاه ماسک می‌شود", async () => {
  /* سرپرست باید بداند مدرک نفرش معتبر است، نه اینکه کد ملی او را بداند. */
  const id = await makePerson("2002");
  const hr = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`, { user: "u-hr" });
  assert.equal(hr.json.data.nationalId, "0012345678");
  assert.equal(hr.json.data.piiMasked, false);

  const site = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`, { user: "u-site" });
  assert.equal(site.status, 200, "کارگاه باید پرونده را ببیند");
  assert.equal(site.json.data.piiMasked, true);
  assert.equal(site.json.data.nationalId, "••••••••••");
  assert.equal(site.json.data.mobile, "••••••••••");
  assert.equal(site.json.data.fullNameFa, "نیرو 2002", "نام ماسک نمی‌شود");
});

/* ═══════════ ۴. مدرک ═══════════ */

test("مدرک تازه تأییدنشده ثبت می‌شود", async () => {
  const id = await makePerson("2003");
  const r = await addDoc(id, "contract");
  assert.equal(r.status, 201, r.text.slice(0, 200));
  assert.equal(r.json.data.state, "valid");

  const view = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`);
  assert.equal(view.json.data.docs[0].verifiedAt, null, "بارگذاری تأیید نیست");
});

test("مدرک بدون تاریخ انقضا دائمی است", async () => {
  const id = await makePerson("2004");
  const r = await addDoc(id, "id_card", { expiresAt: null });
  assert.equal(r.status, 201);
  assert.equal(r.json.data.state, "undated");
  assert.equal(r.json.data.daysLeft, null);
});

test("تاریخ انقضای پیش از صدور رد می‌شود", async () => {
  const id = await makePerson("2005");
  const r = await addDoc(id, "medical", { issuedAt: "2026-06-01", expiresAt: "2026-01-01" });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-247"));
});

test("نوع مدرک نامعتبر رد می‌شود", async () => {
  const id = await makePerson("2006");
  const r = await addDoc(id, "قباله");
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-245"));
});

test("مدرک تکراری هم‌نوع و هم‌شماره ۴۰۹ می‌گیرد", async () => {
  const id = await makePerson("2007");
  await addDoc(id, "contract");
  const r = await addDoc(id, "contract");
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-DOC-DUP");
});

test("بارگذارنده نمی‌تواند اصالت را تأیید کند (SOD-24)", async () => {
  const id = await makePerson("2008");
  const doc = await addDoc(id, "contract", {}, "u-site");
  const r = await req(`/api/hrm/docs/${doc.json.data.id}/verify`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.doc.verify");
});

test("منابع انسانی اصالت را تأیید می‌کند و دوباره نمی‌تواند", async () => {
  const id = await makePerson("2009");
  const doc = await addDoc(id, "contract");
  const first = await req(`/api/hrm/docs/${doc.json.data.id}/verify`, { method: "POST", body: { projectId: PROJECT } });
  assert.equal(first.status, 200);

  const view = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`);
  assert.equal(view.json.data.docs[0].verifiedBy, "u-hr");

  const second = await req(`/api/hrm/docs/${doc.json.data.id}/verify`, { method: "POST", body: { projectId: PROJECT } });
  assert.equal(second.status, 409);
  assert.equal(second.json.error.code, "E-HRM-248");
});

test("رد مدرک بدون دلیل کافی ۴۲۲ می‌گیرد", async () => {
  const id = await makePerson("2010");
  const doc = await addDoc(id, "contract");
  const r = await req(`/api/hrm/docs/${doc.json.data.id}/verify`, {
    method: "POST", body: { projectId: PROJECT, reject: true, reasonFa: "بد" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-249");
});

test("مدرک منقضی در پرونده قرمز دیده می‌شود", async () => {
  const id = await makePerson("2011");
  await addDoc(id, "medical", { expiresAt: PAST, isBlocking: true });
  const r = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`);
  assert.equal(r.json.data.docs[0].state, "expired");
  assert.equal(r.json.data.docCompliance.blockingExpired, 1);
  assert.ok(r.json.data.docCompliance.issues.some((i) => i.code === "E-HRM-201"));
});

/* ═══════════ ۵. پنج گیت ═══════════ */

test("نفر بدون مدرک، سه گیت مسدودکننده و یک هشدار دارد", async () => {
  const id = await makePerson("2020");
  const r = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`);
  const g = r.json.data.gates;
  assert.equal(g.gates.length, 5);
  assert.equal(g.ok, false);
  assert.equal(g.blockersFa.length, 3, "قرارداد، طب کار و ایمنی");
  assert.equal(g.warningsFa.length, 1, "کارت تردد فقط هشدار است");
});

test("کارت تردد هشدار است نه مانع", async () => {
  const id = await personWithDocs("2021");
  const r = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`);
  const pass = r.json.data.gates.gates.find((x) => x.gate === "gate_pass");
  assert.equal(pass.ok, false);
  assert.equal(pass.isBlocking, false);
  assert.equal(pass.code, "W-HRM-330");
});

test("گیت ایمنی از دفتر HSE خوانده می‌شود و بی‌سابقه قرمز است", async () => {
  /* نفری که در دفتر ایمنی سابقهٔ آموزش ندارد نباید سبز شود. */
  const id = await personWithDocs("2022");
  const r = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`);
  const hse = r.json.data.gates.gates.find((x) => x.gate === "hse_training");
  assert.equal(hse.ok, false);
  assert.equal(hse.code, "E-HRM-202");
  assert.equal(r.json.data.hse.cleared, false, "نتیجهٔ زندهٔ دفتر ایمنی");
});

/* ═══════════ ۶. گذار وضعیت ═══════════ */

test("گذار به پذیرش مجوز مدیریت پرونده می‌خواهد", async () => {
  const id = await makePerson("2030");
  const denied = await transition(id, "onboarding", {}, "u-site");
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.permission, "hrm.person.manage");

  const ok = await transition(id, "onboarding");
  assert.equal(ok.status, 200, ok.text.slice(0, 200));
  assert.equal(ok.json.data.to, "onboarding");
});

test("فعال‌سازی مجوز جدا دارد و کارگاه آن را ندارد", async () => {
  const id = await personWithDocs("2031");
  await transition(id, "onboarding");
  const r = await transition(id, "active", {}, "u-site");
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.person.activate");
});

test("پرش از داوطلب به فعال مجاز نیست", async () => {
  const id = await personWithDocs("2032");
  const r = await transition(id, "active");
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-217");
});

test("فعال‌سازی با گیت قرمز، همهٔ موانع را یکجا برمی‌گرداند", async () => {
  const id = await makePerson("2033");
  await transition(id, "onboarding");
  const r = await transition(id, "active");
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-219");
  assert.equal(r.json.error.detailsFa.length, 3, "کاربر باید هر سه مانع را یکجا ببیند");
});

test("گذار تکراری ۴۰۹ می‌گیرد", async () => {
  const id = await makePerson("2034");
  await transition(id, "onboarding");
  const r = await transition(id, "onboarding");
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-216");
});

test("قطع همکاری بدون دلیل کافی رد می‌شود", async () => {
  const id = await makePerson("2035");
  const r = await transition(id, "terminated", { reasonFa: "رفت" });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-220");

  const ok = await transition(id, "terminated", { reasonFa: "انصراف کتبی نیرو پیش از شروع کار" });
  assert.equal(ok.status, 200);
});

test("قطع همکاری برگشت ندارد", async () => {
  const id = await makePerson("2036");
  await transition(id, "terminated", { reasonFa: "پایان همکاری با توافق طرفین" });
  const r = await transition(id, "onboarding");
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-217");
});

/* ═══════════ ۷. مهارت ═══════════ */

test("ارزیابی مهارت ثبت و بازارزیابی به‌روزرسانی می‌شود", async () => {
  /* دو ردیف فعال برای یک مهارت، ماتریس را دوگانه می‌کرد. */
  const id = await makePerson("2040");
  const first = await req(`/api/hrm/people/${id}/skills`, {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, skillCode: "WLD-6G", skillNameFa: "جوشکاری ۶G", level: 3 },
  });
  assert.equal(first.status, 201);
  assert.equal(first.json.data.updated, false);

  const second = await req(`/api/hrm/people/${id}/skills`, {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, skillCode: "WLD-6G", level: 5 },
  });
  assert.equal(second.status, 200);
  assert.equal(second.json.data.updated, true);
  assert.equal(second.json.data.matrix.count, 1, "رکورد دوم ساخته نشده");
  assert.equal(second.json.data.matrix.averageLevel, 5);
});

test("سطح مهارت خارج از بازه رد می‌شود", async () => {
  const id = await makePerson("2041");
  for (const level of [-1, 6, 2.5]) {
    const r = await req(`/api/hrm/people/${id}/skills`, {
      user: "u-site", method: "POST", body: { projectId: PROJECT, skillCode: "RIG", level },
    });
    assert.equal(r.status, 422, `سطح ${level}`);
    assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-251"));
  }
});

test("صلاحیت مسدودکنندهٔ منقضی گیت رسته را می‌بندد", async () => {
  const id = await personWithDocs("2042");
  await req(`/api/hrm/people/${id}/skills`, {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, skillCode: "WLD-6G", skillNameFa: "جوشکاری", level: 4, expiresAt: PAST, isBlocking: true },
  });
  const r = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`);
  assert.equal(r.json.data.gates.gates.find((x) => x.gate === "trade_docs").ok, false);
  assert.equal(r.json.data.skills.expiredBlocking, 1);
});

/* ═══════════ ۸. تخلیه ═══════════ */

test("چک‌لیست تخلیه پیشرفت را برمی‌گرداند و بند اختیاری مانع نیست", async () => {
  const id = await makePerson("2050");
  const empty = await req(`/api/hrm/people/${id}/demob-check`, {
    method: "POST", body: { projectId: PROJECT, itemCode: "tools_returned" },
  });
  assert.equal(empty.status, 200);
  assert.equal(empty.json.data.progress.mandatoryDone, 1);
  assert.equal(empty.json.data.progress.mandatoryTotal, 4);
  assert.equal(empty.json.data.progress.isComplete, false);

  for (const item of ["gate_pass_returned", "timesheets_closed", "final_settlement"]) {
    await req(`/api/hrm/people/${id}/demob-check`, { method: "POST", body: { projectId: PROJECT, itemCode: item } });
  }
  const done = await req(`/api/hrm/people/${id}/demob-check`, {
    method: "POST", body: { projectId: PROJECT, itemCode: "tools_returned" },
  });
  assert.equal(done.json.data.progress.isComplete, true, "بدون مصاحبهٔ خروج هم کامل است");
});

test("بند چک‌لیست نامعتبر رد می‌شود", async () => {
  const id = await makePerson("2051");
  const r = await req(`/api/hrm/people/${id}/demob-check`, {
    method: "POST", body: { projectId: PROJECT, itemCode: "چای_خوردن" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-252");
});

test("بند انجام‌شده قابل برگرداندن است", async () => {
  const id = await makePerson("2052");
  await req(`/api/hrm/people/${id}/demob-check`, { method: "POST", body: { projectId: PROJECT, itemCode: "tools_returned" } });
  const undo = await req(`/api/hrm/people/${id}/demob-check`, {
    method: "POST", body: { projectId: PROJECT, itemCode: "tools_returned", isDone: false },
  });
  assert.equal(undo.json.data.progress.mandatoryDone, 0);
});

test("نفر با چک‌لیست ناقص تخلیه نمی‌شود", async () => {
  const id = await makePerson("2053");
  await transition(id, "onboarding");
  const r = await transition(id, "demobilized");
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-217", "از پذیرش مستقیم تخلیه نمی‌شود");
});

test("نفرِ دارای برگهٔ کارکرد تأییدنشده تخلیه نمی‌شود", async () => {
  /* ساعت یتیم: برگهٔ نفری که رفته هرگز تأیید نمی‌شود. */
  const id = await makePerson("2054");
  const p = await req(`/api/hrm/people/${id}?projectId=${PROJECT}`);
  const personNo = p.json.data.personnelNo;

  assert.ok(personNo);

  /* ثبت ساعت پیش از فعال شدن مسدود است (TD-HRM-05)، پس نفر را اول
   * به پذیرش می‌بریم و بعد برگه می‌زنیم. */
  await transition(id, "onboarding");

  const ts = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, crewId: "CR-DEMOB", workDate: "2026-07-20",
      entries: [{ personId: id, tradeCode: "CIV-FRM", activityId: "DA-1", cbsId: "DCBS-1", hoursRaw: 8 }],
    },
  });
  /* هنوز `active` نیست، پس همچنان مسدود — و همین ثابت می‌کند گیت
   * روی هر وضعیت غیرفعالی کار می‌کند نه فقط `candidate`. */
  assert.equal(ts.status, 422, ts.text.slice(0, 200));
  assert.ok(ts.json.error.issues.some((i) => i.code === "E-HRM-261"));
  const r = await transition(id, "demobilized");
  /* از پذیرش مستقیم تخلیه مجاز نیست؛ گذار درست از فعال است. */
  assert.equal(r.status, 422);
});

/* ═══════════ ۹. پایش انقضا ═══════════ */

test("پایش فقط مدارک داخل افق را می‌دهد و فوری‌ترین اول است", async () => {
  const soon = await makePerson("2060");
  await addDoc(soon, "medical", { expiresAt: PAST, isBlocking: true });
  const far = await makePerson("2061");
  await addDoc(far, "contract", { expiresAt: FUTURE });

  const r = await req(`/api/hrm/expiry-watch?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  const mine = r.json.data.items.filter((x) => [soon, far].includes(x.personId));
  assert.equal(mine.length, 1, "مدرک دور نباید بیاید");
  assert.equal(mine[0].personId, soon);
  assert.ok(mine[0].daysLeft < 0);
  assert.equal(mine[0].severity, "error");
  assert.ok(mine[0].personNameFa.includes("2060"), "نام نفر باید ضمیمه شود");
});

test("افق قابل تنظیم است", async () => {
  const narrow = await req(`/api/hrm/expiry-watch?projectId=${PROJECT}&horizonDays=0`);
  const wide = await req(`/api/hrm/expiry-watch?projectId=${PROJECT}&horizonDays=4000`);
  assert.ok(wide.json.data.items.length >= narrow.json.data.items.length);
  assert.equal(wide.json.data.horizonDays, 4000);
});

test("ترتیب پایش صعودی بر اساس روز باقی‌مانده است", async () => {
  const r = await req(`/api/hrm/expiry-watch?projectId=${PROJECT}&horizonDays=4000`);
  const days = r.json.data.items.map((x) => x.daysLeft);
  assert.deepEqual(days, [...days].sort((a, b) => a - b));
});

/* ═══════════ ۱۰. تابلوی انطباق ═══════════ */

test("تابلو نفرِ ناسازگار را می‌شمارد و اول فهرست می‌گذارد", async () => {
  const r = await req(`/api/hrm/people?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.headcount > 0);
  assert.ok(r.json.data.rows.every((x) => x.statusFa && ["green", "amber", "red"].includes(x.flag)));
  const reds = r.json.data.rows.filter((x) => x.flag === "red");
  if (reds.length > 0) assert.ok(reds[0].blockersFa.length > 0, "قرمز باید دلیل داشته باشد");
});

test("فیلتر وضعیت کار می‌کند", async () => {
  const r = await req(`/api/hrm/people?projectId=${PROJECT}&status=candidate`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.rows.every((x) => x.status === "candidate"));
});

/* ═══════════ ۱۱. درخواست تجهیز ═══════════ */

test("درخواست تجهیز ثبت می‌شود و پیش‌نویس است", async () => {
  const r = await req("/api/hrm/mob-requests", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, requestNo: "MR-1", requestType: "mobilize",
      tradeCode: "CIV-FRM", qty: 12, needByDate: "2030-03-01",
      justificationFa: "شروع عملیات قالب‌بندی منطقهٔ سه",
    },
  });
  assert.equal(r.status, 201, r.text.slice(0, 250));
  assert.equal(r.json.data.status, "draft");
});

test("درخواست بدون توجیه کافی رد می‌شود", async () => {
  const r = await req("/api/hrm/mob-requests", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, tradeCode: "CIV-FRM", qty: 5, needByDate: "2030-03-01", justificationFa: "لازمه" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-234"));
});

test("تاریخ نیاز گذشته هشدار می‌دهد ولی ثبت می‌شود", async () => {
  const r = await req("/api/hrm/mob-requests", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, requestNo: "MR-LATE", tradeCode: "CIV-RBR", qty: 3,
      needByDate: PAST, justificationFa: "کسری نیروی آرماتوربندی از هفتهٔ گذشته",
    },
  });
  assert.equal(r.status, 201);
  assert.ok(r.json.data.warnings.some((w) => w.code === "W-HRM-522"));
});

test("درخواست عقب‌افتاده در فهرست علامت می‌خورد", async () => {
  const r = await req(`/api/hrm/mob-requests?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  const late = r.json.data.items.find((x) => x.requestNo === "MR-LATE");
  assert.equal(late.isOverdue, true);
  assert.ok(r.json.data.summary.overdueCount >= 1);
  assert.ok(r.json.data.summary.openQty >= 15);
});

test("درخواست‌دهنده نمی‌تواند تأیید کند (SOD-25)", async () => {
  const list = await req(`/api/hrm/mob-requests?projectId=${PROJECT}`);
  const mr = list.json.data.items.find((x) => x.requestNo === "MR-1");
  await req(`/api/hrm/mob-requests/${mr.id}/transition`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, to: "submitted" },
  });
  const r = await req(`/api/hrm/mob-requests/${mr.id}/transition`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, to: "approved" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.mob.approve");
});

test("مدیر پروژه تأیید می‌کند و درخواست ناتمام بسته نمی‌شود", async () => {
  const list = await req(`/api/hrm/mob-requests?projectId=${PROJECT}`);
  const mr = list.json.data.items.find((x) => x.requestNo === "MR-1");

  const ok = await req(`/api/hrm/mob-requests/${mr.id}/transition`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, to: "approved" },
  });
  assert.equal(ok.status, 200, ok.text.slice(0, 250));

  await req(`/api/hrm/mob-requests/${mr.id}/transition`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, to: "in_progress" },
  });
  const partial = await req(`/api/hrm/mob-requests/${mr.id}/transition`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, to: "fulfilled", fulfilledQty: 7 },
  });
  assert.equal(partial.status, 422);
  assert.equal(partial.json.error.code, "E-HRM-238");

  const full = await req(`/api/hrm/mob-requests/${mr.id}/transition`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, to: "fulfilled", fulfilledQty: 12 },
  });
  assert.equal(full.status, 200);
});

test("پرش وضعیت درخواست مجاز نیست", async () => {
  const make = await req("/api/hrm/mob-requests", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, requestNo: "MR-JUMP", tradeCode: "ELE-CBL", qty: 2,
      needByDate: "2030-05-01", justificationFa: "کابل‌کشی منطقهٔ چهار",
    },
  });
  const r = await req(`/api/hrm/mob-requests/${make.json.data.id}/transition`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, to: "approved" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-236");
});

test("لغو بدون دلیل رد می‌شود", async () => {
  const make = await req("/api/hrm/mob-requests", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, requestNo: "MR-CANCEL", tradeCode: "ELE-CBL", qty: 1,
      needByDate: "2030-05-01", justificationFa: "درخواست آزمایشی برای لغو شدن",
    },
  });
  const r = await req(`/api/hrm/mob-requests/${make.json.data.id}/transition`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, to: "cancelled", reasonFa: "نه" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-237");
});

test("درخواست تکراری ۴۰۹ می‌گیرد", async () => {
  const r = await req("/api/hrm/mob-requests", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, requestNo: "MR-1", tradeCode: "CIV-FRM", qty: 1,
      needByDate: "2030-05-01", justificationFa: "تکراری برای آزمون یکتایی",
    },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-MOB-DUP");
});

/* ═══════════ ۱۲. نشت بین پروژه‌ها ═══════════ */

test("پروندهٔ پروژهٔ دیگر در این پروژه پیدا نمی‌شود", async () => {
  const other = await makePerson("9001", {}, OTHER);
  const r = await req(`/api/hrm/people/${other}?projectId=${PROJECT}`);
  assert.equal(r.status, 404, "دسترسی بین‌پروژه‌ای باید ۴۰۴ بدهد");

  const list = await req(`/api/hrm/people?projectId=${PROJECT}`);
  assert.equal(list.json.data.rows.some((x) => x.personnelNo === "9001"), false);
});

test("مدرک پروژهٔ دیگر تأیید نمی‌شود", async () => {
  const other = await makePerson("9002", {}, OTHER);
  /* بارگذاری با کارگاه است نه منابع انسانی — SOD-24. */
  const doc = await req(`/api/hrm/people/${other}/docs`, {
    user: "u-site", method: "POST", body: { projectId: OTHER, docType: "contract", docNo: "X", expiresAt: FUTURE },
  });
  assert.equal(doc.status, 201, doc.text.slice(0, 200));
  const r = await req(`/api/hrm/docs/${doc.json.data.id}/verify`, {
    method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 404);
});

test("درخواست تجهیز پروژهٔ دیگر تأیید نمی‌شود", async () => {
  const make = await req("/api/hrm/mob-requests", {
    user: "u-site", method: "POST",
    body: {
      projectId: OTHER, requestNo: "MR-OTHER", tradeCode: "CIV-FRM", qty: 1,
      needByDate: "2030-05-01", justificationFa: "درخواست پروژهٔ دیگر برای آزمون نشت",
    },
  });
  /* کاربر مجوز را دارد؛ چیزی که نباید داشته باشد دسترسی به ردیف
   * پروژهٔ دیگر است. اگر مجوز را هم نداشت، ۴۰۳ زودتر می‌آمد و آزمون
   * چیزی دربارهٔ مرز پروژه ثابت نمی‌کرد. */
  const r = await req(`/api/hrm/mob-requests/${make.json.data.id}/transition`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, to: "submitted" },
  });
  assert.equal(r.status, 404);
});

test("مجوز پیش از مرز پروژه بررسی می‌شود", async () => {
  /* ترتیب درست: کاربر بی‌مجوز نباید از تفاوت ۴۰۳ و ۴۰۴ بفهمد ردیفی
   * در پروژهٔ دیگر وجود دارد یا نه. */
  const r = await req("/api/hrm/mob-requests/NOPE/transition", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, to: "submitted" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.mob.request");
});

/* ═══════════ ۱۳. قرارداد پاسخ ═══════════ */

test("پارامتر پروژه نبود ⇒ ۴۰۰ با کد گویا", async () => {
  const r = await req("/api/hrm/people");
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-NO-PROJECT");
});

test("همهٔ پاسخ‌های موفق قالب یکسان دارند", async () => {
  for (const p of [
    `/api/hrm/people?projectId=${PROJECT}`,
    `/api/hrm/onboarding-meta?projectId=${PROJECT}`,
    `/api/hrm/expiry-watch?projectId=${PROJECT}`,
    `/api/hrm/mob-requests?projectId=${PROJECT}`,
  ]) {
    const r = await req(p);
    assert.equal(r.status, 200, p);
    assert.equal(r.json.ok, true, p);
    assert.match(r.json.meta.traceId, /^req-/, p);
    assert.equal(r.json.meta.engine, "hrm-v1", p);
  }
});

test("خطاها هم شناسهٔ ردیابی دارند", async () => {
  const r = await req("/api/hrm/people");
  assert.equal(r.json.ok, false);
  assert.match(r.json.error.traceId, /^req-/);
});

/* ═══════════ ۱۴. اجرای گیت روی همسایه (لوپ ۱۰) ═══════════ */

test("نفر غیرفعال عضو اکیپ نمی‌شود", async () => {
  /* بدون این بند، پنج گیت تجهیز تشریفاتی بود: نفرِ داوطلب با مدرک
   * منقضی عضو اکیپ می‌شد و فردا برگهٔ کارکردش امضا. */
  const crew = await req("/api/hrm/crews", {
    method: "POST",
    body: { projectId: PROJECT, code: "CR-GATE", nameFa: "اکیپ آزمون گیت", primaryTradeCode: "CIV-FRM" },
  });
  assert.equal(crew.status, 201, crew.text.slice(0, 200));

  const id = await makePerson("2070");
  const r = await req(`/api/hrm/crews/${crew.json.data.id}/members`, {
    method: "POST",
    body: { projectId: PROJECT, personId: id, fromDate: "2026-07-01" },
  });
  assert.equal(r.status, 422);
  const e = r.json.error.issues.find((i) => i.code === "E-HRM-260");
  assert.ok(e, r.text.slice(0, 300));
  assert.ok(e.messageFa.includes("داوطلب"));
  assert.equal(e.personId, id);
});

test("نفر فعال بدون مانع عضو اکیپ می‌شود", async () => {
  const crew = await req("/api/hrm/crews", {
    method: "POST",
    body: { projectId: PROJECT, code: "CR-GATE-OK", nameFa: "اکیپ نیروی فعال", primaryTradeCode: "CIV-FRM" },
  });

  const id = await personWithDocs("2071");
  await transition(id, "onboarding");
  /* گیت ایمنی بسته است، پس فعال‌سازی رد می‌شود و همان هم درست است. */
  const act = await transition(id, "active");
  assert.equal(act.status, 422, "بدون آموزش ایمنی نباید فعال شود");

  const r = await req(`/api/hrm/crews/${crew.json.data.id}/members`, {
    method: "POST",
    body: { projectId: PROJECT, personId: id, fromDate: "2026-07-01" },
  });
  assert.equal(r.status, 422, "نفرِ در حال پذیرش هم نباید عضو شود");
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-260"));
});

test("نفر بدون پروندهٔ پرسنلی فقط هشدار می‌گیرد نه خطا", async () => {
  /* پروژه‌های موجود اکیپ‌هایی دارند که پیش از راه‌اندازی D7 ساخته
   * شده‌اند؛ مسدود کردنشان یعنی سامانه از کار می‌افتد. */
  const crew = await req("/api/hrm/crews", {
    method: "POST",
    body: { projectId: PROJECT, code: "CR-LEGACY", nameFa: "اکیپ قدیمی", primaryTradeCode: "CIV-FRM" },
  });
  const r = await req(`/api/hrm/crews/${crew.json.data.id}/members`, {
    method: "POST",
    body: { projectId: PROJECT, personId: "LEGACY-PERSON-1", fromDate: "2026-07-01" },
  });
  assert.equal(r.status, 201, r.text.slice(0, 250));
  assert.ok(r.json.data.warnings.some((w) => w.code === "W-HRM-523"));
});
