/**
 * آزمون یکپارچهٔ لایهٔ REST — MOD-08 / HSE، تحویلی D7.
 *
 * چرخهٔ کامل: عامل زیان‌آور ← جلسهٔ آموزش ← حاضر ← گواهی خودکار ←
 * تحویل تجهیزات ← معاینهٔ طب کار ← دروازهٔ ورود ← پسماند ← پایش.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";

const PORT = 4723;
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

const PID = "trn-p1";
const P = `?projectId=${PID}`;

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "hse-trn-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${BASE}/api/hse/training-vocab`, { headers: { "x-user-id": "u-hse" } });
      if (r.status < 500) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("سرور بالا نیامد");
});

after(async () => {
  child?.kill("SIGKILL");
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

/* ══════════════ ۱) واژگان ══════════════ */

test("واژگان همهٔ فهرست‌ها را می‌دهد", async () => {
  const r = await api("GET", "/api/hse/training-vocab");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.trainingTypes.length, 5);
  assert.equal(r.data.ppeTypes.length, 9);
  assert.equal(r.data.wasteTypes.length, 5);
  assert.equal(r.data.expiryWarningDays, 30);
  /* راهنمای الزام باید از سرور بیاید نه هاردکد در UI. */
  const hazardous = r.data.wasteTypes.find((w) => w.code === "hazardous");
  assert.equal(hazardous.needsManifest, true);
  const helmet = r.data.ppeTypes.find((p) => p.code === "helmet");
  assert.equal(helmet.isCritical, true);
});

/* ══════════════ ۲) عامل زیان‌آور ══════════════ */

test("ثبت عامل زیان‌آور شغلی", async () => {
  const r = await api("POST", `/api/hse/health/hazard${P}`, {
    user: "u-hr",
    body: {
      hazardCode: "FUME", titleFa: "دود جوشکاری", hazardType: "chemical",
      tradeCode: "WLD", examIntervalMonths: 6, requiredExamsFa: "اسپیرومتری",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.ExamIntervalMonths, 6);
});

test("عامل زیان‌آور با فاصلهٔ صفر رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/health/hazard${P}`, {
    user: "u-hr",
    body: { hazardCode: "BAD", hazardType: "noise", examIntervalMonths: 0 },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-HAZARD-INTERVAL");
});

/* ══════════════ ۳) جلسهٔ آموزش و گواهی خودکار ══════════════ */

let inductionSessionId;
let specialistSessionId;

test("ثبت جلسهٔ آموزش بدو ورود", async () => {
  const r = await api("POST", `/api/hse/training/session${P}`, {
    body: {
      sessionNo: "TRN-001", titleFa: "آموزش بدو ورود به کارگاه",
      courseCode: "HSE-IND", trainingType: "induction",
      heldAt: "2026-08-01T08:00:00.000Z", durationMinutes: 240,
      instructorFa: "مهندس رضایی", validityMonths: 24,
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  inductionSessionId = r.data.id;
  assert.equal(r.data.state.certificateExpiry, "2028-08-01");
});

test("جلسهٔ تکراری رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/training/session${P}`, {
    body: {
      sessionNo: "TRN-001", titleFa: "تکراری", courseCode: "X",
      trainingType: "toolbox", heldAt: "2026-08-01T08:00:00.000Z",
      durationMinutes: 30, instructorFa: "الف",
    },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-SESSION");
});

test("جلسه با نوع نامعتبر رد می‌شود و همهٔ ایرادها را می‌دهد", async () => {
  const r = await api("POST", `/api/hse/training/session${P}`, {
    body: {
      sessionNo: "TRN-BAD", titleFa: "", courseCode: "",
      trainingType: "workshop", heldAt: "بد", durationMinutes: -1, instructorFa: "",
    },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.ok(r.json.error.detailsFa.length >= 5, "فهرست کامل ایرادها باید برگردد");
});

test("افزودن حاضر قبول‌شده گواهی می‌سازد", async () => {
  const r = await api("POST", `/api/hse/training/session/${inductionSessionId}/attendee${P}`, {
    body: { personRef: "w-100", personNameFa: "علی احمدی", tradeCode: "WLD", scorePct: 85 },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.data.certificate, "گواهی باید ساخته شود");
  assert.equal(r.data.certificate.CourseCode, "HSE-IND");
  assert.equal(r.data.certificate.ExpiresAt, "2028-08-01");
  assert.equal(r.data.certificate.Status, "valid");
});

test("حاضر غایب گواهی نمی‌گیرد", async () => {
  const r = await api("POST", `/api/hse/training/session/${inductionSessionId}/attendee${P}`, {
    body: { personRef: "w-200", personNameFa: "رضا کریمی", attended: false },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.certificate, null, "غایب نباید گواهی بگیرد");
});

test("حاضر مردود گواهی نمی‌گیرد", async () => {
  const r = await api("POST", `/api/hse/training/session/${inductionSessionId}/attendee${P}`, {
    body: { personRef: "w-300", personNameFa: "حسن نوری", attended: true, passed: false, scorePct: 30 },
  });
  assert.equal(r.data.certificate, null, "مردود نباید گواهی بگیرد");
});

test("حاضر تکراری در همان جلسه رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/training/session/${inductionSessionId}/attendee${P}`, {
    body: { personRef: "w-100", personNameFa: "علی احمدی" },
    raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-DUP-ATTENDEE");
});

test("فهرست جلسات، نرخ حضور و قبولی را درست می‌دهد", async () => {
  const r = await api("GET", `/api/hse/training/session${P}`);
  assert.equal(r.ok, true);
  const s = r.data.items.find((x) => x.SessionNo === "TRN-001");
  assert.equal(s.state.registered, 3);
  assert.equal(s.state.attended, 2, "یکی غایب بود");
  assert.equal(s.state.passed, 1, "یکی مردود شد");
  assert.equal(s.state.attendanceRatePct, 66.67);
  assert.equal(s.state.passRatePct, 50, "قبولی روی حاضران");
});

test("نفرساعت آموزش در خلاصه از حاضران واقعی است", async () => {
  const r = await api("GET", `/api/hse/training/session${P}`);
  /* ۲ حاضر × ۴ ساعت = ۸ نفرساعت. غایب شمرده نمی‌شود. */
  assert.equal(r.data.summary.totalManHours, 8);
  assert.equal(r.data.summary.uniquePersons, 3);
});

test("ماتریس آموزش فرد، بدو ورود معتبر را می‌بیند", async () => {
  const r = await api("GET", `/api/hse/training/person/w-100${P}`);
  assert.equal(r.data.matrix.hasInduction, true);
  assert.equal(r.data.matrix.isCleared, true);
});

test("فردی که مردود شده بدو ورود ندارد", async () => {
  const r = await api("GET", `/api/hse/training/person/w-300${P}`);
  assert.equal(r.data.matrix.hasInduction, false);
  assert.match(r.data.matrix.blockersFa.join(), /بدو ورود/);
});

/* ══════════════ ۴) تجهیزات حفاظت فردی ══════════════ */

test("تحویل تجهیز حیاتی ثبت می‌شود", async () => {
  const r = await api("POST", `/api/hse/ppe${P}`, {
    body: {
      issueNo: "PPE-001", personRef: "w-100", personNameFa: "علی احمدی",
      ppeType: "helmet", quantity: 1, unitCost: 350000,
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.isCritical, true);
});

test("هارنس بدون تاریخ تعویض رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/ppe${P}`, {
    body: { issueNo: "PPE-BAD", personRef: "w-100", personNameFa: "علی", ppeType: "harness", quantity: 1 },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-PPE-REPLACE-REQUIRED");
});

test("هارنس با تاریخ تعویض پذیرفته می‌شود", async () => {
  const r = await api("POST", `/api/hse/ppe${P}`, {
    body: {
      issueNo: "PPE-002", personRef: "w-100", personNameFa: "علی احمدی",
      ppeType: "harness", quantity: 1, replaceDueDate: "2027-08-01", serialNo: "HN-9931",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("بازگرداندن تجهیز وضعیتش را عوض می‌کند", async () => {
  const list = await api("GET", `/api/hse/ppe${P}`);
  const helmet = list.data.items.find((i) => i.IssueNo === "PPE-001");
  const r = await api("POST", `/api/hse/ppe/${helmet.Id}/return${P}`, { body: { status: "damaged" } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "damaged");
  assert.ok(r.data.item.ReturnedAt);
});

test("تجهیز تعیین‌تکلیف‌شده دوباره بازگردانده نمی‌شود", async () => {
  const list = await api("GET", `/api/hse/ppe${P}`);
  const helmet = list.data.items.find((i) => i.IssueNo === "PPE-001");
  const r = await api("POST", `/api/hse/ppe/${helmet.Id}/return${P}`, { body: {}, raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-PPE-LOCKED");
});

test("هزینهٔ تجهیزات در خلاصه جمع می‌شود", async () => {
  const r = await api("GET", `/api/hse/ppe${P}`);
  assert.ok(r.data.summary.totalPpeCost >= 350000);
});

/* ══════════════ ۵) طب کار ══════════════ */

test("ثبت معاینهٔ بدو استخدام", async () => {
  const r = await api("POST", `/api/hse/health/exam${P}`, {
    user: "u-hr",
    body: {
      examNo: "MED-001", personRef: "w-100", personNameFa: "علی احمدی",
      examType: "pre_employment", examinedAt: "2026-08-05", fitness: "fit",
      hazardCode: "FUME", physicianFa: "دکتر مرادی",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  /* فاصلهٔ ۶ ماههٔ عامل FUME باید تاریخ بعدی را بسازد. */
  assert.equal(r.data.item.NextExamDate, "2027-02-05", "تاریخ بعدی از فاصلهٔ عامل زیان‌آور");
});

test("معاینهٔ مشروط بدون شرح محدودیت رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/health/exam${P}`, {
    user: "u-hr",
    body: {
      examNo: "MED-BAD", personRef: "w-200", personNameFa: "رضا کریمی",
      examType: "periodic", examinedAt: "2026-08-05", fitness: "fit_with_restriction",
    },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-EXAM-RESTRICTION-REQUIRED");
});

test("معاینهٔ جدید، معاینهٔ قبلیِ همان نوع را جایگزین می‌کند", async () => {
  const first = await api("POST", `/api/hse/health/exam${P}`, {
    user: "u-hr",
    body: {
      examNo: "MED-010", personRef: "w-900", personNameFa: "کارگر نهصد",
      examType: "periodic", examinedAt: "2026-01-10", fitness: "unfit",
    },
  });
  assert.equal(first.ok, true, JSON.stringify(first));

  const second = await api("POST", `/api/hse/health/exam${P}`, {
    user: "u-hr",
    body: {
      examNo: "MED-011", personRef: "w-900", personNameFa: "کارگر نهصد",
      examType: "periodic", examinedAt: "2026-08-10", fitness: "fit",
    },
  });
  assert.equal(second.data.supersededCount, 1, "معاینهٔ قبلی باید جایگزین شود");

  /* آمار نباید یک نفر را دو بار بشمارد. */
  const state = await api("GET", `/api/hse/health/person/w-900${P}`, { user: "u-hr" });
  assert.equal(state.data.state.fitness, "fit", "آخرین معاینه ملاک است");
});

test("وضعیت سلامت فردِ بدون معاینه مسدود است", async () => {
  const r = await api("GET", `/api/hse/health/person/w-777${P}`, { user: "u-hr" });
  assert.equal(r.data.state.isCleared, false);
  assert.match(r.data.state.blockersFa.join(), /هیچ معاینهٔ طب کاری/);
});

/* ══════════════ ۶) دروازهٔ ورود ══════════════ */

test("فرد کامل مجوز ورود می‌گیرد", async () => {
  const r = await api("GET", `/api/hse/clearance/w-100${P}&ppe=helmet`, { user: "u-site" });
  assert.equal(r.ok, true, JSON.stringify(r));
  /* کلاه ایمنی «آسیب‌دیده» شده، پس تجهیزات باید بیفتد. */
  assert.equal(r.data.clearance.training.ok, true, "آموزش باید سبز باشد");
  assert.equal(r.data.clearance.health.ok, true, "سلامت باید سبز باشد");
  assert.equal(r.data.clearance.ppe.ok, false, "کلاه آسیب‌دیده دیگر در اختیار او نیست");
  assert.equal(r.data.clearance.ok, false, "شکست یک بُعد کل دروازه را می‌بندد");
});

test("دروازه بدون الزام تجهیز، فقط آموزش و سلامت را می‌سنجد", async () => {
  const r = await api("GET", `/api/hse/clearance/w-100${P}`, { user: "u-site" });
  assert.equal(r.data.clearance.ok, true, JSON.stringify(r.data.clearance.blockersFa));
});

test("فرد مردود در آموزش، دروازه را رد نمی‌کند", async () => {
  const r = await api("GET", `/api/hse/clearance/w-300${P}`, { user: "u-site" });
  assert.equal(r.data.clearance.ok, false);
  assert.match(r.data.clearance.blockersFa.join(), /آموزش:/);
});

test("مانع‌های دروازه با پیشوند دامنه برمی‌گردند", async () => {
  const r = await api("GET", `/api/hse/clearance/w-555${P}&ppe=helmet`, { user: "u-site" });
  const j = r.data.clearance.blockersFa.join();
  assert.match(j, /آموزش:/);
  assert.match(j, /تجهیزات:/);
  assert.match(j, /سلامت:/);
});

/* ══════════════ ۷) پسماند ══════════════ */

test("پسماند خطرناک بدون مانیفست رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/waste${P}`, {
    body: {
      wasteNo: "WST-BAD", wasteType: "hazardous", descriptionFa: "روغن سوخته",
      quantity: 200, unit: "liter", disposalMethod: "licensed_contractor",
    },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-WASTE-MANIFEST-REQUIRED");
});

test("پسماند خطرناک با مانیفست پذیرفته می‌شود", async () => {
  const r = await api("POST", `/api/hse/waste${P}`, {
    body: {
      wasteNo: "WST-001", wasteType: "hazardous", descriptionFa: "روغن سوخته",
      quantity: 200, unit: "liter", disposalMethod: "licensed_contractor",
      manifestNo: "MF-4471", generatedAt: "2026-09-01",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.state.isCompliant, true);
});

test("پسماند عادی بدون مانیفست پذیرفته می‌شود", async () => {
  const r = await api("POST", `/api/hse/waste${P}`, {
    body: {
      wasteNo: "WST-002", wasteType: "construction", descriptionFa: "نخالهٔ بتنی",
      quantity: 40, unit: "ton", disposalMethod: "landfill", generatedAt: "2026-09-02",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("حمل بدون نام حمل‌کننده رد می‌شود", async () => {
  const list = await api("GET", `/api/hse/waste${P}`);
  const w = list.data.items.find((x) => x.WasteNo === "WST-001");
  const r = await api("POST", `/api/hse/waste/${w.Id}/status${P}`, {
    body: { status: "in_transit" }, raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-WASTE-CARRIER-REQUIRED");
});

test("دفع پسماند تاریخ دفع را خودکار می‌گذارد", async () => {
  const list = await api("GET", `/api/hse/waste${P}`);
  const w = list.data.items.find((x) => x.WasteNo === "WST-002");
  const r = await api("POST", `/api/hse/waste/${w.Id}/status${P}`, { body: { status: "disposed" } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.data.item.DisposedAt, "تاریخ دفع نباید خالی بماند");
  assert.equal(r.data.state.isCompliant, true);
});

test("خلاصهٔ پسماند مقادیر را به تفکیک واحد نگه می‌دارد", async () => {
  const r = await api("GET", `/api/hse/waste${P}`);
  assert.equal(r.data.summary.quantityByUnit.liter, 200);
  assert.equal(r.data.summary.quantityByUnit.ton, 40);
  assert.equal(r.data.summary.missingManifest, 0);
});

/* ══════════════ ۸) پایش زیست‌محیطی ══════════════ */

test("اندازه‌گیری زیر حد ثبت می‌شود", async () => {
  const r = await api("POST", `/api/hse/env/reading${P}`, {
    body: {
      readingNo: "ENV-001", medium: "effluent", parameterFa: "COD",
      measuredValue: 80, limitValue: 100, unit: "mg/l",
      measuredAt: "2026-09-01T10:00:00.000Z",
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.state.isExceeded, false);
});

test("اندازه‌گیری فراتر از حد نیازمند اقدام است", async () => {
  const r = await api("POST", `/api/hse/env/reading${P}`, {
    body: {
      readingNo: "ENV-002", medium: "effluent", parameterFa: "روغن و گریس",
      measuredValue: 30, limitValue: 10, unit: "mg/l",
      measuredAt: "2026-09-03T10:00:00.000Z",
    },
  });
  assert.equal(r.data.state.isExceeded, true);
  assert.equal(r.data.state.exceedancePct, 200);
  assert.equal(r.data.state.needsAction, true);
});

test("اقدام اصلاحی روی اندازه‌گیری منطبق رد می‌شود", async () => {
  const list = await api("GET", `/api/hse/env/reading${P}`);
  const ok = list.data.items.find((x) => x.ReadingNo === "ENV-001");
  const r = await api("POST", `/api/hse/env/reading/${ok.Id}/action${P}`, {
    body: { correctiveActionFa: "بی‌مورد" }, raw: true,
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "E-HSE-ENV-NOT-EXCEEDED");
});

test("اقدام اصلاحی روی تجاوز ثبت و وضعیت را تأیید می‌کند", async () => {
  const list = await api("GET", `/api/hse/env/reading${P}`);
  const bad = list.data.items.find((x) => x.ReadingNo === "ENV-002");
  const r = await api("POST", `/api/hse/env/reading/${bad.Id}/action${P}`, {
    body: { correctiveActionFa: "تعویض فیلتر واحد تصفیه و نمونه‌گیری مجدد" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.state.needsAction, false);
  assert.equal(r.data.item.Status, "verified");
});

test("خلاصهٔ پایش نرخ انطباق را می‌دهد", async () => {
  const r = await api("GET", `/api/hse/env/reading${P}`);
  assert.equal(r.data.summary.total, 2);
  assert.equal(r.data.summary.exceeded, 1);
  assert.equal(r.data.summary.complianceRatePct, 50);
  assert.equal(r.data.summary.exceededWithoutAction, 0, "اقدام ثبت شد");
});

/* ══════════════ ۹) تفکیک وظیفه و دسترسی ══════════════ */

test("افسر ایمنی نمی‌تواند پروندهٔ پزشکی ثبت کند", async () => {
  /* ثبت معاینه سطح «سری» دارد و کار پزشک/منابع انسانی است. */
  const r = await api("POST", `/api/hse/health/exam${P}`, {
    user: "u-hse",
    body: {
      examNo: "MED-X", personRef: "w-1", personNameFa: "کسی",
      examType: "periodic", examinedAt: "2026-09-01", fitness: "fit",
    },
    raw: true,
  });
  assert.equal(r.status, 403, "افسر ایمنی نباید پروندهٔ پزشکی بنویسد");
});

test("منابع انسانی نمی‌تواند جلسهٔ آموزش بسازد", async () => {
  /* منبع حقیقتِ آموزش، ماژول ایمنی است؛ منابع انسانی فقط می‌خواند. */
  const r = await api("POST", `/api/hse/training/session${P}`, {
    user: "u-hr",
    body: {
      sessionNo: "TRN-HR", titleFa: "x", courseCode: "C", trainingType: "toolbox",
      heldAt: "2026-09-01T08:00:00.000Z", durationMinutes: 30, instructorFa: "الف",
    },
    raw: true,
  });
  assert.equal(r.status, 403);
});

test("منابع انسانی سوابق آموزش را می‌خواند", async () => {
  const r = await api("GET", `/api/hse/training/person/w-100${P}`, { user: "u-hr" });
  assert.equal(r.ok, true, "گیت hseTraining باید بتواند بخواند");
  assert.equal(r.data.matrix.hasInduction, true);
});

test("سرپرست کارگاه دروازه را استعلام می‌کند ولی پروندهٔ پزشکی نمی‌بیند", async () => {
  const clr = await api("GET", `/api/hse/clearance/w-100${P}`, { user: "u-site" });
  assert.equal(clr.ok, true, "سرپرست باید دروازه را ببیند");

  const med = await api("GET", `/api/hse/health/person/w-100${P}`, { user: "u-site", raw: true });
  assert.equal(med.status, 403, "سرپرست نباید پروندهٔ پزشکی ببیند");
});

test("کارشناس برنامه‌ریزی به هیچ‌کدام دسترسی ندارد", async () => {
  for (const path of [
    `/api/hse/training/session${P}`,
    `/api/hse/ppe${P}`,
    `/api/hse/waste${P}`,
    `/api/hse/clearance/w-100${P}`,
  ]) {
    const r = await api("GET", path, { user: "u-planner", raw: true });
    assert.equal(r.status, 403, `${path} نباید باز باشد`);
  }
});

test("کاربر ناشناس ۴۰۱ می‌گیرد", async () => {
  const r = await api("GET", `/api/hse/training/session${P}`, { user: "no-such-user", raw: true });
  assert.ok(r.status === 401 || r.status === 403, `status=${r.status}`);
});

/* ══════════════ ۱۰) نشت میان پروژه‌ها ══════════════ */

test("دادهٔ پروژهٔ دیگر در این پروژه دیده نمی‌شود", async () => {
  await api("POST", "/api/hse/waste?projectId=other-p", {
    body: {
      wasteNo: "WST-OTHER", wasteType: "construction", descriptionFa: "نخالهٔ پروژهٔ دیگر",
      quantity: 999, unit: "ton", disposalMethod: "landfill",
    },
  });
  const mine = await api("GET", `/api/hse/waste${P}`);
  assert.ok(!mine.data.items.some((x) => x.WasteNo === "WST-OTHER"), "نشت میان پروژه‌ها");
  assert.equal(mine.data.summary.quantityByUnit.ton, 40, "مقدار پروژهٔ دیگر نباید جمع شود");
});

test("دروازهٔ ورود در پروژهٔ دیگر سوابق این پروژه را نمی‌بیند", async () => {
  const r = await api("GET", "/api/hse/clearance/w-100?projectId=other-p", { user: "u-site" });
  assert.equal(r.data.clearance.training.ok, false, "گواهی پروژهٔ دیگر نباید معتبر باشد");
});

/* ══════════════ ۱۱) رگرسیون: یافته‌های ۱۰ لوپ خودارزیابی ══════════════ */

test("لوپ ۵ — نمرهٔ بیرون از بازهٔ صفر تا صد رد می‌شود", async () => {
  const r = await api("POST", `/api/hse/training/session/${inductionSessionId}/attendee${P}`, {
    body: { personRef: "w-loop5", personNameFa: "آزمون نمره", scorePct: 500 },
    raw: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "E-HSE-ATTENDEE-SCORE");
});

test("لوپ ۵ — حاضر جلسهٔ برنامه‌ریزی‌شده گواهی نمی‌گیرد", async () => {
  const s = await api("POST", `/api/hse/training/session${P}`, {
    body: {
      sessionNo: "TRN-PLANNED", titleFa: "دورهٔ آینده", courseCode: "HSE-FUT",
      trainingType: "refresher", heldAt: "2026-12-01T08:00:00.000Z",
      durationMinutes: 120, instructorFa: "الف", validityMonths: 12, status: "planned",
    },
  });
  const a = await api("POST", `/api/hse/training/session/${s.data.id}/attendee${P}`, {
    body: { personRef: "w-future", personNameFa: "کارگر آینده", scorePct: 100 },
  });
  /* گواهی برای دوره‌ای که هنوز برگزار نشده = دروازهٔ باز به آینده. */
  assert.equal(a.data.certificate, null);
});

test("لوپ ۳ — معاینهٔ جایگزین‌شده دوباره جایگزین نمی‌شود", async () => {
  for (const [no, at] of [["MED-L1", "2026-02-01"], ["MED-L2", "2026-03-01"], ["MED-L3", "2026-04-01"]]) {
    await api("POST", `/api/hse/health/exam${P}`, {
      user: "u-hr",
      body: {
        examNo: no, personRef: "w-loop3", personNameFa: "آزمون لوپ سه",
        examType: "periodic", examinedAt: at, fitness: "fit",
      },
    });
  }
  const last = await api("POST", `/api/hse/health/exam${P}`, {
    user: "u-hr",
    body: {
      examNo: "MED-L4", personRef: "w-loop3", personNameFa: "آزمون لوپ سه",
      examType: "periodic", examinedAt: "2026-05-01", fitness: "fit",
    },
  });
  /* فقط یک معاینهٔ فعال باقی مانده بود، پس فقط یکی جایگزین می‌شود. */
  assert.equal(last.data.supersededCount, 1, "تاریخچه نباید دوباره نوشته شود");
});

test("لوپ ۸ — پسماند پروژهٔ دیگر در سیاههٔ نامنطبق این پروژه نیست", async () => {
  const mine = await api("GET", `/api/hse/waste${P}`);
  const other = mine.data.summary.nonCompliantFa ?? [];
  assert.ok(!other.some((x) => String(x).includes("WST-OTHER")), "نشت در فهرست نامنطبق");
});

test("لوپ ۶ — نام فرد غیرمجاز بدون مجوز پزشکی فاش نمی‌شود", async () => {
  await api("POST", `/api/hse/health/exam${P}`, {
    user: "u-hr",
    body: {
      examNo: "MED-L6", personRef: "w-loop6", personNameFa: "کارگر محرمانه",
      examType: "periodic", examinedAt: "2026-08-01", fitness: "unfit",
    },
  });
  await api("POST", `/api/hse/ppe${P}`, {
    body: { issueNo: "PPE-L6", personRef: "w-loop6", personNameFa: "کارگر محرمانه", ppeType: "gloves", quantity: 1 },
  });

  /* افسر ایمنی مجوز hse.health.view دارد، پس نام را می‌بیند. */
  const officer = await api("GET", `/api/hse/ppe${P}`, { user: "u-hse" });
  assert.ok(officer.data.summary.unfitPersons.includes("کارگر محرمانه"), "افسر ایمنی باید ببیند");
  assert.ok(officer.data.summary.warningsFa.some((w) => /غیرمجاز/.test(w)));

  /* سرپرست کارگاه hse.ppe.view دارد ولی hse.health.view ندارد. */
  const site = await api("GET", `/api/hse/ppe${P}`, { user: "u-site" });
  assert.equal(site.ok, true, "سرپرست باید فهرست تجهیزات را ببیند");
  assert.deepEqual(site.data.summary.unfitPersons, [], "نام نباید فاش شود");
  assert.ok(!site.data.summary.warningsFa.some((w) => /غیرمجاز/.test(w)), "هشدار پزشکی نباید برسد");

  /* شمارش می‌ماند چون برای برنامه‌ریزی تجهیزات لازم است. */
  assert.ok(site.data.summary.byFitness.unfit >= 1, "شمارش بی‌نام باید بماند");
  assert.ok(officer.data.summary.byFitness.unfit >= 1);
});

test("لوپ ۶ — سرپرست کارگاه نمی‌تواند تجهیز تحویل دهد", async () => {
  const r = await api("POST", `/api/hse/ppe${P}`, {
    user: "u-site",
    body: { issueNo: "PPE-L6B", personRef: "w-1", personNameFa: "ی", ppeType: "gloves", quantity: 1 },
    raw: true,
  });
  assert.equal(r.status, 403, "خواندن نباید اختیار نوشتن بدهد");
});

test("لوپ ۸ — ردیف پروژهٔ دیگر با شناسهٔ مستقیم تغییر نمی‌کند", async () => {
  const mine = await api("GET", `/api/hse/waste${P}`);
  const row = mine.data.items.find((x) => x.WasteNo === "WST-001");

  const hijack = await api("POST", `/api/hse/waste/${row.Id}/status?projectId=other-p`, {
    body: { status: "rejected" }, raw: true,
  });
  assert.equal(hijack.status, 404, "ردیف پروژهٔ دیگر نباید قابل دسترس باشد");

  const after = await api("GET", `/api/hse/waste${P}`);
  const same = after.data.items.find((x) => x.WasteNo === "WST-001");
  assert.notEqual(same.Status, "rejected", "وضعیت نباید عوض شده باشد");
});

test("لوپ ۸ — جلسهٔ پروژهٔ دیگر حاضر نمی‌پذیرد", async () => {
  const r = await api("POST", `/api/hse/training/session/${inductionSessionId}/attendee?projectId=other-p`, {
    body: { personRef: "w-hijack", personNameFa: "نفوذی" },
    raw: true,
  });
  assert.equal(r.status, 404);
});

test("لوپ ۸ — تجهیز و اندازه‌گیری پروژهٔ دیگر محافظت‌شده‌اند", async () => {
  const ppeList = await api("GET", `/api/hse/ppe${P}`);
  const item = ppeList.data.items.find((x) => x.IssueNo === "PPE-002");
  const a = await api("POST", `/api/hse/ppe/${item.Id}/return?projectId=other-p`, { body: {}, raw: true });
  assert.equal(a.status, 404);

  const envList = await api("GET", `/api/hse/env/reading${P}`);
  const reading = envList.data.items.find((x) => x.ReadingNo === "ENV-002");
  const b = await api("POST", `/api/hse/env/reading/${reading.Id}/action?projectId=other-p`, {
    body: { correctiveActionFa: "نفوذ" }, raw: true,
  });
  assert.equal(b.status, 404);
});
