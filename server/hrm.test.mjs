import test from "node:test";
import assert from "node:assert/strict";
import {
  IRAN_LABOR_LAW,
  TRADE_CATALOG,
  TRADE_BY_CODE,
  costFactor,
  distribute,
  headcountFor,
  hrmEws,
  indirectShare,
  mobilizationVariance,
  obsHealth,
  peakFactor,
  productivityIndex,
  rampUpFactor,
  reparent,
  splitHours,
  unitRate,
  validateObs,
  validatePlan,
} from "./hrmLogic.js";

/* ─────────── تفکیک ساعت طبق قانون کار ─────────── */

test("splitHours: روز کاری عادی، ۱۱.۵ ساعت → ۸ عادی + ۳.۵ اضافه‌کاری", () => {
  const h = splitHours(11.5, { dateIso: "2026-09-07" }); // دوشنبه
  assert.equal(h.normal, 8);
  assert.equal(h.ot, 3.5);
  assert.equal(h.holiday, 0);
  assert.equal(h.rejected, 0);
});

test("splitHours: جمعه کل ساعت تعطیل‌کاری است، نه اضافه‌کاری", () => {
  const h = splitHours(9, { dateIso: "2026-09-11" }); // جمعه
  assert.equal(h.holiday, 9);
  assert.equal(h.normal, 0);
  assert.equal(h.ot, 0);
});

test("splitHours: سقف مطلق ۱۶ ساعت مازاد را رد می‌کند", () => {
  const h = splitHours(6, { dateIso: "2026-09-07", priorHoursToday: 13 });
  assert.equal(h.rejected, 3);
  assert.equal(h.normal + h.ot, 3);
});

test("splitHours: ساعت غیرمثبت خروجی صفر می‌دهد", () => {
  const h = splitHours(0, { dateIso: "2026-09-07" });
  assert.equal(h.raw, 0);
  assert.equal(h.normal, 0);
});

test("costFactor: ضریب مؤثر اضافه‌کاری ۱.۴ اعمال می‌شود", () => {
  const h = splitHours(10, { dateIso: "2026-09-07" });
  // ۸ عادی + ۲ اضافه‌کاری×۱.۴ = ۱۰.۸
  assert.equal(costFactor(h, IRAN_LABOR_LAW), 10.8);
});

test("costFactor: شب‌کاری فقط فوق‌العاده اضافه می‌کند نه ساعت مضاعف", () => {
  const day = splitHours(8, { dateIso: "2026-09-07", shift: "day" });
  const night = splitHours(8, { dateIso: "2026-09-07", shift: "night" });
  assert.equal(Math.round((costFactor(night) - costFactor(day)) * 100) / 100, 2.8); // 8 × 0.35
});

/* ─────────── اعتبارسنجی سازمان ─────────── */

const OBS = [
  { id: "A", code: "P", fa: "پروژه", en: "Project", level: 1, wbsLink: [], managerId: "m1" },
  { id: "B", parentId: "A", code: "P.CIV", fa: "عمران", en: "Civil", level: 2, wbsLink: ["W1"], managerId: "m2" },
  { id: "C", parentId: "B", code: "P.CIV.A1", fa: "منطقه ۱", en: "Area 1", level: 3, wbsLink: ["W1"], managerId: "m3", headcount: 40 },
];

test("validateObs: ساختار سالم هیچ خطایی ندارد", () => {
  assert.equal(validateObs(OBS).filter((i) => i.severity === "error").length, 0);
});

test("validateObs: کد ناهم‌خوان با والد خطای E-HRM-110 می‌دهد", () => {
  const bad = [...OBS, { id: "D", parentId: "B", code: "X.WRONG", fa: "بد", en: "Bad", level: 3, wbsLink: [] }];
  assert.ok(validateObs(bad).some((i) => i.code === "E-HRM-110"));
});

test("validateObs: گره سطح سه بدون مسئول هشدار می‌گیرد", () => {
  const bad = [...OBS.slice(0, 2), { id: "C", parentId: "B", code: "P.CIV.A1", fa: "م", en: "A", level: 3, wbsLink: [] }];
  assert.ok(validateObs(bad).some((i) => i.code === "W-HRM-310"));
});

test("reparent: کدها آبشاری بازنویسی می‌شوند ولی شناسه‌ها ثابت می‌مانند", () => {
  const nodes = [
    ...OBS,
    { id: "E", parentId: "A", code: "P.MEC", fa: "مکانیک", en: "Mech", level: 2, wbsLink: [], managerId: "m4" },
  ];
  const out = reparent(nodes, "C", "E");
  const moved = out.find((n) => n.id === "C");
  assert.equal(moved.code, "P.MEC.A1");
  assert.equal(moved.level, 3);
  assert.equal(moved.id, "C"); // شناسه عوض نشد → تاریخچه تایم‌شیت سالم می‌ماند
});

test("obsHealth: حیطه نظارت بالای ۳۵ وضعیت را زرد می‌کند", () => {
  const wide = [{ id: "X", code: "P.C.A", fa: "", en: "", level: 4, wbsLink: [], headcount: 90 }];
  assert.equal(obsHealth(wide, ["W1"]).status, "amber");
});

/* ─────────── برنامه‌ریزی نیرو ─────────── */

test("distribute: جمع هر توزیع برابر یک است", () => {
  for (const shape of ["uniform", "bell", "front_loaded", "back_loaded"]) {
    const d = distribute(8, shape);
    const sum = d.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${shape} → ${sum}`);
  }
});

test("distribute: front_loaded وزن بیشتری به ابتدای بازه می‌دهد", () => {
  const d = distribute(6, "front_loaded");
  assert.ok(d[0] > d[5]);
});

test("headcountFor: گرد کردن به بالا انجام می‌شود", () => {
  assert.equal(headcountFor(100, 8.5), 12); // 11.76 → 12
  assert.equal(headcountFor(0, 8.5), 0);
});

test("peakFactor: برنامه سوزنی ضریب بالای ۲.۵ می‌دهد", () => {
  assert.ok(peakFactor([10, 10, 100, 10]) > 2.5);
  assert.ok(peakFactor([50, 50, 50, 50]) === 1);
});

test("mobilizationVariance: کمبود نیرو منفی و بیش‌تجهیز مثبت است", () => {
  assert.equal(mobilizationVariance(90, 100), -10);
  assert.equal(mobilizationVariance(120, 100), 20);
  assert.equal(mobilizationVariance(50, 0), 0);
});

test("rampUpFactor: هفته سوم به راندمان کامل می‌رسد", () => {
  assert.equal(rampUpFactor(1, 3), 0.33);
  assert.equal(rampUpFactor(3, 3), 1);
  assert.equal(rampUpFactor(9, 3), 1);
});

test("indirectShare: سهم نیروی غیرمستقیم درست محاسبه می‌شود", () => {
  const rows = [
    { tradeCode: "CIV-RBR", headcount: 80 }, // مستقیم
    { tradeCode: "HSE-OFF", headcount: 20 }, // غیرمستقیم
  ];
  assert.equal(indirectShare(rows), 20);
});

test("validatePlan: اختلاف بیش از ۲٪ با نفر-ساعت برنامه زمان‌بندی خطا می‌دهد", () => {
  const lines = [
    { id: "L1", periodCode: "P1", periodStart: "", periodEnd: "", tradeCode: "CIV-RBR", obsNodeId: "A", plannedHeadcount: 10, plannedMH: 1000 },
  ];
  assert.ok(validatePlan(lines, 2000).some((i) => i.code === "E-HRM-120"));
  assert.equal(validatePlan(lines, 1010).filter((i) => i.code === "E-HRM-120").length, 0);
});

test("validatePlan: رسته ناشناخته خطای E-HRM-121 می‌دهد", () => {
  const lines = [
    { id: "L1", periodCode: "P1", periodStart: "", periodEnd: "", tradeCode: "NOPE", obsNodeId: "A", plannedHeadcount: 10, plannedMH: 1000 },
  ];
  assert.ok(validatePlan(lines, 1000).some((i) => i.code === "E-HRM-121"));
});

/* ─────────── بهره‌وری ─────────── */

test("productivityIndex: شاخص از پیشرفت تأییدشده محاسبه می‌شود", () => {
  const r = productivityIndex(1000, 50, 400);
  assert.equal(r.earnedMH, 500);
  assert.equal(r.pi, 1.25);
  assert.equal(r.status, "green");
});

test("productivityIndex: زیر ۰.۸۵ قرمز می‌شود", () => {
  assert.equal(productivityIndex(1000, 50, 700).status, "red");
});

test("productivityIndex: ساعت واقعی صفر شاخص را صفر و وضعیت را na می‌کند", () => {
  const r = productivityIndex(1000, 50, 0);
  assert.equal(r.pi, 0);
  assert.equal(r.status, "na");
});

test("productivityIndex: درصد پیشرفت خارج از بازه مهار می‌شود", () => {
  assert.equal(productivityIndex(1000, 180, 500).earnedMH, 1000);
});

test("unitRate: انحراف نسبت به نرخ استاندارد رسته محاسبه می‌شود", () => {
  const r = unitRate(35, 100, "WLD-6G"); // نرخ استاندارد ۰.۳۵
  assert.equal(r.rate, 0.35);
  assert.equal(r.variancePct, 0);
});

/* ─────────── هشدار زودهنگام ─────────── */

test("hrmEws: چهار قاعده اصلی در شرایط بحرانی فعال می‌شوند", () => {
  const alerts = hrmEws({ mobVarPct: -30, piWorst: 0.6, otPct: 30, expiringDocs: 4 });
  const codes = alerts.map((a) => a.code);
  assert.ok(codes.includes("EWS-HRM-01"));
  assert.ok(codes.includes("EWS-HRM-02"));
  assert.ok(codes.includes("EWS-HRM-03"));
  assert.ok(codes.includes("EWS-HRM-04"));
  assert.equal(alerts.find((a) => a.code === "EWS-HRM-01").severity, "critical");
});

test("hrmEws: وضعیت سالم هیچ هشداری تولید نمی‌کند", () => {
  assert.equal(hrmEws({ mobVarPct: 3, piWorst: 1.05, otPct: 8, expiringDocs: 0 }).length, 0);
});

/* ─────────── کاتالوگ رسته ─────────── */

test("کاتالوگ رسته: ۶۶ رسته با کد یکتا", () => {
  assert.equal(TRADE_CATALOG.length, 66);
  assert.equal(new Set(TRADE_CATALOG.map((t) => t.code)).size, 66);
});

test("کاتالوگ رسته: نگاشت کد به رسته کامل است و رسته‌های مستقیم اکثریت دارند", () => {
  assert.equal(TRADE_BY_CODE["WLD-6G"].stdRate, 0.35);
  assert.ok(TRADE_CATALOG.filter((t) => t.direct).length > TRADE_CATALOG.filter((t) => !t.direct).length);
});

test("کاتالوگ رسته: هر رسته دارای نرخ استاندارد، واحد هم دارد", () => {
  for (const t of TRADE_CATALOG) {
    if (t.stdRate !== undefined) assert.ok(t.uom, `${t.code} واحد ندارد`);
  }
});
