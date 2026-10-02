/** موتور جداول پشتیبان گزارش روزانه (dprt-v1) — آزمون منطق خالص.
 *
 * از روی باندل `server/dprTablesLogic.js` می‌خواند (تولید `build:dprt`) تا
 * دقیقاً همان کدی آزمون شود که سرور اجرا می‌کند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DPR_TABLES_VERSION,
  DPR_MANPOWER,
  DPR_MACHINERY,
  DPR_SITE_STATUSES,
  DPR_WEATHERS,
  JALALI_MONTHS_FA,
  activityCalc,
  activityHistoryKey,
  buildSampleThreeDayReports,
  changeCalc,
  emptyReport,
  historyFromReports,
  materialBlockForRow,
  materialRowQty,
  incrementTrailingNumber,
  jalaliMonthNameFa,
  machineryTotals,
  manpowerTotals,
  nextReportStatus,
  normalizeReport,
  splitReportDate,
  validateReport,
} from "./dprTablesLogic.js";

/* ── فهرست‌های ثابت ─────────────────────────────────────────────── */

test("dprt: نسخه و یکتایی کدها", () => {
  assert.equal(DPR_TABLES_VERSION, "dprt-v1");
  for (const [list, prefix] of [[DPR_MANPOWER, "MP"], [DPR_MACHINERY, "MC"]]) {
    const codes = list.map((r) => r.code);
    assert.equal(new Set(codes).size, codes.length);
    codes.forEach((c, i) => assert.equal(c, `${prefix}-${String(i + 1).padStart(3, "0")}`));
    for (const r of list) {
      assert.ok(r.title && r.title.trim().length > 0);
      assert.ok(r.group && r.group.trim().length > 0);
    }
  }
});

test("dprt: شمارش فهرست‌ها (نیروی انسانی ۱۶۰؛ ماشین‌آلات ۱۶۰)", () => {
  assert.equal(DPR_MANPOWER.length, 160);
  assert.equal(DPR_MACHINERY.length, 160);
  const kinds = new Set(DPR_MANPOWER.map((r) => r.kind));
  assert.deepEqual([...kinds].sort(), ["direct", "indirect"]);
  assert.ok(DPR_MANPOWER.some((r) => r.kind === "direct"));
  assert.ok(DPR_MANPOWER.some((r) => r.kind === "indirect"));
});

test("dprt: وضعیت‌ها و آب‌وهوا عین عکس‌اند", () => {
  assert.deepEqual(DPR_SITE_STATUSES, ["Active", "In Active", "SemiActive"]);
  assert.ok(DPR_WEATHERS.includes("Sunny"));
  assert.ok(DPR_WEATHERS.includes("Cloudy"));
  assert.ok(DPR_WEATHERS.includes("Cyclone"));
  assert.equal(JALALI_MONTHS_FA.length, 12);
  assert.equal(jalaliMonthNameFa(8), "آبان");
});

/* ── تاریخ شمسی ─────────────────────────────────────────────────── */

test("dprt: تجزیهٔ تاریخ معتبر و نامعتبر", () => {
  assert.deepEqual(splitReportDate("1403/08/26"), { year: 1403, month: 8, day: 26 });
  assert.equal(splitReportDate("1403/13/01"), null);
  assert.equal(splitReportDate("1403/08/32"), null);
  assert.equal(splitReportDate("1403/8/26"), null);
  assert.equal(splitReportDate("2026-09-30"), null);
  assert.equal(splitReportDate(""), null);
  assert.deepEqual(splitReportDate("  1403/08/26  "), { year: 1403, month: 8, day: 26 });
});

test("dprt: افزایش سریال شماره گزارش", () => {
  assert.equal(incrementTrailingNumber("C-Sek-Ps-40301-DRT-171"), "C-Sek-Ps-40301-DRT-172");
  assert.equal(incrementTrailingNumber("DRT-9"), "DRT-10");
  assert.equal(incrementTrailingNumber("DRT-099"), "DRT-100");
  assert.equal(incrementTrailingNumber("گزارش"), "گزارش-2");
  assert.equal(incrementTrailingNumber(""), "");
});

/* ── جمع‌ها ─────────────────────────────────────────────────────── */

test("dprt: جمع نیروی انسانی (نمونهٔ عکس: همه ۱)", () => {
  const entries = {};
  for (const m of DPR_MANPOWER) entries[m.code] = { pd: 1, ad: 1, pn: 1, an: 1 };
  const t = manpowerTotals(entries);
  const n = DPR_MANPOWER.length;
  assert.equal(t.grand.pd, n);
  assert.equal(t.grand.total, n * 4);
  assert.equal(t.rows["MP-001"].day, 2);
  assert.equal(t.rows["MP-001"].night, 2);
  const directCount = DPR_MANPOWER.filter((m) => m.kind === "direct").length;
  assert.equal(t.direct.total, directCount * 4);
  assert.equal(t.direct.total + t.indirect.total, t.grand.total);
});

test("dprt: جمع نیروی انسانی تُنُک (خانهٔ خالی = صفر)", () => {
  const t = manpowerTotals({ "MP-001": { pd: 3, ad: 0, pn: 0, an: 0 } });
  assert.equal(t.grand.pd, 3);
  assert.equal(t.grand.total, 3);
  assert.equal(t.rows["MP-002"].total, 0);
});

test("dprt: جمع ماشین‌آلات", () => {
  const t = machineryTotals({
    "MC-001": { active: 2, ready: 1, repair: 0, owner: "پیمانکار" },
    "MC-002": { active: 0, ready: 0, repair: 1, owner: "" },
  });
  assert.equal(t.rows["MC-001"], 3);
  assert.equal(t.active, 2);
  assert.equal(t.ready, 1);
  assert.equal(t.repair, 1);
  assert.equal(t.grand, 4);
});

/* ── فرمول‌های تجمعی ────────────────────────────────────────────── */

test("dprt: فرمول Change Order عین اکسل", () => {
  assert.deepEqual(changeCalc(2000, 120, 60), { cum: 180, remaining: 1820, pct: 9 });
  assert.deepEqual(changeCalc(null, 120, 60), { cum: 180, remaining: null, pct: null });
  assert.deepEqual(changeCalc(0, 0, 0), { cum: 0, remaining: null, pct: null });
});

test("dprt: فرمول فعالیت اصلی (نمونهٔ عکس: ۱۲۰ از ۲۰۰۰ = ۶٪)", () => {
  const r = activityCalc(2000, 0, 120);
  assert.equal(r.cum, 120);
  assert.equal(r.rem, 1880);
  assert.equal(r.cumPct, 6);
  assert.equal(r.todayPct, 6);
  assert.equal(r.lastPct, 0);
  const r2 = activityCalc(2000, 120, 60);
  assert.equal(r2.cum, 180);
  assert.equal(r2.cumPct, 9);
});

test("dprt: سابقه از گزارش‌های قبلی (نه خود روز)", () => {
  const reports = [
    { reportDate: "1403/08/26", changes: [{ refId: "CO-1", thisQty: 100 }], activities: [{ acCode: "A", activity: "بتن", todayQty: 50 }] },
    { reportDate: "1403/08/27", changes: [{ refId: "CO-1", thisQty: 20 }], activities: [{ acCode: "A", activity: "بتن", todayQty: 10 }] },
    { reportDate: "1403/08/28", changes: [{ refId: "CO-1", thisQty: 999 }], activities: [] },
  ];
  const h = historyFromReports(reports, "1403/08/28");
  assert.equal(h.changes["CO-1"], 120);
  assert.equal(h.activities[activityHistoryKey("A", "بتن")], 60);
  assert.equal(activityHistoryKey(" A ", "بتن "), activityHistoryKey("A", "بتن"));
});

test("dprt: داده فرضی سه‌روزه معتبر است و خروجی روزانه تاریخ‌محور می‌ماند", () => {
  const seeded = buildSampleThreeDayReports("PC-2401");
  assert.deepEqual(Object.keys(seeded), ["1403/08/24", "1403/08/25", "1403/08/26"]);
  for (const report of Object.values(seeded)) assert.equal(validateReport(report).ok, true);

  assert.equal(seeded["1403/08/24"].site.minTemp, 17);
  assert.equal(seeded["1403/08/26"].site.workShift, "Day & Night Shift");
  assert.ok(seeded["1403/08/26"].narrative.areaOfConcerns2.includes("جرثقیل"));
  const reports = Object.values(seeded);
  const history = historyFromReports(reports, "1403/08/26");
  assert.equal(history.manpower["MP-001"], 7);
  assert.equal(history.machinery["MC-001"], 8);
  assert.equal(history.activities[activityHistoryKey("CIV-01", reports[0].activities[0].activity)], 110);
  assert.equal(history.materialsByBlock.rebar["Rebar Φ16 (AIII)"].qty, 53);
  assert.equal(materialBlockForRow({ group: "Electrical& instrument", desc: "Cable Shoe" }), "elec-inst");
  assert.equal(materialRowQty(reports[0].materials[0]), 24);
});

/* ── گذار وضعیت ─────────────────────────────────────────────────── */

test("dprt: گذارهای مجاز و نامجاز", () => {
  assert.equal(nextReportStatus("draft", "submit"), "submitted");
  assert.equal(nextReportStatus("submitted", "approve"), "approved");
  assert.equal(nextReportStatus("submitted", "return"), "draft");
  assert.equal(nextReportStatus("draft", "approve"), null);
  assert.equal(nextReportStatus("approved", "return"), null);
  assert.equal(nextReportStatus("approved", "submit"), null);
});

/* ── اعتبارسنجی ─────────────────────────────────────────────────── */

test("dprt: پوستهٔ خالی معتبر است (ذخیرهٔ تدریجی)", () => {
  const v = validateReport(emptyReport("PC-2401", "1403/08/26", "DRT-1"));
  assert.equal(v.ok, true);
  assert.deepEqual(v.issues, []);
});

test("dprt: متریال وارده — شرح لازم و اعداد نامنفی", () => {
  const r = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  assert.deepEqual(r.materials, []);
  r.materials = [{ group: "مصالح", itemCode: "AGG-01", desc: "شن بادامی", truckNo: "12ع345", ticketNo: "B-9", grade: "", unit: "تن", gross: 30, tare: 12, net: 18, qtyVcn: null, tonnage: 18, entryDate: "1403/08/26", entryTime: "08:30", contractor: "الف", usage: "قطعه ۲" }];
  assert.equal(validateReport(r).ok, true);
  const bad = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  bad.materials = [{ ...r.materials[0], desc: "  " }];
  assert.ok(validateReport(bad).issues.some((m) => m.includes("شرح")));
  const bad2 = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  bad2.materials = [{ ...r.materials[0], gross: -5 }];
  assert.ok(validateReport(bad2).issues.some((m) => m.includes("پر")));
  const bad3 = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  bad3.materials = [{ ...r.materials[0], entryDate: "26/08" }];
  assert.ok(validateReport(bad3).issues.some((m) => m.includes("تاریخ ورود")));
  // گزارش قدیمی بدون فیلد متریال نرمال می‌شود
  const legacy = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  delete legacy.materials;
  assert.deepEqual(normalizeReport(legacy).materials, []);
});

test("dprt: خطاهای هویتی", () => {
  const bad = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  bad.reportDate = "26/08/1403";
  assert.equal(validateReport(bad).ok, false);
  const bad2 = emptyReport("PC-2401", "1403/08/26", "");
  assert.equal(validateReport(bad2).ok, false);
  const bad3 = emptyReport("../x", "1403/08/26", "DRT-1");
  assert.ok(validateReport(bad3).issues.some((m) => m.includes("پروژه")));
});

test("dprt: خطاهای وضعیت کارگاه و هوا", () => {
  const r = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  r.site.siteStatus = "Activee";
  r.site.weather = "برفی";
  r.site.humidity = 120;
  r.site.avgTemp = 100;
  const v = validateReport(r);
  assert.equal(v.ok, false);
  assert.equal(v.issues.length, 4);
});

test("dprt: کد ناشناخته و عدد منفی مردود است", () => {
  const r = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  r.manpower = { "MP-999": { pd: 1, ad: 0, pn: 0, an: 0 } };
  assert.equal(validateReport(r).ok, false);
  const r2 = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  r2.manpower = { "MP-001": { pd: -1, ad: 0, pn: 0, an: 0 } };
  assert.equal(validateReport(r2).ok, false);
  const r3 = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  r3.manpower = { "MP-001": { pd: 1.5, ad: 0, pn: 0, an: 0 } };
  assert.equal(validateReport(r3).ok, false);
  const r4 = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  r4.machinery = { "MC-001": { active: 1, ready: 0, repair: 0, owner: "x".repeat(200) } };
  assert.equal(validateReport(r4).ok, false);
});

test("dprt: ردیف تغییرات بدون ID و فعالیت بدون عنوان مردود است", () => {
  const r = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  r.changes = [{ date: "", refId: "", location: "", unit: "", discipline: "", activity: "", totalQty: null, thisQty: 5, contractor: "", opsFa: "", noteFa: "" }];
  assert.equal(validateReport(r).ok, false);
  const r2 = emptyReport("PC-2401", "1403/08/26", "DRT-1");
  r2.activities = [{ acCode: "", subPhase: "", dis: "", area: "", workPackage: "", subPackage: "", activity: "", unit: "", estimated: null, todayQty: 5, startDate: "", endDate: "", executor: "", note: "" }];
  assert.equal(validateReport(r2).ok, false);
});
