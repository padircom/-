/**
 * آزمون یکپارچهٔ لایهٔ REST — MOD-08 / HSE، تحویلی D6.
 *
 * چرخهٔ کامل: بازرسی ← یافته ← تخلف ← دستور توقف کار ← قفل فعالیت ←
 * اقدام اصلاحی ← بازبینی مجدد ← آزادسازی ← رفع قفل ← بستن بازرسی.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";

const PORT = 4722;
const BASE = `http://127.0.0.1:${PORT}`;
let child;
let dataDir;

async function api(method, path, { body, user = "u-hse", raw = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-user-id": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return raw ? { status: res.status, json } : json;
}

const PID = "vio-p1";
const P = `?projectId=${PID}`;

/* دو فعالیت واقعی لازم است تا قفل مشتق قابل آزمون باشد. */
const ACT_A = "vio-act-a";
const ACT_B = "vio-act-b";

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "hse-vio-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});

  const path = join(dataDir, "Activity.json");
  let rows = [];
  try {
    rows = JSON.parse(await readFile(path, "utf8"));
  } catch {}
  const base = {
    ProjectId: PID, WbsId: null, Code: null, Discipline: null,
    PlannedStart: "2026-09-01", PlannedFinish: "2026-10-01",
    IsStopWorkOrder: false, CreatedAt: "2026-09-01T00:00:00.000Z", RowVersion: 1,
  };
  rows.push({ ...base, Id: ACT_A, NameFa: "نصب داربست واحد ۲۰۰", AreaFa: "واحد ۲۰۰", SystemId: "SYS-10" });
  rows.push({ ...base, Id: ACT_B, NameFa: "لوله‌کشی واحد ۳۰۰", AreaFa: "واحد ۳۰۰", SystemId: "SYS-20" });
  await writeFile(path, JSON.stringify(rows, null, 2));

  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${BASE}/api/cnt/status`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("سرور بالا نیامد");
});

after(async () => {
  child?.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 200));
  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
});

let inspId, findId, swoId, capaId, plainId;

/* ══════════════════════ ۱) واژگان ══════════════════════ */

test("واژگان تخلف الزام توقف کار را اعلام می‌کند", async () => {
  const r = await api("GET", "/api/hse/violation-vocab");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.findingCategories.length, 6);
  assert.equal(r.data.stopWorkScopes.length, 4);

  const noPtw = r.data.violationTypes.find((t) => t.code === "no_ptw");
  assert.equal(noPtw.mandatoryStopWork, true);
  const hk = r.data.violationTypes.find((t) => t.code === "housekeeping");
  assert.equal(hk.mandatoryStopWork, false);

  assert.equal(r.data.slaDays.critical, 1);
  assert.equal(r.data.inspectionPassScore, 80);
});

test("همهٔ اقلام واژگان عنوان فارسی دارند", async () => {
  const r = await api("GET", "/api/hse/violation-vocab");
  for (const key of ["findingCategories", "findingStatuses", "violationTypes", "violationStatuses", "stopWorkScopes"]) {
    for (const item of r.data[key]) {
      assert.ok(item.titleFa && item.titleFa !== item.code, `${key}/${item.code}`);
    }
  }
});

/* ══════════════════════ ۲) بازرسی و یافته ══════════════════════ */

test("بازرسی با نوع نامعتبر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/inspection${P}`, {
    body: { inspectionNo: "I-BAD", titleFa: "x", inspectionType: "telepathy" },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-INSPECTION-TYPE");
});

test("ثبت بازرسی هفتگی", async () => {
  const r = await api("POST", `/api/hse/inspection${P}`, {
    body: {
      inspectionNo: "INS-001", titleFa: "بازدید هفتگی واحد ۲۰۰",
      inspectionType: "walkthrough", inspectedAt: "2026-09-01",
      areaFa: "واحد ۲۰۰", scorePct: 72,
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  inspId = r.data.id;
  assert.equal(r.data.item.Status, "draft");
  assert.equal(r.data.passScore, 80);
});

test("شمارهٔ تکراری بازرسی رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/inspection${P}`, {
    body: { inspectionNo: "INS-001", titleFa: "تکراری", inspectionType: "audit" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-INSPECTION");
});

test("سرپرست کارگاه مجوز ثبت بازرسی ندارد", async () => {
  const r = await api("POST", `/api/hse/inspection${P}`, {
    body: { inspectionNo: "INS-X", titleFa: "x", inspectionType: "audit" },
    user: "u-site", raw: true,
  });
  assert.equal(r.status, 403);
});

test("یافته با دستهٔ نامعتبر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/inspection/${inspId}/finding`, {
    body: { descriptionFa: "چیزی", category: "cosmic", severity: "low" },
    raw: true,
  });
  assert.equal(r.status, 422);
});

test("افزودن یافته — مهلت از شدت مشتق می‌شود", async () => {
  const r = await api("POST", `/api/hse/inspection/${inspId}/finding`, {
    body: {
      descriptionFa: "کارگر بدون کمربند ایمنی روی داربست",
      category: "ppe", severity: "high", activityId: ACT_A, ownerRef: "u-site",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  findId = r.data.id;
  assert.equal(r.data.item.FindingNo, 1);
  assert.equal(r.data.item.categoryFa, "تجهیزات حفاظت فردی");
  assert.equal(r.data.item.DueDate, "2026-09-04", "شدت بالا یعنی سه روز مهلت");
  assert.equal(r.data.summary.open, 1);
  assert.equal(r.data.summary.closureRatePct, 0);
});

test("افزودن یافتهٔ دوم — شماره خودکار", async () => {
  const r = await api("POST", `/api/hse/inspection/${inspId}/finding`, {
    body: { descriptionFa: "پراکندگی ضایعات در مسیر تردد", category: "housekeeping", severity: "low" },
  });
  assert.equal(r.data.item.FindingNo, 2);
  assert.equal(r.data.summary.total, 2);
});

test("شمارنده‌های جدول بازرسی موجود همگام می‌مانند", async () => {
  const r = await api("GET", `/api/hse/inspection/${inspId}`);
  assert.equal(r.data.item.FindingsCount, 2, "ستون قدیمی باید به‌روز بماند");
  assert.equal(r.data.item.ClosedFindings, 0);
});

test("بازرسی با یافتهٔ باز بسته نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/inspection/${inspId}/close`, { body: { dryRun: true } });
  assert.equal(r.data.verdict.ok, false);
  assert.match(r.data.verdict.blockersFa.join(), /یافتهٔ باز/);
});

/* ══════════════════════ ۳) تخلف بدون توقف کار ══════════════════════ */

test("تخلف با نوع نامعتبر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: { violationNo: "V-BAD", titleFa: "x", violationType: "telepathy", severity: "low" },
    raw: true,
  });
  assert.equal(r.status, 422);
});

test("صدور تخلف ساده — مهلت از شدت مشتق می‌شود", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-001", titleFa: "ضایعات رها شده در مسیر",
      violationType: "housekeeping", severity: "low",
      issuedAt: "2026-09-01T08:00:00.000Z", contractorFa: "پیمانکار الف",
      inspectionId: inspId, findingId: findId, fineAmount: 5_000_000,
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  plainId = r.data.id;
  assert.equal(r.data.item.IsStopWork, false);
  assert.equal(r.data.item.DueDate, "2026-09-15", "شدت پایین یعنی ۱۴ روز");
  assert.equal(r.data.stopWorkRequired.required, false);
  assert.equal(r.data.state.isBlocking, false);
});

test("سرپرست کارگاه مجوز صدور تخلف ندارد", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: { violationNo: "V-X", titleFa: "x", violationType: "housekeeping", severity: "low" },
    user: "u-site", raw: true,
  });
  assert.equal(r.status, 403);
});

test("شمارهٔ تکراری تخلف رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: { violationNo: "V-001", titleFa: "تکراری", violationType: "housekeeping", severity: "low" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-VIOLATION");
});

test("فعالیت پروژهٔ دیگر پذیرفته نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-XP", titleFa: "x", violationType: "housekeeping",
      severity: "low", activityId: "no-such-activity",
    },
    raw: true,
  });
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "E-HSE-ACTIVITY-NOT-FOUND");
});

/* ══════════════════════ ۴) الزام توقف کار ══════════════════════ */

test("کار بدون پروانه بدون توقف کار ثبت نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-NOSWO", titleFa: "جوشکاری بدون پروانه",
      violationType: "no_ptw", severity: "low", isStopWork: false,
    },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-SWO-REQUIRED");
});

test("شدت بحرانی هم توقف کار الزامی دارد", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-CRIT", titleFa: "کار در ارتفاع بدون حفاظ",
      violationType: "unsafe_act", severity: "critical", isStopWork: false,
    },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-SWO-REQUIRED");
});

test("توقف کار بدون دامنه رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-NOSCOPE", titleFa: "جوشکاری بدون پروانه",
      violationType: "no_ptw", severity: "high", isStopWork: true,
    },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-SWO-SCOPE");
});

test("توقف در سطح فعالیت بدون شناسهٔ فعالیت رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-NOACT", titleFa: "جوشکاری بدون پروانه",
      violationType: "no_ptw", severity: "high",
      isStopWork: true, stopWorkScope: "activity",
    },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-SWO-ACTIVITY");
});

/* ══════════════════════ ۵) صدور SWO و قفل فعالیت ══════════════════════ */

test("فعالیت پیش از تخلف قفل نیست", async () => {
  const r = await api("GET", `/api/hse/activity-lock/${ACT_A}${P}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.storedFlag, false);
  assert.equal(r.data.derived.isLocked, false);
  assert.equal(r.data.inSync, true);
});

test("صدور دستور توقف کار روی فعالیت", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-SWO-1", titleFa: "جوشکاری بدون پروانهٔ کار گرم",
      violationType: "no_ptw", severity: "high",
      issuedAt: "2026-09-02T09:00:00.000Z",
      isStopWork: true, stopWorkScope: "activity", activityId: ACT_A,
      contractorFa: "پیمانکار الف", offenderRef: "u-sub",
      correctiveRequestFa: "اخذ پروانهٔ کار گرم و ارائهٔ جواز جوشکار",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  swoId = r.data.id;
  assert.equal(r.data.item.IsStopWork, true);
  assert.equal(r.data.item.scopeFa, "فعالیت");
  assert.equal(r.data.stopWorkRequired.required, true);
  assert.equal(r.data.state.isBlocking, true);
  assert.equal(r.data.activityLock.isLocked, true, "قفل باید بلافاصله اعمال شود");
});

test("ستون Activity.IsStopWorkOrder واقعاً نوشته شده است", async () => {
  const r = await api("GET", `/api/hse/activity-lock/${ACT_A}${P}`);
  assert.equal(r.data.storedFlag, true, "ستون فعالیت باید قفل شده باشد");
  assert.equal(r.data.derived.isLocked, true);
  assert.equal(r.data.inSync, true, "ستون ذخیره‌شده و وضعیت مشتق باید بخوانند");
  assert.equal(r.data.blockingViolations.length, 1);
  assert.equal(r.data.blockingViolations[0].violationNo, "V-SWO-1");
});

test("فعالیت دیگر قفل نشده است", async () => {
  const r = await api("GET", `/api/hse/activity-lock/${ACT_B}${P}`);
  assert.equal(r.data.derived.isLocked, false);
  assert.equal(r.data.storedFlag, false);
});

test("مدیر تضمین کیفیت مجوز صدور توقف کار ندارد", async () => {
  /* u-qa مجوز release دارد ولی نه issue — پس در همان دروازهٔ اول رد می‌شود. */
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-QA", titleFa: "x", violationType: "no_ptw",
      severity: "high", isStopWork: true, stopWorkScope: "project",
    },
    user: "u-qa", raw: true,
  });
  assert.equal(r.status, 403);
});

test("فهرست تخلفات با فیلتر توقف کار", async () => {
  const all = await api("GET", `/api/hse/violation${P}`);
  assert.equal(all.data.count, 2);
  assert.equal(all.data.summary.stopWorkTotal, 1);
  assert.equal(all.data.summary.stopWorkActive, 1);
  assert.equal(all.data.summary.totalFine, 5_000_000);

  const swo = await api("GET", `/api/hse/violation${P}&stopWork=1`);
  assert.equal(swo.data.count, 1);
  assert.equal(swo.data.items[0].ViolationNo, "V-SWO-1");
});

/* ══════════════════════ ۶) آزادسازی ══════════════════════ */

test("آزادسازی بدون بازبینی مجدد مسدود است", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/release`, {
    body: { dryRun: true }, user: "u-qa",
  });
  assert.equal(r.data.verdict.ok, false);
  assert.match(r.data.verdict.blockersFa.join(), /بازبینی مجدد/);
});

test("افسر ایمنی مجوز آزادسازی ندارد", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/release`, { body: {}, raw: true });
  assert.equal(r.status, 403, "صادرکنندهٔ تخلف نباید بتواند آزاد کند");
});

test("بازبینی مجدد ناموفق تخلف را به در حال رفع برمی‌گرداند", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/re-inspect`, {
    body: { isSatisfactory: false, rejectReasonFa: "پروانه هنوز اخذ نشده" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.attemptNo, 1);
  assert.equal(r.data.violation.Status, "in_progress");
});

test("بازبینی ناموفق آزادسازی را باز نمی‌کند", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/release`, {
    body: { dryRun: true }, user: "u-qa",
  });
  assert.equal(r.data.verdict.ok, false);
  assert.match(r.data.verdict.blockersFa.join(), /رضایت‌بخش/);
});

test("بازبینی موفق وضعیت را به بازبینی‌شده می‌برد", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/re-inspect`, {
    body: { isSatisfactory: true, evidenceFa: "پروانهٔ کار گرم شمارهٔ PTW-88 صادر شد" },
  });
  assert.equal(r.data.attemptNo, 2);
  assert.equal(r.data.violation.Status, "re_inspected");
});

test("توقف کار بدون اقدام اصلاحی آزاد نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/release`, {
    body: { dryRun: true }, user: "u-qa",
  });
  assert.equal(r.data.verdict.ok, false);
  assert.match(r.data.verdict.blockersFa.join(), /بدون اقدام اصلاحی/);
});

test("ثبت اقدام اصلاحی با منشأ تخلف", async () => {
  /* جدول CapaAction از D5 بدون مهاجرت تازه منشأ violation را می‌پذیرد. */
  const r = await api("POST", `/api/hse/capa${P}`, {
    body: {
      sourceType: "violation", sourceId: swoId,
      actionFa: "آموزش مجدد رویهٔ پروانهٔ کار گرم برای اکیپ جوشکاری",
      actionType: "preventive", ownerRef: "u-site", dueDate: "2026-09-30",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  capaId = r.data.id;
});

test("اقدام اصلاحی باز هنوز مانع آزادسازی است", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/release`, {
    body: { dryRun: true }, user: "u-qa",
  });
  assert.equal(r.data.verdict.ok, false);
  assert.match(r.data.verdict.blockersFa.join(), /هنوز باز است/);
});

test("تکمیل و راستی‌آزمایی اقدام", async () => {
  await api("POST", `/api/hse/capa/${capaId}/status`, { body: { status: "completed" } });
  const v = await api("POST", `/api/hse/capa/${capaId}/verify`, { body: {}, user: "u-qa" });
  assert.equal(v.data.item.Status, "verified");
});

test("حالا آزادسازی مجاز است", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/release`, {
    body: { dryRun: true }, user: "u-qa",
  });
  assert.equal(r.data.verdict.ok, true, JSON.stringify(r.data.verdict));
});

test("آزادسازی تخلف قفل فعالیت را برمی‌دارد", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/release`, { body: {}, user: "u-qa" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "closed");
  assert.equal(r.data.activityLock.isLocked, false, "قفل باید برداشته شود");

  const lock = await api("GET", `/api/hse/activity-lock/${ACT_A}${P}`);
  assert.equal(lock.data.storedFlag, false, "ستون فعالیت باید آزاد شده باشد");
  assert.equal(lock.data.inSync, true);
});

test("آزادسازی مهر زمانی و آزادکننده را روی آخرین بازبینی می‌نشاند", async () => {
  const r = await api("GET", `/api/hse/violation/${swoId}`);
  const last = r.data.closures.at(-1);
  assert.equal(last.AttemptNo, 2);
  assert.equal(last.ReleasedBy, "u-qa");
  assert.ok(last.ReleasedAt);
});

test("تخلف بسته دوباره آزاد نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/release`, { body: {}, user: "u-qa", raw: true });
  assert.equal(r.status, 409);
});

test("تخلف بسته بازبینی مجدد نمی‌پذیرد", async () => {
  const r = await api("POST", `/api/hse/violation/${swoId}/re-inspect`, {
    body: { isSatisfactory: true }, raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-VIOLATION-LOCKED");
});

/* ══════════════════════ ۷) قفل تجمعی و دامنه‌های گسترده ══════════════════════ */

test("دو تخلف روی یک فعالیت: بستن یکی قفل را برنمی‌دارد", async () => {
  const a = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-SWO-2", titleFa: "داربست بدون برچسب بازرسی",
      violationType: "unsafe_condition", severity: "high",
      isStopWork: true, stopWorkScope: "activity", activityId: ACT_B,
    },
  });
  const b = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-SWO-3", titleFa: "نبود نردهٔ حفاظ",
      violationType: "unsafe_condition", severity: "high",
      isStopWork: true, stopWorkScope: "activity", activityId: ACT_B,
    },
  });
  assert.equal(b.data.activityLock.blockingIds.length, 2);

  /* اولی را ابطال می‌کنیم؛ دومی هنوز باید قفل نگه دارد. */
  const v = await api("POST", `/api/hse/violation/${a.data.id}/void`, {
    body: { reasonFa: "برچسب موجود بود ولی دیده نشد" }, user: "u-qa",
  });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.data.activityLock.isLocked, true, "تخلف دوم هنوز فعالیت را قفل نگه می‌دارد");

  const lock = await api("GET", `/api/hse/activity-lock/${ACT_B}${P}`);
  assert.equal(lock.data.storedFlag, true);
  assert.equal(lock.data.blockingViolations.length, 1);
  assert.equal(lock.data.blockingViolations[0].violationNo, "V-SWO-3");
});

test("ابطال بدون دلیل رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/violation/${plainId}/void`, {
    body: {}, user: "u-qa", raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-VOID-REASON");
});

test("توقف در سطح منطقه فعالیت همان منطقه را می‌گیرد", async () => {
  const r = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-AREA", titleFa: "انبار مواد شیمیایی بدون تهویه",
      violationType: "environmental", severity: "high",
      isStopWork: true, stopWorkScope: "area", areaFa: "واحد ۲۰۰",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));

  /* فعالیت A در واحد ۲۰۰ است و مستقیم نام برده نشده، ولی باید قفل شود. */
  const lock = await api("GET", `/api/hse/activity-lock/${ACT_A}${P}`);
  assert.equal(lock.data.derived.isLocked, true, "توقف منطقه‌ای باید فعالیت را بگیرد");
  assert.match(lock.data.derived.reasonsFa.join(), /سطح منطقه/);

  /* فعالیت B در واحد ۳۰۰ است — نباید از این تخلف قفل شود. */
  const other = await api("GET", `/api/hse/activity-lock/${ACT_B}${P}`);
  assert.equal(other.data.blockingViolations.some((v) => v.violationNo === "V-AREA"), false);
});

/* ══════════════════════ ۸) بستن بازرسی ══════════════════════ */

test("ابطال یافته بدون دلیل رد می‌شود", async () => {
  const list = await api("GET", `/api/hse/inspection/${inspId}`);
  const second = list.data.findings.find((f) => f.FindingNo === 2);
  const r = await api("POST", `/api/hse/finding/${second.Id}/close`, {
    body: { status: "void" }, user: "u-site", raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-FINDING-VOID-REASON");
});

test("سرپرست کارگاه یافته را می‌بندد", async () => {
  const r = await api("POST", `/api/hse/finding/${findId}/close`, {
    body: { closureNoteFa: "کمربند ایمنی تهیه و استفاده شد" }, user: "u-site",
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "closed");
  assert.equal(r.data.item.ClosedBy, "u-site");
  assert.equal(r.data.summary.closed, 1);
});

test("یافتهٔ بسته دوباره بسته نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/finding/${findId}/close`, {
    body: {}, user: "u-site", raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-FINDING-LOCKED");
});

test("ابطال یافتهٔ دوم با دلیل", async () => {
  const list = await api("GET", `/api/hse/inspection/${inspId}`);
  const second = list.data.findings.find((f) => f.FindingNo === 2);
  const r = await api("POST", `/api/hse/finding/${second.Id}/close`, {
    body: { status: "void", closureNoteFa: "ضایعات متعلق به پیمانکار دیگری بود" },
    user: "u-site",
  });
  assert.equal(r.data.item.Status, "void");
  assert.equal(r.data.summary.open, 0);
  assert.equal(r.data.summary.closureRatePct, 100, "یافتهٔ باطل از مخرج بیرون است");
});

test("بازرسی با تخلف باز هنوز بسته نمی‌شود", async () => {
  const r = await api("POST", `/api/hse/inspection/${inspId}/close`, { body: { dryRun: true } });
  assert.equal(r.data.verdict.ok, false);
  assert.match(r.data.verdict.blockersFa.join(), /تخلف صادرشده/);
});

test("بستن تخلف باقی‌مانده و سپس بستن بازرسی", async () => {
  await api("POST", `/api/hse/violation/${plainId}/re-inspect`, {
    body: { isSatisfactory: true, evidenceFa: "مسیر تردد پاک شد" },
  });
  const rel = await api("POST", `/api/hse/violation/${plainId}/release`, { body: {}, user: "u-qa" });
  assert.equal(rel.ok, true, JSON.stringify(rel));

  const r = await api("POST", `/api/hse/inspection/${inspId}/close`, { body: { scorePct: 72 } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "closed");
  assert.equal(r.data.item.FindingsCount, 2);
  assert.equal(r.data.item.ClosedFindings, 1);
  assert.match(r.data.verdict.warningsFa.join(), /زیر حد قبولی/);
});

test("بازرسی بسته یافتهٔ تازه نمی‌پذیرد", async () => {
  const r = await api("POST", `/api/hse/inspection/${inspId}/finding`, {
    body: { descriptionFa: "دیرهنگام", category: "ppe", severity: "low" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-INSPECTION-LOCKED");
});

/* ══════════════════════ ۹) خلاصه و RBAC ══════════════════════ */

test("خلاصهٔ پروژه توقف کار فعال و متخلف تکراری را می‌دهد", async () => {
  const r = await api("GET", `/api/hse/violation${P}`);
  const s = r.data.summary;
  assert.equal(s.total, 5);
  assert.equal(s.stopWorkTotal, 4);
  assert.ok(s.stopWorkActive >= 1, "دست‌کم یک توقف فعال مانده");
  assert.match(s.warningsFa.join(), /توقف کار فعال/);
});

test("تخلف ناموجود ۴۰۴ می‌دهد", async () => {
  const r = await api("GET", "/api/hse/violation/no-such-violation", { raw: true });
  assert.equal(r.status, 404);
});

test("فعالیت ناموجود در استعلام قفل ۴۰۴ می‌دهد", async () => {
  const r = await api("GET", `/api/hse/activity-lock/no-such-activity${P}`, { raw: true });
  assert.equal(r.status, 404);
});

test("کاربر بدون مجوز به تخلفات دسترسی ندارد", async () => {
  const r = await api("GET", `/api/hse/violation${P}`, { user: "u-doc", raw: true });
  assert.equal(r.status, 403);
});

test("کاربر ناشناس رد می‌شود", async () => {
  const r = await api("GET", `/api/hse/violation${P}`, { user: "no-such-user", raw: true });
  assert.ok(r.status === 401 || r.status === 403, `status=${r.status}`);
});

/* ══════════ ۱۰) یکپارچگی با دروازهٔ RFSU (یافتهٔ لوپ ۱۰) ══════════ */

test("دستور توقف کار فعال روی سیستم مانع RFSU است", async () => {
  const before = await api("GET", `/api/hse/rfsu-clearance/SYS-77${P}`, { user: "u-hse" });
  assert.equal(before.ok, true, JSON.stringify(before));
  assert.equal(before.data.clearance.ok, true, "سیستم پاک باید مجوز بگیرد");
  assert.equal(before.data.clearance.activeStopWorkOrders, 0);

  const swo = await api("POST", `/api/hse/violation${P}`, {
    body: {
      violationNo: "V-RFSU", titleFa: "کار روی خط برق‌دار بدون قطع اضطراری",
      violationType: "unsafe_act", severity: "critical",
      isStopWork: true, stopWorkScope: "system", systemId: "SYS-77",
    },
  });
  assert.equal(swo.ok, true, JSON.stringify(swo));

  const after = await api("GET", `/api/hse/rfsu-clearance/SYS-77${P}`, { user: "u-hse" });
  assert.equal(after.data.clearance.ok, false, "سیستم با توقف کار نباید RFSU بگیرد");
  assert.equal(after.data.clearance.activeStopWorkOrders, 1);
  assert.match(after.data.clearance.blockersFa.join(), /توقف کار فعال/);
  assert.equal(after.data.blockingStopWork.length, 1);
  assert.equal(after.data.blockingStopWork[0].violationNo, "V-RFSU");
  assert.equal(after.data.blockingStopWork[0].scopeFa, "سیستم");
});

test("سیستم دیگر از این توقف کار متأثر نمی‌شود", async () => {
  const r = await api("GET", `/api/hse/rfsu-clearance/SYS-88${P}`, { user: "u-hse" });
  assert.equal(r.data.clearance.activeStopWorkOrders, 0);
  assert.equal(r.data.blockingStopWork.length, 0);
});

test("استعلام قفل فعالیت دستورهای بی‌اثر را گزارش می‌کند", async () => {
  const r = await api("GET", `/api/hse/activity-lock/${ACT_A}${P}`);
  assert.ok(Array.isArray(r.data.unenforceableFa), "میدان گزارش دستور بی‌اثر باید باشد");
});

/* ══════════ ۱۱) تفکیک خواندن از صدور (یافتهٔ لوپ ۶ پنل UI) ══════════
 *
 * پیش از این، هر چهار مسیر خواندنِ تخلف مجوز `hse.violation.issue`
 * می‌خواستند. نتیجه‌اش این بود که مدیر تضمین کیفیت — تنها نقشی که
 * اجازهٔ آزادسازی دارد — نمی‌توانست تخلفی را که قرار بود آزاد کند
 * حتی فهرست کند، و مدیر پروژه از توقف کارِ پروژهٔ خودش بی‌خبر می‌ماند.
 */

test("مدیر تضمین کیفیت فهرست تخلفات را می‌بیند بدون اختیار صدور", async () => {
  const list = await api("GET", `/api/hse/violation${P}`, { user: "u-qa" });
  assert.equal(list.ok, true, `qa باید فهرست را ببیند: ${JSON.stringify(list)}`);
  assert.ok(Array.isArray(list.data.items));

  /* دیدن اجازهٔ صدور نمی‌آورد — تفکیک وظیفه باید سر جایش بماند. */
  const issue = await api("POST", `/api/hse/violation${P}`, {
    user: "u-qa",
    body: { violationNo: "V-QA-X", titleFa: "تلاش صدور توسط تضمین کیفیت", violationType: "housekeeping", severity: "low" },
    raw: true,
  });
  assert.equal(issue.status, 403, "تضمین کیفیت نباید تخلف صادر کند");
});

test("مدیر پروژه دستور توقف کار پروژهٔ خود را می‌بیند", async () => {
  const r = await api("GET", `/api/hse/violation${P}&stopWork=1`, { user: "u-pm" });
  assert.equal(r.ok, true, `pm باید توقف کار را ببیند: ${JSON.stringify(r)}`);
  assert.ok(typeof r.data.summary.stopWorkActive === "number");
});

test("نقش بی‌ربط همچنان از خواندن تخلف محروم است", async () => {
  const r = await api("GET", `/api/hse/violation${P}`, { user: "u-planner", raw: true });
  assert.equal(r.status, 403, "کارشناس برنامه‌ریزی نباید تخلفات را ببیند");
});

test("واژگان و قفل فعالیت هم با مجوز خواندن در دسترس‌اند", async () => {
  const vocab = await api("GET", "/api/hse/violation-vocab", { user: "u-qa" });
  assert.equal(vocab.ok, true, "qa باید واژگان را بخواند");
  const lock = await api("GET", `/api/hse/activity-lock/${ACT_A}${P}`, { user: "u-qa" });
  assert.equal(lock.ok, true, "qa باید وضعیت قفل را بخواند");
});

test("سرپرست کارگاه تخلف خود را می‌بیند ولی صادر و آزاد نمی‌کند", async () => {
  const list = await api("GET", `/api/hse/violation${P}`, { user: "u-site" });
  assert.equal(list.ok, true, `سرپرست باید فهرست را ببیند: ${JSON.stringify(list)}`);

  const issue = await api("POST", `/api/hse/violation${P}`, {
    user: "u-site",
    body: { violationNo: "V-SITE-X", titleFa: "تلاش صدور توسط سرپرست", violationType: "housekeeping", severity: "low" },
    raw: true,
  });
  assert.equal(issue.status, 403, "سرپرست نباید تخلف صادر کند");

  const rel = await api("POST", `/api/hse/violation/whatever/release${P}`, { user: "u-site", body: {}, raw: true });
  assert.equal(rel.status, 403, "سرپرست نباید تخلف آزاد کند");
});
