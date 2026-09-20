/**
 * آزمون موتور شاخص، نمرهٔ ایمنی و هشدار زودهنگام — MOD-08 بخش ۷ (۰۸٫۶).
 *
 * تمرکز آزمون‌ها بر تمایز «صفر» از «نامعلوم» است: هر جا دادهٔ پایه
 * نباشد، شاخص باید `null` بدهد نه صفر. صفر یعنی سنجیدیم و مشکلی نبود.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  HSE_METRIC_CODES, HSE_METRIC_FA, HSE_METRIC_UNIT, HSE_METRIC_DIRECTION,
  HSE_METRIC_DEFAULT_TARGET, HSE_ALERT_RULES, HSE_ALERT_RULE_FA, HSE_ALERT_DEFAULTS,
  HSE_SCORE_WEIGHTS, HSE_SCORE_BLOCKED_CAP,
  periodCodeOf, periodRange,
  permitComplianceMetric, trainingHoursMetric, violationClosureMetric,
  metricVerdict, hseMetricSet, evaluateHseAlerts, hseScore, metricTrend,
  hseDashboard, buildMetricSnapshots, hseHealthContribution, validateAlertRuleInput,
} from "./hseLogic.js";

const NOW = new Date("2026-09-15T12:00:00.000Z");

/* ── سازنده‌ها ── */
const permit = (o = {}) => ({
  Id: o.Id ?? `pm-${Math.random().toString(36).slice(2, 8)}`,
  ProjectId: "p1",
  PermitNo: o.PermitNo ?? "PTW-1",
  PermitType: o.PermitType ?? "hot",
  TitleFa: "کار گرم",
  RequestedBy: "u-1",
  ValidFrom: o.ValidFrom ?? "2026-09-01T08:00:00.000Z",
  ValidTo: o.ValidTo ?? "2026-09-30T17:00:00.000Z",
  Status: o.Status ?? "active",
  ...o,
});

const incident = (o = {}) => ({
  Id: o.Id ?? `in-${Math.random().toString(36).slice(2, 8)}`,
  ProjectId: "p1",
  IncidentNo: o.IncidentNo ?? "INC-1",
  IncidentType: o.IncidentType ?? "lost_time",
  TitleFa: "حادثه",
  OccurredAt: o.OccurredAt ?? "2026-09-05T10:00:00.000Z",
  Severity: o.Severity ?? "high",
  Status: o.Status ?? "closed",
  ...o,
});

const manHour = (o = {}) => ({
  Id: o.Id ?? `mh-${Math.random().toString(36).slice(2, 8)}`,
  ProjectId: "p1",
  LogDate: o.LogDate ?? "2026-09-10",
  ManHours: o.ManHours ?? 100000,
  ...o,
});

const violation = (o = {}) => ({
  Id: o.Id ?? `vi-${Math.random().toString(36).slice(2, 8)}`,
  ProjectId: "p1",
  ViolationNo: o.ViolationNo ?? "VIO-1",
  ViolationType: o.ViolationType ?? "ppe",
  TitleFa: "تخلف",
  IssuedAt: o.IssuedAt ?? "2026-09-02T09:00:00.000Z",
  IssuedBy: "u-hse",
  Severity: o.Severity ?? "medium",
  Status: o.Status ?? "open",
  ...o,
});

const session = (o = {}) => ({
  Id: o.Id ?? `tr-${Math.random().toString(36).slice(2, 8)}`,
  ProjectId: "p1",
  SessionNo: o.SessionNo ?? "TRN-1",
  TitleFa: "دوره",
  CourseCode: o.CourseCode ?? "HSE-IND",
  TrainingType: o.TrainingType ?? "induction",
  HeldAt: o.HeldAt ?? "2026-09-03T08:00:00.000Z",
  DurationMinutes: o.DurationMinutes ?? 240,
  InstructorFa: "مدرس",
  Status: o.Status ?? "held",
  ...o,
});

const attendee = (sessionId, personRef, o = {}) => ({
  Id: `at-${personRef}-${sessionId}`,
  ProjectId: "p1",
  SessionId: sessionId,
  PersonRef: personRef,
  PersonNameFa: personRef,
  Attended: o.Attended !== false,
  Passed: o.Passed !== false,
  ...o,
});

const gasTest = (isSafe) => ({
  Id: `g-${Math.random().toString(36).slice(2, 8)}`,
  ProjectId: "p1",
  PermitId: "pm-1",
  TestedAt: "2026-09-10T08:00:00.000Z",
  IsSafe: isSafe,
  TestedBy: "u-hse",
});

const reading = (o = {}) => ({
  Id: o.Id ?? `en-${Math.random().toString(36).slice(2, 8)}`,
  ProjectId: "p1",
  ReadingNo: o.ReadingNo ?? "ENV-1",
  Medium: o.Medium ?? "air",
  ParameterFa: "غبار",
  MeasuredAt: o.MeasuredAt ?? "2026-09-08T10:00:00.000Z",
  MeasuredValue: o.MeasuredValue ?? 5,
  Unit: "mg/m3",
  LimitValue: o.LimitValue ?? 10,
  Status: o.Status ?? "recorded",
  ...o,
});

const snapshot = (periodCode, metricCode, value, o = {}) => ({
  Id: `sn-${periodCode}-${metricCode}`,
  ProjectId: "p1",
  PeriodCode: periodCode,
  MetricCode: metricCode,
  Value: value,
  Unit: "rate",
  CapturedAt: `${periodCode}-28T00:00:00.000Z`,
  Status: o.Status ?? "published",
  ...o,
});

/* ══════════════ ۱) واژگان و ثابت‌ها ══════════════ */

test("شش شاخص و پنج قاعده تعریف شده‌اند", () => {
  assert.equal(HSE_METRIC_CODES.length, 6);
  assert.equal(HSE_ALERT_RULES.length, 5);
  for (const c of HSE_METRIC_CODES) {
    assert.ok(HSE_METRIC_FA[c], `عنوان ${c} نیست`);
    assert.ok(HSE_METRIC_UNIT[c], `واحد ${c} نیست`);
    assert.ok(HSE_METRIC_DIRECTION[c], `جهت ${c} نیست`);
    assert.ok(Number.isFinite(HSE_METRIC_DEFAULT_TARGET[c]), `هدف ${c} نیست`);
  }
  for (const r of HSE_ALERT_RULES) {
    assert.ok(HSE_ALERT_RULE_FA[r]);
    assert.ok(HSE_ALERT_DEFAULTS[r], `پیش‌فرض ${r} نیست`);
    assert.ok(HSE_ALERT_DEFAULTS[r].actionFa, `اقدام پیشنهادی ${r} نیست`);
  }
});

test("جهت شاخص‌های نرخ حادثه «کمتر بهتر» است", () => {
  assert.equal(HSE_METRIC_DIRECTION.ltifr, "lower_better");
  assert.equal(HSE_METRIC_DIRECTION.trir, "lower_better");
  assert.equal(HSE_METRIC_DIRECTION.permit_compliance, "higher_better");
});

test("وزن‌ها روی پنج شاخص پایه جمعشان صد است", () => {
  const sum = Object.values(HSE_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(sum, 100);
  /* نمرهٔ ایمنی نباید در وزن خودش بیاید. */
  assert.equal(HSE_SCORE_WEIGHTS.hse_score, undefined);
});

test("گازسنجی ناایمن و توقف کار آستانهٔ صفر و شدت بحرانی دارند", () => {
  for (const c of ["unsafe_gas", "active_stop_work"]) {
    assert.equal(HSE_ALERT_DEFAULTS[c].threshold, 0);
    assert.equal(HSE_ALERT_DEFAULTS[c].severity, "critical");
  }
});

/* ══════════════ ۲) دوره ══════════════ */

test("کد دوره از تاریخ ساخته می‌شود", () => {
  assert.equal(periodCodeOf("2026-09-15T12:00:00.000Z"), "2026-09");
  assert.equal(periodCodeOf("2026-01-01T00:00:00.000Z"), "2026-01");
  assert.equal(periodCodeOf("نامعتبر"), "");
});

test("بازهٔ دوره آخرین روز ماه را درست می‌دهد", () => {
  assert.deepEqual(periodRange("2026-09"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(periodRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  /* سال کبیسه نباید یک روز گم کند. */
  assert.deepEqual(periodRange("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(periodRange("2026-12"), { from: "2026-12-01", to: "2026-12-31" });
});

test("کد دورهٔ نامعتبر null می‌دهد", () => {
  assert.equal(periodRange("2026-13"), null);
  assert.equal(periodRange("بد"), null);
  assert.equal(periodRange("2026-9"), null);
});

/* ══════════════ ۳) انطباق پروانه ══════════════ */

test("بدون پروانه، انطباق نامعلوم است نه صد درصد", () => {
  const r = permitComplianceMetric([], NOW);
  assert.equal(r.value, null, "نبود پروانه نباید انطباق کامل تعبیر شود");
  assert.ok(r.warningsFa.length);
});

test("پروانهٔ منقضی بازنشده از انطباق کم می‌کند", () => {
  const r = permitComplianceMetric([
    permit({ Status: "active" }),
    permit({ ValidTo: "2026-09-01T17:00:00.000Z", Status: "active" }),
    permit({ ValidTo: "2026-09-01T17:00:00.000Z", Status: "closed" }),
    permit({ Status: "active" }),
  ], NOW);
  assert.equal(r.total, 4);
  assert.equal(r.expiredOpen, 1, "فقط یکی منقضی و بازمانده");
  assert.equal(r.compliant, 3);
  assert.equal(r.value, 75);
});

test("پروانهٔ لغوشده منقضیِ باز شمرده نمی‌شود", () => {
  const r = permitComplianceMetric([
    permit({ ValidTo: "2026-08-01T17:00:00.000Z", Status: "cancelled" }),
  ], NOW);
  assert.equal(r.expiredOpen, 0);
  assert.equal(r.value, 100);
});

/* ══════════════ ۴) ساعت آموزش سرانه ══════════════ */

test("سرانه با شمار کارکنان صریح محاسبه می‌شود", () => {
  const s = session({ Id: "s1", DurationMinutes: 240 });
  const r = trainingHoursMetric({
    sessions: [s],
    attendees: [attendee("s1", "w1"), attendee("s1", "w2")],
    headCount: 10,
  });
  /* ۲ نفر × ۴ ساعت = ۸ نفرساعت ÷ ۱۰ نفر = ۰٫۸ */
  assert.equal(r.totalManHours, 8);
  assert.equal(r.value, 0.8);
  assert.equal(r.basis, "headcount");
  assert.equal(r.warningsFa.length, 0);
});

test("بدون شمار کارکنان به حاضران برمی‌گردد و صریح هشدار می‌دهد", () => {
  const s = session({ Id: "s1", DurationMinutes: 240 });
  const r = trainingHoursMetric({
    sessions: [s],
    attendees: [attendee("s1", "w1"), attendee("s1", "w2")],
  });
  assert.equal(r.basis, "attendees");
  assert.equal(r.value, 4, "۸ نفرساعت ÷ ۲ حاضر");
  assert.ok(r.warningsFa.some((w) => /بالاتر/.test(w)), "باید بگوید عدد خوش‌بینانه است");
});

test("غایب در نفرساعت آموزش شمرده نمی‌شود", () => {
  const s = session({ Id: "s1", DurationMinutes: 120 });
  const r = trainingHoursMetric({
    sessions: [s],
    attendees: [attendee("s1", "w1"), attendee("s1", "w2", { Attended: false })],
    headCount: 2,
  });
  assert.equal(r.totalManHours, 2, "فقط یک نفر × ۲ ساعت");
});

test("جلسهٔ برنامه‌ریزی‌شده نفرساعت نمی‌سازد", () => {
  const s = session({ Id: "s1", Status: "planned", DurationMinutes: 600 });
  const withHead = trainingHoursMetric({
    sessions: [s],
    attendees: [attendee("s1", "w1")],
    headCount: 1,
  });
  /* با شمار کارکنانِ صریح، «صفر ساعت آموزش» یک واقعیت سنجیده است نه
   * دادهٔ گمشده — پس صفر درست است، نه تهی. */
  assert.equal(withHead.totalManHours, 0);
  assert.equal(withHead.value, 0);

  /* ولی بدون شمار کارکنان، مخرج وجود ندارد و نتیجه نامعلوم است. */
  const noHead = trainingHoursMetric({ sessions: [s], attendees: [attendee("s1", "w1")] });
  assert.equal(noHead.value, null, "بدون مخرج، نامعلوم نه صفر");
});

test("جلسهٔ بیرون از بازه شمرده نمی‌شود", () => {
  const inside = session({ Id: "s1", HeldAt: "2026-09-10T08:00:00.000Z", DurationMinutes: 60 });
  const outside = session({ Id: "s2", HeldAt: "2026-07-10T08:00:00.000Z", DurationMinutes: 600 });
  const r = trainingHoursMetric({
    sessions: [inside, outside],
    attendees: [attendee("s1", "w1"), attendee("s2", "w1")],
    headCount: 1,
    from: "2026-09-01",
    to: "2026-09-30",
  });
  assert.equal(r.totalManHours, 1);
});

/* ══════════════ ۵) نرخ رفع تخلف ══════════════ */

test("تخلفی که هنوز مهلت دارد در مخرج نمی‌آید", () => {
  const r = violationClosureMetric([
    violation({ Status: "open", DueDate: "2026-09-30" }),
    violation({ Status: "closed" }),
  ], NOW);
  assert.equal(r.due, 1, "فقط تخلف بسته‌شده سررسید شمرده می‌شود");
  assert.equal(r.value, 100);
});

test("تخلف معوق نرخ را پایین می‌آورد", () => {
  const r = violationClosureMetric([
    violation({ Status: "closed" }),
    violation({ Status: "closed" }),
    violation({ Status: "open", DueDate: "2026-09-01" }),
    violation({ Status: "open", DueDate: "2026-08-20" }),
  ], NOW);
  assert.equal(r.due, 4);
  assert.equal(r.closed, 2);
  assert.equal(r.overdue, 2);
  assert.equal(r.value, 50);
});

test("تخلف لغوشده در نرخ نمی‌آید", () => {
  const r = violationClosureMetric([
    violation({ Status: "cancelled", DueDate: "2026-01-01" }),
  ], NOW);
  assert.equal(r.value, null);
  assert.equal(r.due, 0);
});

test("بدون تخلف سررسیدشده نرخ نامعلوم است نه صد", () => {
  const r = violationClosureMetric([], NOW);
  assert.equal(r.value, null);
});

/* ══════════════ ۶) داوری شاخص ══════════════ */

test("مقدار تهی «نامعلوم» است نه قبول", () => {
  const v = metricVerdict("ltifr", null);
  assert.equal(v.code, "unknown");
  assert.equal(v.isMet, null, "نه true نه false");
});

test("شاخص کمتر-بهتر زیر هدف قبول است", () => {
  assert.equal(metricVerdict("ltifr", 0.3, 0.5).code, "met");
  assert.equal(metricVerdict("ltifr", 0.5, 0.5).code, "met");
  assert.equal(metricVerdict("ltifr", 0.55, 0.5).code, "near");
  assert.equal(metricVerdict("ltifr", 1.5, 0.5).code, "missed");
});

test("شاخص بیشتر-بهتر بالای هدف قبول است", () => {
  assert.equal(metricVerdict("permit_compliance", 96, 95).code, "met");
  assert.equal(metricVerdict("permit_compliance", 90, 95).code, "near");
  assert.equal(metricVerdict("permit_compliance", 50, 95).code, "missed");
});

/* ══════════════ ۷) مجموعهٔ شاخص ══════════════ */

test("پروژهٔ بدون هیچ داده‌ای همهٔ شاخص‌ها را تهی می‌دهد نه صفر", () => {
  const r = hseMetricSet({ periodCode: "2026-09", now: NOW });
  assert.equal(r.metrics.length, 5);
  for (const m of r.metrics) {
    assert.equal(m.value, null, `${m.code} باید تهی باشد`);
    assert.equal(m.verdict.isMet, null);
  }
  assert.ok(r.warningsFa.length >= 3);
});

test("مجموعهٔ شاخص با دادهٔ کامل درست محاسبه می‌شود", () => {
  const s = session({ Id: "s1", DurationMinutes: 240 });
  const r = hseMetricSet({
    periodCode: "2026-09",
    incidents: [incident({ IncidentType: "lost_time" }), incident({ IncidentType: "medical_treatment" })],
    manHourLogs: [manHour({ ManHours: 200000 })],
    permits: [permit(), permit({ ValidTo: "2026-09-02T17:00:00.000Z", Status: "active" })],
    violations: [violation({ Status: "closed" }), violation({ Status: "open", DueDate: "2026-09-01" })],
    sessions: [s],
    attendees: [attendee("s1", "w1"), attendee("s1", "w2")],
    headCount: 4,
    now: NOW,
  });

  const by = Object.fromEntries(r.metrics.map((m) => [m.code, m]));
  assert.equal(by.permit_compliance.value, 50);
  assert.equal(by.violation_closure_rate.value, 50);
  assert.equal(by.training_hours_per_worker.value, 2, "۸ نفرساعت ÷ ۴ نفر");
  assert.equal(r.manHours, 200000);
  assert.ok(by.ltifr.value != null, "با نفرساعت باید عدد بدهد");
});

test("بازهٔ دوره روی هر دو طرف کسر اعمال می‌شود", () => {
  const r = hseMetricSet({
    periodCode: "2026-09",
    incidents: [
      incident({ OccurredAt: "2026-09-05T10:00:00.000Z" }),
      incident({ OccurredAt: "2026-07-05T10:00:00.000Z" }),
    ],
    manHourLogs: [
      manHour({ LogDate: "2026-09-10", ManHours: 100000 }),
      manHour({ LogDate: "2026-07-10", ManHours: 900000 }),
    ],
    now: NOW,
  });
  assert.equal(r.manHours, 100000, "نفرساعت خارج از دوره نباید بیاید");
});

test("هدف صریح بر هدف پیش‌فرض اولویت دارد", () => {
  const r = hseMetricSet({
    periodCode: "2026-09",
    permits: [permit()],
    targets: { permit_compliance: 100 },
    now: NOW,
  });
  const pc = r.metrics.find((m) => m.code === "permit_compliance");
  assert.equal(pc.target, 100);
  assert.equal(pc.verdict.code, "met");
});

/* ══════════════ ۸) هشدارها ══════════════ */

test("قاعدهٔ تعریف‌نشده با مقدار پیش‌فرض ارزیابی می‌شود", () => {
  /* فراموشیِ پیکربندی نباید به سکوت ترجمه شود. */
  const r = evaluateHseAlerts({ gasTests: [gasTest(false)], now: NOW });
  const gas = r.alerts.find((a) => a.ruleCode === "unsafe_gas");
  assert.equal(gas.isTriggered, true);
  assert.equal(gas.severity, "critical");
  assert.equal(r.criticalCount, 1);
});

test("گازسنجی ایمن هشدار نمی‌دهد", () => {
  const r = evaluateHseAlerts({ gasTests: [gasTest(true), gasTest(true)], now: NOW });
  assert.equal(r.alerts.find((a) => a.ruleCode === "unsafe_gas").isTriggered, false);
});

test("دستور توقف کار فعال هشدار بحرانی می‌سازد", () => {
  const r = evaluateHseAlerts({
    violations: [violation({ IsStopWork: true, Status: "open", StopWorkScope: "area" })],
    now: NOW,
  });
  const swo = r.alerts.find((a) => a.ruleCode === "active_stop_work");
  assert.equal(swo.isTriggered, true);
  assert.ok(r.blockingFa.length >= 1);
});

test("پروانهٔ منقضی بازنشده هشدار می‌دهد", () => {
  const r = evaluateHseAlerts({
    permits: [permit({ ValidTo: "2026-09-01T17:00:00.000Z", Status: "active" })],
    now: NOW,
  });
  assert.equal(r.alerts.find((a) => a.ruleCode === "expired_permit").isTriggered, true);
});

test("بدون فهرست افراد، شکاف آموزش سنجیده نمی‌شود", () => {
  const r = evaluateHseAlerts({ now: NOW });
  const gap = r.alerts.find((a) => a.ruleCode === "training_gap");
  assert.equal(gap.isTriggered, false);
  assert.equal(gap.detailFa, "قابل سنجش نبود");
  assert.ok(r.warningsFa.some((w) => /فهرست افراد/.test(w)), "نبود داده باید صریح گفته شود");
});

test("فرد بدون گواهی بدو ورود شکاف آموزش می‌سازد", () => {
  const r = evaluateHseAlerts({
    personRefs: ["w1", "w2"],
    trainings: [{
      Id: "t1", ProjectId: "p1", PersonRef: "w1", CourseCode: "HSE-IND",
      CourseTitleFa: "بدو ورود", CompletedAt: "2026-08-01", ExpiresAt: "2027-08-01", Status: "valid",
    }],
    now: NOW,
  });
  const gap = r.alerts.find((a) => a.ruleCode === "training_gap");
  assert.equal(gap.observed, 1, "فقط w2 فاقد گواهی است");
  assert.equal(gap.isTriggered, true);
});

test("تجاوز زیست‌محیطی بدون اقدام هشدار می‌دهد", () => {
  const r = evaluateHseAlerts({
    readings: [reading({ MeasuredValue: 20, LimitValue: 10 })],
    now: NOW,
  });
  assert.equal(r.alerts.find((a) => a.ruleCode === "env_exceedance").isTriggered, true);
});

test("تجاوز با اقدام اصلاحی دیگر هشدار نیست", () => {
  const r = evaluateHseAlerts({
    readings: [reading({ MeasuredValue: 20, LimitValue: 10, CorrectiveActionFa: "تعویض فیلتر" })],
    now: NOW,
  });
  assert.equal(r.alerts.find((a) => a.ruleCode === "env_exceedance").isTriggered, false);
});

test("سکوت موقت هشدار را خاموش می‌کند ولی مشاهده را نگه می‌دارد", () => {
  const r = evaluateHseAlerts({
    rules: [{
      Id: "r1", ProjectId: "p1", RuleCode: "unsafe_gas", TitleFa: "گازسنجی",
      Severity: "critical", Threshold: 0, Comparison: "gt",
      IsEnabled: true, MutedUntil: "2026-09-30", MuteReasonFa: "تعمیر دستگاه گازسنج",
      Status: "active",
    }],
    gasTests: [gasTest(false)],
    now: NOW,
  });
  const gas = r.alerts.find((a) => a.ruleCode === "unsafe_gas");
  assert.equal(gas.isMuted, true);
  assert.equal(gas.isTriggered, false);
  assert.equal(gas.observed, 1, "عدد مشاهده باید بماند");
  assert.match(gas.detailFa, /تعمیر دستگاه/);
  assert.equal(r.criticalCount, 0);
});

test("سکوت منقضی‌شده دیگر اثر ندارد", () => {
  const r = evaluateHseAlerts({
    rules: [{
      Id: "r1", ProjectId: "p1", RuleCode: "unsafe_gas", TitleFa: "گازسنجی",
      Severity: "critical", Threshold: 0, Comparison: "gt",
      IsEnabled: true, MutedUntil: "2026-08-01", MuteReasonFa: "قدیمی", Status: "active",
    }],
    gasTests: [gasTest(false)],
    now: NOW,
  });
  assert.equal(r.alerts.find((a) => a.ruleCode === "unsafe_gas").isTriggered, true);
});

test("قاعدهٔ بازنشسته نادیده گرفته می‌شود و پیش‌فرض جایش می‌نشیند", () => {
  const r = evaluateHseAlerts({
    rules: [{
      Id: "r1", ProjectId: "p1", RuleCode: "unsafe_gas", TitleFa: "قدیمی",
      Severity: "low", Threshold: 99, Comparison: "gt", IsEnabled: false, Status: "retired",
    }],
    gasTests: [gasTest(false)],
    now: NOW,
  });
  const gas = r.alerts.find((a) => a.ruleCode === "unsafe_gas");
  assert.equal(gas.severity, "critical", "پیش‌فرض باید برگردد نه قاعدهٔ بازنشسته");
  assert.equal(gas.isTriggered, true);
});

test("آستانهٔ سفارشی رعایت می‌شود", () => {
  const r = evaluateHseAlerts({
    rules: [{
      Id: "r1", ProjectId: "p1", RuleCode: "expired_permit", TitleFa: "پروانهٔ منقضی",
      Severity: "high", Threshold: 3, Comparison: "gt", IsEnabled: true, Status: "active",
    }],
    permits: [
      permit({ ValidTo: "2026-09-01T00:00:00.000Z", Status: "active" }),
      permit({ ValidTo: "2026-09-01T00:00:00.000Z", Status: "active" }),
    ],
    now: NOW,
  });
  const a = r.alerts.find((x) => x.ruleCode === "expired_permit");
  assert.equal(a.observed, 2);
  assert.equal(a.isTriggered, false, "۲ کمتر از آستانهٔ ۳ است");
});

/* ══════════════ ۹) نمرهٔ ایمنی ══════════════ */

test("بدون هیچ شاخصی نمره تهی است نه صفر", () => {
  const set = hseMetricSet({ periodCode: "2026-09", now: NOW });
  const s = hseScore({ metrics: set.metrics });
  assert.equal(s.score, null);
  assert.equal(s.band.code, "unknown");
  assert.equal(s.coveragePct, 0);
});

test("شاخص بدون داده از مخرج حذف می‌شود نه اینکه صفر بگیرد", () => {
  const set = hseMetricSet({
    periodCode: "2026-09",
    permits: [permit()],
    now: NOW,
  });
  const s = hseScore({ metrics: set.metrics });
  /* فقط انطباق پروانه (وزن ۲۰) داده دارد و کامل است. */
  assert.equal(s.score, 100, "نبود بقیه نباید نمره را پایین بکشد");
  assert.equal(s.coveragePct, 20);
  assert.ok(s.warningsFa.some((w) => /قابل اتکا نیست/.test(w)));
});

test("نمرهٔ کامل با همهٔ شاخص‌های در حد هدف", () => {
  const s1 = session({ Id: "s1", DurationMinutes: 600 });
  const set = hseMetricSet({
    periodCode: "2026-09",
    incidents: [],
    manHourLogs: [manHour({ ManHours: 500000 })],
    permits: [permit()],
    violations: [violation({ Status: "closed" })],
    sessions: [s1],
    attendees: [attendee("s1", "w1")],
    headCount: 1,
    now: NOW,
  });
  const s = hseScore({ metrics: set.metrics });
  assert.equal(s.coveragePct, 100);
  assert.equal(s.score, 100);
  assert.equal(s.band.code, "excellent");
});

test("هشدار بحرانی سقف نمره را پایین می‌کشد", () => {
  const s1 = session({ Id: "s1", DurationMinutes: 600 });
  const set = hseMetricSet({
    periodCode: "2026-09",
    manHourLogs: [manHour({ ManHours: 500000 })],
    permits: [permit()],
    violations: [violation({ Status: "closed" })],
    sessions: [s1],
    attendees: [attendee("s1", "w1")],
    headCount: 1,
    now: NOW,
  });
  const alerts = evaluateHseAlerts({ gasTests: [gasTest(false)], now: NOW });
  const s = hseScore({ metrics: set.metrics, alerts });

  assert.equal(s.isCapped, true);
  assert.equal(s.score, HSE_SCORE_BLOCKED_CAP);
  assert.ok(s.capReasonFa.length >= 1, "علت محدودشدن باید گفته شود");
  assert.ok(s.warningsFa.some((w) => /سقف/.test(w)));
});

test("هشدار غیربحرانی سقف نمی‌گذارد", () => {
  const s1 = session({ Id: "s1", DurationMinutes: 600 });
  const set = hseMetricSet({
    periodCode: "2026-09",
    manHourLogs: [manHour({ ManHours: 500000 })],
    permits: [permit()],
    violations: [violation({ Status: "closed" })],
    sessions: [s1],
    attendees: [attendee("s1", "w1")],
    headCount: 1,
    now: NOW,
  });
  const alerts = evaluateHseAlerts({
    readings: [reading({ MeasuredValue: 30, LimitValue: 10 })],
    now: NOW,
  });
  const s = hseScore({ metrics: set.metrics, alerts });
  assert.equal(s.isCapped, false);
  assert.equal(s.score, 100);
});

test("نمرهٔ پایین باند بحرانی می‌گیرد", () => {
  const set = hseMetricSet({
    periodCode: "2026-09",
    incidents: Array.from({ length: 20 }, () => incident({ IncidentType: "lost_time" })),
    manHourLogs: [manHour({ ManHours: 100000 })],
    permits: [permit({ ValidTo: "2026-09-01T00:00:00.000Z", Status: "active" })],
    violations: [violation({ Status: "open", DueDate: "2026-08-01" })],
    now: NOW,
  });
  const s = hseScore({ metrics: set.metrics });
  assert.ok(s.score < 55, `نمره ${s.score} باید بحرانی باشد`);
  assert.equal(s.band.code, "poor");
});

test("سهم هر شاخص در نمره گزارش می‌شود", () => {
  const set = hseMetricSet({ periodCode: "2026-09", permits: [permit()], now: NOW });
  const s = hseScore({ metrics: set.metrics });
  assert.equal(s.contributions.length, 5);
  const pc = s.contributions.find((c) => c.code === "permit_compliance");
  assert.equal(pc.weight, 20);
  assert.equal(pc.normalized, 100);
  const lt = s.contributions.find((c) => c.code === "ltifr");
  assert.equal(lt.normalized, null, "شاخص بی‌داده باید null بماند نه صفر");
});

/* ══════════════ ۱۰) روند ══════════════ */

test("با کمتر از دو نقطه روند نامعلوم است", () => {
  const t = metricTrend([snapshot("2026-09", "ltifr", 0.4)], "ltifr");
  assert.equal(t.direction, "unknown");
  assert.equal(t.latest, 0.4);
  assert.equal(t.previous, null);
});

test("کاهش LTIFR بهبود است نه بدترشدن", () => {
  const t = metricTrend([
    snapshot("2026-07", "ltifr", 1.2),
    snapshot("2026-08", "ltifr", 0.9),
    snapshot("2026-09", "ltifr", 0.4),
  ], "ltifr");
  assert.equal(t.direction, "improving");
  assert.equal(t.latest, 0.4);
  assert.equal(t.previous, 0.9);
  assert.ok(t.changePct < 0);
});

test("کاهش انطباق پروانه بدترشدن است", () => {
  const t = metricTrend([
    snapshot("2026-08", "permit_compliance", 95),
    snapshot("2026-09", "permit_compliance", 70),
  ], "permit_compliance");
  assert.equal(t.direction, "worsening");
});

test("عکس جایگزین‌شده در روند نمی‌آید", () => {
  const t = metricTrend([
    snapshot("2026-08", "ltifr", 9.9, { Status: "superseded" }),
    snapshot("2026-08", "ltifr", 1.0),
    snapshot("2026-09", "ltifr", 0.5),
  ], "ltifr");
  assert.equal(t.points.length, 2);
  assert.equal(t.previous, 1.0);
});

test("نقاط روند به ترتیب دوره مرتب می‌شوند", () => {
  const t = metricTrend([
    snapshot("2026-09", "trir", 3),
    snapshot("2026-07", "trir", 1),
    snapshot("2026-08", "trir", 2),
  ], "trir");
  assert.deepEqual(t.points.map((p) => p.periodCode), ["2026-07", "2026-08", "2026-09"]);
});

/* ══════════════ ۱۱) داشبورد و عکس ══════════════ */

test("داشبورد شاخص، هشدار، نمره و روند را یکجا می‌دهد", () => {
  const s1 = session({ Id: "s1", DurationMinutes: 240 });
  const d = hseDashboard({
    periodCode: "2026-09",
    incidents: [incident()],
    manHourLogs: [manHour({ ManHours: 300000 })],
    permits: [permit()],
    violations: [violation({ Status: "closed" })],
    sessions: [s1],
    attendees: [attendee("s1", "w1")],
    headCount: 2,
    gasTests: [gasTest(true)],
    personRefs: ["w1"],
    trainings: [{
      Id: "t1", ProjectId: "p1", PersonRef: "w1", CourseCode: "HSE-IND",
      CourseTitleFa: "بدو ورود", CompletedAt: "2026-08-01", ExpiresAt: "2027-08-01", Status: "valid",
    }],
    snapshots: [snapshot("2026-07", "ltifr", 1.0), snapshot("2026-08", "ltifr", 0.6)],
    now: NOW,
  });

  assert.equal(d.periodCode, "2026-09");
  assert.equal(d.from, "2026-09-01");
  assert.equal(d.to, "2026-09-30");
  assert.equal(d.metrics.length, 5);
  assert.equal(d.alerts.alerts.length, 5);
  assert.ok(d.score.score != null);
  assert.ok(d.trends.length >= 1);
  assert.equal(d.alerts.triggeredCount, 0, "همه‌چیز سالم بود");
});

test("عکس شاخص فقط از مقادیر معلوم ساخته می‌شود", () => {
  const d = hseDashboard({ periodCode: "2026-09", permits: [permit()], now: NOW });
  const rows = buildMetricSnapshots({ projectId: "p1", periodCode: "2026-09", dashboard: d });

  const codes = rows.map((r) => r.MetricCode);
  assert.ok(codes.includes("permit_compliance"));
  assert.ok(!codes.includes("ltifr"), "شاخص تهی نباید ذخیره شود");
  assert.ok(codes.includes("hse_score"), "نمره هم باید ذخیره شود");

  for (const r of rows) {
    assert.equal(r.ProjectId, "p1");
    assert.equal(r.PeriodCode, "2026-09");
    assert.equal(r.Status, "published");
    assert.ok(r.Unit);
  }
});

test("نمرهٔ با پوشش ناقص برآوردی علامت می‌خورد", () => {
  const d = hseDashboard({ periodCode: "2026-09", permits: [permit()], now: NOW });
  const rows = buildMetricSnapshots({ projectId: "p1", periodCode: "2026-09", dashboard: d });
  const score = rows.find((r) => r.MetricCode === "hse_score");
  assert.equal(score.IsEstimated, true, "پوشش ۲۰ درصد یعنی برآوردی");
  assert.match(score.NoteFa, /پوشش/);
});

test("بدون نفرساعت، شاخص‌ها برآوردی علامت می‌خورند", () => {
  const d = hseDashboard({ periodCode: "2026-09", permits: [permit()], now: NOW });
  const rows = buildMetricSnapshots({ projectId: "p1", periodCode: "2026-09", dashboard: d });
  const pc = rows.find((r) => r.MetricCode === "permit_compliance");
  assert.equal(pc.IsEstimated, true, "نبود نفرساعت یعنی پایهٔ ناقص");
  assert.equal(pc.BaseManHours, null);
});

/* ══════════════ ۱۲) تغذیهٔ شاخص سلامت پروژه ══════════════ */

test("نمرهٔ نامعلوم وضعیت unknown می‌دهد نه قرمز", () => {
  const set = hseMetricSet({ periodCode: "2026-09", now: NOW });
  const score = hseScore({ metrics: set.metrics });
  const alerts = evaluateHseAlerts({ now: NOW });
  const c = hseHealthContribution({ score, alerts });

  assert.equal(c.value, null);
  assert.equal(c.status, "unknown");
  assert.equal(c.isReliable, false);
});

test("هشدار بحرانی وضعیت را قرمز می‌کند حتی با نمرهٔ خوب", () => {
  const s1 = session({ Id: "s1", DurationMinutes: 600 });
  const set = hseMetricSet({
    periodCode: "2026-09",
    manHourLogs: [manHour({ ManHours: 500000 })],
    permits: [permit()],
    violations: [violation({ Status: "closed" })],
    sessions: [s1],
    attendees: [attendee("s1", "w1")],
    headCount: 1,
    now: NOW,
  });
  const alerts = evaluateHseAlerts({ gasTests: [gasTest(false)], now: NOW });
  const score = hseScore({ metrics: set.metrics, alerts });
  const c = hseHealthContribution({ score, alerts });

  assert.equal(c.status, "red");
  assert.equal(c.isReliable, false, "نمرهٔ محدودشده قابل اتکا نیست");
  assert.match(c.summaryFa, /بحرانی/);
});

test("کد شاخص برای تزریق در KpiSnapshot ثابت است", () => {
  const set = hseMetricSet({ periodCode: "2026-09", permits: [permit()], now: NOW });
  const c = hseHealthContribution({
    score: hseScore({ metrics: set.metrics }),
    alerts: evaluateHseAlerts({ now: NOW }),
  });
  assert.equal(c.kpiCode, "hse_score");
});

/* ══════════════ ۱۳) اعتبارسنجی قاعده ══════════════ */

test("قاعدهٔ معتبر ایراد ندارد", () => {
  const issues = validateAlertRuleInput({
    RuleCode: "unsafe_gas", TitleFa: "گازسنجی ناایمن",
    Severity: "critical", Threshold: 0, Comparison: "gt",
  });
  assert.equal(issues.length, 0, JSON.stringify(issues));
});

test("کد قاعدهٔ ناشناخته رد می‌شود", () => {
  const issues = validateAlertRuleInput({
    RuleCode: "made_up", TitleFa: "x", Severity: "high", Threshold: 1, Comparison: "gt",
  });
  assert.ok(issues.some((i) => i.code === "E-HSE-ALERT-CODE"));
});

test("سکوت بدون دلیل رد می‌شود", () => {
  const issues = validateAlertRuleInput({
    RuleCode: "unsafe_gas", TitleFa: "x", Severity: "critical",
    Threshold: 0, Comparison: "gt", MutedUntil: "2026-12-01",
  });
  assert.ok(issues.some((i) => i.code === "E-HSE-ALERT-MUTE-REASON"),
    "خاموش‌کردن بی‌سروصدای هشدار ایمنی نباید ممکن باشد");
});

test("آستانهٔ منفی و عملگر نامعتبر رد می‌شوند", () => {
  const issues = validateAlertRuleInput({
    RuleCode: "unsafe_gas", TitleFa: "x", Severity: "critical",
    Threshold: -1, Comparison: "approx",
  });
  assert.ok(issues.some((i) => i.code === "E-HSE-ALERT-THRESHOLD"));
  assert.ok(issues.some((i) => i.code === "E-HSE-ALERT-COMPARISON"));
});

/* ══════════════ ۱۴) محافظ اسکیما ══════════════ */

import { SCHEMA, MIGRATIONS } from "./sqlLogic.js";

test("دو جدول شاخص و هشدار در اسکیما هستند", () => {
  for (const n of ["HSE_MetricSnapshot", "HSE_AlertRule"]) {
    const t = SCHEMA.find((x) => x.name === n);
    assert.ok(t, `${n} نیست`);
    assert.equal(t.module, "d16");
  }
  assert.equal(SCHEMA.filter((t) => t.module === "d16").length, 29);
});

test("مهاجرت 0021 بدون حذف قبلی‌ها افزوده شده", () => {
  const v = MIGRATIONS.map((m) => m.version);
  assert.ok(v.includes("0020"), "مهاجرت آموزش نباید حذف شود");
  assert.ok(v.includes("0021"), "مهاجرت شاخص و هشدار نیست");
  /* «آخرین مهاجرت» ادعای شکننده‌ای است: هر ماژول بعدی آن را
   * می‌شکند بی‌آنکه چیزی دربارهٔ این ماژول بگوید. چیزی که باید
   * ثابت بماند نبودن شکاف و ترتیب صعودی است. */
  assert.deepEqual([...v].sort(), v, "ترتیب مهاجرت‌ها باید صعودی بماند");
  assert.equal(new Set(v).size, v.length, "شمارهٔ مهاجرت تکراری");
  const m = MIGRATIONS.find((x) => x.version === "0021");
  assert.equal(m.statements.filter((s) => /DROP/i.test(s)).length, 0);
});

test("ستون‌های کلید یکتای جداول تازه nullable نیستند", () => {
  for (const n of ["HSE_MetricSnapshot", "HSE_AlertRule"]) {
    const t = SCHEMA.find((x) => x.name === n);
    for (const ix of t.indexes ?? []) {
      if (!ix.unique) continue;
      for (const cn of ix.columns) {
        const col = t.columns.find((c) => c.name === cn);
        assert.equal(col.nullable, false, `${n}.${cn} در ایندکس یکتا nullable است`);
      }
    }
  }
});
