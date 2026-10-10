/**
 * آزمون موتورهای محاسباتی استاندارد CMMS.
 *
 * هر آزمون یک مقدار را دستی محاسبه کرده و با خروجی موتور مقایسه می‌کند؛
 * هدف این است که اگر روزی فرمول عوض شد، عدد عوض‌شده دیده شود نه اینکه
 * تست بی‌صدا با رفتار تازه هم‌راستا شود.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CMMS_MODEL_VERSION,
  ISO14224_FAILURE_MODES,
  ISO14224_FAILURE_MECHANISMS,
  buildAssetBoundaryPath,
  classifyIso14224,
  computeRiskPriorityNumber,
  computeCriticality,
  decideRcmTask,
  vibrationZoneIso10816,
  evaluateCondition,
  computeSupplyReliability,
  computeOee,
  computeReliability,
  computeLifeCycleCost,
  annuityFactor,
  discountFactor,
  selectLccOption,
  optimizePmInterval,
  ageReplacementCostRate,
  weibullReliability,
  evaluateKpiHealth,
  computeAssetCriticality,
  computeWorkOrderPriorityScore,
  buildTree,
  wouldCreateCycle,
  validateWorkflowDefinition,
  advanceWorkflow,
  CmmsWorkflowError,
  vocabularyTerm,
} from "./cmmsLogic.js";

/* ═══════════════════════ ۱. ISO 14224 ═══════════════════════ */

test("ISO 14224: کد تاکسونومی پنج‌بخشی و با عرض ثابت ساخته می‌شود", () => {
  const code = classifyIso14224({
    equipmentClass: "pump", subUnit: "seal assembly", component: "mech seal",
    failureMode: "leakage", failureMechanism: "wear",
  });
  assert.equal(code, "PUMP|SEAL-ASSEMBLY|MECH-SEAL|leakage|wear");
});

test("ISO 14224: اجزای خالی با * پر می‌شوند تا مرتب‌سازی رشته‌ای معنادار بماند", () => {
  assert.equal(classifyIso14224({}), "*|*|*|*|*");
  assert.equal(classifyIso14224({ equipmentClass: "valve", failureMode: "leakage" }), "VALVE|*|*|leakage|*");
  /* فاصله به خط تیره تبدیل می‌شود تا جداکنندهٔ | تنها جداکننده بماند. */
  assert.equal(classifyIso14224({ equipmentClass: "gas turbine" }).startsWith("GAS-TURBINE"), true);
});

test("ISO 14224: فهرست حالات و مکانیزم‌ها بسته و ثابت است", () => {
  assert.equal(ISO14224_FAILURE_MODES.length, 11);
  assert.ok(ISO14224_FAILURE_MODES.includes("fail-to-start"));
  assert.ok(ISO14224_FAILURE_MODES.includes("spurious-output"));
  assert.equal(ISO14224_FAILURE_MECHANISMS.length, 13);
  assert.ok(ISO14224_FAILURE_MECHANISMS.includes("lubrication"));
});

test("ISO 14224: مسیر مرز تجهیز از گره‌ها ساخته می‌شود", () => {
  const path = buildAssetBoundaryPath([
    { nodeCode: "pump-101" }, { nodeCode: "seal" }, { nodeCode: "o-ring" },
  ]);
  assert.equal(path, "PUMP-101/SEAL/O-RING");
  assert.equal(buildAssetBoundaryPath([]), "");
});

test("EN 13306: واژگان دوزبانه در دسترس‌اند و کلید ناشناخته خودش را برمی‌گرداند", () => {
  assert.equal(vocabularyTerm("mtbf", "fa"), "میانگین زمان بین خرابی‌ها");
  assert.equal(vocabularyTerm("mtbf", "en"), "Mean time between failures");
  assert.equal(vocabularyTerm("کلید-ناموجود", "fa"), "کلید-ناموجود");
  assert.equal(CMMS_MODEL_VERSION, "cmms-domain-v1");
});

/* ═══════════════════════ ۲. IEC 60812 — FMEA ═══════════════════════ */

test("IEC 60812: RPN = S×O×D و اولویت اقدام از آستانه‌ها می‌آید", () => {
  assert.equal(computeRiskPriorityNumber({ severity: 5, occurrence: 4, detection: 3 }).rpn, 60);
  assert.equal(computeRiskPriorityNumber({ severity: 5, occurrence: 4, detection: 3 }).actionPriority, "low");
  /* 5×5×5 = 125 → بین ۱۰۰ و ۲۰۰ → متوسط */
  assert.equal(computeRiskPriorityNumber({ severity: 5, occurrence: 5, detection: 5 }).actionPriority, "medium");
  /* 5×8×6 = 240 → بالای ۲۰۰ → زیاد */
  assert.equal(computeRiskPriorityNumber({ severity: 5, occurrence: 8, detection: 6 }).actionPriority, "high");
});

test("IEC 60812: شدت ۹ یا ۱۰ بدون توجه به RPN پایین، اولویت زیاد می‌گیرد", () => {
  /* ۱۰×۱×۱ = ۱۰ که عدد کوچکی است، ولی اثر ایمنی با میانگین‌گیری پنهان نمی‌شود. */
  const result = computeRiskPriorityNumber({ severity: 10, occurrence: 1, detection: 1 });
  assert.equal(result.rpn, 10);
  assert.equal(result.actionPriority, "high");
  assert.ok(result.reasonFa.includes("تشدید"), "دلیل باید به قاعدهٔ تشدید شدت اشاره کند");
});

test("IEC 60812: ورودی خارج از بازهٔ ۱..۱۰ استثنا می‌دهد نه برش بی‌صدا", () => {
  assert.throws(() => computeRiskPriorityNumber({ severity: 11, occurrence: 3, detection: 3 }), RangeError);
  assert.throws(() => computeRiskPriorityNumber({ severity: 0, occurrence: 3, detection: 3 }), RangeError);
  assert.throws(() => computeRiskPriorityNumber({ severity: 3.5, occurrence: 3, detection: 3 }), RangeError);
});

test("IEC 60812: عدد بحرانی‌بودن Cm = λ × β × t", () => {
  const result = computeCriticality({ failureRatePerHour: 0.001, betaFactor: 0.5, missionTimeHours: 1000 });
  assert.equal(result.criticalityNumber, 0.001 * 0.5 * 1000);
  assert.throws(() => computeCriticality({ failureRatePerHour: 0.001, betaFactor: 1.5, missionTimeHours: 100 }), RangeError);
  assert.throws(() => computeCriticality({ failureRatePerHour: -0.001, betaFactor: 0.5, missionTimeHours: 100 }), RangeError);
});

/* ═══════════════════════ ۳. IEC 60300-3-11 — RCM ═══════════════════════ */

test("RCM: خرابی پنهان با وظیفهٔ کشف خرابی پوشش داده می‌شود", () => {
  const decision = decideRcmTask({
    isHiddenFailure: true, consequence: "safety-environmental",
    isConditionMonitorable: true, hasAgeRelatedPattern: true,
    conditionTaskApplicable: true, restorationApplicable: true,
    discardApplicable: true, failureFindingApplicable: true,
  });
  assert.equal(decision.selectedTask, "failure-finding");
  /* منطق باید در گام اول متوقف شود و سراغ پایش وضعیت نرود. */
  assert.equal(decision.decisionPath.length, 2);
});

test("RCM: خرابی پنهان بدون وظیفهٔ کشف → بازطراحی", () => {
  const decision = decideRcmTask({
    isHiddenFailure: true, consequence: "operational",
    isConditionMonitorable: false, hasAgeRelatedPattern: false,
    conditionTaskApplicable: false, restorationApplicable: false,
    discardApplicable: false, failureFindingApplicable: false,
  });
  assert.equal(decision.selectedTask, "redesign");
});

test("RCM: پایش وضعیت مؤثر بر بازسازی زمان‌بندی‌شده اولویت دارد", () => {
  const decision = decideRcmTask({
    isHiddenFailure: false, consequence: "operational",
    isConditionMonitorable: true, hasAgeRelatedPattern: true,
    conditionTaskApplicable: true, restorationApplicable: true,
    discardApplicable: true, failureFindingApplicable: false,
  });
  assert.equal(decision.selectedTask, "condition-based");
});

test("RCM: الگوی فرسایش بدون پایش وضعیت → بازسازی، و اگر نشد دوراندازی", () => {
  const base = {
    isHiddenFailure: false, consequence: "operational",
    isConditionMonitorable: false, hasAgeRelatedPattern: true,
    conditionTaskApplicable: false, failureFindingApplicable: false,
  };
  assert.equal(decideRcmTask({ ...base, restorationApplicable: true, discardApplicable: true }).selectedTask, "scheduled-restoration");
  assert.equal(decideRcmTask({ ...base, restorationApplicable: false, discardApplicable: true }).selectedTask, "scheduled-discard");
});

test("RCM: پیامد غیرعملیاتی بدون وظیفهٔ مؤثر → کار تا خرابی", () => {
  const decision = decideRcmTask({
    isHiddenFailure: false, consequence: "non-operational",
    isConditionMonitorable: false, hasAgeRelatedPattern: false,
    conditionTaskApplicable: false, restorationApplicable: false,
    discardApplicable: false, failureFindingApplicable: false,
  });
  assert.equal(decision.selectedTask, "run-to-failure");
  assert.equal(decision.consequence, "non-operational");
});

test("RCM: پیامد ایمنی بدون وظیفهٔ مؤفر → بازطراحی، و مسیر تصمیم ثبت می‌شود", () => {
  const decision = decideRcmTask({
    isHiddenFailure: false, consequence: "safety-environmental",
    isConditionMonitorable: false, hasAgeRelatedPattern: false,
    conditionTaskApplicable: false, restorationApplicable: false,
    discardApplicable: false, failureFindingApplicable: false,
  });
  assert.equal(decision.selectedTask, "redesign");
  /* توضیح‌پذیری: هر گام باید پرسش و پاسخ ثبت‌شده داشته باشد، چون تصمیم RCM
   * بدون ردّ دلیل در ممیزی ISO 55001 مردود است. */
  assert.ok(decision.decisionPath.length >= 4);
  for (const step of decision.decisionPath) {
    assert.ok(step.step >= 1 && step.questionFa && step.answerFa);
  }
});

test("RCM: پیامد نامعتبر استثنا می‌دهد", () => {
  assert.throws(() => decideRcmTask({
    isHiddenFailure: false, consequence: "unknown",
    isConditionMonitorable: false, hasAgeRelatedPattern: false,
    conditionTaskApplicable: false, restorationApplicable: false,
    discardApplicable: false, failureFindingApplicable: false,
  }), RangeError);
});

/* ═══════════════════════ ۴. ISO 17359 / ISO 10816 — پایش وضعیت ═══════════════════════ */

test("ISO 10816: منطقه‌بندی ارتعاش گروه ۲ با تکیه‌گاه صلب (1.4/2.8/4.5)", () => {
  assert.equal(vibrationZoneIso10816(1.0, "group2", true).zone, "A");
  assert.equal(vibrationZoneIso10816(1.4, "group2", true).zone, "A");
  assert.equal(vibrationZoneIso10816(2.0, "group2", true).zone, "B");
  assert.equal(vibrationZoneIso10816(2.8, "group2", true).zone, "B");
  assert.equal(vibrationZoneIso10816(3.0, "group2", true).zone, "C");
  assert.equal(vibrationZoneIso10816(4.5, "group2", true).zone, "C");
  assert.equal(vibrationZoneIso10816(5.0, "group2", true).zone, "D");
});

test("ISO 10816: تکیه‌گاه انعطاف‌پذیر حدود سخت‌گیرانه‌تر را نرم‌تر می‌کند", () => {
  /* همان عدد ۳٫۰ که روی تکیه‌گاه صلب منطقهٔ C بود، روی انعطاف‌پذیر B است. */
  assert.equal(vibrationZoneIso10816(3.0, "group2", true).zone, "C");
  assert.equal(vibrationZoneIso10816(3.0, "group2", false).zone, "B");
  assert.deepEqual(vibrationZoneIso10816(3.0, "group2", false).limits, { zoneA: 2.3, zoneB: 4.5, zoneC: 7.1 });
});

test("ISO 10816: کلاس ناشناخته و مقدار منفی استثنا می‌دهند", () => {
  assert.throws(() => vibrationZoneIso10816(2, "group9", true), RangeError);
  assert.throws(() => vibrationZoneIso10816(-0.1, "group2", true), RangeError);
});

test("ISO 17359: منطقه‌بندی قرائت افزایشی بر پایهٔ آستانه‌ها", () => {
  const input = { alertLimit: 70, alarmLimit: 85, tripLimit: 95 };
  assert.equal(evaluateCondition({ value: 50, ...input }).severity, "normal");
  assert.equal(evaluateCondition({ value: 75, ...input }).severity, "alert");
  assert.equal(evaluateCondition({ value: 90, ...input }).severity, "alarm");
  assert.equal(evaluateCondition({ value: 100, ...input }).severity, "trip");
  assert.equal(evaluateCondition({ value: 100, ...input }).zone, "D");
  assert.equal(evaluateCondition({ value: 50, ...input }).zone, "A");
});

test("ISO 17359: جهت کاهشی (مقاومت عایقی) با کوچک‌شدن بدتر می‌شود", () => {
  const input = { alertLimit: 10, alarmLimit: 5, tripLimit: 2, direction: "decreasing" };
  assert.equal(evaluateCondition({ value: 50, ...input }).severity, "normal");
  assert.equal(evaluateCondition({ value: 7, ...input }).severity, "alert");
  assert.equal(evaluateCondition({ value: 3, ...input }).severity, "alarm");
  assert.equal(evaluateCondition({ value: 1, ...input }).severity, "trip");
});

test("ISO 17359: انحراف از مبنا و اقدام پیشنهادی گزارش می‌شود", () => {
  const result = evaluateCondition({ value: 90, alertLimit: 70, alarmLimit: 85, baseline: 60 });
  assert.equal(result.deviationFromBaselinePct, 50);
  assert.ok(result.actionFa.includes("دستورکار"), "اقدام منطقهٔ alarm باید صدور دستورکار باشد");
  assert.equal(evaluateCondition({ value: 60, alertLimit: 70, alarmLimit: 85, baseline: 60 }).deviationFromBaselinePct, 0);
  /* بدون مبنا، انحراف تعریف‌نشده است نه صفر. */
  assert.equal(evaluateCondition({ value: 60, alertLimit: 70, alarmLimit: 85 }).deviationFromBaselinePct, null);
});

/* ═══════════════════════ ۵. IEEE 1366 ═══════════════════════ */

test("IEEE 1366: SAIDI/SAIFI/CAIDI/ASAI/MAIFI با اعداد دستی مطابقت دارند", () => {
  const result = computeSupplyReliability({
    customersServed: 1000,
    periodMinutes: 525_600, /* یک سال */
    events: [
      { customersAffected: 100, durationMinutes: 60 },
      { customersAffected: 50, durationMinutes: 3, isMomentary: true },
    ],
  });
  /* SAIDI = 100×60 / 1000 = 6 دقیقه */
  assert.equal(result.saidiMinutes, 6);
  /* SAIFI = 100 / 1000 = 0.1 */
  assert.equal(result.saifiCount, 0.1);
  /* CAIDI = 6000 / 100 = 60 و باید برابر SAIDI/SAIFI باشد */
  assert.equal(result.caidiMinutes, 60);
  assert.equal(result.caidiMinutes, result.saidiMinutes / result.saifiCount);
  /* MAIFI فقط قطعی لحظه‌ای را می‌شمارد: 50/1000 */
  assert.equal(result.maifiCount, 0.05);
  /* ASAI = (1000×525600 − 6000) / (1000×525600) */
  assert.ok(Math.abs(result.asaiPct - ((1000 * 525_600 - 6000) / (1000 * 525_600)) * 100) < 1e-9);
  assert.equal(result.totalInterruptions, 2);
  assert.equal(result.customersInterrupted, 100);
});

test("IEEE 1366: رویداد عمده با پرچم از محاسبه کنار گذاشته می‌شود", () => {
  const events = [
    { customersAffected: 100, durationMinutes: 60 },
    { customersAffected: 900, durationMinutes: 600, isMajorEvent: true },
  ];
  const withMajor = computeSupplyReliability({ customersServed: 1000, periodMinutes: 525_600, events });
  const withoutMajor = computeSupplyReliability({ customersServed: 1000, periodMinutes: 525_600, events, excludeMajorEvents: true });
  assert.equal(withoutMajor.excludedMajorEvents, 1);
  assert.equal(withoutMajor.saidiMinutes, 6);
  assert.ok(withMajor.saidiMinutes > withoutMajor.saidiMinutes);
});

test("IEEE 1366: صفر مشتری با هشدار صریح گزارش می‌شود نه تقسیم بر صفر", () => {
  const result = computeSupplyReliability({ customersServed: 0, periodMinutes: 1440, events: [] });
  assert.equal(result.saidiMinutes, 0);
  assert.equal(result.saifiCount, 0);
  assert.equal(result.asaiPct, 100);
  assert.ok(result.warnings.some((warning) => warning.includes("صفر")));
});

test("IEEE 1366: ورودی منفی و دورهٔ نامعتبر استثنا می‌دهند", () => {
  assert.throws(() => computeSupplyReliability({
    customersServed: -5, periodMinutes: 1440, events: [],
  }), RangeError);
  assert.throws(() => computeSupplyReliability({
    customersServed: 10, periodMinutes: 0, events: [],
  }), RangeError);
  assert.throws(() => computeSupplyReliability({
    customersServed: 10, periodMinutes: 1440, events: [{ customersAffected: -1, durationMinutes: 5 }],
  }), RangeError);
});

/* ═══════════════════════ ۶. OEE v2 ═══════════════════════ */

test("OEE: A×P×Q و شش اتلاف بزرگ", () => {
  const result = computeOee({
    calendarMinutes: 1440, plannedProductionMinutes: 480, runMinutes: 420,
    totalUnits: 20000, goodUnits: 19600, idealCycleTimeSeconds: 1.1,
    breakdownMinutes: 40, setupMinutes: 20, minorStopMinutes: 15,
    reducedSpeedMinutes: 25, startupRejectUnits: 100, productionRejectUnits: 300,
  });
  /* دسترس‌پذیری = 420/480 = 87.5٪ */
  assert.equal(result.availabilityPct, 87.5);
  /* کارایی = (1.1 × 20000 / 60) / 420 = 366.667/420 = 87.3٪ */
  assert.equal(result.performancePct, 87.3);
  /* کیفیت = 19600/20000 = 98٪ */
  assert.equal(result.qualityPct, 98);
  assert.equal(result.oeePct, 74.86);
  /* TEEP = OEE × (480/1440) */
  assert.equal(result.teepPct, 24.95);
  assert.equal(result.sixBigLosses.breakdownMinutes, 40);
  assert.equal(result.sixBigLosses.productionRejectUnits, 300);
});

test("OEE: کارایی بالای ۱۰۰٪ بریده نمی‌شود بلکه هشدار می‌دهد", () => {
  const result = computeOee({
    calendarMinutes: 600, plannedProductionMinutes: 480, runMinutes: 480,
    totalUnits: 30000, goodUnits: 30000, idealCycleTimeSeconds: 1.1,
  });
  assert.ok(result.performancePct > 100, "کارایی باید بالای ۱۰۰٪ بماند تا خطای داده پنهان نشود");
  assert.ok(result.warnings.some((warning) => warning.includes("چرخهٔ ایده‌آل")));
});

test("OEE: رابطه‌های ناممکن بین ورودی‌ها استثنا می‌دهند", () => {
  const base = { calendarMinutes: 600, plannedProductionMinutes: 480, runMinutes: 480, totalUnits: 100, goodUnits: 100, idealCycleTimeSeconds: 1 };
  assert.throws(() => computeOee({ ...base, runMinutes: 500 }), RangeError);          /* کار > برنامه */
  assert.throws(() => computeOee({ ...base, goodUnits: 200 }), RangeError);           /* سالم > کل */
  assert.throws(() => computeOee({ ...base, plannedProductionMinutes: 700 }), RangeError); /* برنامه > تقویم */
  assert.throws(() => computeOee({ ...base, idealCycleTimeSeconds: 0 }), RangeError);
});

/* ═══════════════════════ ۷. قابلیت اطمینان ═══════════════════════ */

test("قابلیت اطمینان: MTBF/MTTR/MTTF/λ/R(t)/دسترس‌پذیری", () => {
  const result = computeReliability({
    calendarHours: 8760, operatingHours: 8000, downtimeHours: 760,
    repairHours: 100, failureCount: 10, missionTimeHours: 500,
  });
  assert.equal(result.mtbfHours, 800);          /* 8000/10 */
  assert.equal(result.mttrHours, 10);           /* 100/10 */
  assert.equal(result.mttfHours, 790);          /* MTBF − MTTR */
  assert.equal(result.failureRateLambda, 0.00125);
  assert.equal(result.availabilityPct, 91.3242); /* 8000/8760 */
  assert.equal(result.inherentAvailabilityPct, 98.7654); /* 800/810 */
  /* R(500) = e^(−0.00125×500) = e^(−0.625) */
  assert.ok(Math.abs(result.reliabilityAtMission - Math.exp(-0.625)) < 1e-6);
});

test("قابلیت اطمینان: با صفر خرابی، MTBF بی‌نهایت نمی‌شود بلکه null است", () => {
  const result = computeReliability({
    calendarHours: 8760, operatingHours: 8000, downtimeHours: 760, failureCount: 0,
  });
  assert.equal(result.mtbfHours, null);
  assert.equal(result.failureRateLambda, null);
  assert.equal(result.reliabilityAtMission, null);
  /* دسترس‌پذیری هنوز معنا دارد. */
  assert.equal(result.availabilityPct, 91.3242);
  assert.ok(result.warnings.some((warning) => warning.includes("تعریف‌نشده")));
});

test("قابلیت اطمینان: انطباق PM و هشدار دادهٔ ناسازگار", () => {
  const result = computeReliability({
    calendarHours: 8760, operatingHours: 8000, downtimeHours: 760,
    failureCount: 4, pmScheduled: 10, pmDoneOnTime: 8,
  });
  assert.equal(result.pmCompliancePct, 80);
  const broken = computeReliability({
    calendarHours: 8760, operatingHours: 8000, downtimeHours: 760,
    failureCount: 4, pmScheduled: 10, pmDoneOnTime: 12,
  });
  assert.ok(broken.warnings.some((warning) => warning.includes("PM")));
});

test("قابلیت اطمینان: مجموع کار و توقف بیش از تقویم استثنا می‌دهد", () => {
  assert.throws(() => computeReliability({
    calendarHours: 100, operatingHours: 80, downtimeHours: 30, failureCount: 1,
  }), RangeError);
});

/* ═══════════════════════ ۸. IEC 60300-3-3 — LCC ═══════════════════════ */

test("LCC: عامل تنزیل و عامل اقساط", () => {
  assert.equal(discountFactor(0, 10), 1);
  assert.ok(Math.abs(discountFactor(1, 10) - 1 / 1.1) < 1e-12);
  assert.equal(annuityFactor(10, 0), 10);
  /* (1 − 1.1^−10)/0.1 = 6.144567… */
  assert.ok(Math.abs(annuityFactor(10, 10) - 6.1445671057) < 1e-6);
});

test("LCC: NPV تفکیکی پنج‌گانه و جمع کل", () => {
  const result = computeLifeCycleCost({
    lifeYears: 10, discountRatePct: 10,
    acquisitionCost: 1000, maintenanceCostPerYear: 100,
  });
  assert.equal(result.npvAcquisition, 1000);
  /* 100 × 6.144567 = 614.4567 → 614.46 */
  assert.equal(result.npvMaintenance, 614.46);
  assert.equal(result.npvOperation, 0);
  assert.equal(result.totalNpv, 1614.46);
  /* سهم‌ها باید ۱۰۰٪ شوند. */
  const shareSum = Object.values(result.shares).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(shareSum - 100) < 0.01, `مجموع سهم‌ها ${shareSum} است`);
});

test("LCC: ارزش باقی‌مانده از کل کم می‌شود و اسقاط در سال آخر تنزیل می‌شود", () => {
  const result = computeLifeCycleCost({
    lifeYears: 5, discountRatePct: 10, acquisitionCost: 1000,
    disposalCost: 200, residualValue: 300,
  });
  /* (200 − 300) × 1.1^−5 = −100 × 0.620921 = −62.09 */
  assert.equal(result.npvDisposal, -62.09);
  assert.equal(result.totalNpv, 937.91);
});

test("LCC: جریان نقدی صریح بر هزینهٔ سالانهٔ ثابت اولویت دارد", () => {
  const flat = computeLifeCycleCost({ lifeYears: 3, discountRatePct: 0, acquisitionCost: 0, operatingCostPerYear: 100 });
  const explicit = computeLifeCycleCost({ lifeYears: 3, discountRatePct: 0, acquisitionCost: 0, yearlyCashflows: [100, 200, 300] });
  assert.equal(flat.npvOperation, 300);
  assert.equal(explicit.npvOperation, 600);
});

test("LCC: انتخاب گزینهٔ بهینه و هشدار اختلاف زیر یک درصد", () => {
  const clear = selectLccOption([
    { name: "A", totalNpv: 1000 }, { name: "B", totalNpv: 1500 }, { name: "C", totalNpv: 1200 },
  ]);
  assert.equal(clear.selected, "A");
  assert.deepEqual(clear.ranked.map((item) => item.name), ["A", "C", "B"]);
  assert.equal(clear.warnings.length, 0);

  const close = selectLccOption([{ name: "A", totalNpv: 1000 }, { name: "B", totalNpv: 1005 }]);
  assert.ok(close.warnings.some((warning) => warning.includes("۱٪")));
  assert.equal(selectLccOption([]).selected, null);
});

/* ═══════════════════════ ۹. PMO Study — بهینه‌سازی PM ═══════════════════════ */

test("وایبول: R(0)=1، R(η)≈0.368 و تابع نزولی است", () => {
  assert.equal(weibullReliability(0, 1000, 2), 1);
  assert.ok(Math.abs(weibullReliability(1000, 1000, 2) - Math.exp(-1)) < 1e-12);
  assert.ok(weibullReliability(500, 1000, 2) > weibullReliability(1500, 1000, 2));
  assert.throws(() => weibullReliability(100, 0, 2), RangeError);
  assert.throws(() => weibullReliability(100, 1000, -1), RangeError);
});

test("PMO: با β>۱ (فرسایش) فاصلهٔ بهینه پیدا و صرفه‌جویی گزارش می‌شود", () => {
  const result = optimizePmInterval({
    eta: 1000, beta: 2.5, preventiveCost: 1000, failureCost: 20000, meanRepairHours: 20,
  });
  assert.equal(result.wearOutDetected, true);
  assert.ok(result.recommendedInterval > 0);
  assert.ok(result.grid.length > 10, "شبکهٔ جست‌وجو باید چند نقطه داشته باشد");
  assert.ok(result.savingPct > 0, `سرویس باید صرفه‌جویی ایجاد کند (به‌دست‌آمده: ${result.savingPct})`);
  /* نرخ هزینهٔ بهینه باید از حالت بدون سرویس کمتر باشد. */
  assert.ok(result.costRateAtRecommended < result.costRateRunToFailure);
  /* نقطهٔ بهینه باید واقعاً کمینهٔ شبکه باشد. */
  const minInGrid = Math.min(...result.grid.map((point) => point.costRate));
  assert.ok(Math.abs(result.costRateAtRecommended - minInGrid) < 1e-6);
});

test("PMO: با β≤۱ سرویس دوره‌ای توصیه نمی‌شود — مهم‌ترین نتیجهٔ PMO Study", () => {
  const result = optimizePmInterval({
    eta: 1000, beta: 0.8, preventiveCost: 1000, failureCost: 20000, meanRepairHours: 20,
  });
  assert.equal(result.wearOutDetected, false);
  assert.ok(result.recommendationFa.includes("کار تا خرابی"));
  assert.ok(result.warnings.some((warning) => warning.includes("β")));
  assert.equal(result.savingPct, 0);
  assert.equal(result.grid.length, 0, "بدون الگوی فرسایش، شبکهٔ جست‌وجو معنا ندارد");
});

test("PMO: نرخ هزینهٔ مدل تعویض سنی با ورودی نامعتبر استثنا می‌دهد", () => {
  const input = { eta: 1000, beta: 2, preventiveCost: 1000, failureCost: 20000, meanRepairHours: 20 };
  assert.throws(() => ageReplacementCostRate(0, input), RangeError);
  assert.throws(() => ageReplacementCostRate(500, { ...input, preventiveCost: -1 }), RangeError);
  assert.throws(() => optimizePmInterval({ ...input, eta: -1 }), RangeError);
});

/* ═══════════════════════ ۱۰. BS EN 15341 — KPI ═══════════════════════ */

test("EN 15341: سلامت شاخص در سه جهت بهینه‌سازی", () => {
  const maximize = evaluateKpiHealth({ actualValue: 95, targetValue: 90, warnThreshold: 80, direction: "maximize" });
  assert.equal(maximize.health, "green");
  assert.equal(maximize.variancePct, 5.5556);
  assert.equal(evaluateKpiHealth({ actualValue: 85, targetValue: 90, warnThreshold: 80, direction: "maximize" }).health, "amber");
  assert.equal(evaluateKpiHealth({ actualValue: 50, targetValue: 90, warnThreshold: 80, direction: "maximize" }).health, "red");

  const minimize = evaluateKpiHealth({ actualValue: 2, targetValue: 5, warnThreshold: 8, direction: "minimize" });
  assert.equal(minimize.health, "green");
  assert.equal(evaluateKpiHealth({ actualValue: 7, targetValue: 5, warnThreshold: 8, direction: "minimize" }).health, "amber");
  assert.equal(evaluateKpiHealth({ actualValue: 20, targetValue: 5, warnThreshold: 8, direction: "minimize" }).health, "red");

  const target = evaluateKpiHealth({ actualValue: 101, targetValue: 100, warnThreshold: 5, alarmThreshold: 15, direction: "target" });
  assert.equal(target.health, "green");
  assert.equal(evaluateKpiHealth({ actualValue: 110, targetValue: 100, warnThreshold: 5, alarmThreshold: 15, direction: "target" }).health, "amber");
  assert.equal(evaluateKpiHealth({ actualValue: 130, targetValue: 100, warnThreshold: 5, alarmThreshold: 15, direction: "target" }).health, "red");
});

test("EN 15341: هدف صفر باعث تقسیم بر صفر نمی‌شود", () => {
  const result = evaluateKpiHealth({ actualValue: 5, targetValue: 0, warnThreshold: 1, direction: "maximize" });
  assert.equal(result.variancePct, null);
  assert.equal(evaluateKpiHealth({ actualValue: 5, targetValue: null, direction: "maximize" }).health, "green");
  assert.throws(() => evaluateKpiHealth({ actualValue: NaN, targetValue: 1, direction: "maximize" }), RangeError);
  assert.throws(() => evaluateKpiHealth({ actualValue: 1, targetValue: 1, direction: "sideways" }), RangeError);
});

/* ═══════════════════════ ۱۱. بحرانی‌بودن و اولویت ═══════════════════════ */

test("بحرانی‌بودن: رتبهٔ A برای تجهیز با اثر ایمنی و تولید بالا", () => {
  const result = computeAssetCriticality({
    safetyImpact: 5, productionImpact: 5, maintenanceCostImpact: 4, failureFrequency: 3, spareAvailability: 4,
  });
  assert.equal(result.rank, "A");
  assert.ok(result.driversFa.length >= 3);
  const low = computeAssetCriticality({
    safetyImpact: 1, productionImpact: 1, maintenanceCostImpact: 1, failureFrequency: 1, spareAvailability: 1,
  });
  assert.equal(low.rank, "D");
  /* امتیاز باید در همان بازهٔ ۱..۵ ورودی بماند. اگر روزی مقیاس عوض شود،
   * آستانه‌های A≥4/B≥3/C≥2 بی‌معنا می‌شوند و رتبه‌بندی همهٔ تجهیز یکی می‌شود. */
  assert.equal(low.score, 1);
  assert.equal(result.score, 4.5);
  assert.equal(computeAssetCriticality({
    safetyImpact: 5, productionImpact: 5, maintenanceCostImpact: 5, failureFrequency: 5, spareAvailability: 5,
  }).score, 5);
  /* وزن‌های سفارشی که جمعشان ۱ نیست، نرمال می‌شوند. */
  assert.equal(computeAssetCriticality({
    safetyImpact: 5, productionImpact: 5, maintenanceCostImpact: 5, failureFrequency: 5, spareAvailability: 5,
    weights: { safety: 2, production: 2, cost: 2, frequency: 2, spare: 2 },
  }).score, 5);
  assert.throws(() => computeAssetCriticality({
    safetyImpact: 6, productionImpact: 1, maintenanceCostImpact: 1, failureFrequency: 1, spareAvailability: 1,
  }), RangeError);
});

test("اولویت دستورکار: توقف کامل کارخانه بالاترین امتیاز را می‌گیرد", () => {
  const high = computeWorkOrderPriorityScore({
    criticalityRank: "A", isAssetDown: true, productionImpact: "plant-stop",
    safetyConcern: true, hoursUntilDue: -5,
  });
  const low = computeWorkOrderPriorityScore({
    criticalityRank: "D", isAssetDown: false, productionImpact: "none",
    safetyConcern: false, hoursUntilDue: 500,
  });
  assert.ok(high.score > low.score);
  /* همهٔ مؤلفه‌ها حداکثر: 30+25+20+15+10 = 100 */
  assert.equal(high.score, 100);
  assert.ok(high.reasonFa.includes("بحرانی‌بودن A"));
  assert.throws(() => computeWorkOrderPriorityScore({
    criticalityRank: "X", isAssetDown: false, productionImpact: "none", safetyConcern: false, hoursUntilDue: null,
  }), RangeError);
});

/* ═══════════════════════ ۱۲. درخت تجهیز ═══════════════════════ */

test("درخت: عمق و مسیر کد از فهرست مسطح ساخته می‌شود", () => {
  const tree = buildTree([
    { id: "a", parentId: null, code: "A" },
    { id: "b", parentId: "a", code: "B" },
    { id: "c", parentId: "b", code: "C" },
    { id: "d", parentId: null, code: "D" },
  ]);
  assert.equal(tree.maxDepth, 2);
  assert.equal(tree.roots.length, 2);
  assert.equal(tree.cycleMembers.length, 0);
  const c = tree.flat.find((node) => node.id === "c");
  assert.equal(c.depth, 2);
  assert.equal(c.pathCode, "A/B/C");
});

test("درخت: حلقه به حلقهٔ بی‌پایان نمی‌رسد بلکه گزارش می‌شود", () => {
  const tree = buildTree([
    { id: "a", parentId: "b", code: "A" },
    { id: "b", parentId: "a", code: "B" },
    { id: "c", parentId: null, code: "C" },
  ]);
  assert.deepEqual(tree.cycleMembers.sort(), ["a", "b"]);
  assert.equal(tree.flat.length, 1);
  assert.equal(tree.flat[0].id, "c");
});

test("درخت: ارجاع به والد ناموجود، گره را ریشه می‌کند و یتیم نمی‌سازد", () => {
  const tree = buildTree([{ id: "a", parentId: "ghost", code: "A" }]);
  assert.equal(tree.roots.length, 1);
  assert.equal(tree.flat[0].depth, 0);
  assert.equal(tree.orphans.length, 0);
});

test("درخت: تشخیص حلقهٔ احتمالی پیش از ذخیره", () => {
  const nodes = [
    { id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" },
  ];
  assert.equal(wouldCreateCycle(nodes, "c", "a"), true);  /* a را زیر c بردن → حلقه */
  assert.equal(wouldCreateCycle(nodes, "a", "a"), true);  /* خودارجاعی */
  assert.equal(wouldCreateCycle(nodes, "a", "c"), false); /* جهت درست */
});

/* ═══════════════════════ ۱۳. گردش‌کار ═══════════════════════ */

const WORKFLOW = {
  workflowCode: "wo-approval",
  startStepCode: "draft",
  steps: [
    { stepCode: "draft", stepKind: "task", ownerRole: "maintenance_planner", slaHours: 24 },
    { stepCode: "approved", stepKind: "approval", ownerRole: "maintenance_manager", slaHours: 12, requiresEvidence: true },
    { stepCode: "done", stepKind: "end", ownerRole: "maintenance_manager", isTerminal: true },
  ],
  transitions: [
    { fromStepCode: "draft", toStepCode: "approved", actionCode: "submit", requiredPermission: "cmms.wo.create" },
    { fromStepCode: "approved", toStepCode: "done", actionCode: "approve", requiredPermission: "cmms.wo.release" },
  ],
};

test("گردش‌کار: تعریف سالم بدون ایراد اعتبارسنجی می‌شود", () => {
  assert.deepEqual(validateWorkflowDefinition(WORKFLOW), []);
});

test("گردش‌کار: بن‌بست، گام ناموجود و گام شروع نامعتبر رد می‌شوند", () => {
  const deadEnd = validateWorkflowDefinition({
    ...WORKFLOW,
    steps: [{ stepCode: "draft", stepKind: "task", ownerRole: "maintenance_planner" }],
    transitions: [],
  });
  assert.ok(deadEnd.some((issue) => issue.includes("بن‌بست")));
  assert.ok(deadEnd.some((issue) => issue.includes("پایانی")));

  const badStart = validateWorkflowDefinition({ ...WORKFLOW, startStepCode: "ghost" });
  assert.ok(badStart.some((issue) => issue.includes("گام شروع")));

  const badTarget = validateWorkflowDefinition({
    ...WORKFLOW,
    transitions: [{ fromStepCode: "draft", toStepCode: "ghost", actionCode: "submit", requiredPermission: "cmms.wo.create" }],
  });
  assert.ok(badTarget.some((issue) => issue.includes("گام ناموجود")));

  const noPermission = validateWorkflowDefinition({
    ...WORKFLOW,
    transitions: [{ fromStepCode: "draft", toStepCode: "approved", actionCode: "submit", requiredPermission: "" }],
  });
  assert.ok(noPermission.some((issue) => issue.includes("مجوز لازم ندارد")));
});

test("گردش‌کار: گذار با مجوز درست پیش می‌رود و SLA محاسبه می‌شود", () => {
  const result = advanceWorkflow({
    definition: WORKFLOW,
    currentStepCode: "draft",
    actionCode: "submit",
    now: "2026-10-01T00:00:00Z",
    actorPermissions: ["cmms.wo.create"],
    actorRoles: ["maintenance_planner"],
    evidenceProvided: true,
  });
  assert.equal(result.nextStepCode, "approved");
  assert.equal(result.slaHours, 12);
  assert.equal(result.dueAt, "2026-10-01T12:00:00.000Z");
  assert.equal(result.terminal, false);
});

test("گردش‌کار: گذار تعریف‌نشده و مجوز ناکافی رد می‌شوند", () => {
  assert.throws(() => advanceWorkflow({
    definition: WORKFLOW, currentStepCode: "draft", actionCode: "approve",
    now: new Date(), actorPermissions: ["cmms.wo.release"], actorRoles: ["maintenance_manager"],
  }), (error) => error instanceof CmmsWorkflowError && error.code === "CMMS_WF_NO_TRANSITION");

  assert.throws(() => advanceWorkflow({
    definition: WORKFLOW, currentStepCode: "draft", actionCode: "submit",
    now: new Date(), actorPermissions: [], actorRoles: ["maintenance_planner"],
  }), (error) => error instanceof CmmsWorkflowError && error.code === "CMMS_WF_FORBIDDEN");
});

test("گردش‌کار: گام نیازمند مدرک بدون مدرک پذیرفته نمی‌شود", () => {
  assert.throws(() => advanceWorkflow({
    definition: WORKFLOW, currentStepCode: "draft", actionCode: "submit",
    now: new Date(), actorPermissions: ["cmms.wo.create"], actorRoles: ["maintenance_planner"],
    evidenceProvided: false,
  }), (error) => error instanceof CmmsWorkflowError && error.code === "CMMS_WF_EVIDENCE_REQUIRED");
});

test("گردش‌کار: گام پایانی، نمونه را می‌بندد و SLA نمی‌گیرد", () => {
  const result = advanceWorkflow({
    definition: WORKFLOW, currentStepCode: "approved", actionCode: "approve",
    now: "2026-10-01T00:00:00Z",
    actorPermissions: ["cmms.wo.release"], actorRoles: ["maintenance_manager"],
  });
  assert.equal(result.nextStepCode, "done");
  assert.equal(result.terminal, true);
  assert.equal(result.dueAt, null, "گام پایانی سررسید SLA ندارد");
});

test("گردش‌کار: گام نیازمند مدرک، نبودِ فیلد را «ندارد» می‌گیرد (شکست-بسته)", () => {
  /* پیش‌فرضِ امن: اگر فراخوان evidenceProvided را نفرستد، گذار رد می‌شود.
   * گردش‌کار تأییدی که با فراموش‌کردن یک فیلد باز شود، در ممیزی مردود است. */
  assert.throws(() => advanceWorkflow({
    definition: WORKFLOW, currentStepCode: "draft", actionCode: "submit",
    now: new Date(), actorPermissions: ["cmms.wo.create"], actorRoles: ["maintenance_planner"],
  }), (error) => error instanceof CmmsWorkflowError && error.code === "CMMS_WF_EVIDENCE_REQUIRED");
  /* مقدار truthy غیر از true هم پذیرفته نمی‌شود — فقط true صریح. */
  assert.throws(() => advanceWorkflow({
    definition: WORKFLOW, currentStepCode: "draft", actionCode: "submit",
    now: new Date(), actorPermissions: ["cmms.wo.create"], actorRoles: ["maintenance_planner"],
    evidenceProvided: "yes",
  }), (error) => error instanceof CmmsWorkflowError && error.code === "CMMS_WF_EVIDENCE_REQUIRED");
});

test("گردش‌کار: زمان نامعتبر استثنا می‌دهد", () => {
  assert.throws(() => advanceWorkflow({
    definition: WORKFLOW, currentStepCode: "draft", actionCode: "submit",
    now: "not-a-date", actorPermissions: ["cmms.wo.create"], actorRoles: ["maintenance_planner"],
    evidenceProvided: true,
  }), (error) => error instanceof CmmsWorkflowError && error.code === "CMMS_WF_BAD_TIME");
});
