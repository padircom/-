import test from "node:test";
import assert from "node:assert/strict";
import { SCHEMA, MIGRATIONS } from "./sqlLogic.js";
import {
  GAS_LIMITS,
  GAS_TEST_VALIDITY_MINUTES,
  GAS_TEST_REQUIRED_PERMITS,
  ISOLATION_REQUIRED_PERMITS,
  ISOLATION_TYPES,
  ISOLATION_TYPE_FA,
  ISOLATION_STATUS_FA,
  APPROVAL_LEVELS,
  APPROVAL_LEVEL_FA,
  evaluateGasTest,
  latestGasTest,
  isolationState,
  approvalChain,
  canSignPermit,
  precautionState,
  canIssuePermit,
  canClosePermit,
  canSuspendPermit,
  canResumePermit,
  ptwSummary,
} from "./hseLogic.js";

/* ══════════════ اسکیما ══════════════ */

test("چهار جدول سامانهٔ پروانه در اسکیما هستند", () => {
  for (const n of ["GasTestLog", "IsolationLog", "PTW_Approval", "PTW_Precaution"]) {
    const t = SCHEMA.find((x) => x.name === n);
    assert.ok(t, `${n} نیست`);
    assert.equal(t.module, "d16");
  }
});

test("WorkPermit شش ستون تازه گرفته و ستون‌های قبلی دست‌نخورده‌اند", () => {
  const t = SCHEMA.find((x) => x.name === "WorkPermit");
  for (const c of ["JsaId", "QrToken", "SuspendedAt", "SuspendedBy", "SuspendReasonFa", "ParentPermitId"]) {
    assert.ok(t.columns.some((x) => x.name === c), `${c} افزوده نشده`);
  }
  /* ستون متنی قدیمی برای دادهٔ تاریخی باید بماند. */
  assert.ok(t.columns.some((x) => x.name === "GasTestResultFa"), "ستون قدیمی نباید حذف شود");
  for (const c of ["PermitNo", "PermitType", "RequestedBy", "ValidFrom", "ValidTo", "Status"]) {
    assert.ok(t.columns.some((x) => x.name === c), `${c} حذف شده`);
  }
});

test("ستون‌های افزوده به WorkPermit همه nullable هستند", () => {
  const t = SCHEMA.find((x) => x.name === "WorkPermit");
  for (const c of ["JsaId", "QrToken", "SuspendedAt", "SuspendedBy", "SuspendReasonFa", "ParentPermitId"]) {
    const col = t.columns.find((x) => x.name === c);
    assert.notEqual(col.nullable, false, `${c} روی دادهٔ موجود می‌شکند`);
  }
});

test("مهاجرت 0017 فقط ستون می‌افزاید و چیزی را حذف نمی‌کند", () => {
  const m = MIGRATIONS.find((x) => x.version === "0017");
  assert.ok(m, "مهاجرت 0017 نیست");
  assert.equal(m.statements.filter((s) => s.includes("DROP")).length, 0, "نباید چیزی حذف شود");
  const alters = m.statements.filter((s) => s.includes("ALTER TABLE"));
  assert.ok(alters.length > 0);
  for (const s of alters) assert.match(s, /ADD/, "تنها ALTER مجاز افزودن ستون است");
});

test("افزودن ستون ایدمپوتنت است", () => {
  const m = MIGRATIONS.find((x) => x.version === "0017");
  const guards = m.statements.filter((s) => s.includes("COL_LENGTH"));
  assert.equal(guards.length, 6, "هر شش ستون باید گارد داشته باشد");
});

test("مهاجرت‌های پیشین دست‌نخورده مانده‌اند", () => {
  const v = MIGRATIONS.map((m) => m.version);
  for (const prev of ["0012", "0013", "0014", "0015", "0016"]) {
    assert.ok(v.includes(prev), `مهاجرت ${prev} نباید حذف شود`);
  }
  assert.ok(v.includes("0018"), "مهاجرت حادثه و اقدام اصلاحی نباید حذف شود");
  assert.ok(v.includes("0019"), "مهاجرت تخلف و توقف کار نباید حذف شود");
  /* «آخرین مهاجرت» ادعای شکننده‌ای است: هر ماژول بعدی آن را
   * می‌شکند بی‌آنکه چیزی دربارهٔ این ماژول بگوید. چیزی که باید
   * ثابت بماند نبودن شکاف و ترتیب صعودی است. */
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
});

test("یکتایی توکن QR و امضا در اسکیما تضمین شده", () => {
  const wp = SCHEMA.find((x) => x.name === "WorkPermit");
  assert.ok(wp.indexes.find((i) => i.name === "UX_WorkPermit_Qr")?.unique);
  const ap = SCHEMA.find((x) => x.name === "PTW_Approval");
  const ux = ap.indexes.find((i) => i.name === "UX_PtwApproval");
  assert.ok(ux?.unique);
  assert.deepEqual(ux.columns, ["PermitId", "ApprovalLevel"], "هر سطح فقط یک امضا");
});

test("ایندکس یکتا روی ستون nullable فیلتر IS NOT NULL می‌گیرد", () => {
  /* بدون این فیلتر، افزودن یک ستون یکتا به جدول پرداده روی SQL Server
   * شکست می‌خورد: همهٔ ردیف‌های قدیمی NULL می‌گیرند و ایندکس یکتا فقط
   * یک NULL می‌پذیرد. این آزمون قاعده را قفل می‌کند. */
  const m = MIGRATIONS.find((x) => x.version === "0017");
  const qr = m.statements.find((s) => s.includes("UX_WorkPermit_Qr"));
  assert.ok(qr, "ایندکس توکن QR در مهاجرت نیست");
  assert.match(qr, /WHERE \[QrToken\] IS NOT NULL/, "ایندکس یکتای nullable باید فیلتر داشته باشد");
});

test("ایندکس یکتا روی ستون NOT NULL فیلتر اضافه نمی‌گیرد", () => {
  const m = MIGRATIONS.find((x) => x.version === "0017");
  const ux = m.statements.find((s) => s.includes("UX_PtwApproval"));
  assert.ok(ux);
  assert.ok(!ux.includes("WHERE"), "ستون اجباری فیلتر لازم ندارد");
});

test("IsConfirmed اقدام احتیاطی nullable است تا «بررسی نشده» معنا داشته باشد", () => {
  const t = SCHEMA.find((x) => x.name === "PTW_Precaution");
  const col = t.columns.find((c) => c.name === "IsConfirmed");
  assert.notEqual(col.nullable, false, "null یعنی بررسی نشده و با false یکی نیست");
});

/* ══════════════ ثابت‌ها ══════════════ */

test("آستانه‌های گاز مطابق استاندارد فضای محصور است", () => {
  assert.equal(GAS_LIMITS.lelMaxPct, 10);
  assert.equal(GAS_LIMITS.oxygenMinPct, 19.5);
  assert.equal(GAS_LIMITS.oxygenMaxPct, 23.5);
  assert.equal(GAS_LIMITS.h2sMaxPpm, 10);
  assert.equal(GAS_LIMITS.coMaxPpm, 35);
});

test("ترتیب امضا از سرپرست به مدیر منطقه است", () => {
  assert.deepEqual(APPROVAL_LEVELS, ["supervisor", "hse", "area_manager"]);
  assert.equal(APPROVAL_LEVEL_FA.hse, "افسر ایمنی و بهداشت");
});

test("گازسنجی برای کار گرم و فضای بسته اجباری است", () => {
  assert.ok(GAS_TEST_REQUIRED_PERMITS.includes("hot"));
  assert.ok(GAS_TEST_REQUIRED_PERMITS.includes("confined"));
  assert.ok(!GAS_TEST_REQUIRED_PERMITS.includes("lifting"), "بالابری گازسنجی لازم ندارد");
});

test("ایزولاسیون برای کار برقی و فضای بسته اجباری است", () => {
  assert.ok(ISOLATION_REQUIRED_PERMITS.includes("electrical"));
  assert.ok(ISOLATION_REQUIRED_PERMITS.includes("confined"));
});

test("هر نوع و وضعیت ایزولاسیون برچسب فارسی دارد", () => {
  for (const t of ISOLATION_TYPES) assert.ok(ISOLATION_TYPE_FA[t], `${t} برچسب ندارد`);
  for (const s of ["planned", "applied", "removed"]) assert.ok(ISOLATION_STATUS_FA[s]);
});

/* ══════════════ گازسنجی ══════════════ */

test("قرائت درون محدوده ایمن است", () => {
  const r = evaluateGasTest({ LelPct: 0, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 2 });
  assert.equal(r.isSafe, true);
  assert.equal(r.breachesFa.length, 0);
  assert.equal(r.measuredCount, 4);
});

test("حد انفجار بالای آستانه ناایمن است", () => {
  const r = evaluateGasTest({ LelPct: 12, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 });
  assert.equal(r.isSafe, false);
  assert.match(r.breachesFa.join(), /حد انفجار/);
});

test("کمبود اکسیژن ناایمن است", () => {
  const r = evaluateGasTest({ LelPct: 0, OxygenPct: 18, H2sPpm: 0, CoPpm: 0 });
  assert.equal(r.isSafe, false);
  assert.match(r.breachesFa.join(), /کمبود اکسیژن/);
});

test("غنای اکسیژن هم ناایمن است نه فقط کمبودش", () => {
  const r = evaluateGasTest({ LelPct: 0, OxygenPct: 24.5, H2sPpm: 0, CoPpm: 0 });
  assert.equal(r.isSafe, false);
  assert.match(r.breachesFa.join(), /غنای اکسیژن/);
});

test("مرز دقیق اکسیژن ۱۹٫۵ ایمن است", () => {
  assert.equal(evaluateGasTest({ LelPct: 0, OxygenPct: 19.5, H2sPpm: 0, CoPpm: 0 }).isSafe, true);
  assert.equal(evaluateGasTest({ LelPct: 0, OxygenPct: 19.4, H2sPpm: 0, CoPpm: 0 }).isSafe, false);
});

test("سولفید هیدروژن و مونوکسید کربن جدا سنجیده می‌شوند", () => {
  const h2s = evaluateGasTest({ LelPct: 0, OxygenPct: 20.9, H2sPpm: 15, CoPpm: 0 });
  assert.match(h2s.breachesFa.join(), /سولفید هیدروژن/);
  const co = evaluateGasTest({ LelPct: 0, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 40 });
  assert.match(co.breachesFa.join(), /مونوکسید کربن/);
});

test("قرائت خالی ایمن فرض نمی‌شود", () => {
  const r = evaluateGasTest({});
  assert.equal(r.isSafe, false, "سکوت تأیید نیست");
  assert.equal(r.measuredCount, 0);
  assert.equal(r.missingFa.length, 4);
});

test("پارامتر ثبت‌نشده در فهرست کمبودها می‌آید نه در تخلف‌ها", () => {
  const r = evaluateGasTest({ LelPct: 0, OxygenPct: 20.9 });
  assert.equal(r.breachesFa.length, 0);
  assert.equal(r.missingFa.length, 2);
  assert.equal(r.measuredCount, 2);
});

test("مقدار غیرعددی مثل ثبت‌نشده رفتار می‌کند نه صفر", () => {
  const r = evaluateGasTest({ LelPct: "بالا", OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 });
  assert.equal(r.measuredCount, 3);
  assert.match(r.missingFa.join(), /حد انفجار/);
});

test("مقدار منفی مثل اندازه‌نگرفته رفتار می‌کند نه صفر ایمن", () => {
  /* گازسنج معیوب مقدار منفی می‌دهد. اگر آن را صفر بخوانیم، دستگاه خراب
   * سبزترین نتیجهٔ ممکن را تولید می‌کند — برعکس آنچه ایمنی لازم دارد. */
  const r = evaluateGasTest({ LelPct: -5, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 });
  assert.equal(r.measuredCount, 3, "منفی نباید اندازه‌گیری شمرده شود");
  assert.match(r.missingFa.join(), /حد انفجار/);
  assert.equal(r.breachesFa.length, 0, "منفی تخلف نیست، کمبود اندازه‌گیری است");
});

test("گازسنجی ناقص مانع صدور پروانهٔ نیازمند گاز است", () => {
  /* «هیچ تخلفی نبود» با «همه‌چیز سنجیده شد» یکی نیست. */
  const partial = [{ Id: "g", PermitId: "p1", TestedAt: "2026-09-09T11:50:00Z", LelPct: 0, OxygenPct: 20.9 }];
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: goodJsa,
    gasTests: partial,
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /گازسنجی ناقص/);
  assert.equal(r.checks.gasTest, false);
});

test("گازسنجی معیوب با مقدار منفی مانع صدور است", () => {
  const faulty = [{ Id: "g", PermitId: "p1", TestedAt: "2026-09-09T11:50:00Z", LelPct: -3, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 }];
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: goodJsa,
    gasTests: faulty,
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false, "دستگاه معیوب نباید پروانه بگیرد");
  assert.match(r.blockersFa.join(), /ناقص/);
});

test("آخرین گازسنجی بر اساس زمان انتخاب می‌شود نه ترتیب آرایه", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const tests = [
    { Id: "g1", PermitId: "p1", TestedAt: "2026-09-09T08:00:00Z", LelPct: 0, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 },
    { Id: "g2", PermitId: "p1", TestedAt: "2026-09-09T11:30:00Z", LelPct: 0, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 },
    { Id: "g3", PermitId: "p2", TestedAt: "2026-09-09T11:55:00Z", LelPct: 0, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 },
  ];
  const r = latestGasTest(tests, "p1", now);
  assert.equal(r.test.Id, "g2");
  assert.equal(r.isFresh, true);
  assert.equal(r.ageMinutes, 30);
});

test("گازسنجی کهنه معتبر نیست", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const tests = [{ Id: "g1", PermitId: "p1", TestedAt: "2026-09-09T08:00:00Z", LelPct: 0, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 }];
  const r = latestGasTest(tests, "p1", now);
  assert.equal(r.isFresh, false, `${GAS_TEST_VALIDITY_MINUTES} دقیقه اعتبار دارد`);
  assert.equal(r.ageMinutes, 240);
  assert.equal(r.isSafe, true, "کهنه بودن با ناایمن بودن یکی نیست");
});

test("نبود گازسنجی خطا نمی‌دهد", () => {
  const r = latestGasTest([], "p1");
  assert.equal(r.test, null);
  assert.equal(r.isFresh, false);
  assert.equal(r.isSafe, false);
});

/* ══════════════ ایزولاسیون ══════════════ */

const ISO = [
  { Id: "i1", PermitId: "p1", IsolationNo: 1, IsolationType: "electrical", PointTagFa: "کلید MCC-01", LockNo: "L-01", Status: "applied" },
  { Id: "i2", PermitId: "p1", IsolationNo: 2, IsolationType: "process", PointTagFa: "شیر V-200", LockNo: "L-02", Status: "applied" },
  { Id: "i3", PermitId: "p2", IsolationNo: 1, IsolationType: "mechanical", PointTagFa: "کوپلینگ", Status: "planned" },
];

test("وضعیت ایزولاسیون فقط پروانهٔ خودش را می‌شمارد", () => {
  const r = isolationState(ISO, "p1");
  assert.equal(r.total, 2);
  assert.equal(r.applied, 2);
  assert.equal(r.allApplied, true);
  assert.equal(r.allRemoved, false);
});

test("ایزولاسیون برنامه‌ریزی‌شده یعنی هنوز اعمال نشده", () => {
  const r = isolationState(ISO, "p2");
  assert.equal(r.allApplied, false);
  assert.equal(r.planned, 1);
});

test("قفل اعمال‌شده بدون شمارهٔ فیزیکی ایراد است", () => {
  const r = isolationState(
    [{ Id: "x", PermitId: "p9", IsolationNo: 1, IsolationType: "electrical", PointTagFa: "تابلو", Status: "applied" }],
    "p9",
  );
  assert.equal(r.missingLockFa.length, 1);
  assert.match(r.missingLockFa[0], /شمارهٔ قفل/);
});

test("پروانهٔ بدون ایزولاسیون allApplied نمی‌دهد", () => {
  const r = isolationState([], "p-none");
  assert.equal(r.total, 0);
  assert.equal(r.allApplied, false, "صفر ایزولاسیون یعنی نامشخص نه کامل");
  assert.equal(r.allRemoved, false);
});

/* ══════════════ زنجیرهٔ امضا ══════════════ */

const sign = (level, decision = "approved", who = "u-" + level) =>
  ({ Id: "a-" + level, PermitId: "p1", ApprovalLevel: level, ApproverRef: who, SignedAt: "2026-09-09T10:00:00Z", DecisionFa: decision });

test("زنجیرهٔ خالی نوبت را به سرپرست می‌دهد", () => {
  const r = approvalChain([], "p1");
  assert.equal(r.nextLevel, "supervisor");
  assert.equal(r.isComplete, false);
  assert.equal(r.pending.length, 3);
});

test("زنجیرهٔ کامل تکمیل‌شده گزارش می‌شود", () => {
  const r = approvalChain([sign("supervisor"), sign("hse"), sign("area_manager")], "p1");
  assert.equal(r.isComplete, true);
  assert.equal(r.nextLevel, null);
  assert.equal(r.signed.length, 3);
});

test("رد در هر سطح زنجیره را متوقف می‌کند", () => {
  const r = approvalChain([sign("supervisor"), sign("hse", "rejected")], "p1");
  assert.equal(r.rejectedBy, "hse");
  assert.equal(r.isComplete, false);
  assert.equal(r.nextLevel, null, "پس از رد نوبت بعدی معنا ندارد");
});

test("امضای بی‌ترتیب شناسایی می‌شود", () => {
  const r = approvalChain([sign("area_manager")], "p1");
  assert.equal(r.outOfOrderFa.length, 1);
  assert.match(r.outOfOrderFa[0], /مدیر منطقه پیش از/);
});

test("سرپرست اول نوبت دارد، مدیر منطقه ندارد", () => {
  const permit = { Id: "p1", RequestedBy: "u-req", Status: "draft", PermitType: "cold", ValidFrom: "2026-09-09T06:00:00Z", ValidTo: "2026-09-09T18:00:00Z" };
  assert.equal(canSignPermit({ permit, approvals: [], level: "supervisor", approverId: "u-sup" }).ok, true);
  const late = canSignPermit({ permit, approvals: [], level: "area_manager", approverId: "u-am" });
  assert.equal(late.ok, false);
  assert.match(late.blockersFa.join(), /نوبت امضای سرپرست اجرا/);
});

test("امضای دوباره در یک سطح رد می‌شود", () => {
  const permit = { Id: "p1", RequestedBy: "u-req", Status: "draft", PermitType: "cold", ValidFrom: "2026-09-09T06:00:00Z", ValidTo: "2026-09-09T18:00:00Z" };
  const r = canSignPermit({ permit, approvals: [sign("supervisor")], level: "supervisor", approverId: "u-sup" });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /قبلاً نظر خود را ثبت/);
});

test("درخواست‌کننده پروانهٔ خود را امضا نمی‌کند", () => {
  const permit = { Id: "p1", RequestedBy: "u-sup", Status: "draft", PermitType: "cold", ValidFrom: "2026-09-09T06:00:00Z", ValidTo: "2026-09-09T18:00:00Z" };
  const r = canSignPermit({ permit, approvals: [], level: "supervisor", approverId: "u-sup" });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /درخواست‌کننده/);
});

test("سطح امضای نامعتبر رد می‌شود", () => {
  const permit = { Id: "p1", RequestedBy: "u-req", Status: "draft", PermitType: "cold", ValidFrom: "2026-09-09T06:00:00Z", ValidTo: "2026-09-09T18:00:00Z" };
  const r = canSignPermit({ permit, approvals: [], level: "ceo", approverId: "u-x" });
  assert.equal(r.ok, false);
  assert.equal(r.blockersFa.length, 1);
});

/* ══════════════ اقدامات احتیاطی ══════════════ */

test("null یعنی بررسی نشده و با false یکی نیست", () => {
  const p = [
    { Id: "x1", PermitId: "p1", PrecautionNo: 1, PrecautionFa: "خاموش‌کننده در محل", IsMandatory: true, IsConfirmed: null },
    { Id: "x2", PermitId: "p1", PrecautionNo: 2, PrecautionFa: "نگهبان آتش", IsMandatory: true, IsConfirmed: false },
    { Id: "x3", PermitId: "p1", PrecautionNo: 3, PrecautionFa: "پوشش کف", IsMandatory: true, IsConfirmed: true },
  ];
  const r = precautionState(p, "p1");
  assert.equal(r.unchecked, 1);
  assert.equal(r.unconfirmed, 1);
  assert.equal(r.confirmed, 1);
  assert.equal(r.isReady, false);
  assert.match(r.mandatoryPendingFa.join(), /بررسی نشده/);
  assert.match(r.mandatoryPendingFa.join(), /برقرار نیست/);
});

test("اقدام غیراجباری تأییدنشده مانع نیست", () => {
  const p = [
    { Id: "x1", PermitId: "p1", PrecautionNo: 1, PrecautionFa: "اجباری", IsMandatory: true, IsConfirmed: true },
    { Id: "x2", PermitId: "p1", PrecautionNo: 2, PrecautionFa: "اختیاری", IsMandatory: false, IsConfirmed: null },
  ];
  const r = precautionState(p, "p1");
  assert.equal(r.isReady, true);
});

/* ══════════════ دروازهٔ صدور ══════════════ */

const NOW = new Date("2026-09-09T12:00:00Z");
const goodJsa = { Id: "j1", Status: "approved", ValidUntil: "2026-12-01", PreparedBy: "u-site", ApprovedBy: "u-hse" };
const freshGas = [{ Id: "g1", PermitId: "p1", TestedAt: "2026-09-09T11:30:00Z", LelPct: 0, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 1 }];
const fullChain = [sign("supervisor"), sign("hse"), sign("area_manager")];

const hotPermit = (over = {}) => ({
  Id: "p1",
  ProjectId: "hse-p1",
  PermitNo: "PTW-001",
  PermitType: "hot",
  TitleFa: "جوشکاری",
  RequestedBy: "u-req",
  ValidFrom: "2026-09-09T06:00:00Z",
  ValidTo: "2026-09-09T18:00:00Z",
  Status: "draft",
  SimopsRequired: false,
  SimopsApprovedBy: "u-am",
  GasTestResultFa: "ثبت شد",
  JsaId: "j1",
  ...over,
});

test("پروانهٔ کامل صادر می‌شود", () => {
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: goodJsa,
    gasTests: freshGas,
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, true, r.blockersFa.join(" | "));
  assert.equal(r.checks.jsa, true);
  assert.equal(r.checks.gasTest, true);
  assert.equal(r.checks.approvals, true);
});

test("پروانهٔ بدون ارزیابی ریسک صادر نمی‌شود", () => {
  const r = canIssuePermit({
    permit: hotPermit({ JsaId: null }),
    gasTests: freshGas,
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /متصل نیست/);
  assert.equal(r.checks.jsa, false);
});

test("ارزیابی ریسک پیش‌نویس پروانه را پشتیبانی نمی‌کند", () => {
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: { ...goodJsa, Status: "draft" },
    gasTests: freshGas,
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.equal(r.checks.jsa, false);
});

test("کار گرم بدون گازسنجی صادر نمی‌شود", () => {
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: goodJsa,
    gasTests: [],
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /بدون گازسنجی/);
});

test("گازسنجی کهنه مانع صدور است هرچند ایمن باشد", () => {
  const stale = [{ Id: "g1", PermitId: "p1", TestedAt: "2026-09-09T08:00:00Z", LelPct: 0, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 }];
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: goodJsa,
    gasTests: stale,
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /اعتبار آن/);
});

test("گازسنجی ناایمن مانع صدور با ذکر پارامتر است", () => {
  const bad = [{ Id: "g1", PermitId: "p1", TestedAt: "2026-09-09T11:45:00Z", LelPct: 15, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 }];
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: goodJsa,
    gasTests: bad,
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /حد انفجار/);
});

test("کار بالابری گازسنجی لازم ندارد", () => {
  const r = canIssuePermit({
    permit: hotPermit({ PermitType: "lifting", SimopsApprovedBy: "u-am" }),
    jsa: goodJsa,
    gasTests: [],
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, true, r.blockersFa.join(" | "));
});

test("کار برقی بدون ایزولاسیون صادر نمی‌شود", () => {
  const r = canIssuePermit({
    permit: hotPermit({ PermitType: "electrical" }),
    jsa: goodJsa,
    isolations: [],
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /ایزولاسیون/);
});

test("ایزولاسیون اعمال‌نشده مانع صدور کار برقی است", () => {
  const iso = [{ Id: "i", PermitId: "p1", IsolationNo: 1, IsolationType: "electrical", PointTagFa: "تابلو", LockNo: "L", Status: "planned" }];
  const r = canIssuePermit({
    permit: hotPermit({ PermitType: "electrical" }),
    jsa: goodJsa,
    isolations: iso,
    approvals: fullChain,
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /هنوز اعمال نشده/);
});

test("امضای ناقص مانع صدور است", () => {
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: goodJsa,
    gasTests: freshGas,
    approvals: [sign("supervisor")],
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /باقی مانده/);
});

test("اقدام احتیاطی اجباری بررسی‌نشده مانع صدور است", () => {
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: goodJsa,
    gasTests: freshGas,
    approvals: fullChain,
    precautions: [{ Id: "x", PermitId: "p1", PrecautionNo: 1, PrecautionFa: "خاموش‌کننده", IsMandatory: true, IsConfirmed: null }],
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /بررسی نشده/);
});

test("همهٔ موانع یک‌جا برمی‌گردند نه یکی‌یکی", () => {
  const r = canIssuePermit({
    permit: hotPermit({ JsaId: null }),
    gasTests: [],
    approvals: [],
    now: NOW,
  });
  assert.ok(r.blockersFa.length >= 3, `فقط ${r.blockersFa.length} مانع برگشت`);
});

test("دروازه هرگز استثنا پرتاب نمی‌کند", () => {
  assert.doesNotThrow(() => canIssuePermit({ permit: hotPermit({ ValidTo: "نامعتبر" }) }));
  assert.doesNotThrow(() => canIssuePermit({ permit: { Id: "x", Status: "draft", PermitType: "hot", RequestedBy: "" } }));
});

test("نبود اقدام احتیاطی هشدار است نه مانع", () => {
  const r = canIssuePermit({
    permit: hotPermit(),
    jsa: goodJsa,
    gasTests: freshGas,
    approvals: fullChain,
    precautions: [],
    approverId: "u-hse",
    now: NOW,
  });
  assert.equal(r.ok, true);
  assert.match(r.warningsFa.join(), /اقدام احتیاطی/);
});

/* ══════════════ بستن، تعلیق، ازسرگیری ══════════════ */

test("پروانه با قفل جامانده بسته نمی‌شود", () => {
  const iso = [
    { Id: "i1", PermitId: "p1", IsolationNo: 1, IsolationType: "electrical", PointTagFa: "تابلو", LockNo: "L1", Status: "applied" },
    { Id: "i2", PermitId: "p1", IsolationNo: 2, IsolationType: "process", PointTagFa: "شیر", LockNo: "L2", Status: "removed" },
  ];
  const r = canClosePermit({ permit: hotPermit({ Status: "active" }), isolations: iso });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /قفل هنوز روی تجهیز/);
});

test("پروانه با همهٔ قفل‌های برداشته‌شده بسته می‌شود", () => {
  const iso = [{ Id: "i1", PermitId: "p1", IsolationNo: 1, IsolationType: "electrical", PointTagFa: "تابلو", LockNo: "L1", Status: "removed" }];
  const r = canClosePermit({ permit: hotPermit({ Status: "active" }), isolations: iso });
  assert.equal(r.ok, true, r.blockersFa.join());
});

test("رویداد ایمنی باز مانع بستن پروانه است", () => {
  const r = canClosePermit({ permit: hotPermit({ Status: "active" }), openIncidents: 1 });
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /رویداد ایمنی باز/);
});

test("پروانهٔ بسته دوباره بسته نمی‌شود", () => {
  const r = canClosePermit({ permit: hotPermit({ Status: "closed" }) });
  assert.equal(r.ok, false);
});

test("بستن به‌دست درخواست‌کننده هشدار است نه مانع", () => {
  const r = canClosePermit({ permit: hotPermit({ Status: "active" }), closerId: "u-req" });
  assert.equal(r.ok, true);
  assert.equal(r.warningsFa.length, 1);
});

test("فقط پروانهٔ فعال تعلیق می‌شود", () => {
  assert.equal(canSuspendPermit(hotPermit({ Status: "active" })).ok, true);
  assert.equal(canSuspendPermit(hotPermit({ Status: "draft" })).ok, false);
  assert.equal(canSuspendPermit(hotPermit({ Status: "closed" })).ok, false);
});

test("فقط پروانهٔ معلق از سر گرفته می‌شود", () => {
  /* کار گرم گازسنجی اجباری دارد، پس سیاههٔ تازه هم لازم است. */
  assert.equal(canResumePermit(hotPermit({ Status: "suspended" }), NOW, freshGas).ok, true);
  assert.equal(canResumePermit(hotPermit({ Status: "active" }), NOW, freshGas).ok, false);
  /* کار سرد گازسنجی لازم ندارد و بدون سیاهه هم از سر گرفته می‌شود. */
  assert.equal(canResumePermit(hotPermit({ Status: "suspended", PermitType: "cold" }), NOW).ok, true);
});

test("ازسرگیری کار گرم بدون گازسنجی تازهٔ ایمن در موتور رد می‌شود", () => {
  /* این قاعده عمداً در موتور است نه فقط در لایهٔ وب: تعلیقی که خودِ گاز
   * باعثش شده نباید با یک کلیک برداشته شود. */
  const noGas = canResumePermit(hotPermit({ Status: "suspended" }), NOW, []);
  assert.equal(noGas.ok, false);
  assert.match(noGas.blockersFa.join(), /گازسنجی ثبت‌شده/);

  const unsafe = [{ Id: "g", PermitId: "p1", TestedAt: "2026-09-09T11:50:00Z", LelPct: 20, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 }];
  const bad = canResumePermit(hotPermit({ Status: "suspended" }), NOW, unsafe);
  assert.equal(bad.ok, false);
  assert.match(bad.blockersFa.join(), /خارج از محدودهٔ ایمن/);

  const stale = [{ Id: "g", PermitId: "p1", TestedAt: "2026-09-09T06:00:00Z", LelPct: 0, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 }];
  const old = canResumePermit(hotPermit({ Status: "suspended" }), NOW, stale);
  assert.equal(old.ok, false);
  assert.match(old.blockersFa.join(), /قرائت تازه/);
});

test("پروانهٔ منقضی‌شده در مدت تعلیق از سر گرفته نمی‌شود", () => {
  const r = canResumePermit(hotPermit({ Status: "suspended" }), new Date("2026-09-10T12:00:00Z"));
  assert.equal(r.ok, false);
  assert.match(r.blockersFa.join(), /تمدید/);
});

/* ══════════════ خلاصه ══════════════ */

test("خلاصه کلیدهای همهٔ وضعیت‌ها و انواع را از پیش صفر می‌کند", () => {
  const r = ptwSummary({ permits: [], now: NOW });
  for (const s of ["draft", "active", "suspended", "closed", "expired", "rejected"]) {
    assert.equal(r.byStatus[s], 0, `کلید ${s} غایب است`);
  }
  for (const t of ["hot", "cold", "confined", "height", "electrical", "excavation", "lifting"]) {
    assert.equal(r.byType[t], 0, `کلید ${t} غایب است`);
  }
  assert.equal(r.total, 0);
});

test("پروانهٔ منقضی‌نبسته در خلاصه علامت می‌خورد", () => {
  const permits = [hotPermit({ Status: "active", ValidTo: "2026-09-08T18:00:00Z" })];
  const r = ptwSummary({ permits, now: NOW });
  assert.equal(r.expiredNotClosed, 1);
  assert.match(r.warningsFa.join(), /منقضی هنوز بسته نشده/);
});

test("پروانهٔ نزدیک انقضا هشدار می‌گیرد", () => {
  const permits = [hotPermit({ Status: "active", ValidTo: "2026-09-09T14:00:00Z" })];
  const r = ptwSummary({ permits, now: NOW });
  assert.equal(r.expiringSoon, 1);
  assert.equal(r.activeNow, 1);
});

test("کار پرخطر فعال جدا شمرده می‌شود", () => {
  const permits = [
    hotPermit({ Id: "a", Status: "active" }),
    hotPermit({ Id: "b", Status: "active", PermitType: "cold" }),
  ];
  const r = ptwSummary({ permits, now: NOW });
  assert.equal(r.activeNow, 2);
  assert.equal(r.highRiskActive, 1, "فقط کار گرم پرخطر است");
});

test("قفل روی تجهیز و گازسنجی ناایمن در خلاصه می‌آید", () => {
  const r = ptwSummary({
    permits: [hotPermit({ Status: "active" })],
    gasTests: [{ Id: "g", PermitId: "p1", TestedAt: "2026-09-09T11:00:00Z", LelPct: 20, OxygenPct: 20.9, H2sPpm: 0, CoPpm: 0 }],
    isolations: ISO,
    now: NOW,
  });
  assert.equal(r.unsafeGasTests, 1);
  assert.equal(r.locksOnEquipment, 2);
  assert.match(r.warningsFa.join(), /خارج از محدودهٔ ایمن/);
});
