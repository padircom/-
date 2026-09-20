import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CpmCycleError,
  DEFAULT_NEAR_CRITICAL,
  IRAN_CALENDAR,
  PEX_FORMULA_VERSION,
  activityProgress,
  addWorkingDays,
  canPostProgress,
  computeCpm,
  computeWeights,
  cpAlerts,
  cpSnapshot,
  dcma14,
  escalationLevel,
  isWorkingDay,
  milestoneAlerts,
  milestonePenalty,
  milestoneStatus,
  nextWorkingDay,
  plannedPercentAt,
  ppc,
  progressVariance,
  rollUp,
  topoSort,
  validateRoc,
  workingDaysBetween,
} from "./pexLogic.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

/* ── تقویم ── */
test("تقویم ایران: جمعه تعطیل است", () => {
  assert.equal(isWorkingDay("2026-09-12"), true); // شنبه
  assert.equal(isWorkingDay("2026-09-11"), false); // جمعه
  assert.equal(nextWorkingDay("2026-09-11"), "2026-09-12");
  assert.equal(isWorkingDay("2026-09-12", { workDays: [0, 1, 2, 3, 4], holidays: [] }), false);
});

test("جمع و شمارش روز کاری", () => {
  assert.equal(addWorkingDays("2026-09-10", 1), "2026-09-12"); // پنجشنبه → جمعه رد می‌شود
  assert.equal(addWorkingDays("2026-09-12", -1), "2026-09-10");
  assert.equal(addWorkingDays("2026-09-12", 0), "2026-09-12");
  assert.equal(workingDaysBetween("2026-09-12", "2026-09-16"), 5);
  assert.equal(workingDaysBetween("2026-09-16", "2026-09-12"), -5);
  assert.equal(workingDaysBetween("2026-09-10", "2026-09-12"), 2); // جمعه شمرده نمی‌شود
});

test("تعطیلات رسمی از تقویم کسر می‌شود", () => {
  const cal = { ...IRAN_CALENDAR, holidays: ["2026-09-14"] };
  assert.equal(isWorkingDay("2026-09-14", cal), false);
  assert.equal(addWorkingDays("2026-09-13", 1, cal), "2026-09-15");
});

/* ── CPM ── */
const ACTS = [
  { id: "A", nameFa: "تجهیز کارگاه", duration: 5 },
  { id: "B", nameFa: "خاکبرداری", duration: 10 },
  { id: "C", nameFa: "فونداسیون", duration: 15 },
  { id: "D", nameFa: "اسکلت", duration: 20 },
  { id: "E", nameFa: "محوطه", duration: 8 },
];
const RELS = [
  { pred: "A", succ: "B", type: "FS" },
  { pred: "B", succ: "C", type: "FS" },
  { pred: "C", succ: "D", type: "FS" },
  { pred: "B", succ: "E", type: "FS" },
  { pred: "E", succ: "D", type: "FS" },
];

test("ترتیب توپولوژیک و تشخیص حلقه", () => {
  const order = topoSort(ACTS, RELS);
  assert.ok(order.indexOf("A") < order.indexOf("B"));
  assert.ok(order.indexOf("C") < order.indexOf("D"));
  assert.throws(
    () => topoSort([{ id: "X", nameFa: "x", duration: 1 }, { id: "Y", nameFa: "y", duration: 1 }], [
      { pred: "X", succ: "Y", type: "FS" },
      { pred: "Y", succ: "X", type: "FS" },
    ]),
    CpmCycleError
  );
});

test("CPM: مسیر بحرانی، شناوری کل و آزاد", () => {
  const r = computeCpm(ACTS, RELS, "2026-09-12");
  assert.equal(r.projectStart, "2026-09-12");
  assert.equal(r.formulaVersion, PEX_FORMULA_VERSION);
  assert.deepEqual(r.criticalPath, ["A", "B", "C", "D"]);
  const byId = Object.fromEntries(r.activities.map((a) => [a.id, a]));
  assert.equal(byId.A.es, "2026-09-12");
  assert.equal(byId.A.ef, "2026-09-16"); // ۵ روز کاری شامل روز شروع
  assert.equal(byId.B.es, "2026-09-17");
  assert.equal(byId.A.totalFloat, 0);
  assert.equal(byId.A.freeFloat, 0);
  assert.equal(byId.E.totalFloat, 7);
  assert.equal(byId.E.critical, false);
  assert.equal(r.projectFinish, byId.D.ef);
});

test("CPM: رابطه SS با لگ و مایلستون صفرمدت", () => {
  const acts = [
    { id: "P", nameFa: "پیش‌نیاز", duration: 10 },
    { id: "Q", nameFa: "هم‌پوشان", duration: 6 },
    { id: "M", nameFa: "مایلستون", duration: 0, isMilestone: true },
  ];
  const rels = [
    { pred: "P", succ: "Q", type: "SS", lag: 3 },
    { pred: "Q", succ: "M", type: "FS" },
  ];
  const r = computeCpm(acts, rels, "2026-09-12");
  const byId = Object.fromEntries(r.activities.map((a) => [a.id, a]));
  assert.equal(byId.P.es, "2026-09-12");
  assert.equal(byId.Q.es, addWorkingDays("2026-09-12", 3));
  assert.equal(byId.M.es, byId.M.ef); // مایلستون طول ندارد
});

test("CPM: قید شروع زودتر-از و شناوری منفی", () => {
  const acts = [
    { id: "A", nameFa: "a", duration: 5 },
    { id: "B", nameFa: "b", duration: 5, constraintStart: "2026-10-01" },
  ];
  const r = computeCpm(acts, [{ pred: "A", succ: "B", type: "FS" }], "2026-09-12");
  const byId = Object.fromEntries(r.activities.map((a) => [a.id, a]));
  assert.equal(byId.B.es, "2026-10-01");
  assert.ok(byId.A.totalFloat > 0, "فعالیت A به‌خاطر قید جانشین شناوری می‌گیرد");
});

/* ── پایش مسیر بحرانی ── */
test("Snapshot و رانش مسیر بحرانی", () => {
  const r = computeCpm(ACTS, RELS, "2026-09-12");
  const snap = cpSnapshot(r, 40, "2026-10-20", 85, "2026-09-12");
  assert.equal(snap.drift, r.cpLengthDays - 40);
  assert.ok(snap.endDate > snap.baselineEndDate);
});

test("۹ قاعده هشدار مسیر بحرانی", () => {
  const r = computeCpm(ACTS, RELS, "2026-09-12");
  const snap = cpSnapshot(r, 30, "2026-10-01", 70, "2026-09-12");
  const alerts = cpAlerts(r, snap, { E: 20 }, ["A", "B", "C"], DEFAULT_NEAR_CRITICAL, ["D"]);
  const codes = alerts.map((a) => a.code);
  assert.ok(codes.includes("CP-R3"), "رانش مسیر بحرانی");
  assert.ok(codes.includes("CP-R5"), "لغزش تاریخ پایان");
  assert.ok(codes.includes("CP-R6"), "افت سلامت زمان‌بندی");
  assert.ok(codes.includes("CP-R2"), "افت شناوری فعالیت E");
  assert.ok(codes.includes("CP-R4"), "ورود D به مسیر بحرانی");
  assert.ok(alerts.every((a) => ["warning", "critical", "emergency"].includes(a.severity)));
  const clean = cpAlerts(r, cpSnapshot(r, r.cpLengthDays, r.projectFinish, 95, "2026-09-12"));
  assert.equal(clean.filter((a) => a.code === "CP-R3" || a.code === "CP-R5" || a.code === "CP-R6").length, 0);
});

test("DCMA 14: نمره سلامت و آزمون‌های شکست‌خورده", () => {
  const r = computeCpm(ACTS, RELS, "2026-09-12");
  const { checks, healthScore } = dcma14({
    cpm: r,
    rels: [...RELS, { pred: "A", succ: "E", type: "FS", lag: -3 }],
    dataDate: "2026-09-12",
    baselineCpLength: 50,
    baselineCompletedByDataDate: 4,
    actuallyCompleted: 2,
    hardConstraintCount: 0,
  });
  assert.equal(checks.length, 14);
  assert.equal(checks.find((c) => c.id === 2).pass, false); // Lead منفی وجود دارد
  assert.equal(checks.find((c) => c.id === 12).pass, false); // BEI = 0.5
  assert.equal(checks.find((c) => c.id === 13).pass, true); // مسیر بحرانی وجود دارد
  assert.ok(healthScore > 0 && healthScore < 100);
});

/* ── مایلستون ── */
const MS = {
  id: "MS-MECH-RFSU",
  nameFa: "تحویل مکانیکی",
  type: "Contractual",
  contractualDate: "2026-10-01",
  baselineDate: "2026-10-01",
  forecastDate: "2026-10-14",
  penaltyPerDay: 25_000,
  bonusPerDay: 10_000,
};

test("وضعیت مایلستون", () => {
  assert.equal(milestoneStatus(MS, "2026-09-12"), "AtRisk");
  assert.equal(milestoneStatus({ ...MS, forecastDate: "2026-09-28" }, "2026-09-12"), "OnTrack");
  assert.equal(milestoneStatus(MS, "2026-10-05"), "Delayed");
  assert.equal(milestoneStatus({ ...MS, actualDate: "2026-09-30" }, "2026-10-05"), "Achieved");
  assert.equal(milestoneStatus({ ...MS, cancelled: true }, "2026-10-05"), "Cancelled");
  assert.equal(milestoneStatus({ ...MS, forecastDate: "2026-09-20", totalFloat: -3 }, "2026-09-12"), "AtRisk");
});

test("جریمه و پاداش مایلستون", () => {
  const late = milestonePenalty({ ...MS, actualDate: "2026-10-08" }, "2026-10-10");
  assert.ok(late.days > 0);
  assert.equal(late.penalty, late.days * 25_000);
  assert.equal(late.bonus, 0);
  const early = milestonePenalty({ ...MS, actualDate: "2026-09-24" }, "2026-09-25");
  assert.ok(early.days < 0);
  assert.equal(early.penalty, 0);
  assert.equal(early.bonus, Math.abs(early.days) * 10_000);
});

test("سطوح تشدید", () => {
  assert.equal(escalationLevel(0), 0);
  assert.equal(escalationLevel(2), 1);
  assert.equal(escalationLevel(5), 2);
  assert.equal(escalationLevel(15), 3);
});

test("۷ قاعده هشدار مایلستون", () => {
  const alerts = milestoneAlerts([{ ...MS, totalFloat: -2 }], "2026-10-12");
  const codes = alerts.map((a) => a.code);
  assert.ok(codes.includes("MS-R1"), "تأخیر");
  assert.ok(codes.includes("MS-R4"), "جریمه انباشته");
  assert.ok(codes.includes("MS-R5"), "شناوری منفی");
  assert.ok(codes.includes("MS-R6"), "لغزش نسبت به پایه");
  assert.ok(codes.includes("MS-R7"), "تشدید");
  assert.equal(milestoneAlerts([{ ...MS, actualDate: "2026-09-30" }], "2026-10-12").length, 0);
  const countdown = milestoneAlerts([{ ...MS, forecastDate: "2026-09-30", alertDaysBefore: [7] }], addWorkingDays("2026-10-01", -7));
  assert.ok(countdown.some((a) => a.code === "MS-R3"));
});

/* ── PMS ── */
test("وزن‌دهی هزینه‌ای، نفر-ساعتی و ترکیبی", () => {
  const items = [
    { id: "W1", cost: 600, manHours: 200 },
    { id: "W2", cost: 400, manHours: 800 },
  ];
  const cost = computeWeights(items, "Cost");
  near(cost.W1, 0.6);
  const mh = computeWeights(items, "MH");
  near(mh.W1, 0.2);
  const hybrid = computeWeights(items, "Hybrid", 0.5);
  near(hybrid.W1, 0.4);
  near(Object.values(hybrid).reduce((a, b) => a + b, 0), 1);
  near(computeWeights(items, "Cost").W1 + computeWeights(items, "Cost").W2, 1);
});

test("اعتبارسنجی کتابخانه Rule of Credit", () => {
  const concrete = [
    { code: "S1", nameFa: "قالب", weight: 15 },
    { code: "S2", nameFa: "آرماتور", weight: 25 },
    { code: "S3", nameFa: "بتن‌ریزی", weight: 40, ir: true },
    { code: "S4", nameFa: "بازکردن قالب", weight: 10 },
    { code: "S5", nameFa: "عمل‌آوری", weight: 10 },
  ];
  assert.equal(validateRoc(concrete).ok, true);
  assert.equal(validateRoc(concrete.slice(0, 3)).ok, false);
  near(validateRoc(concrete).sum, 100);
});

test("پیشرفت فعالیت: گام دارای بازرسی بدون IR وارد EV نمی‌شود", () => {
  const steps = [
    { code: "S1", nameFa: "قالب", weight: 15 },
    { code: "S2", nameFa: "آرماتور", weight: 25 },
    { code: "S3", nameFa: "بتن‌ریزی", weight: 40, ir: true },
  ];
  const blocked = activityProgress(steps, [
    { code: "S1", percent: 100 },
    { code: "S2", percent: 100 },
    { code: "S3", percent: 100, irApproved: false },
  ]);
  near(blocked.physicalPct, 40);
  assert.deepEqual(blocked.blockedSteps, ["S3"]);

  const approved = activityProgress(steps, [
    { code: "S1", percent: 100 },
    { code: "S2", percent: 100 },
    { code: "S3", percent: 50, irApproved: true },
  ]);
  near(approved.physicalPct, 60);
  assert.equal(approved.blockedSteps.length, 0);
  near(activityProgress(steps, [{ code: "S1", percent: 150 }]).physicalPct, 15); // سقف ۱۰۰٪
});

test("جمع‌بندی سلسله‌مراتبی با وزن", () => {
  const weights = { A1: 0.6, A2: 0.4 };
  near(rollUp([{ id: "A1", percent: 50 }, { id: "A2", percent: 100 }], weights), 70);
  near(rollUp([{ id: "A1", percent: 50 }], weights), 50); // نرمال‌سازی روی فرزندان موجود
});

test("قفل دوره مانع ثبت پیشرفت می‌شود", () => {
  const open = { code: "2026-M09", from: "2026-09-01", to: "2026-09-30" };
  assert.equal(canPostProgress(open, "2026-09-15").ok, true);
  assert.equal(canPostProgress(open, "2026-10-02").reason, "out_of_period");
  assert.equal(canPostProgress({ ...open, closedAt: "2026-10-05" }, "2026-09-15").reason, "period_closed");
});

test("درصد برنامه‌ای، انحراف و PPC", () => {
  const curve = [
    { date: "2026-09-01", cumPct: 10 },
    { date: "2026-10-01", cumPct: 40 },
    { date: "2026-11-01", cumPct: 80 },
  ];
  near(plannedPercentAt(curve, "2026-09-01"), 10);
  near(plannedPercentAt(curve, "2026-12-01"), 80);
  const mid = plannedPercentAt(curve, "2026-09-16");
  assert.ok(mid > 10 && mid < 40, String(mid));
  assert.equal(progressVariance(35, 40).status, "behind");
  assert.equal(progressVariance(45, 40).status, "ahead");
  assert.equal(progressVariance(40.5, 40).status, "on_track");
  near(ppc(20, 17), 85);
  assert.equal(ppc(0, 5), 0);
});

/* ── وضعیت پیشرفت در CPM (Data Date) ── */
test("CPM با پیشرفت: خاتمه‌یافته قفل، در جریان از Data Date، شروع‌نشده پس از آن", () => {
  const acts = [
    { id: "A", nameFa: "تمام‌شده", duration: 10, actualStart: "2026-08-03", actualFinish: "2026-08-14" },
    { id: "B", nameFa: "در جریان", duration: 20, actualStart: "2026-08-17", remainingDuration: 6 },
    { id: "C", nameFa: "شروع‌نشده", duration: 5 },
  ];
  const rels = [
    { pred: "A", succ: "B", type: "FS" },
    { pred: "B", succ: "C", type: "FS" },
  ];
  const r = computeCpm(acts, rels, "2026-09-05");
  const byId = Object.fromEntries(r.activities.map((a) => [a.id, a]));
  assert.equal(byId.A.es, "2026-08-03");
  assert.equal(byId.A.ef, "2026-08-14");
  assert.equal(byId.A.critical, false, "کار تمام‌شده روی مسیر بحرانی باقی‌مانده نیست");
  assert.equal(byId.B.es, "2026-08-17");
  assert.equal(byId.B.ef, addWorkingDays("2026-09-05", 5), "پایان = Data Date + مدت باقی‌مانده");
  assert.ok(byId.C.es > byId.B.ef, "فعالیت شروع‌نشده پس از پایان پیش‌نیاز است");
  assert.ok(byId.C.es >= "2026-09-05", "هیچ کاری پیش از Data Date برنامه‌ریزی نمی‌شود");
  assert.ok(r.activities.every((a) => a.totalFloat >= 0), "شناوری منفی کاذب تولید نمی‌شود");
  assert.equal(r.projectFinish, byId.C.ef);
});

test("Progress Override: فعالیت شروع‌شده منتظر پیش‌نیاز عقب‌افتاده نمی‌ماند", () => {
  const acts = [
    { id: "P", nameFa: "پیش‌نیاز کند", duration: 40, actualStart: "2026-06-01", remainingDuration: 30 },
    { id: "S", nameFa: "جانشین زودشروع", duration: 10, actualStart: "2026-08-24", remainingDuration: 4 },
  ];
  const r = computeCpm(acts, [{ pred: "P", succ: "S", type: "FS" }], "2026-09-05");
  const byId = Object.fromEntries(r.activities.map((a) => [a.id, a]));
  assert.ok(byId.S.ef < byId.P.ef, "جانشین خارج از توالی زودتر تمام می‌شود");
  assert.equal(r.projectFinish, byId.P.ef);
});

/* ── یکپارچگی داده پروژه نمونه ── */
const { buildPexModel } = await import("./pexModelBundle.js");

test("مدل پروژه: وزن‌ها، جمع‌بندی و سازگاری تاریخ‌ها", () => {
  const m = buildPexModel();
  near(m.rows.reduce((s, r) => s + r.weight, 0), 1, 1e-9);
  assert.equal(m.rocIssues.length, 0, "همه دستورهای RoC باید جمع ۱۰۰ داشته باشند");
  assert.ok(m.cpm.criticalPath.length > 0);
  assert.ok(m.rows.every((r) => r.totalFloat >= 0 || r.critical));
  assert.equal(m.cpm.projectFinish, m.rows.find((r) => r.id === "PSU-RFSU").ef);
  assert.ok(m.overallPct < m.plannedPct, "پروژه نمونه عقب از برنامه است");
  assert.equal(m.variance.status, "behind");
  for (const w of m.wbsRollup) assert.ok(w.actualPct >= 0 && w.actualPct <= 100);
  near(m.wbsRollup.reduce((s, w) => s + w.weight, 0), 1, 1e-9);
});

test("مدل پروژه: پیش‌بینی مایلستون از CPM و جریمه قراردادی", () => {
  const m = buildPexModel();
  const rfsu = m.milestones.find((x) => x.id === "MS-MECH-RFSU");
  const driver = m.rows.find((r) => r.id === rfsu.driverActivity);
  assert.equal(rfsu.forecastDate, driver.ef, "پیش‌بینی مایلستون = EF فعالیت راننده");
  assert.equal(rfsu.status, "AtRisk");
  assert.equal(rfsu.penalty, 125_000);
  const done = m.milestones.find((x) => x.id === "MS-ENG-IFC");
  assert.equal(done.status, "Achieved");
  assert.ok(m.alerts.some((a) => a.refId === "MS-CIV-FOC" && a.code === "MS-R1"));
});

test("مدل پروژه: حالت وزن‌دهی ترکیبی وزن‌ها را جابه‌جا اما نرمال نگه می‌دارد", () => {
  const cost = buildPexModel("Cost");
  const hybrid = buildPexModel("Hybrid", 0.6);
  near(hybrid.rows.reduce((s, r) => s + r.weight, 0), 1, 1e-9);
  const idc = cost.rows.find((r) => r.id === "PRC-LLI").weight;
  const idh = hybrid.rows.find((r) => r.id === "PRC-LLI").weight;
  assert.ok(Math.abs(idc - idh) > 1e-6, "وزن نفر-ساعت باید سهم تدارکات را تغییر دهد");
  assert.notEqual(cost.overallPct, hybrid.overallPct);
});

test("مدل پروژه: گام‌های مسدود بابت نبود IR در پیشرفت لحاظ نمی‌شوند", () => {
  const m = buildPexModel();
  const pipe = m.rows.find((r) => r.id === "PIP-ERC");
  assert.ok(pipe.blockedSteps.includes("ndt"));
  assert.ok(m.blockedCount >= 1);
});
