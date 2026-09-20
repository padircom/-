/**
 * تست‌های افزونهٔ EQP — پوشش تحویلی‌های ۳ تا ۱۰ پراممپت
 * «MACHINERY & EQUIPMENT MANAGEMENT MODULE v1.0».
 * موتور پایه (eqm-v1) در server/eqm.test.mjs پوشش داده شده و اینجا تکرار نمی‌شود.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  EQP_KPI_BY_CODE,
  EQP_KPI_CATALOG,
  EQP_VERSION,
  EWS_EQP_RULES,
  CLASS_TO_ISO14224,
  DISPATCH_FLOW,
  DISPATCH_STATUSES,
  FUEL_KINDS,
  ISO14224_BY_CODE,
  ISO14224_TAXONOMY,
  PM_BASES,
  RCA_CAUSES,
  RCA_CAUSE_FA,
  WO_FLOW,
  WO_STAGES,
  buyVsRent,
  canAdvanceDispatch,
  canAdvanceWo,
  dispatchPrecheck,
  equipmentHealthScore,
  equipmentQrPayload,
  ewsEqp,
  fleetKpiBoard,
  fuelSummary,
  iso14224Code,
  maintenanceCostRatio,
  oee,
  partStockStatus,
  partsToRequisition,
  pmCompliance,
  pmDueByBasis,
  rcaPareto,
  reorderPoint,
  specificFuelConsumption,
  tco,
  validateDispatch,
  validateFuelLog,
  validatePmSchedule,
  validateSparePart,
  woStageToStatus,
} from "./eqmLogic.js";

const NOW = "2026-09-09";

const eq = (over = {}) => ({
  ProjectId: "p1", Code: "EQ-001", NameFa: "بیل مکانیکی شماره ۱", Category: "EXC",
  Ownership: "owned", Status: "active", CommissionedAt: "2024-01-01", ...over,
});

const order = (over = {}) => ({
  ProjectId: "p1", EquipmentId: "e1", Code: "WO-001", Kind: "corrective",
  Priority: "high", ReportedAt: "2026-09-01", Status: "open", ...over,
});

const part = (over = {}) => ({
  ProjectId: "p1", PartNo: "SP-100", NameFa: "فیلتر روغن", OnHand: 20, MinLevel: 5, ...over,
});

const dispatchCtx = (over = {}) => ({
  nowIso: NOW,
  equipment: eq(),
  openCriticalOrders: 0,
  pmOverdueDays: 0,
  operatorAssigned: true,
  safetyCheckDone: true,
  ...over,
});

/* ─────────── ۱. هویت و کاتالوگ‌های مرجع ─────────── */

test("نسخهٔ افزونهٔ EQP", () => {
  assert.equal(EQP_VERSION, "eqp-v1");
});

test("تاکسونومی ISO 14224 دو سطح دارد و کدها یکتا هستند", () => {
  const codes = new Set(ISO14224_TAXONOMY.map((n) => n.code));
  assert.equal(codes.size, ISO14224_TAXONOMY.length);
  assert.ok(ISO14224_TAXONOMY.some((n) => n.level === 4));
  assert.ok(ISO14224_TAXONOMY.some((n) => n.level === 5));
});

test("هر گرهٔ سطح ۵ والد معتبر دارد", () => {
  for (const n of ISO14224_TAXONOMY.filter((x) => x.level === 5)) {
    assert.ok(ISO14224_BY_CODE[n.parent], n.code);
  }
});

test("همهٔ طبقات داخلی به کد ISO 14224 نگاشت شده‌اند", () => {
  for (const [cls, code] of Object.entries(CLASS_TO_ISO14224)) {
    assert.ok(ISO14224_BY_CODE[code], `${cls} → ${code}`);
  }
});

test("iso14224Code برای دستهٔ خاکبرداری ME.EA می‌دهد", () => {
  assert.equal(iso14224Code("EXC"), "ME.EA");
  assert.equal(iso14224Code("CRN-TOW"), "ME.LI");
  assert.equal(iso14224Code("GEN"), "SE.PW");
});

test("iso14224Code برای دستهٔ ناشناخته به SE.OT برمی‌گردد", () => {
  assert.equal(iso14224Code("ZZZ"), "SE.OT");
});

test("payload شناسنامهٔ QR قطعی و شامل کد ماشین است", () => {
  const p = equipmentQrPayload(eq());
  assert.equal(p, "EQP:p1:EQ-001:ME.EA");
  assert.equal(p, equipmentQrPayload(eq()));
});

test("کاتالوگ هشت شاخص کامل است", () => {
  assert.equal(EQP_KPI_CATALOG.length, 8);
  assert.ok(EQP_KPI_BY_CODE["K-EQP-OEE"]);
  assert.ok(EQP_KPI_BY_CODE["K-EQP-SFC"]);
});

test("جهت هر شاخص یکی از higher/lower است", () => {
  for (const k of EQP_KPI_CATALOG) {
    assert.ok(k.direction === "higher" || k.direction === "lower", k.code);
    assert.ok(k.target > 0, k.code);
  }
});

test("شش قاعدهٔ EWS-EQP با کد یکتا تعریف شده‌اند", () => {
  assert.equal(EWS_EQP_RULES.length, 6);
  const codes = new Set(EWS_EQP_RULES.map((r) => r.code));
  assert.equal(codes.size, 6);
  for (const r of EWS_EQP_RULES) assert.ok(r.escalateTo.length > 0, r.code);
});

/* ─────────── ۲. TCO و خرید در برابر اجاره ─────────── */

test("tco: هزینهٔ کل شامل استهلاک و هزینه‌های سالانه است", () => {
  const t = tco({ purchaseValue: 1000, salvageValue: 100, lifeYears: 10, annualMaintenanceCost: 50, annualWorkHours: 1000 });
  assert.equal(t.depreciationTotal, 900);
  assert.equal(t.totalCost, 900 + 500);
  assert.equal(t.annualCost, 140);
  assert.equal(t.lifetimeHours, 10000);
  assert.equal(t.costPerHour, 0.14);
});

test("tco: هزینه‌های بسیج و برچیدن یک‌بار افزوده می‌شوند", () => {
  const base = tco({ purchaseValue: 1000, lifeYears: 5, annualWorkHours: 100 });
  const withMob = tco({ purchaseValue: 1000, lifeYears: 5, annualWorkHours: 100, mobilizationCost: 200, demobilizationCost: 100 });
  assert.equal(withMob.totalCost - base.totalCost, 300);
});

test("tco: ارزش اسقاط بیشتر از ارزش خرید محدود می‌شود", () => {
  const t = tco({ purchaseValue: 500, salvageValue: 900, lifeYears: 5, annualWorkHours: 100 });
  assert.equal(t.depreciationTotal, 0);
});

test("tco: عمر صفر به یک سال محدود می‌شود", () => {
  const t = tco({ purchaseValue: 1000, lifeYears: 0, annualWorkHours: 100 });
  assert.equal(t.annualCost, t.totalCost);
});

test("buyVsRent: نرخ اجارهٔ گران‌تر رأی به خرید می‌دهد", () => {
  const r = buyVsRent({ purchaseValue: 1000, lifeYears: 10, annualWorkHours: 1000 }, 5);
  assert.equal(r.verdict, "buy");
  assert.ok(r.savingPerHour > 0);
});

test("buyVsRent: نرخ اجارهٔ ارزان رأی به اجاره می‌دهد", () => {
  const r = buyVsRent({ purchaseValue: 100000, lifeYears: 5, annualWorkHours: 100 }, 1);
  assert.equal(r.verdict, "rent");
});

test("buyVsRent: اختلاف کمتر از ۵٪ خنثی است", () => {
  const own = { purchaseValue: 1000, lifeYears: 10, annualWorkHours: 1000 };
  const rate = tco(own).costPerHour;
  assert.equal(buyVsRent(own, rate).verdict, "neutral");
});

test("buyVsRent: نقطهٔ سربه‌سر = TCO تقسیم بر حاشیهٔ نرخ", () => {
  const r = buyVsRent({ purchaseValue: 1000, lifeYears: 10, annualWorkHours: 1000 }, 2, 0.5);
  assert.equal(r.breakEvenHours, 1000 / 1.5 === Infinity ? Infinity : Math.round((1000 / 1.5) * 100) / 100);
  assert.ok(r.breakEvenHours > 0 && Number.isFinite(r.breakEvenHours));
});

test("buyVsRent: نرخ اجاره کمتر از هزینهٔ متغیر مالکیت سربه‌سر ندارد", () => {
  const r = buyVsRent({ purchaseValue: 1000, lifeYears: 10, annualWorkHours: 1000 }, 0.3, 0.5);
  assert.equal(r.breakEvenHours, Infinity);
});

test("buyVsRent: نرخ اجارهٔ صفر سربه‌سر بی‌نهایت می‌دهد", () => {
  const r = buyVsRent({ purchaseValue: 1000, lifeYears: 10, annualWorkHours: 1000 }, 0);
  assert.equal(r.breakEvenHours, Infinity);
});

/* ─────────── ۳. اعتبارسنجی دیسپچ ─────────── */

test("validateDispatch: ردیف کامل معتبر است", () => {
  const v = validateDispatch({ ProjectId: "p1", EquipmentId: "e1", DispatchDate: NOW, Shift: "day", Status: "draft", PlannedHours: 8 });
  assert.ok(v.ok, JSON.stringify(v.issues));
});

test("validateDispatch: فیلدهای الزامی", () => {
  const v = validateDispatch({});
  assert.equal(v.ok, false);
  assert.ok(v.issues.every((i) => i.code === "E-EQM-REQUIRED"));
  assert.equal(v.issues.length, 5);
});

test("validateDispatch: شیفت نامعتبر", () => {
  const v = validateDispatch({ ProjectId: "p1", EquipmentId: "e1", DispatchDate: NOW, Shift: "evening", Status: "draft" });
  assert.ok(v.issues.some((i) => i.code === "E-EQP-SHIFT"));
});

test("validateDispatch: وضعیت نامعتبر", () => {
  const v = validateDispatch({ ProjectId: "p1", EquipmentId: "e1", DispatchDate: NOW, Shift: "day", Status: "flying" });
  assert.ok(v.issues.some((i) => i.code === "E-EQP-DSTATUS"));
});

test("validateDispatch: ساعت بیش از ۲۴ رد می‌شود", () => {
  const v = validateDispatch({ ProjectId: "p1", EquipmentId: "e1", DispatchDate: NOW, Shift: "full", Status: "draft", PlannedHours: 30 });
  assert.ok(v.issues.some((i) => i.code === "E-EQP-HOURS"));
});

test("validateDispatch: حجم منفی رد می‌شود", () => {
  const v = validateDispatch({ ProjectId: "p1", EquipmentId: "e1", DispatchDate: NOW, Shift: "day", Status: "draft", PlannedQty: -5 });
  assert.ok(v.issues.some((i) => i.code === "E-EQP-QTY"));
});

/* ─────────── ۴. دروازه‌های پیش‌نیاز دیسپچ ─────────── */

test("dispatchPrecheck: ماشین سالم اجازهٔ دیسپچ می‌گیرد", () => {
  const r = dispatchPrecheck(dispatchCtx());
  assert.equal(r.allowed, true);
  assert.equal(r.blockers, 0);
});

test("dispatchPrecheck: ماشین در تعمیر مسدود می‌شود", () => {
  const r = dispatchPrecheck(dispatchCtx({ equipment: eq({ Status: "repair" }) }));
  assert.equal(r.allowed, false);
  assert.ok(r.gates.some((g) => g.code === "G-EQP-STATUS" && !g.passed));
});

test("dispatchPrecheck: دستورکار بحرانی باز مسدود می‌کند", () => {
  const r = dispatchPrecheck(dispatchCtx({ openCriticalOrders: 2 }));
  assert.equal(r.allowed, false);
  assert.ok(r.gates.some((g) => g.code === "G-EQP-NOCRIT" && !g.passed));
});

test("dispatchPrecheck: PM معوق تا ۷ روز هشدار است نه مسدودکننده", () => {
  const r = dispatchPrecheck(dispatchCtx({ pmOverdueDays: 5 }));
  assert.equal(r.allowed, true);
  const gate = r.gates.find((g) => g.code === "G-EQP-PM");
  assert.equal(gate.passed, false);
  assert.equal(gate.blocking, false);
});

test("dispatchPrecheck: PM معوق بیش از ۷ روز مسدود می‌کند", () => {
  const r = dispatchPrecheck(dispatchCtx({ pmOverdueDays: 20 }));
  assert.equal(r.allowed, false);
});

test("dispatchPrecheck: نبود اپراتور مسدود می‌کند", () => {
  const r = dispatchPrecheck(dispatchCtx({ operatorAssigned: false }));
  assert.equal(r.allowed, false);
  assert.ok(r.gates.some((g) => g.code === "G-EQP-OPERATOR" && !g.passed));
});

test("dispatchPrecheck: گواهی‌نامهٔ منقضی مسدود می‌کند", () => {
  const r = dispatchPrecheck(dispatchCtx({ operatorLicenseExpiry: "2026-01-01" }));
  assert.equal(r.allowed, false);
  assert.ok(r.gates.some((g) => g.code === "G-EQP-LICENSE" && !g.passed));
});

test("dispatchPrecheck: گواهی‌نامهٔ معتبر عبور می‌کند", () => {
  const r = dispatchPrecheck(dispatchCtx({ operatorLicenseExpiry: "2027-01-01" }));
  assert.equal(r.allowed, true);
  assert.ok(r.gates.some((g) => g.code === "G-EQP-LICENSE" && g.passed));
});

test("dispatchPrecheck: نبود چک‌لیست ایمنی مسدود می‌کند", () => {
  const r = dispatchPrecheck(dispatchCtx({ safetyCheckDone: false }));
  assert.equal(r.allowed, false);
  assert.ok(r.gates.some((g) => g.code === "G-EQP-SAFETY" && !g.passed));
});

test("dispatchPrecheck: دروازهٔ اجاره فقط برای ماشین غیرملکی افزوده می‌شود", () => {
  const owned = dispatchPrecheck(dispatchCtx());
  assert.equal(owned.gates.some((g) => g.code === "G-EQP-RENTAL"), false);
  const rented = dispatchPrecheck(dispatchCtx({ equipment: eq({ Ownership: "rented" }), rentalActive: false }));
  const gate = rented.gates.find((g) => g.code === "G-EQP-RENTAL");
  assert.equal(gate.passed, false);
  assert.equal(gate.blocking, false);
  assert.equal(rented.allowed, true);
});

test("dispatchPrecheck: چند مسدودکنندهٔ هم‌زمان شمرده می‌شوند", () => {
  const r = dispatchPrecheck(dispatchCtx({ equipment: eq({ Status: "idle" }), operatorAssigned: false, safetyCheckDone: false }));
  assert.equal(r.blockers, 3);
});

/* ─────────── ۵. گردش‌کار دیسپچ ─────────── */

test("گذارهای مجاز دیسپچ", () => {
  assert.ok(canAdvanceDispatch("draft", "submitted"));
  assert.ok(canAdvanceDispatch("submitted", "approved"));
  assert.ok(canAdvanceDispatch("approved", "executed"));
});

test("گذارهای غیرمجاز دیسپچ", () => {
  assert.equal(canAdvanceDispatch("draft", "approved"), false);
  assert.equal(canAdvanceDispatch("executed", "draft"), false);
  assert.equal(canAdvanceDispatch("cancelled", "submitted"), false);
});

test("رد شده می‌تواند به پیش‌نویس برگردد", () => {
  assert.ok(canAdvanceDispatch("rejected", "draft"));
});

test("هر وضعیت دیسپچ در نقشهٔ گردش‌کار تعریف شده", () => {
  for (const s of DISPATCH_STATUSES) assert.ok(Array.isArray(DISPATCH_FLOW[s]), s);
});

test("وضعیت‌های پایانی دیسپچ خروجی ندارند", () => {
  assert.deepEqual(DISPATCH_FLOW.executed, []);
  assert.deepEqual(DISPATCH_FLOW.cancelled, []);
});

/* ─────────── ۶. سوخت و مصرفی‌ها ─────────── */

test("validateFuelLog: ردیف معتبر", () => {
  const v = validateFuelLog({ ProjectId: "p1", EquipmentId: "e1", LogDate: NOW, Kind: "diesel", Quantity: 120 });
  assert.ok(v.ok, JSON.stringify(v.issues));
});

test("validateFuelLog: نوع مصرفی نامعتبر", () => {
  const v = validateFuelLog({ ProjectId: "p1", EquipmentId: "e1", LogDate: NOW, Kind: "coal", Quantity: 10 });
  assert.ok(v.issues.some((i) => i.code === "E-EQP-FUEL-KIND"));
});

test("validateFuelLog: مقدار صفر رد می‌شود", () => {
  const v = validateFuelLog({ ProjectId: "p1", EquipmentId: "e1", LogDate: NOW, Kind: "oil", Quantity: 0 });
  assert.ok(v.issues.some((i) => i.code === "E-EQP-FUEL-QTY"));
});

test("validateFuelLog: بهای واحد منفی رد می‌شود", () => {
  const v = validateFuelLog({ ProjectId: "p1", EquipmentId: "e1", LogDate: NOW, Kind: "diesel", Quantity: 10, UnitCost: -5 });
  assert.ok(v.issues.some((i) => i.code === "E-EQP-FUEL-COST"));
});

test("همهٔ انواع مصرفی در فهرست اعتبارسنجی پذیرفته می‌شوند", () => {
  for (const kind of FUEL_KINDS) {
    const v = validateFuelLog({ ProjectId: "p1", EquipmentId: "e1", LogDate: NOW, Kind: kind, Quantity: 1 });
    assert.ok(v.ok, kind);
  }
});

test("fuelSummary: تفکیک بر حسب نوع و جمع هزینه", () => {
  const s = fuelSummary([
    { ProjectId: "p1", EquipmentId: "e1", LogDate: NOW, Kind: "diesel", Quantity: 100, UnitCost: 10 },
    { ProjectId: "p1", EquipmentId: "e1", LogDate: NOW, Kind: "diesel", Quantity: 50, UnitCost: 10 },
    { ProjectId: "p1", EquipmentId: "e1", LogDate: NOW, Kind: "oil", Quantity: 5, UnitCost: 100 },
  ]);
  assert.equal(s.quantity, 150);
  assert.equal(s.cost, 2000);
  assert.equal(s.byKind.diesel.quantity, 150);
  assert.equal(s.byKind.oil.cost, 500);
});

test("fuelSummary: روغن و لاستیک در مقدار سوخت شمرده نمی‌شوند", () => {
  const s = fuelSummary([{ ProjectId: "p1", EquipmentId: "e1", LogDate: NOW, Kind: "tire", Quantity: 4, UnitCost: 1000 }]);
  assert.equal(s.quantity, 0);
  assert.equal(s.cost, 4000);
});

test("fuelSummary: فهرست خالی صفر می‌دهد", () => {
  const s = fuelSummary([]);
  assert.equal(s.quantity, 0);
  assert.equal(s.cost, 0);
});

test("specificFuelConsumption: لیتر بر ساعت", () => {
  const r = specificFuelConsumption(180, 10);
  assert.equal(r.sfc, 18);
  assert.equal(r.verdict, "unknown");
});

test("specificFuelConsumption: بیش از ۱۱۵٪ معیار پرمصرف است", () => {
  assert.equal(specificFuelConsumption(250, 10, 18).verdict, "excessive");
});

test("specificFuelConsumption: کمتر از ۸۵٪ معیار کم‌مصرف است", () => {
  assert.equal(specificFuelConsumption(140, 10, 18).verdict, "efficient");
});

test("specificFuelConsumption: نزدیک معیار نرمال است", () => {
  assert.equal(specificFuelConsumption(185, 10, 18).verdict, "normal");
});

test("specificFuelConsumption: ساعت صفر ناشناخته می‌دهد", () => {
  const r = specificFuelConsumption(100, 0, 18);
  assert.equal(r.sfc, 0);
  assert.equal(r.verdict, "unknown");
});

/* ─────────── ۷. برنامهٔ نگهداری پیشگیرانه ─────────── */

test("validatePmSchedule: ردیف معتبر", () => {
  const v = validatePmSchedule({ ProjectId: "p1", EquipmentId: "e1", Code: "PM-01", TitleFa: "تعویض روغن", Basis: "run_hours", IntervalValue: 250 });
  assert.ok(v.ok, JSON.stringify(v.issues));
});

test("validatePmSchedule: پایهٔ نامعتبر", () => {
  const v = validatePmSchedule({ ProjectId: "p1", EquipmentId: "e1", Code: "PM-01", TitleFa: "x", Basis: "phases", IntervalValue: 10 });
  assert.ok(v.issues.some((i) => i.code === "E-EQP-PM-BASIS"));
});

test("validatePmSchedule: بازهٔ صفر رد می‌شود", () => {
  const v = validatePmSchedule({ ProjectId: "p1", EquipmentId: "e1", Code: "PM-01", TitleFa: "x", Basis: "cycles", IntervalValue: 0 });
  assert.ok(v.issues.some((i) => i.code === "E-EQP-PM-INTERVAL"));
});

test("هر چهار پایهٔ PM پذیرفته می‌شوند", () => {
  for (const basis of PM_BASES) {
    const v = validatePmSchedule({ ProjectId: "p1", EquipmentId: "e1", Code: "PM", TitleFa: "x", Basis: basis, IntervalValue: 10 });
    assert.ok(v.ok, basis);
  }
});

test("pmDueByBasis: پایهٔ ساعت کارکرد مانده را می‌دهد", () => {
  const due = pmDueByBasis({ Basis: "run_hours", IntervalValue: 250, LastDoneReading: 1000 }, NOW, 1180);
  assert.equal(due.remaining, 70);
  assert.equal(due.overdue, false);
  assert.equal(due.progressPct, 72);
});

test("pmDueByBasis: ساعت کارکرد گذشته از بازه معوق است", () => {
  const due = pmDueByBasis({ Basis: "run_hours", IntervalValue: 250, LastDoneReading: 1000 }, NOW, 1300);
  assert.equal(due.overdue, true);
  assert.equal(due.severity, "overdue");
  assert.equal(due.remaining, -50);
});

test("pmDueByBasis: با مصرف روزانه تاریخ سررسید تخمین زده می‌شود", () => {
  const due = pmDueByBasis({ Basis: "run_hours", IntervalValue: 250, LastDoneReading: 1000 }, NOW, 1150, 10);
  assert.equal(due.remaining, 100);
  assert.equal(due.dueIso, "2026-09-19");
});

test("pmDueByBasis: پایهٔ تقویمی مانده بر حسب روز می‌دهد", () => {
  const due = pmDueByBasis({ Basis: "calendar_days", IntervalValue: 30, LastDoneAt: "2026-08-25" }, NOW);
  assert.equal(due.remaining, 15);
  assert.equal(due.dueIso, "2026-09-24");
  assert.equal(due.severity, "ok");
});

test("pmDueByBasis: پایهٔ تقویمی معوق", () => {
  const due = pmDueByBasis({ Basis: "calendar_days", IntervalValue: 30, LastDoneAt: "2026-07-01" }, NOW);
  assert.equal(due.overdue, true);
  assert.equal(due.severity, "overdue");
});

test("pmDueByBasis: هفت روز مانده «به‌زودی» است", () => {
  const due = pmDueByBasis({ Basis: "calendar_days", IntervalValue: 30, LastDoneAt: "2026-08-15" }, NOW);
  assert.equal(due.severity, "soon");
});

test("pmDueByBasis: پایهٔ کیلومتر و سیکل مانند شمارنده رفتار می‌کنند", () => {
  const km = pmDueByBasis({ Basis: "kilometers", IntervalValue: 10000, LastDoneReading: 50000 }, NOW, 55000);
  assert.equal(km.remaining, 5000);
  const cy = pmDueByBasis({ Basis: "cycles", IntervalValue: 500, LastDoneReading: 100 }, NOW, 400);
  assert.equal(cy.remaining, 200);
});

test("pmDueByBasis: بازهٔ صفر خنثی برمی‌گردد", () => {
  const due = pmDueByBasis({ Basis: "run_hours", IntervalValue: 0 }, NOW, 100);
  assert.equal(due.severity, "ok");
  assert.equal(due.remaining, 0);
});

test("pmDueByBasis: پیشرفت ۹۰٪ به بالا «به‌زودی» است", () => {
  const due = pmDueByBasis({ Basis: "run_hours", IntervalValue: 100, LastDoneReading: 0 }, NOW, 95);
  assert.equal(due.progressPct, 95);
  assert.equal(due.severity, "soon");
});

test("pmCompliance: نسبت انجام به برنامه", () => {
  const orders = [order({ Kind: "preventive", Status: "done" }), order({ Kind: "inspection", Status: "closed" }), order({ Kind: "corrective", Status: "done" })];
  const r = pmCompliance(orders, 4);
  assert.equal(r.done, 2);
  assert.equal(r.rate, 50);
  assert.equal(r.verdict, "poor");
});

test("pmCompliance: بدون برنامه انطباق کامل فرض می‌شود", () => {
  assert.equal(pmCompliance([], 0).rate, 100);
});

test("pmCompliance: بالای ۹۰ درصد خوب است", () => {
  const orders = Array.from({ length: 9 }, (_, i) => order({ Code: `PM-${i}`, Kind: "preventive", Status: "done" }));
  assert.equal(pmCompliance(orders, 10).verdict, "good");
});

test("pmCompliance: بین ۷۰ و ۹۰ متوسط است", () => {
  const orders = Array.from({ length: 8 }, (_, i) => order({ Code: `PM-${i}`, Kind: "preventive", Status: "done" }));
  assert.equal(pmCompliance(orders, 10).verdict, "fair");
});

/* ─────────── ۸. گردش‌کار CMMS و تحلیل ریشه‌ای ─────────── */

test("گردش‌کار WO هفت مرحله دارد", () => {
  assert.equal(WO_STAGES.length, 7);
  for (const s of WO_STAGES) assert.ok(Array.isArray(WO_FLOW[s]), s);
});

test("گذارهای مجاز دستور کار", () => {
  assert.ok(canAdvanceWo("requested", "approved"));
  assert.ok(canAdvanceWo("in_progress", "awaiting_parts"));
  assert.ok(canAdvanceWo("awaiting_parts", "in_progress"));
  assert.ok(canAdvanceWo("completed", "verified"));
});

test("گذارهای غیرمجاز دستور کار", () => {
  assert.equal(canAdvanceWo("requested", "completed"), false);
  assert.equal(canAdvanceWo("verified", "in_progress"), false);
});

test("کار تأییدشده می‌تواند برای اصلاح به اجرا برگردد", () => {
  assert.ok(canAdvanceWo("completed", "in_progress"));
});

test("woStageToStatus: نگاشت مرحله به وضعیت پایه", () => {
  assert.equal(woStageToStatus("requested"), "open");
  assert.equal(woStageToStatus("approved"), "open");
  assert.equal(woStageToStatus("in_progress"), "in_progress");
  assert.equal(woStageToStatus("awaiting_parts"), "in_progress");
  assert.equal(woStageToStatus("completed"), "done");
  assert.equal(woStageToStatus("verified"), "closed");
  assert.equal(woStageToStatus("cancelled"), "closed");
});

test("طبقه‌بندی علل ISO 14224 هشت مورد با ترجمهٔ فارسی است", () => {
  assert.equal(RCA_CAUSES.length, 8);
  for (const c of RCA_CAUSES) assert.ok(RCA_CAUSE_FA[c], c);
});

test("rcaPareto: توزیع و درصد تجمعی", () => {
  const orders = [
    order({ Code: "W1", RootCause: "hydraulic" }),
    order({ Code: "W2", RootCause: "hydraulic" }),
    order({ Code: "W3", RootCause: "electrical" }),
    order({ Code: "W4", Kind: "preventive", RootCause: "mechanical" }),
  ];
  const p = rcaPareto(orders);
  assert.equal(p[0].cause, "hydraulic");
  assert.equal(p[0].count, 2);
  assert.ok(Math.abs(p[p.length - 1].cumulativePct - 100) < 0.02);
});

test("rcaPareto: علت نامعتبر به «عوامل بیرونی» می‌رود", () => {
  const p = rcaPareto([order({ RootCause: "aliens" })]);
  assert.equal(p[0].cause, "external");
});

test("rcaPareto: بدون خرابی فهرست خالی است", () => {
  assert.deepEqual(rcaPareto([order({ Kind: "preventive" })]), []);
});

/* ─────────── ۹. انبار قطعات یدکی ─────────── */

test("validateSparePart: ردیف معتبر", () => {
  assert.ok(validateSparePart(part()).ok);
});

test("validateSparePart: موجودی منفی رد می‌شود", () => {
  const v = validateSparePart(part({ OnHand: -1 }));
  assert.ok(v.issues.some((i) => i.code === "E-EQP-PART-STOCK"));
});

test("validateSparePart: زمان تأمین منفی رد می‌شود", () => {
  const v = validateSparePart(part({ LeadTimeDays: -3 }));
  assert.ok(v.issues.some((i) => i.code === "E-EQP-PART-LEAD"));
});

test("reorderPoint: مصرف × زمان تأمین + ذخیرهٔ اطمینان", () => {
  assert.equal(reorderPoint(2, 10, 5), 25);
  assert.equal(reorderPoint(0, 10, 5), 5);
});

test("partStockStatus: موجودی کافی وضعیت ok دارد", () => {
  const s = partStockStatus(part({ OnHand: 100, MinLevel: 5, AvgDailyUsage: 1, LeadTimeDays: 10 }));
  assert.equal(s.status, "ok");
  assert.equal(s.rop, 15);
  assert.equal(s.suggestedQty, 0);
});

test("partStockStatus: زیر نقطهٔ سفارش وضعیت reorder دارد", () => {
  const s = partStockStatus(part({ OnHand: 12, MinLevel: 5, AvgDailyUsage: 1, LeadTimeDays: 10 }));
  assert.equal(s.status, "reorder");
  assert.ok(s.suggestedQty > 0);
});

test("partStockStatus: زیر حداقل موجودی وضعیت shortage دارد", () => {
  const s = partStockStatus(part({ OnHand: 3, MinLevel: 5, AvgDailyUsage: 1, LeadTimeDays: 10 }));
  assert.equal(s.status, "shortage");
});

test("partStockStatus: موجودی صفر وضعیت out دارد", () => {
  assert.equal(partStockStatus(part({ OnHand: 0 })).status, "out");
});

test("partStockStatus: بدون مصرف روزانه پوشش بی‌نهایت تلقی می‌شود", () => {
  assert.equal(partStockStatus(part({ OnHand: 10, AvgDailyUsage: 0 })).daysOfCover, 9999);
});

test("partStockStatus: روزهای پوشش از موجودی و مصرف", () => {
  assert.equal(partStockStatus(part({ OnHand: 20, AvgDailyUsage: 2 })).daysOfCover, 10);
});

test("partsToRequisition: فقط قطعات نیازمند سفارش برگردانده می‌شوند", () => {
  const rows = partsToRequisition([
    part({ PartNo: "A", OnHand: 100, MinLevel: 5 }),
    part({ PartNo: "B", OnHand: 0, MinLevel: 5 }),
    part({ PartNo: "C", OnHand: 2, MinLevel: 5 }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.some((x) => x.part.PartNo === "A"), false);
});

test("partsToRequisition: قطعات بحرانی در صدر فهرست‌اند", () => {
  const rows = partsToRequisition([
    part({ PartNo: "A", OnHand: 2, MinLevel: 5 }),
    part({ PartNo: "B", OnHand: 2, MinLevel: 5, Critical: true }),
  ]);
  assert.equal(rows[0].part.PartNo, "B");
});

test("partsToRequisition: ناموجود پیش از کمبود می‌آید", () => {
  const rows = partsToRequisition([
    part({ PartNo: "A", OnHand: 2, MinLevel: 5 }),
    part({ PartNo: "B", OnHand: 0, MinLevel: 5 }),
  ]);
  assert.equal(rows[0].part.PartNo, "B");
});

/* ─────────── ۱۰. OEE و شاخص‌های ترکیبی ─────────── */

test("oee: حالت ایده‌آل نزدیک ۱۰۰ است", () => {
  const r = oee({ downtimeHours: 0, periodHours: 100, workHours: 10, actualOutput: 100, ratedOutputPerHour: 10 });
  assert.equal(r.availability, 100);
  assert.equal(r.performance, 100);
  assert.equal(r.quality, 100);
  assert.equal(r.oee, 100);
  assert.equal(r.verdict, "world_class");
});

test("oee: ضرب سه مؤلفه", () => {
  const r = oee({ downtimeHours: 10, periodHours: 100, workHours: 10, actualOutput: 80, ratedOutputPerHour: 10, goodOutput: 72 });
  assert.equal(r.availability, 90);
  assert.equal(r.performance, 80);
  assert.equal(r.quality, 90);
  assert.equal(r.oee, 64.8);
  assert.equal(r.verdict, "good");
});

test("oee: بدون تولید کیفیت ۱۰۰ فرض می‌شود", () => {
  const r = oee({ downtimeHours: 0, periodHours: 100, workHours: 10, actualOutput: 0, ratedOutputPerHour: 10 });
  assert.equal(r.quality, 100);
  assert.equal(r.performance, 0);
  assert.equal(r.oee, 0);
  assert.equal(r.verdict, "poor");
});

test("oee: عملکرد بالای ۱۰۰ محدود می‌شود", () => {
  const r = oee({ downtimeHours: 0, periodHours: 100, workHours: 10, actualOutput: 500, ratedOutputPerHour: 10 });
  assert.equal(r.performance, 100);
});

test("oee: بازهٔ متوسط رأی fair می‌گیرد", () => {
  const r = oee({ downtimeHours: 20, periodHours: 100, workHours: 10, actualOutput: 60, ratedOutputPerHour: 10 });
  assert.equal(r.verdict, "fair");
});

test("maintenanceCostRatio: نسبت درصدی و رأی", () => {
  assert.equal(maintenanceCostRatio(500, 10000).ratio, 5);
  assert.equal(maintenanceCostRatio(500, 10000).verdict, "healthy");
  assert.equal(maintenanceCostRatio(1000, 10000).verdict, "watch");
  assert.equal(maintenanceCostRatio(2000, 10000).verdict, "critical");
});

test("maintenanceCostRatio: ارزش دارایی صفر", () => {
  assert.equal(maintenanceCostRatio(500, 0).ratio, 0);
});

test("equipmentHealthScore: ماشین سالم نمرهٔ A می‌گیرد", () => {
  const h = equipmentHealthScore({ availabilityPct: 98, utilizationPct: 80, pmCompliancePct: 95, criticalBacklog: 0, agingRatio: 0.2 });
  assert.ok(h.score >= 85);
  assert.equal(h.grade, "A");
});

test("equipmentHealthScore: بک‌لاگ بحرانی نمره را کم می‌کند", () => {
  const good = equipmentHealthScore({ availabilityPct: 98, utilizationPct: 80, pmCompliancePct: 95, criticalBacklog: 0, agingRatio: 0.2 });
  const bad = equipmentHealthScore({ availabilityPct: 98, utilizationPct: 80, pmCompliancePct: 95, criticalBacklog: 2, agingRatio: 0.2 });
  assert.equal(good.score - bad.score, 20);
});

test("equipmentHealthScore: نمره بین ۰ و ۱۰۰ محدود می‌ماند", () => {
  const h = equipmentHealthScore({ availabilityPct: 0, utilizationPct: 0, pmCompliancePct: 0, criticalBacklog: 10, agingRatio: 2 });
  assert.equal(h.score, 0);
  assert.equal(h.grade, "D");
});

test("equipmentHealthScore: ماشین متوسط نمرهٔ C می‌گیرد", () => {
  const h = equipmentHealthScore({ availabilityPct: 90, utilizationPct: 50, pmCompliancePct: 70, criticalBacklog: 0, agingRatio: 0.5 });
  assert.ok(h.score >= 50 && h.score < 70, String(h.score));
  assert.equal(h.grade, "C");
});

/* ─────────── ۱۱. قواعد شش‌گانهٔ EWS-EQP ─────────── */

test("ewsEqp: ناوگان سالم هشدار ندارد", () => {
  const w = ewsEqp({ availabilityPct: 98, utilizationPct: 70, utilLowPct: 40, pmOverdueDays: 0, criticalBacklog: 0 });
  assert.equal(w.length, 0);
});

test("ewsEqp: دسترس‌پذیری پایین قاعدهٔ ۰۱ را می‌زند", () => {
  const w = ewsEqp({ availabilityPct: 80, utilizationPct: 70, utilLowPct: 40, pmOverdueDays: 0, criticalBacklog: 0 });
  assert.equal(w[0].code, "EWS-EQP-01");
  assert.equal(w[0].severity, "critical");
  assert.equal(w[0].escalateTo, "مدیر پروژه");
});

test("ewsEqp: بهره‌برداری زیر آستانه قاعدهٔ ۰۲", () => {
  const w = ewsEqp({ availabilityPct: 98, utilizationPct: 20, utilLowPct: 40, pmOverdueDays: 0, criticalBacklog: 0 });
  assert.equal(w[0].code, "EWS-EQP-02");
});

test("ewsEqp: PM معوق قاعدهٔ ۰۳", () => {
  const w = ewsEqp({ availabilityPct: 98, utilizationPct: 70, utilLowPct: 40, pmOverdueDays: 12, criticalBacklog: 0 });
  assert.ok(w.some((x) => x.code === "EWS-EQP-03" && x.message.includes("12")));
});

test("ewsEqp: بک‌لاگ بحرانی قاعدهٔ ۰۴", () => {
  const w = ewsEqp({ availabilityPct: 98, utilizationPct: 70, utilLowPct: 40, pmOverdueDays: 0, criticalBacklog: 3 });
  assert.ok(w.some((x) => x.code === "EWS-EQP-04"));
});

test("ewsEqp: مصرف سوخت بالا قاعدهٔ ۰۵", () => {
  const w = ewsEqp({ availabilityPct: 98, utilizationPct: 70, utilLowPct: 40, pmOverdueDays: 0, criticalBacklog: 0, sfc: 25, sfcBenchmark: 18 });
  assert.ok(w.some((x) => x.code === "EWS-EQP-05"));
});

test("ewsEqp: مصرف سوخت نرمال هشدار ندارد", () => {
  const w = ewsEqp({ availabilityPct: 98, utilizationPct: 70, utilLowPct: 40, pmOverdueDays: 0, criticalBacklog: 0, sfc: 19, sfcBenchmark: 18 });
  assert.equal(w.length, 0);
});

test("ewsEqp: انقضای مدارک قاعدهٔ ۰۶", () => {
  const w = ewsEqp({ availabilityPct: 98, utilizationPct: 70, utilLowPct: 40, pmOverdueDays: 0, criticalBacklog: 0, daysToExpiry: 5 });
  assert.ok(w.some((x) => x.code === "EWS-EQP-06"));
});

test("ewsEqp: چند قاعده هم‌زمان فعال می‌شوند", () => {
  const w = ewsEqp({ availabilityPct: 70, utilizationPct: 10, utilLowPct: 40, pmOverdueDays: 3, criticalBacklog: 1, sfc: 30, sfcBenchmark: 18, daysToExpiry: 2 });
  assert.equal(w.length, 6);
});

test("ewsEqp: هر هشدار مرجع تشدید دارد", () => {
  const w = ewsEqp({ availabilityPct: 70, utilizationPct: 10, utilLowPct: 40, pmOverdueDays: 3, criticalBacklog: 1 });
  for (const x of w) assert.ok(x.escalateTo.length > 0, x.code);
});

/* ─────────── ۱۲. تابلوی شاخص ناوگان ─────────── */

test("fleetKpiBoard: هشت شاخص را برمی‌گرداند", () => {
  const board = fleetKpiBoard({
    equipment: [eq(), eq({ Code: "EQ-002", PurchaseValue: 1000 })],
    metrics: [{ workHours: 100, downtimeHrs: 10, periodDays: 30 }, { workHours: 80, downtimeHrs: 0, periodDays: 30 }],
    orders: [order({ Kind: "corrective", Status: "done", DownFrom: "2026-09-01T08:00:00Z", DownTo: "2026-09-01T16:00:00Z" })],
    plannedPmCount: 2,
    maintenanceCost: 50,
    assetValue: 1000,
    fuelLitres: 3600,
    periodDays: 30,
  });
  assert.ok(board.availability > 0);
  assert.ok(board.utilization > 0);
  assert.ok(board.mtbfHours !== null);
  assert.equal(board.mttrHours, 8);
  assert.equal(board.maintenanceCostRatio, 5);
  assert.equal(board.sfc, 20);
  assert.ok(["A", "B", "C", "D"].includes(board.grade));
});

test("fleetKpiBoard: بدون تولید واقعی OEE سنجش‌ناپذیر (null) است", () => {
  const board = fleetKpiBoard({
    equipment: [eq()],
    metrics: [{ workHours: 100, downtimeHrs: 0, periodDays: 30 }],
    orders: [],
    plannedPmCount: 0,
    maintenanceCost: 0,
    assetValue: 100,
    fuelLitres: 0,
    periodDays: 30,
  });
  assert.equal(board.oee, null);
});

test("fleetKpiBoard: با تولید واقعی OEE عدد می‌شود", () => {
  const board = fleetKpiBoard({
    equipment: [eq()],
    metrics: [{ workHours: 100, downtimeHrs: 0, periodDays: 30 }],
    orders: [],
    plannedPmCount: 0,
    maintenanceCost: 0,
    assetValue: 100,
    fuelLitres: 0,
    actualOutput: 500,
    ratedOutputPerHour: 10,
    periodDays: 30,
  });
  assert.ok(typeof board.oee === "number" && board.oee > 0);
});

test("fleetKpiBoard: ناوگان خالی امن است", () => {
  const board = fleetKpiBoard({ equipment: [], metrics: [], orders: [], plannedPmCount: 0, maintenanceCost: 0, assetValue: 0, fuelLitres: 0, periodDays: 30 });
  assert.equal(board.utilization, 0);
  assert.equal(board.mtbfHours, null);
  assert.equal(board.mttrHours, null);
  assert.equal(board.pmCompliance, 100);
});

test("fleetKpiBoard: انطباق PM از دستورکارها محاسبه می‌شود", () => {
  const board = fleetKpiBoard({
    equipment: [eq()],
    metrics: [{ workHours: 100, downtimeHrs: 0, periodDays: 30 }],
    orders: [order({ Kind: "preventive", Status: "done" })],
    plannedPmCount: 2,
    maintenanceCost: 0,
    assetValue: 100,
    fuelLitres: 0,
    periodDays: 30,
  });
  assert.equal(board.pmCompliance, 50);
});

test("fleetKpiBoard: توقف بالا دسترس‌پذیری را کم می‌کند", () => {
  const board = fleetKpiBoard({
    equipment: [eq()],
    metrics: [{ workHours: 10, downtimeHrs: 360, periodDays: 30 }],
    orders: [],
    plannedPmCount: 0,
    maintenanceCost: 0,
    assetValue: 100,
    fuelLitres: 0,
    periodDays: 30,
  });
  assert.equal(board.availability, 50);
});
