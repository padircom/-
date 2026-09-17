/**
 * آزمون موتور خالص — MOD-08 / HSE، تحویلی D7:
 * آموزش، بهداشت شغلی و محیط‌زیست (زیرماژول ۰۸٫۵).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  TRAINING_TYPES, PPE_TYPES, CRITICAL_PPE, EXAM_TYPES, FITNESS_RESULTS,
  WASTE_TYPES, MANIFEST_REQUIRED_WASTE, MONITORING_MEDIA, EXPIRY_WARNING_DAYS,
  INDUCTION_COURSE_CODE,
  trainingSessionState, personTrainingMatrix, personPpeState, personHealthState,
  personSiteClearance, nextExamDate,
  wasteLogState, wasteSummary, monitoringState, monitoringSummary,
  trainingSummary, healthPpeSummary,
  validateTrainingSessionInput, validatePpeInput, validateHealthExamInput,
  validateWasteInput, validateMonitoringInput,
} from "./hseLogic.js";

const NOW = new Date("2026-09-09T12:00:00.000Z");
const d = (s) => s; /* خوانایی */

/* ══════════════ واژگان ══════════════ */

test("واژگان کامل و بدون تکرار است", () => {
  assert.equal(TRAINING_TYPES.length, 5);
  assert.equal(PPE_TYPES.length, 9);
  assert.equal(EXAM_TYPES.length, 4);
  assert.equal(FITNESS_RESULTS.length, 4);
  assert.equal(WASTE_TYPES.length, 5);
  assert.equal(MONITORING_MEDIA.length, 5);
  for (const arr of [TRAINING_TYPES, PPE_TYPES, EXAM_TYPES, WASTE_TYPES, MONITORING_MEDIA]) {
    assert.equal(new Set(arr).size, arr.length, "کد تکراری در واژگان");
  }
});

test("تجهیز حیاتی زیرمجموعهٔ فهرست تجهیزات است", () => {
  for (const p of CRITICAL_PPE) assert.ok(PPE_TYPES.includes(p), `${p} در PPE_TYPES نیست`);
});

test("پسماند نیازمند مانیفست زیرمجموعهٔ انواع پسماند است", () => {
  for (const w of MANIFEST_REQUIRED_WASTE) assert.ok(WASTE_TYPES.includes(w));
});

/* ══════════════ ۱) جلسهٔ آموزش ══════════════ */

const session = (over = {}) => ({
  Id: "s1", ProjectId: "p1", SessionNo: "TRN-001", TitleFa: "ایمنی کار در ارتفاع",
  CourseCode: "HSE-HGT", TrainingType: "specialist", HeldAt: "2026-06-10T08:00:00.000Z",
  DurationMinutes: 120, InstructorFa: "مهندس رضایی", ValidityMonths: 12, Status: "held", ...over,
});
const att = (id, over = {}) => ({
  Id: id, ProjectId: "p1", SessionId: "s1", PersonRef: `w-${id}`, PersonNameFa: `کارگر ${id}`,
  Attended: true, Passed: true, ...over,
});

test("نرخ قبولی روی حاضران حساب می‌شود نه ثبت‌نام‌شدگان", () => {
  /* ۴ ثبت‌نام، ۲ حاضر، هر دو قبول ⇒ حضور ۵۰٪ ولی قبولی ۱۰۰٪.
   * اگر غایب در مخرج قبولی بیاید، عدد ۵۰٪ می‌شود و مربی بابت
   * غیبت کارگر مجازات می‌شود. */
  const st = trainingSessionState(session(), [
    att("a"), att("b"),
    att("c", { Attended: false, Passed: false }),
    att("e", { Attended: false, Passed: false }),
  ], NOW);
  assert.equal(st.registered, 4);
  assert.equal(st.attended, 2);
  assert.equal(st.passed, 2);
  assert.equal(st.absent, 2);
  assert.equal(st.attendanceRatePct, 50);
  assert.equal(st.passRatePct, 100, "قبولی باید روی حاضران باشد");
});

test("انقضای گواهی از تاریخ برگزاری مشتق می‌شود", () => {
  const st = trainingSessionState(session({ HeldAt: "2026-06-10T08:00:00.000Z", ValidityMonths: 12 }), [], NOW);
  assert.equal(st.certificateExpiry, "2027-06-10");
  assert.equal(st.isExpired, false);
});

test("جلسهٔ بدون مدت اعتبار، گواهی بی‌انقضا می‌دهد", () => {
  const st = trainingSessionState(session({ ValidityMonths: null }), [att("a")], NOW);
  assert.equal(st.certificateExpiry, null);
  assert.equal(st.expiresInDays, null);
  assert.equal(st.isExpired, false, "بی‌انقضا نباید منقضی شمرده شود");
});

test("گواهی منقضی‌شده هشدار بازآموزی می‌دهد", () => {
  const st = trainingSessionState(session({ HeldAt: "2024-01-10T08:00:00.000Z", ValidityMonths: 12 }), [att("a")], NOW);
  assert.equal(st.isExpired, true);
  assert.ok(st.expiresInDays < 0);
  assert.match(st.warningsFa.join(), /بازآموزی/);
});

test("جلسهٔ برگزارشدهٔ بدون حاضر هشدار می‌دهد", () => {
  const st = trainingSessionState(session(), [], NOW);
  assert.match(st.warningsFa.join(), /هیچ حاضری ندارد/);
});

test("نرخ قبولی پایین اثربخشی آموزش را زیر سؤال می‌برد", () => {
  const st = trainingSessionState(session(), [
    att("a"), att("b", { Passed: false }), att("c", { Passed: false }), att("e", { Passed: false }),
  ], NOW);
  assert.equal(st.passRatePct, 25);
  assert.match(st.warningsFa.join(), /اثربخشی/);
});

test("جلسهٔ فرد دیگر در آمار این جلسه نمی‌آید", () => {
  const st = trainingSessionState(session(), [att("a"), { ...att("z"), SessionId: "s2" }], NOW);
  assert.equal(st.registered, 1, "حاضر جلسهٔ دیگر نباید شمرده شود");
});

/* ══════════════ ۲) ماتریس آموزش فرد ══════════════ */

const rec = (code, over = {}) => ({
  Id: `r-${code}`, ProjectId: "p1", PersonRef: "w-1", CourseCode: code,
  CourseTitleFa: `دورهٔ ${code}`, CompletedAt: "2026-01-01", Status: "valid", ...over,
});

test("بدون آموزش بدو ورود، فرد مجاز نیست", () => {
  const m = personTrainingMatrix({ personRef: "w-1", records: [rec("HSE-HGT")], now: NOW });
  assert.equal(m.hasInduction, false);
  assert.equal(m.isCleared, false);
  assert.match(m.blockersFa.join(), /بدو ورود/);
});

test("با آموزش بدو ورود معتبر، فرد مجاز است", () => {
  const m = personTrainingMatrix({ personRef: "w-1", records: [rec(INDUCTION_COURSE_CODE)], now: NOW });
  assert.equal(m.hasInduction, true);
  assert.equal(m.isCleared, true);
  assert.deepEqual(m.blockersFa, []);
});

test("گواهی باطل‌شده معتبر نیست حتی بدون تاریخ انقضا", () => {
  const m = personTrainingMatrix({
    personRef: "w-1",
    records: [rec(INDUCTION_COURSE_CODE, { Status: "revoked" })],
    now: NOW,
  });
  assert.equal(m.hasInduction, false, "گواهی باطل نباید معتبر شمرده شود");
  assert.equal(m.expired.length, 1);
});

test("گواهی بدون تاریخ انقضا معتبر می‌ماند", () => {
  const m = personTrainingMatrix({ personRef: "w-1", records: [rec(INDUCTION_COURSE_CODE, { ExpiresAt: null })], now: NOW });
  assert.equal(m.valid.length, 1);
  assert.equal(m.valid[0].daysLeft, null);
});

test("گواهی نزدیک انقضا هشدار می‌دهد ولی هنوز معتبر است", () => {
  const soon = new Date(NOW.getTime() + 10 * 86_400_000).toISOString().slice(0, 10);
  const m = personTrainingMatrix({ personRef: "w-1", records: [rec(INDUCTION_COURSE_CODE, { ExpiresAt: soon })], now: NOW });
  assert.equal(m.isCleared, true, "نزدیک انقضا هنوز معتبر است");
  assert.equal(m.expiringSoon.length, 1);
  assert.match(m.warningsFa.join(), /منقضی می‌شود/);
});

test("گواهی که امروز منقضی می‌شود امروز هنوز معتبر است", () => {
  const today = NOW.toISOString().slice(0, 10);
  const m = personTrainingMatrix({ personRef: "w-1", records: [rec(INDUCTION_COURSE_CODE, { ExpiresAt: today })], now: NOW });
  assert.equal(m.hasInduction, true, "روز پایان باید کامل حساب شود");
});

test("دورهٔ الزامی نداشته دو بار گزارش نمی‌شود", () => {
  const m = personTrainingMatrix({
    personRef: "w-1", records: [],
    requiredCourses: [INDUCTION_COURSE_CODE, "HSE-CSE"], now: NOW,
  });
  const induction = m.blockersFa.filter((b) => /بدو ورود/.test(b));
  assert.equal(induction.length, 1, "آموزش بدو ورود نباید تکرار شود");
  assert.match(m.blockersFa.join(), /HSE-CSE/);
});

test("سابقهٔ فرد دیگر در ماتریس این فرد نمی‌آید", () => {
  const m = personTrainingMatrix({
    personRef: "w-1",
    records: [{ ...rec(INDUCTION_COURSE_CODE), PersonRef: "w-9" }],
    now: NOW,
  });
  assert.equal(m.valid.length, 0, "نشت میان افراد");
  assert.equal(m.hasInduction, false);
});

/* ══════════════ ۳) تجهیزات حفاظت فردی ══════════════ */

const ppe = (type, over = {}) => ({
  Id: `p-${type}`, ProjectId: "p1", IssueNo: `PPE-${type}`, PersonRef: "w-1",
  PersonNameFa: "کارگر یک", PpeType: type, IssuedAt: "2026-01-10", IssuedBy: "u-hse",
  Quantity: 1, Status: "issued", ...over,
});

test("نبود تجهیز حیاتی مانع است، نبود تجهیز عادی فقط هشدار", () => {
  const s = personPpeState({
    personRef: "w-1", issuances: [],
    requiredPpe: ["helmet", "gloves"], now: NOW,
  });
  assert.equal(s.isEquipped, false);
  assert.match(s.blockersFa.join(), /کلاه ایمنی/);
  assert.match(s.warningsFa.join(), /دستکش/);
  assert.ok(!s.blockersFa.join().includes("دستکش"), "دستکش نباید مانع باشد");
});

test("تجهیز بازگردانده‌شده در اختیار فرد نیست", () => {
  const s = personPpeState({
    personRef: "w-1",
    issuances: [ppe("helmet", { Status: "returned" })],
    requiredPpe: ["helmet"], now: NOW,
  });
  assert.equal(s.active.length, 0);
  assert.equal(s.isEquipped, false, "تجهیز بازگردانده نباید حاضر شمرده شود");
});

test("هارنس با تاریخ تعویض گذشته مانع است و در فهرست فعال نمی‌آید", () => {
  const s = personPpeState({
    personRef: "w-1",
    issuances: [ppe("harness", { ReplaceDueDate: "2026-06-01" })],
    requiredPpe: ["harness"], now: NOW,
  });
  assert.equal(s.overdue.length, 1);
  assert.equal(s.active.length, 0, "منقضی نباید فعال شمرده شود");
  assert.equal(s.isEquipped, false);
  assert.ok(s.overdue[0].overdueDays > 90);
});

test("تجهیز نزدیک تعویض هشدار می‌دهد ولی مانع نیست", () => {
  const soon = new Date(NOW.getTime() + 10 * 86_400_000).toISOString().slice(0, 10);
  const s = personPpeState({
    personRef: "w-1",
    issuances: [ppe("harness", { ReplaceDueDate: soon })],
    requiredPpe: ["harness"], now: NOW,
  });
  assert.equal(s.isEquipped, true);
  assert.equal(s.dueSoon.length, 1);
});

test("تجهیز مصرفی بدون تاریخ تعویض همیشه فعال است", () => {
  const s = personPpeState({
    personRef: "w-1",
    issuances: [ppe("gloves", { ReplaceDueDate: null })],
    requiredPpe: ["gloves"], now: NOW,
  });
  assert.equal(s.active.length, 1);
  assert.equal(s.active[0].daysLeft, null);
});

test("تجهیز فرد دیگر شمرده نمی‌شود", () => {
  const s = personPpeState({
    personRef: "w-1",
    issuances: [{ ...ppe("helmet"), PersonRef: "w-9" }],
    requiredPpe: ["helmet"], now: NOW,
  });
  assert.equal(s.active.length, 0, "نشت میان افراد");
});

/* ══════════════ ۴) طب کار ══════════════ */

const exam = (over = {}) => ({
  Id: "e1", ProjectId: "p1", ExamNo: "MED-001", PersonRef: "w-1", PersonNameFa: "کارگر یک",
  ExamType: "pre_employment", ExaminedAt: "2026-03-01", Fitness: "fit",
  NextExamDate: "2027-03-01", Status: "valid", ...over,
});

test("فرد با معاینهٔ بلامانع مجاز است", () => {
  const h = personHealthState({ personRef: "w-1", exams: [exam()], now: NOW });
  assert.equal(h.isCleared, true);
  assert.equal(h.fitness, "fit");
});

test("نتیجهٔ غیرمجاز مانع قطعی است", () => {
  const h = personHealthState({ personRef: "w-1", exams: [exam({ Fitness: "unfit" })], now: NOW });
  assert.equal(h.isCleared, false);
  assert.match(h.blockersFa.join(), /غیرمجاز/);
});

test("فقط آخرین معاینه ملاک است — غیرمجازِ پارسال فرد را مسدود نمی‌کند", () => {
  /* این حالت در عمل رایج است: کارگر پس از درمان دوباره معاینه می‌شود. */
  const h = personHealthState({
    personRef: "w-1",
    exams: [
      exam({ Id: "old", ExamNo: "MED-000", ExaminedAt: "2025-01-01", Fitness: "unfit" }),
      exam({ Id: "new", ExamNo: "MED-001", ExaminedAt: "2026-03-01", Fitness: "fit" }),
    ],
    now: NOW,
  });
  assert.equal(h.fitness, "fit", "آخرین معاینه باید ملاک باشد");
  assert.equal(h.isCleared, true);
});

test("معاینهٔ جایگزین‌شده نادیده گرفته می‌شود", () => {
  const h = personHealthState({
    personRef: "w-1",
    exams: [exam({ Fitness: "unfit", Status: "superseded" }), exam({ Id: "e2", ExamNo: "MED-002" })],
    now: NOW,
  });
  assert.equal(h.fitness, "fit");
});

test("معاینهٔ دوره‌ای معوق مانع است", () => {
  const h = personHealthState({
    personRef: "w-1",
    exams: [exam({ NextExamDate: "2026-06-01" })],
    now: NOW,
  });
  assert.equal(h.isOverdue, true);
  assert.equal(h.isCleared, false);
  assert.match(h.blockersFa.join(), /معوق/);
});

test("بلامانع مشروط بدون شرح، هشدار می‌دهد", () => {
  const h = personHealthState({
    personRef: "w-1",
    exams: [exam({ Fitness: "fit_with_restriction", RestrictionFa: null })],
    now: NOW,
  });
  assert.equal(h.isCleared, true, "مشروط مانع نیست");
  assert.match(h.warningsFa.join(), /شرح محدودیت ثبت نشده/);
});

test("بلامانع مشروط با شرح، محدودیت را بازمی‌گرداند", () => {
  const h = personHealthState({
    personRef: "w-1",
    exams: [exam({ Fitness: "fit_with_restriction", RestrictionFa: "کار در ارتفاع ممنوع" })],
    now: NOW,
  });
  assert.equal(h.restrictionFa, "کار در ارتفاع ممنوع");
  assert.match(h.warningsFa.join(), /کار در ارتفاع ممنوع/);
});

test("نبود هرگونه معاینه مانع است", () => {
  const h = personHealthState({ personRef: "w-1", exams: [], now: NOW });
  assert.equal(h.isCleared, false);
  assert.match(h.blockersFa.join(), /هیچ معاینهٔ طب کاری/);
});

test("عوامل زیان‌آور بر پایهٔ شغل فیلتر می‌شوند", () => {
  const hazards = [
    { Id: "h1", ProjectId: "p1", HazardCode: "NOISE", TitleFa: "صدا", HazardType: "noise", TradeCode: null, ExamIntervalMonths: 12, Status: "active" },
    { Id: "h2", ProjectId: "p1", HazardCode: "FUME", TitleFa: "دود جوش", HazardType: "chemical", TradeCode: "WLD", ExamIntervalMonths: 6, Status: "active" },
    { Id: "h3", ProjectId: "p1", HazardCode: "OLD", TitleFa: "منسوخ", HazardType: "dust", TradeCode: null, ExamIntervalMonths: 12, Status: "retired" },
  ];
  const welder = personHealthState({ personRef: "w-1", exams: [exam()], hazards, tradeCode: "WLD", now: NOW });
  assert.equal(welder.requiredHazards.length, 2, "عامل همگانی + عامل جوشکار");
  const driver = personHealthState({ personRef: "w-1", exams: [exam()], hazards, tradeCode: "DRV", now: NOW });
  assert.equal(driver.requiredHazards.length, 1, "فقط عامل همگانی");
});

test("محاسبهٔ تاریخ معاینهٔ بعدی، ماه کوتاه را می‌فهمد", () => {
  assert.equal(nextExamDate("2026-01-31", 1), "2026-02-28", "۳۱ + یک ماه نباید به مارس بپرد");
  assert.equal(nextExamDate("2026-03-15", 6), "2026-09-15");
  assert.equal(nextExamDate("2026-03-15", 0), null);
});

/* ══════════════ ۵) دروازهٔ ورود ══════════════ */

test("دروازهٔ ورود سه بُعد را با «و» ترکیب می‌کند", () => {
  const c = personSiteClearance({
    personRef: "w-1",
    trainings: [rec(INDUCTION_COURSE_CODE)],
    issuances: [ppe("helmet"), ppe("boots")],
    exams: [exam()],
    requiredPpe: ["helmet", "boots"],
    now: NOW,
  });
  assert.equal(c.ok, true, JSON.stringify(c.blockersFa));
  assert.equal(c.training.ok, true);
  assert.equal(c.ppe.ok, true);
  assert.equal(c.health.ok, true);
});

test("شکست هر بُعد کل دروازه را می‌بندد", () => {
  const base = {
    personRef: "w-1",
    trainings: [rec(INDUCTION_COURSE_CODE)],
    issuances: [ppe("helmet")],
    exams: [exam()],
    requiredPpe: ["helmet"],
    now: NOW,
  };
  assert.equal(personSiteClearance({ ...base, trainings: [] }).ok, false, "آموزش");
  assert.equal(personSiteClearance({ ...base, issuances: [] }).ok, false, "تجهیزات");
  assert.equal(personSiteClearance({ ...base, exams: [] }).ok, false, "سلامت");
});

test("مانع‌ها با پیشوند دامنه برمی‌گردند", () => {
  const c = personSiteClearance({ personRef: "w-1", now: NOW, requiredPpe: ["helmet"] });
  assert.match(c.blockersFa.join(), /آموزش:/);
  assert.match(c.blockersFa.join(), /تجهیزات:/);
  assert.match(c.blockersFa.join(), /سلامت:/);
});

/* ══════════════ ۶) پسماند ══════════════ */

const waste = (over = {}) => ({
  Id: "w1", ProjectId: "p1", WasteNo: "WST-001", WasteType: "non_hazardous",
  DescriptionFa: "نخالهٔ بتنی", Quantity: 10, Unit: "ton", GeneratedAt: "2026-09-01",
  DisposalMethod: "landfill", Status: "generated", ...over,
});

test("پسماند خطرناک بدون مانیفست، ناسازگار است", () => {
  const st = wasteLogState(waste({ WasteType: "hazardous", ManifestNo: null }), NOW);
  assert.equal(st.needsManifest, true);
  assert.equal(st.isCompliant, false);
  assert.match(st.issuesFa.join(), /مانیفست/);
});

test("پسماند عادی مانیفست نمی‌خواهد", () => {
  const st = wasteLogState(waste(), NOW);
  assert.equal(st.needsManifest, false);
  assert.equal(st.isCompliant, true);
});

test("پسماند مانده بیش از ۹۰ روز کهنه شمرده می‌شود", () => {
  const st = wasteLogState(waste({ GeneratedAt: "2026-01-01" }), NOW);
  assert.equal(st.isStale, true);
  assert.match(st.issuesFa.join(), /دفع نشده/);
});

test("پسماند دفع‌شدهٔ قدیمی کهنه نیست", () => {
  const st = wasteLogState(waste({ GeneratedAt: "2026-01-01", Status: "disposed", DisposedAt: "2026-01-15" }), NOW);
  assert.equal(st.isStale, false, "دفع‌شده دیگر در کارگاه نیست");
});

test("وضعیت دفع‌شده بدون تاریخ دفع، ایراد دارد", () => {
  const st = wasteLogState(waste({ Status: "disposed", DisposedAt: null }), NOW);
  assert.match(st.issuesFa.join(), /تاریخ دفع/);
});

test("نرخ بازیافت به تفکیک واحد حساب می‌شود", () => {
  /* اگر تعدادی بشماریم: ۲ از ۳ ردیف بازیافتی ⇒ ۶۶٪.
   * جرمی: ۵ از ۱۰۵ تن ⇒ ۴٫۷۶٪. تفاوت همین‌جاست. */
  const s = wasteSummary([
    waste({ Id: "a", WasteNo: "W1", WasteType: "construction", Quantity: 100, Unit: "ton" }),
    waste({ Id: "b", WasteNo: "W2", WasteType: "recyclable", Quantity: 3, Unit: "ton" }),
    waste({ Id: "c", WasteNo: "W3", WasteType: "recyclable", Quantity: 2, Unit: "ton" }),
  ], NOW);
  assert.equal(s.quantityByUnit.ton, 105);
  assert.equal(s.recycledQuantityByUnit.ton, 5);
  assert.equal(s.recyclingRatePctByUnit.ton, 4.76);
});

test("واحدهای ناهمگن با هم جمع نمی‌شوند", () => {
  const s = wasteSummary([
    waste({ Id: "a", WasteNo: "W1", Quantity: 10, Unit: "ton" }),
    waste({ Id: "b", WasteNo: "W2", Quantity: 500, Unit: "liter" }),
  ], NOW);
  assert.equal(s.quantityByUnit.ton, 10);
  assert.equal(s.quantityByUnit.liter, 500);
  assert.ok(!("510" in s.quantityByUnit), "جمع بین واحدها ممنوع");
});

test("خلاصهٔ پسماند فقدان مانیفست را می‌شمارد", () => {
  const s = wasteSummary([
    waste({ Id: "a", WasteNo: "W1", WasteType: "hazardous", ManifestNo: null }),
    waste({ Id: "b", WasteNo: "W2", WasteType: "hazardous", ManifestNo: "MF-9" }),
  ], NOW);
  assert.equal(s.missingManifest, 1);
  assert.equal(s.nonCompliantFa.length, 1);
  assert.match(s.warningsFa.join(), /مانیفست/);
});

test("روش دفع بازیافت، پسماند غیربازیافتی را هم بازیافتی می‌شمارد", () => {
  const s = wasteSummary([
    waste({ Id: "a", WasteNo: "W1", WasteType: "construction", DisposalMethod: "recycling", Quantity: 20, Unit: "ton" }),
  ], NOW);
  assert.equal(s.recycledQuantityByUnit.ton, 20, "روش دفع هم ملاک بازیافت است");
});

/* ══════════════ ۷) پایش زیست‌محیطی ══════════════ */

const rd = (over = {}) => ({
  Id: "m1", ProjectId: "p1", ReadingNo: "ENV-001", Medium: "effluent",
  ParameterFa: "COD", MeasuredAt: "2026-09-01T10:00:00.000Z",
  MeasuredValue: 80, Unit: "mg/l", LimitValue: 100, Status: "recorded", ...over,
});

test("اندازه‌گیری زیر حد، منطبق است", () => {
  const st = monitoringState(rd());
  assert.equal(st.isExceeded, false);
  assert.equal(st.exceedancePct, 0);
  assert.equal(st.ratio, 0.8);
});

test("۹۰ درصد حد، نزدیک حد شمرده می‌شود", () => {
  const st = monitoringState(rd({ MeasuredValue: 92 }));
  assert.equal(st.isExceeded, false);
  assert.equal(st.isNearLimit, true);
  assert.match(st.severityFa, /نزدیک/);
});

test("فراتررفتن از حد، درصد تجاوز را می‌دهد", () => {
  const st = monitoringState(rd({ MeasuredValue: 150 }));
  assert.equal(st.isExceeded, true);
  assert.equal(st.exceedancePct, 50);
  assert.equal(st.needsAction, true, "بدون اقدام اصلاحی");
});

test("فراتررفتن با اقدام اصلاحی دیگر نیازمند اقدام نیست", () => {
  const st = monitoringState(rd({ MeasuredValue: 150, CorrectiveActionFa: "تنظیم واحد تصفیه" }));
  assert.equal(st.isExceeded, true);
  assert.equal(st.needsAction, false);
});

test("حد مجاز صفر یا منفی، اندازه‌گیری را نامعتبر می‌کند", () => {
  const st = monitoringState(rd({ LimitValue: 0 }));
  assert.equal(st.ratio, null);
  assert.match(st.issuesFa.join(), /نامعتبر/);
});

test("اندازه‌گیری نامعتبر نه در صورت می‌آید نه در مخرج", () => {
  /* دو معتبر (یکی فراتر) + یک نامعتبر ⇒ نرخ انطباق ۵۰٪ نه ۶۶٪. */
  const s = monitoringSummary([
    rd({ Id: "a", ReadingNo: "E1", MeasuredValue: 50 }),
    rd({ Id: "b", ReadingNo: "E2", MeasuredValue: 150 }),
    rd({ Id: "c", ReadingNo: "E3", LimitValue: 0 }),
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.exceeded, 1);
  assert.equal(s.complianceRatePct, 50, "ردیف نامعتبر باید از هر دو طرف کسر بیرون بماند");
});

test("بدترین تجاوز شناسایی می‌شود", () => {
  const s = monitoringSummary([
    rd({ Id: "a", ReadingNo: "E1", MeasuredValue: 120 }),
    rd({ Id: "b", ReadingNo: "E2", MeasuredValue: 300, ParameterFa: "روغن" }),
  ]);
  assert.match(s.worstFa, /E2/);
  assert.match(s.worstFa, /روغن/);
});

test("تجاوز بدون اقدام اصلاحی شمرده و هشدار داده می‌شود", () => {
  const s = monitoringSummary([
    rd({ Id: "a", ReadingNo: "E1", MeasuredValue: 150 }),
    rd({ Id: "b", ReadingNo: "E2", MeasuredValue: 150, CorrectiveActionFa: "اصلاح شد" }),
  ]);
  assert.equal(s.exceeded, 2);
  assert.equal(s.exceededWithoutAction, 1);
  assert.match(s.warningsFa.join(), /بدون اقدام اصلاحی/);
});

/* ══════════════ ۸) خلاصه‌های تجمیعی ══════════════ */

test("نفرساعت آموزش فقط از حاضران جلسهٔ برگزارشده", () => {
  const s = trainingSummary({
    sessions: [session({ DurationMinutes: 120 }), session({ Id: "s2", SessionNo: "TRN-002", Status: "planned" })],
    attendees: [att("a"), att("b"), att("c", { Attended: false })],
    now: NOW,
  });
  assert.equal(s.totalSessions, 2);
  assert.equal(s.heldSessions, 1);
  assert.equal(s.totalManHours, 4, "۲ حاضر × ۲ ساعت");
});

test("خلاصهٔ آموزش افراد بدون بدو ورود را فهرست می‌کند", () => {
  const s = trainingSummary({
    sessions: [session()],
    attendees: [att("a"), att("b")],
    records: [{ ...rec(INDUCTION_COURSE_CODE), PersonRef: "w-a" }],
    now: NOW,
  });
  assert.deepEqual(s.personsWithoutInduction, ["w-b"]);
  assert.match(s.warningsFa.join(), /بدون آموزش بدو ورود/);
});

test("گواهی منقضی در خلاصه شمرده می‌شود", () => {
  const s = trainingSummary({
    sessions: [], attendees: [],
    records: [
      rec("A", { ExpiresAt: "2026-01-01" }),
      rec("B", { ExpiresAt: "2027-01-01" }),
      rec("C", { Status: "revoked" }),
    ],
    now: NOW,
  });
  assert.equal(s.expiredCertificates, 2, "منقضی + باطل");
  assert.equal(s.validCertificates, 1);
});

test("خلاصهٔ سلامت فقط آخرین معاینهٔ هر فرد را می‌شمارد", () => {
  const s = healthPpeSummary({
    issuances: [],
    exams: [
      exam({ Id: "1", ExamNo: "M1", PersonRef: "w-1", ExaminedAt: "2025-01-01", Fitness: "unfit" }),
      exam({ Id: "2", ExamNo: "M2", PersonRef: "w-1", ExaminedAt: "2026-03-01", Fitness: "fit" }),
    ],
    now: NOW,
  });
  assert.equal(s.byFitness.unfit, 0, "معاینهٔ قدیمی نباید شمرده شود");
  assert.equal(s.byFitness.fit, 1);
  assert.deepEqual(s.unfitPersons, []);
});

test("هزینهٔ تجهیزات از تعداد در بهای واحد", () => {
  const s = healthPpeSummary({
    issuances: [ppe("gloves", { Quantity: 10, UnitCost: 50000 })],
    exams: [], now: NOW,
  });
  assert.equal(s.totalPpeCost, 500000);
});

test("تجهیز معوق در فعال شمرده نمی‌شود", () => {
  const s = healthPpeSummary({
    issuances: [ppe("harness", { ReplaceDueDate: "2026-01-01" }), ppe("helmet")],
    exams: [], now: NOW,
  });
  assert.equal(s.overdueReplacement, 1);
  assert.equal(s.activeIssuances, 1);
  assert.match(s.warningsFa.join(), /تاریخ تعویض/);
});

/* ══════════════ ۹) اعتبارسنجی ══════════════ */

test("جلسهٔ آموزش بدون مدرس یا مدت رد می‌شود", () => {
  const issues = validateTrainingSessionInput({
    SessionNo: "T1", TitleFa: "x", CourseCode: "C", TrainingType: "toolbox",
    HeldAt: "2026-09-01T08:00:00.000Z", DurationMinutes: 0, InstructorFa: "",
  });
  const codes = issues.map((i) => i.code);
  assert.ok(codes.includes("E-HSE-SESSION-DURATION"));
  assert.ok(codes.includes("E-HSE-SESSION-INSTRUCTOR"));
});

test("نوع آموزش نامعتبر رد می‌شود", () => {
  const issues = validateTrainingSessionInput({ TrainingType: "workshop" });
  assert.ok(issues.some((i) => i.code === "E-HSE-SESSION-TYPE"));
});

test("هارنس بدون تاریخ تعویض رد می‌شود", () => {
  const issues = validatePpeInput({
    IssueNo: "P1", PersonRef: "w-1", PpeType: "harness", Quantity: 1, IssuedAt: "2026-09-01",
  });
  assert.ok(issues.some((i) => i.code === "E-HSE-PPE-REPLACE-REQUIRED"));
});

test("دستکش بدون تاریخ تعویض پذیرفته می‌شود", () => {
  const issues = validatePpeInput({
    IssueNo: "P1", PersonRef: "w-1", PpeType: "gloves", Quantity: 5, IssuedAt: "2026-09-01",
  });
  assert.deepEqual(issues, [], "تجهیز مصرفی تاریخ تعویض نمی‌خواهد");
});

test("معاینهٔ مشروط بدون شرح محدودیت رد می‌شود", () => {
  const issues = validateHealthExamInput({
    ExamNo: "M1", PersonRef: "w-1", ExamType: "periodic",
    Fitness: "fit_with_restriction", ExaminedAt: "2026-09-01",
  });
  assert.ok(issues.some((i) => i.code === "E-HSE-EXAM-RESTRICTION-REQUIRED"));
});

test("معاینهٔ مشروط با شرح پذیرفته می‌شود", () => {
  const issues = validateHealthExamInput({
    ExamNo: "M1", PersonRef: "w-1", ExamType: "periodic",
    Fitness: "fit_with_restriction", ExaminedAt: "2026-09-01",
    RestrictionFa: "بدون کار شب",
  });
  assert.deepEqual(issues, []);
});

test("پسماند خطرناک بدون مانیفست در اعتبارسنجی رد می‌شود", () => {
  const issues = validateWasteInput({
    WasteNo: "W1", WasteType: "hazardous", DescriptionFa: "روغن",
    Quantity: 5, Unit: "liter", DisposalMethod: "licensed_contractor",
  });
  assert.ok(issues.some((i) => i.code === "E-HSE-WASTE-MANIFEST-REQUIRED"));
});

test("پسماند مایع هم مانیفست می‌خواهد", () => {
  const issues = validateWasteInput({
    WasteNo: "W1", WasteType: "liquid", DescriptionFa: "پساب",
    Quantity: 5, Unit: "liter", DisposalMethod: "treatment",
  });
  assert.ok(issues.some((i) => i.code === "E-HSE-WASTE-MANIFEST-REQUIRED"));
});

test("مقدار صفر پسماند رد می‌شود", () => {
  const issues = validateWasteInput({
    WasteNo: "W1", WasteType: "non_hazardous", DescriptionFa: "x",
    Quantity: 0, Unit: "kg", DisposalMethod: "landfill",
  });
  assert.ok(issues.some((i) => i.code === "E-HSE-WASTE-QTY"));
});

test("پایش با حد مجاز صفر رد می‌شود", () => {
  const issues = validateMonitoringInput({
    ReadingNo: "E1", Medium: "air", ParameterFa: "PM10",
    MeasuredValue: 10, LimitValue: 0, Unit: "mg/m3", MeasuredAt: "2026-09-01T10:00:00.000Z",
  });
  assert.ok(issues.some((i) => i.code === "E-HSE-ENV-LIMIT"));
});

test("پایش معتبر بدون ایراد است", () => {
  const issues = validateMonitoringInput({
    ReadingNo: "E1", Medium: "effluent", ParameterFa: "COD",
    MeasuredValue: 80, LimitValue: 100, Unit: "mg/l", MeasuredAt: "2026-09-01T10:00:00.000Z",
  });
  assert.deepEqual(issues, []);
});

test("مقدار اندازه‌گیری صفر معتبر است", () => {
  /* صفر یعنی «آلاینده‌ای یافت نشد» — نتیجهٔ کاملاً مشروع. */
  const issues = validateMonitoringInput({
    ReadingNo: "E1", Medium: "water", ParameterFa: "سرب",
    MeasuredValue: 0, LimitValue: 5, Unit: "mg/l", MeasuredAt: "2026-09-01T10:00:00.000Z",
  });
  assert.deepEqual(issues, [], "صفر مقدار معتبری است");
});

/* ══════════════ ۱۰) شمارندهٔ محافظ اسکیما ══════════════ */

test("آستانهٔ هشدار انقضا در سه حوزه یکسان است", () => {
  assert.equal(EXPIRY_WARNING_DAYS, 30);
});

/* ══════════════ ۱۱) محافظ اسکیما ══════════════ */

import { SCHEMA, MIGRATIONS } from "./sqlLogic.js";

test("هفت جدول آموزش، بهداشت و محیط‌زیست در اسکیما هستند", () => {
  const want = [
    "TrainingSession", "TrainingAttendee", "PpeIssuance",
    "OccupationalHazard", "HealthExamination", "WasteLog", "EnvironmentalMonitoring",
  ];
  for (const n of want) {
    const t = SCHEMA.find((x) => x.name === n);
    assert.ok(t, `جدول ${n} نیست`);
    assert.equal(t.module, "d16");
  }
  /* SafetyTrainingRecord از قبل موجود بود و نباید دوباره ساخته شود. */
  assert.ok(SCHEMA.find((x) => x.name === "SafetyTrainingRecord"), "جدول قدیمی حذف شده");
});

test("مهاجرت 0020 بدون حذف مهاجرت‌های قبلی افزوده شده", () => {
  const v = MIGRATIONS.map((m) => m.version);
  assert.ok(v.includes("0019"), "مهاجرت تخلف و توقف کار نباید حذف شود");
  assert.ok(v.includes("0020"), "مهاجرت آموزش و محیط‌زیست نیست");
  /* «آخرین مهاجرت» ادعای شکننده‌ای است: هر ماژول بعدی آن را
   * می‌شکند بی‌آنکه چیزی دربارهٔ این ماژول بگوید. چیزی که باید
   * ثابت بماند نبودن شکاف و ترتیب صعودی است. */
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
  const m = MIGRATIONS.find((x) => x.version === "0020");
  assert.ok(m.statements.length >= 7, "دست‌کم هفت CREATE TABLE");
  assert.equal(m.statements.filter((s) => /DROP/i.test(s)).length, 0, "هیچ DROP مجاز نیست");
});

test("ستون‌های کلید یکتا هیچ‌کدام nullable نیستند", () => {
  const mine = [
    "TrainingSession", "TrainingAttendee", "PpeIssuance",
    "OccupationalHazard", "HealthExamination", "WasteLog", "EnvironmentalMonitoring",
  ];
  for (const n of mine) {
    const t = SCHEMA.find((x) => x.name === n);
    for (const ix of t.indexes ?? []) {
      if (!ix.unique) continue;
      for (const cn of ix.columns) {
        const col = t.columns.find((c) => c.name === cn);
        assert.ok(col, `${n}.${cn} وجود ندارد`);
        assert.equal(col.nullable, false, `${n}.${cn} در ایندکس یکتا nullable است`);
      }
    }
  }
});
