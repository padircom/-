import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RESPONSE_DAYS,
  actionState,
  averageResponseTime,
  ckmEws,
  commsPlanCoverage,
  communicationChannels,
  criticalStakeholders,
  distributionGap,
  engagementGap,
  escalationLevel,
  isTimeBarred,
  knowledgeUtilization,
  lessonCoverage,
  lessonValue,
  meetingHealth,
  powerInterestQuadrant,
  responseDue,
  validateAction,
  validateLesson,
  validateLetter,
  workingDaysBetween,
} from "./ckmLogic.js";

const TODAY = "2026-09-08";

const baseLetter = {
  id: "L-1",
  ref: "R-001",
  direction: "incoming",
  letterClass: "general",
  subject: "موضوع آزمایشی",
  from: "کارفرما",
  to: "پیمانکار",
  issuedAt: "2026-09-01",
  receivedAt: "2026-09-01",
  status: "registered",
  ownerRole: "مدیر پروژه",
};

/* ─────────── مهلت پاسخ ─────────── */

test("workingDaysBetween: جمعه از شمارش حذف می‌شود", () => {
  // ۲۰۲۶-۰۹-۱۰ پنجشنبه، ۲۰۲۶-۰۹-۱۲ شنبه → جمعه وسط شمرده نمی‌شود
  assert.equal(workingDaysBetween("2026-09-10", "2026-09-12"), 1);
});

test("workingDaysBetween: جهت معکوس عدد منفی می‌دهد", () => {
  assert.equal(workingDaysBetween("2026-09-12", "2026-09-10"), -1);
  assert.equal(workingDaysBetween("2026-09-10", "2026-09-10"), 0);
});

test("responseDue: مهلت پیش‌فرض کلاس نامه با پرش از جمعه اعمال می‌شود", () => {
  // ثبت سه‌شنبه ۲۰۲۶-۰۹-۰۱ + ۵ روز کاری؛ جمعه ۰۹-۰۴ شمرده نمی‌شود → ۰۹-۰۷
  const r = responseDue({ ...baseLetter, letterClass: "rfi" }, TODAY);
  assert.equal(r.dueDate, "2026-09-07");
  assert.equal(r.overdue, true); // امروز ۰۹-۰۸ است
  assert.equal(r.timeBarBreached, false);
});

test("responseDue: مهلت صریح نامه بر پیش‌فرض کلاس اولویت دارد", () => {
  const withDefault = responseDue({ ...baseLetter, letterClass: "general" }, TODAY);
  const withExplicit = responseDue({ ...baseLetter, letterClass: "general", responseDays: 1 }, TODAY);
  assert.ok(withExplicit.dueDate < withDefault.dueDate);
});

test("responseDue: اعلان ادعای از مهلت گذشته وضعیت بحرانی می‌گیرد", () => {
  const r = responseDue(
    { ...baseLetter, letterClass: "claim_notice", issuedAt: "2026-06-01", receivedAt: "2026-06-01", links: ["CLM-1"] },
    TODAY
  );
  assert.equal(r.overdue, true);
  assert.equal(r.timeBarBreached, true);
  assert.equal(r.severity, "critical");
});

test("responseDue: نامه عادی از مهلت گذشته نقض قراردادی نیست", () => {
  const r = responseDue({ ...baseLetter, letterClass: "general", issuedAt: "2026-06-01", receivedAt: "2026-06-01" }, TODAY);
  assert.equal(r.overdue, true);
  assert.equal(r.timeBarBreached, false);
  assert.equal(r.severity, "overdue");
});

test("responseDue: نامه پاسخ‌داده‌شده هرگز معوق شمرده نمی‌شود", () => {
  const r = responseDue(
    { ...baseLetter, letterClass: "claim_notice", issuedAt: "2026-06-01", receivedAt: "2026-06-01", respondedAt: "2026-06-15", links: ["CLM-1"] },
    TODAY
  );
  assert.equal(r.overdue, false);
  assert.equal(r.severity, "ok");
});

test("isTimeBarred: فقط اعلان قراردادی و اعلان ادعا مهلت الزام‌آور دارند", () => {
  assert.equal(isTimeBarred("claim_notice"), true);
  assert.equal(isTimeBarred("notice"), true);
  assert.equal(isTimeBarred("general"), false);
  assert.equal(isTimeBarred("rfi"), false);
});

test("DEFAULT_RESPONSE_DAYS: اعلان ادعا بلندترین و استعلام کوتاه‌ترین مهلت را دارد", () => {
  assert.equal(DEFAULT_RESPONSE_DAYS.claim_notice, 20);
  assert.equal(DEFAULT_RESPONSE_DAYS.rfi, 5);
});

test("averageResponseTime: فقط نامه‌های پاسخ‌داده‌شده شمرده می‌شوند", () => {
  const letters = [
    { ...baseLetter, id: "a", receivedAt: "2026-09-01", respondedAt: "2026-09-03" },
    { ...baseLetter, id: "b", receivedAt: "2026-09-01" }, // بی‌پاسخ
  ];
  assert.equal(averageResponseTime(letters), 2);
  assert.equal(averageResponseTime([]), 0);
});

/* ─────────── اعتبارسنجی نامه ─────────── */

test("validateLetter: اعلان قراردادی بدون ارجاع رد می‌شود", () => {
  const issues = validateLetter({ ...baseLetter, letterClass: "claim_notice" });
  assert.ok(issues.some((i) => i.code === "E-CKM-103"));
});

test("validateLetter: نامه وارده بدون تاریخ ثبت دبیرخانه رد می‌شود", () => {
  const issues = validateLetter({ ...baseLetter, receivedAt: undefined });
  assert.ok(issues.some((i) => i.code === "E-CKM-104"));
});

test("validateLetter: نامه بدون مالک فقط هشدار می‌گیرد نه خطا", () => {
  const issues = validateLetter({ ...baseLetter, ownerRole: undefined });
  const w = issues.find((i) => i.code === "W-CKM-301");
  assert.ok(w);
  assert.equal(w.severity, "warning");
});

test("validateLetter: نامه سالم هیچ ایرادی ندارد", () => {
  assert.equal(validateLetter(baseLetter).length, 0);
});

/* ─────────── جلسات و مصوبات ─────────── */

const meeting = {
  id: "M-1",
  title: "جلسه هفتگی",
  type: "weekly",
  heldAt: "2026-09-05",
  chair: "مدیر پروژه",
  invited: ["a", "b", "c", "d"],
  attendees: ["a", "b", "c"],
  minutesApproved: true,
  distributedAt: "2026-09-06",
};

const mkAction = (over) => ({
  id: "A-1",
  meetingId: "M-1",
  title: "یک مصوبه با شرح کافی",
  ownerRole: "برنامه‌ریزی",
  dueDate: "2026-09-20",
  status: "open",
  ...over,
});

test("actionState: موعد گذشته وضعیت را معوق می‌کند", () => {
  assert.equal(actionState(mkAction({ dueDate: "2026-09-01" }), TODAY), "overdue");
  assert.equal(actionState(mkAction({ dueDate: "2026-09-20" }), TODAY), "open");
});

test("actionState: مصوبه انجام‌شده حتی با موعد گذشته معوق نمی‌شود", () => {
  assert.equal(actionState(mkAction({ dueDate: "2026-09-01", status: "done" }), TODAY), "done");
});

test("meetingHealth: مصوبه معوق وضعیت جلسه را قرمز می‌کند", () => {
  const h = meetingHealth(meeting, [mkAction({ dueDate: "2026-09-01" })], TODAY);
  assert.equal(h.overdue, 1);
  assert.equal(h.status, "red");
});

test("meetingHealth: نرخ حضور درست محاسبه می‌شود", () => {
  const h = meetingHealth(meeting, [], TODAY);
  assert.equal(h.attendanceRate, 75);
  assert.equal(h.closureRate, 100); // بدون مصوبه یعنی چیزی باز نمانده
});

test("meetingHealth: صورت‌جلسه تصویب‌نشده ایراد ثبت می‌کند", () => {
  const h = meetingHealth({ ...meeting, minutesApproved: false }, [], TODAY);
  assert.ok(h.issues.some((i) => i.includes("تصویب")));
  assert.equal(h.status, "red");
});

test("validateAction: مصوبه بدون مالک یا موعد رد می‌شود", () => {
  assert.ok(validateAction(mkAction({ ownerRole: "" })).some((i) => i.code === "E-CKM-201"));
  assert.ok(validateAction(mkAction({ dueDate: "" })).some((i) => i.code === "E-CKM-202"));
  assert.equal(validateAction(mkAction({})).length, 0);
});

/* ─────────── ذی‌نفعان ─────────── */

const mkStake = (over) => ({
  id: "S-1",
  name: "ذی‌نفع",
  org: "سازمان",
  role: "نقش",
  power: 3,
  interest: 3,
  current: "neutral",
  desired: "neutral",
  channel: ["نامه"],
  frequency: "monthly",
  ownerRole: "مدیر پروژه",
  ...over,
});

test("powerInterestQuadrant: چهار ربع درست تفکیک می‌شوند", () => {
  assert.equal(powerInterestQuadrant(mkStake({ power: 5, interest: 5 })), "manage_closely");
  assert.equal(powerInterestQuadrant(mkStake({ power: 5, interest: 2 })), "keep_satisfied");
  assert.equal(powerInterestQuadrant(mkStake({ power: 2, interest: 5 })), "keep_informed");
  assert.equal(powerInterestQuadrant(mkStake({ power: 1, interest: 1 })), "monitor");
});

test("engagementGap: فاصله تا سطح مطلوب محاسبه می‌شود", () => {
  assert.equal(engagementGap(mkStake({ current: "unaware", desired: "supportive" })), 3);
  assert.equal(engagementGap(mkStake({ current: "leading", desired: "supportive" })), -1);
  assert.equal(engagementGap(mkStake({})), 0);
});

test("criticalStakeholders: فقط قدرت بالا با شکاف مثبت انتخاب می‌شود", () => {
  const list = [
    mkStake({ id: "a", power: 5, current: "unaware", desired: "supportive" }), // بحرانی
    mkStake({ id: "b", power: 2, current: "unaware", desired: "supportive" }), // قدرت کم
    mkStake({ id: "c", power: 5, current: "leading", desired: "supportive" }), // شکاف منفی
  ];
  const out = criticalStakeholders(list);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "a");
});

test("communicationChannels: فرمول n(n−1)/2", () => {
  assert.equal(communicationChannels(8), 28);
  assert.equal(communicationChannels(1), 0);
  assert.equal(communicationChannels(0), 0);
});

test("commsPlanCoverage: ذی‌نفع بدون کانال یا مالک از پوشش خارج می‌شود", () => {
  const list = [mkStake({ id: "a" }), mkStake({ id: "b", channel: [] }), mkStake({ id: "c", ownerRole: "" })];
  assert.equal(commsPlanCoverage(list), 33.3);
  assert.equal(commsPlanCoverage([]), 0);
});

/* ─────────── دانش ─────────── */

const mkLesson = (over) => ({
  id: "K-1",
  title: "عنوان درس",
  category: "quality",
  sourceRef: "NCR-1",
  situation: "شرح وضعیت",
  recommendation: "یک توصیه اجرایی به اندازه کافی مشخص",
  capturedAt: "2026-08-01",
  capturedBy: "مدیر کیفیت",
  validated: true,
  reuseCount: 0,
  impact: "medium",
  tags: [],
  ...over,
});

test("lessonValue: استفاده مجدد بیشترین وزن را دارد", () => {
  const never = lessonValue(mkLesson({ reuseCount: 0 }));
  const used = lessonValue(mkLesson({ reuseCount: 4 }));
  assert.equal(used - never, 40);
});

test("lessonValue: سقف امتیاز استفاده مجدد ۴۰ است", () => {
  assert.equal(lessonValue(mkLesson({ reuseCount: 4 })), lessonValue(mkLesson({ reuseCount: 99 })));
});

test("lessonValue: درس تأییدنشده بدون منشأ کمترین امتیاز را می‌گیرد", () => {
  const weak = lessonValue(mkLesson({ validated: false, sourceRef: "", impact: "low", reuseCount: 0 }));
  assert.equal(weak, 10);
});

test("knowledgeUtilization: فقط درس‌های تأییدشده مخرج را می‌سازند", () => {
  const list = [
    mkLesson({ id: "a", validated: true, reuseCount: 2 }),
    mkLesson({ id: "b", validated: true, reuseCount: 0 }),
    mkLesson({ id: "c", validated: false, reuseCount: 5 }),
  ];
  assert.equal(knowledgeUtilization(list), 50);
  assert.equal(knowledgeUtilization([]), 0);
});

test("lessonCoverage: حوزه بدون درس با صفر گزارش می‌شود", () => {
  const out = lessonCoverage([mkLesson({ category: "quality" })], ["quality", "hse"]);
  assert.equal(out.find((c) => c.category === "quality").count, 1);
  assert.equal(out.find((c) => c.category === "hse").count, 0);
});

test("validateLesson: درس بدون منشأ رد می‌شود", () => {
  assert.ok(validateLesson(mkLesson({ sourceRef: "" })).some((i) => i.code === "E-CKM-401"));
});

test("validateLesson: توصیه کوتاه و غیرقابل اقدام رد می‌شود", () => {
  assert.ok(validateLesson(mkLesson({ recommendation: "بهتر شود" })).some((i) => i.code === "E-CKM-402"));
});

test("validateLesson: درس تأییدشده و هرگز استفاده‌نشده هشدار می‌گیرد", () => {
  assert.ok(validateLesson(mkLesson({ validated: true, reuseCount: 0 })).some((i) => i.code === "W-CKM-303"));
});

/* ─────────── اطلاع‌رسانی ─────────── */

const rule = {
  id: "NR-1",
  event: "رویداد",
  channels: ["email"],
  audienceRoles: ["مدیر"],
  escalateAfterHours: 24,
  escalateToRole: "مدیر ارشد",
  active: true,
};

test("escalationLevel: سطح با گذشت زمان بالا می‌رود", () => {
  assert.equal(escalationLevel(10, rule), 0);
  assert.equal(escalationLevel(30, rule), 1);
  assert.equal(escalationLevel(50, rule), 2);
  assert.equal(escalationLevel(100, rule), 3);
});

test("escalationLevel: قاعده غیرفعال هرگز تشدید نمی‌شود", () => {
  assert.equal(escalationLevel(500, { ...rule, active: false }), 0);
});

test("distributionGap: مخاطبان پوشش‌داده‌نشده برگردانده می‌شوند", () => {
  assert.deepEqual(distributionGap(["a", "b", "c"], ["a", "c"]), ["b"]);
  assert.deepEqual(distributionGap(["a"], ["a", "z"]), []);
});

/* ─────────── هشدار زودهنگام ─────────── */

test("ckmEws: نقض مهلت قراردادی همیشه بحرانی است", () => {
  const alerts = ckmEws({
    timeBarBreaches: 1, overdueLetters: 0, overdueActions: 0,
    avgResponseDays: 3, engagementGaps: 0, knowledgeUtilizationPct: 90, unapprovedMinutes: 0,
  });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].code, "EWS-CKM-01");
  assert.equal(alerts[0].severity, "critical");
});

test("ckmEws: وضعیت سالم هیچ هشداری تولید نمی‌کند", () => {
  assert.equal(
    ckmEws({
      timeBarBreaches: 0, overdueLetters: 2, overdueActions: 1,
      avgResponseDays: 6, engagementGaps: 0, knowledgeUtilizationPct: 75, unapprovedMinutes: 1,
    }).length,
    0
  );
});

test("ckmEws: هفت قاعده در بدترین حالت همگی فعال می‌شوند", () => {
  const alerts = ckmEws({
    timeBarBreaches: 2, overdueLetters: 9, overdueActions: 7,
    avgResponseDays: 18, engagementGaps: 3, knowledgeUtilizationPct: 12, unapprovedMinutes: 5,
  });
  assert.equal(alerts.length, 7);
});
