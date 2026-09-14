import test from "node:test";
import assert from "node:assert/strict";
import {
  PERMIT_TYPES, PERMIT_TYPE_FA, HIGH_RISK_PERMITS, PERMIT_STATUS_FA,
  INCIDENT_TYPES, INCIDENT_TYPE_FA, RECORDABLE_TYPES, LOST_TIME_TYPES,
  validatePermitInput, canApprovePermit, permitState, rfsuSafetyClearance,
  validateIncidentInput, suggestSeverity, canCloseIncident, safetyMetrics,
  trainingValidity, hseSummary, hseAlerts,
} from "./hseLogic.js";

const NOW = new Date("2026-09-09T12:00:00Z");

function permit(over = {}) {
  return {
    Id: "p1", ProjectId: "p", PermitNo: "PTW-001", PermitType: "cold",
    TitleFa: "تعویض واشر", SystemId: "s1", RequestedBy: "u-site",
    ValidFrom: "2026-09-09T06:00:00Z", ValidTo: "2026-09-09T18:00:00Z",
    Status: "draft", ...over,
  };
}

function incident(over = {}) {
  return {
    Id: "i1", ProjectId: "p", IncidentNo: "INC-001", TitleFa: "لغزش",
    IncidentType: "near_miss", OccurredAt: "2026-09-01T08:00:00Z",
    ReportedBy: "u-hse", Severity: "low", Status: "open", ...over,
  };
}

/* ══════════════ ثابت‌ها ══════════════ */

test("هر نوع پروانه برچسب فارسی دارد", () => {
  for (const t of PERMIT_TYPES) {
    assert.ok(PERMIT_TYPE_FA[t], `برچسب ${t} نیست`);
  }
});

test("هر نوع رویداد برچسب فارسی دارد", () => {
  for (const t of INCIDENT_TYPES) {
    assert.ok(INCIDENT_TYPE_FA[t], `برچسب ${t} نیست`);
  }
});

test("شبه‌حادثه و کمک اولیه ثبت‌شدنی نیستند", () => {
  assert.ok(!RECORDABLE_TYPES.includes("near_miss"), "شمردن شبه‌حادثه تیم را از گزارش آن بازمی‌دارد");
  assert.ok(!RECORDABLE_TYPES.includes("first_aid"));
  assert.ok(RECORDABLE_TYPES.includes("lost_time"));
  assert.ok(RECORDABLE_TYPES.includes("fatality"));
});

test("حوادث از کارافتادگی زیرمجموعهٔ ثبت‌شدنی‌اند", () => {
  for (const t of LOST_TIME_TYPES) {
    assert.ok(RECORDABLE_TYPES.includes(t), `${t} باید ثبت‌شدنی باشد`);
  }
});

test("کار گرم و فضای بسته و گودبرداری پرخطرند", () => {
  assert.ok(HIGH_RISK_PERMITS.includes("hot"));
  assert.ok(HIGH_RISK_PERMITS.includes("confined"));
  assert.ok(!HIGH_RISK_PERMITS.includes("cold"));
});

/* ══════════════ اعتبارسنجی پروانه ══════════════ */

test("پروانهٔ درست خطا ندارد", () => {
  assert.deepEqual(validatePermitInput(permit()), []);
});

test("شمارهٔ پروانه الزامی است", () => {
  const e = validatePermitInput(permit({ PermitNo: "  " }));
  assert.ok(e.some((x) => x.code === "E-HSE-PERMIT-NO-REQUIRED"));
});

test("نوع پروانهٔ نامعتبر رد می‌شود", () => {
  const e = validatePermitInput(permit({ PermitType: "flying" }));
  assert.ok(e.some((x) => x.code === "E-HSE-PERMIT-TYPE"));
});

test("پایان اعتبار پیش از شروع رد می‌شود", () => {
  const e = validatePermitInput(permit({
    ValidFrom: "2026-09-09T18:00:00Z", ValidTo: "2026-09-09T06:00:00Z",
  }));
  assert.ok(e.some((x) => x.code === "E-HSE-VALIDITY-RANGE"));
});

test("بازهٔ اعتبار غایب رد می‌شود", () => {
  const e = validatePermitInput(permit({ ValidFrom: "", ValidTo: "" }));
  assert.ok(e.some((x) => x.code === "E-HSE-VALIDITY-REQUIRED"));
});

/* ══════════════ تأیید پروانه ══════════════ */

test("کار سرد ساده تأیید می‌شود", () => {
  const r = canApprovePermit(permit(), "u-hse");
  assert.equal(r.ok, true, JSON.stringify(r.blockersFa));
});

test("کار گرم بدون SIMOPS تأیید نمی‌شود", () => {
  const r = canApprovePermit(permit({ PermitType: "hot", GasTestResultFa: "0% LEL" }), "u-hse");
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("SIMOPS")));
});

test("کار گرم بدون آزمون گاز تأیید نمی‌شود", () => {
  const r = canApprovePermit(permit({
    PermitType: "hot", SimopsApprovedBy: "u-hse",
  }), "u-hse");
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("آزمون گاز")));
});

test("کار گرم با هر دو تأییدیه مجاز است", () => {
  const r = canApprovePermit(permit({
    PermitType: "hot", SimopsApprovedBy: "u-hse", GasTestResultFa: "0% LEL",
  }), "u-safety");
  assert.equal(r.ok, true, JSON.stringify(r.blockersFa));
});

test("درخواست‌کننده نمی‌تواند پروانهٔ خودش را تأیید کند", () => {
  const r = canApprovePermit(permit(), "u-site");
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("درخواست‌کننده")));
});

test("پروانهٔ بسته دوباره تأیید نمی‌شود", () => {
  const r = canApprovePermit(permit({ Status: "closed" }), "u-hse");
  assert.equal(r.ok, false);
});

test("پروانهٔ معتبر دوباره تأیید نمی‌شود", () => {
  const r = canApprovePermit(permit({ Status: "active" }), "u-hse");
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("قبلاً تأیید")));
});

test("SimopsRequired صریح، کار سرد را هم مشمول می‌کند", () => {
  const r = canApprovePermit(permit({ SimopsRequired: true }), "u-hse");
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("SIMOPS")));
});

test("همهٔ موانع یک‌جا برمی‌گردند", () => {
  const r = canApprovePermit(permit({ PermitType: "hot", RequestedBy: "u-hse" }), "u-hse");
  assert.ok(r.blockersFa.length >= 3, `انتظار چند مانع، دریافت ${r.blockersFa.length}`);
});

/* ══════════════ وضعیت پروانه ══════════════ */

test("پروانهٔ داخل بازه معتبر است", () => {
  const s = permitState(permit({ Status: "active" }), NOW);
  assert.equal(s.effectiveStatus, "active");
  assert.equal(s.isValidNow, true);
  assert.equal(s.expiresInHours, 6);
});

test("انقضا از تاریخ محاسبه می‌شود نه از ستون وضعیت", () => {
  const s = permitState(permit({ Status: "active" }), new Date("2026-09-10T00:00:00Z"));
  assert.equal(s.effectiveStatus, "expired", "پروانهٔ بسته‌نشده نباید تا ابد معتبر بماند");
  assert.equal(s.isValidNow, false);
  assert.equal(s.statusFa, PERMIT_STATUS_FA.expired);
});

test("پروانهٔ پیش از شروع بازه معتبر نیست", () => {
  const s = permitState(permit({ Status: "active" }), new Date("2026-09-09T05:00:00Z"));
  assert.equal(s.isValidNow, false);
});

test("پروانهٔ پیش‌نویس معتبر نیست", () => {
  const s = permitState(permit(), NOW);
  assert.equal(s.isValidNow, false);
  assert.equal(s.expiresInHours, null);
});

/* ══════════════ دروازهٔ ایمنی RFSU ══════════════ */

test("سیستم بدون پروانهٔ باز دروازه‌اش باز است", () => {
  const r = rfsuSafetyClearance({
    systemId: "s1",
    permits: [permit({ Status: "closed" })],
    now: NOW,
  });
  assert.equal(r.ok, true, JSON.stringify(r.blockersFa));
});

test("پروانهٔ باز مانع سخت RFSU است", () => {
  const r = rfsuSafetyClearance({
    systemId: "s1",
    permits: [permit({ Status: "active" })],
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.equal(r.openPermits, 1);
  assert.ok(r.blockersFa[0].includes("پروانهٔ کار باز"));
});

test("پروانهٔ منقضی هشدار است نه مانع", () => {
  const r = rfsuSafetyClearance({
    systemId: "s1",
    permits: [permit({ Status: "active" })],
    now: new Date("2026-09-11T00:00:00Z"),
  });
  assert.equal(r.ok, true, "فراموشی اداری نباید دروازه را ببندد");
  assert.equal(r.expiredPermits, 1);
  assert.ok(r.warningsFa[0].includes("منقضی"));
});

test("رویداد بحرانی باز مانع سخت است", () => {
  const r = rfsuSafetyClearance({
    systemId: "s1",
    permits: [],
    incidents: [incident({ SystemId: "s1", Severity: "critical" })],
    now: NOW,
  });
  assert.equal(r.ok, false);
  assert.equal(r.openHighSeverityIncidents, 1);
});

test("رویداد بستهٔ بحرانی مانع نیست", () => {
  const r = rfsuSafetyClearance({
    systemId: "s1",
    permits: [],
    incidents: [incident({ SystemId: "s1", Severity: "critical", Status: "closed" })],
    now: NOW,
  });
  assert.equal(r.ok, true);
});

test("رویداد کم‌شدت باز فقط هشدار است", () => {
  const r = rfsuSafetyClearance({
    systemId: "s1",
    permits: [],
    incidents: [incident({ SystemId: "s1", Severity: "low" })],
    now: NOW,
  });
  assert.equal(r.ok, true);
  assert.ok(r.warningsFa.length >= 1);
});

test("پروانهٔ سیستم دیگر شمرده نمی‌شود", () => {
  const r = rfsuSafetyClearance({
    systemId: "s1",
    permits: [permit({ SystemId: "s2", Status: "active" })],
    now: NOW,
  });
  assert.equal(r.ok, true);
  assert.equal(r.openPermits, 0);
});

test("سیستم بدون هیچ داده دروازه‌اش باز است", () => {
  const r = rfsuSafetyClearance({ systemId: "s9", permits: [], now: NOW });
  assert.equal(r.ok, true);
  assert.deepEqual(r.blockersFa, []);
});

/* ══════════════ رویداد ایمنی ══════════════ */

test("رویداد درست خطا ندارد", () => {
  assert.deepEqual(validateIncidentInput(incident()), []);
});

test("نوع رویداد نامعتبر رد می‌شود", () => {
  const e = validateIncidentInput(incident({ IncidentType: "alien" }));
  assert.ok(e.some((x) => x.code === "E-HSE-INCIDENT-TYPE"));
});

test("حادثهٔ از کارافتادگی بدون روز رد می‌شود", () => {
  const e = validateIncidentInput(incident({ IncidentType: "lost_time", Severity: "high" }));
  assert.ok(e.some((x) => x.code === "E-HSE-LOST-DAYS"), "بدون روز، LTIFR بی‌معناست");
});

test("فوت نیازی به روز از دست رفته ندارد", () => {
  const e = validateIncidentInput(incident({ IncidentType: "fatality", Severity: "critical" }));
  assert.ok(!e.some((x) => x.code === "E-HSE-LOST-DAYS"));
});

test("شدت پیشنهادی با نوع رویداد می‌خواند", () => {
  assert.equal(suggestSeverity("fatality"), "critical");
  assert.equal(suggestSeverity("lost_time", 3), "high");
  assert.equal(suggestSeverity("lost_time", 30), "critical");
  assert.equal(suggestSeverity("near_miss"), "low");
  assert.equal(suggestSeverity("environmental"), "high");
});

test("بستن رویداد بدون ریشه‌یابی رد می‌شود", () => {
  const r = canCloseIncident(incident({ CorrectiveActionFa: "نصب حفاظ" }));
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("ریشه‌یابی")));
});

test("بستن رویداد بدون اقدام اصلاحی رد می‌شود", () => {
  const r = canCloseIncident(incident({ RootCauseFa: "کف لغزنده" }));
  assert.equal(r.ok, false);
  assert.ok(r.blockersFa.some((b) => b.includes("اقدام اصلاحی")));
});

test("رویداد با ریشه‌یابی و اقدام بسته می‌شود", () => {
  const r = canCloseIncident(incident({
    RootCauseFa: "کف لغزنده", CorrectiveActionFa: "نصب کفپوش",
  }));
  assert.equal(r.ok, true);
});

test("رویداد بسته دوباره بسته نمی‌شود", () => {
  const r = canCloseIncident(incident({
    Status: "closed", RootCauseFa: "x", CorrectiveActionFa: "y",
  }));
  assert.equal(r.ok, false);
});

/* ══════════════ شاخص‌ها ══════════════ */

test("LTIFR و TRIR با فرمول استاندارد محاسبه می‌شوند", () => {
  const inc = [
    incident({ IncidentType: "lost_time", LostDays: 5 }),
    incident({ Id: "i2", IncidentType: "medical_treatment" }),
    incident({ Id: "i3", IncidentType: "near_miss" }),
  ];
  const m = safetyMetrics(inc, 100_000);
  assert.equal(m.lostTime, 1);
  assert.equal(m.recordable, 2, "شبه‌حادثه ثبت‌شدنی نیست");
  assert.equal(m.ltifr, 10, "(1 × 1000000) ÷ 100000");
  assert.equal(m.trir, 4, "(2 × 200000) ÷ 100000");
  assert.equal(m.lostDays, 5);
  assert.equal(m.nearMiss, 1);
});

test("بدون نفر-ساعت شاخص null است نه صفر", () => {
  const m = safetyMetrics([incident({ IncidentType: "lost_time", LostDays: 2 })], null);
  assert.equal(m.ltifr, null, "صفر یعنی ایمن؛ null یعنی نمی‌دانیم");
  assert.equal(m.trir, null);
  assert.equal(m.manHours, null);
});

test("نفر-ساعت صفر یا منفی نادیده گرفته می‌شود", () => {
  assert.equal(safetyMetrics([], 0).ltifr, null);
  assert.equal(safetyMetrics([], -5).trir, null);
});

test("خلاصهٔ خالی صفر می‌دهد نه خطا", () => {
  const m = safetyMetrics([], 1000);
  assert.equal(m.total, 0);
  assert.equal(m.ltifr, 0);
  assert.equal(m.byType.near_miss, 0, "همهٔ کلیدها باید باشند");
});

test("byType همهٔ انواع را حتی با صفر دارد", () => {
  const m = safetyMetrics([incident()], 1000);
  for (const t of INCIDENT_TYPES) {
    assert.ok(t in m.byType, `کلید ${t} غایب است`);
  }
});

/* ══════════════ آموزش ══════════════ */

function training(over = {}) {
  return {
    Id: "t1", ProjectId: "p", PersonRef: "w1", CourseCode: "HSE-101",
    CourseTitleFa: "ایمنی عمومی", CompletedAt: "2026-01-01",
    ExpiresAt: "2027-01-01", Status: "valid", ...over,
  };
}

test("آموزش معتبر شناسایی می‌شود", () => {
  const v = trainingValidity([training()], "w1", NOW);
  assert.equal(v.hasValid, true);
  assert.deepEqual(v.validCourses, ["HSE-101"]);
});

test("آموزش منقضی شناسایی می‌شود", () => {
  const v = trainingValidity([training({ ExpiresAt: "2026-01-01" })], "w1", NOW);
  assert.equal(v.hasValid, false);
  assert.deepEqual(v.expiredCourses, ["HSE-101"]);
});

test("آموزش بدون انقضا همیشه معتبر است", () => {
  const v = trainingValidity([training({ ExpiresAt: null })], "w1", NOW);
  assert.equal(v.hasValid, true);
});

test("آموزش باطل‌شده معتبر نیست", () => {
  const v = trainingValidity([training({ Status: "revoked" })], "w1", NOW);
  assert.equal(v.hasValid, false);
});

test("آموزش نزدیک انقضا هشدار می‌دهد", () => {
  const v = trainingValidity([training({ ExpiresAt: "2026-09-20" })], "w1", NOW);
  assert.equal(v.hasValid, true);
  assert.deepEqual(v.expiringSoonCourses, ["HSE-101"]);
});

test("فرد بدون سابقه معتبر نیست", () => {
  const v = trainingValidity([training()], "w9", NOW);
  assert.equal(v.hasValid, false);
});

/* ══════════════ خلاصه و هشدار ══════════════ */

test("خلاصهٔ کلی درست جمع می‌زند", () => {
  const s = hseSummary({
    permits: [permit({ Status: "active" }), permit({ Id: "p2", PermitType: "hot", Status: "closed" })],
    incidents: [incident({ IncidentType: "lost_time", LostDays: 3 })],
    inspections: [{
      Id: "s1", ProjectId: "p", InspectionNo: "SI-1", TitleFa: "بازدید",
      InspectionType: "walkthrough", InspectedAt: "2026-09-01", InspectedBy: "u",
      FindingsCount: 5, ClosedFindings: 2, ScorePct: 80, Status: "completed",
    }],
    manHours: 50_000,
    now: NOW,
  });
  assert.equal(s.permits.total, 2);
  assert.equal(s.permits.active, 1);
  assert.equal(s.permits.byType.hot, 1);
  assert.equal(s.permits.byType.lifting, 0, "همهٔ کلیدها باید باشند");
  assert.equal(s.incidents.lostTime, 1);
  assert.equal(s.inspections.openFindings, 3);
  assert.equal(s.inspections.avgScorePct, 80);
});

test("خلاصهٔ بدون بازرسی میانگین null می‌دهد", () => {
  const s = hseSummary({ permits: [], incidents: [], now: NOW });
  assert.equal(s.inspections.avgScorePct, null);
  assert.equal(s.inspections.openFindings, 0);
});

test("هشدار پروانهٔ نزدیک انقضا", () => {
  const a = hseAlerts({
    permits: [permit({ Status: "active", ValidTo: "2026-09-09T14:00:00Z" })],
    incidents: [],
    now: NOW,
  });
  assert.ok(a.some((x) => x.code === "EWS-HSE-01"));
});

test("هشدار پروانهٔ منقضی بسته‌نشده", () => {
  const a = hseAlerts({
    permits: [permit({ Status: "active" })],
    incidents: [],
    now: new Date("2026-09-11T00:00:00Z"),
  });
  const e = a.find((x) => x.code === "EWS-HSE-02");
  assert.ok(e);
  assert.equal(e.severity, "high");
});

test("هشدار رویداد بحرانی باز", () => {
  const a = hseAlerts({
    permits: [],
    incidents: [incident({ Severity: "critical" })],
    now: NOW,
  });
  const e = a.find((x) => x.code === "EWS-HSE-03");
  assert.ok(e);
  assert.equal(e.severity, "critical");
});

test("سه رویداد هم‌نوع هشدار سیستمی می‌دهد", () => {
  const a = hseAlerts({
    permits: [],
    incidents: [
      incident({ Id: "a", IncidentType: "first_aid" }),
      incident({ Id: "b", IncidentType: "first_aid" }),
      incident({ Id: "c", IncidentType: "first_aid" }),
    ],
    now: NOW,
  });
  assert.ok(a.some((x) => x.code === "EWS-HSE-04"));
});

test("تکرار شبه‌حادثه هشدار سیستمی نمی‌دهد", () => {
  const a = hseAlerts({
    permits: [],
    incidents: [
      incident({ Id: "a" }), incident({ Id: "b" }), incident({ Id: "c" }),
    ],
    now: NOW,
  });
  assert.ok(!a.some((x) => x.code === "EWS-HSE-04"), "گزارش شبه‌حادثه باید تشویق شود نه جریمه");
});

test("هشدار آموزش منقضی", () => {
  const a = hseAlerts({
    permits: [],
    incidents: [],
    training: [training({ ExpiresAt: "2026-01-01" })],
    now: NOW,
  });
  assert.ok(a.some((x) => x.code === "EWS-HSE-05"));
});

test("وضعیت پاک هیچ هشداری ندارد", () => {
  const a = hseAlerts({
    permits: [permit({ Status: "closed" })],
    incidents: [incident({ Status: "closed" })],
    training: [training()],
    now: NOW,
  });
  assert.deepEqual(a, []);
});
