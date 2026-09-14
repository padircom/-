/**
 * MOD-10 / HRM D4 — آزمون REST تایم‌شیت.
 *
 * تمرکز روی مرزها: زنجیرهٔ تأیید سه‌گانه، قفل دوره، حل تعارض آفلاین و
 * نشت بین پروژه‌ها.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execPath } from "node:process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4731;
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = "p1";
let child, dir;

async function req(path, { user = "u-site", method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (user) headers["x-user-id"] = user;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* غیر JSON */ }
  return { status: res.status, json, text };
}

const ENTRY = (over = {}) => ({
  personId: "PER-1", tradeCode: "CIV-RBR",
  activityId: "A-100", cbsId: "CBS-1", hoursRaw: 8,
  ...over,
});

/** برگهٔ تازه با شناسهٔ یکتا. */
async function makeSheet(crewId, workDate, entries = [ENTRY()], over = {}) {
  return req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, crewId, workDate, entries, ...over },
  });
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "hrm-ts-"));
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

test("کاتالوگ ثابت‌ها با هشت حالت و کدهای حضور", async () => {
  const r = await req("/api/hrm/meta");
  assert.equal(r.status, 200);
  assert.equal(r.json.data.states.length, 8);
  assert.equal(r.json.meta.engine, "hrm-v1");
  assert.ok(r.json.data.attendanceCodes.some((c) => c.code === "weather_delay"));
  assert.equal(r.json.data.laborLaw.dailyAbsoluteCap, 16);
});

test("بدون کاربر ۴۰۱ می‌دهد", async () => {
  const r = await req("/api/hrm/meta", { user: null });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, "E-HRM-AUTH-REQUIRED");
});

test("کاربر بی‌ربط ۴۰۳ می‌گیرد و مجوز نامش را می‌بیند", async () => {
  const r = await req("/api/hrm/meta", { user: "u-doc" });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.roster.view");
});

test("بدون شناسهٔ پروژه ۴۰۰ می‌دهد", async () => {
  const r = await req("/api/hrm/timesheets");
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-NO-PROJECT");
});

/* ═══════════ ۲. ثبت برگه ═══════════ */

test("برگهٔ سالم ساخته می‌شود و جمع‌ها از موتور می‌آیند", async () => {
  const r = await makeSheet("CR-A", "2026-04-01", [ENTRY(), ENTRY({ personId: "PER-2", hoursRaw: 10 })]);
  assert.equal(r.status, 201, r.text.slice(0, 300));
  assert.equal(r.json.data.totals.headcount, 2);
  assert.equal(r.json.data.totals.normal, 16);
  assert.equal(r.json.data.totals.ot, 2, "۱۰ ساعت یعنی ۸ عادی + ۲ اضافه");
  assert.ok(r.json.data.id.includes("20260401"));
});

test("شناسهٔ برگه قطعی است و ارسال دوباره تکراری نمی‌سازد", async () => {
  const a = await makeSheet("CR-B", "2026-04-02");
  const b = await makeSheet("CR-B", "2026-04-02", [ENTRY({ hoursRaw: 6 })]);
  assert.equal(a.json.data.id, b.json.data.id);
  assert.equal(b.status, 200, "به‌روزرسانی است نه ساخت");
  assert.equal(b.json.data.created, false);
  assert.equal(b.json.data.totals.raw, 6, "ردیف قبلی باطل شده");
});

test("ساعت بدون فعالیت رد می‌شود", async () => {
  const r = await makeSheet("CR-C", "2026-04-03", [ENTRY({ activityId: undefined })]);
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-101"));
});

test("ساعت بدون حساب هزینه رد می‌شود", async () => {
  const r = await makeSheet("CR-C", "2026-04-03", [ENTRY({ cbsId: undefined })]);
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-105"));
});

test("برگهٔ بی‌ردیف رد می‌شود", async () => {
  const r = await makeSheet("CR-C", "2026-04-03", []);
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-111");
});

test("سقف مطلق روزانه در برگه‌های جدا هم رعایت می‌شود", async () => {
  /* دو برگه، یک نفر، یک روز: جمع باید سنجیده شود. */
  await makeSheet("CR-D1", "2026-04-05", [ENTRY({ personId: "PER-CAP", hoursRaw: 10 })]);
  const r = await makeSheet("CR-D2", "2026-04-05", [ENTRY({ personId: "PER-CAP", hoursRaw: 10 })]);
  assert.equal(r.status, 422);
  const cap = r.json.error.issues.find((i) => i.code === "E-HRM-102");
  assert.ok(cap, "سقف ۱۶ ساعت باید فعال شود");
  assert.equal(cap.personId, "PER-CAP");
});

test("اضافه‌کاری زیاد هشدار می‌دهد ولی ثبت می‌شود", async () => {
  const r = await makeSheet("CR-E", "2026-04-06", [ENTRY({ hoursRaw: 14 })]);
  assert.equal(r.status, 201);
  assert.ok(r.json.data.warnings.some((w) => w.code === "W-HRM-301"));
});

test("ساعت فراتر از سقف مطلق اصلاً پذیرفته نمی‌شود", async () => {
  /* موتور آن را می‌بُرد، ولی لایهٔ REST زودتر جلویش را می‌گیرد:
     برگه‌ای که ۴ ساعتش بی‌صدا حذف شده باشد، دروغ می‌گوید. */
  const r = await makeSheet("CR-F", "2026-04-07", [ENTRY({ hoursRaw: 20 })]);
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-102"));
});

test("مرخصی بدون ساعت پذیرفته می‌شود", async () => {
  const r = await makeSheet("CR-G", "2026-04-08", [
    { personId: "PER-9", attendanceCode: "leave", hoursRaw: 0 },
  ]);
  assert.equal(r.status, 201, r.text.slice(0, 200));
  assert.equal(r.json.data.totals.headcount, 0, "کسی که کار نکرده در سرشمار نیست");
});

test("ثبت برگه مجوز می‌خواهد", async () => {
  const r = await makeSheet("CR-H", "2026-04-09", [ENTRY()], {});
  assert.equal(r.status, 201);
  const denied = await req("/api/hrm/timesheets", {
    user: "u-doc", method: "POST",
    body: { projectId: PROJECT, crewId: "CR-X", workDate: "2026-04-09", entries: [ENTRY()] },
  });
  assert.equal(denied.status, 403);
});

/* ═══════════ ۳. خواندن ═══════════ */

test("فهرست برگه‌ها با خلاصهٔ روزانه", async () => {
  await makeSheet("CR-L1", "2026-05-01", [ENTRY(), ENTRY({ personId: "PER-2" })]);
  const r = await req(`/api/hrm/timesheets?projectId=${PROJECT}&workDate=2026-05-01`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.count >= 1);
  assert.equal(r.json.data.summary.workDate, "2026-05-01");
  assert.ok(r.json.data.items[0].statusFa, "برچسب فارسی لازم است");
  assert.ok(Array.isArray(r.json.data.items[0].nextStates));
});

test("برگهٔ منفرد ردیف‌ها و جمع‌ها را می‌دهد", async () => {
  const c = await makeSheet("CR-L2", "2026-05-02", [ENTRY({ attendanceCode: "standby" })]);
  const r = await req(`/api/hrm/timesheets/${c.json.data.id}?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.data.entries.length, 1);
  assert.equal(r.json.data.entries[0].attendanceFa, "آماده‌به‌کار");
  assert.equal(r.json.data.totals.lostHours, 8, "آماده‌به‌کار ساعت دارد ولی مولد نیست");
  assert.equal(r.json.data.header.isEditable, true);
});

test("برگهٔ پروژهٔ دیگر ۴۰۴ می‌دهد", async () => {
  const c = await makeSheet("CR-L3", "2026-05-03");
  const r = await req(`/api/hrm/timesheets/${c.json.data.id}?projectId=p2`);
  assert.equal(r.status, 404, "۴۰۳ خودش افشای وجود برگه است");
});

test("فهرست دوره‌ای بر پایهٔ کد دوره پالایش می‌شود", async () => {
  const r = await req(`/api/hrm/timesheets?projectId=${PROJECT}&periodCode=2026-05`);
  assert.equal(r.status, 200);
  for (const it of r.json.data.items) assert.equal(it.periodCode, "2026-05");
});

/* ═══════════ ۴. زنجیرهٔ تأیید ═══════════ */

test("زنجیرهٔ کامل: ارسال، سرپرست، کیفیت، مدیر پروژه", async () => {
  const c = await makeSheet("CR-W1", "2026-06-01");
  const id = c.json.data.id;
  const q = { projectId: PROJECT };

  const s1 = await req(`/api/hrm/timesheets/${id}/transition`, {
    user: "u-site", method: "POST", body: { ...q, to: "submitted" },
  });
  assert.equal(s1.status, 200, s1.text.slice(0, 300));

  const s2 = await req(`/api/hrm/timesheets/${id}/transition`, {
    user: "u-hr", method: "POST", body: { ...q, to: "foreman_approved", foremanSignatureRef: "sig-1" },
  });
  assert.equal(s2.status, 200, s2.text.slice(0, 300));

  const s3 = await req(`/api/hrm/timesheets/${id}/transition`, {
    user: "u-qc", method: "POST", body: { ...q, to: "qc_verified" },
  });
  assert.equal(s3.status, 200, s3.text.slice(0, 300));

  const s4 = await req(`/api/hrm/timesheets/${id}/transition`, {
    user: "u-pm", method: "POST", body: { ...q, to: "pm_approved" },
  });
  assert.equal(s4.status, 200, s4.text.slice(0, 300));
  assert.equal(s4.json.data.toFa, "تأیید مدیر پروژه");
});

test("تأیید سرپرست بدون امضا رد می‌شود", async () => {
  const c = await makeSheet("CR-W2", "2026-06-02");
  const id = c.json.data.id;
  await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-site", method: "POST", body: { projectId: PROJECT, to: "submitted" } });
  const r = await req(`/api/hrm/timesheets/${id}/transition`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, to: "foreman_approved" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-112");
});

test("پرش از گیت سرپرست ممکن نیست", async () => {
  const c = await makeSheet("CR-W3", "2026-06-03");
  const id = c.json.data.id;
  await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-site", method: "POST", body: { projectId: PROJECT, to: "submitted" } });
  const r = await req(`/api/hrm/timesheets/${id}/transition`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, to: "pm_approved" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-110");
});

test("هر گذار مجوز خودش را می‌خواهد", async () => {
  const c = await makeSheet("CR-W4", "2026-06-04");
  const id = c.json.data.id;
  await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-site", method: "POST", body: { projectId: PROJECT, to: "submitted" } });
  /* مهندس کارگاه ثبت می‌کند ولی امضای سرپرستی نمی‌دهد — SOD-16. */
  const r = await req(`/api/hrm/timesheets/${id}/transition`, {
    user: "u-site", method: "POST", body: { projectId: PROJECT, to: "foreman_approved", foremanSignatureRef: "sig-x" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.timesheet.sign");
});

test("برگشت بدون دلیل رد می‌شود", async () => {
  const c = await makeSheet("CR-W5", "2026-06-05");
  const id = c.json.data.id;
  await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-site", method: "POST", body: { projectId: PROJECT, to: "submitted" } });
  const bad = await req(`/api/hrm/timesheets/${id}/transition`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, to: "rejected", reasonFa: "غلط" },
  });
  assert.equal(bad.status, 422);
  assert.equal(bad.json.error.code, "E-HRM-113");

  const ok = await req(`/api/hrm/timesheets/${id}/transition`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT, to: "rejected", reasonFa: "ساعت اکیپ با دفتر نگهبانی نمی‌خواند" },
  });
  assert.equal(ok.status, 200);
});

test("برگهٔ ارسال‌شده از مسیر ثبت عادی ویرایش نمی‌شود", async () => {
  const c = await makeSheet("CR-W6", "2026-06-06");
  await req(`/api/hrm/timesheets/${c.json.data.id}/transition`, { user: "u-site", method: "POST", body: { projectId: PROJECT, to: "submitted" } });
  const r = await makeSheet("CR-W6", "2026-06-06", [ENTRY({ hoursRaw: 4 })]);
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HRM-TS-LOCKED");
});

test("گذار روی برگهٔ ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await req("/api/hrm/timesheets/TS-ghost/transition", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, to: "submitted" },
  });
  assert.equal(r.status, 404);
});

/* ═══════════ ۴٫۵ گیت تجهیز روی ثبت مستقیم (TD-HRM-05) ═══════════ */

let td05PersonId = null;

test("ساعت نیروی غیرفعال ثبت نمی‌شود", async () => {
  /* عضویت اکیپ این گیت را داشت ولی ثبت مستقیم نه — یعنی پنج گیت
   * تجهیز با یک درخواست دور زده می‌شد: نفری با وضعیت `candidate`،
   * بدون مدرک و بدون آموزش HSE، ساعتش تا دفتر مالی می‌رفت. */
  const person = await req("/api/hrm/people", {
    user: "u-hr", method: "POST",
    body: {
      projectId: PROJECT, personnelNo: "PER-TD05", fullNameFa: "نفر داوطلب",
      primaryTradeCode: "CIV-RBR", employmentType: "permanent",
    },
  });
  assert.equal(person.status, 201, person.text.slice(0, 200));
  td05PersonId = person.json.data.id;

  const r = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, crewId: "CR-TD05", workDate: "2026-09-01",
      entries: [{
        personId: person.json.data.id, tradeCode: "CIV-RBR",
        activityId: "A-1", cbsId: "CBS-1", hoursRaw: 8,
      }],
    },
  });
  assert.equal(r.status, 422, r.text.slice(0, 200));
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-261"), JSON.stringify(r.json.error.issues));
});

test("وضعیت از پروندهٔ سرور خوانده می‌شود نه از بدنهٔ درخواست", async () => {
  /* اگر `blockedPersonIds` بدنه ملاک بود، کلاینت می‌توانست بگوید
   * «هیچ‌کس مسدود نیست» و گیت را خاموش کند. */
  assert.ok(td05PersonId, "آزمون قبلی نفر را نساخت");

  const r = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, crewId: "CR-TD05B", workDate: "2026-09-02",
      blockedPersonIds: [],
      unclearedPersonIds: [],
      entries: [{
        personId: td05PersonId, tradeCode: "CIV-RBR",
        activityId: "A-1", cbsId: "CBS-1", hoursRaw: 8,
      }],
    },
  });
  assert.equal(r.status, 422, "ادعای کلاینت نباید گیت را خاموش کند");
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-261"));
});

test("نفر بدون پرونده هشدار می‌گیرد نه خطا", async () => {
  /* پروژه‌های موجود ساعت‌هایی دارند که پیش از راه‌اندازی D7 ثبت
   * شده‌اند؛ مسدود کردنشان سامانه را از کار می‌اندازد. */
  const r = await req("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: {
      projectId: PROJECT, crewId: "CR-TD05C", workDate: "2026-09-03",
      entries: [{
        personId: "PER-NO-FILE", tradeCode: "CIV-RBR",
        activityId: "A-1", cbsId: "CBS-1", hoursRaw: 8,
      }],
    },
  });
  assert.equal(r.status, 201, `باید پذیرفته شود: ${r.text.slice(0, 200)}`);
});

/* ═══════════ ۵. قفل دوره ═══════════ */

test("دوره با برگهٔ معطل بسته نمی‌شود", async () => {
  await makeSheet("CR-P1", "2026-07-01");
  const r = await req("/api/hrm/periods/lock", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: "2026-07" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-121");
  assert.ok(r.json.error.detailsFa.length > 0);
});

test("بستن دوره مجوز جدا می‌خواهد", async () => {
  const r = await req("/api/hrm/periods/lock", {
    user: "u-site", method: "POST", body: { projectId: PROJECT, periodCode: "2026-07" },
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.period.lock");
});

test("دورهٔ آماده بسته می‌شود و ثبت تازه را می‌بندد", async () => {
  const c = await makeSheet("CR-P2", "2026-08-01");
  const id = c.json.data.id;
  const q = { projectId: PROJECT };
  await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-site", method: "POST", body: { ...q, to: "submitted" } });
  await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-hr", method: "POST", body: { ...q, to: "foreman_approved", foremanSignatureRef: "s" } });
  await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-pm", method: "POST", body: { ...q, to: "pm_approved" } });
  /* ارسال به مالی مجوز `hrm.cost.post` می‌خواهد که پس از SOD-28 نزد
   * PMO است، نه مدیر منابع انسانی (او نرخ را تعریف می‌کند). */
  const toPosted = await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-pmo", method: "POST", body: { ...q, to: "posted" } });
  assert.equal(toPosted.status, 200, toPosted.text.slice(0, 200));

  const lock = await req("/api/hrm/periods/lock", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: "2026-08", reasonFa: "بستن دورهٔ ماهانه" },
  });
  assert.equal(lock.status, 201, lock.text.slice(0, 300));
  assert.equal(lock.json.data.lockedHeaderCount, 1);

  const blocked = await makeSheet("CR-P3", "2026-08-15");
  assert.equal(blocked.status, 422);
  assert.equal(blocked.json.error.code, "E-HRM-103");
});

test("بستن دوباره ۴۰۹ می‌دهد", async () => {
  const r = await req("/api/hrm/periods/lock", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: "2026-08" },
  });
  assert.equal(r.status, 409);
});

test("بازگشایی بدون دلیل رد می‌شود", async () => {
  const r = await req("/api/hrm/periods/unlock", {
    user: "u-pm", method: "POST", body: { projectId: PROJECT, periodCode: "2026-08", reasonFa: "لازم" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HRM-123");
});

test("بازگشایی با دلیل، ثبت را دوباره باز می‌کند", async () => {
  const u = await req("/api/hrm/periods/unlock", {
    user: "u-pm", method: "POST",
    body: { projectId: PROJECT, periodCode: "2026-08", reasonFa: "کشف ردیف جاافتادهٔ اکیپ شب پس از بستن دوره" },
  });
  assert.equal(u.status, 200, u.text.slice(0, 300));
  const after = await makeSheet("CR-P4", "2026-08-20");
  assert.equal(after.status, 201, "پس از بازگشایی باید ثبت ممکن باشد");
});

test("فهرست دوره‌ها وضعیت قفل را نشان می‌دهد", async () => {
  const r = await req(`/api/hrm/periods?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  const p8 = r.json.data.items.find((x) => x.periodCode === "2026-08");
  assert.ok(p8);
  assert.equal(p8.isLocked, false, "بازگشایی شده است");
});

/* ═══════════ ۶. هزینه ═══════════ */

test("هزینه فقط ساعت تأییدشده را می‌شمارد", async () => {
  const r = await req(`/api/hrm/cost?projectId=${PROJECT}&periodCode=2026-06`, { user: "u-hr" });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.ok(r.json.data.pendingHeaderCount >= 1, "برگهٔ پیش‌نویس نباید هزینه شود");
  assert.equal(typeof r.json.data.totalEquivalentHours, "number");
});

test("هزینه مجوز بهره‌وری می‌خواهد", async () => {
  const r = await req(`/api/hrm/cost?projectId=${PROJECT}&periodCode=2026-06`, { user: "u-site" });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.permission, "hrm.productivity.view");
});

test("کنترل هزینه ساعت را می‌بیند ولی مبلغ ماسک می‌شود", async () => {
  /* رفع شکاف H-09: نرخ دستمزد دادهٔ فردی حساس است، ساعت نه. */
  const r = await req(`/api/hrm/cost?projectId=${PROJECT}&periodCode=2026-06`, { user: "u-cost" });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.equal(r.json.data.ratesMasked, true);
  assert.equal(r.json.data.totalAmount, "•••");
  assert.equal(typeof r.json.data.totalEquivalentHours, "number", "ساعت باید دیده شود");
});

test("مدیر منابع انسانی مبلغ را می‌بیند", async () => {
  const r = await req(`/api/hrm/cost?projectId=${PROJECT}&periodCode=2026-06`, { user: "u-hr" });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.ratesMasked, false);
  assert.equal(typeof r.json.data.totalAmount, "number");
});

test("هزینه بدون دوره رد می‌شود", async () => {
  const r = await req(`/api/hrm/cost?projectId=${PROJECT}`, { user: "u-hr" });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "E-HRM-NO-PERIOD");
});

test("ساعت بدون نرخ گم نمی‌شود بلکه گزارش می‌شود", async () => {
  const r = await req(`/api/hrm/cost?projectId=${PROJECT}&periodCode=2026-08`, { user: "u-hr" });
  assert.equal(r.status, 200);
  assert.ok(typeof r.json.data.noteFa === "string" && r.json.data.noteFa.length > 5);
});

/* ═══════════ ۷. همگام‌سازی ═══════════ */

test("برگهٔ ناموجود در سرور تعارض نیست", async () => {
  const r = await req("/api/hrm/sync/timesheet", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, local: { id: "TS-ghost", status: "draft", revision: 1 } },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.action, "create_needed");
});

test("نسخهٔ امضاشدهٔ سرور برنده است و تعارض ثبت می‌شود", async () => {
  const c = await makeSheet("CR-S1", "2026-09-01");
  const id = c.json.data.id;
  const q = { projectId: PROJECT };
  await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-site", method: "POST", body: { ...q, to: "submitted" } });
  await req(`/api/hrm/timesheets/${id}/transition`, { user: "u-hr", method: "POST", body: { ...q, to: "foreman_approved", foremanSignatureRef: "s" } });

  const r = await req("/api/hrm/sync/timesheet", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, local: { id, status: "draft", revision: 99, capturedAt: "2026-09-02T10:00:00Z", deviceId: "TAB-7" } },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.verdict.winner, "server");
  assert.equal(r.json.data.verdict.requiresAdjustment, true);
  assert.ok(r.json.data.conflictId, "کار اپراتور باید در دفتر تعارض بماند");
  assert.equal(r.json.data.action, "keep_server");
});

test("دفتر تعارض قابل خواندن است", async () => {
  const r = await req(`/api/hrm/conflicts?projectId=${PROJECT}`, { user: "u-site" });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.count >= 1);
  assert.ok(r.json.data.items[0].DiffSummaryFa.length > 10, "دلیل فارسی لازم است");
});

test("دفتر تعارض مجوز می‌خواهد", async () => {
  const r = await req(`/api/hrm/conflicts?projectId=${PROJECT}`, { user: "u-doc" });
  assert.equal(r.status, 403);
});

test("محلیِ قوی‌تر اعمال می‌شود", async () => {
  const c = await makeSheet("CR-S2", "2026-09-03");
  const r = await req("/api/hrm/sync/timesheet", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, local: { id: c.json.data.id, status: "foreman_approved", revision: 2, foremanSignatureRef: "sig", capturedAt: "2026-09-03T18:00:00Z" } },
  });
  assert.equal(r.json.data.verdict.winner, "local");
  assert.equal(r.json.data.action, "apply_local");
});

/* ═══════════ ۸. سند اصلاحی ═══════════ */

let adjEntryId, adjId;

test("سند اصلاحی روی ردیف واقعی ثبت می‌شود", async () => {
  const c = await makeSheet("CR-J1", "2026-10-01");
  const full = await req(`/api/hrm/timesheets/${c.json.data.id}?projectId=${PROJECT}`);
  adjEntryId = full.json.data.entries[0].Id;

  const r = await req("/api/hrm/adjustments", {
    user: "u-hr", method: "POST",
    body: {
      projectId: PROJECT, originalEntryId: adjEntryId,
      adjustmentType: "hours_correction", deltaHours: -2,
      reasonTextFa: "دو ساعت اضافه بر اثر خطای ثبت اپراتور شیفت شب",
    },
  });
  assert.equal(r.status, 201, r.text.slice(0, 300));
  adjId = r.json.data.id;
  assert.equal(r.json.data.projectedHours, 6);
  assert.equal(r.json.data.typeFa, "اصلاح ساعت");
});

test("اصلاح با دلیل کوتاه رد می‌شود", async () => {
  const r = await req("/api/hrm/adjustments", {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, originalEntryId: adjEntryId, adjustmentType: "hours_correction", deltaHours: -1, reasonTextFa: "غلط" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-131"));
});

test("اصلاحی که ساعت را منفی کند رد می‌شود", async () => {
  const r = await req("/api/hrm/adjustments", {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, originalEntryId: adjEntryId, adjustmentType: "hours_correction", deltaHours: -50, reasonTextFa: "اصلاح کامل ساعت ثبت‌شدهٔ اشتباه" },
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.issues.some((i) => i.code === "E-HRM-134"));
});

test("ردیف ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await req("/api/hrm/adjustments", {
    user: "u-hr", method: "POST",
    body: { projectId: PROJECT, originalEntryId: "ghost", adjustmentType: "reverse", deltaHours: 0, reasonTextFa: "ابطال ردیف اشتباه ثبت‌شده" },
  });
  assert.equal(r.status, 404);
});

test("تأیید اصلاحیه دست دیگری می‌خواهد", async () => {
  /* مدیر منابع انسانی می‌نویسد، مدیر پروژه تأیید می‌کند — SOD-18. */
  const denied = await req(`/api/hrm/adjustments/${adjId}/approve`, {
    user: "u-hr", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error.permission, "hrm.adjustment.approve");

  const ok = await req(`/api/hrm/adjustments/${adjId}/approve`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(ok.status, 200, ok.text.slice(0, 300));
  assert.equal(ok.json.data.effectiveHours, 6, "۸ منهای ۲");
});

test("تأیید دوباره ۴۰۹ می‌دهد", async () => {
  const r = await req(`/api/hrm/adjustments/${adjId}/approve`, {
    user: "u-pm", method: "POST", body: { projectId: PROJECT },
  });
  assert.equal(r.status, 409);
});

test("فهرست اصلاحیه‌ها با برچسب فارسی", async () => {
  const r = await req(`/api/hrm/adjustments?projectId=${PROJECT}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.data.count >= 1);
  assert.ok(r.json.data.items.every((x) => x.typeFa));
});

test("اصلاحیهٔ پروژهٔ دیگر دیده نمی‌شود", async () => {
  const r = await req("/api/hrm/adjustments?projectId=p2");
  assert.equal(r.status, 200);
  assert.equal(r.json.data.count, 0);
});
