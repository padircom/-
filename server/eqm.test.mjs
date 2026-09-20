import test from "node:test";
import assert from "node:assert/strict";
import {
  EQUIPMENT_CATEGORY_CATALOG,
  CATEGORY_BY_CODE,
  EQM_DOMAIN_ID,
  EQM_VERSION,
  availability,
  daysBetween,
  downtimeHours,
  equipmentAge,
  equipmentCostPerHour,
  eqmEws,
  fleetSummary,
  hoursBetween,
  maintenanceBacklog,
  mtbf,
  mttr,
  nextPmDue,
  productivity,
  rentalCostAccrued,
  straightLineDepreciation,
  utilization,
  validateEquipment,
  validateMaintenanceOrder,
  validateMeter,
  validateRental,
  workHoursSum,
} from "./eqmLogic.js";

const eq = (over = {}) => ({
  ProjectId: "p1", Code: "EQ-001", NameFa: "بیل مکانیکی شماره ۱", Category: "EXC",
  Ownership: "owned", Status: "active", CommissionedAt: "2024-01-01", ...over,
});

const order = (over = {}) => ({
  ProjectId: "p1", EquipmentId: "e1", Code: "WO-001", Kind: "corrective",
  Priority: "high", ReportedAt: "2026-09-01", Status: "open", ...over,
});

/* ─────────── ۱. هویت و کاتالوگ ─────────── */

test("هویت موتور: نسخه و دامنه", () => {
  assert.equal(EQM_VERSION, "eqm-v1");
  assert.equal(EQM_DOMAIN_ID, "d9");
});

test("کاتالوگ ۱۸ دسته دارد و همه کدها یکتا هستند", () => {
  assert.equal(EQUIPMENT_CATEGORY_CATALOG.length, 18);
  const codes = new Set(EQUIPMENT_CATEGORY_CATALOG.map((c) => c.code));
  assert.equal(codes.size, EQUIPMENT_CATEGORY_CATALOG.length);
});

test("CATEGORY_BY_CODE برای همه کدها مقدار برمی‌گرداند", () => {
  for (const c of EQUIPMENT_CATEGORY_CATALOG) {
    assert.ok(CATEGORY_BY_CODE[c.code], c.code);
  }
});

test("دسته‌بندی اپراتورهای HRM با کاتالوگ تجهیزات هم‌پوشانی مفهومی دارد (جرثقیل/لودر/بیل)", () => {
  for (const code of ["EXC", "LDR", "CRN-TOW", "CRN-MOB", "FLT", "TRK", "CMP"]) {
    assert.ok(CATEGORY_BY_CODE[code], code);
  }
});

/* ─────────── ۲. اعتبارسنجی ماشین‌آلات ─────────── */

test("validateEquipment: ردیف سالم قبول می‌شود", () => {
  const r = validateEquipment(eq());
  assert.equal(r.ok, true);
  assert.equal(r.issues.length, 0);
});

test("validateEquipment: فیلدهای الزامی غایب رد می‌شوند", () => {
  const r = validateEquipment({});
  const cols = r.issues.map((i) => i.column);
  assert.ok(cols.includes("ProjectId"));
  assert.ok(cols.includes("Code"));
  assert.ok(cols.includes("NameFa"));
  assert.ok(cols.includes("Category"));
  assert.ok(cols.includes("Ownership"));
  assert.ok(cols.includes("Status"));
});

test("validateEquipment: دسته‌بندی ناشناخته → E-EQM-CATEGORY", () => {
  const r = validateEquipment(eq({ Category: "ROCKET" }));
  assert.equal(r.ok, false);
  assert.equal(r.issues[0].code, "E-EQM-CATEGORY");
});

test("validateEquipment: مالکیت نامعتبر → E-EQM-OWNERSHIP", () => {
  const r = validateEquipment(eq({ Ownership: "borrowed" }));
  assert.equal(r.issues[0].code, "E-EQM-OWNERSHIP");
});

test("validateEquipment: وضعیت نامعتبر → E-EQM-STATUS", () => {
  const r = validateEquipment(eq({ Status: "flying" }));
  assert.equal(r.issues[0].code, "E-EQM-STATUS");
});

test("validateEquipment: سال ساخت خارج از بازه → E-EQM-YEAR", () => {
  const r = validateEquipment(eq({ Year: 1880 }));
  assert.equal(r.issues[0].code, "E-EQM-YEAR");
});

test("validateEquipment: سال ساخت آیندهٔ دور → E-EQM-YEAR", () => {
  const r = validateEquipment(eq({ Year: 2100 }));
  assert.equal(r.issues[0].code, "E-EQM-YEAR");
});

test("validateEquipment: ظرفیت منفی → E-EQM-CAPACITY", () => {
  const r = validateEquipment(eq({ Capacity: -5 }));
  assert.equal(r.issues[0].code, "E-EQM-CAPACITY");
});

test("validateEquipment: ارزش خرید منفی → E-EQM-CAPACITY", () => {
  const r = validateEquipment(eq({ PurchaseValue: -1 }));
  assert.equal(r.issues[0].code, "E-EQM-CAPACITY");
});

/* ─────────── ۳. اعتبارسنجی قرائت ساعت‌شمار ─────────── */

test("validateMeter: قرائت سالم قبول می‌شود", () => {
  const r = validateMeter({ EquipmentId: "e1", ReadAt: "2026-09-01", HourMeter: 1200, Source: "manual" });
  assert.equal(r.ok, true);
});

test("validateMeter: ساعت‌شمار منفی → E-EQM-METER", () => {
  const r = validateMeter({ EquipmentId: "e1", ReadAt: "2026-09-01", HourMeter: -3 });
  assert.equal(r.issues[0].code, "E-EQM-METER");
});

test("validateMeter: عقب‌رفتن ساعت‌شمار نسبت به قرائت قبل → E-EQM-METER-ROLLBACK", () => {
  const r = validateMeter({ EquipmentId: "e1", ReadAt: "2026-09-01", HourMeter: 900 }, 1200);
  assert.equal(r.issues[0].code, "E-EQM-METER-ROLLBACK");
});

test("validateMeter: افزایش ساعت‌شمار نسبت به قبل مشکلی ندارد", () => {
  const r = validateMeter({ EquipmentId: "e1", ReadAt: "2026-09-01", HourMeter: 1300 }, 1200);
  assert.equal(r.ok, true);
});

test("validateMeter: منبع نامعتبر → E-EQM-SOURCE", () => {
  const r = validateMeter({ EquipmentId: "e1", ReadAt: "2026-09-01", HourMeter: 100, Source: "gps" });
  assert.equal(r.issues[0].code, "E-EQM-SOURCE");
});

test("validateMeter: منبع telemetry معتبر است", () => {
  const r = validateMeter({ EquipmentId: "e1", ReadAt: "2026-09-01", HourMeter: 100, Source: "telemetry" });
  assert.equal(r.ok, true);
});

/* ─────────── ۴. اعتبارسنجی اجاره ─────────── */

test("validateRental: قرارداد سالم قبول می‌شود", () => {
  const r = validateRental({ EquipmentId: "e1", RateType: "monthly", Rate: 50_000_000, StartDate: "2026-09-01", EndDate: "2026-12-01", Status: "active" });
  assert.equal(r.ok, true);
});

test("validateRental: نرخ صفر یا منفی → E-EQM-RATE", () => {
  const r = validateRental({ EquipmentId: "e1", RateType: "monthly", Rate: 0, StartDate: "2026-09-01", Status: "active" });
  assert.equal(r.issues[0].code, "E-EQM-RATE");
});

test("validateRental: نوع نرخ نامعتبر → E-EQM-RATE-TYPE", () => {
  const r = validateRental({ EquipmentId: "e1", RateType: "yearly", Rate: 10, StartDate: "2026-09-01", Status: "active" });
  assert.equal(r.issues[0].code, "E-EQM-RATE-TYPE");
});

test("validateRental: پایان زودتر از شروع → E-EQM-DATE-RANGE", () => {
  const r = validateRental({ EquipmentId: "e1", RateType: "daily", Rate: 10, StartDate: "2026-09-10", EndDate: "2026-09-01", Status: "active" });
  assert.equal(r.issues[0].code, "E-EQM-DATE-RANGE");
});

test("validateRental: تاریخ پایان اختیاری است (باز)", () => {
  const r = validateRental({ EquipmentId: "e1", RateType: "daily", Rate: 10, StartDate: "2026-09-01", Status: "active" });
  assert.equal(r.ok, true);
});

/* ─────────── ۵. اعتبارسنجی دستورکار تعمیر ─────────── */

test("validateMaintenanceOrder: دستورکار سالم قبول می‌شود", () => {
  const r = validateMaintenanceOrder(order());
  assert.equal(r.ok, true);
});

test("validateMaintenanceOrder: نوع تعمیر نامعتبر → E-EQM-KIND", () => {
  const r = validateMaintenanceOrder(order({ Kind: "painting" }));
  assert.equal(r.issues[0].code, "E-EQM-KIND");
});

test("validateMaintenanceOrder: اولویت نامعتبر → E-EQM-PRIORITY", () => {
  const r = validateMaintenanceOrder(order({ Priority: "urgentest" }));
  assert.equal(r.issues[0].code, "E-EQM-PRIORITY");
});

test("validateMaintenanceOrder: وضعیت نامعتبر → E-EQM-MSTATUS", () => {
  const r = validateMaintenanceOrder(order({ Status: "on_hold" }));
  assert.equal(r.issues[0].code, "E-EQM-MSTATUS");
});

test("validateMaintenanceOrder: راه‌اندازی زودتر از توقف → E-EQM-DATE-RANGE", () => {
  const r = validateMaintenanceOrder(order({ DownFrom: "2026-09-10T08:00", DownTo: "2026-09-09T08:00" }));
  assert.equal(r.issues[0].code, "E-EQM-DATE-RANGE");
});

test("validateMaintenanceOrder: همه انواع تعمیر معتبرند", () => {
  for (const kind of ["corrective", "preventive", "inspection", "overhaul"]) {
    assert.equal(validateMaintenanceOrder(order({ Kind: kind })).ok, true, kind);
  }
});

test("validateMaintenanceOrder: همه وضعیت‌ها معتبرند", () => {
  for (const st of ["open", "in_progress", "done", "closed"]) {
    assert.equal(validateMaintenanceOrder(order({ Status: st })).ok, true, st);
  }
});

/* ─────────── ۶. سن و استهلاک ─────────── */

test("equipmentAge: یک سال کامل", () => {
  const a = equipmentAge("2025-01-01", "2026-01-01");
  assert.ok(Math.abs(a.days - 365) <= 1);
  assert.ok(Math.abs(a.years - 1) < 0.05);
});

test("equipmentAge: بدون تاریخ راه‌اندازی صفر است", () => {
  const a = equipmentAge(undefined, "2026-01-01");
  assert.equal(a.days, 0);
  assert.equal(a.months, 0);
});

test("equipmentAge: بازهٔ معکوس صفر می‌شود نه منفی", () => {
  const a = equipmentAge("2027-01-01", "2026-01-01");
  assert.equal(a.days, 0);
});

test("daysBetween: بازهٔ عادی", () => {
  assert.equal(daysBetween("2026-09-01", "2026-09-11"), 10);
});

test("daysBetween: بازهٔ معکوس صفر", () => {
  assert.equal(daysBetween("2026-09-11", "2026-09-01"), 0);
});

test("hoursBetween: دقیق تا ساعت", () => {
  assert.equal(hoursBetween("2026-09-01T00:00", "2026-09-01T06:00"), 6);
});

test("straightLineDepreciation: خط مستقیم ساده", () => {
  const d = straightLineDepreciation(1000, 100, 10, 5);
  assert.equal(d.annual, 90);
  assert.equal(d.accumulated, 450);
  assert.equal(d.bookValue, 550);
  assert.equal(d.ratePct, 45);
});

test("straightLineDepreciation: از ارزش اسقاطی پایین‌تر نمی‌رود", () => {
  const d = straightLineDepreciation(1000, 100, 10, 20);
  assert.equal(d.bookValue, 100);
  assert.equal(d.accumulated, 900);
});

/* ─────────── ۷. بهره‌برداری و دسترس‌پذیری ─────────── */

test("utilization: ۴۰ ساعت در ۱۰ روز کاری (۸۰ ساعت) → ۵۰٪", () => {
  const u = utilization(40, 10, 8);
  assert.equal(u.rate, 50);
  assert.equal(u.verdict, "normal");
});

test("utilization: صفر ساعت → idle", () => {
  const u = utilization(0, 10, 8);
  assert.equal(u.rate, 0);
  assert.equal(u.verdict, "idle");
});

test("utilization: زیر آستانه → low", () => {
  const u = utilization(8, 10, 8, { lowPct: 40, highPct: 75 }); // 10%
  assert.equal(u.verdict, "low");
});

test("utilization: بالای آستانه بالا → high", () => {
  const u = utilization(70, 10, 8, { lowPct: 40, highPct: 75 }); // 87.5%
  assert.equal(u.verdict, "high");
});

test("utilization: سقف ۱۰۰٪ نگه داشته می‌شود", () => {
  const u = utilization(200, 10, 8);
  assert.equal(u.rate, 100);
});

test("availability: بدون توقف → ۱۰۰٪ healthy", () => {
  const a = availability(0, 240);
  assert.equal(a.rate, 100);
  assert.equal(a.verdict, "healthy");
});

test("availability: توقف ۲۴ ساعت در ۲۴۰ → ۹۰٪ degraded", () => {
  const a = availability(24, 240);
  assert.equal(a.rate, 90);
  assert.equal(a.verdict, "degraded");
});

test("availability: توقف ۴۸ ساعت در ۲۴۰ → ۸۰٪ critical", () => {
  const a = availability(48, 240);
  assert.equal(a.rate, 80);
  assert.equal(a.verdict, "critical");
});

/* ─────────── ۸. توقف و قابلیت اطمینان ─────────── */

test("workHoursSum: جمع ساعت کارکرد", () => {
  assert.equal(workHoursSum([{ WorkHours: 10 }, { WorkHours: 4.5 }, { WorkHours: 0 }]), 14.5);
});

test("downtimeHours: توقف داخل بازه شمرده می‌شود", () => {
  const orders = [
    { DownFrom: "2026-09-01T08:00", DownTo: "2026-09-01T14:00", Kind: "corrective", Status: "done", Priority: "high", ReportedAt: "2026-09-01", EquipmentId: "e1", ProjectId: "p1", Code: "WO-1" },
  ];
  assert.equal(downtimeHours(orders, "2026-09-01", "2026-09-10"), 6);
});

test("downtimeHours: توقف بدون DownTo تا انتهای بازه شمرده می‌شود", () => {
  const orders = [{ DownFrom: "2026-09-01T00:00", Kind: "corrective", Status: "open", Priority: "high", ReportedAt: "2026-09-01", EquipmentId: "e1", ProjectId: "p1", Code: "WO-2" }];
  assert.equal(downtimeHours(orders, "2026-09-01", "2026-09-03"), 48);
});

test("downtimeHours: توقف بیرون بازه شمرده نمی‌شود", () => {
  const orders = [{ DownFrom: "2026-08-01T00:00", DownTo: "2026-08-02T00:00", Kind: "corrective", Status: "done", Priority: "low", ReportedAt: "2026-08-01", EquipmentId: "e1", ProjectId: "p1", Code: "WO-3" }];
  assert.equal(downtimeHours(orders, "2026-09-01", "2026-09-10"), 0);
});

test("mtbf: بدون خرابی null است", () => {
  assert.equal(mtbf([], 720), null);
});

test("mtbf: یک خرابی ۶ ساعته در ۷۲۰ ساعت → ۷۱۴", () => {
  const orders = [{ DownFrom: "2026-09-01T00:00", DownTo: "2026-09-01T06:00", Kind: "corrective", Status: "closed", Priority: "high", ReportedAt: "2026-09-01", EquipmentId: "e1", ProjectId: "p1", Code: "WO-4" }];
  const m = mtbf(orders, 720);
  assert.equal(m.mtbfHours, 714);
  assert.equal(m.mtbfDays, 29.75);
});

test("mttr: میانگین زمان تعمیر", () => {
  const orders = [
    { DownFrom: "2026-09-01T00:00", DownTo: "2026-09-01T04:00", Kind: "corrective", Status: "done", Priority: "high", ReportedAt: "2026-09-01", EquipmentId: "e1", ProjectId: "p1", Code: "WO-5" },
    { DownFrom: "2026-09-02T00:00", DownTo: "2026-09-02T08:00", Kind: "corrective", Status: "done", Priority: "high", ReportedAt: "2026-09-02", EquipmentId: "e1", ProjectId: "p1", Code: "WO-6" },
  ];
  const m = mttr(orders);
  assert.equal(m.mttrHours, 6);
});

test("mttr: بدون کار بسته null است", () => {
  assert.equal(mttr([]), null);
});

/* ─────────── ۹. معوقات تعمیر و سرویس دوره‌ای ─────────── */

test("maintenanceBacklog: فقط باز و در جریان شمرده می‌شوند", () => {
  const orders = [
    order({ Status: "open", Priority: "critical" }),
    order({ Code: "WO-2", Status: "in_progress", Priority: "critical" }),
    order({ Code: "WO-3", Status: "done", Priority: "high" }),
    order({ Code: "WO-4", Status: "closed", Priority: "low" }),
  ];
  const b = maintenanceBacklog(orders);
  assert.equal(b.total, 2);
  assert.equal(b.byPriority.critical, 2);
  assert.equal(b.byPriority.high, 0);
});

test("nextPmDue: سررسید در آینده", () => {
  const d = nextPmDue("2026-08-01", 90, "2026-09-01");
  assert.equal(d.overdue, false);
  assert.equal(d.daysLeft, 59);
});

test("nextPmDue: سررسید گذشته → overdue", () => {
  const d = nextPmDue("2026-06-01", 30, "2026-09-01");
  assert.equal(d.overdue, true);
  assert.ok(d.daysLeft < 0);
});

test("nextPmDue: بدون سرویس قبلی → ناتوان", () => {
  const d = nextPmDue(undefined, 90, "2026-09-01");
  assert.equal(d.overdue, false);
  assert.equal(d.dueIso, "");
});

/* ─────────── ۱۰. هزینه اجاره ─────────── */

test("rentalCostAccrued: ماهانه ۳۰ روز = 30/30.44 ماه", () => {
  const r = rentalCostAccrued({ RateType: "monthly", Rate: 1000, StartDate: "2026-09-01", EndDate: "2026-10-01", Status: "active", ProjectId: "p1", EquipmentId: "e1" }, "2026-10-01");
  assert.ok(Math.abs(r.elapsedUnits - 30 / 30.44) < 0.01, "حدود یک ماه");
  assert.ok(Math.abs(r.accrued - 985.5) < 1);
});

test("rentalCostAccrued: سقف پایان قرارداد رعایت می‌شود", () => {
  const r = rentalCostAccrued({ RateType: "daily", Rate: 100, StartDate: "2026-09-01", EndDate: "2026-09-10", Status: "active", ProjectId: "p1", EquipmentId: "e1" }, "2026-12-01");
  assert.equal(r.elapsedUnits, 9);
  assert.equal(r.accrued, 900);
});

test("rentalCostAccrued: ساعتی بر پایه روز×۲۴", () => {
  const r = rentalCostAccrued({ RateType: "hourly", Rate: 50, StartDate: "2026-09-01", EndDate: "2026-09-02", Status: "active", ProjectId: "p1", EquipmentId: "e1" }, "2026-09-02");
  assert.equal(r.elapsedUnits, 24);
  assert.equal(r.accrued, 1200);
});

test("rentalCostAccrued: قرارداد باز تا «اکنون»", () => {
  const r = rentalCostAccrued({ RateType: "daily", Rate: 10, StartDate: "2026-09-01", Status: "active", ProjectId: "p1", EquipmentId: "e1" }, "2026-09-11");
  assert.equal(r.elapsedUnits, 10);
  assert.equal(r.accrued, 100);
});

test("rentalCostAccrued: اکنون قبل از شروع → صفر", () => {
  const r = rentalCostAccrued({ RateType: "daily", Rate: 10, StartDate: "2026-09-01", EndDate: "2026-09-10", Status: "active", ProjectId: "p1", EquipmentId: "e1" }, "2026-08-01");
  assert.equal(r.accrued, 0);
});

/* ─────────── ۱۱. هزینه هر ساعت و بهره‌وری ─────────── */

test("equipmentCostPerHour: مجموع هزینه تقسیم بر ساعت", () => {
  const c = equipmentCostPerHour(100, { rentalCost: 5000, maintenanceCost: 2000, fuelCost: 1000 });
  assert.equal(c.totalCost, 8000);
  assert.equal(c.costPerHour, 80);
});

test("equipmentCostPerHour: ساعت صفر نرخ سنجش‌ناپذیر می‌دهد نه کل هزینه", () => {
  const c = equipmentCostPerHour(0, { rentalCost: 1000 });
  assert.equal(c.totalCost, 1000, "هزینهٔ ماشین بیکار باید در جمع بماند");
  assert.equal(c.costPerHour, null, "نرخ ساعتی ماشین بدون کارکرد باید null باشد");
});

test("equipmentCostPerHour: ماشین اجاره‌ای بیکار گران‌ترین ماشین ناوگان جلوه نمی‌کند", () => {
  const idle = equipmentCostPerHour(0, { rentalCost: 768725361, maintenanceCost: 25000000 });
  const busy = equipmentCostPerHour(110, { fuelCost: 27420000 });
  assert.equal(idle.costPerHour, null);
  assert.equal(busy.costPerHour, 249272.73);
});

test("productivity: دقیقاً روی برنامه", () => {
  const p = productivity(100, 100);
  assert.equal(p.index, 1);
  assert.equal(p.verdict, "on_plan");
});

test("productivity: کمتر از ۹۰٪ → under", () => {
  assert.equal(productivity(80, 100).verdict, "under");
});

test("productivity: بیش از ۱۱۰٪ → over", () => {
  assert.equal(productivity(120, 100).verdict, "over");
});

test("productivity: برنامه صفر → ایندکس صفر", () => {
  assert.equal(productivity(10, 0).index, 0);
});

/* ─────────── ۱۲. هشدار زودهنگام ─────────── */

const ctx = (over = {}) => ({
  nowIso: "2026-09-09",
  periodDays: 30,
  workHours: 120,
  downtimeHrs: 4,
  orders: [],
  ageYears: 2,
  economicLifeYears: 12,
  utilLowPct: 40,
  ...over,
});

test("eqmEws: ماشین سالم هشدار ندارد", () => {
  const w = eqmEws(eq(), ctx());
  assert.deepEqual(w, []);
});

test("eqmEws: فعال ولی بدون کارکرد → W-EQM-IDLE", () => {
  const w = eqmEws(eq(), ctx({ workHours: 0, periodDays: 30 }));
  assert.ok(w.some((x) => x.code === "W-EQM-IDLE"));
});

test("eqmEws: بهره‌برداری پایین → W-EQM-LOW-UTIL", () => {
  const w = eqmEws(eq(), ctx({ workHours: 10, periodDays: 30 }));
  assert.ok(w.some((x) => x.code === "W-EQM-LOW-UTIL"));
});

test("eqmEws: توقف زیاد → W-EQM-DOWNTIME critical", () => {
  const w = eqmEws(eq(), ctx({ downtimeHrs: 200, periodDays: 30 }));
  const d = w.find((x) => x.code === "W-EQM-DOWNTIME");
  assert.equal(d.severity, "critical");
});

test("eqmEws: دستورکار بحرانی باز → W-EQM-BACKLOG critical", () => {
  const w = eqmEws(eq(), ctx({ orders: [order({ Status: "open", Priority: "critical" })] }));
  const b = w.find((x) => x.code === "W-EQM-BACKLOG");
  assert.equal(b.severity, "critical");
});

test("eqmEws: سرویس دوره‌ای گذشته → W-EQM-PM-DUE critical", () => {
  const w = eqmEws(eq(), ctx({ lastPmIso: "2026-07-01", pmIntervalDays: 30 }));
  const p = w.find((x) => x.code === "W-EQM-PM-DUE");
  assert.equal(p.severity, "critical");
});

test("eqmEws: قرارداد اجاره رو به پایان → W-EQM-RENT-EXPIRY", () => {
  const rental = { ProjectId: "p1", EquipmentId: "e1", RateType: "monthly", Rate: 100, StartDate: "2026-01-01", EndDate: "2026-09-15", Status: "active" };
  const w = eqmEws(eq(), ctx({ rental }));
  assert.ok(w.some((x) => x.code === "W-EQM-RENT-EXPIRY"));
});

test("eqmEws: فرسودگی سنی → W-EQM-AGING", () => {
  const w = eqmEws(eq(), ctx({ ageYears: 13, economicLifeYears: 12 }));
  assert.ok(w.some((x) => x.code === "W-EQM-AGING"));
});

test("eqmEws: ماشین متوقف از فرسودگی هشدار نمی‌دهد", () => {
  const w = eqmEws(eq({ Status: "disposed" }), ctx({ ageYears: 20, economicLifeYears: 12 }));
  assert.equal(w.some((x) => x.code === "W-EQM-AGING"), false);
});

/* ─────────── ۱۳. خلاصه ناوگان ─────────── */

test("fleetSummary: شمارش و میانگین‌ها", () => {
  const fleet = [
    eq(),
    eq({ Code: "EQ-002", Category: "LDR", Status: "repair", Ownership: "rented" }),
    eq({ Code: "EQ-003", Category: "GEN", Status: "idle", Ownership: "owned" }),
  ];
  const s = fleetSummary(fleet, [{ workHours: 80, downtimeHrs: 0, periodDays: 10 }, { workHours: 0, downtimeHrs: 48, periodDays: 10 }, { workHours: 40, downtimeHrs: 0, periodDays: 10 }], 2, 500, 1);
  assert.equal(s.total, 3);
  assert.equal(s.byCategory.EXC, 1);
  assert.equal(s.byStatus.repair, 1);
  assert.equal(s.byOwnership.rented, 1);
  assert.equal(s.openMaintenance, 2);
  assert.equal(s.accruedRent, 500);
  assert.equal(s.warnings, 1);
  assert.equal(s.inRepair, 1);
});

test("fleetSummary: ناوگان خالی", () => {
  const s = fleetSummary([], [], 0, 0, 0);
  assert.equal(s.total, 0);
  assert.equal(s.avgUtilization, 0);
});

test("fleetSummary: میانگین بهره‌برداری بین ۰ و ۱۰۰", () => {
  const s = fleetSummary([eq()], [{ workHours: 40, downtimeHrs: 0, periodDays: 10 }], 0, 0, 0);
  assert.ok(s.avgUtilization > 0 && s.avgUtilization <= 100);
});
